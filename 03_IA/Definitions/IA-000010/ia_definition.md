# IA-000010 Meeting・Topic・候補・採否

成果物種別: IA定義
IA ID: `IA-000010`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000014](../../Analysis/UX-000014/ia_analysis.md) | プロジェクト運営者／PM／Meeting後に決定・Topic・Actionを整理する時 | 会議（Meeting）、会議項目（Meeting Item）、候補（Candidate）、論点（Topic）、関係（Relation）、判断（Decision）、責任者（Owner） | 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | Meeting→Item→候補→既存Topic比較→採否→所有正本 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000014: 会議項目 | 会議項目 | Same | 候補化の元となる項目を保持する |
| UX-000014: 候補 | 候補 | Same | 採用前の情報として保持する |
| UX-000014: 論点との関係 | 関係 | Rename | 候補とTopicの接続自体を保持する |
| UX-000014: 採否判断 | 判断 | Rename | 候補の採用・却下・保留を保持する |
| UX-000014: 会議 | 会議 | Same | 会議項目が生まれた時間境界を保持する |
| UX-000014: 論点 | 論点 | Same | 会議後も継続して扱う問題または判断対象を保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000014: 会議項目 | Meeting内Identity | 会議項目 | Meeting内Identity | Same。候補化の元となる項目を保持する |
| UX-000014: 候補 | 候補（Candidate） ID | 候補 | 候補（Candidate） ID | Same。採用前の情報として保持する |
| UX-000014: 論点との関係 | 対象Identity＋関係種別で識別する | 関係 | 対象Identity＋関係種別で識別する | Rename。候補とTopicの接続として表示を明確にする |
| UX-000014: 採否判断 | 権限（Authority）と改訂版（Revision） | 判断 | 権限（Authority）と改訂版（Revision） | Rename。候補の採用・却下・保留を保持する |
| UX-000014: 会議 | Meeting IDで識別する | 会議 | Meeting ID | Same。会議項目が生まれた時間境界を保持する |
| UX-000014: 論点 | Topic IDで識別する | 論点 | Topic ID | Same。会議後も継続して扱う問題または判断対象を保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 会議（Meeting） | 時間境界を持つ対話 | Meeting ID |
| 会議項目（Meeting Item） | 会議内の観察・問い・判断候補 | Meeting内Identity |
| 候補（Candidate） | 正本更新前の提案 | 候補（Candidate） ID |
| 論点（Topic） | 継続して扱う論点 | Topic ID |
| 関係（Relation） | 同一・関連・派生等の判断 | 対象Identityと種類 |
| 判断（Decision） | 採用・却下・保留 | 権限（Authority）と改訂版（Revision） |

```text
[O: 会議（Meeting）] --含む--> [O: 会議項目（Meeting Item）]
[O: 会議項目（Meeting Item）] --生む--> [O: 候補（Candidate）]
[O: 候補（Candidate）] --比較される--> [O: 論点（Topic）]
[O: 候補（Candidate）] --分類される--> [O: 関係（Relation）]
[O: 判断（Decision）] --処置する--> [O: 候補（Candidate）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000014`: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける

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
| UX-000014 | 会議記録者がMeeting ItemとCandidateを作成し、論点正本を管理する主体がRelationを更新する | 対象の判断を確定する主体がCandidateの採用・却下・保留を確定し、記録者は自動昇格しない |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000014`: 会議記録が自動的に正本へ昇格する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000014 | 候補を採用または却下する場面 | 会議記録が自動的に正本へ昇格する | 候補・判断・反映結果を区別する |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000014 | REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000014のIA分析](../../Analysis/UX-000014/ia_analysis.md)

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
