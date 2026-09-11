# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-11
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
- [Runtime／CROS Product Candidates](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)
- [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)
- [CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)
- [CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)
- [CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)
- [CHG-000058](../90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md)
- [CHG-000059](../90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md)
- [CHG-000060](../90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

2026-09-05、v0.19.0のCommunication／推論コンテキスト、Project Runtime、Dogfooding横断改善およびブランド素材を公開した。署名済みRecovery Matrix、4経路4/4、公開MCPの実Provider 2経路、実Provider開始後取消、親Process消失後のexact Recoveryとfresh再入場、および最終独立監査を完了した。完了項目は根拠をCHG・品質記録・公式tagへ接続して本登録簿から除去し、本書にはv0.20以降に再評価または実行する項目だけを残す。

### 1.1. v0.20.0 — Release引継ぎ

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.20 試験体系と自動回帰 | Adopted | Ready for Release Handoff | [CHG-000061](../90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md)、[検証結果](../07_Quality/Verification_Results/2026-09-05_Test_Levels_and_Automated_Regression_Verification.md) | UT／IT／ST／UAT／PT／LTの責務、レベル別Directory、試験カタログ、登録漏れ検査および変更影響型runnerをChecker／Coordinatorへ自己適用した。固定改訂版`ae8efe1`で決定論的回帰、Windows実Process Gateおよび独立最終レビューを完了し、指摘事項は0件。PT／LTは明示AuthorityなしでEffect 0となり、任意の未実行は通常監査またはReleaseを停止しない。未評価範囲は検証結果へ保持し、v0.20.0の統合・Release判断とは分離する |
| v0.20 実行知（Execution Intelligence） | Adopted | Ready for Release Handoff | [CHG-000062](../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[初期固定候補の検証結果](../07_Quality/Verification_Results/2026-09-05_Execution_Intelligence_Verification.md)、[拡張後の検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md) | Coordinatorから独立した共通コンポーネントとして、不変Store、欠測を保持する集約、非Authorityな改善候補、TypeScript向け組込みRecorderおよびAI API利用量のfield別観測を実装した。保持状態はRuntime外の清掃判断へ利用できるが、真正な耐久Evidence生成元と参照解決器が未成立のため、清掃候補生成と物理削除はv0.20公開範囲から除外した。初期独立レビューで見つかった入力、永続化および利用側閉包の未成立を構造是正し、全回帰を完走した。現在のexact固定改訂版は検証結果が所有し、本表へCommit hashを複製しない。実Providerの利用量、速度、費用、人間時間または品質改善は未成立とする |
| v0.20 Runtime責務分離 | Adopted | Final Audit Pending | [CHG-000063](../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[Project Runtime設計](../06_Architecture/project-runtime/01_Architecture.md)、[MCP設計](../06_Architecture/mcp/01_Architecture.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md) | 責務分離と正式署名は完了し、現行候補の正式4経路4/4とRecovery Matrix 7/7が成立。最終Evidence反映後の一括監査と人間のRelease判断を残す |
| v0.20 限定分散実行と統合結果の評価 | Adopted | Ready for Release Handoff | [CHG-000062](../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate) | 競合しない2 Taskを上限2で同時実行し、予定Task、実Attempt Eventおよび統合後の受入結果を同じ評価Identityへ接続した。最大同時実行2、Attempt 2、Retry 0、Conflict 0および統合受入を確認したが、決定論的な技術実測であり、実Provider間の速度・費用・人間時間または品質改善は未評価である |
| v0.20 Project Stateの読み取り専用投影 | Adopted | Ready for Release Handoff | [CHG-000064](../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-read-only-project-state-projection) | Project RuntimeのState Portから`readState`だけを受け取る公開Applicationと、`observed / absent / unknown`を区別するcanonical結果を実装した。公開Runtimeが生成した受入済み状態をMCPの閉じた結果まで縦断し、Effect 0を確認した。Project Management正本や進捗推定は追加していない |
| v0.20 ローカルMCP Streamable HTTP接続 | Adopted | Ready for Release Handoff | [CHG-000064](../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | `127.0.0.1`固定、Bearer認証、Origin確認、mirror header照合、bounded UTF-8、切断取消および終了時join付きのPOST単位Transportを実装した。stdio／HTTP公開Launcherと認証済み状態参照、Node.js Signal event受領後の終了lifecycleを総合試験で確認し、最終一括監査は指摘事項0件で合格した。OS／Consoleから実行中の公開ProcessへのSignal配送、LAN／Internet、Remote、複数RepositoryまたはOrganization Runtimeを意味しない |
| v0.20 構造を先に選ぶ文書改善 | Adopted | Final Audit Pending | [CHG-000065](../90_Release/Changes/CHG-000065_Structured_First_Documentation.md)、[文書化](../03_Documentation.md#104-structured-first) | 全428文書のInventory、Repository全体Checkerおよび署名前の独立文書再監査は成立。正式E2E結果を反映した現在Treeの一括監査と人間のRelease判断を残す |

### 1.2. v0.21.0 — Project運営・信頼・複数Repository

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 Project Management Projection | Adopted | Planned | [Project Operation／Projection構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#2-project-operationproject-management-projection) | 着手時に投影対象、Propertyの正本、欠測表示および更新Authorityを固定する |
| v0.21 Topic／Project Attention | Adopted | Planned | [Project Operation／Projection構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#2-project-operationproject-management-projection) | 代表ProjectでTopicの発火・昇格・終了条件を検証し、採用契約を固定する |
| v0.21 Meeting／Context Promotion | Adopted | Planned | [Project Operation／Projection構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#2-project-operationproject-management-projection) | 代表Meetingで保持情報、昇格先および人間の判断境界を検証する |
| v0.21 OSS Runtimeの利用者所有Trust Policy | Adopted | Planned | [OSS Runtime Trust Policy候補](../01_Discovery/01_CRDD_Product_Discovery.md#oss-runtime-trust-policy-candidate) | CROS着手前にPolicy所有者、既定拒否、鍵更新・失効、移行および監査境界を固定する |
| v0.21 自律Operationの意味契約とTrigger | Adopted | Planned | [自律Operationの責務境界](../05_Autonomous_Operation.md#autonomous-operation-responsibility) | 目的・Authority・Triggerの所有分離と、判断不足時のEffect 0を受入条件にする |
| v0.21 Repository Tool／Capability Registry | Adopted | Planned | [Repository Capability構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#4-repository-toolcapability-registry) | 登録・公開・実行許可を分ける最小Registryと代表Toolの受入条件を設計する |
| v0.21 CRDD／CROS構造化とWorkbench基盤 | Adopted | Planned | [構造化・Workbench構想](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crddcros構造化とworkbench基盤) | 全書込みPathを棚卸しし、Repository、Runtime Data、ToolおよびMCPの共通契約を先に固定する |
| v0.21 AI Runtime Registry／モデルProfile外部構成 | Adopted | Planned | [AI Runtime外部構成](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#6-ai-runtime-registryモデルprofile外部構成) | 設定所有・上書き・Adapter追加境界と、登録・認証・実行許可の分離を固定する |
| v0.21 Remote MCP接続 | Adopted | Planned | [CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界)、[v0.20のローカルMCP](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | 認証・認可・情報分類・切断／再送を含むRemote接続の完成条件を固定する |
| v0.21 正式検証の安全なHeadless出力 | Adopted | Planned | [v0.20 Runtime責務分離](../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md) | 保存先Authorityと閉じた結果契約を設計し、CI／Remoteの代表経路で検証する |
| v0.21 Context Operating System（CROS） | Adopted | Planned | [CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界) | v0.20の単一Repository境界を基準に、複数Repository対応の段階と完成条件を固定する |
| v0.21 Organization Runtime（最小構成） | Adopted | Planned | [CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界)、[長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md) | 読み取り専用Portfolio投影とProject単位の分離を代表構成で検証する |
| v0.21 自律Operationの読み取り中心参照実証 | Adopted | Planned | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界) | 外部Effectを伴わない代表Operationを選び、判断価値と人間負荷を実測する |

### 1.3. v0.22.0 — Linux常設化・Remote・限定自律実行

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 耐久Queue／Scheduler | Adopted | Planned | [Operation健全性と人間接続](../05_Autonomous_Operation.md#operation-health-and-human-interface)、[実行・計画系研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | v0.21のTask Session結果を基に、排他・再入場・重複抑止を含む完成条件を固定する |
| v0.22 Linux対応とRemote Runtime | Adopted | Planned | [Discoveryの保留境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-linux-remote-runtime) | v0.21完了前に対象Distribution、公開範囲、運用主体および本番同等E2Eを固定する |
| v0.22 Remote Triggerと限定自律Operation実行 | Adopted | Planned | [自律Operation](../05_Autonomous_Operation.md)、[CROS発展境界](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#7-cros発展境界) | 許可済み代表Operationについて、完了・停止・回復の本番同等E2Eを行う |
| v0.22 自律Operationの実行評価 | Adopted | Planned | [実行知](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments) | 実行知から価値・費用・人間負荷・停止条件を評価する基準を固定する |

### 1.4. 版未定・再評価待ち

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| macOS対応 | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 実機Macまたは正式なmacOS実行環境を利用可能になった時点で、価値、対象構成、完成条件および版を再評価する |
| Discoveryの業務プロセス投影 | Exploring | Unscheduled | [業務プロセス投影候補](../01_Discovery/01_CRDD_Product_Discovery.md#discovery-process-method-projection) | 代表業務で既存成果物の表現力、再利用価値、記録費用および標準手法との互換性を確認して採否を決める |
| Self-hosted Provider | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 既存Adapter、Trust PolicyおよびCapability評価の実績後に、価値、安全性、費用および責任主体を再評価する |
| 高度な実行・計画最適化 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | v0.21の参照実証とv0.22の実行評価から、人間判断と停止条件を保てる範囲を再評価する |
| Organization Runtime完成形 | Held | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針) | 最小構成のEvidence後に、組織横断の判断・配分・Effect Authorityを別途採否する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 公開版と自己適用のEvidenceから、責務境界を再評価する必要があるか確認する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は完了根拠へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、v0.21の参照実証、v0.22の実行評価または版未定の高度な最適化へ責務ごとに分けた。将来候補の存在は、版予約、実装許可またはRelease条件を意味しない。

## 2. 版ごとにできるようになること

| 版 | 利用者ができるようになること | 成立させる基盤 | この版では行わないこと |
|---|---|---|---|
| v0.20.0 | 一つのローカルProjectで、分離されたProject RuntimeをMCP stdio／localhost HTTPから利用し、実行状態と実行効果を観測しながら、競合しない少数Taskを安全に並行実行して一つの受入結果へ統合できる | 試験レベル別の自動回帰、実行知、Runtime責務分離、限定分散実行、読み取り専用Project State、認証済みlocalhost HTTP | 複数Repository、常設Remote運用、一般Network公開、自律的なOperation開始、Project Management正本の新設 |
| v0.21.0 | 複数ProjectのCRDD正本を中央へ移さず横断参照し、Projectの現在地・注意事項・会議から昇格した判断を目的別に把握できる。Repository固有Toolを明示Capabilityとして登録し、人間・AI・CLI・CI・MCP・薄いWorkbenchから同じ契約と構造化結果を利用できる。利用者または組織が信頼するRuntime発行者を選び、Coordinator本体を変更せず、登録済みAI Runtimeのモデル／Reasoning ProfileやRole割当を設定で更新できる。認証・認可されたRemote MCPを含む共通入口からTask Sessionへ接続して、人間判断待ちと再開を扱い、読み取り中心の参照Operationで自律実行の価値を試せる | Project Management Projection、Topic、Meeting／Context Promotion、Repository／`.crdd` Runtime Data Contract、Repository Capability Registry、共通TS API／CLI／構造化結果、AI Runtime Registry／Profile、利用者所有Trust Policy、Remote MCP、CROS、最小Organization Runtime、自律Operationの意味契約 | Workbench内の第二正本・独自業務ロジック、棚卸し前の`.crdd`構成固定、Directory自動探索によるTool公開、Caller由来の任意Shell、設定だけによる未知CLIの実行、認証情報の設定埋込み、費用だけによる自動モデル選択、Project間の自動優先順位・Capacity配分、Organization横断Effect Authority、Linux常設運用、耐久Queue、Remote Triggerによる継続実行、Internet一般公開、未承認の外部Effect |
| v0.22.0 | Linux Server上へRuntimeを常設し、認証済みのRemote入口から許可済みOperationをQueueへ受け付け、時刻・Event Trigger、切断、取消、再起動およびRecoveryを跨いで限定的に完遂できる。効果と人間負荷を実行知で評価できる | Linux Platform Adapter、Remote Trust Boundary、耐久Queue／Scheduler、Remote Trigger、限定自律Operation、実行評価 | Internet一般公開、Multi-tenant、無制限な自己目的生成、Organization全体の自動最適化 |
| 将来版 | Self-hosted Provider、macOS、より高度なCapability Routing／再計画、Project間の投資・優先順位・Capacity最適化を、先行版のEvidenceに基づいて選択的に追加できる | Provider／Platform Adapter、Trust Policy、実行知、v0.21の複数Repository分離、v0.22の常設実行Evidence | 実環境の根拠がない対応表明、単一Scoreによる自動判断、人間または配置先所有者のAuthority代替 |

公開済みv0.19.0以前の到達点と移行情報は[CHANGELOG](../CHANGELOG.md)を正本とし、本書へ複製しない。発展の中心は、機能数ではなく人間が扱う抽象度である。v0.20は分離・観測・限定並列化、v0.21は複数ProjectのContext把握と判断接続、v0.22は常設環境での限定的な継続実行を成立させる。将来のOrganization Runtime完成形は、複数Projectを読めることではなく、Project間の資源・優先順位・投資およびEffect Authorityを扱う能力として別に判断する。

```text
v0.20  ローカルの単一Projectを、分離・観測・限定並列化する
   ↓
v0.21  複数ProjectのContextを結び、Remote MCPから人間判断と安全な受付をつなぐ
   ↓
v0.22  Linuxへ常設し、QueueとRemote Triggerで限定Operationを継続実行する
   ↓
将来    Provider／Platformを広げ、Evidenceを基に組織最適化へ進む
```

## 3. 計画判断の履歴

| 日付 | 採用・変更した計画 | 現在の参照先 |
|---|---|---|
| 2026-09-05 | v0.20を、ローカル単一Projectの試験体系、実行知、Runtime責務分離、限定分散、状態投影、localhost MCPへ固定。Linux／Remoteは後続へ分離 | [v0.20未完了作業](#11-v0200--release引継ぎ) |
| 2026-09-06 | Project運営、Topic、Meeting、Trust Policy、Capability Registry、Remote MCP、CROS、最小Organization Runtime、自律Operationをv0.21へ採用 | [v0.21未完了作業](#12-v0210--project運営信頼複数repository) |
| 2026-09-07 | AI Runtime Registry／モデルProfile外部構成をv0.21へ追加 | [Runtime／CROS候補](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#6-ai-runtime-registryモデルprofile外部構成) |
| 2026-09-11 | Workbenchを先行せず、Repository、`.crdd`、Tool、構造化結果、MCPの共通契約を先に整える基盤をv0.21へ追加 | [構造化とWorkbench基盤](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crddcros構造化とworkbench基盤) |
| 2026-09-11 | Linux／Remote Runtime、耐久Queue／Scheduler、Remote Trigger、実行評価をv0.22へ採用。macOSは実環境取得まで版未定 | [v0.22未完了作業](#13-v0220--linux常設化remote限定自律実行) |

計画変更時は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および変更トレースを示し、過去の判断を遡及上書きしない。候補の利用者課題、価値、採用境界は[Runtime／CROS Product Candidates](../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md)と各情報源が所有する。Roadmapは具体的なSchema、Path、契約または実装順序を定義しない。

## 4. 境界

[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
