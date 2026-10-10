# IA-000009 ユーザー・Role権限・接続資格・Repository範囲・Access Recovery

成果物種別: IA定義
IA ID: `IA-000009`
状態: Canonical（今回変更範囲の限定独立レビュー済み）
維持責任者: Qual-Lab

## 意味と利用者成果

Remote利用では接続資格からユーザーを識別し、現行Role詳細権限、Repositoryの公開対象、実アクセス可能性を分けて利用できる情報を判断する。管理者は最小ユーザー情報とRole権限・資格を維持する。表示名は対象識別と自身表示に限り、本人性や権限ではない。管理能力と内容Access、通常リセットとHost緊急回復を分け、Product Dataを保持する。単体Repository利用へCROS Credentialを要求しない。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000013](../../Analysis/UX-000013/ia_analysis.md) | 開発者、Project運営者／PMが接続・再接続する | ユーザー、自身表示、接続資格、Role詳細権限、Exposure、実アクセス、Repository情報責務、Session、管理能力 | 利用可能／資格要求／制限／利用不能／不明、一部だけ利用可能 | 資格→ユーザー→現行Role権限→公開対象→実アクセス。利用不能理由は非開示境界内だけで示す |
| [UX-000035](../../Analysis/UX-000035/ia_analysis.md) | 管理者が対象登録・名前／Role変更・資格リセットを行い、Host運用者が緊急回復する | ユーザー、Role権限、資格Metadata・状態・一度表示、Recovery対象・保持範囲・結果 | 資格の有効／期限切れ／失効／不明、Recovery確認待ち／進行中／blocked／completed | 対象ID・表示名→現行Role・資格状態→処置影響。緊急回復は別Host Authority→同じRecovery→再入場 |

