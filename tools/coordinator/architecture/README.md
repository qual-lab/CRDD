# Coordinator Reference Runtime Architecture

Status: Implementation Candidate

## 1. 文書責務

本書は、エージェント組織（Agent Organization）を実証するCoordinator Reference Runtimeの実行Architecture正本である。Runtime固有の実行シーケンス、状態、資源所有、Lock順序、回復および結果公開条件を所有する。

上位概念、費用原則、独立レビュー、決定権限および人間との境界は[`04_Agent_Organization.md`](../../../04_Agent_Organization.md)を正本とする。構築、利用、コマンドおよび運用案内は[`tools/coordinator/README.md`](../README.md)、実装は[`src`](../src)、検証は[`tests`](../tests)を参照する。本書はCRDD全体または別Runtimeへこの実装方式を要求しない。

機械可読な接続投影は[`coordinator-runtime-traceability.json`](../runtime/coordinator-runtime-traceability.json)を用いる。JSONは本書の意味を置き換えず、宣言した状態、資源、遷移、不変条件および検証接続の孤立・欠落を検出するための投影である。

## 2. 公開実行境界

現在の実行可能な中心経路は、正式署名配布物から開始するLocal Personal一般Taskである。

開発反復とRelease Trustは別の検証境界とする。Source変更ごとの通常確認は、固定Fake、実Filesystem／子Processを含む契約・結合試験、および公開Runner契約を同じProcess構成で検査する`development-e2e:verify`へ閉じ、Release鍵、passphrase、実Provider送信または正式Release Authorityを使用しない。正式署名4経路E2Eは、機械確認が通った候補Revisionを凍結してから一度だけ実施するRelease Candidate Gateであり、失敗するたびSource修正と再署名を交互に行う開発loopではない。契約試験の成功を署名配布物、実Provider、実OS対話境界またはRelease成立へ昇格させない。

```text
Human / Front Agent
  ↓ bounded task request
Coordinator Task Runtime
  ↓ selected Executor
Provider Adapter / Docker Process Controller
  ↓ isolated local Candidate
Independent Reviewer
  ↓ approved exact Candidate
Coordinator cleanup / Result integration
  ↓
Human
```

Executorは通常`auto`で選定する。人間または上位Coordinatorが公開Task要求の`requestedExecutorProvider`を明示した場合は、同じExecution SlateとSelection Gateがその制約を検証し、不成立時に暗黙fallbackしない。正式検証用Runnerも別の選定経路を持たず、この公開境界を使用する。

事前選定で得たProviderを人間の指定へ変換しない。実行段階の選定にも元の`auto`／明示制約を渡し、選定理由の由来を保持する。選定結果は事前に許可対象としたProviderと照合し、不一致なら未消費のSelectionを失効させ、当該段階のHome観測・Mount Grant・Provider起動前に停止する。実装、独立レビュー、一回是正、その再レビューへ同じ照合を適用する。同一Providerによる独立レビューは、事前選定が許可した別実行Contextの明示制約を保持し、人間によるExecutor指定とは区別して説明する。正常な自動／明示選定と各段階の不一致停止は`coordinator-task-runtime.contract.test.ts`、同一Providerの理由と独立性条件は`delegation-route-selection.contract.test.ts`へ接続する。

Provider同士を直接spawnさせない。Provider出力、Runtime内部Path、Credentialおよび未検証Candidateを結果へ直接公開しない。Canonical Repositoryへのcommit、push、merge、tag、Releaseまたは公開Effectを許可しない。

一般Taskの外部送信許可が成立したら、Workspace作成とProvider起動の前に、初回確認か既存許可の再利用かを標準エラーへ一回だけ表示する。表示は質問ではなく、同じ許可を再確認しない。固定文、許可対象として選定したProvider、検証した許可方式だけを出し、Task本文、読取り文書、Path、Credentialまたは許可Capabilityは出さない。許可方式の欠落・未知値を再利用へ補正せず停止する。表示関数が失敗を返す／例外となる場合、または表示中に取消された場合も後続Workspace・Provider Effectを発生させず、既存Operation cleanupへ戻す。標準エラーへの書込み受理は人間が画面を見た証明ではなく、この表示自体も送信Authorityや実送信完了の証明ではない。`coordinator-task-runtime.contract.test.ts`で初回・再利用の結果伝播、不明値、許可拒否、表示失敗・例外、取消と後続Effect 0を検証する。許可範囲の照合と初回対話は既存の`external-send-grant-runtime`が所有し、表示層では変更しない。

Candidate管理、Docker Task明示RecoveryおよびWindows Docker Desktop最終復旧は別の公開Lifecycleである。`activate`、`disable`および`provision`の未実装Effect前停止を一般Taskの成立経路へ混入させない。

<a id="development-provider-measurement"></a>

### 開発版による限定実測

更新実装の実Provider比較は、通常の署名不要な開発E2Eとも、正式署名配布物の検証とも区別する。人間が固定開発版を実行元として明示承認した場合だけ、既存Subscriptionによる限定実測へ接続する設計とする。正式署名済みという結果へ読み替えず、通常CLIの署名要件、秘密保護、外部送信、隔離、取消および復旧は維持する。

現在は、[実測範囲・回数の制約](../src/security/development-measurement-constraints.ts)と[契約試験](../tests/development-measurement-constraints.contract.test.ts)を実装した段階である。実Provider入口、実行元の検証、既存Authorityおよびcleanupへの接続は未完了であり、このmoduleだけでは実行できない。`productionAuthorityConferred: false`を返し、入力された承認・Identity・時計の真偽を検証したとは主張しない。

限定実測の所有者は、承認したRepository、固定Commit／Tree・package Hash、検証済みnative配布のIdentity、Taskの読取り・変更投影と経路、期限を正規化して一つの`bindingSha256`へ結合する。各`scopeSha256`はTaskと経路を含む完全な実測範囲のdigestとする。この正規化と実体再観測は後続のRuntime接続側の責務であり、Caller／Providerの自己申告Hashでは代替しない。純粋制約が扱うのは一致と計数だけである。

