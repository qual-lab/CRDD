# BHV-000008 実行事実と評価を区別して取得する

成果物種別: SPEC Detail
Behavior ID: `BHV-000008`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 実行事実と評価を区別して取得する。
- Source SPEC: [SPEC-000008](../../Definitions/SPEC-000008/spec_definition.md)
- 対象利用側: UI-000005
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 実行結果を振り返る時 |
| Precondition | Applicable | 取得対象とする実行、情報源、観測時点を確認できる |
| Authority | Applicable | 実行記録を閲覧できる主体。評価の閲覧は評価採用Authorityを含まない |
| Input | Applicable | 実行事実と評価を区別して取得するに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 利用可能な実行記録から観測事実、未観測、評価、改善候補、出所、観測時点を区別して返す。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 読取り専用。実行記録、対象Task、Providerを変更しない。 |
| Output | Applicable | 評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる。 |
| Failure | Applicable | 欠測を正常値へ補完せず、評価を観測事実として返さない。 |
| Recovery | Applicable | 失敗理由と安全な戻り先を返す。 |

## 3. Behavior Flow

```text
実行結果を振り返る時
  ↓
取得対象とする実行、情報源、観測時点を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
利用可能な実行記録から観測事実、未観測、評価、改善候補、出所、観測時点を区別して返す。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000005／PRT-000005.spec-000008](../../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | 実行事実と評価を区別して取得するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 欠測を正常値へ補完せず、評価を観測事実として返さない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗理由と安全な戻り先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000007がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 実装配置 | N/A | Architecture工程 | BHVの意味契約には影響しない | Architecture Detailで配置する時 |
| 実利用条件 | OPEN | Source SPECのOwner | 定量条件と利用頻度は未固定 | 対象利用者の実利用確認または前提変更時 |

## 補足分析

Source SPECの観測可能な意味を詳細化した。ArchitectureまたはSource実装から新しい意味を逆輸入していない。

## Checklist

- [x] 独立したTriggerまたはResultを持つ
- [x] Source SPECへ接続した
- [x] TriggerからRecoveryまで全観点を評価した
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [x] Normal、Boundary、Failure、UnknownおよびRecoveryを評価した
- [x] UI認識が必要な結果をUI Detailへ接続した
- [x] Architecture方式やSource実装を先取りしていない
- [x] 新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない
