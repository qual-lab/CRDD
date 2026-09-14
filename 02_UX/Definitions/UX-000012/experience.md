# UX-000012 入口を変えても同じ仕事を続ける

成果物種別: UX Definition
UX ID: `UX-000012`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

Workbench、MCP、CLIまたはAIの入口を変えても、同じ入力・権限・状態・結果を用いて仕事を続けられる

```text
Developer
        │ Workbench・MCP・CLI・AIの入口を選ぶ時
        ▼
入口差にかかわらず同じ正本・入力・権限で操作する
        │
        ▼
入口を変えても判断と結果を読み替えず仕事を続けられる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| Trigger／Situation | Workbench・MCP・CLI・AIの入口を選ぶ時 |
| Goal | 入口差にかかわらず同じ正本・入力・権限で操作する |
| Outcome | 入口を変えても判断と結果を読み替えず仕事を続けられる |

## 成立条件

- Workbench、MCP、CLIまたはAIの入口を変えても、同じ入力・権限・状態・結果を用いて仕事を続けられる
- 重要場面「入口を切り替えて同じ仕事を開始・継続する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Workbench・MCP・CLI・AIの入口を選ぶ時
        ↓
入口差にかかわらず同じ正本・入力・権限で操作する
        │
        ├─ ★ Critical: 入口を切り替えて同じ仕事を開始・継続する場面
        ├─ ⚠ Failure:  入口固有の第二正本や判断が同じ仕事の意味を変える
        └─ ✓ Quality:  正本・適用規則・入力・認可・結果の意味を共通化する
        ↓
入口を変えても判断と結果を読み替えず仕事を続けられる
```

## 必要な情報

Application Result、Public Contract、Transport Projectionを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

入口固有の第二正本、適用規則、業務状態、Authority判断または結果差を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

SPECは公開結果とTransport errorを分け、ArchitectureとVerificationは両入口の意味同値性を保証する。

## 関係

- Source REQ Analysis: [REQ-000006](../../Analysis/REQ-000006/ux_analysis.md)、[REQ-000010](../../Analysis/REQ-000010/ux_analysis.md)、[REQ-000028](../../Analysis/REQ-000028/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
