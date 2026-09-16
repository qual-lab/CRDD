# IA-000016のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000016`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000016 変更・指摘・是正・試験・品質](../../../03_IA/Definitions/IA-000016/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| ロードマップ項目（Roadmap Item） | 未完了の仕事 | Item ID |
| 変更（Change） | 採用した変更意図 | CHG ID |
| 変更ファイル（Changed File） | 変更が入ったファイル | Repository-relative Path |
| 改訂版（Revision） | 確認対象の固定版 | 改訂版の識別子（Revision Identity） |
| 指摘（Finding） | レビュー・監査の指摘 | 指摘の識別子（Finding Identity） |
| 是正（Remediation） | 指摘への構造是正 | ChangeとFindingへ結合 |
| 試験層（Test Layer） | 確認の粒度 | UT／IT／ST／UAT／RT／PT-LT |
| 検証根拠（Evidence） | 実行条件と観測結果 | 改訂版（Revision）へ結合 |
| 品質状態（Quality State） | 現在の保証状態 | ScopeとEvidenceから評価 |

UIでは「ロードマップ項目（Roadmap Item）、変更（Change）、変更ファイル（Changed File）、改訂版（Revision）、指摘（Finding）、是正（Remediation）、試験層（Test Layer）、検証根拠（Evidence）、品質状態（Quality State）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000023`／CRDD作成者・保守者／複数指摘を是正する時 | 改訂版（Revision）、指摘（Finding）、是正（Remediation）、Verification、判断依頼（Decision Request）、監査の組合せ（Audit Set） | 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） | 固定版→監査集合→統合方針→是正→再固定→判断 |
| `UX-000026`／CRDD作成者・保守者／変更の検証計画を作る時 | 試験層（Test Layer）、確認対象範囲（Target Scope）、一連の開始から終了までの根拠（Lifecycle Evidence）、実行状態（Execution State）、実行権限（Authority）、対象範囲（Coverage） | 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） | 変更→不確実性→試験層→実行結果→現在保証 |
| `UX-000029`／CRDD作成者・保守者／変更の現在地や根拠を調べる時 | Work、変更（Change）、変更ファイル（Changed File）、検証根拠（Evidence）、Observed 改訂版（Revision）、品質状態（Quality State） | 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | Roadmap→Change→対象ファイル→Evidence→Quality→Release |

```text
変更・指摘・是正・試験・品質
        ↓
対象と現在状態
        ↓
不足・制限・競合
        ↓
関係・根拠
        ↓
判断／回復／次の対象
```

内部ID、生Log、実装詳細は最初の結論へ混在させず、根拠を掘り下げる段階で示す。

## 4. 表示差と開示境界

IA定義が要求する状態区分:

- `UX-000023`: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）
- `UX-000026`: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）
- `UX-000029`: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする

IA定義が要求する導線と責任:

- CRDD作成者・保守者: 複数指摘を是正する時に「監査合意から是正・反証までを一つの改訂版で閉じる」ために必要な判断を行う。システムは「一部是正や監査回数を完成と誤認する」を避けられるよう、合意事項と試験を全数対応させる。
- CRDD作成者・保守者: 変更の検証計画を作る時に「試験層ごとの保証と未確認範囲を理解する」ために必要な判断を行う。システムは「単発成功や試験件数から一連の状態変化全体を保証する」を避けられるよう、開始から清掃まで段階的に反証する。
- CRDD作成者・保守者: 変更の現在地や根拠を調べる時に「作業・変更・根拠・品質を役割別に辿る」ために必要な判断を行う。システムは「同じ説明を複製し代表ファイルだけで済ませる」を避けられるよう、正本を分け全影響ファイルを列挙する。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000015 監査・変更・試験・品質の追跡](../../Definitions/UI-000015/ui_definition.md) | New | 変更・指摘・是正・試験・品質 | この情報構造を利用者が判断できる表示へ変換する |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「変更・指摘・是正・試験・品質」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き継ぐ固有の意味は、上表の対象・状態・関係・可視性・導線であり、利用者の目的をここで推測して先取りしない。

## 未確認事項・人間判断・戻り条件

- 未確認事項: なし。
- 人間判断: 現在のCanonical範囲では追加判断なし。
- 戻り条件: 正式入力または処置判断に不足・競合が見つかった場合は、入力を所有する工程または本分析を再開する。

## 検証意図

分析で保持した成立・境界・失敗・判断不能を、Definition側で観測可能な契約へ変換できることを確認する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるIA Definitionを一件だけ特定した
- [x] IAのObject、Identity、Relation、State、Visibilityおよび導線を保持した
- [x] 表示の優先順位とNavigationを評価した
- [x] 表示差と開示境界を評価した
- [x] UI候補への処置と理由を明示した
- [x] UX観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとUIまたはIAへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] UX、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] Behavior Ruleを先取りしていない
- [x] 補足分析へ必須情報を退避していない
