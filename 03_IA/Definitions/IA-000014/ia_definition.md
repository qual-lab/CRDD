# IA-000014 受け渡す情報・Task・結果・帰還

成果物種別: IA定義
IA ID: `IA-000014`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000019](../../Analysis/UX-000019/ia_analysis.md) | 外部へ渡す情報の所有者／別Agentやツールへ仕事を渡す時、または結果を受け取る時 | 仕事用情報一式（Context Package）、情報源（Source）、改訂版（Revision）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision） | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| [UX-000021](../../Analysis/UX-000021/ia_analysis.md) | プロジェクト運営者／PM／応答喪失後に再接続する時 | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation） | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| [UX-000024](../../Analysis/UX-000024/ia_analysis.md) | 外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000019: 仕事用情報一式 | 仕事用情報一式 | Same | 委譲に必要なContextを一式として保持する |
| UX-000019: 情報源 | 情報源参照 | Rename | 本文複製ではなくSource Referenceとして表示を明確にする |
| UX-000019: 作業 | 作業 | Same | 引き渡す仕事の同一性を保持する |
| UX-000019: 結果 | 結果 | Same | 元の仕事へ戻すResultとして保持する |
| UX-000019: 選択理由 | 選択理由 | Same | 委譲先や方法を選んだ理由として保持する |
| UX-000019: 引き渡し | 引き渡し | Same | 境界をまたぐ情報と責任の移動単位を保持する |
| UX-000019: 判断 | 判断 | Same | 結果や候補の採否を元の権限へ戻す |
| UX-000021: 作業 | 作業 | Same | 引き渡す仕事の同一性を保持する |
| UX-000021: 結果 | 結果 | Same | 元の仕事へ戻すResultとして保持する |
| UX-000024: 引き渡し | 引き渡し | Same | 境界をまたぐ情報と責任の移動単位を保持する |
| UX-000024: 判断 | 判断 | Same | 結果や候補の採否を元の権限へ戻す |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000019: 仕事用情報一式 | 情報一式の識別子（Package ID） | 仕事用情報一式 | 情報一式の識別子（Package ID） | Same。委譲に必要なContextを一式として保持する |
| UX-000019: 情報源 | 情報源の識別子（Source Identity）＋改訂版（Revision） | 情報源参照 | 情報源の識別子（Source Identity）＋改訂版（Revision） | Rename。本文複製ではなくSource Referenceとして表示を明確にする |
| UX-000019: 作業 | 作業識別子（Task Identity） | 作業 | 作業識別子（Task Identity） | Same。引き渡す仕事の同一性を保持する |
| UX-000019: 結果 | Taskへ結合 | 結果 | Taskへ結合 | Same。元の仕事へ戻すResultとして保持する |
| UX-000019: 選択理由 | Package Itemへ結合 | 選択理由 | Package Itemへ結合 | Same。委譲先や方法を選んだ理由として保持する |
| UX-000019: 引き渡し | 情報源（Source）／Target Role | 引き渡し | 情報源（Source）／Target Role | Same。境界をまたぐ情報と責任の移動単位を保持する |
| UX-000019: 判断 | 責任者（Owner）と決定権限（判断を確定する権限主体）へ結ぶ | 判断 | 責任者（Owner）と決定権限（判断を確定する権限主体）へ結ぶ | Same。結果や候補の採否を元の権限へ戻す |
| UX-000021: 作業 | 作業識別子（Task Identity） | 作業 | 作業識別子（Task Identity） | Same。引き渡す仕事の同一性を保持する |
| UX-000021: 結果 | 依頼（Request）／試行（Attempt）／作業（Task）へ結合 | 結果 | 依頼（Request）／試行（Attempt）／作業（Task）へ結合 | Same。元の仕事へ戻すResultとして保持する |
| UX-000024: 引き渡し | 情報源（Source）＋送信先（Destination）＋目的（Purpose）＋対象Revision | 引き渡し | 情報源（Source）＋送信先（Destination）＋目的（Purpose）＋対象Revisionで識別し、Target Roleへ結ぶ | Same。境界をまたぐ情報と責任の移動単位を保持する |
| UX-000024: 判断 | 候補（Candidate）＋判断主体＋判断時点 | 判断 | 候補（Candidate）＋判断主体＋判断時点で識別し、責任者（Owner）と決定権限へ結ぶ | Same。候補の採否を元の権限へ戻す |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 仕事用情報一式（Context Package） | 選択した仕事用情報一式 | 情報一式の識別子（Package ID） |
| 情報源参照（Source Reference） | 出所と改訂版（Revision） | 情報源の識別子（Source Identity）＋改訂版（Revision） |
| 選択理由（Selection Reason） | 含めた理由 | Package Itemへ結合 |
| 作業（Task） | 受け渡し先の仕事 | 作業識別子（Task Identity） |
| 引き渡し（Handoff） | 役割間の移送 | 情報源（Source）／Target Role |
| 結果（Result） | Taskから戻る成果と状態 | 依頼（Request）／試行（Attempt）／作業（Task）へ結合 |
| 判断（Decision） | 結果とともに元の仕事へ戻す判断・未解決事項 | 責任者（Owner）と決定権限（判断を確定する権限主体）へ結ぶ |

