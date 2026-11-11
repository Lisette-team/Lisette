import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

// Placeholder for S-10/S-11 until profiles exist: the way to the writer role (S-05) and to Settings.
export default function Profile() {
  const { t } = useTranslation();
  const author = useSession()?.authorEnabled ?? false;

  return (
    // Writers open Profile from the header, so they get a way back.
    <Screen title={t("nav.profile")} backLabel={author ? t("common.back") : undefined}>
      <Text style={styles.muted}>{t("common.comingSoon")}</Text>
      {author ? null : (
        <View style={styles.section}>
          <Text style={styles.body}>{t("roles.writerBody")}</Text>
          <Button label={t("roles.writerTitle")} onPress={() => router.push("/role")} />
        </View>
      )}
      <Button label={t("nav.settings")} variant="secondary" onPress={() => router.push("/settings")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.inkMuted },
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.ink },
  section: { gap: space.md, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.line },
});
