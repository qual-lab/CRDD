# Coordinator Runtimeの利用・検証・発行手順

Status: Candidate (Coordinator固有署名方式は物理撤去済み。撤去後の全体回帰・実境界検証は未完了)
Owner: Qual-Lab
Last Updated: 2026-10-24

## 通常実行と正式配布の分離

現在の方針は[Coordinator詳細の三分離](../06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)に従う。CRDD独自署名、署名Manifest、署名Runtime Capabilityは通常Task・助言・候補生成・認証・回復の事前準備にしない。通常入口は選択Checkout／Package・現在の要求認可・必要Artifactの同一性を確認する。正式配布の真正性検査は必要時の別手順とし、通常実行許可を発行しない。

通常Task・CLI・Workbench助言／候補・Orchestratorの旧署名資格引数・三API、専用静的検査・署名Tool・Manifest設定は撤去済みである。認証入口の実測、撤去後の全体回帰・実Provider／全体E2Eは未完了であり、以下の手順だけから現候補全体の実行可能を推定しない。過去Evidence・署名・Hashは変更しない。

## 合成Repositoryの設定保存前提

フロントAIが検証用Repositoryを`git init --template=`で新規作成する場合、空templateでは`.git/info`も生成されない。検証入口自身が所有する新品fixtureに限り、`.git/info/`と空の`exclude`を明示準備してから正式な設定保存APIを呼ぶ。既存の`verify-workspace-ai.ts`のfixtureもこの準備を行っている。製品の保存処理へGit管理領域の自動補修や除外登録の迂回を追加しない。

- 準備不足で保存が拒否された場合は、固定語彙の`status`・`reason`と既存の`setupFailure`によるEffect・回収状態を区別する。成功値だけをassertして元の拒否理由を失わない。
- `.gitignore`への`.crdd/`記述だけを、正式なRepository-local除外登録の成立と扱わない。
- 合成保存・読戻しを外部AIなしで確認し、拒否・unknown時はAIを起動しない。既存Repositoryや由来不明のGit領域を、このfixture準備の対象へ広げない。
- 正常・失敗時とも今回のexact試験物だけを非使用・非link・外部Worktreeなしの確認後に回収し、不明な回復参照や残存を強制削除しない。

準備不足の拒否と明示準備後の保存は、既存`RCM-IT-005`の[AI選択Store契約試験](../40_Develop/coordinator/tests/integration/ai-selection-store.contract.test.ts)で照合する。この局所確認は実AI・認証・Dockerの成立を示さない。

## 開発実測入力の新方式への移行

フロントAIは旧実測packetをRuntimeへ互換読込みさせず、現在のSourceから入力を作り直す。`40_Develop/coordinator/scripts/measure-development-providers.ts --describe-source`は読取りだけを行い、Scopeと`expectedSourceSha256`を返す。署名・Native配布コピー・Task・Docker・Providerの準備は行わない。観測不能なら入力を補完せず停止する。

- [ ] 同じ作業Treeで取得した期待Hashを、新入力の`expectedSourceSha256`へ設定する。Source変更後は再取得する。
- [ ] 旧`expectedPackageContentRootSha256`、`nativeDistributionRoot`、`expectedNativeRelease`は削除し、各fieldを含む旧packetを再利用しない。
- [ ] Repository Root、期待Commit／Tree、固定二Task、期限、現在の送信許可は別に確認する。Source照会の成功から実行許可を推定しない。
- [ ] 実測結果の`sourceObservation`が、照会したScopeと期待Hashへ対応することを確認する。Root・実体Hash・tokenを入力やログへ複製しない。
- [ ] 旧配布コピーや旧packetの清掃は、参照・非使用・所有実体を確認したフロントAIが行う。履歴Evidence・署名・Hashは変更しない。

Source／Session／結果搬送の新接続は限定確認済みで、旧署名API・専用Toolは撤去済みである。撤去後の全体回帰・実Provider・全体E2Eは未成立である。Source照会だけから実Provider実測・全体E2E成功を主張しない。

新しい実測結果契約は改訂3で、Source照合情報は`invocationAccounting.sourceObservation`に保持する。これはadmission時の固定候補の情報であり、結果閲覧時のSource再観測ではない。旧結果を新しい実測の根拠へ読み替えない。

<a id="native-build-output"></a>

## Nativeビルドの実行前・成果物取得確認

