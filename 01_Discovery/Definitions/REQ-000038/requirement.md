# REQ-000038 Consumerに依存しない標準Project Context

成果物種別: Discovery定義
要求ID: `REQ-000038`
Discoveryでの判断: 要求採用
判断する人: Qual-Lab
探索元: [EXP-000029](../../Analysis/EXP-000029/exploration.md)

## 要求

各Repositoryは、人間が特定のMarkdownを直接読む場合、ChatGPT、Codex、Claude Code等のAIへ尋ねる場合、MCPまたはWorkbenchから参照する場合のいずれでも、同じ範囲、現在状態、根拠、不完全性および共有済み分析を取得できる、決まった形式のProject Context Projectionを提供しなければならない。Project Context ProjectionはProjectの新しい正本ではなく、Repositoryが所有または観測する正本から導出する、人間可読かつ機械可読な現在投影契約でなければならない。

Project Context Projectionは、Project ID、Repository ID、Repository Role、Projectの目的、Scope、現在のVersionまたは節目、進行中・完了・未完了・停止中・判断待ち、重要なTopic・決定・Action、品質状態、既知のGap、情報源、欠測、制限、競合およびOwner Artifactの変更が未反映である状態を含めなければならない。これらの現在事実は、同じRepository内で所有する正本から決定論的に投影しなければならない。正本が所有する項目は必要最小限の結論・要約とOwner ArtifactへのRelationだけを保持し、内容をProject Context固有の正本として複製してはならない。

Meetingについては、直近の重要なMeeting、記録確認またはOutcome処置が未完了のMeeting、およびClose済みMeetingが所有する未完了Actionを、Meeting正本へのRelation付きで投影しなければならない。Meeting本文、会議当時の記録またはActionの詳細をProject Contextへ複製してはならない。

さらに、複数のOwner Artifactを合わせて初めて成立する現在のリスク、本質的な課題、依存、放置時の影響および選択肢を、AIが先に整理し、事実と区別した共有分析として保持しなければならない。共有分析は導出元、前提、確実性および再評価条件を持たなければならない。共有分析へProject Context独自の安定IDを発行せず、継続的な状態管理または横断変更が必要になった場合は、CHG、Topic、Decision、Qualityその他のOwner Artifactへ昇格しなければならない。共有分析は人間の事前承認を掲載条件にせず、人間が違和感を見つけた場合に根拠とともに訂正できなければならない。人間による訂正がないことを、共有分析全体への承認とみなしてはならない。

Repository側のProjectionは、Project ID、Repository IDおよびRepository Roleが示すContextの内側だけを表現しなければならない。同一Repository内で項目ごとの閲覧権限を設けず、Repositoryをアクセス境界として扱わなければならない。範囲外のContextを、存在開示の権限を確認せず`Unknown`、`Unavailable`、`Restricted`または`Not Covered`として列挙してはならない。範囲外Contextの存在または不存在をこのProjectionから判断できないことを明示しなければならない。

CROSが複数Repositoryを統合する場合も、現在のPrincipalが内容または存在を確認できるRepositoryだけをFederation対象にしなければならない。`Unavailable`または`Restricted`はContextの存在開示が許可されている場合だけ、`Not Covered`は期待するContext集合と責任範囲が確認できる場合だけ使用できる。期待集合が不明な場合は`Unknown`として扱い、存在を開示できないContextは表示してはならない。

Repository分離を必要としないProjectでは、一つのRepository ProjectionだけでProject Contextが成立しなければならない。複数Repositoryを統合する場合、各Repositoryが所有するTopic／Meetingその他の項目を別の正本へ統合せず、Owner Repositoryと開示境界を保ったまま投影しなければならない。同じLogical Projectに属することを、DEV／MGMT等の内容、Identityまたは非開示Relationを共有・推測する根拠にしてはならない。

Projectionの機械可読部分は、少なくとも固定見出し、固定表、統制された状態語彙、Owner Relation、Project ID、Repository IDおよびRepository Roleを安定して取得できる構造にしなければならない。説明、理由および提案は、その構造を壊さない平易なMarkdownとして保持しなければならない。

