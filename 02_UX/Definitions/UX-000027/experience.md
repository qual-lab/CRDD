# UX-000027 物語と構造から文書の意味を理解する

成果物種別: UX Definition
UX ID: `UX-000027`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

課題と判断の物語を理解してから、表・図で条件と関係を確認し、次の行動へ進める

```text
CRDD作成者・保守者
        │ 工程成果物を初めて読む時
        ▼
課題と判断の物語から構造化詳細へ進む
        │
        ▼
情報量を失わず短時間で意味と次の行動を理解できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 工程成果物を初めて読む時 |
| Goal | 課題と判断の物語から構造化詳細へ進む |
| Outcome | 情報量を失わず短時間で意味と次の行動を理解できる |

## 成立条件

- 課題と判断の物語を理解してから、表・図で条件と関係を確認し、次の行動へ進める
- 重要場面「判断理由と条件を結び付ける場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
工程成果物を初めて読む時
        ↓
課題と判断の物語から構造化詳細へ進む
        │
        ├─ ★ Critical: 判断理由と条件を結び付ける場面
        ├─ ⚠ Failure:  Checklist順と専門語だけで文書を埋める
        └─ ✓ Quality:  StoryとStructured Contextを両立する
        ↓
情報量を失わず短時間で意味と次の行動を理解できる
```

## 必要な情報

Narrative、Structured Detail、Decision、Evidenceを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

Checklist順、専門語だけの説明および情報削減による見せかけの可読性を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

DocumentationはNarrative-firstとStructured-firstを両立し、各工程は読者理解と機械追跡を確認する。

## 関係

- Source REQ Analysis: [REQ-000031](../../Analysis/REQ-000031/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

