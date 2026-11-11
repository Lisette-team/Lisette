import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, contentMaxWidth, fonts, space } from "./theme";

type Props = {
  title?: string;
  backLabel?: string;
  // Shown at the right of the title, such as the Profile button.
  action?: ReactNode;
  children: ReactNode;
  // Actions stay pinned to the bottom of the column, as in the designs.
  footer?: ReactNode;
};

export function Screen({ title, backLabel, action, children, footer }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {title ? (
            <View style={styles.header}>
              {backLabel && router.canGoBack() ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={backLabel}
                  hitSlop={12}
                  onPress={() => router.back()}
                >
                  <Text style={styles.back}>←</Text>
                </Pressable>
              ) : null}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {action}
            </View>
          ) : null}
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, alignItems: "center" },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: contentMaxWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
  back: { fontSize: 28, color: colors.ink },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
  body: { flex: 1, gap: space.md },
  footer: { gap: space.sm, paddingTop: space.xl },
  error: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.burgundy },
});
