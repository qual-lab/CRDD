# Runtime／CROS Product Candidates

Status: Discovery Candidate Context
Owner: Qual-Lab
Last Updated: 2026-09-11
Related:
- [CRDD標準自身の課題探索・要求形成](01_CRDD_Product_Discovery.md)
- [Product Roadmap](../99_Roadmap/01_Product_Roadmap.md)
- [自律Operation](../05_Autonomous_Operation.md)

---

> 本書は、v0.21以降に検証するRuntime／CROS候補の利用者課題、価値、採用境界を所有する。版、状態、次のGateはRoadmapが所有し、確定したSchema、Path、実装順序またはArchitectureを先取りしない。

## 1. 候補の関係

```text
CRDDの正本
    ↓
Project運営の投影・Attention・Communication昇格
    ↓
Repository／Tool／Runtime Dataの構造化
    ↓
CROSによる複数RepositoryのContext解決
    ↓
認証・認可されたRemote MCPと限定Operation

横断基盤:
  利用者所有Trust Policy
  AI Runtime Registry
  構造化されたTS API／CLI／Result
```

## 2. Project Operation／Project Management Projection

Project Operation Contextは、Project、Commercial、Topic、Meetingおよび既存CRDD正本を、Project運営に必要なViewへ接続する候補である。JIRA、Notion、Excel WBS等をCRDD内へ再実装せず、Projectionを正本、更新StoreまたはWorkbench専用Databaseにしない。

```text
CRDDの正本
  ↓
Project Management Projection
  ├ WBS／Milestone／Dependency
  ├ Kanban／Progress／Blocker
  ├ Risk／Issue／Active Topic
  ├ Decision Required／Recent Meeting
  └ Forecast／Release Readiness／AI Summary
```

| 観点 | 保持する境界 |
|---|---|
| 正本 | ViewごとにProject Stateを複製しない。操作は正本の変更候補を作り、Context照合とAuthorityを経て更新・再投影する |
| Identity | Project ID、Repository ID、Repository Binding IDを分け、一つの論理Projectへ複数Repositoryを接続できるようにする |
| 推定 | Task完了率、AI推定または単一表示だけでProject健全性、進捗、予測またはRelease可能性を確定しない |
| WBS | Project WBSとChange WBSを同じ関係から異なる深さで表示し、WBS自体をCanonical Entityにしない |
| Property | ID、状態、Owner、Priority、Milestone、Dependency、完了条件、進捗根拠を全成果物へ一律複製せず、所有正本を先に定める |
| 欠測 | `missing`、`restricted`、`conflicting`および`stale`を空値、正常または0へ畳まない |
| 操作 | Projectionを直接更新せず、対象正本が所有するCommandまたは変更候補へ戻す |
| 未確定 | WBS、Risk、Issue、Dashboard専用の正本Directoryを先に作らない |

採否判断では、既存文書から投影できる範囲、追加Propertyの正本、Dependencyによる順序導出、複数AIとの共用、外部PM Toolなしで不足する情報、およびViewから正本へ戻すAuthorityを代表ケースで検証する。

### Project、CommercialおよびRepositoryの責務

| 概念 | 候補責務 | 境界 |
|---|---|---|
| Project | 案件のSummary、Scope、Stakeholder、Organization、Governanceおよび大枠Schedule | 案件に関係するすべての正本を集約しない |
| Commercial | Projectを成立させる商取引条件 | Projectと別責務・別Repositoryにできることだけを先に固定し、完全な会計Schemaを作らない |
| Repository | Projectの一部を所有する論理Repository | Projectと同一Identityにせず、実在するclone／worktreeとも分ける。単一Roleへ固定せず複数の責務領域を所有できる |
| Binding | Repositoryと検証済みRoot／worktreeの実行時結合 | 別RepositoryまたはProject全体のAuthorityを持たない |

`20_Project`、`21_Commercial`、`22_Topics`および`23_Meetings`は、採用する場合の標準責務領域候補とする。使用しないRepositoryへ空成果物を要求せず、番号を直列工程として扱わない。

