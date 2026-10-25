# Orchestrator／Coordinator統合とDomain Model最終整理

成果物種別: 変更計画・着手前対応表
状態: A・B1〜B5とC前の整理は限定完了。基準664820ba1からCの物理移管候補（150 Source・公開120実行値）を実装し、静的検査は成功。最終portable回帰は1,838成功・失敗0・5 skip、限定独立レビュー残指摘0。現在の結果は§32を正本とし、過去の単位別結果と区別する。C全体・保存統合・D・実境界・全体QAは未完了。既存の計測OPEN・横断検査・Workbench lintを維持
対象変更: [CHG-000082](change.md)
責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-22
統合計画の初期基準（A着手前）: `1afbc6df4a76cd6800e20a5fa98a0c994577a42f`
B調査のSource基準（A完了）: `f8f7a9986d47220a160fc141af09c6c51561e1e7`
設計正本: [Orchestrator](../../../06_Architecture/Details/coordinator/03_Task_Architecture.md)、[Coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md)、[Domain Model](../../../06_Architecture/Details/domain-model/01_Architecture.md)

## 1. 今回の判断と境界

人間から提示された統合計画を、第二段階の残る実行順序として採用する。従来の二Packageを維持する目標を変更し、専門Packageへ技術責務を戻した後、旧Orchestratorを新Coordinatorへ再編する。この採用時点では現行Sourceの所有関係を切替完了まで変更済みと扱わなかった。現在の物理移管候補と検証中の範囲は§32に従う。

添付の調査基準`3e5bd91`から実作業基準までは3Commit進んでいる。Platform Access移管、Docker IsolationとRepository別通信条件、SDK境界と明示的Semantic対象指定を含む現在版を基準とする。過去Evidenceは当時の根拠として保持し、新構造の成立根拠へ流用しない。

| 順序 | 実施内容 | 終了条件 |
|---|---|---|
| A | 現OrchestratorのSource整理 | 公開API・永続契約・実行順序を維持し、責務配置・利用側・試験・設計を同期 |
| B | 旧Coordinatorから専門Packageへ移管 | 能力ごとに新Owner、本番Consumer、正常・失敗・取消・回復の接続を確認 |
| C | 残る実行調整と外部送信を統合、旧Coordinator撤去、OrchestratorをCoordinatorへ改名 | 旧Package依存0、全公開入口と永続再入場を確認 |
| D | Domain Modelの最終整理 | 実際の共有モデルだけを集約し、不要な中継・旧処理・配置不整合を撤去 |

新機能、新しい汎用Port／Registry／Lock／Recovery Framework、将来用Task Graph等は追加しない。削除・委譲・統合を先に検討し、必要な場合だけ移動・分割・改名する。

## 2. Aの現行Source対応表

以下は責務上の移管候補であり、同名の空Fileや再export中継を一律作成する指示ではない。

| 現行Source（`orchestrator/src/`内） | 処置と配置候補 | 分離しない範囲 |
|---|---|---|
| `state/transitions.ts` | 状態型・初期状態は`state/model.ts`、投影は`state/projection.ts`、実行選択は`task/scheduling.ts`、Task遷移は`task/lifecycle.ts`、回復遷移は`task/recovery-transitions.ts`、再計画は`objective/replan-transitions.ts`、判断は`decision/transitions.ts` | 共通の意味検査を重複させない。既存`task/recovery.ts`の接続契約へ状態遷移を混在させない |
| `operation-composition.ts` | 公開Objectiveは`objective/public-operation.ts`、判断は`decision/public-operation.ts`、受入は`decision/public-acceptance.ts`、照会は`state/public-query.ts`、診断は`task/execution-diagnostics.ts`へ責務別に移す | 本番依存のSingleton・診断Reporterを重複生成しない。新しい`application.ts`や恒久Facadeは作らない |
| `task/dispatch.ts` | 実行順序のOwnerとして維持。閉じた結果検査と実行型を同じ用途の`task/execution-contract.ts`へ限定分離 | Lease、予約保存、handoff、開始確定、結果保存、配送、Queue終端の順序を分散させない。既存`execute-attempt.ts`と重複する`attempt.ts`は作らない |
| `storage/current-state.ts` | 保存・CAS・Lease・Owner喪失・回復の保証単位を維持。純粋検査だけ分離可否を確認 | 行数や命名のためにAtomic境界を分断しない |
| `workspace/`、`activity/` | 基本維持。移管で必要になったimportと実際の重複だけ追従 | Workspace／Candidate／Merge／Promotionを混同しない |

Rootの`src/index.ts`で現在の公開集合を維持し、内部は実Ownerを参照する。Rootへの逆import、Capability内barrel、旧Fileを残すだけの互換中継は追加しない。Aでは旧Coordinatorとの接続を維持し、B／C用の抽象化を先行追加しない。

`operation-composition.ts`の残る具体責務も対応を固定する。`orchestratorDataBoundaryBlocked`は用途限定の公開結果投影へ移す。`buildOrchestratorCoordinatorTaskRequest`、本番依存Singleton、開発用Objective構築境界は、当面`objective/public-operation.ts`で既存の接続を保持する。B／C前に汎用Adapterへ一般化しない。

## 3. Bの責務移管

| 旧Coordinatorの責務 | 新Owner | 残す判断・確認事項 |
|---|---|---|
| Provider固有CLI、Model／Capability、入出力変換 | AI Adapter | Executor／Reviewer選択・順序・再実行判断は上位 |
| Container構成、通信・Proxy、DIが起動するProxy・Container Process、DI所有資源の回収・技術回復 | Docker Isolation | 上位はLinux／Desktop等を判断しない。Provider／Host Process全般・Task Recovery・Host Leaseを一括移管しない。Repository通信条件の同意Hash・Grant・Packet相関を維持 |
| Native OS観測と限定Host操作 | Platform Access | いつ・なぜ・どの権限で呼ぶかは上位。Host記録は保証単位ごとに判断 |
| Git操作、Worktree、固定Candidate、Merge | Version Control | 採否と実行指示は上位。自動Commit／Merge／Promotionを追加しない |
| Workbench専用AI処理 | 共通Taskへ接続 | 読取り専用、許可範囲、同意、取消、cleanup、unknown、結果変換を維持してから旧経路を撤去 |
| 環境診断 | 各専門Packageと既存CLI | 新しいDoctor Packageを作らず、CLIは集約表示だけを担当 |
| 単発実行調整、外部送信 | Cまで旧Coordinator | Bの残存をこの責務へ絞り、Cで統合 |

各移管前にSource・公開API・Consumer・既存試験・過去Evidenceを列挙し、能力ごとの対応表を固定する。Ownerが未確定のHost Lease／記録をまとめて移動しない。

Bの現在版棚卸し・移管単位・検証接続は[§8](#8-bの棚卸しと責務移管対応表)で具体化する。下表のPackage名を理由にFolder全体を移動する指示ではない。

## 4. 永続契約と保持する意図

- 現在受理するSnapshot形式、Schema版、状態・reason、保存先、Lock名、Root BindingのHash入力、IDと回復参照を維持する。
- 例として`crdd-coordinator/orchestrator-snapshot/v3`や`.crdd/orchestrator`は、Package改名だけを理由に変更しない。
- これは全旧版への互換保証ではない。新しい互換Reader・自動移行は作らず、旧形式の移行はフロントAI／人間が担当する。必要な形式変更は別途影響を示して判断する。
- 予約保存前に下位実行しない。上位保存確認前に開始確定しない。必要な結果受領記録を保存してから配送を終了する。
- cleanup／作成結果不明を成功や不存在へ変換しない。最初の失敗を後続cleanup結果で上書きしない。
- 保持中②と先行unknownの同じ回復参照を維持する。今回の整理で再試行・削除・記録書換え・Fixture転用をしない。
- 通常実行へ署名の必須条件を戻さず、既存のDocker隔離・認可・外部送信同意を維持する。

## 5. 検証・レビューと進行条件

### Aの基準能力と既存確認先

以下は基準版で既に接続されている能力の確認先と、今回の再実行状態である。過去のWorkspace成立範囲は[棚卸し・実装結果](workspace-runtime-inventory.md)、最新通信条件の成立範囲は[DIの集約結果§13](docker-isolation-source-structure.md#13-dns境界の是正と限定通信の成立--2026-10-21)を参照する。過去結果を新構造の検証へ流用しない。

| 能力 | 既存試験（`40_Develop/`からのPath） | Aでの処置・今回結果 |
|---|---|---|
| 状態遷移・選択・開始・終了・判断 | `orchestrator/tests/unit/state/transitions.contract.test.ts` | 分割前後29件成功。最終単体全体66件成功 |
| Workspace継続・採否・回収 | `orchestrator/tests/integration/workspace-lifecycle.integration.test.ts`、`acceptance-decision.integration.test.ts`（同Directory） | 自動Commit／Mergeなし。Orchestrator結合全体39件成功 |
| 単発実行とObjective受付 | `coordinator/tests/integration/orchestrator-execution.contract.test.ts`、`orchestrator-objective-intake.contract.test.ts`（同Directory） | 旧Coordinator境界を維持。下記142件の広域結合に含め成功 |
| 本番依存・再計画・耐久保存 | `orchestrator/tests/integration/public-operation.integration.test.ts`、`coordinator/tests/integration/orchestrator-replanning-and-decision.contract.test.ts`、`orchestrator-durable-foundation.contract.test.ts`（同Directory） | 広域結合は142件中140成功・隔離EPERM二件。該当二件は隔離外限定実行で成功。正常受領fixtureの公開import誤りは是正後の当該Case成功 |
| 回復と受入判断 | `orchestrator/tests/integration/docker-recovery-settlement.contract.test.ts`、`coordinator/tests/system/orchestrator-acceptance-decision.contract.test.ts` | 同じ回復参照・unknown・結果受領を維持。前者は結合全体39件に含め成功、後者は今回未実行 |
| MCP公開接続 | `mcp-server/tests/unit/orchestrator-adapter.contract.test.ts` | Root接続と公開結果20件成功 |
| 公開集合・利用側閉包 | 現行`orchestrator/src/index.ts`、`domain-model/tests/integration/storage-consumer-closure.integration.test.ts`、`version-control/tests/integration/consumer-closure.integration.test.ts` | Root196宣言不変。Domain／VC閉包は初回15成功・1失敗、既存Readerの期待一覧追従後16件成功 |

### 段階別の検証義務

| 段階 | 必要な確認 |
|---|---|
| 計画 | 設計・品質の読取り専用着手前確認、計画の独立レビュー、正本・利用側の横断影響確認 |
| A | 状態・判断・再計画・投影のUnit、保存／Lease／回復・Workspace結合、Coordinator接続、MCP接続、公開export集合、Symbol／Catalog／Traceability、静的検査 |
| B | 旧能力→新Owner→本番Consumer→失敗Oracleの接続。移管した実境界ごとに必要な限定検証を選択 |
| C | Workbench／MCP／CLIの正常・拒否・取消・親喪失・同じ参照での再入場、旧依存0、Source名と永続契約の別確認 |
| D | 共有モデルの実Consumer、逆依存、公開DTO、保存・Lockの保証単位、Header・命名・配置・回帰 |

各固定候補で独立レビューを行い、設計・Quality・Source・Test・設定・配布入口を同じ対象版へ同期する。現在の歴史的な記述を新方式の現状として扱わず、Architectureの変更は各段階の初回Source編集前に具体化する。本計画だけでSource移管、実境界成立、全体QA、Release完了を主張しない。

現時点は計画変更であり、準拠基準・決定権限を変えないため準拠監査・Release監査は実施しない。実AI依頼、Docker起動／再起動、Image更新、保持物の清掃は今回の計画整理に含めない。必要になった実操作は対象・回数・情報・回収条件を示して別途承認を得る。

現在、人間による追加判断は必要ない。A・B1〜B5のSource整理・対象回帰・独立レビューを完了した。次はCの統合を詳細化し、公開契約と順序を変える必要が判明した場合だけ、影響と最小代替案を提示して停止する。

## 6. 状態責務分割の実装と確認

旧`state/transitions.ts`を§2の7Fileへ移し、旧Fileを撤去した。65宣言の本文は公開指定と空白を除いて基準HEADと一致し、Rootの公開196宣言は不変。保存とDispatchはimport追従だけである。単独利用の候補Identity検査はLifecycle内に閉じ、共有検査だけModelが内部exportする。

独立レビューでは、現在投影、実装・検証Relation、単独検査の配置、別Package試験のRoot接続を是正した。非公開の受領補助関数をRoot公開済みと誤認した追従は実行で検出し、公開APIを増やさず、保存試験が型付きの正常fixtureを直接構築する形へ訂正した。補助関数の正負検査はOrchestratorの状態UT、保存・Readerの負例は既存ITで維持する。再レビュー残指摘0。

静的確認はOrchestrator・MCP・VCの書式／型／Lint、Coordinator・Checkerの型と変更試験の書式／Lintが成功。未変更の情報診断は残す。台帳382件valid、設計Traceability accepted、公開集合／Production Header／全Test接続3件、純粋依存閉包4件が成功した。一時編集Scriptは専用Directoryごと回収・不存在確認済み。Docker・外部AI・認証情報・保持中②と先行unknownは操作していない。

広域結合6 Suiteは142件中140成功・2失敗（23分14秒）で完走した。二失敗はjunction／hardlinkを作る試験準備が隔離環境にEPERMで拒否されたもので、承認された隔離外の同じ二件は2件とも成功した。初回の終了値1は変更せず、この補完確認と区別する。現在版fixtureの正常受領Caseも別途成功し、型・公開集合・保存負例の維持を確認した。VCの期待一覧1行追従も限定再レビュー残指摘0。

状態責務分割を閉じたこの時点では、Aの公開操作組立て・Task結果検査整理とA全体が残っていた。続く§7でAのSource整理を完了した。未実行のsystem集合とB〜Dは引き続き残り、部分成功を全体QA・Release成立へ拡張しない。

## 7. 公開操作・結果検査の移管とAの区切り

§2の公開操作・診断を実Ownerへ移し、旧`operation-composition.ts`を撤去した。実行型と閉じた結果検査は`task/execution-contract.ts`にまとめ、Dispatchの予約・開始・保存・受領・配送順序は維持した。移管した40宣言の本文はコメント・公開指定・空白を除いて基準版と一致し、Rootの公開196宣言も不変である。本番依存Singletonと二つの診断Reporterは重複生成せず、今回の移管先を通る新しい循環依存はない。既存の保存・Workspace・履歴間の循環は今回解消していない。

非公開の公開操作結合試験をOrchestratorへ移し、Profileの生成側と受理側を各OwnerのUTへ分離した。公開Objectiveの実Task入力でProfile／Executor／Frontの相関も確認する。MCPの結果変換OracleはMCP側へ移し、実際の受入済み状態の保存・読取りOracleはOrchestrator側へ維持した。二つの分離試験を一本の実E2Eと主張しない。

| 確認範囲 | 今回結果と限界 |
|---|---|
| Orchestrator | 単体67件・結合49件が成功。書式・型・Lint成功。既存の情報診断2件は未変更 |
| Coordinator接続 | 実行・受付・再計画78件成功。保存基盤・単発Adapter81件中79成功、リンク作成準備の隔離EPERM二件は承認された通常環境で同じ二件が成功。初回の終了値1と補完結果を区別する |
| 公開入口・利用側 | MCP21件、Domainの保存閉包4件、VC閉包12件、依存分類4件、Catalog25件、設計Trace14件、公開集合・Production Header・Test接続3件が成功。Header分類の環境制約一件は通常環境で成功 |
| 静的・台帳 | Coordinator・MCP・Checkerの型、MCP・VCの書式／型／Lint、変更48Fileの書式／Lint、差分空白確認が成功。Catalog383件valid、設計Traceability accepted |
| 独立確認 | 設計と品質の指摘を統合是正し、限定再レビュー残指摘0。判定・timeout・例外・待機方式の変更なし |
| 全体文書検査 | 不合格。履歴内旧参照3,515件と、今回未変更の`07_Quality/04_Quality_Integration.md`の5診断を検出。今回のSource整理を全体文書品質の成立へ拡張しない |

AのSource整理を完了とする。今回の移管用一時Scriptは専用Directoryごと回収し、不存在を確認した。system集合・実AI／Dockerの再確認、全体QA・ReleaseおよびB〜Dは完了に含めない。保持中②と先行unknown、認証情報は操作していない。

## 8. Bの棚卸しと責務移管対応表

### 8.1. 基準・範囲・読み方

Bの調査基準は、AをCommit／Pushした`f8f7a9986`である。`coordinator/src/`は108 File（Root `index.ts`と11 Folderの107 File）、`bin/`は1 File、`scripts/`は29 File、`tests/`はfixture等を含め200 TypeScript Fileであった。行数やHeaderの申告だけでなく、公開宣言、import、実呼出し、WeakMap、保存とEffect発生点を照合した。以下は移管計画であり、Source移管・削除・新API追加が実施済みという意味ではない。

| 区分 | 今回の意味 |
|---|---|
| 専門Packageへ分離 | 指定した技術部分だけを既存Ownerへ寄せる。混在する上位判断を一緒に渡さない |
| Cまで保持 | 旧Coordinatorが現在の意味・状態・許可を保持し、Cで新Coordinatorへ統合する。恒久的な二Package維持ではない |
| 統合／撤去候補 | 現Consumer・検証義務・過去判断を照合してから処置を確定する。未接続だけで採用済み能力を削除しない |

ProviderのCLI計画・出力・認証仕様は、多くが既にAI Adapterへ接続されている。`provider/`を丸ごとAI Adapterへ、実行Controllerを丸ごとDocker Isolationへ移す案は採らない。下位への上位Grant／Task／保存の逆流を避け、上位で確定した値を既存APIへ渡す。技術処理の移管と、上位の完了判断・通知受理・耐久受領は分離する。

変更経路はArchitecture上の責務移管計画である。現在の正本・公開入口・利用側・Qualityを照合し、複数Owner間の誤移管を防ぐ設計／品質の読み取り専用着手前確認と、成果物完成後の独立確認を行う。今回はSource・規範・準拠基準・権限・保存形式を変更しないため、実環境試験・準拠監査・Release監査は行わない。§4の保持条件、Repository内だけの文書編集、②の再試行と保持物操作禁止を維持する。

### 8.2. `provider/` 25 File

以下と後続表の現Fileは、特記しない限り`40_Develop/coordinator/src/`からの相対Pathである。移管先は確定済みのPackage責務を示し、必要のない空File・barrel・中継を先に作らない。

| 現File | Bの処置・移管先 | 上位に維持する意味／条件 |
|---|---|---|
| `provider/authority-grant.ts` | Cまで保持 | Operation・Home・起動直前許可の発行／一回消費／失効 |
| `provider/delegation-route-selection.ts` | Cまで保持 | Executor／Reviewerの組合せ・委譲判断。Provider名だけでAI側へ移さない |
| `provider/delegation-selection-grant.ts` | Cまで保持 | 選定結果・Operation・期限・supersedeと一回消費 |
| `provider/model-selection.ts` | AI Adapterの既存選択APIへ寄せられる純粋語彙だけ分離 | 費用・必要性・選定理由・通知はCまで保持 |
| `provider/eligibility-observation.ts` | 既存Availabilityへの観測入力接続として整理 | 固定候補を実測済み利用可否と表示しない。実行許可と観測を分離 |
| `provider/home.ts` | Provider仕様は既存AI認証APIを使用 | Home保存配置・選択・観測・利用許可は上位 |
| `provider/home-windows-adapter.ts` | 既存PA観測への薄い接続へ縮小 | 対象Home選択・鮮度・Capability発行／消費／失効は保持 |
| `provider/home-mount-grant.ts` | Cまで保持 | Home貸出しの条件・期限・状態遷移 |
| `provider/home-mount-authorization.ts` | 実Mountの技術値だけDIへ分離 | Home認可・Lease・一回消費・終了確認は上位 |
| `provider/isolation-profile.ts` | Docker純技術条件はDIへ | Authority・Home Grant・Operation・Profile相関は上位 |
| `provider/lifecycle.ts` | 未接続候補として統合／撤去を評価 | `planProviderLifecycle`の未実装拒否と試験・設計上の義務を照合してから確定 |
| `provider/task-packet.ts` | CLIへの表現は既存AI計画へ接続 | Prompt・送信Grant・TaskRole・Schema・通信条件・Operationの結合は上位 |
| `provider/task-structured-result.ts` | Provider Envelope／turn抽出を既存AI結果APIへ統一 | Executor／Reviewer業務Schema、Findings、Path、是正の一回消費は保持 |
| `provider/execution-types.ts` | 技術型はDI、CLI型はAI Adapterの既存型を参照 | Operation／Grant／Packet／短命Capabilityの混合型を下位公開しない |
| `provider/execution-plan.ts` | Image・Seccomp・Mount・Proxy・資源名の技術計画をDIへ | 選定・Packet・Home Grantの照合は上位。AI CLI計画をDIが再生成しない |
| `provider/isolation-execution.ts` | 純技術計画・構成Hash照合をDIへ | `resolveIsolationCommandInput`のAI計画・業務Schema・選定再照合は上位で分離 |
| `provider/execution-controller.ts` | Docker技術観測を既存DI実行APIへ集約 | Submission／Receipt保存、開始通知受理、結果意味、Authority／Home終了、上位回復完了は保持 |
| `provider/execution-result-reasons.ts` | 技術理由はDI／AI結果の既存語彙を使用 | 上位公開理由への変換は上位 |
| `provider/execution-composition.ts` | 技術依存の組立てと上位依存注入を分離 | Mount許可・Packet消費・Authority・借用Treeの相関を維持 |
| `provider/preparation.ts` | Provider固有条件は既存AI APIへ | 選定・許可・Packet・Home Lease・Authorityの準備順は保持 |
| `provider/preparation-lifecycle.ts` | Cまで保持 | 準備期限・取消・一回消費・失効・Lease解放をDI資源回収と混同しない |
| `provider/execution-adapter.ts` | 共通準備Ownerへの統合候補 | private WeakMapと準備／消費の単一Ownerを維持 |
| `provider/codex-docker-adapter.ts` | 共通Factoryへの薄い入口を統合候補とする | Provider別の私有準備状態を誤共有しない |
| `provider/claude-docker-adapter.ts` | 同上 | CLI実装の重複新設なし |
| `provider/claude-subscription-authentication.ts` | login/status仕様→既存AI API、Image／Container／Proxy／Process／技術回収→DI | Home選択・排他・開始許可・記録・元相関・未確認状態は上位。OAuth成立とcleanup成立を別々に要求 |

### 8.3. `workbench-ai/` 10 File

| 現File | Bの処置・移管先 | 保持する保証 |
|---|---|---|
| `workbench-ai/advice-contract.ts` | Cまで保持し共通Taskとの対応を固定 | 助言依頼・業務結果の契約はProvider仕様ではない |
| `workbench-ai/advice-task.ts` | Cまで保持 | 許可Context、Task／Profile、期待Schema、秘密区分の固定 |
| `workbench-ai/advice-result.ts` | Cまで保持 | facts／sharedAnalysis／additionalInferences／nextOptionsと許可参照の意味 |
| `workbench-ai/advice-dispatch.ts` | 共通Task接続後に統合候補 | 明示確認・一回送信・取消・cleanup・業務結果受理 |
| `workbench-ai/advice-packet.ts` | Cまで保持 | Operation／Profile／Command Hashと一回使用許可 |
| `workbench-ai/repository-composition.ts` | 上位の共通Task組立てへ整理 | 固定Project Context・Profile Snapshot・送信範囲 |
| `workbench-ai/advice-execution.ts` | 技術実行はDIへ集約し、共通Taskへの接続へ縮小 | Operation・Home・回復・通知・結果返却は上位 |
| `workbench-ai/advice-execution-plan.ts` | CLI計画はAI、Image／Mount条件はDI | TaskHash・projectionHash・Profile整合は上位 |
| `workbench-ai/provider-adapter.ts` | 不要中継の統合候補 | Profile検査と計画受理を統合先へ接続してから撤去 |
| `workbench-ai/advice-provider-executor.ts` | 共通実行入口への統合候補 | 開始前取消、例外時Effect不明、cleanup未確認拒否を維持 |

現在のOrchestrator本番組立ては、Codex／Claudeの助言に同じexecutorを渡している。二つの関数表の維持理由は再評価するが、許可・計画検査・結果相関まで消してよい根拠にはしない。Workbench固有の表示結果をAI Adapterへ移さず、Task完了だけで採用・Commitを追加しない。

### 8.4. Host・Platform・Repositoryの24 File

| 現File | Bの処置・移管先 | 移管しない意味／保証 |
|---|---|---|
| `host-execution/generation-loss-transition.ts` | Cまで保持 | Host世代喪失時の上位遷移 |
| `host-execution/kernel-lock.ts` | Named Pipe取得・保持確認・解放の技術部分をPAへ。用途別名前空間・Hash入力・利用判断は上位 | 既存排他の実体・名前・取得順を変更せず、新Lock Frameworkにしない |
| `host-execution/kernel-lock-lifecycle.ts` | OS搬送の終端部分をPAへ分離 | 呼出し側Owner・回復判断を技術handleへ混入させない |
| `host-execution/kernel-lock-worker.ts` | 既存Worker本体をPAのProcess領域へ移す候補 | 起動先・共有状態・error／close・実解放の確認を一体追従 |
| `host-execution/operation-lock-supervisor.ts` | OS排他保持と子監視の技術部分をPAへ | Coordinator固有のOperation／Capability許可は移さない |
| `host-execution/node-runtime-version.ts` | Cまで保持し最終Package入口へ統合 | 全Package共通の新Runtime Registryは作らない |
| `host-execution/operation-lease-lifecycle.ts` | Cまで保持 | 取得・取消・後着通知と上位Lease所有 |
| `host-execution/operation-workspace-lifecycle.ts` | 混在。OS固有Identity／保護観測はPA、DI所有Mount／一時資源の技術処置はDIへ限定分離 | Operation所有・世代・管理Capability・Host回復・保存判断は上位。約5千行を丸ごと移さず、取得から失敗時の保持まで保証単位で切る |
| `host-execution/orphan-recovery-policy.ts` | Cまで保持、実Consumerと現行許容条件を再照合 | 汎用orphan強制削除へ一般化しない |
| `host-execution/process-safety-state.ts` | Cまで保持 | Process再利用可否・Effect drain・poisonは上位。Docker技術回収と別 |
| `host-execution/recovery-record.ts` | ProbeのDocker固有値はDI、Native記録I/Oは既存PAを利用 | Hostのexact参照、bytes、Root相関、lineageは上位。保存正本を二重化しない |
| `host-execution/terminal-caller-checkpoint.ts` | Native呼出しの技術重複だけPA既存APIへ集約 | 呼出し側の耐久intent・公開・再入場は上位 |
| `host-execution/terminal-caller-lease.ts` | OS排他実処理はPAへ接続 | exact対象選択とLease利用判断は上位 |
| `host-execution/terminal-record.ts` | Cまで保持 | Host終端intentの意味・Schema・Hash・旧世代判定。新しい互換Readerを作らない |
| `host-execution/typescript-child-entrypoints.ts` | Worker／子Processの入口表を実Ownerへ分配 | 任意子Process起動APIを新設しない。検証専用子はscripts側へ |
| `host-execution/windows-platform-observation.ts` | `process.kill(pid, 0)`の三状態観測・OS識別・環境導出の技術部分をPAへ | 必要保証の選択は上位。ESRCH以外を不存在へ丸めない |
| `platform-access/adapter.ts` | Native応答のdecode・固定Protocol検査は既存PAへ統合 | runtime／authority用途とPrincipal受理・利用許可の判断は上位 |
| `platform-access/protected-root-windows-adapter.ts` | 既存PA観測へ薄く接続 | Root用途・開発観測借用・上位Capabilityの発行／消費は保持 |
| `repository-operation/binding.ts` | Git形式／改訂／Root観測の重複は既存VC公開APIへ寄せる | OperationとRepositoryの私有Binding／Capabilityは上位 |
| `repository-operation/borrowed-workspace.ts` | Cまで保持 | 上位で解決した実行対象だけを借り、Workspace寿命を所有しない |
| `repository-operation/create.ts` | Cまで保持。下位技術呼出しだけ既存Ownerへ | Operation作成順と最初の失敗・残存分類 |
| `repository-operation/root-observation.ts` | OS応答正規化はPA、上位用途別Hash／受理は上位に切り分け | 現Hash入力・用途・鮮度・確認不能を維持 |
| `repository-operation/root-protection-policy.ts` | Cまで保持 | 観測事実から必要な保護を受理する判断。観測そのものではない |
| `repository-operation/workspace.ts` | Git変更／改訂観測はVC、技術Mount材料はDIへ接続 | 既存dirtyのInput、借用Tree、許可範囲、review用内容投影、帰属不明、削除未発行は上位 |

`repository-operation/workspace.ts`の`captureRuntimeOwnedCandidateRevision`等は、現在もTaskの終了観測とレビュー用内容確認へ接続されている。Gitで明示固定するCandidateや撤去済みBundle Storeと同一視しない。旧名の整理は、実Task入力と結果の意味を確認して行い、読み取り投影を不要なRepository全複製へ戻さない。

### 8.5. 状態・Task・外部送信の21 File

| 現File | Bの処置・移管先 | 保持条件 |
|---|---|---|
| `state-storage/model.ts` | Cまで保持 | 操作・回復・配送・修復の閉じた現在状態。DI checkpointの型を参照しても保存Ownerは移さない |
| `state-storage/settlement-store.ts` | Cまで保持 | 単一Writer、保存／読戻し、短命物、再入場、History、consumer ACK。Atomic境界を分断しない |
| `state-storage/docker-recovery-journal.ts` | Cまで保持して実Consumerに応じ改名・分割を評価 | Docker専用ではなくOrchestratorの判断保存も使う。PAへ汎用保存Frameworkとして移さない |
| `state-storage/recovery-identity.ts` | DI型との一元化を評価。現保存受理条件は上位 | 同じexact参照と文法・長さ・種類相関を維持 |
| `state-storage/restart-checkpoint.ts` | 技術checkpoint定義はDIとの重複を評価 | 要求・記録・回収・保存遷移相関は上位 |
| `task/attempt.ts` | Cまで保持 | 上位へ返す単発Task・開始・取消・結果・Workspace観測 |
| `task/cleanup-eligibility.ts` | 上位判断を保持しDI技術事実だけ受け取る | 回収候補と確定参照・対象集合の相関。判定緩和は今回行わない |
| `task/completion-observation.ts` | Cまで保持 | 同じTaskの完了を観測し、上位Attempt Stateを新たに所有しない |
| `task/development-measurement-constraints.ts` | 開発観測専用として利用境界を整理 | 上限・固定対象・送信範囲の契約を通常実行へ混ぜない |
| `task/development-measurement-session.ts` | 同上。必要な製品接続と試験専用補助を分ける候補 | Session・予約・Capability・元観測の相関を維持 |
| `task/development-source-observation.ts` | 開発観測専用のSource読取りとして整理 | 安全な固定Inputを通常Repository全体の複製へ拡張しない |
| `task/execution.ts` | Cまで保持し専門APIの薄い実行調整へ縮小 | TaskRoleの順序・許可・取消・開始通知・配送・上位結果。技術callbackだけDIへ |
| `task/recovery-projection.ts` | Cまで保持 | 非秘密の理由・参照を許可した利用側へだけ投影 |
| `task/recovery.ts` | 技術観測・回収は既存DIへ、残る保存／Host／Home相関は上位 | unknown、同じ参照、Primary Failure、consumerごとの終了を維持。全体をDIへ移さない |
| `task/request.ts` | Cまで保持 | 公開Task入力の閉形式・対象確認 |
| `task/result-reasons.ts` | 上位公開理由を保持、下位の技術語彙は既存APIを参照 | 未知理由を成功・回収済みにしない |
| `task/types.ts` | Cまで保持しRoot契約を追従 | 欠測と観測済み、元Task／Attempt／Operation相関 |
| `external-send/consent-record.ts` | Cまで保持 | 同意の意味・期限・正規形 |
| `external-send/consent-store.ts` | Cまで保持 | 同意のexact境界Hash・保存・失効。汎用共有Stateを追加しない |
| `external-send/grant.ts` | 同意／一回送信GrantはCまで保持、端末技術だけPAへ | Secret入力をPrompt／logへ出さず、未承認送信・自動再送を追加しない |
| `external-send/policy.ts` | Repository設定の読取り正本は既存Domain、技術通信はDI | 追加通信条件を実行同意Hashへ結合する判断は上位。認証時はProvider固定、AI実行時は役割共通のRepository別条件 |

実行判断をAccess Managementへ集約しない。同Packageは認証・認可のOwnerであり、Task／Home／外部送信の短命な実行Grantとは別である。Dで共有モデルを最終整理する前に、これらをDomainへまとめて移すこともしない。

### 8.6. Authority・CLI・診断の27 FileとRoot

| 現File | Bの処置・移管先 | 条件 |
|---|---|---|
| `authority/file-bundle.ts` | Cまで保持 | 現起動許可のInputとDoctorの説明にConsumerあり。旧署名名だけで廃止しない |
| `authority/grant-verifier.ts` | Cまで保持 | 現在の実行許可と対象の評価。Access Managementの利用者認可とは別 |
| `authority/local-personal-grant.ts` | Cまで保持 | Operation／Profile結合と短命cache。署名資格へ戻さない |
| `authority/prelaunch-verifier.ts` | Cまで保持 | Effect直前の再確認を、準備済みだからという理由で削除しない |
| `authority/root-path-lexical.ts` | OS Pathの字句検査だけPA既存Filesystem領域への統合候補 | 字句一致を実体Identityの証明にしない。DI試験のprivate参照も追従 |
| `authority/runtime-trust.ts` | 本番未接続の統合／撤去候補 | 静的importは現状試験一箇所。設計・QA・動的入口の確認後に確定し、通常実行のGateへ追加しない |
| `authority/secret-material-policy.ts` | Cまで保持、Dで共有必要性を再評価 | 外部送信内容・scope検査。独自Secret Managerや完全不存在証明にしない |
| `authority/trust-loader.ts` | Cまで保持 | 現起動許可データの読取り・正規形・署名との区別を維持 |
| `cli/command-report.ts` | CLI表示としてCまで保持 | 下位の理由・回復・非秘密結果の閉じた表示 |
| `cli/command.ts` | 単一binの受付先としてCまで保持 | 既存Task／診断／認証等の操作を混同しない |
| `cli/interactive-console-reader-lifecycle.ts` | 端末I/Oの技術lifecycleをPAへ分離 | 同意内容の判断は外部送信Owner |
| `cli/interactive-console-reader.ts` | 既存の固定端末Readerと有界InputをPAの技術領域へ移す候補 | EOF・取消・所有handle・部分結果を一体で維持 |
| `cli/interactive-console.ts` | OS Consoleの取得・読書き・解放をPAへ分離 | 人間に何を確認するか・同意成立は上位。新Console Frameworkにしない |
| `cli/launch.ts` | Cまで保持 | 公開起動modeと固定配送先。scriptsの文字列Pathも追従 |
| `cli/options.ts` | Cまで保持 | CLI入力契約 |
| `cli/request-input.ts` | Cまで保持 | 共通のstdin上限・UTF-8・JSON拒否 |
| `cli/task-cancellation.ts` | Cまで保持 | 利用者SignalとTask取消の一回伝播・終了結果 |
| `diagnostics/development-execution-timing.ts` | 開発計測専用の配置へ整理候補 | 実行知の分析正本とは別。計測出力を製品Stateへ追加しない |
| `diagnostics/docker-recovery-command-report.ts` | CLI表示としてCまで保持 | 技術観測そのものはDI。表示だけで回復成功を作らない |
| `diagnostics/doctor.ts` | CLIの集約を保持、専門技術確認は各既存APIへ | 発見・認証・Probe・修復を単なる読取り診断と扱わない |
| `diagnostics/isolation-probe.ts` | 技術Probeは既存DIへ寄せ、上位の保存・相関接続だけ残す | 試験用と製品入口を区別。Host二保存をDIへ押し込まない |
| `diagnostics/native-git-provenance.ts` | Artifact観測はPA、Git由来確認はVC、接続は開発Toolへ整理候補 | Git Commit／Hashを実行資格にしない |
| `diagnostics/native-runtime-trace.ts` | Native検証用のscripts補助へ移す候補 | 欠測Event・Lost Buffer・対象Process母集団の検査を維持 |
| `diagnostics/release-identity-grammar.ts` | Git IDはVC既存文法との統合、Version／日時は実Consumerに応じ整理 | `release`名だけでRuntimeに署名を再導入しない |
| `diagnostics/runtime-repair.ts` | DI技術処置へ接続する上位Callerとして保持 | 同じ操作・許可・保存・回収判断・保持引渡し。技術修復と耐久終端を分離 |
| `diagnostics/runtime-restart.ts` | 同上 | 再起動の承認・Scope・記録は上位、実処理はDI／PA |
| `diagnostics/signed-runner-safety-observation.ts` | 検証scriptsの結果安全検査へ整理・改名候補 | 現在は署名必須の根拠ではない。exact回復参照と共同終了条件は維持 |
| `index.ts` | 下記公開契約を利用側と一緒に追従 | 便宜的な再export中継や試験専用APIを追加しない |

### 8.7. 公開APIと既知の利用側

基準Rootは19宣言を公開する。Bで削除・移動する場合は、対応する現利用側を同じ単位で切り替える。以下は現在の公開集合の整理であり、新APIの一括新設ではない。

| 現Root宣言 | B／CでのOwner |
|---|---|
| `runCoordinatorTaskAttempt`、`snapshotCoordinatorWorkspaceResult`、`COORDINATOR_TASK_PRE_EFFECT_REJECTIONS`、`CoordinatorTaskDependencies` | Cまで単発実行Owner。結果相関をDIへ移さない |
| `CoordinatorTaskAttemptInput`、`CoordinatorTaskAttemptResult`、`CoordinatorWorkspaceResult`、`CoordinatorTaskRecoveryObligation` | 上位が利用する単発実行契約。Cで新Coordinatorへ |
| `isSupportedCoordinatorNodeRuntime` | 最終Package起動入口の基準確認 |
| `createRuntimeProcessRecoveryIdentity`、`getRuntimeProcessInstanceIdentity`、`inspectRuntimeProcessRecoveryIdentity`、`poisonRuntimeProcessAfterCleanupUnknown` | Process再利用可否と上位相関。Cまで保持 |
| `acquireRuntimeOwnedOrchestratorStateKernelLock` | PAのOS排他技術へ接続し、上位の用途・名前空間は保持 |
| `recoverRuntimeOwnedDockerTaskForCurrentConsumer`、`resolveRuntimeOwnedDockerTaskCurrentCorrelations`、`observeRuntimeOwnedTransientTaskCompletion` | 上位の回復相関・受領・終了。技術回収だけDIへ |
| `readRepositoryNetworkPolicies`、`RepositoryNetworkPolicies` | 設定正本はDomain、用途別の同意境界への接続は上位 |

| 現利用側 | 必要な追従 |
|---|---|
| OrchestratorのObjective／Decision／Query、Task、保存、Platform、CLI、Workspace | Rootへの接続に加え、Repository Binding、Task実行、助言組立て、OS観測、Kernel Lock、保護Root、保存Journal、Secret検査のprivate importを解消する。技術は専門Rootへ、残る意味はCの統合先へ |
| WorkbenchのAI request型・接続・route、Browser型、検証scripts | 単発契約と非秘密結果を維持し、下位型をBrowserへ露出しない。開発観測のprivate importも移管単位へ含める |
| `template/tools/crdd-coordinator.ts` | 起動mode・Node基準・配送先・対話条件の同時追従 |
| `template/tools/crdd-mcp-server.ts` | 現Coordinator Root参照を移管先へ。MCP製品Sourceは上位業務Owner接続を維持 |
| DIの`repair-host-operations`試験 | `root-path-lexical.ts`のprivate参照を適切なOwnerの試験へ移す。試験専用Root APIを足さない |
| Checker／Domain／VCの閉包検査、Symbol、Catalog、設計Trace | 現在のConsumer全数期待・試験Owner・品質Relation・起動Pathを同時更新 |

静的import走査では、Orchestrator18 File、Workbench7 File、DI試験1 File、template2 FileからCoordinator `src/`への参照を観測した。この数は文字列Path、動的入口、同Package内の利用側を含む完全性の主張ではない。各実装単位でbin／scripts／workerの固定Pathと実公開入力搬送を別途確認する。

### 8.8. bin・scripts・npm・試験・既存根拠の対応

`bin/coordinator.ts`は現在唯一のbinである。`cli/launch.ts`が`verify-signed-route-matrix.ts`、`verify-signed-recovery-matrix.ts`、`authenticate-claude-subscription.ts`へも配送するため、Sourceだけを移して起動先を残さない。

| 現`coordinator/scripts/`（29 Fileを全数分類） | 移管・保持先の方針 |
|---|---|
| `authenticate-claude-subscription.ts` | 認証の上位許可入口を保持。仕様AI／技術DIへ接続し、実認証は今回起動しない |
| `check-platform-access-coverage.ts`、`check-platform-access-ts-coverage.ts`、`platform-access-coverage-path.ts`、`check-native-runtime-trace.ts`、`verify-native-protection.ts`、`verify-native-terminal-fixtures.ts`、`verify-native-terminal-namespace.ts` | PAの技術検証・Build用scriptsへ整理。上位許可を試すCaseは上位に残し、製品Native APIを検証用に拡張しない |
| `prepare-codex-image.ts` | Task／助言のImage構成とBuildはDI。Provider公式取得検証の既存境界を維持 |
| `check-dynamic-fake-provider-coverage.ts`、`verify-dynamic-fake-provider-cancellation.ts`、`verify-dynamic-fake-provider-failures.ts` | 技術試験はDI、上位状態／通知の試験は上位。モック成功を実取消・資源不存在へ換算しない |
| `check-provider-authority-coverage.ts`、`check-provider-home-coverage.ts`、`revoke-external-send-consent.ts` | 上位許可・Home利用・送信同意のOwnerに保持 |
| `measure-development-providers.ts`、`orchestrator-real-provider-contract.ts`、`verify-orchestrator-real-providers.ts`、`verify-signed-general-task.ts`、`verify-signed-reviewer-boundary.ts`、`verify-signed-route-matrix.ts`、`verify-signed-recovery-matrix.ts`、`workspace-task-fixture.ts` | 現在の上位Task／Workspace／実境界確認Toolとして保持・改名を評価。`signed`名から通常署名Gateを復活させない |
| `check-orchestrator-design-traceability.ts`、`orchestrator-design-traceability.ts`、`check-runtime-traceability.ts`、`runtime-traceability.ts`、`verification-result-reasons.ts`、`verification-result-record.ts` | 設計と検証のOwnerに追従。Source配置変更で旧根拠を新版Passへ書き換えない |

CoordinatorのnpmにあるPA Build／Clippy／Rust試験／coverage、Provider別coverage、Native診断、Image準備、実Provider検証、開発計測は、実装Ownerと一緒に入口を整理する。通常`test`から明示Host／Docker／認証／実Provider／Image更新用入口を一括起動しない。

| 能力／意味 | 代表的な既存検証（Coordinator tests、短縮名） | 移管後に保持する反証・実境界 |
|---|---|---|
| Provider CLI・結果 | `provider-execution-boundary-matrix`、`provider/model-selection`、`provider/task-structured-result`、Claude／Codex execution plan | Provider・用途・Model差、getter／Proxy、不正Envelope、非秘密投影。argv／stdio／結果意味を変えるなら公式CLIの限定確認を計画 |
| Docker構成・Process・回収 | `docker-effect-runtime`、`docker-process-controller`、`coordinator-task-process`、`docker-probe-*` | spawn前拒否、開始後throw、取消join、一次失敗、部分資源、unknownと元参照。資源所有を変えるなら限定Docker確認を別承認 |
| Root・Home・OS技術 | PAのRoot／Host試験、上位`development-native-observation`、`provider/home`、`native-protection-entry` | 前後Identity差、観測不能、部分Effect、許可未発行。Native搬送変更なら実Windows確認 |
| Lease・Host記録 | `kernel-lock`、`host-terminal-caller-checkpoint`、`host-recovery-record`、`docker-recovery-owner-reentry` | Owner喪失、同参照での再入場、ACK前後、未知≠不存在。Worker／handle移管は実排他取得・解放まで確認 |
| Git・借用Tree | `repository-git-layout`、`repository-operation-runtime`、`repository-workspace-runtime`、VC閉包、Orchestrator Workspace結合 | 実Tree拒否、範囲外変更、dirty保持、帰属不明、削除未発行。Git技術変更は合成Repositoryで確認 |
| Workbench助言 | `workbench-ai/*`、`workbench-ai-profile-catalog-flow`、Workbench HTTP結合 | 古い画面Hash、失効後Reader零回、二重送信、Schema、取消後通知と資源。全保証対応前に旧経路を削除しない |
| 起動・検証Tool | `coordinator-launch`、`development-package-scripts`、`interaction-boundary-regression`、各Tool契約 | mode／余剰引数／TTY／実操作Gate／結果Envelope。文字列配送と相対Rootも確認 |

試験名は能力の確認先であり、全200 Fileの実行許可ではない。各移管時に、旧Case→新Ownerの試験→上位Consumerの試験を固定する。既存の[PA成立範囲](platform-access-source-structure.md#11-①⑤の最終照合)、[DI通信の成立範囲](docker-isolation-source-structure.md#13-dns境界の是正と限定通信の成立--2026-10-21)、[Workspaceの結果・保持判断](workspace-runtime-inventory.md)は基準能力を特定する根拠であり、B移管後の新しい検証結果の代替ではない。

### 8.9. 実施順序・代替案・停止条件

| 順序 | 移管単位 | 終了条件 |
|---|---|---|
| B1 | 本番未接続候補・検証専用補助・起動／npm入口の整理範囲を確定 | `provider/lifecycle.ts`、`authority/runtime-trust.ts`、Native／署名旧名Tool等のConsumerと採用済み義務を照合。不要部分は撤去、試験専用は試験へ。未評価をdead codeと断定しない |
| B2 | PAへOS観測・端末I/O・排他技術を移管 | OS技術と上位用途・許可・回復の分離、Worker／子Process Path、三状態観測、取消・遅延・実解放、上位Consumerまで確認 |
| B3 | AI仕様とDI技術計画・実行の境界整理 | 既存AI APIへCLI・結果抽出を統一し、DIは確定済み入力から技術実行。保存hook・Grant・業務Schemaが下位へ逆流しない |
| B4 | Git／Repository観測・借用Treeの接続整理 | 重複技術は既存VC APIへ。上位Binding・選択Tree・レビュー投影・dirtyと未選択変更を保持 |
| B5 | Workbench助言の共通Task接続と旧中継の撤去、全利用側の閉包 | 既存助言保証を全数対応し、Task／CLI／MCP／WorkbenchとRoot・試験・台帳・設計を同期。Cへ渡す残存責務を実数で再棚卸し |

専門Package単位の丸ごと移動案は、上位の許可・保存が逆流するため不採用とする。現状をすべて維持する案は、OS／Docker分岐と重複技術を残してCの統合を肥大化させるため最終案にしない。推奨は既存APIを使う責務単位の分離であり、移管後に一つしか使われない薄い中継は統合を優先する。用途が異なるからという理由だけで新しいRegistry、Port、Lock、Storage、監視Processを作らない。

移管前に残る不確実性は、巨大なHost／State FileのどこでAtomic境界と短命Capabilityが閉じるか、技術Planの二重生成がfresh観測か重複実装か、助言と編集の共通化で何の保証を共有できるかである。今回の棚卸しで概略Ownerは定まったが、各単位の具体的な公開型・関数・File配置はSource編集前の詳細化で固定する。新APIやFile数を先に確定しない。

次の場合は当該単位を停止して再整理する。

- WeakMapの発行・消費・失効がOwnerをまたいで割れ、既存境界で閉じられない。
- 下位PackageからCoordinatorへの逆import、新共有State／Lock／回復管理が必要になる。
- 原因・結果・unknown・同じ回復参照・外部送信同意・Home許可の意味を変える必要がある。
- argv・環境・stdio・Process所有・資源Identity・cleanup順の変更に必要な実境界確認が、現在の承認範囲では実施できない。

この場合は保証できない内容、既存機能で足りない理由、影響と最小代替案を人間へ返す。保持中②の再試行・削除・参照変更、認証・Docker操作は今回実施しない。今回のB棚卸しは実装着手・技術移管完了・全体QAの成立を示さない。

### 8.10. 今回の棚卸し確認

108 Sourceと表108行は欠落・余剰・重複なし、29 Scriptも全件に処置候補があることを照合した。設計・品質の独立確認では、初期基準とBの現在基準の表記を時点限定して是正した。今回は移管計画の確認であり、公開API・Source・実環境・保持物は変更していない。文書の基準・参照を確認してから、B1の具体的な撤去／保持判断と編集計画へ進む。

## 9. B1：不要候補と検証専用処理の処置

B1着手基準は、棚卸しをCommit／Pushした`077b38b7d`である。Source削除の判断を、静的な製品Consumerの有無だけで行わず、現公開診断・Canonical義務・検証Toolと動的読込みへ照合した。

| 対象 | 今回の処置 | 保持するもの／理由 |
|---|---|---|
| `src/provider/lifecycle.ts` | 維持 | `describeProviderLifecycleContract`はDoctor結果の現Consumer。未実装の計画stubと合成Fake評価は別であり、全Fileを不要とは扱わない。今回は分割だけのための新File／APIを増やさない |
| `src/authority/runtime-trust.ts` | 維持 | ARCH-000014／SPEC-000018／QA-000010の独立読取り評価とAIT-IT-001／003を保持。署名必須の旧実行Gateとは別。通常実行へ新接続しない |
| `src/diagnostics/development-execution-timing.ts` | 維持 | 開発Taskと計測Sessionが使用し、executionTimingへ接続。通常Task全体の常時計測を意味しないが、単なるfixtureではない |
| `src/diagnostics/native-runtime-trace.ts` | `scripts/native-runtime-trace.ts`へ移管 | 既存check入口・Native Trace ITの解析補助。Lost Event／Buffer、対象Process／Module／Network条件を本文不変で維持 |
| `src/diagnostics/native-git-provenance.ts` | `scripts/native-git-provenance.ts`へ移管 | 実Git／Blob／差替え／junctionと開発Native観測の動的URLを維持。PAとVCの既存公開APIを使い、通常起動の新Gateにしない |
| `src/diagnostics/signed-runner-safety-observation.ts` | `scripts/verification-safety.ts`へ移管・内部Symbolも実責務名へ | 検証結果のBoolean・回復参照の相関検査であり、署名検証ではない。判定本文と既存reason／結果形式は維持 |
| `scripts/verify-signed-general-task.ts` | `scripts/verify-general-task.ts`へ改名 | 固定Taskの検証、同意、取消、回収と元結果Envelopeを維持 |
| `scripts/verify-signed-reviewer-boundary.ts` | `scripts/verify-reviewer-boundary.ts`へ改名 | Reviewer／Provider境界の限定検証を維持 |
| `scripts/verify-signed-route-matrix.ts` | `scripts/verify-route-matrix.ts`へ改名 | 4経路の検証を維持し、Launcherの`verify-routes`引数は変更しない |
| `scripts/verify-signed-recovery-matrix.ts` | `scripts/verify-recovery-matrix.ts`へ改名 | 親／子の固定配送と回復Matrixを維持し、`verify-recovery`引数と既存内部role・結果識別子は変更しない |

既存Schema／contract文字列、結果理由、回復ID、永続bytes、過去EvidenceのPathとHashは不変更とする。安全補助の専用UTは`verification-safety.contract.test.ts`へ実体と同時改名し、既存QA IDとSymbolの意味Identityは維持する。製品Rootの公開19宣言は増減させない。

実施順は、設計の処置固定→移管／改名とimport・動的URL・Launcher／npm／tsconfig追従→Symbol・Catalog・閉包・coverage期待一覧の追従→局所・静的回帰と独立レビューとする。CallerのSource、型、試験だけを変更し、検証Tool本体のmain／同意／Docker／外部送信を実行しない。Toolのimport時非実行条件と固定配送を確認する。

検証は既存Native Trace／Native Git／開発Native観測、安全結果、検証記録、起動・子入口、coverage母集団、DI/VC閉包、Header／Catalog／Traceabilityを対象とする。実ETW採取・Docker・AI・認証・保持物操作は対象外。配置と名前だけの変更を実環境の再成立へ拡張しない。

Sourceとしての全撤去は今回は確定しない。維持対象の保証を消す案と、使われない同等fixtureを増やして実装撤去に見せる案は採らない。B2以降の技術移管・Cの統合と独立に処置できる検証専用補助だけを先に整理する。

### 9.1. B1の実施結果と残る境界

上表の補助3件をscriptsへ移管し、検証Script4件と安全補助UTを改名した。利用側のimport・動的URL、Launcher／固定子配送、npm入口、strict対象、Symbol・Catalog・coverage期待一覧を追従した。Sourceは108→105 File、scriptsは29→32 Fileとなった。製品Rootの19公開宣言は基準版と同一で、bin1件・試験200 Fileも増減なし。旧Pathは§8の基準版棚卸しと過去Evidenceに残るが、現在の実体とは区別する。

| 確認 | 結果と限界 |
|---|---|
| Coordinatorの型・変更32 Fileのformat／lint | 成功。Biomeの一括checkが追加するimport整列補助は既存のformat／lint義務と区別し、今回無関係な全import再整列は行わない |
| 配置変更の選択回帰 | 302件中301成功。保存先linkの1件はsandboxのsymlink拒否で停止し、同じ1件を通常権限で再実行して成功。安全判定条件は変更していない |
| 維持したTrust評価／VC Consumer閉包 | それぞれ2件／12件成功。Lifecycle10件は選択回帰に含む |
| 台帳・実体・対応表 | Catalog383件valid、Coordinator Symbol291件の全Path実在、Runtime／Orchestrator設計対応表の検査成功。Root公開入口は不変更 |
| Checkerの命名・Header・Catalog関連 | 29件中25成功。symlink制限3件は同じ3件の通常権限再確認で成功。残1件は基準版にも存在するPAの`src/docker-desktop/helper.ts`曖昧名で、B2のOwner・名称整理対象として残す。全体命名検査Passとはしない |
| 独立レビュー | SourceとQuality／Architecture接続を確認。Symbol Pathの誤追従と不要なURL表記差の2件を是正し、両再確認の残指摘0 |
| 変更文書4件の照会 | 4件自身の診断は0。参照先展開では3,248診断が残り、文書検査全体はexit1。不合格をB1の局所成功へ畳まない |

機械contract／reason・回復参照・内部子role・永続Schema・既存の判定本文を維持した。実ETW、Docker、認証、外部AI、②の保持物操作は実行していない。今回のB1局所整理をB全体・実環境・全体QAの完了としない。次はB2として、OS観測・端末I/O・排他技術を既存PA APIと照合し、上位の許可・保存・回復判断を混ぜずに移管する。

## 10. B2：OS観測・端末・排他の技術境界

着手基準はB1をCommit／Pushした`e36882d6c`。実装詳細の責務移管として、Coordinator／Orchestrator／PAの設計、既存公開API、固定子入口とQAを着手前に照合した。SourceとQualityの読取り専用確認を併用する。今回の目的は技術Ownerの移管であり、許可・実行可否・保存・回復の意味、準拠基準、Release判断は変えない。独立技術レビュー、関連回帰と文書・利用側伝播を行い、新しい外部依存や基準版変更の監査、実AI／Docker／認証の実操作は行わない。

| 実施単位 | PAの配置／操作 | 上位へ残す処理と確認 |
|---|---|---|
| OS観測・環境導出（最初の実装単位） | `process/observation.ts`にPIDだけの`observeProcessLiveness`と`observePlatformFamily`。環境構築は既存`process/environment.ts`の用途別APIを直接使う | Lease入力・世代結合、二つのProfile選択、対応保証の判断はOrchestratorの既存Windows Adapterへ戻す。現在の入力形、Signal 0、ESRCHだけabsent・他失敗unknown、非対応Platformのblockedを維持する |
| 既知の曖昧File名 | `docker-desktop/helper.ts`→`docker-desktop/native-process.ts` | 修復／再起動／公式shutdown／補助子終端を所有。公開関数・型名、Protocol・Native実体は変えない。Docker実操作は実施しない |
| 端末I/O（後続） | Console取得・読書き・Reader子・終了確認をPAへ | 表示内容・同意・Grantとcleanup不明後のRuntime停止は上位。64byte入力上限、親喪失failsafe、stdio／IPC、取消join、部分書込みの扱いを維持する |
| OS排他（後続） | Named Pipe Worker・Supervisor・実handle lifecycleをPAへ | 用途別Hash prefix、Pipe名、切詰め長、取得順、Operationと保存・回復判断は上位。取得不能・既知失敗・終端不明を混ぜない |

最初の単位ではPA Rootへ既存処理から抽出した二つの観測関数だけを公開し、Coordinatorの観測専用Fileを撤去する。Orchestratorの既存operation propertyは`observeLeaseOwner`／`deriveChildEnvironment`のまま、その用途処理は既存Windows Adapterが所有する。Taskの組立ても同じLease観測へ接続する。Platform familyの利用側はPA Rootへ直接接続し、単なる再export中継を増やさない。検証は既存のWindows Adapter UT、Platform独立性IT、PA環境・公開集合、Task request組立て、Symbol／Catalogと命名・Headerへ接続する。

現在PIDのaliveは記録した世代と同一Processの証明ではない。再利用されたPIDは保守的にaliveへ残し、取得後の再検証や上位の回復許可を代替しない。観測不能を不存在へ畳まない。入力検査と返却field・reasonは不変更とし、新しい世代台帳・監視・再試行を追加しない。

端末・排他の移管では、PAからCoordinatorの固定子Registryをimportしない。Reader／Worker／SupervisorはPA内の用途固定起動へ移し、Recovery Matrix子は検証Tool側に残す。`process.execPath`、eval禁止、shell禁止、環境、cwd、stdioとIPC、Workerのstdout／stderr回収を起動地点で照合してから実装する。既存Host試験は合成の自己所有資源だけを使い、実端末・AI／Dockerを必要とする場面は無断実行しない。

File一括移動は上位の許可・poison判断を逆流させるため採らず、汎用Process起動API・新Frameworkも作らない。現行の重複中継を残す案より、既存PAの技術責務と上位の判断を直結する案を採る。技術移管に新しい永続State、Lock、許可や終了保証の緩和が必要と判明した場合は、その単位を止めて差と代替を提示する。現在追加の人間判断は必要ない。

### 10.1. 最初の単位の結果と残件

OS観測の二操作をPA Rootへ接続し、Lease入力・世代結合と二つの用途Profile選択はOrchestratorの既存Windows Adapterへ戻した。旧Coordinatorの観測専用Fileは撤去した。Coordinator製品Sourceは105→104 File、Root公開19宣言は不変更。`native-process.ts`は旧`helper.ts`と本文一致で、所在参照だけを追従した。安定Symbol IDは意味の追跡用に保持し、移管先の実体と上位の検査Ownerへ接続した。新State・Lock・監視・再試行は追加していない。

| 確認 | 結果と限界 |
|---|---|
| 静的確認 | PAのformat・型・lint、CoordinatorとOrchestratorの型、変更対象のformat／lint、差分検査が成功。Lintの既存infoはWarning／Errorと区別する |
| PA通常回帰 | 公開集合の2操作追加追従後91件成功。PID三状態・OS要求前拒否の新UT3件を含む。Host専用の実Docker処置は実行しない |
| Orchestrator／Coordinator | Orchestrator UT67件成功。Coordinator関連4 Suiteは92件中90成功、symlink／hardlink制限の2件は同じ2件を通常権限で再実行して成功。独立した実行結果を一回の全成功へ書き換えない |
| Catalog・閉包 | Catalog384件valid、Domain Catalog25件成功、Runtime／Orchestrator対応表検査成功。公開入口・明示Module・旧Path・動的参照を照合 |
| 命名／Header | Checker22件中18成功。symlink制限3件は同じ3件の通常権限再確認で成功。helper曖昧名解消後、基準版にあるRust試験`tests/integration/host-record.rs`の旧命名が次の不合格として現れた。本単位でRust実装・Cargoを変えず、命名検査全体は未合格とする |
| 文書 | 変更4文書自身の診断0、参照先展開3,245診断で全体exit1を維持する |
| 独立確認 | SourceとQuality／Architecture接続の確認後、B2説明段落の所属1件を意味不変で訂正。限定再確認の残指摘0 |

端末I/O・Readerの実生涯、Named Pipe排他・Worker／Supervisor、固定子3役のPA内起動は未移管である。これらは§10の保持条件と既存自己生成試験へ接続してから閉じる。初期単位の成功をB2全体・外部AI E2E・実Docker回復・全体QAの完成とはしない。②のAI再試行、既存保持物の削除・回復参照変更は行っていない。

### 10.2. 端末出力の移管単位

端末全体は、六桁の確認コード文法と上位の停止判断を含むため、一括移動しない。まずWindows出力のstream処理を`platform-access/src/terminal/output.ts`へ移す。固定`process.stdout`へ書く`writeWindowsTerminalTextOutcome`、既存結果型、1000msの定数だけをPA Rootへ公開し、任意stream、UsingStream、Boolean便利操作を公開しない。Coordinatorの既存`writeInteractiveConsoleTextOutcome`は、その結果がcleanup_unknownの場合に従来と同じthen内でpoisonしてから返す。

TTY／destroyed／writableの拒否、callback後の遅延確定、同期throw、stream error、backpressure、Timeout後の遅延error受けのlistenerを本文不変で維持する。返却時のlistener残存0を新条件にせず、Timeout後の遅延callbackで再完了しない反証を残す。上位の契約説明は現在の値を保ち、同じ公開Timeout定数を参照する。

低層の二CaseはCoordinatorの混在System SuiteからPA内のUnit Suiteへ実移動する。既存EST-ST-003との補助関係は維持するが、Unit成功をSystem義務全体の成功へ換算しない。試験専用Boolean変換はPA試験内へ移し、実装RootのAPIへ増やさない。全Oracleを維持し、上位のpoison／次Task拒否は既存Coordinatorの実子fixtureで確認する。追加の端末入力・外部AI・Docker・認証は行わない。Reader・固定子配送・Lockは本単位で変更しない。

### 10.3. Windows端末出力の結果

writerの判定本文はTimeout定数名以外を維持し、固定stdout入口から同じ処理へ接続した。Coordinatorの既存then内のpoisonと契約説明は維持し、同じ公開Timeout定数を参照する。任意streamの公開、上位へのcallback注入、追加State／Lock／回復は導入していない。

移動した低層二Caseは、QA-000009の`EST-UT-016`としてUnitの技術補助へ接続した。台帳の試験段階に合わせ、既存`EST-ST-003`の完成を代替しない。試験段階不一致を検査側で許容せず、Quality定義と実体を揃えた。新しい保持義務や製品操作を追加する項目ではない。

PAの静的確認・通常93件と局所8件が成功した。上位の関連3 Suite初回は84件中83成功、残1件はProbeのPA型専用importに対するexact期待一覧の未追従だった。型専用assertとexact一覧を追従し、上位2 Suite37件、その後の関連3 Suite全84件が成功した。判定・poison・終了条件は緩めていない。Catalog385件valid、Header・公開Root・全TestのQA接続は成功した。Checkerの既存Rust命名不合格とsandboxのlink拒否3件は別分類し、後者は同じ3件の通常権限確認が成功している。全体Checker／QAをPassとはしない。

文書検査で補助Unit追加の集約漏れを検出し、QAの外部境界段階を規定の`N/A`へ、検証項目の閉包と現在件数を199へ同期した。過去の198項目等の実測、正式Pass数、歴史Evidenceは変更しない。

再検査では今回追加した項目の段階・閉包・件数診断が解消した。参照先展開込み3,026診断でexit1を維持し、非リンク診断は既存の設計単位処置4件と設計単位・Goal関係1件が残る。品質集約の移管先へPAを追記し、限定独立再確認は残指摘0。全体文書合格とはしない。

SourceとQuality／Architectureの独立確認で、writerの旧Header誤記、QA集約表、Probe期待一覧を是正し、限定再確認の残指摘0。Reader／六桁の搬送文法、端末取得と残る四つのpoison地点、OS排他・固定子入口の移管は後続に残す。実TTY入力・AI・Docker・認証・既存保持物操作は行っていない。

### 10.4. 固定OS端末の取得・回収の移管単位

Readerの前に、固定device選択、TTY検査、sync／async callbackを囲むopen／closeをPAの`terminal/console.ts`へ移す。PA Rootは固定OS Adapterを使用する二つのOutcome操作と必要な値型だけを公開する。任意Path・任意OS Adapter・Boolean便利操作は公開しない。Coordinatorは既存入口を維持し、cleanup_unknown後のpoison、非completedのvalue非開示、同意と表示内容の判断を所有する。

発火は既存の端末利用入口に限る。検査拒否・open失敗ではcallbackを開始せず、開始後のthrow／rejectと回収不明を区別する。片方のclose失敗でも他方のcloseを試行し、async callback完了前には閉じない。実TTYの存在や終端を合成Adapter成功から推定せず、判定情報不足は既存unavailable／cleanup_unknownのまま扱う。Reader、六桁文法、子Process、IPC、排他と永続記録は変更しない。

移管する低層OracleはPA同PackageのUnitへ接続し、上位poisonと次回拒否の実子fixtureを維持する。Source・公開Root・利用側・Catalog・Symbol・ArchitectureとQA補助項目を同期し、静的確認・PA通常回帰・Coordinator関連結合と限定独立レビューで確認する。非自明な技術責務移管として既存B2の変更経路を継続し、準拠基準・外部依存・採用判断の監査は発火させない。外部AI、認証、実TTY操作、Docker操作、②保持物の操作は行わない。

取得・検査・callback待機・回収の判定本文とclose順を維持してPAへ移し、上位三入口のpoisonと非成功値の非開示を維持した。低層四CaseはPA内Unitへ移し、上位ProcessSafetyを直接参照するassertionだけを外した。上位の停止義務は既存の実子poison fixtureで確認する。Probeの合成Systemだけを局所fakeへ切り替え、実fixtureの本番接続は維持した。

PAの書式・型・Lintと通常97件、Coordinatorの型・変更範囲の書式／Lint、関連三Suite39件、Domain Catalog25件、Header・Root公開集合・全Test QA接続の三件、Runtime／Orchestratorの両対応表検査が成功した。Catalogは386件valid。初回の関連二Suiteでは型専用importのexact期待が未追従で失敗し、期待だけを現行の二型へ追従してから上記三Suiteを再実行した。成功を過去の失敗記録へ上書きしない。

SourceとQuality／Architectureの独立確認では、移管したHeaderの古い効果・Owner表記と上位poison説明を訂正し、限定再レビューは両観点とも残指摘0。API・本文・結果・close順は再レビュー修正で変更していない。Reader・六桁文法・子Process・排他は未移管であり、B2全体や実端末・外部AI・全体QAの完成は主張しない。

変更対象四文書の直接診断は0。参照先展開込み3,239診断で全体exit1を維持し、非リンク診断は既存の設計単位処置4件・設計単位とGoal関係1件だった。既存全体不合格を今回の局所成立で解消済みにはしない。②のAI再試行・保持物操作は行っていない。

### 10.5. B2残境界の完結

Readerは汎用入力へ変更せず、確認コード専用の技術搬送としてPAへ移す。先行する「六桁文法は上位」という配置説明を訂正し、六桁・UTF-8・改行・64byte上限と結果frameは搬送文法としてPA、コード生成・期待値一致・同意・許可・poisonは上位とする。文法を汎用化して子の終了値や早期拒否を変える案は採らない。既存contract／revision、512byte結果上限、110秒親待機・120秒孤児期限・500ms取消猶予は維持する。

Named PipeのWorker、Supervisor、共有状態・IPC・終了観測をPAへ移す。用途別Hash、Pipe namespace、対象と世代の検査、取得順と上位状態判断は既存Ownerに残す。PAの技術入口は既存のWindows Pipe用途と固定子だけを扱い、任意Pathや任意実行物を起動しない。Coordinatorの固定子RegistryをPAへ丸ごと移さず、三つの技術子はPA内部、回復行列の試験子は既存Scriptの自己起動へ分離する。新Registry・Lock・State・回復は追加しない。

本番はPackage Rootで接続する。低層故障注入はPA内の試験専用Adapterへ移し、既存の上位試験はその合成境界と本番入口を区別する。技術起動・取消・終了・stdout完了・親喪失と上位poison、Named Pipe競合・Worker喪失・ready往復・解放・再取得の既存Oracleを維持する。実行は外部AI・Docker・認証・対話入力を使わない自己生成試験に限定する。

### 10.6. B2完結結果と確認範囲

| 境界 | 実装Ownerと利用側 | 保持した確認 |
|---|---|---|
| OS生存・Platform観測 | PA `process/observation.ts`、Orchestratorの既存Windows Adapter | ESRCHだけ不存在、観測不能とPID世代を区別。Lease入力とProfile選択は上位 |
| Windows出力・固定端末取得 | PA `terminal/output.ts`・`console.ts`、Coordinatorの既存三入口 | callback・error・期限、全close試行・非同期保持、回収不明後のpoisonと非成功値の非開示 |
| 確認コード搬送・Reader子 | PA `terminal/input.ts`・`confirmation-reader.ts`・`reader-lifecycle.ts` | 既存の文法・入力／結果上限・孤児期限・取消と子／stdout終了。期待値一致・同意・poisonは上位 |
| 排他・固定子 | PA `lock/pipe.ts`・`lifecycle.ts`・`worker.ts`・`supervisor.ts`・`process/child.ts` | 競合、取得失敗、共有状態、IPC往復、終了不明、親喪失・解放後の再取得。用途別Hash・namespace・世代・取得順は上位 |
| 検証Tool自己起動 | 既存 `scripts/verify-recovery-matrix.ts` | 固定execPath・自己File・引数と環境を維持し、PAに試験Toolを登録しない |

Coordinator SourceはB1後105Fileから98Fileとなり、Root公開19項目は維持した。旧Reader二File・排他技術三File・固定子RegistryとOS観測Fileは撤去し、PAから上位Sourceへの依存を追加していない。共有メモリと子環境生成もPAへ閉じ、上位には対象と要求の導出だけを残した。新しい永続State・Registry・Lock・回復は作っていない。

独立確認で試験用再exportが私有境界を迂回していた点を検出し、bridgeは削除した。Reader低層五Caseとfixture／harness、Lock低層十五Caseと技術fixtureをPA内へ実移管した。上位の入力拒否Caseは要求生成の直接assertへ、受理した境界待機値のready／releaseはPAの追加一Caseへ分担し、故障Oracleを削減していない。上位のnamespace・世代・poison・本番Root接続は既存試験へ残す。Recovery fixture内のSupervisor Pathは既存exact argv監視用であり、私有起動入口ではない。

固定候補のPA静的確認・通常121件、Orchestrator型・Unit67件、台帳25件、Header／公開Root／全Test QA接続三件、両設計対応表検査は成功。Catalog388件valid、移管Symbolの重複・実Path欠落・新規参照未解決は0だった。上位の最終関連八Suiteは125件中124成功・symlink作成EPERM一件で、同一一件の通常権限再実行は成功した。単一runの全成功へ書き換えない。

Sourceの独立確認は移管本文と上位判断の保持を照合し、Headerの誤ったEffect説明を訂正後に残指摘0。Quality側は試験実移管と、実検証対象へのSymbol接続を訂正し残指摘0。低層の登録から上位全体の完成や正式QA全項目Passを推定しない。

追加のCoordinator通常全回帰は最後まで実行し、exit 1だった。検証環境のsymlink作成拒否、保護された一時記録のrename拒否、Host選択ユーザー観測不能を含む失敗を確認した。安全検査を緩めず、関連する保存・Repository操作・Workspace・Catalog接続・検証結果保存の五Suiteを通常権限で再実行し46件すべて成功、coverage出力境界・doctor・Operation生成の三Suiteも18件すべて成功した。別途同じalias一件の通常権限確認も成功した。元の広域runを全成功へ書き換えず、B2の最終関連125件とこれらの環境切分けを区別する。広域run開始後の試験配置・Header訂正を含む単一固定版の全回帰成功とは主張しない。

今回変更した文書の直接診断は0。参照先展開込みの文書検査は3,269診断でexit 1を維持し、非リンク診断は既存の設計単位処置四件・設計単位とGoal関係一件だった。完結記録と現在投影の二文書を最終更新後に再検査し、直接診断0、参照展開25診断・同じ非リンク五件を確認した。検査範囲の異なる件数を削減効果とは扱わない。歴史Evidenceの改名、全体QAのPass化は行わない。

B2の予定範囲は、技術Owner・本番Root接続・既存Oracleの移管・関連回帰・独立確認まで完了した。残るB3はAI AdapterとDIの計画・実行境界、B4はGit／Repository観測と借用Treeの接続、B5はWorkbench助言の共通Task接続と全利用側の閉包であり、B2へ拡張しない。外部AI・Docker操作・認証・対話入力・②保持物の削除や回復参照変更は行っていない。作業ブランチへのCommit・Pushは、採用・最終統合・Release判断とは区別する。

## 11. B3〜B5の着手前照合

基準版は`3665d89bb7711486a914fdab9738ee06452cbc55`。二つの読取り専用確認は、既存専門API接続を再実装せず、残る技術重複と中継だけを整理する方針で一致した。

| 単位 | 今回変える箇所 | 変えない意味・確認先 |
|---|---|---|
| B3 | Docker構成の再生成・固定command全数一致の照合をDI既存`execution/plan.ts`へ集約 | CLI／Envelopeは既存AI API。Operation／Selection／Packet Hash・Model／Offering受理・回復相関は上位。DI plan、Provider計画・Controller・取消／cleanup試験 |
| B4 | Workspaceの安定File読取り・容量制限付きinventoryをVCのWorkspace観測へ移管 | 借用開始時dirty、未追跡、削除、Path・case・link・hardlink・深さ・容量の拒否順を保持。Task／許可Path／Secret／Capability／内容投影は上位。実Git・借用Tree／VC回帰 |
| B5 | Workbench助言のProvider Adapterと実行結果中継を統合し、既存の共通Task受付から単一実行入口を組み立てる | 助言に編集・Candidate・Reviewerを追加しない。Profile／Hash・固定Context・参照制限・一回送信・事前取消・例外Effect不明・cleanup不明・元Host参照を保持。助言UT／IT、Orchestrator受付、Workbench／MCP接続 |

発火は既存の実行／観測入口のみ。不正Profile・構成差・失効・開始前取消では後続Effectを拒否する。実行中取消・通知欠測・回収不明を成功へ補完せず、元参照を保持する。比較が同値の局所移管では新しい永続形式・Registry・Lock・回復管理を導入しない。実AI・Docker操作・認証・保持中②の操作は実施しない。

専門Packageへの丸移動と、助言を編集Taskへそのまま変換する代替は、上位Authorityの逆流または追加送信を生むため採らない。Source・Architecture・Quality・公開入口・既存試験の対応を固定して独立レビューする。設定／公開Protocol／永続契約を変える必要が生じた場合は停止する。

## 12. B3〜B5の実装・確認

| 単位 | 実装結果 | 既存能力の対応 |
|---|---|---|
| B3 | DIの既存planへ`dockerIsolationCommandsMatch`を移管。上位の重複した全command比較を撤去 | 生成と照合で同じ用途・順序・全argvを使う。Model／Offering・Task／助言Hash・私有Ownerと上位計画Hashは上位に維持。既に接続済みのAI CLI生成・Envelope抽出とDI Sessionを再実装しない |
| B4 | VC `workspace/observation.ts`へ安定読取り・inventory・同じPath文法を移管し、Rootから四項目を公開 | 既存dirty・未追跡・削除・容量・link・hardlink・深さ・途中差を保持。上位はAlias接続以外の許可Path・Secret・Capability・レビュー投影の本文不変。新しいGit操作や保存は追加しない |
| B5 | `advice-provider-executor.ts`を撤去し、Profile／Plan検査と一回Runtime呼出し・結果受理を既存`provider-adapter.ts`へ統合 | Orchestratorの共通Task受付は単一Runtimeを直接注入。重複Provider関数表とExecutor Factoryの外部組立てを撤去。四つのLifecycle Oracleを統合後Adapterへ接続し、試験を`provider-adapter-execution.contract.test.ts`へ改名。助言専用Context／Schema／PacketとHost相関は意味のある上位契約として保持 |

公開通信・永続Schema・回復参照は変更していない。Coordinator Root19項目は不変、Sourceは98→97 File。VCの追加公開は読取り技術四項目、DIの追加公開は既存command照合一操作だけであり、汎用Framework・Registry・State・Lockを作っていない。通常の外部AI実行・Docker操作・認証・保持中②の操作は行っていない。

| 今回の確認 | 結果と限界 |
|---|---|
| Provider計画・助言・Repository／Workspaceの関連結合 | 109件成功。固定Profile・Packet・開始前取消・例外Effect不明・cleanup不明・dirtyとレビュー投影を確認 |
| Controller／技術実行／Taskの共通接続 | 270件成功。合成依存で要求・通知・取消・一次失敗・同参照と回収を反証。実Provider／Docker成功ではない |
| DI通常全回帰 | 初回305件中299成功・公開期待一覧の追従漏れ一件・明示対象外五件。期待一覧訂正後の局所16件成功、通常全回帰は305件中300成功・失敗0・明示対象外五件。元失敗は上書きしない |
| VC通常全回帰 | 64件中63成功・Architecture公開一覧の追従漏れ一件。公開一覧追従後の閉包12件成功。実Git・dirty・Worktree／Ref回収の63成功と別runの補完を区別 |
| Workbench／MCP利用側 | Workbench14件・MCP21件成功。WB初回のlocalhost接続EACCES三件は通常権限の同じ二Suiteで14件成功。外部通信やAI再試行ではない |
| Orchestratorの単発状態・Workspace結合 | 二Suite20件成功。実Git／Writerで直列Task、明示採否、保存失敗、別Process再入場、元参照、Direct途中失敗とMCPへのWorkspace観測まで確認。実行時間は約8分28秒 |
| 静的・台帳・対応表 | DI／VC check、Coordinator／Orchestrator／Workbench／MCP型、変更Source Lint、Production Header／全Test QA接続成功。Catalog388件valid。Symbol重複・実Path欠落・未解決参照0。Runtime／Orchestrator両対応表accepted |
| 文書検査 | 変更六文書の直接診断0。参照先展開込み3,558診断でexit 1。非リンクは既存の設計単位処置四件・設計単位とGoal関係一件。全体文書／正式QAのPassへ変換しない |
| 独立レビュー | SourceとArchitecture／Qualityの両観点で機能・Oracleの後退指摘なし。旧FactoryのHeader説明・borrowed条件をコメントだけ訂正し、限定再確認は両方残指摘0 |

B3〜B5は予定した責務移管・本番利用側・合成反証回帰・独立レビューまで完了した。B系列の作業範囲を閉じるが、旧Coordinatorの撤去・Package統合はCとして残る。BrowserのDOM・CSS・公開DTOは変更していないため新しいVisual評価を追加せず、既存Browser未確定故障と正式E2Eは別の残件として維持する。作業ブランチへのCommit・Pushは最終統合・Release判断とは区別する。

### Cへ渡す残存責務

以下は現在実在する97 Source Fileの閉集合であり、97 Fileすべてを丸ごと移動する指示ではない。技術重複を再実装せず、意味・保存・私有CapabilityのOwner単位で現Orchestratorへ統合し、専門Package呼出しだけを維持する。

| 現Folder | File数 | 残す意味・Cでの処置 |
|---|---:|---|
| `provider`・`task` | 25＋12 | 選定・準備／一回消費・実行順・開始／結果受領・取消・同じ回復参照。技術はAI／DI／PAへ接続済み。上位の実行調整を統合 |
| `workbench-ai` | 9 | 固定Context・助言Schema／Packet、非共有・Host相関と用途別結果。共通Task受付を維持し、意味のない再export中継を作らない |
| `authority`・`external-send` | 8＋4 | 現在の実行許可・外部送信同意・Secret区分。Access Managementの利用者認可へ混同しない |
| `host-execution`・`state-storage`・`platform-access`・`repository-operation` | 11＋5＋2＋6 | Owner世代・poison・耐久受領・保存と再入場・Repository結合。OS排他と観測はPA、Git／実Tree読取りはVC。上位のAtomic境界を分断しない |
| `cli`・`diagnostics`・Root | 7＋7＋1 | 公開受付・非秘密表示・専門診断の集約と公開API。単一bin・現行入力・利用側・起動Pathを統合先へ追従 |

CのPackage統合・改名、DのDomain Model最終整理、正式QA・未実施実境界は本節の局所回帰とは別である。保持中②のunknownを成功化せず、再試行・削除は別判断を維持する。


## 13. C前のCoordinator事前整理

基準版は`923743ba1d0a8533b1a21c397416bbcfdab9ae5c`。人間提示の事前リファクタリング方針を採用し、Cの改名・統合より先に、既存97 Sourceの不要中継・技術Owner・保存保証を確認する。目標Treeは配置の結論ではなく責務上の目安とし、保存・回復を無理に`execution/`または`external-send/`へ押し込まない。

| 順序 | 変更と確認 | 保持する境界 |
|---|---|---|
| P0 CLI | `bin/coordinator.ts`を薄い入口とし、`cli/command.ts`へ起動用途と通常Commandの受付を統合、`cli/launch.ts`を撤去 | importだけでは起動しない。直Taskとtemplateの上位Task、Node拒否、二種類のhelp、TTY、argv・stdin・同一Process、固定Script配送と例外秘匿を維持 |
| 実行・助言 | Provider／Task／Workbenchの実際のConsumerと共通実行境界を確認し、重複のみ削減 | 助言固有Context・Schemaと編集／レビューの順序、取消join、一次失敗とcleanup不明、同じ回復参照を維持 |
| P0 保存・回復 | Writer／Reader、保存確定単位、Lease取得順、再入場と配送を対応付けてから配置判断 | 原子的保存・poison・unknown・受付世代・一回Grantを維持。Orchestrator進行状態と技術Settlementを同じ情報とみなさない |
| Authority・Host・Repository・診断 | 既存専門APIへの委譲と上位意味を区別 | 技術搬送は専門Owner、用途Hash・namespace・許可・失効・次回拒否は上位。新State／Lock／Frameworkを作らない |
| 固定候補 | 97 File全数のKeep／Merge／Move／Delete／Pendingと利用側・試験を確定 | Cへ影響するPendingは解消してからCへ進む。過去Evidenceは改名しない |

変更分類は既存Capabilityの責務整理であり、新しい実行許可・公開契約・永続Schemaは追加しない。Source、設計、台帳、配布入口と利用側を同期し、限定回帰と独立Source／Quality確認を行う。準拠基準・Release・外部依存の有効化は変更しないため今回の監査対象外。着手前のSourceとQuality二観点は統合済みで、現時点で追加の人間判断は不要。保存形式または既存unknownの終了条件変更が必要なら実装前に停止する。

外部AI、実Docker操作、認証、②の再試行・保持物操作は対象外。Cの新Coordinator構成は将来の移管先として参照するだけで、この整理の途中成立をC完了と表示しない。


### 13.1. 基準版97 Sourceの全数処置対応

基準版の全数を固定する。Keepは現在の保証Ownerを維持する判断であり、C後も旧Folder名を残す判断ではない。初回照合時点ではPending三件を未削除で保持した。その後の処置は13.4節以降へ記録し、基準表を現在Treeと混同しない。Consumer欄は初回照合Treeの相対import／dynamic importを読取り抽出した直接参照であり、Root経由・文字列参照・実行時注入の完全性証明ではない。これらは既存のCatalog、Symbol、実子試験と固定候補前に再照合する。試験数はSuite数の主張ではなく直接参照File数。

| 基準Source | 処置 | 保持する責務・保証または未確定理由 | 直接利用側（`40_Develop/`を省略） |
|---|---|---|---|
| `authority/file-bundle.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/authority/prelaunch-verifier.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 2） |
| `authority/grant-verifier.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/authority/prelaunch-verifier.ts`<br>`coordinator/src/authority/trust-loader.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 4） |
| `authority/local-personal-grant.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/provider/authority-grant.ts`（直接試験 2） |
| `authority/prelaunch-verifier.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/diagnostics/doctor.ts`<br>`coordinator/src/provider/authority-grant.ts`（直接試験 2） |
| `authority/root-path-lexical.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/platform-access/protected-root-windows-adapter.ts`<br>`coordinator/src/provider/home-windows-adapter.ts`<br>`coordinator/src/provider/home.ts`（直接試験 2） |
| `authority/runtime-trust.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | 本番の直接importなし（直接試験 1） |
| `authority/secret-material-policy.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/external-send/grant.ts`<br>`coordinator/src/provider/task-packet.ts`<br>`coordinator/src/repository-operation/workspace.ts`<br>`coordinator/src/task/request.ts`<br>`coordinator/src/workbench-ai/advice-task.ts`<br>`orchestrator/src/workspace/commands.ts`（直接試験 3） |
| `authority/trust-loader.ts` | Keep | 許可・失効・秘密投影の上位判断。汎用PAへ移さない | `coordinator/src/authority/file-bundle.ts`<br>`coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 3） |
| `cli/command-report.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/src/cli/command.ts`<br>`orchestrator/src/cli/command.ts`（直接試験 3） |
| `cli/command.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/bin/coordinator.ts`<br>`template/tools/crdd-coordinator.ts`（直接試験 1） |
| `cli/interactive-console.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/src/external-send/grant.ts`（直接試験 4） |
| `cli/launch.ts` | Merge → cli/command.ts | 起動判定と固定配送の正本を統合（今回実装） | 本番の直接importなし（直接試験 0） |
| `cli/options.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/src/cli/command.ts`（直接試験 3） |
| `cli/request-input.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/src/cli/command.ts`<br>`orchestrator/src/cli/command.ts`（直接試験 1） |
| `cli/task-cancellation.ts` | Keep | 受付・引数・取消・表示。CLI内で意味ごとに維持 | `coordinator/src/cli/command.ts`<br>`orchestrator/src/cli/command.ts`（直接試験 4） |
| `diagnostics/development-execution-timing.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/src/task/development-measurement-session.ts`<br>`coordinator/src/task/execution.ts`（直接試験 2） |
| `diagnostics/docker-recovery-command-report.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/src/cli/command.ts`（直接試験 3） |
| `diagnostics/doctor.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/src/cli/command.ts`（直接試験 1） |
| `diagnostics/isolation-probe.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`<br>`coordinator/scripts/verify-dynamic-fake-provider-failures.ts`<br>`coordinator/scripts/verify-recovery-matrix.ts`<br>`coordinator/src/cli/command.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 3） |
| `diagnostics/release-identity-grammar.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/scripts/orchestrator-real-provider-contract.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/verify-reviewer-boundary.ts`<br>`coordinator/scripts/verify-route-matrix.ts`<br>`coordinator/src/repository-operation/binding.ts`（直接試験 1） |
| `diagnostics/runtime-repair.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/src/cli/command.ts`（直接試験 3） |
| `diagnostics/runtime-restart.ts` | Keep | 明示診断・回復の公開結果と許可接続 | `coordinator/src/cli/command.ts`（直接試験 2） |
| `external-send/consent-record.ts` | Keep | 同意・scope・一回Grant。Cではdecisionへ直接移す | `coordinator/src/external-send/consent-store.ts`（直接試験 0） |
| `external-send/consent-store.ts` | Keep | 同意・scope・一回Grant。Cではdecisionへ直接移す | `coordinator/scripts/revoke-external-send-consent.ts`<br>`coordinator/src/external-send/grant.ts`（直接試験 1） |
| `external-send/grant.ts` | Keep | 同意・scope・一回Grant。Cではdecisionへ直接移す | `coordinator/src/provider/task-packet.ts`<br>`coordinator/src/task/execution.ts`（直接試験 6） |
| `external-send/policy.ts` | Keep | 同意・scope・一回Grant。Cではdecisionへ直接移す | `coordinator/src/external-send/consent-store.ts`<br>`coordinator/src/external-send/grant.ts`<br>`coordinator/src/index.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/repository-composition.ts`（直接試験 2） |
| `host-execution/generation-loss-transition.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/src/host-execution/operation-workspace-lifecycle.ts`（直接試験 1） |
| `host-execution/kernel-lock.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/src/external-send/consent-store.ts`<br>`coordinator/src/external-send/grant.ts`<br>`coordinator/src/host-execution/operation-workspace-lifecycle.ts`<br>`coordinator/src/index.ts`<br>`coordinator/src/provider/claude-subscription-authentication.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/recovery.ts`<br>`orchestrator/src/storage/protected-decision.ts`（直接試験 17） |
| `host-execution/node-runtime-version.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/scripts/measure-development-providers.ts`<br>`coordinator/scripts/verification-result-record.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/verify-recovery-matrix.ts`<br>`coordinator/src/cli/command.ts`<br>`coordinator/src/diagnostics/doctor.ts`<br>`coordinator/src/index.ts`<br>`template/tools/crdd-coordinator.ts`（直接試験 2） |
| `host-execution/operation-lease-lifecycle.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/src/host-execution/terminal-caller-lease.ts`（直接試験 1） |
| `host-execution/operation-workspace-lifecycle.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`<br>`coordinator/scripts/verify-dynamic-fake-provider-failures.ts`<br>`coordinator/scripts/verify-recovery-matrix.ts`<br>`coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/cli/command.ts`<br>`coordinator/src/diagnostics/doctor.ts`<br>`coordinator/src/diagnostics/isolation-probe.ts`<br>`coordinator/src/external-send/grant.ts`<br>`coordinator/src/external-send/policy.ts`<br>`coordinator/src/provider/authority-grant.ts`<br>`coordinator/src/provider/delegation-selection-grant.ts`<br>`coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/provider/execution-types.ts`<br>`coordinator/src/provider/home-mount-authorization.ts`<br>`coordinator/src/provider/isolation-execution.ts`<br>`coordinator/src/provider/task-packet.ts`<br>`coordinator/src/repository-operation/binding.ts`<br>`coordinator/src/repository-operation/borrowed-workspace.ts`<br>`coordinator/src/repository-operation/create.ts`<br>`coordinator/src/repository-operation/workspace.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/development-measurement-session.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/recovery.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 16） |
| `host-execution/orphan-recovery-policy.ts` | Keep | 上位の世代・所有権・poisonと再入場 | 本番の直接importなし（直接試験 1） |
| `host-execution/process-safety-state.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/verify-reviewer-boundary.ts`<br>`coordinator/scripts/verify-route-matrix.ts`<br>`coordinator/src/cli/interactive-console.ts`<br>`coordinator/src/external-send/grant.ts`<br>`coordinator/src/host-execution/operation-workspace-lifecycle.ts`<br>`coordinator/src/index.ts`<br>`coordinator/src/task/development-measurement-session.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 8） |
| `host-execution/recovery-record.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/scripts/verification-result-record.ts`<br>`coordinator/src/diagnostics/isolation-probe.ts`<br>`coordinator/src/host-execution/operation-workspace-lifecycle.ts`<br>`coordinator/src/state-storage/model.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/recovery.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 8） |
| `host-execution/terminal-caller-checkpoint.ts` | Keep | 上位の世代・所有権・poisonと再入場 | 本番の直接importなし（直接試験 2） |
| `host-execution/terminal-caller-lease.ts` | Pending | 用途Hashは上位、実named pipeの搬送はPA移管候補。Leaseの後着・解放不明を分断しない | `coordinator/src/host-execution/terminal-caller-checkpoint.ts`（直接試験 1） |
| `host-execution/terminal-record.ts` | Keep | 上位の世代・所有権・poisonと再入場 | `coordinator/src/host-execution/terminal-caller-checkpoint.ts`（直接試験 2） |
| `index.ts` | Keep | Package公開Root。内部Fileの一括公開は追加しない | `orchestrator/src/objective/plan.ts`<br>`orchestrator/src/objective/public-operation.ts`<br>`orchestrator/src/storage/current-state.ts`<br>`orchestrator/src/task/dispatch.ts`<br>`orchestrator/src/task/execute-attempt.ts`<br>`orchestrator/src/task/execution-contract.ts`<br>`orchestrator/src/task/executor.ts`<br>`orchestrator/src/task/host-adapter.ts`<br>`orchestrator/src/task/request-composition.ts`<br>`orchestrator/src/task/requests.ts`<br>`workbench-server/scripts/verify-readonly-ai.ts`<br>`workbench-server/scripts/verify-workspace-ai.ts`<br>`workbench-server/src/client/components/ai-request-panel.tsx`<br>`workbench-server/src/server/ai-request/types.ts`<br>`workbench-server/src/server/routes/repository-view.ts`<br>`workbench-server/src/server/routes/shared-view.ts`<br>`workbench-server/src/shared/view/types.ts`<br>`template/tools/crdd-mcp-server.ts`（直接試験 3） |
| `platform-access/adapter.ts` | Keep | 専門PAを呼ぶ用途限定の上位Adapter | `coordinator/src/repository-operation/root-observation.ts`（直接試験 1） |
| `platform-access/protected-root-windows-adapter.ts` | Keep | 専門PAを呼ぶ用途限定の上位Adapter | `coordinator/src/external-send/consent-store.ts`<br>`orchestrator/src/storage/protected-decision.ts`（直接試験 4） |
| `provider/authority-grant.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/provider/execution-controller.ts`（直接試験 2） |
| `provider/claude-docker-adapter.ts` | Pending | 固定Provider中継。共通Adapterの本番・試験Consumerと契約値を照合後、削減可否を確定 | `coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 3） |
| `provider/claude-subscription-authentication.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/scripts/authenticate-claude-subscription.ts`（直接試験 6） |
| `provider/codex-docker-adapter.ts` | Pending | 固定Provider中継。共通Adapterの本番・試験Consumerと契約値を照合後、削減可否を確定 | `coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 2） |
| `provider/delegation-route-selection.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/delegation-selection-grant.ts`（直接試験 3） |
| `provider/delegation-selection-grant.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 6） |
| `provider/eligibility-observation.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/delegation-selection-grant.ts`（直接試験 1） |
| `provider/execution-adapter.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/claude-docker-adapter.ts`<br>`coordinator/src/provider/codex-docker-adapter.ts`<br>`coordinator/src/task/execution.ts`（直接試験 1） |
| `provider/execution-composition.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-adapter.ts`（直接試験 2） |
| `provider/execution-controller.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/attempt.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/recovery.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 5） |
| `provider/execution-plan.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-adapter.ts`（直接試験 0） |
| `provider/execution-result-reasons.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/scripts/orchestrator-real-provider-contract.ts`<br>`coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/state-storage/model.ts`<br>`coordinator/src/task/result-reasons.ts`（直接試験 2） |
| `provider/execution-types.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/claude-docker-adapter.ts`<br>`coordinator/src/provider/codex-docker-adapter.ts`<br>`coordinator/src/provider/execution-adapter.ts`<br>`coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/provider/execution-plan.ts`<br>`coordinator/src/provider/preparation-lifecycle.ts`<br>`coordinator/src/provider/preparation.ts`（直接試験 0） |
| `provider/home-mount-authorization.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/authority-grant.ts`<br>`coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/provider/home.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 3） |
| `provider/home-mount-grant.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/authority/grant-verifier.ts`<br>`coordinator/src/authority/prelaunch-verifier.ts`<br>`coordinator/src/provider/home-mount-authorization.ts`<br>`coordinator/src/provider/home.ts`<br>`coordinator/src/provider/lifecycle.ts`（直接試験 2） |
| `provider/home-windows-adapter.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/scripts/authenticate-claude-subscription.ts`<br>`coordinator/src/provider/home-mount-authorization.ts`<br>`coordinator/src/provider/home.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/recovery.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`<br>`orchestrator/src/platform/windows-adapter.ts`（直接試験 7） |
| `provider/home.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/lifecycle.ts`（直接試験 1） |
| `provider/isolation-execution.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/state-storage/settlement-store.ts`（直接試験 4） |
| `provider/isolation-profile.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/authority/file-bundle.ts`<br>`coordinator/src/authority/grant-verifier.ts`<br>`coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/authority/prelaunch-verifier.ts`<br>`coordinator/src/authority/trust-loader.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 7） |
| `provider/lifecycle.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/diagnostics/doctor.ts`（直接試験 1） |
| `provider/model-selection.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/delegation-route-selection.ts`<br>`coordinator/src/provider/execution-plan.ts`（直接試験 1） |
| `provider/preparation-lifecycle.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/claude-docker-adapter.ts`<br>`coordinator/src/provider/codex-docker-adapter.ts`<br>`coordinator/src/provider/execution-adapter.ts`（直接試験 1） |
| `provider/preparation.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-adapter.ts`（直接試験 1） |
| `provider/task-packet.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/task/execution.ts`（直接試験 1） |
| `provider/task-structured-result.ts` | Keep | 共通AI／DI APIを結合する許可・実行調整 | `coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/provider/task-packet.ts`（直接試験 2） |
| `repository-operation/binding.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/scripts/orchestrator-real-provider-contract.ts`<br>`coordinator/scripts/verification-result-record.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/verify-orchestrator-real-providers.ts`<br>`coordinator/src/diagnostics/doctor.ts`<br>`coordinator/src/diagnostics/runtime-repair.ts`<br>`coordinator/src/external-send/grant.ts`<br>`coordinator/src/external-send/policy.ts`<br>`coordinator/src/provider/delegation-selection-grant.ts`<br>`coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/repository-operation/borrowed-workspace.ts`<br>`coordinator/src/repository-operation/workspace.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/development-measurement-session.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/recovery.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`<br>`orchestrator/src/decision/public-acceptance.ts`<br>`orchestrator/src/objective/public-operation.ts`<br>`orchestrator/src/state/public-query.ts`（直接試験 13） |
| `repository-operation/borrowed-workspace.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/workspace-task-fixture.ts`<br>`coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/repository-operation/workspace.ts`<br>`coordinator/src/task/attempt.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/types.ts`（直接試験 1） |
| `repository-operation/create.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/src/diagnostics/doctor.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 2） |
| `repository-operation/root-observation.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/src/repository-operation/root-protection-policy.ts`<br>`orchestrator/src/platform/windows-adapter.ts`（直接試験 2） |
| `repository-operation/root-protection-policy.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/src/authority/file-bundle.ts`<br>`coordinator/src/diagnostics/doctor.ts`（直接試験 1） |
| `repository-operation/workspace.ts` | Keep | 借用・dirty・許可範囲・Operation生成の上位意味 | `coordinator/src/task/execution.ts`（直接試験 1） |
| `state-storage/docker-recovery-journal.ts` | Keep | 技術Settlementの保存契約。確定単位を保ちstorageへ配置候補 | `coordinator/src/external-send/consent-store.ts`<br>`orchestrator/src/storage/protected-decision.ts`（直接試験 4） |
| `state-storage/model.ts` | Keep | 技術Settlementの保存契約。確定単位を保ちstorageへ配置候補 | `coordinator/src/diagnostics/runtime-repair.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/recovery.ts`（直接試験 14） |
| `state-storage/recovery-identity.ts` | Keep | 技術Settlementの保存契約。確定単位を保ちstorageへ配置候補 | `coordinator/src/cli/options.ts`<br>`coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/state-storage/model.ts`<br>`coordinator/src/state-storage/restart-checkpoint.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/recovery-projection.ts`<br>`coordinator/src/task/recovery.ts`（直接試験 1） |
| `state-storage/restart-checkpoint.ts` | Keep | 技術Settlementの保存契約。確定単位を保ちstorageへ配置候補 | `coordinator/src/diagnostics/runtime-restart.ts`<br>`coordinator/src/state-storage/model.ts`<br>`coordinator/src/state-storage/settlement-store.ts`<br>`coordinator/src/task/recovery.ts`（直接試験 7） |
| `state-storage/settlement-store.ts` | Keep | 技術Settlementの保存契約。確定単位を保ちstorageへ配置候補 | `coordinator/src/cli/command.ts`<br>`coordinator/src/diagnostics/runtime-repair.ts`<br>`coordinator/src/index.ts`<br>`coordinator/src/task/recovery.ts`<br>`orchestrator/src/task/settle-docker-recovery.ts`（直接試験 9） |
| `task/attempt.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/index.ts`（直接試験 1） |
| `task/cleanup-eligibility.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/task/execution.ts`（直接試験 1） |
| `task/completion-observation.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/task/attempt.ts`（直接試験 1） |
| `task/development-measurement-constraints.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/task/development-measurement-session.ts`（直接試験 2） |
| `task/development-measurement-session.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/scripts/measure-development-providers.ts`<br>`coordinator/src/authority/local-personal-grant.ts`<br>`coordinator/src/external-send/consent-store.ts`<br>`coordinator/src/host-execution/terminal-caller-checkpoint.ts`<br>`coordinator/src/platform-access/protected-root-windows-adapter.ts`<br>`coordinator/src/provider/home-windows-adapter.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/task/recovery.ts`（直接試験 3） |
| `task/development-source-observation.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/scripts/measure-development-providers.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`coordinator/scripts/verify-orchestrator-real-providers.ts`<br>`coordinator/src/task/development-measurement-session.ts`<br>`workbench-server/scripts/verify-workspace-ai.ts`（直接試験 2） |
| `task/execution.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/scripts/measure-development-providers.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`orchestrator/src/objective/public-operation.ts`<br>`orchestrator/src/task/request-composition.ts`（直接試験 11） |
| `task/recovery-projection.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/task/execution.ts`（直接試験 2） |
| `task/recovery.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/cli/command.ts`<br>`coordinator/src/diagnostics/runtime-restart.ts`<br>`coordinator/src/index.ts`<br>`coordinator/src/provider/execution-controller.ts`<br>`coordinator/src/provider/isolation-execution.ts`<br>`coordinator/src/task/execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 6） |
| `task/request.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/task/development-measurement-session.ts`<br>`coordinator/src/task/execution.ts`（直接試験 2） |
| `task/result-reasons.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/scripts/verification-result-record.ts`<br>`coordinator/scripts/verify-general-task.ts`<br>`coordinator/src/task/execution.ts`（直接試験 3） |
| `task/types.ts` | Keep | 単発実行・結果・回復の上位調整 | `coordinator/src/index.ts`<br>`coordinator/src/repository-operation/workspace.ts`<br>`coordinator/src/task/attempt.ts`<br>`coordinator/src/task/completion-observation.ts`（直接試験 0） |
| `workbench-ai/advice-contract.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/workbench-ai/advice-dispatch.ts`<br>`coordinator/src/workbench-ai/repository-composition.ts`（直接試験 0） |
| `workbench-ai/advice-dispatch.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/workbench-ai/provider-adapter.ts`<br>`orchestrator/src/task/request-composition.ts`（直接試験 3） |
| `workbench-ai/advice-execution-plan.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/provider/isolation-execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`<br>`coordinator/src/workbench-ai/advice-packet.ts`<br>`coordinator/src/workbench-ai/provider-adapter.ts`（直接試験 10） |
| `workbench-ai/advice-execution.ts` | Keep | 助言固有Contextと共通実行の接続 | `orchestrator/src/task/request-composition.ts`（直接試験 1） |
| `workbench-ai/advice-packet.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/provider/execution-adapter.ts`<br>`coordinator/src/provider/execution-composition.ts`<br>`coordinator/src/provider/execution-plan.ts`<br>`coordinator/src/provider/execution-types.ts`<br>`coordinator/src/provider/isolation-execution.ts`<br>`coordinator/src/workbench-ai/advice-execution.ts`（直接試験 2） |
| `workbench-ai/advice-result.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/provider/isolation-execution.ts`<br>`coordinator/src/workbench-ai/advice-dispatch.ts`<br>`coordinator/src/workbench-ai/advice-execution-plan.ts`<br>`coordinator/src/workbench-ai/advice-task.ts`（直接試験 6） |
| `workbench-ai/advice-task.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/workbench-ai/advice-dispatch.ts`<br>`coordinator/src/workbench-ai/repository-composition.ts`（直接試験 4） |
| `workbench-ai/provider-adapter.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/workbench-ai/advice-execution.ts`<br>`orchestrator/src/task/request-composition.ts`（直接試験 3） |
| `workbench-ai/repository-composition.ts` | Keep | 助言固有Contextと共通実行の接続 | `coordinator/src/workbench-ai/advice-dispatch.ts`<br>`orchestrator/src/task/request-composition.ts`（直接試験 2） |

### 13.2. 保存・回復の配置を決める前の保証単位

| 保証単位 | 現在Owner／Consumer | 処置と反証先 |
|---|---|---|
| 技術Settlementの現在値と配送 | `state-storage/settlement-store.ts`・`model.ts`、Task／回復／Host Writer | Keep。Orchestrator進行状態とは別正本。配送受付をcleanup完了へ混同しない。`orchestrator-durable-foundation`／`current-recovery-resources` |
| Journalの確定と再入場 | `docker-recovery-journal.ts`、Orchestrator `storage/protected-decision.ts`も直接Consumer | Keep。commit側car、pending／move／delete intent、fsync→rename順を一組で維持。`docker-recovery-journal`／`docker-recovery-owner-reentry` |
| Recovery IDと再起動値 | `recovery-identity.ts`・`restart-checkpoint.ts` | Keep。受付・Effect不明・一次結果・cleanupの相関と永続ID文法を維持 |
| Host記録とcaller保存 | `host-execution/recovery-record.ts`・`terminal-record.ts`・`terminal-caller-checkpoint.ts` | Keep。対象・世代・正規bytes・同参照・caller側確定を一組で確認。`host-terminal-caller-checkpoint` |
| Leaseと世代失効 | `terminal-caller-lease.ts`・`operation-lease-lifecycle.ts`・`generation-loss-transition.ts`・`process-safety-state.ts` | 用途namespace・取得順・poisonは上位。搬送移管で後着取得・socket終端・解放不明を削減しない |

新しい保存単位、State、Registry、Lockは追加しない。今回の表は処置の追跡であり、未実施の故障注入・実境界確認を完了とは扱わない。

### 13.3. CLI受付整理の実装・確認

`bin/coordinator.ts`は`runCoordinatorCommand`を一回待機する入口へ縮小した。`cli/command.ts`が起動用途・通常Command・固定Script配送を所有し、`cli/launch.ts`を撤去した。Sourceは97→96 File。Package Rootの公開19項目、通信・永続Schema・回復Identity・専門処理の本文は変更していない。

templateは同じ受付の純粋判定を参照し、Task／projectの既存上位接続を維持する。実装Moduleのimportだけでは通常操作を開始しない。直Commandのmain guardと、特殊配送先のargv1を維持した。試験の合成handlerは配送値の観測だけに使い、製品へ試験用hookを追加していない。

| 確認 | 結果・限界 |
|---|---|
| 起動、CLI引数、旧署名退役、回復CLI、対話境界の五Suite | 最終固定版56件成功。実子のliteral argv・PID・stdin・cwd・終了値、import-only、既存回復結果・取消の合成反証を維持。実Docker／認証／外部AIの成功ではない |
| 初回拡張回帰と是正 | 56件中54成功・本文抽出境界の追従漏れ二件。関数化後の位置へ試験だけを追従し、上記五Suiteを再実行。元の失敗を成功へ上書きしない |
| 型・Lint・書式 | CoordinatorのSource／Test型、変更したCLI六FileのLintと書式一致を確認。BiomeのFile直接書込みはWindowsのmapped section拒否となったため、同じformatterの標準入力出力をapply_patchで適用して一致確認 |
| Header・公開Root・全Test QA接続 | 三項目成功。先行B4のVC公開`workspace/observation.ts`が期待集合に未反映だったため一行追従。新API追加や検査条件緩和はしていない |
| 台帳・Symbol | Catalog388件valid。全Package SymbolのID重複・Path欠落・verifies参照未解決0。launch検証の対象はcommandへ移した |
| 文書検査 | 変更四文書の直接診断0。参照先展開込み3,278診断でexit 1。既存のリンク／アンカー不整合と設計単位処置の不合格を含み、全体文書Passは主張しない。検査後の本節追記は結果の記録のみ |
| 独立確認 | Sourceは実argv観測の不足一件を指摘・是正後に残指摘0。計画97件の全数、設計・QA・現在投影・Symbolの限定確認も残指摘0。正式QA全体のPassではない |

事前整理全体は未完了。次はPending三件の実Consumerに基づく処置確定、実行・助言・Authority／Hostの残存責務の整理と、保存／回復の確定単位を保った配置の確定へ進む。Keepの表だけで詳細移管・故障検証を完了とはしない。Cは未着手のままであり、②のAI再試行・保持物操作は行っていない。

### 13.4. Provider中継とHost IPCの着手前照合

読取り専用のSource／Quality両確認を統合した。Provider別二Fileは独自Stateを持たず、既存共通Adapterへの準備・取消・消費の中継と契約説明だけである。実Consumerを同じ本番Singletonと共通Factoryへ直接接続し、契約説明は共通OwnerへProvider差だけを残して集約する。契約文字列・版・fieldの存在／不存在、別Store、Claude→Codexの消費順、一回消費・期限・AuthorityとMount終了順を保持する。Root公開APIへ追加しない。

Host caller排他は、Root検証・用途Hash・固定namespace生成を上位に残し、Server／Socket／Timerと既存の通知状態機械をPAの既存lock責務へ一体で移管する。PA公開は固定namespaceと64桁Hashを検査する用途限定操作と必要結果型だけとし、任意pipe・依存注入Factoryは公開しない。遅延取得、事前／待機中取消、解放Promiseの一回性、全Socket終端、観測不能とpoisonの意味を維持する。技術UTはPAへ、Host保存・実pipe結合は上位に残す。

発火は既存のProvider準備・消費とcaller保存だけ。未発行・管理不一致・期限切れ・Provider違いは既存拒否、途中取消・通知欠測・解放不明は既存非成功を維持する。新State／Registry／Lock／Frameworkを作らず、実AI・Docker・保持物を操作しない。静的・既存UT／IT・利用側回帰と独立レビューで同値性を確認する。準拠基準・Release監査は変更がないため対象外。保存形式や許可条件の変更が必要なら停止し、現在追加の人間判断は不要。

### 13.5. Provider中継撤去・Host IPC移管の結果

| 初回Pending | 確定した処置と利用側 | 維持した保証 |
|---|---|---|
| Codex／Claudeの二Adapter | Delete。助言とControllerは既存共通本番Adapter、各Provider試験は共通Factoryへ直接接続。契約説明は共通Ownerの一関数へ集約 | 二Provider別Singleton・独立Store、Claude→Codex消費順、一回消費・期限・管理一致・取消を保持。全descriptor fieldを削除前の旧実装とdeepEqualし、Codex専用fieldの有無・契約文字列・版・凍結の一致を確認 |
| caller Lease | 上位FileはKeepし、Root検証・同じHash・namespaceからPA公開操作を呼ぶ。実Server／Socket／TimerはPA `lock/in-process.ts`、既存通知状態機械は`lock/in-process-lifecycle.ts`へMove | 固定namespaceと64桁小文字Hashだけを受理。取消・後着取得・Socketごとの終端・解放一回性・観測不能を保持。状態機械に上位意味・逆依存を追加しない |

Coordinator Sourceは96→93 File。PA Rootの追加は用途限定の`acquireHostTerminalCallerPipeLease`と結果型`InProcessPipeLease`のみ。Coordinator Root19項目、永続形式・同じ回復参照・Node／Native Protocol・Native成果物は不変。新State／Lock／Registry／監視Processはない。

| 確認 | 結果と限界 |
|---|---|
| PA通常全回帰 | 137件成功。移管した通知15Caseと用途名拒否1Caseを含む。初回は公開期待集合の追加一件が未追従で不合格、期待だけを追従して全回帰を再実行 |
| 上位の実行・助言・Host判断 | 関連八Suite224件成功。外部AI・Dockerは有限の代役であり、実Provider成功の主張ではない |
| Windows保存・取消の実境界 | 制限環境ではcaller保存6件と子孫終了2件が不成立。同じ10件を通常権限で実行し全成功。既存実pipe競合・Process喪失後の再取得、caller保存・読戻し・取消の相関を確認。初回の失敗を上書きしない |
| 追加Task・Provider計画・助言回帰 | 四Suite177件中176成功・junction作成EPERM一件。通常権限で同じ一件を再実行し成功。複数runの結果を単一run全成功とは表示しない。Orchestrator／Workbench／MCPの型とRuntime／Orchestrator両設計対応表検査も成功 |
| 静的・公開・台帳 | PA型／Lint／書式、Coordinator型と変更九File Lint、Header・Root公開・全Test QA接続三件成功。Catalog389件valid。Symbol重複・Path欠落・参照未解決0。旧三Sourceへの現行コード・設定参照0 |
| 文書検査 | 変更五文書の直接診断0。参照先展開込み3,278診断でexit 1を維持。既存全体不合格は今回の局所移管で解消済みとしない。検査後の結果記録追記は設計変更ではない |
| 独立確認 | Sourceは残指摘0。Qualityは計画の時点表現一件を検出し、初回基準と現在結果を区別して訂正。限定再確認も残指摘0。試験実移管・設計・台帳接続を確認したが、独立した試験再実行ではない |

初回Pending三件の処置は完了したが、事前整理全体の完了ではない。次は保存／回復のWriter・Reader・原子的確定・Lease取得順と再入場の詳細対応、および残る実行・Authority・Host責務の配置確定を進める。大きなFileの一括移動や、表のKeepを根拠にした未検証の削除は行わない。Cは未着手。②のAI再試行・保持物の変更・削除は行っていない。

## 14. C前事前整理の最終配置と保証対応

基準は13.5節の93 Source。残件1〜3をまとめて実施する人間の指示に従い、Source／Qualityの読取り確認を統合した。変更分類は既存責務の内部再編と未接続候補の退役。独立Source／Qualityレビュー・関連回帰・文書検査を実施し、準拠基準・Release・依存有効化の監査は変更がないため対象外とする。現在追加の人間判断は不要。

| 確定配置 | 実際の責務とKeep／移管理由 |
|---|---|
| `execution/` | Provider準備・単発Task・取消・結果・技術回復接続、Host世代・所有・poison。相関する上位実行調整でありAI／DIへ丸移管しない。衝突するbasenameだけ用途名へ変更 |
| `storage/` | 現在状態・Settlement・Journal・Host記録とcaller確定。異なるWriter／Lock／原子単位は統合しない。再入場の純粋分類だけ既存modelへ本文不変で移管 |
| `workspace/` | Root観測・私有Binding・借用Tree・dirty・レビュー投影。Git技術操作でなく実行対象の上位意味。新しいWorkspace管理機構は作らない |
| `cli/` | 単一受付・引数・結果表示・Node版。実行環境の版判定をHost資源管理から受付へ移す |
| `authority/` | 実行許可・Secret投影・Root条件。人間同意とは異なり外部送信へ統合しない |
| `external-send/` | Policy・Consent・一回Grantと要求直前Gate。Cでdecisionへ移すまで独立維持 |
| `workbench-ai/` | 固定Context・助言Schema／Packet・非共有・結果公開。編集Taskへの変換による追加送信やReviewer追加はしない |
| `diagnostics/` | CLI以外の開発計測・検証Tool・回復の利用側もある。一次失敗・保存・許可相関を持ち単純中継ではないため維持 |

初期の三Folder目標へ形式的に詰める代替は採用しない。保存の原子単位と、Authority・助言・診断固有の意味を見えなくするためである。実Runtimeの保存先・Schema・ID・Hash入力・拒否理由・公開Root集合は変更しない。技術Writerを分割せず、現在の保存確定順を維持する。

### 14.1. 保存・回復の詳細保証単位

| 系統 | Writer／Readerと直接利用側 | 確定順・排他・再入場 | 検証接続 |
|---|---|---|---|
| 現在状態・Settlement | `settlement-store.ts`の単一物理Writer／Snapshot Reader。Task・Controller・CLI・診断、Orchestratorの回復確定が利用 | Repository Kernel Writer Lock内でfresh読取り→全Snapshot decode・元版CAS・遷移検査→pending／history／stateの既存出版順→読戻し→marker回収→Lock解放。marker回収と解放は別事実 | `coordinator-state-runtime`、`runtime-repair-owner`、`current-state-marker-cleanup`、再入場model UT |
| Journal | `docker-recovery-journal.ts`。回復・同意Store・Orchestrator `storage/protected-decision.ts`が利用 | 本体・commit・intentを同じexact対象へ結合。完全書込み・fsync・rename、move／deleteの途中段階を同じintentで再入場。DI専用Writerへ変えない | `docker-recovery-journal`、`docker-recovery-owner-reentry`、外部送信Store、Orchestrator保護判断 |
| Host caller記録 | `terminal-caller-checkpoint.ts`のsave／read、`terminal-record.ts`の正規bytes。回復保存とNative公開が利用 | 用途限定Pipe Lease取得→signal／isHeldの保存直前確認→stage完全書込み・fsync・読戻し→hardlink非置換公開→stage除去→canonical読戻し→Lease終端。Snapshotとの共通transactionを作らない | `host-terminal-caller-checkpoint`、`terminal-record`、実pipe競合／親喪失・保存故障 |
| Host／Probe記録 | `recovery-record.ts`と実行世代Owner | 同じtoken・producer・Root／子実体・記録bytes・lineageを維持。保存・借用・世代失効・Host回収のAuthorityを分離 | `host-recovery-record`、`current-host-transition`、`docker-recovery-owner-reentry` |
| 値モデル | `model.ts`、`recovery-identity.ts`、`restart-checkpoint.ts` | 値の構造・相関・状態遷移とexact ID文法のみ。純粋な再入場分類は処置候補であって保存・削除Authorityではない | model／repair-model／restart-checkpoint／再入場UT、Snapshot Writer結合 |

### 14.2. 未接続Platform Access候補の退役

旧`platform-access/adapter.ts`の`CRDDPR03` decoderと常時not_implementedの起動stubは本番Consumerがなく、成立済みのNative境界ではないため撤去する。RootObservationが使う契約説明は同じ値のままRoot観測Ownerへ統合する。旧専用六Caseのうちdescriptor検証をRootObservation試験へ移し、残る旧wire／未実装stub五Caseを退役する。

| 旧確認軸 | 現在の実装と評価境界 |
|---|---|
| 要約・非開示 | PA `tests/integration/root-observation.contract.test.ts`の「RootとHomeはtokenを返さずNative確認と開発Readerの順序を閉じる」と、上位`protected-root`／`provider-home-observation`で現在の結果を検査。旧PR03の結果fieldと同値とは扱わない |
| nonce・長さ・未知bit・role | PA `tests/unit/filesystem/protection.contract.test.ts`の「Provider Home responseはnonce、Provider、全観測bitと四つのdomain hashを検証する」「Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否する」で現行frameを検査。`tests/integration/native-cli.rs`は実CLIの固定要求・nonce・旧版拒否を検証する。旧PR03固有role・mask写像は退役し互換decoderを作らない |
| 主体・アクセス観測 | 現在のNative Root／Homeと上記の公開結果・上位Capability結合試験を維持。旧PR03の各access bit写像は現在frameの試験ではなく退役対象である。旧候補codecの成功から実主体・アクセス観測の保証を推定しない |
| 常時拒否stub | 本番未接続のため入口ごと撤去。現在の保護Root Adapter・開発観測・Authorityの拒否条件は変更しない |

Source／専用Suite／Compiler／Catalog／Symbol／coverage固定母集団を同期する。これは未実装候補の退役であり、現在のPA／Native保障の代替実装や互換性追加ではない。外部AI・実Docker・②保持物は操作しない。


### 14.3. 基準97 Sourceの最終対応

基準Commitの全97 Fileを再照合した。最終Coordinator Source92 Fileへの対応漏れ・余剰は0。初回のKeep／Pending表を現在の完了判定へ流用せず、以下を現在の処置正本とする。MoveはSource配置のみで、Runtimeデータの移動ではない。内部Symbol IDは歴史との接続を保持し、File名だけを理由にSchema／Contract／Reasonへ変更を波及させない。

| 基準Source（旧coordinator/src） | 最終処置 | 現在のOwner（40_Develop配下） | 保持・移管・退役の理由 |
|---|---|---|---|
| `authority/file-bundle.ts` | Keep | `coordinator/src/authority/file-bundle.ts` | 実行許可と信頼判断 |
| `authority/grant-verifier.ts` | Keep | `coordinator/src/authority/grant-verifier.ts` | 実行許可と信頼判断 |
| `authority/local-personal-grant.ts` | Keep | `coordinator/src/authority/local-personal-grant.ts` | 実行許可と信頼判断 |
| `authority/prelaunch-verifier.ts` | Keep | `coordinator/src/authority/prelaunch-verifier.ts` | 実行許可と信頼判断 |
| `authority/root-path-lexical.ts` | Keep | `coordinator/src/authority/root-path-lexical.ts` | 実行許可と信頼判断 |
| `authority/runtime-trust.ts` | Keep | `coordinator/src/authority/runtime-trust.ts` | 実行許可と信頼判断 |
| `authority/secret-material-policy.ts` | Keep | `coordinator/src/authority/secret-material-policy.ts` | 実行許可と信頼判断 |
| `authority/trust-loader.ts` | Keep | `coordinator/src/authority/trust-loader.ts` | 実行許可と信頼判断 |
| `cli/command-report.ts` | Keep | `coordinator/src/cli/command-report.ts` | 現在の操作Ownerと保証を維持 |
| `cli/command.ts` | Keep | `coordinator/src/cli/command.ts` | 現在の操作Ownerと保証を維持 |
| `cli/interactive-console.ts` | Keep | `coordinator/src/cli/interactive-console.ts` | 現在の操作Ownerと保証を維持 |
| `cli/launch.ts` | Merge | `coordinator/src/cli/command.ts` | 単一CLI受付 |
| `cli/options.ts` | Keep | `coordinator/src/cli/options.ts` | 現在の操作Ownerと保証を維持 |
| `cli/request-input.ts` | Keep | `coordinator/src/cli/request-input.ts` | 現在の操作Ownerと保証を維持 |
| `cli/task-cancellation.ts` | Keep | `coordinator/src/cli/task-cancellation.ts` | 現在の操作Ownerと保証を維持 |
| `diagnostics/development-execution-timing.ts` | Keep | `coordinator/src/diagnostics/development-execution-timing.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/docker-recovery-command-report.ts` | Keep | `coordinator/src/diagnostics/docker-recovery-command-report.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/doctor.ts` | Keep | `coordinator/src/diagnostics/doctor.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/isolation-probe.ts` | Keep | `coordinator/src/diagnostics/isolation-probe.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/release-identity-grammar.ts` | Keep | `coordinator/src/diagnostics/release-identity-grammar.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/runtime-repair.ts` | Keep | `coordinator/src/diagnostics/runtime-repair.ts` | 明示診断・回復と非秘密結果 |
| `diagnostics/runtime-restart.ts` | Keep | `coordinator/src/diagnostics/runtime-restart.ts` | 明示診断・回復と非秘密結果 |
| `external-send/consent-record.ts` | Keep | `coordinator/src/external-send/consent-record.ts` | 送信同意・scope・一回Grant |
| `external-send/consent-store.ts` | Keep | `coordinator/src/external-send/consent-store.ts` | 送信同意・scope・一回Grant |
| `external-send/grant.ts` | Keep | `coordinator/src/external-send/grant.ts` | 送信同意・scope・一回Grant |
| `external-send/policy.ts` | Keep | `coordinator/src/external-send/policy.ts` | 送信同意・scope・一回Grant |
| `host-execution/generation-loss-transition.ts` | Move | `coordinator/src/execution/generation-loss-transition.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/kernel-lock.ts` | Move | `coordinator/src/execution/kernel-lock.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/node-runtime-version.ts` | Move | `coordinator/src/cli/node-runtime-version.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/operation-lease-lifecycle.ts` | Move | `platform-access/src/lock/in-process-lifecycle.ts` | PAの用途限定IPC通知Owner |
| `host-execution/operation-workspace-lifecycle.ts` | Move | `coordinator/src/execution/operation.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/orphan-recovery-policy.ts` | Move | `coordinator/src/execution/orphan-recovery-policy.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/process-safety-state.ts` | Move | `coordinator/src/execution/process-safety-state.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/recovery-record.ts` | Move | `coordinator/src/storage/recovery-record.ts` | 記録・正規bytes・caller保存のOwner |
| `host-execution/terminal-caller-checkpoint.ts` | Move | `coordinator/src/storage/terminal-caller-checkpoint.ts` | 記録・正規bytes・caller保存のOwner |
| `host-execution/terminal-caller-lease.ts` | Move | `coordinator/src/execution/terminal-caller-lease.ts` | 現在の操作Ownerと保証を維持 |
| `host-execution/terminal-record.ts` | Move | `coordinator/src/storage/terminal-record.ts` | 記録・正規bytes・caller保存のOwner |
| `index.ts` | Keep | `coordinator/src/index.ts` | 現在の操作Ownerと保証を維持 |
| `platform-access/adapter.ts` | Delete／Merge | `coordinator/src/workspace/root-observation.ts` | 未接続PR03候補を退役。契約説明だけ統合 |
| `platform-access/protected-root-windows-adapter.ts` | Move | `coordinator/src/execution/protected-root.ts` | 現在の操作Ownerと保証を維持 |
| `provider/authority-grant.ts` | Move | `coordinator/src/execution/authority-grant.ts` | 現在の操作Ownerと保証を維持 |
| `provider/claude-docker-adapter.ts` | Merge | `coordinator/src/execution/provider-adapter.ts` | 共通本番Adapterと説明値へ集約 |
| `provider/claude-subscription-authentication.ts` | Move | `coordinator/src/execution/claude-subscription-authentication.ts` | 現在の操作Ownerと保証を維持 |
| `provider/codex-docker-adapter.ts` | Merge | `coordinator/src/execution/provider-adapter.ts` | 共通本番Adapterと説明値へ集約 |
| `provider/delegation-route-selection.ts` | Move | `coordinator/src/execution/delegation-route-selection.ts` | 現在の操作Ownerと保証を維持 |
| `provider/delegation-selection-grant.ts` | Move | `coordinator/src/execution/delegation-selection-grant.ts` | 現在の操作Ownerと保証を維持 |
| `provider/eligibility-observation.ts` | Move | `coordinator/src/execution/eligibility-observation.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-adapter.ts` | Move | `coordinator/src/execution/provider-adapter.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-composition.ts` | Move | `coordinator/src/execution/provider-composition.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-controller.ts` | Move | `coordinator/src/execution/provider-controller.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-plan.ts` | Move | `coordinator/src/execution/provider-plan.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-result-reasons.ts` | Move | `coordinator/src/execution/provider-result-reasons.ts` | 現在の操作Ownerと保証を維持 |
| `provider/execution-types.ts` | Move | `coordinator/src/execution/provider-types.ts` | 現在の操作Ownerと保証を維持 |
| `provider/home-mount-authorization.ts` | Move | `coordinator/src/execution/provider-home-mount-authorization.ts` | 現在の操作Ownerと保証を維持 |
| `provider/home-mount-grant.ts` | Move | `coordinator/src/execution/provider-home-mount-grant.ts` | 現在の操作Ownerと保証を維持 |
| `provider/home-windows-adapter.ts` | Move | `coordinator/src/execution/provider-home-windows-adapter.ts` | 現在の操作Ownerと保証を維持 |
| `provider/home.ts` | Move | `coordinator/src/execution/provider-home.ts` | 現在の操作Ownerと保証を維持 |
| `provider/isolation-execution.ts` | Move | `coordinator/src/execution/isolation-execution.ts` | 現在の操作Ownerと保証を維持 |
| `provider/isolation-profile.ts` | Move | `coordinator/src/execution/isolation-profile.ts` | 現在の操作Ownerと保証を維持 |
| `provider/lifecycle.ts` | Move | `coordinator/src/execution/provider-lifecycle.ts` | 現在の操作Ownerと保証を維持 |
| `provider/model-selection.ts` | Move | `coordinator/src/execution/model-selection.ts` | 現在の操作Ownerと保証を維持 |
| `provider/preparation-lifecycle.ts` | Move | `coordinator/src/execution/provider-preparation-lifecycle.ts` | 現在の操作Ownerと保証を維持 |
| `provider/preparation.ts` | Move | `coordinator/src/execution/provider-preparation.ts` | 現在の操作Ownerと保証を維持 |
| `provider/task-packet.ts` | Move | `coordinator/src/execution/task-packet.ts` | 現在の操作Ownerと保証を維持 |
| `provider/task-structured-result.ts` | Move | `coordinator/src/execution/task-structured-result.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/binding.ts` | Move | `coordinator/src/workspace/binding.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/borrowed-workspace.ts` | Move | `coordinator/src/workspace/borrowed-tree.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/create.ts` | Move | `coordinator/src/workspace/create.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/root-observation.ts` | Move | `coordinator/src/workspace/root-observation.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/root-protection-policy.ts` | Move | `coordinator/src/workspace/root-protection-policy.ts` | 現在の操作Ownerと保証を維持 |
| `repository-operation/workspace.ts` | Move | `coordinator/src/workspace/execution-target.ts` | 現在の操作Ownerと保証を維持 |
| `state-storage/docker-recovery-journal.ts` | Move | `coordinator/src/storage/docker-recovery-journal.ts` | 保存確定単位を維持 |
| `state-storage/model.ts` | Move | `coordinator/src/storage/model.ts` | 保存確定単位を維持 |
| `state-storage/recovery-identity.ts` | Move | `coordinator/src/storage/recovery-identity.ts` | 保存確定単位を維持 |
| `state-storage/restart-checkpoint.ts` | Move | `coordinator/src/storage/restart-checkpoint.ts` | 保存確定単位を維持 |
| `state-storage/settlement-store.ts` | Move | `coordinator/src/storage/settlement-store.ts` | 保存確定単位を維持 |
| `task/attempt.ts` | Move | `coordinator/src/execution/attempt.ts` | 現在の操作Ownerと保証を維持 |
| `task/cleanup-eligibility.ts` | Move | `coordinator/src/execution/cleanup-eligibility.ts` | 現在の操作Ownerと保証を維持 |
| `task/completion-observation.ts` | Move | `coordinator/src/execution/completion-observation.ts` | 現在の操作Ownerと保証を維持 |
| `task/development-measurement-constraints.ts` | Move | `coordinator/src/execution/development-measurement-constraints.ts` | 現在の操作Ownerと保証を維持 |
| `task/development-measurement-session.ts` | Move | `coordinator/src/execution/development-measurement-session.ts` | 現在の操作Ownerと保証を維持 |
| `task/development-source-observation.ts` | Move | `coordinator/src/execution/development-source-observation.ts` | 現在の操作Ownerと保証を維持 |
| `task/execution.ts` | Move | `coordinator/src/execution/task.ts` | 現在の操作Ownerと保証を維持 |
| `task/recovery-projection.ts` | Move | `coordinator/src/execution/recovery-projection.ts` | 現在の操作Ownerと保証を維持 |
| `task/recovery.ts` | Move | `coordinator/src/execution/recovery.ts` | 現在の操作Ownerと保証を維持 |
| `task/request.ts` | Move | `coordinator/src/execution/request.ts` | 現在の操作Ownerと保証を維持 |
| `task/result-reasons.ts` | Move | `coordinator/src/execution/result-reasons.ts` | 現在の操作Ownerと保証を維持 |
| `task/types.ts` | Move | `coordinator/src/execution/types.ts` | 現在の操作Ownerと保証を維持 |
| `workbench-ai/advice-contract.ts` | Keep | `coordinator/src/workbench-ai/advice-contract.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-dispatch.ts` | Keep | `coordinator/src/workbench-ai/advice-dispatch.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-execution-plan.ts` | Keep | `coordinator/src/workbench-ai/advice-execution-plan.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-execution.ts` | Keep | `coordinator/src/workbench-ai/advice-execution.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-packet.ts` | Keep | `coordinator/src/workbench-ai/advice-packet.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-result.ts` | Keep | `coordinator/src/workbench-ai/advice-result.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/advice-task.ts` | Keep | `coordinator/src/workbench-ai/advice-task.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/provider-adapter.ts` | Keep | `coordinator/src/workbench-ai/provider-adapter.ts` | 助言固有のContext・Packet・公開結果 |
| `workbench-ai/repository-composition.ts` | Keep | `coordinator/src/workbench-ai/repository-composition.ts` | 助言固有のContext・Packet・公開結果 |

### 14.4. 残件1〜3の検証結果と終了境界

保存・回復の保証対応、残存責務の最終配置、基準97件と現在92件の全数対応、Architecture／Quality／本番Consumer／台帳の追従を実施した。公開Root19宣言、永続形式、実保存先、回復参照、Authorityと終了条件は維持する。SourceとQualityの独立レビューは、文書参照五箇所および追加の試験追従を是正・再確認し、残指摘0である。

| 確認 | 結果と限界 |
|---|---|
| 最終単体回帰 | 現在配置の全571件成功。移動中に旧Pathで失敗した二Suiteを成功へ書き換えず、移動後12件と全単体の別runで再確認した |
| 動的接続と故障注入 | 検証Toolの動的Source配列・module map・変異対象を新配置へ追従し141件成功。入場・Process・保護Rootの三Suite12件、stdinの実importと不正変異検査一件も成功。Source本文・拒否条件を緩和しない |
| 本番利用側 | Workbench結合6件、Orchestrator公開境界4件、MCP観測接続2件成功。四Packageの型検査とRuntime／Orchestrator設計対応検査も成功 |
| 初回通常全体回帰 | 1,747件中1,613成功・129失敗・5skipで不合格。旧動的Path、Source抽出の字下げ依存、stdin検査の旧import、実行中のUT移動を検出して追従。多数が同原因でも全129件の原因確定とは表示しない |
| Git試験の単発失敗 | `repository-workspace-runtime`の一件で`worktree_create_failed`を観測。単独再実行と最終全体回帰では成功したが元原因は未確定。安全条件の緩和・自動再試行・回復機構追加はしない |
| Windows実保存 | Host記録・caller確定・現在Host遷移の三Suite全51件成功。故障後の同参照、原子的確定、読戻し、実pipe競合とProcess喪失後の解放を確認。実Dockerの検証ではない |
| 最終通常全体回帰 | 現在配置の全1,757件を完走し1,752成功・失敗0・5skip。明示実環境試験の対象外は成功へ換算しない。初回不合格とは別runであり、当時の失敗を上書きしない |
| 静的・公開・台帳 | 型検査成功。Lintはerror／warningなし（既存infoは別）。書式・差分空白検査成功。Catalog388件valid。基準全数対応に欠落・余剰0、公開宣言19件は不変 |
| 文書検査 | 変更六文書の直接診断0。参照展開134文書では3,285診断で不合格。全体文書品質の解消や正式QAのPassへ換算しない |

残件1〜3を含むC前の事前整理は完了。Cの統合・改名とDは未着手。今回の回帰は既存の代役・自己生成Git／Process／Filesystem試験であり、実Provider・実Dockerの成立根拠ではない。②のAI再試行・保持物の変更／削除は行っていない。新しい状態管理、Registry、LockまたはRecovery Frameworkは追加していない。

## 15. 呼出し元別助言経路の解体

基準は`440f31f51`。利用者は`workbench-ai/`を独立責務として維持しないことを採用した。初回配置を最終形へ固定せず、同じCHG内の追加整理として実施する。変更分類は既存能力の内部再編。Source／Qualityの読取り専用着手前確認を統合し、追加の人間判断は不要とした。実装・本番Consumer・Qualityの独立レビュー、変更文書検査と影響伝播、関連回帰を行う。準拠基準・外部依存の有効化・Release判断は変更しないため、その監査は対象外とする。

| 旧Source | 新しいOwnerと処置 |
|---|---|
| `advice-contract.ts` | `execution/types.ts`の値型へ統合。同形の結果Itemを単一定義にする |
| `advice-execution-plan.ts` | `execution/provider-plan.ts`の用途別計画へ統合 |
| `advice-task.ts` | `execution/task-packet.ts`の投影入力生成へ統合。編集PacketのAuthorityとは混ぜない |
| `advice-result.ts` | `execution/task-structured-result.ts`の用途別結果検査へ統合 |
| `repository-composition.ts`、`advice-dispatch.ts`、`provider-adapter.ts` | `execution/request.ts`へ統合し、本番の組立てを一つの受付へ閉じる。共通の空結果生成を使い、呼出し元別の中継Fileを残さない |
| `advice-packet.ts` | 現に共通Provider準備が使う一回消費Packetを`execution/provider-packet.ts`へ移す。同じWeakMap実体を維持 |
| `advice-execution.ts` | `execution/provider-execution.ts`へ移し、既存Controller／Adapterによる単発実行・取消・回収へ接続。実行基盤を新設しない |

内部SymbolはWorkbenchを前提としない名称へ移す。一方、通信contract／revision／reason／mode、PromptとHashの入力bytesは保持する。助言は用途別の非共有実行であり、編集TaskのCandidate・Reviewer・Repository Mount・追加送信へ変換しない。既存のPacket Store、Authorityとcleanup不明・元回復参照の寿命を統合しない。

Context読取りはDomain Modelの既存Repository Observerを要求ごとに構築し、`PROJECT_CONTEXT.md`一件だけを観測する。既存65,536-byte上限、本文文字列をUTF-8再符号化したHash、Secret検査を維持する。非同期読取りから同期の安定読取りへ変わる差は、読取り前後と配送前の取消確認で検証する。invalid／unobservableは既存の投影取得不能へ閉じ、下位Path・理由を公開しない。Domain Readerが証明できないOSをfallbackで回避しない。

検証は旧九SourceのUT、両Provider準備・Controller・一回Packet・Runtime、Catalog／Profile／通信Hash・取消、Orchestrator本番組立て、Workbench／MCPの結果接続、Root公開集合、Catalog／Symbol／coverageと動的Source参照を対象とする。基準版の結果は移管前能力の照合にだけ使い、新候補の検証結果へ流用しない。実AI・実Docker・②保持物操作・C全体の統合は対象外。

### 15.1. 実装接続と公開範囲

九Sourceを既存五Fileと責務別二Fileへ再配置し、現在Sourceは85 Fileとなる。上位OrchestratorはRootの`runRepositoryAdvice`だけで一回の受付・計画・実行を接続し、助言用三Factoryを組み立てない。内部の局所試験用FactoryはPackage Rootへ公開しない。Host再入場は`recoverProviderAdviceHostOperation`をRootから公開する。既存19宣言にこの二操作を加えた21宣言とし、保存Schema・通信識別子・CLIは変更しない。

同形の結果Item、文字列検査、空の拒否結果を既存処理へ統合した。助言と編集のPacket寿命・Schema・Hash領域は用途別に保持する。AI Adapterの助言定数Symbolも`PROVIDER_ADVICE_*`へ統一し、文字列実値を保持して利用側を追従した。

Runtime応答が例外で失われた場合、旧上位組立ての既定`cleanupConfirmed: true`は根拠にならないため、公開入口ではunknownかつ応答未観測をcleanup未確認として返す。新しい回復記録・参照は作らず、観測した応答にHost回復参照がある場合だけ元参照を返す。公開入口の合成Runtime例外と清掃不明で反証する。

`RCM-IT-005`の公開入口Caseは実Domain Readerと自己生成Repositoryを使い、用途固定Runtime構築・Host失敗分類の有限代役で十条件を別Process確認する。呼出し数はRuntime代役、Host参照は合成分類の投影であり、Operation／Home／一回Packet／Controller／実Host終端は既存別Suiteで評価する。Catalogのhardlink公開は制限環境では未確認になったが、通常権限で同じ四Caseが成功した。制限回避のfallbackや保存保証の緩和は加えていない。最終の検証結果は次節で区別する。

### 15.2. 是正と現在の検証結果

独立Source／Qualityレビューの指摘は是正・再確認済みで残件0。型専用importによる不要な実行時依存を除き、統合後のHeaderを実際の引数・Promise結果・用途境界へ合わせた。現在のCHG案内リンク三件だけ新試験Pathへ追従し、歴史Evidenceを変更しない。

最終局所110件、Native観測Suite全128件（有限行列120件を含む）、Workbench18件、MCP21件、Version Control利用側閉包12件、Profile／公開集合3件、上位公開Owner4件、Workspace終了再入場の対象1件は成功。全体の整形993 File／Lint994 File、Coordinator・Orchestrator・AI Adapter・Workbench・MCPの型検査、既存二Trace検査とTest Catalog388件の構造検査は成功。Native代役の公開集合追従では、指定外操作を例外で拒否し、既存Oracleを緩めていない。

通常回帰の初回は1,758件中1,633成功・120不合格・5 skip（約28分）。不合格は全て上記Native観測の代役公開集合不足であり、是正後の同Suite全128件再実行で解消を確認した。通常Profileの集約は1,753成立・5 skipで、最終候補で全1,758件を単一バッチ再実行した結果とは区別する。Orchestrator結合の初回に残った公開集合期待値と、修正途中の旧定数名を固定したSnapshotの失敗は、現行Sourceの上位公開Owner四件・対象Workspace再入場一件で再確認した。修正前の不合格を削除したり、基準版の結果を新版の成功へ転記したりしない。

変更した設計・Quality・計画の四文書自身への文書検査指摘は0だが、展開された関連文書集合には不合格が残る。文書検査全体・正式QA全体・実Provider／実Docker・C統合の完成は主張しない。新しい実行ログ書庫・状態管理・Registry・Lock・Recovery Frameworkは追加せず、②保持物も変更していない。

## 16. Workspace・診断Folderの解体と実責務への分配

変更分類は既存実装の責務分離・内部配置変更。基準は§15完了時の作業Treeとし、先行のstage済み差分を保持する。C全体統合、通信契約・永続Schema・保存先・許可条件・Release判断は変更しない。SourceとQualityの着手前読取り確認を統合した。Architecture／Source／利用側／試験の独立レビュー、文書と影響伝播・依存閉包・関連回帰を行う。準拠基準と外部依存の有効化は変えないため準拠監査・Release監査は行わない。現時点で追加の人間判断は不要。

棚卸しでは、当時の`workspace/`に継続Workspace管理はなく、`diagnostics/`の保存もCoordinatorの単発技術実行・修復記録であった。Orchestratorへ機械的に引き上げると逆依存または私有操作の公開中継を増やすため、両Folder解体という採用目的を維持し、実責務へ分配する。Orchestratorは既存のWorkspace寿命・Task進行を所有し、Git観測をVersion Controlから直接利用する。次表は§16時点の中間配置であり、Authorityの配置は§16.1で置き換える。

| 移行元 | 移行先・処置 |
|---|---|
| `workspace/binding.ts` | Gitの形式・HEAD／Tree観測をVersion Controlの既存`repository/revision.ts`へ。実行制限・Capability結合・私有Mapと借用は`execution/repository-binding.ts`へ |
| `workspace/borrowed-tree.ts` | `execution/borrowed-tree.ts`。上位指定対象の照合と固定保護Mount材料だけを所有 |
| `workspace/execution-target.ts` | `execution/change-snapshot.ts`。実行前後変更とReviewer投影。永続Candidateの採否ではない |
| `workspace/create.ts` | `execution/operation-creation.ts`。一時Operationの取得・途中失敗分類を同じ境界で維持 |
| `workspace/root-observation.ts`、`root-protection-policy.ts` | `authority/`の同名Fileへ。観測候補・保護要件・非Authorityの境界を維持 |
| `diagnostics/doctor.ts`、`docker-recovery-command-report.ts` | `cli/doctor.ts`、`cli/recovery-report.ts`。現在の受付・結果・表示を維持 |
| `diagnostics/runtime-repair.ts`、`runtime-restart.ts` | `execution/`の同名Fileへ。技術Sessionの保存順・現在Scope・元参照を維持 |
| `diagnostics/development-execution-timing.ts` | `execution/development-execution-timing.ts`。実Taskの計測とstderr出力を保持 |
| `diagnostics/isolation-probe.ts` | 本番のProbe・exact回復と、それらと相関Ownerを共有する用途限定検証操作を`execution/isolation-probe.ts`へ。Map複製や10件以上の私有API公開を避けるため、故障／取消編成だけのscripts分離は採らない。検証用入口のConsumerをscripts／試験へ限定する |
| `diagnostics/release-identity-grammar.ts` | 本番の40桁限定判定は実行結合の私有条件へ。検証用の受理集合は既存`scripts/verification-safety.ts`へ統合。汎用VCへRuntime制限を持ち込まない |

私有Mapは各Owner一実体とし、互換File・二重Map・上位を知る下位処理を追加しない。通常結合は改訂を再照合し、Settlementの実体照合では既存の改訂変更許容を維持する。Directの差分検査を事前書込み防止へ読み替えず、借用Tree・既存dirtyを回収しない。Root候補の未実装・観測不能・非Authorityを配置変更から成功へ昇格しない。

診断・修復・再起動・Probeの要求前保存、開始・完了、取消join、一次失敗、同じ回復参照と終了後条件を保持する。passive doctorにもOperation領域作成があるためEffect 0とは表示しない。実Docker・認証・外部AI・②の再試行・保持物操作は行わず、既存有限代役、実Git／Filesystem／Processと静的・台帳・依存閉包を検証する。過去Evidenceは変更しない。

### 16.1. Authority Folderの解体

利用者は独立したAuthority Folderを廃止し、単発実行確認をexecution、Docker固有処理をDocker Isolationへ分配する方針を採用した。着手前のSource／正本照合では、この10 SourceにDocker固有操作はなかった。許可Bundle、Registry、Policy、開始直前再検査、Local Personalの五要素をexecutionへ移し、既存の私有Map・cache・Schema・失効・Effect直前確認を維持する。Root Path、観測変換、保護候補も一般OSと実行前条件のためexecutionへ置き、下位Packageの公開APIを増やさない。

| 移行元 | 現在のexecution内配置 |
|---|---|
| `authority/file-bundle.ts` | `authority-bundle.ts` |
| `authority/grant-verifier.ts` | `authority-validation.ts` |
| `authority/trust-loader.ts` | `authority-policy.ts` |
| `authority/prelaunch-verifier.ts` | `prelaunch-validation.ts` |
| `authority/local-personal-grant.ts` | `local-authority.ts` |
| `authority/root-path-lexical.ts` | `root-path.ts` |
| `authority/root-observation.ts` | `root-observation.ts` |
| `authority/root-protection-policy.ts` | `root-protection-policy.ts` |
| `authority/secret-material-policy.ts` | `secret-validation.ts` |
| `authority/runtime-trust.ts` | `runtime-trust.ts` |

秘密情報検査は送信前と結果取込で共用するためexecutionに置く。Runtime Trustは本番Consumer0・Root非公開だが、既存のmandatory試験とAIT-IT-001／003の独立評価義務があるため削除せず、通常実行Gateへも接続しない。候補のRoot保護契約を実装済み運用保証へ昇格させない。Storage全体のOwner再編はこの配置変更とは分け、Docker固有記録を移すためだけの大量の公開APIや新しい管理機構を作らない。

Source／Qualityの独立確認と関連回帰を行う。既存レビューで検出したSymbol旧Path五件と、Version Control新二操作の利用側閉包不足も同じ固定候補で是正・再確認する。通信識別子、公開Root集合、保存形式、QA／Catalog ID、歴史Evidenceと②保持物は変更禁止とする。

### 16.2. 配置変更の確認結果と限界

Workspace・診断・Authorityの独立Folderを解体し、Sourceは84 File（execution62、storage8、external-send4、cli9、Root1）となった。公開Root21宣言と既存の通信値・保存形式を維持した。Source／Qualityの独立確認で検出したSymbol旧Path五件、VC新二操作の利用側閉包、同階層import十二件とDI試験の過大な説明を是正し、再確認の残指摘は0である。

| 確認 | 結果と限界 |
|---|---|
| 関連回帰 | 既存単体全体と変更意味に対応するIT／STを合わせ1,047件成功。実Provider・実Docker・全Package全体回帰ではない。最後の同一解決先へのimport正規化は別の局所再確認で扱う |
| 局所 | 許可・Root・Secret・doctor・Operation・Grammar・対応表の94件成功。制限環境ではWindows実行ユーザー不明で停止したCaseがあり、通常権限の同じ試験で成功を確認した。拒否条件の緩和やfallbackは追加しない |
| 実Gitと上位利用側 | VCの自己生成Gitと利用側閉包29件、Orchestrator公開受付・採用・状態取得25件、Workbench依存閉包4件成功。VC新二操作は現在集合と欠測・余剰・alias・namespace・default・再公開・dynamicを同じOracleで照合 |
| Docker側の模擬境界 | repair-host七件成功。Coordinator私有Path検査への試験依存を除き、固定正常・不正値とFS0を直接確認。実Docker操作はない |
| 静的・台帳 | Coordinator／Orchestrator／Version Control／Docker Isolationの型検査、書式、Lintのerror／warningなし、既存二Trace検査とCatalog388件の構造検査が成功。既存Lint infoは合否と区別する。SymbolのPath実在欠落0・ID重複0。既存の跨Package参照やsymbol粒度を一律Path重複禁止へ変えない |
| 文書 | 変更五文書自身の診断0。参照を展開した集合は3,600診断で不合格。文書全体・正式QA全体の合格を主張しない |

最後の局所再確認にはWindows保存Caseを含む既存の修復／Probe／再起動試験も含めて実行中であり、終端結果の確定前に成功へ算入しない。Runtime Trustの本番接続、Storage全体のOwner再編、C／D、実AI／実Dockerと②のAI再試行・保持物操作は本結果に含めない。コミット・プッシュは今回の指示対象ではないため実施していない。

## 17. Docker固有記録の所有者移管

利用者はStorage内のDocker固有記録をDocker Isolationへ移す整理を承認した。変更分類は既存能力の内部責務移管であり、Source／Qualityの着手前照合を行った。対象の保存Schema・token・reason・Root・実Path・保存順序・原子性・回復参照・公開情報範囲を維持する。新しいState、Registry、Lock、Recovery機構や互換Fileは作らない。実Docker操作、②のAI再試行・保持物操作、Release判断は対象外。

| 現在のStorage Source | 処置と所有者 |
|---|---|
| `recovery-identity.ts` | Docker Task回復ID解析をDIの`cleanup/recovery-identity.ts`へ。一般的な64hex判定は公開APIにしない |
| `recovery-record.ts` | Probeの技術資源記録をDIの`cleanup/probe-record.ts`へ。Host記録はCoordinatorの`execution/host-recovery-record.ts`へ分離 |
| `restart-checkpoint.ts` | Coordinatorの元操作・Repository・Scopeと結果を結ぶ要求相関として`execution/`へ。DIが既に所有するDesktopの技術的再起動状態とは分ける |
| `terminal-record.ts`、`terminal-caller-checkpoint.ts` | CoordinatorのHost終端intent・caller再入場として`execution/`へ。上位記録意味をDI／Platform Accessへ渡さない |
| `model.ts`、`settlement-store.ts` | Coordinatorの現在状態と配送・保存原子単位として維持。Docker fieldだけを分割して確定条件を壊さない |
| `docker-recovery-journal.ts` | 外部送信同意・Orchestratorの判断保存にも使う汎用のFileIdentity確定処理として今回は維持。名前だけでDIへ移さない |

既存のProbe記録操作と回復ID解析をDI Rootから明示公開し、Coordinatorは標準入口へ接続する。DIからCoordinatorへの依存、Private Sourceへの逆参照、単なる再export互換層は追加しない。Probeの記録・読戻し・Rootと子実体照合と、Host記録の状態遷移・元参照を保持する。既存Sourceの移管前能力と試験は§14〜16の対応・結果を照合し、新候補の根拠へ転用しない。

検証はProbe記録・ID・再起動相関・Host記録・終端caller・同意保存・上位判断保存とSettlement、型・公開集合・利用側閉包・Symbol／Catalogを対象とする。Source／Qualityの独立レビューと文書／影響伝播確認を行い、準拠基準・外部依存・Releaseを変えないためそれらの採用監査は行わない。先行のWindows保存試験は別の開始版の結果として保持し、移管後の完了根拠へ流用しない。

### 17.1. 接続と検証結果

DIへ既存八操作・二型を移管し、CoordinatorはDI Rootへ接続した。CoordinatorのSourceは83 File（execution66、storage3、external-send4、cli9、Root1）。Storageには現在モデル・Settlement・汎用Journalだけが残る。Host／終端／再起動要求相関はexecutionが所有する。実Path・保存形式・token・Hash・nonce・処置／出版順序とCoordinator Root集合は維持した。DIから上位への逆依存や互換中継は追加していない。

| 確認 | 結果と限界 |
|---|---|
| 通常関連回帰 | 1,117件成功。UTのPath移動前のrunとして保持し、移動後に同一バッチを再実行したとは表示しない |
| 局所と配置追従 | 初回137件中136成功・一件は旧import表記を固定したOracleの追従漏れ。現配置へ同期した該当15件は成功。UT三Fileの移動・台帳追従とHeader／整形後は局所36件成功。安全確認・期待値を緩めていない |
| 保存とcoverage | 44件成功。Host／Probeの実保存・差替え・部分欠測を含む。Journal 96.81／78.96／96.72、Host 100／84.51／100、DI Probe 99.48／88.57／100、全体97.68／81.30／97.62（行／分岐／関数％）。移管後DI Probeの母集団漏れをレビューで是正し、既存90／70／80の閾値を維持した |
| 公開・利用側 | DIの公開集合／環境／依存五件、上位の受入判断とSettlement七件成功。既存ITはHost世代とDI Probe記録の結合を持つため、名前だけで分割しない |
| 横断追従 | Domain Modelの台帳／保存利用側閉包29件、Version Controlの利用側閉包12件成功。既存のOwner選択・固定Root・台帳の拒否条件を維持 |
| 静的・台帳 | Coordinator／DI／Orchestratorの型検査、書式、Lintのerror／warning0、既存二Trace、Catalog388件valid。両PackageのSymbol Path実在欠落0・ID重複0。既存info診断は別とする |
| 独立確認 | SourceとQualityの全結果を統合し、coverage母集団漏れ・codec表記・UT配置を是正・再確認。残指摘0。移管対象関数の本文同値と、保存原子単位の不変更を確認 |
| 文書確認 | 変更四文書自身の診断0。参照展開した集合は3,303診断で不合格。§16の別Scope・別runの3,600件と件数差を改善効果へ換算せず、正式文書／QA全体のPassは主張しない |

§17.1の固定時点では、先行Windows保存run `58760`は移管開始前から動作していた別runで、終端未確定だった。`runtime-repair-owner`に含む15 Windows Caseの試験領域更新を観測しているが、進捗を完了・成功へ換算しない。停止・Root削除・強制的な記録整理は行っていない。今回成功した保存44件を、先行runや実Dockerの代替成功にはしない。実AI・Docker・認証・②保持物の操作、コミット・プッシュは行っていない。 終端結果は[§18.1](#181-検証状態)を参照する。

## 18. CLIと保存処理の所有者再照合

基準Commitは`48f927ce0`。変更分類は既存能力の責務・配置リファクタリングとする。着手前にSourceの直接利用側とArchitectureを照合し、読み取り専用の独立確認を行った。Task入力、表示、取消、保存の順序・失敗条件を維持する。新しい公開API、Framework、State、Registry、Lock、互換re-exportは追加しない。②のAI再試行・保持物操作と実Docker・認証は対象外。

| 対象 | 今回の処置 | 保持する能力・後続条件 |
|---|---|---|
| `cli/request-input.ts` | Orchestratorの同名Moduleへ移管 | 実利用側はTask／Projectの上位CLI。128KiB、厳格UTF-8、一意JSON、既存理由を維持。Coordinator doctorの引数Errorは自分の受付内へ局所化 |
| `cli/command-report.ts` | Orchestratorの同名Moduleへ移管。UTも`tests/unit/cli/`へ | Task／Projectの表示・JSON・情報秘匿を維持。Coordinatorの旧Task入口は同じ固定拒否表示だけを局所出力し、上位をimportしない |
| `cli/options.ts`の旧Task Parser | 本番利用0の`parseTaskArguments`と専用の結果Helperを撤去 | 古いParserの試験を本番Orchestrator受付の不正引数拒否へ置換。実際の現在CLI文法を緩めない |
| `cli/task-cancellation.ts` | 現Ownerを維持 | 両CLIが実利用するsignal結合・一回取消・join・解除。丸ごと上位へ動かすと逆依存となるためCのCLI統合と同時に移す |
| Console／Node版／doctor／回復表示 | 現Ownerを維持 | OS本体はPlatform Accessに移管済み。上位の確認・実行停止・診断構成は汎用OS処理へ渡さない。Task受付・表示の移管だけを理由に複製しない |
| `storage/docker-recovery-journal.ts` | 今回は移管せず、分割条件待ち | 汎用4操作（commit名／読取／保存／削除）と残17操作が約18の内部処理を共有。回復ID・Docker schema・binding判断が残るため全体Domain移管は不可。Helper複製・大量公開・新しい注入Frameworkで解かない |
| `storage/model.ts`、`settlement-store.ts` | 現Ownerを維持 | 現在操作・回復・配送・終了条件の相関と保存原子単位。物理保存だけと見なしてDomainへ移さない |

Journalは前節の「汎用」という要約だけでは説明不足だった。回復専用17操作は本番の直接利用が見つからないが、試験だけを根拠に既存能力を削除しない。後続Cで必要集合・過去の検証義務・再入場の利用側を確定し、専用処理の退役可否または少数の共通保存契約を決めた後に分割する。今回のDomain Root追加は0。保存形式、旧記録の扱い、unknown分類は変更しない。

検証対象は実stdinの上限一致／超過・UTF-8・重複key、実CLIの不正引数拒否、移管した閉じた表示、旧Task入口の同じ拒否、signal取消／解除、Catalogの利用側選択とSymbol／型・書式である。Source／Qualityの独立確認、変更文書と直接伝播の確認を行う。準拠規則・外部依存・Releaseを変えないため準拠監査・Release監査は行わない。現在、人間による追加判断は必要ない。

### 18.1. 検証状態

実装・配置追従は完了し、CoordinatorのSourceは81 File（cli7、execution66、storage3、external-send4、Root1）となった。局所48件（Orchestrator17、Coordinator31）、Coordinator関連40件、Domain Model台帳26件が成功。三Packageの型検査、変更Sourceの書式・Lint、Catalog388件valid、両PackageのSymbol欠落Path0・ID重複0を確認した。最終文書四件（両Architecture・本計画・PROJECT_CONTEXT）自身の診断0、参照展開集合は3,320診断で不合格。別Scope・別runとの件数差を改善・悪化の根拠へ使わない。

Source／Qualityの初回独立確認で、旧Task拒否表示のexact-byte試験不足、Architectureの旧CLI経路、移管UTの旧Owner表記を検出した。両レビューへ統合是正案を再提示し、合意した範囲だけを修正。human全文・三fieldの整形JSON・末尾改行・exit64・stderr空の実CLI確認を含む局所三件が成功した。再レビューで指摘された§17の時点表現も両確認者へ照合して修正し、独立確認の残指摘は0。取消、Journal、現在モデル、Settlementは基準版との差分0。Orchestrator全回帰は既存の実Git Workspace結合試験を含む129件すべて成功して終了した。CLI入力・表示移管の限定範囲は完了とし、保存処理の保留、C全体、実AI／Docker、全体QAの成立とは区別する。

先行Windows保存run `58760`は223件中222成功・一件失敗で終端した。唯一の失敗は、開始時に読み込まれた旧試験が`../execution/recovery.ts`を要求し、途中で同階層へ移管されたSourceの`./recovery.ts`に一致しなかった静的Oracleである。これは§17.1の配置追従漏れと同じ境界であり、現行試験の再実行15件は成功した。旧run全体を成功へ書き換えず、Windowsを含む222件の観測と現在版の15件を別結果として保持する。今回、追加のDocker・AI・認証・②保持物操作や先行試験Rootの削除は行っていない。C全体・実境界・Releaseは未完了である。


## 19. 保存責務の縮小と共通JSON保存の移管

基準Commitは`82364da9b`。対象は現行storage三Fileとその直接利用側・試験・Architecture／Qualityである。変更分類は既存能力の責務整理と旧未使用実装の退役。Repository内だけを書込み範囲とし、②のAI再試行・保持物操作、実Docker・認証・旧データ移行・Releaseは行わない。Source／Qualityの着手前確認を分離して実施した。

### 19.1. 能力対応と採用理由

| 基準版の能力 | 移管・処置 | 現在の保証と検証Owner |
|---|---|---|
| Journalの確定名／保存／読取／削除 | Domain Model `storage/committed-json.ts`へ必要な私有依存だけを移管。Rootは`getJsonCommitName`、`writeCommittedJson`、`readCommittedJson`、`removeCommittedJson`の四操作のみ | 新Domain UT／ITが同じSchema・byte・Identity・Hash・上限・symlink／hardlink・観測不能・中断を検査。外部同意Storeと保護判断StoreはDomain Rootへ接続 |
| 削除の四状態分類 | 共通保存の私有実装として維持。Rootへ公開しない | `PRL-UT-006`の削除四状態と共通保存IT。純粋判定を実回収成立とは扱わない |
| 旧directoryのtemporary／intent判定、resume、discover、inspect、move、cleanup、exact rollback、回復ID／binding限定処理、説明descriptorとmove／cleanup分類 | 旧本番Consumer `docker-execution/recovery-lifecycle.ts`が`a04ecb703`で撤去されたこと、現行Source・bin・scripts・Rootに到達元がないこと、旧Journal fallback禁止を照合して退役 | 現在のTask回復はCoordinatorのstate checkpoint／再入場とDI cleanupが担当。旧move／per-directory回復を現在能力として主張しない。PR-A-04とQAの旧試験参照を共通保存・現在Writer・DI回収へ付け替えてから削除 |
| Store内のHost開始／復帰とDI終了照合 | 実処理を`execution/host-submission.ts`へ移す。本番Consumerは既存recoveryのみ | begin／私有transition／completeの本文・予定保存→実Host遷移→後継観測→確定順序を維持。現在Host遷移／Owner再入場の試験と故障代役も新Ownerへ接続 |
| 現在状態モデル・単一Writer | 今回は同Ownerを維持 | 型・相関・Lock／CAS・元版・state／history出版・consumer ACK・修復purposeを機械的に分散しない。保存と履歴のさらなる分割はCで必要な境界を評価 |

判断を変え得た不確実性は、旧17操作が現在の回復入口や移行に必要か、及び保存coreの抽出が判定・原子性を変えるかである。現在の直接／動的参照、Git履歴、QA／Trace、現行state・DI経路を母集団として確認した。全Journalの移動はDomainへDocker ID解釈を混入させ、helper共有だけの分割は大量公開・複製を生むため不採用。実Consumer撤去と現行保証への対応を確認して旧処理を退役し、到達する保存coreだけを移す。過去Evidence、旧記録のSchema／suffix／reason／bytesは変更しない。秘密・Path・Role・処置許可の判断は各Callerが所有し、共通保存から新しいAuthorityを発行しない。

### 19.2. 固定前の照合と停止条件

- Source／Qualityの独立レビュー、文書・直接影響伝播確認、型・書式・Lint・Catalog／Symbol・Traceを実施する。準拠規則・外部依存・Releaseを変えないため準拠／Release監査は行わない。
- 共通保存の正負例、確定前後の子Process中断、観測不能、同意・判断の実Consumer、現行回復とHost遷移を確認する。実Docker・外部AIを使わず、試験用自己生成Rootだけを既存手順で回収する。
- 四操作の本文・保存形式と失敗分類の同値、旧17操作の本番参照0、旧Journalを現行根拠とするTrace参照0、Domain Root追加が四操作だけ、Coordinator Root集合不変を確認する。
- 移管前に未確認の本番／移行Consumer、必要な保証欠落、形式の非同値または新しい回復機構が必要と判明した場合はSource削除を停止する。現在、人間による追加判断は必要ない。
- 旧17操作の退役を現在state／DI回復全体の完成へ昇格させない。C・実境界・全体QAと②保持物は別に残る。

### 19.3. 実施結果と検証範囲

共通JSON保存四操作をDomain Rootへ接続し、旧Journal本体・旧専用IT／UTを撤去した。Host開始・復帰・内部遷移の三関数は実体をexecutionへ移し、既存recoveryと故障代役を追従させた。Coordinatorのstorageは`model.ts`と`settlement-store.ts`の二Fileとし、現在状態Schema、単一Writer、Lock／CAS、状態と履歴の確定順序を維持する。モデル・保存のさらなる分割は、後続Cで本当に必要な境界を確認する。

Source／Qualityの二独立レビューを集約し、公開集合の追従漏れ、試験支援の逆依存、Catalog／QAの現在Owner記述、試験CLI入口と書式を是正した。試験支援はDomainのtests/supportへ一実体で移し、既存Coordinator四利用側も追従した。再レビューの残指摘は0。四公開関数と必要な私有依存、Host三関数、試験支援の関数本文は、改名・配置・書式以外で基準版と同値である。

基準実装はHardlink別名の全探索・拒否・完全消去を保証しない。新ITは指定本文とsidecarの削除、別名のbyte・dev／ino保全とSymlink拒否を分けて検証する。既存にない強化を今回追加せず、成功結果を全alias不存在や秘密値の完全消去へ昇格させない。

| 確認範囲 | 結果と限界 |
|---|---|
| Domain通常全回帰 | 266／266成功。公開集合12件、実Filesystem・子Process中断・試験領域境界を含む |
| 共通保存・Host記録・DI Probe記録のCoverage | 27／27成功。行99.52％・分岐83.07％・関数100％。既存閾値90／70／80を維持 |
| 移管した試験支援の既存四利用側 | 169／169成功。Task Packet、外部送信Policy・同意、開発用Native観測。模擬応答の成功を実Docker成立へ拡張しない |
| Coordinator関連六Suite | Sandbox runは60件中59成功・Symlink作成EPERM一件。許可環境の同意Suiteは26／26成功し、同じ拒否Oracleを維持。旧失敗を成功へ書換えない |
| Windows現在WriterとHost pending再入場 | 主Case一件成功。旧試験が受付moduleをimportするだけで未実行だった追従漏れを、現行bin参照一行だけで是正 |
| Host遷移の別Process故障条件 | 30／30成功。28条件と二つの純粋Oracleで履歴・配送・公開CLI・模擬再起動結果への接続を確認。実Docker再起動の成立ではない |
| Owner終了とunknown保存後の故障代役 | 保存直後・Host開始直後・認証create unknown保存後の三Case成功。実Owner／Writer／KernelとDocker代役を区別する |
| Orchestrator | 単体78／78、Docker受領と状態遷移の関連30／30成功。重複母集団を加算しない |
| 設計トレースと対話境界 | 関連41／41成功。Runtime／Orchestrator Trace検査accepted、Catalog388件valid |
| 静的確認 | Coordinator／Domain checkとOrchestrator型検査成功。変更範囲Lint診断0。全体の既存style info63件とDomain既存info二件を今回の新規指摘へ混同しない |
| 文書検査 | 今回の五文書の診断0。拡張範囲3330件（歴史CHG3324、既存PA参照一件、既存Quality Integration五件）により全体Exit1を維持し、全体文書Passとはしない |

Host遷移の別Process故障条件とOwner境界の追加確認は終端成功した。自己生成Rootのcleanupと不存在確認が成功し、最終再観測でも今回試験Root残存0。今回の保存責務整理は限定完了とする。実Docker・外部AI・認証情報・②保持物の操作は行っていない。過去Evidence・正式QAの評価・C／D全体・実データ移行・Releaseは更新しない。現在、人間による追加判断は必要ない。

## 20. C前の残存責務・依存循環の再点検

本節はP0実装前の棚卸し時点の記録であり、当時のSourceと未採用候補を記述する。候補Aの採用・実装後の状態は§21を正本とし、本節の「未変更」「未採用」を現在候補の説明へ用いない。

基準Commitは`99eb0106de2fa31188456f298816de7fcdfd15df`。利用者提示の「Coordinator残存リファクタリング方針」を、実装確定ではなく、Source調査と段階別の改善候補として反映する。§19の限定完了を取り消したり、B1〜B5、旧Journal撤去、共通JSON移管、Host submission新設等を再計画したりしない。今回は本節と現在地の更新だけで、製品Source・試験・QA基準・Symbol／Catalogを変更しない。実AI、実Docker、認証、②保持物、旧データ移行、統合・Releaseは対象外とする。

### 20.1. 循環と証拠利用の初期棚卸し

基準HEADと作業開始時HEADの一致、作業Treeのcleanを確認した。CoordinatorのTypeScript Sourceは81 File（execution 67、cli 7、external-send 4、storage 2、Root 1）。添付の66〜67という概数とPackage全体のSource数を混同しない。型だけのimportを消去した簡易静的解析では、次の三Fileを含む18 Fileの循環群を観測した。ただし、静的循環は実行時障害、全Fileの責務誤り、一括移動の必要性の証明ではない。動的Consumerと故障代役の閉包は実装候補の固定前に別途確定する。

```text
recovery → settlement-store → provider-controller → recovery
recovery ↔ provider-controller
recovery → host-submission → settlement-store
```

そのためStoreからControllerへの参照だけを外しても、直接の双方向依存は残る。`provider-execution.ts`から`request.ts`への型参照は、この値依存の根拠へ数えない。

| 呼出し元 | 現在利用する根拠 | 維持する条件 |
|---|---|---|
| `writeRuntimeOwnedCoordinatorSettlement` | Controllerの終端観測借用 | 元Host結果と元Controller結果の相関から限定Writerへ渡す |
| `captureRuntimeOwnedCoordinatorSettlementInputs` | 同じ終端観測借用 | 初回の元二入力だけを固定し、再入場時の別objectを拒否 |
| `settleRuntimeOwnedCoordinatorResult` | 同じ終端観測借用 | 清掃・Lease・結果・履歴・配送の順序と一時／耐久Consumerの区別 |
| `writeRuntimeOwnedCoordinatorHistoryCheckpoint` | 同じ終端観測借用 | 同じ終端結果と履歴候補を照合 |
| `registerRuntimeOwnedCoordinatorSettlementResultDeliveries` | 同じ終端観測借用 | 元結果だけを対象に配送を登録 |
| `acceptRuntimeOwnedCoordinatorProjectResult` | 同じ終端観測借用 | 同じRepository・Operation・Recoveryと上位ACKの相関 |
| `completeRuntimeOwnedCoordinatorSettlement` | 同じ終端観測借用 | ACK読戻し後の同じpending deliveryだけを解放 |
| `publishRuntimeOwnedCoordinatorHistory` | 同じ終端観測借用 | 履歴の二重出版を防ぎ元版・結果参照を保持 |
| `checkpointRuntimeOwnedCoordinatorResourceNotIssued` | 元未発行通知の照合 | Lock解放済みSnapshotに対する外側の早期拒否。Writer内確認の代替ではない |
| `writeCoordinatorStateSnapshot` | 元未発行通知の再照合 | Writer排他内で現在版候補へfreshに再確認。この照合を外側のbooleanへ置換しない |
| Recoveryの`recordRuntimeOwnedDockerProviderSubmission` | 元Provider要求前通知の照合 | 同期callback中の元通知だけから既存lifecycle checkpointへ接続 |

上の終端借用八関数と未発行確認二箇所がStoreからControllerへの値依存を持つ。ControllerからRecoveryへの依存は、`productionState.dependencies`へ次の12操作を束縛し、開始・準備・要求保存・終了処理から利用する実処理であり、単なる結果変換ではない。

- 開始／失敗：`beginRecovery`、`bindInitializationFailure`、`abandonRecovery`、`verifyRecoveryBinding`
- 資源要求／通知：`markResourceSubmission`、`recordProviderSubmission`、`recordResourceNotIssued`、`recordResourceReceipt`
- 終了／観測：`recordDockerAbsence`、`recordMountCompletion`、`completeRecovery`、`verifyHomeLeaseRelease`

棚卸し当時、Controllerは既存の`terminalObservations`と`submissionNotices`を保持する。前者は元結果object・management capability・Operation ID・Recovery IDへ結合し、後者は元通知objectと同期callbackの期間だけ有効で、`finally`で失効する。本番SingletonとCandidateごとのRuntimeStateを混ぜない。これらの観測を複製DTO、永続記録、新しいAuthorityへ変換しない。Processを跨ぐ再入場でWeakMap観測を復元・推定せず、欠測時は既存耐久checkpointと現在Ownerの手順へ従って停止する。 §21で観測の保持・照合は専用Fileへ分離する。

### 20.2. StateとWriterの比較

| 比較軸 | 現在のCoordinatorのmodel／settlement-store | Orchestratorのstate／current-state |
|---|---|---|
| 現在正本 | 個別の技術実行・修復操作、未解決回復、pending delivery | Project／Task／Attempt、Queue、Workspace、Lease、判断、結果受領 |
| 保存先 | `.crdd/coordinator/state.json`と同Ownerのhistory | `.crdd/orchestrator/state.json`と同Ownerのhistory |
| 寿命 | 技術操作の開始から回収・配送終了まで。未解決義務は保持 | Task進行・人間判断・Workspace継続・上位受領と受付世代 |
| 更新単位 | 操作相関、元版、既存短期排他・CAS、state／history確定 | Snapshot改訂、受付世代、Queue・Lease・判断等の整合と既存CAS |
| 両者の接続 | 同じ結果を上位へ渡し、耐久ConsumerだけACK読戻しを要求 | 保存した同じACKを読戻してからProducerの配送解放へ接続 |

現時点で同一の正本・寿命・Transactionとは確認できない。同じ`state.json`という名称だけでWriterを一本化せず、Executionへの丸ごと移動だけでstorage解散完了とも扱わない。状態の意味規則は実行責務へ再配置する候補だが、既存Orchestrator状態との同等性、Schema、Recovery ID、Reason、History形式と全Consumerの対応はCで確定する。CAS・Atomic保存を崩すなら現在の保存Ownerを維持する。

### 20.3. 最初に反証する候補と代替

| 候補 | 解くこと | 不成立となる条件・未確定点 |
|---|---|---|
| A：既存の観測・通知照合を、回復／保存から独立した実責務へ限定分離 | Controllerの実行調整全体を参照せず、同じ元観測をWriter・Recoveryが照合できる方向。最初に反証する候補 | 本番／Candidate分離、元object、callback後失効、Writer内fresh照合を同じ保証で維持できる具体案が必要。File名、配置、API、移動範囲は未採用。新しいState／Registry／Lock・Root公開・汎用Portは作らない |
| B：既存CompositionへRecovery依存の本番束縛を寄せる | Controller→Recoveryの値依存を外せる可能性 | 12操作のCapability・通知寿命・正常／失敗理由・本番／Candidate区別を一括搬送できなければ成立しない。Factoryや中継を追加して依存線を隠す案は採らない |
| C：Settlement順序をExecutionへ、物理Writerを保存Ownerへ | 実行順序と保存技術の責務を直接分離 | Lock／CAS、元版、state／history出版、ACK、repair purposeの原子単位を維持する具体対応ができるまで実装候補へ昇格しない |
| 現配置を維持 | 必要保証を保ち、Cの意味統合時に再評価 | 原子性・寿命を保持する最小案が成立しない場合の正式な停止結果。循環や責務の交錯が解消済みとは表示しない |

棚卸し当時、Aは未採用だった。その後§21で限定採用・実装する。以下は採用前に確認した制約である。既存二WeakMapの所有・利用を一実体で維持できるか、書込み側／借用側と現在の故障代役の全数対応を示し、新しい着手前整合確認を終えてから実装可否を決める。検査を外へ出してコピーしたbool／DTOだけをWriterへ渡す方式は、現在の確認時点・相関を維持できないため採用しない。

### 20.4. 実施順序と各単位の出口

| 順序 | 調査・改善単位 | 実装前に確定すること／出口 |
|---|---|---|
| 1（P0） | Recovery・Settlement・Providerの依存 | 本節の八＋二＋一の観測利用と12依存の全Consumer・故障代役・通知寿命を対応付け、A／B／Cまたは維持を確定。値循環の縮小と保証回帰を別々に確認 |
| 2（P0） | State／SettlementのOwner | Schema・正本・寿命・原子更新・履歴・再入場の対応表を確定。storage解散可否とCへ残す保証単位を判断 |
| 3（P1） | Task／Attempt／Controller | `attempt.ts`と`task/execute-attempt.ts`の入力、開始通知、取消、元Attempt・配送相関を比較。同じ保証だけ統合し、単発Executionと上位Schedulingを分ける |
| 4（P1） | Request／Advice／Provider計画 | Request Snapshotにはtaskとdevelopment、助言には公開入口とOrchestrator利用側がある。複数Consumerと独立保証を確認し、重複判断・本番未使用中継だけ処置。Provider計画の二層を重複実装と断定しない |
| 5（P2） | 開発・診断・Authority・Repository中継 | Production／診断／回復／試験Consumerから実査してKeep／Merge／Move／Deleteを選ぶ。用途別Identity・Scope・世代・人間同意・外部送信Grantは名前だけで削除しない |
| 6（C入口） | 全残存Sourceの最終棚卸し | Fileごとの処置、判断Owner、技術Owner、公開／内部Consumer、正常・取消・失敗・再入場試験を確定。81 File全件の削除可否は現在未評価であり、未確認を完了へ丸めない |

各単位は、実装前の候補具体化→Architecture／必要なQualityの同期→実装・利用側・故障代役→意味に基づく局所／結合／回帰→固定候補の独立レビューの順に閉じる。一部の静的循環や単体試験だけでC入口Gateを通過したとは表示しない。

### 20.5. 保持条件・停止・検証選択

- Source変更前に、Production／Candidate、直接／動的／試験Consumerを全数対応させる。元object・Owner・Operation・Recovery・generationをコピー値で代替しない。
- 外側の早期拒否とWriter内のfresh照合、Lock／CAS、通知の同期寿命と`finally`失効、取消join、Lease／Capability失効、元参照、一次失敗とCleanup Unknownを保持する。
- callback後の通知再利用、Candidateから本番観測の借用、別結果の終端観測、非耐久観測の復元・成功推定が必要になるなら止める。新しいObserver RegistryやRecovery Frameworkで補わない。
- 二Storeの正本・寿命・更新単位を無理に統合する必要が生じる場合は、Cでの意味照合へ戻す。公開IF、保存形式、Authority境界、Lock順序の変更や新しい外部Effectが必要なら、影響と代替を先に示す。
- 検証は元objectコピー、callback終了後、本番／Candidate交差、別Owner／Operation／Recovery、Writer直前Revision差、通知false／throw、WeakMap欠測での再入場を含む。既存のController、現在Writer、Owner再入場、Host遷移、結果受領とTraceの試験を実際の変更面へ対応させる。
- 全正常系と必要な失敗・取消・遅延／重複通知・Owner喪失・二回復者競合・履歴／配送二重発行のOracleを維持する。実境界が必要になっても今回の方針だけで実Docker／AI実行・②保持物操作を許可しない。

棚卸し時点の記録：今回の変更分類は調査結果と未採用改善候補の計画反映であり、Architecture／Quality／移行への影響を読む着手前確認を実施した。Sourceの新所有者や保証変更を正式採用する編集ではないため、正式Architecture・QA基準は現状維持とする。計画の独立レビューと文書・直接影響の確認を行い、準拠基準・Release・外部依存を変えないため準拠／Release監査は行わない。今回は静的調査と計画確認であり、前段の試験結果を新統合版の成立へ流用せず、未変更Sourceの回帰を再実行したとも表示しない。現在、人間による追加判断は必要ない。

棚卸し時点の検査結果：計画の独立確認では、比較表の「旧」を現存Ownerと誤認し得る一件として是正し、読戻し・diff checkを確認した。残る計画指摘は0。文書Checkerは今回二文書の診断0、拡張先25診断により全体Exit 1であり、全体文書Passとはしない。今回の差分は本計画とPROJECT_CONTEXTの二文書だけで、製品Source・試験・QA基準・保持物に変更はない。

## 21. P0：元観測の照合責務の限定分離

§20の候補Aを今回の実装単位とする。既存二WeakMapを`execution/provider-observation.ts`の私有領域へ移し、Controllerだけが登録・失効、Store／Recoveryが元観測を照合する。Map自体は公開せず、本番Singletonと候補Ownerごとの独立性を保つ。新しい永続状態、Registry、Lock、Root公開APIは追加しない。失敗理由の意味はControllerに残し、診断型の参照は型だけとする。

通知を登録する位置、同期callback、finally失効、終端結果の登録位置を維持する。Store外側の早期拒否とWriter排他内のfresh照合は移動・省略しない。Schema、CAS、Lock、Recovery参照、12操作の本番束縛、配送・ACK・取消順序は変更しない。

確認は元object／コピー、別Owner・操作・回復参照、本番／候補の交差、通知false／throw後の失効、Writer内の再照合を対象とする。Controller・現在Writer・Owner再入場の既存試験を新しい照合Ownerへ接続し、静的依存と保証回帰を別々に確認する。Architecture・Quality・Symbolを同期し、固定候補の独立レビューを行う。文書・直接影響を確認し、準拠基準やReleaseを変えないため準拠／Release監査は対象外。実Docker・外部AI・認証情報・②保持物は操作しない。現在、人間による追加判断は必要ない。

### 21.1. 実施結果と確認範囲

- 元照合三操作を新Ownerへ移し、Controllerは登録・失効だけを利用する。Map・本番Singletonは公開せず、候補ごとの分離を維持した。Store／Recoveryの利用側と既存故障代役を追従した。
- 型を除いた簡易依存解析でStore／RecoveryからControllerへの照合の値依存を除去した。基準18 Fileの循環群は17 Fileになったが、Controller→Recovery等の残存循環は未解消。Sourceは81から82 Fileとなり、File数削減を成果指標にはしない。
- 関連三Suiteは116／116成功。新しい二CaseでOwner交差・元object・失効後拒否と内部書込みConsumerを確認した。Windows現在Writer一Case成功で外側確認後の失効を内側で拒否し、本文不変を確認した。
- Windows取消二Caseは制限環境で終了観測失敗となった。同じOracleの許可環境では二Caseとも成功し、制限環境の失敗を消去しない。
- 正常Ownerの実Host／Writer結合は、前段Host Submission移管後の試験import接続漏れで一度停止した。代役Store設定後に移管先を再評価する試験追従だけを追加し、同じ一Caseが成功した。製品側の安全条件は変更していない。
- Source・文書の独立レビューで本番Owner公開と棚卸し時点表現の二指摘を是正し、再レビュー残指摘0。型・format・lint・両Trace検査は成功。既存style info63件は別扱い。Catalog388件valid。
- 変更四文書のChecker診断0。拡張先3333診断で全体Exit1を保持し、全体文書Passではない。通常全回帰の集計は進行中で、全体完了はまだ主張しない。

当初、失敗した自己生成Root `.crdd/tests/normal-owner-wdRAs5/`は試験自身のcleanup未確認により保持された。再実行の新品Rootは清掃済み。旧Rootは§22で合成試験物として再確認・回収し、製品Recoveryの成功や二operationの完了へ書き換えていない。②保持物とは別であり、②のAI再試行・保持物削除、実Docker・認証・外部AIの操作は行っていない。

今回閉じる対象は観測照合の限定分離だけである。二Store統合、Controller→Recovery本番束縛の再配置、Task／Attempt整理、C入口全数評価は未完了のまま残す。本項はP0固定時点の記録であり、その後のC前処置は§22を参照する。

## 22. C直前までの残存整理

利用者がC統合直前までの継続を承認した。基準は§21の作業Treeで、C本体のPackage統合、公開契約・保存Schema・Authorityの意味変更、実Docker・外部AI・認証・②保持物操作は対象外。今回の変更分類は実装責務・名前・利用側接続の整理である。着手前にArchitecture・Quality・全Source／既知Consumerを照合し、保存／RecoveryとTask／Adviceの観点を読み取り専用の確認者へ委譲した。Source・文書・直接影響の独立レビューを行い、準拠基準やReleaseを変更しないため準拠／Release監査は行わない。

| 編集単位 | 実施内容と不変条件 | 検証 |
|---|---|---|
| Task入力と助言の分離 | `request.ts`のTask入力検査を`task-request.ts`へ移し、残る助言受付・同意・配送を`advice.ts`へ改名。処理本文・公開名・理由・回数を維持し、中継を追加しない | 入力Snapshot、助言受付／Profile／配送／結果、Taskと開発Task、Root公開集合 |
| 助言Runtime型のOwner | 二型を既存`provider-types.ts`へ移し、助言とProvider実行の型だけの相互参照を解消する | 型検査、Provider計画／実行と既存助言Consumer |
| 残存循環・二Store | 12回復操作と同じ本番controls、Writerの私有context・CAS・履歴・配送の原子単位を維持。切断だけのFactory／Port追加はせず、Cの一括切替単位を確定する | 元Owner／結果／通知相関、Writer内fresh照合、保存失敗・再入場の既存Oracle |
| Task／Attempt／Provider | 上位Attempt相関、単発Task、Provider制御を同一機能と見なさず維持する。CでのOwner切替対象を確定する | 開始通知一回性、取消join、Cleanup Unknown、上位受領 |
| 開発・診断・許可等 | 本文と本番／試験／scriptsのConsumerからKeep／最小是正／C内対応を全数確定。独立QA義務を本番未使用だけで削除しない | Consumer閉包、公開集合、既存専用試験 |
| 未使用・重複alias | `provider-home.ts`の未使用一行委譲を削除する。doctorのNode版判定aliasを既存の正規関数名へ統一し、試験も正規Ownerへ接続する。Root公開と判定本文は不変 | 全Consumer検索、Home／doctor／Node判定の既存試験 |
| 検証対応の欠落 | 既存の固定理由二Fileと同意値契約一FileのSymbol登録・既存検証Suiteとの対応漏れを補う。語彙・Schema・判定本文は変えない | 全Source実PathとSymbol Pathの完全一致、既存対応Suite |

Stateの意味をExecutionへ丸ごと移すだけの整理、同名Stateの強制統合、既存WeakMapのDTO化、外側boolへのWriter検査置換を採らない。既存の純粋な候補PolicyやRuntime Trustの採用義務変更は今回行わない。必要な人間判断が発生しない限り同じ範囲を継続し、C本体には着手せず入口判定で止める。

### 22.1. 保存・残存依存・試験物の処置

現在の二Stateは、技術Operation／回復／配送と、Project／Task／Attempt／判断の別正本である。§20.2のSchema・保存寿命・CAS／ACK単位の比較を現Sourceで再確認し、二FileともC前は維持する。`settlement-store.ts`の生きた私有context、Writer内fresh照合、履歴／配送／ACKの順序を分断するための公開Writerや新しいPortは追加しない。Cではこの保証単位をまとめて扱い、同じmodule-private境界を保てる場合だけ意味と物理保存を分ける。

Task入力を助言の実行依存から切り離した後、簡易静的解析の値循環は`recovery.ts`→`host-submission.ts`→`isolation-execution.ts`→`recovery.ts`の三Fileだけとなった。最後の辺は元Recovery Capabilityに結合した資源Receipt照合、前二辺は現在保存とHost開始・復帰の順序を持つ。DTO／事前boolや新Registryで辺だけを消さず、Cの一括切替単位として維持する。ControllerからRecoveryへの12本番束縛は同じcontrols・通知Ownerと一緒に維持するが、現在の循環群には含まれない。値循環減少は実行時故障不存在の証明ではない。

旧合成試験Root `C:\project\CRDD\.crdd\tests\normal-owner-wdRAs5`は、単一empty Git、remoteなし、既知のstate／history／Host recordと空の自己生成Host領域だけであることを確認した。関連する二回の試験Processは終了済みで、新しい試験は別Rootを使用・清掃済み。全54 entryの実体・通常File／Directory・Hash・link 0を削除直前に再照合し、通常Fileと空Directoryを下から非再帰削除してRoot不存在を確認した。これは合成試験データの清掃であって、製品Recovery成功や保存中の二Operation完了へ読み替えない。既存の②保持物・本体Git・認証情報・Dockerは操作していない。

### 22.2. 全SourceのC前処置

Pathは`40_Develop/coordinator/src/`基準。現行Sourceは83 Fileで、未知File・未処置Fileを残さず、削減だけを目的に分割・移動しない。表は責務と主な接続の要約であり、全ConsumerはSourceの直接・動的参照、Rootの公開契約、既存Symbol／試験対応へ照合する。静的なPath集合一致やSuiteの存在だけから動的保証の成立を推定しない。Cでの配置は責務単位を示し、同名空Fileや新しいWrapperの作成指示ではない。

| 現行File | 実責務 | C前の処置／Cでの接続 |
|---|---|---|
| `cli/command.ts` | Coordinatorの起動用途・通常Commandの受付と結果表示を所有する | 維持。CのCLI受付・表示へ結合 |
| `cli/doctor.ts` | 単発診断の受付結果と非秘密Reportを構成する | 維持。CのCLI受付・表示へ結合 |
| `cli/interactive-console.ts` | 同意用の対話端末I/O・cleanup不明時のProcess停止 | 維持。CのCLI受付・表示へ結合 |
| `cli/node-runtime-version.ts` | 最低Node版の判定・Effect前拒否 | 維持。CのCLI受付・表示へ結合 |
| `cli/options.ts` | doctor引数・操作組合せ・exact回復参照の検査 | 維持。CのCLI受付・表示へ結合 |
| `cli/recovery-report.ts` | 回復診断の結果をCLIのJSON／人間向け表示へ投影する | 維持。CのCLI受付・表示へ結合 |
| `cli/task-cancellation.ts` | 一回取消・元Promiseの共有・signal listenerの回収 | 維持。CのCLI受付・表示へ結合 |
| `execution/advice.ts` | 読取り助言の受付・送信同意・Provider配送・結果受理を所有する | 責務分離済み。Cでも入力／助言／Provider型を混合しない |
| `execution/attempt.ts` | 上位単一Taskの入力・開始通知・完了結果の検査と投影 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/authority-bundle.ts` | 単発実行へ渡す許可Bundleの整合を検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/authority-grant.ts` | Operationへ結合した実行許可の発行・一回消費・失効 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/authority-policy.ts` | 単発実行に渡された許可PolicyとRegistryの整合を検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/authority-validation.ts` | 単発実行の許可RegistryとGrantの候補を検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/borrowed-tree.ts` | 所属Repositoryと借用する実行Treeを照合する | 維持。CのWorkspace／実行対象判断へ移管 |
| `execution/change-snapshot.ts` | 借用Treeの実行前後の変更SnapshotとReviewer投影を観測する | 維持。CのWorkspace／実行対象判断へ移管 |
| `execution/claude-subscription-authentication.ts` | Claude専用Provider Homeの人手再認証Lifecycleを所有する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/cleanup-eligibility.ts` | Task結果の引渡し・確定相関から清掃可否を判定する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/completion-observation.ts` | 開始済みTaskの取消搬送と元の完了待機を所有する | 維持。Cで既存execute-attemptの同処理へ吸収 |
| `execution/delegation-route-selection.ts` | 役割・仕事・リスクに基づく実行経路と組合せの候補判断 | 判断／観測／一回Grantを維持。Cの選択・利用調停へ |
| `execution/delegation-selection-grant.ts` | 選択・現在利用可否・Profile・Operationを結ぶ一回Grant | 判断／観測／一回Grantを維持。Cの選択・利用調停へ |
| `execution/development-execution-timing.ts` | 単発Lifecycle区間・Identity観測時間の計測と進捗表示 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/development-measurement-constraints.ts` | 開発実測のTask・役割・回数・期限・取消の制限 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/development-measurement-session.ts` | 明示実測Session・Source／Native同一性・予約・終了の相関 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/development-source-observation.ts` | 開発実測が比較する固定範囲のSourceを読み取り、内容と実体を分けて観測する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/eligibility-observation.ts` | AI Adapterの利用可否を現在の観測値へ接続 | 判断／観測／一回Grantを維持。Cの選択・利用調停へ |
| `execution/generation-loss-transition.ts` | 世代喪失時の失効・drain・poisonの純粋遷移 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/host-recovery-record.ts` | Coordinator所有のHost回復記録と状態遷移相関を扱う | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/host-submission.ts` | Hostの開始・復帰を現在状態checkpointと同じ実Ownerへ接続する | 三Fileの元Receipt／Host順序を維持。Cで一括切替 |
| `execution/isolation-execution.ts` | Provider計画を固定隔離実行へ投影し、元Runtimeの結果を相関する | 三Fileの元Receipt／Host順序を維持。Cで一括切替 |
| `execution/isolation-probe.ts` | 単発の隔離診断・exact回復と同じ私有相関を用いるFake Provider検証を調整する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/isolation-profile.ts` | 隔離Profileの固定値・許可境界・入力上限を候補検査 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/kernel-lock.ts` | 用途別Hash・名前空間・取得時間を既存PA排他へ結合 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/local-authority.ts` | 現在Operationへ結合したLocal Personalの許可元を生成する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/model-selection.ts` | 仕事・役割・リスクとProfileからModel候補を選択 | 判断／観測／一回Grantを維持。Cの選択・利用調停へ |
| `execution/operation-creation.ts` | 単発Operationの一時資源取得と途中失敗時の回収分類を所有する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/operation.ts` | Host領域・世代・管理／Mount Capability・投入・回収・再入場 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/orphan-recovery-policy.ts` | 元の回復参照が不明な空Host領域の保守候補を評価する | 非Authority候補として維持。Cで適用範囲を確認 |
| `execution/prelaunch-validation.ts` | Provider開始直前に許可・Operation・Scopeの対応を再検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/process-safety-state.ts` | Process識別・不可逆poison・drain・一回回復Token | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/protected-root.ts` | 保護Rootの技術観測をRuntime Stateの上位Capabilityへ結合する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-adapter.ts` | Providerの準備・取消・一回消費を同じ実行Ownerへ結合する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-composition.ts` | Provider実行準備の本番依存と独立した短期状態を組み立てる | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-controller.ts` | Provider実行の開始・取消・通知・結果受領を調整する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-execution.ts` | 読取り助言を既存Provider実行基盤へ接続する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-home-mount-authorization.ts` | Home排他とMount Grantの発行・消費・解放・元完了証拠 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-home-mount-grant.ts` | Mount Grantの値形式・期限・状態遷移・用途の検査 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-home-windows-adapter.ts` | Provider Homeの技術観測を鮮度付きの上位Capabilityへ結合する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-home.ts` | Provider別Home配置候補と認証／Mount契約の記述 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-lifecycle.ts` | Provider実行要求とlifecycle候補の検査・遷移 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-observation.ts` | Controllerの元結果・短命通知を同じOwner内で照合する | 元観測の分離済み。CでController登録・保存照合を同時移管 |
| `execution/provider-packet.ts` | 読取り助言のProvider準備へ渡す一回Packetを所有する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-plan.ts` | Provider記述と操作相関をDocker Isolationの技術計画へ接続する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-preparation-lifecycle.ts` | Provider実行準備の期限・取消・一回消費を所有する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-preparation.ts` | Provider実行準備を既存Mount・Packet・Authorityへ結合する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-result-reasons.ts` | Provider実行調整が清掃後に公開できる固定失敗理由を定義する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/provider-types.ts` | Provider実行準備の相関・短期状態・結果の値契約を定義する | 責務分離済み。Cでも入力／助言／Provider型を混合しない |
| `execution/recovery-projection.ts` | Task入場・回復結果を固定された公開理由とDTOへ投影する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/recovery.ts` | Taskの回復状態・元版・排他・受領と終了を管理する | 三Fileの元Receipt／Host順序を維持。Cで一括切替 |
| `execution/repository-binding.ts` | 単発実行とRepositoryの結合、現在性と保存用借用を管理する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/restart-checkpoint.ts` | 単一再起動要求の保存値と遷移を検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/result-reasons.ts` | Coordinator Taskが公開する固定理由を定義する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/root-observation.ts` | 実行前Rootの観測候補を非AuthorityのIdentity・保護Hashへ変換する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/root-path.ts` | 単発実行のRoot Path候補を字句検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/root-protection-policy.ts` | 実行用Rootと許可情報Rootの保護要件を候補判定する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/runtime-repair.ts` | 明示的な実行環境修復を既存のRepository状態保存へ結合する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/runtime-restart.ts` | 単発回復対象の再起動要求を現在状態へ保存し、下位の固定操作へ委譲する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/runtime-trust.ts` | Runtime Artifactの信頼軸とDeployment Owner Policyを独立評価する | 独立QA義務を維持。通常実行のGateへ追加しない |
| `execution/secret-validation.ts` | 実行の入力投影と結果取込みに認識済み秘密情報が含まれるか検査する | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/task-packet.ts` | Task Packetの一回Capabilityと助言用投影DTOの既存二契約 | 二契約を維持。Cで移管と同時に分離可否を照合 |
| `execution/task-request.ts` | 単発Task依頼のfieldと入力範囲を検査し、所有Snapshotへ取り込む | 責務分離済み。Cでも入力／助言／Provider型を混合しない |
| `execution/task-structured-result.ts` | Task／Reviewer／是正結果と助言結果の既存二Schema検査 | 二契約を維持。Cで移管と同時に分離可否を照合 |
| `execution/task.ts` | 単発Task・Executor／Reviewer・一回是正・結果配送の実行調整 | 維持。Cの単発Executionへ同じ保証単位で接続 |
| `execution/terminal-caller-checkpoint.ts` | Coordinator所有のHost終端intentをRepository内へ保存・再検証する | 保証群として維持。Cで現在回復との適用範囲を照合 |
| `execution/terminal-caller-lease.ts` | Host終端記録のcaller保存を同一Processで排他する | 保証群として維持。Cで現在回復との適用範囲を照合 |
| `execution/terminal-record.ts` | Host終端intentを固定された非Authorityのbytesへ変換する | 保証群として維持。Cで現在回復との適用範囲を照合 |
| `execution/types.ts` | Task完了観測のProcess内データ契約を定義する | 維持。Cで公開4型と内部完了／助言型を分配 |
| `external-send/consent-record.ts` | 同意record名・世代・Schema・有効期間の値契約 | 維持。Cで同意・Scope・消費寿命ごと移管 |
| `external-send/consent-store.ts` | Host同意の確定・照合・失効と保護Root／排他 | 維持。Cで同意・Scope・消費寿命ごと移管 |
| `external-send/grant.ts` | 同意・Scope・役割／Attemptを結ぶ上限付き一回送信許可 | 維持。Cで同意・Scope・消費寿命ごと移管 |
| `external-send/policy.ts` | 固定Policyと現在の通信条件・Operation相関の再照合 | 維持。Cで同意・Scope・消費寿命ごと移管 |
| `index.ts` | Coordinatorが上位利用側へ公開する単一Taskの実行・現在回復境界 | 公開名を維持。Cで旧Orchestrator Rootと同時切替 |
| `storage/model.ts` | Coordinatorの現在状態を閉じた保存形式として検証する | 維持。Cで正本・CAS／ACK単位を一括照合 |
| `storage/settlement-store.ts` | Coordinatorの最新現在状態をRepositoryへ保存する | 維持。Cで正本・CAS／ACK単位を一括照合 |

### 22.3. 公開契約・利用側・Cの切替単位

Root公開名と通信・保存契約は今回変更しない。内部Fileの分離を公開API追加と扱わず、移管時は次のConsumerを同じ固定候補で追従させる。

| 公開する操作・型 | 主な利用側とCで維持する境界 |
|---|---|
| `runCoordinatorTaskAttempt`、`snapshotCoordinatorWorkspaceResult`、`COORDINATOR_TASK_PRE_EFFECT_REJECTIONS`、`CoordinatorTaskDependencies`、`CoordinatorTaskAttemptInput`、`CoordinatorTaskAttemptResult`、`CoordinatorWorkspaceResult`、`CoordinatorTaskRecoveryObligation` | OrchestratorのAttempt・Workspace実行。予約／開始／取消join／結果受領と借用対象検査を同時切替する |
| `runRepositoryAdvice`、`recoverProviderAdviceHostOperation` | 直接ConsumerはOrchestratorの`task/request-composition.ts`。WorkbenchはOrchestrator経由の上流受付である。読取り範囲・Profile・同意・元Host回復参照を維持する |
| `recoverRuntimeOwnedDockerTaskForCurrentConsumer`、`resolveRuntimeOwnedDockerTaskCurrentCorrelations`、`observeRuntimeOwnedTransientTaskCompletion` | 上位Task／診断／回復。私有Owner・exact相関・Writer内fresh照合を外部boolへ置き換えない |
| `createRuntimeProcessRecoveryIdentity`、`getRuntimeProcessInstanceIdentity`、`inspectRuntimeProcessRecoveryIdentity`、`poisonRuntimeProcessAfterCleanupUnknown`、`acquireRuntimeOwnedOrchestratorStateKernelLock` | 上位Process・現在保存。元のSingleton・名前空間・失効とpoisonの寿命を維持する |
| `isSupportedCoordinatorNodeRuntime` | 公開CLI／scripts。最低Runtime版とEffect前拒否を維持する |
| `readRepositoryNetworkPolicies`、`RepositoryNetworkPolicies` | 内部助言、Workbenchの`shared-view.ts`／`repository-view.ts`と検証scripts。Repository通信条件・同意Hashと一回読取りを維持する |

Cの順序は、純粋な選択・結果値、Packet／準備、実行対象結合、保存／checkpoint／固定理由、Attempt／Task、本番Root／CLIの切替を依存順に照合する。同じ保証群の途中を新しい公開契約で仮接続しない。旧Packageの撤去と新Coordinatorへの改名は、Consumer・Symbol・試験・配布入口が接続してから行う。表の責務候補を先に移した完成状態として表示しない。

検証は、Task入力の閉じたSnapshot、助言のContext／Profile／同意／結果、Providerの元観測・失効、Writer内再照合、元Owner再入場、Root公開集合、Consumer閉包、Source実PathとSymbol集合を対応させる。既存のWindows保存・取消・Owner結合と外部AIなし回帰を使い、実Provider／Docker実境界・②の再試行・保持物削除は今回の根拠へ加算しない。

### 22.4. 固定Sourceの検証とC直前判定

Source／試験の基準は`99eb0106de2fa31188456f298816de7fcdfd15df`からの今回差分とする。全回帰開始後、製品Sourceは固定した。初回全回帰で検出した試験責務分類二行だけを是正し、影響する四件を再実行した。以後はSource／試験を固定し、文書の集計だけを追従する。

| 確認範囲 | 観測結果と扱い |
|---|---|
| 通常静的検査 | format・Source／試験の型検査・lintは成功。lintの既存info 63件をエラー解消として数えない。Runtime TraceとOrchestrator設計Traceはaccepted |
| Task／上位接続の六Suite | 221件成功。Task Runtime・単一Task Adapter・Provider境界・Runtime／設計Trace・開発時間観測を確認 |
| 助言・入力・Consumer | 関連51件、実Catalog保存4件、Home／Node／doctor 14件、VC Consumer閉包12件成功。制約環境のCatalog出版・Host namespace・junction失敗は、OS機能を使える環境で該当範囲を再確認した |
| Windows元Owner結合 | 現Sourceで正常Owner1回の結合1件成功。実Home解放・合成Host清掃・状態保存を確認。ProviderとDocker操作は代役であり、実Docker成立へ換算しない |
| 検証台帳・登録 | Test Catalog 388件valid（実行済み件数ではない）。Source83 FileとSymbolのPath集合一致を既存Trace Suiteへ追加し成功 |
| 文書検査 | 今回変更四文書の診断0。参照展開された歴史文書等の3,333診断による全体exit 1は維持し、全体文書Passとは表示しない |
| 独立確認 | SourceとArchitecture／Quality／対応表を別の読取り専用確認者へ提示。Consumer記述の二箇所を是正し、再レビュー残指摘0 |
| 現SourceのOrchestrator回帰 | 単体78件・結合51件の全129件成功。公開受付・保存・Workspace・候補固定／Merge・再入場を確認 |
| 現SourceのCoordinator通常全回帰 | 全1,720件で1,714成功・1失敗・5 skip。唯一の失敗は先行CLI移管の`command-report.ts`と`request-input.ts`の責務分類登録漏れだった。標準出力／標準入力I/Oを所有する両FileをAdapter分類へ追加し、該当Suite 4件が成功。完全一致・未分類・重複・pure空集合・純粋依存の反証は維持した。初回runの失敗を書き換えず、該当再実行で是正を確認。skipは実施済みへ換算しない。先行の制約環境runは途中編集も含むため固定候補の全回帰根拠に使用しない |

各部分試験は重複するため件数を合算しない。二State・三File循環・Task／Attemptの実Owner切替はC本体の対象であり、今回の先行実装で仮接続しない。全回帰の失敗は試験分類二行に限定され、製品Sourceの追加変更はない。該当四件と静的検査・独立再レビューで是正を照合し、同一製品候補の長時間全回帰を反復せず収束する。

C前の許可範囲は上表の結果で限定完了とし、指定どおりC直前で停止する。現在、人間による追加判断は必要ない。C本体、D、実AI／実Dockerの最終境界、全体QA、統合・Releaseは未実施のまま区別する。②のAI再試行・保持物操作は行っていない。

## 23. CLIの受付責務への限定整理

人間が§22後のCLI整理を承認した。基準は`7f4f4bc1d`、変更分類は実装責務・配置の整理であり、C本体の統合を先行しない。書込みは当Repository内、実AI・Docker操作・②保持物操作・保存移行は対象外とする。現行SourceとConsumer・過去の取消／端末／診断試験を照合し、読取り専用の着手前確認で次の配置と不変条件を確定した。

| 編集単位 | 処置・利用側 | 不変条件と確認 |
|---|---|---|
| 診断の編成と表示 | `cli/doctor.ts`の実行・回収・readinessを`execution/diagnostics.ts`へ、失敗表示は`cli/recovery-report.ts`へ。既存VC／DIへの委譲を維持する | 元ErrorのWeakMap登録・分類は同じdiagnostics実体。表示byte・reason・Report版・受理条件・初期化失敗後の回復参照を変更しない |
| 回復対象の解決 | CLIが検証済みRootを取得し、既存`execution/recovery.ts`が現在Snapshotとexact IDを照合する | Reader排他解放・単一一致・Host／Probe区分を維持。cwdの再解決やplain PathからAuthorityを生成しない |
| 同意の端末接続 | `cli/interactive-console.ts`を`external-send/console.ts`へ移し、grantが直接使う。OS技術処理は既存PAに残す | 同じProcess poison、元のReader期限・取消・handle回収・未完了値非開示を維持。保証のある入口を本番未使用だけで削除しない |
| Runtime版条件 | `cli/node-runtime-version.ts`を`execution/runtime-version.ts`へ移す | Root公開名、CLI／scriptsのEffect前拒否、有限版文法を維持 |
| Signal接続 | `cli/task-cancellation.ts`を`cli/cancellation.ts`へ改名し、Orchestratorも同じ実装を使う | 一回取消・元Promise・登録Rollback・unbind・失敗表示を維持。Task完了待機とは統合しない |
| 参照と検証対応 | 現行import、scripts、Source集合、Symbol、Catalog、Architecture・Qualityを追従する | 歴史Evidenceは不変。旧Path互換中継・新しいFramework／Registry／Lock／Recoveryを作らない |

正常・初期化失敗・回収不明・開始前／待機中取消・遅延通知は既存SuiteのOracleを移設先で再使用する。元Error／別Error、Root未確認／現在記録欠測／複数一致、Signal登録・解除失敗、unsupported Nodeの拒否を確認する。CLI内の同名plain-record検査は契約が異なるため機械共通化しない。

Source独立レビュー、文書監査と直接利用側の影響確認を実施する。準拠基準・工程規範・公開範囲・Releaseを変更しないため、準拠監査とRelease監査は行わない。初回編集前の確認は完成後の独立レビューへ換算しない。四Fileは現CoordinatorのCLIの目標であり、Cで合流する上位の入力・Task表示を無理に混ぜる完成条件ではない。

### 23.1. CLI整理の確認結果と残る計測課題

CLIは`command.ts`、`options.ts`、`recovery-report.ts`、`cancellation.ts`の四Fileに整理した。診断・版判定・同意端末は上表のOwnerへ移管し、CLIによる現在状態Storeの直接読取りを除去した。Root公開名・通信／保存Schema・固定理由・表示結果は維持した。Source83 FileとSymbol集合、UT配置、Test Catalog、Template、検証scripts、上位Consumerと現行UI参照を追従した。旧Pathの互換中継は追加していない。

| 確認範囲 | 観測結果と限界 |
|---|---|
| 静的検査 | format、Source／試験の型検査、lint、Runtime／Orchestrator設計Traceが成功。既存lint info63件は維持 |
| CLI関連十Suite | 120件成功。元Errorと別Error、Root未確認・欠測・複数一致・異なるtoken、取消とNode拒否、公開入口とSource集合を確認 |
| 端末・Process境界 | 18件成功。独立レビューで指摘された仮想tsconfigのConsole Path一行を同期し、同じ18件を再実行して成功。製品Source・Oracle・許可集合は不変 |
| 直接利用側 | Orchestrator公開境界6件、Version Control利用側閉包12件が成功。Test Catalog388件validは実行件数へ換算しない |
| Coordinator通常全回帰 | 1,722件中1,717成功・失敗0・5 skipで完走（約35分49秒）。製品Sourceは開始後不変。端末試験のPath同期は回帰実行中に是正したため、同Suite18件の最終再実行結果も別途照合した。skipは未実施のまま扱い、実AI・実Dockerの成立へ換算しない |
| 文書検査 | PROJECT_CONTEXTを含む変更五文書の診断0。参照展開された歴史文書等を含む全体3,333診断によるexit1は維持し、全体文書Passとは表示しない |
| 独立確認 | Sourceと文書／利用側を別の読取り専用確認者が確認。Template、coverage母集団Path、現行UI参照と端末試験の追従漏れを是正。過去の試験失敗を成功へ書き換えず、影響Suiteの再実行で確認 |
| 関連coverage | Platform Access TSとProvider Homeの既存検査は成功。Dynamic Fake Providerの連続二回出力一致は非決定性で不合格のため、CLI整理の成功根拠から除外しOPENを維持 |
| Checker命名・公開集合 | Windowsリンクを利用できる環境で22件中19成功・3失敗。失敗はPAの`host-record.rs`命名、DI公開集合の二module未登録、既存Controller試験のHeader不足。対象Source／該当Headerが基準Commitから不変であることを照合し、今回のNode版Gate参照追従とは分離する。制約環境の初回6失敗のうち3件は同環境で解消。全体命名検査のPassは主張しない |

Dynamic Fake Provider計測では、同じ母集団の連続二回で、今回未変更の`execution/operation.ts`に関する未網羅branchのline／block等に差を観測した。CLI移管が原因とも、基準版から存在した問題とも確定していない。責任者はQual-Labとし、coverage計測またはその観測形式を次に変更する前に、元LCOVのSource集合・集計・branch tuple集合と順序を比較する。閾値・母集団・検証義務・連続二回条件を緩めず、同じ保証を測れる根拠が得られるまで再現可能coverageの成立を主張しない。新しいRuntime管理機構や製品Sourceの拡張は行わない。

部分試験の件数は重複するため合算しない。CLI整理は上記の範囲で限定完了とし、全体QA・Release可能を主張しない。現在、人間による追加判断は必要ない。実AI・実Docker・C統合・②再試行と保持物操作は実施していない。

## 24. 両PackageのAfterを基準にした統合前整理

### 24.1. 基準、今回の範囲と正本

人間から提示された「Coordinator／Orchestrator統合前の構造整理」を設計入力とし、基準`b2b603c10fb9eaef3d02d430334c9c449516b262`のSource一覧、入口、主要import、§22のCoordinator83 File対応、先行の保存責務調査を照合した。最終責務と目標構成は[Coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md#pre-consolidation-execution)と[Orchestrator](../../../06_Architecture/Details/coordinator/03_Task_Architecture.md#consolidated-source-target)、検証義務は[QA-000003](../../../07_Quality/Definitions/QA-000003/quality_definition.md)が所有する。本節は基準から目標への処置候補、実施順、停止条件を所有し、Source移管や全体QA成立を宣言しない。

今回固定するのは目標と順序であり、全154 Fileの関数単位のConsumer・故障経路を網羅済みとはしない。名称・File数だけの統合を行わず、各実装単位で既存検証・公開API・消費元を照合してから処置する。以前のC前整理完了は§22〜23の範囲で維持し、本節の追加整理を実施済みへ読み替えない。CのPackage統合・旧Coordinator撤去・旧Orchestrator改名は採用済み目標のまま、後述の切替条件を満たすまで実行しない。

### 24.2. 基準Treeと添付との差

```text
40_Develop/
├ coordinator/src/        83 File
│ ├ cli/                  4
│ ├ execution/           71
│ ├ external-send/        5
│ ├ storage/              2
│ └ index.ts              1
└ orchestrator/src/      71 File
  ├ activity/             4
  ├ cli/                  3
  ├ decision/            13
  ├ identity/             3
  ├ input/                2
  ├ lease/                1
  ├ objective/            7
  ├ platform/             2
  ├ process/              1
  ├ queue/                1
  ├ state/                6
  ├ storage/              5
  ├ task/                17
  ├ workspace/            3
  └ Root                  3  # index.ts、operation-result.ts、operation-result-contract.ts
```

添付のOrchestrator Beforeには`workspace/`三Fileの記載がないが、総数71には含まれるため上図で補う。数は基準の実測であり、削減目標ではない。旧CoordinatorはC前に既存四FolderとRootを維持し、Orchestratorは最終構成の`execution/`を空作成しない。目標Treeの正本はOrchestrator Architectureに一度だけ置く。

### 24.3. 旧Coordinatorの処置候補

§22の全83 File対応を基礎に、次の対象を先に評価する。表にない必要保証を削除候補へ補完しない。

| 現行Source（`coordinator/src/`内） | 今回の整理とCでの扱い | 削減前に保持を確認すること |
|---|---|---|
| `execution/task.ts`、`task-request.ts` | 単発実行と入力取込みのOwnerを維持 | 開始前拒否、取消join、入力Snapshot、元結果／回復参照 |
| `execution/attempt.ts` | Cで上位`task/execute-attempt.ts`と接続Adapterの統廃合を評価。C前に作り直さない | 開始通知、相関、結果正規化、取消、配送捕捉と対象検査 |
| `execution/provider-controller.ts`、`provider-observation.ts` | 実行制御と元観測照合を分離した現在Ownerを維持。Controller再統合は未採用 | 私有二Map、本番／候補の独立性、元object、登録位置、finally失効、Writer内fresh照合 |
| `execution/provider-plan.ts`、`provider-adapter.ts` | AI Adapter／DIと上位相関の重複を確認し、固有判断のない変換だけ削減候補 | Provider技術PlanとOperation／Packet／許可相関の違い |
| `execution/provider-preparation.ts`、`provider-preparation-lifecycle.ts`、`provider-composition.ts` | 実Consumerから準備・一回消費・短期状態・依存束縛を照合。単なる中継と判定した部分だけ統合 | Ownerごとの短期状態、Grant／Mount／Packet、失効・取消・一回消費。Factoryであることだけを削除理由にしない |
| `execution/delegation-route-selection.ts`、`model-selection.ts`、`delegation-selection-grant.ts` | 戦略・技術候補・今回の一回許可を区別。戦略の最終OwnerはObjective／Task、Cで切替 | 現在の選択Consumer、Profile／Provider／役割／回数とGrant発行・消費の対応 |
| `execution/advice.ts`、`provider-execution.ts` | 共通化できる実行・取消・結果処理と用途固有検査を分けて評価 | 読取り範囲、固定Context、Profile／通信Hash、一回送信、元Host参照。編集経路への置換はしない |
| `execution/recovery.ts`、`diagnostics.ts` | 単発実行の回復接続と診断の編成を維持し、下位Ownerとの重複だけ確認 | 元失敗、unknown、exact参照、観測不能と不存在、許可と回収の順序 |
| `execution/development-*` | Scripts専用処理だけ移管候補。現在Taskが使う制限・観測・Session結合は名前だけで外さない | Runtimeの直接／動的Consumer、計測予約・回数／期限・取消、Source／Native同一性 |
| `external-send/` | C前維持。CでDecisionへ直接吸収し、不要な公開中継を残さない | 同意Store、Policy、Grant、Scope／通信Hash、失効、Process poison。下位の技術強制と同意を混同しない |
| `storage/` | 今回凍結。Cの入口統合後に二State／Writerの統合可否を評価 | §24.6の全保存保証。現Owner維持も正式な結果とする |

§22.2の元観測についての「Cで登録と照合を同時移管」は当時の移行候補であり、現在判断は本表を優先する。同じ私有寿命と照合時点を再現できる場合だけCの配置変更を評価し、Controller再統合を予定処置にしない。

### 24.4. Orchestratorの処置候補

| 現行範囲（`orchestrator/src/`内） | 目標責務への対応候補 | 維持する境界・確認待ち |
|---|---|---|
| `objective/`、`task/`、`decision/`、`workspace/` | 現Ownerを基礎に維持 | Objective受付と計画、Taskの進行、人間判断、作業対象・Candidate寿命。似たRequest／Attempt名だけで統合しない |
| `task/execute-attempt.ts`、`executor.ts`、`host-adapter.ts`、`request-composition.ts` | Cで旧CoordinatorのAttempt／本番組立てと一本化候補 | 開始通知、取消join、結果正規化、元Capability／配送と本番Singletonを全Consumerで照合。廃止予定Adapterを先行再実装しない |
| `activity/{read,validate,cursor,types}.ts` | 既存の状態照会への配置候補 | Root公開、MCP／Workbench、EI履歴、出所、Cursor・全体paging、欠測／競合。単純getterへ縮小せず、履歴をstate正本へ混入しない |
| `identity/clock-and-hash.ts`、`repository-binding.ts`、`observe-principal.ts` | 実利用元への統合候補 | 時計・Identity・Hash／Bindingのbytes、Principal観測の保護Store、共有Consumerと型契約を確認するまで削除しない |
| `input/plain-data-snapshot.ts`、`repository-relative-path.ts` | 既存Domain APIか実利用元へ統合候補 | Proxy／Accessor拒否、閉じたSnapshot、Path文法と境界判定が同等かを先に比較。類似名だけで置換しない |
| `lease/controller.ts` | 保存に結合するLease型・利用契約として配置を評価 | 実OS排他の再実装ではない。現在State／Writerと利用側の契約を維持し、Storage本文の凍結に触れる変更はCへ保留 |
| `queue/types.ts` | Taskへ移す候補 | Queue受付世代、優先・予約とTask参照、公開型・全Consumer |
| `platform/windows-adapter.ts`の技術部分 | 既存PA／DIのAPIで代替可能か評価 | 新たなOS技術やDocker管理を上位に作らない。元観測と上位用途保証を一括移管しない |
| `platform/contract.ts`と上位用途の組立て | 実利用元の用途別契約として配置を評価 | Objective／Taskの必要保証と注入契約は技術Ownerへ押し付けない。部分対応と未対応の拒否を維持 |
| `process/safety-contract.ts` | C時のExecution利用契約へ同居候補 | 現在は型Port。重複実装とみなさず、Process相関・poisonの寿命を保持 |
| `state/`、`storage/` | 現在のモデル／投影／保存保証を維持 | 物理Writer・Schema・CAS／ACKは凍結。State内の純粋操作を動かす場合も保存形式や遷移条件を変えない |
| Rootの`operation-result.ts`、`operation-result-contract.ts` | 共通公開結果として実Consumerを確認し、利用元へ同居可能か評価 | Domain／Transportへの逆依存を作らず、公開結果・reasonを保つ。Rootを空にするための移動はしない |

小Folderの廃止は目標Treeだけを根拠に実行しない。共有型・値文法・読取り境界を失う、依存閉包が広がる、Source相関を再導出できない場合は現Ownerを維持し、必要な修正を次の固定候補へ含める。

### 24.5. 実施順と各出口

| 順序 | 実施単位 | 完了・停止の条件 |
|---|---|---|
| 1 | 両After・責務境界・移行候補の固定 | 今回の文書単位。基準Tree、添付との差、Ownerと候補、保持条件を独立確認。Source整理済みとはしない |
| 2 | 旧Coordinatorの単発Execution整理 | 表の候補をConsumer・実保証で絞り、不要な中継・重複だけ削減。利用側・公開API・Symbol／Catalog・試験・設計を同じ候補へ接続し、回帰・独立レビューを完了 |
| 3 | Orchestratorの小Folder・接続整理 | 上位の進行を変えず責務配置を明確化。EI／Surfaceを含む公開Reader閉包を確認。Cで不要になるAdapterの再実装や空Executionを追加しない |
| 4 | Cの実行入口・Package統合 | 単発Executionと上位Taskを接続し、旧Package参照を撤去してCoordinatorへ改名。公開入口・全Consumer・正常／失敗／取消／回復・元観測／配送まで閉じる前に旧処理を削除しない |
| 5 | 永続化関係の最終評価 | Schema、寿命、原子性、Recovery、ACKを比較し、統合又は別Owner維持を根拠付きで決める。単一state／Writerを既定解にしない |

各実装単位は固定候補を独立レビューへ渡し、是正の具体化で新しい境界が生じたら着手前に再照合する。C前は公開集合・契約・永続意味を維持する。Cの公開入口切替は採用済み目標に従うが、Authority・同意・ACK・unknown終了・Schema bytesの意味変更が必要なら実装前に影響と代替を人間へ返す。AI再試行・実Docker操作・保持物削除の承認をこの文書から推定しない。

### 24.6. 凍結と検証の境界

Storage凍結はCoordinatorの二SourceとOrchestratorの物理保存基盤、Schema bytes／Hash、Lock・CAS、pending／marker、履歴の行・時刻、耐久受領ACK、操作除去・unknown・回復参照の条件を対象とする。移動のために新しい共有State、Registry、Lock、汎用Writer、Recovery Framework又は互換barrelを作らない。元の私有WeakMap・Singletonを複製せず、Writer内確認を外側の事前計算boolへ変更しない。

専門検討では、単なる同名Fileの一括統合、全領域の現状維持、今回の順序付き整理を比較した。一括統合はTask進行と単発実行、現在状態と履歴、元観測と保存の別保証を混合する。現状維持だけでは最終構成への移行と人間の探索性改善が進まない。既存の責務別配置、具体Owner、Consumer閉包とlifecycleの原則を用い、保証を維持できる単位だけを順に整理する方針とした。残る不確実性は関数単位の重複・移管可能範囲であり、各候補の実装前調査を再評価契機とする。

今回は文書のみを検査し、Source・試験・設定・保存データは変更しない。§23の実行結果は基準版のEvidenceであり、将来の移管後の成功根拠には流用しない。既存のDynamic Fake coverage OPEN、命名検査三件、全体文書検査の不合格、実境界・全体QA未完了を維持する。人間による追加判断は現時点では不要である。

### 24.7. 文書単位の確認結果

変更分類はArchitectureの目標・移行計画の更新とし、契約・安全境界の独立レビュー、文書構造と直接利用側への影響確認を別の読取り専用確認者が実施した。State／Storage表の単一Writer化への誤読一件を、両確認者が合意した二行分離で是正し、最終再レビュー残指摘0。準拠基準・Releaseを変更しないため、準拠監査・Release監査は実施していない。

Checkerは今回五文書の診断0、参照展開された歴史文書等の全体3,340診断によりexit1。全体文書Passとは表示しない。`git diff --check`は成功し、差分は五文書だけでSource・試験・設定は不変。目標・順序を定める文書単位を限定完了とし、次は§24.3の旧Coordinator候補の関数・Consumer・保証照合から着手する。新しいSource整理・C切替・永続化関係の最終評価は未実施である。

## 25. 旧Coordinatorの統合前縮小

### 25.1. 着手前照合と編集単位

基準Sourceは`b2b603c10`、§24の承認済み文書変更を保持して順序2へ進む。変更分類は内部の具体Factory配置・純転送・重複拒否生成・未使用module公開の縮小である。Architectureと直接利用側・既存試験を照合し、独立した読取り専用確認の結果を次の六単位へ統合した。初回編集前にStorage七SourceとCoordinator RootのHashを捕捉し、保存意味・Root公開集合の不変を確認する。

| 編集の一次対象 | 実施処置 | 保持条件・確認面 |
|---|---|---|
| `provider-composition.ts`の二Factory | 本番Consumer一つである`provider-adapter.ts`へ実体を同居し、旧FileとFile Symbolを撤去。直接UT／ITのimportを追従 | 関数本文、名前、Ownerごとの二WeakMap、依存参照、本番Codex→Claude生成順・生成位置を維持。Map／依存の共有やhoistをしない |
| `task.ts`のStart／Completion投影二alias | Controllerの実体を同じ引数・同じ位置で直接呼ぶ。取消fixture／Controller ITも実体へ接続 | `isProductionProcessContract`分岐、相関、不正値母集団、元観測を維持。同じ実体を二度試すだけの配列重複は除く |
| `advice.ts`のRequest／Dispatch拒否二関数 | 同じ`result("blocked", reason)`を返す私有生成一つへ統一 | reason、結果field・空配列、unknownとの区別、ProviderのEffect／cleanup付き結果を変更しない |
| `provider-execution.ts`の本番Factory末尾 | 作成したRuntimeへの純転送closureだけを除き、同じRuntimeを返す | 不正Root分岐、依存生成時点、元Signal、観測callback、呼出し回数と取消joinを維持 |
| `advice.ts`の未使用固定説明 | Root／本番／試験Consumerがない`describeProviderAdviceAdapterContract`と専用定数二つだけを撤去 | 実選択・Profile検査・送信Gateは維持。近似する安定test ID・過去Evidenceは変更せず、代替descriptorを作らない |
| Controller／Plan／選択三Fileの外部参照0宣言 | module内だけで使う定数九件と結果型一件から`export`だけを外す | 値・型本体・契約bytes・describe関数は維持。grantが参照するrouteのContract本体はexport維持 |

編集依存はFactory実体同居→直接import／Symbol、投影alias撤去→Task／fixture／IT、私有拒否統一→同じFileの全呼出し、独立した公開修飾縮小の順とする。挿入や置換は具体宣言を一次対象とし、同名の別責務・歴史資料へ機械置換を広げない。

診断をCLIへ戻す案は採用しない。診断の実行・Operation・回収は§23の採用済みExecution Ownerであり、CLIだけが直接呼ぶことは受付責務へ戻す理由にならない。`development-*`はScript起点でも本番Task／Recovery／Native観測と同じSession・Capabilityを使うため維持する。選択戦略の上位移管とAttempt接続はC時とし、準備Lifecycle、元観測、助言・編集の異なる処理順を共通Frameworkへ統合しない。

回帰はCodex／Claude準備、借用Workspace、Controller投影・取消・元通知、Task本番／取消、Advice入力・Dispatch・Provider実行・公開入口、選択三契約、Root／Source／Symbol／Consumer閉包へ導出する。移管二関数の本文同一性とStorage／Root Hashを併せて確認し、固定候補の技術独立レビューと文書・直接影響確認を行う。今回の内部実装で準拠基準・Releaseを変えないため、準拠監査・Release監査は行わない。実AI・Docker・②保持物操作は対象外である。

### 25.2. 実装と限定回帰の結果

六単位を適用し、Coordinator Sourceは83→82（Execution71→70）、Orchestratorは71で不変となった。旧compositionの実体はAdapterが引き取り、旧File／File Symbol一件と重複する二つのverifies辺を撤去した。両試験Suiteは既存Adapter Symbolで移管後の同じ責務を検証する。候補二Factoryの本文は改行を正規化したSHA-256で移管前後一致、準備SingletonのCodex→Claude生成位置と各依存Factory呼出しはSource差分で不変を確認した。

| 確認範囲 | 今回の結果・根拠 |
|---|---|
| 静的・Trace | format、Source／試験の型検査、lint、Runtime／Orchestrator設計Trace成功。既存lint info63件は維持 |
| 影響回帰22 Suite | 455件成功、失敗0・skip0。Provider両準備、助言・選択・Packet・結果、Controller、借用Workspace、Task実行・取消、公開Catalog結合、Source／Symbol集合を確認。実AI／Dockerの成功ではない |
| 直接利用側 | Orchestrator公開境界6件とVersion Control利用側閉包12件、全18件成功 |
| 凍結対象 | Coordinator Storage二File、Orchestrator Storage五FileとCoordinator RootのHashが着手前から不変。Hash比較だけで実資源や全体品質の成立を推定しない |
| 参照とOwner | 旧composition Path／Symbol、Task二alias、削除した助言descriptor三宣言の現行Source・試験・台帳参照0。二Factoryへの直接UT／ITと同じProvider別Map非共有・本番Owner参照のOracleを維持 |
| 文書 | 変更五文書の診断0、参照展開された歴史文書等の全体3,340診断によるexit1を維持。全体文書Passではない |
| 独立確認 | Factory／契約、Task／助言、文書／直接影響の読取り専用確認を実施。QA一文の根拠を静的照合と動的試験へ分離し、最終再レビュー残指摘0 |

部分件数は重複するため合算しない。今回の変更意味から上記回帰面を選び、本文同一性・凍結Hash・直接利用側と組み合わせて確認した。基準版で実行した全1,722件を移管後の全回帰として流用せず、同じ長時間全回帰を機械的に反復しない。Dynamic Fake coverage OPEN、既存命名検査三件、実境界・全体QA未完了は未解消のまま維持する。

準備Lifecycleと元観測は独立した保証Ownerとして保持する。Adviceと編集のLifecycle／Schemaを一つにせず、Development Sessionは本番Task／Recoveryと同じ私有状態を用いるためScriptsへ分断しない。選択戦略、Attempt接続、Recovery／Storageとの相関はCの切替単位へ留保する。六単位の統合前縮小を限定完了とし、次は§24.4のOrchestrator小FolderのConsumer照合へ進む。C・永続化統合・実AI再試行・Docker操作・②保持物操作は行っていない。

## 26. Orchestratorの小Folder照合と判断入口の整理

### 26.1. 着手前照合

基準は `badfae46a`。変更分類は判断入口への内部配置統合とし、公開名・結果・永続形式は維持する。Source契約と依存閉包の読取り専用確認を分離して実施し、次の処置へ統合した。Storage七SourceはHashを捕捉して凍結する。文書・直接影響とSourceの独立レビューを行い、準拠基準・Releaseを変更しないため準拠監査・Release監査は行わない。

| 一次対象 | 今回の処置 | 保持条件・再評価契機 |
|---|---|---|
| `identity/observe-principal.ts` | 同じ保護判断Storeを使用する既存 `decision/public-operation.ts`へ関数とHeaderを同居し、旧Fileを撤去 | Root公開名・本文・呼出しごとのStore観測・unknown・初期化可能性を維持。CacheやAuthorityを追加しない。Root再公開元、Symbol、現在形の責務表を追従 |
| `input/plain-data-snapshot.ts` | 現Ownerを維持 | Recordは意味同等だが、ArrayはDomain版のreason追加と不正上限受理に差がある。保存APIも含むDomain Rootを純粋閉包へ追加せず互換中継も作らない。Cの依存閉包見直し又はDomain契約統一を採用した時に再評価 |
| Queue／Lease／相対Path | Cへ留保 | 保存Sourceが直接参照しており、配置だけでもStorage本文の凍結に触れる |
| Clock／Process契約、Platform用途組立て | 現Ownerを維持してCで接続評価 | 型Portを重複実装と扱わず、Cで消えるAdapterを先行再実装しない |
| 活動Reader／Repository Binding／共通結果 | 具体Consumerと依存閉包の追加照合を継続 | 出所・EI履歴・Cursor・ページング、同じBinding bytesを維持。今回の一File同居を小Folder整理全体の完了とはしない |

編集順は関数の同居とRoot再公開元切替、旧File／Symbol／検査集合撤去、現在形Architectureの同期とする。元関数本文の同一性、Root exact公開集合、純粋・接続Source母集団、静的検査とOrchestrator回帰を確認する。実AI・Docker・②保持物操作は行わない。追加の人間判断は現時点では不要である。

### 26.2. 判断入口の整理結果

Principal観測を既存の判断入口へ同居し、Sourceは71→70 File。関数本文とHeaderは移管前後一致、Rootの公開元54 Moduleは更新済みの明示集合と一致し、既存の公開関数集合検査も成功した。旧Path／旧File Symbolの現行参照は0、Storage七Sourceのbytesは基準から不変である。接続分類表は先行CLI二Fileの記載漏れも補正し、実在する純粋36・業務11・接続19・保存3・Root1の全70 Fileと照合した。

| 確認 | 今回の結果と限界 |
|---|---|
| 通常回帰 | Orchestrator単体78・結合51、全129件成功、失敗・skip0。実Git・保存・別Process再入場を含むが、実AI・Dockerの成功ではない |
| 静的・依存 | OrchestratorとCoordinatorのcheck成功。既存lint infoはそれぞれ2／63件。Platform閉集合4件成功、Runtime／Orchestrator設計Trace accepted |
| 公開index横断検査 | Docker Isolationの既知二Module一覧不一致で失敗。検査を緩和せず未解消として維持。Orchestrator公開元54 Moduleの個別照合は一致 |
| 文書 | 変更三文書の診断0。関連展開78文書に303診断でexit1、全体実行も3,687診断でexit1。以前の別Scopeの3,340件と同一母集団の増減比較はしていない |
| 独立確認 | Source契約と文書・直接影響の確認を分離し、QA追従も再確認。残指摘0。実StoreやAuthorityについて新しい保証の成立は主張しない |

今回の一単位を限定完了とする。活動Reader／Binding／共通結果の配置評価は継続し、Queue／Lease／Path・時計／Process・PlatformのC時評価、C統合と永続化関係の最終評価は未完了である。既存OPEN、実境界・全体QA未完了を維持し、②の再試行・保持物操作は行っていない。

## 27. 活動照会と保存Bindingの配置整理

### 27.1. 着手前照合と編集対応

基準は`0dade058d`。内部Source配置の変更とし、状態照会と保存Bindingの具体Consumer、純粋閉包、公開Readerの本番接続を照合した。Source契約とArchitecture・直接影響の読取り専用確認を分離して実施し、次の五File移管へ収束した。公開契約・Schema・Authority・保存七Sourceは変更しない。File数削減は目的とせず、新たな中継・共有状態・Lock・Registryを作らない。

| 一次対象（Orchestrator src相対） | 配置先 | 保持する意味 |
|---|---|---|
| `activity/read.ts` | `state/activity.ts` | 現在状態とEI履歴の複合照会。履歴の正本はEIのままで、State Writer・履歴Storeにはしない |
| `activity/types.ts` | `state/activity-types.ts` | 公開観測・要求・出所の値契約。Root公開名・型Shapeを維持 |
| `activity/validate.ts` | `state/activity-validation.ts` | 観測の閉じた検査、Proxy／Accessor拒否、unknownと欠測・競合 |
| `activity/cursor.ts` | `state/activity-cursor.ts` | Source相関、日時順・全体ページング、Cursor bytes。認可やSnapshotへ昇格させない |
| `identity/repository-binding.ts` | `state/binding.ts` | 同じexact Rootの保存Binding導出。認証・認可IdentityやRoot能力ではない |

五Fileはimport以外の本文を維持し、各Consumerの参照先、Root再公開元、SymbolのPath、全数分類・公開Module一覧、VC Consumer閉包を同じ候補で追従する。安定Symbol ID・公開関数名・Hash入力・実行順・開始前取消と読取り終了の契約を変えず、旧Path wrapperは残さない。共通結果二FileはStorageの直接参照があるため現Ownerを維持する。時計・Process・Platform用途組立てとQueue／Lease／PathはC時の接続又は凍結解除後の評価へ留保する。

編集は五Fileの実体移動→全直接参照と機械集合→Architecture／QAの順とする。移管本文の一致、Storage七Source不変、Root exact公開集合・Module一覧、型・format・lint・Trace、Orchestrator通常回帰、VC Consumer閉包、MCP／Workbenchの活動接続を検証する。Sourceと文書・直接影響の独立レビューを行う。準拠基準・Release変更がないため準拠監査・Release監査は実施しない。実AI・Docker・②保持物操作は対象外で、追加の人間判断は現時点では不要である。

### 27.2. 残る小Folder・共通結果の維持判断

`operation-result.ts`は保存・Lease・判断等が受け取る`value`付きの共通結果型、`operation-result-contract.ts`は公開操作のContractと保存境界エラーの非秘密投影を所有する。前者の内部受領と後者の公開応答は同じ結果Shapeではなく、同名の責務重複ではない。Rootを空にするための移管や、型だけのFileへの公開投影の混入は行わず、二Fileを維持する。

残る`identity/clock-and-hash.ts`はObjectiveとTaskへHost時計・決定論的IDを渡す型契約、`process/safety-contract.ts`は元Process相関とpoisonの型契約である。OS実装の重複と扱わず、Cの実行接続と同じ単位で配置を評価する。`platform/`には既存PA呼出しに加えて上位の必要保証・注入契約があるため、Folderごとの下位移管はしない。Queue・Lease・Pathは保存の型・文法にも直接結合し、SnapshotはDomain版との契約差と純粋閉包の理由で維持する。これらは未調査の放置ではなく、現在の利用責務又は明示した凍結による維持判断とし、Cの接続変更を再評価契機とする。

### 27.3. 移管と回帰の結果

五Fileを同じ実体のまま移管し、旧`activity/`を撤去した。Sourceは70 Fileのまま、`state/`は既存六Fileと移管五File、`identity/`は時計型契約一Fileとなった。冒頭File説明とimportを除く本文は五Fileとも基準と一致し、Rootは再公開元以外不変、明示公開Module54件の集合も一致した。Storage七Sourceはbytes不変、現行Source・配布入口・手順の旧Path参照は0である。安定Symbol IDと検証の辺は維持し、Pathだけを更新した。

| 確認範囲 | 結果・限界 |
|---|---|
| Orchestrator通常回帰 | 単体78・結合51、全129件成功、失敗・skip0。現在状態・EI・Cursor・Binding・Objective／判断／Workspace・公開入口を確認。実AI・Dockerの成立ではない |
| 利用側6 Suite | Platform閉集合、VC Consumer閉包、MCP活動Adapter・認可接続、Workbench管理接続・Server契約の74件成功。開始前／開始後取消、Reader終了、Exposure・失効と公開結果を含む。上記129件との件数を品質量として合算しない |
| 静的検査 | Orchestrator・Coordinator・MCP・VCのcheck成功。Runtime／Orchestrator設計Trace accepted。Workbenchのformat／型検査は成功、lintは下記二件で失敗 |
| 既存の横断検査 | 命名・Header等22件は19成功・3失敗。PAの`host-record.rs`、DIの公開二Module一覧、既存Test Header不足を維持。検査の母集団や安全条件は緩和していない |
| 文書・独立確認 | 現在状況を含む変更四文書の最終診断0、関連展開94文書の313診断によりexit1。Source契約と文書・直接影響の独立レビュー残指摘0。全体文書・全体QAの合格ではない |

Workbenchの二lint指摘は`src/client/components/project-context.tsx`の行・セルの配列番号Keyであり、そのFileは基準`0dade058d`とbytes一致する。今回の移管で導入した故障ではなく、Workbenchの表示Keyを再評価する際にOwner側で是正する残件として記録する。今回の型接続・活動回帰の成功を、Workbench全体checkの成功へ読み替えない。

§24.5の順序3をC前の内部配置整理として限定完了とする。維持対象は§27.2の根拠に従い、Cの入口・Package統合と同時に必要な接続を評価する。C本体・保存の最終可否評価・既存OPEN・実境界と全体QAは未完了であり、実AI・Docker・②保持物操作は行っていない。現在、人間による追加判断は必要ない。

## 28. C統合の三接続対応と切替条件

### 28.1. 基準・変更経路・収束範囲

基準`664820ba1e6dc3cefb62ce163dc89821deee10ae`のSourceと公開入口、既存のCapability対応と検証先を照合する。今回はArchitecture・Quality・計画の設計更新で、Source・試験・設定・Runtime状態は変更しない。単発実行、上位Taskと耐久受領の専門観点を読取り専用確認者へ分担し、結果を本表へ統合した。設計契約・文書構造・直接影響の独立確認を行い、準拠基準・決定権限・Releaseは変えないため準拠監査・Release監査は行わない。

比較した案は、名前の似た二実体を一つへ潰す案、二Packageを維持する案、責務を維持してPackage境界だけを除く案である。第一案はTask相関と単発Lifecycle、ACKと技術回収を混合し、第二案は採用済みC目標を達成しない。第三案を基礎とし、実際に無判断な参照だけを除く。File数減少や将来の一般化を完成条件にしない。

### 28.2. 三組の処置対応

以下のPathは現Package内の`src/`相対。最終Ownerと契約は[Architectureの三接続契約](../../../06_Architecture/Details/coordinator/03_Task_Architecture.md#c-integration-three-connections)が所有する。

| 現在の組 | 残す実体・統合後Owner | 削減対象・削除条件 |
|---|---|---|
| 上位`task/execute-attempt.ts`／旧下位`execution/attempt.ts` | TaskのIdentity・対象変換・同期配送捕捉・上位結果と、Executionの開始／完了検査・初回通知・取消join・cleanup正規化を両方維持 | Taskから旧Root経由のimportを統合後のExecution実体へ直結。Task入力・結果契約は保持し、二Fileの片方を丸ごと削除しない |
| 上位`task/request-composition.ts`／旧下位`execution/task.ts` | Task受付は`requests.ts`、実行方針・Profile／Root／認可の再観測はTask組立て、元OperationとProvider順序・回収はExecution | consumerと実行対象を束縛するclosureは維持。旧Package依存だけ切替。単なる`startTask`関数参照への置換は禁止 |
| 上位`task/settle-docker-recovery.ts`／旧下位`execution/recovery.ts` | Task義務・世代・受領ACK・次処置と、Executionのexact技術回復・元参照・解放・履歴・配送を別Ownerで維持 | 上位からの既存Settlement操作は同Package内の同実体へ直結。正常Controlの配送とProcess喪失後の耐久入口は統合しない |
| 関連`task/recovery-adapter.ts` | 既存Port型と欠測／観測例外の意味を維持。具体Root／Binding束縛は既存Objective組立てへ同居できるか評価 | Factory・依存型は公開Root、本番受付・専用UTのConsumerあり。実Consumer・公開API・試験の移行後に削除可否を確定。削除済み／不要とは扱わない |
| 関連`task/host-adapter.ts`、`execution/provider-execution.ts` | 時計／IDと元Process／poisonの用途組立て、Providerの固定依存と元観測を維持 | Package境界だからという理由だけで削除しない。Map・依存・生成順の共有化や再生成を行わない |

現物には旧名`provider-execution-recovery.ts`は存在しない。実体は`execution/recovery.ts`、依存組立ては`provider-execution.ts`、通常Taskの配送閉包は`execution/task.ts`にあり、調査上の旧名をSourceへ復活させない。

### 28.3. 値・通知・配送と失敗の対応

| 段階 | 保持する接続と反例 | 検証の既存Owner |
|---|---|---|
| 受付前 | Task Identity／Revision不正では開始0。Profile改訂・Root・認可・Signalを実行前に再確認 | 上位`tests/integration/single-task-state.integration.test.ts`、旧下位`tests/integration/orchestrator-objective-intake.contract.test.ts` |
| 開始 | 元Control存続中に配送参照を捕捉。欠測・null・throw・Accessor／Proxy、通知例外を開始前Effect 0へ読み替えない | 旧下位`tests/integration/orchestrator-execution.contract.test.ts`とTask／Controller契約 |
| Provider通知 | Executor初回と重複・Reviewer先行／後続・欠測・false・throw・終端後を区別。同じ保存Promiseへ結合し、開始通知を受領ACKと扱わない | 同Execution試験と既存Controller／Task試験 |
| 取消・終端 | 開始前／開始直後／完了競合、一回取消、cancel throw／reject、completion reject。監視解除と元完了joinを維持 | 旧下位の単発Attempt・Task取消試験、移管後の公開CLI／Surface試験 |
| 結果 | cleanup不明・回復参照・Workspace ID差・余剰field／Accessorを反証し、同じAttempt／Operationと相関。consumer第5／対象第6引数の誤接続を拒否 | 上位Workspace結合、旧下位Execution試験、Workbench／MCP Task試験 |
| 回復 | 重複相関・別consumer・Root／Binding／世代／Attempt差、観測不能と不存在を区別。技術回収済みでも上位保存不明は義務を閉じない | 上位`docker-recovery-settlement.contract.test.ts`、旧下位`current-recovery-resources.contract.test.ts`・`docker-recovery-owner-reentry.contract.test.ts` |
| 受領・再入場 | 受領保存失敗は配送pending維持。ACK保存後の終了失敗は同じ記録で終了だけを継続。Provider・資源回収を再実行せず、CapabilityをIDから復元しない | 旧下位`tests/system/orchestrator-recovery.contract.test.ts`、上位Objective・回復・保存試験 |

既存の過去試験結果は母集団と保証の把握にだけ使い、C後の実測へ流用しない。必要な実境界試験は固定した接続候補から選び、実AI・Docker操作は対象・回数・送信・回収条件を示して別途承認を得る。②の再試行・保持物操作をCの承認へ含めない。

### 28.4. Storage凍結と実装の順序

C前の七Source完全bytes一致は当時の検証根拠であり、物理Package統合後まで同一specifierを残す命令ではない。Cでは保存処理・関数本文・Schema・Writer・CAS・Lock名／順序・保存Root・状態語彙・回復参照を凍結し、同一実体へ解決するmodule specifierだけを追従する。これは採用済みPackage統合に必要な一意の変更であり、新しい保存方式・移行Reader・互換層は作らない。

| 現在の参照 | Cで必要な追従 | 禁止する変更 |
|---|---|---|
| 上位`storage/current-state.ts`→旧下位RootのKernel Lock | 同一Symbolを統合先`execution/kernel-lock.ts`へ直接import。旧文字列維持による自Root逆参照を避ける | Lock実体のコピー、初期化順変更、boolの事前計算でfresh検査を置換 |
| 上位`storage/protected-decision.ts`→旧下位のKernel Lock・Protected Root | 同Package内の同じ技術実体へ相対参照を追従 | 保護Root・Principal・Writerの契約変更 |
| 残る保存Source | 具体移管候補でspecifierの解決を全数照合。変更不要ならexact bytes維持 | 本文・Schema／Hash・読戻し・履歴・ACK条件の変更 |

実装は、(1) Executionと本番Singletonの移管先・全公開Consumerを固定、(2) Source実体と全参照・配布入口・npm／試験／台帳を同じ切替候補へ移管、(3) 上位組立てのRoot経由参照を実体へ直結、(4) 公開API・試験を追従して削除条件を満たした中継だけ撤去、(5) 旧Package撤去・改名と全入口／再入場を確認、の順とする。未接続の中間Treeを完成と表示せず、新しい恒久Facade・空Package・互換Serverを追加しない。

Source初回編集前には残るCLI・公開Root・外部送信同意・Package設定の全数切替表を固定する。今回の三組だけでC全体の設計・実装完了とはしない。Runtime Rootの読取り実測では旧下位15名・上位105名で同名0だが、型export、内部限定化の可否、外部Consumerの閉包は別途確認する。数の単純合算を最終公開APIへしない。活動の名称もCの公開照会契約と併せて評価し、今回`execution-history`へ改名しない。

今回は五文書だけを更新し、Source・試験・設定・Runtime状態とStorage七Sourceは不変である。現在、人間による追加判断は必要ない。保存意味・Authority・同意・公開結果・完了条件を変える必要が判明した場合は、その変更前に影響と最小代替を示して停止する。

### 28.5. 文書単位の確認結果

三観点の独立確認を完了し、引数説明の対象を内部`startTask`コールバックと本番関数へ限定する軽微指摘一件を、全確認者が整合確認した一文修正で是正した。三接続の責務・回復／受領・文書／直接影響の残指摘0。Source・試験・設定の差分0、Storage七Sourceは基準とexact bytes一致、`git diff --check`成功である。

Checkerは変更五文書の診断0、関連展開137文書の3,340診断によりexit1。これは異なるScopeでの実行であり、§27の94文書・313件との差を新たな劣化量として扱わない。今回は文書単位のため実行系回帰を再実行せず、既存の129件・74件等をCの成立根拠にしない。Cの三接続設計だけを限定完了とし、次は§28.4のCLI・公開Root・同意・Package設定と保存specifierのexact全数表を固定する。CのSource実装、実境界、E2E、全体QA・Releaseは未完了である。

## 29. Cの入口・公開API・同意・設定の切替表

### 29.1. 基準と編集境界

基準は§28と同じ`664820ba1`。CLI、公開API、同意と設定の三観点を読取り専用で照合した。以下はSource切替の編集表であり、実装済み・検証済みの表示ではない。変更分類は採用済みPackage統合の具体化で、既存の意味・保存・権限・終了条件を維持する。Architectureは責務と接続、QAは検証義務、本表は編集順と追従先を所有する。文書・契約と直接影響の独立確認を行い、準拠基準・Releaseを変更しないため準拠監査・Release監査は行わない。

CLIを旧下位四Fileへ無理に集約する案は採らない。上位の受付を取り込むため、六Fileと単一binを目標にする。APIも二Rootの単純合算や未使用名の一括削除を行わない。新しい互換中継、Registry、Lock、State、起動Processは作らない。②のAI再試行・保持物操作、実Docker・認証・外部送信は今回の文書更新に含めない。

### 29.2. CLIの編集対応

| 一次対象 | 統合後の処置 | 保持条件・検証先 |
|---|---|---|
| 旧下位`bin/coordinator.ts` | 単一入口として維持 | `runCoordinatorCommand`をtop-levelで一回awaitする実行入口。import-only Effect 0は処理Moduleに要求し、bin自身には要求しない |
| 旧下位`cli/command.ts` | 起動用途の選択・固定Script振分け・Project／Task受付の唯一のDispatcher | 下位binの現`task_use_orchestrator_entry`拒否を、本番上位受付への接続に置換してからtemplateを薄くする |
| 上位`cli/command.ts` | 実受付を`cli/request.ts`へ移管 | `runProjectCommand`／`runSingleTaskCommand`の業務呼出しを維持。新しい転送だけのFileにはしない |
| 上位`cli/request-input.ts` | 同名で維持 | 128KiB、EOF、UTF-8不正、曖昧JSONの拒否。stdinを別Readerへ複製しない |
| 旧下位`cli/{options,recovery-report,cancellation}.ts` | 三Fileを維持 | doctor引数・非秘密回復表示・Signal一回取消と登録Rollback／解除を保持 |
| 上位`cli/command-report.ts` | 旧Human表示・descriptor・専用型を撤去する候補 | 本番四呼出しは全てJSON指定。`request.ts`で同じJSON bytesと終了値を直接出力し、旧Candidate export／discard案内を復活させない |
| `template/tools/crdd-coordinator.ts` | 実Dispatcher接続後に同じ単一binへ委譲 | 現状はtemplateだけがProject／Taskを上位へ振り分ける。先に薄くすると機能を失う。旧署名対象という説明も現責務へ追従 |

目標CLIは`command.ts`、`request.ts`、`request-input.ts`、`options.ts`、`recovery-report.ts`、`cancellation.ts`。doctorのHuman表示は維持し、Project／Taskの未使用Human表示と混同しない。

| 受付経路 | 切替後に維持する条件 |
|---|---|
| direct／interactive／automation × project／task | 六経路とも同じ受付へ到達。Node版、TTY、automationのJSON条件、元stdin・cwd・環境・PIDを維持。Workspace未指定を暗黙Directへ変換しない |
| doctor／capabilities | 既存の技術診断・回復・取消と回復参照を維持。観測不能を正常へしない |
| verify-routes／verify-recovery／authenticate-claude | 現在の固定Scriptと引数・TTY条件へ接続。同Processの`argv`とmain guardを維持。署名・Release用途を追加しない |
| 処理Moduleのimportのみ／不正用途／受付後例外 | `cli/command.ts`・`cli/request.ts`等はimport時Effect 0。binは一回起動するため対象外。用途拒否64、受付後例外2。Project引数拒否64、blocked／unknown2、成功0を保持 |

旧Human専用UTは、その表示契約が不要になったことを確認して撤去する。取消ITとTask Process ITは、Human文字列assertだけを外し、元結果・回復参照・cleanup・機密非公開のassertを実JSONへ接続する。`coordinator-launch`、`interaction-boundary-regression`、`cli-options`、公開Owner境界、耐久基盤、VC利用側閉包の試験を移管し、Catalog／Symbol／QAの分類も同じ候補で追従する。

### 29.3. Root公開集合と内部直結

現Rootは旧下位15実行値＋6型、上位105実行値＋91型。実行値の同名は0だが、型と公開義務を別に照合する。現在の外部本番利用から確認した最低保持集合は次の23実行値＋6型であり、これだけを最終公開集合と決めたものではない。

| 出所 | 統合Rootへ保持する名前 |
|---|---|
| 旧下位・実行値2 | `isSupportedCoordinatorNodeRuntime`、`readRepositoryNetworkPolicies` |
| 旧下位・型2 | `CoordinatorWorkspaceResult`、`RepositoryNetworkPolicies` |
| 上位・公開操作／検査11 | `observeRuntimeOwnedProjectClientPrincipal`、`runOrchestratorPublicDecision`、`runOrchestratorPublicObjective`、`runOrchestratorPublicStateQuery`、`inspectOrchestratorDecisionRequest`、`inspectOrchestratorObjectiveRequest`、`inspectOrchestratorWorkspaceResults`、`inspectOrchestratorStateQuery`、`inspectOrchestratorStateQueryResult`、`isOrchestratorObjectiveProjectionCorrelationValid`、`isOrchestratorProjectionSemanticallyValid` |
| 上位・Workspace／照会／受付5 | `inspectWorkspaceCommand`、`executeWorkspaceCommand`、`readAuthorizedRuntimeActivity`、`parseRuntimeActivityObservation`、`createRepositoryTaskRequests` |
| 上位・Contract／上限5 | `ORCHESTRATOR_HUMAN_DECISION_CONTRACT`、`ORCHESTRATOR_MAXIMUM_OBJECTIVES`、`ORCHESTRATOR_MAXIMUM_TASKS`、`ORCHESTRATOR_OBJECTIVE_INTAKE_CONTRACT`、`ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT` |
| 上位・型4 | `OrchestratorProjection`、`RuntimeActivityObservation`、`WorkspaceCommand`、`WorkspaceView` |

旧下位の残る13実行値と`CoordinatorTaskDependencies`はTask／Objective／Storageの内部Consumerを同じ実Ownerへ直接接続できる。`CoordinatorTaskAttemptInput`／`Result`／`RecoveryObligation`のRoot公開撤去は条件付きであり、定義本体の削除ではない。上位のTask遷移・実行、State／Storage、Clock、Lease、Process、判断・回復Adapter等も、同Package内の利用側は実Ownerへ直接接続する。

外部本番Consumerがない公開名でも、Acceptance・Replan・Human Decision・Platform保証・Execution／Queue／Recovery等のContractと専用試験は直ちに不要としない。Cの最初の接続候補では既存公開名を保持し、各宣言について「外部公開保証の試験」又は「内部実体の試験」を照合し、後者を実Ownerへ追従できたものだけRootから外す。保証の廃止判断が必要なものは保持して報告し、利用0だけで廃止しない。名称だけを理由とする全Symbol改名は本切替へ混ぜない。

閉包確認はnamed importだけでなく、`coordinator-state-runtime.contract.test.ts`のnamespace展開、Workbenchのinline type import、templateのdynamic import、Root全キー固定試験を含める。MCP、Workbench、template、scripts、testsの利用側を新Root又は内部Ownerへ対応させ、外部保持と内部非公開の両集合を検査する。既存二Rootの集合を単に足した期待値は使わない。

### 29.4. 外部送信同意と端末Owner

| 旧下位の一次対象 | 統合後の配置 | 保持する意味 |
|---|---|---|
| `external-send/consent-record.ts` | `decision/external-send-consent-record.ts` | 同意Recordの値・検査、Hash入力 |
| `external-send/consent-store.ts` | `decision/external-send-consent-store.ts` | 同意保存・読戻し・失効、既存Lockと保護Rootの順序 |
| `external-send/grant.ts` | `decision/external-send-grant.ts` | 元Task／role／attempt／operationへ結合したGrant・期限・一回性 |
| `external-send/policy.ts` | `decision/external-send-policy.ts` | Repository追加通信先と送信範囲の方針。同じ公開APIをRootへ明示export |
| `external-send/console.ts` | `execution/interactive-console.ts` | PA端末I/O・timeout・取消・終了確認。cleanup不明時に同じProcessをpoison |

`decision/`既存のAcceptance／Recovery Recordと区別するため意味のある接頭辞を維持する。端末技術は同意判断そのものではなく、Grantから既存実体をprivate importする。policyHash・Task scopeHash・consent boundaryHashを統合せず、sourceFileHashを同意Hashへ混ぜない。同じGrant WeakMapとProcess安全状態を保持し、役割間共用やIDからの再生成をしない。

`execution/task.ts`・`task-packet.ts`・`advice.ts`、失効Script、WorkbenchのRoot利用、同意／Packet／端末／poison試験を同じ切替候補へ追従する。配置変更を同意省略・認証情報の送信許可・自動再送へ拡張しない。

### 29.5. Package・試験・保存参照

| 一次対象 | 処置・終了条件 |
|---|---|
| package.json二件・lock二件 | 最終名`@qual-lab/crdd-coordinator`、`.`と`./cli`の明示公開を維持する単一Manifest／lockへ。Node下限・TypeScript・Biome版は変更しない。各scripts keyの目的・対象・許可条件を照合して統合し、単純なglob和集合でHost試験を通常回帰へ混ぜない |
| tsconfig四件 | production strict・全tests・Docker Host専用の三用途へ統合。上位src／testsとbin／scriptsの型検査漏れを独立に確認。旧strictの明示filesと上位includeを照合し、checkerのtemplate用extendsも追従 |
| 共通Biome・ignore | Root `biome.json`の`40_Develop/**/*`適用とRoot `.gitignore`の`.crdd/config`明示allowlist／`**/node_modules/`を本文不変で維持。旧下位Package-local `.gitignore`は`node_modules/`一行だけでRoot規則と重複するため、旧Package撤去時に同時削除し、最終Packageへ複製しない。保存先・Schema名・Git追跡対象を同時変更しない |
| symbol.json二件 | 安定ID・意味と検証辺を保持し、実PathとOwnerを更新。欠落・重複・旧Pathを照合し、単なるJSON連結にしない |
| tests・scripts | testsは190＋19の計209 TS File、相対Path完全衝突0を基準に移管。Script実File32件は現用途を保持し、相対参照・入口・固定argv・Trace／coverage母集団を追従。npm scripts key数とは別集合で扱う |
| Native接続 | Rust実体はPlatform Accessに維持。Cargo manifest・target・固定実行物と試験Fixture参照を再解決し、Package移動をRust複製・再Build許可としない |
| Storage七Source | 下記三specifier以外のbytesと意味を維持。設定・State統合・互換Reader・記録移行を本単位へ追加しない |

保存の許可変更は上位`storage/current-state.ts`の`../../../coordinator/src/index.ts`→`../execution/kernel-lock.ts`一件、`storage/protected-decision.ts`の`../../../coordinator/src/execution/kernel-lock.ts`→`../execution/kernel-lock.ts`と`../../../coordinator/src/execution/protected-root.ts`→`../execution/protected-root.ts`の二件だけである。全て同じ既存Symbol・実体へ解決する。残る五Sourceは完全bytes一致を要求し、二Fileもspecifier以外不変を検査する。今回の文書更新では七Source全て不変である。

### 29.6. 実装単位と停止条件

1. 上記CLI・同意の実体配置と入口を同じSource候補へ切り替える。本文維持、六受付経路、機密非公開・取消・joinを先に確認する。
2. 二PackageのSource／tests／scripts／設定／台帳と全Consumerを単一Coordinatorへ移管し、三接続を実Ownerへ直結する。元Singleton・Mapの一実体性とStorage許可差分を照合する。
3. 各公開宣言の義務を照合し、実体又は公開保証が移管済みの中継・旧表示・旧Root exportだけを撤去する。旧Package参照と未接続Consumerを全数確認する。
4. 型・format・lint・Trace、公開集合、CLI六経路、Task／Objective／Workspace／回復／保存、MCP／Workbenchの影響回帰と独立レビューを実施する。実AI・Dockerの未実施を別に残し、Source接続だけでC全体完成としない。

初回のSource候補では条件付き公開名を保持できるため、不要API削除の判断待ちで物理統合を止めない。一方、保存意味・認可・同意・公開結果・取消や受領条件の変更、新たなRuntime資源が必要なら編集前に影響と最小代替を報告する。現在、人間による追加判断は必要ない。これは設計棚卸しであり、C実装・回帰・全体QAの完了記録ではない。

## 30. Cの先行実装 — 上位CLI受付と旧表示の整理

§29の初回実装を、現在の依存方向を変えない上位CLI整理へ限定した。単一Dispatcher・物理Package統合を一度に先行すると、旧下位から上位への新しい依存を中間状態に追加するため、まず既存Owner内の実体と検証を整える。これは同じCの途中単位であり、別の完成形・互換層を採用したものではない。着手前に読取り専用確認者と、元関数・入力・取消・JSON bytes・利用側・検証義務の保持を照合した。

| 一次対象 | 実施内容 | 不変範囲 |
|---|---|---|
| 上位`cli/command.ts` | 実受付を`cli/request.ts`へ移動。配布入口、結合試験、AST検査、VC利用側閉包、Symbol Path、Source分類を追従 | 関数名・引数・UsageError・Workspace解決・Owner終了待機・Signal解除・終了値。本番Root公開集合は変更しない |
| `cli/command-report.ts` | 本番四呼出しのJSON出力を受付へ直接配置し、未使用Human表示と旧Candidate操作案内、専用型・descriptorを撤去 | 四出力の`JSON.stringify(value, null, 2)`＋改行。他のコンパクトJSONは変更しない |
| 旧Human専用UT十一Case | 不要になった表示契約とCatalog／Symbolを撤去 | Domain共通結果の`RCM-UT-016`自体は維持。旧Human試験をDomainの現行義務へ誤接続しない |
| 取消・Task Process IT | 元field・exact回復参照・cleanup・機密非公開をJSON又は元結果のassertで確認 | 一次失敗、回復非捏造、取消回数、listener解除・join、Host Path／生Provider出力非公開 |
| 受付出力の試験 | import-only出力0、Project拒否のJSON bytes・exit64を本番関数で追加確認 | Docker・認証・外部AI・保存物を使わない |

初回回帰では旧Pathを読むAST検査二箇所を検出し、Pathを追従した。その後、従来の「Task本文にstdoutが一つ」という検査が、直接JSON化した引数拒否出力も数えることを確認した。取消後の終端出力とEffect前の引数拒否出力を区別し、後者は先頭guard内・return付き一件、前者はfinally後一件を要求する。単に出力数制限を外さず、終了前の追加出力と拒否return欠落の負例二件を追加した。

### 30.1. 限定確認の結果

| 確認範囲 | 結果と限界 |
|---|---|
| 静的検査 | Coordinator・Orchestrator・Domain Model・Version Controlのformat／型／lintと既存Trace検査が成功。既存lint infoは変更せず、広い全体QAの成功とはしない |
| CLI影響六Suite | 56件成功、失敗・skip0。入力・出力bytes、実Process、取消ASTと負例、固定配送・環境・元PID／stdin、公開Ownerと分類を確認。初回失敗二件は旧Path追従後、出力二種を区別する検査へ是正して全六Suiteを再実行 |
| 台帳・利用側 | Domain台帳選択とVersion Control利用側閉包の二Suite、38件成功。旧Human試験の登録撤去、実体の新Pathと本番Consumerを照合 |
| 上位単体回帰 | 67件成功、失敗・skip0。旧Human専用十一Caseの撤去に伴う78→67で、十一件を新方式へPass継承したものではない |
| 凍結・参照 | Storage七Sourceと両Rootが基準HEADとbytes一致。現行Source・試験・配布入口・Registryの旧受付Path／旧renderer参照0。過去Evidenceは未変更 |
| 独立確認 | Source・文書／直接影響を分離。Source残指摘0、文書の旧受付Path一件を同意した一語修正で是正し、Sourceの再変更はなし |

実行は本差分の2026-10-22の限定確認で、巨大な生ログや実行ごとのEvidence書庫は追加しない。再実行入口は各四Packageの`npm run check`、Orchestratorの`npm run test:run`、CLI六Suiteと台帳・VC二Suiteの既存File集合である。件数は品質義務の成立数へ換算しない。文書検査は変更五文書の診断0、参照展開137文書の既存3,340診断で全体exit1を維持する。

物理Package統合、単一CLI Dispatcher、同意・端末の移管、条件付きRoot縮小は未実施。Storage七Fileと実行Mapは変更せず、②の再試行・保持物操作、実AI・Docker操作は行っていない。既存の全体QA・計測・命名検査残件も維持する。本CLI単位だけを限定完了とし、次は§29の単一Package切替へ進む。

## 31. Cの物理統合の着手前照合

Source・公開契約／台帳・文書／保存の三観点を読取り専用で照合した。現OrchestratorはRootを含む69 Source、18試験File（登録17とFixture1）で、Source衝突はRootだけ、試験Path・Symbol IDの衝突は0である。旧Coordinator82 Sourceと併合した初回母集団は150 Sourceとなる。初回候補は両Rootの全公開値・型を明示exportで保持する。不要API削除は別の確認単位とする。

| 照合で具体化した対象 | 今回の処置・保持条件 |
|---|---|
| Package内参照 | 旧下位Rootへの依存は同じ実Ownerへ直結。受付の自Root依存もObjective実体へ直結し、Singleton・私有Mapを複製しない |
| 型と純粋閉包 | 旧Orchestratorの論理Source母集団をstable Symbolとexact Pathで識別し、移管後も同じ純粋規則を適用する。Executionの値契約を型専用で読む辺は実行時依存と分け、Execution全体を純粋集合へ追加しない |
| 保存 | 二File・三specifierだけを同一実体へ追従。残り五Fileはbytes一致、変更二Fileもspecifier以外不変 |
| 台帳 | 安定test ID・Symbol ID・意味を維持し、物理PathとPackage Ownerだけ更新。同Ownerになった利用側Bindingを撤去し、他の利用側と検証義務は維持 |
| 実装観測 | 旧Packageを含む固定Source対象を新配置へ更新し、Path込みHashのScopeを`crdd-development-source-snapshot/v2`へ改訂する。旧v1と同値扱いせず、旧Packet再生成はフロントAIの移行対象。保存Schemaや既存回復記録は変更しない |
| 型検査・入口 | productionに全移管Sourceを含め、portable／Host専用試験の境界を維持。CLIの直接・対話・自動受付を既存Dispatcherへ実移管してからtemplateを薄くする |
| 正本・利用側 | Taskの設計文書を歴史化せず、現行物理OwnerをCoordinatorへ同期。MCP／Workbench／VC／Domain／Checker／Trace／Catalogの実Consumerを同じ候補で追従 |

変更分類・決定権限・保存意味・権限・通知／取消・回復の保証は§28〜29のまま。Source／契約と文書／直接影響の独立レビューを行い、変更対象の意味から回帰を選ぶ。実AI・Docker・②保持物操作・全体QA／Releaseは対象外で、追加の人間判断は現在不要である。表は着手条件であり、統合成立の結果ではない。

## 32. Cの物理移管候補と検証状況

旧Orchestratorの実Source・試験をCoordinatorへ移し、150 Sourceの単一Treeへ接続した。旧Package Manifest／lock／tsconfig／Symbolを撤去し、同じ依存版・Node下限を持つCoordinatorを正本にする。旧Orchestrator Directoryに残ったGit管理外の開発依存cacheは、回帰終端後にexact Root・内容・非Linkを再確認して清掃し、Directory不存在を確認した。実行・状態・回復のOwnerとして使用しない。履歴・保存設定・State名はPackage改名だけで変更しない。

| 実装した切替 | 確認済みの事実・現在の限界 |
|---|---|
| 旧両Root | 全120実行値と既存型を単一Rootから明示export。旧公開名を削減せず、Task側の旧下位Root利用は同Package内の実Ownerへ直結 |
| Task／Objective実体 | CLI先行整理とRootを除く67 Sourceは、import文以外の本文が基準HEADと一致。Callback束縛、受領ACK、元Control、私有Mapを再構築していない |
| 外部送信 | Decision四FileとExecutionの端末一Fileへ実体移管。Grant・Hash・一回性とProcess poisonは同じ実体を利用し、役割・送信許可は変えない |
| CLI | 配布入口の直接・対話・自動Project／Task分配を共通Dispatcherへ実移管し、templateを単一binの一回importへ限定。旧単体Task案内拒否を撤去。公開三入口×六経路を実Processの非Effect試験へ接続 |
| 保存 | 七Sourceを基準から照合し、二Fileの三specifierだけ変更、他五Sourceは完全一致。Schema・Writer・CAS・Lock・Path・受領／終了条件は不変 |
| 検査閉包 | 全150 Sourceを重複なく分類。純粋Taskは指定値型だけをExecutionから型専用で読む。値import・別型は拒否する負例を追加。旧Owner語彙・探索Root・同Owner化したCatalog Bindingを整理 |
| Source観測 | 九Packageの新配置とScope v2へ更新。旧v1のPacketは同値扱いせず再生成対象。Runtimeの署名Gateや互換Readerは追加しない |
| 静的確認 | Coordinatorのformat／全Source・tests型検査／lint／両Traceが成功。MCP／Workbench／Domainの型検査も成功。最終portable回帰は1,838成功・失敗0・5 skip、限定独立レビュー残指摘0。名称・保存統合・実境界を含むC全体の成立とはしない |

初回の限定結合で見つかった旧Path・旧Owner集合・旧並び順・旧handlerを前提とする試験は、正しい移管先と現在の公開境界へ追従する。拒否条件、機密非公開、取消・join、回復参照、型の純粋閉包を緩和しない。旧成功結果の流用、②のAI再試行、Docker操作、保持物清掃は行っていない。保存正本の統合・C全体・D・実境界・全体QA・Releaseは未完了である。

### 32.1. 是正と限定再確認

初回portable回帰はexit 1で完走した。旧Path／Owner／CLI受付／公開Rootの検査前提、Source観測の対象数、Symbol登録と、制限実行環境によるFilesystem保護・link作成拒否を区別した。回帰不合格を成功へ読み替えず、該当ケースを通常権限で再確認した。実AI・実Docker・②保持物は使用していない。

| 確認・是正 | 観測結果 |
|---|---|
| 公開Root | 57specifierを同一実体のPackage内相対へ正規化。二namespaceの恒真比較を廃止し、120実行値exact集合・旧入口不存在・利用側接続・自己迂回の負例を確認 |
| Source観測 | v2／9対象を維持。Fixtureの対象外旧Packageの内容変更はSnapshot全文不変、対象Packageの変更は差分となる。File／Directory上限の境界を18初期File／9対象に追従し、上限自体は維持。対象6件成功 |
| CLI・private seam | Project／Taskの現行受付と固定結果へ試験を追従。合法な上位の受領型とExecution私有型を分け、私有型再公開の負例を維持。二Suite28件成功、独立再確認指摘0 |
| Root・純粋境界 | 二Suite13件成功。CLI三入口六経路、120実行値、型専用の指定辺と実行時依存拒否を確認 |
| 台帳・利用側 | Domain CatalogとVersion Controlの38件成功。MCP全101件成功。Workbench共有Task／Projectの5件成功 |
| 制限環境の失敗 | 対象29件が通常権限で成功。含まれる公開Root一件は自己迂回是正後の確認であり、全29件を環境原因件数と数えない。Workbenchの別HTTP一件は最小loopback通信でもEACCESを再現し、通常権限で成功 |
| Symbol | 未登録7 Sourceのfile登録を追加し、既存の全Source照合Oracleを維持。初回追加の一IDがDomain既存IDと重複したため、新File登録だけを一意なIDへ是正。既存Domain IDと既存UTのverifiesは維持。全986 Symbolで重複0、Source150／登録Path150、Trace11件と独立再確認が成功 |
| 保存 | 最終Source候補でも七Fileを再照合し、許可済み三specifier以外は基準と完全一致 |
| 現行文書検査 | 全体3,697診断・exit1。歴史CHG以外の6診断は基準から不変のPA試験リンク一件とQuality Integration五件。今回の旧Package欠測・Symbol重複は解消。名称・意味上の説明残件は§33で別に保持 |
| 最終portable回帰 | 是正後の製品Sourceを固定し、通常権限で全1,843件を実行。1,838成功・失敗0・取消0・5 skip。5件のskip、別ProfileのHost専用試験未実施、実AI・実Docker・全体QAは別に残る |

Root・Symbol・試験是正、文書の限定独立再確認は残指摘0。物理移管と今回の受付・参照追従は限定確認を完了した。保存統合、名称統一、C全体、実境界・全体QAの完了とは区別する。

## 33. Orchestrator名称の残存棚卸し — 未改名、2026-10-22

物理Package統合と名称の統一は別の変更である。利用者の追加依頼により、関数Header、関数・型・変数、公開IF、設定・通信・保存実値、文書を読み取り調査した。現行TypeScript／TSXのProduction Sourceでは6 Package・103 Fileに大小文字を含む一致がある（Coordinator80、MCP12、Workbench5、Domain4、Checker1、Platform Access1）。これはコメント・宣言・参照・契約実値を含む検索母集団であり、欠陥件数や一括置換件数ではない。

Rustも別途確認し、Platform Accessの`src/native/main.rs`にOrchestrator Application PortというHeader一件が残る。npm script・tsconfig・反復検証script名にも旧名があり、開発用入口の改名と参照追従の対象として区別する。

Coordinator Rootの明示exportには該当名157件（実行値88、型69）が残る。Cの初回候補が公開120実行値と既存型を保持した結果であり、旧Package撤去だけで名称統一まで完了したとは扱わない。

| 対象 | 確認した残存例・現状 | 次の処置と影響 |
|---|---|---|
| Header・局所名 | CLI受付の旧Owner説明、`orchestratorDecisionRecordKeys`、`developmentOrchestratorCancellations`等 | 実責務に応じたTask／Objective／Decision等の名前を候補化する。コメントだけ、同Module内改名、公開改名を区別し、同じWeakMap実体・生成位置・寿命を維持する |
| 公開TypeScript IF | `runOrchestratorPublicObjective`、`runOrchestratorSingleTaskAttempt`、`createOrchestratorExecutionHostPorts`、`Orchestrator*`型・定数 | 名称ごとに実責務と衝突を確認し、Root・Consumer・試験を同時切替する単位が必要。互換aliasや新中継を自動追加しない。今回は公開名を変更していない |
| 現在文書の物理Owner | MCP詳細の「Orchestrator【別package】」とCoordinator import禁止、Workbenchの別公開Package列挙、Overview・DI・VC・MCP手順の別実体と読める説明 | 単一Coordinator内のTask／ObjectiveとExecutionの責務へ説明を同期する。現在の別Package案内は修正対象であり、過去Evidenceの名称維持とは区別する |
| 論理責務の用語 | Task／Objective／判断をOrchestratorと呼ぶ設計・QA・UI | 旧名を恒久的な論理名として残す判断は本調査から推定しない。責務別名称へ統一する範囲を次の名称整理で確定する |
| MCP・公開結果 | `crdd.get_orchestrator_state`、Adapter契約、公開reason／event | 内部Symbolと異なり通信契約の変更となる。Client、discover、Schema、変換、公開結果試験の一斉追従が必要 |
| 保存・設定・Hash・相関 | `.crdd/orchestrator`、`orchestrator.json`、`consumer: "orchestrator"`、State／履歴／Lease契約とHash domain | 保存七Sourceの凍結と保持中②の再入場へ影響するため現単位では変更しない。形式・旧状態の処置を含む別の移行判断が必要。自動移行Readerや新Registryを追加しない |
| 安定ID・履歴 | Symbol ID、Test ID、Semantic Key、過去Evidence・日付付き結果 | 現行Owner／Path説明と、歴史的なIdentityを分ける。過去Evidence本文・署名・Hashを改名しない。本候補で新規追加したfile Symbol六件にも旧Orchestrator／ports／public.contract語彙があるが、これを既存の歴史的IDと同列に固定せず、採用前の名称整合確認に含める |

本調査では名称変更を実装していない。名称の機械置換、現在の契約名を正当化するための論理概念の新設、保存凍結解除、②の再試行・保持物操作は行わない。次の名称整理は、内部名、公開API、通信、保存を影響別に提示し、現在の保証と移行条件を確認してから適用する。

## 34. 統合後の識別子整理 — 着手範囲、2026-10-22

人間の「名称変更を進めて」に従い、基準`53f945b78`の識別子・Header・現行案内を整理する。変更分類は公開TypeScript APIを含む内部構造変更であり、互換aliasを追加せず本番Consumer、試験、公開集合、Source文字列Oracleを同時に追従する。通信・永続形式の変更は本単位に含めない。

| 対象 | 処置と不変条件 |
|---|---|
| 関数・型・定数・局所変数 | 現在のPackage Ownerを示す名前はCoordinatorへ統一し、重複・衝突する名前は実責務で区別する。同一関数・Map・Control・初期化順を維持する |
| 衝突する既存名 | 業務状態の排他は`acquireRuntimeOwnedProjectStateKernelLock`、Objective配下の開発Taskは`startRuntimeOwnedDevelopmentObjectiveTask`、業務履歴設定Readerは`readTaskHistoryConfig`とする。技術状態の既存Lock・単発Task・設定Readerと混同しない |
| 保存七Source | 識別子・import binding・コメントに限りbytes凍結を解除。文字列／template literal、property key、Schema、Path、Hash domain、consumer、呼出順・条件・Writer・CAS・ACK・返却shapeは不変とする。旧`orchestrator.json`の読取りは維持する |
| 通信・実行値 | MCP Tool名、protocol、reason、event、環境変数、discriminatorと保存済み値は維持。object property／shorthandも個別に確認し、改名によって通信・保存shapeを変えない |
| 文書・履歴 | 現行Ownerと公開名の説明を同期。過去Evidence、署名・Hash、既存安定Symbol IDは不変。過去の検証結果を新版の成功へ読み替えない |

着手前照合は親Agentと読取り専用確認者で実施した。Taskだけに見えるLock名はProject状態全体を表す名称へ修正した。Source／公開APIの独立レビューと文書・直接影響の確認、型・静的検査、Root集合、保存不変性および影響結合回帰を行う。準拠基準・Release判断は変更せず、実AI・Docker操作・②保持物操作は実施しない。新しいState／Registry／Lock／移行Readerは追加しない。

### 34.1. 識別子・実ファイル・利用側の切替結果

旧名称を含む識別子の候補270名を照合し、関数・型・定数・局所名と全利用側を同じ候補で切り替えた。Coordinator Rootの実行値120名という公開集合の規模は維持し、旧名aliasは追加しない。衝突しないPackage Owner名はCoordinator、衝突する用途はProject State／Objective Task／Task Historyという実責務で区別した。Objective用の開始と取消は`startRuntimeOwnedDevelopmentObjectiveTask`／`cancelRuntimeOwnedDevelopmentObjectiveTask`で対称化する。

| 変更単位 | 実施内容 |
|---|---|
| Source・試験・反復Script | 旧名を含む33実ファイルをTask責務名へ改名。MCPの本番Tool実体は`40_Develop/mcp-server/src/tools/task.ts`。import・Script argv・npm・型検査・試験Fixture・Symbol Path・Catalog・現行文書の参照を追従 |
| 設計Trace | `07_Quality/Registry/coordinator-task-design-traceability.json`と`check-task-design-traceability.ts`へ改名。npm入口は`task-design-traceability:check`。安定IDとSchema実値は維持 |
| Header・表示 | Sourceの旧実装ラベルを現責務へ同期。MCPの説明三箇所、Workbenchの未接続表示、CLIのhelp・受領待ち表示の六箇所も更新。未接続・受領待ち・読取り専用の意味を強めない |
| 現行Architecture | 別PackageというMCP案内・Workbench依存列挙・Canonical表・図・Sequence・Checklistを、同じCoordinator内のTask／Objective→Executionへ同期。図だけ更新して残った統合前説明二文も是正。旧詳細文書の配置と明示的な移行元本文は別扱い |
| 保存不変性 | 七Sourceを基準からの許可された識別子・コメント変更とFormatter出力へ照合し、全七件一致。独立確認も同じ結果。返却shape・literal・Schema・Path・Hash・consumer・Writer／CAS／Lock／ACKは不変 |

静的check（format、Source／testsの型、lint、二Trace）は成功。既存lint info 64件は維持。MCP／Workbench／Domainの型検査も成功した。MCP通常全101件、Domain公開境界・設定・Consumer・Catalogの四Suite44件、Workbench接続二件が成功。表示六箇所の追従後はMCP Tool単体21件、CLI十三件を追加確認した。CoordinatorのTask・判断・状態・回復等の影響回帰は完走exit 1で、Rootの明示期待一覧に旧辞書順が残った失敗を検出した。集合を実Rootから自動生成せず、明示120名の順序だけを是正し、該当Rootと開発Sessionの二Suite26件が成功した。Domain側の公開値・型と、基準版にも残った移管後Consumer九Pathの旧順序も、明示集合を保って是正・四Suite再確認した。初回の不合格を全体Passへ読み替えない。

Source／公開契約と文書・直接影響の独立再レビューは残指摘0。全体文書検査は3,697診断・exit 1を維持。変更した現行十七文書からの参照展開では3,454診断・exit 1で、歴史CHG以外は基準から不変のPlatform Access試験リンク一件とQuality Integration五件だけだった。従来の全体QA不合格を解消したとは表示しない。巨大な実行ログや実行別Evidence Directoryは追加せず、今回の変換補助五ファイルは使用後に回収した。

残る旧名は次の別契約である。`.crdd/orchestrator`、`orchestrator.json`、Schema・Hash domain・`consumer: "orchestrator"`、MCPの`crdd.get_orchestrator_state`等のwire実値、診断prefix、`upperOrchestratorCapabilityComplete`の公開property、設計詳細の移行元Directory、安定IDと歴史Evidenceは本単位で改変しない。通信改名はClientの同時切替、保存改名は②の同じ回復参照・旧状態の移行条件を先に確定する。名称整理全体・保存統合・C全体・実境界・全体QA・Releaseの完了とは区別する。

## 35. 通信・診断と設計文書の切替 — 2026-10-22

基準`13124159f`から、人間が承認した順序で通信名・API key・診断名と現行設計文書の配置を変更する。公開契約の破壊的変更として扱い、旧名alias・二重受付・保存互換Readerは追加しない。旧名の拒否、新名の認証・取消・結果搬送、全Consumerの同時切替を確認する。保存側は読取り比較と統合案の提示だけとし、②のAI再試行・保持物操作・実Docker操作を行わない。

| 編集の一次キー | 切替先と影響 |
|---|---|
| MCP Tool `crdd.get_orchestrator_state` | `crdd.get_coordinator_state`。一覧・Call・公式SDK Client・配布入口・Schema説明と試験を同時切替。旧名CallはOwner未呼出しで拒否 |
| MCP構成key `orchestrator` | `coordinator`。起動構成・Factory・fixture・直接Consumerを追従。旧own keyは値undefinedでも明示拒否し、getterを評価しない。無関係な未知keyの扱いは変更しない |
| MCP Adapter metadata | `crdd-mcp/orchestrator-adapter/v2`→`crdd-mcp/coordinator-adapter/v3`、`projectModelOwnership`の値は`coordinator`。MCP protocol dateは不変 |
| MCPローカルreason | `orchestrator_mcp_client_not_authenticated`→`mcp_client_not_authenticated`、`orchestrator_adapter_result_invalid`→`mcp_coordinator_result_invalid`、HTTP configuration／address／cleanupとstdio failed／closedは各`orchestrator_mcp_*`→`mcp_*`。上流Task結果から搬送するreasonは変更しない |
| 純粋診断 | `[Orchestrator recovery] `／`[Orchestrator execution intelligence] `→対応する`[Coordinator ...] `。`orchestrator_recovery_transition`／`orchestrator_execution_intelligence_publication`→同じsuffixの`coordinator_*`。Producer、Parser、Process fixtureとstdout Oracleを同時切替 |
| Capability説明DTO | `upperOrchestratorCapabilityComplete`→`taskManagementCapabilityComplete`。値falseを維持し旧keyを除く。`storage/current-state.ts`のdescribe結果一fieldだけを保存七Sourceの追加例外とし、Writer・保存本文・他fieldを変えない |
| 設計文書 | 旧`Details/orchestrator/01_Architecture.md`→`Details/coordinator/03_Task_Architecture.md`、旧`02_Detailed_Design.md`→`04_Task_Detailed_Design.md`、旧`03_Workspace.md`→`05_Workspace.md`。現在の正本・利用側・台帳・SchemaのPath参照を追従し、本文の複製や新しい設計Subsystemは作らない |

着手前に親Agentと読取り専用確認者で契約を照合した。Source／公開契約、文書構造・直接利用側の独立レビューと文書／影響確認を行い、準拠基準・Release判断の監査は今回変更しないため実施しない。保持済みの保存Schema・Path・Hash domain・consumer・area・設定名・共有Task reasonと`orchestrator_owned`、過去Evidence・安定IDは変更禁止である。保存七Sourceは記述DTO一項目を除き基準不変とする。現在、人間による追加判断は必要ない。

### 35.1. 切替と検証結果

新Tool、構成key、Adapter v3、MCPローカルreason、診断Producer／Parser／Process fixture、説明DTOを同時切替した。旧Toolは一覧から除き、Callは既存の`-32602`で拒否して認証・三操作のOwner呼出し全0を確認した。旧own構成keyはundefined／getterとも値の読取り前に拒否し、新しい汎用未知key検査は追加しない。保存七Sourceの差分は、説明DTOの一propertyだけである。

設計三文書の移管、現在の正本・台帳・Schema・Checker・検証Tool・作業計画の参照を追従した。現行CHG内の実リンク11件は接続先だけを更新し、過去Evidence・安定ID・移管表の旧Pathは維持した。Architecture MapとCoordinatorのARCH Relationを統合し、UI／SPECの領域列と担当Relationも和集合へ同期した。20 Relationに重複はなく、Task側の欠落は0である。

MCP静的checkと通常全回帰102件、CoordinatorのTask実行・合成Processの二Suite89件、Checker Semantic九件、二つの説明DTO二件が成功した。診断の合成Process単独41件、HTTP／stdioの追加限定七件も成功した。89件runはCase名だけの最終追従前に開始しており、同じ説明DTOの最終Caseは別の二件で再確認した。通常権限の初回MCP全回帰はlocalhostの`connect EACCES`後に終了待ちとなったため中止し、ID・起動引数を再確認した今回の試験Process二件だけを終了した。この中止runは成功根拠に含めず、localhost接続が許可された環境の完走102件を根拠とする。RootからのFormatter呼出し一回は未配置のコマンドをnpmが取得しようとして通信制限で失敗したため、Package内の既存固定Formatterで再確認し、新しい依存は追加していない。

Coordinator静的check（format／型／lint／二Trace）は成功し、既存lint info 64件を維持した。Sourceの独立レビュー三指摘と文書の二指摘を統合是正し、再レビューの残指摘0を確認した。文書検査で今回追加されたARCH Relation／UI-SPEC二診断は解消した。中央二文書からの参照展開は123診断・exit 1で、現行の残りは基準から不変のPlatform Accessリンク一件とQuality Integration五件。既存の文書全体不合格を今回解消したとは表示しない。実AI・Docker・認証情報・②の保持物は使用・操作していない。

### 35.2. 既知の現行文書六指摘の是正範囲

人間が今回の是正を追加承認した。対象はPlatform Accessの移動済みRoot観測試験リンク一件、Quality Integrationの旧Runner四行の状態語彙、同表とQA-000010の`platform-access`入力Relation一件である。公開API・保存・実行許可を変更しない文書／直接影響の是正として扱う。

四行の`Partial`／`Superseded`は検証結果ではなく旧実装・廃止状態の説明へ残し、表の処置は`OPEN`へ正規化する。既存の未完了条件とRunner廃止判断を維持し、`Covered`へ昇格しない。QA-000010には、同表が既に要求し既存AIT項目・PA試験が所有するNative技術境界の入力だけを追加する。新しい検証義務・保証・Frameworkは作らない。文書検査、既存Quality意味モデルの回帰と独立レビューで確認する。保存統合・②のAI再試行・保持物処置は追加範囲に含めない。

六件を上記の範囲で是正した。実Domain Parserの分析／定義Relationは49対49・双方差分0、処置語彙Issue 0。Quality意味モデル八件と参照先Root観測六件が成功し、追加差分の独立再レビューは残指摘0。Quality Integration・Platform Access・PROJECT_CONTEXTからの文書検査は3,071診断・exit 1で、現行文書の診断0、残りは過去CHG内だけである。§35.1で記録した既知六件はこの後続是正で解消しており、未処置のままではない。

移管後の機械検査が`01_Architecture.md`を領域入口にするため、Task詳細の四Quality unitをCoordinator 01へ参照投影し、Quality IntegrationとQA-000003／004／005／009の物理Ownerも同入口へ同期した。安定unit key、段階、境界、未完了条件を維持し、物理unit十件にTask側四件の欠落0を確認した。検査件数だけが同じでもunitが脱落し得る反例として、移管先の本文だけでなく領域入口からの解析集合を照合した。機械検査の緩和・新しいReader・意味の第二正本は追加しない。

## 36. 保存方式の比較と統合候補 — 実装未承認

本節はB採用前の比較を保持する。2026-10-22に人間が「同じ情報を重複して持たず、排他制御を整理する」条件でBを採用した。現在の着手範囲は§37を参照する。目標採用を実装済みと扱わない。実Runtimeデータや保持物は読まず、SourceのWriter・Schema・終了条件を比較した。

| 現在の保存系統 | 物理配置 | 意味・確定境界 |
|---|---|---|
| Task／Objectiveの現在状態 | `.crdd/orchestrator/state.json`、短命の`state.pending.json`と`state.lock` | Workspace、Queue、Task、Lease、結果、判断、未配送履歴。Snapshot全体の改訂／元Hashで比較交換 |
| Task終了要約 | `.crdd/orchestrator/history.jsonl` | 通常終了・一次失敗・cleanupの要約。独自Headerを持ち、実行側履歴と同じ形式ではない |
| 単発実行・技術回復の現在状態 | `.crdd/coordinator/state.json`、短命の`state.pending.json`と`state.lock` | Operation、資源、Host世代、回復義務、配送待ち、受領Hash。実資源終端・上位受領・操作除去は別の事実 |
| 単発実行の終了要約 | `.crdd/coordinator/history.jsonl` | exact回復参照、終了要約と履歴確定・資源回収の相関 |
| 保護された人間判断 | Host管理領域の`project-decision-<hash>-<generation>.json` | Host主体に結合した世代チェーン。通常履歴と同じ期限削除を適用できない |

根拠は`storage/current-state.ts`、`history.ts`、`model.ts`、`settlement-store.ts`、`protected-decision.ts`、`state/model.ts`である。`result-record.ts`／`validate-result-record.ts`はTask Snapshot内の結果契約であり、別の保存ファイルを増やすOwnerではない。Execution Intelligenceは実績観測であり、Task判断・結果受領・回収完了の正本へ昇格させない。

両Repository-local状態は同じPackage内にあるが、現行Schema、改訂単位、Kernel Lockの結合、結果受領の確認点が異なる。同名ファイルの上書きやJSONLの連結では統合できない。通常履歴の既定保持は双方30日で、保存・整理操作に伴って期限処理する。未解決回復と必要な配送・参照を期限だけで削除しない。

### 36.1. 比較する二案

| 候補 | 変える内容 | 利点 | 残る問題・費用 |
|---|---|---|---|
| A: 配置・設定だけを統合 | `.crdd/coordinator/`へ二State・二履歴を用途別名で集約。既存二Writerを維持 | 保存意味を変える範囲が小さい | 旧名は消せるが、二重の改訂・排他・受領結合と保守負担は残る。完成形ではなく中間構造になり得る |
| B: 現在状態と履歴の実統合 | 単一`state.json`／Writerと一つの`history.jsonl`へ統合し、Task進行と技術実行を内容の責務で区別 | Packageの統合と保存構造が一致し、中継・重複状態を削減できる | 改訂・排他・ACK・回復再入場の確定境界を設計し直す必要があり、名称変更より大きい |

縮小目的に対する推奨目標はBとする。ただし安全性の成立は未確認で、保存凍結を解除する人間判断後に具体化する。Aを先行実装して二度移行することは既定にしない。既存二Writerの上へ第三の統合Writer、新Registry、Lock FrameworkまたはRecovery Frameworkを重ねない。

目標配置の候補は以下である。

```text
.crdd/
├ config/
│  └ coordinator.json       Coordinator単位の運用設定
└ coordinator/
   ├ state.json            Task／Queue／Workspaceと実行・回復・配送の現在状態
   ├ history.jsonl         種別と相関を持つ終了要約。実績詳細を重複複製しない
   ├ state.lock            更新中marker。実効排他は既存Kernel Lockを利用
   ├ state.pending.json    更新時だけ存在
   └ history.pending.jsonl 履歴確定時だけ存在
```

保持期間はCoordinator設定一つへ整理する候補とし、既定30日を維持する。未解決義務を通常履歴へ落として期限切れにしない。Host保護判断の場所・世代チェーン縮小はこの比較だけで変更せず、現在のチェーンに通常履歴のローテーションを流用しない。

### 36.2. 実装前の確認条件

- Task／Operation／RecoveryのIdentity・unknown・一次失敗を保持し、同じ参照で再入場できること。
- 実資源cleanupとConsumerの受領は別の事実として維持し、CLI／Workbenchのtransient返却をdurable ACK待ちへ変えないこと。
- 既存Writerと保存更新用の短期排他を一本化対象とする。Taskの実行Lease、Host世代、Provider Home等の別寿命の排他を重複扱いで撤去しない。二Stateと第三の同期層を併存させないこと。
- Task結果・技術回復・履歴確定の中断点と、保存後の通知／配送失敗を具体化し、不要になる重複ACK・中継だけを確認して除くこと。
- 旧形式の整理・移行はフロントAIの明示手順とし、本番へ互換Readerを追加しないこと。②保持物は別の既存判断が変更されるまで処置しないこと。

比較時点で必要だった判断は、Aの配置整理に留めるか、Bの単一State／Writerを目標に保存凍結を解除して設計へ進むかであり、当時はBを推奨した。この比較記録自体は採用・実装許可ではなかった。現在の採用と着手範囲は§37を参照する。

## 37. B採用後の保存統合着手 — 2026-10-22

### 37.1. 判断・経路と変更禁止範囲

人間はBを採用した。§36末尾の選択待ちは解消し、同じ情報を二正本で保持せず、保存更新の排他を一本化する設計・実装へ進む。新方式の意味正本は[単一保存Lifecycle](../../../06_Architecture/Details/coordinator/04_Task_Detailed_Design.md#unified-storage-lifecycle)であり、計画本文でSchemaや終了条件を第二定義しない。

基準は`13124159f`と前回通信・診断・設計移管の未コミット候補。保存形式・改訂・排他・中断後再入場と直接Consumerへ影響する非自明な置換として扱う。過去の七Source bytes凍結は移管元保証の比較基準へ移し、採用した統合の範囲だけ解除する。過去Evidence、安定ID、認可、外部送信、Docker隔離、Git採用判断、Host保護判断は変更しない。②のAI再試行と保持物の読取り・削除、実Docker操作は許可されていない。

親と保存・排他／Lifecycleの読取り専用確認者で、正本と現行Sourceを照合した。保存Schema・Writerの専門独立レビュー、Architecture／Qualityの文書・直接影響確認を行う。複数正本・利用側・移行に関する不足／影響を確認し、準拠基準・外部公開・Release判断の変更はないため、その判断用の監査は実施しない。追加のRisk受容や新しい管理基盤が必要なら、その箇所で人間判断へ戻す。

### 37.2. 初回照合で確定した条件

- 保存改訂・変更前Hash・Root結合は一組にする。Taskの業務世代、Owner世代、受付世代を同じ保存改訂へ混同しない。
- 技術cleanup・一次失敗はOperationを正本にし、Taskは参照／導出する。exact回復義務は発生元に一度だけ保存し、Task関連付けは参照とする。
- 統合／採用の`results`はAI単発結果とは別契約であるため、名前が同じ「結果」というだけで統合しない。
- 現行の技術保存Lock内からTask受理Readerを呼びTask保存Lockを取る接続を除去する。二Lock名だけの同一化は禁止し、同じOwner・Snapshotから受理を照合する。
- 履歴確認後、耐久Consumerの受領事実を同じSnapshotへ一度保存し、Task反映とProducer内部配送待ちの解消を同じ更新で確定する。その場合だけ受理Hash転記・二段ACKリレーを撤去する。受領自体、開始通知、実終端・回収・履歴確認は維持し、結果保存済み未受領と受領保存済み応答喪失を別窓として反証する。
- stateとhistoryは二ファイルであり同時に原子確定しない。固定行・時刻・Hashと元終端記録を使う既存の二段確定を一つの再入場手順へ整理する。未確定元記録と未解決義務は通常期限で消さない。
- Task実行Lease、Provider Home、Host世代・回復排他は別寿命として維持する。`state.lock` markerを実効Kernel Lockと混同しない。

### 37.3. 実装単位と検証

| 順序 | 処置 | 完了の確認 |
|---|---|---|
| 1 | Architecture／Qualityに一意な情報配置、寿命、保存排他と中断を具体化 | 正常・取消・親喪失・通知喪失・履歴中断の対応と専門独立レビュー |
| 2 | 統一Schemaと遷移を既存意味から構成 | 二正本の同一事実0、孤立参照・別Identity・旧Schema・異なる結果の拒否 |
| 3 | 既存Writerと短期排他を一本化 | 単一CAS、競合拒否、同Owner再取得0、pending／rename／読戻し／解放失敗と再入場の実Filesystem検証 |
| 4 | Task／Operation／受領／履歴と全Consumerを新Ownerへ接続 | 履歴確認後の耐久Consumer受領と同更新の内部配送待ち解消、二重反映0、CLI／WorkbenchへACK追加0、正常・取消・親喪失の合成結合 |
| 5 | 旧Writer・旧ACKリレー・旧Root／設定Readerを撤去 | 二重書込み0、旧形式拒否、公開API・CLI・MCP／Workbenchと静的／通常回帰の整合 |

既知の使い捨て中間状態を本番の完成形にしない。純粋Schema等の局所確認はできるが、二Writerを並走させる互換接続や第三Writerは作らない。旧記録の移行・清掃はフロントAI手順へ接続し、②の保持物は別承認なしで処置しない。

順序1のArchitecture／Quality具体化は、保存・排他専門、Lifecycle契約、文書・直接影響の限定独立レビューと是正後再確認を終え、残指摘0である。初回の契約指摘は、履歴確認後の耐久受領という既存順序の維持、受領事実を別の内部受理へ増やさない用語、結果保存済み未受領と受領保存済み応答喪失の二窓分離だった。時点表示も採用前比較と現在の採用へ同期した。

最終の04詳細・QA-000003／008・PROJECT_CONTEXTからの文書検査は277診断・exit 1、参照展開された現行文書の診断0で、残りは歴史CHG内だけである。差分形式検査は成功した。保存Sourceには今回の変更を加えておらず、基準HEADとの差分は前単位の説明DTO一fieldだけである。実保存先・保持物は未操作。次は順序2の統一Schema・遷移とSourceの具体化であり、新方式のSource・実Filesystem／Process・品質項目の評価はNot Runである。

### 37.4. Source統合の準備と事実の照合

`2d09c746b`を基準に、Task Snapshotの型・codec・純粋検証を`storage/model.ts`へ移し、履歴の値検証も同じモデルへ接続した。Task区画と技術実行区画の検証を物理Envelopeの読取りから分離する。これは順序2の準備であり、統一Schema、単一Writer、本番保存先、ACK撤去の完成ではない。旧二Writerの実行経路はまだ変更していない。

四つのTask fieldを技術Operationへ一括移管する方法は採らない。開始前拒否にはOperationがなく、委譲結果不正やProcess安全状態の義務はTask境界の元事実であり、差替えExecutorも耐久技術Operationを持つとは限らない。複数executor／reviewerの参照集合、retry前Attemptの受領・未解決参照を照合し、[Task／Attempt固有の事実](../../../06_Architecture/Details/coordinator/04_Task_Detailed_Design.md#task-attempt-storage-facts)のOwnerへ保持する。不存在・空集合からcleanup成立を推定せず、新しい台帳や架空Operationを作らない。

準備抽出の静的`npm run check`は成功し、既存lint info 64件を維持した。純粋保存モデル三Suite28件が成功した。合成保存・履歴三Suiteの広い回帰は61件中60件成功で、移管時の`decisionRecoveries.value`キー誤変更一件を検出した。同じ問題は独立レビューでも指摘され、キー復元と誤キー・重複回復IDの反証追加後、該当Windows IT一件と型検査が成功し、限定再レビューの指摘0を確認した。広い回帰の旧失敗runを最終全件成功へ読み替えない。通常制限下で失敗・終了待ちとなったmarker試験は今回の試験Processだけを確認して停止し、必要なOS観測が可能な環境の限定二件で成功した。これらは準備差分の確認であり、新方式Schema・単一Writer・受領更新の成立根拠ではない。

準備抽出の七Suiteを必要なOS観測が可能な環境で再実行し、92件成功・失敗0を確認した。その後、純粋な新Schema、Task終端投影、平坦な現在区画、Root受領本文と参照、共通改訂／受領／除去遷移を追加した。旧形式の変換や実保存は行わず、新codecと遷移はまだ本番Writerへ接続していない。新しい保存経路全体の成立には使わない。

新モデルの反証は、片側初期化、二重改訂、Task導出値・Docker義務phaseの独立保存、複数技術操作の欠落、旧Attempt受領のretry後保持と新Attempt誤流用、初回世代・本文の差替え、Operation除去／Task参照置換／配送解消の片側更新を含む。Source独立レビューでDocker義務phaseの重複、新規受領時の元Operation論理相関不足、修復variantの正常除去欠落を検出し是正した。修復専用条件は旧終了候補と新共通遷移で共有し、正常・未確認履歴・未解決保持を反証する。最新の静的checkと純粋三Suite31件は成功し、Sourceと文書・直接影響の限定再レビューは残指摘0。文書検査は277診断・exit 1、今回変更文書と参照展開された現行文書の診断0で、残りは過去CHG内である。保存・履歴・OS排他と後続純粋試験の七Suite94件も成功したが、開始後の純粋モデル追加と修復guard抽出を跨ぐ補助runであり、B完了版の固定候補全回帰とは扱わない。単一WriterとConsumerの本番切替、旧経路撤去は未完了であり、B全体の完了・コミット・プッシュはまだ行っていない。

2026-10-23の接続途中では、既存技術Writerを入力準備・取得済みOwner内の物理確定・外側解放へ分離し、通常Reader／初期化／Writerの保存排他取得を共通Ownerへ接続した。保持中Ownerの借用ReaderはKernelを再取得・解放しない。Windowsの自己生成Repositoryで、反復読取り、競合取得拒否、偽造・コピー・解放済みOwner拒否、借用中の`ownerHeld=true`／`lockReleased=false`、外側一回解放、元本文不変を確認し、既存`PRL-IT-011`へ接続した。Task側の旧Writer／Root・履歴・旧ACKは未切替であり、新Schemaの単一WriterやB全体が完成したという意味ではない。

Task更新候補は表示用の集約`recoveryUnresolved`を元事実へ書き戻さず、同じAttemptのTask固有不明を維持し、新しく得たTask結果の不明・解消だけを明示入力する。技術側だけの未解決をTaskへ複製する指摘と、既存受領の再更新で検査用Objectを符号化してしまう欠落を是正した。元事実false／trueと技術側の解消、別Task／Attempt／操作の入力拒否、受領再更新を純粋反証へ追加し、三Suite31件が成功した。既存Writer分離・共通Owner接続の限定Source再レビューは残指摘0であり、本番Task・履歴・受領を含むB全体の独立レビュー完了には流用しない。

共通Ownerの内部でRepository再検証が二重化する経路は、外側の真正Owner取得・解放を維持し、内部へ既存Kernel handleを借用して除いた。既存の各I/O境界のRepository再検証とKernel生存確認は維持する。修正版の静的check、純粋31件・Windows借用2件、修復専用Ownerの実Writer／no-op2件は成功し、限定Source再確認と文書・直接影響再確認の残指摘0を確認した。長時間の修復Writer全Suiteは改訂途中を跨ぐ補助実行であり、B完了版の固定候補全回帰へ数えない。新SchemaのTask本番切替、同Owner履歴、旧ACK／旧Root／設定Reader撤去と、その後の固定回帰・全体独立レビューは未完了である。

#### 本番切替の途中状態 — 2026-10-23

Task・Queue・Workspaceの保存を共通Ownerから既存の物理Writerへ接続し、本番codecを平坦な`current-state/v3`へ切り替えている。Task専用の物理state出版処理は除去した。通常結果配送のReader構築・保存後complete呼出しと、回復後の上位finalize呼出しを外した。旧設定Reader・専用配布設定と未使用旧Envelope Readerを撤去した。旧ACK専用API・内部枝と全試験の移行は未完了であり、B全体は完成していない。途中差分はコミット・プッシュしない。

Task履歴は技術履歴と同じRoot・設定・Ownerへ接続した。Task要約は共通JSONLの閉じたvariantとし、旧Task専用Headerを生成しない。`historyPending`は通常の保持期間だけで削除せず、同じ本文の履歴確定後だけ現在状態から除く。状態出版pendingがある場合の履歴更新を拒否し、履歴置換直前にも元state本文・Root・設定を照合する。

実Filesystem確認では、新品・未CommitのRepositoryへの公開初期化と同一受付世代の再入場が成功した。共通保存Ownerを既存の実行Revision用Readerから取得すると新品Repositoryを扱えないため、Version Controlの既存Git実体観測を、保存に必要な論理／実体Identityだけの読取りへ分離した。実行対象Commitの確認や技術回復ReaderのRevision条件は緩めていない。新規の台帳・Lockを追加していない。

正規化Rootが内部key順を揃えるため、Task区画の値比較・内部保存Hashは正規JSONへ揃えた。OS実体Identityの従来の数値表現は別扱いで維持した。採用結果の値検査もモデルへ集約し、Hash生成と検証の方式差を除いた。是正後、新品からの独立採用Lease取得・解放、採用結果の保存・同内容再送の一試験は成功した。

最新の型・静的checkと差分形式検査は成功。保存・修復モデルの限定二Suiteは28件中27件成功で、残る一つの大きなSuiteでは旧ACK Hashを前提にした参照検査が未移行である。通常Task模擬回帰は153件中152件成功、残る一件はjunction作成の権限不足であり、成立済みには数えない。接続途中版の保存Owner／Task出版／履歴の限定独立確認は追加指摘0だったが、その後の内部Hash・値検査集約には再確認が必要であり、B全体のレビュー完了へ流用しない。

通常Task模擬回帰のjunction作成一件は、必要なOS権限の環境で個別再確認し成功した。元の153件runを全件成功へ書き換えず、B完成候補の固定回帰は別に実行する。

今回の正規化Hashは内部Symbolの改名だけではなく、新形式の保存値契約の変更である。旧Snapshot・旧内部Hashを読む互換Readerや実行時変換は追加しない。移行時はフロントAIが対象・参照・未解決状態を確認し、新形式で必要なHashを再計算する。歴史Evidenceや署名・Git ArtifactのHashは変更せず、今回の②保持物はこの移行・清掃へ含めない。

最新の限定確認では保存・状態遷移・修復モデル57件、Domain公開集合・設定14件、Version Control保存Identity一件、通常Task実保存一件が成功した。Task原子受領は十一Caseを持つ一試験で、同時受領・二件目不正・保存前失敗・保存後応答喪失を確認した。履歴移管で検出した時計逆行、不正設定下の確認、複数行の保存意図再提示漏れを是正し、通常保守を含む全十一件は成功した。これらは改訂途中の限定確認であり、B完成候補の固定全回帰とは扱わない。限定Source再レビューの指摘は是正後0。旧実行Ownerの二段ACKラッパーを撤去し、その元終端・結果読取りの一試験も成功した。

この途中版からの残処置は§37.5で更新する。②の再試行と保持物操作は実施していない。

### 37.5. 保存統合Bの最終確認

全体回帰で、Task保存がmarkerを作った後、pending作成前の例外でmarkerだけを残し、Workspaceの通常再観測を妨げる失敗窓を検出した。同じ呼出しの真正Owner下で、自分のmarker・元本文不変・pending明示不存在を確認できる場合だけmarkerを回収し、保存失敗は維持する最小是正を行う。部分作成・既存marker・置換・観測不能は保持する。通常Readerの拒否や既存残存の処置条件は緩めず、Process喪失窓の追加保証とも扱わない。

通常Candidateの同一要求再入場では、保存時のキー順統一と`JSON.stringify`比較が衝突する追従漏れも検出した。Workspaceの固定要求・取込先の二比較だけを検証済み値の深い厳密一致へ切り替え、項目・型・値・配列順・prototypeの一致は維持する。他の比較へ機械的に拡大しない。

Windowsの上位bit付きFile IDを模擬する保存試験では、Readerが正規化した符号なしIDとWriterの生の符号付きIDを異なる実体と判定する接続漏れを再現した。Domainの既存変換を私有関数へ抽出し、Readerと同一性比較の両辺に共用する最小是正を行った。Windowsの有効な負の64bit表現だけを変換し、異なるID・他の六項目差・不正範囲・途中変更の拒否は維持する。修正後の該当二試験、Domain全266件、marker回収・拒否の影響十件は成功した。公開API・状態・移行Readerは増やしていない。

2026-10-23現在、旧二段ACK専用API・内部枝、旧保存Rootと旧保持設定Readerを撤去した。Taskの表示DTOは既存API内に維持するが、物理保存は平坦な一つのSnapshotだけとする。通常のtransient終了、技術cleanup、履歴確認とexact回復参照は維持する。旧形式の移行はフロントAIの明示手順とし、本番互換Readerは追加しない。

回復結合の移行で、旧Task側のDocker段階保存と新しい技術正本からの投影が衝突する接続漏れを検出した。Dockerの技術段階は元Operationだけを更新し、上位は同じexact参照を再読取りする方式へ是正する。Task自身の結果不明と技術義務も分け、配送待ちをTask固有の不明へ重複投影しない。合成試験は任意の偽回復ID・旧finalizeコールバックから、元Operation・実JSONL・五項目結果参照・通常全件一括又は回復exact参照ごとの逐次受領（各CASは原子的）を使う経路へ移行する。これは既存Writerの相関検査を緩める変更ではなく、本番Consumerの新正本への接続である。

| 確認責務 | 新方式での確認箇所・停止条件 |
|---|---|
| 耐久受領と内部配送解除 | 通常Taskは捕捉済み全件一括、回復はexact参照単位の逐次受領で各CASは原子的。対象だけ除去し残りの参照を保持、全対象受領後だけ技術参照なし終端へ切替。全件相関、部分不正、参照欠落・残留、早期終端、配送片側除去、保存前失敗、保存済み応答喪失、別Process再入場と二重反映を反証 |
| 履歴との順序 | 元Operationの確定だけでなく実JSONL行を照合。欠落・重複・内容差・未確認は受領前停止。未受領・未解決参照中の行は通常期限でも保全 |
| 単一Writerと排他 | 現在状態・Task・履歴を同じ短期Ownerへ接続。保存markerと実効OS排他、長期実行Leaseを区別し、借用先から自己再取得しない |
| 初期化失敗 | Domainの失敗reason・Effect・cleanup・retry・exact参照を同じErrorで公開境界へ搬送し、Ownerを解放してから返す。解放不明はcleanup／retryを成功にしない |
| 試験・配置移行 | 旧物理Envelopeと二段ACKを前提にしたfixture／assertionを移行。未知欄・Root置換・世代競合・取消・親喪失の拒否は維持 |

局所確認では、履歴故障四Case、別Processでの原子受領再入場、Windows現在保存とpending再入場、履歴十一Case、Domainの設定・保存・公開境界二十七件が成功した。これらを固定全体回帰や最終独立レビューの代用にはせず、以下の最終固定版を別に検証した。

最終確認の集約は以下に置く。実行ごとの全文を正式Evidenceへ複製しない。製品Sourceの最終差分識別は`18df8bb67b5074f2255b1d430d049f933b635259`（基準CommitからCoordinator・Domain Model・Version Controlの`src`差分をGit blobとして識別）であり、検証途中の改訂と区別する。

改訂を跨いだ補助全体実行は1,867件中1,856成功・6失敗・5skipで完走した。旧ガード抽出二件、上位bit付きID一件、試験分類一件、旧表示期待一件、旧保存先・Envelopeを操作する改ざん試験一件を是正し、各局所試験と独立確認を通した。補助実行を最終固定候補の成功へ流用しない。続く固定実行で見つけた私有関数の抽出依存漏れも試験側で追従し、Win32／Linuxの全境界を維持した十一件を確認した。当該実行は自己所有Runnerだけを確認後停止し、後続の公開入口・Windows試験は発行していない。

その後はSource・試験・設定を変更せず、外部AI・実Docker・②保持物を使わない最終固定検証を順番に完走した。基準Commit `2d09c746b`からの`40_Develop / 07_Quality/Registry / template/tools/schemas / .gitignore`差分識別は`8bfe47cb228774d831117b06fbca7ebe6b9f93a7`で、実行前後の一致を確認した。

| 最終固定範囲 | 結果 |
|---|---|
| Coordinator通常全体回帰 | 全1,867件中1,862成功・失敗0・5skip、約100分。明示実境界のskipを成功へ換算しない |
| Workbench／MCP共通公開入口 | 現在認可・実Gitを一体に通す一件成功・失敗0 |
| Windows保存影響四Suite | 三十件成功・失敗0・skip0。現在状態、Owner喪失、保存・Lease・受領、marker再入場を確認 |

保存統合BのSource・試験移行・外部AIなし固定回帰の範囲を完了とする。実AI・実Dockerを含む全Producer・利用側の一体実証、既存データの移行、C全体・全体QA・リリースの完了へ拡張しない。

| 範囲 | 確認結果・限界 |
|---|---|
| 静的検査 | CoordinatorとDomain Modelの整形・型・lint、Coordinatorの二つのTraceability検査は成功。既存の情報level診断はerror／warningに読み替えない |
| Domain Model | File ID是正後の全266件成功 |
| Version Control | B接続候補の全69件成功 |
| MCP／Workbench | B接続候補のMCP全102件、Workbench結合79件成功。Workspace比較是正後の両公開入口からの認可・実Git一体試験一件も成功 |
| 先行Windows影響確認 | 四Suiteの30件中29件成功・一件は子Process期限超過。同じSource・同じ期限で当該一件を再確認し成功。最初のrunを30件成功へ書き換えず、上表の最終固定三十件と別に保持する |
| 保存・回復の最終影響確認 | 回復境界・保存／修復モデル56件、marker回収・拒否十件、上位bit付きIDの二件が成功 |
| 試験分類の追従 | 追加済みの履歴試験を件数表へ反映し、通常／Host専用の閉集合と負対照を含む三件が成功。実行範囲・拒否条件は変更しない |
| 独立レビュー | Source・契約・試験追従のレビュー指摘を是正し、最終固定回帰の終端と限定完了範囲の表示を独立再確認した。残指摘0件 |
| 文書検査 | 今回の現行文書範囲の指摘0件。参照展開した歴史文書の3,344件により検査全体は不合格であり、全体QAのPassとは扱わない |

実AI②の再試行、保持物の観測・移行・削除、実Docker操作は対象外のままである。従来の277件は狭い照会範囲で得た歴史CHG内の文書診断であり、今回の参照展開範囲の3,344件とは母集団が異なる。件数差を新規故障の増分と扱わず、今回の現行文書診断0件とも区別する。現在、人間による追加判断は必要ない。

### 37.6. 保存統合後に行う構造再設計

利用者は追加の「Coordinator構造再設計・リファクタリング方針」（調査基準`13124159f`）を提示した。実施順序はBの保存統合・検証→コミット・プッシュ→同方針の構造再設計である。添付のStorage凍結は後続の構造再設計に適用し、現在承認済みのBを取り消す意味には扱わない。B完了時の保存契約を後続の凍結基準にする。

後続では先に`cli / objective / task / decision / workspace / execution / state / storage`の目標Ownerを固定し、全Sourceの関数・型・状態・Capability・Consumerを対応付ける。Executionの十二責務、Task七責務、Decision九責務、Objective五責務と既存Workspace三Fileを基本とする。Provider仕様・選択・Plan・純粋な結果解釈はAI Adapter、実行Authority・開始取消・元観測・回収調整はCoordinator、Container技術はDocker Isolation、OS技術はPlatform Accessへ分ける。

構造移管と動作整理は別段階にし、移管だけを全体完了にしない。まず処理順序・条件・公開結果・保証を維持して移管とConsumer／試験を追従し、その後、不要な中継・重複検証・多段Factory・状態・循環依存を主要Lifecycleごとに評価する。目標外Fileを残す必要がある場合は、独立した状態・寿命・保証・直接Consumerと統合できない理由を示して例外判断へ戻す。新Framework、②のAI再試行・保持物操作は許可範囲に加えない。

## 38. 保存統合後の構造再設計着手

基準Commit: `7c4100bc2e09c32dad26dcf4c2eb82808ec665eb`。状態: Phase 1の割当調査中。Source移管・動作整理・回帰はまだ開始していない。構造の正本は[Coordinator Architecture §16.1](../../../06_Architecture/Details/coordinator/01_Architecture.md#161-保存統合後のsource構造再設計)とし、本節は実施順序・現行対応・未確定を追跡する。

### 38.1. 経路と保持する境界

実装構造の保守変更としてArchitecture、QA、公開API、利用側、試験・台帳を照合する。構造移管前にOwner・私有状態・実行時依存閉包の読み取り専用整合確認を行い、移管単位ごとの静的検査・契約試験と固定候補の独立レビューを実施する。文書の追従は文書監査、専門Package・利用側への責務移管は不足／影響確認へ接続する。CRDD準拠基準、決定権限、Releaseを変えないため準拠監査・Release監査は今回の経路に追加しない。公開契約の意味や保存保証の変更が必要になれば構造整理の範囲で自己決定しない。

構造移管では処理順序、拒否条件、状態遷移、公開結果、元通知・Control、期限、取消join、exact回復参照、Authorityの一回性を保持する。正常だけでなく開始前取消、開始後取消、遅延・重複通知、主失敗と回収不明、Owner喪失・再入場を変更した意味から選ぶ。新しい共有State・Registry・Lock・監視・Recovery Frameworkは作らない。実AI②・保持物の観測／移行／削除と実Docker操作は行わない。

### 38.2. 現行の母集団と移管調査

Repository内のSource列挙で次を確認した。添付案の基準`13124159f`と現在版を混同しない。

| 現行領域（`src/`相対） | File数 | 予定する処置・未確定範囲 |
|---|---:|---|
| `cli/` | 6 | 受付・引数・回復表示・取消の四責務へ集約。`request`／`request-input`の受付と搬送を既存Ownerへ分配 |
| `objective/` | 7 | 五責務へ。受付依存構築と純粋な再計画遷移を別々に処置する。詳細は§38.3 |
| `task/` | 17 | Graph・Scheduling・Attempt相関・進行・受領へ。Executionの元Controlと上位Identity相関は同じ意味として潰さない |
| `decision/` | 17 | 人間判断・記録・同意・Grantへ。純粋遷移、乱数を使うCapability生成、保存を呼ぶLifecycleを区別して割当する |
| `workspace/` | 3 | 既存三責務を基本維持。Git EffectはVersion Control、状態保存はStorageのまま |
| `execution/` | 71 | 十二責務と既存専門Packageへ関数・型・状態単位で分配。Provider名だけを消す機械改名はしない。詳細は§38.4 |
| `state/` | 11 | 状態モデル・投影・照会へ。活動の四Sourceと照会契約、Binding、保存Portを評価し、Writerを吸収しない |
| `storage/` | 6 | B完了版の六Sourceを凍結。旧`validate-result-record.ts`を復活させない |
| `identity/` | 1 | Clock／Hashの値契約。現在時刻・乱数の実装Ownerと型のOwnerを分けて割当 |
| `input/` | 2 | Plain dataとRepository相対Pathの純粋検査。Storageを含む利用側を確認し、Domain Rootへの機械置換で純粋閉包を壊さない |
| `lease/` | 1 | Lease種別・Owner観測・取得契約。型だけを理由にTask／Executionへ分断しない |
| `platform/` | 2 | Coordinatorが必要とするPortとWindows実装接続を分離。Port全体をPAへ丸投げしない |
| `process/` | 1 | Process安全状態の上位要求型。Process Poisonの実体と共有型を区別 |
| `queue/` | 1 | Task受付と進行の値型。既存Storageからの型参照を追従する条件を確認 |
| Root | 3 | `index.ts`は公開入口を維持。結果型と公開失敗投影は実責務へ割当し、新しい汎用共通置場を作らない |
| 合計 | 149 | File全数の母集団。関数・型・状態の移管先確定を、このFile数だけで完了扱いしない |

Runtime入口`bin/coordinator.ts`一件も対象とする。`scripts/`の32件はRuntimeのAfterへ機械移管せず、検証・運用の利用側として接続を別途追従する。Package exports・scripts・設定・`symbol.json`・Test Catalog・Traceability・UT／IT／ST・Workbench／MCP／template入口を利用側の閉集合へ含める。過去EvidenceのPath・Hash・安定IDは改名しない。

### 38.3. Objectiveの最初の割当候補

| 現行Symbol・状態 | 移管先候補 | 直接利用側・保持条件 | 判定 |
|---|---|---|---|
| `CoordinatorObjectiveIntakeDependencies`、`runCoordinatorObjective`、私有`validId / inspectBinding / blocked`（`intake-dependencies.ts`） | `objective/public-operation.ts`の受付組立て | 現在の公開Objective、受付IT、全体進行IT、回復ST。Principal／Binding検査→計画→受付世代確認→同Writer接続→実行→maintenanceの順序、取消と失敗値を維持 | 候補。関数・型は同じ受付Ownerへ統合し、中継Fileと再exportを撤去する |
| `applyCoordinatorPartialReplan`、`retryCoordinatorTask`（`replan-transitions.ts`） | `task/lifecycle.ts` | `objective/replan.ts`、Root公開、状態遷移UT。世代・上限・dependency／cycle・旧Attempt破棄・回復参照の条件を維持 | 候補。純粋なTask遷移として統合し、保存・乱数を伴う`objective/replan.ts`へ機械連結しない |
| `resolveCoordinatorReplan`と候補検査（`replan.ts`） | 同Fileを基本維持 | State／Queue読取り→判断→世代付き保存→Queue更新の既存順序を維持。保存Schemaを変更しない | 基本維持。内部重複削減は動作整理段階で評価 |
| `request / plan / execute / public-operation`の既存責務 | 五File構成の同Owner | Request受付、Objective計画、Task実行集合、単一Snapshot受領を分ける。File単位の純粋／業務／組立て分類と負対照を追従 | 型・関数・全利用側の照合を継続 |

純粋遷移をI/O付きの再計画調停へ連結する案は、既存`PRL-IT-012`の実行時依存閉包を変えるため採らない。型の共有だけを理由にCapabilityや保存を再実装しない。

### 38.4. Provider関連の責務割当候補

読み取り専用Source確認で、次の処置を候補として得た。File全体の移管許可や実装完了ではない。

| 現行の処理・状態 | 目標Owner・Path | 保持する保証・利用側 |
|---|---|---|
| `model-selection.ts`の`selectProviderModelCandidate / selectRationaleCodes / selectEffort`と候補検査 | AI Adapter `profile/resolve.ts` | `delegation-route-selection`／`provider-plan`が使うmodel・effort・reason・noticeを維持。今回Operationへの適用と選定GrantはExecutionへ残す |
| Provider argv・環境・stdout／error解釈 | AI Adapterの既存`planProviderExecution / prepareProviderEnvironment / parseProviderResult / convertProviderError` | 新しい生成器・Parserを作らず、既存APIを使う。Docker開始失敗・signal・deadline・cleanupの優先順位はCoordinator |
| `provider-adapter / provider-preparation / provider-preparation-lifecycle / provider-plan`の今回計画結合 | `execution/preparation.ts` | 既存prepared／management WeakMapの同一実体、Mount確認・活性化→選定／Packet消費→Authority発行、二時計30秒と解放確認後のMap除去 |
| `provider-packet.ts`のissue／consume／revokeとCommand Hash | `execution/preparation.ts` | 元Operation・Task／projection・Prompt・Commandへの結合、一回性、同じ`owners / uses`の状態。型だけをAI Adapterへ渡してCapabilityを分裂させない |
| Controller開始・取消・元完了と結果投影 | `execution/controller.ts`／`execution/result.ts` | 元Control・Signal・開始通知、主失敗優先、資源IDとexact回復参照。公開結果の閉集合は技術制御と分ける |
| `provider-observation.ts`の登録・照合・失効 | `execution/observation.ts` | 元通知の参照同一性と二WeakMap、一回性。値だけの成功証明へ変更しない |
| `provider-execution.ts`の助言Runtime | `execution/advice.ts` | Repository非共有、Operation／選定／Home／Packet／Controllerの相関、取消・回収。Host回復MapとReader／Writerは同じ状態Ownerへ置く |
| Home Mountのcompile／transition／use、issue／consume／activate／complete／verify／revoke | `execution/authority.ts` | Grant・alias・mountCompletions・Capability・Leaseの寿命と失効、元Home／User／Profile／Operation結合 |
| Windows Home技術と元観測Capability | OS技術はPA、Capability・使用条件は`execution/authority.ts` | Provider別Home名はAI Adapter既存認証記述。OS観測の取得元とMount AuthorityのOwnerを混同しない |
| `provider-result-reasons.ts`の`dockerProcessControllerPublicCompletionReasons` | `execution/result.ts` | 実体は実行・回復の公開理由集合であり、Provider stderr仕様ではない。Storageによる直接参照も確認する |
| Claude Subscription認証の実行と回復 | Coordinatorの実行・Authority・回復Owner＋既存DI／PA | 既存AI Adapterの認証仕様を使う。`authenticationTechnicalPlans / runtimes`、Home排他、exact資源記録と回収をAI Adapterへ丸ごと移さない |
| `provider-types.ts` | 準備・Controller／Result・Authorityの実Ownerへ分配 | 型の所有対象で分け、全型をAI Adapterや汎用`types`へ集積しない |
| `provider-lifecycle.ts`の合成評価 | 検証Owner又は診断を調査中 | 製品実行接続を確認できていない。Root公開・設計Capability・QA義務を照合するまで削除又は本番統合としない |

### 38.5. 保存凍結と旧Path撤去の判断境界

B六Fileは現在の意味を保持する。現物のimport照合では、`current-state.ts`が`decision/acceptance-authority.ts / acceptance-record.ts / recovery-record.ts`、`input/repository-relative-path.ts`、`lease/controller.ts`、`queue/types.ts`、`task/single-task-record.ts`等へ直接依存する。`model.ts`は`execution/provider-result-reasons.ts / host-recovery-record.ts / restart-checkpoint.ts`、`settlement-store.ts`は`execution/provider-observation.ts / repository-binding.ts / restart-checkpoint.ts`等へ依存する。

したがって「Storageのbytesを一切変えない」と「旧Sourceを互換ラッパーなしで撤去する」は、該当する移管単位では同時に満たせない。人間は、保存形式・処理本文・判定・順序を凍結したまま、同じSymbolの新しい移管先へのimport参照先だけ追従する案を承認した。許可はimport declarationに限定し、Header・型／関数／値本文・型名・export・Schema・公開値・処理順・Root／CAS／Lock／marker／pending／履歴／原子受領を変更しない。旧名再export、第三Writer、旧形式Readerを追加して回避しない。

この承認は保存統合Bを再設計する許可ではない。旧Symbolと新Symbolの同一実体・型・既存処理の不変性を照合し、import以外の変更が必要になれば今回の許可へ含めず止める。該当旧Pathの保留又は別の人間判断へ戻し、最終Afterの完了を主張しない。

### 38.6. 次の処置と完了の区別

現時点では基準・目標Owner・調査母集団と主要なProvider／Objective割当候補までを記録した。149 Source全体の関数・型・私有状態・直接利用側・公開export・QA／Test対応の確定は継続中であり、Phase 1完了とはしない。未確定の移管をSourceへ先行実装しない。

保存参照の許可境界は§38.5のとおり確定した。既存純粋／業務／Adapter分類と所有状態の対応を全数照合し、Objective→Task／Decision→Stateと小Folder→Provider仕様のAI Adapter接続→Executionの順に、確定した割当を依存順へ調整して移管する。段階ごとの件数成功を構造再設計全体の完成とせず、最後に受付→Objective→Task→Attempt→結果受領／回復の正常・失敗・取消・再入場を評価する。
### 38.7. Source全数の一次配置表

以下は基準版の149 Pathを一回ずつ照合した配置候補であり、Symbol単位の最終確定又はSource移管済みの表ではない。Pathは`src/`相対、移管先の拡張子は`.ts`。複合行では同じOwnerに属する関数と私有状態をまとめ、型・状態・副作用の異なる実体は§38.3／38.4と次節の規則で分配する。列挙集合の欠落0・余剰0を確認した。Top-level宣言も既存TypeScript構文木で149 Sourceから取得したが、宣言件数は責務の確定・検証成功数と扱わない。

| 現行Folder | 現行File | 移管先・処置候補 |
|---|---|---|
| `cli` | `cancellation.ts` | `cli/cancellation` |
| `cli` | `command.ts`、`request.ts` | `cli/command` |
| `cli` | `options.ts`、`request-input.ts` | `cli/options` |
| `cli` | `recovery-report.ts` | `cli/recovery-report` |
| `decision` | `acceptance-authority.ts`、`capability.ts` | `decision/types (記録値型はrecords)` |
| `decision` | `acceptance-record.ts`、`records.ts`、`recovery-record.ts` | `decision/records + decision/types` |
| `decision` | `authority-adapter.ts` | `decision/request` |
| `decision` | `capability-adapter.ts`、`lifecycle.ts` | `decision/lifecycle` |
| `decision` | `external-send-consent-record.ts`、`external-send-consent-store.ts` | `decision/external-send-consent` |
| `decision` | `external-send-grant.ts`、`external-send-policy.ts`、`request.ts` | 同じ責務・Pathを基本維持 |
| `decision` | `public-acceptance.ts`、`public-operation.ts` | `decision/public-operation` |
| `decision` | `record-acceptance.ts` | `decision/acceptance (要求検査はrequest)` |
| `decision` | `transitions.ts` | `state/model` |
| `execution` | `advice.ts`、`provider-execution.ts` | `execution/advice（助言のHost失敗Mapと回復関数は同一Ownerへ保持）` |
| `execution` | `attempt.ts`、`claude-subscription-authentication.ts`、`isolation-execution.ts`、`provider-controller.ts`、`task.ts` | `execution/controller + result/authority/recovery/preparation (所有状態ごとに分配)` |
| `execution` | `authority-bundle.ts`、`authority-grant.ts`、`authority-policy.ts`、`authority-validation.ts`、`delegation-selection-grant.ts`、`local-authority.ts`、`prelaunch-validation.ts`、`protected-root.ts`、`provider-home-mount-authorization.ts`、`provider-home-mount-grant.ts`、`provider-home-windows-adapter.ts`、`root-protection-policy.ts` | `execution/authority (OS原語はplatform-access)` |
| `execution` | `borrowed-tree.ts`、`generation-loss-transition.ts`、`operation-creation.ts`、`operation.ts`、`repository-binding.ts` | `execution/operation` |
| `execution` | `change-snapshot.ts`、`provider-result-reasons.ts`、`recovery-projection.ts`、`result-reasons.ts`、`task-structured-result.ts` | `execution/result` |
| `execution` | `cleanup-eligibility.ts`、`host-recovery-record.ts`、`host-submission.ts`、`orphan-recovery-policy.ts`、`recovery.ts`、`restart-checkpoint.ts`、`runtime-repair.ts`、`runtime-restart.ts` | `execution/recovery` |
| `execution` | `completion-observation.ts`、`eligibility-observation.ts`、`provider-observation.ts` | `execution/observation` |
| `execution` | `delegation-route-selection.ts`、`model-selection.ts` | `ai-adapter/profile/resolve (今回Operationへの適用はexecution/preparation)` |
| `execution` | `development-execution-timing.ts`、`development-measurement-constraints.ts`、`development-measurement-session.ts`、`development-source-observation.ts`、`diagnostics.ts`、`isolation-probe.ts`、`provider-lifecycle.ts`、`runtime-version.ts` | `execution/diagnostics (合成評価は検証Ownerを確認)` |
| `execution` | `interactive-console.ts` | `platform-accessの端末技術、同意判断はdecision/external-send-grant` |
| `execution` | `isolation-profile.ts`、`provider-adapter.ts`、`provider-packet.ts`、`provider-plan.ts`、`provider-preparation-lifecycle.ts`、`provider-preparation.ts`、`task-packet.ts` | `execution/preparation (Provider純粋仕様はai-adapter)` |
| `execution` | `kernel-lock.ts`、`process-safety-state.ts` | 同じ責務・Pathを基本維持 |
| `execution` | `provider-home.ts`、`root-observation.ts`、`root-path.ts` | `platform-access (実行Policy・Capabilityはauthority)` |
| `execution` | `provider-types.ts`、`types.ts` | `request/preparation/controller/result/advice/authority/recoveryへ分配` |
| `execution` | `runtime-trust.ts`、`terminal-caller-checkpoint.ts`、`terminal-caller-lease.ts`、`terminal-record.ts` | 現行Capability維持又は正式廃止の判断待ち |
| `execution` | `secret-validation.ts` | `domain-model/plain-data/secret-validation （人間承認済み）` |
| `execution` | `task-request.ts` | `execution/request` |
| `identity` | `clock-and-hash.ts` | `state/persistence` |
| `Root` | `index.ts` | 同じ責務・Pathを基本維持 |
| `input` | `plain-data-snapshot.ts`、`repository-relative-path.ts` | `state/model` |
| `lease` | `controller.ts` | `state/persistence` |
| `objective` | `execute.ts`、`plan.ts`、`public-operation.ts`、`replan.ts`、`request.ts` | 同じ責務・Pathを基本維持 |
| `objective` | `intake-dependencies.ts` | `objective/public-operation` |
| `objective` | `replan-transitions.ts` | `task/lifecycle` |
| `Root` | `operation-result-contract.ts`、`operation-result.ts` | `state/result` |
| `platform` | `contract.ts` | `execution/diagnostics (純粋な保証検査はstate/request、共有型はstate/types)` |
| `platform` | `windows-adapter.ts` | `execution/kernel-lock + execution/diagnostics` |
| `process` | `safety-contract.ts` | `task/types` |
| `queue` | `types.ts` | `state/model` |
| `state` | `activity-cursor.ts`、`activity-validation.ts` | `state/projection` |
| `state` | `activity-types.ts` | `state/types` |
| `state` | `activity.ts` | `state/observation` |
| `state` | `binding.ts` | `state/model` |
| `state` | `model.ts`、`persistence.ts`、`projection.ts`、`public-query.ts`、`query.ts` | 同じ責務・Pathを基本維持 |
| `state` | `query-contract.ts` | `state/request + state/projection + state/types` |
| `storage` | `current-state.ts`、`history.ts`、`model.ts`、`protected-decision.ts`、`result-record.ts`、`settlement-store.ts` | B六File。本文・意味を凍結 |
| `task` | `dispatch.ts`、`host-adapter.ts`、`intelligence-adapter.ts`、`recovery-adapter.ts` | `task/dispatch (共有値型はtask/types)` |
| `task` | `execute-attempt.ts` | `execution/controller` |
| `task` | `execution-contract.ts` | `task/types + task/dispatch` |
| `task` | `execution-diagnostics.ts` | `execution/diagnostics` |
| `task` | `executor.ts`、`observer.ts`、`recovery.ts` | `task/types` |
| `task` | `lifecycle.ts`、`scheduling.ts` | 同じ責務・Pathを基本維持 |
| `task` | `recovery-transitions.ts` | `task/recovery + task/acceptance` |
| `task` | `request-composition.ts`、`requests.ts` | `task/requests` |
| `task` | `settle-docker-recovery.ts` | `execution/recovery` |
| `task` | `single-task-record.ts` | `state/model` |
| `workspace` | `commands.ts`、`operations.ts`、`record.ts` | 同じ責務・Pathを基本維持 |

### 38.8. Task・判断・状態の分配と利用側

| 実体 | 移管先候補 | 保持する状態・依存・利用側 |
|---|---|---|
| `createCoordinatorTaskRequests / createRepositoryTaskRequests` | `task/requests.ts` | 同じFactoryのrequests Map、受付ID、同一要求・取消・結果保持。Profile・Repository・認可・Workspaceを本番callbackへ結ぶ |
| `runCoordinatorOperation`、EIイベントの構成・記録、本番回復Adapter・Clock組立て | `task/dispatch.ts` | 予約→Attempt→元結果捕捉→原子受領の順序。EIの履歴WriterはEIへ残す。Process安全状態の実体はExecution |
| Taskの予約・開始・終了と純粋な再計画遷移 | `task/lifecycle.ts` | 世代・Attempt／Operation・依存・scopeを維持し、保存・乱数・実行Moduleへ値依存しない |
| Task回復のmark／settle／retry／Owner喪失遷移 | `task/recovery.ts` | 純粋遷移。保存・診断を伴うAdapterはdispatchへ分ける。技術回収の実行はExecution |
| `recordProjectTaskResultAcceptances / acknowledgeProjectDockerRecoveryObligation` | `task/acceptance.ts` | 受領候補の純粋構成。人間採用権限を持たず、原子保存とOperation除去はB Writerのみ |
| Attempt入力／結果／観測／配送、回復Port、Process安全要求の共有型 | `task/types.ts` | 値を持つcontract定数とvalidatorを型専用Fileへ混ぜない。`validSingleTaskResult`はdispatchへ、単発Controlの実体はExecution |
| `SingleTaskRecord / inspectSingleTaskRecord / singleTaskQueueIsConsistent`、Queue値型 | `state/model.ts` | B codecの値依存を純粋に維持する。保存・実行をimportするrequestsへcodecを移さない |
| Clock／Hash、Lease／Owner観測／Port型 | `state/persistence.ts` | 型契約だけを共有し、Clock・Lockの実体を生成しない。Bの型importは同一Symbolへ追従 |
| Decision Record／Recovery Intent／Acceptance Record・Envelopeと純粋validator | `decision/records.ts` | StoreのI/Oや乱数を含めず、Bからの純粋値依存を維持 |
| Decision／AcceptanceのStore・Authority・Capabilityの型 | `decision/types.ts` | 秘密値の発行実体、保存実体を型Fileへ移さない |
| 人間判断のissue／submit／replace／invalidate／recoverとCapability生成 | `decision/lifecycle.ts` | 元の秘密値・Hash・一回性。乱数をRecordのimport時に発行しない |
| `recordCoordinatorAcceptanceDecision` | `decision/acceptance.ts` | 保存Portと認可の調停。要求検査と認証済みPrincipalの純粋照合はrequestへ分ける |
| `requestCoordinatorHumanDecision / applyCoordinatorHumanDecision / applyCoordinatorAcceptanceDecision` | `state/model.ts` | 保存・乱数のない現在状態遷移として同居。Decisionの公開操作からこれを呼ぶ |
| 判断・採用の二つの公開入口 | `decision/public-operation.ts` | 認証・認可・公開結果・操作の違いを維持し、同じ名前の一操作へ潰さない |
| Rootの`CoordinatorPortResult`と公開失敗投影 | `state/result.ts` | 同じ純粋な結果Ownerへ配置するが、異なる二結果Shapeを一つの型へ変更しない |
| Plain data／Repository相対Pathの既存検査 | 純粋な状態入力Ownerを最終照合中 | Domainの同名APIとは返却Shapeが異なる。構造段階で機械差替えしない。state/modelへの同居案と利用側閉包を確認 |
| Stateの活動Reader・cursor・検査・Query契約 | 照会・投影・共有型の各Ownerを最終照合中 | 現在状態とEI履歴のOwnerを混ぜず、公開照会から純粋validatorへのI/O逆流を防ぐ。Stateの最終File一覧は未確定 |

`secret-validation.ts`について、人間はDomain Modelの既存`plain-data/`への移管を承認した。既知pattern・Path・文字列の純粋検査と返却値を維持する。秘密値の保管、取得、Credential管理、未知Secret不存在の証明又はSecret Managerを追加する許可ではない。ARCH-000014と既存QA／利用側は新Ownerへ接続する。

### 38.9. 検証・運用Consumerの全数処置

`bin/coordinator.ts`は既存CLIへの固定入口として維持する。次の32 ScriptはRuntime十二Fileへ吸収せず、移管先の同じSymbolへ追従する。既存実AI／Docker／認証を使う入口を列挙したことは実行許可ではない。

| 区分 | `scripts/`内の対象（拡張子`.ts`） | 処置 |
|---|---|---|
| 運用入口4 | `authenticate-claude-subscription / measure-development-providers / prepare-codex-image / revoke-external-send-consent` | 同じ用途限定入口を維持。認証・測定・Task／助言Image・同意Ownerへのimportを追従 |
| 検査入口8 | `check-dynamic-fake-provider-coverage / check-native-runtime-trace / check-platform-access-coverage / check-platform-access-ts-coverage / check-provider-authority-coverage / check-provider-home-coverage / check-runtime-traceability / check-task-design-traceability` | Source Path・本文取得・Owner集合・coverage oracleを追従し、拒否条件を緩和しない |
| 検証実行入口10 | `verify-dynamic-fake-provider-cancellation / verify-dynamic-fake-provider-failures / verify-general-task / verify-native-protection / verify-native-terminal-fixtures / verify-native-terminal-namespace / verify-recovery-matrix / verify-reviewer-boundary / verify-route-matrix / verify-task-real-providers` | 本番又は検証用の元Symbolへ追従。外部Effectを持つ実行は別許可のまま |
| 検証支援10 | `native-git-provenance / native-runtime-trace / platform-access-coverage-path / runtime-traceability / task-design-traceability / task-real-provider-contract / verification-result-reasons / verification-result-record / verification-safety / workspace-task-fixture` | 検証専用Ownerのまま。Runtimeの責務として再公開しない |

Package exports、npm scripts、Symbol Manifest、Test Catalog、Runtime／Task Traceability、型検査設定と実Source抽出試験を同じ移管差分で追従する。UTは移管Ownerへ、IT／STは現在の公開経路・境界へ接続し、既存Local Item・負対照・終了後条件を保持する。Workbench／MCP／template入口は同じ公開APIに追従し、私有Moduleを新たな外部入口へしない。

### 38.10. 未接続処理の処置確認

`execution/runtime-trust.ts`は自ら本番未接続・Root非公開と明示し、`terminal-record.ts / terminal-caller-checkpoint.ts / terminal-caller-lease.ts`も現本番の直接利用側がなく、相互参照と試験が利用している。前者の独立評価、後者の終端保存・再入場は既存設計・QAに記載があるため、単に「未使用だから削除済み」としない。

人間には次の二案を提示する。どちらも現在の通常実行へ新接続しない。判断前は該当Sourceと現行Capability・QA義務を保持する。

| 案 | 実装・設計・QAへの処置 | 影響 |
|---|---|---|
| 現行Capabilityを維持 | 非公開・本番未接続の評価／codecとして製品Sourceと対応QAを維持し、目標Ownerへ配置 | 利用側のない現行責務と維持コストが残る。通常実行の保証が増えるわけではない |
| 現行Capabilityを正式廃止（推奨） | Architectureの独立Trust評価・旧terminal保存候補と対応する現行QA義務を正式に廃止／履歴化し、Runtime Sourceから撤去。歴史比較が必要なfixtureだけ試験側へ限定 | 現在使われていない独立評価・旧保存候補を今後の提供／検証対象から外す。現在の通常実行とB保存契約は変えないが、将来その能力が必要なら再評価する |

試験側のlegacy copyを検査して現行製品QA成立と扱う案は採らない。廃止をPass又は検証済みへ変換せず、過去の正式Evidenceは維持する。判断対象はCoordinator Architectureの独立Trust／terminal codec記述、QA-000003のTrust評価義務、QA-000006の終端保存・再入場義務と既存試験の担当範囲、Symbol Manifest／Test Catalogの接続である。共用するNative／通常回復の義務を巻き込まず、廃止する断面を正確に切り分ける。この処置の判断とStateの最終割当を閉じ、Phase 1固定候補をレビューしてからSource移管へ進む。

### 38.11. 未接続四実装の限定廃止 — 2026-10-23

2026-10-23の人間承認により、Coordinator内の本番未接続の独立Trust評価と旧terminal codec／caller保存・再入場候補を廃止する。旧4 Sourceと専用試験3本は撤去し、製品処理の試験側コピーや代替Frameworkは作らない。通常実行、保存統合B、Platform AccessのNative部品・共有排他・現在の回復保証は維持する。過去Evidenceは当時の根拠として保持し、廃止をPassへ換算しない。 §38.10の推奨廃止案を人間が承認した。旧4 Fileと専用3試験、登録・専用実行設定を撤去し、試験側へ本体をコピーしない。基準Commitは`7c4100bc2e09c32dad26dcf4c2eb82808ec665eb`。先行の149 File対応表は基準版棚卸しとして保持し、現在Sourceは145 Fileとなる。B六Fileは今回変更しない。

独立Trustの上流意味は正式IDごと維持し、旧実装との関係を廃止、代替未接続をOPENとする。専用caller断面は廃止するが、共用Local ItemとPA／Kernel／現在回復の保証は維持する。旧結果は履歴であり現版のPassではない。全体構造移管のPhase 1完了、実AI・Docker E2E又は全体QA完了とは扱わない。

変更分類は承認済み限定Capability廃止。Source・QA・Architectureと直接利用側の照合、回帰、独立Source／設計レビューを対象とする。CRDD規範・準拠基準自体は変えないため準拠監査を新たに発火しない。文書参照・直接伝播を確認し、通常回復・共有Nativeへ影響が出る場合は停止して範囲を再整理する。②再試行・保持物操作・外部Effectは対象外。

### 38.12. 限定廃止の確認結果 — 2026-10-23

旧4 Sourceと専用3試験の撤去、実行設定・Symbol／Catalog・利用側閉集合の追従、Architecture／QAの直接伝播を完了した。現在Sourceは145 File、Coordinator Symbol登録358件、Test Catalog登録384件である。共有Local ItemとNative／通常回復／B保存は維持し、旧Trustの二HandoffはOPEN、代替独立評価器はMissingとする。Phase 1の全Symbol分配と構造移管本体は未完了である。

| 確認範囲 | 結果と限界 |
|---|---|
| `coordinator`の`npm run check` | Exit 0。整形985 File、型、lint、Runtime／Task Traceabilityが通過。既存lintの情報診断64件は残り、今回の警告・エラーとは区別する |
| Host Profile／Core閉集合 | `test-execution-profile.contract.test.ts`と`task-platform-independence.contract.test.ts`の8件成功。Windows専用Caseの母集団は113→105で、専用8件を削除しただけで未分類・重複の負対照は維持 |
| Domain／Version Control利用側 | `storage-consumer-closure.integration.test.ts`4件、`consumer-closure.integration.test.ts`12件成功。削除したcallerの参照だけを期待集合から除去 |
| 維持する排他・回復・保存・履歴 | 通常Windows権限で下記5 Suiteの96件成功、失敗・取消・skip各0。実Docker／外部AIは使わない |
| Symbol／Catalog | Symbol登録358件の実Path欠測0・ID重複0。Catalog検査は384件valid、試験実行Effectなし。Sourceとscripts／現行試験に旧4 Moduleへの参照なし |
| 文書検査 | 全体Exit 1、歴史CHG診断3,691件、現行文書診断0。過去Evidenceを改名せず、全体QAのPassにしない |
| 独立確認 | 限定廃止のSource・設定・設計・QA・直接伝播は最終残指摘0。旧方式と現行Owner、上流の代替未接続を分離 |

96件の再実行コマンドは`40_Develop/coordinator`から`node --experimental-test-module-mocks --test --test-concurrency=1 ./tests/integration/kernel-lock.contract.test.ts ./tests/integration/host-recovery-record.contract.test.ts ./tests/integration/task-durable-foundation.contract.test.ts ./tests/integration/task-history.contract.test.ts ./tests/integration/current-state-marker-cleanup.contract.test.ts`。Node v24.19.0、Windowsで実行し、所要832,680ms、Exit 0だった。件数はこの実行範囲の結果であり、正式QA項目数や全体Runtime完成数ではない。

対象は基準Commit `7c4100bc2e09c32dad26dcf4c2eb82808ec665eb`からの未Commit差分。実行入力となる`git diff --binary -- 40_Develop 07_Quality/Registry/test-catalog.json`のbyte列SHA-256は`2fc7b5afcf648da28374423b4a62647389466bc5e3e4335e096f65fe12a7c5ca`。B六Fileと本番の他処理は基準版から不変である。大量stdoutは通常logとして永続複製せず、上記の対象、コマンド、結果と再実行可能な試験を保持する。

通常回帰全体の二実行は完走前に停止した。制限環境ではCatalog publish未確認・link拒否を観測し、通常権限では同じCatalog4件が成功した。長時間の単発Task試験では取消通知の取りこぼし候補を局所確認したが、待機の原因と断定せず、対策案・一時診断をすべて戻した。その候補での177秒・2件成功を現在Sourceの成立根拠へ数えない。現在の単発Task試験は基準版と同一であり、全体回帰完了は主張しない。限定廃止は本番呼出し0と直接利用側の全数追従、変更しない共通保証の96件、独立確認を根拠に区切る。

中断した今回の合成Root二件は、元試験Processの終了、生成時点、fixtureの構成・合成Principal／Project、実Commitなし、未知entry・reparseなしを確認して清掃し、各Rootの不存在を確認した。②の保持物は観測・変更せず、実AI・Dockerの再試行、再起動・修復を行っていない。

### 38.13. 残作業の実施順 — 2026-10-23

人間は、残作業の計画をコミット・プッシュしつつ、承認済み構造再設計を継続するよう指示した。限定廃止完了版`e05ba7221fa212725d216e92322453d7ffa57486`を今回の作業開始版とする。§38.2／38.7の149 Fileは廃止前の基準表として保持し、現在の対象は145 Sourceである。保存統合Bは完了済みであり、再実装しない。

| 順序 | 実施単位 | 出口・保持する境界 |
|---|---|---|
| 1 | 配置の最終確定 | Stateの照会・投影・共有型、共通入力検査、Provider関連の未確定部分を閉じ、全Sourceの関数・型・私有状態・直接利用側・公開API・QA／試験との対応を固定候補で確認する。File一覧だけを確定の根拠にしない |
| 2 | Objective／Task／Decision／Stateの再配置 | §38.3／38.8のOwnerへ分配し、不要な中継を統合する。純粋な状態遷移と保存・乱数・実行構築の依存閉包を分け、元の順序と拒否条件を維持する |
| 3 | 小Folderの解体 | identity／input／lease／platform／process／queueの実体を確定Ownerへ移す。型契約を削除せず、OS技術と上位の必要保証を区別する。互換barrelや新しい共通置場を作らない |
| 4 | Executionと専門Packageの整理 | 廃止後67 Fileを十二の共通実行責務と既存専門Ownerへ分配する。Provider仕様はAI Adapter、Docker技術はDocker Isolation、OS技術はPlatform Accessへ。私有Map・Control・期限・失効と回収順序を保持する |
| 5 | 利用側・名称・設計の全数追従 | 公開API・CLI・scripts32件、Workbench／MCP／template、UT／IT／ST、Symbol／Catalog／Traceabilityを同じ実装単位で追従する。関数・型・変数名、HeaderとArchitecture／QAも更新する。移管後まで利用側追従を放置する順序ではない |
| 6 | 固定候補の最終確認 | 受付→Objective→Task→Attempt→結果受領／回復について正常・失敗・取消・遅延／重複通知・Owner喪失／再入場を確認し、独立レビューと必要な文書・直接影響確認を閉じる。未観測の実境界や全体QAをPassへ換算しない |

各実装単位は、依存するOwnerを先に確定し、変更した意味から回帰を選んで区切る。全体の長時間回帰を小さな移動のたびに機械反復しない。保存六Fileでは同じ型・関数へのimport declarationの参照先だけ追従でき、本文・Schema・CAS・Lock・確定順序を変更しない。目標外Fileや契約の意味変更が必要なら、理由・影響・代替を人間へ提示する。実AI②の再試行、保持物の観測／変更／削除、実Docker操作、追加の管理Frameworkは引き続き対象外である。

現在の人間判断は追加不要。順序1の割当は未完了であり、本計画の記録をSource移管又は完成へ読み替えない。

### 38.14. Stateと共通入力の割当具体化

StateはArchitecture §16.1の九Fileへ整理する。次の表は全宣言を基本の処置単位とし、混在元だけ宣言名・群を分ける。Source移管はまだ行っていない。

| 現行の全宣言又は明示群 | 移管先 | 直接利用側・保持条件 |
|---|---|---|
| `state/model.ts`、`queue/types.ts`、`task/single-task-record.ts`の全宣言 | `state/model.ts` | 現在State、Queue、単発記録の閉じた値モデルと検査。StorageとTaskの型／値参照を同じ実体へ追従し、保存・実行依存を導入しない |
| `input/plain-data-snapshot.ts`、`input/repository-relative-path.ts`、`state/binding.ts`の全宣言 | `state/model.ts` | Proxy／Accessor非実行、arrayの上限とblocked形、Pathの正規化・大小文字比較、BindingのHash式を不変更で移す。Domainの同名APIとの返却形差を変換Adapterで隠さない |
| `state/activity-types.ts`の全型、`CoordinatorProjection`、`CoordinatorStateQuery`、`CoordinatorStateQueryResult` | `state/types.ts` | 公開照会・観測の共有値型。Root公開集合を維持。Modelの状態型と保存Port型は各Ownerへ残す |
| `COORDINATOR_STATE_QUERY_CONTRACT`、`queryKeys`、`validId / validRevision`、`inspectCoordinatorStateQuery` | `state/request.ts` | 同じ入力文法と拒否。字句検査を結果Validatorから内部参照できるようにするが、Root公開APIを増やさず、新しい検査処理を作らない |
| `state/projection.ts`の上記共有型以外、`state/activity-cursor.ts`、`state/activity-validation.ts`の全宣言、query-contractの`resultKeys / projectionKeys / OBJECTIVE_STATES / TASK_STATES / validReason / countSnapshot / inspectCoordinatorProjection / inspectCoordinatorStateQueryResult` | `state/projection.ts` | Stateの投影、公開値の相関検査、Cursorのbyte形式を同じ純粋Ownerへ置く。照会・Reader・Writerをimportしない。入力字句検査はrequestの同じ実体を使い、複製しない |
| `state/query.ts`、`state/public-query.ts`の全宣言 | 同名Fileを維持 | 読取りPortの呼出しと、本番の認証／Repository／Snapshot組立ての境界を維持する |
| `state/activity.ts`の全宣言 | `state/observation.ts` | 認可済み集合の観測、EIの要約投影と全体pagingを維持。EI履歴の正本・WriterやCacheを引き取らない |
| `state/persistence.ts`、`identity/clock-and-hash.ts`、`lease/controller.ts`の全型 | `state/persistence.ts` | 保存・Lease／Owner観測・ClockのPort型だけを共有し、Kernel handleや乱数を生成しない |
| `operation-result.ts`、`operation-result-contract.ts`の全宣言 | `state/result.ts` | 既存の結果Shapeと公開失敗投影を同居するが、結果の意味・field・固定理由を統一変換しない |

同名の私有Helperは移管元を区別する名前で参照を追従し、名前だけを理由に条件の異なる検査を共通化しない。型専用参照は型専用のままとする。Snapshot Writerが使用する値検査は、model→request／projection／query／storageの逆依存を作らない。queryのPort呼出しはI/Oがない純粋計算と誤記せず、移管時のHeaderも実際の境界へ訂正する。

代替として旧query-contract一Fileへ型・入力・結果を保持する案も照合したが、公開観測型と入力・結果検査のOwnerが曖昧に残るため採らない。逆に入力検査をDomainの既存APIへ一括置換する案は、返却形・拒否条件・利用側の意味まで変えるため対象外とする。九Fileは既存処理の配置先であり、新しいParser・Port実装・Factory・管理状態を新設する案ではない。

`execution/provider-lifecycle.ts`は、`describeProviderLifecycleContract`を本番diagnosticsが使用することを確認した。現行の計画・合成評価も既存QA／coverageの対象であり、今回の四実装廃止へ追加しない。まず既存全宣言をdiagnosticsのOwnerへ保持する方針で対応し、単に試験専用と仮定して削除・試験側コピーを行わない。Provider仕様の移管と、全Executionの私有状態・型の分配は引き続き照合する。

この具体化だけではPhase 1全体を完了としない。State／入力の利用側・保存の純粋閉包と、残る混在元の全宣言を固定候補で確認してからSource移管へ進む。

### 38.15. Task・判断の混在宣言の割当

§38.7の全宣言単位の配置を基本とし、混在する元Fileだけ次の例外を適用する。実行順序・値契約の変更ではなく、既存宣言の所有者の確定である。

| 元File・宣言 | 移管先 | 維持する責務と利用側 |
|---|---|---|
| `task/execution-contract.ts`の全型 | `task/types.ts` | Task入力・結果・依存・公開観測の同じShape。実行やSnapshot取得の値依存を型Fileへ入れない |
| 同Fileの`COORDINATOR_EXECUTION_CONTRACT / validSingleTaskResult` | `task/dispatch.ts` | 元Attempt／Operationへ結合した回復参照と結果fieldの相関検査。回復参照Mapは呼出し元から受ける同じ引数のままとし、共有Mapを新設しない |
| `task/host-adapter.ts`の`CoordinatorExecutionHostAdapterOptions`、`task/recovery-adapter.ts`の`CoordinatorTaskRecoveryHostDependencies` | `task/types.ts` | Clock・Process安全操作と回復実装の入力Port。生成実体を型と同居させない |
| 上記二Fileの型以外、`task/intelligence-adapter.ts`の全宣言、既存`task/dispatch.ts` | `task/dispatch.ts` | 既存Clock／Hashの生成と元Process安全状態への接続、認可済みRootに束縛した回復、EIへの記録呼出しを維持。EIの履歴保存を引き取らない |
| `task/recovery-transitions.ts`の`recordProjectTaskResultAcceptances / acknowledgeProjectDockerRecoveryObligation` | `task/acceptance.ts` | 原子受領に渡す純粋遷移。Bの保存実装・確定順序・同じ回復参照を変えない |
| 同Fileの残る全宣言 | `task/recovery.ts` | mark／settle／retry／Owner喪失の純粋遷移。技術回収を実行しない |
| `decision/records.ts`の`CoordinatorDecisionStore / CoordinatorDecisionRecoveryStore / CoordinatorDecisionPort`、`decision/acceptance-authority.ts`の`CoordinatorAcceptanceDecisionRecord`以外の全型、`decision/capability.ts`の全型 | `decision/types.ts` | 保存・認可・CapabilityのPort型。乱数・I/O・秘密値の発行を含めない |
| `decision/records.ts`の残る全宣言、`decision/acceptance-record.ts / recovery-record.ts`の全宣言、`CoordinatorAcceptanceDecisionRecord` | `decision/records.ts` | 耐久値とEnvelope、意味検査を純粋な閉集合にする。`Envelope`等の内部名は実責務を表す名前へ追従し、既存の公開aliasは同じ型へ維持 |
| `decision/record-acceptance.ts`の`COORDINATOR_ACCEPTANCE_DECISION_CONTRACT / ID / REVISION / CoordinatorAcceptanceDecisionRequest / validRequest` | `decision/request.ts` | 受入判断の入力と検査。既存の人間判断入力と条件の違うID検査を無理に共通化せず、内部名は用途で区別する |
| 同Fileの`CoordinatorAcceptanceDecisionDependencies / CoordinatorAcceptanceDecisionResult` | `decision/types.ts` | 入力・保存Port・結果の型参照だけを使用する。型参照の循環と実行時の循環を区別する |
| 同Fileの残る全宣言 | `decision/acceptance.ts` | 準備Record→状態適用→最終Recordの順序、同一要求への再入場、重複拒否を維持。入力検査はrequestの同じ実体を内部参照する |

`task/requests.ts`のFactory内requests Mapは、その生成・参照・取消・結果保持のclosureを分割しない。`decision/lifecycle.ts`と`capability-adapter.ts`は同じLifecycle Ownerに同居させるが、Capability発行の乱数取得は従来の明示呼出し時だけとし、Module import時には行わない。`decision/authority-adapter.ts`の認証済みPrincipal照合はrequestへ置き、Access Managementのロール判定やCredential保存を引き取らない。

直接の公開Root、Objective本番組立て、Task進行・回復・DecisionのUT／IT／ST、Bの純粋値importを同じ実装単位で追従する。旧File内の再exportだけを新たな中継Fileとして残さず、Rootが元の実宣言を明示公開する。Source移管・回帰完了の記録ではない。

### 38.16. Executionの私有状態を保持する割当

着手前の読み取り専用確認により、§38.7の混在候補を次の単位へ具体化する。全宣言の基本Ownerと、そこから外す宣言を分ける。単に「回復」という名前を持つことを理由に私有Mapから処理だけを切り離さない。

| 元File | 基本Owner・例外 | 私有状態と直接利用側 |
|---|---|---|
| `execution/task.ts` | 基本は`execution/controller.ts`。`ProductionOperationFailure / productionOperationFailures / productionOperationFailure / throwProductionOperationFailure / createProductionOperationRoot / createIsolatedCoordinatorTaskOperationCreationCandidate`は一体で`execution/operation.ts`。`classifyCoordinatorTaskTerminalLifecycleState / projectDevelopmentTaskResultAfterOuterCleanup`は`execution/result.ts` | Control・Runtime・開発用取消Map、開始／取消／配送captureはcontroller内に保持。Task受付とObjectiveの本番組立てが同じ実体を呼ぶ。結果関数からのControl関連型は型専用参照に限定 |
| `execution/attempt.ts` | 全宣言を`execution/controller.ts` | 開始通知、完了観測、取消join、Effect前拒否と結果Snapshotの一体性を保持。上位Task／Objectiveの直接呼出しを追従 |
| `execution/provider-controller.ts` | 基本は`execution/controller.ts`。`ProviderProcessStartedNotice / ProviderBoundaryDiagnosticNotice`の型は`execution/observation.ts`。`PrimaryFailureDiagnostic / BLOCKED_START_KEYS / STARTED_KEYS / COMPLETION_KEYS / ownDataValue / exactPlainRecord / projectDockerProcessControllerStartResult / projectDockerProcessControllerCompletionResult`と、`PURPOSES / DockerCommandPurpose / DockerSetupCommandPurpose / SETUP_COMMAND_FAILURE_REASONS / isDockerSetupCommandPurpose / blockedCompletionReasons / DockerProcessControllerFinalReason / isDockerProcessControllerPublicCompletionReason`は`execution/result.ts` | production／candidate state、ExecutionRecord、Control Map、start／cancel／executePlanを一体保持。通知Reporterはstream・timer・error・完了収束を所有するためControllerに残し、三つの時間定数とDI固定契約の取得一回・初期化時点を維持する。Resultに固定Purpose・理由検査までの値依存閉包を置き、`controller→result／observation`の一方向とする。Observationの一次失敗型はResultから型専用参照。理由実値・配列順・条件を複製・緩和しない |
| `execution/isolation-execution.ts` | `Command / PreparedPlan / resolveIsolationCommandInput / validatePlan / planIdentity`は`execution/preparation.ts`。残る全宣言は`execution/controller.ts` | Docker Isolationへのruntime束縛、start／command／cleanup／verifyは同じruntime closureを維持。技術実装自体は既存Docker Isolationを呼ぶ |
| `execution/provider-execution.ts` | 全宣言を`execution/advice.ts` | Host失敗と初期化失敗の二WeakMap、Operation／Runtime生成、取消・回収・結果を一体保持。Host回復関数だけをrecoveryへ移す候補は採らない。助言とTask受付は同じOwnerを使用 |
| `execution/provider-types.ts` | `ProviderAdviceRuntimeResult / ProviderAdviceRuntime`は`execution/advice.ts`。残る全宣言は`execution/preparation.ts` | prepared／management WeakMap、Authority失効・Mount完了callbackの型は準備Lifecycleの一部。名前にRuntime又はDockerが含まれるだけで別Packageへ移さない |
| `execution/types.ts` | `TaskCompletionObservation`→`execution/observation.ts`、`CoordinatorTaskAttemptInput`→`execution/request.ts`、`CoordinatorTaskRecoveryObligation`→`execution/recovery.ts`、`CoordinatorWorkspaceResult / CoordinatorTaskAttemptResult`→`execution/result.ts`、残る`CoordinatorAi*`五型→`execution/advice.ts` | Root公開・Attempt・結果検査・助言・上位Taskの型参照を各実Ownerへ追従。汎用types置場へ再集約しない |
| `execution/claude-subscription-authentication.ts` | 全宣言を`execution/authority.ts` | 認証計画とRuntimeのWeakMap、回復Record、Home排他、認証実行・回収を一体保持。運用scriptと専用試験を追従し、AI Adapterへ認証状態管理を移さない |

同じ移管先に存在する複数のproduction stateは、別の現在用途を持つ既存実体として保持する。変数名の衝突は用途別の名前で解消し、SingletonやMapを共通化しない。新しい登録API、回復bridge、汎用callback frameworkは追加しない。B六Fileの参照は同じSymbolの移管先だけへ追従する。

この割当の確認は実行部分の着手前整合であり、移管後の独立レビュー・回帰を代替しない。OS／Platform／Root／Homeの境界は、残る配置照合を終えてPhase 1へ統合する。

### 38.17. 専門境界の最終割当

§38.7の未確定候補を、実装と利用側の照合により次のとおり修正する。目標のExecution十二File・Decision九Fileに収容し、新しいFile・公開API・中継を増やさない。

| 元File・宣言 | 確定Owner | 理由・保持条件 |
|---|---|---|
| `platform/contract.ts`の全宣言 | `execution/diagnostics.ts` | 実行技術の必要保証・利用可否の照合であり、状態照会の入力契約ではない。Stateのrequest／typesへ移す候補は採らない。Root公開名と保証集合・unknownを維持 |
| `platform/windows-adapter.ts`の`CoordinatorWindowsLeaseOwnerObservation / observeLeaseOwner` | `execution/kernel-lock.ts` | PAの生存観測を元Owner世代とunknownへ対応づける。生存観測を独自実装しない |
| 同Fileの残る全宣言 | `execution/diagnostics.ts` | 既存PA／VCとauthority／kernel-lockの具体操作を束ねるFactoryを維持。総合Adapterの公開契約を今回は廃止しない |
| `execution/root-observation.ts / root-path.ts / provider-home.ts`の全宣言 | `execution/authority.ts` | 生OS操作ではなく、Root／Homeの値検査と保護・認証・Mountの上位候補契約。PAへ移すと上位Policyを逆流させるため採らない。既存PA／AI Adapter APIへの委譲を維持 |
| `execution/interactive-console.ts`の全宣言 | `decision/external-send-grant.ts` | PAが端末技術を所有済み。ここでは送信同意・期限・取消・cleanup unknown後のpoisonを維持する |
| `execution/model-selection.ts / delegation-route-selection.ts`の全宣言 | `execution/preparation.ts` | risk・作業種別・独立レビュー・委譲chainはCoordinatorの実行方針。Provider固有のfamily選択等は既存AI Adapter APIを使い、上位の方針まで移管しない |

Root候補の`inspectWindowsRootObservationCandidate`は現在常に未実装理由で拒否する。今回もそのまま保持し、新しいOS観測や保護の成立を主張しない。`describePlatformAccessAdapterContract`もauthority内の既存説明として保持する。diagnosticsへ分割するとFactory経由の値循環を作るため、重複説明の縮小は実在するPA説明APIで置換できる場合だけ別途評価する。名前だけで技術Ownerへ移すことを優先しない。

Model／Delegationの候補選択と、authorityのGrant発行・消費・失効は分けたままとする。同名の`Provider / PROVIDERS / ROLES / createBlockedResult`等は用途別に改名し、異なる条件・結果を共通化しない。これにより`diagnostics→authority／kernel-lock／PA／VC`、`authority→PA／AI Adapter`、`preparation→AI Adapter`の依存を保持し、専門PackageからCoordinatorへの逆依存を作らない。

現在145 Sourceの処置は、§38.7の全宣言単位の基本配置から、§38.11の四廃止、§38.14〜38.17の具体割当へ上書きして一意に照合する。旧一次表の候補を現行の確定Ownerとして流用しない。公開Root・本番組立て・scripts・試験・登録の追従と私有状態の保持を移管単位ごとに確認する。Phase 1固定候補の確認後、Objectiveの受付依存とTask純粋遷移からSource移管を開始する。保存統合Bの本文、実AI②・保持物・実Dockerは変更対象外である。

Phase 1固定候補の独立着手前確認は残指摘0で完了した。確認で見つかったResultの固定理由検査の閉包不足と、助言回復Ownerの旧注記を修正し、再確認した。これにより配置確定から小さなSource移管単位へ進む。これは移管後のレビュー・回帰や構造再設計全体の完了ではない。

### 38.18. 最初の純粋Task遷移の移管結果

配置確定版`8633766c`から、`objective/replan-transitions.ts`の`applyCoordinatorPartialReplan / retryCoordinatorTask`を`task/lifecycle.ts`へ統合し、旧Fileを撤去した。二関数の宣言本文は改行を揃えた基準版と文字単位で同一である。Root公開名・型・条件・判定順・理由と状態更新順を維持し、Objective利用側、UT、純粋依存の全数分類、Checkerの公開Module集合、Symbolの実Path、ArchitectureとTask Traceabilityを追従した。二つの安定Symbol IDは同じ実体Pathを指し、意味上の関係は統合しない。Sourceは145→144 File、B六Fileの差分は0である。

| 今回の確認 | 結果と限界 |
|---|---|
| 状態遷移・純粋依存の二Suite | `node --test ./tests/unit/state/transitions.contract.test.ts ./tests/integration/task-platform-independence.contract.test.ts`で34件成功、失敗・skip各0。Coordinator Packageから実行 |
| 静的確認 | Coordinatorの`typecheck / format:check / lint / task-design-traceability:check`成功。lintの既存情報診断64件は維持。`git diff --check`成功 |
| 公開・保存の不変性 | Rootは移管先Path以外不変、Coordinatorの公開Module集合63件がChecker宣言と一致、B六Fileは基準版から不変 |
| 横断命名Suite | Checkerの`tools-naming.contract.test.ts`は16成功・6失敗。Rustの既存Host Record名、DIの公開Module宣言差、link／junction作成権限三件、既存Storage試験Header不足という今回外の境界である。今回のCoordinator公開集合は別途一致を確認。全体検査成功とはしない |
| 限定独立レビュー | Source・公開入口・利用側・登録・設計の残指摘0。移管した二関数と純粋依存の確認であり、構造再設計全体や実境界E2Eの完了ではない |

次はObjective受付依存の`objective/public-operation.ts`への統合と利用側追従を行う。②のAI再試行・保持物の観測／操作、実Docker・認証は行っていない。

### 38.19. Objective受付依存の統合結果

基準版`9ba6a7873`から、`objective/intake-dependencies.ts`の型一つ・私有関数三つ・`runCoordinatorObjective`を`objective/public-operation.ts`へ統合し、旧Fileを撤去した。宣言本文と実行順序は維持し、受付関数のHeaderだけは実際の保存・実行委譲・終了後整理を説明する内容へ訂正した。旧Fileの再export三つは残さず、入力検査の試験は実Ownerの`request.ts`へ直接接続した。Objectiveは`request / plan / execute / replan / public-operation`の五File、Coordinator Sourceは144→143 Fileとなった。

Package Rootの公開集合とB六Fileは基準版から不変である。実行関数の宣言本文も基準版と文字単位で同一。Symbolの安定IDは保持して実Pathだけを追従し、358登録の欠測Path・重複IDはいずれも0。公開受付・保存・回復・取消の保証をFile統合のために変えず、新しいPort・中継・Lock・状態を作っていない。

| 確認範囲 | 結果と限界 |
|---|---|
| 直接利用側・状態／回復の四Suite | Coordinatorから`node --experimental-test-module-mocks --test --test-concurrency=1 ./tests/integration/task-objective-intake.contract.test.ts ./tests/integration/task-full-flow.integration.test.ts ./tests/system/task-recovery.contract.test.ts ./tests/integration/task-platform-independence.contract.test.ts`を通常Windows権限で実行。30成功、失敗・取消・skip各0、758,591.834ms、Exit 0 |
| 検証した経路 | 受付・重複拒否、部分再計画、同一Workspaceの直列実行、明示受入、Owner喪失、回復途中の取消／拒否／状態差、同じ回復参照による再入場・再試行と純粋依存閉包。外部AI・実DockerのE2Eではない |
| 静的確認 | Coordinatorの`npm run check`成功。整形・型・lint・Runtime／Task Traceabilityが通過。既存lint情報64件は維持。現行Source・設計・Registry・ひな型に旧Path参照なし、`git diff --check`成功 |
| 独立確認 | Source・利用側・公開契約・保存境界・設計の限定レビュー指摘0。追加importによる新しい実行時Effect・値循環なし。移管前に公開操作が読み込んでいた依存を同じOwnerへ直接配置した |

固定した検証入力は基準版からの`git diff --binary 9ba6a7873 -- 40_Develop 07_Quality/Registry/coordinator-task-design-traceability.json`、SHA-256は`043428e0aa394124c1d02fef8c7fd0db854a99b52f623d74cf1cde7db75eac0e`である。大量の実行logを正式Evidenceへ複製せず、再実行可能な試験と対象・結果を保持する。

今回の範囲でObjective配置の移管を区切り、次は§38.15のTask・Decisionの実装へ進む。構造再設計全体・全体Checker・実境界E2Eの完了ではない。②のAI再試行、保持物の観測／操作、実Docker・認証は行っていない。

### 38.20. Taskの回復遷移と結果受領の責務分離

基準版`30c802b1`から、`task/recovery-transitions.ts`の回復遷移四関数を`task/recovery.ts`へ、通常結果受領とDocker回復受領の二関数を`task/acceptance.ts`へ移した。旧`task/recovery.ts`の三つの型は`task/types.ts`へ配置し、旧混在Fileを撤去した。六関数の実装本文と三型のShapeは基準版から維持し、拒否条件を持つ関数のHeaderで誤って失敗なしと説明していた箇所だけを訂正した。

Rootの公開名・型／値区分、理由実値、判定・状態更新順、回復参照と保存B六Fileは不変である。Objective・Task実行・回復Adapter・試験・Checkerの公開Module集合・Symbol・設計Traceabilityを同じ実体へ追従した。純粋Sourceの全数分類は34→35、Coordinator Sourceは143→144 Fileであり、File数削減ではなく合意した責務配置への移管である。Symbolは359登録、欠測Path・重複IDは0である。新しい公開API・中継・Lock・状態は追加していない。

| 確認範囲 | 結果と限界 |
|---|---|
| 純粋遷移と依存閉包 | Coordinatorから`node --test ./tests/unit/state/transitions.contract.test.ts ./tests/integration/task-platform-independence.contract.test.ts`を実行。最終Header訂正後も34成功、失敗・取消・skip各0、636.7309ms |
| 静的確認 | Coordinatorの`npm run check`成功。整形・型・lint・Runtime／Task Traceabilityが通過。既存lint情報64件は維持。公開Module集合64件はChecker宣言と一致、`git diff --check`成功 |
| 直接利用側の結合 | Coordinatorから`node --test ./tests/integration/task-execution.contract.test.ts ./tests/integration/public-owner-boundary.contract.test.ts`を通常Windows権限で実行。71成功、失敗・取消・skip各0、2,492,800.7977ms、Exit 0。結果受領・欠測／重複／不一致・再入場、直列実行・予約、回復相関・未知の引渡し、取消・排他解放、公開Rootと入口のOwner接続を確認。実AI・実Dockerは使用していない |
| 限定独立レビュー | Source・利用側・公開契約・保存境界・登録・設計を確認。Headerの一指摘を是正後、残指摘0。確認記録も確定済み結果と試験入力時点の区別を維持する |

Sourceの最終差分は`git diff --binary 30c802b1 -- 40_Develop 07_Quality/Registry/coordinator-task-design-traceability.json`、SHA-256は`69371f5c4fd48a0ac0fa7a9c6bcf1efa7cf48dd113c3f77fc0bec1a70cd4cd72`である。長い結合試験はHeader訂正前に開始したため、実装本文同一の確認と、訂正後の局所試験・静的確認・独立レビューを区別する。

今回のTask回復遷移・結果受領の責務分離を限定完了とし、次はTaskの共有契約と本番組立て、Decision等の§38.15以降の移管へ進む。構造再設計全体・全体Checker・実境界E2Eの完了ではない。②のAI再試行・保持物の観測／操作、実Docker・認証は行っていない。

### 38.21. Task共有契約の実Ownerへの集約

基準版`b404cd0c`から、`task/executor.ts / observer.ts / execution-contract.ts`の共有型十三宣言を`task/types.ts`へ、固定Contract三宣言と`validSingleTaskResult`を`task/dispatch.ts`へ移し、旧三Fileを撤去した。型Shape・固定値・結果検査本文は基準版から同一である。実行・観測・保存Callbackを持つ内部PortのHeaderは、実際のCapabilityと非Authority観測の区別へ訂正した。共有型からの値ロード、定数字面の複製、新しい公開APIや互換中継は追加していない。

利用側・試験・Root・Symbol・Checkerの公開Module集合・設計Traceabilityを追従した。Rootの公開名と型／値区分は不変、公開Module集合は61件。Sourceは144→141 File、純粋集合は35→33 Fileとなり、全Sourceの一意な責務分類を維持する。Symbolは359登録、欠測Path・重複IDは0であり、安定IDを保持して実Pathだけを追従した。保存B六Fileの差分は0である。

| 確認範囲 | 結果と限界 |
|---|---|
| 直接利用側の五Suite | Coordinatorから`node --test ./tests/integration/task-platform-independence.contract.test.ts ./tests/unit/public-contract.contract.test.ts ./tests/unit/task/intelligence-adapter.contract.test.ts ./tests/integration/task-single-task-adapter.contract.test.ts ./tests/integration/public-owner-boundary.contract.test.ts`を実行。最終修正版は59成功、失敗・取消・skip・todo各0、25,064.6668ms、Exit 0 |
| 移管境界の反証 | 純粋型の二特殊依存は型専用・exact Symbol集合を無条件に要求する。参照0件、欠測、重複、追加・別Symbol、値import、別Path表記による迂回、別Ownerを拒否する。結果検査は正常値・余剰field・終了状態の矛盾・Accessor・Runtime発行回復参照の相関を確認。一般の純粋依存規則は緩和していない |
| 静的確認 | 最終修正版の`npm run check`成功。整形・型・lint・Runtime／Task Traceabilityを通過。既存lint情報64件は維持し、`git diff --check`成功。現行Source・設計・Registryに旧三Path参照なし |
| 独立レビュー | 初回に依存検査の欠測／重複見逃しと、統合先PathのTraceability重複を検出。統合修正方針を再提示して整合後、検査の反証追加と関係集合の初出順を保った正規化を実施。修正版の限定再レビューは全重大度0 |

最終Source差分は`git diff --binary b404cd0c -- 40_Develop 07_Quality/Registry/coordinator-task-design-traceability.json`、SHA-256は`8afa311bf454da92dc99d317fa38af2a3b3f2421566aa83b5aff286f12c0be63`である。§38.20の71件は前単位の結果として保持し、今回の五Suite 59件へ合算しない。大量の実行logは正式Evidenceへ複製しない。

今回の共有契約移管を限定完了とする。Host／実行観測／回復Adapter本体のdispatchへの統合、Task受付・Decision・Execution・Stateの残る配置は次単位であり、構造再設計全体・全体Checker・実境界E2Eの完了ではない。②のAI再試行・保持物の観測／操作、実Docker・認証は行っていない。

### 38.22. 残るSource配置の一括移管と最終確認

基準版`865879e7`から、CLI四File、Objective五File、Task七File、Decision九File、State九File、Execution十二File、Workspace三File、保存六File、Root一Fileの計56 Sourceへ移管した。既存の小Folderと不要な中継を撤去し、既知Secretの共通検査はDomain Modelの`plain-data/secret-validation.ts`へ移した。Coordinatorの公開Rootは217項目の名前と型／値区分を維持する。保存B六Fileは同じSymbolのimport先だけを追従し、import除去後の本文一致を確認した。

§38.16の二つの割当は、初期化時の値依存閉包の確認により次へ訂正する。

| 既存の宣言集合 | 現Owner | 保持する理由と保証 |
|---|---|---|
| 旧`change-snapshot.ts`全宣言 | `execution/operation.ts` | 対象Treeの読取り・変更観測と二つのWeakMapを一体で保持する。Resultは型・固定理由・構造検査へ限定し、保存モデルから結果定数を読む経路へ実行対象I/Oを逆流させない |
| 旧`host-submission.ts`のbegin・private transition・complete三関数 | `execution/controller.ts` | 元のcleanup result・plan・Capabilityを本番Runtimeの同一性照合へ渡す閉包を維持する。五観測、Home照合、checkpoint、Host遷移の順序を変更しない |
| Lifecycle通知Reporterと三つの時間定数 | `execution/controller.ts` | stream、timer、close／errorと一回収束を同じ実行Ownerへ置き、DI固定契約の取得回数と初期化時点を維持する |
| Host token／遷移lineage・再起動checkpointの純粋宣言 | `execution/result.ts` | 保存モデルの値検査から効果付きRecovery Runtimeへの依存を除く。物理Reader・Writer・私有Map・回復Lifecycleは`execution/recovery.ts`に保持する |

新しいWriter、永続状態、Lock、Grant、中継または互換APIは追加しない。同名の私有宣言は元用途別に改名し、異なるMapや判定を共通化しない。配置数だけから完了とはしない。型検査・Root読込み・静的検査と直接結合五Suite 162件に成功した後、全体回帰で旧Moduleを前提にした代役・固定Path・母集団の追従漏れを検出した。本番の注入口を追加せず試験側を追従し、全体回帰の完走後に全失敗を修正版の対象Suiteと照合した。以下は2026-10-24時点の構造再設計の限定完了結果であり、実AI・実DockerのE2Eや全体QAの完成とは分ける。

Sandbox内の試験失敗と通常Windows権限の結果は区別する。前者はTempのrenameと子Process／Link権限の制限で停止したため、製品の確認条件を緩めず通常権限で再確認した。実AI②、保持物、実Docker・認証・再起動／修復は今回の対象外である。

独立Source再レビューでは、純粋codecの依存とDomain共通検査Headerの指摘を是正し、二確認者とも残指摘0となった。関係16 Moduleの個別読込みはすべて成功した。値依存の循環集合は14 Module残っており、今回を全循環解消とは扱わない。試験の私有File差替えは実宣言の構文木抽出へ移行し、本番用の新しい注入口・互換APIは作らない。Root読込みは抽出試験と別に確認する。

診断SessionとNative公開結果の結合127件、Execution Intelligence通常回帰84件は成功した。試験用LCOVの合成行数は統合後の一意なFile集合へ追従するが、測定値・未到達義務・品質閾値は緩和しない。CLIの端末判定`stdin.isTTY`は読取りと区別し、Task本文の直接stdin読取りを拒否する反証は維持する。

| 最終照合 | 確認済みの範囲と限界 |
|---|---|
| 固定Source | `git diff HEAD --binary -- 40_Develop/coordinator/src 40_Develop/domain-model/src`のSHA-256は`91d044cb9e32041f90eaba875eee27c847869ce5cea487a5e8aa6599a12a3ff2`。基準HEADは`865879e7`。公開Root217名・型／値区分と保存六Fileのimport除去後本文一致を再確認 |
| 利用側回帰 | MCP 102件、Workbench 79件、Execution Intelligence 84件、Version ControlのConsumer閉集合12件成功。外部AI・実Dockerの試験ではない |
| Windows保存 | 現在状態保存・pending再入場の試験を統合後の実宣言へ追従し146,069.2237msで成功。他の同FileのWindows五条件も成功。正常Owner一回・保持あり・二回の三条件も257,432.4651msで全成功。後者の試験内Module cache不整合を是正した再確認であり、実Docker回収の証明ではない |
| 試験追従の一括再確認 | Coordinatorから既存のModule mocks・直列実行・Host明示skip条件で、診断Session、Probe四Suite、回復・再入場、再起動、認証create統括、Host Namespace、coverage母集団、修復結果、Traceability、CLI取消、状態遷移、対話境界の計18 Fileを実行。275成功、失敗・取消・skip各0、86,093.9633ms、Exit 0。全体回帰の完走とは別の最終追従確認 |
| 文書・登録 | Source配置・公開契約の独立再レビュー二者と、文書／登録の限定再レビューは残指摘0。Symbol登録はCoordinator360・Domain149、Path欠測と重複IDは0。移管用の一時データ二Fileは回収済み |
| 横断QA | 通常Windows権限の命名Suiteは19成功・既知3失敗。既存Rust試験名`host-record.rs`、DI公開Module二件の宣言漏れ、既存保存UTの必須Header不足であり、今回のSource配置の成功や全体QA Passへ換算しない。Workbench静的確認の既存React key二指摘も未解消 |

型・整形・lint（既存情報64件）・Runtime／Task Traceabilityは最終追従後も成功した。全体通常回帰の途中で見つかった旧Module差替え・固定File数・旧Path・変異位置は、実Source宣言と一意な現Ownerへ追従して再確認した。正常Owner試験では、ケース別queryに相当する抽出Module Identityも保持し、別ケースのcleanup closureをキャッシュ再利用しない。これらの追従を、新しい製品側注入口や回復管理へ置換しない。

固定した本番Sourceで`npm run test:portable`が完走した。結果は1,854件中1,830成功・19失敗・5skip、取消・todo各0、6,456,672.2778ms、Exit 1である。開始後に試験だけを追従したため、このCommand自体をExit 0へ読み替えない。本番Sourceの差分Hashは開始時から不変で、完走後も上表のHashと保存六Fileの本文一致を再確認した。

| 全19失敗の原因と再確認 | 修正版の結果 |
|---|---|
| Probe・回復の同一File差替え、Host宣言抽出、LCOVの一意File数、CLI配置とAST変異位置の追従漏れ12件 | 上表の18 File・275件が全成功。拒否条件・閾値・未達義務を維持 |
| doctor分岐のVM注入名が改名前のまま1件 | `coordinator-docker-recovery-cli.integration.test.ts`全13成功、7,488.3605ms。`CommandUsageError`へ注入名だけ追従 |
| Console禁止参照の大文字・同一Path変異が旧Fileのまま1件 | `signed-general-task-verification.contract.test.ts`全47成功、34,673.0999ms。現禁止対象の別表記へ追従し、同じ拒否Oracleを維持 |
| 動的Fake／Provider Homeの期待集合重複、保護Root子import、再起動判定の旧File／末尾抽出、診断の事前importによるmock前cacheの計5件 | `dynamic-fake-provider-coverage / execution/diagnostics / execution/protected-root / execution/restart-checkpoint / provider-home-coverage`の五Suite 21成功、2,664.1685ms。実decoder・変異・元Errorのexact参照とコピー拒否・秘密本文非開示を維持 |

追加追従も限定独立再レビューの指摘0。診断試験の抽出閉包は実宣言と実CLI rendererの接続を確認するもので、集約Module初期化までの根拠にしない。実集約Moduleの読込みは別の確認である。各再確認は同じ固定本番Sourceに対する失敗影響範囲の確認であり、異なる試験改訂を一つの全体Command成功記録へ合成しない。Workspace実Git結合18条件は最初の全体回帰で全成功した。

以上で、残る構造再設計のSource・利用側・試験・設計／登録追従を限定完了とする。公開Root217項目、保存B六File、理由実値と安全条件を維持し、新たな人間判断は不要である。横断QAの既知3失敗、Workbench既存2指摘、歴史CHG診断、Browser原因未確定および実境界E2Eは別途残る。②のAI再試行・保持物の観測／操作・実Docker・認証・再起動／修復は行っていない。main統合・リリースは含めない。

## 39. 公開操作・認証・AI選択の再設計 — 2026-10-24

利用者の四添付と`public-*.ts`解体指示を、[後続の再設計計画](coordinator-interface-redesign-plan.md)で扱う。基準は`5ccdc54a0`。Objectiveの内部構造移管、正式API／CLIの破壊的切替、共通認証、技術カタログとRepository別AI選択を段階として区別する。旧設定の製品互換Readerは作らず、フロントAIが移行する。§38の完了はこの新しい公開・設定Capabilityの完成を意味しない。
