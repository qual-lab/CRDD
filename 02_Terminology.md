<a id="crdd-terminology"></a>

# CRDD用語集（Terminology）

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-22
Related:
- [00_Overview.md](00_Overview.md)
- [01_Principles.md](01_Principles.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [13_Release.md](13_Release.md)
- [14_Workflow.md](14_Workflow.md)
- [19_Maintenance.md](19_Maintenance.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - CRDDで使う重要な用語の平易な意味
> - 似ている用語をどう区別するか
> - その情報を誰が作り、誰が確定するか
> - 用語ごとの入力、出力、状態遷移
> - 共通参照に使う正式な英語名

<a id="purpose"></a>

# 目的

本ドキュメントは、CRDDで使用するCanonical Term、各Termの境界、基本的な責務とAuthority、Lifecycle / Status、Aliasの正本である。Context間を一気通貫で変換する概念モデルは[`01_Principles.md`](01_Principles.md)を正本とする。

他のCRDD文書は、本書で定義された概念を再定義してはならない。専門領域固有の詳細な運用、Lifecycle、Approval、Schemaは各専門標準で定義してよいが、本書のCanonical Definitionと矛盾してはならない。

本書は、CRDDに登場するすべての専門用語を網羅する百科事典ではない。以下を対象とする。

```text
Core Context Type
CRDD全体を横断するSupporting Concept
責務・Authorityを表すCanonical Term
主要なLifecycle / Status Term
Alias / Deprecated Term
```

本書を含むCRDD文書で用いる規範強度語彙の意味は、[`03_Documentation.md`](03_Documentation.md#48-normative-language)を正本とする。

---

<a id="1-core-context-types"></a>

# 1. 中核となるコンテキスト種別（Core Context Types）

各用語は、読者が先に概念の輪郭をつかめるよう、一言説明を示した後に正式な定義を示す。日本語表示名は本文を読むための名称であり、正式英語名（Canonical Term）を変更しない。

```text
正式英語名
定義
目的
作成主体
決定権限
入力
出力
状態遷移
関連用語
必須（MUST）
禁止（MUST NOT）
```

<a id="11-observation"></a>

## 1.1. 観察（Observation）

一言で言うと、**まだ原因や意味を決めていない、実際に見聞き・計測した事実**。

例: 利用者の発言、操作Log、計測値、画面上で実際に起きた挙動。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Observation` |
| 定義 | 人間、System、Sensor、Tool、またはAIによる抽出が観測・記録した内容。意味付けや原因説明を含まない一次的な記述。 |
| 目的 | 現実について確認可能な出来事、状態、発言、挙動をコンテキストリポジトリへ取り込む。 |
| 作成主体 | 人間、System、Tool、Sensor、AIによる抽出 |
| 決定権限 | 観察の採用者は人間または信頼されたSystem。AIは抽出・整形できるが、観測していない内容を追加できない。 |
| 入力 | 現実、会話、Log、実行挙動、計測、画像、資料、運用実態 |
| 出力 | 根拠、解釈、Gap Finding、調査事項 |
| 状態遷移 | `Captured` → `Reviewed` → `Accepted` / `Rejected` / `Superseded` |
| 関連用語 | 根拠、情報源、来歴、復元されたコンテキスト |
| 必須（MUST） | 情報源、取得時点、対象範囲を追跡できること。観察内容と解釈を分離すること。 |
| 禁止（MUST NOT） | 原因、意図、一般化された結論を観察として確定しないこと。 |

<a id="12-evidence"></a>

## 1.2. 根拠（Evidence）

一言で言うと、**主張や判断が妥当かを後から確かめるための参照可能な材料**。

例: 原文、Log、計測結果、Test結果、法令、録画。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Evidence` |
| 定義 | 観察、主張、判断、要求、検証結果等を裏付ける参照可能な根拠。 |
| 目的 | コンテキストの信頼性、由来、再確認可能性を担保する。 |
| 作成主体 | 人間、System、Tool、AIによる収集・索引化 |
| 決定権限 | 内容と真正性は情報源に由来する。CRDD上の採用、分類、適用範囲、鮮度判断は対象コンテキストのOwner、人間の決定権限、または承認済みRuleが担う。 |
| 入力 | 観察、文書、Log、録画、Test結果、計測値、外部情報源、成果物 |
| 出力 | 解釈、仮説評価、判断支援、検証結果 |
| 状態遷移 | `Collected` → `Validated` → `Accepted` / `Expired` / `Invalidated` / `Superseded` |
| 関連用語 | 観察、情報源、成果物、来歴、検証結果 |
| 必須（MUST） | 情報源、対象、取得条件、Revisionまたは時点を追跡できること。 |
| 禁止（MUST NOT） | 根拠そのものを解釈、判断、要求として扱わないこと。情報源不明の主張を根拠と呼ばないこと。 |

<a id="13-interpretation"></a>

## 1.3. 解釈（Interpretation）

一言で言うと、**観察や根拠から「何を意味するか」を説明したもの**。

例: 「離脱が多いのは、入力項目が理解しにくい可能性がある」。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Interpretation` |
| 定義 | 観察または根拠に対する意味付け、説明、分類、因果候補。 |
| 目的 | 観測された情報を、人間が検討・判断できる理解へ変換する。 |
| 作成主体 | 人間、AI、専門家 |
| 決定権限 | 解釈の作成者。判断、要求、正本コンテキストへ昇格する場合は、対象の決定権限によるReviewを必要とする。AIは複数案と確信度を提示できる。 |
| 入力 | 観察、根拠、既存コンテキスト、Domain Knowledge |
| 出力 | 仮説、提案、調査事項、Gap Finding |
| 状態遷移 | `Draft` → `Reviewed` → `Accepted` / `Rejected` / `Superseded` |
| 関連用語 | 根拠、仮説、確信度、来歴 |
| 必須（MUST） | 根拠となる観察または根拠へTraceできること。確実性を超えて断定しないこと。 |
| 禁止（MUST NOT） | 解釈を観察、根拠、判断として表現しないこと。 |

<a id="14-hypothesis"></a>

## 1.4. 仮説（Hypothesis）

一言で言うと、**まだ検証されていない説明、予測、成立条件**。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Hypothesis` |
| 定義 | EvidenceまたはInterpretationから導かれた、まだ検証されていない説明・予測・成立条件。 |
| 目的 | 不確実な理解を明示し、Research、Prototype、Test、Proposalの対象にする。 |
| 作成主体 | Human / AI / Expert |
| 決定権限 | Humanが検証Priorityと採否を判断する。AIは生成・比較・反証候補提示を行える。 |
| 入力 | Interpretation、Evidence、Observation、既存Learning |
| 出力 | Research Plan、Experiment、Proposal、Validation Need |
| 状態遷移 | `Candidate` → `Under Validation` → `Supported` / `Refuted` / `Inconclusive` / `Superseded` |
| 関連用語 | Interpretation、Proposal、Evidence、Verification Result、Learning |
| 必須（MUST） | 未検証であること、検証方法または不足Evidenceを明示しなければならない。 |
| 禁止（MUST NOT） | 検証前に確定Factまたは確立済みLearningとして扱ってはならない。DecisionやRequirementのInputにする場合は、未検証性、Risk、検証または見直し条件を隠してはならない。 |

<a id="15-proposal"></a>

## 1.5. 提案（Proposal）

一言で言うと、**採用するかを人間が判断する前の選択肢や解決案**。

例: 案Aと案B、推奨案、却下候補、延期候補。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Proposal` |
| 定義 | 採用前の解決案、方針案、設計案、選択肢、変更案。 |
| 目的 | 人間が代替案、Trade-off、Riskを比較してDecisionを行えるようにする。 |
| 作成主体 | Human / AI / Expert / Team |
| 決定権限 | AIは作成・推奨できる。採用AuthorityはHumanにある。 |
| 入力 | Interpretation、Hypothesis、Evidence、Constraint、Principle、Requirement、Gap |
| 出力 | Decision、Experiment、Prototype、Rejected / Deferred Proposal |
| 状態遷移 | `Candidate` → `Reviewed` → `Promoted to Decision` / `Rejected` / `Deferred` / `Superseded` |
| 関連用語 | Hypothesis、Decision、Alternative、Trade-off、Risk |
| 必須（MUST） | Decisionと明確に区別し、Statusと提案主体を保持しなければならない。重要Proposalでは根拠・代替案・Riskを示さなければならない。 |
| 禁止（MUST NOT） | Human Approval前に採用済み方針として扱ってはならない。 |

<a id="16-decision"></a>

## 1.6. 判断（Decision）

一言で言うと、**人間が何を採用、却下、延期するかを確定した記録**。

例: 案Bを採用する、Riskを受容する、今回のReleaseには含めない。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Decision` |
| 定義 | Human Authorityが採用、却下、延期、例外許容、優先順位等を確定した判断。 |
| 目的 | Productや組織が何を選び、なぜ選んだかを将来へ継承する。 |
| 作成主体 | Human Authority。AIはDraftとDecision Candidateを作成できる。 |
| 決定権限 | Human Only。Authorityは対象Scopeに応じたOwner / Approverが持つ。 |
| 入力 | Proposal、Evidence、Interpretation、Principle、Constraint、Trade-off、Risk |
| 出力 | Requirement、Plan、Scope、Principle Update、Exception、Rejected / Deferred Item |
| 状態遷移 | `Recorded` → `Active` → `Superseded` / `Reversed` |
| 関連用語 | Proposal、Canonical Artifact、Authority、Requirement、Rationale |
| 必須（MUST） | Decision maker、日時、対象Scope、Decision Outcome、Rationale、主要Evidence、影響Contextを保持しなければならない。 |
| 禁止（MUST NOT） | AIが自己承認してはならない。履歴を破壊的に上書きしてはならない。 |

<a id="17-requirement"></a>

## 1.7. 要求（Requirement）

一言で言うと、**Product、System、Processが満たす必要のある条件**。

例: 利用者が誤操作から復旧できること、法定期間ログを保持すること。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Requirement` |
| 定義 | Discoveryで得た問題、Need、Evidence、法令、Contract、Constraint等から導かれる、Product、System、Processが満たすべき条件。 |
| 目的 | Discoveryの結果を、UX、IA、UI、Behavior Specificationへ引き渡せる追跡可能な要求として定義する。 |
| 作成主体 | Human / Analyst / Discovery Agent / Expert。AIはDraftできる。 |
| 決定権限 | 対象ScopeのHuman AuthorityがProductへの採用、適用、優先度を決める。外部法令・Contract由来の義務そのものは外部Authorityを保持し、人間判断で由来を上書きしない。 |
| 入力 | Observation、Evidence、Problem、Need、Decision、Principle、法令、Contract、Constraint |
| 出力 | UX / IA / UI / Behavior SpecificationへのObligation、Architecture Input、Plan、Verification Obligation |
| 状態遷移 | `Candidate` → `Draft` → `Reviewed` → `Approved` → `Active` → `Superseded` / `Deprecated` / `Retired` |
| 関連用語 | Decision、UI Contract、Behavior Specification、Acceptance Criteria、Verification Result |
| 必須（MUST） | 該当するDiscovery Source、Evidence、Problem、Need / Desired Outcome、Decisionまたは正当なAuthorityのいずれかへ必要な粒度でTrace可能でなければならない。対象Riskと抽象度に応じたVerification Obligation、または確認方法を後続工程で定義する責務を持たなければならない。 |
| 禁止（MUST NOT） | 根拠のないAI推定を承認済みRequirementとして扱ってはならない。UX OutcomeやDesign IntentをBehavior構文だけへ圧縮してはならない。Implementation StatusやVerification StatusをRequirement自身のStatusとして流用してはならない。 |

<a id="18-behavior-specification"></a>

## 1.8. 振る舞い仕様（Behavior Specification）

一言で言うと、**特定の条件や状態でSystemがどう振る舞うかを検証可能に定めたもの**。

例: 未入力で保存した場合は保存せず、対象項目と修正方法を示す。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Behavior Specification` |
| 定義 | Feature、Use Case、User Action等について、特定のCondition、Trigger、State、Inputに対してSystemが何を行い、何を変更・出力し、例外・失敗・回復をどう扱うかを定義した検証可能な振る舞い仕様。 |
| 目的 | Requirement、UX、IA、UI Contract、Business Ruleを、実装・検証へ渡せる具体的なSystem Behaviorへ変換する。 |
| 作成主体 | Human / Analyst / SPEC Agent / Expert。AIはDraftできる。 |
| 決定権限 | 対象ScopeのProductまたはDomain Authorityが意味を承認する。ArchitectureやImplementationは承認済みBehavior Specificationを無断で弱めない。 |
| 入力 | Requirement、Decision、Feature、Use Case、User Action、IA、UI Contract、Business Rule、Constraint |
| 出力 | Architecture Input、Implementation Obligation、Acceptance Criteria、Verification Obligation |
| 状態遷移 | `Candidate` → `Draft` → `Reviewed` → `Approved` → `Active` → `Superseded` / `Deprecated` / `Retired` |
| 関連用語 | Requirement、UI Contract、State、Business Rule、Acceptance Criteria、Verification Result |
| 必須（MUST） | Condition、Trigger、State、Behavior、Exception、AcceptanceまたはVerification方法を対象Riskに応じた粒度で持たなければならない。Source Requirementまたは正当なAuthorityへTrace可能でなければならない。 |
| 禁止（MUST NOT） | Requirement、UX Outcome、UI表現、Architecture方式、実装詳細と同一視してはならない。Implementation StatusやVerification StatusをBehavior Specification自身のStatusとして流用してはならない。 |

Requirementは「何を満たす必要があるか」を定義し、Behavior Specificationは「どの条件と状態でSystemがどう振る舞うか」を定義する。

Behavior Specificationが承認され、UI、Architecture、Implementation、Verificationの基準として利用される場合、契約的な役割を果たす。ただし、その役割を別のContext Typeである`Behavior Contract`として扱ってはならない。

<a id="19-plan"></a>

## 1.9. 計画（Plan）

一言で言うと、**採用済みの内容を実現する順序、担当、完了条件を定めたもの**。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Plan` |
| 定義 | RequirementやDecisionを実現するための順序、Scope、Task、Dependency、Owner、Gate、Verificationを定めた実行計画。 |
| 目的 | 採用済みContextを、実行可能かつ中断・確認可能な作業へ変換する。 |
| 作成主体 | Human / Planning Agent / Team |
| 決定権限 | Human OwnerがScope、Priority、Schedule、Riskを承認する。 |
| 入力 | Requirement、Architecture、Decision、Constraint、Impact Analysis、Resource |
| 出力 | Task、Milestone、Change Trace Reference、Delivery Instruction、Verification Plan |
| 状態遷移 | `Draft` → `Reviewed` → `Approved` → `In Progress` → `Completed` / `Cancelled` / `Superseded` |
| 関連用語 | Requirement、Change Trace、Task、Gate、Implementation |
| 必須（MUST） | 対象Requirement、Scope、Dependency、完了条件、Ownerを追跡可能にしなければならない。 |
| 禁止（MUST NOT） | 未承認のScope削減やRequirement変更を暗黙に含めてはならない。 |

<a id="110-implementation"></a>

## 1.10. 実装（Implementation）

一言で言うと、**承認済みの内容を動作・利用できる形にした実体**。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Implementation` |
| 定義 | 承認済みContext、Behavior Specification、Architecture、UI等に基づいて作成・変更されたCode、Configuration、Migration、Infrastructure、配布Content、Developer Test、Build等の実行可能または配布可能な実体。 |
| 目的 | 採用済みContextを、動作・利用・評価可能な現実の成果へ変換する。 |
| 作成主体 | Human / AI Agent / Tool / System |
| 決定権限 | 作成Authorityと採用Authorityを分離してよい。Baselineへの統合はProjectのAgent / Review Contract、Releaseへの採用はHuman Release Authorityが決める。 |
| 入力 | Plan、Requirement、Behavior Specification、Architecture、UI / Graphic、Asset、Constraint、Change Trace |
| 出力 | Executable Artifact、Configuration、Migration、Developer Test、Build、Release Candidate、Verification Target |
| 状態遷移 | `Planned` → `In Progress` → `Implemented` → `Superseded` / `Retired` |
| 関連用語 | Artifact、Plan、Requirement、Behavior Specification、Architecture、Verification Result |
| 必須（MUST） | 対応するPlan、Requirement、Behavior Specificationのうち該当するContextへTrace可能でなければならない。Deviationと既知Limitを明示しなければならない。 |
| 禁止（MUST NOT） | 動作していることだけを理由に、上流DecisionやRequirementの正本として扱ってはならない。`Implemented`を`Verified`または`Released`として扱ってはならない。 |

<a id="111-verification-result"></a>

## 1.11. 検証結果（Verification Result）

一言で言うと、**特定Revisionが期待条件を満たしたかを、条件と根拠付きで示した結果**。

例: 対象Build、Environment、実行条件、Pass / Fail、確認に使った根拠。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Verification Result` |
| 定義 | 対象RevisionのRequirement、Behavior Specification、Contract、Acceptance Criteria、Outcome等に対する検証結果とEvidence。 |
| 目的 | ImplementationやContextが期待条件を満たすか、どの条件では満たさないかを明らかにする。 |
| 作成主体 | Human Reviewer / Test Agent / Tool / System / User Researcher |
| 決定権限 | 検証方法と対象に応じたReviewerまたはQuality Authority。AIは実行・整理できるがRisk受容を決められない。 |
| 入力 | Requirement、Behavior Specification、Acceptance Criteria、Implementation、Environment、Test、Observation |
| 出力 | Pass / Fail / Blocked、Gap、Finding、Decision Input、Learning Candidate |
| 状態遷移 | `Produced` → `Reviewed` → `Accepted` / `Invalidated` / `Superseded` |
| 関連用語 | Evidence、Requirement、Behavior Specification、Implementation、Gap、Learning |
| 必須（MUST） | 対象Revision、Environment、実行条件、結果、Evidenceを保持しなければならない。 |
| 禁止（MUST NOT） | Test PassだけをProduct Outcome達成の証明として扱ってはならない。古いRevisionのResultを現行検証として再利用してはならない。ResultのLifecycle、Verification Outcome、Human Acceptanceを同一Statusとして扱ってはならない。 |

<a id="112-learning"></a>

## 1.12. 学び（Learning）

一言で言うと、**実際の結果から得られ、将来の判断や改善へ再利用できる知見**。

| 項目 | 内容 |
|---|---|
| 正式英語名 | `Learning` |
| 定義 | Observation、Verification Result、運用、Decision結果等から抽出され、将来再利用できる形に整理された知見。 |
| 目的 | 同じ失敗・調査・判断を繰り返さず、Product、Method、Standard、Roadmapを改善する。 |
| 作成主体 | Human / AIによる整理。正式PromotionはHuman Reviewを必要とする。 |
| 決定権限 | 対象RepositoryまたはStandardのOwner。単一事例から一般Ruleへ昇格する場合は明示承認を必要とする。 |
| 入力 | Verification Result、Operational Observation、Decision Outcome、Incident、Experiment、Retrospective |
| 出力 | Discovery Context、Principle Update、Practice、Rule、Proposal、Roadmap、Training Context |
| 状態遷移 | `Candidate` → `Reviewed` → `Promoted` / `Rejected` / `Deferred` → `Superseded` / `Deprecated` |
| 関連用語 | Verification Result、Evidence、Practice、Rule、Proposal、Feedback Loop |
| 必須（MUST） | Source Evidence、適用範囲、Confidence、Promotion先を保持しなければならない。 |
| 禁止（MUST NOT） | Evidenceのない一般化やAI推定を確立済みLearningとして登録してはならない。 |

---

<a id="2-supporting-concepts"></a>

# 2. 横断して使う概念（Supporting Concepts）

Supporting Conceptは、Core Context Typeを保存・接続・実行・管理するための横断概念である。詳細な運用規則はRelated文書へ委譲する。

<a id="21-context"></a>

## 2.1. コンテキスト（Context）

一言で言うと、**人間とAIが後から同じ意味で参照できる情報単位**。

**定義:** CRDDで意味、理由、状態、関係、判断、要求、計画、実装、検証、学びとして扱われる、人間とAIが参照可能な情報単位。

**目的:** セッション、担当者、AI、Artifact、Releaseをまたいで、Productの意味と判断を継承する。

**決定権限:** Context Typeと対象Scopeに応じてHuman、System、外部Authorityが異なる。AIはAuthorityを自動取得しない。

**必須（MUST）:** Type、Source / Provenance、Status、Revision、Relationを必要な粒度で保持する。

**禁止（MUST NOT）:** すべての情報を無差別にContext Repositoryの正本へ昇格してはならない。

<a id="22-context-repository"></a>

## 2.2. コンテキストリポジトリ（Context Repository）

一言で言うと、**目的、判断、設計、実装、検証、学びをつないで残す情報基盤**。

**定義:** ProductのWhy、Context、Decision、Artifact参照、Trace、Versionを、人間とAIが継続利用できる形で管理するRepositoryまたは論理的な情報基盤。

**目的:** Product Contextの継承、再現、判断、変更、検証の基盤となる。

**決定権限:** Repository Owner。詳細は[`03_Documentation.md`](03_Documentation.md)を参照する。

**必須（MUST）:** Canonical Contextと外部ArtifactのProperty Authorityを明示する。

**禁止（MUST NOT）:** GitやMarkdownという媒体そのものを、すべてのPropertyの唯一の正本とみなしてはならない。

<a id="23-artifact"></a>

## 2.3. 成果物（Artifact）

一言で言うと、**コンテキストを表現、実装、検証する具体的な媒体**。

**定義:** 文書、Figma、Diagram、Code、Build、Asset、Log、動画等、Contextを表現・実装・検証する具体的な成果物。

**目的:** Contextを人間、AI、Systemが利用可能な形へ固定・参照する。

**決定権限:** Artifact TypeおよびPropertyごとに異なる。

**必須（MUST）:** 安定した参照、Version / Revision、OwnerまたはSourceを必要な範囲で持つ。

**禁止（MUST NOT）:** ArtifactとContextの意味を同一視してはならない。一つのArtifactに複数Contextが含まれてよい。

<a id="24-canonical-artifact"></a>

## 2.4. 正本成果物（Canonical Artifact）

一言で言うと、**特定の情報について現在の正式な内容を持つ成果物**。

**定義:** 特定のContextまたはPropertyについて、Authoritative Sourceとして承認または宣言されたArtifact。Decisionの結果は、原則として結果となるCanonical Artifactへ反映される。

**目的:** 人間とAIが、現在有効な意味、状態、判断とその理由を同じ参照先から取得できるようにする。

**決定権限:** Artifact全体ではなく、対象PropertyごとのProperty Authorityに従う。Git外のArtifactもCanonicalになり得る。

**必須（MUST）:** 対象Property、Owner、Status、Revision、取得方法を必要な粒度で識別可能にする。

**禁止（MUST NOT）:** Draft、Copy、Index、Change Trace、Review Viewを、宣言や承認なしにCanonical Artifactとして扱ってはならない。

<a id="25-property-authority"></a>

## 2.5. 項目の決定権限（Property Authority）

一言で言うと、**特定項目の正解をどこで確認し、誰が変更・承認するかという組合せ**。

**定義:** 特定のPropertyについて、競合時に最終参照するArtifact、System、外部Sourceと、その更新・承認責任の組合せ。

**目的:** 一つのArtifactや媒体を万能な正本にせず、意味、Visual、Code、Test Result、Release等の責務を適切なSourceへ分ける。

**決定権限:** 対象ScopeのHuman Authorityまたは正当に委任された外部Authorityが宣言する。

**必須（MUST）:** Property、Source、Owner、Revisionまたは有効時点、競合時の扱いを識別可能にする。

**禁止（MUST NOT）:** Folder番号、ファイル形式、Code、Markdown、Figma等の媒体だけから一律にAuthorityを推定してはならない。

`Source of Truth`は一般語として使用できるが、CRDDではArtifact全体よりProperty Authorityを優先して表現する。詳細は[Documentation](03_Documentation.md#22-property-authority)を参照する。

<a id="26-artifact-reference"></a>

## 2.6. 成果物参照（Artifact Reference）

一言で言うと、**安定IDを付けない成果物をPath、Revision、URL等で再識別する参照**。

**定義:** Stable Context IDを付与しないArtifactまたは外部Sourceを、Path、Anchor、Revision、URL、Record ID、Checksum等で再識別する参照。

**目的:** Architecture、Evidence、Decision、Change Trace、Implementation、Verification、Release、外部Artifactを、不要なStable Context IDを増やさず接続する。

**決定権限:** 参照先のProperty Authority。Reference自体は参照先のAuthorityを取得しない。

**必須（MUST）:** Locatorと、判断・検証に必要なRevisionまたは時点を保持する。

**禁止（MUST NOT）:** `latest`、壊れやすいSession URL、曖昧なファイル名だけを重要ArtifactのReferenceにしてはならない。

<a id="27-stable-context-id"></a>

## 2.7. 安定コンテキストID（Stable Context ID）

一言で言うと、**Fileが移動しても同じ意味を工程横断で追跡するID**。

**定義:** Artifactの場所や文書番号から独立して、複数Artifactまたは工程をまたいで追跡する意味を識別するID。

**目的:** 文書移動、統合、分割、実現手段の変更後も、同じContextのRelationと履歴を維持する。

**決定権限:** [Documentation](03_Documentation.md#8-stable-context-id)のAssignmentとAllocation規則に従うProjectの採番Authority。

**必須（MUST）:** CRDD標準では、Assignment Criteriaを満たす`REQ`、`UX`、`IA`、`UI`、`SPEC`だけに使用する。

**禁止（MUST NOT）:** ファイル名、Document Number、`CHG-*`、Architecture、Decision、Evidence、Test、Release等のArtifact IDと同一視してはならない。

<a id="28-context-selection"></a>

## 2.8. コンテキスト選択（Context Selection）

一言で言うと、**特定の作業に必要な既存情報を、対象Revision付きで選んだ入力集合**。

**定義:** 特定の作業、Agent、Skill、Reviewに必要な既存Contextを、対象Revisionへの参照として選んだInput Set。

**目的:** Repository全体を無差別に渡さず、必要なContext、Preserved Intent、Boundary、Known Uncertaintyを明示する。

**決定権限:** Selectionを構成するOwner、Invoker、Parent Agent、またはOrchestrator。正本Authorityは参照元Contextに残る。

**必須（MUST）:** Purpose、Scope、Source、Revision、Preserved Intent、Known Uncertaintyを必要な粒度で明示する。

**禁止（MUST NOT）:** 正本Contextを複製して独立更新し、別の正本を作ってはならない。

`Context Package`はContext Selectionを保存・受け渡すArtifact表現として使用できるが、別のContext Typeではない。詳細なInput契約は[Agent](10_Agent.md)と[Skill](11_Skill.md)、参照規則は[Documentation](03_Documentation.md)を参照する。

<a id="29-change-trace"></a>

## 2.9. 変更トレース（Change Trace）

一言で言うと、**一つの変更理由から影響、実装、検証、Releaseまでをつなぐ記録**。

**定義:** 一つのPrimary Change Intentについて、Trigger、Expected / Actual Impact、関連Context、実装、検証、Release帰属を`90_Release/Changes/CHG-*.md`で接続するTrace Artifact。

**目的:** Ticket、Pull Request、Commitだけでは失われる変更理由と影響範囲を、Canonical ContextからRelease結果まで追跡可能にする。

**決定権限:** Change Trace Owner。各PropertyのAuthorityは参照先のCanonical Artifact、工程、Human Authority、Release Authorityに残る。

**必須（MUST）:** Trigger、Primary Intent、Expected / Actual Impact、関連Context、Implementation / Verification Reference、Canonical Context Update、Release Dispositionを必要な範囲で保持する。

**禁止（MUST NOT）:** Requirement、SPEC、Architecture、Phase Approval、Impact Audit、Verification、Git Log、CHANGELOG等の正本をChange Trace内へ複製して置き換えてはならない。

`CHG-*`はChange Traceを参照するArtifact IDであり、Stable Context ID Typeではない。詳細は[`12_Change.md`](12_Change.md)を参照する。

<a id="210-workflow"></a>

## 2.10. 作業フロー（Workflow）

一言で言うと、**Repository内で繰り返す作業の開始条件、手順、確認、引渡しを定めたもの**。

**定義:** Repository内で反復する作業のTrigger、Input、順序、確認、停止、Handoffを定めたOperational Guide。

**目的:** Repository固有の作業方法を再現可能にし、結果を適切なCanonical Artifact、Change Trace、Releaseへ返す。

**決定権限:** Workflow Owner。Workflow自体はProduct Decision、Phase Approval、Release ApprovalのAuthorityを持たない。

**必須（MUST）:** Purpose、Trigger、Scope、Input Authority、Step、Validation、Stop条件、Output / Handoffを必要な粒度で持つ。

**禁止（MUST NOT）:** Product Context、Change Trace、Release Record、Agent / Skill共通規範を置き換えてはならない。

詳細は[`14_Workflow.md`](14_Workflow.md)を参照する。

<a id="211-release"></a>

## 2.11. リリース（Release）

一言で言うと、**配布物を特定Versionや利用者へ提供・有効化する人間の判断と実行**。

**定義:** 検証済みまたは明示的に条件付けされたDistribution Artifactを、特定Version、Environment、利用者へ配布または有効化するHuman DecisionとDelivery Event。

**目的:** 対象CHG、配布物、Release Readiness、Known Limitation、Migration、Release結果を接続する。

**決定権限:** Project固有のHuman Release Authority。VerificationはRecommendationを返すがReleaseを自己承認しない。

**必須（MUST）:** 対象Version / Environment、Included Scope、配布物、判断、条件、結果を必要な粒度で追跡可能にする。

**禁止（MUST NOT）:** Verification完了、Merge、Build成功をRelease承認またはRelease完了と同一視してはならない。

ReleaseはDiscoveryからVerificationまでと同じ設計工程ではない。詳細は[`13_Release.md`](13_Release.md)を参照する。

<a id="212-skill"></a>

## 2.12. スキル（Skill）

一言で言うと、**特定の入力を質問・分析・変換・Reviewによって定義済み出力へ導く再利用可能な方法**。

**定義:** 特定のContextをInputとして受け取り、質問・分析・変換・Reviewを通じて定義済みOutputへ導く再利用可能な作業方法。

**目的:** 専門知識や判断手順を、人間・AI・Expertが再現可能な形へする。

**決定権限:** Skill自体はAuthorityを持たない。実行者と対象ContextのAuthorityに従う。

**必須（MUST）:** Purpose、Input、Output、Authority Boundary、終了条件を持つ。

**禁止（MUST NOT）:** Skillの実行完了をPhase Gateの承認と同一視してはならない。

詳細は[`11_Skill.md`](11_Skill.md)を参照する。

<a id="213-phase-gate"></a>

## 2.13. 工程ゲート（Phase Gate）

一言で言うと、**対象を次の活動へ進めるか、人間が条件と根拠を確認して判断する境界**。

**定義:** 特定のFeature、Change、Revisionを次の活動へ進めるか、人間が条件とEvidenceを確認して判断する境界。

**目的:** 文書の存在ではなく、Contextの成熟度、Risk、未決、Verificationを基に進行を制御する。

**決定権限:** Gateごとに定義されたHuman Approver。

**必須（MUST）:** Scope、対象Revision、Exit Criteria、判断、条件、残存Riskを保持する。

**禁止（MUST NOT）:** AIが重要Gateを自己承認してはならない。

工程Gateに関係する詳細は、次を参照する。

- 共通のHandoff不変条件: [Transformation Invariants](01_Principles.md#62-transformation-invariants)
- 実行時のRouteとHandoff: [Skill](11_Skill.md)
- ArtifactのRevision: [Documentation](03_Documentation.md)
- 変更のImpact Trace: [Change](12_Change.md)
- 工程固有条件とReopen: 各工程文書の`Phase Gate Criteria`

<a id="214-trace"></a>

## 2.14. トレース（Trace）

一言で言うと、**由来、判断、実現、制約、検証の関係を双方向にたどれる状態**。

**定義:** Context、Artifact、Decision、Requirement、Behavior Specification、Implementation、Verification等の由来・実現・制約・検証関係を追跡できるRelation。

**目的:** 上流Intentから下流成果物へ、下流成果物から上流理由へ双方向に遡れるようにする。

**決定権限:** RelationのOwnerまたは対象Context Authority。

**必須（MUST）:** Relationの意味、Source / Target、対象Revisionを必要な粒度で保持する。

**禁止（MUST NOT）:** ファイルLinkが存在するだけで意味的Traceが成立したとみなしてはならない。

詳細は[`03_Documentation.md`](03_Documentation.md)のStable Context IDとTraceabilityを参照する。

<a id="215-gap-disposition-unresolved-gap-and-open-question"></a>

## 2.15. 未解決事項と処置（Gap, Disposition, Unresolved Gap, and Open Question）

一言で言うと、**期待する状態との差と、その差をどう扱い、いつ解消・再評価するかの記録**。

**差分（Gap）の定義:** 対象範囲で必要な責務、網羅性、Trace、整合、根拠、判断、成果物、または検証が不足・矛盾・未確認であり、期待する状態との差があること。

**未処置Gap（Undispositioned Gap）の定義:** 検出したGapのうち、対応、保留、Risk受容、対象外、影響なし等の処置を、必要な決定権限がまだ決定していないもの。

**未解決Gap（Unresolved Gap）の定義:** 検出したGapのうち、修正、根拠付き`Covered` / `No Impact`判定、または再検証によって解消を確認していないもの。`Deferred`、`Accepted Risk`、`Out of Scope`等の処置が決まっていても、対象範囲、より広いProduct範囲、将来Revisionのいずれかで解消または再評価が必要なら未解決Gapとして追跡する。

**未決の問い（Open Question）の定義:** 回答、調査、根拠、または人間判断を必要とする問い。未決の問いはGapの原因または解消手段になり得るが、未作成成果物、網羅漏れ、正本競合、未検証状態そのものと同一ではない。

**目的:** 未解決事項を曖昧な一語へ集約せず、何が不足し、なぜ必要で、進行へどう影響し、誰がどう解消するかを追跡可能にする。

**決定権限:** Gapの検出・分類候補は人間、AI、Audit、Verificationが作成できる。重要なDisposition、延期、Risk受容、Scope外判定は、対象PropertyまたはScopeのHuman Authorityが決定する。

**必須（MUST）:** Unresolved Gapは、Riskに応じて次を保持する。

- Type、Description、Reason、Impact
- DispositionとBlocking / Non-blocking
- OwnerとNext Action / Route
- ResolutionまたはReopen Condition

`Deferred`、`Accepted Risk`、`Out of Scope`では、判断したAuthority、適用Scope、期限または再評価Triggerも保持する。

人間向けにはCanonical Termだけを表示せず、「残っている未解決事項」等の自然なLabelと具体的な内容を示す。

**禁止（MUST NOT）:** `Open Gap`、`Gapあり`等のLabelだけを表示してはならない。Open Questionへの回答だけで、別に存在するCoverage、Conflict、Evidence、VerificationのGapまで解消したとみなしてはならない。

Gap / Impact Audit固有のGap Type、Disposition、Impact Levelは[`53_Gap_Impact_Audit.md`](53_Gap_Impact_Audit.md)を参照する。

<a id="216-triggered-propagation-check"></a>

## 2.16. 変更影響の伝播確認（Triggered Propagation Check）

一言で言うと、**新しい判断や学びが既存の上流・同層情報へ反映されているかを閉じるまで確認するRoute**。

**定義:** 新しい人間の判断、制約、学び、根拠、Findingが、既存の上流・同層Contextへ影響するかを必ず評価するRoute。影響する場合は、Gap / Impact Audit、必要な正本更新、再監査まで完了させる。

**目的:** 下流Artifactへ結果を記録しただけで、既存のOpen Question、Unresolved Gap、Assumption、Decision、Constraintが古いまま残ることを防ぐ。

**決定権限:** Gap / Impact AuditはCandidateとFindingを返す。各Property Authorityが正本を更新し、対象Human Authorityが重要Dispositionまたは例外を判断する。

**必須（MUST）:** Source Revisionから上流・同層を探索し、上流更新が生じた場合は更新後Revisionから下流Impactを再探索する。必須更新後は対象範囲を再監査する。

**禁止（MUST NOT）:** Audit Run完了、FindingへのOwner付与、下流Decisionの記録をPropagation Passとみなしてはならない。

Human Authorityが未完了のまま進める場合は`propagation_exception`として、Source Revision、未伝播範囲、Risk / Impact、Owner、再監査条件、失効・Reopen条件を記録する。これはPass、No Impact、Gap解消、Risk受容を意味しない。詳細は[Gap / Impact Audit](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を参照する。

## 2.17. ロケールと表示名（Locale and Display Name）

一言で言うと、**概念の共通キーを変えず、読者が理解しやすい言語で表示するための境界**。

| 用語 | 意味 |
|---|---|
| Canonical Concept | 言語に依存しない、CRDD上の概念と意味の境界 |
| Canonical Term | 共通参照に使用する正式な英語名 |
| Primary Locale | 文書、説明、質問、判断支援を読む人の主要ロケール |
| Localized Display Name | Primary Localeに合わせて表示する概念名 |

日本語では、例えば`Observation`というCanonical Termを「観察（Observation）」と表示する。初出後は同じ節で「観察」を使用できる。

**必須（MUST）:** Localized Display NameからCanonical TermとCanonical Conceptを特定でき、翻訳前後でRule、Authority、Status、Relationを同じ意味に保つ。

**禁止（MUST NOT）:** 言語ごとに別の正本を作らない。Localized Display Nameへの変換を理由に、Stable Context ID、Agent ID、File名、Schema Key / Value、Codeを変更しない。

---

<a id="3-responsibility-and-authority-terms"></a>

# 3. 責務と決定権限の用語（Responsibility and Authority Terms）

<a id="31-human"></a>

## 3.1. 人間（Human）

価値、意味、Priority、Trade-off、Risk Acceptance、重要Decision、最終責任を担う人間主体。

Humanはすべての作業を自ら行う必要はないが、AIまたはSystemへ委譲した作業の判断責任まで自動的に移転したとはみなさない。

## 3.2. AI

Contextの抽出、整理、比較、提案、Draft、変換、実装、検証支援を行う非人間主体。

AIはProposalを作成してよいが、Human Authorityが必要なDecision、Gate、Risk Acceptanceを自己承認してはならない。

<a id="33-system"></a>

## 3.3. システム（System）

定義済みRuleに従って観測、処理、保存、検証、通知等を行う実行主体。Systemの出力は、Rule、Environment、Versionを含むProvenanceを必要とする。

<a id="34-owner"></a>

## 3.4. 維持責任者（Owner）

Context、Artifact、Process、Index等を維持し、更新・Review・廃止・Escalationを管理する主体。Ownerと最終Authorityは同一でなくてよい。

<a id="35-authority"></a>

## 3.5. 決定権限（Authority）

特定Scopeについて、採用、承認、却下、Risk受容、正本変更を最終決定できる権限。

AuthorityはRole名だけでなく、対象Product、Property、Change、Release、期間によって定義する。

<a id="36-reviewer"></a>

## 3.6. 確認者（Reviewer）

ContextまたはArtifactが、Source、Contract、Quality、Boundary、Evidenceを満たすか確認し、Findingと推奨判断を返す主体。Reviewerは重要なRiskを自動受容しない。

Independent Reviewでは、作成者の結論や内部思考に依存しない。対象Scope、Revision、Source、適用Contract、Criteria、EvidenceからFindingを再構成する。

独立性は、必ず別人であることだけを意味しない。AIが作成・変換した成果物のPhase Transition Reviewは、次のいずれかが行う。

- 別のReview Subagent
- 作成時Contextを引き継がないClean Session / Agent
- 人間Reviewer

同じActive Context内のSelf Reviewで代替してはならない。ReviewerはReview Resultを返すが、Phase Gateは承認しない。

<a id="37-approver"></a>

## 3.7. 承認者（Approver）

特定のContext、Gate、Baseline、Release等を正式採用するHuman Authority。AIはApproverになれない。

<a id="38-agent-and-subagent"></a>

## 3.8. AgentとSubagent

Agentは、特定の目的、Authority、Input / Output Contractに従って作業するHuman、AI、System、または複合実行主体である。Skill、Plan、Task等を実行し、ContextやArtifactを生成・変換・検証する。

AgentのAuthorityはAgent ContractとHuman Authorityによって付与される。重要作業ではRole、Scope、Input、Output、Action Boundary、Stop / Escalation条件を明示し、自身の専門責務を越える重要Decisionを自己承認しない。

Subagentは、Parent AgentまたはOrchestratorから限定されたScope、Context、Action Authority、Output Contractを受けて作業するAgentである。

Subagentは独立したAuthorityを意味しない。詳細な委譲、Access、Result、統合、Promotion規定は[`10_Agent.md`](10_Agent.md)を参照し、CRDD Coreは特定のSubagent構成を要求しない。

---

<a id="4-lifecycle-and-status-terms"></a>

# 4. 流れと状態の用語（Lifecycle and Status Terms）

<a id="41-flow-and-lifecycle-boundaries"></a>

## 4.1. 流れと状態遷移の境界（Flow and Lifecycle Boundaries）

CRDDでは、意味の異なる流れをすべて`Lifecycle`と呼ばない。

| 正式な流れ | 意味 | 決定権限・正本 |
|---|---|---|
| End-to-End Transformation Flow | Realityから得たContextの意味変化と、DiscoveryからVerificationまでの専門工程による具体化・Learning還元を接続する流れ | [Principles](01_Principles.md)、本書のContext Type定義、各工程文書 |
| Change Trace | 一つの変更のTriggerから影響、実装、検証、Release帰属までの追跡 | [Change](12_Change.md) |
| Skill / Agent Run | 一回の専門活動または委譲実行の開始からHandoffまで | [Skill](11_Skill.md)、[Agent](10_Agent.md) |
| Workflow Execution | Repository固有の反復手順を一回実行し、結果をAuthorityへ返す流れ | [Workflow](14_Workflow.md) |
| Release Flow | Release ReadinessからHuman Release Decision、配布・有効化、Release Verificationまでの流れ | [Release](13_Release.md) |

<a id="42-status-terms"></a>

## 4.2. 状態用語（Status Terms）

StatusはContext Type、Artifact、Document、Gate、Releaseによって意味が異なる。以下はCanonicalな共通意味であり、詳細な遷移は各専門標準へ委譲する。

| 状態値（Status） | 正式な意味 |
|---|---|
| `Candidate` | 検討対象として識別されたが、まだDraftまたは採用対象として確定していない |
| `Draft` | 作成中であり、Authorityによる採用前 |
| `Open` | 対象の追跡または処置が開始され、まだ終了していない |
| `Not Started` | 対象Scopeの作業または検証をまだ開始していない |
| `Reviewed` | 指定されたReviewerが確認済み。採用または承認を意味しない |
| `Accepted` | 対象用途で使用することをHumanが認めた。Formal Approvalを必要としないContextにも使用する |
| `Approved` | 定義済みAuthorityが正式承認した |
| `Active` | 現在有効なContext、Baseline、Ruleとして使用されている |
| `In Progress` | 対象Scopeの作業または処置を実行中 |
| `Implemented` | 対応する実装が存在する。正しさや検証完了を意味しない |
| `Verified` | 対象Revisionが定義済みVerificationを満たした |
| `Released` | 特定Version / Environmentへ配布または有効化された |
| `Completed` | Run、Plan、Workflow等の定義済み終了条件を満たした。工程完了やReleaseを自動的に意味しない |
| `Closed` | 対象の結果、残課題、後続参照を処置し、追跡を終了した |
| `Rejected` | 検討または採用対象から明示的に除外された |
| `Deferred` | 今回は採用・実行せず、後続時点へ送られた |
| `Cancelled` | 採用または実行を完了せず、明示的に終了した |
| `Failed` | 実行を試みたが、定義済みResultまたはConditionを満たせなかった |
| `Superseded` | 後続Revisionまたは別Contextに置き換えられた。履歴は保持する |
| `Deprecated` | 使用を避けるべきだが、互換性等のため残っている |
| `Retired` | 現在および将来の利用対象から廃止された |
| `Recovered` | Legacy等から復元された候補で、由来とConfidenceの明示が必要 |
| `Blocked` | 外部判断、不足Context、Dependency等により進行できない |
| `Experimental` | 試験段階で、互換性や内容の安定を保証しない |
| `Stable` | 対象Scopeで基本構造が安定し、通常利用可能。将来変更されないことを意味しない |

以下を混同してはならない。

```text
Reviewed ≠ Approved
Implemented ≠ Verified
Verified ≠ Released
Completed ≠ Closed
Accepted ≠ Decision（Context TypeとStatusは別概念）
Stable ≠ Immutable
Recovered ≠ Confirmed
```

共通語だけでは対象を誤認する場合、Domainを付けて表す。

```text
Document Status
Context Status
Phase Coverage / Approval
Implementation Status
Verification Status / Result
Agent Result / Skill Run Status
Change Trace Status
Release Status / Decision
```

専門Statusは、次の文書を正本とする。

- `Not Verified`、`Partially Verified — Human Authorized`: [Verification](29_Verification.md)
- Release Readiness Recommendation: [Verification](29_Verification.md)
- 配布・有効化のRelease Decision / Status: [Release](13_Release.md)
- Agent ResultとSkill RunのStatus: [Agent](10_Agent.md)、[Skill](11_Skill.md)

これらの専門Statusを、本表の共通語へ無理に丸めない。

---

<a id="5-canonical-terms-and-boundary-language"></a>

# 5. 正式用語と境界表現（Canonical Terms and Boundary Language）

| 正式英語名 | 関連・廃止予定の表現 | 境界規則 |
|---|---|---|
| Observation | Fact / Finding | Observationは解釈前の記録。FindingはContractとの差異を評価した結果であり、同義語にしない |
| Evidence | Proof / Reference | EvidenceはSourceと取得条件を持つ根拠。Referenceだけ、または完全証明を意味しないProofと同一視しない |
| Interpretation | Analysis / Inference | 根拠に対する意味付けであることとConfidenceを明示する |
| Hypothesis | Assumption | Hypothesisは検証対象、Assumptionは作業上置いた前提。未検証である点が同じでも用途を区別する |
| Proposal | Idea / Solution Candidate / Recommendation | Statusが採用前である限りProposalへ統一する |
| Decision | Adopted Proposal / Approval | Human Authorityによる判断だけをDecisionと呼ぶ |
| Context Repository | Documentation Repository | Context、Trace、Decisionを扱う場合にDocumentationだけへ狭めない |
| Canonical Artifact | Draft / Copy / Index / View | 現在のAuthorityを持つArtifactだけをCanonicalと呼ぶ。参照用Viewは正本を置き換えない |
| Property Authority | Source of Truth | CRDDでは媒体全体よりProperty単位のAuthoritative Sourceと更新責任を明示する |
| Artifact Reference | Stable Context ID | Artifactの所在・Revisionを指すReferenceと、意味を追跡するStable Context IDを区別する |
| Stable Context ID | Document Number / File Name / `CHG-*` | Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`の意味識別子。文書やChange Traceの識別子ではない |
| Context Selection | Context Package | Context PackageはSelectionを受け渡す表現であり、別のContext Typeや正本ではない |
| Requirement | Need / Feature | NeedはSourceとなる必要、FeatureはProduct Scopeまたは実現単位、Requirementは満たすべき条件 |
| Behavior Specification | Behavior Requirement / Behavior Contract / Requirement | Canonical TermはBehavior Specification。Requirementや契約的役割と別Context Typeとして区別する |
| Plan | Roadmap Item / Workflow | Planは特定Scopeの実行計画、Roadmap Itemは採用済みDeferred Work、Workflowは反復可能な作業方法 |
| Implementation | Code / Delivery | CodeだけでなくConfiguration、Migration、Infrastructure、Developer Test、Build等を含むが、Releaseとは区別する |
| Verification Result | Test Result / Validation Result / Review Result / Result | 何をどのRevision・条件で検証したResultかを明示し、曖昧な`Result`を避ける |
| Learning | Summary | 要約されただけではLearningへ昇格しない |
| Change Trace | Change Record / Task / Pull Request | `CHG-*`は変更の意味と影響を追跡する。Task、PR、Git Log、CHANGELOGの代替ではない |
| Workflow | Plan / Skill | WorkflowはRepository固有の反復手順、Planは個別Scopeの計画、Skillは再利用可能な専門作業方法 |
| Release | Verification / Deployment | VerificationはReadinessを評価し、Deploymentは実行手段。ReleaseはHuman DecisionとDelivery Eventを含む |
| Phase Gate | Skill Completion / Artifact Completion | Gateは対象Scope / RevisionへのHuman Handoff Decisionであり、Run終了や成果物完成から自動推定しない |

新しいCore Termを導入する場合、使用前または同一Change内で本書へ定義・Alias・既存Termとの境界を追加しなければならない。

Core Context TypeごとのAuthorityと禁止事項は各定義を正本とする。CRDD適用Criteriaと評価方法は[Conformance Audit](52_Conformance_Audit.md)を参照し、本書に重複したChecklistを置かない。
