# 配置／実行モデル

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-07

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
| CROSを同一Processへ組み込む | WorkbenchまたはMCP | 認可済みの共通CROS能力を直接呼ぶ。内部RESTやMCP Loopbackを追加しない。 | Transportを省略してもRole／Exposure／失効確認を維持する。 |
| CROSを別Processで利用する | Workbench ServerからMCP、または外部MCP Client | 同一Hostでも別ProcessならMCPで接続する。 | Remote接続、情報最小化、認可、切断・取消と終了後状態を確認する。 |
| Linux等の共有Host | Workbench Server、MCP Server | CROS能力とRepository群を配置する。TLS終端等はDeployment Concernである。 | Linux実配置、証明書運用、特定Proxyは既存loopback／模擬Header試験では確認済みとしない。 |

Shared Server、CROS REST、Gatewayを独立Runtimeとして残さない。既存の認可・Origin・TLS境界・操作・終了保証をMCPと内部能力へ移管した後に撤去する。共有HostへのRepository自動Deploy／Clone／Backup機能は追加しない。WorkbenchのBrowser向けRESTはこの撤去に含めない。

Coordinatorは単体の実行Runtimeとして利用でき、Orchestratorはその公開APIを呼ぶ。Provider差はAI Adapter、実Docker資源はCoordinator、OS固有保証はPlatform Accessが所有する。Docker CLIを使うことだけで全処理をNativeへ移管せず、署名するCoordinator実行閉包と、各Toolの実行・試験環境を区別する。

## 3. 実行単位とResource

| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |
|---|---|---|---|
| Transport Session | connection、request stream | Session／Request | response完了、connection cleanup |
| Project Task | Task state、decision wait、cancel token | Project／Task／Generation | resultまたはRecovery義務の確定 |
| Execution Attempt | child process／provider request／container | Attempt、Provider、外部Resource | process／request終了と結果搬送 |
| Projection Query | Source snapshot、coverage | Query／snapshot | 同じ観測時点の結果返却 |
| Acceptance Decision Operation | 対象Identity、根拠Revision、明示判断 | Objective／Milestone／判断者 | 受入・差戻し・判断待ちの限定記録またはEffect 0 |
| Federation Session | Credential、Session Grant、Workspace set | Session／Workspace | Grant失効、接続終了 |
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
| Artifact Signing | 秘密入力、署名、Manifest、配布Root | [成果物署名](Details/artifact-signing/01_Architecture.md) |
| Checker | Generic Core、現行Profile、終了・回帰 | [Checker](Details/checker/01_Architecture.md) |
| CROS／Project Operation | Federation、Projection、候補Lifecycle | [CROS](Details/cros/01_Architecture.md)、[Project Operation](./Details/domain-model/02_Activity_Context.md) |
| Source／Tests | Canonical責務との対応、未実装、旧Owner残存 | `40_Develop/**`、`template/tools/**`、`07_Quality/**` |

## 6. Qualityへの引渡し

- 実行単位ごとにResource Owner、並行性、timeout、取消、cleanup、Recoveryを確認する。
- L1の実境界確認とL2のLifecycle結合を、最終E2E前のIntegration Testへ含める。
- Acceptance DecisionはProjection Queryと別実行単位として、明示Authority、限定書込み、非推定、Task／Provider Effect 0をL0からL3まで段階確認する。
- 同じProcessやstreamを複数役割で使う場合、役割ごとの所有者と終了条件を反証する。
- OS／Runtime／外部CLIのVersion差は、危険な意味変化を検出して停止する。無関係なHash差やVersion差だけで恒久拒否しない。
- Physical deploymentが未確定な箇所は未確認として保持し、CanonicalなProcess数や配置を捏造しない。

## Checklist

- [x] 論理Component、PackageとProcess配置を区別した。
- [x] 二つの公開Serverと運用CLIを区別し、Shared Serverを配置形態として扱った。
- [x] 同一Processと別ProcessのCROS接続・認可境界を明示した。
- [x] Linux・TLS実運用の未評価を既存Local試験で代替していない。
- [ ] OPEN: 詳細配置・設定・配布入口の対応は段階3、設計レビューは段階4、移管後の実境界確認は段階6／7に残る。
