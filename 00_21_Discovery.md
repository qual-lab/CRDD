# CRDD Discovery

Version: v0.4.2
Status: Stable
Owner: Qual-Lab
Skill ID: `skill.discovery.frame`
Last Updated: 2026-07-19
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_12_Change.md](00_12_Change.md)
- [00_22_UX.md](00_22_UX.md)
- [00_51_Document_Audit.md](00_51_Document_Audit.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)

---

# 1. Purpose and Boundary

Discoveryは、未整理の思い、困りごと、観察、顧客の発言、法令変更、Incident、既存資料、要求候補、解決案、Legacy Systemの挙動を、次の判断に使えるContextへ変換する工程である。

目的は、要求を大量に集めることや、AIが完成した企画書を作ることではない。

```text
人間が持つ原始的な思いとRaw Sourceを失わずに残す
事実、解釈、仮説、要求候補、解決案を分離する
分かっている範囲と不確実性を明示する
必要なRequirementと、次に進む専門活動を人間が判断できる状態にする
```

DiscoveryはCRDDの入口だが、初期開発で一度だけ行う工程ではない。新しい課題、顧客の声、法令、検証結果、運用上の問題、Legacy分析から、開発中または保守中に再び開始してよい。

---

# Phase Process Contract

本章はDiscovery工程の入口、変換、責務Coverage、出口、Phase Gate、Auditの正本である。後続章は本Contractの意味を再定義せず、Context構造、Skill実行、経路、保存場所へ具体化する。

## Phase Entry Contract

Discoveryは、Idea、Raw Voice、観測、Incident、法令変更、明確な仕様変更、曖昧な要求、既存挙動、運用上の困りごと等を、SourceとProvenanceを保ったまま受け取る。入力時点でRequirement、Defect、Change、Solutionへの分類確定を要求しない。

## Transformation Contract

入力を次のContextへ分離・構造化し、人間確認を経て必要な`REQ-*`を確立する。

```text
Origin / Trigger
Raw Voice
Actor / Situation
Problem / Pain / Impact
Evidence and Provenance
Interpretation / Hypothesis
Desired Outcome Candidate
Preserved Intent / Value
Non-goal
Constraint / Assumption
Solution Candidate
Open Question
Recommended Route
```

事実、解釈、仮説、提案を混同しない。解決案は捨てず、Problem、Outcome、Requirementから分離して保存する。

## Required Responsibility Coverage

対象Scopeの各入力、Problem、候補Requirementについて、以下を判定する。

- Source、Provenance、Authority、対象時点
- Actor / Situation、Problem / Pain / Impact
- Evidenceとその限界・Confidence、Interpretation、Hypothesis
- Desired Outcome Candidate、Preserved Intent、Non-goal
- Constraint、Assumption、Solution Candidate、Open Question
- Recommended Routeと人間確認
- `REQ-*`の発行、既存`REQ-*`の継続・改訂・置換、または非発行理由

AI、個人Data、外部Actionを含むScopeでは、Purpose、Data Subject、ConsentまたはLegal Basis、Privacy、個人評価禁止Boundary、Human Control、Security、Compliance、Cost / Budget制約も判定する。

## Scope and Coverage State

各対象を次のいずれかで追跡する。

| State | Meaning |
|---|---|
| `Complete for Scope` | 対象Scopeで必要な責務が判定済み |
| `Partial — Human Authorized` | GapとRiskを明示し、人間が限定Handoffを承認 |
| `Blocked` | 外部入力、Authority、Evidence等が不足し進行不能 |
| `Not Started` | 対象だが未着手 |
| `Not Applicable` | 理由を人間が確認し対象外とした |

複数のSource、Problem、候補Requirementがある場合、一件を整理しただけでDiscovery全体を完了扱いしない。Coverageは対象Scopeと項目を対応づけて示す。

## Human Decisions

