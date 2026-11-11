# AI実行記録・検索・集計の詳細設計

## v0.22採用済み再構成 — ExecutionとExecutionGroup

状態: v0.22採用済み契約。2026-11-11の責務配置・文書整理は限定検証中。本書は現行の2モデル・9操作を所有する。過去方式と当時Evidenceは[基準版監査](02_Current_Implementation_Reality_Audit.md)、現在の検証結果は[変更計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#ei-execution-group-realignment)で区別する。旧データ移行、全体回帰、Release成立は含めない。

### 責務と公開操作

EIはアプリケーション非依存のAI実行観測・記録・検索・集計ライブラリとする。実行を開始・取消せず、Taskの状態、採否、Recoveryの許可、品質評価、改善提案を所有しない。

| 論理モデル | 正本 | 対象外 |
|---|---|---|
| `Execution` | 呼出し側が識別した一回の論理的AI実行。ID、任意Group、用途、設定、時間、使用量、結果、診断、外部参照 | Task／Attempt階層、ProcessやAPI Requestとの一対一対応の強制 |
| `ExecutionGroup` | 呼出し側が開始・終了を所有する任意の集約単位。ID、用途、開始・終了、状態、メタデータ | 依存順序、Retry Graph、多段Group、子の自動終了、合計値の二重保存 |

公開操作は`createGroup`、`completeGroup`、`createExecution`、`completeExecution`、`getExecution`、`listExecutions`、`getGroup`、`listGroups`、`summarizeExecutions`の9操作とする。いずれも明示した`StoreOptions`を受け、暗黙のプロセス全体設定、Factory、Manager、Registry、汎用更新操作を追加しない。`create`／`complete`は観測記録の保存であり、AIの実行命令ではない。

Task／Attempt等のCRDD IDはCoordinatorが任意メタデータへ写す。EIはキーの業務的意味を解釈せず、IDの生成・一意性判定・許可判断に用いない。メタデータと成果物参照にも容量・形状の上限を設け、Prompt、応答本文、Credential、環境変数全体を入力契約へ追加しない。

メタデータの情報分類は呼出し側が所有する。任意の文字列から未知のSecret不存在をEIが証明するものではない。CRDDの本番ProducerはID・固定分類・技術結果の真偽だけを投影し、Provider本文・自由なstderr・Host Pathを受け渡さない。旧Schemaの診断Allowlistを、他アプリケーション向けの普遍的な安全判定として残さない。

### 計測と状態

| 境界 | Coordinatorの接続 | 保存する意味 |
|---|---|---|
| Provider要求直前 | `execution/provider-executor.ts`の既存`onProviderSubmitting`。既存Recovery Intent保存の成功後、EI保存だけを別の例外境界で実施 | 開始要求直前の日時。Task受付・Plan・Container準備を含めない。推論開始の証明ではない |
| Provider開始通知 | 既存`onStarted` | 開始要求と実際の開始観測を区別する。既存必須通知・取消条件を変更しない |
| Completion受領 | 元ExecutorのCompletionで、同じExecution IDの終了日時・経過時間・限定したAI結果を短命な記録へ固定 | AI側の終了観測。任意`onCompleted`の発行を保存完了とみなさない |
| 上位の最終判定 | Task／AdviceのHost清掃・取消・Process再使用可否・必要な結果投影の後、同じExecution IDへ一度だけ終了保存 | AI結果とは別にTask／Adviceの結果・未解決保持条件を記録。後段の待機時間をAI経過時間へ足さない |

開始要求直前からCompletion受領までは後処理を含む経過時間である。Provider実行時間とは別の項目とし、Provider開始・終了の実測値が公開結果にない場合、Provider実行時間は欠測とする。既存`dispatch.ts`のTask準備を含み得る時計をAI開始時計へ転用しない。

元Completionを観測できなかった場合、終了日時を補完せずopenを保持する。上位の最終結果が不明な場合も通常保持へ落とさず、同じExecution IDで診断する。一つのTaskから複数AIを呼ぶ場合は各AIの結果を別々に保持し、Task全体の成否で上書きしない。既存Activityへの投影はAIの成功からTask成功を推測せず、Coordinatorが保存した最終Task判定を使う。

EI書込みの拒否・例外・不明で新しいAI停止条件を追加しない。Recoveryの必須Intent保存失敗は従来どおり後続Effectを停止し、EIの失敗と混ぜない。開始記録はAIが実際に始まった証明ではなく、後続の開始失敗も終了結果として区別する。AI開始要求より前に拒否されたTaskはCoordinatorの既存結果・記録に残し、EIへ開始日時を補完しない。

IDは呼出し側が一度確定し、開始・終了・保存不明診断・再入場へ同じ値を伝播する。同じID・同じ操作内容の再送は記録済み、異なる内容は競合とする。終了済み結果の上書き、未完了の自動失敗化、保存不明時の自動再送・別ID生成は行わない。

CRDDの既存Activity APIは外部契約の固定ID形式を維持する。EIの不透明なExecution IDからCoordinatorが決定論的なActivity IDを投影し、EIにCRDDのID形式を要求しない。保存失敗の内部診断は元のExecution／Group IDを保持する。

Group終了は子Executionの終了・成功を表さない。Groupが終了しても未完了・不明な子の件数を検索・集計結果へ残す。Groupの経過時間、子の実行時間合計、成功率の分母、項目別の計測済み／欠測件数を区別する。Cache Read／Write、金額／Credit、通貨、報告額／推定額を混同・無条件合算しない。

### 保存境界と移行

`StoreOptions`は上位が確定した保存Directoryと保持設定を表す。CRDDではCoordinatorがDomain Modelの既存Runtime領域解決で`.crdd/execution-intelligence`を確定・準備してからEIへ渡す。EIからDomain Model／Version Controlへの依存は撤去する。任意の親DirectoryをEIが再帰作成せず、Node.jsで非リンクDirectory・固定File・実体・容量を確認し、観測不能を空Storeへ変換しない。

物理保存は既存の単一履歴、共通wx Lock、短命pending、同期書込み、出版前後の確認を再利用する。Lockは`storage/lock.ts`の薄い接続だけとし、独自Recoveryを追加しない。出版後の確認不明と未出版、出版済みだがLock解放未確認を区別し、同じExecution／Group IDと保存先内の残存参照を結果へ保持する。

未完了・結果不明および呼出し側が未解決と指定したExecutionは期限整理から保護する。未完了Group、および保持対象の子Executionから参照されるGroupも期限整理しない。Groupが終了しても子の保持状態を変更せず、期限整理で保持対象の子とGroupの関係を失わせない。既存のCleanup未確認、手動回復必要、Process再起動必要、Effect不明はCoordinatorが汎用の未解決保持状態へ写す。メタデータ化だけで従来の保持条件を失わせない。保持状態はRecoveryの実行許可ではない。

旧永続データの移行はフロントAIの別作業とする。EIへ旧Reader・互換fallback・自動変換を追加せず、旧形式を含む履歴と未知の残存物は保全停止する。旧形式検出では新履歴・pendingを出版しない。実装・限定試験は新品fixtureで検証し、過去保持物を操作しない。

### 実装配置

```text
src/
├─ index.ts
├─ record/
│  ├─ validation.ts
│  ├─ operations.ts
│  ├─ types.ts
│  ├─ execution.ts
│  ├─ group.ts
│  ├─ query.ts
│  └─ summary.ts
└─ storage/
   ├─ store.ts
   └─ lock.ts
```

公開入口はRootの`index.ts`だけとする。Evaluation／改善提案／Task専用Factory／Repository検証再包装を別名で温存しない。既存機能の撤去と利用側の移行は、Source移動だけで完成と表示しない。

成果物種別: Architecture詳細設計
詳細設計領域: execution-intelligence
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | 記録の参照・検索・欠測を保つ事実集計。評価候補は現EIから撤去済みで、上位義務を免除せず未実装として保持する | Partial |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | EIの日時は実行観測値に限定。旧鮮度分類は退役し、時間的出所・現在意図の既存Ownerと未評価義務を維持する | Partial |
| [ARCH-000018](../../Definitions/ARCH-000018/architecture_definition.md) | 入力検査・同一性・競合・一回終了遷移・保存不明を具体化。全Filesystem Effect 0とSystem／UATの未評価範囲は残る | Partial |

Taskの状態・採否・Recovery判断はCoordinator／Domain Modelが所有する。EIの手動回復表示や記録IDは保存失敗の処置参照であり、TaskやContainerを操作するAuthorityではない。

## 1. Component Model

| Source | 所有する処理 | 所有しない処理 |
|---|---|---|
| record/types.ts | 公開値契約と内部記録集合 | Runtime処理 |
| record/validation.ts | 入力固定、ID・日時・構造・観測・状態相関の検査 | 遷移、Filesystem、Lock |
| record/operations.ts | create／complete・冪等・競合、Group参照、保持対象の変更 | 時計取得、保存、Lock取得 |
| record/execution.ts・group.ts | 用途別の公開記録入口 | 独立Store、AI実行 |
| record/query.ts・summary.ts | 条件検索、ページ、欠測・単位を分けた集計 | 状態更新、品質採用 |
| storage/store.ts | v3 Row、JSONL、実体・上限、fresh読取り、保存確認、失敗・回収結果 | Task知識、モデル規則の再実装 |
| storage/lock.ts | 固定Lock名・Identityの共通Lock接続 | 独自回復、Directory作成 |

依存はvalidation→types、operations→validation／types、storage→validation／operations／types、公開記録入口→validation／storage、query→validation／storage、summary→query／typesとする。検査から保存への逆参照、循環依存、Manager／Registry／汎用Runnerは作らない。

## 2. Interface Model

| 操作 | 入力・返却の中心 |
|---|---|
| createExecution／completeExecution | StoreOptions、ExecutionCreateInput／ExecutionCompleteInput、WriteResult |
| createGroup／completeGroup | StoreOptions、GroupCreateInput／GroupCompleteInput、WriteResult |
| getExecution／getGroup | StoreOptionsとID、ReadResultの記録又はnull |
| listExecutions／listGroups | StoreOptionsとQuery、ReadResultの指定ページと全該当件数 |
| summarizeExecutions | StoreOptionsとExecutionQuery、ReadResultのExecutionSummary |

ReadResultのblockedは、記録不存在や空集合ではない。WriteResultはstatus、effectState、effectIssued、effectStateUnknown、cleanupConfirmed、同じrecordIdと残存参照を組合せて読む。no_effectは履歴出版前の拒否を表し、Lock等の一時Filesystem操作が一切なかったという意味ではない。

## 3. Data Flow

呼出し側の観測→入力固定→Store確認→共通Lock→fresh履歴→記録遷移・Group参照→保持対象整理→v3 JSONL→pending／fsync／確認→rename／確認→終了処置→結果とする。

検索は入力固定・Query検査→Store観測→完全履歴の検査→条件抽出→指定ページ、又は全抽出対象の集計とする。読取りによって記録や保存先を作らない。

## 4. State Model

Execution／Groupはopen又はclosedで、openのcompletionはnull。completeは既存IDへ一度適用し、同内容再送以外の終了書換えを拒否する。Groupの終了と子の終了は独立である。

結果のcompleted／failed／blocked／cancelled／unknown、値のobserved／not_observed／not_applicable、保存処理の結果は別軸とする。openやunknownを自動失敗・成功へ変換しない。

## 5. Sequence

1. 旧形式・未知残存をLock／pending取得前にも拒否する。
2. 共通Lock取得後に履歴を読み直す。遷移・冪等・Group参照・保持判定は、このfresh集合へ同じ排他区間で適用する。
3. 一回の現在時刻と保持設定を用い、未完了・未解決と参照Groupを保護する。当該操作で作成・終了した対象はその出版に残す。
4. 固定pendingをwx取得し、書込み・fsync・元実体の読戻し後に同じ履歴名へrenameする。出版後も内容と実体を確認する。
5. 今回の元pendingとLockだけを終了処置する。不明や置換があれば保全し、同じ記録IDで結果を返す。

記録規則の別File化を理由に、2の判定をLock前へ移さない。旧形式の先行拒否と、取得後の競合検査は異なる保証なので併存させる。

## 6. Failure／Recovery

| 条件 | 処置 |
|---|---|
| 入力不正、同ID異内容、開始欠測、未知／終了Group | 記録更新を拒否。未知対象を補完しない |
| Lock・pending・未知Fileが残存 | 空Storeやstaleと推定せず保全停止 |
| 旧形式・混在・破損・重複・Group参照欠落 | Store全体を拒否し、行を読み飛ばさない |
| 出版試行後の例外・読戻し不明 | 未記録と断定せず、同じIDの保存不明を返す |
| 保存成立後の解放不明 | 保存事実と回収未確認を両方保持する |
| 元Root／pendingの置換、close不明 | 別実体を削除しない。自分の残存だけを参照へ保持 |
| 診断・EI保存の拒否 | 上位の必須Recovery通知とは別。AIの新しい停止条件にしない |

EIはPIDや時間からLockを奪取せず、自動回復・保存不明の自動再送を追加しない。保存先準備のDM境界失敗はCoordinatorが元Effect・元回復参照と別のEI記録IDを保持する。

## 7. Deployment

Node.jsのライブラリであり、独立Process・HTTP Serverは持たない。Storeは上位が確定・準備した既存Directory。CRDDのRepository所在・Git除外・保持設定はCoordinatorがDM／VCの既存Ownerを利用して渡す。EI自体はRepository、設定File、OSユーザーを探索しない。

## 8. Observability

検索・集計は取得済み0、欠測、非該当を別件数で返す。成功率はcompleted／failed／blocked／cancelledを分母とし、open／unknownを除外する。経過時間とProvider実測時間、金額／Credit、単位、reported／estimatedを分ける。日時・設定値から実測や因果を推定しない。

## 9. Security Boundary

任意メタデータの情報分類・Storeアクセス許可は利用側が所有する。構造検査で未知Secret不存在を証明しない。EIはPrompt・応答本文・Credential・任意環境全体を専用入力として要求しない。

Storeは非リンク実体・通常File・単一Link・32MiB／10,000行上限を検査する。確認後の非協調Processによる差替えを原子的に防ぐ保証は主張しない。共通Lockの単一Host・協調Process前提を継承する。

## 10. 実行知の共通観測と保存契約

保存形式はexecution-intelligence/history/v3のJSONLで、一行はExecution又はGroupの現在記録である。新規はopen、終了保存で同じIDをclosedへ置換する。終了済み内容の変更と、履歴全体を永久保存することは別である。

保持日数はStoreOptionsの必須値。CRDDではCoordinatorがDMから既定30日を含む設定を取得する。EIへ既定値・Git設定Reader・旧形式Readerを追加しない。古い履歴の不存在から過去実行なしを推定しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 値検査・遷移・物理保存のOwnerを分ける | [§1](#1-component-model) |
| Interface Model | Required | 明示Storeと9操作の入出力・結果を固定する | [§2](#2-interface-model) |
| Data Flow | Required | 入力から記録・検索・集計までを追跡する | [§3](#3-data-flow) |
| State Model | Required | open／closed、実行結果、保存結果を分ける | [§4](#4-state-model) |
| Sequence | Required | fresh履歴・排他・出版・終了の順序を固定する | [§5](#5-sequence) |
| Failure／Recovery | Required | 出版前拒否・保存不明・回収不明を区別する | [§6](#6-failurerecovery) |
| Deployment | Required | 呼出し元と同Hostの複数Writer・Filesystem境界を固定する | [§7](#7-deployment) |
| Observability | Required | 同じID・欠測・単位・元回復参照を保持する | [§8](#8-observability) |
| Security Boundary | Required | 構造検査と情報分類・実行許可を分ける | [§9](#9-security-boundary) |
| Implementation Structure | Required | 差分・共通契約・状態・資源Ownerを分ける | [構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 同じLock取得後のfresh履歴へ遷移・保持を適用する | [§5](#5-sequence) |
| Timing | PASS | 後処理込み経過時間とProvider実時間・欠測を分ける | [計測](#計測と状態) |
| Resource Lifecycle | PASS | 元descriptor・pending・Lockの終了又は同じIDの未解決を返す | [§6](#6-failurerecovery) |
| External Boundary | PASS | 入力・保存・結果搬送と上位の実行判断を分ける | [§2](#2-interface-model) |
| State／Consistency | PASS | open／closed、同内容再送、異内容競合、Group参照を区別する | [§4](#4-state-model) |
| Failure／Recovery | PASS | 保存不明を未実施へ戻さず、未知残存を自動回収しない | [§6](#6-failurerecovery) |
| Observability | PASS | 記録ID・元参照・欠測・単位・集計分母を保持する | [§8](#8-observability) |
| Security／Trust | PASS | 情報分類と認可は呼出し側が所有し、構造検査をSecret不存在証明にしない | [§9](#9-security-boundary) |

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済み・正式義務全体の成立を意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、又は必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `execution-intelligence.record-read` | Interface／Flow | Query／Summary | exact条件と欠測を保つ結果 | 別対象混入、欠測補完、ページだけの集計 | UT／IT | Direct Boundary | ID、件数、観測状態、単位 | 読取りによる書込み0 | 外部アプリと表示の理解可能性 |
| `execution-intelligence.state-projection` | Flow／Consistency | Coordinator Activity | 明示した最終Task判定だけを投影 | AI成功からTask成功を推測 | UT／IT | Adjacent 1 Block | metadata、Task結果、不明理由 | EI記録不変、Task変更0 | 上位義務全体・UAT。旧EI専用投影は退役 |
| `execution-intelligence.temporal-provenance` | Flow／Consistency | 上位の時間的出所 | 現在意図と履歴を区別 | 過去を現在へ昇格 | UT／IT | Adjacent 1 Block | 対象改訂・観測時点・分類 | 過去根拠不変 | 現EIは実装しない。ARCH-000016既存Ownerで別評価 |
| `execution-intelligence.evaluation-candidate` | Interface／Transition | 上位評価候補 | 事実と未採用候補を区別 | 候補を事実・採用判断へ昇格 | UT／IT | Adjacent 1 Block | 事実、候補、根拠 | 採用Effect 0 | ARCH-000007上位義務は未実装。新Queryで代替しない |
| `execution-intelligence.record-publication` | Sequence／Lifecycle Ownership | 開始・終了保存 | 同じIDの一回遷移・冪等 | 異内容上書き、部分出版、元参照欠落 | IT／ST | Related 2 Blocks | ID、保存段階、Effect、回収 | 元Lock・pending・descriptorの終了又は同じ未解決参照 | System／UATと全Filesystem Effect 0の正式義務 |

## 現行実装との照合

[基準版監査](02_Current_Implementation_Reality_Audit.md)は当時のCapability・Evidenceの資料で、現方式の成立根拠ではない。現候補の限定試験・独立レビュー・未実施範囲は[変更計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#ei-execution-group-realignment)で追跡する。全体回帰、旧データ移行、実AI／Docker、System／UAT、Releaseの完了は主張しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | ExecutionとGroupの値・遷移条件が異なる | 記録種別と各検査 | CRDD用途分岐を持たない | 新種別は検査・遷移・Readerへ波及 | execution-intelligence.record-publication |
| Common Contract | Required | 記録・観測・結果を全操作で共有する | typesとvalidation | 欠測・単位・同一性を維持 | 契約変更は全Producer／Readerへ波及 | execution-intelligence.record-read |
| Creation／Selection | Required | createとcompleteが記録を構築する | execution／groupとoperations | AIやStoreを生成せず、既存IDへ一回遷移する | 冪等・競合と開始欠測を再確認 | execution-intelligence.record-publication |
| State-dependent Behavior | Required | open／closedと保存段階で振る舞いが異なる | operationsとstorage結果 | 同内容再送以外の終了書換えを拒否 | 状態変更は保持・回収へ波及 | execution-intelligence.record-publication |
| Composition／Recursion | Required | Groupと子、Queryと集計を合成する | Group参照とSummary | Group終了は子を終了させず、再帰Groupは作らない | 参照欠落・欠測・分母を再確認 | execution-intelligence.record-read |
| Lifecycle Ownership | Required | Lock・pending・descriptorを取得する | storageと共通Lock | 元実体だけを終了処置する | 失敗時は同じ記録IDと残存を保持 | execution-intelligence.record-publication |
| External Boundary | Required | Filesystem・複数Writer・呼出し側と接続する | 明示Storeと完成API | 実行許可・Task状態・旧移行を所有しない | 境界変更はConsumerと保存異常へ波及 | execution-intelligence.record-publication |

値検査・記録操作・物理保存を別Ownerにし、共有のRecordsだけを排他区間内で受け渡す。再帰Group、追加Store、空Hookや用途別保存Runnerは作らない。二つ目の同責務の具象実装は現時点で存在しない。追加時は共通契約への昇格又は非昇格理由を評価する。

## 上流UI／SPEC Detailとの関係

PRT-000005.spec-000008、PRT-000017.spec-000022、PRT-000020.spec-000030の安定IDと元の検証義務を維持する。現EIが実装しない評価・時系列意図の義務は部分対応又は未実装であり、全面Coveredや正式QA Passへ昇格しない。

OPEN: ARCH-000007の評価候補、ARCH-000016の時間的出所、System／UATと全Filesystem Effect 0の正式義務は本候補の限定成功から成立としない。Architecture Readyは主張しない。

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