```text
[O: 情報源参照（Source Reference）] --選択される--> [O: 仕事用情報一式（Context Package）]
[O: 選択理由（Selection Reason）] --含めた理由を示す--> [O: 仕事用情報一式（Context Package）]
[O: 仕事用情報一式（Context Package）] --支える--> [O: 作業（Task）]
[O: 引き渡し（Handoff）] --引き渡す--> [O: 仕事用情報一式（Context Package）]
[O: 作業（Task）] --生む--> [O: 結果（Result）]
[O: 結果（Result）] --判断・未解決事項と返す--> [O: 判断（Decision）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000019`: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）
- `UX-000021`: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）
- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

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
| UX-000019 | 送信元の仕事用情報一式・情報源参照・引渡しを作る責任がContext Package・Source Reference・Handoffを作成し、実行担当がTask Resultを返す | 委譲元のHuman／委譲元のAgent決定権限が送信範囲・委譲先・結果採用を決める |
| UX-000021 | 送信元の仕事用情報一式・情報源参照・引渡しを作る責任がContext Package・Source Reference・Handoffを作成し、実行担当がTask Resultを返す | 委譲元のHuman／委譲元のAgent決定権限が送信範囲・委譲先・結果採用を決める |
| UX-000024 | 送信元の仕事用情報一式・情報源参照・引渡しを作る責任がContext Package・Source Reference・Handoffを作成し、実行担当がTask Resultを返す | 委譲元のHuman／委譲元のAgent決定権限が送信範囲・委譲先・結果採用を決める |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000019`: 全量投入・秘密情報混入・古い仮説の現在値化
- `UX-000021`: Timeoutを未実行とみなし新規外部作用（Effect）を起こす
- `UX-000024`: 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000019 | 外部境界へ情報を出す直前 | 全量投入・秘密情報混入・古い仮説の現在値化 | 情報源・改訂版・選択理由を保持する |
| UX-000021 | 再実行するか判断する直前 | Timeoutを未実行とみなし新規外部作用（Effect）を起こす | 同一識別情報の照会を再実行より先に示す |
| UX-000024 | 外部作用（Effect）の前と結果昇格時 | 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する | 同意・投影・採用を分離する |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000019 | REQ-000017: 外部へ渡す情報の所有者が「必要な情報だけを出所付きで渡す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000021 | REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000024 | REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000019のIA分析](../../Analysis/UX-000019/ia_analysis.md)
- [UX-000021のIA分析](../../Analysis/UX-000021/ia_analysis.md)
- [UX-000024のIA分析](../../Analysis/UX-000024/ia_analysis.md)

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
