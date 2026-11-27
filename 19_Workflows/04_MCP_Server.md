# CRDD ServerとMCPの利用手順

状態: Candidate（v0.22.0の二Surface構成。全体検証は未完了）
担当責任者: Qual-Lab

## 目的と責務

本書は、CRDD配布物からWorkbench・HTTP API・MCPを起動し、共有利用の初期設定、利用者登録、ログインおよび復旧を行う手順を所有する。通信・認可・終了の契約は[MCP Transportアーキテクチャ](../06_Architecture/Details/mcp-server/01_Architecture.md)を参照する。

MCPはCoordinatorのsubcommandではない。OrchestratorやPlatform Accessには独立した利用者向けProcess入口がないため、MCPと同じ形のWorkflowを機械的に追加しない。

## 公開入口

| 利用目的 | 公開入口 | 境界 |
|---|---|---|
| 単体Workbench・HTTP API | `node 00_CRDD/template/tools/crdd-server.ts [--port <port>] [--docs]` | HTTP APIとWorkbenchを `127.0.0.1` で提供。HTTPの `/mcp` は公開しない |
| 共有HTTP | `node 00_CRDD/template/tools/crdd-server.ts --shared [--port <port>]` | 同じ待受構成で現在の利用者と対象Repositoryの権限を要求ごとに確認 |
| 最初の管理者を設定 | `node 00_CRDD/template/tools/crdd-server.ts --initialize --provider google --port <固定ポート>` | Hostの対話端末で初期設定する。通常の共有Serverは別途起動する |
| 既存管理者の紐付け・復旧 | `node 00_CRDD/template/tools/crdd-server.ts --link-admin <管理者UUID> --provider google --port <固定ポート>` | 管理者を追加せず、指定した管理者を紐付ける |
| 単体stdio | `node 00_CRDD/template/tools/crdd-server.ts --mcp-stdio [--port <port>] [--docs]` | HTTP APIとWorkbenchを提供したまま、MCPだけstdioへ切替。HTTPの `/mcp` では処理しない |
| 利用方法 | `node 00_CRDD/template/tools/crdd-server.ts --help` | 待受を開始しない |

採用Repositoryでは、公式Release tagへ固定した完全な`00_CRDD` cloneまたはsubmoduleと、Serverの依存・Workbench UIの生成済み配布物を同じ版で用意する。公式Repository内の開発確認では `template/tools/crdd-server.ts` を使用する。ポートの省略または `0` で自動割当てする。stdio時は標準出力をMCP専用とし、起動URLと診断は標準エラーへ出す。stdin EOFまたは終了シグナルでMCPとHTTPの所有資源を閉じる。

自作パッケージの依存は同じチェックアウトへのローカルリンクであり、外部レジストリの同名パッケージへ置換しない。新しいチェックアウトでの初回導入では、`40_Develop/` 配下でパッケージの各 `package-lock.json` を使い、依存先と利用側の両方で `npm ci --install-links=false` を実行する。Serverだけの導入では推移依存先のリンクは揃わない。

パッケージから起動する場合も `@qual-lab/crdd-server/cli` が指す既存binを使う。ルートはTypeScriptの応答型専用で、ServerのHTTP・MCPを利用する場合は起動後の通信入口へ接続する。旧パッケージサブパス `./api`・`./mcp` の撤去は、HTTPの `/api/...` やMCPの `/mcp` を廃止するものではない。

Serverの準備には `lock`、`ai-adapter`、`version-control`、`configuration-model`、`document-model`、`execution-model`、`execution-intelligence`、`docker-isolation`、`executor`、`access-management`、`coordinator`、`crdd-server` を含める。Workbenchのビルド・試験を行う場合は `visual-preview` と `workbench-ui` も対象にする。固定チェックアウトを指す `template/tools/crdd-server.ts` の起動先は変えない。

