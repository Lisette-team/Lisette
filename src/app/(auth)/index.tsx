import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSessionContext } from "@/features/account/session";
import { LOCALES } from "@/i18n";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

// Interim mark cropped from the approved artwork (brand/assets/VariantaLogo1.png);
// vector production files are still pending.
const mark = require("../../../assets/brand/lisette-mark.png");

const LANGUAGE_LABELS = { ro: "Română", en: "English" } as const;

export default function Start() {
  const { t } = useTranslation();
  const { state, chooseLocale } = useSessionContext();
  const languageChosen = state.status === "signedOut" && state.locale !== null;

  return (
    <Screen
      footer={
        languageChosen ? (
          <>
            <Button label={t("auth.createAccount")} onPress={() => router.push("/create-account")} />
            <Button
              label={t("auth.haveAccount")}
              variant="secondary"
              onPress={() => router.push("/sign-in")}
            />
          </>
        ) : (
          <>
            <Text style={styles.prompt}>{t("language.choose")}</Text>
            {LOCALES.map((locale) => (
              <Button
                key={locale}
                label={LANGUAGE_LABELS[locale]}
                variant="secondary"
                onPress={() => chooseLocale(locale)}
              />
            ))}
            {/* Shown in Romanian until a language is chosen; the prompt above is bilingual. */}
            <Text style={styles.note}>{t("language.changeLater")}</Text>
          </>
        )
      }
    >
      <View style={styles.hero}>
        <Image source={mark} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={styles.wordmark}>
          Lisette
        </Text>
        {languageChosen ? <Text style={styles.tagline}>{t("brand.tagline")}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  mark: { width: 150, height: 220 },
  wordmark: { fontFamily: fonts.heading, fontSize: 44, color: colors.ink },
  tagline: {
    fontFamily: fonts.headingItalic,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
    textAlign: "center",
  },
  prompt: { fontFamily: fonts.ui, fontSize: 17, color: colors.ink, textAlign: "center" },
  note: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
});
