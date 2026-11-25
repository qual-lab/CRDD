# 実行モデルの責務と単一保存契約

実行モデルの保存試験は、試験が確定したディレクトリと呼出し側の同期再確認だけを渡す。Gitが存在するか、どの改訂が現在かをVersion Controlから取得しない。Gitの改訂・配置を実際に変える接続試験とその準備はCoordinatorが所有し、実行モデルの試験は呼出し側の失効、保存先の実体差、再入場、排他解放を独立に検証する。

## Host作業領域の保存基盤

Host記録の`resources`は必須で、Task／Adviceは`null`とする。`isolation_probe`だけが既存`OperationResources`を同じ記録に保持し、Probe専用のStore・疑似Task／Provider／Homeを作らない。初回Host Intentでは資源は未設定で、Rootと全子領域Receiptの確認後に、単一Probe Containerの作成Intentから記録する。元Resource Snapshot・回収順・期限・`retain`を保存し、Receiptを失う更新や自動再発見のReceiptは拒否する。資源が未解決ならHost清掃確認・終端化を受理しない。入力はgetter／Proxyを実行せず独立捕捉し、資源の内側まで凍結する。

これは既存Writerの保存契約であり、実資源不存在・Process終了・削除許可を自動的に証明しない。Coordinatorの回復照会は資源key・通知保存区分・観測区分だけを投影する。Host実作成・Probe実行の本番Sourceは同じEM記録へ接続し、旧Probe専用記録のSourceは撤去した。旧試験の全面追従と実資源を含む一体検証は未完了である。資源なしの明示`null`を省略する旧Host値は新Readerで補完せず、過去保持物の自動変換もしない。

Host資源の要求区分は、発行不明／発行済みから未発行へ巻き戻さない。一方、実DIの正の未発行結果による終結は妨げない。作成前Intentに含まれる`request: "not_issued"`は準備時点のSnapshotであり、それだけを後続のEffect 0の証明として扱わない。上位の保存接続はDIの通知／Completionにある未発行事実からだけ未発行終結を記録する。

Taskの固定Git資源は同じHost記録の`git`へ保持する。未要求なら項目自体を持たず、初回追加は一件の未発行予定（OID・一時Index未取得、回収未確認）だけを認める。基準・候補の管理Ref名は元Operationから固定し、OID・一時Index結果・Ref発行不明・確認・回収を単調に記録する。既知OIDの変更、予定なしの確認済み追加、複数一括追加、別OperationのPath・余剰属性を拒否する。配列のSymbol・accessorも補完せず拒否する。

Git資源が未回収ならHost終端を受理しない。この値契約は実Refの不存在や削除許可を証明せず、上位はVCの期待OID付き回収結果を同じCASへ保存する。Docker終端WriterはHost記録を更新せず、Hostの独立CheckpointとDocker終端・履歴を混ぜない。終了履歴の新Schemaは`operation-summary/v7`だけを受理する。

Hostは同じOperationRecord閉集合の`host_operation`として、元の操作ID・用途・作成日時、Rootと固定子領域の実体Receipt、準備／使用中／終端と回収状態を保持する。非Authorityの回復参照は元操作IDから`host-operation.<操作ID>`へ一意に導く。任意Path、別nonce、専用Hash token、Docker／修復用の架空履歴は追加しない。Rootは検証済みRepositoryと元操作IDから上位が導出する。

既存`saveOperationStart`の`host_operation`用途は、作成前Intentを最初のState本文から一出版する。既存`saveOperationCheckpoint`の同用途は、同じ保存済み操作と物理改訂／本文Hashの`expectedVersion`を必要とし、未開始操作の追加には使えない。HostOperationAccessは既存Rootと`operation.record`／操作IDの現在認可だけを持つ信頼した入口の接続である。Host技術記録ではPrincipalを要求・取得・保存しない。要求主体は上位のTask／Advice記録が所有する。一般ExecutionModelAccessのPrincipal必須条件とAMの内容権限は変更しない。偽ProjectやRoot作成後のCapabilityを作成前保存へ流用しない。