userIdのUUID制約は正式UXから継承する。IAは安定した同一性を扱い、UUID版・Schema・生成方式を決定しない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000013: ユーザー | ユーザー | Same | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使うを保持する |
| UX-000013: 接続資格 | 接続資格 | Same | ユーザーを認証する資格を保持する |
| UX-000013: Role | Role | Same | 利用者の権限分類を保持する |
| UX-000013: Role詳細権限 | Role詳細権限 | Same | Roleが所有する情報・操作許可を保持する |
| UX-000013: Repository Exposure | Repository Exposure | Same | 許可範囲へ公開されているRepositoryを保持する |
| UX-000013: 実アクセス可能性 | 実アクセス可能性 | Same | 公開対象を実際に取得できるかを保持する |
| UX-000013: 接続中の作業単位 | 接続中の作業単位 | Same | 一回の認証済み接続を保持する |
| UX-000013: システム管理能力 | 管理能力 | Rename | 最小ユーザー情報・Role権限・Credential等の管理を保持する |
| UX-000013: Repository情報範囲 | Repository情報範囲 | Same | Repositoryが所有する情報責務を保持する |
| UX-000013: リポジトリ | リポジトリ | Same | 内容の正本と情報境界を保持する |
| UX-000035: ユーザー | ユーザー | Same | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使うを保持する |
| UX-000035: Role | Role | Same | 利用者の権限分類を保持する |
| UX-000035: Role詳細権限 | Role詳細権限 | Same | Roleが所有する情報・操作許可を保持する |
| UX-000035: 接続資格Metadata | 接続資格 | Merge | ユーザーを認証する資格を保持する |
| UX-000035: 一度表示するSecret | Secret表示境界 | Rename | 発行／通常リセット後の一度だけの秘密表示を保持する |
| UX-000035: 接続資格状態 | 接続資格状態 | Same | 資格の有効・期限切れ・失効・不明を保持する |
| UX-000035: 管理能力 | 管理能力 | Same | 最小ユーザー情報・Role権限・Credential等の管理を保持する |
| UX-000035: Access Recovery | Access Recovery | Same | HostからAccessを安全に再構成する回復を保持する |
| UX-000035: Recovery対象 | Recovery対象 | Same | Host回復のRole設定とCredential処置範囲を保持する |
| UX-000035: 保持対象 | 保持対象 | Same | 回復で変更しないProduct Dataを保持する |
| UX-000035: Recovery結果 | Recovery結果 | Same | 回復現在地・終了後状態・次の行動を保持する |

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000013: ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | Same。意味上の識別と関係を保持する |
| UX-000013: 接続資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない | 接続資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない | Same。意味上の識別と関係を保持する |
| UX-000013: Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Same。意味上の識別と関係を保持する |
| UX-000013: Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Same。意味上の識別と関係を保持する |
| UX-000013: Repository Exposure | Repository IDと公開対象範囲。Role権限や実アクセスと別 | Repository Exposure | Repository IDと公開対象範囲。Role権限や実アクセスと別 | Same。意味上の識別と関係を保持する |
| UX-000013: 実アクセス可能性 | Repository IDと現在の確認結果。公開設定だけから利用可能を推定しない | 実アクセス可能性 | Repository IDと現在の確認結果。公開設定だけから利用可能を推定しない | Same。意味上の識別と関係を保持する |
| UX-000013: 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Role権限へ結び直す | 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Role権限へ結び直す | Same。意味上の識別と関係を保持する |
| UX-000013: システム管理能力 | 現行Role詳細権限の管理許可。内容閲覧を自動的に得ない | 管理能力 | 現行Role詳細権限の管理許可。内容閲覧を自動的に得ない | Rename。意味上の識別と関係を保持する |
| UX-000013: Repository情報範囲 | Repository IDとProject／Commercial／Topic／Meeting等の情報範囲。利用者RoleやExposureではない | Repository情報範囲 | Repository IDとProject／Commercial／Topic／Meeting等の情報範囲。利用者RoleやExposureではない | Same。意味上の識別と関係を保持する |
| UX-000013: リポジトリ | Repository ID。Role権限・Exposure・実アクセスを別々に満たす範囲だけ利用可能 | リポジトリ | Repository ID。Role権限・Exposure・実アクセスを別々に満たす範囲だけ利用可能 | Same。意味上の識別と関係を保持する |
| UX-000035: ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | Same。意味上の識別と関係を保持する |
| UX-000035: Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Same。意味上の識別と関係を保持する |
| UX-000035: Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Same。意味上の識別と関係を保持する |
| UX-000035: 接続資格Metadata | Credential IDとuserId。生Secretなし、古いRole権限を固定しない | 接続資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない | Merge。意味上の識別と関係を保持する |
| UX-000035: 一度表示するSecret | 資格発行Attempt内。永続Identityにしない | Secret表示境界 | 資格発行Attempt内。永続Identityにしない | Rename。意味上の識別と関係を保持する |
| UX-000035: 接続資格状態 | Credential IDと現行状態。Reset専用永続状態を作らない | 接続資格状態 | Credential IDと現行状態。Reset専用永続状態を作らない | Same。意味上の識別と関係を保持する |
| UX-000035: 管理能力 | 現行Role詳細権限の管理許可。内容閲覧を自動的に得ない | 管理能力 | 現行Role詳細権限の管理許可。内容閲覧を自動的に得ない | Same。意味上の識別と関係を保持する |
| UX-000035: Access Recovery | Recovery IDと種別属性（Administrator Recovery／Full Access Reset）。最初の失敗から再入場まで同じIdentity | Access Recovery | Recovery IDと種別属性（Administrator Recovery／Full Access Reset）。最初の失敗から再入場まで同じIdentity | Same。意味上の識別と関係を保持する |
| UX-000035: Recovery対象 | Recovery IDと対象Credential ID／Role。Bootstrap-user結合と緊急ユーザー処置は未決 | Recovery対象 | Recovery IDと対象Credential ID／Role。Bootstrap-user結合と緊急ユーザー処置は未決 | Same。意味上の識別と関係を保持する |
| UX-000035: 保持対象 | Recovery IDとRepository／Project Context等の保持区分 | 保持対象 | Recovery IDとRepository／Project Context等の保持区分 | Same。意味上の識別と関係を保持する |
| UX-000035: Recovery結果 | Recovery IDと結果改訂版 | Recovery結果 | Recovery IDと結果改訂版 | Same。意味上の識別と関係を保持する |

