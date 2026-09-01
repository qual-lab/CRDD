# Coordinator Runtimeの実行アーキテクチャ

Status: Implementation Candidate

## 1. 文書責務

Coordinatorは、AIへの依頼を受け取り、許可された作業範囲で実行者と確認者を動かし、元のRepositoryへ直接適用しない候補を返す。中心となる設計判断は、**AIの成果と、実行許可・資源の回収・採用判断を別々に扱うこと**である。

### 構成と依存の方向

```text
人間／フロントAI
  → CLI（要求の搬送・取消・結果表示）
    → Task Runtime（実行順序と最終結果の所有）
      ├ Repository／Revisionの結合、隔離Workspace
      ├ 選定・外部送信許可・Provider Homeの利用許可
      ├ Provider Adapter → Docker Controller → 公式Provider CLI
      ├ 候補の固定 → 独立Reviewer → 必要なら同じ実行者へ一回是正
      └ 資源回収 → 候補Storeへの公開 → 人間へ結果

Windows固有の観測・限定操作 ← platform-access
文書や契約の静的な整合確認 ← Checker（Taskの実行許可を発行しない）
```

| 部品 | 所有する判断・状態 | 所有しないもの |
|---|---|---|
| 公開CLI | 入力形式、取消通知の接続、機械結果と人間表示 | Providerの結果を成功へ補正する権限 |
| Task Runtime | 実行順序、各段階の引渡し、候補と回収の最終照合 | OS資源の名前だけによる所有認定 |
| Repository／候補管理 | 開始Revision、許可Path、実差分、候補の同一性・期限 | 正本への自動採用・commit |
| 選定・Authority | Providerの選択理由と、許可された範囲への結合 | 利用可能なProviderへの無条件な送信 |
| Provider Adapter／Docker Controller | 固定実行計画、起動、上限、取消、子・container・networkの回収 | 呼出し元より広い権限、Host実行へのfallback |
| [Windowsネイティブ部品](../platform-access/01_Architecture.md) | OS主体・保護・実体の観測と、明示経路の限定操作 | AIの方針決定、Taskの意味判断 |
| [Checker](../checker/01_Architecture.md) | 文書・リンク・宣言した契約の機械確認 | Runtimeの起動許可、実動作や専門品質の認定 |

### この構造を選んだ理由

| 判断 | 解く問題 | 残る費用・限界 |
|---|---|---|
| Provider同士を直接起動させず、Coordinatorが順序を所有する | 権限の再委譲、再帰起動、費用増幅を制限する | 調整と結果搬送の処理が増える |
| 隔離候補を作り、元のRepositoryへ直接適用しない | 読み取ったRevisionと変更対象の取り違え、未確認の採用を避ける | 候補の保存・破棄と最終採用が別操作になる |
| 成功通知の後に資源回収を照合する | AIの成功と子Process／mount等の終了を混同しない | 回収不明では成果があっても通常成功を返せない |
| 実行前に耐久記録を確定する | 親Process喪失後に、何へ処置できるか再構成する | 記録・Lock・復旧の整合が必要になる |
| 正常OSと認証済みLocal Userを信頼境界に含める | 個人利用で実Provider接続を成立させる | 同一ユーザー／OS侵害への完全耐性は保証しない |

これは新しい方式の採用ではなく、現行実装の判断理由を整理したものである。Hostでの無制限実行、常時多Agent化、完全な改ざん耐性、MCPやLinuxへの先行抽象化は追加しない。

### 読み終えたときに確認できること

主シーケンスは「何を待って次へ進むか」、資源表は「誰がいつまで保持するか」、Lockと耐久状態は「競合・中断後に何を再確認するか」、不変条件と試験接続は「何が破れると成功を拒否するか」を説明する。内部IDは機械可読Traceと同じ識別子を保ち、説明文だけ日本語で読む構成とする。

**確認範囲の読み方:** 本書は設計契約を所有する。署名版ごとの4経路・復旧・実Task取消、実端末の入力・表示、実務と是正の観測結果および最新実装への適用可否は[品質の現在状態](../../07_Quality/01_Quality_Center.md)で追跡する。過去の取消失敗・事後回復と是正後の再実測、別端末・支援技術・完成監査の未確認範囲を区別し、過去実測や未接続準備候補を現行版の全体合格へ読み替えない。

### Processの終了処理と試験境界

Docker Controllerは取消を一度記録し、実行中handleの終了を待ってから既存の回収経路へ進む。Windowsの子Process所有処理は内部の`docker-owned-process.ts`に集約し、Docker実行部品と実子Process試験が同じ`startOwnedProcess`を使用する。固定taskkill、最小環境、stdin搬送、出力上限、期限付き待機、実`close`観測はこの部品が所有する。Provider計画・CLI真正性・Authority・Docker資源の回収は上位の既存部品が所有し、この内部部品の存在だけで実行を許可しない。

