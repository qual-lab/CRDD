# SPEC-000003のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000003`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000003 委任した仕事の状態と判断要否を返す](../../../05_SPEC/Definitions/SPEC-000003/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

委任した仕事の状態と判断要否を返す。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 受理済みの仕事の状態を照会する時 |
| 事前条件 | 同じTask識別情報と現在の観測結果がある |
| Authority | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[ready] -> [running] -> [waiting／blocked／completed／failed]
各状態は観測時点と次の行動を伴う
```

- 振る舞い: 同じTaskの現在状態、観測時点、判断要否、次に許される行動を返す。
- 成功条件: ready・running・waiting・blocked・completed・failedを観測根拠付きで区別する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 観測不能や古い状態を進行中・完了へ推定しない。
- 副作用: 読取り専用。TaskやProvider Processを変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | ready・running・waiting・blocked・completed・failedを観測根拠付きで区別する |
| 境界 | Task識別情報一致／不一致、観測済み／観測不能を分け、別Taskの状態を返さない |
| 失敗 | 観測不能や古い状態を進行中・完了へ推定しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用。TaskやProvider Processを変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project実行のArchitecture定義](../../Definitions/ARCH-000004/architecture_definition.md) | Project状態照会 | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない | 読取り専用。TaskやProvider Processを変更しない。 | 観測不能や古い状態を進行中・完了へ推定しない。 |

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
