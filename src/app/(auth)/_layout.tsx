import { Redirect, Stack, usePathname } from "expo-router";

import { useSessionContext } from "@/features/account/session";

export default function AuthLayout() {
  const { state } = useSessionContext();
  const pathname = usePathname();

  if (state.status === "loading") return null;
  if (state.status === "signedIn") return <Redirect href="/home" />;
  // Every account screen needs a chosen language first.
  if (state.locale === null && pathname !== "/") return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
