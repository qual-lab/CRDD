# 操作と表示状態

状態: [分析中／レビュー中／引き渡し可能]
担当責任者: [owner]

## 1. UIごとの適用範囲

| UI定義 | Interaction | Visible State | Feedback | Recovery Presentation |
|---|---|---|---|---|
| [UI-XXXXXX](Definitions/UI-XXXXXX/ui_definition.md) | [操作] | [表示状態] | [Feedback] | [回復表示／非該当理由] |

## 2. 操作と表示状態の関係

```text
[利用者の操作]
       ↓
[表示状態] ──→ [Feedback]
       │
       └─失敗→ [理由と安全な次行動]
```

## 3. 未確認事項・戻り条件

[なし／UI Definitionへ戻す事項]

## 4. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全UI Definitionを一件ずつ処置した
- [ ] Interaction、Visible State、FeedbackおよびRecovery Presentationを区別した
- [ ] 共通Variantを全UIへ一律適用していない
- [ ] Behavior Ruleを先取りしていない
- [ ] 個別UI Definitionの意味を再定義していない