同じ対象の識別と関係を分析から保持する。表示名はユーザー属性、Secretは短命表示として扱い、独立した正本や安定IDを追加しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| ユーザー | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使う | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない |
| 接続資格 | ユーザーを認証する資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない |
| Role | 利用者の権限分類 | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role |
| Role詳細権限 | Roleが所有する情報・操作許可 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし |
| Repository Exposure | 許可範囲へ公開されているRepository | Repository IDと公開対象範囲。Role権限や実アクセスと別 |
| 実アクセス可能性 | 公開対象を実際に取得できるか | Repository IDと現在の確認結果。公開設定だけから利用可能を推定しない |
| 接続中の作業単位 | 一回の認証済み接続 | Session ID、Credential ID、userId。認可は現行Role権限へ結び直す |
| Repository情報範囲 | Repositoryが所有する情報責務 | Repository IDとProject／Commercial／Topic／Meeting等の情報範囲。利用者RoleやExposureではない |
| リポジトリ | 内容の正本と情報境界 | Repository ID。Role権限・Exposure・実アクセスを別々に満たす範囲だけ利用可能 |
| 管理能力 | 最小ユーザー情報・Role権限・Credential等の管理 | 現行Role詳細権限の管理許可。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／通常リセット後の一度だけの秘密表示 | 資格発行Attempt内。永続Identityにしない |
| 接続資格状態 | 資格の有効・期限切れ・失効・不明 | Credential IDと現行状態。Reset専用永続状態を作らない |
| Access Recovery | HostからAccessを安全に再構成する回復 | Recovery IDと種別属性（Administrator Recovery／Full Access Reset）。最初の失敗から再入場まで同じIdentity |
| Recovery対象 | Host回復のRole設定とCredential処置範囲 | Recovery IDと対象Credential ID／Role。Bootstrap-user結合と緊急ユーザー処置は未決 |
| 保持対象 | 回復で変更しないProduct Data | Recovery IDとRepository／Project Context等の保持区分 |
| Recovery結果 | 回復現在地・終了後状態・次の行動 | Recovery IDと結果改訂版 |

