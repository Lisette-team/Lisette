import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookReader } from "@/features/manuscripts/book-reader";
import { WorkCover } from "@/features/manuscripts/work-cover";
import { FrameOrnaments, FrameRule, framed } from "@/ui/frame-ornaments";
import { Icon } from "@/ui/icon";
import { colors, fonts, space } from "@/ui/theme";

// The pages someone shared, in the page-turning reader (Text mode first), titled with the work.
export function ShareReader({ shareVersionId, title, onClose }: { shareVersionId: string | null; title?: string | null; onClose(): void }) {
  const { t } = useTranslation();
  // A Modal is its own Android window, where SafeAreaView reads zero insets; pad with the app's insets.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!shareVersionId} statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.reader, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {shareVersionId ? <BookReader title={title} shareVersionId={shareVersionId} defaultMode="text" onClose={onClose} failedText={t("sharing.pagesFailed")} /> : null}
      </View>
    </Modal>
  );
}

// A page share in a post: the manuscript's cover with its title, which pages, and a way in.
// Without onPress (the composer's preview) it is only a picture of what will be posted.
export function PageShareCover({ title, pageStart, pageEnd, onPress }: { title: string; pageStart: number; pageEnd: number; onPress?(): void }) {
  const { t } = useTranslation();
  const pages = pageStart === pageEnd ? t("sharing.onePage", { page: pageStart }) : t("sharing.pageRange", { start: pageStart, end: pageEnd });
  const content = (
    <>
      <FrameOrnaments />
      {/* The cover already carries the title, so the side shows only which pages. */}
      <WorkCover title={title} size={88} />
      <View style={styles.text}>
        <Text style={styles.pages}>{pages}</Text>
        <FrameRule />
        {onPress ? (
          <View style={styles.read}>
            <Text style={styles.readLabel}>{t("sharing.readPages")}</Text>
            <Icon name="chevronRight" color={colors.burgundy} size={18} />
          </View>
        ) : null}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.card}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t("sharing.readPages")}: ${title}, ${pages}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reader: { flex: 1, backgroundColor: colors.paper },
  card: { ...framed, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.pressed },
  text: { flex: 1, gap: space.xs },
  pages: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  read: { flexDirection: "row", alignItems: "center", gap: 2 },
  readLabel: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.burgundy },
});
