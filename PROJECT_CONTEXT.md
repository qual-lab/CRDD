# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

第二段階は[Package別の責務再編計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)の1〜8を進行中。Version Controlの公開入口・既知Consumerは47件、Domain Modelの保存・通常公開CRUD・協調Writer競合は113件、Execution Intelligenceの記録と提案判断の分離は82件、AI Adapterは29件のPackage回帰と限定独立レビューまで確認した。Coordinator配布試験の移管追従は133件成功したが、全Package完成ではない。Platform Accessの対象観測分離は通常回帰50件と限定独立レビューで確認した（専用実OS等23件は未実行）。MCPの活動・Profile管理は局所接続と全56件まで確認済み。人間がCROS Package維持判断を変更したため、次は認証・認可をAccess Managementへ、Context集約等を実Ownerへ分ける設計・移管を先行する。専用REST／Gateway／Shared Host廃止は代替本番接続後、Docker／Coordinator／Orchestrator大改修はその後へ置く。これはv0.22全体の完成・Release可能を意味しない。

v0.21.0は公開済み、v0.22.0とCHG-000082は未完了である。責務再編の段階1〜4、5AのDomain Model統合、5BのAI Adapter／Platform Access移管は局所確認まで完了した。5CのOrchestrator／Coordinator／Docker追加是正は、大規模改修で実装が変わる見込みから、人間承認により持ち越した。

