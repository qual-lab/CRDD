# CRDD内部ツールの品質の現在状態

状態: Quality Design In Progress — Latest Contract Propagation
担当責任者: Qual-Lab
最終更新日: 2026-10-13

最新の局所結果：通常鍵発行・独立失効の保存接続をRFD-IT-017／018の局所断面で確認した。局所9件、修正後AM全105件／MCP全75件・両静的3軸成功、固定11Pathの限定再レビュー残指摘0。初回履歴attempt衝突の認証前拒否、操作別Secret型のcompile反証、容量・生成・保存・清掃故障、exact失効と遅延提示、三競合を照合した。専用非秘密Reader・交換・Workbench実提示／本番接続・実Host／Linux・旧REST撤去・正式191項目・AM全体は未成立／Not Run。前段の間欠競合原因未解消を保持し、最新105件成功から解消とは推定しない。[対象範囲](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#通常鍵管理の保存接続の着手前確認--2026-10-13)を参照する。MCP回帰の旧REST／Shared比較を本番代替完成へ流用しない。以下は先行段階の局所結果であり、AM全体Passへ流用しない。

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

鍵の期限なし方針は設計・品質へ伝播した候補。QA-000007のRFD-ST-003／RFD-IT-013／RFD-UAT-007で、時間経過、明示失効・交換、現在権限変更、利用者理解を分離して確認する。全13定義190項目は不変、更新項目はNot Run。保存・本番資格接続・実行・新Evidenceは未完了であり、今回の伝播を実行Passへ昇格しない。

初回設定の実装接続は、UT023とIT024相関・User・初回資格保存部分のSource／Test Symbol・候補局所実行が接続済み。正式Local Item／Evidence評価はNot Run。IT024のHost提示／初回限定接続／次要求の通常認証／本番Host部分とIT025／ST026／UAT027、Root準備・旧入力本番観測・本番認証ConsumerはOPENであり、部分成功を初回全体完成へ流用しない。資格→User→現在Roleの認証主体局所解決（IT013前半）とIT024の初回非更新は候補接続済み。Exposure・実アクセス・Domain搬送はOPEN。

| 項目 | 現在値 | 根拠・次の処置 |
|---|---|---|
| 全体状態 | Quality Design In Progress — Latest Contract Propagation | 最新契約の設計対応と実行成立を区別し、Quality Readyへ昇格しない |
| 現在対象 | v0.22.0 | Project Operation、Workbench、CROS、複数Repository、AI Runtimeを段階的に照合する |
| 観測済み | 13 / 46 | v0.21からの移管母集団に対する進捗。既観測12件にShared Gateway非開示境界の`RFD-ST-004`を追加した。[新しい根拠と限界](../99_Roadmap/Changes/CHG-000082/Evidence/261002_shared-gateway-non-disclosure.md) |
| 未観測 | 33 / 46 | 同じ移管母集団の未観測。移管一覧を採用済みRelease Scopeと同一視せず、Trust項目の対応を再照合する。Native局所試験だけで024〜030を観測済みにしない |
| 既知Gap | ②と全体品質の未完了を分離 | 現候補の署名・production初期化2件、全Portable収集と失敗六件の限定是正後35件を確認した。PRL-IT-005／012は一部観測で、全義務Passへ増算しない。Workbench／必要なE2Eと全項目のEvidence適用は未完了。[最新の照合](../99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md) |
| 次Gate | 全製品E2Eと残る品質義務を別に確認する | ②の保存方式刷新は最終独立確認Passで完了。全Portable収集と是正後35件を別集合で保持し、全体Quality Readyにはしない。[②の完了根拠](../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定) |
| 現在人間判断 | なし（件数予算改訂を承認済み） | 秘密入力が必要な署名は外部対話端末で依頼する。署名操作の承認からRelease、未観測義務の免除または新Provider送信を推定しない。 |

## 設計集合

2026-10-07の現行Semantic集合は17意味、実装Relationあり17・自動Test Relationあり16・手動確認待ち1である。独立Trust Policy起動接続は将来範囲のため現行Requiredから除去した。実装追加によるMissing解消ではなく、実行・Evidence全体Passも主張しない。

過去の2026-10-06の現物再集計は13定義・176項目、試験Relationあり132項目・なし44項目、Symbol616件（ID重複0、未定義Local Item参照0）である。Semantic Coverageを再生成し、18意味のうち16は実装・自動試験の両Relation、1は実装・試験未観測、1は手動確認待ちとなった。いずれもRelationの数字であり、実行や品質項目の全体Pass件数ではない。[再集計と適用範囲](../99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md)を参照する。

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 167 |
| Quality検証目標 | 13 |
| Local Item数 | 191 |

## 結論

Quality設計は13定義、190 Local Item。2026-10-11に各定義の検証項目IDを定義内で重複排除して再集計し、旧185件＋初回設定5件と確認した。設計件数は実行／Pass件数ではない。移管一覧の一意集合46件のうち、既観測12件に`RFD-ST-004`の公開Gateway非開示根拠を加えて13件を観測済み、33件を未観測とする。全体の旧投影119件観測済み・57件未観測と、そのRelation別内訳には表示不整合が見つかったため、**現在の全体集計は再照合中（OPEN）**である。v0.21の固定Baseline108／130と22未観測は履歴として維持する。108＋13＝121は算定候補であり、現在のRelation別Evidence適用を証明した全体件数とは表示しない。設計集合・過去結果は削除せず、[算定Owner](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)へ戻して再照合する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 41、UX 35、IA 23、UI 20、SPEC 30、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| UI／SPEC Detail | Covered: 20 SCR、20 PRT、32 Interaction、30 BHVを全数処置し、Source Definition由来の既存検証目標へ具体的観測条件として統合した | [UI／SPEC DetailのQuality分析](Analysis/Detail/quality_analysis.md) |
| Quality Analysis | 前判断の7分析の限定レビュー済み結果は履歴。今回の登録解除・鍵受け渡し判断は12文書へ伝播済み・契約／品質限定独立レビュー済み・残指摘0 | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義、190 Local Itemを設計済み。通常管理3件の前判断に対する限定レビュー結果は履歴。今回の初回5項目・EST-ST-015更新はNot Run、定義接続は契約・品質の限定独立レビュー済み・残指摘0 | 移管母集団は13／46観測済み、33／46未観測。全体の現在件数とRelation別Evidence適用は再照合中。設計件数、Relation件数、履歴結果と現在成立を混在させない |
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
