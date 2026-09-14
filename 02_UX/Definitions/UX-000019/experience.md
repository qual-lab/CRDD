# UX-000019 必要なContextを渡し結果を同じ仕事へ戻す

成果物種別: UX Definition
UX ID: `UX-000019`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる

```text
外部Contextの所有者
        │ 別AgentやToolへ仕事を渡す時
        ▼
必要なContextだけを出所付きで渡す
        │
        ▼
何を使って判断・生成したか後から追跡できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「外部Contextの所有者」 |
| Trigger／Situation | 別AgentやToolへ仕事を渡す時 |
| Goal | 必要なContextだけを出所付きで渡す |
| Outcome | 何を使って判断・生成したか後から追跡できる |

## 成立条件

- 必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる
- 重要場面「外部境界へContextを出す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
別AgentやToolへ仕事を渡す時
        ↓
必要なContextだけを出所付きで渡す
        │
        ├─ ★ Critical: 外部境界へContextを出す直前
        ├─ ⚠ Failure:  全量投入・Secret混入・古い仮説の現在値化
        └─ ✓ Quality:  Source・Revision・選択理由を保持する
        ↓
何を使って判断・生成したか後から追跡できる
```

## 必要な情報

Context Package、Source、Task、Result、Evidence、Handoff、Decisionを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

全量投入、Secret混入、Context捏造、別Task結果混入およびAgent完了の自動採用を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはContext Package、Source、Revision、Selection ReasonおよびTask Relationを分ける。ArchitectureはResolverとTransportを分離し、Verificationは出所喪失と過剰投入を反証する。

## 関係

- Source REQ Analysis: [REQ-000017](../../Analysis/REQ-000017/ux_analysis.md)、[REQ-000024](../../Analysis/REQ-000024/ux_analysis.md)、[REQ-000027](../../Analysis/REQ-000027/ux_analysis.md)、[REQ-000028](../../Analysis/REQ-000028/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

