# 利用場面と振る舞いFlow

状態: [分析中／レビュー中／引き渡し可能]

## 1. 主要な利用場面

| SPEC定義 | Actor | Trigger | Precondition | Result |
|---|---|---|---|---|
| [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [Actor] | [契機] | [条件] | [結果] |

## 2. Flow

```text
[Actor] --trigger--> [条件確認]
                         ├─成立→ [Behavior] → [Result]
                         ├─不成立→ [Failure]
                         └─不明→ [判断不能]
```

## 3. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全SPEC Definitionを一件ずつ処置した
- [ ] Actor、Trigger、Precondition、BehaviorおよびResultを区別した
- [ ] 正常・境界・失敗・判断不能を処置した
- [ ] 個別SPEC Definitionの意味を再定義していない
- [ ] 実装Sequenceを先取りしていない
