# Random Goal Game TR

チーム色（青／朱／黄）でゴールが切り替わるサッカーアトラクション用Webアプリです。

姉妹アプリ（首振りスキャン）は同階層の `fieldscanTR` です。

## 公開URL案（TRwebapp）

| 役割 | URL |
|------|-----|
| ポータル | https://tr.rojiura.app |
| 本アプリ | https://randomgoal.rojiura.app |

ポータルから各トレーニングアプリへ誘導する想定です。

## 起動

```bash
npm install
npm run dev
```

デフォルトは http://localhost:3000 です。`fieldscanTR` と同時起動する場合は片方の `PORT` を変えてください。

```bash
PORT=3001 npm run dev
```

## 本番

```bash
npm run build
npm start
```

## ルール要点

- 各ゴール端末に色が付く
- 選手は自分の色のゴールを狙う
- 自分の色が0台のラウンドは守り時間
- 色ごとの固定／ランダム台数はコントローラで設定（合計はサーバが正規化）
