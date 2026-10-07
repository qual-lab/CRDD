# Coordinator Source配置対応表と整理計画

成果物種別: 変更計画
状態: 配置移動・限定検証・独立再確認Pass（動作変更・リリース採用は対象外）
対象: CHG-000082 / Coordinator Source配置
基準Commit: `4386a4b4ab2ce106d58378516a208e00519f6d20`
棚卸し対象: 2026-10-07の作業ツリー。未コミットの現在状態実装も含む。

## 1. 結論と対象範囲

`core`、`security`、`composition`に分かれている169 Fileを、srcの用途別15 Directoryと純粋な値取込みFile一つ、開発用scripts四Fileへ再配置する案である。`src/index.ts`は既存の公開入口として維持する。File名・export・状態・Authority・保存形式は第一段階では変更しない。

これは現行Architectureの配置を変更済みとする正本ではなく、採否と実装に使う全数対応計画である。責務の正本は[Coordinator詳細設計](../../../../06_Architecture/Details/coordinator/01_Architecture.md)、配置規則は[Coding Standards](../../../../06_Architecture/99_Coding_Standards.md#32-sourceの責務別配置と公開境界)に置く。

| 現行Directory | 対象File数 |
|---|---:|
| core | 24 |
| security | 140 |
| composition | 5 |
| 合計 | 169 |

Directory内の件数を均等にするのではなく、同じ利用目的・所有責務へ集める。`composition`を独立した層として残すことは必須ではない。組立てFileは各Capabilityの近くへ置き、Application処理を組立てと呼ばない。

## 2. 変更経路と着手前確認

- 今回の許可範囲は承認された169 Fileの配置換えと参照の追従、検証。動作変更、署名、Docker操作、Provider依頼、Commit/Pushは実施しない。
- 移動は実装配置変更として扱う。Source importだけでなく、公開入口、bin/scripts、試験、固定子Process入口、署名配布閉包、Symbol/Graph、文書の利用側を照合する。
- 規範・ARCH-IDの意味、Authority、Recovery Identity、公開操作、Native/Host契約、既存の実境界Capabilityは保持する。既存未接続範囲や失敗を配置変更の成果へ丸めない。
- 採用・実施前に配置案の独立確認を行う。移動後は参照集合・型・命名・直接利用側と影響する実境界を確認する。準拠基準やRelease判断を変えないため、本提案だけを理由に全準拠監査や署名E2Eを発火しない。
- 不明な巨大Fileは名前だけで分割・廃止しない。現在の責務まとまりへ仮配置し、第二段階の候補として下表に明示する。

## 3. 目標ツリー

以下のRootは `C:\project\CRDD\40_Develop\coordinator\` である。

```text
coordinator/
├ src/
│ ├ index.ts                       既存の公開入口
│ ├ plain-data-snapshot.ts         純粋な値取込み（1）
│ ├ cli/                           コマンド受付・対話端末（8）
│ ├ task/                          一般Taskの実行調整（5）
│ ├ provider/                      Provider選択と固有接続（25）
│ ├ external-send/                 外部送信の許可と出口制御（5）
│ ├ authority/                     権限・信頼・秘密情報の判断（8）
│ ├ repository-operation/          Repositoryと作業領域の結合（5）
│ ├ host-runtime/                  Host資源・子Process・実効排他（19）
│ ├ docker-runtime/                TaskのDocker隔離実行・回収（17）
│ ├ docker-desktop/                Docker Desktop/Engineの運用処置（15）
│ ├ platform-access/               Native/Platform Provisionerとの接続（9）
│ ├ state-storage/                 現在状態と共有保存primitive（4）
│ ├ candidate/                     候補本体の保存・Native接続（2）
│ ├ project-runtime/               Project Runtimeへの実行・判断接続（19）
│ ├ workbench-ai/                  WorkbenchのAI依頼と候補操作（14）
│ └ diagnostics/                   環境・配布物・実行時間の診断（9）
├ scripts/                         開発用の検査・実測・E2E入口
│ ├ check-runtime-traceability.ts                 既存の検査入口
│ ├ check-project-runtime-design-traceability.ts  既存の検査入口
│ ├ runtime-traceability.ts                       移動対象：検査実装
│ ├ project-runtime-design-traceability.ts        移動対象：検査実装
│ ├ verification-result-record.ts                移動対象：E2E結果記録
│ └ verification-result-reasons.ts               移動対象：E2E結果語彙
└ tests/                           試験・Fixture・試験補助
```

scriptsとtestsのツリーは変更境界の例示であり、既存Fileの全一覧ではない。対象169 Fileのうち165 Fileをsrcへ、四Fileをscriptsへ配置する。既存src/index.tsはこの169 File母集団の外側で維持する。

全用途Directoryはsrc直下とし、今回は子Directoryを追加しない。`internal/common/utils/helpers/domain/application`等の層・利用可否だけを表すDirectoryを新設しない。将来の第二階層は独立した境界が実証された場合だけ評価する。

## 4. フォルダごとの責務

| 配置先 | 移動対象File数 | 所有する用途と境界 |
|---|---:|---|
| `src/cli/` — コマンド受付・対話端末 | 8 | 引数、表示、対話入力、CLI取消と入口の振り分け。DockerやProvider実処理の所有先にはしない。 |
| `src/task/` — 一般Taskの実行調整 | 5 | Task要求・結果理由・Executor/Reviewerの実行調整。Provider固有コマンドとDocker資源管理は委譲する。 現在Runtimeから参照される開発計測Session/Constraintsはここへ仮配置し、通常実行との接続を保持したまま、計測専用処理の抽出を次段階で評価する。 |
| `src/provider/` — Provider選択と固有接続 | 25 | Provider/Model選定、Home、課金条件、Codex/Claude実行計画と結果変換。現在25件を平坦にまとめ、Provider別の子階層は先に増やさない。 |
| `src/external-send/` — 外部送信の許可と出口制御 | 5 | 送信同意、許可、一回消費と出口Proxy方針。認証秘密値やHost実行状態は所有しない。 |
| `src/authority/` — 権限・信頼・秘密情報の判断 | 8 | Grant検証、事前許可、Trust読取り評価、秘密情報拒否。安全性に関係する全処理の置場にはしない。 |
| `src/repository-operation/` — Repositoryと作業領域の結合 | 5 | 操作OwnerとRepository/Workspaceの結合、Root観測とRoot保護判断。Host操作ディレクトリの実体lifecycleはhost-runtimeへ委譲する。 |
| `src/host-runtime/` — Host資源・子Process・実効排他 | 19 | Host世代、操作ディレクトリ、端末、子Process環境、Native名前付きPipeによる排他と監視。候補・Project・Coordinatorが使う既存排他を一つの用途へ誤帰属させない。 |
| `src/docker-runtime/` — TaskのDocker隔離実行・回収 | 17 | Container/Network、実行要求とreceipt、停止・回収、Task回復状態。Docker Desktop製品自体の修復とは分ける。旧記録処理は縮小の本番切替後に必要性を再判定し、配置変更だけで廃止しない。 |
| `src/docker-desktop/` — Docker Desktop/Engineの運用処置 | 15 | Desktop修復、Engine再起動とhandoff、WSL観測。通常TaskのContainer清掃を入れない。 |
| `src/platform-access/` — Native/Platform Provisionerとの接続 | 9 | Platform Access応答、ProvisionerのManifest/配布Identity/Trust検証と鍵保護方針。Native本体の正本は別Subsystemに保持する。 |
| `src/state-storage/` — 現在状態と共有保存primitive | 4 | Coordinator stateモデル/Writer、安定File読取り、既存の保存確定Journal。Journalの外部送信同意・Project判断利用を保持し、Coordinator専用に作り替えない。汎用的な新Store Frameworkは作らない。 |
| `src/candidate/` — 候補本体の保存・Native接続 | 2 | 候補Bundleの保存・確認・回収とWindows Adapter。候補の採用判断はProject Runtime、Workbench利用側はworkbench-aiに保持する。 |
| `src/project-runtime/` — Project Runtimeへの実行・判断接続 | 19 | Objective受付、Task接続、採用/判断、保存・履歴、回復settlement、公開操作の構成。Project Runtime自身の業務正本をCoordinatorへ移さない。 |
| `src/workbench-ai/` — WorkbenchのAI依頼と候補操作 | 14 | 依頼状態・取消、助言Packet/結果/Provider境界、変更候補生成、候補確認/採用/破棄のApplication接続。UI描画や他Subsystemの正本は所有しない。 |
| `src/diagnostics/` — 環境・配布物・実行時間の診断 | 9 | doctor、Native runtime観測、配布Identity/Hash/署名の妥当性検証、実行時間の観測と結果説明。通常起動も使う検証関数はCLIや診断表示へ依存させず、同じFolder内で部品を分ける。新しいRelease処理やAuthorityは追加しない。 |
| `scripts/` — 開発用検査・E2Eの実装 | 4 | Traceabilityの検査二Fileと署名E2E結果記録・理由語彙二File。通常Runtimeの実装はここへ置かず、srcからscripts/testsへの逆参照を作らない。既存のScript入口と利用側を保つ。 |
| `tests/` — 試験・Fixture | 0 | 上記部品の試験、Fixture、試験専用補助。検査ツール本体や通常実行の実装を試験と混同しない。 |

小規模でも候補本体、Task調整、外部送信許可は別の変更理由と境界を持つため、巨大な総合Folderへまとめない。一方、排他や共有Journalは利用側ごとに複製しない。

### 今回の対話で修正した境界

| 旧提案 | 修正案 | 根拠・保持条件 |
|---|---|---|
| src/release四File | src/diagnosticsへ統合する。 | 配布物妥当性確認は環境診断へ含める。通常起動でも使う検証本体を表示処理へ依存させない。リリース操作のFolderと誤認させない。 |
| Traceability二File | scriptsへ置く。 | check Scriptと試験からの利用を確認。試験自体はtestsへ保持する。旧Registryの処遇は配置変更だけで決めない。 |
| 検証結果記録・語彙二File | scriptsへ置く。 | 署名E2Eのverify Scriptが利用する実装であり、通常Task結果とは別の契約である。 |
| 開発計測三File | 時間観測はsrc/diagnostics、Session/Constraintsはsrc/taskへ仮配置する。 | 通常RuntimeのTask・候補・同意・回復・Host/Home Adapterから参照されるため一括でtestsへ移せない。計測専用部分の抽出は後段で評価する。 |

`scripts`は[Coding Standards §3.2](../../../../06_Architecture/99_Coding_Standards.md#32-sourceの責務別配置と公開境界)の用途限定Scriptに限る。今回の四Fileは検査・E2Eの実装であり、通常の実行本体をscriptsへ退避する案ではない。移動時に全呼出し元を再確認し、通常Runtimeの利用が新たに見つかればその部分をsrcへ保持する。検査関数を使う試験が存在することだけをtests配置の理由にしない。

## 5. 全169 Fileの配置対応表

表のPathはすべて `40_Develop/coordinator/` からの相対Pathである。現在Fileを一度ずつ列挙し、scripts行も含めて移動先を一意に示す。File名は維持し、注記は機能分割・廃止を即実施する指示ではない。

### コマンド受付・対話端末 — 8 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/cli-options.ts` | `src/cli/cli-options.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/command-report.ts` | `src/cli/command-report.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/coordinator-command.ts` | `src/cli/coordinator-command.ts` | CLIの振り分けを所有。下位実処理の混在は移動後に評価する。 |
| `src/core/coordinator-launch.ts` | `src/cli/coordinator-launch.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/interactive-console-reader-lifecycle-internal.ts` | `src/cli/interactive-console-reader-lifecycle-internal.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/interactive-console-reader.ts` | `src/cli/interactive-console-reader.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/interactive-console.ts` | `src/cli/interactive-console.ts` | CLIの対話状態と端末lifecycleを保持する。 |
| `src/core/task-cli-cancellation.ts` | `src/cli/task-cli-cancellation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 一般Taskの実行調整 — 5 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/coordinator-task-request.ts` | `src/task/coordinator-task-request.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/coordinator-task-result-reasons.ts` | `src/task/coordinator-task-result-reasons.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/coordinator-task-runtime.ts` | `src/task/coordinator-task-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/development-measurement-constraints.ts` | `src/task/development-measurement-constraints.ts` | 計測Sessionが使う実行制約。Sessionと一緒にTask側へ仮配置し、試験専用と断定しない。 |
| `src/security/development-measurement-session.ts` | `src/task/development-measurement-session.ts` | Task・候補・同意・回復・Host/Home Adapterから参照される。tests/scriptsへ直接移さず、Task側の接続を保持して計測専用処理の抽出を評価する。 |

### Provider選択と固有接続 — 25 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/claude-docker-runtime-adapter.ts` | `src/provider/claude-docker-runtime-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/claude-execution-plan.ts` | `src/provider/claude-execution-plan.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/claude-structured-result.ts` | `src/provider/claude-structured-result.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/claude-subscription-authentication.ts` | `src/provider/claude-subscription-authentication.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/codex-advice-distribution.ts` | `src/provider/codex-advice-distribution.ts` | 公式Codex CLI/Host配布のProvider固有Identity。Runtime全体の署名Ownerではない。 |
| `src/security/codex-docker-runtime-adapter.ts` | `src/provider/codex-docker-runtime-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/codex-execution-plan.ts` | `src/provider/codex-execution-plan.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/codex-executor-seccomp.ts` | `src/provider/codex-executor-seccomp.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/codex-structured-result.ts` | `src/provider/codex-structured-result.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/delegation-route-selection.ts` | `src/provider/delegation-route-selection.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/delegation-selection-grant-runtime.ts` | `src/provider/delegation-selection-grant-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-authority-runtime.ts` | `src/provider/provider-authority-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-billing-policy.ts` | `src/provider/provider-billing-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-eligibility-runtime.ts` | `src/provider/provider-eligibility-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-home-mount-grant-runtime.ts` | `src/provider/provider-home-mount-grant-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-home-mount-grant.ts` | `src/provider/provider-home-mount-grant.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-home-observation.ts` | `src/provider/provider-home-observation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-home-windows-adapter.ts` | `src/provider/provider-home-windows-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-home.ts` | `src/provider/provider-home.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-isolation-profile.ts` | `src/provider/provider-isolation-profile.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-lifecycle.ts` | `src/provider/provider-lifecycle.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-model-profile-runtime.ts` | `src/provider/provider-model-profile-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-model-selection-runtime.ts` | `src/provider/provider-model-selection-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-task-packet-runtime.ts` | `src/provider/provider-task-packet-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provider-task-structured-result.ts` | `src/provider/provider-task-structured-result.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 外部送信の許可と出口制御 — 5 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/egress-proxy-policy.ts` | `src/external-send/egress-proxy-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/external-send-consent-record.ts` | `src/external-send/external-send-consent-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/external-send-consent-runtime.ts` | `src/external-send/external-send-consent-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/external-send-grant-runtime.ts` | `src/external-send/external-send-grant-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/external-send-policy-runtime.ts` | `src/external-send/external-send-policy-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 権限・信頼・秘密情報の判断 — 8 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/authority-file-bundle.ts` | `src/authority/authority-file-bundle.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/authority-grant-verifier.ts` | `src/authority/authority-grant-verifier.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/authority-prelaunch-verifier.ts` | `src/authority/authority-prelaunch-verifier.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/authority-root-path-lexical.ts` | `src/authority/authority-root-path-lexical.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/authority-trust-loader.ts` | `src/authority/authority-trust-loader.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/local-personal-authority-runtime.ts` | `src/authority/local-personal-authority-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/runtime-trust-evaluator.ts` | `src/authority/runtime-trust-evaluator.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/secret-material-policy.ts` | `src/authority/secret-material-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### Repositoryと作業領域の結合 — 5 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/coordinator-operation-creation-internal.ts` | `src/repository-operation/coordinator-operation-creation-internal.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/repository-operation-runtime.ts` | `src/repository-operation/repository-operation-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/repository-workspace-runtime.ts` | `src/repository-operation/repository-workspace-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/root-observation.ts` | `src/repository-operation/root-observation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/root-protection-policy.ts` | `src/repository-operation/root-protection-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### Host資源・子Process・実効排他 — 19 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/host-generation-loss-transition.ts` | `src/host-runtime/host-generation-loss-transition.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/node-runtime-version.ts` | `src/host-runtime/node-runtime-version.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/runtime-local-typescript-child-entrypoints.ts` | `src/host-runtime/runtime-local-typescript-child-entrypoints.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/runtime-process-safety-state.ts` | `src/host-runtime/runtime-process-safety-state.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/windows-child-environment.ts` | `src/host-runtime/windows-child-environment.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/candidate-store-kernel-lock-lifecycle-internal.ts` | `src/host-runtime/candidate-store-kernel-lock-lifecycle-internal.ts` | 既存排他のlifecycleを保持。internalという子Directoryは追加しない。 |
| `src/security/candidate-store-kernel-lock.ts` | `src/host-runtime/candidate-store-kernel-lock.ts` | 候補以外にも使われる実効排他。まず名前とexportを保持し、改名は別差分として検討する。 |
| `src/security/candidate-store-lock-worker.ts` | `src/host-runtime/candidate-store-lock-worker.ts` | 起動Pathが変わるため固定child entrypointと配布閉包を同時更新する。 |
| `src/security/execution-environment.ts` | `src/host-runtime/execution-environment.ts` | Host世代・作業領域・Mount/Capabilityを保持。移動後に責務分割を評価する。 |
| `src/security/host-operation-inprocess-lease-internal.ts` | `src/host-runtime/host-operation-inprocess-lease-internal.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-operation-lock-supervisor.ts` | `src/host-runtime/host-operation-lock-supervisor.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-orphan-recovery-policy.ts` | `src/host-runtime/host-orphan-recovery-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-recovery-namespace-windows-adapter.ts` | `src/host-runtime/host-recovery-namespace-windows-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-recovery-record.ts` | `src/host-runtime/host-recovery-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-terminal-caller-checkpoint.ts` | `src/host-runtime/host-terminal-caller-checkpoint.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-terminal-caller-lease.ts` | `src/host-runtime/host-terminal-caller-lease.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-terminal-record.ts` | `src/host-runtime/host-terminal-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/host-terminal-windows-adapter.ts` | `src/host-runtime/host-terminal-windows-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/windows-directory-bootstrap.ts` | `src/host-runtime/windows-directory-bootstrap.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### TaskのDocker隔離実行・回収 — 17 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/docker-cleanup-eligibility.ts` | `src/docker-runtime/docker-cleanup-eligibility.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-cli-trust.ts` | `src/docker-runtime/docker-cli-trust.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-container-init-observation.ts` | `src/docker-runtime/docker-container-init-observation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-effect-runtime.ts` | `src/docker-runtime/docker-effect-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-host-transition-state.ts` | `src/docker-runtime/docker-host-transition-state.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-isolation.ts` | `src/docker-runtime/docker-isolation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-owned-process.ts` | `src/docker-runtime/docker-owned-process.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-process-controller-result-reasons.ts` | `src/docker-runtime/docker-process-controller-result-reasons.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-process-controller.ts` | `src/docker-runtime/docker-process-controller.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-identity.ts` | `src/docker-runtime/docker-recovery-identity.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-lock-controller.ts` | `src/docker-runtime/docker-recovery-lock-controller.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-public-projection.ts` | `src/docker-runtime/docker-recovery-public-projection.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-record-model.ts` | `src/docker-runtime/docker-recovery-record-model.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-runtime-internal.ts` | `src/docker-runtime/docker-recovery-runtime-internal.ts` | 回復縮小の切替対象。移動だけで旧保存・Host前提を削除しない。 |
| `src/security/docker-recovery-runtime.ts` | `src/docker-runtime/docker-recovery-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-state-machine.ts` | `src/docker-runtime/docker-recovery-state-machine.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-runtime-state-binding.ts` | `src/docker-runtime/docker-runtime-state-binding.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### Docker Desktop/Engineの運用処置 — 15 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/docker-restart-execution.ts` | `src/docker-desktop/docker-restart-execution.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/docker-restart-state.ts` | `src/docker-desktop/docker-restart-state.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-current-artifact-trust.ts` | `src/docker-desktop/docker-desktop-current-artifact-trust.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-repair-continuation-store.ts` | `src/docker-desktop/docker-desktop-repair-continuation-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-repair-history-publication.ts` | `src/docker-desktop/docker-desktop-repair-history-publication.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-repair-native-process-lifecycle.ts` | `src/docker-desktop/docker-desktop-repair-native-process-lifecycle.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-repair-native-process.ts` | `src/docker-desktop/docker-desktop-repair-native-process.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-repair-record-store.ts` | `src/docker-desktop/docker-desktop-repair-record-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-desktop-runtime-repair.ts` | `src/docker-desktop/docker-desktop-runtime-repair.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-restart-continuation-record.ts` | `src/docker-desktop/docker-restart-continuation-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-restart-handoff-record.ts` | `src/docker-desktop/docker-restart-handoff-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-restart-machine.ts` | `src/docker-desktop/docker-restart-machine.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-restart-record.ts` | `src/docker-desktop/docker-restart-record.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-restart-runtime.ts` | `src/docker-desktop/docker-restart-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-wsl-state.ts` | `src/docker-desktop/docker-wsl-state.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### Native/Platform Provisionerとの接続 — 9 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/platform-access-adapter.ts` | `src/platform-access/platform-access-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-key-storage-policy.ts` | `src/platform-access/platform-key-storage-policy.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-manifest-loader.ts` | `src/platform-access/platform-provisioner-manifest-loader.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-package-filesystem.ts` | `src/platform-access/platform-provisioner-package-filesystem.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-package-gate.ts` | `src/platform-access/platform-provisioner-package-gate.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-policy-identity.ts` | `src/platform-access/platform-provisioner-policy-identity.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-release-identity.ts` | `src/platform-access/platform-provisioner-release-identity.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-release-trust.ts` | `src/platform-access/platform-provisioner-release-trust.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-provisioner-trust-core.ts` | `src/platform-access/platform-provisioner-trust-core.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 現在状態と共有保存primitive — 4 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/bounded-file-snapshot.ts` | `src/state-storage/bounded-file-snapshot.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/coordinator-state-model.ts` | `src/state-storage/coordinator-state-model.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/coordinator-state-runtime.ts` | `src/state-storage/coordinator-state-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/docker-recovery-journal.ts` | `src/state-storage/docker-recovery-journal.ts` | 同意・Project判断にも利用される既存primitive。Docker専用へ限定しない。 |

### 候補本体の保存・Native接続 — 2 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/candidate-bundle-store.ts` | `src/candidate/candidate-bundle-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/candidate-store-windows-adapter.ts` | `src/candidate/candidate-store-windows-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### Project Runtimeへの実行・判断接続 — 19 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/composition/project-runtime-composition-root.ts` | `src/project-runtime/project-runtime-composition-root.ts` | 移動後に組立て／要求変換／操作実行／診断の責務分割を評価する。 |
| `src/composition/project-runtime-public-adapter.ts` | `src/project-runtime/project-runtime-public-adapter.ts` | 公開入口index.tsからの接続を保持する。 |
| `src/security/docker-project-recovery-settlement.ts` | `src/project-runtime/docker-project-recovery-settlement.ts` | Project状態からDocker回復settlementを確かめる境界Adapterとして配置する。 |
| `src/security/execution-intelligence-adapter.ts` | `src/project-runtime/execution-intelligence-adapter.ts` | Project RuntimeのAttemptイベントをExecution Intelligenceへ変換する境界として配置する。 |
| `src/security/project-runtime-acceptance-authority-adapter.ts` | `src/project-runtime/project-runtime-acceptance-authority-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-acceptance-decision-store.ts` | `src/project-runtime/project-runtime-acceptance-decision-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-candidate-integration-adapter.ts` | `src/project-runtime/project-runtime-candidate-integration-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-decision-capability-adapter.ts` | `src/project-runtime/project-runtime-decision-capability-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-decision-recovery-store.ts` | `src/project-runtime/project-runtime-decision-recovery-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-durable-foundation.ts` | `src/project-runtime/project-runtime-durable-foundation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-execution-authorization-adapter.ts` | `src/project-runtime/project-runtime-execution-authorization-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-execution-host-adapter.ts` | `src/project-runtime/project-runtime-execution-host-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-history.ts` | `src/project-runtime/project-runtime-history.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-integration-record-adapter.ts` | `src/project-runtime/project-runtime-integration-record-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-objective-intake.ts` | `src/project-runtime/project-runtime-objective-intake.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-single-task-adapter.ts` | `src/project-runtime/project-runtime-single-task-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-task-recovery-adapter.ts` | `src/project-runtime/project-runtime-task-recovery-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-windows-decision-store.ts` | `src/project-runtime/project-runtime-windows-decision-store.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/project-runtime-windows-platform-adapter.ts` | `src/project-runtime/project-runtime-windows-platform-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### WorkbenchのAI依頼と候補操作 — 14 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/composition/workbench-ai-repository-composition.ts` | `src/workbench-ai/workbench-ai-repository-composition.ts` | 移動後に依存組立てとProject Context読取り／Packet変換の境界を評価する。 |
| `src/composition/workbench-ai-request-application.ts` | `src/workbench-ai/workbench-ai-request-application.ts` | Application状態・観測・取消のOwnerとして配置する。単なる組立てではない。 |
| `src/composition/workbench-candidate-application.ts` | `src/workbench-ai/workbench-candidate-application.ts` | 候補操作Applicationとして配置する。Storeや採用Authorityは引き取らない。 |
| `src/security/workbench-ai-advice-dispatch-runtime.ts` | `src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-execution-plan.ts` | `src/workbench-ai/workbench-ai-advice-execution-plan.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-production-runtime.ts` | `src/workbench-ai/workbench-ai-advice-production-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-provider-command.ts` | `src/workbench-ai/workbench-ai-advice-provider-command.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-provider-executor.ts` | `src/workbench-ai/workbench-ai-advice-provider-executor.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-provider-output.ts` | `src/workbench-ai/workbench-ai-advice-provider-output.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-result.ts` | `src/workbench-ai/workbench-ai-advice-result.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-runtime-packet.ts` | `src/workbench-ai/workbench-ai-advice-runtime-packet.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-advice-task.ts` | `src/workbench-ai/workbench-ai-advice-task.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-change-candidate-runtime.ts` | `src/workbench-ai/workbench-ai-change-candidate-runtime.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/workbench-ai-provider-adapter.ts` | `src/workbench-ai/workbench-ai-provider-adapter.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 環境・配布物・実行時間の診断 — 9 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/development-execution-timing.ts` | `src/diagnostics/development-execution-timing.ts` | Task実行側からも使う受動的な時間観測。診断部品としてsrcへ保持する。 |
| `src/core/docker-desktop-repair-doctor-dispatch.ts` | `src/diagnostics/docker-desktop-repair-doctor-dispatch.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/docker-recovery-command-report.ts` | `src/diagnostics/docker-recovery-command-report.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/core/doctor.ts` | `src/diagnostics/doctor.ts` | 診断の統括として配置。実修復と結果表示の混在は移動後に評価する。 |
| `src/security/native-runtime-trace.ts` | `src/diagnostics/native-runtime-trace.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/platform-access-release.ts` | `src/diagnostics/platform-access-release.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/provisioning-signature-primitives.ts` | `src/diagnostics/provisioning-signature-primitives.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/release-identity-grammar.ts` | `src/diagnostics/release-identity-grammar.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |
| `src/security/signed-runner-safety-observation.ts` | `src/diagnostics/signed-runner-safety-observation.ts` | 配置変更と参照追従のみ。意味・exportは維持する。 |

### 開発用scripts — 4 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/core/project-runtime-design-traceability.ts` | `scripts/project-runtime-design-traceability.ts` | 検査または署名E2E Scriptと試験の呼出しを確認。用途限定Scriptの実装として配置し、通常Runtimeからscriptsへ依存させない。 |
| `src/core/runtime-traceability.ts` | `scripts/runtime-traceability.ts` | 検査または署名E2E Scriptと試験の呼出しを確認。用途限定Scriptの実装として配置し、通常Runtimeからscriptsへ依存させない。 |
| `src/core/verification-result-reasons.ts` | `scripts/verification-result-reasons.ts` | 検査または署名E2E Scriptと試験の呼出しを確認。用途限定Scriptの実装として配置し、通常Runtimeからscriptsへ依存させない。 |
| `src/core/verification-result-record.ts` | `scripts/verification-result-record.ts` | 検査または署名E2E Scriptと試験の呼出しを確認。用途限定Scriptの実装として配置し、通常Runtimeからscriptsへ依存させない。 |

### src直下 — 1 File

| 現在 | 配置先 | 処置・注意 |
|---|---|---|
| `src/security/plain-data-snapshot.ts` | `src/plain-data-snapshot.ts` | 単一の純粋な値取込みprimitiveとしてsrc直下に置く。common/utilsは新設しない。 |

## 6. 移動と責務分割を分ける

| 段階 | 実施すること | 実施しないこと |
|---|---|---|
| 1. 全数配置変更 | 採用された対応表どおりにFileを移動し、全Consumerのimportと固定Pathを追従する。index.tsの公開Symbol集合は保持する。 | 関数・状態・拒否条件・Capability・保存形式の変更、互換Reader追加。 |
| 2. 混在責務の限定分割 | 大きさではなく実際の別責務を根拠に、組立てとApplication、Host資源Owner、Docker回復処理等の分割を評価する。採用したものだけ実施する。 | 名前だけの新Subsystem化、汎用Framework追加、未接続の旧処理を不要と扱うこと。 |
| 3. 古い置場の撤去 | 全移行先・利用側・試験を照合し、core/security/compositionが空になったことを確認する。 | 古いDirectoryに再export shimを残して新旧を恒久二重化すること。 |

`project-runtime-composition-root.ts`はまずproject-runtimeへ移し、組立て・要求変換・操作実行・診断の各責務を次段階で評価する。`workbench-ai-request-application.ts`は依頼状態と取消のOwnerであり、組立てDirectoryへ残さない。`execution-environment.ts`と`docker-recovery-runtime-internal.ts`の機能分割は今回の配置表だけで確定しない。

## 7. 移動時に照合する利用側

| 利用側 | 必要な処置・確認 |
|---|---|
| Source / src/index.ts / bin | 相対importの全数更新と、公開Symbol集合の不変確認。公開Entryを増やさない。 |
| scripts / tests / package / tsconfig | 明示Path、Coverage include、Host/portable Profile、Fixture起動Path、全Source所属を照合する。 |
| 子Process / Lock worker / Native起動 | 固定entrypoint登録、import.meta起点のPath、Worker起動・解放・親喪失を確認する。型Passだけで起動成立としない。 |
| Runtime配布 / 署名 / Manifest | Source Pathを含む配布閉包とIdentityの変更を確認する。旧署名を新配置の検証根拠に転用しない。実署名の実行は別途人間操作へ接続する。 |
| 他Subsystem / thin Tool入口 | 直接importと公開入口を区別し、利用側母集団の参照を追従する。新しい公開indexを機械的に増設しない。 |
| Symbol / 能力Graph / Semantic Coverage | 実Pathの変更へProjectionを追従する。意味IDとARCH-ID、QA Local Itemを配置だけで再採番しない。 |
| Architecture / Quality / Workflow / README | 現行配置の参照と責務説明を更新する。過去Evidenceの対象版Pathは履歴として保持する。 |
| 既存の未完了・失敗 | 保存Portの専用反例2件、本番切替、全体Graph既知停止等は別に維持し、配置整理で解消したと表示しない。 |

## 8. 配置表の確認方法と限界

移動直前の途中保存Commit `bfe6d43e`にあるsrc/core、src/security、src/composition直下のFile集合を表の移動前Path集合と完全一致で確認し、各Fileの移動先が一つだけで、移動先Pathに重複がないことを検査する。移動後は旧Pathの不存在と新Pathの存在を全件確認する。件数169だけをCoverageの根拠にしない。

本提案は、File一覧、主要な責務宣言、公開関数、関係するimportと既存配置規則から作成した。全関数を再設計した結果ではなく、依存の循環解消、各Folderの完全な公開契約、本番接続および実境界回帰を完了したとは主張しない。移動前に基準Capability・過去Evidence・配布閉包と全参照を固定し、移動と意味変更を混ぜない。

## 9. 実施結果と残る境界

- 169 Fileを対応表どおりに移動し、旧三Directoryを除去した。関連import、固定子入口、配布閉包、型設定、Coverage参照、SymbolのPathおよび現行文書を追従した。安定Symbol IDは改名しない。
- `src/index.ts`の公開Symbol集合、子入口四件の役割と種類、Authority、状態・保存形式を保持した。移動元と移動先の全件比較では、許可したPath変更と整形以外の差を残していない。
- 独立確認の指摘により、Directory文字列の機械正規化が混入した判定とURLを元の契約へ戻した。監視対象26関数は本文Hash不変を確認し、既存algorithmで新Pathのscopeに結合するGraph Hashだけを再導出した。
- Coordinatorおよび直接利用側六packageの型検査はPass。関連167試験は166件Passと期待集合の並び順差一件を検出し、集合を保持して是正・再実行Pass。Traceability検査二種もPass。
- 配布Capability Graphの全体検査は、基準から存在する`check-platform-access-coverage.ts`の`child_process_unbound`を残す。既存の命名指摘、Test HeaderとSymbol Relationの未接続、現在状態保存Sliceの専用fault試験二件も別残件であり、この配置変更の完成へ丸めない。
- 移動前の全回帰は長時間の配布契約試験で打ち切った。全回帰、実Docker／Provider、署名およびE2Eの完了は主張しない。配置変更の独立再確認と代表的な配布改ざん拒否を別に評価する。
- `bfe6d43e`は利用者が指定した移動前のステージ済み20 Fileだけの途中保存である。その後、利用者が配置変更のCommit／Pushを明示承認した。リリース・統合・実署名の承認とは区別する。
- 是正後の固定候補について限定配置レビューはPass。追加必須指摘はない。Registry漏れ、直接Worker、宣言削除、重複Path、alias import、内部lifecycle importの代表六反例もPass。全機能完成、配布閉包全体Passまたはリリース承認を意味しない。

## Checklist

- [x] core/security/compositionの全Fileを一つずつ処置した。
- [x] 配置先を公開／非公開の層ではなく用途と責務で命名した。
- [x] src直下のindex.tsを公開入口として保持する案にした。
- [x] 共有排他・保存primitiveを用途ごとに複製しない。
- [x] 物理移動と責務分割、旧回復縮小の機能切替を区別した。
- [x] 開発用scripts、試験tests、通常Runtimeのsrcを呼出し元に基づいて区別した。
- [x] src/release・src/verificationを新設しない案へ修正した。
- [x] 署名閉包、固定Worker入口、試験・利用側のPath追従を計画へ含めた。
- [x] 全数のSource移動と参照追従を実施し、実行契約変更を混ぜていない。
- [x] 配置案を人間が承認し、着手前の独立確認を実施した。
- [x] 完成候補の独立確認二指摘を是正し、新しい固定候補の限定配置レビューがPassした。全体検査の既存残件は§9に分離した。
- [x] N/A: 全関数の責務再設計と依存循環解消は対象外。公開集合と固定入口を照合し、未確認の機能変更を配置整理に含めない。
