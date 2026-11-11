import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { tints } from "./theme";

// Default avatars from the v6 designs: the mascot with one of three accessories on a palette tint,
// picked from the account ID so each account keeps the same one. Profile photos come with 03.2.
const VARIANTS = [
  require("../../assets/illustrations/semn-avatar-stea.svg"),
  require("../../assets/illustrations/semn-avatar-fular.svg"),
  require("../../assets/illustrations/semn-avatar-ochelari.svg"),
];

function hash(id: string) {
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

export function Avatar({ id, size = 44 }: { id: string; size?: number }) {
  const value = hash(id);
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tints[value % tints.length] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={VARIANTS[value % VARIANTS.length]}
        style={{ width: size * 1.55, height: size * 1.55, marginTop: -size * 0.06, marginLeft: size * 0.24 }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: "hidden", alignItems: "center" },
});
