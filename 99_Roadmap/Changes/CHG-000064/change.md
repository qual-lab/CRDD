# 変更トレース: Project状態参照とローカルMCP HTTP

変更ID: `CHG-000064`
状態: `Released`
担当責任者: Qual-Lab
対象版: `v0.20.0`
リリース: `v0.20.0`（2026-09-11）
変更分類: `feature`
最終更新日: 2026-09-06

## 1. 結論と現在状態

Project Runtimeが所有する現在状態を、正本変更や実行権限を伴わない読み取り専用結果として取得し、MCP stdioと同じ公開アプリケーション契約をlocalhost限定のMCP Streamable HTTPへ搬送する。

状態参照はProject RuntimeのState Portから`readState`だけを受け取り、Task、判断、Authority、成功、進捗率または正本変更を生成しない。状態の不存在と観測不能、要求したRepository改訂版と保存状態の不一致を区別する。MCPは同じcanonical結果を閉じたtool結果へ投影し、独自のProject状態を所有しない。

HTTPはMCP 2026-07-28のstatelessなPOST単位Transportとして実装する。IPv4 localhostだけへbindし、Bearer認証、Origin確認、Protocol／Method／Nameのmirror header照合、UTF-8と容量上限、切断時の取消伝播および終了時の進行要求joinを要求する。旧版のGET stream、Transport Session IDまたはLAN／Internet公開互換を追加しない。

固定改訂版`ce7c4d3073099926b3302eb9aa8e2c03d18aa699`で、公開Runtimeが作成した受入済みProject Stateを状態参照ApplicationからMCP Adapterへ渡し、`observed`、受入済みMilestoneおよび`no_effect`を同じ閉じた結果として確認した。別の総合試験では`template/tools/crdd-mcp.ts`のstdio／localhost HTTP公開Process、認証済み状態参照、拒否、切断取消および終了joinを確認した。Node.js Signal event受領後のlistener保持、重複eventおよび実行中Applicationのjoinは、同じ本番Serverと注入可能なSignal sourceを使う構成試験で確認した。OS／Consoleから公開ProcessへのSignal配送は未評価であり、実Process Transportの確認へ含めない。公開RuntimeからTransportまでの全層を単一試験Fixtureへ偽装統合せず、実状態の意味縦断、実Process TransportおよびSignal受領後の構成試験を相補的な根拠として扱う。

## 2. 人間が決定した範囲

