# CRDD Conformance

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_15_Document.md](00_15_Document.md)

---

# Purpose

本ドキュメントは、プロジェクト、プロダクト、または組織的な開発活動が「CRDDを実践している」と表明するための準拠条件を定義する。

CRDDへの準拠は、特定のフォルダ構成、特定のAI、特定のAgent構成、特定の開発ツールを導入したことだけでは成立しない。

CRDDへの準拠は、以下が実際の活動として成立していることによって判断する。

```text
人間の思いと原点が残されている
重要な判断と理由を遡れる
Contextが構造化され、時間を越えて再利用できる
AIを利用する場合も、価値判断と最終責任を人間が保持する
下流成果物が上流の意図から切断されない
結果と学びがContext Repositoryへ戻される
```

---

# 1. Conformance Model

CRDDは、成熟度を単純なLevelで表す方式を採用しない。

プロジェクト規模、開発対象、AI利用範囲、実装の有無によって必要なPracticeが異なるため、以下の **Core + Profile方式** を採用する。

```text
CRDD Core
すべてのCRDD実践で必須となる不変条件

Product Lifecycle Profile
思い・課題からUX / IA / UI / SPEC / Architecture / Implementationまでを
一気通貫で接続するプロダクト開発向け追加条件

Agentic Delivery Profile
AI Agentによる設計・実装・テスト・Reviewを行う場合の追加条件
```

Profileは、CRDD Coreを満たした上で追加適用する。
Profileだけを満たし、CRDD Coreを満たしていない状態はCRDD準拠とはみなさない。

---

# 2. Normative Keywords

本書では、規範強度を以下の語で表す。

| Keyword | 日本語 | Meaning |
|---|---|---|
| `MUST` | 必須 | 満たさない場合、その対象への準拠を表明できない |
| `MUST NOT` | 禁止 | 行った場合、その対象への準拠を表明できない |
| `SHOULD` | 推奨 | 原則として行う。逸脱する場合は理由を残す |
| `SHOULD NOT` | 非推奨 | 原則として避ける。採用する場合は理由を残す |
| `MAY` | 任意 | 対象や状況に応じて選択できる |

既存のCRDD文書で規範強度が明示されていない場合、本書および各文書のMinimum Ruleを優先して解釈する。

---

# 3. CRDD Core Conformance

CRDDを名乗るすべての活動は、以下を満たさなければならない。

## C-01. Origin and Intent

プロダクトまたは活動の原点として、少なくとも以下をContext Repositoryへ残さなければならない。

```text
なぜ始めたのか
誰の何を変えたいのか
何を大切にするのか
何を犠牲にしてはいけないのか
```

コード、チケット、現在の仕様だけを起点としてはならない。

## C-02. Structured and Versioned Context Repository

Why、判断、設計、仕様、結果を、人間とAIが再参照できる構造化されたRepositoryで管理しなければならない。

Repositoryは、変更履歴、版、または時点を遡れる仕組みを持たなければならない。

Gitは標準的な実装手段として推奨するが、以下を満たす別方式を利用してもよい。

```text
変更履歴を遡れる
正本と状態を識別できる
関連情報を接続できる
人間とAIが読み取れる
```

## C-03. Information Provenance

観察事実、外部Evidence、人間の解釈、AIの推定、仮説、決定事項を区別しなければならない。

出典不明の情報やAI生成物を、人間確認なしに確定事実として扱ってはならない。

## C-04. Traceable Decisions

重要な価値判断、方針変更、採用・却下、優先順位変更について、少なくとも以下を遡れるようにしなければならない。

```text
何を決めたか
なぜ決めたか
誰が承認したか
どのContextとEvidenceを根拠にしたか
何へ影響するか
```

すべての会話をDecision Recordへする必要はない。
後から同じ論点を再判断する可能性があるものを対象とする。

## C-05. Human Decision Authority

意味づけ、価値判断、優先順位、重要な方針、承認、最終責任は人間が保持しなければならない。

AIは提案、比較、整理、草案、実装を行ってよいが、人間の承認なしに以下を確定してはならない。

```text
Origin / Intent
Product Principle
重要なUX方針
重要なDecision
Roadmap上の優先順位
重大なRisk受容
```

AIを利用しない場合でもCRDD Coreは成立する。
AIを利用する場合は、`00_13_Human_AI_Responsibility.md`および`00_14_AI_Change_Control.md`を適用しなければならない。

## C-06. Controlled Change

重要なContextを変更する場合、変更内容、変更理由、影響範囲、承認状態を確認できなければならない。

新しい情報によって過去のContextが変わった場合、過去を無言で書き換えるのではなく、変更または置換の経緯を残さなければならない。

## C-07. Readable Context

Context Repositoryは、単なるファイル保管庫ではなく、人間とAIが判断へ利用できる状態でなければならない。

