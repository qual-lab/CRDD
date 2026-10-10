# 表示面と領域

状態: v0.22.0更新中（最新鍵管理判断のDefinition・横断投影は再伝播中・限定独立レビュー済み・残指摘0。SCR／BHV・Area・Workbench候補は未追従、全体Readyは未主張）
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

### 接続・管理の横断責務（UI-000008の現行投影）

[UI-000008](Definitions/UI-000008/ui_definition.md)は、利用時の自身表示とRole許可・公開範囲・実アクセス、管理時のユーザー・Role権限・資格、鍵交換時の対象・影響・結果を扱う。上の論理表示面一覧だけから管理機能の配置を確定しない。Workbench／Host CLIの入口分担は採用済みで、具体表示・案内・配置は未確定で、[SCR-000008](Details/Areas/configuration-trust/SCR-000008/screen.md)の未確認事項へ接続する。

通常管理とHost回復は入口・Authorityの違いであり、指定ユーザー交換／全員交換は処置範囲の違いである。Host実行能力を通常Remote表示へ持ち込まない。表示対象は現行認可と開示範囲内に限定し、管理能力から内容閲覧権限を推定しない。

鍵の発行・独立失効・交換はadministrator専用固定で、Role詳細権限のON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで提供し、MCPには秘密値の有無を問わず鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱い、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存Root／Path検証を維持する。他4管理群（ユーザー管理・Role設定・Repository登録・公開範囲管理）の担当Role・設定可否はOPENのまま保持する。

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