現在の認可確認から既存短期Ownerで読取り、閉じたHost候補を導出し、同じ物理Writerがfresh本文と候補の再導出・CASを確認する。初回領域も既存primitiveを用い、空Stateを先行出版しない。同じOwnerを一度だけ解放し、開始成立には保存確認・解放確認・現在認可がすべて必要となる。出版不明でも元回復参照を保持し、初回pendingを新規の空状態へ読み替えない。Reader・履歴・Task相関は三種を明示し、HostへDocker／修復の終端要約を捏造しない。

この保存基盤へCoordinatorのRun／Advice・明示隔離試験と実体作成／回復を接続し、旧marker・tokenの撤去を完了する作業は残っている。Receiptの値が妥当でも実体の現在性や不存在は証明されず、回収済み値だけから削除・実行許可を発行しない。値・保存の限定成立をHost全体の統合完了へ換算せず、過去保存物の自動変換・削除も行わない。

## 技術要求前の終了とHost回収の分離

Docker操作の資源が未設定の場合も、終了準備中・Provider未開始・送信と共有書込み未発行・Owner無効化・結果と履歴未確定・再起動義務終結を共同確認する。元失敗のCommand取得・応答・Receiptがすべて未観測で、Command観測も欠測又はnullなら、その失敗を消さずに技術資源の終結を判定できる。Home Leaseの保持／解放はこの判定と分け、解放不明は受理しない。これだけからHome解放・Host不存在・最終Cleanup成功を推定しない。

Executorの既知の開始拒否四理由は、計画拒否又はHome取得失敗として元理由を保持する。保存する一次失敗は用途と例外なし・Command取得／応答／Receiptなしの限定形に閉じ、開始・送信・共有書込み・資源要求の観測と矛盾する場合は拒否する。結果確定時はblockedかつ元失敗と同理由だけを受理し、成功・取消・別失敗へ変えない。未終了の結果nullは維持する。これは保存値の整合条件であり、開始拒否の文字列だけをEffect 0や削除許可の証明にしない。

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

EMはNode.jsと共通Lockを利用する。Version Control・文書モデル・構成モデルとの直接依存は、実装・型・再export・深いimport・dynamic import・package依存を含めて持たない。保存ディレクトリ、設定、選定は上位が取得・確定して渡す。

EM SourceはAD／DI型を直接参照しない。`ExecutionSelection`の技術選定五項目、`OperationResources.snapshot`の非秘密資源情報、一次失敗の`turnCountDiagnostic`はEM所有の保存契約である。上位のCoordinatorが技術型と保存型の構造適合・入力搬送を接続する。型適合は認可・保存成功・技術Effectの証明ではない。

他Packageの試験も同じ依存方向に従う。EMの内部検査はEM自身、DIの内部検査はDI自身、両者の接続はCoordinatorが所有する。外部ConsumerはEM Rootの公開契約を使い、試験目的の深いimportや互換Facadeを設けない。

保持設定も同じ境界で分ける。上位の設定取得・日数搬送・履歴枝の再観測はCoordinatorの試験、日数null／不正値の早期拒否と保存時のOwner確認はEMの試験が所有し、EMからCoordinator Sourceを読まない。

## 2. Logical BlockとSourceの所有

