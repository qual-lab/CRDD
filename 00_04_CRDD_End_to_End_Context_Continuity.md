# CRDD End-to-End Context Continuity

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

# Purpose

本ドキュメントは、CRDDが目指す「一気通貫」の意味と、上流の思いをUX・IA・UI・SPEC・Architecture・Implementation・Verificationへ接続するための基本思想を定義する。

CRDDが守るべきものは、現在のコードや特定の技術構成だけではない。

CRDDが最も長く守るべきものは、以下である。

```text
なぜ作るのか
誰の何を変えたいのか
どんな思いから始まったのか
何を大切にするのか
何を犠牲にしてはいけないのか
なぜその判断をしたのか
```

インフラ、AI、言語、Framework、組織、利用環境が変われば、実装は変わる。
しかし、製品を生んだ原点と、その時々の人間の判断は、未来へ受け継がれなければならない。

---

# 1. CRDDは実装手法だけではない

実装は、目的を実現するために選択された手段の一つである。

```text
Origin / Intent
なぜ作るのか、どんな思いか
        ↓
Problem / Evidence
誰の何を、どんな根拠で解決するのか
        ↓
UX
利用者をどのような状態へ変えるのか
        ↓
IA
情報・概念・行動をどのように構造化するのか
        ↓
UI ⇄ SPEC
何を見せ、どう操作させ、システムがどう振る舞うのか
        ↓
Architecture
現在の制約と環境で、どう成立させるのか
        ↓
Implementation
今回、どの技術と方法で具体化したのか
        ↓
Verification / Learning
原点と期待した価値を、本当に実現できたのか
```

下へ進むほど具体的になり、技術や環境の影響を受けやすくなる。
上へ戻るほど長期的であり、製品の存在理由に近づく。

CRDDは、現在の実装を永続的な正解として保存する手法ではない。

CRDDは、環境が変わったときに原点へ戻り、現在に最適な選択をやり直せる状態を保存する手法である。

---

# 2. CRDDにおける一気通貫

従来の「一気通貫」は、一人または一組織が、企画から実装までをすべて担当することを意味しがちである。

CRDDにおける一気通貫は、担当者や専門職を一人へ集約することではない。

CRDDにおける一気通貫とは、以下が意味を失わず接続されている状態である。

```text
思い
↓
課題
↓
体験
↓
情報構造
↓
表現と操作
↓
振る舞い
↓
技術設計
↓
実装
↓
検証結果
↓
新しい学びと判断
```

途中で担当者が変わってもよい。
AIが変わってもよい。
技術が変わってもよい。
組織や開発体制が変わってもよい。

それでも、下流成果物から上流の意図へ遡ることができ、上流の変更から下流への影響をたどることができなければならない。

これを、CRDDにおける **End-to-End Context Continuity** と呼ぶ。

---

# 3. CRDDは「作りたい人」を「作れる人」へ変える

CRDDは、エンジニアだけのための開発環境ではない。

現場の課題を知る人、顧客の声を聞いた人、新しい体験を考えた人、事業のアイディアを持つ人は、必ずしもコードを書けるとは限らない。

しかし、AI時代において、ものづくりの起点に最も必要なのはプログラミング能力だけではない。

必要なのは、以下である。

```text
課題に気づくこと
なぜ変えたいのかを語ること
実現したい価値を考えること
提案された選択肢を評価すること
何を採用し、何を捨てるか判断すること
結果を見て、次の方向を決めること
```

CRDDは、人間が持つこれらのContextをRepositoryへ蓄積し、AIが専門工程への変換を支援することで、エンジニアではない人でも、アイディアを具体的な製品へ近づけられるようにする。

```text
作りたいと思う人
↓
課題と思いを言葉にする
↓
AIが不足を問い、構造化する
↓
UX / IA / UI / SPECへ変換する
↓
人間が提案を判断・承認する
↓
AIまたは専門家が実装する
↓
利用結果から学び、Contextへ戻す
```

CRDDの目標は、誰もが専門知識なしに無責任な製品を作ることではない。

CRDDの目標は、専門家しか扱えなかった知識を、人間とAIが協働できる構造へ変換し、専門家が必要となる地点まで、より多くの人が高品質なContextを持って到達できるようにすることである。

---

# 4. 専門分野を「分断」ではなく「変換層」として扱う

UX、IA、UI、SPEC、Architectureは、それぞれ独立した専門分野である。

CRDDは、その専門性を軽視しない。
一方で、専門分野がブラックボックスとなり、前工程の意図が後工程で失われる状態も許容しない。

各専門領域は、上流Contextを次の形へ具体化する **Transformation Layer** として扱う。

