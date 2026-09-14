# IA-000015 準拠・改ざん有無・配布者・信頼方針

成果物種別: IA定義
IA ID: `IA-000015`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000020](../../Analysis/UX-000020/ia_analysis.md) | 実行環境の導入・運用者／実行基盤を導入または更新する時 | 準拠（Conformance）、完全性（Integrity）、配布者（Publisher）、成果物（Artifact）、信頼方針（Trust Policy）、導入（Deployment） | 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする | 成果物（Artifact）→各根拠→利用者方針→導入判断 |
| [UX-000031](../../Analysis/UX-000031/ia_analysis.md) | CRDD閲覧者／公式らしい入口や視覚素材を見つけた時 | 公式識別（Official Identity）、配布者（Publisher）、署名（Signature）、準拠（Conformance）、品質主張（Quality Claim） | 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 準拠（Conformance） | CRDD契約への準拠 | 適用範囲（Profile）＋結果（Result） |
| 完全性（Integrity） | 成果物（Artifact）が改変されていない根拠 | ハッシュ（Hash）／署名確認（Signature Verification） |
| 配布者（Publisher） | 成果物（Artifact）を作成・配布した主体 | 配布者（Publisher） Identity |
| 信頼方針（Trust Policy） | 利用環境が信頼する条件 | Policy 責任者（Owner）＋改訂版（Revision） |
| 配布物（Distribution） | 評価対象の配布物 | 配布内容の基点（Content Root） |
| 品質主張（Quality Claim） | 検証済みの品質主張 | Scope＋Evidence |

```text
[O: 配布物（Distribution）] --持つ--> [O: 準拠（Conformance）]
[O: 配布物（Distribution）] --持つ--> [O: 完全性（Integrity）]
[O: 配布物（Distribution）] --配布される--> [O: 配布者（Publisher）]
[O: 信頼方針（Trust Policy）] --評価する--> [O: 配布物（Distribution）]
[O: 品質主張（Quality Claim）] --根拠となる--> [O: 根拠（Evidence）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000020`: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする
- `UX-000031`: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- 実行環境の導入・運用者: 実行基盤を導入または更新する時に「実行環境の信頼の各要素を別々に評価する」ために必要な判断を行う。システムは「一つの署名表示を全保証と誤認する」を避けられるよう、保証要素と決定権限を分離表示する。
- CRDD閲覧者: 公式らしい入口や視覚素材を見つけた時に「識別表示と保証の根拠を分けて確認する」ために必要な判断を行う。システムは「アイコンや見た目を署名・準拠・品質保証と誤認する」を避けられるよう、識別表示と検証可能な信頼根拠を別に示す。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

Communicationは識別表示を、署名処理（Signing）は完全性を、準拠（Conformance）／Qualityは各主張を、導入責任者（Deployment Owner）は信頼方針（Trust Policy）を所有する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000020のIA分析](../../Analysis/UX-000020/ia_analysis.md)
- [UX-000031のIA分析](../../Analysis/UX-000031/ia_analysis.md)
