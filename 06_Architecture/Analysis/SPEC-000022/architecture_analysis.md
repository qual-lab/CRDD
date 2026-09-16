# SPEC-000022のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000022`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000022 過去情報と現在有効な意図を区別して解決する](../../../05_SPEC/Definitions/SPEC-000022/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

過去情報と現在有効な意図を区別して解決する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 過去の推論情報や判断を現在の作業で参照する時 |
| 事前条件 | 情報の出所、発生時点、対象改訂版、置換関係を確認できる |
| Authority | 履歴を閲覧する主体。参照から現在方針の採用Authorityを推定しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[参照要求] -> [発生時点／改訂版／置換を照合] -> [current／historical／superseded／unknown]
```

- 振る舞い: 発生時点、対象改訂版、出所、現在有効性、置換関係を評価して参照結果を返す。
- 成功条件: Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。
- 副作用: 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する |
| 境界 | 現在有効／置換済み／失効／不明を分け、過去情報を現在意図へ自動昇格しない |
| 失敗 | 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000017](../../../04_UI/Definitions/UI-000017/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [過去情報と現在有効な意図のArchitecture定義](../../Definitions/ARCH-000016/architecture_definition.md) | Context Provenance Resolver | 履歴を閲覧する主体。参照から現在方針の採用Authorityを推定しない | 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。 | 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [過去情報と現在有効な意図](../../Definitions/ARCH-000016/architecture_definition.md) | Same | 過去情報を消さず、現在有効な意図と区別する。Gitで再現できる全量Inventoryを永続化せず、必要なサマリーと参照Hashを保持する。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000017
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
