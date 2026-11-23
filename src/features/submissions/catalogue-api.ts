import { supabase } from "@/lib/supabase";

export type PublisherKind = "publishing_house" | "literary_magazine" | "independent_editor";
export type SharingPolicy = "author_controlled" | "synopsis_approval" | "synopsis_and_excerpt_approval";

// One row of the open_calls view (supabase/migrations/*_calls.sql).
export type OpenCall = {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_kind: PublisherKind;
  sharing_policy: SharingPolicy;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string | null;
  accepted_languages: string[];
  req_full_manuscript: boolean;
  req_synopsis: boolean;
  req_sample: boolean;
  req_genre: boolean;
  req_author_intro: boolean;
  // Empty = any genre.
  genre_ids: string[];
};

// One row of the catalogue_publishers view: approved publications only.
export type CataloguePublisher = {
  id: string;
  name: string;
  kind: PublisherKind;
  intro: string | null;
  logo_path: string | null;
  genre_ids: string[];
  open_call_count: number;
  languages: string[];
};

export type CatalogueFilters = {
  query: string;
  genreId: string | null;
  language: string | null;
  kind: PublisherKind | null;
  // Set when a publication's card opens its calls.
  publisherId: string | null;
};

export const NO_FILTERS: CatalogueFilters = { query: "", genreId: null, language: null, kind: null, publisherId: null };

// Wildcards people type are dropped; the rest is matched literally.
const searchTerm = (query: string) => query.replace(/[*%_\\]/g, " ").trim();
// Inside or=(…) a value is double-quoted so commas and parentheses in names stay text.
const quoted = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

export async function listOpenCalls(f: CatalogueFilters): Promise<OpenCall[]> {
  let request = supabase.from("open_calls").select("*");
  if (f.kind) request = request.eq("publisher_kind", f.kind);
  if (f.publisherId) request = request.eq("publisher_id", f.publisherId);
  if (f.language) request = request.contains("accepted_languages", [f.language]);
  // A call that lists no genres accepts any genre.
  if (f.genreId) request = request.or(`genre_ids.cs.{${f.genreId}},genre_ids.eq.{}`);
  const term = searchTerm(f.query);
  if (term) request = request.or(`title.ilike.${quoted(`*${term}*`)},publisher_name.ilike.${quoted(`*${term}*`)}`);
  const { data, error } = await request.order("closes_at", { ascending: true, nullsFirst: false }).order("title");
  if (error) throw error;
  return data as OpenCall[];
}

export async function listPublications(f: CatalogueFilters): Promise<CataloguePublisher[]> {
  let request = supabase.from("catalogue_publishers").select("*");
  if (f.kind) request = request.eq("kind", f.kind);
  if (f.language) request = request.contains("languages", [f.language]);
  if (f.genreId) request = request.contains("genre_ids", [f.genreId]);
  const term = searchTerm(f.query);
  if (term) request = request.ilike("name", `%${term}%`);
  const { data, error } = await request.order("name");
  if (error) throw error;
  return data as CataloguePublisher[];
}

// One open call, for its page and for a send that starts from it. null when it is not open (or not visible).
export async function getOpenCall(id: string): Promise<OpenCall | null> {
  const { data, error } = await supabase.from("open_calls").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as OpenCall | null;
}
