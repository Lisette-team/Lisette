import * as DocumentPicker from "expo-document-picker";
import { formatDate } from "@/i18n/format";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import { listGenres, type Genre } from "@/features/calls/api";
import { listWorks, type Work } from "@/features/manuscripts/api";
import { confirmPrivateAction } from "@/features/manuscripts/device-auth";
import { checkEligibility, getContact, uploadMaterial } from "@/features/submissions/api";
import {
  newIdempotencyKey,
  retryItems,
  submitBatch,
  type SubmitItem,
  type SubmitOutcome,
} from "@/features/submissions/batch";
import { Catalogue } from "@/features/submissions/catalogue";
import { getOpenCall, type OpenCall } from "@/features/submissions/catalogue-api";
import { toggleCall } from "@/features/submissions/selection";
import { BlockedSend, ChoiceRow, PickerRow, StatusChip, StepHeader } from "@/features/submissions/submit-steps";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { VersionTree } from "@/features/manuscripts/version-tree";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";

type Step = "version" | "calls" | "materials" | "review" | "result";
type Picked = { name: string; path: string };

const TITLE_KEYS: Record<Step, string> = {
  version: "submit.stepVersion",
  calls: "submit.stepCalls",
  materials: "submit.stepMaterials",
  review: "submit.reviewAndSend",
  result: "submit.results",
};

const SHARING_KEYS: Record<OpenCall["sharing_policy"], string> = {
  author_controlled: "submit.sharingAuthorControlled",
  synopsis_approval: "submit.sharingSynopsisApproval",
  synopsis_and_excerpt_approval: "submit.sharingApproval",
};

// The items are frozen after the first send, so only these can succeed when sent again.
const RETRYABLE = new Set(["call_not_open", "missing_phone"]);

