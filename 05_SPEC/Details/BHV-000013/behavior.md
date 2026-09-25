# BHV-000013 Meeting内容を候補化し所有正本へ昇格する

成果物種別: SPEC Detail
Behavior ID: `BHV-000013`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: Meeting内容を候補化し所有正本へ昇格する。
- Source SPEC: [SPEC-000013](../../Definitions/SPEC-000013/spec_definition.md)
- 対象利用側: UI-000009
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | Meetingの項目を継続論点または決定候補として扱う時 |
| Precondition | Applicable | Meeting Item、出所、候補種別、所有正本、判断主体を確認できる |
| Authority | Applicable | 候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする |
| Input | Applicable | Meeting内容を候補化し所有正本へ昇格するに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。 |
| Output | Applicable | 候補の出所、判断者、採否、反映先を辿れる。 |
| Failure | Applicable | 文字列一致だけで統合・分割せず、会話を自動採用しない。 |
| Recovery | Applicable | 失敗理由と安全な戻り先を返す。 |

## 3. Behavior Flow

```text
Meetingの項目を継続論点または決定候補として扱う時
  ↓
Meeting Item、出所、候補種別、所有正本、判断主体を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000009／PRT-000009.spec-000013](../../../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | Meeting内容を候補化し所有正本へ昇格するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 候補の出所、判断者、採否、反映先を辿れる。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 文字列一致だけで統合・分割せず、会話を自動採用しない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗理由と安全な戻り先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000006がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
