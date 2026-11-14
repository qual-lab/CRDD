# 実行モデルの責務と単一保存契約

成果物種別: Architecture詳細設計
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

## 2. Logical BlockとSourceの所有

| Source | 責務 | 境界 |
|---|---|---|
| 各モデルの `types.ts` | モデル、要求・結果、閉じた値域 | 保存型の正本。上位要求・表示型を持たない |
| 各モデルの `validation.ts` | 局所構造・相関・遷移と受理候補の検査 | 未信頼入力とJSON解析済み値の検査を同一視しない |
| 各モデルの `operations.ts` | 保存しない意味計算、正規化、用途候補 | 値検査からCRUD・Storageへ戻らない |
| 各モデルの `crud.ts` | 完成したモデル操作、認可・現在値と保存接続 | 空Wrapperや第二Writerを作らない |
| `state/validation.ts` | 全Stateの解析・同版相関・改訂と候補結合 | 局所モデルの意味計算は各Ownerを使う |
| `storage/store.ts` | 固定保存所在、File読書き、初期化 | 履歴の意味やモデル遷移を再実装しない |
| `storage/lock.ts` | 保存排他とOwnerの取得・保持・解放 | 業務上の再入場判断を代行しない |
| `storage/publication.ts` | 単一Writer、CAS、出版・再入場、短命証拠 | Attempt／History CRUDへ実行時逆依存しない |

SourceはRootの`index.ts`、objective／task／attempt／decision／workspace／state／historyとstorageで構成する。operationsはobjective／task／attempt／history／stateにのみ置き、存在しない役割のためにFileを増やさない。

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

Rootは93項目（58値・35型）。完成した読取り・更新・終了・回復・履歴操作、独立した入力受付とモデル語彙を明示公開する。正確な集合は`src/index.ts`と固定期待値の公開契約試験で確認する。件数を目標にunknownや巨大Unionへ置換しない。

通常CRUDの`queryPlan`／`queryObjectives`／`queryTasks`／`queryQueue`と単件取得、同版複合取得の`readState`を区別する。`queryQueue`は現在の本番外部Consumerがなくても、採用済みの認証・対象限定付き通常一覧Capabilityとして維持する。他の92公開項目には本番の直接参照があるが、参照の存在だけを設計上の必要性の証明とはしない。

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
| `intake` | `intakeEpoch`。出版確認用Readerを使用し、未初期化は明示null |
| `queue` | `queueEntries`、`leaseIntents`、`intakeEpoch`を通常Readerの一回から取得 |
| `execution` | `projects`、`queueEntries`、`intakeEpoch`、`schemaRevision` |
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

保存Source試験は同じProcessでSourceを編集しない前提で固定10Sourceの読取り・型除去・宣言抽出と同署名の未束縛factoryだけを共有する。Map・Owner・State・故障注入・保存領域は各ケース独立とし、Source変異は毎回compileして通常factoryと混ぜない。

Runtime import graphは実行時参照と型のみ参照を分けて確認する。公開集合・各利用側・局所検査の独立ロードと併せて判定し、循環なしだけから設計全体の完成を推定しない。

正式な検証義務は[QA-000006](../../../07_Quality/Definitions/QA-000006/quality_definition.md)と試験台帳、今回の範囲・失敗是正・限定結果・独立レビューは[CHG-000082](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)を参照する。全体回帰・実AI・実Docker・過去保持物の操作は今回実施しない。

旧構造からの移管経緯・過去時点の公開数・段階別検証は同変更記録へ分離する。保存領域の詳細は[保存配置](03_Repository_Storage.md)、過去の移管設計は[API・単一保存の比較基準](05_Runtime_Domain.md)を参照し、現行のLogical Block・公開境界は本書を正本とする。
