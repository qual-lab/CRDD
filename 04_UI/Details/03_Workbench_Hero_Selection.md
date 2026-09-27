# Workbench Hero Screen Selection

成果物種別: UI Detail — Hero Screen選定
対象Product: CROS Workbench
状態: Human Selected — G2 Passed／G3 In Progress
維持責任者: Qual-Lab

## 1. 結論

G1のScreen InventoryとFlowから、Hero候補を4件比較した。AIの推奨は`Project Workspace`である。これはWorkbenchを、Project情報のDashboard、AI Chat、Git Clientのいずれか一つに偏らせず、Projectの現在地から理解・判断・実行へ進む入口として最も広く表現できるためである。

ただし、`Project Workspace`は一般的なCard Dashboardへ収束しやすい。G2を通過するには、人間が次の方針を確認する必要がある。

> HeroはProject Workspaceとし、五場面、Attention、根拠、次の一手を一つの読解順序へ構成する。AIへの依頼とRepository作業はWorkbenchの能力として到達可能にするが、Heroの主役にはしない。

Qual-Labは2026-09-27にAI推奨どおり`Project Workspace`をHeroとして採用し、G2を通過させた。Topic Detail、Repository Worktree、Project Portfolioの順でSecondary Screenへ展開する。G3では本成果物の固定表示条件を使い、2案以上のRendered Viewを比較する。

## 2. 比較条件

| 観点 | 確認すること |
|---|---|
| Product代表性 | Workbench固有の価値を一画面で説明できるか |
| 利用者範囲 | Developer、PM、Managementの一部だけへ過度に偏らないか |
| 五場面 | 現在、重要、変化、判断、次の一手を接続できるか |
| 正本との接続 | 要約だけで判断させず、Owner Artifactと根拠へ戻れるか |
| 操作への展開 | Topic、Meeting、AIへの依頼、Repository作業へ自然に進めるか |
| Visual探索余地 | 情報密度、階層、Attention、Compositionを複数案で比較できるか |
| 偏り | Dashboard、Chat、Git Client、Management View等へ誤認させないか |
| Secondary展開 | 他ScreenへBaselineを展開してPatternを検証できるか |

## 3. Hero候補比較

| 候補 | Product代表性 | 主な強み | 主な偏り・失敗Risk | G3以降での役割 | AI判定 |
|---|---|---|---|---|---|
| Project Workspace | 強い | 五場面、Attention、根拠、次の一手と各作業入口を統合できる | Cardを並べただけの一般的Dashboardになりやすい | Hero。情報階層とProduct Personalityを探索する | 推奨 |
| Topic Detail | 中 | 経緯、Relation、判断、Action、CHGへの昇格というCRDDらしい仕事を表せる | Project全体像、Portfolio、Git、管理を代表できない | 最初のSecondary Screen。具体作業への展開を検証する | Hero不採用候補 |
| Repository Worktree | 中 | Project ContextとTree／Diff／Commit／Pushの接続が具体的 | DeveloperとGitへ偏り、簡易SourceTreeと誤認されやすい | Secondary Screen。高密度作業面と状態表現を検証する | Hero不採用候補 |
| Project Portfolio | 中 | 複数Project、Attention、Observation Boundaryを比較できる | Management Dashboardへ偏り、日常のProject作業を示しにくい | Secondary Screen。横断比較と権限内投影を検証する | Hero不採用候補 |

`AIへの依頼`はHero候補にしない。WorkbenchはCodexやClaude Code等へのContext付き依頼面を持つが、独自Chat Productや会話履歴の正本ではないためである。Connection Setup、Access Administration、AI Profilesも、Productを利用可能にする設定面でありHeroではない。

## 4. 候補ごとの情報構造

### Project Workspace

```text
Current Project
    │
    ├─ 今どうなっているか
    ├─ 何が重要か
    ├─ 何が変わったか
    ├─ 何を判断する必要があるか
    └─ 次に何をすべきか
           │
           ├─ 根拠・Owner Artifact
           ├─ Topic／Meeting
           ├─ Quality／Runtime
           ├─ AIへの依頼
           └─ Repository Worktree
```

