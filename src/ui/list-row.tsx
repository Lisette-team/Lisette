import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type AccessibilityRole, type AccessibilityState } from "react-native";

import { Icon } from "./icon";
import { colors, fonts, space } from "./theme";

type Props = {
  title: string;
  subtitle?: string;
  // Body text, cut to two lines.
  body?: string;
  meta?: string;
  onPress?: () => void;
  // A burgundy bar on the left, as for a selected recipient in the v6 screens.
  selected?: boolean;
  // Greyed out, as for a publication that is not taking manuscripts.
  muted?: boolean;
  // Shown at the right instead of the chevron (for example a tick).
  right?: ReactNode;
  // For a row that is itself a choice, such as a selectable call: role "checkbox" and its checked state.
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
};

// One entry of a list, separated by a fine line, in the style of the v6 catalogue and profile screens.
export function ListRow({ title, subtitle, body, meta, onPress, selected, muted, right, ...a11y }: Props) {
  const content = (
    <>
      {selected ? <View style={styles.bar} /> : null}
      <View style={styles.text}>
        <Text style={[styles.title, muted && styles.mutedText]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, muted && styles.mutedText]}>{subtitle}</Text> : null}
        {body ? (
          <Text style={[styles.body, muted && styles.mutedText]} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
        {meta ? <Text style={[styles.meta, muted && styles.mutedText]}>{meta}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" color={colors.inkMuted} size={20} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      {...a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.pressed },
  bar: { alignSelf: "stretch", width: 3, borderRadius: 2, backgroundColor: colors.burgundy },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: colors.ink },
  subtitle: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20, color: colors.ink },
  body: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  meta: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  // inkMuted keeps 4.5:1 on Paper; the line colour would fall below 3:1.
  mutedText: { color: colors.inkMuted },
});
