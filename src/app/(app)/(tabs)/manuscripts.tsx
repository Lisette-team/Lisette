import * as DocumentPicker from "expo-document-picker";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ProfileButton } from "@/features/account/profile-button";
import { useSession } from "@/features/account/session";
import { createWork, listWorks, uploadVersion, type Work } from "@/features/manuscripts/api";
import { confirmPrivateAction } from "@/features/manuscripts/device-auth";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, space } from "@/ui/theme";

// S-20 and S-22, minimal: the author's works with their versions, upload, and opening the reader.
export default function Manuscripts() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const userId = session?.userId ?? "";
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => listWorks(userId).then(setWorks), [userId]);

  useEffect(() => {
    void load().catch(() => setError(t("errors.network")));
  }, [load, t]);

  // A null workId uploads the first version of a new work named by the title field.
  async function upload(workId: string | null) {
    setError(null);
    if (!workId && !title.trim()) return setError(t("errors.requiredFields"));
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (picked.canceled) return;
    if ((await confirmPrivateAction()) === "cancelled") return;
    setBusy(true);
    try {
      await uploadVersion(workId ?? (await createWork(title.trim())), picked.assets[0], label.trim());
      setTitle("");
      setLabel("");
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "invalid_pdf"
          ? t("manuscripts.invalidPdf")
          : code === "too_large"
            ? t("manuscripts.tooLarge")
            : t("errors.uploadUnknown"),
      );
    } finally {
      setBusy(false);
      await load().catch(() => undefined);
    }
  }

  // Readers add a writer profile from Profile first; the menu hides this tab until then.
  if (session && !session.authorEnabled) return <Redirect href="/profile" />;

  return (
    <Screen title={t("manuscripts.title")} action={<ProfileButton />}>
      <Text style={styles.body}>{t("manuscripts.privacyBanner")}</Text>
      {works.map((work) => (
        <View key={work.id} style={styles.work}>
          <Text style={styles.workTitle}>{work.title}</Text>
          {work.versions.map((version, index) => (
            <View key={version.id} style={styles.version}>
              <Text style={styles.body}>
                {t("manuscripts.versionLine", {
                  number: work.versions.length - index,
                  pages: version.page_count,
                  date: new Date(version.uploaded_at).toLocaleDateString(i18n.language),
                })}
                {version.label ? ` · ${version.label}` : ""}
              </Text>
              <Button label={t("manuscripts.read")} variant="link" onPress={() => router.push(`/reader/${version.id}`)} />
            </View>
          ))}
          <Button label={t("manuscripts.newVersion")} variant="secondary" busy={busy} onPress={() => upload(work.id)} />
        </View>
      ))}
      <View style={styles.work}>
        <TextField label={t("manuscripts.workTitle")} value={title} onChangeText={setTitle} maxLength={200} />
        <TextField label={t("manuscripts.versionNote")} value={label} onChangeText={setLabel} maxLength={80} />
        <Button label={t("manuscripts.upload")} busy={busy} onPress={() => upload(null)} />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Text style={styles.note}>{t("manuscripts.hashRecord")}</Text>
      <Text style={styles.note}>{t("manuscripts.noEditor")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.ink },
  note: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  work: { gap: space.sm, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  workTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  version: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
});
