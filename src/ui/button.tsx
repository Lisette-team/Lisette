import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, radius, space } from "./theme";

type Variant = "primary" | "secondary" | "link";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  busy?: boolean;
  disabled?: boolean;
  size?: "default" | "compact";
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", busy = false, disabled = false, size = "default", style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], size === "compact" && styles.compact, (pressed || disabled) && styles.pressed, style]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.onBurgundy : colors.burgundy} />
      ) : (
        <Text style={[styles.label, labelStyles[variant], size === "compact" && styles.compactLabel]}>{label}</Text>
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
  compact: { minHeight: 44, alignSelf: "flex-start", paddingHorizontal: space.md },
  compactLabel: { fontSize: 14 },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.uiSemiBold, fontSize: 17, textAlign: "center" },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onBurgundy },
  secondary: { color: colors.ink },
  link: { color: colors.burgundy },
});
