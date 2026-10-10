# IA分析: 軽量なユーザー管理でRemote Accessを維持・回復する

成果物種別: IA分析
分析対象: [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)
状態: 分析済み（最新鍵管理判断の限定独立レビュー済み・残指摘0）

## 1. UXから受け取る意味

鍵の発行・独立失効・交換はadministrator専用固定で、Role詳細権限のON／OFF設定を設けない。通常入口は同一Process Workbench backendだけとし、MCPには秘密値の有無を問わず鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで、鍵交換2操作だけを扱う。追加認証・専用資格・承認コード・OS管理者昇格を要求せず、既存の管理Root／Path検証は維持する。ユーザー管理・Role設定・Repository登録・公開範囲管理の担当Roleと設定可否はOPENのままとし、許可を先取りしない。

| 観点 | この分析で受け取る内容 |
|---|---|
| 利用者 | CROS管理者、Server Host運用者 |
| 場面 | ユーザー登録、表示名／Role変更、資格発行・鍵交換、漏洩、管理資格全喪失 |
| 目的 | 対象を見分け、最小管理でRemote利用範囲を維持し、安全に通常管理へ戻る |
| 得たい結果 | 資格を発行・リセット・回復し、必要な再設定だけを案内できる |
| 重要場面 | administrator Roleのユーザー資格をすべて失った時 |
| 避ける失敗 | 別ユーザー処置、名前のAuthority化、Secret保存、管理能力からの内容権限推定、別Recovery重複、Product Data削除 |
| 守る品質 | 2操作の対象範囲と通常／Hostの入口・Authorityを別軸で示し、保持範囲と安全な再入場を確認できる |

userIdのUUID制約は正式UXから継承する。IAは安定した同一性を扱い、UUID版・Schema・生成方式を決定しない。

## 2. 情報候補と関係

| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |
|---|---|---|
| ユーザー | 資格の対象。表示名は管理者の対象識別と自身表示に限る | 安定userId。表示名は属性であり、同名・改名でIdentityや権限を変えない。一つの現行Roleへ結ぶ |
| Role | 利用する権限の分類 | `administrator`／`manager`／`developer`。Repository RoleやTask Roleと別 |
| Role詳細権限 | Roleが所有する情報・操作の許可範囲 | Role IDに結ぶ。ユーザーやCredentialへ個別追加権限を持たせない |
| 接続資格Metadata | ユーザーへ紐づく資格の識別・状態・期限 | Credential IDとuserId。生Secretや同等値を含めず、古いRole権限を固定しない |
| 一度表示するSecret | 発行または鍵交換後に一度渡す秘密 | 発行Attempt内だけ。永続情報へ含めない |
| 接続資格状態 | 有効・期限切れ・失効・不明の差 | Credential IDと現行状態。鍵交換は旧資格失効と新資格発行の関係であり、新しい永続状態を作らない |
| 管理能力 | 最小ユーザー情報・Role権限・Credential等を管理する能力 | 鍵操作はadministrator専用固定、その他は現在の許可に基づく（4管理群の割当・設定可否はOPEN）。内容閲覧を自動的に得ない |
| Access Recovery | 通常管理またはHostから鍵だけを交換して接続へ戻る回復 | Recovery IDを最初の失敗から再入場まで保つ。操作種別（指定ユーザー交換／全員交換）と入口・Authorityは別属性 |
| Recovery対象 | 鍵交換の対象ユーザー・失効資格集合・新資格発行先 | Recovery ID、対象userId、失効対象Credential集合、発行先userId。指定交換は同じユーザー、全員交換は指定既存administrator |
| 保持対象 | 変更しないユーザーID・表示名・Role・詳細権限・Repository登録・Product Data | Recovery IDとユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataの保持区分 |
| Recovery結果 | 現在地、終了後状態、次の安全な行動 | Recovery IDと結果改訂版。失効確定範囲と新資格発行結果を分離し、不明を保持する |

