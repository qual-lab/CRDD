# CROS Federationと利用境界のアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: cros
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | 利用可能Repository集合から読取り専用のProject／Portfolio Projectionを組み立て、欠測とSource Coverageを保持する。Objective／Milestone受入判断の書込みPortは所有しない。 | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Meeting由来の候補をSource relation付きで所有先へ搬送し、採否Authorityを生成しない。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Project ID、Repository ID、Binding IDを分け、検証済みRootだけをFederationへ渡す。 | Covered |
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | Repositoryが公開するCapability／Model構成を現在のWorkspace範囲で解決する。 | Partial |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | Credential、Workspace Grant、Repository Exposureを分け、Requestごとの利用可能集合を確定する。 | Covered |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | Agent間Handoffで外部情報、未決事項、Effect境界と再開条件を構造化して搬送する。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Source Revision、観測時点、現在有効な規則をProjectionとHandoffへ保持する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Credential、Workspace、Binding、FederationとProjectionのOwnerを分ける。 | [§2](#2-identityと責務) |
| Interface Model | Required | 必ず認可済みRepository Resolverを通る読取り契約を固定する。 | [§6](#6-canonicalな読取り経路) |
| Data Flow | Required | CredentialからProjectionまでの情報とAuthorityの流れを追跡する。 | [§10](#10-データフロー) |
| State Model | Required | 登録、Binding、Exposure、利用可能性、解除を別状態にする。 | [§9](#9-登録exposure解除) |
| Sequence | Required | Context解決、引渡し、判断、同一Taskへの再開順序が成立条件になる。 | [§8](#8-agent-operating-contextとhandoff) |
| Failure／Recovery | Required | 部分取得、失効、競合、再開不能を安全な結果へ分ける。 | [§12](#12-失敗と安全な結果) |
| Deployment | Required | PersonalとShared ServerでRepository集合の決定境界が異なる。 | [§3](#3-personalとshared-serverの共通モデル) |
| Observability | Required | Source Coverage、欠測、制限、競合、観測時点を返す。 | [§12](#12-失敗と安全な結果) |
| Security Boundary | Required | Workspace Grant、Repository Exposure、System管理可否を相互昇格させない。 | [§5](#5-repository利用可否) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Registry更新はrevision付き排他と不変publishを使い、Requestは開始時snapshotへ固定する。 | [§15](#15-registryとrequest-snapshot) |
| Timing | PASS | Requestごとに現在Credentialと観測時点を評価し、旧値を再利用しない。 | [正本節](#7-connection-credentialとrequest-access-context) |
| Resource Lifecycle | PASS | Credential、Request Context、Workspace snapshotと管理回復の終了条件を分ける。 | [§16](#16-credentialと管理回復) |
| External Boundary | PASS | v0.21 Shared Profileを信頼済み運用者向けの一Process／複数Trust Domain論理分離に限定する。 | [§17](#17-shared-host配置境界) |
| Failure／Recovery | PASS | 競合更新、Credential紛失、Registry破損を別経路で停止・回復する。 | [§15](#15-registryとrequest-snapshot)、[§16](#16-credentialと管理回復) |
| State／Consistency | PASS | 登録、Binding、Exposure、利用可能性、解除を別状態にする。 | [§9](#9-登録exposure解除) |
| Observability | PASS | Source Coverage、欠測、制限、競合、観測時点を返す。 | [§12](#12-失敗と安全な結果) |
| Security／Trust | PASS | Workspace Grant、Repository Exposure、System管理可否を相互昇格させない。 | [§5](#5-repository利用可否) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `cros.workspace-access-boundary` | Interface／Security Boundary | Bearer CredentialとWorkspace集合 | 許可されたBindingだけ解決 | 失効、Exposure外、Admin-only | IT／ST | Direct Boundary | Access Contextと非開示結果 | Request後Secret 0 | 敵対的multi-tenantのHost分離は対象外 |
| `cros.repository-federation` | Flow／Consistency | 複数Repository Source | 根拠・欠測付きProjection | 競合Binding、部分取得不能 | IT／ST | Related 2 Blocks | Source Coverageとobserved_at | 正本変更0 | 物理保存形式はDevelopmentで選択 |
| `cros.context-handoff` | Sequence／Transition | 構造化Task Context | 同じIdentityとRevisionで再開 | 未確認Context補完、Authority昇格 | IT／ST | Adjacent 1 Block | handoff stateとreason | 未許可Effect 0 | transport schemaはSPEC待ち |
| `cros.surface-contract` | Interface／Consistency | CLI／MCP／Workbenchの同一操作 | 同じApplication ContractとCanonical Ownerへ接続 | 入口別の独自実装、Revision競合の上書き | IT | Direct Boundary | Surface、Operation、Revision、結果 | 競合時の追加Effect 0 | UI固有表示はUI工程が所有する |
| `cros.result-return` | Sequence／Consistency | 委譲Taskの構造化結果 | 元Task／Revisionへ一度だけ帰還 | 別Task結合、部分結果採用、二重settle | ST | Related 2 Blocks | Result ID、Task、Revision、settlement | 重複帰還0 | Provider固有生出力は搬送しない |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-12
関連:
- [Project Operation Context](../project-operation/01_Architecture.md)
- [Runtime Dataの目標Architecture](../runtime-data/01_Architecture.md)
- [MCP Architecture](../mcp/01_Architecture.md)
- [v0.21 Roadmap](../../../99_Roadmap/01_Roadmap.md#11-v0210--project運営信頼複数repository)

## 1. 結論と対象

CROSは、Personal環境とShared Server環境で別のProject Modelを作らない。両者とも、現在の実行主体が利用できるRepository集合を確定し、その集合だけをProject FederationとProjectionへ渡す。

```text
利用可能なRepository集合
          │
          ▼
 Project Federation
          │
          ▼
 Project／Portfolio Projection
          │
     ┌────┴────┐
     ▼         ▼
 Human      AI／MCP
```

PersonalとShared Serverで異なるのは、利用可能なRepository集合の決定方法である。Project Relation、Repository Identity、正本責務、欠測状態およびProjectionの意味は共通にする。

### 1.1. 上位のOperating Model

CROSは単なる複数Agent Routerではない。対話を主に担当するAgentとRepository上の構築を主に担当するAgentが、同じCRDD正本から解決した仕事の進め方（Operating Context）を参照し、構造化された仕事を相互に引き渡せる接続層である。

```text
Human／Customer
       │ 対話・判断
       ▼
  [Chat Agent]
       │ 構造化Context／判断要求
       ▼
      [CROS]
       ├─ Project Federation
       ├─ Operating Context Resolver
       ├─ Capability Resolver
       └─ Handoff／Resume
       │ 構造化Task／決定結果
       ▼
 [Coding Agent]
       │ 設計・実装・検証・Repository Effect
       ▼
 CRDD Repository
```

| 主体 | 主責務 | 所有しないもの |
|---|---|---|
| Chat Agent | Discovery、対話、要求整理、合意形成、判断支援 | Repository Effectの暗黙許可、未確認要求の確定 |
| Coding Agent | 詳細化、設計、実装、試験、検証、許可済みRepository Effect | 不足要求、Authority外判断または人間Decisionの独自補完 |
| CROS | Context連合、適用規則解決、Capability解決、Handoff、再開 | Agent固有の知能、CRDD規則の第二正本、人間の決定権限 |
| CRDD | 規則、Context、Decisionおよび成果物の正本 | 接続Session、Credential SecretまたはAgent固有の会話履歴 |

Chat Agent／Coding Agentは固定製品名や固定AIモデルを意味せず、一つのTask中の責務である。同じAgentがTaskごとに異なる責務を担うことはできるが、Task RoleをContent Access Role、System Administration Capabilityまたは人間の決定権限へ昇格しない。

MCPへ接続できることは、CRDD規則の認識または準拠の証明ではない。各Agentは、現在のProject、Repository、Task Role、目的および許可されたOperationに適用される規則を、正本Revisionと解決根拠付きで取得する。

## 2. Identityと責務

```text
Trust Domain
  ├─ Project Registry
  │    └─ Project ID
  │         └─ Repository ID
  │              └─ Repository Binding ID
  │
  ├─ Workspace Registry
  │    └─ Workspace ID
  │         └─ Repository Exposure
  │
  └─ Credential Registry
       └─ Connection Credential
            ├─ workspace_ids[]
            ├─ system_admin
            └─ revoked
```

| 要素 | 所有する意味 | 所有しない意味 |
|---|---|---|
| Trust Domain | 信頼するPublisher、Repository、WorkspaceおよびConnection CredentialのServer境界 | Project正本、全Domain共通のCredentialまたは認証一般基盤 |
| Project Registry | Project IDとRepository IDの宣言されたRelation | Repository内容、Bindingの存在、アクセス許可 |
| Repository Binding | Repository IDと検証済みRoot／checkoutの実在結合 | Workspace公開、Connection Credential、別BindingのAuthority |
| Workspace | CROS環境が公開候補にするRepository Bindingの明示集合 | User Directory、Project正本、Credential、操作Authority |
| Repository Exposure | 一つのBindingを一つのWorkspaceへ含めるServer所有設定 | Connection CredentialがそのWorkspaceを利用できるという証明 |
| Connection Credential | Token照合用Verifier、利用可能なWorkspace ID集合、管理可否および失効状態 | Human Identity、組織Role、Project Relation、Operation Authority |
| Request Access Context | 現在のRequestで検証したCredential ID、Workspace ID集合および`system_admin` | 永続Session、Contentの正本、Repository Effect Authority |

Developer、PM、Management、`general`、`privileged`等は利用者像または配置先の表示名として使用できるが、CROS Coreの固定Role階層にしない。`system_admin`をContent Accessの上位Classにせず、管理可否からMGMT／Commercial Repositoryの閲覧権限を生成しない。

## 3. PersonalとShared Serverの共通モデル

### 3.1. Personal

```text
Git Providerで取得済みのRepository
          │
          ▼
Local Filesystemで現在読取り可能
          │
          ▼
CROSへ明示登録した検証済みBinding
          │
          ▼
利用可能なRepository集合
```

Personal環境では、Repository取得時のGit Provider認証とLocal FilesystemのUser境界を主な情報境界として利用する。ただし、Git Provider側の権限を失効しても既存cloneは自動削除されない。CROSはLocal cloneの存在から、現在もGit Provider上のアクセス権があると推定しない。

Local AIまたはCROSは、明示登録されていない兄弟RepositoryをDirectory探索で発見・追加しない。Repository ID、BindingおよびProject Relationを確認できる対象だけを利用する。

### 3.2. Shared Server

```text
Server Credential
      │ Repository取得能力
      ▼
Repository Pool
      │ 明示したExposureだけ
      ▼
Workspace Repository Set
      │ 現在のCredentialのworkspace_ids[]と交差
      ▼
利用可能なRepository集合
```

Shared Serverでは、Server CredentialがRepositoryを取得できること、Filesystem上にRepositoryが存在すること、Pathを知っていること、およびProject RegistryへRelationがあることを、MCP利用者の閲覧Authorityとして扱わない。

Workspace ExposureはCROS Application内の公開境界である。Host UserがRepository Poolを直接読める環境では、CROSを迂回した読取りまで防ぐHost Security Boundaryにはならない。共有利用者へHost ShellまたはFilesystem Accessを与える場合は、OS Principal、ACL、Container／Process分離またはCredential分離を別に成立させる。

## 4. CredentialにWorkspace集合を結合する理由

v0.21候補では、`general < privileged < administrator`というグローバルなAccess ClassをCoreへ固定しない。

| 構造 | 判断 |
|---|---|
| 単一のAccess Class階層 | Projectごとの差、Commercialだけの分離、管理権限と内容閲覧の分離を表せず、上位Classへ過大なAuthorityが集まりやすい |
| User × Repository × Operationの独自ACL | 表現力は高いが、CROSがIAM製品化し、運用・回復・監査Costが大きい |
| Connection Credential × `workspace_ids[]` | Repository集合を粗い単位で明示でき、Requestごとに現在のCredential Recordを確認できる。CROS CoreはUser Directoryや永続認証Sessionを持たずに済む |

```text
Credential A
  └─ workspace_ids: [development]
       └─ DEV Repository Set

Credential B
  └─ workspace_ids: [development, management]
       └─ DEV + MGMT Repository Set

Credential C
  ├─ workspace_ids: []
  └─ system_admin: true
       └─ Content Accessは自動付与しない
```

単一画面でDEVとMGMTを統合する必要がある場合も、混在Repositoryを持つ`Common Workspace`を必須にしない。現在のCredentialが利用できる複数Workspaceの和集合からProject Viewを構成し、各fieldへSource Workspace、Repository、Revisionおよび取得状態を保持する。

### 4.1. Workspace集合を設定する主体

Workspace集合の元は、CROS Serverが所有するConnection Credential Recordである。固定Role名から推定せず、現在のRequestで検証したCredentialが`system_admin: true`の場合だけ設定できる。

```text
[管理Request]
   │ system_admin == true
   ▼
[Credential Record]
   ├─ credential_id
   ├─ token_hash
   ├─ workspace_ids[]
   ├─ system_admin
   └─ revoked
          │ Requestごとに検証
          ▼
 [Request Access Context]
   ├─ credential_id
   ├─ workspace_ids[]
   └─ system_admin
          │
          ▼
 [Workspace Exposure]
          │
          ▼
 許可されたRepository集合
```

| 管理操作 | 必要条件 | Content Accessへの効果 |
|---|---|---|
| Workspace作成・更新 | `system_admin: true` | なし |
| Repository Exposure変更 | `system_admin: true` | なし |
| Credential発行・失効 | `system_admin: true` | 発行時にCredentialへ明示したWorkspaceだけ |
| CredentialのWorkspace集合変更 | `system_admin: true` | 対象Credentialの次Requestから現在値を反映 |

管理Requestがこれらの操作を行えることから、Project、ManagementまたはCommercial内容の読取りを許可しない。管理操作は対象Trust Domain、Workspace、Credentialおよび操作結果をCredential IDへ相関できるようにするが、Human Identity、組織Roleまたは一般的な認証監査基盤をCROS Coreへ追加しない。

## 5. Repository利用可否

Shared Serverで一つのRepository Bindingを利用可能とするのは、次の条件をすべて満たす場合だけである。

```text
Bindingが検証済み
  AND Trust PolicyがRepository／Publisher／Revisionを許可
  AND WorkspaceがBindingを明示Exposure
  AND 現在のCredentialがWorkspace IDを保持
  AND 既存Manifest／Trust／Binding契約の明示Constraintに違反しない
  AND Operationを伴う場合は対象CapabilityのAuthorityが別途成立
```

Repository ManifestはRepository ID、Project Relation、Context Responsibilityおよび既存契約が要求する制約を宣言できるが、Authorityの正本ではない。Manifestの変更だけでWorkspace Exposure、Connection CredentialのWorkspace集合またはServer Policyを緩和できない。CROS CoreへInformation Classification Registry、Classification Schema、Label継承、汎用Policy EngineまたはUser／Role対応表を追加しない。CRDD正本や配置先が既に所有する機密区分・開示制約が入力に含まれる場合、CROSはそれを生成・推定・拡張せず、利用範囲を狭める既存Constraintとしてだけ扱う。

Content AccessとOperation Authorityは独立条件である。Read-only ProjectionはContent Accessだけを要求し、Repository内容を使用または変更するOperationはContent Accessと対象Tool／Runtime／Capabilityが所有する既存Authorityの両方を要求する。Server設定操作は`system_admin`を要求するが、Project内容のContent Accessを要求または生成しない。CROSはこれらを新しい汎用Authority Frameworkへ統合しない。

## 6. Canonicalな読取り経路

```text
MCP／CLI／Workbench
        │ {Project ID, Purpose}
        ▼
[Bearer Credential Verifier]
        │ {credential_id, workspace_ids[], system_admin}
        ▼
[Workspace Exposure Resolver]
        │ {Candidate Repository IDs}
        ▼
[Repository／Binding Verifier]
        │ {Verified Available Repository Set}
        ▼
[Project Federation]
        │ {Source-aware Context}
        ▼
[Projection Builder]
        │
        ▼
許可されたProject／Portfolio Projection
```

Caller由来のFilesystem PathをRepository Resolverの代替として受理しない。内部Adapterも、Canonical Resolverを迂回してRepository Poolを直接読む入口を公開しない。Projectionは利用できないRepositoryの内容、Artifact ID、件数または推定値を補完しない。

## 7. Connection CredentialとRequest Access Context

v0.21のShared Serverは、Remote MCPの認証方式をBearer Tokenへ固定する。一般的な認証Provider Interface、User Directory、Principal、Group、MFA、SSO、Refresh Tokenまたは永続認証SessionをCROS Coreへ追加しない。

```text
Authorization: Bearer <token>
             │
             ▼
Token Hash／Verifier照合
             │
             ▼
Current Credential Record
             │ revoked == false
             ▼
Request Access Context
├ credential_id
├ workspace_ids[]
└ system_admin
```

| Credential field | 必須 | 意味 |
|---|---|---|
| `credential_id` | Yes | SecretではないServer内の安定識別子 |
| `token_hash` | Yes | 生Tokenを保存せず照合するVerifier |
| `workspace_ids[]` | Yes | Content Accessに利用できるWorkspace集合。空集合を許す |
| `system_admin` | Yes | CROS Server設定を変更できるか。Content Accessを生成しない |
| `revoked` | Yes | `true`ならRequestを拒否する |
| `display_name` | No | 運用上の表示。Human IdentityまたはRoleではない |
| `created_at`／`expires_at` | No | 必要な配置でだけ使用する補助情報 |

CredentialのWorkspace集合は独立したGrant Entity、Grant RegistryまたはGrant Revisionにしない。Credential Recordの現在値をRequestごとに読み、変更または失効を次のRequestから反映する。設定競合を防ぐStore Revisionや不変PublicationはRuntime Dataの永続化契約として持てるが、認証上のGrant Lifecycleへ昇格させない。

Token生値はRepository、Repository-local `.crdd`、Project Workspace、Prompt、logまたはProjectionへ保存しない。Server側は照合可能なHash／Verifierだけを保持し、Client側での安全な保存はMCP Clientが所有する。CROSはPassword Manager、Password Database、Password ResetまたはCredential rotation frameworkを実装しない。新しいCredentialへの切替が必要な場合は、新規発行と旧Credentialの明示失効を使用する。

```text
cros server init
      │ Host上の明示操作
      ▼
通常SchemaのAdmin Credential生成
├ workspace_ids: []
├ system_admin: true
└ revoked: false
      │ Token生値を一度だけ表示
      ▼
以後は通常の管理Credentialとして使用
```

既存のServer初期化を再実行して別のAdmin Credentialを暗黙追加しない。初期Credentialを失った場合は、Host所有者が既存Credential状態を確認したうえで専用の回復操作を実行する。Bootstrap専用Capability、Bootstrap SessionまたはPromotion Lifecycleは作らない。

Personal Modeには本Credential機構を要求せず、Local User、Local Filesystemおよび明示登録済みVerified Bindingを利用境界とする。

## 8. Agent Operating ContextとHandoff

### 8.1. 適用規則の投影

CRDD全文を毎回Agentへ投入せず、現在の仕事に必要な規則だけを解決する。

```text
CRDD Rule Sources
       │ Project／Repository／Task／Role／Operation
       ▼
[Applicability Resolver]
       │ 最小のApplicable Rule Set
       ▼
[Agent Operating Context]
       ├─ CRDD Version／Rule Revision
       ├─ Project／Repository Context
       ├─ Task Role／Objective
       ├─ Applicable Rules＋解決根拠
       ├─ Available Capabilities
       ├─ Decision／Effect Boundary
       └─ Escalation／Handoff Contract
```

Agent Operating Contextは派生投影であり、CRDD正本を置換しない。古い規則を現行値として渡さず、競合、取得不能または適用判定不能をAgentが補完しない。利用した正本Revision、規則集合およびCapability集合を後から追跡できるようにする。

### 8.2. 双方向Handoff

Chat AgentからCoding Agentへ会話履歴をそのままPrompt転記することを標準経路にしない。Coding AgentからChat Agentへも、単なる「分かりません」ではなく、判断に必要なContextを構造化して返す。

| Handoff field | 意味 |
|---|---|
| Project／Repository／Task Identity | どの仕事を継続するか |
| Objective／Acceptance | 承認済み目標と完成条件 |
| Source Context References | 昇格済みTopic、Decision、CHG、Evidence等の参照 |
| Current State／Evidence | 現在確認できた状態と根拠 |
| Unresolved Question／Conflict | 補完してはならない不足または矛盾 |
| Decision Authority | 誰の何の判断が必要か |
| Allowed／Forbidden Effects | 再開前後に許可される操作境界 |
| Return Contract | 判断後に更新する正本と再開条件 |

```text
Chat Agent
   │ 昇格済みContext＋許可済みObjective
   ▼
Coding Agent
   │ 不足／矛盾／Authority外判断
   ▼
Handoff Request
   │ CROSがIdentityとRevisionを保持
   ▼
Chat Agent／Human
   │ Decisionを所有正本へ記録
   ▼
Resume Decision
   │ 現行ContextとAuthorityを再検証
   ▼
Coding Agent Resume
```

Handoffは外部送信許可、Repository Effect Authorityまたは人間の決定を新たに生成しない。会話中の未昇格発言、秘密値、利用不能Repositoryの内容および無関係なCRDD全文を既定Packetへ含めない。

v0.21の代表範囲は、Operating Contextの読取り、構造化Handoff Request、Decision待ちおよび同一Task Identityでの再開契約までとする。Agentが自律的に相手Agentを選定・起動する一般Router、無制限な会話履歴同期および未承認Effectの連鎖実行は対象外とする。

## 9. 登録、Exposure、解除

```text
Repository候補
    │ Manifest／Root／Trust検証
    ▼
Repository Binding
    │ Project Relation登録
    ▼
Project Registry
    │ 管理Capabilityによる明示Exposure
    ▼
Workspace Repository Set
```

Project Relationへの登録とWorkspace Exposureを一つの操作に畳まない。RepositoryをProjectから解除、またはWorkspaceから非公開にしても、Filesystem Directory、Remote Repository、Git historyまたは別Workspace Exposureを削除しない。物理削除には別のexact対象、Authority、参照閉包、Recoveryおよび不存在確認が必要である。

## 10. データフロー

```text
<<Git Provider>>
       │ Repository bytes／Revision
       ▼
[Repository Pool] <── [Binding Registry]
       │                        ▲
       │ verified read          │ server-owned relation
       ▼                        │
[Authorized Repository Resolver] <── {Request Access Context}
       │
       │ source + provenance
       ▼
[Project Federation]
       │
       ▼
[Projection Builder] ──→ <<MCP／CLI／Workbench>>

<<Remote MCP Client>> ── Bearer Token ──→ [Credential Verifier]
Secret value -x Repository／.crdd／Prompt／Projection
```

## 11. Personal／Sharedの利用者体験

| 場面 | 主入口 | 主表示 | 詳細へ退避 |
|---|---|---|---|
| Developerの日常作業 | 対象Repository＋Local AI | そのRepositoryが所有するContext | Federation、別Repository、内部Binding |
| PMのProject確認 | CROS＋MCP／Workbench | 一つのProjectとSource Coverage | Repository／Workspace／Revision診断 |
| Managementの横断確認 | Portfolio Projection | Projectごとの注意、主要判断、観測時点 | 個別Topic、Meeting、CHG |
| Server管理 | 管理専用CLI／Surface | Binding、Exposure、Credential状態 | Project内容。`system_admin`だけでは表示しない |
| 対話から構築への移送 | Chat Agent＋CROS | 昇格済みContext、Objective、判断境界 | 会話全文、無関係な規則、秘密値 |
| 構築中の判断待ち | Coding Agent＋CROS | 未決事項、根拠、必要なDecision Authority、再開条件 | 内部推論全文、未許可Effect |

`Unlock`は別のConnection CredentialをClientへ設定して再取得でき、対象の存在を開示できる場合だけ表示する。`restricted`、存在開示不可または`system_admin`だけを持つCredentialへContent Unlockを提示しない。CROS Serverが画面上で共通Passwordを照合したり、現在CredentialのWorkspace集合を利用者操作だけで拡張したりしない。

## 12. 失敗と安全な結果

| 失敗 | 結果 |
|---|---|
| Server Credentialは読めるがExposureなし | Repositoryを解決対象へ入れない |
| Exposureあり、現在CredentialのWorkspace集合に含まれない | 内容・件数を返さず`restricted`または非開示 |
| Credential有効だがBinding不明／競合 | `unknown`／`conflicting`、Effect 0 |
| Manifestが制約を緩和 | Server Policyを維持し、差分を拒否または再確認待ち |
| WorkspaceまたはTrust Policy改訂 | 次Requestで現在値を使い、旧設定から新規Read／Operationを発行しない |
| Credential失効 | 次Requestを拒否する。実行中Operationは固有の取消・Recovery契約に従う |
| CredentialのWorkspace集合を縮小 | 次Requestから縮小後の集合だけを使う |
| Projection Sourceの一部取得不能 | 完全なProject回答にせず、開示可能なSource Coverageを返す |
| Canonical Resolverを迂回するPath入力 | Repositoryを読まず拒否する |
| MCP接続済みだがOperating Context未解決 | CRDD準拠またはTask開始済みと表示せず、Effect 0 |
| Handoff先がContext Revisionを再構成不能 | 不足を表示して停止し、会話や推定で補完しない |

## 13. v0.21の完成条件

- PersonalとShared Serverが同じProject／Repository／Bindingモデルを使用する。
- Personalでは登録済みLocal Bindingだけを使い、Git Access失効と既存cloneを混同しない。
- Shared ServerではServer Credential、Repository Pool、Workspace ExposureおよびConnection Credentialの`workspace_ids[]`を分離する。
- Requestごとに現在のCredential Recordを検証し、固定Access Classや`system_admin`から内容閲覧権限を生成しない。
- Repository Manifestは制約を提案できるが、Workspace ExposureまたはConnection Credentialを発行できない。
- Canonical Resolverを通らないPath指定でRepositoryを読めない。
- `workspace_ids[]`によるContent Accessと`system_admin`によるServer管理可否が分離される。
- `system_admin: true`のCredentialだけがWorkspace、ExposureおよびCredentialを管理でき、管理可否からContent Accessを生成しない。
- Credential発行、Workspace集合設定、Request認証および失効を区別できる。
- Secret値がRepository、`.crdd`、Prompt、logまたはProjectionへ入らない。
- User Directory、Principal、汎用認証Adapter、認証Evidence、永続認証Session、独立Grant EntityまたはBootstrap専用CapabilityをCoreへ追加しない。
- Registration、Project Binding、Workspace Exposure、UnexposeおよびUnbindが物理Repository削除と分離される。
- `available`、`credential_required`、`restricted`、`unavailable`、`conflicting`および`unknown`を内容漏えいなしに投影できる。
- Chat AgentとCoding Agentが同じCRDD正本から解決した、Revision付きのAgent Operating Contextを取得できる。
- 構造化HandoffがObjective、根拠、未決事項、Decision Authority、Effect境界および再開条件を保持し、Prompt転記を必須にしない。
- MCP接続、Agent RoleまたはHandoff受領だけからCRDD準拠、Content Access、`system_admin`またはEffect Authorityを生成しない。
- 独立したInformation Classification System、汎用Policy EngineまたはGlobal Operation Permission RegistryをCROS Coreへ追加しない。
- Read-only Projection、Repository内容を使うOperationおよびServer管理の必要条件を混同せず、各Capabilityが所有する既存AuthorityをCROSが代替発行しない。
- 最小WorkbenchがCROS／Project Operationの公開契約からProject／PortfolioとSource Coverageを表示し、既存Command／Candidate入口への定型操作を一つ以上縦断する。
- TS APIは型付け済みRequest、CLIは位置引数、MCPは未知入力のSchema検証、Workbenchは表示Commandからの明示変換をそれぞれ所有する。四つのAdapterはAuthority、Revision、結果意味またはStoreを所有せず、同じApplication ContractとCanonical Ownerへ接続する。
- 単一Repository、Personal複数Repository、Shared DEV Credential、Shared MGMT Credential、Admin-only Credential、Credential失効、Workspace集合変更およびPolicy改訂を結合試験で反証する。

## 14. 後段で選択する物理詳細

次は意味契約を変更しない実装選択、または現在Scope外である。未確定だから安全条件を推測してよいという意味ではない。

| 項目 | 固定した意味 | 後段で選べる範囲 |
|---|---|---|
| Registry保存形式 | §15のfield、revision、排他、不変publishを保持する | JSON、DB等の物理形式 |
| Credential任意field | `credential_id`、Verifier、Workspace集合、管理可否、失効は必須 | 表示名、作成時点、有効期限 |
| Operating Context wire | 正本Revision、適用根拠、Capability、Decision境界を保持する | MCP Tool名、JSON field配置 |
| Handoff transport | §8.2の意味契約を保持する | 利用するTransportとAgent製品 |
| Linux system-wide配置 | v0.21では保証しない | v0.22のLinux実環境で決定 |

## 15. RegistryとRequest snapshot

| Registry | 必須field | Owner |
|---|---|---|
| Trust Domain | `trust_domain_id`、publisher／repository policy参照、`revision` | Server operator |
| Workspace | `workspace_id`、`trust_domain_id`、`binding_ids[]`、`revision` | Server operator |
| Binding | `binding_id`、`repository_id`、検証済みRoot capability参照、`revision` | Binding Resolver |
| Credential | `credential_id`、token verifier、`workspace_ids[]`、`system_admin`、`revoked`、`revision` | Credential Registry |

```text
管理更新
  ↓ current revisionを指定して排他取得
候補Registryを完全検証
  ├ revision競合 ──→ Effect 0／再読取り
  └ valid ─────────→ immutable publish
                         ↓
Request開始 ──→ 一つのRegistry revision集合へ固定
                         ↓
Request終了 ──→ snapshot解放
```

異なるRegistry revisionを一Requestへ混在させない。更新後の設定は次Requestから使い、実行中Operationは開始時に取得したAuthorityと固有の取消／Recovery契約へ従う。

## 16. Credentialと管理回復

| 対象 | 終了条件 |
|---|---|
| Connection Credential | 明示失効または設定済み期限。生Tokenは発行時以外保存・再表示しない |
| Request Access Context | Request完了・取消・切断時に破棄し、次Requestへ流用しない |
| Workspace snapshot | Request終了時に解放し、更新後の新Requestは新revisionを取得する |
| 管理回復Operation | 新Credential発行と選択した旧Credential失効を同じRegistry revisionで確定し、秘密値を破棄する |

Admin Credential紛失時はRemote入口を使わない。Host所有者がCROS Serverを停止し、OS上の管理CapabilityでCredential Registryを読取り、失効対象の`credential_id`を選び、`workspace_ids: []`の新しいAdmin Credentialを一度だけ発行する。旧Credentialを特定できない場合は既存Admin Credentialを全失効するかを人間が明示判断する。回復はContent Grantを付与せず、Bootstrap専用Identityや恒久的な裏口を作らない。

Registry破損、Root未検証または排他取得不能では新Credentialを発行しない。最後に確認できたrevision、未失効Credential集合、Effect有無を記録し、人間判断へ戻す。

## 17. Shared Host配置境界

v0.21のShared Profileは、同一運用主体が管理する一つのCROS Server Processが複数Trust Domainを論理的にrouteする構成を対象とする。各Trust Domainは別Runtime Root、別Registry、別Repository Poolを持ち、Requestは認証後に一つのTrust Domainへ固定する。

```text
[CROS Server Process]
   ├─ [Trust Domain A Root] ── Workspace／Credential／Repository Pool A
   └─ [Trust Domain B Root] ── Workspace／Credential／Repository Pool B

Request A ── authenticated domain A ──x── Domain B Root
```

Workspace GrantはHost Shell、OS Accountまたは敵対的tenant間の強制隔離ではない。互いに信頼しないtenantを同じHost／Processへ収容する構成、Container／VMによる強分離、Linux system-wide配置はv0.21の保証外とし、必要な場合はProcessとOS Accountを分ける。対象外をWorkspaceだけで安全と表示しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `cros.workspace-access-boundary`<br>`cros.repository-federation`<br>`cros.context-handoff` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Personal／Shared配置、複数WorkspaceおよびRepository Contextを、Grant、Exposure、ProjectionとHandoffの共通契約へ揃える。 | 配置差やRepository差があっても、利用可能・制限・欠測を同じ意味で返し、非開示Contextを推測しない。 | 配置・Workspace別の例外経路でGrantまたは情報境界が迂回される。 | `cros.workspace-access-boundary`<br>`cros.repository-federation`<br>`cros.context-handoff` |
| Creation／Selection | Required | この観点を成立させる構造と責務が存在するため。 | Authority、入力または配置条件を満たした後にだけ具象・処理経路を選ぶ。 | 選択前の検証と選択後のIdentityを分け、未確認時はEffect 0とする。 | 選択条件の変更はTrust、Authorityまたは利用側契約へ波及する。 | `cros.workspace-access-boundary` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `cros.workspace-access-boundary` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `cros.workspace-access-boundary`<br>`cros.repository-federation`<br>`cros.context-handoff` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `cros.context-handoff` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `cros.context-handoff` |

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
