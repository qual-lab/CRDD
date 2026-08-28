# 変更トレース: v0.18.0候補の統合とArchitecture Candidate再基準化

変更ID: `CHG-000014`
状態: `Ready for Verification`
担当責任者: Qual-Lab
最終更新日: 2026-08-28
対象系列: v0.18.x
対象バージョン: v0.18.0 Candidate
変更分類: `breaking`（統合差分としての候補、最終確認前）
リリースレベル: `MINOR`（候補、最終確認前）
`migration_required`: `true`（規範変更候補。Architecture Candidateの同居だけからは発火しない）

正本規則: [変更](../../12_Change.md)

## 1. 人間による判断と目的

Qual-Labの人間の決定権限者は、Current Decision Set候補とCommunication候補を一つの統合候補branchへまとめ、旧v2からv1候補へ再基準化した7文書を、v0.18.0 Architecture Candidateとして評価することを承認した。

この判断は対象Versionと候補表示の決定であり、v0.18.0準拠、Architectureの規範採用、Authority拡張、Runtime有効化、main統合、CHANGELOG、タグまたはReleaseの承認ではない。

## 2. 統合した来歴

| 系列 | Source Commit | 統合時の扱い |
|---|---|---|
| Current Decision Set | `dd617e7f15d413e363d041b0008922ebe89d811c` | v1系列候補として統合した来歴を保持し、v0.18.0規範変更候補として再識別 |
| Communication | `04350294ff4031af09893edf21c136cbadbb01be` | v1系列候補として意味mergeした来歴を保持し、v0.18.0規範変更候補として再識別 |
| 旧v2 Architecture | `cd9795d885f3500ab2ef43a25c37c3737fd01e21` | 旧v1 Architecture Candidateを経て、7文書を非規範v0.18.0 Architecture Candidateへ再基準化 |

旧系列のCommitとmerge履歴は来歴として保持するが、旧branchを継続同期元、自動上書き元、採用基準またはReleased baselineとして扱わない。今後の変更は、公開基準、規範変更候補、Architecture Candidate間の意味差を新しい変更として評価する。

## 3. CHG IDの一意化

Communicationのsource Commitでは`CHG-000012_Communication_Market_and_Adoption_Exploration.md`を暫定使用していたが、Current Decision Setも`CHG-000012`を使用していた。人間の決定により、統合候補の有効IDを次に固定した。

- `CHG-000012`: Current Decision Set
- `CHG-000013`: Communicationの市場・採用探索
- `CHG-000014`: 本統合とArchitecture Candidate再基準化

Communicationの旧IDと旧ファイル名はsource Commitを解釈する来歴であり、現在の別名または有効IDとして使用しない。

## 4. 三つの状態境界

| 区分 | 内容 | 現在成立しないもの |
|---|---|---|
| 公開済みCRDD v0.17.0 | 現在の公開基準 | 本候補による自動変更 |
| v0.18.0規範変更候補 | Current Decision Set、Communication、Candidate文書表示契約 | v0.18.0準拠、移行完了、main統合、タグ、Release |
| v0.18.0 Architecture Candidate | Re-evaluation、Operation、Coordinator、Runtime安全、Operation Health、Forward Compatibility、Provider Routing | 規範採用、AI自動読込、Authority、Capability有効化、固定製品・UI・Agent構成 |

同じbranch、Commit、READMEまたはRoadmapに存在することを、後段の成立根拠にしない。

## 5. Architecture文書のrenameと意味変更

