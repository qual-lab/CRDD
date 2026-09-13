# Version Control境界

状態: Architecture Ready（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-13
要求: [`REQ-000036`](../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)
変更: [`CHG-000071`](../../99_Roadmap/Changes/CHG-000071/change.md)

## 1. なぜ独立させるのか

CRDDのToolはGitを、Repository Rootの確定、変更集合の観測、固定Snapshotの読取り、候補生成およびRelease Identityの作成に使っている。現在は各ComponentがGit CLIまたはGit内部構造を直接扱うため、通常作業までCommit SHAへ結合しやすく、別のVersion Control実装へ差し替える境界も不明確である。

Version ControlはRuntime Dataの保存内容ではない。Runtime Dataは「どこへ何を保存するか」を所有し、Version Controlは「RepositoryとRevisionをどう観測するか」を所有する。このため、`version-control`を`runtime-data`の子ではなく、全Toolから利用できるRoot Componentとする。

```text
Checker ───────────────┐
Runtime Data ──────────┤
Execution Intelligence ┤
Project Runtime ───────┼──→ 目的別Version Control Port
Coordinator ───────────┤                 │
Release／Signing ──────┘                 ▼
                                      Git Adapter
                                          │
                                          ▼
                                    Git CLI／Git Store
```

## 2. 責務境界

| Owner | 所有すること | 所有しないこと |
|---|---|---|
| 利用側Component | 必要な意味、許可する操作、失敗時の処置 | Gitコマンド、`.git`配置、Object形式の再解釈 |
| Version Control Port | Repository、変更状態、Snapshot等の目的別契約 | Git固有Path、Process起動、業務Object Identity |
| Git Adapter | Git CLI／Storeとの接続、出力検証、Git固有失敗の正規化 | 利用側の採用判断、Release判断、Runtime Data保存 |
| Runtime Data | 検証済みRepository Rootに結合した`.crdd` PathとLifecycle | Repository RootまたはRevisionの独自観測 |
| Release／Signing | 固定Snapshotが必要な理由と署名Gate | 通常作業へClean TreeまたはCommitを要求すること |

## 3. 目的別Port

一つの巨大な`VersionControl` Interfaceへ全操作を集めない。利用側は必要な最小Portだけへ依存する。

| Port | 入力 | 結果 | 固定Revision必須 | 代表利用側 |
|---|---|---|---|---|
| Repository Location | 起点Directory | 検証済みの最寄り／exact Repository RootとRepository形態 | いいえ | Runtime Data、Execution Intelligence、Checker |
| Local Change Set Observation | 検証済みRoot、必要な比較基準 | Revision差、準備済み差分、作業中差分、未登録Pathと観測状態 | いいえ | Checker、回帰選択、Workbench |
| Fixed Snapshot Read | 検証済みRoot、明示Revision、対象Path | Revision／Snapshot Identity付きの固定内容または観測不能 | はい | 固定履歴、外部送信Policy、候補生成 |
| Candidate Materialization | 固定Snapshot、許可Path、空で安定した出力Directoryから発行したopaque Capability | 隔離された候補と内容Identity。失敗時は部分生成の不存在またはcleanup観測不能 | はい | Coordinator、Project Runtime統合 |
| Fixed Revision Identity | 検証済みRoot、固定候補 | Revision／Snapshot／Object FormatのIdentity | はい | 署名、Release準備 |
| Repository-local Ignore Registration | 検証済みRoot、固定のignore entry | `registered`／`blocked`、原子的・冪等な登録結果、適用前後の内容Identity、Effect発行・確認・cleanup状態 | いいえ | Runtime用Repository-local除外の登録 |

通常の文書読取り、編集、Communication、Topic、Meeting、ProjectionおよびWorkbench表示は、Local Change Set Observationが変更ありを返しても成立する。Git Adapterが取得したCommit SHAはRevision Identityの実装値として出所へ付加できるが、業務ObjectのIdentity、通常保存の前提または正しさの代替にしない。

Portの公開結果ではGit固有語彙を使わない。Git Adapterだけが次の対応を所有する。

| Canonicalな意味 | Git Adapter内の観測例 |
|---|---|
| Revision Identity | commit object ID |
| Snapshot Identity | tree object ID |
| Revision差 | 比較基準Revisionから現在Revisionまでの差 |
| 準備済み差分 | indexと現在Revisionの差 |
| 作業中差分 | working treeとindexの差 |
| 未登録Path | untracked path |
| Repository-local Ignore | common Git directoryの`info/exclude` |

