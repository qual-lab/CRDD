# 表示面と領域

状態: [分析中／レビュー中／引き渡し可能]
担当責任者: [owner]

## 1. この投影で分かること

[個別UI定義から、利用者に見える入口、表示面、領域、情報の優先順位を横断表示する。]

## 2. 表示面と領域

```text
[入口]
  └─ [表示面]
       ├─ [主要領域]
       └─ [補助領域]
```

## 3. UI定義への適用

| UI定義 | Surface Responsibility | Information Priority | 非該当理由 |
|---|---|---|---|
| [UI-XXXXXX](Definitions/UI-XXXXXX/ui_definition.md) | [責任] | [優先順位] | [なし／理由] |

## 4. 未確認事項・戻り条件

[なし／UI Definitionへ戻す事項]

## 5. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全UI Definitionを一件ずつ処置した
- [ ] Surface ResponsibilityとInformation Priorityを区別した
- [ ] 表示面と領域を実装Componentへ固定していない
- [ ] 個別UI Definitionの意味を再定義していない
- [ ] Open・Gapと戻り条件を明示した
