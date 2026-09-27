# IA-000009 Role別接続資格・Repository範囲・Access Recovery

成果物種別: IA定義
IA ID: `IA-000009`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

Remote CROSでは、接続資格に割り当てられたRoleとRepositoryの情報範囲から利用可能内容を判断する。User Accountを管理せず、管理能力と内容Accessを分け、資格の全喪失または認可破損後もProduct Dataを失わず通常管理へ戻れるようにする。Repository単体利用にはCROS Credentialを要求しない。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000013](../../Analysis/UX-000013/ia_analysis.md) | 開発者、Project運営者／PM／Remote接続を開始・再接続する時 | 接続資格、Role、Session、Repository情報範囲、利用可否、管理能力 | available／credential_required／restricted／unavailable／unknown | Credential→Role→利用可能Repository→情報範囲。管理能力は別に辿る |
| [UX-000035](../../Analysis/UX-000035/ia_analysis.md) | CROS管理者、Server Host運用者／資格を発行・失効・回復する時 | Credential Metadata、Secret表示境界、資格状態、Recovery、対象、保持対象、結果 | active／expired／revoked／rotating／unknown、確認待ち／進行中／blocked／completed | Role→Credential→状態。通常管理不能時はHost確認→Recovery→Bootstrap再入場 |

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000013: 接続資格 | 接続資格 | Same | Remote接続を認証する資格として保持する |
| UX-000013: Role | Role | Same | Remote利用範囲をUserなしで分類する |
| UX-000013: 接続中の作業単位 | 接続中の作業単位 | Same | 一回の認証済み接続を識別する |
| UX-000013: システム管理能力 | 管理能力 | Rename | 内容閲覧から分離したServer管理能力として保持する |
| UX-000013: Repository情報範囲 | Repository情報範囲 | Same | Repositoryが所有するProject／Commercial等の責務範囲を示す |
| UX-000013: リポジトリ | リポジトリ | Same | 内容正本と情報境界を示す |
| UX-000035: Role | Role | Same | 通常管理でも同じ三Roleを用いる |
| UX-000035: 接続資格Metadata | 接続資格 | Merge | Secretを除くCredential Identity、Role、状態および期限を接続資格へ統合する |
| UX-000035: 一度表示するSecret | Secret表示境界 | Rename | 発行Attempt内だけで扱い永続情報にしない |
| UX-000035: 接続資格状態 | 接続資格状態 | Same | 発行・期限・失効・ローテーションを区別する |
| UX-000035: 管理能力 | 管理能力 | Same | Credential管理と内容閲覧を分ける |
| UX-000035: Access Recovery | Access Recovery | Same | 通常Remote管理不能時のHost再入場を示す |
| UX-000035: Recovery対象 | Recovery対象 | Same | 失効・再発行する範囲を明示する |
| UX-000035: 保持対象 | 保持対象 | Same | Product Dataを変更しない範囲を明示する |
| UX-000035: Recovery結果 | Recovery結果 | Same | 現在地、終了後状態および次の行動を明示する |

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000013: 接続資格 | 接続資格識別子（Credential ID）。Secretそのものを情報Objectとして永続化しない | 接続資格 | Credential ID | Same。Remote接続資格のIdentityを維持する |
| UX-000013: Role | `administrator`／`management`／`developer`のRole ID | Role | `administrator`／`management`／`developer` | Same。固定Roleを維持する |
| UX-000013: 接続中の作業単位 | 接続単位識別子（Session ID） | 接続中の作業単位 | Session IDとCredential ID | Same。接続と資格の関係を保持する |
| UX-000013: システム管理能力 | Administrator Roleから導くが、内容閲覧範囲とは別に判定する | 管理能力 | Administrator Roleへ結ぶ | Rename。内容Accessとは別に判定する |
| UX-000013: Repository情報範囲 | Repository IDと情報範囲の組で識別する | Repository情報範囲 | Repository IDとProject／Commercial／Topic／Meeting等の範囲 | Same。所有責務を維持する |
| UX-000013: リポジトリ | Repository IDで識別する | リポジトリ | Repository ID | Same。正本境界を維持する |
| UX-000035: Role | `administrator`／`management`／`developer` | Role | `administrator`／`management`／`developer` | Same。通常管理と利用側で共有する |
| UX-000035: 接続資格Metadata | Credential ID。生Secretや同等値を含めない | 接続資格 | Credential ID。Secretを含めない | Merge。永続可能な情報だけを統合する |
| UX-000035: 一度表示するSecret | 発行Attempt内だけに存在し永続情報へ含めない | Secret表示境界 | Credential発行Attempt。永続Identityにしない | Rename。Secretを正本化しない |
| UX-000035: 接続資格状態 | Credential IDと現行状態 | 接続資格状態 | Credential ID＋状態改訂版 | Same。状態変化を追跡する |
| UX-000035: 管理能力 | Administrator Roleから導くが内容Accessとは別に判定する | 管理能力 | Administrator Roleへ結ぶ | Same。内容Accessと分離する |
| UX-000035: Access Recovery | Recovery IDを最初の失敗から再入場まで保つ | Access Recovery | Recovery ID | Same。最初の失敗から再入場まで維持する |
| UX-000035: Recovery対象 | Recovery IDとCredential ID／Role | Recovery対象 | Recovery IDとCredential ID／Role | Same。処置対象を維持する |
| UX-000035: 保持対象 | Recovery IDと保持区分 | 保持対象 | Recovery IDとProduct Data区分 | Same。非削除範囲を維持する |
| UX-000035: Recovery結果 | Recovery IDと結果改訂版 | Recovery結果 | Recovery IDと結果改訂版 | Same。現在地と終了後状態を維持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 接続資格 | Remote接続を認証し一つのRoleへ結ぶ資格 | Credential ID。生Secretや同等値を含めない |
| Role | 利用できる情報・操作範囲 | `administrator`／`management`／`developer` |
| 接続中の作業単位 | 一回の認証済み接続 | Session IDとCredential ID |
| Repository情報範囲 | Repositoryが所有する情報責務 | Repository IDとProject／Commercial／Topic／Meeting等の範囲 |
| リポジトリ | Roleと情報範囲から利用可否を判断する正本境界 | Repository ID |
| 管理能力 | CredentialやServer設定を管理する能力 | Administrator Roleから導くが内容Accessとは別に判定する |
| Secret表示境界 | 発行直後に一度だけSecretを渡す境界 | Credential発行Attempt。永続Identityにしない |
| 接続資格状態 | Credentialの現在状態 | Credential ID＋状態改訂版 |
| Access Recovery | Accessだけを再構成するHost上の回復 | Recovery ID |
| Recovery対象 | 失効・再発行するCredentialとRole | Recovery IDとCredential ID／Role |
| 保持対象 | Recoveryで変更しないProduct Data | Recovery IDとProduct Data区分 |
| Recovery結果 | 現在地、終了後状態および次の安全な行動 | Recovery IDと結果改訂版 |