| 旧v2名称 | 統合時の旧v1名称 | 現名称 |
|---|---|---|
| `01_CRDD_v2_Concept.md` | `01_CRDD_v1_Concept.md` | `05_Autonomous_Operation.md` |
| `02_CRDD_v2_Responsibility_Boundary.md` | `02_CRDD_v1_Responsibility_Boundary.md` | `05_Autonomous_Operation.md` |
| `03_CRDD_v2_PoC_Plan.md` | `03_CRDD_v1_PoC_Plan.md` | `99_Roadmap/01_Product_Roadmap.md` |
| `04_CRDD_v2_Autonomous_Safety_Architecture.md` | `04_CRDD_v1_Autonomous_Safety_Architecture.md` | `05_Autonomous_Operation.md` |
| `05_CRDD_v2_Operation_Health_and_Human_Interface.md` | `05_CRDD_v1_Operation_Health_and_Human_Interface.md` | `05_Autonomous_Operation.md` |
| `06_CRDD_v2_Forward_Compatibility.md` | `06_CRDD_v1_Forward_Compatibility.md` | `05_Autonomous_Operation.md` |
| `07_CRDD_v2_Agent_and_Provider_Orchestration.md` | `07_CRDD_v1_Agent_and_Provider_Orchestration.md` | [`04_Agent_Organization.md`の非規範実行Architecture候補](../../04_Agent_Organization.md#12-execution-architecture) |

renameだけでなく、旧系列分離、同期方向、旧v1／v2候補との来歴、Target、相互リンクおよびREADME英日を、公開済みv0.17.0、v0.18.0規範変更候補、非規範v0.18.0 Architecture Candidateの境界へ再基準化した。

2026-08-25の文書責務是正では、Roadmapに育った恒久Architectureをルート候補正本へ移し、未完了作業だけを単一の`99_Roadmap/01_Product_Roadmap.md`へ残した。概念、責務、安全、Operation HealthおよびForward Compatibilityは`05_Autonomous_Operation.md`、Agent／Provider Orchestrationは[`04_Agent_Organization.md`の非規範実行Architecture候補](../../04_Agent_Organization.md#12-execution-architecture)へ統合した。旧PoC計画の未完了候補はProduct Roadmapへ縮約し、完了状態の保管や第二の正本となる旧Roadmap詳細は削除した。旧名称と固定改訂版は本CHGおよびGit履歴から再構成し、現在の参照先として使用しない。

<a id="51-未終了変更トレースの移管スナップショット"></a>

## 5.1. 未終了変更トレースの移管スナップショット

次表は文書移管を監査した固定改訂版`e2933955cc84ec325137d01d5d6af8897b9ea48d`時点で、全54件のCHGをProduct Roadmapの主要表示または理由付き終了へ全数割り当てた移管確認スナップショットである。各CHGの現在状態を所有する第二の状態台帳ではなく、以後更新しない。現在状態は各CHG、未完了事項の主要表示はProduct Roadmapを決定権限とする。

| 固定時点の対象 | 固定時点の状態 | 移管先または終了理由 |
|---|---|---|
| `CHG-000001`～`CHG-000006` | `Released` | 公開済み変更として各CHG、CHANGELOGおよびRelease履歴から追跡できるため、Product Roadmapへ登録しない |
| `CHG-000007`～`CHG-000014`、`CHG-000024` | `Ready for Verification` | Product Roadmapの「v0.18.0 Candidateの未終了CHG確認、最終固定、CHANGELOG、統合およびRelease判断」へ割当。各変更の意味と検証は各CHGが所有する |
| `CHG-000015` | `Draft` | Product Roadmapの「Coordinator Runtime 1.0の正式署名一般Task実行」へ割当 |
| `CHG-000016`、`CHG-000018`～`CHG-000023`、`CHG-000025`～`CHG-000029` | `Verified` | Runtimeの部品変更として「Coordinator Runtime 1.0の正式署名一般Task実行」と最終Release判断へ割当。`Verified`だけを変更トレースの終了とみなさない |
| `CHG-000017` | `Reopened` | Product Roadmapの「未リリース命名／文書Architecture是正の再検証」へ割当 |
| `CHG-000030` | `Close without Release` | 理由付き終了が同CHGから追跡できるため、Product Roadmapへ登録しない |
| `CHG-000031`～`CHG-000035` | `In Review` | Product Roadmapの「Coordinator Runtime 1.0の正式署名一般Task実行」へ割当 |
| `CHG-000036`～`CHG-000038` | `In Progress` | Product Roadmapの「Coordinator Runtime 1.0の正式署名一般Task実行」へ割当 |
| `CHG-000039`～`CHG-000053` | `Implementation in Progress` | Product Roadmapの「Coordinator Runtime 1.0の正式署名一般Task実行」へ割当 |
| `CHG-000054` | `Reopened` | Product Roadmapの「未リリース命名／文書Architecture是正の再検証」へ割当 |

この表は状態の重複管理に使用しない。Product Roadmapは上記のまとまりを現在の未完了作業として表示し、個々の状態、結果、Evidence、残存リスクまたはリリース処置を複製しない。

## 5.2. 旧PoC計画の節別移管

削除した`99_Roadmap/03_CRDD_v0_18_PoC_Plan.md`は非規範の実証計画だったが、単なる進捗表示を超える再利用可能な内容を含んでいた。次表は旧節を一意に処置した移管証跡であり、Product Roadmapへ本文を再構築しない。

| 旧節 | 処置 | 現在の所有先／理由 |
|---|---|---|
| 1. Core Architectureと最初のActivation | ルート候補正本へ移管 | [仕様とActivationの分離](../../05_Autonomous_Operation.md#41-仕様とactivationの分離)。Profileは成熟度や品質等級でなく、Trigger、接続、CapabilityおよびAuthorityの有効化範囲である意味を保持 |
| 2. 最小Reference Implementation | ルート候補正本とRoadmapへ分担 | [自律Operationの中心仮説](../../05_Autonomous_Operation.md#1-中心仮説)が固定Workflow化しない実証意図を、Product Roadmapの「自律Operationの参照実証」が未完了の選定を保持。専用Server等を作らないという当時の実装案は恒久要件にしない |
| 3. 週次プロダクトレビュー | ルート候補正本へ移管 | [参照Operation実証](../../05_Autonomous_Operation.md#reference-operation-experiments) |
| 4. Communication結果レビュー | ルート候補正本へ移管 | 同じ[参照Operation実証](../../05_Autonomous_Operation.md#reference-operation-experiments)。Audience、Claim、Evidence、方向および公開Authorityの維持を固有条件として保持 |
| 5. Roadmap再評価 | ルート候補正本へ移管 | 同じ[参照Operation実証](../../05_Autonomous_Operation.md#reference-operation-experiments)。登録時判断、前提変化、再評価乱発防止および採用短絡禁止を保持 |
| 6. Repository Event | ルート候補正本へ移管 | 同じ[参照Operation実証](../../05_Autonomous_Operation.md#reference-operation-experiments)。Eventと意味変更、根拠付きNo-impactおよび再帰抑止を分離 |
| 7.1～7.5. 探索／推論／Authority／出力／運用 | ルート候補正本へ移管 | [共通評価軸](../../05_Autonomous_Operation.md#112-共通評価軸)と既存のOperation Health測定へ統合 |
| 7.6. Forward Compatibility fixtures | ルート候補正本へ移管 | [将来互換性の確認候補](../../05_Autonomous_Operation.md#6-将来互換性の確認候補) |
| 7.7. Agent／Provider Routing fixtures | ルート候補正本へ移管 | [非規範の実行Architecture候補](../../04_Agent_Organization.md#12-execution-architecture)と[安全境界の合成Fixture](../../05_Autonomous_Operation.md#14-pocで確認する境界)へ分担 |
| 7.8. Coordinator Result Integration fixtures | ルート候補正本へ移管 | [Coordinatorによる結果統合](../../05_Autonomous_Operation.md#44-coordinatorによる結果統合)と[安全境界の合成Fixture](../../05_Autonomous_Operation.md#14-pocで確認する境界)へ分担 |
| 8. 避けるべき失敗 | 既存候補正本へ統合 | Workflow固定、Trigger乱発、Proposal Spam、コンテキスト過剰共有、Core肥大化および自律性の自己拡張は、[エージェント組織のNon-goals](../../04_Agent_Organization.md#13-agent-organization-non-goals)、[自律Operationで新設しないもの](../../05_Autonomous_Operation.md#6-新設しないもの)、[安全不変条件](../../05_Autonomous_Operation.md#13-安全不変条件候補)および[Operation Health](../../05_Autonomous_Operation.md#7-operation-health)へ包含。重複本文は保持しない |
| 9. Activation Profile 0～5／Continuous Product Evolution | ルート候補正本へ移管 | [仕様とActivationの分離](../../05_Autonomous_Operation.md#41-仕様とactivationの分離)へ各段階の意味と自動昇格禁止を保持 |
| 10. 次の具体的処置 | 未完了だけRoadmapへ縮約 | Product Roadmapの「自律Operationの参照実証」。固定Prompt化せず、合成Fixture、判断価値、誤起動、見逃し、費用、人間負荷を評価する。完了済みまたは正本化済みの手順は削除 |

この移管では、旧PoCの四実験、評価軸、安全Fixture、将来互換Fixture、Routing／Result Integration FixtureおよびActivation段階の意味を保持した。旧ファイル名、旧番号、当時の固定実装案または進捗状態だけを恒久正本として残さない。

## 6. 契約母集団と代表ケース

| ケース | 期待結果 |
|---|---|
| 現在必要な人間判断 | 現在の判断集合へ残し、決定権限者へ提示する |
| 将来必要だが現在の作業を阻害せず安全に独立保留できる判断 | 担当、再評価契機、保留影響、元根拠へ接続し、現在の判断集合から除外する |
| 現在必要な重大リスク、不可逆Effect、残存リスク受容またはAuthority競合 | 将来判断として除外せず、停止または人間へ移送する |
| 判断0件 | 形式承認を作らず、現在人間判断不要と明示する |
| 通常Communication | 市場探索を無条件発火させず、通常責務を維持する |
| 市場・採用探索のAND条件が成立 | Discovery正本へ接続して追加探索する |
| AND条件に偽がなく少なくとも一方が不明 | 通常Communicationを維持し、追加探索だけ確認待ちとする |
| Communication非適用 | 空のCommunication成果物を作らない |
| 許可した処理境界内のOperation | 既存Policyと完了条件に従い、外部EffectやPromotionを推定しない |
| 境界、AuthorityまたはCurrent Revisionが不明 | Fail Closedとし、人間または再評価へ戻す |
| 正式Findingを是正 | 更新固定改訂版、再検証、必要な独立再レビューを経るまで`Resolved`にしない |
| Findingなし・Review非該当の軽量Operation | 新しいReview、承認、状態または擬似`Resolved`を追加しない |
| Architecture Candidateが同じbranchに存在 | v0.18.0準拠、規範採用、Authority、Runtime実装またはReleaseを成立させない |

## 7. 変更禁止範囲

- Architecture Candidateの内容を`01_Principles.md`、`10_Agent.md`、`11_Skill.md`、準拠基準その他の現行正本へ先取り移植しない。
- Current Decision SetまたはCommunicationの片側を、重複利用側の競合解消で失わない。
- 新しい成果物、状態軸、承認段階、中央台帳、固定Schema、固定Coordinator製品、Queue UIまたはAgent構成を要求しない。
- Human Authority、External Information Boundary、Independent Review、Promotion、Policy-contained Completionを弱めない。
- 公開済みタグ、過去CHANGELOGまたはmainを変更しない。正本文書はv0.18.0 Candidateとして識別するが、StableまたはReleasedとして扱わない。

## 8. 固定と検証

旧3系列のChecker、レビューおよび監査のPassは統合候補の合否へ流用しない。内容統合と実差分照合後に新しいCommit／Treeを固定し、リポジトリ全体Checkerを一度実行して共通入力とする。

必須監査集合は次の3系統である。

1. Agent／Architecture Review: Coordinator、Current Decision Set、Independent Review、Communication／Discovery、人間対象調査、Security／Privacy／External Information Boundaryを含む。
2. Document Audit: rename、相互リンク、README英日、CHG一意性、用語、正本重複、候補とRelease境界を含む。
3. Gap／Impact＋Conformance Audit: 契約母集団、利用側母集団、現行v0.17.0準拠非影響、移行候補および非規範Architecture境界を含む。

現在状態は`Ready for Verification`である。対象Versionはv0.18.0 Candidateへ確定し、統合差分の最上位分類は`breaking`（候補）、リリースレベルは`MINOR`（候補）である。固定後Identity、Checker、3監査、分類の最終確認、正式移行内容、CHANGELOG、CandidateからStableへの昇格、main統合、タグ、公開およびReleaseは未完了であり、取得前にPassまたはRelease Handoffを先取りしない。

初回統合固定候補`c9ba7579165865052024f3904ff9f5d86db48e90`では、全体Checker自体は155ファイル、Markdown 112件、ローカルリンク1,649件、アンカー551件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件を確認し、Error 0／Warning 0だった。一方、固定時の`git diff --check`で旧文書から継承した3箇所の行末空白を検出したため、この固定候補とChecker結果は現在判定へ使用せず`Invalidated`とする。行末空白だけを是正した新固定版へCheckerと3監査を取り直す。

第2統合固定候補はCommit `b94d02ec0d9dd804fc21a063959468f7d9b5509f`、Tree `0da44f44e12d6637750bffd97d5b57556bfb4f02`、base差分26ファイルである。`git diff --check`はcleanで、全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,649件、アンカー551件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件を確認し、Error 0／Warning 0だった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Fail`。`AG-V1-INT-001`（Major）として、Current Decision Set正本で強化した将来判断の安全な独立保留条件がArchitecture Candidateの3利用側へ伝播していないことを検出し、今回の統合修正によって新たに発生した指摘と分類した。
- Document Audit: `Conditional`。`DOC-V1I-01`（Minor）として、実質変更した正本文書10件の`Last Updated`が旧日のままであることを検出した。第2候補に対する初回監査Findingであり、無効化済み第1候補との比較では初回監査時から存在した見落としに相当する。
- Gap／Impact＋Conformance Audit: `Fail`。`GCI-V1-001`（Major）として`AG-V1-INT-001`と同じ根本原因を検出し、今回の統合修正によって新たに発生した指摘と分類した。

監査集合にFailとConditionalが含まれるため、第2統合固定候補、Checkerおよび3監査結果の全体を`Invalidated`とし、現在の合否、Finding解消、Release Handoff、対象Version、移行またはRelease根拠へ流用しない。Checkerの実行事実と数値は履歴としてのみ保持する。

統合修正方針は3監査へ編集前に再提示し、競合、追加の人間判断または停止条件なしで受理された。適用した処置は次のとおりであり、この時点では`Applied`であって`Resolved`または`Pass`ではない。

1. `02`と`07`で、将来判断を現在の作業等へ影響せず、安全に独立保留でき、追跡4項目へ接続できる場合だけ現在のDecision Queueから除外するAND条件へ統一した。
2. `03`のFixtureを、安全保留の正例、条件・影響不明の負例、現在影響・重大Risk・不可逆Effect・Authority競合等の停止／移送例へ分けた。
3. `00`、`02`、`10`、`11`、`16`、`17`、`21`、`51`、`52`、`53`の`Last Updated`だけを2026-08-11へ更新し、Version、Status、規範本文、CHANGELOG、mainおよびReleaseは変更しなかった。
4. `11`の意味正本、`01`／`05`等の参照利用側、非規範Architecture境界、新成果物・状態・Authority・Schemaを追加しない境界を維持した。

第2候補のbase差分母集団26ファイルに対し、上記処置でメタデータおよびArchitecture利用側を更新した。現在状態は引き続き`Ready for Verification`であり、新固定Commit／Tree、全体Checkerおよび3監査を取り直すまで、既知Findingを`Resolved`としない。

第3統合固定候補はCommit `9d9d92c4bac1a90dde25ae165cb5ec443b8abf69`、Tree `01fbbd8e8b9f0e9e4a3df4839cd0ef7406df7ad5`であり、全体CheckerはError 0／Warning 0、Agent／Architecture Review、Document Audit、Gap／Impact＋Conformance Auditはいずれも`Pass`だった。続くCommit `32f9780555f63acaa9a098b7917237e6b9f4e3b3`では、Architecture Candidateが単独では提供しないRuntime能力と、外部Adapterの接続がAuthorityを意味しない境界をREADME英日へ追加し、局所独立レビューは`Pass`だった。

その後、人間の決定権限者は統合候補の対象Versionをv0.18.0へ変更した。この変更は、Candidateヘッダー契約、26正本文書、README英日、3つのCHGおよび7 Architecture文書の名称・Target・相互参照へ影響するため、`9d9d92c`および`32f9780`のCheckerとレビュー結果を現在の合否、v0.18.0 Candidateの解消、準拠またはRelease根拠へ流用しない。現在の変更は`Applied`であり、新固定版のCheckerと3監査が完了するまで`Resolved`または`Pass`としない。

v0.18.0 Candidateへの再基準化は39論理ファイルを対象とする。内訳は、候補ヘッダーを揃える26正本文書、README、CHG-000012〜000014、renameする7 Architecture文書、候補と公開基準を区別するChecker実装およびそのテストである。Checkerは`Candidate`の場合に26文書の`Released Baseline`一致を確認し、現行Release検査には候補Versionではなく公開基準を使用する。これはCandidateを準拠またはRelease済みと判定する機構ではない。

第4統合固定候補はCommit `a83decc2c0fb9e714191df070105e8737c89c0cd`、Tree `db1cd23724602263647e3b5ad2983743160aef9f`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,649件、アンカー551件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト141件はすべてPass、`git diff --check`はcleanだった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Fail`。`AG-V018-001`（Major）としてCandidateの共通意味と文書固有意味の競合、`AG-V018-002`（Major）としてCandidateからStableへの変更を同一固定改訂版として扱うIdentity誤認を検出した。いずれもv0.18.0再基準化で新たに発生した指摘である。
- Document Audit: `Fail`。`DOC-V018-01`（Major）として、CHG-000013の一部が対象Version決定前の「Version未確定」を残していることを検出した。v0.18.0再基準化で新たに発生した指摘である。
- Gap／Impact＋Conformance Audit: `Fail`。`GCI-018-01`（Major）として`AG-V018-001`と同じCandidate意味競合、`GCI-018-02`（Minor）として統合候補の最上位分類とリリースレベルが対象Version決定へ追従していないことを検出した。いずれもv0.18.0再基準化で新たに発生した指摘である。

3監査にFailが含まれるため、第4統合固定候補、Checker、テストおよび監査集合全体を`Invalidated`とし、現在の合否、Finding解消、準拠、Release HandoffまたはRelease根拠へ流用しない。機械確認とテストの実行事実、個別監査結果および数値は履歴として保持する。

統合修正方針は3監査へ編集前に再提示し、競合、追加の人間判断または停止条件なしで受理された。適用した処置は次のとおりであり、この時点では`Applied`であって`Resolved`または`Pass`ではない。

1. `02`のCandidateをLifecycle順序に依存しない共通意味へ修正し、`03`で文書固有のCandidate状態へ接続した。
2. Candidateからリリース準備版、最終Stable版へ進むたびに新しい改訂版を固定し、旧確認結果を流用せず、最終確認済みIdentityを人間のRelease判断とタグへ一致させるLifecycleを`03`、`19`、`51`へ反映した。
3. CheckerでCandidate以外に残る`Released Baseline`を拒否し、DraftとStableの負例を追加した。
4. CHG-000013を対象Version決定済みの現在状態へ統一し、本CHGの統合分類を`breaking`（候補）、リリースレベルを`MINOR`（候補）へ更新した。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checker、Checkerテストおよび3監査を取り直すまで、上記Findingを`Resolved`とせず、最終分類、正式移行内容、CHANGELOG、Stable化、main統合、タグ、公開またはReleaseを先取りしない。

第5統合固定候補はCommit `38b9904e8109c0fcf2a8776658331642bec3d7da`、Tree `c542cb126558c86e06a51afecdf0de0b35516cc9`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,652件、アンカー554件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト143件はすべてPass、`git diff --check`はcleanだった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Fail`。前回5件の解消を確認したうえで、`AG-V018-R01`（Major）としてRelease判断と最終Identityの時間順序が一意でないことを検出した。
- Document Audit: `Fail`。前回Findingの解消を確認したうえで、同根の`DOC-V018-R01`（Major）として最終Identityが存在する前後でRelease判断が矛盾することを検出した。
- Gap／Impact＋Conformance Audit: `Fail`。前回Findingの解消を確認したうえで、同根の`GCI-018-R01`（Major）としてRelease判断が二重化し得るAuthority／Identity矛盾を検出した。

3監査に同根のFailが含まれるため、第5統合固定候補、Checker、テストおよび監査集合全体を`Invalidated`とし、現在の合否、Finding解消、準拠、Release HandoffまたはRelease根拠へ流用しない。新規候補はいずれも前回是正によって新たに発生した指摘であり、処置は次の新固定版で再監査されるまで`Applied`に留める。

統合修正では、Candidate準備版、最終Stable候補版、最終Release判断およびタグの順序を一意化した。人間が対象Candidate版と許可する機械的遷移をリリース計画で事前に特定した場合だけ最終Stable候補版を作成し、その作成自体をRelease判断としない。最終Commit／Treeへ必要な確認を行い、人間はそのIdentityを対象に一度だけReleaseを判断し、承認時だけ同じIdentityへタグを付与する。宣言外差分または確認失敗は停止して再判断へ戻し、タグ後のIdentity確認は軽量な結果記録とする。`19`をLifecycle正本、`51`をRelease前後の監査利用側、`52`を準拠非推定の利用側として更新した。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checkerおよび3監査を取り直すまで、`AG-V018-R01`、`DOC-V018-R01`および`GCI-018-R01`を`Resolved`とせず、Release Handoffを先取りしない。

第6統合固定候補はCommit `6dcf4637ae4a6d4e8937ab2c24e1a1f7859fe68c`、Tree `ae55571786106c893bc0fcbf2666ee427517537b`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,653件、アンカー555件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト143件はすべてPass、`git diff --check`はcleanだった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Fail`。`AG-V018-R02`（Major）は、最終Release候補を確認した後にRelease対象branchへ統合するとCommit／Treeが変わり得るため、人間の最終Release判断とタグが統合前Identityを指し得ることを指摘した。
- Document Audit: `Pass`。未解決Finding 0件。
- Gap／Impact＋Conformance Audit: `Pass`。未解決Finding 0件。

必須監査集合にFailが含まれるため、第6統合固定候補、Checker、テストおよび監査集合全体を`Invalidated`とし、現在の合否、Finding解消、準拠、Release HandoffまたはRelease根拠へ流用しない。個別のPassは実行履歴として保持するが、Failへ書き換えず、集合全体の合否とは分ける。`AG-V018-R02`は第5候補の是正によって新たに発生した指摘である。

統合修正では、設定されたRelease対象branchと統合権限を取得し、対象branchへの統合を最終Release判断より前へ移した。統合前source、対象branchの事前HEAD、統合後Commit／Tree、公開基準からの全Release差分、対象CHGおよび宣言外差分を確認し、Identity変化時は差分種別に応じて新固定版へCheckerと必要な監査を取り直す。対象branchが不明、競合またはアクセス不能なら`main`へ暗黙fallbackせず停止する。人間のRelease判断は統合後に確認済みの最終Identityを一度だけ対象とし、承認後のタグも同じIdentityを指す。処置は`Applied`であり、新固定版の監査前に`Resolved`または`Pass`と扱わない。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checker、Checkerテストおよび3監査を取り直すまで、`AG-V018-R02`を`Resolved`とせず、最終分類、正式移行内容、CHANGELOG、Stable化、対象branch統合、タグ、公開またはReleaseを先取りしない。

第7統合固定候補はCommit `7653cb25737880d6415ad4881d773e9637cd4526`、Tree `cec106cd91ea6029dce9232bbf6dce795cda47aa`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,653件、アンカー555件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト143件はすべてPass、`git diff --check`はcleanだった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Pass`。未解決Finding 0件。
- Document Audit: `Pass`。未解決Finding 0件。
- Gap／Impact＋Conformance Audit: `Fail`。`GCI-V018-R03`（Major）は、§5.1の対象branch統合後Identity契約が、同じ正本の§5.3 Release Readinessチェックリストへ伝播していないことを指摘した。

必須監査集合にFailが含まれるため、第7統合固定候補、Checker、テストおよび監査集合全体を`Invalidated`とし、現在の合否、Finding解消、準拠、Release HandoffまたはRelease根拠へ流用しない。個別のPassは実行履歴として保持し、Failへ書き換えない。`GCI-V018-R03`は第6候補の是正によって新たに発生した指摘である。

統合修正では、§5.3へ、設定されたRelease対象branchと統合決定権限、Release判断前の統合、統合後Commit／Treeの固定、Identity変化と全Release差分に応じた必要確認、判断またはタグ付与までのbranch HEAD／最終Identity不変を確認する一項目を追加した。条件を確認できない場合はRelease Readinessを成立させず、再固定と必要な確認へ戻る。処置は`Applied`であり、新固定版の監査前に`Resolved`または`Pass`と扱わない。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checker、Checkerテストおよび3監査を取り直すまで、`GCI-V018-R03`を`Resolved`とせず、最終分類、正式移行内容、CHANGELOG、Stable化、対象branch統合、タグ、公開またはReleaseを先取りしない。

第8統合固定候補はCommit `75297a803a4d7b563192b2b24a7592170f58fcbb`、Tree `64866edb2403a9ef2bd31b43b637898582ab1dba`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,653件、アンカー555件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト143件はすべてPass、`git diff --check`はcleanだった。

同固定候補への監査結果は次のとおりである。

- Agent／Architecture Review: `Pass`。未解決Finding 0件。
- Document Audit: `Fail`。`DOC-V018-R04`（Major）は、§5.3のRelease前チェックリストが既存行でタグ実在を要求するよう読め、§5.1および`51`のRelease承認後タグ付与と循環することを指摘した。
- Gap／Impact＋Conformance Audit: `Pass`。未解決Finding 0件。

必須監査集合にFailが含まれるため、第8統合固定候補、Checker、テストおよび監査集合全体を`Invalidated`とし、現在の合否、Finding解消、準拠、Release HandoffまたはRelease根拠へ流用しない。個別のPassは実行履歴として保持し、Failへ書き換えない。`DOC-V018-R04`は初回監査時から存在したが見落としていた指摘である。

統合修正では、§5.3のタグ項目を、Release前には予定タグ対象と統合後の確認済み最終Identityの一致および承認後の付与計画を確認し、タグの実在とIdentity一致はRelease後に軽量記録確認する表現へ置換した。処置は`Applied`であり、新固定版の監査前に`Resolved`または`Pass`と扱わない。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checker、Checkerテストおよび3監査を取り直すまで、`DOC-V018-R04`を`Resolved`とせず、最終分類、正式移行内容、CHANGELOG、Stable化、対象branch統合、タグ、公開またはReleaseを先取りしない。

第9統合固定候補はCommit `c0e0e49b4e5187a29eff8efaafc4ed59f269e18a`、Tree `7762a579387a9e1c486815491d82d5fd27d21bbd`である。全体Checkerは155ファイル、Markdown 112件、ローカルリンク1,653件、アンカー555件、Related 26件、版付き文書26件、安定コンテキストID 8件、是正行64件をError 0／Warning 0で確認し、Checkerテスト143件はすべてPass、`git diff --check`はcleanだった。同固定候補へのAgent／Architecture Review、Document Audit、Gap／Impact＋Conformance Auditはいずれも`Pass`、未解決Finding 0件だった。

その後の利用側再レビューは`Conditional`であり、次のMedium 2件を提示した。

1. 公開済みv0.17.0を採用する導線はあるが、v0.18.0 Candidateを採用せず隔離評価し、差分、接続部、既存成果物への影響、復旧方法を記録する利用導線が不足している。
2. README英日のCommunication指示例が正本契約を過剰に複製し、依頼の主要目的、変更可能範囲および停止条件を読みにくくしている。

後続レビューで未処置の利用側不足が確認されたため、第9統合固定候補とその機械確認および3監査結果は実行履歴として保持するが、修正後候補の現在判定、Release ReadinessまたはRelease根拠へ流用しない。利用側再レビューは、候補識別、Coordinatorの非Runtime境界および既存CheckerをPass範囲として保持し、設計の根本変更を要求していない。

統合修正ではREADME英日に、v0.17.0を有効な公開基準として維持し、v0.18.0 Candidateを復旧可能な隔離branchまたは検証用Repositoryでだけ評価し、候補Identity、対象能力、許可操作、差分、接続部、既存成果物への影響および結果を記録する案内を追加した。Candidateを完了、準拠、採用またはRelease根拠にせず、非規範Architecture Candidateは別途許可されたRuntimeまたはPoCがない限り設計上のシミュレーションとして扱う。Communication指示例は`17_Communication.md`の入口契約と条件成立時の`21_Discovery.md`参照へ短縮し、対象範囲、許可した処理境界、現在の判断集合、未承認の公開、接触、外部調査、広告および費用執行の停止だけを入力例に残した。処置は`Applied`であり、新固定版の再確認前に`Resolved`または`Pass`と扱わない。

現在状態は引き続き`Ready for Verification`である。修正後の新しいCommit／Tree、全体Checker、Checkerテストおよび必要な独立監査を取り直すまで、利用側再レビューの2件を解消済みとせず、Stable化、対象branch統合、タグ、公開またはReleaseを先取りしない。

## 9. 追加されたv0.18.0収載境界

2026-08-28、Qual-Labの人間の決定権限者は、[`CHG-000055` §9](CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#9-v0180-candidateへの収載判断による再開)が所有する三つの改善意図をv0.18.0 Candidateへ収載すると判断した。§5.1の未終了変更トレース移管スナップショットは作成時点の履歴として変更せず、現在の統合境界へ次を追加する。

- 上流工程エージェント／課題探索対話ループと工程接続・意味網羅検証の強化
- Coordinator Reference Runtimeの根拠駆動リファクタリング
- 既存・過去CHGを含む人間可読文書の意味構造改善

これらは[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)のCoordinator Runtime 1.0完成固定後に、現行正本と影響を再確認した変更単位へ具体化する。改善がRuntimeへ影響する場合はCHG-000055 §9の戻り辺に従ってCHG-000015を再開し、改善後の最終Runtime Identityで完成根拠を再固定する。Runtime非影響の場合は依存閉包と理由付き非該当を記録する。収載判断だけでは実装着手、実装完了、規範採用、Stable化、統合またはReleaseを意味しない。v0.18.0 Release Readinessは、最終Runtime Identityの完成固定と三つの改善の完成固定・必要監査、または対象を外す人間の明示判断が揃うまで成立しない。

本追加により§5までの過去固定改訂版と監査結果は履歴として保持するが、現在のv0.18.0 Candidate全体の合否へ流用しない。新固定改訂版に対する全体Checker、必要な独立レビュー／監査、CHANGELOG、移行内容およびRelease範囲の再確認を要する。
