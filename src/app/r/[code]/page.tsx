"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ControllerPanel } from "@/components/ControllerPanel";
import { SetupWizard } from "@/components/SetupWizard";
import { useDeviceId, useRoomSocket } from "@/lib/ws";

export default function ControllerPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const deviceId = useDeviceId(`controller-${code}`);
  const { snapshot, error, connected, send } = useRoomSocket(code, "controller", deviceId);
  const storageKey = `rg-wizard-done-${code}`;
  const [ready, setReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReady(sessionStorage.getItem(storageKey) === "1");
    setHydrated(true);
  }, [storageKey]);

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
        onDone={() => {
          sessionStorage.setItem(storageKey, "1");
          setReady(true);
        }}
      />
    );
  }

  return (
    <>
      <ControllerPanel snapshot={snapshot} connected={connected} send={send} />
      <div className="controller" style={{ paddingTop: 0 }}>
        <button
          type="button"
          className="btn linkish"
          onClick={() => {
            sessionStorage.removeItem(storageKey);
            setReady(false);
          }}
        >
          セットアップウィザードをやり直す
        </button>
      </div>
    </>
  );
}
