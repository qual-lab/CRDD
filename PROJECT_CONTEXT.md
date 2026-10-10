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

### 権限分担の最新判断 — 2026-10-11

上流3文書への反映は限定独立契約レビュー済み・残指摘0。下流設計・QA・実装の成立を示す結果ではない。

managerとadministratorがユーザー登録・表示名変更、developer／managerの割当て・詳細権限設定、Repository登録・登録解除・公開範囲を管理する。管理者資格の付与・解除・変更、administratorの詳細権限、鍵3操作はadministratorだけが管理する。manager自身の内容範囲変更は明示設定で可能だが、管理能力から内容を自動付与しない。登録だけでは公開されず、登録解除はProduct Data削除ではない。

担当Roleの追加判断は不要となった。上流反映に続いて、REQ-000041のUX分析・UX-000035・横断5文書へ限定伝播し、限定独立レビュー済み・残指摘0である。続いてIA分析・IA-000009・横断4文書へ限定伝播し、限定独立レビュー済み・残指摘0。UI／SPECの定義・分析・横断投影12文書へ限定伝播し、限定独立レビュー済み・残指摘0。UI／SPEC詳細7文書も契約・品質の限定独立レビュー済み・残指摘0。Architecture入力分析2件は契約・品質の限定独立レビュー済み・残指摘0。ARCH-000013・横断01〜08の9設計文書は契約・品質の限定独立レビュー済み・残指摘0。AM／Workbench／MCP詳細3文書へ候補伝播・契約／品質の限定独立レビュー済み・残指摘0。Qualityの12文書へ最新分担を候補伝播し、契約・品質限定独立レビュー済み・残指摘0。通常管理のUT／IT／STの3項目追加とUAT／搬送同値更新はNot Run。Sourceは未追従。以前の限定レビュー結果は前判断の履歴であり、最新判断のPassではない。具体API・保存・初回設定・本番接続の未完了は維持する。正本は[REQ-000041](01_Discovery/Definitions/REQ-000041/requirement.md#要求)、追跡は[Architecture入力分析伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#architecture-role-analysis-propagation)、[UI／SPEC詳細伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#ui-spec-role-detail-propagation)、[UI／SPEC定義伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#ui-spec-role-propagation)、[IA伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のia伝播--2026-10-11)と[UX伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のux伝播--2026-10-11)を参照する。

### 結論

持ち越し記録について追加判断は不要。CROS Package維持の先の判断は人間が変更し、認証・認可をAccess Managementへ再編する方向となった。Context集約・接続Registry・活動等の具体OwnerはSource照合後にArchitecture／Qualityへ反映する。未決候補を採用済み実装と扱わない。Domain保存で、非協調Processの親Directory差替えまで防ぐ保証を要求するかは判断待ちである。通常保存＋読戻し、静的link拒否と協調Writer競合は確認済みだが、競合差替え防止の証明ではない。担当責任者・採用判断者はQual-Lab。Docker／Coordinator／Orchestrator大改修は前倒ししない。

ユーザーID（UUID）・管理用表示名・RoleとCredential紐付けの最小管理、鍵交換2操作は採用済み。2026-10-10の鍵管理境界に対する前判断は、上流・UX・IA・UI／SPEC・Architectureの限定独立レビュー済み・残指摘0として履歴を保持する。これは2026-10-11の担当Role分担の確認結果ではない。最新分担はUXの限定再レビュー済み・残指摘0。IA6文書へ伝播し限定独立レビュー済み・残指摘0で、UI／SPEC定義・対応は限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC詳細は伝播・限定独立レビュー済み・残指摘0。Architecture契約の限定伝播・レビューは済み。Qualityは12文書へ候補伝播・限定独立レビュー済み・残指摘0。具体API・保存・Quality実行・Source・本番接続は未完了。詳細は[実施計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)を参照する。

| 判断項目 | 現在の処置 | Owner Relation |
|---|---|---|
| 接続主体・Role・Credentialの再編 | 担当RoleをREQ-000041で採用済み。UX7成果物へ限定伝播・限定独立レビュー済み・残指摘0。IA6文書へ限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC定義・対応は限定伝播・限定独立レビュー済み・残指摘0。UI／SPEC詳細は伝播・限定独立レビュー済み・残指摘0。Architecture契約の限定伝播・レビューは済み。Qualityは12文書へ候補伝播・限定独立レビュー済み・残指摘0。Sourceは未伝播。以前の限定レビューは前判断の履歴であり、最新分担のPassではない。具体API・保存・受領方式・本番接続も未完了。 | [最新判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#業務管理と管理者資格鍵の分担--2026-10-11)、[UX伝播](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#権限分担のux伝播--2026-10-11) |
| CROS Packageの責務再編 | 移管対応表の限定レビューは前判断の履歴。Access Management詳細は最新鍵管理判断の限定独立レビュー済み・残指摘0。保存・権限語彙・公開入口はOPEN。Domain集約・MCP／Workbenchの境界は新Details候補へ限定再伝播・契約／品質独立レビュー済み・残指摘0。具体API・保存・受領方式、QA、Source移管・本番接続・旧撤去は未完了。 | [Access Management詳細](06_Architecture/Details/access-management/01_Architecture.md)、[移管対応表](99_Roadmap/Changes/CHG-000082/source-owner-map.md) |
| 非協調Processの親Directory差替え保証 | 必要範囲を確認中。未回答を高い保証の採用や免除へ読み替えず、独立した接続整理を継続する。 | [保存保証の未決判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#保存保証の未決判断) |
| 5C追加是正の持ち越し | 承認済み。保証条件変更・Release範囲変更の承認ではない。 | [判断の正本](99_Roadmap/Changes/CHG-000082/change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |
| 履歴相関を必須としない配送終了案 | 未採用・未実装のまま改修入力へ持ち越す。 | [未採用候補](99_Roadmap/Changes/CHG-000082/change.md) |
| Repository IDの正式固定 | 暫定値を維持。契約固定時に人間が判断する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

MCP詳細の最新判断伝播は契約・品質の限定独立再レビュー済み・残指摘0である。旧非秘密の鍵管理Tool候補を撤回し、MCP要求認証の継続と鍵管理非公開を分離した。Access Managementの現在認可とDomain Modelの認可済み集約へOwnerを分けた。Workbenchと旧CROS比較詳細は直接参照と近傍の鍵境界だけを同期した。Workbench／Domainの新Owner境界はDetails候補へ限定再伝播・契約／品質独立レビュー済み・残指摘0。具体API・保存・受領方式、Quality、Source・本番接続は未完了。Checker全体は既知3,056件で未通過。詳細は[今回の処置](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#最新鍵管理判断のmcp詳細再伝播--2026-10-11)を参照する。

### 鍵管理についての最新判断 — 2026-10-10

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常入口は同一Process Workbench、Host回復はログイン済みローカル操作者の対話CLIで追加認証なし。対象・影響表示と既存確認は維持する。鍵操作はSecret有無にかかわらずMCPへ公開しない。発行権限OFFの仮説について追加判断は不要となった。他管理群の担当Roleも2026-10-11に採用済みであり、下流伝播は未完了である。

2026-10-10の鍵管理境界について、要求・基本定義・AM詳細・判断履歴、UXからArchitectureまでの限定伝播と独立レビュー結果は前判断の履歴として保持する。2026-10-11の担当Role分担はUXの限定再レビュー済み・残指摘0。IAは限定伝播・限定独立レビュー済み・残指摘0で、UI／SPEC定義・対応は限定確認済み、詳細は伝播・限定独立レビュー済み・残指摘0。Architecture入力分析2件は契約・品質の限定独立レビュー済み・残指摘0。ARCH-000013・横断01〜08は契約・品質の限定独立レビュー済み・残指摘0。AM／Workbench／MCP詳細3文書へ候補伝播・契約／品質の限定独立レビュー済み・残指摘0。Qualityへ最新分担を候補伝播・限定独立レビュー済み・残指摘0。Source以降は未伝播。具体API・保存・受領方式、Quality・Source・本番公開入口・実境界は未完了であり、旧限定結果から最新判断や全体完成を主張しない。

## 4. なぜこの状態・判断になったか

### 結論

現在のRecoveryをさらに完成させる前に大規模改修が見込まれるため、追加是正を保留した。Docker隔離と使い捨て・最小管理の方針を保持し、新しい共有State・Registry・Lockや汎用Recoveryは追加しない。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| 5Cの追加是正を持ち越す | 大規模改修前の積み増しによる再実装・再検証を避け、未成立を改修入力として保持する。 | [CHGの現在判断](99_Roadmap/Changes/CHG-000082/change.md) |
| Project Contextは現在投影とする | 五場面を共通形式で提供し、Topic／Meeting・Roadmap・Quality等の詳細は各Ownerが所有する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

### 最新権限分担のQuality再導出 — 2026-10-11

固定8操作の管理判定、通常6操作の保存境界、公開縦断をRFD-UT-020／IT-021／ST-022へ分離し、UAT-007とEST-IT-010を更新した。設計集合は185 Local Item。最新12文書は契約・品質限定独立レビュー済み・残指摘0、今回の新規・更新項目はNot Run。MCPの通常管理Toolを新規採用せず、Profile管理Roleは別途OPEN。具体API・保存・Source・Test・実境界・Quality Integration全体追従は未完了。[今回の計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#quality-role-propagation)を参照する。

### 先の鍵管理Quality再導出 — 2026-10-11

前判断の鍵管理・現在認可・認可済みDomain集約のQuality再導出は、QA-000007／QA-000009と7工程分析の固定9文書で契約・品質の限定独立レビューを完了し、全重大度の残指摘0。新規4項目（RFD-IT-017通常発行、018独立失効、019認可済み集約、EST-ST-015 MCP鍵操作非公開）と既存更新項目はNot Runである。旧Evidenceは旧契約の歴史的証跡として維持し、新契約のPassに流用しない。管理操作の担当Roleは採用済みだが、最新分担のQAへの伝播、Test Symbol・実行・新Evidence、具体API・Schema・Store、Source移管・本番接続は未完了。全体Quality Ready・Release可能を主張しない。

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
