# UX-000023 監査・是正・判断を一つの改訂版で閉じる

成果物種別: UX Definition
UX ID: `UX-000023`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる

```text
CRDD作成者・保守者
        │ 複数Findingを是正する時
        ▼
監査合意から是正・反証までを一つの改訂版で閉じる
        │
        ▼
小出しの指摘と局所PatchのLoopを減らせる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 複数Findingを是正する時 |
| Goal | 監査合意から是正・反証までを一つの改訂版で閉じる |
| Outcome | 小出しの指摘と局所PatchのLoopを減らせる |

## 成立条件

- 合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる
- 重要場面「再レビューへ固定候補を渡す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
複数Findingを是正する時
        ↓
監査合意から是正・反証までを一つの改訂版で閉じる
        │
        ├─ ★ Critical: 再レビューへ固定候補を渡す直前
        ├─ ⚠ Failure:  一部是正や監査回数を完成と誤認する
        └─ ✓ Quality:  合意事項と試験を全数対応させる
        ↓
小出しの指摘と局所PatchのLoopを減らせる
```

## 必要な情報

Finding、Remediation、Verification、Decision Request、Current Revisionを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

指摘の小出し適用、解消済み判断の再要求および一部是正の完成表示を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはFinding、Decision、Remediation、Evidenceを分け、WorkflowとVerificationは収束Gateを具体化する。

## 関係

- Source REQ Analysis: [REQ-000026](../../Analysis/REQ-000026/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

