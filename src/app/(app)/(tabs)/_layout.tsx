import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ColorValue } from "react-native";

import { useSession } from "@/features/account/session";
import { Icon, type IconName } from "@/ui/icon";
import { useWide } from "@/ui/layout";
import { InTabsContext } from "@/ui/screen";
import { TabBar } from "@/ui/tab-bar";

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} color={color} />;
  };

// The phone menu (docs/product/screens.md section 2). Readers get Profile; once the writer
// profile is added from Profile, Manuscripts takes its place. Publications get Calls instead of
// Library and Manuscripts.
export default function TabsLayout() {
  const { t } = useTranslation();
  const session = useSession();
  const wide = useWide();
  const hidden =
    session?.kind === "publisher"
      ? ["library", "manuscripts", "profile"]
      : session?.authorEnabled
        ? ["calls", "profile", "submissions"]
        : ["calls", "manuscripts", "submissions"];

  return (
    <InTabsContext.Provider value>
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => (wide ? null : <TabBar {...props} hidden={hidden} />)}>
      <Tabs.Screen name="home" options={{ title: t("nav.home"), tabBarIcon: icon("home") }} />
      <Tabs.Screen name="discover" options={{ title: t("nav.discover"), tabBarIcon: icon("compass") }} />
      <Tabs.Screen name="create" options={{ title: t("nav.create") }} />
      <Tabs.Screen name="library" options={{ title: t("nav.library"), tabBarIcon: icon("library") }} />
      <Tabs.Screen name="manuscripts" options={{ title: t("nav.manuscripts"), tabBarIcon: icon("manuscript") }} />
      <Tabs.Screen name="calls" options={{ title: t("nav.calls"), tabBarIcon: icon("calendar") }} />
      <Tabs.Screen name="submissions" options={{ title: t("nav.submissions"), tabBarIcon: icon("send") }} />
      <Tabs.Screen name="profile" options={{ title: t("nav.profile"), tabBarIcon: icon("user") }} />
    </Tabs>
    </InTabsContext.Provider>
  );
}
