// Leaderboard name: "@handle (you)" plus the Champion Hat badge for last week's Weekly Cup winner.
import { type StyleProp, Text, type TextStyle, View } from "react-native";

import { Hat } from "@/src/components/game/Hat";
import { shownHandle } from "@/src/components/ReportSheet";
import { fonts, makeStyles } from "@/src/theme";

export function BoardHandle({
  handle,
  reported,
  isYou,
  champion,
  style,
  testID,
}: {
  handle: string;
  reported: string[];
  isYou: boolean;
  champion?: boolean;
  style: StyleProp<TextStyle>;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={[style, styles.name]} numberOfLines={1}>
        @{shownHandle(handle, reported)}
        {isYou ? " (you)" : ""}
      </Text>
      {champion && <ChampionBadge testID={testID} />}
    </View>
  );
}

export function ChampionBadge({ testID }: { testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.badge} testID={testID} accessibilityLabel="Weekly Cup Champion">
      <View style={styles.hat}>
        <Hat id="champion" size={22} />
      </View>
      <Text style={styles.badgeText}>CHAMP</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  badge: { flexDirection: "row", alignItems: "flex-end", gap: 2, flexShrink: 0 },
  hat: { height: 14, justifyContent: "flex-end" },
  badgeText: { fontFamily: fonts.display, fontSize: 9, letterSpacing: 1, color: c.yellow },
}));
