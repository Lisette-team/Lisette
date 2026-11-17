import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDate } from "@/i18n/format";
import { colors, fonts, radius, space } from "@/ui/theme";
import type { Work } from "./api";
import { WorkCover } from "./work-cover";

type Version = Work["versions"][number];
type Props = { work: Work; selectedId?: string | null; onSelect(version: Version): void; mode: "radio" | "reader"; action?: (version: Version) => ReactNode };
export function VersionTree({ work, selectedId, onSelect, mode, action }: Props) {
  const { t, i18n } = useTranslation();
  return <View style={styles.tree}>
    <View style={styles.heading}><WorkCover title={work.title} /><Text style={styles.title}>{work.title}</Text></View>
    {work.versions.map((version, index) => {
      const line = t("submit.versionTreeLine", { number: work.versions.length - index, pages: version.page_count, date: formatDate(version.uploaded_at, i18n.language) });
      const isSelected = selectedId === version.id;
      return <View key={version.id} style={styles.branch}>
        <View style={[styles.trunk, index === work.versions.length - 1 && styles.lastTrunk]} /><View style={styles.tick} />
        <Pressable accessibilityRole={mode === "radio" ? "radio" : "button"} accessibilityLabel={line} accessibilityState={mode === "radio" ? { checked: isSelected } : undefined} onPress={() => onSelect(version)} style={styles.content}>
          {mode === "radio" ? <View style={styles.radio}>{isSelected ? <View style={styles.radioInner} /> : null}</View> : null}
          <View style={styles.text}><Text style={styles.line}>{line}</Text>{version.label ? <Text style={styles.muted}>{version.label}</Text> : null}{work.main_version_id === version.id ? <Text style={styles.badge}>{t("manuscripts.main")}</Text> : null}</View>
        </Pressable>
        {action?.(version)}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  tree: { gap: 0 }, heading: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.sm },
  title: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, flex: 1 },
  branch: { marginLeft: 24, paddingLeft: 20, minHeight: 54, flexDirection: "row", alignItems: "center" },
  trunk: { position: "absolute", left: 0, top: 0, bottom: 0, width: 1, backgroundColor: colors.gold },
  lastTrunk: { bottom: "50%" }, tick: { position: "absolute", left: 0, top: "50%", width: 15, height: 1, backgroundColor: colors.gold },
  content: { flex: 1, minHeight: 54, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  text: { flex: 1, gap: 3 }, line: { fontFamily: fonts.uiMedium, color: colors.ink, fontSize: 15 }, muted: { fontFamily: fonts.ui, color: colors.inkMuted, fontSize: 14 },
  badge: { alignSelf: "flex-start", overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.goldSoft, color: colors.ink, paddingHorizontal: space.sm, paddingVertical: 2, fontFamily: fonts.uiMedium, fontSize: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.burgundy, alignItems: "center", justifyContent: "center" }, radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.burgundy },
});
