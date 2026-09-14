# REQ-000017の利用者体験分析

状態: Candidate
要求: `REQ-000017` 出所付きContext Packageの解決
探索元: [Project間Context交換](../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md)

## 1. なぜこの要求を体験として扱うのか

Chat AgentとCoding Agentの間で人間が文書や会話を転記すると、出所、改訂版、選択理由が失われる。全Context投入は過剰共有と認知負荷を増やす。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| 次のAgentへ必要そうな情報を手で貼り直す | 対象Taskに必要なContextがSourceとRevision付きで解決される |
| Agentが何を参照したか推測する | 利用したContext集合と不足範囲を後から追跡する |

## 3. UXへの処置

`UX-000010@1`「出所付きContextと結果の往復」の入力側を担う。Context Packageは全文詰め合わせではなく、Taskへ必要な意味を選択した投影とする。

## 4. 重要場面、失敗、品質期待

- 対象Artifact、上位Intent、制約Decision、必要Evidence、現在有効なHypothesisを選ぶ。
- 古い、競合する、利用不能なContextを暗黙に統合しない。
- Secretや許可外情報をPackageへ含めない。
- 不足ContextをAgentの推測で補完しない。

## 5. 下流への引き渡し

IAはContext Package、Source、Revision、Selection ReasonおよびTask Relationを分ける。ArchitectureはResolverとTransportを分離し、Verificationは出所喪失と過剰投入を反証する。
