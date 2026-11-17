import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./icon";
import { colors, fonts, space } from "./theme";

type Props = { label: string; checked: boolean; onChange(next: boolean): void; disabled?: boolean };

export function Checkbox({ label, checked, onChange, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? <Icon name="check" color={colors.onBurgundy} size={18} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.field,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  label: { flex: 1, fontFamily: fonts.ui, fontSize: 17, lineHeight: 24, color: colors.ink },
});
