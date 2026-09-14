# REQ-000024の利用者体験分析

状態: Candidate
要求: `REQ-000024` 境界を越えるTask結果の帰還
探索元: [Project間Context交換](../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md)

## 1. なぜこの要求を体験として扱うのか

Coding Agentが結果を作っても、元の対話やProject判断へ戻らなければ、人間が再び転記・照合しなければならない。結果だけでなく、どのTaskとContextから生まれたかを保つ必要がある。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Agent結果を探し、元の相談へ貼り戻す | 同じTaskに結果、Evidence、未解決事項が戻る |
| 別Taskの結果混入を人間が見分ける | Task IdentityとSource bindingから帰還先を確認する |

## 3. UXへの処置

`UX-000010@1`「出所付きContextと結果の往復」の出力側を担う。自動採用ではなく、結果を元の判断Contextへ戻し、必要な人間判断へ接続する。

## 4. 重要場面、失敗、品質期待

- Result、Evidence、未確認範囲、残存Riskを同じTaskへ結ぶ。
- 別Project、別Revision、別Taskの結果を混ぜない。
- Agent完了を成果物採用やEffect成功と表示しない。
- 帰還失敗時も生成済み結果の所在と再取得方法を保持する。

## 5. 下流への引き渡し

IAはTask、Context Package、Result、Evidence、DecisionおよびHandoffを関係付ける。SPEC／Architectureは相関IdentityをTransport境界で保持し、Verificationは誤配送と欠落を反証する。
