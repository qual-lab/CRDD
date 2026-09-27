# IA-000023 標準Project Contextの情報定義

成果物種別: IA定義
IA ID: `IA-000023`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

Repositoryの現在状態を一つのProject Contextから理解しつつ、正本から得た現在事実、複数事実から導いた共有分析、対話時だけ行う追加推論、根拠、不完全性および人間判断を取り違えないようにする。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000009](../../Analysis/UX-000009/ia_analysis.md) | プロジェクト運営者／PM／プロジェクト状況を確認する時 | Project Context Projection、現在事実、共有分析、期限状態 | current／conflicting／incomplete／unknown、期限のset／not_set | Project Context→五つの観点→Owner Relation／判断／次の一手 |
| [UX-000012](../../Analysis/UX-000012/ia_analysis.md) | 開発者／人間・AI・MCP・Workbenchの入口を変えて同じ情報を読む時 | Project Context Projection | 利用可能／制限／不明 | Consumer→同じProject Context→同じ範囲・根拠・不完全性 |

複数UXを統合しても、Project状態を判断する場面と、入口間で同じ情報を読む場面を同一の操作へ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000009: Project Context | Project Context Projection | Rename | Repository内の固定Markdown投影として定義する |
| UX-000009: 現在事実 | 現在事実 | Same | Owner Artifactから決定論的に得る情報を保持する |
| UX-000009: 共有分析 | 共有分析 | Same | 複数の現在事実から導く分析を保持する |
| UX-000009: 期限状態 | 期限状態 | Same | Version期限とRoadmap項目期限の設定有無を独立して保持する |
| UX-000012: Project Context | Project Context Projection | Same | Consumerを変えても同じ情報構造を利用する |
| UX-000034: Project Context Projection | Project Context Projection | Same | Workbenchでも五場面と不完全性を保持する |
| UX-000034: Owner情報 | 現在事実 | Merge | Owner Relationへ戻れる現在事実として統合する |
| UX-000034: 次の仕事 | 共有分析 | Merge | 根拠・前提付きの次の一手候補として統合する |

正式入力から導けないObjectは追加しない。五つの観点、不完全性および追加推論は、上記Objectを読むための構成・状態・内容区分であり、独立Objectまたは独立IDにしない。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000009: Project Context | Project ID＋Repository ID＋Repository Roleで範囲を定め、内容項目には重複IDを発行しない | Project Context Projection | Project ID＋Repository ID＋Repository Roleで範囲を定め、各Owner Relationへ結ぶ | Rename。固定MarkdownというCanonicalな投影単位を明確にする |
| UX-000009: 現在事実 | Owner Artifact IDまたは正本Relationへ結び、内容を第二の正本にしない | 現在事実 | Owner Artifact IDまたは正本Relationへ結び、Project Contextを第二の正本にしない | Same。事実の所有者を維持する |
| UX-000009: 共有分析 | 導出元、前提、確実性、再評価条件で識別し、継続管理が必要ならOwner Artifactへ昇格する | 共有分析 | 導出元、前提、確実性、再評価条件へ結び、固有IDを発行しない | Same。分析の根拠と暫定性を維持する |
| UX-000009: 期限状態 | 二つを独立して扱い、未設定時の日程リスクは未評価とする | 期限状態 | Version期限とRoadmap項目期限の設定状態を別々に保持する | Same。未設定をRiskなしへ畳まない |
| UX-000012: Project Context | Project ID＋Repository ID＋Repository Roleで範囲を定め、固定見出し・表・統制語彙を共有する | Project Context Projection | 同じRepository投影を人間、AI、MCPおよびWorkbenchが利用する | Rename。Consumer固有Storeを作らない |
| UX-000034: Project Context Projection | Project ID＋Repository ID＋Repository Role | Project Context Projection | Project ID＋Repository ID＋Repository Roleで範囲を定める | Same。Workbenchでも同じ投影を利用する |
| UX-000034: Owner情報 | Owner Artifact ID／Relation | 現在事実 | Owner Artifact IDまたは正本Relationへ戻る | Merge。投影からOwnerへ戻る事実として保持する |
| UX-000034: 次の仕事 | Owner Relationと現在状態に結合 | 共有分析 | 導出元、前提、確実性および再評価条件へ結ぶ | Merge。次の一手を共有分析として保持する |

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| Project Context Projection | Repositoryが現在の正本から投影する、人間可読かつ機械可読なMarkdown | Project ID＋Repository ID＋Repository Roleで範囲を定める |
| 現在事実 | Owner Artifactから決定論的に得た現在の結論・要約 | Owner Artifact IDまたは正本Relationへ戻る |
| 共有分析 | 複数の現在事実から導いたRisk、本質的課題、依存、放置時の影響および選択肢 | 導出元、前提、確実性および再評価条件へ結ぶ |
| 期限状態 | Version期限とRoadmap項目期限の設定状態 | 二つを独立して扱う |

