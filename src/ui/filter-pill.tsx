import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./icon";
import { colors, fonts, radius, space } from "./theme";

type Option<T extends string> = { value: T; label: string };

const MENU_WIDTH = 240;
const GUTTER = 16;

// A compact filter: the pill shows the current choice; pressing it drops a menu just below it, over the page.
export function FilterPill<T extends string>({ label, allLabel, closeLabel, value, options, onChange }: {
  label: string;
  allLabel: string;
  closeLabel: string;
  value: T | null;
  options: Option<T>[];
  onChange(value: T | null): void;
}) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const pill = useRef<ComponentRef<typeof Pressable>>(null);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const current = options.find((option) => option.value === value);
  const pillLabel = current ? `${label}: ${current.label}` : label;
  const close = () => setAnchor(null);
  const open = () => {
    setAnchor({ x: GUTTER, y: insets.top });
    pill.current?.measureInWindow((x, y, _width, height) => setAnchor({ x, y: y + height + space.xs }));
  };
  const choose = (next: T | null) => {
    close();
    onChange(next);
  };
  // Keep the menu on screen when the pill sits near the right edge.
  const left = anchor ? Math.max(GUTTER, Math.min(anchor.x, screen.width - GUTTER - MENU_WIDTH)) : 0;
  const maxHeight = anchor ? Math.max(160, screen.height - anchor.y - insets.bottom - GUTTER) : 0;

  return (
    <>
      <Pressable
        ref={pill}
        accessibilityRole="button"
        accessibilityLabel={pillLabel}
        accessibilityState={{ expanded: !!anchor }}
        hitSlop={4}
        onPress={open}
        style={[styles.pill, current && styles.pillActive]}
      >
        <Text style={[styles.pillText, current && styles.pillTextActive]} numberOfLines={1}>
          {pillLabel}
        </Text>
        <View style={anchor && styles.flipped}>
          <Icon name="chevronDown" color={current ? colors.burgundy : colors.inkMuted} size={18} />
        </View>
      </Pressable>
      {/* A Modal is its own window, so the menu floats over the page and stays tappable on Android. */}
      <Modal visible={!!anchor} transparent statusBarTranslucent animationType="fade" onRequestClose={close}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.menu, { top: anchor?.y ?? 0, left, maxHeight }]}>
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
                  style={[styles.option, checked && styles.optionChecked]}
                >
                  <Text style={[styles.optionText, checked && styles.optionTextChecked]}>{option.label}</Text>
                  {checked ? <Icon name="check" color={colors.burgundy} size={18} /> : null}
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
  flipped: { transform: [{ rotate: "180deg" }] },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    padding: space.xs,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.field,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.sm,
    borderRadius: radius.field,
  },
  optionChecked: { backgroundColor: colors.primarySoft },
  optionText: { flexShrink: 1, fontFamily: fonts.ui, fontSize: 15, color: colors.ink },
  optionTextChecked: { fontFamily: fonts.uiMedium, color: colors.burgundy },
});
