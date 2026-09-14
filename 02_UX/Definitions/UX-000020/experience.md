# UX-000020 利用環境の信頼方針でRuntimeを選ぶ

成果物種別: UX Definition
UX ID: `UX-000020`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

準拠、改ざん有無、Publisher、公式表示および実行許可を区別し、自分の環境の方針で公式版・Fork・組織版を選べる

```text
Runtime導入・運用者
        │ Runtimeを導入または更新する時
        ▼
Runtime Trustの各要素を別々に評価する
        │
        ▼
公式版・Fork・組織版を自分の方針で選べる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| Trigger／Situation | Runtimeを導入または更新する時 |
| Goal | Runtime Trustの各要素を別々に評価する |
| Outcome | 公式版・Fork・組織版を自分の方針で選べる |

## 成立条件

- 準拠、改ざん有無、Publisher、公式表示および実行許可を区別し、自分の環境の方針で公式版・Fork・組織版を選べる
- 重要場面「実行を信頼すると判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Runtimeを導入または更新する時
        ↓
Runtime Trustの各要素を別々に評価する
        │
        ├─ ★ Critical: 実行を信頼すると判断する場面
        ├─ ⚠ Failure:  一つの署名表示を全保証と誤認する
        └─ ✓ Quality:  保証要素と決定権限を分離表示する
        ↓
公式版・Fork・組織版を自分の方針で選べる
```

## 必要な情報

Conformance、Integrity、Publisher、Policy、Deploymentを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

一つの署名やブランド表示への全保証集約とQual-Lab署名だけの実行資格化を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはConformance、Integrity、Publisher、Distributionを分け、UI／SPECは根拠別の状態を提示する。

## 関係

- Source REQ Analysis: [REQ-000018](../../Analysis/REQ-000018/ux_analysis.md)、[REQ-000025](../../Analysis/REQ-000025/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

