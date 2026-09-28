# Phase 5 — Runtime Activity接続

検証日時: 2026-09-27 23:03 JST
対象変更: `CHG-000082`

## 1. 結論

WorkbenchへProject Runtime状態のApplication PortとRuntime Activity Panelを追加した。WorkbenchはRuntime正本を保存せず、注入された現在投影だけを表示する。

次の状態は同一視しない。

| 状態 | 表示 |
|---|---|
| Application未接続 | `Not connected`。Objectiveなしとは判断しない |
| 現在状態なし | `Absent`。理由を表示する |
| 観測不能またはPort失敗 | `Unknown`。直前値をCurrentとして表示しない |
| 観測済み | Milestone、Objective／Task件数、判断待ち、Recovery、品質状態および次処置を表示する |

## 2. 変更した境界

```text
Project Runtime State Query Adapter
                │ current projection only
                v
WorkbenchRuntimeActivityApplication
                │
                v
Runtime Activity Panel
```

- Workbench独自のObjective、Task、状態遷移、Recovery Identityを作らない。
- Recovery Authority、Credential、Host Pathまたは任意Runtime内部値を表示契約へ含めない。
- Project Contextの文章からRuntime状態を推測しない。
- 未接続を空状態または正常終了へ畳まない。

## 3. 検証結果

実行:

```text
cd 40_Develop/workbench
npm test
```

結果:

- Format: Pass
- Type Check: Pass
- Lint: Pass
- Workbench Integration: 15 / 15 Pass
- 外部Provider Effect: 0
- Repository外Effect: 0

追加した直接境界試験では、注入したMilestone、Objective／Task件数、人間判断および次処置が表示され、未接続表示が残らないことを確認した。

## 4. 残る範囲

本変更で画面候補10をMissingからPartialへ進めた。実際のRepository／CROS Composition RootからProject Runtime State Query Adapterを注入する接続、継続読込、再接続およびEvent重複・欠落の扱いは未成立である。

## Checklist

- [x] 公開Application Portとして境界を分離した。
- [x] 未接続、状態なし、観測不能および観測済みを分けた。
- [x] WorkbenchにRuntime正本を追加していない。
- [x] Runtime状態をProject Contextから推測していない。
- [x] Format、Type、Lint、Integration Testを通した。
- [x] 残るCompositionとEvent境界を明示した。
