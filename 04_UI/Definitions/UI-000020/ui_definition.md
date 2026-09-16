# UI-000020 実行記録の依頼と結果確認

成果物種別: UI定義
UI ID: `UI-000020`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

実行記録を作る側が、許可された事実を一度だけ記録し、成否または結果不明を見分けて安全な次の処置へ進める。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000032](../../Analysis/UX-000032/ui_analysis.md) | 記録済み・未記録・結果不明を見分け、重複や上書きなく次の処置を選べる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000022](../../Analysis/IA-000022/ui_analysis.md) | 実行、情報源、観測、記録試行、公開結果、完成記録、衝突先および回復先 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000032](../../Analysis/UX-000032/ui_analysis.md) | 実行事実を安全に記録して結果を確かめる | [IA-000022](../../Analysis/IA-000022/ui_analysis.md) | 記録対象と許可範囲を確認して一度依頼し、同じExecution IDとAttempt IDに結び付いた結果、完成記録または再観測先を返す |

```text
UX-000032 作成側の成果 ─┐
                          ├─→ UI-000020
IA-000022 記録状態と導線 ─┘
```

## 表示面と情報の優先順位

記録対象・許可範囲、記録試行、結果状態、根拠、次の行動の順に示す。`not_recorded`と`unknown`を同じ失敗表示へ畳まず、内部保存方式やLock詳細を最初の結果へ混在させない。

## 操作とFeedback

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000032 | 記録を依頼し、結果に応じて取得・修正後の再依頼・同一試行の再観測を選ぶ | 保存要求後に結果確認が途切れる時 | recorded／not_recorded／unknown、同じ実行・試行、完成記録または再観測先 | unknownを未記録と推定して再発行する |

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000032／IA-000022 | prepared／publishing／recorded／not_recorded／unknown | 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 |

## 視覚表現とアクセシビリティ

- 状態を色だけで区別せず、状態名、対象Execution、Attemptと次の行動を文字で示す。
- CLI、TypeScript API、MCPまたは将来のWorkbenchで、同じ結果状態と再観測の意味を保つ。
- Secret、生出力、不要な個人情報をFeedbackや診断へ複製しない。

## 制約

- UIだけに記録の正本、Authority判断、不変Storeまたは独自状態Storeを作らない。
- 記録AuthorityをTask実行、評価採用または別Source変更へ流用しない。
- 記録結果不明を成功、未記録または空へ畳まない。

## UI／SPEC対応レビューへ渡す項目

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000032 | IA-000022 | 記録依頼、結果状態、同じ実行・試行、完成記録または再観測先 | Effect前検査、記録Authority、不変公開、並行衝突、途中失敗、Effect不明、終了後資源 |

## 対応するSPEC

- pairs_with: [SPEC-000030](../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md)

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

- [UX-000032のUI分析](../../Analysis/UX-000032/ui_analysis.md)
- [IA-000022のUI分析](../../Analysis/IA-000022/ui_analysis.md)

## Checklist

- [x] UX DefinitionとIA Definitionの分析を正式入力として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Surface ResponsibilityとInformation Priorityを定義した
- [x] Presentation、Interaction、Visible StateおよびFeedbackを定義した
- [x] Error・Recovery Presentationを評価した
- [x] AccessibilityとVariantの必要性を評価した
- [x] Failure・Risk、ConstraintおよびNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するSPECとのRelationを明示した
- [x] Behavior Rule、Architecture方式またはSource実装を先取りしていない
- [x] Visual ArtifactだけでContractを代替していない
- [x] 補足定義へ必須情報を退避していない
