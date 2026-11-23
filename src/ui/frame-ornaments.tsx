import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { colors, radius, space } from "@/ui/theme";

// The logo's four-point star, in Gold with a Paper edge so it reads where it crosses the Burgundy border.
const STAR = `<svg viewBox="0 0 24 24"><path d="M12 1C13 8.5 15.5 11 23 12C15.5 13 13 15.5 12 23C11 15.5 8.5 13 1 12C8.5 11 11 8.5 12 1Z" fill="${colors.gold}" stroke="${colors.paper}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const STAR_SIZE = 18;

// The card border for shared work, after the logo: a Burgundy cover edge (use with FrameOrnaments).
export const framed = { borderWidth: 1.5, borderColor: colors.burgundy, borderRadius: radius.card } as const;

// The logo, reinterpreted around a card: a Gold inset outline and two diagonal stars on the corners.
// Render it as the card's first child.
export function FrameOrnaments() {
  return (
    <>
      <View style={styles.inset} pointerEvents="none" />
      <View testID="frame-star" style={[styles.star, styles.topLeft]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SvgXml xml={STAR} width={STAR_SIZE} height={STAR_SIZE} />
      </View>
      <View testID="frame-star" style={[styles.star, styles.bottomRight]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SvgXml xml={STAR} width={STAR_SIZE} height={STAR_SIZE} />
      </View>
    </>
  );
}

// The logo's double Gold line, under a shared card's heading.
export function FrameRule() {
  return (
    <View testID="frame-rule" style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.ruleThick} />
      <View style={styles.ruleThin} />
    </View>
  );
}

const styles = StyleSheet.create({
  inset: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.card - 5 },
  // Centred on the rounded corner's curve rather than its square point.
  star: { position: "absolute", width: STAR_SIZE, height: STAR_SIZE },
  topLeft: { top: -3, left: -3 },
  bottomRight: { bottom: -3, right: -3 },
  rule: { alignSelf: "stretch", gap: 2, marginVertical: space.sm },
  ruleThick: { height: 2, backgroundColor: colors.gold },
  ruleThin: { height: 1, backgroundColor: colors.gold },
});