正式入口のBuild指定と出力取得は[コーディング規約](../06_Architecture/99_Coding_Standards.md#native-build-output)に従う。フロントAIは実行前と成果物取得時に次を確認する。

- [ ] Build・Clippy・試験の対象環境が明示され、今回の目的と一致している。
- [ ] 取得する成果物が今回指定した対象環境と`debug/release`に対応し、同じCargo実行の結果へ結合している。
- [ ] 対象成果物の欠落を、無印出力や過去の別実行物へのfallbackで補っていない。
- [ ] 無印DirectoryをCargoの補助出力と区別し、存在だけを理由に削除していない。

対象環境不明、成果物欠落または複数候補で一意に特定できない場合は、取得・配布・検証を停止する。これは毎回評価する手順上のChecklistであり、今回の実行結果を示すチェック済み記録ではない。

通常入口と検証入口は`40_Develop/platform-access/target/`をBuild cacheとして共有する。Coverageは今回Cargoが返した計測用実行物だけを使い、同じ`deps/`に残る過去の実行物を列挙して選ばない。計測profileと要約だけを`.crdd/tests/native-coverage-<一意suffix>/`へ生成し、正常終了後に回収する。失敗・中断時は小さな未処置領域を確認して清掃する。Native保護試験もBuild cacheを共有し、試験対象と結果だけをrun内に置く。実行前後の入力・実行物HashとDirectory Identityが変わった場合は成功を返さない。

## 自己生成Native保存境界試験

静的確認後、Repository Rootから`npm run platform-access:verify-namespace --prefix 40_Develop/coordinator`で起動する。入口は同じ共有cacheから今回Cargoのtest実行物一件を取得し、`.crdd/tests/native-terminal-<UUID>/namespace-r2`だけを自己生成対象とする。保存境界3Directoryの正常例と19拒否例、全handle終了、exact試験一件、exit/close、入力不変と直接不存在を共同確認する。結果保存・清掃前は成否と独立して全保存祖先を再照合し、置換・観測不能では書込みと清掃を止める。成功時は小さなrunを回収し、失敗時は保持して次回開始前に処置する。

残る自己生成試験はRepository Rootから`npm run platform-access:verify-terminal-fixtures --prefix 40_Develop/coordinator`で実行する。対象観測、保存、容量（処置前・処置後）、現在候補、cold観測、rename候補、公開、disposition、既知fileの九能力十実行に、固定NodeとNativeの排他互換試験一件を加える。元の判定、個別handle終了、旧内容保持、子の実体・終了観測を維持する。coldと排他互換だけ検証子を起動し、他の試験は直接子一件に閉じる。実行中は入力を編集しない。

各試験は同じ共有cacheと新しい`.crdd/tests/native-terminal-<UUID>/`を用い、成功時だけ小さなrunを回収する。対象観測だけはWindowsの`GetTempPathW`に自己生成fixture位置を搬送し、その他はrun内`tmp`を使う。旧Rootの読戻し・変更拒否診断は履歴専用であり、現在候補・cold・rename・公開の再実行可能な自己生成試験へ能力を対応付けて廃止する。過去の失敗を成功へ書き換えない。旧残存は人間の許可、現在の非使用、非alias、領域内hardlink集合、排他openと削除直前の入力照合後にのみ回収する。署名、本番回復、Docker、Provider、全E2Eの成立は主張しない。

## 自己生成Native保護試験の反復と終了処置

この局所試験はRepository Rootから`npm run platform-access:verify-protection --prefix 40_Develop/coordinator`で起動する。型・Formatter・Lint確認後、入口がRust ClippyとBuildを先に実行する。署名・Provider・Docker操作は行わない。生成先は`.crdd/tests/native-protection-<UUID>/`で、`started.json`、必要な`result.json`と`tmp/`だけを持ち、Build一式をコピーしない。開始記録は秘密値やHost絶対Pathを含まない。

試験実行を受理したフロントAIが保持と終了処置の責任者となる。前回runが一件でも残る、列挙できない、開始・結果記録が欠ける、破損または状態不明の場合は、新しいrunを生成せず処置へ戻す。入口の名前検出は停止条件だけであり、削除許可ではない。

| 前回状態 | 必須処置 | 新規実行 |
|---|---|---|
| 正常結果あり | 判断に必要な結論・入力と実行物Hash・再現手順を現在CHGへ記録する。生結果は保存が必要な場合だけ正式Evidenceへ残す。参照、親／子終端、回復義務、非alias・非使用を確認し、exact runのtmp・不要結果を回収して不存在を確認する。共通Build cacheはこのrunの清掃対象ではない | 終了処置後だけ許可 |
| Build失敗 | exact runと静的確認の失敗を記録する。Build Processの終端、必要診断、参照と非使用を確認するまで保存し、確認後だけ限定回収する | 処置前は停止 |
| 中断・結果なし・観測不能 | startedまたは残存runのexact Identityと未確認範囲をOwnerの記録へ残す。終了を成功から推定せず、確認できない対象は保持する | 未確認が残る間は停止 |

正式保存前に唯一の根拠を削除しない。名前・時刻だけで他run、旧verification、署名候補、Manifest、認証またはOS領域を回収しない。自動清掃や新しいRecovery Frameworkは追加しない。前回残存の拒否を、実中断後の回復成功または全体清掃の実測済み根拠とは扱わない。

## 目的・対象・実行前条件

この手順は、CRDD参照Runtimeを診断・実行・検証し、必要な場合に配布を発行する担当者向けである。一般利用者にRelease秘密鍵やpassphraseは不要である。機能の成立条件と未対応範囲は[振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、資源・権限・復旧方式は[アーキテクチャ](../06_Architecture/01_Architecture.md)、検証計画・現在品質は[品質確認](../07_Quality/01_Quality_Center.md)を正本とし、手順の実行だけで採用・Releaseを成立させない。

1. 対象Repository、固定配布版、実行Node、選択ユーザー、許可された目的・送信先・情報範囲を確認する。
2. 選択したclone／submodule／作業Checkoutと固定公開入口を確認し、基準Commit／Treeと実際の差分、必要Native・CLI・Image・設定の同一性を追跡する。CRDD署名の欠測だけを通常実行の拒否理由にしない。未確認Publisher・開発branch・変更済みCheckoutを公式真正性確認済みと表示しない。
3. `capabilities --json`と診断結果を確認し、必要な準備が不成立なら止める。Helpに存在しないcommandを推測しない。
4. 許可範囲内のTaskを実行し、結果と回収状態を確認する。Workspaceの変更は検証してから明示固定・採用・不採用を判断し、正本への採用は人間の決定権限に従う。
5. 不明な残存、Identity差、失効または手動回復要求では通常Taskを再試行せず、仕様が示すexact IDと専用回復手順へ戻す。
6. 実行結果はCHGまたは品質保証の記録へ返す。日々のログをこの手順へ累積しない。


<a id="common-launch-entry"></a>

## 毎回の起動方法を組み立てない

通常操作は、検証済みNodeから同じ配布物の`template/tools/crdd-coordinator.ts`を起動する。MCP Clientの接続は別の公開入口`template/tools/crdd-mcp-server.ts`と[MCP Serverの利用手順](04_MCP_Server.md)を使う。AIが実行ごとにwrapper、JSON pipeline、出力転送または別の入力readerを作り直さない。一般TaskはCoordinatorの第一級の`task run`入口を使う。利用可能なCoordinator入口は`capabilities --json`から取得し、MCPや準備commandをCoordinatorのsubcommandとして推測しない。以下は絶対Pathの置換だけを行い、Shell文字列へ組み立て直さない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\bin\coordinator.ts" task run --request-stdin --json
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\bin\coordinator.ts" doctor check --json
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-route-matrix.ts"
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-recovery-matrix.ts"
```

一般Taskでは構造化stdinをバイト列のまま渡し、stdoutを機械向けに受け取る。対象→操作の同じ入口へ必要な--jsonを指定する。旧interactive／automationと検証Script用の起動モードは受理しない。固定検証Scriptは上記の直接入口を使う。対話同意を自動入力せず、不足時は停止結果を処置する。Coordinator専用の`sign-release`／`promote-release`は廃止した。通常Taskの準備として署名・Manifest昇格を行わない。正式配布の署名が必要なら、配布Ownerが独立した汎用Artifact署名の適用を判断する。

対話・4経路検証ではstdoutをfileやpipeへ転送しない。ログ採取を優先して端末を失わせない。出力採取が必要な自動処理と人間の対話を同じ一時wrapperで兼用しない。ウィンドウが必要な場合はホスト側が可視端末を用意し、終了後も読める状態を保持する。共通入口自体は追加ウィンドウや終了待ちEnterを作らない。

Coordinator固有の署名用端末補助・準備・昇格Script、閉包検査・専用設定は物理撤去した。撤去後の全体回帰・実境界の検証は未完了である。過去の署名ManifestやEvidenceは当時の記録として保持し、新Runtimeの許可や成立へ読み替えない。

起動入口の端末結合だけを再確認する場合は、検証済みNodeから`40_Develop/coordinator/tests/fixtures/coordinator-launch-terminal-probe.ts`を実端末で直接実行する。実CLIのhelpと用途不一致の拒否を確認するもので、秘密入力・Provider・Docker・Repository変更は行わない。通常の契約試験と併用し、この確認だけで正式E2Eを合格にしない。

### 検証画面を閉じた後の結果確認

新形式の結果保存に対応した配布物の4経路／復旧検証では、対象Repositoryの`.crdd/tests/<UUID>/`を確認する。`started.json`、`result.json`、`complete.json`のID・種別・開始時刻が一致し、全てをJSONとして読み取れ、完了記録の`resultSha256`と結果fileのSHA-256が一致することを確認する。開始時Repository改訂版を実行配布版と取り違えず、終了記録が保持する検証結果の版情報と対象を照合する。完了記録なし、部分書込み、組合せ／hash不一致、未知値や不完全表示があれば、その範囲は未確認のまま残す。旧配布物が保存した`verification/`の場所・版・Hashを、新しい実行結果へ読み替えない。

この記録には会話、確認コード、passphrase、Provider生出力は残らない。未知の停止理由は`unknown`となるため、完全な調査ログの代替ではない。自動的な再実行・回復・署名承認に使わない。画面を閉じた後に結果を読むための一時記録であり、正式Evidenceや永久保管場所ではない。Runtimeは容量超過時にも古い記録を削除しない。Gitは非追跡とし、旧署名配布物にはこの保存機能を継ぎ足さない。

フロントAIは検証終了時に結果を受理し、必要な根拠を対象CHG／Releaseの`Evidence/`へ記録するか、不要の理由を確定する。原Artifactのbytesが必要ならその本体も正式保持先へ保存する。その後、現行入力・未解決参照・実行中利用がないことを確認し、一時作業物・診断を清掃して不存在を確認する。中断した実行は次回開始時に確認する。保持の設計は[Runtime Dataの終了契約](../06_Architecture/Details/domain-model/03_Repository_Storage.md#311-試験結果の受理と清掃)に従い、完了記録だけで清掃を許可しない。これは年齢による自動削除機能ではない。

一回の検証のたびに恒久Launcherや診断Directoryを増設しない。繰り返し使用する検証は正式な実装・試験入口へ接続し、一時的な組立て物は所有Operationの作業領域へ置いて終端で回収する。旧固定Path入力を移行途中で保全する場合は、その有限集合、責任者と再評価契機を記録し、同じ場所へ新しい物を追加しない。古いScriptを保管場所へ移しただけで、現在の再実行入口として案内しない。

以下の直接entrypoint一覧は通常CLIの契約を説明する。開発用検証ScriptはCLI配送とは別の直接入口である。共通入口が含まれない旧署名配布物へ新ファイルを継ぎ足さず、旧版は旧手順のまま扱う。

<a id="現在利用できるコマンド"></a>

## 実行記録の保存方式を刷新するとき

今回の保存構成刷新全体（Coordinator、Orchestrator、Execution Intelligence、設定、ログ、候補、署名準備、一時領域と試験結果）では、実装は採用済みの最新構成だけを扱う。旧配置探索、移行目的の旧Reader／Writer、二重書込みやFallbackは組み込まない。旧構成の棚卸し、必要情報のOwnerへの移行、停止・非使用確認後の清掃はフロントAIが担当する。旧署名の真正性確認など、移行とは別に成立が必要な現行Capabilityを互換処理と混同して削除しない。

Coordinator／Orchestrator／Dockerの短命な実行記録は、長期の互換資産として扱わない。今回の新版保存へ切り替える際は、フロントAIが以下を実施する。具体的な新入口が接続・検証されるまで切替を実行せず、この手順の存在だけで②完了としない。

1. 対象Repository Root、旧版と新版、掃除するexact Pathを確認し、新しいTask受付を止める。旧Runtimeと同じ保存先へ新版を同時接続しない。
2. Coordinator／Orchestratorの現在処理と、その処理が所有するDocker資源を確認する。通常終了・回収できるものは既存入口で終了する。Docker永続データ、他用途のContainer／Network、認証Homeをこの整理で削除しない。共有Dockerを停止・再起動する必要がある場合は、影響を示して承認を得る。
3. 候補Patch、未完了の採用・結果保存、有効な保護判断と正式Evidenceを確認する。必要な成果物をそれぞれのOwnerへ保全し、仕事の終了と記録清掃を区別する。旧記録をそのまま新Snapshotの有効仕事として復元しない。
4. 停止・非使用と範囲を確認した旧実行記録・世代File・一時作業物を回収する。削除前に実体Pathが許可した用途別Root内であることを確認し、alias、用途不明、参照中または観測不能の対象は残して理由を返す。単に名前がCoordinator／Dockerに似ているという理由で消さない。
5. 検証済みRepository Rootから新版の公開入口で `node template/tools/crdd-coordinator.ts project init --json` を実行し、`status=completed`と発行された受付世代を確認する。有効な現行形式の保存の再初期化は同じ世代を返し、旧形式や未知残存がある場合は保全停止する。CLI／MCPの状態取得は初期化しない。新Requestは認証済み状態取得の`intakeEpoch`を発行時に固定し、再入場では元の値を維持する。旧Reader／Writer／Fallbackを再接続せず、初回の状態保存、Queue受付、途中停止からの再入場と終了後の整理を確認する。
6. 実施要約、保全対象、清掃対象、未処置と新しい版を既存の変更記録へ返す。清掃のための新しい恒久Directoryや移行台帳を増やさない。

認証、署名秘密鍵、送信同意、候補本体と正式Evidenceは、実行記録の一括清掃から除外する。Repository外の対象は、既存の用途限定許可を確認できなければexact Rootと目的を示して人間判断へ戻す。掃除は旧形式の全世代変換や永続的な互換Readerの代わりであり、過去の不明なEffectを成功へ変更する処置ではない。

## コマンドの構文と利用状態

以下はコマンドの構文を含む一覧であり、全項目が通常利用可能という意味ではない。目的から入口を選び、候補段階の操作を通常Taskの準備として試し続けない。

| 目的・担当 | 使用する入口 | 成立条件と次の確認 |
|---|---|---|
| 利用者・呼出し元が準備を調べる | `doctor check`／`doctor check --json` | Providerを起動しない事前診断。一時領域の生成・回収を伴う。表示された候補を認証・隔離・実行許可の成立へ読み替えない |
| 呼出し元が利用可能な入口を調べる | `capabilities --json` | Local Personalで成立する公開commandだけを機械可読に返す |
| 許可された一般Taskを実行する | `task run --request-stdin` | 選択したCheckout・Repository・同意・Authority・Providerの各検査が必要。CRDD署名は不要。候補と回収結果を確認する |
| Workspaceの候補を固定・採用・不採用にする | Workbench／MCPの既存Workspace操作 | Coordinator CLIに旧Bundle／Storeのexport・discard・recover-storeはない。固定とGit統合・採用を区別する |
| 復旧担当が残存資源を処置する | `recovery resume <id>` | exact IDと所有・状態が一致する場合だけ。通常Taskの自動再試行にしない。作成結果不明のDocker Taskは、後発の検証済みDocker Desktop再起動を明示結合できる専用形だけを使う |
| 保守担当が隔離を検証する | `doctor isolation` | Docker／一時Filesystemの効果を伴う固定Fake診断。実Provider利用・実Provider取消の証明ではない |
| 開発・配布担当が検証する | 下記の固定Task検証と任意配布検査 | 日常開発と公式署名を分ける。一般利用者にRelease鍵を要求しない |

CRDDを`00_CRDD`へ配置した採用Repositoryでは、Project Rootを現在Directoryにして`00_CRDD\40_Develop\coordinator\bin\coordinator.ts task run --request-stdin --json`を使用する。`40_Develop`を含まない文書だけのコピーではRuntimeは利用できないため、公式Release tagへ固定した完全なcloneまたはsubmoduleを用意する。

以下の絶対Node placeholderは、version 24.12.0以上と実体を確認したNodeへ置き換える。Coordinator CLI、Release鍵生成、Release manifest署名および正式署名一般Task Runnerは、未対応Nodeを対話入力、Release検証またはEffectより前に拒否し、PATH上の別Nodeへfallbackしない。package scriptを使う検証では、親のnpmだけでなくscript内の`node`とその子Processも同じ検証済みNodeへ解決されることを確認する。親だけを絶対Pathで起動し、子がPATH上の旧Nodeへ戻る状態を検証済みと扱わない。Sourceや試験のPathは、現在DirectoryをRepository Identityとして意図的に使う公開契約を除き、module基準の絶対Pathへ固定する。


```powershell
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor check
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor check --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" doctor isolation --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" capabilities --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" recovery resume <recovery-id> --json
& "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\40_Develop\coordinator\bin\coordinator.ts" task run --request-stdin --json
```

実行Pathを表す各placeholderは同じ保守sessionで検証した絶対Pathへ置き換える。保護操作をsession変数、PATH上の裸の`node`、相対entrypoint、または内部で別Runtimeを再選択するpackage aliasへ置き換えない。現在の診断は検証済みRootから既存Git観測と局所診断へ接続する。診断が作る一時領域と回収も確認し、厳密なEffect 0とは扱わない。廃止したRelease manifest署名を通常手順へ戻さない。


### 選択したCheckoutによる一般Task・経路別検証

一般Task・四経路Matrix・二経路Reviewer検証はCRDD署名を要求しない。Script名と公開識別子の` signed `はTool群移行中の暫定名であり、署名成立を示さない。Runnerの固定Source範囲とGit改訂を開始前／全settlement後に確認し、異なるSourceの経路結果を成功として集約しない。

入力元は選択したCheckoutと許可された検証対象Repositoryである。期待結果は対象契約の`completed`と終了コード0、Source照合、候補処置・回収の成立。非0または結果不明なら、その固定版の結果を保持して原因・必要な回復を確認し、同じ操作を無条件に繰り返さない。Sourceの観測状態と作業対象Repositoryの変更・ProviderのEffect観測は別の情報として読む。

この固定検証では、上記の汎用stdin入口へShellからJSONを組み立てて渡さない。対象Repositoryを現在Directoryにした対話端末から、選択したCheckout内の固定Runnerを直接起動する。実Providerへの依頼には、その対象・送信について別途許可が必要である。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-general-task.ts"
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-general-task.ts" --route reverse
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-general-task.ts" --route same-codex
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-general-task.ts" --route same-claude
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-route-matrix.ts"
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\revoke-external-send-consent.ts"
```

`<absolute-preverified-node-24.12+-executable>`は、絶対Path、version 24.12.0以上および実体を直前に確認したNode実行ファイルで置き換える。PATH上の裸の`node`、version判定不能または未対応Nodeを使用しない。Runner自身はNode versionをPackage／Release検証とTask開始より前に再確認する。独立したconsole availability preflightは行わず、初回同意が必要な場合だけTask Runtimeが[設計に定める単一Console lifecycle](../06_Architecture/Details/coordinator/01_Architecture.md#14-consoletask内部搬送回収の実装契約)を実行する。有効な同意の再利用時はconsoleを要求しない。


### 固定Workerの回復Matrix検証

固定Workerの復旧検証であり、実Providerの認証・通信を使う試験ではない。CRDD署名は不要で、選択したCheckoutの既存Node／隔離・Host境界を使う。期待結果は全要求シナリオの成立と回収確認。未達・回収不明なら残るIDと影響を保持し、回復成立と扱わない。結果改訂2は署名不要を明示する。Script名は`verify-recovery-matrix.ts`へ整理した。既存の結果識別子・内部子のroleに残る` signed `は機械契約として維持し、署名検証済みの意味には使わない。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\scripts\verify-recovery-matrix.ts"
```


## 入力搬送の維持

対話境界を、PowerShellのtext pipeline、`ConvertTo-Json`、一時request file、長い`Start-Process ... -Command`または入れ子Shellへ再構成してはならない。Windows PowerShell 5.1とPowerShell 7ではprocess標準入力API、既定encodingおよび引数再構成が異なり、正しいTaskが実行前に壊れるためである。Release鍵生成／署名は既存のdirect TTY command、外部送信承認はRuntime所有のconsole challenge、OAuth bootstrapは公式Provider CLIと外部system browserをそれぞれ唯一の対話入口とする。対話端末を取得できない場合は別搬送へfallbackせず停止する。

## Providerの認証状態確認・公式対話ログイン

選択Checkout／Packageと必要Artifactの同一性、専用Homeの現在保護を確認する。通常Taskから認証を自動起動せず、APIキーや別課金方式へfallbackしない。状態確認・ログインとも、実施前に対象Provider・操作・通信有無と試験範囲を人間へ示す。現在の実認証・固定Image確認は後続の人間試験へ保持しており、この手順から実行許可を推定しない。

### 新形式へ切り替える前のフロントAI確認

1. 旧`Recovery/claude-subscription-authentication`の対象記録について、既存Owner・exact Home Identityと実状態を確認する。真正不存在又は旧Ownerのsettledを確認できたものだけ新入口へ進む。
2. active・in-flight・不明なら停止し、元回復参照を保持する。新操作から旧資源を推測清掃せず、旧記録の強制書換え・削除もしない。
3. 保持②と歴史Evidenceは移行・清掃対象外。旧形式を新Readerへ通す互換機構は作らない。
4. 新記録は`Recovery/provider-authentication/<provider>.<home-hash>.json`の一つだけ。操作は記録内容と回復参照に含まれ、別操作のactiveがある場合は元操作の参照で停止する。

### 明示操作

構文は`auth status <provider> [--json]`と`auth login <provider>`。loginに`--json`を付けると実行前に64で停止する。対話loginはProviderの端末出力と最後の固定結果を表示し、stdout全体をJSON-onlyの搬送路とは扱わない。注意文はstderrへ表示する。

```powershell
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\bin\coordinator.ts" auth status codex --json
& "<absolute-preverified-node-24.12+-executable>" "<selected-verified-checkout-root>\40_Develop\coordinator\bin\coordinator.ts" auth login claude
```

- Providerは`codex`又は`claude`。statusは非対話・通信なし・Home読取り専用のProbe一件で確認する。結果の`unconfirmed`と`unknown`を区別し、未知出力・非0を未認証と決めつけない。
- loginは外部端末のstdin／stdout TTYが必要。表示された公式手順だけを完了し、認証用URL・code・token・email・Home実Path・生出力を記録又はチャットへ貼付しない。code入力が求められた場合は一度だけ入力してEnterを押し、終了まで再入力しない。
- loginの成功は`status: completed`、`authenticationConfirmed: true`、`cleanupConfirmed: true`を同じ結果で確認する。認証成功だけから回収成功を推定しない。
- 取消後も実行Ownerの終了と回収を待つ。blocked／unknown／cleanup不明は再試行せず、同じ回復参照を保持する。記録を手動削除・改名しない。
- 同操作のactive／idleだけが既存のexact回収後に再入場できる。in-flight又は別操作のactiveなら新Docker Effectは発行しない。
- settledの正常記録は次回に同じHomeのfresh Lock下で原子的に置換する。世代別Directoryを追加しない。正本／pending不一致・観測不能は停止する。

Repository・Workspace・追加通信Allowlistは認証へ接続しない。実CLIの認証手順・端末対話・固定Imageの動作は合成試験から成立とせず、最後の実境界確認で別に評価する。


## 正常なDockerで作成結果不明のTaskを回復するとき

この経路のv0.20.0における正式4経路E2EとRecovery Matrixは当時の方式の履歴であり、新経路の成立根拠へ流用しない。現在の設計は選択Checkout／Packageの固定入口と必要Artifact同一性、現在の介入許可、同じexact Recovery Identity、現在のDocker状態および下表の段階的完了を再確認する。Source切替と新経路の実測は未完了である。全Docker Desktop版、全OSおよび任意の破損状態を一般保証せず、観測不能または契約外の状態ではEffect 0で停止する。状態と必要な観測は[取消と回復の設計](../06_Architecture/Details/coordinator/01_Architecture.md#7-cleanup依存順)を参照する。

| 順序 | 操作 | 完了の意味 |
|---|---|---|
| 1 | `recovery restart-docker <docker-task-recovery-id> --json` | 同じ対象のための停止・起動・記録確定。Task回復完了ではない |
| 2 | `recovery resume <same-docker-task-recovery-id> --json` | 現在状態の同じ再起動checkpointと対象資源を再確認し、Task固有の回復を行う |

- Docker全体への停止影響を含む許可範囲を確認してから順序1を実行する。他Task、残存CLI、排他不成立または観測不能では停止し、対象を勝手に終了・削除しない。
- 順序1の`restartCompleted`と`cleanupConfirmed`がともに成立した場合だけ順序2へ進む。旧障害修復の引数と混在させない。
- 記録後専用flagは廃止し、通常の回復入口へ統一する。旧flagは引数不正として処置前に拒否し、旧記録の互換入口として受理しない。
- 正常なrun Directoryを退避・削除しない。署名鍵入力や元Taskの再実行は、この操作に含まない。
- 途中失敗では同じ回復IDと記録を保持する。初回操作を繰り返すことで未知のEffectを再発行せず、停止理由に従って再入場条件を確認する。
- 旧署名形式の部分記録は現在の回復へ採用せず、フロントAI移行表へ戻す。旧記録の手動修正・削除、旧Release chainの機械コピーで再開しない。移行未確認・観測不能ではEffect 0で停止し、元のunknownと未解決参照を保持する。
- 正常停止は公式Desktop CLIを使い、強制停止・detach・旧障害修復へのfallbackはしない。子Processの取消・回収とDocker全体の停止確認は別々に判定する。

## 現在の修復で退避領域を保持するとき

採用済みの目標は、通常の不要な退避物を安全確認後に回収し、調査用の明示保持だけ既定7日で利用者管理へ引き渡す方式である。期限時は削除・延長を判断し、期限だけで自動削除しない。物理回収と期限付き引渡しは現在未実装であり、以下の現行CLIを引渡し完了の操作と解釈しない。Image・Volume・認証領域は対象外。実装上の条件は[修復退避物の後続処置](../06_Architecture/Details/coordinator/01_Architecture.md#repair-directory-disposition)を正本とする。

現在の修復が保持判断待ちになり、その退避物を残すと人間が判断した場合は、同じRepositoryで`coordinator maintenance retain-repair <exact-repair-id> --json`を実行する。修復が返した現在形式のIDをそのまま指定し、別IDや任意Pathを補完しない。他のdoctor操作と混在させない。

この操作は修復技術Sessionを再取得せず、必要な既存metadataの出版とstate marker清掃を確定した上で、保持判断と既存履歴を保存する。Docker／Native技術処置を再取得せず、退避物を削除しない。保持確認と履歴確認が成立しても「保持済み・終了整理待ち」／exit 2であり、退避物の引渡し・状態除去・Task回復の完了ではない。開始前取消では判断を保存せず、保存成立後の取消で既存判断を巻き戻さない。保存や現在状態が不明なら同じIDを保持し、記録の手動編集や新しい修復で上書きしない。

## Docker Desktopの旧復旧記録を扱うとき

### v0.22責務再編後の移行方針

統合CoordinatorはSnapshot v5だけを読み、新規初期化にはWorkspace空集合を含む。旧v1〜v4や未確定pendingをRuntimeで補完・移行しない。フロントAIが下表の非使用・現在参照・必要成果・未解決義務を確認し、必要な保全と清掃を終えてから明示初期化する。Snapshotを書き換えて新しい版番号を付ける処置は行わない。実データの移行・削除はexact Rootと対象の承認を得て実施し、合成試験の成功を移行済みの根拠にしない。

以下の旧署名由来を採用・引継ぐ操作は切替前Runtimeの運用履歴であり、新Runtimeの手順として実行しない。新形式への移行はフロントAIが[縮小設計の処置表](../06_Architecture/Details/coordinator/01_Architecture.md#正常復帰後の検証付き再起動)に従って行う。新Runtimeに旧形式Reader、旧Release chain採用または旧Container再利用を追加しない。

| 順序 | 移行時の確認・処置 | 停止条件 |
|---|---|---|
| 1 | 対象Repository Rootと、現在の操作・Owner・未確定要求を確認する。対象に新規受付を行わせない。 | Root、対象集合または稼働状態を確認できない。 |
| 2 | 対象Process／Container／Network等を現在の実境界で確認し、必要な通常回収を行う。旧Workspaceを新試行から参照させない。 | 不存在と観測不能を区別できない、遅延要求が残る、別の稼働Ownerと競合する。 |
| 3 | 未受理結果、候補Patch、認証情報、署名鍵／Manifest、正式Evidenceと未解決参照を識別する。新Runtimeへ必要な設定値だけを検証する。 | 保全対象や結果受理の状態を判断できない。 |
| 4 | 終了を確認できた旧Runtime状態・通常ログ・一時物をexactな対象ごとに清掃する。旧Snapshotや回復chainを新形式へ機械コピーしない。 | 参照中・由来不明・実体Identity差・削除後不存在の観測不能。 |
| 5 | `.crdd/coordinator/`だけを新形式で明示初期化し、Tool別設定を新Pathへ適用する。旧`.crdd/orchestrator/`は段階1〜4で非使用・保全／清掃対象として処置し、新形式の保存先として初期化しない。保持すべき未受理結果や未解決参照がある場合は、その処置を先に確定する。 | 未解決情報を捨てなければ初期化できない。人間判断へ戻し、空stateで覆い隠さない。 |
| 6 | 新しいWriter・公開入口・設定Readerで読戻しと通常操作を確認し、旧Path探索・旧Workspace再利用・暗黙再送がないことを確認する。 | 保存、結果搬送、資源回収または利用側の接続が未確認。 |

フロントAIの移行完了は、実RuntimeのRecovery成功または過去unknownの解消を意味しない。過去に不明だった事実は終了要約に必要最小限で保持する。移行先が未実装の間はこの表を実処置へ使わず、段階5の固定候補と必要な独立確認後に適用する。

### 切替前Runtimeの運用履歴（比較専用・現在実行禁止）

この小節のadopt／Release chain／継続closeは旧Runtimeの比較記録である。旧修復本体・Record Store・Continuation Store・hardlink出版は現行Sourceから撤去済みであり、記載commandを現在の運用手順として実行しない。現在の処置は直前のフロントAI移行表へ限定し、移行未確認または観測不能ならEffect 0で停止する。旧全域Inventory自体は撤去済みであり、旧領域を現在保存形式として読み込まない。現在修復はRepository内のstate／historyとDocker Isolationの技術処理を使い、旧履歴の自動変換は行わない。

当時のDocker Desktop最終復旧の起動環境と旧記録の処置は、[専用のHome・作業Directoryと検証境界](../06_Architecture/Details/coordinator/01_Architecture.md#22-docker-desktop最終復旧時の起動環境)に従った。署名配布Rootを作業Directoryとして継承させず、旧版の復旧記録は、対象IDと発行元の署名済み配布Rootを明示する旧adopt入口で由来を検証し、既存ID・記録・退避物を保持して引き継いだ。これはDocker Taskの生成元Root指定や過去のEffectの再実行ではなかった。現在binaryではこの入口と署名Root引数を廃止しており、実行しない。現在の移行は本節前のフロントAI移行手順に従う。

旧Runtime当時は、旧記録のsettledな起動Effectが新しい失敗世代を作っていた場合、当時の署名版が同じ修復IDへ追記専用の継続記録を作った。現在binaryではこの記録作成を行わず、以下は当時の比較説明に限る。対象は`Docker/run`と`docker-secrets-engine`の既知2領域だけであり、各領域のIdentityとlockを別々に確認する。個別socketを削除せず、各Directoryを同一親へ段階退避し、両方の結果を耐久化した後にDesktopを一回だけ再起動する。

各退避と再起動の直前には、Engine停止、Docker Desktop Process不在、対象Identity、lock、退避先不存在および先行Effectの結果をfreshに再確認する。意図記録後にDockerが再起動した場合もEffectを発行しない。途中で閉じた端末、intent後中断、部分退避または起動結果不明では、同じコマンドの反復でEffectを盲目的に再発行せず、同じ修復IDと停止理由を保持する。

当時の回復済み表示と明示closeは、実行Releaseへ結合した継続記録、3 Effectのconfirmed settlement、両領域の退避済み旧世代と別Identityの新世代、Engine readyおよびProcess安全性を再確認した。一領域の新世代欠落、部分記録、改変または別Release結合ではcloseせず、全条件が成立した場合だけ当時の明示close入口で履歴を保持して終了した。現在binaryではこの入口を廃止しており、実行しない。開発実装の試験と、実機の中断記録への適用・正式E2Eは別の根拠として扱う。

以下も旧Runtime当時の専用処置であり、現在binaryでは実行できない。Docker資源の作成要求を耐久化した後、結果を受け取る前にProcessを失ったTaskは、空のDocker一覧だけでは回復済みにしない。そのTaskより後に開始され、署名済みの元配布から由来を確認でき、Process世代を切る停止とEngine再起動を完了して明示終了したDocker Desktop復旧記録がある場合だけ、上記の専用形を使える。RuntimeはTaskと復旧の順序、同じ選択ユーザー・保護Root・Policy、終了済み復旧記録および対象名のexactな不存在を再確認し、不存在確認をTask自身の耐久記録へ残してから通常回復を続ける。これは元Taskの自動再実行、旧配布への実行Authority付与、任意のDocker再起動による義務消去または保護記録の手動削除を許可しない。


## Coordinator固有署名方式の廃止

Coordinator固有のRelease鍵生成、Manifest準備・署名・昇格と配布Tree固定検査は撤去した。`sign-release`／`promote-release`は現在の起動modeではなく、通常実行・認証・回復・E2Eの前提にしない。必要Artifactの固定出所・Hash、実行時の認可とDocker隔離は各Ownerの現在契約で確認する。

汎用の成果物署名Packageは維持するが、CoordinatorのManifest生成を代替する公開手順は設けない。正式配布の真正性が必要になった場合は、対象配布物とConsumerを確認して別の配布判断を行う。

旧`.env-crdd`と署名作業領域は現行Runtimeが読み込まない。フロントAIが現在参照・非使用・所有実体を確認して移行・清掃し、秘密鍵や既存のLocal設定を機械的に削除しない。過去の正式Evidence・署名・Hashは当時の条件のまま保持する。

以下の版別Commit C許可Pathは過去の判断記録であり、現在の署名方式・実行許可・変更許可へ流用しない。

### v0.19.0のCommit C許可Path

v0.19.0では、Bの署名済みRuntimeに対する最終E2Eと人間のRelease判断後、次のexact PathだけをCommit Cで変更できる。新規検証結果2件は、Provider生出力、確認値、秘密、Host PathまたはRecovery Authorityを保存せず、閉じた結果と根拠Hashだけを記録する。

- 最終E2E記録: `99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md`、`99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.json`
- 公開入口と履歴: `README.md`、`CHANGELOG.md`、`99_Roadmap/02_Changes.md`、`99_Roadmap/01_Roadmap.md`
- 品質・手順: `07_Quality/01_Quality_Center.md`、`07_Quality/03_Verification_Design.md`、`19_Workflows/01_Coordinator_Runtime.md`
- Orchestratorの利用・設計表示: `02_UX/01_User_Experience.md`、`03_IA/01_Information_Architecture.md`、`04_UI/01_User_Interface.md`、`05_SPEC/01_Behavior_Specification.md`、`06_Architecture/Details/coordinator/03_Task_Architecture.md`
- Release対象CHG: `99_Roadmap/Changes/CHG-000057/change.md`、`99_Roadmap/Changes/CHG-000058/change.md`、`99_Roadmap/Changes/CHG-000059/change.md`、`99_Roadmap/Changes/CHG-000060/change.md`
- v0.19.0のCandidateからStableへ機械的に遷移するCRDD正本: `00_Overview.md`、`01_Principles.md`、`02_Terminology.md`、`03_Documentation.md`、`04_Agent_Organization.md`、`05_Autonomous_Operation.md`、`10_Agent.md`、`11_Skill.md`、`12_Change.md`、`13_Release.md`、`14_Workflow.md`、`15_Progress.md`、`16_Quality_Assurance.md`、`17_Communication.md`、`18_Context_Dependency.md`、`19_Maintenance.md`、`21_Discovery.md`、`22_UX.md`、`23_IA.md`、`24_UI_Behavior_Specification.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`28_Implementation.md`、`29_Verification.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`

正本の機械的遷移は`Status: Candidate`を`Status: Stable`へ変え、`Released Baseline`行を削除し、Release日だけを更新する。Orchestrator固有文書はCandidate／未実装表示をStable／利用可能範囲の表示へ変える。CHGは`Released`と対象tagへ、Roadmapは完了項目の除去と残件だけの表示へ、CHANGELOGとREADMEは候補表示から公開版・公開日へ変える。ここにない本文変更、規範追加、実装変更または新しい成果物はCommit Cへ含めない。

### v0.20.0のCommit C許可Path

v0.20.0では、Bの署名済みRuntimeに対する最終E2Eと人間のRelease判断後、次のexact PathだけをCommit Cで変更できる。新規検証結果2件はProvider生出力、確認値、秘密、Host PathまたはRecovery Authorityを保存せず、閉じた結果と根拠Hashだけを記録する。

- 最終E2E結果: `07_Quality/Verification_Results/2026-09-06_V020_Final_Signed_E2E.md`、`07_Quality/Verification_Results/2026-09-06_V020_Final_Signed_E2E.json`
- 品質と手順: `07_Quality/01_Quality_Center.md`、`07_Quality/03_Verification_Design.md`、`19_Workflows/01_Coordinator_Runtime.md`
- v0.20の候補からStableへ機械的に遷移するCRDD正本: `00_Overview.md`、`01_Principles.md`、`02_Terminology.md`、`03_Documentation.md`、`04_Agent_Organization.md`、`05_Autonomous_Operation.md`、`10_Agent.md`、`11_Skill.md`、`12_Change.md`、`13_Release.md`、`14_Workflow.md`、`15_Progress.md`、`16_Quality_Assurance.md`、`17_Communication.md`、`18_Context_Dependency.md`、`19_Maintenance.md`、`21_Discovery.md`、`22_UX.md`、`23_IA.md`、`24_UI_Behavior_Specification.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`28_Implementation.md`、`29_Verification.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`
- v0.20のTool表示: `04_UI/01_User_Interface.md`、`05_SPEC/01_Behavior_Specification.md`、`06_Architecture/01_Architecture.md`、`06_Architecture/99_Coding_Standards.md`、`06_Architecture/Details/coordinator/01_Architecture.md`、`06_Architecture/Details/coordinator/02_Threat_Model.md`、`06_Architecture/Details/execution-intelligence/01_Architecture.md`、`06_Architecture/Details/mcp-server/01_Architecture.md`、`06_Architecture/Details/platform-access/01_Architecture.md`、`06_Architecture/Details/coordinator/03_Task_Architecture.md`
- Release対象CHG: `99_Roadmap/Changes/CHG-000061/change.md`、`99_Roadmap/Changes/CHG-000062/change.md`、`99_Roadmap/Changes/CHG-000063/change.md`、`99_Roadmap/Changes/CHG-000064/change.md`、`99_Roadmap/Changes/CHG-000065/change.md`
- 公開案内と残件: `README.md`、`CHANGELOG.md`、`99_Roadmap/02_Changes.md`、`99_Roadmap/01_Roadmap.md`

正本とTool表示の機械的遷移はCandidate表示をStableへ変え、`Released Baseline`を除去し、Release日または最終更新日だけを更新する。CHGは`Released`と対象tagへ、Roadmapはv0.20完了項目を除去してv0.21以降の残件だけへ、CHANGELOGとREADMEは候補表示から公開版・公開日へ変える。ここにない本文変更、規範追加、実装変更、manifest変更、Runtime実行集合変更または新しい成果物はCommit Cへ含めない。

### v0.21.0のCommit C許可Path

v0.21.0では、Bの署名済みRuntimeに対する最終Recovery Matrix、4経路E2E、独立レビューおよび人間による最終Release候補Cの作成許可後、次のexact PathだけをCommit Cで変更できる。Cを作成・監査してfeature branchからmainへ統合し、main上のexact Identityと全Release Gateを確認した後に、人間が最終Release判断を行い、同じIdentityへtagを付ける。C作成前の許可やBに対する判断を、Cの最終Release判断へ流用しない。検証結果はProvider生出力、OAuth URL、認証code、秘密、Host PathまたはRecovery Authorityを保存せず、固定結果、件数、公開可能なIdentityおよび根拠Hashだけを記録する。

- 最終E2E記録: `99_Roadmap/Releases/v0.21.0/Evidence/260923_engineering-completeness-final-signed-e2e.md`、`99_Roadmap/Releases/v0.21.0/Evidence/260923_engineering-completeness-final-signed-e2e.json`
- 公開入口と履歴: `README.md`、`CHANGELOG.md`、`99_Roadmap/01_Roadmap.md`、`99_Roadmap/02_Changes.md`、`99_Roadmap/03_Releases.md`
- 品質とReality Audit: `07_Quality/01_Quality_Center.md`、`07_Quality/02_Quality_Strategy.md`、`07_Quality/03_Verification_Design.md`、`07_Quality/05_Current_Implementation_Reality_Audit.md`
- 利用・検証手順: `19_Workflows/01_Coordinator_Runtime.md`、`19_Workflows/04_MCP_Server.md`
- 工程の候補表示: `02_UX/01_User_Experience.md`、`02_UX/02_Personas.md`、`02_UX/03_Experience_Map.md`、`02_UX/04_Service_Blueprint.md`、`02_UX/05_Quality_Expectations.md`、`03_IA/01_Information_Architecture.md`、`04_UI/01_User_Interface.md`、`05_SPEC/01_Behavior_Specification.md`
- v0.21の候補からStableへ機械的に遷移するCRDD正本: `00_Overview.md`、`01_Principles.md`、`02_Terminology.md`、`03_Documentation.md`、`04_Agent_Organization.md`、`05_Autonomous_Operation.md`、`10_Agent.md`、`11_Skill.md`、`12_Change.md`、`13_Release.md`、`14_Workflow.md`、`15_Progress.md`、`16_Quality_Assurance.md`、`17_Communication.md`、`18_Context_Dependency.md`、`19_Maintenance.md`、`21_Discovery.md`、`22_UX.md`、`23_IA.md`、`24_UI_Behavior_Specification.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`28_Implementation.md`、`29_Verification.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`
- v0.21の候補表示を持つ工程成果物: `04_UI/06_Current_Interface_Reference.md`、`05_SPEC/07_Current_Behavior_Reference.md`、`06_Architecture/01_Architecture.md`、`06_Architecture/02_Component_and_Responsibility_Model.md`、`06_Architecture/03_Boundary_and_Interface_Model.md`、`06_Architecture/04_Runtime_and_Data_Flow_Model.md`、`06_Architecture/05_Failure_Recovery_and_Resilience_Model.md`、`06_Architecture/06_Deployment_and_Execution_Model.md`、`06_Architecture/99_Coding_Standards.md`、`06_Architecture/Details/coordinator/02_Threat_Model.md`、`06_Architecture/Details/domain-model/02_Activity_Context.md`、`06_Architecture/Details/domain-model/04_Storage_Path_Reality_Audit.md`
- Release対象CHG: `99_Roadmap/Changes/CHG-000066/change.md`、`99_Roadmap/Changes/CHG-000068/change.md`、`99_Roadmap/Changes/CHG-000070/change.md`、`99_Roadmap/Changes/CHG-000071/change.md`、`99_Roadmap/Changes/CHG-000072/change.md`、`99_Roadmap/Changes/CHG-000073/change.md`、`99_Roadmap/Changes/CHG-000074/change.md`、`99_Roadmap/Changes/CHG-000075/change.md`、`99_Roadmap/Changes/CHG-000076/change.md`、`99_Roadmap/Changes/CHG-000077/change.md`、`99_Roadmap/Changes/CHG-000078/change.md`、`99_Roadmap/Changes/CHG-000079/change.md`、`99_Roadmap/Changes/CHG-000080/change.md`

正本と工程成果物の機械的遷移は、v0.21.0のCandidate表示をStableへ変え、`Released Baseline`を除去し、Release日または最終更新日だけを更新する。CHGは`Released`と対象tagへ、Roadmapはv0.21完了項目を除去してv0.22以降の残件だけへ、CHANGELOGとREADMEは候補表示から公開版・公開日へ変える。QualityとReality Auditは、実行済みEvidenceへ接続した項目、未観測のまま残す項目およびv0.22へ移管した項目を分け、未実行項目をPassへ変更しない。ここにない本文変更、規範追加、実装変更、manifest変更、Runtime実行集合変更または新しい成果物はCommit Cへ含めない。

### リリース状態の利用側閉包

exact Path一覧は変更許可の上限であり、状態利用側の完全な台帳として扱わない。最終候補を`Stable`へ遷移した後は、Repository全体Checkerを同じ固定改訂版へ実行し、次を一つの相関したRelease状態として確認する。

| 利用側 | 必須状態 |
|---|---|
| CRDD正本 | 同じVersionで全件`Stable`、`Released Baseline`なし |
| 現行Markdown入口 | 同じVersionの`Candidate`表示なし |
| README | 正本と同じVersion、Candidate／Released Baseline表示なし |
| CHANGELOG | 英日両区分に同じVersionと同じ公開日の日付付き見出しがある |
| 対象CHG | Commit Cの監査時は`Ready for Release Handoff`。main統合・最終Release判断・tag付与後の公開状態投影でだけ`Released`、対象tagおよび公開日へ接続する |
| Quality Center | Release Gate完了と未評価範囲を区別する |
| Roadmap | 公開済み項目を未完了作業として残さない |

Checkerが残存表示または相関不一致を返す間は、PR統合、tag作成または公開へ進まない。実行順序の説明、手書き一覧、監査合格または人間のRelease判断だけから閉包成立を推定しない。

v0.20.0ではこの機械的遷移を実行しないまま公式tagを作成した。v0.20.1は公開状態の表示と検査だけを是正し、v0.20.0のRuntime実行集合と署名済みIdentityを維持する。

これにより、公式tagへ固定したcloneまたはsubmoduleは別archiveを取得せず通常Runtimeを利用できる。GitHub Releaseへ同じ内容の独自ZIPを追加しない。GitHubが自動生成するSource archiveもRuntime配布契約または検証対象にしない。



## 開発者確認

<a id="terminal-interaction-check"></a>

### 端末の表示・入力を確認する

[UIの確認範囲](../04_UI/06_Current_Interface_Reference.md#4-現行表示の参照と表現方針)に従い、既に開いているWindows Terminal／PowerShellで、検証したリポジトリRootから次を実行する。これは秘密入力・署名・外部送信・実行許可を伴わない参照であり、製品Taskの成功を証明するものではない。

```shell
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts match
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts mismatch
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts timeout
node 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts cancel
```

`match`では`123456`、`mismatch`では`654321`を入力し、それぞれEnterを1回だけ押す。秘密や実際の承認コードは使わない。`timeout`は5秒、`cancel`は1秒、何も入力せず結果を待つ。各結果の`scenarioMatched`と`cleanupConfirmed`がともに`true`であることを確認する。不成立時は結果を保存して原因を調べ、入力を自動補完したり成功へ読み替えたりしない。`cancel`は入力待ちへの取消要求の確認であり、Ctrl+Cのキー搬送やTask資源全体の取消完了の確認ではない。

日本語、入力位置、折返し、文字拡大、結果が読める状態で端末が残ることは人間が確認する。プログラムは終了保持のための追加Enterを消費せず、ウィンドウ保持は呼出し元端末が所有する。端末の実バージョンと表示条件、確認結果、未確認範囲を検証結果へ残す。読み上げは今回未評価である。

### 自動試験と開発確認

以下は検証済みリポジトリRootから実行する。試験Runnerが一時領域を必要とする場合は、Repository-localの`.crdd/tests/<run-id>/`を所有し、実行単位別の分離が必要な場合だけ`.crdd/tests/<run-id>/<execution-unit>/`を使う。入力・出力・診断をRun単位で分離して全終端経路で清掃する。保全中の旧固定入力は今回移動しない。呼出し元が旧共通一時Directoryへ`TEMP`／`TMP`をまとめて上書きせず、OS全体や永続ユーザー環境の値も変更しない。

```shell
npm test --prefix 40_Develop/coordinator
npm run development-e2e:verify --prefix 40_Develop/coordinator
npm run typecheck --prefix 40_Develop/coordinator
```

[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md#21-実装言語と実行境界)で固定したNode.js、TypeScriptおよびRustの実行境界を前提とする。上記の`typecheck`はproductionとtestの型検査を実行するが、Runtime実行や他の検査軸の合格を代替しない。

日常の開発反復ではRelease manifestを作り直さない。`npm run development-e2e:verify --prefix 40_Develop/coordinator`が、4経路、一般Task、Candidate、独立Review、一回是正およびRecovery Matrixのproduction契約を固定Fake／契約・結合試験で検査する。この入口はRelease鍵、passphrase、実Provider、Provider Credential、Network EffectまたはRelease Authorityを使わない。実Provider E2Eは、機械確認を通過した固定候補と許可済みの送信範囲で実施する。Coordinator固有の署名を挟むデバッグ手順は使用しない。正式配布の署名は必要時に配布Ownerが別判断し、通常Runtimeや一般利用者へRelease鍵を要求しない。

LintとFormatterの版、設定および依存境界は[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md#21-実装言語と実行境界)に従う。Coordinatorは`npm run lint --prefix 40_Develop/coordinator`、`npm run format:check --prefix 40_Develop/coordinator`および`npm run check --prefix 40_Develop/coordinator`で確認し、意図的な書換え時だけ`npm run format --prefix 40_Develop/coordinator`を使う。

Coordinator固有の署名・配布Tree固定AST／body SHA検査と専用試験入口は撤去した。通常portableと回帰Runnerは旧署名試験名による除外を持たず、Windows専用の実Process段階だけを既存の二接頭辞で分離する。子Process入口の入力拒否、Package依存境界、保存Workerの構築、Native検証Toolの起動・Artifact選択・close待機は現在の責務Ownerの試験へ接続する。通常試験の成功を正式配布の真正性検証や実Docker／Provider E2Eの成功へ読み替えない。撤去後の全体検証と実境界の未完了範囲は変更計画で追跡する。

### Task実Provider検証の実行Source

`verify-task-real-providers.ts`は自身を含むCheckoutの公開MCP入口を使い、別の署名配布Root引数は受け取らない。送信範囲・認証・実行許可と検証対象Repositoryの準備を確認した後、そのRepositoryを作業Directoryとして次を実行する。

```shell
node <selected-verified-checkout-root>/40_Develop/coordinator/scripts/verify-task-real-providers.ts
```

対応範囲はWindowsでの固定実Provider試験であり、このコマンド自体が外部送信の許可を与えるものではない。結果改訂13では対象Repositoryの改訂を`executionIdentity`、実行Sourceの観測を`runtimeSource`に分ける。Source／入口の欠測は最初のMCP起動前に拒否し、終了時不一致は既知の回収事実を変更せず検証不成立とする。入口Hashは既存Readerが返したUTF8文字列のHashである。旧署名結果を新版のE2E根拠として扱わない。

フロントAIは実行前に、対象Repositoryの既存AI設定へ検証分類`verification-codex`と`verification-claude`を用意する。両分類の`independent_reviewer`上書きはそれぞれClaude、Codexとし、既定Reviewerからの補完で済ませない。ToolはCodex `gpt-5.5 / medium`、Claude `opus / medium`を明示選択し、起動前に既存ReaderとResolverで二つのProvider対を確認する。Tool自身は設定を作成・更新しない。実行中は設定を編集しない。

終了時の`aiSelectionObservationStatus`は`matched / changed / unavailable`だけを返す。前後で同じ設定を確認できない場合は検証不成立にするが、Task・取消・回復の一次結果、exact参照、cleanup観測は上書きしない。これは前後二時点の確認であり、途中で変更して元へ戻した場合の検出や、全実行中のModel／Effortの原子的固定を保証するものではない。

Checkerの実装配置と配布境界は[内部ツール・コーディング規約](../06_Architecture/99_Coding_Standards.md)に従う。Checker packageの開発確認は次を使用する。

```shell
npm run test --prefix 40_Develop/checker
```

Checkerの`test`はFormatter確認、型検査、Lint、package rootから`../..`を明示するCRDD公式Repository全体Checker、Checker回帰試験本体をこの順に実行する。個別の`check`、`verify:repository`、`test:run`は原因を限定する内部入口であり、単独結果を全回帰完了としない。採用Repositoryの実行方法、外部package配布、CRDD準拠条件またはRelease手順ではない。

Rust packageを移設した後は、旧配置から持ち越した`target`を検証の根拠に使わない。コンパイル時に埋め込まれた絶対Pathが残り、コードを変更していなくても試験用binaryを起動できない場合がある。検証したcrate Rootの`target`配下に新しい実行専用Directoryを選び、そのProcessの`CARGO_TARGET_DIR`へ設定して、固定toolchain・`--frozen --offline`で再ビルドと試験を行う。既存キャッシュや署名配布物の削除は必要ない。生成物はGit非追跡のまま保持し、同じPathの古い試験結果を新配置の合格へ流用しない。
