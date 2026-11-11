import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import {
  ImageUploadError,
  MAX_IMAGES,
  MAX_POST_LENGTH,
  accountName,
  createPost,
  prepareImage,
  searchPublicWorks,
  type PreparedImage,
  type WorkOption,
} from "@/features/community/api";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";

// S-51: text and up to four images, with an optional book the poster picks themselves.
export default function Create() {
  const { t } = useTranslation();
  const session = useSession();
  const userId = session?.userId ?? "";
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [picking, setPicking] = useState(pick === "work");
  const [workQuery, setWorkQuery] = useState("");
  const [workOptions, setWorkOptions] = useState<WorkOption[]>([]);
  const [work, setWork] = useState<WorkOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The tab stays mounted, so "A book" on Home opens the picker by changing this parameter.
  const [lastPick, setLastPick] = useState(pick);
  if (pick !== lastPick) {
    setLastPick(pick);
    if (pick === "work") setPicking(true);
  }

  useEffect(() => {
    if (!userId) return;
    let active = true;
    accountName(userId)
      .then((value) => active && setName(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  // Only the answer to the latest query is shown.
  const latestQuery = useRef("");
  function searchWorks(text: string) {
    setWorkQuery(text);
    const query = text.trim();
    latestQuery.current = query;
    if (query.length < 2) return setWorkOptions([]);
    searchPublicWorks(query)
      .then((options) => latestQuery.current === query && setWorkOptions(options))
      .catch(() => latestQuery.current === query && setWorkOptions([]));
  }

  function chooseWork(option: WorkOption | null) {
    setWork(option);
    setPicking(false);
    searchWorks("");
  }

  async function pickImages() {
    setError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });
    if (picked.canceled) return;
    try {
      const prepared = await Promise.all(picked.assets.map(prepareImage));
      setImages((current) => [...current, ...prepared].slice(0, MAX_IMAGES));
    } catch {
      setError(t("community.imagePrepareFailed"));
    }
  }

  async function publish() {
    setError(null);
    if (!body.trim() && images.length === 0) return setError(t("community.postEmpty"));
    setBusy(true);
    try {
      const id = await createPost(userId, { body: body.trim(), images, workId: work?.id ?? null });
      setBody("");
      setImages([]);
      chooseWork(null);
      router.push(`/post/${id}`);
    } catch (e) {
      setError(e instanceof ImageUploadError ? t("community.imageUploadFailed") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={t("community.composerTitle")}
      backLabel={t("common.back")}
      footer={<Button label={t("community.publish")} busy={busy} onPress={publish} />}
    >
      <TextField
        label={t("community.bodyLabel")}
        hint={t("community.publicNote")}
        value={body}
        onChangeText={setBody}
        maxLength={MAX_POST_LENGTH}
        multiline
      />

      <Text accessibilityRole="header" style={styles.section}>
        {t("community.images")}
      </Text>
      <View style={styles.tiles}>
        {images.map((asset) => (
          <Pressable
            key={asset.uri}
            accessibilityRole="button"
            accessibilityLabel={t("community.removeImage")}
            onPress={() => setImages(images.filter((other) => other !== asset))}
          >
            <Image source={{ uri: asset.uri }} style={styles.tile} contentFit="cover" />
          </Pressable>
        ))}
        {images.length < MAX_IMAGES ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("community.addImage")}
            onPress={pickImages}
            style={[styles.tile, styles.addTile]}
          >
            <Icon name="plus" color={colors.ink} size={28} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.note}>{t("community.limitsNote", { images: MAX_IMAGES, chars: MAX_POST_LENGTH })}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("community.linkedBook")}
        accessibilityState={{ expanded: picking }}
        onPress={() => setPicking(!picking)}
        style={styles.linkRow}
      >
        <View style={styles.flex}>
          <Text style={styles.linkTitle}>{t("community.linkedBook")}</Text>
          <Text style={styles.note}>{work ? work.title : t("community.noLinkedBook")}</Text>
        </View>
        <Icon name="chevronRight" color={colors.ink} />
      </Pressable>
      {picking ? (
        <View style={styles.picker}>
          <TextField
            label={t("community.searchWorks")}
            hint={t("community.searchHint")}
            value={workQuery}
            onChangeText={searchWorks}
            autoFocus
          />
          {workOptions.map((option) => (
            <Button key={option.id} label={option.title} variant="link" onPress={() => chooseWork(option)} />
          ))}
          {work ? <Button label={t("community.clearWork")} variant="link" onPress={() => chooseWork(null)} /> : null}
        </View>
      ) : null}
      <View style={styles.divider} />
      <Text style={styles.note}>{t("community.linkHint")}</Text>
      {session?.authorEnabled ? (
        <View style={styles.excerptNote}>
          <Icon name="manuscript" color={colors.inkMuted} size={20} />
          <Text style={[styles.note, styles.flex]}>{t("community.excerptNote")}</Text>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.section}>
        {t("community.preview")}
      </Text>
      <View style={styles.preview}>
        <View style={styles.previewAuthor}>
          <Avatar id={userId} size={36} />
          <View>
            <Text style={styles.previewName}>{name}</Text>
            <Text style={styles.note}>{t("community.time.now")}</Text>
          </View>
        </View>
        {body.trim() ? <Text style={styles.previewBody}>{body.trim()}</Text> : null}
        {images.length ? (
          <View style={styles.tiles}>
            {images.map((asset) => (
              <Image key={asset.uri} source={{ uri: asset.uri }} style={styles.previewImage} contentFit="cover" />
            ))}
          </View>
        ) : null}
        {work ? <Text style={styles.note}>{t("community.linkedTo", { title: work.title })}</Text> : null}
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginTop: space.sm },
  note: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: 88, height: 88, borderRadius: radius.card, backgroundColor: colors.surfaceMuted },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: radius.field,
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, marginTop: space.sm },
  linkTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.ink },
  picker: { gap: space.xs },
  divider: { height: 1, backgroundColor: colors.lineSoft },
  excerptNote: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  preview: { gap: space.sm, padding: space.md, borderRadius: radius.sheet, backgroundColor: colors.surface },
  previewAuthor: { flexDirection: "row", alignItems: "center", gap: space.md },
  previewName: { fontFamily: fonts.ui, fontSize: 16, color: colors.ink },
  previewBody: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink },
  previewImage: { width: 64, height: 64, borderRadius: radius.field, backgroundColor: colors.surfaceMuted },
});
