import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";

import { useSession } from "@/features/account/session";
import { Icon } from "@/ui/icon";
import { colors, radius } from "@/ui/theme";

// Writers have Manuscripts where Profile was in the menu, so they reach Profile from the screen header.
export function ProfileButton() {
  const { t } = useTranslation();
  if (!useSession()?.authorEnabled) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("nav.profile")}
      hitSlop={4}
      onPress={() => router.push("/profile")}
      style={styles.button}
    >
      <Icon name="user" color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
