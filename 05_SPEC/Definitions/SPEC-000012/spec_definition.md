# SPEC-000012 Role別Credentialから利用範囲を確定しAccessを回復する

成果物種別: SPEC定義
SPEC ID: `SPEC-000012`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

Role別Credentialを発行・失効・ローテーションし、接続時の利用範囲を確定する。通常管理不能時はServer HostのAuthorityからAccessだけを再構成し、Product Dataを変更せず通常管理へ戻す。

## UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000013](../../Analysis/UX-000013/spec_analysis.md) | 許可された作業領域だけをリモート利用する |
| [UX-000035](../../Analysis/UX-000035/spec_analysis.md) | User管理なしでRole別Credentialを維持しAccessだけを回復する |

## IA観点の分析結果

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000009](../../Analysis/IA-000009/spec_analysis.md) | 接続資格・作業領域・公開範囲 |

## 両観点の統合判断

リモート接続を開始または再接続する時、接続資格を検証し、現在有効なWorkspace GrantとRepository Exposureから利用可能範囲を確定する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Remote接続、Credential発行・失効・ローテーション、またはAccess Recoveryを開始する時 |
| 事前条件 | 通常操作では有効なAdministrator Credential、RecoveryではServer Host上の対話Authorityと処置対象を確認できる |
| Authority | 通常管理はAdministrator能力、内容AccessはRole別Grant、全喪失RecoveryはServer Host Authorityに限定する |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[Role選択] -> [Credential発行] -> [Secret一度表示] -> [active]
                                      │
                                      ├ revoke／rotate -> [revoked／active(new)]
                                      └ authenticate -> [Session＋Role Grant]

[全Administrator喪失／認可破損]
        -> [Host確認] -> [Recovery ID] -> [Accessだけ再構成] -> [Bootstrap再入場]
```

- 振る舞い: `administrator`、`management`、`developer`のRole別Credentialを管理し、認証時は現在有効なRole GrantとRepository Roleから利用可能範囲を確定する。
- 成功条件: Secretは発行時に一度だけ返し、System管理能力、Management内容Access、Development内容Accessを別に判定する。
- Repository単体利用へCROS Credentialを要求しない。

## 失敗・回復・副作用

- 失敗: 無効・期限切れ・失効Credential、Role不整合、Secret再表示要求、全Administrator喪失、認可状態破損、Recovery途中失敗を区別する。
- 副作用: Credential Metadata、Digest、Session Grant、失効状態、Recovery記録を作成・更新し得る。生Secret、Repository、Project Contextその他のProduct DataをRecovery記録へ複製しない。
- 回復: 最初の失敗から同じRecovery IDを保持し、失効対象・保持対象・終了後状態を再観測してBootstrap Credentialから通常管理へ戻す。途中失敗後に別Recoveryを重ねない。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | Role別Credentialの発行・認証・失効・ローテーションが成立し、管理能力と内容Accessを別に判定する |
| 境界 | active／expired／revoked／rotating／unknown、三Role、Repository単体利用、通常管理／Host Recoveryを分ける |
| 失敗 | Secretを再表示・保存せず、管理能力から内容Accessを推定せず、RecoveryでProduct Dataを削除しない |
| 観測不能 | 不明を完了へ丸めず同じRecovery IDと既知状態を返し、新しい資格・Session・内容Effectを発行しない |
| 対応UI | [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)

## 制約

- Repository単体利用へCROS Credentialを要求しない。
- API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

### UX-000013から継承する確認事項

正式入力: [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: プロジェクト運営者／PMを代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

### IA-000009から継承する確認事項

正式入力: [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

### SPEC固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。正式入力の意味、対応関係または成立条件に不足・競合が見つかった場合は、その意味を所有するUX／IAへ戻す。

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 正式入力と変換根拠

- 正式入力: [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)
- 正式入力: [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)
- 正式入力: [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)

次の分析記録は正式入力をこの工程の観点へ変換した根拠であり、正式入力そのものではない。

- 変換根拠: [UX-000013のSPEC分析](../../Analysis/UX-000013/spec_analysis.md)
- 変換根拠: [UX-000035のSPEC分析](../../Analysis/UX-000035/spec_analysis.md)
- 変換根拠: [IA-000009のSPEC分析](../../Analysis/IA-000009/spec_analysis.md)
## Checklist

- [x] UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [x] Current State、Behavior、ResultおよびState Transitionを定義した
- [x] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [x] ConstraintとNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するUIとのRelationを明示した
- [x] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [x] 結果を観測可能な契約として定義した
- [x] 補足定義へ必須情報を退避していない
