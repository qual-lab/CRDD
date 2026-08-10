# CRDD v2構想 — 能動的・自律的なCRDD

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Related: [責務境界](02_CRDD_v2_Responsibility_Boundary.md), [実証計画](03_CRDD_v2_PoC_Plan.md), [自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md), [Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md), [Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md)

> 本書は非規範の将来構想である。現在のCRDD v0.17.0、将来のv1.x、準拠基準、採用側の責務を変更しない。ここに記載した契約、成果物、状態、ツール、実行方式は、独立した変更・検証・人間判断を経るまでCRDD標準ではない。

---

## 1. 中心仮説

CRDD v1までの中心は、人間とAIが同じコンテキストリポジトリ（Context Repository）を参照し、思想、意図、根拠、判断を失わずに専門工程、実装、検証、学びまで接続することである。

v2では新しい専門工程や第一級成果物を大量に追加するのではなく、既存のコンテキスト、ロードマップ、判断、根拠、学び、エージェント、スキルをAI自身が継続的に利用し、必要な再評価、提案、許可された実行を開始できるかを検証する。

```text
v1
Reality → Human Trigger → AI → CRDD → Work → Result → Learning

v2候補
Reality / Time / Event / Condition
        ↓
      Trigger
        ↓
       AI
        ↓
      CRDD
        ↓
Re-evaluate / Propose / Authorized Action
        ↓
Result / Evidence / Learning
        └──────────────────────→ CRDD
```

技術的な中心原則は次のとおりである。

> `IF A THEN B`ではなく、`IF A THEN THINK`を扱う。

契機は結果や推論順序を固定しない。AIが考え始める理由、対象、権限、停止条件、期待結果を固定し、その時点のCRDDコンテキストから必要な探索と専門思考を形成させる。

### 1.1. 仕様は全体を定義し、運用は段階的に有効化する

v2候補では、将来の実行形態をPoCの大きさへ縮めない。Re-evaluation、Operation、Runtime境界、Execution Identity、安全制御、Authority、Tool境界、Operation Result、Learning、次回再評価までの全体契約を、相互に矛盾しない一つのArchitecture候補として先に定義する。

一方、定義されていることを自律実行の許可とみなさない。

> 仕様対象は全体を閉じ、権限とRuntime利用は段階的に有効化する。

初期Reference Implementationが読み取り専用の定期助言だけであっても、v2全体をそのProfileへ限定しない。逆に、将来の操作が契約上表現されていても、Activation Profileと人間判断が許可するまでは利用できない。

Activation Profileは品質契約、探索、検証、情報境界を省略する経路ではない。下位Profileは利用できる能力と権限を狭めるだけであり、Agentの自己申告によって上位Profileへ移行できない。

### 1.2. 3層Architecture

```text
Layer 1 — Semantic Contract
  Re-evaluation / Operation / Authority
  Expected Outcome / Learning

Layer 2 — Execution Contract
  Run Identity / Current State Resolution / Trigger Cause
  Duplicate and Recursion Protection / Timeout / Retry
  Execution Evidence / Result

Layer 3 — Runtime Adapter
  Coding Agent Automation / CLI / CI / MCP
  Dedicated Runtime / Future Adapter
```

Layer 1はCRDDが意味を所有する。Layer 2はCRDDとRuntimeの境界を定める。Layer 3はCRDD外の交換可能な実装である。Reference ImplementationはLayer 3の一例であり、Layer 1または2の正本にならない。

---

## 2. v0〜v1系列との分離

| ブランチ | 役割 | 変更の扱い |
|---|---|---|
| `codex/series/v0-v1` | v0.17.0以降からv1安定化までの系列 | 現行規範の改善、修正、実運用、v1昇格判断を扱う |
| `codex/feature/v2-trigger-driven-autonomous-context-operation` | v2構想と実証 | 将来候補、試作、評価結果を保持し、現行標準として公開しない |

v1.0.0への昇格は、v0〜v1系列の実運用が安定したと人間の決定権限者が判断した場合だけ行う。v2の進行を理由にv1昇格を早めない。

同期方向は次に固定する。

```text
mainの公開結果
      ↓
codex/series/v0-v1
      ↓ merge
codex/feature/v2-trigger-driven-autonomous-context-operation
```

