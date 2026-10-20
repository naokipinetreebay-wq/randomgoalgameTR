"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ControllerPanel } from "@/components/ControllerPanel";
import type { ControllerRoleMode } from "@/components/ControllerRoleChoice";
import { DisplayScreen } from "@/components/DisplayScreen";
import { SetupWizard } from "@/components/SetupWizard";
import { useDeviceId, useRoomSocket } from "@/lib/ws";

export default function ControllerPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const deviceId = useDeviceId(`controller-${code}`);
  const displayId = useDeviceId(`controller-as-display-${code}`);
  const { snapshot, error, connected, send } = useRoomSocket(code, "controller", deviceId);

  const wizardKey = `rg-wizard-done-${code}`;
  const roleKey = `rg-ctrl-role-${code}`;
  const [ready, setReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [roleMode, setRoleMode] = useState<ControllerRoleMode | null>(null);
  const [view, setView] = useState<"control" | "display">("control");

  const alsoDisplay = roleMode === "alsoDisplay";
  const displaySock = useRoomSocket(
    code,
    "display",
    alsoDisplay && ready ? displayId : ""
  );

  useEffect(() => {
    const done = sessionStorage.getItem(wizardKey) === "1";
    const role = sessionStorage.getItem(roleKey) as ControllerRoleMode | null;
    setReady(done);
    if (role === "controlOnly" || role === "alsoDisplay") setRoleMode(role);
    setHydrated(true);
  }, [wizardKey, roleKey]);

  useEffect(() => {
    if (!alsoDisplay || !displayId || !ready) return;
    const t = setTimeout(() => {
      send({ type: "setLabel", deviceId: displayId, label: "コントローラ" });
    }, 800);
    return () => clearTimeout(t);
  }, [alsoDisplay, displayId, ready, send]);

  if (error && !snapshot) {
    return (
      <main className="error-page">
        <div>
          <h1>接続できません</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!snapshot || !hydrated) {
    return (
      <main className="error-page">
        <p>ルームに接続中…</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <SetupWizard
        snapshot={snapshot}
        connected={connected}
        send={send}
        roleMode={roleMode}
        onRoleModeChange={(mode) => {
          setRoleMode(mode);
          sessionStorage.setItem(roleKey, mode);
        }}
        onDone={() => {
          sessionStorage.setItem(wizardKey, "1");
          if (roleMode) sessionStorage.setItem(roleKey, roleMode);
          setReady(true);
          setView(roleMode === "alsoDisplay" ? "display" : "control");
        }}
      />
    );
  }

  if (alsoDisplay && view === "display" && displaySock.snapshot && displayId) {
    return (
      <div className="ctrl-display-shell">
        <DisplayScreen snapshot={displaySock.snapshot} deviceId={displayId} />
        <button type="button" className="ctrl-return-bar" onClick={() => setView("control")}>
          コントローラに戻る
        </button>
      </div>
    );
  }

  return (
    <>
      <ControllerPanel snapshot={snapshot} connected={connected} send={send} />
      <div className="controller" style={{ paddingTop: 0, gap: 10 }}>
        {alsoDisplay ? (
          <button type="button" className="btn primary" onClick={() => setView("display")}>
            色表示に切替（この端末）
          </button>
        ) : null}
        <button
          type="button"
          className="btn linkish"
          onClick={() => {
            sessionStorage.removeItem(wizardKey);
            setReady(false);
            setView("control");
          }}
        >
          セットアップウィザードをやり直す
        </button>
      </div>
    </>
  );
}
