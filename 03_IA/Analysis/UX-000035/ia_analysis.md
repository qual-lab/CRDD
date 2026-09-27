# IA分析: User管理なしでRemote Accessを維持・回復する

成果物種別: IA分析
分析対象: [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)
状態: 分析済み

## 1. UXから受け取る意味

| 観点 | この分析で受け取る内容 |
|---|---|
| 利用者 | CROS管理者、Server Host運用者 |
| 場面 | Credentialの発行、失効、ローテーション、全喪失または認可状態破損からの回復 |
| 目的 | User Accountを管理せずRole別Remote Accessを維持・回復する |
| 得たい結果 | Product Dataを失わず通常管理へ再入場できる |
| 重要場面 | 全Administrator Credentialを失った時 |
| 避ける失敗 | Secret保存、管理能力からの内容権限推定、別Recoveryの重複、Product Data削除 |
| 守る品質 | Host Authorityと明示確認でAccessだけを再構成し、同じRecoveryへ再入場できる |

## 2. 情報候補と関係

| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |
|---|---|---|
| Role | Remote CROSで利用できる情報・操作範囲 | `administrator`／`management`／`developer` |
| 接続資格Metadata | Secretを除くCredentialの識別・Role・状態・期限 | Credential ID。生Secretや同等値を含めない |
| 一度表示するSecret | 発行直後だけ利用者へ渡すBearer Secret | 発行Attempt内だけに存在し永続情報へ含めない |
| 接続資格状態 | active／expired／revoked／rotating／unknown | Credential IDと現行状態 |
| 管理能力 | Credential発行・失効・Server設定を行う能力 | Administrator Roleから導くが内容Accessとは別に判定する |
| Access Recovery | 全喪失または認可破損からAccessを再構成する回復 | Recovery IDを最初の失敗から再入場まで保つ |
| Recovery対象 | 失効・再発行するCredentialとRole | Recovery IDとCredential ID／Role |
| 保持対象 | 削除しないRepository、Project Contextその他のProduct Data | Recovery IDと保持区分 |
| Recovery結果 | 現在地、終了後状態、次の安全な行動 | Recovery IDと結果改訂版 |