Release Identity、Runtime Execution Identity、署名対象集合およびRelease GateはVersion Controlの出力ではない。Release／SigningがFixed Revision IdentityとRuntime対象集合を入力に合成する。

## 4. Capabilityと再確認

Repository Capabilityは、構造が同じ値を利用側が作るだけでは成立しない。AdapterがRepository境界、実体Path、link／reparse、worktree形態および必要なVersion Control応答を確認した場合だけ発行する。

| 時点 | 必須確認 |
|---|---|
| Capability発行 | 起点、exact Root、Repository形態、観測方法、失敗理由 |
| 読取り・書込み直前 | RootとRepository境界が同じであること、必要なRevisionの存在 |
| 外部Effect直前 | 対象Snapshot、許可Path、利用側Authority、観測時点 |
| 結果公開前 | 実際に使ったRoot／Revision／変更集合と観測不能範囲 |

Candidate Materializationの出力Capabilityは、既存の空Directoryを実体Path・Directory Identity・link非介在とともに確認した場合だけ発行する。利用側は生PathをMaterialization Portへ渡せない。失敗後はOwnerがそのDirectoryを削除して不存在を確認し、確認できない場合は成功や未変更へ畳まない。

Repository-local Ignoreは、`info/exclude`のPathを公開せず、適用前後の内容Hashを返す。rename前の失敗は`effectConfirmation: not_issued`、rename後にreadbackを完了できない失敗は`effectConfirmation: unknown`として区別する。Lock残存のcleanupを確認できない場合も再試行可能とは表示しない。

dirty、untrackedまたはdetachedであることだけを不正としない。必要な保証を満たせない状態と、利用側が明示的に許可していない状態だけを拒否する。

## 5. 現在の本番Consumer棚卸し

試験FixtureがRepositoryを作るためのGit呼出しはAdapter利用を要求しない。次は本番Sourceまたは配布Toolに残る直接依存であり、移行完了まで追跡する。

| Consumer群 | 移行前の直接依存 | 移行先Port | 移行順 | 現在状態 |
|---|---|---|---|---|
| Runtime Data | `repository-root-capability.ts`の`git rev-parse --show-toplevel` | Repository Location | 1 | 移行済み。旧実装削除済み |
| Coordinator Repository Security | `repository-root-resolution*`、`repository-git-layout*`、`repository-operation-runtime.ts` | Repository Location、Repository-local Ignore Registration | 1 | 移行済み。旧Root／Layout Ownerを削除し、Runtime Data領域作成時のignore登録を新Portへ接続 |
| Checker Current Tree | `template/tools/crdd-check.ts`のRoot、index、HEAD、historical object観測 | Repository Location、Local Change Set Observation、Fixed Snapshot Read。採用先では§8の同梱Artifactを使う | 2 | 移行済み。採用先CheckerはOwner sourceから生成した自己完結Artifactだけを利用 |
| Regression Selection | `checker/regression-execution.ts`の変更集合導出 | Local Change Set Observation | 2 | 移行済み。Owner実Git試験済み |
| Coordinator Snapshot | `git-object-reader.ts`、`repository-workspace-runtime.ts`、`project-runtime-candidate-integration-adapter.ts` | Fixed Snapshot Read、Candidate Materialization | 3 | 移行済み。Object ReaderはVersion Control Adapter内部へ移し、旧Ownerを削除 |
| Policy／Provisioning | `external-send-policy-runtime.ts`、`platform-provisioner-package-filesystem.ts` | Fixed Snapshot Read | 3 | 移行済み。保護対象の依存閉包はexact Port／Adapter importで固定 |
| Release／Signing | `prepare-release-candidate.ts`、`sign-release-manifest.ts` | Fixed Revision Identity、Fixed Snapshot Read。Release Identityは利用側で合成する | 4 | 移行済み。署名前の依存閉包・実行primitive反証がPass。固定候補での最終確認待ち |
| Doctor／公開診断 | `doctor.ts`のRepository Git Layout説明 | Repository Locationの公開Projection | 4 | 移行済み。Git固有の旧診断契約を削除 |

