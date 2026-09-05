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
| v0.20 実行知（Execution Intelligence） | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-execution-intelligence) | AI WorkをProject／Milestone／Objective／Task／Attemptへ結合し、実行、成果物、人間受入、運用・事業結果を混同せず評価する。Provider、Model、Agent／Operation、入出力Token、Cache、費用／Credit、Latency、Retry、結果、Prompt Versionおよび品質評価のうち取得できる事実を共通Telemetry候補として扱い、取得不能値を推測しない。目的は監視製品の再実装ではなく、Provider／Model／Prompt／Context投入と人間負荷を比較して改善判断へ接続することである。Git管理外の実行履歴、集約と正本昇格の分離、改善候補→人間判断→実験→採用のLoopをv0.20開始時に具体化する。Runtimeの退避Directoryや隔離物についても、耐久Evidenceと物理残存を分け、exact Identityと未解決参照を確認した有限保持・件数上限・再入場可能な清掃を設計する。時間または名前だけの自動削除や、由来不明の既存退避物の一括削除は行わない。v0.19の完成条件、実行記録の収集開始、巨大Dashboard、全推論保存、全Provider指標の同一化または自動自己変更を意味しない。v0.20着手判断時にCurrent Stateと実行可能な差分を再確認してCHGを作成する |
| v0.20 限定分散実行と統合結果の評価 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate) | v0.19で成立したTask Graph、最大5並列、再計画および統合を基礎に、一つの目的を安全に分解・限定並列実行し、個別Taskの合格ではなく統合後に採用可能な結果へ至ったかを評価する。依存、共有資源、Lock、判断前提、取消、再試行上限および統合後回帰を扱い、完成時間、人間の実作業時間、競合、手戻り、不要Loop、Provider利用および後工程品質を実行知へ接続する。大規模Worker Pool、Cross-project scheduling、無制限再計画または並列起動数自体の最大化を意味しない。v0.20着手時にv0.19の実装済み範囲と未検証範囲を分離し、実証Task、比較条件および完成条件をCHGで固定する |
| v0.20 MCP Streamable HTTP接続 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-mcp-streamable-http) | v0.19で成立したMCP stdioの公開Project Runtime契約へ、MCP Streamable HTTPから同じ意味で到達できる外部接続境界を追加する。TransportからProject Authority、成功、Repository操作権限またはRecovery Authorityを生成せず、認証、接続先、Repository Binding、Session、取消、切断、再送、結果投影、情報最小化および資源回収を設計・検証する。本項目単独ではRemote常設運用、Internet公開、複数Repository、Organization RuntimeまたはSelf-hosted Providerの採用を意味しない。Linux Hostでの限定Remote構成は別のv0.20採用項目として接続する。v0.20着手時に既存stdio契約との差分、利用者Journey、Trust Boundary、対応Platform、正常・準正常・異常経路および完成条件を具体化してCHGを作成する |
| v0.20 Linux対応とRemote Runtime | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-linux-remote-runtime) | Project RuntimeのPlatform ContractへLinux Adapterを実装し、Linux Host上のRuntimeへMCP Streamable HTTPを通じて接続できる限定Remote構成を成立させる。Windows方式の移植ではなく同じ安全保証をLinuxのProcess、Filesystem、Lock、Container、Runtime RootおよびRecoveryで実現し、Remote Host、Network、認証、暗号化、replay防止、情報保持、監査、取消および運用責任を新しいTrust Boundaryとして設計・検証する。Internet一般公開、複数Repository、Organization Runtime、Self-hosted ProviderまたはmacOS対応を意味しない。v0.20着手時にLocal／Remoteの利用者Journey、配置、更新、停止・復旧、対応Linux範囲および本番同等E2EをCHGで固定する |
| v0.20 Project Stateの読み取り専用投影 | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-read-only-project-state-projection) | Project Runtimeが既に所有する状態と実行知から、現在の進行、実行中Task、停止理由、人間判断待ち、Recovery義務および統合結果を、非Authorityの読み取り専用結果として取得可能にする。MCP stdio／HTTPで同じcanonicalな投影を用い、ProjectionからTask、判断、Authority、成功または正本変更を生成しない。独立したPM台帳、手入力進捗率、予測機能、Topic管理またはフルProject Management機能を意味しない。v0.20着手時に最小field、現行性、unknown／未観測、情報分類、取得権限および公開契約試験をCHGで固定する |
| v0.20以降 Project Management Projection | Exploring | Unscheduled | 本対話で保持した次版候補。既存のProject Runtime、実行知およびCRDD／Git正本との責務境界をv0.19完了後に再評価する | Roadmap、CHG、Work、Evidence、Gitおよび試験結果から、進捗、Milestone、阻害事項、Risk、依存、予測およびRelease準備状態を表示する候補。WBSや進捗率を別正本へ二重入力せず、CRDD／Gitの事実から生成する非AuthorityのProjectionとする。新しいProject Management正本、巨大なContext Graphまたは実装着手を本行から推定しない。v0.19完了後に実行知との順序、最小表示、必要な追加情報、精度限界および採否を人間が具体化する |
| v0.20以降 Topic／Project Attention | Exploring | Unscheduled | 本対話で保持した概念候補。Project Management Projectionの設計開始時に既存管理単位で表現できない実例を再確認する | Topicは、既存のDiscovery、Decision、CHG、RoadmapまたはWorkへ情報欠落なく一意に還元できず、複数Contextを束ねて継続追跡する価値がある関心事を一時的に保持する候補である。Backlogや新しい恒久正本の代替にせず、Attention継続と意味整理を経て既存管理単位へ分解・昇格または「何もしない」の判断で閉じる。単に曖昧な発話、一意に分類可能な事項、会話履歴の全件保存からTopicを作らない。v0.19完了後に必要性、最小Model、統合・分割・終了条件、Project Projectionへの表示およびCoreへ加える妥当性を人間が具体化する |
| v0.20 試験体系と自動回帰 | Adopted | Planned | 本対話で採用したv0.20候補。v0.20着手時に品質保証、アーキテクチャおよび実装規約のCurrent Stateを再確認する | 単体試験、結合試験、総合試験および回帰試験の責務、相互に代替できない保証、正常・準正常・異常の代表観点、設計・変更から試験義務への追跡を標準化する。回帰試験は変更影響と固定候補に応じて自動実行し、人間確認を機械検証可能な項目へ重ねない。受入試験は利用者・業務上の判断が成果を左右する場合、性能／負荷／長時間試験は非機能要求、規模、資源上限または長期安定性Riskがある場合に発火し、理由付き非該当を許す。コーディングAgentやモデルの違いは試験義務を弱める理由にせず、初回成立率やFinding傾向の観測対象とする。v0.19の完成条件へ追加せず、v0.20着手時に用語、発火・非発火・境界・情報不足例、既存Fixture／契約試験／E2Eとの移行を具体化してCHGを作成する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。公開済みv0.18.0の結果と、第2段階で得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |
| 採用済み項目を除く第2段階の実行観測候補および第3～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する。将来Versionは能力地平であり、版予約、収載、期限、実装許可またはReleaseを意味しない。macOS、複数Repository、Self-hosted ProviderおよびOrganization Runtimeの実装許可を本行から推定しない。限定分散実行の評価、MCP Streamable HTTP接続、およびLinux対応とRemote Runtimeは人間の決定によりv0.20の採用項目へ移した |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は上表の実行項目へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、CHG-000057へ明示収載した観測だけをCurrent Scopeとし、残る候補は`Held / Unscheduled`を維持する。

## 2. v0.20開始時の再整理

v0.19.0の完了経路は[CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)と[最終署名E2E](../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.md)へ保持する。2026-09-05、人間の決定権限者は、実行知、試験体系と自動回帰、限定分散実行と統合結果の評価、MCP Streamable HTTP接続、Linux対応とRemote Runtime、およびProject Stateの読み取り専用投影の6項目をv0.20の計画基準として固定した。探索中・保留中の項目をこの範囲へ暗黙追加しない。後から計画を変更する場合は、変更理由、影響する利用側・完成条件、追加・除外・保留の処置および必要な変更トレースを明示し、過去の計画基準を遡及上書きしない。

## 3. 境界

[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)は、v0.19で成立したProject Runtime機能の実務評価としてv0.20へ再編した。実装済み機能を未実装として作り直さず、実証で確認する差分だけを変更トレースへ固定する。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