- v0〜v1系列の変更は、公開結果または同期対象Commitをv2 featureへmergeする。
- merge履歴を残し、取り込んだ変更を再構成可能にする。
- v2固有の構想、試作、状態、用語をv0〜v1系列へ自動的に逆流させない。
- 競合時は共有する現行契約についてv0〜v1系列を基準とし、v2候補側を適応させる。
- 同期できない場合は、未同期範囲、理由、影響、再開条件をv2側で取得可能にする。

v2候補を現行系列へ採用するときは、branch mergeだけで採用とみなさない。独立した変更トレース、対象バージョン、移行、準拠影響、専門確認、人間判断を必要とする。

---

## 3. v1とv2の違い

| CRDD v1候補 | CRDD v2候補 |
|---|---|
| 人間が主な開始契機を持つ | 人間、時間、イベント、状態が開始契機になり得る |
| AIが必要時にコンテキストを読む | AIが契機に応じてコンテキストを再評価する |
| 人間が工程を開始する | AIも工程の再開を提案または許可範囲で開始できる |
| ロードマップと学びを保持する | ロードマップと学びが次の再評価へ接続する |
| エージェントが専門支援する | 責務と権限を持つエージェント構成を検証する |
| 人間の決定権限を中心に守る | 人間の決定権限を維持し、実績に基づく統制済み自律性を検証する |
| 要求起点 | 能動的な再評価候補 |
| 生きたコンテキストリポジトリ | 継続的に再解釈されるコンテキストリポジトリ |

v2は、人間を排除する構想ではない。AIが状況収集、差分把握、再評価候補、根拠整理を担い、人間が価値、方向、優先順位、重要判断、リスク受容へ集中できる状態を目指す。

---

## 4. 5本柱

### 4.1. 再評価・契機契約

CRDDが「いつ、なぜ、何をもう一度考える必要があるか」を表現し、Runtimeがその条件を検知してAIを起動できるようにする。

### 4.2. Operation Contract

目的、対象、期待結果、Authority、停止条件、次の再評価への接続を持ち、固定WorkflowではなくGoal Contractとして継続業務を表現する。

### 4.3. EffectとAuthorityの安全性

Context Access、Effect Boundary、Candidate／Canonical分離、Prepare／Verify／Promote、Runtime Enforcementを接続する。初期は既存のHuman Authorityを維持し、限定操作の自律化は別の根拠と人間判断を必要とする。

### 4.4. BackgroundとHuman Decisionの分離

Runtimeが解決できる影響なし、重複、Policy内処理、拒否を人間へ逐次通知せず、Direction、Canonical Change、External Effect、Residual Risk、Policy Ambiguity等だけをDecision Queueへ送る。

### 4.5. Operation Healthと適応

自律Operation自身の判断価値、見逃し、ノイズ、費用、人間確認負荷を品質対象とし、頻度低下、契機変更、Pause、再設計、廃止まで扱う。

> 自律Operationは、人間の判断負荷を増やすだけなら成功ではない。

Agent OrganizationとContinuous Learningは、この5本柱を支える横断能力として扱う。Agent数や実行回数を自律性の価値とみなさず、学びを自動的に原則化しない。

Forward Compatibilityも5本柱を置き換える新しい柱ではなく、横断する設計制約として扱う。v2で将来Capabilityを先行実装せず、Repository Identity、Context Reference、Provenance、Authorityの意味を現在の物理Locationまたは実行主体へ固定しない。表現できることを、有効化、アクセス、許可またはCurrent Stateへの反映とみなさない。詳細は[Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md)に置く。

---

## 5. 再評価契約

単純なTrigger Contractより、再評価契約（Re-evaluation Contract）として捉える。

> 何が起きたら、なぜ、どのコンテキストをもう一度考える必要があるか。

所有境界は次のとおりである。

```text
Re-evaluation Contract
  Why / When / What should be reconsidered
  → operation_ref

Operation Contract
  What capability is invoked after reconsideration starts
  → Goal / Context / Expected Outcome / Authority / Stop
```

Re-evaluation Contractは、起動後のGoal、期待結果またはAuthorityを複製しない。同じOperationをSchedule、Event、Condition等の複数契機から参照できるようにする。

```yaml
reevaluation:
  target: product_direction
  reason: current assumptions may no longer hold
  conditions:
    - meaningful_environment_change
    - new_user_evidence
    - review_interval_reached
  operation_ref: product-direction-review
```

