import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { accountName } from "@/features/community/api";
import { Icon, type IconName } from "@/ui/icon";
import { colors, fonts } from "@/ui/theme";

import { useSession } from "./session";

type Item = { name: string; href: "/home" | "/discover" | "/library" | "/manuscripts" | "/profile"; icon: IconName };

const ITEMS: Item[] = [
  { name: "home", href: "/home", icon: "home" },
  { name: "discover", href: "/discover", icon: "compass" },
  { name: "library", href: "/library", icon: "library" },
  { name: "manuscripts", href: "/manuscripts", icon: "manuscript" },
  { name: "profile", href: "/profile", icon: "user" },
];

// Screens outside the tabs belong to the menu entry they were opened from. The composer (/create)
// belongs to none, so nothing is highlighted there.
const SECTION: Record<string, string> = {
  book: "library",
  post: "home",
  reader: "manuscripts",
  settings: "profile",
  role: "profile",
};

// The gold sparkle cluster at the right of the active entry (s-20, s-28, s-60 web), in a 28×28 box.
const SPARKLES = [
  [16, 7, 6.5],
  [5, 12, 2.4],
  [24, 18, 1.8],
  [12, 23, 1.8],
] as const;
const star = ([x, y, r]: readonly number[]) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// The left sidebar of the v6 web screens, measured from s-20/s-28/s-60 web at 1440×900: a 248 px
// panel paler than the page, the wordmark and account name at top left, then the menu every 52 px.
// The active entry is burgundy with the sparkles; there is no background or pill and nothing else.
// It replaces the bottom bar on wide screens; writers get Manuscripts, readers do not.
export function SideNav() {
  const { t } = useTranslation();
  const session = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const userId = session?.userId ?? "";

  useEffect(() => {
    let active = true;
    if (userId) {
      accountName(userId)
        .then((value) => active && setName(value))
        .catch((error: unknown) => {
          // The sidebar still works without the name; leave it out and say why in the logs.
          console.warn("side-nav: account name unavailable", error);
          if (active) setName("");
        });
    }
    return () => {
      active = false;
    };
  }, [userId]);

  const first = pathname.split("/").filter(Boolean)[0] ?? "home";
  const current = SECTION[first] ?? first;
  const items = ITEMS.filter((item) => item.name !== "manuscripts" || session?.authorEnabled);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 36, paddingLeft: insets.left + 16 }]}>
      <Text style={styles.wordmark}>Lisette</Text>
      {name ? (
        <Text style={styles.account} numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <View style={styles.accountSpace} />
      )}
      <View style={styles.items}>
        {items.map((item) => {
          const focused = current === item.name;
          const tint = focused ? colors.burgundy : colors.inkMuted;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityLabel={t(`nav.${item.name}`)}
              accessibilityState={{ selected: focused }}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Icon name={item.icon} color={tint} size={20} />
              <Text style={[styles.label, { color: tint }]}>{t(`nav.${item.name}`)}</Text>
              {focused ? (
                <Svg width={28} height={28} viewBox="0 0 28 28" pointerEvents="none">
                  {SPARKLES.map((sparkle) => (
                    <Path key={sparkle.join()} d={star(sparkle)} fill={colors.gold} />
                  ))}
                </Svg>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: 248, paddingRight: 32, backgroundColor: colors.surface },
  wordmark: { marginTop: 2, fontFamily: fonts.heading, fontSize: 19, lineHeight: 26, color: colors.ink },
  account: { marginTop: 4, fontFamily: fonts.ui, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  accountSpace: { height: 22 },
  // First entry centred 131 px from the top, then every 52 px, as in the designs.
  items: { marginTop: 21 },
  item: { flexDirection: "row", alignItems: "center", height: 52, paddingLeft: 14, gap: 10 },
  pressed: { opacity: 0.6 },
  label: { flex: 1, fontFamily: fonts.ui, fontSize: 15 },
});
