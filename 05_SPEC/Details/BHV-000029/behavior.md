# BHV-000029 判断待ちTaskへの判断返却

成果物種別: SPEC Detail
Behavior ID: `BHV-000029`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 判断待ちの同じTaskへ、許可された人間の判断または追加入力を返し、そのTaskを再開可能にする。
- Source SPEC: [SPEC-000029](../../Definitions/SPEC-000029/spec_definition.md)
- 対象利用側: UI-000002
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | Taskが特定の人間判断または追加入力を待ち、利用者が回答する時 |
| Precondition | Applicable | Request、Task、判断点、現在世代、許可された選択肢または入力形式を確認できる |
| Authority | Applicable | その判断点へ結合した人間の決定権限。委任範囲、Provider実行、取消、回復または別判断点の権限を含まない |
| Input | Applicable | 判断待ちTaskへの判断返却に必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 許可された判断または追加入力をexactな判断点へ一度記録し、同じTaskの再開条件を成立させる。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 検証済みの判断点へ判断または入力を一度記録し、同じTaskへ再開可能通知を一度だけ渡す。新しいTaskや試行は自動作成しない。 |
| Output | Applicable | 記録した判断、対象Task、判断点、現在世代および次状態を一意に確認できる。 |
| Failure | Applicable | 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。 |
| Recovery | Applicable | 失敗・観測不能時は新しいEffectを暗黙に発行せず、同じIdentityと未解消義務を保持して安全な再確認先を返す。 |

## 3. Behavior Flow

```text
Taskが特定の人間判断または追加入力を待ち、利用者が回答する時
  ↓
Request、Task、判断点、現在世代、許可された選択肢または入力形式を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
許可された判断または追加入力をexactな判断点へ一度記録し、同じTaskの再開条件を成立させる。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 判断を記録せず、Taskを再開せず、現在の判断待ち状態と再確認先を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000002／PRT-000002.spec-000029](../../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | 判断待ちTaskへの判断返却の操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 記録した判断、対象Task、判断点、現在世代および次状態を一意に確認できる。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 判断を記録せず、Taskを再開せず、現在の判断待ち状態と再確認先を保持する | 観測不能を正常値へ畳まず再観測可能にする |
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
