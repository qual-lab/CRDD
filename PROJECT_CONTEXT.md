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

### 結論

持ち越し記録について追加判断は不要。CROS Package維持の先の判断は人間が変更し、認証・認可をAccess Managementへ再編する方向となった。Context集約・接続Registry・活動等の具体OwnerはSource照合後にArchitecture／Qualityへ反映する。未決候補を採用済み実装と扱わない。Domain保存で、非協調Processの親Directory差替えまで防ぐ保証を要求するかは判断待ちである。通常保存＋読戻し、静的link拒否と協調Writer競合は確認済みだが、競合差替え防止の証明ではない。担当責任者・採用判断者はQual-Lab。Docker／Coordinator／Orchestrator大改修は前倒ししない。

ユーザーID（UUID）・管理用表示名・RoleとCredential紐付けの最小管理、鍵交換2操作は採用済み。最新判断は鍵発行・独立失効・交換をadministrator専用固定、通常入口を同一Process Workbench、Hostをログイン済みローカル操作者の対話CLIとし、MCPに鍵操作を公開しない。上流6文書は限定独立レビュー済み・残指摘0。UXは今回限定伝播・限定独立レビュー済み・残指摘0。IA・UI／SPEC・SCR／BHV・Architecture分析・03〜08横断モデル・Quality・Sourceは再伝播未完了。各工程の前判断に対する限定Passは履歴であり、最新判断や全体完成の根拠へ流用しない。

| 判断項目 | 現在の処置 | Owner Relation |
|---|---|---|
| 接続主体・Role・Credentialの再編 | 最小管理と鍵交換2操作、最新の鍵管理境界は採用済み。最新6文書は限定独立レビュー済み・残指摘0、UXは限定伝播・限定独立レビュー済み・残指摘0、IA以降の設計・品質・実装は再伝播未完了。残る4管理群の担当Roleと可変性は未確定。 | [最新判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#鍵管理の固定ローカル入口mcp非公開--2026-10-10) |
| CROS Packageの責務再編 | 移管対応表の限定レビューは前判断の履歴。Access Management詳細は最新鍵管理判断の限定独立レビュー済み・残指摘0。保存・権限語彙・公開入口はOPEN。Domain集約・MCP／Workbench新Details、QA、Source移管・本番接続・旧撤去は未完了。 | [Access Management詳細](06_Architecture/Details/access-management/01_Architecture.md)、[移管対応表](99_Roadmap/Changes/CHG-000082/source-owner-map.md) |
| 非協調Processの親Directory差替え保証 | 必要範囲を確認中。未回答を高い保証の採用や免除へ読み替えず、独立した接続整理を継続する。 | [保存保証の未決判断](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#保存保証の未決判断) |
| 5C追加是正の持ち越し | 承認済み。保証条件変更・Release範囲変更の承認ではない。 | [判断の正本](99_Roadmap/Changes/CHG-000082/change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |
| 履歴相関を必須としない配送終了案 | 未採用・未実装のまま改修入力へ持ち越す。 | [未採用候補](99_Roadmap/Changes/CHG-000082/change.md) |
| Repository IDの正式固定 | 暫定値を維持。契約固定時に人間が判断する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

### 鍵管理についての最新判断 — 2026-10-10

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常入口は同一Process Workbench、Host回復はログイン済みローカル操作者の対話CLIで追加認証なし。対象・影響表示と既存確認は維持する。鍵操作はSecret有無にかかわらずMCPへ公開しない。発行権限OFFの仮説について追加判断は不要となった。残る4管理群の可変性は未確定である。

要求・基本定義・AM詳細・判断履歴の6文書は限定独立レビュー済み・残指摘0。UXの7成果物へ最新鍵管理判断を限定伝播し、計画・本投影を含む9文書は限定独立レビュー済み・残指摘0。IA以降、Architecture分析／03〜08横断モデル、Quality・Source・公開入口・保存・実境界は再伝播未完了。全体完成・実装成立を主張しない。

## 4. なぜこの状態・判断になったか

### 結論

現在のRecoveryをさらに完成させる前に大規模改修が見込まれるため、追加是正を保留した。Docker隔離と使い捨て・最小管理の方針を保持し、新しい共有State・Registry・Lockや汎用Recoveryは追加しない。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| 5Cの追加是正を持ち越す | 大規模改修前の積み増しによる再実装・再検証を避け、未成立を改修入力として保持する。 | [CHGの現在判断](99_Roadmap/Changes/CHG-000082/change.md) |
| Project Contextは現在投影とする | 五場面を共通形式で提供し、Topic／Meeting・Roadmap・Quality等の詳細は各Ownerが所有する。 | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

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