| 制約段階 | 保持する条件 | 検証する失敗例 |
|---|---|---|
| 初期化 | 相互に逆のProvider経路2Task、異なる範囲digest、有効期間は最大1時間 | 不正shape、追加key、Task重複、同一Provider、期限超過を拒否 |
| Task予約 | 許可された各Taskを一回だけ、同時に一件 | 許可外、再実行、並行Taskを拒否 |
| 呼出し予約 | Taskごと最大4、全体最大8。準備失敗でも枠を戻さない | 並行呼出し、枠超過、Task／役割／Provider不一致を拒否 |
| 起動直前の消費 | 同じ呼出しtokenを一回だけ消費し、期限・取消・Identityを再照合 | 準備待機中の失効、token複製、再利用、時計巻戻りを拒否 |
| 終了記録 | 既発行tokenの終了だけを記録。失効後も記録できる | 二重終了を拒否。cleanup不明後に新しいTaskを始めない |

8回はProvider CLIの呼出し数であり、CLI内部のモデルturnやAPI request数ではない。Executor、Reviewer、是正、再レビューの順序は既存Task Runtimeが所有し、この制約moduleで再実装しない。外部時計からの期限と単調時計による経過時間のどちらかが上限に達したら失効し、元の観測値へ戻しても再有効化しない。tokenはprocess内の参照Identityだけで扱い、永続化・再開・自動枠補充を行わない。

終了記録は資源回収の実行許可または成功証明ではない。Runtime接続では、期限切れ・取消後も既存のexact資源を回収できる経路を保持し、新しいRoot初期化、Mount、Authority、Provider開始またはCandidate公開とは分ける。実装・nativeのIdentity不一致では改変後の実行を正当化せず、既存EvidenceとRecovery IDを保持して移送する。既存Candidate全体の起動時GC、Docker Desktop修復、別processによる実測再開はこの比較許可に含めない。

接続完了前に、Task受付、Local Authority、Home／Runtime State／Candidate Store観測、Docker準備と`start_provider_attached`直前、Candidate公開、終了後観測まで同じ限定対象が伝播することを結合試験で確認する。旧native sourceとの差分がないことだけで、実binaryのIdentity、別Root利用、耐久記録の復旧互換性を確認済みとしない。

### 2.1 Filesystem保存境界

Coordinatorは、論理的なRepository Bindingと物理的な書込みRootを分離する。現在のリポジトリを対象にしたOperationでは、明示的な別Authorityがない限り、Repository外へstaging、worktree、archive、log、probeまたは試験一時物を作らない。読み取れるPath、同じ親Directory、同じLocal Userまたはcaller supplied absolute Pathは書込みAuthorityにならない。

保存先は次の三層へ分ける。

| 層 | 用途 | 境界 |
|---|---|---|
| Repository-local `.crdd` | Git管理するRepository Policy／Bindingと、用途別に分離したローカルRuntime補助 | Policy等の正本と未追跡Runtime状態を別subtreeにし、後者をCandidate Revision、Provider mountおよびGit管理対象から除外する |
| OS管理Runtime Root | selected-user Provider Home、Candidate Store、Recovery、Host／Runtime State | OS Known Folderまたはservice管理Rootから導出し、主体、保護、安定Identityおよび用途をRuntimeが検証する |
| Operation Root | 一回のOperationが所有するworkspace、staging、temp、logおよびcleanup記録 | 一つのProject BindingとOperation IDへ結合し、成功、失敗、取消および親Process喪失で回収またはexact Recoveryへ移送する |

Repository-localのcanonical namespaceは`<verified-repository-root>/.crdd/`とする。公開CLIと署名E2E入口は、起動Directoryから最寄りの有効なGit worktree Rootを上方解決し、構造とIdentityを検証してからProjectへBindingする。Current Working DirectoryそのものはRepository Authorityではない。途中に存在する`.git`境界が不正または検証不能なら外側のRepositoryへ読み替えずEffect 0で停止する。これにより`tools/coordinator/.crdd`のようなpackage-local複製を許可しない。外部送信PolicyはGit管理する`.crdd/external-send-policy.json`に置く。現行の`<repository>/.crdd-runtime/`候補はローカルRuntime補助の既存実装名であり、将来の`.crdd/runtime/`集約形へ無言で併存させない。移行する場合は、単一のcanonical location、旧位置の検出、競合時停止、Candidate／mount除外、cleanupおよび移行後残存0を一つの変更として固定する。現時点でRepository外overrideを承認するRuntime Capabilityは未実装なので、Path Identity入口とGit local exclude入口はいずれもEffect前に`runtime_root_external_write_authorization_required`で停止する。

将来のMCP／Linux常設／複数Repository構成でも、MCP Serverが任意Pathを直接選ばない。Repository Routerが事前登録された論理Repository IdentityをProject RuntimeへBindingし、OS管理Runtime Rootの`Project Binding × Operation ID`名前空間へ写像する。同じOrganization Runtime上の別Projectは、保存Root、Authority、Provider Home lease、Recoveryおよびcleanupを共有しない。機構はRuntime 1.0の完成条件へ追加せず、Dogfoodingで境界の安定性が確認された後の根拠駆動リファクタリングとして扱う。

## 3. 主実行シーケンス

