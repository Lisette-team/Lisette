import type { DocumentPickerAsset } from "expo-document-picker";

import { postPdf } from "@/features/manuscripts/api";
import { supabase } from "@/lib/supabase";

import type { SubmitFailure } from "./batch";

export type Eligibility = { call_id: string; reason: SubmitFailure | null; submission_id: string | null };

// A synopsis or sample PDF, checked like a manuscript. Returns the storage path for SubmitItem.materials.
export async function uploadMaterial(file: DocumentPickerAsset): Promise<string> {
  const { storagePath } = await postPdf<{ storagePath: string }>(new URLSearchParams({ purpose: "material" }), file);
  return storagePath;
}

// Why each call cannot take this version now (null = eligible), shown before sending.
export async function checkEligibility(versionId: string, callIds: string[]): Promise<Eligibility[]> {
  const { data, error } = await supabase.rpc("submission_eligibility", { version_id: versionId, call_ids: callIds });
  if (error) throw error;
  return data as Eligibility[];
}

// Read only: the screen to edit the phone belongs to the profile work.
export async function getContact(): Promise<{ contact_email: string; phone: string | null }> {
  const { data, error } = await supabase.from("private_contacts").select("contact_email, phone").single();
  if (error) throw error;
  return data;
}
