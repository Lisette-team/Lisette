import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "./theme";

type Option<T extends string> = { value: T; label: string };

// Two or three views of the same content (for example Open calls | Publications).
export function Segmented<T extends string>({ options, value, onChange, size = "default" }: {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
  size?: "default" | "compact";
}) {
  return (
    <View accessibilityRole="tablist" style={segmentedStyles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            hitSlop={size === "compact" ? { top: 4, bottom: 4 } : undefined}
            style={[segmentedStyles.segment, size === "compact" && segmentedStyles.compactSegment, selected && segmentedStyles.selected]}
          >
            <Text style={[segmentedStyles.label, size === "compact" && segmentedStyles.compactLabel, selected && segmentedStyles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const segmentedStyles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  compactSegment: { minHeight: 36 },
  compactLabel: { fontSize: 13 },
  selected: { backgroundColor: colors.field },
  label: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.inkMuted },
  labelSelected: { color: colors.burgundy },
});