| 段階 | 状態ID | 主な処置 | 次へ進む条件 |
|---|---|---|---|
| 受付 | `STATE-ADMISSION` | Package、Process poison、Task byte、Repository形式を確認 | 全preflight成立 |
| Operation取得中 | `STATE-OPERATION-ACQUIRING` | cleanなDocker Recovery inventoryを確認後、Operation RootとHost generationの取得を開始 | 取得成功、cleanup確認済み停止、exact Recovery保持、またはIDなしoperator移送 |
| Operation準備 | `STATE-OPERATION-READY` | Operation Root、Host generation、Repository／Revisionを固定 | Host Supervisor readyと同一generation再確認 |
| 実行許可 | `STATE-TASK-AUTHORIZED` | Policy、Slate、Candidate Store、External Send Grant、Workspaceを確定 | Authority、Revision、Scopeが一致 |
| Executor完了 | `STATE-EXECUTOR-CLEAN` | Provider Home、Mount Grant、Task Packet、Docker Recovery、Executor、cleanupを実行 | Docker不存在、mount完了、finalizable handoff |
| Candidate固定 | `STATE-CANDIDATE-CAPTURED` | 実差分、許可Path、開始RevisionからCandidateを固定 | Executor申告と実差分一致 |
| Reviewer完了 | `STATE-REVIEWER-CLEAN` | 独立ContextでReviewerを実行しcleanup | approvedまたは一回是正へ限定 |
| 是正許可 | `STATE-REMEDIATION-AUTHORIZED` | 同じExecutorへ`severity`、`path`、閉集合`category`、受入条件の`criterionNumber`および自由文Hashだけを返す | 自由文命令を転送せず、一回だけ再実行して同じReviewerへ戻る |
| 是正Executor完了 | `STATE-REMEDIATION-EXECUTOR-CLEAN` | 一回限りの同一Executor是正とStage cleanup | 再Candidateを固定 |
| 是正Candidate固定 | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | 是正後の実差分からCandidateを固定 | 同じReviewerへ一回だけ返す |
| 是正Reviewer完了 | `STATE-REMEDIATION-REVIEWER-CLEAN` | 同じ独立Reviewerが是正後Candidateを再評価 | 承認時だけ保存。再是正へ戻らない |
| Candidate保存 | `STATE-CANDIDATE-STAGED` | 再照合したCandidateを一時Storeへstaged保存 | exact Recovery ID取得 |
| Host回収 | `STATE-HOST-CLEAN` | 全Docker Host-cleanup intent、Operation cleanup、receipt、finalize | Host／Docker未解決0 |
| 結果公開 | `STATE-RESULT-PUBLISHED` | Candidateをpublishし安全な構造化結果を返す | cleanupとCandidate再検証済み |
| 安全な停止 | `STATE-BLOCKED-CLEAN` | Resultを公開せず、所有資源不存在とRecovery不要を確認 | Operation終了 |
| Process再起動待ち | `STATE-PROCESS-RESTART-REQUIRED` | Operation資源のcleanupは確認済みだが、取消protocol違反または別Operation由来の観測等で現在Processだけが不可逆poison | 当該Operationは終了。公開済み結果／Candidateは保持し、新しいProcessから別Taskを開始 |
| 回復待ち | `STATE-RECOVERY-REQUIRED` | exact Recovery IDとEvidenceを保持して停止 | 明示Recoveryの成立 |
| Operator移送待ち | `STATE-OPERATOR-TRANSFER-REQUIRED` | cleanup不明だが認証済みのactionable Recovery IDを取得できず停止 | 自動再試行せず、Evidenceを保持して運用者へ移送 |
| 回復完了 | `STATE-RECOVERED` | 所有資源不存在と耐久Evidence残存0を確認 | 新しいOperationから再評価 |

`invocationTerminal`は現在のCLI／Task呼出しが終了すること、`operationTerminal`は当該Operationに後続処置が残らないことを表す。`STATE-PROCESS-RESTART-REQUIRED`はProcess scopeのterminalであり、当該Operationのcleanupは確認済みなのでOperation Recoveryへ接続せず現在Processだけを廃棄する。Process poisonは当該Operationの取消protocol違反に限らず、同じProcess内の別Operation由来でもよい。`STATE-HOST-CLEAN`まで成功してCandidateを公開できた場合は、成功結果とCandidateを保持したまま再起動を要求する。`STATE-RECOVERY-REQUIRED`は現在の呼出しではterminalだがOperationとしては未完了であり、別の明示Recovery invocationだけが`STATE-RECOVERED`へ進める。`STATE-OPERATOR-TRANSFER-REQUIRED`も呼出しではterminalかつOperationは未完了だが、exact Recovery Authorityを持たないためRecovery遷移へ推測接続せず、運用者へのEvidence移送だけを表す。

## 4. 資源所有

| 資源ID | 資源 | 所有者 | 所有期間 | 終了後条件 |
|---|---|---|---|---|
| `RES-HOST-GENERATION` | Host Operation Rootとgeneration | Task Runtime＋Supervisor Process | Operation作成からHost cleanupまで | Supervisor release確認、Root不存在またはexact Recovery保持 |
| `RES-LOGICAL-HOME-LOCK` | logical Provider Home kernel lock | Docker Recovery Runtime | 各Executor／Reviewer Stageまたは明示Recoveryのmutation区間 | Stageごとにrelease確認。不明時だけRecovery責務へ移送 |
| `RES-RUNTIME-STATE-LOCK` | Runtime State global kernel lock | inventory／mutation実行者 | 短い再観測・更新区間 | release確認 |
| `RES-INTERACTIVE-CONSOLE` | console lock、reader、handle | External Send同意Lifecycle | 初期同意の表示から入力・取消・reader終了まで | handle／reader／lock回収確認 |
| `RES-MOUNT-GRANT` | Provider Home Mount Grant／active mount | Mount Grant Runtime | StageのissueからDocker cleanupまで | completeまたはRecoveryへ移譲 |
| `RES-DOCKER-OWNED` | container、network、Docker CLI child | Docker Process Controller | submissionからexact不存在確認まで | IDとnameの不存在確認 |
| `RES-OPERATION-WORKSPACE` | 隔離WorkspaceとOperation Directory | Repository／Task Runtime | materializeからHost cleanupまで | Root不存在またはHost Recovery保持 |
| `RES-CANDIDATE-ENTRY` | staged／published Candidate | Candidate Store | Reviewer承認後から期限、exportまたはdiscardまで | entry不存在またはStore Recovery保持 |
| `RES-TASK-CONTROL` | Task control、Docker handoff、cancel state | Task Runtime process | startからcompletion最終settlementまで | control失効、durable Recoveryへ必要情報移譲 |
| `RES-CLI-SIGNAL-BINDING` | SIGINT／SIGTERM listener | CLI | Task startedからcompletion後unbindまで | listener解除確認 |

