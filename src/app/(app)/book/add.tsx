import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import {
  cachedBook,
  createCatalogueWork,
  findSimilarWorks,
  getBook,
  myLibrary,
  saveBook,
  type Book,
  type Shelf,
} from "@/features/library/api";
import { toIsbn13 } from "@/features/library/isbn";
import { BookCover, SHELF_LABEL, ShelfChips, authorLine } from "@/features/library/parts";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";

type Params = { workId?: string; isbn?: string; reason?: string };

// S-62: add a book to a shelf. With workId (a scanned book) it only picks the shelf; otherwise the
// person types the book, and Save first shows similar books on Lisette ("Is this the book?").
export default function AddBook() {
  const { t } = useTranslation();
  const userId = useSession()?.userId ?? "";
  const params = useLocalSearchParams<Params>();
  const [book, setBook] = useState<Book | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState(params.isbn ?? "");
  const [shelf, setShelf] = useState<Shelf>("to_read");
  const [matches, setMatches] = useState<Book[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A scanned book: show it, on its current shelf when it is already in the library.
  useEffect(() => {
    if (!params.workId) return;
    let active = true;
    getBook(params.workId)
      .then((found) => active && setBook(found))
      .catch(() => active && setError(t("errors.network")));
    if (userId) {
      myLibrary(userId)
        .then((list) => {
          const entry = list.find((e) => e.workId === params.workId);
          if (active && entry) setShelf(entry.shelf);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [params.workId, t, userId]);

  const authors = author
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  function done() {
    router.replace({ pathname: "/library", params: { shelf } });
  }

  async function attempt(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(t((e as { code?: string })?.code === "23505" ? "library.isbnTaken" : "errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const isbn13 = () => (isbn.trim() ? toIsbn13(isbn) : null);

  async function createNew() {
    setMatches(null);
    await attempt(async () => {
      const id = await createCatalogueWork(title.trim(), authors, isbn13());
      await saveBook(id, shelf);
      done();
    });
  }

  async function pick(match: Book) {
    setMatches(null);
    await attempt(async () => {
      await saveBook(match.id, shelf);
      done();
    });
  }

  async function save() {
    if (book) {
      await attempt(async () => {
        await saveBook(book.id, shelf);
        done();
      });
      return;
    }
    if (!title.trim()) {
      setError(t("library.titleRequired"));
      return;
    }
    const code = isbn13();
    if (isbn.trim() && !code) {
      setError(t("library.isbnInvalid"));
      return;
    }
    await attempt(async () => {
      const sameIsbn = code ? await cachedBook(code) : null;
      const similar = await findSimilarWorks(title.trim(), author.trim() || null);
      const found = [...(sameIsbn ? [sameIsbn] : []), ...similar.filter((s) => s.id !== sameIsbn?.id)];
      if (found.length === 0) {
        const id = await createCatalogueWork(title.trim(), authors, code);
        await saveBook(id, shelf);
        done();
      } else {
        setMatches(found);
      }
    });
  }

  const preview = book ?? (title.trim() ? { title: title.trim(), authorNames: authors } : null);
  const notice =
    params.reason === "not_found" ? "library.isbnNotFound" : params.reason === "unavailable" ? "library.isbnUnavailable" : null;

  return (
    <Screen
      title={t("library.addTitle")}
      backLabel={t("common.back")}
      footer={<Button label={t("common.save")} busy={busy} onPress={save} />}
    >
      {notice ? (
        <View style={styles.notice}>
          <Icon name="alert" color={colors.burgundy} size={22} />
          <Text style={styles.noticeText}>{t(notice)}</Text>
        </View>
      ) : null}

      {params.workId ? null : (
        <>
          <TextField label={t("library.fieldTitle")} value={title} onChangeText={setTitle} maxLength={200} />
          <TextField label={t("library.fieldAuthor")} value={author} onChangeText={setAuthor} />
          <TextField
            label={t("library.fieldIsbn")}
            value={isbn}
            onChangeText={setIsbn}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="characters"
          />
        </>
      )}

      <Text style={styles.heading}>{t("library.shelfHeading")}</Text>
      <ShelfChips value={shelf} onChange={setShelf} />
      <Text style={styles.muted}>{t("library.staysPrivate")}</Text>

      {preview ? (
        <View style={styles.preview}>
          <BookCover title={preview.title} width={72} />
          <View style={styles.previewText}>
            <Text style={styles.previewTitle}>{preview.title}</Text>
            <Text style={styles.muted}>
              {[authorLine(preview.authorNames), t(SHELF_LABEL[shelf])].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.privateRow}>
              <Icon name="lock" color={colors.inkMuted} size={18} />
              <Text style={styles.muted}>{t("library.privateEntry")}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Modal visible={matches !== null} transparent animationType="slide" onRequestClose={() => setMatches(null)}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMatches(null)}
            accessibilityLabel={t("common.close")}
          />
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {t("library.similarTitle")}
            </Text>
            <Text style={styles.muted}>{t("library.similarBody")}</Text>
            <ScrollView style={styles.matches}>
              {matches?.map((match) => {
                const by = authorLine(match.authorNames);
                return (
                  <Pressable
                    key={match.id}
                    accessibilityRole="button"
                    accessibilityLabel={by ? `${match.title}, ${by}` : match.title}
                    onPress={() => pick(match)}
                    style={styles.match}
                  >
                    <BookCover title={match.title} width={44} />
                    <View style={styles.previewText}>
                      <Text style={styles.matchTitle}>{match.title}</Text>
                      {by ? <Text style={styles.muted}>{by}</Text> : null}
                      {match.isbn ? <Text style={styles.muted}>ISBN {match.isbn}</Text> : null}
                    </View>
                    <Icon name="chevronRight" color={colors.inkMuted} size={20} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button label={t("library.newBook")} variant="secondary" onPress={createNew} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: space.sm },
  muted: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.goldSoft,
  },
  noticeText: { flex: 1, fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.ink },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg - 4,
    padding: space.lg - 4,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  previewText: { flex: 1, gap: 4 },
  previewTitle: { fontFamily: fonts.ui, fontSize: 17, color: colors.ink },
  privateRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: colors.scrim },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "85%",
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.paper,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink },
  matches: { flexGrow: 0 },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md - 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  matchTitle: { fontFamily: fonts.uiMedium, fontSize: 17, color: colors.ink },
});
