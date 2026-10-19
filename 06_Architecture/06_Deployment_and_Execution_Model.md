# 配置／実行モデル

[Workspaceの配置契約](Details/orchestrator/03_Workspace.md#4-配置とroot解決)によりTool Runtimeと製品Repositoryを分離する。単体起動は共有資格初期化を必須にせず、共有配置では各操作を現在認可する。WorkbenchとMCPは独立Processで同じPackage APIを使い、共通Memory QueueやMCP常時起動を仮定しない。製品固有状態は対象Repositoryへ保持。linked worktreeからも所属Repositoryを検証し、Tool Runtimeやnested worktree配下へ暗黙保存しない。Multi-host共有排他は対象外。

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-11

旧固定版の履歴: 固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

現在の提示先は通常Workbenchと初回／Host交換端末に固定し、Package改名や初回接続確認のために保存Root・Process・Serverを追加しない。初回確認用接続の配置・Protocol・通常認証への移行は詳細設計OPEN。今回配置差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。

## 1. この成果物が所有すること

Canonical責務を実行時に分離する論理単位、Resource、並行性および終了条件を示す。特定OS、既存Folder、Process数またはFrameworkは、UI／SPECから確定しない限り固定しない。

## 2. 論理配置図

```text
┌─ Client Surface ─────────────────────────────────────────────┐
│ Human / Chat Agent / Coding Agent / Workbench候補            │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌─ Transport Boundary ─────────────────────────────────────────┐
│ MCP / CLI Adapter                                            │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌─ Application Runtime ─────────────────────────────────────────┐
│ Public Application Contract                                  │
│ Orchestrator / Projection / Acceptance Decision / Federation│
└──────────────┬──────────────────────┬─────────────────────────┘
               ▼                      ▼
┌─ Execution Boundary ────────┐  ┌─ Data Boundary ──────────────┐
│ Execution Port              │  │ Repository-local Runtime Data│
│ Provider／Process Adapter   │  │ OS-managed Runtime Data      │
└──────────────┬──────────────┘  └──────────────┬───────────────┘
               ▼                                ▼
┌─ External / Platform Boundary ────────────────────────────────┐
│ AI Provider / OS / Process / Container / Filesystem / Network│
└───────────────────────────────────────────────────────────────┘
```

各箱は別Processを意味しない。別Process化の要否は、Trust境界、Failure Isolation、並行性、Resource Owner、資格情報、配置先または独立更新の必要性から決める。図のWorkbench候補は採用済みWorkbench Serverへ、Orchestratorの実装OwnerはOrchestratorへ具体化する。公開SurfaceはWorkbench ServerとMCP Serverの二系統であり、CLIは運用入口として維持するが第三のServer Runtimeを新設しない。

### Localと共有配置

| 配置形態 | 公開入口 | 内部接続 | 検証・未評価の境界 |
|---|---|---|---|
| Repository単体Local | Workbench、Repository単体MCP／CLI | 検証済みRootの能力を利用する。CROS設定は不要である。 | Rootと書込み範囲、取消・終了を確認する。 |
| CROSを同一Processへ組み込む | WorkbenchまたはMCP | Access Managementで認可し、Domain Modelへ許可済み集合を渡す。内部RESTやMCP Loopbackを追加しない。 | Transportを省略しても現行Role詳細権限／Exposure／失効／実アクセス確認を維持する。 |
| CROSを別Processで利用する | Workbench ServerからMCP、または外部MCP Client | 同一Hostでも別ProcessならMCPで接続する。 | Remote接続、情報最小化、認可、切断・取消と終了後状態を確認する。 |
| Linux等の共有Host | Workbench Server、MCP Server | CROS能力とRepository群を配置する。TLS終端等はDeployment Concernである。 | Linux実配置、証明書運用、特定Proxyは既存loopback／模擬Header試験では確認済みとしない。 |

上表のCROS一般利用経路へ鍵操作を混ぜない。通常鍵発行・独立失効・交換は同一Process Workbenchの現行administrator専用固定で、MCPの一覧・Schema・登録・dispatchは全鍵操作を公開しない。Hostのログイン済みローカル操作者を信頼する通常回復の対話CLIは交換2操作だけとし、追加認証・専用資格・承認コード・OS管理者昇格なしで既存Root／Path検証を維持する。新しいServerやHost認可機構を作らない。

Shared Server、CROS REST、Gatewayを独立Runtimeとして残さない。既存の認可・Origin・TLS境界・操作・終了保証をMCPと内部能力へ移管した後に撤去する。共有HostへのRepository自動Deploy／Clone／Backup機能は追加しない。WorkbenchのBrowser向けRESTはこの撤去に含めない。

単体／CROSは起動時に明示選択し、設定済みであることだけで自動切替しない。単体は起動Repository一つ・資格不要、CROSは現在認可された集合を扱う。初回Host設定はローカルHostの明示操作だけで開始し、通常鍵交換と混ぜない。`--cros`や設定Fileの存在を開始許可・Host Authority・自動初期化の根拠にしない。Access Managementは認証・認可の論理Ownerであり、独立Process／Serverの追加を意味しない。保存Root・秘密保護は既存契約を維持する。

Coordinatorは単体の実行Runtimeとして利用でき、Orchestratorはその公開APIを呼ぶ。Provider差はAI Adapter、実Docker資源はCoordinator、OS固有保証はPlatform Accessが所有する。Docker CLIを使うことだけで全処理をNativeへ移管せず、署名するCoordinator実行閉包と、各Toolの実行・試験環境を区別する。

### 初回Host設定の配置制約

| 利用形態 | 初回設定の扱い |
|---|---|
| 単体Repository | 資格不要を維持。起動だけでCROS管理Rootや初期ユーザーを作らない |
| ローカルHostの明示初期化 | 既存OSユーザー管理Root／Pathを検証し、双方未初期化確認からAccess Managementへ接続する候補 |
| 同一／別Process Workbench | Host操作の案内だけ。初期化・初期SecretのWorkbench搬送をBackendで実行しない |
| MCP・Remote Client・自動起動 | 初期化・状態照会は非公開。未初期化を別Root・単体fallbackで回避しない |

論理OwnerやPackage改名を理由に秘密値をRepositoryへ移動しない。具体保存Schema・Root準備・atomic publication・公開入口・Source接続は未完了で、配置候補から本番成立を推定しない。

## 3. 実行単位とResource

| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |
|---|---|---|---|
| Transport Session | connection、request stream | Session／Request | response完了、connection cleanup |
| Project Task | Task state、decision wait、cancel token | Project／Task／Generation | resultまたはRecovery義務の確定 |
| Execution Attempt | child process／provider request／container | Attempt、Provider、外部Resource | process／request終了と結果搬送 |
| Projection Query | Source snapshot、coverage | Query／snapshot | 同じ観測時点の結果返却 |
| Acceptance Decision Operation | 対象Identity、根拠Revision、明示判断 | Objective／Milestone／判断者 | 受入・差戻し・判断待ちの限定記録またはEffect 0 |
| 接続認可Query | Credential→userId、現行Role詳細権限、Workspace／Exposure、取得可能性 | 要求／認証Context | 現在認可済み集合または非開示拒否を返す。接続の終了はTransport Ownerが確認する |
| 認可済みFederation Query | 許可済みRepository集合、Source snapshot、Coverage | Query／対象集合 | Domain Modelが根拠と不完全性を返す。管理権限から内容閲覧を生成しない |
| 通常管理Operation | 操作別の予定Role／既存対象／前後Role／Role内容／接続登録／Exposure | 操作／対象／変更前の現行Roleに対する9 Role分担行 | 対象更新・結果確定・提示結果（本人受領は観測外）を分離。不明を成功化せず、次要求で内容認可を再評価。登録≠公開。解除は同じ受理操作・採用改訂の登録と対応Exposureを両読戻しし、対象外・本体を保持。開始済み取消非証明。新Process／保存方式／公開APIは未確定 |
| 初回Host設定Operation（Access Management） | 検証済み管理Root、元試行、作成userId、確認対象資格と元発行、Host提示・限定接続・確認保存の事実 | Root／exact初回試行／user／直近に提示した有効資格。Host明示開始と双方未初期化確認後だけ新試行 | 相関読戻し後にUUID・資格を作る。Host一度提示→同鍵限定接続成功→確認保存・読戻し・短命材料清掃／Lock終了後だけcompleted・通常Authority。未確認・失敗・観測不能なら双方0。Host交換後Binding・具体Protocol・Schema・SourceはOPEN |
| 新規資格発行Operation | 既存対象userId、発行・記録・提示結果 | 操作／対象userId／同一Process Workbenchの現行administrator | 操作administrator画面へ一度提示し、本人受領は観測しない。旧失効0・交換Recoveryなし。提示失敗だけで確定発行を不明化しない |
| 独立失効Operation | exact対象資格IdentityとuserIdへの結合、失効結果 | 操作／資格Identity／同一Process Workbenchの現行administrator | 確定した失効資格の後続要求を拒否、不明は既知状態と確認先を返す。範囲拡大・新発行・Secret・交換再入場0、Task取消非証明 |
| 鍵交換Operation | 対象userId、既存発行先、失効範囲、非秘密Recovery状態 | 2操作／Workbench固定administratorまたは信頼したHostログイン操作者／旧失効前に結合した同じexact Recovery ID | 失効・発行・結果記録・提示結果（本人受領は観測外）を分離。発行／記録不明は元発行Identity・元exact Recoveryで再観測。発行・記録確定後の提示・引渡し（初回は同鍵接続確認）未確認は現在administratorの明示選択だけで別交換へ。各交換内のexactを保持し、確定発行を不明へ戻さない |
| External Information Request | consent scope、payload、returned candidate | Request Identity | 候補隔離または採否への引渡し |
| Runtime Data Operation | lease、lock、temporary artifact | Owner／Repository Root | publish、cleanupまたはRecovery記録 |
| Verification Run | fixed revision、test resource、evidence | Run／test class | 全対象終了、未実施範囲の記録 |

## 4. 段階的な結合単位

```text
Port／Adapterと一つの実境界
        ↓
Coreと隣接Port
        ↓
状態・Identity・Authorityが続く一つ先のComponent
        ↓
公開Application Contractまで
        ↓
複数Capabilityを通すSystem Test／E2E
```

| 段階 | 主な目的 | 対象境界 |
|---|---|---|
| L0 Component | 判定・変換・不変条件 | 状態遷移、構成検証、相関判定 |
| L1 実境界 | 外部APIの実際の意味 | Process起動・終了、Docker lifecycle、Git Root検証 |
| L2 隣接結合 | 値と終了条件の受渡し | Runtime→Execution Port→Process Adapter |
| L3 Application | 公開操作の接続 | Transport→Application→Result／Recovery |
| L4 System | Capability間の共同成立 | 署名済み経路、Federation＋Projection |

一段または二段で原因を局所化できるようにし、L1／L2不足を最終E2Eで初めて発見しない。L4をすべての変更で機械的に実行せず、変更した意味と残る不確実性から選ぶ。

## 5. Reality Auditへの引渡し

Canonical Architectureが独立レビューで閉じた後に、次を照合する。照合で見つかった差はCanonical設計を実装都合で上書きせず、実装不足、成立済み能力、上流不足または設計変更候補へ分類する。

| 照合対象 | 確認すること | 参照先 |
|---|---|---|
| Coordinator | Execution Port実装、Provider編成、取消・回復 | [Coordinator](Details/coordinator/01_Architecture.md) |
| Orchestrator | Application Contract、Task状態、Recovery | [Orchestrator](Details/orchestrator/01_Architecture.md) |
| MCP／CLI | Transport parity、接続Lifecycle | [MCP](./Details/mcp-server/01_Architecture.md) |
| Execution Intelligence | 実行事実の生成・保存と読取りPort | [実行知](Details/execution-intelligence/01_Architecture.md) |
| Platform Access | OS／Process／Containerの意味、診断、回復 | [Platform Access](Details/platform-access/01_Architecture.md) |
| Version Control | Root検証、Binding、差替え可能なPort | [Version Control](Details/version-control/01_Architecture.md) |
| 旧Artifact Signing（廃止） | 専用Package・署名機能は廃止。通常Runtimeの配置要素ではない | [成果物署名](Details/artifact-signing/01_Architecture.md) |
| Checker | Generic Core、現行Profile、終了・回帰 | [Checker](Details/checker/01_Architecture.md) |
| CROSの認可／Context操作 | 現在認可、Federation、Projection、候補Lifecycle | [Access Management](Details/access-management/01_Architecture.md)、[Domain Model](Details/domain-model/01_Architecture.md)、[Context操作](Details/domain-model/02_Activity_Context.md) |
| Source／Tests | Canonical責務との対応、未実装、旧Owner残存 | `40_Develop/**`、`template/tools/**`、`07_Quality/**` |

発行／記録不明の通常発行はCredential IDとは別の元発行Identityで再観測し、交換Recoveryを追加しない。発行・記録確定後は「発行済み・受け渡し未確認」とし、別交換は別Operation／Recoveryで既存入口を再利用する。現在administratorとして接続不能なら既存Host交換2操作だけへ案内し、新Process・新Recoveryを作らない。指定交換は先発行鍵を含む対象User全旧有効資格、全員交換は先発行鍵を含む全旧有効資格を扱い、既存発行先・表示確認条件を維持する。旧事実を保持し、遅延旧応答の失効鍵利用表示、秘密再表示・保存・自動発行を禁止する。

## 6. Qualityへの引渡し

- 元処理と明示した別交換のOperation／Recoveryを区別し、現在認可・対象集合・先発行鍵の失効・遅延旧応答を入口ごとに確認する。

- 実行単位ごとにResource Owner、並行性、timeout、取消、cleanup、Recoveryを確認する。
- L1の実境界確認とL2のLifecycle結合を、最終E2E前のIntegration Testへ含める。
- Acceptance DecisionはProjection Queryと別実行単位として、明示Authority、限定書込み、非推定、Task／Provider Effect 0をL0からL3まで段階確認する。
- 同じProcessやstreamを複数役割で使う場合、役割ごとの所有者と終了条件を反証する。
- OS／Runtime／外部CLIのVersion差は、危険な意味変化を検出して停止する。無関係なHash差やVersion差だけで恒久拒否しない。
- Physical deploymentが未確定な箇所は未確認として保持し、CanonicalなProcess数や配置を捏造しない。
- 鍵交換2操作×2入口の4組表示・3組だけ明示確認、固定administratorのWorkbenchと追加認証なしのHost交換2操作だけを確認する。MCPの鍵操作一覧・Schema・登録・dispatchは不存在を確認し、一般Remote経路から迂回させない。
- 新規発行・独立失効・交換の対象と結果、旧失効前exact Recovery、段階別の記録・提示結果（本人受領は観測外）を確認する。Host配置から通常管理の固定分担や内容権限を追加生成せず、9 Role分担行に対応する11認可要求種別の許可／拒否／不明と変更前認可・次要求反映を確認する。
- Workbench／Host CLIの入口割当は採用済み。具体Layout・入力・一度表示と提示方式・初回限定接続確認方式だけを未確定としてDetailsへ渡し、実装・配置の成立を主張しない。

## Checklist

- [x] 論理Component、PackageとProcess配置を区別した。
- [x] 二つの公開Serverと運用CLIを区別し、Shared Serverを配置形態として扱った。
- [x] 同一Processと別ProcessのCROS接続・認可境界を明示した。
- [x] Linux・TLS実運用の未評価を既存Local試験で代替していない。
- [ ] OPEN: 詳細配置・設定・配布入口の対応は段階3、設計レビューは段階4、移管後の実境界確認は段階6／7に残る。
