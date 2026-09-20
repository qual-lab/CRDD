# Source責務命名と設計由来Documentation

変更ID: `CHG-000079`
状態: `Independent Review Passed — Signed Verification Pending`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `coding_standard_extension`

## 1. 変更の目的

CRDD所有Sourceを、人間とAIがFile名、公開入口およびHeaderから短時間で理解できる状態へ揃える。分類語彙を増やすことではなく、主要責務、設計由来、EffectおよびBoundaryを隠さないことを目的とする。

```text
Architecture
    ↓
Meaning／Responsibility
    ↓
Public API／Architecture Symbol
    ↓
Source File／Type／Function
```

## 2. 着手前整合確認

| 観点 | 現在判断 |
|---|---|
| 正本 | `06_Architecture/99_Coding_Standards.md`がCRDD所有Toolの命名とSource規則を所有する |
| 既存Capability | Package公開Symbol集合、Runtime挙動、Schema、CLI grammarおよび署名境界を変更しない |
| 既存規則 | 責務Directory、二階層制限、曖昧な単独名、公開`index.ts` allowlistを維持する |
| 追加する意味 | 6つの標準Suffix、曖昧なFile名の禁止、TSDoc Headerおよび公開入口の決定論的検査 |
| 対象外 | 全FileをSuffixへ分類すること、private helperへの定型文、Header本文のAI意味推論、新しい公開Capability |
| 移行 | 現行違反を棚卸しし、Consumer、Architecture参照、試験、署名対象を同じ変更で閉じる |

## 3. 採用判断

| 候補 | 判定 | 理由 |
|---|---|---|
| 全Fileへ固定Suffixを強制 | 不採用 | `checker-pipeline.ts`等の具体的な責務名を劣化させ、分類のための分類になる |
| 少数の標準Suffixと具体名を併用 | 採用 | 責務を推測しやすくしつつ、Domain固有の意味を保持できる |
| Headerを全private helperへ必須化 | 不採用 | Codeから明白な内容の反復と定型文の増殖を招く |
| Public／Domain／Effect／BoundaryへHeaderを要求 | 採用 | 設計由来と重要保証をSourceから追跡できる |
| Header本文をCheckerが意味判定 | 不採用 | 自然言語の妥当性を機械推論へ依存する |
| 構造とtagをChecker、意味を独立review | 採用 | 決定論的検査と専門判断の責務を分けられる |

## 4. 実装範囲

1. Coding Standardsへ標準Suffix、禁止名、公開入口およびHeader規則を統合する。
2. Checkerの命名契約へFile名、無名Barrel Export、公開入口Headerの決定論的検査を追加する。
3. 現行Sourceの違反をConsumer Closure付きで移行する。
4. Formatter、型、Lint、局所回帰、Repository Checkerおよび独立reviewを実行する。
5. Coordinator署名Closureが変わる場合だけ、署名と該当E2Eを別Gateで実行する。

## 5. 現在状態と構造変更

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`40_Develop/artifact-signing/src/index.ts`](../../../40_Develop/artifact-signing/src/index.ts)
- [`40_Develop/checker/src/index.ts`](../../../40_Develop/checker/src/index.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/coordinator/src/index.ts`](../../../40_Develop/coordinator/src/index.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts)
- [`40_Develop/coordinator/src/security/docker-restart-machine.ts`](../../../40_Develop/coordinator/src/security/docker-restart-machine.ts)
- [`40_Develop/coordinator/src/security/docker-restart-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-restart-runtime.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts)
- [`40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts`](../../../40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts)
- [`40_Develop/crdd-domain-library/src/artifact/index.ts`](../../../40_Develop/crdd-domain-library/src/artifact/index.ts)
- [`40_Develop/crdd-domain-library/src/index.ts`](../../../40_Develop/crdd-domain-library/src/index.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/index.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/index.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/index.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/index.ts)
- [`40_Develop/execution-intelligence/src/index.ts`](../../../40_Develop/execution-intelligence/src/index.ts)
- [`40_Develop/mcp/src/index.ts`](../../../40_Develop/mcp/src/index.ts)
- [`40_Develop/project-runtime/src/index.ts`](../../../40_Develop/project-runtime/src/index.ts)
- [`40_Develop/runtime-data/src/index.ts`](../../../40_Develop/runtime-data/src/index.ts)
- [`40_Develop/semantic-coverage/src/index.ts`](../../../40_Develop/semantic-coverage/src/index.ts)
- [`40_Develop/verification-runner/src/index.ts`](../../../40_Develop/verification-runner/src/index.ts)
- [`40_Develop/version-control/src/checker-observation/index.ts`](../../../40_Develop/version-control/src/checker-observation/index.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/src/repository-identity/index.ts`](../../../40_Develop/version-control/src/repository-identity/index.ts)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000001/change.md`](../CHG-000001/change.md)
- [`99_Roadmap/Changes/CHG-000002/change.md`](../CHG-000002/change.md)
- [`99_Roadmap/Changes/CHG-000004/change.md`](../CHG-000004/change.md)
- [`99_Roadmap/Changes/CHG-000005/change.md`](../CHG-000005/change.md)
- [`99_Roadmap/Changes/CHG-000007/change.md`](../CHG-000007/change.md)
- [`99_Roadmap/Changes/CHG-000010/change.md`](../CHG-000010/change.md)
- [`99_Roadmap/Changes/CHG-000015/change.md`](../CHG-000015/change.md)
- [`99_Roadmap/Changes/CHG-000017/change.md`](../CHG-000017/change.md)
- [`99_Roadmap/Changes/CHG-000054/change.md`](../CHG-000054/change.md)
- [`99_Roadmap/Changes/CHG-000055/change.md`](../CHG-000055/change.md)
- [`99_Roadmap/Changes/CHG-000057/change.md`](../CHG-000057/change.md)
- [`99_Roadmap/Changes/CHG-000063/change.md`](../CHG-000063/change.md)
- [`99_Roadmap/Changes/CHG-000065/change.md`](../CHG-000065/change.md)
- [`99_Roadmap/Changes/CHG-000066/change.md`](../CHG-000066/change.md)
- [`99_Roadmap/Changes/CHG-000067/change.md`](../CHG-000067/change.md)
- [`99_Roadmap/Changes/CHG-000068/change.md`](../CHG-000068/change.md)
- [`99_Roadmap/Changes/CHG-000070/change.md`](../CHG-000070/change.md)
- [`99_Roadmap/Changes/CHG-000071/change.md`](../CHG-000071/change.md)
- [`99_Roadmap/Changes/CHG-000079/change.md`](change.md)

