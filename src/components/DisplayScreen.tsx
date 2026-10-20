"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, GoalColor, RoomSnapshot, TransitionMode } from "@/lib/types";

function countdownDigit(remainingMs: number, maxSec: number): number {
  if (remainingMs <= 0) return 1;
  const raw = Math.ceil(remainingMs / 1000);
  return Math.min(maxSec, Math.max(1, raw));
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
  const [now, setNow] = useState(() => Date.now());

  const phaseRef = useRef({
    roundId: -1,
    leadEnd: 0,
    blackEnd: 0,
    offset: 0,
    lastDigit: 3,
  });

  if (snapshot.roundId !== phaseRef.current.roundId) {
    phaseRef.current = {
      roundId: snapshot.roundId,
      leadEnd: snapshot.transitionEndsAt ?? Date.now(),
      blackEnd: snapshot.blackEndsAt ?? snapshot.transitionEndsAt ?? Date.now(),
      offset: snapshot.serverNow ? Date.now() - snapshot.serverNow : 0,
      lastDigit: 3,
    };
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
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

  const serverNow = now - phaseRef.current.offset;
  const effect = useTransitionEffect(
    snapshot.transition,
    phaseRef.current.leadEnd,
    phaseRef.current.blackEnd,
    serverNow,
    prev,
    next,
    phaseRef
  );

  return (
    <div className="display-root" style={effect.style}>
      {effect.overlay}
    </div>
  );
}

function useTransitionEffect(
  transition: TransitionMode,
  leadEnd: number,
  blackEnd: number,
  serverNow: number,
  prev: GoalColor,
  next: GoalColor,
  phaseRef: React.MutableRefObject<{ lastDigit: number }>
) {
  return useMemo(() => {
    const colorChanged = prev !== next;

    if (serverNow >= blackEnd) {
      phaseRef.current.lastDigit = 3;
      return {
        style: { background: COLORS[next] } as React.CSSProperties,
        overlay: null as React.ReactNode,
      };
    }

    if (serverNow >= leadEnd) {
      if (!colorChanged) {
        return { style: { background: COLORS[next] }, overlay: null };
      }
      return { style: { background: "#000000" }, overlay: null };
    }

    const remaining = Math.max(0, leadEnd - serverNow);
    const fadeProgress = 1 - remaining / 1200;
    const base: React.CSSProperties = { background: COLORS[prev] };

    if (transition === "countdown") {
      let digit = countdownDigit(remaining, 3);
      if (digit > phaseRef.current.lastDigit) {
        digit = phaseRef.current.lastDigit;
      } else {
        phaseRef.current.lastDigit = digit;
      }
      return {
        style: base,
        overlay: <div className="countdown-num">{digit}</div>,
      };
    }

    if (transition === "blink") {
      const on = Math.floor(serverNow / 220) % 2 === 0;
      return {
        style: on ? base : { background: "#111111" },
        overlay: null,
      };
    }

    if (transition === "fade") {
      return {
        style: {
          ...base,
          opacity: Math.max(0.2, 1 - Math.min(1, fadeProgress)),
        },
        overlay: null,
      };
    }

    if (colorChanged) {
      return { style: { background: "#000000" }, overlay: null };
    }
    return { style: { background: COLORS[next] }, overlay: null };
  }, [transition, leadEnd, blackEnd, serverNow, prev, next, phaseRef]);
}
