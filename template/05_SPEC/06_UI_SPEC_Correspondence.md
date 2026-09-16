# UI／SPEC対応

状態: [未実施／レビュー中／Pass／Blocked]

## 1. レビュー対象

| 項目 | 対象 |
|---|---|
| 対象改訂版 | UI／SPEC Definition集合 SHA-256: `[64桁のSHA-256]` |
| 対象関係 | [件数] |
| 判定単位 | UI／SPECの組ごとにShared Contextと8観点を確認する |
| 工程境界 | 対応PassとUI工程Exitを区別する |

## 2. 対応関係と個別レビュー結果

| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |
|---|---|---|---|---|---|---|---|
| [UI-XXXXXX](../04_UI/Definitions/UI-XXXXXX/ui_definition.md) | [SPEC-XXXXXX](Definitions/SPEC-XXXXXX/spec_definition.md) | [UX／IAの積集合] | Shared | 8観点の組別Evidenceを確認 | [作成者確認済み／Gap／N/A] | [Gapなし／Owner工程と必要な判断] | [組別Evidence](#ui-xxxxxxspec-xxxxxx) |

## 3. 組別Evidence

### UI-XXXXXX／SPEC-XXXXXX

共有Context: [UX／IAの積集合]

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI状態節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#状態と表示差) | [SPEC状態節](Definitions/SPEC-XXXXXX/spec_definition.md#振る舞い状態結果) | [一致／N/A] | [理由] |
| Trigger | [UI操作節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#操作とfeedback) | [SPEC契機節](Definitions/SPEC-XXXXXX/spec_definition.md#契機事前条件authority) | [一致／N/A] | [理由] |
| Result | [UI操作節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#操作とfeedback) | [SPEC状態節](Definitions/SPEC-XXXXXX/spec_definition.md#振る舞い状態結果) | [一致／N/A] | [理由] |
| Failure | [UI操作節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#操作とfeedback) | [SPEC失敗節](Definitions/SPEC-XXXXXX/spec_definition.md#失敗回復副作用) | [一致／N/A] | [理由] |
| Recovery | [UI状態節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#状態と表示差) | [SPEC失敗節](Definitions/SPEC-XXXXXX/spec_definition.md#失敗回復副作用) | [一致／N/A] | [理由] |
| Authority | [UI制約節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#制約) | [SPEC契機節](Definitions/SPEC-XXXXXX/spec_definition.md#契機事前条件authority) | [一致／N/A] | [理由] |
| Visibility | [UI表示節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#表示面と情報の優先順位) | [SPEC受入節](Definitions/SPEC-XXXXXX/spec_definition.md#受入条件と検証義務) | [一致／N/A] | [理由] |
| Constraint | [UI制約節](../04_UI/Definitions/UI-XXXXXX/ui_definition.md#制約) | [SPEC制約節](Definitions/SPEC-XXXXXX/spec_definition.md#制約) | [一致／N/A] | [理由] |

各理由には対象のUI-IDとSPEC-IDを記載し、両定義にある具体的な状態、契機、結果、失敗、回復、Authority、可視性または制約を組ごとに説明する。観点名を言い換えただけの共通文を複製しない。差異がある場合は`一致`にせず、GapとOwner工程を記録する。

## 4. 観点別レビュー

| 観点 | 結果 | 確認内容 |
|---|---|---|
| State | [結果] | [確認] |
| Interaction／Trigger | [結果] | [確認] |
| Result／Feedback | [結果] | [確認] |
| Failure／Recovery | [結果] | [確認] |
| Authority／Visibility／Constraint | [結果] | [確認] |

## 5. Gap処置

[なし／UI・SPEC・IA・UXへ戻す事項]

## 6. 補足分析

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
- [ ] 対象Definition集合のSHA-256を固定し、再レビュー入力を再構成できる
- [ ] 組別Evidenceの理由を対象UI／SPECの具体的契約事実で説明した
- [ ] 未決事項をAI推測で補完していない
