# 状態遷移

状態: [分析中／レビュー中／引き渡し可能]

## 1. 状態遷移

| SPEC定義 | Current State | Trigger | Next State／Result | Failure／Recovery |
|---|---|---|---|---|
| [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [状態] | [契機] | [次状態／結果] | [失敗／回復] |

## 2. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全SPEC DefinitionのState Transitionを処置した
- [ ] Meaning StateとUI Visible Stateを同一視していない
- [ ] 未知・観測不能を正常または不存在へ丸めていない
- [ ] 回復義務と終了後条件を処置した
- [ ] 架空の共通状態を追加していない
