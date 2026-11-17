import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./icon";
import { colors, fonts, radius, space } from "./theme";

type Option<T extends string> = { value: T; label: string };

// A compact filter: the pill shows the current choice; pressing it opens a bottom sheet to change it.
export function FilterPill<T extends string>({ label, allLabel, closeLabel, value, options, onChange }: {
  label: string;
  allLabel: string;
  closeLabel: string;
  value: T | null;
  options: Option<T>[];
  onChange(value: T | null): void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((option) => option.value === value);
  const pillLabel = current ? `${label}: ${current.label}` : label;
  const choose = (next: T | null) => {
    setOpen(false);
    onChange(next);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pillLabel}
        hitSlop={4}
        onPress={() => setOpen(true)}
        style={[styles.pill, current && styles.pillActive]}
      >
        <Text style={[styles.pillText, current && styles.pillTextActive]} numberOfLines={1}>
          {pillLabel}
        </Text>
        <Icon name="chevronDown" color={current ? colors.burgundy : colors.inkMuted} size={18} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.scrim} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={12} onPress={() => setOpen(false)}>
              <Icon name="close" color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView>
            {[{ value: null, label: allLabel }, ...options].map((option) => {
              const checked = option.value === value;
              return (
                <Pressable
                  key={option.value ?? "all"}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked }}
                  onPress={() => choose(option.value)}
                  style={styles.option}
                >
                  <Text style={[styles.optionText, checked && styles.optionTextChecked]}>{option.label}</Text>
                  {checked ? <Icon name="check" color={colors.burgundy} size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  pillActive: { backgroundColor: colors.primarySoft },
  pillText: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.inkMuted, maxWidth: 220 },
  pillTextActive: { color: colors.burgundy },
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: "70%",
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.field,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: space.sm },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  optionText: { fontFamily: fonts.ui, fontSize: 16, color: colors.ink },
  optionTextChecked: { fontFamily: fonts.uiMedium, color: colors.burgundy },
});
