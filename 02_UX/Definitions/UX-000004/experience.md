# UX-000004 失敗後の再試行・回復を選ぶ

成果物種別: UX Definition
UX ID: `UX-000004`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる

```text
Project Operator／PM
        │ 複数AIへ仕事を委ねる時
        ▼
複数AIへ任せる範囲と権限を理解する
        │
        ▼
停止や失敗後も主導権を失わず結果を受け取れる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | 複数AIへ仕事を委ねる時 |
| Goal | 複数AIへ任せる範囲と権限を理解する |
| Outcome | 停止や失敗後も主導権を失わず結果を受け取れる |

## 成立条件

- 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる
- 重要場面「外部Effect前の委任境界」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
複数AIへ仕事を委ねる時
        ↓
複数AIへ任せる範囲と権限を理解する
        │
        ├─ ★ Critical: 外部Effect前の委任境界
        ├─ ⚠ Failure:  暗黙の範囲拡張や回復不能
        └─ ✓ Quality:  委任状態・停止理由・回復先を行動可能に示す
        ↓
停止や失敗後も主導権を失わず結果を受け取れる
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

