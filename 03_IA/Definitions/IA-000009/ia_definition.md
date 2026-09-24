# IA-000009 接続資格・作業領域・公開範囲

成果物種別: IA定義
IA ID: `IA-000009`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000013](../../Analysis/UX-000013/ia_analysis.md) | プロジェクト運営者／PM／リモート接続を開始・再接続する時 | 接続資格、接続中の作業単位（Session）、利用可能領域（Workspace Grant）、公開関係（Exposure）、リポジトリの利用可否、管理能力（System Capability） | 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） | 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000013: 接続資格 | 接続資格 | Same | 接続を認証する資格として保持する |
| UX-000013: 接続中の作業単位 | 接続中の作業単位 | Same | 一回の認証済みSessionとして保持する |
| UX-000013: システム管理能力 | 管理能力 | Rename | 内容閲覧Grantとは別のServer管理能力として保持する |
| UX-000013: 利用可能領域 | 利用可能領域 | Same | Sessionに発行されたWorkspace集合として保持する |
| UX-000013: 作業領域 | 作業領域 | Same | Repositoryを公開する論理的まとまりとして保持する |
| UX-000013: 公開関係 | 公開関係 | Same | WorkspaceとRepositoryの公開関係として保持する |
| UX-000013: リポジトリ | リポジトリ | Same | 現在の接続で利用可否を判断する正本境界として保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000013: 接続資格 | 接続資格識別子（Credential ID） | 接続資格 | 接続資格識別子（Credential ID） | Same。接続を認証する資格として保持する |
| UX-000013: 接続中の作業単位 | 接続単位識別子（Session ID） | 接続中の作業単位 | 接続単位識別子（Session ID） | Same。一回の認証済みSessionとして保持する |
| UX-000013: システム管理能力 | 接続中の作業単位（Session）へ別途結合 | 管理能力 | 接続中の作業単位（Session）へ別途結合 | Rename。内容閲覧Grantとは別のServer管理能力として保持する |
| UX-000013: 利用可能領域 | Session IDとWorkspace IDの組で識別する | 利用可能領域 | Session IDとWorkspace IDの組で識別する | Same。Sessionに発行されたWorkspace集合として保持する |
| UX-000013: 作業領域 | Workspace IDで識別する | 作業領域 | 作業領域識別子（Workspace ID） | Same。Repositoryを公開する論理的まとまりとして保持する |
| UX-000013: 公開関係 | Workspace IDとRepository IDの組で識別する | 公開関係 | Workspace＋Repository | Same。WorkspaceとRepositoryの公開関係として保持する |
| UX-000013: リポジトリ | Repository IDで識別する | リポジトリ | Repository ID | Same。現在の接続で利用可否を判断する正本境界として保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 接続資格（Connection Credential） | 接続を認証する資格 | 接続資格識別子（Credential ID） |
| 接続中の作業単位（Session） | 一回の接続文脈 | 接続単位識別子（Session ID） |
| 利用可能領域（Workspace Grant） | 接続中の作業単位（Session）が利用できる作業領域集合 | Session IDとWorkspace IDの組で識別する |
| 作業領域（Workspace） | Repository公開のまとまり | 作業領域識別子（Workspace ID） |
| 公開関係（Exposure） | RepositoryをWorkspaceへ公開する関係 | Workspace＋Repository |
| リポジトリ（Repository） | 公開関係の先にある正本境界 | Repository ID |
| 管理能力（System Capability） | サーバー（Server）の管理能力 | 接続中の作業単位（Session）へ別途結合 |

```text
[O: 接続資格（Credential）] --作る--> [O: 接続中の作業単位（Session）]
[O: 接続中の作業単位（Session）] --持つ--> [O: 利用可能領域（Workspace Grant）]
[O: 利用可能領域（Workspace Grant）] --利用を許す--> [O: 作業領域（Workspace）]
[O: 作業領域（Workspace）] --公開関係を持つ--> [O: 公開関係（Exposure）]
[O: 公開関係（Exposure）] --公開対象を結ぶ--> [O: リポジトリ（Repository）]
[O: 接続中の作業単位（Session）] --持つ場合がある--> [O: 管理能力（System Capability）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000013`: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）

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
| UX-000013 | Credential・Workspace・Exposure・System Capabilityを構成する責任と、Session・Workspace Grantを発行する責任を分ける | Repository正本を管理する主体がExposureを、CROS接続設定を管理する主体がCredential Grantを、利用者がSession内の次行動を決める |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000013`: 利用不能なリポジトリの存在や内容を推測表示する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000013 | 利用可能情報を表示する時 | 利用不能なリポジトリの存在や内容を推測表示する | 現在の利用許可範囲（Grant）だけを開示し不足を補完しない |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000013のIA分析](../../Analysis/UX-000013/ia_analysis.md)

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
