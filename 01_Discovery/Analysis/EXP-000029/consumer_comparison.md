# Project Context入口比較

成果物種別: Discovery分析の補足資料
探索ID: `EXP-000029`
対象入力: [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)

## 1. 目的

同じProject Context Projectionを、人間、AI、MCP、CROSおよびWorkbenchが別の意味へ作り替えず利用できるかを比較する。本資料は入口方式の採否を先取りせず、現在確認できた範囲と未接続範囲を分ける。

## 2. 共通の確認場面

各入口は、次の五場面を一括して説明できる必要がある。

```text
現在地
  ↓
Risk・停止
  ↓
人間の判断待ち
  ↓
現在の理由・根拠
  ↓
保存済みの次候補
```

次の区別を失ってはならない。

- 現在事実と、複数正本から導いた共有分析。
- 保存済みの次候補と、対話時にAIが追加した推論。
- Repository内で確認できる範囲と、存在または不存在を主張できない範囲外Context。
- 表示用の要約と、詳細・履歴・判断理由を所有するOwner Artifact。

## 3. 現在の比較結果

| 入口 | 現在の状態 | 確認できたこと | 未確認または不足 | 判定 |
|---|---|---|---|---|
| Markdown直接確認 | 接続済み | Identity、五場面、結論、表、Owner Relationを一つのファイルから確認できる | 読者自身がOwner Relationを辿る必要がある | 成立 |
| Codex対話 | 接続済み | 五場面の意味、正本と投影の分担、範囲外を推測しない境界について人間と認識を一致できた | 同じ質問への反復時間と見落とし率は未計測 | 部分成立 |
| ChatGPT | 未評価 | N/A: この固定入力を別入口から独立評価していない | 同じ回答品質、Owner Relation、追加推論の表示分離 | OPEN |
| Claude Code | 未評価 | N/A: この固定入力を別入口から独立評価していない | 同じ回答品質、Owner Relation、追加推論の表示分離 | OPEN |
| MCP | 設計のみ | Architectureでは五場面を同じ意味で搬送する境界を定義済み | `PROJECT_CONTEXT.md`を返す公開Resource／Toolと実装Evidenceがない | OPEN |
| CROS Federation | 設計のみ | 利用可能Repository集合だけを束ね、第二の正本を作らない境界を定義済み | 複数Repository入力、競合、部分観測の実装Evidenceがない | OPEN |
| Workbench | 要求採用・未実装 | Project ContextをOverviewとして使い、Topic、Meeting、Project成果物およびVersion Controlへ進む入口を確認済み | 利用価値、画面、維持費、MCPとの差はDogfood前 | OPEN |

`OPEN`は入口の不採用またはProject Context契約の失敗を意味しない。現在の固定入力を実際の入口から利用していないため、成立を主張しない状態である。

## 4. 現在分かったこと

固定見出し、固定表、Identity、Owner Relationおよび五場面によって、Markdown直接確認と一つのAI対話では同じ意味を共有できた。Repository ManifestとのIdentity一致もCheckerで検証できる。

一方、MCP、CROSおよびWorkbenchについて確認できたのはArchitecture上の責務だけであり、実装済みのConsumerとしては扱えない。ChatGPTやClaude Codeも、同じ固定入力を使った独立比較をまだ行っていない。

## 5. 次の観測

1. `PROJECT_CONTEXT.md`を意味を変えず返す最小MCP読取り境界を設計・実装候補として評価する。
2. [REQ-000039](../../Definitions/REQ-000039/requirement.md)から、Topic／Meetingの共通Application Capabilityと情報構造をUX以降で具体化する。
3. 同じ五場面の質問と固定入力を使い、ChatGPT、CodexおよびClaude Codeの回答を比較する。
4. 事実、共有分析、追加推論および範囲外の扱いに差がある場合は、AIごとのPromptで隠さずProject Context契約または共通Operating Contractへ戻す。
5. WorkbenchをProject Context Viewerに限定せず、Topic、Meeting、Roadmap、Quality、DocumentationおよびRuntime Stateへ進む仕事の入口として比較する。

外部AIへRepository内容を送る場合は、現在の外部情報境界と送信許可を別途確認する。本比較記録だけを外部送信Authorityとして扱わない。

## Checklist

- [x] 比較対象へ同じProject Contextを使用した。
- [x] 五場面を一括回答の共通基準にした。
- [x] 現在事実、共有分析および追加推論を区別した。
- [x] 未実装または未評価を不合格や不存在へ畳んでいない。
- [x] Architecture上の責務と実装Evidenceを区別した。
- [x] Workbenchの採否や画面を先取りしていない。
- OPEN: ChatGPT、Claude Code、MCP、CROSおよびWorkbenchは同じ固定入力による実利用比較が未完了であるため — 入口間の回答品質を確認した。
