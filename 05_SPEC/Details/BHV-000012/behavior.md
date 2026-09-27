# BHV-000012 Role別Credentialを維持しAccessを回復する

成果物種別: SPEC Detail
Behavior ID: `BHV-000012`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: Role別Credentialの発行・認証・失効・ローテーションとHost AuthorityによるAccess Recoveryを成立させる。
- Source SPEC: [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md)
- 対象利用側: UI-000008
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | Remote接続、Credential発行・失効・ローテーション、またはAccess Recoveryを開始する時 |
| Precondition | Applicable | Administrator Credential、またはRecovery時のServer Host Authorityと処置対象を確認できる |
| Authority | Applicable | 通常管理、Role別内容Access、Server Host Recoveryを分離する |
| Input | Applicable | Credential Profile、Credential ID／状態、明示Workspace集合、管理可否、Recovery対象、保持対象。生Secretは発行Attempt外へ出さない |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | active／expired／revoked／rotating／unknownと、Recoveryの確認待ち／進行中／blocked／completedを別々に遷移させる |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | Credential Metadata／Verifier、Request Access Context、失効状態、Recovery記録を更新する。Product Dataは変更しない |
| Output | Applicable | 発行時Secret一度表示、現在状態、利用範囲、Recovery ID、Bootstrap再入場先を返す |
| Failure | Applicable | Secret再表示・保存、管理能力からの内容Access推定、Product Data削除、重複Recoveryを拒否する |
| Recovery | Applicable | 最初の失敗から同じRecovery IDを維持し、Accessだけを再構成して通常管理へ戻す |

## 3. Behavior Flow

```text
[Credential Profile] -> [明示Grant確認] -> [Credential発行] -> [Secret一度表示] -> [active]
                                        ├ revoke／rotate
                                        └ authenticate -> [Request Access Context]
[管理不能] -> [Host確認] -> [Recovery ID] -> [Access再構成] -> [Bootstrap再入場]
```

判定不能時: 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000008／PRT-000008.spec-000012](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | 接続資格からWorkspace利用範囲を確定するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 発行・認証・失効・ローテーションとRole別Accessが成立する | Source SPECと同じ正常義務へ統合 |
| Boundary | 三Role、資格状態、Repository単体利用、通常管理／Host Recoveryを区別する | 境界条件を独立観測する |
| Failure | Secret再表示、権限推定、Product Data削除、重複Recoveryを防ぐ | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 同じRecovery IDでAccessだけを再構成しBootstrapから通常管理へ戻す | 保持対象と再入場を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000013がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
