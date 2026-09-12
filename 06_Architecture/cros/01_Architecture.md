# CROS Federationと利用境界のアーキテクチャ

状態: Candidate（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-12
関連:
- [Project Operation Context](../project-operation/01_Architecture.md)
- [Runtime Dataの目標Architecture](../runtime-data/02_Target_Architecture.md)
- [MCP Architecture](../mcp/01_Architecture.md)
- [v0.21 Roadmap](../../99_Roadmap/01_Product_Roadmap.md#11-v0210--project運営信頼複数repository)

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
- 単一Repository、Personal複数Repository、Shared DEV Credential、Shared MGMT Credential、Admin-only Credential、Credential失効、Workspace集合変更およびPolicy改訂を結合試験で反証する。

## 14. 現在の未確定事項

| 項目 | 現在の方針 | 確定Gate |
|---|---|---|
| Workspace Registryの永続Schema | Trust Domain配下、Secret非格納、Server所有 | Runtime Data／CROS SPEC |
| Credentialの任意field | `display_name`、`created_at`、`expires_at`を必須にしない | Remote MCP脅威モデル／SPEC |
| Admin Credential紛失時の回復 | Bootstrap Entityを作らず、Host所有者の明示操作に限定する | Remote MCP脅威モデル／運用手順 |
| Operating Context Schema | 正本Revision、適用根拠、CapabilityおよびDecision境界を持つ派生投影 | CROS／MCP SPEC |
| Handoff transport | 意味契約を先に固定し、MCP Tool名やAgent製品名へ結合しない | CROS／MCP SPEC |
| Shared Hostの強い分離 | WorkspaceだけでHost Shellを防げない | 配置ProfileとPlatform Threat Model |
| Linuxのsystem-wide配置 | v0.22で実環境確認 | Linux／Remote Runtime設計 |
