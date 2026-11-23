import { Platform } from "react-native";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export async function downloadSubmissionFile(versionId: string, submissionId: string, materialId?: string) {
 const { data } = await supabase.auth.getSession();
 const response = await fetch(`${supabaseUrl}/functions/v1/manuscript-file`, {
  method: "POST", headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" },
  body: JSON.stringify({ versionId, submissionId, materialId, purpose: "download" }),
 });
 if (!response.ok) throw new Error("download_failed");
 const blob = await response.blob();
 if (Platform.OS === "web") {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "manuscript.pdf"; link.click(); URL.revokeObjectURL(url); return;
 }
 const { StorageAccessFramework, EncodingType } = await import("expo-file-system/legacy");
 const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
 if (!permission.granted) return;
 const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(blob); });
 const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, "manuscript.pdf", "application/pdf");
 await StorageAccessFramework.writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
}
