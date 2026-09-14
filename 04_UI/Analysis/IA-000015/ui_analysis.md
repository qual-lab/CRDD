# IA-000015のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000015`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000015 準拠・改ざん有無・配布者・信頼方針](../../../03_IA/Definitions/IA-000015/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 準拠（Conformance） | CRDD契約への準拠 | 適用範囲（Profile）＋結果（Result） |
| 完全性（Integrity） | 成果物（Artifact）が改変されていない根拠 | ハッシュ（Hash）／署名確認（Signature Verification） |
| 配布者（Publisher） | 成果物（Artifact）を作成・配布した主体 | 配布者（Publisher） Identity |
| 信頼方針（Trust Policy） | 利用環境が信頼する条件 | Policy 責任者（Owner）＋改訂版（Revision） |
| 配布物（Distribution） | 評価対象の配布物 | 配布内容の基点（Content Root） |
| 品質主張（Quality Claim） | 検証済みの品質主張 | Scope＋Evidence |

UIでは「準拠（Conformance）、完全性（Integrity）、配布者（Publisher）、信頼方針（Trust Policy）、配布物（Distribution）、品質主張（Quality Claim）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000020`／実行環境の導入・運用者／実行基盤を導入または更新する時 | 準拠（Conformance）、完全性（Integrity）、配布者（Publisher）、成果物（Artifact）、信頼方針（Trust Policy）、導入（Deployment） | 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする | 成果物（Artifact）→各根拠→利用者方針→導入判断 |
| `UX-000031`／CRDD閲覧者／公式らしい入口や視覚素材を見つけた時 | 公式識別（Official Identity）、配布者（Publisher）、署名（Signature）、準拠（Conformance）、品質主張（Quality Claim） | 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 |

```text
準拠・改ざん有無・配布者・信頼方針
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

- `UX-000020`: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする
- `UX-000031`: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする

IA定義が要求する導線と責任:

- 実行環境の導入・運用者: 実行基盤を導入または更新する時に「実行環境の信頼の各要素を別々に評価する」ために必要な判断を行う。システムは「一つの署名表示を全保証と誤認する」を避けられるよう、保証要素と決定権限を分離表示する。
- CRDD閲覧者: 公式らしい入口や視覚素材を見つけた時に「識別表示と保証の根拠を分けて確認する」ために必要な判断を行う。システムは「アイコンや見た目を署名・準拠・品質保証と誤認する」を避けられるよう、識別表示と検証可能な信頼根拠を別に示す。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000013 Runtime信頼判断と公式識別](../../Definitions/UI-000013/ui_definition.md) | New | 準拠・改ざん有無・配布者・信頼方針 | この情報構造を利用者が判断できる表示へ変換する |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「準拠・改ざん有無・配布者・信頼方針」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き渡す固有の意図は「Communicationは識別表示を、署名処理（Signing）は完全性を、準拠（Conformance）／Qualityは各主張を、導入責任者（Deployment Owner）は信頼方針（Trust Policy）を所有する。」であり、利用者の目的をここで推測して先取りしない。
