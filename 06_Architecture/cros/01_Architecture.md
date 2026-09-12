# CROS Federationと利用境界のアーキテクチャ

状態: Candidate（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-12
関連:
- [Project Operation Context](../project-operation/01_Architecture.md)
- [Runtime Dataの目標Architecture](../runtime-data/02_Target_Architecture.md)
- [MCP Architecture](../mcp/01_Architecture.md)
- [v0.21 Roadmap](../../99_Roadmap/01_Product_Roadmap.md#12-v0210--project運営信頼複数repository)

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
  └─ Session
       ├─ Authenticated Principal
       ├─ Workspace Grant
       └─ Operation Authority
```

| 要素 | 所有する意味 | 所有しない意味 |
|---|---|---|
| Trust Domain | 信頼するPublisher、Repository、認証Adapter、Credential境界および許可上限 | Project正本、全Domain共通のSessionまたはCredential |
| Project Registry | Project IDとRepository IDの宣言されたRelation | Repository内容、Bindingの存在、アクセス許可 |
| Repository Binding | Repository IDと検証済みRoot／checkoutの実在結合 | Workspace公開、Session認証、別BindingのAuthority |
| Workspace | CROS環境が公開候補にするRepository Bindingの明示集合 | User Directory、Project正本、Credential、操作Authority |
| Repository Exposure | 一つのBindingを一つのWorkspaceへ含めるServer所有設定 | SessionがそのWorkspaceを利用できるという証明 |
| Authenticated Session | 認証済みPrincipal、許可されたWorkspace集合、有効期限、取消状態 | Repositoryの自動登録、Project RelationからのAuthority生成 |
| System Administration Capability | Workspace／Binding／Credential Adapter等の管理操作 | Project／Commercial内容の自動読取り権限 |

Developer、PM、Management、`general`、`privileged`等は利用者像または配置先の表示名として使用できるが、CROS Coreの固定Role階層にしない。特にSystem Administration CapabilityをContent Accessの上位Classにせず、管理権限からMGMT／Commercial Repositoryの閲覧権限を生成しない。

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
      │ SessionのWorkspace Grantと交差
      ▼
利用可能なRepository集合
```

Shared Serverでは、Server CredentialがRepositoryを取得できること、Filesystem上にRepositoryが存在すること、Pathを知っていること、およびProject RegistryへRelationがあることを、MCP利用者の閲覧Authorityとして扱わない。

Workspace ExposureはCROS Application内の公開境界である。Host UserがRepository Poolを直接読める環境では、CROSを迂回した読取りまで防ぐHost Security Boundaryにはならない。共有利用者へHost ShellまたはFilesystem Accessを与える場合は、OS Principal、ACL、Container／Process分離またはCredential分離を別に成立させる。

## 4. Workspace Grantを用いる理由

v0.21候補では、`general < privileged < administrator`というグローバルなAccess ClassをCoreへ固定しない。

| 構造 | 判断 |
|---|---|
| 単一のAccess Class階層 | Projectごとの差、Commercialだけの分離、管理権限と内容閲覧の分離を表せず、上位Classへ過大なAuthorityが集まりやすい |
| User × Repository × Operationの独自ACL | 表現力は高いが、CROSがIAM製品化し、運用・回復・監査Costが大きい |
| Session × Workspace Grant | Repository集合を粗い単位で明示でき、同じWorkspaceを複数Principalへ外部認証基盤から割り当てられる。CROS CoreはUser Directoryを持たずに済む |

```text
Session A
  └─ Workspace Grant: development
       └─ DEV Repository Set

Session B
  ├─ Workspace Grant: development
  └─ Workspace Grant: management
       └─ DEV + MGMT Repository Set

Session C
  └─ System Administration Capability
       └─ Content Workspace Grantは自動付与しない
```

単一画面でDEVとMGMTを統合する必要がある場合も、混在Repositoryを持つ`Common Workspace`を必須にしない。Sessionが利用できる複数Workspaceの和集合からProject Viewを構成し、各fieldへSource Workspace、Repository、Revisionおよび取得状態を保持する。

### 4.1. Grantを設定する主体

Workspace Grantの元は、CROS Serverが所有する「接続Credentialと許可Workspace集合のBinding」である。固定Role名から推定せず、対象Trust Domainで必要なSystem Administration Capabilityを持つ管理Sessionだけが設定する。

```text
[CROS管理Session]
   │ credential.issue／credential.grant.manage
   ▼
[Credential Record]
   ├─ Credential Reference
   ├─ Granted Workspace IDs
   ├─ Issued／Expires／Revoked
   └─ Grant Revision
          │ 認証時に検証
          ▼
 [Authenticated Session]
   ├─ Principal Reference
   └─ Workspace Grants
          │
          ▼
 [Workspace Exposure]
          │
          ▼
 許可されたRepository集合
```

| 管理操作 | 必要なSystem Capability | Content Accessへの効果 |
|---|---|---|
| Workspace作成・更新 | `workspace.manage` | なし |
| Repository Exposure変更 | `exposure.manage` | なし |
| Credential発行・失効 | `credential.issue`／`credential.revoke` | 発行時に明示したWorkspaceだけ |
| CredentialのGrant変更 | `credential.grant.manage` | 対象Credentialの次回認証または再検証後に反映 |

管理Sessionがこれらの操作を行えることから、Project、ManagementまたはCommercial内容の読取りを許可しない。管理操作はTrust Domain、対象Workspace、対象Credential、設定Revisionおよび実行主体を監査可能にし、Grant縮小またはCredential失効時は既存Sessionを`revalidation_required`または`revoked`へ遷移させる。

Credentialの表示名にTeam名を使用することはできるが、表示名を認証主体またはHuman Identityと同一視しない。代表構成では失効、rotate、監査および漏えい時の影響範囲を限定するため、Client／接続先／端末単位のCredentialを基本とする。Team共用Credentialを採用する場合は、個別追跡不能、共有・転送および一括失効の影響を明示した別の配置判断を必要とする。

## 5. Repository利用可否

Shared Serverで一つのRepository Bindingを利用可能とするのは、次の条件をすべて満たす場合だけである。

```text
Bindingが検証済み
  AND Trust PolicyがRepository／Publisher／Revisionを許可
  AND WorkspaceがBindingを明示Exposure
  AND SessionがWorkspace Grantを保持
  AND 情報分類・Repository制約を満たす
  AND Operationに必要なAuthorityが別途成立
```

Repository ManifestはRepository ID、Project Relation、Context ResponsibilityおよびRepository自身が要求する制約を宣言できるが、Authorityの正本ではない。Manifestの変更だけでWorkspace Exposure、Session GrantまたはServer Policyを緩和できない。将来、Repository側の最小情報分類をSchemaへ追加する場合も、Server側Policyと交差し、Repository宣言は許可を広げず制約を狭める方向にだけ作用させる。

`required_access: privileged`のような固定Classは、情報分類と認証主体の対応が確定するまでSchemaへ追加しない。Project名、Repository名、Directory名またはContext Responsibilityから暗黙のClassを割り当てない。

## 6. Canonicalな読取り経路

```text
MCP／CLI／Workbench
        │ {Project ID, Purpose}
        ▼
[Session Resolver]
        │ {Principal, Workspace Grants, Expiry}
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

## 7. 認証、Credential、Session

CROS Coreは認証方式を固定せず、認証Adapterから次の限定Contextを受け取る。

| 入力 | 条件 |
|---|---|
| Principal Reference | CROS内の表示名ではなく認証Adapterが再検証できる不透明参照 |
| Workspace Grants | 対象Trust Domain内の明示Workspace ID集合 |
| System Capabilities | Content Accessと分離した管理操作の限定集合 |
| Issued／Expires／Revoked | 有効期間と取消を判定可能にする |
| Authentication Evidence Reference | Secret値を複製せず、認証結果を追跡できる参照 |

Remote MCP接続では、MCP metadata、Client名または接続SessionだけからAuthenticated Sessionを生成しない。Credential再利用はClientまたは外部Credential Providerが安全に所有し、CROS Repository、Project-local `.crdd`、Prompt、logまたはProjectionへSecret値を保存しない。

User Password Database、Password Reset、MFA、Organization Group Directoryおよび独自SSOはv0.21のCROS Core対象外とする。固定Bearer、外部Identity Provider、OS Credential等の具体Adapterは、脅威モデル、失効、rotate、漏えい時の影響および配布環境を個別に確認して採用する。

初期構築用Bootstrap Capabilityを提供する場合は、管理操作だけに限定し、一回利用または明示失効、期限、再発行、紛失時の回復および通常Sessionへの非流用を必要条件とする。Bootstrap CapabilityからContent Workspace Grantを自動付与しない。

```text
cros server init
      │ 一回限りのBootstrap Capability
      ▼
初期管理Session
      ├─ Trust Domain初期化
      ├─ Workspace作成
      ├─ Repository Exposure設定
      └─ 通常Credential発行
      │
      ▼
Bootstrap失効＋失効確認
```

Credential RecordはServer側のTrust Domain Runtime Dataへ置き、Secret値そのものはRepository、Repository-local `.crdd`または投影へ置かない。認証Adapterが照合可能なVerifierまたは外部Credential参照と、Grant metadataを分離する。Credential発行、Grant更新およびSession生成を一つの暗黙操作へ畳まない。

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

## 9. Session状態遷移

```text
[開始]
   │ 認証要求。Authority未発行
   ▼
[S1: unauthenticated]
   │ 認証成功＋Grant検証
   ▼
[S2: active]
   ├─ 期限切れ ─────────────→ [S3: expired]
   ├─ 取消確認 ─────────────→ [S4: revoked]
   ├─ Trust／Workspace改訂不一致 → [S5: revalidation_required]
   └─ 明示終了＋資源回収 ─────→ [終了: closed]

[S3／S4／S5]
   └─ Repository Read／Operation Authority発行なし
```

| 状態 | Repository Read | 新規Operation Authority | 再開 |
|---|---|---|---|
| `unauthenticated` | なし | なし | 認証Adapterへ戻る |
| `active` | Workspace GrantとPolicyの交差範囲 | Operationごとに別途判定 | 同じSession Identityと現行Revisionを再検証 |
| `expired` | なし | なし | Credential Providerで再認証 |
| `revoked` | なし | なし | 同じCredentialから自動復帰しない |
| `revalidation_required` | なし | なし | Trust／Workspace／Bindingの現行版を再確認 |
| `closed` | なし | なし | 新しいSessionを作る |

## 10. 登録、Exposure、解除

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

## 11. データフロー

```text
<<Git Provider>>
       │ Repository bytes／Revision
       ▼
[Repository Pool] <── [Binding Registry]
       │                        ▲
       │ verified read          │ server-owned relation
       ▼                        │
[Authorized Repository Resolver] <── {Session Context}
       │
       │ source + provenance
       ▼
[Project Federation]
       │
       ▼
[Projection Builder] ──→ <<MCP／CLI／Workbench>>

<<Credential Provider>> ── opaque authentication result ──→ [Session Resolver]
Secret value -x Repository／.crdd／Prompt／Projection
```

## 12. Personal／Sharedの利用者体験

| 場面 | 主入口 | 主表示 | 詳細へ退避 |
|---|---|---|---|
| Developerの日常作業 | 対象Repository＋Local AI | そのRepositoryが所有するContext | Federation、別Repository、内部Binding |
| PMのProject確認 | CROS＋MCP／Workbench | 一つのProjectとSource Coverage | Repository／Workspace／Revision診断 |
| Managementの横断確認 | Portfolio Projection | Projectごとの注意、主要判断、観測時点 | 個別Topic、Meeting、CHG |
| Server管理 | 管理専用CLI／Surface | Binding、Exposure、Session／Credential Adapter状態 | Project内容。管理権限だけでは表示しない |
| 対話から構築への移送 | Chat Agent＋CROS | 昇格済みContext、Objective、判断境界 | 会話全文、無関係な規則、秘密値 |
| 構築中の判断待ち | Coding Agent＋CROS | 未決事項、根拠、必要なDecision Authority、再開条件 | 内部推論全文、未許可Effect |

`Unlock`は外部認証または追加Workspace Grantの取得が可能で、対象の存在を開示できる場合だけ表示する。`restricted`、存在開示不可または管理者権限だけの利用者へContent Unlockを提示しない。

## 13. 失敗と安全な結果

| 失敗 | 結果 |
|---|---|
| Server Credentialは読めるがExposureなし | Repositoryを解決対象へ入れない |
| Exposureあり、Session Grantなし | 内容・件数を返さず`restricted`または非開示 |
| Session有効だがBinding不明／競合 | `unknown`／`conflicting`、Effect 0 |
| Manifestが制約を緩和 | Server Policyを維持し、差分を拒否または再確認待ち |
| WorkspaceまたはTrust Policy改訂 | 既存Sessionを`revalidation_required`へ移す |
| Credential取消 | 新規Read／Operationを止め、実行中Operationは固有の取消・Recovery契約に従う |
| CredentialのGrantを縮小 | 既存Sessionを再検証待ちにし、旧Grantでの新規Read／Operationを止める |
| Projection Sourceの一部取得不能 | 完全なProject回答にせず、開示可能なSource Coverageを返す |
| Canonical Resolverを迂回するPath入力 | Repositoryを読まず拒否する |
| MCP接続済みだがOperating Context未解決 | CRDD準拠またはTask開始済みと表示せず、Effect 0 |
| Handoff先がContext Revisionを再構成不能 | 不足を表示して停止し、会話や推定で補完しない |

## 14. v0.21の完成条件

- PersonalとShared Serverが同じProject／Repository／Bindingモデルを使用する。
- Personalでは登録済みLocal Bindingだけを使い、Git Access失効と既存cloneを混同しない。
- Shared ServerではServer Credential、Repository Pool、Workspace ExposureおよびSession Grantを分離する。
- SessionはWorkspace Grantを持ち、グローバルAccess ClassやAdministrator継承から内容閲覧権限を生成しない。
- Repository Manifestは制約を提案できるが、Workspace ExposureまたはSession Authorityを発行できない。
- Canonical Resolverを通らないPath指定でRepositoryを読めない。
- Content AccessとSystem Administration Capabilityが分離される。
- 管理Capabilityを持つSessionだけがCredentialとWorkspace GrantのBindingを設定でき、管理CapabilityからContent Grantを生成しない。
- Credential発行、Grant設定、認証、Session生成、Grant再検証および失効を区別できる。
- Secret値がRepository、`.crdd`、Prompt、logまたはProjectionへ入らない。
- Registration、Project Binding、Workspace Exposure、UnexposeおよびUnbindが物理Repository削除と分離される。
- `available`、`credential_required`、`restricted`、`unavailable`、`conflicting`および`unknown`を内容漏えいなしに投影できる。
- Chat AgentとCoding Agentが同じCRDD正本から解決した、Revision付きのAgent Operating Contextを取得できる。
- 構造化HandoffがObjective、根拠、未決事項、Decision Authority、Effect境界および再開条件を保持し、Prompt転記を必須にしない。
- MCP接続、Agent RoleまたはHandoff受領だけからCRDD準拠、Content Access、System CapabilityまたはEffect Authorityを生成しない。
- 単一Repository、Personal複数Repository、Shared DEV Session、Shared MGMT Session、Admin-only Session、取消・期限切れ・Policy改訂を結合試験で反証する。

## 15. 現在の未確定事項

| 項目 | 現在の方針 | 確定Gate |
|---|---|---|
| 認証Adapter | Coreから分離し、Authenticated Session Contextだけを受け取る | Remote MCP脅威モデル／SPEC |
| Built-in Token Adapter | Password DBは作らない。必要性と失効・回復Costを未評価 | Shared Server代表配置の選定 |
| Repository側の情報分類field | Manifest単独でAuthorityにせず、制約を狭める用途だけ候補 | Repository Manifest v0.21 Schema |
| Workspace Registryの永続Schema | Trust Domain配下、Secret非格納、Server所有 | Runtime Data／CROS SPEC |
| Built-in Credentialの粒度 | Client／接続単位を既定候補とし、Team共用は影響を明示する | Remote MCP脅威モデル／運用Profile |
| Operating Context Schema | 正本Revision、適用根拠、CapabilityおよびDecision境界を持つ派生投影 | CROS／MCP SPEC |
| Handoff transport | 意味契約を先に固定し、MCP Tool名やAgent製品名へ結合しない | CROS／MCP SPEC |
| Shared Hostの強い分離 | WorkspaceだけでHost Shellを防げない | 配置ProfileとPlatform Threat Model |
| Linuxのsystem-wide配置 | v0.22で実環境確認 | Linux／Remote Runtime設計 |
