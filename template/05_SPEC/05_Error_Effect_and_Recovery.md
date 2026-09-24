# 失敗・Effect・回復

状態: [分析中／レビュー中／引き渡し可能]

## 1. 失敗・Effect・回復

| SPEC定義 | Failure | Effect | Retry／Cancel／Undo | Recovery／終了後条件 |
|---|---|---|---|---|
| [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [失敗] | [Effect] | [適用／非該当理由] | [回復／条件] |

## 2. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全SPEC DefinitionのFailure・Effect・Recoveryを処置した
- [ ] Partial Success、Retry、CancelおよびUndoの適用を評価した
- [ ] Effect 0、Effect成立およびEffect不明を区別した
- [ ] Recovery Ownerと終了後条件を処置した
- [ ] 未定義の回復方式を追加していない