| Source | 責務 | 境界 |
|---|---|---|
| 各モデルの `types.ts` | モデル、要求・結果、閉じた値域 | 保存型の正本。上位要求・表示型を持たない |
| 各モデルの `validation.ts` | 局所構造・値契約・入力受付の検査 | 未信頼入力とJSON解析済み値の検査を同一視しない |
| Objective・Task・Attemptの `transition.ts` | 各モデルが所有する次状態の候補・遷移検査 | 局所検査を利用し、全State検査・保存へ戻らない |
| `history/records.ts` | 履歴行・要約・保持選別・固定内容の照合 | 保存や全Stateの復号には依存しない |
| 各モデルの `crud.ts` | 完成したモデル操作、認可・現在値と保存接続 | 空Wrapperや第二Writerを作らない |
| `composition/transition.ts` | 全Stateの解析・同版相関・改訂と候補結合 | 局所モデルの意味計算は各Ownerを使う |
| `lease/crud.ts` | Leaseの照会・取得・解放・回復と専用候補・観測 | 共通State保存を再実装せず、既存の排他内更新へ一方向に接続 |
| `storage/store.ts` | 固定保存所在、File読書き、初期化、単一Writer・CAS・出版再入場・短命証拠 | 履歴の意味やモデル遷移を再実装せず、Attempt／History CRUDへ実行時逆依存しない |
| `storage/lock.ts` | 保存排他とOwnerの取得・保持・解放 | 業務上の再入場判断を代行しない |

実装は次の31ファイルに対応する。Taskの局所遷移はTask、複数モデルへの組込みはCompositionが所有する。旧 `state/`・`operations.ts`・`publication.ts` や転送入口は残さない。

```text
src/
├─ index.ts
├─ objective/    crud.ts / transition.ts / validation.ts / types.ts
├─ task/         crud.ts / transition.ts / validation.ts / types.ts
├─ attempt/      crud.ts / transition.ts / validation.ts / types.ts
├─ decision/     crud.ts / validation.ts / types.ts
├─ workspace/    crud.ts / validation.ts / types.ts
├─ history/      crud.ts / records.ts / validation.ts / types.ts
├─ lease/        crud.ts / types.ts
├─ composition/  crud.ts / transition.ts / validation.ts / types.ts
└─ storage/      store.ts / lock.ts
```

Leaseの公開四操作・候補九用途・Root観測・専用結果構築はlease/crud.tsが所有する。通常State CRUDへの接続は既存withSnapshotOperationだけとし、RootはLease宣言元から直接公開する。State CRUDからLeaseへの逆参照・旧位置のWrapperは置かない。全Stateの更新時に履歴／Leaseの現在観測を要する閉鎖・退役判定はState CRUDが所有し、History CRUDも同じ判定実体を利用する。validationは観測callbackや通知を呼ばず、元版・候補・閉じた入力の値検査へ限定する。候補の成功／拒否封筒は保存結果とは別の局所constructorで元field・freeze・既定値を保ち、Storage結果型へ置換しない。観測と通知の回数・順序・短絡位置は変更しない。

### Stateの値契約と各モデルの意味

`composition/validation.ts`の所有範囲は、Execution Stateの保存値契約・主体／Identity・正規化・Hash・Lease証拠と相関に直接関係する値処理に限る。利用元が多いことだけを共通化の理由にせず、全State検査・保存・Authorityを持たせない。

Taskの候補・回復・結果参照の文法はTask、計画定義HashはObjective、採用拒否はWorkspace、資源の新しい不存在辺はAttemptが所有する。資源差分に対して専用保存証拠を要求するのはStorageである。Plain Dataのdescriptor捕捉とJSON解析済み値のkey検査は入力の由来・例外条件が異なり、同じHelperへ無条件にまとめない。新しいcommon Packageや転送exportは設けない。

### History・State・Storageの接続

| Owner | 処理 |
|---|---|
| History validation | 全行解析、重複・部分行・未知Schema拒否、追記受付の候補生成 |
| History records | 行・要約生成、両Hash照合、同ID exact比較、元順序での保持選別、pending全文比較、Buffer独立捕捉 |
| History CRUD | 全Stateの閉鎖・保持参照を必要とする履歴保存、記録退役、完了確認 |
| Composition transition | 全体解析、保持参照・必須Hashの投影、同じ元版の履歴候補とState候補の結合 |
| Storage | 現在Owner・元本文・File・設定のfresh照合、CAS、物理出版、用途別の確定照合 |