Commercialは分離の代表例であり、Topics、Meetings、Communicationまたは工程領域も同じProject IDと異なるRepository IDで別Repositoryへ分離できる。Repositoryが所有するContext ResponsibilityはTool／Runtime Capabilityと分けて宣言し、同じ責務の競合Ownerを検索順で自動選択しない。

Repository分離を情報アクセス境界にする場合は、Git Hosting、Filesystem ACL、OS UserまたはShared CROS ServerのWorkspace Exposureが実際の読取り拒否を所有する。CROS内の共通Password Gateや表示ロックだけを機密性の根拠にせず、Shared Serverは現在のConnection Credentialに結合したWorkspace集合だけをRepository単位の限定Capabilityとして利用する。別Repositoryを読めない利用者へ縮約情報を渡す場合は、情報分類と作成Authorityを持つ公開成果物として別に判断し、権限不足を自動要約で迂回しない。

## 3. Topic／Project AttentionとMeeting

| 概念 | 役割 | 作らない条件・昇格条件 |
|---|---|---|
| Topic | Conversation上のAttentionが移動しても失ってはいけない関心事を一時保持する | 既存単位へ一意に還元でき、複数Contextを束ねず継続追跡価値もなければ作らない。整理後はDiscovery、Decision、CHG、Roadmap、Work等へ分解・昇格または閉じる |
| Risk／Issue | Topic内で将来事象と顕在化済み問題を区別し、必要な横断Viewへ投影する | 独立した第二正本を先に作らない |
| Meeting | 時間境界を持つContext形成Activity | 生Transcriptを正本化せず、議論したTopic、確認したDecision、更新した正本、残った問い、Sourceを保持する |
| Message Theme | Communication内の意味クラスタ | MeetingやProject Attentionと同一視しない |

Meeting、TopicおよびCommunicationは使用サービスでなく目的で分類する。同じTeamsでも、内部Context形成はMeeting、継続論点はTopic、外部への案内はCommunicationになり得る。Connectorは入力Adapterであり、媒体名から意味またはAuthorityを生成しない。

外部会話から抽出した候補は、既存Context照合と人間のAuthorityなしに正本へ昇格しない。現在の設計境界は[Project Operation Contextのアーキテクチャ](../06_Architecture/project-operation/01_Architecture.md)で具体化する。

## 4. Repository Tool／Capability Registry

CRDD採用Repositoryが持つBuild、Test、Preview、Asset同期、Data変換、Migration、Validation、Code Generation等を、MCP専用CommandではなくRepository所有のCapabilityとして明示登録する候補である。

```text
Tool exists
  ≠ Capability registered
  ≠ MCP exposed
  ≠ Execution authorized
```

| 観点 | 候補境界 |
|---|---|
| 配置 | `tools/<capability-name>/`程度の浅い配置を推奨できるが、階層数を規範化しない |
| 解決 | Directory名や実行可能fileの存在から能力を推定せず、Git管理されたRepository-local設定から安定ID、Entry、Runtime、由来、公開先、Authority、Human Gateを解決する |
| 共通利用 | MCP、Coordinator、CROS、Scheduler、CI、QualまたはHuman CLIが同じCapability Runtimeを利用できる形を候補とする |
| 実行 | Caller由来の任意Shellを受けず、Working Directory、Environment／Credential、Effect、Timeout、取消、出力量、cleanup、結果接続を閉じる |
| 状態 | Tool実装と定義はGit管理し、`.crdd`はRuntime生成状態、Cache、実行知等に限定する |
| Federation | CROSのCatalogを各Repositoryの正本へ昇格させず、Capabilityを別Repositoryへ自動継承しない |

具体的な設定Path、Schema、Root Manifestの要否は、実装要求と安全境界を確認してArchitectureで決める。

## 5. `.crdd` Runtime Data ContractとCRDD／CROS構造化基盤

