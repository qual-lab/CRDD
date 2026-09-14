# UX-000004 失敗後の再試行・回復を選ぶ

成果物種別: UX Definition
UX ID: `UX-000004`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる

```text
Project Operator／PM
        │ 失敗・取消・切断後に仕事を続ける時
        ▼
再試行・回復・清掃の違いを理解する
        │
        ▼
二重Effectを起こさず同じ仕事へ戻れる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | 失敗・取消・切断後に仕事を続ける時 |
| Goal | 再試行・回復・清掃の違いを理解する |
| Outcome | 二重Effectを起こさず同じ仕事へ戻れる |

## 成立条件

- 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる
- 重要場面「同じEffectを再発行する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
失敗・取消・切断後に仕事を続ける時
        ↓
再試行・回復・清掃の違いを理解する
        │
        ├─ ★ Critical: 同じEffectを再発行する直前
        ├─ ⚠ Failure:  結果不明の処理を新規実行して二重Effectを起こす
        └─ ✓ Quality:  Effect状態・Recovery Identity・終了条件を示す
        ↓
二重Effectを起こさず同じ仕事へ戻れる
```

## 必要な情報

Failure、Effect State、Recovery、Retryを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

無条件Retry、古いAuthority、Provider差の隠蔽および二重Effectを反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはTask、Actor、Authority、Result、Recoveryの関係を分け、SPECとArchitectureはLifecycle全体の成立条件を定める。

## 関係

- Source REQ Analysis: [REQ-000002](../../Analysis/REQ-000002/ux_analysis.md)、[REQ-000003](../../Analysis/REQ-000003/ux_analysis.md)、[REQ-000021](../../Analysis/REQ-000021/ux_analysis.md)、[REQ-000024](../../Analysis/REQ-000024/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