少なくとも以下を避けなければならない。

```text
結論だけで理由がない
文書の状態や正本性が分からない
長大な生ログだけが残っている
関連Contextへ遡れない
AI生成物か承認済み情報か区別できない
```

## C-08. Implementation Replaceability

現在の技術、Architecture、インフラ、AI、Framework、コードを、製品の原点そのものとして扱ってはならない。

実装は、当時の環境と制約に対する選択肢の一つとして記録しなければならない。

環境が変わった場合、OriginとIntentへ戻り、別の実現手段を再評価できなければならない。

## C-09. Context Feedback

検証、利用、失敗、運用、専門家Reviewから得た重要な学びを、必要に応じてContext Repositoryへ戻さなければならない。

コードまたはタスクだけを更新し、上流Contextとの不整合を放置してはならない。

## C-10. Conformance Evidence

CRDD準拠を表明する場合、本書の各必須条件をどこで確認できるかを示せなければならない。

専用の監査文書は任意だが、少なくともRepository内の文書、履歴、Decision、Evidenceによって説明可能でなければならない。

---

# 4. Product Lifecycle Profile

思い、課題、UX、IA、UI、SPEC、Architecture、Implementationを一気通貫で扱う活動は、CRDD Coreに加えて本Profileを適用する。

## PL-01. End-to-End Context Continuity

OriginからVerificationまで、対象に必要な専門層が意味を失わず接続されていなければならない。

```text
Origin / Intent
↓
Problem / Evidence
↓
UX
↓
IA
↓
UI ⇄ SPEC
↓
Architecture
↓
Implementation
↓
Verification / Learning
```

すべての層を必ず独立文書として作成する必要はない。
ただし、省略・統合した層がある場合も、その層で本来判断すべき内容が失われてはならない。

## PL-02. Transformation Contract

各主要な専門層は、必要に応じて以下を示さなければならない。

```text
Source Context
何を根拠に作られたか

Preserved Intent
下流でも守るべき意図

Transformation Decision
この層で具体化・判断したこと

Open Questions
未確定事項

Downstream Obligation
次の層が満たすべき条件

Verification
成立確認の方法
```

形式は自由とするが、前後の層が何を受け取り、何を渡したかを説明できなければならない。

## PL-03. Semantic Traceability

文書またはArtifact間の関係は、単なる関連リンクに留めず、可能な限り関係の意味を識別できなければならない。

代表的な関係は以下とする。

```text
derived_from
realizes
constrains
depends_on
supersedes
implemented_by
verified_by
paired_with
```

ツール上でこれらの語を直接使用することは必須ではない。
人間とAIが関係の意味を同等に説明できればよい。

## PL-04. UX / IA / UI / SPEC Continuity

UX、IA、UI、SPECを、独立して作成された無関係な成果物として扱ってはならない。

少なくとも以下を説明できなければならない。

```text
UX上の期待する変化が、どのIA構造へ反映されたか
IA上の責務が、どのUIまたは機能へ反映されたか
UI上の操作とFeedbackが、どのSPECへ対応するか
SPECの状態と例外が、UIでどのように表現されるか
```

## PL-05. UI and SPEC Paired Contract

ユーザーインターフェースを持つ対象では、UI ContractとBehavior Contractを対として確認しなければならない。

```text
UI Contract
何が見え、何を操作でき、どのFeedbackを受けるか

Behavior Contract
どの条件で、どの状態から、何が起き、何が返るか
```

Loading、Empty、Error、Permission、Disabled、Confirmation等の主要状態に矛盾を残したままImplementationへ進めてはならない。

## PL-06. Human Gate

上流Contextを次の専門層へ確定的に変換する重要な境界では、人間が内容を確認し、採用、差戻し、保留のいずれかを判断しなければならない。

すべての小変更に形式的な承認会議を要求するものではない。
価値、Scope、体験、責務、振る舞い、重大な技術制約が変わる境界を対象とする。

## PL-07. Verification against Intent

完了判定は、コードが動作することだけで終えてはならない。

少なくとも以下を確認しなければならない。

```text
SPECとAcceptance Criteriaを満たしたか
UIとBehaviorが一致したか
UX上の期待する変化を損なっていないか
OriginとProduct Principleへ反していないか
新しい学びや前提変更が発生したか
```

---

# 5. Agentic Delivery Profile

AI Agentが設計、実装、テスト、Review、修正を主体的に行う活動は、CRDD Coreに加えて本Profileを適用する。

Product Lifecycle全体を扱う場合は、Product Lifecycle Profileも併用する。

## AD-01. Context Before Action

AI Agentは、作業開始前に対象Scope、関連Context、重要Decision、実装規約、制約を確認しなければならない。

Repository全体を毎回無制限に読む必要はないが、判断に必要なContextを特定する手順を持たなければならない。

