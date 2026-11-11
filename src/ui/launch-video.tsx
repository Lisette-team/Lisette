import { useEvent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";

import { colors } from "@/ui/theme";

const launchVideo = require("../../assets/brand/lisette-splash.mp4");

// The clip runs 3.2 s; past this the overlay closes even if playback stalls.
const fallbackMs = 6000;
const fadeMs = 300;

type Props = { onFinish: () => void };

// Plays the brand clip once over the app at launch on Android and iOS, then fades away.
// The native splash shares the clip's night burgundy, so the hand-off is seamless.
export function LaunchVideo({ onFinish }: Props) {
  const [opacity] = useState(() => new Animated.Value(1));
  const finished = useRef(false);
  const [started, setStarted] = useState(false);

  const player = useVideoPlayer(launchVideo, (p) => {
    p.muted = true;
    p.loop = false;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });

  function finish() {
    if (finished.current) return;
    finished.current = true;
    SplashScreen.hide();
    Animated.timing(opacity, { toValue: 0, duration: fadeMs, useNativeDriver: true }).start(() => onFinish());
  }

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) finish();
      else setStarted(true);
    });
    const timer = setTimeout(finish, fallbackMs);
    const ended = player.addListener("playToEnd", finish);
    return () => {
      active = false;
      clearTimeout(timer);
      ended.remove();
    };
    // finish only reads refs and stable values; run once per player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  useEffect(() => {
    if (status === "error") finish();
    else if (started && status === "readyToPlay") player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, started, player]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} testID="launch-video">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => SplashScreen.hide()}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.nightBurgundy, zIndex: 10 },
});
