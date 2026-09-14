# UX-000010 Repository単独で日常作業を続ける

成果物種別: UX Definition
UX ID: `UX-000010`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在Repositoryで日常作業を開始・継続できる

```text
Developer
        │ Repositoryで作業を始める時
        ▼
現在Repositoryだけで日常作業を完結する
        │
        ▼
必要な時だけCROSへ移り普段の作業を複雑にしない
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| Trigger／Situation | Repositoryで作業を始める時 |
| Goal | 現在Repositoryだけで日常作業を完結する |
| Outcome | 必要な時だけCROSへ移り普段の作業を複雑にしない |

## 成立条件

- 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在Repositoryで日常作業を開始・継続できる
- 重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Repositoryで作業を始める時
        ↓
現在Repositoryだけで日常作業を完結する
        │
        ├─ ★ Critical: 横断利用へ切り替える判断
        ├─ ⚠ Failure:  CROS未設定でLocal作業まで止まる
        └─ ✓ Quality:  Localを既定にし横断を任意に保つ
        ↓
必要な時だけCROSへ移り普段の作業を複雑にしない
```

## 必要な情報

Local Context、Routine Operation、Version Control Capabilityを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

CROS未設定、未CommitまたはVersion Control Adapter障害による無関係な作業停止を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはLocal Sourceを既定とし、横断Sourceを別状態にする。ArchitectureはLocal経路をCROS Serverの可用性へ依存させず、回帰試験はCROSなしの開始と完了を守る。

## 関係

- Source REQ Analysis: [REQ-000008](../../Analysis/REQ-000008/ux_analysis.md)、[REQ-000036](../../Analysis/REQ-000036/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
