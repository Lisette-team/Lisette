import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Literata_400Regular } from "@expo-google-fonts/literata/400Regular";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { Newsreader_600SemiBold } from "@expo-google-fonts/newsreader/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Platform } from "react-native";

import "@/i18n";
import { SessionProvider } from "@/features/account/session";
import { LaunchVideo } from "@/ui/launch-video";
import { colors } from "@/ui/theme";

// The launch video hides the native splash once its first frame is on screen.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Literata_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_600SemiBold,
  });
  // The launch clip is for the phone app only; web opens straight away.
  const [launching, setLaunching] = useState(Platform.OS !== "web");

  // A font failure falls back to system fonts rather than blocking the app.
  const ready = fontsLoaded || fontError;

  return (
    <>
      {ready && (
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
        </SessionProvider>
      )}
      {launching && <LaunchVideo onFinish={() => setLaunching(false)} />}
      <StatusBar style={launching ? "light" : "dark"} />
    </>
  );
}
