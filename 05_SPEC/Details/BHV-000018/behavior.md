# BHV-000018 導入判断の根拠を区別して確認する

成果物種別: SPEC Detail
Behavior ID: `BHV-000018`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 導入判断の根拠を区別して確認する。
- Source SPEC: [SPEC-000018](../../Definitions/SPEC-000018/spec_definition.md)
- 対象利用側: UI-000013
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 実行基盤を選択または公式配布物を確認する時 |
| Precondition | Applicable | 対象Artifactと、既存Ownerが提供する確認結果・公開根拠・未確認範囲を確認できる |
| Authority | Applicable | 導入責任者が公開文書と既存確認結果を基に利用を判断する。製品は汎用Trust Policyの保存・選択・適用を提供せず、署名だけで実行を許可しない |
| Input | Applicable | 導入判断の根拠を区別して確認するに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 既存Ownerが確認した根拠と未確認範囲を区別して案内し、導入責任者が利用可否を判断する。専用の総合評価結果は生成しない。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 既存根拠の案内だけを行い、総合評価・Policy保存・実行Capability発行は行わない。 |
| Output | Applicable | 公式表示・署名・内容同一性を実行許可と同一視せず、確認できた根拠の範囲で導入責任者が判断する。 |
| Failure | Applicable | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 |
| Recovery | Applicable | 失敗理由と安全な戻り先を返す。 |

## 3. Behavior Flow

```text
実行基盤を選択または公式配布物を確認する時
  ↓
対象Artifactと、既存Ownerが提供する確認結果・公開根拠・未確認範囲を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
既存Ownerが確認した根拠と未確認範囲を区別して案内し、導入責任者が利用可否を判断する。専用の総合評価結果は生成しない。
       ↓
確認できた根拠・不足・人間判断を既存文書へ残す
```

判定不能時: 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000013／PRT-000013.spec-000018](../../../04_UI/Details/Areas/configuration-trust/SCR-000013/screen.md) | 導入判断の根拠を区別して確認するの操作・状態・結果を利用者へ示す | 確認済み／未確認・人間の利用判断・確認先 | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 公式表示・署名・内容同一性を実行許可と同一視せず、確認できた根拠の範囲で導入責任者が判断する。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗理由と安全な戻り先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000014がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
