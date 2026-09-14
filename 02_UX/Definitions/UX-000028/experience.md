# UX-000028 工程固有の図から意図を引き継ぐ

成果物種別: UX Definition
UX ID: `UX-000028`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

工程固有の図から全体像・関係・状態差・未接続を理解し、後工程で意図を再発明せずに引き継げる

```text
CRDD作成者・保守者
        │ 工程の入口・出口で成果物を渡す時
        ▼
工程固有の図から状態・関係・未接続を理解する
        │
        ▼
後工程で意図を再発明せず漏れを発見できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 工程の入口・出口で成果物を渡す時 |
| Goal | 工程固有の図から状態・関係・未接続を理解する |
| Outcome | 後工程で意図を再発明せず漏れを発見できる |

## 成立条件

- 工程固有の図から全体像・関係・状態差・未接続を理解し、後工程で意図を再発明せずに引き継げる
- 重要場面「下流義務へ変換する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
工程の入口・出口で成果物を渡す時
        ↓
工程固有の図から状態・関係・未接続を理解する
        │
        ├─ ★ Critical: 下流義務へ変換する場面
        ├─ ⚠ Failure:  必要な図を黙って省略しAIごとに記法が変わる
        └─ ✓ Quality:  図の意味・凡例・正本関係を固定する
        ↓
後工程で意図を再発明せず漏れを発見できる
```

## 必要な情報

Diagram Element、Source Meaning、Handoff Obligationを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

図の黙示省略、機械的で読めない記法および図と試験の断絶を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

各工程は図の意味と処置を所有し、Checkerは欠落を、レビューは意味の正しさを確認する。

## 関係

- Source REQ Analysis: [REQ-000032](../../Analysis/REQ-000032/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

