# BHV-000002 委任範囲と権限を確定して受理する

成果物種別: SPEC Detail
Behavior ID: `BHV-000002`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 委任範囲と権限を確定して受理する。
- Source SPEC: [SPEC-000002](../../Definitions/SPEC-000002/spec_definition.md)
- 対象利用側: UI-000002、UI-000004
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 目的・受入条件・対象範囲を委任する時、Task完了後にObjectiveを判断する時、またはObjective受入後にMilestoneを判断する時 |
| Precondition | Applicable | 委任時は目的、受入条件、許可範囲、担い手候補、判断主体を確認できる。Objective判断時は対象Taskの完了根拠とObjective受入条件を、Milestone判断時は対象Objectiveの受入根拠とMilestone受入条件を確認できる |
| Authority | Applicable | Project運営者が委任範囲、Objective受入およびMilestone受入を判断する。Runtimeは範囲を拡張せず、Task完了から上位受入を推定しない |
| Input | Applicable | 委任範囲と権限を確定して受理するに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。 |
| Output | Applicable | 受理結果から実行対象・未委任判断・完了条件を一意に確認でき、Task完了、Objective受入、Milestone受入を別の判断として保持する。 |
| Failure | Applicable | 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。明示拒否は失敗扱いで再発行せず、判断待ちは未完了として保持する。Task完了をObjective受入へ、Objective受入をMilestone受入へ推定した場合は契約違反としてEffect 0で停止する。 |
| Recovery | Applicable | 失敗・観測不能時は新しいEffectを暗黙に発行せず、同じIdentityと未解消義務を保持して安全な再確認先を返す。 |

## 3. Behavior Flow

```text
目的・受入条件・対象範囲を委任する時、Task完了後にObjectiveを判断する時、またはObjective受入後にMilestoneを判断する時
  ↓
委任時は目的、受入条件、許可範囲、担い手候補、判断主体を確認できる。Objective判断時は対象Taskの完了根拠とObjective受入条件を、Milestone判断時は対象Objectiveの受入根拠とMilestone受入条件を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000002／PRT-000002.spec-000002](../../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | 委任範囲と権限を確定して受理するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |
| [SCR-000004／PRT-000004.spec-000002](../../../04_UI/Details/Areas/project-context/SCR-000004/screen.md) | 委任範囲と権限を確定して受理するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 受理結果から実行対象・未委任判断・完了条件を一意に確認でき、Task完了、Objective受入、Milestone受入を別の判断として保持する。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。明示拒否は失敗扱いで再発行せず、判断待ちは未完了として保持する。Task完了をObjective受入へ、Objective受入をMilestone受入へ推定した場合は契約違反としてEffect 0で停止する。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗・観測不能時は新しいEffectを暗黙に発行せず、同じIdentityと未解消義務を保持して安全な再確認先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000004、ARCH-000005がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
