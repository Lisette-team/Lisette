import { Redirect, Stack } from "expo-router";

import { useSessionContext } from "@/features/account/session";

// Private area. This guard is navigation only: the server's row-level
// policies are what actually protect private data.
export default function AppLayout() {
  const { state } = useSessionContext();

  if (state.status === "loading") return null;
  if (state.status === "signedOut") return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
