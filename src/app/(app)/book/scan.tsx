import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { lookupIsbn } from "@/features/library/api";
import { classifyBarcode } from "@/features/library/isbn";
import { createScanGate } from "@/features/library/scan-gate";
import { Button } from "@/ui/button";
import { FanLoader } from "@/ui/fan-loader";
import { Icon } from "@/ui/icon";
import { Screen } from "@/ui/screen";
import { colors, fonts, radius, space } from "@/ui/theme";

const THOUGHTFUL = require("../../../../assets/illustrations/semn-ganduri.svg");

// failed: a book code that could not be read; notBook: a readable product code that is not an ISBN.
type Phase = "scanning" | "failed" | "notBook" | "looking";

// Books carry EAN-13; the other product formats are read too, so the scanner can say it is not a book.
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

// S-61: ISBN scanner. Android camera only; the web adds books by hand.
export default function Scan() {
  if (Platform.OS === "web") return <Redirect href="/book/add" />;
  return <Scanner />;
}

function Scanner() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const gate = useRef(createScanGate()).current;
  const asked = useRef(false);
  // Set when the screen goes away, so a lookup that ends later does not navigate anywhere.
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [isbn, setIsbn] = useState("");

  // Ask once when the person has not decided yet; after a refusal, the screen offers manual entry.
  useEffect(() => {
    if (permission?.status === "undetermined" && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission().catch(() => undefined);
    }
  }, [permission, requestPermission]);

  const addByHand = () => router.replace("/book/add");

  function onScanned({ data }: BarcodeScanningResult) {
    // The camera reports the same code many times a second: only the first one counts.
    if (!gate.accept(data)) return;
    const read = classifyBarcode(data);
    if (read.kind !== "isbn") {
      setPhase(read.kind === "not_isbn" ? "notBook" : "failed");
      return;
    }
    const code = read.isbn;
    setIsbn(code);
    setPhase("looking");
    lookupIsbn(code).then((result) => {
      if (left.current) return;
      if (result.status === "found") {
        router.replace({ pathname: "/book/add", params: { workId: result.work.id } });
      } else {
        // Unknown or unavailable: manual add with the ISBN filled in and no title made up.
        router.replace({ pathname: "/book/add", params: { isbn: code, reason: result.status } });
      }
    });
  }

  function retry() {
    gate.reset();
    setPhase("scanning");
  }

  if (phase === "looking") {
    return (
      <Screen title={t("library.scan")} backLabel={t("common.back")}>
        <View style={styles.center}>
          <FanLoader label={t("library.lookingUp")} />
          <Text style={styles.centerTitle}>{t("library.lookingUp")}</Text>
          <Text style={styles.muted}>{isbn}</Text>
        </View>
      </Screen>
    );
  }

  if (!permission) return <Screen title={t("library.scan")} backLabel={t("common.back")}>{null}</Screen>;

  if (!permission.granted) {
    const undecided = permission.status === "undetermined";
    return (
      <Screen
        title={t("library.scan")}
        backLabel={t("common.back")}
        footer={
          undecided ? null : (
            <>
              <Button
                label={t("library.allowCamera")}
                onPress={() =>
                  permission.canAskAgain ? requestPermission().catch(() => undefined) : Linking.openSettings()
                }
              />
              <Button label={t("library.addByHand")} variant="link" onPress={addByHand} />
            </>
          )
        }
      >
        {undecided ? null : (
          <View style={styles.center}>
            <Image source={THOUGHTFUL} style={styles.art} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={styles.centerTitle}>{t("library.cameraOffTitle")}</Text>
            <Text style={styles.centerBody}>{t("library.cameraOffBody")}</Text>
          </View>
        )}
      </Screen>
    );
  }

  const failed = phase === "failed" || phase === "notBook";
  return (
    <Screen
      title={t("library.scan")}
      backLabel={t("common.back")}
      footer={
        failed ? (
          <>
            <Button label={t("common.retry")} onPress={retry} />
            <Button label={t("library.addByHand")} variant="link" onPress={addByHand} />
          </>
        ) : (
          <Button label={t("library.addByHand")} variant="secondary" onPress={addByHand} />
        )
      }
    >
      {failed ? (
        <View style={styles.failed} accessibilityRole="alert">
          <Icon name="alert" color={colors.burgundy} size={24} />
          <Text style={styles.failedText}>{t(phase === "notBook" ? "library.notBookBarcode" : "library.scanFailed")}</Text>
        </View>
      ) : null}
      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={onScanned}
        />
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
      {failed ? null : (
        <>
          <Text style={styles.hint}>{t("library.scanHint")}</Text>
          <Text style={styles.muted}>{t("library.scanSteady")}</Text>
        </>
      )}
    </Screen>
  );
}

const CORNER = 40;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xl },
  art: { width: 140, height: 140 },
  centerTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: "center" },
  centerBody: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.inkMuted, textAlign: "center" },
  muted: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  hint: { fontFamily: fonts.ui, fontSize: 18, lineHeight: 26, color: colors.ink },
  failed: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderWidth: 2,
    borderColor: colors.burgundy,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  failedText: { flex: 1, fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink },
  viewfinder: {
    width: "100%",
    aspectRatio: 0.84,
    maxHeight: 520,
    borderRadius: radius.sheet,
    overflow: "hidden",
    backgroundColor: colors.ink,
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.gold },
  topLeft: { top: "25%", left: "10%", borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: "25%", right: "10%", borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: "25%", left: "10%", borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: "25%", right: "10%", borderBottomWidth: 4, borderRightWidth: 4 },
});
