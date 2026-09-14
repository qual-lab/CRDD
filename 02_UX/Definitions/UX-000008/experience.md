# UX-000008 故障した境界と影響範囲を理解する

成果物種別: UX Definition
UX ID: `UX-000008`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

接続・認証・実行・結果搬送またはProvider境界のどこで止まり、何が利用可能かを理解できる

```text
Runtime導入・運用者
        │ Runtime Componentを置換する時
        ▼
責務分離後も成立済みCapabilityを使う
        │
        ▼
内部変更の影響範囲を限定して更新できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| Trigger／Situation | Runtime Componentを置換する時 |
| Goal | 責務分離後も成立済みCapabilityを使う |
| Outcome | 内部変更の影響範囲を限定して更新できる |

## 成立条件

- 接続・認証・実行・結果搬送またはProvider境界のどこで止まり、何が利用可能かを理解できる
- 重要場面「利用者向けCapabilityの継続」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Runtime Componentを置換する時
        ↓
責務分離後も成立済みCapabilityを使う
        │
        ├─ ★ Critical: 利用者向けCapabilityの継続
        ├─ ⚠ Failure:  内部Path変更で公開入口が壊れる
        └─ ✓ Quality:  公開結果と成立済み能力を維持する
        ↓
内部変更の影響範囲を限定して更新できる
```

## 必要な情報

Failure Origin、Boundary、Affected Capability、Deliveryを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

一律の失敗表示、無関係な能力停止および全体成功表示を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

Architectureは責務と依存方向を、Verificationは各公開Capabilityの保存を具体化する。

## 関係

- Source REQ Analysis: [REQ-000005](../../Analysis/REQ-000005/ux_analysis.md)、[REQ-000006](../../Analysis/REQ-000006/ux_analysis.md)、[REQ-000023](../../Analysis/REQ-000023/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