上表は公開CLIを含むArchitecture上の10資源を示す。現在の機械可読Task Traceが直接観測するのは`RES-CLI-SIGNAL-BINDING`を除く9資源である。CLI signal bindingは公開CLI縦結合が成立した時点で`public_cli`境界として追加し、Task Runtime fixtureから観測済みとみなさない。

同一Host Operation内でExecutor、Reviewerおよび一回限りの是正が同じlogical Provider Homeを使う場合、`RES-LOGICAL-HOME-LOCK`、`RES-MOUNT-GRANT`およびactive pointerはStageごとに取得・終了する。次Stageは前Stageのlock、lease、pointerおよびDocker所有資源の不存在を確認した後だけ、新しいRecovery IDで同じHomeを直列に取得できる。前Stageのfinalizableな耐久回復記録は共通Host cleanupまでEvidenceとして残り、Host cleanup後に各receiptと記録を最終化する。Providerの業務結果が成功、清掃済み失敗または取消のいずれでも、下位cleanupが成立し、正しいfinalization capabilityを返したhandoffは同じ`finalizable`状態へ合流する。業務失敗理由は保持するが、耐久記録を消す前に`finalized`へ飛ばさない。capability、Recovery IDまたはcleanupが不明なら手動Recoveryへ閉じる。したがって、耐久記録が複数存在すること自体を同時利用とはみなさない一方、active pointer、lockまたはDocker所有資源の重複は引き続き拒否する。

Host Operation Rootの初期化は、Root生成前に`state=initializing`、選定済みnonceおよびroot名を耐久Host Recovery recordへ確定してから行う。Root生成前にProcessが失われた場合は、同じrecordからRoot不存在を確認してmarkerを回収できる。Root生成後かつFilesystem Identity確定前にProcessが失われた場合は、所有Identityを推測して削除せず、exact recordとRootを保持して手動Recoveryへ移送する。Recovery IDは、当該呼出しが捕捉した旧markerのFilesystem Identity＋bytes、または当該writeのtemporary handleから確定したsuccessor Identity＋bytesのいずれかと現在markerが一致し、exact schema、Root名および実bytesのHashを安定再読取りできた場合だけ返す。内容が同じでも無関係なIdentityへ置換されたrecordを再信頼しない。耐久recordがまだ成立していない、部分的である、捕捉済みlineageに属さない、または観測が一意でない場合は、推測したIDを返さずIDなしのoperator transferへ閉じる。Root、marker、一時領域およびRecovery recordの全てについてIdentityと終了後条件を確認できた場合だけ`host_only`以降へ進み、Task成功またはclean blockedへ昇格する。

Docker Recovery開始成功形は、exact `status=ready`、Recovery ID、stable logical Home binding、management bindingおよびRuntime発行のopaque Capabilityを一つのbindingとしてEffect前に再検証する。不正成功形を破棄するときのRecovery abandonとMount settlementは、後続Docker／Provider Effectを止めAuthority／Leaseを返すbest-effort処置であり、既に作成したdurable Recovery record、pointerまたはactive bindingのcleanupを証明しない。したがって後続Docker／Provider Effect 0を維持しつつdurable recordを保持し、構文上正しいexact IDは手動Recoveryへ移す。ID自体が不正または観測不能ならIDなしのoperator transferへ閉じる。開始処理がexact Recovery IDを伴うclean blocked結果を返した場合は、Recovery ID内のstable logical Home bindingが現在planと一致する場合だけ、その下位理由を保った回復待ちとして公開する。foreign HomeのIDは成功形と同じidentity不一致へ閉じる。Task境界では下位cleanupの成否、`manualRecoveryRequired`およびexact Recovery IDを独立に観測し、下位cleanup済みでも後二者のいずれかが残ればHost RootとIDを保持する。Recovery inventoryのactive Home hashは全Recovery IDの集合ではなくactive pointerを持つHomeの部分集合であり、inactive／cleanup中の正当なIDを欠落させる根拠にしない。

## 5. Lock順序と解放窓

通常TaskとHost状態を扱う明示Recoveryは、次の順序を守る。

```text
RES-HOST-GENERATION
  → RES-LOGICAL-HOME-LOCK
    → RES-RUNTIME-STATE-LOCK
```

Host Effect不存在をfresh Evidenceから確認済みのcleanup-only Recoveryだけは、`RES-LOGICAL-HOME-LOCK → RES-RUNTIME-STATE-LOCK`で残骸を処置できる。

Runtime State lockを保持したまま、native observation、Docker CLIまたは長時間Host Effectを実行しない。Windows native resource境界で必要な場合はHost generationも一時解放する。Candidate Store、logical Provider HomeおよびRuntime Stateの同期named pipe lockは、release stateを最大5秒まで観測してから解放完了とし、時間内に観測できなければ解放済みと推定せず観測不能へ閉じる。これは固定sleepではなく、資源状態の待機上限である。Interactive Console lockとHost Operation Supervisorの別Process cleanup上限はこの変更で拡張しない。解放窓では新しいAuthorityを発行せず、再取得後かつ最初の後続Effect前に次を全て再確認する。

