# Projectの現在地を知る入口は何がよいか

成果物種別: Discovery分析
探索ID: `EXP-000029`
状態: 要求採用・入口構成確認済み
主な情報源・根拠: CRDD標準の自己適用、v0.21作業での状態確認、Workbench構想に対する人間の再Discovery指示
判断する人: Qual-Lab
記録の性質: v0.22開始時の再Discovery
下流の主要CHG: 未作成

> 本探索はWorkbenchを作る理由を後付けするものではない。Projectの現在地を知る仕事に、どの入口が役立つかを比較する。

## 事前入力の理解確認

AIは当初、Projectの現在地を知る負担は確認できるものの、AI、静的View、Workbenchのどれが必要かを比較する探索だと理解した。人間との確認で、比較より前に成立させる第一段階が不足していると修正された。

```text
AIの事前理解
「Project ViewまたはWorkbenchの必要性を比較する」
        ↓ 人間による修正
「まず、どのAIでも同じ品質で答えられ、
  最悪でも特定Markdownを読めば同じ内容が分かる
  標準Project Contextが必要」
        ↓ 追加確認
「現在事実だけでなく、根拠付きのリスク、
  本質的課題、依存、影響、選択肢も共有する」
        ↓ 現在理解
標準Project Contextが第一段階。
MCP、Workbench、複数Repository統合はそのConsumerまたは後続段階。
```

代替として、各AIが正本を都度探索する方法、現在事実だけの静的一覧、Workbench専用Storeを比較した。都度探索は回答範囲と分析品質がAIごとにぶれ、事実だけの一覧はリスクと本質的課題を各Consumerが再推論し、専用Storeは第二正本になる。したがって、Consumerに依存しないMarkdownの標準入口と共有分析を持つ方向を要求として採用し、表示・対話・操作の入口方式は引き続き比較する。

## きっかけ

CRDD標準の保守では、「今どこまで進み、何が止まり、次に何を判断するか」を知るために、Roadmap、CHG、Quality、Git差分、各工程成果物を行き来している。AIへ質問すれば整理できる場合もあるが、そのたびに探索範囲と回答が変わり得る。静的な一覧は繰り返し確認しやすい一方、詳しい根拠や次の操作まで自然につながるとは限らない。

ここまではCRDD標準の自己適用で繰り返し観察した事実である。一方、WorkbenchがAIや標準Markdownより負担を減らすこと、日常的に開く価値があること、Project運営者以外にも必要なことはまだ観測していない。

```text
状態を知りたい
   ↓
複数の正本・Git・検証結果を探す
   ↓
現在値、欠測、根拠を自分で組み立てる
   ↓
次の判断または作業へ進む

第一段階:
同じ現在状態と共有分析を、決まったMarkdown形式で得られる

未確認:
その内容を、AI対話・MCP・Workbenchのどの入口でどう使うと最も役立つか
```

## 本当の問題は何だったか

問題は画面がないことではない。現在地を知るたびに、利用者または各AIが情報源を選び、現行性と欠測を判断し、同じ意味へ組み立て直すため、回答範囲と分析品質が入口ごとに変わることである。

表示だけを増やしても、出典へ戻れない、古さや未取得を正常値に見せる、判断後の仕事へつながらない場合は負担を移すだけになる。逆に、AIへの質問だけで十分なら、専用Workbenchを維持する理由は弱い。

## こうすれば解けると考えた

まず、Repositoryごとに、自身が所有・観測する範囲から同じ意味を返せる標準Project Context Projectionを作り、その上で同じ代表的な確認作業を異なる入口で比較する。Project Context Projectionは新しいProject正本ではなく、既存正本から現在状態を人間と機械が共用できる形へ投影する交換契約である。

| 方向候補 | 期待できること | 失敗し得ること | 現在の扱い |
|---|---|---|---|
| AIへ都度質問する | 自由な問いと説明を得られる | 探索範囲、再現性、回答差を利用者が確認する負担が残る | 比較対象 |
| 正本から静的Viewを生成する | 同じ情報を素早く繰り返し確認できる | 状況に応じた深掘りや次の行動へつながりにくい | 比較対象 |
| 薄いWorkbenchで確認する | 現在地、根拠、判断待ち、定型操作を一つの流れで扱える可能性がある | UI維持費、情報過多、第二正本化、汎用Dashboard化の危険がある | 検証する仮説 |
| AIと薄いViewを組み合わせる | 定型確認と自由な深掘りを分担できる | 入口間で意味やAuthorityが分かれる危険がある | 検証する仮説 |

