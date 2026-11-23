import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, Text, View } from "react-native";
import { SharingRequests } from "@/features/sharing/requests";
import { useSession } from "@/features/account/session";
import { downloadSubmissionFile } from "@/features/submissions/download";
import { BookReader } from "@/features/manuscripts/book-reader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/ui/icon";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, space } from "@/ui/theme";

type Evaluation = { stood_out: string | null; could_improve: string | null; observations: string | null };
type Detail = { id: string; work_id: string; status: string; version_id: string; version_label: string | null; work_title: string; author_name: string; contact_email: string | null; contact_phone: string | null; publisher_name: string; call_title: string; opened: boolean; accepted_policy: { sharing_policy: string }; history: { status: string; changed_at: string }[]; evaluation: Evaluation | null; materials: { id: string; kind: string; body: string | null; has_file: boolean }[] };
export default function SubmissionDetail() {
 const { id } = useLocalSearchParams<{ id: string }>(); const { t, i18n } = useTranslation(); const session = useSession();
 const [detail, setDetail] = useState<Detail | null>(null); const [error, setError] = useState(""); const [confirm, setConfirm] = useState(false); const [reader, setReader] = useState<string | null>(null); const insets = useSafeAreaInsets();
 const [stood, setStood] = useState(""); const [improve, setImprove] = useState(""); const [notes, setNotes] = useState("");
 const load = useCallback(async () => { const { data, error: err } = await supabase.rpc("submission_detail", { submission_id: id }); if (err || !data) { setError(t("errors.generic")); return; } const d = data as Detail; setDetail(d); setStood(d.evaluation?.stood_out ?? ""); setImprove(d.evaluation?.could_improve ?? ""); setNotes(d.evaluation?.observations ?? ""); }, [id, t]);
 useFocusEffect(useCallback(() => { void load(); }, [load]));
 async function action(name: string, args: object) { const result = await supabase.rpc(name, args); if (result.error) setError(t("errors.generic")); else { setError(""); await load(); } }
 const evaluation = { stood_out: stood, could_improve: improve, observations: notes }; const meaningful = !!(stood + improve + notes).trim();
 const publisher = session?.kind === "publisher"; const active = detail && !["withdrawn", "rejected"].includes(detail.status);
 const targets = detail?.status === "submitted" ? ["in_review", "on_hold", "selected", "rejected"] : detail?.status === "in_review" ? ["on_hold", "selected", "rejected"] : detail?.status === "on_hold" ? ["in_review", "selected", "rejected"] : detail?.status === "selected" ? ["rejected"] : [];
 return <Screen title={detail?.work_title ?? t("nav.submissions")} backLabel={t("common.back")}>
 {error ? <ErrorText>{error}</ErrorText> : null}
 {detail ? <>
 <Text style={styles.title}>{publisher ? detail.author_name : detail.publisher_name} · {detail.call_title}</Text>
 <Text style={styles.text}>{t(`manuscripts.status_${detail.status}`)}</Text>
 {!publisher && detail.opened ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="eye" color={colors.ink} size={16} /><Text style={styles.text}>{t("manuscripts.openedByPublisher")}</Text></View> : null}
 {publisher && !active ? <Text style={styles.text}>{t("publisher.accessEnded")}</Text> : null}
 {detail.history.map((h, index) => <Text key={index} style={styles.text}>{new Date(h.changed_at).toLocaleDateString(i18n.language)} · {t(`manuscripts.status_${h.status}`)}</Text>)}
 {publisher && active ? <>{detail.contact_email ? <Text style={styles.text}>{detail.contact_email}</Text> : null}{detail.contact_phone ? <Text style={styles.text}>{detail.contact_phone}</Text> : null}<Button label={t("publisher.openManuscript")} onPress={() => setReader("manuscript")} />{detail.status === "on_hold" ? <Text style={styles.text}>{t("publisher.downloadOff")}</Text> : <Button label={t("publisher.downloadManuscript")} variant="secondary" onPress={() => void downloadSubmissionFile(detail.version_id, id).catch(() => setError(t("errors.generic")))} />}
 {detail.materials.map((m) => <View key={m.id}><Text style={styles.text}>{m.body ?? m.kind}</Text>{m.has_file ? <><Button label={t("publisher.openMaterial")} variant="secondary" onPress={() => setReader(m.id)} />{detail.status !== "on_hold" ? <Button label={t("publisher.downloadMaterial")} variant="secondary" onPress={() => void downloadSubmissionFile(detail.version_id, id, m.id).catch(() => setError(t("errors.generic")))} /> : null}</> : null}</View>)}</> : null}
 {publisher && detail.status !== "withdrawn" ? <><TextField label={t("publisher.stoodOut")} value={stood} onChangeText={setStood} multiline /><TextField label={t("publisher.couldImprove")} value={improve} onChangeText={setImprove} multiline /><TextField label={t("publisher.observations")} value={notes} onChangeText={setNotes} multiline />
 <Button label={t("publisher.saveEvaluation")} variant="secondary" disabled={!meaningful || (stood + improve + notes).length > 2000} onPress={() => void action("save_submission_evaluation", { submission_id: id, evaluation })} />
 {targets.map((target) => <Button key={target} label={t(`publisher.decision_${target}`)} variant="secondary" disabled={target === "selected" && !meaningful} onPress={() => void action("transition_submission", { submission_id: id, target, evaluation: meaningful ? evaluation : null })} />)}</> : null}
 {!publisher && detail.version_label ? <Text style={styles.text}>{detail.version_label}</Text> : null}
 {!publisher ? <Text style={styles.text}>{detail.accepted_policy.sharing_policy === "author_controlled" ? t("submit.sharingAuthorControlled") : t("submit.sharingApproval", { publisher: detail.publisher_name })}</Text> : null}
 {!publisher && detail.evaluation ? <View><Text style={styles.title}>{t("publisher.saveEvaluation")}</Text>{[detail.evaluation.stood_out, detail.evaluation.could_improve, detail.evaluation.observations].filter(Boolean).map((v, i) => <Text key={i} style={styles.text}>{v}</Text>)}</View> : null}
 {detail.work_id ? <>{(!publisher || active) ? <Button label={publisher ? t("sharing.quoteManuscript") : t("sharing.shareWork")} variant="secondary" onPress={() => router.push({ pathname: "/create", params: { mode: "fragment", workId: detail.work_id, ...(publisher ? { submissionId: id } : {}) } })} /> : null}<SharingRequests workId={detail.work_id} submissionId={id} publisher={publisher} /></> : null}
 {!publisher && active ? <Button label={t("manuscripts.withdraw")} variant="secondary" onPress={() => setConfirm(true)} /> : null}
 </> : null}
 <Dialog visible={confirm} title={t("manuscripts.withdraw")} message={t("manuscripts.withdrawConfirm")} confirmLabel={t("manuscripts.withdraw")} cancelLabel={t("common.cancel")} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void action("withdraw_submission", { submission_id: id }); }} />
 {/* A Modal is its own Android window: pad with the app's insets. A publication sees the original pages first. */}<Modal visible={!!reader} statusBarTranslucent onRequestClose={() => setReader(null)}><View style={[styles.reader, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{reader && detail ? <BookReader title={detail.work_title} versionId={detail.version_id} submissionId={id} materialId={reader === "manuscript" ? undefined : reader} defaultMode="pages" onClose={() => setReader(null)} onError={() => { setReader(null); setError(t("manuscripts.notAvailable")); }} /> : null}</View></Modal>
 </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink }, text: { fontFamily: fonts.ui, color: colors.ink, marginVertical: space.sm }, reader: { flex: 1, backgroundColor: colors.paper } });