- Host Rootとnonce
- Runtime State Root IdentityとProtection
- selected-user／logical Home binding
- Filesystem Identity
- 対象Recovery ID、base、journalおよび全inventory

一つでも不一致、取得不能または解放不明なら`STATE-RECOVERY-REQUIRED`へ進み、成功を公開しない。

## 6. 耐久状態

耐久JSONはcontent fileとcommit sidecarのpairである。content確定とsidecar確定の間にProcessが終了できるため、次を別状態として扱う。

固定名のcontentを一時fileからatomic renameする際、同一file objectの連続性はexact serialized bytesと同一volume／file IDで確認する。WindowsではNTFSの同名file tunnelingにより、削除直後に同じ固定名を再作成するとrename前後の作成時刻が変わり得るため、作成時刻だけをrename連続性の必須条件にしない。commit sidecarはrename後の最終Identityを記録し、その後のread、cleanupおよびRecoveryでは作成時刻を含む最終Identity全体の一致を要求する。Windows以外ではrename前後の作成時刻も一致させる。

| 状態 | 分類 | 処置 |
|---|---|---|
| contentもcommitも不存在 | 未開始または処置済み | 周辺EvidenceとEffect発行履歴を確認 |
| content＋commitが完全一致 | committed | 通常遷移候補 |
| exact contentだけ存在 | `STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT` | Effect前でsuccessorが一意な利用側だけ、期待値・Host世代・Effect非発行・commit不存在を再確認して決定論的rollback。その他は回復待ち |
| commitだけ存在 | 異常 | Evidence保持、処置0 |
| content／commit不一致 | 異常 | Evidence保持、処置0 |
| replacement／link／unknown entry | 異常 | Evidence保持、処置0 |

Host Recoveryの`initializing` recordは、Root生成より前に耐久化する初期化intentである。Rootが不存在なら未発行Effectとしてmarkerを回収できる。Rootが存在してもrecordにIdentityがまだ確定していない場合は、名前やnonceの一致だけを所有証明にせず、Rootとrecordを保持して`STATE-RECOVERY-REQUIRED`へ進む。

Host側`active-docker-task-v1.json`のcontent-only状態は、同期的なcommit sidecar確定より前、かつHost generation Effectより前の到達可能中間状態である。Host明示Recoveryと通常Host cleanupは同じDocker閉包Gateを使用し、active bindingのcontentまたはcommit sidecarが存在する限りHost Rootを先に回収しない。Docker明示Recoveryは、同一Lock内でHostがprevious世代、全submission不存在、baseが完全一致し、committed pointerのschema／stable Home／operation name／Recovery ID／base hashが完全一致し、active bindingのschema／Recovery ID／base hash／operation nonceが完全一致し、active commit sidecarが不存在の場合だけ当該contentをrollbackする。旧版がHost Rootとmarkerを先に削除した実状態では、Host begin receiptと全submissionがなく、base、pointer、Runtime inventoryおよびactive binding不存在をexactに確認できる場合だけ、Docker不存在、Mount未成立、Host不在receiptを耐久化して収束する。pointer欠落・partial・置換、submission存在、Host Root／markerの片側だけの残存または観測不能では自動収束しない。通常完了、通常receipt replay、crash receipt replay、Effect前rollbackおよびfresh crash recoveryの全削除経路は、同じactive binding／pointer閉包を削除前に検証する。存在観測は`ENOENT`だけを不存在へ写像し、権限拒否、共有競合、I/O失敗、非fileまたはsymlinkを観測不能として扱う。削除後のactive binding、pointer、commit sidecar、complete receiptおよびHost inventoryも同じ規則で再観測し、観測不能ならanchorとEvidenceを保持したまま`STATE-RECOVERY-REQUIRED`を維持する。active bindingが存在するのにpointerが欠落・partial・置換、不一致または観測不能なら、どちらも削除しない。active bindingが既に不存在でexact committed pointerだけが残る非対称状態は、pointerの完全一致を確認して再開できる。

旧版のHost先行回収状態から最終化を再開する`host-precleanup-finalization-intent.json`は補助ログではなく、後続Recovery Effectを許可する耐久Authorityである。新規発行は、Host Root／marker不存在、全submission不存在、active binding不存在、exact committed pointer、Recovery ID、operation nonce、base hash、stable Home hashおよびinitial Host Recovery IDの完全一致を同じ取得世代で確認した後、pointer等を変更する前に限る。既存intentは同じ全fieldが一致する場合だけ、committedまたは既に不存在となったpointerからの再開に使える。発行前の拒否、pointer欠落・partial・置換、active残存、新しいsubmission、Host再出現または観測不能ではintentを書かず、失敗した呼出しから後続呼出しのAuthorityをmintしない。

旧版の不具合によってHost Rootとmarkerだけが先に回収済みで、exact Docker Recovery recordが残った状態は、新しい通常順序の成立証明には使わない。明示Docker Recoveryは、対象Host Rootとmarkerの双方が不存在であること、exact Docker identityと全Docker資源の不存在または回収、Mount settlement、Host active binding不存在およびpointerのexact releaseを順に確認し、Host absence receiptを記録してから当該Recovery recordだけを回収できる。一つでも観測不能または不一致ならEvidenceを保持し、Provider Effectや結果公開へ進まない。

## 7. cleanup依存順

```text
Provider child／Docker resource absence
  → RES-MOUNT-GRANT完了
  → Docker handoff finalizable
  → 全Stageのcleanup projection一致
  → Host cleanup intent
  → RES-OPERATION-WORKSPACE／RES-HOST-GENERATION回収
  → Host cleanup receipt
  → Docker Recovery finalize
  → RES-CANDIDATE-ENTRY publishまたはdiscard
  → STATE-RESULT-PUBLISHED
```

途中の一件が不明でも、後続の成功から前段の回収を推定しない。複数Stage、複数Docker handoff、CandidateおよびStore Recovery IDを件数で丸めず、現在も処置可能な全IDを保持する。