Project ContextはRepository内のCurrent Contextに限定し、CIのLive状態、実行中Runtime、Deploy先、Infrastructure Healthその他のRepository変更なしに変わる運用状態を管理してはならない。必要な場合もOwnerへの導線だけを置き、外部状態の現在値または観測時点をProject Contextへ複製してはならない。

Front AIが対話時に共有分析からさらに進めた推論または次の一手を示す場合は、現在事実、保存済みの共有分析およびその場で追加した推論・提案を、利用者が区別できる形で説明しなければならない。

Project Contextは一時的な応答または実行時キャッシュだけにせず、Repository内で後から参照できるMarkdownとして保持しなければならない。作業の進行によりProject Contextが伝える意味が変わった場合、AIは所有する正本を再観測し、現在内容を再投影しなければならない。意味が変わらない微細な変更まで機械的に再生成してはならない。

Change、工程またはReleaseのGateを閉じる前に、Project Contextの再投影要否を評価しなければならない。現在Version・節目・Scope・重要な進捗、Risk・停止、判断待ち、現在有効な理由、次の選択肢、Project／Repository IdentityまたはRepository Roleが変わる場合は再投影しなければならない。表現修正、意味を変えない内部実装、既存結論を変えないEvidence追加またはCommit発生だけを更新理由にしてはならない。

Project ContextとOwner Artifactが競合する場合はOwner Artifactを優先し、Project Contextを現在値として説明してはならない。再投影できない場合は競合とOwner Artifactへの導線を示さなければならない。

利用者がProjectの現在状態を確認する場合、Project Contextは、現在地、Risk・停止、判断待ち、理由・根拠および次の一手を、一つのProject Status回答として取得できる情報構造を提供しなければならない。各観点を独立して詳細確認できることは維持するが、利用者へ五つの個別問い合わせを要求してはならない。

## 対象と利用状況

開発者、Project運営者、PM、経営・管理層およびFront AIが、単一Repositoryの現在状態を理解し、説明し、次に取る一手を判断または提案する場面。MCP、Workbenchおよび複数Repository統合は、このRepository単位のProject Contextを利用するConsumerとして扱う。

代表的な利用場面は、次の五つをまとめて確認する場面とする。

1. Projectは今どうなっているか。
2. 何が危ない、または止まっているか。
3. 今、人間が決めることは何か。
4. なぜこの状態または判断になったか。
5. 次に何をすべきか。

## 解く問題と望ましい変化

```text
現在:
利用者または各AIが複数の正本を毎回探索・解釈する
    ↓
回答範囲、リスク分析、欠測の扱い、次の提案が入口ごとに変わる
    ↓
望ましい変化:
Repository内の標準Project Contextから
同じ現在事実と共有分析を取得する
    ↓
各媒体は同じ根拠を使い、利用者に合わせて説明・提案する
```

## 採用理由と比較

| 選択肢 | 保持できること | 残る問題 | 判断 |
|---|---|---|---|
| 各AIが正本を都度探索する | 質問に応じて柔軟に探索できる | 探索範囲と分析品質がAI・会話ごとに変わる | 単独経路として不採用 |
| 現在事実だけの静的一覧 | 同じ状態を繰り返し読める | リスク、本質的課題、依存を各Consumerが再推論する | 不十分 |
| Workbench専用Storeへ集約する | UIから高速に参照できる | 第二正本とConsumer依存を作る | 不採用 |
| Repository内の標準Project Contextを共用する | 人間と各Consumerが同じ事実・分析・不完全性を利用できる | 更新責務、現行性および分析の再評価契機が必要 | 採用 |

## 成立条件

