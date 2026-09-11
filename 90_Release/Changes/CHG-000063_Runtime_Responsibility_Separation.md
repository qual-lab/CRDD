# 変更トレース: Runtime責務分離

変更ID: `CHG-000063`
状態: `Signed Verification Pending`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `refactoring`
最終更新日: 2026-09-11

## 1. 結論と現在状態

| 項目 | 現在状態 |
|---|---|
| 責務分離 | Project Runtime、Coordinator、MCP、実行知、Platform Accessへ分離済み |
| 責務分離の実装 | 完了。現行契約は各Architecture正本が所有する |
| 前の署名候補 | `f76b73af81c43e25f28037caa72d71a898a2f9fb`。Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067` |
| 前候補のEvidence | 正式4経路4/4、Recovery Matrix 7/7、技術独立監査0件。現在候補へ流用しない |
| 現在候補 | 検証投影の配置是正と文書全体是正を含む。新Runtime実行Identityの固定前 |
| 現行Gate | [Quality Center](../../07_Quality/01_Quality_Center.md)が所有する。文書閉包・独立確認後に固定、再署名、影響E2E、人間のRelease判断を行う |

本書は変更理由、責務・契約差、現在も有効な構造是正を所有する。固定候補の実行値は[検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、現在のRelease Gateは[Quality Center](../../07_Quality/01_Quality_Center.md)を参照する。

v0.19で成立したProject Runtime、MCP stdioおよびCoordinatorは、意味上の責務を分けていた一方、実装と公開入口の多くをCoordinator package内部へ集約している。この状態では、Coordinator固有のProvider実行、Windows／Docker、Project lifecycle、MCP Transportおよび公開契約の変更が同じpackage境界へ伝播し、後続の限定分散実行、Project State投影およびMCP Streamable HTTPで変更理由と回帰範囲を分離しにくい。

本変更はProject RuntimeをProject-level execution lifecycleのApplication Core、Coordinatorを実行編成、MCPをTransport、実行知を観測・分析、Platform AccessをOS／Platform境界として分ける。物理移動を完成とせず、公開契約、依存方向、実装Adapter、利用側および自動回帰が同時に成立した場合だけ分離完了とする。

2026-09-05に最初の移行単位として、Project状態機械とPlatform Port契約を`40_Develop/project-runtime/`へ移し、続く移行単位でObjective要求と統合結果の公開契約、および一つのTask Attemptを要求するExecution Port契約を同packageへ移した。さらに、実行観測、候補統合、人間判断、Queue、StateおよびLeaseの意味型とPortをProject Runtimeの公開入口へ集約した。実行知、候補Store、Windows保護StoreおよびRepository-local永続化の実装はCoordinator側に保持し、Repository RootとBindingを構成時に閉じたState／Lease Adapterを追加した。Application移行では、再計画処理、Objective受付のPlan検証と公開結果生成、Task実行の状態調停、候補統合、人間判断、およびObjective受付後のQueue・回復・実行・最終投影の調停本体をProject Runtimeへ移した。これらはRepository Path、Node暗号および永続化関数を直接参照せず、Objective受付が構成したBinding済みPortだけを利用する。Coordinator側のObjective入口は、未信頼入力、認証主体、Repository BindingおよびPlanner結果を検証し、Host Adapterを一度構成する薄いAdapterへ縮小した。時刻・安定Identity生成、状態所有者のProcess世代、cleanup不明時のProcess再利用禁止およびRecovery Identity生成もHost側から注入し、Project Runtime CoreがOS／言語RuntimeのIdentity生成へ依存しない境界へ変更した。従来Task Authorityと誤称していた署名済みRuntime packageの一回限りCapabilityは、Task要求と`authorityBindingId`が担う意味上のTask Authorityから分離し、専用のExecution Authorization PortとCoordinator Adapterから発行・失効する契約改訂2へ変更した。構成RootとMCP Transportも独立した所有Pathへ移し、MCPがCoordinator内部moduleや人間判断契約文字列を複製しない依存へ切り替えた。各単位で単体試験、公開入口、Coordinator利用側、設計対応、試験台帳および変更影響型回帰選択を同時に切り替えている。上位の責務分離完了表示は、依存検査、公開入口の総合試験および独立レビューまで保留する。

固定改訂版`ce7c4d3073099926b3302eb9aa8e2c03d18aa699`では、公開Runtimeが作成したProject Stateを同じPersistence Portから再読取りし、Project Runtimeの公開契約、MCP Adapterおよび閉じたMCP結果まで縦断した。MCP stdio／localhost HTTPの公開Launcher、HTTPの状態参照、取消・終了join、およびProject Runtimeからの逆依存0は、package試験と静的検査で成立した。残る完成条件は最終一括監査であり、実Provider、署名、Linux／macOSまたはRemote Runtimeの成立を本結果から推定しない。

正式署名の秘密入力前検査では、署名処理だけが分離前のCoordinator単体Filesystem観測を使用し、Project Runtime、MCPおよび実行知を含む現在のRuntime依存閉包を観測できないことを検出した。固定改訂版`e8012024`で、署名時の内容Root計算を開発版、同梱版、別配布版および昇格後検証と同じ配布全体の依存閉包へ統一した。旧単体観測はcallerが選択したpackageの非Authority診断だけに残し、正式署名からは到達させない。署名経路が正規観測を使用する契約試験と、責務分離後の実配布構成を使う秘密鍵不一致試験を追加し、秘密値を読む前にこの閉包を検証できる状態へ変更した。

その署名前監査では、配布物観測が返すPathは配布Root相対である一方、固定Manifestの利用側だけが旧Coordinator package相対Pathを再解釈し、正しい署名済み配布でも実行許可Capabilityを発行できないことを検出した。固定改訂版`2bcc1dad8ae953f477db5ee3948d9188f1b295f0`で、必須成果物のPath解決とHash取得を配布物観測へ集約し、開発版と固定Manifest利用側は解決済み成果物だけを使用する構造へ変更した。

同固定版の独立再レビューでは、必須実行入口の集合が開発利用側のnullableな一覧に残り、配布物観測と固定Manifest利用側へ必須性が伝播していないことを検出した。固定改訂版`971370b13a83c81c557722079eee7ca0f8e34650`で、4つの必須実行入口を配布Root相対Pathの単一Registryへ集約し、配布物観測が同一Snapshotから全件を非nullableに解決できた場合だけ候補を返す構造へ変更した。開発版と固定Manifest利用側は解決済み成果物だけを使用し、独自のPath検索や欠落fallbackを持たない。

続く再レビューでは、子Process入口の自動導出が特定の`new URL()`表記だけを認識し、宣言と実利用の全数対応を証明しないことを検出した。固定改訂版`df1c576c0f0f5636bc0ee72ed77e22340a28cc70`で、local TypeScript子Process入口を専用の不変descriptorへ集約し、本番sourceから導出した宣言集合、実利用集合および必須Registry集合の完全一致を要求する構造へ変更した。利用側は解決済みdescriptorを薄いWorker／spawn境界へ渡し、Canonical Pathを再解釈または再構成しない。変数、template literal、直接URL、直接Worker／子Process生成、未使用宣言、宣言欠落および各必須成果物の欠落を反証し、公開観測、秘密鍵読取り前の署名事前検査および非対話CLIまで縦断した。Focused 39件、制限Process 1,669件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。

同固定版への監査合意後の確認では、descriptorが可変な`URL`を利用側へ公開し、利用集合もresolver名の出現から導出していたため、正規wrapperの実呼出しと実行時targetの同一性を証明できないことを確認した。固定改訂版`57ee29c0b02fc80a6ea763a5bc63619b8ad09416`では、Registryを専用module内部の不変primitiveへ閉じ、Worker／spawn wrapperは役割だけを受け取って起動種別を外部Effect前に検証し、targetを都度内部構成する。本番実行集合から正規名・非aliasのwrapper直接呼出しを静的に導出し、宣言、導出した利用、実行時Registryを役割・起動種別・Pathで完全一致させる。署名・Recovery経路を含め、別名import、再export、関数値化、namespace／dynamic import、直接Worker／spawn、`process.execPath`の再構成、連結URL、重複Pathおよび種別差を反証した。Focused 69件、制限Process 1,684件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。静的導出は一般的な到達可能性解析、動的コード、任意のproperty再構成、preloadまたは実行集合外のProcess起動を完全検出する主張をしない。

その固定版を一段具体化した構造確認では、spawn wrapperがcaller提供のspawn factoryを受け取り、正規Pathと起動Effectの結合を利用側へ残していた。また、直接子Process起動の拒否は`process.execPath`の代表表現へ偏り、型専用importを正規利用として数え、Recovery Matrix入口の欠落が署名前検査の全数表へ含まれていなかった。固定改訂版`da3c6eb69f8f2a7172ff8ebc5b8ebe2de77880e7`では、spawn wrapper自身が非公開の不変Pathを所有し、役割と引数だけから呼出しごとに新しい引数列を構成する。callerは実行ファイル、targetまたはspawn factoryを渡せない。Workerは専用wrapperと登録済みbodyだけに限定し、`fork`、`process.argv0`、`process.argv[0]`、literal Node、別名・型専用・namespace・dynamic・require・再export、およびquery／fragment／percent encodingによる迂回を反証した。Recovery Matrix入口の欠落も秘密鍵読取りと入力Promptの前に拒否する。Focused 105件、制限Process 1,697件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。静的導出は一般的な到達可能性解析、動的コード、任意のproperty再構成、preloadまたは実行集合外のProcess起動を完全検出する主張をしない。

同固定版の独立再レビューでは、`child_process`の再export、関数値化、`.call`／`.apply`／`.bind`／`Reflect.apply`、および判定不能なNode自身のtargetが利用側閉包を迂回でき、本番関数のProcess／Worker生成factoryが起動前提を呼出側へ再公開していることを検出した。固定改訂版`5ae51ff8f4acdb56c73f00cc09abdcf8c3c7892b`では、実行能力を持つ値import、source別primitiveおよびbindingの全利用を字句解析し、正規の直接呼出し以外を拒否する。type-only importは実行能力へ数えず、query、fragment、percent encodingまたはencoded separatorを正規Pathへ補正しない。本番leafが起動を所有し、lifecycle helperは生成済みhandleと最小状態だけを受け取る。factoryによる異常注入は試験専用harnessへ隔離した。Focused 136件、制限Process 1,714件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。静的導出は一般的な到達可能性解析、動的コード、任意のproperty再構成、preloadまたは実行集合外のProcess起動を完全検出する主張をしない。

その固定版の独立再レビューでは、未使用の値importを実行能力取得として拒否できず、loader取得の再構成とNode自己起動targetのbracket／optional表記が分類を迂回できた。また、本番leafから生成処理を除いた後もhandle取得後のLifecycle helperが公開され、別の本番利用側が起動前提を通らず状態機械へ到達できた。固定改訂版`1e6aab7e8a5567f1f622feb285a866b7ee02bd0c`では、保護moduleのliteral specifierをtoken位置から検査し、値importを利用有無にかかわらず宣言時にsource別primitiveへ照合する。純粋な型import／型re-exportだけをEffectなしとして許可し、escaped／template specifier、`fork`およびloader再構成を拒否する。Node自己起動の既知表記をgenericな外部Process Authorityより先に分類し、dot、bracket、optionalおよび`at(0)`の表記差を閉じた。Process、Workerおよび対話入力Readerの生成後Lifecycleは専用内部moduleへ移し、本番では対応するleafだけが静的importできる。再export、dynamic／alias importおよび兄弟実装からの利用を拒否し、試験支援境界は同じ状態機械を使う。対話入力Readerは起動前提を一度固定し、handle所有後の取消登録直後に取消状態を再確認する。制限Process全回帰、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。静的導出は一般的な到達可能性解析、動的コード、任意のproperty再構成、preloadまたは実行集合外のProcess起動を完全検出する主張をしない。

その固定版の二つの独立再レビューでは、semicolonなし宣言で値re-exportを型専用へ誤分類できること、`createRequire`等でloader能力を再取得できること、広いsource許可により未知の外部実行targetを追加できること、およびProcess wrapper／内部Lifecycleを別の利用側へ再搬送できることを検出した。固定改訂版`f92b782ae542f96305f426f33c944cd2af615827`では、静的import、再export、動的importおよび型／値bindingを一つの前方module宣言解釈から導出する。保護moduleのliteral出現は別の意味在庫として照合し、loader再取得と許可外の非literal動的importを拒否する。子Process呼出しはsource全体の許可ではなく、所有関数、primitive、実行対象式、引数式、Authority証明および期待件数を持つ正規呼出し集合へ結合する。Process wrapperと内部Lifecycleは宣言・export・import・全値利用、正規leaf、引数の由来、事前handle生成および既存終端cleanupへの後続処理を一組として検査し、兄弟import、再export、別名、関数値、propertyまたは追加依存注入を拒否する。代表違反は公開観測、固定開発版、同梱版、Capability非発行、署名preflightおよび非対話署名CLIまで縦断した。重点121件、制限Process 1,738件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功済みであり、独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。宣言集合は正本ではなく、実ソースから独立導出した集合との完全一致によって不足と余分の両方を拒否する。

同固定版への二つの独立再レビューでは、loader取得のnamespace／default／再export／bracket表記、Authority証明と実行呼出しの結合、`dependencies.startProcess`を含むwrapper／Lifecycle利用側、公開利用側の構造的導出、および型専用star re-exportの分類に未完を検出した。固定改訂版`98146b3b70295bc122784871233d0bd7cf58c423`で重点126件、制限Process 1,743件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功したが、再レビューはfile単位のtoken／prefix照合が配布全体の利用グラフ、完全な引数と値の由来、Authority guardの支配、handle所有、および公開結果への伝播を証明しないため不合格とした。是正固定版`f77b6e3fd88504cb6cb51bbdec8470eeaa79ef93`は、実配布対象と検証Tool対象を独立に全数列挙し、20呼出しをRuntime 14件とTool 6件へ重複・無所属なく分ける。各呼出しをsource、所有関数、実行primitive、完全な引数式、結果bindingおよび監査対象flowへ結合し、公開・署名利用側では正規観測結果から判定と結果までの同一flowを要求する。手書き一覧は証拠または正本とせず、Expected source欠落、Actualだけの能力source、引数・option変更、結果差替え、decoy、遅延所有も不整合とする。重点128件、制限Process 1,745件、Windows実Process 7件、静的検査およびRepository全体Checker（Error 0、Warning 0）は成功した。独立再レビュー、正式署名および正式E2Eは後続Gateとして保持する。

統合経路では、Project Runtimeが要求する統合記録Portを追加し、Repository Root、`.crdd`配置、Hash生成および不変公開をCoordinatorの統合記録Adapterへ分離した。同一記録の再試行、Identity衝突およびPath逸脱の拒否をAdapter契約試験で固定した。その後、状態・Queue・LeaseをBinding済みPortへ切り替え、候補の検証、競合判断、受入状態遷移および公開結果生成を含む統合Application本体をProject Runtimeへ移した。Coordinatorには候補生成、Repository観測、採用および統合記録の環境依存Adapterだけを残した。

人間判断経路では、判断Capabilityの秘密値生成とHashを専用Portへ分離し、Node暗号実装をCoordinator Adapterへ残した。判断ApplicationはBinding済みState Port、保護Store Port、回復Store Portおよび判断Capability Portだけを利用する形へ変更し、発行、適用、置換、無効化およびProcess loss後の回復をProject Runtimeへ移した。秘密値は保護Storeへ保存せず、Hashだけを記録する既存保証を維持する。

Repository Pathの意味検証はHost filesystemへ問い合わせない純粋な共通処理へ集約した。公開Objective、Planner結果、Task状態および統合候補は、Windows drive、POSIX absolute、親移動、空segmentまたは現在Directory segmentを含むPathをRepository相対Pathとして受理しない。これによりProject Runtime Applicationから`node:path`依存を除去し、入口ごとのPath判定差を閉じた。

Task実行集合のAuthority binding生成はCoordinatorからProject Runtimeへ移した。Project Runtimeは現在のProject、Milestone、Repository Revision、Objective、Taskおよびretry世代からBinding Identityを生成し、Hostが同fieldを持ち込む入力を拒否する。Coordinatorは各Taskの定義済み変更Pathと対応Objectiveの受入条件から実行要求を構成し、Objective全体の変更Pathを各Taskへ再拡張しない。Runtime packageの実行許可Capabilityは引き続き別のExecution Authorization Portが外部Effect直前に発行する。

Objective受付後の実行調停は、Project状態、QueueおよびProject Operation Leaseへの全アクセスをBinding済みのState／Lease Portへ統一した後、Project Runtime Applicationへ移した。Application判断はCoordinatorの永続化関数を個別に選ばず、構成時に検証済みRepositoryへ結合された同じPersistence Port集合だけを受付からTask実行、回復再入場および最終投影まで利用する。

同じ移行準備で、Queue、要求範囲および回復適用のIdentity生成と内容HashはClock／Identity Portへ、現在Process世代とRuntime Process Recovery Identityの検証はProcess Safety Portへ集約した。Objective ApplicationはNode暗号実装やCoordinatorのProcess安全状態を直接参照せず、Hostが注入した能力の結果だけを利用する。

Task回復は専用Portへ分離した。Project Runtimeへ公開するのはProject、Milestone、Task、Attempt、Operation、回復種別およびRecovery Identityであり、Coordinator Adapterが検証済みRepositoryの作業DirectoryとBindingを閉じてDocker回復、受領Recordおよび検証資源の最終化へ接続する。診断Observerの失敗はAdapter内で隔離し、回復の成否へ昇格しない。

その後の署名前監査では、本文Hashとtoken列の一致が保護経路のbinding、値由来、guard支配および公開結果への伝播を保証せず、同名decoy、別名import、wrapperまたは別結果への差替えを見逃し得ることを検出した。また、実行知のRepository Root能力が`.git`の存在確認へ簡略化され、Version Controlが認証したexact Rootという既存保証を失っていた。これらは追加改善ではなく、現在の署名・実行能力・保存境界の完成主張を成立させるための構造是正として扱う。

是正では、署名経路をP検査、秘密入力、一回限りの不透明なP能力を消費する独立S検査、秘密鍵読取り、署名、配置、公開結果の唯一経路へ変更した。P入力はAccessor／Proxy、追加・欠落fieldを拒否して一度だけsnapshotし、Sは同じ固定入力から配布物を独立再観測する。署名とProject RuntimeからCoordinatorへの実行能力受渡しは、実sourceから導出する限定構文・binding・値由来グラフと独立Expectedグラフを完全一致させる。別名import、shadow、結果再構成、失効結果差替えおよびGuard前Effectを意図した検査段階で拒否する。実行知はGitの`--show-toplevel`観測を各Store操作で再実行し、偽の`.git`と能力発行後の境界消失・置換で`.crdd`を作らない回帰を追加した。一般TypeScript解析、未宣言の保護経路または任意Application全体のdataflow証明は本変更へ拡張しない。

公開、署名、昇格および回復は、主機能の成功から成立を推定せず、各経路が必要とする入力由来、Identity、Authority、Effect前Guard、終端観測および公開結果を同じ限定グラフへ載せた。正規観測値を利用側が再構成する変更、署名値・Payload・昇格元Commit・回復Identityの差替えは、意図した検査段階とEffect 0までを反証する。自己確認は制限Process 1,752件、Windows実Process Gate 7件、静的検査およびRepository全体Checker 426文書（Error 0、Warning 0）で成功した。ここからは静的確認を反復せず、固定候補の正式署名と公開縦断E2Eを先に実行し、その実行結果を取り込んだ一つの改訂版へ独立再レビューと最終監査を行う。

正式E2E直前のDocker Desktop更新では、通常TaskのDocker CLI信頼が過去の特定Version、Hashおよびbyte数へ結合され、正規のDocker Inc更新を危険な差替えと同一視していたことを確認した。通常実行の信頼を、固定公式配置、有効なDocker Inc Authenticode署名、Filesystem実体、Linux Engine能力、およびOperation中の同一Identity／Hashへ変更した。版またはHashが前回と異なることだけでは停止せず、真正性、必要CapabilityまたはOperation中の同一性を確認できない場合はDocker Effect前に停止する。特定VersionとArtifactを固定するDocker Desktop修復PolicyはHost状態を変更する限定修復だけに残し、通常Taskへ流用しない。Provider image Digest、署名済みRuntime／Native成果物、再現可能Build入力およびProtocol Revisionは、それぞれが所有する再現性、完全性またはbyte解釈の保証として維持した。開発E2EはProvider開始前の最終応答でもstdinを閉じるため、環境Gateの拒否を45分のtimeoutへ拡大しない。Docker Effect契約12件、配布依存閉包119件と是正した反証1件、実Provider E2E観測契約28件、固定改訂版`491ae717`の制限Process全回帰1,753件、Windows実Process Gate 7件、静的検査、Repository全体Checker、および更新後Docker 29.7.2の実署名観測は成功した。正式署名と公開縦断E2E、独立再レビューおよび最終監査は後続Gateとして保持する。

### 基準版Capabilityの移行照合

v0.20の実Docker結合試験で、検証付き再起動が正常な停止・起動だけを置換し、v0.19で成立していた既知socket障害からの復帰を新経路へ接続していないことを確認した。新しいComponentや状態機械の存在だけを置換完了とせず、基準版の成立済みCapabilityから次の対応を固定する。

| 基準版のCapability | 基準版の根拠 | v0.20の所有者／実装 | 必要な実境界確認 | 現在状態 |
|---|---|---|---|---|
| 正常Engine上で未確定Taskを回復するための検証付き再起動 | v0.19のTask Recovery契約とv0.20で追加した再起動記録試験 | 検証付き再起動、再起動記録、Task Recovery | 正常停止、正常起動、freshな資源不存在、Task回復 | Source接続済み、実機未完了 |
| Docker Desktopの既知socket障害から復帰する | [v0.18のHost復旧記録](Evidence/CHG-000015_Verification_Run_Record_1531092.md)、v0.19修復契約 | 障害修復。正常再起動とは別責務のまま、現行DockerのTrust境界と接続する | 既知障害分類、公式停止、残存ProcessとWSLの停止、run世代退避、起動、Engine観測 | v0.20の新再起動へ未接続。現在のDocker更新後は旧版固定Policyが修復Capabilityを取得できない |
| 障害修復後も元のexact Task回復義務を保持する | v0.19の修復記録、Recovery IDおよびTask Recovery試験 | 障害修復記録とTask Recoveryの再起動Fence | 修復終了記録、現在Engine、対象資源のfreshな不存在、元Recovery IDによる再入場 | 既存契約あり。現行Trust境界による修復完走後の再確認が必要 |
| 復旧処理の途中結果を再発行せず、物理残存を無断削除しない | v0.19の耐久修復Recordと回復試験 | 障害修復Record、再起動Record、Runtime State | 各Effect前Intent、結果不明時の停止、保持物のexact Identity、終了後cleanup | 保持。5回の盲目的再試行は採用しない |

### v0.20で得た共通学習の還元

| 学習 | 共通化した処置 | 正本・機械確認への接続 |
|---|---|---|
| 主機能の移行だけでは署名、Release、Recovery等の副次成立条件を保持できない | 変更した意味からProducer、全Consumer、派生物、署名、公開、回復まで閉じる | [保守](../../19_Maintenance.md)、利用側閉包の契約試験 |
| CanonicalなPath、Identity、Stateを利用側で再構成すると意味が分岐する | Canonical Producerが解決済み値を渡し、Consumerの再解釈を禁止する | [アーキテクチャ](../../27_Architecture.md)、限定グラフの反証試験 |
| 宣言一覧だけでは登録漏れを検出できない | 実source・公開入口・Release経路から導出した集合と宣言集合を双方向照合する | Checker、Capability Graph、Runtime Trace |
| 外部境界の単発成功だけでは終了、取消、回復、再入場を保証できない | 外部境界をブロック化し、隣接1～2ブロックと完全Lifecycleを段階的に結合試験する | [品質保証](../../16_Quality_Assurance.md)、試験カタログ |
| 外部CLIやOS APIを推測で扱うと高価な再試行になる | 要求、受理、Effect、完了、観測、耐久確定を分け、診断可能な観測を設計時に置く | [アーキテクチャ](../../27_Architecture.md)、実境界結合試験 |
| 大規模Refactorは前版の副次Capabilityを失い得る | 前版Capability、過去Evidence、置換Owner、利用側、実境界検証を着手前に対応付ける | [保守](../../19_Maintenance.md)、基準版Capability表 |
| テスト追加後の件数や期待値も利用側である | 実在試験、台帳、runner、期待値を同じ変更単位で同期する | [試験体系CHG](CHG-000061_Test_Levels_and_Automated_Regression.md)、Checker契約試験 |
| 環境のVersion／Hash変化だけを危険とすると正当な更新を拒否する | 環境は柔軟に扱い、発行者、必要Capability、Operation中の同一性を確認できない場合に停止する | Docker CLI Trust契約、実署名観測試験 |
| 状態機械や部品関係を文章だけで追うと遷移・接続漏れを見逃す | ブロック図、状態遷移図、Sequence図、Class図、DFDの意味記法と視覚的表現を設計へ要求する | [アーキテクチャ](../../27_Architecture.md)、設計対応検査 |
| 承認済み目標を内部工程ごとに再確認するとHuman Active Timeが増える | 範囲変更や新Authorityがない限り、一つの目標として自走し、秘密入力・不可逆判断だけを人間へ戻す | [エージェント](../../10_Agent.md)、`template/AGENTS.md` |

共通規範への昇格は、今回のRuntime固有手順をそのまま一般化するものではない。上表の意味契約だけを正本へ置き、Docker固有の実装・試験結果・固定Identityは本CHGと検証結果に保持する。

削除・置換対象の判断では、Git tag `v0.19.0`、当時の変更トレース、検証結果および公開契約を確認する。上表が新しい根拠で閉じる前に、旧修復を不要、検証付き再起動へ置換済み、または回帰不要と扱わない。一方、同じCapabilityが現行Trust境界と実Lifecycleで成立した後は、版固定された旧Policyや重複実装を互換目的で残さない。

## 2. 人間が決定した範囲

- Project Runtimeは独立packageへ分ける。
- Project RuntimeはObjectiveをProject-level execution stateへ変換し、そのlifecycleを管理するApplication Coreとする。
- Project RuntimeはProvider、Coordinator、MCPまたはOS固有実装を直接参照せず、必要能力をPortとして要求する。
- Coordinatorは実行編成とProvider実行を所有し、Project RuntimeのExecution Portを実装するAdapterとなる。
- MCP stdioと後続のMCP Streamable HTTPは独立したTransport packageへ分け、Project Runtimeの公開アプリケーション契約だけを利用する。利用者向けMCP起動入口は`template/tools/crdd-mcp.ts`とし、Coordinator CLIのsubcommandにしない。
- 公開ProcessのLauncherはpackageごとに機械的に作らず、独立した利用目的を持つChecker、CoordinatorおよびMCP Serverだけを`template/tools/`へ置く。Project Runtime、実行知およびPlatform Accessは内部能力として接続する。
- 公開アプリケーション契約は、独立した版管理の必要性が実証されるまでProject Runtimeが所有する。便利な共有箱として別packageを先に作らない。
- 実行知とPlatform Accessの既存独立境界を維持し、Project RuntimeまたはMCPへ再集約しない。

## 3. 目指さないこと

- v0.19の状態機械、Authority、Recovery、受入条件または公開結果の意味を変更すること。
- Folder移動だけで責務分離済みと表示すること。
- Project RuntimeへProvider orchestration、MCP Protocol、Windows／Docker実装、実行知Store、WBS、Topic、Risk、ForecastまたはProject Management正本を集約すること。
- 公開契約、domain、application、runtime core等の未実証packageを細分化すること。
- Linux、macOS、Remote Runtime、LAN／Internet公開または複数Repository対応を本変更から推定すること。

## 4. 設計と依存方向

- [Project Runtimeアーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md): Application Core、公開契約、Port、上位状態、依存規則および移行順序。
- [Project Runtime詳細設計](../../06_Architecture/project-runtime/02_Detailed_Design.md): exactな状態遷移、資源、Lock、Authority、Effect、不変条件および失敗注入点。
- [MCP Transportアーキテクチャ](../../06_Architecture/mcp/01_Architecture.md): MCP Protocol、stdio Transport、将来HTTPとの共通境界およびAuthority非生成。
- [Coordinator参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md): v0.19の実行編成、Provider、SecurityおよびRecoveryの既存保証。
- [機械可読なProject Runtime設計対応](../../07_Quality/06_Project_Runtime_Design_Traceability.json): 現行設計とCoordinator実装・検証項目を結ぶ検証用投影。設計の第二正本にはしない。

許可する上位依存方向は次とする。

```text
MCP / CLI Transport
        ↓
