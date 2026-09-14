# UX-000030 公式素材を権利と用途を確認して使う

成果物種別: UX Definition
UX ID: `UX-000030`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる

```text
CRDD作成者・保守者
        │ ブランド素材を追加または利用する時
        ▼
視覚素材の出所・権利・用途を確認する
        │
        ▼
公式識別へ安心して収載・派生利用できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | ブランド素材を追加または利用する時 |
| Goal | 視覚素材の出所・権利・用途を確認する |
| Outcome | 公式識別へ安心して収載・派生利用できる |

## 成立条件

- 公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる
- 重要場面「公式用途へ採用する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
ブランド素材を追加または利用する時
        ↓
視覚素材の出所・権利・用途を確認する
        │
        ├─ ★ Critical: 公式用途へ採用する直前
        ├─ ⚠ Failure:  見た目だけで権利やTrust保証を推定する
        └─ ✓ Quality:  Provenance・Rights・Usageを追跡する
        ↓
公式識別へ安心して収載・派生利用できる
```

## 必要な情報

Asset、Provenance、Rights、Usageを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

見た目からのTrust保証推定、権利不明素材の収載および用途外再配布を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

Communicationは識別用途と表示を、Releaseは権利・原本・派生物の追跡を具体化する。

## 関係

- Source REQ Analysis: [REQ-000035](../../Analysis/REQ-000035/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

