import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type ScrollViewInstance, type TextInputInstance } from "react-native";

import { useSession } from "@/features/account/session";
import {
  MAX_COMMENT_LENGTH,
  MAX_POST_LENGTH,
  addComment,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  getComments,
  getPost,
  isFollowing,
  setFollow,
  setReaction,
  withReaction,
  type Comment,
  type PostCard,
  type ReactionKind,
} from "@/features/community/api";
import {
  ActionBar,
  AuthorRow,
  PostContent,
  PostMenu,
  ReshareBox,
} from "@/features/community/post-card";
import { relativeTime } from "@/features/community/time";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import { ErrorText, Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";
import { colors, fonts, radius, space } from "@/ui/theme";

type Mode = "view" | "edit" | "reshare";

// S-52 (and S-55 for a reshare): the post, one reaction per person, reshare, report, follow,
// owner edit/delete, comments and replies.
export default function PostPage() {
  const { t, i18n } = useTranslation();
  // focus comes from the feed card's Comment and Reshare buttons.
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: "comment" | "reshare" | "edit" }>();
  const userId = useSession()?.userId ?? "";
  const [post, setPost] = useState<PostCard | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [following, setFollowing] = useState(false);
  const [mode, setMode] = useState<Mode>(focus === "reshare" ? "reshare" : focus === "edit" ? "edit" : "view");
  const [draft, setDraft] = useState("");
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const commentRef = useRef<TextInputInstance>(null);

  // The comment field is the last thing on the page: keep it above the keyboard while typing.
  const revealCommentField = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);

  const load = useCallback(async () => {
    const [loaded, loadedComments] = await Promise.all([getPost(id), getComments(id)]);
    setPost(loaded);
    setComments(loadedComments);
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.all([getPost(id), getComments(id)])
      .then(async ([loaded, loadedComments]) => {
        if (!active) return;
        setPost(loaded);
        setComments(loadedComments);
        if (focus === "comment") setTimeout(() => commentRef.current?.focus(), 300);
        if (focus === "edit") setDraft(loaded?.body ?? "");
        if (loaded && loaded.accountId !== userId) setFollowing(await isFollowing(userId, loaded.accountId));
      })
      .catch(() => active && setError(t("errors.network")));
    return () => {
      active = false;
    };
  }, [id, userId, focus, t]);

  // Runs a change, then re-reads the post so counts and states come from the server.
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      await action();
      await load();
      return true;
    } catch (e) {
      setError((e as { code?: string }).code === "42501" ? t("community.notAllowed") : t("errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (post === undefined)
    return (
      <Screen title={t("community.postTitle")} backLabel={t("common.back")}>
        {null}
      </Screen>
    );
  if (post === null) {
    return (
      <Screen title={t("community.postTitle")} backLabel={t("common.back")}>
        <Text style={styles.muted}>{t("community.notFound")}</Text>
      </Screen>
    );
  }

  const own = post.accountId === userId;

  // Shown at once, then confirmed by re-reading the post; a failure puts the server's state back.
  function react(kind: ReactionKind | null) {
    if (!post) return;
    setPost(withReaction(post, kind));
    void run(() => setReaction(post.id, kind));
  }

  return (
    <Screen title={t("community.postTitle")} backLabel={t("common.back")} scrollRef={scrollRef}>
      <AuthorRow
        post={post}
        under={
          own ? null : (
            <PillAction
              icon={following ? "check" : "plus"}
              label={following ? t("common.following") : t("common.follow")}
              selected={following}
              onPress={() => run(() => setFollow(post.accountId, !following).then(() => setFollowing(!following)))}
            />
          )
        }
        right={
          <View style={styles.headerActions}>
            <PostMenu
              own={own}
              onEdit={() => {
                setDraft(post.body ?? "");
                setMode("edit");
              }}
              onDelete={() => run(() => deletePost(post.id)).then((ok) => ok && router.replace("/home"))}
            />
          </View>
        }
      />
      {mode === "edit" ? (
        <>
          <TextField
            label={t("community.bodyLabel")}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_POST_LENGTH}
            multiline
          />
          <View style={styles.row}>
            <TextAction
              label={t("common.save")}
              onPress={() => run(() => editPost(post.id, draft)).then((ok) => ok && setMode("view"))}
            />
            <TextAction label={t("common.cancel")} onPress={() => setMode("view")} />
          </View>
        </>
      ) : (
        <PostContent post={post} />
      )}
      <ReshareBox post={post} />

      <ActionBar
        post={post}
        onReact={react}
        onComment={() => commentRef.current?.focus()}
        onReshare={() => {
          setDraft("");
          setMode(mode === "reshare" ? "view" : "reshare");
        }}
      />

      {mode === "reshare" ? (
        <>
          <TextField
            label={t("community.reshareComment")}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_POST_LENGTH}
            multiline
          />
          <Button
            label={t("community.reshareConfirm")}
            busy={busy}
            onPress={() =>
              run(async () => {
                const reshareId = await createPost(userId, {
                  body: draft.trim(),
                  reshareOf: post.id,
                });
                setMode("view");
                router.push(`/post/${reshareId}`);
              })
            }
          />
        </>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Text accessibilityRole="header" style={styles.heading}>
        {t("community.comments")}
      </Text>
      {comments.length === 0 ? <Text style={styles.muted}>{t("community.noComments")}</Text> : null}
      {comments
        .filter((c) => c.parentId === null)
        .map((parent) => (
          <View key={parent.id} style={styles.thread}>
            {[parent, ...comments.filter((c) => c.parentId === parent.id)].map((c) => (
              <View key={c.id} style={[styles.comment, c.parentId ? styles.reply : null]}>
                <View style={styles.commentAuthor}>
                  <Avatar id={c.accountId} size={c.parentId ? 36 : 44} />
                  <View style={styles.flex}>
                    <Text style={styles.name}>{c.authorName}</Text>
                    <Text style={styles.muted}>{relativeTime(t, c.createdAt, i18n.language)}</Text>
                  </View>
                </View>
                {editing?.id === c.id ? (
                  <>
                    <TextField
                      label={t("community.commentLabel")}
                      value={editing.body}
                      onChangeText={(body) => setEditing({ id: c.id, body })}
                      maxLength={MAX_COMMENT_LENGTH}
                      multiline
                    />
                    <View style={styles.row}>
                      <TextAction
                        label={t("common.save")}
                        onPress={() => run(() => editComment(c.id, editing.body)).then((ok) => ok && setEditing(null))}
                      />
                      <TextAction label={t("common.cancel")} onPress={() => setEditing(null)} />
                    </View>
                  </>
                ) : (
                  <Text style={styles.body}>{c.body}</Text>
                )}
                <View style={styles.row}>
                  {c.parentId === null ? (
                    <PillAction
                      icon="comment"
                      label={t("community.reply")}
                      onPress={() => {
                        setReplyTo(c);
                        commentRef.current?.focus();
                      }}
                    />
                  ) : null}
                  {c.accountId === userId && editing?.id !== c.id ? (
                    <>
                      <PillAction icon="edit" label={t("common.edit")} onPress={() => setEditing({ id: c.id, body: c.body })} />
                      <PillAction icon="trash" label={t("common.delete")} onPress={() => setDeletingComment(c.id)} />
                    </>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))}

      {/* The field with a round send button beside it, as in messaging apps. */}
      <View style={styles.composer}>
        <View style={styles.flex}>
          <TextField
            inputRef={commentRef}
            label={replyTo ? t("community.replyLabel", { name: replyTo.authorName }) : t("community.commentLabel")}
            onFocus={revealCommentField}
            onContentSizeChange={revealCommentField}
            value={comment}
            onChangeText={setComment}
            maxLength={MAX_COMMENT_LENGTH}
            multiline
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("community.send")}
          accessibilityState={{ disabled: !comment.trim() || busy }}
          disabled={!comment.trim() || busy}
          onPress={() =>
            void run(() => addComment(post.id, comment, replyTo?.id ?? null)).then((ok) => {
              if (!ok) return;
              setComment("");
              setReplyTo(null);
            })
          }
          style={[styles.send, !comment.trim() && styles.sendIdle]}
        >
          <Icon name="send" color={comment.trim() ? colors.onBurgundy : colors.inkMuted} size={22} />
        </Pressable>
      </View>
      {replyTo ? <TextAction label={t("common.cancel")} onPress={() => setReplyTo(null)} /> : null}
      <Dialog
        visible={deletingComment !== null}
        title={t("community.deleteCommentTitle")}
        confirmLabel={t("community.confirmDelete")}
        onConfirm={() => {
          const id = deletingComment;
          setDeletingComment(null);
          if (id) void run(() => deleteComment(id));
        }}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeletingComment(null)}
      />
    </Screen>
  );
}

// Text-only action; selected marks an active follow.
function TextAction({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={styles.textAction}
    >
      <Text style={[styles.textActionLabel, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

// A small outlined pill with an icon: Follow under the author's name, Reply / Edit / Delete under a comment.
// selected fills it, as for an active follow.
function PillAction({
  icon,
  label,
  selected = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pillPressed]}
    >
      <Icon name={icon} color={colors.burgundy} size={16} />
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: space.xs,
    paddingHorizontal: space.md - 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  pillPressed: { backgroundColor: colors.surfaceMuted },
  pillLabel: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.burgundy },
  flex: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
  },
  sendIdle: { backgroundColor: colors.surfaceMuted },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  heading: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, paddingTop: space.md },
  muted: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  thread: { gap: space.md, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  comment: { gap: space.sm },
  reply: { marginLeft: space.xl },
  commentAuthor: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink },
  textAction: { minHeight: 48, justifyContent: "center" },
  textActionLabel: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.inkMuted },
  selectedLabel: { color: colors.burgundy },
});
