# Security Standards

本アプリのセキュリティ姿勢と、外部由来データの出力／秘匿情報／位置情報の扱いに関するパターンを定義する。本アプリは **バックエンド・認証・秘匿情報を持たないクライアント単体の静的 PWA** であり、現実的な攻撃面はブラウザ内 DOM とサードパーティ由来データに限定される。汎用テンプレ節のうち本構成で N/A のものは、見出しを残したまま「現状の方針」と「導入する場合の指針」を記す。

## Philosophy

- セキュアバイデフォルト / フェイルクローズ / 出力先文脈に応じたエスケープ / 入力は信用しない。
- **「認証・秘匿情報・バックエンドを安易に持ち込まない」こと自体が方針**。これらを導入する変更は steering 更新と設計レビューを要し、discovery で動機を確認する。
- 比較演習の題材として小さく自己完結を保つ。セキュリティ機構の追加は「SDD で何を検証するか」が明確なときのみ。

## Input & Output

- **主リスク**: 外部由来データ（自ホスト `skhb` ベクトルタイル＝国土地理院提供の避難所属性）を MapLibre の innerHTML 経路に流す DOM／格納型 XSS。
- **ルール**: innerHTML 経路（`Popup.setHTML`、AttributionControl 等）にデータ由来文字列を生で渡さない。ラベルと URL／属性を分離し、テキストはエスケープ、リンクは `http(s):` スキームを allow-list で検証する。
- 開発者がスタイル仕様に静的記述する attribution の `<a>` 等は許容（開発者統制下）。その経路に外部・利用者入力が混ざる変更は禁止パターン。
- **Anti-pattern（現状該当）**: `main.js` の `Popup.setHTML` がテンプレ文字列へ `feature.properties.*`（name/address/remarks 等）を無エスケープ補間。属性文脈への補間と引用符破綻も含み、タイルデータに markup が入れば XSS。

```js
// ✗ 禁止: データ由来値を innerHTML 文字列に生補間
popup.setHTML(`<div>${feature.properties.name}</div>`);

// ✓ 推奨: DOM API でテキストとして組み立て / リンクはスキーム検証
const el = document.createElement('div');
el.textContent = feature.properties.name ?? '';      // テキストはエスケープ不要な経路へ
const a = document.createElement('a');
if (/^https?:$/.test(new URL(url, location.href).protocol)) a.href = url;
a.textContent = label;                                // ラベルと URL を分離
popup.setDOMContent(container);
```

## Authentication & Authorization

設計上 N/A（ユーザー・認証・認可の概念なし）。導入する場合: deny-by-default、ポリシー中央集約、画面側チェックに依存しない。安易な導入は方針違反 → discovery で動機確認のうえスペック化する。

## Secrets & Configuration

秘匿情報ゼロが正の状態。タイル URL は公開エンドポイント（OSM / 国土地理院 disaportal）で API キー不要。**API キー・トークン・資格情報をリポジトリに追加しない**。鍵が要るクラウドサービスを採用する変更は設計レビュー必須で、直書き禁止・環境変数／シークレット管理・起動時必須チェックを前提に設計する。

## Sensitive Data

位置情報（Geolocate の現在地座標）は **クライアント内処理のみ** で外部送信しない。テレメトリ・解析等で座標や利用者データを持ち出す変更を入れない。PII 収集なし。最小収集の原則を維持する。

## Session/Token Security

N/A（セッション・トークンなし）。将来サーバ連携を追加する場合のみ: httpOnly + secure cookie、短命・更新時ローテーション、TLS 必須、トークンは最小クレーム。

## Logging (security-aware)

サーバログなし。`console` に座標・利用者由来データを残さない。実機デバッグ用の一時ログは検証完了後に必ず除去する（残置は情報漏えい兼ノイズ）。

## Headers & Transport

- 全外部リソースを HTTPS 取得（混在コンテンツ禁止）。配信は静的ホスティング前提。
- CSP 等のセキュリティヘッダはホスティング側設定。導入時は inline style を多用する構成のため `style-src` 方針を設計で明示的に決める。
- Service Worker は現状 no-op パススルー（`public/sw.js` の `fetch` リスナは空）。キャッシュ機能を追加する場合はキャッシュ汚染・古い資産の配信継続を脅威として設計に織り込む。

## Vulnerability Posture

- 自動スキャン CI なし → **依存を「動作可能な最新版」に保つことが主要な脆弱性対策レバー**。アクティブスペック `dependency-modernization` がこの責務を担う。
- 新規依存は保守状況・ライセンス・peer 互換を discovery／設計で確認してから採用する。秘匿情報が要るサービスは Secrets & Configuration の制約に従う。

---
_Focus on patterns and principles. Link concrete configs to ops docs._