Execution IntelligenceはRuntime DataのRoot Capabilityを利用しているため、Runtime Data移行後に間接利用側として回帰を確認する。Project RuntimeはCoordinator Adapter経由のSnapshot／Candidate利用を確認し、Gitへ直接依存させない。

## 6. 段階移行

```text
PortとGit Adapterの最小契約
          │
          ▼
Repository Locationを一本化
          │
          ▼
Local Change Set Observationを移行
          │
          ▼
Fixed Snapshot／Candidateを移行
          │
          ▼
Release／Signingを移行
          │
          ▼
本番Sourceの直接Git依存を機械的に拒否
```

各段階で、旧Consumerと新Adapterが同じ意味を別々に解釈する期間を最小化する。新Portへ移したConsumerは旧APIへ戻せない契約試験を持ち、全Consumer移行前に旧実装を削除しない。

## 7. 検証

| 観点 | 必須反証 |
|---|---|
| Repository Location | 通常Repository、linked worktree、submodule worktree、fake `.git`、link／reparse、Root途中の不正境界 |
| Local Change Set | 変更なし、Revision差、準備済み差分、作業中差分、未登録Path、rename、削除、観測不能 |
| Fixed Snapshot | loose／packed object、不明Revision、Path逸脱、内容改変、Object形式差 |
| Candidate | 許可Path外、衝突、部分生成、cleanup不明、同一Snapshotの再現性、所有Capability不一致、所有Directory外 |
| Repository-local Ignore | 通常／冪等、write・fsync・close・rename・readback失敗、二つの実Processによる競合と再入場、通常／linked worktree、適用前後Identity |
| Fixed Revision／Release利用側 | 通常作業は未Commitで成立し、署名／Releaseだけが固定Snapshot不足を拒否する。Release Identityは利用側が合成する |
| Consumer Closure | 本番Sourceの直接Git CLI／内部構造依存、旧API import、未登録Consumerを拒否する |
| Port語彙 | 公開型へ`commit`、`tree`、`index`、`worktree`、`staged`等のGit固有語彙が現れない |

実Gitとの結合試験は、呼出し、結果取得、取消／失敗、後始末までのLifecycleを対象にする。Mockだけから実Git境界の成立を推定しない。

Candidate出力Capabilityは、利用側が検証済みのmount、Runtime Data領域またはRelease stagingの所有Capabilityと所有Directoryへ結合する。空であるだけの任意Directoryには発行せず、別Ownerへの流用と所有Directory外への書込みを拒否する。Portが返す内容Policy拒否、Effect前停止、cleanup済み失敗およびcleanup不明は利用側で再解釈しない。cleanupまたはEffectが不明な場合、耐久Recordからexactな実体へ再入場できる既存OperationだけをRecovery参照へ昇格する。解決可能なRecordがなければ擬似IDを生成せず、手動回復が必要でRecovery IDは未確定であることを返す。

Candidate採用は、全変更の適用成功、途中失敗後のrollback確認済み、rollback不明を区別する。先行PathへEffectを発行した後にrollbackを確認できない場合は、後続処理や一時Workspaceのcleanup成否にかかわらずEffect不明として停止する。rollback確認済みだけを正本Effectなしへ戻し、採用済みEffectと一時Workspace cleanupも別fieldで表現する。

Repository-local Ignoreの`blocked`結果はRuntime Data入口まで判別可能な結果として伝播する。rename後の観測不能、cleanup未確認および再試行禁止を`null`へ畳まず、`.crdd`領域は作成せずにexact Recovery参照を返す。

Consumer ClosureはAPI名の利用有無だけで完了しない。Canonicalな停止結果を受け取る全Consumerは、原因、Effect発行・不明状態、cleanup、再試行可否およびRecovery参照を、Ownerの構造化結果または同じfieldを保持する構造化Errorとして最終運用境界まで運ぶ。単純な`null`、汎用Errorまたは別原因へ畳む実装を拒否する。

Version Control Ownerの全試験はTest Catalogへ登録し、Version Control変更時と`--all`時の両方で静的確認・結合試験へ選択する。新しいOwner試験を追加してもCatalogまたは実行Owner集合へ伝播しなければ、回帰契約不成立として拒否する。

## 8. Checkerへの配布

`template/tools/crdd-check.ts`は採用Repositoryへ追加installなしで配布・実行できる現在契約を維持する。公式Repositoryの開発Packageへ実行時依存させず、同じVersion Control契約を自己完結した配布Artifactとして同梱する。

