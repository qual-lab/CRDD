# UI-000013のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000013`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000013 Runtime信頼判断と公式識別](../../../04_UI/Definitions/UI-000013/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

配布元、改ざん有無、準拠、利用者の信頼方針を分けて判断できる。

### 表示面と情報の優先順位

```text
Runtime信頼判断と公式識別
        ↓
準拠（Conformance）／完全性（Integrity）／配布者（Publisher）／信頼方針（Trust Policy）／配布物（Distribution）／品質主張（Quality Claim）
        ↓
現在状態・不足・制限
        ↓
成果物（Artifact）→各根拠→利用者方針→導入判断／公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000015 | 準拠（Conformance） | CRDD契約への準拠 | 適用範囲（Profile）＋結果（Result） |
| IA-000015 | 完全性（Integrity） | 成果物（Artifact）が改変されていない根拠 | ハッシュ（Hash）／署名確認（Signature Verification） |
| IA-000015 | 配布者（Publisher） | 成果物（Artifact）を作成・配布した主体 | 配布者（Publisher） Identity |
| IA-000015 | 信頼方針（Trust Policy） | 利用環境が信頼する条件 | Policy 責任者（Owner）＋改訂版（Revision） |
| IA-000015 | 配布物（Distribution） | 評価対象の配布物 | 配布内容の基点（Content Root） |
| IA-000015 | 品質主張（Quality Claim） | 検証済みの品質主張 | Scope＋Evidence |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 検証する／信頼方針を選ぶ／詳細を見る。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000020 | 実行環境の信頼の各要素を別々に評価する | 実行を信頼すると判断する場面 | 保証要素と決定権限を分離表示する | 一つの署名表示を全保証と誤認する |
| UX-000031 | 識別表示と保証の根拠を分けて確認する | 公式表示を信頼判断へ用いる直前 | 識別表示と検証可能な信頼根拠を別に示す | アイコンや見た目を署名・準拠・品質保証と誤認する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000020／IA-000015 | 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする | 成果物（Artifact）→各根拠→利用者方針→導入判断 |
| UX-000031／IA-000015 | 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「準拠（Conformance）、完全性（Integrity）、配布者（Publisher）、信頼方針（Trust Policy）、配布物（Distribution）、品質主張（Quality Claim）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

### 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Runtime Artifactの信頼評価のArchitecture定義](../../Definitions/ARCH-000014/architecture_definition.md) | Runtime Trust Evaluator | UI契約はAuthorityを発行しない。利用者操作: 検証する／信頼方針を選ぶ／詳細を見る | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。導線: 成果物（Artifact）→各根拠→利用者方針→導入判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Runtime Artifactの信頼評価](../../Definitions/ARCH-000014/architecture_definition.md) | New | verified／trusted／quality_assuredを別軸にし、Qual-Lab署名を実行資格へ集約しない。Forkや企業署名、許可されたLocal unsignedを利用者所有Policyで評価する。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000018
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
