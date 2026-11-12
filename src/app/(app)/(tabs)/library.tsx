import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { BookCover, PrivacyBanner, ShelfChips, ShelfDrawing, authorLine } from "@/features/library/parts";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { ErrorText } from "@/ui/screen";
import { colors, contentMaxWidth, fonts, radius, space } from "@/ui/theme";

const MAGNIFIER = require("../../../../assets/illustrations/semn-lupa.svg");
const READING = require("../../../../assets/illustrations/semn-citeste.svg");

// Scanning needs the phone camera; on the web, books are added by hand (v6 S-60 web).
const canScan = Platform.OS !== "web";

// S-60: the three shelves, private by default, with a per-book public switch.
export default function Library() {
  const { t } = useTranslation();
  const session = useSession();
  const userId = session?.userId ?? "";
  const params = useLocalSearchParams<{ shelf?: string }>();
  const [shelf, setShelf] = useState<Shelf>(
    SHELVES.includes(params.shelf as Shelf) ? (params.shelf as Shelf) : "to_read",
  );
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [followed, setFollowed] = useState<FollowedRead[]>([]);
  const [open, setOpen] = useState<LibraryEntry | null>(null);
  const [removing, setRemoving] = useState<LibraryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reloaded on every visit, so a book added from the scanner shows up when coming back.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (SHELVES.includes(params.shelf as Shelf)) setShelf(params.shelf as Shelf);
      if (userId) {
        myLibrary(userId)
          .then((list) => {
            if (!active) return;
            setEntries(list);
            setError(null);
          })
          .catch(() => active && setError(t("errors.network")));
      }
      followedLibrary()
        .then((list) => active && setFollowed(list))
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [t, userId, params.shelf]),
  );

  const change = (workId: string, patch: Partial<LibraryEntry>) => {
    setEntries((list) => list?.map((e) => (e.workId === workId ? { ...e, ...patch } : e)) ?? null);
    setOpen((current) => (current?.workId === workId ? { ...current, ...patch } : current));
  };

  async function run(action: () => Promise<void>, onDone: () => void, refused = "errors.generic") {
    try {
      await action();
      onDone();
      setError(null);
    } catch (e) {
      setError(t((e as { code?: string })?.code === "22023" ? refused : "errors.generic"));
    }
  }

  async function confirmRemove() {
    const entry = removing;
    setRemoving(null);
    if (!entry) return;
    await run(
      () => removeBook(entry.workId),
      () => setEntries((list) => list?.filter((e) => e.workId !== entry.workId) ?? null),
    );
  }

  const onShelf = entries?.filter((e) => e.shelf === shelf) ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {t("library.myLibrary")}
            </Text>
            <ProfileButton always size={44} />
          </View>

          <PrivacyBanner />

          {canScan ? (
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
          )}

          <ShelfChips value={shelf} onChange={setShelf} />

          {entries && onShelf.length === 0 ? (
            <View style={styles.empty}>
              <Image source={READING} style={styles.emptyArt} contentFit="contain" accessibilityIgnoresInvertColors />
              <Text style={styles.emptyTitle}>{t("library.emptyShelfTitle")}</Text>
              <Text style={styles.emptyBody}>
                {t(canScan ? "library.emptyShelfBody" : "library.emptyShelfBodyWeb")}
              </Text>
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
                    onPress={() => setOpen(entry)}
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
                      <Text style={styles.visibilityLabel}>
                        {t(entry.isPublic ? "library.onProfile" : "library.private")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? <ErrorText>{error}</ErrorText> : null}

          {followed.length ? (
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
          ) : null}
        </View>
      </ScrollView>

      <EntrySheet
        entry={open}
        author={Boolean(session?.authorEnabled)}
        onClose={() => setOpen(null)}
        onShelf={(entry, next) => run(() => saveBook(entry.workId, next), () => change(entry.workId, { shelf: next }))}
        onPublic={(entry, value) =>
          run(
            () => setEntryPublic(entry.workId, value),
            () => change(entry.workId, { isPublic: value }),
            "library.privateWork",
          )
        }
        onInspiration={(entry, value) =>
          run(() => setInspiration(entry.workId, value), () => change(entry.workId, { isInspiration: value }))
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
