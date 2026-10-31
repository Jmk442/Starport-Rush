// Live Boss Rush clock (combined time incl. undo penalties), ticking while a boss is being played.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getRush, totalMs, formatMs } from "@/src/game/bossRush";
import { fonts, makeStyles, radius } from "@/src/theme";

export function RushClock({ finalMs }: { finalMs?: number }) {
  const styles = useStyles();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, []);
  const run = getRush();
  return (
    <View style={styles.box}>
      <Text style={styles.time} testID="rush-clock">
        {finalMs !== undefined ? formatMs(finalMs) : run ? formatMs(totalMs(run)) : "--"}
      </Text>
      <Text style={styles.label}>{run?.undos ? `+${run.undos * 5}s undo` : "rush"}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 10, height: 44, minWidth: 72, justifyContent: "center", borderWidth: 1, borderColor: c.lavaAccent },
  time: { fontFamily: fonts.display, fontSize: 16, color: c.yellow, fontVariant: ["tabular-nums"] },
  label: { fontFamily: fonts.text, fontSize: 10, color: c.muted, marginTop: -2 },
}));
