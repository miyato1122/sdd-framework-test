## 1. DisasterInfoControl の新規実装

- [ ] 1.1 `disasterInfoControl.js` を新規作成し、`DisasterInfoControl` クラス（`onAdd` / `onRemove` / `getDefaultPosition` を実装する MapLibre IControl）を定義する
- [ ] 1.2 コンストラクタで `hazardLayers`（災害想定区域 6 種の `[layerId, label]` 配列）と `shelterLayers`（避難所 8 種の `[layerId, label]` 配列）を受け取れるようにする
- [ ] 1.3 `onAdd` で `div.maplibregl-ctrl.maplibregl-ctrl-group.disaster-info-control` 要素を構築し、「災害想定区域」セクション、`<hr>` 区切り、「避難所」セクションの 3 ブロックを順に配置する
- [ ] 1.4 各セクションの先頭に「なし」ラジオを置き、続けて受け取った各レイヤー定義を順にラジオとして描画する（name 属性はセクションごとに別、初期 checked は「なし」）
- [ ] 1.5 ラジオの `change` イベントを購読し、当該セクションの全レイヤー ID に対して `map.setLayoutProperty(layerId, 'visibility', 'none' | 'visible')` を呼び出して可視/不可視を切り替える
- [ ] 1.6 `onRemove` で DOM クリーンアップとイベントハンドラ解除を行う

## 2. main.js での既存 OpacityControl 置き換え

- [ ] 2.1 `main.js` 冒頭の `import OpacityControl from 'maplibre-gl-opacity'` を削除し、`import DisasterInfoControl from './disasterInfoControl.js'` を追加する
- [ ] 2.2 `main.js:1050-1060` の `new OpacityControl(...)`（災害想定区域用）と `map.addControl(opacity, 'top-left')` を削除する
- [ ] 2.3 `main.js:1063-1075` の `new OpacityControl(...)`（指定緊急避難場所用）と `map.addControl(opacitySkhb, 'top-right')` を削除する
- [ ] 2.4 代わりに、災害想定区域 6 種と避難所 8 種のレイヤー定義を渡した 1 個の `DisasterInfoControl` を生成し、`map.addControl(disasterInfoControl, 'top-left')` で追加する

## 3. スタイル整理

- [ ] 3.1 `style.css` の `#opacity-control` 関連ブロック（`maplibre-gl-opacity` 由来のスタイルインライン化部分）を削除する
- [ ] 3.2 `.disaster-info-control` / `.dic-section` / `.dic-section-title` / `.dic-separator` 等のスタイルを `style.css` に追加し、`BasemapSwitcherControl` と整合する内側パディング・行間・見出しサイズを設定する
- [ ] 3.3 2 セクションの区切り線が視覚的に意味を持って描画されることを目視確認する

## 4. 依存パッケージ整理

- [ ] 4.1 `package.json` の `dependencies` から `maplibre-gl-opacity` を削除する
- [ ] 4.2 `node_modules/` と `package-lock.json` を削除した上で `npm install` を再実行し、`ERESOLVE` エラーなく完了することを確認する
- [ ] 4.3 再生成された `package-lock.json` に `maplibre-gl-opacity` のツリーが存在しないことを確認する

## 5. 既存仕様の更新反映

- [ ] 5.1 本変更の specs/basemap-switching/spec.md（MODIFIED）どおりに、`openspec/specs/basemap-switching/spec.md` 側の差し替え対象 Requirement 内容を確認する（archive 時に反映される）
- [ ] 5.2 本変更の specs/dependency-baseline/spec.md（MODIFIED）どおりに、`openspec/specs/dependency-baseline/spec.md` 側の差し替え対象 Requirement 内容を確認する（archive 時に反映される）

## 6. 動作検証

- [ ] 6.1 `npm run dev` で起動し、地図左上に統合コントロールが描画されることを確認する
- [ ] 6.2 地図右上にコントロールが存在しないことを確認する
- [ ] 6.3 災害想定区域セクションで 6 種を順に切り替え、対応するレイヤーが排他的に表示・非表示されることを確認する
- [ ] 6.4 避難所セクションで 8 種を順に切り替え、対応する `skhb-*-layer` が排他的に表示・非表示されることを確認する
- [ ] 6.5 両セクションが独立して動作する（一方の選択がもう一方に影響しない）ことを確認する
- [ ] 6.6 両セクションで「なし」を選んだ初期状態に戻せることと、初回ロード時の状態が「なし」かつ全レイヤー不可視であることを確認する
- [ ] 6.7 避難所セクションで任意のレイヤーを選択中に、地図上の地物をクリックしてポップアップが表示されることを確認する
- [ ] 6.8 避難所セクションで「なし」を選択中に同じ位置をクリックしてポップアップが出ないことを確認する
- [ ] 6.9 ブラウザの位置情報を許可しズーム 7 以上で、現在地と最寄り避難場所のライン（`route-layer`）が描画されることを確認する
- [ ] 6.10 背景地図切替コントロール（左下）と統合コントロール（左上）が視覚的に重ならないことを確認する
- [ ] 6.11 `TerrainControl` の有効化、`hillshade` の描画、ホバー時カーソル変更が従来どおり機能することを確認する

## 7. 本番ビルド確認

- [ ] 7.1 `npm run build` でビルドが成功し、`dist/` 配下に成果物が生成されることを確認する
- [ ] 7.2 `npm run preview` で起動し、開発サーバーと同じ主要機能が動作することを確認する
