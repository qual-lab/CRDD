# SPEC-000006のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000006`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000006 Projectと節目の現在状態を投影する](../../../05_SPEC/Definitions/SPEC-000006/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

Projectと節目の現在状態を投影する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Projectまたは節目の現在地を照会する時 |
| 事前条件 | Project IDと許可された情報源を解決できる |
| Authority | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[情報源解決] -> [完全／partial／stale／conflicting]
 -> [根拠付きProject View]
```

- 振る舞い: 目的、受入、Task、統合状態、根拠、欠測、観測時点を同じProjectへ結合して読取り投影を返す。
- 成功条件: 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 競合・欠測・開示制限を正常値で補完しない。
- 副作用: 読取り投影だけを返し、Project正本を変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる |
| 境界 | Project一致／不一致、完全／欠測／古い／競合を分け、別Projectの情報を混ぜない |
| 失敗 | 競合・欠測・開示制限を正常値で補完しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、Project正本を変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000004](../../../04_UI/Definitions/UI-000004/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project・Portfolio状態投影のArchitecture定義](../../Definitions/project-state-projection/architecture_definition.md) | Project Management Projection | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない | 読取り投影だけを返し、Project正本を変更しない。 | 競合・欠測・開示制限を正常値で補完しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project・Portfolio状態投影](../../Definitions/project-state-projection/architecture_definition.md) | Same | Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000004
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
