# `.crdd` Runtime Dataの現行Path棚卸し

状態: Candidate（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-12

## 1. 目的と判断境界

この棚卸しは、検証済みRepository Root直下の`.crdd`について、現行実装が書き込む論理Pathと、CRDD公式Repositoryに残る物理Artifactを分けて確定する。正式なDirectory Taxonomy、移行、削除または保持期間は、この棚卸しだけでは決定しない。

| 今回行うこと | 今回行わないこと |
|---|---|
| 現行Producer、Reader、用途、耐久性、清掃・回復条件を特定する | Directory名やSchemaを先に最終決定する |
| Sourceから導出したPathと、物理的に存在するPathを分ける | 存在だけを根拠に現行契約へ昇格する |
| 所有・寿命・回復が不明な領域を明示する | 不要と推定して移動・削除する |
| 次の設計で解消すべき不整合を固定する | Runtimeの振る舞い、署名、E2Eを変更する |

基準規則は[Repository-local作業領域](../../03_Documentation.md#repository-local-working-storage)と[実装上のRepository境界](../99_Coding_Standards.md)である。現行規則では`.crdd`直下の通常fileは`external-send-policy.json`だけを許し、それ以外は用途を表す子Directoryへ置く。v0.21の目標構成では、同Policyも`config/`へ移し、直下fileを0件にする。目標と移行境界は[Runtime Dataの目標Architecture](02_Target_Architecture.md)を正本候補とする。

## 2. 調査方法と現在の範囲

| 観測 | 対象 | 扱い |
|---|---|---|
| Source導出 | `40_Develop`の本番Source、Release／検証Script、試験支援Source | 現行ProducerまたはReaderの根拠 |
| 物理観測 | CRDD公式Repositoryの`.crdd`直下と配下 | 現状の残存量・命名の根拠。現行性は別判定 |
| 規則照合 | 文書化、Maintenance、Coding Standards | 既定のRoot、Git、寿命、清掃境界 |

2026-09-12の物理観測では、`.crdd`直下に19 Directory、150 file、配下合計120,542 file、約2.93 GiBが存在した。直下fileの内訳はPowerShell 79、TypeScript 42、JSON 11、log 10、Markdown 5、CommonJS 2、TAP 1である。これは現行Runtime契約ではなく、v0.18からv0.20の署名、診断、回復、試験および手動作業が同じRootへ累積した状態を示す。

## 3. 基準版から導出した旧書込みPath

次表は`v0.20.0`を基準に移行対象を固定した記録であり、v0.21の現行Pathではない。v0.21の現行Pathと所有関係は[Runtime Dataの目標Architecture](02_Target_Architecture.md)を正本とする。

| 論理Path | Owner／主なProducer | 主なReader | 用途・Schema | Git | 寿命 | 清掃・Recovery | 根拠 |
|---|---|---|---|---|---|---|---|
| `.crdd/external-send-policy.json` | Repositoryの決定権限者／Coordinator Policy Loader | Coordinator、Release Identity検証 | 外部送信のRepository設定、`crdd-coordinator/external-send-policy/v2` | 明示allowlistで追跡 | Repository設定として耐久 | 自動清掃しない。変更は通常のGit差分・レビュー・移行で扱う | `external-send-policy-runtime.ts`、`platform-provisioner-release-identity.ts` |
| `.crdd/execution/events/<event-id>.json` | 実行知Store | 実行知Reader／集約 | 不変の実行Event | Runtime-only | 耐久Evidence | 同一ID同一byteは冪等。現在、保持期限と物理削除は未実装 | `execution-intelligence-store.ts` |
| `.crdd/execution/.mutation-lock/` | 実行知Store | 同Store | Process間排他とOwner記録 | Runtime-only | 一時 | 正常終了で削除。解放不明は手動回復候補として保持 | `execution-intelligence-store.ts` |
| `.crdd/project-runtime/states/<project-id>/` | Project Runtime永続化Adapter | Project State Reader | 世代付きProject State | Runtime-only | 耐久状態 | 上書きせず世代を追加。保持・圧縮・削除条件は未定 | `project-runtime-durable-foundation.ts` |
| `.crdd/project-runtime/queue/<queue-id>/` | Project Runtime永続化Adapter | Queue選択・更新・Recovery | 世代付きQueue Entry | Runtime-only | 耐久状態 | Recovery参照を含む。完了後の保持・削除条件は未定 | `project-runtime-durable-foundation.ts` |
| `.crdd/project-runtime/locks/` | Project Runtime Lease | Lease／Owner Loss／Recovery | Lock、取得中・所有・解放不明Marker | Runtime-only | 一時＋回復境界 | 正常releaseで削除。不明時はexact Recovery Identityで再入場 | `project-runtime-durable-foundation.ts` |
| `.crdd/project-runtime/leases/` | Project Runtime Lease | Lease検証・Recovery | Lease取得・解放のEvidence | Runtime-only | 耐久Evidence | Recovery settlement後もEvidence保持。保持期限は未定 | `project-runtime-durable-foundation.ts` |
| `.crdd/project-runtime/decision-recovery/<recovery-hash>/` | 人間判断Recovery Store | 判断再開 | 世代付きRecovery Intent | Runtime-only | Recovery完了まで耐久 | exact Recovery IDで再入場。完了後の保持・削除条件は未定 | `project-runtime-decision-recovery-store.ts` |
| `.crdd/project-runtime/integration/<project-id>/` | Integration Record Adapter | Project Runtime／投影 | 不変の統合結果 | Runtime-only | 耐久結果 | 同一Identityの異内容を拒否。保持期限は未定 | `project-runtime-integration-record-adapter.ts` |
| `.crdd/project-runtime/adoption/<project-id>/` | Integration Record Adapter | Project Runtime／投影 | 不変の採用結果 | Runtime-only | 耐久結果 | 同一Identityの異内容を拒否。保持期限は未定 | `project-runtime-integration-record-adapter.ts` |
| `.crdd/project-runtime/adoption/<transaction-id>/` | Candidate Integration Adapter | 同Adapter | 適用中のbackup／rollback領域 | Runtime-only | 一時 | 成功時またはrollback成立時に削除。回収不明時の外部契約は未整理 | `project-runtime-candidate-integration-adapter.ts` |
| `.crdd/project-runtime/adoption-base-*` | Candidate Integration Adapter | 同Adapter | 基準Commitの一時展開 | Runtime-only | 一時 | 比較後に再帰削除。Process中断時の残存分類は未整理 | `project-runtime-candidate-integration-adapter.ts` |
| `.crdd/verification-results/<record-id>/` | 正式検証Recorder／実Provider検証Script | 人間、Release確認 | `started.json`、`result.json`、`complete.json`等の検証Evidence | Runtime-only | 耐久Evidence | 過去Evidenceを自動削除しない。容量上限到達後のRetention手順は未定 | `verification-result-record.ts`、`verify-project-runtime-real-providers.ts` |
| `.crdd/release-staging/<candidate-id>/` | Release Candidate準備・署名Script | 署名、Promotion、正式検証 | 固定Commitの配布候補、Manifest、署名 | Runtime-only | Release処置完了まで耐久 | `.preparing`は失敗残存を報告し、候補は明示Promotion／廃棄まで保持。統一Retentionは未定 | `prepare-release-candidate.ts`、`sign-release-manifest.ts`、`promote-release-manifest.ts` |
| `.crdd/dogfooding/<result>.json` | 開発Provider比較Script | 人間／実行知分析 | 限定実測結果 | Runtime-only | Evidence候補 | 自動清掃・昇格・保持期限は未定 | `measure-development-providers.ts` |
| `.crdd/test-tmp/**` | Coordinator／Checker試験支援 | 同じ試験 | Git fixture、子Process、一時実境界 | Runtime-only | 一時 | 個別試験が清掃するが、名称が現行規則の`.crdd/tests/<execution-unit>/`と不一致 | `coordinator/tests/**`、`checker/tests/**` |
| `.crdd/test-fixtures/**`、`.crdd/native-fixture/**` | 一部の結合試験 | 同じ試験 | 鍵・Native配布等の試験fixture | Runtime-only | 一時 | 試験単位で清掃。標準`tests/<execution-unit>`への所属が未整理 | `generate-release-key.contract.test.ts`、`development-native-observation.integration.test.ts` |

表は論理Path patternを一次キーとする。一時fileの`.pending-*`、`.tmp`、backup等は親領域のLifecycleへ含め、個別file名を第二の正本にしない。

## 4. 物理観測されたTop-level Directory

| 分類 | 物理Directory | 現在の判断 |
|---|---|---|
| Sourceで現行Producerを確認 | `execution`、`project-runtime`、`release-staging`、`verification-results`、`dogfooding` | §3の現行契約候補へ接続する |
| 現行規則の候補名 | `tests`、`tmp`、`diagnostics` | 目的は妥当だが、全Producerの接続とLifecycleは未確定 |
| 旧名または重複候補 | `test-tmp`、`test-fixtures`、`native-test-temp` | `tests/<execution-unit>`へ統合できるか、ConsumerとRecoveryを確認して判断する |
| Release／E2Eの作業残存 | `development-distributions`、`e2e-distributions`、`e2e-results`、`e2e-targets`、`e2e-worktrees`、`release-audit`、`release-e2e` | 現行Sourceの正規Ownerを確認できていない。Release staging、tests、verification resultsのいずれへ属するか再分類が必要 |
| 手動作業または旧再開情報 | `launch-draft` | 現行ProducerとReaderを確認できていない。削除せず由来と参照を確認する |

物理量は偏っている。`release-staging`は約1.03 GB、`e2e-distributions`は約0.75 GB、`dogfooding`は約0.44 GB、`tests`は約0.39 GB、`e2e-targets`は約0.33 GBであり、Retentionとcleanupを定義しないまま実行を重ねると継続的に増加する。

## 5. 直下fileの不整合

`external-send-policy.json`以外の直下150 fileは、現行のRepository-local作業領域規則に適合しない。内容は主に次の作業群である。

| 作業群 | 代表例 | 処置前に確認すること |
|---|---|---|
| 署名・E2E Launcher | `sign-v020-*.ps1`、`run-v020-*.ps1` | 対応する候補・Evidence・未完了Recoveryから参照されていないか |
| Docker診断・回復 | `diagnose-*`、`recover-*`、`repair-*`、`close-*` | exact Recovery／Repair Identityと未完了義務の有無 |
| 回帰・診断結果 | `*.log`、`*.tap`、`*-result.json` | 正式Evidenceへの昇格済みか、再生成可能か |
| 一時Migration／Probe | `migrate-*`、`probe-*`、`preflight-*` | 現行Sourceへ吸収済みか、再開入口として残っていないか |
| 作業メモ | `*.md` | 正本へ昇格済みか、単なる一時メモか |

これらを一括削除するAuthorityは、この棚卸しからは発行しない。次の設計では、新規書込みを用途Directoryへ強制し、既存残存は参照とRecovery義務を確認した移行台帳から処置する。

## 6. 基準版で見つかった事項とv0.21の処置

| 基準版で見つかった事項 | v0.21の処置 | 現在状態 |
|---|---|---|
| `.crdd` PathのOwnerが複数Componentと手動Launcherへ分散 | 共通Path Resolver、Test CatalogのOwner／利用側接続、旧Path拒否へ統合 | 実装・試験済み |
| `test-tmp`、`tests`、`tmp`等の重複名 | 試験生成物を`tests/<execution-unit>/<run-id>/`、Operation中間物を`tmp/<operation-id>/`へ分離 | 実装・試験済み |
| `project-runtime/adoption/`に耐久結果と作業Transactionが混在 | 確定結果を`results/`、未確定処理を`work/`へ分離 | 利用側移行済み |
| `.crdd`直下fileの生成を防げない | 追跡可能な非秘密設定を`config/`へ移し、旧直下PathをCheckerで拒否 | 実装・試験済み |
| `tmp/`の正式なOwnerと清掃契約がない | exact Operation Identity、全終端経路、Evidence昇格、親Process喪失時Recoveryを契約化 | 11件の契約・結合試験で確認 |
| Release／E2E／Dogfoodingの候補・結果・展開物が重複 | `release/`、`verification/`、`tests/development-measurement/`へ責務分離 | 利用側移行済み |
| 旧実行物と診断物が約2.93 GiB残存 | v0.20.0の正式EvidenceをGitへ保持し、exact Pathの隔離・削除・不存在確認を実行 | 清掃完了 |
| Retentionの長期自動化 | 経過時間だけでは削除せず、Owner、settlement、参照、Recovery義務から削除可能性を判定 | 後続実測で拡張 |
| 別Repository Toolによる新規Top-level追加 | Manifest宣言とRuntime Data Architectureを正本にし、Tool固有都合だけの追加を拒否 | 規範・Checker接続済み |

## 7. 適用した移行順序

```text
現行Path棚卸し
  ↓
Producer／Consumer／Recovery参照の自動導出
  ↓
用途・耐久性・Authorityによる分類
  ↓
Directory Taxonomy、`tmp/` Lifecycleと共通Path Resolverの設計
  ↓
移行表と互換性を残さない切替条件
  ↓
実装・段階的結合試験・清掃
```

候補構成を基準版へ機械的に当てはめず、現行CapabilityとRecovery Evidenceを失わない順序で移行した。物理清掃は、Reader不存在、正式Evidenceへの昇格、Recovery義務および削除対象を確認した後に、実装移行とは分離した実行処置として行った。

## 8. v0.21移行結果

2026-09-12に、共通Path Resolver、旧Path拒否、利用側移行および段階的結合試験の成立後、CRDD公式Repository自身の物理移行を行った。

| 項目 | 結果 |
|---|---|
| 移行前 | `.crdd`直下19 Directory、150 file、配下120,542 file、約2.93 GiB |
| 可逆退避 | 旧直下168項目を`.crdd/tmp/runtime-data-migration-20260912/`へ同一Root内移動 |
| 保持根拠 | v0.20.0の正式な版、変更、検証およびRelease EvidenceはGit tagと正本へ確定済み |
| 恒久清掃 | 退避対象だけをexact Pathで削除 |
| 終了後観測 | 退避Directory不存在。`.crdd`直下は`config/`と空の`tmp/`だけ |
| 互換処理 | 旧Pathへの読取り・書込みfallbackなし |

この結果は、基準版の物理残存を現行契約へ昇格しない。今後のRuntime Dataは共通Resolverが発行する現行Pathへだけ生成する。
