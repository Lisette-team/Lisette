import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { colors } from "./theme";

// Four pages fanning out from the spine, as in the v6 loading screens (s-02, s-22, s-61). The pages
// light up one after another; with reduced motion the fan stays still.
const ANGLES = [15, 35, 55, 75];
const PAGE = "M0 0 L-9 -112 Q-8 -120 0 -121 L9 -120 Q14 -118 12 -110 Z";

export function FanLoader({ size = 120, label }: { size?: number; label: string }) {
  const [lit, setLit] = useState(ANGLES.length - 1);
  const [still, setStill] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => active && setStill(reduce))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setLit((n) => (n + 1) % (ANGLES.length + 1)), 350);
    return () => clearInterval(timer);
  }, [still]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="-20 -130 150 140"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <G>
        {ANGLES.map((angle, i) => (
          <Path key={angle} d={PAGE} rotation={angle} fill={i < lit ? colors.gold : colors.goldSoft} />
        ))}
      </G>
    </Svg>
  );
}