```text
[O: 接続資格] ──認証する──▶ [O: ユーザー]
      │                           │ 一つの現行Role
      │                           ▼
      │                       [O: Role] ──持つ──▶ [O: Role詳細権限]
      │                                                 │ 許可範囲を別確認
      │                                                 ▼
      │                                        [O: Repository Exposure]
      │                                                 │ 実際の取得を別確認
      │                                                 ▼
      │                                        [O: 実アクセス可能性]
      │                                                 │ 対象
      │                                                 ▼
      │                                            [O: リポジトリ]
      │                                                 ▲ 所有責務
      │                                        [O: Repository情報範囲]
      ├─接続を識別──▶ [O: 接続中の作業単位]
      ├─現在値を持つ▶ [O: 接続資格状態]
      └─発行時だけ──▶ [O: Secret表示境界]

[O: Role詳細権限] ──管理許可──▶ [O: 管理能力]

[O: Access Recovery: Administrator Recovery / Full Access Reset]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

図は情報関係の投影であり、API実行順や保存Schemaではない。Roleで許可されてもExposureなしなら利用対象にせず、Exposureされても実取得不能なら利用可能としない。実取得可能でもRole外を開示しない。不明を許可や不存在へ畳まない。

選択したRecovery種別に、処置対象、Roleへの影響、保持対象、結果と再入場先を結ぶ。処置前にこの組合せを確認し、種別を省略して一律の回復と扱わない。種別別の具体的な失効集合はSPECで確定し、IAでは推定しない。

## 状態・可視性・時間的な意味

| 観点 | 保持する区別 |
|---|---|
| 利用状態 | 利用可能／資格要求／制限／利用不能／不明、部分可視。部分成立を全体利用可能としない |
| 資格状態 | 有効／期限切れ／失効／不明。通常リセットは旧資格失効＋新資格発行であり、rotationや新しい永続resetting状態を追加しない |
| 名前変更 | userIdとRole権限は名前の同名・改名に依存しない |
| Role変更 | 次の認可で現行詳細権限を用い、CredentialやSessionへ古い権限を固定しない |
| 通常リセット | 同じuserId・Roleを保持し、旧資格を以後の要求で拒否する。開始済み操作の取消完了とは別 |
| ユーザー可視性 | 認証済み利用者の自身表示を許可。非認証入口へユーザー情報0、非管理者へ他ユーザー一覧・存在・件数0 |
| Repository可視性 | 非開示対象の存在・名前・件数を漏らさない。利用不能理由も開示許可範囲内で示す |
| 秘密 | 発行／通常リセット後の新Secretを一度表示。保存済みSecretを一覧・ログ・Evidence・会話・Project Contextへ再表示しない |
| 緊急回復 | Host Authorityと対象・保持範囲を別に確認。確認待ち／進行中／blocked／completedを区別し、同じRecoveryへ再入場する |

発行要求と受領、失効要求と確定、回復開始と終了後確認を同一視しない。通常リセットのID保持をHost緊急回復のユーザー情報処置へ流用しない。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 利用者には自身表示名と実際に利用できるRepository、状態・部分可視・次の行動。管理者には対象ID・表示名・Role・資格状態・処置影響。緊急時は対象・保持範囲・回復現在地 |
| 情報のまとまり | 同じユーザーの資格と現行Roleへ辿れるが、名前・Identity・認可を混同しない。通常管理とHost回復はAuthorityを分ける |
| 見つけ方 | 通常利用は資格→ユーザー→現行Role権限→公開対象→実アクセス。通常管理は対象ID・表示名→Role／資格→処置影響。緊急時はHost確認→Recovery種別・対象・Role影響と保持範囲→Recovery→Bootstrap再入場 |
| 対象維持 | 処置前の対象IDを維持し、同名や名前変更で別ユーザーへ移らない。欠損・古さ・競合・不明は正常や許可へ丸めない |

### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000013 | Role詳細権限の管理、公開設定、実アクセスの確認、Repository情報範囲の宣言、ユーザー／接続文脈の提供を別責任とする | 管理者がRoleと詳細権限、Repository Ownerが情報責務を維持し、利用者が許可内の次行動を選ぶ。一つの判定から他の成立を推定しない |
| UX-000035 | 管理者が最小ユーザー情報・Role権限・資格を、Host運用者が緊急回復を、Repository OwnerがProduct Dataを維持する | 通常登録・変更・発行・リセットは管理者。緊急回復はHost Authorityと人間確認。管理能力は内容閲覧権限ではない |

ここでの主体は情報契約上の機能責任であり、実Component配置を決めない。Repository RoleはRepositoryの情報責務、利用者Roleは許可分類である。DEVのProject、MGMTのCommercial、各RepositoryのTopic／Meetingは自身の開示範囲を所有し、単一Repositoryでも必要範囲を同居できる。managerという名前だけから全Repositoryへの実アクセスを保証しない。

## 失敗・制約・未確認事項

### 重要な失敗

- UX-000013: 認証成功・公開済み・実取得可能の一つだけで全体許可を推定する。部分可視を全体成立へ畳む。非開示対象や他ユーザー情報を漏らす。
- UX-000035: 同名ユーザーを取り違える。表示名を本人性・Authorityへ昇格する。資格へ古い権限を固定する。Secretを保存・再表示し、回復でProduct Dataを削除し、別Recoveryを重ねる。

管理画面、CLI、Digest、Protocol、物理Schema・Path・Process構成は本定義で決めない。一般アカウント管理、メール・Password・本人確認・自己登録・自己編集・申請、複数Role、個別追加権限、SSO／IdP、個人行動監査製品は対象外。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | 自身表示名と安定ID、現行Role範囲・利用不能理由の理解、接続負担・失敗後の選択 | 代表利用者、Qual-Lab | 実利用確認が必要 | 定量条件と具体導線を確定しない |
| UX-000035 | 対象識別・リセット確認の負担、画面／CLI分担、有効期限既定値、Bootstrap-user結合と緊急ユーザー情報処置 | 管理者、Host運用者、Qual-Lab | Pilot／後工程で確認 | 期限・画面・配布手順・緊急ユーザー処置を確定しない |

IA固有の追加判断はない。UUID版、表示名構文・正規化・一意性、Role権限語彙、保存形式を先取りしない。本人確認・自己管理・申請、複数Role、個別追加権限、個人監査、または現在の情報構造で開示境界を表せない必要が判明した場合はDiscovery／UXへ戻す。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000013 | 自身と利用可能情報を示す時 | 名前Authority化、三可視境界違反、Role・公開・実アクセスの混同、部分成立の全体化 | 許可・公開・実取得の範囲だけ開示し、非開示存在・名前・件数を漏らさず安全な次行動へ戻る |
| UX-000035 | 登録・名前／Role変更・資格リセット、全管理資格喪失 | 対象取り違え、ID／Role喪失、古資格利用、取消完了推定、Secret保存、Product Data削除 | 最小管理で対象と処置影響を理解し、両Recovery種別の対象・Role影響・保持範囲を区別し、Host Authorityと同じRecoveryで安全に再入場する |

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 自身／管理対象の可視差、対象ID・表示名・Role権限、公開／実アクセスと部分可視、資格状態・処置影響、新Secret一度表示、回復種別・対象・Role影響・保持範囲・現在地・再入場。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持する |
| SPEC（UX＋IAの正式入力） | ユーザー資格相関、現行Role認可・Exposure・実アクセスの別判定、名前非Authority、Role変更の次認可反映、通常ResetのID／Role保持と旧資格拒否・取消分離、Secret非保存、Host回復の種別と対象・Role影響、Authority／Identity・Product Data保持。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持する |
| Quality Analysis / IA（伴走） | 各Objectの同一性と関係、名前とAuthorityの差、三可視境界、Role／公開／実アクセスの未成立と部分可視、処置対象取り違え、通常Resetと緊急回復の差、Secret非保存・単体利用非依存。Administrator Recovery／Full Access Resetを区別し、各種別の対象・Role影響・保全・結果・再入場を保持して検証する |

Architecture／Sourceへ直接引き渡さない。

## 情報源

- [UX-000013のIA分析](../../Analysis/UX-000013/ia_analysis.md)
- [UX-000035のIA分析](../../Analysis/UX-000035/ia_analysis.md)

## 補足分析

なし。

## Checklist

- [x] IA定義だけで情報契約を理解できる
- [x] 全入力UXの利用者成果・場面・対象・状態・導線を保持した
- [x] 情報Objectと利用者にとっての意味を定義した
- [x] IdentityとRelationを定義した
- [x] Source Identity／RelationからCanonical Identity／Relationへの変換を明示した
- [x] 全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] StateとVisibilityを定義した
- [x] Temporal Meaningを定義した
- [x] Priority・Grouping・Findabilityを定義した
- [x] ResponsibilityとAuthorityを分けて定義した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] Failure・Risk・Constraintを定義した
- [x] Human Inputの必要性を評価した
- [x] UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] Verification Intentを明示した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceを正本としていない
- [x] 補足分析へ必須情報を退避していない
