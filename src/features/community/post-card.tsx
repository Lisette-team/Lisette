import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from "react-native";

import { Avatar } from "@/ui/avatar";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import { colors, fonts, radius, space } from "@/ui/theme";

import { REACTION_KINDS, imageUrl, type PostCard, type ReactionKind } from "./api";
import { ReactionFace } from "./reaction-art";
import { useReactionPicker } from "./reaction-picker";
import { relativeTime } from "./time";

// Pieces of a post as drawn in the v6 screens S-50, S-52 and S-55.

// `under` sits below the name and time, such as the Follow pill on the post page.
export function AuthorRow({
  post,
  size = 44,
  right,
  under,
}: {
  post: PostCard;
  size?: number;
  right?: ReactNode;
  under?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const meta = [
    post.authorKind ? t(`community.kind.${post.authorKind}`) : null,
    relativeTime(t, post.createdAt, i18n.language),
    post.updatedAt !== post.createdAt ? t("community.edited") : null,
  ].filter(Boolean);
  return (
    <View style={styles.authorRow}>
      <Avatar id={post.accountId} size={size} />
      <View style={styles.authorText}>
        <Text style={styles.name} numberOfLines={1}>
          {post.authorName}
        </Text>
        <Text style={styles.meta}>{meta.join(" · ")}</Text>
        {under}
      </View>
      {right}
    </View>
  );
}

export function PostContent({ post }: { post: PostCard }) {
  const { t } = useTranslation();
  return (
    <>
      {post.body ? <Text style={styles.body}>{post.body}</Text> : null}
      {post.images.length ? <ImageGrid paths={post.images} /> : null}
      {post.workTitle ? (
        <View style={styles.linked}>
          <Icon name="book" color={colors.inkMuted} size={18} />
          <Text style={styles.meta}>{t("community.linkedTo", { title: post.workTitle })}</Text>
        </View>
      ) : null}
    </>
  );
}

// Sizes come from the measured width in pixels: on iOS an image laid out with percentages can get no
// size at all, and expo-image does not load an image whose view has no size.
function ImageGrid({ paths }: { paths: string[] }) {
  const [width, setWidth] = useState(0);
  const single = paths.length === 1;
  const side = single ? width : (width - space.sm) / 2;
  return (
    <View style={styles.images} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0
        ? paths.map((path) => (
            <Image
              key={path}
              source={{ uri: imageUrl(path) }}
              style={[styles.image, { width: side, height: single ? (side * 3) / 4 : side }]}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ))
        : null}
    </View>
  );
}

