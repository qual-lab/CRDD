# IA-000023のSPEC分析

成果物種別: SPEC分析（IA観点）
分析単位: `IA-000023`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000023 標準Project Contextの情報定義](../../../03_IA/Definitions/IA-000023/ia_definition.md)

UX、UIまたはREQを直接読んで不足を補完しない。

## 2. 利用場面ごとに保持する意味

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| UX-000009 | プロジェクト運営者／PM／プロジェクト状況を確認する時 | Project Context Projection、現在事実、共有分析、期限状態 | current／conflicting／incomplete／unknown、set／not_set | 五つの観点からOwner Relation、判断、次の一手へ辿る |
| UX-000012 | 開発者／Consumerを変えて同じ情報を読む時 | Project Context Projection | 利用可能／制限／不明 | 各Consumerから同じProject Contextへ辿る |

## 3. 対象・識別・関係

Project Context Projection、現在事実、共有分析、期限状態を別対象として保持する。投影はProject ID、Repository ID、Repository Roleで範囲を定め、現在事実はOwner Relationへ、共有分析は導出元、前提、確実性、再評価条件へ結ぶ。五つの観点、不完全性、追加推論は独立Objectや独立IDにせず、投影の構成・状態・内容区分として扱う。

## 4. 状態・可視性・時間的意味

`current`、`conflicting`、`incomplete`、`unknown`を区別する。期限の`set`／`not_set`を分け、未設定時の日程リスクを`not_evaluated`とする。Repository Role内だけを投影し、範囲外Contextの存在または不存在を推測しない。Repository内正本のCurrent Projectionに限定し、項目別観測時点、CI、Runtime、Deploy先およびInfrastructureのLive状態を扱わない。

## 5. 導線・責任・失敗時の保持

Project／Repository Identityから現在地、Risk・停止、判断待ち、理由・根拠、共有分析・次の一手、不完全性へ進み、詳細はOwner Relationへ戻れるようにする。Owner Artifactが現在事実を所有し、Repositoryの投影責任が再投影する。共有分析の訂正、Risk受容、Scope・期限・Release判断は人間の決定権限を保つ。競合・欠測・判断不能でも根拠、状態および再投影の必要性を失わない。

### 制約

Consumer固有Store、Project Context固有ID、項目別観測時点またはLive状態を追加しない。画面、API、内部Model、生成方式および試験手順を確定しない。

### 下流へ保持する意味

投影、再投影、競合、五つの観点の一括取得、事実・共有分析・追加推論の識別、期限状態、Consumer同値性およびRole外非開示を観測可能な振る舞いへ変換する。

## 6. SPEC処置

| SPEC候補 | 処置 | 判断理由 |
|---|---|---|
| [SPEC-000006](../../Definitions/SPEC-000006/spec_definition.md) | Same | Project状態を固定Project Contextへ投影し、再投影・競合・五つの観点・期限状態を扱う既存責務へ統合する |
| [SPEC-000011](../../Definitions/SPEC-000011/spec_definition.md) | Same | 人間、AI、MCPおよびWorkbenchで同じProject Context結果契約を保つ既存責務へ統合する |

## 7. UX観点との統合時に確認すること

固定構造を読めるだけでなく、利用者が五つの観点を一つの回答として理解し、事実・共有分析・追加推論を取り違えず、根拠と次の行動へ進める結果にする。

## 未確認事項・人間判断・戻り条件

### 正式入力から継承する確認事項

| Source ID | 確認事項 | 判断者 | 現在の判断 | 未確認時の影響 | 再評価契機 |
|---|---|---|---|---|---|
| `IA-000023` | 物理ファイル構成、意味差分の判定方法、生成方式、機械可読構造、Consumer APIおよび実利用時の更新負担 | プロジェクト運営者／PM、開発者を代表する利用者とQual-Lab | OPEN: Workbench Pilotで確認する | 定量条件、API、Schema、内部Modelまたは自動化方式を確定しない | Workbench Pilot、Consumer間の同値性確認、または更新負担の実測時 |

### SPEC固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。Project Contextの投影と取得を同一契約で表せない、または競合・非開示・再投影判断の結果が観測できない場合はSPECを再開する。新しいObject、Identity、Relationまたは可視状態が必要な場合はIAへ戻す。

## 検証意図

期限あり／なし、Owner一致／競合、Role内／Role外、事実／共有分析／追加推論、人間／AI／MCP／Workbenchを組み合わせ、固定Markdownと取得結果の意味、Effect 0および非開示を確認できる契約へ変換する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるIA Definitionを一件だけ特定した
- [x] 利用場面、Object、Identity、Relation、State、Visibilityおよび時間的意味を保持した
- [x] 入力、条件、状態、結果および開示境界を区別した
- [x] 導線、責任、Authorityおよび失敗時に保持する意味を評価した
- [x] SPEC候補への処置と理由を明示した
- [x] UX観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとSPECまたはIAへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] UX、UI、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] 実装StateまたはUI Presentationを先取りしていない
- [x] 補足分析へ必須情報を退避していない