</details>

旧Fileは互換shimを残さず、上記2つの`native-process` Fileへ履歴を保って移行する。過去Evidence本文は変更せず、現行CHGの到達先だけを現在Pathへ更新した。

## 6. 検証結果

| 検証 | 結果 |
|---|---|
| Formatter | 504 File、差分なし |
| TypeScript型検査／Lint | Checker、Coordinatorおよび影響PackageでPass |
| 公開入口と命名契約 | 14 / 14 Pass。Architectureが宣言する16公開`index.ts`のexact入口、export元Module allowlist、Canonical Trace、必須tag、曖昧File名、裸の`types.ts`、無名Barrelおよびnamespace名・export元契約を検査 |
| Project Runtime | 60 / 60 Pass |
| MCP | 32 / 32 Pass |
| Runtime Data | 35 / 35 Pass |
| Execution Intelligence | 43 / 43 Pass。初回の並行Process試験1件は単独再実行と全件再実行でPass |
| Coordinator Docker境界 | 28 Pass、実環境依存4 Skip |
| Repository Checker | 961 Markdown、15,954 Link、Error 0、Warning 0 |

## 7. 独立レビュー

初回固定候補`9fe6065c094b6ded2320cc3fb5d5b9f4e42024a2`はPass不可だった。指摘された変更一覧と検証記録の不一致、Symbol Headerの適用範囲、公開入口母集団、必須tag、非公開再export、namespace契約および負例不足を正本とChecker契約で是正した。

第二固定候補`bc7accc163d51b71d16a89e4d6607e3b6d01a539`もPass不可だった。Path名を非公開性の根拠にしていた検査をArchitecture由来のexport元Module allowlistへ置換し、namespace名とexport元を一組で固定した。公開Effect、Filesystem・Process境界、Authorityおよび並行実行に応じたtagを補い、`@trace`をProfileが宣言するCanonical Architecture IDとexact照合する。Semantic Coverageの下位`index.ts`はCapability内部の集約であり、公開入口母集団から除外した。

最終固定候補`8d21765c08c0e86bd5da670720fc7d4183ab5658`は独立レビューでPassした。`@trace`はHeader内の値集合とProfileの許可集合を完全一致で比較し、suffix付きIDと期待IDへの余剰ID併記も負例で拒否する。影響一覧48件と実差分48件は一致し、未解決のBlocking Findingはない。

Coordinator RuntimeのSource Pathと配布内容が変わるため、最終Commit固定後の再署名、signed Recovery Matrixおよびsigned four-route E2Eを完了Gateとして残す。文書、Checkerまたは他PackageをCoordinator署名範囲へ追加しない。

## Checklist

- [x] 既存の命名・公開入口規則と競合しないOwnerを確認した。
- [x] 標準Suffixを閉じた少数集合に限定した。
- [x] Suffix非該当時の具体名を許可した。
- [x] HeaderをCodeの逐語説明にしない目的を明示した。
- [x] 機械検査と独立reviewの責務を分けた。
- [x] 現行Sourceの曖昧File名と無名Barrel ExportをConsumer Closure付きで移行した。
- [x] 公開入口ごとに重複しないPackage Headerを一つだけ配置した。
- [x] Formatter、型、Lint、局所回帰およびRepository Checkerを完了した。
- [x] 是正後固定候補の独立reviewを完了した。
- [ ] OPEN: 最終CommitのCoordinator Runtimeを再署名し、Recovery Matrixとfour-route E2Eを完了する。理由: renameによりRuntime実行Identityが変化する。