`prepareHistoryAppend`は現行全行と未来時刻を先に検査し、Task入力、同版Decisionの投影の順に候補を作る。同ID同本文は追記せず、異本文は候補全体を拒否する。追加なしは元Bufferを返し、JSON例外は拒否する。

保持処理は参照保護と必須行の存在・両Hash照合を区別する。選別前に欠測・衝突を拒否し、現在参照・reviewAfter前・保持期間境界の行を元順序・元本文で残す。同期した一回の候補導出では検査済み元Stateを使うが、最終遷移検査とWriterのfresh照合を省略しない。候補成立は保存・退役・資源回収の成功ではない。

<a id="public-api"></a>
## 3. 公開契約

Rootは94項目（59値・35型）。完成した読取り・更新・終了・回復・履歴操作、独立した入力受付とモデル語彙を明示公開する。正確な集合は`src/index.ts`と固定期待値の公開契約試験で確認する。件数を目標にunknownや巨大Unionへ置換しない。

管理Projectの読取り・保存成功結果は、同じProject・世代から導出した`taskStartCandidates`を非永続の観測として返す。並列枠・未回収資源の予約・Path／Conflict Key・定義順の規則はTaskが所有する。観測はAuthorityではなく、予約・引渡し・開始観測は既存の`saveProjectExecutionState`が有限の`task_start`／`task_handoff`／`task_started`要求を受け、同じ短期保存Ownerのfresh Stateで再検査する。保存形式・一般Task定義CRUD・他の更新の保存境界は変更しない。

同じ保存入口は`task_retry`／`task_replan`も受け付ける。再試行の上限は対象TaskのretryCount、部分再計画の上限は置換済みTask数であり、共通counterへ統合しない。分類・再試行の実行判断とQueue再開はCoordinatorが所有する。EMはfresh状態で元世代・回数・置換範囲・依存と循環を照合し、保存とLock解放を確認した時だけ、同版の対象Task一覧`taskUpdateTaskIds`を非永続の成功情報として返す。直後再送はTask初期値・定義順・対象ObjectiveとMilestoneの確定状態まで一致する場合に限り、既存の同候補耐久確認へ接続する。

`task_settle_before_effect`はstarting／handoff_preparedの開始前終端だけを扱う。結果解釈はCoordinatorが所有し、EMは元世代・Task／Attempt／Operation／Authority相関、失敗・取消・回復必要と回復義務を検査する。同じ捕捉値から結果事実を一件だけ内部生成し、Task終端と関連Operation整理を同じ物理Writerへ渡す。CallerのresultFacts追加は拒否し、candidateId等の余分fieldも無視しない。直後再送も同じ規則で候補を再構築して全文一致を確認し、内部結果事実を省略せず耐久再確認する。通常終端のphaseと混同せず、回復バッチは別の更新境界として扱う。

通常のrunning終端は`task_settle`で扱う。清掃未確認の失敗はcleanup_pending、完了・取消は清掃確認を必須とし、候補は完了に限る。完了依存のready化とObjective／Milestoneの更新を同じ候補で行い、受入を自動確定しない。業務上のrecoveryUnresolvedと結果事実のresultUnresolvedを分け、結果事実はEMが同じ有限要求から内部生成する。同じTask本文でも結果事実だけ異なる再送は既存Writerの照合で拒否し、Task終端と技術Operation整理は一保存のままとする。Coordinatorの旧task/lifecycle.tsと保存転送関数は撤去し、回復義務の更新も同じ有限保存へ統合する。

初回ProjectとQueueの作成は`createQueue`のscheduled操作で完結する。第二入力は完成Stateではなく`ProjectExecutionInitialization`とし、閉形式捕捉・入力検査をStore初期化より先に実施する。モデル内部でgeneration 1と依存待ちを組み立て、同じ保存候補へProjectとQueueを結合する。freshな同ID照合を優先し、再送で勝者のOwner・固定選定・初期値を置換しない。初期生成HelperはRootへ公開しない。Taskの開始・終了・回復義務更新は有限保存へ接続するが、Owner不在・元Operationの実観測はCoordinatorに残し、その結果からの状態結合は同じ有限保存が所有する。初期生成だけから全制御の移管済みを主張しない。

