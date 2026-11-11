import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useSessionContext } from "@/features/account/session";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

const mark = require("../../../assets/brand/lisette-mark.png");

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { resendVerification } = useSessionContext();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [notice, setNotice] = useState<"sent" | "failed" | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    const { error } = await resendVerification(email);
    setBusy(false);
    setNotice(error ? "failed" : "sent");
  }

  return (
    <Screen
      title={t("auth.verifyTitle")}
      backLabel={t("common.back")}
      footer={
        <>
          {Platform.OS === "android" ? (
            <Button label={t("auth.openEmailApp")} onPress={() => Linking.openURL("mailto:")} />
          ) : null}
          <Button label={t("auth.resendLink")} variant="secondary" onPress={resend} busy={busy} />
          <Button label={t("auth.changeEmail")} variant="link" onPress={() => router.replace("/create-account")} />
        </>
      }
    >
      <View style={styles.center}>
        <Image source={mark} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text style={styles.heading}>{t("auth.linkSent")}</Text>
        <Text style={styles.body}>{t("auth.verifyBody", { email })}</Text>
        <Text style={styles.note}>{t("auth.verifyExpiry")}</Text>
        {notice === "sent" ? <Text style={styles.note}>{t("auth.resent")}</Text> : null}
        {notice === "failed" ? <ErrorText>{t("errors.generic")}</ErrorText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  mark: { width: 80, height: 118 },
  heading: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, textAlign: "center" },
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.inkMuted, textAlign: "center" },
  note: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkMuted, textAlign: "center" },
});
