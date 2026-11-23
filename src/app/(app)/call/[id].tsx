import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import {
  CALL_LANGUAGES,
  callStatus,
  cancelCall,
  dayToIso,
  getCall,
  isoToDay,
  listGenres,
  publishCall,
  saveCall,
  type Call,
  type CallInput,
  type Genre,
} from "@/features/calls/api";
import { StatusBadge } from "@/features/calls/status-badge";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Icon } from "@/ui/icon";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, space } from "@/ui/theme";

type Requirements = CallInput["requirements"];
type Form = {
  title: string;
  description: string;
  startsOn: string;
  alwaysOpen: boolean;
  deadline: string;
  languages: string[];
  genreIds: string[];
  requirements: Requirements;
};

const EMPTY: Form = {
  title: "",
  description: "",
  startsOn: "",
  alwaysOpen: true,
  deadline: "",
  languages: ["ro"],
  genreIds: [],
  requirements: {
    fullManuscript: true,
    synopsis: false,
    sample: false,
    genre: false,
    authorIntro: false,
  },
};

const fromCall = (call: Call): Form => ({
  title: call.title,
  description: call.description ?? "",
  startsOn: isoToDay(call.opens_at),
  alwaysOpen: call.closes_at === null,
  deadline: call.closes_at ? isoToDay(call.closes_at) : "",
  languages: call.accepted_languages,
  genreIds: call.genre_ids,
  requirements: {
    fullManuscript: call.req_full_manuscript,
    synopsis: call.req_synopsis,
    sample: call.req_sample,
    genre: call.req_genre,
    authorIntro: call.req_author_intro,
  },
});

const REQUIREMENT_KEYS: [keyof Requirements, string][] = [
  ["fullManuscript", "publisher.reqFullManuscript"],
  ["synopsis", "publisher.reqSynopsis"],
  ["sample", "publisher.reqSample"],
  ["genre", "publisher.reqGenre"],
  ["authorIntro", "publisher.reqAuthorIntro"],
];

// A titled group of the form, set apart by a fine line as in the v6 screens.
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

