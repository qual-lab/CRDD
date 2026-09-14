# UX-000003 委任中の状態と判断要否を理解する

成果物種別: UX Definition
UX ID: `UX-000003`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

内部logを読まず、実行中・待機・停止と現在必要な判断を理解できる

```text
Project Operator／PM
        │ 委任した仕事の応答を待つ時
        ▼
現在の実行状態と必要な判断を確認する
        │
        ▼
待つ・入力する・取消す・回復するを選べる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | 委任した仕事の応答を待つ時 |
| Goal | 現在の実行状態と必要な判断を確認する |
| Outcome | 待つ・入力する・取消す・回復するを選べる |

## 成立条件

- 内部logを読まず、実行中・待機・停止と現在必要な判断を理解できる
- 重要場面「応答がなく待機か停止かを判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
委任した仕事の応答を待つ時
        ↓
現在の実行状態と必要な判断を確認する
        │
        ├─ ★ Critical: 応答がなく待機か停止かを判断する場面
        ├─ ⚠ Failure:  古い観測や一律表示を進捗・完了と誤認する
        └─ ✓ Quality:  観測時点・停止理由・必要な判断を行動可能に示す
        ↓
待つ・入力する・取消す・回復するを選べる
```

## 必要な情報

Task State、Provider State、Decision、Next Actionを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

無反応、偽の進捗、Provider差の誤表示および停止中の実行表示を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはTask、Actor、Authority、Result、Recoveryの関係を分け、SPECとArchitectureはLifecycle全体の成立条件を定める。

## 関係

- Source REQ Analysis: [REQ-000002](../../Analysis/REQ-000002/ux_analysis.md)、[REQ-000003](../../Analysis/REQ-000003/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
