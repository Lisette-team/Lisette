import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Components rendered on their own need the provider the app's root layout gives them.
export function SafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      {children}
    </SafeAreaProvider>
  );
}