- AIや専用Toolがなくても、安定したMarkdown入口から内容を理解できる。
- 人間、異なるAI、MCPおよびWorkbenchが、同じ対象範囲、現在状態、根拠および不完全性を取得できる。
- Repository内の安定したMarkdownとして保持され、対話やProcessが終了した後も参照できる。
- 現在確認できる事実と、そこから導いた共有分析を区別できる。
- 共有分析がAIによる整理であること、使用した根拠、前提、未確認範囲および人間による訂正の有無を確認できる。
- 人間は共有分析の違和感を訂正でき、訂正前後の意味と根拠を追跡できる。
- リスク、本質的課題、依存、影響および選択肢から、その根拠へ戻れる。
- 情報が欠ける、Owner Artifactの変更が未反映である、制限される、または競合する場合に、正常値や推測値へ畳まない。
- Front AIはProject Contextを基に状況説明と次の一手を提案できるが、現在事実、保存済みの共有分析および対話時の追加推論を分けて示し、提案を人間確認なしに正本または共有分析へ昇格しない。
- Project Contextの項目から所有する正本へ戻れ、Project Context自身を第二の業務正本にしない。
- 正本が安定IDを持つ項目は、そのOwner Artifact IDをRelationとして使用し、Project Context固有IDを重複発行しない。
- 複数正本から導出した共有分析にもProject Context独自の安定IDを付けず、継続管理が必要なら責務を持つOwner Artifactへ昇格する。
- Repository ProjectionはProject ID、Repository IDおよびRepository Roleが示すContextだけを表示し、範囲外Contextの存在または不存在を漏らさない。
- Federated ProjectionはPrincipalごとの開示権限を守り、`Unavailable`、`Restricted`、`Not Covered`、`Unknown`および非表示を混同しない。
- 固定見出し、固定表、統制語彙、Owner Relation、Project ID、Repository IDおよびRepository Roleを、Markdown直接確認と機械処理の両方から同じ意味で取得できる。
- 「今どうなっているか」という一つの確認から、現在地、Risk・停止、判断待ち、理由・根拠および次の一手をまとめて取得できる。
- 五場面のそれぞれで、Repository Role、根拠、不完全性および現在事実・共有分析・対話時推論の区別を失わない。
- 期限が設定されている場合はREQ-000037に従って日程リスクへ反映し、未設定なら未評価と示す。
- 作業進行により現在状態、リスク、課題、依存、判断または次の選択肢が変わった場合に再投影される。
- Meetingの記録確認、Outcome処置または未完了ActionがProjectの現在判断へ影響する場合に、その状態とMeeting正本への導線を取得できる。
- Change、工程およびReleaseのGateを閉じる前に再投影要否が評価される。
- Owner Artifactとの競合を検出した場合に、古いProject Contextを現在値として扱わない。
- 誤字、形式調整または局所実装等がProject Contextの意味を変えない場合、理由なく再生成しない。
- 各項目は結論を先に簡潔に示し、根拠、理由、情報源、未確認範囲および次の判断を必要な深さで続ける。
- 過去状態は現在Markdownへ無期限に追記せず、Git履歴と変更理由を所有する正本から追跡できる。

## 失敗・リスク・制約

- 媒体ごとに別のProject Contextまたは分析正本を作らない。
- 要約のために欠測、制限、競合、Owner Artifactの変更未反映または判断不能を隠さない。
- Repository Roleが示すContext外のContext名、Repository名または存在を、Repository Projectionから推測・開示しない。
- 期待するContext集合が不明な状態を`Not Covered`または網羅完了へ畳まない。
- Risk、Topic、Decision、CHGその他の既存Owner項目にも共有分析にも、Project Context独自IDを重ねて発行しない。
- AIの内部推論全文または根拠のない推測を共有分析として保存しない。
- 人間が訂正していない共有分析を、人間確認済みまたは合意済みと表示しない。
- 共有分析を永続的な事実として固定せず、再評価契機を持たせる。
- Front AIの追加推論を、確認済み事実または既存の共有分析であるように説明しない。
- 五場面を個別に問い合わせなければProject全体を理解できない構造にしない。
- 次の一手を示すために、Repository Roleが示すContext外の状態、判断またはRiskを推測しない。
- ファイル変更数、Commit数または経過時間だけで再投影の必要性を決めない。
- 更新頻度を上げること自体を現行性の保証にせず、意味へ影響する正本変更を取りこぼさない。
- 結論だけを示して根拠を隠すことも、詳細を先に並べて現在の結論を見つけにくくすることもしない。
- Front AIの提案を、決定、CHG、Roadmap更新またはリスク受容へ自動昇格しない。

