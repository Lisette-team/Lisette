import { ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { colors } from "@/ui/theme";

import { useReaderHtml, type ReaderMessage } from "./reader-html";

type Props = { versionId: string; onMessage(message: ReaderMessage): void };

// Android: PDF.js in a WebView (works in Expo Go). Incognito with the cache off, so closing the
// reader leaves no copy behind; the parent unmounts it on lock and logout.
export function PdfReader({ versionId, onMessage }: Props) {
  const html = useReaderHtml(versionId);
  if (!html) return <ActivityIndicator color={colors.burgundy} />;
  return (
    <WebView
      source={{ html }}
      originWhitelist={["*"]}
      incognito
      cacheEnabled={false}
      setSupportMultipleWindows={false}
      onMessage={(event) => onMessage(JSON.parse(event.nativeEvent.data))}
      style={styles.reader}
    />
  );
}

const styles = StyleSheet.create({ reader: { flex: 1, backgroundColor: colors.paper } });
