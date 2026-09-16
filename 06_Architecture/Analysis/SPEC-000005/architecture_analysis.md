# SPEC-000005のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000005`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000005 残存資源を清掃し終了後を確認する](../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

残存資源を清掃し終了後を確認する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 回復または清掃可能と分類された残存を処置する時 |
| 事前条件 | exact Recovery Identity、清掃可能判定、対象Rootを確認できる |
| Authority | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[義務あり] -> [処置準備済み] -> [清掃Effect発行済み]
 -> [終了後未確認] -> [不存在確認・義務解消]
```

- 振る舞い: 回復義務と清掃処置を同じ識別情報へ結合し、処置後に不存在または安全な終了を再観測する。
- 成功条件: 処置の発行だけで完了せず、終了後確認によって義務を解消する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。
- 副作用: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。
- 応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 処置の発行だけで完了せず、終了後確認によって義務を解消する |
| 境界 | 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける |
| 失敗 | 由来不明、参照中、観測不能は削除せず、義務を保持する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない |
| 対応UI | [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md)、[UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project実行のArchitecture定義](../../Definitions/ARCH-000004/architecture_definition.md) | 清掃Controller | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime | 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。 | 由来不明、参照中、観測不能は削除せず、義務を保持する。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/ARCH-000004/architecture_definition.md) | Same | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000002、UI-000003、UI-000012
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
