# CROS Workbench詳細設計

## CRDD Server共通操作への接続

既存HTTP入口は起動形態を維持し、非秘密配置設定と許可集合からのTopic／Meeting操作構成を[CRDD Serverの標準入口](../../Definitions/ARCH-000012/architecture_definition.md#crdd-server共通入口の公開契約)へ委譲する。Workbenchのフォーム・資格検査、保存後の公開前確認、画面応答はHTTP側に残す。共通実装からWorkbenchやMCPの起動コードへ逆依存しない。

<a id="server-git-lifecycle"></a>

### CRDD ServerのGit利用と処置の所有

<a id="host-admin-cli"></a>

#### 管理者の初回設定・再紐付け

Serverの公開CLIは `--initialize` で初回管理者を設定し、`--link-admin` で既存管理者を再紐付けする。どちらも通常起動と排他的で、Hostの対話と本人確認用の一時ループバックだけを使い、Workbench・MCPは起動しない。共有Workbenchと同じOIDCクライアントで外部主体を検証するが、ブラウザーのセッションは発行しない。確認候補を得たら一時待受を閉じ、同じ端末で確認を完了した場合だけ、検証済みの `issuer` と `subject` をアクセス管理の正式操作へ渡す。中断や確認不能時は保存を開始しない。保存先と保存確定の判断はアクセス管理に残す。

外部本人確認の通信、ブラウザーとの相関、一回消費は `transport/login.ts` に共通化する。提供元プロファイルは発見先、設定の読取り、発行者と必要に応じたテナントの制限、確認済みメールの取得、アカウント選択の指定を所有する。OIDC検証とプロファイル両方を通過したトークンの発行者・主体を返し、メールで本人を結び付けない。共有起動では `CRDD_LOGIN_PROVIDERS` の明示設定を必須とし、提供元を暗黙に選ばない。有効化した提供元のIDと表示名だけをWorkbenchとMCP同意画面へ渡し、どちらも同じ提供元のログイン処理へ接続する。設定や資格を画面へ渡さない。v0.22の実提供元はGoogleだけとする。

ブラウザーのログインは `POST /api/session/login/:provider`、招待は同じ入口の `/invitation`、応答は `GET /api/session/login/:provider/callback` を使う。提供元が異なればログイン途中の状態とブラウザー照合Cookieの送信先も別になる。未設定の提供元を別の提供元で代替しない。Host端末での管理者設定の一時応答は `/api/session/host-admin/callback` に分ける。

追加候補の仕様照合（実接続・採用は対象外）:

- [Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc): 組織と個人アカウントで利用可能なテナント入口が異なる。複数テナントでは発見文書のテンプレートを固定の発行者として扱わず、実テナントと発行者を照合した上で検証済みの発行者を保存する。[IDトークンのメール属性](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)だけで招待を引き受けられるとはみなさない。テナント検証と、招待時に信頼できるメール確認の取得方法は追加時の検証条件とする。
- [Yahoo! JAPAN ID連携](https://developer.yahoo.co.jp/yconnect/v2/userinfo.html): メール確認情報がUserInfoにある。招待時にUserInfoを使うなら、検証済みIDトークンと主体が一致し、そのメール種別について提供元の確認が招待条件を満たす場合に限る。現在のIDトークンからの同期抽出だけで対応済みとはみなさない。

#### 共有Serverのプロセス所有

共有Serverは、アクセス管理の同じ保存領域につき一つのプロセスだけを起動する。短期の状態保存ロックとは別に、確定済みの保存領域で `shared-server.lock` を取得してから共有OAuthを組み立て、待受を開始する。ブラウザーセッション、OAuth状態、Gitホスト連携と実行の即時失効通知はそのプロセスが所有する。待受ポートを替えても同じ保存領域を並行使用しない。単体モードにはこのロックを課さない。

アクセス管理は、発行済みの保存領域から正規ディレクトリを返すだけとする。共有Serverの排他は、Serverが共通ロックを直接使って取得・保持・解放する。アクセス管理の短期保存ロックは引き続きアクセス管理が所有する。

正常停止は待受を閉じ、受付済みの処理と所有資源の終了を確認してからロックを解放する。占有されている場合、実体を照合できない場合、または終了を確認できずロックが残った場合は、次の共有Serverを起動しない。PIDや経過時間だけを根拠に自動回収しない。

#### 共有モードのGitホスト連携

ログイン済みの画面は `GET /api/session/git` から有効な連携先のID・ホスト名・表示名・現在のセッションでの連携有無だけを取得する。未ログイン時には一覧を返さず、ログイン済みでもアクセストークンや内部の連携参照は返さない。

- CRDDへのログインは本人確認、Gitホストへの連携は外部リポジトリの操作に使う。GitホストのアカウントだけでCRDDにログインしたり、利用者や管理者を作成したりしない。
- CLIとライブラリの共有起動はGoogleログイン、共有MCP OAuth、有効なGitホストを必須にする。管理側は共有起動環境の `CRDD_GIT_HOSTS` でホスト・提供元と資格の環境変数名を選ぶ。v0.22の対応は `github.com`／`github` の組だけとする。未設定・空の一覧・未対応ホスト・有効ホストの資格欠測は起動前に拒否する。変更は再起動で反映し、以前のプロセスのセッションは引き継がない。単体起動はこの設定を使わない。
- Gitホストの実装は提供元の種類で引き、起動時に設定したホストと `apiBase` に操作を結び付ける。資格欄 `providerData` の読取り・検査は選択された提供元が担当し、共通側は資格の種類を知らない。共有HTTPとMCPは同じ設定済みホストを使い、設定と保存済み参照の提供元またはホストが異なる場合は資格を送信しない。
- HTTPは `/api/session/git/:hostConnectionId` で設定済みのホストを選ぶ。既定ホストの識別子は提供元名（v0.22では `github`）、他のホストは `提供元.ホスト名` とし、同じ提供元でも衝突しない。`github.com` ではGitHub Appに同一Originの `/api/session/git/github/callback` を登録する。トークンはホストごとの連携領域に置き、画面・MCPクライアント・Coordinatorに返さない。明示解除はそのホストの本人連携だけに作用する。
- リポジトリ登録と内容公開を分ける。対応ホストを有効にした共有起動では、登録を短命の管理セッションを持つ `manager` または `administrator` に限る。Serverはローカル設定に明示された単一HTTPS `origin` を読み、起動時に設定した同じホスト用の本人資格だけで安定した対象IDを確認する。別ホストには資格を送らない。設定された接続先の照合であって、ローカルで変更された内容の由来や安全性の証明ではない。外部照会はアクセス管理の保存ロック外、保存直前のRole・改訂・ディレクトリ・接続先の再照合は既存Writerで行う。アクセス管理にGit履歴・実行能力・資格を渡さない。
- 共有の内容操作は、CRDDで確認した本人と登録済みリポジトリを、Gitホストの現在の実効権限へ結び付ける。CRDDのロール別内容範囲や公開範囲では判定しない。AMは本文を読まずに現在の本人と連携登録の識別子を照合し、Serverは本人の実効権限を確認してから同じ登録・ディレクトリ・接続先を再確認する。Project、Topic、Meetingと実行の内容操作はHTTP／MCPからこの認可を使用する。未登録、非連携、別の実体、確認不能では旧認可やホスト自身の資格へ戻らない。

ログイン提供元の許可と有効なGitホストの指定は別の管理者設定とする。CRDDは事前登録した利用者のみを受け付け、自己登録や自動作成は提供しない。Gitホスト側のアカウントも作成せず、組織のアカウント発行と命名に委ねる。利用者が連携するのは、有効なホスト上の既存アカウントだけとする。

新しい提供元の追加に備えて共通化するのは次の境界とする。検証済みログイン主体は発行元とその主体IDの組でCRDDユーザーに対応付け、メールアドレスの一致では結合しない。Gitホストは提供元・ホスト・安定リポジトリIDを使い、現在の利用者が読み取り・書き込みできるかを観測する。認証の往復・トークン交換・外部権限照会だけを提供元固有の接続側に置く。提供元によらずCRDDの利用者登録・セッション・ロール・現在認可の正本を共有し、MCPクライアント用トークンもGitホスト資格として取り扱わない。

- [GitLab](https://docs.gitlab.com/api/project_members/) はホストとProject IDを識別に使える。上位グループの継承を含む照会はあるが、照会資格から見えない招待元や、自前運用の版・構成差がある。所属が見えないだけで権限なしとせず、本人の実効権限として解釈できる範囲を実接続時に確認する。
- [Bitbucket Cloud](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/) は利用者・リポジトリのUUIDを返す。一方、[資格の種類によって権限の照会に制限がある](https://developer.atlassian.com/cloud/bitbucket/rest/)。本人資格なしの監視を安全に実施できると確認するまでは監視非対応とする。Data Centerは別の提供元として扱う。

CRDD Serverのサービスが対象と許可、変更の発行時点を決める。HTTP・MCP・UIはコマンドを組み立てず、失敗時に自動再送しない。Git操作の成立条件は[VCの共通ライフサイクル](../version-control/01_Architecture.md#vc-usage-lifecycle)を参照する。

共有Objectiveの開始・再開は、Gitホスト連携を通した実行先と現在認可を確定できない場合、Coordinatorの子プロセスを起動せず拒否する。CRDDにログイン済みでも、旧資格やリポジトリ登録だけでは代替しない。単体実行先の選択はこの制約の対象外とする。

起動環境の検査と取込み後の削除は `cli/environment.ts` が所有する。ブラウザー受付は提供元固有の実装を参照せず、`service/git-host.ts` が所有する開始・取消・完了の契約を使う。Gitホスト側で観測した権限は、アクセス管理が確認するCRDD内の現在認可に代わらない。公開する操作・URL・支援するホストの集合はこの分割で変更しない。

```text
現在の接続資格・Repository認可
  ├─ Taskを実行する
  │    → EMのProject／Queue／Workspaceと保存配置を確認
  │    → 実行候補だけ渡す → CoordinatorがLease内で実体を確認
  ├─ 作成・廃棄・固定・採用・候補終了
  │    → 現在状態と期待値を確認 → 既存排他と処置意図
  │    → VCで処置・読戻し → EMへ結果を保存
  └─ Repositoryを明示操作する
       → Stage／Unstage／Commit／Pushの一操作をVCへ委譲
       → 技術結果を返す（成功とは別に観測不能・発行済みを保持）

表示だけ → 認可済み対象を観測 → Tree・選択差分を返す
改名だけ → Rootと権限を確認 → EMへ名称を保存
```

- `service/workspace.ts` は作業領域の選択・寿命を所有する。実行候補の引渡しにGit確認を重ねず、作成時も了承されていない未コミット変更は引き継がない。部分処置は同じ対象へ再入場する。
- `service/repository.ts` は明示操作を配送する。共有WorkbenchからのコミットとPushはv0.22では提供しない。本人のGitホスト資格による共有Pushは次版の検討候補とする。単体接続は送信先・Refの明示確認を要求し、VCが現在HEADを照合する。ローカルのGit利用者設定は共有接続の本人認証に使わない。
- Treeと選択ファイルの差分を同時に返す画面要求では、`readTree` と `readFileDiff` が共に通常ファイル一覧を読む。同じ要求・観測時点の一覧だけが再利用候補。別要求への持ち越し、ファイル内容の前後確認の省略、採用・廃棄・Push後の読戻しの省略はしない。

<a id="workbench-ui-http-contract"></a>

### ブラウザとHTTPの接続

`workbench-ui` は同一Originへ明示操作を送り、接続資格の変更後に旧応答を採用しない。通信取消や失敗によって保存操作を自動再送しない。表示と画面内の要求管理はUI、認証・認可と保存操作の受付は `crdd-server` が所有する。WorkbenchのReact依存は、HTTPサーバーの実行時依存ではない。

両パッケージの依存を導入し、`npm --prefix 40_Develop/workbench-ui run build` で生成するBundleを `npm --prefix 40_Develop/crdd-server start` から配信する。後者は起動前にもUIをビルドする。既存の起動引数、URL、資格の取扱いは変更しない。

## 検証HTTPの時刻と終了確認

検証Toolの`completedAt`は子Process、`closedAt`は親がclose待機後に採取する壁時計である。表示値は補正せず保持し、親子の数値の大小を処理順序の保証に使わない。利用先は計測snapshot／summaryであり、Taskの成功・Recovery・Cleanupを判定しない。固定Schemaと正整数検査、子Process内の既存時刻相関は維持する。

終了確認の正本は、既存HTTP子の結果frameと実`close`の共同確認である。[Node.js 24.19の契約](https://nodejs.org/download/release/v24.19.0/docs/api/child_process.html#event-close)に従い、frame到達だけで返却せず、Processと標準入出力の終了後の通知を待つ。親子の共通時計・補正値・新fieldは追加しない。検証ではframe到達済みのclose遅延、親時計の逆転、重複closeを与え、close前の返却・計測通知0、close後の各一回と元値保持を外側から照合する。

## 検証Toolの開発Source観測接続

Server経由のTask・Workspaceの開発検証は、[Coordinatorの固定ソース範囲](../coordinator/01_Architecture.md)にServer自身を加え、`crdd-server/development-source-snapshot/v1` で内容・実体を前後照合する。追加範囲を指定するのはServer側の検証だけであり、Coordinator単体の計測・試験はServerを必要としない。異なる版の照合値を使い回さず、過去の記録を変更しない。入口の実CLI拒否や合成ソースによる検証を、実AI・Dockerの成功には換算しない。

## 単発依頼IDの搬送と結果欠測

AI依頼Formは依頼IDを画面内に一度保持し、通常POST／共有接続の両方でCoordinatorへそのまま渡す。再送でIDを変更せず、新しい依頼への明示切替だけ新IDを発行する。ServerはIDを補完・生成しない。再構成後は保存された元IDの状態を表示し、`resultAvailable: false`では空の正常回答を表示せず、本文は取得できない旨を示す。状態の再取得とAIへの再送は区別し、取消・認可の既存境界を維持する。

## AMとモデルの接続試験Owner — 2026-11-14

既存runtime-definition ITはAMの実認可結果をEMの初期化・Plan保存・再読取りへ直接渡し、同じ値の双方向の型適合も確認する。既存management ITはAM許可集合からDM実本文を読み、本文版を中立SourceとPortfolioへ保持する。両試験は元の実AM・モデルWriter／Readerと清掃を維持し、認可結果の変換Wrapperを追加しない。AM単独の権限・失効・Manifest差の拒否試験とは分けて所有する。

## 活動ReaderのSource接続検査 — 2026-11-14

既存のai-shared-task ITは、共有Task Ownerの開始・観測・取消に加えて、Workbench活動ReaderがCoordinator公開Rootへ直接接続するSource検査を所有する。PRL-IT-012の既存義務から移管し、対象Sourceと一致条件を変更しない。この読取りだけの確認は実HTTP・認可・取消・Reader終了の検証と区別する。

<a id="summary-observation-owner"></a>

## 診断表示用の説明文観測の所有 — 2026-11-14

`tests/support/task-summary-observation.ts`は合成診断だけのModule観測であり、製品公開APIではない。専用新品Node Processでconsumer import前に元normalizerを包み、同じ引数・同じreturn object／例外を維持する。最初のCodex executorのsummary候補一件だけをメモリで保持し、外側の単一Task終了・段階順序・資源回収結果を照合後、人間承認した端末へ一回表示する。元関数にはTask／Attempt IDがないため、観測seam単独のexact identity証明とはしない。表示前の制御文字・Path・認識済みSecret検査の不成立は非表示へ閉じ、元結果と採否・回収を変更しない。本文はLog／File／APIに保存せず、端末scrollback残存は人間の限定受容を必要とする。復元はmock解除だけでなく専用Process終了まで確認する。計測付きの結果を通常Source無計測E2E成立へ算入しない。

唯一の外部利用側verify-workspace-summaryと同じWorkbenchのscriptsが観測処理を所有する。元の二試験もtests/integrationへ移管し、全assert・故障シナリオ・専用子の終了を維持する。機密検査は入口がCoの既存検査を注入し、観測Helper自体はCoを読み込まない。Executorの有限技術Consumer／fixtureは明示的な下位参照として利用する。旧入口の転送や新しい共通fixture、製品公開は追加しない。

表示前には結果記録成功と試験物の処置結果の相関も確認する。Task・実行資源の回収と試験フォルダの物理削除は区別し、既存Gateが故障証拠を保持する場合も、その保持判断を変更しない。

## 3モデル分離への接続 — 2026-11-12

Workbenchはdocument-model／execution-model／configuration-modelの公開操作を必要な役割で別々に利用し、画面用の結合は自身が行う。AM RootはAM型を直接搬送する。文書読取りの期待値はManifestから3Identityへ投影し、保持設定を通常Queryの常時ガードにしない。共通JSON／Snapshot／汎用Root Helperを旧DMから取得せず、既存の入力・保存Ownerへ必要分を局所化する。

移管後の限定回帰・独立確認は実施中であり、全体回帰・実AI・Docker・過去保持物の操作を今回の確認へ含めない。保存Schema・Path・Lock・既存の公開失敗情報を変更したとは扱わない。

## AI編集検証とHTTP検証の分離 — 2026-10-30

実AI編集ToolのTask完了待機とWorkspace操作を既存Coordinator Package APIへ直結し、Workbench Server起動・画面全体GET・定期HTTP照会を外す。実行終了後はDomain正本の同Request状態と照合する。画面情報の取得失敗を実AIの実行失敗へ読み替えない。HTTP受付・表示・取消の非AI結合試験は維持し、Browser向けHTTPや製品UIの契約は変更しない。一時回答本文は元Ownerが所有し、Domainへ追加永続化しない。実AI E2Eの結果をWorkbench HTTPの成立根拠に使わず、既知の受信前待機・event loop停止は独立した未解決故障として保持する。

## 検証HTTPの受信前待機の観測 — 2026-10-29

検証専用Clientは一要求の`requestCreatedAt`と`headersSendingAt`を既存時刻へ加える。[Undiciの診断契約](https://undici.nodejs.org/api/DiagnosticsChannel)に従い、前者は要求object生成、後者はsocketへの最初のbyte書込み直前であり、送達・Server受理の証明ではない。同じrequest objectだけを相関に用い、本文・Header・socket・URLを診断結果へ複製しない。欠測を0へ補完せずnullで保持し、専用Processの終了と購読解除を維持する。

Serverを所有する検証Processは、100msの短命Timerで最も大きい一回の遅延区間`expectedAt/observedAt/delayMs`だけを保持する。これはevent loopの処理機会が遅れた観測であり、同期I/O・CPU・OSスケジューリング等の原因判定ではない。時刻未採取はnull、観測終了でTimerを解除し、製品Serverへ常駐監視を追加しない。Client送出直前・Server受信・Owner処理・応答と区間を照合し、最悪Timer区間が一致しないだけで他の停止不存在を推定しない。HTTP15秒／Workspace60秒、取消・元結果・資源回収は変更しない。

## Core定義の直接操作と任意Automation — 2026-10-28

`/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}` 配下で、計画・Objective・TaskをGETし、初期化は`POST …/definition`、計画保存は`PUT …/plan`、ObjectiveとTaskの作成・更新・削除は`POST`・`PATCH`・`DELETE`を使う。変更は同一オリジンのJSONで受け付ける。IDと操作はURLとメソッドが決め、本文で上書きさせない。任意の`queueId`はTask一覧だけに指定でき、所属と投影は実行モデルが決める。単体は起動先と同じリポジトリとプロジェクトに限る。共有は本人のGitホスト実効権限を読み取り・書き込み別に照合し、GitHubではAppの権限も確認する。旧フォームを受け付けず、保存や公開の成否が不明なときは自動再送しない。

閉入力、全体CAS・対象Hash、Domainの保存結果・unknown・exact参照を保持し、競合の再送、AI実行、判断承認、Queue投入、文書計画の同期は行わない。Form受信上限は保存容量と分離し、従来と同じ48MiB＋16KiBをHTTP入口のローカル定数で維持する。内部Stateの固定容量上限撤去からHTTP受信の無制限化を推定しない。計画編集用の新UIは追加せず、公開HTTP操作の接続を扱う。

公開APIと通常起動はCoordinator／Executorの読込み・Task Session保存を要求しない。製品CLIは認可された明示開始・照会・取消で既存Task Sessionを開き、待機後に取消・現在認可とRepository／主体を確認する。再起動後も既知の依頼IDは既存保存の照会・取消へ接続する。`--docs` のWorkbenchではAI実行を構成しない。Workspace実行・活動照会・実効通信設定は、要求時だけ固定Ownerへ接続する。

## Core API接続の目標 — 2026-10-27

[Domain API入出力](../execution-model/05_Runtime_Domain.md#runtime-domain-api)へServerが直接接続する。Coreの設定・定義・状態表示にCoordinator・MCP・Provider認証を要求せず、現在認可と対象改訂をServerで再確認する。BrowserへRoot能力・生Controller・Host Pathを渡さない。既存助言・Workspace編集は無断撤去せず、任意実行の構成へ分離する。2026-10-27時点ではCore独立の本番接続・Browser検証は未実施だった。現在のHTTP接続と限定確認は上節を参照し、新しい計画編集UIは追加しない。Executor分離・Coordinator任意化・実AI境界は未完了である。

## 検証HTTP子Processの失敗診断

合成編集の検証Toolは、確認済みRepository-local tests内に標準`mkdtempSync`で新品Rootを確保し、固定日付Root・保持済み試験物へ再入場しない。作成後のRoot検査・子Directory作成が不成立の場合も、exact Rootと固定理由をconsole結果へ残し、未確認Rootには書込み・削除を行わない。`--preflight`はAI受付分岐へ入らず、合成編集・公開Workspace操作・実保存・Git統合と回収だけを確認する。新しい管理State・Registry・実行Ownerは追加しない。

検証HTTP子への入力はstdinのEOF待ちを使わず、Node標準IPCで一つのJSON文字列だけを送る。子は一件受領後にIPCを切断してから検査・HTTPへ進み、型不正・parse拒否・HTTP失敗でも通信路を残さない。親の256KiB事前検査と子のUTF-8容量再検査、曖昧JSON・閉じたshape・loopback／固定route検査は維持する。親のstdioはstdin ignore・stdout/stderr pipe・ipcを明示し、send例外／callback失敗／channel欠測・送信前切断は既存pipe故障へ接続する。send falseはbackpressureとして再送せず既存監視で待つ。送信後のdisconnect自体を入力受理又はHTTP成功の証明にせず、従来のframeと実closeを共同確認する。Token／Formはargv・env・File・logへ移さず、追加のRuntime子・Worker・Queueを作らない。未到達・子早期終了・取消も既存の有限監視と元子一回の終了要求で扱う。

読取り検証Toolの`httpTiming`は、固定段階（initial／start／observe／cancel／close）とClient／Server／Ownerそれぞれの観測番号、要求開始・headers受信・本文完了・親close処理、Server受信・finish、Owner.observe開始・終了の時刻だけを保持する。512件での収集切詰めとlimit／dropped fieldを撤去し、観測例外だけをobservationFailuresへ計上する。本文・Token・生URLは保持しない。ClientとServerの番号は独立した相関候補で、同一IDの証明ではない。時刻・固定経路・段階と欠測を併せて評価し、未完了・相関候補複数から正常を補完しない。診断購読は対象listenerのloopback portと固定経路に限定し、Client終了後、Server／Task Ownerの終了待ちより先に解除する。snapshotは取得時点であり、解除前に開始したOwner観測の終了時計は後で確定し得る。製品HTTP・Task Lifecycle・期限・認可を変更しない。

編集検証Toolも同じ三境界時計を再利用する。Owner.observe wrapper・Client callback・Server bind・固定段階・購読解除を一組で接続し、最後に既存evidenceの`httpTiming`へ投影する。Workspace操作の時計は従来の別投影を維持し、Task観測と混同しない。欠測・相関候補複数を単一の停止区間へ補完せず、計測の成功を実AI編集又は全体QAの成立へ拡張しない。

検証ToolだけのHTTP子Processは、既存の拒否理由に任意の`clientProcess`診断を添える。値は最初の故障段階、終了値、固定Signal分類、stderrバイト数、終了要求の有無だけとし、生出力・自由な例外文・Tokenは含めない。起動・pipe・出力上限・警告・監視期限の最初の故障は後続通知で上書きしない。Process終了後のframe／失敗frame／応答frameの拒否は別段階にする。

警告だけでも拒否する現行条件、同IDの取消と回復参照は維持する。検証ツールが認める作業領域リソース（`/api/repositories/{repositoryId}/workspaces` と対象・検査・候補差分）のGETはHTTP上限60秒・親の子Process監視65秒とする。リポジトリ別のAI依頼開始・取消 と、AI状態観測を含むWorkbench viewの `/api/workbench/view?route=%2F` はHTTP15秒・親20秒を維持する。子の終了確認2秒は共通で、任意の期限を受け取る公開入力は追加しない。60秒は有限の待機上限であり、あらゆるRepositoryの成功や性能を保証しない。終了要求を終了確認やTask取消成功と同一視せず、Taskの一次結果とHTTP故障を分離する。正常な通信失敗frameの子側診断はそのまま保ち、親Process故障の診断を通信原因へ置換しない。

### Repository別AI選択設定への接続候補 — 2026-10-24

技術対応のCatalogはAI Adapter、五役割の既定値・作業分類・分類別上書きとその保存はCoordinatorが所有する。Workbenchは選択Repositoryの `.crdd/config/ai-selection.json` を同じ公開Owner APIで読み、Host Catalogや旧Profileへfallbackしない。不在は未設定、観測不能はblockedとして表示し、初期Modelを自動作成しない。同梱Catalogの対応宣言から認証・Quota・実行許可を推定しない。

AI選定は `/api/repositories/{repositoryId}/ai-selection` をGETで照会し、PUTで保存する。PUTは同一Origin・操作トークン付きの閉じたJSONで、対象はURL、操作トークンはヘッダー、本文は期待値と設定だけを受け付ける。単体は起動時に確認したリポジトリIDと実行先だけを使う。共有ではマネージャー／管理者の設定管理権限に加え、登録済みの対象への本人の実効権限を要求する。照会には読み取り権限、保存には書き込み権限が必要である。ブラウザーからの保存には、同じ本人の有効な短命管理セッションも必要とする。共有画面は閲覧と編集を分け、必要な書込み権限と管理セッションが揃う場合だけ編集操作を表示する。現在設定の再取得は通常セッションで同一Originへ送信する。待機後・保存処置前後・公開前に既存の対象照合、現在許可と取消を維持する。パスや資格を本文で受け付けず、アクセス管理の保存ロックを設定保存へ持ち越さない。

共有のAI選定では、読み取り・保存ともに旧接続鍵を受け付けない。有効なブラウザーセッションに `Authorization` ヘッダーを併記した要求も拒否し、旧認可経路には移らない。

有効な設定入力と現在認可を確認した後、ServerがGit除外登録と設定領域の準備を行う。除外結果を確認できない場合は設定を保存せず、現在認可を確認できる応答に限り、元の回復参照と未確認区分を保持する。構成モデルへ渡すのは確認済みの絶対ディレクトリと保存要求であり、Gitの識別値は渡さない。

HTTPとMCPは、AMの認可結果から取得したディレクトリを文書・設定の読取りに渡す。Gitを使う処置と、既存の実行モデルがGit入力を必要とする操作は、対象を選んだ後にServerがGit配置を確認する。許可集合を得たことをGit操作の成立や公開の保証とはみなさない。

保存は閉Form、同Origin、Action Token、用途限定のBody上限（AI設定はUTF-8 1MiBの最大percent encodingと固定Envelope、他操作は16KiB）と期待内容IdentityによるCASを用いる。既存の通常保存・読戻し・短期Lockを利用し、新Registryや永続状態を追加しない。saved／conflict／blocked／unknownを区別し、保存後の失効・切断・応答喪失を未保存やrollbackに変換しない。明示再取得はGETだけで、自動再送しない。Browserは同じRepository・Tokenの画面世代だけへ応答を反映し、既知保存結果は後続取得失敗でも保持する。画面は五役割のProvider／Model／Effort選択、分類の追加・表示名変更・削除と分類別上書きの編集・削除を持つ。JSON欄は詳細入力として併置し、同じ一つのdraftだけを編集する。未設定時は人間が明示的に編集開始し、Modelを自動補完しない。入力部品の候補表示は技術Catalogから得るが、正式照合はCoordinatorが行う。同一対象の通常更新でdraft・保留要求を初期化せず、対象変更／unmount時だけ既存取消を行う。

AI依頼は旧Profile IDでなく作業分類と任意の明示Provider／Model／Effortを受け取る。選定はCoordinatorが受付時に固定し、Workbenchは表示用の選択からAuthorityを発行しない。通信先・確認Hashは当該選定のProviderへ結合し、助言／編集の変更でも確認欄を再生成する。Task開始だけではCommit・採用・再送をしない。設定画面はRepository選択後だけへ置き、未選択のAccess画面からHost Catalogを管理する入口は廃止する。

実装候補の通常検証とBrowser検証は別Gateである。旧Profile管理の実測は新方式の完成根拠へ流用しない。実AI・実認証・人間の操作確認・本体設定移行は最後に別途扱い、保持中②は対象外とする。


### Repository通信条件の表示・開始時照合（確認中）

単体接続では検証済みRoot、共有接続では現在認可した選択RepositoryのRootから、非秘密の通信条件を要求ごとに取得する。固定選定のProviderに対応した実効Host・443 CONNECT・本文非検査の限界を表示し、その設定Hashを開始要求へ含める。ClientのHost一覧を許可集合として採用せず、助言・編集とも専門Ownerが現在設定と照合して同じ不変値を実行へ渡す。旧booleanだけ・不正Hash・古い画面・別ProviderのHashは開始拒否となる。ログイン用途へ追加Hostを搬送しない。

表示JSONはAuthorityを持たず、通信不能・取消・失効を成功や旧内容の再利用へ変換しない。Repository／主体／設定の切替時は古い選択・確認を残さない。追加のSession・Registry・承認台帳を設けず、既存の受付・取消・結果搬送を利用する。新Proxy Imageの実通信確認前に、表示成功を実強制や全E2Eの成立として扱わない。

### Framework移行の採用境界 — 2026-10-20

Workbenchは `workbench-ui/src` と `crdd-server` に分け、Expressルートと操作別受付を `src/transport/api-server.ts`、HTTP共通処理を `src/transport/api-http.ts`、表示・リポジトリ・管理の通信契約を各責務フォルダに置く。React＋ViteのCSRを唯一の画面Rendering方式として維持し、ServerのHTTP RoutingをExpress 5、ClientのNavigationをReact Router、Serverデータ取得をTanStack Queryへ移す。Domain・認証認可・実行状態・Git操作の正本は既存専門Packageに維持し、WorkbenchからMCPへ依存しない。UX／IA・Visual再設計はこの移行へ含めない。

Repository別AI設定を単体接続で保存する場合、受付で確定した対象と書込み用に確認したRepositoryの正規パスを完全一致で照合する。構成モデルが要求する保存中の再認可と応答前には、書込み用Repositoryの配置をその時点で一度ずつ観測し、受付時の対象と照合する。共有接続では、設定管理権限および選択Repositoryへの現在認可と、Git操作先の現在配置を別々に確認する。異なる段階への観測結果の持ち越しは行わない。

Frameworkの既定動作を既存保証の代替と推定しない。HTTPの大小文字・末尾slash・HEAD・未知Method、raw Header・Host／Origin、Bodyの形式・容量・圧縮、固定拒否・静的配信、取消・要求join・Owner closeを基準契約へ照合する。認証前のBody読取りや静的fallbackを追加しない。巨大な旧分岐へのcatch-all接続は中間状態であり、移行完了ではない。

Clientは既存の同Origin・非永続資格・接続世代・容量制限・redirect拒否を共通通信境界に維持する。接続・鍵操作の秘密入力と一度だけの鍵応答はQuery／Mutation Cacheへ入れない。Principal／Repository切替、失効、pagehide／pageshowでは旧要求・Tree・Cache・遅延callbackを分離し、取得失敗時の旧内容を現在値として表示しない。Query取消を既発行Effectのrollbackとみなさず、Mutationは自動再送しない。

現行画面取得GETには通知消費が含まれるため、Query導入時に自動再試行・復帰時取得を無条件に有効化しない。通知OwnerとServer一時状態は利用側を確認してから別単位で整理する。共有契約は実際に両側が使う非秘密DTOと純粋検査だけを置き、Domain契約や巨大Client Modelを丸ごと複製しない。

これは採用済み設計であり、実装・検証完了の表示ではない。Source対応、基準Capability、検証集合と進捗は[変更計画](../../../99_Roadmap/Changes/CHG-000082/workbench-framework-structure.md)で追跡する。

#### 管理・鍵・Workspaceの明示Route接続

Workspace専用の操作準備と単体Repositoryの照合は `service/workspace.ts` が所有する。Workspaceと実行操作が使う共有Repositoryの開発権限・実体の照合は `service/access.ts` で共用し、実行要求の主体との結合は `service/execution.ts` に残す。HTTP共通のフォーム読取り・応答は `transport/api-http.ts`、操作別受付は `transport/api-server.ts`、Workspaceの操作・Git処置の調停はServerが所有し、記録・状態遷移はExecution Modelが所有する。

Workspace管理の受付では、操作Capability・正規Directory・Linked判定をVersion Controlの同じ配置観測から受け取る。Linkedの管理操作は保存排他を取得する前に拒否する。

Workspaceの詳細（変更一覧）・ファイル・固定候補差分の読取りでは、受付で確定した親Repositoryの正規Directoryと操作Capabilityを同じ観測から受け取る。詳細では子Worktreeの所属・現在HEADを確認してから変更を読む。ファイルでは子の相対Path・Branch・期待HEADをVersion Controlの単件読取りに渡し、所属・HEAD確認と読取りを同じ操作で完結させる。固定候補差分は固定Commitと元の選択を照合し、現在の子Worktreeから組み直さない。返却時の認可は各経路で確認する。

Workspaceの記録操作には、同じ要求の受付で確定した正規保存先を渡す。改名・保留・解除は短期保存排他内で競合する実行・操作、対象と現在世代を照合して完結する。Gitを介するWorkspace操作は、短期保存排他内で対象Workspaceと競合する実行・回復を確認してから、Workspace管理同士を直列化するRepository共通の操作Lockを取得する。Directまたは実行先不明は競合扱いとし、同じProjectでも別Workspaceで確定した実行は、それだけでは管理操作を止めない。Git処置・観測中は短期保存排他を保持しない。意図と結果は既存のWorkspace記録へ保存する。廃棄はWorktree・Branch・専用親の解消後に記録を除去する。選択は未割当のQueueを結び、再観測は所属を変更しない。候補終了は採否記録、Ref回収、回収証拠の順で進み、確認済みの同じ候補だけを除去する。正本採用ではRepository単位の操作Lockを一つ保持し、Mergeと採否記録の直前に生存を確認する。固定候補・取込先と保存時CAS、Git成立後の同対象への再入場を維持する。採用専用Leaseやその解放証拠は作らない。操作Lockの解放が不明な場合は共通の解放結果で返す。

取得段階の短期排他の解放不明では、取得した操作Lockの解放を試み、Git処置を行わない。操作Lockが観測されたからといって元Processの不在を推定せず、進行中の可能性があれば終了を待つ。残存する操作Lockは手動確認の対象であり、自動削除やTask用回復IDの発行はしない。作成意図が残った場合は、操作Lockの問題を解消してから同じWorkspaceを観測し、作成済みであれば結果だけを確定する。

`transport/api-server.ts`は `transport/api-http.ts` の生Headerによる公開Origin検査をExpress内部のURL解釈より先に呼び、解析したURLを`href`の絶対URL形式で渡す。二重slashのPathを次の解析でauthorityへ読み替えず、従来のpathname・searchの意味を保つ。URL内のOriginを認証・認可へ転用しない。dot segment・absolute-formをExpressの別の受理集合へ暗黙に変更しない。不正な公開案内は421、案内正常でURL解釈不能なら固定500とし、AM・Body・Ownerを観測しない。大小文字・末尾slashを厳密に扱い、管理HEADはGET処理へ暗黙に接続しない。

要求前段は成果物の指定とリポジトリ指定の重複を検査し、共有では現在のブラウザーセッションと対象の権限を確認してから個別操作へ渡す。処理済み要求は後続処理を呼ばず、待機後に同じ取消シグナルと応答の切断を確認する。公開Origin前段は同期の拒否とURL解釈だけで、非同期の前段から個別処理までは `transport/api-http.ts` の一つのControllerと待機処理で追跡する。

`transport/api-server.ts` は管理セッションの受付、操作別の管理HTTP、作業領域のHTTP受付を担当する。旧鍵を使う初回接続や鍵処置は実行しない。共有の管理書込みとリポジトリ登録はHTTPだけで受け付ける。作業領域の共有認可はMCPと同じ現在のリポジトリ・結び付け・実体を照合し、単体接続は起動リポジトリに固定する。処置前の入力拒否と処置開始後の結果不明は区別し、途中の取消が操作の終了を保証するとは扱わない。

Portfolioの検索・20件ページ・条件結合Cursorは `service/project-context.ts`、認可済みのTopic／Meeting一覧と本文／Relationの取得は `service/topic.ts` に置く。本文欠測とReader例外の既存処置を維持する。操作結果を公開可能な欄へ絞る処理は `service/topic.ts` が所有する。構成状態を `surface` に一度だけ含め、検索済みページと適用条件を別に返す。Workbench UIの `src/api/view.ts` が同種の状態とページを記録一覧へ結び付ける。Serverの表示状態・通知消費・AI結果の所有先はこの単位では変更しない。

#### Repository・Record・AIの操作受付

RepositoryとAI選定・依頼のHTTP受付は `transport/api-server.ts` が既存の操作担当へ接続し、各操作の現在認可と応答形式を維持する。Topic／Meetingは単体・共有とも同じリソース別HTTPとし、記録操作の結果を画面取得から分離する。

共有AIの依頼・観測・取消は通常認証後の同じ前段位置から`ai.ts`へ一回だけ渡し、応答後は明示POST Routeへ再配送しない。共有AI設定GET／HEADは、明示Repository IDの現在認可・設定管理認可・公開前再確認を行う。資格IDとRepositoryごとの既存AI Session・そのOwner closeは起動Compositionに維持し、単体の表示IDと混ぜない。

`transport/api-types.ts`は既存の非永続表示変数を共有する型だけを定義する。起動Compositionが同じ寿命のobjectを所有し、各受付へ必要なfieldだけを型で渡す。資格・認可Snapshot・Root Authority・Owner・Task／Workspace正本は追加せず、状態のclone・Store・Reducer・汎用更新API・新Lockも作らない。await後の現在値読取り、結果更新、投影再取得、失敗時unknown化、GET通知消費の時点を変えない。共有契約・Client画面分割・Queryは本番経路へ接続し、実AI・実Hostの人間操作確認とは分けて評価する。

#### 表示投影・固定配信・起動Owner

`/api/workbench/view` の主画面応答は `transport/api-server.ts`、成果物本文の選択は `service/project-context.ts`、記録の検索条件は `service/topic.ts` に置く。主画面は引き続き記録本文・関連の読取り結果を使うが、旧鍵の状態を表示用に取得しない。

`workbench-ui/src/index.html` をViteの入口とし、Reactと `src/styles/workbench.css` を同じBuildで処理する。公開素材のコピー元は設けず、固定名のHTML・CSS・JSを `workbench-ui/dist/client` へ生成し、Git管理する。`app.ts` は検証済みRepositoryのロゴとUI配布物3点を起動時に読み、読取り不能ならListen前に停止する。`transport/api-server.ts` は固定のCSS・ロゴ・JS URLからメモリ内の配信内容を選ぶ。HTMLは `/index.html` を含む既存の画面Routeだけで使い、任意の静的Rootやリクエストごとのファイル読取りは追加しない。healthはAsset選択から分離し、既存応答を維持する。

成果物一覧の参照候補と出典節はDocument Modelの共通ArtifactとProject Context Parseが所有する。`service/project-context.ts` は固定文書の追加・重複排除・表示名と現在の実体の確認を担当し、Markdownのリンクは再解析しない。本文は作業ツリーの成果物を既存の実体境界で読み、Gitの比較基準や追跡状態を受付条件に追加しない。Quality／Release・Topic／Meetingの正式な文書解析も既存のDocument Model APIに委譲する。

公開起動入口 `./cli` は `crdd-server/bin/crdd-server.ts` に接続し、内部の組立ては `src/app.ts` が所有する。同一ポートのHTTPとMCPの組立て、Listen、保留要求・AIセッションを含む終了は起動本体が所有する。Expressのルートと操作別受付は `transport/api-server.ts`、HTTP接続・取消と共通の応答ヘッダー・Origin検査・フォーム読取りは `transport/api-http.ts`、開発用のOpenAPIとSwagger UIは `transport/api-document.ts` が所有する。旧起動ファイルへの互換転送は残さず、既存のCLI引数・終了順序は維持する。

Gitホストの接続・権限観測の共通契約と提供元の対応表は `service/git-host.ts` に置く。組立て時に選択したホストまたは登録済みのホストを明示して呼び、リモートURLから資格の送信先を選ばない。v0.22の対応先は `github.com` のみ。未対応ホストは通信せず拒否する。GitHub固有のURL、App権限の追加確認、応答形式とアカウントIDの数値解釈は `service/git-host-github.ts` に閉じ込める。共通層のアカウントIDは不透明な文字列とし、CRDDの認可やブラウザーのセッションはここで所有しない。

Gitホスト間の共通契約は、同じ本人とリポジトリに対する現在の実効権限（読み取り／書き込み）を返し、拒否と観測不能を区別する。対象は `{ provider, host, repositoryId, providerData }` で渡す。GitHubでは本人の権限に加え、GitHub Appのインストールと内容の権限を提供元固有の条件として確認する。インストールIDは `providerData` に置き、通信前のIDの解釈・検査はGitHub実装だけで行う。Appの可否やインストールIDを共通の権限結果としては返さない。

HTTPフォーム内のJSON、MCPのHTTP本文・stdioフレームのJSON構文検査は `transport/parse-json.ts` で共用する。解析済みの値は各受付で必要項目を確認し、待機後にも使う値の確定は各操作が行う。入力をすべて複製する共通処理は置かない。

共有では、HTTP APIはブラウザーのセッションを使う。公開Originを確認した後、`/api/` の資格ヘッダー付き要求は個別操作へ配送しない。旧接続・管理・鍵操作はルート登録せず、管理セッションがあっても旧操作は行わない。同じ待受でもMCP用トークンとOAuthの発行・照会は、それぞれの専用受付で扱う。単体は信頼できる個人PC向けで、HTTPにMCPやログインを追加しない。

HTTPのHost・Origin・媒体型・操作トークンの判定は `transport/api-http.ts` で共有する。各受付はOriginの必須・省略可と、操作トークンが必要な条件を決める。省略可の受付でも、Originが送られた場合は単一の同一Originに限る。リバースプロキシ由来の転送ヘッダーは、公開Originの入口で別に検査する。

共有の接続画面には、有効なログイン提供元と本人確認の状態を別々に渡す。Workbenchは手入力の接続鍵を受け取らず、タブ内に保持したりHTTPへ送信したりしない。本人確認前には利用できるプロジェクトの内容を返さず、管理画面は共有の管理セッションから操作別APIを使う。単体画面に共有の管理パネルは表示しない。

接続画面と主画面の表示応答は、旧鍵の一覧や交換状態を含まない。旧鍵だけの要求では資格を照合せず、非公開のリポジトリ一覧や本文を返さない。現行ブラウザーセッションと `Authorization` ヘッダーを併記した表示要求も拒否する。共有の一覧・本文は現行セッションとGitホスト上での本人の実効権限を使い、選択済みの画面の活動は対象リポジトリだけを読む。本文を返す直前まで対象・認可を再確認し、切断後は成功本文を送らない。

Googleログインの保留は5分・128件までとする。期限切れを除いた後も満杯なら、最古の保留だけを入れ替える。確立済みのブラウザーセッションは別枠で、30分・同じ本人と紐付けにつき4件・全体128件までとする。本人確認が成功した後にだけ上限を適用し、同じ本人の最古を先に整理する。容量整理は明示ログアウトではなく、MCP同意の失効や実行取消を発行しない。

管理セッションの開始・終了は `transport/api-server.ts` が受け付け、Host・Originを確認してCookieを発行・消去する。`service/access.ts` は通信から独立したセッション表、期限、容量およびAMの現在Roleに基づく管理セッションの発行を所有する。管理セッションは通常セッションの期限を超えず、開始時に観測不能なら新しい管理Cookieを返さない。管理書込み自体の現在認可は従来どおり別に行う。

共有Serverは接続元IP別の受付制限を実装しない。共有の公開経路では、認可・トークン・ログイン開始の頻度制限を公開側のリバースプロキシが所有する。容量枠はレート制限の代わりではない。公開側で制限しなければ、大量の未認証要求で保留中の処理が入れ替わり、正規の利用者もログインや接続許可をやり直す場合がある。運用手順は[共有OAuthの起動設定](../../../19_Workflows/04_MCP_Server.md#shared-oauth-startup)を参照する。

明示ログアウトで現在の本人を確認できたときは、そのブラウザーセッションと、同じ利用者のMCP認可サーバー側セッション・同意・未交換コード・発行済みトークンおよび対話用Gitホスト資格を無効にする。別の利用者の認可は変更しない。ログアウトは新規利用を止めるが、開始済み実行の取消にはしない。通常のブラウザー期限切れはこの失効を発火しない。Cookieの欠落・期限切れなどで本人を確認できないときはブラウザーCookieだけを消して401を返し、Workbenchでは再ログイン後に改めてログアウトするよう案内する。状態を観測できないときは失効を実行せず、再試行できる。

MCPトークンの主体はCRDD利用者と外部ログインの結合IDのみとする。Gitホストの連携参照は、本人が同意した時点のホスト別の組をサーバー内のGrantに保持し、トークン照会結果には含めない。同意を最新の表示ごとの一回限りの確認値で結び付け、別タブの古い表示や、表示から許可までに連携が変わった状態では確定しない。MCP要求では有効なトークンと同じGrantから対象ホストの参照だけを選ぶ。他のブラウザーや後から連携したアカウントを代用しない。

GitホストのアクセストークンはGitホスト連携が持ち、ブラウザーセッションは参照だけを持つ。MCPも同じ参照と本人・紐付けで照会し、HTTPのセッション表は走査しない。ブラウザーの通常の期限切れでは連携を破棄せず、Gitホストが示す資格期限まで保持する。期限切れのブラウザー資格では読み取れず、別のブラウザーセッションへ参照を引き継がない。現在の連携をやり直すか明示的に解除した場合は古い参照を除去し、Server終了時は全参照を破棄する。参照だけでは現在認可を成立させない。

共有のHTTP APIでGitのステージ・解除を行うときは、ブラウザーセッションと、登録済みの対象への本人の実効的な書き込み権限を確認する。認可済みの対象をVersion Controlへ渡し、変更するのは選択した作業ツリーのローカルインデックスだけとする。利用者別のインデックスは作らず、旧接続鍵も代用しない。画面応答は対象で提供する操作の一覧だけを渡し、Workbenchは対応するボタンを表示する。操作要求では表示時の一覧を信用せず、現在の権限を再確認する。共有のコミットとリモート送信は、この経路にも画面上の操作一覧にも含めない。

単体・共有GET／HEADの表示受付は`transport/api-server.ts`に置き、本文・Content-Length・HEADの送信規則を共用する。共有表示の応答済み・取消終了だけを処理済みとし、未知Pathは元の共有操作Allowlistへ戻す。単体は未知GETを404、未対応POSTを405で拒否し、共有は許可一覧外のPOSTを403で拒否する。撤去した候補操作に専用経路は持たない。Artifact Query・通常認証・共有Catalog取得の前段順序、共有表示の公開前再認可、単体GETだけの通知消費を変更しない。設定・表示状態は同じ参照と読取り時点を保ち、活動観測も既存表示objectと同じ寿命で保持する。HTTP受付から`app.ts`の起動・Session・終了処理へ逆依存しない。全Framework・共有契約の移管完了を意味しない。

### Client配置と共有表示契約

Browser Build入口は`src/main.tsx`、画面選択は`src/app.tsx`、画面本体は`src/pages/`、独立PanelとShellは`src/components/`とする。小さな共通表示要素は`elements.ts`へ同居させる。接続資格を非永続に保持する既存通信境界は`src/api/connection.ts`、RecordのForm・応答相関は`record.ts`、選択条件を維持するURL生成は`view.ts`が所有する。旧`browser/`への転送は残さない。

HTTPの応答型はServerの各Ownerで定義し、Workbench UIはパッケージの型専用ルートにある表示応答と管理応答の型だけを参照する。Domain等の正本型をtype importで参照する。表示JSON・AI選択設定・Portfolioの受信検査は `workbench-ui/src/api/response.ts` に置く。実行検証スクリプトと接続試験は、クライアントとして同じ受理条件を利用する。送信済みAI選定設定と保存応答の照合はWorkbench UIの `src/api/ai-selection.ts` が所有し、共通の設定Snapshot検査だけを再利用する。Serverは共有型へ直接接続し、React・Client通信・資格memoryへ依存しない。HTTPの公開操作・通信Schemaは維持する。

ClientのNavigationは次節のRouterへ接続する。`src/app.tsx`は検査済みviewの選択だけを行い、概要・接続管理・Project詳細・Record詳細・原文表示を`src/pages/`へ分ける。共有表示部品は`src/components/`へ置き、移管だけで状態の寿命・Form受付・失敗時の表示条件を変えない。ディレクトリの追加階層は、Node Runtime／Browser Build／純粋共有契約を分けたうえで、API・表示・HTTP受付の独立した利用・試験境界を識別するために採用する。

### React Routerの履歴・取消・Document終了

`src/router.tsx`はReact Router 8.5.0のcreateBrowserRouterを既知7Pathへ接続する。Loaderは`src/api/view.ts`の既存表示取得をRouterのSignalで一回呼び、独自Cacheを持たない。共通親はpending時に旧Outletを描画せず、エラー時は自由な例外本文や旧Modelを使用しない。人間判断により、リンク／GET検索が取得に失敗した場合も遷移先URLを保持して固定エラーを表示する。旧URLへの復元制御は追加しない。

`src/main.tsx`はReact RootとDocument寿命、既知の通常リンク／GET Formの対象判定とRepository選択補正だけを担う。POST・外部・修飾クリック・download・hash-onlyリンクは横取りしない。履歴とPOPをRouterへ委譲し、独自pushState・popstate監視・Navigation世代を撤去する。接続資格の世代は既存通信境界が維持し、画面遷移世代と混同しない。同一URLとhash-only以外のPOPはfresh取得し、hash-onlyは取得しない。Transitionsを無効にしてpendingを旧画面の維持に使用しない。

pagehideではRouterとReact Rootを終了し、この画面が登録したDOM監視を解除して要求世代を無効にする。再入場は新しいRouterとReact Rootから現在のブラウザーセッションで取得する。表示要求の取消を外部操作の巻戻しとは扱わない。表示取得は次節の一経路で行い、画面側で同じ取得を重ねない。

### Query・画面・共有境界の最終配置

`src/api/queries.ts` はTanStack Queryの明示取得を使う。自動再取得・再送をせず、要求ごとの識別子で同用途の独立取得を分ける。画面とQueryの取消を既存通信に伝え、成功・失敗とも当該Queryだけを除去する。画面終了・ログアウト前は要求世代の無効化とともにQueryを破棄する。

2026-10-21の再評価では、この方式を維持する。Repository／Task単位の安定keyなら同時取得共有と選択的invalidateに利点があるが、現行GETには通知消費があり、Caller別の取消と明示取得の分離も必要である。安定keyだけを導入すると取消済みPromiseの共有や取得省略で既存の振る舞いが変わる。現在は共有Cacheを最適化するより、一回取得・主体切替時の取消・非保持をQueryへ集約する利点を優先する。通知消費を分離し、読取りの副作用・接続世代・認可範囲を安定keyへ結合できる段階で再評価する。資格をkeyへ入れる方法や新しい要求Registryは採用しない。

Repository操作の入力規則と処置結果の意味検査はGit操作を担当する `service/repository.ts` に置く。Workbench UIは選択中の画面のフォームだけを送り、HTTP応答を同じ送信と照合して非秘密の状態・理由だけを表示する。Gitの入力制約と処置結果の規則はUIで再実装しない。Record削除後の移動はRouterが所有し、同じ接続世代・Repository・移動先に限定した短命の通知を新しいLoader結果へ渡す。手動History更新、二重GET、永続通知Storeは追加しない。

Workbenchの `src/api/mutations.ts` は業務操作を対応するHTTPメソッドとURLへ一回送る。Mutationは自動再送せず、入力・応答をキャッシュに保持しない。二重送信の拒否、取消、処置後の観測と結果の表示は呼出し側が所有する。

外部ログインと管理セッションをHTTPに接続し、通常のアクセス管理は `service/access.ts` からAMへ委譲する。最初の管理者の登録・紐付けの修復はServerの管理CLIで行う。管理応答の描画前検査はWorkbench UIが所有する。共有リポジトリの照合は `service/access.ts`、実行主体との結合・実行定義・活動照会・AI依頼の準備は `service/execution.ts` が担当する。プロジェクトと成果物の読取りは `service/project-context.ts`、Gitの観測は `service/repository.ts`、ビューのHTTP応答は `transport/api-server.ts` が担当する。Server接続設定と専用設定領域の検査は `service/configuration.ts` に置き、HTTPで設定読取りを公開しない。起動・Reader・注入用の値はパッケージ内部で使い、公開しない。

設定済みのHTTP／MCPのObjective要求は、`service/execution-child.ts` が一件につき一つの子Processで既存のCoordinator受付へ接続する。親が元要求と対象を照合し、対象ディレクトリと主体を子の認可済みContextへ渡す。親は子の初回受付時、短期保存Lock待ちなどで子から認可の再確認を求められたとき、結果公開前に現在の認可を照合する。共有ObjectiveはGraph内の各Taskの開始前にも親へ確認する。単体実行にはこの外部認可の確認を追加しない。子が結果を返しても、正常終了まで確認できない限り確定結果として公開しない。取消は対象子だけへ通知し、切断や強制停止から清掃完了を推定しない。再入場と回復の正本は既存のExecution Modelに置き、親は別の実行台帳を持たない。

親子ともCoordinatorの参照は `@qual-lab/crdd-coordinator` の公開ルートを使う。Serverは同じ配布版のローカル依存を宣言し、Coordinatorの内部Sourceを実行時に直接参照しない。型参照だけで子Processや実行Sessionを起動せず、既存の遅延読込みの位置を維持する。

親は正式結果と進捗投影が認可済みの元Queueに一致することを確認する。Queue行が未確定でも、同じ元Queueに結合できるLease取得回復参照は返す。元Queueとの結合を確認できない参照は公開しない。実行状態照会の任意の `queueId` は絞り込みにだけ使い、Repository・Projectの認可を代替しない。指定のない照会で複数の実行が該当する場合は別Graphを選ばず、観測不能を返す。

Workbenchの実行状況は、認可済みRepositoryから一回の活動照会で取得したGraphの要約を、Repository IDとQueue IDの組で選択する。同じMilestoneの複数実行を混ぜず、状態を特定できない行は観測不能として表示する。取消済み、または履歴への退役が確定したGraphは現在の選択肢から外す。元の選択が消えても別の実行へ読み替えない。複数Graphの存在は、観測済みの単発AI依頼を表示から外す理由にしない。選択でServerへ状態照会を追加発行しない。実行履歴はProject全体の別観測であり、画面で選んだGraphの履歴として扱わない。

共有MCPの活動照会も、読取り前と結果をRPCへ引き渡す前に、今回の認可済みRepository集合が現在も同一かを確認する。読取り中に失効・集合変更が起きた場合は部分集合で続行せず、Graph識別子・状態・履歴を含めて返さない。共有HTTPは活動照会を含む画面応答全体の既存公開直前確認を維持する。

全Client TSXをRoot Biomeの既存ルールへ接続する。Hookの再取得関数は実依存でuseCallbackへ固定し、Token／Repository切替時の既存Owner再生成を維持する。識別子を持たず同値行・セルを許容する静的text表だけは、位置が表示Identityで状態を持たない理由を局所コメントで明示する。状態付き行のindex keyや全体ルールの無効化へ一般化しない。

### Workbenchの横断試験

Serverは実HTTPの受付・認可・応答と検証クライアントの終了を確認する。Workbench UIは応答の受理・拒否と実ブラウザーを確認する。実ブラウザー2本は `workbench-ui` の `test:credential-browser` と `test:visual` で明示実行する。読取り回数・時刻を同じProcessで観測するため、この2本だけはServer内部の `src/app.ts` とVisual Previewの試験接続を使う。製品Sourceへの依存には追加せず、UIの通常試験・カバレッジには含めない。Executor結果を説明文の観測器に結ぶ確認はServer所有の横断結合試験で独立子を使い、製品単体の集計に含めない。

### 読取り助言の限定実試験入口

合成編集の試験器`tests/system/manual/verify-workspace-ai.ts`では、通信失敗の操作段階、固定理由、応答前／本文受信中の分類、期限Timerの実発火、許可済み通信codeだけを記録する。清掃用abortを期限超過へ読み替えず、URL・Token・自由な例外本文は保存しない。受付IDが確定した後の観測失敗では、公開HTTPでのTask再送をせず、元のCoordinator Task Ownerへ同じIDの取消を一回発行し、返却されたTask／cleanup／回復参照を記録してからServerを閉じる。これは試験器の終了処置であり、公開取消HTTPの成立を証明しない。受付結果不明、取消結果欠測、実行継続中は清掃成功にせず、一次失敗、取消失敗、Server close失敗を分離する。既存のDocker回収条件・期限・保存形式は変更しない。

Root検証を先行し、既存Version ControlのFilesystem観測でCommit、固定文書のHash、Repository AI設定の内容Identityだけを照合する。試験器自身の前後照合ではGit子Processを使用せず、既存Workbenchの安全なGit読取りは変更しない。`projectContextUnchanged`／`revisionUnchanged`と`wholeRepositoryUnchangedClaimed:false`を返し、index・他Sourceの不変は主張しない。DockerのHash対象fieldは欠落・型不正と正常nullを区別する。開始前・終了後ともContainerはcreated／exited／deadのみ許容し、paused／restarting／removingや状態欠測をidleへ畳まない。

`40_Develop/crdd-server/tests/system/manual/verify-readonly-ai.ts`は、外部送信の別許可を確認した操作者が一Providerだけを明示実行する検証入口とする。`--provider codex|claude --external-send-confirmed`以外はServer／Docker観測前に拒否する。明示Model選定・質問・`PROJECT_CONTEXT.md`一件だけを公開HTTP→既存Coordinator Task Ownerへ渡す。本文・資格は記録せず、自動再送・編集・採用・再起動は行わない。timeout、一次失敗、cleanup、副次失敗、close、最終観測を別に保持する。HTTPの固定診断をTask期限と分離し、受付済みIDの観測失敗では同じOwnerへ一回だけ取消を発行する。同IDの取消結果・回復参照を保持してからcloseし、取消失敗・ID不一致で一次失敗を上書きしない。受付前・受付結果不明には推測したIDで取消を発行しない。通常回帰から実送信を起動しない。

Dockerの事前照会はDesktop省電力cacheを含み得るため、全ID完全一致をEngine同一世代の証明にしない。既定bridge／host／noneは名前・driver・local scope・default bridge指定を厳密確認し、ID差を専用診断として出す。IPAM／Options／IPv4・IPv6／internal等の捕捉構成差は許容しない。既存Containerと利用者Networkは捕捉属性と集合を保持し、未知追加・消失・欠測・重複は非成功とする。runtimeの個別cleanup確認は独立条件であり、一覧成立やeventsだけで代替しない。構成Hashは観測した属性の比較であり、全設定・Filesystem内容の完全保全を主張しない。結果は限定試験だけの成立とし、全E2Eへ拡張しない。保存台帳・Lock・Recoveryは追加しない。

Workspace再編では[横断契約](../coordinator/05_Workspace.md)に従う。Workbenchの作業領域パネルは同一オリジンのリソース別HTTP APIから、現在の開発認可を経てサーバーの作業領域操作へ接続する。MCPは経由しない。Browserの作業領域Panelは受付一覧の有界取得、作業領域の作成・選択、変更確認、候補固定、固定差分確認、別採用・Merge・候補終了と作業領域破棄を分ける。期待世代・Base・HEAD・Blobを確認し、応答喪失時に自動再送せず再取得へ案内する。旧Bundle candidate/actionを新Git採用の証拠に使わない。単体RepositoryのAI入口はCoordinatorの単発Task Ownerへ接続する。助言とWorkspace編集を同じ受付・Writer・Leaseへ結合し、回答本文はProcess内だけに保持する。旧Bundle用`/candidate/action`は撤去し、Workspaceの固定・別採用へ接続する。共有接続も同じ単発Ownerを利用する。現在の接続資格・主体・RepositoryごとにProcess内の表示対象を分離し、開始・観測・取消と待機後の公開前に現在development認可を再確認する。Browserは既存の同Origin資格搬送を利用し、WorkbenchからMCPへ接続しない。実装・結合検証中で、実Providerや人間による導線評価まで完了したとはしない。

Workspaceリソースは、正規Hostでのみ受け付け、提示されたOriginも同一に限る。書き込みは同一OriginのJSONを要求し、Pathとメソッドで操作を選ぶ。共有のWorkspaceと実行定義はブラウザーのセッションと、Gitホストにおける本人の対象別実効権限を確認する。GitHubではAppの権限も確認する。旧Bearerや旧公開範囲へ戻さない。処置直前・公開前は現在の認可、連携、Root実体、接続先、対象マニフェストを確認し、Lock中に外部を照会しない。単体は起動リポジトリだけを扱い、従来の作業領域フォームは受け付けない。

成果物種別: Architecture詳細設計
詳細設計領域: workbench-server
状態: Candidate
維持責任者: Qual-Lab

CHG-000082の再編後、HTTP入口は `crdd-server`、ブラウザアプリケーションは `workbench-ui` が所有する。WorkbenchとMCPは対等な公開入口であり、WorkbenchはLocal／共有配置のいずれでもMCPへ依存しない。共有利用はBrowserから共有Host上のWorkbenchへ接続し、Workbench Serverが同Hostの専門Package APIを直接利用する。Workbench backendから別HostのMCP／CROSへ接続する旧経路を撤去する。以下の旧Remote経路の実測は当時の成立範囲であり、MCP依存全撤去後の完成証明ではない。Browser向けWorkbench API、React＋ViteのCSR、既存画面とVisual Baselineを維持し、今回の再編でUX／IAを独断で再設計しない。

## 基本設計との関係

### Workbenchの旧MCP依存撤去契約 — 2026-10-13

Workbenchの実行時依存にはMCP Server・旧CROS Packageを含めない。単体はRepositoryの専門Owner、共有は要求資格によるAM認可後に同Hostの専門Ownerへ直接接続する。Browser向けHTTP APIと独立MCP Serverの公開能力は維持する。

起動構成は現行fieldの閉集合とし、廃止した接続fieldを単体Rootへの暗黙fallbackへ読み替えない。別Host Endpoint、Remote資格、接続・更新・切断の旧POST、共通MCP Clientと四MCP Adapterを撤去する。Mainの接続表示は単体または同Host共有の状態だけを持ち、Endpoint・Remote通知を持たない。本文とRelationの同期Reader型は既存Topic／Meeting操作の責務に置き、通信専用型・再export Fileを残さない。

旧通信専用のJSON-RPC envelopeやTool写像試験は撤去する。現在認可・失効後の旧値非表示・未選択・別Root分離・CRUD／Relation・Profile・活動の検証義務は、直接経路の管理／Browser／本文／Git試験へ維持する。これは撤去候補の設計契約であり、回帰・独立レビュー・通常CLI・共有配置が完了したことを示さない。以下の旧Remote成立記録は現在の実装Owner／依存契約に使用しない。

### 管理操作の直接AM接続 — 2026-10-13

本人と、利用者・登録リポジトリの二種の管理読取りはアクセス管理の既存APIへ接続する。共有サーバーの管理書込みは、短命の管理セッションと同一オリジンの閉じたJSONを要求し、対象と操作はメソッド・パスで固定する。表示名、管理ロール、登録解除は `service/access.ts` から保存処理へ接続する。現在ロールと対象・期待改訂はアクセス管理が保存ロック内で確認する。ロール別内容範囲とリポジトリ公開範囲の設定は、HTTPと管理画面に公開しない。旧Bearerを共有管理の代替入口にしない。

リポジトリ登録はWorkbenchの明示操作に限り、manager／administratorの現在認可はアクセス管理が所有する。共有起動時に運用者が許可した実ディレクトリを固定し、指定先がその配下にある場合だけGit配置を観測する。保存前にも対象実体と配下であることを再確認する。既存登録をHTTP／MCPで利用する場合も、内容取得前に同じ境界を確認する。観測不能・許可外では利用を止めるが、保存済み登録やファイルは変更しない。この配置境界はGitホスト上の本人の権限とは別で、単体起動には適用しない。

### Local CROSの直接Portfolio接続 — 2026-10-13

この節は切替前の実装履歴。記載する旧HTTPの接続専用POSTとその確認保存、Projectの旧公開範囲による直接読取りは撤去済みであり、現在の共有ログインの手順・認可契約には使用しない。

共有の内容投影は、現在の本人セッションとGitホストでの実効権限を確認し、許可された現在の登録だけをDomainの本文ReaderとPortfolio集約へ渡す。未連携や許可対象なしを内容取得の成功とは扱わない。認可済み文書の欠測・競合は本文と版のないSourceとして表示し、対象の認可やディレクトリが観測不能なら本文を公開しない。公開直前も対象のManifest・実ディレクトリと現在の認可を照合する。管理Roleを内容の権限に代用せず、内部のパス・Binding・資格はブラウザーへ返さない。これは同一パスの物理実体の不変や、実サービスとの接続を保証するものではない。

明示Repository選択は同Readerの`resolveAccessRepository`で現在集合へ結合する。Topic／Meetingの関連文書を扱う操作の構成は `service/topic.ts` に一元化し、同Projectの許可集合を既存Domainへ渡す。Meeting固有の書込みは `service/meeting.ts` に残す。指定先だけが書込みOwnerであり、未登録・非許可から起動Rootへfallbackしない。返却Rootと操作を次要求の認可証明として保持せず、HTTP入力完了後の当該要求だけに使用する。

内部Readerに続き、Serverの`localAccessRoot`構成と専用`/api/access/connection`を局所接続した。CROS起動は配布用Logo／固定JSだけを読み、起動RepositoryのContext／Topic・Meeting／Profile Catalog／活動Readerを構成しない。未認証GETは非秘密access Model、接続POSTは確認後200の閉じたJSON（status: completed）だけを返し、通常読取りは次GETが現在資格で取得する。共有Browserで主体が混ざらないよう、CROSの通常要求は一つのAuthorization HeaderのBearerから当該要求だけのAM Contextを構成し、Server全体にログイン鍵・本人投影・接続Noticeを保持しない。重複・不正・欠落Headerは資格なし、不成立・状態不明は本人／内容非表示とする。Action Tokenは共通の用途限定入力条件であり認証ではない。各要求で現在資格と操作認可を取り直し、Aの接続をBの資格へ転用しない。切断はBrowserが鍵のmemory参照を捨てる操作で、他Browserをログアウト・資格失効させない。既存の同Process管理／鍵操作へ接続するが、Browserのmemory保持／Header送信はSource接続と鍵管理／接続の局所実Browser確認済みで、選択Repositoryの全内容入口はまだ未接続で、起動Rootへのfallbackをせず拒否する。この拒否は完成ではない。公開CLI、実Browser・共有TLS配置・全入口の終了保証は未完了であり、管理画面や局所HTTP成功からWorkbench全体成立を表示しない。

Local接続の完全Formは同Origin・Host・Content-Type・Body容量をHTTP Ownerが検査した後、`transport/api-server.ts`の`authenticateLocalConnectionForm`で検査し、受付済みの資格を`service/access.ts`の`confirmLocalCredentialConnection`へ渡す。許可fieldはactionToken／operation／tokenだけで、重複・未知field・用途差・取消は認証前拒否する。初回限定資格は既存AM確認保存へ接続し、出版完了後のfreshな通常認証に成功した場合だけ当該要求memoryの接続資格を返す。初回相関を内容Authorityへ変換しない。保存後取消は保存取消ではなく応答停止であり、次要求が現在状態を再確認する。内容操作は別途要求ごとに現在認可を取り直す。鍵・Rootは通常Model、URL、log、Browser Storageへ含めず、新Session保存は作らない。専用Local HTTP POSTは局所接続済みで、資格を完了後に保持しない。次要求は単一Authorization Headerでfresh認証する。Browser memory／Header送信はSource接続と鍵管理／接続の局所実Browser確認済みで、公開CLI、共有TLS配置、全内容入口は未接続であり、全体完成の根拠ではない。

### Browserの接続資格と応答搬送 — 2026-10-13

現行の共有接続でリポジトリの読み書きを決めるのは、Gitホストにおける本人の実効権限である。旧方式の公開範囲の内部撤去は切替計画で追跡し、旧方式を現行のブラウザー認可に使用しない。

`src/api/connection.ts` は同一オリジンの通信と、古い応答を採用しないための要求世代を所有する。共有セッションを使う要求に限ってCookieを送信し、手入力した接続鍵の保持や送信は行わない。Serverは毎要求の現在認証・認可を担当する。

同一オリジン以外への送信と呼出し元が指定したAuthorizationヘッダーは拒否し、リダイレクトを追従しない。本文の読取り終了時にReaderを解放し、待機後も要求世代と取消を確認して古い応答を採用しない。自動再送しない。

旧鍵の接続POSTと、その応答を確認してタブ内に鍵を保持する方式は撤去した。旧方式の実ブラウザー確認は履歴であり、現行の共有ログインの実環境確認に流用しない。

### 現在候補のCSR画面遷移

選択RepositoryのGET接続では、今回AMが確認した一つの短命許可集合から選択Root・Portfolio・同ProjectのTopic／Meetingを構成し、ContextのRepository／Project IDとmanifestを相関する。Surface・本文・一覧・Relation・Git観測とModel構築後の公開直前に、既存AMで全Rootを再観測し、管理改訂とRepository ID／Binding／manifest全契約field／workspaceIdsの正規化全集合がexact一致する場合だけ応答する。差異・不明・取消は旧内容を部分公開せず固定拒否とし、その照合後に外部I/Oを追加しない。repositoryIdは0件またはexact1件だけ受け、空1件は選択解除、重複は認証・AM・Root本文観測前に拒否する。新Session／Lock／Cacheは追加しない。起動Rootや前要求の結果へfallbackせず、直前操作・AI／Candidate結果は要求専用のnullとする。共有側Profile情報の`aiProfiles: null`は未取得を表し、0件・不存在・利用不可を意味しない。Inspector、一覧表示とAI依頼入力は同じnull意味を保持し、単体の既定Catalogを維持する。内容POST接続まで共有側の内容保存Formを無効化する。この途中GET接続は保存・本文リンク・共有配置の完成ではない。

`src/main.tsx`は既知のMain／Project／Topic／MeetingリンクとGET検索を同OriginのModel取得へ接続する。外部リンク、別タブ・修飾クリック、download、POSTを一律に横取りしない。明示Repository IDを検索・内部移動で落とさず、Serverの現在認可で再解決する。URLのIDを認可証明や物理Rootとして使わない。

表示要求の取消・採用はRouterのシグナルと画面遷移へ委譲する。通信側も待機後に要求世代を確認する。履歴にはセッション資格や業務データのスナップショットを保存しない。戻る操作では現在の状態を取得し、失敗時は遷移先URLで固定のエラーを表示する。

pagehideでは画面の監視・要求・React Rootを終了し、要求世代を無効化する。キャッシュからのpageshow再開では新しいRootから現在のブラウザーセッションでデータを取得し、過去の表示状態は復元しない。合成イベント試験は処理の終了と再開を確認するもので、ブラウザー自身のキャッシュ採用可否を保証しない。

GETによる画面遷移と書込みは別の接続である。共有では、選択リポジトリへ起動リポジトリの実行担当を流用しない。実装・検証の範囲から、未接続の操作まで成立したとは扱わない。

### 旧Profile管理からの切替

旧Host Catalog・Profile CRUD・独立MCP四操作は新設定管理の契約ではない。現在の所有者、入力、CASと現在認可は冒頭のRepository別AI選択設定を正本とする。過去の実測・正式Evidenceの内容とHashは変更しない。

### 選択Repositoryの内容操作と本文への接続契約 — 2026-10-13

共有の書込みは起動リポジトリや前要求の操作を利用しない。Topic／Meetingの対象はURLのリポジトリIDで固定する。同一Origin・Host・Content-Type・本文上限、JSONの重複キー、記録ID・期待改訂・確認・Markdownの操作別条件を検査してから、その要求のアクセス管理による許可集合を取得する。作成では記録IDをURLに置かず、期待改訂も要求しない。

Topic／Meetingの書込みは許可された指定先で既存Document Modelの操作を一回だけ使う。関連文書の読取りでは同じProjectの許可集合を使う。Gitは選択された作業場所でVersion Controlを使い、ステージ・解除・コミット・明示確認済みの通常公開を維持する。任意コマンド、強制公開、再送、Document Modelへの資格搬送を追加しない。処置の直前に対象と取消を確認し、保存開始後の取消を巻戻しとはみなさない。

処置前拒否、配送後の結果未確認、既知処置後の現在投影未確認を分離する。結果公開前にはC2と取消を確認し、現在認可不成立で対象本文・Metadataを公開しない。確認済み処置を未保存へ書き換えず、非秘密の固定通知で現在結果の公開不可を示す。要求ごとの結果をServer全体の直前結果へ保持しない。

`/change`と`/owner-artifact`も今回の選択Rootを使用する。宣言されたID／Pathだけを既存Readerへ渡し、Owner Artifact Catalogは当該Rootの現在Contextから構成する。読取り後のC2と取消を確認する。Browserは同Originの既存資格搬送で原文を取得し、Reactのtextとして表示する。資格付きURL、任意Path、raw HTML／Markdown実行、起動Rootへのfallbackは追加しない。

これは③の実装対象契約であり、現在の未接続操作の拒否を正常能力の成立証明にはしない。入力待機中の失効・公開変更、同名IDの別Repository、異Project Relation、保存後認可故障・応答喪失・取消、実Git Process終了と要求joinを検証してから旧経路を撤去する。

Git書込みはHTTP専用とする。`/api/repositories/{repositoryId}` 配下の `POST /staging` と `DELETE /staging` は単体・共有の両方で提供する。共有では許可ルート内の登録済みRepositoryに対し、Gitホストで本人の実効書込み権限を確認し、提供元固有の追加条件も満たす場合に限る。`POST /revisions` と `POST /revisions/{revision}/publication` は単体だけで提供し、起動対象に限定する。対象と操作はメソッド・URLで確定し、JSON本文では上書きできない。同一Originと操作トークンを照合する。単体のPushは送信先・ブランチ・完全なコミットIDが現在の公開対象と一致する場合だけ、明示確認付きで発行する。共有のステージ操作は、同期Git終了後に通信通知を処理し、取消・提供前の照合不成立では成功本文を返さない。既存の結果を操作・発行済み効果・改訂へ相関し、配送後例外は固定503で結果未確認とする。新Store・ACK・Recoveryは追加しない。

Workbenchは単体と共有で同じGit操作パネルを使い、選択ID・操作トークンと画面入力を送信前に照合する。要求ごとの結果を操作・理由・効果・改訂へ相関し、同じ操作の二重送信を拒否する。既知の完了／拒否／不明と最新表示の取得を分離し、取得故障では旧Git状態・操作フォームを表示しない。再取得はGETのみとし、終了・対象切替では要求の取消状態と世代で旧結果を拒否する。共有では接続が成立し、操作が許可された場合だけ有効化する。Git差分・ブランチ・送信先設定の意味はVersion Controlが所有し、Workbench独自の保存・再送・ACKは作らない。

### 選択成果物の原文表示 — 2026-10-13

Owner Artifact一覧は本文表示の成立条件と分離する。通常File・相対Path・実PathのRepository内所属を確認し、開いた実体と読取り前後を照合して文書全体を読む。第一H1を表示名とし、見出しがなければ相対Path表示へ戻す。先頭8KiBによる見出し切詰めと512KiBによる本文拒否は撤去する。handleは成功／失敗ともcloseし、read／close・実体変更の不明では一覧全体をunknownとする。一覧のavailableは掲載対象の観測成立であり、別要求時の本文観測成功を保証しない。新しいCache・Store・公開fieldは追加しない。

Owner Artifactの相対Pathは512文字という独自上限を置かず、Catalog構築・指定本文読取り・選択Query・Browser Modelまで同じ文法で搬送する。`.md`、非空、親参照／空segment／外部URL／絶対Path／逆slashの拒否、exact Catalog membership、realpathのRepository内所属・通常File・非Linkの条件は維持する。選択後の再観測で不成立なら本文を返さず、量制限の撤去をPath認可の拡大や任意文書探索へ変えない。HTTP受信上限・CHG ID文法・Repository ID形式は変更しない。OS／FilesystemのPath限界は残り、任意長の成功を保証しない。

`/change`／`/owner-artifact`のnative GETは固定Document Shellだけを返し、原文は既知CSR navigationから同Originの`/api/workbench/view`へ要求する。同Host CROSでは今回の明示Repository IDをAM集合のRootへ結合し、CHG-ID固定Readerまたは選択Rootの現在Owner Catalog Readerをawaitした後、取消と既存C2を確認して公開する。単体は検証済みContextのRepository IDを出所とし、別IDを明示した要求は拒否する。旧RemoteではMCP照会も起動Root原文fallbackも行わない。

Queryは本文種別ごとのroute／repositoryId／idまたはpathだけをexact一件で受け、重複・余剰・越境はRoot本文観測前に拒否する。Readerは従来のlexical／realpath／通常File／非link境界を維持し、容量だけでは本文を拒否しない。async読取りを途中放棄せず完了をjoinし、取消・失効・公開集合／manifest変化では本文を返さない。新Cache・Lock・Recoveryは追加しない。

閉じた`artifact` Modelは出所Repository ID、共有選択（単体はnull）、種別、既存Identity（CHG-ID／相対Path）と原文だけを持つ。Browserはkind／Identity／選択と要求URLの一致、余剰fieldを検査し、原文をReactの`pre` textとして表示する。容量だけの解析拒否は行わない。Markdown／HTML／本文linkを実行・操作入口化しない。戻る／履歴移動は現在選択とmemory資格を保持してfresh取得し、遅延旧応答を採用しない。reload／新タブは資格なしで接続画面へ戻し、私有本文を復元しない。このAPI Media Type変更は原文取得能力をJSON→text表示へ移すもので、旧native text/markdownを併存させない。

本文接続は実HTTP・実Browser・全Browser回帰と限定独立レビューで確認した。これは本文能力の限定成立であり、Git操作・通常CLI・共有配置・旧Remote撤去・正式191項目とAM全体完成は別に確認する。

### 単体・共有の記録操作とブラウザー搬送

一覧・詳細のTopic／Meetingフォームは `src/components/record-operation-panel.tsx` から、単体・共有とも操作別HTTPへJSONを一回送る。`recordActionsConfigured` は画面の書込み可否を示すが、認可の証明には使わない。共有で書込みが許可されない場合も、一覧・検索・詳細など許可された読取りは維持する。

送信前にフォームのリポジトリID／操作トークンを現在の画面と照合し、ファイルと重複を拒否する。未選択の `closeMeeting`／`confirmed` はJSONの `false` とし、暗黙に `true` にしない。保留中の二重送信を拒否し、所有する取消シグナルと画面世代で終了後の応答採用を拒否する。応答のHTTP状態・操作理由・作用数と、返された記録の種別・対象IDを照合してから表示値に縮小する。表示値は別要求の保存証明に使わない。

既知completed／blockedと後続fresh取得は別の事実として扱う。再取得が失敗した場合は既知結果を保持し、以前の本文・FormをCurrent表示しない。不正・喪失した保存応答は未保存と判断せず、明示再取得もGETだけを行う。URLのroute／query／選択Repositoryを保持して応答の選択とSignalを再確認する。Detailの削除後は同じRepository一覧へ移り、その他の操作は同じDetailを再取得する。Serverの保存とC2は既存契約のままで、Browser独自の保存、rollback、Session、ACK、Recoveryは追加しない。

この実装候補はTopic／MeetingのBrowser接続であり、未接続Git操作・本文入口・通常CLI・旧Remote撤去や③全体の完成を意味しない。実Browserの操作、二重送信、応答故障、取消と終了後状態を確認してから限定Gateを判定する。

### 活動Ownerの結果と画面投影 — 2026-10-12

同Hostの活動読取り前後では、既存の通信待機処理を一回ずつ通し、切断通知を処理してから要求Signalを確認する。開始前の切断はReaderへ渡さず、開始中の切断は同期読取りを放棄・再実行せず完了をjoinした後で成功本文を抑止する。これは同期Filesystem I/Oの途中中断を保証するものではない。

同Host CROSの選択Mainでは、要求内の単一AM集合から選択RepositoryのProjectと同Project対象全件を導出し、Coordinatorの`readAuthorizedExecutionActivity`へID・技術Root・20件上限・任意Cursorだけを渡す。資格・Role・Bindingを活動Ownerへ渡さず、Query自己申告Projectや起動Rootを使わない。既存の表示変換は現在状態と履歴の不明を分離し、Cursor不正・Reader故障を先頭ページや空成功へ補完しない。同期読取りの強制途中取消は追加せず、開始済みReaderの終了を待ってCallerが取消と公開直前のAM全集合一致を確認する。Activity故障のunknown表示と、AM集合不成立のMain全体拒否を分ける。保存・初期化・Task実行・新Cacheは追加しない。旧Remote ActivityのMCP分岐の撤去と公開CLI／共有配置の完成は別途必要である。

旧REST受取経路もOrchestratorの検査済み活動観測を使用する。Remote Clientが要求Projectと応答Projectの一致を確認した後、`projectRuntimeActivityForWorkbench`が現行画面のPropertyだけを新Objectへ再構成する。結果直下のProject／Source／現在OwnerとEventのRepositoryを暗黙転記しない。現在状態と履歴状態は独立して保持し、観測済み履歴理由だけを画面所有の`execution_events_observed`へ写す。unknown・空履歴・Continuationの意味は保持する。画面に出所を表示する判断や同型通信DTOの新設は含めない。

Repository単体の活動Readerも同じCoordinator APIへ直接接続する。構築時にDomain ContextのProject／Repository IDをコピーして固定し、要求Project不一致またはRoot不成立では観測不能を返す。Workbench独自の履歴解析・並び替え・Cursor生成は廃止する。保存済み状態と履歴の表示に、現在HEAD・Push先・upstreamの設定を要求しない。既定20件、上限50件と不正Cursor拒否はOwnerの契約に従う。旧方式の短命Cursorは移行せず、先頭から再取得する。永続状態Schemaは変更しない。保存時点の案内を現在の実行許可として使わない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project／Portfolio状態を、欠測と根拠を保った画面へ投影する。 | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingを一覧・詳細・操作Flowへ接続する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 検証済みRepository境界をWorktree表示へ接続する。 | Covered |
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | Repository AI設定と技術Model／Tool Capabilityを選択可能な表示へ接続する。 | Covered |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Local／Remoteの入口差を同じApplication意味へ適合する。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 現在認可された情報だけを表示し、管理セッションの操作をアクセス管理へ委譲する。管理者の初期登録・再紐付けはHostの管理CLIが担当する。旧経路の内部撤去と実環境検証は残る。 | Partial |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 外部AI依頼、結果帰還および候補採否の境界を表示する。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 現在有効な意図と履歴正本への導線を提供する。 | Covered |
| [ARCH-000017](../../Definitions/ARCH-000017/architecture_definition.md) | 承認済みCRDD公式ロゴをApplication Brandへ使用する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Shell、Server、AdapterおよびPortの責務を分ける。 | [§3](#3-componentと責務) |
| Interface Model | Required | Browser、HTTP、Application Contractおよび外部境界を固定する。 | [§6](#6-interfaceとinteraction境界) |
| Data Flow | Required | Canonical SourceからView ModelとDOMまでの搬送を示す。 | [§5](#5-dataと状態) |
| State Model | Required | loading、ready、partial、restricted、unknown、failedを区別する。 | [§5](#5-dataと状態) |
| Sequence | Required | 要求、受理、Effect、結果、回復を分ける。 | [§6](#6-interfaceとinteraction境界) |
| Failure／Recovery | Required | 部分成功、競合、結果不明および安全な再入場を扱う。 | [§8](#8-failureとrecovery) |
| Deployment | Required | localhost ServerとBrowser UIの配置を固定する。 | [§4](#4-実行配置モデル) |
| Observability | Required | DOM、HTTP、Application結果、外部Effectを別に観測する。 | [§11](#11-quality引渡しの要約) |
| Security Boundary | Required | loopback、現在認可範囲、Repository Root、外部送信を分ける。 | [§6](#6-interfaceとinteraction境界) |
| Implementation Structure | Required | Production packageの責務分割とVariationを評価する。 | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 並行Request、Projection再取得および書込み結果をRequest Identityと期待Revisionで分離する。 | [Componentと責務](#3-componentと責務) |
| Timing | PASS | loading、更新中、timeout、結果不明を区別し、期限超過を失敗または不存在へ畳まない。 | [FailureとRecovery](#8-failureとrecovery) |
| Resource Lifecycle | PASS | listener、request、session、child processのOwnerと終了後条件を固定する。 | [実行・配置モデル](#4-実行配置モデル) |
| External Boundary | PASS | Git、Remote CROS、AI Provider、Filesystemを別境界として扱う。 | [InterfaceとInteraction境界](#6-interfaceとinteraction境界) |
| State／Consistency | PASS | Projection Identity、期待Revisionおよび再観測によってstaleな画面からの無断更新を防ぐ。 | [Dataと状態](#5-dataと状態) |
| Failure／Recovery | PASS | partial、restricted、conflict、unknownと安全な再入場を分ける。 | [FailureとRecovery](#8-failureとrecovery) |
| Observability | PASS | View State、Application Result、Effect、終了後資源を独立して観測する。 | [Qualityへの引渡し](#qualityへの引渡し) |
| Security／Trust | PASS | localhost既定と既存Authorityを維持し、非開示SourceやSecretを画面へ露出しない。 | [InterfaceとInteraction境界](#6-interfaceとinteraction境界) |

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `workbench.component-boundary` | Component／Responsibility | Browser UI→Workbench Adapter→公開Application Contract | UIが正本やAuthorityを所有せず同じ契約を利用する | Screenが独自状態や書込みを実装する | ST | System/E2E | import、request、result、Owner | 重複正本0、未所有Effect 0 | Project Context、Topic／Meeting、Version Control、Credential、AI設定／依頼、実行状況およびOwner Artifact Portを本番Ownerへ接続する。新AI設定の通常・Browser検証は別Gateとする。15画面のProduction DOMは実Browser Visual Gateで全数観測済み |
| `workbench.interface-boundary` | Interface／Security | Browser→localhost Server→Consumer Port | loopbackと既存Authority内だけで要求を搬送する | 外部Bind、内部型露出、Grant越境 | IT | Direct Boundary | bind address、request、Grant、response | listener 0、秘密再表示0 | localhost、Credential管理、Bearer Remote Transport、Browser接続入口、および外部TLS終端から同一Origin Gatewayへの境界を観測済み |
| `workbench.view-state` | State／Consistency | Projection→View Model→DOM | partial、restricted、unknownを区別する | unknownをempty／completeへ畳む | UAT | User Acceptance | state、coverage、source、表示 | staleな成功表示0 | Topic／Meeting未構成、Remote失効、Git観測不能、AI未接続、Runtime absent／unknown、Owner Artifact unknownをProduction DOMで分離済み。人間受入は未完了 |
| `workbench.interaction-sequence` | Sequence／Effect | 操作→要求→受理→Effect→結果→回復 | 各段階を区別し結果不明時に暗黙再送しない | request発行を完了と表示する | IT／ST | Direct Boundary／System E2E | request identity、effect state、result | 重複Effect 0 | Repository Work、Topic／Meeting、Credential、接続、Repository AI設定と現在Session AI依頼を各Ownerへ接続する。保存結果・後続取得・応答不明を分け、新設定の全回帰と実Provider E2Eは別Gateとする |
| `workbench.resource-flow` | Data Flow／Lifecycle | listener、request、session、child process | shutdown後に所有資源が残らない | Browser closeだけでcleanup完了とする | IT／ST | Direct Boundary／System E2E | handle、OS固有のexactな世代Identity、listener、temporary resource | 所有資源0 | localhost ServerのListener／Connection cleanupに加え、15画面の実Browser Process、専用ProfileおよびWorkbench Listenerの終了後不存在を観測済み。Visual Runnerは終了要求直前にTreeを再取得し、正常終了後5秒の猶予、同一世代Identityの残存子Processだけへの限定Fallback、最終30秒の不存在確認を順に行う。一段のcleanup失敗後も後続段を試行し、終了処理とTree観測の所要時間を記録する。実Browser 27条件は全件成功し、局所ITでは親終了後に残る子ProcessへFallbackを実発行して最終0件を確認した。読取り助言Runtimeの実Provider E2Eは未確認 |
| `workbench.failure-recovery` | Failure／Recovery | conflict、partial、unknown、provider failure | 入力と確認済み結果を保ち安全に再入場できる | 自動再実行、無断上書き、事実損失 | ST | System/E2E | retained input、result classification、next action | 未承認Effect 0 | Push結果不明は観測済み。他のOperation／Providerは未確認 |
| `workbench.mode-variation` | Variation／Common Contract | Repository単体／Local CROS／Remote CROS | 可用能力差を示し同じ結果意味を保つ | Modeごとに状態語彙やAuthorityが変わる | IT | Direct Boundary | mode、capability、result schema | 未許可Source読取り0 | Browserからの接続・更新・切断、Remote Portfolio取得、許可済みSource選択、Remote Topic／Meetingの一覧・詳細・書込み・Relation遷移、失効後Unavailable、およびREST／MCP同一HTTPS Origin契約を観測済み |
| `workbench.screen-composition` | UI Composition／Visual | Direction Aの15 Screenと公式ロゴ | 公式ロゴを左上に表示し各Profileで主要Flowを利用できる | 代替Logo、横Overflow、Focus不能、情報階層崩壊 | ST | System/E2E | image load、DOM、zoom、viewport、keyboard | Browser資源0 | [実Browser Visual Gate](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)で15画面、Desktop／Tablet／Mobile、100%／200%／400%の27条件を全数観測済み。人間UATは未完了 |

## 現行実装との照合

現行のWorkbenchは `crdd-server` のHTTP入口と `workbench-ui` のブラウザBundleから構成する。`04_UI/Details/Visual/workbench-hero`は設計Evidenceであり、Production Sourceや実装済みCapabilityとして扱わない。Production packageへ接続したCROS、Project Operation、Version Controlおよび公式Assetは、下記Reality Auditと検証結果で現在の成立範囲を区別する。

## 1. 目的と結論

CROS Workbenchは、Project Context、Topic、Meeting、Quality、正本Relation、AI依頼およびRepository作業へ進む人間向けの薄い利用面である。Workbench専用の業務正本、Authority、Access判定またはGit実装を持たず、既存の公開Application Contractを画面へ適合する。

最初のProduction実装は、TypeScriptで実装するlocalhost限定Node HTTP Serverと、Reactで構成するBrowser UIの組合せとする。ViteはBrowser Clientの決定論的なBuildだけを所有し、認証、Server Action、正本読取りまたは業務Effectを所有しない。同じView ModelとInteraction Contractを将来のRemote CROS接続でも使用できるようにし、Next.js等のFull-stack FrameworkやElectron等のDesktop包装は現在の成立条件にしない。

左上のブランド表示は[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または独自の類似画像へ置換しない。

## 2. 対応するArchitecture責務

| Architecture ID | Workbenchが利用する責務 | Workbenchが所有しないもの |
|---|---|---|
| ARCH-000005 | Project／Portfolioの状態投影 | Project状態、受入判断の正本 |
| ARCH-000006 | Topic／Meetingの一覧、詳細、候補と引渡し | Topic／Meetingの意味とLifecycle規則 |
| ARCH-000009 | 検証済みRepository境界 | Repository Rootの推測、Git実装 |
| ARCH-000010 | Repository AI設定と技術Model／Tool Capabilityの表示・選択 | Provider能力、Model Registryの正本 |
| ARCH-000012 | Local／Remote入口で同じApplication意味を使う | TransportによるAuthority生成 |
| ARCH-000013 | 現在認可された情報の表示と、共有管理セッションの操作入口 | 認可判定、利用者とロールの正本、Host管理CLIでの初期登録・再紐付けの実行 |
| ARCH-000015 | 外部AI依頼、結果帰還と候補採否 | 外部送信許可、候補内容、Canonical Repositoryの無断更新 |
| ARCH-000016 | 現在有効な意図と履歴への導線 | Git履歴やCHGの代替正本 |
| ARCH-000017 | 公式ロゴの出所と用途 | 新しいBrand Assetの自己承認 |

## 3. Componentと責務

```text
Browser
└ Workbench Client-side React UI
   ├ React Application Shell
   ├ Screen Router
   ├ View Model Renderer
   └ Interaction Adapter
            │ localhost HTTP／将来Remote HTTP
            │ fixed Document Shell + safe JSON Read Model + Action POST
            ▼
   Workbench Application Adapter
      ├ Domain Model公開API（Context／Topic／Meeting／Owner読取り）
      ├ Access Management公開契約（同一Processの現在認可・通常鍵操作）
      ├ AI Adapter公開API（技術Catalog）
      ├ Coordinator公開API（Repository AI設定と選定）
      ├ Version Control公開API
      ├ Coordinator公開API（Task／Objective、候補採用、状態照会、単体AI依頼）
      └ Official Asset公開API
            │
            ▼
既存の公開Application Contract／Adapter
```

| Component | 所有する責務 | 所有しない責務 |
|---|---|---|
| React Application Shell | Global Navigation、現在Project、表示領域、左上の公式ロゴおよび全画面DOMのClient-side描画 | Project状態、認証判定、Git状態 |
| Vite Build Adapter | Browser Clientの依存解決、最小化および固定配布Asset生成 | Runtime Authority、Server Routing、業務状態、Secret注入 |
| Screen Router | SCRと選択ContextのNavigation | Business Lifecycle、正本Relationの生成 |
| View Model Renderer | 公開結果をVisual Stateへ変換 | 欠測、制限、結果不明の推測補完 |
| Interaction Adapter | 利用者操作を既存Application Requestへ変換 | Authority、Retry許可、Effect成功の生成 |
| Workbench HTTP Server | localhost listener、静的Asset、Application request、shutdown | Project／Git／Credentialの意味 |
| Consumer Adapter | Domain Model、Access Management、Version Control、Coordinatorの公開契約を画面要求へ適合する | 具象内部型や秘密を画面へ漏らすこと。下位からWorkbenchをimportさせる逆依存 |

### 3.1. Packageと公開入口

`crdd-server/src/transport/api-server.ts` はHTTP受付、`service/` は公開データと専門Ownerへの接続、`workbench-ui/src` はCSR描画と同Origin資格搬送を所有する。Workbench UIの[応答検査](../../../40_Develop/workbench-ui/src/api/response.ts)はServerの型専用ルート からだけ応答型を参照し、各画面の型は公開応答から取り出す。Serverの実行モジュールはブラウザーに混ぜない。型専用ルートはUI向けの応答型だけを公開し、起動・Reader・注入型・Express内部は公開しない。起動入口は `crdd-server/bin/crdd-server.ts`、Bundleの固定配信URLは `/assets/workbench-client.js` とする。

単体・共有の成果物本文は `service/project-context.ts` の共通の読取り・公開投影を利用する。記録詳細と接続の公開投影は `service/topic.ts` と `service/access.ts` に置く。対象選択・再認可・取消・本文欠測時のHTTP応答は各受付が所有する。

実行状態照会は `GET /api/repositories/{repositoryId}/runs/{requestId}` に接続する。`projectId` と `repositoryRevision` はクエリで必須、`queueId` は任意。URLに含む識別子はクエリに重ねて指定しない。単体は起動リポジトリのIDだけを受け付け、共有はブラウザーセッションと指定先に対する本人のGitホスト実効読み取り権限を確認する。共有の判断・開始・再開・取消は書き込み権限を確認し、旧Bearerへ戻さない。MCPの照会は `crdd.get_execution_state`。画面表示APIとは分離し、照会だけで状態を初期化しない。

Objectiveの開始は `POST /api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/runs`、再開は `POST /api/repositories/{repositoryId}/runs/{requestId}/resumption` に接続する。同一OriginのJSON要求に `X-CRDD-Action-Token` が必要。操作とURLの識別子を本文に重ねて指定しない。開始では新しい実行IDを本文で指定し、再開ではURLの実行IDに対応する元の実行入力を渡す。単体は起動リポジトリのIDと照合し、共有は本人のGitホスト実効書き込み権限を確認する。GitHubではAppの権限も確認する。対応するMCPツールは `crdd.start_objective` と `crdd.resume_objective`。Coordinatorの新規／再送／再開の判定と結果の公開条件は両入口で共通とする。

判断の要求は `POST /api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions` に接続する。回答・適用・閉鎖は同じ配下の `/{decisionId}/answers`、`/{decisionId}/application`、`/{decisionId}/closure` への `POST` に分ける。開始・再開と同じ同一Origin・JSON・操作トークンの条件を使い、URLの識別子と `operation` は本文に重ねない。元世代と改訂を指定し、実際に保存できるかはCoordinatorが判定する。鍵管理・AM管理・Workbench固有の画面用操作は実行系入口の対象外とする。

共有の状態照会は、対象への本人の実効読み取り権限を要求する。判断とObjectiveの開始・再開は実効書き込み権限を要求する。CoordinatorにはGitホスト資格やブラウザー資格を渡さず、確認した実行先とCRDDの主体IDだけを使う。

共有認可では、アクセス管理（AM）で現在の本人の紐付けと対象の登録を確認する。管理状態の改訂だけで拒否せず、受付時の登録、実体、Projectおよび対象構成との一致を確認する。失効、対象変更、観測不能を区別する。

Objective実行では、子への過去の実行許可と今回の再照合結果を分ける。再照合で拒否した場合も、以前の許可による処置を未実行とみなさず、子の終了と回復結果を内部で扱う。認可喪失を観測した要求では、終了までに認可が戻っても結果を公開しない。

共有Objectiveの親は、初回の実行許可から子の終了まで、同じアクセス管理ルートを使うサーバー内の保存通知を購読する。通知は保存の成功を表さず、親は保存の排他を抜けてから現在認可を読み直す。明示失効または対象変更を確認した実行だけ、結果を非公開にして既存の親子間通信で取消を要求する。観測不能を失効とは判定せず、既存の処置前／公開前の拒否は維持する。子の終了が未確認なら取消・回復完了にしない。

明示取消は現在のServerが所有する起動だけを対象とする。Repository・Project・要求ID・本人に加え、ローカル実体、登録の結合、Gitホスト側の登録先、起動ごとの `launchId` を照合する。認可済みの本人への状態公開直前に認可を確認できなければ、起動識別子だけでなく状態全体を公開しない。HTTPとMCPから同じ子への取消を要求できるが、取消の応答は終了や回収の成否ではない。記録・回復の正本はCoordinatorと実行モデルに残し、起動への参照は子の終了とともに破棄する。標準入出力の並行受付は、[MCPの設計](../mcp-server/01_Architecture.md)に従う。

最初のTaskを許可するまでは、新規要求と同様に元の入口資格が有効でなければならない。開始済みの実行は本人の紐付け、記録したGitホストのアカウントID、対象の安定IDを監視する。GitHubでは対象リポジトリ1件の `Metadata: Read` に限定したAppのインストールトークンを使い、本人の対話用トークンを使わない。ログアウトと通常満了は取消を発行しない。明示的なGit連携解除や確定した権限喪失・対象変更は、既存の取消経路に接続する。別プロセスによる管理変更とGitホストの状態は、既存の定期確認と次Task・結果公開前に確認する。15秒は既存の確認間隔で、停止時間の上限ではない。観測不能は失効としないが、次Taskと結果公開は許可しない。

Project詳細・記録詳細・接続画面はServerの開示済みデータをWorkbench UIで描画する。ブランド画像の選択と文書検索欄・Portfolio検索欄の表示はUIが所有し、ビュー応答にロゴURLや検索値の折返しを含めない。HTTPは同一Originの固定ロゴを従来どおり配信する。文書の絞込みは開示済み一覧に対してUIが行い、Portfolioの検索・継続位置の検証はServerに残す。作業Treeと差分は単体・共有とも `service/repository.ts` の同じ観測を使い、観測失敗は部分成功に変換しない。

`GET /api/workbench/view` はWorkbenchの画面を組み立てるための専用入口として維持する。Projectや記録などの汎用一覧・詳細は、画面用の応答から切り出し、用途別のHTTP APIと対応するMCPツールへ接続する。汎用クライアントに画面用応答の解析を求めず、画面用APIに対応するMCPツールは設けない。分離の前後で、現在の認可・取消・対象照合・欠測の扱いを維持する。

Project一覧は認可されたリポジトリのIDだけを含み、共有のProject Context詳細は指定したリポジトリとProjectの組だけを投影する。単体では起動リポジトリのManifestで対象を確認し、文書モデルの固定読取りを使用する。共有では、すべての登録先で現在の本人とGitホストの実効読み取り権限を照合する。GitHubでは提供元固有の条件としてAppの権限も確認する。HTTPとMCPは同じProject投影を使う。

`GET /api/repositories/{repositoryId}/activity` は、画面の組立てと分離した保存済みの活動照会である。単体は起動リポジトリだけ、共有はブラウザーセッションと、指定先に対する本人の現在のGitホスト実効読み取り権限を要求する。ページ指定は `cursor` と `limit` だけを受け付ける。共有MCPの `crdd.get_execution_activity` も明示した `repositoryId` を使う。両者は同じ読取りを使い、認可または実体の再照合に失敗したら結果を返さない。画面専用の表示投影は別の操作として維持する。

Topic・Meetingのリソース別HTTPとMCPは同じ記録操作を使う。単体の対象は起動リポジトリ、共有の対象は明示した登録リポジトリである。共有では本人のGitホスト実効権限を読取り・書込み別に確認し、GitHubではAppの権限も確認する。旧Bearerやロール別公開範囲で代替せず、確定前・公開前にManifestと認可済みの対象が変わっていないことを確認する。Workbenchも対象リポジトリと記録をURLで指定し、操作別メソッドのJSON要求を一度だけ送る。保存の確定・競合による拒否・結果未確認を操作の応答で区別し、画面の再取得は書込みを再送しない。詳細から削除した通知はブラウザー内で遷移先にのみ渡し、画面取得の応答に操作結果を混ぜない。

Workbench UIは `GET /api/repositories/{repositoryId}/ai-request` で対象リポジトリの現在のAI依頼を定期照会する。個別照会には `/api/repositories/{repositoryId}/ai-requests/{requestId}` を使う。共有では既に存在する当該資格・リポジトリの実行先を照会の前後で確認し、対象不明や失効では結果を開示しない。照会は新しい実行先、開始、取消、画面全体の再構築を行わない。UIは終了や依頼IDの切替を観測したときだけ画面を再取得し、待機中に変わった選択や操作へ古い応答を反映しない。Store監視やサーバーからのプッシュ配信は使わない。

Workbenchの明示操作は、リポジトリごとの `POST /ai-requests` で開始、`PUT /ai-request` で以前の依頼を現在表示に選択、`POST /ai-requests/{requestId}/cancellation` で取消を要求する。同一Originと操作トークンを確認し、閉じたJSONを受け付ける。選択時は既存の依頼を一件観測するだけで、元の依頼本文を復元・再送せず、Taskも開始しない。取消は既存依頼を照合し、返された実行状態を再取得する。HTTP到達や結果不明を実行完了・取消完了とみなさない。検証用クライアントも同じ開始・取消の入口を使い、応答喪失後は同じ依頼を照会する。

AI選定の対象確定・現在認可との再照合、技術カタログと設定の取得は `service/configuration.ts` が担当する。設定の読取り・保存はConfig Modelを使う。成果物の選択と本文取得は `service/project-context.ts` が担当する。AI開始要求の構築と観測結果が照会・取消の対象になるかの判定は `service/execution.ts` が所有する。開始要求は単体の入力正規化と拒否条件を維持し、共有には同じ前処理を強制しない。HTTPはフォーム解析、処置前後の応答区分と画面更新を維持する。Git公開先の再照合と処置後の再観測不明の投影は `service/repository.ts` に置き、公開先不一致は従来どおりGit操作を発行する前に拒否する。

Topic／MeetingのHTTP入力は `transport/api-server.ts` が受け付ける。`service/topic.ts` がMCPと共通の記録操作を確定し、`service/meeting.ts` のMeeting処置を含めてDocument Modelへ渡す。一覧画面はTopic、Meetingの順で読み、カーソルの未指定と空文字を区別する。書込みの成否と、次の画面取得の成否は別にする。

本体構成Rootが下位の公開APIへ直接依存する。ここでいうAdapterは要求・結果の局所変換であり、下位へWorkbench専用Portを注入するFrameworkではない。技術CatalogはAI Adapter、Repository設定と選定はCoordinator、共有設定管理の認可はAccess Management、共通実行と上位Objective／候補採用は単一Coordinator内のそれぞれの責務、成果物CRUDはDomain Modelが所有する。

## 4. 実行・配置モデル

```text
[Local Repository Mode]
React Browser UI ── localhost ── Node Workbench Server ── Repository-local Ports

[Local CROS Mode]
React Browser UI ── Workbench API ── Access Managementの現在認可 → Domain Model等の内部能力（同一Process）

[同Host CROS Mode／共有配置]
React Browser UI ── Workbench API ── Access Managementの現在認可 ── 同Host専門Package
独立MCP Server ── 同じ専門Package（Workbenchとの相互依存なし）
                                                         └ 現在認可済みRepositoryだけ

[Build]
React／TypeScript Source ── Vite ── fixed Browser Bundle
                                      └ Node Serverがexact allowlist配信
```

- Local Serverはloopbackだけで待ち受け、任意Interfaceへ公開しない。
- Repository単体利用はCROS Credentialを要求しない。
- CROS利用時は要求Credentialを接続へ渡し、Access Managementが現在ユーザー・Role・操作権限を評価する。同一Processの直接呼出しでも現在の認可・Exposureを確認し、認可を省略するLocal特例を作らない。Repository単体利用は別の範囲であり、CROS認可へ暗黙昇格しない。
- UI配布物はViteの派生物であり、UI Sourceとは別の設計正本にしない。`40_Develop/workbench-ui/dist/client` 直下の `index.html`、`workbench.css` および `assets/workbench-client.js` を、Buildなしで起動可能な配布物へ含める。Coordinatorの実行閉包にWorkbench配布物を無条件で加えず、Workbench配布・公開Assetの完全性とCoordinator署名範囲を区別する。Build不能、配布集合外、Asset欠落またはallowlist外要求では固定・起動・配信を拒否する。旧Pathは移行前のEvidenceとしてのみ扱う。
- Node Serverは空のDocument Shell、固定AssetおよびJSON Read Modelだけを配信し、Browser Clientが全画面DOMをClient-side Reactで構築する。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、同一Originの明示POST用のProcess限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。SSR、Hydration、Raw HTML Fragmentおよび既存DOMの再読取りは行わない。
- React要素を生成するPanelと共通表示ComponentはBrowser Clientだけがvalue importする。Node CLI／Serverから到達するRuntime依存GraphはApplication、Read Model生成、Authority、HTTPおよび固定Asset配信だけを含み、React／React DOMまたはBrowser描画Moduleへ到達しない。型参照はRuntime依存として扱わないが、value import／再Export／dynamic importは配布候補固定前に閉集合で検査する。
- Browserを閉じたことだけでServer終了を推定しない。明示shutdownまたはOwner Process終了でlistenerと進行中requestを回収する。
- Next.js／Server Action、Desktop wrapper、OS tray、auto update、installerは`N/A`: 現在の利用者成果に必要な根拠がなく、Node側の既存Authority境界と責務が重複する。

Server内部で使う関数は`startWorkbench`（起動と終了Handle）、`readWorkbenchServerConfiguration`（非秘密設定）、`readProjectViewData`（現在投影）、`readOwnerArtifactCatalog`／`readOwnerArtifact`（許可された一覧／本文）、`createRepositoryWorkbenchActivityReader`（Project限定活動Reader）、`readAiSelectionView`（Repository設定・技術対応投影）の7操作を提供する。旧Profile投影二APIは撤去する。公開するのは `./cli` と `src/index.ts` のクライアント向け応答型だけであり、`./api`・`./mcp` の互換サブパスは置かない。HTTPのURL・MCPの受付契約は変更しない。

配布入口は `template/tools/crdd-server.ts`。同じCLIが通常HTTPとMCPを起動し、`--mcp-stdio` はMCPの搬送だけを変更する。引数と出力・終了は[利用手順](../../../19_Workflows/04_MCP_Server.md)に従う。HTTP Bindは127.0.0.1固定。公式ロゴと生成UIは配布Checkoutから読み、採用Repositoryに同じ資産の配置を要求しない。Credentialを引数に取らず、共有の不成立から単体へ切り替えない。

### 4.1. 接続と操作の直接Owner接続

Workbenchは単体・共有とも同Hostの専門Package APIを直接利用する。別Hostの機能を利用する場合、BrowserがそのHostのWorkbenchへ接続する。Workbench backendに別Host接続、MCP Client、loopback、REST fallbackを設けない。旧Endpoint設定・短命接続の整理はフロントAIの移行手順が担当し、Runtime互換Readerは持たない。

| 操作 | 現行の直接接続 | 維持する結果・制約 |
|---|---|---|
| Portfolio取得 | `service/project-context.ts` → AMの現在集合 → Domain本文／集約 | 五場面、検索・状態・継続、Source分離、欠測・不明、全集合再照合 |
| Repository AI設定の取得・保存 | 共有は現在Roleと、対象Gitホストでの本人の実効権限を照合して設定APIへ接続 | 照会は読取り権限、保存は書込み権限と同じ本人の短命管理セッションが必要。期待内容Identity、保存一回、取得不明を空成功へ畳まない |
| Runtime Activity | AMの同Project集合 → Coordinatorの活動Reader | Project・Cursor、現在状態と履歴のunknown分離、開始済みReader join、取消後成功本文0 |
| Topic／Meeting | AM集合 → Domain操作／Relation | 指定Root、CRUD、競合、Outcome全件処置後Close、昇格、現在認可と非開示 |
| Git | AMの選択Root → Version Control | Stage／解除／Commit／確認済み通常Push、現在Target相関、一回処置、結果不明と再送0 |
| 共有の管理操作 | `transport/api-server.ts` → `service/access.ts` → アクセス管理 | 短命の管理セッションと現在の管理権限が必要。管理書込みはMCPへ公開しない |

共有Workbenchは同一オリジンのCookieでブラウザーセッションを示し、鍵をAuthorizationヘッダーへ移さない。内容と管理の要求はそれぞれ現在の認可を確認し、取消や権限変化で公開できなくなった結果は返さない。古い表示や遅延応答は要求世代とシグナルで退け、切断を保存済み操作の巻戻しと扱わない。

最初の管理者の登録と外部アカウントの再紐付けはHostの管理CLIに限る。CLIは外部ログインで本人を確認し、確認済みの主体をアクセス管理へ渡す。WorkbenchとMCPに旧鍵の発行・提示・交換は公開しない。

起動時の--sharedによる単体／共有の明示選択、Host設定の接続、TLS終端の注入は公開CLIと結合試験へ接続する。単体は現在Rootの唯一のRepository ID、共有は現在許可集合の同じRepository ID契約で選択する。初期化済みだから自動切替せず、設定不正時は単体へfallbackしない。サーバー起動用CRDDリポも公開設定なしで対象へ加えない。合成環境のCLI接続成功を、実共有Host配置・初回鍵の人間操作・実Provider全E2E・正式QA完成へ流用しない。

公開CLIの起動拒否はHost構成・初期化状態・公式Logo・Client Asset・Repository Rootの固定分類だけを表示し、それ以外は`workbench_startup_unavailable`へ閉じる。元例外本文、Path、資格は表示しない。起動失敗時に単体modeへ自動切替せず、SIGINT／SIGTERMは所有Workbench Handleの既存closeへ接続する。Process終了とListener不存在は別に観測し、合成Signal試験をOSのSignal搬送保証へ昇格しない。

共有公開時はWorkbench自身の非秘密`publicOrigin`へHTTPS Originを明示し、`localAccessRoot`の現在認証Ownerを必須とする。単体の資格不要内容を暗黙共有化しない。内部Listenerと`baseUrl`／`healthUrl`はloopbackのまま、利用者向け`publicUrl`は明示公開Originとする。各要求は単一Host・`x-forwarded-proto: https`・公開Hostに一致する単一`x-forwarded-host`をAM観測前に検査する。Originは存在時exact一致、POSTでは必須とし、欠測・重複・混在は固定421で拒否する。TLS終端は同HostでClient案内Headerを除去・上書きし、内部Listenerの到達範囲を配置Ownerが管理する。Header一致だけを実TLS通信やHost内非信頼Processへの防御成立として表示しない。WorkbenchとMCPに同一Originを要求せず、第三Gatewayを作らない。現在はServer optionsの局所候補であり、CLI設定と実TLS配置は未完了である。

非秘密設定は起動Repositoryの`.crdd/config/workbench-server.json`。閉Schemaは任意の`publicOrigin`文字列だけで、空ObjectまたはFile不存在はlocalhost既定とする。`--shared`明示時だけ読み、portは既存CLI引数が所有する。例は[配布設定](../../../template/.crdd/config/workbench-server.example.json)。資格・Host管理情報を含めず、独自16KiB拒否と固定Bufferは設けず開いたFileの観測sizeまで全量を読む。重複・余剰field、不正UTF-8、Directory／File link、取得時File Identity不一致、Descriptorのsize・mtime不一致、read／close異常は固定拒否にする。単体起動は設定があっても共有へ自動切替しない。ReaderとCLIは接続候補であり、実TLS配置と共有縦断検証を別に閉じる。これは起動時Snapshotの検査で、取得後のPath／Directory不変を保証しない。HTTP受信量・Credential形式・許可Originは変更しない。配置Ownerが設定変更と再起動を管理する。

検証ToolのDocker InventoryはContainer／Network各256件で拒否せず、全件のID・名前・構成Hash・一意性と標準Network条件を照合する。Lifecycle診断Collectorは一通知4KiB・合計16件の量制限とoverflow状態を撤去し、全通知のSchema・Task／Operation相関・重複・元write復元を検査する。不正情報や観測不能を正常へ補完しない。HTTP応答1MiB・子Process出力／IPC・期限の別契約は変更せず、実Docker／AIの追加試験を実施した証拠にはしない。Runtime／OSの限界と致命的OOM等の結果返却非保証は残る。

## 5. Dataと状態

| 状態 | Owner | Workbenchでの保持 | 終了条件 |
|---|---|---|---|
| 選択Project／Screen／Panel | Workbench Session | 一時保持可 | Session終了で破棄 |
| Project／Portfolio Projection | Owner Artifact→Domain Model | 表示用Snapshotだけ | 再取得またはSession終了 |
| Topic／Meeting編集入力 | 利用者＋Interaction Adapter | 送信完了まで保持 | 成功、取消、明示破棄 |
| Git Tree／Diff／Stage状態 | Version Control Adapter | 観測結果とIdentityだけ | 再観測またはSession終了 |
| AI依頼入力、依頼種別、現在結果と候補確認 | 現在Session | Provider正本や候補内容を複製せず、Candidate IDと安全な確認Metadataだけを一時保持 | 明示採用・確認付き破棄・保留、取消、Session終了 |
| Runtime Activity投影 | Coordinator内State | 一回の表示用Snapshotだけ | 再観測またはSession終了 |
| Project Plan | Current Release Projection→Domain Model共通Reader | Version、期限、Risk、Scope、依存および判断の表示用Snapshot | 再観測またはSession終了。計画値はRoadmap／CHGが正本 |
| Quality | `parseQualityCenter` → `currentProjection` | 状態、Coverage、Gap、次Gateおよび人間判断の表示用Snapshot。表の欠測は観測不明 | 再観測またはSession終了。品質の各意味はQuality成果物が正本 |
| Documentation | Roadmap詳細、Project Context Owner Relation | 検証済みPathとtitleだけ | 再観測またはSession終了。内容はOwner Artifactが正本 |
| 接続Credential Secret | Access Management認証／Workbench接続境界 | Workbench Process memoryだけ。入力後に再表示せず、URL、HTML、Repository、logへ保存しない | 明示切断またはProcess終了で破棄 |
| Remote Topic／Meeting対象Repository | Access Management認可済み集合→Domain Model投影 | 現在Sessionの選択IDだけ。Source本文やGrantを複製しない | Portfolio再取得で対象外になった時、明示切替またはSession終了で破棄 |
| 公式ロゴ | Official Asset Governance | 読取り専用Assetとして配信 | Server終了 |

WorkbenchはCurrent Projectionを独自Databaseへ複製しない。将来Cacheを導入する場合も、Source Identity、Currentness、Coverage、失効条件を持つ派生物として別途設計する。

## 6. InterfaceとInteraction境界

| 入口 | 入力 | 出力 | Authority／Effect |
|---|---|---|---|
| Screen Load | Project、Screen、Cursor、Filter | View Model、Coverage、Continuation、Failure | 読取りAuthorityを追加しない |
| Topic／Meeting操作 | Identity、期待Revision、入力、操作種別 | success／conflict／partial／unknown | 既存Command／Candidate入口へ委譲する |
| Repository観測 | 検証済みRoot、対象Path／Revision | Tree、Diff、Staged、Unstaged、Untracked、Conflict | 読取りのみ |
| Stage／Commit／Push | 選択差分、Commit内容、確認済みRemote／Branch／Commit | 段階別結果、残る差分、unknown | 明示Authorityを既存Version Control Portへ渡す。Force Push 0 |
| AI依頼 | 選択Context、作業分類・任意明示選択、依頼種別（読取り助言／Workspace編集）、利用者入力、変更候補時の明示許可Path、Repository追加通信先の参考表示 | 依頼種別、事実、保存済み分析、追加推論、次の選択肢、各項目の根拠参照、未採用Candidate ID、Provider状態 | 作業分類・明示選択と依頼種別を読み替えずApplicationへ渡す。Workbenchは送信対象を明示し、認可済みの依頼を搬送する。専用の送信確認や表示時Hashを要求しない。読取り助言は利用者入力と許可済み投影を内容Hash付き専用Task Packetへ固定し、Task Hash・固定した完全選定・Provider・追加Hostへ結合し、Packetを一回だけ消費する。編集は対象Workspaceと固定Executor選定を単発Taskへ結合し、借用実行の変更観測を返す。作業指示Pathは指示・事後確認でありPath別ACLではない。読取り助言の許可を候補生成や採用Authorityへ再利用せず、候補の採用、CommitおよびPublishは別操作にする。根拠参照のない項目を部分表示せず、参照から任意Path読取りAuthorityを作らない |
| AI変更候補の採否 | 現在Workspace ID、固定Candidate Commit、Base／取込先HEAD、現在世代・Scope、操作ごとの明示確認 | available／blocked、Base／Candidate／Merge Commit、保存・cleanup・Recovery状態 | 確認はEffect 0とし、候補固定、採用、候補終了、Workspace終了を別操作にする。採用はServerのWorkspace操作が現在認可、Workspace ID、固定Candidate Commit、取込先HEAD、dirty／Scopeを再観測し、Version Controlの二親Mergeと既存結果Writerを完了した場合だけ成立する。保留はWorkspace／Version Control Effect 0とする。固定だけでMerge／Pushせず、採用でもPushしない |
| Runtime Activity | Project ID、任意Event Cursor | observed／absent／unknown、Objective／Task件数、判断・Recovery・次処置、Project限定Event Page | 読取りのみ。Runtime正本、状態遷移またはRecovery Authorityを生成しない。EventはExecution Intelligence Storeから新しい順・上限付きで投影する |
| Owner Artifact | 単体は検査済み起動Catalog、同Host CROSは今回選択Rootの現在Catalogに含まれる相対Markdown Path | Roadmap／Quality／Relation原文 | 読取りのみ。Catalog外Path、外部URL、親参照およびRepository越境を拒否する |
| Project Plan | `99_Roadmap/03_Releases.md` | Baseline、対象Version、期限、Risk、Scope、依存、判断およびOwner Link | 読取りのみ。欠落や構造不正を空計画へ畳まず、Roadmapにない値を推測しない |
| Quality | `07_Quality/01_Quality_Center.md` | 全体状態、対象、観測済み／未観測、Gap、次Gate、人間判断およびOwner Link | 読取りのみ。未観測をPassへ、進行中AuditをReadyへ畳まない |
| Repository AI設定管理 | 五役割既定値、分類・上書き、期待内容Identity | saved／conflict／blocked／unknown、成功時Snapshot | [共有のAI選定の認可](#repository別ai選択設定への接続候補--2026-10-24)に従い、本人のGitホスト権限を照合する。保存時は短命管理セッションも必要。Host Catalog・Profile CRUD・MCP設定管理は持たない |
| Connection | Endpoint、Credential | Session、現在認可されたProjection、接続状態 | Remote時だけ。非開示対象を推測しない |
| Remote Topic／Meeting | 現在Portfolioで選択したRepository ID、一覧条件、Identity、期待Revision、操作入力 | 一覧、詳細、Relation Owner、書込み結果 | RequestごとにMCPへ明示Repositoryを渡す。PortfolioにないIDを拒否し、Remote失敗時にLocalへfallbackしない |

### 6.1. 通常鍵操作の表示・結果搬送

この節は旧接続鍵方式の設計履歴であり、現行の公開契約ではない。WorkbenchとServerは鍵の発行・失効・交換をHTTPで受け付けない。共有の管理操作は[通常管理](#62-通常管理の入力結果搬送)から行う。旧管理状態の自動変換や鍵の再提示は行わない。

意味の正本は[Access Management詳細](../access-management/01_Architecture.md)である。Workbenchは同一Processの人間向け入力・表示と結果搬送だけを所有し、資格Store、認可、交換Recoveryを複製しない。Workbenchに別Process接続を持たない。独立MCPのBearer認証はMCP Serverが所有し、鍵操作を公開しない。

| 操作 | 処置前の対象・条件 | 結果と禁止する読み替え |
|---|---|---|
| 通常発行 | 現行administrator、既存userId | 新Secretを一回だけ表示。旧資格の失効0、交換Recovery0。表示名は認証根拠にしない |
| 独立失効 | 現行administrator、exact資格IdentityとuserIdの結合 | 指定資格だけを処置。他の資格への拡張0、発行0、Secret0、交換再入場0 |
| 指定ユーザー交換 | 現行administrator、既存対象userId・表示名、旧資格全体の失効範囲と既存発行先を処置前表示 | 同じユーザーへ一回発行。他ユーザーを保持。通常入口では追加確認Gateを要求しない |
| 全ユーザー交換 | 現行administrator、操作主体を含む失効範囲と指定した既存administrator発行先を処置前表示し、明示確認 | 全旧資格を失効、指定発行先へ一回発行。他ユーザーの再発行は通常管理で行う |

Hostの交換2操作はWorkbench Backendで実行せず、信頼したログイン済み操作者の対話CLIとして別入口へ案内する。追加認証・昇格・確認コードを設けず、既存Root／Path検証を維持する。交換の入口2種×操作2種の全4組で対象・影響を表示し、Hostの2組と全ユーザー交換の通常入口の計3組だけ明示確認する。この確認契約を通常発行・独立失効へ拡張しない。初回Host設定は通常交換とは別契約で、以下の案内境界へ接続する。

交換ではAccess Managementが旧失効前から同じexact Recovery IDへ結合する。失効・新発行・結果記録・提示結果を別事実として表示し、後段失敗だけで確認済み発行をunknownへ戻さない。通常の秘密は用途限定・短命なbackend応答から操作administrator画面へ一度だけ提示し、追加受領ボタンを設けない。対象本人への安全な引渡し・受領は製品外で観測しない。Secretの保存・再送・再表示、一般MCP／DTO・一覧・履歴・Log・Evidenceへの公開は0。次の3分岐を表示し、通常発行／独立失効に交換Recoveryを付与しない。

| 現在確認できる状態 | Workbenchの表示・導線 | 禁止する表示・操作 |
|---|---|---|
| 発行または非秘密結果記録が不明 | Credential IDとは別の非秘密な元発行Identityと既知事実に基づく現在再観測へ案内。交換由来だけ元のexact Recoveryを維持 | 成功／rollbackへの丸め、新交換の開始、通常発行への交換Recovery追加 |
| 発行・結果記録確定、提示・引渡し未確認 | 「発行済み・受け渡し未確認」と表示。本人受領は観測外。現在許可されたadministratorが既存指定／全員交換を明示選択する。新交換は別Operation／別Recoveryで、各交換内だけ同じexact Recovery | 確定未受領の断定、確定発行の不明化、秘密再表示・自動再発行、別交換成功を旧受領・rollback・取消完了と表示 |
| 現在administratorとして接続できない | 既存ログイン済みHostの交換2操作へ案内 | Workbench認可迂回、Hostへの通常発行・独立失効・追加認証の追加 |

別交換では現在対象・認可と4組の事前表示／3組の確認を再適用する。指定交換は先の鍵を含む対象ユーザーの全旧有効資格→同じ既存userIdへ一資格、他ユーザー保持。全員交換は先の鍵を含む全旧有効資格→指定既存administratorへ一資格、他ユーザーは通常再発行・再配布となる。旧元発行Identityと確定事実はAMが保持し、Workbenchは旧処理との相関を失わない。遅延した旧応答の失効済み鍵を利用可能と表示しない。

未知対象、必要な既存administratorの不存在、認可破損または安全な観測不能は処置前に停止する。userId／username／Role／Role詳細権限／Repository登録／Product Dataは交換で変更しない。資格状態は旧失効・新発行によって変わる。管理者であることから内容参照を許可せず、他ユーザー情報の表示も現在の参照許可に従う。ユーザー・Role内容設定・Repository登録／Exposureの管理はARCH-000013の9 Role分担行に従い、Role内容設定から管理権限を生成しない。Repository AI設定管理はmanager／administratorと選択Repositoryのdevelopment認可へ接続する。資格管理と内容許可は別契約のまま維持し、実認証・人間操作確認は後続Gateとする。

論理初回接続とv2目標SchemaはAM保存設計へ具体化済み。具体画面配置、公開API・結果Field、提示観測の実装／実境界・移行・本番接続は未成立。SCR-000008／BHV-000012／`PRT-000008.spec-000012`への接続はPartialである。Qualityは通常発行の失効0・Recovery0、独立失効の対象限定・発行0、交換4組表示／3組確認、鍵3分岐、元Identityと別交換の区別、MCP鍵操作0、Secret再表示0、遅延失効鍵の利用案内0、後段失敗時の既知事実保持をIT／STで導出する。ここでQA Local Item IDを推測して発行しない。旧伝播候補の限定Passは履歴。今回の最小提示方式の差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）で、QA実行済みではない。

#### 6.1.1. 同Process管理POSTの具体契約

管理依存は構成ごとに分離する。Standaloneの限定内部DIは信頼済み構成の検証済みAM Root／Bearerを使用する。Local CROSは内部構成のAM Rootと、当該要求の単一Authorization HeaderのBearerを使用し、要求外のログイン鍵として保持しない。両構成および旧Remote接続の混在を拒否する。AM保存RootはBrowser入力から取得しない。Repository登録の対象Rootは別の明示操作入力であり、管理認可と対象Root／manifest検証を必要とする。一覧と各操作で現在認証・認可を取り直し、一覧の操作表示を実行許可として再利用しない。

| 境界 | 具体契約 |
|---|---|
| 非秘密一覧 | AMの同改訂SnapshotからユーザーのID・表示名・Role、資格のID・元発行ID・失効・提示状態、現在交換相関だけを投影する。秘密・Verifier・Salt・内部Rootは返さない |
| 鍵管理の受付 | Google設定時は短命管理セッションで `GET /api/credentials`、発行 `POST /api/users/{userId}/credentials`、失効 `DELETE /api/credentials/{credentialId}`、指定交換 `POST /api/users/{userId}/credential-exchange`、全員交換 `POST /api/credential-exchange` を利用する。書込みは同一Originの閉じたJSON・操作トークン・現在改訂・操作別の対象を要求する。旧接続鍵によるフォームと汎用画面からの資格一覧は無効。Google未設定時は既存のフォーム受付を維持する |
| 鍵提示 | 保存と`unconfirmed`記録の後、`no-store`の専用JSON一応答へ鍵を入れる。応答の`presenting`は出力開始の結果で、本人受領・提示確認・交換完了ではない。汎用`/api/workbench/view`へ鍵や直前の鍵応答を保持しない |
| 提示後 | 所有Responseの全byteの`finish`と先行故障なしを確認してから、元発行相関の`confirmed`を別保存する。HTTP終了はBrowser描画・コピー・本人受領の証明ではない。切断・取消・故障では確認や交換終了を進めず、自動再送しない |
| 交換終了 | Google設定時は開始時の同じ管理セッションを使い、新しい鍵を認可に流用しない。確認済みの前回記録を閉じるときは回復ID・発行先・交換範囲を照合し、新たに発行しない。Google未設定時の本人指定交換・全員交換は当該要求で発行した鍵を短命に使う。どちらも現在の管理権限・改訂・交換相関・提示確認を再評価し、失効・変更・不明なら記録を保持する。Host終了入口への迂回は行わない |
| Server終了 | 開始した管理要求と提示後処置を終了待機へ含める。画面用応答の任意保存を終了条件に追加しない。秘密は当該要求の短命値として解放し、新しいSession／Receipt／Recovery Storeを作らない |

旧CROS管理依存・Form・Client Modelの資格部分は、新Serverと同時配布するCSRへ一斉切替する内部契約変更である。旧形式の互換受付・秘密再取得は設けない。本人交換・全交換で接続に使用した旧鍵が失効した場合は、新しい鍵での明示接続が必要であり、応答成功から旧接続の継続を表示しない。

同Process注入による接続は、局所HTTPの出力／後処置故障と、実Browserの通常発行・本人交換・全交換の短命表示・消去・再読込・旧接続失効まで評価済みである。この限定範囲の独立再レビューは残指摘0。公開Launcher、通常接続切替および正式Local Item評価は未完了であり、Workbench資格管理全体の完成を主張しない。

### 6.2. 通常管理の入力・結果搬送

Workbenchは[Access Management詳細§4](../access-management/01_Architecture.md#4-通常管理と独立失効)へ次の操作を委譲する。表示上の操作可否はAuthorityではなく、実行時にAMが変更前の現在管理認可・対象・期待改訂を確認する。Standalone／CROS／共有Host配置のすべてで同ProcessのAMへ直接接続する。Browser向けHTTPを残し、Workbenchの管理処理はMCP ClientやMCP Serverを必要としない。

| 操作 | 入力・対象制約 | 表示する結果・保持条件 |
|---|---|---|
| ユーザー登録 | 予定Role・表示名。managerはdeveloper／manager、administratorは三Role | 新userIdと保存・読戻し結果。既存ID・変更前Roleを要求しない。資格発行は別操作 |
| 表示名変更 | 既存userId・新表示名。manager／administratorが操作し、administratorの名前もmanagerが変更可 | 名前だけの変更結果。ID・Role・Credential保持 |
| 既存Role変更 | 既存userId・前後Role。managerは両方developer／managerのみ | 現行Roleと保存・読戻し結果。administratorの付与・解除・降格はadministratorのみ |
| Role内容設定 | 対象Role・変更内容。developer／managerはmanager／administrator、administratorはadministratorのみ | 内容設定の変更結果。固定管理分担のON／OFF・再委譲なし |
| Repository登録・解除 | 対象ID・現在登録／Exposure状態・変更内容。manager／administrator | 登録結果≠公開／取得。解除は同じ受理操作・採用改訂で登録と対応Exposureを除去し、両読戻し確認時だけ完了と表示。対象外登録・ExposureとRepository本体・Product Dataを保持。解除完了≠開始済み操作の取消・過去Effect0・実資源終了 |
| Exposure設定 | 対象ID・現在登録／公開状態・変更内容。manager／administrator | 明示公開設定の保存結果≠内容取得成功 |

manager自身の内容範囲変更も、変更前の管理認可→明示更新→次要求の現在Role・Exposure・実アクセス再評価の順を表示する。manager正常管理にadministrator存在条件を要求せず、管理拒否を自身表示・許可内容の拒否へ広げない。未知対象・必要状態不明・競合は新Effect前停止。保存後の読戻し／応答不明は既知更新と未確定範囲を分け、未保存・rollback・Effect0・完了を推定せず、交換Recoveryを追加しない。

Qualityは9 Role分担行×三Role、操作別入力、managerのadministrator名前だけ変更、自己内容変更の時間順、登録／公開、解除の両読戻し・対象外／本体保持・取消非証明、管理≠内容、保存後不明の禁止推定を既存AM導出キーへ接続する。片側除去・読戻し不明の完了表示を反証する。管理画面・HTTP・AM保存への局所接続は次節で具体化する。公開Launcher・共有公開配置・正式評価はOPENであり、局所接続を全体完成へ昇格しない。

#### 6.2.1. 非鍵管理の接続候補

現行の共有Workbenchは、現在の本人、利用者一覧、登録済みリポジトリ一覧をそれぞれ取得する。管理書込みは管理セッションで受け付ける。通常三Role本人はAM `readCurrentAccess`の直接呼出しで取得し、管理一覧から名前・Roleを推定しない。独立MCP Surfaceの同Toolは別の利用側であり、Workbenchが呼ぶ入口ではない。AM内部managementOperationsをSurface提供済みの能力へ変換しない。管理read・保存の非秘密結果はAM共通投影を使い、Browserで閉shapeを検査する。新しい管理Store／結果mapper／Role規則を追加しない。

状態: 管理の直接接続候補。画面とPOSTは既存AMの四read＋七保存へ接続済みで、Workbench独自の管理Store・Role判定・結果契約を作らない。Standaloneの信頼済み内部DIとCROSの要求専用Bearerを分離する。Repository登録はWorkbenchの明示操作だけであり、共有利用ではサーバー上の対象Rootを指定する。MCPの管理Toolは[独立MCP Surfaceの契約](../mcp-server/01_Architecture.md#331-非鍵管理toolの具体化候補)として維持し、Workbenchの依存としない。全内容・公開Launcher・共有TLS・正式評価の完成は別Gateである。

画面は利用者一覧と登録リポジトリ一覧を別の改訂付きで保持する。本人名は現在接続している本人の投影を使い、管理一覧をdeveloperへ開示しない。二つの読取りが異なる改訂なら同じスナップショットとは扱わず、各保存フォームが利用した投影の改訂を `expectedRevision` に渡す。保存後は現在値を取り直し、競合・応答喪失で自動再送しない。画面に操作を表示するだけで認可は成立せず、AMが要求ごとに確認する。

七保存操作は操作別の閉POST入力から同じAM入口へ一回だけ接続する。Origin／Host／Content-Type／要求容量／同画面のAction Tokenを既存Server境界で確認し、開始前取消は保存0、開始後は同期保存終了を待って応答を処置する。入力Tokenは資格を含めず、管理RootやBearerをBrowserのフォーム・JSONへ渡さない。登録Rootを指定する際は「サーバー上のRepositoryフォルダ」と表示し、BrowserのローカルPathとの違いを説明する。

保存確認済み、拒否、保存結果未確認、保存確認後の清掃未確認を区別して表示する。既知出版を「変更なし」へ丸めず、解除成功からRepository本体削除・旧Task終了を推定しない。更新したRole内容やExposureの実利用可否は次要求の現在認可で確認する。管理結果・改訂を表示しても秘密・Binding・内部Path・Lock回復参照を追加しない。通常の説明Responseは表示用であり、新たな受領ACKや永続配送Stateを要求しない。

非鍵管理の公開結果形式は[Access Managementの保存とAPI](../access-management/02_Management_State_and_API.md)が所有する共通投影の閉Unionと固定失敗分類を使う。Workbenchで別の保存結果型や自由文字列理由を定義せず、直接AM利用時も同じ公開投影へ変換する。先行材料処置と新出版準備、既知出版後のLock終了不明を区別し、非公開secondaryを推測しない。

### 6.3. 初回Host設定の案内

最初の管理者は、Serverを動かす端末で `crdd-server --initialize` を明示実行し、外部ログインで確認した本人を登録する。既存管理者がログインできなくなった場合は、同じ端末で対象を指定して `crdd-server --link-admin` を使う。引数・事前設定・確認の手順は[共有Serverの利用手順](../../../19_Workflows/04_MCP_Server.md)を正本とする。

WorkbenchとMCPは管理者の初期登録・再紐付けを実行せず、旧接続鍵の入力や提示も行わない。接続の失敗を未初期化と推定せず、安全な初期化可否はHost管理CLIとアクセス管理の保存操作で判定する。旧鍵方式の経緯は[切替計画](../../../99_Roadmap/Changes/CHG-000082/google-management-session-plan.md)に記録する。

## 7. Visualと公式素材

- Visual Baselineは[Direction A](../../../04_UI/Details/Visual/workbench-hero/visual-baseline.md)を使用する。
- FontはNoto Sans CJKを基準とし、存在しないWeightの合成を無効にする。
- 左上のApplication Brandには`crdd-brand-icon-512x512.jpg`を表示する。
- Assetが取得不能な場合は、壊れた画像のまま成功表示せず、Brand Asset failureを診断可能にする。類似アイコンを自動生成しない。
- 320〜1920 CSS pxと100%／200%／400% Browser Zoomの評価契約をProductionへ継承する。
- 汎用Web ProductとしてDesktop、Tablet、Mobile相当Profileをすべて評価する。全Profile Passを必須にせず、人間が理由付きで許容した不適合を明示する。

## 8. FailureとRecovery

Topic／Meetingの書込みは、HTTPメソッドとURLの対象を固定し、同一Originと閉じたJSONを要求する。固定ID・期待改訂・操作別参照とDocument Modelの公開解析によるMarkdown検証を配送前に行う。入力不正は400 `invalid_request`、異なるOriginは403、対象が利用できない場合は404とする。作成のURLへ記録IDを含めず、期待改訂は要求しない。`owner`／`none`の参照へID制約を追加しない。

確定した書込みは作成201、その他200、確定した拒否は409で返す。保存先の故障や、保存を開始した後に結果を確認できない場合は503とし、出力から巻戻しや未保存を推定しない。取消済みの要求へ成功本文を返さない。`QA-000005`の`CPR-IT-012`で故障分類、`CPR-IT-010`で正常操作・競合・削除確認を検証する。例外本文・Path・秘密は公開しない。

| Failure | 保持するもの | 禁止 | Recovery |
|---|---|---|---|
| Projection partial／unavailable | 観測済み範囲、Source、Coverage | 完全状態への畳込み | 再投影、Owner Artifactへ移動 |
| HTTP request切断 | Request Identity、Effect発行状態 | 結果不明の暗黙再送 | 状態再確認、安全な再入場 |
| Topic／Meeting conflict | 入力、対象Identity、比較可能な差 | 最新値への無断上書き | 再読込、差分確認、取消 |
| Remote Repository未選択／現在認可範囲外 | Remote接続状態と認可済み集合からのDomain Model投影 | Local Repositoryの代替表示、ID知識によるAuthority生成、対象存在の推測 | Access Managementの現在認可を再評価し、許可済みPortfolioから明示選択 |
| Git観測不能 | Project Context、最後に確認したRevision | 空TreeやClean扱い | Repository再観測、外部Git Client |
| Push結果不明 | Remote、Branch、Commit、相関情報 | 自動再Push、Force Push | Remote状態の再確認 |
| AI Provider失敗 | 確認済み事実、保存済み分析、依頼種別、入力 | 推論を事実化、読取り助言を変更候補へ読み替える、候補を採用 | 同じIdentityと依頼種別で再観測、別の明示選択／Repository設定、元Screen |
| AI候補のRevision／Scope競合 | Candidate ID、安全な確認Metadata、現在Revision、dirty Path、操作結果 | 古い候補の自動採用、確認済み範囲外の変更、暗黙再試行 | 候補を再生成するか、現在Repositoryとの差を確認して明示操作へ戻る |
| Runtime状態未接続／観測不能 | Project Contextと観測理由 | Objective 0件、完了または直前値への畳込み | State Query Adapter接続、再観測 |
| Owner Artifact欠落／越境／観測不明 | Project ContextとCatalog観測理由 | 部分Catalog公開、任意Path探索 | Catalog全体をunknownとしOwner側を確認する |
| Logo／CSS取得失敗 | Application request状態 | 代替Brandの創作 | Asset経路診断、再取得 |
| React Client Bundle欠落／不一致 | Server起動前のBuild結果 | HTMLだけを完全なReact移行として表示、任意Asset配信 | Vite Buildを再実行し、固定Assetの存在とHTTP契約を再確認 |
| JSON Read Model取得失敗／不正 | 固定Document Shellと取得失敗理由 | 空画面、直前値またはBrowser推測での補完 | 同じRoute条件で再取得し、Server側Owner Artifact／Adapterを診断する |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Repository単体、Local CROS、Remote CROSの具象差がある。 | Consumer PortとMode別Adapter | Modeは意味・Authorityを変更しない。 | 新Mode追加時は全ScreenとDisclosureを再評価する。 | `workbench.mode-variation` |
| Common Contract | Required | 複数入口で同じView StateとInteraction Resultを使う。 | 共通View Model／Result Contract | Surface固有語彙をDomain結果へ逆流させない。 | 契約変更は全Adapterと画面へ波及する。 | `workbench.component-boundary`<br>`workbench.view-state` |
| Creation／Selection | Required | Project、Mode、Connection、作業分類と任意の明示AI選択を扱う。 | Selection Service／Screen Context | 利用不能対象を暗黙選択しない。 | 選択規則変更はNavigationとAuthorityへ波及する。 | `workbench.mode-variation` |
| State-dependent Behavior | Required | loading、partial、unknown、Effect前後で許可操作が異なる。 | View State Machine／Interaction State | unknown時に成功や再実行を既定にしない。 | 状態追加は全Screenと試験へ波及する。 | `workbench.view-state`<br>`workbench.interaction-sequence` |
| Composition／Recursion | Required | 15 Screenと反復PartからProduct固有Patternを発見する。 | React Shell、SCR／PRT Composition、後段CMP昇格 | Heroを先に抽象化せず反復根拠から昇格する。Server FragmentをComponent境界として持たず、Browser ReactがCompositionを所有する。 | React ComponentまたはCMP追加時はScreen Coverageを再評価する。 | `workbench.screen-composition` |
| Lifecycle Ownership | Required | Server、request、session、child processを所有する。 | Runtime Owner／Shutdown Coordinator | 終了後に所有資源を残さない。 | lifecycle変更はIT／STへ波及する。 | `workbench.resource-flow` |
| External Boundary | Required | Git、Remote CROS、AI Provider、Filesystemを扱う。 | 境界別Port／Adapter | 一境界の成功を他境界へ流用しない。 | 境界追加はAuthorityとE2Eへ波及する。 | `workbench.interface-boundary`<br>`workbench.failure-recovery` |

## 10. Reality Audit

次表は移管前の旧経路と成立済みCapabilityを照合する歴史的比較入力である。旧Remote／systemAdmin／Shared ServerのCoveredを現行構成や新版の検証根拠へ使用しない。現行Owner・直接接続と未完了範囲は冒頭の契約とCHG-000082の現在計画で確認する。全体の現在評価は⑥で再生成する。

この表と冒頭のQuality観測表は旧配置の履歴として保持し、新しいユーザー／現在Role／鍵入口の合格根拠にはしない。再編後の同一Process CROS呼出し／Remote MCPへの置換は未実装であり、旧REST／Gatewayの`Covered`を新経路へ引き継がない。新配置の公開Graph、設定Reader、全操作と終了実測を段階6／7で再確認する。

| 対象 | 現在状態 | 分類 | 処置 |
|---|---|---|---|
| Production Workbench package | `workbench-ui` にClient-side React Application ShellとVite Browser Build、`crdd-server` にlocalhost Node Server、固定Document Shell、用途限定Token以外の秘密・Authorityを含まないJSON Read Model、Project Surface、Repository Work、Topic／Meeting CRUDとMeeting Outcome処置、Credential管理Surface、Remote接続入力、Portfolioの検索・状態絞込み・Query拘束継続読込・Project別Source表示、Owner分離したRepository／CROS AI Profile管理、選択Profile IDと依頼種別付きの現在Session AI依頼Port、変更候補の確認・採用・破棄SurfaceおよびRuntime Activity Portが存在する。全画面DOMはBrowser側React Componentだけが所有し、Node Serverは認証・Authority・Repository Effect・JSON生成・固定Asset配信だけを所有する。SSR、Hydration、Raw HTML FragmentおよびDOM再読取りは存在しない。Repository単体CompositionはCoordinatorの単発Task受付から、助言を固定Context専用Runtimeへ、編集を借用WorkspaceのSingle Taskへ接続する。通常実行に署名は要求しない。旧Bundle採用入口は撤去し、Candidate固定・Merge・採用は既存Workspace管理で別操作とする。Task完了でCommit／Pushは行わない | Partial | CSRの型・Lint・Build、HTTP／JSON契約試験、15画面の実Browser Visual再確認および独立レビューは成立した。残るCodex／Claudeの実Provider E2Eを閉じるまで全体完了へ昇格しない |
| Runtime Activity | Repository単体では現在RevisionとProject IDを既存Coordinator State QueryおよびExecution Intelligence Storeへ接続する。Remote CROSではRequestごとにCredentialとExposureを再検証し、許可済みRepositoryだけをRuntime Activity Readerへ渡す。現在状態とEvent観測不能を独立表示し、Project限定Eventを新しい順・Cursor付きで継続読込する | Covered | Repository EventのProject分離・順序・Continuation、Remote CROSのGrant分離、Credential失効後の直前値非表示を結合試験で確認した。Runtime正本、Event正本またはRecovery AuthorityはWorkbenchへ移さない |
| Project Plan | 固定Current Release Projectionを共通ReaderでVersion、期限、Risk、Scope、依存および判断へ変換し、Roadmap詳細と同じOwner Artifact Routeへ接続する | Covered | Projection構造を第二正本化せず、Roadmap／CHG更新時の同時更新契約を維持する |
| Quality | 固定Current Quality Projectionを共通Readerで状態、Coverage、Gap、次Gateおよび人間判断へ変換し、Quality Center原文へ接続する | Covered | Quality Center更新時のProjection整合を維持し、Evidence自体をWorkbenchへ複製しない |
| Documentation | Roadmap詳細とProject ContextのMarkdown Owner Relationを検証済みCatalogへし、title／PathのCatalog内検索、Project Context起点Section表示および原文Routeへ接続する | Covered | Current Projectionは一段Relationだけを扱い、再帰展開はしない。欠落・越境・観測失敗はCatalog全体をunknownとして部分成功へ畳まない |
| Direction A HTML／CSS／PNG | UI DetailのVisual Fixture | Design Evidence | Production Sourceへ丸ごと移植せず、Visual BaselineとCompositionを実装入力にする |
| CROS Application Contract | Portfolio Federation、Credential管理、Bearer Remote Portfolio、`systemAdmin`限定AI Profile管理およびWorkbench接続／更新／切断を接続済み。許可済みPortfolio内だけを検索・状態絞込み・Query拘束Cursorで継続読込し、選択ProjectはRepository Sourceごとの五場面を欠測のまま表示する。Shared ServerはREST／MCP同一HTTPS Origin、固定OS設定、外部TLS終端契約および終了後Listener 0まで接続済み | Covered | N/A: 公開証明書の運用は配置先のTLS終端が所有する |
| Project Operation | Project ContextとTopic／Meeting共通ApplicationをWorkbenchへ接続し、検索、状態・Owner・期間・Relation・未処置Outcomeによる絞込み、安定並び順、Query拘束Cursor、独立Detail、取得本文、登録、編集、Relation影響付き削除、Outcome全件処置後のMeeting Close、実在CHGへのTopic昇格接続、同一Repository内のTopic／Meeting／CHG Relation遷移、および同じSessionとExposure Snapshotに限定したRepository間Owner Relation解決を提供する。Relationを別Repository書込みAuthorityにはしない | Covered | Repository間Owner解決、曖昧・未許可・欠落時の安全な停止、およびRemote Workbenchからの明示Source選択を結合試験で確認済み |
| Version Control | Directory単位の遅延Tree、Query拘束Continuation、選択FileのPrepared／Working Diffと切詰め表示、Stage／Unstage／Commit／確認済み通常Pushを公開PortとGit Adapterへ接続済み | Covered | 未追跡File内容を暗黙読取りせず、Force／暗黙再送を追加しない |
| Official Logo | `04_UI/assets/brand`の承認済み画像をProduction Shellが配信する | Covered | 同じAsset Identityを維持する |
| Desktop wrapper | 存在しない | N/A | 現在の成果に不要。OS統合要求が発生した時だけ再評価する |

## 11. Quality引渡しの要約

- localhostだけにbindし、任意Interfaceへ公開しない。
- 公開入口から公式ロゴを含むDirection A Shellを表示できる。
- Node Serverが固定Document Shellと用途限定Token以外の秘密・Authorityを含まないJSON Read Modelを同一Originで返し、Vite Bundleから起動したClient-side Reactだけが全画面DOMを生成する。Action Tokenは認証・業務Authorityを単独で付与せず、Credential生Tokenは明示管理操作直後の最初のJSON応答だけで一回表示する。
- Local／Remoteの入口差でApplication意味、状態語彙、失敗分類を変えない。
- 欠測、非開示、部分成功、結果不明を完全・空・失敗へ畳まない。
- Effectを伴う操作ではAuthority、要求、受理、Effect、結果、終了後状態を分ける。
- 320〜1920 CSS px、100%／200%／400% Zoom、Keyboard順、文字下限、操作対象、ContrastをProduction DOMで評価する。
- shutdown後にlistener、request、child process、一時AssetまたはCredentialが残らない。

最新ARCH-000013の境界伝播は設計候補であり、論理Owner・限定Protocol・v2目標SchemaはAM保存設計へ具体化済み。具体API・保存実装・提示実境界・移行・Quality導出と本番接続はOPEN。以下の既存Checklist評価を新構成の全体完了へ流用しない。

Checklist評価根拠: Remote MCP公開Schema、Local内部呼出し、Browser APIのConsumer対応を具体化した。Component、Interface、Data／StateおよびSequenceの設計を本番実接続と区別した。 QA-000001／004／007／009の追加観測条件へ操作・接続世代・失効・応答喪失・終了の義務を渡した。旧Gatewayと新MCP経路の実績を混同せず、新構成の実境界は未評価である。

最新固定8分担の限定独立レビューは当時の範囲だけに適用する。登録解除と鍵3分岐の詳細伝播は候補反映・今回の契約・品質の限定独立レビュー済み・残指摘0である。旧観測・Checklistは当時の限定範囲を維持し、Quality・Source・本番接続・実境界の完成根拠へ流用しない。

| 現行対応表 | 担当Source Definition | 担当Detail | 状態 | 戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000013、ARCH-000017 | SCR-000008／PRT-000008／BHV-000012と公式素材の表示・文書参照断面（専用記録機能は要求しない） | Partial | 意味変更はUI-000008／SPEC-000012へ、配置変更はARCH-000013へ戻す |

担当Interaction Relation: `PRT-000008.spec-000012`、`PRT-000019.spec-000024`

公式素材のPRT-000019.spec-000024は表示・導線の担当だけを接続する。由来・権利・許可用途・判断者の記録は既存の素材文書と人間の判断が所有する。専用機能の実装待ちではない。Brand表示から権利確認済みと推定せず、未評価の表示・人間確認はPartialとして保持する。

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
