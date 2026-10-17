# BHV-000027 持ち帰った候補を所有正本へ昇格する

成果物種別: SPEC Detail
Behavior ID: `BHV-000027`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 持ち帰った候補を所有正本へ昇格する。
- Source SPEC: [SPEC-000027](../../Definitions/SPEC-000027/spec_definition.md)
- 対象利用側: UI-000016
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 持ち帰った候補を採用・却下・保留する時 |
| Precondition | Applicable | 未信頼候補、出所、対象正本、現在改訂版、判断主体を確認できる |
| Authority | Applicable | 所有正本の決定権限者だけが採用できる。送信同意や結果受領を流用しない |
| Input | Applicable | 持ち帰った候補を所有正本へ昇格するに必要な対象Identity、入力値、出所および観測時点 |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 候補の出所、対象、判断主体、現在改訂版を確認し、採用時だけ所有正本へ反映する。 |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。 |
| Output | Applicable | 採否と反映先を辿れ、却下・保留では所有正本を変更しない。 |
| Failure | Applicable | 結果受領や送信許可を候補採用Authorityへ流用しない。 |
| Recovery | Applicable | 失敗理由と安全な戻り先を返す。 |

## 3. Behavior Flow

### v0.22 Git固定候補の公開操作

WorkbenchとMCPは同じOrchestrator Ownerへ直接接続する。共有利用では三Roleいずれも対象Repositoryの現在development利用許可を必要とし、managementだけの許可からGit書込みを発行しない。単体利用では固定Repositoryだけを資格なしで扱う。入力のRoot・認可関数・参照解放済み申告は受けない。

固定は確認したBase・HEAD・file全体のBlob／mode／削除と表示名を保持する。採用は別要求で固定Commit、取込先Branch、期待HEADを指定し、直前の現在認可と既存Writerの世代・非使用条件を確認する。Gitの二親Mergeは統合事実であり、採用理由や品質成立の証明を代替しない。旧Bundleの採用結果を新候補へ流用しない。

応答喪失は処置不存在を意味しない。既存状態・固定Refを再取得し、同じ操作Identityの既存再入場だけを明示利用する。自動再送・自動rollback・別IDでの再作成は行わない。採否後の不要RefとWorktreeは既存の終了処理へ接続し、使用中・保持・観測不能は成功へ丸めない。既知秘密を含む本文・追加／削除差分を公開出力しないことと、未知秘密の不存在保証を区別する。

```text
持ち帰った候補を採用・却下・保留する時
  ↓
未信頼候補、出所、対象正本、現在改訂版、判断主体を確認できる
  ↓
Authority・対象Identity・入力を検証
  ├─ 不足／不一致 → Effect 0で理由と戻り先
  └─ 成立
       ↓
候補の出所、対象、判断主体、現在改訂版を確認し、採用時だけ所有正本へ反映する。
       ↓
Success／Reject／Failure／Unknownを同じContextで返す
```

判定不能時: 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000016／PRT-000016.spec-000027](../../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | 持ち帰った候補を所有正本へ昇格するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 採否と反映先を辿れ、却下・保留では所有正本を変更しない。 | Source SPECと同じ正常義務へ統合 |
| Boundary | 対象、Authority、現在性または入力の境界を越えず、対象外へEffectを発行しない | 境界条件を独立観測する |
| Failure | 結果受領や送信許可を候補採用Authorityへ流用しない。 | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 失敗理由と安全な戻り先を返す。 | Recoveryが非該当の場合も安全な戻り先を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000015がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

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
