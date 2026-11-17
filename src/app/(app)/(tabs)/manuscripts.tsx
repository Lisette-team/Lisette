import { Image } from "expo-image";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, Text, View } from "react-native";
import { ProfileButton } from "@/features/account/profile-button";
import { useSession } from "@/features/account/session";
import { deleteWork, listMySubmissions, listWorks, renameWork, setStarred, type MySubmission, type Work } from "@/features/manuscripts/api";
import { ManuscriptCard } from "@/features/manuscripts/manuscript-card";
import { SubmissionsList } from "@/features/manuscripts/submissions-list";
import { Button } from "@/ui/button";
import { Banner } from "@/ui/banner";
import { Dialog } from "@/ui/dialog";
import { ErrorText, Screen } from "@/ui/screen";
import { Segmented } from "@/ui/segmented";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";
export default function Manuscripts() {
 const { t } = useTranslation(); const session = useSession(); const userId = session?.userId ?? "";
 const [works, setWorks] = useState<Work[]>([]); const [submissions, setSubmissions] = useState<MySubmission[]>([]); const [tab, setTab] = useState<"works" | "submissions">("works"); const [deleting, setDeleting] = useState<Work | null>(null); const [renaming, setRenaming] = useState<Work | null>(null); const [name, setName] = useState(""); const [error, setError] = useState("");
 const load = useCallback(async () => { try { const [w, s] = await Promise.all([listWorks(userId), listMySubmissions()]); setWorks(w); setSubmissions(s); setError(""); } catch { setError(t("errors.network")); } }, [userId, t]);
 useFocusEffect(useCallback(() => { if (userId) void load(); }, [load, userId]));
 if (session && !session.authorEnabled) return <Redirect href="/profile" />;
 const ordered = [...works].sort((a, b) => Number(b.is_starred) - Number(a.is_starred) || (b.versions[0]?.uploaded_at ?? "").localeCompare(a.versions[0]?.uploaded_at ?? ""));
 async function act(fn: () => Promise<void>) { try { await fn(); await load(); } catch { setError(t("errors.generic")); } }
 return <Screen title={t("manuscripts.title")} action={<ProfileButton />}><Segmented<"works" | "submissions"> size="compact" value={tab} onChange={setTab} options={[{ value: "works", label: t("manuscripts.myManuscripts") }, { value: "submissions", label: t("manuscripts.submissions") }]} />
 {error ? <ErrorText>{error}</ErrorText> : null}
 {tab === "works" ? <><Button label={t("manuscripts.uploadNew")} size="compact" variant="secondary" onPress={() => router.push("/upload")} /><Banner text={t("manuscripts.privacyBanner")} />{ordered.length ? ordered.map((work) => <ManuscriptCard key={work.id} work={work} submissionCount={submissions.filter((s) => work.versions.some((v) => v.id === s.version_id)).length} onStar={() => void act(() => setStarred(work.id, !work.is_starred))} onRename={() => { setName(work.title); setRenaming(work); }} onDelete={() => setDeleting(work)} />) : <View style={styles.empty}><Image source={require("../../../../assets/illustrations/semn-scrie.svg")} style={styles.image} /><Text style={styles.text}>{t("manuscripts.noManuscripts")}</Text></View>}</> : <SubmissionsList items={submissions} works={works} />}
 <Dialog visible={!!deleting} title={t("manuscripts.confirmDeleteTitle", { title: deleting?.title })} message={t("manuscripts.confirmDeleteBody")} confirmLabel={t("manuscripts.delete")} cancelLabel={t("common.cancel")} onCancel={() => setDeleting(null)} onConfirm={() => { const work = deleting; setDeleting(null); if (work) void act(() => deleteWork(work.id)); }} />
 <Modal transparent visible={!!renaming} onRequestClose={() => setRenaming(null)}><View style={styles.overlay}><View style={styles.modal}><TextField label={t("manuscripts.workTitle")} value={name} onChangeText={setName} maxLength={200} /><Button label={t("manuscripts.save")} disabled={!name.trim()} onPress={() => { const work = renaming; setRenaming(null); if (work) void act(() => renameWork(work.id, name.trim())); }} /><Button label={t("common.cancel")} variant="secondary" onPress={() => setRenaming(null)} /></View></View></Modal>
 </Screen>;
}
const styles = StyleSheet.create({ empty: { alignItems: "center", gap: space.md, padding: space.xl }, image: { width: 150, height: 150 }, text: { fontFamily: fonts.ui, color: colors.inkMuted, textAlign: "center" }, overlay: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: colors.scrim }, modal: { padding: space.lg, borderRadius: radius.card, backgroundColor: colors.paper, gap: space.md } });
