# IA分析: 軽量なユーザー管理でRemote Accessを維持・回復する

成果物種別: IA分析
分析対象: [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)
状態: 分析済み（今回変更範囲の限定独立レビュー済み）

## 1. UXから受け取る意味

| 観点 | この分析で受け取る内容 |
|---|---|
| 利用者 | CROS管理者、Server Host運用者 |
| 場面 | ユーザー登録、表示名／Role変更、資格発行・リセット、漏洩、管理資格全喪失、認可状態破損 |
| 目的 | 対象を見分け、最小管理でRemote利用範囲を維持し、安全に通常管理へ戻る |
| 得たい結果 | 資格を発行・リセット・回復し、必要な再設定だけを案内できる |
| 重要場面 | administrator Roleのユーザー資格をすべて失った時 |
| 避ける失敗 | 別ユーザー処置、名前のAuthority化、Secret保存、管理能力からの内容権限推定、別Recovery重複、Product Data削除 |
| 守る品質 | 通常リセットとHost回復を分け、対象・影響・保持範囲と安全な再入場を示す |

userIdのUUID制約は正式UXから継承する。IAは安定した同一性を扱い、UUID版・Schema・生成方式を決定しない。

## 2. 情報候補と関係

| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |
|---|---|---|
| ユーザー | 資格の対象。表示名は管理者の対象識別と自身表示に限る | 安定userId。表示名は属性であり、同名・改名でIdentityや権限を変えない。一つの現行Roleへ結ぶ |
| Role | 利用する権限の分類 | `administrator`／`manager`／`developer`。Repository RoleやTask Roleと別 |
| Role詳細権限 | Roleが所有する情報・操作の許可範囲 | Role IDに結ぶ。ユーザーやCredentialへ個別追加権限を持たせない |
| 接続資格Metadata | ユーザーへ紐づく資格の識別・状態・期限 | Credential IDとuserId。生Secretや同等値を含めず、古いRole権限を固定しない |
| 一度表示するSecret | 発行または通常リセット後に一度渡す秘密 | 発行Attempt内だけ。永続情報へ含めない |
| 接続資格状態 | 有効・期限切れ・失効・不明の差 | Credential IDと現行状態。通常リセットは旧資格失効と新資格発行の関係であり、新しい永続状態を作らない |
| 管理能力 | 最小ユーザー情報・Role権限・Credential等を管理する能力 | 現行Roleの管理権限から判定する。内容閲覧を自動的に得ない |
| Access Recovery | 全喪失または認可破損からAccessを安全に再構成する回復 | Recovery IDを最初の失敗から再入場まで保つ。種別属性としてAdministrator Recovery／Full Access Resetを区別する |
| Recovery対象 | Host回復で処置するRole設定とCredentialの範囲 | Recovery IDと対象のCredential ID／Role。BootstrapとuserIdの結合・緊急時ユーザー情報処置は未決 |
| 保持対象 | 変更しないRepository、Project Contextその他のProduct Data | Recovery IDと保持区分 |
| Recovery結果 | 現在地、終了後状態、次の安全な行動 | Recovery IDと結果改訂版 |

