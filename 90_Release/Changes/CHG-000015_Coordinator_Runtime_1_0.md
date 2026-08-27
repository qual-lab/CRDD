# 変更トレース: Coordinator Runtime 1.0

変更ID: `CHG-000015`
状態: `Reopened`
担当責任者: Qual-Lab
最終更新日: 2026-08-27
対象系列: Coordinator Runtime 1.x
対象バージョン: v0.18.0 Candidate / Coordinator Runtime 1.0 Candidate
変更分類: `normative`
リリースレベル: `MINOR`候補
`migration_required`: `true`

正本規則: [変更](../../12_Change.md)
概念正本: [エージェント組織](../../04_Agent_Organization.md)
Architecture正本: [エージェント組織の実行アーキテクチャ](../../04_Agent_Organization.md#12-execution-architecture)
実装案内: [Coordinator Runtime README](../../tools/coordinator/README.md)
脅威境界: [Threat Model](../../tools/coordinator/threat-model.md)
統合台帳: [未リリース変更トレース統合台帳](README.md)

## 1. 結論と現在状態

本変更の利用者価値は、Front Agentから直接Providerを相互spawnさせず、Coordinatorを唯一の仲介者としてCodexとClaude Codeへ実行・独立レビューを委譲し、検証済みのローカルCandidateを人間へ返せる`Coordinator Runtime 1.0`を一体として成立させることである。

2026-08-26時点で、署名済みCRDD Release Identity、Local PersonalのT1–T2境界、外部送信の対話承認、Claude Code Executor、Codex Independent Reviewer、Candidate検証・破棄およびHost／Docker cleanupを通る固定1経路を実測した。対象Commit `af76f555896d991edb88a6bc2f52b9865c6e9ac5`の正式Runnerは`RUNNER_EXIT=0`を返し、正規Repository、Candidate Store、Runtime State、Docker資源およびRunner Processの残存0を独立照合した。

この成功はRuntime 1.0全体、4経路、失敗／取消Recovery、統合、ReleaseまたはT3–T4保証を意味しない。現在の本変更は、未リリースCHG統合による正本再構成と残る経路・Recovery・Release Gateのため`Reopened`である。

後続の現在候補では、両Front×両Executorの4経路、同一Provider例外理由、独立Reviewer、単一Active初期同意、4経路の完全一致Runnerおよび失敗／取消Recovery Matrixをproduction経路と同じ契約へ接続し、全機械試験を通過した。初期同意は全Policy Provider境界を表示し、現在Task／Revision／Scopeを非永続Previewへ分離し、選択ユーザー・保護Runtime State・Policy byteへ結合する。A→B→Aで古いAを復活させず、180日失効、明示取消、部分／破損pairの安全なAuthority除去および判定不能時の手動回復停止を固定した。この段階は正式署名4経路実測またはRuntime完成監査の完了をまだ意味しない。

固定候補`29c1a84`への独立Security、Test／UXおよびDocument／Gap監査は、失効・保護不一致後の旧同意復活、観測不能／dangling reparse残存時の取消成功誤報、4経路間のRelease Identity未固定、Runner例外時の未知状態投影、検証済み経路件数の過大表示、およびREADME後段の旧Operation単位同意説明を検出した。これらは採用済み方針を変えず、旧同意世代の不可逆失効、`lstat`による物理残存確認、同一manifest／package／version／sequence／Commit／Tree／対象Pathの固定、例外時の手動回復、検証済み件数だけの集計、および現行初期同意Lifecycleへの文書置換として一括是正した。新固定版の機械確認、独立再レビューおよび正式署名実測までは完了扱いにしない。

後続再監査で検出したMatrix最外周と非適合resultの未知状態表示も、共通failure summary、引数不正とRunner例外の閉集合分類、非boolean観測fieldの`effectStateUnknown`集約、および観測事実4 fieldの`null`投影へ統一した。引数不正はEffect前のexit 64として未知状態や手動回復を主張せず、実行中例外だけを手動回復へ閉じる。6つのRelease Identity fieldは個別mutation試験で固定する。正式署名実測と新固定版の監査集合完了前にRuntime完成へ昇格しない。

正式署名Route Matrixの親Process終了で、Docker create送信後・ID受領前の耐久Recovery IDが一件残る実状態を得た。初回是正候補のDocker Recovery Runtime contract revision 15はexact nameと同じname＋ownership labelの空照会を未作成Evidenceとして自動収束したが、独立Architecture／Security、Test／UXおよびDocument／Gap監査は、親消失後もDocker CLIまたはdaemon requestが遅延完了し得るため、空snapshotはsettlement barrierにならないと判定した。revision 16は空観測を`manualRecoveryRequired`へ戻したが、発見したowned IDを耐久化する前の削除と、Recovery ID形式からのEvidence保持推定が残った。revision 17では、receipt欠落＋空照会ではOperation領域、active pointer、Provider Home lease、Recovery IDおよびEvidenceを保持して停止する。同じ単一owned IDが観測できた場合は全構成を削除前に照合し、ID、purpose、Recovery IDおよび取得経路をreconciled receiptへ耐久確定してから既存ID指定Recoveryへ移る。Evidence状態はfresh inventoryに基づく`preserved`、`not_preserved`、`unknown`へ分離し、`not_preserved`では再利用可能なIDがないこととRuntime operatorへの移送を案内する。proxyはcreate直後のinternal-onlyとreceipt後のinternal＋egressだけを許容する。自動収束用Brokerまたはdaemon-side fenceはRuntime 1.0へ追加せず、現在のThreat Boundaryを拡張しない。修正後の全機械確認、正式署名Recovery／Route Matrixおよび独立再監査が終わるまで完成扱いにしない。

### 1.1 経路別の現在状態

| Front | Executor | 独立Reviewer | 現在状態 | 根拠／残件 |
|---|---|---|---|---|
| Codex | Claude Code | Codex | 固定1経路で成立確認 | 署名済み一般Task、Candidate exact content、Finding 0、cleanup／残存0を実測 |
| Codex | Codex | Claude Code | 機械契約成立／正式署名実測待ち | Codex特性または反対Provider不適格の理由とProvider独立Reviewerを固定 |
| Claude Code | Codex | Claude Code | 機械契約成立／正式署名実測待ち | Coordinator仲介の逆方向経路、Codex ExecutorとClaude Reviewerを固定 |
| Claude Code | Claude Code | Codex | 機械契約成立／正式署名実測待ち | Claude特性または反対Provider不適格の理由とProvider独立Reviewerを固定 |

cross-providerを既定とし、同一ProviderまたはFront-onlyは、移譲不要、Provider固有の適性、反対Providerの利用不能または独立レビュー要件から説明できる場合だけ選ぶ。実装の存在、CLIの利用可能性または一経路の成功を、別経路の成立へ一般化しない。

### 1.2 Releaseまでの主要残件

1. 4経路RunnerとRecovery Matrixを最新の正式署名配布物から実測する。
2. 最新改訂版でArchitecture／Security、Test／UX、Document／Gap／Impact／Conformanceを完了する。
3. 実測Evidence、README、Roadmap、CHANGELOG、IssueおよびRelease範囲を現在状態へ同期し、人間の統合・Release判断へ渡す。

## 2. 人間による判断と変更意図

Qual-Labの人間の決定権限者は、次を一つのRelease価値として採用した。

- `Human → Front Agent → Coordinator → Executor → Independent Reviewer → Coordinator → Human`を基本形とする。
- Codex／Claude Codeの両Frontと両Executorを同じ一方向Authority Treeで扱い、Provider同士を直接spawnさせない。
- 既存ChatGPT／Claude Subscriptionの公式OAuth sessionを公式CLIが使用する。CRDDがCredentialを抽出して別APIへ転用しない。
- API key、従量API、追加credit購入およびquota不足時の有料経路fallbackは原則禁止とし、別途ユーザーが明示設定・承認した独立Capabilityなしには対応しない。
- 正常なOS、認証済みLocal User、公式CRDD Release Trust Rootおよび公式Provider配布物をTrusted Computing Baseとし、v1はT1–T2相当を実用Baselineとする。ここでT1はRuntimeによるAuthority／Context／Egress制御、T2は署名Release／Artifact／Provider Identity検証を表す概念上の表示であり、独立したCore Schema、認証Levelまたは成熟度Gateではない。
- 悪意ある同一OS User、Administrator、Kernel、Firmware、TPMまたはVendor signing infrastructure compromiseへの完全耐性はv1完成条件にしない。
- Runtime 1.0を構成する内部component、Provider別Adapter、個別Gateおよび検証Stepは独立Releaseせず、本CHG内の成立条件とEvidenceとして扱う。
- Runtimeの独立監査往復から一般化した非同期処理規則の過剰適用是正を、同じ未リリースv0.18変更へ含める。AI入口、外部Runtime、Authority／Effect境界および取消後に残存し得る資源では完全なlifecycle契約を維持し、通常のプロダクト非同期処理は実在する状態とリスクに比例、外部Effect等を伴わない単純なローカル非同期処理は通常の実装・エラー処理・試験へ閉じる。`10_Agent.md`、公式保守入口`AGENTS.md`および配布入口`template/AGENTS.md`へ同時に伝播し、既存の高リスク境界を弱めない。
- Providerへ渡すTask Promptは目的、受入基準およびPath参照へ限定し、Repository file bytesを埋め込まない。許可した機密ソースは開始Revisionからの明示Read Projectionとして渡せるが、Password、秘密鍵、Session Token、API Keyその他のSecret値は通常の送信許可へ含めない。認識済みSecretはProvider Effect前に拒否し、heuristic合格を未知Secret不存在の証明へ昇格しない。

本判断はProvider login、外部送信、Repository変更、Candidate受入、統合、Releaseまたは費用執行を事前承認しない。それらは各OperationとRelease Gateで別に判定する。

## 3. 所有境界

| 主体 | 所有する責務 | 所有しない責務 |
|---|---|---|
| Human | 目的、価値、重要判断、初期処理境界の外部送信承認、受入、統合、Release、責任 | Runtime内部の候補生成と承認済み境界内のTask単位確認 |
| Coordinator Runtime | Operation状態、Identity、Authority、Provider選定、起動、検証、停止、cleanup、Recovery | 人間の決定権限、Risk Acceptance |
| Front Agent | 依頼理解、候補計画、Humanとの対話 | 子Providerへの直接Authority、完了確定 |
| Executor | 固定Packet内の実装・検証候補 | Scope拡張、自己承認、Promotion |
| Independent Reviewer | 固定Candidateと基準からの独立評価 | Executor要約の追認、Human Authority |
| Repository Adapter | Git Identity、隔離workspace、diff、許可Path Guard | commit、push、merge、rebase、tag、Release |
| Execution Environment | Credential、Egress、Filesystem、Processの強制境界 | CRDD判断、成果物の意味 |

Role、Provider、Modelまたは利用可能性からAuthorityを推定しない。

## 4. Authority／Effect契約

```text
Representable ≠ Trusted ≠ Enabled ≠ Eligible
Eligible ≠ Authorized ≠ Executed ≠ Promoted
Role ≠ Authority
Release signing key ≠ Runtime capability
Parent authority >= delegated child authority
判定不能 → Effect 0
```

| 能力／許可 | 発行者と結合 | 単独で許可しないもの |
|---|---|---|
| Selection Grant | CoordinatorがTask、Provider、Model、理由、上限へ結合 | Provider起動、外部送信 |
| Provider Authority Capability | 認証済みLocal User、Policy、Provider、目的、期限へ結合 | Filesystem mount、Candidate promotion |
| Provider Home Mount Grant | 選択User、専用Home、Operation、実体Identityへ結合し一回消費 | 別Provider／別Operation利用 |
| Repository／Revision Capability | Logical Repository、Instance、base Commit／Tree、許可Pathへ結合 | 現在Revisionが変わった後のEffect |
| External Send Grant | 表示した送信先、分類、目的、payload scopeへ対話承認で結合 | 別送信先、別目的、再利用 |
| Candidate Capability | base、patch、content manifest、allowed pathsへ結合 | commit、push、merge、Release |

子Agentへ親以上のAuthorityを与えず、Grantはprocess-local、opaque、短命、一回限りを基本とする。Identity、Authority、Revision、Provider、Context Boundaryまたはcleanupを安全に判定できない場合は停止する。

## 5. Trust／Execution Boundary

| 境界 | 現在の契約 |
|---|---|
| CRDD Release | Ed25519署名済みRelease Manifest、Commit／Tree、package content root、sequence、固定Trust Anchorを検証 |
| Coordinator Artifact | Signed Manifest内のexact artifact、hash、distribution rootへ結合 |
| OS／User | 正常なOSと認証済みselected local userをTCBとし、環境変数ではなくOS由来観測へ結合 |
| Windows Provisioning | AppContainer Worker、Job／mitigation、必要な最小OS Effect、exact復元と残存0を一回実行契約で検証 |
| Provider Identity | PATHだけで探索せず、公式配布、固定実体、version、hash／signature、起動前後Identityを確認 |
| Provider Home | Codex／Claudeをselected userの専用Homeへ分離し、Operation一時領域と永続認証Homeを分離 |
| Docker | 固定image digest、read-only root、非root、capability全削除、no-new-privileges、限定mount、限定Egress |
| Repository | Logical identity、instance identity、object format、base Commit／Tree、current revisionをEffect直前に再確認 |
| Information／Secret | Task本文とRepository file bytesを分離し、明示Read Projectionだけを再構成する。認識済みSecret形式または秘密用PathはProvider可視workspace作成前に拒否し、完全検出は主張しない |
| Process | shellを介さず、最小環境、timeout、cancel、process tree終了、Job／container不存在、cleanupを確認 |
| Network | Local executionとExternal Sendを分け、承認Provider endpoint以外へ送らない。観測不能時は起動しない |

親Environment全体を継承しない。必要なOS contextはKnown Folder等から取得・検証し、Provider固有の最小Environment Blockへ投影する。Credential、proxy、任意PATH、Git helper、SSH agentおよび他Provider sessionを暗黙継承しない。

## 6. Provider別契約

| 項目 | Codex | Claude Code |
|---|---|---|
| 基本Offering | ChatGPT Subscription OAuth | Claude Subscription／Max OAuth |
| Credential所有 | 公式Codex CLIと専用Home | 公式Claude Code CLIと専用Home |
| API key fallback | 原則禁止・自動有効化なし | 原則禁止・自動有効化なし |
| 追加購入／従量課金 | Runtimeは実行しない | Runtimeは実行しない |
| 同意 | 初回に全Policy Provider境界を一括表示し単一Active同意へ固定 | 同じPolicy境界内ではTaskごとの確認を繰り返さず、変更・失効・取消時だけ再承認 |
| Terms／retention等 | Runtimeが内容を保証せず、対話時のProvider条件へ戻す | Runtimeが内容を保証せず、対話時のProvider条件へ戻す |
| 無効化 | eligibilityをfalseにし、代替を推測しない | eligibilityをfalseにし、代替を推測しない |

一方のlogin、Terms確認、quota、External Send Grantまたは成功を他方へ流用しない。Runtime 1.0は両Providerを含む一体Releaseであっても、Operationは必要なProviderだけを明示選定し、未認証・利用不能Providerを起動しない。

## 7. Model／effort選定

Coordinatorは利用可能な候補から、Taskの具体性、曖昧さ、影響、独立性、検証要求および費用を根拠にProvider、Model、effortを選び、動作コンテキストへ選定値と理由を残す。

- 具体Taskへ落ち、実装方針と受入条件が固定済みなら低いeffortを基本とする。
- Architecture、Security、方針整合、難しいレビューまたは不確実性の収束だけ上位Model／高effortを候補とする。
- 思考作業であることだけを理由に高価なModelを選ばない。
- Codexは原則Sol系、Claude Codeは原則Opus系の通常速度を候補とし、利用可能な公式Profileへ解決する。高速modeを既定にしない。
- 品質成立条件を満たすEligible Set内でCostを抑え、Cost削減のためにAuthority、独立ReviewまたはVerificationを弱めない。

## 8. Lifecycle／Recovery

| 結果 | 必須処置 | 成功扱いの条件 |
|---|---|---|
| Success | Result schema、Candidate identity、allowed paths、review、cleanupを確認 | Provider成功とcleanup成功が両方成立 |
| Provider failure | 生出力を永続化せず正規化理由を返し、子Process／containerを終了 | Effect残存0を確認 |
| Timeout | 新Effectを停止し、process treeを上限内で終了 | Job／container／mount／temp不存在を確認 |
| Cancel | 取消受付と完了を分け、遅延／重複通知を吸収 | completion後の利用側と資源回収を確認 |
| Crash／parent loss | durable recovery recordから所有資源だけを再確認 | 推測削除せず、全所有Identityが一致 |
| Cleanup unknown | 自動成功にしない | `manualRecoveryRequired`として停止 |

同名、prefix、Path文字列またはcaller claimだけで資源を削除しない。Process、container、mount、Registry／certificate等のHost Effect、Candidate Storeおよび一時領域は、Operation ID、private ownership token、実体Identity、pre-stateおよび現在状態を照合する。期待状態と観測状態が異なる場合は上書き復元せず、人間へ返す。

正式Runnerの対話承認待ちを実際に取消した際、固定console readerへの取消IPCと子Processの`close`が競合し、遅延`EPIPE`がlistener回収後に親Processへ未処理再送出される欠陥を確認した。取消IPCは完了callbackを必須にして遅延channel errorをその場で回収し、成功／取消／timeoutの判定は従来どおり子Processとstdoutの両`close`およびforce-stop fallbackだけに結合した。同じ遅延順序を契約試験へ追加し、Provider、Authority、Task入力またはcleanup成功条件は緩和していない。

正式署名4経路の実測では、署名Package確認後に行っていた可用性確認だけのWindows console open／closeが、同一Processで後続するRuntime State観測時にnative access violationを発生させることを、Package、console、Capability consume、Consent resolveの順を一段ずつ接続した固定Probeで特定した。初回同意の本処理はdevice検査、表示、入力、取消およびcleanupをすでに一つのRuntime所有lifecycleで行うため、独立したavailability-only preflightを正式Runnerから除去した。有効な同意の再利用時はconsoleを要求せず、初回同意時の本処理が不成立なら従来どおりGrant 0でFail Closedにする。これは対話確認を省略する変更ではなく、同じOS deviceへの重複Effectを除去して単一のAuthority境界へ戻す是正である。

その後の正式署名4経路では、初回同意のchallenge表示直後かつ人間入力前にWindows fast-failが再現した。入力、Node 24.12／24.19、短文／12KB ASCII／11KB日本語、Package再検証、Docker Recovery、Candidate Store、同期lock解放直後および別lock保持を自動Probeで分離し、Host Operation directory生成だけは正常、世代lock Workerを有効化した同一Node ProcessからConsole reader childへ進む場合だけ失敗することを特定した。固定1秒、event-loop yield、listen後のWorker round-tripおよび`Atomics.wait`を除いた完全非同期Workerでもそれぞれ反復9、2、6回目までにnative crashが再発したため、時間またはJS-level readinessをnative quiescenceの根拠にする案を棄却した。ProductionはHost Operation named-pipe lockを固定の独立Supervisor Processへ分離し、`acquired`、`confirm-ready`／`ready`、`release`／`release-ready`／`confirm-release`／`released`およびexit 0を確認する。Operation generation、lock identityおよびRecovery recordを再確認してからRepository binding、同意または子Processへ進むrevision 16候補は、同じ物理Consoleの反復1000回でnative crash、孤児、stale lockおよびcleanup残存を0とし、process分離の有効性を確認した。一方、独立監査は取得・readiness・releaseの異常を競合へ畳み込む経路、Operation作成途中のexact Recovery ID欠落、ready後の耐久marker再検証不足、新しい非同期待機中の取消Gate不足、および専用子Process環境・protocol試験不足を検出した。Task Runtime contract revision 18では、`acquired`、確認済み`unavailable`、protocol異常後の終了確認済み、および`cleanup_unknown`を分離する。全異常通知は単一Promiseの冪等finalizerへ収束し、`cleanup_unknown`を後着通知で降格しない。ready後のunexpected lossは保留同意と実行中Provider Processを取消し、結果確定まで新Task、PackageおよびExternal Sendを可逆drainで停止する。新規業務Effect用Capabilityだけを失効し、既に開始済み資源のcleanup-only Authorityを保持する。Host、Docker、CandidateおよびCandidate Storeの生Recovery状態を最後まで合成し、全cleanup確認後だけdrainを解除する。いずれか不明なら全actionable IDを保持して不可逆poisonへ昇格し、確認済み失敗だけなら既存poisonを消さず次Taskを許可する。marker、generationまたはRoot identity不一致ではRootとmarkerを推測削除しない。identity検証済みRoot削除後のrelease不明ではRoot不存在、marker、Supervisor参照およびretired generationを保持する。protocol異常後にterminate、exit、Root、markerおよび参照のcleanupを確認できた場合は成功を拒否するがHost Recovery IDを返さない。ready後はmarkerのfile identity、Hash、state、Rootおよびchild identityをfresh再確認し、Operation作成待機中の取消を最初の後続Effect前に再確認する。Supervisorはexact argv、IPCおよび閉じたprotocol state machineと専用neutral Environment Profileを要求し、closing中を含むduplicate、unknownまたは順序外commandを非0 exitへ単調化する。取得・readiness中の失敗とEffect後のrelease不明を分け、前者ではRepository binding、Policy、Slate、Candidate Store、Console、Grant、workspace、ProviderおよびNetwork Effectを0に保つ。固定Runtime Commit `78fae01f6e1c60bf8b970dabb304054db5bcb606`、Tree `0ad5f34d5ad106d04d7d8d0bab919db051138ba2`は、変更後の物理Console反復1000回で成功1000、native非0終了0、孤児、stale lockおよびcleanup残存0を確認した。正式公開入口の初回同意、reuse、取消および4経路署名E2E Evidenceはこの固定版では未取得であり、Runtime完成またはRelease根拠へ昇格しない。

その後の独立監査は、`confirm-release`受理後かつ成功送信前のclosing窓で後着protocol違反がexit 0へ戻り得ること、Host世代失効後にDocker cleanup intentが通常management検証で停止すること、およびHost cleanup確認後のDocker receipt失敗が既に無効なHost Recovery IDを再投影することを検出した。固定Runtime Commit `a613e4584c4c5c6c6d13e2565cb1ba866029c182`、Tree `0ab88924c8b09bf2436b7cb439678509fa8122eb`では、終了直前の共通finalizerが違反後に成功へ戻らないことを実entrypoint試験で固定した。Docker finalization recordごとにlive世代で発行し、確認済みHost失敗に限ってretired世代を受理する非公開・単回のcleanup-only Capabilityを導入し、通常management Authorityは緩和していない。Host rootとmarkerのcleanup確認時にHost成分だけを完了化し、後続receipt、finalize、CandidateまたはStore処置が失敗しても無効なHost IDを再投影しない。同固定版は型、lint、format、全904試験および全体Checkerのerror 0／warning 0を満たし、物理Console反復1000回で成功1000、native非0終了0、孤児、stale lockおよびcleanup残存0を再確認した。正式公開入口の初回同意、reuse、取消および4経路署名E2E Evidenceはこの固定版では未取得であり、Runtime完成またはRelease根拠へ昇格しない。

続く独立監査は、単数`dockerRecoveryId`の存在だけでOperation Rootを保持して一件の確定可能なDocker handoffをcleanupしないcardinality依存と、Docker Recovery IDからProcess再起動を案内するため実際の不可逆poisonと表示が一致しない契約Gapを検出した。固定Runtime Commit `84e6de103bf3e2134f836f945d1293dd038d848a`、Tree `975c5bbba4fb5aeab158c3a02ee473aae8f79eb3`のTask Runtime contract revision 19は、0件、1件または複数件という件数ではなく、Runtime所有のpending handoff、単回Capability、finalization recordおよび生Recovery IDの完全一致からcleanup可否を決める。active、abandoned、重複、混在または不一致はRootを保持してFail Closedにし、Candidate／Candidate Storeの手動回復はDocker cleanup可否から独立させた。`processRestartRequired`は不可逆なProcess poisonだけからRuntimeが導出し、Recovery ID、`manualRecoveryRequired`、reasonまたは一時drainから推定しない。retired generationのloss処置は共通の純粋状態遷移へ固定し、本番の通常cleanup配線と独立したfresh Processからのexact Recoveryを実Process試験で確認した。この根拠はretired generationの実faultをproduction入口から注入したE2Eとは主張しない。同固定版は型、lint、format、全912試験および全体Checkerのerror 0／warning 0を満たし、物理Console反復1000回で成功1000、native非0終了0を再確認した。正式公開入口の初回同意、reuse、取消および4経路署名E2E Evidenceはこの固定版でも未取得であり、Runtime完成またはRelease根拠へ昇格しない。

最終監査の第一走査は、生のDocker Recovery ID配列で不正要素を除外してcleanup対象を過少投影できること、General Task／Route Matrixが子結果の`processRestartRequired`または観測不能を表示へ写しても共有Processを実際にはpoisonしない経路、および本番moduleが任意Supervisor acquirerを受け取る内部fixture面を公開していたことを検出した。固定Runtime Commit `700efe71a0a65ceb8eee84d59a6a11ca60c5353b`、Tree `b310bfa1cd154a6740ef16469b803e50cdc7690b`では、Docker cleanup可否を純粋Coreへ分離し、単数／複数fieldの0件・1件・N件表現、plain dense配列、余分key、長さ、重複、pending handoff、Recovery IDおよびCapability identityのexact一致を満たす場合だけcleanupを許可する。accessor、Proxy例外、sparse、範囲外数値key、非標準prototype、不正値、混在、active、abandonedまたはfinalization不一致はRootを保持してFail Closedにする。General Task contract revision 9とRoute Matrix contract revision 4は、TaskまたはRoute開始後のcompletion例外、結果欠落、観測field欠落・`null`、子の再起動要求、同意取消結果の例外・不正shapeを、true投影より前に同じ共有Processの不可逆poisonへ接続した。poison後のPackage、TaskおよびExternal Sendはcaller入力を読む前に拒否し、既存poisonを既知の事前拒否で降格しない。任意acquirerのproduction exportは撤去し、Host generation lossは共通の純粋状態遷移、本番Supervisor固定配線、通常cleanupおよびfresh recoveryで検証する。全918試験、型、lint、format、全体Checkerのerror 0／warning 0および専用Windows Console hostの反復1000回で成功1000、非0終了0を確認した。正式公開入口の初回同意、reuse、取消および4経路署名E2E Evidenceはこの固定版でも未取得であり、Runtime完成またはRelease根拠へ昇格しない。

後続の同一監査集合は、`700efe7`段階のexact一致主張が生のDocker Recovery fieldの欠落、空集合または部分集合をpending集合との逆向き包含まで照合しておらず、General Task／Route Matrixも開始後のsignal bind／unbind、取消settlement、結果getter／Proxy、Route exact検証、Release Identity検証および最終集約の例外を一つのpoison境界へ完全には収めていないことを検出した。固定Runtime Commit `02c987886b6f0dc38d181e7b8e114802504885ca`、Tree `dab5760ed91ef26465566b71f5eec80d725cbf96`では、Docker Recoveryの単数・複数fieldを必須のown dataとして観測し、0件・1件・N件のcanonical表現とpending handoff／finalization／Capabilityの双方向同数・同集合を満たす場合だけHost cleanupへ進む。欠落、空または部分集合、不正shape、余剰または混在ではHost／Dockerを保持し、Candidate／Candidate Storeの独立cleanupだけを継続する。General TaskとRoute Matrixは共通の安全観測器で全boolean、単数／複数Recovery ID、cleanupとmanual recoveryの相関をdescriptor snapshotから確定し、開始後の処置を単一finalizerへ収束させた。取消は最大一回、signal listenerは部分bind失敗時もrollbackし、unbind／取消／completionはbounded settlementで閉じる。観測不能または例外では既知Recovery IDを保持して共有Processを不可逆poisonし、exactな業務不適合だけはpoisonしない。型、lint、format、全927試験および全体Checkerのerror 0／warning 0を満たし、同じ物理Consoleの専用PowerShellで反復1000回の成功1000、非0終了0、Probe開始後の新規Operation directory残存0を確認した。この固定版に対する独立再監査と正式署名4経路E2Eは後続Gateであり、まだRuntime完成またはRelease根拠へ昇格しない。

その固定版のEvidence記録Commit `814aeeff0065970a5804ecca8dcfa821a520a62a`に対する同一監査集合は、表示用に正規化したDocker Recovery集合をcleanup Authority判定へ再利用できること、signal取消が最初の無上限completion待機を中断しないこと、開始結果のcompletion getter／Proxyをfinalizerで再読取りできること、Route安全観測不明時に既知Recovery IDを失うこと、および単数／複数Recovery fieldのcanonical 0件・1件・N件関係を共通観測器が強制していないことを検出した。固定Runtime Commit `219aedba100602de64c8237efd1f52c5c82b84fd`、Tree `11370350979d6183bc639a3bb7747bfc32be9fe8`では、Docker cleanup可否をpre-normalization snapshotから一度だけ決めるmodule-private envelopeへ閉じ、公開表示からAuthorityを再構成しない。開始結果はdescriptorを一回だけsnapshotし、真正なPromise以外のthenable、getter、Proxyおよび再読取りを拒否する一方、安全に取得できたcontrolだけは取消へ保持する。signal callbackはlatchだけを設定し、単一finalizerが取消を最大一回発行して取消後のcompletionをboundedに観測する。通常Taskへ固定timeoutは追加せず、取消・観測不能時のsettlementだけを上限化した。Routeは不一致した単数／複数pairからも妥当なIDをnested結果とtop-level集約へ保持し、曖昧性、手動回復およびProcess poisonへ閉じる。共通観測器は0件=`null`／空配列、1件=同じ単数値／一要素配列、N件=単数`null`／N要素配列だけを受理する。型、lint、format、全930試験および全体Checkerのerror 0／warning 0を満たし、同じ物理Consoleの専用PowerShellで反復1000回の成功1000、非0終了0、Probe開始後の新規Recovery record 0を確認した。この固定版に対する独立再監査と正式署名4経路E2Eは後続Gateであり、まだRuntime完成またはRelease根拠へ昇格しない。

そのEvidence記録Commit `9d81ca75136613a5ff3201b5396cd888a06fe16f`に対する同一監査集合は、Docker source resultの一部経路がraw Authority判定前に表示用へ補完されること、Promise subclassの継承`then`、control欠落後のcompletion、取消receiptのshapeと待機順序、Recovery IDの資源別文法・上限・部分salvage、およびRoute早期終了の4組Recovery pairに残るGapを検出した。固定Runtime Commit `b8825224833cb5d023657b1fb1c2b598bdea7395`、Tree `facb56661c964427282a6155957ecb0679013156`では、Executor、ReviewerおよびRemediationの各Docker source resultを補完前に同一点でsnapshotし、raw単数／複数集合とRuntime所有handoff／finalization／Capabilityの完全一致だけをcleanup Authorityへ昇格する。表示用のRecovery補完はAuthority判定後に限定し、欠落、空、部分、foreign、accessor、Proxyまたはpair不一致からcleanupを開始しない。completionはmodule初期化時に捕捉した真正な`Promise.prototype.then`だけで観測し、Promise subclass、thenable、getterまたはProxyを拒否する。control欠落でも開始済みcompletionを本番固定240秒で観測し、取消受付10秒の後に完了観測240秒を逐次実行する。本番値をcallerから短縮できず、隔離試験だけが短縮できる。取消receiptは4 fieldのexact shape、理由と終了観測の相関を要求し、同一Operationの重複取消へ同じreceiptを返す。Host、Docker、CandidateおよびCandidate Storeごとのcanonical Recovery文法を共通化し、descriptor-onlyかつ最大128件のsalvageで妥当IDを保持しながら曖昧性へ閉じる。Routeの全早期終了は4組の単数／複数pairを返し、既知の事前停止とEffect不明を区別する。型、lint、format、全935試験および全体Checkerのerror 0／warning 0を満たし、同じ物理Consoleの専用PowerShellで反復1000回の成功1000、非0終了0を確認した。この固定版に対する独立再監査と正式署名4経路E2Eは後続Gateであり、まだRuntime完成またはRelease根拠へ昇格しない。

その固定版に対する同一監査集合は、Authorityとして拒否したreject済みPromise subclassへsettlement drainを接続しない場合の未処理rejection、公開取消receiptの意味変更をTask Runtime contract revisionへ伝播していないこと、およびDocker cleanup pure Coreが正常配列と同じtransparent Proxyをtrap前に拒否しないことを新たに検出した。固定Runtime Commit `599b3ecd7e5369d67fc9b433ac8d8b0617059e87`、Tree `613326dd702286c6098c041c19e251d0ab4c3674`では、Started Taskのcompletion descriptor取得と同じ同期turnで、非Proxyの真正Promiseへ捕捉済みintrinsic `Promise.prototype.then`のfulfill／reject drainを接続し、その結果をAuthority、RecoveryまたはCandidateへ昇格しない。prototypeがexact `Promise.prototype`のcompletionだけを正式観測へ使い、reject済みsubclassと継承`then` overrideは`--unhandled-rejections=strict`の独立Processで未処理rejection 0、構造化blocked、poisonおよびexit 0へ固定した。Task Runtime contract revision 20は、liveな認証済みcontrolの取消をexact 4-field receiptと理由／終了観測の相関へ固定し、同一live Operationの重複取消を同じEffect、Promiseおよびfrozen receiptへ収束する。不正lower receiptは同じcached rejectionとなり、不正、foreignまたは失効controlはexact blockedかつEffect 0である。旧shapeへのfallbackは行わない。Docker cleanup pure Coreはinput、raw、plural配列、handoff／finalization配列および各recordのProxyを、prototype、key、descriptorまたはproperty観測より前に拒否する。transparent Proxyの`getPrototypeOf`、`ownKeys`、`getOwnPropertyDescriptor`、`get`および`has` trapは全0で、cleanup Authorityへ昇格しない。型、lint、format、全938試験および全体Checkerのerror 0／warning 0を満たし、同じ物理Consoleの専用PowerShellで反復1000回の成功1000、非0終了0を確認した。この固定版に対する独立再監査と正式署名4経路E2Eは後続Gateであり、まだRuntime完成またはRelease根拠へ昇格しない。

そのEvidence記録Commit `27b3ba310e6fc16b267e8a50484c278a1a845799`に対する同一監査集合は、公開CLIが取消Promiseを`void`で破棄する利用形態へのterminal observerがなく未処理rejectionになり得ること、RunnerがAuthorityとして拒否する任意のPromise subclassまで安全にdrainできるという過大な主張、および「不正・foreign・失効control」という試験名に対して実際には不正objectしか生成していない母集団不足を検出した。Runtime実装Commit `7473168fd8625ac7067807be385c2df93b9898b0`、Tree `653235a79e69aee98c31d00a7b0df9b6345b013f`のTask Runtime contract revision 21は、本番producerがexact native Promiseとして完了とsettlementを所有し、RunnerはProxy、Promise subclass、own `then`または非PromiseをAuthority、Recovery、Candidateまたは結果へ昇格しない。取消は元のcached Promise identityとrejectionを維持したまま同じturnでterminal observerを一度だけ接続し、10秒以内にacknowledgmentが確定しない、rejectまたは不正shapeの場合は資源cleanupを継続して不可逆poisonへ単調化する。Task completionは取消settlementをjoinし、資源cleanup確認済みと不明を分けて`processRestartRequired`、手動Recoveryおよび全actionable Recovery IDを投影する。controlは外周cleanupを含むcompletion最終settlementまでliveであり、別Runtimeのlive controlと完了後の失効controlは双方のRuntimeで追加Effect 0へ閉じる。続く再監査は公開CLIと同じ`void`利用形態のstrict独立Process根拠と、取消protocol failureと資源cleanup不明の結合根拠が不足していることを検出した。Evidence Commit `871f939306b5e53bfa8b595f4fd3a25538892d03`、Tree `a3694bf141cf78b659e408fc1984190873828c1f`では、同期throw、非同期reject、不正値およびnever Promiseを返却Promiseへ試験側handlerを付けず`--unhandled-rejections=strict`で実行し、重複SIGINT／SIGTERMを取消Effect 1、terminal observer 1、出力1、listener残存0、stderr 0およびexit 0へ固定した。公開CLIのimport、単一latch、同一listenerの両signal登録と`finally`解除、および取消APIの単一利用はTypeScript token syntaxで確認したが、字句scopeとbinding identityの証明ではなかった。実Runtimeの取消protocol failureとHost／Docker cleanup不明は、Host cleanupとDocker receipt／finalizeを進めずHostと2件のDocker Recovery IDを保持し、永続Candidateが未作成のためCandidate／Store Recoveryを捏造せず、成功公開を拒否する。型、lint、format、全949試験およびRepository全体Checkerのerror 0／warning 0を満たした。固定Runtime Commit `599b3ecd7e5369d67fc9b433ac8d8b0617059e87`で取得した物理Windows Console反復1000回の成功1000、native非0終了0は、今回変更していないConsole、Host Operation Supervisor、generation lockおよび専用Probeが実行する不変の依存閉包に限って既存Evidenceとして継承する。これは`7473168`または`871f939`のTask Runtime revision 21、CLI取消、Promise ownership、正式公開入口またはRuntime全体を新たに1000回実測した根拠ではない。正式署名4経路E2Eは別Gateで未取得であり、Runtime完成、統合またはRelease根拠へ昇格しない。

この字句結合の不足に対するRuntime固定Commit `e570d3fa8606929ed1b5dc014c7695f6f7490b99`、Tree `3baf634bdef4a2a96beacc65ab98729f11eaf19c`は、Taskごとの単一latch、SIGINT／SIGTERMへ登録する同一listener、部分登録rollbackおよび冪等解除をproduction helperへ集約し、公開CLIを固定`process`に対するhelperの単一利用へ縮退した。登録失敗は同じlatchから取消をexact once要求してTask completionを待ち、解除失敗を成功表示へ流用しない。解除は一方の失敗でも両signalを試行し、自身が登録したlistener以外を削除しない。後続Evidence Commit `7ee6dbb34ce01440fb512f528676de14164a4891`、Tree `f648cff375bb730de38988880ab69ef23cfabf39`は、同一callback identity、登録中signal、一本目／二本目の登録失敗、rollback失敗、片側解除失敗、二重解除および解除後の遅延signalを実helperへ通した。正常解除と確認済みrollbackはlistener残存0へ固定する。`removeListener`失敗時は両signalの必要な解除を試行し、非成功状態を保持するが、物理listener残存は不明として成功へ流用しない。公開CLIはTypeScriptの実ASTとsymbol解決を使って`runTaskCommand`全体を検査し、helperと取消APIの単一利用、戻り値bindingと`finally`解除receiverの同一性、直接signal登録、旧latch、shadowおよびguard前returnの不存在を確認する。finally内shadow、二重helper、直接signal登録、finally外解除およびhelper後・guard前returnを混入した陽性対照はすべて拒否する。型、lint、formatおよび全954試験を満たし、Repository全体Checkerのerror 0／warning 0を要求する。Task Runtime contract revision 21、10秒ack、Authority、Recovery、Console 1000回Evidenceの限定継承および正式署名4経路の別Gateは変更しない。

この固定版の再監査は、signal lifecycle失敗を新しい外周理由へ単調化する際、settled Task resultのcleanup、restart、CandidateおよびRecovery Evidenceを簡略reportで置換する伝播漏れを検出した。Runtime修正Commit `b516f7a18b08bd32cfd166884b82ae3290a7fea2`、Tree `a346a76c74cb29e964044e42847dd34b6998ff02`は、Runtime-owned resultを基礎に`command`、`status: blocked`およびsignal failure reasonだけを上書きする純粋投影へ一本化した。binding失敗とrelease失敗の双方で、`cleanupConfirmed`、`manualRecoveryRequired`、`processRestartRequired`、Candidate ID、期限、Host／Docker／Candidate／Store Recovery IDおよび追加のcanonical安全観測を欠落させない。後続Evidence Commit `399c6f6ded9023eb0f12ab7affd2e18a298c7e2a`、Tree `3ad97cd616051f13d213474682024e31c2a9361c`は、cleanup不明、再起動要求、Candidate、単数／複数Recovery IDを持つ複合結果とcleanup確認済みの非捏造対照を、両signal failure reasonのJSON投影および人間向け次Actionへ固定した。AST／symbol契約はprojectorへ同じ`result` bindingだけを渡すことを確認し、別resultへの置換を陽性対照で拒否する。型、lint、formatおよび全956試験を満たし、Repository全体Checkerのerror 0／warning 0を要求する。この是正はTask Runtime revision 21、signal helper lifecycle、Authority、Recovery ID文法、Console限定Evidenceまたは正式署名4経路別Gateを変更しない。

正式署名経路の認証Probe作成後にProcessが終了した実測では、Dockerが`--network=none`をinspect上の`NetworkSettings.Networks.none`として保持する一方、Effect後検査とRecoveryが空Network集合を期待していたproducer／consumer不一致を確認した。Docker Effect Runtime contract revision 8とDocker Recovery Runtime contract revision 18は、認証Probeの唯一の許容Network表現をexact `none`へ固定し、空集合、別Networkおよび追加Networkを拒否する。receipt前crashの再照合、receipt後のexact ID回収、通常Effect後検査およびfixtureを同じ規則へ伝播し、実停止コンテナと同形の陽性・陰性対照を契約試験へ追加した。この是正はProvider request、外部送信、Network接続またはcleanup Authorityを拡張せず、実Provider要求前に作成された停止中認証Probeを新しい署名Recoveryで回収するための既存契約整合である。

Docker Desktop 4.41.2は、旧runtime socketを単体削除できずEngineを起動できないHost状態となった。Docker関連ProcessとWSLを停止したうえで、Dockerの一時`run` Directoryを同じLocal App Data配下へ退避して新規生成させる可逆処置により、Docker Engine 28.1.1のServer応答を回復した。CRDDのRuntimeState、Provider Home、Container、ImageまたはVolumeはこのHost処置で削除していない。Engine回復後、固定署名配布物Commit `153109228b9ca8f4a65cf2e27af2c71dcbdfa66f`のrevision 18からexact Recovery IDを正式`doctor --recover-isolation`入口へ二回渡したが、いずれもWindows fast-fail `0xC0000409`で終了した。新しいreconciled receiptは作成されず、認証Probe Containerと耐久Recovery Evidenceは保持された。Provider request、Task executionおよび追加Network Effectは開始していない。同じHost／Home／RuntimeState lock、Docker hash、lock外inspectおよびexact `Networks.none`再照合だけのread-only Probeはexit 0で全lockを解放したため、未解決範囲はその後のRuntimeState再検証からreceipt耐久化へ進むproduction Recovery境界に縮約した。この観測は原因主体、Recovery成功、cleanup、残存0またはRuntime完成を証明せず、是正後の新固定署名版でexact Recoveryと残存0を得るまで実Provider Dogfoodingを開かない。

同じHost復旧を通常Operationへ混入させず再現可能にするため、Windows専用の明示`doctor --repair-docker-desktop-runtime`候補を追加した。初回候補の独立監査は、random lock identity、Engineの二値化、PID再利用競合、package更新競合、部分Effectの誤投影、再開不能な記録および人間表示の不正確さを検出した。是正候補は、発火をEngine既知停止の二重観測と固定`dockerInference` socketの既知アクセス不能へ限定し、署名済みCRDD配布物、native selected-user／Known Folder照合済みLocal App Data、保護Runtime State、単一の署名対象Policyに固定したDocker Desktop 4.41.2／Engine 28.1.1成果物、および選択User単位のWindows global mutexを要求する。署名済みnative helperは成果物の更新排他handleを保持し、公式shutdown後に残るProcessを同じkernel process handleで照合・停止・待機する。PIDやProcess名だけをAuthorityにせず、WSLは`docker-desktop`だけをterminateする。

Filesystem Effectは保護Runtime State内のHash chain段階記録と、固定`Docker\run`を同一親の一意な退避名へrenameする処置に限定する。Directory、socketまたは記録を削除せず、Identityを前後照合する。Engine再応答、固定成果物、Process集合およびhelper解放まで確認できた場合は`recovered_pending_close`とし、人間がopaque IDを`doctor --close-docker-desktop-runtime-repair`へ明示した場合だけ、全境界を再確認して削除せず`closed_retained`を追記する。未完了記録は次回の明示doctorで再開し、改ざん、第三状態、Identity差またはcleanup不明では新規repairを止める。通常Taskからの自動fallback、`wsl --shutdown`、CRDD RuntimeStateの他内容、Provider Home、container、image、volumeまたは別WSL distributionの削除を許可しない。契約試験は正常・非発火・三値観測・境界・各段階失敗・helper cleanup不明・再開・明示close・記録改ざんを対象とするが、再度Hostを破損させる実測は行っていない。この候補は別の`0xC0000409`、Docker Task Recovery、残存0、DogfoodingまたはRuntime完成を成立させない。

## 9. Repository／Candidate契約

- 対応BackendはローカルGitだけとし、`read_only`と`isolated_worktree`を扱う。
- 書込みOperationは既存dirty変更を自動取込みせず、固定HEAD Commit／Treeから隔離Candidateを作る。
- Repository Object Formatを確認し、SHA-1／SHA-256のOID幅を推測しない。
- Candidate Revision Identityは少なくとも`base_commit`、`base_tree`、`patch_hash`、`content_manifest_hash`および`allowed_paths_hash`へ結合する。
- 改行、Unicode、Path、mode、untracked、symlink、submoduleおよびcase collisionをcanonical化または拒否する。
- Reason／Execute後にcurrent revisionがbaseと一致しなければ停止し、古い前提のEffectを現在状態へ適用しない。
- Providerへcommit、push、merge、rebase、tag、Release、Publish、Financial Effectまたは無承認External Sendを許可しない。

## 10. 棄却した方式

旧`CHG-000030`で試したcaller管理のMount Grant Runtime Storeは`Close without Release`とした。欠陥は、同じLifecycleのAuthorityをcaller由来store identityへ依存させ、Runtime所有境界とRecoveryを分断する点である。成果物、export、試験および参照は撤去済みであり、次を満たさない限り復活させない。

- storeの生成、所有、永続性、consume、revoke、crash recoveryをRuntimeが一意に管理する。
- caller supplied Path、objectまたはclaimからAuthorityを発行しない。
- Provider Home実体Identity、selected user、OperationおよびMount Effectへ同じCapability chainで結合する。
- 成功、失敗、取消およびcleanup unknownを独立再レビューで反証する。

不採用判断は本CHGへ統合するが、採用されなかった事実と理由を失わず、別案の正当化なしに再導入しない。

## 11. 実装発展と旧CHGの移管

未リリースの内部Stepは、外部に独立ReleaseするMeaningful Changeではなく、本Runtime 1.0の成立条件、棄却分岐またはEvidenceであるため本CHGへ統合した。

| 責務 | 統合した旧CHG ID | 保持する意味 |
|---|---|---|
| Platform／Release Trust | `000019`、`000020`、`000021`、`000031`、`000032`、`000033`、`000034`、`000035`、`000036` | Rust helper、signed release binding、Windows provisioning、selected user、AppContainer、Host復元 |
| Provider lifecycle／Home | `000022`、`000026`、`000028`、`000029`、`000030`、`000037`、`000038`、`000039`、`000040` | official distribution、OAuth、専用Home、Mount Grant、棄却store、Claude vertical slice |
| Execution／Recovery | `000023`、`000024`、`000025`、`000027`、`000043`、`000048`、`000049` | Fake provider、failure／cancel、Filesystem race、Docker process／Effect／Recovery |
| Selection／Authority | `000041`、`000042`、`000044`、`000046`、`000047`、`000050` | explainable selection、Eligibility、Model Profile、Local Personal Authority |
| Repository／Provider Adapter | `000051`、`000052`、`000053` | Repository／Revision binding、Claude facade、Codex Subscription Adapter |

旧ID、旧filename、統合前状態、原文の固定Commit／Tree／SHA-256、統合理由およびEvidenceは[統合台帳](README.md)を正本とする。旧全文は固定Git改訂版から取得できる。旧CHGの`Verified`、個別監査Passまたは実測成功を、本CHG全体の完成・Releaseへ昇格しない。

## 12. Evidenceと検証境界

主な固定根拠は次のとおりである。

- Runtime全体の反復レビュー、監査、Docker隔離、Recoveryおよび正式Runner: [`Evidence/CHG-000015_*`](Evidence/)
- Platform／Windows／AppContainer: 台帳の`000019`～`000036`各entryから専用Evidenceへ接続
- Provider／OAuth: 台帳の`000037`、`000038`各entryから専用Evidenceへ接続
- Fake Providerの成功・失敗・取消: 台帳の`000023`～`000025`各entryから専用Evidenceへ接続
- 取消／Filesystem競合の収束: 台帳の`000027` entryから専用Evidenceへ接続

過去Evidenceは当時の固定改訂版に対する結果であり、現在改訂版のPassへ流用しない。署名済みCommit／Treeに含まれるEvidenceはbyteとfilenameを維持し、その欠落した旧CHG Path参照は物理stubではなく永続台帳のexact旧Path entryからCanonical CHGへ解決する。

現固定候補では次を全数確認する。

1. 公開済み`CHG-000001`～`000011`のtag到達Pathと内容を変更していない。
2. 未リリース`000012`～`000055`の44 IDが7 Canonicalへexact oneで対応する。
3. 旧IDの再利用、mapping重複、chain、cycle、欠落Canonicalおよび壊れたEvidence導線を拒否する。
4. 4経路表、Subscription-only、API fallback禁止、Authority／Effect分離、T1–T2および残件を機械契約で固定する。
5. Repository全体Checker、Checker契約試験、Coordinator全試験、型検査、Lint、Formatterおよびdiff checkを通す。
6. 同じ固定改訂版をArchitecture／Security、Test／UX、Document／Gap／Impact／Conformanceへ一括提示する。

Secret境界の回帰確認では、Task scope内の固定形式Secretと名前付き秘密値、秘密用Path、Read Projection内容、初回／是正Candidate、Candidate保存およびReviewerから派生する是正Pathを同じ検出primitiveへ接続する。通常Sourceのidentifier／member／bracket／call参照、秘密を説明する文章、明示placeholderおよび`.env.example`は非発火例とし、検出不能な未知Secretについて`credentialAbsenceVerified`または完全不存在を主張しない。Reviewer由来のPathが認識済みSecret値または秘密用Pathなら、次のExternal Send Grant消費、是正Packet発行およびProvider Effectより前に安全な固定理由で停止する。

## 13. 移行とRollback

| 利用側 | 必要な処置 |
|---|---|
| CRDD一般採用Repository | Runtimeを使用しない場合は非該当。方法論の既存利用を妨げない |
| Coordinator Runtime利用者 | 公式v0.18配布物、対応OS／Docker、公式Provider CLI、専用Provider Home、対話認証・送信承認を用意する |
| CRDD公式保守 | Release鍵、署名Manifest、sequence、配布Root、Windows provisioning、Recovery手順をRelease Gateで確認する |
| 内部private contract | 同じCandidate内でproducer／consumer／fixtureを一括更新し、旧revision aliasや自動fallbackを残さない |

Runtime 1.0をReleaseしない場合は、v0.17.xの方法論利用とRuntime非有効状態を維持する。Release後のRollbackはCRDD Release Identity、sequence floor、Provider Home、Host EffectおよびRecovery recordを確認し、単一componentだけを未知状態へ戻さない。

## 14. 対象外と残存リスク

対象外:

- 悪意ある同一Local User、Administrator、Kernel、Firmware、TPMまたはVendor signing infrastructure compromise
- 完全なRemote Attestation、Enterprise-wide Host Attestation、T3／T4
- Provider同士の直接spawn、再帰的Authority cycle、無制限subagent、無制限cost
- API key／従量API／追加credit購入の自動利用
- commit、push、merge、tag、Release、Publish、Financial Effect
- Git以外のRepository Backend

残存リスク:

- 固定1経路以外の正式署名E2E実測は未完了だが、4経路のproduction契約と完全一致Runnerは機械試験済みである。
- 正式署名入口での失敗、取消、親消失、cleanup ambiguityおよびmanual recoveryの全組合せは未完了である。
- Providerの規約、保持、学習利用、onward transferおよび正確なaccount／tenant identityをRuntimeは保証しない。
- Docker Desktop、Provider配布物、OSおよびSubscription offeringの更新時はIdentityとCapabilityを再評価する。
- 巨大な内部Security契約は利用者向け入口へ露出させず、READMEの現在Capabilityと開発者向けTrust／Provisioning／Recovery詳細を分離する必要がある。

## 15. Release処置

本変更は未リリースである。内部componentの個別完成、旧CHGの統合、固定1経路の成功、PR作成または監査開始を、Runtime 1.0の完成、統合、Stable化またはReleaseとみなさない。

全残件と最新固定改訂版の監査を閉じた後、人間の決定権限者がv0.18.0への統合、Issue処置およびReleaseを判断する。現在、このCHG統合方針について追加の人間判断は必要ない。
