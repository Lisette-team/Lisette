import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/ui/icon";
import { Steps } from "@/ui/steps";
import { colors, fonts, radius, space } from "@/ui/theme";

// Title row of each step (v6 send flow): back arrow, Newsreader title, then the segmented progress.
// The arrow steps back inside the flow; on the first step it leaves the flow.
export function StepHeader(props: {
  title: string;
  backLabel: string;
  onBack: (() => void) | null;
  current: number;
  total: number;
  stepLabel: string;
}) {
  const back = props.onBack ?? (router.canGoBack() ? () => router.back() : null);
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.backLabel}
            onPress={back}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.arrow}>←</Text>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          {props.title}
        </Text>
      </View>
      <Steps current={props.current} total={props.total} label={props.stepLabel} />
    </View>
  );
}

// A material to pick, as a list row: label at the left, the chosen file name (or "Choose") at the right.
export function PickerRow(props: { label: string; a11yLabel: string; value: string | null; placeholder: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.a11yLabel}
      accessibilityState={{ busy: props.busy, disabled: props.busy }}
      disabled={props.busy}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowLabel}>{props.label}</Text>
      {props.busy ? (
        <ActivityIndicator color={colors.burgundy} />
      ) : (
        <Text style={props.value ? styles.rowValue : styles.rowAction} numberOfLines={1}>
          {props.value ?? props.placeholder}
        </Text>
      )}
      <Icon name="chevron" color={colors.inkMuted} size={20} />
    </Pressable>
  );
}

// One of several choices (a genre for a call): a compact row with a check when chosen.
export function ChoiceRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[styles.rowLabel, checked && styles.chosen]}>{label}</Text>
      {checked ? <Icon name="check" color={colors.burgundy} size={20} /> : null}
    </Pressable>
  );
}

// Outcome of one call on the results step: text and icon, never colour alone.
export function StatusChip({ label, tone }: { label: string; tone: "sent" | "failed" | "unknown" }) {
  const icon: IconName = tone === "sent" ? "check" : tone === "failed" ? "close" : "info";
  return (
    <View style={[styles.chip, tone !== "sent" && styles.chipAttention]}>
      <Icon name={icon} color={tone === "sent" ? colors.ink : colors.burgundy} size={16} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// Review footer while something is missing: the missing item named, over a greyed, inert Send.
export function BlockedSend({ reason, label }: { reason: string; label: string }) {
  return (
    <View style={styles.blocked}>
      <Text style={styles.blockedReason}>{reason}</Text>
      <View style={styles.blockedButton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.blockedLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.lg, marginBottom: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  back: { width: 48, height: 48, marginLeft: -space.sm, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  arrow: { fontSize: 28, color: colors.ink },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.pressed },
  rowLabel: { flex: 1, fontFamily: fonts.ui, fontSize: 17, lineHeight: 24, color: colors.ink },
  rowValue: { flexShrink: 1, maxWidth: "50%", fontFamily: fonts.ui, fontSize: 15, color: colors.inkMuted },
  rowAction: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.burgundy },
  chosen: { fontFamily: fonts.uiMedium },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
  },
  chipAttention: { borderColor: colors.burgundy, backgroundColor: "transparent" },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.ink },
  blocked: { gap: space.sm },
  blockedReason: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted, textAlign: "center" },
  blockedButton: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: colors.surfaceMuted,
  },
  blockedLabel: { fontFamily: fonts.uiSemiBold, fontSize: 17, color: colors.inkMuted },
});
