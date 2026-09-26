# CRDD Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-25
Related:
- [CRDD標準自身のDiscovery](../01_Discovery/01_Product_Discovery.md)
- [Product候補登録](../01_Discovery/02_Product_Candidates.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](Changes/CHG-000014/change.md)
- [CHG-000015](Changes/CHG-000015/change.md)
- [CHG-000055](Changes/CHG-000055/change.md)
- [CHG-000056](Changes/CHG-000056/change.md)
- [CHG-000057](Changes/CHG-000057/change.md)
- [CHG-000058](Changes/CHG-000058/change.md)
- [CHG-000059](Changes/CHG-000059/change.md)
- [CHG-000060](Changes/CHG-000060/change.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

2026-09-11、v0.20.0の試験体系、実行知、Runtime責務分離、限定分散実行、Project State投影、localhost MCP HTTPおよび文書構造改善を公開した。完了項目は根拠をCHG・品質記録・公式tagへ接続して本登録簿から除去し、本書にはv0.21以降に再評価または実行する項目だけを残す。

### 1.1. v0.21.0 — 設計・構造化の共通Gate

Group Aは、完成済みのRuntime Data、図面、Evidence、Version Controlおよび署名境界に加え、Group BのDiscovery／UX Dogfoodingで判明した工程成果物の受渡し構造を閉じるため再開した。工程Patternの移行と独立確認が終わるまで、Group BのIAへ進まない。

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 工程成果物Repository Pattern | Adopted | Ready for Release Handoff | [工程成果物のRepository Pattern](../03_Documentation.md#phase-repository-pattern)、[CHG-000073](Changes/CHG-000073/change.md) | DiscoveryからQualityまでの規則、ひな型、Checker、既存成果物、工程Handoffおよび独立レビューを閉じた。WorkbenchのPrototype／実画面評価とProduct UI Exitはv0.22の実装Gateで扱う |
| v0.21 Checker安定化とReality Traceability基盤 | Adopted | Complete | [CHG-000074](Changes/CHG-000074/change.md)、[Checker詳細設計](../06_Architecture/Details/checker/01_Architecture.md) | Checker責務分割、9 Subsystemの`symbol.json`、共通Schema、Global Symbol Graphおよび独立レビューを完了した。Reality Auditは本項目から分離する |
| v0.21 Semantic Coverage基盤 | Adopted | Complete | [CHG-000075](Changes/CHG-000075/change.md)、[Semantic Coverage基盤](../06_Architecture/Details/semantic-coverage/02_Semantic_IR_and_Relation_Design.md) | Coordinator／Project RuntimeのPilot、決定論的Semantic IR、完全修飾したQuality Relation、単一Bundle公開および独立レビューを完了した。Reality Auditは別Gateとして未開始を維持する |
| v0.21 CRDD Domain Library責務分離 | Adopted | Complete | [CRDD Domain Libraryの責務境界](../06_Architecture/Details/crdd-domain-library/01_Architecture.md)、[CHG-000076](Changes/CHG-000076/change.md) | `40_Develop`を実装正本、`template/tools`を薄い起動入口／設定配置とするPhase 1〜6の移行、公開入口へのConsumer Closure、全回帰および独立レビューを完了した。Coordinatorだけを再署名し、実Docker修復、Recovery Matrixおよび4経路E2EもPassした。Reality Auditは本項目から分離した次のGateとして未開始を維持する |
| v0.21 Canonical設計と現行実装のReality Audit | Adopted | Ready for Release Handoff — Legacy Projection Retained | [現行実装との照合](../07_Quality/05_Current_Implementation_Reality_Audit.md)、[CHG-000078](Changes/CHG-000078/change.md) | 全18詳細設計領域を照合し、118 Relation中60件を既存試験へ接続した。残る58件は所有工程へ移送済み。旧2 Runtime Traceability JSONは27 Propertyと全Consumerの棚卸し結果に基づきv0.21で保持し、後続移行の廃止Gateを固定した |
| v0.21 Engineering Design／Implementation／Verificationの完全性 | Adopted | Complete | [CHG-000080](Changes/CHG-000080/change.md) | Phase／Gate型CHGをDogfoodし、Architecture、Implementation Structure、Production／Test Header、Required Verification、Optionality Audit、Self MigrationおよびReality Auditを一つの変更意図として閉じた。最終Source A／Manifest carrier B、署名済みRecovery Matrixおよび4経路E2Eを固定済み。これはCHGの技術完了であり、未観測22件を含むQuality Ready、Release済みまたは公開済みを意味しない。main統合後のexact Identity確認とRelease採用は人間の最終判断が所有する |

既に完了したGroup Aの根拠は[CHG-000066](Changes/CHG-000066/change.md)、[CHG-000068](Changes/CHG-000068/change.md)、[CHG-000070](Changes/CHG-000070/change.md)、[CHG-000071](Changes/CHG-000071/change.md)および[CHG-000072](Changes/CHG-000072/change.md)が所有する。

v0.21.0はGroup AだけをRelease範囲とする。Group B以降のCanonical設計は消去しないが、未実装Capability、対応するQuality Local Item、人間受入および実境界Evidenceをv0.21の欠落またはRelease Gateへ含めない。Group Aで成立済みの現行Capabilityを壊していないこと、工程・実装・検証の共通契約が再現可能であること、および後続Groupが同じ基盤から再開できることを確認して閉じる。

### 1.2. v0.22.0 — Project運営・複数Repository

| 日程項目 | 現在値 | 根拠・扱い |
|---|---|---|
| 目標リリース日 | `2026-10-03` | 2026-09-25にQual-Labが設定 |
| 個別Roadmap項目の期限 | 未設定 | 項目ごとに必要性を確認し、設定しない項目は日程リスクを未評価とする |
| 初期の日程リスク | 高い | 目標日まで8日でDiscoveryを開始し、候補Scopeと解決案が未確定である。現Scopeの維持、分離またはリスク許容はDiscovery結果を基に人間が判断する |

次のGroupは別々のRelease範囲ではなく、v0.22.0を一つの完成形へ収束させる候補範囲である。ただし、既存の設計、WIPおよび採用済み項目名から解決形を確定しない。最初にDiscoveryで、利用者の困りごと、現在の代替、望ましい変化、利用頻度および判断価値を再確認する。そこで必要性が確認された項目だけを依存順へ確定し、後続工程へ渡す。

```text
Group B: Project OperationとWorkbench利用契約
        ↓
Group C: CROSのFederation・公開接続
        ↓
Group D: 薄いSurface、Runtime設定、限定実証
        ↓
v0.22統合E2E／Release Gate
```

Workbenchは後付けのUIではない。[入口再探索](../01_Discovery/Analysis/EXP-000029/exploration.md)と[Workbench要求](../01_Discovery/Definitions/REQ-000040/requirement.md)で、AIへの質問、標準Project Context、MCP、Workbenchおよび既存Git Clientの分担を確認した。UX、IA、並行するUI／SPEC、UI／SPEC DetailおよびArchitectureの順で具体化し、既存WIPはCanonical設計が成立した後のReality Audit入力として扱う。採用するSurfaceは、専用の第二正本、状態Store、Authority判定またはFilesystem更新を持たない。

#### Group B: Project OperationとWorkbench利用契約

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 Project Management Projection | 要求採用 | UX引き渡し待ち | [入口再探索](../01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000038](../01_Discovery/Definitions/REQ-000038/requirement.md) | 五場面、Owner Relation、共有分析、Repository Boundaryおよび更新条件をUX以降で具体化し、各Consumerから同じ品質で取得できることを検証する |
| v0.22 Topic／Project Attention | 要求採用 | UX引き渡し待ち | [TopicとMeetingの探索](../01_Discovery/Analysis/EXP-000023/exploration.md)、[REQ-000039](../01_Discovery/Definitions/REQ-000039/requirement.md) | 登録・編集・削除・一覧・取得、Relation影響確認、終了・撤回・訂正をUX以降で具体化する |
| v0.22 Meeting／Context Promotion | 要求採用 | UX引き渡し待ち | [TopicとMeetingの探索](../01_Discovery/Analysis/EXP-000023/exploration.md)、[REQ-000039](../01_Discovery/Definitions/REQ-000039/requirement.md) | 時点記録を保つ登録・編集・削除・一覧・取得と、候補処置をUX以降で具体化する |
| v0.22 複数Projectの読み取り専用Portfolio投影 | 要求維持 | UX引き渡し待ち | [Portfolio理解の探索](../01_Discovery/Analysis/EXP-000024/exploration.md)、[Project横断の再確認](../01_Discovery/Analysis/EXP-000035/exploration.md) | 同じProjectのRepository Federation後に、許可された複数Logical Projectを欠測・制限・根拠付きで比較する体験を具体化する |
| v0.22 CROS Workbenchの利用体験・公開契約 | 要求採用 | UX引き渡し待ち | [入口再探索](../01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000040](../01_Discovery/Definitions/REQ-000040/requirement.md) | Project情報、横断ProjectionおよびVersion Controlを一つの入口で扱う体験をUX以降で具体化する。既存WIPはCanonical Inputにしない |
| v0.22 UI／SPEC DetailのProduct Design実証 | 工程仮説採用 | Workbench Pilot待ち | [具体設計過程の探索](../01_Discovery/Analysis/EXP-000030/exploration.md)、[UI／SPEC Detail工程契約](Changes/CHG-000081/change.md) | Definitionから画面一覧・具体領域・詳しい振る舞いを再導出し、代表画面の探索、人間による方向判断、画面展開、反復からの部品発見、UIとBHVの双方向Coverageを実Productで検証する |
| v0.22 旧Runtime Traceability Projection移行 | Adopted | Planned — Retained until Equivalent | [CHG-000078](Changes/CHG-000078/change.md)、[Reality Audit](../07_Quality/05_Current_Implementation_Reality_Audit.md) | 旧2 JSON固有の状態・資源・検証caseをCanonical設計から決定論的に生成し、全Consumerを新入口へ移行する。同等性検査、Capability保持およびConsumer 0を独立確認するまで旧Projectionを削除しない |

#### Group C: CROSのFederation・公開接続

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 Repository Tool／Capability Registry | 要求採用 | UX引き渡し待ち | [Repository Capabilityの探索](../01_Discovery/Analysis/EXP-000025/exploration.md)、[REQ-000014](../01_Discovery/Definitions/REQ-000014/requirement.md) | Capability Contractと組織・Repository固有Adapterを分け、Repository単体ではCredentialなし、CROSでは許可Repositoryだけから同じ能力を発見・実行する体験を具体化する |
| v0.22 Context Operating System（CROS） | 要求維持 | Discovery境界確認済み／UX引き渡し待ち | [Project横断Contextの探索](../01_Discovery/Analysis/EXP-000027/exploration.md)、[Project横断の再確認](../01_Discovery/Analysis/EXP-000035/exploration.md)、[Remote利用境界](../01_Discovery/Analysis/EXP-000036/exploration.md) | Repository内正本を中央へ移さず、Logical Project Federationと読み取り専用PortfolioをRole別共有Credentialの範囲で提供する体験を具体化する。既存設計は後のReality Audit入力とする |
| v0.22 Remote MCP接続 | 要求採用 | UX引き渡し待ち | [Local MCP／HTTPの探索](../01_Discovery/Analysis/EXP-000015/exploration.md)、[Role別共有Credential](../01_Discovery/Definitions/REQ-000041/requirement.md) | Role別Bearer Credential、TLS、非開示、切断後の同一Request再取得をUX／SPEC／Architectureで具体化する。Transportが公開Application Contractを所有しない制約は維持する |
| v0.22 正式検証の安全なHeadless出力 | Adopted | Planned | [v0.20 Runtime責務分離](Changes/CHG-000063/change.md) | 保存先Authorityと閉じた結果契約を設計し、CI／Remoteの代表経路で検証する |

#### Group D: 薄いSurface、Runtime設定、限定実証

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 CROS Workbenchの最小実装 | 要求採用 | 停止中 — UX以降の設計が必要 | [REQ-000040](../01_Discovery/Definitions/REQ-000040/requirement.md)、[Workbench工程Gate](Changes/CHG-000067/change.md#41-cros-workbenchの工程gate) | UXからUI／SPEC Detail、ArchitectureおよびQualityまで閉じた場合だけ実装を開始する。既存WIPの存在を実装許可にしない |
| v0.22 AI Runtime Registry／モデルProfile外部構成 | 要求採用 | UX引き渡し待ち | [AI Runtime変更容易性の探索](../01_Discovery/Analysis/EXP-000026/exploration.md)、[REQ-000016](../01_Discovery/Definitions/REQ-000016/requirement.md)、[REQ-000023](../01_Discovery/Definitions/REQ-000023/requirement.md) | 追加可能な安定Profileを、Repository単体のローカル設定またはCROS Server設定から登録済みProvider Adapter、Modelおよび推論設定へ解決する体験を具体化する。自動Fallbackと任意Executable設定は対象外 |

### 1.3. v0.23.0 — 常設CROS運用・耐久Operation

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.23 自律Operationの意味契約とTrigger | 要求維持／解決案未決 | Discovery待ち | [自律Operationの責務境界](../05_Autonomous_Operation.md#autonomous-operation-responsibility)、[v0.22 Scope探索](../01_Discovery/Analysis/EXP-000034/exploration.md) | v0.22のProject Context、FederationおよびAI Runtime設定の成立後に、どの判断負荷を減らすか、読み取りだけでは足りない理由および許容可能なEffectを再確認する |
| v0.23 自律Operationの読み取り中心参照実証 | 解決案未決 | Discovery待ち | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界) | 代表利用者と判断場面をDiscoveryで選定した後、外部Effectを伴わない実証で判断価値と人間負荷を測定する |
| v0.23 Linux配布と常設CROS Server運用 | Adopted | Planned | [Remote Contextの探索](../01_Discovery/Analysis/EXP-000022/exploration.md) | v0.22のRemote MCP意味契約を作り直さず、Linux配布、Service起動・停止、設定、更新、Health、障害回復および本番同等E2Eを固定する |
| v0.23 耐久Operation Queueと再開Scheduler | Adopted | Planned | [Operation健全性と人間接続](../05_Autonomous_Operation.md#operation-health-and-human-interface)、[Product候補登録](../01_Discovery/02_Product_Candidates.md) | v0.22のTask SessionとRuntime Dataを入力に、再起動・切断を跨ぐ保存、Lease、排他、重複抑止、取消およびexact再入場を固定する |
| v0.23 Remote Event受付と許可済みOperation継続 | Adopted | Planned | [自律Operation](../05_Autonomous_Operation.md)、[Project横断Contextの探索](../01_Discovery/Analysis/EXP-000027/exploration.md) | v0.23で先に固定するTrigger意味契約を使い、時刻、Webhook、Git／CI Eventの代表Adapterから許可済みOperationを起動・停止・回復する本番同等E2Eを行う |
| v0.23 常設・自律Operationの有用性／安全性評価 | Adopted | Planned | [実行知の探索](../01_Discovery/Analysis/EXP-000013/exploration.md)、[参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments) | 独立機能ではなくRelease Gateとして、価値、費用、人間負荷、誤作動、回復負担および停止条件を実行知から評価する |

### 1.4. 版未定・再評価待ち

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| macOS対応 | Held | Unscheduled | [Product候補登録](../01_Discovery/02_Product_Candidates.md) | 実機Macまたは正式なmacOS実行環境を利用可能になった時点で、価値、対象構成、完成条件および版を再評価する |
| Self-hosted Provider | Held | Unscheduled | [Product候補登録](../01_Discovery/02_Product_Candidates.md) | 既存Adapter、Trust PolicyおよびCapability評価の実績後に、価値、安全性、費用および責任主体を再評価する |
| 高度な実行・計画最適化 | Held | Unscheduled | [Product候補登録](../01_Discovery/02_Product_Candidates.md) | v0.23の参照実証と実行評価から、人間判断と停止条件を保てる範囲を再評価する |
| 複数Projectの横断調整・最適化 | Held | Unscheduled | [Product候補登録](../01_Discovery/02_Product_Candidates.md) | v0.22の読み取り専用Portfolio投影と後続の実行Evidenceを基に、Project間の優先順位、Capacity、投資判断およびEffect Authorityを別能力として採否する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/Analysis/EXP-000008/exploration.md)は完了根拠へ移した。有用性・照合費用の改善候補は、v0.23の参照実証と実行評価または版未定の高度な最適化へ責務ごとに分けた。将来候補の存在は、版予約、実装許可またはRelease条件を意味しない。長期能力地平との比較は未完了Taskではなく、各VersionのRelease Readinessで行う定期評価である。

## 2. 版ごとにできるようになること

| 版 | 利用者ができるようになること | 成立させる基盤 | この版では行わないこと |
|---|---|---|---|
| v0.20.0 | 一つのローカルProjectで、分離されたProject RuntimeをMCP stdio／localhost HTTPから利用し、実行状態と実行効果を観測しながら、競合しない少数Taskを安全に並行実行して一つの受入結果へ統合できる | 試験レベル別の自動回帰、実行知、Runtime責務分離、限定分散実行、読み取り専用Project State、認証済みlocalhost HTTP | 複数Repository、常設Remote運用、一般Network公開、自律的なOperation開始、Project Management正本の新設 |
| v0.21.0 | DiscoveryからQualityまでの工程成果物を自己完結した子成果物と統合投影へ分け、設計Meaningから実装Symbol、Quality Local Item、Test、Evidenceまでを追跡できる。Checker、共通Domain Library、Repository／Runtime Data境界および変更・検証規則を、特定AIの記憶やSourceの暗黙知に依存せず再利用できる | 工程成果物Repository Pattern、基本図と可視Checklist、Checker安定化、Reality Traceability、Semantic Coverage、CRDD Domain Library責務分離、Engineering Design／Implementation／Verification完全性、実装知識の上位還元 | Project Operation／Workbench／CROSの新Capability、Remote MCP、複数Project Federation、AI Runtime Registry、自律Operation実証、Linux常設運用 |
| v0.22.0 | 複数ProjectのCRDD正本を中央へ移さず横断参照し、Projectの現在地・注意事項・会議から昇格した判断を目的別に把握できる。人間・AI・CLI・CI・MCP・最小Workbenchから同じ公開契約と構造化結果を利用し、認証・認可されたRemote MCPを含む入口から同じOperating ContextとHandoffへ接続できる | Project Management Projection、Topic、Meeting／Context Promotion、業務プロセス分析の目的別投影、Repository Capability Registry、Remote MCP、CROS、CROS Workbench、Agent Operating Context／Handoff、複数Projectの読み取り専用Portfolio投影、AI Runtime Registry／Profile | Workbench内の第二正本・独自業務ロジック、高度なGit Client、汎用Dashboard、固定Access Role階層、会話全文の自動同期、本格Trust Policy管理、自律Operation、Project間の自動優先順位・Capacity配分、Linux常設運用、耐久Queue、Remote Eventによる継続実行、Internet一般公開 |
| v0.23.0 | v0.22で成立したCROSとAI Runtime設定を入力に、自律Operationの価値と安全境界を確認し、CROSをLinux Serverへ常設する。許可済みOperationを耐久Queueへ受け付け、時刻・Event、切断、取消、再起動およびRecoveryを跨いで限定的に完遂し、効果と人間負荷を実行知で評価できる | 自律Operationの意味契約と参照実証、Linux配布／Service運用、耐久Operation Queue、再開Scheduler、Remote Event Adapter、限定自律Operation、運用評価Gate | Remote MCP意味契約の再実装、Internet一般公開、Multi-tenant、無制限な自己目的生成、Organization全体の自動最適化 |
| 将来版 | 独立Trust Policy、Self-hosted Provider、macOS、より高度なCapability Routing／再計画、Project間の投資・優先順位・Capacity最適化を、先行版のEvidenceに基づいて選択的に追加できる | 利用側からAdapterで参照するTrust Policy Capability、Provider／Platform Adapter、実行知、v0.22の複数Repository分離、v0.23の常設実行Evidence | Trust Policyの既存Runtimeへの埋込み、実環境の根拠がない対応表明、単一Scoreによる自動判断、人間または配置先所有者のAuthority代替 |

公開済みv0.19.0以前の到達点と移行情報は[CHANGELOG](../CHANGELOG.md)を正本とし、本書へ複製しない。発展の中心は、機能数ではなく人間が扱う抽象度である。v0.20は分離・観測・限定並列化、v0.21は工程・設計・実装・検証の共通基盤、v0.22は複数ProjectのContext把握と判断接続、v0.23は常設環境での限定的な継続実行を成立させる。将来の複数Project横断調整・最適化は、複数Projectを読めることではなく、Project間の資源・優先順位・投資およびEffect Authorityを扱う能力として別に判断する。

```text
v0.20  ローカルの単一Projectを、分離・観測・限定並列化する
   ↓
v0.21  工程・設計・実装・検証を、再現可能な構造とTraceabilityでつなぐ
   ↓
v0.22  複数ProjectのContextを結び、Remote MCPから人間判断と安全な受付をつなぐ
   ↓
v0.23  CROSをLinuxへ常設し、耐久QueueとRemote Eventで許可済みOperationを継続する
   ↓
将来    Provider／Platformを広げ、Evidenceを基に組織最適化へ進む
```

## 3. 計画判断の履歴

| 日付 | 採用・変更した計画 | 現在の参照先 |
|---|---|---|
| 2026-09-05 | v0.20を、ローカル単一Projectの試験体系、実行知、Runtime責務分離、限定分散、状態投影、localhost MCPへ固定。Linux／Remoteは後続へ分離 | [v0.20.0公開記録](../CHANGELOG.md#v0200--2026-09-11) |
| 2026-09-06 | Project運営、Topic、Meeting、Trust Policy、Capability Registry、Remote MCP、CROS、複数Projectの読み取り専用Portfolio投影、自律Operationを当時のv0.21へ採用。2026-09-22の再編後はv0.22 | [現在のv0.22未完了作業](#12-v0220--project運営複数repository) |
| 2026-09-07 | AI Runtime Registry／モデルProfile外部構成を当時のv0.21へ追加した。2026-09-22の再編後はv0.22 | [AI Runtime変更容易性の探索](../01_Discovery/Analysis/EXP-000026/exploration.md)、[現在のv0.22未完了作業](#12-v0220--project運営複数repository) |
| 2026-09-11 | Workbenchを先行せず、Repository、`.crdd`、Tool、構造化結果、MCPの共通契約を先に整える基盤を当時のv0.21へ追加した。共通基盤はv0.21で閉じ、Workbench／CROS Capabilityは2026-09-22の再編後にv0.22へ移した | [Runtime Data Ownershipの探索](../01_Discovery/Analysis/EXP-000016/exploration.md)、[v0.21共通Gate](#11-v0210--設計構造化の共通gate)、[v0.22未完了作業](#12-v0220--project運営複数repository) |
| 2026-09-11 | Linux／Remote Runtime、耐久Queue／Scheduler、Remote Trigger、実行評価を当時のv0.22へ採用。2026-09-22の再編後はv0.23。macOSは実環境取得まで版未定 | [現在のv0.23未完了作業](#13-v0230--常設cros運用耐久operation) |
| 2026-09-12 | `.crdd`整理を構造化基盤の最初の作業として明示し、現行Producerと物理残存を分けて棚卸ししたうえで、Repository-local／CROSの分離、親子階層、`config/`および`tmp/`の限定用途を目標Architectureへ固定する | [現行Path棚卸し](../06_Architecture/Details/runtime-data/02_Current_Path_Reality_Audit.md)、[目標Architecture](../06_Architecture/Details/runtime-data/01_Architecture.md) |
| 2026-09-12 | 固定3 Role方式や永続認証Sessionを採用せず、Bearer TokenをRequestごとにConnection Credentialへ照合し、`workspace_ids[]`と`system_admin`を分離する。Chat AgentとCoding Agentは同じCRDD正本から解決したOperating Contextを使い、構造化Handoffで判断待ちと再開を接続する | [CROS Federationと利用境界](../06_Architecture/Details/cros/01_Architecture.md) |
| 2026-09-12 | v0.21へ採用し利用形態・完成条件・対象外を固定したCapabilityは、既知の使い捨て中間構造を正式化せず、現在宣言した利用形態を端から端まで閉じる。内部の段階実装は維持し、Roadmap候補や将来の一般的便利さだけでは実装しない | [実装完結性と最小責務](../19_Maintenance.md#宣言済みcapabilityの実装完結性と最小責務) |
| 2026-09-12 | 長期能力地平との比較を単発の未完了Taskから外し、各VersionのRelease Readinessで到達、未到達、境界変化を評価する定期Gateへ移した。業務プロセス投影とOrganization Runtimeの候補名も、実際の対象が分かる名称へ変更した | [Release Readiness](../19_Maintenance.md#53-release-readiness)、[目的別投影の規則](../21_Discovery.md#37-progressive-process-views) |
| 2026-09-12 | CROS Workbenchの最小実装と業務プロセス分析の目的別投影を当時のv0.21へ採用した。WorkbenchはProject／Portfolio、Source Coverage、Topic／Meeting／判断待ち、正本導線および既存定型操作までを対象とする。目的別投影は単発の図作成にせず、Discovery進展時の項目別／全体Viewの再評価、プレーンテキスト記法、現行性および非該当理由を工程規則とTemplateで保持する。2026-09-22の再編後はWorkbenchをv0.22、常設運用をv0.23とする | [Runtime Data Ownershipの探索](../01_Discovery/Analysis/EXP-000016/exploration.md)、[目的別投影の規則](../21_Discovery.md#37-progressive-process-views)、[v0.22未完了作業](#12-v0220--project運営複数repository)、[v0.23未完了作業](#13-v0230--常設cros運用耐久operation) |
| 2026-09-22 | v0.21をGroup Aの設計・構造化共通Gateで閉じ、Project Operation、Workbench、CROS、Remote MCPおよび限定実証をv0.22へ移した。従来のv0.22常設運用はv0.23へ移し、Group B以降の未実装Capabilityをv0.21のQuality GapまたはRelease Gateとして扱わない | [v0.21共通Gate](#11-v0210--設計構造化の共通gate)、[v0.22 Project運営](#12-v0220--project運営複数repository)、[v0.23常設運用](#13-v0230--常設cros運用耐久operation) |
| 2026-09-26 | v0.22の完成範囲を、Repository内のProject運営、同一Projectの複数Repository Federation、複数Projectの読み取り専用PortfolioおよびAI Runtime設定までとした。自律Operationの意味契約と参照実証はv0.23へ分離した | [v0.22 Scope探索](../01_Discovery/Analysis/EXP-000034/exploration.md)、[Project横断の再確認](../01_Discovery/Analysis/EXP-000035/exploration.md) |
| 2026-09-26 | 本格Trust Policy管理をv0.22から外した。信頼要素を混同しない原則と既存署名検証は維持し、将来は独立CapabilityとしてAdapter経由で利用側へ局所反映する | [利用者所有Trustの探索](../01_Discovery/Analysis/EXP-000028/exploration.md) |

計画変更時は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および変更トレースを示し、過去の判断を遡及上書きしない。活動中の課題、仮説、価値および採用境界は[個別探索分析](../01_Discovery/Analysis)と[統合Discovery](../01_Discovery/01_Product_Discovery.md)、未成熟な候補は[Product候補登録](../01_Discovery/02_Product_Candidates.md)が所有する。Roadmapは具体的なSchema、Path、契約または実装順序を定義しない。

## 4. 境界

[限定分散と統合結果の評価](../01_Discovery/Analysis/EXP-000008/exploration.md)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
