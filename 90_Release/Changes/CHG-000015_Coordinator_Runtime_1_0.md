# 変更トレース: Coordinator Runtime 1.0

変更ID: `CHG-000015`
状態: `Reopened`
担当責任者: Qual-Lab
最終更新日: 2026-08-28
対象系列: Coordinator Runtime 1.x
対象バージョン: v0.18.0 Candidate / Coordinator Runtime 1.0 Candidate
変更分類: `normative`
リリースレベル: `MINOR`候補
`migration_required`: `true`

正本規則: [変更](../../12_Change.md)
概念正本: [エージェント組織](../../04_Agent_Organization.md)
Architecture正本: [エージェント組織の実行アーキテクチャ](../../04_Agent_Organization.md#12-execution-architecture)
実装案内: [Coordinator Runtime README](../../tools/coordinator/README.md)
Reference Runtime Architecture: [状態・資源・Lock・Recovery・検証接続](../../tools/coordinator/architecture/README.md)
脅威境界: [Threat Model](../../tools/coordinator/threat-model.md)
統合台帳: [未リリース変更トレース統合台帳](README.md)

## 1. 結論と現在状態

本変更の利用者価値は、Front Agentから直接Providerを相互spawnさせず、Coordinatorを唯一の仲介者としてCodexとClaude Codeへ実行・独立レビューを委譲し、検証済みのローカルCandidateを人間へ返せる`Coordinator Runtime 1.0`を一体として成立させることである。

2026-08-26時点で、署名済みCRDD Release Identity、Local PersonalのT1–T2境界、外部送信の対話承認、Claude Code Executor、Codex Independent Reviewer、Candidate検証・破棄およびHost／Docker cleanupを通る固定1経路を実測した。対象Commit `af76f555896d991edb88a6bc2f52b9865c6e9ac5`の正式Runnerは`RUNNER_EXIT=0`を返し、正規Repository、Candidate Store、Runtime State、Docker資源およびRunner Processの残存0を独立照合した。

後続の正式4経路実測では、RuntimeがCandidateの変更Pathを機械検証済みである一方、Git metadataを持たない独立Reviewerへ「唯一の変更Path」を重複証明させる責務衝突により、正しい固定Candidateにも是正要求が反復するGapを確認した。Reviewer Task Packetへ、開始RevisionとinventoryによるPath範囲はRuntimeが検証し、ReviewerはRead Projection上の候補内容・意味を独立確認する境界を明示した。Git metadata不在だけをFindingにせず、許可Path検証、Candidate内容確認および独立レビューのいずれも弱めない契約試験を追加した。次の実測ではReviewerの構造化Resultが不適合となったため、`approved`はFinding 0件、Findingが1件でもあれば`changes_requested`、非blockingな補足は`summary`という既存正規化規則をTask Packetへ明示し、矛盾Resultを成功へ補正しない契約試験を追加した。Docker Recoveryは表示された2件を依存順に回収し、現在在庫0を確認した。さらに次の実測ではExecutor、独立Reviewer、Candidate exact検証・破棄およびcleanupまで成立したが、正常完了Resultだけが`hostRecoveryId`を省略し、署名Runnerが`undefined`をRecovery不要の`null`へ推測補正せず停止した。正常・異常の公開ResultでRecovery 0件を同じ明示`null`へ固定し、production相当の正常完了試験でown field存在まで照合する。反復E2Eでは初回同意の実証と4経路収束を分離し、Route Matrix開始時の強制失効を廃止する。有効な永続同意は初回経路から再利用し、無い場合だけ一度確認し、後続経路はexact reuseを要求する。成功契約差はProvider本文、PathまたはCredentialではなく固定field識別子だけを返し、単一boolean停止の反復調査を避ける。再実測では同じReviewer Findingが是正後も反復したため、固定検証Taskの可視内容Reviewと、Signed Runnerが後段で行うexact UTF-8 byte／末尾LF検証を受入文上で分離した。Agentへ利用不能なbyte証明を要求せず、機械判定も弱めない。次の実測ではRuntimeが承認・永続化したCandidateに対し、Signed Runnerが公開Resultへ複製された`changedPaths` shapeをCandidate Bundleより先に重複判定して停止した。Executor申告とWorkspace差分の一致はRuntime内で、唯一のPath、entry、Hashおよびexact byteはCandidate Bundleで検証済みとなるため、複製投影をAuthorityとして再判定せず、Signed Runnerの最終GateをCandidate Bundleへ一本化する。再試行では独立Reviewerが是正後も承認しなかったため、受入文に残っていた「唯一の変更Path」という機械検証義務を、Reviewerが確認する指定Path上の可視markerと、Runtime／Signed Runnerが確認する他Path変更なしへ明示分離する。構造化Resultの後続停止を生出力なしで切り分けられるよう、入力、JSON、Claude Envelope、Executor shape、Reviewer shape、findingおよびdecision整合を固定理由へ分類し、一回是正後は過去Findingを再掲せず現在Candidateから再評価する契約を追加した。正式署名4経路の再実測は未完了である。

この成功はRuntime 1.0全体、4経路、失敗／取消Recovery、統合、ReleaseまたはT3–T4保証を意味しない。現在の本変更は、未リリースCHG統合による正本再構成と残る経路・Recovery・Release Gateのため`Reopened`である。

後続の現在候補では、両Front×両Executorの4経路、同一Provider例外理由、独立Reviewer、単一Active初期同意、4経路の完全一致Runnerおよび失敗／取消Recovery Matrixをproduction経路と同じ契約へ接続し、全機械試験を通過した。初期同意は全Policy Provider境界を表示し、現在Task／Revision／Scopeを非永続Previewへ分離し、選択ユーザー・保護Runtime State・Policy byteへ結合する。A→B→Aで古いAを復活させず、180日失効、明示取消、部分／破損pairの安全なAuthority除去および判定不能時の手動回復停止を固定した。この段階は正式署名4経路実測またはRuntime完成監査の完了をまだ意味しない。

開発中のSource修正とRelease鍵署名を交互に行う反復は廃止する。4経路、一般Task、独立Review、一回是正、CandidateおよびRecovery Matrixは、Release鍵、passphrase、実Provider送信またはRelease Authorityを使わない`development-e2e:verify`で継続確認する。正式署名E2Eは全機械確認後に凍結したRelease Candidateへ一度だけ適用する。一般利用者にはRelease鍵またはpassphraseを要求せず、公式Release担当者だけが新しい公式配布物の発行時に署名する。決定論的試験の成功を正式署名配布物や実Provider実測へ昇格しない。

設計と実装・試験の照合では、主Taskのcleanup DAG、Host／logical Home／Runtime State Lock順序、解放窓後の再照合、content＋commit sidecarの部分状態および結果公開条件が実装内へ分散し、設計状態を一次キーにした網羅性を再構成しにくいGapを確認した。Coordinator固有のReference Architectureを`tools/coordinator/architecture/`へ置いた。Architectureは公開CLIのsignal bindingを含む10資源を示し、現在の機械可読Task Traceはそのうち直接観測できる9資源、20状態、21遷移、10不変条件、10検証接続および70の状態別caseを固定する。安全なblocked terminal、cleanup確認済みのProcess再起動、Operation取得中、exact IDを持つRecovery、IDなしoperator transfer、循環しない一回是正状態列、Host cleanup後のRecovery、Stageごとのlogical Home lock解放、別InvocationのRecoveryおよび契約投影／実Filesystem・Process観測の境界を明示する。Process再起動はProcess scopeとし、同じProcessの別Operation由来のpoisonも全clean terminalから到達できる。Host cleanup後に結果とCandidateを公開済みの場合はそれらを保持し、現在Processからの次Effectだけを禁止する。専用Checkerはentityのexact shape、ID、参照、孤立、risk、operation／invocation terminal遷移、検証境界、一意な遷移×単一開始状態×区分、遷移結果、Provider／Host／cleanup別Effect観測、結果状態、観測資源の後条件、Architecture記載およびcase IDを含む実在試験を検査する。これは試験の実行結果や監査Passを自動証明せず、独立レビューと監査を代替しない。

同照合で、正式署名Route Matrix停止後にHost側`active-docker-task-v1.json`のexact contentだけが残りcommit sidecarが未作成となる、Host Effect前の到達可能状態を固定した。明示Recoveryは同一Lock内で、Host previous世代、全Docker submission不存在、完全一致base、完全commit済みpointerのschema／stable Home／operation name／Recovery ID／base hash、active bindingのschema／Recovery ID／base hash／operation nonce、active commit不存在を同時に確認した場合だけ当該contentをrollbackする。通常完了、通常receipt replay、crash receipt replay、Effect前rollbackおよびfresh crash recoveryの全削除経路は同じactive binding／pointer閉包を削除前に検査する。存在観測は`ENOENT`だけを不存在とし、削除後の権限拒否、共有競合、I/O失敗、非fileまたはsymlinkではanchor、EvidenceおよびRecovery IDを保持する。process killを実際にcontent rename直後へ注入した準正常試験、正常完了とEffect後Recoveryのmissing／partial／replacement試験、削除後観測不能試験およびactive／pointerの差を保持する異常試験をTraceへ接続した。実Host残存の処置と正式署名再実測は、更新配布物の固定後に行う。

固定候補`3cbca49`への独立Security、Test／UXおよびDocument／Gap監査は、下位Processがcleanup済みと報告しつつexact Docker Recovery IDと手動Recovery要求を返す形をTask境界が落とすこと、foreign Home bindingを持つblocked Recovery ID、通常Host cleanup入口のactive binding未確認、旧Host先行削除の実`active binding content-only`停止点、および新しいcleanup順序不変条件と実試験の接続不足を検出した。Task Runtime revision 22、Process Controller revision 16およびDocker Recovery revision 23では、cleanup・手動Recovery・exact IDを直交して伝播し、ID内Home bindingを現在planへ照合し、通常cleanupと明示Recoveryへ共通Docker閉包Gateを適用した。旧Host先行削除はHost begin receiptと全submissionがなく、base、pointer、Runtime inventoryおよびHost不在をexactに確認できる場合だけDocker不存在、Mount未成立およびHost不在receiptを耐久化して収束する。実子Processの停止点、content／commit sidecar残存、pointer欠落・partial・replacementおよびTask公開境界を正常・準正常・異常試験とTraceへ接続した。全体確認中に検出したNode Coverageの親診断設定とSupervisor私有IPCの競合は、Windows子Process Profileで`NODE_V8_COVERAGE`を固定neutral値へ閉じ、通常実行とCoverage実行の同じSupervisor契約で再検証した。新固定版の全機械確認、独立再監査および正式署名実測までは完了扱いにしない。

続く固定候補`48085b4`への同一監査集合は、旧Coordinator facadeがcleanup済みと手動Recovery／exact Docker IDを直交して保持しないこと、Host先行回復後のDocker finalizationがactive binding／pointer削除途中のProcess中断から再開できる耐久Intentを持たないこと、およびactive binding拒否のTraceが公開Task RuntimeではなくDoctorの手組み観測へ結合されていることを検出した。追加是正では、旧facadeもHost／Docker Recovery IDと手動Recoveryを保持してHost rootを削除せず、Host不在・marker不在・submission不存在をexactに結合した耐久precleanup finalization intentをactive binding／pointer mutationより前へ記録する。pointer content削除、Docker不存在record、Mount不存在recordおよびHost cleanup receiptの各直後にfresh Processへ切り替えて同じexact IDから残存0へ収束することを確認した。Traceのactive binding拒否caseは、実Host operationと実active bindingを作る公開Task Runtime試験へ移し、二つのProvider stage、二つのDocker handoff、Host cleanup拒否および全exact ID保持を実測する。最新SourceはCoordinator全1155試験、TypeScript strict typecheck、Lint、Formatter、Trace CheckerおよびRepository全体Checker（error 0、warning 0）を通過した。固定Commitの独立再監査および正式署名実測までは完了扱いにしない。

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
2. 公開Task入口の実OS／Filesystem／Process結合Harness、旧facade整理および安全な公開reason分類を、Reference Architectureの未解決項目として閉じる。
3. 最新改訂版でArchitecture／Security、Test／UX、Document／Gap／Impact／Conformanceを完了する。
4. 実測Evidence、README、Roadmap、CHANGELOG、IssueおよびRelease範囲を現在状態へ同期し、人間の統合・Release判断へ渡す。

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
- Dogfooding用release staging、Git worktreeおよび試験一時物が親Directory、兄弟RepositoryとOS一時Directoryへ分散した事象を、Filesystem Effect境界の欠陥として同じ未リリース変更内で是正する。現在のリポジトリ外への書込みは既定拒否とし、用途限定Rootの事前許可または表示されたexact Rootへの人間承認なしに実行しない。Repository-local `.crdd`とOS管理Runtime Rootを責務別に分け、Operation一時物は一つのRuntime-owned Rootへ集約し、cleanup不明を成功にしない。開始Commitへ固定する外部送信PolicyはRoot直下の単独fileから`.crdd/external-send-policy.json`へ移し、旧Pathとの暗黙fallbackや二重正本を残さない。既存残留物は所有Identityと削除対象を確定し、人間承認前に推測削除しない。

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

正式署名4経路のForward実測では、Claude Executor完了後のCodex Reviewer認証Probeが`provider_subscription_auth_not_confirmed`へ誤停止した。専用Homeの同じ固定imageをnetwork none、read-only、non-rootで再実測すると、公式CLIは認証済みを示したが、`docker start --attach`は既知のread-only PATH alias警告と`Logged in using ChatGPT`をともにstderrへ搬送していた。Controllerがstdoutだけを判定していた搬送契約漏れを是正し、stdout／stderrのexact四形だけを許可した。未知行、重複成功、余分行、NULまたは孤立CRは引き続きProvider Effect前に拒否する。この修正は認証条件、Subscription-only、Provider Home保護、EgressまたはAPI fallback禁止を緩和しない。

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

後続監査是正では記録をrev4とし、shutdown、native termination、WSL termination、renameおよびlauncherを、同じactionの耐久`intent_recorded`と`settled`へ分離した。intent確定後にpackage／Policy／helper／取消境界を再確認し、未settled intentを再発行しない。現在状態を過去の発行証明へ流用せず、operation固有staleのexact Identityから帰属を証明できるrenameだけを観測済みEffectとして再開する。record writeは自己参照を避けた専用Filesystem Evidence Effectとし、fresh hash-chain読取り後だけconfirmedへ精緻化する。reader／writer共通validatorはaction閉集合、phase、順序、stage相関およびaggregateを検査し、通常15件と再開余裕9件の上限24件を固定する。既知の発行事実を後退させず、後続Effectが不明なら以前の成功で隠さず全体確認を`unknown`にする。CRDD manifest Hash／Release Sequence／Tree／package content rootへの再開結合、旧rev2／rev3の非移行停止、Engine／Process三値、run／stale四状態とexact Identityの段階行列、new live run Identity、および過去Effect不明・staleなしの専用pending／terminalを追加した。Nodeの非同期launcher起動は廃止し、native helper protocol rev4が生成前非発行、生成後確認済み、生成後確認不明を分離する。durable terminalはEvidence dispositionだけを表し、helper protocol成否とchild `close`、stdin／stdout／stderrおよびprocess handleのbounded cleanup確認を分離する。cleanup確認済みでもprotocol不成立は成功または新規repair許可へ昇格しない。契約試験は取消、helper喪失、package世代差、intent／settlement、rename後record前のat-most-once再開、Process不明／run置換、rev4 Store round-trip、旧rev拒否、reader非互換writer拒否、terminal再表示、遅延exit／stdio回収、protocol失敗cleanup、公開CLIのusage／blocked表示およびnative同一CreateProcess primitiveの実child観測を含む。実破損Hostでの復旧、`0xC0000409`、Docker Task Recovery、Dogfooding、Runtime完成およびReleaseはこの候補の成功根拠に含めない。保証対象は直接Effectに使う固定executable集合とEngine応答版であり、未列挙DLL、resource、loader依存、installation全体または供給経路のAttestationは主張せず、人間が確認した公式Docker配布物と正常なupdaterをT1–T2のTCBに含める。

固定版`954c2ab`の3系統独立監査は、settlement後かつstage前の再開位置、Effect非発行と対象不存在の分離、Path第三状態、Journalの不可能系列、Effect前容量予約、取消とprotocol causeの直交、rename adoption時のEngine表示、および公開CLI結合に残るGapを検出した。同じrev4候補内の是正は、stageとsettled Effect prefixを共通状態機械へ統合し、全5 Effectを再発行せず再開する。Host Effect初出intent、同action settlement、Record単位delta、stage必須系列、rename系列排他およびrecord-write相関をreader／writer双方で固定する。通常15・上限24 Recordと最大64 retained Operationについて、次の安全なdurable stageまでをEffect前に予約し、容量不足では削除・compaction・65件目Directoryを発行せず人間へ移送する。`K/N`は非発行確認済み・Process状態不明として後続WSLを止め、Path不存在は三値観測の`confirmed_absent`だけから成立させる。取消後に許す追記は取消前の耐久intentに対するcleanup-only settlement最大一回だけとし、protocol原因とbounded cleanupを別軸にする。公開doctorはprivate typed dispatcherをproductionと試験で共用し、repair／closeのJSON／人間表示、usage 64、blocked／throw 2、close終端0を固定する。この是正も実破損Host、`0xC0000409`、Docker Task Recovery、Dogfooding、Runtime完成またはReleaseの成功根拠へ昇格しない。

同じ未リリース候補への次の是正では、耐久段階から次のHost作用を決める分類器と、作用直前にEngine／Process／`run`／operation固有stale／取消／Authorityを再観測するEffect別行列を分離した。Process不存在を確認した`K/A`はnative termination非発行確認済みとして単独記録し、非発行だけ確認してProcess状態が不明な`K/N`はunknown reconciliationを同一Recordへ併記して後続Effectを止める。全5 Host Effectを実rev4 Store上でintent直後、Host作用直後かつsettlement前、settlement直後に中断し、未確定Effectを再発行しないこと、renameだけは現行`run`不存在とoperation固有staleのexact Identityから帰属を証明してsettlementと`renamed` stageを二Recordで採用できることを固定した。`prepared`中の自然回復も、過去Process Effectを推測せずunknown観測とno-stale pending遷移を二Recordへ分離した。全stdioのactive protocol error、正常`Q`後のstdin終了throw／error、公開dispatcherのthrowもbounded cleanup、protocol、opaque IDの保持可否を分ける。この是正はWindows向け・人間明示・既知Docker Desktop破損だけの最終復旧境界を変えず、自動発火、socket単体削除、全WSL停止、PID単独kill、Provider連携、T3／T4または実Host復旧成功を追加しない。

固定版`d861f02`の再監査で検出したhelper exit、fresh観測、`K/A` producer／Store差、shutdown不明後の後続Effect、耐久応答不明および既知Effect自然回復の伝播不足を、同じ未リリースCHG内で是正した。helperはexact `C`一件だけでなくexit 0、signalなし、余剰frame／partial byteなしおよび全stdio settlementをprotocol完了条件とする。Effect直前行列は非同期artifact確認を先に終え、Process観測後にpackage／Policy、Engine、`run`、staleおよび取消を同期再確認してからawaitなしでHost関数へ接続する。公式shutdownの非発行または確認不明では同一run／再開とも後続Host Effectを止める。確認済みshutdown後のProcess不存在だけは`K/A`限定direct `false/not_issued`観測をrev4 automatonが受理し、native Host call 0でWSL判断へ進む。Record応答不明はimmutable candidateからfresh actual inventoryの同一operation、次sequence、stage、ledgerおよび検証済みchainが完全一致する場合だけ耐久化済みへ精緻化する。known／unknownを含む`prepared`自然回復は同stage観測とpending stageを分離する。actual Store K/A、write応答不明精緻化、artifact await中Engine回復、shutdown unknown Effect 0および`C`後exit非0を契約試験へ追加した。この是正も実破損Host、Docker Desktop更新競合、`0xC0000409`、Dogfooding、Runtime完成またはReleaseの成功を主張しない。

固定版`e0cdf8a`の再監査は、共通validatorがstage必須prefixを完全には閉じていないこと、settled prefix再開からEngine自然回復後に次のHost Effectを発行し得ること、`K/N`の非発行settlementとProcess状態不明reconciliationが別Recordでcrash可能なこと、renamed自然回復producerとactual Storeの不一致、容量停止理由、native helperのinitial／abort／stdin終了cause、およびtyped doctor最終fallbackの情報欠落を検出した。同じ未リリースrev4内の構造是正は、前後stage／ledger／意味deltaを一つのexact automatonへ統合する。通常Recordはrecord-write bookkeepingと意味delta最大1件だけを許可し、`K/N`のnative非発行settlement＋unknown reconciliationだけを同一Recordの限定複合deltaとする。shutdown→optional native termination→WSL、settled process prefix後のHost rename、renamed所有のlaunch、未settled intentの末尾性、unknown reconciliation後のHost Effect 0、rename系列排他、pending／terminalの安全集約をreader／writerへ固定した。

再開時およびintent耐久化後・Host関数直前にEngine、Process、runおよびstaleをfresh三値観測し、readyまたはunknownならHost関数を呼ばず非発行settlementへ閉じる。自然回復は過去launcher発行を捏造せず`observed_desktop_recovery`として保存し、既知Effect後のno-stale、過去Effect不明のno-stale、およびrename後stale保持の意味を分離する。容量はStore所有の残Effect／stage計算を使い、Host復旧不要な容量枯渇も削除・compaction・反復実行を促さずRuntime operatorへ移送する。native helperは不正initial frameとfailure前abortをprotocol failureとして保持し、正常`Q`後のstdin終了失敗を同じmemoized bounded cleanupへjoinする。doctor最終fallbackは全tri-state、Evidence、Disposition unknown、operator action、cleanupおよび`newRepairPermitted=false`をtyped reportへ固定する。actual rev4 Store試験は通常系列、renamed自然回復、既知Effect後no-stale recovery＋close／replay、K/N片側Record拒否、必須prefix／二rename／unsettled後observation拒否を含む。この是正も実破損Host、正式署名distribution、`0xC0000409`、Docker Task Recovery、Dogfooding、Runtime完成またはReleaseの成功根拠へ昇格しない。

## 9. Repository／Candidate契約

- Repository-local `.crdd`は検証済みProject／Git worktree Rootの直下へだけ配置する。公開CLIと署名E2EはCurrent Working DirectoryをRepository Authorityとして使用せず、subdirectory起動時も最寄りの有効なGit Rootへ結合する。不正または曖昧な中間Git境界は外側へ読み替えず、Filesystem Effect前に停止する。
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
| CRDD v0.18方法論を採用するRepository | 基準版の採用時に、状態・遷移・資源・Lock・AuthorityまたはEffectを持つ進行中／未是正の非自明な変更と入口差分を棚卸しし、設計要素から実装、正常・準正常・異常の検証、実観測および終了後条件までを接続する。完了済みの過去作業を機械的に再開しない |
| v0.18採用時に進行中／未是正の高リスク層間契約を持つRepository | 実producer、搬送、対象範囲で把握できるproduction consumer、外部公開契約、耐久状態のAuthority分類および現在のEvidence軸を棚卸しする。単純な局所処理や非該当契約は理由を残して除外でき、完了済み過去作業は再開しない |
| v0.18採用時に進行中／未是正で、失敗時に残存資源またはRecovery／Authority義務を残し得る取得transactionを持つRepository | 取得Effect、到達可能なthrow境界、live owner capability／cleanup完了／exact Recovery／IDなしoperator transfer／Effect前拒否の排他的settlement、および各public consumerの投影を棚卸しする。read-only観測、残存所有なしで終了を決定論的に観測できる局所資源、または完了済み過去作業を機械的に再開せず、存在しないRecovery Authorityを追加しない |
| Coordinator Runtimeを使用しないRepository | Runtime固有のProvisioning、Provider Home、DockerおよびRecovery移行は非該当。方法論のv0.18移行要否とは分けて判定する |
| Coordinator Runtime利用者 | 公式v0.18配布物、対応OS／Docker、公式Provider CLI、専用Provider Home、対話認証・送信承認を用意する |
| CRDD公式保守 | Release鍵、署名Manifest、sequence、配布Root、Windows provisioning、Recovery手順をRelease Gateで確認する |
| 内部private contract | 同じCandidate内でproducer／consumer／fixtureを一括更新し、旧revision aliasや自動fallbackを残さない |

Runtime 1.0をReleaseしない場合は、v0.17.xの方法論利用とRuntime非有効状態を維持する。Release後のRollbackはCRDD Release Identity、sequence floor、Provider Home、Host EffectおよびRecovery recordを確認し、単一componentだけを未知状態へ戻さない。

### 13.1 Windows最終復旧候補の最新監査是正

固定版`e0cdf8a`、続く固定版`d861f02`、および固定版`a3ddc1d`の順に行った再監査と是正を、同じ未リリースrev4候補の発展として扱う。過去段落にある「再開余裕9件」は到達可能な意味系列を表さず、意味的に到達可能な通常最大系列15 Recordとは別の、防御的hard cap 24 Recordを指す。23／24境界試験も純粋な容量停止だけを確認する。

最新是正では、`unknown`のHost Effectまたはreconciliationを含む履歴を既知pending／closedへ昇格させず、専用historical状態だけへ保持する。再開、既存pending、明示closeおよびterminal再表示は、非同期artifact／Process観測後にpackage／Policy、Engine、`run`、staleおよび取消を同期再観測する共通fresh snapshotへ結合した。境界不一致、helper喪失、artifact不明、取消、容量不足および耐久化応答不明を別の理由として保持する。native helperはexact `C`後のstdout／stderr errorもprotocol Evidence不明として失敗させ、stdin終了側だけをcleanup専用とする。実rev4 Store試験はwriter ack不明とdurable intent後crashを分離し、全5 Host Effectの再発行0、公式shutdown不明後の全後続Host call 0および未知履歴のknown stage拒否を確認する。これはWindows向け・人間明示の最終復旧境界を変えず、自動fallback、Host実復旧成功、Docker Task Recovery、Dogfooding、Runtime完成またはReleaseを主張しない。

続く固定版監査では、cleanup settlementのpackage／Policy再計算後にhelper livenessを再確認していない箇所と、自然回復settlement、rename adoption、Process quiescenceおよびrename後stageの永続化が非同期境界前の状態を再利用する伝播漏れを検出した。同じ候補内で、cleanup settlementはhelper喪失時にRecord Effect 0へ閉じ、現在状態を意味へ変換するstage記録はEngine、Process、`run`、staleおよびAuthorityの共通fresh predicateをpersist直前に必須化した。回帰試験は自然回復settlement後のEngine再停止、rename adoption中のstale Identity消失およびpackage再計算中のhelper喪失を既知pending／安全stageへ昇格させず、後続Host Effect 0へ固定する。

### 13.2 設計―実装―検証Traceの監査是正

Coordinator Reference Architectureと機械可読Traceの初回・第二固定候補に対する独立監査は、宣言したcase IDと実scenarioの完全結合、terminal状態母集団、Effect差分、物理観測境界およびFilesystem不存在判定の不足を検出した。同じ未リリース変更内で、Task Runtimeへ制御権を持たない単調lifecycle observerを置き、Canonical 41 caseを実開始状態、終了状態、遷移差分、結果および資源後条件の完全一致へ接続した。`ENOENT`以外を不存在とせず、Host active binding削除済み・exact pointer残存をfresh Processで残存0へ回復し、観測不能時はEvidence保持へ閉じる。Docker Recovery開始理由は内部情報を出さない固定分類へ分けた。これらは新固定改訂版の再監査前であり、Runtime完成またはRelease根拠へまだ昇格しない。詳細は[`Evidence/CHG-000015_Design_Source_Trace_Review_04b39fd.md`](Evidence/CHG-000015_Design_Source_Trace_Review_04b39fd.md)を参照する。

後続監査では、production Docker inventoryの`status=completed`をcleanと誤読するConsumer、Operation取得EffectをAdmissionへ隠す状態欠落、成功時だけTask controlを失効する最終化、および状態名からConsole／Control不存在を作るfixture ledgerを検出した。同一未リリース変更内で、producerとTask／Controllerが共有するexact Projector、`STATE-OPERATION-ACQUIRING`、例外時も保守的な構造化Resultとcontrol失効を保証するfinal settlement、および公開取消receipt／Console cleanup結果から作る資源観測へ是正する。単一・複数・観測不能・malformed inventory、Operation取得cleanup確認済み／不明、final projection例外およびfresh Process失敗時のexact試験資源回収を検証し、新固定版の独立再監査前にResolvedとしない。

第五固定候補`9260f0e`の同一監査集合は、前段のMajorを解消した一方、Docker Recovery producerのclean SchemaとRecovery ID／Hash相関が任意値を通し得ること、Operation Directory初期化失敗が本番primitiveの外側で分類されること、Canonical caseの登録集合と実行集合を一致させていないこと、fresh Process fixtureのhandoff前失敗時回収、および方法論変更の採用Repositoryへの移行説明不足を検出した。同じ未リリース変更内で、Recovery IDを`docker-task.<64hex>.<64hex>.<64hex>`へ固定し、Hash相関、重複、clean／inventory／blockedのexact shapeを共有Projectorで検査する。Operation Directory生成全体をopaque分類primitiveへ収束し、Effect前失敗とroot生成後rollback確認済み／不明を区別する。Trace試験はCanonical登録集合と実assertion実行集合の完全一致および欠落する陽性対照を要求し、fresh Process fixtureはhandoff前にもexact token／Identityへ結合した資源だけを回収する。方法論移行はRuntime非利用の非該当と分け、v0.18採用時の進行中／未是正変更だけを棚卸しする。これらは更新固定版の独立再監査前にResolvedとしない。

第六固定候補`7a6150a`の同一監査集合は、前段のRecovery ID相関とTrace登録／実行差を閉じた一方、Operation DirectoryのRoot、初期化markerおよび一時fileを一つのRecovery transactionとして閉じていないProcess-loss窓、`existsSync`による観測不能の不存在化、Docker Recovery開始成功形を受け取るControllerでのexact ID／Home binding／Capability再検証不足、および共有Recovery inventoryを使う試験間干渉を検出した。同じ未リリース変更内で、Root生成前にnullable Identityを持つ`initializing` recordを耐久化し、Root不存在なら自動回収、Root生成後かつIdentity未確定なら推測削除せず手動Recoveryへ移送する。Filesystem不存在は`ENOENT`だけで確定し、成功したRecovery handoffもexact token、stable Home hashおよびobject capabilityをEffect前に再検証する。結合試験は実行ごとのTEMP／Recovery namespaceを所有し、終了後のexact不存在を観測する。これらは更新固定版の独立再監査前にResolvedとしない。

第七固定候補`815b022`の同一監査集合は、Root生成前後の非同期Process-loss、三値不存在、Trace集合および試験namespaceを解消した一方、marker／一時fileのopen後Identity取得失敗を外側でcleanへ戻し得る単調性違反、active Home hashをinactive Recovery IDにも要求する意味軸混同、Recovery成功形の`ready` discriminant／opaque binding／abort settlement不足、およびRecovery Trace 2件の実行済み記録順を検出した。同じ未リリース変更内で、open handleからIdentityを直ちに取得し、writerのcleanup不明をopaque failureへ保持する。Recovery IDは予定内容から作らず、捕捉済み旧markerまたは当該writeのsuccessorに属するFilesystem Identity＋bytesと現在markerが一致し、exact schema、Root名および実bytes Hashを安定再読取りできた場合だけ返す。同一bytesでも無関係なIdentityへの置換はIDなしのoperator transferへ閉じる。Root、marker、一時file、handleおよびRecovery directoryの各結果は論理積で単調に集約し、未知資源があればmarkerを消さない。active hashはRecovery ID由来Home集合の部分集合として検査する。Controllerはexact ready shapeとRuntime-owned bindingを再検証し、不正成功形のabortとMount settlementをAuthority／Lease返却に限定して、durable inventoryのcleanupとは扱わずexact IDを手動Recoveryへ保持する。これらは更新固定版の独立再監査前にResolvedとしない。

続く固定候補の監査は、旧Coordinator facadeがProcess Controllerの実`recoveryId`を読まず手書きcallback fixtureだけで成立を推定していたこと、Host先行回収後の耐久finalization intentを安全predicate前に書いて失敗呼出しが次回Recovery Authorityをmintし得たこと、およびTask Runtime contract fixtureの実Filesystem観測を公開入口・実Processまで確認した根拠へ昇格していたことを検出した。同じ未リリース変更内で、実producer shapeと対象範囲で把握できるproduction consumerをproducer所有Projectorへ接続し、開始返却／callback／完了Recovery IDの相関、Effect前／Host cleanup／Host削除後Docker finalizeのID保持、およびOperation Root生成からCapability初期化までのtransaction回収を分離する。旧facade contract revision 7、Task Runtime contract revision 23、Docker Process Controller contract revision 17およびDocker Recovery Runtime contract revision 24を現在の組合せとする。finalization intentはHost／submission／active不存在とexact committed pointer、Recovery ID、nonce、base／Home hash、initial Host IDを確認した後だけ発行し、発行条件成立前の拒否は新規Authorityを残さず、exact発行後の失敗では同じintentだけをRecoveryへ保持する。Evidenceは入口形態、観測基盤、成果物Identityおよびlifecycleを独立軸として、当該fixtureを「Task Runtime契約＋実Host Filesystem」へ限定した。CRDD一般則は、別invocation／processで保護Effectの十分な根拠または不可欠なpredicateになる耐久状態だけをAuthority-bearingとし、fresh Authorityへ再結合する通常のqueue／progress／checkpoint／Evidenceを除外する。単純な局所処理へ新しい重い成果物または監査を要求しない。更新固定版の機械確認と独立再監査前にRuntime完成またはRelease根拠へ昇格しない。

正式署名4経路の再実測では、第一StageのDocker cleanup後、次StageのDocker Recovery初期化がHost generation遷移前に停止した。公開Controllerがexact Recovery ID付きの安全停止理由を一律にidentity不正へ畳み込んでいたため、実原因と回復Authorityが一致しない表示になっていた。また、Host明示RecoveryはHost recordが`host_only`であることだけを見てRootを先に回収でき、同じOperationのEffect前Docker active bindingを見落とす依存順Gapがあった。同じ未リリース変更内で、exact ID付き安全停止は下位の固定公開理由を保持し、不正成功形だけをidentity不正へ分類する。Host cleanupはactive Docker bindingのcontentまたはcommit sidecarがある間は停止する。旧版によりHostだけが先行回収済みの既存状態は、exact Docker資源、Mount、active binding、pointerおよびHost absence receiptを順に照合できた場合だけDocker Recovery recordを回収し、Provider Effectと結果公開は0に保つ。Candidate Store、logical Provider HomeおよびRuntime Stateの同期named pipe lockはrelease stateの観測上限を5秒へ広げるが、取得、Interactive ConsoleおよびHost Supervisorの別Process cleanup上限は広げない。正常、旧版準正常、active binding競合および理由投影を契約試験へ接続し、固定版の再監査と正式署名Recovery／4経路E2Eまでは完成根拠へ昇格しない。

最新固定候補`a54b4408fb8b28a8b630942ad84da705c450b074`／Tree `1180770d46ad0b0b4f6ca6c8f5f2cc42cb758ce1`の正式署名4経路再実測は、Provider／Network Effect前の同意取消で停止した。単独取消、General Task import後およびRoute Matrix import後の取消は成立し、公開scriptを直接entrypointにした場合だけ失敗した。比較から、非同期`main`をtop-levelで待たずに開始する公開entrypointが、意図的に`unref`された内部lock Workerを含むProcess生存を完了まで所有していない可能性を検出した。同じ未リリース変更内で、正式General Task、4経路Matrix、Recovery Matrix、鍵生成およびRelease manifest署名の非同期entrypointをtop-level完了所有へ統一し、直接scriptとexported functionの実行形態差を契約試験へ固定した。旧署名配布物は再利用せず、新しいCommit／Treeを再ステージング・再署名して4経路とRecovery Matrixを再実測する。これはProvider選定、Authority、同意Policy、課金境界またはRecovery意味の変更ではない。

その修正後の固定候補`f00c2a449d9f5f1f7954bfee9136ecec14f245f6`／Tree `e4c83d74394ea956e0f8852b4f3be25e7efa5157`でも同じ取消停止が再現し、top-level所有だけでは解消しないことを確認した。保護Root観測はselected-user、Protection、Releaseおよびartifactの全軸で成立し、同じmodule集合から別entrypointで呼ぶと同期lockを取得・解放できる。残る差は、公開scriptのcold start直後にTypeScript module graphとnamed-pipe Workerを同時起動する経路が、同期lockの`acquired`状態通知を1秒以内に得られないことである。固定sleepや回数retryは追加せず、状態通知を待つ同期Candidate Store／logical Provider Home／Runtime State lockの取得上限だけを既存release上限と同じ5秒へ拡張する。Interactive Console lockとHost Operation Supervisorの取得上限1秒は維持し、各上限を機械契約で別fieldとして固定する。更新固定版の直接公開entrypoint実測で解消するまで原因確定または完成根拠へ昇格しない。

この往復の一般原因は、設計要素、実装symbol、検証項目、実観測および終了後条件の閉包を固定候補前Gateが明示的に要求していなかったことにある。特定Runtimeだけの対策へ閉じず、`27_Architecture.md`、`28_Implementation.md`、`16_Quality_Assurance.md`および`10_Agent.md`の既存責務を強化し、状態・遷移・資源・Lock・Authority・Effectについて正常・準正常・異常の接続を全数照合する。状態名、成功結果、試験件数またはcoverage率から資源不存在、Authority失効、Effect 0またはcleanup成立を推定せず、実receipt、ledger、observer、公開結果または独立した終了後観測へ接続する。専用成果物は一律に要求せず、複雑な境界で人の記憶に依存するときだけ機械可読契約等へ具体化する。

## 14. 対象外と残存リスク

固定候補`8865ef94ec975f0a307a37c97832fa516fc7c07d`／Tree `747fd758b3e25d04b263e087d37e242948095b2e`への同一監査集合は、前段の耐久Authority一般化、precleanup intent、known consumer配線およびEvidence軸を解消候補とした一方、Operation Root生成後のRecovery ID取得がtransaction外に残ること、producer所有Projectorがaccessor／Proxyと実variant相関を完全には拒否しないこと、および現行READMEのrevision表示差を検出した。追加是正では、旧facade、Task RuntimeおよびDoctorを同じOperation生成transactionへ接続し、Directory生成からRecovery ID取得およびCapability初期化までの到達可能なthrow境界をcleanup／retention分類内へ置く。ID取得前のcleanup不明はIDを捏造せずoperator transfer、取得後は同じexact ID保持へ閉じる。Docker Process Controller contract revision 20のProjectorはProxy、accessor、欠落、余分、rename、Operation ID差に加え、完了／取消／回収済み停止／cleanup不明のResult、Hash、byte数、取消要求、Subscription認証、finalization capabilityおよびRecovery IDを排他的variantとして検査し、旧facade revision 8とTask Runtime revision 24のconsumer ingestionへ各actual variantと1-field mutationを通す。cleanup中の遅延取消は最後の非同期境界後に再settleし、完了候補はcancelledへ、既存blockedは元の閉集合理由と取消観測を保持する。

同じ原因をCRDD利用側で減らすため、Architectureを資源取得transactionの正本とし、発火を「失敗時に対象所有のdurable／shared／externalな残存資源、またはRecovery／Authority義務を残し得る取得・初期化」へ限定した。終了はlive owner capability、cleanup完了、exact Recovery、IDなしoperator transfer、Effect前拒否の排他的settlementとし、read-only観測、残存所有なしで終了を決定論的に観測できる局所資源、およびRecovery非該当を明示的に除外する。Agent、Implementation、Quality Assuranceおよびcoding standardsはこの正本を工程固有に参照し、複合transactionの内包failure集合を`failure種別 × public consumer × 公開形態`へ接続する。Verification DesignとCHGひな型は該当時または理由付き非該当だけを記録する。汎用Checkerで`try`配置を構文検査すると誤検知が大きいため新設せず、該当する資源取得の工程Gateと契約試験で確認する。

固定候補`6fdfaf705b432d5de75bc2df587967633f0f47ef`／Tree `47e9c41b40225e6cfd5e99da50fe93acb6148e63`への同一3監査は、前回MajorのRecovery ID取得位置、Proxy／accessor拒否、production consumer配線およびREADME revision差の解消を確認した。そのうえで、Docker completionの到達不能なfield組合せ、Doctorだけが下位Directory生成failureを共有unionから落とす経路、public Doctor投影の直接試験不足、および一般transaction規範の過剰適用を検出した。是正は上記の排他的variant、共有classifier、Doctor JSON／人間表示projector、公開consumer別の契約試験および規範の適用限定に閉じ、新しいRuntime Authority、汎用Checker、公開signed CLI、Provider、Networkまたはbroken Host実測を追加しない。

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

固定署名版`9f6938c`のRoute Matrixは、初期外部送信設定、Claude Executor選定およびCodex独立Reviewer選定までは通過したが、forward経路のReviewer Stage開始時に2件のexact Docker Recovery IDとHost Recovery IDを保持して`docker_process_controller_recovery_unavailable`へ停止した。2件のDocker Recoveryを署名済みdoctorで順に完了するとinventoryは残存0となり、同じ入力の再実行でも同位置へ再現したため、Console、選定、Provider応答または一過性Docker障害ではなく、同一Host Operation内で同じlogical Provider Homeを直列に二回使う正常系列へ縮約した。

実Filesystemを使う契約試験で、第一Stageのactive pointer／lease終了後、finalizableな耐久記録をHost cleanupまで保持したまま第二Stageが同じ固定名のactive pointerを作る系列を再現した。停止理由は`docker_recovery_record_changed`であり、WindowsのNTFS同名file tunnelingによって、一時fileから削除直後の固定名へatomic renameした際に同一volume／file IDとbytesを保ったまま作成時刻だけが変化したことが原因だった。従来のtop-level await ownershipおよびcold-start lock待機は別の実不具合を閉じたが、このRoute Matrix停止の根本原因ではなかった。

同じ未リリース候補で、atomic rename前後の連続性はexact serialized bytesと同一volume／file IDを必須とし、Windows以外では作成時刻も一致させ、Windowsではrename後の最終Identity全体をcommit sidecarへ結合するよう是正した。その後のread、cleanupおよびRecoveryは作成時刻を含む最終Identityの完全一致を引き続き要求するため、置換や内容変更を許可しない。契約試験は同一Host Operation／同一logical Homeの二回の直列begin、absence確認、mount、complete、共通Host cleanup、二件のreceipt／finalizationおよびRuntime State残存0を実Filesystemで固定した。関連するDocker Recovery Runtime、Journal、Process ControllerおよびTask Runtimeの261試験、Coordinator全1,177試験、Runtime Traceability Checker、型検査、lint、format確認およびCRDD全体Checkerは全件成功した。新しい署名Releaseによる4経路E2EとRecovery Matrixはまだ未実施であり、この時点ではCoordinator Runtime 1.0完成またはRelease成功を主張しない。

続く正式署名実測では、Providerが非ゼロ終了を返した第一Stage自体は子Process／containerを清掃済みとして終了したが、Task RuntimeがDockerの耐久Recoveryをfinalizeせず、次の実行が`docker_process_controller_recovery_conflict`で停止した。原因は、成功経路ではHost cleanup intent、Host cleanup、不存在receipt、Docker finalizeのDAGへhandoffを接続する一方、清掃済みProvider失敗と取消経路だけ、耐久記録を消していない時点でin-memory handoffを`finalized`へ遷移させていたことである。同じ未リリース変更内で、成功、清掃済み失敗および取消を同じ`finalizable` handoffへ合流させ、Providerの業務失敗理由を保持したままHost cleanup後にDocker Recoveryをfinalizeする。finalization capability欠落または不一致は従来どおりexact Recoveryを伴う手動回復へ閉じる。契約試験は清掃済みProvider失敗と実行中取消について、Host cleanup intent、Host cleanup、receipt、Docker finalizeの順序、最終Recovery ID 0件およびcleanup確認済みを固定する。更新署名Releaseによる4経路再実測が通るまで、E2E収束または完成根拠へ昇格しない。

このDocker lifecycle是正後の正式署名再実測では、各失敗後にRecovery ID 0件とcleanup確認済みを維持でき、次のOperationを競合なく開始できた。一方、forward経路は初回Claude ExecutorとCodex独立Reviewerまで進んだ後、Reviewerが是正を要求し、同じClaude Executorによる是正だけが反復して非ゼロ終了した。既存Remediation PacketはReviewer自由文を別Providerへ命令として転送しないため、`severity`、`path`および`messageSha256`だけを渡していた。この投影では、是正対象Pathは分かっても、どのAcceptance Criteriaに対する何種の欠陥かを安全に再構成できず、一般Taskの一回是正契約として情報不足だった。

完成候補ではReviewer Finding Schemaへ、閉集合の`category`と1始まりの`criterionNumber`を正式追加する。Runtimeは自由文本文を引き続き破棄し、重要度、Path、Category、現在Taskに実在するAcceptance Criteria参照および自由文Hashだけを一回限りのopaque Capabilityから同一Executorへ渡す。範囲外の受入条件参照、閉集合外Category、不正Schema、秘密用PathおよびCapability再利用は次のExternal Send Grant消費前に停止する。Codex固定imageは同じ公式binary Hashを保ったままReviewer Schemaを更新して再buildし、image digest、byte長およびimage内Schema Hashを新しいDistribution Identityへ固定する。Claudeは同じ型をRuntime所有`--json-schema`へ固定する。この変更はReviewer自由文を信頼命令へ昇格せず、Remediationを実用可能な型付き欠陥契約として成立させるための恒久的なArchitecture是正である。更新署名Releaseの4経路E2Eで是正と再Reviewer承認まで通るまでは完成根拠へ昇格しない。

型付きRemediation候補の最初の正式署名実測では、第一Claude Executorは一度非ゼロ終了した後の同一署名再実行で成功し、Codex Reviewerの変更要求と型付きRemediation Packet発行まで進んだが、同一Operation内の第二Claude Executorが再び非ゼロ終了した。したがって固定Invocation全体の恒常的不適合と、旧Packetの情報不足だけでは説明できず、Subscription上限、認証失効、Operation予算／turn／Structured Output再試行、Invocation拒否、Network／Service不成立および未知Provider失敗を分離できない公開Reasonが次の診断阻害要因となった。同じ未リリース変更内で、Providerの自由文stdout／stderrは引き続き非公開とする。Claudeは単一・重複keyなしJSON Envelopeの閉じた`subtype`、その他はbounded stderrの既知意味形だけを閉集合Reasonへ写し、Task本文を含み得る任意stdoutの部分一致、過長／NUL含有stderrおよび未知出力はgenericな非ゼロ終了へ閉じる。成功、既知異常、反射stdout、未知異常、signal、timeout、出力超過および全cleanupを契約試験へ固定する。この観測強化で同じRemediationを再実測し、原因分類と本質是正を確定するまで完成根拠へ昇格しない。

失敗分類を接続した固定署名版`4e99213`の再実測では、第一Claude ExecutorとCodex Reviewerを通過し、型付きRemediation Packetで第二Claude Executorへ到達したうえで、`provider_operation_budget_exceeded`へ安全停止した。cleanupは確認済み、Recovery IDは0件、Canonical RepositoryへのEffectは0であり、Remediation transportまたは資源回収ではなく、標準Subscription ProfileへAPI相当USD上限を適用した費用契約の不整合へ原因を縮約した。SubscriptionでProviderが報告する`total_cost_usd`は実課金額でも課金Authorityでもなく、入力Context量によって同じeffortでも変動する。したがってeffort別USD値を単に引き上げず、一般Taskの標準Profileから`--max-budget-usd`を除去し、finite／nonnegativeだけを利用量metadataとして検証する。使用量制御は説明可能なmodel／effort選定、effort別turn上限、Provider timeoutおよび出力上限へ分離する。API key、有料API fallback、追加購入および自動plan切替は引き続き禁止し、明示的なspend budgetは将来のopt-in有料API ProfileだけがProvider／account、credential sourceおよびOperation Authorityと結合して所有する。正常結果、API相当値が旧上限を超える正常結果、負値／非有限値、turn超過およびCLI argvの暗黙budget不存在を契約試験へ固定し、新しい署名Releaseの4経路E2Eを通るまで完成根拠へ昇格しない。

課金境界を是正した固定署名版`0d90e2e`の再実測では、第一Claude Executor、Codex Reviewer、型付きRemediationを受けた第二Claude Executorおよび同じCodex Reviewerの再承認まで初めて通過した。Candidateはexact検証後に破棄され、cleanup確認済み、Recovery ID 0件、Canonical Repository Effect 0を維持した。一方、署名Runnerだけが`remediationPerformed === false`を成功条件としていたため、Runtime正本が許す一回是正済み承認を`result_contract_mismatch`へ誤分類した。Runnerを緩い成功判定へ変えず、`remediationPerformed`をexact boolean履歴として受理し、是正0回またはRuntime所有の最大1回是正後に同じ独立Reviewerが`approved`かつfinding 0を返す既存成功母集団へ一致させる。Candidate Identity／内容、許可Path、cleanup、破棄、非公開情報およびCanonical Effect 0の条件は維持し、欠落・型差、二回目是正、最終未承認または不一致を成功へ昇格しない。4経路の新しい署名E2Eが通るまで完成根拠へ昇格しない。

bounded-remediation Runnerを整合した固定署名版`1d6b330`の再実測では、Claude ExecutorとCodex Reviewerが完了・承認し、cleanup確認済み、Recovery ID 0件、Canonical Repository Effect 0を維持したが、Runnerの独立byte検証がCandidate内容不一致を検出して安全に破棄した。従来fixtureは存在しないfileのexact新規生成をProviderへ要求し、末尾LF等をReviewerのRead表示だけでは独立確認できない一方、Runnerはbyte完全一致を要求していた。経路成立とProvider自由整形を分離するため、署名Releaseへ既知のBASE markerを追跡し、Candidate内で最終tokenだけを`BASE`から`OK`へ置換するE2Eへ変更する。全経路は同じ基準byteを使い、Reviewerは意味上の限定置換を確認し、Runnerは改変後33 UTF-8 bytes、固定SHA-256、末尾LF、Candidate Identity、許可PathおよびCanonical Effect 0を独立検証する。最終byte Gateは緩和せず、新しい署名Releaseの4経路E2Eが通るまで完成根拠へ昇格しない。

続く正式署名再実測では、実Providerが一回の試行でexact marker置換または独立Review承認へ収束しない場合でも、Candidate破棄、cleanupおよびCanonical Effect 0は成立していた。一方、General Task RunnerはCandidate／Candidate Storeの入力契約が単数nullable Recovery IDであるにもかかわらず、投影時だけ存在しない複数fieldを必須として空状態を曖昧化し、exact破棄後も破棄前Candidate Recoveryを残存扱いしていた。同じ未リリース変更内で、producer契約に合わせて単数nullable IDだけを読み、exact discard成功後はCandidate成分だけを終了済みとして再投影する。Host／Docker、cleanup、Process poison、Canonical Effectおよび非公開情報の観測は降格しない。

4経路の自動実測は、自由生成に対する無制限retryではなく、安全に完結した検証試行だけを最大3回へ限定する。対象理由は独立Review不承認とexact Candidate内容不一致の閉集合とし、Candidate exact discard、cleanup確認済み、全Recovery ID空、曖昧性なし、Process再起動不要、Effect不明なし、Canonical Repository変更なし、および生Provider出力／Host Path／Credential報告なしを全て要求する。Provider非ゼロ、timeout、取消、汎用失敗、候補未破棄またはRecovery不明は初回で停止する。各試行結果と再試行回数を保持し、3回目を成功へ昇格しない。これは署名Release Verification Harnessの再現性を高める契約であり、通常Task Runtimeの自動fallback、課金Authority、Provider選定または成功母集団を拡張しない。契約試験は限定再試行、上限停止、対象外理由の非再試行およびexact破棄後Recovery投影を固定した。新しい固定署名版の4経路E2Eが通るまで完成根拠へ昇格しない。

固定署名版`7230c6f`の初回実測は、forward経路のCandidate内容不一致をexact discard、cleanup確認済み、全Recovery ID空、曖昧性なし、Canonical Effect 0へ閉じたが、General Taskのblocked投影がRuntime観測済み`externalSendAuthorizationMode`を落としたため、安全再試行条件を満たせず一回で停止した。Route Matrix側の条件を緩和せず、exact Candidate discard後のblocked結果へ、Task Resultで`interactive_initial_consent`または`reused_initial_consent`と確認できた値だけをそのまま伝播する。不正・欠落modeは公開せず再試行不能を維持する。契約試験は値の変換ではなく元modeの保持を確認し、新しい固定署名版で自動再試行と4経路完了を再実測する。

このtracked markerを含む固定署名版`30ca685`の再実測では、第一Claude Executor、Codex独立Reviewer、同じClaude Executorによる一回是正および同じCodex独立Reviewerの再確認まで到達し、cleanup確認済み、Recovery ID 0件、Canonical Repository Effect 0を維持したが、最終Reviewerが再び変更を要求した。現在の型付きRemediation Packetは`path`、`severity`、`category`、`criterionNumber`および`messageSha256`だけを渡すため、同じPath・Category・Acceptance Criteria内の具体的な欠陥を是正Executorが一意に復元できない。Fixtureだけを緩和せず、Reviewerの上限付き`message`を一回限りのopaque Capability内に保持し、`path`と本文の双方を認識済みSecret検査した後だけ、同じTask分類、同じExecutor、最大一回の既存外部送信Authorityへ「信頼しない欠陥主張」として転送する。本文は命令、Authority、許可Path拡張またはReviewer生Resultとして扱わず、ExecutorはAcceptance Criteria、Read Projection、WorkspaceおよびTestと独立照合してから是正する。範囲外Criterion、秘密用Path、認識済みSecret本文、不正型、過長本文、Capability再利用およびGrant不成立はProvider Effect前に拒否する。派生送信境界の変更は保存済み同意を自動拡張せず、新しい境界への初回確認を要求する。未知のSecret不存在は主張せず、安全に分離できない場合は停止する。構造化Result、Task Packet、External Send Grant、Task Runtime、READMEおよび契約試験を同じ変更へ伝播し、新しい署名Releaseの4経路E2Eが通るまで完成根拠へ昇格しない。

固定署名版`eac59ca`を通常Desktop Tokenから起動した再実測では、選択ユーザー、保護Runtime Stateおよび安定Identityのpreflightは成立したが、正しい現行外部送信同意をDocker Recoveryが`docker_task_runtime_state_entry_replaced`として拒否した。原因は、External Send Consent Runtimeが所有するrecord shapeへ意味版fieldを追加した際、Docker Recoveryが同じ本文Schemaの旧exact key集合を重複所有し、実producerからproduction consumerへの結合試験がなかったことである。Docker Recovery Runtime contract revision 25では、同意recordの名前と世代解析を共有定義へ一元化し、Docker RecoveryはDocker資源ではない同意について固定名前空間、regular fileおよび単一logical generationだけを在庫境界として確認する。本文Schema、意味版、期限、Policy結合および破損・部分pairの安全な失効はExternal Send Consent Runtimeだけが所有し、Docker Recovery Authorityへ昇格させない。実producerの正常pairをDocker Recoveryがcleanと判定する正常系、破損／部分pairを同意ownerがAuthority縮小として除去して残存0にする準正常系、および複数logical generationを競合停止する異常系を同じ結合試験へ固定する。署名配布物の作成・起動についても、手書きCommandや可変staging Pathを通常利用契約にせず、manifestからexact Package／Revisionを選ぶ単一Launcher、冪等な事前確認、安定した理由コードおよび既存同意の自動再利用を完成条件として維持する。新しい署名Releaseの4経路E2Eが通るまで完成根拠へ昇格しない。

固定署名版`3d4bc10`の実測では、forward経路を安全に最大3回まで再試行し、全試行でcleanup確認済み、Recovery ID 0件、Canonical Repository Effect 0を維持した。最終試行は独立Reviewer不承認でCandidate永続化前に停止したが、Runnerは`candidateDiscarded === false`だけから「破棄未確認」と「永続Candidate未発行」を区別できず、安全に再試行できる終了状態を曖昧化した。理由文字列やID欠落から推定せず、Task Runtimeを状態AuthorityとしてCandidate終了状態を`not_issued`、`discarded`、`recovery_required`の閉集合で公開する。Reviewer不承認がCandidate永続化前に確定した場合だけ`not_issued`、exact破棄後または正常完了は`discarded`、観測・回収不明は`recovery_required`とする。Route Matrixは前二者と残存0を完全一致で確認した場合だけ限定再試行し、第三状態、型欠落、矛盾または汎用失敗を初回停止する。これにより成功条件やRecovery Gateを緩和せず、Candidate lifecycleの正常な非発行と異常な回収不明を機械的に分離する。更新署名Releaseの4経路E2Eが通るまで完成根拠へ昇格しない。

更新固定署名版`365fa64`ではこのCandidate終了状態が実Provider 3試行すべてで成立し、独立Reviewer不承認の`not_issued`、内容不一致後の`discarded`、cleanup確認済み、Recovery ID 0件およびCanonical Effect 0を正しく区別した。一方、専用Windows E2E worktreeの固定基準fileだけがGit checkout時に35-byte LFから36-byte CRLFへ変換され、Providerが見えている改行を保持して限定置換してもRunnerのLF Gateへ一致しない試験基盤差を検出した。固定fixtureへ`text eol=lf`を明示し、Runnerも署名Package／Git Object Format確認後かつTask／Provider Effect前に基準35 bytesを独立検査する。CRLF、欠落、空または読取不能は`base_content_mismatch`へ停止し、Providerへ成立不能な試行を送らない。新規専用worktreeの実byteと更新署名E2Eで解消を確認するまで完成根拠へ昇格しない。

LF固定後の正式署名再実測は基準byte Gate、Executor、独立Reviewer、一回是正、Candidate破棄および限定再試行を通過したが、3試行すべてを同じ`candidate_content_mismatch`へ集約し、bundle metadata差と最終byte差を区別できなかった。自由文、生Candidate bytes、PathまたはProvider出力を公開せず、Candidate verifierの各exact predicateを固定field識別子へする。公開fixtureの内容差だけはCRLF、終端LF欠落、BASE未置換およびその他byte差の閉集合へ分類し、Hash／長さ／bundle Identity差とは分離する。この診断は成功条件、再試行条件、Candidate cleanupまたは情報境界を変更せず、次の署名実測で本質原因を一意に確定するための観測契約である。

固定署名版`fdc0fe4`の独立Clone診断では、3回のforward試行と限定診断のいずれもCandidate Bundleの`changedPaths`が空集合であることを確認した。基準fileは正しいBASE byteであり、許可Path外変更、Reviewer誤判定またはCandidate verifierの誤分類ではなかった。固定Claude Code `2.1.220`の実helpと実行計画を照合すると、Executorへ`Edit,Write`とread-write mountを渡す一方、非対話Permission ModeをReviewerと同じ`dontAsk`へ固定していた。質問不能な書込許可と編集責務が矛盾し、Providerは変更しないまま構造化結果を返していた。Role契約を恒久是正し、Executorだけを`acceptEdits`、Reviewerを`dontAsk`へ固定する。Bash、Web、MCP、Subagent、Provider Home access、親環境継承およびCanonical Repository Effectは禁止したまま、許可Path・Candidate inventory・内容のRuntime検証と不適合時の破棄を維持する。開発用契約試験と`development-e2e:verify`を先に固定し、正式署名は全変更凍結後のRelease Candidateへ一度だけ行う。

## 15. Release処置

本変更は未リリースである。内部componentの個別完成、旧CHGの統合、固定1経路の成功、PR作成または監査開始を、Runtime 1.0の完成、統合、Stable化またはReleaseとみなさない。

全残件と最新固定改訂版の監査を閉じた後、人間の決定権限者がv0.18.0への統合、Issue処置およびReleaseを判断する。現在、このCHG統合方針について追加の人間判断は必要ない。
