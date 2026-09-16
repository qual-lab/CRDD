# UI／SPEC対応

状態: [未実施／レビュー中／Pass／Blocked]

## 1. レビュー対象

| 項目 | 対象 |
|---|---|
| 対象改訂版 | [UI Definition、SPEC Definition、双方の`pairs_with`とこの文書を含む同一Git改訂版] |
| 対象関係 | [件数] |
| 判定単位 | UI／SPECの組ごとにShared Contextと8観点を確認する |
| 工程境界 | 対応PassとUI工程Exitを区別する |

## 2. 対応関係と個別レビュー結果

| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |
|---|---|---|---|---|---|---|---|
| [UI-XXXXXX](../04_UI/Definitions/UI-XXXXXX/ui_definition.md) | [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [UX／IA] | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | [Pass／Gap／N/A] | [なし／Owner工程と必要な判断] | [UI-XXXXXX](../04_UI/Definitions/UI-XXXXXX/ui_definition.md)、[SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) |

## 3. 観点別レビュー

| 観点 | 結果 | 確認内容 |
|---|---|---|
| State | [結果] | [確認] |
| Interaction／Trigger | [結果] | [確認] |
| Result／Feedback | [結果] | [確認] |
| Failure／Recovery | [結果] | [確認] |
| Authority／Visibility／Constraint | [結果] | [確認] |

## 4. Gap処置

[なし／UI・SPEC・IA・UXへ戻す事項]

## 5. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] UIとSPECが同じUX・IA Contextを保持している
- [ ] Shared Stateの意味が一致する
- [ ] InteractionとTriggerが矛盾しない
- [ ] ResultとFeedbackが矛盾しない
- [ ] FailureとError Presentationが矛盾しない
- [ ] Recoveryが両側で成立する
- [ ] Authorityが矛盾しない
- [ ] Visibilityが矛盾しない
- [ ] Constraintが片側で欠落していない
- [ ] UI-only Responsibilityを識別した
- [ ] SPEC-only Responsibilityを識別した
- [ ] Shared Responsibilityを識別した
- [ ] GapのOwner工程を特定した
- [ ] UI／SPEC独自の第三仕様を作っていない
- [ ] 未決事項をAI推測で補完していない
