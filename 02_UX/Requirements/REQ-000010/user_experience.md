# REQ-000010の利用者体験分析

状態: Candidate
要求: `REQ-000010` Workbench・MCP・CLIの公開契約共有
探索元: [人とAIの入口](../../../01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md)

## 1. なぜこの要求を体験として扱うのか

同じProject状態が入口ごとに違う意味や結果を返すと、利用者はSurface固有のルールを覚え、どれを信じるか判断しなければならない。Workbenchは別の業務実装ではなく、人向けの薄い入口である必要がある。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| UI、AI、CLIで状態名や操作結果が違う | 入口が違っても同じ状態、判断境界、結果へ到達する |
| UIだけが持つ直接更新を信頼する | 所有正本のCommandまたはCandidateを通じて反映する |

## 3. UXへの処置

`UX-000003@1`「薄いWorkbench」へ変換し、入口間の比較は`UX-000006@1`で扱う。Toolを使うこと自体をUX成果にせず、同じ目的へ迷いなく到達できることを成果とする。

## 4. 重要場面、失敗、品質期待

- 接続成功と、内容取得、候補作成、採用、Effect許可を区別する。
- Workbench内部に第二の正本や独自Authority判断を持たない。
- Structured Resultを画面・自然言語・CLIで矛盾なく表現する。
- Surface障害後も所有正本から状態を再取得できる。

## 5. 下流への引き渡し

IAは公開結果と表示状態を分ける。UI／SPECは同じCanonical状態から表示と操作可否を導き、Architectureは公開Application Contractを唯一の意味境界にする。
