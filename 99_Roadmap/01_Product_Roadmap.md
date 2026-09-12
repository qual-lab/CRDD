# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-12
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
- [Runtime／CROS Product Candidates](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)
- [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)
- [CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)
- [CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)
- [CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)
- [CHG-000058](../90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md)
- [CHG-000059](../90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md)
- [CHG-000060](../90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

2026-09-11、v0.20.0の試験体系、実行知、Runtime責務分離、限定分散実行、Project State投影、localhost MCP HTTPおよび文書構造改善を公開した。完了項目は根拠をCHG・品質記録・公式tagへ接続して本登録簿から除去し、本書にはv0.21以降に再評価または実行する項目だけを残す。

### 1.1. v0.21.0 — Project運営・信頼・複数Repository

次のGroupは別々のRelease範囲ではなく、v0.21.0を一つの完成形へ収束させる依存順である。後続Groupの実装中に前段の意味契約を無断で作り直さず、変更が必要になった場合は影響するGroupと利用側を再評価する。

```text
Group A: 設計・構造化の共通Gate
        ↓
Group B: Project OperationとWorkbench利用契約
        ↓
Group C: CROSの信頼・Federation・公開接続
        ↓
Group D: 薄いSurface、Runtime設定、限定実証
        ↓
v0.21統合E2E／Release Gate
```

Workbenchは後付けのUIではない。Group BでUX、IA、表示、操作および必要な公開Application Contractを先に固定し、その要求をCROS、ProjectionおよびMCPのConsumerとして使う。Group Dの最小実装は、Group Cまでに成立した契約だけを利用し、Workbench専用の正本、状態Store、Authority判定またはFilesystem更新を持たない。

#### Group A: 設計・構造化の共通Gate

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 `.crdd` Runtime Data ContractとCRDD／CROS構造化基盤 | Adopted | Completed | [CHG-000066と完了Evidence](../90_Release/Changes/CHG-000066_Runtime_Data_Contract_and_Trust_Domains.md#12-固定候補の完了evidence)、[目標Architecture](../06_Architecture/runtime-data/02_Target_Architecture.md)、[現行Path棚卸し](../06_Architecture/runtime-data/01_Current_Path_Inventory.md) | Schema、名前付きPath領域、Consumer自動閉包、`tmp/`の外部制御面・全終端・single-use Recovery、旧Path拒否、段階的結合試験およびCRDD公式Repositoryの物理清掃を完了した。固定Commitの独立再レビュー、全回帰、署名、正式4経路E2EおよびRecovery Matrixが成立 |
| v0.21 業務プロセス分析の目的別投影 | Adopted | In Progress | [目的別投影](../01_Discovery/01_CRDD_Product_Discovery.md#discovery-process-method-projection) | Discovery固定入口へ基本図セクションを常設し、進展時に項目単位／全体単位で現行図または理由付き非該当を必ず更新する。プレーンテキスト記法、根拠改訂版および未確認範囲を標準Templateと代表例で検証する |
| v0.21 工程別の図面処置と成果物構造 | Adopted | In Progress | [CHG-000068](../90_Release/Changes/CHG-000068_Phase_Diagram_and_Intent_Handoff.md)、[工程別の図面処置契約](../03_Documentation.md#phase-diagram-disposition-contract) | DiscoveryからVerificationまで、上位意図の保持／承認済み変更／未解決／下位義務を工程固有の図から反証できるよう、基本図、発火境界、プレーンテキスト記法、固定入口の処置一覧および出口Gateを定義する。ArchitectureではER図とSchema Responsibility Mapを加え、概念EntityのRelation／多重度と、複数Schema／Domain／ConsumerのCanonical Owner、共通／固有、参照、拡張および所有禁止を物理Schema変更前に確定する。図から明らかになった分岐・境界・状態・責務を設計と検証義務へ接続し、未処置をCheckerと工程移行レビューで検出する |

#### Group B: Project OperationとWorkbench利用契約

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 Project Management Projection | Adopted | Architecture In Progress | [CHG-000067](../90_Release/Changes/CHG-000067_Project_Operation_Context.md)、[Project Operation Context設計](../06_Architecture/project-operation/01_Architecture.md) | Project／Repository／Binding Identity、正本別Property、欠測表示および更新Authorityを一体設計する |
| v0.21 Topic／Project Attention | Adopted | Architecture In Progress | [CHG-000067](../90_Release/Changes/CHG-000067_Project_Operation_Context.md)、[Topic Lifecycle](../06_Architecture/project-operation/01_Architecture.md#6-topicとmeetingのlifecycle) | Topicの発火、待機、昇格、終了および既存正本への接続を同じ変更単位で固定する |
| v0.21 Meeting／Context Promotion | Adopted | Architecture In Progress | [CHG-000067](../90_Release/Changes/CHG-000067_Project_Operation_Context.md)、[責務境界](../06_Architecture/project-operation/01_Architecture.md#4-責務境界) | 時点付きContext形成、Source、関連Topic、昇格先および人間の判断境界を固定する |
| v0.21 複数Projectの読み取り専用Portfolio投影 | Adopted | Planned | [CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界)、[長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md) | Projectごとの正本とAuthorityを分離したまま、横断Viewを代表構成で検証する |
| v0.21 CROS Workbenchの利用体験・公開契約 | Adopted | Design In Progress | [Workbench工程Gate](../90_Release/Changes/CHG-000067_Project_Operation_Context.md#41-cros-workbenchの工程gate)、[構造化基盤とWorkbench](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crdd-runtime-data-contractとcrddcros構造化基盤)、[UI要求](../04_UI/01_User_Interface.md#9-v021-project-operationcros-workbench) | Discovery、UX、IA、UI、UI／SPEC対応、SPEC、Architectureの順で入口・基本図処置・出口を通し、Project／Portfolio、Source Coverage、Topic／Meeting／判断待ち、正本導線および定型操作に必要な読取り・Command／Candidate契約をGroup Cの実装前に固定する |

#### Group C: CROSの信頼・Federation・公開接続

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 OSS Runtimeの利用者所有Trust Policy | Adopted | Planned | [OSS Runtime Trust Policy候補](../01_Discovery/01_CRDD_Product_Discovery.md#oss-runtime-trust-policy-candidate) | CROSの実装前にPolicy所有者、既定拒否、鍵更新・失効、移行および監査境界を固定する |
| v0.21 Repository Tool／Capability Registry | Adopted | Planned | [Repository Capability構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#4-repository-toolcapability-registry) | 登録・公開・実行許可を分ける最小Registryと代表Toolの受入条件をCROSの実装前に設計する |
| v0.21 Context Operating System（CROS） | Adopted | Architecture In Progress | [CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md) | Group Bの利用契約を入力に、Personal／Shared Serverの共通Project Model、Workspace Exposure、Connection Credential、Canonical Repository Resolver、管理／内容Authority分離、Agent Operating ContextおよびChat／Coding Agent間の構造化HandoffをSPECへ固定する |
| v0.21 Remote MCP接続 | Adopted | Architecture In Progress | [CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md)、[v0.20のローカルMCP](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | Workbenchを含む利用側が共用する公開Application Contractを所有せずTransportへ限定する。Bearer Token、Connection CredentialのWorkspace集合／`system_admin`／失効、既存Constraint、切断／再送を含むRemote接続の完成条件をSPECへ固定する。独立した情報分類制度や汎用Policy Engineは作らない |
| v0.21 正式検証の安全なHeadless出力 | Adopted | Planned | [v0.20 Runtime責務分離](../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md) | 保存先Authorityと閉じた結果契約を設計し、CI／Remoteの代表経路で検証する |

#### Group D: 薄いSurface、Runtime設定、限定実証

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 CROS Workbenchの最小実装 | Adopted | Planned | [Workbench工程Gate](../90_Release/Changes/CHG-000067_Project_Operation_Context.md#41-cros-workbenchの工程gate)、[UI要求](../04_UI/01_User_Interface.md#9-v021-project-operationcros-workbench) | Group BでArchitectureまで固定した利用契約とGroup Cの実公開契約だけを使い、Project／PortfolioとSource Coverageを表示し、一つ以上の定型操作を既存Command／Candidate入口へ渡す。Implementation後はVerification工程で契約試験、結合試験、利用者成果の総合試験および必要なE2Eを完成させる |
| v0.21 AI Runtime Registry／モデルProfile外部構成 | Adopted | Planned | [AI Runtime外部構成](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#6-ai-runtime-registryモデルprofile外部構成) | 設定所有・上書き・Adapter追加境界と、登録・認証・実行許可の分離を固定する |
| v0.21 自律Operationの意味契約とTrigger | Adopted | Planned | [自律Operationの責務境界](../05_Autonomous_Operation.md#autonomous-operation-responsibility) | 目的・Authority・Triggerの所有分離と、判断不足時のEffect 0を受入条件にする |
| v0.21 自律Operationの読み取り中心参照実証 | Adopted | Planned | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界) | 外部Effectを伴わない代表Operationを選び、判断価値と人間負荷を実測する |

### 1.2. v0.22.0 — 常設CROS運用・耐久Operation

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 Linux配布と常設CROS Server運用 | Adopted | Planned | [Discoveryの保留境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-linux-remote-runtime) | v0.21のRemote MCP意味契約を作り直さず、Linux配布、Service起動・停止、設定、更新、Health、障害回復および本番同等E2Eを固定する |
| v0.22 耐久Operation Queueと再開Scheduler | Adopted | Planned | [Operation健全性と人間接続](../05_Autonomous_Operation.md#operation-health-and-human-interface)、[実行・計画系研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | v0.21のTask SessionとRuntime Dataを入力に、再起動・切断を跨ぐ保存、Lease、排他、重複抑止、取消およびexact再入場を固定する |
| v0.22 Remote Event受付と許可済みOperation継続 | Adopted | Planned | [自律Operation](../05_Autonomous_Operation.md)、[CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界) | v0.21のTrigger意味契約を使い、時刻、Webhook、Git／CI Eventの代表Adapterから許可済みOperationを起動・停止・回復する本番同等E2Eを行う |
| v0.22 常設・自律Operationの有用性／安全性評価 | Adopted | Planned | [実行知](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments) | 独立機能ではなくRelease Gateとして、価値、費用、人間負荷、誤作動、回復負担および停止条件を実行知から評価する |

### 1.3. 版未定・再評価待ち

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| macOS対応 | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 実機Macまたは正式なmacOS実行環境を利用可能になった時点で、価値、対象構成、完成条件および版を再評価する |
| Self-hosted Provider | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 既存Adapter、Trust PolicyおよびCapability評価の実績後に、価値、安全性、費用および責任主体を再評価する |
| 高度な実行・計画最適化 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | v0.21の参照実証とv0.22の実行評価から、人間判断と停止条件を保てる範囲を再評価する |
| 複数Projectの横断調整・最適化 | Held | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針) | v0.21の読み取り専用Portfolio投影と後続の実行Evidenceを基に、Project間の優先順位、Capacity、投資判断およびEffect Authorityを別能力として採否する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は完了根拠へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、v0.21の参照実証、v0.22の実行評価または版未定の高度な最適化へ責務ごとに分けた。将来候補の存在は、版予約、実装許可またはRelease条件を意味しない。長期能力地平との比較は未完了Taskではなく、各VersionのRelease Readinessで行う定期評価である。

## 2. 版ごとにできるようになること

| 版 | 利用者ができるようになること | 成立させる基盤 | この版では行わないこと |
|---|---|---|---|
| v0.20.0 | 一つのローカルProjectで、分離されたProject RuntimeをMCP stdio／localhost HTTPから利用し、実行状態と実行効果を観測しながら、競合しない少数Taskを安全に並行実行して一つの受入結果へ統合できる | 試験レベル別の自動回帰、実行知、Runtime責務分離、限定分散実行、読み取り専用Project State、認証済みlocalhost HTTP | 複数Repository、常設Remote運用、一般Network公開、自律的なOperation開始、Project Management正本の新設 |
| v0.21.0 | 複数ProjectのCRDD正本を中央へ移さず横断参照し、Projectの現在地・注意事項・会議から昇格した判断を目的別に把握できる。業務変革では、同じDiscovery根拠からSIPOC、BPMN／Swimlane、Value Stream等の必要なViewを選んで理解できる。Repository固有Toolを明示Capabilityとして登録し、人間・AI・CLI・CI・MCP・最小Workbenchから同じ契約と構造化結果を利用できる。WorkbenchでProject／Portfolio、Source Coverage、Topic／Meeting／判断待ちを確認し、正本または既存の定型操作へ進める。利用者または組織が信頼するRuntime発行者を選び、Coordinator本体を変更せず、登録済みAI Runtimeのモデル／Reasoning ProfileやTask Role割当を設定で更新できる。認証・認可されたRemote MCPを含む共通入口からTask Sessionへ接続し、Chat AgentとCoding Agentが同じCRDD正本から解決したOperating Contextと構造化Handoffで人間判断待ち・決定・再開を扱える。読み取り中心の参照Operationで自律実行の価値も試せる | Project Management Projection、Topic、Meeting／Context Promotion、業務プロセス分析の目的別投影、Repository／`.crdd` Runtime Data Contract、Repository Capability Registry、共通TS API／CLI／構造化結果、AI Runtime Registry／Profile、利用者所有Trust Policy、Remote MCP、CROS、CROS Workbench、Agent Operating Context／Handoff、複数Projectの読み取り専用Portfolio投影、自律Operationの意味契約 | Workbench内の第二正本・独自業務ロジック、高度なGit Client、汎用Dashboard、全案件への目的別View一式の強制、Directory自動探索によるTool公開、Caller由来の任意Shell、設定だけによる未知CLIの実行、認証情報の設定埋込み、費用だけによる自動モデル選択、固定Access Role階層、会話全文の自動同期、Project間の自動優先順位・Capacity配分、Organization横断Effect Authority、Linux常設運用、耐久Queue、Remote Eventによる継続実行、Internet一般公開、未承認の外部Effect |
| v0.22.0 | v0.21で成立したCROSをLinux Serverへ常設し、許可済みOperationを耐久Queueへ受け付け、時刻・Event、切断、取消、再起動およびRecoveryを跨いで限定的に完遂できる。効果と人間負荷を実行知で評価できる | Linux配布／Service運用、耐久Operation Queue、再開Scheduler、Remote Event Adapter、限定自律Operation、運用評価Gate | Remote MCP意味契約の再実装、Internet一般公開、Multi-tenant、無制限な自己目的生成、Organization全体の自動最適化 |
| 将来版 | Self-hosted Provider、macOS、より高度なCapability Routing／再計画、Project間の投資・優先順位・Capacity最適化を、先行版のEvidenceに基づいて選択的に追加できる | Provider／Platform Adapter、Trust Policy、実行知、v0.21の複数Repository分離、v0.22の常設実行Evidence | 実環境の根拠がない対応表明、単一Scoreによる自動判断、人間または配置先所有者のAuthority代替 |

公開済みv0.19.0以前の到達点と移行情報は[CHANGELOG](../CHANGELOG.md)を正本とし、本書へ複製しない。発展の中心は、機能数ではなく人間が扱う抽象度である。v0.20は分離・観測・限定並列化、v0.21は複数ProjectのContext把握と判断接続、v0.22は常設環境での限定的な継続実行を成立させる。将来の複数Project横断調整・最適化は、複数Projectを読めることではなく、Project間の資源・優先順位・投資およびEffect Authorityを扱う能力として別に判断する。

```text
v0.20  ローカルの単一Projectを、分離・観測・限定並列化する
   ↓
v0.21  複数ProjectのContextを結び、Remote MCPから人間判断と安全な受付をつなぐ
   ↓
v0.22  CROSをLinuxへ常設し、耐久QueueとRemote Eventで許可済みOperationを継続する
   ↓
将来    Provider／Platformを広げ、Evidenceを基に組織最適化へ進む
```

## 3. 計画判断の履歴

| 日付 | 採用・変更した計画 | 現在の参照先 |
|---|---|---|
| 2026-09-05 | v0.20を、ローカル単一Projectの試験体系、実行知、Runtime責務分離、限定分散、状態投影、localhost MCPへ固定。Linux／Remoteは後続へ分離 | [v0.20.0公開記録](../CHANGELOG.md#v0200--2026-09-11) |
| 2026-09-06 | Project運営、Topic、Meeting、Trust Policy、Capability Registry、Remote MCP、CROS、複数Projectの読み取り専用Portfolio投影、自律Operationをv0.21へ採用 | [v0.21未完了作業](#11-v0210--project運営信頼複数repository) |
| 2026-09-07 | AI Runtime Registry／モデルProfile外部構成をv0.21へ追加 | [Runtime／CROS候補](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#6-ai-runtime-registryモデルprofile外部構成) |
| 2026-09-11 | Workbenchを先行せず、Repository、`.crdd`、Tool、構造化結果、MCPの共通契約を先に整える基盤をv0.21へ追加 | [Runtime Data・構造化・Workbench基盤](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crdd-runtime-data-contractとcrddcros構造化基盤) |
| 2026-09-11 | Linux／Remote Runtime、耐久Queue／Scheduler、Remote Trigger、実行評価をv0.22へ採用。macOSは実環境取得まで版未定 | [現在のv0.22未完了作業](#12-v0220--常設cros運用耐久operation) |
| 2026-09-12 | `.crdd`整理を構造化基盤の最初の作業として明示し、現行Producerと物理残存を分けて棚卸ししたうえで、Repository-local／CROSの分離、親子階層、`config/`および`tmp/`の限定用途を目標Architectureへ固定する | [現行Path棚卸し](../06_Architecture/runtime-data/01_Current_Path_Inventory.md)、[目標Architecture](../06_Architecture/runtime-data/02_Target_Architecture.md) |
| 2026-09-12 | 固定3 Role方式や永続認証Sessionを採用せず、Bearer TokenをRequestごとにConnection Credentialへ照合し、`workspace_ids[]`と`system_admin`を分離する。Chat AgentとCoding Agentは同じCRDD正本から解決したOperating Contextを使い、構造化Handoffで判断待ちと再開を接続する | [CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md) |
| 2026-09-12 | v0.21へ採用し利用形態・完成条件・対象外を固定したCapabilityは、既知の使い捨て中間構造を正式化せず、現在宣言した利用形態を端から端まで閉じる。内部の段階実装は維持し、Roadmap候補や将来の一般的便利さだけでは実装しない | [実装完結性と最小責務](../19_Maintenance.md#宣言済みcapabilityの実装完結性と最小責務) |
| 2026-09-12 | 長期能力地平との比較を単発の未完了Taskから外し、各VersionのRelease Readinessで到達、未到達、境界変化を評価する定期Gateへ移した。業務プロセス投影とOrganization Runtimeの候補名も、実際の対象が分かる名称へ変更した | [Release Readiness](../19_Maintenance.md#53-release-readiness)、[目的別投影候補](../01_Discovery/01_CRDD_Product_Discovery.md#discovery-process-method-projection) |
| 2026-09-12 | CROS Workbenchの最小実装と業務プロセス分析の目的別投影をv0.21へ採用した。WorkbenchはProject／Portfolio、Source Coverage、Topic／Meeting／判断待ち、正本導線および既存定型操作までを対象とする。目的別投影は単発の図作成にせず、Discovery進展時の項目別／全体Viewの再評価、プレーンテキスト記法、現行性および非該当理由を工程規則とTemplateで保持する。v0.22はRemote MCPの再実装ではなく、Linux常設運用、耐久Operation、Remote Event Adapterおよび運用評価Gateへ再編した | [構造化基盤とWorkbench](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crdd-runtime-data-contractとcrddcros構造化基盤)、[目的別投影](../01_Discovery/01_CRDD_Product_Discovery.md#discovery-process-method-projection)、[v0.22未完了作業](#12-v0220--常設cros運用耐久operation) |

計画変更時は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および変更トレースを示し、過去の判断を遡及上書きしない。候補の利用者課題、価値、採用境界は[Runtime／CROS Product Candidates](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md)と各情報源が所有する。Roadmapは具体的なSchema、Path、契約または実装順序を定義しない。

## 4. 境界

[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
