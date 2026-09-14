# UX-000018 AIモデル構成を安全に更新・選択する

成果物種別: UX Definition
UX ID: `UX-000018`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる

```text
Runtime導入・運用者
        │ 利用モデルやProvider条件を変更する時
        ▼
AIモデル選択を検証可能な構成として更新する
        │
        ▼
新モデルへ追随してもコード改修を繰り返さずに済む
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| Trigger／Situation | 利用モデルやProvider条件を変更する時 |
| Goal | AIモデル選択を検証可能な構成として更新する |
| Outcome | 新モデルへ追随してもコード改修を繰り返さずに済む |

## 成立条件

- 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる
- 重要場面「Provider Effect前のモデル確定」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
利用モデルやProvider条件を変更する時
        ↓
AIモデル選択を検証可能な構成として更新する
        │
        ├─ ★ Critical: Provider Effect前のモデル確定
        ├─ ⚠ Failure:  未知または非対応のモデルを実行可能と表示する
        └─ ✓ Quality:  構成変更を検証し実効選択を観測可能にする
        ↓
新モデルへ追随してもコード改修を繰り返さずに済む
```

## 必要な情報

Model Profile、Availability、Selection、Reason、Fallback Conditionを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはModel、Profile、Role、Availabilityを分け、SPECとVerificationは設定更新の安全な境界を具体化する。

## 関係

- Source REQ Analysis: [REQ-000016](../../Analysis/REQ-000016/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

