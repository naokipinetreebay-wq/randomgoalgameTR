"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom } from "@/lib/ws";

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom();
      router.push(`/r/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <div className="home-card">
        <p className="eyebrow">Random Goal · TRwebapp</p>
        <h1>ランダムゴール</h1>
        <p>
          青・朱・黄のゴールが切り替わります。自分の色を狙う。無いときは守り抜く。
        </p>
        <div className="home-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={onCreate}>
            {busy ? "作成中…" : "ルームを作成"}
          </button>
          <a className="btn linkish" href="https://tr.rojiura.app">
            TRwebapp ポータルへ
          </a>
        </div>
        {error ? (
          <p className="muted" style={{ marginTop: 12, color: "var(--bad)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