```text
[O: 接続資格Metadata] ──紐づく──▶ [O: ユーザー]
        │                            │ 一つの現行Role
        │                            ▼
        │                        [O: Role]
        │                            └─持つ──▶ [O: Role詳細権限]
        │                                            └─管理権限──▶ [O: 管理能力]
        ├─発行時だけ──▶ [補足: 一度表示するSecret]
        └─現在値を持つ▶ [O: 接続資格状態]

[O: Access Recovery: Administrator Recovery / Full Access Reset]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

図中の`[O:]`は情報Objectを示す。表示名はユーザーの属性であり独立Identityを発行しない。通常リセットで同じuserId・Roleを保持し、旧Credentialを失効して新Credentialへ結ぶ。Host回復のユーザー情報処置へこの保持保証を流用しない。

### Canonical化候補

| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|---|
| IA-000009 | ユーザー | ユーザー | Same | 最小識別と表示専用名を利用・管理の両場面で共有する |
| IA-000009 | Role | Role | Same | 固定三Roleを利用・管理で共有する |
| IA-000009 | Role詳細権限 | Role詳細権限 | Same | 現行Roleが許可範囲を所有する |
| IA-000009 | 接続資格Metadata | 接続資格 | Merge | Secretを除いた識別・ユーザー結合・状態・期限を統合する |
| IA-000009 | 一度表示するSecret | Secret表示境界 | Rename | 発行／通常リセット時の一時表示として扱う |
| IA-000009 | 接続資格状態 | 接続資格状態 | Same | 有効・期限・失効・不明を区別する |
| IA-000009 | 管理能力 | 管理能力 | Same | 内容Accessから分離する |
| IA-000009 | Access Recovery | Access Recovery | Same | Hostからの再入場を表す |
| IA-000009 | Recovery対象 | Recovery対象 | Same | Role設定とCredentialの安全化範囲を表す |
| IA-000009 | 保持対象 | 保持対象 | Same | Product Data非変更を表す |
| IA-000009 | Recovery結果 | Recovery結果 | Same | 現在地、終了後状態、次の行動を表す |

選択したRecovery種別に、処置対象、Roleへの影響、保持対象、結果と再入場先を結ぶ。処置前にこの組合せを確認し、種別を省略して一律の回復と扱わない。種別別の具体的な失効集合はSPECで確定し、IAでは推定しない。

## 3. 状態・可視性・導線・責任

| 観点 | 分析結果 |
|---|---|
| 状態 | Credentialの有効／期限切れ／失効／不明、Recoveryの確認待ち／進行中／blocked／completedを区別する |
| 可視性 | 管理者は対象ID・表示名・Role・資格Metadataを確認する。認証済み利用者の自身表示を許可し、非認証入口へユーザー情報、非管理者へ他ユーザー一覧・存在・件数を開示しない。Secretは発行／リセット時だけ一度表示し、一覧・ログ・Evidence・会話に残さない |
| 導線 | 対象ユーザーのID・表示名→現行Role／資格状態→登録・表示名／Role変更・発行・リセットの影響確認。Host回復はHost Authority→Recovery種別・対象・Role影響・保持範囲→同じRecovery→Bootstrap再入場 |
| 責任 | CROS管理者が最小ユーザー情報・Role詳細権限・Credentialを管理する。Host運用者が緊急Recovery Authorityを、Repository OwnerがProduct Dataを所有する |
| 時間的な意味 | 表示名変更はID・権限変更ではない。Role権限変更は次の認可へ反映する。通常リセットはID・Roleを保持し旧資格を以後の要求で拒否するが、開始済み操作の取消完了とは別 |
| 情報の優先度 | 通常は対象ID・表示名・Role・Credential状態と処置影響。緊急時は処置範囲、保持対象、Recovery現在地と次の安全な行動 |
| 情報のまとまり | 対象ユーザーとRole権限・資格を辿れるが、通常管理とHost回復のAuthority・Effectは別 |
| 判断権限 | 最小ユーザー情報・Role割当・Role詳細権限はCROS管理者。Host回復はServer HostのAuthorityと人間確認。管理能力だけから内容閲覧を推定しない |
| 重要な失敗 | 同名対象の取り違え、名前のAuthority化、他ユーザー非開示違反、古いRole権限の固定、Secret再表示、Product Data削除、Recovery Identity喪失 |
| 制約・対象外 | 画面・CLI・Digest・Protocol・Schema・Process配置は未決。メール・Password・本人確認・自己登録・自己編集・申請・複数Role・個別追加権限・一般IAMを追加しない |
| 人間判断 | 対象識別とリセット確認の負担、画面とCLIの分担、有効期限既定値をPilotで確認する |
| IAへ戻す条件 | 対象の同一性、Role権限、三可視境界、通常リセットとHost回復の区別を情報構造から再構成できない場合 |
| 検証意図 | 同名・改名でもIDと権限を誤認せず、通常リセットのID・Role保持／旧資格拒否、Role変更の次認可反映、三可視境界、Secret非保存、両Recovery種別の対象・Role影響・再入場とProduct Data保持を確認する |

責任は情報契約上の機能責任を表す。実Componentへの割当は後工程で行う。

### 未確認事項と判断

| 区分 | 内容 |
|---|---|
| UXから継承する確認事項 | 対象識別とリセット確認の負担、管理画面とCLIの分担、有効期限既定値。BootstrapとuserIdの結合、緊急時の最小ユーザー情報処置は後工程で確定する |
| 判断者 | CROS管理者、Host運用者、Qual-Lab |
| 現在判定 | Pilot／後工程で確認。IA Candidateを止めない |
| 未確認時の影響 | 定量期限・画面配置・配布手順・緊急時ユーザー処置を確定しない |
| IAで追加した未確認事項 | なし。UUID版・表示名構文／正規化／一意性・物理Schemaを先取りしない |
| IA固有の追加人間判断 | なし |
| Discoveryへ戻す条件 | 本人確認、自己管理、申請、複数Role、個別追加権限、個人行動監査が必要となった場合 |

## 4. 現実照合の参考情報（正式入力ではない）

現行SourceのCredential単位Grantや旧Role別共有Credentialは移行比較の対象であり、Canonical IAの正式入力としない。前節までの意味はUX Definitionから導く。

## 5. IA処置

[IA-000009](../../Definitions/IA-000009/ia_definition.md)へ`Same`として統合する。対象の維持・回復に必要な情報群を更新し、利用場面とAuthorityを分ける。新IA IDを発行しない。

## 6. 後続工程が保持する意味

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 対象ID・表示名・現行Role・詳細権限、管理対象と自身表示の可視差、資格状態、処置影響、発行／リセット後のSecret一度表示、Recovery種別・対象・Role影響・保持範囲・再入場。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持する |
| SPEC（UX＋IAの正式入力） | ユーザー相関、名前非Authority、Role詳細権限の次認可反映、通常リセットのID・Role保持／旧資格拒否と取消分離、Secret非保存、Host Recovery種別と対象・Role影響、Authority・Identity・Product Data保持。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持する |
| Quality Analysis / IA（伴走） | 同名・改名、三可視境界、対象取り違え、Role権限と資格の分離、通常リセットとHost回復の差、Secret非保存、Product Data保持、単体利用非依存。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持して検証する |

Architecture／Sourceへ直接引き渡さない。UI／SPECはUXとIA Definitionの双方を正式入力とする。

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