単体は信頼できる個人PC向けで、同じPC上の別ユーザーを分離する保証はない。単体では `--mcp-stdio`、共有ではOAuthで認証するHTTPをMCPの入口とする。どちらもObjective実行・判断送信・実行状態照会は通常のToolとして利用できる。単体は起動Repository、共有は指定した `repositoryId` と開発権限に結び付ける。起動や一覧取得だけで実行Ownerを開始しない。旧MCP単独コマンド・旧フラグの互換入口は設けない。

## 共有モードの初期設定と起動

MCPとWorkbenchは独立した公開契約であり、一つの待受でも資格・認可を相互代用しない。明示 `--shared` は既存Hostのアクセス管理を使い、設定ファイルの存在で自動切替しない。最初の管理者はHost端末で設定し、利用者、管理ロール、リポジトリの登録はWorkbenchで管理する。MCPのアクセス管理は本人照会・利用者一覧・登録リポジトリ一覧のうち現在権限で許されたものだけを公開する。アクセス管理の書込みはMCPから行えない。

1. **初回だけ**、Serverを運用するOSユーザーの対話端末で `CROS_TRUST_DOMAIN_ID` とOS標準の保存先が使えることを確認し、[Googleで初回設定・復旧](#google-host-setup)に従って最初の管理者を設定する。現行の保存形式で既存管理者の紐付けを直す場合は `--link-admin` を使う。旧保存形式の自動変換や再初期化は行わない。初期設定が途中、または現在の管理者にGoogleの紐付けが一件もない場合、共有Serverは起動しない。
2. [共有OAuthの起動設定](#shared-oauth-startup)を揃え、起動リポジトリで、同じOSユーザーと `CROS_TRUST_DOMAIN_ID` を使い、`node 00_CRDD/template/tools/crdd-server.ts --shared --port <port>` を実行する。公式Repository内の確認ではコマンドの `00_CRDD/` を省く。初期設定済みのHostを再起動するときは、この手順から始める。
3. 初回管理者は起動URLをブラウザーで開き、「Googleでログイン」から紐付けたアカウントでログインする。初期設定の状態が不明なら、表示された状態を確認し、保存物を消す・上書きする・初期化し直す操作は行わない。

共有時は公開Originの両設定を同じ値にするか、両方とも省略する。違う値や一方だけの指定では起動しない。`--shared` は `--docs`・`--mcp-stdio` と併用できない。どのモードもLANやインターネットに直接公開しない。

<a id="shared-oauth-startup"></a>

### 共有OAuthとGitホストの起動設定

同じアクセス管理の保存領域では、ポート番号を変えても共有Serverを二重起動できない。`shared_server_lock_occupied` なら先に起動した共有Serverを正常終了させる。異常終了後などにロックが残った場合は自動回収しない。稼働中のServerや終了処理が残っていないことを運用担当者が確認するまで、再起動や手動削除を進めない。

共有の公開入口では、リバースプロキシで `/oauth/authorize`、`/oauth/token`、Provider別のログイン・招待開始（v0.22では `POST /api/session/login/google` と `POST /api/session/login/google/invitation`）、MCP同意画面からのログイン開始（`POST /api/session/mcp/:interactionId`）の要求頻度を制限する。たとえば nginx の `limit_req` を使い、通常のログインやトークン更新を妨げない上限を利用状況に合わせる。接続元で制限する場合は、クライアントが自由に指定できる転送ヘッダーを接続元の根拠にしない。CRDD Server自体にはIP別のレート制限がないため、プロキシで制限しなければ、大量の未認証要求でログインや接続許可のやり直しが起き得る。

GitHub Appは、組織が所有する非公開AppをServerごとに一つ登録する。本番用と試験用は分け、対象リポジトリに限ってインストールする。Callback URLには、利用するServerの公開Originと `/api/session/git/github/callback` を組み合わせたURLを登録する。Webhookは無効でよく、その受信のためにServerを外部公開する必要はない。[GitHub Appの登録手順](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)を参照する。

開始済み実行の権限監視用にServerが取得するインストールトークンは、対象リポジトリの `Metadata: Read` に限定する。これは本人の権限を照会するための最小権限で、コンテンツの操作権限ではない。対話的な内容操作には別に本人の実効権限と、GitHub App側の対応する `Contents` 権限（読み取り、または読み書き）が必要になる。[GitHubのリポジトリ権限照会API](https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user)を参照する。

共有起動で有効にするログイン提供元は、起動環境の `CRDD_LOGIN_PROVIDERS` にJSON配列で指定する。v0.22は `["google"]` のみ対応する。未指定・空・重複・未対応は拒否する。Googleの `CRDD_GOOGLE_CLIENT_ID` と `CRDD_GOOGLE_CLIENT_SECRET`、登録クライアント一覧の `CRDD_MCP_OAUTH_CLIENTS`（`[{"id":"desktop","redirects":["http://127.0.0.1:18443/callback"]}]` 形式）、署名用RSA秘密鍵PEMの `CRDD_MCP_OAUTH_SIGNING_KEY` が必要。提供元の一覧と必要な設定はすべてHostの起動環境へ渡す。不足している場合は起動しない。Googleの戻り先には共有Originの `/api/session/login/google/callback` を登録する。公開Originを指定しないときは固定の `--port` が必要。例のクライアントIDと戻り先は実値に置き換える。Serverを再起動したら、MCPクライアントは接続許可をやり直す。

ログアウト時にブラウザーのセッションが切れている場合は、本人を確認できないためMCPの利用許可やGitホスト連携を解除しない。Workbenchで再ログインしてから、改めてログアウトする。

共有起動には、上記のログイン・OAuth設定に加え、`CRDD_GIT_HOSTS` にホストごとの設定をJSON配列で渡す。v0.22で指定できるのは `github.com`／`github` の組だけ。資格は配列に値ではなく環境変数名を記載する。

運用者は `CRDD_SHARED_REPOSITORY_ROOTS` に、共有してよい作業ツリーを置く既存ディレクトリの絶対パスをJSON配列で設定する（例: `["C:/CRDD/shared-repositories"]`）。Windowsではドライブ名を含む絶対パスかUNCパスを指定する。共有するリポジトリはこのディレクトリの配下に置く。未設定または不正な場合は共有Serverを起動せず、`shared_repository_roots_invalid` を表示する。既存登録でも、パスの実体が許可外なら内容は利用できない。登録やファイルは自動で移動・削除しない。単体モードではこの設定を使わない。

```json
[
  {
    "host": "github.com",
    "provider": "github",
    "providerData": {
      "clientIdEnv": "CRDD_GITHUB_CLIENT_ID",
      "clientSecretEnv": "CRDD_GITHUB_CLIENT_SECRET",
      "privateKeyEnv": "CRDD_GITHUB_APP_PRIVATE_KEY"
    }
  }
]
```

GitHub Appには共有Originの `/api/session/git/github/callback` を登録する。GitHub固有の環境変数名は `providerData` に置く。共有Objectiveを実行する場合は、指定した環境変数に同じGitHub AppのRSA秘密鍵をPEMで渡す。実行監視を使わない構成では `privateKeyEnv` を省略できる。その構成では共有Objectiveの開始・再開を許可しない。任意指定の `apiBase` はGitHubでは既定の `https://api.github.com` のみ受理する。資格用の環境変数名は `CRDD_GITHUB_` または `CRDD_GIT_HOST_` で始まる大文字に限る。未設定・空一覧・重複・未対応ホストを受け付けず、旧形式への読み替えは行わない。変更は再起動で反映する。Gitホスト一覧を `.crdd/config` や起動オプションへ重複設定せず、秘密をRepository設定・CLI引数・ログへ書かない。

公開HTTPS Originを指定する場合は、同じ値を起動リポジトリの`.crdd/config/mcp-server.json`と`.crdd/config/workbench-server.json`の両方へ設定する。ポートはCLI引数で指定する。[MCP設定例](../template/.crdd/config/mcp-server.example.json)と[Workbench設定例](../template/.crdd/config/workbench-server.example.json)は同じ例示用Originを使用し、実設定として自動採用しない。User・Credential・Binding・Exposureは既存Host管理状態が正本であり、手編集する`cros.json`や管理状態の設定例を別に作らない。保存境界と移行は[Access Management設計](../06_Architecture/Details/access-management/02_Management_State_and_API.md)を参照する。

外部TLS終端はClient由来のForwarded Headerを除去し、`x-forwarded-proto=https`と期待する`x-forwarded-host`を上書きし、公開Hostを保持する。内部Listenerへの直接到達を運用側で禁止する。MCPのProtocol公開Pathは`/mcp`だけで、旧REST同一Origin・Gateway health・HTTP入口のstdin EOF終了を維持しない。BearerやTLS秘密鍵をRepository設定・argv・logへ保存しない。旧設定の移行・清掃はフロントAIがOwner停止・明示対応・読戻しを確認して実施し、Runtimeに旧形式fallbackを追加しない。

<a id="google-host-setup"></a>

### Googleで初回設定・復旧

1. Host操作に使うGoogleクライアントに `http://127.0.0.1:<固定ポート>/api/session/host-admin/callback` を登録する。Hostの対話端末に `CRDD_GOOGLE_CLIENT_ID` と `CRDD_GOOGLE_CLIENT_SECRET` を設定する。この操作にはMCPのクライアント一覧・署名鍵は不要。
2. `crdd-server` を、新規Hostでは `--initialize`、初期設定済みHostでは対象の管理者UUIDを指定して `--link-admin` で実行する。どちらも `--provider google` と登録した固定ポートを指定し、`--shared`・`--mcp-stdio`・`--docs` とは併用しない。端末のURLを同じPCのブラウザーで開く。
3. Googleで本人確認したあと、画面に表示された8桁の確認コードをHost端末に入力する。初回設定では最初の管理者の表示名も入力する。既存管理者の再紐付けが確定すると、以前の紐付けによる接続は無効になる。
4. 設定完了後、通常の共有Serverは[共有OAuthとGitホストの起動設定](#shared-oauth-startup)を用意して別途起動する。Workbenchで「Googleでログイン」を選び、確認したGoogleアカウントで入る。

共有ServerのHTTP APIでは、ブラウザーでGoogleにログインした後のセッションを使う。同じ待受の `/mcp` には、そのMCP向けに発行されたOAuthトークンを渡す。

## 共有利用者の登録とログイン

1. Googleでログインした `manager` または `administrator` が「管理セッションを開始」を押し、Workbenchで**表示名・ロール・初回ログイン用メール**を入力して登録する。利用者ID（UUID）はCRDDが発行する。管理者ロールの付与は `administrator` に限り、利用者の自己登録は行わない。管理セッションは最長5分で、ログアウトすると終了する。
2. 発行された招待リンクを、登録したメールの本人へ安全な方法で渡す。リンクは24時間以内に一度だけ使える。利用者はリンクを開き、「招待を使ってGoogleでログイン」を押して、そのメールのGoogleアカウントで本人確認する。紐付け後は「Googleでログイン」だけを使う。共有MCPに接続するときは、利用するクライアントへの同意を別に行う。
3. 招待の発行結果が不明、リンクを紛失した、または期限が切れた場合は、「既存利用者の招待を再発行」で同じ利用者を選ぶ。再発行すると古い招待は無効になり、Googleと紐付け済みの利用者には上書き発行しない。使い終えたら、Workbenchの「Googleログインを終了」を押す。

表示名・管理ロールの変更、リポジトリの登録・登録解除はWorkbenchの「管理セッションを開始」から操作する。administratorの表示名変更と既存利用者の招待再発行はadministratorだけが行う。リポジトリの内容に対する権限は、CRDDの管理ロールではなくGitホストでの本人の実効権限で決まる。登録解除はCRDDからの利用を止め、リポジトリ本体は削除しない。保存結果が不明なら再送せず現在の一覧を取り直す。

一覧の取得後に管理状態が更新されていた場合、Workbenchは改訂競合（HTTP `409`）を表示して最新の一覧を取得する。その操作は保存されていない。内容を確認したうえで必要なら利用者が操作し直す。権限不足・対象不成立や保存結果不明は、改訂競合とは区別する。

GitHub連携を有効にした場合、Googleでログイン後にWorkbenchの「GitHubを連携」から、組織が発行済みのアカウントを選ぶ。CRDDはGitホスト側のアカウントを作らない。連携後は許可されたProjectの一覧からリポジトリを選ぶ。開発範囲がありGitHubでは読取りだけが許された場合、作業領域では受付一覧のみ利用できる。画面の「このセッションのGitHub連携を解除」はCRDD内の切断で、GitHub上のアプリ許可全体を取り消さない。MCPからGitHub連携の対象を読む場合は、連携した同じブラウザーでMCP接続を許可する。連携を解除またはやり直した場合、古いMCP接続には別の資格が引き継がれない。

共有モードでリポジトリを登録するには、管理担当者本人がGoogleでログインしてGitHubを連携し、「管理セッションを開始」から「共有リポジトリを登録」を使う。起動元ではなく、登録対象のServer上の絶対パスと、対象の設定にあるリポジトリIDを入力する。対象のローカルGit設定に単一のHTTPS `origin` が必要で、本人とGitHub Appの両方に登録先を読める権限がなければ登録しない。登録時にGitHubを照会するが、クローンや内容のアップロードは行わない。

Project一覧は `GET /api/projects` または `crdd.list_projects`、Project Contextの詳細は `GET /api/repositories/{repositoryId}/projects/{projectId}/context` または `crdd.get_project_context` から取得する。一覧の `repositoryIds` から、現在許可されている詳細の対象を選ぶ。単体の対象は起動リポジトリだけで、Manifestに対象を照合してから本文を読む。共有の詳細ツールには `repositoryId` と `projectId` の両方を渡す。同一Projectでも、詳細には指定リポジトリの情報だけを返す。共有モードでは対象への本人の読み取り権限と、GitHub固有の追加条件であるAppの権限を確認する。

Topic・Meetingの一覧と詳細には、同じRepository配下の `GET …/topics`、`GET …/topics/{topicId}`、`GET …/meetings`、`GET …/meetings/{meetingId}`、または対応する `crdd.list_topics`、`crdd.get_topic`、`crdd.list_meetings`、`crdd.get_meeting` を使う。共有MCPでは `repositoryId`、詳細には記録の `id` を指定する。単体MCPは起動リポジトリを使う。詳細に `relationScope: "repository"` がある場合、関連情報はそのリポジトリ内に限られ、同じProjectの別リポジトリを探索していない。

共有では両方の通信入口で、登録されたリポジトリに対する本人の現在の実効権限（読み取り／書き込み）をGitホストで確認する。GitHub Appの権限確認はGitHub固有の条件である。ローカルのHTTPS接続先も認可済みの外部リポジトリと一致させ、CRDDの管理ロールを内容の権限として扱わない。

共有の書き込みにはCRDDの開発権限が必要。GitHub連携が必須の登録先には、本人・GitHub App双方の書き込み許可も必要。HTTPでは一覧URLへの `POST` で作成、詳細URLへの `PATCH` で更新、`DELETE` で削除する。昇格は Topic詳細URLの `/promotion` に `POST`、Outcome処置は Meeting詳細URLの `/outcomes/{outcomeId}/treatment` に `PUT` を送る。HTTPでの書き込みは同一OriginからJSONで受け付ける。MCPは対応する `create`・`update`・`delete`・`promote_topic`・`treat_meeting_outcome` の各ツールを使う。

保存先は指定されたリポジトリの作業ツリー。削除時の参照確認もそのリポジトリ内に限り、Gitのコミットやpushは行わない。結果を確認できない場合は、権限を回復して現在の記録を取り直し、未保存と決めつけて再送しない。Gitホスト連携を必須とする登録先について、本人資格でのGitリモート操作はまだ接続していない。

作業領域（Workspace）のHTTP操作は `/api/repositories/{repositoryId}/workspaces` とその下位リソースを使う。MCPでは `crdd.list_workspaces`、`crdd.get_workspace`、`crdd.create_workspace`、`crdd.rename_workspace` など、操作名のツールへ対象と必要な入力だけを渡す。GitHub付きの登録では、閲覧にもCRDDの開発範囲とGitHubの閲覧許可の両方が必要。名前変更や選択も含め、変更には追加でGitHubの書き込み許可が必要。失効・切断後に結果が不明な場合は、同じ要求を自動再送せず、作業領域の状態と回復案内を確認する。

実行定義は、HTTPでは `/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}` 配下の計画・Objective・Taskを使う。MCPでは `crdd.get_execution_plan`、`crdd.list_objectives`、`crdd.list_tasks` と、初期化・保存・対象別の変更ツールを使う。Task一覧だけ任意の `queueId` を指定できる。定義の保存だけではAI実行を開始しない。結果が不明なときは現在の定義を確認し、自動再送しない。

Gitホストを有効にしない構成では、Googleが設定済みでも共有サーバーは起動しない。[共有OAuthの起動設定](#shared-oauth-startup)に従って対応ホストを有効にし、リポジトリを登録する担当者本人がアカウントを連携する。

`GET /api/workbench/view` はWorkbenchの画面専用。Project・Topic・Meetingなどの一覧だけが必要な場合は、各リソースのHTTP APIまたは対応するMCPツールを利用する。旧候補の採用入口は設けず、作業領域の固定・採用を用途別の操作から行う。

実行状態は、対応するリポジトリで `GET /api/repositories/{repositoryId}/runs/{requestId}` または `crdd.get_execution_state` から照会する。HTTPでは `projectId` と `repositoryRevision` をクエリに指定し、特定のキューを照会する場合だけ `queueId` を追加する。この照会で新しい実行は始まらない。

Objectiveを開始するときは `crdd.start_objective`、既存の実行IDを指定して再開するときは `crdd.resume_objective` を使う。HTTPの対応入口は、開始がリポジトリ・プロジェクト・マイルストーン配下の `/runs`、再開が実行状態URL配下の `/resumption` への `POST`。HTTPは同一Originで `X-CRDD-Action-Token` を添えてJSONを送る。どちらの通信入口でも、本文の `operation` で開始と再開を切り替えない。結果が不明なときは実行状態を確認してから判断し、自動再送しない。

判断は `crdd.request_decision`（要求）、`crdd.answer_decision`（回答）、`crdd.apply_decision`（適用）、`crdd.close_decision`（閉鎖）のいずれかを使う。HTTPではリポジトリ・プロジェクト・マイルストーン配下の `/decisions`、または判断ID配下の `/answers`、`/application`、`/closure` へ、開始・再開と同じ条件で `POST` する。回答だけでは実行は再開されない。すべての判断操作で、対象の世代と改訂を指定する。

共有モードでも、実行状態の照会と判断操作を使える。WorkbenchではGoogleでログインしてGitHubを連携し、MCPでは連携済みのブラウザーから接続を許可する。照会にはCRDDの開発権限とGitHubの読み取り権限、判断の変更には本人とGitHub Appの書き込み権限が必要。利用できるセッションまたはMCPのOAuthトークンがなければ拒否する。判断後に応答を確認できないときは保存されていないと決めつけず、認可を回復して現在状態を確認する。

## ログインと連携の復旧

| 状況 | 実行する手順 |
|---|---|
| 管理者のGoogleアカウントを変更した／使えなくなった | Hostの `--link-admin` に `--provider google` を指定し、既存管理者に再紐付けする。 |
| 初回ログイン用の招待を紛失した／期限が切れた | Workbenchで同じ利用者の招待を再発行する。利用者を再登録しない。 |
| GitHub連携の期限が切れた／解除した | Workbenchから再連携する。 |

## 実行前と終了後

| 時点 | 確認 |
|---|---|
| 実行前 | Node、配布Identity、Repository Binding、外部送信Policy、認証情報および対象portの成立 |
| 実行中 | request identity、認証、Origin、容量、切断、取消および閉じた結果 |
| 終了時 | listener、socket、受信途中Request、実行中Applicationおよび取消処理のjoin |
| 観測不能 | 成功や不存在へ補正せず、MCP結果またはRuntimeのRecovery契約に従う |

直接端末の終了、stdio EOFまたはHTTP切断だけをTask終了と扱わない。Server再接続は新しいTransport lifecycleであり、前の接続が持つAuthorityや未確定結果を暗黙継承しない。

共有Objectiveの実行中に、対象リポジトリの開発権限が失われたと確認できた場合は、その実行に取消を要求する。同じサーバーでの変更は保存通知を受けて確認し、別プロセスのHost操作は15秒間隔の確認で拾う。確認が遅れる場合があり、15秒以内の停止を保証するものではない。影響のない別のリポジトリの実行は止めない。終了や後片付けが不明なら、現在の実行状態と回復案内を確認し、自動で同じ要求を再送しない。

Gitホスト連携が必須の登録先でObjectiveを開始・再開するには、CRDDの開発権限と本人・GitHub Appの書き込み権限が必要。Serverは実行中にも資格と対象を見直し、失効や接続先の変更を確認したら同じ実行に取消を要求する。一時的な観測不能だけでは実行中のTaskを即時取消ししないが、次のTaskを始める前や結果を返す前に確認できなければ許可しない。

本人が実行に取消を要求する場合は、実行状態に表示された今回の `launchId` を使う。HTTPは実行状態URL配下の `/cancellation` に `projectId` と `launchId` を、開始・再開と同じ受付条件で `POST` する。MCPは `crdd.cancel_objective` に `projectId`、`requestId`、`launchId` を渡し、共有では `repositoryId` も指定する。HTTP `202` とMCPの `cancellation_requested` は取消要求を受理したことだけを表す。実行終了・回収は元の実行結果か状態照会で確認する。標準入出力では、同じ接続でObjectiveが実行中でも `crdd.get_execution_state` と `crdd.cancel_objective` を一件ずつ先に処理できる。開始要求そのものを取り消す既存のMCP要求取消通知も引き続き使える。

## 開発確認

MCPの型、Lint、Formatおよび試験は`40_Develop/crdd-server`の`package.json`が所有する入口から実行する。CoordinatorのTask／Objectiveまでの総合確認、実Provider、正式署名またはRelease判断を、パッケージ単体試験の成功から推定しない。実行対象と必要な試験は[検証設計](../07_Quality/03_Verification_Design.md)と[試験カタログ](../07_Quality/Registry/test-catalog.json)から選ぶ。

### 開発用HTTP API参照

`crdd-server` の開発依存と `workbench-ui` の依存を導入し、公式Repositoryで `npm --prefix 40_Develop/crdd-server start -- --docs --port <port>` を実行する。起動が案内したlocalhost URLの `/docs` でSwagger UI、`/openapi.json` でOpenAPIを取得する。共有モード・AI有効化とは併用しない。Swagger UIからの操作送信、外部バリデーターへの送信、資格の保存は無効にしている。MCP Toolは次のInspectorで確認し、OpenAPIにJSON-RPCを重ねて定義しない。

### 公式MCP Inspector

[公式Inspector](https://github.com/modelcontextprotocol/inspector) の固定版 `2.16.0` を開発用に使う。Windowsの今回の確認では Node.js `24.22.3` を使用した。製品のNode.js下限や依存へInspectorを加えない。確認には専用の作業領域を使い、`MCP_INSPECTOR_SECRET_STORE=memory`、`MCP_STORAGE_DIR`・`MCP_CATALOG_PATH`・npm cacheをその領域へ限定する。既存のInspector設定や実資格は読ませない。

公式Repository Rootを起点に、Inspector CLIで既存stdio入口のTool一覧だけを確認する。外部配信から導入する場合は固定版と依存を確認し、インストール時スクリプトを無効にする。

```text
npm exec --ignore-scripts --yes --package @modelcontextprotocol/inspector@2.16.0 -- mcp-inspector --cli --protocol-era modern --method tools/list --strict --format json -- node template/tools/crdd-server.ts --mcp-stdio
```