通常CRUDの`queryPlan`／`queryObjectives`／`queryTasks`／`queryQueue`と単件取得、用途ごとの同版複合取得を区別する。`queryQueue`は現在の本番外部Consumerがなくても、採用済みの認証・対象限定付き通常一覧Capabilityとして維持する。参照の存在だけを設計上の必要性の証明とはしない。

### 独立した入力受付

残る独立受付は`inspectExecutionPlan`、`isPrincipalId`、`parseDockerTaskRecoveryId`、`validateResourceBook`である。単体選定と二役割の選定組はEMの保存操作・Readerで内部検査する。Coordinatorは新規選定で相関を確定し、既存状態ではReaderの同版の組を再選定せず、Task本文とは別に搬送する。開始と完了は同じPacket由来の選定を使い、完了時は保存済みの全選定と照合する。判断の完全なモデル値はDecisionの保存操作が検査・捕捉して返す。旧Host TokenのParserは撤去し、Host参照は同じStateの`host_operation`と元operationIdへ結合する。

`inspectExecutionPlan` は、新規・再開の両方で、認可・保存観測より前に未信頼の計画を検査する独立した受付として維持する。`savePlan` は現在認可と保存版を要求する一般定義の変更操作であり、この受付を代替しない。

未保存の計画・選定、入口主体、Operation保存前／Host-only相関、別の認証回復記録、保存済みQAイベント列に独立した信頼境界がある。これらを検査目的の先行保存やCoへの規則複製で置き換えない。同じ受付内の検査済み・独立捕捉済み値は再利用するが、別の入力境界・Lock区間・保存直前のfresh検査へ拡張しない。

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

通常の複合取得は、上位で対象を確定した保存先と結合識別子を受け、用途別の項目を同じ保存版から一度で取得する。任意の項目指定や全Stateの取得は提供しない。

| 読取り操作 | 取得内容 |
|---|---|
| `readQueueState` | `queueEntries`、`leaseIntents` |
| `readExecutionState` | `projects`、`queueEntries`、`schemaRevision`、同版の開始候補 |
| `readWorkspaceState` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

`readState`は技術操作専用とし、`operation`は現在Owner、`recovery`は真正Repositoryの権限境界を持つ。固定用途の入力で読取り内容を選び、未知用途はOwner callback・保存前に拒否する。同版の`operationStates`は元操作参照と終端判定の不変な組であり、IDだけで他版の操作と混ぜない。不在と観測不能、読取り成功と解放成功を区別する。

技術操作へ渡すStateの構造は改訂・操作記録・未解決の回復義務に限る。同じ読取りから元版の比較値（`versionEvidence`）、本文ハッシュ、用途別の照合結果を得る。全保存型、保存本文、復元済みProjectの集合は公開しない。

履歴確定は`historyPublicationStage`、終了確定は`completionPublicationReady`で上位に示す。確定候補・照合用の履歴ファイル本文・ファイル実体の証拠は保存Ownerの内部に留め、上位は既存の確定操作を呼ぶ。履歴の正式照会は従来どおり読み取った行を返す。

資源回収の途中保存は、元版と候補の組をEM内だけで保持する。上位は同じ組か、確定後の本文が候補と一致したかを確認し、観測した組を既存の保存操作へ渡す。任意の本文や組の自作を受け付けず、Writerは従来どおり現在Owner・候補の妥当性・同じ組を再確認する。

通常の回復保存は、同じ読取りが発行する`versionEvidence`で元版を指定する。Coordinatorは元版を再構築せず、別の取得との完全一致確認と既存Writerへの引渡しだけを行う。Writerは本文を既存のCASへ接続し、この証拠を保存権限としては使わない。

