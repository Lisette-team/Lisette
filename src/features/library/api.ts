import { supabase } from "@/lib/supabase";

export type Shelf = "to_read" | "reading" | "read";
export const SHELVES: readonly Shelf[] = ["to_read", "reading", "read"];

// The shape returned by work_card() on the server.
export type Book = {
  id: string;
  title: string;
  authorNames: string[];
  publisherName: string | null;
  isbn: string | null;
};

export type LibraryEntry = {
  workId: string;
  title: string;
  authorNames: string[];
  shelf: Shelf;
  isPublic: boolean;
  isInspiration: boolean;
  updatedAt: string;
};

// A public entry of a followed account, from followed_library().
export type FollowedRead = {
  accountId: string;
  name: string;
  workId: string;
  title: string;
  authorNames: string[];
  shelf: Shelf;
  updatedAt: string;
};

export type IsbnLookup = { status: "found"; work: Book } | { status: "not_found" } | { status: "unavailable" };

// The Edge Function waits up to 5 s for Open Library; past this the phone stops waiting too.
const LOOKUP_TIMEOUT_MS = 12000;

type EntryRow = {
  work_id: string;
  shelf: Shelf;
  is_public: boolean;
  is_inspiration: boolean;
  updated_at: string;
  works: { title: string; author_names: string[] } | null;
};

// The caller's own entries, newest first. Row-level security returns only books they may see.
export async function myLibrary(userId: string): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("library_entries")
    .select("work_id, shelf, is_public, is_inspiration, updated_at, works(title, author_names)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as EntryRow[]).map((row) => ({
    workId: row.work_id,
    title: row.works?.title ?? "",
    authorNames: row.works?.author_names ?? [],
    shelf: row.shelf,
    isPublic: row.is_public,
    isInspiration: row.is_inspiration,
    updatedAt: row.updated_at,
  }));
}

export async function followedLibrary(): Promise<FollowedRead[]> {
  const { data, error } = await supabase.rpc("followed_library", { page_size: 20 });
  if (error) throw error;
  return (data ?? []) as FollowedRead[];
}

export async function getBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from("works")
    .select("id, title, author_names, publisher_name, isbn")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, title: data.title, authorNames: data.author_names ?? [], publisherName: data.publisher_name, isbn: data.isbn }
    : null;
}

// Scanner and manual add: cache first, then Open Library, through the isbn-lookup Edge Function. Any failure on the
// way (offline, timeout, server error) is "unavailable", so the person can still add the book by hand.
export async function lookupIsbn(isbn: string): Promise<IsbnLookup> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = supabase.functions.invoke("isbn-lookup", { body: { isbn } });
    const timeout = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS)));
    const result = await Promise.race([call, timeout]);
    if (!result || result.error || !result.data?.status) return { status: "unavailable" };
    return result.data as IsbnLookup;
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export async function findSimilarWorks(title: string, author: string | null): Promise<Book[]> {
  const { data, error } = await supabase.rpc("find_similar_works", { title, author: author || null });
  if (error) throw error;
  return (data ?? []) as Book[];
}

// Always a new, separate book, without an ISBN; nothing is merged.
export async function createCatalogueWork(title: string, authors: string[]): Promise<string> {
  const { data, error } = await supabase.rpc("create_catalogue_work", { title, authors });
  if (error) throw error;
  return data as string;
}

export type CreateWithIsbn = { status: "found"; work: Book } | { status: "created"; workId: string; isbnKept: boolean };

// A new book with a typed ISBN, through the isbn-lookup Edge Function: it checks the ISBN again and
// attaches it only when Open Library has no record and no other book holds it (isbnKept).
export async function createWithIsbn(isbn: string, title: string, authors: string[]): Promise<CreateWithIsbn> {
  const { data, error } = await supabase.functions.invoke("isbn-lookup", {
    body: { isbn, title, authors, create: true },
  });
  if (error || !data?.status) throw error ?? new Error("isbn-lookup create failed");
  return data as CreateWithIsbn;
}

export async function saveBook(workId: string, shelf: Shelf): Promise<void> {
  const { error } = await supabase.rpc("save_book", { work_id: workId, shelf });
  if (error) throw error;
}

export async function setEntryPublic(workId: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_entry_public", { work_id: workId, public: isPublic });
  if (error) throw error;
}

export async function setInspiration(workId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_inspiration", { work_id: workId, is_on: on });
  if (error) throw error;
}

export async function removeBook(workId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_book", { work_id: workId });
  if (error) throw error;
}
