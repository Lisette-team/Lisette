import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { useSession } from "@/features/account/session";
import { deleteVersion, listWorks, setMainVersion, type Work } from "@/features/manuscripts/api";
import { ActionMenu } from "@/features/manuscripts/action-menu";
import { sendHref } from "@/features/manuscripts/manuscript-card";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { ErrorText, Screen } from "@/ui/screen";
import { colors, fonts } from "@/ui/theme";
import { VersionTree } from "@/features/manuscripts/version-tree";
export default function ManuscriptDetail() {
 const { t } = useTranslation(); const { workId } = useLocalSearchParams<{ workId: string }>(); const session = useSession(); const userId = session?.userId ?? "";
 const [work, setWork] = useState<Work | null>(null); const [deleting, setDeleting] = useState<string | null>(null); const [error, setError] = useState("");
 const load = useCallback(async () => { try { setWork((await listWorks(userId)).find((w) => w.id === workId) ?? null); setError(""); } catch { setError(t("errors.network")); } }, [userId, workId, t]);
 useFocusEffect(useCallback(() => { if (userId) void load(); }, [load, userId]));
 async function act(fn: () => Promise<void>) { try { await fn(); await load(); } catch { setError(t("errors.generic")); } }
 return <Screen title={t("manuscripts.title")} backLabel={t("common.back")} footer={work ? <Button label={t("manuscripts.send")} onPress={() => router.push(sendHref(work) as never)} /> : null} pinFooter>
 {error ? <ErrorText>{error}</ErrorText> : null}
 {work ? <><VersionTree work={work} mode="reader" onSelect={(v) => router.push(`/reader/${v.id}`)} action={(v) => <ActionMenu items={[{ label: t(work.main_version_id === v.id ? "manuscripts.clearMain" : "manuscripts.setMain"), onPress: () => void act(() => setMainVersion(work.id, work.main_version_id === v.id ? null : v.id)) }, { label: t("manuscripts.read"), onPress: () => router.push(`/reader/${v.id}`) }, { label: t("manuscripts.delete"), destructive: true, disabled: v.sent, note: v.sent ? t("manuscripts.deleteDisabled") : undefined, onPress: () => setDeleting(v.id) }]} />} /><Text style={styles.muted}>{t("manuscripts.noEditor")}</Text><Button label={t("manuscripts.uploadNewVersion")} variant="secondary" onPress={() => router.push(`/upload?workId=${work.id}`)} /></> : null}
 <Dialog visible={!!deleting} title={t("manuscripts.versionDeleteTitle")} message={t("manuscripts.versionDeleteBody")} confirmLabel={t("manuscripts.delete")} cancelLabel={t("common.cancel")} onCancel={() => setDeleting(null)} onConfirm={() => { const id = deleting; setDeleting(null); if (id) void act(() => deleteVersion(id)); }} />
 </Screen>;
}
const styles = StyleSheet.create({ muted: { fontFamily: fonts.ui, color: colors.inkMuted } });
