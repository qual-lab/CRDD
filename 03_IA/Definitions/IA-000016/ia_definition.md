# IA-000016 変更・指摘・是正・試験・品質

成果物種別: IA定義
IA ID: `IA-000016`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000023](../../Analysis/UX-000023/ia_analysis.md) | CRDD作成者・保守者／複数指摘を是正する時 | 改訂版（Revision）、指摘（Finding）、是正（Remediation）、Verification、判断依頼（Decision Request）、監査の組合せ（Audit Set） | 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） | 固定版→監査集合→統合方針→是正→再固定→判断 |
| [UX-000026](../../Analysis/UX-000026/ia_analysis.md) | CRDD作成者・保守者／変更の検証計画を作る時 | 試験層（Test Layer）、確認対象範囲（Target Scope）、一連の開始から終了までの根拠（Lifecycle Evidence）、実行状態（Execution State）、実行権限（Authority）、対象範囲（Coverage） | 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） | 変更→不確実性→試験層→実行結果→現在保証 |
| [UX-000029](../../Analysis/UX-000029/ia_analysis.md) | CRDD作成者・保守者／変更の現在地や根拠を調べる時 | Work、変更（Change）、変更ファイル（Changed File）、検証根拠（Evidence）、Observed 改訂版（Revision）、品質状態（Quality State） | 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | Roadmap→Change→対象ファイル→Evidence→Quality→Release |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000023: 指摘 | 指摘 | Same | 独立確認のFindingを保持する |
| UX-000023: 是正 | 是正 | Same | Findingを閉じる構造修正を保持する |
| UX-000023: 検証 | 検証根拠 | Rename | 何を確認したかと結果を持つ根拠として表示を明確にする |
| UX-000023: 現在の改訂版 | 改訂版 | Rename | 同じRevisionをCanonical表示へ揃える |
| UX-000026: 試験層 | 試験層 | Same | UT／IT／ST／UAT等の検証段階を保持する |
| UX-000029: 作業 | ロードマップ項目 | Rename | 未完了の変更単位として保持する |
| UX-000029: 変更 | 変更 | Same | 意図と構造差を持つChangeとして保持する |
| UX-000029: 変更対象ファイル | 変更ファイル | Rename | Changeの物理的影響先として保持する |
| UX-000029: 根拠 | 検証根拠 | Rename | 何を確認したかと結果を持つ根拠として表示を明確にする |
| UX-000029: 観測した改訂版 | 改訂版 | Rename | 同じRevisionをCanonical表示へ揃える |
| UX-000029: 品質状態 | 品質状態 | Same | Designed／Executed／Passed等の状態を保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000023: 指摘 | 指摘の識別子（Finding Identity） | 指摘 | 指摘の識別子（Finding Identity） | Same。独立確認のFindingを保持する |
| UX-000023: 是正 | ChangeとFindingへ結合 | 是正 | ChangeとFindingへ結合 | Same。Findingを閉じる構造修正を保持する |
| UX-000023: 検証 | 改訂版（Revision）へ結合 | 検証根拠 | 改訂版（Revision）へ結合 | Rename。何を確認したかと結果を持つ根拠として表示を明確にする |
| UX-000023: 現在の改訂版 | 改訂版の識別子（Revision Identity） | 改訂版 | 改訂版の識別子（Revision Identity） | Rename。同じRevisionをCanonical表示へ揃える |
| UX-000026: 試験層 | UT／IT／ST／UAT／RT／PT-LT | 試験層 | UT／IT／ST／UAT／RT／PT-LT | Same。UT／IT／ST／UAT等の検証段階を保持する |
| UX-000029: 作業 | Item IDで識別する | ロードマップ項目 | Item IDで識別する | Rename。未完了の変更単位として表示を明確にする |
| UX-000029: 変更 | CHG ID | 変更 | CHG ID | Same。意図と構造差を持つChangeとして保持する |
| UX-000029: 変更対象ファイル | Repository-relative Path | 変更ファイル | Repository-relative Path | Rename。Changeの物理的影響先としてCanonical表示へ揃える |
| UX-000029: 根拠 | 改訂版（Revision）へ結合 | 検証根拠 | 改訂版（Revision）へ結合 | Rename。何を確認したかと結果を持つ根拠として表示を明確にする |
| UX-000029: 観測した改訂版 | 改訂版の識別子（Revision Identity） | 改訂版 | 改訂版の識別子（Revision Identity） | Rename。同じRevisionをCanonical表示へ揃える |
| UX-000029: 品質状態 | ScopeとEvidenceから評価 | 品質状態 | ScopeとEvidenceから評価 | Same。Designed／Executed／Passed等の状態を保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

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