## 8. 不変条件

| 不変条件ID | 条件 |
|---|---|
| `INV-NO-PROVIDER-EFFECT-BEFORE-AUTHORITY` | Repository、Policy、Scope、Grant、RevisionおよびRecovery記録成立前にProvider Effectを発行しない |
| `INV-LOCK-ORDER-AND-REVALIDATION` | Lock順序を守り、解放窓後は同一identityと全inventoryを後続Effect前に再確認する |
| `INV-DURABLE-BEFORE-EFFECT` | 外部またはHost Effectの前に、再構成に必要なintent／submissionをcommit済みにする |
| `INV-STAGE-CLEAN-BEFORE-HANDOFF` | Executor／Reviewerの結果を次Stageへ渡す前に、そのStageのchildとDocker cleanupを確認する |
| `INV-CANDIDATE-EXACT-AND-NONCANONICAL` | Candidateは開始Revisionと許可Pathへ固定し、Canonical Repositoryへ直接適用しない。Runtimeが変更Path範囲を機械検証し、Git metadataを持たないReviewerはRead Projection上の内容・意味を独立検証する |
| `INV-HOST-CLEANUP-AFTER-DOCKER-CLOSURE` | Host cleanupはactive Docker binding Evidenceがある間は停止し、旧版のHost先行回収状態もexact Docker照合とbinding閉包の後だけ完了する |
| `INV-BOUNDED-REMEDIATION` | Reviewer findingはPath、重要度、閉集合Category、実在する受入条件参照および自由文Hashへ縮約し、一回だけ同じExecutorへ返して同じReviewerが再評価する。自由文本文は別Providerへ転送しない |
| `INV-RESULT-AFTER-CLEANUP` | Host、Docker、Mount、Candidateおよびsignal cleanup確認後だけ成功結果を公開する |
| `INV-CLEAN-BLOCK-HAS-NO-RECOVERY` | 安全なblockedは所有資源不存在かつactionable Recovery ID 0の場合だけ成立する |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | 状態またはcleanupが不明ならEvidenceと全actionable Recovery IDを保持して停止する |

Subscription認証の観測はProvider CLIの意味出力だけでなく、Docker CLIがattach時に使用する実streamまで含む。Codexでは成功文がContainerのstderrへ出る実装を許容するが、受理するのは成功文単独、またはread-only Homeに由来する既知のPATH alias警告とのexact組合せだけとし、stdoutだけの仮定、部分一致、未知行の無視へ縮退させない。

Provider Processが非ゼロ終了した場合も、自由文のstdout／stderrを利用者、別Providerまたは公開Resultへ転送しない。RuntimeはClaudeの単一・重複keyなしJSON Envelopeにある閉じた`subtype`から、Operation予算上限、turn上限およびStructured Output再試行枯渇を分類する。認証失効、Subscription上限、固定Invocation拒否、Network不成立およびProvider Service不成立は、Providerのbounded stderrに現れる既知の意味形だけを閉集合Reasonへ写す。Task本文を含み得る任意stdoutの部分一致、過長stderr、NULを含むstderrおよび未知出力は推測分類せず`provider_process_exit_nonzero`へ閉じ、cleanupとRecoveryの判定を終了理由の分類から独立させる。これにより運用上の再認証、待機、設定是正と、実装不具合の調査を区別できる一方、Provider自由文をAuthorityまたは情報公開へ昇格させない。

Provider Processが正常終了しても構造化Resultが契約へ適合しない場合は、入力、JSON、Claude Envelope、Executor shape、Reviewer shape、Reviewer findingおよびReviewer decision整合の閉じた理由へ分類する。Claude ReviewerはProvider内蔵の複合Schema再試行をTrust境界にせず、通常JSON Envelopeの`result`から単一JSON documentを取り出して同じCRDD所有Reviewer Validatorへ渡す。Code fence、自由文、複数document、重複keyまたは型差を補正せず、既知のturn上限とStructured Output再試行枯渇は正常終了コードでも専用理由へ閉じる。公開するのは固定理由識別子だけで、raw Provider出力、自由文、PathまたはCredentialを診断へ含めない。一回是正後の再Reviewは過去Findingの機械的な再掲ではなく現在Candidateを同じ受入条件から再評価し、解消済みFindingを残さない。Runtimeは矛盾したResultを成功へ補正せず、分類不能な形はFail Closedにする。

標準のSubscription-only Profileでは、Providerが報告する`total_cost_usd`を実課金額または課金Authorityとみなさず、有限かつ非負の利用量metadataとしてだけ検証する。一般Taskへ`--max-budget-usd`を暗黙適用しない。Subscription使用量は、Coordinatorが説明可能に選定したmodel／effort、effort別turn上限、Provider timeoutおよび出力上限で制御する。明示的な金額上限は、Provider／account、credential source、spend budgetおよびOperation Authorityを別に結合する将来のopt-in有料API Profileだけが所有できる。標準ProfileはAPI key、有料API fallback、追加購入または自動plan切替を引き続き許可しない。

## 9. 正常・準正常・異常

<a id="task-turn-budget"></a>

Claude一般Taskのturn上限は推論強度から独立させる。Task Packetを一度だけ消費したRuntimeが、検証済み配列から読取りPath数R、許可Path数W、受入条件数A、是正指摘数Fを導出する。実行計画の`planClaudeTaskTurnBudget`を単一実装とし、見積りを`2 + R + k*W + ceil(A/4) + ceil(F/4)`とする。kはExecutorで2、Reviewerで1。見積りが16を超えた場合は切り詰めず分割要求とし、成立範囲ではExecutorの最低枠8、Reviewerの最低枠4との大きい方を上限にする。RとWは1〜64、Aは1〜16、Fは0〜64の整数だけを受理する。欠落、余剰field、不正値、getterまたはProxyを旧固定値へ補正しない。