成功条件は、五つのSectionを均等なCardへ分断することではない。最もAttentionを要する事項から、根拠、判断、次の処置へ自然に読めることとする。

### Topic Detail

```text
Topicの現在状態
      ↓
経緯・Meeting・Decision
      ↓
未解決点・判断・Action
      ↓
継続／終了／CHGへ昇格
```

### Repository Worktree

```text
Project上の作業理由
      ↓
Tree／Diff／Stage
      ↓
Commit候補
      ↓
確認付き通常Push
      ↓
結果と残る差分
```

### Project Portfolio

```text
権限内で観測できるProject群
      ↓
重要な差・Attention・期限
      ↓
Observation Boundary
      ↓
Current Projectを選択
```

## 5. 推奨するG3表示条件

人間がProject WorkspaceをHeroとして確認した場合、G3では同じデータ条件を使って2案以上を比較する。

| 条件 | 固定内容 |
|---|---|
| Project | 単一のCurrent Project |
| 状態 | v0.22進行中、期限あり、一部Attentionあり |
| 五場面 | すべて表示対象とする |
| 不完全性 | 少なくとも一つの未観測または利用不能Contextを含む |
| Topic／Meeting | 未処置Actionと継続Topicを一件以上含む |
| Quality | PassだけでなくOPENまたはGapを含む |
| Repository | 未Commit差分を含むが、Gitを画面の主役にしない |
| AI | Context付き依頼入口を示すが、Chat履歴を主役にしない |

この固定条件を変えて各Directionを有利に見せない。各DirectionでComposition、Information Density、Visual Hierarchy、Attention、Typography、Spacing、Surface、Color、Reading OrderおよびAction Hierarchyを比較する。

## 6. Human Direction Decision

| 判断項目 | AI推奨 | 人間判断 | 未決による影響 |
|---|---|---|---|
| Hero Screen | Project Workspace | 採用 | G3を開始できる |
| Heroの主役 | Projectの現在地から判断・次の一手へ進むこと | 採用 | 五場面を同じ重さのCardへ分断しない |
| AIへの依頼 | 補助的なContext付き入口。Chat履歴は主役にしない | 採用 | Panel／Side Panel／外部入口はG3で比較する |
| Git | 現在状態の一部と作業入口。Heroでは概要まで | 採用 | 高密度作業面はSecondary Screenで検証する |
| 最初のSecondary Screen | Topic Detail、その次にRepository WorktreeとPortfolio | 採用 | G5の展開順とする |

## 7. 未確認事項・戻り条件

| 項目 | 状態 | Owner | 現在の影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| Hero採用 | 解決済み | Qual-Lab | G3開始可能 | Product代表性または利用者成果を保持できない反証が出た時 |
| Project WorkspaceとAIへの依頼面の関係 | OPEN | Qual-Lab | Composition候補に影響 | G3でPanel／Side Panel／外部入口を同一条件で比較する |
| 五場面の視覚的優先順位 | OPEN | Qual-Lab | Dashboard化のRisk | G3でAttention起点と全体Overview起点を比較する |
| Secondary Screen順序 | OPEN | Qual-Lab | G5計画に影響 | Hero採用後に代表性と例外検証力から決める |

Hero候補のいずれも上流UX／IAを保持できないと判明した場合はG1へ戻る。Visualの好みだけでScreen目的または情報Ownerを変更しない。

## Checklist

- [x] G1のScreen InventoryとFlowを入力にした
- [x] Product代表性、利用者範囲、五場面、正本接続、操作展開、Visual探索余地、偏り、Secondary展開を比較した
- [x] Project Workspace、Topic Detail、Repository Worktree、Project Portfolioを同じ観点で比較した
- [x] AIへの依頼を独自Chat Productまたは会話履歴の正本としてHero化していない
- [x] AI推奨と人間判断を区別した
- [x] G3で比較する表示条件を固定した
- [x] Qual-LabによるHero Screenの確認を取得した
- OPEN: Hero採用後に決めるため — G3のVisual Directionを作成した
- [x] G2未通過の状態でVisual Baseline、SCR／PRT／CMPまたは下流Handoffを確定していない