これは固定Schemaではない。少なくとも、再評価理由、対象、条件、参照するOperationを取得可能にする方向を比較する。Operation側がGoal、期待結果、Authority、停止、根拠、記録先を所有する。

イベント自体を固定Actionへ直結しない。例えばPull Requestの統合後は、まず意味変化を評価し、影響がなければ終了し、意味が変わった場合だけ適切な再評価へ接続する。

---

## 6. Living Repository

v1までのリポジトリは、人間とAIが参照する生きたコンテキストリポジトリである。v2候補ではさらに、時間、イベント、状態変化を契機に再解釈され、現実とのずれを発見し、次の思考を開始できる状態を検証する。

Repository自身が常駐Processを持つ必要はない。

```text
Repository
   ↓
Trigger
   ↓
AIが現在状態を再評価
   ↓
Proposal / Authorized Action
   ↓
Evidence / Learning
   └────────────────→ Repository
```

一般的な知識ベースとの違いは、情報検索だけでなく、意味変化の検出、再評価、根拠付き提案、学びへの循環までを契約対象にする点にある。

---

## 7. 新設しないもの

v0.17.0時点のCRDDには、Observation、Evidence、Interpretation、Hypothesis、Discovery、Decision、Roadmap、Re-evaluation Trigger、Learning等がすでに存在する。

そのため、現時点では次を新しい第一級成果物として追加しない。

- Opportunity専用正本
- Evidence Modelの重複正本
- Decision Historyの重複正本
- RoadmapまたはLearningの代替物
- Expert Agent専用の新工程
- 既存Independent ReviewやSecurity Boundaryの代替物
- 固定Workflow、固定Runtime、固定MCP、固定Provider

必要なのは新しい名前ではなく、既存概念をAI自身が能動的に利用し、再評価できることかを実証することである。

---

## 8. CRDD自身の改善候補

Productだけでなく、CRDD運用も観察対象にできる。

```text
複数Changeの手戻りを分析
   ↓
同じ工程間Findingが反復
   ↓
単発ミスか契約不足かを探索
   ↓
CRDD改善候補を提示
```

AIがCRDD Coreを自己変更することとは分離する。Core変更は、現行のAuthority、Change、Review、Audit、Releaseを通る別変更である。

---

## 9. 設計原則

1. 仕事は定型化しても、思考は定型化しない。
2. 契機は結果を決めず、考え始める理由を与える。
3. CRDDは「なぜ・何を」、Runtimeは「いつ・どう起動するか」を持つ。
4. 接続可能であることをAuthorityとみなさない。
5. AIの自律性は、コンテキストとGovernanceがある範囲でだけ成立する。
6. 何も変える必要がないことも正しい結果として扱う。
7. CRDD自身を巨大なRuntime、Scheduler、Queue、Worker、MCP Serverへ変えない。
8. 特定のAI製品、Protocol、Provider、課金方式へ固定しない。
9. 外部情報境界、最小権限、Human Gate、検証、回復を自律性より先に守る。
10. Capabilityが存在することを、利用権限、情報送信権限、Operation Authorityとみなさない。
11. Execution IdentityとCurrent Stateを確定できないOperationを、現在状態への有効な実行として扱わない。

安全性の中心原則は次のとおりである。

> 自律性は思考と候補形成に広く与え、実行効果の確定はPolicyとRuntimeで統制する。

短く表す場合は、`Think broadly. Effect narrowly.`とする。ただし、思考に利用できるコンテキストもAuthorityと外部情報境界の内側に限られる。詳細は[自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md)に置く。

---

## 10. 到達像

v2が目指すのは、AIへ毎回仕事を依頼する状態から、AIが重要な変化を見つけ、許可範囲で分析と検証を進め、人間には重要な判断だけを根拠とともに求める状態への移行である。

```text
昨日から複数の変化を検出
  ├─ 影響なし：根拠付きで終了
  ├─ 許可範囲内：分析・検証済み
  └─ Directionへ影響：人間判断を要求
```

v1は「AIとプロダクトを作る」ための安定した土台を目指す。v2候補は、その土台の上で「AIとプロダクトを継続的に育てる」運用を検証する。

実証の詳細は[CRDD v2実証計画](03_CRDD_v2_PoC_Plan.md)に置く。
