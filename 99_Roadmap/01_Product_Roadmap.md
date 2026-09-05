# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-05
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

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.20 試験体系と自動回帰 | Adopted | Ready for Release Handoff | [CHG-000061](../90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md)、[検証結果](../07_Quality/Verification_Results/2026-09-05_Test_Levels_and_Automated_Regression_Verification.md) | UT／IT／ST／UAT／PT／LTの責務、レベル別Directory、試験カタログ、登録漏れ検査および変更影響型runnerをChecker／Coordinatorへ自己適用した。固定改訂版`ae8efe1`で決定論的回帰、Windows実Process Gateおよび独立最終レビューを完了し、指摘事項は0件。PT／LTは明示AuthorityなしでEffect 0となり、任意の未実行は通常監査またはReleaseを停止しない。未評価範囲は検証結果へ保持し、v0.20.0の統合・Release判断とは分離する |
| v0.20 実行知（Execution Intelligence） | Adopted | Ready for Release Handoff | [CHG-000062](../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[検証結果](../07_Quality/Verification_Results/2026-09-05_Execution_Intelligence_Verification.md) | Coordinatorから独立した共通コンポーネントとして、仕事Identityへ結合した閉Event、Git管理外の不変Store、欠測を保持する集約、非Authority改善候補、およびexact Identity・Hash・未解決参照0・耐久Evidenceを要求する物理清掃を実装した。Project Runtimeの発行、利用側回帰、package-local toolchainおよび非Authorityな発行診断まで接続し、固定改訂版`3aea329`の決定論的回帰と独立再レビューは指摘事項0件で完了した。未接続・未評価範囲は検証結果へ保持し、v0.20.0の統合・Release判断とは分離する |
| v0.20 Runtime責務分離 | Adopted | Design in Progress | [CHG-000063](../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[Project Runtime設計](../06_Architecture/project-runtime/01_Architecture.md)、[MCP設計](../06_Architecture/mcp/01_Architecture.md) | Project RuntimeをProject-level execution lifecycleのApplication Core、Coordinatorを実行編成、MCPをTransport、Execution Intelligenceを観測・分析、Platform AccessをOS／Platform境界へ分ける。Project RuntimeはExecution Port等の必要能力だけを要求し、Coordinator／Persistence／Platform／実行知Adapterが実装する。公開アプリケーション契約は当面Project Runtimeの公開入口として所有し、独立Lifecycleの必要性が実証される前に別packageへしない。Project RuntimeからCoordinator／Provider／MCP／OS固有実装への推移的依存0、内部Path利用0、CLI／MCP stdioの意味回帰0を完成条件とし、限定分散実行とHTTP追加の前に閉じる |
| v0.20 限定分散実行と統合結果の評価 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate) | v0.19で成立したTask Graph、最大5並列、再計画および統合を基礎に、一つの目的を安全に分解・限定並列実行し、個別Taskの合格ではなく統合後に採用可能な結果へ至ったかを評価する。依存、共有資源、Lock、判断前提、取消、再試行上限および統合後回帰を扱い、完成時間、人間の実作業時間、競合、手戻り、不要Loop、Provider利用および後工程品質を実行知へ接続する。大規模Worker Pool、Cross-project scheduling、無制限再計画または並列起動数自体の最大化を意味しない。v0.20着手時にv0.19の実装済み範囲と未検証範囲を分離し、実証Task、比較条件および完成条件をCHGで固定する |
| v0.20 Project Stateの読み取り専用投影 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-read-only-project-state-projection) | Project Runtimeが既に所有する状態と実行知から、現在の進行、実行中Task、停止理由、人間判断待ち、Recovery義務および統合結果を、非Authorityの読み取り専用結果として取得可能にする。MCP stdio／HTTPで同じcanonicalな投影を用い、ProjectionからTask、判断、Authority、成功または正本変更を生成しない。独立したPM台帳、手入力進捗率、予測機能、Topic管理またはフルProject Management機能を意味しない。v0.20着手時に最小field、現行性、unknown／未観測、情報分類、取得権限および公開契約試験をCHGで固定する |
| v0.20 ローカルMCP Streamable HTTP接続 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | v0.19で成立したMCP stdioと同じ公開アプリケーション契約へ、同じHostの`localhost`に限定したMCP Streamable HTTPから到達できる接続境界を追加する。MCP Transport、MCP固有Schema、Transport非依存の公開アプリケーション契約、Project Runtime内部Modelを分け、公開契約に内部Event、Telemetry、Provider契約または管理操作を集約しない。TransportからProject Authority、成功、Repository操作権限またはRecovery Authorityを生成せず、認証、接続先、Repository Binding、Session、取消、切断、再送、結果投影、情報最小化および資源回収を設計・検証する。LAN／Internet公開、Remote常設運用、複数Repository、Organization RuntimeまたはSelf-hosted Providerを意味しない |
| Linux対応とRemote Runtime | Held | Unscheduled | [Discoveryの保留境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-linux-remote-runtime) | 2026-09-05に一度v0.20へ採用したが、Runtime責務分離、限定分散実行、Project State投影、HTTP、Linux Platform実装およびRemote Trust Boundaryを同時に扱うScope膨張を避けるため、v0.20から除外した。ローカルMCP HTTP、Project State投影および限定分散実行の完了後に価値、対応Platform、Network・認証・運用責任および本番同等E2Eを再評価する。現在は特定版、実装着手またはReleaseを予約しない |
| v0.20以降 Project Management Projection | Exploring | Unscheduled | [Project Operation／Projection構想](#v020-project-operation-projection) | Roadmap、CHG、Work、Evidence、Gitおよび試験結果から、WBS、進捗、Milestone、阻害事項、Risk、依存、予測およびRelease準備状態を生成する候補。Viewごとの状態や手入力進捗を別正本にせず、同じCanonical Contextから非Authorityの表現として投影する。新しいProject Management正本、巨大なContext Graphまたは実装着手を本行から推定しない。採用時はPropertyごとの正本、unknown、予測精度、変更候補から正本更新までのAuthorityを固定する |
| v0.20以降 Topic／Project Attention | Exploring | Unscheduled | [Project Operation／Projection構想](#v020-project-operation-projection) | Topicは、既存のDiscovery、Decision、CHG、RoadmapまたはWorkへ情報欠落なく一意に還元できず、複数Contextを束ねて継続追跡する価値がある関心事を一時的に保持する候補である。Risk／Issueの独立正本を先に作らず、Topic内の局所的な意味とRelationから横断Viewを投影する。Attention継続と意味整理を経て既存管理単位へ分解・昇格または「何もしない」の判断で閉じる |
| v0.20以降 Meeting／Context Promotion | Exploring | Unscheduled | [Project Operation／Projection構想](#v020-project-operation-projection) | Meetingを時間境界のあるCommunication Activityとして扱い、生Transcriptではなく、そのMeetingで確認されたDecision、更新されたContext、未解決事項および参照元を保持する候補。TopicをMeetingへ所有させず、AI Chat、Slack、Review等を跨ぐAttentionと分離する。会話要約を直接正本化せず、既存Context照合と人間のAuthorityを経てCanonical Contextへ昇格する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。公開済みv0.18.0の結果と、第2段階で得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |
| 採用済み項目を除く第2段階の実行観測候補および第3～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する。将来Versionは能力地平であり、版予約、収載、期限、実装許可またはReleaseを意味しない。macOS、複数Repository、Self-hosted ProviderおよびOrganization Runtimeの実装許可を本行から推定しない。限定分散実行の評価とローカルMCP Streamable HTTP接続はv0.20へ採用し、Linux対応とRemote Runtimeは独立した保留行へ分離した |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は上表の実行項目へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、CHG-000057へ明示収載した観測だけをCurrent Scopeとし、残る候補は`Held / Unscheduled`を維持する。

## 2. v0.20開始時の再整理

v0.19.0の完了経路は[CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)と[最終署名E2E](../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.md)へ保持する。2026-09-05、人間の決定権限者は、実行知、試験体系と自動回帰、Runtime責務分離、限定分散実行と統合結果の評価、Project Stateの読み取り専用投影、およびローカルMCP Streamable HTTP接続の6項目をv0.20の改訂計画基準として固定した。当初含めたLinux対応とRemote Runtimeは、Platform実装とRemote Trust Boundaryの同時追加によるScope膨張を避けるため`Held / Unscheduled`へ戻した。v0.20.0は、ローカル前提でProject Runtimeを分離・観測可能にし、限定並列実行を安全に成立させる版とする。探索中・保留中の項目をこの範囲へ暗黙追加しない。後から計画を変更する場合は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および必要な変更トレースを明示し、過去の計画基準を遡及上書きしない。

<a id="v020-project-operation-projection"></a>

### 2.1. Project Operation／Project Management Projection構想

本構想は、JIRA、Notion、Excel WBS等をCRDD内へ再実装するものではない。既存のRoadmap、Discovery、Decision、CHG、Work、Evidence、Git、試験、監査およびReleaseをProject運営に必要な形へ構造化し、Project Modelから目的別のViewを生成する候補である。現在の採用済み6項目へ自動追加せず、読み取り専用Project State投影と実行知の結果を確認した後に、採否と実装範囲を人間が決める。

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

## 3. 境界

[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