これらは宣言した範囲数に基づく有限の見積りであり、Directory配下の実ファイル数、byte数、実際のtool call数または完了予測ではない。係数の有用性は実務の完了時間・上限停止・利用量から再評価する。高推論化、無制限再試行または許可範囲拡大の理由にしない。

同じ作業量を起動argvの再構成と結果Envelopeの検証へ渡し、選定した上限を超えるProvider報告を拒否する。Docker実行計画のIdentityへ作業量も結合し、同じ上限になる別の作業量への差替えも拒否する。分割要求はProvider Authority発行・子Process起動前に停止し、既に有効化したMount leaseは返却して既存cleanupへ接続する。全Filesystem Effectが0とは主張しない。公開Taskは`coordinator_task_workload_split_required`を返し、一般的な起動失敗へ潰さない。

Packet由来の件数は`provider-task-packet-runtime.contract.test.ts`、実argvとMount回収・Authority非発行は`claude-docker-runtime-adapter.contract.test.ts`、差替え拒否は`docker-effect-runtime.contract.test.ts`、推論強度別の同一上限・境界超過は`provider-task-structured-result.contract.test.ts`、公開停止理由と再試行なしは`coordinator-task-runtime.contract.test.ts`で確認する。Boolean Probe、Codex、timeout、権限、外部送信およびcleanup契約は変更しない。

| 区分 | 代表条件 | 期待結果 |
|---|---|---|
| 正常 | 4経路、承認、必要なら一回是正、全cleanup | Candidate公開、Recovery ID 0、残存資源0 |
| 準正常 | 明示拒否、Provider timeout／nonzero／結果不正、duplicate cancel、Lock競合、Effect前の一意なpartial pair | 安全なblockedまたは決定論的回復。未知状態へ誤昇格しない |
| 異常 | lock解放不明、generation置換、pair不一致、create結果曖昧、親Process消失、cleanup不明、複数Recovery競合 | Result非公開、Evidence保持、exact Recoveryまたはoperator移送 |

正式署名Runnerは`INV-BOUNDED-REMEDIATION`と同じ成功母集団を使用する。是正0回だけでなく、Runtime所有の一回限り是正後に同じ独立Reviewerが`approved`かつfinding 0を返した経路も成功候補である。`remediationPerformed`は厳密なboolean履歴として公開し、欠落・型差、二回目の是正、最終未承認、Candidate不一致、cleanup不明またはCanonical Repository Effectを成功へ昇格しない。

4経路の正式E2Eは、署名Releaseに追跡した既知のBASE markerをCandidate内だけで`BASE`から`OK`へ置換する。同じ基準byteを全経路で使用し、Executorの自由な新規file整形を経路成立条件へ混ぜない。Reviewerは既存内容と限定置換の意味をRead Projectionで確認し、Runnerは改変後のexact UTF-8 byte長、SHA-256、末尾LF、Candidate Identity、許可PathおよびCanonical Repository Effect 0を独立検証する。Reviewerの可視表示だけからbyte同一性を推定しない。

各高リスク遷移は、その遷移に実際に適用可能な正常・準正常・異常区分だけを機械可読Traceへ宣言する。各検証ケースは一意なcase ID、単一開始状態、遷移を実際に通ったか、実終了状態、Provider／Host／cleanup別のEffect観測数、結果状態および観測した資源の後条件を持つ。Task fixtureの資源後条件は実際のproducer／consumer receiptから構成し、Task controlはcompletion後の公開取消が`coordinator_task_control_invalid`かつ追加Effect 0となった観測、Interactive Consoleは同意Lifecycleのcleanup結果から構成する。状態名だけから不存在を推定しない。Checkerは遷移×単一開始状態×区分の一意性、実遷移時の終了状態、case IDの試験source接続および資源後条件がその試験の観測資源に含まれることを照合する。複数開始状態を一ケースへ束ねること、成功遷移を失敗例で通過済みとみなすこと、総Effect件数だけで種類を曖昧にすること、test名の存在だけ、非該当区分の形式的な水増し、試験件数またはcoverage率だけを状態母集団の網羅根拠にしない。

遷移の`resourcesAcquired`／`resourcesReleased`／`resourcesTransferred`は、その遷移が所有状態を変更する資源を示す。検証caseの`resourcePostconditions`は呼出し終了後の閉包を確認するため、当該遷移で変化せず不在のままだった資源も含められる。Checkerは全資源ID、観測bindingおよび少なくとも一つのcaseでの実使用を照合するが、終了後不在の観測を「その遷移が解放した」という虚偽のdeltaへ変換しない。

Effect観測数はOperation全体の累積値ではなく、各遷移の開始snapshotから終了snapshotまでの差分（transition delta）である。Task Runtimeは内部状態を単調に進め、Task controlを失効した後に`STATE-RESULT-PUBLISHED`、`STATE-BLOCKED-CLEAN`、`STATE-PROCESS-RESTART-REQUIRED`、`STATE-RECOVERY-REQUIRED`または`STATE-OPERATOR-TRANSFER-REQUIRED`を観測へ渡す。試験専用observerはAuthorityや制御を持たず、例外を投げてもRuntime状態、Effectまたは結果を変えない。検証はcase ID文字列の存在ではなく、Canonical caseの全fieldと実観測objectの完全一致を要求する。契約投影だけを検査する試験を、実Filesystem／Process観測へ昇格させない。例えば`tests/signed-recovery-matrix-verification.contract.test.ts`の説明契約・引数拒否の確認と、`scripts/verify-signed-recovery-matrix.ts`の署名済み実行入口を区別する。後者の`verifyParentLossThenRecover`は実子Processの終了とfresh recoveryを確認するが、対象は固定検証Workerであり、実Providerの親Process喪失へ保証を拡張しない。試験名や固定Workerの使用だけで観測範囲を決めず、対象の改訂版、実行入口、観測対象と結果に結合して判定する。