```text
[O: Project Context Projection]
          ├─ 正本から投影 ─▶ [O: 現在事実] ─▶ [補足: Owner Relation]
          ├─ 根拠から導出 ─▶ [O: 共有分析] ─▶ [補足: 前提／確実性／再評価条件]
          └─ 日程判断に使う ▶ [O: 期限状態]

[状態: 不完全性] ──現在値の断定を制約──▶ [O: Project Context Projection]
[補足: 追加推論] ──対話時だけ区別して提示──▶ [O: Project Context Projection]
```

## 状態・可視性・時間的な意味

`current`、`conflicting`、`incomplete`、`unknown`を区別する。Owner Artifactと競合する投影を現在値として扱わない。期限は`set`／`not_set`を区別し、`not_set`では日程リスクを`not_evaluated`とする。Repository Roleが示す範囲内だけを表示し、範囲外Contextの存在または不存在をRepository Projectionから推測しない。Repository内正本のCurrent Projectionであり、項目別観測時点、CI、Runtime、Deploy先およびInfrastructureのLive状態を持たない。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 現在地、Risk・停止、判断待ち、理由・根拠、次の一手の順に結論を先に示し、詳細はOwner Relationへ辿れるようにする |
| 情報のまとまり | 五つの観点を一つのProject Statusとして回答するが、各内容へ独立して辿れるようにする |
| 見つけ方 | Project／Repository Identity→現在地→Risk・停止→判断待ち→根拠→共有分析・次の一手→不完全性 |

### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000009 | Owner Artifactが現在事実を保ち、Repositoryの投影責任がProject Contextを再投影する | Risk受容、Scope変更、期限変更、Release判断は人間の決定権限者が行う |
| UX-000012 | 各Consumerが同じProject Contextを意味を変えずに提示する | Repository RoleとPrincipalの権限を確定する主体が開示範囲を決める |
| UX-000034 | Ownerが現在事実を保ち、投影責任が五場面と次の一手候補を提供する | 利用者が次の仕事を選び、Ownerが意味と状態を確定する |

共有分析はAIが根拠・前提・確実性・再評価条件付きで整理し、人間が違和感を訂正する。訂正がないことを承認とみなさない。継続管理が必要な分析はCHG、Topic、Decision、Qualityその他のOwner Artifactへ昇格し、Project Context内に独自の安定IDを作らない。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000009`: 欠測や正本変更の未反映を完全な現在値と誤認する
- `UX-000012`: Consumerごとに異なるStoreや意味を持ち、同じRepositoryについて異なる回答を返す

### 制約・対象外

具体的な画面、Route、JSON Schema、MCP Result、生成実装および内部Modelは本定義で確定しない。外部のLive状態、Runtime、Deploy先およびInfrastructure Healthを管理しない。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000009 | Projectの現在状態を信じ、次の判断へ進む直前 | 欠測や未反映を完全な現在値と誤認する | 五つの観点、根拠、不完全性および期限状態を同じ文脈で理解できる |
| UX-000012 | 人間、AI、MCPまたはWorkbenchへ入口を切り替える時 | Consumerごとに範囲・根拠・分析の意味が変わる | 同じRepository投影から同じ意味を再構成できる |
| UX-000034 | Projectの状況から次の仕事を選ぶ時 | 横断要約を完全なProject状態または保存済み事実と誤認する | 結論からOwnerと作業対象へ戻れる |

固定Markdownから五つの観点を再構成できること、期限あり／なし、正本一致／競合、Role内／Role外およびConsumer間同値性を確認する。具体的な試験項目はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000009 | Project Contextの実利用時の理解負担、更新負担および五つの観点の十分性 | プロジェクト運営者／PMを代表する利用者とQual-Lab | 後続の実利用確認が必要 | 定量的な更新頻度、表示量または自動化方式を確定しない |
| UX-000012 | 各Consumerで同じ意味を再構成できるか | 開発者を代表する利用者とQual-Lab | Workbench Pilotで確認する | Consumer API、機械可読Schemaまたは内部Modelを確定しない |
| UX-000034 | 役割別情報量と既存Toolとの比較価値 | 開発者、Project運営者／PMおよびQual-Lab | 後続確認が必要 | Screen、Visual、常時表示および性能条件を確定しない |

IA固有の追加人間判断はない。五つの観点を同じ構造で表せない、項目別IDや観測時点がないと成立しない、またはConsumerごとに異なる情報正本が必要と判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 五つの観点の優先度、事実・分析・提案の識別、不完全性、Owner RelationおよびRepository Roleの可視境界 |
| SPEC（UX＋IAの正式入力） | 投影、再投影、競合、固定構造の読取り、Consumer同値性および非開示の成立条件 |
| Quality Analysis / IA（伴走） | 固定Markdownからの再構成、期限あり／なし、正本競合、Role外非開示およびConsumer間同値性 |

ArchitectureやSourceへ直接引き渡さない。

## 情報源

- [UX-000009のIA分析](../../Analysis/UX-000009/ia_analysis.md)
- [UX-000012のIA分析](../../Analysis/UX-000012/ia_analysis.md)
- [UX-000034のIA分析](../../Analysis/UX-000034/ia_analysis.md)

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
