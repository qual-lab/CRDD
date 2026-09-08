# 変更トレース: Runtime責務分離

変更ID: `CHG-000063`
状態: `Formal E2E Pending`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `refactoring`
最終更新日: 2026-09-07

## 1. 結論と現在状態

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

- [Project Runtimeアーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md): Application Core、公開契約、Port、状態、依存規則および移行順序。
- [MCP Transportアーキテクチャ](../../06_Architecture/mcp/01_Architecture.md): MCP Protocol、stdio Transport、将来HTTPとの共通境界およびAuthority非生成。
- [Coordinator参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md): v0.19の実行編成、Provider、SecurityおよびRecoveryの既存保証。
- [Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md): v0.19固定版の状態、資源、Lock、Authority、EffectおよびRecovery契約。移行中も意味の基準として保持する。

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

責務分離で試験の所有Componentとファイル名が変わったため、v0.19.0で公開したCHG-000057の現在の試験案内だけを現行Pathへ補正する。公開時の本文、判断、結果および主張は変更しない。Checkerは公開tag上の原文Hash、置換前・途中・置換後の完全一致、置換数および現行参照先の実在を検証し、それ以外の本文差を拒否する。

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
      "after": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)",
      "via": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/unit/mcp-project-runtime-adapter.contract.test.ts)",
      "after": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "count": 1
    }
  ]
}
```

## 10. 正式E2Eで検出したDocker CLI署名検査環境

| 項目 | 内容 |
|---|---|
| 検出地点 | v0.20.0正式候補の4経路E2E、forward経路の開始前Recovery |
| 表示結果 | `docker_process_controller_recovery_conflict` |
| 直接原因 | Docker CLI用の中立化環境をPowerShellのAuthenticode検査へ流用し、PowerShell初期化に必要なOS環境まで空にした |
| 構造是正 | Authenticode検査専用の最小OS環境を子Process契約へ追加し、Docker CLI実行環境と分離する |
| 保持する保護 | 固定公式Path、Docker Inc署名、Filesystem Identity、Operation内Hash固定、親環境非継承 |
| 変更しない範囲 | Docker更新を特定Version／過去Hashへ固定しない。Recovery Authorityや残存記録を手動削除しない |
| 再検証 | 専用環境の閉集合、実PowerShell起動、Docker CLI Trust、該当Recovery、正式4経路E2E |

この不具合はProvider Effect前にfail-closedで停止したため、Canonical Repositoryの変更またはProvider送信は発生していない。Runtime実行Identityを構成するsourceが変わるため、是正後の正式候補は旧署名を流用せず再署名する。

## 11. 正常なDockerへ戻った後のTask復旧

状態: 着手前整合確認済み・部分実装。実機操作への接続・実機復旧・正式E2Eは未完了。

| 項目 | 内容 |
|---|---|
| 観測 | 2026-09-07の認証確認用コンテナに作成要求記録があるが、応答記録がない。現在の対象名照会は成功し、対象は一覧に存在しない |
| 停止理由 | `docker_task_recovery_create_outcome_unknown`。通常復旧は作成結果を確定できず、Taskより後の検証済み再起動証跡もない |
| 原因 | 再起動の証明を障害修復記録へ結合している。障害修復は正常Engineを拒否し、run Directory退避後の新Directory Identityにも依存するため、正常復帰後の復旧経路が閉じていない |
| 承認された是正 | 障害修復と、Task復旧に必要な検証付き再起動を分離する。正常なrun Directoryを退避・削除しない |
| 保持する保証 | 現在の署名・主体・保護Root・対象Taskへの結合、停止の完了観測、再起動後のfreshな対象資源不存在、取消・不明時の回復義務保持 |
| 対象外 | 空一覧だけによる義務消去、過去記録の書換え、任意のDocker資源削除、元Taskの自動再実行、正常環境を故障状態へ変える操作 |
| 残る設計確認 | 実行中Taskとの排他、Docker全体への停止影響、既存Native操作の再利用範囲、停止完了と遅延createの関係、耐久記録と再入場、公開入口・署名経路への伝播 |

着手前整合で、既存Native修復部品にもDocker 4.41.2の固定Policyが埋め込まれていることを確認した。通常CLIの更新追従だけでは停止・起動Consumerまで閉じていない。正常再起動の設計は[取消と回復](../../06_Architecture/coordinator/01_Architecture.md#7-cleanup依存順)へ置き、Native操作対象のTrust検証を未完了の成立条件として保持する。旧修復記録v4へ正常再起動を混在させず、新記録を検証してからTask復旧へ接続する方針は読み取り専用の着手前整合確認でも一致した。これは独立した完成監査の合格ではない。

正常Engine、既知障害、Engine観測不能、作成結果不明の対象なし、停止途中の失敗、再起動後の資源残存、取消、再入場を別々に検証する。検証付き再起動の成功と対象Taskの復旧完了は別結果とし、前者だけで後者を成立させない。完成後の独立監査は正式E2Eの結果と合わせて行う。

| 実装・確認範囲 | 現在状態 |
|---|---|
| 再起動の順序判定 | `docker-restart-state.ts`を追加。意図記録、停止、起動、回収、終了の順序を分離し、不明・取消・記録失敗では進めない |
| 判定の単体契約 | `docker-restart-state.contract.test.ts`の33件成功。型検査と対象2ファイルのBiome確認も成功 |
| 実機の署名観測 | 更新済Dockerのdesktop_cli、launcher、frontend、backend、buildはAuthenticode有効。旧dev_envs実体は不存在 |
| 再起動実行制御 | `docker-restart-execution.ts`を追加。操作前の意図記録、待機後の境界・取消再確認、未確定操作の再発行拒否、finallyでの回収を32件の注入型結合試験で確認。この確認時点では本番の記録・Native Adapterは未接続。後続接続は下記に記録 |
| Nativeの検証方式 | `docker_authenticode.rs`で同一handleのWinVerifyTrustと検証済み署名者のDocker Inc組織名を確認。失効確認はキャッシュ限定、確認不能は拒否。未署名file拒否とインストール済み署名実体の検証成功を確認 |
| Native再起動部品 | 旧修復経路と別の`--docker-desktop-restart-helper`を追加。現在の必須実体と存在する場合のdev_envsを署名検証し、同一操作中のsize・Hash・Identityを固定。`CRDDDS01`応答を用い、旧修復記録のPolicy Hashへ流用しない |
| 障害修復のTrust移行 | 障害修復のHost Effect順序と耐久記録は維持し、Native Capability取得を検証付き再起動と同じ公式Path・Docker Inc署名・同一操作Identity固定へ統合した。Docker 4.41.2の版固定Policyは現在の修復Authorityに使用せず、旧記録の履歴検証と現行Effect Authorityを分離する |
| 障害修復の停止責務 | 障害修復は専用`CRDDDR05`で公式停止`S`と残存Process終了`K`を順序付きで許可し、通常再起動`CRDDDS01`は`S`だけを許可する。旧`docker.exe -Shutdown`と版固定Policyは現行実行集合から削除した |
| Native実機観測 | 更新済Dockerで検証・終了命令だけを送り、ready／検証／終了の応答を確認。停止・起動命令は未送信。通常ユーザー環境で成功し、制限環境の失敗を成功へ合算しない |
| 部品回帰 | TypeScriptの状態・実行制御65件成功。Rustの通常試験20件とCLI試験1件成功、明示実機試験は別実行。cargo check／clippy／fmt成功 |
| 公開復旧への接続 | 未完了。純粋な順序判定は証跡の認証、永続化、排他または実機操作の実装ではない |
| 保護記録の利用側 | 再起動記録の連続prefix、Task・Root・submissionとの結合を検査し、完了連鎖を旧修復記録とは別の再起動根拠として扱う内部経路を追加。この確認時点では公開入口から未接続。後続接続は下記に記録 |
| 関連回帰 | 状態判定・記録・注入型実行制御・既存Docker Recoveryを合わせた178件が成功。実停止・実再起動・正式E2Eの成功を意味しない |
| WSL停止観測 | 登録一覧と稼働一覧の正常終了・完全出力を厳密に判定する部品を追加。実機の読み取り専用確認は両照会exit 0、登録32 bytes、稼働0 bytesで`stopped`。単独の時点観測は再起動完了の証跡へ流用しない |

旧dev_envsの不存在を未知Processの許可へ一般化しない。任意構成の自動受入れではなく、必須の停止・起動対象と条件付き対象の閉集合、署名確認不能時の拒否、および操作中の実体固定をNative設計で明示する。

### 状態遷移図を用いた設計照合からの学び

状態: 利用者が学びの記録を指示済み。共通規範への具体的な反映と独立確認は未完了。図による欠陥予防効果や実機成立は未実証。

| 区分 | 確認した内容 |
|---|---|
| 既存規則 | [アーキテクチャの状態遷移](../../27_Architecture.md#22-データ正本状態遷移)は、所有者、遷移条件、解放、判定不能、終了観測と実装・検証義務の対応を既に要求する。図だけでの完了も認めていない |
| 今回の観測 | 実装確認と状態図の具体化で、Process終了とEngine停止、再起動終了とTask回復終了、非同期処理中の排他、途中記録と完了証跡の違いが明確になった。図だけで全件を新発見したという意味ではない |
| 原因候補 | 状態の列挙に比べ、矢印を成立させる観測、待機中に保持する資源、利用側が必要とする終了条件の実装接続確認が不足した。規則の不存在ではなく適用・照合の不足が疑われる |
| 還元方針 | 「図を作る」を重ねて要求するのでなく、既存規則を遷移ごとの照合へ具体化する。複数責務をまたぐ場合は俯瞰図と責務別の状態図を分ける |
| 表現 | CRDD本体の今回の状態図は、利用者の指定によりMarkdownのテキスト図とする。採用先へ特定の描画方式を一律要求しない |

共通規範へ反映する際の照合候補は次のとおり。単純な一意変換へ存在しない状態や資源を追加せず、状態・非同期処理・資源の成立性が判断へ影響する対象に適用する。

| 照合単位 | 確認する内容 |
|---|---|
| 遷移の矢印 | 起点・到達点、契機、必要条件、その条件を証明する観測、判定する実装所有者 |
| 待機区間 | Lock・Authority・資源の保持期間と所有者、待機後の再確認、取消・親喪失時の処置 |
| 失敗の分岐 | 条件不成立・観測不能・記録失敗の行き先、残存資源、保持する回復参照、再実行の可否 |
| 終了点 | 部品の完了と上位処理の完了を分離し、次の利用側が必要とする条件まで確認する |
| 実装・試験への接続 | 各遷移と禁止遷移を実装箇所・観測手段・正常／異常試験へ対応付け、未接続・未観測を明示する |
| 図の改訂 | 実装差分で状態・観測・資源・利用側が変わった場合に図と対応を再照合する。図があること自体を完成根拠にしない |

担当は本変更の保守担当とし、本件の公開回復接続・実機E2E後の一括確認時に、既存アーキテクチャ規則、検証設計およびひな型への反映範囲を確定する。記録だけで現在の未接続保証を解消済みにせず、現在の是正と実機検証は継続する。

内部ブロック図についても、利用者は最終のCRDD還元時に他の図と合わせた必須化条件の見直しを希望した。今回、主要6ツールの既存Architectureへ、実装の責務・子フォルダ・ファイル名群を単位とするテキスト図を追加した。ファイル単位の列挙や図に合わせた再配置は行わない。還元時は、状態遷移図との役割分担、図と実装・検証の整合確認、単純な対象への非適用条件を検討し、図の有無だけを完成判定にしない。現時点では共通規範の必須条件を変更していない。

### 部分再起動記録を保持した是正候補

状態: 承認済み是正をSourceへ接続。新署名・実機停止再開・正式E2Eは未完了。以下の候補表は着手時の検討を保持し、現在の限定再入場は[取消と回復の正本](../../06_Architecture/coordinator/01_Architecture.md#7-cleanup依存順)を参照する。候補表全体の実装完了を意味しない。

| 今回接続した範囲 | 根拠・残る確認 |
|---|---|
| 公式停止 | Native `S`→署名固定pluginの`desktop stop --timeout 30`。旧repair `K`不変、restartの`K`は除去 |
| 子Process寿命 | suspended生成→kill-on-close Job→再開、NUL限定継承、EOF取消、同一handle終了・Job回収。Native通常27件＋CLI1件とclippy成功。実Docker停止は未確認 |
| 旧署名引継ぎ | `originReleaseRoot`から由来確認し、原記録不変でhandoff／continuationを追記。現在署名と旧由来を分離 |
| 再入場 | 旧単一`stop_intent`の初回引継ぎは`currentPhase=null`から新継続停止意図と公式停止へ接続。現在Runtimeの`stop_intent`は再観測のみ、`stopped`は未発行起動、`ready`は確定へ。`start_intent`再発行は不可 |
| 残るGate | 同一固定候補の全Consumer回帰、署名、実機E2E、最終独立監査。Source・局所試験からリリース成立を推定しない |

| 現在の観測・不足 | 是正候補と保持条件 |
|---|---|
| 実機の再起動が`stop_intent`で停止した。WSL停止とDesktop Process生存が同時に観測された | Engine休止とDesktop全体停止を区別する。旧要求が未発行だったとは遡及推定しない |
| 準備処理は既存`engine-restart-*`を一律拒否し、復旧側は完了5記録と現在Runtime Identityを要求する | 新署名だけでは再入場できない。旧記録の由来確認、現在Authority、部分状態照合を別契約として接続する |
| 既存`desktop_cli`は`DockerCli.exe`であり、公式Desktop pluginとは別実体 | `resources/cli-plugins/docker-desktop.exe`の署名・exact実体を検証し、公式停止`desktop stop --timeout <上限>`へ接続する候補。Help確認は停止成功の証明ではない |
| 旧修復の停止操作と正常再起動は別責務 | 旧Native `K`修復経路、run退避条件、旧修復記録の検証は変更しない。正常再起動ではrunを退避・削除しない |

| 保存済み状態 | freshな観測と必要条件 | 候補の処置 |
|---|---|---|
| 記録なし | 現在署名・境界・排他・対象1件を確認 | 通常の新規準備へ進む |
| `stop_intent` | 旧操作主体・CLI不存在、Desktop管理Process不存在、登録済みWSL停止をすべて確認 | 旧要求の成否を断定せず、現在の停止成立を追加記録。停止Effectを再発行しない |
| 旧単一`stop_intent` | Desktop生存、旧主体・CLI不存在、他Task／他資源不存在、対象実体のTrustを確認 | 初回引継ぎ後、別の継続意図記録→公式停止→完了観測。継続記録が既に`stop_intent`なら再発行せず観測のみ |
| `stopped` | 旧主体不存在と現在も停止中であることを確認 | 有効な引継ぎと現在Authorityの下で、未発行の起動意図を記録して進む候補 |
| `start_intent` | 起動結果・世代・順序を確認できる | 起動を再発行せず観測から照合。不足なら同じ回復IDを保持して停止 |
| `ready` | 起動後のEngine応答、対象資源不存在、回収と境界を再確認 | 未完了の確定処理だけを行う候補。再停止・再起動しない |
| `settled` | 完了連鎖とfreshな対象不存在が成立 | 再起動せず、別操作のTask復旧へ接続する |
| 任意状態 | 改変、分岐、観測不能、旧主体生存、Lock喪失、対象増加またはIdentity差 | 操作を追加発行せずexact回復IDと原記録を保持 |

記録は旧5段階連鎖を上書きせず、別の順序付き引継ぎ・照合記録を追加する候補とする。

| 記録契約 | 必須の結合・不足完成条件 |
|---|---|
| 由来と現在権限 | 旧署名配布物と旧記録Identityを照合。新署名は現在の操作権限だけに使用し、署名成立だけで互換性を推定しない。許容する旧契約Revisionを明示する |
| 対象不変 | exact Recovery ID、Operation nonce、未確定submission Hash、安定ユーザー／Home、保護Root Identityを保持。新旧Runtime Identityと旧連鎖tip Hashを別fieldとして結ぶ |
| 排他 | 現在のHost・Home・Runtime State Lockを非同期処理中も保持・再検証。旧helper／CLI／操作主体の不存在は別途観測し、Lock取得だけから推定しない |
| 耐久化と再入場 | 排他的な追記、前記録Hash、上限、canonical byteを検証。書込み後の応答喪失は再読取りで分類し、削除・巻戻し・別Identityへの書換えで解消しない |
| Effect重複防止 | 引継ぎ完了は停止／起動許可ではない。各新Effectの意図と観測結果を結合し、途中失敗後は保存状態を再分類。未確定Effectの無条件再発行を禁止する |
| 完成結果 | 引継ぎ成立、停止成立、再起動成立、Task復旧成立を分離。部分記録や履歴採用から再起動Fenceを発行しない |

既知の利用側と反証試験の予定対応は次のとおり。手書き一覧だけを全数性の根拠にせず、実装開始時にimport、公開入口、記録名利用、署名の依存集合から差分を導出する。

| 利用側・変更単位 | 反証と予定確認先 |
|---|---|
| 記録型・連鎖検証 | 別署名、別Task／Root／submission、分岐・番号飛び・部分byte・上限超過を拒否：`unit/docker-restart-record.contract.test.ts` |
| inventory・準備・追記・再入場 | 旧Identityの有効prefixを由来として保持し、現在Authorityへ流用しない。引継ぎ書込み後失敗、同時再入場、Lock喪失：`integration/docker-recovery-runtime.contract.test.ts`、`docker-recovery-lock-controller.integration.test.ts` |
| 状態判定・実行制御 | 上表の各状態、取消・応答喪失・再読取りで停止／起動の発行回数と理由を確認：`unit/docker-restart-state.contract.test.ts`、`integration/docker-restart-execution.contract.test.ts` |
| 公式plugin・Native・実機観測 | 未署名／差替え／旧CLI生存／停止timeout／WSL観測不能／Desktop残存を拒否。停止exit 0単独では不成立：`integration/docker-restart-machine.contract.test.ts`とNative対象試験。実停止は別の許可済み実機検証 |
| composition・Task復旧・Fence・残存清掃 | 引継ぎ済み未完了を成功扱いせず、settled後もfresh対象不存在がなければ義務を保持。新記録名の読取り・残存分類を閉じる：`integration/docker-restart-runtime.contract.test.ts`、`docker-recovery-runtime.contract.test.ts`、`docker-recovery-journal.integration.test.ts` |
| 公開facade・Help・Parser・Dispatcher・結果表示 | exact対象必須、任意forceなし、再起動とTask復旧は別結果、元Task再実行なし：`integration/cli-options.contract.test.ts`、`system/coordinator-docker-recovery-cli.integration.test.ts` |

2026-09-08の署名候補`7b9eac79`による実機確認は、引継ぎ開始前に停止した。準備の再確認だけが生のDirectory一覧を使い、耐久書込みの確認ファイルを記録本体へ混入させていた。準備・再確認・再起動後Recoveryで検証済み記録一覧を使用するよう統一し、未知ファイルや不正な書込み確認の拒否は維持した。

- 再確認の利用契約試験を追加し、確認ファイルの併存を許容しつつ一覧検証失敗を拒否することを確認した。
- 実ファイルへ耐久記録を生成する既存Recovery試験と合わせて112件成功。型・静的検査も成功した。
- この根拠は実機再起動、Task回復または正式E2Eの完了を意味しない。修正候補の署名と実機再確認は未完了。

実環境結合試験による追加切り分け（2026-09-08）：`e19afd27`の署名後、停止観測中の親Process異常終了を検出した。Docker・Recoveryを除外しても、3個のNode Worker稼働中の`process.report.getReport()`だけでexit 1を再現した。使用Nodeはv24.19.0。診断本文は保存・出力せず、呼出し前後だけを観測した。Windows環境生成がこのAPIを呼ぶため、WSL呼出し付近に見えた失敗をDocker停止失敗と同一視しない。

- 実Native反復観測・解放と実WSL観測を組み合わせる結合試験を追加した。明示実行する実環境試験であり、未実行を成功としない。
- Dockerクライアント検出による停止観測の拒否と、親Process異常終了は別事象として追跡する。
- 環境取得を固定Nativeの`GetSystemWindowsDirectoryW`へ変更した。通常ユーザーProcessで3個の実Lock Workerを保持した20回の取得と全Lock解放、実Native／WSLの結合観測は成功した。恒久試験を追加済み。全体回帰では新しいProcess入口の配布検証への伝播漏れを検出して是正中であり、署名・正式E2Eの完了とは扱わない。実環境境界ごとの結合試験を総合E2E前に置く共通規範への還元は、最終整理で行う。
| 署名・公開Process経路・試験選択・Workflow | 新plugin／sourceが署名依存集合と実ソース由来の入口集合に含まれること、旧K経路不変を確認：`system/interaction-boundary-regression.contract.test.ts`、該当署名試験と回帰選択。手順は実装確定後に同期 |

現在正本との照合では「旧証跡と現在Authorityの分離」「未確定Effect非再発行」「同じ回復IDの保持」と整合する。ただし既存の旧修復Session引継ぎ契約を、新しい部分再起動や別Runtimeへの実行継続へ自動拡張してはならない。旧操作主体の終了証明、新旧契約の互換条件、各保存状態からの正確な観測、追記途中失敗の収束、および公式停止対象のTrustは未完了の設計・検証義務として残る。

### 修正版への再引継ぎ：着手前の具体化（2026-09-08）

状態: 人間が回復境界に限定した是正の推進を承認。親担当と読み取り専用確認者で次の案を照合済み。実装完了・独立監査済みではない。

既存の引継ぎ連鎖だけでは、継続記録の全要素を最新Runtimeと最新handoffへ結合する利用側を満たさない。単にIdentity比較を除去する修正は行わない。

| 変更単位 | 具体案・維持条件 |
|---|---|
| 保存形式 | 5段階の単一状態列と既存ファイル名を維持。世代別フォルダや状態列の複製を追加しない |
| 引継ぎ記録 | 新改訂のhandoffへ引継ぎ時の継続記録件数・末尾wrapper Hashを結合。旧改訂は既存永続記録の読取りに限り保持し、bytesを書換えない |
| 列の検証 | 各wrapperのhandoffから発行Runtimeを解決。Runtime以外の全binding、状態順、元record bytesの前Hash、世代の切替位置を検証。通常の単一Runtime列検証は緩和しない |
| 再入場 | 末尾状態を継承し、引継ぎを理由に`prepared`へ戻さない。引継ぎ自体を停止・起動許可にしない |
| 不明状態 | `stop_intent`では停止観測だけを行う。`start_intent`の起動再発行は禁止を維持。全状態からの自動再開を完成主張に含めない |
| 完了済み | `settled`は再起動driverへ戻さず、現在の対象資源観測を伴うTask回復へ接続 |
| 書込み | 新handoffの単一耐久追記と再読取り。公開前・公開後応答喪失・確認ファイル片側・別bytes衝突を区別。上書き・削除・巻戻し禁止 |
| 上限 | 既存8引継ぎ上限とRuntime Identity循環拒否を維持 |

利用側の処置は、inventory、prepare、準備再検証、phase／handoff追記、settlement、restart-fence、Task回復、残存分類を一単位として行う。過去wrapperを最新handoffで再生成する再検証は、保存された元bytesの比較へ変更する。

必須反証は、A→B→Cの再引継ぎ、同一phaseでの連続引継ぎ、旧bytes不変、停止再発行0、別binding／末尾／件数／欠落／循環の拒否、切替後の旧Runtime追記拒否、handoff公開直後の中断、公開各失敗時のEffect 0と同じ回復参照、混在世代列からTask回復までの縦断とする。署名の前に確認し、実機E2Eの代替にはしない。

並行していた環境取得変更の全体回帰は終了コード1。Native観測の成功だけでは配布可能とせず、新しいProcess入口の宣言・実ソース照合を含む失敗の是正と再検証を先に閉じる。正式署名、旧記録への書込みおよびDocker操作は未実施。

| 2026-09-08の追加確認 | 結果・限界 |
|---|---|
| Native入口の配布検証への伝播 | Process宣言、実引数、由来の確認、呼出し集合の件数を更新。配布契約＋観測試験は124件成功、明示実環境3件は当該実行ではskip。静的検査成功 |
| 再引継ぎ記録の形式 | 改訂2に継続件数・末尾Hashを追加した閉じたcodecを実装。6件成功、型検査成功。旧連鎖検証は改訂2を拒否し、未接続の新形式から実行権限を発行しない |
| 次の接続 | 世代切替位置を検証する列解決、準備・再検証・追記・回復利用側は未実装。codec成功を再引継ぎ完成として扱わない |

### 作業候補の固定前確認（2026-09-08）

上表の後、列解決と準備・保存・Task回復への接続を実装した。実機の旧回復記録への適用と正式E2Eは未完了であり、再引継ぎ完成とは扱わない。

| 確認対象 | 結果・次の確認 |
|---|---|
| Process停止境界の回帰失敗 | 試験fixtureが全ファイルのopen/closeを差し替え、新規Native観測まで壊していた。差替えをコンソールdeviceと対応descriptorだけに限定し、他の実Filesystem操作を保持。期待値を変更せず関連6試験と型検査成功 |
| 異なる署名鍵の拒否試験 | 現行観測処理は現在の配布集合を受理するが、HEADから展開する旧集合を拒否。作業候補の改訂版固定後に再実行し、鍵拒否とmanifest非生成の成立を確認する。現時点では未合格 |
| ローカル清掃 | 不要な旧試験worktreeと一時ランチャーを清掃。未完了Taskの回復記録、現在の署名候補、必要な検証記録は保持。清掃を回復完了の代替にしない |

### Docker更新後の停止観測是正（2026-09-08）

署名候補による修復再入場は、履歴検証を通過した後に`docker_desktop_engine_state_unknown`でEffect 0停止した。読み取り実測では、Docker CLI 29.7.2がEngine停止時の`{{json .Server}}`へ`null`を出力して終了コード1を返し、対象named pipeは`ENOENT`だった。旧契約は空出力だけを停止候補としていたため、既知の停止状態を未分類にしていた。

| 保持する保証 | 是正・確認 |
|---|---|
| Docker版を固定しない | AuthenticodeでDocker Inc発行物を確認し、同一操作中の実体・Hash固定を維持する |
| 停止状態を出力だけで決めない | 非ゼロ終了、厳密な空出力またはJSON `null`、named pipeの明示的`ENOENT`がすべて成立した場合だけ`known_unavailable`とする |
| 想定外を安全側へ閉じる | 空白付き`null`、大文字、任意本文、pipe存在・権限拒否・観測不能は引き続き`unknown`とする |
| 実Producer形状を回帰する | 実子ProcessのLF／CRLF／JSON `null`搬送とpipe判定を契約試験へ追加する。修復完了は新しい署名候補の実機Lifecycleで別途確認する |

### 旧修復履歴と現在障害の循環解消（2026-09-08）

正式4経路E2Eの開始前回復で、旧Release由来の未終了修復を現在Sessionへ引き継げた一方、現在のDocker Engineは`Docker/run`直下のsocket lockにより起動不能だった。従来は旧履歴を閉じるためにEngine readyを要求し、新修復を始めるために旧履歴終了を要求していたため、どちらにも進めない循環が生じた。この条件はv0.19.0にも存在したが、当時の成立実測はクリーンな単一修復経路であり、未終了履歴と後日の別socket障害の組合せを反証していなかった。

| 契約 | 構造是正 |
|---|---|
| 旧Evidenceの保持 | 元Operation、Effect不明、引継ぎ連鎖および修復IDを変更せず、明示終了記録だけを追加する |
| 復旧成功との分離 | Engine停止中の旧履歴終了は`manualRecoveryRequired=true`を維持し、再起動Fenceまたは復旧成功に使わない |
| 新修復への引継ぎ | 現在境界、Process、exact `run` Identity、stale不存在および既知lockが揃う場合だけEffect 0で旧履歴を閉じ、新Operationを許可する |
| 環境変化への追従 | 特定socket名を固定せず、有限かつ安定した`Docker/run`直下集合の既知lockを分類する。Windows AF_UNIX endpointがNode.jsのDirentでlink相当となり、個別`lstat`も拒否される実挙動を許容する |
| Fail Closed | 列挙不能、64件超過、子Directory、未知error、集合またはDirectory Identity変化では旧履歴も新Host Effectも進めない。link相当を無条件許可せず、exact親Identity、非Directory、安定集合および既知access拒否を共同条件にする |

集中契約試験では、特定名に依存しないlock検知、通常file、Windows AF_UNIXのlink相当項目、未知error、件数上限、子Directory、集合変化、Directory Identity変化、および旧履歴をEffect 0で閉じて新修復を許可する経路を追加し、Docker Desktop修復契約52件が成功した。実Dockerの旧履歴終了から新修復、Engine復帰、Task回復および正式4経路E2Eは後続の実機Gateとして保持する。

### 外部境界の段階的結合への還元（2026-09-08）

今回の長い修正Loopは、実Dockerへの基本接続だけでなく、Recovery、再起動、履歴引継ぎ、cleanupおよび再入場を含む付随lifecycleが、独立した結合単位として早期実測されていなかったことにも起因する。最終E2Eをこれらの最初の発見地点にしないため、CRDD共通のアーキテクチャと品質保証へ次を還元した。

| 還元先 | 固定した内容 |
|---|---|
| アーキテクチャ | 外部境界を責務、状態、Authorityおよび資源のlifecycleで結合単位へ分ける。ブロック表、状態遷移表、その視覚投影である状態遷移図、ブロック間シーケンス図、クラス／型関係図およびDFDの適用条件・正本範囲・plain-text記法を分離する |
| 結合試験 | 主要経路だけでなく、同じ結合単位が所有する失敗、取消、cleanup、Recoveryおよび再入場を、ブロック内部、隣接一段、意味伝播を伴う二段の順で実境界へ接続 |
| 総合試験との境界 | 複数の独立単位を公開入口から利用者成果まで組み合わせる範囲はSTが所有し、ITへ全組合せを重複させない |
| 回帰選択 | 結合単位の意味変更時は付随lifecycleのITと前版Capabilityの実境界Evidenceまで選択 |
| 完成判定 | 責務表、状態遷移表、シーケンス、実装所有者および検証項目の未対応を固定候補前の不整合として扱う。試験Catalogは正本の意味を複製せず、参照と試験IDの対応を所有する |

Docker固有の表だけで閉じず、Checker、Project Runtime、Coordinator、実行知、MCPおよびPlatform Accessの全Toolへ結合ブロックを展開した。人間向けの責務境界とブロック間の時間順は[Tool全体の結合ブロック](../../06_Architecture/01_Architecture.md#tool全体の結合ブロック)と[ブロック間シーケンス](../../06_Architecture/01_Architecture.md#ブロック間シーケンスの正本)、機械可読なOwner、Lifecycle profile、一段／二段の結合経路、実在ITおよび終了後条件は[試験カタログ](../../07_Quality/04_Test_Catalog.json) revision 8が所有する。Catalogは全Toolのブロック参加、実在するArchitecture見出し、最大二段の経路およびIT接続を拒否条件として検査する。

MCPでは、stdioのparent EOFから進行要求取消・joinまでと、localhost HTTPのidle socket・listener shutdownを公開LauncherのSTから分離した実境界ITとして追加した。最初の実stdio結合では、要求処理を`await`している間に入力streamの読取りが停止し、親EOFを観測できない不具合を検出した。Transportの入力観測を意味処理から分離し、要求処理中もEOF／error／closeを観測して同じ取消Signalへ接続し、意味結果を受け取ってからTransport終了を返す構造へ是正した。stdio／HTTPのTransport lifecycleを含む16件は成功し、最終E2Eを最初の切断・join発見地点にしない境界を固定した。

### 前版の再観測能力の復帰（2026-09-08）

v0.19と同じ順序の限定実測によりDocker Engineは復帰したが、v0.20の耐久再起動記録が`start_intent`で停止し、公開回復入口は起動後の状態を再観測できなかった。原因はDocker Desktop固有障害ではなく、正常再起動を別部品へ分けた際に、前版が一つのLifecycleとして所有していた「起動後を観測して同じ回復処理へ戻る」能力を移行対象から落としたことである。

| 成立条件 | 是正・根拠 |
|---|---|
| Effectを再発行しない | 保存済み`start_intent`では停止・起動を呼ばず、現在のEngine Readyだけをfreshに観測する |
| 同じ回復Identityで収束する | Ready成立時だけ同じ連鎖へ`ready`を耐久追記し、helper回収後に`settled`へ進める |
| 不明状態を成功へ補正しない | Ready不成立、観測例外、観測手段欠落、取消または境界不一致はEffect 0で停止し、回復義務を保持する |
| 利用側まで閉じる | Coreの状態駆動だけでなく、Native machineを含む署名入口相当Compositionで、停止・起動Effect 0と`ready → settled`を確認する |
| 実観測を型上の断定へ置換しない | Native実観測試験は`unknown`を明示分岐で拒否し、その後だけ確定状態として保持する |

集中した状態・記録・machine・Composition・回復Facade・公開CLIの結合回帰258件、静的検査、型検査、Lint、整形、Capability／Traceability検査、通常Windows Process Gate 7件および制限Process回帰1937件（成功1934、失敗0、明示実環境3件skip）が成功した。Repository全体Checkerはerror 0／warning 0である。これは新しいSource候補の回帰根拠であり、既存署名候補、未完了回復記録または正式4経路E2Eを完了済みへ変更しない。次は固定Commitの独立事前監査、再署名、同じ回復IDの実再入場および正式4経路E2Eを必要とする。