開始時の現在Owner・初回Identityの検査と保存は`saveOperationStart`が担当する。`readState`は開始の許可や記録を作らない。

回復Readerは再起動準備、Host遷移、資源出版の元／候補pair、終了相関を既存取得に結合する。Coは同版・排他・現在性と実Host tokenを確認してから使う。完了観測は単なる操作不存在ではなく、同nonce残存拒否・終了履歴・回復ID・correlationId・読取り・解放の共同成立である。

<a id="repair-write-contract"></a>
### 保存更新と技術結果

通常の状態更新では、短期Lock内で業務遷移を照合した元版の正規本文を、保存候補の組立てにも使う。これは候補の根拠であり、保存許可ではない。物理Writerは現在本文との完全一致と途中物の有無を新たに確認し、置換直前のCASも行う。新品初期化、同一候補の再入場、履歴専用の読取りはこの再利用の対象外とする。

既存Stateに対して新しい途中ファイルを作る通常保存では、作成時に書込み・同期・読戻しを完了し、二度目の同期は行わない。その後に途中ファイルと現在ファイルの本文を照合する。各読取りでは正規パスと親・保存領域・対象ファイルの実体を照合し、置換直前にはOwnerとLock、両ファイルの実体、履歴途中ファイルの不存在を再確認する。置換後は、途中ファイルが残っていないことと、同期済みファイルと正本の実体が一致することを確認し、正本の本文は読み戻さない。置換後の本文の読取り不能や本文不一致は、保存時の独立した確認対象に含めない。初期化・再入場・修復・履歴保存の境界は維持する。

`saveRepairRecord`は期待StateVersion（初回null）と、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの論理更新を受ける。EMがexact対象、元改訂・Hash、現在Owner、対象外全文を照合して候補を構築する。Coは次Snapshotや正規符号化byteを組み立てない。

保存確認と排他解放まで共同成立した場合だけ、確定`operation`・`version`と対応する`checkpointSettled`／`disposalSettled`を返す。保存・解放不明のvalueはnullであり、未確認版を次の正本に補完しない。八処置の値上の終端は修復全体の成功ではなく、上位がEngine・Host安全性・Cleanup・Lifecycleの技術結果と結合する。自動再基準化・再試行はしない。

`saveOperationStart`は開始保存と終端Context準備を`startSaved`／`completionContext`で区別する。保存済みでも準備失敗ならHost要求を出さず、元参照・保存Effect・解放不明を保持する。`completeOperation`は元Host／Controller結果の同じ参照を固定し、入力受理と保存結果を区別する。ContextはProcess内だけで使用し、保存値から復元しない。Task結合操作はTask終端と同じStateで終了し、非結合操作は技術終端・履歴確認で終了する。配送ACKは終了条件ではない。

`saveRecoveryCheckpoint`の資源未発行・Host清掃準備・認証不明終了・資源再出版は、それぞれの元Owner、元本文、再観測・一回証拠、元／候補全文pairの条件を保つ。`completeRecovery`／`saveRecoveryHistory`はdocker_task／docker_repairを固定用途で区別する。履歴保存は既存Lockを一度取得し、要約固定・履歴確定・最終Stateの確定を同じ排他下で行う。CAS、同期、置換後の実体確認と解放確認を残す。最後に成功を確認するためだけのState本文の再読はせず、途中失敗後の再開では実際の保存物を読み直す。

Windowsの名前置換では、同じファイルでも置換先の作成時刻を引き継ぐ場合がある。履歴確定・Task回復終端の置換直後に限り、作成時刻以外の照合条件が成立しているときは、安定した読取りで確定候補との本文一致を確認する。異なるファイルID、単一リンク条件の不成立、本文不一致、読取り不能は拒否する。通常経路では追加で本文を読まない。CASと通常のファイル照合は変更しない。

Lease IntentはRepository・Project・Queue・種別からIdentityと回復IDを生成し、保存前通知・物理取得確認・Owner喪失観測で同じexact値を使う。呼出し側のOwner世代・Process IDと物理排他、回復順序は別の保証として保持する。

