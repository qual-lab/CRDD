# Claude Reviewer結果形式の安定化

変更ID: `CHG-000077`
状態: `Ready for Release Handoff`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `external_boundary_contract_correction`

## 1. 変更の目的

署名済み4経路E2Eで、forwardとreverseは完了したが、`same-codex`のClaude Reviewer結果が`provider_task_reviewer_shape_invalid`で停止した。cleanup、候補破棄、Recovery 0件、Canonical Repository Effect 0は確認済みであり、Docker障害ではない。

同じClaude Reviewerがreverseで一回成功した事実を形式保証へ昇格せず、Reviewerへの結果指示と構造拒否の診断を是正する。

## 2. 観測と原因境界

| 観測 | 判定 |
|---|---|
| forward | 完了 |
| reverse | 完了 |
| same-codex | Claude ReviewerのJSON文書は読取り可能だが、Reviewerの厳密な外形契約に不適合 |
| same-claude | 前経路停止により未試行 |
| cleanup | 確認済み |
| Recovery義務 | なし |
| Canonical Repository変更 | なし |

従来Promptの最終例は`"decision":"approved|changes_requested"`という疑似値をJSON値として示していた。Schemaで強制するCodexでは表面化しにくいが、既知のProvider不具合により複合Reviewer Schemaを使用しないClaudeでは、Prompt解釈へ結果形式を依存させる曖昧さになる。

保存結果は生Provider本文を意図的に保持しないため、この実行で実際に不適合だったfieldまでは確定しない。未確認の内容を原因事実として扱わず、次の実測で構造条件を区別できるようにする。

## 3. 是正

| 対象 | 是正 |
|---|---|
| Reviewer Prompt | 承認時と変更要求時の具体的なJSON形を分離し、疑似enum文字列を除去する |
| Runtime Validator | key、decision、summary、findings、個別finding、decision整合を別の固定Reasonへ分類する |
| 情報境界 | 生Provider本文、未知key名、Summary本文、Finding本文を結果へ出さない |
| Claude Schema | 過去に確認した`findings`配列のProvider不具合を尊重し、Reviewerへ`--json-schema`を戻さない |
| Fail Closed | 不適合結果を補正・推測・成功扱いしない |

## 4. 成立条件

- Formatter、型、LintおよびRuntime TraceabilityがPassする。
- Prompt契約が疑似値`approved|changes_requested`を含まない。
- Reviewer外形の各拒否条件を、生本文なしの固定Reasonで区別する。
- Docker Process Controllerが新しい拒否ReasonでもcleanupとRecovery契約を維持する。
- 同じ固定TaskのClaude Reviewer局所実境界が完了する。
- 更新した署名候補の4経路E2Eで全経路が完了する。

## 5. 現在状態と構造変更

Prompt、Validator、Controllerの結果分類、Architectureおよび変更台帳を同じ契約へ更新する。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`40_Develop/coordinator/src/security/provider-task-packet-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-task-structured-result.ts`](../../../40_Develop/coordinator/src/security/provider-task-structured-result.ts)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](../../../40_Develop/coordinator/src/security/docker-process-controller.ts)
- [`40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts)
- [`template/tools/coordinator/coordinator-package-manifest.json`](../../../template/tools/coordinator/coordinator-package-manifest.json)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000077/change.md`](change.md)

</details>

## 6. 検証結果

| 検証 | 状態 | 結果 |
|---|---|---|
| Formatter／型／Lint／Traceability | Pass | Coordinator `npm run check` |
| Prompt／Validator局所契約 | Pass | 27/27 |
| Docker Controller局所契約 | Pass | 90/90（Reviewer構造不正4種とcleanup未確認時のexact Recoveryを含む。Windows Process Gateは専用経路へ分離） |
| 開発E2E | Pass | 324/324 |
| 独立再レビュー | Pass | Critical 0、Major 0、Moderate 0、Minor 0 |
| Reviewer局所実境界 | Pass | 記録`750919c2-114a-4c9e-b8ec-c80dc715d9d4`。forward／reverse 2/2完了、cleanup確認、Recovery 0件 |
| 署名4経路E2E | Pass | 記録`4480ca02-e4af-4cc8-b8cb-d483fd7883e2`。forward／reverse／same-codex／same-claude 4/4完了、再試行0、cleanup確認、Recovery 0件 |

署名対象はCommit `e38f42af4b63c7cbbeffb20acd27f290e0568a7a`、Tree `30be26571388b373f5c7042a2e0a9f808a1c4ab3`である。Manifest専用Commitは`9d2a441322a658d7f48c3065665385ec0e1ae46d`、Package Content Rootは`6aa739caddb7171224b37d8b55e8349d1bc4352127d2203cd8c958a4d83a2f1c`、Runtime Execution Identityは`2890776c0d091e643baab8a0ea16fa3066b3a48d078ba414512dff25488036bc`である。

## Checklist

- [x] 外部境界の実観測と推測を分けた。
- [x] 過去に成立しなかったClaude Reviewer Schemaを復活させていない。
- [x] 生Provider本文を診断へ出していない。
- [x] 失敗時もcleanup、RecoveryおよびCanonical Effect境界を維持した。
- [x] Claude Reviewerの局所実境界で修正後の結果を確認した。
- [x] 更新署名候補で4経路E2Eを完了した。
