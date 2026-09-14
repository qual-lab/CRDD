# CRDD／CROSの利用者像

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

本書は、CRDD／CROSを使う人を、仕事、判断、困りごとおよび必要な支援の違いから整理する。ここで示す利用者像は固定Roleや権限Groupではない。同じ人でも、対象Repository、接続先、Credentialおよび現在の仕事によって別の利用Contextになる。

## 1. 利用者像の全体像

```text
日常の実行                         Project・Portfolioの判断

Developer ───────→ Project Operator／PM ───────→ Management
    │                       │                         │
    │ Repositoryで働く      │ Projectを横断して見る   │ 複数Projectを比べる
    ▼                       ▼                         ▼
Local AI／CLI          CROS／MCP／Workbench      Portfolio Projection


標準とRuntimeを支える利用Context

CRDD作成者・保守者 ──→ Runtime導入・運用者 ──→ 外部Contextの所有者
```

この図は権限階層ではない。利用可能な情報と操作は、Repositoryの既存権限、検証済みBinding、Workspace Grant、開示制約および個別Operation Authorityから決まる。

## 2. Product横断Persona

| Persona | Goal | 主なPain／障壁 | 利用Context | 判断・責任 | 根拠・確信度 |
|---|---|---|---|---|---|
| Developer | 自分のRepositoryで日常の仕事を進める | 横断機能のために通常作業を複雑にされたくない。利用不能Contextを推測で補いたくない | 実装、文書、Topic、Meeting、品質確認 | 自分の作業内容と技術判断 | Discoveryで確認した方向。横断機能追加後の実負担は未実測 |
| Project Operator／PM | 一つの論理Projectの現在地を理解し、次の判断を決める | 複数Repository、文書、実行状態を毎回自分で統合したくない | Milestone、Topic、Meeting、Quality、判断待ち、Commercial可視性 | Projectの進行と優先判断 | 保守・設計対話から導出。必要表示と許容操作負担は未実測 |
| Management | 複数Projectの重要差分と根拠を比較する | 詳細を全て読まずに判断したいが、単一Scoreや不完全な要約にも依存したくない | PortfolioからProjectの要因へ段階的に進む | Portfolioの優先順位と上位判断 | 構想上の利用者像。実組織での情報粒度は未確認 |
| CRDD作成者・保守者 | 課題、変更、成立条件および影響先を収束させる | Checklist、監査、署名、検証の状態を取り違えたくない | 標準の探索、設計、変更、監査、公開 | 標準変更と公開判断の支援 | CRDD自身の保守実績を根拠にする |
| Runtime導入・運用者 | 配布物を安全に導入・更新し、停止後に正しい回復を選ぶ | 内部状態を推測したり、再試行と回復を取り違えたりしたくない | Runtime導入、更新、診断、Recovery、Cleanup | 配置環境で信頼するPublisherと運用上の処置 | v0.19～v0.20の実運用を根拠にする |
| 外部Contextの所有者 | 許可した情報だけを外部へ渡し、出所付き結果を受け取る | 接続済みや過去同意を包括許可へ広げられたくない | 外部AI、MCP、API、Communicationへの送受信 | 送信先、目的、分類、同意、採否 | 外部情報境界と利用者判断を根拠にする |

## 3. 利用Contextによる差

```text
同じ人
  │
  ├─ 現在Repositoryだけで仕事する
  │      → Developer Context
  │
  ├─ Project全体の状態を判断する
  │      → Project Operator／PM Context
  │
  └─ Runtime停止後の回復を行う
         → Runtime導入・運用Context
```

個別REQ分析は本書のPersonaを参照し、要求固有のTrigger、制約、知識差、判断Authorityまたは失敗影響だけを補足する。Persona名を要求ごとに言い換えて新しい人物像を量産しない。

## 4. 未確認事項

- Developer、PM、Managementそれぞれが許容できる確認回数、待ち時間および情報量。
- Workbenchを使う場面と、Chat Agentまたは静的文書だけで足りる場面の境界。
- 支援技術、端末差、知識差によって成果へ生じる格差。
- Shared CROS Serverを実組織で使う場合の、既存Identity ProviderとRepository権限の接続。

これらは架空の属性で補わず、Prototype、代表利用者確認または実運用観測で更新する。