人間は、Originの意味、Problem Framing、価値、優先順位、Requirementへの昇格、Route、Defect / Change分類、`Not Applicable`、部分Handoffを決定する。AIは候補の抽出、分離、矛盾検出、質問、草案、関連Context提示を行ってよいが、Why、重要度、Requirement、法的判断を創作または自己承認しない。

## Exit and Handoff

通常Handoff候補をHuman Gateへ提示する前に、[Phase Transition Review](00_10_Agent.md#72-phase-transition-review-and-remediation-loop)を対象Scope / Revisionへ実行する。移行に影響するFindingはDiscoveryまたは責務を持つ工程で修正し、修正後Revisionの再Reviewで`Pass`を得る。Review省略または未解消Findingを伴う移行は[Human-directed Review Exception](00_10_Agent.md#73-human-directed-review-exception)がある場合だけ通常Routeと区別して扱う。

Discoveryの出口は「文書が一つできた」状態ではなく、選択した受信先が必要とするContextを利用できる状態である。

通常のUX Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、[UX Phase Entry Contract](00_22_UX.md#phase-entry-contract)を満たす場合に限る。Research、Decision、Prototype、IA、UI / SPEC、Architecture / Technical Spike、Change Trace、Roadmap、No Action等へ進む場合は、それぞれの判断に必要なContextと未決事項を渡す。Roadmap Routeは、Human Authorityが延期を確認し、6.3のRoadmap Itemを実際に登録または更新して参照をDiscovery Resultへ戻すまで、その対象ItemのHandoffを完了としない。別のRequirement、Problem、RouteはCoverageを分け、Roadmap登録待ちだけを理由に無関係な対象まで停止しない。

部分Handoffには、対象Scope、未網羅項目、Risk、受信先、後続Ownerに対する人間承認を必要とする。

## Phase Gate Criteria

- Raw Source、Raw Voice、Origin、Provenanceを辿れる
- Actor / Situation、Problem、Evidence、Interpretation / Hypothesisを分離している
- Desired Outcome CandidateとSolution Candidateを分離している
- Preserved Intent、Non-goal、Constraint、Open Questionを対象Scopeで判定している
- `REQ-*`の処置とRecommended Routeを人間が確認している
- Roadmap Routeでは採用済みREQまたはContextを参照するRoadmap Item、Owner、Start Condition、再評価Triggerを登録している
- Coverage Summary、Unresolved Gap、部分Handoff承認を記録している
- AI / Personal Data ScopeではGovernance、Privacy、Consent、Human Control、Cost制約を判定している
- 選択した受信先のEntry Contractを満たす
- 対象RevisionのPhase Transition Reviewが`Pass`であり、移行に影響するFindingのRemediationと再Reviewが完了している

## Phase Audit Checklist

- Raw Source、Raw Voice、Provenanceまたは人間のOriginが消失していないか
- AIがWhy、重要度、Requirement、法的義務を補っていないか
- Fact、Interpretation、Hypothesis、Requirement Candidate、Solution Candidateを混同していないか
- 全入力、Problem、候補Requirement、RouteをCoverageに含めたか
- 顧客発言や現行実装を、そのままRequirementまたは正しい仕様にしていないか
- `REQ-*`の発行・継続・改訂・置換・非発行の根拠と人間判断を辿れるか
- `01_Discovery`と`99_Roadmap`の責務を混同し、文書を移動または本文を複製していないか
- 採用済みDeferred Workを回答上のRecommendationだけで終え、Roadmap Itemを登録していない状態
- Roadmap ItemにSource Context、Owner、Start Condition、再評価Triggerがない状態
- Roadmap、Evidence、Decision、Change Trace、Testへ不要なStable IDを発行していないか
- Coverage Summary、Unresolved Gap、人間Review、Route根拠、受信先Entryのいずれかが欠落していないか
- AI / Personal Data ScopeでPurpose、Consent、Privacy、個人評価禁止Boundary、Human Control、Cost制約が未判定でないか
- Independent Review未実施、旧RevisionのReview流用、Finding未修正の持ち越し、Audit Run完了をTarget Passとみなしていないか

---

# 2. Discovery Context Model

## 2.1. Discovery Is Not Requirement Gathering

思いつき、感情、違和感、顧客の発言、観察、既存の解決策、技術的可能性、未確認の推測、現行挙動は重要なInputだが、そのままRequirementではない。

```text
Raw Voice:
「一覧画面にAI要約ボタンが欲しい」

Evidence:
利用者が一覧から詳細を一件ずつ開いて確認している。

Interpretation:
全体像を把握する負荷が高い可能性がある。

Desired Outcome Candidate:
短時間で重要事項を把握し、確認対象を選べる。

Solution Candidate:
一覧画面のAI要約ボタン。

Requirement Candidate:
重要事項の要約と、その根拠へアクセスできること。

Open Question:
利用者への提示方法としてボタンが適切か。
```

## 2.2. Context Separation

| Context | Discoveryでの扱い |
|---|---|
| `Raw Voice` | 実際の発言や表現。整理後の文章で置換しない |
| `Origin / Trigger` | なぜ今扱うか。人間が記述または確認する |
| `Observation / Evidence` | 観察、記録、Data、実行結果、資料、証言 |
| `Interpretation` | Evidenceから読み取った意味。解釈主体を明らかにする |
| `Hypothesis` | 未検証の説明または成立条件 |
| `Confidence` | Evidenceの量、鮮度、代表性等に基づく現在の確からしさ |
| `Problem / Pain / Impact` | 現在成立していない状態と影響 |
| `Desired Outcome Candidate` | Actor、業務、組織をどう変えたいか |
| `Preserved Intent / Value` | 下流で失ってはいけない価値や判断基準 |
| `Non-goal` | 今回目指さないこと |
| `Constraint / Assumption` | 制約と、未確認の前提を区別する |
| `Requirement Candidate` | 満たす必要がある可能性。未確定なら`REQ-*`を発行しない |
| `Solution Candidate` | 現時点の実現案。ProblemやRequirementと同一視しない |
| `Open Question` | 未決事項、確認Owner、確認方法 |

すべてを空欄のないFormにする必要はない。ただし、重要な対象でFactとHypothesis、OutcomeとSolution、CandidateとApproved Contextを区別できない状態は認めない。

## 2.3. Source, Evidence, and Authority

会話、Interview、Meeting Log、Support Log、業務手順、既存文書、Design Artifact、Issue、Code、Schema、API、Runtime Behavior、Log、Metric、Workaround、Incident、市場情報、Prototype、User Test等をSourceとして使用できる。

Sourceが存在するだけでAuthorityを持つとは限らない。作成者、対象時点、適用範囲、現状との一致、取得方法を確認する。Evidenceは対象のCanonical Artifact内、または[`00_03_Documentation.md`](00_03_Documentation.md#62-inline-file-and-external-evidence)に従って最も近い親Folder配下の`Evidence/`へ置く。Repository Rootへ中央Evidence Folderを作らない。

Origin、Intent、Value、Non-negotiableは、人間が与えるか確認する。原始的または感情的な表現も、後から原点へ戻るためのSourceとして保持する。

---

# 3. Discovery Modes and Skill Adapter

## 3.1. Greenfield and Legacy Reverse

新規対象では、Raw Idea / PainからOrigin、Problem、Evidence、Outcome、候補Routeへ進む。Legacy対象では、残存EvidenceからCurrent Behavior、Recovered Requirement Candidate、Recovered Intent Candidateを復元し、人間確認へ進む。

Legacyでは次を分離する。

```text
実際に起きていること
文書に書かれていることと、そのAuthority
運用で回避していること
意図またはRequirementだと考えられる候補
変更すると困る可能性
不明な歴史
```

現在の実装、長く動いている挙動、既存文書を、元の意図や望ましい仕様と決めつけない。復元内容は確認されるまで`Observed Behavior`、`Recovered Requirement Candidate`、`Recovered Intent Candidate`、`Historical Hypothesis`として扱う。

## 3.2. Runtime Authority

`skill.discovery.frame`は、本書のPhase Process Contractを、[`00_11_Skill.md`](00_11_Skill.md)の共通Run Lifecycle、Guided Interaction、Human Review、Handoffに従って実行するDiscovery固有Adapterである。

開始時は「何を作るか」を急いで確定せず、なぜ今扱うのか、誰のどの状態を変えたいかを整理し、画面、機能、技術をSolution Candidateとして分離することを人間へ説明する。Legacyでは、文書やCodeを正しい仕様と決めつけず、観察事実と復元候補を分けることも説明する。

本書ではRun Status、Pause / Resume、共通Question Rule、Subagent Lifecycle、Artifact Registrationを再定義しない。Subagentを使用する場合も、Evidence Gap、Assumption、Conflict、Open Question等の限定Resultを返し、Discovery Contextの統合とHuman ReviewはParent Agentが担う。

## 3.3. Discovery-specific Progression

| Step | Discovery固有の変換 | Result |
|---|---|---|
| Capture | Raw Sourceを評価で失わず取り込む | Source、Raw Voice、Provenance |
| Separate | Fact、Interpretation、Hypothesis、Candidateを分ける | Context Map |
| Clarify | Routeを分けるために必要な不足だけを確認する | Open Question、Evidence Gap |
| Frame | Origin、Problem、Outcome、Preserved Intentを対応づける | Discovery Brief Draft |
| Decide | Requirement処置とRouteを人間が判断する | Decision / Rationale、Coverage |
| Handoff | 受信先Entryを満たし、必要なRoute Artifactを登録・更新する | Handoff Result、Roadmap / Change等のArtifact Reference |

固定された会議回数や逐次実行を要求しない。質問の目的はFormを埋めることではなく、次の判断を変える不確実性を減らすことである。

## 3.4. Discovery-specific Question Topics

必要な項目だけを、回答済みContextを再質問せず確認する。

| Topic | Question Intent |
|---|---|
| Trigger | なぜ今、この対象を扱い始めたか |
| Actor / Situation | 誰または何が、どの場面で影響を受けるか |
| Concrete Evidence | 実際の事例、頻度、影響、Sourceは何か |
| Current Workaround | 現在の対応と、そこで守られている価値は何か |
| Desired Change | Feature名ではなく、何がどう変わればよいか |
| Preserved Value | 便利になっても失ってはいけないことは何か |
| Solution Candidate | 既存案と、その案でなくても守るべき目的は何か |
| Unknown | 分からないこと、確認先、確認方法は何か |

Evidenceが弱ければFactかHypothesisかを確認し、複数Problemは勝手に統合せずScopeを分ける。Stakeholderの価値が衝突する場合はDecisionへ、技術成立性が支配的ならTechnical Spikeへ、言葉だけで判断できなければPrototypeへRouteする。

## 3.5. Stop and Escalation

次の場合、AIは確定またはHandoffを止め、人間または専門AuthorityへEscalateする。

- 人間のOriginと依頼されたSolutionが矛盾する
- Stakeholderの価値、Scope、Priority、Risk Acceptanceが重大に衝突する
- Evidence不足のまま判断すると法務、安全、Privacy、Security上のRiskがある
- Business Model、法的適用、個人Data利用、外部Action Authorityの決定が必要である

---

# 4. Requirement Promotion and Decision

## 4.1. Promotion Criteria

Requirement Candidateを`REQ-*`へ昇格するには、少なくとも次を満たす。

- 満たすべき独立した意味単位として説明できる
- Origin、Problem、Outcome、SourceまたはEvidenceへTraceできる
- Candidate、Hypothesis、Solutionのいずれでもないことを確認している
- Scope、対象、必要性、非発行または代替Routeとの差を説明できる
- 人間がRequirementとして採用している

Research、Decision、Prototype、No Action等へ進むだけなら、`REQ-*`を発行しなくてよい。顧客一人の発言、AI要約、AI推定のWhy、現行実装、未承認案、Prototypeが一度成立した結果だけから自動昇格しない。

## 4.2. Stable Context ID Action

| Finding | Action |
|---|---|
| 新しい独立Requirement | 新しい`REQ-*`を発行 |
| 既存Requirementの意味を保つ明確化 | 同じ`REQ-*`のRevisionを更新 |
| 既存Requirementを別の意味へ置換 | 新しい`REQ-*`を発行し`supersedes`で接続 |
| Requirementは同じでBehaviorを明確化 | 対象`SPEC-*`を同じ意味の範囲で改訂 |
| Behaviorの意味を置換 | 新しい`SPEC-*`を発行し`supersedes`で接続 |
| Evidence、Roadmap、Architecture、Change Trace、Test | CRDD標準Stable Context IDを発行せずArtifact参照で接続 |

分類前に既存Stable IDの意味を書き換えたり、新IDを仮発行したりしない。

## 4.3. Decision and Rationale

対象利用者、Non-goal、Problemの優先、Requirement昇格、Route、Legacy挙動の維持等を決定した場合、決定結果となるCanonical Artifactの`Decision / Rationale`へAdopted Result、理由、Evidence、代替、経緯、影響を残す。Discoveryの作業メモや中央Decision Fileだけを正本にしない。

## 4.4. Legal and Regulatory Source

法令変更では、法令本文または外部正本、Revision、施行日、Jurisdiction、適用範囲、解釈AuthorityをEvidenceとして保持する。AIの解釈だけで法的義務を確定しない。

新しい義務なら新しい`REQ-*`、既存Requirementの意味を保つ明確化なら同じIDのRevisionを用いる。緊急または施行期限内の対応はChange Traceへ、採用済みで将来着手する対応はRoadmapへREQ参照と期限を置く。

---

# 5. Routing and Lifecycle Scenarios

## 5.1. Route Selection

| Route | Use When |
|---|---|
| `Continue Discovery / Research` | Problem、対象、外部事実、制度、利用者Evidenceが不足 |
| `Decision` | 選択肢と判断材料があり、人間の価値判断が必要 |
| `UX` | Actor、Situation、Problem、Desired Outcomeを体験設計へ変換できる |
| `IA` | 承認済みIntentの範囲で概念、責務、情報構造の再設計が主題 |
| `UI / SPEC` | 上流Intentが承認済みでInteraction / Behaviorの具体化が主題 |
| `Prototype / Experiment` | 言葉だけでは仮説や成立性を判断できない |
| `Architecture / Technical Spike` | 技術制約や成立性が主要な不確実性 |
| `Existing Context Update` | 新規意味ではなく既存Contextの訂正、補足、明確化 |
| `Change Trace` | 採用済みの変更または明確なDefectのTriggerと影響をReleaseまで追跡する |
| `Roadmap Candidate` | Requirementを採用したが現時点では着手しない |
| `No Action / Archive` | 重複、誤認、対象外、または採用しないと人間が判断した |

RouteはAIが提案してよいが、Scope、Priority、採用・却下、延期を伴う最終判断は人間が行う。Discoveryから必ずUXへ進む必要はない。

## 5.2. Classification Before Routing

| Trigger | First Check | Result |
|---|---|---|
| 顧客ヒアリング / Idea | Raw Voice、Evidence、Problem、Requirement Candidateを分離 | 新規REQ、既存REQの補強、Research、No Action等 |
| 法令変更 | Source、Revision、施行日、Jurisdiction、適用範囲 | 新規 / 改訂REQ、Impact確認、Change Trace / Roadmap |
| 明確な仕様変更 | Requirementも変わるか、Behaviorだけか | REQ / SPEC処置とChange Trace / Roadmap |
| 不具合 | Approved UI / SPECと実装事実の差が明確か | 明確ならIDを維持してDefect Change Trace |
| 仕様変更か曖昧 | 期待、承認済み仕様、実装事実を比較 | 分類までDiscovery / Researchを継続 |

現行仕様が存在しない、Authorityが不明、または期待動作自体が未確定なら、単純なDefectとして扱わない。修正中に現行仕様自体が不適切と判明した場合も、Defect Routeを止め、RequirementまたはSpecification Changeとして再分類する。

## 5.3. Initial Development and Maintenance Paths

初期開発と保守期は同じ分類原則を使う。違いは既存Canonical Context、稼働中System、Release制約の有無である。

| Trigger | Initial Development | Maintenance |
|---|---|---|
| 顧客ヒアリング / Idea | Evidenceと人間判断から必要ならREQを確立し、直近の専門工程またはRoadmapへ | 既存REQ / UX / IA / UI / SPECと比較し、補強、改訂、置換、新規を判断 |
| 法令変更 | 適用SourceからREQを確立し、期限に応じChangeまたはRoadmapへ | 稼働Releaseへの期限と影響を評価し、緊急Changeまたは期限付きRoadmapへ |
| 明確な仕様変更 | Requirement影響を確認して対象Canonical ArtifactとChangeを更新 | 既存IDの意味、Compatibility、Migration、Release影響を確認してChangeへ |
| 不具合 | Approved UI / SPECとの差が明確なら新REQなしでChangeへ | Incident / Test Evidenceを承認済みContextと比較し、IDを維持して修正・回帰検証 |
| 仕様変更か曖昧 | 期待、仕様、実装事実をDiscoveryで比較し、分類後にRoute | Support / Operation / Monitoring Inputを同様に比較し、分類まで新IDやRoadmap昇格を行わない |

## 5.4. Representative Context Paths

顧客ヒアリングから採用し、すぐ着手する例:

```text
01_Discovery/Evidence/Customer_Interview_01.md
  → interpretation / human decision
01_Discovery/01_Product_Requirements.md#missed-important-topic
  └─ REQ-000012
       → 02_UX / 03_IA / 04_UI / 05_SPECのCanonical Artifact
       → 90_Release/Changes/CHG-000001_Important_Topic_Review.md
       → 06_Architecture → 40_DevelopのCode → Verification
```

採用したが後で着手する例:

```text
REQ-000012
  → referenced_by
99_Roadmap/01_Product_Roadmap.md#important-topic-review
  → starts_as
90_Release/Changes/CHG-000003_Important_Topic_Review.md
```

明確なDefectの例:

```text
05_SPEC/Evidence/Topic_Behavior_Failure.md
  → shows deviation from SPEC-000044 / UI-000021
90_Release/Changes/CHG-000004_Fix_Topic_Read_State.md
  → Implementation / Regression Test / Verification Evidence
```

曖昧な要求の例:

```text
01_Discovery/Evidence/Support_Request_27.md
  → compare Expected / Approved Specification / Observed Implementation
  ├─ implementation deviation → Defect Change Trace
  ├─ missing requirement      → new or revised REQ
  ├─ changed behavior intent  → revised/new SPEC
  └─ insufficient evidence    → Research / Observation
```

---

# 6. `01_Discovery` and `99_Roadmap`

## 6.1. Responsibility Boundary

`01_Discovery`と`99_Roadmap`は時間軸ではなく責務が異なる。

| Folder | Responsibility | Authority |
|---|---|---|
| `01_Discovery` | Source、Evidence、不確実性、Requirement Candidateを受け取り、追跡すべきRequirementを確定する | Discovery Source、Evidence、`REQ-*` |
| `99_Roadmap` | 採用済みだが未着手の内容についてPriority、Target、Dependency、Start Conditionを示す | 将来実施計画。Requirement、Specification、Designの正本ではない |

```text
01_Discovery = 何が分かり、何を満たす必要があるか
99_Roadmap   = 採用済みの何を、いつ・どの順序で扱うか
```

## 6.2. Transition Rules

- 今すぐ対応する採用済み内容はChange Traceへ進む
- 将来対応すると決めた内容は、回答上のRecommendationだけで終えず、Roadmapから対象REQと影響Contextを参照する
- 追加調査が必要な内容はDiscoveryに留める
- 採用しない内容は決定結果となるDiscovery Artifactの`Decision / Rationale`へ理由を残す
- 明確なDefectは不要なDiscoveryやREQを増やさずChange Traceへ進める
- 着手時もRoadmap文書を`90_Release`へ移動せず、新しいChange TraceへLinkする
- 完了後の確定内容はCanonical Artifactへ残し、RoadmapはStatusと成果物参照だけを更新する

Discovery文書やEvidenceをRoadmapへ移動せず、Requirement本文やSpecification本文をRoadmapへ複製しない。Roadmap項目へCRDD標準Stable Context IDを付与せず、文書番号、Path、Anchor、必要なら外部Issue / Project IDで識別する。

## 6.3. Roadmap Item Contract

Roadmap Itemは、Human Authorityが採用したが現在Scopeでは着手しない内容を、再評価と着手判断へ接続するPlan Viewである。AIはDraftと更新を行えるが、採用、延期、Priority、Target、着手、取消を自己承認しない。

Roadmap Routeを確定する場合、既存Itemとの重複を確認し、次を一つのItemまたは外部Roadmap Toolの同等Recordへ保持する。

```text
Title / Artifact Reference
Status
Source REQ / Context
Adopted Outcome / Preserved Intent
Reason for Deferral
Priority / Target
Dependency
Owner / Roadmap Authority
Start Condition
Review Date or Re-evaluation Trigger
Known Risk / Unresolved Gap
Human Decision / Rationale Reference
Started CHG Reference
Result / Canonical Artifact / Verification Reference
```

AIが対象Roadmapへ書き込むAction Authorityを持たない場合は、登録先、Draft Item、必要Authorityを提示し、対象Itemだけを`Pending Registration`としてHandoffする。登録済みまたはRoadmap Route完了と表現せず、権限を得た人間またはAgentが登録ReferenceをDiscovery Resultへ戻した時点で、そのItemを完了とする。他Itemの独立したRouteとHandoffは継続できる。

Roadmap ItemをRequirement、SPEC、Design、Decisionの正本にせず、採用結果と理由は責務を持つCanonical Artifactへ残す。Roadmap ItemにはCRDD Stable Context IDを発行しない。

Roadmapは原則として単一の`99_Roadmap/01_Product_Roadmap.md`をMain Viewとする。通常のItemはMain View内で完結させる。比較案、調査、Dependency、段階計画等の詳細がMain Viewの可読性を損なう場合だけ、Itemから参照する別のDetail Fileへ分けてよい。Detail FileはRoadmap Itemの補助であり、Requirement、Decision、SPEC、Design、Evidenceの正本または恒久Archiveにしない。Detail FileにもCRDD Stable Context IDを発行しない。

## 6.4. Roadmap Lifecycle and Activation

```text
Discoveryで採用 + 今回は着手しない
                │
                ↓
        Roadmap Main Viewへ登録
          ├─ Action Authorityなし → Pending Registration
          └─ 詳細が必要 → Detail Fileを参照
                │
      Start Condition / Re-evaluation Trigger
                ↓
        Ready for Start Review
        ├─ 再延期 → Owner / Target / Trigger更新
        ├─ Cancel → Decision / Rationale参照
        └─ Human Start Decision
                ↓
              CHG-*
                ↓
      必要な工程 → Implementation → Verification
                ↓
      正本・CHG・適用される結果へDetail固有情報を反映
                ↓
      Main ViewへCompletedと結果参照 / 非適用理由を記録
                ↓
          Detail Fileを削除
```

| Status | Meaning | Required Action |
|---|---|---|
| `Deferred` | 採用済みだが現在は着手しない | Owner、Start Condition、再評価Triggerを保持する |
| `Ready for Start Review` | Start Conditionまたは再評価Triggerへ到達した | 現行ContextとImpactを確認し、Human Authorityへ着手・再延期・取消を提示する |
| `Started` | Human Authorityが着手を決めた | 新しい`CHG-*`を作成し、相互参照する |
| `Completed` | 適用される対応と必要なVerificationを完了した | Main ViewへCanonical Artifactと、適用されるImplementation / Verificationを参照し、非適用理由を必要に応じて示してDetail Fileを削除する |
| `Cancelled` | 採用後に実施しないと決めた | Human Decision、理由、影響を参照する |

CRDDは時刻Schedulerや外部通知を必須としない。Project固有Roadmap Authorityは、計画Review、Change / Release計画、Dependency解消、期限到達、関連Evidence / Law / Riskの変化等、宣言したTriggerで対象Itemを再評価する。通常実行でRoadmap全件を無差別に読み込まず、Active Scopeと関係するItem、Triggerへ到達したItem、Dependency / Targetが今回計画と重なるItem、Roadmap Authorityが指定したItemを対象にする。Triggerへ到達したItemを自動的に`Started`へ昇格せず、Human Start Decisionを得る。

着手時はRoadmap内容を実装指示として直接使用せず、Source Contextの現行RevisionとImpactを再確認し、[Change](00_12_Change.md)に従って`CHG-*`を作成する。再延期ではOwner、理由、Target、再評価Triggerを更新する。

完了時は、Detail Fileにしか存在しない採用結果、Decision / Rationale、Evidence、Constraint、Known Riskを、責務を持つCanonical Artifactと、適用されるCHG、Implementation Artifact、Verification Resultへ反映する。Documentation-only、Research、No-code Operation等でImplementationまたはVerificationが適用されない場合は、無理にArtifactを作らずMain Viewへ`Not Applicable`理由を示す。Main ViewのItemへ`Completed`、適用されるCHG、結果Artifact、Verification Referenceを戻し、参照可能性を確認した後、Detail Fileを削除する。確定した意味をMain Viewへ複製せず、Detail Fileを完了記録やRoadmap Archiveとして残さない。Git履歴は削除前の経緯確認に利用できるが、正本反映の代替にしない。

---

# 7. Discovery Brief and Handoff

## 7.1. Discovery Brief

Discovery Briefは新しいAuthorityではなく、Phase Process Contractの結果を受信先へ渡すViewである。小規模Scopeでは一つの短いMarkdownまたは既存Canonical Artifact内のSectionでよい。

```text
# Discovery Brief

## Scope and Coverage
対象、Coverage State、未網羅項目

## Trigger / Origin and Raw Voice
何が始まりで、なぜ今扱うか、原始的な表現

## Actor / Situation and Problem
誰または何が、どの状況で、何に困るか

## Evidence / Interpretation / Hypothesis
Source、Provenance、Authority、根拠の限界、解釈、仮説

## Desired Outcome and Preserved Intent
変えたい状態、守る価値、Non-goal

## Requirement and Solution Candidates
候補の区別、採用済みREQへの参照、非発行理由

## Constraints / Assumptions / Open Questions
未決事項、確認Owner、確認方法

## Recommended Route and Human Confirmation
選択Route、理由、却下・延期Route、受信先、人間判断

## Phase Transition Review
Review Role、対象Revision、Result、Finding / Remediation、再Review、Review Exception
```

## 7.2. Handoff Review

Handoff時は文章の完成度ではなく、受信先が次の判断を開始できるかを確認する。すべてのRequirement、解決策、技術方式、Open Questionの確定は要求しない。

UXへ渡す場合は、少なくとも、なぜ取り組むか、誰がどの状況で困るか、どう変われば成功か、何を守るか、EvidenceとHypothesis、未決事項を説明できなければならない。対象ScopeのDiscovery Coverageが完了していない場合は、通常完了を装わず、明示的な部分Handoff承認を得る。

Discoveryから戻るLearningは、元のSource、REQ、後続Contextとの関係を維持したまま、Evidence、Hypothesis、Decision / Rationale、Requirement Revisionへ反映する。

---

# 8. Final Principle

```text
Discoveryは、AIが正しい答えを作る工程ではない。
人間が持つ思いと、現在分かっている現実を、
次の判断へ進めるContextに変える工程である。

分からないことは、分からないまま残してよい。
ただし、何が分からず、次にどう確かめるかは残す。
```