標準Project Contextは、少なくとも次の内容を同じ根拠から取得できるようにする。

- Projectの目的、Scope、現在のVersionまたは節目。
- 進行中、完了、未完了、停止中および判断待ちの内容。
- Topic、決定、Meetingから引き継いだAction、品質状態および既知のGap。
- 情報源、欠測、制限、競合および古さ。
- 根拠から導いた現在のリスク、本質的な課題、依存、放置時の影響および選択肢。
- 期限が設定されている場合の日程リスクと、未設定の場合の未評価表示。

既存のRoadmap、CHG、Decision、Quality、Topicその他の正本が所有する内容は、必要最小限の結論・要約とOwner ArtifactへのRelationとして投影する。同じ内容をProject Context固有の正本として再定義しない。複数のOwner Artifactを合わせて初めて成立する横断的なリスク、課題、依存、影響または選択肢はProject Context内の共有分析として保持し、導出元を必須にする。共有分析へProject Context独自の安定IDは発行せず、継続管理が必要になった場合はCHG、Topic、Decision、Qualityその他のOwner Artifactへ昇格する。

Repository ProjectionはProject ID、Repository IDおよびRepository Roleが示すContextの内側だけを表す。RepositoryをCloneできる主体はRepository内の全情報を読めるため、同一Repository内で項目ごとの閲覧権限を作らない。範囲外にあるかもしれないManagement、Commercialその他のContextを、`Unknown`や`Unavailable`として機械的に列挙せず、このProjectionから範囲外Contextの存在または不存在を判断できないことを明示する。

```text
Repository Project Context Projection
├ Project ID
├ Repository ID
├ Repository Role / Context
├ Repository内正本の現在投影
└ Boundary: 範囲外Contextの存在・不存在を主張しない

CROS Federation
├ Principalが存在を知る権限を持つContextだけを統合
├ 参照不能だが存在開示可能 → Unavailable / Restricted
├ 期待するContext集合が定義済みで未担当 → Not Covered
└ 存在開示不可 → 表示しない
```

`Not Covered`は、CROSが期待するContextの集合と責任範囲を現在のPrincipalへ開示できる場合だけ使用する。期待集合自体が不明な場合は非存在や網羅完了を推定しない。

現在事実は同じRepository内の正本から決定論的に投影する。リスク、本質的な課題、依存、影響および選択肢は、AIが事実と根拠から先に整理して共有分析としてMarkdownへ残し、人間が違和感を見つけた場合に訂正できるようにする。人間が訂正していないことを、分析全体の承認済み表示へ読み替えない。

Project ContextはRepository内のCurrent Contextに限定し、CIのLive状態、実行中Runtime、Deploy先、Infrastructure Healthその他のRepository変更なしに変わる運用状態を管理しない。必要な場合もOwnerへの導線だけを置き、外部状態の現在値や観測時点をProject Contextへ複製しない。

Front AIが対話時にさらに進めた推論または提案は、現在事実および保存済みの共有分析と分けて説明する。新しい推論の前提、確信度または未確認範囲を示し、その場の推論を共有分析へ自動昇格しない。

Project Contextは対話中だけ存在する一時回答にせず、Repository内のMarkdownとして保持する。作業の進行によって現在状態、リスク、課題、依存、判断または次の選択肢が変わった場合、AIが正本を再観測して現在の内容へ更新する。過去状態を本文へ積み上げ続けず、Git履歴と変更理由を所有する正本から後で辿れるようにする。

ただし、すべてのファイル変更をProject Contextの更新理由にしない。誤字、形式調整、局所実装等が、利用者の状況理解、リスク、課題、依存、判断または次の一手を変えない場合は更新しなくてよい。更新要否は変更ファイル数ではなく、Project Contextが伝える意味への影響で判断する。

