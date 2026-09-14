# UX-000016 仕事に必要な標準Toolを迷わず選ぶ

成果物種別: UX Definition
UX ID: `UX-000016`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

現在Repositoryの固定Commitと目的に対応する標準Tool／Runtimeを見つけ、別Releaseを手動照合せず安全に選べる

```text
Developer
        │ Toolで処理を始める時
        ▼
固定Commitに対応するTool／Runtimeと利用可能性を知る
        │
        ▼
名前・Path・Versionを推測せず適切な入口を選べる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| Trigger／Situation | Toolで処理を始める時 |
| Goal | 固定Commitに対応するTool／Runtimeと利用可能性を知る |
| Outcome | 名前・Path・Versionを推測せず適切な入口を選べる |

## 成立条件

- 現在Repositoryの固定Commitと目的に対応する標準Tool／Runtimeを見つけ、別Releaseを手動照合せず安全に選べる
- 重要場面「発見したTool／Runtimeを起動する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Toolで処理を始める時
        ↓
固定Commitに対応するTool／Runtimeと利用可能性を知る
        │
        ├─ ★ Critical: 発見したTool／Runtimeを起動する直前
        ├─ ⚠ Failure:  版不一致・欠落Runtime・改ざんManifestを対応版と誤認する
        └─ ✓ Quality:  Commit・配布集合・Manifest・Runtimeの対応を検証する
        ↓
名前・Path・Versionを推測せず適切な入口を選べる
```

## 必要な情報

Capability、Availability、Authority、Repository Commit、Distribution、Manifest、Runtime Bindingを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

fresh clone、submodule、版不一致、欠落Runtime、改ざんManifest、未登録能力の推測表示および一覧からのAuthority発行を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはCapability、Availability、Authorityを分け、UI／MCPとVerificationは同じRegistry投影を利用する。

## 関係

- Source REQ Analysis: [REQ-000014](../../Analysis/REQ-000014/ux_analysis.md)、[REQ-000034](../../Analysis/REQ-000034/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