```text
[O: 接続資格Metadata] ──紐づく──▶ [O: ユーザー]
        │                            │ 一つの現行Role
        │                            ▼
        │                        [O: Role]
        │                            └─持つ──▶ [O: Role詳細権限]
        │                                            └─他4管理群の現在許可（割当・設定可否OPEN）──▶ [O: 管理能力]
        ├─発行時だけ──▶ [補足: 一度表示するSecret]
        └─現在値を持つ▶ [O: 接続資格状態]

[O: Role] ──administrator固定・設定不可の鍵3操作──▶ [O: 管理能力]

[O: Access Recovery]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

図中の`[O:]`は情報Objectだけを表す。表示名はユーザーの属性であり独立Identityを発行しない。両入口で既存userIdへ新資格を結び、ユーザー情報・Role・詳細権限を保持する。表示名は対象Identityではない。

### Canonical化候補

| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|---|
| IA-000009 | ユーザー | ユーザー | Same | 最小識別と表示専用名を利用・管理の両場面で共有する |
| IA-000009 | Role | Role | Same | 固定三Roleを利用・管理で共有する |
| IA-000009 | Role詳細権限 | Role詳細権限 | Same | 現行Roleが許可範囲を所有する |
| IA-000009 | 接続資格Metadata | 接続資格 | Merge | Secretを除いた識別・ユーザー結合・状態・期限を統合する |
| IA-000009 | 一度表示するSecret | Secret表示境界 | Rename | 発行／鍵交換時の一時表示として扱う |
| IA-000009 | 接続資格状態 | 接続資格状態 | Same | 有効・期限・失効・不明を区別する |
| IA-000009 | 管理能力 | 管理能力 | Same | 内容Accessから分離する |
| IA-000009 | Access Recovery | Access Recovery | Same | 両入口から鍵交換後の再入場を表す |
| IA-000009 | Recovery対象 | Recovery対象 | Same | 操作種別と対象userId・失効集合・発行先の関係を表す |
| IA-000009 | 保持対象 | 保持対象 | Same | ユーザー情報・権限・登録・Product Data非変更を表す |
| IA-000009 | Recovery結果 | Recovery結果 | Same | 現在地、終了後状態、次の行動を表す |

操作種別と入口・Authorityは別の属性とし、4組合せを別Objectへ分けない。

| 入口と操作 | 処置前表示 | 明示確認 |
|---|---|---|
| 通常Workbench × 指定ユーザー交換 | 対象ID・表示名、失効範囲、発行先、保持情報 | 追加確認なし |
| 通常Workbench × 全員交換 | 同上 | 必須 |
| Host CLI × 指定ユーザー交換 | 同上 | 必須 |
| Host CLI × 全員交換 | 同上 | 必須 |

| 鍵交換の操作 | 失効する旧有効資格 | 新資格の発行先 | 他ユーザーへの影響 |
|---|---|---|---|
| 指定ユーザー交換 | 対象userIdの資格すべて | 同じ既存userId | 他ユーザーの鍵は保持 |
| 全員交換 | 全ユーザーの資格すべて | 指定した既存administrator userId | 管理者による通常の再発行・再配布まで旧資格は利用不能 |

| 入口 | 処置前の権限・確認 | 操作の意味 |
|---|---|---|
| 通常管理 | 同一Process Workbenchの固定administrator権限。全員交換だけ人間が明示確認 | 上記2操作 |
| Host緊急操作 | ログイン済みローカル操作者と人間の明示確認。追加認証・専用資格・承認コード・OS管理者昇格なし | 上記と同じ2操作 |

両入口でユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataを保持する。表示名を対象Identityにせず、特別ユーザー・追加権限・回復専用Bootstrapを作らない。初回Server設定方式は変更しない。

失効後の発行失敗・応答喪失・Process喪失では、失効確定範囲と発行結果の不明を非秘密の耐久的な事実として同じRecovery IDへ結ぶ。再入場は現在状態の再観測後に判断し、再観測なしに完了・rollback・旧資格未失効・開始済み操作取消済みへ畳まない。Secretを再表示せず、新しいRecoveryを重ねない。対象ユーザー、全員交換の既存administrator、必要な資格集合・現行権限を安全に確認できない場合や認可設定が破損している場合は処置前停止する。鍵交換は認可設定を修復しない。

## 3. 状態・可視性・導線・責任

| 観点 | 分析結果 |
|---|---|
| 状態 | Credentialの有効／期限切れ／失効／不明、Recoveryの確認待ち／進行中／blocked／completedを区別する |
| 可視性 | 管理者は対象ID・表示名・Role・資格Metadataを確認する。認証済み利用者の自身表示を許可し、非認証入口へユーザー情報、現在他ユーザー参照を許可されていない主体へ他ユーザー一覧・存在・件数を開示しない。Secretは発行／リセット時だけ一度表示し、一覧・ログ・Evidence・会話に残さない |
| 導線 | 対象ユーザーのID・表示名→現行Role／資格状態→処置影響。鍵交換は通常Workbenchの固定administrator権限またはログイン済みHost操作者→操作種別・対象userId・失効集合・発行先・保持範囲の確認→同じRecovery→既存ユーザーの新資格で再入場。Host入口と全員交換は人間が明示確認する |
| 責任 | 現在許可された主体が最小ユーザー情報・Role詳細権限を、administratorが鍵操作を管理する。Hostのログイン済みローカル操作者が限定鍵交換を、Repository OwnerがProduct Dataを所有する |
| 時間的な意味 | 表示名変更はID・権限変更ではない。Role権限変更は次の認可へ反映する。鍵交換はID・Roleを保持し旧資格を以後の要求で拒否するが、開始済み操作の取消完了とは別 |
| 情報の優先度 | 通常は対象ID・表示名・Role・Credential状態と処置影響。緊急時は処置範囲、保持対象、Recovery現在地と次の安全な行動 |
| 情報のまとまり | 対象ユーザーとRole権限・資格を辿れるが、通常管理とHostは入口・Authorityだけを分け、2操作の処置意味は共通 |
| 判断権限 | 鍵操作はadministrator専用固定。他4管理群の担当Role・設定可否はOPEN。Host回復はログイン済みローカル操作者と人間確認。管理能力だけから内容閲覧を推定しない |
| 重要な失敗 | 同名対象の取り違え、名前のAuthority化、他ユーザー非開示違反、古いRole権限の固定、Secret再表示、Product Data削除、Recovery Identity喪失 |
| 制約・対象外 | 採用済みWorkbench／Host CLI入口の表示具体化、Digest・Protocol・Schema・Process配置は未決。メール・Password・本人確認・自己登録・自己編集・申請・複数Role・個別追加権限・一般IAMを追加しない |
| 人間判断 | 対象識別とリセット確認の負担、採用済みWorkbench／Host CLI入口の具体的な表示・案内、有効期限既定値をPilotで確認する |
| IAへ戻す条件 | 対象の同一性、Role権限、三可視境界、操作範囲と入口・Authorityの区別を情報構造から再構成できない場合 |
| 検証意図 | 同名・改名でもIDと権限を誤認せず、両鍵交換の対象範囲・発行先と情報保持／旧資格拒否、入口Authority差、Role変更の次認可反映、三可視境界、Secret非保存、途中失敗時の同じRecoveryと現在再観測を確認する |

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。実Componentへの割当は後工程で行う。

### 未確認事項と判断

| 区分 | 内容 |
|---|---|
| UXから継承する確認事項 | 対象識別とリセット確認の負担、採用済みWorkbench／Host CLI入口の具体的な表示・案内、有効期限既定値。既存userIdへの結合とユーザー情報・Role保持は採用済み |
| 判断者 | CROS管理者、Host運用者、Qual-Lab |
| 現在判定 | Pilot／後工程で確認。IA Candidateを止めない |
| 未確認時の影響 | 定量期限・画面配置・配布手順を確定しない |
| IAで追加した未確認事項 | なし。UUID版・表示名構文／正規化／一意性・物理Schemaを先取りしない |
| IA固有の追加人間判断 | なし |
| Discoveryへ戻す条件 | 本人確認、自己管理、申請、複数Role、個別追加権限、個人行動監査が必要となった場合 |

## 4. 現実照合の参考情報（正式入力ではない）

この節は後続のReality Auditへ引き継ぐ参考情報であり、IA Candidateを導く正式入力ではない。現行SourceのCredential単位Grantや旧Role別共有Credentialは移行比較の対象であり、Canonical IAの正式入力としない。前節までの意味はUX Definitionから導く。

## 5. IA処置

[IA-000009](../../Definitions/IA-000009/ia_definition.md)へ`Same`として統合する。対象の維持・回復に必要な情報群を更新し、利用場面とAuthorityを分ける。新IA IDを発行しない。

## 6. 後続工程が保持する意味

UI／SPEC／Qualityへの各引渡しは、固定administrator鍵操作、Workbench通常入口、MCP鍵操作非公開、追加認証なしのHost交換2操作、既存Root／Path、4組表示・3組確認と他4管理群OPENを保持する。独立失効は新鍵発行も開始済みTaskの取消も行わない。

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 対象ID・表示名・現行Role・詳細権限、管理対象と自身表示の可視差、資格状態、処置影響、発行／リセット後のSecret一度表示、鍵交換2操作の範囲・発行先、入口Authority差、保持範囲・結果・再入場を示す。失効確定と発行不明を分離し、権限設定破損での処置前停止を保持する |
| SPEC（UX＋IAの正式入力） | ユーザー相関、名前非Authority、Role詳細権限の次認可反映、鍵交換のID・Role保持／旧資格拒否と取消分離、Secret非保存、2操作の失効集合・既存発行先と入口Authority、Identity・ユーザー情報・Role権限・登録・Product Data保持。失敗・応答喪失・Process喪失時の同じRecovery、既知失効／発行不明と再観測後の再入場を保持する |
| Quality Analysis / IA（伴走） | 同名・改名、三可視境界、対象取り違え、Role権限と資格の分離、2操作と2入口の別軸、Secret非保存、情報保持、単体利用非依存。対象不明・管理者不存在・認可設定破損での処置前停止、失敗・応答喪失・Process喪失後の失効確定／発行不明、再観測なしの完了・rollback拒否を検証する |

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
