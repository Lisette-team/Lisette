import { FunctionsHttpError } from "@supabase/supabase-js";
import type { DocumentPickerAsset } from "expo-document-picker";
import { Platform } from "react-native";

import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type ManuscriptVersion = {
  id: string;
  work_id: string;
  sha256: string;
  byte_size: number;
  page_count: number;
  label: string | null;
  uploaded_at: string;
};

export type Work = {
  id: string;
  title: string;
  is_starred: boolean;
  main_version_id: string | null;
  versions: (Pick<ManuscriptVersion, "id" | "label" | "page_count" | "uploaded_at"> & { sent: boolean })[];
};

// Thrown by uploadVersion: the server's verdict, or "unknown" when the outcome could not be confirmed.
export type UploadError = "invalid_pdf" | "too_large" | "unknown";

export async function activateAuthor(): Promise<void> {
  const { error } = await supabase.rpc("activate_author");
  if (error) throw error;
}

export async function listWorks(userId: string): Promise<Work[]> {
  const { data, error } = await supabase
    .from("works")
    .select("id, title, preferences:work_preferences(is_starred, main_version_id), versions:manuscript_versions(id, label, page_count, uploaded_at, submissions(id))")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .order("uploaded_at", { referencedTable: "versions", ascending: false });
  if (error) throw error;
  return data.map(({ preferences, ...work }) => {
    const preference = Array.isArray(preferences) ? preferences[0] : preferences;
    return {
      ...work,
      is_starred: preference?.is_starred ?? false,
      main_version_id: preference?.main_version_id ?? null,
      versions: work.versions.map(({ submissions, ...version }) => ({ ...version, sent: submissions.length > 0 })),
    };
  });
}

export async function createWork(title: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_work", { title });
  if (error) throw error;
  return data as string;
}

// Sends a picked PDF to manuscript-upload; throws an UploadError code.
export async function postPdf<T>(query: URLSearchParams, file: DocumentPickerAsset): Promise<T> {
  // The PDF is the whole body, so the server reads it only once. Web has the picked File; native reads
  // the picked file's URI into a Blob.
  const body = Platform.OS === "web" && file.file ? file.file : await (await fetch(file.uri)).blob();
  const { data, error } = await supabase.functions.invoke<T>(`manuscript-upload?${query}`, {
    body,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!error && data) return data;
  const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0;
  throw new Error(status === 422 ? "invalid_pdf" : status === 413 ? "too_large" : "unknown");
}

// The server checks the real content, size and ownership, then records the hash and upload time.
export function uploadVersion(workId: string, file: DocumentPickerAsset, label: string): Promise<ManuscriptVersion> {
  return postPdf(new URLSearchParams({ workId, label }), file);
}

// The reader fetches the bytes itself with these, so the file never passes through app storage.
export async function gatewayRequest(versionId: string) {
  const { data } = await supabase.auth.getSession();
  return {
    url: `${supabaseUrl}/functions/v1/manuscript-file`,
    token: data.session?.access_token ?? "",
    apikey: supabaseAnonKey,
    body: { versionId, purpose: "read" as const },
  };
}

export async function setStarred(workId: string, starred: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_work_starred", { work_id: workId, starred });
  if (error) throw error;
}
export async function setMainVersion(workId: string, versionId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_main_version", { work_id: workId, version_id: versionId });
  if (error) throw error;
}
export async function renameWork(workId: string, title: string): Promise<void> {
  const { error } = await supabase.rpc("rename_work", { work_id: workId, title });
  if (error) throw error;
}
async function deleteManuscript(body: object): Promise<void> {
  const { error } = await supabase.functions.invoke("manuscript-delete", { body });
  if (error instanceof FunctionsHttpError) {
    const result = await (error.context as Response).json();
    throw new Error(result.error);
  }
  if (error) throw error;
}
export function deleteVersion(versionId: string): Promise<void> { return deleteManuscript({ versionId }); }
export function deleteWork(workId: string): Promise<void> { return deleteManuscript({ workId }); }
export type MySubmission = {
  id: string; status: "submitted" | "in_review" | "on_hold" | "selected" | "rejected" | "withdrawn";
  submitted_at: string; status_changed_at: string; work_title: string; version_id: string;
  version_label: string | null; call_title: string; publisher_name: string;
  publisher_kind: "publishing_house" | "literary_magazine" | "independent_editor";
};
export async function listMySubmissions(): Promise<MySubmission[]> {
  const { data, error } = await supabase.rpc("my_submissions");
  if (error) throw error;
  return data as MySubmission[];
}