```text
[O: Role] ──割り当てる──▶ [O: 接続資格Metadata]
                                ├─発行時だけ──▶ [補足: 一度表示するSecret]
                                └─現在値を持つ▶ [O: 接続資格状態]

[O: Role] ──administratorだけ──▶ [O: 管理能力]

[O: Access Recovery]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

図中の`[O:]`は情報Objectだけを表す。利用者、判断行為、利用者成果はObjectとして代用しない。

### Canonical化候補

| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|---|
| IA-000009 | Role | Role | Same | Userを管理せず利用範囲を表す |
| IA-000009 | 接続資格Metadata | 接続資格 | Merge | Secretを除いた永続可能な情報として統合する |
| IA-000009 | 一度表示するSecret | Secret表示境界 | Rename | 永続情報と混ぜず発行時だけ扱う |
| IA-000009 | 接続資格状態 | 接続資格状態 | Same | 発行・失効・期限・ローテーションを区別する |
| IA-000009 | 管理能力 | 管理能力 | Same | 内容Accessから分離する |
| IA-000009 | Access Recovery | Access Recovery | Same | Hostからの再入場を表す |
| IA-000009 | Recovery対象 | Recovery対象 | Same | 失効・再発行する範囲を表す |
| IA-000009 | 保持対象 | 保持対象 | Same | Product Dataを変更しない範囲を表す |
| IA-000009 | Recovery結果 | Recovery結果 | Same | 現在地、終了後状態、次の行動を表す |

## 3. 状態・可視性・導線・責任

| 観点 | 分析結果 |
|---|---|
| 状態 | Credentialのactive／expired／revoked／rotating／unknown、Recoveryの確認待ち／進行中／blocked／completedを区別する |
| 可視性 | Secretは発行時だけ表示し、一覧・ログ・Evidence・会話には残さない |
| 導線 | Role選択→Credential発行→Secret一度表示→状態確認→失効／ローテーション。通常管理不能時はHost確認→対象・保持対象確認→Bootstrap再入場 |
| 責任 | CROS管理者が通常Credentialを、Server Host運用者がRecovery Authorityを、Repository OwnerがProduct Dataを所有する |
| 時間的な意味 | 発行、失効要求、失効確定、Recovery開始、終了後確認を同一視しない |
| 情報の優先度 | 通常時はRoleとCredential状態、緊急時は処置範囲、保持対象、Recovery現在地および次の安全な行動を先に示す |
| 情報のまとまり | 通常のCredential管理と緊急Recoveryを同じAccess管理Contextで追跡するが、AuthorityとEffectを分ける |
| 判断権限 | Role割当はCROS管理者、緊急RecoveryはServer Hostの人間確認、内容AccessはRoleとRepository情報範囲で決める |
| 重要な失敗 | Secret再表示、Administratorへの内容権限自動付与、Product Data削除、Recovery Identity喪失 |
| 制約・対象外 | 管理画面、CLI、Digest方式、認証Protocol、保存Schema、Process配置はIAで決めない |
| 人間判断 | 共有Credentialの配布負担、管理画面とCLIの分担、有効期限の既定値をPilotで判断する |
| IAへ戻す条件 | Secret非保存、固定三Roleまたは同一Recoveryへの再入場を情報構造で表せない場合 |
| 検証意図 | Secretを残さずRole別Credentialを維持し、Product Dataを保って通常管理へ戻れることを確認する |

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

### 未確認事項と判断

| 区分 | 内容 |
|---|---|
| UXから継承する確認事項 | 共有Credentialの配布負担、管理画面とCLIの分担、有効期限の既定値 |
| 判断者 | CROS管理者、Server Host運用者およびQual-Lab |
| 現在判定 | Pilotで確認する。情報ObjectのCanonical化を止めない |
| 未確認時の影響 | 定量的期限、画面配置、配布手順を確定しない |
| IAで追加した未確認事項 | なし |
| IA固有の追加人間判断 | なし |
| Discoveryへ戻す条件 | 個人別失効・監査が必要、固定三Roleで運用不能、または共有Secret配布が許容不能な場合 |

## 4. 現実照合の参考情報（正式入力ではない）

この節は後続のReality Auditへ引き継ぐ参考情報であり、IA Candidateを導く正式入力ではない。前節までをUX Definitionから再導出した結果として優先する。

現行のWorkspace Grant／Repository Exposure設計は移行対象であり、Canonical候補の根拠にしない。

## 5. IA処置

[IA-000009](../../Definitions/IA-000009/ia_definition.md)へ`Same`として統合する。内容利用とAccess維持・回復は同じ情報群を共有するが、利用場面とAuthorityを分ける。

## 6. 後続工程が保持する意味

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | Role、Credential状態、Secret一度表示、処置範囲、保持対象、Recovery現在地および再入場 |
| SPEC（UX＋IAの正式入力） | 発行・検証・失効・期限・ローテーション、Secret非保存、Recovery Authority・Identity・終了後状態 |
| Quality Analysis / IA（伴走） | User非管理、Role分離、Secret非保存、Product Data保持、全喪失・破損RecoveryおよびRepository単体非依存 |

ArchitectureやSourceへ直接引き渡さない。
UI／SPECは、UX DefinitionとIA Definitionの双方を正式入力として分析する。

## 7. 補足分析

なし。

## Checklist

- [x] 正式入力となるUX Definitionを一件だけ特定した
- [x] UXの利用者成果と重要な失敗を保持した
- [x] 情報候補と利用者にとっての意味を特定した
- [x] 同じ情報と異なる情報を識別する条件を処置した
- [x] 情報同士の関係を処置した
- [x] 全Canonical Object候補を分析Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] Identity／RelationをCanonical側で再解釈させない変換根拠を残した
- [x] 状態と可視性を処置した
- [x] 時間的な意味を処置した
- [x] 情報の優先度・まとまり・見つけ方を評価した
- [x] 情報の責任者と判断権限を分けて評価した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] 欠損・誤認・古さ・競合・曖昧性を評価した
- [x] 人間判断の必要性を評価した
- [x] UXから継承する未確認事項・判断者・影響とIA固有事項を区別した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] 情報構造の検証意図を評価した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceから意味を逆輸入していない
- [x] 補足分析へ必須情報を退避していない
