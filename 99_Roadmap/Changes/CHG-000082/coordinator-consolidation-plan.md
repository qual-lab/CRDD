# Orchestrator／Coordinator統合とDomain Model最終整理

成果物種別: 変更計画・着手前対応表
状態: AのSource整理・対象回帰・独立レビューを完了。B〜Dは未完了
対象変更: [CHG-000082](change.md)
責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-21
実作業基準: `1afbc6df4a76cd6800e20a5fa98a0c994577a42f`
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

現在、人間による追加判断は必要ない。AのSource整理・対象回帰・独立レビューを完了した。次はBの旧Coordinator能力を専門Packageへ対応付け、移管単位と利用側・失敗検証を具体化する。公開契約と順序を変える必要が判明した場合だけ、影響と最小代替案を提示して停止する。

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
