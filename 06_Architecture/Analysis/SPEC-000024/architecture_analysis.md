# SPEC-000024のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000024`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000024 公式素材の由来・権利・用途を確認する](../../../05_SPEC/Definitions/SPEC-000024/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

公式素材の由来・権利・用途を確認する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 公式Repositoryへ素材を収載または再配布する時 |
| 事前条件 | 素材、出所、権利確認、許可用途、決定権限者、対象版を確認できる |
| Authority | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[素材候補] -> [由来／権利／用途／判断者を照合]
  ├ 確認済み -> [approved／restricted]
  ├ 取下げ -> [withdrawn]
  └ 不明 -> [candidateのまま停止]
```

- 振る舞い: 素材の由来、権利確認、許可した用途、決定権限者、対象版を記録して利用可否を返す。
- 成功条件: 確認済み・未確認・利用不可を区別し、許可範囲へ戻れる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 生成手段だけで権利を推定せず、用途外利用を許可しない。
- 副作用: 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 確認済み・未確認・利用不可を区別し、許可範囲へ戻れる |
| 境界 | 由来・権利・用途が確認済み／未確認／利用不可を分け、許可用途を拡張しない |
| 失敗 | 生成手段だけで権利を推定せず、用途外利用を許可しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする」と矛盾する結果を返さない |
| 対応UI | [UI-000019](../../../04_UI/Definitions/UI-000019/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [公式素材の権利・用途確認のArchitecture定義](../../Definitions/ARCH-000017/architecture_definition.md) | 公式Repositoryの素材収載判断 | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない | 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。 | 生成手段だけで権利を推定せず、用途外利用を許可しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [公式素材の権利・用途確認](../../Definitions/ARCH-000017/architecture_definition.md) | Same | candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000019
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