```text
[O: 接続資格] ──割り当てる──▶ [O: Role]
      │                            ├─利用範囲を決める──▶ [O: リポジトリ]
      │                            │                           ▲
      │                            │                           │ 所有範囲を宣言
      │                            │                           │
      │                            └─administratorだけ──▶ [O: 管理能力]
      ├─作る──▶ [O: 接続中の作業単位]         [O: Repository情報範囲]
      ├─現在値を持つ──▶ [O: 接続資格状態]
      └─発行時だけ渡す▶ [O: Secret表示境界]

[O: Access Recovery]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

## 状態・可視性・時間的な意味

利用可否は`available`／`credential_required`／`restricted`／`unavailable`／`unknown`、Credentialは`active`／`expired`／`revoked`／`rotating`／`unknown`、Recoveryは確認待ち／進行中／`blocked`／`completed`を区別する。非開示Repositoryの存在を推測表示しない。Secretは発行時だけ表示し、一覧、ログ、Evidence、会話またはProject Contextに残さない。発行要求、Secret受領、失効要求、失効確定、Recovery開始および終了後確認を同一視しない。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 利用者にはRole内で利用可能なRepositoryと次の行動を先に示す。管理者にはCredential状態、処置範囲、保持対象、Recovery現在地を先に示す |
| 情報のまとまり | 内容利用とAccess管理を同じObject群で追跡できるが、利用場面とAuthorityは分ける |
| 見つけ方 | 通常利用はCredential→Role→Repository。通常管理はRole→Credential→状態。緊急時はHost確認→Recovery→Bootstrap再入場 |

### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000013 | Repository Ownerが情報範囲を、CROSがCredential・Role・Sessionから利用可能集合を提供する | CROS管理者がRoleを割り当て、利用者がRole内で次の行動を選ぶ |
| UX-000035 | CROS管理者が通常Credentialを、Server Host運用者がAccess Recovery記録を保つ | 通常発行・失効はCROS管理者、全喪失・破損RecoveryはHost Authorityと人間確認が決める |

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

AdministratorであることからManagement内容へのAccessを推定しない。標準分離ではDEV RepositoryがProjectを、MGMT RepositoryがCommercialを所有し、Management利用者はRoleで両方を利用できる。Topic／Meetingは両Repositoryが同じ契約で自身の開示範囲だけを所有する。単一Repositoryでは必要な範囲を同居できる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000013`: Role外Repositoryの存在や内容を推測表示する。
- `UX-000035`: Secretを保存・再表示する、Administratorへ内容Accessを自動付与する、RecoveryでProduct Dataを削除する、途中失敗後に別Recoveryを重ねる。

具体的な管理画面、CLI、Digest方式、認証Protocol、Schema、Process構成および物理Folderは本定義で決めない。User Account、個人別申請、SSO、IdPおよびMulti-tenant IAMは対象外とする。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | Role範囲と利用不能理由の理解しやすさ | 開発者、Project運営者／PM、Qual-Lab | Pilotで確認する | 表示粒度と具体的な利用導線を確定しない |
| UX-000035 | 共有Credential配布負担、管理画面とCLIの分担、有効期限既定値 | CROS管理者、Server Host運用者、Qual-Lab | Pilotで確認する | 定量条件、画面配置、配布手順を確定しない |

個人別失効・監査が必要、固定三Roleで運用不能、共有Secret配布が許容不能、またはRepository情報範囲で開示境界を表せない場合はDiscovery／UXへ戻す。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000013 | 利用可能情報を示す時 | Role外対象の存在・内容を推測表示する | Roleで許可されたRepositoryだけを開示する |
| UX-000035 | 全Administrator Credentialを失った時 | Remote認証依存、Secret保存、Product Data削除、別Recoveryの重複 | Host Authorityと同一RecoveryでAccessだけを再構成する |

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | Role、利用可能Repository、Credential状態、Secret一度表示、Recovery対象・保持対象・現在地・再入場 |
| SPEC（UX＋IAの正式入力） | 発行・検証・Session・失効・期限・ローテーション、非開示、Secret非保存、Recovery Authority・Identity・終了後状態 |
| Quality Analysis / IA（伴走） | Role外非開示、管理能力分離、User非管理、Secret非保存、Product Data保持、Repository単体非依存 |

ArchitectureやSourceへ直接引き渡さない。

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
