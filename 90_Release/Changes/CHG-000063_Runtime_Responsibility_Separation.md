# 変更トレース: Runtime責務分離

変更ID: `CHG-000063`
状態: `Independent Re-review Pending`
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

統合経路では、Project Runtimeが要求する統合記録Portを追加し、Repository Root、`.crdd`配置、Hash生成および不変公開をCoordinatorの統合記録Adapterへ分離した。同一記録の再試行、Identity衝突およびPath逸脱の拒否をAdapter契約試験で固定した。その後、状態・Queue・LeaseをBinding済みPortへ切り替え、候補の検証、競合判断、受入状態遷移および公開結果生成を含む統合Application本体をProject Runtimeへ移した。Coordinatorには候補生成、Repository観測、採用および統合記録の環境依存Adapterだけを残した。

人間判断経路では、判断Capabilityの秘密値生成とHashを専用Portへ分離し、Node暗号実装をCoordinator Adapterへ残した。判断ApplicationはBinding済みState Port、保護Store Port、回復Store Portおよび判断Capability Portだけを利用する形へ変更し、発行、適用、置換、無効化およびProcess loss後の回復をProject Runtimeへ移した。秘密値は保護Storeへ保存せず、Hashだけを記録する既存保証を維持する。

Repository Pathの意味検証はHost filesystemへ問い合わせない純粋な共通処理へ集約した。公開Objective、Planner結果、Task状態および統合候補は、Windows drive、POSIX absolute、親移動、空segmentまたは現在Directory segmentを含むPathをRepository相対Pathとして受理しない。これによりProject Runtime Applicationから`node:path`依存を除去し、入口ごとのPath判定差を閉じた。

Task実行集合のAuthority binding生成はCoordinatorからProject Runtimeへ移した。Project Runtimeは現在のProject、Milestone、Repository Revision、Objective、Taskおよびretry世代からBinding Identityを生成し、Hostが同fieldを持ち込む入力を拒否する。Coordinatorは各Taskの定義済み変更Pathと対応Objectiveの受入条件から実行要求を構成し、Objective全体の変更Pathを各Taskへ再拡張しない。Runtime packageの実行許可Capabilityは引き続き別のExecution Authorization Portが外部Effect直前に発行する。

Objective受付後の実行調停は、Project状態、QueueおよびProject Operation Leaseへの全アクセスをBinding済みのState／Lease Portへ統一した後、Project Runtime Applicationへ移した。Application判断はCoordinatorの永続化関数を個別に選ばず、構成時に検証済みRepositoryへ結合された同じPersistence Port集合だけを受付からTask実行、回復再入場および最終投影まで利用する。

同じ移行準備で、Queue、要求範囲および回復適用のIdentity生成と内容HashはClock／Identity Portへ、現在Process世代とRuntime Process Recovery Identityの検証はProcess Safety Portへ集約した。Objective ApplicationはNode暗号実装やCoordinatorのProcess安全状態を直接参照せず、Hostが注入した能力の結果だけを利用する。

Task回復は専用Portへ分離した。Project Runtimeへ公開するのはProject、Milestone、Task、Attempt、Operation、回復種別およびRecovery Identityであり、Coordinator Adapterが検証済みRepositoryの作業DirectoryとBindingを閉じてDocker回復、受領Recordおよび検証資源の最終化へ接続する。診断Observerの失敗はAdapter内で隔離し、回復の成否へ昇格しない。

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
