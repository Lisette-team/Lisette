import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/button";
import { colors, fonts, space } from "@/ui/theme";
import { ActionMenu } from "./action-menu";
import type { Work } from "./api";
import { WorkCover } from "./work-cover";

export function sendHref(work: Work): string { return work.main_version_id ? `/submit/${work.main_version_id}` : `/submit/choose?workId=${work.id}`; }
export function ManuscriptCard({ work, submissionCount, onStar, onRename, onDelete }: { work: Work; submissionCount: number; onStar(): void; onRename(): void; onDelete(): void }) {
  const { t, i18n } = useTranslation();
  const sent = work.versions.some((version) => version.sent);
  const latest = work.versions[0];
  return <View style={styles.card}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={work.title} onPress={() => router.push(`/manuscript/${work.id}`)} style={styles.main}>
        <WorkCover title={work.title} />
        <View style={styles.content}>
          <Text style={styles.title}>{work.title}</Text>
          <Text style={styles.muted}>{t("manuscripts.versionCount", { count: work.versions.length })} · {submissionCount ? t("manuscripts.sentCount", { count: submissionCount }) : t("manuscripts.notSubmitted")}</Text>
          {latest ? <Text style={styles.muted}>{new Date(latest.uploaded_at).toLocaleDateString(i18n.language)}</Text> : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(work.is_starred ? "manuscripts.removeFavorite" : "manuscripts.addFavorite")} onPress={onStar} style={styles.starButton}><Text style={styles.star}>{work.is_starred ? "★" : "☆"}</Text></Pressable>
      <ActionMenu items={[{ label: t("manuscripts.uploadNewVersion"), onPress: () => router.push(`/upload?workId=${work.id}`) }, { label: t("manuscripts.rename"), onPress: onRename }, { label: t("manuscripts.delete"), destructive: true, disabled: sent, note: sent ? t("manuscripts.deleteDisabled") : undefined, onPress: onDelete }]} />
    </View>
    <View style={styles.action}><Button label={t("manuscripts.send")} size="compact" variant="link" onPress={() => router.push(sendHref(work) as never)} /></View>
  </View>;
}
const styles = StyleSheet.create({
  card: { paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.lineSoft }, row: { flexDirection: "row", alignItems: "center" },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md }, content: { flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink }, muted: { fontFamily: fonts.ui, color: colors.inkMuted, fontSize: 14 },
  starButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, star: { fontSize: 25, color: colors.gold }, action: { paddingLeft: 50 + space.md },
});
