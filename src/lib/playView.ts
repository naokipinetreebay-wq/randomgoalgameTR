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

  const first = pkg.rounds[0];
  const last = pkg.rounds[pkg.rounds.length - 1];
  const span = Math.max(1, last.nextChangeAt - first.roundStartedAt);
  let t = estNow;
  if (estNow > last.nextChangeAt) {
    const elapsed = estNow - first.roundStartedAt;
    t = first.roundStartedAt + (elapsed % span);
  }

  let round: PlayRound = first;
  for (const r of pkg.rounds) {
    if (r.roundStartedAt <= t) round = r;
    else break;
  }

  const loopOffset =
    estNow > last.nextChangeAt
      ? Math.floor((estNow - first.roundStartedAt) / span) * span
      : 0;

  return {
    roundId: round.roundId,
    primaryColors: round.colors,
    previousColors: round.previousColors,
    deviceOffsets: round.deviceOffsets,
    transition: round.transition,
    roundStartedAt: round.roundStartedAt + loopOffset,
    nextChangeAt: round.nextChangeAt + loopOffset,
    usingPackage: true,
  };
}
