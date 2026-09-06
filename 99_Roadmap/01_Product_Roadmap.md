# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-06
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
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
| v0.20 Runtime責務分離 | Adopted | Ready for Release Handoff | [CHG-000063](../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[Project Runtime設計](../06_Architecture/project-runtime/01_Architecture.md)、[MCP設計](../06_Architecture/mcp/01_Architecture.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md) | Project RuntimeをApplication Core、Coordinatorを実行編成、MCPをTransport、実行知を観測・分析、Platform AccessをOS／Platform境界へ分けた。実状態をProject Runtime公開契約からMCP Adapterへ渡す意味縦断と、MCP stdio／HTTPの公開Process縦断を確認し、最終一括監査は指摘事項0件で合格した |
| v0.20 限定分散実行と統合結果の評価 | Adopted | Ready for Release Handoff | [CHG-000062](../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate) | 競合しない2 Taskを上限2で同時実行し、予定Task、実Attempt Eventおよび統合後の受入結果を同じ評価Identityへ接続した。最大同時実行2、Attempt 2、Retry 0、Conflict 0および統合受入を確認したが、決定論的な技術実測であり、実Provider間の速度・費用・人間時間または品質改善は未評価である |
| v0.20 Project Stateの読み取り専用投影 | Adopted | Ready for Release Handoff | [CHG-000064](../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-read-only-project-state-projection) | Project RuntimeのState Portから`readState`だけを受け取る公開Applicationと、`observed / absent / unknown`を区別するcanonical結果を実装した。公開Runtimeが生成した受入済み状態をMCPの閉じた結果まで縦断し、Effect 0を確認した。Project Management正本や進捗推定は追加していない |
| v0.20 ローカルMCP Streamable HTTP接続 | Adopted | Ready for Release Handoff | [CHG-000064](../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)、[検証結果](../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、[Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | `127.0.0.1`固定、Bearer認証、Origin確認、mirror header照合、bounded UTF-8、切断取消および終了時join付きのPOST単位Transportを実装した。stdio／HTTP公開Launcherと認証済み状態参照、Node.js Signal event受領後の終了lifecycleを総合試験で確認し、最終一括監査は指摘事項0件で合格した。OS／Consoleから実行中の公開ProcessへのSignal配送、LAN／Internet、Remote、複数RepositoryまたはOrganization Runtimeを意味しない |

### 1.2. v0.21.0 — Project運営・信頼・複数Repository

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.21 Project Management Projection | Adopted | Planned | [Project Operation／Projection構想](#v020-project-operation-projection) | Roadmap、CHG、Work、Evidence、Gitおよび試験結果から、WBS、進捗、Milestone、阻害事項、Risk、依存、予測およびRelease準備状態を生成する。Viewごとの状態や手入力進捗を別正本にせず、同じCanonical Contextから非Authorityの表現として投影する。Propertyごとの正本、unknown、予測精度、変更候補から正本更新までのAuthorityを設計で固定する |
| v0.21 Topic／Project Attention | Adopted | Planned | [Project Operation／Projection構想](#v020-project-operation-projection) | Topicは、既存のDiscovery、Decision、CHG、RoadmapまたはWorkへ情報欠落なく一意に還元できず、複数Contextを束ねて継続追跡する価値がある関心事を一時的に保持する。Risk／Issueの独立正本を先に作らず、Topic内の局所的な意味とRelationから横断Viewを投影する。Attention継続と意味整理を経て既存管理単位へ分解・昇格または「何もしない」の判断で閉じる |
| v0.21 Meeting／Context Promotion | Adopted | Planned | [Project Operation／Projection構想](#v020-project-operation-projection) | Meetingを時間境界のあるCommunication Activityとして扱い、生Transcriptではなく、そのMeetingで確認されたDecision、更新されたContext、未解決事項および参照元を保持する。TopicをMeetingへ所有させず、AI Chat、Slack、Review等を跨ぐAttentionと分離する。会話要約を直接正本化せず、既存Context照合と人間のAuthorityを経てCanonical Contextへ昇格する |
| v0.21 OSS Runtimeの利用者所有Trust Policy | Adopted | Planned | [OSS Runtime Trust Policy候補](../01_Discovery/01_CRDD_Product_Discovery.md#oss-runtime-trust-policy-candidate) | Qual-Lab公式署名を公式Buildの発行者・完全性Evidenceへ限定し、CRDD準拠性、Artifact完全性、発行者信頼および配置先の実行許可を分離する。Fork／組織Buildの独自署名と用途限定の未署名Local開発を、Deployment Ownerが所有するPolicyで安全に扱える契約を設計する。CROSの複数Repository・実行Sessionへ進む前に、Policy所有者、既定拒否、鍵更新・失効、移行および監査境界を固定する |
| v0.21 自律Operationの意味契約とTrigger | Adopted | Planned | [自律Operationの責務境界](../05_Autonomous_Operation.md#autonomous-operation-responsibility) | Operationが所有する目的、Context、Authority、期待結果および停止条件と、Runtimeが所有する検知・開始を分離する。MCPを受付Transport、Schedulerを時刻・Event Triggerとして扱い、どちらにも目的や実行Authorityを暗黙付与しない。CROSのTask Sessionと人間判断待ち／再開へ接続し、重複開始、判断不足および情報不足ではEffect 0となる受入条件を固定する |
| v0.21 Context Operating System（CROS） | Adopted | Planned | [CROS発展境界](#cros-evolution-boundary) | 各ProjectのCRDDを正本のまま維持し、複数RepositoryのContext解決、利用目的単位のContext Package、安定したMCP／HTTP Interface、Agent実行Session、人間判断待ち／再開および結果の正本還流を担うRuntime／Federation層を段階的に成立させる。CRDDを中央Databaseへ置換せず、CROS自身を新しいContext正本または人間判断主体にしない。v0.20の単一Repository・localhost境界を基礎とし、v0.21着手時に各段階の完成条件と順序を固定する |
| v0.21 Organization Runtime（最小構成） | Adopted | Planned | [CROS発展境界](#cros-evolution-boundary)、[長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md) | CROSの複数Repository Bindingを利用し、Project一覧、Portfolioの読み取り専用投影、対象Projectの選択・Routing、およびProjectごとのContext・Authority・Runtime State・Recovery分離を成立させる。Project間の自動優先順位付け、Capacity／費用配分、横断Effect認可、無制限SchedulingまたはOrganization正本の新設は含めず、将来のOrganization Runtime完成形と区別する |
| v0.21 自律Operationの読み取り中心参照実証 | Adopted | Planned | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価またはRepository Eventから、判断価値を検証できる最小ケースを選ぶ。読み取り中心または外部Effectを伴わない範囲で、受付、Context解決、Task Session、人間判断待ち／再開、停止および結果還流を縦断確認する。起動数ではなく、判断価値、誤起動・見逃し、収束、根拠、人間負荷および費用で評価する |

### 1.3. v0.22.0 — Linux常設化・Remote・限定自律実行

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.22 耐久Queue／Scheduler | Adopted | Planned | [Operation健全性と人間接続](../05_Autonomous_Operation.md#operation-health-and-human-interface)、[実行・計画系研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | Operationの目的やAuthorityを所有せず、実行可能性、順序、時刻・Event Trigger、重複抑止、Debounce／Batch、再試行上限、停止、再開および耐久状態を管理する。ローカル対話作業との排他、再起動後の再入場、同じOperationの多重起動防止および人間判断待ちを、CROSのTask Sessionとexact Identityへ接続する |
| v0.22 Linux対応とRemote Runtime | Adopted | Planned | [Discoveryの保留境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-linux-remote-runtime) | v0.20で分離したPlatform／Transport境界とv0.21のTrust Policy／CROSを基礎として、Linux Server上のLocal Runtime、Process・Filesystem・Container・Recovery、Remote認証・Network・Session、再起動／切断／取消および本番同等E2Eを段階的に成立させる。具体的な対応Distribution、公開範囲、運用主体、可用性および完成条件はv0.21完了前に固定し、Internet一般公開、Multi-tenantまたはOrganization横断Authorityを暗黙追加しない |
| v0.22 Remote Triggerと限定自律Operation実行 | Adopted | Planned | [自律Operation](../05_Autonomous_Operation.md)、[CROS発展境界](#cros-evolution-boundary) | Linux常設Runtimeで、認証済みRemote Triggerから許可済みOperationだけを開始し、切断、取消、再起動、Provider失敗およびRecoveryを跨いで結果を対象Repositoryへ還流する。無制限な自己目的生成、未承認の外部Effect、組織横断Authorityまたは人間判断の代替は含めない。限定された代表Operationで完了・停止・回復の本番同等E2Eを行う |
| v0.22 自律Operationの実行評価 | Adopted | Planned | [実行知](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments) | 実行知を用いて、Triggerの誤起動・見逃し、判断へ寄与した結果、人間の能動時間、待機時間、再試行、Recovery、Provider利用量、費用および停止理由を欠測と分けて観測する。起動回数や自動化率だけを成功とせず、価値が低い、費用が高い、または安全に収束しないOperationを停止・縮退できる条件を固定する |

### 1.4. 版未定・再評価待ち

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| macOS対応 | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | Platform非依存CoreとAdapter境界は維持するが、実機Macまたは正式なmacOS実行環境がない間は対応版を予約しない。Process、Filesystem、Lock、signal、Keychain／署名、Gatekeeper、Container Runtime、cleanupおよびRecoveryを実環境で検証できる状態になった時点で、価値、対象構成、完成条件および版を再評価する。設計上の考慮や未対応時の安全な拒否を、macOS対応完了へ読み替えない |
| Discoveryの業務プロセス投影 | Exploring | Unscheduled | [業務プロセス投影候補](../01_Discovery/01_CRDD_Product_Discovery.md#discovery-process-method-projection) | 業務変革を扱う際、Realityから得たActor、Activity、Input／Output、判断、Authority、Handoff、時間、滞留、Pain Point、Root Cause、OpportunityおよびKPIを同じDiscovery Contextへ保持し、SIPOC、BPMN／Swimlane、Value Stream等へ目的別に投影する候補。図や独自Schemaを新しい正本にせず、AI導入を先にSolutionへ固定しない。既存Discovery成果物で表現できる範囲、再利用価値、記録費用および標準手法との互換性を代表業務で確認してから採否・版・実装範囲を決める |
| Self-hosted Provider | Held | Unscheduled | [将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | Provider Adapter、利用者所有Trust PolicyおよびCapability評価の実績を前提に、Localhost、LAN GPU Server、Company GPUまたはPrivate CloudのProviderを既存Contractへ接続する候補。Frontier Modelの一律置換や機密性の自動判定を目的とせず、価値、能力、安全性、運用費用および責任主体を実環境で確認してから版と範囲を決める |
| 高度な実行・計画最適化 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | Task評価、Reasoning Route、Capability Routing、意味競合検知、Scope Lockおよび自律的な再計画を、v0.21の参照実証とv0.22の限定実行で得たEvidenceから再評価する。単一の総合Scoreや自己申告能力だけで自動選択せず、人間判断、Authority、停止条件、費用および統合結果を保つ。現在の版への実装許可を意味しない |
| Organization Runtime完成形 | Held | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針) | v0.21の最小構成を超えるProject間の優先順位、Capacity／費用配分、共有Policy／Knowledge、Cross-project Risk、投資判断およびOrganization横断Effect Authorityを扱う将来候補。複数Repositoryを読めることから組織判断権限を推定せず、v2能力地平として人間の決定権限者が別途採否と完成条件を固定する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。公開済みv0.18.0の結果と、第2段階で得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は完了根拠へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、v0.21の参照実証、v0.22の実行評価または版未定の高度な最適化へ責務ごとに分けた。将来候補の存在は、版予約、実装許可またはRelease条件を意味しない。

## 2. 版ごとにできるようになること

| 版 | 利用者ができるようになること | 成立させる基盤 | この版では行わないこと |
|---|---|---|---|
| v0.20.0 | 一つのローカルProjectで、分離されたProject RuntimeをMCP stdio／localhost HTTPから利用し、実行状態と実行効果を観測しながら、競合しない少数Taskを安全に並行実行して一つの受入結果へ統合できる | 試験レベル別の自動回帰、実行知、Runtime責務分離、限定分散実行、読み取り専用Project State、認証済みlocalhost HTTP | 複数Repository、常設Remote運用、一般Network公開、自律的なOperation開始、Project Management正本の新設 |
| v0.21.0 | 複数ProjectのCRDD正本を中央へ移さず横断参照し、Projectの現在地・注意事項・会議から昇格した判断を目的別に把握できる。利用者または組織が信頼するRuntime発行者を選び、MCP／HTTPからTask Sessionを開始して、人間判断待ちと再開を扱える。読み取り中心の参照Operationで自律実行の価値を試せる | Project Management Projection、Topic、Meeting／Context Promotion、利用者所有Trust Policy、CROS、最小Organization Runtime、自律Operationの意味契約 | Project間の自動優先順位・Capacity配分、Organization横断Effect Authority、Linux常設運用、未承認の外部Effect |
| v0.22.0 | Linux Server上へRuntimeを常設し、認証済みのRemote入口から許可済みOperationをQueueへ受け付け、時刻・Event Trigger、切断、取消、再起動およびRecoveryを跨いで限定的に完遂できる。効果と人間負荷を実行知で評価できる | Linux Platform Adapter、Remote Trust Boundary、耐久Queue／Scheduler、Remote Trigger、限定自律Operation、実行評価 | Internet一般公開、Multi-tenant、無制限な自己目的生成、Organization全体の自動最適化 |
| 将来版 | Self-hosted Provider、macOS、より高度なCapability Routing／再計画、Project間の投資・優先順位・Capacity最適化を、先行版のEvidenceに基づいて選択的に追加できる | Provider／Platform Adapter、Trust Policy、実行知、v0.21の複数Repository分離、v0.22の常設実行Evidence | 実環境の根拠がない対応表明、単一Scoreによる自動判断、人間または配置先所有者のAuthority代替 |

公開済みv0.19.0以前の到達点と移行情報は[CHANGELOG](../CHANGELOG.md)を正本とし、本書へ複製しない。発展の中心は、機能数ではなく人間が扱う抽象度である。v0.20は分離・観測・限定並列化、v0.21は複数ProjectのContext把握と判断接続、v0.22は常設環境での限定的な継続実行を成立させる。将来のOrganization Runtime完成形は、複数Projectを読めることではなく、Project間の資源・優先順位・投資およびEffect Authorityを扱う能力として別に判断する。

```text
v0.20  ローカルの単一Projectを、分離・観測・限定並列化する
   ↓
v0.21  複数ProjectのContextを結び、人間判断と安全な受付をつなぐ
   ↓
v0.22  Linuxへ常設し、QueueとRemote Triggerで限定Operationを継続実行する
   ↓
将来    Provider／Platformを広げ、Evidenceを基に組織最適化へ進む
```

## 3. v0.20以降の再整理

v0.19.0の完了経路は[CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)と[最終署名E2E](../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.md)へ保持する。2026-09-05、人間の決定権限者は、実行知、試験体系と自動回帰、Runtime責務分離、限定分散実行と統合結果の評価、Project Stateの読み取り専用投影、およびローカルMCP Streamable HTTP接続の6項目をv0.20の改訂計画基準として固定した。当初含めたLinux対応とRemote Runtimeは、Platform実装とRemote Trust Boundaryの同時追加によるScope膨張を避けるため`Held / Unscheduled`へ戻した。v0.20.0は、ローカル前提でProject Runtimeを分離・観測可能にし、限定並列実行を安全に成立させる版とする。探索中・保留中の項目をこの範囲へ暗黙追加しない。後から計画を変更する場合は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および必要な変更トレースを明示し、過去の計画基準を遡及上書きしない。

2026-09-06、人間の決定権限者は、Project Management Projection、Topic／Project Attention、Meeting／Context Promotion、OSS Runtimeの利用者所有Trust Policy、CROS、Organization Runtimeの最小構成、自律Operationの意味契約とTrigger、および読み取り中心の参照実証をv0.21.0の対象として採用した。Trust Policyは、現在のQual-Lab固定Release Trustを破棄する変更ではなく、CRDD準拠性、Artifact完全性、発行者信頼および配置先の実行許可を分離し、CROSより先に利用者所有の信頼境界を成立させる変更とする。Organization Runtimeの最小構成は、複数Repositoryの読取り・投影・RoutingとProject単位の分離までを扱い、Project間の自動最適化または横断Effect Authorityを含めない。自律Operationは目的・Context・Authority・期待結果・停止条件を所有し、MCPを受付Transport、Schedulerを開始条件とする。v0.21では読み取り中心または外部Effectを伴わない参照実証までを上限とする。

同日、人間の決定権限者は、Linux対応とRemote Runtime、耐久Queue／Scheduler、Remote Triggerによる限定自律Operation実行、および実行知による効果評価をv0.22.0の対象として採用した。macOS対応は実機または正式な実行環境を利用できるまで版未定で保持した。これは版への収載判断であり、個別設計、実装着手、LAN／Internet一般公開、Multi-tenant、無制限な自己目的生成またはOrganization横断Authorityの採用を意味しない。v0.20.0のRelease完了後に、v0.21各項目の依存順、変更トレース、受入条件および検証範囲を具体化する。

<a id="v020-project-operation-projection"></a>

### 3.1. Project Operation／Project Management Projection構想

本構想は、JIRA、Notion、Excel WBS等をCRDD内へ再実装するものではない。既存のRoadmap、Discovery、Decision、CHG、Work、Evidence、Git、試験、監査およびReleaseをProject運営に必要な形へ構造化し、Project Modelから目的別のViewを生成する。v0.20へ追加せず、読み取り専用Project State投影と実行知を基礎としてv0.21へ収載する。詳細な実装範囲と完成条件は、v0.20のRelease完了後に固定する。

```text
CRDDの正本
  ↓
Project Model
  ├ WBS／Milestone／Dependency
  ├ Kanban／Progress／Blocker
  ├ Risk／Issue／Active Topic
  ├ Decision Required／Recent Meeting
  └ Forecast／Release Readiness／AI Summary
```

ViewごとにProject Stateを持たない。View上の操作は、利用者意図から正本の変更候補を作り、既存Context照合と必要なAuthorityを経て正本を更新し、再投影する。単純なTask完了率、AI推定または一つの表示から、Project健全性、進捗、予測またはRelease可能性を確定しない。観測値、推定値、仮定および不明を区別する。

Project WBSとChange WBSは別Schemaにせず、同じ構造をProject／ReleaseまたはCHGから異なる深さで表示する。WBSは計画と理解のInterfaceとして利用できるが、Canonical Entityにはしない。DependencyはEntity間Relationとして保持し、実行順序、並列化可能性、阻害事項および下流影響の投影に用いる。Propertyを追加する場合は、ID、状態、Owner、Priority、Milestone、Dependency、完了条件および進捗根拠を全成果物へ一律複製せず、Propertyごとの正本を先に定める。

Topicは、Conversation上のAttentionが移動してもProjectとして失ってはいけない関心事を保持し、意味整理後にDiscovery、Decision、CHG、RoadmapまたはWorkへ還元する候補である。既存単位へ一意に還元でき、複数Contextを束ねる必要がなく、継続追跡価値もない事項から作らない。Riskは将来起こり得る事象、Issueは既に顕在化した問題としてTopic内で区別し、必要な横断一覧はProjectionする。一つのTopicから複数の既存Entityへ分解でき、元の根拠とResolutionを辿れるようにする。

MeetingはTopicと異なり、時間境界を持つCommunication Activityである。CRDDへ保持する候補は生Transcriptではなく、議論したTopic、確認したDecision、作成・更新した正本、残った問いおよびSourceである。Message Theme、Meeting、TopicをそれぞれCommunication内の意味クラスタ、Communication Activity、Project Attentionとして分離する。外部会話から抽出した候補は、既存Context照合と人間のAuthorityなしに正本へ昇格しない。

配置候補は`20_Project/Topics/`と`20_Project/Meetings/`である。`20_Project`は工程横断の現在Context、`99_Roadmap`は将来実施・再評価すると決めた意図として分離する。WBS、Risk、Issue、Dashboardの正本Directoryは作らない。採否判断では、既存文書だけで投影できる範囲、追加Propertyの正本、Topicの分離可能性、Meetingからの意味保持、Dependencyによる順序導出、複数AIとの共用、外部PM Toolなしで不足する情報、およびViewから正本へ戻すAuthorityを代表ケースで検証する。

<a id="cros-evolution-boundary"></a>

### 3.2. Context Operating System（CROS）発展境界

CROSは、複数ProjectのCRDD Contextを横断解決し、安定したInterfaceとして外部へ提供し、Agent実行を統括して結果を該当する正本Repositoryへ還流するRuntime／Federation層の候補である。各CRDDは独立した正本を維持し、CROSの内部Databaseにはしない。CRDD標準はContextの意味、各CRDDはProject固有の真実、CROSは解決・連合・実行、Qual等は人間との対話、外部Toolは表示・操作Surfaceを所有する。

```text
Human／Qual／外部AI・Tool
          ↕ MCP／HTTP
CROS
  ├ Project Registry／Repository Binding
  ├ Context Resolver／Context Package
  ├ Multi-Repository Federation
  ├ Task Session／Human Decision Wait・Resume
  ├ Execution Policy／Agent Organization
  └ 派生Index／Provenance／Audit
          ↕ Repository Contract
各ProjectのCRDD正本
```

CROSはProduct Requirement、Projectの「なぜ」、人間の重要判断または外部Toolの表示状態を所有しない。Task実行から得たChange、Evidence、DecisionおよびProgressは、対象CRDDの契約とAuthorityに従って還流する。Portfolio Context、Runtime IndexおよびCacheは派生結果であり中央正本に昇格しない。外部向けInterfaceはStorage操作の細粒度な列挙ではなく、`project context`、`portfolio context`、`release context`等の利用目的を一回の呼出しで満たす粒度を候補とし、明示値、決定論的算出値および推定値の出典を追跡可能にする。

発展順序は、v0.20で成立させる単一Repositoryの公開Application契約、読み取り専用投影およびlocalhost HTTPを基礎として、v0.21でProject Registry／Binding、複数Repository横断解決、Context Package、Task Session、人間判断待ち／再開、外部AI／Toolとの投影、および最小Organization Runtimeを段階的に評価する。最小Organization RuntimeはPortfolioの読み取り専用投影、対象Projectの選択・RoutingおよびProject単位の分離を上限とし、LAN／Internet公開、Remote常設運用、Project間の自動最適化またはOrganization横断Effect Authorityをv0.21へ暗黙追加しない。各段階で正本非複製、情報分類、認証・認可、RepositoryごとのAuthority、失敗時のEffectおよび結果還流を確認する。CRDDのv2能力地平が想定するOrganization Runtime完成形は変更せず、v0.20のRelease完了後にv0.21各段階の具体的な受入条件、順序および保留境界を固定する。

## 4. 境界

[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