更新要否は、少なくともChange、工程またはReleaseのGateを閉じる前に評価する。現在Version・節目・Scope・重要な進捗、Risk・停止、判断待ち、現在有効な理由、次の選択肢、Project／Repository IdentityまたはRepository Roleのいずれかが変わる場合は同じ変更範囲で再投影する。表現修正、意味を変えない内部実装、既存結論を変えないEvidence追加または単なるCommit発生だけでは更新しない。

AIが「今どうなっているか」へ回答する時にProject ContextとOwner Artifactの意味が競合していることを見つけた場合、古いProject Contextを現在値として説明しない。書込み権限と作業範囲がある場合は再投影し、ない場合は競合とOwner Artifactを示す。

各内容は結論を先に短く示し、その直後に根拠、理由、情報源、未確認範囲および必要な次の判断を置く。詳細を読まなければ現在の結論が分からない構成にも、結論だけで理由を確認できない構成にもしない。

利用者が「今どうなっているか」と尋ねた時は、次の五つを別々の問い合わせへ分解せず、一つのProject Status回答としてまとめる。

```text
1. 今どうなっているか
        ↓
2. 何が危ない、または止まっているか
        ↓
3. 今、人間が決めることは何か
        ↓
4. なぜこの状態・判断になったか
        ↓
5. 次に何をすべきか
```

| 場面 | 主に使う情報 | Project Contextへ保持する内容 | Front AIが対話時に追加できる内容 |
|---|---|---|---|
| 現在地 | 現在事実 | 正本から決定論的に投影した状態 | 利用者に合わせた説明 |
| Risk・停止 | 事実と共有分析 | 正本上のRiskと、根拠付きの横断Insight | 現時点で新たに疑われるRisk |
| 判断待ち | 事実と共有分析 | 判断事項、既存選択肢、影響、決定権限 | 選択肢の比較や推奨 |
| 理由・根拠 | 現在事実 | Owner ArtifactへのRelationと必要最小限の要約 | 複数根拠をつないだ説明 |
| 次の一手 | 共有分析と対話時推論 | 既に共有された選択肢と再評価条件 | 現状から導く新しい提案 |

五場面は次の契約で具体化する。ここでいう期待回答は表示文言ではなく、どのConsumerでも失ってはならない意味である。

| 場面 | 必要な入力 | 期待する回答 | 許されない誤答 | 根拠への戻り方 | Federationで増える確認 |
|---|---|---|---|---|---|
| 現在地 | Project／Repository Identity、Repository Role、Roadmap、現行Version、進行中の変更、品質状態 | 現在の目標、進捗、完了・未完了・停止、RepositoryのContextを短く理解できる | Repository外を完了・問題なしへ畳む、履歴状態を現在値として出す | Roadmap、CHG、Release、Quality等のOwner Artifactへ戻る | Repository Identity、Roleおよび競合を保持する |
| Risk・停止 | Owner Artifact上のRisk、期限、Gap、依存、品質不足、横断的な共有分析 | 何が危なく、なぜ危なく、放置すると何へ影響するかを理解できる | 根拠のないRisk生成、見えない領域のRiskなし判定、単なる未完了を重大Riskへ強める | Owner Riskまたは共有分析の全導出元へ戻る | 同じRiskの重複、Repository間依存、開示可能な不足だけを統合する |
| 判断待ち | 未決事項、選択肢、影響、決定権限、必要期限 | 誰が何をいつまでに判断し、各選択で何が変わるかを理解できる | AI提案を決定済みにする、決定権限を推測する、非開示判断の存在を漏らす | Decision、Roadmap、CHGその他の判断Ownerへ戻る | Principalが存在を知り、判断へ参加できる項目だけを示す |
| 理由・根拠 | 現在値を所有するArtifact、変更理由、現行意図 | 現在状態や判断がなぜ成立し、どの根拠が現在有効かを確認できる | Project Context内で理由を再定義する、古い理由を現行へ昇格する | 各結論からOwner Artifactの該当箇所へ戻る | Repository間で競合する根拠を一つへ丸めず、出所別に保持する |
| 次の一手 | 現在地、Risk、判断待ち、依存、保存済み選択肢、再評価条件 | 既に共有された候補と、Front AIが今回追加した提案を区別して次へ進める | 観測外を推測した提案、自動的な正本更新、提案を採用済みに見せる | 保存済み候補はOwner、追加提案は使用した事実・共有分析へ戻る | 利用可能なRepositoryの範囲だけで提案し、見えないContextを前提にしない |

