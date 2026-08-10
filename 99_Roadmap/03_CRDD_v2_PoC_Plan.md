# CRDD v2候補 — 実証計画

Status: Concept / PoC Candidate  
Target: CRDD v2.x Candidate  
Related: [v2構想](01_CRDD_v2_Concept.md), [責務境界](02_CRDD_v2_Responsibility_Boundary.md)

> 本書は非規範の実証計画である。PoCの成功、Coding Agentの実行、試験合格または本書の存在だけで、v2採用、Authority拡張、現行標準変更を意味しない。

---

## 1. 最小実装

最初から専用Server、常駐MCP Server、専用Runtimeを作らない。

```text
CRDD Repository
+ Re-evaluation Contract candidate
+ Operation Goal Contract candidate
+ README / AGENTS guidance
+ Coding Agent Automation
```

最小Loopは次で十分である。

```text
Trigger
  ↓
Coding Agent
  ↓
CRDD
  ↓
AI Reasoning
  ↓
Proposal
```

最初に検証するのはRuntime性能ではない。

> 契機だけを与えたとき、AIは固定Promptへ探索順を書かなくても、CRDDコンテキストを使って有益な仕事を開始できるか。

---

## 2. PoC 1 — 週次プロダクトレビュー

最初の実証候補とする。

```text
毎週月曜09:00
   ↓
Coding Agent Automation
   ↓
Repositoryを開く
   ↓
CRDDの現在状態を再評価
   ↓
現在地・重要変化・リスク・Roadmap影響・次の判断を提示
```

Operation候補：

```yaml
operation:
  id: weekly-product-review
  purpose: evaluate current product state and identify decisions requiring attention
  required_outcomes:
    - current_state
    - meaningful_changes
    - risks
    - roadmap_implications
    - recommended_next_actions
  authority:
    read: autonomous
    proposal: autonomous
    canonical_change: human
  stop_conditions:
    - insufficient_evidence
    - authority_boundary
```

固定Promptには読むファイル、探索順、必ず出す改善案を書かない。AIは必要に応じてRoadmap、Progress、Changes、Decision、Verification、Quality State、Communication Result、Dependencies、Learningへ遡る。

正しい出力には次も含む。

```text
No meaningful change.
No re-evaluation required.
Current direction remains valid.
```

何も変える必要がない場合に、無理に改善案を作らない。

---

## 3. PoC 2 — Communication結果レビュー

```text
時間契機または公開結果追加
   ↓
Publication Result / Measurement
   ↓
Communication Contextと照合
   ↓
仮説と差分を再評価
   ↓
次の候補を作成
   ↓
Human Review
```

確認すること：

- 単純な数値最適化にならないか
- Audience、Claim、Evidence、Design Directionを維持できるか
- 過去結果からLearning候補を作れるか
- Product DirectionやRoadmapとの競合を検出できるか
- 公開権限を分析権限から推定しないか

---

## 4. PoC 3 — Roadmap再評価

```text
時間または状態契機
   ↓
Roadmapの再評価条件
   ↓
Repository / 許可された外部Evidence
   ↓
条件成立候補
   ↓
登録時DecisionとEvidenceへ遡る
   ↓
Discovery再開候補
   ↓
Human Decision
```

確認すること：

- Roadmap項目を単なるTaskとして扱わないか
- 登録時の判断と根拠まで辿れるか
- 前提が実際に変わったかを評価できるか
- 不要な再評価を乱発しないか
- 再評価条件成立を採用や優先順位確定と混同しないか

---

## 5. PoC 4 — Repository Event

```text
Pull Request integrated
   ↓
Meaning Change Assessment
   ├─ 意味影響なし → 根拠付き終了
   └─ 意味影響あり
          ↓
      Affected Context
          ↓
      Re-evaluation Operation candidate
```

確認すること：

- Event発生だけで不要なOperationを起動しないか
- 実装差分と意味変更を区別できるか
- Change、Architecture、Verification等へ正しく接続できるか
- 同じEventから再帰的に自分を起動しないか

---

## 6. 仮説と評価項目

### 6.1. コンテキスト探索

- 必要なコンテキストを自分で発見できるか
- 固定Promptへコンテキスト一覧を書かなくても成立するか
- Repository全体を無差別に読む必要がないか
- Current ContextとHistorical Contextを区別できるか

### 6.2. 推論

- Summaryだけで終わらないか
- 状況変化を検出できるか
- 過去Decisionと現在Evidenceを比較できるか
- 根本原因へ遡れるか
- 適切な再評価先を提案できるか

### 6.3. Authority