| Layer | 主な問い | 次工程へ渡すもの |
|---|---|---|
| Origin / Strategy | なぜ作るのか、何を守るのか | 原点、価値、原則、Non-goal |
| UX | 誰をどの状態へ変えるのか | Desired Outcome、体験原則、成功条件 |
| IA | 何を、どの構造で理解・操作させるのか | Object Model、責務、Navigation、情報階層 |
| UI | 何を見せ、どう認識・操作させるのか | 表示、操作、Feedback、画面状態 |
| SPEC | どの条件で、システムはどう振る舞うのか | Behavior、State、Input、Output、Acceptance Criteria |
| Architecture | 現在の制約で、どう成立させるのか | 技術境界、Data、API、Security、非機能 |
| Implementation | 今回どのように具体化したのか | Code、Configuration、Build、Test |
| Verification | 原点と要求を満たしたか | Evidence、学び、次のDecision |

各層は、単に成果物を作るだけでは不十分である。

各層は、最低限以下を明示する。

```text
Source Context
何を根拠に作られたか

Preserved Intent
下流でも失ってはいけない意図は何か

Transformation Decision
この層で何を具体化し、何を判断したか

Open Questions
何がまだ分かっていないか

Downstream Obligation
次の層が満たさなければならない条件は何か

Verification
何によって成立を確認するか
```

---

# 5. 専門知識を質問・テンプレート・判断基準へ変換する

CRDDでテンプレート化するのは、文書の見出しだけではない。

専門家が暗黙的に行っていた以下を、AIと非専門家が利用できる形へ変換する。

```text
最初に確認すべき質問
必要なInput
考慮すべき選択肢
判断基準
よくある失敗
成果物の最低条件
次工程へ進める条件
専門家Reviewが必要な条件
```

たとえば、非専門家へ「UX文書を書いてください」と依頼しても、十分なContextは得られない。

AIは、次のように問いながらContextを抽出する。

```text
誰が一番困っていますか
どんな場面で困りますか
現在はどう対処していますか
何に時間、不安、損失が生じていますか
利用後、何ができるようになれば成功ですか
絶対に犠牲にしたくないことは何ですか
```

その回答を、UXの専門構造へ変換する。

```text
Problem
Pain
JTBD
Desired Outcome
Experience Principle
Non-goal
Risk
Confidence
```

IA、UI、SPECについても同様に、専門家の思考手順を質問型SkillとReview Ruleへ変換する。

テンプレートは専門家を不要にするものではない。

テンプレートは、専門家の価値を単純作業や形式作成から解放し、重要な判断、例外、品質、成立性のReviewへ集中させるためのものである。

---

# 6. UIとSPECは対になる契約である

UIとSPECは、完全な直列工程ではない。

UIを設計することで、Loading、Empty、Error、Disabled、Confirmation、Undo、Permission、状態遷移などの仕様が発見される。

SPECを設計することで、利用者へ見せるべき状態、操作制約、Feedbackが発見される。

そのため、CRDDではUIとSPECを、次の対になるContractとして扱う。

```text
UI Contract
利用者に何が見え、何を操作でき、どのようなFeedbackを受けるか

Behavior Specification
どの条件で、どの状態から、何が起き、何が返されるか
```

UIとSPECは相互に検証され、矛盾が残ったままArchitectureとImplementationへ進めない。

---

# 7. Traceabilityはリンクではなく意味を持つ

CRDDでは、文書同士がリンクされているだけでは不十分である。

リンクが何を意味するのかを明示する。

```text
derived_from   上流Contextから派生した
realizes       上流の意図を実現する
constrains     下流の選択を制約する
depends_on     成立のために依存する
supersedes     過去の判断や仕様を置き換える
implemented_by 実装によって具体化される
verified_by    TestやEvidenceによって検証される
```

例:

```text
Origin
「重要な相談を見逃してほしくない」
    ↓ realizes

UX
「確認すべき情報が自然に集まり、判断へ集中できる」
    ↓ realizes

IA
「重要事項、判断待ち、Risk、Evidenceを一つのTopicとして扱う」
    ↓ realizes

UI
「Topic Cardで重要度、根拠、次Actionを表示する」
    ⇄ paired_with

SPEC
「重要度条件を満たすTopicを優先順で返す」
    ↓ implemented_by

Architecture / Code / Test
```

人間へID管理の負担を押し付けない。
IDと関係はAIが補助し、人間には意味のつながりと影響範囲が理解できる形で提示する。

---

# 8. 実装方式とDelivery Engineは交換可能である

CRDDが作るべきものは、特定のAI Agentや実装Toolだけが読める仕様ではない。

CRDDは、承認済みのProduct Contextと各専門層のContractを、複数のDelivery Engineへ渡せるようにする。

```text
CRDD Context Repository
├─ Origin / Why / Decision
├─ UX Contract
├─ IA Model
├─ UI Contract
├─ Behavior Specification
├─ Architecture Constraints
└─ Verification Criteria
        ↓
Delivery Adapter
├─ cc-sdd
├─ Claude Code
├─ Codex
├─ OpenSpec
├─ GitHub Spec Kit
└─ Human Development Team
```

