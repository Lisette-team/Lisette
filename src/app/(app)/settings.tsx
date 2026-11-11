import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSessionContext } from "@/features/account/session";
import { LOCALES } from "@/i18n";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

const LANGUAGE_LABELS = { ro: "Română", en: "English" } as const;

export default function Settings() {
  const { t } = useTranslation();
  const { state, chooseLocale, signOut } = useSessionContext();
  const current = state.status === "signedIn" ? state.session.locale : null;

  return (
    <Screen
      title={t("settings.title")}
      backLabel={t("common.back")}
      footer={<Button label={t("auth.signOut")} variant="secondary" onPress={signOut} />}
    >
      <Text style={styles.label}>{t("settings.language")}</Text>
      <View style={styles.options}>
        {LOCALES.map((locale) => (
          <Button
            key={locale}
            label={LANGUAGE_LABELS[locale]}
            variant={locale === current ? "primary" : "secondary"}
            onPress={() => chooseLocale(locale)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.ink },
  options: { gap: space.sm },
});
