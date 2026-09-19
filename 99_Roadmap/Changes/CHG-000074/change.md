# Checker安定化とReality Traceability基盤

変更ID: `CHG-000074`
状態: `Implementation In Progress`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `tool_architecture_and_traceability_change`

## 1. 変更の目的

Quality設計固定後、実装・試験とのReality Auditへ進む前に、Checkerの現行Contractを保持した責務分割と、Canonical設計をSource／Testへ接続する機械可読なTraceability基盤を成立させる。

```text
Canonical Design固定
        ↓
Checker安定化
        ↓
Reality Traceability基盤
        ↓
Reality Audit
```

本変更では、既存実装を理由にCanonical設計を変更しない。Canonical側の不足候補はReality AuditのGapとして所有工程へ返す。

## 2. 現在状態と構造変更

| 対象 | 変更前 | 変更後 |
|---|---|---|
| Checker Pipeline | CLI、探索、Markdown解釈、工程別検査、集計が巨大な配布Sourceへ集積 | Repository DiscoveryからFinding Reportまでの固定Stageを明示する |
| 検査入力 | RuleごとにMarkdown文字列を解釈 | MarkdownをArtifact Modelへ変換し、Schema／Relation／Special Ruleが共有する |
| 工程別Rule | Coreの処理順序と同じSourceへ直接埋込み | Rule Registryへ登録し、Core変更なしで追加できる単位へ移す |
| Finding | 検査箇所ごとの追加処理 | severity、code、path、rule、message、evidenceを共通化する |
| Reality Relation | Architecture／QualityとSource／Testの対応を文書や人間の記憶で再構成 | Subsystem単位の`symbol.json`、共通Schema、Global Symbol Graphで双方向に解決する |
| Reality Audit | Canonicalと現行実装の対応を都度探索 | ARCH／QAから実装・試験へ辿れる基盤上で意味一致とGapを評価する |

現在はChecker内部基盤、Quality状態Rule、現行ProfileのRule登録までを移行した段階である。工程別Profileの検査本体は、既存Findingを固定するため配布入口内に残り、Registry callbackを介して実行している。このcallback接続をRule本体の分離完了とは扱わない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/Details/checker/01_Architecture.md`](../../../06_Architecture/Details/checker/01_Architecture.md)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- [`template/tools/internal/checker/artifact-model.ts`](../../../template/tools/internal/checker/artifact-model.ts)
- [`template/tools/internal/checker/checker-pipeline.ts`](../../../template/tools/internal/checker/checker-pipeline.ts)
- [`template/tools/internal/checker/finding-model.ts`](../../../template/tools/internal/checker/finding-model.ts)
- [`template/tools/internal/checker/markdown-artifact-parser.ts`](../../../template/tools/internal/checker/markdown-artifact-parser.ts)
- [`template/tools/internal/checker/relation-engine.ts`](../../../template/tools/internal/checker/relation-engine.ts)
- [`template/tools/internal/checker/rule-registry.ts`](../../../template/tools/internal/checker/rule-registry.ts)
- [`template/tools/internal/checker/schema-validator.ts`](../../../template/tools/internal/checker/schema-validator.ts)
- [`template/tools/internal/checker/rules/current-profile.ts`](../../../template/tools/internal/checker/rules/current-profile.ts)
- [`template/tools/internal/checker/rules/quality-design-state.ts`](../../../template/tools/internal/checker/rules/quality-design-state.ts)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000074/change.md`](change.md)

</details>

## 3. 成立条件

### Checker安定化

- PipelineのStageと順序が固定されている。
- Parser、Artifact Model、Schema、Relation、Special Rule、Findingが責務分離されている。
- 工程別Ruleの追加でChecker CoreとPipeline順序を原則変更しない。
- CLI、Finding code、終了値、検査範囲および既存契約試験集合の意味を維持する。
- Checkerへ独立監査の意味判断を移さない。

### Reality Traceability

- Subsystem単位で共通Schema準拠の`symbol.json`を配置できる。
- ARCH-IDとImplementation Symbolを双方向に解決できる。
- QA-IDとTest Symbolを双方向に解決できる。
- Test Symbolから検証対象Implementation Symbolを追跡できる。
- Source Annotationは補助情報に限定し、`symbol.json`をRelationの正本とする。
- 新Subsystem追加でChecker Coreを変更しない。

## 4. 検証と残るGate

| Gate | 状態 | 完了条件 |
|---|---|---|
| Quality設計 | Complete | 157 Canonical ID、13 QA、110 Local Item、43詳細設計検証単位がCanonicalで独立レビューPass |
| Checker現挙動固定 | Complete | 静的入口、Repository Checker 0／0、全契約試験370／370 Pass |
| Checker責務分割 | Complete | Pipeline、Model、Schema、Relation、Rule、Findingの局所契約2／2と実Gitサブモジュール配布Consumer縦断1／1がPass |
| Checker独立レビュー | Complete | Critical／Major／Moderate／Minor 0 |
| Symbol Schema／Graph | Pending | 共通Schema、Subsystem Discovery、双方向照会、`verifies`を反証試験で確認 |
| Reality Traceability独立レビュー | Pending | Critical／Major／Moderate／Minor 0 |
| Reality Audit | Not Started | 本変更完了後に別Gateとして開始 |

## Checklist

- [x] 変更目的とReality Audit前の順序を固定した
- [x] Checkerの決定論的責務と独立監査の責務を分けた
- [x] 現行Contractを挙動保存境界として明示した
- [x] Reality TraceabilityをCanonical設計の第二正本にしていない
- [x] Source AnnotationをRelationの正本にしていない
- [x] Reality Auditを未開始として分離した
- [x] Checker責務分割を完了した
- [x] Checker独立レビューを完了した
- [ ] Symbol SchemaとGlobal Symbol Graphを完了した
- [ ] Reality Traceability独立レビューを完了した

## 5. 実装中に検出したConsumer Closure

| 検出 | 原因 | 是正 |
|---|---|---|
| 実Gitサブモジュール内の配布Checkerだけが起動時にmodule解決失敗 | 配布fixtureが旧来の単一`crdd-check.ts`だけを複製し、責務分割後の`internal/checker`をConsumer集合へ含めていなかった | 配布入口と内部Checker module群を同じfixtureへ配置し、実サブモジュール経路で起動する契約試験を維持する |

この失敗はCheckerの判定差ではなく、責務移動後の配布Consumer取り残しである。単体のPipeline試験だけで完了とせず、採用Repositoryの実入口まで含む縦断契約で閉じる。

独立再レビューでは、工程別Profile本体がcallback移行中であることを分離完了と誤表示していないこと、Checkerへ意味監査を取り込んでいないこと、CLI／Finding／終了値／Rule順序／Quality状態の意味を維持していることを確認した。初回レビューが検出した12件の内部命名違反と固定試験件数表現を是正し、再レビューはCritical／Major／Moderate／Minor 0でPassした。
