# UX-000021 切断後も同じRequestへ戻る

成果物種別: UX Definition
UX ID: `UX-000021`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる

```text
Project Operator／PM
        │ 応答喪失後に再接続する時
        ▼
切断後に同じRequestへ戻る
        │
        ▼
二重実行せず状態・結果・回復義務を取得できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | 応答喪失後に再接続する時 |
| Goal | 切断後に同じRequestへ戻る |
| Outcome | 二重実行せず状態・結果・回復義務を取得できる |

## 成立条件

- 応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる
- 重要場面「再実行するか判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
応答喪失後に再接続する時
        ↓
切断後に同じRequestへ戻る
        │
        ├─ ★ Critical: 再実行するか判断する直前
        ├─ ⚠ Failure:  Timeoutを未実行とみなし新規Effectを起こす
        └─ ✓ Quality:  同一Identityの照会を再実行より先に示す
        ↓
二重実行せず状態・結果・回復義務を取得できる
```

## 必要な情報

Request Identity、Session、Current Access、Result、Recoveryを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

再接続時の二重Effect、古いSession Authorityおよび別Requestへの誤結合を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはRequest、Attempt、Result、DeliveryおよびRecoveryを関連付ける。SPEC／Architectureは冪等な照会と再入場を分け、System Testは切断を含むLifecycle全体を確認する。

## 関係

- Source REQ Analysis: [REQ-000021](../../Analysis/REQ-000021/ux_analysis.md)、[REQ-000024](../../Analysis/REQ-000024/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

