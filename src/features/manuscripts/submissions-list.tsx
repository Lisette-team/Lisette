import { router } from "expo-router";
import { Icon } from "@/ui/icon";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MySubmission, Work } from "./api";
import { StatusChip } from "@/features/submissions/submit-steps";
import { colors, fonts, space } from "@/ui/theme";
export function SubmissionsList({ items, works }: { items: MySubmission[]; works: Work[] }) {
 const { t, i18n } = useTranslation();
 if (!items.length) return <View style={styles.empty}><Image source={require("../../../assets/illustrations/semn-ganduri.svg")} style={styles.image} /><Text style={styles.text}>{t("manuscripts.noSubmissions")}</Text></View>;
 return <>{items.map((item) => { const work = works.find((w) => w.versions.some((v) => v.id === item.version_id)); const index = work?.versions.findIndex((v) => v.id === item.version_id) ?? -1; const number = work && index >= 0 ? work.versions.length - index : null; return <Pressable accessibilityRole="button" onPress={() => router.push(`/submission/${item.id}`)} key={item.id} style={styles.row}><Text style={styles.title}>{item.publisher_name} · {t(`submit.kind_${item.publisher_kind}`)}</Text><Text style={styles.text}>{item.call_title}</Text><Text style={styles.text}>{item.work_title}{number ? ` · v${number}` : ""} · {new Date(item.submitted_at).toLocaleDateString(i18n.language)}</Text><StatusChip label={t(`manuscripts.status_${item.status}`)} tone={item.status === "submitted" ? "sent" : "unknown"} />{item.opened ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="eye" color={colors.inkMuted} size={16} /><Text style={styles.text}>{t("manuscripts.openedByPublisher")}</Text></View> : null}</Pressable>; })}</>;
}
const styles = StyleSheet.create({ row: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.lineSoft }, title: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink }, text: { fontFamily: fonts.ui, color: colors.inkMuted }, empty: { alignItems: "center", gap: space.md, padding: space.xl }, image: { width: 140, height: 140 } });
