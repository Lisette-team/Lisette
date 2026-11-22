import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/ui/icon";
import { sectionHeading } from "@/ui/section-heading";
import { colors, radius, space } from "@/ui/theme";

import type { PreparedImage } from "./api";

// The post composer's image picker, shared with the fragment composer: tap a photo (it carries an ×) to remove it.
export function ImageTiles({ images, max, onAdd, onRemove }: { images: PreparedImage[]; max: number; onAdd(): void; onRemove(image: PreparedImage): void }) {
  const { t } = useTranslation();
  return (
    <>
      <Text accessibilityRole="header" style={styles.section}>{t(max === 1 ? "community.image" : "community.images")}</Text>
      <View style={styles.tiles}>
        {images.map((image) => (
          <Pressable key={image.uri} accessibilityRole="button" accessibilityLabel={t("community.removeImage")} onPress={() => onRemove(image)}>
            <Image source={{ uri: image.uri }} style={styles.tile} contentFit="cover" />
            <View style={styles.remove}><Icon name="close" color={colors.onBurgundy} size={14} /></View>
          </Pressable>
        ))}
        {images.length < max ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("community.addImage")} onPress={onAdd} style={[styles.tile, styles.addTile]}>
            <Icon name="plus" color={colors.ink} size={28} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: sectionHeading,
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: 88, height: 88, borderRadius: radius.card, backgroundColor: colors.surfaceMuted },
  remove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  addTile: { alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line },
});
