import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, radius, space } from "./theme";

type Variant = "primary" | "secondary" | "link";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  busy?: boolean;
};

export function Button({ label, onPress, variant = "primary", busy = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.onBurgundy : colors.burgundy} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  primary: { backgroundColor: colors.burgundy },
  secondary: { borderWidth: 1.5, borderColor: colors.line },
  link: { minHeight: 48 },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.uiSemiBold, fontSize: 17 },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onBurgundy },
  secondary: { color: colors.ink },
  link: { color: colors.burgundy },
});
