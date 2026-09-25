# BHV-000028 Taskの取消と終了確認

成果物種別: SPEC Detail
Behavior ID: `BHV-000028`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 実行中または待機中の同じTaskへ取消を要求し、外部作用と資源の終了状態を確認する。
- Source SPEC: [SPEC-000028](../../Definitions/SPEC-000028/spec_definition.md)
- 対象利用側: UI-000002
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 実行中または判断待ちのTaskについて、利用者が取消を選ぶ時 |
| Precondition | Applicable | 対象の依頼識別情報、Task識別情報、試行識別情報、現在世代、現在状態および作用状態を確認できる |
| Authority | Applicable | 対象Taskと試行へ限定した取消権限を持つ主体。実行、回復、清掃または別Taskの権限を含まない |
| Input | Applicable | Taskの取消と終了確認に必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | exactなTaskと試行へ取消を一度だけ要求し、外部作用の終了と終了後資源を別々に観測する。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 検証済みの対象Taskと試行に限り、取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。 |
| Output | Applicable | `cancelled`または取消と競合した既存の完了結果を、対象Identity、観測時点および終了後状態付きで確認できる。 |
| Failure | Applicable | 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。 |
| Recovery | Applicable | 失敗・観測不能時は新しいEffectを暗黙に発行せず、同じIdentityと未解消義務を保持して安全な再確認先を返す。 |

## 3. Behavior Flow

```text
実行中または判断待ちのTaskについて、利用者が取消を選ぶ時
  ↓
対象の依頼識別情報、Task識別情報、試行識別情報、現在世代、現在状態および作用状態を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
exactなTaskと試行へ取消を一度だけ要求し、外部作用の終了と終了後資源を別々に観測する。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 取消を重複発行せず、新しいProvider作用を発行せず、既知状態と未解消の回復義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000002／PRT-000002.spec-000028](../../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | Taskの取消と終了確認の操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | `cancelled`または取消と競合した既存の完了結果を、対象Identity、観測時点および終了後状態付きで確認できる。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 取消を重複発行せず、新しいProvider作用を発行せず、既知状態と未解消の回復義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗・観測不能時は新しいEffectを暗黙に発行せず、同じIdentityと未解消義務を保持して安全な再確認先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000004がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