- ProposalとDecisionを混同しないか
- Human Authority Contextを無断変更しないか
- External Information Boundaryを守れるか
- MCPやConnector接続を権限と誤認しないか

### 6.4. 出力

- 人間が短時間で判断できるか
- Current State、Evidence、Risk、Recommendationが分離されるか
- 何もする必要がない結論を返せるか
- 重要な不確実性と停止理由を隠さないか

### 6.5. 運用

| 観点 | 評価する内容 |
|---|---|
| 判断価値 | 人間の判断を変えた、早めた、重要な未知を明確にした割合 |
| 見逃し | 人間が後から発見した重要な再評価契機 |
| 誤起動 | 判断価値のない重複・過剰な起動 |
| 収束 | 再帰Loop、同一提案反復、終了不能の有無 |
| 権限 | 無断操作、誤った権限推定、Human Gate回避の有無 |
| 情報境界 | 未許可送信、再識別可能なQuery、外部入力の命令化の有無 |
| 根拠 | 提案から観測、判断、結果を再構成できるか |
| 運用費用 | 実行時間、モデル／Tool費用、人間確認負荷 |
| 学び | 採否や結果が次回の探索品質を改善したか |

安全性と有用性を分けて測定する。有用な提案があっても権限や情報境界を破ったOperationを成功扱いにしない。

---

## 7. 避けるべき失敗

### 7.1. Workflow Automation化

```text
Aを読む → Bを読む → 固定Prompt → Cを生成
```

思考順序をコードへ固定し、CRDDのコンテキスト推論を失わせない。

### 7.2. Trigger乱発

Eventが起きたことではなく、意味を再評価する可能性があることを起動根拠にする。不要なCredit消費、Noise、重複Review、人間の認知負荷を測る。

### 7.3. Proposal Spam

AIが毎回改善案を作る状態を失敗とする。影響なし、再評価不要、現行判断維持を正しい結果として許容する。

### 7.4. コンテキストの過剰共有

便利さを理由にRepository全体を外部AIへ送らない。必要なコンテキスト、目的、送信先、Authorityに基づき、現行の外部情報境界を適用する。

### 7.5. CRDD Coreの肥大化

Scheduler、Queue、Retry、Worker、MCP Server実装をCRDD Coreへ入れない。CRDDはMeaning、Context、Contract、Authority、Trigger Intent、Expected Outcomeを所有する。

### 7.6. 自律性の自己拡張

PoCの成功や過去の一回承認から、新しい判断・操作権限を推定しない。Authority拡張は別の人間判断と検証対象にする。

---

## 8. 段階的な実証

### Stage 0 — 構想と境界

- v0〜v1系列とv2 featureの分離
- コンテキスト契機と実行契機の分離
- Operation Goalと固定Workflowの分離
- Human Authority、External Information Boundary、停止条件の維持

### Stage 1 — Scheduled Advice

- 読み取りと提案のみ
- 週次プロダクトレビュー
- 外部公開、本番変更、費用執行なし
- 有用性、誤検出、見逃し、費用を人間が評価

### Stage 2 — Event-driven Advice

- 意味変化を検出した場合だけ再評価
- 重複起動と再帰Loopを制御
- 情報不足、権限不足で安全に停止

### Stage 3 — Governed Execution

- 可逆で、目的、権限、送信先、停止、回復が取得可能な操作だけを候補化
- 外部公開、本番、費用、法務、権限変更はHuman Gateを維持

### Stage 4 — Multi-Agent Operation

- 必要な専門観点だけを分担
- 独立性、権限、引き渡し、競合解決を評価
- Agent数を品質根拠にしない

### Stage 5 — Continuous Product Evolution候補

```text
Observe → Discover → Reason → Propose
        → Authorized Execute → Verify → Learn
```

Humanは重要なDirection、Risk、Authorityを保持する。

---

## 9. 次の具体的処置

1. 週次プロダクトレビューの読み取り専用Operation候補を一つ設計する。
2. Re-evaluation Goal、Authority、停止条件、結果契約の最小表現を比較する。
3. Coding Agent Automationで時間契機を作り、特定Providerへ規範を固定しない。
4. 合成コンテキストで情報不足、権限不足、Prompt Injection、再帰起動、停止、回復を検証する。
5. 判断価値、誤起動、見逃し、費用、人間確認負荷を測定する。
6. v0〜v1系列の変更をv2 featureへmergeし、共有契約との差分を再評価する。
7. 失敗を隠さず、v2候補に不足する契約、能力、根拠として残す。

PoCの目的は成功を演出することではない。Triggerさえ与えればAIが有益な仕事を開始できるという中心仮説を、反証可能な形で評価することである。