<a id="storage"></a>

### 実行の終了記録を保持する保存契約

保存候補は`crdd-execution-model/state/v9`、内部投影は`project-snapshot/v9`を使用する。旧形式の互換Reader・自動移行は追加せず、既存保持物は今回処置しない。Coordinator整理のためのEM変更であり、独立した重複防止Storeや台帳を新設しない。

Queueは受付と実行状態の正本であり、終了履歴が確定しただけでは削除しない。同じ記録の`historySettled`が履歴の保存確認又は既存の保持期限処置の確定を表す。新規受付はfalse、閉鎖・履歴照合後だけtrueへ進み、trueからの巻戻し、要求Hashの変更、通常の再開と記録削除を拒否する。履歴候補生成はtrueの記録を除き、二回目の保守で同じ履歴を作り直さない。

結果・Leaseの清掃は従来今回確定した対象に限定する。保持したQueueが参照する結果は除去せず、未知・未解決・参照中の情報を成功や不要と読み替えない。過去に確定した対象まで清掃対象を広げる変更は今回含めない。

受付世代と`intakeBindings`は撤去した。保存直前のfreshなQueue ID・要求Hash・Project・Milestone照合は維持し、未知IDのresumeは拒否する。新規開始の初回受付だけが既存初期化を使用する。既存createQueueのscheduled処置は初回Project候補を任意に受け取り、既存Queueを先に照合して、新規の場合だけProject・Milestone・Revisionと初版generationを検査し、一回の候補保存へ結合する。既存Projectを上書きせず、同ID競合で敗者Projectを残さない。実行ID・終端記録を削除して再実行可能に戻さない。旧形式Reader・自動移行は追加しない。
## 5. 保存・初期化・回復

| 項目 | 現行契約 |
|---|---|
| 保存先 | Repository直下の`.crdd/execution-model/`。保存先の名前を揃え、保存内容のIdentityは変更しない |
| 正本と途中候補 | `state.json`／`history.jsonl`と`state.pending.json`／`history.pending.jsonl` |
| 排他 | 共通Lockの`.crdd/lock/execution-model.state.lock`。pendingは排他ではない |
| 保存値 | `ExecutionStateSnapshot`の19field明示定義が唯一の保存正本。Overview等は投影であり別保存しない |
| 確定 | 単一Writer、元版・Owner・実体・現在性のfresh照合、CAS、物理出版、用途別の確定照合、解放確認 |
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

保存起点の初回捕捉では正規パス解決の前後で実体を照合する。捕捉済みの結合値を渡す再照合では、正規パスと現在の実体を一度ずつ観測して結合値を比較する。操作内で必要な観測位置は変更せず、前の観測結果を次の境界へ持ち越さない。

通常の保存Owner借用と直後の読取りは、同じ登録済みRepository入力に限り入口の保存先・Lock照合を共有する。読取り後の現在性と解放は照合する。検証済みの同じStateから照会結果または保存候補の比較元を投影する際は、符号化と全体検証を繰り返さない。

Workspaceの作成・廃棄・選択・再観測はTask用のLease意図・取得証拠・解放証拠を作らない。短期保存排他の内側で既存の操作Lease予約と物理Lockの不存在を照合し、Taskと同じRepository単位の操作Lockを取得する。操作は発行したLockと同じ保存先・Project・Queue・Workspaceに閉じ、用途別の比較更新だけを受ける。観測に基づくWorkspaceの状態は実行モデルが判定し、選択が成立したときだけ未割当のQueueを結び付ける。各保存でLockの生存と世代を照合し、Git呼出しはServerが操作Lockを保持して行う。改名・保留・解除は操作Lockを取得せず、短期保存排他内で操作Lease記録と物理Lockの不存在を確認して比較更新する。未終了のTask Leaseに対する取得・解放・回復契約は変更しない。