- v0.20でProject Stateの読み取り専用投影とlocalhost MCP Streamable HTTPを実装する。
- Project Runtimeが公開契約を所有し、MCPはTransportとMCP Envelopeだけを所有する。
- stdioとHTTPは同じObjective、Decision、Project State操作へ到達する。
- HTTPはlocalhostに限定し、Linux／Remote Runtime、複数Repositoryおよび外部公開を本変更へ含めない。
- 性能試験、長時間試験および実Provider試験は、人間の明示指示なしに実行しない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`00_Overview.md`](<../../../00_Overview.md>)
- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_Autonomous_Operation.md`](<../../../05_Autonomous_Operation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/Details/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/Details/mcp/01_Architecture.md`](<../../../06_Architecture/Details/mcp/01_Architecture.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- [`06_Architecture/Details/project-runtime/01_Architecture.md`](<../../../06_Architecture/Details/project-runtime/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/04_Test_Catalog.json`](<../../../07_Quality/04_Test_Catalog.json>)
- `07_Quality/07_Structured_Document_Disposition_Inventory.json`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md`（削除または旧Path）
- [`10_Agent.md`](<../../../10_Agent.md>)
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`13_Release.md`](<../../../13_Release.md>)
- [`14_Workflow.md`](<../../../14_Workflow.md>)
- [`15_Progress.md`](<../../../15_Progress.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`17_Communication.md`](<../../../17_Communication.md>)
- [`18_Context_Dependency.md`](<../../../18_Context_Dependency.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/04_MCP_Server.md`](<../../../19_Workflows/04_MCP_Server.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- `40_Develop/checker/scripts/update-document-disposition-inventory.ts`（削除または旧Path）
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts>)
- [`40_Develop/coordinator/src/index.ts`](<../../../40_Develop/coordinator/src/index.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts>)
- [`40_Develop/coordinator/tests/integration/cli-options.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts>)
- [`40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts`](<../../../40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts>)
- [`40_Develop/execution-intelligence/src/core/execution-intelligence.ts`](<../../../40_Develop/execution-intelligence/src/core/execution-intelligence.ts>)
- [`40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts`](<../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts>)
- [`40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts`](<../../../40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts>)
- [`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`](<../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts>)
- [`40_Develop/mcp/src/index.ts`](<../../../40_Develop/mcp/src/index.ts>)
- [`40_Develop/mcp/src/transports/process-signal-shutdown.ts`](<../../../40_Develop/mcp/src/transports/process-signal-shutdown.ts>)
- [`40_Develop/mcp/src/transports/stdio-transport.ts`](<../../../40_Develop/mcp/src/transports/stdio-transport.ts>)
- [`40_Develop/mcp/src/transports/streamable-http-transport.ts`](<../../../40_Develop/mcp/src/transports/streamable-http-transport.ts>)
- [`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`](<../../../40_Develop/mcp/tests/system/stdio-transport.integration.test.ts>)
- [`40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts`](<../../../40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts>)
- [`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`](<../../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts>)
- [`40_Develop/project-runtime/src/application/project-runtime-state-query.ts`](<../../../40_Develop/project-runtime/src/application/project-runtime-state-query.ts>)
- [`40_Develop/project-runtime/src/index.ts`](<../../../40_Develop/project-runtime/src/index.ts>)
- [`40_Develop/project-runtime/src/public-contract/project-state-query.ts`](<../../../40_Develop/project-runtime/src/public-contract/project-state-query.ts>)
- [`40_Develop/project-runtime/tests/unit/project-state-query.contract.test.ts`](<../../../40_Develop/project-runtime/tests/unit/project-state-query.contract.test.ts>)
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/CHG-000062_Execution_Intelligence.md`（削除または旧Path）
- `90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md`（削除または旧Path）
- `90_Release/Changes/CHG-000065_Structured_First_Documentation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000069_V0201_Release_State_Propagation.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000064/change.md`](<../../../99_Roadmap/Changes/CHG-000064/change.md>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`README.md`](<../../../README.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`template/tools/crdd-coordinator.ts`](<../../../template/tools/crdd-coordinator.ts>)
- [`template/tools/crdd-mcp.ts`](<../../../template/tools/crdd-mcp.ts>)

</details>

## 3. 目指さないこと

- WBS、Topic、Risk、Forecast、手入力進捗率またはProject Management正本を作ること。
- Project State、HTTP connection、MCP metadataまたはBearer tokenからProject Authorityを生成すること。
- v0.19以前のMCP SessionやGET streamを互換実装すること。
- 状態不存在、観測不能、Recovery要求またはRepository改訂版不一致を成功へ補正すること。
- Tokenをログ、MCP結果、実行知またはRepository管理ファイルへ保存すること。

## 4. 設計と実装境界

- [Project Runtimeアーキテクチャ](../../../06_Architecture/Details/project-runtime/01_Architecture.md): 状態参照要求、canonical投影、read-only ApplicationおよびState Port境界。
- [MCP Transportアーキテクチャ](../../../06_Architecture/Details/mcp/01_Architecture.md): 3つのtool、stdio／HTTP共通Adapter、localhost、認証、header相関、取消および資源回収。
- [状態参照公開契約](../../../40_Develop/project-runtime/src/public-contract/project-state-query.ts): 閉じた要求・結果と投影のtrust-boundary検証。
- [状態参照Application](../../../40_Develop/project-runtime/src/application/project-runtime-state-query.ts): `readState`だけを受け取る非Effect処理。
- [MCP Adapter](../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts): 同じcanonical操作のMCP投影。
- [Streamable HTTP Transport](../../../40_Develop/mcp/src/transports/streamable-http-transport.ts): 2026-07-28 HTTP binding。
- [MCP公開Launcher](../../../template/tools/crdd-mcp.ts): MCP Transportと公開Adapterを結合する利用者向け構成Root。
- [Coordinator公開Adapter](../../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts): Repository Root、改訂版、選択利用者およびPersistence Adapterを、内部Pathを公開せずMCP構成Rootへ提供する。

## 5. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 認証済み主体が現行Repository改訂版のProjectを取得 | canonicalな現在投影を返し、Effectを発行しない |
| 準正常 | Project Stateが存在しない | `absent`を正常な観測として返し、未開始や成功を推定しない |
| 準正常 | 状態Storeを観測できない | `unknown`と既存Recovery要否を返し、空状態へ畳まない |
| 異常 | 保存状態と要求Repository改訂版が異なる | 現在値として公開せずEffect 0で停止する |
| 異常 | HTTP認証、Originまたはmirror headerが不正 | Applicationを呼ばずHTTP／JSON-RPC errorを返す |
| 異常 | payload過大、不正UTF-8、重複JSON keyまたは未知field | 意味処理前に拒否する |
| 異常 | response完了前にClientが切断 | 対象要求へ取消を伝播し、成功やcleanup完了を捏造しない |
| 異常 | Server終了時に要求が進行中、またはNode.jsが終了中にSignal eventを重複受領 | 最初のeventで取消を要求し、Signal listenerを保持したまま全要求をjoinする。終了結果がsettleした後にだけlistenerを解除し、失敗を資源回収完了へ変えない。OS／Consoleからの配送成立は推定しない |

## 6. 検証と完成条件

- Project Runtime単体試験で、正常、不存在、観測不能、改訂版不一致、未知fieldおよび投影相関を確認する。
- MCP Adapter試験で3 toolの閉Schema、認証先行、canonical結果保持および不正結果拒否を確認する。
- HTTP結合試験でlocalhost bind、Bearer、Origin、必須header、容量・UTF-8、切断取消、Server終了時join、実行中Applicationと重複Signal eventを含む公開Launcherのlistener所有、およびstdioとの意味一致を確認する。OS／Consoleから実ProcessへのSignal配送は本変更で未評価とし、構成試験を配送成立の証拠にしない。
- Coordinator公開Adapterの結合試験とMCP公開Launcherの総合試験で、現行Repositoryと選択利用者へ結合した状態参照を確認する。
- Project RuntimeからMCP／Coordinatorへの逆依存0、MCPからCoordinator内部Pathへの依存0を維持する。
- 独立レビュー、全体Checkerおよび対象回帰が成功するまで完成と表示しない。

正式候補ではRuntime Execution Identityの変更として署名と影響する正式E2Eを行う。開発中の確認から実Provider、署名、性能試験または長時間試験を自動発火しない。
