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
import { colors, contentMaxWidth, fonts, gutter, space } from "./theme";

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
  // Pin actions for lists and multi-step flows that do not open the keyboard.
  pinFooter?: boolean;
};

export function Screen({ title, backLabel, action, children, footer, scrollRef, pinFooter = false }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Android draws edge to edge, so the window no longer shrinks for the keyboard: make room here. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "web" ? undefined : "padding"}>
        {title ? (
          <TopBar>
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
            <Text accessibilityRole="header" style={titleStyle}>{title}</Text>
            {action}
          </TopBar>
        ) : null}
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <View style={styles.body}>{children}</View>
            {footer && !pinFooter ? <View testID="screen-footer" style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
        {footer && pinFooter ? (
          <View testID="screen-footer" style={styles.pinned}>
            <View style={styles.pinnedColumn}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

export function TopBar({ children }: { children: ReactNode }) {
  return (
    <View testID="screen-header" style={styles.topBar}>
      <View style={styles.topBarColumn}>{children}</View>
    </View>
  );
}

export const titleStyle = { flex: 1, fontFamily: fonts.heading, fontSize: 28, color: colors.ink } as const;

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
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
  },
  topBar: { alignItems: "center", backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  topBarColumn: { width: "100%", maxWidth: contentMaxWidth, minHeight: 56, paddingHorizontal: gutter, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  body: { flex: 1, gap: space.md },
  footer: { gap: space.sm, paddingTop: space.xl },
  pinned: {
    alignItems: "center",
    paddingTop: space.md,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  pinnedColumn: { width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: gutter, gap: space.sm },
  error: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.burgundy },
});
