import { Text, View } from "react-native";

import { YardShip } from "@/src/components/game/YardShip";
import type { BlockedFx } from "@/src/game/useGameSession";
import type { GameState } from "@/src/game/types";
import { fonts, makeStyles, radius } from "@/src/theme";

interface Props {
  state: GameState;
  cell: number;
  hintId: string | null;
  blocked: BlockedFx | null;
  onTap: (id: string) => void;
}

export function LaunchYard({ state, cell, hintId, blocked, onTap }: Props) {
  const styles = useStyles();
  const { width, height } = state.board;
  return (
    <View testID="launch-yard" style={styles.frame}>
      <Text style={styles.label}>LAUNCH YARD</Text>
      <View style={[styles.board, { width: width * cell, height: height * cell }]}>
        {Array.from({ length: width * height }, (_, i) => (
          <View key={i} style={[styles.cell, { left: (i % width) * cell, top: Math.floor(i / width) * cell, width: cell, height: cell }]}>
            <View style={styles.cellInner} />
          </View>
        ))}
        {state.ships.map((s) => (
          <YardShip
            key={s.id}
            ship={s}
            cell={cell}
            hinted={hintId === s.id}
            bumpKey={blocked?.shipId === s.id ? blocked.n : 0}
            flashKey={blocked?.blockerId === s.id ? blocked.n : 0}
            onPress={onTap}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: { alignItems: "center", justifyContent: "center", flex: 1 },
  label: { fontFamily: fonts.display, color: c.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  board: {
    backgroundColor: c.yardFloor,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cell: { position: "absolute", padding: 2 },
  cellInner: { flex: 1, borderRadius: radius.sm, backgroundColor: c.yardCell, borderWidth: 1, borderColor: c.divider },
}));
