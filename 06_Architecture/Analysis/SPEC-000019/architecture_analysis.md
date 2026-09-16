# SPEC-000019のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000019`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000019 責務変更後の利用側閉包を検証する](../../../05_SPEC/Definitions/SPEC-000019/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

責務変更後の利用側閉包を検証する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 責務・契約・接続部を変更する時 |
| 事前条件 | 移動したCanonical Contract、旧Owner、新Owner、利用側母集団を特定できる |
| Authority | 変更責任者が移行候補を作り、独立確認後に完了を判断する |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[責務変更] -> [Producer／Consumer／派生物／署名経路を導出]
 -> [宣言集合と比較] -> [閉包／不足]
```

- 振る舞い: 旧能力、Producer、全Consumer、派生物、署名・Release経路を新所有者と検証根拠へ対応付ける。
- 成功条件: 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 代表経路だけのPassや旧処理の推測削除を許さない。
- 副作用: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない |
| 境界 | 宣言Consumer／導出Consumer、移行済み／未移行を分け、未確認Consumerを閉包済みにしない |
| 失敗 | 代表経路だけのPassや旧処理の推測削除を許さない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない」と矛盾する結果を返さない |
| 対応UI | [UI-000014](../../../04_UI/Definitions/UI-000014/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [契約移行と利用側閉包のArchitecture定義](../../Definitions/ARCH-000002/architecture_definition.md) | 変更影響分析とConsumer Closure契約 | 変更責任者が移行候補を作り、独立確認後に完了を判断する | 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。 | 代表経路だけのPassや旧処理の推測削除を許さない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [契約移行と利用側閉包](../../Definitions/ARCH-000002/architecture_definition.md) | Same | 変更ファイルではなく移動した意味契約から利用側集合を導出し、宣言集合と実ソース集合を比較する。CanonicalなPath・Identity・StateをConsumer側で再解釈させない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000014
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
