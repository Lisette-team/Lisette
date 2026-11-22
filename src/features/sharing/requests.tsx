import { RichHtml } from "@/features/sharing/rich-text";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/account/session";
import { ShareReader } from "./share-reader";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, space } from "@/ui/theme";

type Decision = { submissionId: string; publisher: string; decision: string; status: string };
type Request = { id: string; excerptId: string; workId: string; versionId: string; title?: string; body: string; kind: string; pageStart: number | null; pageEnd: number | null; score: number | null; diff: { word: string; found: boolean }[] | null; authorDecision: string | null; isAuthor: boolean; requestedBy: string; source: string; published: boolean; decisions: Decision[] };
export function SharingRequests({ workId, submissionId, publisher }: { workId: string; submissionId: string; publisher: boolean }) {
 const { t } = useTranslation(); const userId = useSession()?.userId; const [requests, setRequests] = useState<Request[]>([]); const [error, setError] = useState(false); const [reader, setReader] = useState<string | null>(null); const [revision, setRevision] = useState<string | null>(null); const [draft, setDraft] = useState("");
 const load = useCallback(async () => { const { data, error: problem } = await supabase.rpc("sharing_workspace"); if (problem) setError(true); else { setRequests(((data?.requests ?? []) as Request[]).filter((r) => r.workId === workId && (!publisher || r.decisions.some((d) => d.submissionId === submissionId) || r.requestedBy === userId))); setError(false); } }, [workId, submissionId, publisher, userId]);
 useFocusEffect(useCallback(() => { void load(); }, [load]));
 async function act(name: string, args: object) { const { error: problem } = await supabase.rpc(name, args); if (problem) setError(true); else await load(); }
 async function revise(excerptId: string) {
   const first = await supabase.rpc("revise_excerpt", { excerpt_id: excerptId, body: draft });
   if (first.error) { setError(true); return; }
   const second = await supabase.rpc("request_sharing", { text_version_id: first.data });
   if (second.error) { setError(true); return; }
   setRevision(null); await load();
 }
 if (!requests.length && !error) return null;
 return <View style={styles.group}><Text style={styles.heading}>{publisher ? t("sharing.approvalRequests") : t("sharing.requests")}</Text>{error ? <ErrorText>{t("errors.generic")}</ErrorText> : null}
 {requests.map((r) => <View key={r.id} style={styles.card}>
 {r.kind === "beta_pages" ? <Button label={r.body} variant="secondary" onPress={() => setReader(r.versionId)} /> : r.diff?.length ? <Text style={styles.body}>{r.diff.map((part, i) => <Text key={i} style={!part.found ? styles.difference : undefined}>{part.word}{" "}</Text>)}</Text> : <RichHtml value={r.body} reading />}
 {r.score != null && r.score >= 0.9 ? <Text style={styles.meta}>{t("sharing.provenance", { pages: r.pageStart === r.pageEnd ? r.pageStart : `${r.pageStart}–${r.pageEnd}` })}</Text> : null}
 {r.authorDecision ? <Text style={styles.meta}>{t("sharing.author")}: {t(`sharing.${r.authorDecision}`)}</Text> : null}
 {!publisher ? r.decisions.map((d) => <Text key={d.submissionId} style={styles.meta}>{d.decision === "approved" ? "✓ " : ""}{d.publisher} · {t(`sharing.${d.decision}`)}</Text>) : null}
 {publisher ? r.decisions.filter((d) => d.submissionId === submissionId && d.decision === "pending" && !["withdrawn", "rejected"].includes(d.status)).map((d) => <View key={d.submissionId} style={styles.group}><Button label={t("sharing.approve")} onPress={() => void act("decide_sharing", { request_id: r.id, submission_id: d.submissionId, approved: true })} /><Button label={t("sharing.refuse")} variant="secondary" onPress={() => void act("decide_sharing", { request_id: r.id, submission_id: d.submissionId, approved: false })} /></View>) : null}
 {!publisher && r.isAuthor && r.authorDecision === "pending" ? <><Button label={t("sharing.approve")} onPress={() => void act("author_decide_quote", { request_id: r.id, approved: true })} /><Button label={t("sharing.refuse")} variant="secondary" onPress={() => void act("author_decide_quote", { request_id: r.id, approved: false })} /></> : null}
 {r.requestedBy === userId && r.kind !== "beta_pages" ? revision === r.excerptId ? <><TextField label={t("sharing.exactText")} value={draft} onChangeText={setDraft} multiline maxLength={10000} /><Button label={t("sharing.request")} disabled={!draft.trim()} onPress={() => void revise(r.excerptId)} /></> : <Button label={t("sharing.revise")} variant="secondary" onPress={() => { setRevision(r.excerptId); setDraft(r.body); }} /> : null}
 {publisher && r.requestedBy === userId && r.authorDecision === "approved" && !r.published ? <Button label={t("sharing.publish")} onPress={() => void act("publish_excerpt", { text_version_id: r.versionId })} /> : null}
 {!publisher && r.isAuthor && !r.published && !r.authorDecision && r.decisions.every((d) => d.decision === "approved" || ["withdrawn", "rejected"].includes(d.status)) ? <Button label={t("sharing.publish")} onPress={() => void act("publish_excerpt", { text_version_id: r.versionId })} /> : null}
 </View>)}
 <ShareReader shareVersionId={reader} title={requests.find((r) => r.versionId === reader)?.title} onClose={() => setReader(null)} />
 </View>;
}
const styles = StyleSheet.create({ group: { gap: space.sm }, heading: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink }, card: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.lineSoft }, body: { fontFamily: fonts.reading, fontSize: 17, color: colors.ink, lineHeight: 26 }, meta: { fontFamily: fonts.ui, color: colors.inkMuted }, difference: { backgroundColor: colors.gold } });
