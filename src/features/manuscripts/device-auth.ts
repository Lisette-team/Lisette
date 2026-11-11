import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

import i18n from "@/i18n";

export type PrivateActionResult = "confirmed" | "cancelled" | "unavailable";

// Confirms uploads and unlocks private manuscripts with the phone's own lock: biometrics, with the
// device PIN or password as fallback. It verifies an enrolled device credential, not who the writer
// is. Web and phones with no screen lock are "unavailable"; callers then go ahead (decided 2026-10-24).
// Reused by 05.3.
export async function confirmPrivateAction(): Promise<PrivateActionResult> {
  if (Platform.OS === "web") return "unavailable";
  if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) {
    return "unavailable";
  }
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: i18n.t("manuscripts.deviceAuthHint") });
  return result.success ? "confirmed" : "cancelled";
}
