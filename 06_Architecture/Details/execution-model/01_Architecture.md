# 実行モデルの責務と単一保存契約

## 回復済みOperation参照の有限確定

既存の`saveProjectExecutionState`は、`task_recovery_finalize`要求のProject IDとTask ID／回復ID集合を受け付ける。これは要求の分類であり、保存Schemaや新しい台帳ではない。同じ短期Writer内のfreshなProject・元世代・TaskのAttempt／Operation・Cleanup確認・未解決なし・exactなDocker回復義務の終端を照合し、既存の世代更新候補を生成する。空・重複・不正ID・別Task・非終端・古い世代は拒否し、単なる一世代差から同一再送成功を推定しない。

Operationの退役とTaskの終了根拠の固定は、既存`normalizeTaskProjects`が所有する。全終端・履歴確認・未解決参照なしとTask／Attempt／Operation相関を維持し、局所候補の成功を資源回収・退役・出版成功へ読み替えない。CAS、保存後確認とLock解放の保証は既存Writerのままとする。

`saveProjectExecutionState`は有限Task更新要求だけを受け付ける。初回Projectは既存のQueue受付と同時に作成し、任意State・JSON本文・外部結果事実による更新を提供しない。余剰引数は解釈せず拒否し、Task／Attempt／Operationと未解決観測の結果事実は終端要求から内部生成する。同一再送でも同じWriterで現在版と結果相関を確認する。低位の保存・履歴保持反例はEM自身の私有Writerを検証し、上位Consumerへその準備用入口を公開しない。

成果物種別: Architecture詳細設計
詳細設計領域: execution-model

保存本文の破損、Task状態と実行Identityの不整合、Envelope不正と未確定pendingの拒否・保全規則はEMの保存Readerが所有し、その直接反証もEMの試験で行う。初期準備は正常な初回Queue＋Project受付を利用し、破損本文を受理させるための製品入口を追加しない。上位Coordinatorは現在の拒否結果の搬送、Scope・実Leaseとの接続、有限要求の再送を検証する。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Objective計画・Task・Leaseの保存状態と局所遷移を所有し、実行順序は上位へ残す | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Blockerの提案・回答・適用結果を記録し、上位受入を自動推定しない | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Operation資源と回復・終了記録を保持し、技術終了未確認を成功にしない | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 保存対象Repositoryと実行記録のBindingを照合する | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | State／Historyの単一Writer・CAS・保持・再入場を所有し、未知残存を保全する | Covered |

