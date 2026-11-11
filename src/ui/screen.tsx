import { router } from "expo-router";
import type { ReactNode, Ref } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "./icon";
import { colors, contentMaxWidth, fonts, space } from "./theme";

type Props = {
  title?: string;
  backLabel?: string;
  // Shown at the right of the title, such as the Profile button.
  action?: ReactNode;
  children: ReactNode;
  // Actions stay pinned to the bottom of the column, as in the designs.
  footer?: ReactNode;
  // Lets a screen scroll itself, for example to a field at the bottom once the keyboard is open.
  scrollRef?: Ref<ScrollViewInstance>;
};

export function Screen({ title, backLabel, action, children, footer, scrollRef }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Android draws edge to edge, so the window no longer shrinks for the keyboard: make room here. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "web" ? undefined : "padding"}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
                    <Icon name="arrowLeft" color={colors.ink} size={28} />
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
      </KeyboardAvoidingView>
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
  fill: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center" },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: contentMaxWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
  body: { flex: 1, gap: space.md },
  footer: { gap: space.sm, paddingTop: space.xl },
  error: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.burgundy },
});
