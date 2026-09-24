# UI Detail

成果物種別: UI Detail統合投影
状態: OPEN
維持責任者: Qual-Lab

## 1. 目的と移行境界

v0.21.0でCanonical化した20件のUI Definitionを、新しいUI Detail契約へ適用する現在状態を示す。

v0.21.0は当時のUI工程契約に基づいてRelease済みであり、本書の`OPEN`は過去Releaseの失敗または遡及的な非準拠を意味しない。v0.22でDetail Contractを導入するための未実施状態を表す。

```text
v0.21 UI Definition
        ↓
新しいDetail契約への適用評価
        ↓
v0.22 Discovery／UX／IA／UI・SPEC Definition
        ↓
UI Detail Pilot
```

WorkbenchのWIP、既存画面案またはSourceを本表の正解として使わない。v0.22のCanonical Definitionが成立した後に、Reality Auditの比較候補として扱う。

## 2. UI Definitionの処置

| UI ID | UI Definition | Detail適用 | UI Area | SCR／PRT／CMP | 理由／戻り条件 |
|---|---|---|---|---|---|
| `UI-000001` | 事前検査と意味レビューへの案内 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000002` | 委任・実行状態・判断 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000003` | 失敗後の再試行・回復・清掃 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000004` | Project・節目・Portfolioの状況把握 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000005` | 実行事実と故障境界の診断 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000006` | Repository内作業と対象選択 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000007` | 入口をまたぐ共通依頼・結果 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000008` | Workspace接続と利用可能範囲 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000009` | Meeting・Topic・候補の処置 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000010` | Tool・AIモデル構成の選択 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000011` | 実行時データの保持・清掃 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000012` | Agent間の情報引継ぎと再接続 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000013` | Runtime信頼判断と公式識別 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000014` | 成立済み能力と利用側の確認 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000015` | 監査・変更・試験・品質の追跡 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000016` | 外部送信の同意・持帰り・採否 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000017` | 過去情報と現在有効な意図の選択 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000018` | 文書の物語・構造・図のNavigation | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000019` | 公式素材の由来・権利・用途確認 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |
| `UI-000020` | 実行記録の依頼と結果確認 | OPEN | 未決定 | 未発行 | v0.22の対象範囲と表示面をDiscovery後に確定する |

## 3. UI AreaとScreen Inventory

現在は未作成である。v0.21の`02_Surface_and_Region_Model.md`にある表示面候補をUI Areaへ自動変換しない。UI Areaはv0.22 Discovery、UX、IAおよびUI Definitionから再導出する。

## 4. Hero-led Visual Designの現在地

| 項目 | 判定 | 内容／参照 |
|---|---|---|
| Screen Inventory | OPEN | v0.22 UI Definition後に作成する |
| Screen／Operation Flow | OPEN | Screen Inventoryと同じ対象範囲で作成する |
| Hero Screen | OPEN | Inventory／Flowより先に選定しない |
| Visual Direction比較 | OPEN | Hero選定後に複数案を探索する |
| Human Direction Decision | OPEN | Qual-Labの判断を必要とする |
| Visual Baseline | OPEN | 人間判断後に固定する |
| Secondary Screen展開 | OPEN | Baseline後に実施する |
| Pattern発見 | OPEN | 複数Screenでの反復後に評価する |
| CMP昇格判断 | OPEN | 反復根拠が得られるまで発行しない |

## 5. UI／SPEC Detail対応

現在、SCR／PRT／InteractionおよびBHVは未発行である。未発行を`N/A`やCoverage済みへ畳まない。

## 6. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| UI AreaとScreen Inventory | OPEN | UI工程Owner | Detailを開始できない | v0.22 UI Definitionの固定後 |
| Visual Direction | OPEN | Qual-Lab | Visual Baselineを固定できない | Hero候補と複数Directionの提示後 |
| SCR／PRT／CMP発行 | OPEN | UI工程Owner | Detail Relationを作れない | 発行基準をPilotで満たした時 |

## 補足分析

v0.21成果物に存在するWorkbench、CLI、MCP等の表示候補は、Detail再構成の観測材料にはできるが、v0.22の要求や正解ではない。

## Checklist

- [x] v0.21のUI Definition 20件を全数処置した
- [x] 過去Releaseの成立と新契約のOPENを区別した
- [x] WIPや既存実装をCanonical入力にしていない
- [x] UI Area、SCR、PRT、CMPを未根拠で発行していない
- [x] Hero ScreenをInventory／Flowより先に決めていない
- [x] Human Direction Decisionを未実施のまま明示した
- [x] Detail対応を未発行のままCoverage済みへ畳んでいない
- OPEN: v0.22 UI Definition固定後にArea、Screen、Part、VisualおよびComponentを作成する
