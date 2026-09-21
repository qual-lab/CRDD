# Actor／System間Sequence

状態: [分析中／レビュー中／引き渡し可能]

## 1. Sequence

```text
[Actor] --request--> [System]
  |                     |
  |<--accepted----------|
  |<--result-------------|
```

## 2. SPEC定義への適用

| SPEC定義 | Actor／Authority | Sequence上の要点 | 非該当理由 |
|---|---|---|---|
| [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [主体／権限] | [要求・受理・Effect・観測] | [なし／理由] |

## 3. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全SPEC DefinitionのActorとAuthorityを処置した
- [ ] 要求、受理、Effect、結果観測および終了を全数評価し、統合する段階には理由を記録した
- [ ] 利用者操作と内部実装呼出しを同一視していない
- [ ] 個別SPEC Definitionの意味を再定義していない
- [ ] Architecture方式を先取りしていない
