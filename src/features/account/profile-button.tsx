import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";

import { useSession } from "@/features/account/session";
import { Avatar } from "@/ui/avatar";
import { radius } from "@/ui/theme";

// Writers have Manuscripts where Profile was in the menu, so they reach Profile from the screen header.
// `always` shows it to readers too, as in Home's top bar.
export function ProfileButton({ always = false, size = 48 }: { always?: boolean; size?: number }) {
  const { t } = useTranslation();
  const session = useSession();
  if (!session || (!session.authorEnabled && !always)) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("nav.profile")}
      hitSlop={4}
      onPress={() => router.push("/profile")}
      style={[styles.button, { width: size, height: size }]}
    >
      <Avatar id={session.userId} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
