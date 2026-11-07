import type { GoalColor, PlayRound, RoomSnapshot, TransitionMode } from "./types";

export type GoalPlayView = {
  roundId: number;
  primaryColors: Record<string, GoalColor>;
  previousColors: Record<string, GoalColor>;
  deviceOffsets: Record<string, number>;
  transition: TransitionMode;
  roundStartedAt: number | null;
  nextChangeAt: number | null;
  usingPackage: boolean;
};

/** パッケージがあるときは端末時計で該当ラウンドを選ぶ */
export function resolvePlayView(snapshot: RoomSnapshot, estNow: number): GoalPlayView {
  const pkg = snapshot.playPackage;
  if (!pkg?.rounds.length || !snapshot.config.running) {
    return {
      roundId: snapshot.roundId,
      primaryColors: snapshot.primaryColors,
      previousColors: snapshot.previousColors,
      deviceOffsets: snapshot.deviceOffsets,
      transition: snapshot.transition,
      roundStartedAt: snapshot.roundStartedAt,
      nextChangeAt: snapshot.nextChangeAt,
      usingPackage: false,
    };
  }

  let round: PlayRound = pkg.rounds[0];
  for (const r of pkg.rounds) {
    if (r.roundStartedAt <= estNow) round = r;
    else break;
  }

  return {
    roundId: round.roundId,
    primaryColors: round.colors,
    previousColors: round.previousColors,
    deviceOffsets: round.deviceOffsets,
    transition: round.transition,
    roundStartedAt: round.roundStartedAt,
    nextChangeAt: round.nextChangeAt,
    usingPackage: true,
  };
}
