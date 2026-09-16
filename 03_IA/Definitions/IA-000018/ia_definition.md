# IA-000018 物語・構造・図・引き渡す意図

成果物種別: IA定義
IA ID: `IA-000018`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

人が問題から判断まで理解し、工程固有の図と構造から次工程へ意図を渡す。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000027](../../Analysis/UX-000027/ia_analysis.md) | CRDD閲覧者／工程成果物を初めて読む時 | 物語（Narrative）、構造化した詳細（Structured Detail）、判断（Decision）、検証根拠（Evidence）、正本（Canonical Source） | 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別 | 問題と目的→判断→構造化詳細→根拠→次工程 |
| [UX-000028](../../Analysis/UX-000028/ia_analysis.md) | CRDD閲覧者／工程の入口・出口で成果物を渡す時 | 図（Diagram）、図の要素（Diagram Element）、上流での意味（Source Meaning）、引継ぎ義務（Handoff Obligation）、処置（Disposition） | 作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） | 上流意図→工程図→要素の意味→下流義務 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000027: 物語 | 物語 | Same | 人間が背景から結論まで理解する順序を保持する |
| UX-000027: 構造化した詳細 | 構造化した詳細 | Same | 条件・関係・比較を表や箇条書きで保持する |
| UX-000027: 判断 | 判断 | Same | 文書から導くDecisionを保持する |
| UX-000028: 図 | 図 | Same | 複数要素と関係を持つ図全体を保持する |
| UX-000028: 図の要素 | 図の要素 | Same | 凡例で識別する要素を保持する |
| UX-000028: 引継ぎ義務 | 引継ぎ義務 | Same | 後工程が図から失ってはならない意味を保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000027: 物語 | 成果物内の意味順序 | 物語 | 成果物内の意味順序 | Same。人間が背景から結論まで理解する順序を保持する |
| UX-000027: 構造化した詳細 | 物語（Narrative）へ結合 | 構造化した詳細 | 物語（Narrative）へ結合 | Same。条件・関係・比較を表や箇条書きで保持する |
| UX-000027: 判断 | 決定権限（判断を確定する権限主体）＋改訂版（Revision） | 判断 | 決定権限（判断を確定する権限主体）＋改訂版（Revision） | Same。文書から導くDecisionを保持する |
| UX-000028: 図 | 文書内の図識別子（Diagram Identity） | 図 | 文書内の図識別子（Diagram Identity）を保持し、図（Diagram） Type＋Scopeへ結ぶ | Same。複数要素と関係を持つ図全体を保持する |
| UX-000028: 図の要素 | 凡例に従う文書内識別子（Local Identity） | 図の要素 | 凡例に従う文書内識別子（Local Identity） | Same。凡例で識別する要素を保持する |
| UX-000028: 引継ぎ義務 | 情報源（Source） Contextへ結合 | 引継ぎ義務 | 情報源（Source） Contextへ結合 | Same。後工程が図から失ってはならない意味を保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 物語（Narrative） | 問題・目的・判断へ至る物語 | 成果物内の意味順序 |
| 構造化した詳細（Structured Detail） | 条件・関係・状態の構造表現 | 物語（Narrative）へ結合 |
| 図（Diagram） | 工程の関係・流れを示す投影 | 文書内の図識別子（Diagram Identity）を保持し、図（Diagram） Type＋Scopeへ結ぶ |
| 図の要素（Diagram Element） | 図中の対象・関係 | 凡例に従う文書内識別子（Local Identity） |
| 判断（Decision） | 採用した判断と理由 | 決定権限（判断を確定する権限主体）＋改訂版（Revision） |
| 引継ぎ義務（Handoff Obligation） | 次工程が失ってはならない意味 | 情報源（Source） Contextへ結合 |

```text
[O: 物語（Narrative）] --根拠となる--> [O: 構造化した詳細（Structured Detail）]
[O: 図（Diagram）] --投影する--> [O: 構造化した詳細（Structured Detail）]
[O: 図（Diagram）] --含む--> [O: 図の要素（Diagram Element）]
[O: 判断（Decision）] --作る--> [O: 引継ぎ義務（Handoff Obligation）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000027`: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別
- `UX-000028`: 作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason）

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
| UX-000027 | 成果物AuthorがNarrative・Structured Detail・Diagramを作成し、工程OwnerがHandoff Obligationを更新する | 対象Contextの対象の判断を確定する主体が意味と判断を確定し、図の見た目だけで契約を変更しない |
| UX-000028 | 成果物AuthorがNarrative・Structured Detail・Diagramを作成し、工程OwnerがHandoff Obligationを更新する | 対象Contextの対象の判断を確定する主体が意味と判断を確定し、図の見た目だけで契約を変更しない |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000027`: 確認項目順と専門語だけで文書を埋める
- `UX-000028`: 必要な図を黙って省略しAIごとに記法が変わる

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000027 | 判断理由と条件を結び付ける場面 | 確認項目順と専門語だけで文書を埋める | 物語と構造化した情報を両立する |
| UX-000028 | 下流義務へ変換する場面 | 必要な図を黙って省略しAIごとに記法が変わる | 図の意味・凡例・正本関係を固定する |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000027 | REQ-000031: CRDD作成者・保守者が「課題と判断の物語から構造化詳細へ進む」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD閲覧者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000028 | REQ-000032: CRDD作成者・保守者が「工程固有の図から状態・関係・未接続を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD閲覧者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「人が問題から判断まで理解し、工程固有の図と構造から次工程へ意図を渡す。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000027のIA分析](../../Analysis/UX-000027/ia_analysis.md)
- [UX-000028のIA分析](../../Analysis/UX-000028/ia_analysis.md)

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
