import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { useSessionContext } from "@/features/account/session";
import { activateAuthor } from "@/features/manuscripts/api";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { colors, fonts } from "@/ui/theme";

// S-05, writer part only. The publisher request comes with the publisher screens.
export default function Role() {
  const { t } = useTranslation();
  const { reload } = useSessionContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addWriter() {
    setBusy(true);
    setError(null);
    try {
      await activateAuthor();
      // The menu reads the writer flag from the session, so re-read it before showing Manuscripts.
      await reload();
      router.replace("/manuscripts");
    } catch {
      setError(t("errors.generic"));
      setBusy(false);
    }
  }

  return (
    <Screen title={t("roles.title")} backLabel={t("common.back")}>
      <Text style={styles.heading}>{t("roles.writerTitle")}</Text>
      <Text style={styles.body}>{t("roles.writerBody")}</Text>
      <Text style={styles.note}>{t("roles.manuscriptsPrivate")}</Text>
      <Text style={styles.note}>{t("roles.roleDisclaimer")}</Text>
      <Button label={t("roles.addWriter")} busy={busy} onPress={addWriter} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.ink },
  note: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
});
