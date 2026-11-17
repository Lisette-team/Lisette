import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/ui/theme";

export function WorkCover({ title }: { title: string }) {
  return <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.spine} /><View style={styles.border}><Text style={styles.initial}>{title.trim().charAt(0).toLocaleUpperCase()}</Text><View style={styles.rule} /></View>
  </View>;
}
const styles = StyleSheet.create({
  cover: { width: 50, height: 68, padding: 4, borderRadius: 5, backgroundColor: colors.burgundy, overflow: "hidden" },
  spine: { position: "absolute", left: 4, top: 0, bottom: 0, width: 2, backgroundColor: colors.nightBurgundy },
  border: { flex: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: 3, alignItems: "center", justifyContent: "center", gap: 3 },
  initial: { fontFamily: fonts.heading, fontSize: 25, color: colors.paper },
  rule: { width: 13, height: 1, backgroundColor: colors.gold },
});