対話時に追加したRisk、推奨または次の一手は、保存済みの現在事実や共有分析とは別に示す。人間が採用した場合も会話結果を直接Project Contextへ事実として書き込まず、Roadmap、CHG、Decisionその他のOwner Artifactへ反映した後に再投影する。

Repository Boundaryは五場面すべてに適用する。Repository外を正常と扱わず、開示できない判断・根拠・Repositoryの存在を漏らさず、見えない情報を推測して次の一手を作らない。一括回答にはProject ID、Repository IDおよびRepository Roleを付ける。

評価するのは画面の好みではなく、利用者が次をできるかである。

- Projectの現在地と不完全性を短時間で理解できる。
- 表示の根拠および所有正本へ戻れる。
- 判断待ちと、単なる情報不足を区別できる。
- 次の作業へ進む際に、別の正本や独自Storeへ状態を複製しない。
- Workbenchを使わない開発者の通常作業を重くしない。

## 選んだこと、選ばなかったこと

現時点でWorkbench採用、画面構成、Hero Screen、Dashboard形式は選ばない。一方、Consumerに依存しない標準Project Context ProjectionをRepository内のMarkdownとして提供し、現在事実と共有済み分析を読めるようにする方向は採用する。固定見出し、固定表、統制語彙、Owner Relation、Project ID、Repository IDおよびRepository Roleを交換契約の最小要素とする。

初期段階ではMarkdownを人間可読かつ機械可読なCurrent Projection Contractとし、Consumerは同じMarkdownを利用する。Workbench等の利用が進み、Markdownを生成して再解析することが不合理になった場合は、同じ内部Project Context ModelからMarkdown、JSON、MCP ResultおよびWorkbench View Modelを生成する方式を後工程で評価する。将来方式を先取りして、現段階で巨大Schemaや第二の正本を作らない。

採用するのは、同じProject確認作業をAI、静的View、Workbench候補で比較し、利用者成果と維持費の両方から入口を判断する進め方である。v0.21以前のWIP、Architecture、画面案は、要求を作る根拠ではなく、Canonicalな要求と設計が成立した後のReality Audit候補としてのみ扱う。

## 後から分かったこと

v0.21でUI／SPECへ`Analysis → Definition → Detail`を導入したため、Workbenchを採る場合も、いきなり画面を実装せず、利用者成果と情報責務から具体画面・挙動・視覚方針へ進められるようになった。

ただし、設計工程が整ったことだけをWorkbenchの必要性の根拠にはしない。代表的な確認場面は、現在地、Risk・停止、判断待ち、理由・根拠、次の一手の五つとして確認した。その後の人間理解の確認で、WorkbenchをProject Context Viewerに限定せず、MCPと同じProject能力、横断投影および簡易Version Controlを扱う入口として採用した。各場面の頻度、現行の所要時間・見落とし、許容する維持費は、要求採用の前提を推測で埋めるためではなく、Dogfoodで継続・縮小を判断する評価値として扱う。

人間理解の確認では、v0.22の出発点をWorkbench実装とせず、既存WIPを参考に限定してDiscoveryからやり直すことを確認した。その後、Project Contextの五場面、Topic／Meeting、横断投影、簡易Version ControlおよびWorkbenchを使わない経路を含む[REQ-000040](../../Definitions/REQ-000040/requirement.md)を採用した。具体画面、情報量およびVisual Directionは採用していない。

## 採用した要求

本探索から[REQ-000038](../../Definitions/REQ-000038/requirement.md)を採用した。

既存の[REQ-000007](../../Definitions/REQ-000007/requirement.md)は、出典と不完全性を保つProject全体の表示という成果を所有する。REQ-000038は、その表示を含む現在状態と共有分析を、特定Consumerへ依存しない標準形式から取得できることを所有する。Workbenchの独立した要求は、後続の[EXP-000033](../EXP-000033/exploration.md)から[REQ-000040](../../Definitions/REQ-000040/requirement.md)として採用した。