// S-25 to S-27: one manuscript version to several calls. Started from a version (/submit/<versionId>)
// or from a call (/submit/choose?callId=…), which adds a first step to choose the version and
// pre-selects that call. The synopsis, sample and introduction are given once and go to every call
// that asks for them. After the first send the items are frozen: a retry resends them unchanged with
// the same keys, so an unknown outcome resolves to what was really sent.
export default function Submit() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const params = useLocalSearchParams<{ versionId: string; callId?: string; workId?: string }>();
  const choosing = params.versionId === "choose";
  const [versionId, setVersionId] = useState<string | null>(choosing ? null : params.versionId);
  const [works, setWorks] = useState<Work[] | null>(null);
  const [skippedVersion, setSkippedVersion] = useState(false);
  const initialChoiceMade = useRef(false);
  const [workScope, setWorkScope] = useState<string | undefined>(params.workId);
  const [callClosed, setCallClosed] = useState(false);
  const [step, setStep] = useState<Step>(choosing ? "version" : "calls");
  const [selected, setSelected] = useState<Map<string, OpenCall>>(new Map());
  const [reasons, setReasons] = useState<Map<string, string>>(new Map());
  const [synopsis, setSynopsis] = useState<Picked | null>(null);
  const [sample, setSample] = useState<Picked | null>(null);
  const [picking, setPicking] = useState<"synopsis" | "sample" | null>(null);
  const [intro, setIntro] = useState("");
  const [genreFor, setGenreFor] = useState<Record<string, string>>({});
  const [genres, setGenres] = useState<Genre[]>([]);
  const [contact, setContact] = useState<{ contact_email: string; phone: string | null } | null>(null);
  const [rights, setRights] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  const [rules, setRules] = useState(false);
  const [items, setItems] = useState<SubmitItem[]>([]);
  const [outcomes, setOutcomes] = useState<SubmitOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per call for the whole session, so a repeat never creates a second submission.
  const keys = useRef(new Map<string, string>());
  // A ref, not state: two quick taps land before React re-renders with busy = true.
  const sending = useRef(false);

  const steps: Step[] = (choosing && !skippedVersion) || step === "version"
    ? ["version", "calls", "materials", "review", "result"]
    : ["calls", "materials", "review", "result"];
  const calls = [...selected.values()];
  const needs = {
    synopsis: calls.some((call) => call.req_synopsis),
    sample: calls.some((call) => call.req_sample),
    intro: calls.some((call) => call.req_author_intro),
    genre: calls.some((call) => call.req_genre),
  };
  const needsMaterials = needs.synopsis || needs.sample || needs.intro || needs.genre;
  const back: Step | null =
    step === "calls"
      ? choosing && !skippedVersion
        ? "version"
        : null
      : step === "materials"
        ? "calls"
        : step === "review"
          ? needsMaterials
            ? "materials"
            : "calls"
          : null;

  useEffect(() => {
    listGenres()
      .then(setGenres)
      .catch(() => setError(t("errors.network")));
  }, [t]);

  const userId = session?.userId;
  useEffect(() => {
    if (!userId) return;
    listWorks(userId)
      .then((loaded) => {
        setWorks(loaded);
        if (!choosing || initialChoiceMade.current) return;
        initialChoiceMade.current = true;
        const eligible = loaded.filter((work) => !params.workId || work.id === params.workId).filter((work) => work.versions.length);
        const available = eligible.flatMap((work) => work.versions);
        if (!available.length) return;
        const first = eligible[0];
        setVersionId(first.versions.find((version) => version.id === first.main_version_id)?.id ?? first.versions[0].id);
        if (available.length === 1) { setSkippedVersion(true); setStep("calls"); }
      })
      .catch(() => setError(t("errors.network")));
  }, [userId, choosing, params.workId, t]);

  // The call the send started from, selected for the writer. Gone or closed: say so, keep going.
  useEffect(() => {
    if (!params.callId) return;
    getOpenCall(params.callId)
      .then((call) => (call ? setSelected(new Map([[call.id, call]])) : setCallClosed(true)))
      .catch(() => setError(t("errors.network")));
  }, [params.callId, t]);

  // Android's back button steps back inside the flow instead of leaving it. Only while this screen is
  // focused: on the PDF preview pushed from the review step, back must close the preview.
  useFocusEffect(
    useCallback(() => {
      if (!back) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        setStep(back);
        return true;
      });
      return () => subscription.remove();
    }, [back]),
  );

  if (session && !session.authorEnabled) return <Redirect href="/manuscripts" />;

  const keyFor = (callId: string) => {
    if (!keys.current.has(callId)) keys.current.set(callId, newIdempotencyKey());
    return keys.current.get(callId)!;
  };
  const genreName = (genre: Genre) => (i18n.language === "ro" ? genre.name_ro : genre.name_en);
  const genreLabel = (id: string) => {
    const genre = genres.find((g) => g.id === id);
    return genre ? genreName(genre) : "";
  };
  const reasonText = (reason: string) => t(`submit.reason_${reason}`);
  const date = (iso: string) => formatDate(iso, i18n.language);

  function chooseVersion(id: string) {
    setVersionId(id);
    setReasons(new Map());
    setError(null);
    setStep("calls");
  }

  async function toMaterials() {
    if (calls.length === 0) return setError(t("submit.pickCall"));
    setBusy(true);
    setError(null);
    try {
      const answers = await checkEligibility(
        versionId!,
        calls.map((call) => call.id),
      );
      const blocked = new Map(answers.filter((a) => a.reason).map((a) => [a.call_id, a.reason as string]));
      setReasons(blocked);
      if (blocked.size === 0) await (needsMaterials ? setStep("materials") : toReview());
    } catch (e) {
      const message = (e as { message?: unknown } | null)?.message;
      setError(message === "not_owner" ? reasonText("not_owner") : t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  async function pick(which: "synopsis" | "sample") {
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (picked.canceled) return;
    setPicking(which);
    setError(null);
    try {
      const file = { name: picked.assets[0].name, path: await uploadMaterial(picked.assets[0]) };
      (which === "synopsis" ? setSynopsis : setSample)(file);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "invalid_pdf"
          ? t("manuscripts.invalidPdf")
          : code === "too_large"
            ? t("manuscripts.tooLarge")
            : t("submit.materialUploadUnknown"),
      );
    } finally {
      setPicking(null);
    }
  }

  async function toReview() {
    const missing =
      (needs.synopsis && !synopsis) ||
      (needs.sample && !sample) ||
      (needs.intro && !intro.trim()) ||
      calls.some((call) => call.req_genre && !genreFor[call.id]);
    if (missing) return setError(t("errors.requiredFields"));
    setError(null);
    setBusy(true);
    try {
      setContact(await getContact());
      setStep("review");
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  // Each call gets only the materials it asks for. Also shown on review, so it never touches the keys.
  const contentFor = (call: OpenCall) => ({
    genreId: genreFor[call.id] ?? null,
    materials: {
      ...(call.req_synopsis && synopsis ? { synopsis: synopsis.path } : {}),
      ...(call.req_sample && sample ? { sample: sample.path } : {}),
      ...(call.req_author_intro ? { author_intro: intro.trim() } : {}),
    },
  });
  // Only when sending: the key is created then and kept for every retry.
  const itemFor = (call: OpenCall): SubmitItem => ({
    callId: call.id,
    versionId: versionId!,
    ...contentFor(call),
    idempotencyKey: keyFor(call.id),
    rightsDeclared: rights,
    contactConsent,
  });

  // In the order they appear on the review step.
  const missingForSend = !rules
    ? t("submit.missingRules")
    : !contact?.phone
      ? t("submit.phoneMissing")
      : !contactConsent
        ? t("submit.missingContact")
        : !rights
          ? t("submit.missingRights")
          : null;

  async function send(toSend: SubmitItem[]) {
    if (sending.current) return;
    // Taken from the first tap, so a second tap during the fingerprint prompt sends nothing.
    sending.current = true;
    setBusy(true);
    try {
      if ((await confirmPrivateAction()) === "cancelled") return;
      const results = await submitBatch(supabase, toSend);
      // Keep earlier outcomes for calls not sent this time.
      setOutcomes((earlier) => [
        ...earlier.filter((outcome) => !results.some((result) => result.callId === outcome.callId)),
        ...results,
      ]);
      setStep("result");
    } catch {
      setError(t("errors.generic"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function startSend() {
    const frozen = calls.map(itemFor);
    setItems(frozen);
    return send(frozen);
  }

  const outcomeFor = (callId: string) => outcomes.find((outcome) => outcome.callId === callId);
  const allSent = items.length > 0 && items.every((item) => outcomeFor(item.callId)?.status === "sent");
  const versions = (works ?? []).filter((work) => !workScope || work.id === workScope).flatMap((work) =>
    work.versions.map((version, index) => ({ work, version, number: work.versions.length - index })),
  );
  const selectedVersion = (works ?? []).flatMap((work) => work.versions.map((version, index) => ({ work, version, number: work.versions.length - index }))).find((item) => item.version.id === versionId);
  const sendLabel = t("submit.sendTo", { count: calls.length });

  // Shown next to the pinned action, so a tap that cannot go on always explains itself on screen.
  const notices = (
    <>
      {calls
        .filter((call) => reasons.has(call.id))
        .map((call) => (
          <ErrorText key={call.id}>
            {call.title}: {reasonText(reasons.get(call.id)!)}
          </ErrorText>
        ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </>
  );

  const footer =
    step === "version" ? (versions.length > 0 ? <Button label={t("common.continue")} disabled={!versionId} onPress={() => { if (versionId) chooseVersion(versionId); }} /> : null) : step === "calls" ? (
      <>
        {notices}
        <Text style={styles.muted}>{t("submit.selectedCount", { count: selected.size })}</Text>
        <Button label={t("common.continue")} busy={busy} onPress={toMaterials} />
      </>
    ) : step === "materials" ? (
      <>
        {notices}
        <Button label={t("common.continue")} busy={busy || picking !== null} onPress={toReview} />
      </>
    ) : step === "review" ? (
      missingForSend ? (
        <BlockedSend reason={missingForSend} label={sendLabel} />
      ) : (
        <>
          {notices}
          <Button label={sendLabel} busy={busy} onPress={startSend} />
        </>
      )
    ) : (
      <Button label={t("submit.backToManuscripts")} onPress={() => router.replace("/manuscripts")} />
    );

  return (
    // The materials step has a text field; a pinned footer would sit over the keyboard.
    <Screen footer={footer} pinFooter={step !== "materials"}>
      {!choosing || works !== null ? <StepHeader
        title={t(TITLE_KEYS[step])}
        backLabel={t("common.back")}
        onBack={back ? () => setStep(back) : null}
        current={steps.indexOf(step) + 1}
        total={steps.length}
        stepLabel={t("submit.step", { current: steps.indexOf(step) + 1, total: steps.length })}
      /> : null}

      {step === "version" ? (
        works === null ? null : versions.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.body}>{t("submit.noManuscripts")}</Text>
            <Button label={t("submit.toManuscripts")} onPress={() => router.replace("/manuscripts")} />
          </View>
        ) : (
          <View>
            <Text style={[styles.body, styles.intro]}>{t("submit.versionIntro")}</Text>
            {(works ?? []).filter((work) => (!workScope || work.id === workScope) && work.versions.length > 0).map((work) => (
              <VersionTree key={work.id} work={work} mode="radio" selectedId={versionId} onSelect={(version) => setVersionId(version.id)} />
            ))}
          </View>
        )
      ) : null}

      {step === "calls" ? (
        <>
          {selectedVersion ? <View style={styles.section}><Text style={styles.muted}>{t("submit.sendingVersion", { number: selectedVersion.number, date: date(selectedVersion.version.uploaded_at), label: selectedVersion.version.label ? ` · „${selectedVersion.version.label}”` : "" })}</Text>{selectedVersion.work.versions.length > 1 ? <Button label={t("submit.changeVersion")} variant="link" onPress={() => { setWorkScope(selectedVersion.work.id); setStep("version"); }} /> : null}</View> : null}
          {callClosed ? <Banner text={t("submit.callClosed")} /> : null}
          <Catalogue
            initialTab="calls"
            selectable={{
              selected,
              onToggle: (call) => {
                setReasons(new Map());
                setSelected((current) => toggleCall(current, call));
              },
            }}
          />
        </>
      ) : null}

      {step === "materials" ? (
        <View style={styles.sections}>
          <Text style={styles.muted}>{t("submit.materialsIntro")}</Text>
          {needs.synopsis || needs.sample ? (
            <View>
              {needs.synopsis ? (
                <PickerRow
                  label={t("submit.synopsisPdf")}
                  a11yLabel={t("submit.chooseSynopsis")}
                  value={synopsis?.name ?? null}
                  placeholder={t("submit.choose")}
                  busy={picking === "synopsis"}
                  onPress={() => pick("synopsis")}
                />
              ) : null}
              {needs.sample ? (
                <PickerRow
                  label={t("submit.samplePdf")}
                  a11yLabel={t("submit.chooseSample")}
                  value={sample?.name ?? null}
                  placeholder={t("submit.choose")}
                  busy={picking === "sample"}
                  onPress={() => pick("sample")}
                />
              ) : null}
            </View>
          ) : null}
          {needs.intro ? (
            <TextField
              label={t("publisher.reqAuthorIntro")}
              value={intro}
              onChangeText={setIntro}
              maxLength={5000}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : null}
          {calls
            .filter((call) => call.req_genre)
            .map((call) => (
              <View key={call.id} accessibilityRole="radiogroup">
                <Text style={styles.label}>{t("submit.genreFor", { call: call.title })}</Text>
                {genres
                  .filter((genre) => call.genre_ids.length === 0 || call.genre_ids.includes(genre.id))
                  .map((genre) => (
                    <ChoiceRow
                      key={genre.id}
                      label={genreName(genre)}
                      checked={genreFor[call.id] === genre.id}
                      onPress={() => setGenreFor((current) => ({ ...current, [call.id]: genre.id }))}
                    />
                  ))}
              </View>
            ))}
        </View>
      ) : null}

      {step === "review" ? (
        <View style={styles.sections}>
          <View>
            {calls.map((call) => {
              const item = contentFor(call);
              return (
                <View key={call.id} style={styles.entry}>
                  <Text style={styles.title}>{call.title}</Text>
                  <Text style={styles.subtitle}>{call.publisher_name}</Text>
                  {/* What this publication receives: the version always, the rest only if it asks. */}
                  <View style={styles.receives}>
                    <Text style={styles.meta}>{t("publisher.reqFullManuscript")}</Text>
                    {item.materials.synopsis && synopsis ? (
                      <Text style={styles.meta}>
                        {t("submit.materialFile", { material: t("publisher.reqSynopsis"), name: synopsis.name })}
                      </Text>
                    ) : null}
                    {item.materials.sample && sample ? (
                      <Text style={styles.meta}>
                        {t("submit.materialFile", { material: t("publisher.reqSample"), name: sample.name })}
                      </Text>
                    ) : null}
                    {item.materials.author_intro !== undefined ? (
                      <Text style={styles.meta}>{t("publisher.reqAuthorIntro")}</Text>
                    ) : null}
                    {item.genreId ? (
                      <Text style={styles.meta}>
                        {t("submit.materialFile", { material: t("publisher.reqGenre"), name: genreLabel(item.genreId) })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.muted}>
                    {t(SHARING_KEYS[call.sharing_policy], { publisher: call.publisher_name })}
                  </Text>
                </View>
              );
            })}
            <Button label={t("submit.previewPdf")} variant="link" onPress={() => router.push({ pathname: "/reader/[versionId]", params: { versionId, mode: "pages" } })} />
          </View>
          <Checkbox label={t("submit.acceptRules")} checked={rules} onChange={setRules} />
          <View style={styles.section}>
            <Text style={styles.heading}>{t("submit.contactTitle")}</Text>
            <View style={styles.panel}>
              <Text style={styles.body}>
                {contact?.phone
                  ? t("submit.contactBody", { email: contact.contact_email, phone: contact.phone })
                  : contact?.contact_email}
              </Text>
            </View>
            <Checkbox label={t("submit.agreeContact")} checked={contactConsent} onChange={setContactConsent} />
          </View>
          <Checkbox label={t("submit.declaration")} checked={rights} onChange={setRights} />
        </View>
      ) : null}

      {step === "result" ? (
        <View>
          {allSent ? (
            <View style={styles.confirmation}>
              <Text style={styles.confirmationTitle}>{t("submit.allSent", { count: items.length })}</Text>
              <Text style={styles.muted}>{t("submit.courage")}</Text>
            </View>
          ) : null}
          {items.map((item) => {
            const call = selected.get(item.callId)!;
            const outcome = outcomeFor(item.callId);
            return (
              <View key={item.callId} style={styles.entry}>
                <View style={styles.resultTop}>
                  <View style={styles.flex}>
                    <Text style={styles.title}>{call.title}</Text>
                    <Text style={styles.subtitle}>{call.publisher_name}</Text>
                  </View>
                  {outcome?.status === "sent" ? (
                    <StatusChip label={t("submit.statusSent")} tone="sent" />
                  ) : outcome?.status === "failed" ? (
                    <StatusChip label={t("submit.didntSend")} tone="failed" />
                  ) : (
                    <StatusChip label={t("submit.statusUnknown")} tone="unknown" />
                  )}
                </View>
                {outcome?.status === "sent" ? null : (
                  <>
                    <Text style={styles.muted}>
                      {outcome?.status === "failed" ? reasonText(outcome.reason) : t("submit.unknownResult")}
                    </Text>
                    {outcome?.status === "failed" && !RETRYABLE.has(outcome.reason) ? null : (
                      <Button
                        label={t("submit.retryFor", { publisher: call.publisher_name })}
                        variant="secondary"
                        busy={busy}
                        onPress={() => send(retryItems([item], outcomes))}
                      />
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {step === "version" || step === "result" ? notices : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sections: { gap: space.lg },
  section: { gap: space.md },
  intro: { marginBottom: space.sm },
  entry: { gap: space.xs, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  receives: { gap: 2, paddingVertical: space.xs },
  resultTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginBottom: space.xs },
  panel: { padding: space.md, borderRadius: radius.field, backgroundColor: colors.field },
  confirmation: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  confirmationTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, color: colors.ink, textAlign: "center" },
  title: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 27, color: colors.ink },
  heading: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20, color: colors.ink },
  label: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.ink, marginBottom: space.xs },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.ink },
  muted: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
});
