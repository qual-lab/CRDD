# UX-000025 過去の推論Contextと現在値を区別する

成果物種別: UX Definition
UX ID: `UX-000025`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

当時の仮説・判断・学びと現在有効なIntentを区別し、必要なContextを選べる

```text
CRDD作成者・保守者
        │ 過去判断を再利用または更新する時
        ▼
当時の仮説と現在有効なIntentを区別する
        │
        ▼
判断理由を追跡しつつ古い前提を現在値にしない
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 過去判断を再利用または更新する時 |
| Goal | 当時の仮説と現在有効なIntentを区別する |
| Outcome | 判断理由を追跡しつつ古い前提を現在値にしない |

## 成立条件

- 当時の仮説・判断・学びと現在有効なIntentを区別し、必要なContextを選べる
- 重要場面「Reasoning ContextをAIへ投影する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
過去判断を再利用または更新する時
        ↓
当時の仮説と現在有効なIntentを区別する
        │
        ├─ ★ Critical: Reasoning ContextをAIへ投影する場面
        ├─ ⚠ Failure:  履歴を上書きし競合する理由を勝手に統合する
        └─ ✓ Quality:  現行性・選択範囲・使用改訂版を追跡する
        ↓
判断理由を追跡しつつ古い前提を現在値にしない
```

## 必要な情報

Historical Context、Current Intent、Selection Basisを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

遡及上書き、古いHypothesisの現在値化および履歴全量の無選択投入を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはReasoning Contextの履歴と現行性を分け、各工程とAI Contextは選択根拠を追跡する。

## 関係

- Source REQ Analysis: [REQ-000029](../../Analysis/REQ-000029/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

