import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";

import { useSession } from "@/features/account/session";
import { Avatar } from "@/ui/avatar";
import { radius } from "@/ui/theme";

// Signed-in users can reach Profile from the main screen headers.
export function ProfileButton() {
  const { t } = useTranslation();
  const session = useSession();
  if (!session) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("nav.profile")}
      hitSlop={4}
      onPress={() => router.push("/profile")}
      style={styles.button}
    >
      <Avatar id={session.userId} size={40} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
