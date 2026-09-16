# SPEC-000007のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000007`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000007 複数Projectを比較可能な投影へ統合する](../../../05_SPEC/Definitions/SPEC-000007/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

複数Projectを比較可能な投影へ統合する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 許可された複数Projectを比較する時 |
| 事前条件 | 比較対象Projectごとの閲覧許可とCoverageを確認できる |
| Authority | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[比較対象解決] -> [Project別Coverage保持] -> [比較可能／比較不能]
```

- 振る舞い: Projectごとの網羅範囲、観測時点、重要差、根拠を保った比較結果を返す。
- 成功条件: 比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。
- 副作用: 読取り投影だけを返し、非開示Projectを探索・変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す |
| 境界 | 閲覧可能／非開示、Coverage同等／相違を分け、非開示Projectの存在を漏らさない |
| 失敗 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、非開示Projectを探索・変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000004](../../../04_UI/Definitions/UI-000004/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project・Portfolio状態投影のArchitecture定義](../../Definitions/ARCH-000005/architecture_definition.md) | Project Management Projection | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない | 読取り投影だけを返し、非開示Projectを探索・変更しない。 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project・Portfolio状態投影](../../Definitions/ARCH-000005/architecture_definition.md) | Same | Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000004
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