Coveredは局所責務の設計接続を表し、ARCH全体や実動作の合格ではない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 責務Ownerと禁止依存を固定する | [現行契約](#model-boundary) |
| Interface Model | Required | 完成操作と部分結果を区別する | [現行契約](#public-api) |
| Data Flow | Required | 受付から結果までの搬送を明示する | [現行契約](#consumers) |
| State Model | Required | 現在版・候補・未確認を区別する | [現行契約](#storage) |
| Sequence | Required | 検査・保存・終了の順を維持する | [現行契約](#storage) |
| Failure／Recovery | Required | 拒否・部分成立・不明と再入場を区別する | [現行契約](#storage) |
| Deployment | Required | Repository内所在とConsumer配置を固定する | [現行契約](#storage) |
| Observability | Required | 理由・出典と未評価を失わない | [現行契約](#verification) |
| Security Boundary | Required | 受付と認可を別Ownerにする | [現行契約](#consumers) |
| Implementation Structure | Required | 意味Ownerと保存部品を分離する | [現行契約](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 改訂・期待Identity・共通Lockを別の保証として維持する | [既存の設計処置](#storage) |
| Timing | PASS | 受付・現在観測・保存の時点と上位の許可を混同しない | [既存の設計処置](#consumers) |
| Resource Lifecycle | PASS | 自分のLock・一時物・descriptorの終了と残存を結果に保持する | [既存の設計処置](#storage) |
| External Boundary | PASS | VC・Filesystemの不存在と観測不能を区別する | [既存の設計処置](#storage) |
| State／Consistency | PASS | 局所値の受付とモデル横断・上位判断の成立を区別する | [既存の設計処置](#model-boundary) |
| Failure／Recovery | PASS | 不明を補完せず、自動再試行・移行・未知物削除を追加しない | [既存の設計処置](#storage) |
| Observability | PASS | 内容モデル・理由・Issueと保存のEffect／終了相関を保持する | [既存の設計処置](#public-api) |
| Security／Trust | PASS | 受付成功を現在認可・外部実行Authorityへ昇格しない | [既存の設計処置](#consumers) |

- `PASS`: 詳細設計上の処置を記載した状態。試験・実境界・全体QAの合格ではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。
- `OPEN`: 未解決の設計事項がある状態。
- `FAIL`: 必須設計と矛盾する状態。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | モデル種別で受付条件が異なる | 型・規則の宣言Ownerごとに局所化 | 一律Readerや差替えFrameworkへ統合しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.execution-state` |
| Common Contract | Required | 完成操作の結果相関を維持する | Rootから宣言元を直接公開 | 3モデル共通の結果Facadeは作らない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.package-boundary` |
| Creation／Selection | Required | 固定対象と入力種別を照合する | 明示した入力から対象を構成 | 上位の認可・実行先を選ばない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.execution-state` |
| State-dependent Behavior | Required | 現在版により受理できる更新が異なる | 局所遷移と改訂照合 | 読取り成功を保存・実行許可にしない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.execution-state` |
| Composition／Recursion | Required | 複数の値と整合条件を組み合わせる | 既存の完成操作内で必要な値だけを合成 | 他モデルを直接参照しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.execution-state` |
| Lifecycle Ownership | Required | 自分の保存資源を所有する | Lockと一時物の終了処置 | 未知・不明時の保全を維持する | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.state-publication` |
| External Boundary | Required | Filesystem・VC・共通Lockを利用する | 専門Ownerの技術契約へ接続 | 外部事実をモデルだけから捏造しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `execution-model.state-publication` |

## 入力・状態・保存境界の接続

モデル別の完成操作を受付し、局所規則と全Stateの同版整合を照合し、元版CASと単一Writerを経て確定結果を返す。技術実行と上位スケジュールは所有しない。 不正入力・競合は後続Effectを開始せず、Effect後の不明は元の相関と残存を保持する。通常の読取りを暗黙更新へ変換せず、現在の保存形式・公開集合・期限・安全判定は変更しない。
状態: 現行実装の設計。今回の限定検証・独立レビューは変更記録で追跡し、全体回帰とは区別する
担当責任者: Qual-Lab
最終更新日: 2026-11-15

<a id="model-boundary"></a>
## 1. モデルと責務境界

実行モデル（Execution Model、以下EM）は、実行に関する業務モデルと、その同版整合・保存を所有する。実行の順序や再試行の判断はCoordinator、単一の技術実行はExecutor、Providerの計画・解析はAI Adapter、Docker実体の生成・観測・回収はDocker Isolation（以下DI）が所有する。

| モデル | 所有する意味 | 所有しない判断 |
|---|---|---|
| Objective／Project | 目的・計画・定義とその同一性 | AIへの実行依頼、再計画の実行順 |
| Task／Queue | Task状態、選定、受付とLease Intentの相関 | Scheduling、物理排他の強制回収 |
| Attempt／Operation／Repair | 実行・修復記録、資源観測、局所遷移と終端条件 | Docker実体の操作、技術観測の生成 |
| Workspace | 候補・結果・採用の保存相関 | Gitの技術操作、採用の人間判断 |
| Decision／Blocker | 障害、提案、回答、適用と解消の記録 | 上位の認証、回答の代理決定 |
| History | 履歴行の意味、要約、同一性、保持候補 | 全Stateの改訂、物理出版 |
| State | 上記モデルの同版相関、保存値、改訂と全体遷移 | モデル局所規則や物理Writerの再実装 |

一つのBlockerに複数の提案・回答を保持し、各提案への回答は一つとする。承認の適用で解消し、拒否・保留は未解消のままとする。Taskの中止は別の状態遷移であり、判断の期限切れによる自動解消を設けない。別Blockerの副次的解消・新規発生を含む再評価は将来の判断対象であり、現在の自動処理としては提供しない。

### Package依存

EMはNode.js、Version Control、共通Lockを利用する。文書モデル・構成モデルとの直接依存は、実装・型・再export・深いimport・dynamic import・package依存を含めて持たない。設定・選定は上位が取得・確定して渡す。

EM SourceはAD／DI型を直接参照しない。`ExecutionSelection`の技術選定五項目、`OperationResources.snapshot`の非秘密資源情報、一次失敗の`turnCountDiagnostic`はEM所有の保存契約である。上位のCoordinatorが技術型と保存型の構造適合・入力搬送を接続する。型適合は認可・保存成功・技術Effectの証明ではない。

他Packageの試験も同じ依存方向に従う。EMの内部検査はEM自身、DIの内部検査はDI自身、両者の接続はCoordinatorが所有する。外部ConsumerはEM Rootの公開契約を使い、試験目的の深いimportや互換Facadeを設けない。

保持設定も同じ境界で分ける。上位の設定取得・日数搬送・履歴枝の再観測はCoordinatorの試験、日数null／不正値の早期拒否と保存時のOwner確認はEMの試験が所有し、EMからCoordinator Sourceを読まない。

## 2. Logical BlockとSourceの所有

| Source | 責務 | 境界 |
|---|---|---|
| 各モデルの `types.ts` | モデル、要求・結果、閉じた値域 | 保存型の正本。上位要求・表示型を持たない |
| 各モデルの `validation.ts` | 局所構造・相関・遷移と受理候補の検査 | 未信頼入力とJSON解析済み値の検査を同一視しない |
| 各モデルの `operations.ts` | 保存しない意味計算、正規化、用途候補 | 値検査からCRUD・Storageへ戻らない |
| 各モデルの `crud.ts` | 完成したモデル操作、認可・現在値と保存接続 | 空Wrapperや第二Writerを作らない |
| `state/validation.ts` | 全Stateの解析・同版相関・改訂と候補結合 | 局所モデルの意味計算は各Ownerを使う |
| `state/lease.ts` | Leaseの照会・取得・解放・回復と専用候補・観測 | 共通State保存を再実装せず、既存の排他内更新へ一方向に接続 |
| `storage/store.ts` | 固定保存所在、File読書き、初期化 | 履歴の意味やモデル遷移を再実装しない |
| `storage/lock.ts` | 保存排他とOwnerの取得・保持・解放 | 業務上の再入場判断を代行しない |
| `storage/publication.ts` | 単一Writer、CAS、出版・再入場、短命証拠 | Attempt／History CRUDへ実行時逆依存しない |

SourceはRootの`index.ts`、objective／task／attempt／decision／workspace／state／historyとstorageで構成する。operationsはobjective／attempt／history／stateに置く。Taskの操作調停・単件投影はTask CRUDに集約し、全Stateへの組込四関数はState validationが所有する。旧task/operations.tsや転送入口は残さず、存在しない役割のためにFileを増やさない。

Leaseの公開四操作・候補九用途・Root観測・専用結果構築はstate/lease.tsが所有する。通常State CRUDへの接続は既存withSnapshotOperationだけとし、RootはLease宣言元から直接公開する。State CRUDからLeaseへの逆参照・旧位置のWrapperは置かない。全Stateの更新時に履歴／Leaseの現在観測を要する閉鎖・退役判定はState CRUDが所有し、History CRUDも同じ判定実体を利用する。validationは観測callbackや通知を呼ばず、元版・候補・閉じた入力の値検査へ限定する。候補の成功／拒否封筒は保存結果とは別の局所constructorで元field・freeze・既定値を保ち、Storage結果型へ置換しない。観測と通知の回数・順序・短絡位置は変更しない。

### Stateの値契約と各モデルの意味

`state/operations.ts`の所有範囲は、Execution Stateの保存値契約・主体／Identity・正規化・Hash・Lease証拠と相関に直接関係する値処理に限る。利用元が多いことだけを共通化の理由にせず、全State検査・保存・Authorityを持たせない。

Taskの候補・回復・結果参照の文法はTask、計画定義HashはObjective、採用拒否はWorkspace、資源の新しい不存在辺はAttemptが所有する。資源差分に対して専用保存証拠を要求するのはStorageである。Plain Dataのdescriptor捕捉とJSON解析済み値のkey検査は入力の由来・例外条件が異なり、同じHelperへ無条件にまとめない。新しいcommon Packageや転送exportは設けない。

### History・State・Storageの接続

| Owner | 処理 |
|---|---|
| History validation | 全行解析、重複・部分行・未知Schema拒否、追記受付の候補生成 |
| History operations | 行・要約生成、両Hash照合、同ID exact比較、元順序での保持選別、pending全文比較、Buffer独立捕捉 |
| History CRUD | 全Stateの閉鎖・保持参照を必要とする履歴保存、記録退役、完了確認 |
| State validation | 全体解析、保持参照・必須Hashの投影、同じ元版の履歴候補とState候補の結合 |
| Storage | 現在Owner・元本文・File・設定のfresh照合、CAS、物理出版、読戻し |

`prepareHistoryAppend`は現行全行と未来時刻を先に検査し、Task入力、同版Decisionの投影の順に候補を作る。同ID同本文は追記せず、異本文は候補全体を拒否する。追加なしは元Bufferを返し、JSON例外は拒否する。

保持処理は参照保護と必須行の存在・両Hash照合を区別する。選別前に欠測・衝突を拒否し、現在参照・reviewAfter前・保持期間境界の行を元順序・元本文で残す。同期した一回の候補導出では検査済み元Stateを使うが、最終遷移検査とWriterのfresh照合を省略しない。候補成立は保存・退役・資源回収の成功ではない。

<a id="public-api"></a>
## 3. 公開契約

Rootは94項目（58値・36型）。完成した読取り・更新・終了・回復・履歴操作、独立した入力受付とモデル語彙を明示公開する。正確な集合は`src/index.ts`と固定期待値の公開契約試験で確認する。件数を目標にunknownや巨大Unionへ置換しない。

管理Projectの読取り・保存成功結果は、同じProject・世代から導出した`taskStartCandidates`を非永続の観測として返す。並列枠・未回収資源の予約・Path／Conflict Key・定義順の規則はTaskが所有する。観測はAuthorityではなく、予約・引渡し・開始観測は既存の`saveProjectExecutionState`が有限の`task_start`／`task_handoff`／`task_started`要求を受け、同じ短期保存Ownerのfresh Stateで再検査する。保存形式・一般Task定義CRUD・他の更新の保存境界は変更しない。

同じ保存入口は`task_retry`／`task_replan`も受け付ける。再試行の上限は対象TaskのretryCount、部分再計画の上限は置換済みTask数であり、共通counterへ統合しない。分類・再試行の実行判断とQueue再開はCoordinatorが所有する。EMはfresh状態で元世代・回数・置換範囲・依存と循環を照合し、保存とLock解放を確認した時だけ、同版の対象Task一覧`taskUpdateTaskIds`を非永続の成功情報として返す。直後再送はTask初期値・定義順・対象ObjectiveとMilestoneの確定状態まで一致する場合に限り、既存の同候補耐久確認へ接続する。

`task_settle_before_effect`はstarting／handoff_preparedの開始前終端だけを扱う。結果解釈はCoordinatorが所有し、EMは元世代・Task／Attempt／Operation／Authority相関、失敗・取消・回復必要と回復義務を検査する。同じ捕捉値から結果事実を一件だけ内部生成し、Task終端と関連Operation整理を同じ物理Writerへ渡す。CallerのresultFacts追加は拒否し、candidateId等の余分fieldも無視しない。直後再送も同じ規則で候補を再構築して全文一致を確認し、内部結果事実を省略せず耐久再確認する。通常終端のphaseと混同せず、回復バッチは別の更新境界として扱う。

通常のrunning終端は`task_settle`で扱う。清掃未確認の失敗はcleanup_pending、完了・取消は清掃確認を必須とし、候補は完了に限る。完了依存のready化とObjective／Milestoneの更新を同じ候補で行い、受入を自動確定しない。業務上のrecoveryUnresolvedと結果事実のresultUnresolvedを分け、結果事実はEMが同じ有限要求から内部生成する。同じTask本文でも結果事実だけ異なる再送は既存Writerの照合で拒否し、Task終端と技術Operation整理は一保存のままとする。Coordinatorの旧task/lifecycle.tsと保存転送関数は撤去し、回復義務の更新も同じ有限保存へ統合する。

初回ProjectとQueueの作成は`createQueue`のscheduled操作で完結する。第二入力は完成Stateではなく`ProjectExecutionInitialization`とし、閉形式捕捉・入力検査をStore初期化より先に実施する。モデル内部でgeneration 1と依存待ちを組み立て、同じ保存候補へProjectとQueueを結合する。freshな同ID照合を優先し、再送で勝者のOwner・固定選定・初期値を置換しない。初期生成HelperはRootへ公開しない。Taskの開始・終了・回復義務更新は有限保存へ接続するが、Owner不在・元Operationの実観測はCoordinatorに残し、その結果からの状態結合は同じ有限保存が所有する。初期生成だけから全制御の移管済みを主張しない。

通常CRUDの`queryPlan`／`queryObjectives`／`queryTasks`／`queryQueue`と単件取得、同版複合取得の`readState`を区別する。`queryQueue`は現在の本番外部Consumerがなくても、採用済みの認証・対象限定付き通常一覧Capabilityとして維持する。他の93公開項目には本番の直接参照があるが、参照の存在だけを設計上の必要性の証明とはしない。

### 独立した入力受付

残る八公開は`inspectDecision`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`、`isPrincipalId`、`parseDockerTaskRecoveryId`、`parseHostRecoveryToken`、`validateResourceBook`である。

未保存の計画・選定、未知Processからの完全Decision、入口主体、Operation保存前／Host-only相関、別の認証回復記録、保存済みQAイベント列に独立した信頼境界がある。これらを検査目的の先行保存やCoへの規則複製で置き換えない。同じ受付内の検査済み・独立捕捉済み値は再利用するが、別の入力境界・Lock区間・保存直前のfresh検査へ拡張しない。

Resource Bookの更新は次値を遷移検査内で一回検査し、元Book・Receipt・Label・正式未発行・不存在証拠の条件を保持する。`validateResourceBook(before)`の比較指定を省略した場合は値検査だけであり、必要な遷移検査の省略許可ではない。

<a id="consumers"></a>
### 利用側への受渡し

| 利用側 | 受け渡す内容と責務 |
|---|---|
| Coordinator | 判断済み要求、認証済み主体、確定選定、技術観測を渡す。EMの検査済み値・改訂・元回復参照を搬送する |
| Workbench／MCP | 既存認可を通すモデルCRUD／上位の完成操作を利用する。Storage内部Contextを構築しない |
| AD／DI／Executor | EMを参照しない。保存型との対応と連携試験は上位Ownerが持つ |

要求・表示DTO、Workspace結果搬送、AIへの機密検査はCoordinatorが所有する。EMは保存規則を所有し、OSユーザーからPrincipalを自動生成・置換しない。上位が確定した主体を記録する。

判断操作は質問・選択肢・回答者・日時・理由・適用結果を含む完全記録を返す。同一Processで完成操作が返した検査済み値を表示だけのために再検査・再照会しない。未知Process結果は既存結果受付で一度検査・独立捕捉する。

## 4. 読取り・更新・終了の契約

### 同じ保存版の読取り

`readState(repository, binding, scope)`は固定四範囲だけを返す。未知・欠測scopeを読取り前に拒否し、任意field投影やcallbackへ広げない。

| scope | 取得内容 |
|---|---|
| `queue` | `queueEntries`、`leaseIntents`を通常Readerの一回から取得 |
| `execution` | `projects`、`queueEntries`、`schemaRevision` |
| `workspace` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

二引数形式の`operation`は現在Owner、`recovery`は真正Repositoryの権限境界を持ち、固定用途inputで読取り内容を選ぶ。未知用途はOwner callback・保存前に拒否する。同版の`operationStates`は元操作参照と終端判定の不変な組であり、IDだけで他版の操作と混ぜない。不存在と観測不能、読取り成功と解放成功を区別する。

開始前の`operation_start`は現在Ownerと初回Identityだけを検査し、State読取り・Lock取得・初期化はしない。結果の`value:null`と`lockReleased:true`は未取得を示し、保存・開始許可・現在State観測を意味しない。

回復Readerは再起動準備、Host遷移、資源出版の元／候補pair、終了相関を既存取得に結合する。Coは同版・排他・現在性と実Host tokenを確認してから使う。完了観測は単なる操作不存在ではなく、同nonce残存拒否・終了履歴・回復ID・correlationId・読取り・解放の共同成立である。

<a id="repair-write-contract"></a>
### 保存更新と技術結果

`saveRepairRecord`は期待StateVersion（初回null）と、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの論理更新を受ける。EMがexact対象、元改訂・Hash、現在Owner、対象外全文を照合して候補を構築する。Coは次Snapshotや正規符号化byteを組み立てない。

保存確認と排他解放まで共同成立した場合だけ、確定`operation`・`version`と対応する`checkpointSettled`／`disposalSettled`を返す。保存・解放不明のvalueはnullであり、未確認版を次の正本に補完しない。八処置の値上の終端は修復全体の成功ではなく、上位がEngine・Host安全性・Cleanup・Lifecycleの技術結果と結合する。自動再基準化・再試行はしない。

`saveOperationStart`は開始保存と終端Context準備を`startSaved`／`completionContext`で区別する。保存済みでも準備失敗ならHost要求を出さず、元参照・保存Effect・解放不明を保持する。`completeOperation`は元Host／Controller結果の同じ参照を固定し、入力受理と保存結果を区別する。ContextはProcess内だけで使用し、保存値から復元しない。Task結合操作はTask終端と同じStateで終了し、非結合操作は技術終端・履歴確認で終了する。配送ACKは終了条件ではない。

`saveRecoveryCheckpoint`の資源未発行・Host清掃準備・認証不明終了・資源再出版は、それぞれの元Owner、元本文、再観測・一回証拠、元／候補全文pairの条件を保つ。`completeRecovery`／`saveRecoveryHistory`はdocker_task／runtime_repairを固定用途で区別する。履歴保存は要約固定・保存・最終fresh確認まで一回の完成操作とする。

Lease IntentはRepository・Project・Queue・種別からIdentityと回復IDを生成し、保存前通知・物理取得確認・Owner喪失観測で同じexact値を使う。呼出し側のOwner世代・Process IDと物理排他、回復順序は別の保証として保持する。

<a id="storage"></a>

### 実行の終了記録を保持する保存契約

保存候補は`crdd-execution-model/state/v6`、内部投影は`project-snapshot/v9`を使用する。旧形式の互換Reader・自動移行は追加せず、既存保持物は今回処置しない。Coordinator整理のためのEM変更であり、独立した重複防止Storeや台帳を新設しない。

Queueは受付と実行状態の正本であり、終了履歴が確定しただけでは削除しない。同じ記録の`historySettled`が履歴の保存確認又は既存の保持期限処置の確定を表す。新規受付はfalse、閉鎖・履歴照合後だけtrueへ進み、trueからの巻戻し、要求Hashの変更、通常の再開と記録削除を拒否する。履歴候補生成はtrueの記録を除き、二回目の保守で同じ履歴を作り直さない。

結果・Leaseの清掃は従来今回確定した対象に限定する。保持したQueueが参照する結果は除去せず、未知・未解決・参照中の情報を成功や不要と読み替えない。過去に確定した対象まで清掃対象を広げる変更は今回含めない。

受付世代と`intakeBindings`は撤去した。保存直前のfreshなQueue ID・要求Hash・Project・Milestone照合は維持し、未知IDのresumeは拒否する。新規開始の初回受付だけが既存初期化を使用する。既存createQueueのscheduled処置は初回Project候補を任意に受け取り、既存Queueを先に照合して、新規の場合だけProject・Milestone・Revisionと初版generationを検査し、一回の候補保存へ結合する。既存Projectを上書きせず、同ID競合で敗者Projectを残さない。実行ID・終端記録を削除して再実行可能に戻さない。旧形式Reader・自動移行は追加しない。
## 5. 保存・初期化・回復

| 項目 | 現行契約 |
|---|---|
| 保存先 | Repository直下の`.crdd/domain-model/`。Package改名と保存Identityを連動変更しない |
| 正本と途中候補 | `state.json`／`history.jsonl`と`state.pending.json`／`history.pending.jsonl` |
| 排他 | 共通Lockの`.crdd/lock/execution-model.state.lock`。pendingは排他ではない |
| 保存値 | `ExecutionStateSnapshot`の19field明示定義が唯一の保存正本。Overview等は投影であり別保存しない |
| 確定 | 単一Writer、元版・Owner・実体・現在性のfresh照合、CAS、物理出版、読戻し、解放確認 |
| 失敗 | blocked／unknown、発行済みEffect・部分成功・Cleanup未確認・元回復参照を区別して保持 |

通常Readerはpending・未知File・旧marker残存を拒否する。明示再入場は元版／候補／回復ID／Owner／実体／履歴を照合し、未知物を自動確定・削除しない。rename済み・pendingなしのcurrentを読めても、前回Writer成功や耐久確定までは推定しない。

初期化は真正不存在、親実体の前後一致、排他的作成、空の新規領域を要求する。既存領域を新品にせず、旧固定coordinator領域の存在・観測不能を拒否する。新正本の通常読取りに旧領域探索を結合しない。旧形式Reader・自動移行・旧marker清掃・汎用一時Storeは提供しない。由来不明の過去残存物は保全し、別途の明示判断に委ねる。

領域確保失敗は`ExecutionStorageBlockedError`で、Effect不明・Cleanup・exact回復参照を保持する。一般Errorや未実施へ畳まない。JSONの解析・正規符号化・Hashは保存表現の契約であり、暗号化・復号化ではない。

### 保存証拠の寿命

| 証拠・入口 | 寿命と終了条件 |
|---|---|
| `settlements` | 一回の候補・元版・OwnerをContextへ結合し、消費後finallyで破棄 |
| `initializations` | exact初期領域・本文を後続出版まで保持。解放失敗・出版終了・失効条件で削除 |
| `historyAttempts` | 同じ生存Ownerの履歴試行・pending再入場を保持。各呼出しfinallyでは消さず弱参照Owner寿命に従う |
| `publishRecoveryState` | 四つの固定証拠用途、Context生成・初期化・一回保存・finally失効を一体化 |
| `publishStateOwned` | 取得済みOwnerのTask／定義保存。排他を再取得・解放しない |
| `resumeRepairRecordSave` | 固定保存物・pendingを再観測する完成再入場。Storageの実体をRootから直接提供 |

短命MapはProcess再起動後の正本やfresh照合の代替ではない。Writerと寿命を分断するためだけのFile分割・Manager・転送Wrapperを作らない。

### 保持設定

保持日数を消費する履歴分岐だけ、上位から日数を受け、既存revalidateで現在設定と期待日数の一致を確認する。通常の引数なし再検証・非履歴Queryに設定読取りを追加しない。設定不存在時の30日と明示30日は同じ扱いとし、新しい設定Hash・世代一致は要求しない。履歴確認前に必要な判断記録や未解決参照を退役させない。

<a id="verification"></a>
## 6. 検証の所有と確認範囲

| Owner | 確認内容 | 成功から推定しないもの |
|---|---|---|
| EM | 独立DTOによる保存codec・全field・遷移・凍結・参照分離、全State／History整合、Writer／Reader／Lock／CAS | DI技術処置・資源不存在 |
| DI | 独立DTOによる技術codec、Machine通知・Session・再開・廃棄条件 | EM保存受理・保存成功 |
| Coordinator | 実DI通知からEM Rootの完成保存・読戻しへの接続、回復IDの三成分保持 | 実Docker／Provider成功 |
| 各Package | 自身のRootの独立ロード、外部依存境界 | ロードだけによる保存・実Effect成功 |

修復の値試験は両Ownerで同じ入力母集団を独立した期待値へ照合し、一方のdecoderを他方のOracleにしない。2,799入力のprofile・field path・変異を固定し、入力の種類・getter／Proxy未評価・不変性を保持する。連携の保存成功はCoが確認し、技術値の受理と保存確定を区別する。

保存Source試験は同じProcessでSourceを編集しない前提でLeaseを含む固定11Sourceの読取り・型除去・宣言抽出と同署名の未束縛factoryだけを共有する。Map・Owner・State・故障注入・保存領域は各ケース独立とし、Source変異は毎回compileして通常factoryと混ぜない。

Runtime import graphは実行時参照と型のみ参照を分けて確認する。公開集合・各利用側・局所検査の独立ロードと併せて判定し、循環なしだけから設計全体の完成を推定しない。

正式な検証義務は[QA-000006](../../../07_Quality/Definitions/QA-000006/quality_definition.md)と試験台帳、今回の範囲・失敗是正・限定結果・独立レビューは[CHG-000082](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)を参照する。全体回帰・実AI・実Docker・過去保持物の操作は今回実施しない。

旧構造からの移管経緯・過去時点の公開数・段階別検証は同変更記録へ分離する。保存領域の詳細は[保存配置](03_Repository_Storage.md)、過去の移管設計は[API・単一保存の比較基準](05_Runtime_Domain.md)を参照し、現行のLogical Block・公開境界は本書を正本とする。

<a id="ui-spec-detail-placement"></a>
## 上流UI／SPEC Detailの局所分担

[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)のARCH-000008について、境界診断に関係するOperation・資源観測・回復の記録と、その同版相関・遷移・保存を担当する。

担当Interaction Relation: `PRT-000005.spec-000009`

観測は上位が技術実行結果からEM所有の保存契約へ投影する。EMは新しいProbe・Docker操作を発行せず、故障原因や利用可能範囲の最終分類、認証・認可、修復の実行判断を所有しない。未観測・Process終了不明・Cleanup未確認を成功や不存在へ変換しない。保存の成立は診断・技術Effect・回復許可の成立ではない。

この分担は旧Domain Modelの記録責務の移管先を明示するもので、CM／DMへの直接依存、新しい診断API、独自の技術資源照合を追加しない。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `execution-model.package-boundary` | Interface／State／Failure | 公開93項目・独立ロード・モデル間依存0 | 既存の完成操作・Owner・結果相関を保持 | 内部補助の公開、上位Consumer知識、逆依存 | UT | N/A | RCM-UT-014の入力・結果・現在値と必要な終了確認 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `execution-model.execution-state` | Interface／State／Failure | Task・Attempt・Blocker・Leaseと全Stateの相関 | 既存の完成操作・Owner・結果相関を保持 | 不正遷移・資源未確認の成功化・古い世代 | UT／IT | Direct Boundary | PRL-UT-006／ERB-IT-014の入力・結果・現在値と必要な終了確認 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `execution-model.state-publication` | Interface／State／Failure | Lock・CAS・pending・保存証拠の寿命 | 既存の完成操作・Owner・結果相関を保持 | 途中保存・別世代証拠・未知残存・終了不明 | IT | Direct Boundary | RDL-IT-001は配置、PRL-IT-013はState I/O・失効、ERB-IT-014はpending・出版不明・同ID再入場。PRL-IT-012の上位Transportとは分ける | 元版・同対象・一次失敗と未解決義務を保持し、未知・途中出版は保全する | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |

## 現行実装との照合
上記導出キーは現在の責務と既存試験の接続であり、今回の試験実施結果ではない。実装・限定検証と変更経緯は[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。旧Domainの一括公開・共通Helper・結果の四状態を3モデルへ複製しない。配布launcherとReleaseの全Consumer閉包は上位Ownerの未完了義務として保持する。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
