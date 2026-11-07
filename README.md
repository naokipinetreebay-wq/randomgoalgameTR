# Random Goal Game TR

チーム色（青／朱／黄）でゴールが切り替わるサッカーアトラクション用Webアプリです。

姉妹アプリ（首振りスキャン）は同階層の `fieldscanTR` です。

## 公開 URL

| 役割 | URL |
|------|-----|
| ポータル | https://tr.rojiura.app |
| 本アプリ | https://tr.rojiura.app/randomgoal/ |
| ルーム／WS | https://tr-api.rojiura.app |

旧ホスト `https://randomgoal.rojiura.app` は新 URL へ 301 します。

## 起動（ローカル）

```bash
npm install
npm run dev
```

デフォルトは http://localhost:3000 です。`fieldscanTR` と同時起動する場合は片方の `PORT` を変えてください。

```bash
PORT=3001 npm run dev
```

## 本番ビルド（Pages 用）

```bash
npm run build
```

静的 export（`basePath: /randomgoal`）を `trwebapp` 配下へ載せて Pages デプロイします。詳細は `trwebapp/README.md`。

## ルール要点

- 各ゴール端末に色が付く
- 選手は自分の色のゴールを狙う
- 自分の色が0台のラウンドは守り時間
- 色ごとの固定／ランダム台数はコントローラで設定（合計はサーバが正規化）
