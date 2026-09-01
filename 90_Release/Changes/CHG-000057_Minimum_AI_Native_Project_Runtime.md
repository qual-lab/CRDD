# 変更トレース: Minimum AI-native Project Runtime

変更ID: `CHG-000057`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-09-01
- 対象: v0.18 Single Task Runtimeを実行単位として再利用する、単一Project／単一RepositoryのMilestone運営Runtime
- 対象リリース: `v0.19.0`
- 変更分類: `normative` / `breaking`候補
- `migration_required`: `true`候補。v0.18 Runtime利用者の既存Task入口は保持し、新しいProject Runtime利用時だけ追加契約を適用する
- リリースレベル: `MINOR`候補

正本: [Discovery](../../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)、[UX](../../02_UX/01_User_Experience.md#6-milestoneを委ねる利用体験)、[IA](../../03_IA/01_Information_Architecture.md#6-project-runtimeの情報階層)、[UI](../../04_UI/01_User_Interface.md#6-project-runtimeの状態表示)、[振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md#project-runtime-contract)、[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)、[検証設計](../../07_Quality/03_Verification_Design.md#project-runtime-verification)

## 1. Triggerと人間の判断

v0.18.0で、公式Codex／Claude Code CLIをCoordinatorが仲介し、一つのTaskをExecutor、独立Reviewer、限定是正、候補、取消およびRecoveryまで高信頼に実行するRuntimeが成立した。v0.18.1では新規採用入口とRuntime実行Identityを是正し、clone／submoduleから同じSingle Task Runtimeを利用できる基準を公開した。一方、人間はObjective分解、Task順序、次Taskの開始、Project全体の進捗理解および統合結果の判断を引き続き担っていた。

人間の決定権限者は、v0.19を「一つのTaskを実行するRuntime」から「一つのMilestoneを理解し、必要なObjectiveとTaskを計画・実行・再計画・統合できるMinimum AI-native Project Runtime」へ進める変更として採用した。最大5はTask総数ではなく同時実行数の上限であり、常に5並列する目標ではない。

## 2. 確認したCurrent State

- v0.18.1 Single Task Runtimeは正式署名4経路、失敗・取消・Recovery、隔離候補、cleanupおよび採用形態E2Eを持つ実行単位として再利用できる。
- CRDDはProjectの意味、Roadmap、CHG、Progress、Decision、QualityおよびEvidenceを既存正本へ保持しており、新しいProject Management正本を作る必要はない。
- 限定分散、MCP等の協働接続面、照合費用および統合結果の評価はDiscoveryで候補として保持されていたが、v0.19への収載・実装許可は未成立だった。
- Coordinatorは一つのTask lifecycleを所有するが、Project／Milestone／Objective階層、Task Graph、Project State、部分再計画およびMilestone Integrationをまだ所有しない。

## 3. Change Intent

一つの明示Binding済みRepositoryを持つProjectについて、人間がMilestoneと受入条件を示した後、Parent CoordinatorがProject Contextを理解し、Objectiveと任意数のTaskへ計画し、Dependencyと競合に応じて最大5 Taskを並行実行し、進捗、再計画、人間判断および統合受入を管理できるようにする。

MCPはProject Runtimeへの薄い外部接続面として追加し、CLIと同じCoordinator Coreへ接続する。MCP固有のProject Model、AuthorityまたはRepository直接操作を作らない。

## 4. 保持する意図と変更禁止範囲

- v0.18 Single Task RuntimeのTrust、Authority、隔離候補、独立Review、取消、cleanupおよびRecoveryを弱めない。
- 個別Task Pass、Agent数、並列数またはProgress率をObjective／Milestone Acceptanceへ読み替えない。
- 子Task、Provider出力、MCP ClientまたはRepository内容からAuthority、Scope拡張、Risk受容またはMilestone Acceptanceを生成しない。
- Roadmap、CHGまたは新しいPM DatabaseをProject Runtimeの第二正本にしない。
- 人間が承認したMilestone Scope内の内部Task切替だけを理由に反復承認を要求しない。
- 対話作業とスケジュール実行を同じ正本Worktreeへ同時に書き込ませず、対話起点を優先しながら未開始要求を失わない。
- v0.19で複数Project、複数Repository、常設自律運転、Organization Runtimeまたは無制限Worker Poolへ拡張しない。

## 5. Objectiveと依存順

| Objective | 成立条件 | 主な依存 |
|---|---|---|
| Project Runtime Design | Discovery、UX、IA、UI、SPEC、Architecture、Verificationが同じ階層・状態・受入を定義 | なし |
| Coordinator Refactoring | Project責務とSingle Task責務を分離し、既存Task契約を保持 | Design |
| MCP Thin Vertical Slice | MCP Objective IntakeからSingle Task Resultまで同じ意味契約で往復 | Design、Refactoringの必要最小部 |
| Project Model | Project／Milestone／Objective／TaskとProject Stateを表現 | Design |
| Task Graph／Scheduler | Dependency、競合、最大5並列、枠解放後の開始を制御 | Project Model、Single Task Unit |
| Progress Projection | 実状態からProgress、Quality、Blocker、Risk、Decision、Critical Pathを投影 | Project Model、Scheduler |
| Replanning／Escalation | Plan維持、部分再計画、人間判断を区別 | Project Model、Progress |
| Integration Verification | Cross-task整合とObjective／Milestone Acceptanceを確認 | 全実行Objective |
| Dogfooding／Utility | CRDD v0.19自身を管理し、Accepted Resultまでの総費用と品質を評価 | E2E成立 |
| Closure | 全検証、独立レビュー、必要監査、移行、Release候補を固定 | 全Objective |

Objectiveは同じMeaningful Changeの段階であり、工程Step、個別実装または監査Findingごとに新しいCHGを発行しない。独立して採否・移行・切戻し・リリースできる別意図が成立した場合だけ分離を再評価する。

## 6. 検証義務

正常、準正常、異常および判定不能を、Project入力から統合受入まで一続きで確認する。少なくともMCPの薄い縦断経路、任意Task数、最大5並列、5未満の選択、Dependency待ち、共有競合拒否、局所失敗、部分再計画、人間判断、Integration不成立、取消、Parent喪失、cleanup不明およびRecoveryを含める。

設計の状態・資源・Lock・Authority・Effectを実装所有者と試験へ接続し、個別試験数やcoverage率からProject lifecycleの成立を推定しない。CRDD v0.19自己適用では、Time to Accepted Result、Human Active Time、AI Processing Time、Queue Waiting、Integration Cost、Conflict、Retry、Remediation、Replanning、Human Escalation、Provider利用および後工程Findingを観測する。

## 7. Git／Release運用

本変更は`main`から作成した一つのfeatureブランチで、正本、実装、試験、移行、CHG、配布内容および必要なRelease manifestまで完成させる。署名対象が変わる場合のSource A、manifest carrier Bおよび最終Release Commit Cは[Coordinator Runtimeの作業手順](../../19_Workflows/01_Coordinator_Runtime.md#release-manifestの生成)に従い、同じfeatureブランチ内で固定・検証して一つのプルリクエストで`main`へ統合する。`develop`またはrelease専用ブランチを追加せず、統合後の`main`へmanifest更新だけの別プルリクエストを追加しない。

## 8. 現在状態と次のGate

工程正本を接続した後、Project Modelの最初の実装として、Task、Objective、Milestoneを別状態で保持する純粋な状態契約を追加した。Task完了後はObjectiveを`integration_pending`へ進めるだけとし、受入条件ごとのEvidenceを伴うObjective統合、全Objective受入後のMilestone統合を、それぞれ別の世代更新として固定した。Project State投影もWork Progress、Quality、Human Decision、RecoveryおよびNext Actionを分離し、Task完了や未観測値からProject成功を生成しない。

[Project状態契約試験](../../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)は、最大5件選択、Dependency、Path／Conflict、cleanup不明、Recovery、古い世代、Graph不正に加え、Task完了後の統合待ち、Objective／Milestoneの段階受入、Evidence不足、Recovery時の成功補正禁止を確認する。[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)は、薄い単一Task経路とAdapter固有Authority 0を維持する。

これはProject Runtime全体の完成、MCPの外部公開、v0.19.0 ReleaseまたはRisk受容を意味しない。Project State Store、Project Operation lease、対話優先の耐久Operation Queue、正本採用Lease、Single Task Runtimeとの複数Task結合、部分再計画、Parent喪失、実成果物のIntegrationおよび公開入口E2Eは未接続である。

次のGateは、先行するCommunication固定、Checker、独立レビュー、指摘是正および再確認の完了後、この状態契約を機械可読な設計対応へ接続したうえで、Project State Store、耐久Operation Queue、Project Operation leaseおよび正本採用Leaseを実装し、Lockを保持せずSingle Task Runtimeを呼ぶ結合経路を固定することである。先行期間中も現在の設計・実装・試験増分は本CHGへ保持し、未完成能力をRelease済みまたは破棄済みへ変更しない。独立レビューは、この固定候補が設計、実装および試験を一続きに再構成できる段階で行う。
