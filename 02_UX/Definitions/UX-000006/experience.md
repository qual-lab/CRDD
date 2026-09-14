# UX-000006 実行事実を根拠付きで振り返る

成果物種別: UX Definition
UX ID: `UX-000006`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

実行主体が異なっても、観測事実・未観測・評価・改善候補を出所と時点付きで区別して振り返れる

```text
Runtime導入・運用者
        │ 実行結果を振り返る時
        ▼
実行事実を出所と観測時点付きで比較する
        │
        ▼
推測と事実を混ぜず改善候補を判断できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| Trigger／Situation | 実行結果を振り返る時 |
| Goal | 実行事実を出所と観測時点付きで比較する |
| Outcome | 推測と事実を混ぜず改善候補を判断できる |

## 成立条件

- 実行主体が異なっても、観測事実・未観測・評価・改善候補を出所と時点付きで区別して振り返れる
- 重要場面「未観測値を含む実行事実の取得」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
実行結果を振り返る時
        ↓
実行事実を出所と観測時点付きで比較する
        │
        ├─ ★ Critical: 未観測値を含む実行事実の取得
        ├─ ⚠ Failure:  未観測を0や正常へ畳む
        └─ ✓ Quality:  出所・時点・観測状態を保持する
        ↓
推測と事実を混ぜず改善候補を判断できる
```

## 必要な情報

Execution、Observation State、Source、Assessment、Candidateを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

空値の正常化、評価の事実化および出所のない比較を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはExecution、Observation、Assessmentを分け、Verificationは複数Runtime間で意味が保存されることを確認する。

## 関係

- Source REQ Analysis: [REQ-000004](../../Analysis/REQ-000004/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