Workbenchは新しい正本や独自Runtimeを持たず、構造化されたCRDD／CROSを人間向けに投影・操作する薄い作業台とする。v0.21では設計候補の保持だけで終えず、Projectを選択し、現在状態・Source Coverage・Topic／Meeting／判断待ちを確認し、正本または既存Toolの操作入口へ進める最小実装までを採用範囲とする。

```text
CRDD／CROS
├─ Repository Contract
├─ .crdd Runtime Data Contract
├─ Tool TS API／CLI
├─ Structured Result
├─ Identity／Status
└─ MCP Contract
        │
        ├─ AI
        ├─ CLI／CI
        ├─ MCP
        └─ CROS Workbench
```

| 境界 | v0.21の方針 |
|---|---|
| Repository | CHG、Topic、Roadmap、工程成果物、Decision、Verification、Release、昇格済みCommunicationから必要なIdentity、状態、関係、Lifecycle、Sourceを推測なしで取得できる範囲を探る |
| `.crdd` | Root、Git管理／Runtime-only、耐久／一時、Owner、保持、清掃、Recoveryを分ける。正式構成は全書込みPathの棚卸し後に決める |
| Tool | `TS API → CLI／MCP／UI`の依存方向と構造化結果を基本とし、UIだけの業務ロジックや別実装を作らない |
| Workbench | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ち、実行状態および正本への導線を表示する。定型操作は既存TS API／CLI／MCPへ渡し、Workbench専用の更新処理を持たない |

WorkbenchはSourceTreeや高度なGit操作を再実装しない。閲覧・比較・状態確認・定型操作を担い、調査・判断支援はAI、実行・統合・Runtime管理はCROS、Context・Knowledge・Decisionの正本はCRDDが所有する。v0.21の最小実装は、実際のCROS／Project Operation公開契約から取得した構造化結果を表示し、欠測・制限・競合・観測時点を失わず、少なくとも一つの既存Command／Candidate入口を同じ契約で呼び出すところまでを縦断する。画面Framework、装飾、高度なGit操作、独自検索Indexおよび汎用Dashboard Builderは完成条件に含めない。

`.crdd`の正式なDirectory Taxonomyは、全書込みPathのOwner、Purpose、Schema、Git管理、耐久性、Read／Write、保持、清掃およびRecoveryを棚卸しして決める。現行の棚卸しは[Runtime Dataの現行Path棚卸し](../06_Architecture/runtime-data/01_Current_Path_Inventory.md)、採用候補となる全体構造と`tmp/`の限定用途は[Runtime Dataの目標Architecture](../06_Architecture/runtime-data/02_Target_Architecture.md)で追跡する。Architectureの候補を、Consumer移行と検証なしに現行Runtime契約へ昇格しない。

## 6. AI Runtime Registry／モデルProfile外部構成

AIモデル名、Reasoning強度、Role割当およびCLI配置をCoordinator Coreへ埋め込まず、更新頻度の異なる設定とAdapterへ分ける候補である。

```text
Role／Task requirement
  ↓
Runtime ID／Profile selection
  ↓
AI Runtime Registry
  ↓
registered Adapter
  ↓
Provider CLI
```

| 観点 | 候補境界 |
|---|---|
| Registry | 安定Runtime ID、Adapter種別、検証可能なCommand Identity、利用可否、対応Profile、Role割当を保持する |
| 設定変更 | 既存Adapter内のモデル追加、Profile変更、Role割当、CLI配置変更は設定で完結させる |
| Adapter追加 | 起動、入出力、取消、失敗分類または認証観測が異なるRuntimeだけに要求する |
| Authority | 登録済み、Hostで利用可能、認証済み、Operationで許可済みを同一視しない |
| 安全 | 設定に秘密を保存せず、任意Executableや任意引数を構成しない |
| 実行知 | Runtime ID、Profile、Adapter、選択・fallback理由、時間、Turn、失敗、利用量を秘密情報と分けて記録する |

