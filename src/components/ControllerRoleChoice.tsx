"use client";

export type ControllerRoleMode = "controlOnly" | "alsoDisplay";

export function ControllerRoleChoice({
  value,
  onChange,
}: {
  value: ControllerRoleMode | null;
  onChange: (mode: ControllerRoleMode) => void;
}) {
  return (
    <div className="role-choice">
      <button
        type="button"
        className={`role-card ${value === "controlOnly" ? "selected" : ""}`}
        onClick={() => onChange("controlOnly")}
      >
        <span className="role-title">操作専用のまま</span>
        <span className="role-desc">
          この端末はコントローラだけ。ゴール色の表示対象にはなりません（推奨・通常）。
        </span>
      </button>
      <button
        type="button"
        className={`role-card ${value === "alsoDisplay" ? "selected" : ""}`}
        onClick={() => onChange("alsoDisplay")}
      >
        <span className="role-title">この端末も表示対象にする</span>
        <span className="role-desc">
          操作に加え、この端末もゴール色の表示に参加します（台数が1つ足ります）。
        </span>
      </button>
    </div>
  );
}
