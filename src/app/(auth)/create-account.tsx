import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { useSessionContext, type AuthErrorKey } from "@/features/account/session";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts } from "@/ui/theme";

export default function CreateAccount() {
  const { t } = useTranslation();
  const { signUp } = useSessionContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const result = await signUp({ name, email, password });
    setBusy(false);
    setError(result.error);
    if (!result.error) router.replace({ pathname: "/verify-email", params: { email: email.trim() } });
  }

  return (
    <Screen
      title={t("auth.createTitle")}
      backLabel={t("common.back")}
      footer={
        <>
          <Button label={t("auth.createAccount")} onPress={submit} busy={busy} />
          <Button label={t("auth.haveAccount")} variant="link" onPress={() => router.replace("/sign-in")} />
        </>
      }
    >
      <Text style={styles.tagline}>{t("brand.tagline")}</Text>
      <TextField
        label={t("auth.name")}
        placeholder={t("auth.namePlaceholder")}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
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
        hint={t("auth.passwordHint")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      {error ? <ErrorText>{t(error)}</ErrorText> : null}
      <Text style={styles.note}>{t("auth.readerFirst")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { fontFamily: fonts.headingItalic, fontSize: 20, lineHeight: 28, color: colors.inkMuted },
  note: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: colors.inkMuted },
});
