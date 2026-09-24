# 表示面と領域

状態: UI定義の横断投影
情報源: [UI定義台帳](01_User_Interface.md#3-ui定義台帳)

## 1. 利用者から見える入口

```text
利用者
  │
  ├─ Repository文書 ──→ 正本を読む・変更箇所を辿る
  ├─ CLI ─────────────→ 実行・診断・回復を直接操作する
  ├─ MCP ─────────────→ Chat Agentから同じ契約を利用する
  └─ Workbench ───────→ Project／Portfolioを確認し定型操作へ進む

どの入口でも
対象 / 現在状態 / 不完全性 / 根拠 / 判断要否 / 次の行動
を同じ意味で示す
```

## 2. 論理表示面

| 表示面 | 主な目的 | 主なUI定義 |
|---|---|---|
| Review準備 | 機械的不備を落とし意味判断へ進む | `UI-000001` |
| Task Operation | 委任、状態確認、判断、取消、回復 | `UI-000002`、`UI-000003`、`UI-000012` |
| Project Operation | Project・節目・Portfolio・Source Coverageを確認し、Task根拠と受入条件からObjective／Milestoneを受入・差戻し・判断待ちにする | `UI-000004`、`UI-000006`、`UI-000008` |
| Observation | 実行事実の記録・取得、故障境界、現在保証を診断する | `UI-000005`、`UI-000015`、`UI-000020` |
| Context Work | Meeting、Topic、外部持帰り、現在有効な意図を処置する | `UI-000009`、`UI-000016`、`UI-000017` |
| Configuration | Tool、AIモデル、Runtime信頼、実行時データを管理する | `UI-000010`、`UI-000011`、`UI-000013` |
| Documentation | 物語、構造、図、素材の根拠へ進む | `UI-000018`、`UI-000019` |

## 3. 表示責任のブロック

```text
┌──────────────────────────────────────┐
│ Context Header                       │
│ 対象 / Project / Repository / 観測時点 │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Primary Status                       │
│ 現在状態 / 結果 / 判断要否 / 重大な不足 │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Evidence and Coverage                │
│ 根拠 / Source / Coverage / 制限 / 古さ │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Action                               │
│ 次の安全な操作 / 候補処置 / 正本への導線 │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Details                              │
│ 内部ID / 診断情報 / 実装詳細           │
└──────────────────────────────────────┘
```

重大な停止、判断要求、回復義務または不完全性をDetailsへ隠さない。内部識別子や生Logを主表示にしない。

## 4. Workbenchの最小領域

```text
Project / Portfolio Selector
        │
        ▼
Project Header ── Source Coverage
        │
        ├─ Current State / Milestone / Decision
        ├─ Topics / Meetings / Changes / Quality
        └─ Canonical Sourceへの導線
                           │
                           └─ 既存Command／Candidate入口へ進む
```

Workbenchは表示面であり、正本、集計規則、Authority判定またはFilesystem更新を所有しない。

## 補足分析

なし。

## Checklist

- [x] 全UI Definitionを一件ずつ処置した
- [x] Surface ResponsibilityとInformation Priorityを区別した
- [x] 表示面と領域を実装Componentへ固定していない
- [x] 個別UI Definitionの意味を再定義していない
- [x] Open・Gapと戻り条件を明示した
