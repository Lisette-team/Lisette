import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { useSessionContext, type AuthErrorKey } from "@/features/account/session";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts } from "@/ui/theme";

export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useSessionContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    setError(result.error);
    // On success the auth layout redirects to the signed-in area.
  }

  return (
    <Screen
      title={t("auth.signIn")}
      backLabel={t("common.back")}
      footer={
        <>
          <Button label={t("auth.signIn")} onPress={submit} busy={busy} />
          <Button label={t("auth.noAccount")} variant="link" onPress={() => router.replace("/create-account")} />
        </>
      }
    >
      <Text style={styles.tagline}>{t("brand.tagline")}</Text>
      <TextField
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <TextField
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      {error ? <ErrorText>{t(error)}</ErrorText> : null}
      <Button label={t("auth.forgotPassword")} variant="link" onPress={() => router.push("/forgot-password")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { fontFamily: fonts.headingItalic, fontSize: 20, lineHeight: 28, color: colors.inkMuted },
});
