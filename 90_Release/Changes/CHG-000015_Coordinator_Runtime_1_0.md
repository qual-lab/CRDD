# 変更トレース: Coordinator Runtime 1.0

変更ID: `CHG-000015`
状態: `Reopened`
担当責任者: Qual-Lab
最終更新日: 2026-08-26
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

### 1.1 経路別の現在状態

| Front | Executor | 独立Reviewer | 現在状態 | 根拠／残件 |
|---|---|---|---|---|
| Codex | Claude Code | Codex | 固定1経路で成立確認 | 署名済み一般Task、Candidate exact content、Finding 0、cleanup／残存0を実測 |
| Codex | Codex | Claude Codeまたは独立Codex | 未成立 | 同一Provider採用理由、Reviewer独立性および正式署名E2Eが未固定 |
| Claude Code | Codex | Claude Code | 未成立 | Front Claude Code入口、Codex Executor接続および正式署名E2Eが未固定 |
| Claude Code | Claude Code | Codexまたは独立Claude Code | 未成立 | Front Claude Code入口、同一Provider例外理由および正式署名E2Eが未固定 |

cross-providerを既定とし、同一ProviderまたはFront-onlyは、移譲不要、Provider固有の適性、反対Providerの利用不能または独立レビュー要件から説明できる場合だけ選ぶ。実装の存在、CLIの利用可能性または一経路の成功を、別経路の成立へ一般化しない。

### 1.2 Releaseまでの主要残件

1. Front Claude Codeを含む逆方向経路と、必要な同一Provider例外を正式署名E2Eで固定する。
2. 成功だけでなく、Provider失敗、timeout、cancel、親Process消失、cleanup不明およびRecoveryを本番同等入口から確認する。
3. 最新改訂版で全機械確認、Architecture／Security、Test／UX、Document／Gap／Impact／Conformanceを再実行する。
4. README、Roadmap、CHANGELOG、IssueおよびRelease範囲を現在状態へ同期し、人間の統合・Release判断へ渡す。

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
| Human | 目的、価値、重要判断、外部送信承認、受入、統合、Release、責任 | Runtime内部の候補生成 |
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
| 同意 | Codex送信範囲へ個別のHuman承認 | Claude送信範囲へ個別のHuman承認 |
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

- 固定1経路以外の正式署名E2Eは未完了である。
- 正式署名入口での失敗、取消、親消失、cleanup ambiguityおよびmanual recoveryの全組合せは未完了である。
- Providerの規約、保持、学習利用、onward transferおよび正確なaccount／tenant identityをRuntimeは保証しない。
- Docker Desktop、Provider配布物、OSおよびSubscription offeringの更新時はIdentityとCapabilityを再評価する。
- 巨大な内部Security契約は利用者向け入口へ露出させず、READMEの現在Capabilityと開発者向けTrust／Provisioning／Recovery詳細を分離する必要がある。

## 15. Release処置

本変更は未リリースである。内部componentの個別完成、旧CHGの統合、固定1経路の成功、PR作成または監査開始を、Runtime 1.0の完成、統合、Stable化またはReleaseとみなさない。

全残件と最新固定改訂版の監査を閉じた後、人間の決定権限者がv0.18.0への統合、Issue処置およびReleaseを判断する。現在、このCHG統合方針について追加の人間判断は必要ない。
