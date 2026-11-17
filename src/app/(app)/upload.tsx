import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/account/session";
import { createWork, listWorks, uploadVersion } from "@/features/manuscripts/api";
import { confirmPrivateAction } from "@/features/manuscripts/device-auth";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { Icon } from "@/ui/icon";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";

export default function Upload() {
  const { t } = useTranslation();
  const { workId } = useLocalSearchParams<{ workId?: string }>();
  const session = useSession();
  const [workTitle, setWorkTitle] = useState("");
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (workId && session?.userId) void listWorks(session.userId).then((items) => setWorkTitle(items.find((w) => w.id === workId)?.title ?? "")).catch(() => setError(t("errors.network"))); }, [workId, session?.userId, t]);
  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (!result.canceled) { setFile(result.assets[0]); setError(""); setUncertain(false); }
  }
  async function upload() {
    if (!file || (!workId && !title.trim())) return;
    if ((await confirmPrivateAction()) === "cancelled") return;
    setBusy(true); setError(""); setUncertain(false);
    try {
      const id = workId ?? await createWork(title.trim());
      await uploadVersion(id, file, label.trim());
      router.replace(`/manuscript/${id}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setUncertain(code !== "invalid_pdf" && code !== "too_large");
      setError(code === "invalid_pdf" ? t("manuscripts.invalidPdf") : code === "too_large" ? t("manuscripts.tooLarge") : t("errors.uploadUnknown"));
    } finally { setBusy(false); }
  }
  return <Screen title={workId ? t("manuscripts.newVersionTitle", { title: workTitle }) : t("manuscripts.newManuscript")} backLabel={t("common.back")} footer={<><Button label={t("manuscripts.confirmUpload")} onPress={upload} busy={busy} disabled={!file || (!workId && !title.trim())} /><Text style={styles.note}>{t("manuscripts.deviceAuthHint")}</Text></>} pinFooter>
    <Banner text={t("manuscripts.privacyBanner")} />
    <View style={[styles.card, !file && styles.emptyCard]}><Icon name="manuscript" color={colors.burgundy} />{file ? <><Text numberOfLines={1} style={styles.file}>{file.name}</Text><Text style={styles.note}>{file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "PDF"}</Text></> : null}<Button label={file ? t("manuscripts.changeFile") : t("manuscripts.choosePdf")} variant="link" onPress={pick} /></View>
    {error ? uncertain ? <Banner text={error} /> : <ErrorText>{error}</ErrorText> : null}
    {!workId ? <TextField label={t("manuscripts.workTitle")} value={title} onChangeText={setTitle} maxLength={200} /> : null}
    <TextField label={t("manuscripts.versionNote")} value={label} onChangeText={setLabel} maxLength={80} />
    <Text style={styles.note}>{t("manuscripts.hashRecord")}</Text>
  </Screen>;
}
const styles = StyleSheet.create({ card: { padding: space.md, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.card, backgroundColor: colors.surface }, emptyCard: { borderStyle: "dashed" }, file: { fontFamily: fonts.uiSemiBold, color: colors.ink }, note: { color: colors.inkMuted, fontFamily: fonts.ui, lineHeight: 21 } });