## AD-02. Plan and Boundary

AI Agentは、重大または複数工程にまたがる変更を行う前に、Plan、対象範囲、非対象範囲、依存関係、確認方法を提示しなければならない。

承認されたScopeを越えて、関連しそうという理由だけで広範囲を変更してはならない。

## AD-03. Small and Recoverable Execution

AIによる変更は、差分をReviewでき、中断・再開・切戻しができる単位へ分割しなければならない。

大規模な変更を一度に行う必要がある場合は、その理由と検証方法を明示しなければならない。

## AD-04. Independent Review

重要な変更では、生成または実装を行ったContextとは分離したReviewを行わなければならない。

別Agent、別Session、人間Reviewerのいずれでもよい。
同じ推論を繰り返すだけでは独立Reviewとみなさない。

## AD-05. Fresh Evidence

AI Agentは、推測や過去の成功だけを根拠に完了を宣言してはならない。

変更後に取得したTest、Build、静的検査、実行結果、Visual確認等のFresh Evidenceを示さなければならない。

## AD-06. Context Update

実装によって仕様、制約、既知の制限、運用、重要な学びが変わった場合、コードだけでなく関連Contextも更新しなければならない。

AIが上流文書を直接確定変更できない場合は、更新候補またはDecision候補として人間へ提示しなければならない。

## AD-07. Tool Independence

特定のAgent、LLM、IDE、SDD Tool、Subagent構成を利用することは必須ではない。

Claude Code、Codex、cc-sdd、その他のToolは、CRDD Contextを受け取って実行する交換可能なDelivery Engineとして扱う。

---

# 6. Conformance Claims

準拠を表明する場合、以下の名称を使用する。

| Claim | Meaning |
|---|---|
| `CRDD Core Conformant` | CRDD Coreの全MUST条件を満たす |
| `CRDD Product Lifecycle Profile Conformant` | Coreに加え、Product Lifecycle Profileの全MUST条件を満たす |
| `CRDD Agentic Delivery Profile Conformant` | Coreに加え、Agentic Delivery Profileの全MUST条件を満たす |
| `CRDD Product Lifecycle + Agentic Delivery Conformant` | Coreと両Profileの全MUST条件を満たす |
| `CRDD-Inspired` | CRDDの一部を参考にしているが、Coreの全条件は満たさない |

`CRDD-Inspired`は否定的な評価ではない。
部分導入、試行、移行期間ではこの表現を使用する。

「CRDD準拠」とだけ表明する場合は、少なくとも`CRDD Core Conformant`でなければならない。

---

# 7. What Is Not Required

以下はCRDD Coreの必須条件ではない。

```text
GitHubを使用すること
特定のフォルダ番号を完全に採用すること
すべてをMarkdownだけで管理すること
AIを利用すること
Subagent構成を採用すること
特定のLLMやAgentを利用すること
すべてのUX / IA / UI / SPEC文書を独立ファイルとして作ること
すべての小さな判断をDecision Recordへすること
すべての変更に形式的な承認会議を設けること
```

ただし、代替方式で各MUST条件を満たしていることを説明できなければならない。

---

# 8. Non-conformant States

以下の状態では、CRDD準拠を表明できない。

```text
コードやチケットだけがあり、なぜ作るかが残っていない
AI生成物を人間の判断なしに正本としている
重要な方針変更の理由を遡れない
Repositoryが単なる資料置き場で、正本や状態を識別できない
現在の実装を製品思想そのものとして扱っている
成果物が更新されても、関連Contextとの不整合を放置している
Product Lifecycle Profileを名乗りながら、UX / IA / UI / SPECの接続を説明できない
Agentic Delivery Profileを名乗りながら、検証EvidenceなしにAIが完了を宣言している
```

---

# 9. Conformance Review

準拠状態は固定的な認定ではない。
Repository、開発方法、組織運用が変わった場合は再確認する。

少なくとも以下のタイミングでReviewすることを推奨する。

```text
CRDD導入時
重要な開発Phaseの開始時
Repository構造の大幅変更時
AI AgentまたはDelivery方式の変更時
重大な事故・手戻り・思想との不整合が発生した時
主要Releaseの完了時
```

Review結果は、適合、部分適合、未適合、要改善、および根拠を記録することを推奨する。

---

# 10. Minimum Rule

```text
CRDDを名乗る場合、CRDD Coreの全MUST条件を満たす
用途に応じてProduct Lifecycle ProfileまたはAgentic Delivery Profileを追加適用する
Profileだけを満たしても、CRDD Core未準拠ならCRDD準拠とは表明しない
特定のTool、AI、フォルダ構成の採用だけを準拠根拠にしない
準拠を表明する場合、各必須条件のEvidenceを説明可能にする
```
