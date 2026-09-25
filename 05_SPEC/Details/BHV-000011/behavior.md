# BHV-000011 複数入口で同じ依頼・結果契約を保つ

成果物種別: SPEC Detail
Behavior ID: `BHV-000011`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 複数入口で同じ依頼・結果契約を保つ。
- Source SPEC: [SPEC-000011](../../Definitions/SPEC-000011/spec_definition.md)
- 対象利用側: UI-000007
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時 |
| Precondition | Applicable | 公開Application契約へ適合する入力と利用可能なTransportがある |
| Authority | Applicable | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない |
| Input | Applicable | 複数入口で同じ依頼・結果契約を保つに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 |
| Output | Applicable | 入口の違いでAuthorityや結果の意味が変わらない。 |
| Failure | Applicable | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 |
| Recovery | Applicable | 失敗理由と安全な戻り先を返す。 |

## 3. Behavior Flow

```text
stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時
  ↓
公開Application契約へ適合する入力と利用可能なTransportがある
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000007／PRT-000007.spec-000011](../../../04_UI/Details/Areas/operation/SCR-000007/screen.md) | 複数入口で同じ依頼・結果契約を保つの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 入口の違いでAuthorityや結果の意味が変わらない。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗理由と安全な戻り先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000012がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
