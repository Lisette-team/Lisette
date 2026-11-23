import { Image } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { plainText, PostBody } from "@/features/sharing/rich-text";
import { PageShareCover } from "@/features/sharing/share-reader";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { TopBar } from "@/ui/screen";
import { colors, fonts, radius, space } from "@/ui/theme";

import { accountName } from "./api";

// How the post will look in the feed: author (and what they shared), time, formatted text, the
// shared pages, photo, linked book.
export function PostPreview({ userId, body, imageUri, note, reading = false, title, pageStart, pageEnd, shareKind }: { userId: string; body: string; imageUri?: string; note?: string; reading?: boolean; title?: string; pageStart?: number | null; pageEnd?: number | null; shareKind?: "excerpt" | "synopsis" | "beta_pages" }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  useEffect(() => {
    let active = true;
    accountName(userId).then((value) => active && setName(value)).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);
  return (
    <View style={styles.card}>
      <View style={styles.author}>
        <Avatar id={userId} size={36} />
        <View style={styles.authorText}>
          <Text style={styles.name}>
            {name}
            {shareKind && title ? <Text style={styles.action}> {t(`sharing.shared_${shareKind}`)} <Text style={styles.workTitle}>{title}</Text></Text> : null}
          </Text>
          <Text style={styles.note}>{t("community.time.now")}</Text>
        </View>
      </View>
      {plainText(body) ? <PostBody body={body} title={title} pageStart={shareKind === "beta_pages" ? null : pageStart} pageEnd={pageEnd} reading={reading && shareKind !== "beta_pages"} synopsis={shareKind === "synopsis"} /> : null}
      {shareKind === "beta_pages" && title && pageStart && pageEnd ? <PageShareCover title={title} pageStart={pageStart} pageEnd={pageEnd} /> : null}
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

// The composers' last row, the same in Post and Fragment: optional controls on the left, then the
// preview eye and the publish button on the right.
export function PublishBar({ left, previewDisabled, onPreview, label, busy, disabled, onPublish }: { left?: ReactNode; previewDisabled?: boolean; onPreview(): void; label: string; busy?: boolean; disabled?: boolean; onPublish(): void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      {left ?? <View />}
      <View style={styles.send}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("sharing.preview")} disabled={previewDisabled} onPress={onPreview} style={({ pressed }) => [styles.eye, previewDisabled && styles.eyeDisabled, pressed && styles.eyePressed]}>
          <Icon name="eye" color={colors.burgundy} size={20} />
        </Pressable>
        <Button size="compact" style={styles.publish} label={label} busy={busy} disabled={disabled} onPress={onPublish} />
      </View>
    </View>
  );
}

// The preview opens over the composer as its own page, with a back arrow.
export function PreviewModal({ visible, onClose, children }: { visible: boolean; onClose(): void; children: ReactNode }) {
  const { t } = useTranslation();
  // A Modal is its own Android window, where SafeAreaView reads zero insets; pad with the app's insets.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TopBar>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} onPress={onClose}>
            <Icon name="arrowLeft" color={colors.ink} size={28} />
          </Pressable>
          <Text style={styles.modalTitle}>{t("sharing.preview")}</Text>
        </TopBar>
        <ScrollView contentContainerStyle={styles.modalBody}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  send: { flexDirection: "row", alignItems: "center", gap: space.sm },
  eye: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.burgundy, alignItems: "center", justifyContent: "center" },
  eyeDisabled: { opacity: 0.4 },
  eyePressed: { backgroundColor: colors.primarySoft },
  publish: { minWidth: 112 },
  modal: { flex: 1, backgroundColor: colors.paper },
  modalTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  modalBody: { padding: space.lg, gap: space.md },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.sheet, backgroundColor: colors.surface },
  author: { flexDirection: "row", alignItems: "center", gap: space.md },
  authorText: { flex: 1 },
  name: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink },
  action: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMuted },
  workTitle: { fontFamily: fonts.headingItalic, fontSize: 15, color: colors.ink },
  note: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.field, backgroundColor: colors.surfaceMuted },
});