| 範囲 | 現在状態 | Owner Relation |
|---|---|---|
| 公開Baseline | v0.21.0、Commit `e9947d4f733c3c46b90ee9f78c70898d1920bae9` | Git tag `v0.21.0` |
| 責務再編 | 1〜4と5A／5Bは局所完了。5Cは部分接続・追加是正持ち越し。5D〜F、全親フォルダのFile責務精査、6〜8は未完了。 | [現在の計画](99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md#持ち越しの処置--2026-10-09) |
| 5Cの確認済み範囲 | 同Process配送、新Process受領・終了、保存途中再入場、履歴相関が残る整理後再入場の局所試験・限定独立レビュー。実資源回復・全体E2E成立ではない。 | [局所結果](99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md#新processの再開接続の順序--2026-10-09) |
| Productの既存成果 | Project Context、Topic／Meeting、CROS、Workbench、Git操作、AI接続の成立済み範囲と対象版を保持。旧版の結果を最新Treeの完成証明へ流用しない。 | [能力・未成立一覧](99_Roadmap/Changes/CHG-000082/change.md) |
| 保存整理 | ②の保存方式刷新、③のExecution Intelligence刷新は各記録の限定範囲で完了。 | [②](99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定)、[③](99_Roadmap/Changes/CHG-000082/Evidence/261006_execution-intelligence-phase3.md#③の完了判定--2026-10-06) |
| 一時物・Evidence整理 | 正式要約へ集約し、旧生成物を限定清掃した。全実行結果の書庫を増やさない。 | [集約記録](99_Roadmap/Changes/CHG-000082/Evidence/261006_release-test-retention-phase4.md) |

## 2. 何が危ない、または止まっているか

### 結論

日程リスク: 目標Release日2026-10-03は経過しており、Release完了は未成立。持ち越しは検証免除やリスク受容ではない。新しい版・期限・Release範囲は今回設定していない。

| 種別 | 残件・影響 | Owner Relation |
|---|---|---|
| 現在事実 | 履歴保持期間後の相関欠測、下位出版後marker残存、実資源回復の旧入口切替、本番利用側の一体接続は未完了。旧二試験Fileの型指摘18件も保持する。 | [持ち越し残件](99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md#持ち越しの処置--2026-10-09) |
| 現在事実 | 全体回帰・Reality Audit・固定全Sourceレビュー・最新候補の署名実E2Eは未完了。局所成功からQuality ReadyやRelease可能を推定しない。 | [CHG](99_Roadmap/Changes/CHG-000082/change.md)、[Quality Center](07_Quality/01_Quality_Center.md) |
| 現在事実 | Profile管理・Runtime活動のMCP Adapterは局所接続済みだが、公開Launcher・Workbench本番接続は未成立。Access Management再編の正式Architecture反映・移管も未完了。Domain保存の非協調Processによる親Directory差替え保証は未決である。 | [新Owner計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#11-access-managementへの再編--2026-10-09の途中見直し)、[保存保証の未決判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#保存保証の未決判断) |
| 履歴事実 | 2026-10-06のReality Auditは13QA・176項目、Test Relationあり132・なし44、Symbol616。2026-10-07の採用範囲照合は17意味、実装Relation17・自動Test Relation16・手動確認待ち1。現在Treeの再実行値でも品質Pass数でもない。 | [対象版と限界](99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md)、[採用範囲照合](99_Roadmap/Changes/CHG-000082/change.md) |
| 共有分析 | 大規模改修前に5Cを積み増すと再実装・再検証負担が増えるため、確認済み結果と反例を改修入力にする。未成立を消さない。 | [持ち越し判断](99_Roadmap/Changes/CHG-000082/change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |

## 3. 今、人間が決めることは何か

### AM初回相関保存の局所接続 — 2026-10-12

初回の元試行保存を既存Root・Lockへ接続し、排他的作成・読戻し・同元試行再入場・部分書込み保持・二Process競合を局所確認した。AM全23 Case・静的3軸成功、限定独立再レビューPass・残指摘0。Root準備・User生成・鍵・配送・本番Host入口は未接続であり、初回全体完成ではない。

### AMのWindows追加保護を対象外化 — 2026-10-12

管理状態の純粋Schema検査を実装し、RFD-UT-028・Source／Test Symbol・試験台帳へ接続した。AM Packageは静的3軸と全11 Case成功（新4 Case）。限定独立再レビューはPass・残指摘0。Quality設計集合は191項目、正式評価はNot Run。保存Adapter・鍵実処置・認可・本番Consumerは未接続で、実Host Storeは変更していない。全体Checkerは未合格であり、この局所結果を全体完成へ読み替えない。

通常保存Adapterの局所接続を完了した。既存Root・Lock下でcurrent／pending／短命replaceを照合し、通常更新と出版前後の再入場を確認した。静的3軸・AM全19 Case成功、限定独立再レビューPass・残指摘0。これは前段の結果で、新履歴・Receipt・回復Frameworkは追加しない。現在は初回相関出版も局所接続し、Root準備・User／鍵の後続段階・認証・本番Consumerが残る。詳細は[計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#am通常保存adapterの局所接続--2026-10-12)を参照する。

保存項目・容量・初回／鍵保存順序を[AM保存契約§4.5](06_Architecture/Details/access-management/02_Management_State_and_API.md#45-現在状態容量鍵保存の固定方針--2026-10-12)へ具体化した。内容範囲はDevelopment／Managementに限定し操作別認可は追加しない。current 16 MiB／pending 17 MiBは実装割当上限で、利用規模保証ではない。本段落の契約・品質・直接影響の限定独立再レビューPassは契約固定時点の結果である。その後のSchema・通常保存Adapterの局所接続は上段を参照し、初回／鍵実処置・認可・本番接続は現在も残る。実Host Storeは変更していない。

人間判断により、Access Management専用のWindows追加ACL検査・修復・Native保護接続は実装条件から外した。[要求正本](01_Discovery/Definitions/REQ-000041/requirement.md#windows固有の追加保護の対象外化--2026-10-12)を参照する。既存Hostのアクセス制御を利用し、追加保護の成立は主張しない。Root検査・秘密非保存／非公開・現在認可は維持し、他Packageの保護は不変更。5文書の直接伝播は限定独立再レビューPass・全重大度の残指摘0。実Root・ACL・Sourceは未変更。以下のWindows保護接続待ちは判断前の履歴であり、現在の残件は完全Schema・容量・初回／鍵段階・本番接続である。

### Access Managementの保存保証 — 2026-10-12

保存データ・初回Root・鍵照合・整理単位を[具体化候補](06_Architecture/Details/access-management/02_Management_State_and_API.md#44-保存データと整理単位の具体化候補--2026-10-12)へまとめた。前段固定4文書の契約・品質限定独立レビューは両方Pass・全重大度の残指摘0。改訂File積算・一般履歴・新Frameworkは追加しない。完全Schema、容量、初回／鍵段階と実装は未成立である。Windows追加保護の接続は上記判断により残件から除いた。

通常保存・読戻し確認までを人間が採用し、電源断で直前更新が失われ旧鍵・旧権限が再受理され得るリスクを受容した。[要求正本](01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)を参照する。通常失効・現在認可・破損拒否は維持し、電源断専用の回復機構は追加しない。前段6文書の直接伝播は契約・品質の限定独立再レビューが両方Pass・全重大度の残指摘0。Source・実Storeは未変更で、Schema・秘密非保存／非公開のSource接続・容量・初回Root・鍵段階・本番接続は未成立。現在、この保証範囲について追加の人間判断は不要。

### Access Managementの保存保証 — 2026-10-11

以下は採用前の履歴である。保証範囲の人間判断待ちは上記2026-10-12の採用により解消した。

単一現在File・短命pending・既存排他による保存と再入場を[設計候補](06_Architecture/Details/access-management/02_Management_State_and_API.md#43-保存途中の再入場候補--2026-10-11)へ具体化した。通常保存で未出版／出版済み／不明を分離し、初回・鍵処置へ自動回収を一般化しない。4文書の契約・品質限定再レビューは両方Pass・全重大度の残指摘0、Source・秘密Storeへの操作なし。電源断直前更新の喪失で旧鍵や旧アクセス権が再び受理される可能性は未実測・未解決で、通常の読戻しでは除外できない。弱い保証での採用推奨は撤回した。人間が決めるのは鍵／認可の電源断後の安全再開について、要求する保証範囲と残存リスクである。既存の改訂積算を継承せず、追加Lock Frameworkを作らない。通常6操作候補の採用を鍵段階の安全性承認にせず、Schema・保護・容量・初回Rootと鍵段階・本番接続のGateは維持する。

### 鍵の期限なしの伝播 — 2026-10-11

採用済み期限なし方針をUX／IA／UI／SPEC／Architectureの状態・未確認表示とQualityへ伝播した候補。時間だけ経過、明示失効・交換、現在権限変更を既存3品質項目へ分けて接続し、190項目・Not Runを維持する。契約・品質の限定独立再レビューは両方Pass、全重大度の残指摘0。資格期限は未決でなく、以下の旧回答待ち表示は採用前の履歴である。保存・発行・配送・Host入口・本番接続・新版実行は未完了で、追加の人間判断は今回不要。[現在計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#鍵の期限なしの設計品質伝播--2026-10-11)を参照する。

### 鍵の有効期限 — 2026-10-11

期限なしを人間が採用した。明示的に失効・交換するまで有効で、自動期限切れは設けない。現在認可と鍵操作の担当は不変更。期限方針の回答待ちは解消したが、以下の各段階にある回答待ち記述は採用前の履歴である。要求・探索履歴・計画への反映は限定独立再レビュー済み・全重大度の残指摘0、UX／SPEC／Architecture／Qualityへの伝播とSource実装は未完了。保存Gateは引き続き未成立。[要求の正本](01_Discovery/Definitions/REQ-000041/requirement.md#要求)を参照する。

### 初回Host状態の純粋判定 — 2026-10-11

四状態と明示開始だけを評価するAM純粋関数とUTを追加し、静的確認と7 UTは成功。固定15Fileの契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。保存・鍵発行・Host入口は未接続で、局所成功を初回設定完成へ流用しない。追加人間判断はこの純粋判定には不要。資格期限と保存Gateの未確定を維持する。[今回の範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#初回host状態の純粋判定実装--2026-10-11)を参照する。

### 初回Host設定の要求反映 — 2026-10-11

初回Host設定をArchitecture横断01〜08とWorkbench／MCP詳細へ候補伝播済み。計画・現在投影を含む固定12文書の統合4原因を是正し、契約・品質の限定独立再レビューは両方Pass・全重大度の残指摘0。参照254件欠落0、非対象79行不変、差分確認成功。Host明示開始、Workbenchは案内のみ、MCPは初期化・状態照会とも非公開を揃える。新API・Store・Framework・Sourceは追加しない。Quality・保存方式採用・本番接続・実E2E・全体Readyは未完了。前段の限定Passは現在候補の完成証明ではない。

初回Host設定をARCH-000013とAM詳細01・02へ設計候補反映済み。計画・現在投影を含む5文書で今回の契約・品質限定独立レビュー済み・全重大度の残指摘0。状態遷移・処理順・内部操作候補を具体化し、通常Host回復2操作と分離する。新Store・Framework・Sourceは追加していない。横断・Workbench／MCP詳細・Quality・Source・保存方式採用・本番接続・実E2Eは未完了。

初回Host設定のArchitecture入力分析はUI-000008／SPEC-000012から独立に更新済み。対象は両分析・計画・現在投影の4文書で、契約・品質の限定独立レビュー済み・全重大度の残指摘0。参照61件欠落0・差分確認成功。通常Host回復と初回を分離し、開始条件・個別事実・元試行相関・不明時の戻り先を既存ARCH-000013へ渡す。基本設計・AM詳細への伝播は上記候補で確認し、横断・Surface・Quality以降の未追従を維持する。保存Schema・API・Source・新IDは変更していない。

初回Host設定のUI／SPEC分析・定義・対応投影を14文書へ反映し、契約／品質限定独立再レビューは全重大度の残指摘0。承認済み最小構成と4状態、途中結果、既存鍵交換との分離を保持する。Detailは既存SCR-000008／BHV-000012と横断投影へ反映し、契約／品質限定独立再レビュー済み・全重大度の残指摘0。次はArchitecture／Quality／Sourceへの伝播で、実画面・実E2Eは未成立。追加の人間判断はなく、資格期限は回答待ちを維持する。

初回レビューの4原因と書式1原因を是正し、中断していた独立再レビューを再開・完了した。参照761件欠落0・過去対応区画不変・差分確認成功。実装・正式QA・実E2E・全体完成は未主張。

初回設定のIA伝播は、確定UX-000035から分析・IA-000009・横断4文書・計画・現在投影の8文書へ反映済み。初回の状態と確認済み試行相関を既存管理能力の属性へ置き、成立したユーザー・資格に結ぶ。新IA ID・Object・回復機構は追加しない。契約／品質の限定独立再レビューは全重大度の残指摘0、ローカル参照168件欠落0、差分確認成功。UI／SPEC以降・Sourceは未完了で、次はUI／SPECへの伝播である。

初回設定はREQ-000041からUX-000035の開始場面へ限定伝播し、UX分析・定義・横断5文書と計画・現在投影の9文書は契約／品質の限定独立再レビュー済み・全重大度の残指摘0。新UX IDは追加せず、通常Host回復の交換2操作と分離した。参照先360件欠落0、差分確認成功。IA以降・具体保存・Sourceは未完了で、前段レビューを今回の完成証明にしない。次はIAへの伝播である。

最小の初回設定は人間承認済みで、要求正本と判断履歴へ反映し、契約・品質の限定独立再レビューは全重大度の残指摘0。Hostの明示操作で管理用表示名を入力し、最初のadministrator UUIDを作成して、そのユーザーの鍵を一度表示する。未初期化を確定できる場合だけ実行し、既存状態・途中失敗・破損・観測不能を再初期化へ畳まない。通常Host回復は既存ユーザーの交換2操作のまま維持する。今回、追加の人間判断は不要。UX→IA→UI／SPEC→Architecture／Details→Quality→Sourceの伝播、具体保存・入口・実境界は未完了で、資格期限は引き続き回答待ち。[要求の正本](01_Discovery/Definitions/REQ-000041/requirement.md#初回cros設定)を参照する。

### AM固定管理判定の実装 — 2026-10-11

新Access Management Packageに、保存・資格・Host操作を持たない固定管理判定を実装した。三Roleと10具体操作、操作別Role対象、未知入力の拒否を公開Root経由の4 UTで確認し、format・type・lintは成功。契約・品質の限定独立再レビューは全重大度の残指摘0。候補試験の局所成功であり、正式Local Item結果／Evidence評価はNot Run。旧CROS代替・管理API・保存・本番接続の完成ではない。初回Host設定の最小管理者作成は人間承認済みで、要求正本・判断履歴へ反映し、契約・品質の限定独立再レビューは残指摘0。UX以降の伝播と実装は次の残件。資格期限は回答待ちを維持する。[範囲と結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#am固定管理判定の局所実装--2026-10-11)を参照する。

### AM公開読取りの具体化 — 2026-10-11

自己表示と管理対象別の投影を分け、管理能力と内容閲覧、登録と公開を混同しない候補Schemaを具体化した。取得不可・回収確認待ち・観測不明・解放不明を空集合と区別し、解放不明時のSnapshotは公開しない。操作候補の対象制約を是正し、契約・品質の限定再レビューは残指摘0。Source・秘密Storeは未変更、本番完成ではない。追加の人間判断はこの具体化には不要。資格期限は回答待ちを維持する。[候補と未完了範囲](06_Architecture/Details/access-management/02_Management_State_and_API.md#31-公開読取りの結果と情報境界)を参照する。

### AMの並行保存・読取りの反証 — 2026-10-11

現在のPCで、競合拒否・古改訂のwrite 0と、保存前後のProcess終了後に既存Lockを回収して次更新できる範囲を局所確認した。並行Readerでは置換EPERMを2回観測し、Readerも同じ既存Lockへ揃える対照では100置換が完了した。Lock競合時の取得不可・回収確認待ちは別に保持する。契約・品質の限定独立レビュー・是正後再確認は残指摘0、probeの物理残存も回収済み。これは本番保存・公開readの完成ではなく、Source・秘密Storeは未変更。追加の人間判断はこの局所確認には不要、鍵期限は引き続き回答待ち。[観測と未確認範囲](06_Architecture/Details/access-management/02_Management_State_and_API.md#42-競合process終了並行読取りの局所確認--2026-10-11)を参照する。

### AM保存方式の局所確認 — 2026-10-11

既存の排他部品は条件付きで再利用できる。現在のPC（Windows 10.0.26200.0・C: NTFS・Node v24.19.0）で通常置換・読戻し100回は一致した。前段§4.1の単独確認時点では初回Root準備・競合・Process喪失・他Windows版／Filesystem・Linux・再入場は未確認だった。追加局所結果は直前節に示し、本番接続の未確認は維持する。保存専用Directoryを追加せず、現在状態・短命pending・Lockを既存Host state Root直下へ置く候補を具体化し、前段の契約・品質限定独立レビュー・是正後再確認は残指摘0。Source・秘密Storeは未変更、実装Gateは未成立。鍵の有効期限は運用判断を確認中で、未回答を採用にしない。[調査範囲と限界](06_Architecture/Details/access-management/02_Management_State_and_API.md#41-既存保存部品の照合結果--2026-10-11)を参照する。

### 登録解除・鍵受け渡しのQuality伝播 — 2026-10-11

Architectureの限定伝播・独立レビューに続き、最新の登録解除・鍵3分岐をQualityの12文書へ伝播済み。既存項目の観測・Oracle・終了後条件を具体化し、185 Local Itemを維持する。今回更新項目はNot Run、契約・品質の限定独立レビュー・是正後再確認とも残指摘0。Source・Test・新Evidence・物理保存・本番接続は未完了。現在、追加の人間判断は不要。[今回の範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#登録解除鍵受け渡し判断のquality全伝播--2026-10-11)を参照する。

### 登録解除・鍵受け渡しの設計伝播 — 2026-10-11

UI／SPEC定義14文書とDetail・現在投影15文書、AM詳細02の旧OPEN更新3文書は限定独立レビュー済み。現在は同じ登録解除・鍵受け渡し判断をArchitectureの入力分析・定義・横断モデル・利用側詳細まで16文書へ伝播した候補で、契約・品質の限定独立レビュー済み・残指摘0。Qualityは今回12文書へ伝播済み・契約／品質限定独立レビュー済み・残指摘0、Sourceは未追従。追加の人間判断は現在不要。保存方式・排他・公開Schema・具体配送観測・保持清掃・本番接続は未完了である。[現在の作業範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#登録解除鍵受け渡し判断のarchitecture全伝播--2026-10-11)を参照する。

### 権限分担の最新判断 — 2026-10-11

上流3文書への反映は限定独立契約レビュー済み・残指摘0。下流設計・QA・実装の成立を示す結果ではない。

managerとadministratorがユーザー登録・表示名変更、developer／managerの割当て・詳細権限設定、Repository登録・登録解除・公開範囲を管理する。管理者資格の付与・解除・変更、administratorの詳細権限、鍵3操作はadministratorだけが管理する。manager自身の内容範囲変更は明示設定で可能だが、管理能力から内容を自動付与しない。登録だけでは公開されず、登録解除はProduct Data削除ではない。

担当Roleの追加判断は不要となった。上流反映に続いて、REQ-000041のUX分析・UX-000035・横断5文書へ限定伝播し、限定独立レビュー済み・残指摘0である。続いてIA分析・IA-000009・横断4文書へ限定伝播し、限定独立レビュー済み・残指摘0。UI／SPECの定義・分析・横断投影12文書へ限定伝播し、限定独立レビュー済み・残指摘0。UI／SPEC詳細7文書も契約・品質の限定独立レビュー済み・残指摘0。Architecture入力分析2件は契約・品質の限定独立レビュー済み・残指摘0。ARCH-000013・横断01〜08の9設計文書は契約・品質の限定独立レビュー済み・残指摘0。AM／Workbench／MCP詳細3文書へ候補伝播・契約／品質の限定独立レビュー済み・残指摘0。Qualityの12文書へ最新分担を候補伝播し、契約・品質限定独立レビュー済み・残指摘0。通常管理のUT／IT／STの3項目追加とUAT／搬送同値更新はNot Run。固定管理判定だけSource／Test Symbolへ局所接続済みで、他Source／正式Evidence／本番接続は未追従。以前の限定レビュー結果は前判断の履歴であり、最新判断のPassではない。具体API・保存・初回設定・本番接続の未完了は維持する。正本は[REQ-000041](01_Discovery/Definitions/REQ-000041/requirement.md#要求)、追跡は[Architecture入力分析伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#architecture-role-analysis-propagation)、[UI／SPEC詳細伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#ui-spec-role-detail-propagation)、[UI／SPEC定義伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#ui-spec-role-propagation)、[IA伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のia伝播--2026-10-11)と[UX伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のux伝播--2026-10-11)を参照する。

### 結論

持ち越し記録について追加判断は不要。CROS Package維持の先の判断は人間が変更し、認証・認可をAccess Managementへ再編する方向となった。Context集約・接続Registry・活動等の具体OwnerはSource照合後にArchitecture／Qualityへ反映する。未決候補を採用済み実装と扱わない。Domain保存で、非協調Processの親Directory差替えまで防ぐ保証を要求するかは判断待ちである。通常保存＋読戻し、静的link拒否と協調Writer競合は確認済みだが、競合差替え防止の証明ではない。担当責任者・採用判断者はQual-Lab。Docker／Coordinator／Orchestrator大改修は前倒ししない。

ユーザーID（UUID）・管理用表示名・RoleとCredential紐付けの最小管理、鍵交換2操作は採用済み。2026-10-10の鍵管理境界に対する前判断は、上流・UX・IA・UI／SPEC・Architectureの限定独立レビュー済み・残指摘0として履歴を保持する。これは2026-10-11の担当Role分担の確認結果ではない。最新分担はUXの限定再レビュー済み・残指摘0。IA6文書へ伝播し限定独立レビュー済み・残指摘0で、UI／SPEC定義・対応は限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC詳細は伝播・限定独立レビュー済み・残指摘0。Architecture契約の限定伝播・レビューは済み。Qualityは12文書へ候補伝播・限定独立レビュー済み・残指摘0。固定管理判定Source／Test Symbolと候補局所実行を除き、具体API・保存・正式Quality実行／Evidence・他Source／Test・本番接続は未完了。詳細は[実施計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)を参照する。

| 判断項目 | 現在の処置 | Owner Relation |
|---|---|---|
| 接続主体・Role・Credentialの再編 | 担当RoleをREQ-000041で採用済み。UX7成果物へ限定伝播・限定独立レビュー済み・残指摘0。IA6文書へ限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC定義・対応は限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC詳細は伝播・限定独立レビュー済み・残指摘0。Architecture契約の限定伝播・レビューは済み。Qualityは12文書へ候補伝播・限定独立レビュー済み・残指摘0。固定管理判定だけSource／Test Symbolへ局所接続済みで、他Source／正式Evidence／本番接続は未伝播。以前の限定レビューは前判断の履歴であり、最新分担のPassではない。具体API・保存・受領方式・本番接続も未完了。 | [最新判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#業務管理と管理者資格鍵の分担--2026-10-11)、[UX伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のux伝播--2026-10-11) |
| CROS Packageの責務再編 | 移管対応表の限定レビューは前判断の履歴。Access Management詳細は最新鍵管理判断の限定独立レビュー済み・残指摘0。保存・権限語彙・公開入口はOPEN。Domain集約・MCP／Workbenchの境界は新Details候補へ限定再伝播・契約／品質独立レビュー済み・残指摘0。具体API・保存・受領方式、QA、Source移管・本番接続・旧撤去は未完了。 | [Access Management詳細](06_Architecture/Details/access-management/01_Architecture.md)、[移管対応表](99_Roadmap/Changes/CHG-000082/source-owner-map.md) |
| 非協調Processの親Directory差替え保証 | 必要範囲を確認中。未回答を高い保証の採用や免除へ読み替えず、独立した接続整理を継続する。 | [保存保証の未決判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#保存保証の未決判断) |
| 5C追加是正の持ち越し | 承認済み。保証条件変更・Release範囲変更の承認ではない。 | [判断の正本](99_Roadmap/Changes/CHG-000082/change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |
| 履歴相関を必須としない配送終了案 | 未採用・未実装のまま改修入力へ持ち越す。 | [未採用候補](99_Roadmap/Changes/CHG-000082/change.md) |
| Repository IDの正式固定 | 暫定値を維持。契約固定時に人間が判断する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

MCP詳細の最新判断伝播は契約・品質の限定独立再レビュー済み・残指摘0である。旧非秘密の鍵管理Tool候補を撤回し、MCP要求認証の継続と鍵管理非公開を分離した。Access Managementの現在認可とDomain Modelの認可済み集約へOwnerを分けた。Workbenchと旧CROS比較詳細は直接参照と近傍の鍵境界だけを同期した。Workbench／Domainの新Owner境界はDetails候補へ限定再伝播・契約／品質独立レビュー済み・残指摘0。具体API・保存・受領方式、Quality、Source・本番接続は未完了。Checker全体は既知3,056件で未通過。詳細は[今回の処置](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#最新鍵管理判断のmcp詳細再伝播--2026-10-11)を参照する。

### 鍵管理についての最新判断 — 2026-10-10

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常入口は同一Process Workbench、Host回復はログイン済みローカル操作者の対話CLIで追加認証なし。対象・影響表示と既存確認は維持する。鍵操作はSecret有無にかかわらずMCPへ公開しない。発行権限OFFの仮説について追加判断は不要となった。他管理群の担当Roleも2026-10-11に採用済みであり、下流伝播は未完了である。

2026-10-10の鍵管理境界について、要求・基本定義・AM詳細・判断履歴、UXからArchitectureまでの限定伝播と独立レビュー結果は前判断の履歴として保持する。2026-10-11の担当Role分担はUXの限定再レビュー済み・残指摘0。IAは限定伝播・限定独立レビュー済み・残指摘0で、UI／SPEC定義・対応は限定確認済み、詳細は伝播・限定独立レビュー済み・残指摘0。Architecture入力分析2件は契約・品質の限定独立レビュー済み・残指摘0。ARCH-000013・横断01〜08は契約・品質の限定独立レビュー済み・残指摘0。AM／Workbench／MCP詳細3文書へ候補伝播・契約／品質の限定独立レビュー済み・残指摘0。Qualityへ最新分担を候補伝播・限定独立レビュー済み・残指摘0。固定管理判定だけSource／Test Symbolへ局所接続済み。具体API・保存・受領方式、正式Quality／Evidence・他Source／Test・本番公開入口・実境界は未完了であり、旧限定結果から最新判断や全体完成を主張しない。

## 4. なぜこの状態・判断になったか

以下の初回設計伝播時点の「他初回4項目未接続」は履歴である。現在はUT023とIT024相関保存部分が候補接続済み。IT024のUser／鍵／配送／本番Host部分、IT025／ST026／UAT027はOPEN、正式項目評価はNot Runを維持する。

### 結論

現在のRecoveryをさらに完成させる前に大規模改修が見込まれるため、追加是正を保留した。Docker隔離と使い捨て・最小管理の方針を保持し、新しい共有State・Registry・Lockや汎用Recoveryは追加しない。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| 5Cの追加是正を持ち越す | 大規模改修前の積み増しによる再実装・再検証を避け、未成立を改修入力として保持する。 | [CHGの現在判断](99_Roadmap/Changes/CHG-000082/change.md) |
| Project Contextは現在投影とする | 五場面を共通形式で提供し、Topic／Meeting・Roadmap・Quality等の詳細は各Ownerが所有する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

### 最新権限分担のQuality再導出 — 2026-10-11

最新の追加判断：登録解除は公開設定も同時に除去し、Repository本体は維持する。発行・結果記録確定後の鍵の受け渡し未確認は、秘密再表示・自動再発行をせず、人間の明示した既存交換で別鍵へ交換する。発行自体・結果記録が不明なら元発行のIdentityと既知事実で現在再観測し、交換由来は元exact Recoveryを保持する。[要求正本](01_Discovery/Definitions/REQ-000041/requirement.md#発行済みの鍵を受け取れなかった場合)に続きUX7文書・IA6文書へ伝播し、それぞれ契約／品質限定独立レビュー・是正後再レビューは残指摘0。UI7文書・SPEC5文書へ追加判断を伝播し、契約／品質限定独立再レビューは残指摘0。Detail10文書へ追加判断を伝播中・今回の契約／品質限定独立再レビュー済み（残指摘0）。Architectureは今回16文書へ候補伝播・契約・品質の限定独立レビュー済み・残指摘0。Qualityは今回12文書へ伝播済み・契約／品質限定独立レビュー済み・残指摘0。Sourceは未追従。Source・実環境は未変更。

現在の[管理API・保存設計候補](06_Architecture/Details/access-management/02_Management_State_and_API.md)は登録解除・鍵受け渡しの旧OPEN更新まで契約／品質限定独立レビュー済み、残指摘0。Architecture全伝播候補は契約・品質の限定独立レビュー済み・残指摘0、QAへの追加判断伝播は12文書の限定独立レビュー済み・残指摘0。Sourceへの伝播は未完了。単一現在Fileは第一候補で、排他・出版保証と同一更新の実現方法は未確定のため実装Gate未成立。保存・秘密Store・Dockerは未変更。固定管理判定だけ新Sourceへ局所接続した。

固定8操作の管理判定、通常6操作の保存境界、公開縦断をRFD-UT-020／IT-021／ST-022へ分離し、UAT-007とEST-IT-010を更新した。設計集合は185 Local Item。最新12文書は契約・品質限定独立レビュー済み・残指摘0、今回の新規・更新項目はNot Run。MCPの通常管理Toolを新規採用せず、Profile管理Roleは別途OPEN。固定管理判定Source／Test Symbolと候補局所実行を除き、具体API・保存・他Source／Test・正式Evidence・実境界・Quality Integration全体追従は未完了。[今回の計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#quality-role-propagation)を参照する。

### 先の鍵管理Quality再導出 — 2026-10-11

前判断の鍵管理・現在認可・認可済みDomain集約のQuality再導出は、QA-000007／QA-000009と7工程分析の固定9文書で契約・品質の限定独立レビューを完了し、全重大度の残指摘0。新規4項目（RFD-IT-017通常発行、018独立失効、019認可済み集約、EST-ST-015 MCP鍵操作非公開）と既存更新項目はNot Runである。旧Evidenceは旧契約の歴史的証跡として維持し、新契約のPassに流用しない。管理操作の担当Roleは採用済みだが、最新分担のQAへの伝播、Test Symbol・実行・新Evidence、具体API・Schema・Store、Source移管・本番接続は未完了。全体Quality Ready・Release可能を主張しない。

### 初回Host設定のQuality分析 — 2026-10-11

初回設定の設計伝播は限定レビュー済みだが、検証項目の定義候補を具体化した。前段の7工程品質分析を含む9文書は契約・品質の限定独立レビュー済み・残指摘0。QA-000007へ初回5項目を追加し、QA-000009のMCP負境界は既存項目へ統合した。全13定義は185→190項目で、今回13文書の定義接続は契約・品質の限定独立レビュー済み・残指摘0。項目数や通常管理の限定Passは初回設定の成立を示さない。次は保存・公開入口の具体化とSource／Test実接続である。RFD-UT-023のSource／Test Symbolと候補局所実行は接続済み、正式Local Item／Evidence評価はNot Run。他初回4項目のSource／Test／実行／新Evidenceと物理Ownerは未完了。[今回の計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)を参照する。

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 条件・停止点 | Owner Relation |
|---|---|---|
| 5D〜Fの独立した整理を切り分ける | CROS／MCP／Workbench等を一括保留せず、Runtime依存を着手前に確認する。依存する処置・署名E2Eは持ち越す。 | [処置表](99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md#持ち越しの処置--2026-10-09) |
| 大規模改修の入力を再評価する | 確認済みCapability、未接続・未観測範囲、反例を新責務へ対応付ける。再開は人間判断を経て行う。 | [持ち越し判断](99_Roadmap/Changes/CHG-000082/change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |
| Source構造規約に全Sourceを合わせる | 名前・配置・不要中継の棚卸し29件は処置済み。責務混在12件の分割理由・維持理由・最小案は整理済みで、分割実装は未着手。局所94試験と関連型検査は成功したが、固定Graphと既知Consumer／Recovery試験の残件があり、第1段階全体は未完了。旧空状態は保持し、機能分割・5C是正・全回帰の完了とは区別する。 | [処置と分割判断](99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md#棚卸し後の処置と分割判断--2026-10-09) |

## Checklist

- [x] Project ID、Repository ID、Repository RoleとManifestの既存整合を維持した。
- [x] 五場面を省略せず、結論を先に示した。
- [x] 現在事実、履歴事実、共有分析を区別した。
- [x] 詳細をOwner Relationへ接続し、独自IDやLive状態を追加していない。
- [x] 持ち越しをPass・完了・Release許可へ読み替えていない。
- [x] 未確認・OPENを空欄や非該当へ畳んでいない。
- [x] 保存済みの次候補と追加提案を区別した。
- [x] Ownerとの競合時はOwnerを確認し、Gate前に再投影要否を評価する。