## 10. 遷移一覧

| 遷移ID | From | To | 主な意味 |
|---|---|---|---|
| `TRANS-ADMISSION-TO-OPERATION-ACQUIRING` | `STATE-ADMISSION` | `STATE-OPERATION-ACQUIRING` | Effect前preflight完了とOperation取得開始 |
| `TRANS-OPERATION-ACQUIRING-TO-READY` | `STATE-OPERATION-ACQUIRING` | `STATE-OPERATION-READY` | Host generation取得とready確認 |
| `TRANS-OPERATION-TO-AUTHORIZED` | `STATE-OPERATION-READY` | `STATE-TASK-AUTHORIZED` | Policy、Slate、同意、Workspace確立 |
| `TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN` | `STATE-TASK-AUTHORIZED` | `STATE-EXECUTOR-CLEAN` | Executor StageとStage cleanup |
| `TRANS-EXECUTOR-TO-CANDIDATE` | `STATE-EXECUTOR-CLEAN` | `STATE-CANDIDATE-CAPTURED` | 実差分からCandidate固定 |
| `TRANS-CANDIDATE-TO-REVIEWER-CLEAN` | `STATE-CANDIDATE-CAPTURED` | `STATE-REVIEWER-CLEAN` | 独立ReviewerとStage cleanup |
| `TRANS-REVIEWER-TO-REMEDIATION` | `STATE-REVIEWER-CLEAN` | `STATE-REMEDIATION-AUTHORIZED` | bounded findingを同じExecutorへ一回だけ返す |
| `TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN` | `STATE-REMEDIATION-AUTHORIZED` | `STATE-REMEDIATION-EXECUTOR-CLEAN` | 一回限りの是正ExecutorとStage cleanup |
| `TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE` | `STATE-REMEDIATION-EXECUTOR-CLEAN` | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | 是正後Candidate固定 |
| `TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN` | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | `STATE-REMEDIATION-REVIEWER-CLEAN` | 同じReviewerによる一回限りの再評価 |
| `TRANS-REVIEWER-TO-STAGED` | `STATE-REVIEWER-CLEAN` | `STATE-CANDIDATE-STAGED` | 承認Candidateの一時保存 |
| `TRANS-REMEDIATION-REVIEWER-TO-STAGED` | `STATE-REMEDIATION-REVIEWER-CLEAN` | `STATE-CANDIDATE-STAGED` | 是正後に承認されたCandidateの一時保存。再是正経路なし |
| `TRANS-STAGED-TO-HOST-CLEAN` | `STATE-CANDIDATE-STAGED` | `STATE-HOST-CLEAN` | Host／Docker finalize |
| `TRANS-HOST-CLEAN-TO-RESULT` | `STATE-HOST-CLEAN` | `STATE-RESULT-PUBLISHED` | Candidate publishと結果公開 |
| `TRANS-ACTIVE-TO-BLOCKED-CLEAN` | active state | `STATE-BLOCKED-CLEAN` | cleanup確認済みでRecovery不要の安全な停止 |
| `TRANS-ACTIVE-TO-RECOVERY` | active state | `STATE-RECOVERY-REQUIRED` | 取消、失敗、Process lossまたはunknownの保持 |
| `TRANS-ACTIVE-TO-OPERATOR-TRANSFER` | active state | `STATE-OPERATOR-TRANSFER-REQUIRED` | cleanup不明かつactionable IDなしのEvidenceを自動再試行せず移送 |
| `TRANS-ACTIVE-TO-PROCESS-RESTART` | Host cleanup前のTask／Stage状態 | `STATE-PROCESS-RESTART-REQUIRED` | cleanup確認済みのProcess poisonをOperation Recoveryへ誤昇格せず、現在Processだけを廃棄 |
| `TRANS-HOST-CLEAN-TO-PROCESS-RESTART` | `STATE-HOST-CLEAN` | `STATE-PROCESS-RESTART-REQUIRED` | 公開済みCandidateと成功結果を保持し、同じProcessからの次Effectだけを禁止 |
| `TRANS-PARTIAL-PAIR-TO-RECOVERY` | `STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT` | `STATE-RECOVERY-REQUIRED` | 未設計のEffect前partialを保持して停止 |
| `TRANS-RECOVERY-TO-RECOVERED` | `STATE-RECOVERY-REQUIRED` | `STATE-RECOVERED` | exact資源回収とEvidence残存0 |

機械可読Traceの`verificationBoundaryByBinding`は、試験が契約投影だけを検査する`contract_projection`か、実Filesystem／実Processを観測する`actual_filesystem_process`かを区別する。将来の公開CLIおよび署名済みE2Eはそれぞれ`public_cli`、`signed_e2e`として追加し、fixtureの自己申告を物理観測済みと表現しない。

回復開始の公開理由は内部Pathや入力文字列を返さず、競合、到達可能partial、identity不一致、観測不能およびその他の利用不能というexact allowlistの固定分類へ写像する。`active_or_unknown`、Lock解放未確認、監査失敗およびFilesystem観測不能は競合へ縮退させず観測不能とする。未知またはcaller由来の理由は一般利用不能へ閉じ、内部文字列を部分一致で分類しない。

## 11. 変更と検証

状態、遷移、資源、Lock、Recoveryまたは結果公開条件を変更する場合、同じ変更で次を更新する。

1. 本書
2. 機械可読Trace
3. 実装
4. 正常・準正常・異常の検証
5. 現在品質状態とCHG Evidence

具体的なRuntimeで得た学びは、同Runtimeだけの条件なら本書へ残す。別RuntimeまたはCRDD全体にも適用でき、実証で有効性を確認した原則だけを、決定権限を持つ上位正本へ別途昇格させる。