動的Plugin探索、Remote Plugin配布、未知CLIの設定だけによる追加、費用だけの自動最適化、Self-hosted／API Provider対応は初期完成条件に含めない。

## 7. CROS発展境界

CROSは複数ProjectのCRDD Contextを横断解決し、外部へ安定Interfaceとして提供し、Agent実行結果を該当Repositoryへ還流するRuntime／Federation層の候補である。既存の[協働プロジェクト実行モデル](01_CRDD_Product_Discovery.md#cros-collaborative-project-execution-model)を上位の正本とする。

```text
Human／Qual／外部AI・Tool
          ↕ MCP／HTTP
CROS
  ├ Project Registry／Repository Binding
  ├ Context Resolver／Context Package
  ├ Multi-Repository Federation
  ├ Task Session／Human Decision Wait・Resume
  ├ Execution Policy／Agent Organization
  └ 派生Index／Provenance／Audit
          ↕ Repository Contract
各ProjectのCRDD正本
```

| 所有する | 所有しない |
|---|---|
| Contextの解決・連合、実行Session、結果還流、派生Index | Product Requirement、ProjectのWhy、人間の重要判断、外部Toolの表示状態、各Projectの正本 |

外部Interfaceは細粒度Storage操作ではなく、`project context`、`portfolio context`、`release context`等の利用目的を一回で満たす粒度を候補とする。明示値、決定論的算出値、推定値の出典を追跡可能にする。

複数Projectの読み取り専用Portfolio投影は、対象Projectの選択・Routing、Project単位のContext・Authority・Runtime State・Recovery分離までを上限とする。未認証の一般Internet公開、Remote常設実行、Project間の自動最適化、Organization横断Effect Authorityは別の完成条件で扱う。

PersonalとShared Serverは異なるProject Modelを作らず、利用可能なRepository集合の決定方法だけを分ける。Personalは検証済みLocal Binding、Shared ServerはServer Repository Pool、明示Workspace Exposureおよび現在のConnection Credentialに記録した`workspace_ids[]`を交差させる。Server Credentialが読めること、Filesystem上に存在することまたはProject Relationを、MCP利用者の閲覧Authorityへ昇格しない。

`general < privileged < administrator`の固定Role階層は、管理権限とContent Accessを混同しやすいためCoreへ採用しない。v0.21のShared ServerはBearer TokenをRequestごとにConnection Credentialへ照合し、`workspace_ids[]`と`system_admin`を別軸で解決する。Principal、User Directory、汎用認証Adapterまたは永続認証Sessionを作らない。詳細は[CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md)で扱う。

Workspace集合は、`system_admin: true`を持つ現在のConnection Credentialによる管理Requestが、対象Credentialの発行または更新時に`workspace_ids[]`として設定する。`system_admin`、情報分類、Task Roleまたは人間の決定権限をWorkspace集合へ混在させず、管理可否からContent Accessを生成しない。

CROSは、対話を主に担うChat AgentとRepository上の構築を主に担うCoding Agentが、同じCRDD正本から解決したAgent Operating Contextを参照し、構造化Handoffで往復できる上位接続を候補とする。MCP接続済みであることをCRDD規則の認識と同一視せず、CRDD全文や会話全文を毎回転送しない。Taskに適用される規則、昇格済みContext、Objective、未決事項、Decision AuthorityおよびEffect境界をRevision付きで解決し、判断結果を所有正本へ記録して同じTask Identityへ戻す。

## 8. 採否時に確認する共通事項

- 正本を複製せず、候補が解く利用者課題と観測可能な価値を示せるか。
- 明示値、推定値、欠測、不明および人間判断を区別できるか。
- Repository、Project、Organization間のAuthorityと情報分類を越境しないか。
- TS API、CLI、MCP、UIが同じ意味契約を再利用できるか。
- 具体的なSchema、Path、実装順序をDiscoveryだけで確定していないか。
- v0.20で成立したRuntime実行Identity、Capability Provenance、署名、RecoveryおよびProvider Home保護を弱めないか。
