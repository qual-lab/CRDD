# Coordinator Runtimeの利用・検証・発行手順

Status: Stable
Owner: Qual-Lab
Last Updated: 2026-09-01

## 目的・対象・実行前条件

この手順は、CRDD参照Runtimeを診断・実行・検証し、必要な場合に配布を発行する担当者向けである。一般利用者にRelease秘密鍵やpassphraseは不要である。機能の成立条件と未対応範囲は[振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、資源・権限・復旧方式は[アーキテクチャ](../06_Architecture/01_Architecture.md)、検証計画・現在品質は[品質確認](../07_Quality/01_Quality_Center.md)を正本とし、手順の実行だけで採用・Releaseを成立させない。

1. 対象Repository、固定配布版、実行Node、選択ユーザー、許可された目的・送信先・情報範囲を確認する。
2. 通常利用は公式Release tagへ固定したcloneまたはsubmoduleを使い、同梱manifestとNative Runtime成果物の真正性を確認する。未署名の開発branch、改変されたcheckoutまたは過去の署名候補を公式配布物とみなさない。
3. `capabilities --json`と診断結果を確認し、必要な準備が不成立なら止める。Helpに存在しないcommandを推測しない。
4. 許可範囲内のTaskを実行し、結果と回収状態を確認する。候補は検証してからexport／discardし、正本への採用は人間の決定権限に従う。
5. 不明な残存、Identity差、失効または手動回復要求では通常Taskを再試行せず、仕様が示すexact IDと専用回復手順へ戻す。
6. 実行結果はCHGまたは品質保証の記録へ返す。日々のログをこの手順へ累積しない。


<a id="common-launch-entry"></a>

## 毎回の起動方法を組み立てない

通常操作は、検証済みNodeから同じ配布物の`bin/launch.ts`を直接起動する。AIが実行ごとにwrapper、JSON pipeline、出力転送または別の入力readerを作り直さない。一般Taskは第一級の`task`入口を使う。利用可能な入口は`capabilities --json`から取得し、準備commandを推測しない。以下は絶対Pathの置換だけを行い、Shell文字列へ組み立て直さない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" task --request-stdin --json
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" interactive doctor --json
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" verify-routes
& "<absolute-preverified-node-24.12+-executable>" "<signed-distribution-root>\40_Develop\coordinator\bin\launch.ts" verify-recovery
```

一般Taskでは構造化stdinをバイト列のまま渡し、stdoutを機械向けに受け取る。その他の自動化は`automation <CLI引数と--json>`を使う。対話同意を自動入力せず、不足時は停止結果を処置する。公式配布担当の署名は`sign-release`の後に既存の署名引数をそのまま渡す。秘密値を引数へ含めない。

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
| 呼出し元が利用可能な入口を調べる | `capabilities --json` | Local Personalで成立する公開commandだけを機械可読に返す |
| 許可された一般Taskを実行する | `task --request-stdin` | 署名配布、Repository・同意・Authority・Providerの各検査が必要。候補と回収結果を確認する |
| 候補を取り出す・破棄する | `candidate export`／`candidate discard` | exact ID、期限、対象を再検証。取り出しを正本採用としない |
| 復旧担当が残存資源を処置する | `doctor --recover-isolation`／`candidate recover-store` | exact IDと所有・状態が一致する場合だけ。通常Taskの自動再試行にしない。作成結果不明のDocker Taskは、後発の検証済みDocker Desktop再起動を明示結合できる専用形だけを使う |
| 保守担当が隔離を検証する | `doctor --isolation` | Docker／一時Filesystemの効果を伴う固定Fake診断。実Provider利用・実Provider取消の証明ではない |
| 開発・配布担当が検証する | 下記の開発検証、正式署名Runner | 日常開発と公式署名を分ける。一般利用者にRelease鍵を要求しない |

CRDDを`00_CRDD`へ配置した採用Repositoryでは、Project Rootを現在Directoryにして`00_CRDD\40_Develop\coordinator\bin\launch.ts task --request-stdin --json`を使用する。`40_Develop`を含まない文書だけのコピーではRuntimeは利用できないため、公式Release tagへ固定した完全なcloneまたはsubmoduleを用意する。

以下の絶対Node placeholderは、version 24.12.0以上と実体を確認したNodeへ置き換える。Coordinator CLI、Release鍵生成、Release manifest署名および正式署名一般Task Runnerは、未対応Nodeを対話入力、Release検証またはEffectより前に拒否し、PATH上の別Nodeへfallbackしない。package scriptを使う検証では、親のnpmだけでなくscript内の`node`とその子Processも同じ検証済みNodeへ解決されることを確認する。親だけを絶対Pathで起動し、子がPATH上の旧Nodeへ戻る状態を検証済みと扱わない。Sourceや試験のPathは、現在DirectoryをRepository Identityとして意図的に使う公開契約を除き、module基準の絶対Pathへ固定する。


```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --isolation --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" capabilities --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --recover-isolation <recovery-id> --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor --recover-isolation <docker-task-recovery-id> --after-docker-desktop-repair <repair-id> --from-release <historical-signed-distribution-root> --json
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

Docker資源の作成要求を耐久化した後、結果を受け取る前にProcessを失ったTaskは、空のDocker一覧だけでは回復済みにしない。そのTaskより後に開始され、署名済みの元配布から由来を確認でき、Process世代を切る停止とEngine再起動を完了して明示終了したDocker Desktop復旧記録がある場合だけ、上記の専用形を使える。RuntimeはTaskと復旧の順序、同じ選択ユーザー・保護Root・Policy、終了済み復旧記録および対象名のexactな不存在を再確認し、不存在確認をTask自身の耐久記録へ残してから通常回復を続ける。これは元Taskの自動再実行、旧配布への実行Authority付与、任意のDocker再起動による義務消去または保護記録の手動削除を許可しない。


## Release署名鍵の初回生成

OpenSSLは不要である。対話端末から次を実行し、Repository外にある未作成の絶対Pathへ鍵を生成する。20文字未満のpassphrase、既存directoryおよびRepository内Pathは拒否する。秘密鍵はAES-256-CBCで暗号化したPKCS#8 PEM、公開鍵はSPKI DERとして生成し、秘密鍵またはpassphraseを標準出力へ表示しない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\scripts\generate-release-key.ts" --output "$env:USERPROFILE\CRDD-Release-Key-v1"
```

CRDDへ取り込むのは`crdd-release-v1-public.spki.der`だけである。`crdd-release-v1-private.pem`はRepository、Issue、Pull Request、チャットまたはCIへ渡さず、Qual-LabのRelease保管領域と暗号化backupで管理する。このコマンドは鍵生成だけを行い、Manifest署名、ReleaseまたはEffectを自動実行しない。現在の公開鍵はCRDD所有の不変source literalへ固定済みで、SPKI SHA-256は`6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f`である。

## Release manifestの生成

この節は公式配布担当者向けである。入力は凍結したCommit／Tree、その内容から作ったstaging、既存の暗号化秘密鍵と発行情報。期待結果は同じ配布内容へ結合した署名manifestの生成であり、Release公開そのものではない。配布Root・Treeの不一致ならstagingの作成元へ戻り、復号失敗なら秘密入力だけを確認する。失敗原因を区別せず秘密鍵を作り直したり、日常開発のたびに署名したりしない。

署名済みRelease manifestは自己参照を避けながらGitだけで配布できるよう、署名Source A、manifest carrier B、最終Release Commit Cを分けて生成する。Cは署名後に確定する検証結果だけを取り込む文書Commitであり、Runtime実行集合を変更しない。

1. Release候補Commit Aへ、Source、文書、試験および固定Pathの単一Native Runtime成果物`crdd-platform-access.exe`を含め、`template/tools/coordinator/coordinator-package-manifest.json`は含めない。Local Personal v1の通常buildはall-zeroのpublisher digestでAuthenticodeを明示的に非必須とし、固定publisher digestを指定したbuildだけ追加のAuthenticode検証を必須にする。
2. Commit Aのblob byteを変換せず、Repository-localの`<repository>/.crdd/release-staging/<candidate-id>`へ展開する。`<candidate-id>`は小文字英数字とhyphenからなる単一Directory名に固定し、Repository直下、`.crdd`直下、別用途の`.crdd`領域、入れ子Path、別Repository、Repository外Root、linkまたはGit metadataを持つRootを受理しない。
3. Commit A／Tree Aと`crdd-platform-access.exe`を照合し、stagingの固定Pathへmanifestを生成する。生成commandは既存manifest、固定公開鍵と一致しない秘密鍵、非canonical時刻または不正なIdentityを拒否する。秘密鍵のpassphraseは対話端末でだけ入力し、標準出力へ出さない。
4. 生成したmanifestは編集可能なJSONとして扱わず、不透明なbyte列のまま共通Launcherの`promote-release --distribution-root <absolute-staging-root>`でRepositoryの固定Pathへ昇格する。この入口は、署名、Source AのCommit／Tree、閉じたRuntime実行集合、Policy、Native成果物、現在HEAD、配置先の明示的な不存在、昇格前後のbyte数とSHA-256を一つの実行で再確認する。手動コピー、Editor、整形、JSONの再serialize、Shellのtext pipelineまたは末尾改行追加で代替しない。最終Pathへ段階writeせず、同一Filesystem上の排他的hard linkで完成済みfileだけを公開する。開始時sourceと公開後の二名が同じfile objectであることを確認し、staging側の名前はこの公開Effectでは削除しない。中断後は同じcommandがsourceのみ、同一file objectの二名、明示破棄後のdestinationのみを識別して再開する。別Identity、内容変化または観測不能では削除や上書きを行わず、Commitせずに人間へ移送する。成功結果が`retained_for_explicit_staging_discard`を返した場合は、Commit Bと検証が完了した後、Repository-local stagingの所有範囲を再確認する明示破棄で後片付けする。成功後にmanifestだけをCommitしてBを作り、`git diff <Commit-A>..<Commit-B> --name-only`がmanifest 1件だけでなければReleaseへ進めない。
5. Bの署名済みRuntimeに対する検証後、結果と現在状態を反映するCommit Cを作る。BからCに変更できるのは、Release候補固定時に宣言した文書の閉集合だけである。Releaseごとの閉集合はこの節でexact Pathとして列挙し、wildcard、Directory単位または「関連文書」等の開いた指定を使わない。manifest、Runtime実行集合、Policy、Native成果物または宣言外Pathが変わった場合はCとして受理せず、新しいSource Aへ戻る。
6. Cで同梱manifestをbyte-for-byte再照合し、Package content rootとRuntime実行IdentityがBの検証時と一致することを確認する。AがBの親、BがCの祖先であり、AからBはmanifest一件だけ、BからCは上記閉集合だけであることも確認する。公式tagとReleaseはCommit Cへ付ける。CのCommit／Treeは署名対象文書へ自己参照させず、tagと結合した公式Release記録へ保存する。manifest内の`crddCommit`／`crddTree`はCommit A／Tree Aを示し、Bはそのmanifestを運ぶ祖先として保持する。RuntimeはCの内容からRuntime実行集合とmanifestを検証し、`crdd-platform-access.exe`を同じIdentityへ結合する。cloneまたはsubmoduleに存在するRoot直下のexact `.git` metadataは、non-linkのfileまたはdirectoryであることを確認して署名対象Treeから除外する。
7. 一般Taskは配布A／B／Cとは別に、実行直前の作業対象RepositoryのExecution Commit／Treeを独立観測し、隔離Candidateのbase RevisionをそのExecution Revisionへ照合する。manifest内のA、manifest carrier Bまたは公式Release Cを、採用RepositoryのCandidate baseとして要求しない。Task終了後に同じExecution Revisionを再観測できない、またはCommit／Treeが変わった場合は、Candidateを回収して成功扱いにしない。CRDD自身を作業対象にする場合だけExecution Revisionが公式Release Cと一致し得る。

### v0.19.0のCommit C許可Path

v0.19.0では、Bの署名済みRuntimeに対する最終E2Eと人間のRelease判断後、次のexact PathだけをCommit Cで変更できる。新規検証結果2件は、Provider生出力、確認値、秘密、Host PathまたはRecovery Authorityを保存せず、閉じた結果と根拠Hashだけを記録する。

- 最終E2E記録: `07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.md`、`07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.json`
- 公開入口と履歴: `README.md`、`CHANGELOG.md`、`90_Release/Changes/README.md`、`99_Roadmap/01_Product_Roadmap.md`
- 品質・手順: `07_Quality/01_Quality_Center.md`、`07_Quality/03_Verification_Design.md`、`19_Workflows/01_Coordinator_Runtime.md`
- Project Runtimeの利用・設計表示: `02_UX/01_User_Experience.md`、`03_IA/01_Information_Architecture.md`、`04_UI/01_User_Interface.md`、`05_SPEC/01_Behavior_Specification.md`、`06_Architecture/coordinator/01_Architecture.md`、`06_Architecture/coordinator/02_Threat_Model.md`、`06_Architecture/coordinator/03_Project_Runtime_Design.md`
- Release対象CHG: `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`、`90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md`、`90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md`、`90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md`
- v0.19.0のCandidateからStableへ機械的に遷移するCRDD正本: `00_Overview.md`、`01_Principles.md`、`02_Terminology.md`、`03_Documentation.md`、`04_Agent_Organization.md`、`05_Autonomous_Operation.md`、`10_Agent.md`、`11_Skill.md`、`12_Change.md`、`13_Release.md`、`14_Workflow.md`、`15_Progress.md`、`16_Quality_Assurance.md`、`17_Communication.md`、`18_Context_Dependency.md`、`19_Maintenance.md`、`21_Discovery.md`、`22_UX.md`、`23_IA.md`、`24_UI_Behavior_Specification.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`28_Implementation.md`、`29_Verification.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`

正本の機械的遷移は`Status: Candidate`を`Status: Stable`へ変え、`Released Baseline`行を削除し、Release日だけを更新する。Project Runtime固有文書はCandidate／未実装表示をStable／利用可能範囲の表示へ変える。CHGは`Released`と対象tagへ、Roadmapは完了項目の除去と残件だけの表示へ、CHANGELOGとREADMEは候補表示から公開版・公開日へ変える。ここにない本文変更、規範追加、実装変更または新しい成果物はCommit Cへ含めない。

これにより、公式tagへ固定したcloneまたはsubmoduleは別archiveを取得せず通常Runtimeを利用できる。GitHub Releaseへ同じ内容の独自ZIPを追加しない。GitHubが自動生成するSource archiveもRuntime配布契約または検証対象にしない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\scripts\sign-release-manifest.ts" --distribution-root "<absolute-staging-root>" --private-key "<approved-absolute-private-key-file>" --crdd-version <vX.Y.Z> --release-sequence <positive-safe-integer> --crdd-commit <commit-id> --crdd-tree <tree-id> --issued-at <canonical-utc> --expires-at <canonical-utc>
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\launch.ts" promote-release --distribution-root "<absolute-staging-root>"
```

ここで`<absolute-staging-root>`は、上記Repository-local staging Rootのexact candidateでなければならない。

上の例は期間限定の検証配布である。期限なしの正式配布では`--expires-at <canonical-utc>`を`--no-expiry`へ置き換える。どちらか一方だけが必須であり、未指定・両方指定・重複・不正日時は秘密入力前に停止する。新規署名はmanifest／envelope revision 5を使用し、期限なしは署名payload内の`expiresAt: null`に結合する。旧revision 2／3／4を編集、延長または現行候補へ流用しない。一般利用者は署名済み配布物を検証するだけで、公式鍵やpassphraseを入力しない。配布物の期限なし指定を、同意・Grant・準備記録の無期限化と混同しない。

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

[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md#21-実装言語と実行境界)で固定したNode.js、TypeScriptおよびRustの実行境界を前提とする。上記の`typecheck`はproductionとtestの型検査を実行するが、Runtime実行や他の検査軸の合格を代替しない。

日常の開発反復ではRelease manifestを作り直さない。`npm run development-e2e:verify --prefix 40_Develop/coordinator`が、4経路、一般Task、Candidate、独立Review、一回是正およびRecovery Matrixのproduction契約を固定Fake／契約・結合試験で検査する。この入口はRelease鍵、passphrase、実Provider、Provider Credential、Network EffectまたはRelease Authorityを使わない。正式署名E2Eは、全機械確認を通過して凍結したRelease Candidateに対してだけ一度実施し、失敗ごとに署名を挟むデバッグ手順にしない。一般利用者は発行済み署名配布物を検証して利用するだけであり、Release秘密鍵またはpassphraseの入力・保有を要求されない。公式Release担当者だけが新しい公式配布物を発行するときに署名する。

LintとFormatterの版、設定および依存境界は[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md#21-実装言語と実行境界)に従う。Coordinatorは`npm run lint --prefix 40_Develop/coordinator`、`npm run format:check --prefix 40_Develop/coordinator`および`npm run check --prefix 40_Develop/coordinator`で確認し、意図的な書換え時だけ`npm run format --prefix 40_Develop/coordinator`を使う。

Checkerの実装配置と配布境界は[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md)に従う。Checker packageの開発確認は次を使用する。

```shell
npm run check --prefix 40_Develop/checker
npm run test --prefix 40_Develop/checker
npm run --silent verify:repository --prefix 40_Develop/checker
```

`check`は型、Lint、Formatter、`test`はChecker回帰試験、`verify:repository`はpackage rootから`../..`を明示してCRDD公式Repository全体を確認するprivateな保守入口である。採用Repositoryの実行方法、外部package配布、CRDD準拠条件またはRelease手順ではない。

Rust packageを移設した後は、旧配置から持ち越した`target`を検証の根拠に使わない。コンパイル時に埋め込まれた絶対Pathが残り、コードを変更していなくても試験用binaryを起動できない場合がある。検証したcrate Rootの`target`配下に新しい実行専用Directoryを選び、そのProcessの`CARGO_TARGET_DIR`へ設定して、固定toolchain・`--frozen --offline`で再ビルドと試験を行う。既存キャッシュや署名配布物の削除は必要ない。生成物はGit非追跡のまま保持し、同じPathの古い試験結果を新配置の合格へ流用しない。