```text
[O: ロードマップ項目（Roadmap Item）] --実現される--> [O: 変更（Change）]
[O: 変更（Change）] --影響する--> [O: 変更ファイル（Changed File）]
[O: 改訂版（Revision）] --レビューで生む--> [O: 指摘（Finding）]
[O: 指摘（Finding）] --是正される--> [O: 是正（Remediation）]
[O: 是正（Remediation）] --検証される--> [O: 検証根拠（Evidence）]
[O: 試験層（Test Layer）] --検証の粒度を定める--> [O: 検証根拠（Evidence）]
[O: 検証根拠（Evidence）] --支える--> [O: 品質状態（Quality State）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000023`: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）
- `UX-000026`: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）
- `UX-000029`: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

現在値、古い値、履歴、不明および利用不能を、入力UXが要求する区別のまま保持する。観測不能を不存在や正常へ丸めず、状態実値を採用する場合も利用者向けの意味との対応を失わない。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 最初に利用者の判断対象、状態、判断要否を示し、識別情報と根拠は必要時に辿れるようにする。 |
| 情報のまとまり | 「利用場面」の各行にある対象・状態・根拠・次の行動を、入力UX固有の文脈として保持する。 |
| 見つけ方 | 「利用場面」の根拠・判断への導線を正とし、結果なし、判断待ち、失敗または状態不明からも根拠か安全な戻り先へ到達できるようにする。 |


### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000023 | 変更担当がRoadmap Item・Change・Changed File・Remediationを更新し、Reviewer／Quality担当がFinding・Evidence・Quality Stateを記録する | 変更Ownerが是正案を、独立ReviewerがFinding解消を、公開可否を決める主体が公開可否をそれぞれ確定する |
| UX-000026 | 変更担当がRoadmap Item・Change・Changed File・Remediationを更新し、Reviewer／Quality担当がFinding・Evidence・Quality Stateを記録する | 変更Ownerが是正案を、独立ReviewerがFinding解消を、公開可否を決める主体が公開可否をそれぞれ確定する |
| UX-000029 | 変更担当がRoadmap Item・Change・Changed File・Remediationを更新し、Reviewer／Quality担当がFinding・Evidence・Quality Stateを記録する | 変更Ownerが是正案を、独立ReviewerがFinding解消を、公開可否を決める主体が公開可否をそれぞれ確定する |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000023`: 一部是正や監査回数を完成と誤認する
- `UX-000026`: 単発成功や試験件数から一連の状態変化全体を保証する
- `UX-000029`: 同じ説明を複製し代表ファイルだけで済ませる

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000023 | 再レビューへ固定候補を渡す直前 | 一部是正や監査回数を完成と誤認する | 合意事項と試験を全数対応させる |
| UX-000026 | 外部境界を結合する各段階 | 単発成功や試験件数から一連の状態変化全体を保証する | 開始から清掃まで段階的に反証する |
| UX-000029 | 変更の影響漏れを確認する場面 | 同じ説明を複製し代表ファイルだけで済ませる | 正本を分け全影響ファイルを列挙する |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000023 | REQ-000026: CRDD作成者・保守者が「監査合意から是正・反証までを一つの改訂版で閉じる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000026 | REQ-000030: CRDD作成者・保守者が「試験層ごとの保証と未確認範囲を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000029 | REQ-000033: CRDD作成者・保守者が「作業・変更・根拠・品質を役割別に辿る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000023のIA分析](../../Analysis/UX-000023/ia_analysis.md)
- [UX-000026のIA分析](../../Analysis/UX-000026/ia_analysis.md)
- [UX-000029のIA分析](../../Analysis/UX-000029/ia_analysis.md)

## 補足分析

なし。必須情報は前節までに保持する。

## Checklist

- [x] IA定義だけで情報契約を理解できる
- [x] 全入力UXの利用者成果・場面・対象・状態・導線を保持した
- [x] 情報Objectと利用者にとっての意味を定義した
- [x] IdentityとRelationを定義した
- [x] Source Identity／RelationからCanonical Identity／Relationへの変換を明示した
- [x] 全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] StateとVisibilityを定義した
- [x] Temporal Meaningを定義した
- [x] Priority・Grouping・Findabilityを定義した
- [x] ResponsibilityとAuthorityを分けて定義した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] Failure・Risk・Constraintを定義した
- [x] Human Inputの必要性を評価した
- [x] UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] Verification Intentを明示した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceを正本としていない
- [x] 補足分析へ必須情報を退避していない
