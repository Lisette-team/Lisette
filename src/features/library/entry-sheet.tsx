import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/screen";
import { colors, fonts, radius, space } from "@/ui/theme";
import { Toggle } from "@/ui/toggle";

import type { LibraryEntry, Shelf } from "./api";
import { BookCover, ShelfChips, authorLine } from "./parts";

type Props = {
  entry: LibraryEntry | null;
  author: boolean;
  // Shown inside the sheet when a change is refused; the switch keeps its saved value.
  error: string | null;
  onClose: () => void;
  onShelf: (entry: LibraryEntry, shelf: Shelf) => void;
  onPublic: (entry: LibraryEntry, value: boolean) => void;
  onInspiration: (entry: LibraryEntry, value: boolean) => void;
  onRemove: (entry: LibraryEntry) => void;
};

// The entry's own controls: shelf, public switch, inspiration (authors) and remove. The book page
// itself comes in 04.2.
export function EntrySheet({ entry, author, error, onClose, onShelf, onPublic, onInspiration, onRemove }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={entry !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("common.close")} />
        {entry ? (
          <View style={styles.sheet}>
            <View style={styles.book}>
              <BookCover title={entry.title} width={52} />
              <View style={styles.bookText}>
                <Text style={styles.title}>{entry.title}</Text>
                {entry.authorNames.length ? <Text style={styles.muted}>{authorLine(entry.authorNames)}</Text> : null}
              </View>
            </View>

            <Text style={styles.heading}>{t("library.shelfHeading")}</Text>
            <ShelfChips value={entry.shelf} onChange={(shelf) => onShelf(entry, shelf)} />

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.label}>{t("library.showOnProfile")}</Text>
                <Text style={styles.muted}>
                  {t(entry.isPublic ? "library.showOnProfileOn" : "library.showOnProfileOff")}
                </Text>
              </View>
              <Toggle
                accessibilityLabel={t("library.showOnProfile")}
                value={entry.isPublic}
                onValueChange={(value) => onPublic(entry, value)}
              />
            </View>

            {author ? (
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.label}>{t("library.inspiration")}</Text>
                  <Text style={styles.muted}>{t("library.inspirationHint")}</Text>
                </View>
                <Toggle
                  accessibilityLabel={t("library.inspiration")}
                  value={entry.isInspiration}
                  onValueChange={(value) => onInspiration(entry, value)}
                />
              </View>
            ) : null}

            {error ? <ErrorText>{error}</ErrorText> : null}

            <View style={styles.actions}>
              <Button label={t("library.remove")} variant="link" onPress={() => onRemove(entry)} />
              <Button label={t("common.close")} variant="secondary" onPress={onClose} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: colors.scrim },
  sheet: {
    width: "100%",
    maxWidth: 520,
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.paper,
  },
  book: { flexDirection: "row", alignItems: "center", gap: space.md },
  bookText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: space.sm },
  muted: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  label: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  switchText: { flex: 1, gap: 2 },
  actions: { gap: space.sm, marginTop: space.sm },
});
