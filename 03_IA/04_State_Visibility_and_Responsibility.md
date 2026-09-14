# CRDD／CROSの状態・可視性・責任

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

## 1. 状態を丸めない

```text
要求した
   ≠ 受理された
   ≠ 開始した
   ≠ 外部作用が成立した
   ≠ 結果を受け取った
   ≠ 正本へ採用した

見つからない
   ├ absent       不存在を確認できた
   ├ restricted   存在を開示できない
   ├ unavailable  現在取得できない
   ├ stale        古い観測だけがある
   ├ conflicting  複数の主張が競合する
   └ unknown      観測できず判断不能

記録されている
   ├ current       現在有効
   ├ historical    履歴として保持
   ├ superseded    別の内容へ置換済み
   └ unknown       現在の有効性を判断不能

実行基盤の境界
   ├ available     利用可能
   ├ blocked       利用不能または停止
   └ unknown       未確認
```

## 2. 可視性

| 情報 | 可視性の義務 |
|---|---|
| 現在状態、判断待ち、重大な危険、回復要否 | 利用者が次の行動を選ぶ文脈から隠さない |
| 欠測、古さ、競合、網羅範囲 | 要約と同時に理解できる |
| Source、Revision、Observed At、技術的Identity | 必要時に辿れる |
| 非開示対象 | 名前、件数、要約を推測表示しない |
| 内部Process、接続口（Port）、保存Path | 通常利用では主役にせず、診断責任者だけが辿れる |

## 3. 責任境界

```text
Human
├ 目的・許可範囲・採否・信頼方針を決める
└ 不明状態を受容するか、停止・回復するか判断する

CRDD／CROS
├ 対象・状態・根拠・不足・次の行動を意味を変えず投影する
├ 許可外の対象を推測・開示しない
└ CandidateをDecisionやEffectへ自動昇格しない

UI／MCP／CLI
└ 同じ公開契約を、それぞれの入口に適した形で運ぶ

Architecture／Provider／Platform
└ IAが要求する意味を実境界で成立させ、診断可能にする
```

## 4. 作業中と正式記録

候補、下書き、実行中の状態、一時投影と、採用済み正本、耐久的回復記録、公開済みEvidenceを区別する。具体的な保存期間や配置はSPEC・Architecture・Maintenanceが定める。
