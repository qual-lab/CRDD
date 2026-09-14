# UX-000001 意味レビューへ集中できる事前確認

成果物種別: UX Definition
UX ID: `UX-000001`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる

```text
CRDD作成者・保守者
        │ 成果物をレビューへ渡す前
        ▼
意味レビュー前に機械判定できる不備を落とす
        │
        ▼
人が意味と判断へ集中できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 成果物をレビューへ渡す前 |
| Goal | 意味レビュー前に機械判定できる不備を落とす |
| Outcome | 人が意味と判断へ集中できる |

## 成立条件

- 同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる
- 重要場面「機械指摘と意味判断を分ける」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
成果物をレビューへ渡す前
        ↓
意味レビュー前に機械判定できる不備を落とす
        │
        ├─ ★ Critical: 機械指摘と意味判断を分ける
        ├─ ⚠ Failure:  検査範囲や理由が分からない
        └─ ✓ Quality:  同じ入力へ同じ指摘と修正可能な場所を返す
        ↓
人が意味と判断へ集中できる
```

## 必要な情報

対象、検査条件、Finding、Location、Responsibilityを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

結果の決定性、対象箇所、理由および意味判断との境界を確認する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

Qualityは決定論性と誤検知を、Documentationは人が理解できる指摘を、Verificationは意味監査との境界を具体化する。

## 関係

- Source REQ Analysis: [REQ-000001](../../Analysis/REQ-000001/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

