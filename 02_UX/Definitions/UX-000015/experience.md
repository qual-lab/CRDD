# UX-000015 複数Projectを根拠付きで比較する

成果物種別: UX Definition
UX ID: `UX-000015`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

許可されたProjectの重要差を比較し、Coverageと根拠を保ったまま必要なProjectだけを掘り下げられる

```text
Management
        │ Portfolioの優先度を判断する時
        ▼
複数Projectを根拠付きで比較する
        │
        ▼
重要差分から必要なProjectだけを掘り下げられる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Management」 |
| Trigger／Situation | Portfolioの優先度を判断する時 |
| Goal | 複数Projectを根拠付きで比較する |
| Outcome | 重要差分から必要なProjectだけを掘り下げられる |

## 成立条件

- 許可されたProjectの重要差を比較し、Coverageと根拠を保ったまま必要なProjectだけを掘り下げられる
- 重要場面「要約から優先判断へ進む直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Portfolioの優先度を判断する時
        ↓
複数Projectを根拠付きで比較する
        │
        ├─ ★ Critical: 要約から優先判断へ進む直前
        ├─ ⚠ Failure:  単一Scoreや欠測した集計で健全性を断定する
        └─ ✓ Quality:  比較値から根拠・古さ・不足へ戻れる
        ↓
重要差分から必要なProjectだけを掘り下げられる
```

## 必要な情報

Project Summary、Coverage、Observed At、Disclosureを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

非開示Projectの存在漏えい、単一Score断定およびCoverage差の消去を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはProject比較軸、Source Coverage、Freshnessおよび根拠導線をモデル化する。Verificationは不完全なProject集合を完全Portfolioとして表示しないことを確認する。

## 関係

- Source REQ Analysis: [REQ-000013](../../Analysis/REQ-000013/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

