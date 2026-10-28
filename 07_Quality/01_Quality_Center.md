# CRDD内部ツールの品質の現在状態

Core独立の[Runtime Domain設計](../06_Architecture/Details/domain-model/05_Runtime_Domain.md)に基づく共通保存・一般CRUD・公開入口、Provider単段のExecutor分離と任意Coordinator接続はSourceへ反映した。非AIの確認結果・不合格・適用範囲は[責務再編の検証記録](../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を参照する。Sourceの保存先切替と実データ移行を区別し、正式項目の全数再評価、実AI／Docker、人間操作、全体QA／Releaseの成立へ換算しない。DomainのWindows rename拒否は未解消で、Coordinator全回帰は終端確認中。実AI・Docker・過去保持物は操作していない。

2026-10-24の公開操作・認証・AI選択再設計は、実装・本番接続と追従漏れ是正後の非AI影響回帰を限定完了した。初回全体及び影響四Suiteの不合格、是正後の範囲別成功、実AI・認証・人間確認・実移行の未実施は[現在の限定結果](../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#final-normal-regression)を正本とする。正式199項目の全数再評価、既存横断QA不合格、main統合・Releaseの判定は変更しない。以下は各記録当時の対象版に限定する。

B2の端末出力移管では、低層stream反証を補助Unit項目`EST-UT-016`へ接続し、現設計集合を13定義・199 Local Itemへ更新した。集約表の件数更新は全体Passの増加ではない。以下の198項目等の記述は追加前の対象に限り、現在の全数再評価は未完了である。

確定誤検知236件を検査側で是正した。生診断1,836→1,600、追加0、残る命名1,045は全件維持。局所・QA Header全数3/3、関係16/16・静的確認成功。Checker全回帰386件は385成功／既知1失敗（残1,600診断）で完走した。残1,600は現行規則上の是正対象1,444・適用先／解釈待ち156である。Browser原因未確定、正式未評価、②保持の扱いは維持する。[236件の是正と確認](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)と[原因別分類・Browser調査](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-browser-triage)を参照する。以下の回帰結果は各固定候補に限定する。

検証Tool自身の3 Suiteと4 Toolを接続し、Test Header全数Gate成功、現行文書43→0診断を確認した。歴史CHG旧リンク／アンカー3,353診断は不変更で全体Exit 1を保持する。型・静的検査と関連Package回帰は成功。Checker全回帰383成功／1失敗後、前提不整合で隠れていた既存Source命名・責務Headerの未達を別範囲として確認した。Browser接続1場面も元失敗の原因未確定を維持する。正式198項目・実Provider全E2E・全体Passへ換算しない。②のAI再試行・保持物削除と先行合成7領域の削除は行っていない。[原因別是正・確認範囲・残件](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)を参照する。先行Coordinator通常回帰1,833成功・失敗0・対象外5は当該先行差分の結果として保持する。

是正前の固定Commit `d4edcd1e`の全体回帰は不合格。通常17 Packageは3,389件＝成功3,315・失敗67・対象外7、CoordinatorのWindows追加は176件＝成功172・失敗4、Workbench実Browser／入口は22件＝成功19・失敗2・対象外1である。各実行群を合算して正式QA項目の成立数にしない。型検査17/17・Biome・Native単体47／CLI結合8・15画面の表示試験は成功したが、失敗の代替根拠にはしない。[固定版の原因群・残存参照・限界](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression)を参照する。旧結果は現在の全体Passへ流用しない。

Workspace方式の現設計集合は13定義・198 Local Item（RFD-IT-029を1件追加）。[追加統合](04_Quality_Integration.md#workspace方式の追加統合2026-10-17)と[新方式の検証計画](03_Verification_Design.md#workspace方式の段階別検証計画2026-10-17)へ接続した。新方式の検証結果は全件Not Run、既存197件時点の試験／Evidence・DI完成は基準対象に限定する。設計反映を実装・移行・全体Readyへ換算しない。以下の197等の件数はWorkspace追加前の対象として区別する。

状態: Quality Design Under Review — Reality Audit Blocked
担当責任者: Qual-Lab
最終更新日: 2026-10-19

現在の判定は[現在の品質投影](#current-quality-projection)を参照する。以下の先行候補の経過にある「現在」「最新」「未完了」は記録当時の対象版に限り、現行Sourceの成立状態へ流用しない。

Access Management再編の17義務は、承認済みPortfolio是正・局所反証・対象回帰・独立照合後に確認済み13・部分確認2・人間UAT未実施2。部分確認と人間UATは後続E2Eの実Host・利用者理解範囲である。対象回帰480件成功・失敗0、人間UAT1件Skip。Source／契約と結果同期の最終限定独立確認は残指摘0で、今回の区切りが成立した。当時の正式192項目の全体評価・全体Checker合格を代替しない。[現在の検証結果](../99_Roadmap/Changes/CHG-000082/Evidence/261014_access-management-verification.md)を参照する。

Workbenchの参照文書一覧・表示試験の既知2失敗は是正し、固定Sourceの公開`npm test`全60件が成功（失敗・取消・skip 0）。静的検査・Browser Build成功、技術／品質の限定独立レビューは指摘0。本文512KiB上限・認可を維持し、一覧だけ先頭8KiBから見出しを取得する。これは正式198項目の全体再評価、実Provider E2E・人間UAT・移行・新しいBrowser実測の代替ではない。[是正と検証結果](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#計画表示2失敗の是正2026-10-18)を参照する。


2026-10-23の限定廃止: Coordinator Sourceは基準149→145、Symbol登録365→358、全体Test Catalog登録387→384。専用試験3本の削除を成功数へ加算しない。Runtime Trustの二HandoffはOPENへ戻し、代替未接続と上流意図を区別する。Native／Kernel／通常回復と保存統合Bは維持する。以下の過去集計は当時の改訂版の履歴であり、この変更後の全体品質再評価ではない。

## 先行候補の経過（履歴）

2026-10-17の旧署名資格退役では、三API・専用状態・TTL・試験factoryを削除し、poison／drain時の拒否を現在のTaskへ接続した。関連三Suite71件、export不存在1件、再導入／旧比較2件が成功。契約／品質の限定独立確認は残指摘0、独立再実行は各2件／7件成功。任意署名試験1件は既知の配布graph不成立で準備失敗・変更分岐未到達を保持する。QA197の成立数・歴史Evidenceは不変更で、実Provider／Docker・全体E2Eと全体品質の完成ではない。

2026-10-17のOrchestrator実Provider検証Tool切替では、Source・入口の観測と改訂12の閉集合投影を含む41試験、台帳25件、静的検査が成功し、契約／品質の限定独立レビューは残指摘0。実Provider／Dockerは未実行であり、正式QA197の成立数を増やさない。配布回帰は既知PA依存未結合一件により18/19で、全体品質・E2Eは未成立。[S3限定結果](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#修復退避物の後続処置--着手前整合確認-2026-10-16)を参照する。

2026-10-13の旧Shared Host撤去候補では、下段のShared GatewayによるRFD-ST-004観測と13／46の移管件数は当時のEvidence適用範囲として保持する。新しいAM／MCP／Workbench経路のST成立や現在の全体件数へ流用しない。旧Gateway専用試験は撤去し、現在認証・各能力はaccess-capabilities、TLS・公開CLI終了はstreamable-http、独立Adapterの4 Caseは責務別試験へ接続する。正式191項目・Not Runを維持し、現在の件数・実行・Evidenceは⑥で再照合する。

現在の是正：Workbench通常管理候補は全44回帰・実Browser六件・Visual27測定が成功したが、固定候補の独立レビューはMajor1／Moderate4でFail。完全MCP Endpoint契約、結果集合の一意性、操作別成功ID、配置文書、Remote Browserの未確認を是正する。既採用Targetに従ってRemote全Consumerを単一Endpointへ切り替え、旧Backend→CROS RESTを置換するため、影響範囲を計画へ拡張済み。旧成功を新経路の根拠へ流用せず、新候補の回帰・Browser・終了保証・独立レビューを再実行する。正式191項目とAM全体は未完了。[是正範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#workbench-remote全consumerのmcp単一路への切替--2026-10-13)を参照する。以下の局所成功は各先行候補の範囲に限る。

現在の局所結果：通常三ロールの本人読取りをMCPへ接続し、管理結果の共通投影をAMへ集約した。AM全150件／MCP全85件の計235件と各書式・型・Lint成功、固定21Pathの限定独立レビュー残指摘0。本人だけの閉投影、Role変更／失効の現在性、初回非提供、管理候補・他ユーザー・資格の非開示を確認した。Workbench管理画面へ必要な意味・読順・個別改訂・実Browser／Visual再評価義務は伝播済みだが、画面・POST・Remote接続は未実装。Remote登録M1、公開Launcher、旧REST撤去、正式191項目とAM全体完成は残る。[現在の計画](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#workbench通常管理と本人表示の本番接続着手--2026-10-13)を参照する。

現在の局所結果：非鍵管理の四読取り・六保存をMCPの注入Resolverへ接続した。MCP全84件と書式・型・Lint成功、固定16Pathの限定独立再レビュー残指摘0。現在Role、閉結果、保存後切断、最初の失敗と既知出版、UTF-8応答容量、試験Process異常終了後の一時Root回収を確認した。Remote登録は判断待ちでSource・Schema・一覧・dispatchに追加していない。Workbenchの非鍵管理画面、公開Launcher、旧REST撤去、正式191項目とAM全体完成は未成立である。[対象と残件](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#非鍵管理の公開接続に向けた着手前確認--2026-10-13)を参照する。以下の局所結果は先行固定版の履歴で、最新版全体の完成根拠ではない。

最新の局所結果：Workbenchの同Process鍵管理4操作と非秘密の管理Readerを接続した。AM全150件／MCP全75件／Workbench全41件／実Browser全5件成功、静的3軸・Build成功、固定19Pathの限定独立再レビュー残指摘0。専用POSTの一度提示、次操作・再読込時の消去、交換後の旧接続失効、出力／保存故障と全段清掃を確認した。秘密の再取得・再表示・一般GET／Storageへの保持、新Store／Lock／Frameworkは追加しない。非鍵管理7操作の公開接続、公開Launcher・通常接続切替、実Host TTY、旧REST撤去、正式191項目とAM全体完成は未成立。全体Checkerの直前結果3057 errors／0 warningsは未解消で、全体Passとはしない。[対象と残件](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#workbench鍵管理の本番接続着手--2026-10-13)を参照する。以下の最新表記は先行段階の局所履歴である。

最新の作業結果：鍵交換三出版の保存と現在再入場をRFD-IT-013／017等の局所断面で確認した。局所10件、修正後AM全125件／MCP全75件・両静的3軸成功、固定11Path限定独立レビュー残指摘0。三出版故障、失効後の現在認可、生成／容量、初回Binding、実Process喪失6条件・競合3条件と再認証変異を反証した。Symbol／Catalog ID・Path重複0・登録実体欠落0、終了後store Root残存0。Repository Checkerは当該11Path指摘0、全体3057 errors／0 warnings・Exit1であり全体Passではない。保存core成功でも未解決recordと未提示は保持する。非秘密交換read・提示・record整理・本番Consumer、実Host／Linux、正式191項目・AM全体は未成立／Not Run。[限定範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#交換本体の保存接続の着手と固定条件--2026-10-13)を参照する。以下のReader等は先行局所結果である。

最新の局所結果：元発行IDとユーザーIDによる専用非秘密ReaderをRFD-IT-017／018の局所断面で確認した。局所4件、修正後AM全109件／MCP全75件・両静的3軸成功、固定8Pathの限定再レビュー残指摘0。提示三状態・現在失効・現在認可・固定未取得、出版済み材料処置とpending削除失敗時の部分清掃、処置要求の事実非返却と次の新要求だけの観測を照合した。通常管理read四kind・MCP・秘密値・履歴・Storeを追加しない。交換・Workbench実提示／本番接続・実Host／Linux・旧REST撤去・正式191項目・AM全体は未成立／Not Run。前段の間欠競合原因未解消を保持し、最新109件成功から解消とは推定しない。[対象範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#元発行identityによる非秘密の現在観測--2026-10-13)を参照する。MCP回帰の旧REST／Shared比較を本番代替完成へ流用しない。以下は先行段階の局所結果であり、AM全体Passへ流用しない。

先行したSchema切替結果：管理状態Schema v2の型・Parser・初回資格WriterをAM／MCP利用側fixtureと一体切替した。当時のAM64／MCP68 Caseと各静的3軸成功、固定8Pathの限定独立レビューPass・全重大度の残指摘0。初回Host交換の失効途中は読取り可能でも認証を拒否し、元資格・確認対象・歴史IDを分ける。正式191項目はNot Run。提示保存・初回確認出版は保存側へ、その完全discoverと応答取消はMCP局所候補へ接続済みで、本番入口は未接続。旧v1実状態移行、鍵の実TTY／HTTP提示、本番入口・AM全体完成は未成立。[先行実装範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#管理状態schema-v2の実装候補--2026-10-12)を参照する。最小提示のQuality伝播12文書と計数同期41Pathの限定Passは各文書差分だけの結果で、正式試験のPassへ流用しない。

現在の計数同期結果：現行契約をRole別分担9行・11認可要求種別・通常保存7操作（User4＋Repository3）へ揃えた。ProfileのCatalog保存・鍵Lifecycle・初回設定・Host交換は通常保存7操作に含めない。権限や操作の増減ではなく、旧「通常6」の計数不整合を訂正する。[Owner同期候補](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#管理操作の計数同期候補--2026-10-12)は限定独立再レビューPass・全重大度の残指摘0で、計数Blockerは解消した。正式191項目Not Runと既存Checker指摘3057件は維持し、Quality全体Pass・Source Readyへ昇格しない。

最新局所候補：AM現在認可による共有Profile管理をSource・実HTTPと実Catalog Storeへ接続した。AM60／AI Adapter30／CROS34／MCP68／Workbench33の計225 Case・各静的3軸とWorkbench Build成功。CROS／Workbench結果は旧比較Consumerの回帰であり、新RoleのWorkbench本番接続成立ではない。Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Tool。固定候補の限定独立再レビューはPass・残指摘0で、Repository全体Checkerの既知3057 errorsは未解消。正式191項目Not Run、本番Launcher／Workbench・鍵配送・旧REST撤去・全体Ready未成立を維持する。[接続範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#共有ai-profile管理のrole採用と本番接続--2026-10-12)を参照する。以下の最新表記・件数・未接続表示は各先行段階の局所履歴であり、現在候補の完成証明へ流用しない。

最新局所結果：現在のAM認証・認可からTopic／Meeting全12操作を実HTTPへ接続した。MCP65／Domain120／AM59の計244 Case・各静的3軸成功、限定独立再レビューPass・全重大度残指摘0。指定対象への実保存、現在Role／Exposure／失効、foreign Project保存拒否、Relation集合、14 Toolの公開Schemaを確認した。正式191項目Not Run、本番Launcher／Workbench切替・活動／Profile接続・鍵配送・旧REST撤去・全体Ready未成立は維持する。[対象と限界](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#am認証によるtopicmeeting-mcp接続--2026-10-12)を参照する。

最新局所結果: AM→Domain実本文→Project Context専用MCPを実HTTPへ接続した。MCP60／AM59／Domain118の計237 Case・各静的3軸成功、固定8Pathの限定独立再レビューPass・残指摘0。本文待機中の公開解除／失効は旧対象本文0、欠測は全体停止、開始後取消は当該descriptor終了・後続読取り0・内容非公開を確認した。正式191項目Not Run、公開Launcher／Workbench切替・他能力AM接続・鍵配送・旧REST撤去・全体Ready未成立は維持する。[対象・実行結果](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#am認証によるproject-context専用mcp接続--2026-10-12)を参照する。

最新局所結果: 通常接続用認証を初回本人確認と分離し、RFD-IT-013／024の一部へ接続した。AM59/59 Case・静的3軸成功、固定8Pathの限定再レビューPass・全重大度残指摘0。未完了・未知・失効資格のpending／replace保持、完了三Role、状態・清掃・解放不明の非開示を確認した。MCP専用Resolver／実HTTP搬送・本番MCP／Workbench・鍵配送・旧REST撤去・正式191項目Not Run・全体Readyは未成立。詳細はCHG-000082の[通常接続の認証](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#通常接続の認証とmcp搬送の着手前確認--2026-10-12)を参照する。下段は各先行段階の局所結果である。

最新局所結果: Reader成功へUTF-8本文相関版を追加し、AM許可集合から実本文と4項目Source／Portfolioへの搬送を確認した。Domain118／AM57の計175 Case・各静的3軸成功、固定8Pathの限定独立レビューPass・残指摘0。同本文の版一致・空白変更の版相違・失敗時版なし・空認可本文0を確認した。PPR-IT-019／002、RFD-IT-019は部分接続で、本番MCP／Workbenchと実failure集約停止Consumer・性能／lifecycle・鍵配送・旧REST撤去・正式191項目・全体Readyは未成立。

最新局所結果: 同要求の許可Repository集合をRFD-IT-013／019の一部へ接続した。AM全56 Case・静的3軸成功、固定9Pathの限定再レビューPass・全重大度残指摘0。Repository一意性・全許可範囲・各manifest一回観測・次要求再認可・認証済み空集合・初回未完了有効資格の拒否と材料不変・不明時の集合非返却を確認した。本番Consumer・本文搬送・性能／lifecycle・鍵配送・旧REST撤去・正式191項目と全体Readyは未完了。結果の詳細はCHG-000082の[同要求の許可集合](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#同要求の許可repository集合--2026-10-12)を参照する。

最新局所結果: 固定本文ReaderをPPR-IT-019、同じ試験内の成功Context→中立Source→PortfolioをPPR-IT-002の一部へ接続した。Domain全118 Case・静的3軸成功、固定10Pathの限定独立レビューPass・全重大度残指摘0。1 MiB境界／超過、種類・解析・三Identity不一致、途中変更・下位例外、descriptor終了を確認した。失敗はunavailableのままでmissingへ変換しない。認可・本番Consumer・ST／UAT・鍵管理／配送・旧REST撤去・191項目正式評価・全体Readyは未完了。下段の「実本文Reader未接続」はこの局所入口追加前の状態であり、本番認可からの搬送は現在も未接続。

最新局所結果: 認可済みSourceの純粋Portfolio集約をDomainへ移管し、CROSの認可先行変換・HTTP／MCP／Workbenchの利用側を接続した。5Package計292 Case・各静的3軸・Workbench Build成功、固定22ファイルの限定独立再レビューPass・全重大度残指摘0。非許可Context参照0、欠測／Identity競合、順序、不変性、集合欠落拒否を確認した。欠測はSource Snapshotで未提供という旧表示で、実Filesystem不存在・Reader正常完了・unknown識別を保証しない。AM本番認可・実本文Reader・鍵管理／配送・公開ST／UAT・旧REST撤去・全体Ready・191項目正式評価は未完了。以下はAM実アクセス等の前段局所結果である。

最新局所結果: 内容実アクセス解決をRFD-IT-013の一部へ接続した。AM全54 Case・静的3軸成功、固定9ファイルの限定独立再レビューPass・全重大度残指摘0。認可前／pending異常時の対象観測0、Binding改ざんのSchema拒否、manifest／Git不成立、解放不明時の内部値非返却、次要求への公開解除反映を確認した。本番Consumerの能力再利用0・Domain搬送・鍵管理・配送・全体STは未成立、191項目正式Not Runを維持する。以下51 Case以前はこの接続前の履歴であり、全体完成へ流用しない。

最新局所候補: 管理対象別読取りをRFD-IT-013／021／024の一部へ接続した。AM全51 Case・静的3軸成功、固定11ファイルの限定独立レビューPass・残指摘0。三Role×四対象の完全DTO、Role変更後の拒否、未設定／明示空Exposure、不正kindのI/O0、認証・認可前材料保持、清掃／解放不明時の非開示を確認した。内容実アクセス認可・鍵管理・配送・本番Consumerは未成立、191項目正式Not Runを維持する。本人読取りの48 Case・限定独立レビューPass、前段登録3操作の45 Caseは今回接続前の履歴である。

前段の認証局所候補: RFD-IT-013の資格→現在User／Role部分とIT024の初回非更新を接続し、AM全35 Case・静的3軸成功。本人固定DTO、次要求の現在Role、失効・破損・pending不正・解放不明時の本人情報0を確認した。固定13ファイルの限定独立再レビューPass・残指摘0。

最新局所候補: RFD-IT-024の初回資格保存部分に4 Caseを追加し、AM全33 Case・静的3軸成功。生鍵非保存・再表示禁止・Process喪失・Lock解放不明時の秘密非返却を確認した。固定10ファイルの限定独立再レビューPass・全重大度の残指摘0。初回全体・配送・認証・本番Consumerは未成立、191項目の正式評価Not Runを維持する。以下29 Case以前は前段の結果である。

最新局所実行: Credential生成・照合のNode crypto技術面をRFD-IT-017／018へ接続し、AM全29 Case・静的3軸成功。固定13ファイルの限定独立再レビューPass・全重大度の残指摘0。固定KDF比較と不正形式拒否の結果であり、保存・認証・配送・鍵管理全体の成立ではない。191項目・正式評価Not Runを維持する。

最新局所実行: 初回管理者の保存部分をRFD-IT-024へ接続した。再入場・生成前拒否・実Process喪失・二Process競合・出版後Lock解放不明を含むAM全27 Case・静的3軸成功。限定独立再レビューPass・全重大度の残指摘0。初回全体・Root準備・鍵・認証・本番Hostは未成立、191項目・正式評価Not Runを維持する。以下23 Caseは前段の結果である。

最新局所実行: 初回相関保存を既存RFD-IT-024の一部へ接続し、4 Caseを追加してAM全23 Case・静的3軸成功。限定独立再レビューPass・全重大度の残指摘0。初回全体・Root準備・User／鍵・本番Hostは未成立、191項目・正式評価Not Runを維持する。以下19 Caseは前段の結果である。

最新局所実行: 通常保存Adapterの保存部分をRFD-IT-021へ接続し、実Filesystem・子Process喪失・既存Lock回収・故障注入の8 Caseと、既存UTを合わせAM全19 Case成功。format・type・lint成功。限定独立再レビューはPass、全重大度の残指摘0。191項目・正式評価Not Runは維持し、認可・六管理操作・初回／鍵実処置・本番入口・全体保存は未完了。下段の全11 Caseと保存未接続はこの段階以前の結果である。

最新設計集合は13定義・191項目（QA-000007は28項目）。2026-10-12にRFD-UT-028を状態Schemaの純粋検査としてNew追加した。候補局所実行は4 Case、AM Package全11 Caseとformat・type・lintが成功。正式項目評価はNot Run、保存Adapter・鍵・認可・本番Consumerは未接続。下記190件表示は追加前の履歴であり、実行Pass数ではない。

現在注記: v0.21の最終署名照合は履歴Baselineとして完了している。v0.22の署名候補Commit `45254e2b`と是正済み検証Tool `1b756ac2`によるOrchestrator公開MCP実Provider E2Eは、Run `2e55c8cd2897464b`で合格した。通常二経路、取消、exact Recoveryおよび最終資源回収を確認し、再入場後は意図どおり人間の採用判断待ちで停止した。Workbench実Provider E2E、必要な四経路E2E、個別品質項目の照合および最終配布の再署名は残るため、Quality Readyへ昇格しない。

## 鍵管理・認可の限定設計対応の局所履歴 — 2026-10-11

本段落はProfile追加前の当時の履歴である。最新の限定実行: RFD-UT-020に対応する新Access Management候補試験を公開Root経由で局所実行し、4 Case成功、format・type・lint成功。10具体操作とRole対象の有限組合せ、未知入力・accessor／Proxy拒否を確認した。Source／Test Symbolは接続済みだが、正式Local Item結果／Evidence評価はNot Run。契約・品質の限定独立再レビューは全重大度の残指摘0。純粋判定の局所結果で、認証・保存・資格・IT／ST・本番Consumerは未確認。他ItemのNot RunやQuality Readyを変更しない。[実行条件と限界](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#am固定管理判定の局所実装--2026-10-11)を参照する。

本段落は2026-10-11の鍵管理Quality再導出時点の履歴である。QA-000007／QA-000009と7工程分析の固定9文書で契約・品質の限定独立レビューを完了し、全重大度の残指摘0。新規4項目（RFD-IT-017通常発行、018独立失効、019認可済み集約、EST-ST-015 MCP鍵操作非公開）と既存更新項目はNot Runである。旧Evidenceは旧契約の歴史的証跡として維持し、新契約のPassに流用しない。現在のIT017／018はNode crypto技術部分だけSource／Test Symbol・候補局所実行接続済み。正式191項目／EvidenceはNot Run、保存・発行確定・失効・認証主体・現在Role・配送・本番入口は未接続。全体Quality Ready・Release可能を主張しない。

## 権限分担のQuality伝播履歴 — 2026-10-11

本段落はProfile追加前の当時の履歴である。固定8操作の担当Roleは採用済み。QA-000007へRFD-UT-020（固定判定）、RFD-IT-021（通常管理保存境界）、RFD-ST-022（Workbench公開縦断）を追加し、RFD-UAT-007とQA-000009／EST-IT-010を更新した。新規・更新項目はNot Run。固定12文書の契約・品質限定独立レビューは是正後ともに残指摘0であり、旧鍵管理の限定レビュー結果を流用しない。内容権限の具体語彙、RFD-UT-020の固定管理判定Source／Test Symbolと候補局所実行を除き、具体API・保存Schema・他Source／Test・正式Evidence・本番接続は未成立。Profile管理の担当Roleは別途OPEN。Quality Integrationの全体一覧追従も後続とし、全Quality統合完了を主張しない。

## 登録解除・鍵受け渡し判断のQuality伝播 — 2026-10-11

基準Commit `c4cd0fd3`のArchitectureと確定上流判断から、7工程分析・QA-000007／QA-000009・本Center・計画・PROJECT_CONTEXTの12文書へ伝播する。登録解除の同一操作／採用改訂の両除去読戻しと旧実行終端、鍵の元発行再観測／確定後配送未確認からの別明示交換／現在administrator非接続時の既存Hostを分けて検証する。既存項目の具体化で、設計集合185件を維持する。

今回更新するRFD-IT-017／021、RFD-ST-016／022、RFD-UAT-007、EST-IT-010／ST-015はNot Run。固定12文書の契約・品質限定独立レビューは是正後ともに残指摘0で、前回限定Passを流用しない。物理保存・公開read・配送観測の具体化、Source・Test・新Evidence・本番接続は未完了。Quality Ready・Release可能を主張しない。

## 初回Host設定の検証設計 — 2026-10-11

本節の未接続表示は定義追加時点の履歴。現在はUT023とIT024相関・User・初回資格保存部分まで候補接続済みで、残る初回範囲と正式評価は未成立である。

初回設定専用のRFD-UT-023／IT-024／IT-025／ST-026／UAT-027をNew追加し、MCP非公開はEST-ST-015へSame統合する。QA-000007は22→27項目、全13定義は185→190項目。7工程分析・統合対応への定義接続は契約・品質の限定独立レビュー済み・残指摘0。新規・更新項目はNot Run、Source／Test・物理保存・受領・清掃・本番接続・新Evidenceは未完了。項目数の増加や定義接続を実行Passにしない。旧185件の記録は当時の履歴として維持する。

## Current Quality Projection

2026-10-17のDocker Isolation再編では、開発実測Sessionに続き一般Task・四経路・二経路・結果記録を署名なしのSource観測へ接続した。対象四Suite84件は83成功・Windows link権限制限一件で、同一Caseの通常Host再実行は成功。契約側の同範囲独立実行も同じ結果、品質側の関連15Caseは成功し、両監査の残指摘0・限定Pass。正式197義務の成立数へは換算しない。旧専用署名API／Tool・配布graph、保持物・次Task、実隔離／Provider／取消／回収・E2Eは残る。[限定結果と残範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#修復退避物の後続処置--着手前整合確認-2026-10-16)を正本とする。

2026-10-14現在、Access Managementの専門Owner接続と旧CROS Package撤去は局所確認済み。正式な検証義務全体への評価・根拠対応は再照合中であり、Case成功数からLocal ItemのPass数を算出しない。通常認証・Exposure・実アクセス・Domain搬送・管理保存・Workbench／MCPの接続は局所実行済みで、設計伝播だけの状態ではない。一方、実Host対話からの初回設定・鍵操作の縦断と利用者の理解は未確認である。

初回設定・鍵操作の実入口の未確認範囲と`RFD-UAT-007`／`RFD-UAT-027`は、人間判断により後続E2Eへ移した。未検証をPass・免除へ変更せず、それ以外の是正・固定候補回帰・独立レビュー後にコミット・プッシュし、Docker周りの責務分離・大改修へ進む。[今回の区切り](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#今回の区切りと後続e2e--2026-10-14)を正本とする。

| 項目 | 現在値 | 根拠・次の処置 |
|---|---|---|
| 全体状態 | ⑥の品質整合・正式評価を進行中 | 全体Quality Ready・リリース可能とはしない |
| 現在対象 | v0.22.0 | CHG-000082の実行系再編を作業中。AM・Domain・Workbench・MCPの限定結果は保持する。CROSは全体概念であり旧Packageではない |
| 設計集合 | 13定義・198 Local Item | Workspaceの実Git LifecycleをRFD-IT-029として1件追加。設計追加だけからSource／Test接続・実行・Passを推定しない。正式項目の再評価と個々の局所観測を分け、旧197件・191件の履歴は変更しない |
| 観測済み | Coordinator通常1,833成功・対象外5・失敗0。Windows該当5件、Semantic16件等も成功 | [追従是正後の観測](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-follow-up-remediation)を現在値とする。他の回帰群に未開始が残り、先行版の1,926件等の結果は現在の全体合格へ流用しない。局所件数を正式項目のPass数へ換算しない |
| 未観測 | 正式198項目の全体評価、後続E2E・UATの未確認範囲を保持 | 新Workspace方式の正式評価は未完了。Source接続・局所実測済みの範囲と未評価を分ける。初回実Host・鍵実入口・利用者理解等は後続E2Eで確認し、局所成功を実Win32故障や実Provider全体成立へ換算しない |
| 既知Gap | 全体Checker未合格、正式Evidence対応を再照合中 | 局所成功や関係の存在から全体完成を推定しない |
| 局所根拠 | 先行AM152、MCP86、Workbench78等は当時の対象に限定 | 最新差分の結果は冒頭と変更計画を参照。異なる版・局所実行を合算して正式義務の成立数にしない |
| 検査 | 最新の文書検査は現行0・歴史CHG旧参照3,353で全体Exit 1 | 3 Suite分類・Test Header・現行43診断を是正。Checker既存Source命名・責務Header未達、Browser元失敗・原因未確定、未実施Host境界・合成7領域清掃、正式198項目の全体評価・Evidence対応は分離して保持する。[現在結果と限界](../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)を参照 |
| 限定実境界 | 診断付き新品一回でDocker再起動と認証create結果不明の限定終了が成功 | 再起動1回・不存在2回・終了保存1回、正式回収・履歴・操作除去・Root不存在を確認。過去Failと原因未確定を保持し、汎用unknown終了や別の実境界成立へ換算しない。詳細は変更計画を正本とする |
| 公式配置Image | 通常entrypointの公式0.159.2、三実行物Hash、実Image IDと隔離構成の実Caseが1/1成功 | 二Containerを順次回収しRoot不存在。read-onlyのPATH alias作成Warningを元のまま保持する。再Build・公式取得元再検証・Host機能・助言／取消の成功へ拡張しない。正式義務の全体評価は別に照合 |
| 後続E2E | 初回設定・鍵実入口、利用者理解、実Provider／隔離／取消／回収 | 後回しは免除でない。通常実行へCRDD独自署名を再要求しない |
| 次Gate | Docker Isolationの実装・検証完了。本Packageの変更をコミット・プッシュ | 後続E2E・全197項目評価・既知Checker不合格・Coordinator／Orchestrator再編は別の残件。v0.22完成やRelease可能とはしない |
| 現在人間判断 | 実境界確認は実行済み、追加判断なし | 009はWSL保守後に同ID正式終了。030は実Ctrl+Cとreviewer準備中の親喪失を別評価し、両元IDの正式終了、revision72・待ち0、試験資源不存在まで確認。executor実行中の親喪失とは区別する。Source・試験結合是正後の回帰・独立レビューと完成条件を照合済み。詳細は変更計画冒頭 |

## 設計集合

2026-10-07の現行Semantic集合は17意味、実装Relationあり17・自動Test Relationあり16・手動確認待ち1である。独立Trust Policy起動接続は将来範囲のため現行Requiredから除去した。実装追加によるMissing解消ではなく、実行・Evidence全体Passも主張しない。

過去の2026-10-06の現物再集計は13定義・176項目、試験Relationあり132項目・なし44項目、Symbol616件（ID重複0、未定義Local Item参照0）である。Semantic Coverageを再生成し、18意味のうち16は実装・自動試験の両Relation、1は実装・試験未観測、1は手動確認待ちとなった。いずれもRelationの数字であり、実行や品質項目の全体Pass件数ではない。[再集計と適用範囲](../99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md)を参照する。

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 167 |
| Quality検証目標 | 13 |
| Local Item数 | 199 |

## 集計の履歴と現在への適用

現行Quality設計は13定義・197 Local Itemである。2026-10-17にERB-UT-039追加後の各Definitionの検証項目表からIDを抽出し、重複排除して再集計した。2026-10-16のERB-UT-038追加後の13定義・196件再集計は当時の履歴として保持する。設計件数は実行／Pass件数ではない。旧190件、移管母集団13／46観測済み・33／46未観測、旧投影119件観測済み・57件未観測は、それぞれ当時の対象版と集計範囲に限る。Gateway撤去後の現行AM／Workbench／MCPの成立数として使用しない。v0.21の固定Baseline108／130と22未観測は履歴として維持する。**現行対象のRelation別Evidence適用と全体成立数は再照合中（OPEN）**であり、履歴件数の加算で現在の成立を表示しない。[算定Owner](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)と正式評価へ接続する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 41、UX 35、IA 23、UI 20、SPEC 30、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| UI／SPEC Detail | Covered: 20 SCR、20 PRT、32 Interaction、30 BHVを全数処置し、Source Definition由来の既存検証目標へ具体的観測条件として統合した | [UI／SPEC DetailのQuality分析](Analysis/Detail/quality_analysis.md) |
| Quality Analysis | 前判断の7分析の限定レビュー済み結果は履歴。今回の登録解除・鍵受け渡し判断は12文書へ伝播済み・契約／品質限定独立レビュー済み・残指摘0 | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義・197 Local Itemを設計済み。局所接続・試験成功と正式義務評価を区別し、現行対象の全体成立数は再照合中 | 旧移管母集団13／46・33／46は履歴。初回実入口と人間確認は後続E2Eへ保持し、設計件数・Relation件数・履歴結果を現在Passへ変換しない |
| Architecture詳細設計 | 18領域を適用判定済み | 実装OwnerのないCapability、現実との不一致およびTest未接続をReality Auditで処置する |
| Checker | 参照Evidenceの固定候補に対する履歴 | 参照Evidenceの採取当時の固定Treeでは、差分由来のFinding 0、Warning 0だった。Error 1件は、v0.22作業HEADが公開済みv0.21.0 tagと一致しないFeature Branch上の既知状態であり、v0.22のRelease候補固定時に再評価する。実行ごとに変わるファイル、Markdown、LinkおよびAnchorの件数はこの現在投影へ複製せず、[Phase 5 純粋CSR Runtime閉包検証](../99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)が示す固定Treeから再現する。Verification RunnerはWorkbenchを含むOwner、実行Profileおよび結合経路を全数照合し、当時40 Pass・失敗0・条件付きSkip 1だった。現在への全体適用は再照合中である |
| Reality Audit | v0.21限定結果の履歴 — 現在全体への適用は再照合中 | skipのEvidence誤算入と実境界未観測を是正し、v0.21に残るHybrid 12件とManual 10件を未観測のまま固定した。最終署名E2Eは`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続し、残る義務を一括してPassへ変更していない。移管母集団46件の現在処置は算定Ownerへ接続する |

## 品質軸の履歴と現在適用

以下は参照Evidenceの採取当時の記録である。「現在候補」「未実施」「未収集」は当時版に限り、現在状態は冒頭のCurrent Quality Projectionと[算定Owner](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)を参照する。旧結果を現在全体のPassへ流用せず、現在への適用は再照合中として保持する。

| 軸 | 採取当時の状態（現在への適用は再照合中） | この状態から主張しないこと |
|---|---|---|
| Designed | Canonical | 実装済みまたは試験可能とは主張しない |
| Implemented | 部分照合 | 未実装CapabilityをRelation追加だけで成立へ変えない |
| Executed | v0.22現在候補の局所確認、Portable回帰および更新候補の三独立確認を実行済み／署名実境界は未完了 | Coordinator Portableは2,117件中2,112 Pass・明示Skip 5・Fail 0、Production Selection対象試験は35／35 Pass、Workbenchは21／21 Pass、Checkerは375／375 Pass。独立レビュー・文書監査・Gap影響監査はFinding 0。旧Manifest削除後に前提不成立となっていた署名拒否fixtureも現在のManifestでPassした。v0.21の署名Recovery Matrixと4経路E2Eは履歴Baselineであり、v0.22現在候補の成立根拠へ流用しない |
| Passed | 局所確認、Portable全体および更新候補の三独立確認はPass／Quality Readyは未成立 | 5件のSkipはHostまたは人間入力を必要とする明示的な条件付き実行である。Commit、再署名、署名拒否試験、直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2Eは未実施。履歴Baselineのv0.21 Source A、carrier BおよびRuntime Execution Identityをv0.22候補へ読み替えない |
| Evidence | 現在候補の局所確認とPortable回帰Evidenceを収集済み／Release Verification Evidenceは未収集 | [Phase 5 Workbench Production Selection契約](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md)に原因、要求契約の是正、局所反証およびPortable全回帰を保存した。[Phase 5 Workbench Repository結合とSelection更新](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md)以前は前候補の履歴であり、現在候補の全体Passへ流用しない |
| Reality Audit | Pending — 現在結果固定済み／残存Evidence待ち | v0.21履歴Baselineの最終署名結果だけを`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続した。v0.22現在候補は、再署名、署名候補の直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2EのEvidence待ちである。`RCM-ST-012`、`ERB-ST-009`、`ERB-ST-011`その他の未観測義務を、v0.21の4経路成功やDocker Engine利用可能という非発火からPassへ変更しない |

Coordinator／Orchestratorの17意味Pilotに加えて全Subsystemへ照合範囲を広げた。skip、fixture自己再現および外部実境界の自己申告を観測済みから除外し、v0.21対象では108件観測済み、22件未観測である。Quality Readyへ昇格せず、PT／LTは人間の明示許可がないため実行しない。

## 公開済みBaselineと参照

過去版の詳細な実行条件、結果、限界および改訂版は各Release／Change Evidenceを正本とし、本書へ複製しない。

| Baseline | 保持する要点 | 正本参照 |
|---|---|---|
| v0.20.1 | v0.20.0の公開状態伝播漏れを修正。Runtime実行集合はv0.20.0から変更していない | [CHG-000069](../99_Roadmap/Changes/CHG-000069/change.md) |
| v0.20.0 | 正式4経路4/4、Recovery Matrix 7/7、cleanup成立。Linux／macOSや任意規模・長時間負荷へ一般化しない | [v0.20.0固定結果](../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) |
| v0.19.0 | Orchestrator、取消、exact Recovery、fresh再入場の公開基準 | [v0.19.0最終署名E2E](../99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md) |
| v0.18.1 | Coordinator採用入口と署名Identityの公開基準 | [v0.18.1 Runtime Identity](../99_Roadmap/Releases/v0.18.1/Evidence/260901_coordinator-v0181-runtime-identity.md) |

公開前候補、不採用候補、是正往復および当時版の限定結果は、該当Change／ReleaseのEvidenceから確認する。Gitで再現できるInventoryや途中状態を、本書の永続的な第二正本にしない。

## 保持するリスクと追跡

- 配置漏れは、起動失敗だけでなく検査対象や署名対象からの脱落を起こし得る。
- 固定Evidence内の旧Pathを現在のSourceへ無条件に読み替えない。
- 実Provider、取消、Docker修復等で、fixtureや固定Workerだけでは証明できない範囲を隠さない。
- Quality設計の固定後も、実装・試験・Evidenceの現実照合が完了するまでQuality Readyとしない。

現在の方針は[品質方針](02_Quality_Strategy.md)、検証方法は[検証設計](03_Verification_Design.md)、全入力と検証項目の関係は[Quality Integration](04_Quality_Integration.md)、今後の照合方法は[現行実装との照合](05_Current_Implementation_Reality_Audit.md)を参照する。

## Checklist

- [x] 現在の品質状態と結論を履歴より先に示した
- [x] Canonical入力、検証目標およびLocal Itemの現在数を説明できる
- [x] 既存Canonical入力CoverageとUI／SPEC Detail由来の具体的観測条件を区別して全数接続した
- [x] Designed、Implemented、Executed、PassedおよびEvidenceの状態を区別した
- [x] 未成立、停止、要再確認および観測不能を正常へ畳んでいない
- [x] Quality ReadyとReality Audit開始条件を過大表示していない
- [x] 重大な問題、残存Riskおよび人間判断の必要性を評価した
- [x] 現在状態から分析、定義、実行結果およびEvidenceへ辿れる
- [x] 過去版の詳細を第二の現在正本として複製していない
