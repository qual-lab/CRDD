# UX-000009 Projectの現在地を根拠と不完全性付きで理解する

成果物種別: UX Definition
UX ID: `UX-000009`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる

```text
Project Operator／PM
        │ Project状況を確認する時
        ▼
Projectの現在地を根拠と不完全性付きで理解する
        │
        ▼
不足・競合・古さを踏まえて次の判断を選べる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | Project状況を確認する時 |
| Goal | Projectの現在地を根拠と不完全性付きで理解する |
| Outcome | 不足・競合・古さを踏まえて次の判断を選べる |

## 成立条件

- 物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる
- 重要場面「Current表示を信じる直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Project状況を確認する時
        ↓
Projectの現在地を根拠と不完全性付きで理解する
        │
        ├─ ★ Critical: Current表示を信じる直前
        ├─ ⚠ Failure:  欠測や古い値を完全な現在値と誤認する
        └─ ✓ Quality:  根拠、不完全性、観測時点を同時に示す
        ↓
不足・競合・古さを踏まえて次の判断を選べる
```

## 必要な情報

Project、Property、Source、Revision、Observed At、Coverageを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

partial、stale、restricted、conflictingおよび未観測値の誤認を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはPropertyごとのSource、現行性、Coverageおよび競合を表現する。UIは不完全性を0件や正常状態と同じ見た目にせず、Verificationは完全性を崩す反例を使う。

## 関係

- Source REQ Analysis: [REQ-000007](../../Analysis/REQ-000007/ux_analysis.md)、[REQ-000009](../../Analysis/REQ-000009/ux_analysis.md)、[REQ-000020](../../Analysis/REQ-000020/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

