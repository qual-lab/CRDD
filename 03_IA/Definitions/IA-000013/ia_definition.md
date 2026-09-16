# IA-000013 AIモデル構成・選択・再選定

成果物種別: IA定義
IA ID: `IA-000013`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000018](../../Analysis/UX-000018/ia_analysis.md) | 実行環境の導入・運用者／利用モデルやAI提供元条件を変更する時 | AIモデル（Model）、構成（Configuration）、作業上の役割（Task Role）、利用可否（Availability）、選択結果（Selection）、Reason、再選定条件（Fallback Condition） | 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | 設定→検証→利用可能候補→選択→理由・再選定条件 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000018: AIモデル | AIモデル | Same | 選択対象となるModelを保持する |
| UX-000018: モデル構成 | 構成 | Rename | コード外で更新できるConfigurationとして保持する |
| UX-000018: 利用可否 | 利用可否 | Same | 現在利用できるかを構成と分ける |
| UX-000018: 選択結果 | 選択結果 | Same | 選んだModelを表す判断結果を保持する |
| UX-000018: 再選定条件 | 再選定条件 | Same | Availability等が変わった時の切替条件を保持する |
| UX-000018: 作業上の役割 | 作業上の役割 | Same | Executor／Reviewer等の選択文脈を保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000018: AIモデル | Provider＋Model ID | AIモデル | Provider＋Model ID | Same。選択対象となるModelを保持する |
| UX-000018: モデル構成 | 構成の改訂版（Config Revision） | 構成 | 構成の改訂版（Config Revision） | Rename。コード外で更新できるConfigurationとして保持する |
| UX-000018: 利用可否 | Model＋Environment | 利用可否 | Model＋Environment | Same。現在利用できるかを構成と分ける |
| UX-000018: 選択結果 | Task＋Model | 選択結果 | Task＋Model | Same。選んだModelを表す判断結果を保持する |
| UX-000018: 再選定条件 | 選択結果（Selection）へ結合 | 再選定条件 | 選択結果（Selection）へ結合 | Same。Availability等が変わった時の切替条件を保持する |
| UX-000018: 作業上の役割 | Task Roleで識別する | 作業上の役割 | Task Roleで識別し、対象Taskへ結合する | Same。Executor／Reviewer等の選択文脈を保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| AIモデル（Model） | 利用候補のAIモデル | Provider＋Model ID |
| 構成（Configuration） | 許可候補と制約 | 構成の改訂版（Config Revision） |
| 作業上の役割（Task Role） | 実行・確認等の必要役割 | Task Roleで識別し、対象Taskへ結合する |
| 利用可否（Availability） | 現在利用可能か | Model＋Environment |
| 選択結果（Selection） | 今回の実効選択 | Task＋Model |
| 再選定条件（Fallback Condition） | 再選定する条件 | 選択結果（Selection）へ結合 |

```text
[O: 構成（Configuration）] --宣言する--> [O: AIモデル（Model）]
[O: AIモデル（Model）] --持つ--> [O: 利用可否（Availability）]
[O: 作業上の役割（Task Role）] --充足される--> [O: 選択結果（Selection）]
[O: 選択結果（Selection）] --選ぶ--> [O: AIモデル（Model）]
[O: 選択結果（Selection）] --条件で変わる--> [O: 再選定条件（Fallback Condition）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000018`: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）

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
| UX-000018 | AIモデル構成を管理する主体がModel・Configuration・Task Roleを保ち、利用可否と選択結果を記録する責任がAvailabilityとSelectionを記録する | 導入環境の信頼方針を決める主体が許可Model集合を、許可範囲内でモデルを選択・再選定する責任が許可範囲内の選択・再選定を決める |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000018`: 未知または非対応のモデルを実行可能と表示する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000018 | AI提供元で実行する前のモデル確定 | 未知または非対応のモデルを実行可能と表示する | 構成変更を検証し実効選択を観測可能にする |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000018 | REQ-000016: 実行環境の導入・運用者が「AIモデル選択を検証可能な構成として更新する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000018のIA分析](../../Analysis/UX-000018/ia_analysis.md)

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
