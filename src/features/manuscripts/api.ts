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
  versions: Pick<ManuscriptVersion, "id" | "label" | "page_count" | "uploaded_at">[];
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
    .select("id, title, versions:manuscript_versions(id, label, page_count, uploaded_at)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .order("uploaded_at", { referencedTable: "versions", ascending: false });
  if (error) throw error;
  return data;
}

export async function createWork(title: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_work", { title });
  if (error) throw error;
  return data as string;
}

// The server checks the real content, size and ownership, then records the hash and upload time.
export async function uploadVersion(workId: string, file: DocumentPickerAsset, label: string): Promise<ManuscriptVersion> {
  // The PDF is the whole body, so the server reads it only once. Web has the picked File; native reads
  // the picked file's URI into a Blob.
  const body = Platform.OS === "web" && file.file ? file.file : await (await fetch(file.uri)).blob();
  const query = new URLSearchParams({ workId, label });
  const { data, error } = await supabase.functions.invoke<ManuscriptVersion>(`manuscript-upload?${query}`, {
    body,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!error && data) return data;
  const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0;
  throw new Error(status === 422 ? "invalid_pdf" : status === 413 ? "too_large" : "unknown");
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
