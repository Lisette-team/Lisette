import { StyleSheet, Text, View } from "react-native";

import { Icon } from "./icon";
import { colors, fonts, radius, space } from "./theme";

// A warm note, as "Primește manuscrise acum." on the v6 publication profile.
export function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <Icon name="info" color={colors.burgundy} size={20} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.field,
    backgroundColor: colors.goldSoft,
  },
  text: { flex: 1, fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: colors.ink },
});