## 対象外

- Workbench、MCPまたは特定AIを必須入口にすること。
- 複数Repositoryを束ねる方式、Server配置または通信方式の確定。
- Project Contextの内部Model、JSON Projection、MCP ResultまたはWorkbench View Modelの実装方式の確定。
- CI、Runtime、Deploy先またはInfrastructureのLive監視と運用管理。
- 同一Repository内の項目別閲覧権限またはRBAC。
- Project情報を中央Databaseへ移して正本化すること。
- Front AIが人間の判断権限を代替すること。

## 未確認事項と戻り条件

- 標準Project Contextの物理ファイル構成、意味影響の検出方法、生成・更新方式および構造化形式の詳細は後工程で決める。
- 初期段階はMarkdownを共通交換契約として使用する。Workbench等の利用が進んだ場合に、共通Project Context ModelからMarkdown、JSON、MCP ResultおよびWorkbench View Modelを直接投影する必要性を再評価する。
- 実利用で必要情報へ到達できない、更新負担が正本確認より大きい、Consumer間で意味が分かれる、または共有分析が根拠から再構成できない場合はDiscoveryへ戻す。

## 検証意図

同じRepository状態について、人間のMarkdown直接確認、複数AIへの質問、MCPおよびWorkbench候補から、「今どうなっているか」という一つの確認で、現在地、Risk・停止、判断待ち、理由・根拠および次の一手をまとめて取得する。現在事実、AIが整理した共有分析、人間による訂正、およびFront AIが対話時に追加した推論を区別できること、意味が一致すること、正本へ到達できること、不完全性を保持すること、およびAI提案が自動昇格しないことを観測する。Repository ProjectionがRepository Role外のContextの存在を漏らさず、存在開示を許可されたFederated Projectionだけが`Unavailable`等を表示し、期待集合が不明な場合に`Not Covered`へ畳まないことを確認する。Project Contextが独自の安定ID、項目別閲覧権限またはLive状態を持たず、共有分析から全導出元へ戻れることも確認する。意味を変える進行ではMarkdownが更新され、意味を変えない微細変更では不要な再生成が起きず、更新後も結論から根拠へ辿れることを確認する。

## UXへの引き渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 利用者が入口やAIの違いを意識せず、同じProjectの現在事実と共有分析を理解し、根拠へ戻り、次の判断へ進める変化 | 利用者別の目的、重要場面、説明の深さ、提案との関わり、失敗、体験品質 |

## 関係

- 元の探索記録: [EXP-000029](../../Analysis/EXP-000029/exploration.md)
- 関連要求: [REQ-000007](../REQ-000007/requirement.md)、[REQ-000010](../REQ-000010/requirement.md)、[REQ-000028](../REQ-000028/requirement.md)、[REQ-000029](../REQ-000029/requirement.md)、[REQ-000037](../REQ-000037/requirement.md)
- 下流工程への正式入力: UXはこの要求定義だけを正式入力として分析する。元の探索記録を直接の補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。

## Checklist

- [x] 要求だけを読んでも、必要な変化を理解できる。
- [x] 探索元と採用判断を一意に辿れる。
- [x] 対象、利用状況、問題および望ましい変化を説明した。
- [x] 特定の画面、実装または技術方式へ不要に固定していない。
- [x] 要求として採用した理由と主要な代替を示した。
- [x] 正常時の成立条件を判定可能な形で示した。
- [x] 不完全・異常・境界時にも守る条件を示した。
- [x] 成立主張を破る反証条件を示した。
- [x] 失敗、リスクおよび制約を評価した。
- [x] 対象外を明示した。
- [x] 未確認事項と人間確認の必要性を評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 検証意図を、具体的な試験項目を先取りせず説明した。
- [x] UXが探索記録を直接読まず、この定義だけから分析を開始できる。
- [x] 下流工程の結論をDiscoveryへ逆輸入していない。
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
