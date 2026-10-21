# Orchestrator／Coordinator統合とDomain Model最終整理

成果物種別: 変更計画・着手前対応表
状態: A・B1〜B5完了。C〜Dは未完了
対象変更: [CHG-000082](change.md)
責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-21
統合計画の初期基準（A着手前）: `1afbc6df4a76cd6800e20a5fa98a0c994577a42f`
B調査のSource基準（A完了）: `f8f7a9986d47220a160fc141af09c6c51561e1e7`
設計正本: [Orchestrator](../../../06_Architecture/Details/orchestrator/01_Architecture.md)、[Coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md)、[Domain Model](../../../06_Architecture/Details/domain-model/01_Architecture.md)

## 1. 今回の判断と境界

人間から提示された統合計画を、第二段階の残る実行順序として採用する。従来の二Packageを維持する目標を変更し、専門Packageへ技術責務を戻した後、旧Orchestratorを新Coordinatorへ再編する。現行Sourceの所有関係は切替完了まで変更済みと扱わない。

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
| `prepare-codex-advice-image.ts` | Image構成とBuildはDI。Provider公式取得検証の既存境界を維持 |
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
