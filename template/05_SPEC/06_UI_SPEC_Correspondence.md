# UI／SPEC対応

状態: [未実施／レビュー中／Pass／Blocked]

## 1. 対応関係

| UI | SPEC | Shared Context | Coverage | Gap Owner | 結果 |
|---|---|---|---|---|---|
| [UI-XXXXXX](../04_UI/Definitions/UI-XXXXXX/ui_definition.md) | [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [UX／IA] | Shared／UI-only／SPEC-only | [なし／Owner工程] | [Pass／Blocked] |

## 2. 観点別レビュー

| 観点 | 結果 | 確認内容 |
|---|---|---|
| State | [結果] | [確認] |
| Interaction／Trigger | [結果] | [確認] |
| Result／Feedback | [結果] | [確認] |
| Failure／Recovery | [結果] | [確認] |
| Authority／Visibility／Constraint | [結果] | [確認] |

## 3. Gap処置

[なし／UI・SPEC・IA・UXへ戻す事項]

## 4. 補足分析

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
