# UX-000031 公式の識別と保証を混同せず見分ける

成果物種別: UX Definition
UX ID: `UX-000031`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

CRDDの公式入口や素材を視覚的に見分けながら、その表示だけを署名・準拠・品質またはPublisher Trustの証明と誤認せず利用できる

```text
CRDDの文書・Tool・公開案内を閲覧する人
        │ 公式らしい入口や素材を見つけた時
        ▼
識別表示と保証の根拠を分けて確認する
        │
        ▼
見た目だけを信頼根拠にせず適切な入口を選べる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | CRDDの文書・Tool・公開案内を閲覧する人 |
| Trigger／Situation | 公式らしい入口や視覚素材を見つけた時 |
| Goal | 識別表示と保証の根拠を分けて確認する |
| Outcome | 見た目だけを信頼根拠にせず適切な入口を選べる |

## 成立条件

- 公式入口や素材を識別でき、同時に署名・準拠・品質・Publisher Trustの根拠は別に確認できる。
- 重要場面「公式表示を信頼判断へ用いる直前」で、視覚的な公式らしさを保証の証明と誤認しない。
- 表示媒体や入口が変わっても、識別用途と保証根拠の境界を維持する。

## 重要な体験と品質期待

```text
公式らしい入口や視覚素材を見つけた時
        ↓
識別表示と保証の根拠を分けて確認する
        │
        ├─ ★ Critical: 公式表示を信頼判断へ用いる直前
        ├─ ⚠ Failure:  アイコンや見た目を署名・準拠・品質保証と誤認する
        └─ ✓ Quality:  識別表示と検証可能なTrust根拠を別に示す
        ↓
見た目だけを信頼根拠にせず適切な入口を選べる
```

## 必要な情報

Official Identification、Publisher、Signature、Conformance、Quality Claimを分ける

## 制約

- 視覚素材をRuntime Trust、公式署名、準拠または品質の証明にしない。
- 非公式入口の存在や利用可能性を、公式表示がないことだけで否定しない。
- 下流工程は識別表示と保証根拠を一つの状態へ畳まない。

## 検証意図

公式／非公式表示、保証根拠の欠落、見た目だけのTrust推定および識別不能な入口を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAは識別表示と保証根拠を別Informationとして扱う。UI／Communicationは両者を誤認させず、SPECとVerificationは公式表示だけからTrustを成立させない。

## 関係

- Source REQ Analysis: [REQ-000035](../../Analysis/REQ-000035/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
