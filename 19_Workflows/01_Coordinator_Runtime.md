# Coordinator Runtimeの利用・検証・発行手順

Status: Candidate
Owner: Qual-Lab
Last Updated: 2026-08-31

## 目的・対象・実行前条件

この手順は、CRDD参照Runtimeを診断・実行・検証し、必要な場合に配布を発行する担当者向けである。一般利用者にRelease秘密鍵やpassphraseは不要である。機能の成立条件と未対応範囲は[振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、資源・権限・復旧方式は[アーキテクチャ](../06_Architecture/01_Architecture.md)、検証計画・現在品質は[品質確認](../07_Quality/01_Quality_Center.md)を正本とし、手順の実行だけで採用・Releaseを成立させない。

1. 対象Repository、固定配布版、実行Node、選択ユーザー、許可された目的・送信先・情報範囲を確認する。
2. 通常利用は公式Release tagへ固定したcloneまたはsubmoduleを使い、同梱manifestとNative Runtime成果物の真正性を確認する。未署名の開発branch、改変されたcheckoutまたは過去の署名候補を公式配布物とみなさない。
3. 診断結果を確認し、必要な準備が不成立なら止める。以下のコマンド一覧にはgrammarだけを実装した候補も含むため、利用可能性を一覧だけで判断しない。
4. 許可範囲内のTaskを実行し、結果と回収状態を確認する。候補は検証してからexport／discardし、正本への採用は人間の決定権限に従う。
5. 不明な残存、Identity差、失効または手動回復要求では通常Taskを再試行せず、仕様が示すexact IDと専用回復手順へ戻す。
6. 実行結果はCHGまたは品質保証の記録へ返す。日々のログをこの手順へ累積しない。


<a id="common-launch-entry"></a>

## 毎回の起動方法を組み立てない

通常操作は、検証済みNodeから同じ配布物の`bin/launch.ts interactive`を直接起動する。AIが実行ごとにwrapper、JSON pipeline、出力転送または別の入力readerを作り直さない。以下は絶対Pathの置換だけを行い、Shell文字列へ組み立て直さない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" interactive doctor --json
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" verify-routes
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" verify-recovery
```

自動化担当は`automation <CLI引数と--json>`を使い、構造化stdinをバイト列のまま渡し、stdoutを機械向けに受け取る。対話同意を自動入力せず、不足時は停止結果を処置する。公式配布担当の署名は`sign-release`の後に既存の署名引数をそのまま渡す。秘密値を引数へ含めない。

対話・署名・4経路検証ではstdoutをfileやpipeへ転送しない。ログ採取を優先して端末を失わせない。出力採取が必要な自動処理と人間の対話を同じ一時wrapperで兼用しない。ウィンドウが必要な場合はホスト側が可視端末を用意し、終了後も読める状態を保持する。共通入口自体は追加ウィンドウや終了待ちEnterを作らない。

起動入口の端末結合だけを再確認する場合は、検証済みNodeから`40_Develop/coordinator/tests/fixtures/coordinator-launch-terminal-probe.ts`を実端末で直接実行する。実CLIのhelpと用途不一致の拒否を確認するもので、秘密入力・Provider・Docker・Repository変更は行わない。通常の契約試験と併用し、この確認だけで正式E2Eを合格にしない。

### 検証画面を閉じた後の結果確認

結果保存に対応した配布物の4経路／復旧検証では、対象Repositoryの`.crdd/verification-results/<UUID>/`を確認する。`started.json`、`result.json`、`complete.json`のID・種別・開始時刻が一致し、全てをJSONとして読み取れ、完了記録の`resultSha256`と結果fileのSHA-256が一致することを確認する。開始時Repository改訂版を実行配布版と取り違えず、終了記録が保持する検証結果の版情報と対象を照合する。完了記録なし、部分書込み、組合せ／hash不一致、未知値や不完全表示があれば、その範囲は未確認のまま残す。

この記録には会話、確認コード、passphrase、Provider生出力は残らない。未知の停止理由は`unknown`となるため、完全な調査ログの代替ではない。自動的な再実行・回復・署名承認に使わない。不要になった記録は対象を確認した担当者が明示的に清掃するまで保持し、Runtimeは容量超過時にも古い記録を削除しない。Gitは非追跡とし、正式Evidenceへ採用する際は別途対象版と根拠を確認する。旧署名配布物にはこの保存機能を継ぎ足さない。

以下の直接entrypoint一覧は既存CLIと内部処理の契約を説明するものであり、共通入口から同じ実装へ接続する。共通入口が含まれない旧署名配布物へ新ファイルを継ぎ足さず、旧版は旧手順のまま扱う。

<a id="現在利用できるコマンド"></a>

## コマンドの構文と利用状態

以下はコマンドの構文を含む一覧であり、全項目が通常利用可能という意味ではない。目的から入口を選び、候補段階の操作を通常Taskの準備として試し続けない。

| 目的・担当 | 使用する入口 | 成立条件と次の確認 |
|---|---|---|
| 利用者・呼出し元が準備を調べる | `doctor`／`doctor --json` | Providerを起動しない事前診断。一時領域の生成・回収を伴う。表示された候補を認証・隔離・実行許可の成立へ読み替えない |
| 許可された一般Taskを実行する | `task --request-stdin` | 署名配布、Repository・同意・Authority・Providerの各検査が必要。候補と回収結果を確認する |
| 候補を取り出す・破棄する | `candidate export`／`candidate discard` | exact ID、期限、対象を再検証。取り出しを正本採用としない |
| 復旧担当が残存資源を処置する | `doctor --recover-isolation`／`candidate recover-store` | exact IDと所有・状態が一致する場合だけ。通常Taskの自動再試行にしない |
| 保守担当が隔離を検証する | `doctor --isolation` | Docker／一時Filesystemの効果を伴う固定Fake診断。実Provider利用・実Provider取消の証明ではない |
| 有効化・準備候補を調べる | `doctor --enable-runtime`、`activate`、`disable`、`provision` | 構文と部分実装の候補。現行の接続・停止状態は[仕様](../05_SPEC/01_Behavior_Specification.md#診断有効化候補回復の公開境界)で確認し、通常利用可能としない |
| 開発・配布担当が検証する | 下記の開発検証、正式署名Runner | 日常開発と公式署名を分ける。一般利用者にRelease鍵を要求しない |

以下の絶対Node placeholderは、version 24.12.0以上と実体を確認したNodeへ置き換える。Coordinator CLI、Release鍵生成、Release manifest署名および正式署名一般Task Runnerは、未対応Nodeを対話入力、Release検証またはEffectより前に拒否し、PATH上の別Nodeへfallbackしない。package scriptを使う検証では、親のnpmだけでなくscript内の`node`とその子Processも同じ検証済みNodeへ解決されることを確認する。親だけを絶対Pathで起動し、子がPATH上の旧Nodeへ戻る状態を検証済みと扱わない。Sourceや試験のPathは、現在DirectoryをRepository Identityとして意図的に使う公開契約を除き、module基準の絶対Pathへ固定する。


```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --isolation --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --enable-runtime --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --enable-runtime --runtime-root "<absolute-path>" --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --recover-isolation <recovery-id> --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" activate [--runtime-root "<absolute-path>"] [--authority-root "<absolute-path>"] [--json]
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" disable [--runtime-root "<absolute-path>"] [--json]
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" provision [--json]
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" task --request-stdin [--json]
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" candidate export --candidate-id <opaque-id> --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" candidate discard --candidate-id <opaque-id> [--json]
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" candidate recover-store --recovery-id <opaque-store-recovery-id> --confirm [--json]
```

実行Pathを表す各placeholderは同じ保守sessionで検証した絶対Pathへ置き換える。保護操作をsession変数、PATH上の裸の`node`、相対entrypoint、または内部で別Runtimeを再選択するpackage aliasへ置き換えない。`doctor`とRelease manifest署名は外部Git CLIを起動せず、Repository所有のbounded Git object readerでCommit／Treeを読む。


### 正式署名一般Taskの固定検証

入力元は凍結した配布候補と許可された検証対象Repositoryである。期待結果は対象契約の`completed`と終了コード0、候補処置・回収の成立。非0または結果不明なら、その固定版の結果を保持して原因・必要な回復を確認し、同じ操作を無条件に繰り返さない。

正式署名配布物のRelease Gateでは、上記の汎用stdin入口へShellからJSONを組み立てて渡さない。対象Repositoryを現在Directoryにした対話端末から、署名済み配布物内の固定Runnerを直接起動する。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-general-task.ts"
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-general-task.ts" --route reverse
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-general-task.ts" --route same-codex
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-general-task.ts" --route same-claude
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-route-matrix.ts"
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\revoke-external-send-consent.ts"
```

`<absolute-preverified-node-24.12+-executable>`は、絶対Path、version 24.12.0以上および実体を直前に確認したNode実行ファイルで置き換える。PATH上の裸の`node`、version判定不能または未対応Nodeを使用しない。Runner自身はNode versionをPackage／Release検証とTask開始より前に再確認する。独立したconsole availability preflightは行わず、初回同意が必要な場合だけTask Runtimeが[設計に定める単一Console lifecycle](../06_Architecture/coordinator/01_Architecture.md#14-consoletask内部搬送回収の実装契約)を実行する。有効な同意の再利用時はconsoleを要求しない。


### 正式署名Recovery Matrixの固定検証

固定Workerの復旧検証であり、実Providerの認証・通信を使う試験ではない。期待結果は全要求シナリオの成立と回収確認。未達・回収不明なら残るIDと影響を保持し、正式配布の合格へ進めない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\scripts\verify-signed-recovery-matrix.ts"
```


## 入力搬送の維持

対話境界を、PowerShellのtext pipeline、`ConvertTo-Json`、一時request file、長い`Start-Process ... -Command`または入れ子Shellへ再構成してはならない。Windows PowerShell 5.1とPowerShell 7ではprocess標準入力API、既定encodingおよび引数再構成が異なり、正しいTaskが実行前に壊れるためである。Release鍵生成／署名は既存のdirect TTY command、外部送信承認はRuntime所有のconsole challenge、OAuth bootstrapは公式Provider CLIと外部system browserをそれぞれ唯一の対話入口とする。対話端末を取得できない場合は別搬送へfallbackせず停止する。


## Docker Desktopの旧復旧記録を扱うとき

Docker Desktop最終復旧の起動環境と旧記録の処置は、[専用のHome・作業Directoryと検証境界](../06_Architecture/coordinator/01_Architecture.md#22-docker-desktop最終復旧時の起動環境)に従う。署名配布Rootを作業Directoryとして継承させない。旧版の復旧記録は、対象IDと元配布を明示する`doctor --adopt-docker-desktop-repair <repair-id> --from-release <absolute-root>`で由来を検証し、既存ID・記録・退避物を保持して引き継ぐ。これは過去の停止・起動・移動を再実行するコマンドではない。現在の正常状態を確認後、既存の明示closeコマンドで履歴を保持したまま終了する。開発実装の試験と、実機の中断記録への適用・正式E2Eは別に確認する。


## Release署名鍵の初回生成

OpenSSLは不要である。対話端末から次を実行し、Repository外にある未作成の絶対Pathへ鍵を生成する。20文字未満のpassphrase、既存directoryおよびRepository内Pathは拒否する。秘密鍵はAES-256-CBCで暗号化したPKCS#8 PEM、公開鍵はSPKI DERとして生成し、秘密鍵またはpassphraseを標準出力へ表示しない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\scripts\generate-release-key.ts" --output "$env:USERPROFILE\CRDD-Release-Key-v1"
```

CRDDへ取り込むのは`crdd-release-v1-public.spki.der`だけである。`crdd-release-v1-private.pem`はRepository、Issue、Pull Request、チャットまたはCIへ渡さず、Qual-LabのRelease保管領域と暗号化backupで管理する。このコマンドは鍵生成だけを行い、Manifest署名、ReleaseまたはEffectを自動実行しない。現在の公開鍵はCRDD所有の不変source literalへ固定済みで、SPKI SHA-256は`6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f`である。

## Release manifestの生成

この節は公式配布担当者向けである。入力は凍結したCommit／Tree、その内容から作ったstaging、既存の暗号化秘密鍵と発行情報。期待結果は同じ配布内容へ結合した署名manifestの生成であり、Release公開そのものではない。配布Root・Treeの不一致ならstagingの作成元へ戻り、復号失敗なら秘密入力だけを確認する。失敗原因を区別せず秘密鍵を作り直したり、日常開発のたびに署名したりしない。

署名済みRelease manifestは自己参照を避けながらGitだけで配布できるよう、次の二Commit手順で生成する。

1. Release候補Commit Aへ、Source、文書、試験および固定Pathの2つのNative Runtime成果物を含め、`template/tools/coordinator/coordinator-package-manifest.json`は含めない。Local Personal v1の通常buildはall-zeroのpublisher digestでAuthenticodeを明示的に非必須とし、固定publisher digestを指定したbuildだけ追加のAuthenticode検証を必須にする。
2. Commit Aのblob byteを変換せず、Repository-localの`<repository>/.crdd/release-staging/<candidate-id>`へ展開する。`<candidate-id>`は小文字英数字とhyphenからなる単一Directory名に固定し、Repository直下、`.crdd`直下、別用途の`.crdd`領域、入れ子Path、別Repository、Repository外Root、linkまたはGit metadataを持つRootを受理しない。
3. Commit A／Tree Aと2つのNative成果物を照合し、stagingの固定Pathへmanifestを生成する。生成commandは既存manifest、固定公開鍵と一致しない秘密鍵、非canonical時刻または不正なIdentityを拒否する。秘密鍵のpassphraseは対話端末でだけ入力し、標準出力へ出さない。
4. 生成したmanifestだけをRepositoryの同じ固定Pathへ追加してCommit Bを作る。`git diff <Commit-A>..<Commit-B> --name-only`がmanifest 1件だけでなければReleaseへ進めない。
5. 公式tagとReleaseはCommit Bへ付ける。manifest内の`crddCommit`／`crddTree`はCommit A／Tree Aを示す。RuntimeはCommit Bの内容からmanifestだけを除外してTree Aを再構成し、2つのNative成果物はTree Aの一部として検証する。cloneまたはsubmoduleに存在するRoot直下のexact `.git` metadataは、non-linkのfileまたはdirectoryであることを確認して署名対象Treeから除外する。

これにより、公式tagへ固定したcloneまたはsubmoduleは別archiveを取得せず通常Runtimeを利用できる。GitHub Releaseへ同じ内容の独自ZIPを追加しない。GitHubが自動生成するSource archiveもRuntime配布契約または検証対象にしない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\scripts\sign-release-manifest.ts" --distribution-root "<absolute-staging-root>" --private-key "<approved-absolute-private-key-file>" --crdd-version <vX.Y.Z> --release-sequence <positive-safe-integer> --crdd-commit <commit-id> --crdd-tree <tree-id> --issued-at <canonical-utc> --expires-at <canonical-utc>
```

ここで`<absolute-staging-root>`は、上記Repository-local staging Rootのexact candidateでなければならない。

上の例は期間限定の検証配布である。期限なしの正式配布では`--expires-at <canonical-utc>`を`--no-expiry`へ置き換える。どちらか一方だけが必須であり、未指定・両方指定・重複・不正日時は秘密入力前に停止する。新規署名はmanifest／envelope revision 3を使用し、期限なしは署名payload内の`expiresAt: null`に結合する。旧revision 2の期限を編集して延長しない。一般利用者は署名済み配布物を検証するだけで、公式鍵やpassphraseを入力しない。配布物の期限なし指定を、同意・Grant・準備記録の無期限化と混同しない。

配布Identityと成果物の結合条件は[署名と内部成果物の設計](../06_Architecture/coordinator/01_Architecture.md#release-artifact-binding)に従う。手順から固定Path・検査・停止条件を変更しない。


## 開発者確認

<a id="terminal-interaction-check"></a>

### 端末の表示・入力を確認する

[UIの確認範囲](../04_UI/01_User_Interface.md#4-現行表示の参照と表現方針)に従い、既に開いているWindows Terminal／PowerShellで、検証したリポジトリRootから次を実行する。これは秘密入力・署名・外部送信・実行許可を伴わない参照であり、製品Taskの成功を証明するものではない。

```shell
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts match
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts mismatch
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts timeout
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts cancel
```

`match`では`123456`、`mismatch`では`654321`を入力し、それぞれEnterを1回だけ押す。秘密や実際の承認コードは使わない。`timeout`は5秒、`cancel`は1秒、何も入力せず結果を待つ。各結果の`scenarioMatched`と`cleanupConfirmed`がともに`true`であることを確認する。不成立時は結果を保存して原因を調べ、入力を自動補完したり成功へ読み替えたりしない。`cancel`は入力待ちへの取消要求の確認であり、Ctrl+Cのキー搬送やTask資源全体の取消完了の確認ではない。

日本語、入力位置、折返し、文字拡大、結果が読める状態で端末が残ることは人間が確認する。プログラムは終了保持のための追加Enterを消費せず、ウィンドウ保持は呼出し元端末が所有する。端末の実バージョンと表示条件、確認結果、未確認範囲を検証結果へ残す。読み上げは今回未評価である。

### 自動試験と開発確認

以下は検証済みリポジトリRootから実行する。試験前に、実行Processの`TEMP`と`TMP`をそのRoot直下の`.crdd/test-tmp`へ設定し、通常の実Directoryであることを確認する。未設定またはRootを確認できない状態では試験を開始しない。OS全体や永続ユーザー環境の値は変更しない。

```shell
npm test --prefix 40_Develop/coordinator
npm run development-e2e:verify --prefix 40_Develop/coordinator
npm run typecheck --prefix 40_Develop/coordinator
```

CRDD内部ScriptはTypeScriptを標準とし、Node.js 24.12以上のnative TypeScript実行を採用する。`tsx`、`ts-node`、BundlerまたはRuntime用npm packageを要求せず、TypeScript Compilerは開発時の型検査だけに使用する。Coordinator本体、CLI、Policy、契約および試験はTypeScriptに保持し、production／testを別のstrict設定で`noEmit`検査する。例外はOS APIへ型安全に接続する`40_Develop/platform-access/`のprivate Rust componentだけで、公開CLI、単独製品または採用Repositoryの依存にしない。Node native type strippingで消去できない構文、tsconfig path aliasおよびRuntime挙動を変えるCompiler変換は禁止する。攻撃的な不正shapeやNode API差替えを扱う試験fixtureも`unknown`と実行時assertionで表現し、型に合わせて負例を弱めず実行時試験を維持する。

日常の開発反復ではRelease manifestを作り直さない。`npm run development-e2e:verify --prefix 40_Develop/coordinator`が、4経路、一般Task、Candidate、独立Review、一回是正およびRecovery Matrixのproduction契約を固定Fake／契約・結合試験で検査する。この入口はRelease鍵、passphrase、実Provider、Provider Credential、Network EffectまたはRelease Authorityを使わない。正式署名E2Eは、全機械確認を通過して凍結したRelease Candidateに対してだけ一度実施し、失敗ごとに署名を挟むデバッグ手順にしない。一般利用者は発行済み署名配布物を検証して利用するだけであり、Release秘密鍵またはpassphraseの入力・保有を要求されない。公式Release担当者だけが新しい公式配布物を発行するときに署名する。

開発時のLintとFormatterはRepository rootの`biome.json`を正本とするBiome 2.5.6へ統一する。Coordinatorは`npm run lint --prefix 40_Develop/coordinator`、`npm run format:check --prefix 40_Develop/coordinator`および`npm run check --prefix 40_Develop/coordinator`で確認し、意図的な書換え時だけ`npm run format --prefix 40_Develop/coordinator`を使う。BiomeはdevDependencyでありRuntimeへ含めない。

内部ツールの命名とTypeScript／Rust sourceは[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md)に従う。Checkerは`40_Develop/checker/`のprivate packageがTypeScriptのpackage entry adapter、test、fault injectorとJSON型設定を所有する。配布正本`template/tools/crdd-check.ts`はpackage外に置き、追加installを要求しない採用側CLIの正本としてpackage entry adapterから参照する。これは旧入口を維持する互換wrapperではない。Checker packageの開発確認は次を使用する。

```shell
npm run check --prefix 40_Develop/checker
npm run test --prefix 40_Develop/checker
npm run --silent verify:repository --prefix 40_Develop/checker
```

`check`は型、Lint、Formatter、`test`はChecker回帰試験、`verify:repository`はpackage rootから`../..`を明示してCRDD公式Repository全体を確認するprivateな保守入口である。採用Repositoryの実行方法、外部package配布、CRDD準拠条件またはRelease手順ではない。

Rust packageを移設した後は、旧配置から持ち越した`target`を検証の根拠に使わない。コンパイル時に埋め込まれた絶対Pathが残り、コードを変更していなくても試験用binaryを起動できない場合がある。検証したcrate Rootの`target`配下に新しい実行専用Directoryを選び、そのProcessの`CARGO_TARGET_DIR`へ設定して、固定toolchain・`--frozen --offline`で再ビルドと試験を行う。既存キャッシュや署名配布物の削除は必要ない。生成物はGit非追跡のまま保持し、同じPathの古い試験結果を新配置の合格へ流用しない。

Runtime 1.0のその他のCLIは、成立性Gate、Protocol、状態不変条件および永続Storeが固定されるまで提供しない。