候補固定・候補終了・正本採用も同じ操作Lockを使う。既存Workspaceの候補欄だけを比較更新し、候補の除去は同じWorkspace・操作・候補Commit・採否に結合したRef回収証拠を現在版から確認した場合に限る。確定済みの証拠は後発の観測失敗で上書きしない。正本採用では、同じ操作Lockの生存と固定済みの候補・取込先を照合し、採用先専用Leaseの取得・解放証拠は作らない。

操作Lock取得は、短期排他内の不存在判定を閉じる最新の領域観測をその直後の取得に使う。領域の真正不存在をLockの取得成功には読み替えず、競合と部分失敗は共通Lockの取得結果で判定する。Gitや保存の後段では改めて操作Lockの生存を確認する。

保持日数を消費する履歴分岐だけ、上位から日数を受け、既存revalidateで現在設定と期待日数の一致を確認する。通常の引数なし再検証・非履歴Queryに設定読取りを追加しない。設定不存在時の30日と明示30日は同じ扱いとし、新しい設定Hash・世代一致は要求しない。履歴確認前に必要な判断記録や未解決参照を退役させない。

保存先と保持設定を分けて確認する新規Task履歴では、同じLockのReaderが検証した日数をWriterの候補照合に使い、最初の履歴途中ファイルを作成する直前に設定を再確認する。作成の発行後は同じWriter内で日数を固定し、設定の変更は次回の新規保存から反映する。保存先・操作所有者・Lock・CASは引き続き照合する。既存の途中ファイルからの再開や修復履歴には適用しない。

通常の履歴更新では、同じWriterのReaderが厳密に検査したStateから保持参照を導出し、検査済みの元本文をCASに使う。保持判定だけのために再符号化・再検証しない。終了要約の保存、履歴の確定、Queue退役の順序と、現在本文・保持設定・履歴の観測は維持する。

通常のTask・Queue・Workspace候補では、同じ段階で正規復号したStateを候補の組立てと遷移検査へ渡す。物理Writerは現物本文を改めて読み、元版との完全一致を確認してから候補を再構築し、渡された候補と本文が完全に一致する場合だけ進める。同じ候補は投影と結果事実の照合にも使う。初期化・同一本文の再入場、履歴途中物の拒否、および置換前後の保存確認はそれぞれ維持する。

<a id="verification"></a>
## 6. 検証の所有と確認範囲

| Owner | 確認内容 | 成功から推定しないもの |
|---|---|---|
| EM | 独立DTOによる保存codec・全field・遷移・凍結・参照分離、全State／History整合、Writer／Reader／Lock／CAS | DI技術処置・資源不存在 |
| DI | 独立DTOによる技術codec、Machine通知・Session・再開・廃棄条件 | EM保存受理・保存成功 |
| Coordinator | 実DI通知からEM Rootの完成保存・読戻しへの接続、回復IDの三成分保持 | 実Docker／Provider成功 |
| 各Package | 自身のRootの独立ロード、外部依存境界 | ロードだけによる保存・実Effect成功 |

修復の値試験は両Ownerで同じ入力母集団を独立した期待値へ照合し、一方のdecoderを他方のOracleにしない。2,799入力のprofile・field path・変異を固定し、入力の種類・getter／Proxy未評価・不変性を保持する。連携の保存成功はCoが確認し、技術値の受理と保存確定を区別する。

保存Source試験は同じProcessでSourceを編集しない前提でLeaseを含む固定10Sourceの読取り・型除去・宣言抽出と同署名の未束縛factoryだけを共有する。Map・Owner・State・故障注入・保存領域は各ケース独立とし、Source変異は毎回compileして通常factoryと混ぜない。

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
| `execution-model.package-boundary` | Interface／State／Failure | 公開94項目・独立ロード・モデル間依存0 | 既存の完成操作・Owner・結果相関を保持 | 内部補助の公開、上位Consumer知識、逆依存 | UT | N/A | RCM-UT-014の入力・結果・現在値と必要な終了確認 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
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
