import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { useSessionContext, type AuthErrorKey } from "@/features/account/session";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts } from "@/ui/theme";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useSessionContext();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    setError(result.error);
    // The same confirmation is shown whether or not the account exists.
    if (!result.error) setSentTo(email.trim());
  }

  return (
    <Screen
      title={t("auth.recoverTitle")}
      backLabel={t("common.back")}
      footer={<Button label={t("auth.sendLink")} onPress={submit} busy={busy} />}
    >
      <Text style={styles.body}>{t("auth.recoverBody")}</Text>
      <TextField
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      {error ? <ErrorText>{t(error)}</ErrorText> : null}
      {sentTo ? <Text style={styles.body}>{t("auth.recoverySent", { email: sentTo })}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.inkMuted },
});
