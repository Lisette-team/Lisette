import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileButton } from "@/features/account/profile-button";
import { useSession } from "@/features/account/session";
import {
  FEED_PAGE_SIZE,
  accountName,
  deletePost,
  feedPage,
  setReaction,
  withReaction,
  type PostCard,
  type ReactionKind,
} from "@/features/community/api";
import { FeedCard } from "@/features/community/post-card";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon, type IconName } from "@/ui/icon";
import { useWide } from "@/ui/layout";
import { ErrorText } from "@/ui/screen";
import { colors, contentMaxWidth, fonts, radius, space } from "@/ui/theme";

const HEADERS = {
  morning: require("../../../../assets/illustrations/antet-dimineata.svg"),
  midday: require("../../../../assets/illustrations/antet-amiaza.svg"),
  evening: require("../../../../assets/illustrations/antet-seara.svg"),
};
const ASLEEP = require("../../../../assets/illustrations/semn-doarme.svg");
const MARK = require("../../../../assets/brand/lisette-mark.png");

// Only the header changes with the time of day (v6 S-50).
function partOfDay(hour: number): keyof typeof HEADERS {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "midday";
  return "evening";
}

// S-50: chronological posts of followed accounts (and the person's own), no recommendations.
export default function Home() {
  const { t } = useTranslation();
  const session = useSession();
  const userId = session?.userId ?? "";
  const [name, setName] = useState("");
  const [posts, setPosts] = useState<PostCard[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const part = partOfDay(new Date().getHours());
  const wide = useWide();

  // Reloaded on every visit, so a new post or follow shows up when coming back.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      feedPage()
        .then((page) => {
          if (!active) return;
          setPosts(page);
          setHasMore(page.length === FEED_PAGE_SIZE);
          setError(null);
        })
        .catch(() => active && setError(t("errors.network")));
      if (userId) {
        accountName(userId)
          .then((value) => active && setName(value))
          .catch(() => undefined);
      }
      return () => {
        active = false;
      };
    }, [t, userId]),
  );

  async function loadMore() {
    const last = posts?.at(-1);
    if (!last) return;
    setBusy(true);
    try {
      const page = await feedPage(last);
      setPosts([...(posts ?? []), ...page]);
      setHasMore(page.length === FEED_PAGE_SIZE);
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  // Shown at once; if the server refuses, the card goes back to how it was.
  function react(post: PostCard, kind: ReactionKind | null) {
    const replace = (next: PostCard) => setPosts((list) => list?.map((p) => (p.id === post.id ? next : p)) ?? null);
    replace(withReaction(post, kind));
    setReaction(post.id, kind).catch(() => {
      replace(post);
      setError(t("community.notAllowed"));
    });
  }

  function remove(post: PostCard) {
    deletePost(post.id)
      .then(() => setPosts((list) => list?.filter((p) => p.id !== post.id) ?? null))
      .catch(() => setError(t("community.notAllowed")));
  }

  const empty = posts?.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Stays at the top while the street illustration and the feed scroll under it. */}
      <View style={styles.topBar}>
        {wide ? (
          // The sidebar already carries the wordmark; on wide screens the page has its own create
          // action instead of the phone's + button.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("community.composerTitle")}
            onPress={() => router.push("/create")}
            style={styles.newPost}
          >
            <Icon name="plus" color={colors.onBurgundy} size={18} />
            <Text style={styles.newPostLabel}>{t("community.composerTitle")}</Text>
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <Image source={MARK} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={styles.wordmark}>Lisette</Text>
          </View>
        )}
        <ProfileButton always size={40} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image
          source={HEADERS[part]}
          style={styles.header}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />

        <View style={styles.column}>
          {empty ? (
            <View style={styles.empty}>
              <Image source={ASLEEP} style={styles.asleep} contentFit="contain" accessibilityIgnoresInvertColors />
              <Text style={styles.emptyTitle}>{t("community.emptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("community.emptyBody")}</Text>
              <Button label={t("community.discoverAccounts")} onPress={() => router.push("/discover")} />
            </View>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.greeting}>
                {t(`community.greeting.${part}`)}
                {name ? <Text style={styles.greetingName}> {name}</Text> : null}
              </Text>
              <Text style={styles.subtitle}>{t("community.feedSubtitle")}</Text>

              <View style={styles.composer}>
                <View style={styles.composerRow}>
                  <Avatar id={userId} size={44} />
                  <Pressable accessibilityRole="button" onPress={() => router.push("/create")} style={styles.prompt}>
                    <Text style={styles.promptLabel}>{t("community.composerPrompt")}</Text>
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  <Chip icon="edit" label={t("community.chipProgress")} onPress={() => router.push("/create")} />
                  <Chip
                    icon="book"
                    label={t("community.chipBook")}
                    onPress={() => router.push({ pathname: "/create", params: { pick: "work" } })}
                  />
                  {session?.authorEnabled ? (
                    <Chip icon="manuscript" label={t("community.chipExcerpt")} onPress={() => setNotice(true)} />
                  ) : null}
                </View>
                {notice ? <Text style={styles.subtitle}>{t("common.comingSoon")}</Text> : null}
              </View>

              <View style={styles.sectionRow}>
                <Text accessibilityRole="header" style={styles.section}>
                  {t("community.feedSection")}
                </Text>
                <Text style={styles.subtitle}>{t("community.chronological")}</Text>
              </View>
              {posts?.map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  own={post.accountId === userId}
                  onReact={(kind) => react(post, kind)}
                  onDelete={() => remove(post)}
                />
              ))}
              {hasMore ? <Button label={t("community.loadMore")} variant="link" busy={busy} onPress={loadMore} /> : null}
            </>
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.chip}>
      <Icon name={icon} color={colors.burgundy} size={15} />
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, alignItems: "center", paddingBottom: space.xl },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: space.lg - 4,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  newPost: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    marginVertical: space.sm,
    paddingHorizontal: space.md + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.burgundy,
  },
  newPostLabel: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.onBurgundy },
  mark: { width: 24, height: 35 },
  wordmark: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  header: { width: "100%", aspectRatio: 360 / 150, maxHeight: 220 },
  column: { flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: space.lg - 4, gap: space.md },
  greeting: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: colors.ink, marginTop: space.lg },
  greetingName: { color: colors.burgundy },
  subtitle: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  composer: { gap: space.md, padding: space.md, borderRadius: radius.sheet, backgroundColor: colors.surface },
  composerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  prompt: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
  },
  promptLabel: { fontFamily: fonts.ui, fontSize: 16, color: colors.inkMuted },
  // Equal shares of one row, so the three always fit side by side.
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipLabel: { flexShrink: 1, fontFamily: fonts.ui, fontSize: 13, color: colors.ink },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.sm },
  section: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xxl },
  asleep: { width: 130, height: 130 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, textAlign: "center" },
  emptyBody: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: "center" },
});
