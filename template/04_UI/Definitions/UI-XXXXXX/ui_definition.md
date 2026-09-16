# UI-XXXXXX 利用者Interfaceの名前

成果物種別: UI定義
UI ID: `UI-XXXXXX`
状態: Candidate
維持責任者: [Owner]

## 利用者成果

[このInterfaceを通じて利用者が達成する結果を示す。]

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-XXXXXX](../../Analysis/UX-XXXXXX/ui_analysis.md) | [認識、操作、Feedback、体験差] |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-XXXXXX](../../Analysis/IA-XXXXXX/ui_analysis.md) | [対象、状態、関係、可視性、導線] |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-XXXXXX](../../Analysis/UX-XXXXXX/ui_analysis.md) | [利用者成果] | [IA-XXXXXX](../../Analysis/IA-XXXXXX/ui_analysis.md) | [必要な情報、状態、関係、導線] |

UX観点の利用者成果を、IA観点の情報構造によってどう判断可能にするかを関係ごとに示す。片側の分析だけでUIを成立させない。

```text
UX観点 ─┐
         ├─→ UI-XXXXXX
IA観点 ─┘
```

## 表示面と情報の優先順位

[対象、現在状態、重要な不足、根拠、次の行動を示す順序を定義する。IA定義で独立した対象を一つの総合状態へ畳まない。]

## 操作とFeedback

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-XXXXXX | [判断・行動] | [場面] | [Feedback] | [失敗] |

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-XXXXXX／IA-XXXXXX | [この関係に必要な状態] | [次の導線] |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明も、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

[重要度、順序、色以外の識別、キーボード操作、読上げ、端末差を示す。]

## 制約

- UIだけに正本、Authority判断、業務ロジックまたは独自状態Storeを作らない。
- 未観測、開示制限、古さ、競合または結果不明を正常・空・成功へ畳まない。

## UI／SPEC対応レビューへ渡す項目

両観点の統合内容は前節の正本を参照し、ここへ全文を再掲しない。次表は、SPECが同じUX／IAを別々に分析した後で確定すべき未決事項だけを渡す。

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-XXXXXX | IA-XXXXXX | [利用者の判断・操作と必要なFeedback] | [入力条件、成功・停止条件、観測可能な結果] |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 対応するSPEC

- pairs_with: [SPEC-XXXXXX](../../../05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md)

UIは認識・操作・Feedbackを所有し、SPECの条件・状態・結果をこの節で再定義しない。

## 未確認事項・人間判断・戻り条件

| 項目 | 現在の判断 | 不足時に戻す工程 |
|---|---|---|
| 未確認事項 | なし | UI／SPECまたはOwner工程 |
| 人間判断 | 現在のCanonical範囲では追加判断なし | 判断を所有する工程 |
| 戻り条件 | 正式入力、対応関係または成立条件に不足・競合が見つかった場合 | 不足を所有するUX／IA／UI／SPEC |

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 情報源

- [UX-XXXXXXのUI分析](../../Analysis/UX-XXXXXX/ui_analysis.md)
- [IA-XXXXXXのUI分析](../../Analysis/IA-XXXXXX/ui_analysis.md)

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] UX DefinitionとIA Definitionの分析を正式入力として処置した
- [ ] UX OutcomeとIA Information Contractを保持した
- [ ] Surface ResponsibilityとInformation Priorityを定義した
- [ ] Presentation、Interaction、Visible StateおよびFeedbackを定義した
- [ ] Error・Recovery Presentationを評価した
- [ ] AccessibilityとVariantの必要性を評価した
- [ ] Failure・Risk、ConstraintおよびNon-goalを評価した
- [ ] Human Inputの必要性を評価した
- [ ] Open・GapとOwner工程へ戻す条件を明示した
- [ ] Verification Intentを明示した
- [ ] 対応するSPECとのRelationを明示した
- [ ] Behavior Rule、Architecture方式またはSource実装を先取りしていない
- [ ] Visual ArtifactだけでContractを代替していない
- [ ] 補足定義へ必須情報を退避していない
