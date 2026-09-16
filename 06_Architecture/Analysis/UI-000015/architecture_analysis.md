# UI-000015のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000015`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000015 監査・変更・試験・品質の追跡](../../../04_UI/Definitions/UI-000015/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

同じ改訂版上で指摘、是正、試験、品質状態を辿れる。

### 表示面と情報の優先順位

```text
監査・変更・試験・品質の追跡
        ↓
ロードマップ項目（Roadmap Item）／変更（Change）／変更ファイル（Changed File）／改訂版（Revision）／指摘（Finding）／是正（Remediation）／試験層（Test Layer）／検証根拠（Evidence）／品質状態（Quality State）
        ↓
現在状態・不足・制限
        ↓
固定版→監査集合→統合方針→是正→再固定→判断／変更→不確実性→試験層→実行結果→現在保証／Roadmap→Change→対象ファイル→Evidence→Quality→Release
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000016 | ロードマップ項目（Roadmap Item） | 未完了の仕事 | Item ID |
| IA-000016 | 変更（Change） | 採用した変更意図 | CHG ID |
| IA-000016 | 変更ファイル（Changed File） | 変更が入ったファイル | Repository-relative Path |
| IA-000016 | 改訂版（Revision） | 確認対象の固定版 | 改訂版の識別子（Revision Identity） |
| IA-000016 | 指摘（Finding） | レビュー・監査の指摘 | 指摘の識別子（Finding Identity） |
| IA-000016 | 是正（Remediation） | 指摘への構造是正 | ChangeとFindingへ結合 |
| IA-000016 | 試験層（Test Layer） | 確認の粒度 | UT／IT／ST／UAT／RT／PT-LT |
| IA-000016 | 検証根拠（Evidence） | 実行条件と観測結果 | 改訂版（Revision）へ結合 |
| IA-000016 | 品質状態（Quality State） | 現在の保証状態 | ScopeとEvidenceから評価 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 指摘を見る／根拠を開く／次Gateへ進む。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000023 | 監査合意から是正・反証までを一つの改訂版で閉じる | 再レビューへ固定候補を渡す直前 | 合意事項と試験を全数対応させる | 一部是正や監査回数を完成と誤認する |
| UX-000026 | 試験層ごとの保証と未確認範囲を理解する | 外部境界を結合する各段階 | 開始から清掃まで段階的に反証する | 単発成功や試験件数から一連の状態変化全体を保証する |
| UX-000029 | 作業・変更・根拠・品質を役割別に辿る | 変更の影響漏れを確認する場面 | 正本を分け全影響ファイルを列挙する | 同じ説明を複製し代表ファイルだけで済ませる |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000023／IA-000016 | 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） | 固定版→監査集合→統合方針→是正→再固定→判断 |
| UX-000026／IA-000016 | 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） | 変更→不確実性→試験層→実行結果→現在保証 |
| UX-000029／IA-000016 | 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | Roadmap→Change→対象ファイル→Evidence→Quality→Release |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「ロードマップ項目（Roadmap Item）、変更（Change）、変更ファイル（Changed File）、改訂版（Revision）、指摘（Finding）、是正（Remediation）、試験層（Test Layer）、検証根拠（Evidence）、品質状態（Quality State）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [変更・監査・試験・品質の閉包のArchitecture定義](../../Definitions/ARCH-000003/architecture_definition.md) | Quality Centerと変更追跡 | UI契約はAuthorityを発行しない。利用者操作: 指摘を見る／根拠を開く／次Gateへ進む | UI契約はEffectを定義しない。表示上の状態差: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。導線: 固定版→監査集合→統合方針→是正→再固定→判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [変更・監査・試験・品質の閉包](../../Definitions/ARCH-000003/architecture_definition.md) | New | レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000020
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のUI定義だけを正式入力として処置した
- [x] 利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] Authority、Effectおよび開示境界を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] SPEC観点との統合時に確認する事項を明示した
