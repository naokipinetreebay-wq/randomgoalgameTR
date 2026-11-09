"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  buildLocalPlayPackage,
  buildManualOverlay,
  currentColorsFromSnapshot,
  idsFromSnapshot,
  overlayFromPackage,
  type HostOverlay,
} from "./localEngine";
import type { ClientMessage, GoalColor, RoomSnapshot } from "./types";

const CLOCK_MS = 3000;

export function useGoalLocalHost(
  snapshot: RoomSnapshot | null,
  send: (msg: ClientMessage) => void
) {
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingManual = useRef<Record<string, GoalColor> | null>(null);
  const overlayRef = useRef<HostOverlay | null>(null);

  const push = useCallback(
    (overlay: HostOverlay) => {
      overlayRef.current = overlay;
      send({ type: "hostPush", overlay });
    },
    [send]
  );

  useEffect(() => {
    return () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.config.running) return;
    const tick = () => {
      const prev = overlayRef.current;
      if (!prev) return;
      push({ ...prev, hostNow: Date.now() });
    };
    const id = setInterval(tick, CLOCK_MS);
    return () => clearInterval(id);
  }, [snapshot?.config.running, push]);

  const startLocal = useCallback(() => {
    if (!snapshot) return;
    send({ type: "start", local: true });
    const ids = idsFromSnapshot(snapshot);
    if (snapshot.config.timingMode === "manual") {
      const current = currentColorsFromSnapshot(snapshot);
      const overlay = buildManualOverlay(
        ids,
        snapshot.config,
        current,
        null,
        "reveal"
      );
      // manual: 開始時は現状維持、切替待ち
      push({
        ...overlay,
        primaryColors: current,
        previousColors: current,
        playPackage: null,
        nextChangeAt: null,
        manualCueEndsAt: null,
      });
      return;
    }
    const pkg = buildLocalPlayPackage(ids, snapshot.config);
    push(overlayFromPackage(pkg));
  }, [snapshot, send, push]);

  const stopLocal = useCallback(() => {
    if (manualTimer.current) clearTimeout(manualTimer.current);
    pendingManual.current = null;
    overlayRef.current = null;
    send({ type: "stop" });
  }, [send]);

  const nextLocal = useCallback(
    (colors?: Record<string, GoalColor>) => {
      if (!snapshot) return;
      const ids = idsFromSnapshot(snapshot);
      const current = currentColorsFromSnapshot(snapshot);

      if (snapshot.config.timingMode !== "manual") {
        // 自動中の「切り替え」= パッケージを組み直して配信
        const pkg = buildLocalPlayPackage(ids, snapshot.config, {
          previous: current,
        });
        push(overlayFromPackage(pkg));
        return;
      }

      if (manualTimer.current) clearTimeout(manualTimer.current);
      pendingManual.current = colors ?? null;

      if (snapshot.config.manualPreCountdown) {
        const cue = buildManualOverlay(
          ids,
          snapshot.config,
          current,
          pendingManual.current,
          "cue"
        );
        push(cue);
        manualTimer.current = setTimeout(() => {
          const reveal = buildManualOverlay(
            ids,
            snapshot.config,
            current,
            pendingManual.current,
            "reveal"
          );
          pendingManual.current = null;
          push(reveal);
        }, 3000);
        return;
      }

      const reveal = buildManualOverlay(
        ids,
        snapshot.config,
        current,
        pendingManual.current,
        "reveal"
      );
      pendingManual.current = null;
      push(reveal);
    },
    [snapshot, push]
  );

  return { startLocal, stopLocal, nextLocal };
}