// S-43, editor: create or edit a call, then publish or cancel it. `id` is "new" for a new call.
export default function CallEditor() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [savedId, setSavedId] = useState<string | null>(id === "new" ? null : id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [published, setPublished] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  // The dates as last saved, for the status badge (unsaved edits do not change the status).
  const [savedDates, setSavedDates] = useState<Pick<Call, "opens_at" | "closes_at"> | null>(null);
  // An existing call shows no form until it has loaded, so a failed load can never be saved over it.
  const [loaded, setLoaded] = useState(id === "new");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    listGenres()
      .then(setGenres)
      .catch(() => setError(t("errors.network")));
    if (id === "new") return;
    getCall(id)
      .then((call) => {
        setForm(fromCall(call));
        setPublished(call.published_at !== null);
        setCancelled(call.cancelled_at !== null);
        setSavedDates({ opens_at: call.opens_at, closes_at: call.closes_at });
        setLoaded(true);
      })
      .catch(() => setError(t("errors.network")));
  }, [id, t]);

  if (session && session.kind !== "publisher") return <Redirect href="/home" />;

  // Reads the latest form, so quick taps never undo each other.
  const set = (patch: Partial<Form> | ((current: Form) => Partial<Form>)) => {
    setNotice(null);
    setForm((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  };

  // The typed form as the server expects it, or the message explaining what is missing.
  function toInput(): CallInput | string {
    if (!form.title.trim() || form.languages.length === 0) return t("errors.requiredFields");
    const opensAt = form.startsOn.trim() ? dayToIso(form.startsOn) : null;
    const closesAt = form.alwaysOpen ? null : dayToIso(form.deadline, true);
    if ((form.startsOn.trim() && !opensAt) || (!form.alwaysOpen && !closesAt)) return t("publisher.invalidDate");
    if (closesAt && opensAt && closesAt <= opensAt) return t("publisher.deadlineBeforeStart");
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      opensAt,
      closesAt,
      acceptedLanguages: form.languages,
      requirements: form.requirements,
      genreIds: form.genreIds,
    };
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  // Publishing saves first, so what goes live is what is on screen.
  function save(publish = false) {
    const input = toInput();
    if (typeof input === "string") return setError(input);
    return run(async () => {
      const id = await saveCall(savedId, input);
      setSavedId(id);
      // The server starts a call with no start date now.
      setSavedDates({ opens_at: input.opensAt ?? new Date().toISOString(), closes_at: input.closesAt });
      if (publish) {
        await publishCall(id);
        setPublished(true);
      }
      setNotice(t("publisher.saved"));
    });
  }

  const genreName = (genre: Genre) => (i18n.language === "ro" ? genre.name_ro : genre.name_en);
  // callStatus reads only the dates and the published/cancelled stamps.
  const status = callStatus({
    ...(savedDates ?? { opens_at: new Date().toISOString(), closes_at: null }),
    published_at: published ? "published" : null,
    cancelled_at: cancelled ? "cancelled" : null,
  } as Call);

  const footer = (
    <>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {notice ? (
        <View style={styles.notice}>
          <Icon name="check" color={colors.inkMuted} size={18} />
          <Text style={styles.muted}>{notice}</Text>
        </View>
      ) : null}
      {cancelled || !loaded ? null : (
        <>
          <Button
            label={savedId ? t("publisher.saveChanges") : t("publisher.saveDraft")}
            busy={busy}
            onPress={() => save()}
          />
          {savedId && !published ? (
            <Button label={t("publisher.publish")} variant="secondary" busy={busy} onPress={() => save(true)} />
          ) : null}
          {savedId ? (
            <View style={styles.cancel}>
              {confirmCancel ? <Text style={styles.confirm}>{t("publisher.cancelConfirm")}</Text> : null}
              <Button
                label={t("publisher.cancelCall")}
                variant="link"
                busy={busy}
                onPress={() =>
                  confirmCancel
                    ? run(async () => {
                        await cancelCall(savedId);
                        setCancelled(true);
                      })
                    : setConfirmCancel(true)
                }
              />
            </View>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <Screen title={form.title || t("publisher.newCall")} backLabel={t("common.back")} footer={footer}>
      {cancelled ? <Banner text={t("publisher.cancelledReadOnly")} /> : null}
      {loaded && !cancelled ? <StatusBadge status={status} /> : null}
      {loaded ? (
        <View pointerEvents={cancelled ? "none" : "auto"} style={styles.form}>
          <Section title={t("publisher.aboutCall")}>
            <TextField
              label={t("publisher.callTitle")}
              value={form.title}
              onChangeText={(title) => set({ title })}
              maxLength={200}
              editable={!cancelled}
            />
            <TextField
              label={t("publisher.callDescription")}
              value={form.description}
              onChangeText={(description) => set({ description })}
              maxLength={5000}
              multiline
              editable={!cancelled}
            />
          </Section>

          <Section title={t("publisher.dates")}>
            <TextField
              label={t("publisher.startsOn")}
              hint={t("publisher.dateHint")}
              value={form.startsOn}
              onChangeText={(startsOn) => set({ startsOn })}
              // shortcut: a typed date instead of a date picker (none is installed); add one when a picker is chosen.
              editable={!cancelled}
            />
            <Checkbox
              label={t("publisher.alwaysOpen")}
              checked={form.alwaysOpen}
              onChange={(alwaysOpen) => set({ alwaysOpen })}
              disabled={cancelled}
            />
            {form.alwaysOpen ? null : (
              <TextField
                label={t("publisher.deadline")}
                hint={t("publisher.deadlineHint")}
                value={form.deadline}
                onChangeText={(deadline) => set({ deadline })}
                editable={!cancelled}
              />
            )}
          </Section>

          <Section title={t("publisher.languages")}>
            <View>
              {CALL_LANGUAGES.map((code) => (
                <Checkbox
                  key={code}
                  label={t(`language.${code}`)}
                  checked={form.languages.includes(code)}
                  onChange={() => set((current) => ({ languages: toggle(current.languages, code) }))}
                  disabled={cancelled}
                />
              ))}
            </View>
          </Section>

          <Section title={t("publisher.requirements")}>
            <View>
              {REQUIREMENT_KEYS.map(([key, label]) => (
                <Checkbox
                  key={key}
                  label={t(label)}
                  checked={form.requirements[key]}
                  onChange={(checked) =>
                    set((current) => ({ requirements: { ...current.requirements, [key]: checked } }))
                  }
                  disabled={cancelled}
                />
              ))}
            </View>
          </Section>

          <Section title={t("publisher.genres")} hint={t("publisher.genresHint")}>
            <View>
              {genres.map((genre) => (
                <Checkbox
                  key={genre.id}
                  label={genreName(genre)}
                  checked={form.genreIds.includes(genre.id)}
                  onChange={() => set((current) => ({ genreIds: toggle(current.genreIds, genre.id) }))}
                  disabled={cancelled}
                />
              ))}
            </View>
          </Section>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl, marginTop: space.sm },
  section: {
    gap: space.md,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  notice: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cancel: { marginTop: space.sm, gap: space.xs },
  confirm: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    textAlign: "center",
  },
  muted: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
});