```text
40_Develop/version-control/
  Canonical source／Owner package
             │
             │ 決定論的な生成
             ▼
template/tools/internal/version-control-runtime.ts
  Node.js標準機能だけで動く自己完結Artifact
             │
             ▼
template/tools/crdd-check.ts
```

| Gate | 確認内容 |
|---|---|
| Source／Artifact一致 | Owner packageから再生成したbyteと同梱Artifactが完全一致する |
| 生成漏れ | Canonical source変更後にArtifactが古ければ拒否する |
| 単独配布 | `template/tools`だけを新しいFixture Repositoryへ配置してCheckerを実行できる |
| 追加依存なし | 採用Repositoryへ`40_Develop`、package installまたはCRDD公式開発環境を要求しない |
| 単一契約 | Checker内部へ別のGit実装を複製せず、同梱Artifactの公開入口だけを使う |

## 9. 基準版Capabilityの移行

基準版はReleased Baseline `v0.20.1`とする。v0.20.1が引き継ぐv0.19.0／v0.20.0の成立Evidenceを使い、固定本文は変更しない。

| 基準Capability | 基準Evidence | 現Owner／API | 新Owner／Port | 保持する保証 | focused確認 | 実境界確認 | 旧実装削除Gate |
|---|---|---|---|---|---|---|---|
| Repository Root | [Coordinator完成確認](../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md)、[Runtime Data完了](../../99_Roadmap/Changes/CHG-000066/change.md) | Runtime Data Root Capability、Coordinator Root Resolver | Repository Location | exact nearest Root、通常／linked／submodule、fake境界・link拒否、利用時再確認 | Owner契約試験＋既存Root試験 | 実Gitで3形態と拒否境界 | 全Root Consumer移行＋旧import 0 |
| Repository Layout／Local Ignore | [Coordinator完成確認](../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md) | Coordinator Git Layout／Repository Operation | Repository Location、Repository-local Ignore Registration | Git Directory／common directoryの実体、並行更新、原子性、冪等性、linked worktree共有影響、readback | 既存Layout／Operation試験の同一反証 | 通常／linked worktreeの実Git更新 | 全利用側移行＋旧書込み入口 0 |
| Fixed Object／Object Format | [packed object結合14/14](../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md) | Coordinator Git Object Reader | Fixed Snapshot Read、Fixed Revision Identity | loose／packed、OFS／REF delta、checksum、object ID、mode、許可Path、SHA-1／SHA-256判定 | 既存14件と破損反証を新Portへ接続 | 固定Gitでpacked-only Fixture | 旧Object Reader Consumer 0＋同等反証Pass |
| Candidate生成／統合 | [v0.19最終署名E2E](../../99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md) | Repository Workspace、Candidate Integration Adapter | Candidate Materialization | base Revision／Snapshot、許可Path、部分生成、衝突、内容一致、cleanup／Recovery、正本Effect分離 | Candidate／Integration契約試験 | 実Providerを使わない固定Snapshot縦断＋Release前E2E | 全Candidate Consumer移行＋旧入口 0＋cleanup成立 |
| Signing／Release | [v0.20正式署名・4経路・Recovery](../../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) | Release準備／Manifest署名Script | Fixed Revision Identityを利用するRelease／Signing | 単一Snapshot、配布Root、Manifest、Runtime Execution Identity、秘密入力前Gate、4経路／Recoveryとの同一性 | 署名前契約・mutation・Consumer closure | 正式署名、4経路4/4、Recovery 7/7 | 新しい正式Evidence成立後だけ旧経路削除 |

移行表の全行が新境界で成立するまで、旧実装を不要または置換済みと扱わない。一方、成立後は恒久互換層として残さず、利用側を新Portへ統一して削除する。

## 10. 対象外と未決事項

- Git以外のAdapter実装はv0.21の必須範囲にしない。ただしPortはGit固有語彙を公開しない。
- Git操作全般を提供する汎用Libraryや、任意Command実行入口は作らない。
- Git履歴が不要なRuntime DataをVersion Control Componentへ移さない。
- Remote Repository Hosting、認証、push／pullおよびServer側Git管理は本変更へ含めない。
- Object Format差、submoduleおよびlinked worktreeで保持すべき既存Capabilityは、段階移行の実測で再確認する。