## 現在地と次への引き渡し

五場面について、必要な入力、期待する回答、許されない誤答、根拠への戻り方、および単一RepositoryとFederationの差を具体化し、CRDD自身の現在状態を正式なRepositoryルート投影へ反映した。五場面の一括回答、Manifest v2とのIdentity一致およびMarkdown直接確認は成立した。Codex対話でも正本と投影の分担について人間の認識と一致した。Project ContextはRepository Roleが示す範囲の現在投影に限定し、独自安定ID、項目別閲覧権限、Live状態、Deploy状態および一律の観測時点を持たせない。

Project ContextだけではProjectの仕事全体を扱えないことも確認した。Topic、Meeting、Roadmap、Quality、文書およびProject Runtime Stateは、各Ownerから詳細を読む独立能力としてMCPとWorkbenchへ接続する。WorkbenchはProject Context ViewerやMCP操作一覧に限定せず、Project ContextをOverviewとして使いながら各詳細へ進み、複数情報を横断したAttention、関係・経緯、比較・変化および次の仕事を人間向けに投影する入口として評価する。この追加投影もOwner Relationを失わず、Workbench固有のProject正本にしない。

さらにWorkbenchは、MCPで扱うProject情報に加え、Repositoryの現在Tree、Staged／Unstaged／Untracked／Conflict、File DiffおよびStage状態を、簡易SourceTreeのように確認・操作できる入口を持つ候補とする。初期操作にはStage、Unstage、Commitおよび設定済みUpstreamへの通常Pushを含める。Push前にはRemote、Branch、送信対象Commitを表示して人間の明示確認を要求し、Force Push、暗黙のUpstream作成、Branch作成、MergeおよびRebaseは初期範囲にしない。Git情報はLiveな作業状態でありProject Contextへ保存せず、差し替え可能なVersion Control Adapterから取得する。Git Commit済みであることを通常のProject操作の前提にしない。既存`crdd.get_project_state`はProject Runtimeの実行状態を返すため、Project Contextと混同しない`crdd.get_project_runtime_state`という名称方針を採用し、移行契約はArchitectureで決める。

次は、採用済み要求をUX以降へ渡し、同じ固定入力をChatGPT、Claude Code、MCPおよびWorkbenchから利用して回答品質と作業負担をDogfoodで比較する。CROS Federationは、単一Repositoryの読取り境界を再利用して評価する。Workbenchの実装成立は、各入口が同じApplication Capabilityへ接続した実Productで確認する。

DogfoodでChat Agent＋MCPや既存Git Clientより作業負担が増える、誤操作が増える、Owner Relationが分からない、または維持費が価値を上回る場合は本探索へ戻してScopeを縮小する。比較前に画面案や既存WIPから具体設計を逆算しない。

## 補足分析

- [CRDD自身を対象にしたProject Context試験投影](project_context_pilot.md)
- [Project Context最小Formatと更新契約のDraft](project_context_contract_draft.md)
- [Project Context入口比較](consumer_comparison.md)
- [Project情報入口の能力地図](capability_map.md)

## Checklist

- [x] 情報源と、情報源から確認できる範囲を示した。
- [x] 事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。
- [x] 現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。
- [x] 人間理解の確認と、要求・方針の採用判断を分けた。
- [x] 人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。
- N/A: 発言の少なさ、回答不能または沈黙は観測されず、明示された訂正と判断を用いたため — 発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。
- [x] 確認できた事実と、そこから導いた解釈・仮説を区別した。
- [x] 解決策ではなく、本質的な問題を説明した。
- [x] 技術名称を除いても、誰が何に困っているか理解できる。
- [x] 影響を受ける人または判断する人を特定した。
- [x] どのような変化を期待するか説明した。
- [x] 原因と解決に関する仮説を、事実として扱っていない。
- [x] 未確認事項と不確実性を明示した。
- [x] 人間による確認または判断が必要かを評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 失敗、リスク、制約および対象外を評価した。
- [x] 採用、不採用、保留を区別した。
- [x] 次工程が保持すべき問題、変化および条件を示した。
- [x] 情報不足時にDiscoveryへ戻す条件を示した。
- [x] 因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。
- [x] 補足分析へ必須情報を退避していない。
