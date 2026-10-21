"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { SessionExit } from "@/components/SessionExit";
import type { ClientMessage, ColorCountConfig, GoalColor, RoomConfig, RoomSnapshot } from "@/lib/types";
import { COLOR_LABELS, COLORS } from "@/lib/types";

function ColorCountEditor({
  color,
  cfg,
  onChange,
}: {
  color: GoalColor;
  cfg: ColorCountConfig;
  onChange: (next: ColorCountConfig) => void;
}) {
  return (
    <div className="color-block">
      <div className="color-title">
        <span className="swatch" style={{ background: COLORS[color] }} />
        {COLOR_LABELS[color]}
      </div>
      <label className="field">
        <span>台数モード</span>
        <select
          value={cfg.mode}
          onChange={(e) => onChange({ ...cfg, mode: e.target.value as ColorCountConfig["mode"] })}
        >
          <option value="fixed">固定</option>
          <option value="random">ランダム</option>
        </select>
      </label>
      {cfg.mode === "fixed" ? (
        <label className="field">
          <span>固定台数: {cfg.fixed}</span>
          <input
            type="range"
            min={0}
            max={12}
            value={cfg.fixed}
            onChange={(e) => onChange({ ...cfg, fixed: Number(e.target.value) })}
          />
        </label>
      ) : (
        <div className="row">
          <label className="field">
            <span>最小 {cfg.min}</span>
            <input
              type="range"
              min={0}
              max={12}
              value={cfg.min}
              onChange={(e) => onChange({ ...cfg, min: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>最大 {cfg.max}</span>
            <input
              type="range"
              min={0}
              max={12}
              value={cfg.max}
              onChange={(e) => onChange({ ...cfg, max: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function ControllerPanel({
  snapshot,
  connected,
  send,
  clearSessionKeys,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  clearSessionKeys?: string[];
}) {
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  const colors: GoalColor[] =
    cfg.colorCount === 2 ? ["blue", "vermilion"] : ["blue", "vermilion", "yellow"];

  return (
    <div className="controller">
      <header className="controller-header">
        <div>
          <p className="eyebrow">Random Goal Game</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "接続中" : "再接続中…"}
        </div>
      </header>

      <section className="panel counts-live">
        <h2>今ラウンドの色別台数</h2>
        <div className="count-chips">
          {colors.map((c) => (
            <div key={c} className="count-chip" style={{ borderColor: COLORS[c] }}>
              <span className="swatch" style={{ background: COLORS[c] }} />
              {COLOR_LABELS[c]} × {snapshot.colorCounts[c] ?? 0}
            </div>
          ))}
        </div>
        <p className="muted">自分の色が0台のチームは守り時間です。</p>
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>ゴール端末</h2>
          <p className="muted">台数: {snapshot.displays.length}</p>
          <div className="qr-wrap">
            {displayUrl ? <QRCodeSVG value={displayUrl} size={160} /> : null}
          </div>
          <p className="mono url">{displayUrl}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigator.clipboard.writeText(displayUrl)}
          >
            URLをコピー
          </button>
        </div>

        <div className="panel">
          <h2>操作</h2>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => send({ type: "start" })}>
              開始
            </button>
            <button type="button" className="btn" onClick={() => send({ type: "next" })}>
              次へ
            </button>
            <button type="button" className="btn danger" onClick={() => send({ type: "stop" })}>
              一時停止
            </button>
          </div>
          <p className="muted">
            状態: {cfg.running ? "ランニング" : "停止"} / ラウンド #{snapshot.roundId}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>色の割当</h2>
        <label className="field">
          <span>色数</span>
          <select
            value={cfg.colorCount}
            onChange={(e) => patch({ colorCount: Number(e.target.value) as 2 | 3 })}
          >
            <option value={2}>2色（緑・赤）</option>
            <option value={3}>3色（緑・赤・黄）</option>
          </select>
        </label>
        {colors.map((c) => (
          <ColorCountEditor
            key={c}
            color={c}
            cfg={cfg[c]}
            onChange={(next) => patch({ [c]: next } as Partial<RoomConfig>)}
          />
        ))}
        <p className="muted">合計がゴール台数になるようサーバ側で自動調整します。</p>
      </section>

      <section className="panel">
        <h2>タイミング</h2>
        <label className="field">
          <span>切替</span>
          <select
            value={cfg.timingMode}
            onChange={(e) =>
              patch({ timingMode: e.target.value as RoomConfig["timingMode"] })
            }
          >
            <option value="fixed">固定秒</option>
            <option value="random">ランダム秒</option>
            <option value="manual">手動のみ（次へで切替）</option>
          </select>
        </label>
        {cfg.timingMode === "manual" ? (
          <p className="muted">手動中は自動では切り替わりません。「次へ」で進めてください。</p>
        ) : null}
        {cfg.timingMode === "fixed" ? (
          <label className="field">
            <span>秒数: {cfg.fixedSeconds}</span>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={cfg.fixedSeconds}
              onChange={(e) => patch({ fixedSeconds: Number(e.target.value) })}
            />
          </label>
        ) : null}
        {cfg.timingMode === "random" ? (
          <div className="row">
            <label className="field">
              <span>最小 {cfg.randomMinSeconds}s</span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={cfg.randomMinSeconds}
                onChange={(e) => patch({ randomMinSeconds: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>最大 {cfg.randomMaxSeconds}s</span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={cfg.randomMaxSeconds}
                onChange={(e) => patch({ randomMaxSeconds: Number(e.target.value) })}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>遷移</h2>
        <label className="field">
          <span>演出</span>
          <select
            value={cfg.transition}
            onChange={(e) =>
              patch({ transition: e.target.value as RoomConfig["transition"] })
            }
          >
            <option value="instant">即時</option>
            <option value="countdown">カウントダウン（残り秒）</option>
            <option value="blink">点滅（後半＝残り半分）</option>
            <option value="fade">フェード（表示直後から）</option>
            <option value="random">毎回ランダム</option>
          </select>
        </label>
        <label className="field">
          <span>端末どうしの切替</span>
          <select
            value={cfg.syncMode || "simultaneous"}
            onChange={(e) =>
              patch({ syncMode: e.target.value as RoomConfig["syncMode"] })
            }
          >
            <option value="simultaneous">いっせい（全端末同時）</option>
            <option value="staggered">ランダム（端末ごとにずれる）</option>
          </select>
        </label>
        {(cfg.syncMode || "simultaneous") === "staggered" ? (
          <label className="field">
            <span>最大ずれ: {cfg.staggerMaxSeconds ?? 2}秒</span>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={cfg.staggerMaxSeconds ?? 2}
              onChange={(e) => patch({ staggerMaxSeconds: Number(e.target.value) })}
            />
          </label>
        ) : null}
      </section>

      <section className="panel">
        <h2>参加端末</h2>
        {snapshot.displays.length === 0 ? (
          <p className="muted">まだゴール端末がありません。</p>
        ) : (
          <ul className="device-list">
            {snapshot.displays.map((d) => (
              <li key={d.id}>
                <span className="swatch" style={{ background: COLORS[d.color] }} />
                <input
                  className="label-input"
                  value={d.label}
                  onChange={(e) =>
                    send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                  }
                  placeholder="位置ラベル"
                />
                <span className={`dot ${d.connected ? "ok" : "bad"}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SessionExit
        onStop={() => send({ type: "stop" })}
        clearSessionKeys={clearSessionKeys}
      />
    </div>
  );
}
