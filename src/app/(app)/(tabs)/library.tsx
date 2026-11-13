import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileButton } from "@/features/account/profile-button";
import { useSession } from "@/features/account/session";
import {
  SHELVES,
  followedLibrary,
  myLibrary,
  removeBook,
  saveBook,
  setEntryPublic,
  setInspiration,
  type FollowedRead,
  type LibraryEntry,
  type Shelf,
} from "@/features/library/api";
import { EntrySheet } from "@/features/library/entry-sheet";
import { BookCover, Bookcase, PrivacyBanner, ShelfChips, ShelfDrawing, authorLine } from "@/features/library/parts";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useWide } from "@/ui/layout";
import { ErrorText } from "@/ui/screen";
import { colors, contentMaxWidth, fonts, radius, space } from "@/ui/theme";

const MAGNIFIER = require("../../../../assets/illustrations/semn-lupa.svg");
const READING = require("../../../../assets/illustrations/semn-citeste.svg");

// Scanning needs the phone camera; on the web, books are added by hand (v6 S-60 web).
const canScan = Platform.OS !== "web";

// Books on the Read shelf moved there this year, and the latest. updated_at is the closest record of
// when a book was finished: it also changes when the entry is edited later.
function readSummary(entries: LibraryEntry[]) {
  const read = entries.filter((e) => e.shelf === "read");
  if (!read.length) return null;
  const year = new Date().getFullYear();
  const thisYear = read.filter((e) => new Date(e.updatedAt).getFullYear() === year);
  const last = thisYear.reduce((latest, e) => (e.updatedAt > latest ? e.updatedAt : latest), "");
  return { year, count: thisYear.length, last };
}

