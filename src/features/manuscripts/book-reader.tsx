import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { getItem, setItem } from "@/lib/storage";
import { Icon } from "@/ui/icon";
import { ErrorText, TopBar } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

import type { BookMode, BookOptions } from "./book-html";
import { PdfReader } from "./pdf-reader";
import type { ReaderMessage } from "./reader-html";

const MODE_KEY = "reader.mode";
const SIZE_KEY = "reader.fontSize";

type Props = {
  title?: string | null;
  versionId?: string;
  submissionId?: string;
  materialId?: string;
  shareVersionId?: string;
  // "pages" always opens on the original pages (a publication reading a submission, a preview of
  // what is sent); "text" opens on the reader's last choice, Text the first time.
  defaultMode: BookMode;
  onClose(): void;
  // When set, the parent handles a failed load; otherwise the reader says so in place.
  onError?(status: number): void;
  failedText?: string;
};

// The page-turning reader with its top bar: back arrow on the left, the work's title in the middle.
// The page itself (book-html) has the mode switch, text size and progress bar.
export function BookReader({ title, versionId = "", submissionId, materialId, shareVersionId, defaultMode, onClose, onError, failedText }: Props) {
  const { t } = useTranslation();
  const [book, setBook] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Built once per opening: changing it would reload the PDF, so later choices only go to storage.
  useEffect(() => {
    let active = true;
    void Promise.all([
      getItem(MODE_KEY).catch(() => null),
      getItem(SIZE_KEY).catch(() => null),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([mode, size, reduceMotion]) => {
      if (!active) return;
      const options: BookOptions = {
        mode: defaultMode === "pages" ? "pages" : mode === "pages" ? "pages" : "text",
        fontSize: Number(size) || 18,
        reduceMotion,
        labels: {
          pages: t("reader.pages"),
          text: t("reader.text"),
          smaller: t("reader.smaller"),
          bigger: t("reader.bigger"),
          progress: t("reader.progress"),
          pageOf: t("reader.pageOf", { page: "{page}", total: "{total}" }),
          textProgress: t("reader.textProgress", { percent: "{percent}", page: "{page}" }),
          preparing: t("reader.preparing", { percent: "{percent}" }),
          noText: t("reader.noText"),
        },
      };
      setBook(JSON.stringify(options));
    });
    return () => {
      active = false;
    };
  }, [defaultMode, t]);

  const onMessage = useCallback(
    (message: ReaderMessage) => {
      if (message.type === "prefs") {
        void setItem(MODE_KEY, message.mode).catch(() => undefined);
        void setItem(SIZE_KEY, String(message.fontSize)).catch(() => undefined);
      } else if (message.type === "error") {
        if (onError) onError(message.status);
        else setFailed(true);
      }
    },
    [onError],
  );

  return (
    <View style={styles.root}>
      <TopBar>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} onPress={onClose}>
          <Icon name="arrowLeft" color={colors.ink} size={28} />
        </Pressable>
        {/* The title sits in the middle of the bar; the empty box balances the arrow. */}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title ?? ""}
        </Text>
        <View style={styles.side} />
      </TopBar>
      {failed ? (
        <View style={styles.failed}>
          <ErrorText>{failedText ?? t("reader.failed")}</ErrorText>
        </View>
      ) : book ? (
        <PdfReader versionId={versionId} submissionId={submissionId} materialId={materialId} shareVersionId={shareVersionId} book={book} onMessage={onMessage} />
      ) : (
        <ActivityIndicator color={colors.burgundy} style={styles.loading} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  side: { width: 28 },
  failed: { padding: space.lg },
  loading: { marginTop: space.xl },
});
