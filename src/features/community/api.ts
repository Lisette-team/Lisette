import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

export type ReactionKind = "love" | "okay" | "dislike";
export const REACTION_KINDS: readonly ReactionKind[] = ["love", "okay", "dislike"];

// The shape returned by post_card() on the server. source is null when the viewer can no longer see
// the reshared content (deleted, hidden or blocked), even though reshareOf still names it.
export type PostCard = {
  id: string;
  accountId: string;
  authorName: string;
  // Set for publication accounts only.
  authorKind: "publishing_house" | "literary_magazine" | "independent_editor" | null;
  createdAt: string;
  updatedAt: string;
  body: string | null;
  workId: string | null;
  workTitle: string | null;
  images: string[];
  reactions: Partial<Record<ReactionKind, number>>;
  myReaction: ReactionKind | null;
  commentCount: number;
  reshareOf: string | null;
  source?: PostCard | null;
};

export type Comment = {
  id: string;
  parentId: string | null;
  accountId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkOption = { id: string; title: string };

// The post as it will look once the server has the new reaction, so the screen answers at once.
export function withReaction(post: PostCard, kind: ReactionKind | null): PostCard {
  const reactions = { ...post.reactions };
  if (post.myReaction) {
    const left = (reactions[post.myReaction] ?? 1) - 1;
    if (left > 0) reactions[post.myReaction] = left;
    else delete reactions[post.myReaction];
  }
  if (kind) reactions[kind] = (reactions[kind] ?? 0) + 1;
  return { ...post, reactions, myReaction: kind };
}

// Proposed limits from the schema page; the database enforces the same ones.
export const MAX_POST_LENGTH = 3000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_IMAGES = 4;

const BUCKET = "public-media";
export const FEED_PAGE_SIZE = 20;

export async function feedPage(after?: Pick<PostCard, "createdAt" | "id">): Promise<PostCard[]> {
  const { data, error } = await supabase.rpc("feed_page", {
    before_at: after?.createdAt ?? null,
    before_id: after?.id ?? null,
    page_size: FEED_PAGE_SIZE,
  });
  if (error) throw error;
  return (data ?? []) as PostCard[];
}

// Null when the post does not exist or the viewer may not see it.
export async function getPost(id: string): Promise<PostCard | null> {
  const { data, error } = await supabase.rpc("get_post", { content_id: id });
  if (error) throw error;
  return (data ?? null) as PostCard | null;
}

export async function getComments(contentId: string): Promise<Comment[]> {
  const { data, error } = await supabase.rpc("get_comments", { content_id: contentId });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

// Pen name or name of a person, or a publication's name.
export async function accountName(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("account_name", { account_id: id });
  if (error) throw error;
  return (data ?? "") as string;
}

export function imageUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// A picked photo made ready to upload: phone photos are often HEIC or larger than the 5 MiB limit,
// so each one is scaled to at most MAX_IMAGE_SIDE on its long side and saved as JPEG.
export type PreparedImage = { uri: string };
const MAX_IMAGE_SIDE = 2048;

export async function prepareImage(asset: ImagePickerAsset): Promise<PreparedImage> {
  const longSide = Math.max(asset.width, asset.height);
  const resize =
    longSide > MAX_IMAGE_SIDE
      ? [{ resize: asset.width >= asset.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE } }]
      : [];
  const result = await manipulateAsync(asset.uri, resize, { compress: 0.8, format: SaveFormat.JPEG });
  return { uri: result.uri };
}

// Thrown by createPost when an image could not be uploaded, before anything is posted.
export class ImageUploadError extends Error {}

// Uploads under the poster's own folder, which is the only place the storage policy allows.
async function uploadImage(userId: string, image: PreparedImage): Promise<string> {
  const path = `${userId}/posts/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  try {
    const body = await (await fetch(image.uri)).arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: "image/jpeg" });
    if (error) throw error;
  } catch (e) {
    throw new ImageUploadError(e instanceof Error ? e.message : String(e));
  }
  return path;
}

export async function createPost(
  userId: string,
  input: { body?: string; images?: PreparedImage[]; workId?: string | null; reshareOf?: string | null },
): Promise<string> {
  const imagePaths = await Promise.all((input.images ?? []).map((image) => uploadImage(userId, image)));
  const { data, error } = await supabase.rpc("create_post", {
    body: input.body?.trim() || null,
    image_paths: imagePaths.length ? imagePaths : null,
    work_id: input.workId ?? null,
    reshare_of: input.reshareOf ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function editPost(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("edit_post", { content_id: id, body });
  if (error) throw error;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_post", { content_id: id });
  if (error) throw error;
}

// null removes the caller's reaction.
export async function setReaction(contentId: string, kind: ReactionKind | null): Promise<void> {
  const { error } = await supabase.rpc("set_reaction", { content_id: contentId, kind });
  if (error) throw error;
}

export async function addComment(contentId: string, body: string, parentId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc("add_comment", { content_id: contentId, parent_id: parentId, body });
  if (error) throw error;
  return data as string;
}

export async function editComment(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("edit_comment", { comment_id: id, body });
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_comment", { comment_id: id });
  if (error) throw error;
}

export async function isFollowing(userId: string, targetId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("follows")
    .select("followed_id", { count: "exact", head: true })
    .eq("follower_id", userId)
    .eq("followed_id", targetId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function setFollow(targetId: string, following: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_follow", { target_id: targetId, following });
  if (error) throw error;
}

// Only public works can be linked to a post; the server checks this again.
export async function searchPublicWorks(query: string): Promise<WorkOption[]> {
  const { data, error } = await supabase
    .from("works")
    .select("id, title")
    .eq("visibility", "public")
    .ilike("title", `%${query.replace(/[%_]/g, "")}%`)
    .order("title")
    .limit(10);
  if (error) throw error;
  return data;
}
