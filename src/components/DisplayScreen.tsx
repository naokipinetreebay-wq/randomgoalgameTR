"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, GoalColor, RoomSnapshot, TransitionMode } from "@/lib/types";

const COUNTDOWN_MS = 3000;
const BLACK_MS = 280;

function digitForElapsed(elapsedMs: number): number {
  if (elapsedMs < 1000) return 3;
  if (elapsedMs < 2000) return 2;
  return 1;
}

export function DisplayScreen({
  snapshot,
  deviceId,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
}) {
  const next: GoalColor = snapshot.primaryColors[deviceId] || "blue";
  const prev: GoalColor = snapshot.previousColors?.[deviceId] ?? next;
  const colorChanged = prev !== next;

  const phaseRef = useRef({
    roundId: -1,
    localStart: 0,
    transition: "instant" as TransitionMode,
  });

  if (snapshot.roundId !== phaseRef.current.roundId) {
    phaseRef.current = {
      roundId: snapshot.roundId,
      localStart: Date.now(),
      transition: snapshot.transition,
    };
  }

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wake = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* ignore */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wake?.release().catch(() => undefined);
    };
  }, []);

  const { localStart, transition } = phaseRef.current;
  const elapsed = Math.max(0, Date.now() - localStart);

  const leadMs =
    transition === "countdown"
      ? COUNTDOWN_MS
      : transition === "blink"
        ? 1600
        : transition === "fade"
          ? 1200
          : 0;
  const blackEnd = leadMs + (colorChanged ? BLACK_MS : 0);

  let style: React.CSSProperties = { background: COLORS[next] };
  let overlay: React.ReactNode = null;

  if (elapsed < leadMs) {
    style = { background: COLORS[prev] };
    if (transition === "countdown") {
      overlay = <div className="countdown-num">{digitForElapsed(elapsed)}</div>;
    } else if (transition === "blink") {
      const on = Math.floor(elapsed / 220) % 2 === 0;
      style = on ? { background: COLORS[prev] } : { background: "#111111" };
    } else if (transition === "fade") {
      style = {
        background: COLORS[prev],
        opacity: Math.max(0.2, 1 - elapsed / leadMs),
      };
    }
  } else if (elapsed < blackEnd && colorChanged) {
    style = { background: "#000000" };
  } else {
    style = { background: COLORS[next] };
  }

  return (
    <div className="display-root" style={style}>
      {overlay}
    </div>
  );
}
