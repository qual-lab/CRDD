# UX-000026 試験層と現在の保証範囲を理解して選ぶ

成果物種別: UX Definition
UX ID: `UX-000026`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる

```text
CRDD作成者・保守者
        │ 変更の検証計画を作る時
        ▼
試験層ごとの保証と未確認範囲を理解する
        │
        ▼
最終E2E前に外部境界の問題を局所化できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 変更の検証計画を作る時 |
| Goal | 試験層ごとの保証と未確認範囲を理解する |
| Outcome | 最終E2E前に外部境界の問題を局所化できる |

## 成立条件

- 各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる
- 重要場面「外部境界を結合する各段階」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
変更の検証計画を作る時
        ↓
試験層ごとの保証と未確認範囲を理解する
        │
        ├─ ★ Critical: 外部境界を結合する各段階
        ├─ ⚠ Failure:  単発成功や試験件数からLifecycle全体を保証する
        └─ ✓ Quality:  開始から清掃まで段階的に反証する
        ↓
最終E2E前に外部境界の問題を局所化できる
```

## 必要な情報

Test Layer、Scope、Lifecycle Evidence、Authority、Not Executed Stateを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

一部Passからの全体品質推定、単発成功だけのLifecycle保証および未指示の高負荷実行を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

Qualityは試験層と再実行選択を、ArchitectureはBlockとLifecycleを、VerificationはEvidence状態を具体化する。

## 関係

- Source REQ Analysis: [REQ-000030](../../Analysis/REQ-000030/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

