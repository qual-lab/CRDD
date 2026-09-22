# Project Operation Contextのアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: project-operation
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project／Portfolioの運営状態を複数正本から根拠付きRead Modelへ統合する。Objective／Milestone受入判断の書込みPortは所有しない。 | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Meeting、Topic、Decision候補と所有正本への昇格関係をRepository上で具体化する。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 発生時点、採用時点、観測時点、現行性を分け、過去を現在値へ上書きしない。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Project Operation Core、Resolver、Projection、Command Routerを分ける。 | [§9](#9-component境界) |
| Interface Model | Required | Project、Commercial、Topic、Meeting、Communicationの正本責務を分ける。 | [§4](#4-責務境界) |
| Data Flow | Required | 複数正本から根拠付きRead Modelを作る流れを示す。 | [§7](#7-project-management-projection) |
| State Model | Required | Topic、Meeting、候補、採用先と履歴の状態を分ける。 | [§6](#6-topicとmeetingのlifecycle) |
| Sequence | Required | Meetingから候補、判断、正本への昇格順序を固定する。 | [§6](#6-topicとmeetingのlifecycle) |
| Failure／Recovery | Required | 競合、欠測、制限、古いProjectionを正常へ畳まない。 | [§10](#10-実装前の検証義務) |
| Deployment | Required | ContextごとのRepository同居・分離が情報境界に影響する。 | [§8](#8-任意repository構造) |
| Observability | Required | 各表示値からSource、Revision、観測時点へ戻れるようにする。 | [§7](#7-project-management-projection) |
| Security Boundary | Required | Repository分離と利用可能性を保ち、非公開内容の存在を漏らさない。 | [§3](#3-repository分離とアクセス境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 正本更新はIdentityと基準改訂版を確認し、競合を無言で上書きしない。 | [正本節](#6-topicとmeetingのlifecycle) |
| Timing | PASS | Meeting発生、候補生成、採用、投影観測の時点を分ける。 | [正本節](#7-project-management-projection) |
| Resource Lifecycle | PASS | CandidateとProjectionのOwner、保持、採否、再生成、清掃条件を分ける。 | [§12](#12-identityprojectioncandidate契約) |
| External Boundary | PASS | 分離RepositoryとCROSを境界とし、アクセス不能Contextを推測しない。 | [正本節](#3-repository分離とアクセス境界) |
| Failure／Recovery | PASS | Repository IDをopaque identityとして扱い、Projectionの欠測・競合fieldを保持する。 | [§12](#12-identityprojectioncandidate契約) |
| State／Consistency | PASS | Topic、Meeting、候補、採用先と履歴の状態を分ける。 | [§6](#6-topicとmeetingのlifecycle) |
| Observability | PASS | 各表示値からSource、Revision、観測時点へ戻れるようにする。 | [§7](#7-project-management-projection) |
| Security／Trust | PASS | Repository分離と利用可能性を保ち、非公開内容の存在を漏らさない。 | [§3](#3-repository分離とアクセス境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `project-operation.context-lifecycle` | Transition／Consistency | IDと基準Revision | 候補から明示採用 | 二重正本、競合更新、媒体名誤分類 | IT／UAT | User Acceptance | status、source、relation | 採否後の候補処置 | 物理保存形式はDevelopmentで選択 |
| `project-operation.project-projection` | Flow／Consistency | 複数正本 | 根拠・欠測付きread model | restricted漏えい、staleのcurrent化 | IT／ST／UAT | User Acceptance | source coverageとobserved_at | 正本Effect 0 | 表示構成はUI実装で選択 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-12
関連変更: [CHG-000067](../../../99_Roadmap/Changes/CHG-000067/change.md)

## 1. 対象と結論

Project Operation Contextは、案件の安定情報、継続論点、時点付き活動および既存CRDD正本を、Project運営に必要な読取り専用Viewへ接続する意味モデルである。Project Management Projectionを正本、更新StoreまたはWorkbench専用Databaseにしない。

```text
                 Project
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Commercial     Topics      Meetings
                      │           │
                      └─────┬─────┘
                            ▼
                 Project Management
                     Projection
                            │
                      ┌─────┴─────┐
                      ▼           ▼
                    Human       AI／MCP

CRDD Context ──→ Communication ──→ External Audience
                                            │
                                            ▼
                                        Observation
                                            │
                     Topic／Discovery／UX等へ候補として還流
```

矢印は参照または候補の受渡しを示し、Authorityの継承を示さない。Projectionから正本への更新は、対象正本が所有する専用Commandまたは変更候補を経由する。

## 2. IdentityとRepository Relation

```text
Project ID
  │
  ├─ Repository ID: repository-a
  │    ├─ Context Responsibility: project
  │    ├─ Context Responsibility: topics
  │    └─ Binding ID: canonical checkout
  │
  ├─ Repository ID: repository-b
  │    ├─ Context Responsibility: meetings
  │    └─ Binding ID: restricted checkout
  │
  └─ Repository ID: repository-c
       ├─ Context Responsibility: commercial
       ├─ Context Responsibility: communication
       └─ Binding ID: communication checkout
```

| Identity | 所有する意味 | 所有しない意味 |
|---|---|---|
| Project ID | 継続する案件、製品開発または目的集合の論理Identity | Repository Path、clone、実行許可、Organization Authority |
| Repository ID | Projectに属する一つの論理Repository | 単一の責務役割、実在Path、worktree、Credential、書込み許可 |
| Context Responsibility | Repositoryが正本として所有すると宣言する責務領域の集合 | 他RepositoryのAuthority、Relation先の内容、Tool実行Capability |
| Repository Binding ID | Repository IDと検証済みRoot／worktreeの実行時結合 | Project全体のAuthority、別Bindingの代替権限 |
| Artifact ID | Topic、Meeting、CHG等の所有正本内Identity | Relation先のAuthorityまたは現在性 |

v0.21のRepository ManifestはProject IDとRepository IDを別fieldとして保持する。同じProject IDに異なるRepository IDを関連付けられるが、同じRepository IDに複数の書込み可能Bindingがある場合は自動選択しない。Relation解決とOperation Authorizationを分離し、CROSは対象Binding、Principal、Policy、Revisionおよび操作AuthorityをRepositoryごとに再検証する。

Repository-local `.crdd`は、そのRepositoryの設定・状態・Evidence・一時物だけを保持する。Project IDが同じ別Repositoryの情報を、代表Repositoryの`.crdd`へ集約しない。

### 2.1. 責務領域の任意分割

Repositoryは単一の`Role`へ固定せず、所有するContext Responsibilityを複数宣言できる。Project、Commercial、Topics、Meetings、Communicationまたは工程領域は、同一Repositoryに同居しても、領域ごとに別Repositoryへ分離してもよい。

```text
Logical Project: PRJ-001
  │
  ├─ Repository A
  │    ├ Project
  │    ├ Discovery／UX／IA／UI／SPEC
  │    └ Development／Quality／Release
  │
  ├─ Repository B
  │    └ Topics
  │
  ├─ Repository C
  │    └ Meetings
  │
  └─ Repository D
       ├ Commercial
       └ Communication
```

| 規則 | 結果 |
|---|---|
| 一つのRepositoryが複数領域を所有する | 宣言した領域を同じBindingから読み取れる |
| 一つの領域を別Repositoryへ分離する | 同じProject ID、異なるRepository IDおよび責務宣言で接続する |
| Repositoryに対象領域がない | 空Directoryを作らず、その責務を宣言しない |
| 同じProject内で複数Repositoryが同じ責務をCanonical Ownerとして宣言する | 明示した分割規則がなければ`conflicting`として扱い、自動選択しない |
| 同じ責務を分割所有する必要がある | Artifact IDのnamespace、partitionまたは対象範囲を別契約で明示する。Pathや検索順で所有者を決めない |

Repository Manifestの既存`capabilities`はTool／Runtime Capabilityを表す。Context Responsibilityと混同せず、v0.21のSchemaでは別fieldとして表現する。CROSは責務宣言だけでRepositoryを信頼せず、検証済みBindingとTrust Policyの許可範囲を交差させる。


Repository名またはDirectory名は人間向け表示であり、Project IDまたはRepository IDの代用にしない。`PRJ-001-MGMT`、`PRJ-001-DEV`等の命名は利用者向けの例として使用できるが、CROSは名前のprefix／suffixからProject Relation、責務またはAuthorityを推定しない。


## 3. Repository分離とアクセス境界

Repository分離は、Git Hosting、Filesystem ACL、OS UserまたはShared CROS ServerのWorkspace ExposureがRepository単位の読取りを実際に拒否できる場合に、情報アクセス境界として使用できる。CROS内の表示制御だけで同じOS Userが読めるRepositoryを隠しても、機密性の境界にはならない。

```text
                         Project ID: PRJ-001
                                  │
                    Relationのみ。Authorityは非継承
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
       Repository: MGMT                    Repository: DEV
       Project／Commercial                 Topics／Meetings
                │                                   │
       <<Git／OS Access Boundary>>         <<Git／OS Access Boundary>>
                │                                   │
        MGMT Credential: available          MGMT Credential: available
        DEV Credential: restricted          DEV Credential: available
```

| 状態 | 意味 | 内容の扱い |
|---|---|---|
| `available` | 検証済みBindingがあり、現在のConnection Credentialに結合したWorkspaceとPolicyで必要な読取りが許可された | 許可された範囲だけ投影する |
| `credential_required` | 別の有効なConnection Credentialが対象Workspaceを利用できるが、現在のCredentialでは利用できない | 内容を読まず、Credential切替が可能であることだけを許可範囲で示す |
| `restricted` | Repositoryの存在またはRelationは許可範囲で確認できるが、現在のConnection Credentialには内容の読取り権限がない | 禁止されたfield、件数、Artifact IDまたは要約を返さない |
| `unavailable` | 登録済みだがBinding、Host、Networkまたは外部Serviceを現在利用できない | 認可拒否と混同せず、取得不能として保持する |
| `unknown` | 存在、Binding、認証または観測結果を安全に確定できない | `restricted`や不存在へ推定せず、後続Effectを止める |

Workbenchの`Unlock`表示は、Client側で別の有効なConnection Credentialを選び、Shared CROS Serverへ再接続する操作である。CROSは共通Password、User Directory、Role Directory、MFA、SSOまたはPassword Recoveryを実装せず、Server側にはToken Hash、`workspace_ids[]`、`system_admin`および失効状態を持つ最小Credential Registryだけを置く。CredentialのWorkspace集合変更は次のRequestから有効とし、進行中TaskのAuthorityを遡及変更しない。

既に同じLocal UserがRepository内容を読める状態では、Workbench上の再入力は誤操作防止または再確認には使えるが、情報アクセス制御とは表示しない。強い分離が必要な場合は、Repository Hosting権限、別OS Principal、Filesystem ACL、暗号化Volume等、対象環境が所有する境界を使用する。

### 3.1. 共通情報と縮約Projection

別Repositoryへ正本本文を無条件に複製しない。現在のConnection Credentialに結合したWorkspaceがSource Repositoryを読める場合は、CROSが実行時にSource-aware Projectionを構成する。Personalでは検証済みLocal Bindingの範囲を用いる。

Source Repositoryを読めない利用者へ縮約情報を渡す場合、それは単なるCacheではなく、情報分類、公開対象、作成Authority、Source Revision、更新条件、保持および撤回を持つ別の公開成果物である。元Repositoryへのアクセス権がないことを理由に、CROSが自動で要約、匿名化または複製してはならない。

## 4. 責務境界

| 領域 | 所有する問い | 所有する情報 | 所有しない情報 |
|---|---|---|---|
| Project | この案件は何か | Summary、Scope、Stakeholder、Organization、Governance、大枠Schedule | CHG、品質状態、実行状態、Topic、Meeting、Commercial詳細 |
| Commercial | どの商取引条件で成立させるか | 採用先が必要とする見積・契約・採算等の正本または参照 | Project全体、実行Authority、v0.21共通の完全会計Schema |
| Topics | 今何を継続して議論・解決するか | Topic、現在状態、関係、昇格先、終了理由 | Meeting本文、CHG本文、Requirement本文、外部公開結果 |
| Meetings | 特定時点に誰と何を確認したか | 時間境界、参加主体、Source、関連Topic、確認Decision、更新正本、残った問い | 継続論点の現在状態、生Transcriptの無条件正本化 |
| Communication | 何を外部へどう伝え、何を観測したか | 受け手、主張、表現、媒体、公開状態、外部反応候補 | 内部Meeting、Project正本、外部反応からのRequirement自動確定 |
| Projection | Project運営上、現在何を判断すべきか | 各正本から導出した現在View、Source、取得時点、欠測・競合 | 独立した正本、直接更新可能なProject状態、Authority |

Commercialはv0.21で責務、Project Relation、可視性および分離可能性だけを共通契約にする。内容Schema、保持期間および法務・会計上のAuthorityは採用先の責務とし、CRDD共通Schemaを先に作らない。Commercialの分離は代表例であり、Topics、Meetings、Communicationその他の責務領域も同じRepository分離契約を使用する。

## 5. 媒体ではなく目的による分類

| 入力例 | 主目的 | 解決先 |
|---|---|---|
| Teams会議で内部設計を確認 | 時点付きのContext形成 | Meeting |
| Slackで数日にわたり未解決論点を追跡 | 継続的Attention | Topic |
| Teamsから顧客へReleaseを案内 | 外部への伝達・公開 | Communication |
| 顧客会議で課題候補を観察 | Meeting SourceとObservation候補 | MeetingからDiscovery／Topic候補へ接続 |
| 外部記事への反応 | 公開結果の観測 | Communicationから責務領域への候補還流 |

Connectorは入力Adapterであり、Slack、Teams、Meet、Zoom、Email等の名称から意味領域を確定しない。目的、受け手、時間境界、継続性、公開状態および決定権限が不足する場合は、自動分類または昇格を行わない。

## 6. TopicとMeetingのLifecycle

### Topic

```text
Candidate
   │ 根拠・継続追跡価値・所有Projectを確認
   ▼
 Open ───────────────┐
   │                  │ 情報不足・外部待ち
   │                  ▼
   │               Waiting
   │                  │ 再評価
   ├──────────────────┘
   │
   ├─→ Promoted ──→ Discovery／Decision／CHG／Roadmap／Work
   │
   └─→ Closed     ──→ 終了理由と残存影響を保持
```

| 遷移 | 必要条件 | 禁止事項 |
|---|---|---|
| Candidate → Open | 既存正本へ一意に還元できず、継続追跡価値とProject Relationが確認できる | 会話中に言及されたことだけで作成しない |
| Open ↔ Waiting | 待機理由、確認先、再評価契機を保持する | 情報不足をClosedまたは正常へ畳まない |
| Open → Promoted | 昇格先、移した意味、残るTopic責務およびAuthorityを確認する | Topic本文を別正本へ無条件複製しない |
| Open／Waiting → Closed | 終了理由、未解決影響、関連正本を確認する | 表示上消えたことを終了とみなさない |

### Meeting

```text
Source／予定
     │ 時間境界と対象Projectを確認
     ▼
  Recorded
     │
     ├─→ Topic Candidate
     ├─→ Decision Candidate
     ├─→ Context Update Candidate
     └─→ No Promotion
```

Meeting Recordは時点付き記録であり、後から判明した現在状態で当時の内容を上書きしない。誤りは訂正履歴または後続記録で扱う。生Transcript、録音またはConnector payloadはSource／Evidenceであり、Meeting Recordそのものと同一視しない。

## 7. Project Management Projection

```text
Canonical Sources
├ 20_Project
├ 21_Commercial（利用可能性またはRestrictedのみの場合がある）
├ 22_Topics
├ 23_Meetings
├ Discovery／UX／IA／UI／SPEC／Architecture
├ Quality／Verification
├ CHG／Release
├ Roadmap
├ Git
└ Runtime／Execution
          │
          ▼
   Source-aware Resolver
          │
          ▼
 Project Management Projection
├ Current Milestone／Readiness
├ Active／Waiting／Blocked
├ Decision Required
├ Open Topic／Recent Meeting
├ Quality／Recovery
├ Source／Observed At
└ Missing／Restricted／Conflicting／Stale
```

| 原則 | 契約 |
|---|---|
| Read Model | Projectionは再計算可能な派生Viewであり、正本として更新しない |
| Source-aware | 各Propertyに所有正本、対象Revisionまたは取得時点へ戻れる根拠を持つ |
| 欠測保持 | `missing`、`restricted`、`conflicting`および`stale`を空値、正常または0へ畳まない |
| 非集約Authority | 複数Repositoryを読めても、書込み、Credential、Recoveryまたは人間判断Authorityを統合しない |
| 分離した尺度 | 進捗、品質、判断待ち、Risk、RecoveryおよびRelease Readinessを単一Scoreへ畳まない |
| 操作境界 | UI／MCP操作は所有正本へのCommandまたはCandidateを生成し、Projectionを直接変更しない |

## 8. 任意Repository構造

```text
Repository
├ 20_Project/       案件の安定情報を扱う場合
├ 21_Commercial/    商務情報をこのRepositoryで扱う場合
├ 22_Topics/        継続論点を扱う場合
├ 23_Meetings/      時点付き活動を扱う場合
└ 80_Communication/ 外部コミュニケーションを扱う場合
```

各領域は利用可能な標準責務であり、連続工程、必須のDirectory集合または包含関係ではない。使用する場合だけ固定入口と責務契約に従い、使用しない場合は空Directoryまたは空成果物を作らない。別Repositoryへ分離した場合もPathで意味を推定せず、Project ID、Repository ID、Artifact Relationおよび検証済みBindingで接続する。

`20_Project`をProjectの代表Repositoryへ必ず置く規則にはしない。Projectの安定情報を所有するRepositoryだけが`project`責務を宣言し、Commercial、Topics、MeetingsまたはCommunication専用Repositoryは、Repository ManifestだけでProject Relationを示してよい。

## 9. Component境界

```text
Human／AI／CLI／MCP
          │
          ▼
 Public Project Operation Contract
          │
          ▼
 Project Operation Application
├ Identity／Relation Resolver
├ Topic／Meeting Lifecycle
├ Projection Builder
└ Command／Candidate Router
          │
          ├─→ Repository Read Ports
          ├─→ Owner-specific Command Ports
          └─→ CROS Repository Router

Infrastructure Adapters
├ Filesystem／Git
├ Runtime Data
├ MCP／HTTP
└ CROS Workbench Adapter
```

Project Operation CoreはFilesystem Path、MCP DTO、Workbench表示形式または特定Project管理Toolへ依存しない。CROS Repository RouterはRelation解決を担当できるが、正本更新やProject横断Authorityを所有しない。

## 10. 実装前の検証義務

- 同一RepositoryにProject、Topic、Meetingが同居する構成を投影できる。
- 同じProject IDに異なるRepository IDが属する構成を投影できる。
- Commercial、Topics、MeetingsまたはCommunicationのいずれかを独立Repositoryへ分離できる。
- 一つのRepositoryが複数のContext Responsibilityを所有できる。
- 分離RepositoryがRestrictedでも、内容を漏らさず可視性状態を表現できる。
- `credential_required`、`restricted`、`unavailable`および`unknown`を区別し、表示上のUnlockをAuthorityとして扱わない。
- 読取り不能なRepositoryのArtifact ID、件数、要約または存在を許可範囲外へ漏らさない。
- 同じOS Userが読めるRepositoryに対するCROS内ロックを、強い情報アクセス境界として表示しない。
- 縮約Projectionを別Repositoryへ保存する場合、情報分類、作成Authority、Source Revision、更新・保持・撤回条件がない自動複製を拒否する。
- 同じ責務の無宣言な重複所有を`conflicting`として扱い、検索順で正本を選ばない。
- 同じRepository IDの競合Binding、Project Relation不一致、stale Revisionまたは観測不能でEffect 0になる。
- Topic昇格後も元Topicの履歴と昇格先を追跡でき、第二正本を作らない。
- Meeting Sourceのサービス名だけでは分類・昇格しない。
- Projectionの表示または操作からAuthorityを生成せず、所有正本のCommandへ戻る。
- 最小Workbenchが実際の公開契約からProject／Portfolio、Source Coverage、Topic／Meeting／判断待ちを表示し、欠測または制限を完全状態へ畳まない。
- Workbenchの定型操作が既存Command／Candidate入口を使用し、画面内の直接更新や独自Authority判定を行わない。
- 使用しない任意領域をCheckerが欠落として拒否しない。

## 11. 対象外と後段選択

| 項目 | 固定した意味 | 対象外／後段選択 |
|---|---|---|
| 各Top-level入口 | 一領域一入口、使用しない領域の空成果物禁止 | 具体名はDocumentation／Templateで固定 |
| Commercial Schema | Projectと別責務、Project ID relation、Repository分離可能 | 見積・契約・会計の共通Schemaは対象外 |
| Remote認証 | CROSのRequest Access Contextだけを利用する | 認証実装はCROS／MCP詳細が所有 |
| Workbench | Projection利用側で正本・Authorityを所有しない | Framework、画面配置はUI／Developmentで選択 |

## 12. Identity／Projection／Candidate契約

### 12.1 Repository Identity

`repository_id`はRepository Manifestが所有する安定したopaque stringである。Project ID、Filesystem Path、Remote URL、Repository名、Git revisionをIdentityとして再利用しない。CROS Trust Domain内で一意であり、値の見た目からProject relation、役割、権限または配置を推定しない。具体的な文字表現はSchema実装で選べるが、変更時は新Identityとして明示移行する。

### 12.2 Project Management Projection

| Field群 | 必須の意味 |
|---|---|
| Identity | `project_id`、投影identity、対象範囲 |
| Source | source identity、source revision、`observed_at` |
| Coverage | `complete`／`partial`／`missing`／`restricted`／`conflicting`／`stale`／`unknown` |
| Current State | milestone、active／waiting／blocked、decision／recovery／integration。観測できたものだけ |
| Relation | Topic、Meeting、CHG、Quality、Roadmap等への参照。本文を複製しない |
| Action | 所有正本のCommand／Candidate入口。Projection直接更新ではない |

一つの総合Scoreや空値で、進捗、品質、判断、Recovery、制限をまとめない。開示できないSourceは内容・件数・Identityを返さず、利用側が推測できる補助情報も付けない。

### 12.3 Candidate lifecycle

```text
created ──→ under_review
              ├─ adopted  ──→ owner source relationを固定
              ├─ rejected ──→ 理由とsource relationを保持
              └─ expired  ──→ 再利用不可。再分析時は新候補
```

Candidateは`candidate_id`、source identity／revision、target owner、作成時点、状態、採否理由を持つ。本文または一時生成物はRuntime Dataの保持規則で清掃できるが、採否と正本へのrelationを再構成するための最小記録は保持する。Projectionは再生成可能であり正本化しない。清掃はOwner、参照、Recovery義務を確認した後にだけ行う。

### 12.4 Candidate採否の耐久確定

File-backedなCandidate採否では、Candidate、所有正本および判断Journalを同じ用途限定Store Rootと同じOperation Lockへ閉じる。採用前に`prepared`を記録し、所有正本更新後に`owner_applied`へ進め、Candidate確定後にJournalを削除する。

```text
Authority・Revision確認
        ↓
prepared Journal
        ↓
所有正本を一度だけ更新
        ↓
owner_applied Journal
        ↓
Candidateをadoptedへ確定
        ↓
Journal削除
```

`prepared`で停止した場合はAuthorityと判断Identityを再確認し、所有正本が未更新なら一度だけ更新する。`owner_applied`で停止した場合は所有正本を再発行せずCandidate確定だけを再開する。Journal、Candidate Identity、Principal、期待Revisionまたは所有正本状態が一致しない場合は、自動補正せず不正な部分状態として停止する。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `project-operation.context-lifecycle`<br>`project-operation.project-projection` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Project、Commercial、Topic、Meeting等のContextを、Identity、Relation、LifecycleとProjectionの共通契約へ揃える。 | Context固有Schemaを保ちながら、Projectとの結合、Currentness、Sourceおよび利用不能を同じ境界で扱う。 | 新しいContextが独自Project複製や独自状態台帳を作り、横断Projectionが推測依存になる。 | `project-operation.context-lifecycle`<br>`project-operation.project-projection` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `project-operation.context-lifecycle` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `project-operation.context-lifecycle`<br>`project-operation.project-projection` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `project-operation.project-projection` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `project-operation.project-projection` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