Project Runtime public contract
        ↓
Project Runtime application / core
        ↓
Ports
        ↑
Coordinator / persistence / platform / telemetry adapters
```

Project RuntimeからCoordinator、MCP、ProviderまたはOS固有moduleへの依存は禁止する。CoordinatorとMCPはProject Runtimeの内部Pathを使わず、packageの公開入口だけを使用する。

## 5. 移行単位

1. 現在のProject Runtime、MCP、Coordinator、Platformおよび実行知のmoduleと利用側を全数分類する。
2. `40_Develop/project-runtime/`へpackage、Core、Application、Portおよび公開契約を作る。
3. Project Runtimeが直接利用しているCoordinator／Repository／Windows／Docker／実行知機能をPortへ置き換え、既存実装をCoordinator側Adapterとして接続する。
4. `40_Develop/mcp/`へProtocolとstdio Transportを移し、Project Runtimeの公開入口だけを利用する。
5. `template/tools/crdd-coordinator.ts`をCLIの構成Root、`template/tools/crdd-mcp.ts`をMCP Serverの構成Rootとする。各入口は公開indexだけを使ってProject Runtime、Coordinator Adapter、Platform／Persistence／実行知Adapterを結合し、MCP packageやCoordinator CLIへ別入口の責務を集約しない。
6. source、test、fixture、script、traceability、package設定、試験カタログ、文書参照およびRuntime実行Identityの依存閉包を同じ変更で更新する。

Runtime実行IdentityはCoordinator Directoryだけを固定の閉包とせず、`template/tools/crdd-coordinator.ts`と`template/tools/crdd-mcp.ts`を公開Processの起点に含める。Coordinatorのproduction sourceは明示された実行集合として、参照の有無にかかわらず含める。公開Launcherからcanonicalな静的importで到達するMCP、Project Runtimeおよび実行知については、到達したsourceと、そのNode module解釈を決める各componentの`package.json`を実体から推移的に導出する。文書、試験、到達しない兄弟Componentのsourceおよび許可されていない兄弟Componentは含めない。公開Launcher、到達したpackage metadataまたは実際の依存が欠落する、package名・版・`private`・module種別が契約外である、もしくは宣言済み実行集合から外れた場合は、開発候補と正式候補の双方をEffect 0で拒否する。
7. 内部Path参照、逆向き依存、二重定義および旧入口を機械検出し、CLI／MCP stdio／回復経路の意味回帰を実行する。

移行中の一時的な互換exportは作らない。旧Pathと新Pathを同時に正規入口として残すと、利用側閉包とRuntime実行Identityが二重化するため、移動単位ごとに全利用側を同じ変更で切り替える。

## 6. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | CLIまたはMCP stdioからObjectiveを受付け、Coordinator AdapterがTaskを実行 | v0.19と同じProject結果、Identity、cleanupおよびRecoveryを返す |
| 準正常 | Taskが人間判断、再計画またはRecoveryを要求 | TransportとCoordinatorを越えて同じProject状態を保持し、成功へ補正しない |
| 準正常 | 実行知の記録が利用不能 | Project結果を変更せず、非Authorityの観測不能として分離する |
| 異常 | Project RuntimeがCoordinatorまたはOS固有moduleをimport | 静的な依存検査で拒否する |
| 異常 | MCPがProject Authority、成功またはRepository Effectを生成 | 契約試験で拒否し、Project Runtimeを呼び出さない |
| 異常 | 旧内部Pathを利用側が参照 | 利用側閉包検査で拒否する |
| 異常 | Adapterの応答が欠落、未知またはIdentity不一致 | Project Runtimeは値を補完せずEffect不明またはRecovery義務を保持する |
| 異常 | 移行後の公開入口が旧結果Schemaと不一致 | CLI／MCPの総合試験で停止し、上位完成を主張しない |

## 7. 検証方針

- 単体試験: Project Runtimeの状態、計画、再計画、統合、公開投影およびPort結果の正常・準正常・異常。
- 結合試験: Project RuntimeとCoordinator／Persistence／Platform／実行知Adapterの接続、Identity、資源、Lock、取消、cleanupおよびRecovery。
- 総合試験: 公開CLIとMCP stdioから同じObjective／Decisionを搬送し、公開結果と終了後状態がv0.19契約を保持すること。
- 回帰選択: `project-runtime`、`mcp`または公開契約の変更から、Coordinator、CLI、MCP、traceability、署名依存閉包および文書利用側を逆向きに選択すること。
- 静的検査: Project RuntimeからCoordinator／MCP／Provider／OS固有実装への推移的依存0、公開入口を越えた内部Path参照0、移動前Path残存0。

実Provider、公式署名、性能試験および長時間試験は設計・移行中に自動発火しない。Runtime実行Identityを構成するsourceが変わるため、v0.20の正式候補では再署名と影響する正式E2Eが必要である。

## 8. 完成条件

- Project Runtime、Coordinator、MCP、実行知およびPlatform Accessの所有責務を文書と公開入口から一意に再構成できる。
- Project Runtime packageからCoordinator、Provider、MCPまたはOS固有実装への直接・推移的依存が0である。
- CoordinatorとMCPのProject Runtime内部Path参照が0である。
- 公開アプリケーション契約の意味定義が一つで、MCP Schemaが同じ意味を独立再定義しない。
- v0.19の状態、Authority、Identity、Effect、cleanup、RecoveryおよびAcceptanceの必須保証を移行後も保持する。
- CLIとMCP stdioの正常・準正常・異常の自動回帰が成功する。
- 試験カタログと変更影響型runnerが新packageと全利用側を選択する。
- Repository全体Checker、決定論的試験および独立レビューで未解決の必須指摘事項がない。

## 9. 公開済み文書の現行案内補正

責務分離で試験、Architectureおよび検証投影の所有Componentが変わったため、v0.19.0で公開したCHG-000057の現在案内5件を現行Pathへ補正し、当時の設計件数を支える歴史的述語1件を同じ公開tag上のexact pathへ接続する。公開時の本文、判断、結果および主張は変更しない。Checkerは公開tag上の原文Hash、置換前・途中・置換後の完全一致、置換数、現行参照先の実在、および歴史的参照が元の参照先と同じtag objectであることを検証し、それ以外の本文差を拒否する。

<!-- crdd-released-navigation-correction: 1 -->
```json
{
  "schemaRevision": 1,
  "sourceRelease": "v0.19.0",
  "sourcePath": "90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md",
  "sourceSha256": "e3ab9e61c2ab5b115438fab731937907452ab10b6153805895bebebbbc29f226",
  "replacements": [
    {
      "before": "[Project状態契約試験](../../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)",
      "via": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "after": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)",
      "via": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "after": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)",
      "via": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)",
      "after": "[参照アーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md)",
      "count": 1
    },
    {
      "before": "[Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md)",
      "via": "[Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md)",
      "after": "Git tag `v0.19.0` のexact path `06_Architecture/coordinator/03_Project_Runtime_Design.md`",
      "count": 1
    },
    {
      "before": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-platform-boundary)",
      "via": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-platform-boundary)",
      "after": "[参照アーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md)",
      "count": 1
    },
    {
      "before": "[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)",
      "via": "[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)",
      "after": "[機械可読な設計対応](../../07_Quality/06_Project_Runtime_Design_Traceability.json)",
      "count": 1
    }
  ]
}
```

## 10. 改訂経過

| 段階 | 変更の要点 | 現在の意味 |
|---|---|---|
| 責務分離 | Project Runtime、Coordinator、MCP、実行知、Platform Accessの所有範囲を分離 | 現在の契約は各Architecture正本が所有する |
| 保護対象経路 | Process／Worker入口、値由来、署名依存、利用側集合を閉じた | 代表利用側だけでなく、package／署名／回復を同じ変更単位で確認する |
| Docker lifecycle | v0.19の三値Engine観測、起動後再観測、exact回復Identity、追記型引継ぎを復帰 | 中間状態を現在のRelease Gateへ流用しない |
| 外部境界の結合 | ブロック内部、隣接一段、意味伝播を伴う二段の結合試験をSystem Test前へ配置 | 再利用可能な規則はArchitectureとTest Catalogが所有する |
| Provider診断 | 相関可能なphase診断を追加し、Codex隔離Executorのseccomp境界を是正 | 限定2経路成功は正式4経路E2Eの代替ではない |
| 前の署名候補 | 固定改訂版`f76b73af`で正式4経路4/4、Recovery Matrix 7/7を確認 | 後続の実行Identity変更後は、前候補の固定Evidenceとしてのみ扱う |

## 11. 有効な学びと構造是正

| 指摘クラスタ | 根本原因 | 保持する構造 |
|---|---|---|
| PowerShellの署名検査初期化 | Docker CLI用の中立環境を別の利用側へ流用した | 署名検査に検証済みの最小OS環境を与え、ambient環境継承やDockerの過去Version／Hash固定を行わない |
| 多段利用側の未確認 | 直接起動の成功から中立化子Process内の成立を推定した | 実際の多段Consumer境界を結合試験で確認する |
| 正常再起動後のTask回復 | 障害修復、検証済み再起動、Task回復の結果を結合した | 3つの結果を分離し、一つの成功から次を推定しない |
| 再起動状態の収束 | 要求、観測、確定を同一視した | 5段階の追記型状態列を保持し、不明Effectを再発行せず最後の耐久状態から再入場する |
| Engine ready／WSL stopped | Backend詳細を上位の起動成立条件へ追加した | 起動はEngine ready、停止はWSL stoppedを含む。`ready / known_unavailable / unknown`を維持する |
| 旧修復履歴との循環 | 旧履歴終了と新修復開始が互いを前提にした | 旧Effect不明を保存し、exactなfresh観測下だけEffect 0で世代交代終了し、新しいOperationを分ける |
| Process利用側の移行 | 実呼出しだけ移行し、署名・package・宣言・期待値が残った | 呼出し、由来、宣言集合、件数、派生Consumer、試験を一つの意味変更として移行する |
| Submission sidecar誤分類 | 検証後にDirectoryを生読取りして再解釈した | 検証済みCanonical inventoryを現在・旧Recovery Consumerへそのまま渡す |
| 引継ぎ件数 | 5件で完走する状態列をParserだけ4件に制限した | 命名、履歴解決、Parserで同じ上限を共有し、Identity循環拒否を維持する |
| 再ログオン後の主体 | 過去記録を現在Session Hashで再解釈した | 発行時の耐久Operation Principalを保持し、現在Session Authorityを署名済みRuntime、保護Root、Lock、追記型引継ぎで別に確認する |
| 外部境界の遅い発見 | Docker／Providerの付随lifecycleを最終E2Eまで実測しなかった | 設計時に診断契約を持ち、内部・隣接・二段結合をSystem Test前に確認する |

詳細な失敗時系列、実行値、試験件数および固定候補の結果は[検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)が所有する。CHGは現在も有効な変更理由と構造差だけを保持する。

## 12. Evidenceと残るGate

| 区分 | 状態・参照 |
|---|---|
| 前の署名候補 | 固定改訂版`f76b73af81c43e25f28037caa72d71a898a2f9fb`、Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067`。4経路4/4、Recovery Matrix 7/7、技術監査0件 |
| 現在候補 | 検証専用投影の移動とRepository全体の文書是正により実行Identityが変わる。前候補の署名を現在Gateへ流用しない |
| 現行Gate正本 | [Quality Center](../../07_Quality/01_Quality_Center.md) |
| 残るGate | 文書Disposition閉包、独立文書監査、Checker独立レビュー、固定Commit、新Runtime実行Identityの再署名、影響E2E、人間のRelease判断 |