// S-55: the reshared post in a framed box, or a plain notice once it is no longer visible.
export function ReshareBox({ post }: { post: PostCard }) {
  const { t } = useTranslation();
  if (!post.reshareOf) return null;
  const source = post.source;
  if (!source) {
    return (
      <View style={[styles.reshare, styles.unavailable]}>
        <Icon name="lock" color={colors.inkMuted} size={20} />
        <Text style={[styles.meta, styles.flex]}>{t("community.sourceUnavailable")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.reshare}>
      <AuthorRow post={source} size={36} />
      <PostContent post={source} />
      <Pressable accessibilityRole="link" onPress={() => router.push(`/post/${source.id}`)} style={styles.openOriginal}>
        <Text style={styles.openOriginalLabel}>{t("community.openOriginal")}</Text>
      </Pressable>
    </View>
  );
}

// The faces of the reactions a post has, overlapping, with their total; the comment count on the right.
function ReactionSummary({ post }: { post: PostCard }) {
  const { t } = useTranslation();
  const kinds = REACTION_KINDS.filter((kind) => post.reactions[kind]);
  const total = kinds.reduce((sum, kind) => sum + (post.reactions[kind] ?? 0), 0);
  if (!total && !post.commentCount) return null;
  return (
    <View style={styles.summary}>
      <View style={styles.summaryFaces}>
        {kinds.map((kind, index) => (
          <View key={kind} style={[styles.summaryFace, index > 0 && styles.summaryFaceOverlap]}>
            <ReactionFace kind={kind} size={22} />
          </View>
        ))}
        {total ? <Text style={styles.meta}>{total}</Text> : null}
      </View>
      {post.commentCount ? <Text style={styles.meta}>{t("community.commentCount", { count: post.commentCount })}</Text> : null}
    </View>
  );
}

// React: pressing opens the reaction panel right above (see reaction-picker.tsx); the finger can slide over
// it and lift on a reaction. After choosing, the button shows your reaction's face and name.
function ReactButton({ post, onReact }: { post: PostCard; onReact: (kind: ReactionKind | null) => void }) {
  const { t } = useTranslation();
  const picker = useReactionPicker();
  const button = useRef<HostInstance>(null);
  const mine = post.myReaction;
  const label = mine ? t(`community.reaction.${mine}`) : t("community.react");
  const open = () => {
    picker.open(mine, onReact);
    button.current?.measureInWindow((x, y, width, height) => picker.place({ x, y, width, height }));
  };
  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("community.reactHint")}
      accessibilityState={{ selected: Boolean(mine) }}
      onPressIn={open}
      // A tap without sliding: leave the panel open for choosing (on phones the touch end did this already).
      onPress={() => {
        open();
        picker.release();
      }}
      onTouchMove={(event) => picker.move(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      onTouchEnd={() => picker.release()}
      style={({ pressed }) => [styles.react, mine && styles.reactMine, pressed && styles.pressed]}
    >
      {mine ? <ReactionFace kind={mine} size={24} /> : <Icon name="reactionLove" color={colors.inkMuted} size={22} />}
      <Text style={[styles.reactLabel, mine && styles.reactLabelMine]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Icon name={icon} color={colors.inkMuted} size={22} />
    </Pressable>
  );
}

// The summary line, then React on the left with Comment and Reshare on the right.
export function ActionBar({
  post,
  onReact,
  onComment,
  onReshare,
}: {
  post: PostCard;
  onReact: (kind: ReactionKind | null) => void;
  onComment: () => void;
  onReshare: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.actions}>
      <ReactionSummary post={post} />
      <View style={styles.actionBar}>
        <ReactButton post={post} onReact={onReact} />
        <View style={styles.chips}>
          <ActionButton icon="comment" label={t("community.comment")} onPress={onComment} />
          <ActionButton icon="repost" label={t("community.reshare")} onPress={onReshare} />
        </View>
      </View>
    </View>
  );
}

// The "…" button and its dropdown, floating over the page under the button: Edit and Delete for the
// creator, Report otherwise. A tap outside closes it. Deleting asks first, in a centred dialog.
export function PostMenu({ own, onEdit, onDelete }: { own: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const button = useRef<HostInstance>(null);
  const window = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  // Where the button is on screen; until it is measured, the menu sits near the top right.
  const [anchor, setAnchor] = useState<{ top: number; right: number }>({ top: 96, right: space.md });
  const [dialog, setDialog] = useState<"delete" | "report" | null>(null);

  const open = () => {
    setIsOpen(true);
    button.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ top: y + height, right: Math.max(space.sm, window.width - (x + width)) }),
    );
  };
  const close = () => setIsOpen(false);
  const then = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={t("community.moreOptions")}
        accessibilityState={{ expanded: isOpen }}
        hitSlop={8}
        onPress={open}
        style={styles.more}
      >
        <Icon name="more" color={colors.inkMuted} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("common.close")} />
        <View style={[styles.menu, { top: anchor.top, right: anchor.right }]}>
          {own ? (
            <>
              <MenuItem icon="edit" label={t("common.edit")} onPress={then(onEdit)} />
              <MenuItem icon="trash" label={t("common.delete")} onPress={then(() => setDialog("delete"))} />
            </>
          ) : (
            <MenuItem icon="flag" label={t("community.report")} onPress={then(() => setDialog("report"))} />
          )}
        </View>
      </Modal>
      <Dialog
        visible={dialog === "delete"}
        title={t("community.deleteTitle")}
        message={t("community.deleteBody")}
        confirmLabel={t("community.confirmDelete")}
        onConfirm={() => {
          setDialog(null);
          onDelete();
        }}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDialog(null)}
      />
      <Dialog
        visible={dialog === "report"}
        title={t("community.report")}
        message={t("common.comingSoon")}
        cancelLabel={t("common.close")}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? colors.burgundy : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.menuItem}>
      <Icon name={icon} color={color} size={20} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// S-50: a post in the Home feed. The card opens the post page; reacting and the menu work right here.
export function FeedCard({
  post,
  own,
  onReact,
  onDelete,
}: {
  post: PostCard;
  own: boolean;
  onReact: (kind: ReactionKind | null) => void;
  onDelete: () => void;
}) {
  const open = () => router.push(`/post/${post.id}`);
  return (
    <Pressable accessibilityRole="link" onPress={open} style={styles.card}>
      <AuthorRow
        post={post}
        right={
          <PostMenu
            own={own}
            onEdit={() => router.push({ pathname: "/post/[id]", params: { id: post.id, focus: "edit" } })}
            onDelete={onDelete}
          />
        }
      />
      <PostContent post={post} />
      <ReshareBox post={post} />
      <ActionBar
        post={post}
        onReact={onReact}
        onComment={() => router.push({ pathname: "/post/[id]", params: { id: post.id, focus: "comment" } })}
        onReshare={() => router.push({ pathname: "/post/[id]", params: { id: post.id, focus: "reshare" } })}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  authorText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink },
  images: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  image: { borderRadius: radius.field, backgroundColor: colors.surfaceMuted },
  linked: { flexDirection: "row", alignItems: "center", gap: space.sm },
  reshare: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
  },
  unavailable: { flexDirection: "row", alignItems: "center", gap: space.sm },
  openOriginal: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  openOriginalLabel: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.burgundy },
  actionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  chips: { flexDirection: "row", alignItems: "center", gap: space.xs },
  chip: {
    minWidth: 44,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  actions: { gap: space.sm },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  summaryFaces: { flexDirection: "row", alignItems: "center", gap: space.xs },
  summaryFace: { borderRadius: 999, backgroundColor: colors.surface },
  summaryFaceOverlap: { marginLeft: -10 },
  react: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md - 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reactMine: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  reactLabel: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.inkMuted },
  reactLabelMine: { color: colors.burgundy },
  more: { minWidth: 40, minHeight: 48, alignItems: "center", justifyContent: "center" },
  menu: {
    position: "absolute",
    minWidth: 200,
    maxWidth: 280,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    boxShadow: `0px 10px 28px ${colors.shadow}`,
  },
  menuItem: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.sm },
  menuLabel: { fontFamily: fonts.uiMedium, fontSize: 16 },
  card: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
});
