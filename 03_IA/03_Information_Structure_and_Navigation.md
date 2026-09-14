# CRDD／CROSの情報のまとまりと導線

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

## 1. 導線の原則

- 最初に現在状態、不足、判断要否、次の行動を示す。
- 重大な停止、回収不明、権限不足を詳細へ隠さない。
- 要約から情報源、改訂版、観測時点へ戻れるようにする。
- 利用不能・非開示の対象を推測表示しない。
- 入口が変わっても、対象、状態、判断、結果の意味を変えない。

## 2. 情報のまとまり

```text
Project
├ Primary
│  ├ 現在状態
│  ├ 判断待ち
│  ├ 重大な不足・競合
│  └ 次の行動
├ Secondary
│  ├ Milestone／Objective／Task
│  ├ Topic／Meeting／Change
│  └ 品質・実行・回復
└ Reference
   ├ Repository／Binding
   ├ Source／Revision／Observed At
   └ Contract／Evidence／履歴
```

Primary、Secondary、Referenceは情報上の優先度であり、画面の位置や大きさを確定しない。

## 3. 入口から根拠、次の行動まで

```text
[N: Repository／MCP／Workbench]
          │
          ▼
[N: 対象を選ぶ]
          │  Project／Repository／Taskを区別
          ▼
[N: 現在状態を理解する]
          │  complete／partial／blocked／unknown等
          ├─ 根拠が必要 ──→ [N: Source／Revision／Evidence]
          ├─ 判断が必要 ──→ [N: Decision／選択肢／影響]
          ├─ 回復が必要 ──→ [N: Effect／残存／Recovery]
          └─ 継続可能 ────→ [N: 次の仕事]
```

具体的なRoute、Sidebar、Tab、ButtonはUIが定める。IAが固定するのは、失ってはならない対象選択と到達関係である。

## 4. 利用場面による入口

| 利用場面 | 既定の入口 | 必要時に進む先 |
|---|---|---|
| Repositoryの日常作業 | Repository内の正本・Tool | 横断情報が必要な場合だけCROS |
| Project全体の判断 | MCP／Workbench | Source、個別Repository、判断対象 |
| 複数Project比較 | Portfolio投影 | 個別Projectの差と根拠 |
| 実行・回復 | Task／Operation結果 | Attempt、Effect、残存、Recovery |
| 実行環境の故障 | 故障した境界 | 影響する能力、継続可能範囲、回復経路 |
| 過去判断の再利用 | 現在有効な意図 | 当時の背景、過去値、置換先、選択理由 |
| 標準保守 | Change／Quality | 対象ファイル、Finding、Evidence、Release |
