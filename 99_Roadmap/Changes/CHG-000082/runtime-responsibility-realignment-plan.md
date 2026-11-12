# 基盤機能中心のRuntime責務再編計画

## 内部データ量の35群是正とAM表示名の保留 — 2026-11-12

状態: AM表示名一群を除く34群の実装・利用側追従・限定回帰・独立再レビューを完了。人間が下段棚卸し表1の35群を採用し、その後AM User表示名の上限撤去一群を明示保留したため、今回の完了対象は残る34群とした。表2の判断対象23群、表3の保留入力／ページング、Transport／Process・通信・実行予算・Identity／Secretの文法は変更していない。追加のStore・Registry・Framework・互換alias・切詰め・自動再試行は導入していない。

着手前に棚卸し表の各群を実Source・利用側・既存検証へ対応付け、型・閉Schema・非空・不正参照・正規Path／Root／Link・ID／Hash・認可・Lock／Revision・通知／取消／Cleanupを非退行条件として確認した。Owner別Source／Consumer追従と専門観点の独立レビューを行い、規範・準拠基準・Releaseを変更しないため全体準拠監査は実施しない。全体回帰・実AI・Docker・過去保持物は対象外。

| 棚卸し表1の処置単位 | 群数 | 実施Owner／確認先 |
|---|---:|---|
| Co内部要求・結果・Advice・診断・ToolとExecutor計測 | 13 | Co／Executorの既存Source・局所／模擬試験 |
| publicOrigin Reader・MCP出力・WB検証Inventory／診断 | 4 | WB／MCPと配布入口の既存Consumer |
| VC Path／Git管理File／ignore／Worktree探索／Cursor／Merge／User | 8 | VCのReader・完成操作・実Git限定試験 |
| DM宣言／検索／活動結果／保存Path／Workspace表示名 | 5 | DMの入力・保存Decoder・公開投影 |
| EI捕捉／本文・Metadata／Query | 3 | 既存ancestor循環拒否を維持した記録・保存・Query |
| Checker展開範囲の全量報告 | 1 | scoped検査と報告型・出力Consumer |
| AM User表示名 | 1 | **人間判断で保留。今回変更しない** |

DM／EI／AMの一括Source処理は環境の安全審査により途中停止した。適用済みはVC7・DM5・EI2 Source、未適用はAM表示名3 Sourceであった。拒否された一括処理を迂回／再試行せず現物を読取り確認し、人間がAM保留を選択した。適用済みの許可範囲は試験・文書・形式・限定回帰で閉じ、AMの登録／保存Reader／初期化は変更しない。EIのdepth12は表1の対象であり、既存branch-local ancestors Setによる直接循環拒否があることを確認して量制限のみ撤去する。表2のDM codec深度32は別契約として不変更。

Checkerは展開済み全Pathの報告へ接続し、切詰め専用fieldを撤去した。fullの`.`表現とヘッダー解析窓は維持した。既存ITの範囲展開104 File一件、出力Unit三件と文書変換Unit一件は成功し、今回生成したRepository-local試験Rootは回収した。

利用側の限定回帰で、配布MCP入口に旧Filesystem観測Portの容量引数が残っていたため、現行の一引数契約へ追従した。また検証記録の同じ正常結果投影にReviewer所見64件の取り残しと、現ProducerのSourceScope v3を欠測化するv2限定Readerがあった。非負安全整数と既知値のみの扱いを維持して所見65件以降も保持し、SourceScopeは既存v2・現行v3だけを投影、未知はnullのままとした。観測本体・Hash計算・実行許可の判定は変更していない。

| 実施した限定確認 | 観測結果・限界 |
|---|---|
| Co／Executorの担当回帰 | 既存11 Fileの拡充と局所宣言評価。Co六Suite44件、記録16件、計測10件、選択通知1件、Executor summary2件・counter1件が成功。旧Prompt／Path／Advice／投影・回復ID・Timeline・LCOV／Source Reader・説明／summary・件数を対照。重複した後続再実行は合算しない |
| DM／EIの担当回帰 | 六File37件とTopic検索対照1件が成功。宣言129・長表示名／Path・検索／Cursor、活動10,001source／singleTasksと51event、EI50,001ノード・深16・長本文／65Metadataの保存→再読→Query、循環拒否／非循環共有を確認。ID／Relation／ページング条件は維持 |
| VCの担当回帰 | 四File41件中39件成功、既存Host権限制約の二件は同じケースを許可付きで再実行し双方成功。大きいGit管理File・exclude出版、100,001列挙・長いPath／Cursor・Git表示名・Merge本文を実Gitと局所対照で区別 |
| WB／MCPの担当回帰 | 選択した35ケースは初回32成功、診断の旧1,001件拒否期待一件を現契約へ修正後に同File15件成功、loopback接続権限の二件は同じケースの必要権限再実行で成功。単一runで全35成功とは表示しない。保存設定Reader二件も必要権限で成功。Inventory257／260・通知17件／4KiB超・MCP大きい正常出力を確認 |
| 静的確認 | 直接利用側の型12設定、担当単位の形式・Lint、差分確認が成功。試験台帳は407 Fileでvalid、実行計画のみの確認でtestExecution not_started／Effect false。既存Info推奨はerror／warningと区別する。新規試験File／正式QA itemは追加せず、既存試験・Owner設計・検証定義を更新 |

独立レビューは担当を交換し、Co／Executor／Checker、VC／DM／EI、WB／MCP／配布入口の固定候補を確認した。Sourceの必須指摘はVC Readerの直接EOF観測の消失一件、文書はCo Header二箇所・Executor旧byte上限句・MCP旧容量エラー表行・Checker件数表記であった。全結果を統合して是正方針を各確認者へ提示し、期待size全読取り後の一byte EOF確認と既存close／前後実体照合を維持する最小是正を適用した。容量上限は復活させていない。

是正後のReader Suite21件は正常全量／EOF、期待size後の余分byte、短読、close、各出版失敗、二Process競合、Main／Linkedまで成功し、別確認者の独立再実行でも21件すべて成功した。別の独立確認はCo／Executor等63件、DM／EI／Topic38件、VCの通常39件と既報のHost権限二件、WB／MCPの設定Reader2・Inventory1・診断／結果18件を確認した。担当実行と独立実行、部分再実行の重複は合算しない。修正版の独立再レビューは必須残指摘0。

今回の試験Processは終了し、自己生成Fixtureは既存hook又は親のexact Root清掃で回収済み。11月7日由来のVC残存四Directoryは過去保持物のため触っていない。新規AM表示名変更・データ移行、実AI・Docker・全体回帰・過去保持物の操作は行っていない。Node／OSのメモリ・Stack等の表現限界や致命的OOM時の結果返却まで保証するものではない。先行の実E2Eを今回の変更後の実測へ読み替えず、全ガード撤去済み・全体QA Pass・Release完了とは表示しない。

人間のコミット・プッシュ指示に先立つ追加確認では、`40_Develop`／`template/tools`の固定差分Hash `11f2aa55fa2532b7f38e3b8d7af988c0b0f25bf7ae1b174bc85e78f068c7bea5`が前回独立レビュー候補と一致した。AM表示名128／256の保持、EOF確認・SourceScopeの既知値・旧Readerの本番参照不存在・保留境界を別の確認者が再確認し、必須追加指摘は0件。局所五File24件と台帳407 File validを追加確認した。台帳確認はtestExecution not_startedであり、全体回帰を開始した記録ではない。Source・試験の新たな変更はなく、記録の現在表記だけを更新した。対象は既存作業ブランチへの反映であり、main統合・Release判断ではない。

## 容量・件数・取得範囲ガードの全Package棚卸し — 2026-11-12

状態: 読取り調査完了。以下は上段34群是正より前の固定改訂版に対する抽出一覧であり、処置の現在値は上段を優先する。人間の「全部抽出」の指示に基づく調査時点の現存一覧であり、この棚卸し自体は各制約の撤去を採用した記録ではない。調査では製品Source・試験を変更せず、実AI・Docker・全体回帰・過去保持物を操作していない。

### 対象と確認方法

- 基準HEAD: `d8b666d251f534df127433fc30e0cdce1706fc06`。未コミット変更を含む`40_Develop`／`template/tools`の`git diff --binary`のSHA-256は`f60d6d82f6542b7c3d9203ccbbb0d486cac9403336e2b689ef833fe64e16175a`。未追跡Fileも走査へ含むが、このGit差分Hashの対象には含まれない。本節の追加前後で製品差分は不変更。
- 母集団: 全13Packageと`template/tools`の本番Source・bin・scripts・内部JSON／Schema等566 File。`tests`／依存Package／package-lock／coverage／配布binaryは走査母集団から除外した。必要な既存試験はConsumer確認のため読取りのみとする。
- Package別File数: AM34、AD32、Checker35、Coordinator94、DI42、DM140、EI13、Executor18、Lock6、MCP24、VC24、Visual Preview12、WB82、template10。担当者の実行コード母集団はCo／Executor／AD133、WB／MCP97、DM／VC／EI／AM199であり、JSON等の包含差を全体数と混同しない。Co／Executor／ADはroot JSON11 Fileも追加照合し144 File全体に対応する。
- 数値の直接比較だけでなく、名前付き定数・Helperへ渡す上限、固定Buffer、深さ／ノード数、Schemaの最大値、slice等による切詰め、Query／ページ取得、Process出力制限の定義と利用先を走査した。該当する処理を読んで拒否・欠測・切詰め・予算・形式の意味を分類した。全Fileの全行を手作業で読んだ、静的解析で不存在を証明した、又は全体回帰済みという主張ではない。
- パッケージ別読取りを分担し、親が直接経路・Policy同値・固定Fixtureと任意量の区別を統合した。ID／Hash／enum／固定field数／非空／安全整数／割合／OSのPath成分等は容量ガードと区別し、同族をまとめて下段へ示す。既に撤去済みの制限を再計上しない。

### 1. 任意量による拒否・欠測・切詰めとして是正候補にする残存

以下のPathは`40_Develop/`基準。行番号は棚卸し時点であり、同じ行の複数制限を一行へまとめている。容量だけを撤去しても、同じデータの前後段・保存・再読取り・利用側を一体で追従する必要がある。

| 対象 | 所在 | 現存値・作用 | 最小の処置方針 |
|---|---|---|---|
| 単発Taskの内部要求 | `coordinator/src/task/requests.ts:171,185` | AllowedPath1,024件、Prompt32,000文字で拒否。HTTP本文のbyte制限ではなく内部公開API | 量比較だけ撤去。mode・Context固定・Path文法・重複・主体／認可は維持 |
| Advice公開前DTO | 同`:1141,1156,1159,1167` | 4区分各100項目、本文32,000文字、参照100件／各512文字。ADが受理した結果をnull化 | 同じ結果の全量再捕捉へ追従。非空・参照制御文字・閉形式・元値分離は維持 |
| 開発実行Task受付 | `coordinator/src/execution/diagnostics.ts:1271` | 正規要求のJSON全体65,536byteでadmission／reserve拒否 | byte比較を撤去。固定2Task・選定／分類・Hash・Authorityは維持 |
| 外側の完了結果再捕捉 | `coordinator/src/execution/controller.ts:4238` | `dockerRecoveryIds`128件。超過時に元結果でなくcontrol側ID集合へfallbackし得る | 全量捕捉へ。129件超と末尾ID保全を反証 |
| 検証結果の回復ID記録 | `coordinator/scripts/verification-result-record.ts:269` | plural16件。17件で集合が空・complete falseになる | 件数上限のみ撤去。正規ID・不正時complete false・正規分保持は維持 |
| Advice準備の前後段 | `coordinator/src/execution/preparation.ts:835,1261,2595-2601,2690-2715,2932` | providerPrompt512KiB、入力Prompt16KiB、投影1項目64KiB／合計256KiB／64項目、参照512byte | 同じ準備契約の全量化と説明fieldを一括追従。Secret・Hash・参照認可・一回consumeは維持 |
| 実行状態の診断Timeline | `coordinator/src/execution/diagnostics.ts:249` | 状態interval31件でmeasurementComplete false | 同状態skip・時刻／状態文法を残し取得量だけ撤去 |
| 計測Tool設定Reader | `coordinator/scripts/measure-development-providers.ts:344` | 通常設定File128KiBで拒否 | 通常File・JSON／実体検査を残し容量拒否撤去 |
| Coverage／追跡情報Reader | `coordinator/scripts/coverage.ts:9,404`、`scripts/check-runtime-traceability.ts:12,57` | LCOV32MiB、Source／台帳8MiBで解析前拒否 | 内容文法・所有範囲は維持。子Process側出力上限とは分離 |
| 追跡ToolのRepository相対Path | `coordinator/scripts/runtime-traceability.ts:449` | 512文字で検証不能 | 非空・Path文法／所属を残し総長だけ撤去 |
| 選定診断Reader | `coordinator/scripts/task-real-provider-contract.ts:549` | selectionReason16,384文字で診断不正 | 固定field・選定相関・非空を残し自由説明の量拒否だけ撤去 |
| Executor計測用summary | `executor/scripts/task-summary-observation.ts:125` | 2,048byteでsummary_text_rejected | Secret・制御文字・Path非開示を維持して量条件のみ撤去候補 |
| Executor実E2E診断の再捕捉 | `executor/scripts/verify-provider-real.ts:402,588` | Command／File変更開始件数4,096。4,097通知をADが受理してもreviewToolObservationを欠測化／結果Reader拒否 | 非負安全整数・exact fieldを残して診断件数quotaだけ撤去候補 |
| publicOrigin保存設定Reader | `workbench-server/src/server/connection/configuration.ts:100,112`、`mcp-server/src/transport/configuration.ts:98,110` | File16KiB、固定Buffer16,385byte。通常設定の再取得を拒否 | 両Reader一体で上限と固定Buffer撤去。Schema・実体・読取り後照合を維持 |
| MCP管理結果の出力 | `mcp-server/src/tools/access-management.ts:168-174` | 完成結果16MiBでmanagement_response_too_largeへ置換 | 出力の量だけの失敗と理由を撤去候補。MCP受信上限とは別 |
| Docker検証Inventory | `workbench-server/scripts/ai-verification-http.ts:484,611` | Container／Network各256件を観測不成立化 | 集合量だけ撤去。ID・Hash・一意性は維持 |
| Lifecycle診断Collector | `workbench-server/scripts/workspace-task-diagnostic.ts:118-123` | 1通知4,096byte・合計16件でoverflow | 内部診断取得量として撤去候補。Process全体の出力枠と分離 |
| VC共通Path | `version-control/src/repository/layout.ts:10,52`、`repository/files.ts:88` | Root／相対Path各4,096文字。複数VC操作を発行前拒否 | Node／Windows共通の必須上限ではない。Path文法・Root・Link検査を維持 |
| VC Git管理FileReader | `version-control/src/repository/layout.ts:139-145,514-556,637,679,848,1073,1198` | 制御File4KiB、config1MiB、exclude128KiB、packed-refs4MiB。事前stat・Buffer・事後長さで拒否 | Reader上限引数・定数・全Consumerを一体撤去候補。OID／Ref／Git配置検査は維持 |
| VC Revision用の別Reader | `version-control/src/repository/revision.ts:29-30,131-139,214,244,260` | HEAD／Ref4KiB、packed-refs4MiB | 共通Readerだけでなくこちらも追従し、同じRepositoryの後段再拒否を防ぐ |
| VC local ignore | `version-control/src/repository/ignore.ts:100,258,387,423,513` | 本文128KiB、entry1,024文字。解析・既存取得・更新後読戻しでも拒否 | 全経路を同時追従。Path文法・安全な出版は維持 |
| Worktree削除前の列挙 | `version-control/src/worktree/crud.ts:355` | 入れ子Repository探索100,000項目で停止 | 件数だけで止めず、入れ子Git／Link／対象Rootの拒否は維持 |
| VC Tree Cursor | `version-control/src/repository/files.ts:123` | Cursor8,192文字 | 閉形式・Directory結合を残し総長を分離 |
| VC Merge本文 | `version-control/src/repository/merge.ts:37` | Commit message4,096文字 | 非空・NUL等を維持して自由本文の上限撤去候補 |
| Git User設定 | `version-control/src/repository/user.ts:59` | name／email512文字で設定をunknown化 | 自由nameとメール形式を区別。量だけで既知値を失わない形へ |
| DM宣言集合・表示名 | `domain-model/src/configuration/validate-declarations.ts:88,142` | ID集合128件、displayName160文字 | ID文法・一意性を残し集合量／表示名量だけ分離 |
| DM Topic／Meeting検索 | `domain-model/src/activity/operations.ts:71,275` | query／owner／relation128文字、Cursor1,024文字 | 自由検索文／表示名と正規relation IDを分離し、Query結合を維持 |
| DM活動結果Decoder | `domain-model/src/state/activity.ts:261,333,467` | singleTasks10,000、取得済events50、sources10,000件でnull化 | ページ取得の選択量と、取得済み結果を再拒否する量制限を分離 |
| DM保存Path | `domain-model/src/attempt/validation.ts:989` | gitSourcePath／internalSourcePath4,096文字 | 保存Identityの正規Path条件を残し全長quotaを分離 |
| DM Workspace表示名 | `domain-model/src/workspace/validation.ts:436` | 120コードポイント | 自由表示名の上限撤去候補。WB入力側との同時追従が必要 |
| EI共通入力捕捉 | `execution-intelligence/src/record/validation.ts:22,25` | 50,000ノード、深度12、全文字列8,192文字で記録／Query／履歴を拒否 | ノード／文字量の撤去候補。深度は循環の直接検出と切り分ける |
| EI本文・Metadata | 同`:89,119,123` | text8,192文字、Metadata64field、key128文字 | スカラー型・閉Schema・危険key等は維持し量条件だけ分離 |
| EI Query | `execution-intelligence/src/record/query.ts:45,58` | 検索値8,192文字、Metadata条件64項目 | 保存側とQuery側を一体追従 |
| AM User表示名 | `access-management/src/user/crud.ts:53,56`、`storage/parse.ts:139`、`initialization/execution.ts:103,380` | 256 UTF-16／128コードポイント。登録・改名・保存Reader・初期化で拒否 | 同一表示名の全Owner／Consumerを一括追従。UsernameとIDを混ぜない |
| Checkerの報告範囲表示 | `checker/src/repository/document.ts:997-1000` | scoped報告のexpanded_scopeを100Fileへ切詰め | 実検査対象全体を報告するなら切詰め撤去候補。全検査そのものが100件で打切りとは表示しない |

### 2. 追加の設計判断・正本照合が必要な残存

既存に存在するだけでは必要性の証明にならない。以下は無条件維持でも無条件撤去でもなく、何を守るかを照合する対象である。

| 対象・所在 | 現存値 | 分けるべき意味／影響 |
|---|---|---|
| Co `task/requests.ts:525-538`、WB `server/start.ts:232` | Session要求Map／共有AI Session各100 | 同時実行排他と、終了本文の保持・eviction・後観測を分離。上限だけ外すと保持Lifecycleの意味を変える |
| Co `execution/authority.ts:66,182,1218,1332,1525,1870,1929,1994` | Bundle／Trust設定4KiB、Grant64、registry／canonical128KiB | 通常設定の容量だが認可のReader／Writer全経路を同時照合。Hash・資格・期限・許可Originを緩めない |
| Co `preparation.ts:222,411,459`／`authority.ts:1715,1723` | Origin16件、各256文字 | 正規Origin文法・許可集合と任意集合量を分離 |
| Co `authority.ts:6851,6963,6992-6999` | Root観測entity等2,049 | 旧保護観測モデルの全件性とquotaを分離。古い保護モデル自体の必要性も確認 |
| Co `authority.ts:7151,7225`／`operation.ts:6325,6375`、AM `repository/register.ts:42,99` | Root4,096byte／4,096文字／32,768 UTF-16 | OSの正規Pathと独自全長Policy。全OSに同じ値が必須とはしない |
| 共通Lock `lock/src/operations.ts:17,170`、Co `execution/lease.ts:830,844,865` | Lock record2KiB、Reader Buffer2,049 | 正規Writerが生成できる最大形式と照合。一般データ容量とは別。世代／File Identity／exact bytes検査は維持 |
| Executor `lifecycle/attempt.ts:2035,2039,2054` | argv256、環境64、Bootstrap JSON128KiB | stdin Promptとは別の固定CLI構成契約。前回明示対象外。混入防止と任意量を分離して再評価可能 |
| Executor `scripts/verify-provider-real.ts:791,810` | eventFile100、event／commit各32KiB | 今回物の回収前検査。超過時は削除せず保持。固定3桁file名・連番・Hash／実体と一体で評価 |
| Co `scripts/verification-result-record.ts:299` | results／scenarios各12件 | 実在する固定Scenario集合の完全性か便宜上の上限かを確認。超過は空＋Complete false |
| DM `state/codec.ts:28` | JSON深度32 | 現状は循環も最終的に深度で拒否。撤去時は直接循環検出を用い、単純削除しない |
| DM `attempt/validation.ts:1815` | childIdentities8件 | Host子Identityの固定種類数なのか、任意件数なのかを確認 |
| DM `state/activity.ts:65,79,328,432,443` | Cursor1,024、日時64、reason512 | Cursor／正規時刻文法・Query／Source結合・固定reasonと自由説明を分離 |
| VC `layout.ts:151`／`revision.ts:32,476`／`reference.ts:44`／`working-directory.ts:251` | layout／revisionのRef検査は`refs/heads/`・`refs/tags/`後のsuffix1,024文字。referenceは全Ref、selector／比較基準は全文1,024文字 | Git文法・成分制約と独自総長を分離。Git自体の必須上限と断定しない |
| VC `repository/merge.ts:276,282` | MERGE_HEAD256byte／257byte Buffer | 40／64hex一行の単一Mergeのみを扱う固定構造。一般本文Readerとは異なる |
| DM `artifact/release.ts:553`、Checker `repository/document.ts:197,218,533,573` | README20行、ヘッダー40／16行のみ解析 | 構文上ヘッダー位置を限定する契約か、単なる便宜上の読取り範囲かを確認 |
| DM `plain-data/secret-validation.ts:16-38,139` | key128・値4,096・引数1,024等 | 拒否容量ではなくSecret検出の正規表現範囲。変更は検出漏れ・誤検出へ波及するため別Security観点が必要 |
| DI `cleanup/execute.ts:443` | 回復config同prefix96件 | 旧／残存configが蓄積すると新しい明示回収を拒否。自動削除は追加せず容量の必要性を確認 |
| DI `cleanup/container.ts:206,232,251` | 期待argv64、Command64、Mount64 | 技術構成の閉形式と任意件数の混在。既存固定構成の数と外部要求契約を確認 |
| DI `docker-desktop/directory.ts:50,695,874` | 基点Path4,096byte、観測entry64 | 正規Path・対象実体・Lock観測と量を分離。64超は安全確認不明になるので、未知を成功へ変えて外さない |
| DI `docker-cli/trust.ts:34,193` | docker.exe256MiB | 固定CLIの信頼検査に容量が混在。通常File・所在・Hash観測と不要な量拒否の区別が必要 |
| EI `storage/store.ts:59` | retentionDays最大36,500日 | 保存件数ではなく保持／退役の運用Policy。ミリ秒安全整数限界とは別 |
| AD `codex/result.ts:56`／`provider/result.ts:943` | boolean Probe16KiB、既知警告4,096文字 | 前回明示対象外の個別解析・診断条件。Task／Advice受理条件とは別だが、任意量値が存在することは記録 |
| MCP `tools/task.ts:363,380,434,531` | 内部結果DTOの回復ID512文字・結果reason256文字 | 入力Fieldの保留とは別。Domain正規Identity／固定理由codeと自由説明をOwnerへ照合して判断 |

### 3. 保留中のHTTP／MCP／CLI入力項目・ページ取得

受信byte制限と、その内側の業務field制限は別物である。ただし前回のHTTP／MCP入力範囲の除外に含まれるため、今回これらを「是正済みのはずの新漏れ」と断定しない。今後どこまで撤去するかを同じOwnerで決める。

| 所在 | 現存値・対象 |
|---|---|
| MCP `src/tools/workspace.ts:143,150` | relatedCHG20、Selection1,000 |
| MCP `src/tools/task.ts:899,910,915,930-995` | Question8,192／Comment・Close理由1,024文字、受入条件・Objective・Dependency・Allowed／Read Path・Conflict各128件、Task／TaskInput各1,024件、Objective16,384文字 |
| WB `src/server/routes/ai.ts:197,200,204`／`client/components/ai-request-panel.tsx:249,261` | Server Prompt16,000文字、AllowedPath64件／各512文字。Browser Prompt16,000、Path欄8,192文字 |
| WB `shared/repository/validation.ts:70,89,103`／`client/components/repository-panel.tsx:201` | Stage Path・Commit Message・Remote／Branch／Revision各4,096文字、Browser Message4,096 |
| WB `shared/management/validation.ts:182-184`／`client/components/management-panel.tsx:326,375` | User表示名128コードポイント／256 UTF-16。AM正本変更時の直接Consumer |
| WB `client/components/workspace-panel.tsx:396,502,625` | Workspace表示名120文字。DM正本変更時の直接Consumer |
| MCP `request/validation.ts:74` | JSON-RPC ID128文字。本文byte上限とは別のIdentity入力契約 |
| DM `activity/operations.ts:313-315,420` | Topic／Meeting既定20・最大100件、継続Cursorあり |
| DM `workspace/command.ts:177-180` | Workspace Cursor1,024、limit最大50 |
| Co `state/observation.ts:58,65` | Repository集合10,000、limit最大50、Cursor1,024 |
| VC `repository/files.ts:224-225,248` | Tree既定50・最大100件、nextCursorあり |
| EI `record/query.ts:156-158,186` | Execution／Group一覧の省略時100件。最大quotaはなくoffset／limitあり |
| MCP `tools/execution-status.ts:79,134,144`／`workspace.ts:137`／`topic-meeting.ts:348,698` | 実行一覧1〜50・既定20、Workspace最大50、Topic／Meeting最大100 |
| WB `server/activity/observe.ts:130,238`／`server/presentation/portfolio.ts:96`／`client/components/management-panel.tsx:342`／`workspace-panel.tsx:218` | 既定20／20件ページ・次ページ導線、Workspace結果50件の検査 |

### 4. 明示的に別枠のTransport・Process・通信出力制限

以下も実在する容量ガードであり、全ガード撤去済みとは表示しない。既存の対象外合意により今回単独では緩めない。

| 所在 | 現存値・実施点 |
|---|---|
| Co `cli/options.ts:13,156,182`／`cli/command.ts:56,61` | CLI引数16件／各4,096、Task stdin128KiB |
| MCP `transport/http.ts:42,293,380,383`／`transport/stdio.ts:30,130,215,258` | HTTP本文・stdio行／待機Queue／SDK Buffer128KiB |
| WB `server/security.ts:101,111,118`／`routes/ai-selection.ts:161`／`runtime-definition.ts:40,114` | Form既定16KiB、AI設定3MiB＋16KiB、Runtime定義48MiB＋16KiB |
| WB `scripts/ai-verification-http.ts:851,89`／`ai-verification-client.ts:115` | 検証HTTP応答1MiB、子IPC入力256KiB |
| 同`:41,197,208,463` | 子stdout6MiB＋4KiB、stderr4KiB、Docker CLI出力1MiB |
| Co `scripts/task-real-provider-contract.ts:886`／`verify-task-real-providers.ts:102,373,544` | 子Process出力上限。指定値4MiB |
| Co `scripts/check-provider-home-coverage.ts:18,211`／`check-provider-authority-coverage.ts:18,161`／`check-dynamic-fake-provider-coverage.ts:18,214` | 子Coverage出力maxBuffer32MiB。LCOV内容Readerの32MiBとは別 |
| VC `git/execute.ts:14,105`／`git/read.ts:30,36,64` | 共通Git起動が呼出し元のmaxBufferを適用 |
| VC `repository/files.ts:44`／`changes.ts:38`／`worktree/crud.ts:88` | Path一覧・Patch・Worktree出力2MiB |
| VC `repository/discovery.ts:15,51,134`／`working-directory.ts:334`／`revision.ts:482` | Discovery・変更集合・Revision解決出力16MiB |
| VC `working-directory.ts:44,72,104,136,150`／`commit.ts:50,67`／`reference.ts:63`／`remote.ts:22` | Index・Stage・Commit・Ref・Remote等4MiB |
| VC `repository/user.ts:28` | Git User設定Process出力8KiB |
| DI `process/start.ts:160-168,225`／`execution/result.ts:24-25,145-147`／`execution/preparation.ts:270-275` | Process stdout既定1MiB・stderr既定256KiB、Step指定値は各最大1MiB。超過時取消・不明／失敗へ |
| DI `cleanup/resource.ts:249-260`／`cleanup/operations.ts:93,130`／`cleanup/execute.ts:200` | inspect／回復CLI出力1MiB |
| DI `cleanup/container.ts:306`／`docker-cli/trust.ts:148` | CLI maxBuffer64KiB／版観測512byte |
| DI `docker-desktop/backend.ts:46,117,207`／`engine.ts:271,349,463`／`restart-state.ts:349`／`command.ts:138-139` | Desktop・Backend等のProcess／解析出力4KiB・16KiB・64KiB |
| DI `network/provider-egress-proxy.py:36,85-87,116,123,162,222,277` | Policy JSON16KiB、CONNECT Header8KiB／64行、DNS32件、Tunnel片方向16MiB、接続待ちQueue16。通信Policyと可用性の別設計判断 |

### 5. 容量撤去と混同しない形式・Policy・実行予算

| 系統 | 具体的な残存・根拠／影響 |
|---|---|
| 同時実行／再計画 | DM `objective/request.ts:241,244`／`task/validation.ts:147`の同時実行1〜5・再計画0〜32、Co `state/validation.ts:13`／`task/lifecycle.ts:697`。Effect回数の制御 |
| Claudeの予算 | AD `claude/plan.ts:290,469,772-773`のTask硬Turn16、Advice2Turn／$0.10、`claude/result.ts:15,119`の費用相関。前段で入力件数の旧上限は撤去済み |
| 是正・試行・期限 | Co `preparation.ts:1640`のRemediation1回、`authority.ts:3730`の参照生成8try・観測10秒・Grant300秒、route検証retry3、Executor単独maximumProviderRequests1・待機820秒。各許可された実行範囲 |
| 固定Fake Profile | Co `diagnostics.ts:5274-5280,5459-5530`のstdin／stdout1MiB・stderr256KiB・結果1、期限300秒・取消5秒。合成観測で各量2倍・結果2・exit255を検査する。通常Task Promptの後段ではなくdoctorの固定negative scenario |
| 固定Fixture・閉集合 | Co診断Task2／invocations4・計8、general-task投影File1、route期待変更Path1、空配列0、summary観測calls4等。固定Scenarioが変わる場合は同時変更するが、任意結果量とは混同しない |
| Network Policy | DM `configuration/network-policy.ts:78,80`、Co `preparation.ts:1757`／`advice.ts:602,891`、WB `shared/view/validation.ts:659-661`、DI `network/policy.ts:120,140,148,242`とProxyは追加Host32・許可Host35・Host253・label63で同値。以前の維持合意があり、表示側だけ緩めない |
| 機密検査・認証 | MCP `transport/http.ts:123-124`のCredential32〜512、WB `server/credential/administration.ts:68`／`server/start.ts:354`／`client/api/connection.ts:49`の4,096、AM／Providerの固定認証形式、Secret検出の対象文法。長い自由説明とは区別。変更は漏えい／なりすまし境界へ影響 |
| ID・Hash・Ref・Pathの構文 | 通常ID128、EI ID160、MCP `tools/task.ts:1024-1025`のModel ID128、Recovery／Candidate参照512／1,024、OID40／64、decimal実体ID40桁、Grant6〜80、Docker名63、Path成分255byte、UUID・Hash等。対象を一意に識別する契約であり自由本文quotaとは別。Refのsuffix／全長1,024とRootの全長Policyは上段で再評価対象へ分離 |
| 一意性と固定事実数 | 回復義務4種、Lease取得／解放2事実、Decision選択肢2／3、同じ資源の実体候補は1件、Git fanout256・header／checksum／offset形式。Co `execution/recovery.ts:2387`のcorrelation最大5は`objective/execute.ts:579-596`が渡す同時active Operation集合に対応し、全履歴の量とは異なる。件数を緩めると別の意味になる |
| 数値の表現可能性 | MAX_SAFE_INTEGER、時刻変換の最大104,249,991日、port0〜65,535、percentage0〜100。任意の業務容量予算ではない |
| 解析・ID生成のslice | Hashの先頭16／32／40hex、Drive先頭2、構文区間、改行末尾、明示ページ選択。本文の隠れた切詰めとは別。Checker expanded_scope100だけは上段の報告量候補 |
| Visual Preview | Source／bin／browser12 Fileを走査。新たな自由本文・集合の容量拒否は見つからず、port文法・待機期限・回収retry10等の実行条件が残る |
| Checker／配布Schema | Checkerは実行Authorityの時間・回数・Credit、templateのpilot block最大2・空配列maxItems0は固定Schema。Markdown見出し1〜6、割合値域等も形式条件。ヘッダー読取り窓と報告100件は別項で再評価 |

### 結論と次の処置単位

「対応漏れはもうない」とは言えない。Source整理の局所経路だけでは、共通Reader・保存Decoder・外側の結果再捕捉・Browser入力・検証Toolへの波及を拾い切れていなかった。今後は上表を母集団に、同じデータ契約の入口→内部捕捉→保存→再読取り→結果→表示／検証を一括して是正する。

推奨順序は、(1)回復IDの情報保全と通常結果／内部Reader、(2)VCのGit管理File、(3)EI／表示名等の保存モデルと全Consumer、(4)DI／Lock／Authority／深度の必要性判断、(5)保留中のHTTP／MCP項目別制限とページング。全部を単一の容量設定Frameworkへ置換しない。深度の撤去は循環検出、LockはWriter／Reader一致、Policyは現行許可境界を確認して進める。全体回帰と実AI／Dockerの追加実行は今回の調査に含めない。

担当別の抽出結果と統合表を別の読取り確認者へ照合し、母集団WB82の列挙欠落・MCP内部結果DTOの個別項目欠落・VC Ref suffixと全長の表現差を是正した。修正版の担当範囲再確認は必須残指摘0。これは抽出表の整合確認であり、Source全体の安全性Pass・全容量制約の不要判断・製品全体完成を意味しない。Source／試験は不変更で、今回の記録更新だけを行った。

## Claude作業量・候補拒否診断・検証投影の取り残し是正 — 2026-11-12

人間の是正指示に基づき、Claude作業量の旧Path64／条件16／所見64件、候補拒否Path診断の1,000件、general-task検証投影の所見64件上限を撤去した。変更分類は前段の容量制約撤去に対する直接Consumer適合是正であり、着手前にTurn予算と入力件数、元診断と後段型、単一合成Fixture条件を区別した。新API・Wrapper・Store・自動再送は追加しない。

候補診断の1,001Path対照試験で、配列捕捉を追従しても結果診断型の1,000件検査が通知を拒否することを検出し、同じ経路の結果型も是正した。SourceはAD Claude plan、Co controller／resultと既存verify-general-taskの四File。負・小数・危険整数、閉Schema、Path相関と不明、固定一Fileの対象Path・期待Hashは維持する。Claudeの計算式と硬Turn上限16、予算超過時split_requiredは不変更。HTTPフォームとBootstrap構成の別制限も不変更。

実Source宣言を使う局所診断試験では1,001Pathの一致・末尾差・不正配列、65所見・不正数値と複数File拒否を確認した。Claudeは条件16／17件で9／10Turnの候補、旧件数超でも入力不正でなく計算予算超過の拒否となることを対照した。初期の局所試験の失敗を後段型の取り残し検出として是正し、最終のAD Task／Claude結果・Co準備／Packet／検証安全性の5 File 54件は全成功した。型検査3設定、担当形式・Lint・差分確認は成功。Lint情報通知一件は既存箇所の文字列連結推奨であり、error／warningと区別する。

固定候補の独立Source・試験・文書レビューは必須残指摘0。独立確認者は結果診断の実関数まで接続していることを再確認し、AD Task・Co診断／Packet／Codex準備・Executor Planの5 File 56件も全成功した。親54件との重複は合算しない。前段レビューで見落とされた後段上限を実Source接続試験で検出したため、局所代役だけで下位拒否の不在を推定しない確認を今回の是正根拠とする。

前段のCodex実Image・実E2E結果はその候補の証拠として保持するが、この変更後の実AI再検証へ読み替えない。今回、実AI・Docker・全体回帰・過去保持物は操作していない。

## Codex新Schemaの実Image反映とExecutor限定E2E — 2026-11-12

人間が実Docker・実AIの限定実行と、その後Docker Desktopの通常起動を明示承認した。既存CLI起動要求ではDesktop Process／Engineが現れず、その要求を終了後、インストール済みDesktopを通常起動した。再起動・修復は行っていない。Engine 29.8.1応答と稼働Container零を確認した。

変更分類は前段Schema変更の実配布物・固定Identity追従と実境界検証。既存のImage準備・固定実行物検査、Executorの単独試験入口を使用し、DIの公開IF・技術処理・許可条件は変更しない。必要なSource・利用側・品質観点の独立レビューを実施し、標準規範・準拠基準・Releaseを変更しないため全体準拠監査は行わない。全体回帰も人間の指示により未実施とする。

旧固定Imageから今回作成した停止Containerを介して公式CLI・Code Mode Host・bwrapだけを読み出し、既存prepareCodexImageで各size／Hash・Dockerfile・Schemaを検証した。抽出Containerは回収済み。既存固定ベースと`--pull=false --network=none`で新品Imageを構築し、Task primaryだけを次の実測Identityへ更新した。旧Image・Advice Image・Claude Imageは削除・変更していない。

| 対象 | 実測値 |
|---|---|
| 新Task Image | `sha256:9f585128d400a0537679df549c91917940880044588517c66943af915dec4349`、709,806,252 bytes |
| Executor Schema | `0fdac2f68b6270b604c795adcd30f48965fc46be85605d478076fccc6204388d` |
| Reviewer Schema | `673413342fcc405ed2db11553b28d97c659358717c6e8fbd16ab1cece09c1abd` |

ネットワーク・Host Mountなし、read-onlyの今回使い捨てContainerで、Image内Schema二件と公式実行物三件のHashが正本と一致することを確認した。同Containerは終了・削除済み。変更はDI assetsのprimary digestとbuild-inputsの実size／二Schema Hashのみで、版・実行物Hash・Seccomp・Network／Proxy・Dockerfileは不変更。既存runtime-assetsとExecutor planの7件、DI型・形式・Lint・差分検査は成功した。

実AIは既存Subscription認証・Codex `gpt-6.1-sol`／mediumを使用し、各一回を逐次実行した。送信は固定合成指示とsource.txtの`BASE`／`EDITED_OK`・固定差分だけであり、本体Repository本文・秘密値・過去保持物は送っていない。実AI自動再送は行わない。

| 実行ID | 内容・結果 | 結果Hash／bytes |
|---|---|---|
| `EXEC-20261112-SCHEMA-EDIT` | 編集completed、内容照合true | `a6181339d123a8e1299025bd95a66a2f1581dba986682a222c9895c05bb0ac55`／2,013 |
| `EXEC-20261112-SCHEMA-REVIEW` | レビューcompleted、内容照合true。CLI観測のCommand開始・File変更開始は各0 | `321a0590040892d5203263b524fde80c6a68ac3551d5a13a0dbc8c16da4dbf50`／819 |
| `EXEC-20261112-SCHEMA-CANCEL` | 開始後取消cancelled、`provider_operation_cancelled`、取消確認true | 結果本文なし／0 |

三件すべて親子close・Process終了・Container／Network不存在・Cleanup・Home解放・終端保存・Operation回収・fixture回収がtrue。各exact試験Rootの不存在を別途確認した。今回のビルド用Root `codex-schema-build-20261112`と準備Context `codex-task-image-7yhgD2`は、Repository-local tmp下の絶対Path・非Link・既知File集合を確認して回収し、各Root不存在を確認した。新採用Imageは保持する。終了後の稼働Containerは零、今回の抽出／確認用Containerの残存も零である。

この結果により、下段で未実施としていたCodex新SchemaのImage組込み・固定digest／bytes追従・Executor実境界Gateを閉じる。旧上限超の任意量を実Providerで試した根拠ではなく、大容量の局所Parser／Plan試験と今回の有限な実E2Eを区別する。全体回帰・Claude再E2E・上位Task全体E2Eは未実施。過去保持物は操作していない。

固定Identity差分・利用側・実測結果と終了後条件・現在投影・QAの独立読取りレビューを実施し、必須残指摘は0件。独立確認者はDocker／AIを再実行せず、親の実測と記録の対応を確認した。Source・記録は未コミットであり、Release・統合の完了を意味しない。

## Task実行・Owner Artifact・Provider結果の後段容量制約是正 — 2026-11-12

状態: 人間の是正指示に基づくSource・利用側・試験・設計の限定対応。通常Task本文／受入条件、Workbench Owner Artifactの相対Path、AI AdapterのTask／Advice結果に残った量だけの拒否を撤去した。同じデータを受けるCoordinator診断・Advice許可参照とExecutor stdinの旧上限も追従した。新しいFramework・公開API・自動分割・再送・切詰めは追加しない。

変更分類は承認済み容量制約撤去の直接Consumer適合是正。着手前に入口・準備・Packet・Provider Plan／結果・診断・Browser投影を照合した。Schema・型・非空・ID／Hash・Path／Root／Link・Secret・参照一意性・実受入条件数・所見集計相関、Authority・通知・Process終了・Cleanupは維持する。HTTP／MCP／CLI受信、Process出力・Timeout、Claude Turn／コスト、一回Remediationは別契約とし不変更。正常Task／Adviceと別のboolean Probe出力検査、既知警告本文の診断分類も不変更。規範・準拠基準・Releaseを変更しないため全体文書／準拠監査は行わない。

DIの製品Source・公開IFは不変更。ただしCodex SchemaがImageへ組み込まれる直接利用側なので、`images/build-inputs.json`のSchema二Hashだけ更新し、固定Hash検査自体は維持した。既存の実Imageは旧固定digestのままであり、新Schemaへ更新済みとは扱わない。後続で許可された実Image再build・digest／bytes追従・Image内Schema照合・実E2Eが必要。この実境界Gateと、Source／模擬依存の限定成立を明確に分離する。

| 限定検証 | 結果と範囲 |
|---|---|
| Co準備・Packet／Executor Plan | 3 File 39件成功。8KiB超objective、17条件・各1KiB超、128KiB超stdinと65所見診断、Role／選定／参照／Secret／相関の拒否を対照 |
| Executor通知／Advice | 2 File 7件成功。1,025件・各513byte超の許可参照も受理し、不正入力は乱数・Home・DI構築前に拒否。必須通知失敗・取消・元Receipt／解放事実の維持を確認 |
| ADと直接Consumer | AD内容・エラー・Provider契約35件とCo計画／選定Consumer12件成功。Task／Advice本文・件数・JSON／JSONLと異常分類を全量接続。重複実行は合算しない |
| WB Owner Artifact | 647文字の正規相対PathをCatalogからBrowserまで接続し、越境・Link・Catalog外・実体差等は拒否。既存大容量Markdown試験の旧期待値も追従。Junction fixture生成の環境拒否は権限を整えた同一限定試験で再確認し、製品失敗と区別 |
| Image準備入力 | 非Dockerの既存runtime-assets 4件成功。Source Schema・二Hash・COPYレシピと準備本体を照合。実Image再構築の証拠ではない |

Co本番／試験・Executor・AD・WBの型5設定、担当範囲の形式・Lintと差分検査は成功。独立確認者はAD／Co／Executorの6 File 55件とWB／Image契約を確認した。WBのリンクfixture権限不足一件は、同じ限定caseを必要権限で再実行して成功し、回収hookも完了した。追加試験・QA・現在投影を含む独立最終レビューの必須残指摘は0件。実行単位間の重複件数は合算しない。

全体回帰・実AI・Docker・過去保持物は操作していない。自己生成fixtureだけを既存hookで回収した。Source整理の限定完了と、残る実Image更新Gateを区別する。

## 回復・受領情報の後段量制限の追加是正 — 2026-11-12

状態: 人間の継続指示に基づく実装・限定回帰・独立確認を完了。前段Domainの量制限を撤去した後も、回復／受領情報の利用側に128件／256件の拒否が残っていた。Task Adapter・元Completionと後段の再捕捉、受領Reader／保存候補、MCP結果DTO、Runtime回復ID／Home Hash投影の量だけの拒否を撤去した。再走査で同じCleanup適格性の元ID／引渡し／終端集合にも128件上限を発見し、同じ契約として是正した。

変更分類は既存回復・受領情報の全量搬送への適合是正。着手前に入口・変換・保存・再観測と全直接Consumerを照合した。Array／plain-data・descriptor・Proxy拒否、正規ID／Hash、種別・一意性・単数／複数／元集合の相関、能力・Task／Operation／世代・終端／Cleanupの条件は維持する。未知状態を成功又は空集合へ補完しない。上限専用の定数・分岐は撤去し、新Store・Registry・Framework・自動再送／切詰めは追加しない。

検証ToolのReader・正規ID保全・集約にも128件切詰めが残っていたため、本番結果のConsumerとして容量分岐だけを撤去する。`boundedRecoveryIds`は無制限の集約という現責務に合わせ私有`collectRecoveryIds`へ改名し、別名Wrapperは作らない。HTTP／MCP／CLI受信・子Process出力・取消／待機期限・認可／実処置境界は不変更。実AI・Docker・過去保持物・全体回帰は操作しない。

固定候補の限定回帰と独立レビューを実施し、Owner設計・QA・現在投影へ結果を接続する。規範・準拠基準・Releaseを変更しないため全体文書／準拠監査は実施しない。

最終SourceはCoordinator本番五File（controller／result／recovery／dispatch／acceptance）、MCPのtask結果検査一File、Coordinator検証Script三File。公開関数・結果Schemaは増減せず、私有集約関数だけ現責務へ改名した。変更後の同じ回復・受領配列の128／256件拒否・切詰め残存は再走査で0件。ID長、別の明示操作数・固定種別・Transport／Process限界はこれと区別する。

| 限定検証 | 実際の結果 |
|---|---|
| 回復投影・Cleanup判定・MCP | 3 Suite 38件成功。257正規IDと対応Home Hash、129元ID／引渡し／終端集合、MCP129ID／義務の全量と、不一致・重複・単数相関・能力差・未完了の負例を確認 |
| Adapter・状態受領 | 2 File 58件成功。129ID／義務、129受領と129番目の世代差・重複・未清掃拒否を確認 |
| 実保存の局所結合 | 既存2結果のnormal、129結果のmany_results、129番目だけ不正の3 Case成功。正常129件を受領Snapshot／Receiptへ保存し、末尾不正では受領保存0・未受領129件を保持。実AI／Dockerは使用しない |
| 検証Tool Reader・集約 | 単体File全8件成功。257IDのstrict／salvageとgeneral／route集約を実Source宣言の局所評価で全量保持。不正値・重複・単数相関差は不明を維持。Scriptの実E2Eを実施した証拠とはしない |
| 静的・独立確認 | Co本番／試験・MCPの型3設定、担当ごとの形式・Lint、差分確認が成功。Lint情報通知は失敗扱いのWarningとは分離。Source／試験／設計／QAの独立レビューは必須残指摘0、別確認者の6 File 104件もすべて成功 |

実行単位間の重複Caseは合算しない。試験Fixtureは既定2件を維持しつつ、129件でも固定長・一意な64hexを生成するよう整合した。今回の試験Processはすべて終了し、自己生成Rootの回収hook完了を確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

## 保存前モデルの量制限と旧Reader表記の是正 — 2026-11-12

状態: 人間の追加是正指示に基づく実装・限定回帰・独立最終確認を完了。物理Writerのbyte上限を撤去しても、保存前のDomain候補・validationと利用側に残っていた任意件数・自由本文・全Path長による拒否を是正した。旧Reader実装は既に削除済みであり、現在の試験Header・Symbol／試験台帳の旧`bounded-file-snapshot`識別子を`file-snapshot`へ追従した。過去Evidence・正式Context ID・保存済みデータ・移行Readerは変更しない。

着手前に各容量条件を意味上の条件と分離し、基準のRoot／型・候補／保存／利用側・失敗試験へ対応付けた。Objective128／Task1,024、受入条件・依存・Path集合、回復義務・受領・回復ID、公開集計とWorkspace結果集合の量制限をDomainからCoordinator・MCP結果検査まで一括撤去する。質問・回答・理由・条件説明・選択肢表示と根拠集合、一時操作purpose／allowedContent、Git候補selection／関連CHG／全Path長と生成Commit本文・Stage File容量も同じ内部契約として追従する。旧公開上限定数はRootから撤去し、互換aliasや空Wrapperを作らない。

変更分類は保存候補と公開結果の量拒否契約・不要な公開定数の整理。型・非空・閉Schema・重複／参照／世代／状態／Hash・Root・Path・Lock／CAS・Effect／cleanupを維持する。ID／Hashの文法と識別形式、固定状態種別・選択肢、一世代Leaseの取得／解放二事実、同時実行数・再計画回数は保存量とは違う意味上の契約として維持する。既存Snapshot helperには数値表現限界を渡し、別の任意予算へ置換しない。新しいStore／Registry／自動分割・切詰め・再試行は追加しない。

HTTP・MCP・CLIの受信、別設定モデル（Network Policy等）の構成制約、表示名／Cursorと明示ページ取得、活動Queryの取得窓は今回の保存前契約とは別とし、全制約撤去済みとは表示しない。OS／Runtimeの実資源限界は残る。限定回帰・実Source局所検査・実Gitと模擬境界の区別、独立レビューを既存QA・Owner設計へ記録する。規範・認可・準拠基準・Releaseを変更しないため全体文書／準拠監査は実施しない。全体回帰・実AI・Docker・過去保持物の操作は行わない。

最終候補では、Domainの状態・Task・Objective・Path・Workspace結果と判断本文、Coordinatorの初期作成・定義捕捉・再計画・終端、一時操作とVC Commit、MCPの公開結果検査を追従した。Rootの旧二上限定数・再Exportと既知Consumerを撤去し、公開集合試験を更新した。現行Source・設計・QAに対する旧Reader名／旧上限定数の参照走査は0件（歴史CHGは対象外）。Reader試験は同じ3件を新識別子で実行し、型・実体・途中変更の拒否を維持した。

| 限定検証 | 実施結果と限界 |
|---|---|
| Domain中核の担当回帰 | 5 Suite 34件成功。129 Objective・1,025 Task、長本文／129条件／Path、129回復義務・受領・65回復ID、129件のexact Operation対応と不正参照／重複を対照 |
| 状態作成・判断・Reader | 3 File 43件成功。Co初期作成からDomain投影まで129／1,025を保持し、旧本文超・257根拠IDの判断候補と履歴、Readerの途中変更拒否を確認 |
| MCPの結果搬送 | 1 File 22件成功。129 Objective Summary・1,025 Taskの整合した結果を公開搬送し、不正相関・getter・認可拒否は維持。受信Schema拡大の試験ではない |
| Root公開集合・Consumer | Domain／Coの3 File 30件成功。旧二定数の再Export撤去、既存CLI受信・主体搬送・Core独立性を確認 |
| 候補・一時操作・VC | Domain候補入力の既存Case、VCの局所入力検査・実64MiB超File・Main／Linked正常の3 Case、4,097文字Commitとローカルbare送信1 Caseが成功。一時操作は必要権限付きで同File 24件成功。1,001選択の全Git発行は未実測 |
| 静的確認 | Domain・Co本番／試験・MCP・VCの型5設定、担当ごとの形式・Lint、差分確認が成功。新Co試験の非null assertion警告3箇所は同値の値構築・assertionへ是正し、同Case・Lint・独立再確認が成功 |

上記は重複するCaseを含む実行単位別の結果であり合算しない。独立レビューはSource・試験・設計・QA・命名追従を対象に必須残指摘0、独立実行もDomain／Co／MCPの5 File 71件成功だった。一時操作の通常制限環境の作成失敗は必要権限付き同Case・同Fileで再成功したが、単一syscall原因まで断定しない。VCの通常制限環境の失敗はfixture用Git pushのmsys起動拒否で、同Caseの必要権限付き再実行が成功した。製品判定や期限を緩めず、今回自己生成の試験物を既存終了処理で回収した。実AI・Docker・過去保持物・全体回帰は未実施である。

## 借用作業Treeの独自容量・件数・深さ制限撤去 — 2026-11-12

状態: 人間の追加指示に基づく実装・限定回帰・独立再確認を完了。Git Objectではなく、実行用に指定された現在の作業Directoryの一覧・Hash観測と、その結果を受け取る内部契約を対象とした。単一64MiB・合計256MiB・20,000 File・64階層・相対Path全体1,024 UTF-8 bytesの独自拒否を撤去した。後段の変更一覧1,000件、内部Allowed／Read Path64件、Reviewer向け取得内容1MiB／256 Fileと同じ結果のDomain保存側の件数・Path容量拒否も同時追従した。

変更分類は作業内容観測・内部実行入力・結果保存の容量拒否契約の変更。着手前にSource、全直接呼出し、既存境界試験と保存側を照合した。Root／Pathの文法、Link／hardlink・入れ子Git・大小文字衝突の拒否、前後のFile実体とHash、Capability相関、許可範囲、Secret検査、Lock、取消、期限、回収条件は維持する。上限が担っていた数値表現の前提は非負の安全整数検査で保持し、Hash読取りの64KiB chunkは容量拒否ではないため維持する。通常Directoryを辿る際のLink拒否は維持し、新しい循環Managerや走査Frameworkは作らない。

Consumer照合でPreparation／Request／Domainの二重上限を特定し、同じ内部契約として撤去する。HTTP・MCP・CLIなどSurfaceの入力制限、Objective／受入条件等の別入力契約、Gitの明示固定候補selection契約、子Process出力・Timeoutは変更しない。今回の変更であらゆる入口から無制限入力できるとは主張しない。新しい自動分割・切詰め・再試行は追加しない。メモリ不足やOS／Runtimeの実限界まで取り除く変更でもない。

既存RFD-IT-013等の実行領域試験、Preparation契約、Domainの技術結果保存対照へ接続し、Source・試験・設計・QAを追従する。固定候補で独立レビューと限定回帰を実施する。規範・認可・準拠基準・Releaseを変更しないため全体文書監査・準拠監査は今回実施しない。全体回帰・実AI・Docker・過去保持物の操作は行わない。

最終SourceはCoordinatorの`execution/files.ts`、`operation.ts`、`preparation.ts`、`request.ts`とDomainの`workspace/result.ts`、`validation.ts`の六File。実行領域契約改訂を8へ更新し、旧容量専用の拒否理由・契約説明を撤去した。Provider別の別契約改訂は変更しない。`readExecutionFile(target)`は一引数となり、内容一覧・Hash集計・Reviewer全量・終了結果を後段で容量だけによって拒否またはnullへ畳まない。Root公開関数や新しい永続形式は追加していない。

実行領域Suiteは22件中21成功・1件がJunction作成権限不足で製品判定前に停止した。同じ1件を必要権限付きで再実行し成功した。一括22件再成功と合算せず、環境制約と製品判断を分ける。実64MiB超Fileの全量とHash、70段かつ1,024byte超のPath、1,001変更と65許可Path、Reviewerの1,002 File・1MiB超内容を確認した。20,002 Fileと256MiB超は整合したFilesystem代役で全量観測・descriptor終了を確認し、同量の物理Filesystem実測とは区別する。元Repositoryの不変・部分回収・実体差・不正Capability等の既存対照も成功した。

Codex／Claude準備とDomain技術契約の三File全43件、要求搬送・計測の二File10件、Task Adapterの終了観測Snapshot一件も成功した。準備の追加対照は実Source宣言の局所検証であり、Provider送信や実AI実行の成立とはしない。Domainでは1,001件・長Pathの結果Snapshotと保存値validationの受理、不正Path・重複の拒否を確認した。Coordinator本番・試験とDomainの三型設定、変更九TypeScriptの形式・Lint、差分確認が成功した。独立レビューはSource六File・試験三File・設計／QA二Fileで必須残指摘0、別確認者の追加八Caseも七成功・同じJunction権限不足一件で、前述の同Case再成功と区別して記録する。今回の試験Processは終了し、自己生成Rootの回収hook完了を確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

<a id="internal-storage-capacity-removal"></a>

## Git Objectの独自容量・件数・深さ制限撤去 — 2026-11-12

状態: 人間の追加指示に基づく実装・限定回帰・独立再レビューを完了。先行の内部保存変更とは別の後続範囲として、Git Object ReaderのPack／Index／Object容量、展開量、Delta／Tree深さ、Pack／Object／File件数、Tree合計容量と相対Path全長の独自上限を撤去した。単件File読取りの`maximumBytes`引数も撤去し、VCの入力型・接続とCheckerの固定履歴読取りを同時追従した。HTTP・MCP・CLI受信、子Process出力、一般Git Layout／Worktreeの制約は変更しない。

着手前にVC実装・利用側、既存試験・設計、循環と異常形式を読み取り照合した。深さ上限へ依存していたOFS Delta自己参照とTree祖先循環は、回数制限でなく参照の正当性で拒否する。OFS Deltaは[GitのPack形式](https://git-scm.com/docs/gitformat-pack)に従い、Pack内で自分より前に位置するObjectを参照することを要求する。Hash、宣言サイズ一致、CRC、offset／整数表現、Tree mode、Path／link、秘密情報の選択、失敗時回収は維持する。Node.js／OSの実資源限界を撤廃するものではなく、資源不足による停止まで防げるとは主張しない。

変更分類は技術Readerの容量拒否契約と入力契約の変更。VC・CheckerのConsumer、限定契約試験、設計・QAを追従し、固定候補で独立レビューを行う。全体回帰・実AI・Docker・過去保持物の操作は行わない。大容量Pack／Indexの旧上限そのものを越える実測は未実施として区別する。規範・準拠基準・認可境界の変更は行わず、全体文書監査・準拠監査は今回実行しない。

Reader契約改訂は5へ更新し、旧容量の説明fieldを撤去した。追加した入力負例で、保持する三項目のGetterを内部Readerが実行する既存潜在不整合を検出したため、own data descriptorから一度だけ値を確定する最小是正を加えた。通常入力は維持し、各項目と廃止fieldのGetterは呼出し0で拒否する。新しい公開関数・設定・Wrapperは追加していない。

最終候補の限定結果は、Co Git Object契約とVC固定Snapshotの28件、Git生成Packによる既存統合14件がすべて成功。旧64KiB／64MiB超の全量とHash、70段Tree／OFS・REF Delta、共有subtree、Tree祖先循環と終了時解除、OFS距離0・metadata境界切れの形式拒否を確認した。Hash・offset・宣言サイズ等の破損、Path／mode／Secret、部分コピーと回収不明の既存反例も維持した。VC、Co本番・試験、Checkerの四型設定、対象六Fileの形式・lintと差分確認が成功した（lintの既存情報レベル一件は変更しない）。独立再レビューは必須残指摘0で、別確認者も28件を独立実行して成功した。自己生成した今回の試験物は各試験の終了処理で回収・不存在確認を行った。

途中のVC Package限定統合実行は89件中81成功・8失敗だった。7件はGit補助Process／Link作成の実行環境制約で、該当7件を必要権限付きで再実行してすべて成功した。一括89件の再成功とは合算しない。残った1件は既存のConsumer一覧が`coordinator/src/decision/lifecycle.ts`の利用を欠く期待集合不整合だった。人間の追加是正指示に基づき、同Sourceが判断要求時のRepository Revision照合に公開`readRepositorySnapshot()`を使用することを確認し、期待一覧へ1行追加した。比較方式・製品Source・公開APIは変更せず、該当契約試験1件の再実行が成功した。残件は解消したが、個別再成功をVC Package全体の一括合格とは扱わない。

## 内部保存・表示・診断の独自容量制限撤去 — 2026-11-12

状態: 今回の限定範囲の実装・限定回帰・独立再レビューは完了。基準は`d8b666d25`。容量ガードの全撤去案は実行環境で拒否され、途中差分をすべて基準へ復元した後、人間が「先に内部State・履歴・設定と表示・診断だけを対応」と範囲を限定した。HTTP・MCP・CLIの受信量、Git Objectの展開量・再帰深度、子Processの出力量は今回変更しない。

変更分類は内部保存・表示結果の容量拒否契約の変更。着手前に各保存Owner・利用側と、旧上限の前後、正常大容量、不正Schema、保存失敗・回復・Path・実体差の反例を照合した。容量専用の定数・引数・拒否理由・切詰めfieldを撤去し、常時falseの互換fieldや別Readerの上限へ移し替えない。Schema、UTF-8、認可、Root／Path、Hash、Lock、Revision、保存順序、実体観測、Timeout、保持条件は維持する。新Manager・Store・Frameworkや自動移行は作らない。

| Owner／利用側 | 変更と対照 |
|---|---|
| Domain State・履歴 | Reader・codec・純粋候補・物理Writer・履歴Readerの重複16MiB制限、Blocker／Decision4,096件・技術記録64件の蓄積制限を撤去。旧境界の直前／一致／超過と100,000行の履歴を保存・再読取りし、相関破損の拒否を維持 |
| Domain設定 | AI選択1MiB・通信設定16KiBのFile容量拒否を撤去。正常な大容量設定と不正JSON／Schema／linkの拒否を分ける |
| 共通Reader・Consumer | `bounded-file-snapshot.ts`を廃止し、容量引数のない`file-snapshot.ts`／`readStableFileSnapshot(file)`へ変更。今回の限定範囲では既存の実体同一性照合は維持し、後続の簡素化と混同しない。AM／CLI内部設定読取り・検証Script・Root公開集合・試験・台帳を追従 |
| AM | 状態16MiB・pending17MiB、解析の二重拒否、容量予約専用処理を撤去。登録時の正常Repository設定1MiB制限も撤去。認証／認可・資格生成・改訂オーバーフロー・保存不明は維持 |
| EI | 履歴32MiB・10,000記録と明示Query limitの固定10,000拒否を撤去。保持Policy、未完了区別と明示ページ指定は維持 |
| VC・Workbench | 差分256KiB切詰め、現在File1MiB拒否、文書512KiB・タイトル8KiB、内部応答16MiB等を撤去。Git Object・Process出力上限とHTTP受信上限は不変更 |
| Coordinator診断・検証報告 | 診断SourceのFile／総byte、取得件数・走査深度と診断通知512件の切詰めを撤去。観測例外は容量超過と分けて保持。Executor検証報告の256KiB、Coordinator検証記録の32KiB・保存先256項目による拒否も撤去 |

Workbenchの定義POST受信は既存48MiB＋16KiBのexact値を独立したTransport定数にし、Domain保存上限の撤去へ連動して拡大しない。MCP・HTTP・CLI受信の再設計は別の判断である。OS／Node.jsの実際の資源限界による失敗まで不存在とする変更ではなく、内部データの正常な増加をCRDD独自の固定容量だけで異常扱いしない変更である。

既存QA-000003／004／007／012とRFD-IT-005／008、ERB-IT-004、RCM-IT-005、RDL-IT-001へ対応付ける。Source／保存契約、Consumerと境界・除外範囲、文書／QA／台帳の独立レビューを固定候補で実施し、全結果を統合してから是正する。未公開実装の限定変更であり、準拠基準・安定Context ID・Releaseを変更しないため準拠／Release監査は実施しない。全体回帰・実AI・Docker・過去保持物は操作しない。

初回独立レビューの三結果をすべて受領し、設定登録後の再観測に残る上限、65件技術記録の検証不足、撤去済み理由を残すMCP試験、旧仕様の説明・歴史記録の誤改変、資源不足時の結果保証の過大表現を統合した。方針を各確認者へ戻して、通常Filesystem設定ObserverのOptional容量引数・bounded分岐を正本から撤去し、AM認可・Domain Context・Coordinator Advice／検証Script・Workbenchの再観測を同時追従した。登録後Accessも大容量設定を再読取りできること、65件の個別正規codec生成とHash改変拒否を追加した。Root・link・descriptor・改訂の意味は変更しない。

歴史的EI監査とAM旧Source比較の今回の書換えだけを基準へ戻し、現在の仕様は現行設計へ限定した。捕捉できるI/O等の例外は既存結果へ分類するが、致命的OOMやOSによるProcess終了時まで結果返却を保証しない。新しい上限・監視機構は追加しない。Readerのprivate Source抽出試験に残っていた旧名分岐と引数も修正し、13件が成功した。試験時の一時File書込み失敗では現物を再読して適用済み／未適用を確認し、同じ編集以外の迂回は行わない。

最終のSource・試験・設計・QA・台帳は、変更後に存在する103 File（本計画とPROJECT_CONTEXTを除外）のPath昇順・Path／NUL／本文bytes／NULでSHA-256 `7e74e807187baa7acf1f2d5ce3132b06fddb40c2b10afbc8b619adacd2421438`へ固定した。Source／保存契約、他PackageのConsumer／境界、文書／QA／台帳の三独立再レビューは必須残指摘0。最後の非必須注記であった公開境界試験の旧容量刺激説明もRoot拒否の現本文へ合わせた。検証専用記録の32KiB・保存先256項目の残存拒否も最終一覧で見つけて撤去し、既存ST2件の旧境界超正常保存／flush故障対照、型・形式確認、追加2 Fileの独立再確認二担当はすべて成功・必須残指摘0である。以後は結果記録と現在投影だけを更新する。

| 限定検証 | 確認結果と限界 |
|---|---|
| Domain・Reader・設定・Report・直接Consumer | 最終まとめ実行115件成功。16MiB前後のState保存／再読取り1 IT、16MiB超100,000行履歴の保持／再読取り1 ITも成功。これらは全体回帰ではない |
| AM | 限定9 Suite 131件成功。容量予約の生成故障対照、登録設定旧1MiB超受理、登録後のExposure／現在Access／管理集合再観測の是正後対照も成功。反復件数は合算しない |
| EI | 限定3 Suite 37件成功。旧32MiB・10,000行超の正常読書き／取得と大容量不正Schema拒否を確認 |
| VC・Coordinator診断 | VC限定2 Suite 10件成功、全Source固定後の診断8件も成功。検証専用記録の追加ST2件も成功。途中編集時のHash差拒否を正常へ読み替えず、固定後に同じ試験で再確認 |
| Workbench・MCP直接Consumer | Workbench限定13件と診断観測例外の追加対照が成功。MCPは試験fixtureの廃止理由への追従3件だけ成功、製品上限は不変更 |
| 静的確認 | Domain・Coordinator製品／試験・MCP・Executor・AM・EI・VC・Workbenchの型9設定成功。変更TSの形式確認は成功、先行箇所のuseTemplate情報通知は別扱い。差分の空白検査も成功 |

初回のhardlink／子HTTPの制限環境失敗とModule mock用起動flag不足は、製品検査・期限を緩めず、必要な権限と正規の試験flagで同じ限定試験を再確認した。自己生成試験領域は既存cleanupで回収し、作業用一時編集Scriptは削除済み。実AI・Docker・過去保持物は操作していない。

別残件として、Checkerのtools-naming契約試験は基準Commitの時点からEI Root Moduleの旧期待集合が不一致であり、今回成功とは表示しない（HEADの試験期待とHEADのEI Rootから確認）。同試験のlink作成は制限環境でも失敗した。今回の台帳PathとSymbol存在は独立確認で一致したが、全体Checker合格・全体品質の完成へ拡張しない。実体照合そのものの簡素化、単件入力・計画Schema制約、HTTP等の後続設計も今回の完成範囲外である。

### 追加是正: EI公開Moduleの旧試験期待 — 2026-11-12

人間の追加指示で、`tools-naming.contract.test.ts`のEI公開Module期待を確定済みの現行Rootへ追従した。旧evaluation／projection／recorder等の11Moduleから、execution／group／query／summary／typesの5Moduleへ一意に更新しただけで、正規表現・集合の完全一致比較・EI製品Sourceは変更していない。今回の容量変更の固定候補とは別の後続是正である。該当契約試験1件と形式・差分確認が成功し、上記EI期待不整合は解消済みとなった。試験FileのSHA-256は`8fdc4d4a8299b77c7bd4b27e9c93e91679fe976969f024e6943e5bf2cabfc918`。全体Checkerや全体回帰の成功とはしない。実AI・Docker・過去保持物は操作していない。

<a id="blocker-progress-and-read"></a>

## 既知Blockerの進行制御と読取りの是正 — 2026-11-12

状態: 今回の三点の実装・限定検証・独立再確認は完了。先行段階の完成確認後に、別のactive問題を残した進行、終端対象への新規問題保存、判断照会のBlocker欠測を追加検出した。今回の対象はこの三点に限定する。

承認回答はまず元の提案へ保持し、関連問題が残る間はanswered／unappliedとする。同exact対象・用途・世代・改訂・進行効果の承認が揃う場合だけ、一回CASで共同適用する。旧回答は変更せず、異種効果の順序は推測しない。既存Queue／Task開始の保存境界も確認するが、結果受領・取消・回復・Cleanup・解放は止めない。終端対象への新規要求は拒否し、既存同一要求の再観測は維持する。既存queryDecisionsは同じ改訂・認可・対象から`{blockers, decisions}`を返す。新しい入口・保存先・解決Frameworkは追加しない。

独立確認では、共同適用時の根拠差の暗黙選択と、進行Gateによる正式回復完了記録の拒否を検出した。全結果を統合して両確認者へ是正方針を提示した。導出結果は根拠まで一致を要求し、異なる場合は未適用で保全する。回復完了は既存exact候補と同一のQueue遷移だけを区別し、回復後の実行開始は引き続き拒否する。試験の追加時に生じた型注釈不足・Hash入力誤りは試験側で是正し、製品検査は緩めない。

最終のSource／試験9 FileとDomain設計01／05・QA-000003の計12 Fileの固定候補は`6efead56f1ca1e2a4ab7c9a09a780d952d289b7c239af987a5ef26738e79795c`（Path昇順・Path／NUL／本文bytes／NULのSHA-256）。両独立再確認は必須残指摘0件。局所88件、Root境界13件、保存・Query IT1件、公開判断IT4件、Domain／Coordinator製品・試験／MCPの型4設定が成功した。8 TypeScriptの形式・Lint確認も成功。runtime-storeの先行箇所に残る文字列連結の情報通知は今回変更しない。試験の型注釈・Hash入力不整合による初回不合格は是正後に再実行し、検査条件を緩めていない。全体Checkerの先行3,227件は今回baseline差分を確定しておらず、既存だけ又は新規零とは主張しない。

同じ最終候補で通常full-flowと公開品質受入STの計4件も成功した。通常の複数Task・継続判断後の再計画・Objective受入後のMilestone三判断と再送を確認し、全体回帰の代替とはしない。結果記録と現在投影の独立確認も追加指摘なし。今回の試験は自己生成領域の既存cleanupで終了し、実AI・Docker・過去保持物は操作していない。

### 残件: 変更適用後のBlocker再評価

| 項目 | 扱い |
|---|---|
| 内容 | 一つの判断や代替案の適用による、別Blockerの副次解決・新たな問題の出現・対象や分類の変化を再評価する |
| 今回の判断 | 人間の指示によりv0.22の今回修正から分離。自動再評価・自動開閉・異種効果の自動順序付けは実装しない |
| 保留の影響 | 状況が変わっても他のBlockerを自動解消しない。不一致の承認は未適用で停止し、明示的な確認・再提案が必要となる |
| 担当責任者 | Qual-LabのDomain Model／Coordinator設計Owner |
| 再評価契機 | 後続版の設計時、又は代替案適用後の問題集合更新を自動化する必要が具体化した時 |
| 再検討する条件 | 評価主体・根拠・対象範囲・旧提案の失効・履歴と、別問題の解消／出現を誤認しない検証を定義してから採否を判断する |

自動再評価は今回の完成条件へ含めず、既知問題の進行制御を再評価機能の完成として表示しない。全体回帰・実AI・Docker・過去保持物は操作しない。

<a id="blocker-proposal-cardinality"></a>

## Blockerと提案・回答の1:N化 — 2026-11-12

状態: 人間採用済みの一体変更について実装・限定回帰・独立確認を完了。基準Commitは`812c2dee3`、既存の未Commit判断統合・期限撤去差分へ続ける。変更分類は未公開Schema・公開入力・状態終了契約の変更。問題一件に複数提案、提案ごとに回答0..1件を保持し、過去の拒否・保留・無効化を新提案で上書きしない。

| Owner／利用側 | 今回の処置 |
|---|---|
| Domain判断モデル | Blockerの初期対象・理由を保持し、currentDecisionIdだけを現在提案へ更新。Decision.blockerIdを1:Nへ接続。accept／resume適用だけresolved、return／wait／未適用はactive、cancel適用はcancelled |
| Domain候補・Writer | 同Ownerの現在対象・回答先・世代・Revision・Queue・前本文を照合し、判断・Blocker・適用Stateを一回CAS。新Manager・Store・Lockは作らない |
| 履歴・退役 | 全イベントへblockerIdを追加。全関連提案の履歴本文を確認し、現Project・Queue・結果の参照がなければ終了Blockerと全提案を一括退役。一部だけの削除は拒否 |
| Coordinator／MCP | 新規提案要求と受入入力でblockerIdを必須搬送。IDからの推測・fallbackはせず、再提案の回答先変更も許可しない |
| Queue／採用結果の終了 | 過去の全判断applied検査をactiveなBlocker検査へ置換。Task終端・Cleanup・Lease不存在の確認は維持 |

着手前は親と読取り専用確認者で、回答先乗っ取り、過去提案の遅延処置、初期対象と各提案世代の相関、履歴欠測・部分退役、通常／中止の終了条件を照合した。対象・kind・Queue・回答先が異なる再提案、pending中の重複、終了Blockerの再開は拒否する。過去提案の同一再送は保存0の再観測だけで現在参照を戻さない。新たな人間判断は不要。

旧一対一の保存値・履歴は自動変換せず拒否し、過去保持物の移行・操作は行わない。処理Timeout・Lease期限・保持Policy・DI・Executor・AI Adapterの製品Sourceは不変更。Source／契約の独立確認と、利用側・文書／QAの独立確認を実施する。文書と限定影響確認を対象とし、準拠基準・Releaseを変えないため準拠／Release監査は非該当。全体回帰・実AI・Dockerは実施しない。

初回固定31 Fileの候補`5a25e598503caf8fe2baefa0fdf9d7af0975ea27ab0c8c7bd33e3cd8c0be07ae`の独立確認を両方受領した。Sourceは「別Blockerが複数ある場合のcancel後の永久終了待ち」、文書は旧一対一退役条件の残存を指摘した。全結果を統合して両確認者へ是正案を戻した。既存cancelはMilestone全体を中止するため、採用済みの中止意味に従い同Project・Milestoneのactive問題を同CASでcancelledへ投影し、物理Effect・認可のscopeは拡大しない。cancelledだけcancelledByDecisionIdを必須にし、同scopeの適用済みcancelを保存codecで確認する。参照先の先行退役を拒否し、技術回復・Cleanup・Lease条件は保持する。新field・依存を含むため着手前整合確認と独立レビューを更新候補でやり直し、初回結果を完成根拠に流用しない。

是正候補`eebec478c7cc929530ff1d5fe1f848d5aec4ce3b5bb4424543576f9a57cfc00a`のSource／Consumer独立再確認はいずれも追加必須指摘0件。最後にcancel適用結果のnextStateがcancelledであることを検査し、実行継続状態への改ざん反例を追加した2 Fileも両者が確認して残指摘0件。最終の31 File候補は`5c337d9c60e0a0e06a25d53232d3f18ea4b6f838246daf544b2f56ae8f03650d`。各HashはPath昇順・Path／NUL／本文bytes／NULのSHA-256で、index移動の有無とは独立に現物を識別する。以後の変更は結果記録と現在投影だけで、製品Sourceは固定する。

最終の局所単体・MCP・保存codec・終了／退役候補・設計対応は80件成功、Root公開境界13件も成功。公開受入・継続判断の4 ITは同じ問題への保留後承認、別問題2件を含む中止、履歴故障・Lease競合を実保存で確認した。Domainの保存ITは2提案の履歴保全、過去提案だけの履歴欠測時の退役拒否、全提案の一括退役、保持履歴中のBlocker ID再利用拒否を確認して成功。最終のcancel先状態相関の一行は局所80件で再確認した。先行候補の通常full-flow／品質受入STの4件も成功したが、最後の中止scope是正の実境界根拠へ流用しない。重複実行件数は合算しない。

Coordinator製品／試験・Domain・MCPの型4設定、最終16 TypeScript Fileの静的確認、設計対応CLI（40遷移・40結合）とdiff空白確認は成功。保存ITの初回拡張で、fixtureの新要求時刻が旧提案の実適用時刻より前だったため拒否を検出し、fixture時刻を実順序へ是正した。製品の順序検査は緩めていない。今回生成したRepositoryと試験物は各hookで回収した。横断文書Checkerの先行未合格は残り、全体品質のPass・全体回帰・実AI／Docker E2E成立を主張しない。既存保持物・自動移行・Commit／Pushは操作していない。現在、この限定実装に追加の人間判断は不要。

<a id="decision-without-expiry"></a>

## 判断期限の撤去 — 2026-11-12

状態: 判断期限の撤去と限定検証は完了。判断の`expiresAt`、要求の`lifetimeMs`、状態`expired`、履歴`decision_expired`と期限遷移を撤去した。時間経過は問題の解消や判断不要を意味しないため、未回答・保留を自動失効させない。処理Timeout、Lease期限、履歴保持期間は別契約として不変更。

対象はDomainの判断値・候補・公開入力・Writer、Coordinatorの要求構築、MCP Schema、正式QAと設計対応表、その直接試験である。既存作業差分を基準にした後続是正で、旧経路や互換Reader、新たな保存物は追加しない。未公開の新Schemaに旧期限fieldを持つ記録は自動変換せず拒否し、旧保持物へは触れない。

着手前に要求→回答→適用→明示無効化の所有者と全利用側を照合した。日時形式・順序・未来回答拒否、現在の主体・対象・世代・Revision・Queue・Lease・CAS・履歴確定は維持する。正例は時間経過後の正規回答・後日適用、拒否例は旧field／旧期限閉鎖／旧履歴、境界例は要求より前の回答・回答より前の適用、情報不足例は対象・時刻欠測での停止とする。

Source・保存契約の独立確認と、文書・利用側・QAの独立確認を実施する。文書監査と限定した影響確認は現行Owner・Schema・追跡表へ絞り、準拠基準・安定ID・Releaseは変更しないため準拠監査／Release監査は対象外。全体回帰・実AI・Docker・過去保持物は操作しない。現在の期限撤去に新しい人間判断は不要。

Blockerの開閉については、承認＋必要な適用完了だけ解消、拒否・保留・未適用はOpen、中止は解消と区別して終了する意味を人間が採用した。旧閉鎖Blockerを対象一致だけで一括解消する案は撤回する。このモデルのSource反映と再提案接続は別の残実装であり、期限撤去の限定成功から5系統全体の完成を主張しない。先行節の期限・人間判断待ちの記載はこの見直し前の経緯として読む。

固定候補24 FileのPath昇順と各Path・NUL・本文bytes・NULのSHA-256は`2f12d31fc143c70301b6e3c1d8659e69799bd4f086a6af89f3a6aa5b15e978c3`。実行時は未Commit差分で、基準Commitだけからの根拠とは扱わない。Source／保存契約とConsumer／文書／QAの独立確認を両方受領し、追加必須指摘は0件。確認中に差分がindexへ移ったが、確認者は取得済み差分と現物を照合した。レビュー後はこの結果記録以外の製品Sourceを変更していない。

実行結果は、Domain判断UT・公開判断入力UT・MCP UT・設計対応ITの45件、公開受入／継続判断ITの4件、DomainのState／履歴再入場ITの1件、通常受付・二Task・判断後再計画のfull-flow ITの3件が成功。設計対応CLIは40遷移・40結合でaccepted、Coordinator製品／試験・Domain・MCPの型4設定も成功。今回の16 TypeScript Fileの静的確認はエラー・警告0、既存の文字列連結に情報指摘1件で、無関係な書換えはしない。横断文書Checkerの先行不合格は解消したと主張せず、全体回帰も実行していない。

<a id="decision-state-consumer-closure"></a>

## 判断統合の残り5系統 — 2026-11-12

状態: 実装と限定回帰を進行中。先行段階の未完了表示は以下の現在値で更新する。基準Commitは引き続き`812c2dee3`。変更分類は採用済みの保存Schema・公開契約・状態遷移・信頼境界の整理であり、Release／準拠基準を変更しない。着手前の読取り専用確認で、継続判断の保存前後、回答先、Queue／Lease、後日適用の期限、旧試験の安全反例、報告保存Consumerを照合した。

| 対象 | 現在の実装と保持条件 |
|---|---|
| 継続判断 | 公開`submitDecision`のrequest／answer／apply／closeをDomainの同一Writerへ接続。質問発行時にBlockerとQueue待機を保存し、回答は現在認証主体と元回答先をexact一致させる。resumeは再計画待ちに進めるだけでAIを再送しない |
| 利用側 | MCPはv2の操作別閉SchemaとDomainの結果検査を使用。主体を入力から自己指定させず、判断・履歴・回復要否を分けて搬送する。Workbenchの判断照会は既存認可付きQueryを維持する。未使用のHost opener引数・接続・試験counterを撤去 |
| 旧経路 | Host Store、継続Bearer／Hash／再発行、二段階Port、旧Envelope・判断回復区画と専用CRUD・検査を撤去。旧Schema・旧fieldは拒否し、Readerや自動移行を設けない。旧保持物の処置はフロントAIが別途明示実施 |
| 後日適用・閉鎖 | 元回答を保持し、同Ownerで元本文・現在世代・Queue／Lease Intent・現在期限を再検査する。適用済みの再送はState保存0。明示閉鎖はBlocker／Queueを解消せず、回答済み期限切れは明示無効化で扱う |
| 保存Helper | Domainの汎用committed-jsonとRoot公開を撤去し、現役の検証報告だけExecutorの`scripts/report.ts`へ専用化。sidecar・Hash・byte・実体・部分保存／削除不明の意味は維持する。bounded ReaderはState／AM／設定／CLIの現役共通義務がある一実装として維持し、コピー・新Package・Storeを増やさない |

新しいRuntime機構ではなく、旧専用経路を削減する。再計画分類で人間への質問が必要と分かっただけではDecisionを発行したことにせず、認証済みrequest操作が質問・Blocker・Queueを一回保存する。必須のState保存と履歴の論理追記は別結果で、履歴故障からの再入場は元回答・元適用時刻を変更しない。

### 退役試験と保証の対応

| 旧試験・処理 | 現在の確認先又は撤去理由 |
|---|---|
| Capability Adapter／発行Token・Hash試験 | Token機構は代替なしで退役。別主体・旧field・未知操作は新`decision/lifecycle` UT、現在世代・回答先・再送は公開continuation IT |
| Windows Decision Store／独立Recovery Store | Host固有保存・独立Hash連鎖は保証対象から撤去。一回State CAS・原本相関・履歴保存不明はDomainのruntime-snapshot-io ITと公開continuation IT |
| 旧受入Port／Coordinator内の重複純粋遷移 | 新`acceptance-decision.integration`の公開acceptResult実保存、既存ST三分岐、Domainの判断候補UTへ接続。Task完了だけの上位受入を引き続き禁止 |
| replan／full-flowの旧Map・Bearer fixture | retry／部分再計画は既存試験を保持し、質問発行と回答を公開入口へ接続。新しい実Git HEAD・正規Binding・実Stateを使用 |
| 旧Domain committed-json UT／IT | Executor report UT／ITへ移管。本番判断Storeの証明として流用せず、報告本文・sidecar・削除状態・中断・対象外File保全だけを担当 |
| 設計整合Checkerの旧継続Protocol | 旧別Store・prepared／finalized条件を撤去。現在の判断5状態、回答先・内容付き履歴、同一CASの判断／Milestone／Queue投影、閉鎖後の不適用を明示検査し、条件欠落の負例も置換 |

限定確認では、公開入力・Domain・MCPの57件、変更対象の純粋処理133件、設計整合10件、公開受入／継続回答／閉鎖3件、実Lease競合後の明示適用1件、DomainのState／履歴再入場1件、受入ST・全体flow／再計画等の結合試験を確認した。報告保存の移管試験12件は最終Sourceで成功。初回の報告試験では移管した試験の参照Path誤り1件と、制限環境でのHardlink作成拒否1件を検出し、Path是正と許可された今回試験領域だけの再実行で確認した。製品検査は緩めていない。重複実行を合算した総件数は表示しない。

Domain・Coordinatorの製品／試験・Executor・MCP・Workbenchの型検査は成功。台帳は旧専用3 Suite退役・新continuation IT追加・報告2 Suite移管により407件でvalid。正式QA項目数は205件のまま。文書・Source・QAの独立完成レビューと残る選択結合試験は実施中で、現時点では完了を主張しない。公開Module集合検査はDomainの追従後、既存EI allowlist不整合で停止した。成果物関係の別2検査は成功し、これを横断Checker全体Passにしない。

全体回帰・実AI・Docker・過去保持物への操作・自動移行は実施しない。試験は今回生成したRepositoryと報告だけを終了hookで回収し、過去保持物を探索・清掃しない。新しい認可・Lock・Manager・互換Facadeは追加しない。

### 独立確認の是正と現在の判断待ち

固定候補`0012424542ac5517f7db011f451ccb37d001e7121c7ad3bead34c2ffc2d1129c`に対するSource／契約とConsumer／文書の独立確認を全件受領した。Sourceは2系統、Consumer／文書は3点の必須指摘で、両確認者へ統合是正案を戻し整合を確認した。

一意に是正できる受入差戻しの実効条件差、現行文書の旧Bearer規定、正式ITの終了条件、移管したSPEC／Evidence差替え反例を是正した。Objective returnも基準数分の根拠を適用条件へ戻し、Milestone returnはStateの既存根拠を保全する。今回回答の根拠はDecisionに独立保持する。是正後の候補UT・公開受入ITは13件成功した。

追加の選択結合7 Suiteは62件中59件成功・3件失敗だった。うちRuntime Data境界試験は、新継続判断の例外結果が回復参照・Effect・清掃条件を落とす実装漏れを検出した。既存の境界投影を利用し、結果検査も判断本文未観測とEffect観測を区別する契約へ追従した。実判断入口へ有限代役から例外を投入し、exact回復参照、Effect既知／未知、Owner解放未確認が失われないことを検証した。公開境界と投影の最終2件、型検査、対象3 Sourceの静的検査は成功。残るローカルHTTPの2失敗は接続制限下で再現し、許可された局所再実行では2件とも成功した。実AI・Dockerは使わず、製品の判定・期限を変更していない。初回62件全成功とは表示しない。

追加の独立確認は、実装投影に新たな意味変更がないことを確認した一方、実例外経路の試験不足と現行Symbol表の旧経路を指摘した。実入口試験を追加し、現行表をacceptResult／submitDecisionの四操作、同State CAS・回答先照合・履歴別結果へ是正した。更新後のSource再確認は追加必須指摘なし。Consumer再確認で残った公開Ownerの導入一文もCoordinatorの現在Rootへ訂正した。最終のDomain判断・公開搬送・MCP単体35件は成功。今回だけの調査補助6 Fileは削除し、既存Runtime保持物は操作していない。閉鎖後Blockerの未解決指摘は残り、全体完了ではない。

残る設計判断は、閉鎖した判断のBlockerと後続判断の解決との関係である。現行closeはBlockerをactiveのまま保持するが、Queue終了解決と判断退役がapplied／解消済みだけを認めるため、旧判断が新しい明示判断の完了後も整理を永久に妨げる。閉鎖単独でQueue／Blockerを解消する変更や、終了検査の単純撤去は行わない。同じexact対象・世代・Revision・Queueに対する後続の明示回答が実際に適用された時だけ旧閉鎖Blockerも解消する案を推奨候補とし、採用は人間へ戻す。現時点では未実装・未解決であり、5系統全体の完成やコミット可能とは表示しない。

追加の文書CheckerはScopeから参照先へ展開して3,227指摘で不合格。変更Path上には既存PA品質関係、中央品質集合・条件の不整合、旧Native Symbol参照が残る。これは全体回帰の実行ではなく読取り検査である。基準との全数差分比較は今回未実施のため、全件を既存と断定したり、今回追加0と表示したりしない。

<a id="decision-state-unification"></a>

## 判断・阻害条件・履歴の統合 — 2026-11-11

状態: 実装中。人間は6項目の統合方針を採用し実装を指示した。基準は`812c2dee3`、着手時は作業差分なし。AppData/LocalのDecision Store廃止を固定し、Package分離の前に判断モデル・保存単位を整理する。新モデル・Schema・内部Writer・履歴出版／再入場／退役確認を接続したが、本番公開入口・旧経路撤去・6項目全体の完了は主張しない。

変更分類は保存Schema、公開契約、状態遷移、信頼境界の変更。設計OwnerはDomain／Coordinator詳細、検証OwnerはQA-000003の既存判断契約。実装前に現行の判断型、State codec・閉集合検査、Writer、Queue、履歴退役、Coordinatorの本番Host Storeと受入経路を照合した。読取り専用の保存契約確認者から、純粋遷移→新Schema→同Ownerの一回Writer→履歴再構成→利用側→旧経路撤去の順を確認した。これは完成後の独立レビューではない。

実装・契約と利用側・検証・文書の独立レビューを行う。今回の製品変更はCRDD標準の準拠基準やRelease権限を変更しないため全面準拠監査は実施しない。全体回帰、実AI、Docker、過去保持物への読書き・清掃は対象外。旧保存物の自動移行・互換Reader・新Manager／Registry／Storeも追加しない。

保持するCapabilityは、入口認証・現在認可、対象・世代・選択肢・期限、重複回答と適用拒否、同じStateのCAS、履歴確定前の退役拒否、Root／Link／Lock境界。不採用にする旧保証は、判断消費状態をRepository外へ隔離することと、Host独立世代・Hash系列・Bearerによる保護。同一Hostユーザーの任意改ざん・巻戻しは新方式の独立防御対象としない。AIからRuntime領域を書換えできない実接続の確認と、旧判断を無視して二重発行しない切替条件は未完了。

初回実装は`decision/types.ts`のBlocker／Decision／回答・適用／内容付き履歴型、`decision/operations.ts`の要求・回答・後日適用・失効・履歴投影。質問と表示付き選択肢、入力された理由・根拠を保持する。回答・適用候補は一つで返し、外部の認可やQueue状態を検査したとは主張しない。要求・回答・適用の出来事を同じ判断から再構成し、要求時の履歴へ未来の回答を混入しない。日時はUTC正規形、期限ちょうどは回答拒否、種類違い・不整合世代・未知field・getter／Proxyを拒否する。

既存PRL-UT-007のFileへ初回8ケースを追加し、元の2ケースと合わせ10件成功。独立Sourceレビューで、後日適用・閉鎖が元の状態と結果を全体検査せず、破損値を例外又は候補へ通す指摘1系統を受けた。両入口で元判断を既存の要求・回答検査から再構成し全文一致を確認するよう是正した。null／空／矛盾した結果、空理由、空質問、不正対象、未知field、pendingへの回答混入を両入口で例外なしnullとして拒否する追加ケースを含め、最終候補11件が成功した。Domain型検査、変更3 Sourceの書式・警告禁止check、試験台帳409件・差分空白検査も成功。独立Source再レビューは必須残指摘0。確認者は読取りのみで試験を再実行していない。純粋値の試験であり、CAS・履歴追記・実保存・本番認可・旧Store撤去の成立根拠にはしない。

後続でSchemaをruntime-state/v3、Task Viewをproject-snapshot/v6へ更新し、decisions／blockersを必須にした。codec・初期化・投影・技術更新時の業務区画維持・試験fixture・表示／検証scriptの固定版を追従した。新要求と回答は既存の同Owner・一回Writerへ接続したがRootへまだ公開しない。回答候補はProject・Queue・Blockerを共同更新し、保存遷移検査が同じ候補を再導出する。履歴Gate未接続中は判断の退役を拒否する。

初回の局所26試験は25成功・1失敗。不正な製品受理ではなく、型未指定の非空回復fixtureに新必須集合が欠けていたため、既存のexact参照反証を維持してfixtureへ空集合を明示した。再実行は全26成功、公開境界を含む再確認39成功、Lease／Queue／Workspace／履歴候補の追加28成功。実保存の選択ITは自己生成Repositoryで要求・回答・一改訂の状態確定・同一回答再送保存0・別回答保存0・旧版拒否を確認した。約9秒で1件成功し、fixtureの同一実体限定清掃hookに失敗なし。全体回帰ではない。

独立レビューで回答検査より先に適用を導出する例外経路1件を受け、検査用の未適用候補をメモリ内だけで構成し、その後に最終候補を導出するよう是正した。accept／returnそれぞれのevidenceIds欠測・null・非配列で、例外なし固定拒否・元本文不変を確認する。Writerのfresh現在時刻を期限Gateへ供給し、過去の回答日時だけで現在の期限を通さない。追加指摘の適用日時も、回答日時でなく観測時刻を保存するよう是正し、履歴再導出には保存した適用時刻を用いる。修正後の独立再レビューは必須残指摘0。確認者は読取りのみで実試験は再実行していない。

前段候補（Schema／内部Writer接続）の結果は判断・codec・遷移・公開境界の選択39件が成功。実保存の選択ITも再実行し、約17秒で1件成功、skip・失敗0で自己生成fixtureの清掃失敗は報告されていない。Domain型検査、Coordinator製品／試験のstrict検査、変更TypeScript32 Fileの書式・警告禁止check、台帳409件、HEAD基準の差分空白検査が成功した。静的checkの既存useTemplate情報14件はwarning／errorではなく、対象外の一括修正は行わない。全体回帰・実AI・Docker・過去保持物の操作、コミット・プッシュはしていない。

今回の履歴接続候補では、Stateの判断から全イベントを再構成し、既存の共通履歴Writerのpending→flush→renameへ接続した。State確定と履歴確定は別結果にし、履歴失敗を未適用へ戻さない。必要な全イベントの同ID・同本文を実確認した後だけ、非参照・適用済み・Blocker解消済みの判断と対応Blockerを一つの保存で退役する。保持履歴に同じIDがある新規要求は、State保存前に拒否する。永久のID Registryは追加しない。

是正前の履歴接続候補では、純粋値・公開境界の選択31件、履歴故障／再入場／退役の選択IT1件（約25秒）、従来の履歴再搬送／pending／fsync・rename故障4件が成功した。独立Sourceレビュー2件と文書・QAレビュー2系統の結果を統合した。Sourceでは期限跨ぎで元pendingが時刻由来の保持整理結果と不一致になる経路、要求捕捉前のID getter／Proxy評価を是正対象とした。両確認者へ統合案を提示し、整合確認後に適用した。判断publicationは既存行を保持し、期限整理を既存保守へ分ける。request全体を履歴再入場・ID参照より先に安全に捕捉し、同じコピーを用いる。

正式QAは既存PRL-UT-007／IT-012／IT-013の意味を拡張せず、新しくPRL-UT-015（純粋判断値）とPRL-IT-014（判断State／History直接保存）を定義し、Suite／Case Header、Symbol、既存台帳Entryのtag／終了条件を接続した。新IDは全体利用を照合して未使用を確認した。台帳のPath・Level・既存ID・試験数409件は変えない。是正後の選択31件とIT1件（約16秒）は成功し、ITでは期限直前の非保護行を含むpendingを2日後に同じ本文で確定、State再保存0、後続保守での期限整理、getter／Proxy評価0・State／History保存0も確認した。前段の成功結果を今回候補の結果へ流用しない。Source／契約と文書／QAの独立再レビューはいずれも必須残指摘0。確認者は読取りのみで実試験は再実行していない。従来の履歴4件も是正後に再実行して成功した。

限定文書検査から新QA2件の中央集約への未伝播を検出し、Quality Center／Integration／現実照合の現在集合とLocal Item一覧を追従した。全13定義の正式項目を読み取り再計数し205件、QA-000003は16件と確認した。追加3文書の独立確認も必須指摘0。過去の件数は履歴として残し、設計登録を実行・Pass件数へ読み替えない。台帳409件と差分空白検査も再確認した。QA-000003とDomain詳細を指定した文書検査は関連先へ展開し252指摘で終了1。同じ検査へ変更対象のHEAD本文を読取り時だけ投影した基準版比較も252指摘で、指摘全体の追加0・除去0だった。基準版の一時Directory、旧保持物の読書きは追加していない。今回差分による追加指摘0と横断文書全体のPassを区別する。

残る接続は、後日適用／無効化のWriter、Root API・Coordinator／Workbench／MCP／CLIの公開入口、旧Host Store・Bearer・中間Port撤去、保存Helperの全Consumer追従。履歴出版・判断再入場・退役確認は内部接続済みだが、本番公開Capabilityと6項目全体は未完了。現行の終端履歴pendingを判断用配列と誤認して先に消さず、全生成元を置換する。旧Schemaは暗黙変換せず、過去保持物は不変更とする。

公開入口切替の着手前確認で、旧継続判断は特定Principalに回答を限定している一方、新要求には回答先が欠けていると判明した。回答者集合を広げず、`respondentPrincipalId`を要求と履歴の共通値へ追加し、別主体・欠測を拒否する。入口の認証・認可からの設定は公開要求生成の切替時に接続する。同時に状態照会から旧Host Storeの開閉を本人確認として扱う接続を撤去し、全呼出し元・旧認証Store用fixtureを追従した。認証Context・Root・Revision・State観測は維持し、旧Storeがない認証済み照会を可能とする。これは全回答入口・旧Store撤去の完了ではない。

同じ照合でObjective受付にも旧Storeの未使用可用性Gateを検出し、同じ認証Context分離の方針で撤去した。公開操作結合試験の偽認証StoreとDirectory生成を除き、openerが呼ばれたら失敗させる反例へ変更する。旧Storeの保存機能と回答の実相関を使うrunDecision側は未切替として残し、名前だけの互換引数は追加しない。

今回の限定確認は判断／公開境界／履歴候補31件、状態照会6件、判断Stateの実保存1件（約16秒）、公開受入・照会の選択ST1件（約129秒）、Workspace・採用後照会の選択IT1件（約376秒）、公開Objective・照会・品質受入・再入場の選択IT1件（約160秒）の計41件が成功した。最後の公開操作ITではHost Store opener呼出し0を確認し、未認証の既存拒否を維持する。公開操作IT中にEIの同ID再送を`record_identity_conflict`・Effectなしで拒否する診断が出たが、EI全体の成立確認や是正は今回の対象ではない。型3設定、書式・警告禁止検査、台帳409件、差分空白検査も成功。useTemplate情報16件はwarning／errorではなく一括修正しない。Sourceと利用側・QA文書の独立再レビューは必須残指摘0（確認者の実試験再実行なし）。自己生成fixtureの試験終了hookが清掃を担い失敗は報告されていない。全体回帰・実AI・Docker・過去保持物の操作・コミット・プッシュは行っていない。

### 明示受入の新判断集合への接続 — 2026-11-12

変更分類・対象外・人間採用範囲は上記6項目を継承する。着手前の読取り確認により、既存受入commandは質問の事前発行を持たないため、要求と回答を同じOwnerの一回CASへ載せる固定操作を選択した。Domain Rootに`recordDecision`／`readDecision`と実利用するDecision／DecisionRequest／DecisionAnswerを明示公開し、別Facade・Portは追加しない。四区画をメモリ内のCreation→Submissionで再導出し、新規appliedを単に許可する緩和は行わない。既存差戻しで任意だったEvidence件数を新モデルが必須化していた点も、acceptだけ件数を照合する既存意味へ是正する。

公開acceptResultはRoot／Revision／Workspace採用／Principal照合を保って新Writerへ接続し、旧prepared／finalizedの保存を経由しない。固定の受入質問は既存commandの意味を記録するもので、事前表示や新しい同意を主張しない。保存済み日時を再利用し、同じ回答は再適用せず履歴を確定する。適用済み再送は新規受入の許可ではなく、同一要求・回答の全文一致をWriterで確認する。履歴pending中の専用判断ReaderはStateの観測だけを許可する。公開結果でdecisionとhistoryを分け、正常回答後の保守を追加State保存の必須段階にしない。

queryDecisionsの本番Readerと型を新集合へ同期し、現在認可・対象絞込み・返却前再認可・解放確認は維持する。現Stateの対象に旧判断記録があれば明示移行待ちで停止し、旧保存物の自動読取り・変換・削除はしない。継続判断、旧受入Portの試験、Host Store／Bearer、後日適用／無効化Writer、汎用保存Helperの撤去は未完了として残す。

初回の純粋値・公開境界は27件中26成功で、失敗は追加Root名の期待配列の並び順だった。配列を実公開の辞書順へ追従し、Root13件が成功した。公開操作ITでは主体不一致の拒否結果から既存effectStateが落ちた1件を検出し、拒否条件を変えず元のno_effect封筒へ是正した。修正後の公開操作IT1件（約186秒）とWorkspace・採用後受入IT1件（約354秒）は成功した。これらは後述の競合是正前の経路確認であり、是正後候補の結果へ流用しない。

独立Sourceレビューで、別Lockの適用済み観測から新規Gateを省略した後、Writerが既存不在時にCreationへ戻れる指摘1件を受けた。文書レビューでは、未切替の文言を継続判断へ限定すること、正式ST-009の保存単位・終了条件を新State／Blocker／Historyへ追従することの2系統を受けた。全結果と是正案を両確認者へ提示し、整合確認後に適用した。非永続のexpectedApplied比較値を既存入力捕捉へ含め、同Owner内・履歴処置前に現在applied全文一致と要求／回答再導出のnext:nullを必須にする。不在・別status・別本文・別回答ではCreationへ戻らず処置0で停止する。認可・Schema・Lock・通常新規記録の一回CASは変更しない。

是正後は純粋判断・公開境界・履歴候補32件、判断State実保存の選択IT1件（約22秒）、公開受入・履歴故障再入場の選択ST1件（約92秒）が成功した。実保存ITは退役後の既存欠測、別本文・別status・別回答の拒否でState／履歴pending本文不変を確認し、同じexpected値の再送だけ履歴を確定する。公開STも同じ入力の再送でState本文不変を確認する。Domain／Coordinator製品／Coordinator試験の型3設定、書式・警告禁止検査、台帳409件、差分空白検査は成功。既存useTemplate情報16件は一括修正しない。Sourceと文書・利用側の独立再レビューは必須残指摘0（確認者の試験再実行なし）。自己生成fixtureの終了hookに清掃失敗の報告はない。全体回帰・実AI・Docker・過去保持物操作・コミット・プッシュは行っていない。

<a id="settlement-revision-fix"></a>

## 終了記録の改訂番号の最小是正 — 2026-11-11

状態: 今回の終了記録の改訂番号修正は、限定回帰・独立再レビュー完了。Domain公開削減・Coordinator全試験依存撤去とは別の不具合修正である。

修正後のDomain UT全7件、保存IT全4件（約91秒）、公開境界13件、Domain／Coordinator型検査、変更Sourceの書式・警告禁止checkと台帳409件は成功した。初回Host限定は約229秒で元の終端保存・履歴・配送を通過し、その後段の旧Plan負例で停止した。これは元の改訂不具合と区別する。

後段は7つのDocker名／Image文字列の形式・重複をIdentity生成側で拒否する旧期待が残っていた。製品変更を追加せず、8項目の欠測nullで文字列型拒否を確認し、同名拒否の代わりにProvider選定不一致を反証する。ownershipLabelはDomainへ搬送されて形式検査されるため、独立した不正文字列の拒否を保持する。構成名・Imageの技術検査を撤廃せずDI既存Ownerへ残す。SourceレビューでLabel反例維持の指摘1件を受け、文書・QAレビューと統合方針を照合してから試験へ追加した。最終候補の限定確認・再レビュー結果は別途記録する。

次の確認はIdentity負例を通過し、旧freshIdentityValue.resourcesとpurpose／plannedResourceName／dockerIdの観測配列に残る固定5資源形の参照で停止した。この試験前提は公開Resource checkpointへ接続し直す。初期版の確認後に同じFrameの各Intentを保存し、Host開始・再入場中は未確定状態の終了拒否を明示する。Docker要求0の既知fixtureに限って公開ResourceNotIssuedで全keyを確定し、公開Book ReaderのSnapshot・同じkey集合を現行Cleanup入力へ渡す。各保存のsnapshotConfirmed／lockReleased、全key、IDなし・Receiptなし・未発行を確認する。生Writer、旧形式の復元、保存規則のコピーは追加しない。読取り専用のSource／QA確認後に反映した。実行されるようになったHost完了関数の試験内読込みには、元の公開資源判定依存も接続した。

最終候補のCoordinator Host限定は約238秒で親・内側の2件が成功し、失敗0・skip0だった。元の終端保存、履歴・配送、後段の開始・完了中断と再入場、Owner／Plan／Mount／Host相関の拒否、失敗後の保存本文保持まで通過した。最終候補前の試行では、当該読込み依存が欠けた旧fixtureも後段まで進んで停止しており、この記録を最終成功へ上書きしない。各試行の既存清掃hookに失敗は報告されず、すべての試験Processは終了している。

最終確認はDomain候補UT7件、Domain保存IT4件、Domain公開境界13件、Coordinator Host限定2件の成功。DomainとCoordinatorの製品・試験型検査、変更3 Sourceの書式・警告禁止check、409件の試験台帳整合、差分空白検査も成功した。Coordinator試験に残る既存useTemplate情報6件は警告・エラーではなく、対象外の一括修正を行わない。Source／Oracleと文書・QAの独立再レビューは必須残指摘0。今回の再発防止は既存契約試験と設計の元版基準へ接続し、汎用Checkerや新しい仕組みを追加しない。

本番変更はDomain終端候補の改訂・前版Hashの6行と注釈に限定する（同Fileのimport整列を除く）。DI・Executor・AI Adapter・Coordinatorの製品Source、Root公開、保存Schema、Cleanup no-op、安全判定・期限は不変更。過去保持物・実AI・Dockerを操作せず、全体回帰・実E2E・Release全体の合格は主張しない。より広いDomain公開整理の残件は次節に維持する。

変更分類は正常終端の保存候補の不具合是正。基準caf490fa4と現在の作業差分で、Cleanupのno-op、終端候補、Writerの版・前Hash検査、過去の保存／Host検証を照合した。人間は終了記録の改訂番号を最小修正し、安全判定・API・Schemaを変えず、試験・文書・限定回帰・独立レビューまで行うことを承認した。読取り専用の着手前確認で、候補はCleanupの返却版でなく元の読取り版を基準に一回だけ進める方針を確認した。Source／回帰契約と文書・QAの独立レビューを行う。準拠基準・権限・Releaseを変更しないため全面監査は実施しない。追加の人間判断は不要。

原因は、資源未受領の安全なCleanupが元bytesを返すのに、終端Driverがその版を更新せず終了結果を加えていたこと。メモリ確認では元改訂1／候補1は復号成功・遷移拒否、改訂2と元版Hashのみ補正した候補は復号・遷移とも成功した。変更はattempt/settlement.tsの最終候補へ元版+1とpreviousを明示するだけとし、資源記録ありでも二重加算しない。Cleanup no-op、Writer、遷移・現在版・Owner・Lock・資源終了・保存拒否の条件は不変更。

既存runtime-transitions UTへ本番関数の候補生成を実行し保存端だけを捕捉する6ケースを追加した。改訂・前Hashは元bytesから独立に検査する。資源未受領／記録あり、不正開始・送信不明・Snapshot混入・観測不明、元版差、保存拒否・解放不明と元回復参照を確認する。修正前は追加6件中1件（資源未受領の改訂1≠2）が失敗、他5件成功。最小修正後は当該File全7件成功。初回型検査で試験用Operation Unionの絞込み漏れを検出し、種別を明示して是正した。物理CASはこの捕捉UTだけから成立としない。

Symbolは既存Suiteのverifiesへ終端Sourceを追加し、QA-000003／006とDomain Architectureを追従する。限定の既存Domain保存ITと、前段で残っていたCoordinator Host Caseを実行する。全体回帰・実AI・Docker・過去保持物の操作、公開API・Schema変更は行わない。コミット・プッシュは未実施。

<a id="coordinator-domain-test-ownership"></a>

## Coordinator試験のDomain依存整理・先行分 — 2026-11-11

状態: 先行是正・独立レビュー済み。限定Host確認は残1件不合格。Coordinator全依存の撤去とDomain Root削減は未完了。

初回是正後も同Fileは3成功・5失敗だった。共有Homeの取得拒否からRuntime Stateの親不成立へ、Cleanup開始前の例外から通知内inspectの設定欠測へ停止点が前進した。同件数を同じ原因又は解消と扱わず、親Directory双方とDI接続双方を追従し、最新候補で再確認する。更新候補のSource／Oracleと文書・QAの独立再レビューは必須残指摘0（結果確認は別）。

次のFile実行は5成功・3失敗だった。認証回復子は設定Ownerの静的importがDI Rootを有限境界の登録前に読んでいたため、境界登録後の動的importへ移した。これにより正常枝が成立し、追加不存在が失敗して保存Writerへ未到達の枝では元checkpoint全field不変を確認するよう旧期待値を追従した。保存済み不存在・Receipt・読戻し差・解放不明のOracleは維持した。

その後のFile実行は7成功・1失敗（約326秒）。認証の両Consumerは全故障シナリオが成功した。残る先頭Caseは、合成CLI分類fixtureの相対host-rootを共通wxへ渡していたため、合成Record・Token・nonceは維持し、Pathだけ新品Repository内の同名絶対Root／markerへ限定した。真正な現在HostのSnapshotを分類fixtureへ混ぜる案は、現在操作として正しく拒否されたため不採用とした。合成Hostの実在又は回収を主張しない。

先頭Caseの追加単独確認は後段の正常終端保存まで進んだが、未受領のSnapshotを終端代役が受領済みとして返す不整合で停止した（約185秒）。外部要求なし・資源Bookなしの元版へ戻す既存枝に限り、代役のresourceSnapshotをnullへ追従した。Domainの未開始・未発行・重複拒否・全観測not_requested条件は維持し、nullだけから不存在を推定しない。更新候補の独立Source確認は必須残指摘0、最終単独確認は実行中。

最終単独確認は約159秒で終了し、内側1件成功・親1件不合格だった。入力拒否は通過し、同じ正常終端の保存でcoordinator_state_storage_unconfirmedとなった。成功へ畳まず、元結果・保存候補・Owner／清掃後の保存接続を次段階で切り分ける。これは直前のFile実行7成功に加算して全File成功と主張できる結果ではない。現在すべての試験Processは終了している。各Caseの既存清掃hookに追加失敗は報告されなかった。

現候補のCoordinator試験／Domain型検査、公開境界13件、試験台帳409件、差分空白検査は成功。移管・独立期待値化の10件と受領の限定1件も成功した。独立Source／Oracleと文書・QA確認は必須残指摘0だが、この未解消試験を合格へ変換しない。Schema識別子、本文Hash、確定File名、Workspace保存検査の4公開候補へのCoordinator試験参照は撤去した。製品Source・Root公開・保存Schema・検査条件は変更していない。

変更分類は試験Owner・接続の是正。基準caf490fa4からの先行DI整理を維持し、読取り専用の着手前確認で、観測補助・純Domain検査・複雑な終端fixtureの三群を区別した。外部試験の私有import、新しい試験Facade、保存規則の複製は採用しない。製品Source・保存Schema・認可・回復条件・公開IFは不変更。Source／Oracleと文書・QAの独立レビューを行い、全面準拠・Release監査は契約変更がないため対象外とする。現在追加の人間判断は不要。

| 対象 | 今回の処置 | 保持する確認 |
|---|---|---|
| Workspace保存理由の純粋ケース | CoordinatorからDomain既存Suiteへ本文移管。CPR-UT-009／QA-000005を移管先にも接続 | 新旧成功理由、Merge IDとの相関、一次失敗、回収失敗、別系列拒否 |
| Schema識別子・本文Hash・確定File名 | 五つのfixture／試験で固定Schema値、本文HashはNode標準、File suffixは固定期待値へ | 製品と同じHelperを期待値生成に使う自己比較を避ける。保存契約自体は不変更 |
| Host保存の共有Home／Runtime State前提 | 今回生成Root内に両親所在を作り、Case終了時に設定復元・既存Root清掃 | 実ユーザー側の所在の有無に依存しない排他・回復準備 |
| 認証回復子のCleanup／inspect接続 | 双方へ現行設定引数を明示し、元target・callbacks／optionsを渡す | 元Session CompletionとProcess／Cleanup確認、Signal、追加不存在の停止条件、保存・二段不存在のOracle |

移管前10ケース、移管後も同じ10ケースが成功した。回復受領の限定1ケースは約108秒で成功。Coordinator試験／Domain型検査と409件の台帳検査も確認した。初回Host保存Fileは8件中3成功・5失敗で、共有Home親を実環境に依存するfixtureと、認証回復子が旧Cleanup呼出し形を使用する接続漏れを確認した。製品の安全判定を変えず試験接続だけを是正し、再確認する。初回失敗を成功へ上書きしない。型検査で補助callbackの引数型欠測2件を検出し、既存DI公開型で明示した。

履歴／配送のメモリWriterや修復の独立期待値、埋込みWorkerのDomain内部候補依存は次段階に残る。実保存APIへ単語置換するとFilesystem・Lockを追加するため、試験のOwnerと故障注入点を照合してから処置する。本番利用中で元の内部化集合に含めない修復候補7種も公開維持する。全体回帰・実AI・Docker・過去保持物は操作しない。コミット・プッシュは未実施。

<a id="di-repair-test-ownership"></a>

## DI修復試験のOwner分離 — 2026-11-11

状態: DI先行分の実装・限定回帰・固定候補の独立レビューを確認。

Domain全737公開の棚卸し後、Root165件の内部化とoutcome入口撤去の着手前照合で、既存公開境界検査が外部Packageの試験からの私有importも禁止していると判明した。前案はこの試験境界を見落としていたため、そのまま適用しない。人間が指定した順序に従い、まずDIの3試験からDomain依存を外し、次にCoordinatorを整理する。この段階でRoot公開は変更しない。

変更分類は試験Owner・接続の是正。基準caf490fa4のDI3試験45ケースと独立比較Oracleを確認し、読取り専用の着手前確認で、DI試験は技術契約のみ、保存側比較ITは独立2実装、有限fixtureはDI所有という配置を照合した。Source・試験義務と文書・QA・影響伝播の独立レビューを行う。製品の挙動・権限・保存・公開IF・準拠基準・Releaseを変えないため、その全面監査は対象外。現在追加の人間判断は不要。

| 元の対象 | 処置・新Owner | 保持する保証 |
|---|---|---|
| DI repair-machineの独立比較2ケース | Domain既存runtime-repair-storage ITへ本文移管。Domain私有保存codecとDI技術codecを個別に実行 | 異常入力・全field・Accessor／Proxy非実行・凍結・入力分離、実通知列、遷移・Session・廃棄／保持・回復ID |
| DI Machineの通常試験・fixture | Domain codec／型をDIの既存技術codec／型へ置換。fixture本文をtests/support/repair-machine.tsへ移し共用 | 八処置、通知、取消、不明、故障注入の必須到達、変異実装を拒否する反証 |
| DI Session・廃棄composition | Domain decoderではなくDI実体へ接続 | 必須通知拒否・取消・実体差・部分成功・cleanup不明の停止 |
| 管理情報 | 両Symbolのverifies、QA-000006、両Architectureを追従 | Suite・正式項目数・正式結果、製品Source・Root公開・保存Schema不変 |

基準のDI3試験45件が成功。変更後もDI43件＋Domainへ移管した2件の計45件が成功し、両Packageの型検査が成功した。初回型検査で旧識別子の置換漏れ1箇所を検出して是正した。この45ケースは有限な技術代役とメモリ値を使い、Sourceの読取り以外に実Docker・実AI・過去保持物を使わない。全体回帰は未実施。Coordinatorの製品・試験とDomain公開削減は未着手。

既存公開境界20件（Domain13＋DI7）、5試験Sourceの書式・警告禁止check、409件の試験台帳整合、差分空白検査も成功した。checkの既存useTemplate情報7件はエラー・警告ではなく、当該式を変更しない。台帳検査は試験を起動しない。Source／Oracleと文書・QA・影響伝播の独立レビューは双方の必須残指摘0。旧Machineの12ケースがDI10＋Domain2へ全件対応し、fixtureも参照名・型Owner・空白以外の本文を維持したことを独立に照合した。

追加の移管先保存IT全Fileは約104秒で32件成功し、今回生成Rootの既存fixture終了処置も成功した。この32件は移管した2件を含むため、先の45件へ重複加算しない。物理保存・出版・読戻し・解放不明・用途差・Owner喪失の限定反証であり、実Docker修復や全体回帰の成立ではない。DI製品Source・Domain製品Source・Coordinatorの追跡差分0を再確認し、追加是正は不要だった。コミット・プッシュは未実施。

<a id="am-internal-contract-closure"></a>

## AM内部の型正本・不要経路の整理 — 2026-11-11

状態: 実装・限定回帰・固定候補の独立レビューを確認。

人間が採用した4系統だけを対象に、基準033382309の公開集合・全宣言参照・旧Reader4試験・現在の管理一覧・型規約を初回編集前に照合した。変更分類は内部責務の是正と本番未使用経路の撤去。読取り専用の着手前確認では型の可変性／省略／null／理由幅、旧試験の義務移管を確認した。Source／Consumerと文書・QA・影響伝播の独立レビューを行い、準拠基準・保存Schema・権限・Releaseを変更しないため全面準拠／Release監査は対象外。公開30関数・26型は固定し、追加の人間判断は不要。

| 編集の一次対象 | 処置と移管先 | 保持する保証・反証 |
|---|---|---|
| permission/typesのOutcome3型 | 実装からのReturnType抽出を明示構造へ置換、authorizationの投影関数が戻り型を満たす方向へ固定 | 可変配列・可変property、null、省略field、理由string幅を変更しない。基準実装の推論型との双方向6代入で確認 |
| 交換Snapshotの型Owner | 宣言本文をexchangeから既存credential/typesへ移し、exchangeがtype import | Rootへ追加公開せず、本文・readonly・段階別fieldを維持 |
| 本番未使用の個別発行Reader | readCredentialIssuance／projectCredentialIssuance／CredentialIssuanceObservationを撤去。旧4ケースをreadCredentialAdministrationStateへ接続 | 認証／管理者制限、非秘密field、提示三状態・失効、初回途中、先行材料、読取り・清掃・解放不明を維持。現役のCredentialIssuanceSnapshotと発行・提示・失効Writerは維持 |
| 廃止APIだけの旧入力義務 | 元発行ID／User IDの不正・不一致入力は、対象引数のない一覧へ架空の契約として移さない | 整理済み対象は正常な管理者一覧に含まれず、非認可者には一覧全体を開示しない。旧単件Receiptを一覧で再現しない |
| Role検査・説明 | authorizationの私有isAccessRoleを削除し既存permission/validationを共用。認証／交換の未接続コメントを更新 | 三Role集合・未知値拒否を維持。新しいFacade・型alias・互換処理・Source分割なし |

限定回帰は資格保存／提示／Reader移管14件＋公開集合／Role4件、管理／認証6件＋公開投影3件、交換／資格一覧4件の計31件が成功。AM・Workbench Server・MCP Serverの型検査も成功した。公開集合は30関数・26型の完全一致を維持し、本番Consumerの追加修正は不要だった。

型比較は当初TypeScript Compiler APIを使う構成で起動したが、既存TypeScript 7配布に旧API Fileがなく実行不成立。依存追加はせず、基準実装を新品Repository-local比較Rootへ投影し、既存tscで旧推論型と新明示型の双方向6代入を成功確認した。比較Rootの4 Fileをexact指定で除去し、空Directoryも回収して不存在を確認した。旧保持物・既存Host・実AI・Docker・全体回帰は操作しない。

最終静的確認は変更7 SourceのBiome check、AM型検査、409件の試験台帳整合、差分空白検査が成功。初回checkで残った未使用Role型importとimport順序は是正し、検査を緩めていない。台帳検査は試験起動を伴わない。Root indexの差分0、撤去したReader／投影／専用結果型の現行Source・試験参照0を確認した。Source／Consumer／試験義務と、文書・QA・影響伝播の独立レビューを統合し、双方の残指摘0。最終の公開集合4試験も再成功した。コミット・プッシュは未実施。

後続の人間指示によるコミット前再確認では、40_Develop全体のTypeScriptから旧Reader・専用投影・専用観測型の参照0、Root index差分0を確認した。公開集合・Role・公開投影7試験、AM／Workbench／MCP型検査、変更7 SourceのBiome check、409件の台帳整合、差分空白検査も再成功し、追加是正は不要だった。型比較用の今回Rootも不存在を再確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

<a id="am-public-surface-closure"></a>

## AMのRoot公開境界整理 — 2026-11-11

状態: 実装・限定回帰・固定候補の独立レビューを確認。長期Lease・EI・PA・DI・Executor・AI Adapter・VCは本作業で変更しない。

人間が採用した30関数・26型案を基準とし、基準db85c6deaのRoot全35関数・29型、全TypeScript参照、既存Host CLI、Workbench／MCPの製品・試験、ArchitectureとRFD-UT-020を初回編集前に照合した。変更分類は未Releaseのライブラリ公開契約縮小とConsumer追従。読取り専用の着手前確認で内部能力の維持と公開型集合の独立検査を確認した。独立のSource／Consumerレビュー、文書・QA・影響伝播確認を行う。認証・認可・保存・運用Policy・準拠基準・Releaseを変えないため、全面準拠／Release監査は対象外。追加の人間判断は不要。

| 合意項目 | 編集先と処置 | 保持する意味・反証 |
|---|---|---|
| Rootの5関数・3型を非公開化 | AM src/index.tsから明示exportだけ除去 | 内部のHost交換・初期化準備・発行事実観測は元Fileに維持。Wrapper・Facade・subpath・互換alias・新型なし |
| 内部Consumerの接続 | AM保存試験・Host試験・子Process fixtureは宣言元へ直接import | 実Process喪失後の交換再入場、鍵提示、保存・読戻し・失効を維持 |
| 外部Consumer | Workbench／MCPの自己生成Host試験準備だけ宣言元へ直接import | 本番ConsumerのRoot接続・初回限定接続・現在認可・通常起動時の作成0を維持 |
| 公開集合の固定 | RFD-UT-020の実行時30関数完全一致と、Source exportの26型完全一致 | 一律の関数数検査や型のunknown化にせず、意図しない再公開も拒否 |
| 正本・管理情報 | AM詳細・QA-000007・現在地を追従 | Source配置と試験Suiteは不変のためsymbol.jsonと409件の台帳を変更しない。正式QA結果・項目数を局所成功で変更しない |

限定結果: 公開集合・Role判定4件、鍵交換／提示／発行事実／Host Root8件、Workbench／MCPの既存Root拒否2件、子Process喪失後の交換再入場1件の計15件が成功。AM・Workbench Server・MCP Serverの型検査、変更8 Sourceの書式・警告禁止Lint、409件の試験台帳検査、差分空白検査も成功した。台帳検査は試験を起動していない。試験は各自が生成したRootだけを清掃し、既存Host・過去保持物を利用しない。全体回帰・実AI・Dockerは未実施。

Source／Consumerと文書・QA・影響伝播の独立レビュー結果を統合し、機能面の必須指摘は0。軽微な試験Headerの「I/Oなし」がSource読取りの追加と不整合だったため、両レビューへ訂正案を共有してから境界説明だけ是正した。公開集合・認可期待値・試験本文は変更していない。最終結果追記とHeaderの独立再照合も残指摘0。初回実装報告時点ではコミット・プッシュを実施していない。

後続の人間指示によるコミット前再確認では、40_DevelopのTypeScript 997ファイルを走査し、撤去した8公開名のRoot import／re-export残存0を確認した。公開集合4試験、AM・Workbench Server・MCP Serverの型検査、409件の台帳整合と差分空白検査も再確認した。追加のコード是正は不要。既存の限定15試験・独立再レビュー結果と区別して記録し、全体回帰・実AI・Docker・過去保持物は操作しない。

<a id="ei-qa-link-closure"></a>

## EIの正式QA登録と旧リンクの是正 — 2026-11-11

状態: 人間の追加指示により、先行整理で残した正式項目未登録とEI関連旧リンクを是正し、限定確認・独立再レビューを完了。新しい製品処理・公開API・検査緩和・過去Evidenceの上書きは行わない。全体回帰・実AI・Docker・過去保持物は操作しない。

変更分類は検証設計の登録漏れと参照の追従。初回編集前にQA-000012の正式表、上位Source条件、現行EI／Coordinator試験、中央Quality関係・件数、全追跡MarkdownのEI関連リンクを照合し、独立の読取り専用整合確認を行った。3項目の入力・刺激・観測・Oracle・終了条件を正式13列表へ接続し、対応SourceとAnalysisを同時更新する。文書・品質の独立レビューと局所の既存Checker検査、限定回帰を行う。全体品質・準拠基準・Releaseの採否は変更しないため、全面準拠／Release監査は対象外。

| 是正対象 | 処置・不変条件 |
|---|---|
| ERP-IT-006／007／008 | Group保持、Query／Summary、Coordinator計測・保存境界を正式登録。既存のST／UAT・情報分類・Effect 0義務を免除しない |
| 現在の設計集合 | 元の記述199へ3を加算せず、13定義の正式表を再計数。基準の実数200から203へ。Suite台帳409件・歴史Pass数とは別集合 |
| 歴史的な変更記録の旧Sourceリンク | EI関連48リンクだけを削除直前の実在Commit／Pathへ固定。各Evidenceの対象改訂版と同一とは主張せず、歴史本文・結論を現在実装へ置換しない |

最終確認結果:

| 確認 | 結果・限界 |
|---|---|
| 正式QA | QA-000012は既存7＋追加3のexact10項目、本文検査指摘0。全13定義は203 unique。Suite台帳は409 validのまま |
| 関係・構造 | QA定義・Analysis・中央Local一覧・現在件数を同期。Handoffの5キーにbacktickの片側欠落も見つけて同一化し、詳細設計本文・EI関連Quality診断・EI関連Symbol診断は0。義務・試験段階・判定を緩和せず、参照だけを接続 |
| EI関連リンク | 全追跡MarkdownのEI／QA-000012参照とEI詳細・Workflow・QA-000012の全outboundを既存Checkerで確認。169 local links・61 anchorsに指摘0。48変更リンク＋先行7の計55固定Source参照をGitのCommit／Path実在へ照合 |
| 限定回帰 | EI公開・保存・Group・Query、Coordinator計測、DomainのQuality定義／分析の64件成功。先行の責務分離228件と分けて扱い、重複加算や全体回帰成功を主張しない |
| 独立レビュー | QA登録・伝播と歴史リンク・影響を別担当が確認。キー表記復元後の再レビューも必須残指摘0。歴史10 CHGは注記と48 URL以外の本文・結論が基準と同一 |
| 対象外の残存 | 既存CheckerのQuality診断6件、Symbol診断2件は他領域の既存不整合。EI関連は0だが、全Repository文書・全203項目・Architecture Ready・Releaseの成立とはしない |

この確認は後続の全体回帰・実境界検証の代替ではない。下段の先行段階にあるERP未登録の記述は本節で解消済みであり、再度未解決として数えない。上位評価・時間的出所・ST／UAT・全Filesystem Effect 0の未評価は維持する。

## EIの責務分離・文書とHeader追従 — 2026-11-11

状態: EIの責務分離・Header・現行文書の追従を実装し、限定回帰と独立再レビューを完了。基準はeb514eb51。公開9操作・13型、v3保存形式、保持条件、結果・失敗分類は変更しない。全Repository文書の合格・Architecture Ready・Releaseは主張しない。長期Task Leaseの方式判断は別件として保留し、本変更ではlease.ts・共通Lockの本番Sourceを変更しない。全体回帰・実AI・Docker・過去保持物は操作しない。

変更分類は内部責務配置と現行設計／手順の追従。初回編集前にEIの基準版Capability・42試験・利用側、Architecture／Quality・規約§4.3を照合し、読み取り専用の独立整合確認を実施した。変えるのは検査・記録規則の所有場所であり、状態・認可・安全判定の緩和ではない。上位ARCH／QAの安定IDや評価・時系列の正式義務を削除しない。準拠基準・Releaseは変更しないため、その全面監査は対象外。Source・Headerと文書／影響伝播の独立レビュー、限定回帰・文書参照確認を行う。

| 棚卸し項目 | 是正 | 保持する保証と検証 |
|---|---|---|
| Storageが入力検査・遷移・保持を所有 | 入力捕捉・構造検査はrecord/validation.ts、遷移・Group参照・保持はrecord/operations.tsへ。広すぎるmodel.tsは撤去 | 遷移・冪等・Group参照・保持判定は同じLock取得後のfresh履歴へ適用。ID／入力固定・Root確認と旧形式先行拒否は取得前にも行い、取得後の競合検査と区別する。出版順序・元実体回収は維持 |
| Source／試験のHeader不足 | 全EI Production Fileに責務・実在ARCH参照、公開入口にpackageDocumentation。共有・保存Symbolは失敗・不明・終了条件、TestはQA Local Itemへ接続 | tag数だけでなく意味を独立レビュー。局所Helperへ架空のAuthority／Recoveryを作らない |
| 現行説明と旧設計の同居 | 詳細設計とWorkflowを現9操作・2モデル・明示Storeへ統一。Reality Auditの過去結果は保全し、現在案内と再構成前Source参照を分離 | 旧Evidenceや件数を新方式の成功へ引き継がない。旧Recorder等を実行案内に残さない |
| Quality・上流・DMの追従不足 | 現Query／Summary・Coordinator搬送を対応付け、退役したEI評価／時系列／Task投影を全面Coveredとしない | 上位の未実装・未評価はOPEN／Partial。別能力の試験で免除しない |

最初の分離途中に共有guardのimport不足で型検査・局所試験が失敗した。依存をvalidationへ明示して是正し、現validation／operations版のEI42件を含む限定228件が成功した。保存結果のno_effectは履歴出版前の分類であり、全Filesystem一時Effect 0の正式義務まで成立したとは主張しない。責務配置自体は実装固有の整理として上位知識還元N/A、上位義務との未評価差はQA-000012と品質統合へ明示する。

最終確認結果:

| 確認 | 結果と範囲 |
|---|---|
| EI静的検査 | format・型検査・lint成功。既存のuseTemplate情報表示1件は失敗ではない |
| 利用側型検査 | Coordinator strict／tests、Workbench Server、MCP Server成功 |
| 限定回帰 | EI42件、Coordinator通知・結果／有限Controller・Advice／Domain・VC利用側を含む228件成功。実AI・Dockerは起動しない |
| 台帳 | 409件valid。台帳の成立を試験・上位品質の全面合格へ読み替えない |
| 独立レビュー | Source／Headerと文書／影響伝播を別担当が確認。説明の4指摘を是正し、再レビュー必須残指摘0件 |
| 文書構造 | 初回の拡張文書走査で詳細設計の表・Checklist欠落も検出。既存形式を現責務へ復元し、inspectArchitectureDetailは指摘0、Quality引渡しは既存5キーexact。固定した歴史Sourceリンク7件のCommit／Path実在を確認 |
| 既存の文書不整合 | 拡張走査には旧リンク・上位Quality閉包等の不整合が残る。ERP-IT-006／007／008の正式Local Item未登録は基準HEADにも存在し、局所一覧や台帳validで正式義務を充足したとは扱わない。全Repository文書Passは未成立 |

store.tsは670行から410行へ、入力固定・構造検査253行はvalidation.ts、専有集合の遷移・保持114行はoperations.tsへ分離した。検査前倒しや新しい保存経路は追加せず、model.tsと現行参照は残さない。

<a id="ei-execution-group-realignment"></a>

## EIのExecution／Group再構成と開始・終了接続 — 2026-11-11

状態: 新9操作と明示Store・2モデルを実装し、CoordinatorのProvider要求直前／元Completion／上位最終判定／Group／Activity Readerへ接続した候補。Source・Architecture／Quality／管理情報の独立レビューは必須残指摘0件。型検査と下記の限定回帰を確認済み。旧永続データの移行・全体回帰・実AI／Dockerは未実施。設計の正本は[EI詳細設計](../../../06_Architecture/Details/execution-intelligence/01_Architecture.md#v022採用済み再構成--executionとexecutiongroup)。

変更分類は公開契約・永続Schema・複数利用側へ波及するRefactor。着手前整合確認では現行EI Source／Architecture／Reality Audit、CoordinatorのProducer／Reader、Workbench／MCPの活動表示、共通Lock、過去の保存検証を照合した。読み取り専用の独立確認から、必須Recovery通知と任意EI保存の例外分離、開始前拒否の記録差、未解決保持、旧形式の出版前拒否、Provider時間の欠測を計画へ統合した。完成後はSource・保存異常・Consumerの独立レビューと限定回帰、文書・影響伝播の照合を行う。準拠基準・Releaseを変更しないため準拠／Release監査は今回選ばない。全体回帰・実AI・実Dockerは保留し、PA・DI・Executor製品Sourceを変更しない。

| 基準版Capability／利用側 | 新Ownerと予定処置 | 予定する確認 |
|---|---|---|
| `dispatch.ts`の終了時Taskイベント生成・保存 | Provider要求直前と元Completionへ同じEI実行IDを接続。CRDD ID・Activity用技術情報はCoordinatorの投影。旧終了Writerを並走させない | Task／Advice／Provider Probe各用途で一実行一記録、開始前拒否は開始0、取消・Completion拒否は未完了／不明を保持 |
| `provider-executor.ts`の必須Provider Intent | 既存保存成功後にEI開始記録を独立try/catch。EI失敗を既存必須通知の失敗へ変えない | Recovery保存拒否はAI要求0。EI拒否・throwは新しい停止条件を生じない |
| Task受付時刻・Completion受領時刻 | AI要求直前の時計を別に取得。後処理込み経過時間とProvider実測時間を分離 | 準備遅延・Cleanup遅延がProvider実行時間へ混入しない。未取得は欠測 |
| `state/observation.ts`のProject別履歴と活動投影 | EI一覧を取得し、CoordinatorがapplicationとCRDD metadataを検証して既存Activity契約へ写す | 他Project混入0。旧形式・破損・必要metadata欠測を正常空履歴へ畳まない |
| Workbench／MCPの活動表示 | CoordinatorのActivity契約を維持。EI直接依存を追加しない | 既存活動表示・cursor・不明結果のConsumer限定回帰 |
| Group（現本番Producerなし） | 一連の実行依頼の生涯を所有するCoordinator側で開始・終了。Task階層をEIへ移さない | Group終了後の未完了・unknown子を集計に残す。子の自動終了0 |
| 現Storeの期限保護 | Coordinatorが既存未解決条件を汎用保持状態へ写し、EI Storeが未完了／不明／未解決を保護。未完了Groupと保持対象の子から参照されるGroupも保護 | 期限境界と未知結果・Cleanup未確認の保持。Group期限超過＋未完了子／未解決子、および全子が整理可能となる場合の参照保全 |
| Lock・pending・fsync・出版前後確認 | EI storage＋既存共通Lock。異常時も同じ記録ID・残存参照を結果へ保持 | 複数Process競合、重複・内容競合、途中失敗・出版後確認失敗・解放不明 |
| DM／VCによるRoot・保持設定 | Coordinatorが既存Ownerで保存先を確定し明示StoreOptionsを渡す。EIはNode実体検査 | 非リンク・別実体・Hardlink・上限・観測不能。任意親作成0 |
| 旧永続履歴・旧Evaluation等 | フロントAIが別途移行。EIの旧Reader／fallbackなし。品質評価・改善提案・時系列評価APIを撤去 | 新品fixtureの旧形式一行でも書込み拒否、混在拒否、既存bytes保全。実保持物は非操作 |

開始前のTask拒否をEIのAI実行として記録しなくなる点は意図したCapability変更である。拒否の結果はCoordinator／Domainの既存正本に保持し、EIへ架空の開始を作らない。EI履歴は実行・回復のAuthorityへ昇格しない。

実装順は共通型・単一Store、9操作、Coordinator開始／終了・Activity投影、旧Source／Root export撤去、試験・台帳・文書の追従、限定回帰・独立レビューとする。途中段階を本番切替済み・EI完成と表示しない。現在、人間による追加判断は必要ない。

### 候補SourceとVerificationの対応

| 変更した意味 | 現在の実装・確認先 | 評価の限界 |
|---|---|---|
| 旧Factory・用途別Event・評価の撤去 | EIはRoot＋record五Source＋storage二Source。Rootは9関数・13型、DM／VC importなし。新公開面の契約試験 | 旧品質評価・Revision鮮度分類の成立は主張しない |
| 単一履歴の遷移 | `history.jsonl`のv3行でExecution／Groupの現在記録を保存。createとcompleteだけが遷移し、同内容再送／異内容競合を区別 | 新しい汎用更新・回復・移行APIなし |
| 保存・回収の異常 | 新EI42試験で旧形式・混在・破損・残存保全、出版前後故障、File増大、pending実物置換、複数Process競合、Crash残存、Group保持、検索・欠測・費用の分離を確認 | Root置換はWindowsのLock下で移動自体が拒否されるため、Root実体観測差とpending実物置換の組合せを注入。任意敵対Processへの原子性は主張しない |
| 準備時間と終了の分離 | Coordinator `provider-intelligence.contract.test.ts`で14件成功。元CompletionでAI終了時刻を固定し、上位最終判定後に保存する。AI成功後のHost清掃失敗・取消Protocol失敗・Process再使用不可、複数AI・capture欠測・重複確定・下位再起動必要の保持・同Group ID診断・保存先準備の元Effectと回復参照の保持を確認 | 実AIの計測結果ではない。選定Modelは要求設定として保存し、実使用Model／Usageを実測済みとしない。Group開始や保存先準備の例外分岐は実Sourceを有限依存で実行した局所検証 |
| 必須Recoveryと任意EI | 既存`docker-process-controller.contract.test.ts`117件成功。Recovery保存拒否と取消で後続要求を止める既存保証を確認 | 新しいEI通知が実AIを呼んだ根拠ではない |
| 呼出し側・管理情報 | 活動fixtureは新公開操作へ直接接続し、旧形式Adapterを残さない。旧Revision／評価専用試験を退役し、Group・Query／Summary・Provider接続の試験へ責務別に対応。台帳409件valid | 台帳のvalidは試験合格・網羅性証明ではない。全体回帰は保留 |

独立Coreレビューの4指摘（pendingの元実体照合、descriptor取得後の読取り上限、期間のexact入力、Cost非該当の分離）をSource・反証試験へ是正した。廃止機能の試験削除を、存続する保存・回収保証の省略理由にはしない。保存故障のwrite／fsync注入は共通Lockの初期化ではなく、今回pending descriptorへ実際に到達したことも確認する。

Consumer再レビューでは、下位Completion直後の保存が上位Host清掃・取消判定より先行する問題、共通Task入口のメタデータ搬送不足、開始記録の前提取得失敗時に元ID診断が欠ける問題を検出した。読み取り専用の着手前再照合を経て、AI終了観測の固定と上位最終保存を分離し、Taskの短命な記録配列とAdviceの既存終了経路へ接続した。上位結果投影の例外はopenのままexact IDを診断し、未取得のProcess再使用可否をfalseへ補完しない。下位の再起動必要trueを上位falseで消さず、Groupの保存先拒否でも同じIDを診断する。Source最終再レビューの必須残指摘は0件。

限定回帰の現在値はEI42件、Controller117件、Provider記録14件、共通Taskメタデータ搬送1件、Advice選定・結果7件、活動Reader9件、Task取消・回復参照2件が成功。MCP活動1件、Workbenchの現在表示・履歴継続・local／CROS管理の計4件も成功した。DM試験選択／保存ConsumerとVC Consumer照合の3 Suite42件、Coordinator責務分類6件は、旧Source・旧直接依存の期待値を現Ownerへ追従後に成功した。最終是正後はEI・Controller・Provider・Advice・責務分類の同一実行186件も全成功。EIのcheck、Coordinatorのstrict／tests、Workbench／MCPの型検査、変更Sourceのformat／lint、差分空白検査と台帳409件validを確認した。今回作成したfixtureは各試験のcleanup hookで回収した。

途中候補の広めの103件実行は100件成功・3件不合格だった。内訳は撤去中の旧記録通知試験1件と、実行開始後に撤去した旧Projection試験Path2件であり、最終候補の一括成功には読み替えない。最終候補は新契約の限定回帰を個別に確認した。試験入力のnull prototype比較・重複Execution ID・旧Consumer期待値の是正も、製品の検査緩和ではなく現契約への追従である。

管理情報レビューで削除済みEI Symbol参照6件、旧DM直接依存Binding、不存在Path、旧Architecture Anchor、旧Consumer試験接続と永続操作の純粋分類が見つかった。実在Symbol・現在のCoordinator搬送・保存／活動試験へ対応付けて是正し、旧Evaluationを新Queryへ名目上継承しない。全体回帰・実境界計測・旧データ移行・System／UAT・Releaseの成立は本結果に含めない。

追加のConsumer試験レビューで、保存先準備に含まれるIgnore登録の既知Effect・元回復参照を通常Errorへ縮約する退行を検出した。既存のready要求／Error型をCoordinatorで利用し、同じEI recordIdと別の元recoveryReference、Effect・清掃・再試行可否を既存受動診断へ保持するよう是正した。Execution／Groupの実Sourceを有限境界へ接続して新規記録write 0・実行継続・元情報保持を確認し、Sourceと管理情報の両独立再レビューで必須残指摘0件。新しい回復機構・自動再送・EI公開型変更は追加していない。

コミット前の再確認では、旧API・削除済みSource・Symbol／台帳参照と利用側を再照合し、追加の必須指摘0件だった。EI／Coordinatorの限定試験にDM／VCの接続監査試験を加えた同一実行228件が全成功。EIのcheck、Coordinator strict／tests、Workbench／MCP型検査、変更Sourceのformat／lint、台帳409件validと差分空白検査も再確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

## DI技術契約への収束（2026-11-02、完成条件の更新）

準備値生成移管の文書検査は、更新四文書の対象内指摘0件。参照展開先328指摘と終了値1による全体不合格は維持し、全体QA成立へ読み替えない。

準備値生成の固定候補結果：HEAD相対Source132 Path、内容Hash `89d2b7edc6840b5f2d3934805b7b912eaa2e7d8c8bda437ef22085aae1e5ea06`。DIで本番利用のなかった三関数をExecutorの既存operations内の非公開関数へ移し、旧宣言・旧名・専用型のTypeScript参照は零となった。Rootの公開関数・定数は24から21項目へ減少した。新しい製品Source、公開入口、型、Store、互換Wrapperは作っていない。

DI対象155件、Executor全97件、Coordinator対象五Suite161件、CheckerのDI公開契約1件が成功した。Executorの件数増加は試験移管と既存ケースからの分離であり、そのまま網羅性向上とみなさない。DI／Executor／Coordinatorのcheckが成功し、SourceとArchitecture／Qualityの独立レビューは必須残指摘0件。Source確認者の新Owner有限試験を含む五件も成功し、全体件数へ重複加算しない。名前・予約名・Buffer型／長さ・乱数取得回数・例外同一性とDI側の安全検査は維持した。

今回、実AI・Docker・過去保持物・既存indexの操作、Commit／Pushは行っていない。共有Identity検査・init条件・固定資源Catalog・例外分類・Checkpoint・公開型の整理は残り、DI全体完成を主張しない。先行のEngine fixture誤接続二実行の実読取り到達有無も未確定のままとする。継続に追加の人間判断は必要ない。

準備値生成の着手前照合：外部製品利用がExecutor準備だけの三関数をattempt/operations.tsのローカル関数へ移す。乱数と資源名・認証環境を決める用途準備をDIへ残さず、DIの実行前Request・Identity・Image・Mount検査は維持する。専用の戻り値型を撤去し、六項目を署名へ明示する。既存の正常・拒否・境界・例外の試験を新Ownerへ移し、Factory結合も確認する。共有Identity検査・init条件・保存Schemaは対象外。SourceとArchitecture／Qualityを独立確認し、実AI・Docker・過去保持物・既存indexは操作しない。

結果分類接続の固定候補結果：Source132 Path、内容Hash `fcadc1059976bc7a10fb857fd0f69d97cb0d25b9b5bf17dc1f4dae9b105d7ec1`。共通観測Ownerから既存二分類を通知し、Executorの再分類とDI Root二関数を撤去した。公開値は26から24項目となった。同期通知・元観測・Receipt・取消・終了確認・回収の順序と三つの分類軸は維持する。

DI対象142件、Executor全95件、Coordinator対象七Suite187件（別の三Suite124件と四Suite63件）、CheckerのDI公開契約1件が成功。DI／Executor／Coordinatorのcheckが成功し、SourceとArchitecture／Qualityの独立レビューは必須残指摘0件だった。Source確認者の新規分類試験12件も成功し、全体件数へ重複加算しない。移行中の型専用importのLint不合格は是正後の成功と区別する。

更新四文書の検査対象内は指摘0件、参照展開先328指摘と終了値1は全体不合格として維持する。例外分類・構成補助・Checkpoint判定・公開型の整理は残り、DI全体完成を主張しない。今回、実AI・Docker・過去保持物・既存indexの操作、Commit／Pushは行っていない。先行のEngine fixture誤接続二実行の実読取り到達有無は未確定のまま。今回の継続に追加の人間判断は必要ない。

結果分類接続の着手前照合：DI元観測をExecutorが再分類していた二箇所を、既存onObserved通知の末尾二引数へ既存の分類型で搬送する形へ統合する。通知順序・同期性・Receipt・Process終了・回収条件、分類優先順と固定エラー分類の独立性は維持する。DIの分類二関数はRootから撤去し、純粋判定は内部で使い続ける。Executor自身のcatchにも使う例外分類は維持し、公開数削減のために分類表をコピーしない。新API・Model・Store・Schema変更を追加せず、利用側・有限代役を新しい通知署名へ一括追従する。SourceとArchitecture／Qualityの独立レビューを行い、実AI・Docker・過去保持物・既存indexは操作しない。

回収・照合公開の固定候補結果：HEAD相対Source129 Path、内容Hash `04985001156bf2ec3382762fdc8e3d7e23c5f0066e4ae02f5d53cc000fb88853`。低位10値・関連14型のRoot公開を撤去し、値の公開集合は36から26項目になった。製品未使用の薄いFactoryはtests/supportへ移し、共有coreと内部の本番9値は維持した。元のcallback・config・ID欠測・最小照合・出力上限・取消条件は変更しない。

DI対象130件、Executor全95件、Coordinator対象9 Suite・200件（別の四Suite161件と五Suite39件）、CheckerのDI公開契約1件が成功。DI／Executor／Coordinatorのcheckも成功した。移管直後の型専用importと不要となったRoot namespace宣言によるLint不合格は、是正後の成功とは別に保持する。SourceとArchitecture／Qualityの独立レビューは必須残指摘0件。更新四文書の検査対象内は指摘0件、参照展開先328指摘・終了1による全体不合格は維持する。

Root全体の完成ではなく、実行構成補助・結果分類・Checkpoint判定・必要な公開型は未整理として残す。今回、実AI・Docker・過去保持物・既存indexの操作、Commit／Pushは行っていない。前段のEngine fixture誤接続による実読取り到達有無は解消扱いにしない。現段階の継続に追加の人間判断は必要ない。

回収・照合公開の着手前照合：対象10値のうち9値はDI内部の本番観測・回収・構成診断が使うため内部に残す。製品利用のない薄いcreateDockerResourceRecoveryExecutorだけ試験支援へ移し、本番共有coreは削除しない。外部製品から直接使わない関連14型もRootから除き、試験は元Ownerの同じ型を再利用する。config照合・取消・ID欠測・出力上限・回収条件、共通入口の本番接続は維持する。mock後のdynamic import順序を保持し、新Store・Wrapper・subpath・処理コピーを作らない。SourceとArchitecture／Qualityの独立レビューを行い、準拠／Release条件は変更しない。AI・Docker・過去保持物・既存indexは操作しない。

環境低位公開の固定候補結果：HEAD相対Source121 Path、内容Hash `c7c361343deba4607ec73bded408fba9c059fc7822b240cebb06ad36b4bbc186`。対象16項目（15関数・待機定数1）のRoot公開と外部named importは零。共通環境二入口、本番認証構築、必要な戻り値型、技術処理本体を維持し、検証側だけ元Ownerへ接続した。DI75件、Executor全95件、Coordinator対象49件、Platform Accessの有限試験56件、CheckerのDI公開契約1件が成功した。DI／Executor／Coordinatorのcheckも成功。Windows File mapによる整形不成立と型専用宣言のLint不合格は別runとして保持し、是正後の成功へ読み替えない。

Source独立レビューは必須残指摘0件。Architecture／Qualityの旧Root公開説明と隣接するDirectory説明の計3箇所を同じ公開境界へ追従し、再レビューは必須残指摘0件。更新四文書の検査対象内は指摘0件、参照展開先328指摘・終了1は全体不合格として保持する。実行構成補助・結果分類・Checkpoint検査と公開型の整理は未完了。下段のEngine fixture誤接続二実行の実読取り到達有無は未確定のままで、修正版の有限成功で過去の実操作0を証明しない。AI送信・Docker作成／削除／再起動・過去保持物操作・Commit／Push・既存index操作は行っていない。

環境低位公開の着手前照合：本番利用側を調べ、共通環境二入口が既存技術処理を束ね、対象低位16項目は外部製品Sourceから直接使用されないと確認した。任意に低位を組み合わせるRoot入口を撤去し、有限検証は元Ownerへ直接接続する。認証環境構築と必要な戻り値型は維持する。新subpath・Wrapper・Store・処理コピー・環境操作の条件変更は行わない。SourceとArchitecture／Qualityを独立確認し、準拠／Release条件は変更しない。

この移行中、Engine fixtureを静的importへ移したことで模擬依存の設定より先に実モジュールが読み込まれ、対象試験は不合格となった。原因確認の有限fixture単独実行も同じ不合格で、両実行を成功又は実操作0へ換算しない。実環境の読取り到達有無は保持診断だけでは未確定。対象経路に作成・削除・再起動はなく、Dockerや保持物の追加確認は行わない。fixtureを依存置換後の動的importへ戻して再検証する。本番の出所・取消・期限条件は緩めない。

単一Container・固定Directory接続の結果：Source112 Pathの固定候補 `f6ff4c4a5eb33962aaf9bd5668ff7d909f2c693eb44374c0aff2a9b10a4a1073` で、ExecutorのDocker接続・三軸不存在→inspect合成と技術四型をDIへ移管した。旧低位六関数をRootから撤去し、両技術対象はinspectIsolation／cleanupIsolationへ接続済み。認証単独回収も既存共通Cleanupへ接続済みのため、用途別DI分岐は追加していない。

Executor全95件、DI対象65件、Coordinator対象4 Suite・55件と準備／Effect／Process／回復順序5 Suite・161件、Checker公開契約1件が成功。最終の型専用import二箇所と同じ参照先の再export統合後、Coordinator該当12件・Executor該当12件も成功した。これらの部分再実行を全体件数へ重複加算しない。Executor／DIのcheckとCoordinatorのcheck（追跡検査を含む）は成功した。初回型検査のUnion結果literal推論と検証Scriptの旧Root参照、および全域Lintの型専用import警告二件は是正前の不合格として保持する。

Source独立レビューは必須残指摘0件。Architecture／Qualityの旧説明3箇所を両レビューで統合した方針に従って是正し、再レビューは必須残指摘0件。更新四文書の検査対象内は指摘0件だが、参照展開先328指摘・終了値1は全体不合格として維持する。同期Container・Directory元Promise・最小ID照合・欠測ID条件・Scope・現在確認・取消・安全条件は維持。実AI・Docker・過去保持物・既存indexは操作せず、Commit／Pushも行っていない。DI RootのCheckpoint・設定・低位Process等の公開整理と実境界再成立は、今回の完成範囲には含めない。

単一Container・固定Directoryの着手前照合：同期ContainerをIsolationExecutionへ強制変換せず、共通二入口の技術種別overloadに接続する。Executorの限定CLI接続と三軸不存在→inspect合成をDI既存container.tsへ移し、技術型もDIを正本にする。固定Directoryは既存Scope・Artifact・Checkpoint・現在確認・取消を維持して同じ二入口へ接続し、元Promiseを包まない。認証は既に共通Cleanup接続済みなので新しいDI用途分岐を作らない。旧低位六関数のRoot公開を撤去するが、有限検証の内部関数接続は明示的に残す。SourceとArchitecture／Qualityの独立確認を行い、実AI・Docker・過去保持物・既存indexは操作しない。

資源集合観測の最終文書確認：更新四文書の検査対象内は指摘0件。参照展開先を含む328指摘と終了値1は維持し、全体文書検査を合格へ読み替えない。Executorの対象表に残った旧型名一箇所は現在のAttemptRecordProjectionへ追従し、独立差分確認の必須残指摘は0件だった。

今回の目標は公開Export数ではなく、認証・Attempt・Probeの用途別LifecycleをDIに残さないことである。三用途は同じIsolationRequest、prepareIsolation→executeIsolation→runIsolation、通常・単独の同じ資源照合・回収を利用する。DIの分岐は資源種別、Process方式、Network／Mount条件、技術Stepに限定する。用途固有構成と意味解釈はExecutor、保存・同意・Task進行は上位へ残す。

公開目標は技術実行四操作と環境二操作。構築前に必要な静的Image／配置／Proxy情報は実環境観測へ混ぜず、必要最小限の純粋Catalog一入口を認める。Network同意投影は同じ技術Policy正本を用い、保存済みCheckpointの判定は記録Ownerと技術検証を分離する。数合わせのWrapper・用途別Runtime・新Manager／Storeは作らない。任意Image・Mount・Network・Processへの開放、期限・通知失敗・ID欠測・Directory条件・取消・元回復参照の緩和はしない。

| 実装単位 | 対応と現在の区分 |
|---|---|
| 環境二操作 | 実装・局所回帰・独立レビュー完了。Executorの既存束ね処理をDI docker-desktop/operations.tsへ移管。既存入力・結果を再利用し、Executorは同じ公開関数を再exportする |
| 静的Catalog | 実装・非AI回帰・独立レビュー完了。構築前metadataと同意前実効Policyを同じ純粋入口へ統合し、旧四入口のRoot公開を撤去。実Engine観測は増やさない |
| 技術Request正本 | 旧固定Command配列と共通Requestの二重表現を製品から撤去し、確定Requestを一度構築する。非AI回帰・独立再レビュー完了。実AI・実Dockerの再成立は未検証 |
| 観測・回収 | Executorの対象別振り分けを技術種別へ置換し、通常・再入場を同じ回収実装へ接続する。単独同期Containerの既存契約差は未解決のまま記録 |
| 公開型・旧Root | 必要な資源操作入力を既存型から統合し、用途別Session／回収型は共通結果へ接続後に撤去する。隠すだけでは完了としない |

資源集合観測の固定候補結果：HEAD `b87ed8fee` 相対のSource変更104 Path、内容Hash `84d43142c09961ec2fe2939a586aea4bf815a7b795c1fbacfb12024e7f47535e` を確認した。Executor全95件、DI共通Lifecycle・Snapshot・資源観測・旧Oracle・公開境界の合計71件、Coordinatorの準備・Effect・Process・回復順序5 Suite・161件と回復対象・開始終了2 Suite・29件、CheckerのDI公開index一件が成功した。Executor／DIのcheckとCoordinator型検査も成功。SourceおよびArchitecture／Qualityの独立レビューは必須残指摘0件で、Source確認者の資源観測3件も成功した。試験の重複実行は件数へ重複加算しない。

この単位では、DIの旧inspectDockerResources／cleanupDockerResources公開と保存投影型を撤去し、Executorが元Operation／Recovery相関を付与する。観測後の欠測ID再照合でも完全構成検査を保持し、入力Snapshotを実測結果として返さない。初回Executor全体回帰のファイル一覧Oracle追従不足は不合格として残し、recovery.tsの新配置へ追従した固定候補の95件成功を用いる。実AI・Docker・過去保持物の操作、Commit・Push、既存indexの変更は行っていない。単一Container、Directory、認証単独Cleanupと旧Root全体の整理は未完了であり、DI全体完成や実境界の再成立は主張しない。

資源集合観測の着手前照合：元Operation／Recovery相関と五資源投影からの変換をExecutorへ戻し、DIのinspectIsolationはSnapshot・明示探索候補・技術観測条件だけを受ける。既知IDは実ID・名前・所有Labelの共通観測へ接続し、構成差を拒否条件へ戻さない。欠測IDは指定候補の完全構成照合だけ、未要求は要求0、名前／Labelの不存在は二回、観測不能・config終了失敗・取消を成功へ畳まない。認証資源の限定観測だけにある「最初の不存在不明で打切り／欠測IDを探索しない」は、Executorが選択した対象と候補、既存の技術観測条件として搬送し、DIに用途名分岐を残さない。単一Container・Directoryは既存条件をこの単位で変更せず、観測・回収全体完成とはしない。変更分類は公開技術IFと責務のRefactor。SourceおよびArchitecture／Qualityの独立レビューを行い、準拠基準・Release条件は変更しないためその監査は追加しない。実AI・Docker・過去保持物は操作しない。

旧Command配列撤去の着手前照合：Factoryが確定所在を先に捕捉し、Executor内で用途構成とIsolationRequestを一度だけ構築して深く固定する。開始後のDI prepareによるCLI・Directory実体捕捉は前倒ししない。元Plan・Capability・HomeLease・通知・Receipt・回収の順序を維持する。旧payload件数・byte・予約環境名・Pathの拒否を構成Ownerで維持し、固定Seccompの実物照合は実行前DI prepareへ集約する。Seccomp実物異常ではFactoryのnullから開始後のEffect前拒否へ検出時点が移るが、異常構成を実行しない条件は変更しない。構成診断は同じRequestへ投影し、旧argv逆解析を撤去する。旧argvと相関Hashを使う有限試験は試験専用Ownerへ分離し、本番と同じCompilerを通る接続試験を別に維持する。新しいManager・Registry・Storeは追加しない。SourceとArchitecture／Qualityを独立確認し、実AI・Docker・過去保持物は操作しない。

固定Request接続の結果：製品PlanはIsolationRequestだけを保持し、開始・構成診断・未開始回収が同じ深い不変値を使う。DIの旧九操作Compiler・Proxy逆投影・argv診断・全Command比較の四関数を製品SourceとRootから撤去し、tests/support/execution-plan.tsへ有限Oracleとして分離した。旧planIdentityとresolveValidatedPlanは試験Scriptに限定し、利用側の旧Command試験は明示TestAttemptPlanを使用する。本番へ旧fallbackは追加しない。

Source候補95 Pathの内容Hashは `7e5b64a73bf9761d7a4e35d6484ce83a92bdcb56cf7a0450565da24f4ebf8fde`。Executor全95件、実Executor→実DIと有限CLIを含む共通Lifecycle／Snapshot46件、DI旧Oracle／公開境界22件、Coordinator関連7 Suite・184件、CheckerのDI公開index一件が成功した。Executor／DIのcheckとCoordinator型検査は成功した。初回回帰の模擬Plan・子Process試験のRequest追従不足、旧Oracle読取り先と型専用importの不合格は履歴として残し、是正後の再実行で確認した。既に失敗した旧Coordinator回帰Processは終了待機が残ったため取消し、そのrunを成功にせず、是正後の独立runの184件成功を用いた。

独立Sourceレビューは追加必須指摘0件。Architecture／Qualityの旧現在説明5箇所は両レビューの是正方針を統合後に追従し、再レビューで必須残指摘0件となった。上限・期限・実行許可・保存Schema・Home排他Hash・回収保証は変更しない。先行誤実行の未確認事項、全体QA不合格、過去保持物は解消扱いにしない。Commit・Push、実AI・Docker・過去保持物の操作は行っていない。

是正後の更新四文書の検査対象内は指摘0件。参照展開先を含む328指摘により検査全体の終了値1は維持し、全体文書検査を合格へ読み替えない。

技術Requestへの移行前に、旧DI bindingが用途固有の意味検査も所有していたことを確認した。Provider・用途・固定Image・RoleとWorkspace権限・PolicyのProvider一致・認証環境・Seccomp選択をExecutorの既存resolveIsolationCommandInputへ統合し、旧DI Source・Root関数・専用入力型を撤去する。初回Tokenと開始前の元Command投影・Profile／Policy一致を維持し、argv Compiler、Home排他Hash、Capability、開始・取消・通知順・回収条件は変更しない。旧binding試験は新Ownerへ移し、metadata故障注入・三用途の正負例を維持する。旧九Command配列と共通Requestの二重表現自体はこの先行単位では未解決とする。変更分類は既存技術契約の責務移管。SourceとArchitecture／Qualityの独立確認を行い、準拠基準・Release条件を変えないためその監査は追加しない。

用途構成移管の確認結果：Executor全94件、DIの純粋構築・公開境界29件と共通Lifecycle／Snapshot46件、Coordinator関連7 Suite・184件、CheckerのDI公開index一件が成功した。DI／ExecutorのcheckとCoordinator型検査は成功した。初回の追加試験は合成Model選定・Claude作業量のfixture不足で不成立だったため、既存の正規選定と作業量を明示して再確認した。製品の拒否条件は緩めていない。旧binding関数・型のTypeScript参照は零、Checkerの削除済みModule期待一項目も追従した。SourceとArchitecture／Qualityの独立再レビューは必須残指摘0件。固定Source候補はHEAD相対81 Pathの作業内容Hash `5733d95363ca436cac8e32e5b37a62cf7fa5189e01f08ec7442352429eac869f`である。

更新四文書の検査対象内は指摘0件だったが、参照展開先を含む328指摘により検査全体の終了値は1である。全体QA合格とはしない。実AI・Docker・過去保持物の操作、Commit・Pushは行わず、既存のStage状態も保持した。先行誤実行の未確認事項は解消扱いにしない。次は旧Command配列とRequestの二重表現、観測・回収の共通化と旧Root公開の収束を続ける。

着手前照合では、通常三用途の主実行Ownerはすでに共通であり、残る旧構成表現と周辺操作が対象と確認した。最初の環境移管では、元同期観測順、restart／repairの明示mode、入力・Promise参照、Signal、通知、unknownと後始末結果を変更しない。新Ownerのleaf依存を有限代役にした反例を維持し、Executorでは直接再exportと公開型を確認する。SourceとArchitecture／Qualityの独立レビューを行い、準拠基準・Releaseを変えないため準拠／Release監査は追加しない。実AI・Docker・全保持物は操作せず、先行誤実行の未確認も維持する。

静的Catalog着手前照合：describeIsolationCapabilities(provider, additionalHosts)へ既存Assets・配置・Proxyと通信Policyを合成する。追加HostをCatalogで走査せず既存の正規化へ直接渡し、blockedは通信条件不成立として利用側が判定する。認証は追加Hostを渡さない。primary／alternateは既存配置の技術slotであり、用途LifecycleをDIへ再導入しない。固定値・Hash・Secret・Authority・Imageの変更と追加I/Oはない。Provider別の明示型を正本として既存のtypeof導出も整理し、同意前Hash・構築前順序・不正入力・型相関を有限試験で確認する。Root全面撤去・実行入力Policy解析・Probe記述・Checkpointは別の未完了範囲である。

Catalog接続の現在結果：旧Assets／実行配置／Proxy記述とprepareDockerNetworkPolicyの四入口をRootから撤去し、ExecutorのAttempt／認証構築、Coordinatorの同意前Policy／診断投影とExecutorの三検証Scriptを新入口へ接続した。低位OracleはDI内部の正本を明示importし、旧入口や新Wrapperを再公開していない。namespace参照と型の利用側も追従した。Claudeにはalternateを作らず、Codexでは元Imageと配置の対応を維持する。型は実装のtypeofから導出せず、既存固定値を変えない明示契約へ整理した。

DI／Executor／Coordinator／AI Adapterのcheckが成功した。WindowsのFile map競合による初回Formatter不成立は成功に換算せず、対象Formatterとcheckをやり直して成功を確認した。非AI回帰はDIの純粋Catalog／Policy／旧構築・公開境界30件と共通Lifecycle／Snapshot46件、Executor全93件、Coordinator関連14 Suite・215件、AI Adapter利用側6件、CheckerのDI公開契約1件が成功。明示実Docker試験は選択せず、試験用CLIの全件確認もProcess・Home・保存の有限代役だけを使う。実AI・Docker・全保持物の操作はない。全体QA・新Catalogの実境界確認・旧Root全面撤去は完了としない。

Catalog最終候補：HEAD b87ed8feeからのstaged／unstagedと追加を含むSource変更79 Path、no-renames・Path順・内容HashによるSHA-256 172a785cecba22bfc04bf97caf4f63a4d70914f03622c057d8affb5a0914294b。途中のstage状態変化を検出したため、indexは変更せず、HEADと作業Tree全体を固定して確認した。独立Sourceレビュー必須0件、確認者の純粋Catalog3件も成功。Architecture／Qualityの旧未完了表示1件を文書だけで是正し、再レビューの必須残指摘0件。対象5文書のChecker指摘0件、参照展開先3,364指摘・終了1による全体不合格は維持する。Source・固定Policy・Hash・期限・Image・保存Schemaを再レビュー是正で変更していない。先行誤実行の保持・未確認状態も変更しない。

環境移管の局所結果：DI／Executorのcheck、Coordinatorのcheckが成功。DIの環境実本文と公開境界3 Suite・9件、Executorの直接再export・資源・共通型・公開境界4 Suite・15件、Coordinatorの再起動・準備順・修復Owner／結果4 Suite・64件、CheckerのDI公開契約1件が成功した。DI実本文はbackend／Engineの全分類、未知mode・Proxy・getter・余剰fieldの低位要求0、restart／repairの元Promise・Signal・入力・結果／Reject保持を確認した。初回の試験用変数のTypeScript絞込み不合格は冗長なfield参照を除去し、静的check成功後に同じ局所集合を再実行した。大目標の完了や実境界成立へ換算しない。独立レビューは継続中。

環境移管の最終確認：SourceとArchitecture／Qualityの独立再レビューは必須残指摘0件。旧公開型名と撤去済み構成図の文書追従1件を是正し、最後の同参照型import統合についても両者が差分確認した。現在Source候補は先行四系統を含む変更・追加・削除43 Path、Path順・内容HashによるSHA-256 9a7727be814c97c8fbc2eba7e2810e71c4aef59e9cee75ecd0e7c498066a68a1。MCP／Workbenchの型検査も成功。対象4文書のChecker指摘は0件、参照展開先326指摘・終了1は全体不合格として維持する。今回の環境移管では実AI・Docker・保持物の操作を行っていない。旧Source二ファイルと旧Request型名の現行Source参照は0件。静的Catalog以降の実装単位は未完了であり、公開IFと内部統合全体の完成はまだ主張しない。

## 共通入口整理後の残存四系統の最小是正（2026-11-02）

実装後の静的checkはDI／Executor／Coordinatorで成功。DI全361件は356成功・既存対象外5件、Executor全93件、Coordinatorの実Dockerを除く対象14 Suiteは260件成功。固定Probe記述の追加後はpackage-boundary全6件成功。Checker本体の型検査と変更試験Lintは成功したが、check全体は変更前からのtemplate/tools/crdd-coordinator.tsのTS1375で停止し、成功扱いしない。独立レビューは未完了である。

公開indexの全体試験は基準版からのExecutor母集団未登録で失敗した。既存の全体判定は緩めず、今回のDI公開契約だけを同じ検査関数へ渡す局所試験を追加し成功を確認した。全体の旧公開API表更新は今回の四系統とは分離し、全体成功を主張しない。

最終Source候補は40_Developの変更・追加・削除34 Path、Path順・内容HashによるSHA-256 fad2a615b60ce6eda04020d6ca4664326dc3c89f628a78cd79ee2ee734b66a4a。独立Sourceレビューの必須残指摘0件、確認者による通常／単独config終了の13件も成功。Architecture／Qualityの旧Probe Owner記述1件を文書だけで是正し、再レビューの必須残指摘0件となった。Source、期限、保存Schema、安全条件は再レビュー是正で変更していない。対象3文書のChecker指摘0件、参照展開先326指摘による終了1は全体不合格のまま維持する。四系統の実装・利用側接続・非AI回帰・独立レビューは完了したが、前記の誤実行で残った今回候補の不存在・回収は未確認であり、物理清掃完了や実境界の再成立は主張しない。

誤実行の範囲は記録済みの一候補だけに限定できない。未起動認証五資源試験もcreate_internal_networkで失敗しており、実ID未受領の要求を否定できないが、当該一時nonceを現存記録から復元できていない。別Processの認証作成fixtureも終了1である。したがって記録済み候補一件以外も含め、誤実行全体の資源不存在は未確認とする。追加のDocker照会・自動再試行・削除は発行せず、既存の試験名・時点・Sourceと現存する二領域を再確認の手掛かりとして保持する。

検証範囲の逸脱：Coordinatorの直接利用側Suite追加時に、実Dockerを呼ぶWindows Process Gateを除外し忘れた。該当試験は非0終了し、成功した資源作成は確認できない。以降のDocker観測・削除・再起動は実施していない。今回領域.crdd/tests/docker-isolation-host-iQPYKsに、認証Container候補crdd-auth-aea42dd2923ec42dのsubmitted=true・dockerId=null・unknownが残る。元相関2e5309f87db50db440aaa15245e8ea32bfdc8bca3fded2fa4116080824190e4fを保持し、回収完了としない。.crdd/tests/claude-authentication-record-0A6qkJも今回の空領域として保持する。過去保持物には操作していない。これらの実体確認・回収は現在の禁止範囲であり、人間の別許可なしに進めない。以降の対象回帰はWindows Process Gateを明示除外して成功した。

基準版はb87ed8fee。共通実行・回収、元実ID／名前／所有Label照合、ID欠測時の探索、同期Container回収、通知完了・取消・Directory条件を維持する。実AI・Docker・過去保持物は操作しない。

| 対象 | 処置と保持条件 |
|---|---|
| 短命configの終了確認 | 削除後のlstatでENOENTのみ不存在。存在、EACCES・EPERM・EIO等の観測不能は未確認 |
| 旧cleanupResourceSet | 試験支援へ移管。本番cleanupDockerResourcesと通知処理は維持し、VM試験接続も追従 |
| 旧Probe実行・fixture・分類 | 試験支援へ移管。実利用の固定資源記述は既存image/assets.ts、観測型は既存execution/result.tsへ置き、Root公開を維持 |
| 旧Runtime二型 | 試験支援へ移管。RuntimeOptions、HomeLease、Receipt、実利用Session型と汎用分類は維持 |

着手前整合確認は読取り専用確認者と照合済み。実利用型DockerProbeExecutionFactsはCoordinatorで利用されるため削除しない。Source、直接利用側、配置固定試験、Architecture／Qualityを追従し、型検査・有限境界回帰・SourceとArchitecture／Qualityの独立レビューを行う。準拠基準・決定権限・Releaseは変更しないため準拠監査・Release監査は対象外。現在、新しい人間判断は不要である。

## DI共通実行入口の全面接続（2026-11-02、着手前照合）

### 通常Attempt・単独Cleanup・旧入口撤去の閉包

最終記録の文書検査はPROJECT_CONTEXTを含む対象6文書の指摘0件。Repository全体には3361診断と終了値1が残り、今回範囲の成功を全体QA合格へ読み替えない。最終Source候補Hashは記録更新後も一致した。

最終Source候補は基準HEAD f8e7b0a7eからの三Packageの変更・追加・削除82 Pathで、Path順・各内容Hashから算出した候補SHA-256はdb18866e14bcd9ea0ba798da0ae0fafcb8652707979b3d5e5c932956fb7c1e1c。記録更新を除き、独立再レビュー後のSource変更はない。

最終確認：Source接続と旧入口撤去の今回範囲は完了。DI全348件は343件成功・既存対象外5件skip、Executor全93件成功、Coordinator対象12 Suite・240件成功。DI／Executor／Coordinatorの静的check、既存のRuntime／Task設計追跡検査、MCP／Workbench型検査が成功した。SourceとArchitecture／Qualityの独立再レビューは必須残指摘0件。Source側は最後の同期collector誤Promise／Reject捕捉を対象7件でも独立再実行して成功した。今回の実AI・実Docker・Docker再起動・Image更新・過去保持物操作はない。全体QA・Release成立や新入口の実境界再検証完了へは換算しない。Commit・Pushは今回の継続指示に含まれないため未実施。

実装候補では、通常Attemptの五資源・九操作を実DIのprepare／executeへ、Attempt・認証の単独回収をcleanupIsolationへ接続した。旧認証実行、固定九操作Runtime／Session、固定Probeの旧作成・実行・取消・残存生成とpayload選択を製品Source／Rootから外し、既存の有限反例を試験supportへ分離した。必要な純粋資源metadataと同期Container単独操作は維持する。後者の同期性・三軸不存在・既不存在時の挙動は、共通非同期Ownerへの形式統合のために変更しない。

独立レビューでは、過去不存在の反証後に次資源へ進む漏れ、単独回収通知の一次理由欠測、通常Attemptの実Executorから実DIまでの連結試験不足、旧Probe入口と文書参照、Snapshot返却とhostPathReported:falseの矛盾を検出した。不存在反証後は追加操作0、通知失敗を既存Failureへ固定、単独Recoveryの資源終了通知→config終了→最終通知の旧順序、Provider→認証Probe→Proxyの旧回収順へ是正する。SnapshotにHost Mount元を含むExecutor Completionだけは事実値を返し、StartResultとSnapshotを落とした上位DTOのfalse・Core保存Schemaは維持する。

非AIの連結試験は、両Providerの実Executor入力構築→実DI capture／compile／実行Owner→有限Processまでを通し、正常・保存通知拒否・取消を固定する。Codexではstdin・Seccomp・保護Mountを確認し、ポインタFileの内容／型差はRepository内の新品領域で実metadataを確認する。独立片側の成功や旧supportの成功をこの連結根拠へ換算しない。是正後候補の全回帰と独立再レビューが成立するまで全体完成とは表示しない。

人間の継続指示により残る接続準備だけで止めず、通常Attemptと単独Cleanup、利用側・旧公開入口の撤去まで同じ範囲で閉じる。基準版f8e7b0a7eと先行差分を保持する。変更分類は技術契約の責務移管。SourceおよびArchitecture／Qualityの独立確認を固定し、準拠基準・Release条件の監査はそれらを変えないため非発火。実AI・実Docker・過去保持物、保存Schema・追加Lock・Store・Registry・自動再送は対象外。

着手前照合で、旧Sessionの通知名・失敗種別・固定例外分類・Handle取得・応答観測を共通Ownerの発生点へ対応付けること、管理／通常MountはDirectoryを維持し保護read-only /work/.gitだけ元File／Directory型を捕捉すること、認証existing_idle回収前の管理所在取得、旧HomeLease namespaceと元結果相関の移管が必要と確認した。ID欠測発見後の通知と削除直前完全構成照合、Auth欠測の正規不存在観測、Directory固有条件を維持する。Snapshotの発行事実をfresh存在観測で補完しない。

編集の対応は、DI execution/types・preparation・operationsへ共通実行／回収と診断、Executor attempt/operationsへ固有構成と共通入口接続、lifecycle/cleanupへ確定資源の搬送、authentication/operationsへ固有結果解釈、Coordinator authorityへ管理所在取得／終了の順序、旧DI用途別実行入口と検証専用Consumerの撤去／試験入口移管とする。正常・拒否・取消・通知失敗・Process未終了・ID欠測・Receipt保存失敗・構成差・別対象・後着通知・空／非空／差替え管理領域を反証する。各旧Consumerは製品利用・試験利用・型参照に分けて全数検索し、未接続を成功へ読み替えない。

### 認証管理領域の承認と通常認証の接続

人間は上位確定の管理領域を認証にも渡すことを承認した。公開FactoryへAuthenticationOptionsを追加し、認証固有構成を共通DIへ接続した。上位は既存Home LockとRecovery記録を使い、完全Home Hashを含む記録Pathから管理所在を導出する。受付がunknown／in_flight／別操作activeならHost作成0、実行可能時だけexclusive作成し、同Processの元実体・空・明示不存在を確認して終了する。由来不明既存の再利用・削除、Schema・Store・Lock・自動回復の追加はしない。

認証のCompletionは共通DIの非秘密ResourceSnapshotを返す。Factoryは値固定だけ、管理Directoryの実体準備は上位取得後のstartで行う。独立レビューで終了1＋認証済み出力の矛盾と、suffixの型変換／options getterの実行を検出した。終了1は正規未ログイン時だけ受理し、文字列の先行検査・単一own-data options・明示fieldコピーへ是正する。過去の中間回帰91件成功だけでこの負例の解消を主張しない。通常Attempt、旧認証単独Cleanup、資源集合の上位Snapshot接続、旧入口撤去は未完了である。

是正後の認証接続候補はSource／Architecture・Quality独立再レビューの必須残指摘0件。Executor全91件、Coordinator対象12 Suite・240件が成功し、DI共通入口の資源集合／Service開始を含む12件も成功した。Executor checkとCoordinator型検査も成功した。製品から不要になった旧認証Lifecycle Adapterは既存試験scriptへ本文を移し、移管後の関連Executor19件・Coordinator認証29件が成功した。これは認証の通常実行の中間接続であり、旧単独Cleanup・通常Attempt・旧DI入口全面撤去の完了ではない。実AI・実Docker・過去保持物の操作、Commit・Pushは行っていない。

前項の未commit先行差分を保持し、三用途の技術実行順序・取消・Process終了・Receipt・回収を共通DI Ownerへ接続する。用途判定・AI結果解釈はExecutor、保存・許可・排他保持は上位に維持する。kind別の旧Runtime呼出しだけでは完了としない。通常setup10秒／実行300秒、認証非対話30秒／対話無期限・TTYと出力非捕捉、Probeの既存期限と64KiBを維持し、serviceの開始確認をservice終了待機へ変更しない。

新しい管理領域・永続State・Manager・Registry・Store・汎用Workflowは追加しない。認証は既存の固定System32と空Docker環境の契約を保持する。Home排他の既存namespace・元Lease・解放条件と、元Runtime／操作の終端相関を新しい公開Completionへ対応付ける。コピーや別操作の値から実行・終了権限を構築しない。Snapshotの発行状態は実際の発行事実から搬送し、inspectの存在観測から補完しない。

SourceとArchitecture／Qualityの独立レビューを実行する。正常・取消・二重取消・通知待機中取消・通知失敗・Process終了不明・Cleanup失敗・部分準備失敗、欠測ID発見後の構成差、非秘密Snapshotと不正要素のnullを検証する。旧入口の製品利用と検証専用利用を全数対応付け、検証Capabilityを失わず移管する。実AI・実Docker・過去保持物は操作せず、過去実AI8項目の成功を今回の実境界検証へ流用しない。

## DI共通技術IFと最小Identity回収の実装計画（2026-11-02）

以下の中間接続・回帰は認証接続前の時点の履歴である。現在の接続範囲と認証承認・是正は上の「認証管理領域の承認と通常認証の接続」を参照する。

共通実行Ownerと固定Probeの接続を中間実装した。新入口は用途名dispatchを持たず、確定技術構成のcreate／connect／run、通知、元Handle、取消、Receipt、回収とconfig終了を所有する。Probeのpayloadと判定はExecutorへ移管し、従来20反例を新しい入口へ対応付けた。一方、通常Attempt・認証・資源集合／認証Snapshot・旧入口撤去はまだ未完了である。

中間独立レビューは、専用configを省略できるnull経路、constructor経由の未検査準備・prototype変更、疎配列の黙った変形、Probe期限の再起算を検出した。管理所在必須化・constructor内captureとprototype固定・正規配列indexの範囲検査・request／started起算点の明示へ是正した。認証には現在管理所在引数が無いため、上位確定所在を追加するAPI判断を人間へ依頼し、勝手な作成先や既定configを採用しない。根拠のない再送・実Docker確認はしない。

初回の中間回帰では、DI全327件が新Root export三件のOracle未追従により1件不合格、321件成功・既存対象外5件skipだった。Coordinatorの旧Probe用VM Adapterも新共通入口へ未接続で、対象6件中3件が不合格だった。この初回失敗は履歴として保持する。

是正後、Coordinatorの試験用接続を共通DI契約の有限代役へ追従させた。上位とExecutorの実本文で保存順序・完了投影を検査し、物理Process・実Dockerの成立はこの代役から主張しない。作成後の構成inspectはReceipt通知前に位置付け、発行済みだが実ID未受領の場合は既存のdocker_container_identity_unknownを保持する。共通DIの要求起算と開始観測通知を分離し、開始観測未着でも期限を延長せず、command終了後の後着通知を禁止した。開始通知例外は捕捉して後続Effectを停止し、同じ終了・回収へ接続する。

この固定中間候補の非AI回帰はDI全331件中326件成功・既存対象外5件skip、Executor全90件成功、CoordinatorのProbe対象4 Suite・6件と既存対象8 Suite・234件成功。DI／ExecutorのcheckとCoordinator型検査も成功した。SourceおよびArchitecture／Qualityの独立再レビューは、この中間接続の範囲で必須残指摘0件。三用途の全面接続、資源集合／認証Snapshot、旧入口撤去、全体完成の最終レビューは未完了であり、中間候補の成功をその代用にしない。実AI・実Docker・過去保持物は操作していない。

基準版f8e7b0a7e。人間はDIの共通IFとLifecycleの整理、ResourceSnapshot／inspectによる非秘密構成返却、既知実IDの回収照合を資源種別・完全な実ID・元名・所有Labelへ限定する変更を承認した。Image／Command／環境／Mount等は実行前検査・診断へ残し、既知Receiptの削除条件にはしない。固定Engine接続先・CLI／config／管理Directoryの実体・Signal・出力上限・Process終了・不存在条件は維持する。固定Named Pipeを同Daemon世代の証明とは記述しない。

ID欠測は既存の限定発見・完全構成照合・発見Receipt通知完了前の削除禁止を維持し、発見候補を受領済み実IDへ無条件昇格しない。Directoryと環境修復固有の条件・既存保存Schema・上位の排他保持と保存判断は変更しない。受領済みIDは通知前に技術Ownerへ保持し、通知失敗後は前進を止める。補償回収でも処置前の必要通知失敗なら削除0、Process終了不明・同名replacement・観測不能は回収未確認として元参照と一次失敗を保持する。

変更分類は公開技術契約と回収条件の限定変更。影響OwnerはDI／Executor／Coordinator利用側・各試験・三詳細Architecture・QA-000006。SourceとArchitecture／Qualityを独立レビューし、準拠／Release基準は変更しない。新Manager・Registry・Store・監視・汎用Workflow Engine・Secret Hashを追加しない。Snapshotの一式永続化を要求せず、非秘密構成の返却と最小回収Identityを分離する。着手前は構成差でも同一ID/name/Labelで成功、foreign ID/name/Label、inspect不明、元ID不存在＋同名別ID、通知拒否、未終端、取消、未保存ID発見、Directory非発火を既存保証へ対応付けた。実AI・実Docker・Docker再起動・Image変更・過去保持物は操作しない。

今回の共通IF移行の先行部分は、既知元ID回収の最小識別照合、認証Receiptの通知前保持、単一Container inspectからExecutorまでの非秘密ResourceSnapshot搬送である。未接続の汎用実行下書きを製品Sourceへ残さず、既存の技術正本を直接是正した。Source／Architecture・Quality独立レビューの指摘は、ID欠測からの発見後に必要通知を挟んでも削除直前完全構成検査を維持すること、Snapshotの不正配列要素を空へ畳まず該当fieldのnullへ閉じること、旧本文と試験Headerの追従であった。元Receipt欠測は通知前に固定し、内部引数だけで通常／単独接続へ搬送する。上位に検査省略設定を追加しない。発見通知中に構成とReceipt値を変更しても削除0、元Receipt IDがある対照は構成差でも回収できることを固定した。

是正後の非AI回帰はDI 320件中315件成功・既存対象外5件skip、Executor 90件成功、Coordinator対象8 Suite 234件成功。三Packageの静的checkも成功した。制限下の自作子孫終了2件は猶予超過だったが、必要権限で同じ試験2件と対象8 Suiteが成功した。別回帰との同時実行中、模擬認証のProcess再入場が一度recovery_reentry_failedとなった。単独4件と、同時実行を外した同じ8 Suiteは成功したが、並行実行が原因とは断定しない。実AI・実Dockerの成立や、既存の横断検査全体の成功へ読み替えない。

Source再レビューは関連25件の独立再実行も成功し、必須残指摘0件。Architecture／Qualityは旧表一行の再追従後、必須残指摘0件。変更対象五文書のChecker指摘は0件で、全体の既存3356診断による終了値1は維持した。Workbench／MCPの型検査も成功した。これらは今回の先行部分に対する確認であり、未実装の共通実行接続や実境界の成功証拠ではない。

継続残件は、閉じた技術入力IsolationRequest／PreparedIsolation／IsolationExecutionResultの本番接続、三用途の開始・取消・Process終了・Cleanupを同じDI実行Ownerへ接続すること、資源集合／認証のSnapshot搬送、利用側切替後の旧用途専用DI入口と重複手順の撤去である。今回の先行部分だけを共通IF・Lifecycle全体の完了と表示しない。追加の人間判断を要しない範囲は同じ承認内で継続する。

## 検証専用Probe・試験Adapter・認証取消診断の限定是正（2026-11-02）

基準版29a3e141c。変更分類は既存技術契約と検証接続の是正。対象はDI検証専用Probe二関数の所在Query撤去、Executorの試験Adapter旧同期回収fallback撤去、認証の明示取消をHome Lock喪失へ誤変換する診断の是正だけとする。上位の対象選定・呼出前確認・排他保持・保存通知、DI元Directory／CLI実体とinspect構成確認、Handle終了・unknown・元参照、環境修復／Directory固有Queryと保存Schemaは変更しない。実AI・Docker・過去保持物は操作しない。

着手前照合では、Probeは固定三所在をown-dataとして捕捉し、既存Bindingの元Directory確認を待機後にも使用する。異常入力・同Path実体差・CLI不明・ready／completion期限・後着通知・join不明・余計なstart／removeなしを既存試験へ対応付ける。試験Adapterは現行cleanupObservedを必須にし、欠測を読取り専用recoverObservedへ補完しない。取消SignalとProcess終了確認を分離する。認証はDIの取消による停止理由だけを既存provider_authentication_cancelledへ接続し、上位が本当に確認したHome Lock喪失は別理由として維持する。SourceとArchitecture／Qualityの独立レビューを実行し、準拠・Release条件の監査は今回発火しない。新しい管理機構・永続状態・互換層は追加しない。

実装は三点に限定した。検証専用Probe二関数は固定三所在をown-dataで捕捉し、ready後・SIGTERM前・終了後のBinding元Directory／CLI確認と固定inspectを維持する。上位検証Callerは呼出前に既存Mount確認を行い、Queryを渡さない。回収試験Adapterの旧同期fallbackを撤去し、cleanupObserved欠測時は旧操作呼出し0・同回復参照のblockedとして閉じる。削除の全有限代役を非同期CleanupとSignalへ追従させ、診断専用recoverObservedは読取りとして維持する。認証はDIの明示取消をHome Lock喪失へ変換せず、後段まで既存の取消理由へ接続した。作成取消のReceipt欠測を不存在へ補完せず、Command終了通知を維持し、通知保存失敗・Process終了不明を取消成功へ畳まない。上位が本当に検出したHome Lock喪失の処理は変更していない。

固定候補の非AI回帰はExecutor全90件成功、DI全314件中309件成功・既存対象外5件skip、Coordinator対象18 Suite・502件成功。旧Adapter利用を含む実Writerの別一Suite・8件も全成功し、保存・排他・発見Receipt確定後の回収と再入場停止を確認した。三PackageのcheckとMCP／Workbench型検査が成功した。今回追従対象のcoordinator-state-runtime試験を正規formatへ合わせ、前回HEADから残った同File一箇所の整形不一致も解消した。既存のinformational lintは維持し、Warningを許容して成功化していない。契約本文の五文書Scoped検査は対象指摘0件、全体の既存3356診断による終了値1は別に残る。

Source独立レビューは必須指摘0件、Architecture／Qualityは試験Adapter Headerの旧「同期回収」説明一件を「同期診断・非同期回収」へ是正して再レビューの残必須指摘0件。旧Reader表現と診断代役の未使用旧型fieldも整理し、追加の実行処理・Oracle変更はない。対象Sourceの旧readCurrentMounts／assertBeforeRemovalと認証のLock喪失誤変換は残存0。新品合成領域の終了・回収は既存試験が確認し、実AI・実Docker・Docker再起動・Image更新・過去保持物は操作していない。実境界やRepository全体QAの再成立をこの有限回帰から推定しない。新しい管理機構はなく、現在、新たな人間判断は不要。

## 通常Attempt／Probeの固定所在とSession Receiptへの接続（2026-11-02）

基準版ed9de809d。人間の承認範囲は通常Attemptと固定Probeの上位逆照会撤去、旧Receipt読取りfallbackの廃止、命名・Header・利用側・試験・Architectureの追従である。環境修復・Directory廃棄の固有Query、保存Schema、Owner／Lockの発行方式、実AI・Docker・過去保持物の操作は対象外とする。公開技術入力のRefactorとしてSourceとArchitecture／Qualityの独立レビューを行い、準拠・Release基準の監査は今回発火しない。

上位が既存準備中に所在を検証して値で渡し、下位はown-dataとして捕捉・固定する。DIは既存Context／Binding内へ元Directory実体を保持し、技術操作直前に再確認する。Path固定だけを実体保証の代用にしない。通常回収は同じSessionが所有するReceiptを使用し、欠測は未確認として閉じる。保存読取り、名前推定、新しいManager・Registry・Store・監視機構で補わない。必要保存通知内の上位確認と、Process終了不明・清掃未確認・元Recovery参照は維持する。

着手前照合では、正常値と同実体、値捕捉後の元Object変更、accessor／Proxy／欠測、同Path実体差替え・link・realpath失敗、Receipt一部欠測、開始前取消・実行中取消・未終了Process、通知失敗と補償回収、二重回収なしを回帰へ対応付けた。実Filesystemを使う試験は新規のRepository-local合成領域だけを対象とし、実Dockerや実AIの成立根拠にはしない。

実装・確認結果：通常Attemptは固定paths、通常Probeは固定mountsへ接続し、borrowPaths／readMounts／inspectReceiptsと元Receiptの旧fallbackを製品経路から撤去した。上位が準備中に所在を解決し、必要保存通知で既存の版・記録確認を維持する。DIの既存config実体observerをobserveDockerDirectoryIdentityとして再利用し、元Directoryを既存Context／Binding内へ保持する。Probe Factoryからstartまでの間も同じmetadataを確認し、config作成をFactoryへ前倒ししない。通常Sessionの明示Receipt欠測は未確認とし、名前推定・新規config取得・上位記録照会で補わない。認証のisActiveと回収helperのHeaderも現在の明示取消契約へ合わせた。

固定候補の非AI回帰はExecutor全87件成功、DI全314件中309件成功・既存の実環境対象外5件skip、Coordinator対象18 Suite・502件成功。Coordinatorの旧Probe代役5件は新しい文字列Binding／有限metadata観測へ追従後に成功し、未使用の旧Binding代役と古い読取り回数Oracleも現行Sourceへ整合させた。未使用import／変数の除去後は影響10件の再確認も成功した。Executor／DIのcheck、Coordinator型検査・lint・二つの追跡検査、MCP／Workbench型検査は成功。Coordinator一括checkは変更前HEADと同じcoordinator-state-runtime.contract.test.ts一箇所の整形不一致で停止するため、全体check成功とは表示しない。対象外の当該Fileは変更していない。

SourceとArchitecture／Qualityの独立レビューは必須指摘0件。試験追従差分も独立再レビューで必須指摘0件。五文書のScoped検査は対象指摘0件で、全体の既存3356診断による終了値1は残る。実Filesystem反証は新品Repository-local領域だけで同Path差替え・不存在・junctionを確認し、終了後に自分の領域を回収した。制限環境でjunction作成がEPERMとなった実行と、許可済み実行環境で成功した最終回帰を区別する。実AI・実Docker操作・Docker再起動・Image変更・過去保持物の操作は発行していない。環境修復・Directory廃棄の固有Queryは対象外として維持し、全体QAや実境界の再成立は主張しない。現在、新たな人間判断は不要。

## CleanupのDI正本化と上位逆照会の撤去計画（2026-11-02）

基準版54d4b2c62。人間は通常Cleanupと単独Recoveryを同じ技術契約へ接続し、資源モデルと照合・処置の正本をDI、ExecutorをLifecycle・通知・結果搬送、Coordinatorを対象選定・許可・排他・保存とする方針を採用した。Executorへ汎用Resource Model、Registry、Store、管理Frameworkを追加しない。CoordinatorがDIの構成を再構築せず、実行時に生成した技術情報を既存記録へ保存し、再入場では同じ情報を返す。公開回収入力からassertOwnerの上位逆照会を撤去する方針である。実AI・Docker・過去保持物は操作しない。

着手前照合では、通常AttemptはDI Session内部でProcess終端とCleanupを完了し、Executorがその結果を受ける。認証は通常・再入場で同じ認証Cleanupを使うが、資源照会とOwner確認を上位へ依存する。ProbeはOperationからDI Container回収へ直接接続する。単独Attempt回収はExecutorのcleanup.tsに探索・発見通知・削除・不存在・config closeの集約が残る。単に共通入口を追加すると通常Attemptの二重回収になり得るため、既存技術処理のOwnerを移し、各経路の実処置を一回へ対応付ける。対象別の二軸／三軸不存在、作成Intent、Receipt欠測、Process終了不明、同期保存通知と元exact参照は統合で失わない。

読取り専用の着手前確認で、現在のassertOwnerは上位操作の現在性だけでなく、Repository再検証、保持Lockの生存、Host世代・marker・管理Directory実体と保存Snapshotの一致を検査していることを確認した。Coordinatorの回収current()とborrowHostRecoveryManagementDirectory().assertCurrent()からDI要求前後へ接続され、認証も非同期Command前後でHome Lockを照会する。これらの失敗が既存AbortSignalへ自動配送される接続は確認できていない。したがって逆照会の削除を単なる同等保証の配置変更とは扱わない。人間は追加判断で、上位が処置終了まで排他を保持し、受け付けた指示の途中停止は明示取消とする契約変更を承認した。上位の途中失効を下位が自動検知する保証は外し、技術実体照合は残す。既存Queryを別名通知や常時true関数へ置換しない。新しい監視・Lock・取消Frameworkを追加して埋めない。

変更分類は公開技術契約と責務配置のRefactor。影響先はDI／Executor／CoordinatorのSource・公開型・利用側、三Packageの詳細Architecture、QA-000006と既存回収・通知・取消の契約試験。SourceとArchitecture／Qualityの独立レビューを必要とし、CRDD準拠基準やRelease条件は変更しないため、それらの監査は今回発火しない。現在の実装段階はAttempt／単一Containerの逆照会撤去と既存Signal接続、および人間が追加指定したcleanup-types.tsのlifecycle/types.ts統合。認証の逆照会、DI技術モデルの正本化、通常／単独Cleanupの全面接続は未完了。新しい管理機構は追加しない。

この段階の非AI確認はExecutorのcheckと全85件、DIのcheckと305件成功／既存5件Skip、Coordinatorのcheckと関連13 Suite 388件が成功。拡大回帰初回の旧Probe代役一件は、撤去したtarget.assertOwnerを呼んでいたため現行入力へ追従し、元ID・完全Command六候補の照合を維持して全388件を再確認した。Source独立確認の関連28件も成功し、Architecture／Qualityの旧Owner義務記述一件とSource Header二箇所を是正した。実AI・実Docker・過去保持物は操作していない。段階回帰をCleanup全面統合・実境界・全体QAの完成へ昇格しない。

## 認証逆照会撤去とDI共通回収の全面接続（2026-11-02）

上記段階に続き、認証の開始からOwner／保存資源の逆照会を撤去した。上位は呼出し前の選定・許可と必要通知内の保存を所有し、処置の終了まで既存排他を保持する。認証通常実行は元DI計画の資源列を保持し、Receipt通知完了後だけ実IDを採用する。単独回収は上位が取得した確定資源値を渡し、DIが元計画と照合する。途中Owner失効の自動検知は保証せず、停止は明示取消とする。Directory・環境修復の固有現在性確認は今回変更しない。

資源集合の技術投影・対象・結果・共通回収通知はDIへ移し、Executorは正本型を再利用する。DIのcleanupResourceSetが通常／単独の回収順序を共有し、cleanupDockerResourceが非同期の構成照合・実ID削除・二軸不存在を所有する。旧同期回収の削除分岐は撤去し読取りだけとした。通常Sessionは元Processとconfigを保持し、単独回収だけが自作configを一回終了する。Executorで通常処置を再実行しない。認証は同じDI回収、Container／Directoryは既存DI固定処置を共用する。新しいManager・Registry・Storeや保存Schemaは追加しない。

利用側は資源集合のcleanupResourcesをawaitし、完了前にLock解放・Host清掃・Checkpoint確定へ進まない。実AI・Docker・過去保持物は操作しない。今回の非AI回帰はExecutor全87件、DI全307件成功／既存対象外5件Skip。三Packageのcheck、MCP／Workbenchの型検査と差分空白検査が成功した。Coordinatorは関連16 Suite・422件を対象とし、拡大実行では420件成功、残2件は非同期関数抽出・awaitと旧Owner逆照会前提の期待値を追従してから再実行し両件成功した。同一の一括実行が422件成功したとは表示しない。Source動作を追加変更せず、影響が限定された試験接続・Oracleを再確認した結果である。

拡大回帰で認証保存通知内の上位Home Lock確認漏れも検出し、上位の通知内に現在性確認を保持した。下位への逆照会は復活させず、必要保存の拒否を通知例外として次Effect停止へ接続した。実子Process／Named Pipe／Filesystemの認証4件、通常回収準備22件と上位48件を再確認した。単独回収の最終通知失敗が一次回収理由を上書きする指摘は、正常回収時だけ通知失敗理由へ切り替えるよう是正し、回収正常／不明／config終了失敗と通知throw／Reject／不正値の9組合せを追加した。削除・close各一回、元exact参照と一次理由を確認した。

SourceおよびArchitecture／Qualityの独立レビューは是正・追加差分再確認後の残必須指摘零。文書参照展開検査は既存3,356指摘で終了1、対象5文書は指摘零。今回のSource移管・非AI回帰の成立であり、実AI・実Docker・全体QA・Releaseの成立を主張しない。過去保持物は操作していない。

## Executor公開型の既定Union・取消引数・投影用途整理（2026-11-01）

基準版413eb5e59。人間は共通型の既定を全用途Unionへ統一し、用途確定ConsumerとFactory overloadでは型引数を明示する方針を採用した。変更分類はSource公開型の破壊的Refactor。取消はAttemptだけ必須入力、認証／Probeは引数なしのタプル契約とし、Attemptの元Control・management照合と共通一回配送は維持する。RecordProjectionは公開利用があるため維持し、用途をAttempt／Authenticationへ限定、既定はそのUnionとする。内容・保存Schemaは変更しない。

RootのDockerRuntimeRepairInput／RepairResult／RestartInputは直接利用がないことと、公開環境要求・関数結果から型を参照できることを確認して個別再exportを撤去する。利用中のRestartEvent／RestartResultは維持する。Cleanup型Mappingは次段階であり今回は変更しない。着手前の読取専用確認で、kindによるUnion絞込み、未絞込みの誤開始・取消拒否、Probe投影の型拒否、既存同期通知・Capability照合を検証へ対応付けた。

対象はExecutor、直接利用側・試験・scripts、Architecture／Quality。SourceおよびArchitecture／Qualityの独立レビューを行い、準拠・Release条件の監査は発火しない。新しいRuntime機構・Manager・Storeは作らず、実AI・Docker・過去保持物は操作しない。

実装・利用側・試験の追従を完了した。Executorのcheckと全85件、Coordinator対象12 Suiteの364件、Coordinator／DI／MCP／Workbenchの型検査が成功した。拡大回帰で検出した既存試験の旧位置引数mockは、現行の名前付きObject入力へ追従し、元management／reference／controlの参照一致を保持した。通常Sandboxで拒否された合成Git junction試験は、許可された実行環境で同じ条件・期待値のまま再確認した。実Dockerや外部AIの代わりに有限代役と自己生成の試験Processを使用しており、実境界の再成立は主張しない。

SourceとArchitecture／Qualityの独立レビュー、および追加の試験追従差分の独立レビューは残必須指摘零。Root公開は5関数・31型。文書参照展開検査は既存3,356指摘で終了1、対象5文書の指摘零。全体QA・Releaseの成立は主張しない。Cleanup型Mappingは合意どおり次段階に残す。実AI・Docker・過去保持物は操作していない。

## Executor事前取消・外部Signal・Probe準備境界の是正（2026-11-01）

基準版40c6d8a12。人間はA事前取消を開始拒否・再利用不可、B外部／明示／内部停止の一回配送、C準備と資源取得以後の回収境界の限定是正を指示した。変更分類は実行契約の不具合是正。Executor／DI詳細・QA-000006、直接利用側の試験を追従し、SourceおよびArchitecture／Qualityの独立レビューを行う。準拠・Release基準、保存Schema・Checkpoint／Diagnostic内容、AttemptのCapability・Home保証、Provider方式・Image・Network、Environment特殊操作は変更しない。

着手前確認でDIのBinding生成が第一／第二mkdirと環境構築を行うことを確認し、Effectなし準備ではなく共通RunnerのExecuteへ移す案に修正した。初回Mount読取りは開始前に検査し、失敗時はblockedと終端を返す。Binding部分失敗は回収成功にせず既存上位Host清掃へ接続する。既存の推論型ProbeBindingを明示的DockerProbeRuntimeBindingへ整理し、返却型を再利用するためだけにDI Rootへ型を追加する。新しい操作API・Manager・Store・回復Stateは追加しない。外部listenerは登録直後の中断再確認、後接続の一回配送、Reject捕捉とfinish時解除を確認する。

対象の実装・非AI受入条件を確認した。認証の明示事前取消／外部事前abortとProbeの事前取消はstart拒否・終端・再利用不可。外部abort／明示取消／内部停止は共通のrequestCancellationと一つの配送Promiseへ接続し、listener登録直後の中断再確認、Handler後接続、配送Reject捕捉とfinish後listener零を確認した。初回Mount読取り失敗は開始拒否、Binding部分失敗はContainer未発行・cleanup未確認の同じ結果を既存上位Host清掃へ返す。実Runner内の結果構築throwでもfinishし、外側の二重finallyは撤去した。

最終結果はExecutorのnpm run test:run全84件、Coordinator対象10 Suite 182件、DIのprobe-runtime.contract.test.ts 5件が成功。Executorのnpm run check、Coordinator／DI／MCP／Workbenchの型検査と差分空白検査も成功した。共通制御・Runnerの有界coverageはNode v24.19.0、--test-coverage-include=**/src/lifecycle/operations.tsと同execute.ts、unit/lifecycle.contract.test.ts・notifications.contract.test.ts・probe.contract.test.tsの16件で測定し、operations 39/39、execute 15/15、計54/54分岐・176/176行・15/15関数、未到達／除外零。Package全体のcoverageとは扱わない。標準出力はTool実行記録に保持し、Repositoryへ重複保存せず同じコマンドで再生成できる。

SourceおよびArchitecture／Qualityの独立レビューは必須指摘零。文書参照展開検査は既存3,356指摘で終了1、変更対象5文書の指摘零。Bindingの段階故障・Host清掃は有限代役による接続検証であり、実Filesystemの部分残存・削除成立や実Dockerの再成立を証明しない。実AI・Docker・過去保持物は操作していない。全体QA・Releaseの成立も主張しない。

## Executor実行制御の共通Owner化（2026-11-01）

基準版00ebf3664。人間は公開型だけでなく三用途の開始・取消・終端制御を共通化する方針と、File名lifecycle/operations.tsを承認した。変更分類は実行契約・責務配置のRefactor。Executor詳細・QA-000006、Coordinatorの直接利用側と検証用VM接続を追従する。着手前の読取専用確認で、内部停止も同じ取消へ接続すること、不正Capabilityが取消を消費しないこと、結果固定後の受動通知再入を拒否することを計画へ統合した。SourceとArchitecture／Qualityの独立レビューを行い、準拠・Release基準を変更しないためそれらの監査は発火しない。

共通の短命制御は開始一回・取消一回配送・Signal・終端だけを所有する。AttemptのControl／management・Home Lease・一回解放・元Recovery、認証のsticky終了不明、Probeの実IDとfresh構成検査は固有Ownerに維持する。共通RunnerはExecute→条件付きCleanup→結果固定→終端→受動通知をjoinし、一次失敗を保持する。必須通知の同期性を変えず、用途別interfaceを共通完了通知へ合成する。資源回収型はcleanup-types.tsへ移し、要求kindを三用途に明示する。保存Schema、Checkpoint／Diagnostic内容、Owner／Lock、Provider認証方式・Image・Network、Environment特殊操作は対象外。新しいManager・Registry・Store・永続Stateは作らない。

実装と非AI受入条件を確認した。開始一回・Signal・取消配送・終端の実行時状態はlifecycle/operations.tsに集約し、Attempt recordはその同じ制御への参照を持つ。用途別operationsのstarted／finished／取消BooleanとAbortControllerは撤去した。Attemptは元Capability照合とHome技術排他を維持する。通知は共通CompletionCallbacksと用途別interfaceの合成・型対応へ変更し、Rootの公開関数5個・公開型33個は維持した。Requestのkindは三用途とも必須で、旧action由来の暗黙Fallbackは撤去した。既存scriptsとCoordinatorのRequest構築・VM実本文接続も追従した。

独立レビューで、同期結果構築のawaitが結果固定と終端化の間に取消受付を許す競合を検出し、現三用途どおりcreateResultを同期契約へ限定して同じ同期区間でfinishする最小是正を行った。queueMicrotask取消と受動通知内取消の拒否、二重開始拒否後の元実行への正規取消、配送Reject後の再配送零、外部Signal、清掃中取消・清掃不能、必須通知拒否と元Recovery保持の反例を確認した。SourceおよびArchitecture／Qualityの再レビューは残必須指摘零。

最終回帰はExecutorのnpm run test:runで82件、Coordinator対象10 Suiteで182件、runtime-repair-result.contract.test.tsで26件、DIのexecution/binding.contract.test.tsで1件が成功した。Executorのnpm run check、Coordinator／MCP／Workbench／DIの型検査と差分空白検査も成功。共通制御2ファイルだけを対象にNode v24.19.0の実験的test coverageを計測し、lifecycle/operations.tsは29/29、lifecycle/execute.tsは13/13、合計42/42分岐・144/144行・12/12関数を確認した。測定対象は--test-coverage-include=**/src/lifecycle/operations.tsと同execute.ts、実行試験はunit/lifecycle.contract.test.ts、notifications.contract.test.ts、probe.contract.test.tsの14件。未到達・除外分岐は零。Package全体や実Dockerの網羅率とは扱わない。完全出力は試験Toolの標準出力にあり、Repositoryには重複保存せず同じコマンドで再生成できる。

文書参照展開検査は既存3,356指摘で終了1、変更対象5文書の指摘零。全体QA・Release・実AI／実Docker再成立は主張しない。実AI・Docker・過去保持物は操作していない。

## Executor公開IFの用途横断統合（2026-11-01）

基準版はd5b841767。人間はExecutor・名前付き開始入力・開始／完了結果・通知の共通化と公開型最小化を承認した。公開IFの破壊的Refactorとして、Executor詳細・QA-000006・Coordinatorの準備／認証／診断／回復・検証scriptsと試験を追従する。標準の準拠条件・Release判定は変更しないため、その監査は発火しない。着手前に親が現行宣言・直接利用側を照合し、読取専用の契約確認結果を統合した。追加の人間判断はない。

共通名はExecutor、StartInput、StartResult、CompletionResult、CancelInput／CancelResult、ExecutorCallbacksとする。用途と入力／結果は型引数で結び、既存の用途別情報・AI Adapter／DIの所有型を再利用する。用途固有のProvider／Home／Mount観測を他用途に架空のtrue・nullで埋めず、kindで区別する。Attemptの開始・取消には元management／reference／Controlを名前付き入力で維持し、abandonは元Control表・一回解放印を使うAttempt専用の必要処理として残す。

基準版の成立範囲はExecutor全体79件、Coordinator対象182件、修復結果26件、Windows実Writer限定1件、DI結合1件。通常開始・開始拒否・重複・開始前取消・保留中取消・通知拒否・遅延取消・一次故障・清掃不明・同ID／Owner不一致を新しい公開入口と利用側へ対応付ける。認証の旧idle回収→保存→再受付、必須通知の保存完了、任意通知の例外／Reject捕捉、Process終了不明後の停止、資源終了→Home解放→最終通知は維持する。

SourceおよびArchitecture／Qualityの独立レビューを完了し、再確認の残必須指摘は零。Probeの正常理由が非nullであることを共通statusへ正しく対応付け、一次故障後の後着取消をcancelledへ上書きしない反例を追加した。旧Root名を期待した独立ロード試験と文書の通知名も追従した。公開関数は5個を維持し、公開型は41個から33個へ整理した。型対応表だけを使用し、新しい実行Manager・永続状態・通知Dispatcherは追加していない。

最終非AI回帰はExecutor全体80件、Coordinator対象10 Suite 182件、修復結果26件、DI結合1件が成功。Executorの整形・型検査・Lint、Coordinator／DI／MCP／Workbenchの型検査と差分空白検査も成功した。文書参照展開検査は既存3,356指摘で終了1、変更対象5文書の指摘零。公開IF切替と今回の非AI受入条件は確認済みだが、全体QA・Release・実AI・実Dockerの再成立は主張しない。実AI・Docker・過去保持物は操作していない。

## Executor共通Lifecycleと環境mode統合（2026-11-01）

人間はGenerics・Interface・合成による共通Lifecycle、isolation.ts／validation.ts解体、固有処理のoperations.ts統合、資源入口のlifecycle/cleanup.ts移管、restartの必須mode統合を承認した。変更分類は公開IFと責務構造のRefactor。対象正本はExecutor／Coordinator／DI詳細とQA-000006、直接利用側・検証入口を追従する。SourceおよびArchitecture／Qualityの独立レビューを行う。準拠基準・Release条件を変更しないためそれらの監査は行わない。実AI・Docker・過去保持物は操作しない。

基準版19cdae367のExecutor75件・DI305件／既存5skipと、Coordinator対象84件の成立を照合基準にする。共通化では既存の開始一回性、取消伝播とjoin、一次失敗・exact回復ID、必須保存通知、任意通知のReject捕捉、技術回収→Home解放→完了の順序を維持する。状態を新しい永続Machineへ複製せず、Operation差分の内部Contextだけを利用する。認証のidle回収→settled→再受付→新実行を通常finallyへ押し込まない。単独資源回収は未実行を実行済みへ偽装せず独立入口を維持する。

Attemptの準備／構成／検査はattempt/operations.ts、認証／Probe差分は各operations.ts、資源APIと技術Home解放はlifecycle/cleanup.tsへ移した。lifecycle/execute.tsが実行→清掃→結果をjoinし、用途ごとの開始一回性・取消Controlは各operationsの既存Ownerを保つ。公開createExecutorの用途別結合はindex.tsに置き、余分なFactory Sourceと循環依存を作らない。通知interfaceだけをcallbacks.tsへ、Operation操作は通常Interfaceとしてtypes.tsへ置く。結果内容・Profile・保存判断は共通制御へ混ぜない。環境のrestart／repairは元入力を必須modeで分岐し、欠測・未知modeをEffect前に拒否、自動fallback・再送はしない。

今回のSource接続・非AI受入条件を確認した。Executor全体79件、Coordinator対象10 Suite 182件、修復結果26件、Windows実Writerの限定接続1件、DIのProvider結合1件が成功。Executorの整形・型検査・Lint、Coordinator型検査、差分空白検査も成功した。Windows保存Suite全件の再実行、実AI・実Docker・Release全体の成立は主張しない。

独立SourceおよびArchitecture／Qualityレビューは、falsy例外の誤成功、認証清掃中の取消、清掃例外による一次理由上書き、文書のOwner不一致を是正し、再確認の残必須指摘零。共通Runnerは例外発生のBooleanと値を分け、null／undefined／false／0を含む一次例外を保持する。認証は正常理由の場合だけ最終取消を反映し、既存の認証事実と一次失敗を失わない。Test Catalogの新Suite登録漏れも是正した。参照展開検査は既存3,356指摘・終了1、変更対象文書およびExecutorの追加指摘零であり、全体QA合格とは扱わない。

制限付き実行でWindows子Process取消2件が終了猶予超過となった。同じSource・期限の通常Host権限では2件とも成功した。制限環境との差は観測したが根本原因を断定せず、製品の取消条件や期限は変更していない。Windows実Writerの先頭接続Caseは途中停止ではなく保存の進行を確認し、通常起動で約117秒後に成功した。保存性能の変更を本Refactorへ追加していない。

途中中断した今回の合成領域は`.crdd/tests/repair-owner-{0VBQpF,dUVkhX,FyXGWB,IxxZGW,RVCBLv,sx4yJz,wfSPA7}`の7件。作成時刻、独立した空Commit一件／追跡File零／外部Git共有なし、Root内限定・Reparse Point零と試験Process終了を確認して清掃し、7件すべての不存在を再確認した。過去の保持物は対象外。実AI・Docker・過去保持物は操作していない。

## Probe観測・回収の最小共通化（2026-11-01）

人間は既存構成・共通処理の再利用によるProbe専用重複の整理とCoordinator直接依存の削減を承認した。汎用期待値Framework・管理State・Registry・Lockは追加しない。変更分類は責務移管と重複撤去。正本はExecutor／DI／Coordinator詳細、QA-000006。着手前に既存三軸不存在、完全構成・Mount実体、64KiB上限、現在Owner、exact回復参照、保存・Host清掃順を比較し、読取り専用確認で通常回収との保証差を確認した。SourceとArchitecture／Qualityの独立レビューを行い、準拠基準・Release条件は変えないためそれらの監査は行わない。追加の人間判断はない。

旧Probe構成型を同じ技術値のContainer構成投影へ整理し、cleanup配下へ移す。通常と単一Containerで有界inspect解析・検査済み実ID削除を共有するが、用途別の厳密構成検査や不存在軸は削らない。Executorの既存資源APIへ接続し、Coordinator旧固定Probe回復から技術処置を撤去する。旧記録・History・Schema・exact IDとHost世代排他は維持する。実AI・Docker・過去保持物は操作しない。非AI回帰と独立レビューを実施し、実境界・全体QA完成は主張しない。

追加の人間指示により、取消検証・意図的残存作成と専用補助をscripts/probe-verification.tsへ移管し製品Sourceから撤去する。Network Policy構築・検査、Recovery ID解析・Checkpoint判定・型参照は現在境界を維持する。Source独立レビューの誤Promise Owner確認のReject捕捉と、Architectureレビューの旧配置／overload表・型import配置を是正し、再レビューへ渡す。完了後に再棚卸ししコミット・プッシュする。専用ループの移管に伴い未使用になったinspect／absenceの上位中継を撤去したため、それだけを確認していた投影試験は廃止し、共通DIの完全構成・Mount・三軸と正式回復入口のExecutor接続へ確認責務を対応付けた。既存coverage対象へ移管先と接続試験を追加し、分母から消さない。

最終非AI確認はExecutor check・全75件、DI check・305件成功／既存5件skip、Coordinator check・対象62件とdoctor／回復CLI22件が成功した。追加のWindows保存系を含む5 Suite61件も成功した（対象回帰と一部重複、合算しない）。通常SandboxでHost名前空間初期化を確認できなかったdoctor試験は同じ期待値・期限のまま許可された実行環境で成功した。Source・Architecture／Qualityの独立再レビューは残必須指摘零。OwnerQueryの初回・要求直前・削除直前で即時Reject／後着Reject／pendingを拒否し、追加処置0・未処理Reject0を確認した。

再棚卸しでCoordinator製品SourceのContainer生成・取消・inspect・削除・三軸一覧の直接利用は零。合意維持のPolicy構築／検査、Recovery ID解析、Checkpoint判定、型参照と非操作の構成記述参照は残す。旧Probe専用観測・回収exportと旧配置の参照は零。横断命名Suiteは既存のRust File名、Executorの公開入口母集団・既存試験level等の未追従、およびSandboxのsymlink権限で不合格のままであり、今回の対象check成功を全体QA合格へ拡張しない。実AI・Docker・過去保持物は操作していない。

## 助言Commandの内部化と専用Hash撤去（2026-11-01）

人間はExecutorが確定内容を実行する責務境界を採用し、Command構築の内部化とPreparedAdviceCommand・prepareAdviceCommand・不要なCommand Hashの撤去を承認した。変更分類は短命の公開要求と責務構造のRefactor。Executor／Coordinator／DIの詳細設計、QA-000006、直接Consumerと有限試験を追従する。着手前に通常、選定／Provider／Policy差、旧形、観測不能・保存拒否と元Sessionの回収相関を照合し、読取り専用の確認者が境界とHash用途を確認した。新しい人間判断はない。SourceとArchitecture／Qualityの独立レビューを行い、規範準拠・Release条件は変えないためそれらの監査は今回行わない。

専用Command Hashはメモリ内Packet／Planだけの正本であり、永続保存Schemaの移行は不要。上位は完全選定・Offering・Operation・本文・許可参照・検査済Network Policyを確定し、一回消費・送信同意・Authorityを維持する。意味的Packet Hashにはこれらの内容を結合する。Policyは可変参照を持たず捕捉・固定する。旧Command付き要求・Packetは製品コードで互換受理しない。過去Evidence・保持物は変更しない。

Executorは共通selection／targetと、Adviceのinput／allowedReferences／networkPolicyを受け、内部でAI Adapterの正規仕様とDI構成へ結合する。上位へのCommand往復・専用Hash照合を撤去し、DIの不要になったAdviceCommand wrapper・bindAdviceCommand・hashAdviceCommandもConsumer移行後に削除した。Codex助言用Digest、入力検査、識別種別・Provider・用途の拒否、Policy相関、本文上限・参照検査、完全Command照合、同じSessionの開始・清掃を結合する内部planIdentityは維持する。Task／ProbeのAuthorityやCleanupを緩めない。

利用側・試験・Architecture・Qualityの追従を完了した。固定候補の非AI回帰はExecutor check・全74件、DI check・305件成功／既存5件skip、AI Adapter check・全41件、Coordinator check・対象237件とWindows取消2件が成功した。Coordinatorには助言の公開受付から結果までの結合30件と、先行認証試験代役の明示的な欠測拒否へ追従した28件を含む。Windows取消2件は通常SandboxでOS終了確認が成立しなかったため、同じ期待値・期限のまま許可された実行環境で再確認し成功した。Lintの参考情報103件は残るが、警告2件は試験代役のnon-null assertionを明示拒否へ変更して解消し、checkは成功した。

SourceおよびArchitecture／Qualityの独立レビューは残必須指摘零。旧専用API・型・Hashの製品利用は零で、AI AdapterのProvider固有CLI計画Ownerは維持する。差分空白検査は成功し、文書検査の変更対象指摘は零。参照展開全体は既存3,356指摘・終了1であり、全体QA合格とは扱わない。実AI・Docker・過去保持物は操作していない。今回の成立範囲はSource接続・非AI回帰であり、実環境再検証・Release完成を主張しない。

## 固定合成ProbeのExecutor接続（2026-11-01）

変更分類は承認済みの責務移管と非同期公開接続である。対象正本はExecutor／Coordinator／DIの詳細設計とQA-000006。通常Provider Attempt、認証、保存Schema、Recovery ID、既存Owner・Lock、Image・期限・認可は変更しない。SourceとArchitecture／Qualityの独立レビューを行い、CRDD準拠基準・Release判断は変更しないため準拠／Release監査は今回行わない。実AI・実Docker・過去保持物の操作は対象外とする。

既存createExecutorはkind=isolation_probeの要求を受けるoverloadを持ち、Provider／Modelや送信許可を架空に生成しない。probe/execute.tsとtypes.tsに固定技術生涯・所在Query・同期void通知・技術結果を置く。CoordinatorのrunDockerIsolationScenarioから作成・Inspect・実行・回収の直接ループを撤去し、作成前Intent・実ID保存・Host不存在遷移・Host終了・最終Fake判定を残す。doctorの正式API・CLIは同じcompletionを待ち、既存の取消Listenerを同じSignalへ接続する。Executorの公開関数数は増やさず、Store・Registry・Lock・Workerを新設しない。

正常は二保存後の同じ実IDを実行・回収する。保存拒否は次Effectを停止し、既知実IDは保存失敗後も補償回収する。作成不明は再作成せず同じ上位Recovery参照を保持する。取消・Owner／所在喪失では次実行を止め、取得済みHandleはjoinする。終了不明・構成不一致・回収不明を不存在へ畳まない。技術結果とHost清掃の複合条件は維持し、同じExecutor参照だけを不存在証拠にしない。Host ID・Probe ID・Container ID・Root名と元技術結果の相関・一回消費を既存のMapで維持する。

DIの非同期実行は既存attachと所有Processを使い、固定期限、64KiB境界、ETIMEDOUT／ENOBUFS分類、元失敗とcloseの分離を維持する。実行時間はStart発行から結果観測までで、上位保存待ちや補償join時間を混ぜない。同期の固定実行は既存技術試験Consumerがあるため維持する。固定故障Profileと意図的残存は検証専用で、製品Requestには公開しない。既存の故障検証Scriptと回復Matrixは非同期結果へ追従する。

独立レビューで旧技術引数差替え反証の移管不足を検出した。新Executor試験を同じBinding・Profile・Probe ID・三Mount・実IDの確認へ補強し、実本文に対する五つの差替えを同じOracleで拒否する。VM構築失敗と該当引数の不一致を区別し、正常本文も同じOracleを通す。DI attachも同じBinding・実ID・prefixを確認する。この補強でInspect／Cleanupにmanagementを混入させた接続漏れを発見し、Executor側で三Mountだけを投影した。DIの厳密検査は緩めず、実DI構成関数を試験へ接続した。非同期化後の二Headerも追従した。

先行の対象回帰はCoordinator十四Suite140件成功、DI305件成功・既存五件skip。Executor先行回帰のSource抽出代役の追従一件は、既存own-property読取りを同じ有限Contextへ接続して是正した。是正後の固定候補はExecutor check・全74件成功、DI check・305件成功／既存五件skip、Coordinator型検査・対象十四Suite140件成功。変更SourceのLint、差分空白検査、更新した四JSONの構文検査も成功した。SourceおよびArchitecture／Qualityの独立再確認は残必須指摘零。文書検査の変更対象指摘は零だが、参照展開全体は既存3,356指摘・終了1であり全体QA合格とは扱わない。実Docker・実AI・過去保持物は操作していない。これで今回のSource接続・利用側・非AI回帰は限定完了とし、実環境成立・全体QA完成・Release可能を主張しない。

## AIツール認証移管と固定Probeの非同期接続（2026-11-01）

認証の技術構成・実行・回収をExecutorの`authentication/execute.ts`へ移管した。準備専用Fileは同Fileへ統合し、CoordinatorはHome選定・排他・現在Owner・Recovery受付とIntent／Receipt／idle／settled保存を維持する。通知のBoolean ACKや新しいStoreは追加しない。必須通知のthrow・誤Promise・Receipt欠測では次Effectを止め、Process終了不明は同じ実行内に保持する。認証と通常短期Commandの終了確認はDIの既存Process Ownerへ共通化し、対話方式・期限・Container条件は変更しない。

固定候補の非AI確認はExecutor checkと73件、DI checkと304件成功・既存5件skip、Coordinator型検査と認証関連33件が成功した。Source独立レビューは必須指摘零。Architectureレビューの旧責務説明をExecutor／Coordinator詳細で是正し、再確認の必須指摘も零。実認証・実Docker成立は今回未検証であり、過去八試行の結果を流用しない。

人間はdoctorの非同期化と、合成固定Probeの既存Executor入口への統合を承認した。Providerへ送信するProbeとは別の要求として扱い、Provider・Model・認証・送信許可を架空に生成しない。最初の接続準備としてrunDoctor、正式診断API、CLIをasync／awaitへ追従した。公開API本体の保留・正常終了・拒否を有限Promiseで検証し、正常終了後だけ結果と入場観測を返す。Source抽出試験は後続宣言を取り込まない既存の構文木補助へ追従した。

doctor関連三Suiteは最終27件が全成功した。通常SandboxではHost保存初期化の一Caseが`host_recovery_namespace_initialization_failed`で失敗したため、許可された実行制限外で同じCaseと三Suite全体を実行し、初期化を含めて成功を確認した。安全条件・期待値・製品処理は緩めていない。非同期接続のSource独立レビューも必須指摘零。固定Probeの技術移管・取消成立はこの結果へ含めない。

固定Probeの技術処理自体はまだCoordinator側であり、Executor統合完了とは扱わない。次は既存createExecutorへ合成Probe要求を接続し、作成前Intent・実ID保存・構成照合・技術結果・回収／不存在をExecutor／DIへ、Host保存・排他・最終判断をCoordinatorへ対応付ける。取消は単にPromiseを包まず、既存attach Handleの終端確認へ接続する。故障注入・意図的残存は検証専用とし、製品Requestへ任意ScriptやProfileを公開しない。

`PreparedAdviceCommand`は既存の承認前Command Hash照合に使う非対称な公開型として残っている。Task用の無意味な対応型は追加せず、Hash・保存Schema・承認相関を変える整理は今回の認証移管へ混在させない。実AI・Docker・過去保持物は操作していない。

## 共通資源APIと環境修復の技術接続（2026-11-01）

基準版は`4a8a3b1f21efc5046ba0b0b24afaf68d749c23f4`。人間の今回判断に従い、Executorへ保持・退避物の業務分類を持ち込まず、公開名をinspectResources／cleanupResourcesへ統一する。repairDockerEnvironmentを別の技術操作として追加する。変更分類は責務・公開APIの移管であり、Recovery Capability／Owner／Lockの簡素化、保存Schema、保持期限、廃棄許可の意味は変更しない。

着手前は親と読取り専用Architecture確認者で、同期性・対象固定・通知・現在確認・保存前後・取消・再入場・実体差替えを照合した。Source独立レビュー、Architecture／Quality・直接伝播確認、非AIの対象回帰を実施する。準拠基準・公開／リリース判断・実境界操作は変更対象外。実AI・Docker・過去保持物は操作しない。

| 基準版のCapability | 新しい接続・維持条件 |
|---|---|
| Attemptの資源診断・回収 | resources/execute.tsへ本文移管し共通公開名へ切替。kind:attemptはAPI振分けだけ。同期return、既存実ID／Label／構成照合、発見通知保存前の削除0、config終了、exact回復参照を維持 |
| 固定Directoryの二読取り | kind:docker_runtime_directoryの外側inputを既存DIへそのまま渡す。三用途の実体値／用途内nullと全体失敗nullを分離。保持判断や期限を下位へ移さない |
| 固定Directoryの廃棄 | 同じ共通cleanup名から元DI Promiseを返す。上位の廃棄判断・用途Intent保存・元版読戻し・待機後のcanDisposeと、下位のScope／Filesystem実体照合・不存在確認を維持 |
| 修復Session | Executor.environmentの薄いrepair関数へ接続。元input・Signal・同期通知・現在Query・元Promise・一次失敗・Native join・最終checkpoint候補を保持 |
| 型・通知・利用側 | DIの無名入力／結果と既存Machine結果を明示型化して正本を再利用。ResourceCleanupCallbacksはresources/types.tsへ移し、ExecutorCallbacksが明示引数で継承。DirectoryへDocker ID／Home終了の架空通知を作らない |

通常Rootの旧inspectAttemptResources／cleanupAttemptResourcesは撤去し、互換転送Sourceを作らない。Coordinator.execution/recovery.tsの本番3技術callと既存Attempt callを切替え、Domain Writer・History・Completion・Owner確認の順序は維持する。DIの純粋な型・状態値検査の参照は今回維持する。VM試験は新Source実本文と新しい呼出しへ追従し、旧試験AdapterからDirectory実処置へ誤接続しないよう明示的に拒否する。

非AI回帰はExecutorのcheck・全69件、DIのcheck・304件成功と既存5件skip、Coordinatorの型検査・関連7 Suiteの93件と変更六ファイルLintが成功した。初回DI回帰で明示型名によるFormatterのインデント変更をSource変異試験が検出したため、不要な内部型引数を除いて元の配置を維持し、当該十件と全体再回帰の成功を確認した。検査Oracleや技術処理は変更していない。

Source独立レビューは必須指摘零、確認者の別実行17件も成功。Architecture／Qualityレビューで見つかった共有型の配置説明とAttempt限定の同期通知条件を是正し、Host修復API表・新設／移管型Headerも追従した。是正後のExecutor checkと関連17件は成功。SourceとArchitecture／Qualityの独立再確認は残必須指摘零。文書再検査は今回対象の指摘零、参照展開した全体は既存3,356指摘で終了1のため全体合格とは扱わない。旧八試行の実AI Evidenceを今回APIの実境界成立へ流用しない。Recovery管理の簡素化・Host全体排他・全体QA・新APIでの実Docker成立は今回完了と主張しない。実AI・Docker・過去保持物は操作していない。

## Docker環境窓口とRecovery管理の再評価（2026-11-01）

人間の今回判断により、前回のDesktop直接接続維持案を診断・再起動について変更する。基準版は`25ea064046c7eeb55cd698b6e392641e891ae7a9`。変更分類は実装責務・公開APIの再編であり、DIの実技術、Coordinatorの判断・保存順序、既存のIntent・Checkpoint・Diagnostic・Schema・失敗理由を維持する。既存の再起動Capabilityは現在Owner／Scope取得→保存・読戻し→固定再起動→逆順解放→終端確定であり、この本番接続の技術callだけをExecutorへ置換する。

着手前整合確認は親と読取り専用Architecture確認者で実施した。Source・Architecture／Qualityの独立レビュー、対象回帰、文書の直接伝播確認を行う。準拠基準・公開判断・リリースは変更しないため、その採否監査は追加しない。実AI・実Docker・過去保持物操作は対象外とし、新たな実環境成立は主張しない。

| 対象 | 処置・接続 |
|---|---|
| backend／Engineの環境読取り | Executorのenvironment/execute.tsで既存DI観測を逐次集約。18分類組合せ・cleanup不明を保持。doctorの合成Probeへ自動追加しない |
| Desktop再起動 | 同FileのrestartDockerEnvironmentへ集約。CoordinatorのrestartRuntimeOwnedDockerForRecoveryを接続。元入力・Signal・verifyBoundary・同期通知・元Promiseを維持 |
| 再起動の結果型 | DIの既存観測＋deliveryへDockerRuntimeRestartResultという名前を付け、コピー型やReturnType別名を増やさない |
| 修復・退避・廃棄／認証／Probe | 別Capabilityとして今回は現状維持。窓口を作ったことだけで全DI直接依存を撤去済みとしない |

### Recovery専用Capability・Owner・Lockの棚卸し

| 現在の機構・主な実装Owner | 守っている保証・反例 | 既存機構で代替できるか・処置 |
|---|---|---|
| durableRecords／bindRuntimeOwnedExecutorAttempt（execution/recovery.ts） | 現在管理Ownerと開始Control／最終結果を同じ試行へ結合。別Controlやコピー結果で取消・保存を認めない | Operation IDは識別であり同Processの制御参照を証明しない。維持 |
| dockerRecoveryPreparations／assertCurrentRecoveryOwner（同File） | Process喪失後のfresh回収で現在Root・元保存bytes・Host世代・保持Lockを結合。閉鎖後再使用と失効後Effectを拒否 | 元Operation Ownerは既に失われ得る。IDだけの削除へ置換不可。専用Registry新設ではなく既存の短命Mapを維持 |
| dockerHostCleanupCapabilities（同File） | 回収済みDockerと元Host清掃・終端処理を同じ生涯へ結合。別Hostや二度目の確定を拒否 | 上記Mapと使われる通常終了／回復経路が異なる。保証同等の重複は未確認、削除しない |
| Host世代排他／Provider Home排他（operation.ts・kernel-lock.ts経由） | 使用中Hostの削除、同じHomeへの通常実行と回復の競合を防ぐ | 対象と寿命が異なり、Repository保存Lockでは代替不可。維持 |
| Docker Runtime State Lock（kernel-lock.ts） | 同じRepositoryのRuntime操作の競合を防ぐ。再起動ScopeのHost／Home Lockとは異なる | Repository Binding単位。別Repositoryを含むHost全体の排他とは主張しない。現行保証維持、今回削除しない |
| Domain Writerの短期排他・元版bytes比較 | Lock保持中でも別保存で変更された状態へ古いCheckpointを上書きしない | 長期のHost／Home Lockでは保存競合を代替できない。維持 |
| Intent・Receipt・Checkpoint・Diagnostic | 中断をまたぐ要求有無と観測経緯を保持。ログだけでEffect発行前Intentを代替しない | 現在許可の正本とは分けたまま維持。履歴の詳細化・過去Evidence変更はしない |

今回の比較では、保証を落とさず即削除できる重複管理機構は確認できていない。名称が似ていることだけで統合しない。Host全体の競合対策を変更する場合は対象母集団・既存Scopeの不足と影響を別判断し、新しいLockや管理Stateを今回追加しない。現在、人間による追加判断は必要ない。

固定候補の非AI確認はExecutorのcheckと全68件、DIのcheckと304件成功・既存5件skip、Coordinatorの型検査と関連回帰55件が成功した。変更したCoordinator三ファイルのLintと差分空白検査も成功。Source独立レビューは必須指摘零。Architecture／QualityレビューのSourceツリー・Rootヘッダー追従漏れは、環境責務の明記と二ファイルのツリー追加で是正した。文書検査によるQA説明のChecklist内挿入一件も、本文をChecklist前へ移して是正した。独立再確認の残必須指摘は零。文書再検査は変更対象の指摘零、参照展開した全体は既存3,356指摘で終了1のため全体合格とは扱わない。ヘッダー是正後のExecutor checkと公開境界・環境四件も成功した。過去八試行の実AI結果は新環境APIの成立根拠へ流用しない。実Docker・AI・過去保持物は操作しておらず、Host全体排他や新環境APIの実Desktop成立・全体QA完成は未確認である。

- 対象: CRDD v0.22 / CHG-000082
- 状態: A〜GのSource移管・公開接続と対象非AI確認は限定完了。Hの今回Executor単体の実AI／Docker八試行は成立。Workbench／MCP／Coordinator連携、実データ移行、人間操作および全体QAの完了は未確認。全体回帰の過去不合格と是正後の限定成功を区別する。
- 基準: `5dae7108436205ecf7804d7898b1aecc2e8ce85b`
- 入力: 人間提示「Runtime Responsibility Realignment」。同文書の確認HEAD `81d9647a4`と旧Source名は基準当時の参照であり、旧構造を復活させない。
- 責任者: Qual-Lab
- 対象外: 承認済み八試行を超えるAI再送、Docker Desktop／Engineの起動・再起動・修復、Image取得・更新、過去のRuntime領域・保持物の読取り／変更／削除、Release判断。

## 結果Folder統合後のExecutor実AI確認（2026-10-31、八項目成立）

人間は実AI試験を実施し問題がなければコミット・プッシュすることを承認した。今回の対象は既存Executor単体CLIの八試行であり、各一回を逐次実行する。EXEC-20261031-RESULT-01 Codex助言、02 Claude助言、03 Codex編集、04 Claudeレビュー、05 Claude編集、06 Codexレビュー、07 Codex開始後取消、08 Claude開始後取消とする。モデルは既存GPT-6.1 Sol／Opus 5.5、双方medium。既存Subscription経路だけを使い、送信は固定合成説明・source.txtのBASE／EDITED_OKとその差分・固定Schemaだけに限定し、本体Repository本文と秘密値を含めない。確認端末・確認コード・API Key fallback・自動再送は使用しない。

各試行はRepository-local .crdd/tests/executor-real-<provider>-<runId>の新品領域を使う。既存の固定Image四Digestの存在、Engine 29.8.1の応答、稼働Container零、八Root不存在を事前確認した。固定ImageはCodex助言112a73d8…9b76de3、Codex Task 832019e6…32aa4a4、Claude 612433b7…de9c51f、Proxy 4270d4dc…413766。Sourceは直前の非AI全51件・利用側171件・独立レビュー済み候補から変更しない。実行後は同じ資源実IDによる技術清掃・Home解放・終端保存・子close・内容Oracle・今回Root回収を別々に確認する。失敗又は観測不能では後続送信を停止し、今回試験物について既存の安全な回収だけを行う。Docker Desktop／Engineの起動・再起動・修復、Image取得／更新、過去保持物の読取り／変更／削除は行わない。今回保持が必要な場合は既存の七日再評価契約を使う。Source／品質条件を緩めず、八項目が成立した場合だけ今回の整理と検証記録をコミット・プッシュする。

実行結果は八試行すべてCLI終了値0。助言・編集・レビューの六件は内容確認とcompleted、取消二件は開始観測後のcancelled／cancellationConfirmed成立を確認した。取消ではcontentConfirmed=false・結果Hashなし・0byteを正しい非公開結果として扱い、通常内容成功へ読み替えない。全八件で子close、技術清掃、Home解放、終端保存、Native清掃、今回Root回収が成立し、primaryFailureはnull、保持記録は追加されなかった。Providerの生出力は保存していない。

| 試行ID | Provider | 用途 | 結果 | 結果bytes | 結果SHA-256 |
|---|---|---|---|---:|---|
| EXEC-20261031-RESULT-01 | codex | 助言 | 成功 | 693 | cff8024f00769a8876fe2d5ebdce249199e82cf8bb5144e6452b049fe2ba0d80 |
| EXEC-20261031-RESULT-02 | claude | 助言 | 成功 | 2314 | 131e574c717b59a6eb8742cb3c1847e476c1f62cc8635bf881fdad68ac5bf254 |
| EXEC-20261031-RESULT-03 | codex | 編集 | 成功 | 1808 | e65096238ef764821053bf7331c869a65813333e32bb333a892f2819d9733d81 |
| EXEC-20261031-RESULT-04 | claude | レビュー | 成功 | 1788 | 666c06487544a4dfbbd5c4e893743cd5df54e14836d5b01233b231315c90476e |
| EXEC-20261031-RESULT-05 | claude | 編集 | 成功 | 2440 | 42ba12247696f338b768cc664cf075f627ba346e71c7c039638bf1ab37b3c650 |
| EXEC-20261031-RESULT-06 | codex | レビュー | 成功 | 817 | 0752c64dd106db757788483c1b472676330aa4a30460a97f114b6fd99acafdae |
| EXEC-20261031-RESULT-07 | codex | 取消 | 取消成立 | 0 | N/A: 取消のため結果非公開 |
| EXEC-20261031-RESULT-08 | claude | 取消 | 取消成立 | 0 | N/A: 取消のため結果非公開 |

終了後の読取りでも今回八Rootは不存在、稼働Containerは零、Network名は既存のbridge／host／jarvis_default／noneだけだった。組込みbridgeのIDだけae75c4b22bb9から33a3180dee57への変化を観測した。原因は未調査であり、全環境不変の根拠にはしない。過去の同種観測と今回の事実を区別し、今回Sourceによる原因やDocker再起動の成立を推測しない。今回の所有資源は各試行の元実IDで回収・不存在確認済み。Docker再起動・修復・Image取得／更新・過去保持物操作は行っていない。これはExecutor単体の固定条件での成立であり、Workbench／MCP／Coordinator連携や全Provider／全環境へ一般化しない。

## Executorの結果Folder統合（2026-10-31、対象非AI確認完了）

基準Commitはb34bfa9a8。人間の明示指定どおりsrc/resultをsrc/attemptへ統合する。result/attempt.tsはattempt/result.ts、types.tsとvalidation.tsは既存同名Fileへ宣言を統合し、constants.tsは同名でattemptへ移す。入力・通知・結果の17型宣言は欠落・重複なく維持する。同じFileへの型相互importを撤去し、importは既存規約どおり先頭に統合する。関数本体・固定値・公開名・保存形式・Timeout・Home解放条件は変更しない。

変更経路は意味を変えないSource配置Refactorと直接参照・正本・試験登録の追従。着手前の軽量照合で現宣言・通常Root・私有参照・三単体Suiteと既存基準版の51件回帰を対応付けた。互換barrelや新APIを追加せず、新しい人間判断はない。src/resultと旧UT Directoryは空であることを確認して除去し、Source Treeはattempt配下六Fileとindex.tsに揃える。単体試験三Fileはtests/unit/attemptへ同名移動し、CatalogとSymbolの安定IDを変えずPathだけ更新する。公開Root、検証ScriptのModule差替え、Source宣言抽出の読取り先、coverage起動先、Architecture・QAを追従する。過去CHG・Evidenceの当時Pathは書換えない。

確認は通常Rootの実行時公開集合・型利用側、Source Tree六File・旧Folder不存在、既存正常／異常／取消・清掃・通知の回帰と読取り専用独立レビューで行う。準拠基準・Release判断は不変であり準拠・Release監査は対象外。実AI・Docker・既存保持物は読取りも含めて操作しない。Repository内のSource・試験・正本文書だけを変更し、新しい保存・Lock・Registry・ライフサイクルを追加しない。

対象確認結果：Executorの静的検査・型検査・Lintと全51件が成功（約108.7秒）。移動後のresult:coverage入口も成功した。Coordinator型検査と利用側171件が成功、Catalog427定義は有効。独立レビューで宣言17件（type 16件・interface 1件）、関数・定数・通知／清掃条件、Root公開集合、三UT・Symbol／Catalog安定ID、Module差替え・Source抽出・coverage・文書参照の追従を確認し、残Must-fixは零。旧Pathは不存在確認の試験文字列と過去記録だけに限定し、差分空白検査も成功した。実AI・Docker・過去保持物は操作しておらず、Repository全体QA完了や既知のHome解放条件の別件完了を意味しない。コミット・プッシュは未実施。

## Executor入力検査・参照正本・局所補助の整理（2026-10-31、対象非AI確認完了）

対象検証結果：AI Adapter全41件、Coordinator対象198件が成功。最終試験追従後のExecutor静的・型検査と全50件も成功（約94.2秒）。Factory経由で参照1／257／1024件の受理と1025件等のEffect前拒否を確認した。独立レビューの指摘で旧Owner記述と利用側正例を是正し、固定差分の再レビューで残Must-fixは零。Workbench型検査、Catalog427定義検査、差分空白検査も成功。実AI・Docker・過去保持物は操作せず、Repository全体QA完了とは扱わない。既知のHome解放条件は別件の未処置を維持する。コミット・プッシュは未実施。

人間承認したSource整理として、モデルの手書き列挙検査を撤去し、ExecutorのparseModelSelectionからAI Adapter既存Resolverへ委譲する。Executorが残すのは動的Propertyを拒否するexact五項目のコピーと一致・投影だけ。private copyPlainDataRecordは保存記録ではなくこの入力固定の補助である。Resolverへは四項目を明示し、identifierKindを含む元五項目と照合、返却Catalog Identityは下位へ含めない。

助言参照はAI Adapterの既存advice-result.tsへparseAdviceReferencesとして一実体化し、既存plain-data配列コピーを利用する。成功はAdviceReferencesResultのconfirmedと凍結配列、拒否はblockedと固定理由。Executor準備とAI Adapter内容Parserは同じ正本を使う。参照数は独自256件を廃止して既存AI Adapterの1024件へ統一し、512byte・非空・空白・重複・動的入力拒否は同正本が所有する。256/257/1024/1025件、Unicode byte境界、sparse・symbol・accessor・Proxy、元値変更後の不変性を確認する。汎用Snapshot APIや新Libraryは作らない。

isDockerSetupCommandPurposeは一箇所の固定失敗理由Map参照へinline化し、own key照合と未知用途fallbackを維持する。isAttemptFailureReasonは本番の理由変換と試験・試験Scriptの共有語彙照合として残す。成功・取消理由はFactoryの固定値であり、同種の検査関数を人工的に増やさない。ownDataValueはreadOwnDataPropertyへ改名しattempt/validation.tsへ移管。意味・取得不能時のundefinedは変更せずRoot非公開を維持する。

Executor／AI Adapterの詳細設計とQA-000006、利用側・既存Suiteを追従する。既存Symbol・CatalogはFile／Suite単位の対応であり、今回Path移動・新SuiteはなくIDを増やさない。公開AIA APIの正確な集合と新しい結果型は更新し、独立したSource・正本レビューを実施する。準拠基準・Release判断・保存形式・Authority・Timeout・Home解放条件は変えないため準拠／Release監査は対象外。実AI・Docker・過去保持物の操作は行わない。着手前の読取り確認で、Resolverの四項目入力／Catalog Identity付き返却とExecutorの五項目境界を照合済み。追加人間判断は不要。

追加の人間指摘を受け、Envelopeだけを返していたAI Adapterの公開parseProviderResultを、用途別の内容検査まで完了する入口へ改めた。旧抽出は内部extractProviderResultとして搬送段階の試験・限定診断へ限定し、ExecutorのTask／Advice別解析組立てを撤去した。内容型、固定理由、許可参照検査、Taskの作業量判定の正本はAI Adapterであり、新Library・汎用変換Frameworkは追加しない。

## Executor単発入力の所有境界整理（2026-10-31）

今回の人間承認は、小さな統合候補を除く型・入力境界の整理である。変更経路は既存Capabilityを保つSource RefactorとArchitecture／Quality／利用側／非AI試験の追従。準備一回消費、改訂・Authorityの照合、同期記録、取消join、同一Completion object、exact回復参照を保持する。独立Source・正本整合レビューを行い、準拠基準・Release監査、実AI・Docker・過去保持物の操作は行わない。

- この段階では上位準備入力・二WeakMapの一回消費をCoordinatorへ集約し、技術Planをstartへ渡していた。この過渡的な往復は後段の「Requestを受けるFactoryへの切替」で廃止した。現行はRequestをFactoryへ、保存後の参照と通知をstartへ渡す。
- Model／EffortはAI Adapterの`AiModelSelection`から取得する。`AttemptTarget`は照合済みBinding／Grantの技術対象、`AttemptRequest`は管理Packetではない実行内容とする。
- `AttemptPlan`は旧二計画型の技術部分を統合する。選定ID／Hash、Packet参照／Hash、Task試行番号、利用側・回復相関は上位の`RecoveryPlan`に残す。下位への投影は許可fieldを明示し、追加metadataのaccessorを評価しない。
- 固定構成`ExecutorOptions`、試行ごとの`ExecutorCallbacks`、内部技術操作`ExecutionServices`へ分離し、`ExecutorHost`を廃止する。既存Control記録がその試行のcallbackを保持する。生Executorを上位接続Moduleから公開しない。
- 消費後・Authority消費前の開始拒否はexact controlを失効し、未試行Mountだけ返却する。拒否・失効・保存不明を成功へ補完しない。consumeがnullの場合も選定表示を保持するが、それだけで物理回収成立とは主張しない。
- CompletionResultから選定記録IDを撤去し、終端記録とcompletionへ同一objectを渡す。所見からの限定是正許可は既存上位記録の選定ID／Hash／試行番号・技術五項目の借用照合で維持する。

検証結果：Executor全44件が一実行で成功（約107.7秒）。Coordinator対象178件と、所見受領Owner一件が成功した。独立確認で未消費Authorityの後始末、生Executor公開、除外rest投影、consume-null時の選定表示欠落と旧文書記述を検出し、是正した。表示負例・Provider別投影・文書追従後に対象178件と所見Ownerを再確認し成功。両Packageの型検査・静的検査、Catalog426定義、差分空白検査も成功した。最終限定再レビューの残Must-fixは零。既知のHome解放条件の安全指摘は人間指示で別件の未処置として維持し、今回の型整理に混入しない。今回範囲に新たな人間判断はなく、コミット・プッシュは未実施。

途中の別Process合成試験一実行は15秒期限で停止し、`.crdd/tests/executor-standalone-5f49qz`が回収未確定として残った。後続の新品試験の成功をこの領域の回収確認へ流用せず、本作業では保持物を操作しない。実AI・実Dockerの成功やRepository全体QAの完了とは扱わない。

小さな統合候補のうち、人間承認した`Command`の重複宣言を撤去し、Planと内部実行接続はDocker Isolationの`DockerIsolationCommand`を直接再利用する。型の用途を既存の固定九操作へ合わせ、argv、操作順、実行時照合・取消・清掃条件は変更しない。利用側の合成fixtureは同じ九操作をliteralとして定義し、未知用途の型拒否と実行時拒否を確認する。型検査・対象非AI回帰・限定独立確認を実施し、実AI・Docker・保持物は操作しない。回復開始応答、診断処理の配置、内部技術接続の削減、対象／内容入力の統合は説明・比較段階であり、今回追加実装しない。

Command統一の確認結果：両Package型検査、Executor静的検査・対象9件、Coordinator対象134件が成功。独立確認で未知用途の負例が件数不足の検査へ先着する点を検出し、九件・argv・他八操作を維持して用途だけを変える負例へ是正した。該当UTと両型検査を再実行し、限定再レビューの残Must-fixは零。実行時処理・公開API・保存契約は変更せず、コミット・プッシュは未実施。

## 通知専用コールバックと単発実行の整理（2026-10-31、最終確認中）

### Requestを受けるFactoryへの切替（2026-10-31、対象非AI確認完了）

非AI確認：Executorのcheckと全48件、Coordinatorの型検査と対象198件、検証Tool46件、Workbenchの型検査と診断14件、Catalog427定義が成功した。独立レビューで文書Ownerの旧記述とControl分岐の反例不足を指摘され、Source処理を変えずに文書と既存2 Suiteを是正した。未解放を返して正常resolveする場合のalias失効・Executor保持と、開始後Control結合失敗時の同Control取消一回・下位completion join・同ID blockedを確認した。是正後の固定候補（差分Hash dac73994c8b1d61c733cbbe1ae08f0164432405c）の独立再レビューは残Must-fix零だった。この記録確定は検証・Sourceを変更せず、全体QA・実AI・実Dockerの完成へ昇格しない。追加質問のvalidation関数の責務・命名は調査と説明だけで、今回のSource是正へ混在させていない。

最新の人間承認に従い、`createExecutor(request, options, random?)`が一試行の技術構成を内部に保持する方式へ切り替える。公開prepare・Plan往復・RootのAttemptPlan／AttemptReferenceを廃止する。上位へ返すのは資源名・Image・Mode等の狭い記録投影であり、Command・Provider本文・Authorityは含めない。

着手前の独立した読取り確認では、保存前のHome取得禁止と取消Ownerの維持を照合した。試行ごとのFactoryに伴う取消配送は新しいMapを作らず、既存durableRecordsへ同じExecutorと元Controlの寿命aliasを結合する案で整合した。通常の回復検索は元Capabilityのobject一致を維持し、Control aliasを回復Authorityへ昇格しない。終端成功／拒否でaliasを除き、Home解放未確認の明示終了だけを元Executorへ残す。

`executeAttempt`は実行・通知・取消・回収の順序を所有する。純粋な内容解析と成功時Hash計算は既存`result/attempt.ts`の`parseAttemptOutput`へ移し、通知が未確定でも技術清掃が進む既存条件を保持する。局所の最初の失敗を固定する処理と結果受理の時機は実行Ownerへ残す。

変更分類は公開Library APIと本番接続の責務整理である。Executor／Coordinator詳細設計、QA-000006、直接利用側・有限試験を対象とする。Source・利用側・取消／回収の独立レビューと対象回帰を実施し、CRDD準拠基準・公開／Release判断を変えないため準拠監査・Release監査は実施しない。人間の追加判断は不要。保存Schema・Operation Identity形式・Timeout・技術清掃条件・既知Home abandon解放条件は変更しない。実AI・Docker・過去保持物の操作は対象外。

人間は、上位で実行記録を確定してからExecutorを呼び、Home競合時には同じIDの未開始試行を残す順序を採用した。通知は任意メソッドを持つ`ExecutorCallbacks` interfaceとし、引数は既存型を再利用する。戻り値は`void`／`Promise<void>`であり、保存結果・許可・回復IDを下位から要求する返信口にしない。Event Bus、ACK、Worker、Registry、保存Schemaは追加しない。

| 所有者 | 今回の確定責務 |
|---|---|
| Coordinator | 準備一回消費・Authority・改訂照合、回復開始保存、通知先での記録、Mount終了、技術結果後のTask終端保存 |
| Executor | exact参照でのHome取得、一試行の実行・取消、通知join、技術資源清掃とHome解放、技術CompletionResult |
| Docker Isolation | 固定Commandと実資源操作、取得済み実IDの局所捕捉、同じsessionの終了・回収 |
| 検証ツール | 未検査JSONの一次故障診断検査、有限代役と既存の反例試験 |

実装：`AttemptRequest`へ対象・選定・内容を統合し、`ExecutorOptions`、`ExecutionServices`、`RuntimeDependencies`の別名・汎用操作束を撤去した。`createExecutor`を`attempt/execute.ts`へ統合し、中継Factory二つを撤去。`start`は同じControlとcompletionを返し、内部`executeAttempt`が一試行の継続・通知・回収を所有する。`classifyExecution`は`result/attempt.ts`の`convertCommandResult`へ移管。`observation.ts`を廃止し、通知型は`types.ts`、構成診断は`isolation.ts`、受動通知呼出しは実行Ownerへ戻した。

独立したprepareAttemptをRootへ追加した途中案は、人間指摘により撤回した。通常Rootの関数はcreateExecutorのみとし、返却Executorにprepareを持たせた過渡案も、後段のRequest入力Factoryへ置き換えた。現行はFactoryが完全Planを内部に保持し、Coordinatorの既存準備Ownerが試行専用Executorを保持する。上位の一回消費・Authority・記録確定後にstartし、新しい準備Registryや永続管理領域は追加しない。検査・結果組立て・試験用中間APIも公開しない。`describeExecutorContract`を撤去し、準備期限はCoordinator、技術期限はDocker Isolationを参照する。回復開始の理由・参照・診断検査はCoordinatorの既存validationへ、JSON一次故障検査は既存`./testing`へ移管。回復開始診断の型・段階定数と失敗通知もCoordinatorへ移し、上位Reporterへ直接報告する。Workbench／Coordinatorの検証ツールはCoordinatorの検査正本を利用する。Executor内の合成Host用回復処理はprivateな試験処理であり、他Packageへ正本として公開しない。有限試験用の構成はscriptsに閉じ、製品と同じ内部開始・取消を使う。

独立確認で、開始済みProcessの技術signalと非同期公開通知の契約不一致を検出した。DIのsignalは同期voidへ戻し、Executorが公開通知をjoinする。通知保留中も開始済みProcessのwait・期限・終了・回収を進めるが、Provider内容受理とcompletion公開は通知成功後に限る。通知成功が既に確認できた通常経路はその時点で内容を検査し、既知失敗を後続の取消で上書きしない。遅い拒否は本文を受理せず同じIDのblockedへ閉じる。新しい待機期限・監視機構は追加しない。

技術清掃と上位保存は別条件である。上位の終端保存を受動onCompletedに置かず、上位completionで待つ。保存拒否でも実際に確認済みのHome解放を未解放へ戻さず、Task成功は返さない。未開始記録保存が拒否・例外でも元回復参照と未確認義務を保持する。各必須通知の欠落変異、保存throw／async reject、Home競合、通知保留・遅い拒否・取消を既存試験へ追加した。

この段階の確認履歴（Request入力Factory切替前）：Executorの既存46件とCoordinator主要135件が構造整理後に成功。その後の開始通知是正・Root縮小では、Parser spyを含む通知／理由6件とCoordinator関連143件が成功し、Executor静的検査、Executor／Coordinator／Workbench型検査も成功した。最新固定候補のExecutor全回帰・Docker Isolationの非AI回帰・限定独立再確認を進行中であり、この途中結果を全体完成とは扱わない。実AI・実Docker・過去保持物は操作していない。既知Home abandon解放条件の別件指摘は未処置として維持する。現在、新たな人間判断は必要ない。

今回の追加承認：`buildProviderDockerExecutionPlan`を`prepareAttempt`へ改名し、`execute.ts`へ統合した。旧`preparation.ts`を撤去し、Source利用側・固定試験用生成文字列・Symbol配置も追従する。上位の完全選定・Packet相関検査は維持し、技術五項目の検査はExecutorの準備入口へ集約する。新しい準備Manager・Store・Driver注入は作らない。途中独立確認で指摘された私有importと型の逆Ownerを是正し、不正結果の即時／遅延通知成功の同値反証を追加した。最新候補の型・静的検査、対象回帰、独立レビューは下記の確定結果へ追記する。

最新の人間指摘への処置：Executor／Coordinatorと有限試験のreportPassiveBoundaryDiagnosticを撤去し、各通知発生箇所で既存Reporter／onDiagnosticを直接呼ぶ。同期例外・非同期拒否が元結果・exact回復参照・技術回収へ波及しない条件は維持する。Source順をcancel→abandon→createExecutor→private prepareAttemptへ揃え、abandonとFactory、取消のヘッダーを実処理・失敗・解放条件へ合わせた。既知Home abandon解放条件は別件として未変更。実利用側のprepare接続、Root入力型、固定試験器を追従し、準備に不要な技術実行を試験で禁止した。追加回帰で検出した古い空CREATE応答と未使用selectedModel変更のfixtureも、現行の実ID・五資源観測とModelを使用するTaskの反証へ是正した。製品の安全判定・Timeoutは変更していない。

## Executor公開APIと内容型の整理（2026-10-30）

人間承認により、準備はcreateExecutor内部へ統合し、通常Rootから準備Capability・検証中間処理・試験代役を除く。内容型の正本はAI AdapterのTaskResult／AdviceResult、ExecutorはCompletionResultで内容と技術終了・観測・上位発行許可を分離する。Task専用の契約説明関数は撤去し、容量・Role・生出力非公開等は実挙動試験で維持する。利用側・試験・Architectureを追従し、保存Schema・判定理由・取消・清掃の保証を維持する。実AI・Docker・過去保持物は操作しない。今回の内容型・解析API整理は対象非AI回帰と限定独立レビューを完了した。先行レビューで検出したHost Writer応答喪失後の再入場も未完了条件として保持する。

検証結果：AI Adapter全38件、Executor全43件（最終一実行約137秒）、Coordinator対象190件、Workbench診断14件が成功した。Windows junctionの一件は通常権限で作成できず、許可された実行環境で同じ試験を単独実行し成功した。四Packageの型検査、Executor／AI Adapter／Coordinatorの静的検査、Symbol全13Manifest指摘零、Catalog426件の定義検査が成功した。独立再レビューの今回範囲の残Must-fixは零。実AI・Docker・過去保持物の操作およびコミット・プッシュは行っていない。先行のHost Writer応答喪失後の再入場、Windows保存側の未完確認、Repository全体QAを今回成功へ含めない。

### File内の記述順序の明文化（2026-10-30）

人間指定の「File Header→import→File直下の変数・定数→関数」をコーディング規約3.2へ反映した。型はimport後・値宣言前へ置き、同一参照先のimport統合、局所変数を引き上げないこと、外部必須prefix・Module評価順・初期化順の保全を明記した。この更新は規約と確認項目だけであり、既存Sourceや機械検査は変更していない。構文木で確認した途中importはExecutor三File、AI Adapter一File、Coordinator十八Fileに残る。型宣言を挟んだだけの例と関数定義後の例を含み、実行時故障件数を意味しない。既存Sourceへの適用時には依存評価・初期化の同値性を確認する。新しいLibrary、初期化Framework、共有状態は追加しない。

記述順序・既存規約との接続・更新日の局所確認と`git diff --check`は成功した。限定独立レビューの残Must-fixは零。表の再exportを`export ... from`へ明確化し、local exportを先頭へ移す要求ではないことを示した。実装未変更のためRuntime回帰はこの規約更新の成立根拠へ追加しない。

### Executorへの記述順序規約の適用（2026-10-30）

人間承認によりExecutorの`src`・`scripts`・`tests`の全31 TypeScript Fileを確認し、14 File（製品Source七、Script三、Test四）を並べ替えた。静的importと他Moduleからの再exportを先頭へ集約し、同一specifierのnamed importを統合した。型専用指定を保持し、型・Module値・関数の順序へ整理した。`verify-provider-real.ts`は`registerHooks`後の動的importを初期化境界として維持し、型だけを前へ移動した。実AI・Docker・過去保持物は操作していない。

変更前後の構文木比較では、全31 Fileの非Module宣言の一対一対応、Module値の初期化順、関数／top-level処理・Test登録順、実行時Moduleの初回評価順、import bindingと型専用属性が一致した。整形後も不一致零、途中静的importと統合可能な重複importは零。型・整形・lintと`git diff --check`は成功し、配置変更と文書追従の限定独立レビューは残Must-fix零。最終の一実行でExecutor全43件の回帰が成功した（約113.4秒）。先行のAPI変更やHost Writer応答喪失の残件を、この配置確認の成功に含めない。今回、他Packageの途中importやCheckerの順序検査は変更しない。

### レビュー所見の完了結果への統合（2026-10-30）

人間承認により、ExecutorのTaskReviewFinding別名再export、所見登録callback、CompletionResultのremediationCapabilityを撤去した。検査済み所見はCompletionResult.reviewFindingsで返し、Coordinatorが受領後に既存の限定是正許可を発行する。本文を通常の保存・公開DTO・ログへ投影しない。二回目レビューも所見自体は返し、是正回数の方針をExecutorへ持ち込まない。result/attempt.tsのProviderAttemptPlan importはPreparedPlan型注釈として使われていたが、実際に参照する二つのIDだけの入力へ縮小し、計画全体への依存を撤去した。実AI・Docker・過去保持物は操作していない。

最終のExecutor全43件は一実行で成功した（約114.4秒）。CoordinatorのTask・助言対象175件と、別実行の所見受領Owner一件（正常一条件・拒否十九条件）が成功した。四Packageの型検査、Executor／Coordinator静的検査、Symbol全13Manifest指摘零、Catalog426件の定義検査、`git diff --check`も成功した。所見本文のsentinelが公開Task DTO・診断・実Writer bytesへ出ないことを確認した。独立レビューで検出したQA表の旧callback記述を是正し、Source・Architecture・Qualityの再レビューは残Must-fix零。これは今回の結果搬送・許可Owner整理の限定完了であり、先行のHost Writer応答喪失、Windows保存側の未完確認、全体QA、実AIでの再確認を成功へ含めない。コミット・プッシュは未実施。

### Executorの定数配置と結果Factory名の整理（2026-10-30）

- コーディング規約へ任意の`constants.ts`の作成条件を追加する。局所定数・状態Owner・型専用Sourceの境界は維持する。
- 結果理由、回復開始診断段階、Command用途、準備失敗理由対応の4群を`result/constants.ts`へ移管する。値・順序・凍結・公開APIは変えず、実装への逆依存と転送exportは追加しない。
- 結果Factoryを`createStartResult`／`createCompletionResult`へ改名する。前者は開始成功・拒否結果を組み立てるが、開始成功の制御Handle／Promiseの生成・所有は実行Ownerに維持する。
- 検査内だけの固定検索集合・対応表は`OBSERVATION_KEYS`、`BLOCKED_COMPLETION_REASONS`、`RECOVERY_START_REASON_CLASS`へ統一し、モジュール内へ残す。`const`参照とSet／Map内部の不変性は同一視しない。
- 外部AI・Docker・過去保持物は操作しない。既存の未解決保存再入場問題とは別の内部整理として検証する。
- 確認結果：共有4群の移管前後JSONは順序を含めexact一致。Executor全43件成功（117.5秒）、追加改名後の局所4件成功、Executor整形・型・Lint、Coordinator型検査、Test Catalog全426定義の検査が成功。限定独立レビューは共有定数・Factory改名前後でMust-fix 0。実AI・Dockerの再確認や既存保存再入場問題の解消を意味しない。

### Executor結果検査の不要処理削減とOwner整理（2026-10-30）

- 未使用`validResultString`を削除。二つの試験専用結果projectorと専用shape検査は`tests/support/result-validation.ts`へ移管し、既存の試験入口からだけ公開する。
- Codex観測の検査をAI Adapterの`codex/observation.ts`へ移し、既存の通常データ捕捉を再利用する。Executor転送APIとAI Adapter通常RootのInspector公開を撤去し、製品経路は内部検査済み結果を型付きで搬送する。JSONを読む検証ツールだけを既存の検証専用入口へ接続し、Coordinatorの型付き診断組立てとJSON受入を分離する。旧観測読取りの四形は採用済み契約として維持する。
- ターン数診断の古い上限2条件を、現行Producerと同じ不正報告条件へ是正する。正常なターン数の上限比較は導入しない。Domainの歴史的診断読取りは変更しない。
- 回復ID／Home／清掃／通知のlifecycleと保存契約は維持。実AI・Docker・過去保持物は操作しない。
- 対象回帰、試験専用境界、AI Adapterへの依存方向、Source／Architecture／QAの限定独立レビューで確認する。

### 開始・終了結果のFactoryと導出型の統一（2026-10-30）

`createStartResult`は開始成功と拒否を判別可能な入力から組み立てる。Handle・完了Promiseの生成、実行開始、制御Map、取消と清掃は実行Ownerに残し、既存の準備・選択metadataを保持する。`StartResult`／`CompletionResult`は後続の明示契約化により`result/types.ts`を正本とし、両Factoryがその型を満たす。Factoryは通常Rootへ公開しない。開始成功とProvider開始を区別し、拒否時の回復義務・ID・清掃条件は変更しない。

限定確認結果：Executor全45件成功（119.3秒）、AI Adapter全40件成功、Coordinatorのportable対象3 Suite163件成功、Workbench診断14件成功。型・整形・Lint等の各Package静的検査、Symbol全13 Manifest、Test Catalog全426定義が成立した。独立レビューはSource上のMust-fix 0で、文言Minor 3箇所を追従した。今回の結果検査整理で`result/validation.ts`は1101行から556行へ縮小した。

回帰中に旧内容型へTurn観測を混在させた期待値と、古い「3ターンを不正診断として受理」の期待値を発見し、現行契約へ試験を追従した。初回実行にはWindows固有2件も含まれ、その2件はOS子孫終了確認で不成立だった。本変更ではOS終了処理を変更しておらず、以降の対象回帰は既存portable範囲として実施した。上記成功を実Windows境界の成立へ換算しない。実AI・Docker・過去保持物は操作していない。

### 結果Factoryの一Object入力と明示結果型（2026-10-30）

- 両Factoryを名前付きObject一引数と明示返却型へ統一する。公開結果型は`result/types.ts`が所有し、FactoryのReturnType導出・StartResultDetails・generic／Extract／返却castを撤去する。
- 開始のselectionは通知・モデル・推論強度の三値だけ。preparationFailedを維持し、準備失敗結果全体のspreadをやめる。preparedCapability、grantRef、selectionRecordId、Home／各Effect／Authorityの準備内部fieldは準備診断に保持するが開始結果から削除する。現在の利用側はこれらの混入fieldに依存せず、保存・通信Schemaは変更しない。
- 呼出し側は許可fieldを名前付きで構成する。四開始経路のexact key集合、選択の値・null・省略、元Control／Promise、拒否八組合せを試験する。
- 終了Factoryは一Object化による参照名変更を除き、移管前bodyとの字句照合が一致した。五清掃条件と公開mask式は変えず、32組合せ×三状態と取消・所見の試験を維持する。
- 実AI・Docker・過去保持物の操作は行わない。対象回帰と限定独立レビューで確認する。

### 名前付き公開・共有型の明示契約化（2026-10-30）

コーディング規約へ、実装のReturnType／Parameters等で公開・共有型の宣言を代用しない原則を追加する。名前付き既存契約の再利用、固定constからの列挙Union、局所推論・試験照合を区別する。先行した`Executor`・`StartResult`・`CompletionResult`に続き、`ExecutorOptions`の下位構成、準備Owner・準備結果・隔離Session・技術分類の契約を明示する。Docker Isolation側が既存の構成とSessionに型名を与え、Executorはその型を再利用する。型だけを公開し、通常Rootの実行時公開集合、保存形式、期限、理由、取消・一回消費・清掃条件は変えない。他Package全体への一括遡及はしない。

Executorのstart／cancelを構造で明示し、Factoryの返却型をExecutorとして検査する。下位Runtime由来のParameters参照を撤去し、handoffの同期true、同期Command制約、開始通知のPromise許容を明示する。Runtime拒否条件は維持する。選択三項目は全存在／全不存在のUnionへ補正し、六つの部分集合を型負例で固定する。cancelの理由と終了観測値を型でも相関させ、待機・要求・返却値は変えない。

先行するExecutor／StartResult／CompletionResultの3型限定候補の確認：Executor全47件成功（132.0秒）、Coordinator portable対象163件成功、Workbench診断14件成功。型検査では選択部分集合6件を拒否し、明示Executor契約とFactoryの一致を確認した。対象Packageの整形・型・Lint等の静的確認、Test Catalog全426定義が成立し、独立レビューのSource指摘は解消した。Windows固有試験・実AI・Docker・過去保持物の確認へ換算しない。

今回の追加型・入力型移管後の限定確認：Executor全48件成功（118.5秒）、Docker Isolation通常293件成功・明示条件付き5件skip、Coordinator portable対象163件成功、Workbench診断14件成功。Executor／Docker Isolation／Coordinator／Workbenchの静的検査が成立し、Test Catalog426定義・Symbol13 Manifestは問題0件。初回の新試験には拒否結果のkey数を20とした誤りがあり、独立レビューに従って19 keyのexact集合比較へ是正した後、全体を再実行した。準備の取消・失効は両Providerで全fieldと二Store除去を確認した。Source・文書・試験の独立再レビューは必須指摘0件。`StartResultInput`／`CompletionResultInput`は`result/types.ts`の内部共有exportへ移し、Factoryと通常Rootの実行時公開は変更していない。実AI・実Docker・過去保持物は操作していない。

## 1. 何を変えるか

### Executor試行型の重複・配置整理（2026-10-30）

#### 選定・Task／Advice Packetの上位化（2026-10-31）

`ModelSelection`・消費済み`TaskPacket`・`AdvicePacket`の三管理型をCoordinator `execution/types.ts`へ移し、Executorの宣言とbuilder引数から除いた。型の移動だけにせず、builderは旧12引数から、乱数・実行対象・Mount借用・AI Adapter選定・実行相関・用途別内容の六入力へ変更する。実行内容は排他的な`AttemptRequest`にまとめ、同じOperation・Provider・Model・Effort・HashをPacketごとに再搬送しない。選定正本はAI Adapterの型を直接使用する。

旧builderのModel／Packet相関検査はCoordinatorの既存準備callbackへ移し、Operation、Provider、Model、Effort、選定Hash、試行番号、stdin搬送、上位role、助言四非共有条件の拒否を維持する。下位は解決済み内容とCommand／Image／Mountの技術一致を検査する。Contextの既存ID／Hash／時刻／利用側値は現行の試行Identity・通知・終了相関に使用中のため残す。新しいState・Registry・永続領域・管理Managerは作らず、単発実行全体のmetadata撤去完了とは表示しない。Standaloneも新しい六入力へ直接追従させ、Coordinatorを読み込ませない。Home排他、実AI、Docker、過去保持物は操作しない。

確認結果はExecutor通常44件成功（113.3秒）、Coordinator準備43件成功、Controller／利用側122件成功、両Package静的確認成功、Catalog 426件valid、Symbol 13 manifests／問題0。独立確認でAdvice相関反例の不足を検出し、既存正常試験へ八一軸変異を追加して準備43件と型検査を再実行した。Taskは四一軸変異で拒否、Authority発行0・Mount借用終了1を確認する。これらは有限準備試験であり、実AIや実Containerの観測成功を主張しない。上位の二選定fieldには、実際に照合する既存Domain role型を明示し、下位五項目への投影と区別した。

是正後の独立再確認で、Advice八反例・上位role型・下位五項目契約・Owner表現の整合を確認し、今回の三管理型分離に残指摘0となった。Homeの既知安全指摘は未処置のままであり、今回の完了へ含めない。

#### 上位準備型のOwner整理と受渡し縮小（2026-10-31）

`AttemptPreparation`・完全な準備成功／拒否／取消結果・準備Authority・二WeakMapを持つ状態・Provider別準備計画・消費済みPacket・準備Hostの十宣言をCoordinator `execution/types.ts`へ移した。上位の既存実装と型検査が共有する場所であり、Runtime値・Store・Frameworkは新設しない。Executor側にはcallbackで実際に読むstatus・準備参照・選択表示三項目・拒否理由だけの`AttemptPreparationResult`を残す。上位の多数の固定Effect fieldや準備候補管理を下位契約から除いた。未使用だったExecutor testingの準備型reexport三件も撤去した。

Provider別準備計画の型正負例一件は、Executorの計画試験から既存Coordinator準備試験へ移管し、下位試験からCoordinatorへの逆依存を追加しない。残る`ModelSelection`・`TaskPacket`・`AdvicePacket`と計画metadataは現在のbuilder受渡しに使われており、完全に上位へ閉じたとは判定しない。単に別名へ付け替える統合や、必要なProvider条件・必須fieldの削除は行わない。Home安全指摘・認証・診断・修復・実AI・Docker・過去保持物は今回操作しない。

移管後の結果はExecutor通常44件成功（89.3秒）、Coordinator準備42件成功、両Package静的確認成功（Coordinatorは既存info 102件のみ）、Catalog 426件valid、Symbol 13 manifests／問題0。独立レビューで、移した型OracleとSuiteのQA／Trace対応の不足一件を是正し、再確認で残指摘0となった。Coreの最小callback結果はoperation／Effect群なしで型成立し同一objectを返す正例を追加、準備42件と型検査を再実行した。試験件数の45→44と41→42は型Oracle一件のOwner移管によるもので、試験の削除ではない。

#### AttemptSelectionとAttemptPathsの撤去（2026-10-31）

人間はHome排他の安全指摘を後回しにし、上記二型だけの整理を指示した。`AttemptSelection`を削除し、Executorの選定型はAI Adapterの`AiModelSelection`へ統一する。上位ロールとTask／Adviceの相関検査はCoordinatorの既存準備Ownerへ移し、Executorへは五項目だけを明示投影する。元の完全選定Hash・選定ID・試行番号と上位正本への結合は維持する。保存Schema・過去Evidenceを五項目へ書き換えない。Executorにroleが混入した値は余剰として拒否する。

`AttemptPaths`は実使用が`AttemptBinding.mounts`一箇所だけだったため、workspace／tmpの二項目を直接統合し、宣言とRoot型exportを削除した。実行順序・Homeの解放条件・Docker操作・AI送信・過去保持物は変更しない。

限定独立レビューでは実行契約のMust-fixはなく、五項目化に伴うコメント二箇所の追従指摘を是正した。上位の六項目と下位の五項目、完全Hash・選定ID・試行番号の相関、role余剰拒否を確認した。Homeの既知指摘は今回の解消判定へ含めない。

確認結果はExecutor通常45件成功（109.9秒）、Coordinator準備・Controller 155件成功、Claude委譲／隔離実行利用側10件成功、上位完全選定借用の対象1件成功、両Package静的確認成功、Catalog 426件valid。途中の旧六項目fixtureによる失敗は上位準備用六項目／Executor用五項目を分けて追従した。広めのRepository操作試験では、この実行環境がjunction／symlink作成をEPERMで拒否する失敗が残り、その試験集合全体の成功とはしない。Home排他の未処置指摘は引き続き保留する。

#### 今回の範囲限定：型の重複と不要な間接定義（2026-10-31）

人間の再確認により、認証・診断・修復の移管／廃止と、上位metadataの責務移管は進めず、先にExecutor `attempt/types.ts`の見通しを改善する。Provider名の集合はAI Adapterの`AiProvider`を参照する。ExecutorのCommand Handle三操作はDocker IsolationのSessionが既に持つ同形契約へ統合し、所有元の型だけを公開して再利用する。生ProcessのSignal型へ狭めず、`closed`等の追加操作をExecutorへ要求しない。空の`Readonly<Record<never, never>>`三箇所は交差の中立値`unknown`へ簡素化し、不要なimport別名と同型二重importも削除する。現在の他の宣言には使用箇所があり、行数だけを理由に削除しない。

この単位は型定義と参照・説明の整理だけであり、実行順序、拒否判定、期限、保存契約、公開Runtime値を変更しない。前段の未完了な責務移管を完了とは扱わない。実AI・Docker・過去保持物は操作しない。

限定候補の確認結果は、Executor通常45件成功（117.1秒）、整形・型検査・警告を失敗とするLint成功、Coordinator製品／試験型検査成功、Docker Isolation関連3 Suite 29件成功、同Package静的検査成功（既存infoのみ）、Test Catalog 426件valid。独立レビューは型値域・optional・Provider条件・Runtime値不変の範囲で残指摘0だった。試験入口を一度誤指定した実行は対象File未検出で開始しておらず、正しい3 Suiteで再確認した。

別件として、前段の未コミットなHome生涯移管には安全指摘1件が残る。`abandon`がContainer／Network不存在未確認でもHome排他を新たに解放し得るため、前段全体の完了・統合可能とは判定しない。今回の型整理へRuntime是正を混入させず、未処置として分離する。

#### 技術生涯の所有境界の確定（2026-10-31）

人間の追加判断により、Docker Isolationを実行時に呼ぶのはExecutorまでとする。上位の型参照は許容するが、CoordinatorへDocker構築・清掃・OS差の手順を残さない。Homeの技術排他もExecutorが取得・解放し、Coordinatorは観測事実の保存とTask進行を所有する。前段の「Host復帰保存後のHome実解放」という保持条件は、この判断で「技術清掃・Home実解放後に上位保存を通知」へ改訂する。保存失敗で実解放を未解放に戻さず、保存成功から実解放を推定しない。上位Task成功には引き続き耐久受理が必要である。

実装中の単位では準備候補の二WeakMapをCoordinatorへ移し、通常試行のHome HandleをExecutorの既存Control記録へ移した。Coordinatorの重複解放Map／Setは削除し、同じDurableRecordへ受領した解放事実だけを保持する。終了不明後のOwner終了は同じ回復参照で扱い、元の失敗結果を書き換えない。新しいRegistry・Lock・永続Stateは追加しない。

全体完了は未成立。上位の選定・Packet・consumerと技術入力の分離、認証・診断・修復／再起動のDocker実行時接続の実移管が残る。個別のDI関数の再export・転送による見かけ上の依存削除は行わない。実AI・実Docker・過去保持物は操作しない。

#### 単発実行の責務境界縮小（実装進行中）

人間は全27型の棚卸しに基づく責務分離を承認した。先行単位では、上位の正本は保持したまま、作成時刻・速度設定・助言Task／Projection HashのExecutor搬送を明示投影で除く。上位の全Path型をCoordinatorへ戻し、Executor向けはworkspace／tmpだけとする。元消費・Hash照合・Operation結合は維持し、Standaloneの合成入力も同時に縮小する。両Provider準備37件成功、両Package型検査成功。独立確認で旧fixtureと保持値Oracleの不足を検出し、該当箇所を追従した。

この入力投影候補でExecutor全49件成功（99.5秒）、Coordinatorのportable対象163件成功（10.4秒）。独立再確認で指摘された操作IDの保持値比較も追加し、両Provider準備37件を再実行して全件成功した。投影はexact keyと全保持値、消費回数、元の速度設定・Hash不変を確認する。Architectureには全27宣言の処置先と保持保証を明示し、移管予定と配置済みを区別した。これは入力境界の限定成立であり、以下の責務移管全体の完了ではない。

残件は、準備の一回性Ownerを上位へ戻す接続、consumer／選定・Packet情報と技術Planの分離、実資源解放と上位耐久回復確定の分離、公開入口／全利用側／非AI試験の移行、固定回帰・独立最終確認。前段の型整理49件成功をこれらの新しい境界成立へ流用しない。既存の二WeakMap・上位受付Context・callbackを再利用し、新しいManager／Registry／Recovery Stateや旧新兼用経路は追加しない。実AI・Docker・過去保持物は操作しない。

2026-10-30の追加実装基準は`c68bbcf8c`（commit・push済み）とする。着手前照合では、上位の同一Owner・二時計・準備一回消費、Revision／Authority再検査、Effect前のexact回復引渡し、submission／receiptの同期拒否、取消join、旧結果objectと終端記録の同一性、Host復帰保存後のHome実解放を保持対象に固定した。準備候補の弱参照二Storeは上位へ移し、Executorは解決済みの技術入力を構築する。上位受付Contextは同じ閉包で保持し、新しい実行Registryへ複製しない。正常・別Owner・失効・二重消費・保存拒否・解放不明・遅延取消を非AIで反証する。Source／利用側／Architecture／Qualityの独立確認を必要とし、準拠基準・Release監査は今回の変更範囲に含めない。保存Schema・回復Identity・過去Evidenceを名称整理の対象にはしない。

基準Commitは`589a7e747`。単純な選定別名、準備Stateの別名連鎖と空のPick／Exclude、乱数一項目だけの別名、Docker清掃結果の重複を整理する。共有計画を準備計画の基底として再利用し、Provider相関と段階ごとの必須／任意項目を維持する。共有の型は`attempt/types.ts`へ置き、準備のLifecycleと専用Callback型だけを`preparation.ts`内の非export宣言へ移す。初案では試験・Scriptから参照する型まで準備専用として移したが、人間の指摘を受け、実際の参照境界に基づいて共有型へ戻した。型Fileの縮小だけを目的にしない。

公開構成型`ExecutorOptions`と共有構成型`ExecutorHost`も同じ基準で`types.ts`へ移し、`preparation.ts`は非exportの準備専用3型だけを持つ。通常Rootの型名と実行時公開は維持し、検証接続も共有型の新Ownerへ追従する。

変更経路は型構造のRefactor、Architecture／品質定義／非AI試験の追従、独立Source・文書整合レビューとする。準拠基準・Release・認証／認可・保存契約は変えず、全面準拠監査や実AI／実Docker確認を追加しない。実行本文の型消去後比較と、計画の型正負例・exact key・既存の準備／実行回帰を使用する。実AI・Docker・過去保持物は操作しない。

最終構成の確認：`ExecutorHost`／`ExecutorOptions`移管後のExecutor全49件成功（115.2秒）。構成移管前の49件成功（131.5秒）とは別実行であり、両型の最終Ownerと準備Fileの型export不存在も同じ回帰で確認した。Docker Isolation通常293件成功・5件skip、Coordinator portable対象163件成功、Workbench診断14件成功。ExecutorとCoordinatorの静的検査、Workbench型検査、Catalog426定義、Symbol13 Manifestは成立した。独立再レビューの必須指摘0件。Runtimeの要求・取消・清掃・保存契約は変えず、新しいFile・機構や実AI／実Docker／過去保持物の操作は追加していない。現在、人間による追加判断は必要ない。

### 文書管理と実行管理の分担（人間確認済み）

CRDD文書群がMilestone／Roadmap／WBS・正式判断・Evidenceの正本であり、フロントAI等のCallerが読んで小・中規模の実行Taskへ分解しCoordinatorへ渡す。Coordinatorは渡された範囲を実行・調整して結果を返す。文書処理が必要な場合もCallerが明示Taskとして渡し、文書とRuntime状態の自動同期機能は追加しない。[用途・現行との差](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#document-and-execution-ownership)を設計正本とする。

本計画のDomain移管対象であるPlan／Objective／Milestoneは実行依頼の値・局所状態で、文書側の業務計画の第二正本ではない。既存ObjectiveはTask群の受入、Milestoneは同じ実行依頼全体の受入・判断待ち・回復の集約に使われる。既存名・IDを理由に文書項目と同一視したり、今回削除・一括改名したりしない。

基準版の公開構成は依頼を1 Objective＋1 Taskへ機械変換していた。今回、Callerが分解した複数Task Graphと個別入力を受け取るSourceへ切り替えた。Domain検査・Coordinatorの本番搬送・MCP Schemaを接続し、文書解析Planner・自動WBS生成・再計画Frameworkは追加しない。実AIの成立とは区別する。

人間と外部AIが文書・目的・仕事・判断を共有する基本機能（CRDD Core）を、自動実行の成立条件から独立させる。自動実行機能（Optional Automation）は削除せず、同じ業務モデルを利用する任意の追加機能とする。

直前のStorage再編は同一Coordinator内の論理Ownerを分けたもので、Core独立を成立させたものではない。本計画はその成果を出発点に、Package間の責務・公開契約・保存境界を見直す。旧Orchestratorの独立Process・Queue・同期管理は再導入しない。

| Owner | 目標責務 | 引き取らない責務 |
|---|---|---|
| Domain Model | Entity、局所状態遷移、Query／CRUD、設定、共有保存 | Scheduling、Dispatch、Provider実行、実行許可の独自発行 |
| Coordinator | 計画の実行受付、Task選択、Domain横断調停、Retry／Recovery調停 | Domain正本の複製、共通保存実装、単一試行の技術実装 |
| Executor | 単一Attempt、取消・期限、Effect観測、終了・結果・回復根拠の調整 | bin、常駐Server、独立Queue／Scheduler／Domain Store、計画全体の進行 |
| AI Adapter | Provider／Model Catalog、CLI・入出力・認証差の吸収 | Domain状態、Docker技術実装 |
| Docker Isolation／Platform Access | 既存の隔離・資源回収／OS境界 | 目的・仕事・採用判断 |
| MCP／Workbench | 共通Domain APIへのAI／人間向け入口、任意の自動実行接続 | Domainの重複実装、共通Gateway |

「Core」は論理的な基盤機能の呼称であり、新しい`core` PackageやDirectoryを作る指示ではない。

## 2. 初回棚卸しで確認したこと

静的な相対参照文字列`coordinator/src`を`src/**/*.ts(x)`から検索した。型参照と実行値参照を含む直接参照File数であり、推移的依存や実行時の独立成立を証明しない。

| Package | 直接参照File数 | 現在の処置 |
|---|---:|---|
| domain-model | 0 | 既存の中立的な保存・Context責務を土台にする。新移管で逆依存を作らない |
| ai-adapter | 0 | 技術Catalogと実行仕様のOwnerを維持する |
| mcp-server | 4 | Task・Workspace・実行状況と認証時の構成を分けて追跡する |
| workbench-server | 15 | 設定読取り、型、表示、Workspace、AI依頼をCore／任意実行へ分類する |

`executor` Packageはまだ存在しない。Domain Modelにも、添付で挙げたObjective／Task／Attempt／Queue／AI Selectionの各責務Folderはまだない。完成構造として空FolderやFile一式を先に作らない。

| 現行Source／利用側 | 現在確認できる責務 | 移管・評価先 |
|---|---|---|
| Coordinator `selection/types.ts`・`validation.ts`・`resolve.ts` | 設定Schemaと選定値・技術照合が同居 | 設定Schema／純粋解決はDomain、実行時BindingはCoordinator／Executorへ分解 |
| Coordinator `storage/ai-selection.ts` | 固定configのCAS保存。AI AdapterのJSON解析と選定検査も使用 | Domainの設定保存へ。構文解析、Catalog照合、実行許可を別に対応付ける |
| Coordinator `objective/`・`task/`・`decision/` | 業務値・局所遷移と実行調停 | 宣言単位でDomainとCoordinatorへ分類。Folder丸ごと移管しない |
| Coordinator `workspace/` | 論理値・保存操作・Git実操作の調整 | Domainの論理状態、Version ControlのGit、Coordinatorの実行調停を分離 |
| Coordinator `storage/state.ts`・`state/transition.ts`等 | 単一Snapshot、区画相関、物理出版と状態判断 | 共有保存と意味Ownerの接続を詳細設計。単純なWriter移動は禁止 |
| Coordinator `execution/settlement.ts`・`execution/lease.ts` | 元Ownerの真正証拠、一回使用、長期実行排他 | Executor／Coordinatorの実資源Ownerへ。Domain Entityへ真正Mapを移植しない |
| MCP `request/authentication.ts` | Domain CRUDを構成する際、Coordinatorの活動Readerも静的import | Core認可と任意実行の構成を分離 |
| MCP `request/server.ts`・`tools/task.ts`等 | Coordinator依存は注入上任意だが、Tool moduleを静的に構成 | Coordinatorが読込み不能な構成でCore起動を試験する |
| Workbench `server/routes/repository-view.ts` | 表示GETからCoordinatorのAI選択／通信設定をimport | Core設定APIへ直接接続 |
| Workbench `server/ai-selection/projection.ts` | AI Adapter CatalogとCoordinator設定Readerを合成 | CatalogはAI Adapter、設定はDomainから読む |
| Workbench `server/ai-request/`・AI依頼Panel | 読取り助言とWorkspace編集。会話履歴複製ではない | 「AI Chat非搭載」だけを理由に削除しない。機能対応と存続判断を先に確認 |

宣言索引・73項目のRoot API・直接利用側と、Domain／共通保存の具体案を[棚卸しとAfter案](runtime-domain-storage-after.md)へ整理した。74 File・1,668トップレベル宣言は構文索引であり、全実行閉包・真正証拠の移管確認を意味しない。上表だけで旧処理を不要・置換済みとしない。`storage`の5 Fileは直前再編の完了条件であり、移管先Package全体へ機械的に同じFile数を要求しない。

## 3. 先に固定する保存・状態契約

1. Core操作ごとに「更新する区画」「保全するAutomation区画」「同じCASへ含める相関」を定義する。Core CRUDにProvider認証やExecution起動を要求せず、既存Operation／Recoveryを空で上書きしない。
2. Entityの意味・局所遷移と、Cross-Domain調停を分ける。最新Snapshotに対する短期排他・再検査の位置を維持し、古い読取り値から保存を確定しない。
3. 共通の保存契約と、Executorが証明する事実を分ける。保存成功をAuthority・資源不存在・cleanupの証明にしない。元Controller／Hostのobject同一性、一回使用・初期化・出版順序の証拠を単なるEntityへ変換しない。
4. `state.json`は原則単一のまま。`queue.json`、独立Writer、共通Registry、Lock Framework、常駐Workerは追加しない。長いAI実行中は保存Lockを保持しない。
5. CoreとAutomationの型を分けても、Entity・Plan・判断の正本を複製しない。外部AI実行の報告からCRDD管理下のEffect／cleanupを推定しない。

| 代表例 | 必要な結果 |
|---|---|
| 自動実行を使わない新規Repository | Objective／Task／DecisionのCRUD・保存・再読がCoordinatorなしで成立 |
| 未解決Automation区画のあるSnapshotへ許可されたCore更新 | 当該区画と相関を保全し、実行再開やRecovery成功を自動生成しない |
| Core更新とQueue Claimが競合 | 同じCASで片方が競合として停止。別Storeへ分割して両方成功としない |
| 旧領域に未解決情報、新領域は不存在 | 空の新品状態へ切り替えない |
| Owner・履歴・pending・旧新対応が不明 | 移行・実行を止め、unknownと元参照を保持 |

## 4. 実施順序と出口

Callerの分解済みTask群の[公開受付契約](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#caller-task-graph-intake)をSourceへ接続した。PlanだけでなくTask別の既存実行入力を1対1で渡し、受付Hash二箇所へ固定する。Graph Server・本文Store・互換Wrapper、Task属性・文書同期・計画UIは増やさない。実行Snapshotと一般CRUDの移管は別に残る。

| 段階 | 作業 | 完了条件／主な確認 |
|---|---|---|
| A | 依存と既存能力の全棚卸し | Source宣言・Root API・利用側・旧Verificationを、移管／据置／撤去候補へ対応付ける |
| B | Domain Entity／Query／CRUDとAI Selectionの詳細設計 | 添付§5.3の十観点を各Domainで保持。Plan・Task Graph・Attempt・判断と実行状態を区別し、物理Afterと公開APIを提示 |
| C | 共有保存の詳細設計・Source移管 | 区画更新／保全と相関不変条件、短期Lock／CAS、保存途中再入場、真正証拠のOwnerを確定。DomainからCoordinator／Executorへ依存しない |
| D | Domain API実装とMCP／WorkbenchのCore接続 | Coordinatorを読込み不能にした構成で起動・CRUD・保存・再読取り。既存Automation区画を含む保全例も検査 |
| E | Runtime保存先の切替 | `.crdd/domain-model/`を第一候補として正本へ照合。state／history／pending／lockを一組で扱い、フロントAI移行手順と切戻し条件を確定してから有効化 |
| F | Executor Library境界の実装 | 最小のAttempt入力・結果・取消・終了・回復契約。Coordinator SnapshotやQueue Entryを丸ごと渡さない。Docker技術は既存Ownerを利用 |
| G | CoordinatorのOptional化 | 共通Domain APIとExecutorだけで調停。Domainの重複実装・不要Adapterを撤去し、Fake Executorで順序・Retry・Owner喪失・取消を確認 |
| H | 独立実境界と結合 | まずExecutor単独、次にCoordinator結合。実AI／Docker／人間操作は送信範囲・回数・回収を別途承認してから実行 |

A〜CはCoreのAPI成立に必要な保存境界を先に確定する依存順である。MCP／Workbenchの変更は、読取りを単に動的importへ変えるだけでは完了しない。Dの非AI成立を、F〜Hの自動実行完成待ちにしない。

機械的移管と意味変更を別差分にする。段階ごとの固定候補で回帰・独立レビューを行い、未接続Capabilityがある間は旧Ownerを削除しない。新しい常駐ProcessやPackage間ACKを途中構造として追加しない。

## 5. Runtime移行と既存方針の扱い

- 製品コードは新形式だけを扱い、旧形式移行はフロントAIの確認手順とする従来判断を維持する。添付§8.5の保全条件は、その手順と実行時の新領域有効化条件へ具体化する。自動Migration／互換読取りFrameworkを追加しない。
- `.crdd/domain-model/`は2026-10-28に人間が採用した。Sourceの新配置への接続と、実データの移行・有効化を区別する。旧新競合、中断、現在Owner、未解決Recovery、履歴・pendingの整合、有効化、旧領域退役を別Gateで確認する。今回の保持領域を調査・試験に使わない。
- `.crdd/config/ai-selection.json`は維持する。Catalogの内容はAI Adapter、設定の意味はDomain、現在の実行許可はCoordinator／Executorとする。
- 添付の`.crdd`直下禁止は今回のRuntime Fileへ適用する。文書化正本にある`external-send-policy.json`の既存例外は無断で撤去・一般変更しない。
- Core／Optionalの区別は新しいServer製品や分散Systemではない。同Process内の関数呼出しで成立する境界へIPC、Queue、Registryを追加しない。
- 既存助言とWorkspace編集の存続／任意機能化／撤去は、Workbenchの現在能力と要求への影響を整理して確認する。計画作成を止める判断ではないが、機能撤去前の判断である。

## 6. 設計・品質の正本と検証

| 更新する正本／利用側 | 予定処置 |
|---|---|
| Architecture基本設計・Component／Interface／Data Flow／Failure／Deployment | Core／Optionalの責務、依存、実行主体、状態・結果・Authorityの流れを更新 |
| Domain Model詳細・保存詳細 | Entityごとの十観点、Source対応表、保存相関、移行条件 |
| Coordinator詳細・Task詳細・Workspace | 共通Domainを参照し、調停と単一試行の境界を再定義 |
| Executor詳細 | 実Ownerから切り出す能力・入力／出力・取消／終了と回復根拠の設計。空の一般Frameworkを作らない |
| MCP／Workbench詳細・公開API・試験・配布入口 | 同じDomain APIへ接続。任意実行未導入と故障・欠測を区別 |
| Quality定義・設計・Trace・現在状態 | 添付AC-001〜027を正本の義務・具体項目へ対応付け、未評価をPassにしない |

検証はL1（Domain／保存・非AI）、L2（Core＋MCP／Workbench・非AI）、L4（Coordinator＋Fake Executor・非AI）を先に独立させる。L3（Executor＋実AI）とL5（全結合実AI）は別の実行許可を得るまで実施しない。L1／L2の完成をL5の未完了へ従属させず、L1／L2成功からL5を成功ともしない。

変更分類は複数Package・公開契約・保存先へ影響するArchitecture再編。今回は計画・調査だけでRuntimeの意味を変更しない。着手前確認では現在の単一保存、Core CRUDによるAutomation保全、真正証拠の扱い、AI Selection依存、Path切替の別Gateを読取り専用の確認者と照合し、計画へ統合した。

実装候補には専門独立レビュー、文書の参照確認、複数正本・移行・利用側の不足影響確認を適用する。準拠基準・Release判断は変更しないため、その採用・Release監査を今発火させない。計画作成の着手可をArchitecture採用、Source移管安全性、全体品質のPassへ流用しない。

比較した案は、現状維持、Core独立だけを動的importで装う案、本計画の共通Domain＋任意調停である。前二案は、共通CRUDの正本や保存相関をCoordinatorから分離できないため目的を満たさない。独立Process化も保存同期と復旧を増やすため採らない。

## 7. 現在の未確定事項と次作業

### D〜G再開時の接続確認 — 2026-10-28

基準`31aaccf37`から、D（Core公開接続）・E（保存先切替）・F（Executor境界）・G（任意調停化）を再開する。実AI・Docker照会／操作・過去保持物の読取り又は変更は対象外。共有Writerの移管完了と、これら四段階の成立を区別する。

| 段階 | 現在確認した不足と処置 | 変更してはならないもの／検証 |
|---|---|---|
| D | MCPのTool群とWorkbenchの活動・Workspace・通信設定RouteがCoordinatorへ静的到達する。CoreのDomain操作と任意実行の構成を分離し、一般CRUDの現在認可を接続する | Coordinator読込み拒否の実子Processで起動・CRUD・保存・再読取りを確認。Automation区画の全文保全、失効・CAS・対象参照拒否を維持 |
| E | `.crdd/domain-model/`は2026-10-28に承認済み。state／history／pending／短期lockを一組にする移行・切戻し手順を固定する | 実保持物を移動しない。旧新競合・未解決Owner／Recovery・観測不能で空初期化しない。自動互換読取りを作らない |
| F | Provider単段を一Attemptとする案を提示。編集→レビュー→是正の順序判断はCoordinatorへ残す | ExecutorへSnapshot・Queue・Lease・再試行方針を丸ごと渡さない。取消／join・unknown・exact回復参照を維持 |
| G | Dの実読込み閉包とFの契約を確定してから、既存調停をDomain＋Executorへ接続する | Fakeでも実際と同じ開始・取消・完了契約を使用。Domainとの二重状態・保存・新Registryを増やさない |

人間確認は、保存先、Executorの粒度、Core編集の既存内容権限への対応とローカル操作主体である。2026-10-28に後二点は承認された。ExecutorはProvider単段を一試行とし、編集→レビュー→是正の順序・Queue・再試行判断はCoordinatorに残す。Core定義編集は既存development内容権限へ対応し、ローカルWorkbenchは既存入口保護の下で起動Host利用者の操作として扱う。Browser接続元のOS本人証明や新しい認証・権限設定を追加しない。保存先も続く人間のOKにより`.crdd/domain-model/`へ確定した。Source切替と実データの移行許可は区別し、実保持物は操作しない。技術的なTool名やFile配置だけを理由に新たな承認段階を増やさない。既存の助言・編集・Workspace操作は任意機能として保全し、Core独立のために無断撤去しない。

判断不要な最初の差分として、`inspectAiSelectionChoice`／`hashExecutionSelection`をDomainの`ai-selection/validation.ts`へ集約した。型はDomainの既存`AiSelectionChoice`で閉じ、AI Adapterへの逆依存を追加しない。Coordinatorの旧File・Root再exportを撤去し、Workbenchの明示選択検査・内部利用側・Symbol・試験Oracleを直接接続した。Network PolicyのDocker構成やAuthorityは移していない。これはDの部分接続であり、Core全体の単独成立ではない。

局所四Suiteは26件成功。最初の新規Hash試験は合成Model名の転記不一致で二成功・一不合格となり、基準の`historical-model`へfixtureを一致させてから上記四Suiteを確認した。既存Hash期待値・拒否条件は変更していない。追加の利用側六Suiteは79件成功、Domain／Coordinator／Workbenchの型検査も成功した。独立レビューのMinor一件（新UTの台帳登録漏れ）を是正し、新UT三件再成功・Catalog409件valid・限定再レビュー残指摘零。変更した三文書の指摘は零で、参照展開先にはbroken-link 263件が残る。展開範囲は前段の文書検査と異なり、全体文書QAの合格又は263件の新旧全件照合を主張しない。変更Sourceの整形・Lintは警告／Error零（既存の情報診断三件）、diff check成功。今回の純粋検査移管だけを閉じ、D〜G全体完了は未宣言。人間確認は保存先一件だけが回答待ちである。

#### Dの公開Root独立とWorkbench接続

`281a324b3`後の候補では、公開入力・観測の純粋型／検査をDomainの意味Ownerへ移し、Scheduler・投影生成・実行AuthorityはCoordinatorへ残した。同期MCP Inspectorと既存公開名は同じDomain実体を利用する。MCPの任意Workspace／活動Reader、Workbenchの任意活動／Workspace／通信設定Readerは使用時だけ固定Ownerを読み込み、待機後の取消・認可・Rootを再照合する。汎用loader、Registry、Queueは追加しない。

Workbenchへ`GET/POST /api/runtime-definition`を接続した。既存Origin・Action Token・共有development権限又は起動Hostのローカル操作主体を使い、Domainの初期化・Plan保存・Objective／Task CRUD・Queryへ直接配送する。新しい計画UI、文書同期、実行権限は作らない。既定binはCoreだけを起動し、旧来のAI利用を続ける起動設定にはフロントAIが`--automation`を追記する。Library利用側の明示AI注入は維持する。

Coordinator／ExecutorのModule解決を拒否した子Processで、MCP Rootの本番FactoryとWorkbench Rootの実HTTPから保存・再読取り・CASを確認した。Workbenchは3MiB超の合法Planも同じ16MiB Writer制限内で保存し、Form搬送上限を超える宣言は拒否して全文不変を確認した。待機中失効・取消・切断は当該Source区間の有限代役でReader零を確認し、実HTTP正常経路の成立と区別した。bin構成も実entryを使い、既定Core／明示Automation／不正引数を確認した。

先行MCP全回帰は105件成功。Workbench先行全回帰は110件中107成功・3不合格、Domain先行全回帰も不合格だった。後者の公開API期待一覧二件、Workbenchの型import位置を誤読する検査、期限超過した固定日付の合成Event、検証Script切出し旧位置を追従し、対象別の再確認は成功した。製品の保持期間・安全判定・Timeoutは緩和していない。最新Workbench独立接続Suiteは3件成功。独立再レビューは先行のBody上限・待機後認可・bin試験の指摘を解消し、追加Source指摘零。対象全回帰は更新候補で再実行中であり、先行失敗を成功へ書き換えない。

更新候補のDomain全回帰は468件成功・不合格零、Workbench全回帰は111件成功・不合格零で終了した。Coordinatorの公開値・実状態投影・依存境界の関連34件と、Domain／Workbench／MCPの静的checkも成功。文書検査は今回の正本・計画・Context七文書に指摘零、参照展開先の過去リンク等3,367件は不合格のまま保持する。過去Evidenceは修正しない。

その後、配布MCP Launcherに残ったCoordinator静的参照を検出した。Node版本検査を現在Processの既存下限確認へ閉じ、単体`--automation`明示時だけ四操作を固定Moduleから構成する。既定local stdio／HTTPへ既存Workspace対象解決を使うCore RuntimeAccessを接続し、Manifest・Root・取消・projectId／repositoryIdを要求ごとに再確認する。CROSは既存AM認可を維持し、未接続のCROS＋Automationを64で拒否する。Module解決拒否下の実配布入口でも保存・再読取り・CASが成功した。入口変更後のMCP全回帰も105件成功・不合格零・取消零で終了し、stdioの実CRUD、HTTPの実ListenerとTool一覧、対象ID不一致、Node版、Owner欠測と不正引数拒否を確認した。追加独立レビューのSource指摘は零。自動実行有効時の実AI成立をこの非AI回帰から推定しない。

Catalogは411件の登録整合を確認したが、411件の試験成功を意味しない。このD検証時点では保存先Eは回答待ちで既存配置を維持していた。続くEの採用・検証は下節に示す。FのProvider単段Executor抽出とGの本番調停接続は別の未完了作業である。Fの着手前照合では、単段準備・Process／取消・join・結果・元回復証拠を一体で移し、Task全体の順序・Workspace・共通Host清掃をCoordinatorへ残す必要を確認した。現在混在するControlRecordを丸ごと渡す移管、証拠Mapの二重登録、ExecutorからCoordinator内部を参照する暫定接続は採らない。実AI・Docker・過去保持物を操作していない。



#### Eの保存先採用とSource切替 — 2026-10-28

人間の「OK」により共通保存先を`.crdd/domain-model/`へ統一する。Sourceの名前付き領域とPath fieldを`domain-model`／`domainModel`へ切り替え、Reader・Writer・history・Queue／Lease・公開入口・検証Scriptと合成試験を追従する。旧aliasは追加しない。Schema・CAS・Hash domain・Kernel Pipe名・真正Mapと一回使用証拠は変えない。`.crdd/config/coordinator.json`とその保持値も維持する。

着手前照合では、公開初期化へフロントAI手順だけを要求しても旧領域のある空初期化を防げないことを確認した。固定旧Pathのmetadata不存在だけを作成前・初回出版境界で検査し、ENOENT以外は拒否する最小処置を採用した。これは旧内容・旧SchemaのReader又は探索ではなく、自動移行・移動・削除も行わない。旧領域のDirectory／File／junction／観測不能、親置換、保存直前の後発出現と、新正本存在時の旧残置を区別した。新しい台帳・State・Lock Frameworkはない。

合成8件は成功。初回はQueryへ余分なexpectedAbsenceを渡したfixture不備、後続では保存Source試験の新private guard依存の追従漏れを検出し、拒否条件を緩めず是正した。全回帰・利用側結合・独立レビューは進行中であり、E完了とはまだ表示しない。[フロントAI移行・切戻し](../../../19_Workflows/01_Coordinator_Runtime.md#runtime-domain-storage-migration)を整備し、新書込み後の単純切戻しを禁止した。templateの共通状態placeholderは真正不存在の初期化と矛盾するため撤去し、初期化時だけ作成する。実保持物と旧実データは操作していない。

その後、Domain全回帰一実行474件とCoordinator／MCP／Workbenchの関連結合49件が全成功した。全回帰後に追加した親置換・出版直前出現を含む限定matrix八件、初回出版失敗とCore CRUD四件も別実行で成功した。これらを476件の単一runへ合算しない。制限環境でjunction作成がEPERMとなった一実行は不合格として区別し、通常実行環境では同じ八件が成功した。型検査で検出した試験mockのundefined対応も修正後に確認した。Domain／Coordinator／MCP／Workbenchの静的check、Catalog411登録整合、diff checkを通過した。

独立レビューの現行設計旧配置一件と、出版中断時のmarker／pending保持Oracle不足一件を是正した。同じmarker schema／Bindingでpendingを正規decodeし、再呼出し時の両bytes不変・正本不存在を確認した。限定再レビュー残指摘零。Domain05後段の旧配置維持記述も、当初時点と現在採用後を分けて同期した。EのSource切替・合成検証・移行手順は限定完了とするが、実データ移行・切戻し実行・過去保持物・F／G・実AI／Dockerの成立を含めない。

変更対象九文書の検査指摘は零。参照展開先にはbroken-link／anchor等3,374件が残り、全体文書検査はexit 1である。前段とは対象正本・展開先集合が異なるため、3,367件との差分を今回の新規故障数と断定せず、全体QA合格も主張しない。

Dの今回の非AI公開接続候補は、基準`281a324b3`と`40_Develop`／`template/tools`のtracked差分及び新規File本文を結合したSHA-256 `2a4134f5acb5ca208e118755a37228cda8e35a58317b72a31521a1a658dfe328`で特定する。独立最終確認の旧時点文書表現一件を時点限定へ是正し、MCPの同種表現も追従した。Source契約の追加指摘は零。Dの今回範囲は限定完了とし、Eの保存先判断、F／G、実AI／Docker、人間操作、CRDD全体QA又はRelease完了へ拡張しない。

#### Fの単段移管に対する着手前照合

続くSource実装では、Provider単段の準備・計画・Process開始／取消／join・結果正規化と通知／終端Mapを`40_Develop/executor`へ宣言単位で移管した。[Executor詳細](../../../06_Architecture/Details/executor/01_Architecture.md)を正式な境界の正本とする。Coordinatorには選定・送信同意・Task段階順序・Workspace・共通Host清掃と保存を残し、`execution/provider-executor.ts`の固定一実体へ接続した。DomainのCAS・Schema・Hash領域・Kernel・保存先を変更せず、新Registry／State／Worker／Lockを追加していない。

既存の準備Mapとcontrols、通知・終端の私有Mapはそれぞれ元Owner単位で一実体とし、三保存利用側は同じ本番Verifierへ直接接続する。通知登録→同期保存→finally失効、元result借用を保持し、Mapや生WriterをRootへ公開しない。本番Factoryは固定Docker Isolation、試験候補は別Map・本番Authorityなしとする。Module初期化の相互参照は同じSingletonへの関数宣言で束縛し、実行中の遅延Loaderを追加しない。

先行関連324件と独立Root／Map／準備の五件は成功した。独立レビューでは保存・回復試験の旧mock先一群を検出し、新しいVerifier Ownerへ追従した。型契約の同形二宣言もExecutor側へ一本化した。CatalogとSymbolは実移管先へ接続し、歴史的Evidenceは変更しない。AI・Docker照会／操作・認証情報・過去保持物の操作はない。

固定Sourceは基準`f7326f45e4f9e2c7f62de849fc68f55ae4e50afc`、tracked `40_Develop`差分と新規18FileのPath・NUL・本文を順に連結したSHA-256 `148b47293f01603e49e7c40534e1ae129bfdae1876f133d7897b0ea2972b3f96`で特定する。Executorの五件はCoordinator解決拒否、準備Map分離、同期通知失効、元結果と別Owner拒否、同じOracleによる旧Path変異拒否を確認した。最新通常Windowsの関連324件、MCP105件、Workbench111件の各全実行は別々に成功した。制限環境の同関連試験では実子Process取消が終了不明で失敗し、通常環境で324件全成功した結果と区別する。

Windows保存の先行六Caseは四成功・二不合格。終端と清掃の代役が移管後に同一Moduleとなり二重mockした一件は、終端区間後のrestoreで是正し、子Caseを含む二件が再成功した。正常Owner一回・保持あり・二回は先行成功、三回＋HTTPの15秒超過は単独実行で同じ期限のまま成功した。単独時のHTTP応答は約10.4秒。並行実行負荷が原因だったと断定せず、期限とOracleは変更しない。旧Path変異の検査も同じ検証関数へ正常／変異本文を渡す形へ補強し、独立再レビューは残指摘零。

Catalog414件valid、関連台帳二十八件成功、変更対象文書のChecker指摘零。Repository全体Checkerは別範囲の3,723指摘によりexit 1で、全体QA成功ではない。Domain広域では台帳期待集合の追従一件と子Process競合二件を検出した。前者は新Ownerをexact集合へ追加し、後二件は同じ期限で単独再成功した。全体の先行不合格を取り消さず、固定候補のDomain／Coordinator広域回帰終端は継続確認する。Source限定Passとこれらの未確定結果を区別する。

Domainの後続固定全実行は476件中475成功・一不合格・取消零だった。Topic／Meeting協調Writerの後続更新でWindows `rename` がEPERMを返した。同CaseとKernel競合の単独二件は成功し、さらに同保存Suite九件の単独実行では協調Writerが成功した一方、別の読戻し反例が同じrename拒否で不合格だった。拒否を許容するOracle、製品の再試行、期限変更は追加しない。失敗時の元syscall・source/destinationと自己生成Rootは試験結果で特定し、既存保持物は調べていない。

独立したSource確認で、このStoreと同Suiteは基準版から差分零、今回のDomain製品差分は台帳検査だけであり、Executor抽出から当該保存への依存経路はなかった。temporary descriptorのclose後rename、両子Processのclose／join後更新、各故障注入のfinally復元も確認した。原因をOSやAVへ断定せず、F／Gとは独立した既存Windows保存境界の未解消観測として分離する。担当責任者はQual-Lab、再評価契機はDomain保存境界の是正又は同じ固定SourceのWindows再現確認。保留中はDomain広域全成功・全体QA成立を主張できないが、現在のF／G移管の追加Source変更や危険な許容緩和を要しない。Source限定の完成と全体QAを分ける。

Coordinatorの固定全回帰は終了値1で終了した。保持した末尾診断は、新しいExecutorを未署名配布fixtureの複製対象へ含めなかったための`ERR_MODULE_NOT_FOUND`だった。末尾だけの出力から全不合格の件数・原因を推定せず、この実行を成功としない。既存components集合へExecutor一件だけを加え、利用側三Suite三十件は再成功した。製品Source・安全判定・Timeoutは変更していない。Architecture詳細MapのExecutor領域と二つの逆参照、Domain→Executorの既存台帳Binding、品質案内の旧未実装表示も追従した。限定独立レビューは残指摘零。修正後の全回帰では最終集計と不合格行を保持して確定する。

着手前照合の履歴: Fの原子的な移管単位は`executeStage`だけではなく、単段準備、Process開始／取消／join、結果正規化と元Docker回復証拠の閉包とした。`ControlRecord`のTask全体と単段字段を分け、後者の真正MapをExecutorへ一実体移管する方針を採用した。Coordinatorは現在Attemptの不透明Controlと終了後の不透明証拠を保持し、Task配列の順序・再試行・Workspaceと共通Host清掃を所有する。共通Host清掃前の各Attemptの準備、元清掃結果後の確定又は不明時の放棄は用途固定操作として接続し、汎用callback／新Registry／二重Mapは作らない。`result.ts`・`operation.ts`・`recovery.ts`の丸ごと移動は循環と上位責務流入を生むため、宣言単位で分割した。この着手前判断自体を実装・回帰の根拠にはしない。

<a id="executor-optional-final-results"></a>

#### F／Gの指定範囲の最終結果 — 2026-10-28

Provider単段のExecutor移管と、Domain＋Executorを使う任意Coordinatorの本番接続・重複撤去は、Sourceと対象非AI確認の範囲で完了した。実装は`3836e96a97be55a35ef159f86423fdbc6ed89bca`、配布fixture・台帳・設計対応の追従は`03a730a4d3e1cf4030b5489008d4948b68f703eb`でcommit・pushした。後続差分は試験二Fileと最終記録だけで、製品Sourceは前者から不変である。

固定`03a730a4d`のCoordinator `npm run test:portable`は1,795件中1,788成功・二不合格・対象外五・取消零、終了値1、約54分14秒だった。対象外は未許可の実Docker関連四件・実Provider一件で、Host Windows専用Gateもこの母集団の外である。不合格は公開操作試験の関数切出しが末尾importまでVMへ渡した構文エラーと、責務一覧への`execution/provider-executor.ts`登録漏れの二件だった。単独再現で原因を確認し、前者は既存の中立AST補助によるexact宣言抽出と関数形状確認へ、後者は技術実行集合への一件追従へ是正した。六つの失敗・取消条件、元依頼ID、終了失敗、秘密詳細非公開と、純粋閉包・全数一致・変異拒否は維持した。

是正後の二Suite全十五件は一実行ですべて成功した。固定全回帰一回の二不合格を消さず、1,795件の単一再成功とは表示しない。配布fixture三Suite三十件、Executor五件、関連三百二十四件、MCP百五件、Workbench百十一件、Windows保存の範囲別確認もそれぞれ別実行の根拠として保持する。今回の差分から実AI／Dockerの成功を推定しない。

Source・Oracle・配置・公開境界の独立レビューは、是正後の残指摘零。最後の二試験Fileは整形・警告を失敗とするLintを通過し、既存の情報診断二件をErrorへ換算しない。品質案内の古い未実装表示と詳細設計Mapの登録漏れも是正した。変更した品質三文書と詳細Mapの文書指摘は零、同検査から展開した参照先3,333指摘は別範囲で不合格を維持する。先行Repository全体3,723指摘とは母集団が異なり、その全件解消とはしない。結果本文は既存の本計画とTool出力に限定し、実行ごとの巨大なEvidence又はログ書庫は追加しない。再実行入口は各Packageの既存test／checkと上記二Suiteである。

未完了はHの実AI／Docker・人間操作、実データ移行、正式QAの全数再評価とRelease判断である。Domain全回帰のWindows rename EPERM一件は上段の担当・再評価条件で独立追跡し、全体品質の成功とはしない。これらをF／GのSource移管済み表示で覆わない。F／Gの既存Source移管範囲を閉じるための追加判断はない。Hは下段の採用済み試験用組立で進め、実境界の成立は未確認である。AI再送・Docker照会／操作・認証情報・過去保持物の読取り又は操作は実施していない。

<a id="windows-document-rename-investigation"></a>

#### Windows文書保存の拒否切り分けとHの準備 — 2026-10-28

`954100163`の後続調査であり、F／Gの製品Sourceを変更しない。対象はDomainのTopic／Meeting保存境界と既存CPR-IT-010の協調Writer試験。新品のRepository内合成Rootだけを使い、過去保持物・既存状態・認証・実AI・Dockerは操作しない。保存・改訂・排他・読戻しの契約は不変で、製品のretry、期限変更、権限緩和、新しい回復処理は追加しない。Source／Oracleの限定独立レビューと文書の参照確認を適用し、準拠・Release判断の変更や監査は今回対象外とする。

既存九件は八成功・一不合格。協調Writerの第一子が終了1となるが、従来の`stdio: ignore`で一次理由を失っていた。試験だけを`ignore / ignore / pipe`へ変更し、stderrを常時drainして先頭4096 bytesだけをメモリ保持し、close後のassert失敗補助に使う。Fileへ保存せず、上限後もpipeを消費する。code／signal／spawn error、十秒期限、release・kill・join、全子close後だけのRoot回収は維持する。診断追加後の九件も八成功・一不合格で、第一子の`rename`がNode v24.19.0／libuv 1.52.1で`EPERM / errno -4048`を返したことを確認した。改善又は成功へ読み替えない。

| CRDDを通さないNode標準比較 | 固定した例数 | 観測 |
|---|---:|---|
| 親Process・直前読取りなし | 8 | rename成功8 |
| 親Process・直前lstat／読取りあり | 8 | rename成功8 |
| 子Process・直前読取りなし | 8 | rename成功7、同じEPERM一件 |
| 子Process・直前lstat／読取りあり | 8 | rename成功8 |

比較は今回専用の非link試験親から生成したRootで、各例に新規の`record.md`=`BASE`と`.record.md.tmp`=`NEXT`を通常writeして閉じ、同じNodeの`fs.renameSync`を一度だけ呼んだ。子は固定`--input-type=module --eval`のNode組込みfsだけで動作し、CRDD Module・Writer・Lock・状態を読み込まない。これは同じ拒否をCRDDなしで再現した根拠であり、全EPERMの原因が同一又はCRDDに他の問題がないという証明ではない。

追加の参照元照会は、新品Root内の子rename最大十六例・最初の失敗で停止する有限比較とした。十三例目で同じ拒否を観測し、そのtemp／target二FileだけをWindows標準Restart Managerの`RmRegisterResources`／`RmGetList`へ渡した。両File属性は32（読み取り専用bitなし）、Start／Register／List／Endはすべて0、照会時点のprocess一覧は空だった。停止・再起動APIは呼んでいない。後追い照会であり、一時的なhandleやKernel／セキュリティ製品等の拒否を排除できず、原因をAV・ACL・特定Processへ断定しない。[libuv 1.52.1のWindows rename](https://github.com/libuv/libuv/blob/v1.52.1/src/win/fs.c)と[Windowsの照会API](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmgetlist)は一般的意味の参照だけに使い、ローカルの原因証拠としない。

比較の全子終了・今回Rootの通常削除と不存在を確認し、短命診断Script三件も削除・不存在確認した。生の診断書庫、製品用計測Framework、Native部品は追加しない。恒久差分は既存試験の有限stderr観測だけである。Domain型検査、変更試験の整形・警告を失敗とするLintは成功、Source・Oracle・結果とH条件の限定独立レビューは残指摘零。Windows保存の不合格自体は未解消で、担当Qual-Lab、再評価はWindowsファイルI/Oの拒否元を限定観測できる時又は実行環境変更時とする。OS監視やセキュリティ設定の変更を今回のSource調査許可から推定しない。

Hは次の条件候補へ分ける。まだ実行許可を取得又は消費したとは扱わない。

| 段階 | 送信・モデル・上限候補 | 前提・停止・回収 |
|---|---|---|
| Executor単独の読取り | 合成Contextと固定質問のみ。Codex `gpt-6.1-sol`／medium、Claude `claude-opus-5-5`／mediumを各一回、合計最大二回 | Coordinator解決拒否下で正常・取消・Host終了の非AI構成を先に固定する。既存Task検証ToolはCoordinator経由のため、単独実試験の代用にしない。独立実試験の準備は未完了 |
| Coordinator結合・Direct／Isolated | 合成`source.txt`・既存dirty／stage／未追跡確認用File・合成Context・固定指示と差分だけ。Codex編集→Claudeレビュー、必要な既存限定是正一回と再レビューまで。二Task、AI起動は合計最大八回 | 固定版で非AI事前確認・独立確認を先行。Task全体の自動再試行なし。不明な失敗で停止し、今回の資源だけ既存処理で回収する |

使用Imageは現行Sourceの固定Codex CLI 0.164.0（Task digest `832019e6…a4a4`、助言用 `112a73d8…6de3`）、Claude Code 2.1.310（`612433b7…c51f`）、共通Proxy（`4270d4dc…3766`）を候補とし、Image取得・更新は含めない。これはSourceの指定値であり、Engine・実Image・モデル利用可否は未確認。実施時の承認はDocker読取り照会・既存Subscription認証領域の用途限定使用・Provider通信・合成内容の外部送信・今回作成資源の回収までを明示する。Container／Networkは各同時最大二、Engine停止・固定Image欠測・事前確認失敗では停止する。Docker起動／再起動／修復、API Key fallback、実Repository本文送信、過去保持物操作は含めない。

今回のWindows拒否は、実試験の保存・回収も止め得る未解消Riskである。Source診断の完了を環境正常化と扱わず、現時点では実AIを開始しない。まず独立Executorの非AI試験構成と事前条件を具体化し、未解消環境Riskを再評価してから、確定した送信本文・固定Commit・回数・exact試験Root・清掃条件を人間へ提示する。未準備の実試験を今承認させない。

<a id="executor-standalone-non-ai-lifecycle"></a>

#### Executor独立候補の非AI生涯確認 — 2026-10-28

変更分類は検証追加。基準`70d09a0bb`の製品Source・API・保存契約は変更しない。既存ERB-IT-002／004とExecutor詳細設計へ照合し、読取り専用の着手前確認後、既存`public-boundary.contract.test.ts`へ一Caseを追加する。専門観点は単段の取消・終了相関と証拠のOwner結合。Source／Oracleの独立レビューと変更文書の参照検査を行い、準拠・Release監査は契約変更も完成宣言もないため対象外とする。新しい公開注入口、Framework、状態、Lock、外部試験物は追加しない。

新品Node子ProcessがExecutorのimport前にCoordinator解決拒否hookを登録し、解決試行零を検査する。既存の隔離候補Factory・実Controller・実DI command sessionを使い、合成Planと有限CommandHandle、Host callbackだけを代役にする。Claude形式の合成Probeについて正常、wait未完了中の取消、清掃不明、同期通知保存例外を各一回検査する。九purposeの順序、各handleの開始確認・wait回数、取消時の終了一回、wait終了後の清掃一回、清掃を返すまでcompletion未確定、後着解決による追加要求零を確認する。準備参照の再利用は拒否し、回復引渡しを最初の要求前に検査する。

清掃不明はblocked・清掃未確認・手動回復必要・同じexact回復参照・結果Hash非発行を共同検査し、不在証拠の欠測を終端観測へ登録しない。正常・取消・通知例外の元終端観測は元result／管理参照／操作ID／回復IDだけで借用でき、コピー・別Owner・別候補Runtimeを拒否する。元通知は同期callback内だけ有効とし、正常・取消・例外後すべてで失効を検査する。全completionと子Processの十五秒以内終了を確認する。

追加後のExecutor `npm test`は整形・型・警告を失敗とするLintを含め六件すべて成功。追加一Case内の四条件と既存五件を別件数へ水増ししない。Catalogは414項目validであり、414件の試験実行ではない。独立レビューの二指摘は取消APIの返却値・順序と通知保存例外の固定理由を追記し、再回帰後の再レビューは残指摘零。例外は既存の実行catchによる固定理由、false返却は保存拒否理由として区別し、製品側を変更しない。変更文書二件の指摘は零、参照展開した十七文書の十三指摘は旧CHG本体の過去Pathリンクに限定され、別範囲の不合格として保持する。全体QAの合格へ換算しない。

これは候補上の有限結合であり、本番`createProviderExecutor`の固定Docker接続、両Providerの実実行、耐久Recovery保存、実Process／Container不存在、Host Process喪失後の回収は未確認。Hの独立実試験準備全体は未完了のままとする。外部AI・Docker照会／操作・認証情報・過去保持物の読取り又は操作は行わない。Windows保存拒否の未解消Riskも変更しない。

<a id="executor-production-factory-non-ai-wiring"></a>

#### Executor本番Factory配線の非AI確認 — 2026-10-28

基準`fdb43e73d`からの検証追加で、製品Source・API・保存・Timeoutは不変。前段と同じERB-IT-002／004と詳細設計を使い、読取り専用の着手前照合で候補生涯と本番Factory配線の保証範囲を分けた。既存Case内で候補／本番Factoryの二構成へ同じ四条件を適用し、新しい試験Framework、製品用注入API、永続状態又はLockは作らない。

子Process内でCoordinatorの解決を拒否し、Executor import前にDocker Isolation Rootの`createDockerIsolationRuntime`だけをModule代役へ替える。他exportは実namespaceを維持し、代役Runtimeは既存公開の候補sessionへ有限CommandHandleを渡す。本番構成の計画は公開builderで生成して実`validatePlan`と投影へ通す。Factory生成各一回、入力が元の所在／Receipt借用二つだけであること、identity・構成・stdin・回復／管理Ownerの同一性、元清掃結果のVerifier搬送を確認する。Hostへ余剰に置いた実行・清掃primitiveは利用零、子内の外部Process生成APIも拒否して呼出し零を検査する。

前段の正常、wait中取消とjoin、清掃不明、同期通知保存例外のOracleを両構成で維持する。元結果・別Owner・別Runtimeの交差拒否に加え、本番公開Verifierへ元清掃結果、コピー、別回復／管理参照を渡して元結果だけを受理することを確認する。候補と同じ合成Claude Probeであり、本番Docker Runtime内部、両Providerの実実行、耐久保存、実Process／Container不存在、Host喪失後の回収は未確認。Hの実試験準備全体は完成扱いにしない。

追加後のExecutor `npm test`は静的検査を含め六件成功。一Case内の二構成×四条件を独立した八件へ水増ししない。Catalogは414項目valid、限定独立レビューは指摘零。変更三文書の指摘は零、参照展開した五十七文書では他のCHG本文に3,050指摘があり、その範囲は不合格のまま保持する。前段の十七文書・十三指摘とは母集団が異なり、増減の比較には使わない。本番DIでのReceipt借用は同一参照搬送までで、実Runtime内の利用成立とは区別する。実AI・Docker照会／操作・認証情報・過去保持物操作はなし。Windows保存拒否の未解消Riskを維持し、製品修正やretryで覆わない。

<a id="executor-real-boundary-host-decision"></a>

#### HのHost接続判断とWindows追加切り分け — 2026-10-28

人間から残件①単独実試験準備・②実Docker／実AI・③Windows保存拒否の対応を指示された。製品変更、新Host、実送信、Docker操作又はOS保護設定変更の許可まで拡張しない。Sourceと既存保証を照合した結果、次の判断待ちを検出した。

| 残件 | 現在分かったこと | 処置／未完了 |
|---|---|---|
| ①単独実試験準備 | 公開ExecutorはHostを受けるLibraryであり、本番HostはCoordinatorの`operation`／`authority`／`preparation`／`recovery`の私有Owner、Home／Host排他、同期保存へ結合する。Domainの保存APIと公開Plan builderだけでは元Capabilityの発行元を代替できない | 新Hostを複製せず、単独性は非AI、実境界は既存Coordinator経由へ分ける案を提示。判断前に完成条件を書き換えず、独立実試験準備の完了とはしない |
| ②実Docker／実AI | 既存Coordinatorの正式入口から同じExecutor本体へ接続できる。独立Hostを使う経路はない | 上記の検証分割判断後、送信本文・モデル・回数・exact試験Rootと回収範囲を確定して別途承認へ渡す。まだ起動・送信しない |
| ③Windows保存拒否 | CRDDなしのNode標準renameで再度EPERMが発生。Win32直接比較は有限例ですべて成功 | 拒否元は未確定。retry、期限／安全判定緩和、OS設定変更、新回復機構は追加しない |

①の棚卸しは作成担当と別の読取り専用確認者が同じ結論となった。既存保証を模した成功callbackを実Effectへ接続する案は、私有Ownerと耐久保存を検証したことにならないため採らない。新しい独立Hostを要求する場合は、実行Authority、元操作、Home／Host排他、Recoveryと保存を新たに設計・移管する範囲変更になる。この時点では分割検証を推奨して判断待ちとしたが、後段の人間判断により製品Hostと試験組立を区別して進める方針へ修正した。

③の追加比較は`2026-10-28T09:06:38.251Z`〜`09:06:41.115Z`、新品Root `C:\project\CRDD\.crdd\tests\rename-native-boundary-WRNOKu`だけを使用した。各子Processが`BASE`のtargetと`NEXT`のtempを書いて閉じ、一回だけ置換する。各方式は最大十六例、最初の失敗でその方式を停止し、再試行しない。Node子は十五成功・十六例目で`EPERM / errno -4048`、Python ctypesからの`MoveFileExW(MOVEFILE_REPLACE_EXISTING)`は十六成功・各直後Win32 error 0だった。成功時はtarget本文とtemp不存在を確認した。全子の通常終了、Root内が自己生成の二種File・固定本文・非linkだけであること、通常削除とRoot不存在、短命Script削除と不存在を確認した。実資源・過去保持物は対象外である。

Win32直接比較は[公式APIの失敗直後error観測](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)へ接続するための別経路であり、Nodeで失敗した同じ要求のWin32 errorを捕捉したものではない。両方式の例数・Process構成差と発生頻度があり、Node／libuv固有故障又はAV原因とは断定しない。失敗時刻の前五秒・後十秒だけ、既存Defender Operationalの1123／1124を読取り照会した。通常環境はアクセス拒否、許可された読取り環境では該当時間・IDのイベントなしだった。これはDefender一般や他製品・一時handleの影響不存在の証明ではない。監視有効化・監視用Driver導入・除外・保護解除・修復・再起動は行っていない。原因をさらに限定するには失敗要求時点のOS側観測が必要だが、今回はその監視を開始しない。担当Qual-Lab、再評価は用途限定のOS観測を承認できる時又は環境変更時とする。

限定独立レビューは判断不要／判断待ちの対象範囲一件を明確化し、再確認で残指摘零。変更計画の文書指摘は零、参照展開十三文書の十三指摘は旧CHG本体の過去Pathリンクに限定され、その検査範囲は不合格のまま保持する。今回は製品Source・試験定義を変更せず、上記の有限実測と文書確認だけを実施した。①〜③全体の完了、Windows原因特定又は実AI実施とは表示しない。

<a id="executor-test-composition-entry"></a>

#### Executor内の試験用組立と再実行入口 — 2026-10-28

人間はExecutorのscripts又はtests内で試験用Hostを組む方針を採用した。前段で「完全単独実試験には新Hostが必要」とした説明は、製品Hostと試験の依存構成を混同していた。製品HostやFrameworkの新設を必須条件にせず、試験用の有限組立を進める。前段の分割検証案の判断待ちは、この判断で解消する。ただし既存の私有Capabilityや本番共有Home／Host排他が単独で利用可能になったと読み替えない。

| 変更 | 実装／確認 |
|---|---|
| 非AIの明示入口 | `40_Develop/executor/scripts/verify-provider-attempt.ts`。`npm run verify:standalone`から実行し、既存public-boundary ITも同じ関数を呼ぶ。import時の書込み・Process生成は零 |
| 単段の有限組立 | 既存candidate／production_factoryと四終了条件を同じ新品子Processで維持。Coordinator解決と子内外部Process生成は拒否する |
| 試験fixture専用排他 | 新品Root内で`wx`取得、二重取得拒否、保存前の保持確認、解放後の再取得と保存拒否を実観測。本番Home／Host排他とは別 |
| イベントcommit | Domainの既存`writeCommittedJson`／`readCommittedJson`を使い、元操作・回復参照、Hash・File Identityと本文の読戻しを確認。元通知を同じ同期Gate内で検証してからだけ保存する |
| 負例 | Gate false／例外、別Owner、コピー・失効通知、コピー終端結果では記録を生成せず既存File一覧・fixture lock本文を維持する |
| 終了と清掃 | 元completionと子Process通常終了後だけ、Root Identity・非link・許容名・固定値・File種別を確認して通常削除・不存在確認。一次故障と清掃失敗は分離して保持し、未確認はexact Rootを報告する |

製品Source・Root公開API・本番Runtime state Schema・共有認証・Authorityを変更しない。Scriptは静的検査へ追加し、Symbolと既存Catalogを追従した。新しいRegistry、製品State、Lock Framework、常駐Process、独立Evidence書庫は作らない。イベントは今回だけの有限試験物であり、成功後に物理Rootごと回収し、過去保持物を探索しない。

Executorの静的検査込み回帰六件はすべて成功。明示CLI入口も別実行で成功し、両実行とも自己生成Rootの回収・不存在を確認した。Catalogは414項目valid。限定独立レビューのimport時Effect Oracle一件を、読取り専用loader descriptorだけの許可と書込みopen／unlinkの同Source変異で是正し、再レビューは残指摘零。変更三文書・Executor Symbolの指摘は零、参照展開五十七文書の他CHG本文3,050指摘は別範囲の不合格として保持する。これらは非AI検証の結果であり、実Docker・Provider認証・外部AI・共有Home排他・本番Host保存・Process喪失回復の成立ではない。実境界へ進む前に、試験Hostで使う実認証／共有Home排他と元回復保存を具体化し、実際のモデル・送信・回数・exact Root・回収範囲を提示する。

同作業の初回整形では、Biomeが既存IT Fileへの書込みにWindows error 1224（ユーザーマップセクションで開いたFileへの操作拒否）を返した。整形差分を限定編集した後の整形確認・型・Lint・回帰は成功した。これは別要求・別Fileの追加観測であり、先のNode rename EPERMと同じ原因又は特定Processによる保持とは断定しない。監視・OS設定変更・Docker・認証・AI・過去保持物操作は行っていない。

<a id="executor-home-preflight-entry"></a>

#### 実Home事前確認の別入口 — 2026-10-28

実AIへ進む前の認証領域metadata・共有排他の確認だけを、`executor/scripts/verify-provider-home.ts <codex|claude> <run-id>`へ接続した。通常`verify:standalone`やpackage importから実Homeを観測しない。製品Source／API・Home・Credentialの配置・既存Lock契約は変更しない。実行は一Providerのexact一回について別途承認してから行い、実装時はPlatform observer／Lockを代役化した非AI試験だけを実施した。

| 境界 | 処置 |
|---|---|
| Home選択 | `LOCALAPPDATA/Qual-Lab/CRDD/ProviderHomes/{provider}`だけ。任意Home Path・作成・修復・ACL変更は受け付けない |
| 観測 | 既存Native helperの候補・現Provider・終了確認・Artifact前後一致・Filesystem Effect零を要求する。保持中に再観測し四Hash一致を確認する |
| 排他 | 既存Platform Accessの非同期Named Pipe取得・解放をそのまま使用する。既存ProviderHome名のSHA-256 domain・prefix・slice・入力制約をSource Oracleで照合し、三変異を拒否する。Coordinator Moduleはロードしない |
| 失敗 | Native発行・取得・解放の不明を分け、取得後の再観測又は保存がthrowしても元Lockを一回だけ解放する。再取得・自動再試行は行わない |
| 試験記録 | 検証Repository内の新品`.crdd/tests/executor-home-{provider}-{run-id}/`だけ。Provider、非秘密試験ID、段階、一致bool、七日後の再評価時刻を既存確定JSONで保存・読戻しする。Home Path・四Hash・SID・ACL・Credential本文は残さない |
| 清掃 | 資源終了を確認した場合だけRoot Identity・非link・許容File・nlinkを照合し、既存確定JSON削除と空Root削除・不存在確認。未知又は部分保存はexact Rootを報告して保持する。七日経過だけで消さない |

新ITは十八の有限条件と排他名Oracleを二Caseにまとめ、観測／排他を代役にして実Homeへ触れない。合成のunknown負例が残した自己生成Rootは、実資源がすべて代役であることを前提に、試験が内容・非link・自己IDを確認して回収する。これを実Homeのunknown回収と混同しない。正常importのobserver／Lock呼出し零、不正Provider／run-idのEffect前拒否も確認する。Catalog・Symbol・Architecture・検証設計へ追従し、新Host Framework、Registry、製品用State又は回復処理を追加しない。

この入口の成功は「観測一致と、その事前確認のLock解放・試験Root回収」を意味するだけで、ログイン成功・AI実行許可・試行中の共有Home保持・本番Runtime state保存・Recovery完了を意味しない。これらの実行接続は残件として維持する。実AI・Docker・実認証内容・過去保持物を操作していない。

静的検査を含むExecutor回帰は八件成功、単独非AI CLIも成功、Catalogは415項目validだった。限定独立レビューで候補受理時のNative Process発行確認と、発行済み・終了未確認の反例不足一件を検出した。両観測で発行済みを要求し、初回／保持中の終了未知と未発行候補を追加して再レビュー残指摘零とした。十八条件は二Case内の条件数であり、回帰八件とは別の母集団である。変更三文書・Executor Symbolの文書検査指摘は零、参照展開五十七文書の他CHG本文3,050指摘は不合格のまま保持する。この事前検証時点では実Home確認は未実行で、固定Provider一値・exact試験Rootに限定したNative metadata観測二回以下と既存共有排他取得・解放一回の操作承認を求めた。

承認後、2026-10-28 19:52 JSTにCodex一回の実Home事前確認を実施した。対象はcleanな`d93570650a15f81064cc064519a10b7d67d0926d`、実行は`node 40_Develop/executor/scripts/verify-provider-home.ts codex HOME-CODEX-20261028-01`。sandboxの`LOCALAPPDATA`が別領域を指していたため、その環境では起動せず、承認済み実行環境の当該子Process内だけ`C:\Users\nakas\AppData\Local`を明示した。OS設定・Home内容は変更していない。Exit 0、`status=observed`、`reason=null`、`observationMatched=true`、`resourceCleanupConfirmed=true`、`fixtureCleanupConfirmed=true`、`fixtureRoot=null`となった。実行後の別照会でも`C:\project\CRDD\.crdd\tests\executor-home-codex-HOME-CODEX-20261028-01`の不存在を確認した。認証状態の検査・AI送信・Docker操作はすべて未実施で、Claudeや過去保持物へ範囲を拡大していない。生metadata・四Hash・認証内容のログは保存せず、実行方法と非秘密結果だけを本段落へ記録する。この結果は事前観測・排他終了・試験物回収に限定し、試行全体の排他・本番保存・Recovery又は実AI成功の根拠にはしない。

#### 単段試験Hostの保存・排他接続 — 2026-10-28

続く非AI実装は`scripts/provider-attempt-host.ts`に限定した。既存の固定`createProviderExecutor`とDomain確定JSONを使用し、一回限りの元管理・準備・回復参照、五資源の提出前記録とReceipt、同期通知照合、元清掃結果・元終端の保存を接続する。任意Rootではなく同Repositoryの`.crdd/tests/`配下の新品領域だけを受け付ける。製品API・Coordinator・保存Schemaを変更せず、新しい製品Host・Registry・State・Lock・回復Frameworkは追加しない。

排他は既存の同期Named Pipe APIを呼出し側が取得して渡す構成とした。非同期解放では同期の`completeMount`に終了事実を渡せないという当初の見立ては、既存同期APIを確認して訂正した。開始・所在借用・記録前に元排他の`assertLive`を確認し、五資源の明示不存在記録後だけ`release`を一回呼ぶ。解放状態到達を同じ元回復・管理・操作参照へ結合し、`verifyHomeLeaseRelease`で確認する。既存同期APIの成功はWorker最終exit確認とは異なるため、外側の子Process終了確認と、解放不明時のRoot保持を別の条件とする。今回その実OS経路は実行していない。

独立子Processの新ITは下位DI／Leaseだけを代役化し、実Writerを使用する。正常・取消・清掃不明・排他喪失・解放拒否／例外・四種の書込み拒否・書込み確定後の読戻し拒否を十一条件、一Caseで検査した。回復IDは既存形式に従いHome結合を含むが、四Hashの個別field、Home Path、認証内容、生Provider出力は保存しない。各イベントに`recordedAt`を付ける。未知負例のRootは実資源がすべて代役であることを前提に、試験自身が自己生成Fileの内容・非link・nlinkを確認して回収する。初回試験で元計画が開始境界で正規化コピーされることと既存回復IDのHome結合順序への追従漏れを検出し、元Capability照合を保持して是正した。初回が残した空の今回Root一件も確認後に通常削除・不存在確認した。実AI・Docker・実Home・過去保持物へは接続しない。

限定独立レビューで回復開始の保存失敗時にexact参照を失う一件を検出した。書込み前拒否と確定後読戻し拒否の双方で同じ回復IDを返し、新Effectを開始せず、元生存Leaseだけ一回解放する経路へ是正した。記録Rootは保持し、保存再試行・強制清掃は追加しない。再レビューは残指摘零。静的検査を含むExecutor回帰は九件すべて成功、Catalogは416項目valid、変更三文書・Executor Symbolの指摘は零だった。参照展開五十七文書の他CHG本文3,050指摘による全体不合格は維持する。十一条件を十一の独立Caseや実OS検証へ水増ししない。

この補助は試験用Hostの接続であり、実試験入口全体の準備完了ではない。実AIへ進むには、固定合成入力・Model選定・初回同意、Home観測と同期排他取得、固定計画構築、試験用子Processの終了／取消とRoot保持・清掃を明示CLIへ接続する必要がある。元HostのOS喪失回復や本番耐久Stateを代替したとは表示しない。

#### 単段実試験CLIの非AI接続 — 2026-10-28

`scripts/verify-provider-real.ts`に固定計画表示と明示実行を分けた試験入口を追加した。合成Contextのみ、Codex `gpt-6.1-sol`／Claude `claude-opus-5-5`のmedium助言一回、Repository非mount・tools／session無効とする。TTY同意後だけ一子を起動し、固定計画・既存Home観測／同期排他・前段の試験Hostへ接続する。製品Host・State・Queue・Recovery機構は追加せず、本番Source・Schema・期限・安全判定は変更しない。

独立確認の三指摘に従い、Git確認を同意後へ移し、Coordinator依存拒否hookをプロジェクト依存のロード前へ置いた。親子で元回復参照をEffect前に受け渡し、結果喪失時も保持する。監督上限では取消後に既存猶予で子closeを待ち、未観測ならRootを一切更新しない。取消競合・未知結果は成功清掃へ進めず、close観測後だけ非秘密結果と七日後の再評価時刻を記録する。生Provider出力は保存しない。

再確認の二指摘も反映した。正常清掃には回復IPCとACK送信成功を必須とし、close後の保存記録からの参照回収を成功条件の代用にしない。開始前の固定理由だけを列挙して保持し、未知の例外本文は従来どおり汎用理由へ閉じる。Home不一致と解放拒否が重なっても一次理由を維持する。

ACK送信callbackと子の結果・closeの順序は保証されないため、相関済み結果は送信発行後に保持し、正常清掃にはcallback成功とcloseを共同要求する。callback欠測でも既存監督上限を解除せず、失敗時に保持する。新しいIPC通知や製品待機Gateは作らない。

追加五Caseは、純粋計画とEffect前拒否、子の十条件、親の十五条件、静的依存変異、実IPC子の不正計画／開始前取消を確認した。最終候補のExecutor全回帰は一実行十四件成功・失敗零・取消零、二十TypeScriptの整形・型・警告を失敗とするLintも成功。Catalogは417件validである。修正版の独立再確認は残指摘零で、この試験入口の非AI接続範囲を閉じる。対象三文書とExecutor Symbolの指摘は零、参照展開五十七文書の既存3,050指摘による全体不合格は維持する。Native・Lease・Host又はforkの代役範囲を明示し、実Provider・Home・Dockerの成立とは扱わない。今回、実AI・Docker照会／操作・実Home・認証情報・過去保持物を操作していない。実送信は固定入力・Model・Image・回数・新品Rootと回収の範囲を別途承認後に行う。

#### 単段Codex一回試験の停止と保持 — 2026-10-28

人間が固定合成入力・両Provider各一回・固定Image・今回資源のみの回収を承認した。`f5127a3487531169eeac288ef3b622950731c5b1`でEngine（Linux／29.8.1）と固定Provider二Image・Proxy Imageの存在を読取り確認し、稼働Container零の後、Codexだけを`EXEC-20261028-01`として一回開始した。端末内の通常同意後、結果は`blocked / docker_process_controller_cleanup_unconfirmed`、終了値二。Claudeは未実施、再送・Docker再起動・Image更新・過去保持物操作はしていない。

返却値は`childCloseConfirmed=false`、`childCloseObserved=false`、`cleanupConfirmed=false`、`releaseConfirmed=false`、`terminalSaved=false`、`nativeCleanupConfirmed=true`、`adviceConfirmed=false`だった。元回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.e0e9ff0d111436dc423da7a23537ed57fad656bd7a4d3e84537104dd67b1d7db.cda506a0f8e80edf52c6ac09c40cbe83921ccccb4c0559fde5ba424710c66ab7`。`C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261028-01`は保持し、再評価時刻は2026-11-04T13:45:10.136Zとする。親は子close未観測なのでRootへ結果を書かず、`retentionRecordConfirmed=false`を返した。端末の有限結果を本節へ記録し、生出力は保存しない。

今回Rootには`recovery_opened`、`recovery_handoff`、`submission_planned`（`create_subscription_auth_probe`）の確定JSON三件だけがあり、Receipt・不存在・排他解放・終端保存の記録はない。後続の読取りで試験ScriptのNodeは零件。Container候補`6d28583322a6ed96ea3cd2fdc94efe3eabaccd8b6fa65830e7726c25d7c16d91`（`crdd-auth-a11dcaf2206e91a5`）は13:31:36Z作成、固定Codex Image、未起動・PID零・Network none・再起動なし・Home読取り専用だった。専用Networkは一覧になく、既存停止Container等は不変更。現時点のProcess不存在を、返却時のclose観測成立へ書き換えない。

作成拒否ではなく、作成要求以後の応答受領・記録の未確定が残る。保存記録はランダムContainer名／実IDとの結合を欠き、時刻・構成の一致だけで今回所有を断定しない。この候補とRootは削除せず保持し、今回資源としてのexact対象判断又は既存記録からの追加相関が必要。一次故障の詳細、子close未観測の理由、実AI実行の成立は未確定で、試験全体は不合格のまま扱う。

#### 単段試験停止の非AI調査 — 2026-10-28

今回保持Root・Sourceだけを読み、実AI・Docker再要求／再起動・実Home再取得・保持物変更は行わず切り分けた。既存所有Process APIに120ms後に合成65byteを返す自己生成Nodeだけを接続すると、五msの初回待機は未観測、後の待機では終了零・65byte・close確認となった。要求先が完了していても最初の待機にReceiptが届くとは限らないことを再現したが、今回Dockerの応答遅延の原因や実待機時間を特定した結果ではない。予定保存13:31:25.682Z、実行config作成約13:31:28Z、Container作成13:31:36.452Zであり、予定保存からの約10.77秒をそのまま十秒のコマンド待機超過とは扱わない。

子終了未観測には独立した有力要因がある。既存Platform AccessのWorker組立は`stdout:true`／`stderr:true`をresumeし、同期排他側はWorkerをunrefする。実Pipeを作らない有限Worker比較で、800ms後に終了するWorkerをunrefしたNodeはdrainなし約98ms、同じ構成のdrainあり約914msで終了した。別比較でもdrain約918ms、後からpauseしても約923msで、pauseだけでは解消しなかった。試験Hostは清掃不明時に排他を保持し、試験子のfinallyも開始後は解放しないため、結果送信後も排他Workerのstdioが子の終了を妨げ得る。実試験中のactive handleを採取していないため、これを唯一の残留要因とは断定しない。

一次原因を確定できない理由もSourceで確認した。Executorは既存`reportProviderBoundaryDiagnostic`へ一次故障の段階・Handle取得・応答観測・Receipt・固定例外分類を通知するが、今回の試験Hostはこのcallbackを接続していなかった。さらに`recordTerminal`は清掃成立時だけ保存するため、今回の失敗では一次診断が残らない。`submission_planned`にも既存計画が持つ予定名／labelを保存せず、plan Hashだけからランダム資源名を復元できない。このため残存候補のexact所有相関も不足している。

最小是正候補は、試験Hostが既存の閉じた非秘密一次診断を受け取り、作成前の予定名・所有labelを同じ試験記録へ残すこと、及び失敗結果後の試験子終了と排他Workerのstdio所有を既存Platform Accessの範囲で整理することである。新しいState・Registry・Recovery、Timeout延長、名前だけの削除は提案しない。今回の一次故障がコマンド待機・応答搬送・Receipt保存のどれかはなお未確定。調査段階では製品Source・試験Source・保持Rootを変更していない。

#### 単段試験の最小是正と非AI確認 — 2026-10-28

着手前整合で、解放失敗後の診断保存は既存Owner条件に適合しないと確認した。Writerのguardを緩めず、境界終了通知の相関済み一次故障と固定boolをメモリへ保持し、既存結果IPCの閉じた`diagnostic`へ載せた。解放成功後だけ同じ投影を確定JSONへ保存し、拒否・不明後は書かない。診断保存失敗は既存の非介入通知契約に従い実行判定を変えない。予定記録には既存の資源名・所有labelを加え、清掃側も完全キーと文法を検査する。過去保持Rootは新形式へ書き換えない。

Platform Accessの無出力Lock Workerだけ、親側stdioをresumeからdestroyへ変更した。Worker・共有状態・message・error／exit・取得解放処理・期限は不変。有限Workerを実helperへ接続し、release通信／共有状態・通常終了、unref親終了、旧resume変異の終了拘束を確認する。既存の実Worker入力失敗によるerror／exit検査も維持する。これらを実Home・Dockerや今回保持物の回収成功へ換算しない。実AI再送・Docker・過去保持物は未操作である。

独立レビューの予定相関一指摘を是正し、試験Root清掃に五用途各一件、単一label、終了観測との予定名完全一致を要求した。両CLI代役の正常fixtureを五予定・Receipt・終了観測へ揃え、異label・重複purpose・別の合法Provider名・終了観測側だけの名差を拒否する。これはRoot清掃前の照合であり、Dockerの資源名生成や削除許可は変更しない。

最終候補の非AI回帰はExecutor一実行十四件、Platform Access一実行138件がすべて成功した。両Packageの整形・型・警告を失敗とするLint、Catalog417件の検査も成功。試験Hostの十三条件、CLI子の十条件、親の二十二条件は各Case内の反例であり、独立Case件数へ水増ししない。独立再レビューは残指摘零。更新四文書・両Package対象の文書指摘は零で、参照展開七十二文書の既存3,131指摘による全体不合格は残す。今回の是正は非AI限定完了であり、実auth createの一次故障確定、再送成功、保持Container／Root回収又は全体QA完了ではない。現在、この最小是正の範囲で新たな人間判断はない。再送・保持物処置は別の明示判断とする。

#### 修正版Codex単段一回の受領停止 — 2026-10-29

人間の追加承認に従い、固定`26953699203d902eb6696eb4585aa7f693042565`、同じ合成入力・Codex `gpt-6.1-sol` medium・固定Imageで`EXEC-20261028-02`を一回だけ実行した。Engine・二固定Image・稼働Container零を事前に確認し、新品Rootを使用した。通常の端末同意後、終了値二、`blocked / docker_process_controller_cleanup_unconfirmed`。Claude・再送・Docker再起動・Image更新・過去保持物操作はしていない。

今回は子の`closeConfirmed/closeObserved`がともにtrue、非秘密結果の保存確認もtrueだった。一次故障は`create_subscription_auth_probe`の`resource_receipt_record / docker_resource_receipt_unavailable`、Handle取得・応答観測はtrue、Receipt保存false。Docker応答は終了零・stdout65byte・stderr零で、Provider本体開始の観測false、助言結果なし。元回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.b330e6ca77e38a120132e4d371c7d90021b12a214d6240ec789432fc2e51c37e.1ac5f92f5f7643e8eb8b69abe4609fbf3a5df687f6feb38aa2653c0c6214272c`で保持する。Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261028-02`は書き換えず保持し、再評価時刻は2026-11-04T14:58:31.859Z。過去の試験結果を今回成功へ書き換えない。

Source照合で、DIは作成stdoutをそのままReceipt callbackへ渡し、本番Coordinatorは`rawDockerId.trim()`後に64hex検査する一方、新試験Hostは生文字列を直接64hex検査していた。実callback本文を使ったメモリ内の非AI反証で、64byteは受理・書込み一回、LF付き65byte及びCRLF付き66byteは拒否・書込み零となった。今回の65byte応答・受領段階拒否と一致し、試験Hostの改行正規化欠落を原因として特定する。生Docker応答を保存・表示しておらず、過去01試験の直接原因までは同一と断定しない。最小是正は既存本番の正規化へ試験Hostを揃え、正常fixtureを改行付き応答へ追従させることであり、DIや本番受付の安全判定・期限を変える必要はない。実装はこの結果記録時点で未実施。

今回の予定記録には`crdd-auth-635e3f731c491fd4`と所有labelがあり、実ID `3daf7e0772fb93b04b33c7c5a6892c8cd9d61ff2e378012903b71e0a3cebab6d`の現在構成・固定Image・作成時刻・未起動PID零・Network none・Home読取り専用・再起動なしとの一致を確認できた。試験Node零、同labelの専用Network零も確認した。回収前の初回照合はPowerShellの日時自動型変換で文字列比較が不一致となり、削除前に停止した。値と型を確認し、DateTimeの最小値を未起動として同じ全条件を再照合した後、承認済み今回資源だけを実ID・forceなしで削除した。実IDとexact名の双方の不存在を確認済み。Root・旧Container等は不変更。この物理回収を元の技術履歴のcleanup成功や排他解放確認へ遡及変換しない。

#### 試験Receiptの改行正規化 — 2026-10-29

人間の指示に従い、単段試験HostのReceipt callbackだけを、本番Coordinatorと同じ`typeof rawId === "string" ? rawId.trim() : ""`の後に既存64hex検査を行う形へ揃えた。新しい共通Parser・API・State・Recoveryは追加せず、DI・本番Coordinator・保存guard・Timeout・命名・回収許可は変更しない。

既存Host結合の通常応答をLF付きへ変更し、裸IDとCRLF付き正常応答、短いID・複数ID・途中改行・非16進文字・大文字・空値の拒否を追加した。保存Receiptは五用途とも正規化済み64桁、拒否時はReceipt保存零・認証Probe以降の未発行・同回復参照保持を照合する。既存十三条件と合わせて一Case内二十一条件であり、独立Case件数とは分ける。実AI・Docker照会／操作・実Home・保持Rootは操作していない。

独立確認のMinor一件に従い、不正Receipt六条件すべてで結果の回復IDと開始時の元IDを直接比較するassertを追加した。最終候補のExecutor全回帰は一実行十四件成功・不合格零・取消零、整形・型・警告を失敗とするLintも成功。再レビューは残指摘零。対象三文書・Executorの文書指摘は零で、参照展開五十七文書の既存3,050指摘による全体不合格は維持する。実AI成功・過去試験の解消・保持Root回収をこの非AI結果から主張せず、再送は別の明示承認後とする。

#### 改行是正後Codex単段一回の意味検査停止 — 2026-10-29

人間の明示承認後、固定`c39556a4f656b8d04a6251235c6ee81c11cdeab7`で同じ合成入力・Codex `gpt-6.1-sol` medium・固定Imageを使用し、`EXEC-20261029-01`を一回だけ実行した。Engine・固定Image・稼働Container零と新品Rootを確認し、端末内の通常同意を経た。結果は終了値二、`blocked / trial_terminal_or_advice_unconfirmed`。Claude・再送・Docker再起動・Image更新・過去保持物操作はしていない。

今回の五作成Receiptはすべて保存され、Provider開始観測true、一次技術故障null、技術清掃・資源不存在・排他解放・元終端保存・Native終了・子closeはすべて確認済みだった。元の技術終端は`completed / provider_operation_completed`。結果本文は保存せず、705byteとSHA-256 `cf016bd4d5e77ed27a4e09d58b91327cc2742f6e36a065a23dbd05b91d18321f`だけを保持する。助言内容確認はfalseであり、読取り助言試験全体のPassとは扱わない。

回復参照`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.8750919c28c18965845772766aa84ac1c3ad604059867b12d76739452db83437.35ef9374e96c1a2894d77dd9a933ef043708ad956cd16301caca49f1eaeeb0e9`、Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261029-01`、再評価時刻2026-11-04T15:42:51.953Zを同じ有限結果へ保持する。今回Rootには予定・Receipt各五、Provider提出、五資源不存在、Home解放・Mount終了・回復終了・境界終了・元終端の計二十確定イベントがあり、親の結果保存も確認済み。試験Rootは不合格時の既存保持条件に従い変更・削除しない。資源清掃確認とRoot保持を分ける。

非AIのSource照合では、Executorは`adviceJson`を持つ正規化済みEnvelopeを返し、試験CLIも同じfieldを参照するため、外側の受渡し形式の不一致は確認されなかった。技術completedの経路は同Envelope生成を通る一方、試験CLIが`normalizeAdviceResult`の不合格理由を捨てて共通理由へまとめるため、Schema・Identity・項目／許可参照等の詳細な内容拒否を今回の保存結果から特定できない。生出力を復元・再送して推測しない。最小是正候補は既存Normalizerの閉じた理由コードを既存reasonへ接続することであり、新しいログ機構や生出力保存を必要としない。この結果記録時点ではSourceを変更していない。

#### 助言試験の正式契約提示と意味検査接続 — 2026-10-29

人間の「非AI照合後、次のCodex実試験まで一気に進める」指示に従い、合成指示と結果契約を照合した。Codex助言計画は`--output-schema`を使わないPrompt方式だが、従来の単段試験Promptは正式なcontract値・Revision・必須fieldを示していなかった。既存`describeAdviceResultSchema()`をJSON化してexact許可参照集合とともにPromptへ追加した。合成Context・Model・effort・Image・回数・読取り境界は不変で、Repository本文・Credential・過去出力は追加しない。変更後Promptの全文とHashは送信前の通常表示へ接続する。過去の生出力は保持していないため、この不足を前回の唯一の拒否原因とは断定しない。

内容検査だけの不合格は既存Normalizerの固定理由を既存reasonへ接続する。ただし実行失敗と元終端保存失敗を優先し、Envelope欠測は従来の共通未確認理由に留める。新しい状態・診断Framework・保存field・公開API・Timeoutは追加しない。

新しい一CaseはPlatform Home観測・NamedPipe Lease・Docker Isolation Runtimeの物理処置と清掃／資源観測を有限代役化し、Command stdoutへ合成Envelopeを与える。試験Host・Executor・AI Adapter Parser・内容Normalizerは実体へ接続する。両Provider正常、Schema extra／missing、Contract／Revision／status、空全区分・不正項目・投影外参照・Transport不成立とCodex重複Keyの計二十一条件を区別した。生Envelopeや助言本文は記録せず、元回復参照・五Receipt・終了・清掃を確認して今回の合成Rootだけを回収する。既存の全Host代役Caseにも内容理由・実行理由・終端保存理由の優先順位を追加した。回帰・独立確認後、承認済み新品Codex一回へ進み、失敗時は再試行しない。

最終SourceのExecutor全回帰は一実行十五件成功・失敗零・取消零、整形・型・警告を失敗とするLintも成功した。独立レビューの代役境界表現Minor一件をTest Header・Quality・本節で是正し、再レビューは残指摘零。対象三文書・Executorの文書指摘は零、参照展開五十七文書の既存3,050指摘は別範囲として残す。変更後合成Promptは2,188byte、SHA-256 `d2bd19238cf922b19daa1b9149db188f55dbaf8869369d915e1fd01670af46f5`。この非AI確認から実AI成功を主張せず、次に固定Sourceで承認済みCodex一回だけを実行する。

#### 正式契約提示後のCodex単段成功とClaude事前確認 — 2026-10-29

固定Source `bcb17d141186b1a5d2a7ce336fea329d066f3a24`で、承認済みCodex単段試験 `EXEC-20261029-02`を一回実行した。Engine・二つの固定Image・稼働Container零・新品Rootを事前確認し、端末の通常同意後に送信した。Modelは`gpt-6.1-sol`／medium、合成Promptは上段の2,188byte・同一Hashである。結果は`completed`、reason null、`TRIAL_EXIT=0`だった。

助言内容検査・元終端保存・技術清掃・排他解放・Native終了・子closeがすべてtrue、一次故障null、Provider開始・Process tree終了・Container／Network不存在の各観測もtrueだった。結果本文は保存せず、755byteとSHA-256 `3c34de1949cb8c891b5e327b340ab30a18537fb447fc69e1cbdd79571374c297`だけを記録する。exact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.497a85c62b98a72875e8d25cd4fc6988f6efaa7de49618c6feea20ad7d1f2163.d14e739aac921a38fd0bd3f677eda256728ccf581c0b3bb662103b4e390002eb`である。

試験結果のfixtureCleanupConfirmedはtrue、fixtureRoot／reviewAfterはnullだった。終了後の読取り確認でも今回Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261029-02`は不存在、試験CLIのNode Processは零だった。過去保持物は操作していない。この合格はCodex単段読取り助言の範囲に限定し、Claude・Direct／Isolated編集E2E・全体QAの合格へ拡張しない。

続くClaude事前確認は、記録更新と既存Source／試験の照合として実施する。新しい契約・状態・権限・判定・実装は追加しない。純粋な計画表示で`claude-opus-5-5`／medium、同じ合成Prompt・正式Schema・exact許可参照、固定Provider Image `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f`と固定Proxyを確認した。既存の両Provider二十一条件は、実Parser・Normalizerと試験Hostを接続し、物理Home・Lease・Dockerは有限代役である。したがって実認証・Image存在・実通信の成立までは証明しない。今回はClaude送信・Docker照会／操作・過去保持物操作を行わず、実試験は送信範囲の承認後に一回だけとする。

Claude事前照合後のExecutor通常入口は整形・型・警告を失敗とするLintを通過し、全十五件成功・失敗零・取消零・skip零だった。ClaudeはCLIの`--json-schema`にも同じSchemaを渡し、共通Promptと別契約を作らない。両Providerの結果は共通Normalizerへ接続し、終端保存・実行失敗の優先順位と正常時限定のRoot回収条件を維持する。今回の更新は既存実測と照合結果の記録だけであり、新しい設計判断やSource変更を含まない。Codex合格の撤回・過去失敗の上書きはせず、Claude実送信の承認待ちとする。

#### Claude単段の実行成功と試験清掃拒否 — 2026-10-29

人間の承認後、同じSourceと合成Promptで`EXEC-20261029-03`を一回実行した。Claude `claude-opus-5-5`／medium、固定Imageは上段の値で、Engine・Image存在・稼働Container零・新品Rootを確認し、端末内同意を経た。内側結果はcompleted、reason null、助言内容・元終端保存・技術清掃・排他解放・Native終了・子closeはすべて確認済み。一次故障null、Provider開始・Process tree終了・Container／Network不存在の観測もtrue。結果本文は保存せず、2,492byteとSHA-256 `effedd9974e5c94d10548193c431ef11b2a8851ef6a1db1eb5ed4bd92af54550`を記録する。

外側は`blocked / trial_completion_unconfirmed`、`TRIAL_EXIT=2`だった。親の確定結果ではprotocolFailure／unexpectedStdoutともfalse。今回Rootの二十確定イベントは終了まで揃っているが、`tmp/claude-65534/`という空の通常Directoryが残り、試験清掃の「tmp直下が空」という条件に一致しない。Nodeのlstat／readdirでも非Symlink・子零、managementは空、試験Node Process零を読取り確認した。これは助言又はDocker技術清掃の失敗ではなく、試験Rootの清掃条件と実残存の不一致である。正常清掃条件を緩和・再実行せず、Rootは保持した。

exact回復参照`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.4a0badc3d71d52243f4770cac7b36316445905834c8be7aad05afca1af838088.4672f65b39be3cf868ebf177fc6c68e2a86ccbcf34cf53b6654b40e56dbc3953`、Root `C:\project\CRDD\.crdd\tests\executor-real-claude-EXEC-20261029-03`、再評価時刻2026-11-04T16:55:09.177Zを同じ結果で保持する。再送・Docker再起動・Image更新・過去保持物操作なし。次の最小是正候補は、試験Toolだけで今回Root内の既知の空Directoryを非Link・Identity・範囲確認後に回収可能にすることであり、任意の再帰削除や製品Recovery追加は行わない。実試験全体は清掃未完のため合格へ変更しない。

#### Claude試験Toolの既知空Directory回収是正 — 2026-10-29

人間の継続指示に従い、製品Sourceではなく試験Toolの正常終了後清掃だけを是正した。Claude・固定名`tmp/claude-65534/`・単一子・空・非linkを条件とし、Root・tmp・management・対象子のIdentityを捕捉して削除直前に再照合する。通常rmdirのみで、未知名・File・非空・Codex同名・観測不能・Identity差は保持する。Scope／名前／内容の一般化、再帰削除、製品Recovery、追加Lockはない。

独立レビューで中間tmpの再照合不足を一件検出し、祖先のIdentity保存と削除直前照合を追加した。既存のIPC／終端条件に加え、既知空子成功・Codex非該当・未知名・File・非空・子link／Identity差・親link／Identity差の九条件を同じ親CLI試験へ接続した。Link／Identity差はmetadataの有限代役で、実OS競合耐性の証明ではない。拒否時の子rmdir零と既存確定イベントbytes不変を確認する。最終Executor通常入口は整形・型・警告を失敗とするLint、全十五件成功・失敗零・取消零・skip零。独立再レビューは残指摘零、diff checkも成功した。

初回Formatterの書込みはWindows mapped-file拒否1224で実施できず、指摘された改行一箇所をpatchで整形して最終確認は成功した。修正前のClaude実試験の終了値二は変更せず、今回の実Rootと過去保持Rootは操作していない。AI再送・Docker照会／再起動・Image更新も行っていない。Source是正と非AI清掃試験の成立であり、保持済み実Rootの清掃完了や編集E2Eの合格とは区別する。

#### 今回Claude保持Rootの承認済み回収と編集E2E残件 — 2026-10-29

人間が`EXEC-20261029-03`のRoot確認後回収を明示承認した。試験Node零、元記録にある五資源のID／予定名が現Docker一覧にないことを読取り確認した。Rootと祖先の実体・非link、exact回復参照、元結果の全成功条件、二十確定イベントのHash／Provider／sequence、許可されたFile集合・非link／単一link、空management、tmp直下の既知空子一件を再照合した。保持結果の元Hashは`3b99eeb08c01266e9a9f4bdfd0e59b64ae0d82010d9134e5f96640fae318bedd`。CHGに元結果を保持し、outcomeの確定Pairを既存削除APIで回収した後、修正済みの限定清掃関数で今回Rootを回収した。fixtureCleanupConfirmedとRoot不存在はtrue。短命清掃Scriptも撤去・不存在確認済みである。

短命Script初回はimport相対Pathの誤りで評価前に停止し、対象変更なしだった。参照先だけ修正した後に上記回収を一回実施した。元の実試験終了値二は書き換えず、「Claude単段の実行・内容確認成功、試験Toolの清掃拒否、後日の承認済み清掃完了」として区別する。AI再送・Docker再起動・Image更新・他の保持Root操作はない。

次のDirect／Isolated編集E2Eの残件は次のとおり。今回は棚卸しだけで実行・Source変更はしていない。

| 残件 | 必要な確認と処置 |
|---|---|
| 新品の試験入口 | 現`verify-workspace-ai.ts`は`workspace-ai-20261026/{preflight,edit}`を固定参照し、両Directoryが既に存在する。既存物を削除・再利用せず、新品の有限試験識別子とRootへ入口を最小追従する必要がある |
| 非AI本番結合 | 最新保存・Executor接続で、公開HTTP受付→状態観測→終了とDirect／IsolatedのGit操作・既存dirty／stage保全・回収を事前確認する。AI受付／観測十五秒、Workspace操作六十秒は維持し、実行OwnerをHTTP子へ移さない |
| 送信範囲の確定 | 合成Context・source.txt・固定指示・差分だけ、Codex `gpt-6.1-sol` medium編集→Claude `claude-opus-5-5` mediumレビュー、必要なら既存限定是正一回と再レビュー。二方式各一Task、上限八AI起動を候補とし、新品Root・固定Commit／Image・失敗停止／回収範囲を実行前に再提示して承認を得る |
| 実AI編集の成立 | Directは現在Tree編集・既存dirty／stage保全・自動Commitなし。Isolatedは独立Worktree編集後、試験内の明示選択だけ固定し、二親MergeとBranch／Worktree回収を確認する。読取り単段の成功から推定しない |
| 終了・記録 | 不明な失敗は再試行せず同じ参照で保持。今回資源の終了・不存在・Root回収と固定結果を確認し、過去失敗や全体QAと区別する |

#### 新品試験領域と非AI編集事前確認 — 2026-10-29

人間の1・2実施指示に従い、検証Toolの固定日付Rootを、確認済みRepository-local tests内の標準`mkdtempSync("workspace-ai-")`へ置換した。CLI引数・送信条件・製品Source・HTTP期限・既存清掃Gateは変更せず、設定・Registry・互換処理を追加しない。Docker一覧確認後だけ新品Rootを作り、exact Pathを既存結果へ載せる。独立レビューで作成後失敗時のPath欠落を検出し、Root検査・子Directory作成を捕捉して未確認Rootへの書込み・削除なしでexact Pathを返すよう是正した。正常・作成前拒否・realpath差・Root link・mkdir拒否を同じVMで反証し、再レビューは残指摘零だった。

今回の非AI事前確認は新品`C:\project\CRDD\.crdd\tests\workspace-ai-vlNwOC`で一回実行し、終了値零。Direct／IsolatedともlimitedProbePassed・closeConfirmed・runtimeClean・workspaceClean true、既存変更保全・成果Byte検証を確認した。Isolatedは候補固定・二親Merge・候補終了・WorktreeとBranch回収まで確認した。Docker比較はverified／observed_inventory_unchangedで追加・削除Container／Network零、Source不変、両fixture回収Gate eligible、fixtureRootsRemoved true、清掃失敗零だった。AI Client開始・外部AI送信は行っていない。

合成Gitの詳細は一時成果物として回収し、IsolatedのBase `3bc95bfaec486b1b4ada53d8d5f2dc65b3971b17`、Candidate `f4063de4ddabfbb23564e08626b5d9165ef63941`、Merge `c5e88e158638e89ad0170a7603fc6e7a4ddee044`と二親関係の確認結果だけを残す。引渡しJSONのSHA-256は`40aafd71cadd38d01940b87b637567893f29db8352c63ed35887fe9994678db7`。試験本体が合成fixtureを回収した後、残るresult.json一件だけ・非Reparse・結果全成功を再確認し、Fileと空親Directory二階層を非再帰削除して今回Root不存在を確認した。旧固定日付Root・他の過去保持物には触れていない。

静的確認はWorkbenchの整形・型・警告を失敗とするLintとclient Buildが成功（既存情報診断五件）。制限環境の対象三十件はHTTP応答前の二件不合格、通常環境の先行実行は三十件成功だった。最終候補の途中再確認にはHTTP時刻順序Oracle一件の不合格があり、個別でも再現した。判定を変えず数値だけの診断を追加した後の個別一件は成功したが、失敗時の値は旧Assertionに含まれず、原因解消とは断定しない。最終候補の固定回帰は別記し、過去runの不合格を上書きしない。

最終候補の対象二Suiteは、一実行三十件成功・失敗零・取消零・skip零（約九十秒）で終了した。先行runや個別成功との合算ではない。最後の文書・診断差分も独立レビュー残指摘零。diff checkは成功し、今回の非AI事前確認と新品Root対応を完了した。途中の時刻順序不合格の原因未確定は維持し、全体QA又は実AI成功へ拡張しない。

次は、この非AI成立を実AI編集の合格へ読み替えず、新品試験Root・固定Source／Image・合成送信本文・Codex編集／Claudeレビュー・上限回数・失敗時停止／回収範囲を改めて提示して承認を得る。今回の許可では実AIを開始しない。

#### 新品領域の実AI編集一回と取消後状態 — 2026-10-29

人間の明示承認後、固定`fb1afd64b82f3b5d214def0b135c3b489b25fb2a`、承認した三固定Image、稼働Container零を確認し、新品`C:\project\CRDD\.crdd\tests\workspace-ai-xMmxk7`で実AI編集試験を一回開始した。端末の通常同意後、Directの`request-f96c874e-56f6-4c35-bfb1-843165aca50f`を受け付けたが、状態取得がheaders_unobserved／timedOut trueの十五秒期限で失敗し、同じTaskへ取消を発行した。結果はE2E_EXIT=2、Isolated未開始、Task全体の再試行なし。

元Taskはcancelled／single_task_cancelled_after_effect_cleanup、cleanupConfirmed true、回復参照・副次失敗は空、closeConfirmed true。Codex executor attempt0の記録はturnCompleted true、itemErrorCount=1／itemErrorCodeModeCount=1、commandExecutionStartedCount=0、fileChangeStartedCount=0、報告・実変更Path各零だった。source.txtはBASEのまま。Codexの作成・開始・完了・exit零・Process tree終了・Container／Network不存在・cleanupを観測した。Claude reviewerはProvider作成／開始／完了未観測で、取消後の終了と清掃だけが成立した。Codex編集起動一回、Claudeレビュー起動零であり、モデル内部のAPI呼出数をこの記録から算出しない。

一次停止はHTTP状態取得Timeoutであり、Code Mode関連のProvider項目エラーも別に観測した。両者の因果関係、遅延区間、Code Modeエラーの具体的原因は未確定。生出力を保存しておらず、推測で補完しない。正常な助言単段の成功から編集機能の成立を推定しない。

境界相関は操作`OP-9230062799888042500767993141431403042`、回復相関`operation-33b8ea28-5b91-45de-ab5a-a038ba761af0`。Codexのexact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.a0b08dd570cd0e1afd69985b65c0e2556195f1f0ced00ee969ee4208a1e26b6f.b6ca74e6bd572c5a63c6ec2a588fdf4ff80c3b22f30ffbff6cbda26632384efc`、Claudeは`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.549e64008edb3433f0ab9d33544ca27577a931b4e7c484f8ba70c113d4d00276.8f41d486af9840bb06e730c182f972910306b6514254cd6fc44f2fe63d51c037`である。元引渡しJSONのSHA-256は`0f2171317e1fe9e52c9b33f5884e81200e302e7cb9d90dc12e5668dbd4520e55`。

試験Toolの通常清掃は両方式成功専用のため今回は対象外となり、fixture_root_or_removal_unconfirmedを返した。そのguardは変更しない。後続読取りで試験Node零、状態上のoperations／unresolvedRecoveries／pendingDeliveries／leaseIntents／workspaces各零、同Taskのcancelled／settled・cleanup true・回復参照空、project-operationのacquired→releasedを確認した。終了要約待ちはcancelled／cleanup confirmedの一件で、未解決実行義務とは区別する。Dirty／Stage／未追跡の合成確認物は元のまま、Git Worktreeは今回direct一件だけ、Source不変。現Docker一覧のCRDD Containerは過去保持の一件だけで、今回資源は残っていない。標準Network Identity変更は別診断であり、標準Networkの削除・再構築は行わない。

今回Rootの物理清掃は人間の今回資源回収承認内で実施した。exact解決Path、祖先と全内容の非Reparse、今回Rootがeditだけ・editがdirectとresult.jsonだけ、元結果Hash、未解決状態零、同Taskの取消確定、合成四Fileの元内容、Git Worktreeが今回direct一件だけであることを照合して、今回Rootだけを通常削除し不存在を再確認した。親Path補助照会の`Split-Path -LiteralPath -Parent`にはPowerShell引数不適合が出た。exact解決Pathと祖先・内容の検査は別に成立しており、終了後は`Path.GetDirectoryName`でも意図した親を照合した。ACL修復・属性の再構成は行っていない。実AI再送・Docker再起動・Image更新・過去保持物操作もない。元の失敗結果を成功へ変更せず、実AI編集E2Eは未成立である。

#### HTTP観測期限とCode Modeエラーの非AI切り分け — 2026-10-29

人間の調査指示に従い、Sourceと既存の有限診断を照合した。製品Source・判定・期限は変更せず、AI再送・Docker照会／作成／再起動・過去保持物操作は行っていない。外部参照には公開Codexの版固定Sourceだけを用い、内部試験内容・Path・結果は送っていない。

| 対象 | 確認した事実 | 原因の確定限界と最小案 |
|---|---|---|
| HTTP状態取得 | 検証ClientのobserveはTask専用照会でなく`readMain`の画面全体GETを使う。Ownerは同一OwnerのMapにあるSnapshotを現在認可後に返し、Task完了Promiseをawaitしない。後段にはTopic／Meeting等の同期読取りがある。編集Toolは既存の三境界時計を接続せず、失敗結果からServer受信前／Owner内／画面生成後段を分離できない | 十五秒そのものの原因は未確定。既存`createReadonlyVerificationTiming`を、読取りTool同様にClient callback・Server bind・Owner observe wrapper・stage設定・dispose／snapshotまで一組で編集Toolへ接続する。新ログ基盤、Worker、Queueや期限延長は不要 |
| Code Mode | `itemErrorCodeModeCount`はerror項目のmessageに対する正規表現件数。Host起動・handshake・実行物なしの合成三入力が、すべてparser confirmed／Code Mode一件／command零へ同じく投影された。Task計画はHost有効・in-process fallback禁止・Code Mode only。DockerfileにはCLIと同じ版・隣接位置のHostがある | 実Hostの具体故障は旧記録から復元不能。Host不足・起動失敗・初期通信失敗を断定しない。まず本番同等の固定Image／uid／mount／seccompで非AIのsession開始→固定計算→応答→終了を確認する経路を特定する。現試験のHost `--help`とCodex sandboxはこの代用ではない。推測したprotocol harness、Host無効化やfallback許可を追加しない |

HTTPの既存実保存結合一Caseへ、メモリ内CPUサンプリングとevent loop遅延計測を一時適用した。一件成功、約81.1秒、計測付きの最大event loop遅延12,440ms。CRDD Source内の自己sampleはPlatform Accessの同期`waitForState`約5,209ms、Version Controlの`readStableFileBytes`約694ms、`parseNarrowRepositoryConfig`約442msなどだった。サンプルは計測付き全試験の累積であり、単一HTTP要求の占有時間や実AI失敗時の内訳ではない。同期`Atomics.wait`とRepository実体再確認がHTTP処理を止め得ることはSourceと整合するが、今回十五秒Timeoutの再現・唯一原因の証明とはしない。Profile本文・生出力・プロンプトはFileへ保存せず、短命計測Scriptと試験helperの合成Rootは終了後不存在を確認した。

固定版の公式Sourceでは、[InstallContext](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/install-context/src/lib.rs)が同梱資源又はCLI隣接のHostを解決し、[remote_session](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode/src/remote_session.rs)は存在検査とsession生成を分ける。[connection](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode/src/remote_session/connection.rs)もspawnとhandshakeを別に扱う。したがってImage内の配置・`--help`・助言成功だけでは、編集時のHost session成立を証明できない。これらは一般的意味の参照であり、今回の実故障を直接観測した根拠ではない。

読取り専用の独立確認では、二つを独立事実として扱う方針が妥当であることを確認した。HTTP時計は三境界を一組で接続すること、Code Mode分類を後で加える場合も生message非公開・未知分類・件数相関・現行exact診断Schemaの影響を維持すること、固定Imageの実証には実行条件の提示と別の許可が必要であることを確認した。今回の調査では実装を開始しない。次はまず既存時計の接続と非AIの段階保存／並行HTTP反例を具体化し、Hostの非AI実証経路が成立しなければ不明のまま人間へ戻す。

#### 編集Toolへの既存HTTP時計接続と非AI結果 — 2026-10-29

人間の指示に従い、`verify-workspace-ai.ts`へ読取りToolと同じ`createReadonlyVerificationTiming`を接続した。Server生成前に時計を作り、Owner.observe wrapper、loopback Server bind、初回GET／Client callback、start／observe／cancel／close段階、Client終了後のdisposeとOwner終了後snapshotを一組で用いる。投影は既存evidenceのhttpTimingへ追加し、上限512件・本文／Token非保存・元Task結果不変を維持する。製品Source・HTTP API・十五秒／六十秒期限・Authority・保存guardは変更していない。

既存取消十一条件にcallback・段階・購読解除の確認を追従した。既存の実保存HTTP Caseには同じ時計を接続し、正常完了保存と同IDの状態取得をPromise.allで並行要求する。実Owner・実Writer・公開HTTP・HTTP子Processは通すが、executeと認可callbackは合成で、AI／Dockerは使わない。Promise.allから厳密な時間重複又は実AI失敗の再現を推定しない。

最初の対象二Suiteは三十件成功だった。完了保存に並行した状態GETは、要求開始→Server受信3,302ms、Server受信→finish233ms、対応Owner.observe0ms、要求開始→headers3,539ms、本文→親close32ms。Owner観測十二件の最大も計測上0msで、欠測計上零・購読解除済みだった。この合成条件では主要な待ちをServer受信前へ分離できたが、socket／OS配送とmain event loop停止の内訳はこの時計だけでは区別しない。先行の同期保存・Lock待ちのSource／計測と整合する一方、実AI時十五秒の唯一原因とは確定しない。Ownerは合成認可callbackであり、実試験の設定再観測費用まで零と主張しない。

独立レビューのMinor一件は、試験の応答喪失用startを直前のcancel段階で記録していた点だった。手動POST前をstart・受付後GET前をobserveへ合わせ、存在確認Oracleを追加した。元の切断・同ID継続・取消・保存・回収条件は変更しない。FormatterのWindows mapped-file拒否1224は、指示された整形をpatchで反映して最終Formatで確認した。新しいPromise変数に明示型を付け、整形・型・警告を失敗とするLintは成功（既存情報診断五件）。最終対象回帰と再レビューは以下で確定する。

最終候補の対象二Suiteは一実行三十件成功・失敗零・取消零・skip零（約65.8秒）で終了した。段階追従後の並行GETはClient→Server4,045ms、Server465ms、対応Owner0ms、headers到達4,507ms。複数回の値を一runへ合算しない。限定独立再レビューは残指摘零。試験helperの清掃条件と元結果を維持し、今回の時計接続を完了したが、実AI時十五秒の根本原因又は全体QAの合格を宣言しない。

#### Code Mode非AI実証の承認候補 — 2026-10-29

今回は条件整理だけで、実Containerを作らない。固定Codex Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`に同梱された0.164.0のHostを使う。公式版固定の[message](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode-protocol/src/host/message.rs)と[codec](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode-protocol/src/host/codec.rs)に沿う一時的・用途固定のClientで、初期通信→session/open→固定計算→結果→session/shutdown→子終了を確認する案とする。仕様を推測せず、実装前に必要fieldと版の整合を確認する。恒久API・Package・汎用Client・独自Protocolは新設しない。Host単独の成功を本番CLI経路の成功へ拡張しない。

承認が必要な実Effectは、稼働確認後の自己生成Container最大一件と、Repository内新品`.crdd/tests/code-mode-non-ai-*`だけ。network=none、認証情報・Repository本文・Provider設定を渡さず、空の合成Work／Home／tmpと本番同等の非root UID・read-only root・cap-drop・no-new-privileges・seccompを使う。外部AI呼出し・Image取得／更新・再起動／修復はしない。固定計算だけで外部Tool callbackを要求した場合は拒否して停止する。開始・初期通信・計算・終了の固定段階と終了値のみを残し、生stderr・本文を恒久保存しない。失敗時は自動再試行せず、同じ実IDの今回資源だけを確認して回収する。Engine停止／Image欠測／別のDocker作業中はEffect前停止。既存Container・Image・Volume・過去保持物は操作しない。提示時点では未承認であり、その後の人間承認に基づく一回結果を次項に記録する。

#### Code Mode非AI実証の一回結果 — 2026-10-29

人間が上記範囲を承認後、Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`を基準に、一時的な用途固定Clientだけを作成した。公式0.164.0の四メッセージと4-byte little-endian frameを使用し、固定計算`text(String(1 + 1));`、有効Tool零、全応答上限16 frame／一frame 65,536 byte／応答期限30秒とした。局所self-testは正常四メッセージと負例十件が成功。独立レビューで後続stdout受理・欠測cell ID受理を実行前に是正し、再確認の残指摘は零だった。`cell/closed`は任意通知として、ID確定後の同session／同cell一回だけを受理し、必須の終了証拠とは混同しない。

| 確認対象 | 一回の実測結果 |
| --- | --- |
| 実行境界 | 既存固定Image、network none、UID 65534:65534、read-only root、cap-drop ALL、no-new-privileges、既存seccomp、pids-limit 64。四Mount以外のRepository／認証情報は渡さない |
| Host同一性 | 同梱`codex-code-mode-host`のSHA-256 `8ee4f472e92ac226a189e98998633b2d07f989f208515750764db660369f2926`が一致 |
| 非AI動作 | handshake、session/open、固定計算結果`2`、session/shutdownの全応答を確認。外部Tool要求零、stderr零 |
| 終了 | stdin close、Host exit 0、stdout EOF、stderr読取り終了、Container exited／ExitCode 0。OOMKilled false、Restarting false、RestartCount 0 |
| 実環境の補助観測 | CPU 24、開始前pids 1、上限64。上限枯渇の再現なし |

実Container IDは`ae2a90a03b890be48c9bfe1decc096ea02ace6f0ca7de3c2c367140cd09cb3c4`、作成・起動は各一回。開始／終了は2026-10-29T02:38:23.493751387Z／02:38:23.956127038Z。元ID・Image・Config・MountとHostConfigを再照合し、未指定`OomKillDisable`だけ作成時false／終了後nullという表現差を検出した。指定した安全設定ではなく、他項目はexact一致、OOM／再起動も否定できたため、独立確認後この一field・一Containerだけを限定判断して通常rmした。boolean差を一般許容する比較器や回復処理は追加していない。元IDの一覧取得成功・該当零によりContainer不存在を確認した。

新品Rootは`C:\project\CRDD\.crdd\tests\code-mode-non-ai-20261029-01`、Identity `1687905628:35465847067816461:1793241181982825500`。Client SHA-256は`6b1c9d744e0c68face1344c2e366a65b14f803469e70ddc85f28215805b700ac`。回収前に祖先・全子の十二Identityと非リンク、全六entryのallowlist、Client Hash、元ID領収書を再照合し、work／home／tmpは空だった。確認した二fileと空の四子Directory・Rootだけを通常の非再帰削除で回収し、Root不存在を確認した。強制属性解除・ACL修復は行わず、今回の試験物の残存はない。生出力を保存せず、本番Source・期限・安全判定は変更していない。

この成功は固定Image／当該隔離条件下の公式Host単独動作を示す。過去のCode Mode項目エラーの原因や、Codex CLIからのHost接続、実AI編集E2Eの成立を証明しない。AI再送・Docker再起動・Image更新・過去保持物操作は行っていない。

#### Codex CLIとHost単独試験の条件差 — 2026-10-29

今回の許可は外部AIなしの調査と最小案の整理である。現行Sourceの読取りと正式な計画APIの純粋呼出しだけで照合し、新しいContainer・CLI Process・認証操作は発行しない。本番Source・設定・安全判定・Timeoutも変更しない。

| 境界 | Host単独試験 | 本番の編集計画 | 今回の判定 |
| --- | --- | --- | --- |
| 実体と外側隔離 | 固定Task Image、公式Host、UID 65534、既存seccomp、pids64、空Work・bind tmp | 同じTask Image／UID／seccomp／pids64、bind Work・tmp | 基本配置・計算・終了は成立。CLIを含むProcess数・並行条件の成立までは未確認 |
| Host起動・接続 | PythonからHost絶対Pathを直接spawn、固定hello/open/execute | Codex `exec`が設定を解釈してHostを解決・起動・通信 | CLIによるPath解決、起動、handshake、routingは未検証。直接試験の成功で置換しない |
| Homeと環境 | 空Homeをread-only、Host環境はHOME／TMPDIR／PATHのみ | Host側で準備したHomeをread-write、CLIへCODEX_HOME、Proxy環境を渡す | Home／環境の差はあるが、原因と確認されていない。秘密値は読まず再現入力へ渡さない |
| 計算とTool | 固定計算、enabled_tools空、delegate要求は拒否 | shell_tool／unified_exec有効。CLIが編集用Toolを提供 | delegate処理、コマンド隔離、実ファイル編集を単独試験は通らない。故障の優先原因と断定しない |
| 内側の権限 | Codex CLIの権限profileを経由しない | root deny、minimal read、Workspace write、Codex実行Fileだけ追加read、コマンド通信禁止 | 隣接Host／bwrapを使う段階と権限評価の関係は未確認。追加allowが必要とはまだ判断しない |
| Provider結果 | protocolと計算値・終了を直接検査 | output-schemaとJSONLへ投影 | 既存itemErrorCodeModeCountはerror本文の語句一致件数で、Host開始・handshake・delegateの段階を特定しない |

`ai-adapter/src/codex/plan.ts`の編集計画は、GPT-6.1 Solにcode_mode／code_mode_host／code_mode_onlyを指定し、in-process fallbackを禁止する。助言計画もHostを使用するがshell_tool／unified_execを無効化し、read-only sandboxを使う。このSource差を実編集故障の反証とは扱わない。現行の[公式設定文書](https://learn.chatgpt.com/docs/config-file/config-reference)にもCode Mode・権限profileはあるが、稼働中の固定0.164.0と同版の契約を示すものではないため、現行文書のkeyへ機械追従しない。

結論は具体原因未確定である。Host実体の基本不成立やHost単独でのpids64枯渇を支持する結果はなく、残る候補はCLIの設定解釈／Host解決・起動・通信、Home／環境、Tool委譲／内側sandboxである。過去の生出力は保存しておらず、旧件数から失敗段階を復元できない。独立確認で「Tool委譲を優先原因」とする推定を取り下げ、同列の未確定候補へ整理した。

最小案は製品変更なしで、次の二境界を分ける。第一に固定CLIの既存sandbox入口と同じ権限profileで、合成Workへの固定command一件を非AI実証する。これで確認できるのはコマンド隔離経路であり、Host接続の成立とは別である。第二にCLI→Hostの起動・handshake・delegateを非AIで発火できる既存の正式入口があるか、固定版で先に確認する。現SourceのCRDD公開入口では、その非AI発火を確認していない。入口がなければ独自fake Provider／汎用Host Client／CLI改造を追加せず、その範囲を未確認として残す。通常の`codex exec`を非AI確認のつもりで起動しない。実Containerでの追加検証にはImage・引数・mount・回収範囲を固定して別途許可を得る。現時点ではHost追加allow、root read化、fallback許可、Timeout延長、Image更新を是正として採用しない。

#### CLI内側sandboxの非AI確認案 — 2026-10-29

OpenAI Docsで[CLIのsandbox入口](https://learn.chatgpt.com/docs/cli/reference)を確認した。現在の文書は`codex sandbox linux`、名前付き権限profile、作業Directory、設定overrideと`--`以後の固定commandという入口を説明する。ただし固定0.164.0の実helpに代わる根拠ではない。既存Docker ProbeはPythonのFilesystem／Network確認であり、このCLI内側の経路を呼ばないため、成功結果を流用しない。

追加許可を得る場合の範囲は、同じ固定Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`から新品Container一件・起動一回とする。exact local Imageがない場合はpull／buildせずEffect零で停止する。network none、認証情報／Repository本文なし、同じ非root／read-only root／cap-drop／no-new-privileges／seccomp／pids64を維持し、空の合成Work・Home・tmpと読取り専用の固定試験入力だけを使う。新品Rootは`C:\project\CRDD\.crdd\tests\codex-sandbox-non-ai-20261029-01`であり、実行前準備としてinput/probe.pyだけを作成した。Docker照会・作成・起動はまだ行っていない。

Container内では第一に固定CLIの`sandbox linux --help`だけを読む。名前付きprofile・cd・configの必要optionが確認できなければ固定分類を残して停止し、別引数の試行や通常execへの代替をしない。一致した場合だけ、既存編集profileと同じroot deny／minimal read／Workspace write／Codex File read／network falseで、合成Work内の一Fileに既知文字列を書き、読戻し一致・通常削除を行う固定command一件を実行する。git／内部状態の空の保護領域は外側のread-only mountで維持する。この実行はモデル、Provider認証、Host protocol、Task受付を使わず、CLI sandbox・コマンド起動・合成File操作の可否だけを判定する。

試験入力は`input/probe.py`、SHA-256 `2fc7cda5a655834df07590a08bcc75fed0f873ce2408afa7b2905222b4d2712a`。入力Fileを読み込んだ局所self-testは固定commandの構文・shell不使用のargv・環境変数集合を確認し、外部Process零で成功した。独立確認の出力無制限保持指摘を是正し、両streamを並行読取り、合計65,536 byte以内だけを保持して超過時は元Process groupへTERM一回・五秒の終了確認へ接続する。64KiB境界・超過時buffer不増加・TERM一回と終了未確認の負例を有限代役で確認した。Container入口は`python3 -B /probe/probe.py`、内側のcommandは`/usr/local/bin/python3 -I -B -c <固定Source>`でshellを使わない。固定Sourceは`/work/sandbox-probe.txt`が未存在であることを確認し、`CRDD_SANDBOX_NON_AI\n`を書き、同bytesを読戻し、unlink後に`CRDD_SANDBOX_OK`だけを出す。モデル・任意command・本文・認証値を引数へ入れない。

MountはRoot内input→`/probe`（RO）、work→`/work`（RW）、home→`/provider-home`（RW）、tmp→`/tmp`（RW）、guards/git→`/work/.git`（RO）、guards/internal→`/work/.crdd`（RO）に固定する。work内の二mountpointも空で事前作成する。正常時の合成probe Fileは不存在、保護二領域は空のままとし、準備済み入口・元ID領収書以外の新規entryは清掃前に確認する。元ID領収書はRoot直下`trial.json`だけで、trial／sourceCommit／rootIdentity／image／probeSha256／containerIdの六fieldに固定する。作成応答後の元64桁hexを保存・読戻し確認してからだけstartする。これは不変の作成応答領収書であって現在状態ではなく、state fieldを設けず、未開始又は開始済みの判断材料へ転用しない。親喪失後は元IDで現状態を観測し、開始可否にかかわらず同じ試験を再実行しない。領収書の欠測／不一致ではstart零で停止し、要求結果又は終了が不明なら同じ元IDを保持する。CLIが作るHome／tmp内の未知entryを名前だけで一括削除せず、確認不能なら保持する。この正例はprofile指定の受理とWorkspace操作の成立だけを示し、root deny／minimal read／network falseの各強制を独立証明しない。外側DockerのRO／network noneによる拒否を内側の保証へ算入しない。

help・commandごとの有界待機と出力量、元子Processの終了、元Container構成・停止・IDを確認し、失敗時の再試行・Timeout延長・追加capabilityは行わない。結果は固定段階・終了値・分類だけを記録し、生出力を恒久保存しない。今回の既知内容とIdentityを照合できる試験物だけを通常回収し、観測不能・未知内容はexact参照付きで保持する。Image取得／更新、Docker Engine／daemon起動・再起動・修復、既存資源・過去保持物への処置は含めない。これは承認候補であり、実Containerの処置はまだ行っていない。

#### CLI内側sandbox非AI試験の一回停止 — 2026-10-29

上記範囲を人間が承認した後、Engine linux 29.8.1、exact local Image存在・稼働Container零、probe Hash・既存seccomp Hash、Rootと祖先／全初期子の非Link・Identityを確認した。新品Containerの作成応答は64桁元IDとして受領し、不変領収書の保存・読戻しと六Mount／Image／UID／read-only root／network none／seccomp／pids64の照合後、一回だけstartした。

結果は`blocked / fixed_cli_help_mismatch`、stage `help`、helpConfirmed false、commandStarted false、commandExitCode nullだった。Containerは2026-10-29T05:37:50.670886073Z開始・05:37:51.300447905Z終了、exited／ExitCode 2、OOMKilled false、Restarting false、RestartCount 0。attach呼出し自体の終了値は1で、Containerの終了値とは区別する。固定File操作、CLI内側sandboxの成立、Host接続は未確認である。

停止条件は、helpの終了値非零又は必要option（permission-profile／cd／config）の欠測のどちらかだった。今回の有限結果はその内訳を保持しておらず、CLI本体の故障、option名の違い、help出力先の差のいずれかを断定しない。検証Toolの診断不足があり、次に是正するならhelp終了値・各option検出のboolean・stdout／stderr byte数だけを既存結果へ追加するのが最小候補である。生help／stderrの保存、新しい状態・Registry、別引数へのfallback、製品権限の緩和は不要であり、今回は追加実行をしない。

元Container IDは`ab0354f449b67716df0bd00c34c3e0f2d946691b1d6688082ea17655a1f44fd0`。Root Identityは`1687905628:39969446695535305:1793246950934337900`、入力Hashは前項と一致する。停止後の全Config／MountとHostConfigは未指定OomKillDisableのfalse→null以外一致した。回収直前にも停止・元ID・全設定を再照合し、この未指定fieldだけを今回の表現差として限定判断した。元IDへ通常rm一回を実行し、一覧取得成功・該当零によってContainer不存在を確認した。

RootにはCLI補助用の空lock二件・空Directoryと、固定CLIのContainer内Pathを指すsymbolic link三件が残った。Node lstat／readlinkで追跡せず検査し、三件ともtargetは`/opt/crdd/providers/codex/0.164.0/codex`、Windowsのreparse tagは0xa000001dだった。独立確認後、初期十六Identityと全二十二entryの現在Identity／単一link／bytes／Hash／link targetを再照合した。link三件はFile.Deleteでentry自身だけを除去し、空lock二件・既知probe／領収書と空の既知Directoryだけを通常・非再帰削除した。Root不存在を確認し、今回の試験物は回収完了。link先・任意の再帰削除・強制属性解除・ACL修復は扱っていない。AI送信・Docker Engine再起動・Image更新・過去保持物操作・失敗後の再試行は行っていない。

#### help診断の最小是正・非AI局所確認 — 2026-10-29

人間の継続指示に従い、新品の`C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-02\input\probe.py`だけを準備した。前回Rootや試験を再利用せず、製品Sourceは変更しない。SHA-256は`9d9e9ab298bf693fbe0dde69f209862a2f98e2cf89c493477ddaff04c571586e`。既存の固定CLI・30秒待機・合計64KiB保持上限・元Process groupへのTERM一回と五秒終了確認を維持し、実行対象を`sandbox linux --help`一回だけへ縮小した。通常exec、固定File操作、引数fallback、Provider認証・モデル呼出しの経路は持たせない。

診断はhelpExitCode、helpStdoutBytes／helpStderrBytes、permission-profile／cd／configのstdout／stderr別検出boolean、複数形permissions-profileの診断booleanだけを返す。生help／stderr・未知本文を返さず、helpが完了しなければ各観測はnull、helpObserved falseとして失敗を保持する。成功条件は終了値零かつ必要な三optionがstdoutに存在すること。stderr側だけ又は複数形の検出を成功・自動切替へ使わない。独立確認の部分一致指摘を受け、optionの前後境界を照合し、cd-root／config-file／連結文字列／別suffixの誤検出を拒否した。これは試験の確認条件の是正であり、本番のAuthority・保存・安全判定へ変更を加えない。

局所self-testは、正常・非零終了・stderrのみ・option不足・複数形・本文非公開・部分一致反例・equals／comma表記の十一診断条件、64KiB境界と超過時buffer不増加、終了確認の有限代役二条件を確認し成功した。外部Process起動零であり、実CLI・Docker・実OSの取消成立を証明しない。WindowsでPythonを`-B`指定し、bytecode生成を避けた。Docker照会／作成／起動、AI再送、過去保持物操作は実施しておらず、元のhelp停止原因も未確定のままとする。

次の実行は別途承認後、新品Container一件で固定Image・network none・同じ非root／RO／seccomp／pids64・空Work／Home／tmpとRO試験入力だけを使い、上記help一回と今回試験物の確認後回収に限定する。Engine停止・Image欠測はEffect前停止、失敗時再試行なし、観測不能・未知内容はexact Root／ID付きで保持する。File操作を含む前回の実行許可を再利用せず、helpだけへ縮小した範囲を提示する。この準備入力は次回試験後に回収し、未使用の場合は2026-11-05を再評価日とする。新しい恒久Tool・公開API・Registry・Recoveryは追加しない。

#### help専用診断付き一回実行 — 2026-10-29

人間の承認後、同じSource `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`・固定Image・入力Hashでhelpだけを一回実行した。Engine linux 29.8.1、local Imageのexact一致、稼働Container零、Root／祖先／初期全子十一Identity、四Mount、非root／read-only root／network none／seccomp／pids64、元ID領収書の読戻しを確認後にstartした。Container IDは`85bc5708881df683140d2144fbcafbd0be0144e90d940c7bf606cc311197f4e8`、Root Identityは`1687905628:24769797951586580:1793258453100230500`。

| 診断 | 一回の観測 |
| --- | --- |
| 結果 | blocked、stage help、reason help_command_nonzero |
| help | 観測完了、終了値101、stdout 0 byte、stderr 216 byte |
| 必須option | permission-profile／cd／configはstdout／stderrとも未検出。複数形permissions-profileも未検出 |
| 後続 | commandStarted false。固定File操作、Host接続、AI呼出しはいずれも未実行 |
| 外側終了 | Container exited／ExitCode 2、attach呼出し終了値1。OOMKilled false、Restarting false、RestartCount 0 |

Container開始／終了は2026-10-29T08:12:20.815682212Z／08:12:21.411011176Z。前回のhelp mismatchは、今回の条件では「help自体の非零終了」であり、正常helpにoptionが不足した結果ではないと切り分けられた。ただしstderrは本文を保存せずbyte数だけを記録したため、具体的な内部故障は未確定である。終了値101だけからpanicや権限・Process数枯渇等の原因を断定せず、製品設定・Image・Timeoutの是正へ進まない。失敗後の再試行は行わない。

今回RootにはCLI由来の空lock二件、空Directoryと固定CLI Pathを指すlink三件を検出し、他の新規本文Fileはなかった。元IDと停止・構成を再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定した上で通常rm一回、一覧取得成功・該当零によりContainer不存在を確認した。初期十一Identityと全十七entryの現在Identity／単一link／bytes／Hash／link targetを再照合し、三件のreparse tag 0xa000001dを個別確認してlink自身だけをFile.Deleteした。空lock二件と既知probe／領収書、既知の空Directoryだけを非再帰・通常削除し、Root不存在まで確認した。今回の物理残存はない。link先・ACL・強制削除・任意再帰は扱わず、AI再送・Docker Engine起動／再起動／修復・Image更新・過去保持物操作は行っていない。

#### stderrの有限診断準備 — 2026-10-29

次の継続指示に対し、未承認の再試行はせず、新品`C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-03\input\probe.py`を準備した。SHA-256は`b4f9e4903d07e01f3cbdfff5703b6423650ca6933cf9b89429e49fe2b20e243a`。help一回だけの経路・30秒期限・合計64KiB上限・TERM一回と五秒終了確認・既存成功条件は不変。stderr本文をメモリ内で、panic／Thread生成／Signal処理／Runtime言及／資源不足／権限／File欠測／Memory／sandbox言及／引数拒否の十boolean、`Os { code }`又は`os error`に限定した0〜65535のOS番号（重複除去・昇順・最大八件）へ変換する。任意本文・Path・一般的な数字を返さず、空・未分類・番号打切りを明示する。これは語句の観測であり、原因の確定ではない。

外部Process零の局所確認でhelp十一条件、分類九条件、64KiB境界と終了の有限代役二条件が成功。本文非搬送、一般code表記・六桁番号の拒否、最大八件も反証し、独立レビュー残指摘零。製品Source・設定・Image・安全判定は変更しない。実CLI／Docker・AI・過去保持物は操作していない。次は同じ固定Image・隔離条件、空Work／Home／tmp・RO入力、exact元ID領収書と通常回収の既存条件を用い、別途承認した新品Container一件でhelpだけを一回実行する。File操作・通常exec・AI・fallback・自動再試行は含めず、Engine停止・Image欠測では停止する。準備入力は試験後に回収し、未使用時は2026-11-05に再評価する。

#### 診断付きhelp確認の事前停止 — 2026-10-29

人間が上記一回と今回試験物の回収を承認した後、入力・seccompのHashとSource HEADの一致を確認した。最初のEngine読取りが接続先`dockerDesktopLinuxEngine`のpipe欠測で失敗したため、その場で停止した。Image照会・稼働資源照会・Container作成／起動・CLI helpは未実施。これはCLIの終了値101の再現結果ではなく、Engineへ接続できないためのEffect前停止である。Engine起動／再起動・修復・再試行は行わず、AI送信・過去保持物操作もない。今回Rootには準備済みinput/probe.pyだけがあり、既知Hash・exact配置・祖先を含む非link・単一link・全entryを確認して、そのFileと空のinput／Rootだけを非再帰・通常回収した。Root不存在を確認し、今回の物理残存はない。実試験の失敗原因分類は未取得のまま保持する。

#### 通常起動後の診断付きhelp一回結果 — 2026-10-29

人間がDocker Desktopの通常起動とhelp一回・今回物回収を明示承認した。公式配置のDesktop実行物の署名Valid／Docker Incを確認し、非表示の通常起動一回でEngine linux 29.8.1が応答した。再起動・修復はしない。固定Task Imageの存在・exact一致、稼働Container零を確認し、新品Root `C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-04`へ前回レビュー済みと同じ入力Hash `b4f9e4903d07e01f3cbdfff5703b6423650ca6933cf9b89429e49fe2b20e243a`を復元した。Root Identityは`1687905628:52072870694109774:1793272535309933200`。入力の局所self-test十一help／九分類／終了二条件も再確認した。

元Container IDは`aca4d91eb695bbb7425384eb4f1dbd804bced9f4f75fec06b29354a3c8a58b12`。作成応答・exact領収書保存と読戻し・固定Image／四Mount／network none／UID 65534／RO root／既存seccomp／pids64の照合後、help一回だけを実行した。開始／終了は2026-10-29T11:16:26.268895227Z／11:16:26.933974846Z。結果はblocked／help_command_nonzero、helpObserved true、helpExitCode 101、stdout 0 byte／stderr 216 byte、必要三optionと複数形は両stream未検出、commandStarted falseだった。Containerはexited／ExitCode 2、attach終了値1、OOMKilled false／Restarting false／RestartCount 0。

stderrの固定診断はrecognized_markers、panic／missingFile／sandboxMentionがtrue、OSエラー番号は`[2]`・打切りなし。他の七markerは未検出だった。同じstderrで三つの固定markerを検出した事実と、それらの因果関係は区別する。具体的な欠測Path・発生点・sandbox補助Fileとの因果はまだ未確定であり、marker未検出をThread／資源不足等の不存在証明へ使わず、番号だけからbwrap欠測や権限故障を断定しない。直接確認できたのはhelp Processの非零終了と正常help本文の非観測までであり、製品権限・Timeout・Imageを変更せず、再試行しない。生stderrは保存していない。固定File操作・Host接続・AIはいずれも未実行。

停止・元ID・Config／Mountを再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定判断して、通常rm一回と一覧上の不存在を確認した。Rootの初期十一Identityと全十七entryの現在Identity／nlink／bytes／Hash／link targetを再照合。固定CLIを指す三linkはreparse tag 0xa000001dを個別確認してFile.Deleteでentry自身だけを削除し、既知の空lock二件・probe・領収書と空Directoryだけを非再帰で通常削除した。Root不存在を確認し、今回の物理残存はない。Desktopは通常起動後のままとし、AI送信・Docker再起動・Image取得／更新・過去保持物操作はしていない。

#### 固定版Source照合による検証呼出しの不一致 — 2026-10-29

調査指示に対して実行を繰り返さず、Build入力が示す公式Commit `6aaac694803004a63c6f393d153c96d22521a6b9`のSourceと現行Dockerfileを読取り照合した。現行一般文書から推定したCLI構造を固定版へ当てはめたことが誤りだった。

固定版の[CLI定義](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/cli/src/main.rs#L437)は`SandboxCommand`にHost別引数をflattenし、OS名によるlinux subcommandを持たない。Linuxでは[LandlockCommand](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/cli/src/lib.rs#L96)の末尾可変長commandとして解釈する。公式のhelp試験も`codex sandbox --help`を使う。したがって当方の`codex sandbox linux --help`はhelpを読む呼出しではなく、隔離内の対象commandに`linux --help`を渡す誤った形である。これは検証Toolの固定版契約不一致として特定した。

[Linux実行処理](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/linux-sandbox/src/linux_run_main.rs#L1094)には、対象commandへのexecvp失敗でpanicする経路がある。存在しないlinuxコマンドの発行は、今回のpanic／missingFile／sandboxMentionとOS番号2に整合する有力な説明である。ただし生本文を保持していないため、元のpanic発生箇所と完全に一致した実証とは区別する。Image内のbwrap欠測・配置不整合が確認されたとは扱わない。

配置側では、Dockerfileのbwrap先`/opt/crdd/providers/codex/0.164.0/codex-resources/bwrap`は[固定版の探索候補](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/linux-sandbox/src/bundled_bwrap.rs#L112)の第一候補に一致する。HostのCLI隣接配置も[InstallContextのfallback](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/install-context/src/lib.rs#L160)と一致する。これはSourceとBuild定義の照合であり、今回Imageを再抽出して実Fileの現存・動作を確認した結果ではない。配置変更やImage更新を行う根拠はない。

過去記録の解釈を訂正する。`commandStarted=false`は検証wrapperの後続固定File操作が未開始であることしか示さず、CLI内部のsandbox／command経路の未開始を証明しない。上段の「helpだけ」「sandbox本体未開始」は当時の意図・解釈であり、固定版Source照合後の事実として再利用しない。合成Workの固定File操作・AI・Provider認証は実行しておらず、外側network noneと空の限定Mount、今回分の確認後回収は維持される。この問題を元の実AI編集E2EのCode Mode故障原因へ一般化しない。

最小是正案は検証入力だけの変更で、helpを`codex sandbox --help`、別途許可した固定commandを`codex sandbox --permission-profile crdd-executor ... -- /usr/local/bin/python3 ...`とし、誤ったlinux要素を除去する。固定版Sourceの構文と一致する正例・旧呼出しを拒否する負例を局所確認してから、必要な一回の実境界確認を別途提示する。自動的な別引数再試行、恒久互換層、Image／Host配置変更、権限緩和、Timeout延長は不要。今回は調査・記録のみであり、修正版の実行・AI送信・Docker操作・過去保持物操作はしていない。

#### help呼出しの最小是正・局所試験と一回確認条件 — 2026-10-29

人間の実装指示に従い、新品Root `C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-05`の`input/probe.py`へ検証入力を準備した。SHA-256は`3543cb42d11e69c3b2cbee3beb320a1edc6858b902f4c28c2d9c370c8e4b4f6c`。起動引数を固定tupleの`(CLI, sandbox, --help)`へ修正し、spawn前にもこのexact集合を照合する。旧linux要素・通常exec・余分な引数を拒否し、他の引数へ自動切替しない。既存のstderr有限分類、30秒、64KiB、TERM一回＋五秒終了確認、help成功条件は維持する。製品Source・Image・配置・権限は変更しない。`commandStarted`はwrapper後続File操作だけを指すとコメントへ明記し、CLI内部のEffect零を示すfieldとして扱わない。

WindowsのPythonを`-B`で実行した局所self-testは、起動引数四条件、help十一条件、分類九条件、main搬送二条件、終了の有限代役二条件、64KiB境界が成功した。旧呼出しをmainへ与えた場合はspawnを拒否する代役を設定し、`help_invocation_invalid`で閉じることを確認した。正常helpの搬送も同じmainで確認したが、外部Process起動は零であり、実CLI／Containerの成功とは区別する。Docker照会・実行、AI送信・過去保持物操作はしていない。

| 修正版一回確認の条件 | 固定する範囲 |
| --- | --- |
| Image | 既存localの`sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`。取得・更新・Buildなし |
| 回数・処理 | 新品Container最大一件、起動一回、CLIは上記help一回のみ。固定File操作・通常exec・Host／AI呼出しなし |
| 隔離 | network none、非root 65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64。秘密・認証情報・Repository本文なし |
| Mount | Root内input→/probeはRO、空work→/work・home→/provider-home・tmp→/tmpはRW。Root外のMountなし |
| 前提 | Engine・exact Image・他の稼働Containerなし・入力Hash・Root／祖先Identity・非linkを確認。Engine停止・Image欠測・他作業中は要求前停止し、起動／再起動／修復しない |
| 領収書 | 作成応答後の元IDと六fieldの不変trial.jsonを保存・読戻し確認し、元ID構成照合後だけstart。現在状態や未開始証明へ転用しない |
| 結果 | helpの終了値零と必要option三つのstdout exact検出。成功してもCLI help面の確認だけで、sandbox実行・権限制御・Host接続・編集E2Eの成立へ拡張しない |
| 失敗・回収 | 再試行なし。同じ元IDの停止・構成を確認して通常rm／不存在確認。Root全entry・Identity・Hashと補助link自身を再照合して既知物だけ通常・非再帰回収。不明はexact Root／IDと再評価日を記録して保持 |

これは条件の整理と局所確認までで、実行承認はまだ求める段階である。準備入力は承認後の試験終了時に回収し、未使用又は残存時の再評価日は2026-11-05とする。過去保持物を対象に含めず、正常起動や失敗を過去の不明事実へ上書きしない。

#### 修正版helpの一回成功と回収 — 2026-10-29

人間の承認後、Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`・同じ固定Task Image・上記入力Hashで`codex sandbox --help`を一回実行した。Engine linux 29.8.1、local Image exact一致、稼働Container零、Rootと祖先・初期全子十一Identity、四Mount・隔離条件、元ID領収書の保存・読戻しを確認してからstartした。実IDは`ad31eb7e442b1db7dc63a43d8cf9c402257e6c26dc81ad0767d022cd7bd38e18`、Root Identityは`1687905628:40532396647466567:1793273097947772000`。

結果はcompleted／reason null、helpObserved true／helpConfirmed true、help終了値0、stdout 1,932 byte／stderr 0 byte。permission-profile／cd／configの三つをstdoutでexact検出し、stderr診断はemptyだった。開始／終了は2026-10-29T11:28:07.743409650Z／11:28:08.205410795Z。Containerもexited／ExitCode 0、attach呼出し終了値0、OOMKilled false／Restarting false／RestartCount 0。Image・権限・Host配置・Timeoutを変えず、検証呼出しのlinux除去後にhelpの正常応答を確認した。旧panicの生本文を復元したものではなく、元の実AI編集E2EのCode Mode故障原因や解消は依然として別の未確認事項である。help成功をsandbox内のcommand／権限制御／Host接続の成立へ算入しない。

元ID・停止・Config／Mountを再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定判断した。通常rm一回後、一覧取得成功・該当零でContainer不存在を確認。Rootは初期十一Identityと全十四entryの現在Identity／nlink／bytes／Hash／link targetを再照合し、既知の三linkは各reparse tag 0xa000001dを確認してentry自身だけをFile.Deleteした。空lock一件・既知probe／領収書・空Directoryだけを通常・非再帰削除し、Root不存在を確認した。今回の残存はない。再試行・AI送信・Docker Engineの起動／再起動・Image取得／更新・過去保持物操作は行っていない。

#### sandbox固定commandの非AI確認条件案 — 2026-10-29

今回は条件整理だけで、実行コード・試験Rootはまだ作成せず、Docker照会・起動も行わない。承認後に局所試験と独立確認を終えてから、既存の用途固定試験と同じ有界Process処理で実行する。新しい公開API・Registry・Lock・Recovery・Provider代役は作らない。

対象は既存local Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`の公式Codex 0.164.0。新品Container最大一件・起動一回、CLIも一回のみ。先に成功したhelpを再実行せず、正しい構文`codex sandbox --permission-profile crdd-executor --cd /work --config ... -- /usr/local/bin/python3 -I -B -c <固定Source>`を使う。設定は現在の編集計画と同じdefault_permissions、root deny／minimal read／Workspace write／Codex実行File read、コマンドnetwork falseとする。余分なlinux要素・shell・通常exec・Host／モデル・認証処理は使わない。

実際の引数は次のexact配列だけに閉じる。CLIは`/opt/crdd/providers/codex/0.164.0/codex`、SOURCEは下記271 byteのSourceだけであり、実装時に同じHashを再照合する。CONFIG_1〜3の個数・値・順序を固定し、製品Plan全体やcode_mode／Host／model／認証設定を展開しない。

```text
CONFIG_1 = default_permissions="crdd-executor"
CONFIG_2 = permissions.crdd-executor.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="write"},"/opt/crdd/providers/codex/0.164.0/codex"="read"}
CONFIG_3 = permissions.crdd-executor.network.enabled=false
ARGV = [CLI, "sandbox", "--permission-profile", "crdd-executor", "--cd", "/work",
        "--config", CONFIG_1, "--config", CONFIG_2, "--config", CONFIG_3,
        "--", "/usr/local/bin/python3", "-I", "-B", "-c", SOURCE]
```

Container入口は直前の試験と同じ`python3 -B /probe/probe.py`に固定し、用途固定の監督コードから上記CLIを子一件だけspawnする。shellを経由しない。実行前の局所試験は旧linux・exec・separator欠測・config欠測／余剰／並替え・Source Hash差をすべてspawn零で拒否する。既存`coordinator/tests/integration/codex-executor-sandbox.integration.test.ts`にも正しいsandbox入口と権限設定抽出があるが、Host help・Home読書き拒否等を含む別範囲の試験であり、shell包装・回収処理も今回条件と異なるため、そのまま一括実行しない。恒久Frameworkを追加せず、確認対象を今回の固定commandへ限定する。

固定SourceはUTF-8・271 byte、SHA-256 `c45e2ed831c36651e11f581f210ffecc4dfcfbd741de2ccc1c729d867f686b4a`。内容は次の一つだけとする。

```python
import os
p="/work/sandbox-probe.txt"
data=b"CRDD_SANDBOX_NON_AI\n"
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,"wb") as f:
    f.write(data)
with open(p,"rb") as f:
    assert f.read()==data
os.unlink(p)
print("CRDD_SANDBOX_OK")
```

| 項目 | 承認を求める限定範囲 |
| --- | --- |
| Root | `C:\project\CRDD\.crdd\tests\codex-sandbox-command-20261029-01`のみ。実Repository本文・Git管理領域・認証領域は渡さない |
| 外側隔離 | network none、UID 65534:65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64。Image取得／Build／更新なし、Network／Volume作成なし |
| Mount | Root内input→/probeはRO、空work→/work・home→/provider-home・tmp→/tmpはRW。空guards/git→/work/.gitとguards/internal→/work/.crddはRO、mountpointも事前に空で作成する |
| 一時的Effect | 上記合成File一件の排他的作成・既知bytes書込み・読戻し一致・unlink。CLIがHome／tmpへ作る補助物は今回Root内だけで確認・回収する |
| 実行前 | Engine応答、exact local Image、他の稼働Containerなし、固定引数／Source Hash、Root／祖先／全初期子のIdentity・非link、既存seccompを確認。元作成IDの不変領収書を保存・読戻し後、構成照合してstart |
| 前提不成立 | Engine停止、Image欠測、他のDocker作業、Root／構成不一致はEffect前停止。Desktop／Engine起動・再起動／修復、代替Image、別引数へのfallbackは行わない |
| 有界処理 | CLIは30秒・stdout/stderr合計64KiB。期限／出力量超過では元Process groupへTERM一回、五秒の終了観測。再試行・期限延長・追加capabilityなし |
| 成功条件 | CLI終了値0とexact成功marker、固定File不存在・workの予定外変更なし、元子ProcessとContainerの終了、正常回収と不存在を別々に確認する。stderrは既存の非秘密分類・byte数だけを記録 |
| 回収 | 元IDと同じ構成・停止を確認した今回Containerだけ通常rm。Root全entry／Identity／nlink／bytes／Hash、既知linkはtargetとreparseを照合してlink自身だけを除去。既知Fileと空Directoryを非再帰・通常削除し、Root不存在確認。force／ACL修復／過去物処置なし |
| 不明・残存 | 作成・終了・内容・同一性が不明なら再試行・強制回収をせず、exact Root／IDと未解決点を記録して保持。既定七日で再評価し、期限だけで削除しない |

この一正例で示せるのは、同じ名前付きprofileを指定したCLI sandbox経路で固定File操作を実行できたことまでである。root deny／minimal read／network falseの各規則の独立した強制証明ではなく、外側DockerのRO／network noneを内側の保証へ重複算入しない。Host接続・Code Mode・実AI編集E2Eの成立も主張しない。承認対象は、この一回の合成File操作と今回物の確認後回収であり、AI送信・Docker再起動・過去保持物操作を含めない。

#### sandbox固定commandの一回成功と回収 — 2026-10-29

人間の承認後、上記のexact引数・三config・固定Sourceだけを使う用途固定入力を準備した。probe SHA-256は`478ffaab75a74156a0f76e613ff1778fc3e106e22c5bd3d1cdb9ed7f83432072`。旧linux／exec／separator欠測／config欠測・余剰・並替え／Source差／期待Source Hash差の八条件は、Popen拒否代役下でspawn零・fixed_argv_invalidへ閉じた。271 byteとSource Hash、64KiB境界・終了の有限代役二条件も成功。独立レビュー残指摘零を確認してから実行へ進んだ。

Engine linux 29.8.1、既存local Image exact一致・稼働Container零、Root／祖先／全初期子十六Identityと非linkを確認し、新品Container一件を作成した。元IDは`2733f9e480f538f1cc4ae05130d8c51d4809c13f65e77cd2d3cd98e308790ca8`、Root Identityは`1687905628:49539595902085877:1793274008325595400`。不変領収書の保存・読戻し、六Mount・固定Image・既存隔離条件を照合後、一回startした。開始／終了は2026-10-29T11:41:31.287438029Z／11:41:32.038969606Z。

結果はcompleted／reason null、CLI観測完了・終了値0、stdout 16 byteのexact成功marker、stderr 0 byte。固定SourceによるFile作成・既知bytes読戻し・unlinkを確認し、監督側のFile不存在とWork全体が空の二保護Directoryだけであることもtrueだった。Containerはexited／ExitCode 0、attach終了値0、OOMKilled false／Restarting false／RestartCount 0。これは現在の名前付きprofileを指定したCLI sandbox経路の正例成立であり、各規則の独立した強制、Host接続、Code Mode又は実AI編集E2Eの成立ではない。

終了後に同じ元ID・Config／Mount・停止を照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定した上で、通常rm一回と一覧上の不存在を確認した。Rootの初期十六Identityと全二十二entryの現在Identity／nlink／bytes／Hash／link targetを再照合。既知の三linkは各reparse tag 0xa000001dを確認してentry自身だけをFile.Deleteし、空lock二件・既知probe／領収書・空Directoryだけを非再帰・通常削除した。Root不存在を確認し、今回の物理残存はない。再試行・help再実行・AI送信・Docker Engineの起動／再起動・Image取得／更新・過去保持物操作は行っていない。製品Source・設定・権限・Timeoutも不変である。

実行許可を提示する際の回収条件は、作成応答の元実ID・同じ構成／所有・停止状態、試験Rootと祖先のIdentity・非linkを確認できた場合だけ通常回収する。作成結果・終了・Identityのいずれかが観測不能なら、確定済みのexact ID／Rootを保持し、自動再試行・force cleanup・別ID再構成は行わない。session/shutdownの受理を終了へ丸めず、transport close・Host子Process exit・Container停止を別々に確認する。元の旧失敗又は過去保持物へ適用しない。

#### sandbox確認後の接続棚卸しと非AI再確認 — 2026-10-29

固定command成功後、既存の編集試験・Provider計画・利用側契約を照合した。`verify-workspace-ai.ts --preflight`はAI分岐を通らず、合成Fileを試験自身で編集してWorkspaceの固定・統合・終了を確認する。CLI→Host→Toolを発火する検査ではない。現在のCRDD Sourceと試験の確認範囲には、この三者を非AIで一括実証する既存入口は見つかっていない。公式CLI全体にその入口が存在しないとは断定しない。新しいfake Provider・Host Client・Workerを追加せず、Host単体とsandbox単体の成功をCode Mode又は元の編集故障の解消へ読み替えない。

Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`の二Suiteを外部AIなしで実行し、18件中16成功・2不合格だった。失敗は公開HTTP試験mainと実保存付きHTTPの子Client境界で、headers_unobserved／timedOut falseとなり、15秒超過とは異なる。通常のローカル接続を許可した環境で同じ二Caseだけを実行し、2件とも成功・終了値0（約58秒）を確認した。実保存Caseは通常完了・取消・応答喪失後の同ID継続、Owner終了と現在の未解決区画の不存在、自己生成Rootの清掃hook完了を確認する。三POSTの本文受領は約0.92秒・0.90秒・3.61秒で既存15秒内だった。先行不合格を上書きせず、18件の単一成功runとも表示しない。モデル選定二件を含む他の16成功は最初の実行結果である。製品Source・権限・Timeoutは変更せず、Docker照会／操作・外部AI・過去保持物操作はしていない。

次に実AIへ進む場合は、新品のRepository内試験Rootで既存Direct／Isolated各一Taskを順次実行する案とする。送信対象は合成Context、合成source.txtと固定編集指示、レビューに必要な合成差分だけであり、本体Context・Source・秘密値は送らない。Codex `gpt-6.1-sol`／mediumで編集、Claude `claude-opus-5-5`／mediumでレビューし、既存の限定是正一回と再レビューを含め各Task最大四段・全体最大八Provider起動とする。Task全体の再試行はしない。Directは既存dirty／stage／未追跡内容の保全、Isolatedは明示固定・二親Merge・Branch／Worktree終了まで既存試験で照合する。既存固定Image・現在の隔離条件・HTTP十五秒を維持し、元のHTTP遅延・Code Mode故障の診断を接続する。失敗時は次のTaskへ進まず、同ID取消・終了確認と今回物の安全な回収だけを行い、不明資源はexact参照付きで保持する。Docker再起動・Image更新・過去保持物操作は含めない。この送信と今回物回収には改めて人間の承認が必要であり、本段階では実施していない。

上記段落の限定独立レビューは残指摘零。二Suiteの母集団、別runの分離、非AI成功の限界、Provider最大起動数と未承認送信の境界をSourceへ照合した。差分の空白検査も成功した。

#### 承認済み編集E2EのDirect停止 — 2026-10-29

人間の承認後、Engine linux 29.8.1・稼働Container零・既存Codex／Claude／Proxy固定Imageのexact存在を確認した。新品`workspace-ai-E6SEIF`の非AI事前確認はDirect／Isolatedとも成功し、既存dirty／stage保全・候補固定・二親Merge・Workspace終了と試験Repository回収を確認した。実AI端末の初回起動は空白を含むNode Pathの引用符がStart-Process搬送で失われて失敗した。Node Processと新Root未生成を読取り確認してから、固定起動コマンドだけをEncodedCommandで搬送し直した。AIの再送ではなく、検証Tool自体の未起動の是正である。

実AIの新品Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-mlV1po`。Directの受付IDは`request-a7ef658e-26bd-4673-ab86-8b7393bca0c9`、相関参照は`operation-ee49d66e-2658-4a49-a137-c857d35dd128`。編集→レビュー→許可済み限定是正→再レビューの四段まで実行し、Taskは`coordinator_task_independent_review_not_approved`でblocked、試験は`edit_task_not_completed`／verify_result、E2E_EXIT=2で停止した。Isolatedは未実行で、Task全体の再試行はしていない。

CodexのAttempt 0／1は両方turnCompleted true、Code Modeを言及するitem error各一件、commandExecution／fileChangeは各零だった。source.txtはBASEのまま、changedPathsは空。Claudeは各回changes_requested・指摘一件を返した。これは編集未成立をレビューが拒否した観測であり、CLI→Hostのspawn・handshake・delegateのどこでCode Modeが失敗したかは、現在の有限診断だけでは特定できない。item errorの本文や生出力は保存せず、単体sandbox成功によってこの故障が解消したとはしない。

今回のHTTPは62要求すべてでheadersを受領し、最長約14.139秒、transportFailure nullだった。15秒超過は今回再現せず、元のHTTP問題全般の解消とは断定しない。四Provider境界すべてでProcess完了／終了、Container・Network不存在、cleanupConfirmedを確認し、一次技術失敗はnull。TaskのcleanupConfirmed／Owner close／runtimeClean／workspaceCleanはtrue、Recovery参照は空。既存Docker inventoryは保全され、標準NetworkのID差だけを既存比較が区別してverifiedとした。標準Network自体を清掃対象にしない。

試験mainの物理Root回収は、成功時の二mode集合を要求する既存Gateで停止し、`fixture_root_or_removal_unconfirmed`を記録した。これはContainer／Network／Task operation等の実行資源の回収不明ではなく、二mode成功用の集合検査を満たさないため、自己生成Rootが既知残存してmainの自動削除対象にならなかった結果である。今回の清掃前確認では現在operations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは零、同じTaskはsettled／blocked・Owner世代null・cleanup true・Recovery参照空、Gitは自己Root一Worktree・mainだけ、共有先WorktreeやCandidate Branchはない。dirty／stage／未追跡は合成の元内容だけである。実AI試験Rootは35通常File・36Directory、全File nlink 1・reparse零、内容Hash `54c07090e7e122fbe5b064c37ddfec927fbc1b686a79cca71af37bf32e9f5667`。非AI事前Rootは結果JSON一File・二Directory、内容Hash `d3f194892a68d12b02743a9a725d69bd6c79e97c736a9b004ac58d0885fe4603`。試験Node不存在・稼働Container零も再確認した。過去物を調査／削除対象へ広げず、この二つの自己生成Rootだけを承認済み清掃対象とする。

清掃では自己生成Git object十四FileのReadOnlyだけを解除し、通常Fileと空Directoryを個別削除した。空の`.git` DirectoryはHidden属性によって最初の通常削除が拒否された。残存全三Directoryだけを再確認し、当該空DirectoryのHiddenだけを解除して通常削除した。ACL修復・force／再帰削除・他Root処置は行っていない。結果要約を本段落へ残した後、実AI／事前確認の両Rootの不存在を確認し、今回の物理残存は零となった。次の調査は既存Code Mode診断の不足区間に限定し、追加AI送信や設定緩和を本結果から許可しない。

#### Direct停止後のCode Mode診断経路の調査 — 2026-10-29

今回の指示は原因調査であり、製品実装・設定変更、AI再送、新しいContainer、Docker再起動、Image更新、過去保持物の読取り／変更は行わない。現行Source・設計・直前の要約と、公開された一般的なCodex設定文書だけを照合した。現行の[CLI参照](https://learn.chatgpt.com/docs/cli/reference)と[権限profile](https://learn.chatgpt.com/docs/permissions)の説明は固定0.164.0のHost内部故障の根拠にはならず、旧版へ設定を機械追従させない。

診断の縮約点はAI Adapter `provider/result.ts`の`itemErrorCodeModeCount`である。元JSONLのerror itemのmessageをメモリ内で受け取り、保存用にはerror item総数と、message由来では`/code[ _-]?mode/iu`の一致件数だけを返す。Executor `result/normalization.ts`はその観測値を`providerExecutionObservation`へ搬送し、`result/validation.ts`は閉じたfieldと上限を検査する。これらの利用側にHost起動・接続・委譲の段階情報が隠れているわけではない。生出力を後から読む経路や、清掃した試験Rootを再構築する経路は作らない。

外部Effectなしの純粋比較で、Host spawnの権限拒否・handshakeの不一致・Tool委譲の利用不能を表す三つの合成messageを、正式な`parseProviderResult`へ同じEnvelopeで渡した。三入力ともparser confirmed・Code Mode件数一件・command／fileChange零で、返却診断全文が同一となることをassertした。これは分類の情報落ちの再現であり、実故障が三候補のいずれかだという実証ではない。既存Codex結果・選定Consumerの二Suiteも7件全成功。合成内部errorを含んでもSchema上の完了をconfirmedとする既存契約を確認したが、これをTask採用・実編集成功へ解釈しない。内部error一件だけで常にTaskを拒否する変更は、回復可能な中間errorまで止める可能性があり、この調査では採用しない。

現時点の結論は、CLI／Hostの具体的故障原因は未確定、既存観測からその区間を復元できない原因は診断の縮約で確定、という二点である。隣接Host／bwrapの配置、同じ名前付きprofileのsandbox正例、Host単独計算成功は保全するが、CLI→Host接続の成功へ合算しない。特に権限設定の明示readがCLI実体だけであることは照合したが、Hostがその制限内で起動されると確認していないため、Host Path追加allowを是正とはしない。

最小是正案は、新しいLog／State／Managerを作らず、既存error itemのメモリ内分類に「Host・spawn・handshake／protocol・接続終了・Tool・権限・欠測・Timeoutを言及したか」と未分類件数を閉じた有限観測として追加することである。語句の言及と実際の発生点は区別し、本文・Path・Command・任意error codeを保持せず、成功判定・権限・Timeout・Imageは変えない。改訂する場合はAI Adapterの返却型・分類、Executorの閉形式検査、既存Coordinator／検証Toolの搬送と合成負例を同時に追従する。固定版で一意なerror code又は接頭辞を確認できたものだけを段階分類へ昇格し、それ以外は候補markerのままにする。実装はまだ行っていない。分類の非AI確認と独立レビューを終える前に、同じ広い実AI E2Eを再送しない。

#### Code Modeの非秘密診断の最小是正 — 2026-10-29

人間の継続指示に基づき、上段の診断追加だけを実装した。AI Adapterの既存error item処理へ八つの`itemError*MentionCount`と`itemErrorUnclassifiedCount`を追加し、message本文はメモリ内だけで処理する。Code Modeの一般語だけでは分類済みとせず、message欠測も未分類へ含める。同じitemの複数語句は独立に数え、原因・発生点は確定しない。新しい公開関数、Log、State、Registry、Managerは追加していない。

Executorの閉形式検査は、九fieldの全件存在又は全欠測だけを受理し、旧観測を零補完しない。負数・非整数・非有限・総数超過、分類済み件数と未分類件数の矛盾を拒否する。Coordinator公開投影は同じ検査へ直接接続し、搬送前の新field集合だけへの二重固定を除いた。Workbench試験で正式parserから段階診断への新値保全と秘密風本文の非搬送を確認した。Envelope・採否・認証・Authority・清掃条件・Timeout・Imageは変更していない。Architectureと既存Quality義務への接続も追従した。

最終局所三Suiteは36件全成功。Executor全回帰は15件全成功。Coordinator Task Runtime全体は制限環境で157件中156成功・一件junction作成EPERM、同じ一件の通常環境成功に続き、Suite全体を通常環境で157件全成功として再確認した。先行不合格と別runを区別し、合算しない。四Packageの型検査、変更七TypeScriptの整形・警告を失敗とするLint、diff checkが成功した。初回Workbench型検査の試験Record型不足、及びCoordinatorの有限代役が旧診断のままで新期待値と一致しなかった追従漏れは是正して再確認した。製品の拒否条件を緩めていない。

AI Adapter全回帰は27件中26成功・一不合格。残る`catalog-loading.contract.test.ts`は、同梱Catalogの検査Source内にDomain importが一箇所という置換前提を持つが、基準HEADの同じSourceにも二箇所のimportがあり、split長3対期待2で停止する。今回そのSourceと試験は変更しておらず、診断追加の成功へ混入せず既存試験追従の別件として保持する。全Package回帰成功又は全体QA完了とは表示しない。

限定独立レビューは指摘零。語句分類の重複・未分類・旧欠測・相関、閉形式と秘密非搬送、Coordinator／Workbenchへの搬送をSourceで反証した。実AIは再送せず、Docker・Image・過去保持物も操作していない。次の実AIではこの新診断を使えるが、今回の非AI成功で旧故障原因が確定又は解消したとは扱わない。

#### Catalog試験の既存追従漏れの是正 — 2026-10-29

人間の継続指示に基づき、上段で別件として保持したCatalog試験一件を是正した。製品の`catalog/validation.ts`と`catalog/resolve.ts`は各々Domainの型import・実行時importを持つため、独立fixtureへの複製時に二参照を同じ正式Ownerへ置換する。試験のexact出現数期待を二参照へ追従し、replaceAllを使用した。正例、JSON欠落・構文不正・Schema不正の子Process終了値／固定理由／成功marker不存在というOracleと、fixtureのfinally清掃は変更しない。製品Source・拒否条件・Catalog値は不変である。

修正後のAI Adapter全回帰は27件すべて成功、整形・型検査・警告を失敗とするLintも成功した。先行26成功・一不合格を撤回せず、追従後の別runとして記録する。実AI再送、Docker／Image操作、過去保持物の操作は行っていない。次の実AI確認では、前段で追加した有限語句診断を使い、同じ合成内容・Codex GPT-6.1 Sol medium／Claude Opus 5.5 medium、Direct成功後だけIsolatedへ進む一回の編集E2Eを改めて提示する。Task全体の自動再試行・新しい実行管理は追加しない。

#### 新診断付き編集E2Eの一回停止 — 2026-10-29

人間の明示承認後、Engine linux 29.8.1・稼働Container零と既存固定Codex／Claude／Proxy Imageのexact存在を確認し、新品`C:\project\CRDD\.crdd\tests\workspace-ai-LY1F33`で既存編集E2Eを一回実行した。通常の送信同意は対話端末で行う。Direct受付IDは`request-7f4daa4f-6210-4fad-8d9a-3063ef70bd3f`、相関参照は`operation-894710c5-faf5-4d28-a0df-8fad941b62f3`。編集→レビュー→承認範囲の限定是正→再レビューの四段で停止し、Isolatedは未実行、Task全体の再試行はしていない。Taskの一次結果は`coordinator_task_independent_review_not_approved`、試験は`edit_task_not_completed`／verify_result、E2E_EXIT=2。実行Sourceの不変も確認した。

新診断の九fieldは保存結果まで搬送されている。Codexの初回／限定是正はいずれもCode Mode言及error一件・未分類一件、八mentionは全零、turnCompleted true、commandExecution／fileChangeは零、source.txtはBASE、changedPaths空だった。Claudeは両回changes_requested・指摘一件を返した。新観測が欠測したのではなく、実errorが今回の有限語句に一致しなかった結果である。marker零をHost／起動／接続／権限問題の不存在へ解釈せず、実故障の原因・段階は引き続き未確定とする。単に同じ広いE2Eを再送したり、推測で権限・Imageを変える根拠にはならない。生Provider出力・エラー本文は保存していない。

HTTPは59要求すべてheaders受領・最長12.696秒、transportFailure nullで、今回も15秒超過は再現しなかった。四Provider境界すべてでProcess完了／終了、Container・Network不存在、cleanup true・技術一次失敗nullを観測した。Taskのcleanup true・Owner close true・runtimeClean／workspaceClean true・Recovery参照空。既存Docker inventoryは保全され、標準NetworkのID差だけを既存比較が区別してverifiedとした。標準Networkは今回清掃の対象にしない。

試験mainは前回同様、二mode成功集合を満たさず`fixture_root_or_removal_unconfirmed`で物理Rootの自動削除を停止した。清掃前の再確認ではoperations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは零、同Taskはsettled／blocked・Owner世代null・cleanup true・回復参照空だった。Gitは自己Root一Worktree・mainだけで、追加Candidate Branchや共有Git先はなく、元の合成dirty／stage／未追跡を保全している。試験Node不存在・稼働Container零、空のLease領域を確認。全35通常File・36Directoryはlinkなし、全File nlink 1、内容Hash `3cfb8a3a22e6ef9d77ad2a5eade2676ceaba88677fc2bd85cd524cce08a44395`で記録し、この自己生成Rootだけを承認済み清掃対象とする。過去保持物は調査・清掃対象へ広げていない。

その後、Rootと既知祖先の非reparse・全七十子entry・既知属性集合を再照合し、今回Git objectのReadOnlyと空`.git` DirectoryのHiddenだけを解除して、通常Fileと空Directoryを個別削除した。force／再帰削除・ACL修復を行わず、Root不存在を確認した。今回の物理残存は零であり、Docker再起動・Image更新・過去保持物操作は行っていない。今回の有限分類では原因特定に十分でなかったことを保持し、追加実AIは停止したまま、次は固定版のerror定型と既存観測点の照合を先に行う。

#### 固定CLIのWarningとerror itemの意味の再確認 — 2026-10-29

固定配布Commit `6aaac694803004a63c6f393d153c96d22521a6b9`の公開SourceをGitHub接続で読取り確認した。内部Source・認証・実Repository本文は外部へ送らず、公開Repository・Commit・Source Pathだけを照会した。AI再送・Docker照会／操作・Image更新・過去保持物操作・製品実装変更は行っていない。

重要な訂正として、固定版[JSONL出力](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L409)の`collect_warning`は、Warningを`item.completed`の`ErrorItem`へ変換する。ConfigWarningも同じitem型へ投影し、いずれもCodexStatusはRunningを維持する。従って`itemErrorCount`は実行故障の件数ではなく、警告を含み得るJSONLのerror型item数である。過去段落と会話で「Code Mode実行エラーが編集を止めた」と因果を読ませた説明は、現在の観測では確定できないとして訂正する。編集／File変更が成立せずレビューが拒否した事実は維持する。

[固定版features](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/features/src/lib.rs#L1198)は`code_mode`／`code_mode_only`をUnderDevelopmentとして登録し、同Fileの`unstable_features_warning_event`は明示有効化された開発中機能を列挙する警告を生成する。CRDDの編集計画は両者を明示有効化し、助言計画にある`suppress_unstable_features_warning=true`を持たない。この警告は、現在の八語句分類に一致しないままCode Mode件数に一致し得る。正式parserへ同版の警告形式を合成入力して、confirmed・総数一・Code Mode一・未分類一・全mention零になることをassertした。今回の保存観測と同じ値になる反例であり、今回の実messageがこの警告と同一だと復元した証拠ではない。

もう一つの[モデル対応警告](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/session/code_mode_warning.rs#L5)も同じ合成投影となる。ただし固定同梱[models.json](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/models-manager/models.json#L177)のGPT-6.1 Solは`tool_mode=code_mode_only`を持つため、同梱定義だけを前提にその警告が発火したとは判断しない。実行時に取得したModel metadataは今回照会しておらず、モデル非対応を原因にしない。

[Host接続](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/code-mode/src/remote_session/connection.rs#L158)の固定Sourceは、通常の子Process生成とhello／handshakeを分け、具体的なHost起動・接続失敗はその定型を持つ。Host spawn自体をCRDDの名前付きコマンドsandboxへ通す処理ではない。gRPC接続の別実装もあるが、固定Featureの既定はfalseでCRDD計画にもその有効化はないため、過去の非AIprotocol試験と本番protocolが異なるとはこの調査から断定しない。Host読取りallow追加やgRPC切替は是正として採用しない。

次の最小案は、既存error item解析で固定版の既知Warning文面とのexact一致を非秘密の補助件数として追加することである。JSONLで元通知種別は失われるため、この一致だけでWarning由来又は非故障とは確定せず、既存itemErrorCount・未分類件数から除外しない。未知itemを成功又は警告へ丸めず、生本文を保存せず、単に警告を非表示にして解消扱いにもしない。新Manager・Log・Stateは不要である。Warning通知と同じmessageの通常ErrorItemの区別不能も非AI反例として固定してから、編集未成立そのものの観測・指示・結果契約を再評価する。同じ広い実AI E2Eの追加再送は、今回の確認には含めない。

#### 既知警告文面の補助一致と非AI確認 — 2026-10-29

人間の継続指示に基づき、既存観測へ`itemErrorKnownWarningTextCount`一fieldだけを追加した。固定CLIの開発中機能警告とModel Code Mode対応警告について、可変部分を限定した全文テンプレート一致を4096 UTF-16 code unit以内・改行なしで判定する。本文・Path・Model値を返さず、元通知がWarningか通常ErrorItemかを断定しない。総数・Code Mode件数・八語句分類・未分類件数は従来どおり独立保持し、一致を減算・非故障・Task成功へ利用しない。

Executorの同じ閉形式検査へ新fieldの0〜総数・safe integerを接続した。新field欠測の直前形式、語句分類導入前、従来0.149の既知形式も、それぞれexact集合のまま受理し、欠測を零補完しない。利用側の期待値と有限代役、正式parserから段階診断までの結合を追従した。固定文面・前後の余分文字・大小文字差・改行・未知本文・message欠測・上限超過、同じ文面を持つ通常ErrorItemとの区別不能、総数・未分類の非減算・秘密風値の非搬送を反証した。Architecture／Qualityの説明もerror型がWarningを含み得る意味へ訂正した。

AI Adapter全28件、Executor全15件、Coordinator Task Runtime全157件、利用側の結果正規化／診断三十件が、それぞれ別runで全成功した。初回局所三Suite三十七件とは重複を合算しない。四Package型検査、変更六Sourceの整形・警告を失敗とするLint、diff checkが成功し、独立Sourceレビューは残指摘零。新しい公開関数・Manager・Log・State・Registryを追加せず、実行許可・採否・権限・Timeout・Image・清掃条件は不変である。

この変更は診断の意味の誤認を避けるための補助であり、旧実messageを復元した結果でも、編集故障の解消でもない。AI再送、Docker照会／操作、Image更新、過去保持物操作は行っていない。

#### 編集未成立の入力と結果契約の非AI照合 — 2026-10-29

既知Warning補助の追加後、実AIを再送せず、現在の指示・Path・Mount・正規化のSource接続を確認した。Workbenchの固定依頼はTask objectiveへ入り、`readPaths`は`PROJECT_CONTEXT.md`にallowedPathsを加える。Task PacketはExecutorへ/work内・allowedPathsだけの編集、利用可能なFilesystem／Shell・Python／POSIX text Toolの使用、実File確認を指示する。Executor計画はexecutor役割でread_write、Docker計画も/workへRW bindし、Gitと内部状態だけをROで保護する。今回Sourceの確認範囲で、ExecutorへReviewerの読取り専用指示やread_only Mountが混入する接続漏れは見つかっていない。ただし現在のSource照合を、過去の実Container全構成の再観測やAIによる入力理解の証明にはしない。

結果の意味は二層に分かれる。`codex-executor-result.json`とPacket指示は`status=completed`の形を指定し、変更がなければchangedPaths空を許可する。Executor `result/normalization.ts`はsummaryの形式を検査するが、上位へはstatus・changedPaths・verificationCountと有限技術観測だけを渡し、summary本文は返さない。従って「変更不要」と「Toolが利用できず変更できなかった」をsummaryだけに書いた二つの合成結果は、同じcompleted／変更零の正規化結果になる。正式公開normalizerへ二入力を渡して両方confirmed・正規化結果のdeepEqual・summary不存在を非AIでassertした。これは説明が失われる境界の確認であり、今回の実summaryがどちらだったかの復元ではない。

このSchema受理はTaskの目標達成や採用を意味せず、実Fileと独立レビューが別に検査する。今回もレビューは拒否しており、このSource照合を成功判定の緩和、全noopの拒否、新しい失敗State又はRecovery追加の根拠にしない。現時点で編集未成立の原因は未確定のままである。

次の調査案は、同じ広い四段E2Eを繰り返したり説明語句のcounterを増やす前に、一回の合成Executor診断に限って、既存構造化結果のsummaryを正規化で捨てる直前に確認する方式を検討することである。Provider生JSONL・資格情報・生stderrは対象外、summaryも未信頼のProvider申告として実故障の証明と分ける。ただしこれは現在の自由記述非公開境界を一時的に変更するため、実装・表示・AI送信へ進む前に、exactな確認先・UTF-8 byte上限・送信内容・回数・回収条件、同一Attempt／Recovery相関、改行／制御文字拒否、認識済みSecret検査不成立時の非表示、端末・Log・診断・Fileへの非保存と終了後の参照破棄を具体化し、人間承認を得る。表示先自体が履歴を保持する場合に「メモリだけなので非保存」とは扱わない。別Attempt・秘密風値・検査例外・上限超過は表示零／保存零を確認する。方式は未確定であり、今回の指示から非公開境界変更の許可は推定しない。製品コード・成功条件・権限・Timeoutを変更せず、AI再送・Docker照会／操作・過去保持物操作は行っていない。

#### 試験限定summary確認の構成候補 — 2026-10-29

既存`createProviderExecutor`のHost契約と単独試験入口を確認した。元Provider stdoutはExecutor内部の`acceptOutput`でだけ正規化され、試験Hostにもsummary本文を渡す既存callbackはない。従って本番APIの無条件拡張、有限診断への自由記述追加、HostやDocker起動の複製は採用しない。NodeのModule試験機能は既存Executor試験で使用しているが、summary観測に流用できることはまだ非AIの接続確認が必要である。

最小候補は、検証Tool専用の新品子Processで、対象consumerをimportする前に元normalizerを呼ぶ薄い観測を置く方法とする。元関数へ同じ引数を一回だけ渡し、同じ返却object又は同じ例外を返す。元がconfirmedの時だけ同じrawを既存公開Parserで再解析し、最初のCodex／executor呼出しからsummary候補一件だけを確認する。normalizerの引数にはTask／Attempt／Recovery IDがないため、このseam自身がexact identityを検証したとは表示しない。同時Task一件・専用子Process・呼出順による限定結合であり、identityは外側の既存Task lifecycle結果から別に確認する。本文は元Task終了と外側結果・観測順の確認後にだけ表示可能とし、異なるTask・並行Task・role／provider順序差・呼出し欠測又は予期しない重複は表示零へ閉じる。既存の限定是正に伴う二回目Executorのsummaryは取得・表示しない。

認証・同意・Authority・Process・取消・回収・採否は代役化しない。再解析・Secret検査・表示が失敗しても元return object／例外を変えず、観測側だけ固定理由へ閉じる。Module観測を含むため、この結果を通常Source無計測のE2E成功とは表示しない。元normalizer throw、再解析／検査throw、呼出し零・余剰・順序差、二Task並行、元結果・清掃不変を非AIで確認する。観測復元は専用子Processの終了まで確認し、mock.restoreだけから既読consumerの復元を推定しない。新しい製品公開API・永続State・Log・汎用hook Frameworkは作らない。

実行候補は新品合成RepositoryのDirect一Taskだけとし、Isolatedへ自動進行しない。合成Context・source.txtの固定一行編集指示・合成差分だけを送り、Codex GPT-6.1 Sol mediumの編集とClaude Opus 5.5 mediumのレビュー、既存限定是正一回・再レビューを含め最大四Provider起動とする。単段だけを見てTaskのOwner／レビューを迂回する経路は作らず、Task全体再試行はしない。既存固定Imageと通常同意・隔離・Home排他を使用し、今回自己生成したRoot／資源だけを同じID・内容・停止の確認後に回収する。Docker再起動・Image更新・過去保持物操作は含めない。

表示は最初のCodex Executorのsummary一件だけ、UTF-8最大2048 byte・単一行・制御文字とPath表現拒否・既存認識済みSecret検査成立を条件とする。欠測・上限超過・検査例外・相関不明では本文を表示せず、固定理由だけを残す。切詰めや伏字で許可条件を満たした扱いにしない。本文をFile／自動Log／耐久診断／公開APIへ保存せず、元JSONL・stderr・資格情報は表示しない。判定に使った本文の参照は確認後に破棄する。表示してもProviderの未信頼な申告であり、OS／Host故障の事実へ昇格しない。

従来の「端末も含め非保存」をそのまま満たす案ではない。普段の外部端末へ表示すれば、端末を閉じるまでスクロールバックに残り、利用者側の記録機能があれば別途保存され得る。この残存条件を明示して人間が受容した場合だけ、端末への一回表示を限定例外とする。Chatや結果JSONへ本文を貼らせず、確認後は利用者に原因候補の要約だけを返してもらう。例外を受容しない場合は本文表示をしない。専用Viewerや新しい一時GUI基盤で回避する実装は追加しない。

上記は承認候補の具体化だけであり、summary観測の実装・本文表示・AI送信は未実施。方式の非AI成立を確認できなければ実AIへ進まず、別の製品hook追加へ自動拡張しない。

#### 試験限定summary確認の実装・非AI確認 — 2026-10-29

人間の限定承認を受け、Executorの試験用観測とWorkbenchのDirect専用入口を接続した。製品公開API・結果正規化・採否・Timeout・保持／回収条件は変更していない。既存normalizerを同じ引数で一回呼び、元返却object／例外を維持する。最初のCodex説明文だけを検査済みメモリ値として保持し、元Task終了・実行資源cleanup・外側相関・試験物処置結果・結果記録成功を確認後に端末へ一回表示する。故障証拠フォルダの保持と実行資源cleanupは区別する。本文の自動保存・自動Log・公開結果への追加は行わず、端末scrollback残存だけが今回の受容範囲となる。

非AIで、検査拒否・検査例外・表示例外・一回表示・二回目Executorの非採取・欠測／余剰／別role／複数Task・処置欠測・結果書込み失敗・安全保持を確認した。新品Node子では実Controllerと有限Commandを使い、Codex編集→Claudeレビューの正規normalizer接続、九purpose順序、各cleanup一回、子終了を確認した。未承認／非対話端末は64で拒否する。HTTPを含む試験Tool回帰16件、構造化結果と診断30件が成功し、Executor／Workbenchの型検査が成功した。独立レビューの2指摘（処置結果の確認不足、接続試験の到達不足）は是正し、再レビュー残指摘0。実AIは本項記録時点では未実施であり、通常無計測E2E成功へ換算しない。

次の実行は承認済みの新品合成Direct一Taskだけとし、Codex gpt-6.1-sol／mediumとClaude claude-opus-5-5／medium、既存限定是正込み最大4段を維持する。Isolated・自動再試行・Docker再起動・Image更新・過去保持物操作へ拡張しない。端末の通常送信同意は引き続き利用者が入力する。

#### Direct説明文診断の実測結果 — 2026-10-29

承認済みの一回を新品領域`.crdd/tests/workspace-ai-SzDdsl/`で実行し、人間申告の終了値は`DIAGNOSTIC_EXIT=2`だった。Isolated・自動再試行・Docker再起動・Image更新は行っていない。Requestは`request-dcd0b3e3-3921-415c-bde4-bfb05c050433`、相関は`operation-42241c65-0037-4f74-be78-209d58c3b9e2`。Codex初回とClaude初回レビューの2段結果を観測し、Claudeはchanges_requested／finding 1。是正Codexは準備後の取消境界だけがあり、Provider作成・開始・完了は未観測だった。

一次失敗は状態GETの`headers_unobserved`／15秒Timeout。該当Client ordinal32は発行1793279607327、応答Header未受領、期限確定1793279622338（15011ms）、終了1793279623063。対応Server ordinal32の受信観測1793279622788はClient発行から15461ms後、応答終了1793279623062（受信後274ms）。Owner状態照会は受信後19msで終了した。この区間はServer受信観測以前の待機が支配的だが、Client送出・接続待ちとServer event loop待ちの内訳は既存時点だけでは断定しない。Timeoutを延長せず、同じTaskの取消を行い、status cancelled／phase settled／cleanup true／Recovery参照0で終了を確認した。

Codex初回はturnCompleted true、error型1件、CodeMode語句1件、既知警告文面一致1件、command／fileChange 0件、候補Path 0件。既知警告文面一致は警告由来やHost故障の確定には使わない。合成sourceはBASEのまま。段階結果2件と終了境界3件（未開始の是正段を含む）が一致しないため、今回の説明文表示Gateは不成立となる。本文は保存していないため後から復元せず、説明文による原因確認は未完とする。通常無計測E2E成功へ算入しない。

初回2段と未開始是正段の全境界でProcess終了・Container不存在・Network不存在・cleanup true。Task Owner／HTTP Client終了、排他取得と解放の同一Owner相関、operations／pendingDeliveries／unresolvedRecoveries／leaseIntents各0を確認した。既存の合成queue-a／queue-bとready定義は未起動のfixture入力であり実行中ではない。Dockerの現況に今回資源はなく、既存停止Container2件は不変更。標準bridge ID差は既存比較でverified、追加利用者資源なし。試験フォルダは成功成果条件を満たさず自動保持されたため、Front AIが今回Rootだけの安全清掃を確認する。清掃前inventoryは35 File／36 Directory／89291 byte、全File nlink1・Reparseなし、inventory SHA-256 `c53e7f1e4fafb61bb69b93846d225ece9712785cc4035f79703240e2a4ff69b6`。過去保持物は操作しない。

今回Rootの清掃は完了した。実行Node PID35584と同試験を参照するNodeの不存在、Git worktreeが合成main一件だけであること、元dirty／stage／untrackedとBASEの保持、リンクなし・File単一linkと上記inventoryを確認した。35 Fileを個別削除し、自己生成Git objectのReadOnly属性と空の`.git`のHidden属性だけを解除して、36 Directoryを空確認後に削除した。Root不存在を再確認済み。ACL・製品Git履歴・認証・過去保持物・既存Docker資源は変更していない。

#### HTTP受信前待機の非AI切り分け — 2026-10-29

対象は検証Toolの実装詳細とQualityの観測根拠に限定した。着手前に同一Taskの取消・子close・Server終了・本文非保存、HTTP15秒／Workspace60秒、公開API不変更を既存Source／Workbench設計へ照合した。実装・技術品質の独立レビュー、文書の直接伝播・リンク確認を行い、製品機能・決定権限・準拠基準・Releaseを変えないため全体準拠監査とRelease判断は発火させない。AI送信・Docker照会／操作・過去保持物操作は今回行っていない。

既存Client frameへ要求生成とHeader送出直前の時刻を追加し、同じrequest objectだけを相関させた。送出直前は送達証明ではない。Serverを所有する検証Processには短命Timerの最大遅延一区間だけを加え、同期I/O・CPU・OS待ち等の原因断定とは区別した。欠測null、時刻範囲・因果順序・余分field拒否、終了時の同callback購読解除・Timer解除を維持する。新しい保存・監視Process・Worker・Queue・Recoveryは作っていない。

新品の独立HTTP Clientと合成loopback Serverで、Server側だけ1.5秒停止してもClientは送出直前へ進むこと、送出直前→Server受信300ms超、Timer遅延1000ms超を確認した。これは非AIでの因果反例であり、以前の15秒Timeoutの同一原因証明ではない。親22秒停止＋独立Serverでは子HTTPが15秒以内に成立する既存反例も維持した。過去実測には新しい時刻がないため、過去原因の確定や本文の復元はできない。

最終候補のClient／HTTP試験24件は全成功（58.85秒）。型検査・変更5 FileのLint／整形・diff検査も成功。独立レビューのMinor2件（応答Headerが送出前となる逆順拒否、購読解除の試験代役不足）を是正し、局所3件と全24件を再確認、再レビュー残指摘0。変更対象は検証Toolだけであり、本番Coordinatorの修正完了・実AI編集成功・過去故障の解消とは表示しない。次の実測を行う場合は既存の実AI送信承認を別に確認し、無断再送しない。

#### 新HTTP診断付きDirect一回の実測 — 2026-10-29

人間の再承認後、Engine29.8.1／稼働Container0／既存固定Image3件を読取り確認し、非AIの観測2件と閉形式3件を再確認して、新品`.crdd/tests/workspace-ai-WVzi8a/`のDirect一Taskだけを実行した。Requestは`request-ea3ddf6b-93d0-4e07-a353-a3e727b7aa34`、相関は`operation-4f24f13a-a5bd-44e0-ae82-6a78aa904fc3`。Codex gpt-6.1-sol／medium、Claude claude-opus-5-5／mediumで編集→レビュー→限定是正→再レビューの4段が終了した。Isolated・Task再試行・Docker再起動・Image更新は行っていない。

人間申告は`summaryInspection.displayed=true`／`summary_displayed_after_task_close`、`DIAGNOSTIC_EXIT=2`。説明文の限定確認は成立したが、未信頼のProvider申告は実基盤故障の確定根拠にしない。本文を本記録・File・自動Logへ複製せず、表示済み内容は端末scrollbackの限定受容として扱う。機械的なTask結果はblocked／`coordinator_task_independent_review_not_approved`。Codex両回とも候補Path0、command／fileChangeイベント0、turnCompleted true、error型1件／CodeMode語句1件／既知警告文面一致1件。Claude両回ともchanges_requested／finding1。合成sourceはBASEのままであり、編集E2E不合格は維持する。

HTTP58要求は全Headerを受領し、transportFailureなし。最大Header待機はordinal25の14574ms。Client開始1793280792218、要求生成1793280792230、送出直前1793280792234、Server受信1793280806526、応答終了1793280806787、Client Header受領1793280806792。送出直前→受信は14292ms、受信後応答261ms、Owner照会16ms。受信前の待機が支配的と分かったが、送出直前は送達証明ではない。Server側Timerの最大遅延は別の時間帯（expected1793280889033／observed1793280903567／delay14534ms）で、同区間に重なるClient要求は記録されていない。Server処理停滞の存在とHTTP最大待機の直接因果を同一視しない。今回Timeoutがなかったことも過去故障の解消証明ではない。

全4段のProvider作成・開始・終了とProcess終了・Container不存在・Network不存在・cleanup trueを観測。Taskはphase settled、Recovery参照0、secondaryFailure0、operations／pendingDeliveries／unresolvedRecoveries／leaseIntents各0、同Ownerの排他取得・解放が相関した。試験Node PID37016と同試験参照Nodeの不存在、合成mainだけのGit worktree、元dirty／stage／untracked保持を確認した。Docker現況に今回資源なし、既存停止Container2件と利用者Networkは不変更、標準bridge ID差だけを既存比較がverifiedとした。成功成果条件未達で自動保持された今回Rootを、既存の人間承認に従いFront AIが清掃する。事前inventoryは35 File／36 Directory／119732 byte、全File nlink1／Reparseなし、SHA-256 `52a6faa9e7422b61841e2bf3acda848905dce09bfa93773634eb5b7a646a06f4`。過去保持物は対象外。

今回の35 Fileは個別削除し、自己生成Git objectのReadOnly属性と空の`.git`のHidden属性だけを解除して、36 Directoryを空確認後に削除した。`workspace-ai-WVzi8a`の不存在を再確認済み。ACL・本体Git履歴・既存Docker資源・認証・過去保持物は変更していない。追加再実行はしていない。

#### 実編集と成功済み非AI試験の起動条件照合 — 2026-10-29

今回は読取り調査と純粋な計画生成・既存試験だけを実施し、AI送信・Docker照会／操作・過去保持物操作・製品Source変更は行っていない。現行`planProviderExecution`へgpt-6.1-sol／medium／executorを渡し、成功済み固定commandと同じpermissions三設定（root deny／minimal read／workspace write、network false）、作業場所`/work`、stdin入力、code_mode_only・Host有効／fallback禁止、shell／unified_exec有効をassertした。AI Adapter回帰28件成功。実編集入力のexecutor指示は編集とPython／POSIX Toolの利用を許可しており、助言用のTool禁止指示を渡す構成ではない。

| 観点 | 成功済み非AI確認 | 実AI編集 | 残る確認 |
| --- | --- | --- | --- |
| 固定実行物 | 同じTask Image／CLI0.164.0／Host | 同じ固定Identity | 別版・別Imageの差を示す根拠なし |
| 外側隔離 | UID65534・RO root・cap-drop・no-new-privileges・seccomp・pids64 | 同じ固定方針 | 同時Process／補助Threadの総量は未計測 |
| 内側権限・作業場所 | 三permissionsと/workで固定Pythonの作成・読戻し・削除成功 | 同じ三permissionsと/workを計画 | 実AIによるTool委譲と同じ経路の成功ではない |
| 起動順 | Host単独の固定計算、CLI sandbox→固定commandを別々に確認 | CLI→Host→Code Mode→nested Tool→sandbox | 接続・委譲のどこが未成立かは不明 |
| 入力・承認 | 固定commandを直接指定。Model・自動承認・JSON結果Schemaなし | stdin Task Packet、Model選択、approve-for-me、結果Schema | 明示的な構成差だが、不具合の確定ではない |
| Home・通信 | 空Home・network none・認証なし | 既存認証Homeと限定Proxy | 非AI確認から本番Home／Proxyの成立を推定しない |

固定版公式Source Commit`6aaac694803004a63c6f393d153c96d22521a6b9`を追加確認した。[CLI起動](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/arg0/src/lib.rs)はTokio multi-thread、[Host起動](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/code-mode-host/src/main.rs)はcurrent-threadである。従って「両者が各々CPU数のworker poolを持つ」という単純仮説は採用しない。補助Thread／子Processを含むpids64不足は未証明であり、上限引上げの根拠にはしない。

[固定JSONL変換](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/exec/src/event_processor_with_jsonl_output.rs)の`map_item_with_id`はCode Mode cell／Toolの全面投影をせず、対応外をNoneにする。[Code Mode実行](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/tools/code_mode/execute_handler.rs)の開始・初回結果失敗はモデル向け`RespondToModel`へ返る。そのためcommand／FileChange零や既知警告一致だけで、Host未起動・Code Mode未発火・具体故障原因を証明できない。新しいcounterの追加、権限・期限・Image変更は採用しない。

調査結論の独立レビューは限定Pass／残指摘0。次の候補は、同一cgroup内でCLIとHostを独立二Processとして同時稼働させる非AIの資源観測であり、実行は未承認・未実施。共存成功をCLIによるHost解決／spawn／handshake／Tool委譲の成立とは扱わず、離散samplingで瞬間peak不存在や本番最大資源量を証明しない。実施するなら開始前・両者稼働時・終了後のpids current／max／拒否counterと元PID終了を相関し、秘密なし・network none・固定Image・pids64を維持して、一回の試験物だけを回収する条件を別途固定する。

#### 非AI CLI／Host共存試験の実行前固定 — 2026-10-29

人間が同時稼働一回と今回物回収を承認した。対象Rootは`C:\project\CRDD\.crdd\tests\codex-cli-host-coexist-20261029-01`のみ。現行固定Codex Task Imageでnetwork none、UID65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64を維持する。inputだけRO、空work／home／tmpはRW、work内.git／.crddに空guardsをROで重ねる。認証・Repository本文・Proxy・外部AIは使用しない。製品Source・設定・上限・Image・過去保持物は変更しない。

用途固定probe SHA-256 `404601768eef123d72794a05fbf8f34c8ea75dc94c244176e4fe23574819c795`。CLI argvは現行公開Planのgpt-6.1-sol／medium／executorから生成した全argvとexact一致した。stdinへ一byteも渡さず独立CLI Processを保持し、独立Hostへ公式V1 protocolのhello／open／固定計算`text(String(1 + 1));`／shutdownを送る。空EOFによるCLI exit1＋入力なしmarker、Host計算2＋EOF／exit0、元Process終了、pids current基準復帰・拒否counter不増・既知resource error未観測を共同確認する。30秒、stream各64KiB、Host16frame、各元Process groupへ必要時TERM一回と5秒の終了確認。失敗は再試行しない。生出力はメモリ処理だけで、有限段階・数値・元PID・終了値だけを残す。

局所の正常／不正結果3負例、資源観測の正常／欠測・残存・拒否counter・既知error4負例、全argv一致を確認。独立レビューの終了Gate不足を是正して、再レビュー残指摘0。同一cgroupの独立二Process共存だけを評価し、CLIによるHost解決／接続／Tool委譲、本番最大資源量、離散samplingによるpeak不存在へ主張を拡張しない。Engine29.8.1・固定Image存在・稼働Container0、Root祖先の非linkを確認した。作成元IDの領収書と構成照合後に一回だけ起動し、未知ならその元ID／Rootを保持する。

#### 非AI CLI／Host共存の一回結果 — 2026-10-29

元Container ID`a4811f84b4566a8b6ede59cbfdfa4c1c6c5e876cf98fca4986f9d247c35a9d6a`を作成一回・起動一回で使用した。元ID領収書をRoot内で保存・読戻しし、固定Image、停止状態、UID、pids64、RO root、security設定、exact六Mountと起動内容を照合して起動した。開始2026-10-29T14:10:37.646573039Z、終了14:10:39.298950616Z、attach0、Container exited／exit0／OOMKilled false／Restarting false／RestartCount0。非AI結果はcompleted／reason null、Host固定計算と空stdinのCLI生存・元子終了・資源数基準復帰がすべて確認された。

| 時点 | cgroup pids.current | CLI Thread数 | Host Thread数 | pids.events max |
| --- | ---: | ---: | ---: | ---: |
| 開始前 | 1 | 未起動 | 未起動 | 0 |
| CLI生存 | 36 | 35 | 未起動 | 0 |
| 両者生存 | 40 | 36 | 3 | 0 |
| 固定計算後 | 57 | 36 | 20 | 0 |
| 両者終了後 | 1 | 終了 | 終了 | 0 |

元CLI PID7はTask入力を一byteも受けず、空EOF後exit1＋既知の入力なしmarker、stdout0 byte／stderr30 byte。元Host PID44はhello／open／固定計算2／shutdown／EOF／exit0、stdout725 byte／stderr0 byte。生streamは保存せず、resource errorの既知語句観測false、childCloseConfirmed／resourceClosureConfirmed true。CLI自生成のSQLite・補助link等は空の試験Homeにだけ生成され、今回物として確認・回収する。取得した最大sample57は上限64の残り7を示すが、瞬間peakや実編集時の総量ではない。今回pids上限拒否がないことは、この独立二Process共存の範囲だけの結果であり、CLI→Host接続／Tool委譲・実AI故障の原因確定・上限変更の根拠とはしない。

Root Identity`1687905628:118500965196179391:1793282760398252300`は不変。回収前に全34 entry（通常File18・既知Linux symbolic link3・Directory13）の非link境界・通常File nlink1・bytes／Hash、既知link targetが同梱CLI exact Pathであることを確認した。inventory SHA-256 `32a774c9e5c2bb6b00451b5a79c0273f214cd75bd749cab04c8d4c8c07d21c23`。workとguardsは空の保護Directoryだけで、未知の編集成果はない。過去保持物は不変更。元ID・停止・構成を再照合して通常rmし、今回Rootだけを非再帰・通常削除する。

今回のContainerは元IDで通常rmし、一覧照会成功・該当0で不存在を確認した。回収前照合のPowerShell式が正常な`CapAdd=null`を配列1件と数えたため一度停止したが、読取りで追加Capabilityなしと確認し、当該式だけnull判定へ修正した。実Container設定・製品コード・上限は変更せず、再試験もしない。既知Linux link3件はreparse tag0xa000001dとexact target確認後にlink自身だけをFile.Deleteし、通常File18件と空Directory13件を通常・非再帰削除した。Root不存在を確認済みで、今回の物理残存は0。CLI自生成DBも回収し、生streamやDBの複製は残していない。Docker再起動・Image更新・過去保持物操作は行っていない。

人間からpids64自体の必要性を再質問された。今回の承認は上限不変更なので値は維持したが、独立CLI＋Hostの固定計算だけでsample57まで達することから、64の適正性は別途見直す必要がある。PID上限による資源枯渇防止の目的と、64という固定値の妥当性を分離し、制限を置くことだけを安全性・実用性の成立根拠にしない。現試験ではpids.events拒否0なので実AI失敗の原因を確定せず、設定変更の採用と追加実測は人間判断へ戻す。

#### Docker独自PID上限の撤廃 — 2026-10-29

人間は固定64を別の大きな値へ置換する案ではなく、CRDDによるProcess／Thread数制限そのものの撤廃を採用した。AI実行・助言・認証確認・login・Proxy・診断の全生成経路から`--pids-limit`を削除し、inspectの`PidsLimit`を構成成立・回収の必要条件から外した。`-1`の指定、新設定、自動算定、監視、回復機構は追加していない。Docker／Hostが独立して持つ既定値や資源制約は変更しておらず、全実環境で無制限になるという保証ではない。大量Process生成によるHost資源圧迫の残存リスクはある。

Image・実ID・名前・label、非root、RO root、capability削減、no-new-privileges、seccomp、Mount、通信、Init、取消・回収の条件は維持した。Proxyの固定包装は21／23引数へ、診断入力上限は固定包装171＋payload256＝427引数へ追従した。24構成の全argvへ旧PID指定だけを試験内で復元すると旧golden Hashと一致し、他の包装・payload変更がないことを確認する。過去Evidence・保持物・既存Containerは変更しない。

非AI回帰の初回で、Proxy位置指定・期待値の追従漏れと、既存Engine試験の`node:fs`模擬がDomain側のnamed importへ未追従であることを検出した。前者は短縮後の位置へ修正し、後者は同じ模擬objectをdefault／named両方へ渡した。実Filesystemへ迂回させず、試験の拒否・回収条件は変更していない。

最終確認はDocker Isolationのformat／型／lint成功（既存の情報通知2件、warning／errorなし）、通常回帰291件成功・失敗0・実境界2件skip。Executorのcheck・17件成功。Coordinator通常／実Docker試験用の型検査成功、関連4Suite（認証create・回復再入場・Host移行・Process Controller）129件成功。独立レビューの試験位置漏れ1件を修正・再確認し、残指摘0。`git diff --check`成功。実Docker・実AI・Image更新・過去保持物操作は今回実施していない。これらの非AI結果を過去のCode Mode故障の原因確定、Direct／Isolated編集E2E成功とは扱わない。

#### PID上限撤廃後の一回編集E2E：承認と事前確認 — 2026-10-29

固定Sourceは`f748c8da8cf4a9faabdd1f6a44feeca1e796df26`。人間は新品合成RepositoryでDirect→成功時だけIsolatedを各一Task、Codex `gpt-6.1-sol`／medium編集とClaude `claude-opus-5-5`／mediumレビュー、既存限定是正一回・再レビューまで全体最大八Provider段を承認した。送信は合成Context・source.txt・固定指示・差分だけ。Task全体再試行、Docker再起動、Image更新、過去保持物操作は含まない。失敗時は次方式を開始せず同ID取消・終了確認と今回物の安全な回収だけを行い、確認不能は同じ回復参照で保持する。通常送信同意は対話端末で人間が入力する。

Engine linux 29.8.1・稼働Container零・既存Codex／Claude／Proxy固定Digest三件の存在を読取り確認した。既存created認証Container一件・旧exited Container一件と四Networkは基準観測にだけ使用し、操作しない。独立Source照合は残指摘零。非AI三Suiteは制限環境でloopback応答前の通信失敗五件（33成功／38件）を検出したが、Source・期限を変えず通常のローカル通信権限で同じ38件が成功した。失敗を隠さず、前者を実AI故障又はPID撤廃故障と断定しない。

新品`C:\project\CRDD\.crdd\tests\workspace-ai-qsjifi`の`--preflight`は終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、Directの既存dirty／stage／未追跡保全、Isolatedの候補固定・二親Merge・候補終了・Worktree／Branch回収が成立した。Docker前後差は追加／削除零・既存inventory保持・system構成一致、Source不変。両fixtureの回収Gateはeligibleで削除済み。引渡し用result.jsonと空親だけをFront AIの確認後清掃対象とする。実AIはこの事前確認に含まれない。

非AI引渡しJSONのSHA-256は`642cb90b819299423d0017458fdb2aea589f01eee6c1c98d8b881aa40bfe1abb`。exact Rootと通常Directory／File二entry、結果の両方式成功・回収Gate・Source不変を再照合し、このJSONと空親二Directoryだけを非再帰の通常削除で清掃した。`workspace-ai-qsjifi`の不存在を確認済み。

23:37 JSTに外部対話端末PID33576を起動し、通常の`--external-send-confirmed`一回を開始した。今回実AI専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-JDuqVH`。Sourceの起動引用符はEncodedCommand内で固定し、生出力の自動保存はしない。現在は人間の通常送信同意と実行終了待ちであり、成功・回収済みとは表示しない。

#### PID上限撤廃後の一回編集E2E：実結果と清掃判定の不整合 — 2026-10-29

人間申告は`E2E_EXIT=2`。再送はしていない。一方、元resultではDirect／IsolatedともlimitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、Task／execution completed、Claudeレビューapproved・finding零だった。各方式はCodex編集→Claudeレビューの二段だけ、全体四Provider起動で、限定是正は不要。Directは`DIRECT_OK\n`の10byteと既存dirty／stage／未追跡の保全を確認した。Isolatedは`ISOLATED_OK\n`の12byte、候補固定Commit `e1f3c70e93488cac512540d9ec906ef8ecd8b104`、二親Merge `72e6ec63e4aeb30184a1a366d8c196f8caaab43f`、候補終了・Worktree／Branch回収まで成功した。HTTP通信失敗なし、Header待機最大はDirect10000ms／Isolated13688msで、十五秒期限は変更していない。Source不変。

Direct Requestは`request-2b0656c9-7180-4710-add0-5570d513528f`、Isolatedは`request-89097feb-a8c6-47b2-b237-990a95bcf936`。四段ともProvider正常終了・Process Tree終了・Container／Network不存在・cleanup true。今回Docker資源の前後差は零で、既存created認証Container・旧exited Container・四Networkを変更していない。

終了値2の直接理由は両fixtureRemovalGateが`fixture_cleanup_unconfirmed`となったこと。公開Task Snapshotは成功時も`primaryFailure: coordinator_task_workspace_review_completed`を返し、試験Gateはnullを要求していた。`coordinator/src/task/requests.ts`のSnapshot構築が`primaryFailure: record ? record.reason : reason`として成功reasonを複写することを確認した。これをProvider故障、編集不成立又はDocker回収失敗とは扱わない。元報告の`fullE2eVerified:false`、削除失敗、終了値2は変更しない。正式入口の成功時primaryFailureと清掃試験の契約整合は未是正であり、次の最小修正候補とする。

通常File入口の既存Domain Readerで両Taskのsettled／completed・cleanup true・recoveryIds空と同Request履歴のcompleted／cleanup confirmed／primaryFailure nullを確認した。技術操作・未解決回復・配送待ち・Lease Intent・Workspaceは零。inline入口ではReader確認が不成立で、通常入口の初回は相対import誤りでEffect前に停止した。この診断上の失敗は製品故障へ読み替えない。

独立確認後、今回清掃だけのメモリ内投影として、元のreasonとprimaryFailureが同じ既知成功reasonであること、freshな同Request履歴がprimaryFailure nullであることを全件assertしたうえで、Task投影の当該fieldだけを正本から取り出した。元result.jsonは改変せず、既存assessFixtureRemoval本文・maintain／transfer・再読・Git／Lease／Root条件を省略せず再利用した。最初の別JavaScript実行領域での評価は配列prototype差で拒否され、同領域の未変更本文では両Gateがeligible／fixture_closed_and_unreferencedとなった。これを汎用例外・新しい回復機構・製品修正として追加していない。

元result SHA-256は`d8811a3e56fab154fa83d4f71f886ed224fe3aa846ae53530902fe0f3625a416`。今回Root全体は通常File74・Directory73、全File nlink1、symbolic linkなし、inventory SHA-256 `e381ff0125114beb89941bdac5553eb0c2d99f7e1aafcf677cb97f383e70abb3`。試験Nodeの終了とDocker基準復帰を再観測し、今回の合成Git・終了済み状態・非秘密結果・短命確認入口だけを清掃対象とする。過去保持物は対象外。編集成功と上限撤廃の時間的相関はあるが、この一回だけから旧故障の原因がPID64だったとは確定しない。

清掃時にexact絶対Root・全147entryの範囲・nonreparse・件数・元結果Hashを再確認した。ReadOnlyは今回合成Git objectの31Fileだけ、Hiddenは今回の空`.git`二Directoryだけと照合し、その属性だけを解除して通常File74件・空Directory73件を非再帰で個別回収した。`workspace-ai-JDuqVH`の不存在を確認済みで、今回の物理残存は零。ACL修復・force／再帰削除・AI再送・Docker再起動・Image更新・過去保持物操作はなし。元実行の終了値2と清掃判定の未是正事項は維持し、手動清掃を元試験の終了値0へ遡及しない。

#### 成功時primaryFailureの最小是正 — 2026-10-29

人間の継続指示により、`task/requests.ts`の公開view投影一箇所だけを変更した。公開statusと記録statusの両方がcompletedの場合だけprimaryFailure null、成功理由はreasonへ維持する。blocked／cancelled／unknown、記録欠測、公開側又は保存側の片側だけcompletedでは従来理由を保全する。回復参照・副次失敗・保存Schema・遷移・清掃Gate・HTTP期限に変更はない。新API・State・回復機構は追加しない。

PRL-UT-006へ製品view本文の境界行列を追加し、ERB-IT-021の本番Owner・実保存・HTTP子Client結合へ非null成功reasonと取消reasonの相関assertを追加した。初回の試験型検査で行列tupleの未確定要素型を検出し、値を変えずconst tupleへ追従後、両Package型検査、Workbench check、Coordinator変更Fileのformat／lint、局所二件が成功した。Workbench関連二Suite三十件とCoordinatorの公開契約・Owner境界・回復参照三Suite二十一件が成功。独立レビューは残指摘零。続く単発Taskの実保存回帰四件も成功し、自己生成Rootの不存在を確認した。差分検査も成功。AI再送・Docker照会／操作・過去保持物操作は行っていない。過去一回の終了値2を変更せず、今回の非AI確認を実AI終了値0の観測として扱わない。

#### 成功時primaryFailure是正後の同条件再確認：着手 — 2026-10-29／30

人間はcommit・push後の同条件再試験を明示した。修正と前回結果を`2fd35fb5ffa64f52667f7ff27fa96eedf8b6e5b5`でcommit・pushし、Sourceクリーンを確認した。前回と同じ新品合成Direct→成功時だけIsolated、Codex GPT-6.1 Sol／medium編集・Claude Opus 5.5／mediumレビュー、既存限定是正込み全体最大八段、一Task一回・失敗時再送なし、今回物のみ回収という範囲を維持する。Docker再起動・Image更新・過去保持物操作は行わない。

Engine linux29.8.1・稼働Container零と既存固定Image三件を読取り確認後、新品`C:\project\CRDD\.crdd\tests\workspace-ai-WLbiJV`で非AI事前確認を行った。終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、両清掃Gate eligible・fixtureRootsRemoved true、Git候補固定・二親Merge・候補終了・Worktree／Branch回収、既存変更保全、Source不変、Docker前後差零を確認した。result SHA-256は`df3deaf195784c65a126fd3561d742c9779e13f3dcf61d7c0d01949fc6d6bffb`。

23:59:44 JSTに外部対話端末PID31980を起動し、承認済み実AI一回を通常`--external-send-confirmed`で開始した。今回専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-Uvd2mD`。通常送信確認は人間が端末内で行い、確認コードや生出力は自動保存しない。現在は実行終了待ちで、今回の結果・回収成立は未確定である。日付境界をまたいでも同じ一回として扱い、新たな再送枠を追加しない。

非AI事前確認の引渡しJSONは、exact Root・全三entry・nonreparse・上記Hash・両成功と清掃条件を再照合後、File一件と空親二Directoryだけを非再帰の通常削除で回収した。`workspace-ai-WLbiJV`の不存在を確認済み。

#### 是正後の同条件一回：HTTP期限による停止結果 — 2026-10-30

人間申告は`E2E_EXIT=2`。今回Requestは`request-9811ef06-a7a9-4c71-8df3-2ea9229b62cd`、操作相関は`operation-b2c94137-b879-4deb-9425-d246d27a7306`。DirectのCodex編集は一段正常終了、source.txtは`DIRECT_OK\n`となり、changedPathsは一件で一致した。既知Code Mode警告一件を観測したがCommandは一件開始・完了・exit0、技術一次失敗なし。ClaudeはContainer作成・Process開始前に取消され、レビューとIsolatedは未開始。Taskの再送はしていない。

停止はobserveのGET21でheaders_unobserved／timedOut trueの十五秒期限。Client開始1793286053485、要求生成3497、送出直前3501、Server受信1793286068242、応答終了8501、Client期限終了8503（同じ先頭時刻桁を省略）。送出直前からServer受信14741ms、受信から応答終了259ms、Owner照会17ms。Server event loopの最大停止はexpected1793286053429→observed1793286068241、14812msでこの要求区間と重なる。受信前待機と処理停止の相関は観測されたが、占有していた処理・同期I/O・CPU・OS待ちの原因は未確定。前回のprimaryFailure混入／最終清掃判定とは別の停止であり、今回成功終端へ到達していないため実AIで修正済み清掃Gateの通過は未確認。

同ID取消後はTask／execution cancelled、reason／primaryFailureは`single_task_cancelled_after_effect_cleanup`、cleanup true、回復参照・副次失敗は空、Client／Owner終了確認済み。Codex・未開始ReviewerともContainer／Network不存在とcleanup true。今回Container追加／削除は零、既存二Containerは不変更。標準bridgeはID `c9ba8af9270f77fcd2631e4676351b4ae984bb6151bfa34c9ebdfbc7978ff72b`から`5b1b08c0cbbc017830bef0cc72f669ffbc383ba52a991d4501218dd8e4ee28fa`へ変わったが、比較では標準構成同一・既存利用者資源保持だった。変更原因は未確定で、標準Networkを回収対象にしない。こちらからDocker再起動・Image更新は発行していない。Source不変、原result SHA-256は`dbbe262002d74b4c588024d4d4cd13c39cb3bae2031ec7514fc4d5f95db3f4e0`。

今回の通常File入口で既存Domain Readerを用い、同Requestのsettled／cancelled・Owner世代null・cleanup true・回復参照空、履歴cancelled／cleanup confirmed、Lease取得・解放の同一対、未解決技術区画零・結果零を確認した。Gitは元Base・共有indexのstaged.txt・既存dirty／未追跡・Sourceの合成一行を保持し、main一Branch・自己Worktree一件のみ。既存maintainは一件を正式退役、transferは記録零、再読で未解決義務・履歴待ち・Lease証拠零と元二Queueだけへの復帰を確認した。元結果と終了値2は改変せず、今回物だけの物理清掃へ進む。過去保持物は調査・変更していない。

今回Rootの全通常File36・Directory36、全File nlink1・linkなし、inventory SHA-256 `1b7fb4757eb97e634f1a9f362e304fd79790eee01171d0a28e861ac711310363`を確認し、元結果Hash・exact Root・祖先nonreparseを再照合した。今回Git object十四FileのReadOnlyと空`.git`一件のHiddenだけを解除し、通常Fileと空Directoryを非再帰で個別削除した。`workspace-ai-Uvd2mD`の不存在を確認済み。今回の物理残存は零。追加AI試験・製品修正は実施していない。

#### 実AI編集とHTTP表示の検証分離 — 2026-10-30

人間は実AI実行確認とWorkbench画面確認の混在を解消する方針を採用した。着手前の独立照合で、既存公開APIだけで成立すること、元Owner・現在認可・二十分試験期限・取消・元結果・Domain照合・既存清掃Gateを維持する条件を確認した。変更分類は検証経路の責務是正であり、製品のTask Lifecycle・保存Schema・HTTP契約・十五秒期限を変更しない。Source／契約の独立レビューと変更意味に対応した非AI結合回帰を実施し、準拠基準・リリース条件の変更や実AI再送を対象にしない。

`verify-workspace-ai.ts`はWorkbench Server起動、画面全体GET、HTTP Client生成と定期状態pollを撤去し、同じ`openTaskSession`のstart／wait／cancel／closeへ接続した。Workspaceは公開`executeWorkspace`へ従来のcommand順・現在認可を渡す。Task用AbortSignalをWorkspace操作へ流用しない。Timerは開始前に設置し全分岐で解除、期限時は同じRequestを一回取消して終了を待つ。新Worker・Queue・公開API・Registry・Stateは追加しない。Toolの既存物理配置を理由に製品Package依存や公開境界は変更しない。

wait結果は本文を永続化せず元Ownerから取得し、freshなDomain Readerで同Root・Project・Request・Principal・Task／Attempt／Operation ID、settled、status／reason／cleanup／回復参照、Owner解放・Lease Intent終端を照合する。照会不能・不一致は成功へ補完しない。Domainの本文欠測は実行状態の不明を意味せず、一時本文のために新Storeを作らない。既存の最終清掃Gate・Git／Workspace／Docker inventory照合は省略しない。HTTP表示・受付・取消・応答喪失の既存非AI試験は別に維持し、過去のHTTP受信前停止の原因究明・修復済みとは表示しない。

新しい試験専用子`workspace-package-preflight.ts`では、AI開始を固定拒否しDocker一覧だけを合成代役にして、正式Toolの両方式を実Git・Domain保存・候補固定・二親Merge・候補終了・Worktree／Branch回収まで通す。成功後はresult JSON一致、exact tests親・prefix・実体・唯一entry・nlinkを照合し、引渡しFileと空親だけをunlink／rmdirする。外部AI・実Docker・過去保持物操作は行わない。

初回の39件回帰はSource／Fixture追従の途中で行列一件が不整合となり38成功・1失敗、追従後の固定候補では39件成功した。これを最終修正後へ流用しない。独立レビューで「wait結果の保存前に取消結果待機が失敗すると元結果・回復参照を失う」Moderate一件と反例不足Minor一件を検出した。元waitを先に保持し、同ID取消結果が確認できたときだけ更新、取消例外／別IDでは元結果と固定副次失敗を保持する順序へ是正した。開始の通常拒否、Task／Operation不一致、期限取消の例外／別IDの反例を追加し、局所行列とWorkbench checkが成功、再レビュー残指摘零。最終修正後の固定候補で三Suite三十九件が全成功した。Package直結の両方式事前確認では実Git・Domain保存・Merge・回収と引渡し親の不存在を確認した。Workbench check、差分検査、独立再レビュー残指摘零。実AI・実Docker・過去保持物操作は実施しておらず、新経路での実AI編集の再成立やHTTP実故障の解消は未検証である。

#### HTTP分離後の一回実AI編集：承認と事前確認 — 2026-10-30

人間は新しいPackage直接経路の一回を承認した。合成Context・source.txt・固定指示・差分だけ、Codex `gpt-6.1-sol`／medium編集→Claude `claude-opus-5-5`／mediumレビュー、Direct→成功時だけIsolated各一Task、既存限定是正一回・再レビュー込み全体最大八Provider段を維持する。Task再送・Docker再起動・Image更新・過去保持物操作は含めない。基準Commitは`2fd35fb5ffa64f52667f7ff27fa96eedf8b6e5b5`、そこへ最終非AI回帰・独立レビュー済みの未Commit差分を加えた候補であり、基準Commit単体の実測とは表示しない。実行Tool SHA-256は`323f595dae4f330ad33bae6b320d7c8f637f87f232761f862c97232d157e0881`。

Engine linux29.8.1・稼働Container零・既存三固定Imageを読取り確認した。新品`C:\project\CRDD\.crdd\tests\workspace-ai-TvLDzU`の非AI事前確認は終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、既存変更保全・候補固定・二親Merge・Worktree／Branch回収・両削除Gate・Source不変・Docker前後差零を確認した。HTTP Server起動・画面GET・pollは行っていない。引渡しJSON SHA-256は`a6e74aaca85d255280bf1e8187732ebd521b75ab061d474ca23fadfab57db06c`。

00:35:46 JSTに外部対話端末PID22988を起動し、通常`--external-send-confirmed`の一回を開始した。今回実AI専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-hiBbKw`。通常送信同意は端末内で人間が行い、生出力・確認コードをFile／Logへ保存しない。実行終了・結果・今回物の回収は現在未確定である。

非AI事前確認の引渡しJSONと空親は、exact Root・全三entry・nonreparse・Hash・両方式の清掃条件を再照合後、File一件と空Directory二件だけを非再帰の通常削除で回収した。`workspace-ai-TvLDzU`の不存在を確認済み。

<a id="workspace-direct-api-real-ai-pass-20261030"></a>

#### HTTP分離後の一回実AI編集：両方式の限定合格 — 2026-10-30

人間申告は`E2E_EXIT=0`。元resultの確認でも両方式limitedProbePassed／stateVerified／runtimeClean／workspaceClean／closeConfirmed true、Task／execution completed、primaryFailure null、回復参照・副次失敗は空だった。成功理由はreasonに残り、前回のprimaryFailure混入による清掃拒否は今回発生していない。各方式はCodex編集→Claudeレビューの二段だけ、全体四Provider起動であり、Claudeはいずれもapproved・finding零、限定是正・Task再送は不要だった。

| 方式 | Request ID | 確認結果 |
| --- | --- | --- |
| Direct | `request-9b02e429-e41c-4840-bd8f-19329aa8881e` | `DIRECT_OK\n`の10byte／Hash一致、changedPaths一件、既存dirty／stage／未追跡保全、同RequestのDomain終端相関 |
| Isolated | `request-f07bcba8-6536-417a-b7c7-7bc694b5208d` | `ISOLATED_OK\n`の12byte／Hash一致、Domain終端相関、候補固定・Merge・候補終了・Workspace回収 |

Isolated候補Commitは`da7753609dadec2caecdf772f2e02f4ae72cf083`、Mergeは`33dce3de866946266a5585e747e4ca783c4c84be`。固定Toolの実行時assertで二親相関、Candidate／MergeのTree一致、Worktree／専用Ref不存在を検査してからlimitedProbePassedへ進む。これら細部を結果JSONの専用field単独から推測したのではなく、実行Source不変と当該Oracle成立へ結合した確認である。四Provider段の境界診断は、正常終了・Process Tree終了・Container／Network不存在・cleanup trueを全て確認した。既知Code Mode警告は両Codexで一件ずつ残るが、Command開始・完了・exit0と編集成立が観測され、故障件数へ読み替えない。

両fixtureRemovalGateはexact一件ずつeligible／fixture_closed_and_unreferenced、fixtureRootsRemoved true、cleanupFailures空。Source不変で、Tool Hashは着手時の`323f595dae4f330ad33bae6b320d7c8f637f87f232761f862c97232d157e0881`と一致した。今回Node Processの終了を再観測済み。Docker一覧は既存二Containerのみ、今回物は残っていない。標準bridgeのIDは`5b1b08c0cbbc017830bef0cc72f669ffbc383ba52a991d4501218dd8e4ee28fa`から`f725e643d2eaf00fc4968cc7e1036616178414f90a723985ed297d0a8a4a2f3d`へ変わり、既存利用者資源保全・system構成一致として分類された。raw inventory完全不変とは主張せず、原因未確定の標準Networkは操作しない。Docker再起動・Image更新・過去保持物操作は発行していない。

元result SHA-256は`f00cf580f625cb09647cdde83941c2248eaede5be53c09d78b658d9af4247bef`。独立の結果相関レビューは残指摘零。結果自身のfullE2eVerified falseを維持し、今回の主張は承認済みの直接API版一回で両方式の限定Task・保存・診断・回収が共同成立した範囲とする。Workbench HTTP故障の修復、全CRDD QA、一般的な再現性、全機能E2Eへ拡張しない。残る引渡しresult.jsonと空親だけを内容・Root確認後に回収する。

引渡しJSONは、両Task／Domain相関・清掃Gate・Source不変・元Hash・exact Root・祖先／全三entryのnonreparseと唯一Fileを再確認後、通常削除した。空editと自己Rootは非再帰rmdirで回収し、`workspace-ai-hiBbKw`の不存在を確認済み。今回の物理残存は零。既存Docker資源・標準Network・過去保持物は不変更。

#### Executor単独の構造整理と確認範囲 — 2026-10-30

基準Commitは`bd881667`。先行の直接API版検証整理はこのCommitへ保存済みであり、今回の依頼にpushは含めない。対象はExecutor内部の責務配置と非AI確認で、Workbench／MCP／Coordinatorの機能拡張・実AI再送・Docker操作・過去保持物の処置は対象外とする。

変更分類は内部Refactorと検証配置の移管。正本はExecutor詳細設計・QA-000006・既存Test Catalog／Symbol、直接利用側はExecutor内Controller／Plan／診断ToolとRoot型利用側である。着手前の独立照合で、結果契約・拒否理由・元WeakMap・一回使用・consumerのIdentity結合・検証Toolのimportとmock URLを維持する方針を確認した。文書の整合と横断影響をレビュー対象とし、準拠基準の変更・Release判断・外部通信がないため準拠監査と実境界再試験は今回追加しない。

| 対象 | 処置 | 保持する保証 |
|---|---|---|
| result/normalization.ts | task.ts／advice.tsへ分割し旧ファイルを撤去 | Taskの編集・レビュー意味、助言の許可参照、契約値・改訂・理由 |
| 結果の共有型 | result/types.tsへ移管。共通の成否形は内部型照合だけに利用 | Root公開名・推論型・返却field。Runtime値を追加しない |
| Controller内の助言Envelope変換 | advice.tsへ移管 | AI Adapterの共通parseProviderResult、診断と失敗順序 |
| 共通文字列・byte上限 | 既存validation.tsの内部公開へ集約 | 条件・上限不変。Rootへ公開しない |
| 限定是正証拠 | task.ts内の一つのWeakMapで発行・消費 | 原本一回だけ、コピー・別object・再使用は拒否 |
| attempt/plan.ts／consumer | 維持 | 実行計画とTask Graphを混同せず、回復Identityを変えない |
| Controller本体 | 単一生涯を維持 | 開始・取消・join・清掃を行数だけで分割しない |
| 結果検査UT | 純粋なTask全件とAdvice三件をExecutorへ移管 | 安定Test／Symbol ID維持。上位Packet結合は旧Ownerに残す |

公開責務別の正常・準正常・異常・終了後条件と試験の対応は[QA-000006](../../../07_Quality/Definitions/QA-000006/quality_definition.md#executor単独packageの確認範囲--2026-10-30)に集約した。新しい検証Registry・State・Lock・Runnerは作成しない。Result coverageの実行入口はExecutorへ置き、Coordinator側は自分のRuntime／Packet試験だけを保持する。

先行の独立レビュー二指摘は、Controller終端試験を専用ファイル・Catalog／Symbolへ分離し、移管した結果coverage入口をExecutorへ移すことで是正した。製品契約・Root API集合・元証拠に退行は検出されていない。結果型の追加整理を含む最終39件・型検査・整形・Lintと再レビューを完了し、今回の単独非AI確認範囲は完了、残指摘零と判定する。現在、人間による判断は必要ない。

| 実行済み確認 | 結果と範囲 |
|---|---|
| Executor通常確認 | 型移管後の最終39件成功、型検査・整形・Lint成功 |
| Result coverage入口 | 22件成功。coverage値はロードした他Packageも含むためPackage安全性の百分率としない |
| Coordinator Runtime／Packet coverage入口 | 168件成功 |
| 直接影響する助言／Task Packet四Suite | 30件成功 |
| Controller既存全体Suite | 通常Windows環境で115件成功。制限環境では実子孫終了確認二件が不成立だったため、期限・判定を変えず通常環境で確認 |
| Workbench診断搬送の既存Suite | 14件成功。新しいWorkbench機能の成立とはしない |
| Catalog／Symbol | 台帳420件valid、SymbolのRepository／Domain指摘零 |
| 型利用側 | Coordinator・Workbench・MCPの型検査成功。機能拡張や通信試験とは区別する |
| 今回変更した四文書 | 対象文書自身の指摘零。参照先へ拡張された検査は538診断を含み全体Passとはしない |
| 全体文書検査 | 履歴を含む全体は3,721診断で不合格。今回のSource成功を全CRDD文書合格へ拡張しない |

実AI・Dockerは実行せず、既存の対象版付き実試験結果を保持する。今回生成した合成試験物の処置は各既存試験の終了条件に従い、過去保持物は操作しない。既存の実境界結果や模擬試験から、任意のOS／Provider故障の完全網羅を主張しない。

#### Executor Attempt内部の責務再配置 — 2026-10-30

基準は`7e4e8e9c`。人間が承認したcontroller／plan／preparationの重複解消・切出しを対象とする内部Refactorであり、実行機能・公開API・契約値を追加しない。関連正本はExecutor詳細設計とQA-000006、直接利用側はExecutor内の固定構成・Controllerと既存の検証入口である。

着手前の独立照合では、開始前Effect零、AuthorityとRecoveryの順序、同期通知の登録・失効、同Controlの取消とjoin、五清掃条件、exact回復参照、二時計と準備一回消費を維持する対象として固定した。移管するのは純粋な宣言と共有型に限る。状態・保存・資源・Lockは追加せず、私有Mapを別Ownerへ搬送しない。診断呼出しの時点、例外閉包、各検査の評価順序を維持する。

| 宣言／対象 | 処置予定 | 変更しない範囲 |
|---|---|---|
| Controllerの共有依存・Handle・Recovery型 | attempt/types.tsへ型だけ移管 | RuntimeState／ExecutionRecordとcontrolsはController private |
| isPlanValid | plan.tsの内部exportへ移管 | validatePlanのCommand再構成検査とは統合しない |
| 回復応答のSnapshot二関数 | result/validation.tsへ本文同値で移管 | exact key・元Home・Proxy／accessor・Capability条件 |
| 開始拒否／最終結果の純粋組立 | result/attempt.tsへ移管 | 五清掃条件、結果非公開と元回復参照 |
| 構成診断と受動Reporter | observation.tsへ移管 | 発行時点、同期例外／Promise拒否が実行結果を変えない条件 |
| planの用途別CLI再構成 | 同File内で重複を共通化 | mode別入力・解決順・固定Command照合・乱数取得順 |
| preparation | 一回消費と二時計は同じOwnerに維持。内部専用関数の不要なexportを除去 | 例外→固定理由、Task／Advice引数配置、失効・Mount解放順 |

状態遷移を伴うsettleInvalidRecoveryStartとcommandRestrictionAllowsはControllerへ残す。結果生成の移管先は純粋な値組立だけを所有し、Recovery管理や一般的な変換Frameworkにはしない。回復値の検査は過去unknownを更新せず、原本・コピー・欠測・観測不能を区別する。

必要な確認は移管宣言の本文同値・Root API集合維持、三modeの計画拒否、回復Snapshot反例、診断例外、開始拒否の共同条件と既存終端96組合せ、単独・直接影響回帰、文書整合と独立レビューである。準拠基準・Release判断の変更はなく、準拠監査と実AI／Docker再試験は追加しない。過去保持物と歴史的Evidenceは操作しない。現時点で追加の人間判断は不要である。実装・確認結果は本節へ追記する。

#### Executor通知の簡素化と生涯Ownerの整理 — 2026-10-30

人間は、Executorの内部通知についてobject原本照合・登録失効Map・照会APIを廃止し、信頼した固定構成のコールバックで情報を直接渡す方針を承認した。これは旧通知のコピー拒否・通知寿命照合という保証を廃止する変更であり、既存試験をそのまま形式的に通す変更ではない。外部HTTP／MCP入力を内部通知として採用する入口は新設しない。

着手前の独立照合では、要求前の同期保存Gate、現在Ownerの導出、intent_saved後だけの未発行確定、短期保存排他とfresh再確認、元回復参照、実資源清掃、Host解放と終端の共同条件を維持できる最小接続を確認した。新しいMap・Registry・Token・永続State・Lockを作らない。

| 通知 | 新しい接続 | 維持する条件 |
|---|---|---|
| Provider要求直前 | 既存回復Capabilityを固定callbackへ渡す | 既存操作記録から対象を導出し、保存・読戻し・排他解放後だけ要求へ進む |
| 要求前取消のnot_issued | 回復Capabilityと用途を固定callbackへ渡す | 専用保存入口だけがintent_savedから遷移可能。通常Writerからの任意変更は禁止 |
| 終端 | 元結果と閉じた終端観測を固定callbackへ渡す | 既存操作記録と既存終了Contextへ直接結合。別Mapへ置換しない。観測欠測では終了保存不可 |

終端callbackの失敗は技術結果を成功へ変更せず、保存側は終端材料欠測として停止する。操作の認証・認可・元ID相関と実資源の観測条件は残す。一試行の状態Ownerはexecute、構成と準備はpreparation、下位接続はisolation、状態通知はobservation、同じ試行の清掃はcleanupへ整理する。Controller／Planという別Ownerは増やさず、追加途中commandの括りも採用しない。実AI・Docker・過去保持物の操作は行わない。

#### Dの内容認可とMCP定義操作の限定接続

承認済みdevelopment権限に基づき、Access Managementの`repository/resolve.ts`へ要求内の`resolveRuntimeContentAccess`を接続した。既存の同じ短期Lock内で現在状態・資格認証・内容認可・保留材料・Repository実体を確認する。Domainの各I/O確認点では同じ改訂と元bytesのHashを照合し、認可・実体・manifestを取り直す。資格の高コスト照合は要求ごとに一回だけで、後続は同じ元bytesへの結合を検査する。次要求とのcache共有、TTL、Snapshot保持、新State／Lockはない。失効、同改訂本文変更、Role／Exposure変更、manifest変更、保留不成立、Root差、取消、Lock解放不明は許可へ変換しない。

MCPのCore定義二ToolをDomainの既存初期化・CRUD・Queryへ直接接続した。閉じた操作入力、既存CAS、対象Hash、結果のunknown・exact参照を保持し、AI起動・Queue・判断承認を行わない。実子ProcessでCoordinator／ExecutorのModule解決を拒否し、Tool単体の初期化・CRUD・再読取り・CAS拒否を確認した。ただしMCP Rootには既存実行Toolからの静的到達が残るため、Server全体のCore単独成立ではない。WorkbenchのCore公開接続、Executor実体移管、Coordinator任意化も未完了である。

初回の内容認可結合では同一要求内で資格照合が繰り返され、合成状態の初期化・保存・読取りは約37.6秒だった。同じbytesへの結合を保つ一要求一回照合に変更後、同じCaseは約18.7秒で成功した。この有限計測を任意環境の性能保証へ一般化せず、Timeout・安全条件を緩和していない。局所試験では資格照合回数、未対応操作／別ProjectのI/O零、上記の拒否条件を固定した。

現在候補のAccess Management全回帰は173件成功・不合格零。Core Tool三件も成功した。MCPの初回通常環境全回帰は105件中104成功・一不合格で、追加二Toolへの一覧期待数追従漏れだけだった。修正後の当該Case成功に続き、全回帰一実行でも105件成功・不合格零・取消零となった。両Packageの整形・型・警告を失敗とするLint、台帳410件、diff checkは成功。限定独立レビューはSourceと文書のMinorを是正して残指摘零。変更した五文書の指摘は零、参照展開先のbroken-link 266件は別範囲として残す。先行の制限環境ではLink作成とloopbackが拒否され、MCPの一実行を中断した。その実行を成功又は全試験物不存在とは扱わず、過去保持物の探索・清掃へ拡張しない。AI・Docker・過去Runtime／保持物を操作していない。

- AのFile別宣言群・Root公開73項目・静的利用側を棚卸しし、B／Cの具体Afterを提示した。続いて[Runtime Domain正本](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)にAPI入出力・単一保存・認可／CAS・一回性を具体化し、正式Architecture／Qualityへ接続した。宣言ごとの最終依存閉包、保存Schemaの全field対応と新識別子、五Contextのfresh確認搬送、実装接続は未完了。既存判断・根拠ID・局所受入を確認し、そのままDomainへ移す方針で、新しい非管理完了機能は追加しない。
- Eの保存先と手順、既存Workbench AI依頼の扱い、Plan確定と判断操作の現在認可は、該当実装へ入る前に具体例と影響を示して確認する。
- `AGENTS.md`末尾のProcess別試験名と現在のCoordinator package scriptsには名称の差がある。後続の試験入口を確定する際に照合し、存在しないscriptや省略による全回帰成功を主張しない。
- 直前の[Storage再編](coordinator-storage-ownership-plan.md)の初回全体回帰不合格・分割再確認と文書検査未合格は基準の品質制約として維持する。過去Evidenceを新Packageの成立根拠として改名・再利用しない。

Source移管を開始した。初回バッチは共有型七宣言、Planの閉形式・範囲検査、相対Path検査をDomainへ移し、Coordinator本番利用側を接続した。続いて複数Task公開受付と個別入力搬送、AI選択設定の型・検査・WriterをDomainへ移管した。設定保存先、保存Schema・実行状態値は変更せず、Objective受付契約は必須入力の追加によりv2へ改訂した。実行Snapshot WriterとPlan／Task／Decisionの一般CRUDは引き続き未完了である。既存属性で進める判断と、実装・合成検証後に保存切替を確認する順序は承認済み。

今回の限定回帰90件、Domain設定保存の実Filesystem結合11件、公開Objectiveの実保存・再入場10件、Coordinator依存境界6件は成功した。最初の設定保存実行はhardlink作成拒否により9成功・2失敗で、環境許可後に同じ安全条件の11件が成立した。最初の公開保存試験は中断で成功に含めず、後続の固定入口確認は10件成功。独立レビュー後は公開実保存試験へ二Taskの本番組立て・指示とPathの分離・同内容再入場時の再実行0・本文変更時の拒否を追加し、移管前後それぞれ10件成功した。閉集合検査の既存重複・追従漏れと、検証Tool内のraw保存Path二箇所を既存の名前付きPathへ是正し、横断16件・公開API二件が成功した。加えて固定I/OをDomainへ移し、故障注入二件を含む依存・閉集合回帰24件、状態・公開契約・MCP回帰75件が成功した。Domainへ移した保存試験は元PackageのModule Mock実行flagが必要で、flag欠落時の10成功・1失敗を経て正規条件11件成功を確認し、Domain通常試験入口も追従した。五Packageの型検査と変更77 SourceのFormat／Lint、差分検査が成功。限定独立レビューは残指摘0だが、試験入口flagの最終追従と結果記録は再確認する。Root Checkerは3,722エラー（broken-link 3,716・broken-anchor 5・既存Local ID未接続1）、今回のSymbol Path／Owner不整合は解消した。一般CRUDとWriter全体の移管・Core単独成立・全体QAは未完了である。AI再送・Docker・過去保持物の操作は実施していない。

このバッチの外部AIなしの局所・状態回帰と受入判断／選定搬送結合は計43件成功。Domain、Coordinator、MCP、Workbenchの型検査、変更SourceのFormat／Lintと差分検査を確認した。機能・安全境界の独立レビューは残指摘0、試験内のnon-null assertion七箇所は明示的な存在確認へ是正した。保存移管・Core単独稼働・公開Graph全体の試験結果ではない。Root Checkerは1,195文書を検査して3,722エラー・警告0で不合格を維持し、今回の三つの設計・計画文書に対する診断は0だった。過去Evidenceや全体QAを成功へ更新しない。

後続のDomain通常全回帰は不合格だった。今回の公開値・型の期待一覧とDomainの新規検査試験登録を追従し、公開境界12件は成功した。残るTest Catalog検査は26件中23成功・3不合格で、理由はHEADにも存在する他Packageの試験5ファイル未登録とWindows Process Profile不足1件である。独立確認で対象Source・台帳の基準版同一性を照合し、今回の新規不具合と区別したが、全回帰成功とは扱わない。今回の非AI移管候補の意味上の独立レビューは残指摘0、把握済みのindent二箇所はFormatへ追従する。

初回中断試験に関係し得る `C:\project\CRDD\.crdd\tests\crdd-project-public-runtime-hyPfZB` の由来・清掃確認は未確定で、名前と時刻だけを根拠に削除していない。後続の完走試験は各生成handleの清掃を実行した。この残存確認の未完を、過去保持物の操作許可や回収完了に読み替えない。

一般CRUD／Writer全面移管の前提として、Domain正本§5.0.1へ現行Root全20fieldとProject／Taskの分解対応、非互換な `crdd-domain/runtime-state/v1` を固定した。新SchemaのSource有効化は未実施。管理実行未導入の空区画と不正欠測を分け、定義をprojectsだけに保持し、固定選定・Owner・試行値は同じSnapshot内の対象定義Hashへ結合する。五Context・初期化・履歴一回証拠を公開DTO化せず、旧新Mapを併存させない。

今回のSourceでは判断記録・受入入力・世代Envelope等の型7宣言と検査5公開値をDomain `decision/types.ts / validation.ts`へ移し、Coordinatorの旧`decision/records.ts`を撤去した。直接利用側・型検査・Root公開集合・Symbolの安定ID・現行Architecture／QA Traceを追従。型除去・空白を除く既存検査本文の一致を独立確認し、条件緩和は検出されていない。認可・Capability発行・横断適用・物理Storeは元Ownerに残り、一般CRUD／Writer全面移管の完成ではない。

移管後の関連35件、固定I/Oと閉集合18件、単独の既存再計画一例が成功。Domain／Coordinator／MCP／Workbenchの型検査、変更93 SourceのFormat／Lint、差分検査、Task設計Trace検査が成功し、限定独立再レビューの残指摘0。Root Checkerは3,722エラーのまま、新しい移管Path／Ownerエラーはない。判断Store・再計画・状態をまとめた試験はStore前半3件の成功後に中断したため全体未判定であり、対象親子Processの終了だけを読取り確認した。中断試験の生成Root清掃は未確認で、保持物を含む強制清掃はしていない。再計画を一例に限定した実行は約18秒で成功しており、固有hangや製品故障とは断定しない。Checker naming全体も16成功・6不合格（既存Rust名、DI公開集合差、3つの実行環境junction拒否、既存Header不足）で、全体合格ではない。AI再送・Docker・過去保持物の操作は行っていない。

続いてWriterの三つのopen／fstat／fsync／close区間をDomain `storage/state.ts`の固定対象操作へ移した。履歴正本だけopen前に期待実体を固定する差、対象ごとのOwner照合時点、履歴だけの追加Effect記録、対象別の置換理由を維持した。三対象×八条件の24組合せと不正名拒否を一つの親試験で確認し、保存I/O・公開境界・状態遷移の計44件、単独の判断回復Store三件が成功。公開集合の期待順序一箇所は初回不一致を是正して再実行した。Domain／Coordinator型検査、変更五SourceのFormat／Lint、Task設計Traceと差分検査が成功し、限定独立レビューの残指摘0。一般CRUD・Snapshot Writer全体・Core単独成立は引き続き未完了であり、この物理I/O切出しを完成とは扱わない。

同じ候補の公開受付・受入判断・Platform独立回帰も22件成功し、この追加バッチの関連試験は計69件成功した。実保存を含む公開受付試験は約150秒で完走し、同内容再入場での再送なしを確認した。途中の無出力から停止・権限故障を断定せず、今回は中断していない。実行は外部AIなしで、各試験の自己生成領域の清掃hookを用い、過去保持物・Dockerを操作していない。

続く依存閉包の確認で、完全codecはCoordinatorの状態・受領・Workspace・履歴の純粋検査に加え、Docker側の修復checkpoint等の純粋codecにも依存すると確認した。Domainから実行Packageを逆参照したり、相関検査を省略して全体codec成立とはしない。現在の実資源観測・真正Owner確認は元Ownerに保ち、保存値の閉形式・相関検査を分離する必要がある。現時点で全宣言の移管閉包確定や全面移管完了とは扱わない。

この確認と並行し、保存途中版の純粋再入場分類をDomain `classifyRuntimeSnapshotReentry`へ本文不変で移し、CoordinatorのWriter一呼出しを接続した。三つの既存試験をDomainの `tests/unit/storage/state-reentry.contract.test.ts`へ移し、Symbol／Catalogの安定IDを保持してOwner・Pathを追従した。関連18件、状態・実判断回復Store回帰32件、Domain／Coordinator型検査は成功。限定独立レビューは残指摘0。これは一般CRUD・新Schema・Writer全面移管の完了ではなく、その未完状態を維持する。

### 完全codec依存分離のチェックポイント

正規byte表現・Hash・UTF-8検査をDomain `state/codec.ts`へ、完全Snapshotの純粋な依存閉包154宣言を`state / task / attempt / workspace / ai-selection`へ移した。Coordinator・Docker Isolation・AI Adapter・Version Controlの利用側をDomain Rootへ接続し、空になった旧専用Fileを撤去した。保存Schemaは既存v5のままであり、新Schema、一般CRUD、Snapshot Writer全体のDomain接続は引き続き未完了である。

独立レビューは型除去・内部名対応後の73関数本文一致と、Domainから実行Packageへのimport逆依存0を確認した。指摘された内部helperの過剰公開、固定配列・辞書の変更可能性、VM試験のalias未接続、現行Architecture・Symbol登録の追従漏れを是正した。追加観測で凍結RegExpでもcompileにより内部文法が変わるため、正規表現実体のRoot公開を除き、Hashは既存関数、Workspace Commit IDは純粋判定関数へ接続した。許容文法・Schema・unknown・真正Owner確認時点は変更しない。

依存分離後の状態・相関・再入場・固定I/O・公開境界80件が成功し、公開固定集合の変更拒否を追加した再回帰75件、非Windows修復VMとVersion Control利用側閉集合13件、Provider値変換15件も成功した。件数は重複を含む別実行であり合算しない。7影響Packageの型検査とTask設計Traceは成功。Root文書検査は既知の3,722エラーを維持し、全体合格ではない。

実保存を含むWindows修復結合は制限下35件不合格で、許可環境の代表一例も期待する模擬取得回数に不一致が残る。VM別名の接続欠落は修正したが、これを全失敗の原因や解消と断定しない。Task実行・受付を含む一括回帰はTask実行Suiteが長時間終了せず、exact親子Processの確認後に終了したため未完了。試験物の強制削除や保持物の操作はしていない。これらは後続のWriter／利用側接続時の調査・固定回帰へ引き継ぎ、チェックポイントのCommitを全体完成やQA合格へ読み替えない。

是正後の固定回帰は状態・相関・再入場・固定I/O・公開API・Version Control利用側を合わせ93件成功。変更182 TypeScriptのFormat／警告を失敗とするLint、Domain・Coordinator・Version Controlの再型検査、差分検査を確認した。Lintの既存情報診断は残すが警告・エラーは0。Windows修復結合と中断したTask Suiteをこの成功数へ含めない。

最終のRoot全数確認で、利用側に不要な局所validator等と残る二つのRegExp実体を非公開化した。内容Hashだけは正規byte表現とCASの公開責務をArchitectureへ明記して維持する。完全メモリの修復結果結合は、移管したencoderをVM依存へ渡していない試験側の追従漏れを是正し、既存26件すべて成功。公開境界・計画検査を含む同実行42件が成功した。

Windows修復Suiteには、静的importから`operation.ts → recovery.ts → Docker Isolation`をmock登録前に評価する経路がHEADにも存在した。今回新設された経路とは確認できないが、実Docker到達の有無も確定できないため、このSuiteの追加実行は停止する。本バッチのWindows試験について実Docker操作0とは主張しない。Sourceの移管やメモリ試験の成功を、この実境界の解消・回収証明に使わない。AI再送・Dockerの追加照会や修復・保持物操作は行わず、試験構成の是正を別の必要な非AI作業として追跡する。

### Windows試験是正とWriterの次の分離単位

`runtime-repair-owner`のModule mock二箇所を撤去し、実修復関数本文だけを29個の明示依存へ結合した。技術三操作は既存のUsing／模擬処理へ固定し、依存欠測と実DI関数の混入を組立て時に拒否する。実Writer・Kernel・故障注入・既存Oracle・清掃hookは維持した。非Windows反例一件、Windows代表一件と型検査が成功し、組立てに対する独立レビューは残指摘0。後続の修正版Suite全79件も成功した。この確認を過去の実Docker到達未確定の解消に流用しない。

Writer全面移管は、`commitCoordinatorStateSnapshotOwned`だけのFile移動では閉じない。五Contextのprivate `settlements`、初期化の`initializations`、履歴一回出版の`historyAttempts`、準備・commit・解放を一つのDomain保存Ownerへ移す。元Controller／Host／Leaseの真正Map、Docker終端・未発行通知の検証は技術Ownerに残す。処置前のbooleanへ置換せず、現在Ownerの同期照合を元のI/O時点で維持する。

その前提になる一般Task更新の純粋閉包六宣言を、Domainの`task/crud.ts`、`state/transition.ts`、`attempt/validation.ts`、`state/validation.ts`へ実体移管した。候補生成・Task正規化・共通CAS遷移・受領相関遷移・修復終了条件・固定履歴行導出が対象で、内側の受領相関遷移は非公開とする。Coordinatorの旧宣言・互換re-exportは残さず、利用側をDomain Rootへ接続した。既存Decoderへの短い委譲は同じ完全codecへの直接呼出しへ置き換えた。限定独立レビューの残指摘は0である。

新Schemaの型と純粋codecを追加し、Coreの作成途中の定義と、固定Selection／Ownerを持つ管理実行投影を分離した。定義Hash・Task順序・全区画相関・不正欠測を検査し、旧Schemaを新codecで受理しない。Coreのみの定義へ架空の実行選定やOwnerを補完しない。個別CRUDの途中状態を許す値検査と、`savePlan`／管理実行時の完全性検査を分けたが、既存の実行受付条件は維持する。これらは純粋値境界の実装であり、新Schemaの本番保存切替や一般CRUDの完成ではない。

Windows全回帰の最初の修正版は79件中66成功・13不合格だった。追加調査で、移管先Moduleの内部へ故障注入が届かない試験構成と、旧形式の合成Operationを確認した。Lock・固定I/O・Writerの実Sourceを同じVMへ組み込み、現行の固定選定・Task Attempt・受領形式へ試験入力を追従した。安全判定・Writer本文・期限・Oracleを緩めず、残る対象親子29件は成功した。再度の全79件はすべて成功し、取消・skipは0だった（約28分）。これは別実行の終端結果であり、部分結果を合算したものではない。現在の独立確認も過去の実Docker到達未確定を解消するものではない。

移管後の状態・相関・新Schema・Core検査・公開API・再入場の固定回帰79件、通常Task受領のWindows実保存一件、Domain／Coordinator型検査が成功した。子Process試験本文のDomain API参照三種類は構文・実exportの存在を確認したが、子Processの実結合成功とは扱わない。一般CRUD、五Context／初期化／履歴一回証拠と物理Writer全体、Reader／利用側の新Schema本番切替は引き続き未完了である。任意bytes用Writer、汎用validator callback、旧新Mapの二重登録は追加しない。AI再送・Docker・過去保持物の操作は行っていない。

Domain通常全回帰は290件中237成功・53不合格だった。リンク作成の環境拒否、Lock取得・回復試験の不成立、既知の試験台帳未登録を含む。全53件の原因を今回の移管へ一括帰属せず、変更対象の限定回帰と区別して全体不合格を維持する。Root文書検査も不合格のままであり、今回の限定独立レビューをRepository全体QAへ昇格しない。

同じDomain候補を必要な実行権限で再確認した結果は290件中287成功・3不合格だった。一時領域は今回専用のRepository-local Rootへ限定し、元の53件中50件はこの条件で成立した。残る3件は既知のTest Catalog未登録5 FileとWindows Process Profile不足1件であり、安全検査を省略せず不合格を維持する。今回の専用Rootは試験終了後の空・非ReparsePointを確認して非再帰削除し、不存在を確認した。過去保持物は操作していない。

続く小バッチでは、終了履歴の全行codecと期間保持候補の2関数をDomain `state/history.ts`へ本文不変で移した。旧Coordinator decoderへの短い委譲は、同じDomain完全codecへの内部aliasで直接接続した。物理File・実排他・出版・読戻し・現在Ownerは元の保存処理へ保持し、Coordinator／Workbenchの直接利用側とVM・子Process試験本文をDomain Rootへ追従した。状態・履歴・修復結果・公開境界67件と3Packageの型検査が成功し、限定独立レビューは残指摘0。移管後は実Writer接続に関係する限定Windows親子29件も成功した。前CommitのWindows全79件を本バッチへ流用せず、結果範囲を区別する。子Process本文の新しい4つのDomain参照は構文と実exportの存在を確認したが、子Process実結合の成功へ拡張しない。一般CRUD・新Schemaの本番保存切替・Writer全面移管は引き続き未完了である。

### 保存候補・遷移検査の依存閉包移管

追加45宣言をDomainの`state/crud.ts`、`task/crud.ts`、`state/validation.ts`、`attempt/validation.ts`、`attempt/repair-validation.ts`へ移した。同じSnapshot候補間の相互参照は一Fileへ保ち、再export専用Fileや新しい循環を追加しない。旧Decoderへの短い委譲とDIの旧`repair-state.ts`を撤去し、Coordinator・DIの本番ConsumerをDomain Rootへ接続した。このバッチ時点では一般CRUD・新Schemaの本番保存切替・物理Writer全面移管が未完了だった。以下のSource切替と区別する。

独立確認で指摘された試験専用7関数のRoot過剰公開を除き、修復・再起動・終了要約の直接値検査をDomainの試験へ移した。Coordinatorの保存／再起動結合は公開候補・codec経由のOracleへ追従した。Source宣言を構文木から取り出す既存試験補助はDomain試験側へ一実体で移し、利用側だけを追従した。DomainからCoordinatorの製品内部・試験補助への逆参照を残さない。

状態・要約・修復結果・Root公開境界・DI境界の固定90件、再起動の本番組立て15件が成功。追加のWindows修復親子29件も成功し、実Writer・Kernel・故障注入・既存Oracleを維持した。各実行を合算した全体QA合格とは扱わない。移管に伴う古いSource位置・VM依存・公開集合期待の追従漏れは是正し、初回不合格を隠さない。保存形式・I/O時点の真正Owner確認・Timeoutは変更せず、AI再送・Docker・過去保持物の操作は行っていない。

最終確認では、Checkerの旧DI公開Module期待と移管済みSymbolのOwner／検証関係の追従漏れを是正し、再起動結合へrevision・previousのexact連鎖検査を追加した。独立確認でこれら以外の残指摘は0。是正後の再起動15件とWindows29件は再実行でも成功し、4Package型検査、変更51 TypeScriptのFormat・警告を失敗とするLint、Symbolの一意Owner・実在Path・安定参照を確認した。Checker全体は16／22成功で、Rust名・既存Header・実行集合・環境のjunction拒否等の不合格を維持する。公開集合の限定再確認はDIを通過後にCoordinatorの既存Header不足で停止した。試験台帳の回帰も27件中24成功・3不合格で、既知の未登録5 FileとWindows実行Profile不足を保持し、今回追加・移管した試験の未登録はない。これらを全面移管の完了やRepository全体QA合格へ読み替えない。

### 新Schemaの既存Reader／Writer接続

Sourceの正本を `crdd-domain/runtime-state/v1` へ切り替え、旧codecを撤去した。定義は`projects`、固定選定・Owner・Task実行値は`managedExecutions`へ一度だけ保存する。既存の単一CAS、元unknown、exact参照、受領相関を維持し、旧v5は拒否する。Core-onlyの定義へ架空の選定・Ownerを生成しない。保存先は変更せず、既存の実データ・過去保持物を移行・削除していない。

通常更新のCore-only兄弟の本文・順序保持と、不正な技術行を試験fixtureが上書きしない反例を追加した。既存の部分再計画は実StatePort／Writer保存後に再読し、定義Hash、Task順序、旧Attempt／Operation／Authority／settlement、兄弟定義、古い世代の再保存拒否・正本bytes不変を確認した。この再計画fixtureの回復・受領・Candidateは空又はnullであり、非空本文の一般保持を立証したとは扱わない。非空の受領・回復相関は別のcodec／遷移反例と区別する。

固定された非AI回帰90件、Windows実Writer修復29件、実保存の部分再計画一件、Domain／Coordinator／Docker Isolation／Workbench／MCPの型検査が成功した。fixture上書き・利用側の技術Task参照・旧配置文字列切出しの追従漏れは是正し、一次診断反例一件も再成功した。変更30 TypeScriptのFormat・警告を失敗とするLintと差分検査は成功。Schema接続差分の独立レビューは残指摘0。

別の広域回帰は208件中204成功・4不合格で終了した。原因は移管前Pathからの宣言抽出一件、制限環境でのjunction作成拒否二件、容量fixtureの重複Path／受入条件一件である。宣言抽出は現OwnerのAST参照へ、容量fixtureは一意値へ是正した。診断一件・容量境界一件は各々再成功し、junction二件も必要な実行権限付きで成功した。容量Oracleの16MiB−1／16MiB／16MiB＋1、超過拒否・元本文不変・pending不存在・許容時の実保存と再読を維持し、製品上限・安全条件は変更しない。是正の独立再レビューは残指摘0。個別の成功を208件一括再成功へ合算せず、初回不合格と全体QA未完了を保持する。

現在の残件は一般CRUD、Domainへの物理Reader／Writer・短期保存Owner・五Context・初期化／履歴一回証拠の全面移管とその固定入口接続である。任意候補Writerや汎用callback取引をDomain Rootへ公開して完了させない。Coordinatorの真正Owner確認とDomainの保存を、既存と同じI/O確認点へ結合する必要がある。新SchemaのSource接続を、この全面移管・Core単独成立・既存実データ移行の完成へ読み替えない。

### 物理Writer移管前の固定保存用途への限定

Host清掃準備の本番二呼出しを、任意candidateの保存から、元操作Owner・exact回復参照・beforeだけを受ける固定用途へ変更した。保存側で同じOperation・解放済みLease・未要求のHost清掃を確認し、pending候補を再導出する。利用側のMapからcandidateを除去し、同じ確定版の再入場は全結果fieldを保持して無書込みで確認する。第三の状態と不正元版は拒否し、pendingの厳密再照合は既存Writerへ保持した。新しいMap・Lock・Registry・復旧方式は追加していない。一般CRUDと物理Writer全面移管は引き続き未完了である。

実Source・実codecの局所試験で不正元版・別操作・偽Owner・読取り後失効・解放不明・第三状態・確定済み結果全文を確認した。既存の本番Owner再入場試験は、移管済み純粋関数の模擬置換先が旧Storageに残っていた。現OwnerのDomainへ追従し、未設定Storage関数は実I/Oせず例外停止する代役として一件成功した。

Windows実Writerの追加子Caseは、rename故障で残る同一pendingの再入場、一回改訂、pending／markerの不存在、別pending拒否・元本文不変、確定後再入場の返却全文・書込みEffectなしを確認して成功した。ただし同時実行した既存の親Caseは、後続のKernel解放観測故障注入で期待した停止を観測できず不合格（親子二件中一件成功）だった。この初回結果は保持し、以下の追従後の成功と区別する。

現在の短期保存Lock・Domain固定I/O・Coordinator Writerの実Sourceを一つの試験用閉包へ接続し、故障注入先を更新した。既存の修復保存試験の同じ組立てを試験補助へ集約し、未指定の依存・製品判定・実FilesystemとKernel・Oracleを維持した。fixture内のMapは一実体だが、製品singleton成立の根拠にはしない。後続のdata URLに残った移管済みparseHostRecoveryTokenの旧importもDomain Rootへ追従した。製品Source・Root公開API・保存Schema・Timeoutは変更していない。

追従後のWindows保存・pending再入場は親子二件とも成功（約134秒）、共通補助へ追従したWindows修復保存は親子29件すべて成功（約128秒）した。本番Ownerの再入場反例一件、Coordinator型検査、変更試験のFormat／警告を失敗とするLintも成功した。試験補助はfile Symbolに登録し、新SuiteとしてCatalog登録しない。初回不合格や全体QA未完了を消さず、一般CRUD・物理Writer全面移管の完了へ換算しない。AI再送・実Docker・過去保持物は操作していない。

正常Owner一回形は、旧import追従後に清掃結果受領の期待と不一致だった。試験先頭の静的importがmock前に終端Moduleを評価し、後置した技術観測の代役へ届かない接続を確認した。各Caseでmock設定後に実settlement Moduleを一回だけ評価し、その全exportを同じcanonical参照へ結合した。prepare／capture／settleは同じprivate Mapを共有し、Owner終了・清掃後に逆順でmockを戻す。実判定・Oracleを変更せず、同じ一回形は約70秒で成功した。複数回・保持あり形の全回帰へ拡張せず、この初回不合格と限定再成功を区別する。限定独立再レビューは残指摘0だった。

同じ保存補助へ追従した認証unknown専用WriterのWorkbench／CLI二形も、実保存・Owner失効の故障注入・既存清掃hookを含めて成功した（計約47秒）。これらは外部AI・実Docker・認証情報を使わない合成試験であり、過去の実AI失敗や保持物の回収成立を示さない。

### 短期保存の遷移・閉鎖・退役条件のDomain接続

Coordinator `state/transition.ts`の観測型、区画遷移assert、四つの閉鎖・退役条件をDomain `state/transition.ts`へ実体移管し、旧Fileを撤去した。Writerと履歴退役処理という現在の本番Consumerが使う値五名・型一名だけをDomain Rootで明示公開する。互換ラッパー・再export専用File・新しい判定機構は作らない。既存Symbol IDをDomainの実Pathへ移し、公開集合検査・試験補助・責務分類・Architectureを追従した。

実Filesystemの不存在・履歴確定を読む二callbackの生成は既存Writerに残し、同じ短期Owner・元の確認位置で呼ぶ。DomainはI/Oを所有せず、有限の同期観測を利用して既存条件を検査する。独立レビューは移管部分27,268文字の本文一致、観測時点不変、Domainから実行Packageへの逆依存・新値循環なしを確認し、残指摘0。状態・Schema・公開集合・責務分離の固定回帰76件、両Packageの型検査、変更SourceのFormat／警告を失敗とするLintは成功した。物理Writer・短期保存Owner・五Contextと一回出版証拠の全面移管、一般CRUD、Core単独成立は引き続き未完了である。

移管後のWindows保存・pending再入場は親子二件とも成功（約132秒）し、実Writerと既存故障注入の接続を維持した。旧Runtime撤去・履歴の回帰は13件中12件成功・一件不合格で、後者は合成Root内のHardlink作成が環境からEPERM拒否された。必要な権限で同じ一件を再確認して成功し、初回13件の全体成功へ合算しない。Task設計の実装・検証接続検査も成功した。AI再送・実Docker・過去保持物の操作は行っていない。

### 残る受付・受領の値依存と物理移管の閉包

短期保存Ownerだけの移管は行わない。`acquireCoordinatorStorageOwnerForRepository`の構造的Repository入力、`readCoordinatorStorageOwnerBinding`の生Kernel handle返却、任意HashからのKernel取得は現在Package内の信頼境界を前提としている。これらをDomain Rootへ公開して接続する案は棄却した。物理Reader／Writer・履歴・短期Owner・五Context・初期化／履歴の一回証拠を同じOwnerへ移し、最終の固定用途入口だけを公開する方針を維持する。新しいRegistry・Map・Lock・汎用callback登録を追加しない。

その前提として、受付相関`coordinatorSnapshotIntakeMatches`をDomain `state/transition.ts`へ、受領競合`hasProjectTaskResultAcceptanceConflict`を`task/crud.ts`へ本文不変で移した。旧`state/settlement.ts`は撤去し、Queueの事前照合とWriterのLock内fresh照合、既存受領反例を同じ実体へ接続した。四fieldの`ProjectTaskResultFact`をDomain `task/types.ts`へ定義し、State PortとWriterで共用する。型共通化で実行時のexact key・Task／Attempt／Operation・未解決状態の相関検査を省略しない。保存がDI Root経由で参照していた二つの純粋関数も、同じ実体OwnerのDomain Rootへ直結した。

固定回帰80件、両Package型検査、変更13 TypeScriptのFormat／警告を失敗とするLint、Task設計の実装・検証接続検査が成功し、限定独立レビューは残指摘0。追加受付試験は世代・Hash・対象の局所照合だけであり、全体codec・実受付成立へ換算しない。Schema・Map・Kernel・Writer分岐順・現在Owner観測は変更していない。一般CRUD・物理保存全面移管は未完了である。

同候補のWindows実保存・pending再入場も親子二件とも成功（約120秒）した。既存WriterのLock内で受付・受領を再照合し、Owner失効・解放不明・同じpending再入場の元Oracleを維持する。AI再送・実Docker・過去保持物の操作なし。この結果も一般CRUDや全面移管の完了ではない。

物理移管の固定入口化対象は、汎用`withCoordinatorSnapshotOperation`の本番呼出32箇所を持つ六つの利用元まで含める。判断六、Workspace二、Task／Queue十一に加え、実行Lease九、状態Query一、履歴退役三がある。後三者を対象外へ落としたり、汎用callback取引をDomain Rootへ公開して完了させない。各技術Ownerのfresh検査を元の位置に保ち、用途固定の状態操作と保存内部取引へ分ける。

### 判断記録六操作の固定用途化

受入判断の作成・最新読取り・確定、判断回復の作成・読取り・比較更新の六callback本文をDomain `decision/crud.ts`へ移した。Coordinatorの二つの既存Storeは、元の短期Owner内でfresh読取りした後に固定関数を呼ぶ。DomainへworkingDirectory、保存Owner、callback、Filesystem、判断Authorityを渡さず、新Store factoryや公開Result Frameworkを追加しない。非公開の値constructorは元の三field／五fieldと外側freezeだけを再現し、nested値を追加freezeしない。

元Envelope全文Hashによる二世代連鎖、generation二優先、重複拒否、expected全文一致、同じentryだけの世代加算、対象外区画保持、拒否理由を維持する。作成・確定で使うRepository bindingは既存保存入口が検証する。これらの候補APIだけで保存・人間判断の真正性・回復完了を成立させない。Rootは用途固定の六値だけを明示公開し、constructorと汎用保存取引を公開しない。

独立レビューで、一般CRUDとの混同を避けるため六公開名を既存のCoordinator専用型・Schemaと同じ接頭辞へ統一した。`prepareCoordinatorAcceptanceDecisionCreation`／`projectCoordinatorAcceptanceDecisionRecord`／`prepareCoordinatorAcceptanceDecisionFinalization`、`prepareCoordinatorDecisionRecoveryCreation`／`projectCoordinatorDecisionRecoveryRecord`／`prepareCoordinatorDecisionRecoveryUpdate`である。旧名・互換aliasは残さず、Symbol／Catalogの安定IDは維持した。最終再レビューは残指摘0。

命名修正前の局所・状態・公開境界回帰44件、状態codecを含む別固定回帰43件、公開Taskフロー・受入System五件が成功した（別実行・重複あり、合算しない）。命名修正後は局所・Root集合十五件、実Store四件が成功し、作成／比較更新各一改訂、読取りbytes不変、不正binding、重複・stale、元Hash破損・未知欄の拒否を確認した。両Package型検査、変更七TypeScriptのFormat／警告を失敗とするLint、Task設計の実装・検証接続検査も成功。Formatterの初回はWindowsのmapped-file拒否1224で一Fileの書込みが失敗し、その後の確認で改行不足二箇所を検出した。同Fileだけ整形し、最終確認は成功した。検査の初回失敗を隠さず、拒否条件や期限は変更していない。

物理保存、短期Owner、五Context、一回出版証拠と一般CRUDの全面移管は未完了であり、六操作の候補移管をそれらの完成へ換算しない。AI再送・実Docker・認証情報・過去保持物の操作は行っていない。

### Workspace二操作・現在状態投影の固定用途化

判断六操作に続き、Workspace二callbackと現在状態Query一callbackをDomainの固定候補・投影へ移す。元の三wrapper・汎用取引の内部実体・物理WriterはCoordinatorに残し、同じ短期Ownerでfresh値を読む位置、CAS・失敗・解放条件を変えない。残る未固定の値操作はTask／Queue十一、Lease九、履歴退役三。固定済み九操作も物理取引移管はまだであり、残数から汎用取引が消えたとは扱わない。

着手前の読取り専用確認により、Domainへambient時刻読取りを移す案は採用せず、既存の有限観測の先例に合わせた。Process IDはfresh callback内で値取得、時計は無名の同期関数一つとし、拒否・非削除では零回、削除候補の末尾だけ二回観測する。新しい型・Manager・Registry・保存Contextは追加しない。統合結果の同本文再入場・異内容拒否、QueryのSchema／ID共同拒否、Workspaceの世代・非使用・処置確認順序を維持する。

局所試験の初回は保留拒否のfixtureがdiscardingのpendingを欠き、先行する値形式拒否になった。fixtureに正規の破棄意図を与えて是正し、製品のvalidator・拒否順を変更しない。初期接続の余分なcommaと局所最小fixtureの明示cast不足も静的検査で検出・是正した。回帰と独立レビューの最終結果は確認後に追記する。AI・Docker・保持物の操作なし。

限定独立レビューのMinor二件は、用途固定clockと任意Snapshot callbackを区別するHeader、及び実Storeのclock例外Caseで是正した。追加Caseは実Reader／Kernel／短期Ownerを使い、局所合成Workspace／Leaseは物理保存しない。clock一回でthrowした後のexact拒否、state bytes・history bytes又は不存在の不変、同Rootの後続read／fixture固有write成功と一改訂を確認した。実Lease・Authority・Git回収や全体codecの根拠にはしない。再レビューは残指摘0。

固定したDomain局所・判断・Root・履歴十九件、既存状態Query五件、実結果Store五件、追加clock失敗一件、Workspace反例四件が各実行で成功した（重複範囲を合算しない）。両Package型検査、変更TypeScriptのFormat／警告を失敗とするLint、Task設計接続検査も成功。Formatterは追加ITへの初回書込みがWindows mapped-file拒否1224で停止し、同Fileのみの後続整形・確認は成功した。広域Workspace十八件を含む先行実行は継続中であり、このcheckpointでは完了又は全体成功としない。物理Writer・一般CRUD・Core単独成立・実AI E2Eは引き続き未完了である。

### Task／Queueの受付・追加・照会の固定用途化

初回棚卸しでは純粋な六callbackをDomainへ移す案を考えたが、着手前確認で実行対象選択とexact回復後の再開判断はCoordinatorの責務と照合し、編集前に除外した。Domainへ移すのは受付照合・Queue追加・Queue一件照会・State PortのProject照会の四操作だけ。新しいScheduling／回復方針は追加せず、両操作は既存Coordinatorのまま維持する。残る未固定の本番callbackはTask／Queue七、Lease九、履歴三の計十九箇所であり、すべてをDomainの業務判断へ移す意味ではない。固定用途の保存接続と技術Ownerの現在観測を分離する必要がある。

既存の追加入力型は宣言本文を変えずDomain `task/types.ts`へ移し、State PortはRootの同じ型を使う。旧宣言・互換aliasを残さない。Queueの三値操作は`task/queue.ts`、Project投影は`state/crud.ts`。四実値と既存一型だけをRootへ明示公開し、結果constructor・任意取引・保存Owner・Leaseは公開しない。元の短期Lock内fresh適用、成功／拒否理由、Hashと受付相関、未指定Workspaceのnull、同内容再入場の無書込み、対象外参照と外側freezeのみの封筒を保つ。

局所四件・Root十三件は成功。追加した実Store一件も、新規一改訂、Project／Workspace／Lease／結果／履歴区画不変、照会・同ID再送・内容差拒否・既存受付照合のbytes不変を確認して成功した。選択順位・実Lease・別Process競合を含む既存回帰と独立レビューは別に確定する。AI再送・Docker・保持物操作はなし。

選択順位・稼働Ownerを横取りしない条件・Repository単位の実Lease・別Process競合の四件と、追加CRUD一件・状態Query五件の固定回帰十件が成功した。別のDomain局所・判断・公開集合・履歴二十三件も成功（重複実行は合算しない）。両Package型検査、変更九TypeScriptのFormat／警告を失敗とするLint、Task設計接続検査は成功した。

独立レビューは製品契約の指摘零、試験Minor一件だった。実Storeの対象外比較を部分配列の列挙からSnapshot全文比較へ補強し、許容差を一改訂・Queue一件追加・受付結合一件追加の三項目だけに限定した。是正後の同実Store一件とDomain Queue／Root十七件は再成功し、限定再レビューは残指摘零。Sourceの判定、Writer、実行優先順位や回復処理を変更していない。

先行Workspace広域回帰は別実行のまま継続中で、途中のstderrに`fatal: Needed a single revision`二行が出た。Case名・終了結果は未確定であり、原因・成功・回収を推定しない。今回の四操作の限定結果とは分けて追跡する。物理保存全面移管・一般CRUD・Core単独成立・実AI編集E2Eの完了には換算しない。

### Task／Queue残七用途の候補接続

先行Workspace広域回帰の最終結果を取得した。Workspace十八件・結果Store五件・状態Query五件の計二十八件が成功、失敗・取消は零、実行全体は約二十九分だった。途中のGit診断二行だけから失敗とは判定せず、最終のCase結果と区別する。これは先行の固定版に対する結果で、以下の七用途や物理Writer全面移管の根拠へ流用しない。

`d43e623e3`を基準に、残る十九用途の入力・現在観測・候補差分を[対応表](runtime-domain-storage-after.md#runtime-domain-fixed-storage-uses)へ固定した。そのうちTask／Queue七用途をDomain `task/queue.ts`へ接続した。単発受付・単発更新・未開始終了、一般Queue更新、選択差分適用、exact回復後適用、Lease解放確定の候補である。Schedulingの選択・回復処置の発火はCoordinatorに残し、Domainは閉じた決定値の整合を再検査する。新Schemaだけを復号する現在の保存入口から到達不能な旧Lease証拠fallbackは撤去し、旧形式の移行を製品へ戻さない。

単発更新の借用先行、一般更新の前提検査後借用、同じ実Leaseの六field投影・生存一回、成功末尾だけ時刻二回を維持する。Rootへ公開するのは利用中の七固定候補だけで、任意Snapshot取引、保存Owner、生Kernel handle、constructorは公開しない。選択の元世代・対象・限定差分に不整合があれば`orchestrator_queue_selection_invalid`で停止する。物理Writer・新しいScheduling・回復Framework・Map／Lockの追加は行わない。

独立レビューのModerate一件は、一般Queue更新の引数生成による後段fieldの先行評価だった。用途固定の五accessorで元の短絡順と複数読取りを維持し、borrow内の余分なtruthiness再読を除いた。実Store試験へ欠測／世代／再開条件／結果参照／遷移の各拒否でのgetter列・bytes不変、実Leaseの正常更新での元getter列を追加した。利用側の実LeaseをDomainへ渡さず、この投影を汎用reader Frameworkにしない。

新局所八件・既存Queue四件・公開境界十三件の計二十五件、両Packageの型検査とTask設計接続検査は成功した。七用途接続後の先行IT九件も成功したが、accessor是正前の結果なので是正後の再実行と区別する。Domain全文の通常入口は整形・型・警告を失敗とするLintを通過後、三百二十六件中二百七十三件成功・五十三件不合格・取消零だった。Hardlink／SymlinkのEPERM、Kernel／回復試験の拒否やTimeout、既存Catalog六診断を観測したが、五十三件すべての原因を同一環境原因とは断定しない。検査を緩和せず、現在の七用途の局所成功で全体不合格を上書きしない。

三十二本番callbackのうち候補本文を固定した用途は二十、残りは実行Lease九・履歴三の十二。二十用途でもCoordinator内の物理取引はまだ使っており、汎用取引撤去・物理閉包の全面移管・一般CRUD・Core単独成立は未完了である。AI再送・Docker照会／操作・認証情報・過去保持物操作はなし。新しい合成試験物だけを既存hookが処置する。

accessor是正後の固定IT九件はすべて成功（約三百三十四秒）、失敗・取消・skipは零。実Storeの先行拒否時getter列・bytes不変、実Leaseの正常更新列に加え、単発受付／終端、受付後取消、Owner喪失、別Process排他の元Oracleを維持した。別実行の状態遷移・世代喪失・履歴三十一件も成功し、合計して単一runとは表示しない。変更六TypeScriptの整形・警告を失敗とするLint、両Package型検査、Runtime／Task設計の接続検査は成功。最終独立レビューは残指摘零で、追加ITの字下げMinorは通常formatterだけで是正した。Domain全文の五十三件不合格、実AI未確認、物理保存移管未完了は維持する。

### Lease九用途・履歴三用途の固定候補接続

基準`9ef16c1e5`から、[十九用途の対応表](runtime-domain-storage-after.md#runtime-domain-fixed-storage-uses)に残る十二用途を接続した。Leaseの記録候補はDomain `attempt/lease.ts`、履歴の三候補は既存`state/history.ts`に置く。取得予約の資源不存在→Root→保存要求mark、取得確定の元intent→Lock実体確認、回復予約／確定のRoot・元Queue／intent全文再照合を維持する。Root投影は実StatsでなくRootと既存実体Hashの二field。PIDはCoordinatorの値入力で、Process生死・実Lock削除・opaque Map・回復発火は同じCoordinatorに残す。

Lease証拠生成の製品Consumerは三箇所だけだった。旧Storageの汎用Envelope生成・旧Directory Envelope Reader・旧exact証拠Readerの製品参照零を確認し、三関数二百十七行と未使用importを撤去した。証拠生成はDomainの非公開一関数で、元Schema・全文・Hash・取得一世代／終了一→二世代・外側freezeのみを保持する。現行Snapshotが使用する型・validatorは削除しない。

履歴の物理出版はCoordinatorに保持する。退役ではSchema確認後、pendingあり／なしにかかわらず元の出版を一回実行し、成功後だけDomainへ進む。搬送ではpendingあり時だけ出版し、失敗時に候補を呼ばない。Domainは対象ごとの元位置で閉鎖条件と履歴を再読し、必要なQueue退役時だけ受付世代を一回生成する。結果だけの退役と退役零件は世代を生成しない。履歴再読のrecorded／expired以外は既存の未確認理由へ閉じ、publisher・Owner・handle・任意Snapshot callbackをDomainへ渡さない。

着手前の読取り専用確認で九用途・三用途の観測点と責務を照合した。独立レビューのModerate一件は、二fieldを持つ継承thenableをRoot投影として受理する不足だった。Proxy確認後にprototypeを通常Object又はnullへ限定し、then継承も拒否した。必須二fieldを持つ継承thenable、own accessor、Proxyの負例でthen／getter／trap零・mark零を確認する。pending生成Headerの出版済みというMinorは、fresh元版・出版前へ訂正した。再レビューは追加指摘零。実Root観測・理由・候補・物理処置は変更しない。

初回局所では証拠SchemaのOracleに旧名を誤記し三件不合格となった。実際の既存定数へ期待値だけを追従し、製品のSchema・Hashを変更せずLease八件成功。Lease・履歴・Queue・Root・要約の固定回帰三十九件、履歴の局所五件が成功した。反例追加後のLease八件も再成功した。初回のFormatterは実行中Nodeが参照するStorage FileでWindows mapped-file拒否1224となったため、余分な空行一箇所だけpatchで是正し、最終整形確認は成功した。両Package型検査、変更九TypeScriptの整形・警告を失敗とするLint、Runtime／Task設計接続検査も成功した。

実Storeの通常対象回帰は五十三件中五十二件成功・一件不合格・取消零（約八百三十三秒）。不合格は試験のsymlink作成がEPERMで拒否されたCaseで、局所再現でも同じ境界で停止した。必要な権限で同じ一件を新品合成Rootで再確認し成功したが、初回run全体を成功へ変更しない。別にWindows Owner喪失十六modeと取得／解放途中の二Caseが成功（約百九十六秒）、履歴退役・共有採用証拠の二Caseが成功（約七十二秒）した。最終Root検査追加後の実opaque Lease一Caseも成功（約三十秒）。実AI・Docker・認証情報・過去保持物は使用していない。

履歴の実Filesystem回帰は十一件中十件成功・一件不合格・取消零。不合格は試験Hardlink作成のEPERMであり、必要な権限で同じ一件を新品Rootで再確認し成功した。出版／状態の二段確定、pending再入場、fsync／rename失敗、衝突拒否・期間保持の元Oracleは維持する。これらは別実行で、単一runへ合算しない。先行Domain全文三百二十六件の五十三不合格とは、対象母集団も結果も別である。

候補本文の固定接続は三十二／三十二。物理取引とReader／Writer・短期Owner・history I/O・五Context・初期化／一回履歴証拠はCoordinator内部に残り、一般CRUD・Core単独成立も未完了である。次はこの物理閉包を同じ保存Ownerとして移し、用途固定入口を接続してから旧汎用取引を撤去する。生Owner・Kernel・任意WriterをRoot公開する暫定解、新旧Mapの併存は採らない。Source接続と既存物理保存先・保持実データの切替は別扱いとする。

### 物理保存移管の現在性接続準備

通常実行・業務保存・回復読取り・終端保存の四用途は、RevisionとOwnerの条件が異なる。独立した着手前確認を経て、[正式設計](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#50-save-context)へ接続条件を明記した。既存operation private bindingへ初回検証済みRoot参照を保持し、四借用へ非列挙・固定のRootと用途を加えた。既存の再観測本文・呼出し回数・Hash・Kernel・一回Mapは変更せず、新しいRegistry・Factory・公開APIは追加していない。Writer／Lock内の値型は元の三field投影を維持する。

実Repositoryの三Caseと五Suite三十七件は成功。三十七件の初回実行は三十六成功・一不合格で、既存の現在入場試験の正常fixtureに新Schema必須の`managedExecutions`が欠けていた。operation変更を基準版へ一時復元しても同じ失敗を再現した。fixtureに空集合だけを追加し、製品検査は緩和していない。型検査、変更Sourceの整形・警告を失敗とするLint、Task／Runtime接続検査は成功。五Source／試験の限定独立レビューは残指摘零。

この候補は全面移管前の接続準備である。物理Reader／Writer・短期Owner・五Context・一回証拠の移管、三十二用途の物理固定入口化と旧汎用取引撤去、一般CRUDの本番接続はまだ完了していない。過去の全体回帰不合格も解消済みとはしない。AI・Docker・過去保持物は操作せず、今回の合成試験物だけを既存hookで回収した。


### 共通保存の実体移管と一般CRUD接続 — 2026-10-28

基準`9f3599e20`から、共通Reader／Writer・短期Owner・保存専用Kernel・五Context・一回履歴証拠をDomainへ実体移管した。Coordinatorの旧Storage三Fileは撤去し、三十二用途はDomainの有限操作へ接続する。任意Snapshot callbackをPackage境界へ渡さず、実行・終了の元OwnerはCoordinatorが有限観測として搬送する。Mapの複製・新Lock・新Registryはない。

一般初期化・Plan保存、Objective／Taskの追加・更新・削除と用途別Queryは同じ物理Writerへ本番接続した。新Schemaだけを使い、保存先と既存データの有効化・移行は別。AI選定・管理実行・完了Evidenceを一般CRUDのために作らない。

独立レビューの物理再照合不足は、元Host現在性とVC実体再照合をANDする形で是正した。生Pathを受ける技術保存APIの公開過多も検出し、37入口を真正なVC Root必須へ切り替えた。旧string・偽参照の全入口拒否、private Writer／Lock／任意取引のRoot非公開を確認した。保護判断Storeはprivate Root資格・Native・Kernelとの不可分性を維持し、構造Path＋callbackのDomain公開factoryにせずCoordinator `decision/store.ts`へ配置した。

確認済みの別実行結果は、Core CRUD／故障5形／初期化故障2形と実Store保全・選択失敗の計12件、Root四用途3件、37入口の偽造拒否1件、Root exact公開1件、保存Consumer閉包4件。管理実行・Queueが非空の別Project保存で対象外全区画を比較し、履歴一行のbyte保全も追加後に再成功した。さらにCore CRUD・四用途／偽造拒否・保存Consumer閉包の三Suiteは固定候補で18件成功。出版後不明・解放不明を成功へ丸めず、同じpendingの明示再入場だけを確認した。新規の回復処置は追加しない。

Domain全文の一実行は352件中346成功・6不合格だった。公開集合・新Ownerへの検査追従漏れ、試験の内部import、既知Catalog六診断が含まれる。公開集合と保存Consumer閉包を是正し、Catalog未登録五File・Windows実Process profile一件も現在の実在試験に追従して台帳26件を再成功させた。初回全体結果を成功へ書き換えない。

試験Ownerも移管中。履歴11件、保存専用Kernel3件、独立Process短期Owner1件、marker保全・清掃2件に加え、物理Snapshotの故障・不存在等13件と純codec・相関7件をDomainへ移して各再実行は成功した。後二Suiteの独立レビューは安全条件・元Oracleの残指摘零で、整形指摘を是正後20件を再成功させた。Workbench固定Reader接続16件、Coordinatorのexact Queue読取り・実行状況投影9件、MCPの公開保存接続4件も成功。MCPの制限環境での初回失敗はloopbackのEACCESであり、同じ4件を通常権限で確認した。

CoordinatorにはHost・Home・実行・回復の共同契約を残す。保存Kernel移管後も残るHost/Home/Console七CaseをWindows実Process Gateとして明示し、実行Profile・Owner Runnerと同期した。七件は成功。台帳検査で検出した分類不一致を、実条件のある試験の分類追従で処置し、検査を緩めていない。生WriterをRootへ増設したり、内部import検査へ例外を足したりして移管済み扱いにはしない。残るWriter固有Case・旧試験Facadeの撤去、全体回帰と最終独立レビューを完了するまで全体完了とはしない。現在の公開境界検査は、Coordinator側の四試験／補助Fileにある七つの保存内部importを検出して不合格であり、既知として保持する。

AI再送・Docker照会／操作・認証情報・過去保持物は操作していない。今回の自己生成試験領域だけを既存helperで処置した。巨大な実行別Evidence書庫は追加しない。

#### 試験所有者の追加移管と公開Reader追従

旧Coordinatorの純粋な状態相関試験をDomain `runtime-transitions`へ移し、実Hostの終了観測だけをCoordinator `host-observation`へ分離した。物理Snapshotの三Case、16MiBの厳密境界、Host準備保存wrapper、修復／認証／Task／終端Writerの五つのguard反証もDomain保存Suiteへ配置した。Coordinator側に残る公開回収・DI接続二十四件は再成功した。移管を理由にprivate Writer・Lock・任意取引を公開していない。

単発受付・Queue・Workspaceの試験を既存の用途固定Readerへ接続した。公開投影に含まれない区画の不変性は、同じ自己生成保存物の全文比較で確認する。Workspace時計例外は実Leaseと固定保存操作を通す元Oracleへ戻し、一件成功した。単発受付四件は同じWriterで全件成功し、受付前拒否・受付後失敗・即時取消・Owner喪失を区別している。Core CRUD・Repository入力・保存Consumer・codec・純粋遷移・Host観測の対象回帰は二十七件成功した。これらは別実行であり、全体回帰一回の結果へ合算しない。

独立確認で検出した`delivery_none`の変異先誤りは、Coordinator workerからprivate Source変異を撤去し、公開された配送入口の拒否・Effect 0・全bytes保全へ修正した。同分岐一件は実Windows保存で成功。private条件の反証はDomainの局所試験へ置き、実Reader全体やFilesystem保証と区別した。限定再レビューは残指摘零。hardlinkの初回EPERMは保持し、同一Caseを必要権限で実行した成功と区別する。

移管後のDomain保存Suite全体は、Windowsリンク拒否・pending再入場・16MiB境界を含む二十四件が一実行ですべて成功した。五Writer反証の移管も限定独立レビューで残指摘零。型検査、変更TypeScriptの整形・警告を失敗とするLint、Runtime／Task設計接続検査、Windows実行Profile四件は成功。台帳・公開境界の合同実行は四十一件中四十成功・一不合格で、残る七内部importを正しく検出している。七参照が含まれる複合試験と旧試験アダプター二Fileはまだ撤去できていない。変更中に継続している先行広域回帰は最終固定候補の根拠にせず、全面移管・アダプター撤去・固定全体回帰・最終独立レビューの完了は引き続き未宣言とする。

#### 保存の反例と実Host結合の分離

保存初期化・一回証拠・別Root・同bytes実体置換・hardlink・pendingの反例をDomain Snapshot I/Oへ移した。終了保存・履歴・配送の私有Context相関はDomain `runtime-settlement`、修復の用途固定・出版変異・回収進捗・同bytes I/O 0・履歴欠測の独立guardは`runtime-repair-storage`が所有する。合成Host／技術checkpointを実Host終了・Docker修復の根拠にしない。Coordinatorには実Host清掃から公開終了保存への結合と、実修復Callerの再入場・保持・終了保証を残した。

この実結合で初回修復の接続漏れを検出した。通常用途の`access.identity`ではなく、既存`settlements`が`runtime_repair`として保持する同一Contextだけを初期化証拠の鍵へ使い、後続Writerと一致させた。コピー・空Object・別kindの拒否、解放不明時の証拠失効とfinallyでの除去は不変で、新しいMap・Authority・回復経路は追加していない。限定独立レビューは残指摘零。

Domainの保存・終了相関・修復履歴の三Suiteは一実行で五十三件成功した。その後に追加した出版用途変異等を含む修復履歴二十九件、修復no-op一件、Coordinatorの実修復履歴・五中断点十一件、実Host現在状態二件はそれぞれ別実行で成功した。Coordinator側のgenerated試験接続で旧保存Moduleを直接呼んでいた漏れも、既存Host保存Adapterへ追従した。正常終了は`settling`と履歴確認済み・耐久配送待ちを共同確認し、unknownを成功へ書き換えていない。

旧`tests/support/storage-source.ts`は参照・Symbolとともに撤去した。残る`storage-adapter.ts`の未使用終端Writer・再exportを除き、内部importは七件から同Fileの二件へ減少した。公開境界検査はこの二件で引き続き不合格。検査の例外追加や生Writer公開はしていない。Task状態保存は型付き固定APIへ、試験全区画の観測は固定公開Readerと自己生成物の現行codec投影の照合へ追従中。通常Task受領・State Port二件と実行Profile四件は成功、台帳は407件でvalid。固定全体回帰・残アダプター撤去・最終独立レビューはまだ未完了である。AI再送・Docker照会／操作・過去保持物は操作していない。

#### 保存内部参照と旧試験アダプターの撤去後

上段は撤去途中の履歴である。現在は七つの保存内部参照をすべて移管し、`storage-source.ts`と`storage-adapter.ts`を参照・Symbolとともに撤去した。公開境界検査は内部import零で成功し、例外・生Writer公開は追加していない。最後の九つの生Writer呼出しは、用途固定のProject／統合結果APIへの追従と、Domain側への保存反例移管で解消した。Domainの保存区画Caseは、受付結合・Queue／Lease・結果・判断二世代・pendingの拒否と本文保全を確認して成功した。合成Lease観測は実Host・実Lease終了の証拠にしない。

実Host結合とCoordinatorの有限APIは維持する。試験開始値を直接配置する箇所は現行codecで検証した自己生成fixtureに限定し、製品Writerの出版成功とは区別した。旧Decision Store試験のOS一時領域への書込み拒否は、Repository内の実体確認付き試験Rootへ追従して二件成功した。MCPの局所実行で発生したlocalhostのEACCESは試験環境の通信制限であり、本番認可やTimeoutを変更せず通常実行環境で確認する。

Source／Owner境界の最終独立確認はMajor／Moderate零。最新状態の記録漏れをこの段落とProject Contextで是正した。固定候補のDomain／Coordinator全回帰、Windows結合と利用側確認は進行中であり、進行中の結果を成功へ算入しない。Workspaceの全区画比較で対象Queue世代の既存更新を検出したため、対象WorkspaceとQueueだけを期待差分へ明示し、対象外区画のexact比較を維持して再確認する。実データ移行・保存先変更・Core全体の単独成立はSource移管の完了と区別する。AI再送・Docker照会／操作・過去保持物は操作していない。

#### 動的内部参照の追加確認

上段の内部参照零は静的importの検査結果だった。独立確認で動的importとSource読取りの検出不足を認め、同じ公開境界検査を`import(...)`・`new URL(...)`にも適用した。追加八参照を例外扱いせず、保存初期Reader・transient終了Readerの五故障・回収とHost清掃の二Writer・結果受理decoder・修復モデルをDomainの既存試験Ownerへ移管した。CoordinatorにはHost／一回性／借用失効と有限の公開結果変換を残す。Root以外の公開や新しい試験用保存Adapterは追加しない。

移管後の公開境界・現在入場・再起動準備の合同三十八件、修復モデル二十件、decoderとCoordinator状態遷移二十九件は各別実行で成功した。回収WriterとHost清掃Writerは各九故障を維持する。独立レビューが指摘した部分fixtureを、正規操作準備と新codecで確認する完全Snapshotへ是正し、Host遷移後と清掃準備後も故障注入前に復号を確認して二件再成功した。これらは保存guardの試験で、実Host・Docker処置の証明ではない。Catalogは408件でvalid。

Windows結合の先行実行には、旧CLI引数、撤去済み受領field、旧保存Ownerへのmock登録という試験追従漏れがあった。現行`recovery resume`、四fieldの配送参照と結果領収書の不存在、実Host保存Adapterへの登録へ修正し、製品の拒否条件や期限は変更しない。人間向け回復案内の四箇所も同じ現行CLIへ追従した。各代表例の成功は確認済みだが、全条件の固定再確認は継続中で、先行不合格を上書きしない。

Domain／Coordinatorの全回帰とWindows固定再確認の終了結果は未確定。MCP／Workbench利用側34件は通常実行環境で成功し、制限環境でのlocalhost EACCESによる先行失敗とは別記する。現在の失敗試験Rootと過去保持物は強制回収せず保持し、今回許可されていないAI再送・Docker照会／操作は行っていない。

その後の自己横断確認で、現在入場試験がDomainの試験補助を経由して私有Storeを利用している接続を一件検出した。実Reader／初期化故障／短期Owner／物理境界のCase全体をDomainへ移し、Coordinatorには正式Rootと実Readerの結合、および有限結果の公開投影を残した。Domain側一件とCoordinator側四件は別実行で成功。Scannerはside-effect importを含む四構文とRepository内の相対参照閉包を検査し、内部Sourceへ到達する試験facadeを拒否する。中立fixtureは名前allowlistでなく依存内容に基づいて許可し、直達・中継の変異も検出する。十三件成功、最終独立確認は残指摘零。製品API・Source・安全判定・期限は変更していない。

Domain全体は一実行463件すべて成功した。この全実行後に移した入場Reader一件と強化Scannerは上記の別実行で確認しており、464件の単一runとは表示しない。CLI公開投影十四件、変更89 TypeScriptの整形・警告を失敗とするLint、Domain／Coordinator／MCP／Workbenchの型検査、Runtime／Task設計接続検査も成功した。Coordinator全体とWindows再確認は引き続き終了待ちである。

追従後のWindows固定再確認は十七件すべて成功した（約十五分）。CLI七形、Owner喪失五形、認証create例外五形であり、実Docker・認証情報は用いない。Domain全回帰、追加入場Reader、利用側34件とは別実行として扱う。旧候補の同条件不合格は撤回せず、試験引数／mockの追従後結果として記録する。文書検査は今回要求した八文書の指摘零、参照展開先に3376指摘が残る。移管した試験SymbolのQA参照二件を正しいOwnerへ追従し、独立確認は追加指摘零、Catalog408件validである。

Version Controlの既知Consumer集合にも旧保存三Pathが残っていたため、実移管先の四保存FileとHost側利用元へexact集合を追従した。三つのfresh子Processの公開Root検査は、Coordinator一・Domain保存I/O一・終了保存一の合計三を維持する。Domainの三型参照だけをstatic Named type importへ揃え、実処理・呼出し順は変えていない。初回十二件中四不合格、追従後十二件全成功と限定独立レビュー残指摘零を区別して記録する。現行のArchitecture・Quality・Source・配布入口に旧保存四File／旧試験Adapter二Fileの参照は残っていない。

Source区切りを`d6db2a557`としてcommit・pushした。進行していたWindows六Suiteの最終結果は120件中103成功・17不合格・取消零（約72分）。不合格は上段のCLI七形・Owner五形・認証例外五形と一致し、追従後の別実行17件すべての成功へ対応付く。先行run自体は不合格のまま保持する。保存・修復の13本体Caseとその負例、TaskのOwner喪失・Lease・判断・受領・Queue・受付相関の六Caseは先行runで成功した。単一runの120件成功には読み替えず、実Docker・AI・過去保持物への実境界成立も主張しない。

#### 全体回帰で検出した試験追従と実行環境の分離

Coordinator portableの先行全実行は終了値1であり、成功とは扱わない。削除済み保存SourceへのOracle、Host保存AdapterとDomainの二重mock登録、移管前のReader名、検証ToolのCatalog依存、Native依存mockの不足を検出した。現在Ownerへ試験を追従し、元の拒否条件・一回性・Effect零・相関Oracleを維持した。保存のController非依存OracleはDomainの既存Snapshot I/O Suiteへ移し、`ERB-IT-004`をSymbolへ追従した。製品Source・Timeout・安全判定は変更していない。

助言試験の実Repository依存も分離した。先行回帰時の`PROJECT_CONTEXT.md`は65,729 byteであり、既存65,536 byte上限による拒否は正しい。上限を広げず、既存の境界確認付き試験Directory helperで合成Gitと短いContextを作り、本番Reader・Packet固定・模擬Dispatchを検証する。助言八件は成功し、独立レビューの手組み清掃指摘を既存helperへの置換で解消した。境界helperを含む共通保存Suiteは制限環境でhardlink一件EPERM、通常Windows環境で十一件全成功だった。環境拒否を成功へ書き換えない。現在案内は移管要約の重複を削って65,536 byte未満へ整理したが、試験の入力は今後の文書増減に依存させない。

Windowsのproduction doctorとOperation作成の二件は、共有試験TEMP内の既存`crdd-coordinator-recovery-v1`が継承DACL・保護無効であり、Nativeが`terminal_descriptor_mismatch`で拒否した。既存物のACL修復・削除は行わず、新品のRepository内試験TEMPで同じ二件を実行して成功した。端末descriptorという理由名はConsoleではなく、Host記録Namespaceの保護検査を指す。既存TEMPの不合格と新品TEMPの二件成功を別結果として保持する。

対象追従の限定独立レビューは指摘一件を是正して残指摘零。公開境界十三件、Catalog408件、Coordinator型検査も成功。全体静的checkは整形・型・警告を失敗とするLint・Runtime／Task接続の全段を終了値零で通過した（Lintには既存の情報診断96件があり、警告・Errorではない）。新品TEMPを用いたCoordinator全体再回帰は進行中であり、その完了と追加Owner試験の最終確認前に全体完了とは表示しない。失敗試験Root・過去保持物の操作、AI再送、Docker照会／操作は行っていない。

Source固定候補は`d6db2a557`と`40_Develop`差分のSHA-256 `995df43d4a6cf27800924b8f11e8184e9e379c2ab04e608ddda4b666933b57b7`で特定する。この候補のDomain全実行は465件成功・不合格零・取消零（約7分31秒）。先行463件と差分試験を合算した値ではない。Domainの整形・型・警告を失敗とするLintも終了値零。今回更新したProject Contextと本計画の文書指摘は零で、参照展開した過去CHGのリンク切れ23件は別範囲として保持する。先行の八文書から展開した3376指摘とは対象集合が異なり、その全件是正又は全体QA合格を主張しない。

#### 指定範囲の最終結果

上段の進行中表示は経過記録である。固定候補のCoordinator portable全回帰は1,797件中1,792成功・不合格零・取消零・skip五件、終了値零（約88分52秒）で終了した。skipは明示Gateを有効化していない実Docker関連四件と実Provider一件であり、成功へ算入しない。Host Windows専用Gateはportableの選択範囲外で、先行120件と追従後17件の別実行結果は上段のまま保持する。Domain465件、利用側34件、Version Control十二件も別実行であり、単一runの総数へ合算しない。

今回の保存内部参照七件と後発の動的八参照の移管、旧試験Adapter二Fileの撤去、関連利用側・試験の追従、対象非AI回帰と独立レビューは完了した。公開境界十三件は内部Sourceへの試験facadeも拒否し、例外・互換Adapter・生Writer公開を追加していない。Source・文書のレビュー指摘は是正して残指摘零。最終Source差分Hashも上記固定候補と一致し、整形・警告を失敗とするLint・diff checkは終了値零だった。

今回新設したexact試験TEMP `C:\project\CRDD\.crdd\tests\storage-final-env-vhGiiB` は全試験終了後、Root・非Reparse・空のHost記録Namespaceと自己生成Nodeキャッシュだけであることを確認して通常削除し、不存在を確認した。既存の不一致Namespace、先行失敗Root、過去保持物には触れず、ACL修復・強制属性解除・Docker照会／操作・AI再送は行っていない。実データ移行・保存先切替・Core全体の単独成立・実AI／Docker E2E・CRDD全体QA／Release完了は、このSource移管の完了とは別である。現在、この指定範囲を閉じるための人間判断はない。

### Executorの生涯Ownerと通知の簡素化 — 2026-10-30

対象は単段Executorの内部整理と直接利用側の追従である。基準HEADは`7e4e8e9ce`。実AI・Docker・過去保持物の操作、Taskの計画・Queueの拡張は対象外とする。

| 項目 | 実装上の処置 | 維持する保証 |
|---|---|---|
| 構成・準備 | Factoryと旧planの入力構築を`attempt/preparation.ts`へ集約 | 一回消費・選定・Authority・元入力 |
| 一試行 | 旧controllerの生涯Ownerを`attempt/execute.ts`へ改名 | 開始・取消・join・同じ回復参照 |
| 隔離接続と清掃 | 固定Command検査と清掃後のMount／回復終了を`attempt/isolation.ts`へ集約 | 正常Docker清掃は下位Sessionで一回。executeが順序と待機を所有 |
| 結果 | `result/attempt.ts`へ開始拒否と最終結果の純粋構築を配置 | 八開始拒否組合せ・五条件×三状態の終端相関 |
| 通知 | 通知原本・コピー・失効の二Mapと三照会APIを撤去 | 固定Host callbackの同期保存、拒否時の要求停止 |
| 終端保存接続 | 既存DurableRecordへcallbackで初回の結果・観測を固定 | 操作／回復参照一致、別値上書き拒否、既存Domain Contextから読取り |
| 未発行確定 | 元Ownerとpurposeを専用Writerへ直接渡す | 短期排他内のintent_saved再確認、汎用Writerの迂回拒否 |

独立した`cleanup.ts`は設けない。生涯の責任はexecuteに残し、isolation内の終了接続に新しい状態・Map・監視・Lockを持たせない。通知原本の照会API廃止は内部Host契約の変更であり、旧API互換層は追加しない。Control・準備・是正証拠と下位清掃の実体検証は別責務として維持する。

着手前の独立確認では要求前の同期保存と専用Writerの保証維持を照合した。終端観測の二重差替えの指摘は、既存recordの初回固定と完全に同じ入力だけのno-opで是正した。本番Host型は三callbackを必須とし、候補試験のoptional契約とは区別する。

途中結果としてExecutor非AI試験42件成功、整形・型・警告を失敗とするLint成功、台帳422件valid。利用側115件の一実行は113成功・Windows実子孫終了2件不合格であり、同じ2件を通常Windows実行環境で再確認して成功した。単一runの115成功とはしない。DomainのReader／終了保存8件は別実行で成功した。最終配置変更後の固定全体回帰・最終独立レビューは未完了であり、この内部整理だけから実AI／Docker、全体品質やRelease成立を主張しない。

#### Executor公開IFの現在形

公開名をExecutor／Attempt中心へ変更し、createExecutor・createAttemptPreparation・ExecutorHost、開始結果AttemptStartResultと最終結果AttemptResultを明示した。準備OwnerのconsumeForProcessControllerはconsumeへ変更し、成功部分PreparedAttemptと成功／拒否unionのAttemptPreparationResultを区別する。公開型は既存ReturnTypeから導出し、別の状態や構造型を増やしていない。

Rootは65項目から41項目（実行時値22・型19）へ整理した。Providerを含む公開名は零であり、provider fieldやProvider実体の区別を撤去した意味ではない。外部の結合試験が使う四入口は試験用途として明示して残す。内部Key・Command・完全計画検査・計画構築・汎用data helperをRootから撤去した。Workbenchの診断試験は私有Keyの公開に依存せず、合成Provider応答のAI Adapter投影を利用する。

途中で助言形式IDをExecutor名へ変更したが、最終方針はそのIDの公開ではなく不要なタグ自体の撤去である。ADVICE_INPUT_CONTRACT／ADVICE_RESULT_CONTRACTと各版番号はExecutor Root・入力型から除去した。Coordinatorの私有Packet Hash用情報はCoordinator内部に閉じ、Executorで照合しない。AIへcontract／contractRevisionの応答を要求せず、既存Schemaに従う四区分とstatus・本文・根拠参照を検査する。内部の助言結果wrapperの形式タグと受入照合も撤去した。Taskに同様のタグ検査を追加して対称化しない。形・容量・重複Key・曖昧JSON・根拠参照・清掃・相関・同期保存の保証は維持する。

旧形式を受ける互換層や自動移行は追加しない。今回の新Prompt／Schemaへ利用側を同時追従させ、過去Evidence・保持物や実AI結果を新版の結果へ書換えない。新形式の実AI確認は今回実行しない。

非AIの直接利用側四Suite35件とWorkbench診断14件は別実行で成功、台帳422件valid。前段の保存結合8件・通常Ownerの二形2件は別実行で成功しており、公開名変更後の全体回帰へ合算しない。最終Executor回帰と独立レビューの終了は別に記録する。

#### Task／Adviceの共通入口・出口と中間処理の非公開化

対象はTask／Adviceの単段実行APIと直接利用側であり、実AI再送・Docker操作・過去保持物の操作は行わない。準備は`prepare(AttemptInput)`一つへ統一し、purpose別の閉じた入力で元Packetの必要参照を区別する。開始・取消・completionは同じExecutorを使い、内容は`AttemptContent`の用途別unionで返す。新しいQueue・Map・Lock・Registry・互換ラッパーは追加しない。

| 処理 | 現在のOwner | 処置 |
|---|---|---|
| Task／Advice共通準備・単段生涯 | Executor attempt | 入口と終了結果を統一。生涯のOwnerはexecuteのまま |
| 助言内容・Schema・許可参照検査 | Domain attempt/advice.ts | 純粋な内容検査を移管。Provider差は持たない |
| 助言Command結合・Hash | Docker Isolation execution/binding.ts | 既存field・Hash順序・同意前の結合を維持 |
| 是正所見の一回使用証拠 | Coordinator execution/preparation.ts | 同じ操作・初回レビューだけを登録・一回消費。Executorに発行Mapを残さない |
| Provider出力の解析 | AI Adapter | Task／Adviceとも既存parseProviderResultへ接続 |

Executor Rootから`normalizeTaskResult`、`normalizeAdviceResult`、`describeAdviceResultSchema`、`consumeTaskRemediation`、`hashAdviceCommand`、`bindAdviceCommand`を撤去した。この共通化時点のRootは37項目（実行時値16・型21）。内容Schemaを使う上位はDomain、Docker構成を使う上位はDocker Isolationへ直接接続する。旧六入口の互換公開はない。

独立確認の2指摘（許可fieldの公開型欠測、二回目レビューへの使用不能許可発行）は是正した。callback成功・欠測・例外を実Executorの有限Command代役で確認し、レビュー内容完了と次試行許可を分離する。欠測・例外時は許可なしとし、Coordinatorは次試行を拒否する。生所見を通常結果へ追加せず、現在Authority・同意・Workspace・終了保存の検査は維持する。

非AIの別実行結果は、Executor全40件、両Provider準備・DI代役47件、助言直接利用側19件、Command／Packet24件、Task Packet・助言実行利用側30件、Domain保存・内容11件、Workbench診断14件が成功した。重複を含む選択なので合計件数を作らない。Executorの整形・型検査・Lint、関連六Packageの型検査、台帳424件valid、40_Develop全1009FileのLint error／warning 0を確認した（既存info 98は別区分）。

広域Coordinator回帰は進行中。制限環境ではWindows試験用junction作成1件と実子孫終了2件が不合格で、同じ3件を通常環境で再実行して成功した。判定は緩和せず、別runの結果を単一run全成功へ合算しない。固定差分の独立レビューとlint4件の限定再確認は残Must-fix 0。実AI／Docker再成立、全Repository品質又はReleaseの完了は主張しない。


#### 公開入力と内部Packetの粒度整理

公開準備入力はAttemptInput一つとし、AdviceInput／TaskInput／ConsumedTaskInputを内部のAdvicePacket／TaskPacket／ConsumedTaskPacketへ改名した。AdvicePacketはRoot非公開。Coordinatorは公開PreparationHostのcallback型から必要な返却契約を導出し、私有Module importや構造複製を作らない。検証scriptの私有型importは同じExecutor Package内に限定する。

追加でAdviceResultItemのExecutor再公開を撤去し、利用側はDomainの正本から直接参照する。TaskResultとAdviceResultは同じ一試行内容として同じexport群へ置く。Rootは35項目（実行時値16・型19）となった。field・Hash・保存・実行挙動は変更せず、旧名と内部Packet名のRoot非公開を既存の公開境界試験で確認する。型/公開境界の独立確認はSource残指摘0、文書旧名1箇所の追従是正を完了。

#### Docker構築の重複統合と単段Executorの責務確定

Docker計画は単なる移動ではなく、準備時と開始直前に重複していた構築を統合した。Executor内のProvider実行仕様の結合を一つにし、具体的なImage・Proxy・Mount・認証環境・Seccomp構成はDocker Isolationの`bindProviderCommand`だけが構築する。準備時は明示tokenから構築し、開始直前は元Commandから同じ構成を再確認する。開始直前の検査は構成自体を返し、検査後に別の構築を繰り返さない。固定Digest・Network・Mount・Commandの安全条件は維持し、準備側に残っていた四つの重複判定も撤去した。

| 責務 | 正本Owner | 今回の整理 |
|---|---|---|
| Provider実行仕様・出力解析 | AI Adapter | Probeも既存の共通解析入口へ接続。認証結果の二重解析を撤去 |
| Docker具体構成・資源清掃 | Docker Isolation | create／verifyの有限入力で一つの構築処理を使用。Authority・Task管理は受け取らない |
| 一試行の準備・実行・通知・終了待機 | Executor | 上下位の結合と順序管理に限定。開始前照合・清掃後の結果通知を維持 |
| Task／Advice内容の意味検査 | Domain Model | Taskの形・Path・件数・レビュー所見の純粋検査を移管。Providerや許可発行は持たない |
| 後続試行・是正許可 | Coordinator | 既存Ownerを維持。ExecutorにTask計画・再試行判断を追加しない |

Executorの回復理由変換は現行Host契約の七理由へ縮小した。Producerのない旧値は既存の確認不能結果へ閉じ、元の回復参照・清掃判定・耐久保存条件を変更しない。新しい状態、Map、Registry、Lock、互換中継又はRecovery機構は追加していない。

最終候補の非AI確認は、Executor全40件、AI Adapter全29件、Docker Isolation関連41件、Coordinator準備・隔離接続46件、Provider実行・Task Packet・回復投影等36件、Domain内容四件がそれぞれ成功した。重複する選択を合計件数にしない。関連七Packageの型検査、Executorのcheck、台帳426件valid、40_Developの1012FileのLint error／warning零を確認した（既存info98件は別区分）。独立レビューの構築重複指摘と試験説明の旧名を是正し、限定再レビューは残指摘零。

先行候補で開始した広域回帰は338件中334成功・四不合格で終了した。Windows制限環境のjunction一件・子孫終了二件は通常環境で同じ三件を再確認して成功。残る助言試験一件は許可参照の入力欠測と旧結果wrapperへの期待を現行契約へ追従し、関連三件の再実行が成功した。この広域実行はSource更新中に継続していたため、最終固定候補の全件成功とは表示せず、別実行の結果を合算しない。

実AI、Docker、過去保持物の照会・操作は行っていない。今回の完了は上記Source責務整理・対象非AI確認・独立レビューの範囲であり、実境界E2E、Repository全体QA又はRelease完了を意味しない。現在、この範囲で追加の人間判断は必要ない。

#### 単段実AI試験の端末確認撤廃 — 2026-10-30

人間が会話で送信内容・モデル・回数・回収範囲を承認した後にも端末コードを要求する二重確認を、検証Toolだけから撤去する判断を明示承認した。`verify-provider-real.ts --run <provider> <run-id>`は端末の有無によらず明示実行できる。承認は呼出し前の運用前提であり、CLIが会話の承認を機械検証するという意味ではない。恒常的な無承認実行許可、製品入口の同意・認可変更、承認台帳又は新しいFrameworkは追加しない。

TTY検査・乱数確認コード・確認ReaderとそのUIだけを削除した。固定Provider／モデル／合成Prompt・引数拒否・RootとGitの照合・単一子・元Recovery参照ACK・期限・取消join・清掃条件は維持する。`--describe`と不正引数はEffect零、承認済みの正しい`--run`は一回実行、既存Rootは拒否、終了不明・入力不整合は既存の保持結果へ閉じる。過去Evidenceは変更しない。

対象六試験は非AIで成功した。独立レビューのP2一件を是正し、stdin／stdoutの両方が非TTY、確認Reader呼出し禁止、確認プロンプトなしの条件で既存の正常・取消・異常close・IPC不一致・保持／限定清掃を検査する。整形・型・Lintと、最終Executor全40試験は成功した。独立再確認の文言P3も同期済みで、残Must-fixは零。実AI送信・Docker作成削除・再起動・Image更新・過去保持物操作はこのSource変更と非AI回帰では行っていない。

#### 端末不要化後の両Provider単段実AI結果 — 2026-10-30

会話の用途限定承認を受け、上記非AI回帰・独立確認後にCodex `EXEC-20261030-02`とClaude `EXEC-20261030-03`を順番に各一回実行した。基準Commitは`be73d0ddc`に上記の試験CLI変更を適用したSourceで、実行中にSourceは変更していない。送信は両方とも固定合成Contextと正式Schemaだけ、Prompt SHA-256は`214e2c38c50edb5e2affc4c6579d2cd543c7321e40848b2cc31a42232d3d2bd3`。Repository／Workspaceのmount、tools、session永続化、API key fallbackは使用しない。

| 項目 | Codex | Claude |
|---|---|---|
| Model／推論 | gpt-6.1-sol／medium | claude-opus-5-5／medium |
| 固定Image | sha256:112a73d8576b6aa3e04db76b5fee98a0f5636f5ca539ef039aa555ccd9b76de3 | sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f |
| 終了値／状態 | 0／completed | 0／completed |
| 内容検査・終了保存・技術清掃・排他解放・Native終了・子close | すべてtrue | すべてtrue |
| 結果bytes／SHA-256 | 693／27c68edcb52b6e84618b1f1de760d198df135c3af7464417ca20caff0039172d | 2306／e88ff4d83a8e2cdde9ca3761b6a46afeaf6934d11ca907683858d6949221e44f |
| 試験Root清掃 | true、不存在確認 | true、不存在確認 |

共通Proxy Imageは`sha256:4270d4dc5c3cddd9733712eb202309a51250b858a53e68882889edc88f413766`。事前にEngine linux 29.8.1、固定三Image、稼働Container零を読取り確認した。両結果は一次故障null、Provider開始・Process tree終了・Container／Network不存在観測true。終了後一覧に今回Networkはなく、exact試験Root二件も不存在だった。既存停止Container二件と既存Networkは操作しない。

Codexのexact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.5d74592838624664e076f82ad82a92be4cb81439d60f24a63f3f34850bb61fa6.804fa54f803660e7ccd991881ced0c2c7339453fee3e5e7cb34da9f061ba2f1a`、Claudeは`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.ead2cab3759421f75af4b66e57b780d098d057be83a602002b5729324db7876e.976a6487b17226cc918f04b067f425275d83ee25494ee8765bfef2d37afaf625`である。生Provider本文・認証値は保存しない。再送、Docker起動／再起動／修復、Image取得／更新、過去保持物操作は行っていない。

この合格はExecutor単独の固定合成読取り助言を両Providerで確認した範囲に限定する。編集・レビュー、Direct／Isolated、Workbench／MCP／Coordinator連携、全体QAやReleaseの新しい合格根拠へ拡張しない。

#### 単段Task検証とCodex reviewer暫定制約の再評価 — 2026-10-30

人間はCodex編集→Claudeレビュー、Claude編集→Codexレビュー、両Provider開始後取消の最大六試行を承認した。モデルはGPT-6.1 Sol／mediumとOpus 5.5／medium、送信は固定合成File・指示・差分だけ。各CLIは一試行しか実行せず、六回の上限は実行者が承認済みrun一覧を逐次実行して管理する。新しい上限台帳・Runner・Queueは作らない。途中失敗では追加送信を停止し、当該資源の既存清掃又は保持だけを行う。

非AI事前確認で、Codex GPT-6.1 Sol reviewerはAI AdapterがCode ModeのTool制限未検証として拒否することを再確認した。これは公式非対応の証明ではなく、Commit `c875b8899`で採用したCRDDの暫定制約である。人間は今回この制約の解除可否を確認することを追加で承認した。

製品Sourceのguardは変更しない。試験fixture `codex-review-candidate.ts`だけが、明示したreview候補Processで元Source Hash `dc9d18fc01d3188403a53fc86fa29db7136c0001be72c7090ba422b20682cd70`・canonical URL・exact二行の一箇所を照合してProcess内で置換する。適用は親とIPC子で各一回。通常入口は引き続き拒否し、別用途・Provider・余剰引数・Source差・不正IPCを拒否する。候補一回は承認済み六試行のCodex reviewer一回に数え、追加送信しない。

reviewerがFileを自分で読むという先行の試験案は現契約と不一致だったため訂正した。両Providerとも固定の合成内容・差分をstdinの読取り投影で渡す。各試行は新品Rootを使い、編集で検査したexact bytesとHashが同じ内容をレビュー入力へ再構成する。物理Workspaceの引渡し、Coordinatorの順序制御又は全E2Eとは主張しない。Code Modeで全Tool禁止を証明したとは扱わず、観測可能なCommand／FileChange各零とworkのbytes／Identity不変、正規結果、元終了保存・清掃・Home解放・子closeを別々に確認する。

既存単一子監督を共有して有限modeだけ追加した。Taskの入力と物理Oracleは`scripts/task-trial.ts`、元Control・Receipt・同期保存・DI清掃は既存Host、close後の既知Fileと空Directory回収は既存親CLIが所有する。試験結果はv2へ更新し、`contentConfirmed`・mode・非Authorityの合成fixture実体receiptを閉形式で搬送する。未知File、partial、link、nlink差、Identity変更、取消成功／通常成功の取違え、欠測、保存・close不明は保持。過去v1記録や過去保持Rootは操作・自動移行しない。

##### Codex reviewer候補一回の停止と非AI切り分け

最終候補のExecutor全42試験と整形・型・Lintが成功し、独立レビューの二指摘（候補workerへ正常specを接続する反例、開始通知重複）を是正して残指摘零となった後、`EXEC-20261030-04`を一回だけ開始した。Model／mediumとTask Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`、Proxy Imageは上段の固定値。Prompt Hashは`289d5129dcb144993e5224fd32e4d773b5ffc6e5c05cd238b0c30bcf1523af7a`、合成内容Hashは`096e4d095df60962108e4627846909dbdee1d35965f7892c2af0a6961b37c101`だった。

結果は`blocked / trial_completion_unconfirmed`、親Tool終了値1。子closeは確認済みだが回復参照と受理結果はnull、今回Rootにはoutcomeの確定Pairだけが残った。Root／run-idは`C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261030-04`、元outcome Hashは`8894c41a78f2baeccb9456a2d01b6514d564ffb12cee8d1c2450f28a4b6511cc`。元記録の再評価時刻は2026-11-06T08:06:55.477Z、protocolFailure true、unexpectedStdout false、result nullである。Docker前後一覧は既存停止Container二件・既存Network四件のままで、試験資源は増えていない。回復参照ACKを経る開始経路へは未到達であり、この停止をCodexレビュー又は制約解除の可否を示す実測としない。再送は行わず、他の五試行も未開始とした。

非AIでは、候補loaderを継承するESM Workerが`review_candidate_entry_invalid / exit1`となる一方、CJS eval Workerは正常に動く差を再現した。実排他WorkerもESMかつexecArgv継承であり、今回停止と整合する。ただし当時の有限準備結果が受理されなかったため、元停止の内部理由の一意な直接観測ではない。最小是正は試験loaderの適用をmain threadへ限定すること。IPC子は独立Processのmain threadなので候補適用を維持し、補助Workerにはhookを追加しない。

併せて、Task準備拒否のfixtureReceipt nullを親の閉形式検査が拒否し、有限理由を失う不一致を修正した。元回復参照未発行・未ACK、blocked、結果／終端／清掃未成立の閉条件だけで元理由を保持する。ACK後のexact参照照合、成功判定、技術清掃条件は変更しない。補助ESM Workerの正常終了と、親が準備拒否をprotocolFailureへ畳まず保持する非AI二試験は成功した。製品guard、実AI再送、Docker再起動、Image更新又は過去保持物操作は行っていない。

独立確認により、回復参照未発行の受理理由も実Sourceの五つの固定準備理由へ限定した。null・任意文字列・取消／清掃系理由をこの経路で受理せず、負例を追加する。既存event-001から元参照を再観測できたのに結果の参照がnullである場合もprotocolFailureを維持する。増えた親試験Caseの一Process実行は既存30秒監督を超えたため、Caseを通信・相関とfixture・準備拒否の二つの相補集合へ分け、各Processの30秒と製品Timeoutは変更しない。

今回のexact Rootは、子close、Docker一覧の不変、許可名が既知outcome pairだけ、非link・単一link、元Hashとrun-idの読戻しを確認した。元結果は上記に記録したまま、Domain既存の確定Pair削除でこの一組だけを回収し、空Rootの実体不変を再確認して非再帰削除・不存在を確認した。OSのProcess一覧照会は権限不足で観測不能だったため、表示された空件数をProcess不存在の根拠には使っていない。元試験CLIの子close確認と、所有する実資源の既存保証を区別する。既存Container、Network、過去保持物は操作していない。再試験は未実施であり、Codex reviewerの暫定制約は未解除である。

最終修正候補のExecutor `npm run test`は、整形・型・Lintと全43試験が終了値零、失敗・取消・skip零で完了した（約77.3秒）。先行の42成功や30秒監督による不合格を合算・改変しない。独立Source再確認は残Must-fix零で、回復前の固定理由・補助Worker除外・通常guard維持・相補Case分割を確認した。今回のCodexレビュー候補は失敗記録のまま保持し、この非AI成功を実AIレビュー又は制約解除の成立へ換算しない。次に必要なのは修正版候補の一回再試験に対する人間の承認であり、自動再送は行わない。

##### 修正版Codex reviewer候補の承認済み一回結果

人間の再承認後、`EXEC-20261030-05`を同じ合成内容・GPT-6.1 Sol／medium・固定Task／Proxy Image・同じPrompt Hashで一回だけ実行した。事前にEngine linux 29.8.1、固定二Image、稼働Container零、新品Rootを確認した。製品の暫定guardは変更せず、Source Hashは試験前後とも`dc9d18fc01d3188403a53fc86fa29db7136c0001be72c7090ba422b20682cd70`で一致した。

| 観点 | 実測結果 |
|---|---|
| 親Tool／内側結果 | 終了値0、両方completed、reason null |
| レビュー内容 | 正規approved・finding零、contentConfirmed true |
| 観測可能なTool分類 | Command開始0、FileChange開始0 |
| 合成作業領域 | exact内容・単一link・元DirectoryとsourceのIdentity不変を確認 |
| 技術終了 | Provider開始、Process tree終了、Container／Network不存在の観測true、一次故障null |
| 終了保存・解放 | terminalSaved／releaseConfirmed／nativeCleanupConfirmed true |
| 親子終了・試験Root | childCloseConfirmed／Observed true、fixtureCleanupConfirmed true、Root不存在を再観測 |
| 結果本文の扱い | 生本文非保存。809bytes、SHA-256 `2e48c8f0f7705fd1ef2a0d5d148765471d551d29b97e76efc237d59af6dc6463`のみ記録 |

exact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.fef1e48f6a18f35cb8afbc3cec2e4f06037f9a6241d567030d42a2cea7597505.da0bc84a86fa2aab352af3b959231dc766fd8639b88cc0c36bc4926d25c0e98e`。今回Rootは`C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261030-05`であり、終了後に不存在を確認した。既存Container二件は同じID・状態のまま、Network名は既存のbridge／host／jarvis_default／noneだけだった。組込みbridgeのIDのみ`355950117cb7`から`f79de70036ff`へ変わったことを別観測として記録する。原因は未調査で、Docker再起動・修復を発行した根拠又は全環境不変の根拠にしない。今回の所有Networkは元実IDで回収・不存在確認済みであり、既存カスタムNetworkのIDは不変である。

この成功は、固定条件でCodex Code Mode reviewerの正規レビューと終了生涯が実行可能だったことを示す。Code ModeのすべてのTool呼出し・ファイル非読取りを証明せず、未観測Toolを零へ補完しない。正式なguard撤去又は権限方針変更はまだ実施していない。前回失敗は変更せず、追加送信・再試行、Docker再起動、Image更新、過去保持物操作は行っていない。他の編集・レビュー・取消試行の成立へ拡張しない。

##### 通常入口のCodex編集と試験清掃の追従（2026-10-30）

`EXEC-20261030-06`の編集内容と物理Fileは一致し、内部結果はcompleted、一次故障null、技術清掃・解放・終端保存・内容確認・子closeは成立した。結果本文は保存せず、1803bytesとSHA-256 `d88166ca8e851b13c7df9c4d6fbb56dfe8db31b1a7767320b09df8e459333ba6`を記録する。一方、既知Codex tmp生成物の清掃が未対応で、親Tool終了値1、公開結果blocked／trial_completion_unconfirmedとなった。後続07〜11は停止し、再送していない。

今回Rootは`C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261030-06`。元outcome Hashは`a12cb6547a0a261664b574890fb2b499e164f98268291e19f3ae1b1cda007a5c`、再評価時刻は2026-11-06T08:38:44.135Z、protocolFailure／unexpectedStdoutはfalse。元回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.b2d9fbdb3bb91add053a5341f46adf57b82c05897b163b26eac7a64087f32dde.a0486511cce0c127d9290a67b9562f66104a43ec999ab3f102486ff4f9a86fe0`である。

非AI照会では、daemon領域は空、bwrap領域のlockは0バイト・通常File・非link・単一linkだった。これらだけをCodex Taskの有限清掃対象へ追加し、全棚卸しと削除直前の実体再照合を必須とする。未知内容・link・複数link・Identity差・観測不能は保持する。元不合格と追従後の回収結果を分離し、製品Recovery・再帰削除は追加しない。

清掃追従後のExecutor `npm run test`は、整形・型・Lintと全41件が成功し、失敗・取消・skipは零（約87.7秒）。独立Source／文書レビューは残Must-fix零で完了した。Codexの既知tmpの零件・単独・両方・空・lock0を受理し、非空lock・余分なFile・link・複数linkを拒否する反例と既存の親子実体変更反例を確認した。

今回Root06について、元outcome Hash、確定Pairの読戻し、非link・単一link、run-id、元resultとRoot Identityを再照合し、既存APIでoutcome pairを除去した後、同じ清掃関数へ元result／Identity／edit modeを一回だけ渡した。清掃trueとRoot不存在を直接確認した。元Tool終了値1は変更せず、正常編集の成立と追従後の清掃成立を区別する。Docker一覧も試験Container／Networkの残存なし、既存二Containerと四Networkは直前観測と同じID・状態だった。過去保持物操作・AI再送・Docker再起動・Image更新は行っていない。

全AI確認は未完了で、後続五試行は再開承認待ち。全項目成立後という条件を維持し、まだコミット・プッシュしない。

##### 残る五試行の再開承認後のClaudeレビュー（2026-10-30）

人間の再開承認後、Engine linux 29.8.1、固定Task／Proxy Image、新品Root五件と既存停止Container二件を読取り確認し、`EXEC-20261030-07`のClaude Opus 5.5／mediumレビューを一回実行した。合成内容・Prompt Hash・Imageは先行計画と同一で、実Repository本文は送信していない。

内部結果はcompleted／reason null、contentConfirmed true。Provider開始・Process tree終了・Container／Network不存在・cleanup・release・terminal保存・Native清掃・子closeは成立し、一次故障nullだった。生本文は保存せず、1795bytes、SHA-256 `ea61d5b35edf5f49f494ed9f365642722ddaa9f7868b664f398178eb4da75c92`のみ記録する。一方、親Tool終了値1、公開結果blocked／trial_completion_unconfirmed、fixtureCleanupConfirmed falseとなったため、08〜11の後続四試行は未実行で停止した。AIの再送・再試行は行っていない。

Rootは`C:\project\CRDD\.crdd\tests\executor-real-claude-EXEC-20261030-07`、元outcome Hashは`86bae882f8ce0a335ff788927194ae58e8fae55a6a86bd62d58c25812b20be22`、再評価時刻2026-11-06T08:54:43.765Z。元回復参照は`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.eec22054e88863718ff6c5f3c8ca352be84ea99c571c2b771ac0cd13f7f5ab46.e1d706e32d0e299327b0e91ebffcbdcc8b8386085a538642981e490e617a2563`。試験資源はDocker一覧に残らず、既存二Containerは同じID・状態だった。標準bridgeのID変更は別観測であり、全環境不変とは主張しない。

清掃不成立の原因は`tmp/claude-65534/fswatch-probe-AIjAix/probe`の残存だった。exact子一件、通常File・非link・単一link・2bytes、SHA-256 `8527a891e224136950ff32ca212b45bc93f69fbb801c3b1ebedac52775f99e61`を読取り確認した。既存の自動試験清掃はClaude親が空である条件なので、余分なFileを保持する挙動は契約どおりである。この観測だけで一般清掃の許可範囲を拡張せず、今回の実体・Hashを再照合する限定回収と、後続実行の扱いを分ける。全AI確認は未完了であり、コミット・プッシュはまだ行わない。

独立確認の残Must-fix零を確認後、Root07・元outcome pair／Hash・close・元result・全20イベントの確定Pairと参照相関・全inventoryを照合した。probeまでの各Directory Identity、File Identity・2bytes・単一link・指定Hashを削除直前にも再照合し、probe一件を通常unlink、空のfswatch Directoryだけを通常rmdirした。outcomeを再照合して既存APIで除去した後、元result／Root Identity／reviewを従来清掃関数へ一回渡し、清掃trueとRoot不存在を直接確認した。元不合格は改変せず、未確認のfswatch生成物をSourceの一般許可対象には追加していない。再帰削除・force・実AI再送・後続四試行・Docker再起動・Image更新・過去保持物への操作は行っていない。

##### 試験所有tmpの名前非依存清掃への変更（2026-10-30）

二回の実AI成功後に試験清掃だけが不成立となったため、人間はProvider生成物ごとの名前allowlistを廃し、終了後の今回所有tmpをまとめて回収する方針を採用した。変更は検証Toolだけで、Executor本体・AI Adapterの実行条件・Docker境界・Timeout・取消／元回復参照の意味を変えない。実AI再送、Docker操作、過去保持物への適用は対象外とする。

既存の元Root・確定イベント・技術清掃・Home解放・子closeの共同条件を維持し、tmp全treeを反復・逐次列挙で棚卸しする。通常File／Directoryだけを許可し、link・File複数link・特殊File・lexical／realpath差・観測不能を拒否する。metadataメモリ量の上限だけを合計10,000 entryとし、File容量・名前・階層の独自制限は設けない。本文読取り／Hash照合はしない。全棚卸し後、各削除直前にRoot・tmp・全祖先の実体と残る子一覧・対象FileのIdentity／mode／size／mtimeを再照合し、内側から通常unlink／rmdirする。tmp全体が完了するまでwork・management・確定イベントを除去しない。

初回棚卸し不成立は削除零、処置開始後の同時変異・Filesystem失敗は対象の処置前に停止し、先行tmp削除は巻き戻さない。既存Rootと結果を保持して未完了を返す。新しいLock・監視・Registry・Recovery・原子的削除Framework、再帰force削除は追加しない。Sourceの着手前独立照合では、本文を読まない清掃にFile容量上限を追加する必要がないことを再確認し、metadata entry上限だけに絞った。

最終候補のExecutor `npm run test`は、整形・型・Lintと全41件が成功、失敗・取消・skip零（約105.2秒）。独立レビューのRoot直下inventory再照合不足一件を是正し、最初のtmp削除前・各tmp削除前・work前後・各確定Pair前・用途Directory前・Root最終削除前に元Root実体と残る名前集合をexact比較する。期待集合は正常削除後だけ更新する。Rootへの遅延File追加でtmp削除零・既存イベント不変・追加File保持、途中unlink失敗で先行空Directory不存在・失敗File残存を直接確認した。再レビューは残Must-fix零、`git diff --check`も成功した。この非AI確認は残る実AI四試行の成立へ換算しない。今回、実AI・Docker・過去保持物の操作はなく、全AI確認後というコミット・プッシュ条件も維持する。

##### 残る四試行の実AI確認と回収完了（2026-10-30）

人間の実施指示後、Engine linux 29.8.1、既存の固定Task／Proxy Image、新品Root四件を読取り確認し、以下を通常入口で各一回、逐次実行した。合成source.txt・固定指示・内容／差分だけを使用し、GPT-6.1 Sol／mediumとOpus 5.5／medium、Image、Timeout、送信・取消条件を変更していない。

| 試行 | 確認対象 | 内側の正規結果 | 親Tool・今回Root |
|---|---|---|---|
| EXEC-20261030-08 | Claude編集 | completed、内容と実File一致、1972bytes、SHA-256 `0b49930e6cfe9b7ce4e59dd5c42cf19c1ae1f7906a4a32ad95b8c329d7d1c0d6` | 終了値0、清掃成立・直接不存在確認 |
| EXEC-20261030-09 | Codexレビュー | completed、正規レビューと物理Oracle成立、817bytes、SHA-256 `ea45b5fb6225162a5c259dfa3eb31be548e66f1d63d34ac263e66710ac0b21b0` | 終了値0、清掃成立・直接不存在確認 |
| EXEC-20261030-10 | Codex開始後取消 | cancelled／provider_operation_cancelled、cancellationConfirmed true、結果Hash null／0bytes | 終了値0、期待した取消と清掃成立・直接不存在確認 |
| EXEC-20261030-11 | Claude開始後取消 | cancelled／provider_operation_cancelled、cancellationConfirmed true、結果Hash null／0bytes | 終了値0、期待した取消と清掃成立・直接不存在確認 |

全四試行でProvider Process開始・Process tree終了・Container／Network不存在・cleanup・Home解放・終端保存・Native清掃・親子closeはtrue、一次故障null。取消試行のcontentConfirmed falseを正常結果受理へ読み替えず、開始通知後の同Controlへの一回取消と終了joinを確認した。遠隔Provider側の内部処理停止までは主張しない。Codexレビューの観測可能なCommand／FileChange開始はともに0だが、全Tool不使用証明や追加Gateへ昇格しない。本文・認証値は保存しない。

元回復参照は次のとおりで、最初の結果から終了まで同一参照を維持した。

- 08: `docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.00c7026202e5ddc4d5767a252d4e129bb5d66663994bf9ade81b4003834f4829.8eace28914856129eacf4274c63b7f92a84d395fe3fae1b20a3874fac8a27c0c`
- 09: `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.2d27fed4f566fbc901da8c2f6f720766d790b7b458e4287f4df9b34709bc220f.2febb123595d2a48bbca9cb630dcb2caabdecad5761dc18b2726065d9a16d9b4`
- 10: `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.e143edcd33944ed8329442de460dc964546c26ddfb72305d69ab71b50ff32b64.f7f06a1d09d35122463a7ec403a06063a027b7a5fb622ac4103613ec04d331a2`
- 11: `docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.00ad2d8667d3b4c9e2202bc0fc228d0d809cd1845e73135b4f1b275be9bae7f6.8286241b84e34993ba363086dc0d3ddac4a8e6525596ccbf36b6d502f0c9f444`

今回Rootは`.crdd/tests/executor-real-claude-EXEC-20261030-08`、`executor-real-codex-EXEC-20261030-09`、`executor-real-codex-EXEC-20261030-10`、`executor-real-claude-EXEC-20261030-11`の四件だけで、親の清掃trueに加え終了後の直接照会でも不存在を確認した。Docker後一覧は試験資源なし、既存二Containerの実ID・状態と既存カスタムNetworkは保全されている。標準bridgeのIDは事前`2d3bda916e30`から事後`7eb2236f1a9c`へ変化したことを別観測として保持し、原因や全環境不変を断定しない。Docker再起動・修復・Image更新・既存資源削除・過去保持物操作は発行していない。

今回予定した両Providerの編集・レビュー・開始後取消の機能確認は、06〜11の限定結果で完了した。06／07の親Tool不合格は履歴上そのまま保持し、内部機能成功と後から確認した限定回収を区別する。08〜11は修正後の名前非依存清掃を含めTool終了値0だった。既存の助言実確認と併せ、単独Executorの承認済み固定条件の確認結果であり、全Provider障害、上位連携、物理Workspace引渡し、全体QA又はリリース準備完了へ一般化しない。自動再送・追加AI試行はしていない。

##### Executor・AI Adapter・Docker IsolationのDomain非依存化（2026-10-30、進行中）

人間はこの三PackageについてDomain Modelへの依存を外し、新しい共通ライブラリは設けず、永続化の方法・保存先・読戻しを上位Ownerが所有する境界を採用した。他の五PackageのDomain依存は今回の撤去対象にしない。試験Harnessの合成記録は製品の永続化とは分け、製品公開RootとsrcからDomainをロードしないことを完成条件とする。実AI・Docker・過去保持物の操作は行わない。

| 対象契約 | 宣言・処理Owner | 上位の責務／維持条件 |
|---|---|---|
| Provider・Effort・Model選定の技術値・Turn診断 | AI Adapter | Repositoryの選定設定・選定理由・保存世代はDomain／Coordinator |
| Provider入力／出力の検査 | AI Adapter | 保存形式とは分け、未信頼入力の拒否を維持 |
| 一試行の入力・技術結果・通知 | Executor | 完全な保存選定を上位で照合し、確定した実行情報を渡す |
| Docker回復DTO・技術遷移・回復ID | Docker Isolation | callbackで上位へ通知し、上位が保存・再入場を所有 |
| 現在状態・Task／Operation・保存Writer | 既存Domain／Coordinator | 保存Schema・Version・履歴・exact回復参照・一回使用保証を無断で変更しない |

最初にProvider共有四型の実宣言をAI Adapterの既存provider/typesへ戻し、Domainはtype-onlyで利用する。内部型の値域・readonly・optional性は変更せず、既存公開名も維持する。残る実行時のDomain検査参照がある間は移管途中であり、この型単位だけを非依存化完了又は独立した確定候補としない。各段階で静的型検査・公開型・既存正常／不正入力反例を確認し、最終候補はDomain解決を拒否した新品Processで三公開Rootのロードを反証する。新しいStore・Lock・監視・Recovery・保存用の中継Frameworkは作らない。

###### AI Adapter先行移管の結果

AI AdapterのsrcからDomain参照を撤去した。四技術型はprovider/types、入力捕捉は内部provider/input、JSON応答解析は内部provider/jsonが所有する。Domainは四型をtype-onlyで利用し保存形式は不変。新Package・保存・Authorityは追加しない。双方を相手Package解決拒否で新品Processへ読み込めること、発行理由と保存受理理由のexact一致を確認した。DomainからAI Adapterへのruntime理由参照案は独立レビューで拒否し撤去した。

AI Adapter check・31件、利用側6Packageの型検査、試験台帳426件valid、独立再レビュー残Must-fix零。Domain checkも終了値0だが既存informational lint 19件は残る。広域保存試験は初回95／99成功で、実ハードリンクを制限環境が拒否した4件を自己生成Rootに限る実行条件で別途確認し全件成功した。先行Executor40／41は親fixture子の30秒超過による不合格として保持し、保存試験終了後の単独回帰はcheck・41件成功（約105.5秒）。Timeout・安全判定は変更していない。初回結果と別確認を合算して広域全体Passにはしない。

Catalog単独importの循環は依存なしinputへ分離して是正した。Windows Node 24.19の不正Schema未捕捉終了時のlibuv assertionは、試験子が期待するModule拒否をcatchして理由と終了値1を返す最小追従で解消した。製品側の拒否は維持する。Docker Isolationのcheckpoint／回復ID、Executorの保存選定・Domain内容検査への依存は残っており、三Package全体は未完了。実AI・Docker・過去保持物は操作していない。

###### Docker Isolationの技術契約と上位保存の分離

Docker IsolationのsrcからDomainへのimport／再exportを撤去した。Desktopの技術checkpoint型と純粋な検査は既存docker-desktop配下が所有し、Domainは保存Schemaの受理検査を独立して維持する。全field・enum・不正値・accessor／Proxy・freeze・実通知列の契約照合で意味の一致を確認する。callbackの回数・通知時点・保存確定待ち条件は変更しない。回復ID解析も同じ文法を維持し、保存用Probe tokenとは区別する。

実際のProbe記録Reader／Writerは、唯一の製品ConsumerであるCoordinatorのstate/probe-recordへ全体移管した。Schema、Hash、token、実体照合、原子的保存手順は変えず、Docker Isolationの公開Rootから保存APIを撤去した。関連する実Consumer、試験、coverage母集団、同一Symbol ID、Architecture／Qualityを追従する。新しい保存先・Store・Lock・互換層は追加しない。

Docker Isolationのcheckと通常297件は295件成功・失敗零・実Docker条件付き2件skip。Coordinatorの保存・診断Consumer関連40件と既存Host操作排他49件も成功した。新品ProcessでDomain／Coordinator解決を拒否したDocker Isolation公開Rootの読込みと、逆にDocker Isolation解決を拒否したDomain公開Rootの読込みを確認した。実AI・Docker・過去保持物は操作していない。

広域命名検査は既存のRust名、Executor公開Root母集団、MCP Header、制限環境のlink作成拒否で6件不合格を残す。dynamic Fake Provider coverageの実行も、受動診断のHost記録初期化失敗とNodeの実験機能警告で未成立。対象7 Suiteを通常実行して32／33成功・診断初期化1件失敗を確認した。今回のProbe保存移管専用試験の成功を、これら広域検査全体のPassへ換算しない。独立レビューは別途最終候補へ実施し、ExecutorのDomain依存撤去は次段階に残る。

独立レビューの新技術Symbol二件と既存repair-machine試験の接続漏れを是正した。対象18件とCatalog 426件validを再確認し、再レビューの残Must-fixは零。Source境界・上位保存移管の限定成立であり、広域coverage／Checker未成立と三Package全体の未完了は維持する。今回、人間の追加判断は不要である。

###### Executorの応答内容境界の先行移管

ExecutorのDomain非依存化は、結果境界、完全選定、局所入力・技術理由の順に分ける。最初の結果境界では、Provider応答のTask／Advice内容検査とSchemaをAI Adapterの既存provider配下へ一実体移管する。Domainに残す保存受理codec案は、実際の保存Consumerがないことを確認して棄却した。元UTと安定Symbol／Test IDを移し、Domainの旧実体・公開APIは撤去する。Executor・Coordinatorの直接助言経路・検証Toolは応答Ownerを使用する。Schema bytes・Command Hash・理由・返却形・freeze・許可参照を維持し、Domainの保存Schema・Writer・遷移は変更しない。

汎用JSON parserはAI Adapterの内部へ隠し、Coordinator／Workbenchの一般JSON読取りはDomainの既存公開APIへ戻す。新しいcallback・Store・Packageは追加しない。是正許可は既存Coordinatorが所有し、Task内容正規化で発行しない。実AI・Docker・過去保持物は対象外。完全選定の上位検査・技術投影と、Executor内部の技術理由／入力取得の整理が残る間は、Executor全体を非依存化完了としない。

移管元Git基準の二Sourceと、移管先の本文をコメント・import・空白を除いて比較し、両方同値を確認した。これは今回だけの移管確認とし、将来の正当な改訂を妨げるSource Hash固定試験は追加しない。恒久契約は元UTと全拒否理由・Schema SHA-256 `e07a0664795c7db8387927bf9c63fb565f7ec4e105f897d2ecf972d4dac27ff2`、両Providerの固定Command Hashで確認する。

一実体移管後のAI Adapter全36件、Executor check・全41件（約104.6秒）、Domain公開境界13件、Coordinatorの直接助言・Packet・準備57件が成功した。Domain checkは終了値0で既存informational lint19件を残す。Coordinator／Workbenchの型検査、Catalog426件valid、Symbol観測13 manifestのIssue零も確認した。前段DI試験の非公開Domain参照はRootへ追従し、専用APIを増やさず公開prepare／decodeと明示的な拒否条件へ照合して対象12件成功を確認した。

Workbenchの合成HTTP利用側は初回7／10成功・3失敗だった。専用合成子の一回診断で`connect EACCES 127.0.0.1`を確認し、接続制限のない条件で同じ10件を再実行して全件成功した。初回を成功へ改変せず、15秒期限・安全判定・本番処理は変更しない。実AI・Dockerへの通信はない。

独立レビューはSource・公開入口・一実体・利用側・文書の残Must-fix零を確認した。追加の文書検査で、旧Task内容UTの`RCM-UT-016`がDomain Outcomeの検証項目を誤参照していた既存不整合を確認した。安定Symbol／Catalog IDと試験本文を維持し、レビューで意味を照合した既存`ERB-UT-023`へHeader・Symbolの対応を修正した。過去Evidenceは変更しない。これは①の限定成立で、②完全選定と③局所入力・技術理由、三Package全体、全体QAは未完了である。

最終の文書検査は対象五文書の指摘零・Symbol指摘零で、Local ID不整合の解消を確認した。scope拡張に含まれる過去CHG等のbroken link／anchor 3,356件は残り、検査全体の終了値は1のままである。対象範囲の成立をRepository全体Passへ換算しない。独立最終確認は残Must-fix零。

###### Executorの技術選定・局所入力と上位保存の接続

Executorの製品Sourceから残るDomain参照を撤去した。完全選定はCoordinatorが既存Grantの一回消費点で検査・Hash算出し、Executorへは技術六項目と不透明なselectionHashだけを渡す。準備と開始の両方で用途・役割・Model・Effort・識別種別・Packetの相関を検査し、Process内の試行Identityを技術値とHashへ変更する。保存SchemaのIdentityとは区別する。

完全選定が既存v2回復Identityに必要なため、既存Operationの管理recordへstage別固定五slotだけ保持する。独立確認で最初の単一値案は二段目レビューを拒否すると判明し、編集0／1・レビュー0／1・助言0へ修正した。同slotは完全一致のみ、異なる再結合は拒否する。借用は有効Owner・ID・Hash・attempt・exact六項目を再検査し、旧保存Ownerへだけ完全値を渡す。保存形式・回復ID・失効・再入場は不変で、新Map・Registry・Lock・永続状態は追加しない。

用途限定の入力捕捉と許可参照検査は内部attempt/validationへ、技術理由の発行集合は内部result/validationへ置く。Domain保存受理とのexact parityを固定し、Proxy・accessor・特殊prototype・欠測・余剰・疎配列を拒否する。一般的な公開Snapshot APIを作らず、技術検査からAuthorityを発行しない。Source・公開入口・上位接続・保存Identityの独立レビューは残Must-fix零。

局所6件、Coordinatorの対象非Host167件、実Operation結合・借用2件が成功した。Coordinator checkは終了値0（既存informational lint 98件）で、台帳426件valid・Symbol 13 manifestのissue零を確認した。先行の広域対象実行には制限環境のHost操作／rename／symlinkによる不合格を残し、非Host結果へ合算しない。Executor全回帰は旧fixture追従後42／43成功で、残る親CLI合成試験は30秒子期限超過だった。同じ試験の単独確認は成功したが全回帰Passへ換算しない。既存62ケースを重複・欠落なしに21／10／9／13／9件へ分け、子期限・Oracle・本番処理は維持して最終回帰を確認する。実AI・Docker・過去保持物は操作しない。

最終の固定SourceでExecutorのcheckと全43件が成功した（約109.3秒）。親CLI試験の全62ケース、子の30秒期限、取消・清掃Oracleは不変であり、分割による欠落・重複零を独立確認した。先行の42／43不合格と単独成功は履歴として維持し、この最終一実行の結果と混同しない。三Packageの製品SourceにはDomain参照がなく、保存を上位へ閉じたSource境界の整理は完了した。Repository全体QA、既存の広域coverage／文書履歴指摘、実AI／Dockerでの再検証成立へは一般化しない。現在、追加の人間判断は不要であり、コミット・プッシュは未実施。

最終文書確認は今回の対象五ファイルの指摘零、参照展開先を含む既存指摘3,356件で検査全体の終了値1を維持した。追加したQuality本文を既存Checklistの外へ配置し、項目集合・配置契約は変更していない。独立確認のSource／保存境界と試験分割の残Must-fixは零。

##### 人間判断による暫定拒否の撤去と通常入口への復帰

前段の「全Tool制限の未検証を理由にguard維持」という判断は、今回の人間判断で変更する。既存のDocker隔離・用途別Mount・レビューのread-only条件・認証領域保護・通信制御・元回復参照・取消と回収を保護境界とし、全Tool不使用証明を追加の起動／完成条件にしない。Dockerが許可Mount内の読取りまで禁止するとは主張しない。過去の未検証判断や実測記録はそのまま保持する。

AI Adapterの`codex_task_reviewer_code_mode_not_verified`二行を撤去し、計画契約を改訂17へ更新した。既存のCLI設定・Model／Effort・read-only sandbox・root deny／minimal read／workspace read／CLI read・never承認・Shell／unified exec無効・Code Mode公式Hostとin-process fallback無効・通信条件は変更しない。特殊Source置換loaderと専用試験／symbolを削除し、両Providerの通常Task APIと通常IPCへ戻す。件数が一件でも正規review・物理Oracle・終了条件が成立する非AI反例を追加し、Tool観測件数は診断に限定する。

今回の実AI再確認は通常入口で六試行を逐次実行する。`EXEC-20261030-06` Codex編集、07 Claudeレビュー、08 Claude編集、09 Codexレビュー、10 Codex開始後取消、11 Claude開始後取消。各一回、合成source.txt・固定指示・内容／差分のみ、同じGPT-6.1 Sol／mediumとOpus 5.5／medium・固定Imageを使用する。各試行は新品Rootで、レビューは編集成功時の検査済みexact bytes／Hashと同じ内容を投影する。物理Workspace引渡しや上位連携は対象外とする。どれかが失敗すれば後続の送信を停止し、自動再試行・Docker再起動・Image更新・過去保持物操作を行わない。全項目が成立した場合だけコミット・プッシュする。

## Executorの隔離接続・共通検査の整理（2026-10-31、対象非AI確認完了）

基準Commitはab58b98b7。人間承認した既存Sourceの責務整理として、isolation.tsをAI Adapter／Docker Isolationの構成結合とSession開始・清掃・相関の接続へ限定する。通常Root・保存・契約値・Timeout・実行許可・Home解放条件は変更しない。Current Repository内だけを編集し、実AI・Docker・既存保持物は読取りも含めて操作しない。Sourceと設計・QAの独立レビューを実施し、準拠基準・Release判断は変更しないため準拠・Release監査は適用しない。

着手前確認では旧Sourceの九関数・内部五関数、通常createExecutorからの接続、./testingとCoordinator試験Consumerを照合した。基本検査を全廃してDIだけへ委ねる案は、Home取得前の用途・選定・Mount拒否を失うため採用しない。完全照合だけへ統合して二度構築する案も不採用とし、共通の基本条件をattempt/validation.tsのisAttemptPlanValidへ本文同値で一実体化する。startはHome取得前、resolveValidatedPlanは構築前に同じ関数を呼ぶ。完全照合側は本文byte・Path・Advice Hash・Provider仕様相関と全Command一致を追加し、基本条件を再定義しない。

編集単位と対応は次のとおり。①基本検査をvalidationへ移し、executeと試験入口・基本検査Suiteを追従。②製品利用のないstartCommandと契約説明を既存executor-test.tsへ移し、既存Coordinator試験は同入口を継続利用する。試験用投影は製品の正規構成照合とplanIdentityに接続し、製品単一Command APIの成立証拠にはしない。③非秘密診断をresult/attempt.tsのcreateConfigurationNoticeへ移し、executeの直接通知と既存観測Suiteを追従。④現Ownerと責務をArchitecture・QA・関数Headerへ反映する。planIdentityの対象field・直列化順序、元結果・exact回復参照・清掃未確認の保持は据置く。新File・API・Registry・永続化・Lock・監視は追加しない。

正常は三用途と編集／レビューの正規構成、負例は操作・Grant・選定・Offering・Mount・Home四Hash・Command外形、境界は128KiB／超過、完全条件はPath禁止文字・Advice Hash・Command差で照合する。基本不正はSession要求前で零、完全条件不成立はnull、所在や清掃観測不能は従来どおり未確認とする。元のplanIdentity・清掃結果相関と任意診断の失敗非波及は既存結合試験で確認する。追加の人間判断は不要。

対象検証結果：最終版のExecutor npm testは静的検査・型検査・Lintと全51件が成功（約98.9秒）。Coordinatorの型検査と利用側五Suite・171件も成功した。独立レビューで診断の実搬送Oracleと移管先File Headerを補強し、固定候補の再レビューで残Must-fixは零。診断は製品経路でconfigured／settled各一回、操作相関と秘密非搬送、同期例外／非同期拒否でも同じ完了結果・清掃を確認した。差分空白検査も成功。新File・公開API・保存単位は追加せず、通常Rootは不変。実AI・実Docker・過去保持物は操作しておらず、Repository全体QAや既知のHome解放条件の別件完了とは扱わない。コミット・プッシュは未実施。

途中のWindows取消試験は制限環境で5秒以内のProcess終了を確認できず失敗した。Process制御を許可した同じ試験では終了を確認できたが、既存cleanup代役の五資源観測欠測で成功側がblockedになった。基準Commitの五Sourceをメモリ内で読込んだ同条件でも再現し、今回の製品変更による退行と区別した。該当fixtureだけ、成功側に同じfixture.resourceObservationsを搬送し未確認側はnullを維持する最小是正を実施。成功側の公開回復参照null／終端観測の元ID、未確認側の結果の元ID／終端未保存、同じ五観測、実子孫終了・清掃各一回を確認した。製品の5秒猶予・安全判定・Home解放条件は変更していない。Docker資源はすべて模擬であり、実Docker不存在の根拠にはしない。

## Docker関連の関数束・通知境界の整理（2026-10-31）

基準Commitは5f40bfa7e4。人間承認した通知専用規約の適用として、Docker Isolation、Executor、Coordinatorの直接接続と試験を対象にする。実AI・Docker・過去保持物は読取りを含め操作しない。変更分類は複数Package間の実装契約・責務整理。既存ArchitectureとCoding Standardsを着手前に照合し、別確認者が安全・失敗・取消・Owner生存の観点を確認した。Source・設計・Qualityの独立レビューと直接利用側の影響確認を行う。準拠基準・決定権限・Releaseは変えないため、準拠・Release監査は適用しない。

編集の対応は①allowCommandを撤去し診断初期化を既存発行予定通知へ統合、②実行Sessionの予定・未発行・実ID・観測・内容通知をvoidへ統一、③Executorの認証・内容判定の拒否をthrowへ接続、④修復の保存可否問い合わせを撤去しOwner確認と保存失敗を上位ハンドラー内で扱う、⑤再起動前の保存ACKをonRequesting通知へ変更、⑥公開型・直接利用側・検証Tool・試験・Architecture・Qualityの追従とする。新File・Registry・Lock・永続State・Worker・ACK Frameworkを追加しない。

既存保証の対応：認証不成立・Command失敗・内容不正は後続要求を止める。通知待ち中の取消はラッチし、次Effectを発行しない。元Receiptは通知より先に技術Ownerへ保持し、通知例外でも同exact IDで回収する。修復の通知例外は再送しない。取消後の既発生事実の記録は新Effectの許可から分離する。通知・上位保存の失敗で確認済みcleanupを未回収へ戻さない。未知・Owner喪失・Scope差は安全な拒否を維持し、最後の元回復参照を保持する。

関数束全体の棚卸しでは、authenticationのpermitLive、cleanupのassertOwner／assertBeforeRemoval、disposeのboundary、DirectoryのcanIssue、repairのcanIssueEffect、restartのverifyBoundaryをEffect直前の借用元生存観測として維持する。固定Booleanへの置換はawait後失効の保証を失うため採用しない。borrowPaths／inspectReceiptsは検査済み既存Ownerの用途限定読取りとして維持する。同責務の技術代役は既存の内部操作Interfaceに限定し、上位Store操作を注入しない。

2026-11-01時点の対象結果：Docker Isolationはcheck終了0・通常300件中295成功／5スキップ、Executorは最終Sourceで全51件成功。Coordinatorは最終Sourceの直接影響六Suite・167件、Windows実Writerの通知・保存切断窓14件、Windows現在HostのCLI接続6件・引渡し失敗1件がそれぞれ成功した。修復結果26件は上記167件にも含まれるため重複加算しない。これらは別実行であり、全体一実行の合格へ合算しない。対象五文書のChecker指摘は零、参照展開先の既存3,356件により検査全体の終了値1を維持する。

独立レビューで通知結果の未追従を是正した。実行SessionのnotificationDeliveryConfirmedは通知呼出しなしnull、同期又は許可された非同期通知完了true、例外・不正返却falseとし、falseはstickyで以後のonFailureを含む通知を止める。元Receipt・一次故障・技術cleanupは上書きしない。同期／非同期のArchitecture、Inputとhelper Header、Checklist前の本文配置、失効後通知の例外Oracleを再照合し、独立再レビューの残Must-fixは零。既存の保存Schema実値は不変である。

先行回帰の失敗は成功へ書き換えない。検証用summaryの二重正規化と旧ACK期待は是正後に対象再確認した。Junction／Repository／Workspace／CLIの制限環境での不合格は、必要な権限がある別実行で成功したが、実行条件の差を保持する。Process安全状態のoriginPendingAtGate不一致は、基準5f40bfa7e4の変更対象製品Sourceをメモリ内で復元した同じwriter_cleanupでもfalseを再現し、今回の変更前からの不合格と分離した。期待値・安全判定を緩めていない。当該時点の広域回帰二本は継続中で、全体QA成立を主張しない。制限環境で清掃未確認となった今回の合成試験物は保持し、過去保持物は操作しない。

今回のWindows制限環境で保持した合成Rootは、C:/project/CRDD/.crdd/tests/配下のcurrent-host-transition-QeXoFo、current-host-transition-MOlULA、current-host-transition-yokSl5、current-host-transition-f3N4znの四件（作成2026-10-31 23:46〜23:52 JST）。本体Repository・Credential・過去保持物ではなく、今回の試験の失敗窓だけを対象とする。清掃未確認を回収完了へ変換せず、CRDD保守担当が2026-11-07までに同じRoot・残存参照・使用中Process・合成内容を照合して既存の清掃へ戻す。期限のみを理由に削除せず、確認不能なら保持理由と次判断を更新する。新しい回復機構・保持Registryは追加しない。

Windows実保存の広域二Suiteは88件中78成功・10不合格で終了した（約4,368秒）。現在HostのCLI三形と引渡し失敗の四件は、合成CLI子のspawnSync ETIMEDOUTで、四Rootを上記のとおり保持する。別実行の同じ四経路は成功したが、並行負荷・権限制約等の寄与は分離していない。修復Owner側の五つの負例とその親一件は、実行開始時に読み込んだ旧false期待による不合格であり、例外期待へ追従した最終Sourceの対象14件は別実行で成功した。元の広域結果を合格へ換算せず、実Dockerの再起動・修復・資源観測・過去保持物操作は行っていない。Coordinator通常広域回帰は継続中。

非AIの正常・負例・境界：通知未登録、同期void、待機可能な通知の完了、誤Boolean・Promise・thenable・例外、待機中取消、認証拒否、Receipt通知失敗、全九修復slotのOwner失効・Scope差・取消と既発生unknown、再起動前拒否と受付後通知失敗・元子join、返却後通知0を既存Suiteと追加下位シナリオで確認する。実Docker不存在・実AIの再成立・Repository全体QAは今回の主張対象外。現在、追加の人間判断は不要。

### 通知整理後のExecutor実AI再確認（2026-11-01）

上記の非AI作業後、人間がExecutor実AI確認と成功後のコミット・プッシュを指示した。送信境界を既存の単独試験へ限定し、Codexはgpt-6.1-sol／medium、Claudeはclaude-opus-5-5／mediumを使用した。既存Subscription認証を既存隔離経路で用い、送信は合成Context又はsource.txtと固定指示だけ。本体Repository本文・秘密値・過去保持物は渡していない。固定Imageを使用し、取得・更新・Docker起動／再起動／修復・自動再送は行わない。Engine 29.8.1応答と稼働Container零、必要な四固定Imageの存在を読取り確認した。

既存verify-provider-real.tsを変更せず、各項目一回ずつ逐次実行した。全体の終了値は0。以下の実行IDはEXEC-20261101-CALLBACK-を共通接頭辞とする。結果Hashは内容検査に成功したProvider標準出力のSHA-256、byte数はそのUTF-8 byte数であり、生出力本文は保存していない。

| 末尾ID | Provider | 確認内容 | 結果 | 結果Hash／byte数 |
|---|---|---|---|---|
| 01 | Codex | 助言 | completed | abd954932363c768d918ec0889cbaa1ae3c502a26bb96106bd1639c4ef60bf10／697 |
| 02 | Claude | 助言 | completed | 5d5900ee149f90ece341bf4158a4df4261dc1ccff187abc6b66881bb70c26679／2305 |
| 03 | Codex | 編集 | completed・実File一致 | 95e5c295e86dd4120e266a8c67039f91d36694c19df27bbab729c489a723ff75／2055 |
| 04 | Claude | レビュー | completed | cb1a442e1bb9b13da5f8a46f96dae18e853e8ffc519e60b9677f23f20128b2c4／1795 |
| 05 | Claude | 編集 | completed・実File一致 | b4b2df648b33307b1187b238096f4734f98ad116c6571d6a092c5f988106afdf／1972 |
| 06 | Codex | レビュー | completed・Tool開始零 | ac50b9fbbe5733e804e189f215daf53aef9980aca0e601c05148444500bb2db8／814 |
| 07 | Codex | 実開始後の取消 | cancelled・取消確認 | 結果本文なし／0 |
| 08 | Claude | 実開始後の取消 | cancelled・取消確認 | 結果本文なし／0 |

八件すべてで子Process close、Process tree終了、Container／Network不存在、cleanup、Home解放、終端保存、今回試験Root清掃を個別に確認した。fixtureRoot／reviewAfterはnull、保持記録は不要。最後に今回八Rootの不存在と稼働Container零を再照合した。過去保持物と上記Windows非AI試験の四保持Rootは操作しない。

独立確認で試験入口から製品start／cancel・executeAttempt・Isolation Sessionまでの接続を照合し、新たなMust-fixは零。成立範囲は試験専用Host経由の八回の単段Lifecycleであり、公開createExecutorの準備入力を含む全面E2E、上位三Packageとの連携、複数Attempt、Direct／Isolated全体、Git統合、外部送信前取消、Docker修復・再起動の実境界を証明しない。非AIの直接影響回帰・独立レビューと合わせて今回変更を区切るが、継続中のCoordinator通常広域回帰と既知の全体QA不合格は別途追跡する。

## Coordinator通知契約の限定整理（2026-11-01）

基準5837fb4286。人間の採用方針に基づき、開始通知、助言Operation生成、選定・送信案内、境界診断の四系統だけを対象とする。変更分類は既存Package内の実装契約・停止条件の責務整理。着手前にCoding Standards・Coordinator詳細・QAと全直接Consumerを照合し、独立確認者が保存失敗・取消・重複・最終join・exact回復参照の保持を確認した。技術・品質の独立レビュー、対象文書・影響先確認を行う。準拠基準・決定権限・Releaseは変えないため準拠・Release監査は対象外。新しい人間判断は不要。

編集単位は①必要開始処置のvoid／Promise<void>と一回保存・保存失敗例外、②Operation生成通知の保存完了と既存失敗理由への変換、③任意案内表示と認可Queryの分離、④診断の不要Boolean廃止、⑤既存types／Source内の通知interface・直接試験・Architecture・Qualityの追従とする。通常の保存・認可・現在Owner確認は操作APIのまま。P2の準備操作束改名、Observation Port全体の再編、その他void通知の統合、Attempt Recovery依存移管は別作業とする。新Source、Registry、Queue、ACK管理、永続状態、Workerを追加しない。Executor／Docker Isolation製品Source・公開契約は不変。既存Executor試験組立ての通知Consumerだけを追従し、Docker試験一箇所の改行だけを整形する。

開始の同時・重複通知は同じ一回の保存Promiseへ結合する。Reviewer・是正実行でTask開始を二重保存せず、終端後・取消後通知は拒否する。保存拒否はハンドラー内でthrowし、初回開始Promiseの最終joinでは元Task完了を失わず既存の結果分岐へ戻す。Task間の開始保存直列性・最新世代・成功Setを維持する。助言Operationの保存失敗はworkbench_ai_advice_operation_save_unconfirmedへ変換し、保存失敗前に取得した参照も保持する。表示・診断の未登録・同期例外・非同期拒否は受動処置とし、認可・同意・取消の通常検査は既存位置のまま維持する。通知の正常returnは必要処置の完了であり、単に保存を非同期発行しただけのreturnを許さない。

予定検証は、正常・保存throw／reject・通知欠落・同時重複・待機中取消・終端後通知、拒否後joinでも同じRecovery IDと清掃成立／不明の各観測を保持する反例、表示の未登録／throw／rejectと認可肯定／拒否の組合せである。実AI八件成功の既存記録は保全し、今回の外部AI再送・実Docker・過去保持物操作は行わない。通信名・保存Schema・期限・実回収条件は変えない。限定回帰と独立レビューの最終結果は、終了後に本節へ記録する。

初回の独立レビュー三指摘を是正した。Task開始通知型はTaskの既存types.tsが所有し、Executionだけが型参照する。開始保存の元Promiseは生成時から拒否を捕捉し、同じPromise・失敗フラグを最終joinにも保持する。新品子Processでcompletionを遅延させ、下位が通知Promiseを保持しなくても未処理拒否零・保存一回・元IDと清掃観測の維持を確認した。選定・送信表示は既存Lifecycle Reporterの有界なwrite／error／close監視へ接続し、元表示prefixを維持する。三prefixの正常write・close先着・非同期write error、通知後のListener零を確認した。新しい出力機構や保存状態は追加しない。Core依存六件と追加反証二件は成功し、固定候補を再レビューする。

是正後の固定候補は、通知直接四SuiteとCore依存を合わせて336件成功（約6.1秒）、Coordinatorの整形・型・Lint・二つのTrace検査が終了0。既存102件のinformational Lintは別に残る。Executorは試験Consumer追従後のcheckと非AI全51件が成功（約123秒）。独立再レビューは残Must-fix零で、確認者自身のCore依存六件・遅延通知等四件も成功した。初回の旧Boolean期待・Junction／実子孫試験の制限環境での不合格は、期待追従と必要なProcess操作許可下の別実行成功と区別する。安全条件・期限は緩めていない。

対象文書のChecker指摘は零、参照展開先の指摘3,376件による全体終了1は保持する。追加の保存・Task進行六Suiteは継続中であり、その完了や前作業からの広域回帰を今回336件の成功へ合算しない。Executor／Docker Isolationの製品Source・実AI八件記録は不変で、今回の実AI・実Docker・過去保持物操作は零。P2とAttempt Recovery依存の整理は未着手。コミット・プッシュは今回の限定整理ではまだ実施していない。

利用側追加確認で旧Boolean期待三箇所（task-execution、public-operation、single-task-state）を検出し、awaitした正常voidのundefined期待へ追従した。独立確認は追加Must-fix零。追従後の単Task Adapter接続・同Workspace直列実行・依存／競合予約の三つの実保存ケースは全件成功（約185秒）。既存模擬通知五箇所の不要true返却も除去し、開始・境界診断等の対象六件が別実行で成功した。公開操作・単発受付二Suiteと前述六Suiteの全体終了は引き続き確認中で、進行中結果を全合格へ補完しない。

前作業から継続していたCoordinator通常広域回帰は終了1となった。制限環境のJunction・Host初期化・既知のProcess安全状態等の不合格を含み、実行途中に後続のSource・試験追従も行ったため、この広域runを現候補の固定全体回帰の根拠にしない。今回の限定成功と分離し、全体QA未合格を維持する。再起動・実AI再送・保持物の強制清掃は行わない。

## 任意通知の拒否捕捉と回復進行の分離（2026-11-01）

人間が採用したP0として、結果配送参照の通知、記録結果の二次通知、回復診断の三発行箇所だけを是正する。既存の変更分類・独立レビュー・文書／影響先確認の経路を継続し、着手前の別確認者が同期捕捉と後着・滞留・回復結果の保持を照合した。必要な保存処置と真のQuery／Operationは変更せず、任意通知の直接呼出しをtry／catch内で発行して返却Promiseの拒否も直後に捕捉する。回復診断のAdapterは同期voidで戻り、Objective側の既存awaitが診断完了を待たず通過する。

結果配送の同期捕捉を遅らせず、欠測・重複・終了後・保存未確定の判断を保持する。記録操作がunknown／部分成立なら、その同じ結果を通知へ渡し、Task成功から記録成功を推定しない。任意通知のPromiseは独自に保存・join・再送せず、後着処置は拒否消費だけ。本番Reporterは既存の有界なwrite・直列化・dispose・故障後停止を維持する。通知元は新Listener・Timer・待機キュー・Registryを作らず、外部ハンドラーが自分で持つI/Oや永続pending自体の終了保証を追加しない。全通知のasync化、通知Interface再編、読取り操作束の契約分離、準備操作束の改名は後段へ分ける。新API・Source・永続状態は追加しない。

予定する反証は同期throw、即時reject、後着reject、永続pendingと、元Task／回復結果・exact参照・技術cleanup・記録unknownの保持。既存Reporterの終了・取消・失敗後停止も局所回帰へ含める。外部AI・実Docker・過去保持物は操作しない。別作業で進行中だった公開操作・単発受付二Suiteは14件成功（約424秒）。それを本是正の固定候補の回帰へ合算しない。保存・Task進行六Suiteは旧Boolean期待一件の不合格を含んだまま継続しており、その一件は期待を追従した単独三ケースで成功した事実と分ける。

本P0の限定回帰は六Suite・321件成功。既存Reporterの直列化・error／close・timeout後の遅延通知・disposeを対象にした別実行八件も成功した。実保存を通した記録結果通知の一試験は四条件（throw、即時reject、後着reject、pending）で成功し、記録unknownとTask完了を別々に保持した。これらは別実行であり、件数を合算して全体QA合格としない。Coordinatorのcheckは終了0（既存informational Lint102件）、git diff --checkも終了0。独立レビューの残Must-fixは零で、確認者自身の対象二Suite・37件も成功した。P1の読取り操作束・Observation Port再編とP2の命名は未着手。今回の実AI・実Docker・過去保持物操作は零。

対象六文書のChecker指摘は零。参照展開先の既存3,376指摘により検査全体の終了値1は維持する。この検査結果をRepository全体QAの合格へ読み替えない。

## 読取り・記録操作と通知の契約分離（2026-11-01）

人間が指示した残り三点を一つの内部契約整理として実施する。変更経路は実装詳細と直接利用側の追従であり、Coordinator詳細・QA・Coding Standards・直接Source／試験を着手前に照合した。別確認者の着手可を受け、同期捕捉、未設定／unknown、通知の非Authority性、Provider準備順序を維持する。技術・品質の独立レビューと対象文書・影響先確認を行う。準拠基準・決定権限・Releaseは変えないため、それらの監査は発火しない。追加の人間判断は不要。

編集の対応は、①Single Task入力のobserveResultDeliveryをbindResultReaderへ変更し、controller、dispatchと直接試験を追従、②CoordinatorExecutionObservationPortを撤去し、recordTaskAttemptをDependencies直下の通常操作へ、observePublicationだけを既存types.ts内のTaskExecutionCallbacks interfaceへ分離してobjective本番組立て・Task試験・unitの契約確認を追従、③ProviderDockerPreparationCallbacksをProviderPreparationOperationsへ変更し、その固定準備関数の引数名もoperationsへ揃える、の順とする。検証専用Adapterの別関数束は対象外とする。

Readerの値型CoordinatorTaskResultDeliveryは再利用し、新Reader型・互換中継を作らない。欠測・null・重複・終了後の同期捕捉不成立と後着拒否の捕捉を維持する。記録操作は同期結果を返す既存順序のまま、未設定はnot_configured、例外はunknown。記録の部分成立・exact参照を通知成功から変更しない。任意通知だけvoid／Promise<void>とし、待機せず拒否を消費する。通常の保存APIを通知へ変えない。新Source、Dispatcher、Queue、Registry、Timer、永続状態、Workerは追加しない。保存Schema・通信契約・Timeout・回収条件は不変。外部AI・実Docker・過去保持物は操作しない。

固定候補前の照合では、上位objective本番組立て、dispatch、Single Task Adapter、記録未設定／記録例外／通知失敗、二Providerの正常準備・検査拒否・取消、Core依存を確認する。静的checkは終了0、直接六Suite80件とCore・準備等の別三Suite33件は成功した。実保存を通すTask接続・記録通知の追加確認と独立レビューは実行中であり、全体QA合格は主張しない。

独立レビューは残Must-fix零、確認者自身の二Suite37件も成功した。試験内のReader受渡しに残ったnotification表現だけをbindingへ揃え、同Suite33件を別実行で再確認した。最終checkは終了0、既存informational Lint102件は不変。Core・実行Runtime二Suiteは制限環境で274件中271成功／3不合格（Junction作成EPERM、実子孫の終了観測二件）となったため、安全判定を変更せず必要なProcess／Filesystem操作権限で同二Suiteを再実行し、274件全成功した。元の不合格を成功へ書き換えず実行条件を区別する。同Workspace二Taskの実保存・明示品質受入は別実行一件成功。対象六文書のChecker指摘は零、参照展開先3,376件による全体終了1は維持する。既存の広域QA不合格を今回の限定成功へ合算しない。コミット・プッシュはまだ行っていない。

最後の実保存確認は五件全成功（約285秒）。記録結果通知の四条件を含む一件、PR-N-01の耐久Task接続と既存Single Task Adapter接続の二件、記録例外と二次診断失敗、記録未設定を確認した。記録unknown／部分成立をTask完了へ混同せず、通知失敗で元Task・回復参照・清掃観測を失わない。これで本節の三点と直接利用側の整理を完了する。実AI・実Docker・過去保持物操作は零で、Executor／Docker Isolation製品Sourceは変更していない。

### コミット時点の残件整理（2026-11-01）

人間のコミット・プッシュ指示に合わせて残件を再確認した。今回の三点と先行P0は完了しているが、通知全域の欠陥不存在を主張しない。追加確認対象はexecution/recovery.tsのbeginProductionRecoveryにあるobserveFailureで、現在は同期例外だけを捕捉する。現行利用側の同期ハンドラーでは非同期拒否は発生しないが、void型へasyncハンドラーを渡せるため、任意診断の返却Promise拒否を捕捉するか、同期専用契約を明確化する検討を残す。結果・回復参照・清掃を変えない局所是正として扱い、今回は未実装とする。

命名候補として、同じpreparation.tsの検証専用createIsolatedProviderDockerPreparationAdapterにcallbacksという通常操作束が残る。prepare／blocked／cancel／consumeは通知ではないため、将来整理時はoperations等へ揃える。今回改名したProviderPreparationOperationsとは別契約であり、動作不具合とは扱わない。observeTerminal、observeRepository、observeLeaseOwner等は値を返す観測操作、onFailureDetectedは購読解除関数を返す登録操作であり、機械的なvoid化の対象にしない。CoordinatorからDocker IsolationへのAttempt Recovery直接依存整理は別の責務境界作業で、通知整理の未完了と混同しない。

先行の保存・Task進行六Suiteは101件中100成功・1不合格、終了1（約2,381秒）。実行時に読み込んだ旧期待値によるPR-N-01のSingle Task Adapter接続不合格を保持する。同ケースは是正後の上記五件の固定候補で成功したが、先行runを現候補の全体回帰根拠に流用しない。残る不合格やRepository全体QAの未成立は維持する。今回の追加操作はローカル読取り・記録とGitコミット・作業ブランチへのプッシュに限定し、実AI・Docker・過去保持物は操作しない。

### 残る任意診断と検証操作束の是正（2026-11-01）

人間が上記二件の是正を指示した。基準Commitは090da26e6。実装詳細・利用側・既存試験の限定変更として、Coding Standards、Coordinator詳細、QAと呼出し元を着手前に照合し、別確認者の着手可を受領した。技術・品質の独立レビューと対象文書・影響先確認を行う。保存Schema、通信、Timeout、Authority、準拠基準、リリース判断は変更しないため、それらの追加設計・監査は発火しない。新たな人間判断は不要。

編集対応は、①beginProductionRecoveryのfinally内の任意observeFailureを同期発行し、try／catchとPromise.resolve(...).catchで例外・拒否を直接捕捉、②内部関数・公開wrapper・依存型の既存三宣言をvoid／Promise<void>へ整合、③検証専用createIsolatedProviderDockerPreparationAdapterの引数・参照・ヘッダーをcallbacksからoperationsへ改名、④既存試験・Architecture・QAを追従する。通知はreadyで発行せず停止時に一回だけ、完了を待たず同期のnull／blocked／readyを維持する。後着から元結果・取得済みexact回復参照・保存・Host要求を変更しない。新たな通知型、helper、Source、未完了一覧、Queue、Timer、Registry、再送・回復機構は追加しない。

既存の実関数本文VM試験を、8停止点＋readyと未登録・正常・同期throw・即時reject・後着reject・pendingへ拡張した。診断値の凍結、一回又は零の発行、同期返却、遅延拒否後の元結果・保存回数・Host要求回数の不変を確認する。このメモリ代役は実資源の解放を証明せず、既存releasesの零もその証明へ用いない。操作束の改名は両Providerの準備・拒否・取消・一回消費の既存試験を維持する。呼出し側の同期診断ハンドラーはそのまま利用でき、新しい接続APIは不要。

対象六Suiteは76件成功、別のController・Single Task・回復Adapter三Suiteは151件成功。後者は実子Processを用いるHost Windows試験を明示除外した非AI回帰であり、その実境界の再成立を主張しない。静的checkは終了0、既存informational Lint102件を維持する。対象外の全体QA不合格は別件のままとする。実AI・実Docker・過去保持物の操作は零。独立レビュー・文書確認の結果は終了後に追記する。

固定候補の独立レビューは残Must-fix零。確認者自身の診断契約三件と差分空白検査も成功し、同期返却・ready通知零・停止一回・exact参照・保存／Host要求の不変、操作束の名称だけの変更を再照合した。今回指定された二件のSource・利用側契約・試験・設計文書への追従は完了した。過去の残件記録は当時の状態として残し、この節を現在の対応結果とする。コミット・プッシュは今回の指示範囲に含まれず未実施。

対象六文書のChecker指摘は零。参照展開先の既存3,376指摘による全体終了1は維持し、Repository全体QAの合格とは扱わない。

### 技術通知の同期発行と拒否捕捉（2026-11-01）

人間が追加の二系統を是正するよう指示した。基準Commitは35f96f9e3。実装詳細と直接利用側の限定変更として、Coding Standards、Platform Access／Docker Isolation詳細、QAと通知の発行・購読元を着手前に照合した。別確認者が通常・即時・取得結果不明の五発行点と、stdout観測の同期void契約を確認した。技術・品質の独立レビューと対象文書・影響先確認を行う。通信、保存、Authority、Timeout、準拠基準、Releaseは変更せず、新しい人間判断は不要。

編集対応は、①Platform Accessのlock/lifecycle.tsの通常・故障後即時・unresolved即時と、docker-desktop/protocol.tsの通常・故障後即時の計五箇所で、try内のPromise.resolve(listener()).catchにより同期例外・誤返却Promiseの拒否を捕捉、②DI process/start.tsがobserveStdoutの返却をunknownで受け、undefined以外は拒否消費後に既存の観測例外・出力失敗flag・元Process終端経路へ収束、③probe/process.tsがobserveFixtureOutputの不正返却を外へ渡し、そのchunkのready判定を進めない、④利用側・既存試験・設計・QAの追従とする。

Platformの通知型は同期voidのまま、通知順・購読解除・故障の単調性・元の終了結果を維持する。DIは即時成功Promiseも同期完了として受理せず、後着拒否は消費だけで再終端・再判定しない。以前のchunkで既に成立したreadyは取り消さない。通常の本番利用側は同期voidを返すため接続APIの追加は不要。新Source、helper、Registry、Queue、Timer、待機Gate、再送・回復機構を追加しない。Rust・Native・Docker実体・Image・実AI・過去保持物は操作しない。

局所確認はPlatform通知八件、DI stdout／probe九件が成功。throw・即時reject・後着reject・pending、通常／即時／unresolved発行、解除済み通知0、他listenerの同期順序、元故障結果と終了、DIの即時成功Promise拒否、元close前の終了未成立と後着後の要求数不変を確認した。PAは自己所有の合成Node子とメモリSupervisor、DIは模擬Processと本番probe本文VMを用い、実Dockerや実Windows資源全体の回収を証明したとは扱わない。両Packageの静的checkは終了0（DIの既存informational Lint三件は不変）。通常回帰と独立レビューは実行中。

通常npm testはPlatform Access145件全成功、Docker Isolation309件中304成功・既存の明示条件付き五件スキップ、いずれも終了0。Host Windows実境界は既存の除外条件を維持し、実Docker限定試験や明示Python試験を起動していない。Coordinatorの静的check終了0（既存informational Lint102件）と、Host排他の利用側・Provider接続・Core依存の三Suite78件も成功した。各実行は別の成立範囲として保持し、Repository全体QAや実AIの再成立へ合算しない。Sourceと文書の固定候補を独立レビューへ渡す。

独立レビューは動作・安全保証のMust-fix零。確認者の新規DI九件・PA七件も成功した。同一moduleから分かれていた試験の型importを統合し、PA checkの再成功と差分の独立確認後、残指摘は零となった。対象六文書のChecker指摘は零、参照展開先3,356指摘による全体終了1は維持する。今回の二系統はSource・既存利用側の同期契約・試験・Architecture・QAまで対応完了。実AI・実Docker・過去保持物操作は零。新しい仕組みや公開APIは追加しておらず、コミット・プッシュは未実施。

## Attempt Docker技術処理のExecutor集約（2026-11-01）

人間が集約方針を採用した。基準Commitはf2576d765。今回の目的は既存CapabilityのOwner移管であり、Recoveryの新設ではない。Coordinatorは対象選定・Owner・権限・排他・Domain保存・Task進行、ExecutorはAttempt技術診断・回収の公開入口、DIはDocker探索・照合・exact ID処置・技術cleanupを所有する。Docker Desktop全体の停止・再起動・修復、Host清掃とLease、Schema・History・通常Attempt実行は対象外。実AI・実Docker・過去保持物を操作しない。

変更経路は複数Packageの実装責務・利用側移管で、Coordinator／Executor／DI詳細、Coding Standards、QAと直接試験・変更履歴を照合し、別確認者が保存中間順序・exact参照・通知失敗の反証を確認した。Source・試験の独立レビュー、Architecture／Qualityの文書・影響先確認を行う。準拠基準・決定権限・Releaseは変更しない。新たな人間判断は現時点で不要。

### 棚卸しとCapability対応

| 現行所有処理 | 移管先・保持する保証 | 既存利用側／検証 |
|---|---|---|
| currentDockerRecoveryResourceExpectations | Domain検査と技術投影はCoordinator。DI期待値・Container先行順・Proxy候補・Init条件はExecutor／DI | current-recovery-resources、coordinator-state-runtime、restart-preparation-order、auth-create-closure／abandon試験fixture |
| recoverRuntimeOwnedDockerTaskResources | Owner・元版・CheckpointはCoordinator。Docker探索・照合・回収はExecutor | current-recovery-resourcesの保存前削除拒否・Owner失効・既知ID・部分回収・認証不明閉鎖 |
| executeRuntimeOwnedDockerTaskResourceRecovery | Host所在の借用はCoordinator。createDockerTaskRecoveryExecutor生成・closeはExecutor | current-recovery-resourcesの実空config・spawnSync代役・close失敗、current-host-transition |
| auth unknown二回観測 | 閉鎖適用判断と専用Writerは上位。名前・Label不存在読取りだけExecutor／DI | auth-create-closure、current-recovery-resources、owner-reentry |
| Host cleanup・Lease解放・履歴・配送 | 現行Ownerに維持、Docker資源結果から推測しない | 既存Owner再入場・履歴・配送・終了試験 |

Source本文を切り出す既存VM試験が複数あるため、関数移動後に単に検査対象を削除しない。技術観測の検証はExecutor単独の新方式へ移し、保存・現在Ownerの試験はCoordinatorへ残す。旧source位置前提・試験用注入は利用側移行の対象とし、製品に旧互換層を追加しない。以前の成功記録と実AI八項目のEvidenceは保全するが、新API成立へ流用しない。

### 保存境界を維持するAPI具体化

公開候補はinspectAttemptResources(target): AttemptResourceInspectionとcleanupAttemptResources(target, callbacks): AttemptCleanupResultの二操作。Targetは同一recoveryId／operationId、AttemptRecordProjectionに基づく非秘密の技術投影、DI既存DockerResourceReceipts、用途限定管理領域、現在Ownerの同期Queryだけを含める。Domain Operation、identityJson、保存Schema、Writerや上位Storeを下位へ渡さない。結果は元参照、資源別の観測不能と不存在、短命configのcloseを明示する。DIの型を再利用し、専用Interface・Factory・Manager・永続Stateを追加しない。

技術事実の通知は共通ResourceCleanupCallbacksへまとめ、ExecutorCallbacksが継承する。観測開始・実ID発見・cleanup観測を同期voidで通知し、Coordinatorの登録先が必要な遷移・保存・読戻しを完了してから戻る。undefined以外の返却やthrowでは次Effectを止め、Promise拒否だけを消費する。intent_saved→unknownは上位の保存遷移であり、下位が次状態を通知しない。ID発見後保存・読戻し前に削除しない。cleanup保存後の認証unknown適用判断と専用Writerは上位維持とし、下位は二回の不存在読取り結果だけを返す。inspectは診断のみで、cleanupの必須前段にはしない。

| Step | 現在の到達点 |
|---|---|
| 1 直接依存棚卸し | 上表の主要関数・DI生成／close・保存中間点・直接試験を特定 |
| 2 API・型設計 | 明示型と共通通知interfaceを実装。通常実行と回収の通知発火差はpayloadで判断 |
| 3 DI薄接続 | Executor attempt/recovery.tsに実装。上位保存・Domain依存を持たない |
| 4 Coordinator本番置換 | 固定Executor公開APIへ接続。保存と認証unknown適用判断・専用Writerは上位維持 |
| 5 保証回帰 | Executor全66件、DI通常304件成功（5件skip）、Coordinator関連233件と実保存8件成功。入れ子config反証を追加した実保存2利用側も成功。独立再レビュー残Must-fix零 |
| 6 Executor単独診断・回収試験 | 実API本文と有限DI代役の試験を追加。通知誤返却、既知ID観測、照合中Owner喪失を反証 |
| 7 不要Import撤去 | 対象経路のDI生成・期待値構築・close直接依存と旧期待値関数を撤去。Desktop等は対象外 |

並行する計測通知の残件は、controllerの二発行点でPromise拒否を捕捉し、diagnosticsのwriteProgressは同期===true判定を維持して誤返却Promiseの拒否だけを消費した。元結果・Effect・表示失敗後の停止を変えず、新規の滞留管理・再送はない。初回check終了0、局所七件（通常・是正・clean失敗・cleanup不明・取消の比較、非同期Lifecycle、非同期writer）が成功した。主移管のSource完了とは区別する。

計測通知の対象二Suite全168件は成功。独立レビューの残Must-fix零、確認者自身の追加二試験（各複数条件）も成功した。移管方針の棚卸し・Owner境界・未実装表示も独立確認済みである。今回の確認は計測修正の実装と移管設計を対象とし、診断・回収APIのSource接続・本番置換・移管後回帰の完了ではない。実AI・実Docker・過去保持物は操作していない。

対象六文書のChecker指摘は零。参照展開先3,376指摘による全体終了1は維持し、全体QAの合格とは扱わない。

### 移管完了時の確認結果

Executorの公開診断・回収二操作へ本番接続し、Coordinatorの対象経路からDI期待値構築・実Executor生成・探索・照合・削除・closeを撤去した。共通ResourceCleanupCallbacksをExecutorCallbacksが継承し、二つの終了段階は統合せず維持した。共有内部型はtypes.tsへ移し、専用入力上限と検査用Setは単独Owner内に残した。Domain依存、保存単位、新しいManager・Registry・Lockは追加していない。

独立Source／Architecture・Qualityレビューの是正として、既知実IDの診断を名前不存在だけで確定しないよう修正し、strictな存在確認と照合後のOwner確認を追加した。未知を含む通知は成功保証ではないことを明示し、内側診断configと外側回収configのいずれかのcloseが不明でも同IDで停止し、再入場の追加要求・Writerが零であることを実保存の同一路径で反証した。両レビューの是正後Must-fixは零。

基準HEADから残っていたOwner再入場試験のCoordinatorによるHome解放期待は、既存製品が要求するExecutor解放通知の記録へ追従した。実解放通知なしの停止は維持し、通知後も保存失敗ではTask成功としない。試験だけの有限投影を使用し、製品の保存契約やHome操作を変更していない。

Executorのcheckと全66件、DIのcheckと通常304件（5件skip）、Coordinator型検査、関連8 Suiteの233件が成功した。Windows junction作成をsandboxが拒否した初回結果は成功へ換算せず、用途限定の権限で同じ合成試験を実行して成功を確認した。認証unknown専用Writerの実保存試験はWorkbench／CLIの各14条件（内側／外側close反例を含む）が成功した。実AI・実Docker・過去保持物は操作していない。

対象文書のChecker指摘は零、参照展開先3,356指摘による全体終了1は維持する。今回の非AI移管回帰を実Docker／実AIの新API実境界確認や全体QAの合格へ昇格しない。

## 通常Attemptの技術残存二件の整理（2026-11-01）

基準版3fbb67f35で成立した実行・診断・回収と共通通知を維持し、助言Command構築の重複と表示通知期限のDI依存だけを整理する。認証・Probe・Desktop全体の修復、Domain保存Schema、承認範囲、モデル・Image、実AI・Docker・過去保持物は対象外。変更経路は実装責務と直接利用側の移管であり、Source・文書・品質・影響の独立レビューを行う。準拠基準・決定権限・Releaseを変更しないため準拠監査は追加しない。着手前の読み取り確認で、既存createExecutorをCommand事前固定だけに使うには不要なTarget・Home・乱数が必要なため、副作用なしのprepareAdviceCommand一操作が最小と確認した。新たな人間判断はない。

commandHashは実Command全体の技術Hash、packetHashは意味的な要求・選定・本文Hash等とcommandHashを結合する上位Identityである。Hash入力・順序・Schemaを変更せず、Packet発行は引き続き捕捉した実Commandを既存DI Hash関数へ渡す。issue本文は基準版と不変である。CoordinatorのProvider planner・Docker実行位置・bindの組立てを撤去し、Executorの事前固定と実行前再構築が同じ正本を利用する。単純再export、AI AdapterへのDocker情報移管、CommandをPacketから落とす案は、目的未達又は承認・Schema変更となるため採らない。

正常は両Provider×推論強度三種×通信条件有無の12構成でCommand全field・Hashが基準方式と一致する。用途・Provider・Model・identifierKind・推論強度差はnullへ拒否し、不足を補完しない。既存のPacket改変・承認相関・実行前拒否の利用側は維持する。Lifecycle通知期限は実装値を再確認し5,000msのままCoordinatorローカル定数へ分離する。新しい設定・Framework・資源・永続状態は追加しない。

初期局所確認は助言・Packet・準備・実行42件、Command準備の12構成と不整合を含む3件、通知の既存write／closeと追加期限／後着writeの2件が成功した。Windowsのファイルマップ競合によるFormatter失敗は合格へ換算せず、限定した既存Formatter実行後にExecutorのcheck成功を確認した。対象回帰と独立レビューは継続中であり、この時点の局所結果を全体完了とは扱わない。

最終候補はExecutorのcheckと全67件、Coordinatorの型検査・変更対象Formatter／Lint（終了0、情報診断のみ）と関連8 Suite・160件が成功した。Source独立レビューは必須指摘零。Architecture／Qualityレビューで見つかった旧公開API表を、実際の4関数と型の案内へ是正し、再レビューの残必須指摘も零となった。今回の二件は非AIの責務整理・本番接続として完了し、実AI・Dockerの新規実境界試験や全体QA成立は主張しない。通常Attemptの技術Command構築残存と表示期限のDI流用を解消したが、認証・Probe・Desktop修復の直接依存は別テーマのまま保持する。実AI・Docker・過去保持物は操作していない。

## DI共通入口整理・残件1〜5の一括対応（2026-11-02）

対象は共通構築、固定資源metadata、例外分類、純粋Policy／回復相関／Checkpoint検査、公開型の所有整理。基本7入口に加え、分類表と技術検査のコピーを避けるため純粋検査5件を維持する。移管先と保持条件はDI Architectureの「共通入口整理の残件1〜5の確定境界」を正本とする。

回復期待値と旧exact助言Imageのinit条件はExecutorの回復Ownerへ、認証Receipt捕捉は認証Ownerへ移管する。固定Image・Engine・profileは引数なしCatalogへ統合し、既存の資源名・Label・保存Schemaは変更しない。Coordinatorの保存Checkpoint終端判定は既存Domainへ接続し、DI内部の技術検査は独立境界として維持する。旧Command／Session・Home Lease・認証固有型は実装Owner又は試験supportへ移し、製品DIの逆依存は作らない。

実AI・Docker・過去保持物は今回の操作対象外。Image、Network、安全条件、Timeout、保存Schemaを変更しない。有限結果を実境界E2Eや全体QA成立へ昇格しない。

最終確認はDIの既存155件と認証Receipt／旧Probeの8件、Executor全97件、Coordinator関連212件と助言構成4件、Checkerの公開入口1件が成功した。DI／Executor／Coordinatorのcheckはすべて終了0（既存の情報診断を除外せず保持）。初回に発見した試験読込み順とimport追従の不備は是正後に再実行して成功を確認した。

固定候補150 paths・SHA256 `5f21ad11ee6334eb44cfc60ec1b18cf47a9881e5c4cd6a59234ee5ce3cde6176`に対するSource／Architecture・Qualityの独立再レビューは必須残指摘0。正式ArchitectureのOwner伝播漏れ9箇所は旧本文を直接訂正し、Source・Schema・拒否条件・期限を変更せず再確認した。対象4文書の診断は0だが、参照展開先の既存328診断により拡張文書検査全体は終了1であり、全体合格とは扱わない。この段落は確認済み結果の記録追記で、評価したSourceは変更していない。残件1〜5は今回の非AI整理範囲で完了し、コミット・プッシュは未実施。

## DI公開IFの最小化（2026-11-03）

前項のOwner移管だけでは公開型35個の整理が不十分だったため、環境modeと資源操作に対応する共通型へ実利用側を移行する。環境Request／Resultは既存判別UnionをMapping値にし、資源はSnapshot／Container／Directoryと観測／回収の対応を表す。公開型は19個とし、Runtimeの個別入力・結果、Container／Directoryの個別Root型、用途構成の期待値型の個別公開を撤去する。元実装・値・同期性・通知・Schema・安全条件は変えない。

共有技術predicateとProcess通知に必要な型は、同じ規則のコピーや不明瞭な型演算を避けるため維持する。新Manager／Store／実行機構は追加しない。実AI・Docker・過去保持物は操作しない。

最終候補152 paths・SHA256 `870d7de9565d63ce42d0eb9afa20520e00de57261de6e4294d63e130f8ef4979`を確認した。DI164件、Executor全97件、Coordinator関連216件、Checker公開入口1件が成功した。初回Executor回帰の1失敗は旧Runtime結果型を公開維持する試験Oracleの追従漏れであり、共通型の公開と旧型の非公開を両側検査するよう是正し、局所3件と全97件の再成功を確認した。3パッケージの静的checkは終了0。

Source・Architecture／Qualityの独立再レビューは必須残指摘0。文書表に残った旧repair結果型1箇所も共通型へ訂正した。対象4文書の診断は0、参照展開先の既存328診断は残り、拡張文書検査全体は終了1のため全体QA合格とは扱わない。この結果追記は記録だけで、評価したSourceを変更していない。公開値12・公開型19として今回の最小化を完了し、コミット・プッシュは未実施。

## DI補助契約と専用送信同意の責務整理（2026-11-03・実装中）

人間が採用した方針に従い、同じ実行指示へ重ねる専用送信同意と、そのためだけの確認コード・初期同意保存・Token・一回消費を撤去する。Repository／Operation／Revision／Providerの認可・相関、Scopeの通常データ捕捉・上限・秘密検査、限定是正許可・TaskPacket一回使用、Home Grant・Owner・Lock・取消は維持し、既存の準備・認可Ownerへ接続する。常時成功する同意やGrantの代用品は作らない。既存保存物は操作しない。

通信設定はRepository追加HostをExecutor RequestからDIの技術Requestへ搬送し、固定Hostとの合成・正規Policy生成・Proxyへの直列化をDIに集約する。Proxyの既存PolicyHash・DNS・IP・直接通信制限は維持する。認証は追加Hostなし、Repository実行はRole共通とし、DIへauthentication／attempt／probeの用途判定は追加しない。

固定構成取得はImage・配置・Proxy metadataへ限定する。Provider構成はExecutorだけが取得し、Coordinatorの固定診断・保存済みProbe接続に必要な無引数metadataは現役Consumerのため維持する。回復参照解析は上位の既存Ownerへ移す。資源Identity／期待値検査と例外分類は重複検査かを照合し、安全上独立して必要な共有契約は維持する。Process観測・分類は同じ技術結果へまとめるが、onObservedとonCompletedの通知時点は統合しない。

変更は内部API・実行契約と判断処理の責務整理であり、Release・標準全体の準拠表明ではない。SourceとArchitecture／Qualityの独立レビューを固定候補へ行う。正常、別Repository／Revision／Provider、未知Policy、秘密Scope、範囲外Path、失効Owner、取消、是正許可再利用、通知故障、Process終了不明、ID欠測とCleanup不明を非AIの有限試験で確認する。実AI・Docker・過去保持物の操作、新Library／Manager／Registry／Store／Lockは対象外。

### 中間接続と通信設定固定方針の確定（2026-11-03）

Process通知はIsolationCommandResultへ集約し、観測と完了の通知時点・同期void・元観測を保持した。DI Request.proxyに技術Profile・Proxy／Client参照・追加Host・接続環境方式を渡し、DIで正規Policy・Hash・Proxy／Client環境を同じ入力から生成する接続を実装した。局所のExecutor7件とDI60件が成功した。DI結合の初期失敗は捕捉後のnull prototypeなSeccompオブジェクトをfixtureが暗黙文字列化したもので、fixtureを明示直列化へ訂正し、製品の安全判定は変更していない。

expectedNetworkPolicyHashはWorkbench表示後の設定変更拒否にも使われていた。人間はこの照合を不要とし、Task実行開始時に選択Repositoryの最新設定を一回読み、そのTask内の全段階で固定する方針を採用した。表示は参考情報とし、表示時Hashの要求field・比較・事前取得だけの読取りを撤去する。読取り不能・不正設定・別Repository・権限不足の拒否と、Proxy内部の正規Policy Hashは維持する。上位の完成Policy搬送・Catalog・専用同意の撤去は引き続き実装中であり、現行同意検査はまだ撤去していない。全体完了・未実施の実境界確認を主張しない。

### 表示時Hash撤去と中間候補の確認結果（2026-11-03）

公開要求・Controller比較・Workbench hidden値／HTTP搬送・検証Toolの事前読取りから表示時期待Hashを撤去した。製品Sourceと実行scriptsに当該fieldの残存はなく、試験では旧fieldを余剰入力として拒否する。Task開始の既存Policy捕捉点を前倒しせず、同じ不変値を既存の各stageへ渡す。追加のReader・Worker・待機Gateは作らない。

局所結合では、助言の実入力から未Commitの開始時設定を採用し、実行中にFileが更新されても元PlanのHost集合が変わらず、次の依頼だけが更新後の集合を使うことを確認した。不正JSONでは既定値や前回値へfallbackせず、配送件数が増えない。両Providerの純粋構成でも、元配列変更の分離と次読取りの更新を確認した。選定の受付時固定は既存契約のまま、通信設定の実行開始時固定と混同しない。

DI変更影響5 Suiteは77件、Executor全回帰97件、WorkbenchのHTTP・入力・表示関連4 Suiteは51件、Coordinator関連7 Suiteは17件が成功した。設定固定の追加反例を含む5 Suite・12件も別実行で成功した（17件と重複するため合算しない）。4 Packageの静的checkは終了0。先行Executor回帰の失敗は、試験Adapterが旧Proxy環境からTokenを読む追従漏れで、新Request.proxy.tokenへ接続した後に関連5件と全97件の成功を確認した。製品の旧fallbackは復活させていない。

SourceとArchitecture／Qualityの独立レビューは、DI文書の旧通知引数説明1件を訂正し、試験Adapter追従も再確認した後の必須残指摘0件。実AI・Docker・過去保持物は操作していない。HTTP試験の初回制限環境でのEACCESは成功へ換算せず、同じ合成試験をローカル接続可能条件で再実行した51件を確認結果とする。追加の120秒診断上限を付けた重複保存回帰は上限取消となり、終端後の非同期拒否も観測したため合格へ数えない。上限を追加しなかった元の7 Suiteは全17件成功しており、この診断上限を製品Timeoutや正式試験条件へ採用しない。

検証Toolの追加回帰では、先行16項目の成功後、実保存付きHTTPの合成executeに旧Boolean通知Oracleが残っていたため、試験の開始待機が終了しないことを確認した。operationCreated／startedの正常returnはvoidなので、true比較を撤去して両方をawaitし、正常完了後だけ開始観測を通知する。製品の保存・通知・15秒期限は変更しない。是正後の同じ実保存付きHTTP一件は45.3秒・終了0で、通常完了・取消・応答喪失後の同ID継続、終端記録、子Process・Server・Task Owner終了と新品Root清掃まで確認した。Source／Architectureの限定再レビューで必須残指摘0件。停止した先行runのRoot清掃は別途の不存在確認を行っておらず、この一件の清掃成功を先行runへ流用しない。過去保持物の操作や強制削除はしていない。

対象5文書のChecker診断は0。参照展開先3,366診断による全体終了1は残し、今回の限定確認を全体QA合格へ換算しない。検証Toolの前半16項目は中断前の個別成功であり、是正後の全17項目通し実行と表示しない。

人間は残る1〜4の一括実施を指示した。専用送信同意・Grant・確認コード・初期同意保存の製品経路を撤去し、通常のPolicy現在性・Provider認可は準備Ownerで確認する。共有端末の製品利用は専用同意だけだったため、一般端末の有限検証補助はtests/support/console.tsへ移し、PAの端末APIと認証・環境操作は変更しない。既存保存物や保持物を削除しない。

上位はDomainからRepository追加Hostを一回捕捉し、不変配列だけをExecutorへ渡す。DIは共通Request.proxyから正規Policy・Hash・Proxy／Client環境を生成する。CatalogはdescribeIsolationConfigurationへ改名し固定Image・実行位置・Proxy metadataへ縮小する。保存済みProbeの技術metadataと既存診断用の無引数固定構成は、現役Consumerがあるため維持し、実環境観測や認可へ昇格しない。

資源Identity・期待値のProducer検査と例外分類を、公開数のために削除する差分は安全審査により停止した。読取り専用の独立確認では、固定五資源のnamespace検査はDI共通の一般名検査と異なり、開始前のHome取得より前に使われる。期待値全件検査は未要求・限定観測・早期return経路でDIへ渡らない対象も確認する。外側例外分類にはDI結果前の準備・接続失敗も含まれる。この3契約は現役の共有純粋APIとして保持し、新しい問い合わせ・Wrapper・分類表コピーを作らない。元検査と拒否時点を維持して回帰する。

現在のSourceは専用同意・旧送信理由を撤去し、通常認可・Packet・追加Hostの本番接続へ移行した。試験台帳では廃止した同意3 SuiteとTask専用Console資源を退役し、通常の認可・取消・回復・端末技術の別契約は維持する。PolicyのboundaryResolutionはauthorized_repository_request、termsPolicyIdentityはruntime-not-verifiedへ追従し、現在の対話確認や規約検証を偽って表示しない。既存Repository-local設定の自動移行は追加せず、旧値の設定を互換受理しない。実AIの次回実施前にはフロントAIによる対象設定の確認・移行が必要である。

全参照確認で残っていた検証Scriptの同意方式判定も撤去する。一般Task・4経路行列は元結果の資源・候補・回復・選定相関だけを確認し、廃止した初回同意／再利用を成功条件へ要求しない。通常の実AI試験の実施許可や再送禁止は別契約として維持する。PAの無出力Workerがstdout／stderrをdestroyする契約に対し、古い有限Worker代役にdestroyが欠け、目的のwriter故障より前に停止する試験不整合も修正した。製品PAやTimeout・安全判定は変更しない。

広い8 Suite確認の先行runは追従漏れを検出後、長期待機中に中断したため通し合格へ数えない。後続の個別成功や新品Root清掃を、この中断runの資源終了確認へ流用しない。保持物の操作は行わない。

1〜4の利用側・試験・文書の移行は、今回の非AI範囲で完了した。Repository全体のQA・実境界再成立・Release可とは表示しない。実AI・Docker・過去保持物の操作、Library／Manager／Registry／Store／Lockの追加は禁止したままである。

### 1〜4の非AI範囲の完了確認（2026-11-03）

固定候補139 paths・内容SHA256 `6d3ed29c3c805e65a33570d6d0f560c109a7b9446c08d6f55dc8597bc838c2b5`を基準に、追加Script・台帳差分までSource／Architecture・Qualityの独立再レビューを行い、必須残指摘0件とした。Coordinator文書の旧B2説明と通常TaskのConsole回収説明は訂正し、PA一般端末・認証TTY・実装の排他／清掃条件を変更せず限定再確認した。

| 確認群 | 結果と限界 |
|---|---|
| DIの共通実行・Snapshot・回収・Proxy・構成19 Suite | 171件成功、失敗・skipなし。Docker・実AIなし |
| Executor全試験 | 97件成功、失敗・skipなし |
| Coordinator実行・回復・準備10 Suite | 238件成功、失敗・skipなし |
| 単一Task検証Tool | 49件成功。実AI送信なし |
| 経路行列・Process安全 | 25件成功。Worker／Process境界は有限代役・固定子試験 |
| Task全体・Packet・台帳・配置・Console局所 | 対象回帰成功。junction試験は制限環境のEPERMを合格へ数えず、今回合成領域で別途一件成功 |
| Workbench | 受付・表示・型・定義CRUD・ローカルHTTP・実保存付き検証Toolの対象Suiteは分割実行で成功。中断runの通し成功とは表示しない |
| AI Adapterの直接利用側 | Catalog接続の4件成功 |
| 静的検査 | Coordinator・Executor・DI・Workbench・AI Adapterのcheck終了0。既存infoは残す |
| 文書と台帳 | 対象11成果物の診断0。参照展開先3,405診断により全体終了1は維持 |

Rootの実行公開は10関数、型公開は15個である。旧Network Policy parser・完成Policy型・Task回復ID parserは公開から撤去した。固定構成照会は実行前の純粋なmetadata取得であり、実環境の観測とは別である。資源Identity／期待値の検査と外側例外分類は、異なる拒否時点・対象集合を守るため共有純粋APIとして維持する。

実AI・Docker・過去保持物の操作は行っていない。既存ローカルPolicyは自動変更せず、新契約と不一致なら拒否する。次の実AI実行前にフロントAIが設定を確認・移行する。中断runの清掃未確認と既存の全体QA不合格を解消したとは扱わない。上記結果追記と現在地の更新は記録のみで、確認済みSourceを変更しない。今回のCommit／Pushは未実施。

### Repository実設定の明示移行（2026-11-03・確認済み）

継続指示に基づき、フロントAIがRepository-localの追跡済み`.crdd/config/external-send-policy.json`を明示移行した。両ProviderのboundaryResolutionとtermsPolicyIdentityの4値だけを現契約へ合わせ、enabled、情報分類、Provider／Offering、用途、候補保存・保持条件等がGit基準版から不変であることを構造比較で確認した。製品の自動移行・互換読取り・未Commit設定へのfallbackは追加していない。

同じ純粋compilerで作業ツリーの設定は受理、HEADの旧設定は拒否となる。製品Readerは引き続きexact bound repository commitを使うため、Commit確定前の移行内容は本番実行へ反映されない。これは追加HostをTask開始時に最新設定から捕捉する契約とは別の設定であり、その読取り方式は変更しない。

説明用のrepositoryPolicyAuthorityに残った旧対話確認の表現1件をauthorized_repository_requestへ訂正し、現役の認可判断を変更しない。旧値の拒否、両Providerの新値、disabledの維持を有限試験へ追加し、Packet試験の旧Grant名を現在のPolicy検査名へ追従した。局所・関連6 Suiteは30件成功。Coordinatorのformat・型・lint・両Trace検査は終了0。5ファイルの固定候補SHA256 `20faa3fb45c04849bb0fef743ee9f021e7c9d0e1e183a62ffe5a8595d0a92b62`に対するSource／Architecture限定独立レビューは必須指摘0件。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。この結果記録は確認済みSourceを変更せず、本番設定の有効化済みを意味しない。

### 技術補助3公開のOwner再整理（完了・実境界は対象外）

人間の継続指示により、公開が必要な理由と現在の呼出し構造を分けて見直す。単なるexport隠蔽・他Package内部へのdeep import・検査削除・分類表コピーは行わない。既存Home排他、Intent／Receipt、元ID・名前・所有Label、ID欠測時の完全構成、Directory条件、一次失敗とCleanup不明を維持する。

Identity検査はExecutorの生成時と開始時の既存入力検査へ統合し、DI Rootの個別関数を撤去する。Coordinatorは同じ保存対象をDomainの既存Snapshot候補生成で検査し、従来の五資源名の重複拒否をDomainへ補う。候補構築はNative Home観測より前へ移し、不正入力でNative要求・耐久Intent保存へ進めない。既存Host／Repository読取りの順序はHome観測より前になるが、Writerの元版・現在性とHost開始前の再照合は維持する。旧九Command OracleのIdentity検査は有限試験supportへ限定し、製品から利用しない。

現時点のDI Rootは9関数・15型であり、expectation検査と例外分類の2公開は残る。前者は未要求・限定観測・選択外資源も含める純粋な入力準備が必要で、後者は有効Preparedの開始失敗を既存IsolationExecutionResult.failureへ収容する必要がある。未要求時のCLI／Filesystem観測を増やすためだけの検査置換は行わず、二重使用・別Prepared等の契約違反を未開始のCleanup成功へ変換しない。この2件は接続・反例が揃うまで削除せず、3公開全体の整理を完了とは表示しない。

Identity移管の限定検証では、Executor全98件とDI関連22件、Domain保存入力4件が成功した。追加のCoordinator負例は、八項目のtoJSON付きObject／boxed Stringを変換・環境観測・保存準備より前に拒否し、正常対照だけが保存候補準備へ到達することを7件のSuite内で確認した。Coordinator関連6 Suiteの最終通しは209件中207件成功、Windows実子Process取消の2件は5秒内の終了確認が成立せず失敗した。Docker側は模擬処理であり実Docker操作はない。各試験の終了hookには失敗記録がないが、取消時点の保証は不合格として保持し、全体回帰成功とは表示しない。OS Process一覧の追加読取りは権限拒否となり、不存在の根拠には用いない。

Coordinator・Domain・Executor・DIの静的検査は終了0。対象7文書の診断0、参照展開先3,396診断による全体終了1は未解消。レビューで検出したJSON変換前のprimitive string拒否抜けと旧共用説明は是正し、Source／Architectureの限定再レビューは必須残指摘0件となった。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。


#### 最終接続と検証結果（2026-11-03）

前述の9公開・残2件は初回段階の記録である。継続是正により3補助関数のDI Root公開をすべて撤去し、現在は共通技術操作6件と固定構成照会1件の7関数・15型となった。

| 処理 | 現在の正本と保証 |
|---|---|
| 資源Identity | Executorの生成・開始入力検査、Domainの保存候補検査。CoordinatorはJSON変換前のprimitive string確認を維持する |
| 期待値 | Executorの構築入力で用途別prefix・Label・Digest・boolean相関・保護Pathを検査。未要求・選択外・認証限定でも構築前に拒否する。固定生成の全5用途・Proxy両候補はDI内部predicateへ有限照合する |
| DIの技術検査 | 実観測・回収入力の内部predicate、元実ID・名前・所有Label、欠測IDの完全構成、Directory条件を維持する |
| 例外分類 | DIの開始時再検証も既存CompletionのEffect前で実行し、型付きfailureへ載せる。takeとforeign拒否は同期のまま。Executor外側の未知例外は固定分類とし、DI分類表を複製しない |

追加の公開API、準備モード、Manager、Registry、Store、永続状態は追加していない。保護Path本体の省略許容と既存truthy省略は維持し、今回は入力契約の暗黙の厳格化も行わない。

Windows取消2件の切り分けでは、所有する3秒で自動終了する子と固定taskkillだけを使った。制限付き環境では終了補助がOSのlogon errorで終了1、同じ最小環境・固定要求を通常の実行環境で比較すると終了0だった。いずれも子と終了補助子のcloseを確認した。通常環境で既存のWindows取消2件を再実行して2件成功し、期限・安全判定・製品実装は変更していない。これはAIツールの認証切れの判定ではない。先行209件中2失敗という観測は保持し、現在は実行環境条件を分けて評価する。

| 検証 | 現在候補の結果 |
|---|---|
| DI関連19 Suite | 177件成功、失敗・skipなし。開始時再検証の既知／未知例外、Directory置換、元準備の再使用・foreign拒否を含む |
| Executor全試験 | 100件成功、失敗・skipなし。最終実行後の追加編集は試験Headerの説明追従のみ |
| Coordinator関連6 Suite | Windows専用経路を含まない対象206件成功、失敗・skipなし |
| Windows実子Process取消 | 通常実行環境で対象2件成功。制限付き環境の不成立は成功へ読み替えない |
| 静的検査 | DI・Executor・Coordinator check終了0。既存infoは残す |
| 独立レビュー | Source・Architectureの必須残指摘0。文書の旧Owner／Root公開説明2箇所を再是正・再確認済み |

既存検証義務ERB-UT-023／ERB-IT-004／ERB-IT-014へ接続する。有限代役とWindows所有Processの確認を、実Docker・AIの新入口成立や全体QA合格へ一般化しない。実AI・Docker・過去保持物は操作していない。今回のCommit／Pushは未実施である。

最終Header追従の差分確認で、同じHeader文を起点にした編集が隣接する両Provider結合scenario（正常・通知拒否・取消の6 subcase）まで巻き込む試験編集ミスを検出した。製品Sourceの欠陥ではないが、この一時状態で回帰網羅性を完成扱いしない。元scenarioをGit基準版から復元し、現行契約への追加Host空配列と固定Request捕捉だけを追従させた。元の結果・回収・Home解放・Snapshot・秘密非公開の全assertionを維持し、Source独立再確認の必須指摘0、当該Suite57件とDI静的検査終了0を確認した。試験Case／subcase名の欠落0を差分で照合し、広いHeader文字列ではなく対象宣言境界を編集の一次キーとする既存Maintenance規則を再適用した。新しい規則・検査Frameworkは追加しない。 最終の対象7文書の検査は診断0、参照展開先3,396診断により全体終了1である。この結果追記は記録のみで、検証したSource・試験本文を変更しない。

#### 環境再起動通知型の命名整理（2026-11-03）

公開通知型DockerRuntimeRestartEventをDockerEnvironmentRestartEventへ改名した。mode: restartの受付／終端通知であることを維持し、環境Request／Resultと語彙を揃える。修復のcheckpoint通知まで同じ型へ統合せず、旧名alias・新しい型・APIは追加しない。DIの型宣言とRoot、Executorの再公開、Coordinatorの利用、直接試験と両詳細設計を一意に追従した。公開数は7関数・15型のままである。

対象4製品Sourceは、NodeのstripTypeScriptTypes後に空白を除いた内容のSHA256が改名前後で一致した。通知field、event実値、同期性、保存・取消・回収処理は変更しない。DIの再起動・環境・公開境界37件、Executorの公開境界・環境4件、Coordinator再起動15件が成功した。今回検出したCoordinatorの旧DI直接参照期待は、現行Executor経由と直接参照0へ追従し、負例の置換元も実在するExecutor参照へ訂正した。これは名称変更起因の製品回帰ではなく、既存試験期待の追従漏れである。

3 Packageの静的検査は終了0、独立レビューは必須指摘0件。Source／現行Architectureの旧名残存0と差分空白検査を確認した。今回の命名変更に新しい人間判断は不要である。実AI・Docker・過去保持物は操作せず、Commit／Pushは未実施。

#### DI内部の用途非依存化（2026-11-04）

基準はb8f524c76。成立済みの共通実行・取消・Receipt通知・通常／再入場回収を維持し、固定五資源の構築はExecutor、構成照合はDIへ分離する。Rootの7関数・15型は変更しない。既存保存Schema・Directory条件・Capability・Owner・Lock・期限は変更対象外である。

| 変更単位 | 現在の接続 |
|---|---|
| 五資源のpurpose分岐 | Executorの既存投影から明示した技術期待値へ変換。DIは不透明keyで相関し用途を判定しない |
| 名前・所有Label | CRDD専用の安全文法と期待Identityとのexact照合を分離。Labelのキーも要求値から照合 |
| 欠測ID | Image・User・Network・Mount・防御構成の既存完全照合と識別通知前後の再確認を維持 |
| 元実ID | ID・Name・所有Labelの最小照合を維持 |
| Image制約 | 既存Catalog内の固定profileへ集約。未知Image・不正User／Entrypoint・外部接続を拒否 |
| 配置選択 | Catalogはprimary／alternateを返し、Task／Advice選択はExecutorへ。Runtime fieldはalternateIdentityへ追従、Build JSONは維持 |

cleanup/plan.tsを撤去し、技術期待値はcleanup/types.ts、検査と構成照合はcleanup/validation.tsへ整理した。新しいManager・Registry・Store・互換Reader・汎用削除APIは作らない。公開数は同じでもdiscovery期待値構造とCatalog入れ子fieldの変更は利用側へ伝播する。

DI関連20 Suiteの197件とExecutor全100件が成功した。DI・Executor・Coordinatorの静的検査は終了0。Source独立レビューは製品安全性の必須指摘0、Checkerの旧公開Module期待一覧1件を検出し、現在Rootの実Module集合へ追従した。最終結合回帰はCoordinator関連8 Suiteの214件、AI AdapterのCatalog利用側2 Suiteの6件、DI公開入口単独1件が成功した。Architecture／Quality独立レビューは必須残指摘0。対象4文書の診断0、参照展開先331診断により全体終了1である。全Package公開一覧試験は基準からExecutorのProfile登録が欠け、実Package13件と期待12件が一致せず失敗した。DIの個別公開入口は成功しているが、この既存横断試験を全体合格へ読み替えない。最終候補でDI197件とExecutor100件を再実行して成功し、修正した9Module集合のSource独立再確認は必須残指摘0となった。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。

#### DIの説明・内部名の追従（2026-11-04）

旧九操作包装をexecution/plan.tsの製品責務としていた説明と、接続済み観測・回収を未完了としていた説明を訂正した。現在のargv生成はexecution/operations.ts、技術検査はexecution/preparation.tsであり、旧包装・逆解析はtests/support/execution-plan.tsの有限Oracleに限定する。

内部のcreateDockerTaskRecoveryExecutorをcreateTrustedDockerRecoveryExecutorへ改名し、参照元・抽出試験・試験Adapterを追従した。これは固定CLI検証・最小環境・確定管理領域を結合する技術処理であり、Task判定は持たない。試験supportの別関数createDockerResourceRecoveryExecutorはそのまま維持する。Root・診断reason・保存・取消・Cleanup・期限・安全条件は変更しない。

限定回帰はDI関連93件、Executor資源2件、Coordinator現在回収24件成功。3Packageの静的検査終了0。対象4文書の診断0、参照展開先331診断により全体終了1である。独立レビューの文書1指摘は試験supportと本番関数の説明を区別して是正した。

追加で認証create closure試験を実行したところ、6件成功・7件失敗だった。6失敗は基準HEADにも存在する動的import実数9／期待7の試験fixture不整合で、1失敗はWindows junction作成のEPERMである。今回の改名起因とせず、別の未解消検証残件として保持する。既存横断検査や実境界を全体合格へ読み替えない。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。

#### 検証接続の追従漏れ是正と再点検（2026-11-04）

先行記録の認証closureのimport数・代役割当不整合とChecker公開一覧不整合を是正した。単純な件数緩和ではなく、実本文と8読込みの順序・Module別代役・技術key・故障注入先を一致させた。手動VerifierのRootへの旧export注入を撤去し、restart.tsとcleanup/execute.tsの実装Ownerへ個別に登録・復元する。製品Source・公開IF・診断値・保存契約は変更しない。

再点検で見つかったcurrent-authentication-recovery-cli.tsとcurrent-host-transition-worker.tsの生成子本文も同じ実装Ownerへ追従した。認証子はexpectation.keyを検査し、両mockの復元を維持する。生成本文の構文・固定Module接続・旧Root注入拒否を外部Effectなしの試験へ追加した。子本文の実行と手動Verifier自体は実施せず、この静的接続確認を実Host／実Docker成立へ読み替えない。

CheckerはExecutorを含む全13 Packageを列挙し、各Rootの現在の公開Module集合へ追従した。再公開だけのCoordinator Rootは責務・境界・秘密のHeaderを検査する。Package母集団・Module完全一致・禁止公開・負例の検査本体は維持し、実行時の自動一覧生成や検査迂回は追加しない。

| 確認 | 結果 |
|---|---|
| 認証closureの有限試験 | 12件成功。正常・単独故障・確認省略変異と不存在modeを含む |
| 生成子本文の静的接続と既存有限Oracle | 3件成功。実子本文は起動していない |
| Checker DI／全Package公開一覧 | 2件成功。13 Packageの現行集合と負例を確認 |
| Coordinator静的検査 | 終了0。Source／試験型検査、整形、Lintと既存Traceabilityを含む |
| 独立レビュー | Sourceの配線・代役・復元・Checker契約に必須残指摘0 |

Windows専用junction試験は権限不足の先行結果を保持し、今回は実行していない。Checker本体のtsconfig.json単独型検査は終了0だが、配布入口も含む型検査は別の既存配布入口template/tools/crdd-coordinator.ts:12のTS1375で終了1となる。同Fileは今回未変更であり、今回の2系統の追従漏れ修正と区別して残す。参照展開先診断とともに全体QA合格の根拠にしない。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。

#### AI Adapterの解決済み公開境界（2026-11-05）

人間判断によりDIは74ee4f19fを固定点とし、本作業では変更しない。変更が必要になった場合は理由・影響・代替を先に提示する。AI AdapterはgetModelCatalog／resolveModelSelection／planExecution／parseProviderResult／getAuthenticationDefinition／getBillingPolicyの6共通入口へ整理する。中間Schema・環境検査・Provider別Normalizer・エラー分類・認証解析は内部へ統合する。

| 編集単位 | Owner・利用側・保持条件 |
|---|---|
| 実行計画 | Advice許可参照を送信前に検査し、固定Schema・環境と構成診断をPlanへ確定。Executorは解決済み値を使用 |
| 結果 | 実行Planと観測から内容・失敗を解釈。認証結果も同じ公開入口へ接続。Providerの生出力は結果へ返さない |
| 上位の助言 | 型付き内容を直接搬送しJSON往復・内容再解析を撤去。Effect／取消／Cleanup相関は維持 |
| 上位判断 | Availability五軸はCoordinatorへ。Provider差の技術規則・認証・CatalogはAI Adapterに維持 |
| 型・定数 | 入出力に必要な明示型だけをRoot公開し、Snapshotとカタログ本文の二重公開、中間入力型と専用Contract定数を撤去 |
| 検証 | 基準AI Adapter41件成功。現在候補で利用側、拒否順序・理由・送信前拒否・非秘密診断・取消／Cleanup相関を有限回帰し独立レビュー |

Contract ID・既存保存Schema・CLI版・Image・Network・実行許可・Lock・期限は変更しない。未信頼のJSONや永続読取りを型assertで信用しない。新Manager・Registry・Store・ライブラリ・互換Readerは作らない。専門観点はProvider差、送信前検査、型付き結果搬送、外部境界と保存・実行の分離。詳細ArchitectureとQAの対応を更新し、Source／Architectureの独立レビューを行う。標準準拠規則やRelease判断を変えないため全Conformance監査は対象外とし、変更文書の構造・直接参照・横断影響は対象へ適用する。実AI・Docker・過去保持物は操作しない。

##### 接続・回帰・独立確認（2026-11-05）

公開Rootは6関数・11型とした。計画は固定Schema・検査済み環境・助言の許可参照・非秘密構成診断を解決し、結果入口は元計画又は認証定義とProcess観測を受ける。個別Parser・Normalizer・エラー変換・認証解析・Policy定数はRootから撤去した。利用側の型参照は所有元の定義を再利用し、実行許可や保存Schemaを変更しない。

Coordinatorの型付き助言をJSONへ戻す往復は撤去した。作業量の事前検査は共通計画の拒否理由を使用し、Authority発行前の拒否・Mount返却を保持する。Provider五軸の利用判断はCoordinatorへ移した。Artifact TrustのAIT-UT-005と混同していた旧接続を除き、ERB-IT-006の利用可能性確認を補助する純粋UTとしてHeader・Symbol・QAへ接続する。このUTだけで構成選択のIT成立を示さない。

独立Sourceレビューで検出したClaude作業量の解析条件重複は、contextから削除し元Planを正本とした。元PlanのJSONコピーを受理し、役割・Effort差替え、旧contextへの作業量追加、元作業量の欠落・不正を拒否する。計画上限と報告99Turnsは別の診断として確認し、Turn数を結果採否条件へ追加しない。Architecture／Qualityレビューの旧Owner・公開名・検証ID接続は是正し、最終の表記訂正後に残指摘0を確認する。

| 検証 | 結果・範囲 |
|---|---|
| AI Adapter全体 | 45件成功。事前拒否・計画相関・非0終了・認証三値を含む |
| Executor全体 | 100件成功。実AI・実Dockerは呼ばない |
| Coordinator対象回帰 | 135件成功。助言・準備・認証・五軸判断・結合を含む |
| Domain選定保存 | 14件成功。制限環境でhardlink関連2件不成立を確認後、通常Windows権限で同じ試験を実施して成功 |
| Workbench対象 | 18件中16件は制限環境で成功。localhost子Process通信の2件は通常権限で再確認して成功。実AI・実Dockerなし |
| 静的検査 | AI Adapter／Executor／Coordinatorのcheck終了0、Domain／Workbenchの型検査終了0 |
| 公開入口 | Checkerの全Package／DI公開入口2件成功。DI差分0 |
| 文書 | 最終対象9文書の直接診断0。参照展開先3,399診断による全体終了1は別に保持 |

横断Test Catalogは今回未変更の登録台帳と現存試験の不整合17件によりinvalidである。Reality Symbolの全体11診断も残るが、AI Adapter・移管eligibility・Task結果の対象診断は0である。これらを今回の機能回帰成功で解消したとは扱わず、全体QA・Release完了を主張しない。Domainの変更2Sourceは型参照名の追従のみで、TypeScript除去後の実行内容一致を確認した。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。

##### 公開境界整理の追従漏れ是正（2026-11-05）

追加静的点検で確認した4系統を是正した。参照0の旧助言出力Contract定数2件を撤去し、Provider別計画・結果内容・Codex観測の共有型を実装関数のReturnTypeから明示型へ置換した。固定値の判別Union、Provider固有の拒否shape、既存課金方針型の再利用を維持し、共通化だけの新公開型を追加しない。理由値の実値・既存の文字列値域を変えない。

6関数は内部宣言と利用側も同じ公開名へ揃え、旧名へ戻すaliasと同名destructureを撤去した。旧Snapshot名へのWorkbench内alias、利用可否移管前のヘッダー、TaskResultの実装推論から導出する旧設計説明も訂正した。機械Contract ID・保存Schema・CLI引数・認可・期限は変更しない。

AA src22Fileはヘッダー、import、型、module値、関数の順へ統一した。AST categoryの逆転0、配置変更前後の型除去後runtime宣言のハッシュ・順序一致を確認し、module値initializerの評価順、関数本文、runtime import列を維持した。型確認用のコンパイラー出力は今回生成した未追跡IdentityとRootを照合して回収した。依存先へ出た215宣言Fileも同じ生成時刻・元一覧で照合し除去し、DIの追跡対象Source差分は0である。過去保持物へは触れていない。

AI Adapterのcheckと45件、Executorのcheckと100件、Coordinatorのcheckと関連154件（先行135件＋Provider計画結合19件）が成功した。Domain／Workbench型検査とChecker公開入口2件も成功。SourceとArchitectureの独立再レビューは残指摘0である。Rootは6関数・11型のまま。既存の横断台帳不整合・文書展開先診断は先行記録どおり別に保持し、実AI・実Docker・全体QA・Release成立へ換算しない。実AI・Docker・過去保持物の操作、Commit／Pushは行っていない。

##### 境界ヘッダーの最終照合（2026-11-05）

認証定義の確認目的・省略値・不正入力例外をヘッダーへ追従し、Coordinatorが条件・診断へ使うこととExecutorが認証実行へ使うことを分けた。結果Mapping直前の拒否理由説明を用途別結果の説明へ訂正し、内部の環境・エラー・Schema・Claude引数・結果抽出に残った旧利用側境界も現Ownerへ追従した。実装・API・型shape・理由値は変更しない。

同種のSource／現行Architecture再点検と独立確認の残Must-fixは0。AI Adapterのcheckと45件、Coordinator／Executorのcheckを最終コメント版でも再実行し成功した。先行の100件／154件とコメントだけの最終差分を分けて保持する。DIの追跡対象差分0、未追跡生成物0、差分空白検査成功。既存の横断検証不合格・未実施の実境界は解消したと扱わず、実AI・Docker・過去保持物は操作していない。

#### ExecutorのDI結果直接接続（2026-11-05）

基準e8459aa12。既存Executor100件、通常実行・取消・開始通知待ち中の回収、元回復参照、Home排他、単独回収を基準Capabilityとする。Attemptの旧Session再現層とCleanup結果WeakMapを撤去し、同じDI Completionを直接解釈する。DI／AI Adapter／保存Schemaは固定し、新しい互換Reader・Registry・Lockを追加しない。

共通Lifecycleは実行後処理をjoinし、技術Cleanup自体はDIだけが所有する。開始通知はDIへ非同期待機を持ち込まず実行後にjoinする。Process終了・資源不存在・config終了が成立した後に資源終了通知、Home解放、Cleanup完了通知の順を維持する。実行呼出し前の純粋準備拒否と、呼出し後の結果不明を分け、後者は未確認と同じ元IDを保持する。旧形式の有限代役は試験側だけに限定し、製品互換層や新DI実境界のEvidenceにしない。

公開型は旧Session型を撤去し、回復記録の現在形式は上位Ownerで保持する。利用側・Architecture・QAの接続、非AI回帰、独立レビューを完了条件とする。標準規範やRelease判断は変更しないため全Conformance監査は対象外。実AI・Docker・過去保持物は操作しない。

##### 実装と検証の接続

Attemptは同じDI Completionを一回待ち、ResourceSnapshot・Process終了・回収観測・一次失敗を直接解釈する。旧Session型6宣言と変換・Cleanup結果WeakMapは製品から撤去した。Control記録とHome排他は別の保証として維持し、技術回収の再実行はしない。Authenticationも共通Runnerへ接続し、Probeの空Cleanupを撤去した。Runnerはexecute→任意finalize→結果→finishを所有する。

公開資源型はResourceTarget<K, A>／ResourceInspection<K>／ResourceCleanupResult<K>へ既存型を対応付けた。認証の観測入口は新設せず、Containerの同期性、Directoryの用途固定条件、Attemptの元記録・Receiptの必須情報は保持する。旧保存形式の変換は単独回収の内部に残す。Snapshotを保存正本へ切り替えるSchema変更は今回行っていない。

試験用の旧有限Oracleはscripts側だけで現DI通知・結果へ変換する。DIの試験4Fileの型importはこの試験Ownerへ追従したが、DI製品SourceとAA差分は0である。既存の旧助言fixtureには許可参照を明示し、実計画と用途を一致させた。非0認証のunknownはAAの現行解釈を維持し、成功へ緩和しない。旧配列の参照同一性ではなく元観測内容と同じ回復IDを照合し、回収不明を明示三値で記録する。

独立Sourceレビューの作成実ID観測と正規Timeout分類の指摘を是正した。作成通知へ届かなくても元Snapshotの実IDを作成観測へ保持し、PROCESS_FAILUREだけを先着wait故障として固定する。ETIMEDOUTはProvider／setupの既存期限理由を維持する。文書レビューの旧Session表現・孤立ヘッダーとOracle不足も是正し、通知→Home→最終通知の直接順序、認証Rootの同期throw／非同期reject非波及を確認する。

先行固定候補ではExecutor103件、Coordinator関連177件、DI有限接続17件が成功した。制限環境でWindows取消2件は終了観測不成立となったが、通常権限で同じOS子Process試験を再実行し、参照期待の追従後2件成功した。実Docker・実AIの成功ではない。正規Timeoutの追加反例を含む候補でExecutor104件、Coordinator関連177件、DI有限17件、Checker公開一覧1件が成功した。Source独立再レビューは残指摘0。Architecture独立レビューの残1表現は是正し、最終結果との現在地一致を確認する。対象4文書の直接診断0、参照展開先333診断でChecker全体終了1である。試験のonCompleted引数もDIの非null契約へ明示的に追従し、型検査が成功した。既存の横断台帳不整合17件、Reality診断11件と文書参照展開先診断を今回の合格で解消したとは扱わない。Commit／Pushと実AI・Docker・過去保持物の操作は行っていない。

最終型追従後もExecutor全104件とcheckが成功した。Coordinator関連177件、Windows子Process取消2件、DI有限接続17件、Checker公開一覧1件の成功と区別して保持する。Source／Architecture・Qualityの独立再レビューは残Must-fix 0。旧製品Session参照と現行設計の旧説明は零、DI製品Source・AI Adapter差分零、未追跡生成物零、差分空白検査成功を確認した。実AI・実Dockerでの再成立、既存横断QAの解消、Commit／Pushは今回の完了主張に含めない。

#### Executor構造の簡素化とSnapshot回収契約（2026-11-05・着手）

基準feb84aecc。前段104件／177件／Windows2件／DI17件のCapabilityを基準とし、Source7Fileの目標構成、短命Control、DI元Completion、必須保存通知、既存Home解放条件へ対応付ける。着手時点ではDI／AA製品、Image、期限、認可、過去保持物と実AI・Docker操作を対象外とした。後段の人間判断によりDI Cleanupの識別契約だけを変更し、その他の対象外は維持する。単なる移動を完了にせず、汎用LifecycleOperation／Runner、用途別開始・取消の重複、旧5資源再構築、認証回収再構築、旧公開型と互換読取りを撤去する。

| 編集単位 | 新Owner・利用側・保持条件 |
|---|---|
| 短命Control | lifecycle/execute.ts。一回開始、開始前取消拒否、DI Session未結合時の取消保持、一回配送、終了後拒否と購読解放。固有Capability・Homeは代替しない |
| 用途構成と結果 | lifecycle/attempt.ts／authentication.ts／probe.ts。各用途一File。AD解析・DI技術回収をコピーせず、実在する後処理だけを直接実装 |
| 型と公開入口 | lifecycle/types.ts、index.ts。主要5関数と用途別の型安全性を維持。私有制御と旧Session型をRoot公開しない |
| 保存・再入場 | Coordinator／Domain。新規開始時にDI Snapshotと回収順序・観測条件を確定する。追加の実行構成照合候補は保存しない。管理所在・Signalは呼出時に借用し、Prompt・環境値・Proxy tokenは保存しない |
| IntentとReceipt | 発行前意図、未発行確定、元Snapshotの受領を同じOperationへ保存。意図を発行実績へ変換せずunknownを保持 |
| 単独観測・回収 | lifecycle/cleanup.ts。旧用途Projectionからの再構築を廃止しDI契約へ接続。ID欠測発見とDirectory条件を維持 |
| 試験と正本 | 既存単体・契約・Coordinator結合、開始／取消五段階、保存失敗・Process中断・Receipt欠測・元ID不一致・Label違いを対応付ける。SourceとArchitecture／QAを独立レビュー |

着手時は既存の完全構成照合を維持する前提でUser・Init・Tmpfsの保存を検討した。その後、下記の必要性再評価と人間の判断により、回収の識別条件から実行構成を分離し、追加保存案を取り下げた。終端Snapshotだけの保存へは縮小しない。旧形式の製品Reader・新Store・Registry・Manager・永続State Machineは作らない。既存保持物は移行・回収済みと扱わずそのまま残す。保存契約・移行に影響するためArchitecture／Quality／直接利用側の横断確認を実施し、標準準拠基準・Release判断を変えないため全面Conformance監査は対象外とする。

##### 短命Controlと7Sourceへの接続

lifecycle/operations.tsと汎用LifecycleOperation／executeLifecycleを撤去し、execute.tsは開始・取消・終端とDI Sessionへの一回配送だけを持つ。各用途は元DI completionを直接解釈し、Attemptだけが必要なHome解放と通知を実施する。Auth／Probeの結果構築後の別microtaskでfinishする経路は独立レビューで検出し、同じ同期handler内のfinallyへ是正した。

srcは目標7Fileへ統合し、型・同じOwnerのimport/export・定数評価順を追従した。用途別フォルダと旧callbacks／constants／configuration／result分割は製品Sourceから撤去した。旧回収構成の再構築はcleanup.tsへ暫定的に残っており、削除済み・統合完了とは扱わない。

移動前のExecutor102件と、移動後の対象29件・Coordinator177件が成功した。移動後の全体102件ではsummary計測のconsumer import順序1件が不成立だった。定数と実行本体の同じOwner化に伴い、計測を先に設置してから合成Plan fixture／正式consumerをimportする順へ試験だけを修正し、当該2件を再実行して成功した。既存の汎用Runnerだけを検証する2件は対象消滅により撤去し、残るControlと用途別の実経路を確認する。これを旧回収契約撤去や実AI／実Dockerの成立へ一般化しない。

人間は新保存形式の採用を承認した。保存はResourceSnapshotに元実IDを一元化し、key別のIntent／Receipt由来・不存在証跡と、不変の非秘密発見条件を分ける案とする。管理DirectoryとSignalは再入場時に借用し、Prompt・環境値・Proxy tokenを保存しない。この時点ではDI準備で確定する非秘密回収条件の追加を判断待ちとしたが、後述の最小識別条件の採用により取り下げた。DIの技術条件をExecutorで再実装したり、ID欠測時の回収能力を縮小したりして完了とはしない。

##### 回収時の構成照合の必要性再評価

人間から、DI準備結果への回収条件追加より先に、照合そのものが過剰でないか確認する指示を受けた。DI項目追加と保存Schema実装を一旦保留した。現コードではID欠測時の候補発見と削除直前だけ、User・Init・Tmpfs等の完全構成を識別条件へ加えている。一方、実削除は元ID指定のcontainer rm --force又はnetwork rmであり、Volume削除は行わない。未信頼AIにHost Docker操作権限は与えていない。

元Intent、資源名、同じ操作のnonce Label、名前照会と名前＋Label照会の一意ID一致、inspectによる実ID・種別・名前・Label照合、発見IDの必要保存、ID限定削除と事後不存在を維持すれば、回収対象の識別と実行構成検査を分離できる可能性がある。Labelは集合で共有されるためLabel単独の一意性を仮定しない。構成一致は同daemon権限者の所有証明ではなく、同じ構成を複製される反例を除外できない。

既知IDの既存最小照合、実行前のImage・User・Mount・Network・Init検査、Directory処置、現在Owner・排他・必要通知、Process終了確認と回収後不存在は変更対象外とする。ID欠測時の既存完全構成条件を削減する場合は、先行の「既存条件維持」から判断を更新する必要があり、Sourceを変更する前に影響と反例を人間へ返す。

##### ID欠測回収の最小識別条件の採用（2026-11-05）

人間は上記の最小照合への変更を承認した。DI PreparedIsolationへのUser／Init／Tmpfs等の追加と、Discovery完全構成の追加保存案は取り下げる。回収はSnapshotのIdentityとrequest状態を使い、未発行資源は処置しない。元未解決Intentに対応する名前とnonce Labelを再利用せず、exact名と同名＋Labelの照会が同じ一意IDを返した後、inspect・ID保存通知・ID限定再照合と削除・事後不存在へ接続する。Label集合全体の一意性は要求しない。

実行前の完全構成検査は維持する。欠測・複数候補・別ID／名前／Label・通知失敗・Process終了未確認・不存在不明は停止する。現在構成の非秘密投影は返すが、保存済み期待値との差分判定は行わず、構成差を回収対象の識別条件にしない。Directory、Image、期限、現在Owner・排他・保存順序は変更しない。変更源はこの識別契約であり、Source行数や型数を回帰面の根拠にしない。

<a id="executor-identity-cleanup-20261105"></a>

##### 最小識別条件の実装・非AI回帰（2026-11-05）

DIの共通Cleanup要求から`discovery`構成候補を撤去した。欠測IDはSnapshotの予定名と名＋所有Labelの二経路で同じ一意実IDを確認し、fresh inspect、必須の発見通知完了、同IDの削除直前再照合、ID限定削除、事後不存在へ進む。通知後の名前／Label差替え、非同期Reject、通知欠測は削除0件と発見ID保持を反証した。Image／Network等の構成差だけは回収を妨げない。実行前の完全構成検査とDirectory条件は維持する。

| 確認対象 | 結果と限界 |
| --- | --- |
| DI静的確認 | Formatter・型検査・Lint成功。既存info診断のみ |
| DI全体回帰 | 394件中389成功・5明示skip。制限環境のWindows junction作成EPERMを分離し、新品Repository内領域の同じ試験を通常権限で成功確認後、全体も同条件で成功 |
| Executor静的確認・全体回帰 | check成功、102件成功。有限回収Adapterが本番拒否より先に入力検査例外を外へ出す問題を修正し、製品のblocked結果をそのまま観測 |
| Coordinator静的確認・試験選択逸脱 | check成功。関連6Fileを直接指定した際に通常入口のHost除外条件を付け忘れ、実Host試験を含めた。72件中65成功・7失敗。安全な非AI回帰完了とは扱わず、下記の逸脱と残存不明を優先して停止 |
| Source独立確認 | 7Source／共通Controlの先行確認と、今回の識別・通知失敗反例の再確認で残Must-fix 0 |
| Architecture独立確認・文書検査 | 旧完全構成条件とSource配置の説明を是正し、再確認で残Must-fix 0。今回4文書の直接診断0。参照展開先52診断によるChecker全体終了1は別に保持 |

元Snapshotの新保存形式・作成Intent／Receipt保存への接続、旧五資源と認証の回収再構成の撤去は未完了である。7Source化だけを構造リファクタリング全体の完成とはしない。現在の技術確認は実Docker・実AI成立を示さず、過去保持物の読替え・移行・操作も行わない。

##### Coordinator試験選択の逸脱と停止（2026-11-05）

実行者が通常の`test:portable`にある`^(Host Windows:|Windows Process Gate:)`除外条件を、個別6File指定へ引き継がなかった。その結果、禁止範囲の実Docker用5CaseとWindows保存2Caseが選択され、いずれも失敗した。実Docker用Caseは作成・観測・補償回収を含むため、「実Docker操作なし」とは主張しない。外部AIの送信、Docker再起動・Image更新、過去保持物の操作は選択Caseに含めていない。追加のDocker照会・再実行・削除は行わず、残存確認に必要な人間判断へ戻す。

ローカル記録のみで特定した今回の残存は次のとおり。過去の同接頭辞Directoryは操作しない。

| 今回のexact対象 | 確認できたこと・未確認 |
| --- | --- |
| `.crdd/tests/docker-isolation-host-2tv6ZR/` | resources.json／cleanup.jsonを保持。nonceは`c9a37554acb508ad`。認証確認Containerの作成要求だけsubmitted=true、実IDはnull。他4資源は未要求。Process終端true、Network不存在true、Container不存在false、Cleanup未確認。falseを不存在へ読み替えない |
| `.crdd/tests/claude-authentication-record-N9NCrS/` | 子試験用Directoryが残存。ファイル列挙結果は空であり、Docker実体不存在の根拠にはしない |

前者の予定名は`crdd-auth-c9a37554acb508ad`、所有Labelは`crdd.coordinator.runtime=c9a37554acb508ad`。同名・同Labelの読取り観測と関連する今回資源の有無を確認するには、別途Docker照会の明示許可が必要である。現時点では削除を要求しない。物理残存はこの不明状態の確認まで保持し、2026-11-12を再評価上限とする。期限だけでは削除せず、未解決参照・実体・所有を確認する。現在の構造リファクタリングは未完了のまま停止し、上記非AIのDI／Executor成功をCoordinator全体又は実境界の成功へ昇格しない。

##### 許可後の限定読取り結果（2026-11-05）

人間が今回対象のDocker読取りを承認した。固定CLIの信頼を前後確認し、中立環境・固定Linux Engine接続先で予定名のexact filterによるContainer一覧を一回要求した。終了1・Signalなし・Process APIエラーなし・標準エラー224 bytesで失敗したため、Label側一覧とinspectには進まず、再送しなかった。標準エラー本文・認証値・生出力は保存していない。OS側の追加読取りではDocker Desktop／backend／buildの対象Processは0件、固定Engine接続口は未検出だった。この結果を対象Containerの不存在へ換算しない。Dockerの起動・再起動・削除、AI送信、試験物と過去保持物の操作はしていない。実体確認の継続にはDocker Desktopの通常起動の別許可が必要であり、現時点では未確認のまま停止する。
##### 人間による保留とコード整理再開（2026-11-05）

人間は今回のDocker実体確認を保留し、コード整理の再開を指示した。読取り未確認を不存在又は作成成功へ変更せず、今回の物理試験領域と過去保持物を操作しない。実AI・Docker操作を追加せず、コードと有限代役試験だけを進める。

通常入口にある`^(Host Windows:|Windows Process Gate:)`の除外条件を個別指定にも明示し、Coordinator対象6File・60試験が全て成功した。実Host経路を成功件数へ算入しない。

Executorの既存観測・回収APIへ、DI正本のSnapshot要求を直接渡す接続を追加した。新しい関数・専用資源Model・管理Stateは作らず、既存ResourceTarget／Inspection／CleanupResultの型対応へDI正本を追加する。観測のSignal・停止条件、回収の通知、元Session・取消・Completionの参照をそのまま搬送し、旧五資源Projectionへ変換しない。有限DI代役で入力・通知・Session・結果の同一性を検証した。独立レビューで検出したkind accessorとprototype Proxyの事前実行を是正し、両入口のhook0・DI呼出し増加0を固定した。最終check、Executor全103件、Coordinator型検査とHost除外対象60件が成功し、Source独立再確認の残Must-fixは0。今回5文書の直接診断0、参照展開先349診断による全体終了1は別に保持する。初期Snapshot＋最初のIntentの一回保存、新Schema、作成Receipt保存、再入場の本番接続と旧経路撤去は引き続き未完了である。

##### 保存接続の確定断面（2026-11-05・実装継続対象）

次の保存接続では`resources`を初期未受領のnull、又はSnapshot・key別checkpoint・元回収方針の集合へ置換する。実ID・名前・Label・種別・現在構成はSnapshotだけに置く。checkpointはkey、submission、receiptSource、observation、absenceEvidenceSha256を持ち、同じID・名前・Recovery IDを複製しない。nullを空集合・不存在へ読み替えない。

回収方針は元DI RequestのcleanupOrder・setupTimeoutMs・unreceiptedAbsence・verifyLabelAbsenceだけを保存する。管理Directoryは現在Hostから借用し、previouslyAbsentはcheckpointから導出する。Snapshot配列順や旧五資源知識から回収順を再構築しない。User・Init・Tmpfs・旧Discovery構成は追加しない。

最初の作成通知で初期Snapshotと対象Intentを同じWriter改訂へ保存する。DI作成前のSnapshot.requestがnot_issuedでも、保存Intentだけが残る再入場ではunknownとして投影し、発行済み確定へ昇格しない。Receiptは元Snapshotごと同じ操作へ保存し、既知IDの消去・変更、key／種別／名前／Labelの不一致を拒否する。構成情報は未観測から実測、Network接続後の合法な現在観測へ更新でき、構成差自体を保存・回収拒否条件にしない。非秘密のshape検査は維持する。

この断面は着手前の読取り照合で確定した実装対象であり、新Schema本番接続・旧Reader撤去が完了したという記録ではない。新Store、旧形式互換Reader、保持物の自動移行は追加しない。
##### Snapshot保存接続の実装と限定検証（2026-11-05・全体未完了）

Domainの資源記録をSnapshot・key別checkpoint・元回収方針の集合へ変更し、初期未受領はnullで保持した。保存Schemaは`crdd-domain/runtime-state/v2`とし、旧配列形式を受理する互換Readerは追加していない。通常Attemptと認証の作成前通知・Receipt通知・発見ID通知・終了観測を同じ操作の記録へ接続した。再入場は保存されたSnapshotと元回収順序等をDIへ渡し、製品Sourceから旧五資源期待値生成・認証資源再構築を除去した。試験側の旧有限Oracleと旧試験Adapterは残り、全面移行済みではない。

途中の独立読取り確認で4点を是正した。連続する同IDの不存在観測では最初の証拠Hashを保持し、履歴確定前の再導出を冪等にした。認証の初期Snapshot＋Intentの読戻しは保存したBook全値のcanonical一致を要求する。認証のexact active／idle記録の読取り成功である`{resources:null}`と、読取り失敗又は未終了Intentのnullを分離した。Domain保存codecはSnapshot全資源のLabelを元OperationのLabelへ結合し、別Label・混在Labelの初回保存を拒否する。4点の是正再確認は残指摘0であり、旧試験移行や全体完成の判定は含まない。

限定検証結果:
- Domain新資源記録6件と保存codec7件: 13件成功。
- Domain一般CRUD／保存先切替の結合: 18件成功。初回のリンク作成権限不足による不実行を別に記録し、同じ試験を必要権限で再確認した。
- Executor通常Attempt・認証・Snapshot資源入口: 17件成功。元DI通知とDomain記録更新の有限結合を含む。
- Coordinator認証記録: 3件成功。実宣言をメモリ内Filesystemへ接続し、読戻し改変・Receipt相関・未要求と不明を確認した。
- DIの明示選定した有限資源観測／Snapshot／共通回収: 14件成功。
- Coordinator製品Sourceのstrict型検査、DI型検査: 成功。新規Domain更新処理・試験、選定Executor試験、認証記録試験のlintは成功。

DI一括回帰の要求は、Host除外名だけでは実Docker経路の不選択を保証できないとして実行前に安全確認で拒否された。迂回せず、本文確認した有限代役の個別試験だけを実施した。実AI・実Docker・保留中の物理試験物・過去保持物は操作していない。

残作業は、旧配列形式に依存するDomain／Coordinator試験と検証スクリプトの追従、旧試験Adapter2ファイルの撤去、Operation Identityに残る旧技術投影の利用確認、固定候補での対象回帰・最終独立レビューである。Domain全体型検査は旧試験の配列参照等で不合格であり、限定成功を全体Passへ昇格しない。現在、人間による追加判断は必要ない。
##### 旧試験移行とIdentity重複撤去の継続（2026-11-05）

人間が残件1〜3の一括継続を指示した。複数正本の実装責務・保存契約と試験の追従として、変更前保証を読取り照合した。着手前の別確認者が、Snapshot名集合の完全一致、null Book拒否、Operation／選定／Home／Mount相関の保持と、Image比較を別のGateへ移さないことを確認した。新しいHash・Store・互換Readerを追加しない。

Operation Identityはv3へ変更しresources／imagesのコピーをproducerとDomain閉集合から撤去した。Host完了はBook Snapshotから元Planのkey・一意数・件数・名前を完全照合する。認証unknown不存在証拠もSnapshotのcontainer・名前を使う。item3の限定独立確認は残Must-fix0。Coordinator製品strict型検査は成功した。

Executorの認証試験と単独回収試験は、旧Command／Recovery Adapterを介さず、実Executorと実共通DI Lifecycleへ接続した。DI既存の有限CLI・Process・Directory代役をtests/support/isolation.tsへ抽出して再利用しただけで、製品のRuntimeや注入点は追加していない。置換した保証と試験の対応をQA正本へ記録した。認証＋共通Lifecycle22件、単独回収13件、新Identity／資源記録7件、Host名集合1件、Host観測条件1件、Domain終了要約1件、Domain修復状態20件が成功した。実AI・Docker・保持物の操作はない。

単独回収の物理成立と終了通知の失敗は別fieldで扱う。通知失敗時に物理的な回収成功を未回収へ書き戻さず、notificationDeliveryConfirmed=falseを保持し、上位の保存確定は別に要求する。

旧AdapterのExecutor試験からの直接参照は撤去したが、Coordinatorの保存・再入場・Host用試験に参照が残るため2ファイル自体は未撤去。旧Domain配列形式の全試験移行、Coordinator側残参照、固定候補での全体回帰も未完了であり、1〜3全体完了やコミット可能とは表示しない。追加の人間判断は不要である。

##### 旧試験移行1・2の追加断面（2026-11-05・未完了）

認証の旧Command試験Adapterを撤去した。Coordinator認証は実Executor→共通DIを有限CLI端へ接続し、両ProviderのLogin／Status、Intent・Receipt・最終記録・Home解放を検証する。読取り専用の独立確認で見つかった最終Completion直前のHome Owner喪失を反例へ追加し、最終記録・settleの呼出し0と同じ回復参照を確認した。

現在回収試験と再起動準備試験から旧Recovery Adapter参照を撤去し、保存されたBookから実Domain候補・実DI Cleanupを通す。二資源の部分回収後に保存Bookと有限資源状態を別Ownerへ引き継ぎ、既回収実IDの追加削除0と最初の不存在証拠Hash保持を確認した。終了Writerの値FixtureはSnapshot／checkpointのkey・実ID・要求状態を一致させ、Book検査の肯定対照を先に要求する。

Domainの旧配列試験3ファイルを新Bookの入力・イベント・終了観測へ追従させた。巨大な状態遷移試験は実行成功し、履歴・配送・再入場・限定認証閉鎖の反例を維持する。移行時の反例により、同種資源名重複の拒否と、再起動checkpoint確定後の新規Intent禁止が新契約で不足していたため、Domain保存検査へ復元した。既存IntentへのReceipt・発見ID保存と回収は妨げない。追加のManager・互換Reader・DI製品変更は行わない。

| 実施した確認 | 結果と限界 |
| --- | --- |
| Domain全体型検査 | 成功。旧配列の型エラーをcastや除外で隠していない |
| Domain資源記録・状態遷移・codec・履歴要約・修復状態 | 36件成功。状態遷移の1件は内部に複数の正負対照を持つ |
| Domain保存Writerの明示した有限対象 | 6件成功。実OS排他・実Dockerの成立は含めない |
| Coordinator認証・記録保存・現在回収・再起動準備 | Host／Windows Process Gateを除外し92件成功 |
| Executor認証・Attempt・資源入口・単独回収・共通Lifecycle | 52件成功、全体型検査成功 |
| Coordinator製品Source strict型検査 | 成功。全試験型検査には旧検証Fixture参照が残り不合格 |
| 上記Home guard・重複名・再起動guard・部分回収・終端Writer入力の限定独立再確認 | 残Must-fix 0。移行全体の完了判定ではない |

runtime-snapshot-ioの広い非Host選定は結果確定前に中断し、全体成功には算入しない。個別に本文確認した有限6件のみを成功として扱う。実AI・実Docker・過去保持物の操作は行わない。

残るRecovery Adapterは、coordinator-state-runtimeの認証unknown再入場試験に一利用が残るため未撤去である。この試験は二段不存在・専用Writer・発見ID保存前削除禁止の変異Oracleを持つ。単に高位結果をmockする置換は採用せず、共通DIの同期観測端と非同期実行端を同じ有限資源状態へ接続し、実保存DirectoryはFixtureの広いFilesystem代役に飲み込ませない。検証Script／Native向けFixtureの旧配列参照も未完了として残す。人間の追加判断は不要であり、1・2全体完了又はコミット可能とは表示しない。

<a id="executor-test-migration-20261105"></a>

##### 旧試験移行1・2のSource接続と非AI回帰（2026-11-05）

上記の未完了断面に続き、人間が許可したコード整理を継続した。旧認証Command Adapterと旧Attempt Recovery Adapterの二ファイルを撤去し、全TypeScript参照0件を確認した。Coordinator全試験、Domain全体、Executor全体の型検査は、旧配列参照を除外やcastで隠さず成功した。

Native親の認証unknown試験は、同じ保存記録を子Processで読み、実Domain Writerと共通DIへ有限CLI端を接続するsnapshot-recovery-owner.tsへ移した。元の14シナリオについて、二段不存在、現在Owner、発見IDの保存前削除禁止、専用閉鎖Writer、保存拒否・読戻し差・解放不明、内側/外側終了と保存の順序、再入場時の追加処置0をSourceに維持した。実Host Gateは実行していない。

手動Producerは五資源の旧再構築をやめ、一資源のDI準備Snapshotと元Intentを保存する。Receipt未保存の故障窓では追加の推測更新を行わない。Snapshotの初期not_issuedとcheckpointのintent_savedを共同で読むため、作成要求済み不明を未発行と解釈しない。固定Image参照とImage IDを分離した。これは試験Sourceの追従であり、手動Producer・Docker要求の実行許可ではない。

追加の全回帰で、単独Host/実AI検証ToolのReaderと有限IPC Fixtureにも旧flat記録が残っていることを検出した。同じDomainイベントを通すBookへ追従し、名前・Label・重複・Provider・不存在時Identityの反例と限定清掃条件を維持した。試験専用の旧Session Oracleでは、初期、要求後ID欠測、明示未発行、Receipt取得を区別する専用反例を追加した。製品へ旧互換Layerを戻していない。

| 固定候補での確認 | 結果と限界 |
| --- | --- |
| Executor npm test | 整形・全型検査・Warningを失敗とするLint・全109件成功。実AI/Dockerは使わない |
| Coordinator npm run check | Repository整形・製品/全試験strict型検査・Warningを失敗とするLint・二種Trace検査成功 |
| Coordinator認証・現在回収・再起動準備 | 92件成功。実Host/Windows Process Gate除外 |
| Coordinator追加の保存/Task/再入場/実行接続10 Suite | 197件成功＋junction1件を必要権限で個別成功。初回のjunction権限拒否をコード成功へ読み替えず再確認した |
| Coordinator手動親/起動確認の純粋Oracle | 15件成功。手動Root読取り入口と実Process Gate除外 |
| Domain npm run check | 整形・全型検査・Warningを失敗とするLint成功 |
| Domain資源/状態遷移/codec/履歴/修復 | 36件成功 |
| Domain保存Writerの限定対象 | 6件成功。Native排他全体の実証ではない |
| DI全型検査・共通Lifecycle/回収/Snapshot有限対象 | 型検査成功、90件成功。DI製品の新規変更なし |
| 独立Source確認 | 移管漏れ、Image参照/ID、終了Oracle、欠測IDの扱いを是正後に再確認。限定指摘は解消。最終の旧配列Reader一件も是正し、子本文の有限反例を追加。集合SHA 4545c3ef…の最終独立確認は残Must-fix 0 |

固定Source候補は、40_Develop配下の変更・追加・削除128ファイルについて、pathと各SHA256（削除はdeleted）を昇順でCRLF結合した集合SHA256 `4545c3efdb2f9f709fa69509b7fb9df3f8f56b97d4959e2a13e6c116ad7c4b59` とする。文書の結果記録はこのSource集合の外側で追従する。

実Host/Windows Process Gate、Native親14シナリオの実行、実AI/実Dockerでの新保存形式の再成立、過去の保持物確認/回収、旧保存形式の移行は未実施である。従って非AIのSource整理・対象回帰の結果を、Executor新構造全体の実境界完成、全Repository回帰、QA全体Pass又はRelease成立へ拡張しない。現在、人間による追加判断は必要ない。
<a id="executor-five-followups-20261105"></a>

### 全Source確認で検出した五系統の是正（2026-11-05）

変更分類は、承認済みExecutor構造整理に対する不具合是正・利用側追従である。旧形式Reader、試験専用Runtimeを実試験へ接続する互換経路、新しいManager／Store／Lockは追加しない。DI製品は今回追加変更していない。

| 系統 | 是正と現在のOwner |
| --- | --- |
| Attempt入力 | 公開Factoryの先頭でRequest／target／保護対象を自身のdata propertyとして捕捉。欠測・accessor・Proxyを評価せず、乱数・下位Effect前に拒否 |
| 実AI用検証Tool | Request構成→公開createExecutor→共通DIへ直接接続。旧試験SessionとToolのHome二重取得を撤去。製品の同一Home Lease生存確認を通知待機後に維持し、Hostは取得後のNative再観測・必須保存・元Completion受領を所有 |
| 新形式の正例 | current-host-transition、docker-restart-runtime、Task結果fixtureをOperation Identity v3と資源Bookへ追従。Taskの合成終端もDomainのsubmission→receipt→cleanupを使用 |
| 子本文・再入場 | Native／worker文字列内の旧Identity.resources／imagesとflat配列読取りを撤去。元Book全文比較、Snapshotの要求／実IDとcheckpointのIntent／Receipt由来／証拠を分離し、五key完全一致とauth unknown保持を固定 |
| 管理情報 | Executor／DIのSymbol参照とDI試験カタログを現存Sourceへ追従。既存識別子を維持し、カタログの段階をIntegrationへ合わせる |

独立レビューで検出した、create以外の未発行通知の誤保存、Home生存確認の移管漏れ、旧変数／配列読取り、auth unknownの独立期待不足、正規PROCESS_FAILURE診断のIPC拒否、Architectureの旧Owner記述を是正した。既知診断コード一値だけを許可し、未知コード・自由文の拒否は維持する。レビュー指摘を安全条件の緩和やDI変更で通さず、実Attempt由来の診断と親IPCの元理由・回復IDを反証した。

固定Source候補は40_Develop配下の変更・追加・削除135ファイルのpathと各SHA256（削除はdeleted）を昇順でCRLF結合した集合SHA256 `48fea113ac93f800b73b54bf03618427b3453feb3796afd4c926c913a7ab716b`。文書と試験カタログはSource集合の外側で追従する。

| 今回の確認 | 結果・限界 |
| --- | --- |
| Executor全体 | 最終診断是正後のnpm testで整形・型・Lintと全111件成功（約103秒） |
| Coordinator静的検査 | npm run check成功。Repository整形、製品／全試験strict型、Warning失敗Lint、二種Trace。最後にCoordinator及びWorkbenchの利用側型検査も再成功 |
| Coordinator認証・回収・再起動 | 6 Suiteの111件成功。実Host／Windows Process Gateを除外 |
| Task／Objective代表結合 | 通常結果配送1件、Objective受付・重複抑止・exact回復・混在回復3件、System回復1件が成功。全Task Suite再実行の代用とはしない |
| Domain | npm run check及び資源Book・修復・codec・状態遷移・履歴の36件成功 |
| DI | 全型検査と共通Lifecycle／Cleanup／Snapshot／観測の有限90件成功。実Dockerなし |
| 独立Source／利用側 | 是正後の固定集合でSource・利用側とも残Must-fix 0。Architecture・QA・Catalog・本結果の最終独立再確認も残Must-fix 0 |
| 全体Checker | 初回3,757エラーから対象2件を是正し、再実行は3,755エラー。今回対象のExecutor／DI、試験カタログ、QA-000006の指摘は0。対象外のリンク／品質整合等は残り、Repository全体Passとはしない |

初回のExecutor回帰不合格は、旧Plan全体をtargetへ渡す試験入力と有限Process代役の影響範囲を特定し、現行Requestと用途ごとの終了観測へ追従後に再実行した。Coordinatorの広めの試験は診断中に中断したため、その未完了runをPassへ換算しない。代表結合試験は改めて通常入口で実行した。中断runの物理試験領域の回収は確認済みとせず、由来・Identityを確定できない領域を名前や日時から削除しない。

今回、実AI・実Docker・Native Host Gate・過去保持物の操作は行っていない。新保存形式の実AI／Docker再成立、旧データ移行、全Repository回帰、全体QA・Releaseは未完了のまま区別する。現在、人間による追加判断は必要ない。
<a id="executor-final-cancel-and-oracle-20261105"></a>

### 最終取消と検証Ownerの追加是正（2026-11-05）

追加確認で二件を検出し、人間が修正後の全体確認・問題がなければcommit／pushを指示した。

| 指摘 | 是正・保持した条件 |
| --- | --- |
| 最終診断内の取消が成功結果に反映されない | 最終取消再判定を同期診断呼出し後・Completion構築直前へ移動。追加await／callbackなし。正常からの取消は内容・Hash・bytes・所見を非公開とし、先行blocked理由・回復ID・技術清掃・一回解放を保持。finish後のonCompleted取消は拒否 |
| 本番Factory検証と称する旧試験Runtime経路 | production_factory分岐、その旧DI Factoryモック、単一使用のcreateExecutorLifecycleTestRuntimeを撤去。残るcandidateは局所Oracleと明示。本番公開入口の義務は既存Host／CLI→共通DI有限境界試験へ対応。旧API・Owner照合を復活させない |

実Attemptの有限DI試験では正常／先行PROCESS_FAILUREと診断throw有無の四形を確認した。公開Executor→共通DI→Host記録のcancel_diagnostic形でも、取消受理と最終cancelled・内容非公開が対応する。局所候補試験の説明は、実際に確認する一回消費・別管理参照の取消拒否・終了後取消拒否へ限定した。

| 最終確認 | 結果 |
| --- | --- |
| Executor npm test | 静的検査と全112件成功。約116秒 |
| Coordinator利用側 | 準備・Provider接続・助言・資源Identity・認証記録・Host観測の37件成功 |
| Coordinator npm run check | Repository整形、製品／全試験strict型検査、Warning失敗Lint、二種Trace成功 |
| 全体読取り | Executor全7 Source、利用側の675 TypeScript、13 Symbol ManifestとCatalog 431 Pathを照合。旧形式・消滅API・本番経路を偽装する分岐の追加未処置なし |
| 独立確認 | Source・利用側・Architecture／QAを分離して確認。製品Must-fix 0、試験説明のMinorも是正 |

今回のSource集合は135ファイル、前節と同じ算出方法のSHA256 `3f0328609478b86e1ffcc1e210f510f7b0f919dcb064cec321f257011ed4e203`。全112件実行後のSource差は試験説明一行だけであり、動作を変更していない。DI製品・公開IF・保存Schemaはこの二件では変更していない。

実AI・Docker・Native Host Gate・過去保持物は操作していない。前節の実境界未成立、全体Checkerの対象外3,755エラー、中断runの物理試験領域の回収未確認を解消したとは扱わない。ここまでのSource整理と限定回帰・独立確認をcommit／pushすることは、main統合・Release・全体QA合格を意味しない。
<a id="executor-real-e2e-first-stop-20261105"></a>

### 公開Executorの実E2E初回停止（2026-11-05）

対象Commitは `a80829f4e5460f650025045d670163483a4825d4`。人間がExecutorの実AI／実Docker E2Eと、停止していたDocker Desktopの通常起動を承認した。署名確認後に通常起動を一回要求し、公開環境観測でbackend running／Engine ready／観測cleanup confirmedを確認した。再起動・修復・Image更新は行っていない。

計画はCodex／Claudeそれぞれadvice・edit・review・cancelを各一回、最大八試行とした。GPT-6.1 Sol／Opus 5.5、いずれもMedium、既存固定Image、合成Prompt及び新品work/source.txtだけを対象とし、実Repository本文は送信しない。1件の失敗又は不明で残り全件を停止し、自動再送しない条件で実行した。

| 確認項目 | 観測 |
| --- | --- |
| 実施した試行 | Codex advice、`EXEC-20261105-165950-6d4aed04-01`、終了値2 |
| 結果 | blocked／docker_process_controller_execution_failed_closed |
| 停止点 | create_subscription_auth_probe。作成要求のHandle取得・応答受領あり。終了0、stdout 65 bytes、stderr 0 bytes。Receiptは未記録 |
| 診断 | stage command_wait、exceptionCode unclassified_exception。作成応答受領後からReceipt確定前までの詳細な失敗箇所は、この診断だけでは確定できない |
| AI実行 | providerProcessStartedObserved false。今回ProviderのAI実行は開始確認なし。残り七試行は未開始 |
| 技術終了と回収 | Node子close、Process tree終了、Container／Network不存在、Home解放、Native観測の終了をToolが確認。cleanupConfirmed／releaseConfirmed／nativeCleanupConfirmed true |
| 保存・試験領域 | terminalSaved false、fixtureCleanupConfirmed false。通常cleanup条件を満たさずRootを保持。強制清掃・追加回復・再試行なし |
| 耐久記録 | recovery_opened、recovery_handoff、最初のsubmission_plannedを確定読取り。outcome.jsonも元runIdで確定読取り成功 |
| 領域の内容 | management／tmpは空。イベント三件と各commit記録、outcomeとそのcommit記録。生Provider出力・認証値は保存していない |

保持Rootは `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261105-165950-6d4aed04-01`、観測Identityは `1687905628:151996487424747370:1793865591295049100`。元回復参照は `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.4ce6e769d2e256e33a7851b11f06d8ad51a04ab588005d57dd8ffddd4f64c3a4.1250a57aa2b61abf08f05a4e6572bd48afba668e2e7ef07b312c5d10360df4ee`。再評価時刻は `2026-11-12T07:59:54.587Z`。期限だけでは削除しない。

保存されたBookにはauth資源のIntentと予定名 `crdd-auth-74f2c8e01399d33f`、所有Label `crdd.coordinator.runtime=74f2c8e01399d33f` があり、実ID／Receipt／不存在証拠は未確定のままである。Toolの技術回収確認を、未確定Bookや上位終端の保存成功へ読み替えない。今回分を過去保持物と混ぜず、保持物への追加操作は行っていない。実E2Eは不合格であり、先行の非AI回帰成功から解消済みとは扱わない。

### 作成応答後からReceipt前の非AI切分け（2026-11-05）

対象は同じ基準Commit。実装変更ではなく、既存Sourceの読取りと有限技術境界による診断調査である。DIの実行前構成検査、Executorの診断投影、Domainの資源記録照合を確認した。実AI、Docker CLI、保持物の読取り・変更・清掃は行わず、過去記録については直前の確認結果だけを参照した。規範・公開契約・実行許可の変更はないため、今回の調査へ準拠監査や工程横断監査を追加しない。製品是正・独立レビューは未実施である。

- DIの作成経路は、create応答→内部SnapshotへID保持→onObserved→Container inspect→Identity照合→Image inspect→完全構成照合→Snapshot投影→onCreated通知、の順である。
- ExecutorのrecordIsolationFailureは、DIのobservation段階をcommand_waitへ投影し、元のreasonをdocker_process_controller_execution_failed_closedへ集約する。通常Errorはunclassified_exceptionとなる。従って今回の診断は、Receipt保存失敗そのものや認証期限切れを示さない。
- 既存の有限CLI／Process／Filesystem代役を使用し、本番DIの共通入口へ正常、inspect JSON不正、Identity不一致、Image未確認、構成不一致の五ケースを入力した。正常だけonCreatedが一回、他の四ケースは零回だった。異常四件はいずれもobservation段階・未分類例外となり、元reasonだけが異なる。全五件で模擬資源回収と残存零を確認した。これは実Dockerの正常性の証明ではない。
- 実際の停止原因が上記のどれであるかは、現在保存された診断から一意に復元できない。構成不一致やMount不一致と断定しない。原因候補の追加実測は行っていない。
- 終端保存の不成立は別途説明できる。通常create応答のIDは構成確認が完了するまで上位へ通知されず、途中失敗では保存BookのIDがnullのままになる。DomainのapplyCoordinatorResourceCleanupは保存IDと最終SnapshotのIDが違えばresource_receipt_requiredとして拒否する。技術回収成功をそのまま保存確定へ変換できない設計であり、この照合を緩めることは提案しない。

最小是正案は二段階とする。第一はExecutorの既存診断に、DIが既に返す固定reason・stageを失わず残すこと。自由文・生inspect・認証値・新しいLog基盤は不要で、DIの実装変更も不要である。第二は、作成応答から既知になったIDの通知と、実行前構成検査成功の通知を区別し、前者を既存onResourceIdentifiedで構成検査より前に耐久記録へ渡すこと。後者は既存onCreatedの意味を維持する。第二にはDIの通知順序の限定変更が必要になる理由があり、DI固定方針の例外として明示してから対応する。IDを通知しただけで構成検査済み・実行許可済みとは扱わず、必要通知の失敗で後続Effectを停止し、元IDを回収まで保持する。実装前に通知失敗・構成拒否・保存拒否の反例と利用側を確認する。

静的確認はDIのformat／typecheck／lintを終了値0で通過した（lint情報表示9件、Warning／Errorなし）。有限切分けは五件成功。製品コード、期限、安全条件、Image及び保持物は変更していない。AI再送・Docker再起動も未実施である。

### 作成Receiptの前倒しと元診断保持の限定是正（2026-11-05）

人間が上記二点の最小是正、利用側・試験・文書の追従、非AI回帰と独立レビューを承認した。変更分類は実装詳細と通知・診断契約の限定修正であり、DI固定方針の例外は通知位置の変更だけである。着手前に読取り専用確認者がDomainのreceipt／identifiedの違い、認証・Probeの利用側、完全ID確認、応答後取消、診断受入れを確認した。規範・準拠・保存Schemaを変更しないため、文書全体監査・準拠監査は追加せず、Sourceと結合試験の独立レビューを実施した。

実装では直前調査の候補を一部訂正した。onResourceIdentifiedは再発見とpresent観測を意味するため流用しない。既存onCreatedを、成功したcreate応答の完全64桁IDを内部Snapshotへ保持した後、取消判定及びobserveの前へ移した。通知を待ってから実体・Identity・Image・構成検査を行い、検査拒否又は取消なら後続実行へ進まない。ID不正は通知しない。通知拒否でも元IDを回収まで保持する。ExecutorのreceiptRecordedはReceipt通知が正常終了してから更新し、拒否を記録済みと扱わない。

PrimaryFailureDiagnosticへ任意のisolationFailureを追加し、DIの既存failure型を再利用した。元reason・stage・通知・kind・例外分類・要求／応答観測を保持し、従前の上位reasonとstageは維持する。既に保持した一次技術診断は後着失敗で上書きしない。検証ToolのexactなJSON受入れ、利用側の診断期待値、Architecture二文書を追従させた。公開関数・Root Export・Domain保存Schema・安全判定・Timeout・Imageは変更していない。

| 確認 | 最終結果と限界 |
| --- | --- |
| Executor npm test | 静的段階と113試験成功。実AI・実Dockerは実行しない |
| DI npm test | 静的段階と401試験成功、明示的対象外5件。通常権限でWindowsリンク作成がEPERMとなったため、許可された実行権限で再確認した。実Dockerは実行しない |
| 新規Receipt試験 | 正常、構成／Identity／Image／JSON拒否、同期通知例外、非同期Reject、応答後取消、不正IDの9ケース。完全IDの早期通知、後続run停止、元ID回収、Domain記録への接続を確認 |
| 実Executor→実DI→純粋Domain | 両Providerの構成拒否でReceipt保存済み、元診断保持、回収後Bookのabsence更新を確認。物理的な耐久保存・実Docker成立の証明ではない |
| Coordinator npm run check | Formatter、型検査、Lint、Runtime／Task設計トレースを通過。Lintの既存InfoはError・Warningとは区別 |
| Coordinator対象回帰 | docker-process-controllerと両Provider準備試験の153件中152成功・既存不合格1件。全体Passではない |
| 独立レビュー | 別確認者がSource・利用側・Domain・文書を再確認し今回範囲のMust-fix 0件。新Receipt試験と両Provider結合試験も独立実行して成功 |

残る既存不合格は `coordinator/tests/integration/docker-process-controller.contract.test.ts` の「作成境界の一次失敗を清掃結果から分離する」。清掃例外のケースでterminal.homeLeaseReleasedがtrue、期待値がfalseとなる。基準HEADのattempt.tsをGitから取得し、Filesystemを書き換えずメモリ上のModule代役として同じ試験へ接続した場合も同一箇所で再現した。今回の診断・通知位置変更による新しい回帰とは区別するが、既存不合格を安全成立へ読み替えない。OwnerはCoordinatorの同試験とExecutor試験用接続で、再評価契機は当該故障注入・Home終了観測の整合調査である。今回これを通すためのHome解放条件変更、期待falseのtrue化、試験除外は行っていない。この未解決項目があるため、Coordinator回帰全体の合格、Executor実E2Eの解消又はRelease可能とは主張しない。

今回二点の限定是正と独立レビューは完了した。AI再送、Docker起動／再起動／修復、Image更新、保持物の読取り・変更・削除は未実施。元E2E失敗の具体的な技術理由を新診断で取得する実試行は、今回の許可範囲では実施していない。

### 限定是正後のExecutor実E2E初回停止（2026-11-05）

人間がExecutor単独の実AI／実Docker E2Eを承認した。Codex／Claudeのadvice・edit・review・cancelを各一回、最大八件、最初の失敗又は不明で全件停止する条件。固定合成Prompt及び新品試験領域だけを対象とし、モデルはGPT-6.1 Sol／Opus 5.5、各Medium、既存固定Imageを使用する。事前に公開環境観測はbackend stopped／Engine ready／観測cleanup confirmedを返した。Engineの応答があるためDockerの起動・再起動・修復は行っていない。

実行対象はHEAD `a80829f4e5460f650025045d670163483a4825d4` と未コミットの限定是正を含む差分。開始時のgit diff --binaryのSHA-256は `20e30bc2f479d06ec423ffba76b82e319ca27f82b2ce721d7cb7f640aaf7e67b`。各試行の前に同じ差分を確認する構成とした。最初の試行 `EXEC-20261105082545-6fedf404-01`（Codex advice）が終了値2となり、残り七件を未開始のまま停止した。自動再送はない。

| 観測 | 結果 |
| --- | --- |
| 停止箇所 | create_subscription_auth_probe。create応答は終了0／stdout 65 bytes／stderr 0 bytes |
| 今回保持できた元診断 | isolationFailure.stage observation、reason docker_isolation_configuration_mismatch、notification null、kind command_failed、exceptionCode unclassified_exception |
| Receipt | receiptRecorded true。前回と異なり構成検査拒否より前に記録できた |
| 上位終端保存 | terminalSaved true。前回のID未搬送による保存未確定とは区別する |
| 技術終了と回収 | childCloseConfirmed／childCloseObserved、Process tree終了、Container／Network不存在、Home解放、Native終了のすべてをToolが確認。cleanupConfirmed／releaseConfirmed／nativeCleanupConfirmed true |
| AI開始 | providerProcessStartedObserved false。AI実行の開始は確認されていない |
| 試験Root | fixtureCleanupConfirmed false、retentionRecordConfirmed true。成功結果と内容確認を要求する既存cleanup条件により保持。強制削除・追加回復は実施しない |

今回Rootは `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261105082545-6fedf404-01`、元回復参照は `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.260f8332f48f95c24041e60078a36560c4c4394981309817b6bd520f3272f30b.746079786a94a9ea1fe18b18d05b57aa5a81cf1e6b4d4c15a634b8c8963d9010`。再評価時刻は `2026-11-12T08:25:56.761Z`。期限だけで削除しない。今回Rootの追加読取り・変更や過去保持物の操作はしていない。

今回二点の是正による元理由の搬送とReceipt／終端保存の改善は実境界でも観測できた。一方、E2Eは不合格である。完全構成検査のどの項目が不一致かは現行の固定理由では識別できず、Mount・User・Image等のいずれかと推定して確定しない。Docker再起動・Image更新・判定緩和・追加試行は行わず、必要なら次の非AI切分けで扱う。

### 構成照合項目の非AI調査（2026-11-05）

人間の調査継続指示に基づき、認証確認Containerの構成生成とDIの完全構成照合、有限CLIのinspect代役を確認した。製品Sourceは変更せず、Docker CLI・外部AI・保持物へアクセスしていない。外部参照は内部情報を含まない一般的なDocker bind mountの仕様照会だけに限定した。

照合対象はImage、User、TTY／stdin、RO root、非特権、Capability、SecurityOpt、Init、Entrypoint／Command／WorkingDir、環境、Network、Mount、Tmpfsである。Mount元はDocker inspectのSourceをWindows側のfs.realpathSync.nativeへ直接渡し、元Host Pathと比較している。[Dockerの公式bind mount資料](https://docs.docker.com/engine/storage/bind-mounts/)はDocker DesktopのLinux VMとHost Filesystemの橋渡しを説明しているため、HostとEngineのパス表現差は候補となる。ただし今回の実Source表現は観測されておらず、原因確定ではない。

既存の有限代役へ合成Mount一件を与えた七ケースを実行した。元構成とno-new-privileges:true表記は成功し、VM側Source表記、Propagation空値、Network空集合、CapDrop小文字、Image Env欠測はすべて同じdocker_isolation_configuration_mismatchとなった。七試験成功、模擬回収成功・残存零。これらは候補の識別不能を示す反例であり、実Dockerがどの表現を返したかの証拠ではない。元の実inspectは構成拒否前に公開・保存しておらず、過去試行の具体的な不一致fieldを現記録から復元することはできない。

次候補は、同じ固定Imageと隔離設定、認証値なしの空Homeを使う停止Container一件を新品Rootへ作り、起動せず、各照合項目の一致／不一致／観測不能だけを記録して今回分を回収する非AI比較である。任意Pathの正規化・チェック省略・判定緩和は提案しない。この追加Docker作成は失敗停止済みの八件E2E承認から推定せず、別途の限定承認を得てから実行する。

### 構成拒否理由の項目別搬送（2026-11-05）

人間が追加Docker試験より先に構成拒否理由を分離する方針を採用したため、上記Container比較は未承認・未実施のまま保留した。今回の変更分類はDIの既存構成検査における診断情報の限定是正であり、許可・採否・保存Schemaの変更ではない。Rootの公開IFを変えず、既存の検査条件・順序・Timeout・回収境界を保持する方針とSourceを着手前に照合した。Sourceの独立レビューと有限試験を選び、規範・準拠・保存Schemaに変更がないため文書全体監査・準拠監査を追加しない。

- 内部bool関数isolationResourceConfigurationMatchesをinspectIsolationResourceConfigurationへ置換した。一致はnull、拒否は最初の不一致又は観測不能項目の固定理由を返す。旧bool入口や互換Wrapperは残さない。
- Image、User、TTY、stdin、RO root、特権、Capability、Device、SecurityOpt、Init、Entrypoint、Command、WorkingDir、環境、Network、Mount、Tmpfsを区別する。Network資源はDriver／Scope／Internalを区別する。Mountは集合・対象・RO・Propagation・Sourceに分け、Source実体の確認不能と確認済み不一致を分ける。
- operations.tsは返された固定理由だけを既存failure.reasonへ載せる。ExecutorのisolationFailure.reasonまで同じ理由が届く。Rootの公開関数・型・Export、Domain保存Schema、通知型を追加しない。生inspect・Path・環境値・期待値／実値・例外本文を理由へ含めない。
- 既存の項目別負例・欠測・形状不正・観測例外、従来許可済み表記差及び複数不一致の先着順を試験し、両Providerの実Executor→DI→Domain接続の期待理由もroot_readonly_mismatchへ追従させた。Architectureへ同じ契約を反映した。

最終確認はDIのnpm testで静的段階と402試験成功、明示対象外5件、失敗0件。Executorのnpm testで静的段階と113試験成功、失敗0件。git diff --checkも通過した。別確認者が旧bool関数と新関数を実Sourceから抽出して641変異ケースで受理・拒否の差0を確認し、項目別理由試験も独立実行した。今回範囲の独立レビューMust-fixは0件である。これは有限入力における同等性の根拠であり、任意入力の完全証明や実Dockerでの原因特定ではない。

前述のCoordinator既存不合格1件は今回の診断変更の対象外であり、解消済みとはしない。実E2Eの構成不一致項目自体も未確定である。実AI、Docker操作、Image更新、保持物の読取り・変更・清掃は行っていない。次の実境界確認を実施する場合に、今回の項目別診断を利用できる状態までを完了とする。

### 項目別診断付き実E2Eの初回停止（2026-11-05）

人間のE2E継続許可により、同じ合成入力・固定Image・GPT-6.1 Sol／Opus 5.5各Mediumで、両Providerのadvice・edit・review・cancelを各一回、最大八件の範囲を再度実行した。最初の失敗で停止する条件は維持した。事前観測はbackend stopped／Engine ready／観測cleanup confirmedであり、Dockerの起動・再起動・修復は行っていない。実行対象はHEAD `a80829f4e5460f650025045d670163483a4825d4` と未コミットの項目別診断までの差分で、git diff --binaryのSHA-256は `8e8f260f5bafaf21a0bbbde921dbbf9ea6ad986ecdd9a5f9dba57c8a87deb29e`。各試行の直前にこの差分を確認する構成とした。

初回Codex advice `EXEC-20261105083654-7b6f9173-01` は終了値2。元DI診断はcreate_subscription_auth_probe／observation／docker_isolation_tmpfs_mismatchであり、Tmpfs照合で拒否されたことが初めて確認できた。生成要求上、この認証確認ContainerのtmpfsBytesはnullである。実inspectのTmpfs fieldが欠測、空値又は別値のどれだったかまでは記録しておらず、具体的な表現を推測で確定しない。先のMount元仮説は今回の停止項目ではなかった。create応答は終了0／stdout 65 bytes／stderr 0 bytes、Receipt記録はtrue、終端保存もtrueである。

AI Providerの開始は確認なし。残り七試行は未開始のまま停止し、自動再試行は行っていない。Toolは子close、Process tree終了、Container／Network不存在、Home解放、Native終了及び技術回収を確認した。一方、失敗結果は既存の試験Root清掃条件を満たさないため、fixtureCleanupConfirmed false／retentionRecordConfirmed trueで保持している。

今回Rootは `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261105083654-7b6f9173-01`、元回復参照は `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.f76149b13da385a881abb5337d1db0c9e42d63772e48c0e47e318aad6459b362.df39437efbf764a2460216f0dd3a5bdd306cd02adf36e4fbf6bb0e3afe0f37a1`。再評価時刻は `2026-11-12T08:37:05.694Z`。期限だけで削除しない。今回Rootの追加読取り・変更・強制削除、過去保持物の操作、Image更新は行っていない。E2Eは不合格であり、今回の範囲では製品是正や追加Docker試行へ進んでいない。

### Tmpfs未指定表現の原因調査（2026-11-05）

調査指示に基づき、製品変更・Docker操作・外部AI・保持物アクセスなしで、DIのTmpfs判定と試験代役を確認した。認証確認ContainerはtmpfsBytes:nullで、Compilerは--tmpfsを付けない。一方、inspect照合はHostConfig.Tmpfsがnull又は空Objectの場合だけ未指定と認め、fieldが省略された場合のundefinedを拒否する。

[Mobyの公式HostConfig定義](https://github.com/moby/moby/blob/master/api/types/container/hostconfig.go)ではTmpfs mapにJSONのomitemptyが付いている。従って、成功した完全なHostConfig観測における未設定Tmpfsのfield省略は、Docker APIが許す未設定表現であって、inspect全体の取得失敗とは異なる。DIがその表現を拒否する実装上の欠落を確認した。試験代役は未指定時に常にTmpfs:nullを返しており、実APIのfield省略を再現していなかった。

| 合成条件 | 現行DIの結果 |
| --- | --- |
| Tmpfs要求なし／field省略 | docker_isolation_tmpfs_mismatch（再現した欠落） |
| Tmpfs要求なし／null | 成功 |
| Tmpfs要求なし／空Object | 成功 |
| Tmpfs要求なし／予期しない設定あり | 拒否 |
| Tmpfs要求あり／一致設定 | 成功 |
| Tmpfs要求あり／field省略 | 拒否 |

六ケースを既存の有限CLI／FS代役と実DI共通入口で実行し、全件で期待した現行挙動と模擬回収・残存零を確認した。元実E2Eの生inspectは保持していないため、当時のTmpfs field自体を事後に確認した証拠とはしない。ただし実APIで正当な未設定表現とDIの拒否条件の不整合は、公式定義と独立の合成再現で特定できた。

最小是正候補は、取得済みHostConfigにおいてTmpfsを要求していない場合に限り、fieldの省略を未指定として認めること。Tmpfs要求ありの欠測拒否、予期しないTmpfsの拒否、Mount集合検査及びinspect全体の観測不能拒否は維持する。代役の省略表現と上記負例を固定試験へ追加する。今回の指示は原因調査のため、この製品是正とAI／Docker再試行は未実施である。

### Tmpfs未指定の省略表現への限定是正（2026-11-05）

人間の継続指示で最小是正を実施した。認証確認ContainerのTmpfs未指定は意図通りであり、tmpfsBytes:null、--tmpfsを付けない要求は変更していない。変更は、取得済みHostConfigについてTmpfs要求がない場合だけ、own fieldがなく値もundefinedである正当な省略表現を認める一条件の追加である。null／空Objectの従来受理は維持する。明示undefined、HostConfig全体の欠測、予期しないTmpfs、要求ありの省略・null・空設定は引き続き拒否する。

試験代役の未指定表現二箇所をTmpfs:null固定からfield省略へ追従させ、項目別試験へ省略／null／空Object／明示undefined／予期しない設定／要求あり欠測と完全一致を追加した。公開IF、Schema、Image、Timeout、実行設定、回収条件は変更しない。変更分類はDocker APIの未設定表現に対する限定適合修正として、Source・有限境界試験・Architectureを更新した。規範・準拠判断を変更しないため全体文書監査・準拠監査は追加しない。

最終結果はDIのnpm testで静的段階と402試験成功・明示対象外5件、Executorのnpm testで静的段階と113試験成功、失敗0件。独立レビューはMust-fix 0件で、別確認者が項目別試験及び両Provider結合試験の10件を独立実行して成功した。git diff --checkも通過した。Coordinatorの既存不合格一件及び実E2Eの未再確認は別途残す。今回、実AI・Docker操作・保持物アクセスは行っていない。

### Tmpfs是正後の実E2E・Proxy Command照合での停止（2026-11-05）

人間のE2E継続指示に従い、同じ固定合成入力、既存固定Image、GPT-6.1 Sol／Opus 5.5各Medium、各四用途一回・最大八件・最初の失敗で停止する条件で実行した。公開環境観測はbackend stopped／Engine ready／観測cleanup confirmedで、Dockerの起動・再起動・修復は行っていない。対象はHEAD `a80829f4e5460f650025045d670163483a4825d4` と未コミットのTmpfs是正までの差分、git diff --binaryのSHA-256は `efd0f2815fa4a8b0464f63b799ccc0bc4387cdb9fc7b517952e0d29e8af8d60f`。各試行前に同じ差分を確認する構成とした。

初回Codex advice `EXEC-20261105084332-0abec0e7-01` が終了値2で停止した。認証確認ContainerのTmpfs照合及び認証確認は通過し、次のcreate_proxyで元DI理由docker_isolation_command_mismatch、stage observationとなった。作成応答は終了0／stdout 65 bytes／stderr 0 bytes、receiptRecorded true。期待CommandとDocker観測Commandの具体的な差はこの理由だけでは確定しない。追加Docker観測や製品修正は行っていない。

ProviderのAI開始は確認なし、残り七件は未開始のまま停止した。childCloseConfirmed／childCloseObserved、cleanupConfirmed／releaseConfirmed／terminalSaved／nativeCleanupConfirmedはいずれもtrue、Container／Network不存在・Process tree終了も確認済み。fixtureCleanupConfirmed false、retentionRecordConfirmed trueで、失敗時の既存条件に従い今回試験Rootを保持している。

今回Rootは `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261105084332-0abec0e7-01`、元回復参照は `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.fe330d9be7373cf2551db00a73d0c1d2865c0eb25e6a648711c199e22ba3fe69.e0b3b8559f75a602548d61ba9584048fa7a052b15ca32944a6ef3b76d3510bb0`。再評価時刻は `2026-11-12T08:43:48.953Z`。期限だけでは削除しない。AI自動再試行、Image更新、Docker再起動、今回Rootの追加アクセス・強制削除、過去保持物の操作は未実施。Tmpfs是正の当該実境界通過と、E2E全体不合格を区別して記録する。

### Proxyの空Command表現の非AI調査（2026-11-05）

人間の調査指示に基づき、製品Source・Docker・保持物を変更せず、Proxy構成、Dockerfile、DIのCommand照合と有限代役を確認した。Proxyはargv:[]で、固定ImageのENTRYPOINT（PythonのProxy本体）を利用し、追加Command引数を渡さない。[Docker公式仕様](https://docs.docker.com/reference/dockerfile/#understand-how-cmd-and-entrypoint-interact)ではENTRYPOINT定義時に継承CMDが空へリセットされる。[OCI ImageConfig](https://github.com/opencontainers/image-spec/blob/main/specs-go/v1/config.go)のCmdはomitemptyであり省略され得る一方、[Moby Container Config](https://github.com/moby/moby/blob/master/api/types/container/config.go)のCmdは省略指定のない配列である。

DIは、要求argvが空の場合のImage既定CmdとContainer Config.CmdをJSON.stringifyの文字列表現でexact比較している。従って、同じ空Commandを表すImage側省略とContainer側null、又は空配列とnullが不一致になる。有限代役はImage.Cmdを[]、空argvのContainer.Cmdも[]に固定しており、API間の空表現差を再現していなかった。

八ケースの合成値で実DI共通入口を確認した。Image省略／Container null、Image []／Container null、Image省略／Container []はいずれも今回と同じdocker_isolation_command_mismatchを再現。null同士、空配列同士、指定済み非空Commandの完全一致は成功し、余剰Commandや非空既定値に対するnullは拒否した。八試験成功、模擬回収成功・残存零。元実試行の生inspectは保持していないため、当時の両fieldがどの空表現だったかは事後確定しない。確認した実装上の問題は、意味が同じ空Commandの正当な表現差をexact文字列比較で拒否することである。

最小是正候補は、要求argvが空でImageの既定Commandも空の場合だけ、APIが表す空値を意味的に一致させること。非空Commandの値・順序・余剰引数の拒否、Entrypointの照合、観測全体欠測の拒否は維持する。Image自体や起動設定を変えて通す必要はない。今回は調査指示であり、製品是正、Docker操作、AI再試行、保持物アクセスは行っていない。

### 空Command表現の限定是正と近接残件（2026-11-05）

人間の継続指示に従い、Image／起動設定を変えず、DIのCommand照合だけを是正した。要求argvが空でImage.Cmdが正当な空表現（field省略・null・空配列）の場合に限り、Container.Cmdのnull／空配列を同じ追加引数なしと扱う。Containerのfield欠測・明示undefined・不正型は空へ補完しない。非空Commandは文字列配列の全値・順序・長さを要求し、明示argvをImage既定値より優先する。Entrypoint照合、Timeout、通知、回収条件及び公開IFは維持する。旧判定を通すためのImage変更・追加引数は不要であり実施しない。

有限代役のImage.Cmdを空配列固定から省略へ、空argv時のContainer.Cmdをnullへ追従させた。固定試験に空表現の全組合せ、非空既定値、明示argv優先、引数順序・余剰・欠測・不正型の拒否を追加し、Architectureへ反映した。最終結果はDI npm testで静的段階と402件成功・明示対象外5件、Executor npm testで静的段階と113件成功、失敗0件。独立レビューはMust-fix 0件、別確認者が項目別試験及び両Provider結合試験10件を独立実行して成功した。git diff --checkも通過した。

近接するImage既定値の非AI確認で、Image.WorkingDirを省略しContainer.WorkingDirを空文字とした合成入力がdocker_isolation_workdir_mismatchになることを再現した。OCI ImageConfigのWorkingDirも省略可能であり、Image既定値未指定とContainer側の空文字を直接比較する同類の残件候補である。現実のProxy Imageの当該fieldは追加観測していないため、次の実E2E停止を予言・確定するものではない。OwnerはDIの同構成照合で、再評価契機は次回実E2E前の未設定WorkingDirの意味確認。今回の空Command修正へ無断で含めず、未変更として残す。今回、実AI・Docker操作・保持物アクセスは行っていない。

### WorkingDir未指定表現の限定是正（2026-11-05）

人間が上記残件の是正を承認したため、Image.WorkingDirがown field省略かつundefinedである場合だけ、空文字既定として扱う修正を実施した。要求で明示したworkingDirectoryはImage既定値より優先し、Container側は文字列かつ期待値との完全一致を要求する。Containerのfield欠測・null・undefined・不正型、Image既定値を利用する場合の明示undefined・null・不正型は拒否する。別パス・大小文字・末尾slashを同一視しない。実行要求、Image、Timeout、回収条件、公開IFは変更していない。

試験代役のImage.WorkingDir二箇所を空文字固定からfield省略へ追従させ、固定試験へ省略、Container欠測、不正なImage既定値、非空Image既定値、明示要求の優先及び厳密不一致を追加した。実行要求に許された既存の/workを明示Path試験へ使用し、許可Pathを拡張しない。Architectureにも同じ意味を反映した。

最終確認はDI npm testで静的段階と402件成功・明示対象外5件、Executor npm testで静的段階と113件成功、失敗0件。独立レビューはMust-fix 0件、別確認者が項目別及び両Provider結合の10試験を独立実行して成功した。git diff --checkも通過した。今回、実AI・Docker操作・保持物アクセスは未実施であり、実E2Eの再成立とCoordinatorの既存不合格一件の解消は主張しない。

### Executor単独・実AI／実Docker八項目成功（2026-11-05）

人間のE2E継続許可に基づき、WorkingDir是正までの固定候補を、既存のverify-provider-real.ts --runで実行した。対象HEADは `a80829f4e5460f650025045d670163483a4825d4`、未コミット差分を含むgit diff --binaryのSHA-256は `b50d8d908efe47168d55e4dfbb1e1982424af2fea46a16d77e5ddd2322407720`。各試行直前と八件終了後の同一差分を確認した。事前の公開環境観測はbackend stopped／Engine ready／観測cleanup confirmed。Docker起動・再起動・修復は不要であり実施していない。

CodexはGPT-6.1 Sol Medium、ClaudeはOpus 5.5 Medium。既存固定Image、合成Promptと新品source.txtだけを使用し、実Repository本文は送信しない。各用途一回・最大八件・最初の失敗又は不明で停止する条件を維持し、全八件が初回で成功した。試行IDの共通prefixは `EXEC-20261105085337-75dd6e58-`。

| suffix | Provider | 用途 | 一次結果 | 内容確認又は取消確認 | 終了値 | 結果bytes／SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Codex | advice | completed | contentConfirmed true | 0 | 694／dca8437666601bd09c5bf196210dcf523d716e6df4ced72dfa1e1fc273cbec57 |
| 02 | Codex | edit | completed | contentConfirmed true | 0 | 2049／ff28e82d1aa32f7c612324984bd20d1e190cf12bb9c31d784de601123896e153 |
| 03 | Codex | review | completed | contentConfirmed true | 0 | 805／69686cd3d60729a4ee1c90c19447820c607c4889363c3d6d31ba9386ca75b3ba |
| 04 | Codex | cancel | cancelled | cancellationConfirmed true | 0 | 0／null（取消で内容成功を要求しない） |
| 05 | Claude | advice | completed | contentConfirmed true | 0 | 2306／46869abff8ad07088cd6ef5bf2b88020f32707a640f91851ed7eb636e67a0fde |
| 06 | Claude | edit | completed | contentConfirmed true | 0 | 2082／4d90f81d853ae38c567995606329e8014ca8835c7d0f061d11b8d120c5779177 |
| 07 | Claude | review | completed | contentConfirmed true | 0 | 1785／8db4b90fd0fbce0bd669df1227f235734356295f838f995f99a51aed6e5215d6 |
| 08 | Claude | cancel | cancelled | cancellationConfirmed true | 0 | 0／null（取消で内容成功を要求しない） |

全八件でchildCloseConfirmed／childCloseObserved、cleanupConfirmed／releaseConfirmed／terminalSaved／nativeCleanupConfirmed／fixtureCleanupConfirmedはtrue、primaryFailureはnull、Provider開始・Process tree終了・Container／Network不存在も確認された。取消二件は単なる要求配送ではなく、一次結果cancelledとcancellationConfirmedを確認している。Toolの外側status completedは試験成功を意味し、取消一次結果を通常完了へ書き換えたものではない。

全件fixtureRoot null／reviewAfter null／retentionRecordConfirmed falseとなり、終了後に今回作成した正確な八Rootだけをlstatで再確認し、すべてENOENTだった。実ID・名前・Labelの不存在は各試行のDI技術回収で確認し、FilesystemのRoot不存在とは別に成立している。生Provider出力・認証情報は記録していない。過去の保持物の読取り・変更・清掃、Image更新、再試行は行っていない。

これにより、今回固定候補におけるExecutor単独の二Provider×四用途の実境界確認は成功した。Tmpfs、Proxy Command及びWorkingDirの過去停止点も通過した。Coordinator／Workbench／MCPとの上位E2E、既存Coordinator不合格一件、過去保持物の解決又はリリース全体の合格をこの八件から推定しない。
