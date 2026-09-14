# UX-000011 Project・Repository・Rootを区別して対象を選ぶ

成果物種別: UX Definition
UX ID: `UX-000011`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる

```text
Project Operator／PM
        │ 参照または操作対象を選ぶ時
        ▼
Project・Repository・Rootを区別して対象を確認する
        │
        ▼
論理Projectを一つに見ながら誤った場所へ作用しない
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | 参照または操作対象を選ぶ時 |
| Goal | Project・Repository・Rootを区別して対象を確認する |
| Outcome | 論理Projectを一つに見ながら誤った場所へ作用しない |

## 成立条件

- 論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる
- 重要場面「Effect対象を確定する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
参照または操作対象を選ぶ時
        ↓
Project・Repository・Rootを区別して対象を確認する
        │
        ├─ ★ Critical: Effect対象を確定する直前
        ├─ ⚠ Failure:  同名や近いPathを同じ対象と誤認する
        └─ ✓ Quality:  各Identityと物理Rootの結合を明示する
        ↓
論理Projectを一つに見ながら誤った場所へ作用しない
```

## 必要な情報

Project、Repository、Root、Bindingを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

名前やPathの類似だけから対象Identityを推定する操作を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはProject、Repository、RootおよびBindingを別Entityとして関連付ける。UIは通常表示とSource詳細を分け、Architectureは検証済みIdentityを公開結果まで保持する。

## 関係

- Source REQ Analysis: [REQ-000009](../../Analysis/REQ-000009/ux_analysis.md)、[REQ-000020](../../Analysis/REQ-000020/ux_analysis.md)、[REQ-000024](../../Analysis/REQ-000024/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