// S-60: the three shelves, private by default, with a per-book public switch.
export default function Library() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const userId = session?.userId ?? "";
  const params = useLocalSearchParams<{ shelf?: string; saved?: string }>();
  const [shelf, setShelf] = useState<Shelf>(
    SHELVES.includes(params.shelf as Shelf) ? (params.shelf as Shelf) : "to_read",
  );
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [followed, setFollowed] = useState<FollowedRead[]>([]);
  const [open, setOpen] = useState<LibraryEntry | null>(null);
  const [removing, setRemoving] = useState<LibraryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Errors from the entry sheet are shown inside it, next to the control that was refused.
  const [sheetError, setSheetError] = useState<string | null>(null);
  const { height } = useWindowDimensions();
  const wide = useWide();

  // Reloaded on every visit, so a book added from the scanner shows up when coming back.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (SHELVES.includes(params.shelf as Shelf)) setShelf(params.shelf as Shelf);
      const failed = () => active && setError(t("errors.network"));
      if (userId) {
        myLibrary(userId)
          .then((list) => {
            if (!active) return;
            setEntries(list);
            setError(null);
          })
          .catch(failed);
      }
      followedLibrary()
        .then((list) => active && setFollowed(list))
        .catch(failed);
      return () => {
        active = false;
      };
    }, [t, userId, params.shelf]),
  );

  const change = (workId: string, patch: Partial<LibraryEntry>) => {
    setEntries((list) => list?.map((e) => (e.workId === workId ? { ...e, ...patch } : e)) ?? null);
    setOpen((current) => (current?.workId === workId ? { ...current, ...patch } : current));
  };

  // P0002: the entry is gone (removed elsewhere); 22023: the change itself is refused.
  function message(e: unknown, refused: string) {
    const code = (e as { code?: string } | null)?.code;
    return t(code === "P0002" ? "library.notInLibrary" : code === "22023" ? refused : "errors.generic");
  }

  async function runInSheet(action: () => Promise<void>, onDone: () => void, refused = "errors.generic") {
    setSheetError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setSheetError(message(e, refused));
    }
  }

  async function confirmRemove() {
    const entry = removing;
    setRemoving(null);
    if (!entry) return;
    try {
      await removeBook(entry.workId);
      setEntries((list) => list?.filter((e) => e.workId !== entry.workId) ?? null);
      setError(null);
    } catch (e) {
      setError(message(e, "errors.generic"));
    }
  }

  const onShelf = entries?.filter((e) => e.shelf === shelf) ?? [];
  const read = readSummary(entries ?? []);
  const summary = read
    ? read.count
      ? t("library.readSummary", {
          count: read.count,
          year: read.year,
          date: new Date(read.last).toLocaleDateString(i18n.language, { day: "numeric", month: "long" }),
        })
      : t("library.readSummaryNone", { year: read.year })
    : null;

  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {t("library.myLibrary")}
      </Text>
      <ProfileButton always size={44} />
    </View>
  );

  const addActions = canScan ? (
    <View style={styles.scanCard}>
      <Image source={MAGNIFIER} style={styles.scanArt} contentFit="contain" accessibilityIgnoresInvertColors />
      <View style={styles.scanBody}>
        <Text style={styles.scanTitle}>
          {t("library.scanCardTitle")} <Text style={styles.scanAccent}>{t("library.scanCardAccent")}</Text>
        </Text>
        <Text style={styles.muted}>{t("library.scanCardHint")}</Text>
        <View style={styles.scanActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("library.scan")}
            onPress={() => router.push("/book/scan")}
            style={styles.scanButton}
          >
            <Text style={styles.scanButtonLabel}>{t("library.scanShort")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("library.addByHand")}
            onPress={() => router.push("/book/add")}
            style={styles.byHand}
          >
            <Text style={styles.byHandLabel}>{t("library.byHand")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : (
    <Button label={t("library.addByHand")} variant="secondary" onPress={() => router.push("/book/add")} />
  );

  const notices = (
    <>
      {params.saved === "withoutIsbn" || params.saved === "isbnHeld" ? (
        <View style={styles.notice}>
          <Icon name="alert" color={colors.burgundy} size={20} />
          <Text style={styles.noticeText}>
            {t(params.saved === "isbnHeld" ? "library.isbnHeld" : "library.savedWithoutIsbn")}
          </Text>
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </>
  );

  // v6 S-60: the Read shelf as a record (count this year and the last one finished), not a score.
  const readCard =
    read && summary ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("library.readCardLabel", { summary })}
        onPress={() => setShelf("read")}
        style={styles.readCard}
      >
        <View style={styles.readSpines}>
          <View style={[styles.readSpine, styles.spineInk]} />
          <View style={[styles.readSpine, styles.spineGold]} />
          <View style={[styles.readSpine, styles.spineBurgundy]} />
          <View style={[styles.readSpine, styles.spinePale]} />
        </View>
        <View style={styles.readText}>
          <Text style={styles.readTitle}>{t("library.read")}</Text>
          <Text style={styles.muted}>{summary}</Text>
        </View>
        <Icon name="chevronRight" color={colors.ink} size={22} />
      </Pressable>
    ) : null;

  const shelfContent = (
    <>
      <ShelfChips value={shelf} onChange={setShelf} />

      {entries && onShelf.length === 0 ? (
        <View style={styles.empty}>
          <Image source={READING} style={styles.emptyArt} contentFit="contain" accessibilityIgnoresInvertColors />
          <Text style={styles.emptyTitle}>{t("library.emptyShelfTitle")}</Text>
          <Text style={styles.emptyBody}>{t(canScan ? "library.emptyShelfBody" : "library.emptyShelfBodyWeb")}</Text>
          {canScan ? <Button label={t("library.scan")} onPress={() => router.push("/book/scan")} /> : null}
        </View>
      ) : null}

      {onShelf.length > 0 ? (
        <>
          <ShelfDrawing titles={onShelf.map((e) => e.title)} />
          <View>
            {onShelf.map((entry) => (
              <Pressable
                key={entry.workId}
                accessibilityRole="button"
                accessibilityLabel={entry.title}
                onPress={() => {
                  setSheetError(null);
                  setOpen(entry);
                }}
                style={styles.row}
              >
                <BookCover title={entry.title} width={46} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {entry.title}
                  </Text>
                  {entry.authorNames.length ? (
                    <Text style={styles.muted} numberOfLines={1}>
                      {authorLine(entry.authorNames)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.visibility}>
                  <Icon name={entry.isPublic ? "users" : "lock"} color={colors.inkMuted} size={22} />
                  <Text style={styles.visibilityLabel}>{t(entry.isPublic ? "library.onProfile" : "library.private")}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  const followedStrip = followed.length ? (
    <View style={styles.followed}>
      <Text accessibilityRole="header" style={styles.section}>
        {t("library.followedTitle")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {followed.map((item) => (
          <View key={`${item.accountId}-${item.workId}`} style={styles.stripItem}>
            <View style={styles.stripCover}>
              <View style={styles.stripFrame}>
                <Text style={styles.stripTitle} numberOfLines={3}>
                  {item.title}
                </Text>
                <View style={styles.badge}>
                  <Icon name="globe" color={colors.ink} size={16} />
                  <Text style={styles.badgeLabel}>{t("library.publicBadge")}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.muted} numberOfLines={2}>
              {t(
                item.shelf === "read"
                  ? "library.followedRead"
                  : item.shelf === "reading"
                    ? "library.followedReading"
                    : "library.followedToRead",
                { name: item.name },
              )}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {wide ? (
          // v6 S-60 web: the title, the shelf chips and the arched bookcase on the left; the privacy
          // note, this year's Read count and manual add (at the bottom) on the right. The followed
          // authors' strip has room in the right column, above the fold.
          <View style={[styles.wide, { minHeight: height }]}>
            <View style={styles.wideMain}>
              <Text accessibilityRole="header" style={styles.wideTitle}>
                {t("library.title")}
              </Text>
              <ShelfChips value={shelf} onChange={setShelf} />
              {entries ? (
                <Bookcase
                  entries={onShelf}
                  onOpen={(entry) => {
                    setSheetError(null);
                    setOpen(entry);
                  }}
                  empty={
                    <>
                      <Image source={READING} style={styles.wideEmptyArt} contentFit="contain" accessibilityIgnoresInvertColors />
                      <Text style={styles.emptyTitle}>{t("library.emptyShelfTitle")}</Text>
                      <Text style={styles.emptyBody}>{t("library.emptyShelfBodyWeb")}</Text>
                    </>
                  }
                />
              ) : null}
            </View>
            <View style={styles.wideSide}>
              <PrivacyBanner />
              {read ? (
                <Text style={styles.readCount}>{t("library.readThisYear", { year: read.year, count: read.count })}</Text>
              ) : null}
              {notices}
              {followedStrip}
              <View style={styles.wideBottom}>
                <Button label={t("library.addByHand")} variant="secondary" onPress={() => router.push("/book/add")} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.column}>
            {header}
            <PrivacyBanner />
            {addActions}
            {notices}
            {shelfContent}
            {readCard}
            {followedStrip}
          </View>
        )}
      </ScrollView>

      <EntrySheet
        entry={open}
        author={Boolean(session?.authorEnabled)}
        onClose={() => setOpen(null)}
        error={sheetError}
        onShelf={(entry, next) =>
          runInSheet(() => saveBook(entry.workId, next), () => change(entry.workId, { shelf: next }))
        }
        onPublic={(entry, value) =>
          runInSheet(
            () => setEntryPublic(entry.workId, value),
            () => change(entry.workId, { isPublic: value }),
            "library.privateWork",
          )
        }
        onInspiration={(entry, value) =>
          runInSheet(() => setInspiration(entry.workId, value), () => change(entry.workId, { isInspiration: value }))
        }
        onRemove={(entry) => {
          setOpen(null);
          setRemoving(entry);
        }}
      />
      <Dialog
        visible={removing !== null}
        title={t("library.removeTitle")}
        message={t("library.removeBody")}
        confirmLabel={t("library.removeYes")}
        onConfirm={confirmRemove}
        cancelLabel={t("common.cancel")}
        onCancel={() => setRemoving(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, alignItems: "center", paddingBottom: space.xl },
  column: { width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: space.lg - 4, gap: space.md + 4 },
  // Measured from s-60-biblioteca-web.png: 32 px margins, a 380 px right column 32 px from the bookcase.
  wide: { width: "100%", flexDirection: "row", gap: space.xl, padding: space.xl, paddingTop: space.lg + 4 },
  wideMain: { flex: 1, minWidth: 0, maxWidth: 760, gap: space.md },
  wideTitle: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink },
  wideSide: { width: 380, gap: space.md + 4, paddingTop: 104 },
  wideBottom: { flex: 1, justifyContent: "flex-end", paddingTop: space.lg },
  wideEmptyArt: { width: 96, height: 96 },
  readCount: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkMuted },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  noticeText: { flex: 1, fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.ink },
  readCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg - 4,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  readSpines: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  readSpine: { width: 12, borderRadius: 2 },
  spineInk: { height: 44, backgroundColor: colors.ink },
  spineGold: { height: 52, backgroundColor: colors.gold },
  spineBurgundy: { height: 46, backgroundColor: colors.burgundy },
  spinePale: { height: 38, backgroundColor: colors.surfaceMuted },
  readText: { flex: 1, gap: 2 },
  readTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
  muted: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  scanArt: { width: 96, height: 96 },
  scanBody: { flex: 1, gap: space.sm },
  scanTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  scanAccent: { color: colors.burgundy },
  scanActions: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xs },
  scanButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.burgundy,
  },
  scanButtonLabel: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.onBurgundy },
  byHand: { minHeight: 48, justifyContent: "center" },
  byHandLabel: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.burgundy },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 76,
    paddingVertical: space.md - 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.ui, fontSize: 17, color: colors.ink },
  visibility: { alignItems: "center", gap: 2, minWidth: 64 },
  visibilityLabel: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
  empty: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  emptyArt: { width: 130, height: 130 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, textAlign: "center" },
  emptyBody: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.inkMuted, textAlign: "center" },
  followed: { gap: space.md, marginTop: space.md },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  strip: { gap: space.md },
  stripItem: { width: 140, gap: space.sm },
  stripCover: { height: 190, padding: 6, borderRadius: 4, backgroundColor: colors.burgundy },
  stripFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: colors.gold,
  },
  stripTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22, color: colors.paper, textAlign: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  badgeLabel: { fontFamily: fonts.ui, fontSize: 13, color: colors.ink },
});