cc-sddのような仕組みは、Requirements、Design、Tasks、Implementation、Reviewを強く実行する下流Delivery Engineとして活用できる。

しかし、Delivery Engineが変わっても、CRDDが保持するOrigin、思想、体験価値、判断履歴は変わらない。

CRDDは、特定の実装手段を正解として固定するのではなく、その時代、その環境、その制約に適した実装手段を選び直せる状態を守る。

---

# 9. AIと人間と専門家の役割

CRDDにおけるAIは、単なるコード生成器ではない。

AIは、上流から下流までのContextを読み、以下を支援する。

```text
思いと課題の抽出
不足質問
専門構造への変換
複数案の提示
矛盾と抜けの検出
影響範囲の提示
仕様化
実装
検証
過去判断の再発見
学びのContext化
```

人間は、以下を担う。

```text
原点を語る
意味を与える
価値を判断する
優先順位を決める
何を守り、何を捨てるか決める
提案を承認または拒否する
結果を見て次の方向を決める
```

専門家は、以下を担う。

```text
難しい例外を見抜く
成立性と品質を評価する
専門領域の判断基準を改善する
TemplateやSkillへ知識を還元する
重大なRiskに責任を持つ
```

CRDDは、人間、AI、専門家のいずれか一つだけでも成立しない。

それぞれの強みを、Context Repositoryを介して接続する。

---

# 10. CRDDが守る不変条件

CRDDを発展させても、以下は変えない。

## 10.1 Origin Permanence

製品を作る理由、解決したい問題、守りたい価値は、実装から独立して保存する。

## 10.2 Layer Continuity

UX、IA、UI、SPEC、Architecture、Implementationは、独立した文書群ではなく、上流Contextを段階的に具体化する連続した構造として管理する。

## 10.3 Explicit Transformation

各層で、何を根拠に、何を守り、何を判断し、何を次へ渡したかを明示する。

## 10.4 Specialized Knowledge as Shared Structure

専門知識を個人の暗黙知へ閉じず、質問、Template、判断基準、Review Rule、Gateとして共有する。

## 10.5 Human Decision Authority

AIは抽出、提案、変換、検証を支援するが、価値判断と最終承認は人間が担う。

## 10.6 Implementation Replaceability

技術、インフラ、設計、コードは変更可能な選択肢として扱い、製品の原点や体験価値と同一視しない。

## 10.7 Bidirectional Traceability

上流から下流への理由と義務を追えるだけでなく、下流成果物から上流の意図へ遡れる状態を維持する。

## 10.8 Feedback to Context

実装と利用から得た学びは、コードの中だけに閉じず、Decision、UX、IA、SPEC、Roadmapへ還元する。

---

# 11. CRDDが守る判断領域

CRDDは、AIやToolによる実装支援が増えても、人間が担う判断領域を失わせない。

```text
市場を理解する
まだ言葉になっていない課題を見つける
新しい可能性を考える
何を作るべきか決める
何を作らないか決める
重要な判断に責任を持つ
```

しかし、人間が生み出した思いや判断が、専門工程の分断や担当者変更の中で失われれば、AIがどれだけ高速に実装しても、意味のある製品にはならない。

CRDDは、人間のアイディアと判断を劣化させず、専門領域を越えて製品へ変換し、未来の人間とAIへ継承する。

CRDDが目指すのは、単に開発を速くすることではない。

CRDDが目指すのは、作りたいものを持つ人が、その思いを失うことなく、実際に作れる世界である。

---

# 12. CRDDの宣言

```text
コードは作り直せる。
技術は置き換えられる。
インフラは変えられる。

しかし、失われた原点と判断は、後から完全には取り戻せない。

だから私たちは、
作業をAIへ渡し、
判断を人間へ残し、
思想をContext Repositoryへ刻む。

思いを課題へ。
課題を体験へ。
体験を構造へ。
構造を表現と仕様へ。
仕様を実装へ。
実装から得た学びを、再び思想へ。

CRDDは、アイディアをコードへ変換するだけの手法ではない。

CRDDは、人間の思いを、
UX・IA・UI・SPEC・Architecture・Implementationへ
意味を失わず一気通貫で変換し、
未来へ受け継ぐための方法論である。

CRDDは、作りたい人を、作れる人へ変える。
```

---

# Minimum Rule

CRDDを実践するプロジェクトは、最低限以下を満たす。

```text
なぜ作るのかを、現在の実装から独立して説明できる
重要な下流成果物から、上流の意図と判断へ遡れる
上流Contextの変更から、影響する下流成果物を確認できる
UX / IA / UI / SPEC / Architectureの責務を区別する
各専門層が何を受け取り、何を次へ渡すかを説明できる
実装方式を、目的そのものではなく交換可能な選択肢として扱う
実装・検証で得た学びをContext Repositoryへ還元する
価値判断と最終承認を人間が担う
```
