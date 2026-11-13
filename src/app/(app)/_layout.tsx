import { Redirect, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useSessionContext } from "@/features/account/session";
import { SideNav } from "@/features/account/side-nav";
import { ReactionPickerProvider } from "@/features/community/reaction-picker";
import { useWide } from "@/ui/layout";
import { colors } from "@/ui/theme";

// Private area. This guard is navigation only: the server's row-level
// policies are what actually protect private data.
// On wide screens the sidebar sits beside every private screen, tabs or not (v6 web screens).
export default function AppLayout() {
  const { state } = useSessionContext();
  const wide = useWide();

  if (state.status === "loading") return null;
  if (state.status === "signedOut") return <Redirect href="/" />;

  return (
    <ReactionPickerProvider>
      <View style={styles.row}>
        {wide ? <SideNav /> : null}
        <View style={styles.main}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </ReactionPickerProvider>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", backgroundColor: colors.paper },
  main: { flex: 1, minWidth: 0 },
});
