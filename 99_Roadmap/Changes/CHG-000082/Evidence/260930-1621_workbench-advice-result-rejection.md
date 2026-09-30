# Workbench助言の実Provider確認で検出した出力拒否

## 結論

Workbench Production Compositionの実Provider確認は、最初のCodex読取り助言で停止した。Provider Processは正常終了し、境界の資源回収も確認したが、助言出力の抽出が拒否され、`provider_result_invalid`を返した。Workbench全体の合格ではない。Claude助言と二つの変更候補Scenarioは未実行である。

## 対象と実行条件

| 項目 | 記録 |
|---|---|
| 署名Runtime | Commit `45254e2bf9d20f8ff674840648a372d31155c44f`、Manifest Hash `b5197d786f5b8221a85130495db379ed405e8f9e59c64f0891734b2e15820e0c` |
| Repository HEAD | `2db91851`。開始前に正本文書の変更をCommitし、実行中は変更していない |
| 診断用Runner | Repository-local `.crdd/tmp/workbench-ai-e2e-v022-3e046608.mjs` |
| 起動 | 外部Windows PowerShell 5.1、Node.js v24.19.0 |
| 実行期間 | 2026-09-30 16:19:58〜16:21:11 JST |
| Provider | Codex、`PROFILE-100001`、読取り助言 |
| Operation | `OP-238587829016583123545250687680473719909` |
| 終了 | `WORKBENCH_AI_EXIT=1` |
| 保存ログ | `.crdd/tmp/workbench-ai-e2e-v022-45254e2b.log.txt` |
| ログSHA-256 | `5b73bd676f6fac4c112e2140167666f19d6042b848d9b3d528c5d08914eeb9a1` |

既存の固定Task外部送信同意を使用した。RepositoryはProviderへMountせず、API Keyや有料fallbackを使用していない。候補採用、CommitまたはPushは発行していない。

## 観測と原因の境界

- Provider Container生成、Process開始、Process正常終了、Process Tree終了、Container／Network不存在および境界cleanupを観測した。
- 同じ署名配布側の終了後Observerは`completed / docker_task_runtime_state_clean`、回復ID集合空、手動回復不要を返した。作業Tree側Observerの利用不能を、この在庫の判定へ使用していない。
- `docker-process-controller.ts`は助言抽出処理の具体的な拒否理由を得るが、その理由が公開Registryに存在しないため、一般理由`provider_result_invalid`へ置き換える。診断搬送の欠落はSourceで確認できた。
- 実際にどの抽出条件へ違反したかは、このRunの公開結果から特定できない。AI回答の不正、CLI出力形式の変化または抽出契約との不一致を、現時点で原因として確定しない。

## 次の処置と変更禁止範囲

まず助言抽出の固定拒否理由を単一の閉じた語彙として公開Registryへ接続し、Producerから利用側までの搬送を局所試験する。生Provider本文、Session、Cost、Credentialまたは任意文字列を理由へ追加しない。抽出判定、Tool禁止、最終本文の一意性、参照許可、取消およびcleanupの条件は緩めない。

このRuntime変更を実Providerで確認する場合は、新しい固定候補の署名が必要である。現在の署名stagingを書き換えない。再実測はまず失敗したCodex助言だけを対象とし、原因を確認する前に全回帰や全Scenarioの再実行へ進まない。

## 診断搬送の局所是正

着手前の独立確認で、六つの抽出拒否理由の接続、未登録自由文の拒否、清掃不明時の優先停止および再送条件の不変を確認した。抽出側に六つの固定理由を単一Registryとして宣言し、拒否生成関数の型をその集合へ限定した。Process Controller公開Registryは同じ集合を使用し、既存の上位Task Registryへ伝播する。受理条件と署名済みstagingは変更していない。

Formatter→型→Lint→Capability Graph→Runtime Traceability→Project Runtime Traceabilityの順で全静的段階が合格した。六つの独立反例から得た実理由集合、Controllerの清掃後exact理由帰還、上位Registryへの全数接続の局所試験は3／3合格した。関連三Fileの既存試験は255／255合格、失敗0である。Host固有試験は今回の局所対象へ含めず、この結果をHost実測または全回帰の合格へ読み替えない。

実行コマンドはCoordinator packageから`node --test --test-concurrency=1 --test-skip-pattern="^Host Windows:|^Windows Process Gate:" tests/unit/workbench-ai-advice-provider-output.contract.test.ts tests/integration/docker-process-controller.contract.test.ts tests/integration/coordinator-task-runtime.contract.test.ts`である。これらは原因層の局所根拠であり、新しい署名候補の実Codex助言は未実行である。

診断搬送是正の独立レビューはPassとなった。確認者自身の関連理由試験も12／12合格した。未知理由の拒否、生出力非公開、取消、清掃・Recovery確定および再送境界が不変であることを確認した。このPassは実Codex助言の合格または実抽出拒否原因の解消を意味しない。

診断用RunnerはHTTP／Browser／CLI／MCPの四入口を通していない。候補生成と破棄だけでは採用Lease、Receipt、競合拒否または一度だけの正本反映を証明しない。現在のRunnerによる正本不変確認は対象Fileと`PROJECT_CONTEXT.md`に限定され、全正本の不変を主張するには開始前後の全対象Snapshotが必要である。

## Checklist

- [x] 不合格と未実行Scenarioを明示した。
- [x] Process正常終了と助言受理を区別した。
- [x] 境界cleanupと終了後の署名側回復在庫を別に観測した。
- [x] 診断搬送の欠落と未確定の実原因を区別した。
- [x] 生Provider出力を履歴Evidenceへ複製していない。
- [x] 現在の限定観測をWorkbenchまたはQuality全体の合格へ格上げしていない。
