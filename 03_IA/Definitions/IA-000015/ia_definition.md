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

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000020: 準拠状況 | 準拠 | Rename | Contractへの適合という同じ意味をCanonical表示へ揃える |
| UX-000020: 改ざん有無 | 完全性 | Rename | Artifactが改変されていないという同じ意味をCanonical表示へ揃える |
| UX-000020: 配布者 | 配布者 | Same | 誰がArtifactを出したかを保持する |
| UX-000020: 信頼方針 | 信頼方針 | Same | 利用環境が所有するTrust Policyを保持する |
| UX-000020: 配布物 | 配布物 | Same | 評価対象となるArtifactを保持する |
| UX-000031: 配布物 | 配布物 | Same | 評価対象となるArtifactを保持する |
| UX-000031: 配布者 | 配布者 | Same | 誰がArtifactを出したかを保持する |
| UX-000031: 署名確認 | 完全性 | Rename | Artifactが改変されていないという同じ意味をCanonical表示へ揃える |
| UX-000031: 準拠状況 | 準拠 | Rename | Contractへの適合という同じ意味をCanonical表示へ揃える |
| UX-000031: 品質上の主張 | 品質主張 | Same | 準拠・完全性・公式性から独立して保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000020: 準拠状況 | 適用範囲（Profile）＋結果（Result） | 準拠 | 適用範囲（Profile）＋結果（Result） | Rename。Contractへの適合という同じ意味をCanonical表示へ揃える |
| UX-000020: 改ざん有無 | Artifact Identity・改訂版・確認時点へ結ぶ | 完全性 | Artifact Identity・改訂版・確認時点へ結び、ハッシュ（Hash）／署名確認（Signature Verification）を根拠として持つ | Rename。ArtifactとのRelationを失わずCanonical表示へ揃える |
| UX-000020: 配布者 | 配布者（Publisher） Identity | 配布者 | 配布者（Publisher） Identity | Same。誰がArtifactを出したかを保持する |
| UX-000020: 信頼方針 | Policy 責任者（Owner）＋改訂版（Revision） | 信頼方針 | Policy 責任者（Owner）＋改訂版（Revision） | Same。利用環境が所有するTrust Policyを保持する |
| UX-000020: 配布物 | Artifact IdentityとRevisionで識別する | 配布物 | Artifact IdentityとRevisionで識別し、配布内容の基点（Content Root）を追加Relationとして持つ | Same。評価対象となるArtifactのIdentityを失わない |
| UX-000031: 配布物 | Artifact IdentityとRevisionで識別する | 配布物 | Artifact IdentityとRevisionで識別し、配布内容の基点（Content Root）を追加Relationとして持つ | Same。評価対象となるArtifactのIdentityを失わない |
| UX-000031: 配布者 | 配布者（Publisher） Identity | 配布者 | 配布者（Publisher） Identity | Same。誰がArtifactを出したかを保持する |
| UX-000031: 署名確認 | Artifact Identity・署名・確認時点へ結ぶ | 完全性 | Artifact Identity・署名・確認時点へ結び、ハッシュ（Hash）／署名確認（Signature Verification）を根拠として持つ | Rename。ArtifactとのRelationを失わずCanonical表示へ揃える |
| UX-000031: 準拠状況 | 適用範囲（Profile）＋結果（Result） | 準拠 | 適用範囲（Profile）＋結果（Result） | Rename。Contractへの適合という同じ意味をCanonical表示へ揃える |
| UX-000031: 品質上の主張 | 対象、判定時点、情報源で識別し、不明を正常へ丸めない | 品質主張 | 対象、判定時点、情報源で識別し、Scope＋Evidenceを保持する | Same。準拠・完全性・公式性から独立して保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 準拠（Conformance） | CRDD契約への準拠 | 適用範囲（Profile）＋結果（Result） |
| 完全性（Integrity） | 成果物（Artifact）が改変されていない根拠 | Artifact Identity・改訂版または署名・確認時点へ結び、ハッシュ（Hash）／署名確認（Signature Verification）を根拠として持つ |
| 配布者（Publisher） | 成果物（Artifact）を作成・配布した主体 | 配布者（Publisher） Identity |
| 信頼方針（Trust Policy） | 利用環境が信頼する条件 | Policy 責任者（Owner）＋改訂版（Revision） |
| 配布物（Distribution） | 評価対象の配布物 | Artifact IdentityとRevisionで識別し、配布内容の基点（Content Root）を追加Relationとして持つ |
| 品質主張（Quality Claim） | 検証済みの品質主張 | 対象、判定時点、情報源で識別し、Scope＋Evidenceを保持する |

```text
[O: 配布物（Distribution）] --持つ--> [O: 準拠（Conformance）]
[O: 配布物（Distribution）] --持つ--> [O: 完全性（Integrity）]
[O: 配布物（Distribution）] --配布される--> [O: 配布者（Publisher）]
[O: 信頼方針（Trust Policy）] --評価する--> [O: 配布物（Distribution）]
[O: 品質主張（Quality Claim）] --根拠を持つ--> [補足: 検証根拠（Evidence）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000020`: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする
- `UX-000031`: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする

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
| UX-000020 | 配布物・署名・配布者Identityを提供する責任と、準拠・品質の評価結果を記録する責任を分ける | 導入環境の信頼方針を決める主体がTrust Policyと利用可否を決め、Publisherの署名だけで信頼を強制しない |
| UX-000031 | 配布物・署名・配布者Identityを提供する責任と、準拠・品質の評価結果を記録する責任を分ける | 導入環境の信頼方針を決める主体がTrust Policyと利用可否を決め、Publisherの署名だけで信頼を強制しない |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000020`: 一つの署名表示を全保証と誤認する
- `UX-000031`: アイコンや見た目を署名・準拠・品質保証と誤認する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000020 | 実行を信頼すると判断する場面 | 一つの署名表示を全保証と誤認する | 保証要素と決定権限を分離表示する |
| UX-000031 | 公式表示を信頼判断へ用いる直前 | アイコンや見た目を署名・準拠・品質保証と誤認する | 識別表示と検証可能な信頼根拠を別に示す |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000020 | REQ-000018: 実行環境の導入・運用者が「実行環境の信頼の各要素を別々に評価する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000025: 実行環境の導入・運用者が「信頼する配布者と手元例外を自分で定める」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000031 | REQ-000035: 識別表示が入口発見を助けながら信頼誤認を増やさないか、権利情報の許容確認負担 | CRDD閲覧者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000020のIA分析](../../Analysis/UX-000020/ia_analysis.md)
- [UX-000031のIA分析](../../Analysis/UX-000031/ia_analysis.md)

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
