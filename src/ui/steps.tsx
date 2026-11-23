import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, space } from "./theme";

// Segmented progress for a multi-step flow, as in the v6 send flow.
export function Steps({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <View style={styles.wrapper} accessible accessibilityLabel={label}>
      <View style={styles.track}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.segment, index < current && styles.done]} />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  track: { flexDirection: "row", gap: space.sm },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  done: { backgroundColor: colors.burgundy },
  label: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMuted },
});
