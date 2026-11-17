import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "./theme";

type Option<T extends string> = { value: T; label: string };

// Two or three views of the same content (for example Open calls | Publications).
export function Segmented<T extends string>({ options, value, onChange }: {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  selected: { backgroundColor: colors.field },
  label: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.inkMuted },
  labelSelected: { color: colors.burgundy },
});
