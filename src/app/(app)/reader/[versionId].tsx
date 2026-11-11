import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { confirmPrivateAction } from "@/features/manuscripts/device-auth";
import { PdfReader } from "@/features/manuscripts/pdf-reader";
import type { ReaderMessage } from "@/features/manuscripts/reader-html";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

// S-23 for the owner: unlock with the phone's lock, then read. Signing out unmounts this screen
// (the private layout redirects), which drops the reader and its in-memory copy.
export default function Reader() {
  const { t } = useTranslation();
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(
    () =>
      confirmPrivateAction().then((result) => {
        if (result === "cancelled") return;
        setError(null);
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    void unlock();
  }, [unlock]);

  // Locking the phone or leaving the app closes the reader; reopening asks again.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") setOpen(false);
    });
    return () => subscription.remove();
  }, []);

  const onMessage = useCallback(
    (message: ReaderMessage) => {
      if (message.type !== "error") return;
      setOpen(false);
      setError(message.status === 403 ? t("manuscripts.notAvailable") : t("errors.generic"));
    },
    [t],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {router.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.note}>{t("manuscripts.readOnly")}</Text>
      </View>
      {open ? (
        <PdfReader versionId={versionId} onMessage={onMessage} />
      ) : (
        <View style={styles.locked}>
          {error ? <ErrorText>{error}</ErrorText> : <Text style={styles.hint}>{t("manuscripts.deviceAuthHint")}</Text>}
          <Button label={t("manuscripts.unlock")} onPress={unlock} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  back: { fontSize: 28, color: colors.ink },
  note: { flex: 1, fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  hint: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  locked: { flex: 1, justifyContent: "center", gap: space.md, padding: space.lg },
});