CREATE結果の待機中に取消を受けても、作成された資源の検証済み受領情報を回収へ引き渡す前に破棄しない。受領情報を確認できる場合は既存の耐久記録へ保存してから停止・回収へ進み、確認できない場合は不明状態を保って正規Recoveryへ渡す。これは取消後の後続作業を許可する規則ではない。実測失敗との対応と是正後の確認は[追加検証結果](../../07_Quality/Verification_Results/2026-08-31_Coordinator_Closure_Verification.md#public-task-cancellation-observation)を参照する。

試験専用Controllerを実Node Workerへ接続しても、本番の署名・認証・Docker資源を確認したことにはならない。登録済み取消handlerの直接呼出し、OSからの実通知、実子孫Processの終了、模擬Docker回収、実Docker回収を分けて記録する。公開操作から最終回収までの未接続部分を、部品別の合格で補完しない。

本書は、エージェント組織（Agent Organization）を実証するCoordinator Reference Runtimeの実行Architecture正本である。Runtime固有の実行シーケンス、状態、資源所有、Lock順序、回復および結果公開条件を所有する。

上位概念、費用原則、独立レビュー、決定権限および人間との境界は[`04_Agent_Organization.md`](../../04_Agent_Organization.md)を正本とする。構築・利用・発行の順序は[作業手順](../../19_Workflows/01_Coordinator_Runtime.md)、公開入力・結果は[振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md)、実装と開発者テストは[Coordinator package](../../40_Develop/coordinator)、検証の現在状態は[品質確認](../../07_Quality/01_Quality_Center.md)を参照する。本書はCRDD全体または別Runtimeへこの実装方式を要求しない。

機械可読な接続投影は[`coordinator-runtime-traceability.json`](../../40_Develop/coordinator/runtime/coordinator-runtime-traceability.json)を用いる。JSONは本書の意味を置き換えず、宣言した状態、資源、遷移、不変条件および検証接続の孤立・欠落を検出するための投影である。

## 読む順序と契約の所有

| 確認したいこと | 本書で読む箇所 | 他の正本が所有するもの |
|---|---|---|
| 実行の全体像 | 公開実行境界、主実行シーケンス | 入力・公開結果は仕様 |
| 同時利用・失敗・回収 | 資源所有、Lock、耐久状態、回収順、不変条件、遷移 | 利用者の認識・次操作はUI |
| Providerと内部子Process | 実装契約、署名結合、Console・Task搬送 | 脅威・残存リスクは脅威モデル |
| 未接続の方式 | 準備候補の節。Local Personalの必須条件へ混ぜない | 採否・経緯はCHG |
| 何が検証されたか | 変更と検証から品質記録へ | 過去実測と現在の合否は品質状態 |

状態・資源・Lockの表を中心設計とし、詳細は条件・処置・停止・終了の順に読む。本文中の過去固定版の結果は当時の根拠であり、現版のPassではない。

## 2. 公開実行境界

### 共通起動入口の所有境界

検証結果保存は`src/core/verification-result-record.ts`が所有し、4経路／復旧の通常mainだけから、開始記録→既存検証→限定投影→終了記録のflush・read-back→結果SHA-256を含む完了記録へ接続する。runごと最大3fileとし、構文が完全な結果だけ残っても完了記録がなければ未確認とする。console／stdoutは横取りせず、既存の例外時process-poison・Recovery処置を所有runnerへ残す。保存の成否と実行の成否を分離する。

最寄りの検証済みGit Rootと開始時Commit／Treeを読み取り、固定`.crdd/verification-results`とrun固有UUID Directory以外へ書かない。Directoryは各書込み前後にnon-link、realpath、dev／ino／birthtimeを照合し、fileは`wx+`、単一link、flush、同一handleからのread-back、終了時Identityを確認する。既存fileの上書きや削除はしない。これは同一ユーザーの敵対的差替えへの完全耐性や、電源断後のDirectory entry永続化を保証するものではない。

各file32KiB、子結果12件、種類別回復ID配列16件に制限し、超過は保存失敗または不完全な投影として扱う。保存領域に256項目以上あれば検証開始を止める。異物・部分記録も数え、自動削除しない。この件数は開始時の受入制限であり、並行実行に対する原子的な総容量保証ではない。各runは別UUIDへ固定し、最新結果の自動選択・古い成功へのfallback・保存記録による操作再開を実装しない。

`bin/launch.ts`と`src/core/coordinator-launch.ts`は用途の閉集合、Node版、必要な端末接続を検査し、`import.meta.url`を基準に同じpackage内の既存入口を選ぶ。通常CLI、署名、4経路検証、復旧検証の契約を再実装しない。

選択→事前条件照合→`process.argv`を対象入口と未加工の引数へ一度設定→同じProcessでdynamic import→既存入口の終了、の順とする。新しい子Process、Shell、stdio転送、環境block、cwd変更、signal handler、入力readerを追加しない。終了と取消の所有者は既存入口のままである。対象import後の失敗にはEffectがあり得るため、事前拒否とは別に状態未確認とする。

対話出力は端末に残す。結果採取のためのstdout差替え、tee、stream interceptionは共通入口へ持ち込まない。自動化は明示したJSON入口と既存の同意境界を使う。外側のShellやホストアプリによるウィンドウ閉鎖・redirectを修復する機構ではなく、不適合な接続を実処理前に検出する境界である。

検証は[起動契約試験](../../40_Develop/coordinator/tests/coordinator-launch.contract.test.ts)で用途の受理／拒否、実子でのPID・引数・stdin・cwd・終了コード、実CLIへの接続を照合する。実端末の表示・入力と実Provider動作は別の検証義務として残す。試験用入口の成功を署名・Authority成立へ読み替えない。

現在の実行可能な中心経路は、正式署名配布物から開始するLocal Personal一般Taskである。

開発反復と正式署名版は別の検証境界とする。開発試験の成功を、署名配布物、実Provider、実OS対話境界またはReleaseの成立へ昇格させない。開発試験から候補凍結・正式署名検証へ進む順序は[開発者確認の手順](../../19_Workflows/01_Coordinator_Runtime.md#開発者確認)が所有する。

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

### 2.1 Filesystem保存境界

Coordinatorは、論理的なRepository Bindingと物理的な書込みRootを分離する。現在のリポジトリを対象にしたOperationでは、明示的な別Authorityがない限り、Repository外へstaging、worktree、archive、log、probeまたは試験一時物を作らない。読み取れるPath、同じ親Directory、同じLocal Userまたはcaller supplied absolute Pathは書込みAuthorityにならない。

保存先は次の三層へ分ける。

| 層 | 用途 | 境界 |
|---|---|---|
| Repository-local `.crdd` | Git管理するRepository Policy／Bindingと、用途別に分離したローカルRuntime補助 | Policy等の正本と未追跡Runtime状態を別subtreeにし、後者をCandidate Revision、Provider mountおよびGit管理対象から除外する |
| OS管理Runtime Root | selected-user Provider Home、Candidate Store、Recovery、Host／Runtime State | OS Known Folderまたはservice管理Rootから導出し、主体、保護、安定Identityおよび用途をRuntimeが検証する |
| Operation Root | 一回のOperationが所有するworkspace、staging、temp、logおよびcleanup記録 | 一つのProject BindingとOperation IDへ結合し、成功、失敗、取消および親Process喪失で回収またはexact Recoveryへ移送する |

Repository-localのcanonical namespaceは`<verified-repository-root>/.crdd/`とする。公開CLIと署名E2E入口は、起動Directoryから最寄りの有効なGit worktree Rootを上方解決し、構造とIdentityを検証してからProjectへBindingする。Current Working DirectoryそのものはRepository Authorityではない。途中に存在する`.git`境界が不正または検証不能なら外側のRepositoryへ読み替えずEffect 0で停止する。これにより`40_Develop/coordinator/.crdd`のようなpackage-local複製を許可しない。外部送信PolicyはGit管理する`.crdd/external-send-policy.json`に置く。現行の`<repository>/.crdd-runtime/`候補はローカルRuntime補助の既存実装名であり、将来の`.crdd/runtime/`集約形へ無言で併存させない。移行する場合は、単一のcanonical location、旧位置の検出、競合時停止、Candidate／mount除外、cleanupおよび移行後残存0を一つの変更として固定する。現時点でRepository外overrideを承認するRuntime Capabilityは未実装なので、Path Identity入口とGit local exclude入口はいずれもEffect前に`runtime_root_external_write_authorization_required`で停止する。

将来のMCP／Linux常設／複数Repository構成でも、MCP Serverが任意Pathを直接選ばない。Repository Routerが事前登録された論理Repository IdentityをProject RuntimeへBindingし、OS管理Runtime Rootの`Project Binding × Operation ID`名前空間へ写像する。同じOrganization Runtime上の別Projectは、保存Root、Authority、Provider Home lease、Recoveryおよびcleanupを共有しない。機構はRuntime 1.0の完成条件へ追加せず、Dogfoodingで境界の安定性が確認された後の根拠駆動リファクタリングとして扱う。

### 2.2 Docker Desktop最終復旧時の起動環境

Docker Desktopの最終復旧は、通常のProvider起動とは別の、人間が明示したホスト操作である。native launcherは同じユーザーのOS Known FolderからProfile、Roaming App Data、Local App Dataを取得し、通常Directoryと正規化後の同一Pathを確認する。Profileを`HOME`、`USERPROFILE`および明示的な作業Directoryへ、Profile配下の`.docker`を`DOCKER_CONFIG`へ設定する。`APPDATA`、`LOCALAPPDATA`と既存の一時Directoryも明示し、親のHome、作業Directory、PATH、proxy、Credential helper、Node injection設定を継承しない。

これはDocker Desktop自身が通常のユーザー設定を利用するための起動環境であり、CRDDがその設定本文やCredentialを読む許可ではない。CRDD配布RootをDockerの作業領域へ使わず、生成物を署名検証の除外対象へ追加しない。Directory取得・検証またはProcess生成に失敗した場合、親Directoryへのfallbackを行わない。生成後のIdentity確認不明は、非発行とは別に保持する。

Docker Desktopの設定読込みが必要とする`ProgramData`も、OSの`FOLDERID_ProgramData`から取得して最小環境へ含める。ユーザーのProfile／App Dataとは別のOS共通データ配置であり、通常Directoryと正規化後の同一Pathを確認する。固定の`C:\ProgramData`、親環境の同名値、任意Pathへの代替は使わず、CRDD自身にそのDirectoryの内容変更を許可する意味にはしない。環境の搬送一致だけでは必須値の欠落を検出できないため、実子Process側でもこの値の存在・非空・絶対Path・OS由来配置との一致を確認する。この試験をDocker本体の全起動前提の充足証明へ拡張しない。

検証は環境blockの構造だけで閉じない。同じ`CreateProcessW`経路で試験専用子Processを生成し、親が渡した環境と実子の受信環境を値非公開のHashで照合し、Homeと作業Directoryの一致、非適合作業Directoryでの非発行、生成後Identity不明の保持、子の終了とhandle回収を確認する。試験専用子の成功はDocker本体の起動・回復・正式署名E2Eの成功ではない。

既知フォルダー取得も環境展開へ依存するため、Docker修復helperへはロード済みOS moduleから検証したWindows Directoryのローカルdriveを`SYSTEMDRIVE`へ渡す。helperからDocker子へも`GetWindowsDirectoryW`由来のdriveを渡す。値は`D:`等のdrive形式とし、固定`C:`、親の同名値、UNC、相対Pathまたは解決不能な配置へ代替しない。`ProgramData`をdriveとの文字列連結で生成せず、既知フォルダー取得と元Path／実体の一致確認を維持する。generic native observer、Console、ProviderおよびWSL終了の環境は変更しない。helper自身の環境を後から書き換えない。試験では中間helperの実環境から既知フォルダー取得までと、最終子Processの環境から同じ取得までを分け、正規化によって相対Pathの誤りを隠さず、取得時点の絶対Path性も確認する。

修復記録は作成時の署名版へ結合し、自動移行しない。旧版記録を新版で扱う場合は、`doctor --adopt-docker-desktop-repair <repair-id> --from-release <absolute-root>`で対象IDと元の配布Rootを明示する。元配布から読むのは固定位置の署名manifestだけであり、旧版の実行物は起動しない。過去の署名は由来の証明として検証し、有効期限を現在の実行許可へ読み替えない。実行中の新版は通常どおり署名・配布実体・期限・Policy・選択ユーザー・保護Rootを検証する。

記録v4の全連鎖、元の署名tuple、現在と同じユーザー／Root Identity／保護／Policyを照合した後、同じ操作Directoryへ`historical-adoption.json`を排他的に追加する。元のrecord数、末尾hash、元版と引継ぎ版の署名manifestを固定し、元recordのbyte、stage、ledger、IDを変更しない。同じ内容の再開だけを許し、部分書込み、内容差、旧recordへの追記、版の逆行、同じsequenceで異なるtupleは停止する。旧v2／v3記録や署名鍵の移行は扱わない。

引継ぎ済み記録は元stageにかかわらず観測専用とし、旧shutdown、native termination、WSL停止、rename、launchを再発行しない。現在のEngine、Process、run、退避物、helperおよび新版の操作境界が成立すれば`historical_recovered_pending_close`とする。不明だった過去Effectを確認済みへ上書きしない。明示closeは同じ観測を再確認し、`historical-closure.json`へ引継ぎhash、現在run Identity、退避物の保持／不存在、終了処置版の署名を追加する。退避物がある場合も元の実体を保持し、削除しない。

| 境界 | 実装上の所有者 | 確認と終了条件 |
|---|---|---|
| 旧版の由来と記録連鎖 | Trust Core、repair record store | 実Ed25519署名、全record、同一ユーザー／Root／Policy、末尾hash。旧配布の実行許可は発行しない |
| 引継ぎ保存と再開 | repair record store | 固定名・排他作成・flush・read-back。部分記録は保持して停止し、上書きで修復しない |
| 状態確認と明示終了 | Docker repair runtime | 全旧stageでHost再実行0。正常応答、Process集合、run／stale実体、取消、helper喪失、解放後の新版境界を確認 |
| 公開結果 | doctor parser／dispatcher／renderer | 不明履歴を保持。`historical_closed_retained`でもhelper cleanupと新規修復許可が揃う場合だけexit 0 |

終了済み旧記録も同じ由来照合を行う。引継ぎreceiptの終了は旧stageと別の軸であり、別の未完了操作、記録不整合、状態不明またはhelper cleanup不明があれば新規修復を許可しない。実機の中断記録への適用と正式E2Eは、開発試験の合格とは分けて確認する。

同じユーザーと同じログオンは区別する。`localUserBindingHash`はログオン単位、`runtimeStateBindingHash`は選択ユーザーの安定した識別へ結合する。終了済み記録を読む際だけ、先頭recordの正規なログオンHashへ全連鎖を固定して検証できる。通常記録は完全な状態・台帳検証後の終了状態、引継ぎ履歴は引継ぎ・終了receipt、署名版の順序、ID、件数、末尾Hashをすべて検証したものに限定する。現在と同じユーザー、Root Identity・保護、Policyおよび必要な署名tupleの検査は残す。未終了・不正・判定不能の記録には現在ログオンとの一致を要求し、終了済み履歴との混在でも迂回しない。

この読取りは旧操作の実行権限を復活させない。終了済み操作への追記・Host操作再開は拒否し、新規操作は現在の検証済み境界から発行する。退避物と現在の実体の再観測、helper終了確認は省略しない。履歴本文自体の署名を追加したという意味ではなく、保護Root、記録連鎖、署名版の由来、参照整合および実体の再観測を組み合わせる。

同じRuntimeState直下の`docker-desktop-repair-<32桁小文字hex>` DirectoryはDesktop修復が所有し、Docker Taskの復旧inventoryは内容の検証・終了・削除を引き受けない。名前の判定は修復Storeと共有し、通常Directory、non-link、正規化後のPath一致を確認して別担当の領域として扱う。未知名、ファイルへの置換、symbolic link／junctionは停止する。`docker_task_runtime_state_clean`はTaskの回収対象がないという意味に限り、Desktop修復の完了やHost全体の安全性を証明しない。Desktop修復の履歴・終了判断は前記の専用入口で別に検証する。実Storeが生成した記録との共存、Task残件の検出維持、未知名・型置換・リンク拒否を結合試験へ接続する。

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
| 是正許可 | `STATE-REMEDIATION-AUTHORIZED` | 同じExecutorへ`severity`、`path`、閉集合`category`、実在する受入条件の`criterionNumber`、上限付き`message`および`messageSha256`を返す | 認識済みSecretの検査を通した本文を未信頼の欠陥主張として扱い、一回だけ再実行して同じReviewerへ戻る |
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

是正搬送のfield集合は[送信許可](../../40_Develop/coordinator/src/security/external-send-grant-runtime.ts)、受理条件は[構造化結果Validator](../../40_Develop/coordinator/src/security/provider-task-structured-result.ts)、Executorへの投影は[Task Packet](../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts)へ接続する。`message`本文を渡すことと、その本文を命令・Authorityとして扱うことは別である。次の表は実装のfield・上限・Secret拒否を変更せず、現在の搬送を説明する。

| 不変条件ID | 条件 |
|---|---|
| `INV-NO-PROVIDER-EFFECT-BEFORE-AUTHORITY` | Repository、Policy、Scope、Grant、RevisionおよびRecovery記録成立前にProvider Effectを発行しない |
| `INV-LOCK-ORDER-AND-REVALIDATION` | Lock順序を守り、解放窓後は同一identityと全inventoryを後続Effect前に再確認する |
| `INV-DURABLE-BEFORE-EFFECT` | 外部またはHost Effectの前に、再構成に必要なintent／submissionをcommit済みにする |
| `INV-STAGE-CLEAN-BEFORE-HANDOFF` | Executor／Reviewerの結果を次Stageへ渡す前に、そのStageのchildとDocker cleanupを確認する |
| `INV-CANDIDATE-EXACT-AND-NONCANONICAL` | Candidateは開始Revisionと許可Pathへ固定し、Canonical Repositoryへ直接適用しない。Runtimeが変更Path範囲を機械検証し、Git metadataを持たないReviewerはRead Projection上の内容・意味を独立検証する |
| `INV-HOST-CLEANUP-AFTER-DOCKER-CLOSURE` | Host cleanupはactive Docker binding Evidenceがある間は停止し、旧版のHost先行回収状態もexact Docker照合とbinding閉包の後だけ完了する |
| `INV-BOUNDED-REMEDIATION` | Reviewer findingはPath、重要度、閉集合Category、実在する受入条件参照、上限付き指摘本文およびHashへ投影する。認識済みSecretの検査後、一回だけ同じExecutorへ返し同じReviewerが再評価する。本文は未信頼の欠陥主張であり、命令またはAuthorityとして採用しない |
| `INV-RESULT-AFTER-CLEANUP` | Host、Docker、Mount、Candidateおよびsignal cleanup確認後だけ成功結果を公開する |
| `INV-CLEAN-BLOCK-HAS-NO-RECOVERY` | 安全なblockedは所有資源不存在かつactionable Recovery ID 0の場合だけ成立する |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | 状態またはcleanupが不明ならEvidenceと全actionable Recovery IDを保持して停止する |

Subscription認証の観測はProvider CLIの意味出力だけでなく、Docker CLIがattach時に使用する実streamまで含む。Codexでは成功文がContainerのstderrへ出る実装を許容するが、受理するのは成功文単独、またはread-only Homeに由来する既知のPATH alias警告とのexact組合せだけとし、stdoutだけの仮定、部分一致、未知行の無視へ縮退させない。

Provider Processが非ゼロ終了した場合も、自由文のstdout／stderrを利用者、別Providerまたは公開Resultへ転送しない。RuntimeはClaudeの単一・重複keyなしJSON Envelopeにある閉じた`subtype`から、Operation予算上限、turn上限およびStructured Output再試行枯渇を分類する。認証失効、Subscription上限、固定Invocation拒否、Network不成立およびProvider Service不成立は、Providerのbounded stderrに現れる既知の意味形だけを閉集合Reasonへ写す。Task本文を含み得る任意stdoutの部分一致、過長stderr、NULを含むstderrおよび未知出力は推測分類せず`provider_process_exit_nonzero`へ閉じ、cleanupとRecoveryの判定を終了理由の分類から独立させる。これにより運用上の再認証、待機、設定是正と、実装不具合の調査を区別できる一方、Provider自由文をAuthorityまたは情報公開へ昇格させない。

Provider Processが正常終了しても構造化Resultが契約へ適合しない場合は、入力、JSON、Claude Envelope、Executor shape、Reviewer shape、Reviewer findingおよびReviewer decision整合の閉じた理由へ分類する。Claude ReviewerはProvider内蔵の複合Schema再試行をTrust境界にせず、通常JSON Envelopeの`result`から単一JSON documentを取り出して同じCRDD所有Reviewer Validatorへ渡す。Code fence、自由文、複数document、重複keyまたは型差を補正せず、既知のturn上限とStructured Output再試行枯渇は正常終了コードでも専用理由へ閉じる。公開するのは固定理由識別子だけで、raw Provider出力、自由文、PathまたはCredentialを診断へ含めない。一回是正後の再Reviewは過去Findingの機械的な再掲ではなく現在Candidateを同じ受入条件から再評価し、解消済みFindingを残さない。Runtimeは矛盾したResultを成功へ補正せず、分類不能な形はFail Closedにする。

標準のSubscription-only Profileでは、Providerが報告する`total_cost_usd`を実課金額または課金Authorityとみなさず、有限かつ非負の利用量metadataとしてだけ検証する。一般Taskへ`--max-budget-usd`を暗黙適用しない。Subscription使用量は、Coordinatorが説明可能に選定したmodel／effort、検証済みTask Packetの作業量に基づくturn上限、Provider timeoutおよび出力上限で制御する。明示的な金額上限は、Provider／account、credential source、spend budgetおよびOperation Authorityを別に結合する将来のopt-in有料API Profileだけが所有できる。標準ProfileはAPI key、有料API fallback、追加購入または自動plan切替を引き続き許可しない。

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

この分担は固定検証Taskの生成元から指示へ反映する。Reviewerへ後段の機械検証を重複要求せず、その検証が実行済みだとも主張しない。一般Taskへ同じ検証の免除を広げない。固定開発版の2件比較は一般Taskと候補破棄までを測定し、正式Runnerのbyte検証を呼ばないため、その成功をbyte完全一致または正式4経路完了へ昇格しない。

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

### Taskと実資源を接続する開発試験

`tests/coordinator-task-process.integration.test.ts`は、現行Taskの状態遷移へ実際のNode子Process、作業領域、Host回収、CLIが使用する取消handlerを接続する。正常な書込みと独立した読取り、子の非ゼロ終了、実行中取消、子終了観測を意図的に不明とする場合、active binding残存によるHost回収拒否を確認する。子の`close`、取消listenerの解放、試験用の許可参照消費、Task control失効、Rootの不存在または保持、同じHost回復IDの返却を同じ実行で観測する。

これはRelease鍵・Provider認証・外部送信なしの隔離試験である。Repository認可、Provider選定、候補Store、Docker回復handoffは試験用実装であり、Host generation lock、実Docker container、署名付き公開CLI全体の異常経路はこの試験で観測しない。終了不明caseでも試験所有の子は実際には終了させ、その観測をTaskへ返さない障害を注入する。既存の機械可読Traceの`contract_projection`を本試験だけで実資源全件観測済みへ変更しない。公開CLIと実Dockerを含む残りの結合範囲は完成確認に残す。

同じ試験のController接続ケースでは、CLI取消handler→Task control→Docker Controller→本番共通のProcess所有処理→実子孫の終了を一つの実行へ接続する。開始・完了結果は本番のTask向けprojectorを通し、同じOperationと回復handoffからHost回収準備→実Host領域の回収→receipt→finalizeまでを照合する。回収成功と回収不明を分け、候補を公開しないこと、control失効、listener復元、試験資源の後処置を確認する。Docker資源と認証は模擬であり、OSのCtrl+C配送や署名CLI経由の取消実測を代替しない。

### Docker CLIの結果と子プロセスの所有

[子プロセス所有処理](../../40_Develop/coordinator/src/security/docker-owned-process.ts)では、コマンド結果の確定と子の`close`観測を分ける。早期の`error`で失敗結果を返せても、終了を確認したことにはならない。

- `spawn`が子を返した直後から`error`と独立した`close`を所有する。標準入出力の欠落や入力失敗でも、生成済みの子を同期例外で置き去りにせず、回収可能な失敗handleを返す。
- `wait`は早期失敗を返せるが、`terminateAndWait`は別の終了観測を上限付きで待つ。PIDを取得できない場合や終了要求に失敗した場合も、`close`未確認を終了済みへ変換しない。終了対象の同定条件と対象範囲は変更しない。
- [Docker操作の実行処理](../../40_Develop/coordinator/src/security/docker-effect-runtime.ts)は、短いコマンドを実行する`runShort`も、`closed()`を確認するまで所有集合へ保持する。回収中のinspect／removeで生成した子も対象であり、回収開始時の集合だけで終了確認を済ませない。
- 所有する子の終了と既存のDocker資源不存在・設定領域の検証が揃ってから、設定Directoryを削除し実行コンテキストを破棄する。receiptを使う経路と使わない経路でこの順序を共通にし、未確認なら既存の回収不明結果と回復経路を保持する。

この契約の確認方法は[内部ツールの検証設計](../../07_Quality/03_Verification_Design.md#docker-cliの結果と終了観測)へ接続する。記述の追加だけで実装・検証を完了とせず、過去の署名版の成功も変更後の実測へ流用しない。

状態、遷移、資源、Lock、Recoveryまたは結果公開条件を変更する場合、同じ変更で次を更新する。

1. 本書
2. 機械可読Trace
3. 実装
4. 正常・準正常・異常の検証
5. 現在品質状態とCHG Evidence

具体的なRuntimeで得た学びは、同Runtimeだけの条件なら本書へ残す。別RuntimeまたはCRDD全体にも適用でき、実証で有効性を確認した原則だけを、決定権限を持つ上位正本へ別途昇格させる。


## 12. Provider・回復・観測の実装契約

### 12.1 Providerの通信経路

正式TopologyではProvider containerをOperation専用のinternal Docker Networkだけへ接続し、外部Networkへ直接接続しない。ProxyだけがOperation internal Networkと専用Egress Networkへ接続し、Docker socket、Host NetworkまたはHost fallbackを使用しない。Docker Engine 28は`--network=none`で作成したcontainerを別Networkへ後接続できないため、Proxyは作成時にinternal Networkへ接続し、その後Egress Networkへ接続する。Providerも作成時からinternal Networkだけへ接続する。固定named pipe、固定image digest、read-only root、全Capability削除、`no-new-privileges`、PID上限、UID／GID 65534、固定Proxy Profile、認証preflightを含むexact 9 command、短命Runtime Provider Authority、Process Controller、Docker Effect executorおよびdurable Recovery adapterをCodex／Claudeの両Adapterへ接続した。source checkoutはEffect前に停止する。署名配布物での実測範囲は[署名済みE2E結果](../../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_0c3e6d2.md)を参照し、4指定経路と固定Workerによる復旧の成功にとどめる。実Frontアプリ認証、実Provider取消・是正経路、任意Task、全障害組合せまたはRuntime全体の完成へ一般化しない。

Codexの外部通信は固定版CLIが公開する`features.respect_system_proxy=true`を固定し、`HTTPS_PROXY`、`HTTP_PROXY`および`ALL_PROXY`を同じOperation専用Proxyへ結合し、`NO_PROXY`を空へ固定する。これは送信先を増やす設定ではない。内部Networkからの直接DNS／直接接続を避け、既存のProvider別許可先と認証付きProxyを確実に使わせる経路固定である。親環境またはcaller由来のProxy設定は受理しない。

### 現行のProvider Home／Docker Task回復境界

Provider Home観測は、Identity、保護、SID＋login session bindingに加え、login sessionへ依存しないSID＋Provider＋固定logical Home namespace bindingの四つのdomain-separated Hashを返す。実Docker mountの直前から終了までは、選択ユーザーの固定`Qual-Lab\CRDD\RuntimeState`、logical Home単位とHost Operation単位のWindows kernel lock、active run binding、active pointerおよびTask別の耐久回復記録を併用する。Host状態を扱う回復は`Host Operation → logical Home → RuntimeState`の順に排他を取得し、cleanupだけが残る段階ではHost Effectが既に不存在であることを前提に`logical Home → RuntimeState`で残骸除去だけを再開する。別process／別login sessionによる同じHomeの同時mountと、完了済み旧Taskが後続TaskのHost状態を回復対象として扱うことをEffect前に拒否する。

#### 作成前の耐久記録と在庫検査

- 各Docker createは、file `fsync`、再読取り、atomic renameおよび内容Hash／Filesystem Identityへ結合したcommit sidecarで確定したbase、pointer、Host active run binding、送信前submission markerおよび成功直後の完全Docker ID受領記録へ結合する。
- WindowsでNode.jsがdirectory handleの`fsync`を受理しないため、v1の耐久性は電源断耐性ではなくprocess crash後の明示回復を保証範囲とする。
- RuntimeState全体の固定kernel lock下でexact filename／Schema／Hash／Identity／件数をinventoryし、caller supplied Pathを受け取るproduction inventory入口を持たない。
- 別logical Homeの完全な記録は並行利用を妨げず、同じHome、unknown entry、commit未成立または判定不能だけをEffect前に停止する。

#### 記録を移動・削除するときの確定順序

- commit pairの削除と移動は、親Directory Identity、logical key、元のserialized content、Hash、Identityおよびbyte数を結合した単一atomic intentを先に確定し、target／commit間でprocessが終了しても到達可能な状態だけを再開する。
- cleanup対象Directoryは元entry全件のtype／Hash／Identity、空config Directory Identityおよびrename後basenameを記録したcommit済みmanifestを追加して再照合し、固定tombstoneへatomic renameする。
- payload削除前にRuntimeState Root側へ単一cleanup anchorを確定し、成功時はDirectoryとanchorを残存0へ閉じる。
- 第三状態、replacement、unknown entryまたは判定不能では上書きもrecursive deleteも行わずEvidenceを保持する。

#### 受領済みDocker IDを回収する条件

- 通常cleanupと明示`doctor --recover-isolation docker-task...`は、受領済みIDのname、ownership label、image、mount、hardeningおよびNetwork属性が期待値と一致する資源だけをID指定で削除し、IDとexact nameの双方の不存在を確認する。

#### 作成送信後・ID受領前に停止した場合

- 作成送信済みでID受領前にProcessが終了した場合、Operation固有のexact name照会と、同じexact name＋Operation固有ownership label照会がともに空でも、元のDocker CLIまたはdaemon requestの遅延完了を否定できないため未作成とは確定せず、Recovery ID、Operation領域、active pointer、Provider Home leaseおよびEvidenceを保持して`manualRecoveryRequired`へ閉じる。
- 両照会が同じ単一IDを返す場合だけ、そのIDの完全構成を削除前に照合し、ID、purpose、Recovery IDおよび取得経路をreconciled receiptへ耐久確定してから、受領済みIDと同じ回復経路で削除する。
- 発見IDが再観測時に消失、変更または判定不能ならreceiptを作らず停止する。
- proxyはcreate直後のinternal-onlyと、receipt後のegress接続済みという二つの閉じたNetwork状態だけをcrash位置に応じて許容し、余分、egress-onlyまたはNetworkなしを拒否する。
- 片側だけの存在、複数ID、foreign／unknown資源、照会失敗または設定不一致も推測回収しない。

#### 利用側へ返す情報と所有の終了

- CLIは自動回復停止、Evidenceの`preserved`／`not_preserved`／`unknown`観測および利用可能なexact Recovery IDをJSON／人間表示へ同じ意味で返し、Recovery ID形式だけからEvidence保持を推定せず、名前またはlabelだけの手動削除を案内しない。
- Provider Home leaseはexact Docker不存在と通常mount completion、またはcrash後のHost owner世代不存在＋exact Docker不存在が成立した後だけ解放する。
- Task別回復handoffは`active`、`finalizable`、`finalized`、`abandoned`を区別し、`finalized`だけを未解決ID集合から除く。
- Host cleanup intent、Host領域不存在、cleanup receiptおよび全Host inventory確認後まで記録を保持し、複数の残存Taskは現在も処置可能な全Recovery IDを失わずCLIへ返す。

#### 過去固定版の確認履歴

固定Commit `d4cbdff079e5e2270b71263d6edbfe32e5332dd1`／Tree `d9cdf6265ab09cdac6dacde0bded41b6bd107a81`への第十八次Agent／Architecture／Security再レビュー、Document Audit、Gap／Impact AuditおよびConformance Auditは、Critical／Major／Minor 0件で全て`Pass`し、`AG-DRR-016-01`を`Resolved`とした。Docker Recovery Runtime contract revision 14は、両bootstrap pairの完全確定、Root pending sourceとmove intentの不存在、通常Operation inventory通過、exact `host-begin-intent`およびbaseのinitial Host lineage一致に加え、lease解放receipt、通常完了またはHost cleanupの開始・完了Evidenceがまだ存在しないことをactive pointer適格性へ要求する。partial、pre-host-intent、move anchor残存またはpointer解放後状態のcommitted pointer／pointer journalはRecovery ID空で拒否し、削除、resume、commit再構成その他のmutationを開始しない。move完了anchor残存、pointer解放後4 Evidence、committed／journal pointer、Task admission／明示Recoveryのmutation前拒否、および正式順序のactive pointerをproduction経路で確認した。これは同固定版の完了履歴であり、後続の正式署名一般Task Runner是正へ自動伝播しない。

### 12.2 OperationのCapabilityと失効

Runtime所有Operation context Capabilityは、Runtime生成Operation IDと生成時刻を、factory所有object、Operation root／parent／prefix、rootと既知6 childのstable Filesystem Identity、Host recovery nonceおよび現行record Hashで区別したprocess-local世代へ結合する。同じ世代のcontext Capabilityとmount Capabilityが揃う場合だけ、後続store用のopaqueなmanagement binding Capabilityを発行し、Path、Filesystem Identityまたはplainな権限tokenを返さない。plain copy、偽造、別Operationの組合せ、置換済みIdentityおよび失効済み世代は拒否する。確認済みroot／child置換では世代を`retired`へ不可逆に固定してcontext／mount／management aliasを失効し、Filesystemを元へ戻しても同世代から再発行しない。active rootの別nonceまたは古いrecord Hashはroot観測・削除・失効より前に拒否する。送信開始／送信前取消はmount Capability、安定nonce、直前Hashおよび次Hashを一つのRuntime所有処置で更新する。`docker_absent_confirmed`はDocker module内の3軸不存在one-shot Capabilityを検証した非公開経路だけがmarkerを更新し、process-local世代がある場合は書換え済みrecordを変更しない狭いadopt境界で現行Hashへ同期する。同期不成立時は片側状態を信頼せずblockedとする。正常cleanupまたは検証済みHost recoveryが同一世代のroot消滅とmarker除去を確定した場合だけ世代記録を終了する一方、Identityが正常なままの未知entry、access error、marker不成立等で処置が停止しただけならOperation終了や失効を先取りしない。これはOperation bindingの内部Capabilityに限られ、Provider Home保護、Mount Grant発行、実mount、Provider process、Network、OAuth、課金、Gate、StableまたはReleaseを成立させない。

### 12.3 認証Homeの観測と権限の分離

Providerライフサイクル基盤（Provider Lifecycle Foundation）は、Codexでは既存ChatGPTプランのsubscription OAuth、Claude Codeでは既存subscription OAuthだけを標準Profileの認証方針として許可する。標準ProfileではAPI key、従量API、追加credit購入、自動plan切替および有料API fallbackを原則禁止かつ非対応とする。認証状態はローカルOS userとProviderの組合せごとに分離した永続専用Homeへ明示loginで作成し、Host既定Home、他Provider HomeまたはOperation一時領域と共有しない。Runtime所有observerはcaller Pathを受け取らず、Windows Known Folderから固定Homeを導出し、local interactive primary token、local fixed volume、stable Identity、全固定segmentのnon-reparse、selected user ownerおよびselected user＋SYSTEMだけのprotected Full Control DACLを読み取り専用で照合する。結果はProvider Home Identity、保護、SID＋login session bindingおよびsession非依存のstable logical Home bindingという四つのdomain-separated Hashを持つopaqueな10秒・一回限りの観測Capabilityへ結合し、Path、SID、login LUID、ACLまたはCredential内容を表示しない。observerはHome作成やDACL修復を行わず、観測Capability単独でAuthority、Operation Capability、Mount GrantまたはProvider spawnを成立させない。

### 12.4 Mount Grantの発行・消費・終了

専用Provider Homeマウント許可（Provider Home Mount Grant）のCoreは、`prepared`、`issued`、`consumed`、`revoked`の構造、最長5分、使用上限1回、およびProvider・Profile・Operation・Provider Home Identity／保護状態・selected local user・stable logical Homeへのbinding候補を検証する。Runtime-owned lifecycleはcaller supplied Operation ID、観測Hashまたは時計を受けず、同じOperation世代のopaque management Capabilityと、一回限りのRuntime所有Provider Home観測CapabilityからだけGrantを発行する。consume時はfresh観測の四HashとProviderを再結合し、使用aliasを一回で失効させる。古いGrantのcomplete／revokeは、そのGrantが現在のactive mount ownerである場合だけactive entryを除去でき、後続Grantのleaseを消さない。revoke時は当該Grantの全aliasを同時失効し、process restartではprocess-local aliasを失ってfail closedとする。実mount中のactive lease、kernel lock、active pointerおよび耐久回復記録はDocker recovery contractが所有する。Runtime-owned Codex／Claude AdapterはMount Authorizationのactive leaseと内部mount sourceをprepared planへ結び、固定Docker Effect executorが実Provider Homeを`rprivate`でbind mountする。cleanup不明時はResultを公開せず、token、Credential、session内容またはPathを返さない。

### 12.5 同じHomeを使うStageの直列化

Executor、Reviewerおよび一回限りの是正（Remediation）が同じlogical Provider Homeを使う場合も、同時利用は許可せず、Stageごとにlock、active leaseおよびactive pointerを閉じてから次Stageが新しいRecovery IDで直列に取得する。完了済みStageの耐久回復記録は共通Host cleanupまでfinalizableなEvidenceとして保持し、Host cleanup後に各receiptと記録を順に最終化する。WindowsではNTFSの同名file tunnelingにより、一時fileから固定名へのatomic rename時に作成時刻が変わり得るため、renameの連続性はexact bytesと同一volume／file IDで確認し、rename後の最終Identity全体をcommit sidecarへ結合する。Windows以外では作成時刻もrename前後で一致させる。これにより同じHomeの直列Stageを許可しても、置換、並行取得、bytes不一致または最終Identity不一致を受理しない。

### 12.6 Claude実行計画と配布物の検証

#### 結果の拒否理由

Claudeの結果を拒否する場合は、終了状態、turn数の形式、選定上限の超過、利用量メタデータ、Reviewer本文の搬送形式を固定理由で区別する。値やProvider本文は公開しない。分類は受理条件を緩めず、上限超過という観測もProvider側の上限制御が成立した証明にはしない。Docker Controllerから通常Taskの結果投影へ理由を保持する。資源回収が不明なら回収不明の理由と既存Recovery IDを優先し、結果不適合を理由に成功へ補正しない。

CLIが`error_max_turns`を返した場合は`provider_turn_limit_exceeded`、成功Envelopeが選定上限より大きい回数を報告した場合は`provider_task_result_turn_limit_mismatch`とする。前者の停止報告と後者の結果不整合を混同しない。どちらも成功へ補正せず、報告値そのものは公開しない。

#### 配布物と認証・隔離の結合

Claude実行計画候補（Claude Execution Plan Candidate）は、最初の外部ExecutorをClaude Codeへ限定する。公式release manifestのLinux x64 binary `2.1.220`、upstream commit、SHA-256、byte長および固定絶対path `/opt/crdd/providers/claude/2.1.220/claude`を一つのartifact Identity候補として結合する。2026-08-24にAnthropic release signing key fingerprint、detached manifest署名、binary byte長／SHA-256、固定Provider image digestおよびexact argv互換性を検証した。`--bare`はOAuth／Keychainを使わないため除外し、`--safe-mode`、空settings sources、空MCP、tool 0、boolean Structured Output、最大2 turns、API相当budget `$0.10`、session非永続およびplan permissionへ固定した。専用Provider Home、親環境を継承しない最小環境、internal Provider networkと限定Proxy、Claude Max Subscription OAuthおよびnormalized `{status:true}`の実requestをtransient vertical sliceで確認し、container／network残存0とした。Local Personalのユーザー指示による公式CLI利用だけを対象とし、再配布許可や一般的な自動利用許可を主張しない。Runtimeは固定image、selected-user Provider Home observer、Mount Grant、最小環境、限定Egress、外部送信Grant、Subscription OAuth preflight、Operation Authority、Revisionおよびcleanup／Recoveryを必須Gateとして接続する。標準Profileは既存Subscriptionだけを使い、API key、Console API account、第三者API Provider、追加credit購入、自動plan切替またはquota不足からの有料API fallbackを許可しない。有料APIは将来の別Profile／別Capabilityであり、ユーザー設定だけでrequest、購入またはAuthorityを発行しない。

#### 試験用処理の境界と過去観測

- 現在のFake境界は三層に分かれる。
- 合成Fake観測候補（Synthetic Fake Observation Candidate）のpure Coreはprocessを実行せず、caller claimを非Authorityの`candidate`へ限定する。
- 明示`doctor --isolation`の動的Fakeは診断用Docker／一時Filesystem Effectを伴い、固定Docker Desktop Linux Engine上の正常scenarioについて、Fake限定結果、container／process tree不存在およびHost cleanupを同じrunで確認済みである。
- 専用verificationでは同じ固定経路のtimeout、出力上限超過、不正結果およびnonzero exitに加え、固定Fakeへの`SIGTERM`取消要求、Fakeの受領確認と終了、ホスト側Docker CLI attachプロセス（Host Docker CLI Attach Process）のclose、container不存在およびHost cleanupを実Dockerで確認済みである。
- 通常の`doctor --isolation`は同期経路のままで実行中取消を受理せず、実Provider取消、任意signal、意図的なcleanup失敗または残存containerの実測は`Not Verified`のままである。
- 通常の`doctor`は動的Fakeを発火しない。
- 実Claude Codeと実Codexは、それぞれの専用Home、限定Proxyおよび既存Subscription OAuthによるboolean requestまで確認した。
- Codexは公式Sigstore bundle、release artifact、固定image、`gpt-5.6-sol`、低推論、通常速度、read-only sandboxおよびexact `{status:true}`を同じrunで確認し、残存Container／Networkを0とした。

#### 通常Taskへの接続と内部子Processの環境

- Runtime所有Provider Home read-only observer、Mount Grant issue／consume／revoke、prepared plan consume、Mount lease完了、Host Recovery遷移、固定Docker Effect executor、署名Release結合Local Personal Authority、Provider EligibilityおよびRepository／Revision bindingはproduction storeへ接続済みで、Codex／Claudeの両AdapterをRepository bindingからResult後のOperation root回収まで一つのCoordinator facadeへ縦結合した。
- Windows内部子Processは親環境を継承せず、Runtime所有・署名検証済みNative Helperだけが、読み込まれたOS moduleから確認したWindows Directoryと`os.userInfo()`から確認した選択ユーザーのProfile Pathを受ける。
- Provider Home要求は読み取り専用観測に限定し、Candidate Store／Runtime State要求は読み取り専用観測と`initializeIfMissing: true`による固定Rootの明示初期化Filesystem Effectを分ける。
- このProfile Pathは`SHGetKnownFolderPath`によるLocal App Data展開にだけ必要なOS Contextであり、Authority、初期化許可またはselected-user成立ではない。
- 環境変数`USERPROFILE`のcaller値、`LOCALAPPDATA`、Credential、ProxyまたはPATHをAuthorityとして受理しない。
- Native Helperは展開後のKnown Folder、固定segment、selected-user token、Identity、non-reparse、fixed volume、ownerおよびprotected DACLを独立に再確認する。
- Effect executorは承認済みDocker CLIの絶対Path・byte長・SHA-256、固定Linux Engine、空のRuntime所有config、親環境を継承しない最小環境および認証preflightを含むexact 9 commandだけを受理し、所有label確認後の削除と不存在再確認へ閉じる。
- 認証は無通信・読取専用Provider HomeのpreflightでSubscription OAuthを確認し、quotaは上限付きrequest内でだけ確認する。

#### 一般Taskの入力・候補・終了

- 一般Task facadeは、Revisionと送信Scopeへ結合したLocal Userの対話的外部送信Grant、明示Read Projectionだけを含む開始Commitの隔離workspace、stdin専用の一回限りTask Packet、説明可能なExecutor選定、書込み可能なExecutor、Candidate Revision、対象Providerを除外した読取り専用の独立Reviewer、Candidate再照合および全cleanupを一つのOperationへ接続した。
- Provider HomeのDocker名はProvider Home Identityから決定し、同じHomeへの別process同時書込みまたはcrash residueを自動takeoverせずfail closedにする。
- Executorの自己申告Pathと実差分が一致しない場合、Reviewerが承認しない場合、Reviewer中にCandidateが変わった場合、取消後またはcleanup不明時はResultを公開しない。
- 承認済みCandidateは内容Hash付きopaque IDで一時保存し、Operation cleanup後に明示export／discardできる。
- `coordinator task --request-stdin`はRepositoryを現在Directoryへ固定し、重複keyのない上限付きJSONだけを標準入力から受ける。
- Task本文、Host Path、Credential、生Provider出力、summaryおよびfinding本文をargv、環境または公開結果へ含めない。

#### 正式実測の根拠と未証明範囲

- 署名済み`Codex Front → Claude Code Executor → Codex Independent Reviewer`の固定1 Path成功経路では、exact Candidate検証・破棄、cleanupおよびHost残存0まで確認した。
- 固定Evidenceは[`CHG-000015`](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)を正本とし、逆方向を含む4指定経路と固定Workerによる失敗Recoveryは[署名済みE2E結果](../../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_0c3e6d2.md)で実測済みである。
- 実Provider取消および実Providerの是正経路は未証明のままであり、Runtime全体、統合およびReleaseも未完了である。

### 12.7 Candidate Storeの排他Identity

Candidate Store排他objectの安定IdentityにはSessionごとのAuthentication IDを使わず、選択ユーザーSID、Store実体およびexact保護状態へ結合したProtection Hashを使う。同じユーザーの別ログインSessionも同じlockを共有する。

### 12.8 選定許可と適格性の後続確認

委譲選定許可（Delegation Selection Grant）候補は4経路候補をRuntime-owned Operation management Capability、事前選定候補、検証済みProvider Profile、subscription OAuth、通常速度、壁時計／単調時計および暗号学的乱数へ結合する。controlとuseを別opaque aliasにし、最大30秒・一回限りとする。公開結果にはexact model、推論、経路と理由を表示するが、Selection GrantだけではProvider AuthorityまたはEffectを発行しない。productionのProvider適格性観測器（Provider Eligibility Observer）は固定2 Providerの必要Capabilityを確認し、Provider Home、Subscription認証、公式配布物およびPolicyを後続preflight、quotaを許可済み上限付きrequest内の`bounded_request_check`として明示的にdeferする。これは実適格性の証明ではない。caller claimを受理せず、明示`unknown`は`observation_unavailable`として同一Provider fallbackへ使わない。後続preflightが不成立ならProvider request前に停止し、request開始後の失敗は同じOperationで別Providerへ自動再送しない。Provider Profile resolverは固定4 Profileへ、Codex／Claude Effectはそれぞれの固定Docker Adapterへ接続済みで、Operation／Provider／Profile／model／effort／speed／理由を再照合してからprepared planを作る。

### 12.9 Docker Adapterと結果公開

Claude Docker Runtime Adapter候補は、同じRuntime-owned Operation世代のmanagement／mount Capability、active Provider Home mount lease、説明可能な選定候補、固定Claude／Proxy image、最小環境およびOperation専用Network topologyを30秒・一回限りのopaque prepared planへ結合する。Provider Home sourceはWindows Known FolderからTypeScriptとnative observerが独立導出したHashへ結合し、raw Pathをwire、Grantまたは公開結果へ含めない。Providerはinternal Networkだけ、Proxyはinternalと専用Egress Networkだけへ接続し、親環境、API key、Host Network、Docker socket、repository mount、shell、PATH探索、Provider直接Egressおよび別Engine fallbackを候補に含めない。Process Controllerはprepared planを一回だけconsumeし、setup 10秒、Provider 300秒、取消猶予5秒、出力上限、所有resource cleanup、Mount lease解放およびRecovery完了を一つのGateにする。boolean Probeと一般Task ExecutorはClaude Structured Outputを受けてもCRDDが再検証し、一般Task Reviewerは通常JSON Envelopeの`result`を単一・重複keyなしJSONとしてCRDDが検証する。いずれもProvider内蔵Schemaの成功申告をAuthorityにせず、正規化Resultは全cleanup成功後だけ公開する。cleanup不明時はProvider requestが成功していてもResultとHashを破棄し、回復ID付き`manualRecoveryRequired`へ閉じる。隔離E2EではSelection GrantからClaude Adapter、5秒・一回限りのRuntime Provider Authority発行／再検証／消費、Process Controller、構造化ResultおよびRecovery完了まで通過した。Local Personal一般TaskではProvider Profile resolver、両Provider Adapter、検証済みDocker CLI Effect executorおよびdurable Recovery adapterをproduction経路へ接続済みである。Provider eligibilityは事前候補に留まり、Provider Home、公式配布物、PolicyとSubscription Offeringの後続preflightが不成立ならProvider Request前に停止する。source checkoutは正式署名Release Authorityを欠くためEffect前に`blocked`となる。

### 12.10 Codex内側sandbox

Codexの一般TaskはDocker隔離だけを理由にCodex自身のcommand sandboxを無効化しない。固定Codex `0.149.1`と同じ公式Releaseの`bwrap-x86_64-unknown-linux-musl`を、OpenAIのGitHub Actions署名Identity、Sigstore透明性ログ、archive／binary／bundle SHA-256およびbyte長へ照合し、固定image内の`codex-resources/bwrap`へ隣接配置する。image build時だけ組み込み、Runtime時download、PATH探索、OS package fallbackまたは`--dangerously-bypass-approvals-and-sandbox`を許可しない。内側sandboxが固定Codex executableをcommand wrapperとして再起動できるよう、そのexact Pathだけをminimal readへ追加し、Provider Home、Root全体または任意`/opt`を開かない。互換Profileでは不安定な`code_mode_host`を明示無効化し、公式CLIのstable `shell_tool`／`unified_exec`を使用する。外側のread-only root、non-root、capability全削除、`no-new-privileges`、限定mount／Egressと、内側のRole別Filesystem／Network permissionを同時に維持する。


<a id="development-provider-measurement"></a>

### 12.11 開発版による限定実測

更新実装の実Provider比較は、通常の署名不要な開発E2Eとも、正式署名配布物の検証とも区別する。人間が固定開発版を実行元として明示承認した場合だけ、既存Subscriptionによる限定実測へ接続する設計とする。正式署名済みという結果へ読み替えず、通常CLIの署名要件、秘密保護、外部送信、隔離、取消および復旧は維持する。

実測範囲・回数の純粋制約とFilesystem観測を、[開発実測session](../../40_Develop/coordinator/src/security/development-measurement-session.ts)から既存Task Runtimeへ明示接続する。sessionは実体観測、人間の一回の実行開始確認、現在時刻と単調時計、実Operation／Repository Bindingを所有し、偽造不能なprocess内参照を発行する。純粋制約の`productionAuthorityConferred: false`や試験用factoryの結果を、そのまま実行許可へ昇格しない。[制約の契約試験](../../40_Develop/coordinator/tests/development-measurement-constraints.contract.test.ts)、[Filesystemの契約試験](../../40_Develop/coordinator/tests/platform-provisioner-package-filesystem.contract.test.ts)、[sessionの契約試験](../../40_Develop/coordinator/tests/development-measurement-session.contract.test.ts)を分け、実Directory／Git Treeの照合と試験用の承認・時計・Operation観測を混同しない。実Provider比較の完了は別の実測結果を必要とする。

開発ソースの観測は、正規化した実Directory、配布Tree、package内容Hash、およびCLI・Console reader・二つのLock子Processのentrypointを照合する。古いmanifestやnative実行物の混入、Git管理Directory、リンク、entrypoint欠落、不正入力は拒否する。同じ内容を別Directoryへ差し替えた場合も、Path、volume、file identity、作成時点を含む`sourceIdentitySha256`が変わる。これは観測時点の内容とDirectory実体の識別であり、人間承認、CommitとTreeの対応、以後の不変性または実行許可を証明しない。

再利用するnative配布は開発ソースとは別Rootに保ち、固定Release鍵によるmanifest検証、期待したRelease Identity、配布Tree、WorkerとSupervisorの全artifact field、およびSupervisorが保持するWorker Hashの結合を検査する。`nativeIdentitySha256`に配布Rootの実体を含め、検証完了時に再照合する。結果の`nativeReleaseSignatureVerified: true`はこのnative配布だけを対象とし、開発ソースへRelease Trustを付与しない。観測はnative／Provider起動を行わない。後続Runtimeは実行直前の現在時刻と再観測を所有し、Callerの時刻や過去の観測結果をAuthorityへ読み替えない。

限定実測sessionは、承認したRepository、固定Commit／Tree・package Hash、検証済みnative配布のIdentity、Taskの読取り・変更投影と経路、期限を正規化して一つの`bindingSha256`へ結合する。各`scopeSha256`はTaskと経路を含む完全な実測範囲のdigestとする。共有Task parserで確認前にsnapshotし、待機中の入力変更を許可範囲へ取り込まない。確認前後と新規Effect前に実体と期限を再観測し、Caller／Providerの自己申告Hashでは代替しない。純粋制約が扱うのは一致と計数だけである。

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

Docker実行部には、通常の署名・Provider Authorityとは別に、呼出し単位の追加制約を明示的に渡せる。これは起動を拒否する機能だけであり、`true`でも既存の認証・権限・Revision確認を代替しない。通常呼出しの未指定時は既存動作を維持する。制約へ渡すのは検証済み計画の固定command種別だけとし、Path、Prompt、Credential、planまたはCapabilityを渡さない。各commandは直前の待機と必要な耐久submission記録を終えてから制約を同期評価し、厳密なBoolean `true`の場合だけ開始する。例外、非Boolean、Promise、非同期関数またはProxyは拒否し、例外本文は結果へ出さない。制約の評価中に取消が発生した場合も新しいcommandを開始しない。

制約拒否は`docker_process_controller_execution_restricted`として既存の回収経路へ戻す。Provider開始前の拒否を`providerRequestStarted: true`と報告しない。制約をcleanup、取消、終了確認へ再適用せず、既存資源の不存在、Mount完了、Recovery完了を確認し、不明ならRecovery IDを保持する。command制約より前に行うOperation、Mount、Authority、Recovery準備の許可は各所有者が引き続き確認するため、この制約だけで限定実測の全Effectを制御できたとは扱わない。

[Docker Controller契約試験](../../40_Develop/coordinator/tests/docker-process-controller.contract.test.ts)は、全9commandでの拒否、既存Authority不成立、準備待機中の期限切れ・取消・Identity変更、Provider開始時だけの単回消費、制約内取消、回収不明と既存利用側への結果伝播を確認する。実commandの起動と資源観測は試験用実装であり、実Docker／Providerや真正な開発sessionの成立証明ではない。

Task受付からの接続は次の所有関係を維持する。

| 接続先 | 開発許可の確認 | 失効・終了後の扱い |
|---|---|---|
| Task／Provider Authority | genuine OperationとRepository／Revisionへ結合し、既存Authority生成・消費時にも再確認 | cacheが残っていても新規発行・消費を拒否 |
| Home／Runtime State／Candidate Storeのnative観測 | 明示したsession contextと、別Rootの署名済みnativeだけを使用 | 不正contextを通常署名経路へfallbackしない |
| 外部送信同意 | 既存同意の読取り・保存に同じOperationの観測contextを渡す | 開発版の実行許可とProvider送信許可を混ぜない |
| Docker／Workspace | 既存の状態機械・資源所有者を使い、準備と各起動の前に制約確認 | 既存の取消・cleanupへ合流し、新しい資源台帳を作らない |
| Candidate Store | 作成時点に同じOperationへIDを登録し、保存・公開前に許可を再確認 | 無関係な期限切れ候補のGCをしない。今回の候補だけ破棄する |
| cleanupのnative観測 | 既存所有者へ私有の読取り専用contextを渡す | 期限切れ・取消後も実体が一致すれば観測可能。ただしRoot初期化、差替え、process不明は拒否 |

native配布の検証はsessionの本番observerが所有する。各借用で新しく得た検証結果を、その回のIdentity objectへ私有のWeakMapで結合し、Provider Home／Candidate Store／Runtime StateのWindows Adapterへ同期的に渡す。Adapterは直後の同じ配布全体の検証を重ねず、この結果を使う。Identityの3つのHashと許可範囲digestは変更しない。Callerが渡したHash、別のIdentity object、試験用factoryの結果、以前の成功結果で置き換えない。検証結果が結合されていなければ停止し、通常署名経路へfallbackしない。

この共有はsession全体のcacheではない。Adapterは結果を保存・非同期転送せず、子Process直前と直後のartifact照合、署名観測、nonce・応答・終了確認、および終了後の新しいsession観測を残す。次の借用は毎回配布とRepositoryを再観測する。通常署名CLIは従来の配布検証を使用する。共有によって並行したHost改変の完全検出を主張せず、既存の前後観測とT1～T2の保証範囲を維持する。

[本番sessionとAdapterの結合試験](../../40_Develop/coordinator/tests/development-native-observation.integration.test.ts)は、Codex／Claude Home、Store／Stateの読取り・初期化という6利用形態で、正常時に全体native検証が3回から前後2回になること、各借用が別の新しい結果を使うこと、前後の差替え・観測失敗・不正context・環境不成立で権限を返さないことを確認する。取消・期限切れ後は新規処理を拒否し、所有cleanupの読取りだけを維持する。OS観測とProcessは試験内の代替であり、実native・Providerの成立は別の実測で確認する。

比較入口は[`measure-development-providers.ts`](../../40_Develop/coordinator/scripts/measure-development-providers.ts)である。固定開発配布内のこの入口を検証済みNodeの絶対Pathから起動し、作業Directoryは対象Repositoryとする。入力は検証したRepository Root直下の`.crdd/dogfooding/development-measurement-request.json`、結果は同Directoryの実行固有JSONに置く。公開設定だけを入力に使い、Credentialや承認boolを格納しない。実行中は2Taskを直列に一回ずつ処理し、同じTaskの自動再試行、process再開、上限補充、Docker Desktop修復は行わない。回収不明またはprocess再起動要求では次Taskを開始せず、sessionを失効する。経過時間はRuntime結果までであり、人間の受入時間や品質の総合点とは扱わない。[比較入口の契約試験](../../40_Develop/coordinator/tests/development-provider-measurement.contract.test.ts)はこの順序と停止を検査する。

別process Recoveryはsession再発行ではない。既存のexact Recovery ID、保護済みRoot、明示Recovery契約から再観測する。耐久形式を変更していないことだけで旧配布との互換性を推定せず、実測で使用する配布との書込み・読取り・復旧を別processで確認する。native保護観測や実Docker操作を試験用観測に置き換えた互換性試験は、その境界まで実測済みとは扱わない。

限定実測の時間は[受動計測](../../40_Develop/coordinator/src/core/development-execution-timing.ts)で取得する。Taskの既存状態遷移を観測し、状態ごとの非重複区間、最初の状態通知までの時間、今回候補の破棄を含む終了までの時間を返す。実装／レビュー区間は起動準備、Provider処理およびその回収を含み、モデル推論時間ではない。正常・是正・停止の既存状態を使用し、計測のためのRuntime状態、timer、listener、再試行または権限を追加しない。通常署名Taskの公開Schemaや標準エラー表示は変更せず、開発Taskの外側の結果にだけ`executionTiming`を付ける。Task完了Promiseが例外となった場合、比較入口revision 2はpure snapshotを`incompleteTaskTiming`に残し、元の停止・回収不明分類を維持する。Task予約自体の例外では取得対象がなく`null`となる。

Identity observerは初回許可前、session再検査、失効後cleanupの直接観測を同じ同期ラッパで数え、失敗も含めて累積時間を記録する。既存の最終`inspect`による再観測も含める。session全体の`identityObservation`には人間確認前の検査とTask間の検査も含まれるため、Task区間と同じ時間範囲ではない。Task区間に内包される検査時間もあるので、両者を合算して総時間としない。診断取得用の`readExecutionTiming`は観測・I/O・Authorityのないsnapshotに限定する。

計測時計は`performance.now()`を用い、Authority用時計の呼出し回数・時点を変えない。時計例外、非有限値、逆行または通知上限では計測不完全を明示し、不明時間を0へ補正しない。元observerの値・例外・呼出し順、失効判定、cleanupおよびTask結果は維持する。状態通知は既知の閉集合に限定し、重複を除いて最大32区間を保持する。終了後の通知は無視し、snapshotは変更不能な値として返す。

進行表示は開発入口が所有する固定日本語文だけを標準エラーへ出す。最大32回・1回256 bytes以下、同期書込みの例外または不足byteでは以後の表示を停止し`progressOutputConfirmed: false`を返す。これは書込み結果であり、人間が見た証明ではない。任意のcaller callback、Task本文、Path、Capability、CredentialまたはProvider自由文は渡さない。同期出力先が遅い場合の待ち時間は実時間へ影響し得るため、計測の有無で実時間・期限超過率が必ず同一とは主張しない。計測結果・表示成功を実行許可、cleanup成立、品質または人間受入の根拠にしない。[計測契約試験](../../40_Develop/coordinator/tests/development-execution-timing.contract.test.ts)、既存Task試験、session試験、比較入口試験を接続してこの境界を確認する。

<a id="release-artifact-binding"></a>

## 13. 署名と内部成果物の結合

### 13.1 署名対象と配布内容の一致

`<absolute-staging-root>`には対象Git Treeのblob byteを変換せず展開したCRDD配布物と、固定Path `90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe`へ配置したlocked release build成果物が必要である。Windowsを含め、Release archiveは`git -c core.autocrlf=false archive`相当で生成し、改行変換された作業Treeを流用しない。`issued-at`と、期限付きの場合の`expires-at`はミリ秒を含むcanonical UTC、例えば`2026-08-26T02:39:49.000Z`を要求し、Version、Git Object Formatおよび有効期間の順序とともにpassphrase入力・Filesystem観測より前に検証する。`releaseSequence`は1以上のsafe integerとしてReleaseごとに単調増加させ、同じ値を別Identityへ再利用しない。commandは同Rootの`40_Develop/coordinator`とRust成果物を安定したnon-link fileとして再走査し、package content root、Root保護Policy、鍵保管Policy、Rust target／protocol／toolchain／byte長／SHA-256を署名payloadへ入れる。固定Path loaderはBOMなしRFC 8785 canonical UTF-8だけを同一file handleで読み、署名Coreへ渡す。Release Identity候補は配布Root全体のGit Object IDをnon-linkの同一handle読取りから再計算し、後置manifestと後置Rust成果物を除外したRoot Treeを署名済み`crddTree`へ一致させる。Rust成果物の読み取り専用観測候補と、明示Release署名commandによるmanifest配置処置は実装した。後者はリリースステージングのファイルシステム処置（Release Staging Filesystem Effect）であり、Release採用、署名Authority、Runtime Authority、CapabilityまたはProtection成立を付与しない。端末側stateは次候補exact 1件の`staging`と現在候補exact 1件を示す`active-pointer.json`だけを使う。有効ポインター（Active Pointer）のcanonical codec、単調な直前Hash遷移、Supervisor前後の選択user再観測と停止中子processの同一logon session／固定AppContainer SIDを要求するbinder source候補、および安定同一file読取りは実装した。binderとETWを含む正式署名runは完了したが、native durable有効ポインター切替、保護済みactiveおよびRuntime readerは未完了である。旧release floor／active release／transactionの互換読取り、自動rollbackまたはDirectory探索fallbackはない。source checkoutのように固定manifestまたは成果物結合がない場合はPath入力やprocess起動より前に`blocked`となる。Root観測への接続、DACL適用、staging配置およびEffect controllerは未実装である。DACL構造claimのpure評価、Rust Coreまたは成果物観測・署名manifest候補だけでは保護成立を主張しない。SID、Path、ACEおよびraw errorは公開しない。実装、設定、試験および相対レイアウトはRepository内を正本とし、端末固有の導入状態、秘密鍵、旧配置aliasまたはshimをRepositoryへ含めない。実鍵によるmanifest生成は、対象Sequence／Version／Commit／Tree、有効期間、Rust release成果物および配布ステージングRootをRelease判断で固定した後にだけ行う。manifest配置後の同一fd再読取り、成果物またはRootの再確認に失敗したステージングRootは自動削除せず保持し、再利用または再署名を禁止してRoot全体を破棄し、新規ステージングからやり直す。

### 13.2 内部成果物の署名結合

manifest revision 2／3では、上記worker成果物に加えて`90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe`のnative supervisor成果物を別Identityとして必須にする。署名payloadは両成果物の固定相対Path、target、Rust toolchain、byte長、SHA-256と、それぞれのprotocolまたはentrypoint contract revisionを結合する。native entrypoint contract revision 2は、`no_std`／`no_main`、固定entrypoint、raw command lineのexact `provision`だけ、段階別固定blocked byte、終了2またはWorker終了値、stderr空を要求する。locked release PEの決定論的検査はx64／CUI、実行可能entrypoint、ASLR／NX、`ADVAPI32.dll`、`bcrypt.dll`、`CRYPT32.dll`、`KERNEL32.dll`、`USERENV.dll`および`WINTRUST.dll`の実装所有exact API集合、delay import／TLS／bound import／CLR 0、非実行・非書込みsection内のworker Hash結合を確認する。native成果物観測は同一fdから所有した上限付きbyteへPE検査を行い、その同じbyteからSHA-256とmanifest artifactを投影する。Release stagingはsupervisor内部のworker Hashと同時に観測したworker artifact Hashの一致を必須とする。実行時は固定Ed25519公開鍵でcanonical manifestを検証し、両成果物の同一handle byte長／Hash、全parent non-reparse handle、fixed local volume、worker loaded imageのPath／file Identityを同じrunへ束縛する。Ed25519 manifest signerとAuthenticode publisher certificate SHA-256は別のTrust軸であり、いずれかの未設定、差または失効判定不能を成功へ流用しない。旧manifest revision 1、entrypoint contract revision 1、別成果物へのaliasまたは欠落時fallbackはない。

### 13.2.1 配布manifestの期限付き・期限なし

正式配布を日時だけで停止させない場合、manifestとenvelopeのrevision 3で必須キー`expiresAt`をJSONの`null`とする。revision 3はcanonical UTC文字列による期限付き配布も許可する。旧revision 2は期限付きUTC文字列だけを受理し、署名対象の意味を変更しない。旧revision 1と未知revisionは拒否する。envelopeとpayloadのrevisionは一致しなければならない。

revision 2は既存V2、revision 3はV3のdomainでcanonical payload全体を署名する。キー欠落、undefined、空文字、文字列`"null"`を期限なしへ補完しない。TypeScriptの署名・現在検証・過去署名検証と、Native Supervisorの検証は同じ形式・署名契約を実装する。現在の実行に使う検証では発行前を両版とも拒否し、期限付きは`issuedAt <= now < expiresAt`、revision 3のnullだけは`issuedAt <= now`を要求する。過去署名検証は従来どおり来歴確認であり、現在時刻での有効性や現在の実行権限を発行しない。期限やrevisionを改変した旧署名は通らない。

署名CLIの`--no-expiry`と`--expires-at <canonical-utc>`は排他的で、片方を必須とする。不正指定は秘密入力・署名・manifest配置の前に拒否する。Git Tree、package内容、固定公開鍵、単調sequence、WorkerとSupervisorの成果物Identityは従来どおり結合する。期限なしはその配布物の時間上限だけを除き、Grant、同意、候補、準備記録の期限・取消条件を変更しない。オンライン失効機構、永久サポート、将来の安全性を追加保証しない。

### 13.3 通常Runtimeと準備候補の区別

本設計で「検証済み実行イメージ」「上限付きプロセス」または「プロセス起動は未実装」と記す箇所は、特記がない限り通常Runtime／Adapter側の状態を指す。[Coordinator Runtime 1.0](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)へ統合したpre-active native source候補は別の限定入口であり、Coordinator Runtime 1.0の最小信頼境界（Minimum Trust Boundary）として正常OS、OS認証済みの選択ローカル対話ユーザーおよび人間が真正性を確認した公式署名Releaseを信頼計算基盤（Trusted Computing Base、TCB）に含める。mapped supervisor image専用blockerはsourceから除去した。固定commit `afb6b70`の正式署名AppContainer runでは、Supervisor前後の選択user再観測、停止中子processのlogon session／AppContainer SID直接結合、PA03／PR03、worker exit 0、Job／tree終了、System32限定module集合、対象Network event 0、loopback陽性対照28 event、trace loss 0およびHost復元を同じrunで確認した。観測対象RootはOS所有read-only probeであり、Repository Mount Grant、Authority、通常Runtime Gateまたは実Providerは未成立である。詳細境界は[振る舞い仕様の診断・有効化候補・回復の公開境界](../../05_SPEC/01_Behavior_Specification.md#診断有効化候補回復の公開境界)に記載する`coordinator provision`に従う。

`state/active-pointer.json`のcodecと安定同一file読取りはcomponent候補である。native durable store、stagingからactiveへのatomic切替および保護済みRuntime readerは未実装で、端末状態を作成・更新しない。旧`release-floor.json`、`active-release.json`または`provision-transaction.json`を読み替えず、Directory探索や自動rollbackも行わない。readerはProgramData探索、pointer、manifestまたはpackage読取りより前に`blocked`となる。単独component候補またはRelease Staging Filesystem EffectをGate、Runtime AuthorityまたはRuntime Capabilityの成立根拠へ流用しない。

### 13.4 Provisioning候補の呼出し境界

`coordinator provision`はPlatform Provisioningの明示commandである。Node CLIはgrammarと表示optionだけを解析し、process前に`blocked`となる。native `coordinator.exe provision`のsource候補は、exact argv、manifest revision 2／3の全field・canonical順序・§13.2.1の現在性条件、両成果物の同一handle byte長／Hash、配布volume rootからleafまでのbounded non-reparse handle、delete共有なし、およびlocal fixed volumeを要求する。worker向けsource候補は既存AppContainer profile、handle継承0、PID結合local pipe、PA03／PR03、create-time single-process Job、子孫禁止、終了後active process 0、loaded image照合およびDLL load mitigationを含む。現在processへ既にmapされたsupervisor imageと、後から固定Pathでopenした署名済み成果物を原子的に自己結合する方式は未確定だが、悪意ある同一ユーザー、Administrator、kernelまたはOS／Verifier侵害への完全なtamper resistanceをv1対象外とするMinimum Trust Boundaryにより、専用blockerはsourceから除去した。これは方式の成立、Verified Imageまたは攻撃検出を主張しない。固定commit `afb6b70`の正式署名component runではselected-user binder、PA03／PR03往復、Job収容、終了後tree不存在、全module集合、Network非発火、陽性対照およびrollbackを同時確認した。観測対象はOS所有read-only probeであり、Repository Mount Grant、Authority、Gateおよび実Provider requestは未成立である。`QualLab.CRDD.Coordinator.Provision.V1` profileはcapability 0の既存前提で、Coordinatorは作成、削除、再作成または自動修復しない。正式署名成果物、固定publisher、manifest／artifact一致および残る対象内条件が揃わなければworker生成前にfail closedとする。通常run、`doctor`、`activate`、`disable`、source checkout、開発build、`cargo run`、PATH、Shell、installer、別binary、自動retryまたはfallbackからは発火しない。自己Hashまたは自己署名検証を人間による初期Trustの代替にせず、結果をselected-user binder、保護済みactive、Root Protection、Authority、Capability、GateまたはReleaseへ昇格させない。Provider／Agent同士の直接spawnとbootstrapへの逆方向制御はv1でも禁止する。一方、Front Codex／Claude CodeからCoordinator Gateを経由し、Codex／Claude Code Executorを選ぶ4経路は、Coordinatorが各子を独立して起動しAuthority縮小、再帰深度、予算、Credential境界および終了を管理する仲介InvocationとしてRuntime 1.0の完成対象に含める。Provider自身が別Providerを直接起動したり、別Provider Credentialを取得したりしてはならない。

### 13.5 準備候補の保存・署名・適格性

承認済みのプラットフォーム準備方針は、CRDD配布物の`40_Develop/coordinator`に内包するprivate packageのプラットフォーム準備処理（Platform Provisioner）を明示`provision`からだけ呼び出し、初回setupだけに管理者操作を集約する目標である。package manifestのexact object、Ed25519署名、package content root、固定公開鍵、Policy Identity、canonical loader、Release Identity照合およびRust成果物の署名済みHash結合は実装済み候補である。Windows v1で許可するRuntime主体は明示provisionで選択したローカル対話ユーザー1名だけである。Supervisor自身の`TokenUser` Identity Hash、primary token、enabled interactive／service／batch／network group、restricted token、AppContainerおよび非zero sessionを分類し、local interactive primary nonzero-sessionだけを許可する。Worker起動前後のSupervisor `TokenUser`／`AuthenticationId`／分類一致に加え、停止中子processのprimary、`TokenIsAppContainer=1`、同じAuthenticationIdおよび導出済み固定AppContainer SIDをSupervisorが直接確認するbinderをsource候補へ実装し、固定commit `afb6b70`の正式署名runで成立を確認した。AppContainer内WorkerのTokenUserは選択user同値と仮定せずbinder Authorityへ使わない。Rust wire revision 3は生SID、session ID、AuthenticationIdまたはgroup SIDを返さず固定bitへ写像する。サービスアカウントは将来候補に限り、v1では未実装で`blocked`とする。WindowsのDACL構造claim評価はcaller claimをPolicyと比較するpure候補に限り、binder候補だけから実効権限を成立させない。明示Release署名commandだけがmanifestをstaging Rootへ配置するが、DACL設定・再検証、native durable有効ポインター切替、保護済みactiveおよび通常Runtime接続は未実装である。結果はfile Path、生byte、descriptor、生SID、session ID、group SID、ACLまたは署名を公開しない。

package Trust Gateのpure集約候補はmanifestを内部で再検証し、CRDD Revision、同じpackage content rootおよび安定file Identityを一つの観測契約へ結ぶ。callerが任意Rootを指定する観測入口は非Authorityであり、その結果をEffect許可へ変換しない。Windows permission policyと実効アクセスは未確認のため、固定制御経路のEffect controllerも`not_implemented`である。成功したpure検証からRuntime Authority、CapabilityまたはFilesystem Effectを発行しない。

Windows v1で許可するRuntime principalは、明示provisionで選択したローカル対話ユーザー1名だけとし、既存Root Protection Policyの排他的writer条件を上書きしない。Supervisorのlocal interactive primary tokenを起動前後で再観測し、停止中子processの同一logon sessionと固定AppContainer SIDを直接確認するbinder source候補を実装し、正式署名runで成立を確認した。ただしprotected active、Root Protection、Repository Mount Grantおよび通常Runtime再確認へ未接続なのでRuntime主体はまだ成立しない。server専用サービスアカウント（service account）は将来候補に限り、v1では未実装かつ`blocked`であり、作成、資格情報、更新またはLifecycleを含めない。共有Authority Rootは、将来の署名・Trust検証済み準備記録（Provisioning Record）へ結合された明示Pathだけを通常runで再利用する。準備記録はPlatform scopeのRuntime向け信用判断を担う中心成果物とし、Provisioner Identityと署名metadataを一つのJCS payloadへ結合する。署名包絡（signature Envelope）はpayloadと複数署名を分離し、署名値を署名対象へ循環包含しない。CRDD固有の署名領域分離（domain separation）、鍵識別子（key ID）、準備記録、署名包絡、信頼起点鍵集合（Trust Anchor Set）、失効一覧（Revocation Manifest）および集約署名検証（aggregate signature verification）のrevision 1 pure Core候補を実装した。Provisioning Receiptを別のRuntime Authority成果物として要求しない。Platform Provisioner package manifestは配布packageと保護policyの結合検証に限る別成果物で、Provisioning RecordまたはAuthority File Bundle Manifestを代替しない。

準備記録のpure Core候補は、RFC 8785 JCS、RFC 5480 P-256 SPKI DER、ECDSA with SHA-256、固定64-byte IEEE P1363署名およびRFC 4648のpaddingなしcanonical base64urlを組み合わせる。署名messageは固定ASCII prefix `CRDD\0PROVISIONING-RECORD\0V1\0`、payload JCS byte長の符号なし64-bit big-endian値、payload JCS bytesの順で構成する。鍵識別子はexact SPKI DERのSHA-256 lowercase hexadecimal 64文字である。準備記録はcanonical UTCの`issuedAt`より`expiresAt`が後で、その差が最大180日以内の場合だけ候補化する。集約評価では評価時刻が`issuedAt`以上かつ`expiresAt`未満であることを要求し、期限外または180日超過をfail closedで拒否する。この180日は準備記録の有効期間上限であり、鍵の有効期間、鍵切替期間または失効一覧の保持期間ではない。exact plain-data Schema、strict UTF-8、canonical byte完全一致、件数・深さ・node・byte上限を要求し、重複、未知、失効、不正または形式不明な署名entryを一件でも含めば全体を拒否する。専用Storeへ永続化したfloor、Trust成果物、current RecordおよびRuntime取得時刻を結ぶ集約検証も実装済み候補である。集約Verifier単体はRoot実体を観測しない。検索票resolverのnon-link Directory Identity、Repositoryとの相互非包含、永続Trustおよびcurrent Record結合、現在process tokenをWindows `AccessCheck`へ渡すRust観測Core、署名manifestへ結合する読み取り専用のRust成果物観測、および明示Release署名commandのmanifest配置処置は実装済み候補である。ただし保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像、親Directory経由のRoot削除可否、完全Protection、初期Trustの承認済み導入元、POSIX観測およびactivationは未実装である。このため正常結果もRuntime Authority、Runtime Capability、GateまたはOperationを成立させない。実端末登録Effect、初期Trust導入および完全Lifecycleも未実装である。適用する外部規格の正本、節および採用境界は[脅威モデルの外部規格入力](02_Threat_Model.md#provisioning-signature-external-standards)を参照する。

端末導入鍵（installation key）はOS管理境界で保持し、初回オンライン登録では30分のオンライン登録チャレンジ（online enrollment challenge）、登録要求（enrollment request）の所有証明、登録証明書（enrollment certificate）の署名とIdentity結合をpure Core候補で検査する。端末導入鍵と準備記録の署名はECDSA P-256 with SHA-256、固定64-byte IEEE P1363形式に統一し、準備認証局（Provisioning CA）による登録証明書署名はEd25519に分離する。チャレンジ／登録要求／登録証明書のexact object Schema、成果物別domain、JCS署名messageおよび数学的署名一致は実装済み候補である。署名前payloadのcanonical raw byte decoderに加え、登録要求ではECDSA P-256署名exact 1件、登録証明書ではEd25519署名exact 1件を`payload`から分離するobject Envelope、およびEnvelope全体を上限131072 byteのcanonical JCS UTF-8として受理するraw byte decoderも実装済み候補である。独自header／length prefixを付けず、入力bytesと再生成canonical bytesの完全一致を要求する。署名済みオフライン初回登録束（signed offline enrollment bundle）は、チャレンジ、署名済み登録要求、要求Hash、登録証明書、同一root系列・epochのonline／offline issuing証明書exact 2役、失効snapshotおよび7日期限を結び、offline issuing keyのEd25519署名exact 1件をpureに検査する候補である。transport、Runtime所有Trust／時計、永続一回消費台帳、鍵生成、keystore、Network、Filesystem import、Record結合および証明書更新は未実装である。decoder候補や数学的一致もAuthority、Capability、EffectまたはGateを開かず、既存12阻害依存と6件の現在run根拠を減らさない。

準備記録の正本は共有Authority Rootと同じPlatform scopeへ置き、管理者／provisionerだけが書込み、Runtimeは読取り専用とする目標であり、Repositoryへ正本を複製しない。RepositoryのAuthority Root検索票は準備記録Hashだけを参照する信用前のヒントで、準備記録の代わりにならない。初回setupまたは再設定は明示CLI、通常runは検証済み準備記録と検索票の両方、環境変数は互換／自動化向けの明示overrideという役割に分ける。不一致、欠落、失効または再識別不能では別候補や低優先sourceへ無言でfallbackせず`blocked`とし、自動修復せず再Provisionへ戻す。現在はimmutable Record、atomic current pointerと明示復旧、trust floor、content-addressed Trust成果物Store、Runtime時計によるcurrent Record集約、Repository検索票との結合、Root Identity／保護HashをRecordの署名済み3値へ結ぶpure候補、Windows実効accessのRust観測Core、署名manifestへ結合する読み取り専用成果物観測、および明示Release署名commandのmanifest配置処置までを実装した。保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像、親Directoryの`FILE_DELETE_CHILD`を含むRoot削除可否、初期Trustの承認済み導入元、POSIX Adapter、完全Lifecycle、active activation、十分値およびready遷移は未実装なので`blocked`であり、候補一致はRuntime AuthorityまたはRuntime Capabilityを付与しない。

オンボーディング準備状態の投影は、共有Authority RootをPlatform単位、Runtime RootをRepository単位のactivation前提として区別し、現在の阻害依存を一覧化するだけである。Platform ProvisionerのTrust／manifest／package、Rust CoreのWindows access観測、署名manifestへ結合する読み取り専用成果物観測、および明示Release署名commandのmanifest配置処置はcomponent候補として実装済みだが、保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測への写像、導入EffectおよびRuntime有効世代readerは未実装である。これらは既存の`platform_provisioner_verification`／`platform_provisioner_effect`阻害依存へ残り、第13 blockerを作らない。阻害一覧と公開状態は同じ実装状態snapshotから派生し、既存12 blocker、6 current-run evidenceおよびGate `blocked`を維持する。

Authority Root検索票（Authority Root Locator）は、Repository直下の固定`.crdd-runtime/authority-root-locator.json`へ置く。resolver候補はRepositoryとの相互非包含、non-link安定Identity、永続Trustおよびcurrent Record結合までを行う。Rust Core、署名manifestへ結合する読み取り専用成果物観測、および明示Release署名commandのmanifest配置処置はcomponent候補だが、保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像と実測Protection Hash結合は未実装で、観測済みRecord入口は`blocked`である。Path、SID、ACL、raw recordまたはcanonical byteを公開しない。

Root Identity／Protection観測成果物のexact pure contract、domainおよびHash生成候補は実装済みである。Rust Coreは同一handleのRoot Identityを固定して現在process tokenをWindows `AccessCheck`へ渡す読み取り専用component候補を持ち、TypeScript側は署名manifestへ結合する読み取り専用成果物観測と、明示Release署名commandのmanifest配置処置を持つ。ただし保護済み有効世代、検証済み実行イメージ、プロセス起動およびRoot観測成果物への写像は未実装である。DACL構造確認と実効アクセス確認を分離し、caller claim、ACE集計またはopen失敗から保護成立を主張しない。絶対Path、SID、ACL実値およびraw OS errorは公開せず、component候補だけではProtection Hash、Runtime Authority、Runtime Capabilityまたはactivationを成立させない。

Rust Coreの`deleteOnRootObject`はRoot自身のsecurity descriptor上の`DELETE`だけを表す。親Directoryの`FILE_DELETE_CHILD`経由でRootを削除できるかは未観測であり、`deleteOnRootObject: false`からRoot削除不能、writer排他またはProtection成立を推定しない。


## 14. Console・Task内部搬送・回収の実装契約

<a id="task-result-transport"></a>

### 完了結果の搬送・回復・Process再起動

公開結果の意味は[仕様](../../05_SPEC/01_Behavior_Specification.md#公開taskの入力結果取消)が所有する。ここでは、意味を損なわず下位処理から公開結果へ運ぶ実現方式を定める。

- Task Runtime contract revision 24は、資源回復の要否と同一Process再利用禁止を分離し、最終的な不可逆poisonだけからRuntime所有の`processRestartRequired`を公開結果へ投影する。
- Host／Docker／Candidate／Candidate StoreのRecovery IDは各資源の回復案内だけを表し、IDの有無、`manualRecoveryRequired`、理由文字列または一時drainからProcess再起動を推定しない。
- 下位Processがcleanup済みを返しても、手動Recovery要求またはexact Docker Recovery IDが残る場合はHost Rootと全IDを保持する。
- 人間向け表示と正式Runnerはこれらの直交する状態を欠落させず、`processRestartRequired: true`の場合はRecovery IDの有無と独立して再起動を案内する。
- Taskの本番producerはexact native Promiseとして完了を返し、そのsettlementをproducer境界で所有する。
- 正式RunnerはProxy、Promise subclass、own `then`または非Promiseを完了Authorityとして観測せず、未知の完了値やRecovery／Candidate情報を利用しない。

- Task Runtime contract revision 24は、Docker Process Controller contract revision 20の実producer shapeを直接受け取り、開始返却、事前登録したopaque handoffおよび完了結果のexact shape、data property、Operation／Recovery ID相関をproducer所有Projectorで検証する。
- 完了、取消、回収済み停止およびcleanup不明は排他的variantとして、Result／Hash／byte数、取消要求、Subscription認証、finalization capabilityおよびRecovery IDの組合せまで照合する。
- cleanup中も取消controlをliveに保ち、最後の非同期境界後に完了候補を再settleする。
- 既にblockedとなった結果では個別失敗理由を保持して遅延取消を観測し、回収済みblocked理由はproducer所有の閉じた集合だけを受理する。
- cleanup完了時は`recoveryId: null`、cleanup不明時はhandoffと同じexact IDだけを受理し、任意の`hostRecoveryId`、`dockerRecoveryId(s)`または手書きcallback値を結果からAuthorityへ昇格しない。
- Task RuntimeおよびDoctorのOperation Root生成は共有failure unionへ接続し、Directory生成、Recovery ID取得およびCapability初期化の途中失敗を、root回収確認済み、または取得済みのexact Host Recovery／IDなしoperator transferを伴う回収不明へ閉じる。
- Effect前cleanup失敗とHost cleanup失敗はexact Host Recoveryを保持し、Host削除後のDocker receipt／finalize失敗はDocker Recoveryだけを保持する。
- Docker Recovery Runtime contract revision 25の`host-precleanup-finalization-intent.json`は旧Host先行回収状態を再開する耐久Authorityであり、Host／submission／active不存在とexact committed pointerを同一世代で確認した後だけ新規発行する。
- 発行前に停止した呼出しはintentを残さず、exact発行後の失敗では同じintentをRecoveryへ保持し、再試行から別または広いRecovery Authorityを作らない。
- Runtime State内の外部送信同意はDocker資源またはRecovery Authorityではないため、Docker Recoveryは共有定義から導出した固定名前空間、regular fileおよび単一logical generationだけを在庫境界として検査し、同意本文のSchema、意味版、期限、Policy結合および破損・部分pairの失効はExternal Send Consent Runtimeだけが所有する。
- 実Consent producerから作成した正常pair、破損／部分pairの所有RuntimeによるAuthority縮小と残存0、および複数世代競合をproduction consumerへ接続した結合試験で固定する。

- 正式General TaskおよびRoute Matrixは、実行開始後に完了結果、Effect観測または再起動状態を安全に確定できない場合、表示上の推定だけを返さない。
- 共通のProcess安全状態を不可逆poisonへ単調化し、同一ProcessのPackage、TaskおよびExternal Sendを次の非cleanup Effect前に停止してから`processRestartRequired: true`を返す。
- 引数不正や実行開始前の確認済み拒否は新しいpoisonを作らないが、既存poisonを`false`へ降格しない。

### 14.1 Console handleと構造化入力の分離

WindowsのConsole検証では`\\.\CONIN$`を読取り専用、`\\.\CONOUT$`を読書き可能として開く。Node.js 24系では書込み専用の`CONOUT$` descriptorをTTYとして識別できないため、出力側handleの読書き可能modeはTTY同一性の検証とlifecycle管理だけに使い、文字列表示はUnicode対応の`process.stdout`へ固定する。descriptor、汎用Console能力または追加の読取りAuthorityをProviderや公開callerへ渡さない。

Task processの標準入力は、上限付きJSONをEOFまで受け取る構造化搬送専用であり、外部送信の対話入力へ再利用しない。WindowsではRuntimeが`\\.\CONIN$`を新しく開いてTTYを検証し、そのdescriptorだけを署名済みpackage content rootへ含まれる非公開の固定readerへfd0として複製する。readerは`process.execPath`の絶対Path、固定絶対entrypoint exact 1件、追加引数0件、固定Directory、`shell:false`、上限付き標準出力、破棄する標準エラーおよび私有IPCだけで起動する。Windowsの空環境mapを非継承の証拠にせず、OS loaderが現在Processへ読み込んだ`kernel32.dll`から観測したWindows directoryだけを実値とし、PATH、HOME、profile、proxy、Credential helper、`NODE_OPTIONS`、`NODE_PATH`または`NODE_V8_COVERAGE`を固定neutral値へ閉じた用途別Profileを渡す。親Processの診断・計測設定を子Processの私有IPC protocolへ混入させない。入力は6桁challengeのexact 1行だけを厳密UTF-8で受理し、複数行、制御文字、NUL、不完全byte列、上限超過またはEOFを拒否する。取消、timeoutまたは親IPC消失では同じ子Processを停止し、子とstdoutの双方の`close`、IPCおよび全listener回収を確認してからconsole descriptorとkernel lockを閉じる。初回同意を所有する単一Console lifecycleのdevice検査descriptor close、Windows terminal writeのcallback、reader child／stdout／listener／IPC、またはconsole専用kernel-lock workerのterminate／exit／releaseを確認できない場合は`cleanup_unknown`とする。Runtime所有境界はcleanup不明を認識した直後、次の非cleanup `await`、公開returnまたはEffectより前に同じRuntime Processを同期的かつ不可逆にpoisonし、その後も残るdescriptor、listener、子Processおよびlockのcleanupを全試行する。後続のPackage発行と一般Task開始は専用の再起動理由、External Send Grant再入は入力やAuthorityを参照しないboundedな`blocked`結果と再起動理由で全Effect前に停止し、復帰は新しいProcessだけで行う。console由来のHost Recovery IDは作らず、Operation cleanup自体も失敗した場合だけ正当なHost Recovery IDとProcess再起動条件を併記する。既に開始済みの別Operationを遡及取消できるとは主張しない。Task stdinがpipeでも対話consoleは独立して成立する。POSIX readerは親環境を受けない固定空環境の候補に留まり、Windows Local Personal以外をRuntime 1.0の正式保証へ昇格しない。

#### 配布検証からTaskの開始まで

- 公開`coordinator task --request-stdin`と正式署名Runnerは、固定manifest、Release Identity、Commit／Tree、package content rootおよびreader artifactの検証から同一Process内で発行した短命・一回限りのopaque capabilityをTask本番facadeへ渡す。
- 正式RunnerはNode Gate、Package／Release検証とcapability発行、Release IdentityのGit Object ID形式対応確認を行ってからTask facadeを開始する。
- facadeはprocess poisonまたは一時drainを確認し、Packageをfresh再検証してcapabilityを一回だけconsumeする。
- Task coreは対象RepositoryのObject FormatをOperation作成前に確認する。

#### Supervisorの取得・待機可能状態・解放

- Host Operation世代lockはTaskのNode Process内Workerではなく、固定absolute entrypointの独立Supervisor ProcessがWindows named pipeとして保持する。
- Supervisorは親環境を継承せず、OS由来の`SystemRoot`／`WINDIR`以外のPath、Home、Proxy、Credential helperおよびNode injection名を固定neutral値にした専用Profileで起動する。
- Taskは`acquired`の後に`confirm-ready`／`ready`を往復し、同じOperation generation、lock identityに加えて耐久Recovery markerのfile identity、Hash、state、Rootおよび全child identityをfresh再検証してからConsoleまたは子Processへ進む。
- 正常releaseは`release`／`release-ready`／`confirm-release`／`released`とSupervisorのexit 0を要求し、closing中を含むunknown、duplicateまたは順序外commandでは最終exitを非0へ単調化する。
- 競合または開始失敗後の終了確認済み、protocol異常後の終了確認済み、および終了未確認を別結果とする。

#### 失敗時の一時停止と回収用権限

- failure検出直後は新しいTask、PackageおよびExternal Sendを一時drainで止め、新規業務Effect用Capabilityを失効する一方、Provider取消、Docker receipt／finalize、Candidate discardおよびOperation cleanupに必要な内部cleanup-only Authorityを保持する。
- 全資源のcleanup確認後は既存poisonがない場合だけdrainを解除し、いずれか不明なら全actionable Recovery IDを保持してRuntime Processを不可逆にpoisonする。
- Operation作成・readiness中の失敗はRepository binding、Policy、Slate、Candidate Store、同意、Grant、workspace、ProviderおよびNetwork Effect前に停止する。
- ready後のunexpected exit、disconnectまたはprotocol逸脱は単一finalizerへ収束し、保留中の同意を取消し、実行中Provider Processを停止してcleanupを待つ。
- 新しい業務Effect、Candidate publishおよび成功公開は拒否するが、既に開始済み資源のcleanup receipt／finalizeはHost依存順序を守って全試行する。
- Effectが既に開始済みならEffect 0とは主張せずRecoveryへ閉じる。

#### Identity不一致と解放失敗の扱い

- marker、generationまたはRoot identityが不一致ならRootとmarkerを推測削除せず保持する。
- identity検証済みRootの削除後にreleaseだけが不明ならRoot不存在を維持し、marker、opaque Supervisor参照およびretired generationを保持する。
- protocol異常でもterminateとexitを確認でき、Root、markerおよび参照を回収済みなら成功は拒否するがHost Recovery IDを発行しない。
- 固定sleep、event-loop turn数または同一Process内Worker応答からWindows native resourceの安定を推定しない。

#### 同意の入力・再利用と未開始時の回収

- readiness成立後に同意状態を解決し、初回同意が必要な場合だけRuntime所有の単一Console lifecycleを実行する。
- 有効な同意を再利用する場合はConsole Effectを発生させない。
- 初回同意が成立しない場合はGrant、workspace、ProviderおよびNetwork Effectを0に保ち、既に開始したRuntime所有Operationを既存cleanup／Recoveryへ戻す。
- source checkout、欠落、偽造、別配布Root、差替えまたは期限切れを拒否し、capabilityを単独で保持してもOperation、console、Filesystem、ProviderまたはNetwork Authorityにならない。
- 検証済み状態をTask JSON、argv、環境または一時fileで運ばない。

### 14.2 IPC・entrypoint・console lockの終了

取消IPCの完了はcallbackで回収し、子の`close`後に遅延したchannel closureを未処理`EPIPE`として親Processへ再送出しない。成功、取消、timeoutまたはcleanup不明の判定は、子Processとstdoutの両`close`、force-stop fallbackおよび既存のlistener／lock回収条件からだけ行う。

鍵生成、Release manifest署名、正式General Task、4経路MatrixおよびRecovery Matrixの非同期entrypointは、top-levelで`main`の完了または失敗処置までを所有する。内部lock Workerや子Processが`unref`されていても、exported functionの試験成功から公開script Processの生存を推定しない。公開entrypointが非同期処理、cleanupおよび最終exit codeの確定前に終了できる構造を契約試験で拒否する。

外部送信承認では、同じLocal Personal Windows sessionの固定console readerをkernel lockで一つに限定する。初回同意が必要な場合だけ、実際のRuntime所有確認処理の中で入力／出力deviceが双方TTYであり、Windowsでは現在の標準出力が書込み可能なUnicode TTYであることを確認し、そのまま表示、入力、取消およびcleanupまで一つのlifecycleで完結する。可用性確認だけのconsole open／closeを独立した事前Gateとして実行しない。既存の有効な同意を再利用するTaskはconsoleを要求しない。実処理が成立しない場合もGrantは0で、先行して作成したRuntime所有Operationを既存cleanup／Recoveryへ戻す。固定readerのProcess Effectは検証済みOperation管理Capabilityの後、Provider／Network／workspace Effectの前に一回だけ許可される内部確認処理であり、任意command、Repository、Provider Home、NetworkまたはProvider Credentialへ到達しない。

### 14.3 Desktop修復記録の所有と状態遷移

Filesystem Effectは、保護Runtime State内のrev4追記型段階記録、旧版記録の明示引継ぎ・終了に用いる固定名の`historical-adoption.json`／`historical-closure.json`の排他的追加、および`Docker\run`を同じ親Directoryの一意な`run.crdd-stale-*`へrenameする処置に限定する。履歴receiptの境界は[専用Architecture](#22-docker-desktop最終復旧時の起動環境)に従う。Directory、socket、記録のいずれも削除せず、CRDD RuntimeStateの他内容、Provider Home、container、image、volumeまたは通常WSL distributionへ処置を広げない。通常系列が取り得るHost Effectは公式shutdown、条件付きnative termination、`docker-desktop` WSL termination、renameおよびlauncherの最大5種であり、自然回復時に全5種を機械的に実行する意味ではない。実際にHost関数を呼び得るEffectは一意な`intent_recorded`を先に耐久化し、非同期artifact確認を完了した後、Process、package／Policy、Engine、`run`、staleおよび取消をHost関数直前にfresh再確認してから一度だけ実行し、結果を同じentryの`settled`へ単調更新する。公式shutdownが非発行または確認不明なら後続Host Effectを止める。唯一の限定例外として、確認済み公式shutdown後にProcess不存在をfresh確認した`K/A`はnative Host関数を呼ばず、直接`false/not_issued`観測Recordを保存してからWSL判断へ進む。`K/N`はnative terminationの非発行settlementとProcess状態不明reconciliationを唯一の複合意味deltaとして同一Recordへ原子的に保存し、以後のHost Effectを禁止する。

reader、writerおよび再開判断は、前Recordのstage／ledger、次Recordのstage／ledgerおよび意味deltaを入力とする同じexact状態機械に従う。通常Recordはrecord-write bookkeepingに加えて意味delta最大1件とし、前記`K/N`だけを限定例外にする。公式shutdown、条件付きnative termination、WSL termination、Host renameおよびlaunchの必須prefix、intentのstage所有、未settled intentの末尾性、unknown reconciliation後のHost Effect禁止、Host renameと観測renameの排他、自然回復とlauncherの排他、およびpending／terminalの安全集約を検査する。既知のpending／closedへ進めるのは全Host Effectとreconciliationが既知の場合だけであり、一件でも`unknown`を含む履歴は専用のhistorical pending／terminalに保持して、既知回復または成功へ昇格しない。現在のEngine回復は過去のlauncher発行証明へ流用せず、`observed_desktop_recovery`を非発行観測として保存する。既知Effect後にstaleなしで回復した状態、過去Process Effect自体が不明な状態、およびrename後にstaleを保持して自然回復した状態を別のpending／terminal意味として保持する。observed renameは物理Directory移動のIdentity根拠であり、自然回復観測と同義にしない。再開、既存pending、明示closeおよびterminal再表示も、非同期artifact／Process観測の完了後にpackage／Policy、Engine、`run`、staleおよび取消を同期再観測する共通fresh snapshotだけから結果を返す。

record writeは自己参照を避ける専用Filesystem Evidence Effectで、当該Recordでは発行済み・確認不明、hash chainの再読込後だけ確認済みへ精緻化する。通常最大系列は初期1件、最大5 Effectのintent／settlement 10件、stage遷移3件、明示close 1件の計15件である。上限24件は、通常系列へ到達可能な9段階を追加したという意味ではなく、将来のbounded recoveryを通常系列へ混入させず停止できる防御的hard capである。23／24境界の試験はこの純粋容量境界だけを確認し、意味的に到達可能なhash chainの証明へ昇格しない。各Effect前の必要容量は状態機械上の残Effectと残stageから同じStore関数で導出し、close前にも1件を確保する。保持Operationは最大64件とし、64件または判定不能時は新しいDirectoryを作らない。容量不足はHost手動復旧が直ちに必要という意味ではないが、新規repairの反復、記録削除またはcompactionを行わずRuntime operatorへ移送する。CRDD manifest Hash、Release Sequence、Tree、package content rootおよびPolicyは、intent前、intent確定後のEffect直前、settlement／stage記録前、再開、終端表示直前およびhelper解放後に同じ再開世代へ再結合する。旧rev2／rev3および強化validatorに適合しないdraft rev4記録は暗黙移行しない。

### 14.4 Desktop起動と再開判断

Docker Desktopの起動はNodeから非同期spawnせず、native helperがOS Known Folder由来の最小Unicode環境で固定launcherを`CreateProcessW`し、返された同じprocess handleでimage／作成Identityを確認する。生成前の非発行、生成後の確認済み、生成後の確認不明を別statusで保持する。Engine再応答、固定成果物、Process集合、新しいlive run IdentityおよびEvidenceを確認できた場合は`recovered_pending_close`とし、退避DirectoryとHash chain記録を保持する。取消またはhelper喪失後は新しいHost Effect、intent、stage、reconciliationまたはcloseへ進まない。ただし取消前に耐久化済みの同一intentに対するsettlementだけは、helperとpackage／Policy境界を再確認できる場合に一回だけcleanup-only Evidenceとして追記できる。helper protocol結果と資源回収結果を直交して保持し、正常な取消cleanupをprotocol失敗へ変換せず、資源回収済みでも真のprotocol不成立を成功または新規repair許可へ昇格しない。exact `C`後もstdout／stderrのerrorはprotocol Evidence不明として失敗させ、stdin側の終了失敗だけをcleanup専用として扱う。正常`Q`応答後のstdin終了throw／errorも同じmemoized bounded cleanupへ合流し、protocol完了とcleanup確認を別々に返す。境界不一致、helper喪失、artifact不明、取消、容量不足および耐久化応答不明は別の理由として保持し、一般的なAuthority変更やrecord失敗へ潰さない。人間が保持を受け入れる場合だけ、表示されたIDを`doctor --close-docker-desktop-runtime-repair <repair-id>`へ渡して専用終端を追記する。durable終端はrepair／Evidence dispositionだけを表し、現在runの成功と新規repair許可はhelperの`Q`応答、exit 0、child `close`、stdin／stdout／stderr回収、別未完了操作不存在および解放後のpackage／Policy再確認を完了した公開結果だけが返す。closeも削除ではなく、現在のrun／stale Identity、Process集合とEngineを再観測して明示判断を耐久記録へ追加する処置である。未完了記録、改ざん、第三状態、Identity差またはcleanup不明では新しいrepairを開始せずFail Closedにする。このコマンドは`doctor --recover-isolation`、`0xC0000409`の原因是正またはProvider Recoveryを代替しない。Docker Desktop更新で直接対象Identityが変わった場合は、再評価して署名対象Policyを更新するまで実行しない。

耐久記録からの再開判断は、段階・Effect prefix・未確定Effect・人間判断待ち・終端を一つの分類器で決定し、Host作用直前のEngine、Process、現行`run`、operation固有stale、取消およびAuthorityのfresh観測を別のEffect別行列で確認する。実rev4 Storeの契約試験は、全5 Host Effectについてintent記録直後、Host作用直後かつsettlement前、settlement記録直後の再開を区別する。Record writerの応答が不明でも、fresh inventory上の同一operation、次sequence、stage、ledgerおよび検証済みhash chainと完全一致するRecordだけを耐久化済みへ精緻化し、それ以外は従前snapshotを保持して後続Effectを止める。未確定Effectは再発行せず、renameだけは現行`run`不存在とoperation固有staleのexact Identityから帰属を証明できた場合に二Recordで採用する。`prepared`中の自然回復は、履歴なし、既知Effectまたは不明履歴のいずれも同stage観測Recordとpending stage Recordを分離する。これらはWindows向け最終復旧手段の再開安全性を強化するものであり、自動fallback、通常Taskの権限、対応PlatformまたはHost操作範囲を拡張しない。

### 14.5 ProbeとHostの回収順序

Probe containerは`create`で得たcontainer IDと全Security属性を起動前に照合し、同じIDだけを回収する。削除後は、完全なID、完全な名前、完全な所有labelを別々に照会し、3結果がすべて正常かつ空の場合だけcontainer不存在を確定する。いずれかの照会失敗、異常出力または残留ではHost側のmount元を保持し、安全な`recovery-id`だけを返す。

Host回収記録は再帰削除するOperation rootの外に保持する。Dockerへのcreate送信後は、上記3軸で不存在を確定するまでHost回収を直接実行できない。明示recoveryは、Docker container回収、3軸不存在確認、Host root回収、root不存在確認、外部marker消費の順に限定し、未知container、caller指定Pathまたは一般Docker操作へ拡張しない。通常実行またはcleanup中の例外は、Pathや生出力を含まない`blocked`結果へ正規化し、安全に再開できる場合だけ回復IDを返す。

受動診断の`host_only` cleanupとDocker送信後のcleanupは分離する。受動診断は作成直後に固定したHost記録Hashだけを信頼し、現在markerを再Hashして改変後の状態を正当化しない。Docker送信後は、container不存在未確認なら`docker.*`、3軸不存在確認とHost marker更新後なら更新後の`host.*`だけを実行用回復IDとして返す。Host cleanupに失敗しても古いDocker回復IDへ戻さない。Host記録の共通moduleはtoken、Schema、Hashおよび読取り検証だけを所有し、状態遷移はDocker隔離module内の固定操作に限定する。不存在確定は3軸Oracleから生成した一回限りのCapabilityなしに実行できない。Docker送信準備記録と送信前取消がともに失敗した場合は、実行不能なtokenを回復IDとして返さず、Operation領域を保持して`manualRecoveryRequired`付きで安全停止する。

3軸不存在の成功は、同じProbe、container、Operation root、Docker CLIおよび送信開始時のHost記録へ結び付いたmodule-privateかつ一回限りのCapabilityとして扱う。公開token、owned objectまたは状態文字列だけではHost回収を解禁できない。Host rootを削除する前には、Runtimeが作成した6 childすべてのIdentityとroot直下entry集合を確認し、既知childの部分的不在だけを許容する。未知entry、link／junctionまたは同名replacementは推測削除しない。

明示Docker recoveryでは、root直下が既知6 childの部分集合であり、存在するchildのIdentityが一致することを確認したうえで、まず3軸不存在を照会する。containerが不存在なら、`events/`、`projection/`またはmount childの既知欠落を理由にHost回復を止めない。containerが残る場合だけ、mount 3件と`management/`の存在・Identityを必須にして同じcontainerを回収する。`management/`、回復記録、未知entryまたは置換childを確認できない場合は推測せず停止する。

Fake Provider Gateの合格は、DockerによるFilesystem／Credential Path／Network遮断と、成功scenarioのFake限定結果正規化／container・process tree不存在だけを示す。専用verificationは固定scenarioのtimeout、出力上限超過、不正結果およびnonzero exitを同じDocker経路で実測し、個別の固定reason、Host cleanupおよび残留0を確認する。別の固定Fake専用verificationは`SIGTERM`取消要求から受領、Fake container内process終了、ホスト側attachプロセスのclose、3軸container不存在およびHost cleanupまでを同じrunで確認する。異常時はホスト側attachへ終了要求をexact 1回だけ発行してcloseを先に待ち、正常終了時は追加終了要求を発行しない。これは通常診断や実Providerの取消Capabilityには流用しない。この結果は任意signal、cleanup失敗、残存container、Hostへescapeしたprocess一般、実Provider lifecycleまたは実Operationを証明しない。Provider endpoint限定Egress、公式CLIの導入・認証、自動更新／Telemetry、Session再開および実Provider process treeが確認されるまでは全体を`blocked`とし、実Operationへ進めない。

### 14.6 AppContainer Workerの環境と通信

native Supervisorは親process環境を継承せず、Windows Known Folderから取得して固定volume／non-reparse chainを確認した`LOCALAPPDATA`だけをWorkerへ渡す。対象Windows環境で独立して必要な`LowBoxConsoleEnabled`は通常Operationへ持ち込まず、明示`provision`内だけのCurrentUser一時Effectとする。固定mutex、effect前にflushするdurable recovery record、現在値とkey last-writeの所有確認、元のDWORDまたは不存在への復元、read-backおよびrecord削除を完了してから候補responseを公開する。既存record、型差、外部変更または復元不能では値を上書きせず、専用reasonと`manualRecoveryRequired: true`で停止する。

Worker交換のFail Closed結果は、接続、request書込み、完了待機、response／終了状態の4段階を区別する。各結果は秘密、Pathまたはraw OS errorを含まず、段階の識別だけを返す。正常なPA03／PR03候補、Registry復元またはAuthorityの条件は変更しない。

名前付きPipeは、非パッケージWin32 supervisorが作成する非修飾ローカル名のfirst instance、`PIPE_REJECT_REMOTE_CLIENTS`、owner／SYSTEM／All Application Packagesの限定DACL、Pipe objectだけのLow integrity mandatory labelおよび接続元PID一致を組み合わせる。パッケージ名前空間用の`LOCAL\`修飾は使用しない。Low integrity labelはAppContainer WorkerがMICで拒否されずPipeへ接続するためのobject局所条件であり、OS、Registry、Filesystemまたは他objectのintegrityを変更しない。


## 15. 未接続の準備候補と隔離・送信方式

本節のAuthority Registry／Trust Policy／鍵保管・登録・有効化の未接続表示は、Hardened／Managed準備候補の経路に限る。Local Personal一般Taskは、正常OS、認証済みLocal User、公式署名Releaseおよび公式Provider配布を前提とし、別の外部送信許可と署名Releaseへ結び付いたLocal Personal Authorityを使う。候補の未完成を、接続済みの[一般Taskの通信経路](#121-providerの通信経路)が未実装であるという意味へ広げない。

ProfileやProxy Policyのpure検証は、実Adapterでも使用する構成要素である。その候補値だけでは実行できないことと、実Adapterへの接続の有無は分けて読む。以下の「全体Gateはblocked」は当該準備候補経路の判定であり、Local Personal一般Task全体の状態ではない。

OS鍵保管ポリシーCore候補は、WindowsのCNG／KSP＋TPM、macOSのSecure Enclave、LinuxのTPM 2.0をP-256優先Backendとして固定し、software fallbackは初回setupでの明示承認がある場合だけ候補化する。公開P-256 SPKIとBackend選択の形だけを検査し、秘密鍵、鍵handleまたはPathを入力・出力しない。実native Adapter、software鍵保護、署名済みPlatform Provisionerとの結合およびkey-handle所有証明は未実装であり、policy候補を実鍵保護、Trust、Authority、CapabilityまたはEffectへ昇格しない。

準備認証局（Provisioning CA）のpure Core候補は、caller suppliedのoffline root集合、rootがEd25519署名したonline／offline issuing key証明書、およびroot署名済み失効一覧を検査する。issuing keyは最大365日、失効一覧は最大24時間、列挙された鍵は`revokedAt`の過去／現在／未来にかかわらず即時拒否する。正常なchainもRuntime同梱root Trust、rollback floor、Runtime時計または配布確認ではないため、Authority、CapabilityまたはGateを開かない。

準備記録と登録証明書のpure結合候補は、Recordの全署名鍵を現在の登録証明書、Platform scope、Provisioner Identity、公開SPKIおよびCA seriesへ1対1で結ぶ。未結合署名、重複証明書または余分なbindingは拒否するが、Runtime所有Trust、時計、Filesystem、activationまたはAuthorityを成立させない。

登録証明書更新のpure遷移候補は、同じenrollment、Platform scope、Provisioner Identityおよび端末導入鍵を維持し、旧証明書の残り30日以内かつ失効前に新証明書を発行し、重複期間を最大30日に限定する。発行、自動更新、保存およびRuntime所有時計・CA Trustは未実装である。

### Provider隔離Profile

Provider隔離Profile（Provider Isolation Profile）は、実行権限そのものではなく、Runtimeが照合する要求候補である。CRDD版ごとのJSONを作らず、Runtime契約`crdd-coordinator/provider-isolation-profile`の改訂番号だけを持つ。CRDD基準版の変更とRuntime契約の破壊的変更を同じ互換処理へ混在させない。

Profile revision 3はProvider、Operation、subscription OAuth、許可済みAuthority Registryを選ぶためのAuthority Grant参照候補、Runtime-owned active Provider Home Mount Grantの要求、および要求されたHTTPS Originの完全一致集合だけを保持する。実行ごとにランダム生成されるMount Grant参照は署名済み静的Profile／Registryへ埋め込まず、起動直前のactive mount inspectionとAuthority再検証から5秒・一回限りのopaque Runtime Provider Authorityへ結合する。専用Homeマウント許可は対象Provider・Profile・Operationに結合した保護済み専用Homeのhandle／mount許可だけを表し、token、session、PathまたはCredential値を含めない。Operation終了時に失効させるのは許可、handleおよびmountであり、永続HomeまたはOAuth sessionではない。旧revision 1のgeneric Credential Grantと`credential_broker`、および動的Mount Grant参照を静的成果物へ保持したrevision 2はalias／fallbackせず拒否する。構造検証結果は`candidate`であり、人間承認、許可発行、Authority成立、`accepted`、`confirmed`または実行可能の別名ではない。正規化後のProfile Hashは要求候補の同一性だけを固定し、Authorityの証明には使用しない。

Runtime 1.0の書込みOperationはDockerを唯一の正式Isolation Backendとし、Host、Git Bash、通常WSLまたは`local-restricted`へ縮退しない。`fake`は決定論的試験専用であり、実Provider、実Credentialまたは実送信先の利用許可にならない。現在はRuntime所有Trust Policyの導入・有効化、起動直前再確認CoreとProvider起動経路の結合、Proxyおよび専用Homeマウント許可のbinder／発行部が未実装のため、Profile候補を作成できても全体Gateは`blocked`のままである。

Authority Grant Verifier Core候補は、Authority Registry revision 3候補を固定契約、内容版Registry revision、UTC観測時刻、Grant集合およびSHA-256へ正規化する。Profile revision 3候補との照合では、Authority Grant参照とRuntime-owned active Provider Home Mount Grantの静的要求を分離し、Authority Grantのactive状態、有効期間、Provider、Profile、Operation、要求Origin、ScopeおよびProfile Hashの完全一致を要求する。動的Mount Grant参照は起動直前のRuntime Capabilityだけへ結合し、署名済みProfile／Registryへ保持しない。構造と内容の照合結果は`candidate`であり、自己申告Registryを信頼済み正本へ昇格させない。

Trust Anchor Loader Core候補は、Registry入力を上限付きbyte列として受け、厳密UTF-8、BOMなし、末尾空白を含まないcanonical JSONと、正規化後Registry Hashの一致を確認する。Trust Policy候補はRuntime契約`crdd-coordinator/authority-trust-policy`の`contractRevision: 1`、Policy ID／revision／状態、Registry ID／revision／Hashだけを保持する。callerが渡したPolicyとの完全一致は候補Identityを固定するだけであり、Runtime所有Policyの導入、所有権、取消または有効化を証明しない。したがって結果は`candidate`、Authority Capabilityは未発行であり、全体Gateを`blocked`に保つ。

起動直前Authority再確認Core候補は、呼出側から時刻を受け取らず、Runtimeプロセスが保持する時計関数を一度だけ読み取る。同じ呼出しの中でcanonical Registry byte、Trust Policy候補、Profile、Grant、OperationおよびScopeを再検証し、現在時刻がGrantの`validFrom <= now < expiresAt`を満たす場合だけ固定された再確認候補を返す。結果はTrust Policy ID／revision／Hash、Registry Identity、Grant revision、Profile Hash、Operation／Scopeおよび確認時刻へ結び付くが、再利用可能なAuthority Capabilityではない。Runtime所有Trust Policyの有効化とProvider起動経路への直結が未実装のため、Core候補だけでProviderを起動しない。

Runtime 1.0の正式なAuthority取得方式は、Runtime管理領域内の固定ローカルFile Bundleだけとする。Bundleは`bundle.json`、`trust-policy.json`、`authority-registry.json`の3ファイルで構成し、Manifestのrevision、状態、前版Hash、Policy HashおよびRegistry Hashをcanonical byteから固定する。File Bundle Core候補は3ファイルの構造とHashを検証するが、実際の配置Path、所有主体／ACL、link禁止、原子的置換、単調な有効化・取消をまだ強制しないため、結果は`candidate`で全体Gateは`blocked`のままである。IPC／Network TransportはRuntime 1.0の正式取得方式に含めない。

Authority BundleはRepository内Runtime Rootへ置かず、複数Repositoryから共有できる別のAuthority Rootへ配置する。Authority RootにはOS固有の暗黙既定値を設けず、CLIまたは環境から絶対Pathを明示し、CLIを優先する。同じ指定契約をWindows、macOS、Linuxおよびserver volumeで使う。Repositoryを書ける主体がAuthorityを自己発行できないよう、Runtime Rootとの包含、Provider mount、Path／owner／ACL未確認または安定Identityを取得できないFilesystemは`blocked`にする。現段階の選択CoreはPathを報告せず、実Path AdapterやCapabilityを成立させない。

共通Root保護方針Core候補（Root Protection Policy Core Candidate）は、WindowsのDACLとmacOS／Linuxのowner／modeを別々の正本にせず、同じ保護結果へ写像する。Runtime Rootは選択された利用者またはサービス実行主体を`runtime_principal_only`のwriterとして読取り／書込みでき、非承認主体が書き込めないことを要求する。Authority Rootは承認済みadmin／installerの集合を表す`provisioner_principal_only`だけが書込み、Runtime主体は読取り専用で、非承認主体が書き込めないことを要求する。どちらも事前Provision済みの既存non-link Rootと安定Identityを必要とし、Runtime自身はRoot作成や権限変更を行わない。`local`と`persistent_volume`だけを候補とし、network、removable、specialまたは分類不明のFilesystemはfail closedにする。pure Coreへ直接渡す観測値はcaller supplied claimなので単独では実保護を成立させない。Rust Coreは同一handleのRoot Identityを固定し、現在process tokenのgroup、deny-only group、restricted SIDおよびACE順序をWindowsへ評価させ、TypeScript側は署名manifestへ結合する読み取り専用の成果物観測候補と、明示Release署名commandだけが行うステージングmanifest配置処置までを実装する。ただし保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像、writer排他判定、全tree観測およびProtection Hash結合は未実装であり、Root保護の本番入口は常に`blocked`とする。ACE集計、caller SIDまたはhandle open失敗だけを実効拒否の根拠にしない。Path、SID、UID、GID、mode、DACLまたはraw errorを返さず、POSIX観測、activation、Runtime Capability、ProviderまたはOperationを成立させない。

writer限定は通常のDACL／ACL／mode上の許可を対象とし、Windowsの`SYSTEM`／machine AdministratorsおよびPOSIXの`root`がOS自体を支配できることを否定しない。これらは信頼するプラットフォーム管理者境界（Trusted Platform Administrator Boundary）として扱う。Runtime所有経路がIdentity、保護metadata、署名、Trustまたはactivationの観測可能な変化を検出した場合は`blocked`として再検証し、信頼基盤（trust base）が健全と確認できた場合だけ再Provisionへ進める。健全性を確認できない場合、分類不能な場合、または管理者侵害が疑われる／確定した場合は、同じTrust基盤上の再Provisionへ直接進まず、プラットフォーム復旧（Platform recovery）でTrust基盤を再確立した後だけ再Provisionへ進める。再検証、復旧またはTrust再確立が不能なら`blocked`を維持して人間の決定権限者へ移送し、自動修復やfallbackを行わない。プラットフォーム復旧は将来の人間／Platform運用処置の目標で、現RuntimeのEffect、Capabilityまたは成功状態ではない。いずれの経路でもCapability、ProviderおよびOperationを開始しない。一方、OS、kernelまたはVerifier自体を完全に支配した攻撃者に対する検出や防御は保証しない。この残存リスクを、単純な権限／成果物改変を検出してfail closedにする契約と混同しない。

POSIX Runtime Root precheck入口候補は、信頼できるFilesystem classifierが未実装のためPath観測前に`blocked`へ閉じる。同梱packageのDACL構造claim evaluatorもpureかつ非Authorityで、Windows実効アクセスAdapter、Root作成および権限変更は未実装である。Path、UID、GID、SID、modeまたはACEを返さず、クロスプラットフォーム保護成立やRuntime有効化として扱わない。

Runtime Rootの既定候補は`<repository>/.crdd-runtime/`とし、別の場所を使う場合の指定契約は`--runtime-root`または`CRDD_COORDINATOR_ROOT`による絶対Pathとする。優先順はCLI、環境、Repository既定である。OS別の暗黙保存先へ分散保存しない。CLI optionと環境読取りは明示enable要求の診断へ接続済みだが、有効化処理ではない。診断は、既に存在するRepository／Root／直近parentのnon-link実体Identityおよびlexical／realpath containmentを照合する。Repository自身またはRepositoryを内包する祖先DirectoryをRootにできず、安定したFilesystem Identityを取得できない場合も`blocked`にする。Repository外overrideを許可するRuntime-owned Human Authorization Capabilityは未実装なので、相互非包含を確認できてもPath IdentityおよびGit local exclude入口は`runtime_root_external_write_authorization_required`でEffect前停止する。Directoryの存在、override指定またはRepository内設定だけでは有効化せず、明示的なenable要求とRuntime所有activation記録を必要とする。いずれのCore候補もCapabilityを発行しない。保存層、Operation Rootおよび将来のRepository Bindingは[Reference Architecture](#21-filesystem保存境界)を正本とする。

`.crdd-runtime/**`はGitの追跡有無にかかわらずCandidate Revision、Operation入力およびProvider mountへ含めない。ignoreは誤commit防止の補助であり、Filesystem安全境界ではない。明示enable時に選択RootがRepository内なら、Repository Adapterがroot相対の完全一致entryを`.git/info/exclude`へ冪等に追加し、tracked `.gitignore`は変更しない。Repository外overrideにはGit excludeを追加しない。Runtime 1.0は外部Git CLIをAuthorityとして起動せず、通常worktree、linked worktreeおよび`.git` fileを使うが`core.worktree`を持たない限定worktreeだけを内蔵parserで確認する。common configにRepository format version 0と`core.bare=false`がそれぞれ一つだけ明示され、`extensions`、設定`include`および`core.worktree`を使わない構成だけを受理する。標準submodule自身を含むそれ以外の構成はGitとして有効でも`blocked`にする。これによりWindows、macOS、Linux／serverでGit実行ファイルのPathやHashを別管理しない。

現在のmetadata書込み候補は、既存内容を131072 byte上限で同一handleから読み、専用lockを排他的に取得し、同一directory内で書込み・同期してから置換し、完全一致entryを再読取り確認する。適用時はRepository、選択Root、直近parent、包含分類および選択元を最初のPath Identity snapshotへ固定し、内部RootではGit layout確認後、書込み直前、さらに書込み後の各時点を同じ初回snapshotへ照合する。外部overrideも完了直前まで同じ初回snapshotを維持できた場合だけGit exclude不要候補とする。後続確認のたびに置換後の実体を新しい基準へ取り直さない。既存lock、link、Identity変化、同時更新、上限超過、書込みまたは事後確認失敗は`blocked`へ閉じ、未知lockを推測削除しない。書込み後のRoot再確認が失敗した場合は、書込み済み事実を保持して停止する。解決結果のPathを公開せず、親Repositoryが参照するCRDD submoduleや別Repositoryへ処置を広げない。標準submodule自身をRuntime対象にする経路を現版で受理しないことと、参照中のsubmoduleを変更しないことは別の境界である。linked worktreeの`info/exclude`は同じcommon Git directoryを使うworktree間で共有されるため、linked worktreeでは既定`<repository>/.crdd-runtime/`だけをRepository内Rootとして許可し、Repository内custom Rootは拒否する。custom配置が必要な場合はRepository外overrideを使用でき、その場合はGit excludeを追加しない。限定parserが確認するのはmetadata配置graph／config候補であり、完全なRepository Identityではない。既存のGit `info` directoryがない場合、完全なparent chain／ACL、activationとの結合およびCapability発行は未実装である。この専用統合処置はIdentity descriptor、汎用callback、tokenまたはCapabilityを公開しない。同一権限Hostによる各Filesystem呼出し間の最終raceを完全に防ぐことは主張せず、activation Adapterの未実装境界に残す。`disable`は新規Operationを停止し、進行中Operationを安全なcancel／recovery契約へ渡す。保存データの削除は別の明示操作に分離する。現在は永続disable遷移とOperation結合を実装していない。Rootの作成、全parent chainのPath保護、所有主体／ACL確認およびactivation記録の永続化も未実装である。

自己生成したexclude書込みlockでは、書込み中の可変時刻とファイルの同一性を区別する。書込み・同期後は開いた時点のtype／device／inode／birthtime／modeとPathを保持し、handleとPathの双方で期待sizeを確認する。close成功後、同じ実体を安定読取りして期待bytesと完全一致することを確認した地点で、書込み後の時刻snapshotを確定する。rename直前はこの確定snapshotを厳密照合する。Repository、Root、元excludeの初期snapshotを取り直す例外ではなく、close失敗・置換・内容改竄・mode変更を正常更新へ取り込まない。

過大なProfile／Registry入力、許可数を超えるGrant／Origin、長すぎる識別子／Origin、またはcanonical UTCでない評価時刻はAuthority候補にせず`blocked`へ閉じる。Trust Anchor Loader CoreはRegistryをJavaScript値へ展開する前に131072 byteの上限を強制する。File Bundleを実際に読み取るRuntime所有Path Adapterは未実装であり、その入口でも取得量、選択済みRoot、Provider非到達、所有主体／権限および実体Identityを別途強制する。

Profile、Registry、および評価Contextのrecord／array構造は、JSON相当のplain dataだけを受理する。評価Contextの`now`だけは型付き値の例外として、Context recordから一度取得した有効な`Date`、またはcanonical UTC文字列を受理し、canonical UTC文字列へ変換して以後の評価に使用する。動的getter、Proxy、symbol、独自prototype、疎配列または余分な配列propertyを含む入力は値を実行・再読せず`blocked`にする。検査済みのproperty descriptorから作った固定snapshotだけを、正規化、比較およびHashへ使用する。

外部overrideの関係分類およびGit exclude不要という説明はPath分類だけを示し、利用許可を意味しない。外部Rootを許可するRuntime-owned Human Authorization Capabilityが未実装のため、実入口は分類後に必ず`runtime_root_external_write_authorization_required`へ閉じる。

### Provider Egress Proxy

Provider Egress ProxyのPolicy候補は、生Profileを内部Validatorで再検証し、そのValidatorが生成した正規ProfileとHashからだけ要求Originのhostnameを取り出す。呼出側が組み立てた検証結果、Hashまたは正規化済みと称するobjectは受理せず、Authority確認済みPolicyへも昇格しない。許可候補は`CONNECT`、完全一致hostnameおよび文字列として厳密なport `443`だけであり、通常HTTP method、wildcard、別表記のport、IP literal、userinfo、末尾dotまたは別hostnameを拒否する。

DNS結果は32／128 bitへ正規化し、固定したIANA IPv4／IPv6 Special-Purpose Address Registry snapshotを最長prefix一致で評価する。IPv6はさらにIANA IPv6 Global Unicast Address Spaceの`ALLOCATED` snapshotへ照合し、special-purpose規則で許可された範囲または明示的な割当範囲だけを候補にする。`Globally Reachable`が`true`でない登録、未割当／予約範囲、legacy compatible IPv6、site-local、multicast、判定不能なaddress、またはpublic addressに混在するspecial addressを拒否する。IPv4-mapped IPv6と`64:ff9b::/96`のNAT64 addressは埋込みIPv4へ還元して同じ規則を適用する。この判定とfixtureはRuntime ProxyによるDNS固定、TLSおよびsocket接続の実強制ではなく、実強制前は候補のままとする。

Local Personal一般Taskで接続済みの通信経路と固定実測の限界は[Providerの通信経路](#121-providerの通信経路)を参照する。上記pure Policy候補単独の検証結果を、その接続または実行許可の証明へ読み替えない。

### 承認済みProvisioning実装パッケージ

後続の人間判断により、一回限りのオンライン登録チャレンジ（online enrollment challenge）は発行時から30分有効とする。nonce、installation public key、Platform scopeおよび登録要求へ結合し、最初の検証試行が成功でも失敗でも消費して再利用しない。期限切れは`blocked`とし、新しいchallengeを要求するが、offline方式へ自動fallbackしない。この期限は登録通信だけに適用し、通常runや利用者への細切れの指示を発火させない。端末秘密鍵による所有証明を要求し、登録要求object Envelopeはpayloadの端末導入鍵IDと一致するECDSA P-256 with SHA-256の固定64-byte IEEE P1363署名exact 1件だけを受理する。登録証明書object Envelopeは準備認証局候補鍵に結合するEd25519署名exact 1件だけを受理するが、その鍵のRuntime所有Trustは未実装である。両Envelopeのcanonical JCS UTF-8 raw byte decoderは実装済み候補である。Runtime所有のwall clockとmonotonic clockの後退検出、および成功・失敗の最初の検証試行をprocess内で一回消費するControllerも実装済み候補であるが、process再起動をまたぐ永続台帳、transportおよびEffectは未実装である。署名済みoffline bundleのexact object Envelopeと暗号・binding検査も実装済み候補で、7日有効かつ一度だけ利用するが、raw decoder、永続消費台帳およびFilesystem importは未実装である。準備認証局はoffline rootとonline／offline issuing keyを分離し、issuing keyの最大期間365日、切替overlap 30日、失効情報freshness 24時間とする。Trust epoch／revisionとsame-revision Hashの単調floorを要求する。

保存目標は、Authority Root内の準備記録をimmutable content-addressed成果物とatomic current pointerへ分離し、Repository側のactivationと検索票を同じimmutable generationと単一pointerで可視化する。Authority Rootの確定を先行させ、cross-volume atomicityは主張しない。immutable file fsync、generation directory fsync、pointer temporary file fsync、pointer atomic replace、pointer parent directory fsync、再読取Identity確認の順を要求し、各fsync、atomic replace、再読取またはIdentity確認のfailure／unknown／mismatch、および結果分類不能では、今回作成済みの成果物と検証済みの既存journalだけを回復用に保持して`blocked`とし、明示的回復を要求する。journal不存在または保持確認不能も`blocked`のままとし、推測rollback、自動retry、旧pointerへのfallbackまたは成功扱いを行わない。明示的回復の具体手順とEffectは未実装である。disableはinactiveな検索票を同じgenerationへ保持し、再有効化は新activation IDを要求する。

準備記録Store候補はAuthority Root直下の固定`.crdd-provisioning/records/<recordHash>.json`をimmutable envelopeとし、同directoryの`current.json`をcanonical current pointerとする。Record fileとpointer pendingをそれぞれ`fsync`し、directory同期、pointer原子的置換および同一handle再読取りを要求する。更新時は前Record Hash、revision増分、Record ID、Platform scope、Provisioner Identityおよび登録IDの系列一致をpure Coreで確認し、同一Hashだけを冪等候補として許す。通常の読取りと書込みはpendingがあれば`blocked`とし、明示復旧だけがpendingとimmutable Recordを再検証する。currentが欠落していればpendingを採用し、currentと同一ならpendingだけを除去し、異なる場合は正しい次revisionの系列に限ってcurrentへ進める。改変、系列不一致または再読取り不一致では推測復旧せず、raw envelope、絶対Pathまたは署名値を公開結果へ出さない。Authority Root作成／保護、Trust検証からfloor／Record Storeへのcontroller接続およびProvisionerからの実書込み接続は未実装である。

Authority Root結合pure候補は、明示選択した絶対Path、観測済みRoot Identity Hashおよび保護policy Hashを署名済みRecord内の3値と完全一致させる。Windows resolverはRepositoryとAuthority Rootのlexical／realpath相互非包含およびnon-link Directory IdentityをTrust／Record読取りの前後で固定する。Rust Coreと署名manifestへ結合する読み取り専用の成果物観測候補、および明示Release署名commandによるステージングmanifest配置処置は存在するが、保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像とProtection Hash生成が未実装のため実測2 Hashを生成せず、観測済みRecord結合入口は`blocked`である。結果には絶対Path、SIDまたはACLを公開しない。POSIX探索、初期Trust、権限変更、activationまたはRuntime Authority発行を代替しない。

準備Trust floor候補は、検証済みTrust Anchor SetのHash、信頼epoch、失効一覧Hashおよび失効revisionを一つのcanonical状態へ結ぶ。同じepochではTrust Anchor Set Hashを変更できず、失効revisionは単調増加、同じ失効revisionではManifest Hash完全一致を要求する。新しいepochだけが新しいTrust Anchor Setと失効系列を開始できる。専用Storeは`.crdd-provisioning/trust-floor.json`だけをcanonical byteで保存し、pending、`fsync`、原子的置換、再読取りおよび明示単調復旧を所有する。caller supplied値はAuthorityにならず、Runtime所有Trust配布と検証結果からStoreへの実接続は未実装である。

Trust成果物Store候補は、信頼起点鍵集合を`.crdd-provisioning/trust-anchors/<sha256>.json`、失効一覧を`.crdd-provisioning/revocation-manifests/<sha256>.json`へcanonical byteのimmutable成果物として保存する。既存成果物は同一byteだけを冪等に受理し、新規成果物はexclusive create、file `fsync`、対応OSでのdirectory同期および安定再読取りを要求する。読取り時はtrust floorが指定する2つのHash、信頼epochおよび失効revisionへ再結合する。current Recordの安定読取り、floorへ結合したTrust成果物およびRuntime取得時刻を同じ集約検証へ渡し、全署名、鍵の有効期間および失効状態を再確認する。Windowsでは検索票resolver、Repositoryとの相互非包含、安定Root IdentityおよびRecord Hash結合までを候補接続した。Rust Coreと署名manifestへ結合する読み取り専用の成果物観測候補、および明示Release署名commandによるステージングmanifest配置処置はcomponent候補だが、保護済み有効世代、検証済み実行イメージ、プロセス起動、Root観測成果物への写像と署名済み保護Hashへの実測結合は未実装である。実TrustをRepositoryへ埋め込まず、初期Trustの承認済み導入元、POSIX Root観測、Runtime Authority発行およびactivationは未接続のまま維持する。

Root権限の変更主体は全package Trust条件を満たした明示Platform Provisioner経路だけとし、Runtimeの通常runによるpermission mutationを禁止する。WindowsはRuntime Rootをruntime SID read/write、Authority Rootをprovisioner／承認admin write＋runtime SID read-onlyとし、継承と広範なwrite ACEを拒否する。POSIXはRuntime Rootをruntime UID owner／mode `0700`、Authority Rootをprovisionerまたはroot owner＋runtime read/traverse ACLとし、未承認group／other writeを拒否する。local相当の安定Identity、durable atomic replaceおよび同等ACLを実証できないnetwork／removable／special／unknown volumeは`blocked`とする。

初回オンラインのチャレンジ／登録要求／登録証明書についてはexact object Schema、成果物別domainおよびJCS署名messageを実装済み候補とする。署名前payloadのcanonical raw byte decoder、登録要求／登録証明書のexact object Envelope、および両Envelope全体のcanonical JCS UTF-8 raw byte decoderも実装済み候補である。オフライン束のexact object Envelope、online／offline issuing 2役のchain、要求・証明書・失効snapshotのbindingおよび署名検査も実装済み候補である。未実装として残るのはtransport、オフライン束raw decoder／import Effect、証明書更新、永続replay台帳、Runtime所有CA Trust／rollback floor、CA実配布LifecycleおよびOS／Filesystem Adapterである。現在の投影は入力、Network、Filesystem、鍵操作、AuthorityまたはCapabilityを発行せず、12 blockerと6 run根拠を維持する。


## 16. 実装言語と型・命名の保持条件

内部実装はTypeScriptを基本とし、Windows固有の観測・限定操作は[ネイティブ部品の設計](../platform-access/01_Architecture.md)へ分離する。命名試験は3つのTypeScript projectとPath母集団の一致、およびRust sourceの独立した閉集合を固定し、新module追加時は同じ母集団を更新する。詳細は[内部ツールのコーディング規約](../99_Coding_Standards.md)を正本とする。

共通の実行時assertion helperで不正入力fixtureを安全に絞り込み、外部入力は`unknown`から実行時検証で絞る。`strict`に加えて`noImplicitAny`を明示し、TypeScript版の既定展開に依存せず暗黙の`any`を拒否する。移行対象と当時の判断は[CHG-000017の実装発展](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#5-実装発展と統合した旧chg)へ集約する。
