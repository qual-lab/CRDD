# 変更トレース: Coordinator採用入口の本質是正

変更ID: `CHG-000056`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-09-01
- 最終更新日: 2026-09-01
- 対象: Coordinator Runtimeの新規採用入口、公開CLI、配布Identity、Platform Access、仕様・設計・試験・利用案内
- 対象version: `v0.18.1`
- 変更分類: `corrective breaking`（v0.18.0で公開したが実用結果へ接続しない入口を削除する）
- 移行要否: `migration_required: true`（v0.18.0 Runtime利用者だけ。初回設定を完了できた利用者は存在しない前提を実測で再確認する）
- 関連正本: [振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md)、[Coordinator Architecture](../../06_Architecture/coordinator/01_Architecture.md)、[Threat Model](../../06_Architecture/coordinator/02_Threat_Model.md)、[Workflow](../../19_Workflows/01_Coordinator_Runtime.md)

## 1. 契機とCurrent State

v0.18.0を新規Projectで利用しようとすると、案内された`activate`／`provision`が`not_implemented`または`blocked`を返し、一般Taskへ到達できないことを確認した。実装部品とSecurity試験は多数成立していたが、公開入口から利用者結果へ至るCapabilityの閉包をRelease条件として評価できていなかった。

さらに設計を再評価した結果、Local Personal Profileの一般Taskは、署名配布物、Repository、選択ユーザー、Provider Home、外部送信Policy、Dockerおよび回復状態をOperationごとに検証できる。永続的なRuntime有効化、事前Platform Provisioning、Provisioning CA／証明書Store、Activation Recordおよび導入用Supervisorは、利用者結果に必要な不変条件を追加せず、独立したStateful Security Surfaceだけを増やしていた。

## 2. 判断

Local Personal Profileは、永続的な`activate`／`disable`／`provision` Lifecycleを持たない。必要条件は`task`のPreflightで直接検証する。

本変更は初回公開直後の本質訂正であり、利用可能だった旧動作を維持する互換性は存在しない。したがって旧commandを常に失敗させるshim、alias、help、parser、module、試験専用入口または互換文書を残さない。削除した名前を負の契約試験で拒否することは、互換入口ではなく公開CLI閉集合の検証である。

公開CLIは次に限定する。

- `task --request-stdin --json`
- `doctor`
- `candidate export/discard/recover-store`
- `capabilities --json`

`capabilities --json`は、新規採用側が人間可読READMEの推測や未実装commandの試行をせず、現行Profile、利用可能command、必要条件および非対応境界をEffect 0で確認する入口である。

## 3. 削除するSurface

- `activate`、`disable`、`provision`のCLI grammar、help、dispatch、report
- `doctor --enable-runtime`と`--runtime-root`
- Activation Record、Authority Root、Runtime Root候補
- Provisioning CA、Enrollment、Provisioning Record／Store／Trust Floor
- Pre-active One-shot、Active Pointer、導入layout／DACL／Registry Effect
- 導入用`coordinator.exe`、native bootstrap featureおよび対応Rust／TypeScript実装・試験
- 旧Supervisor artifactを含むmanifest revision 3の現行候補

公開済み`v0.18.0` tagとその履歴Evidenceは書き換えない。現行branch、v0.18.1配布物および利用案内からだけ削除する。

## 4. 新しい配布・実行境界

署名manifest revision 5では、Release IdentityとRuntime実行Identityを分離する。CRDD Version／tag／Commit／Tree／文書はRelease Identityを構成し、Runtime Authorityは`bin/**`、`src/**`、`runtime/**`、`policies/**`、`package.json`、共通Launcherが選ぶ署名・4経路・Recovery入口とその推移的な静的依存、Policy Hashおよび単一Native成果物`template/tools/coordinator/windows-x64/crdd-platform-access.exe`から決定論的に算出するRuntime実行Identityへ結合する。Launcherの入口表をIdentity seedとして共用し、未選択の開発補助scriptは含めない。依存はコメント、文字列および構文tokenを区別するFail Closedの字句解析で抽出し、実在する`node:`組込みmoduleと閉包内relative targetだけを許可する。bare／absolute／URL指定、非literalの動的import、入口表とliteral importの不一致、解析不能なsourceを拒否する。選択scriptが起動するNode.js子Process／Workerも、同じsourceまたは同じ閉包へ結合したliteral targetだけを許可する。旧revision、削除済みfield、別Path aliasまたは欠落fallbackを受理しない。

この分離により、README、CHG、Roadmap、品質記録または試験だけの変更ではRuntime実行Identityを変えず、再署名および実Provider E2Eを要求しない。実行集合、PolicyまたはNative成果物の変更ではIdentityが変わるため再署名し、影響するE2Eを行う。Recoveryの世代照合もCRDD Treeとpackage rootの組合せからRuntime実行Identityへ移し、Operation、Resource、Provider／Home bindingおよびRecovery契約revisionと組み合わせる。これは文書変更を例外扱いする除外規則ではなく、署名Authorityを実際の実行依存へ戻す責務境界の是正である。

一般Taskは次の順に進む。

```text
task request
  ↓
signed distribution / repository / selected user / provider home / policy preflight
  ↓
bounded provider execution / independent review / optional remediation
  ↓
candidate verification / cleanup / structured result
```

Preflightが成立しなければProvider Effect前に停止する。永続準備状態を作って後続TaskへAuthorityを持ち回らない。

## 5. 汎化した改善

CRDD標準の着手前整合、品質保証および保守規則を強化する。

- 公開入口、主要利用者Journey、実在する利用側、観測可能な結果および失敗時の次の操作を、内部部品の成立と分けて確認する。
- 常に`blocked`となる未実装入口を安全な完成形とみなさない。Current Scopeに不要なら削除し、必要なら利用者結果まで完成させる。
- Capability一覧を機械確認できる入口を設け、README、CLI grammar、実装、配布物およびE2Eの閉集合一致を確認する。
- 新規採用者に対し、公開された導入手順から最初の有用結果までをfresh environmentで検証する。

これらは特定Runtimeのcommand名を一般規則へ固定せず、「内部成立を利用者Capabilityと誤認しない」原則として既存条項を強化する。

## 6. 影響と移行

v0.18.0の`activate`／`provision`を呼んで停止していた利用者は、v0.18.1へ更新し、`capabilities --json`で利用可能性を確認してから`task`を直接使用する。旧Recordや導入済みSupervisorの移行は行わない。実際に旧Effectが発行されていないことを固定Evidenceと新規採用実測で確認し、不明なHost Effectが見つかった場合は自動削除せず回復判断へ戻す。

Sourceだけを利用する採用Project、Coordinatorを利用しないProjectおよび公開済みv0.18.0の方法論部分には実行移行は不要である。

切戻しは状態別に行う。

| 観測状態 | 切戻し処置 | 禁止事項 |
|---|---|---|
| Provider Effect前で、候補・回復義務なし | 新規Taskを停止し、v0.18.1 Runtimeを使用しない。採用Repositoryのcloneまたはsubmoduleを公式`v0.18.0` tagへ戻す。v0.18.0のRuntime入口は有用結果へ到達しないため、方法論部分だけを継続するかRuntime利用を停止する | 削除済みcommandや互換shimを復元しない。v0.18.1の外部送信Policyや同意をv0.18.0へ流用しない |
| 候補あり、cleanup確認済み | 新規Taskを停止し、exact Candidateをdiscardしてから、cloneまたはsubmoduleを公式`v0.18.0` tagへ戻す。固定配布物全体を一単位で切り替える | 新旧Runtime fileを混在させない。候補や検証記録を履歴から削除しない |
| 回復IDあり、cleanup未確認またはEffect不明 | 新規Taskを停止し、exact Recoveryを完了して資源不存在を確認するまで切替・削除・自動再試行を行わない。観測不能なら手動Recovery義務とEvidenceを保持する | Runtime更新、tag切替またはProcess再起動だけで回復済みと扱わない |

文書だけの変更ではRuntime実行Identityが不変なら再署名しないが、Release Identityと文書整合の確認は維持する。

## 7. 検証義務

- help、parser、dispatch、module、Native binaryおよび現行文書から削除Surfaceが消えている。
- 削除commandは未知commandとしてusage errorになり、専用statusや互換結果を返さない。
- `capabilities --json`が公開CLI閉集合と非対応境界をEffect 0で返す。
- manifest revision 5がCoordinator本体、共通Launcherの署名・4経路・Recovery入口と推移的な静的依存、Policyおよび単一Platform Access成果物をRuntime実行Identityへexactに結合する。字句解析がコメント内の見せかけ、bare／absolute／URL module、存在しない`node:` module、非literalの動的import、入口表との不一致、集合外のNode.js子Process／Worker target、解析不能なsourceおよび旧revision／旧fieldを拒否する。
- Repository textのLF／CRLF差だけを同じGit正本内容として検証し、意味差分とNative成果物のbyte差を拒否する。
- manifestが署名する配布Source Commit A、manifestを加えた配布Commit B、作業対象RepositoryのExecution Revisionを分離し、一般TaskのCandidate Revisionを実行前後に独立観測した作業対象Revisionへ結合する。
- TypeScript、Rust、Checker、format／lintおよび全Repository試験が固定候補で合格する。
- fresh clone／submodule相当の採用環境で、Capabilities確認から一般Taskの有用結果までを再現する。
- timeout、cancel、Provider失敗、owner loss、cleanup不明およびRecoveryの既存保証が削除後も成立する。
- Architecture／Security、Test／UX、Document、Gap／ImpactおよびConformanceの独立確認を同じ固定改訂版へ実行する。

## 8. 現在状態と残件

公開入口、旧Stateful subsystem、導入用Supervisor、AppContainer準備契約および旧manifest候補は、現行Source、CLI、配布候補、正本および試験母集団から削除した。Platform Accessの現在契約は、選択ユーザーの通常Processで固定署名成果物を最小環境かつ上限付きI/Oにより呼び出す一成果物構成である。

Repository全体のTypeScript試験は現行Source候補で1356件まで拡張した。制限Process内では`taskkill.exe`を許可されないWindows Process Gate 7件を機械的な閉集合として分離し、残る1349件を`test:restricted-process`で確認する。同じ7件は通常のローカルユーザーProcessから`test:windows-process`で実行し、子孫Processの実終了を確認する。通常の`test`は1356件の完全母集団を維持し、制限Process側だけの成功を全体合格へ読み替えない。分類prefix、除外集合および専用Gate集合は契約試験で固定し、毎回同じ7件を一般失敗として反復してから口頭補正する運用を廃止した。Rustの通常試験、Clippy、Format、Native Coverage、TypeScript Coverage、Coordinator Checkおよび全体Checkerも合格した。この環境差を本番実装の成功へ補正せず、制限Process内の事実と通常Processで実終了を観測した根拠を分けて保持する。LLVM CoverageがWindows実子のBootstrap環境を変更するため、実子の完全環境一致は通常Rust試験で必須とし、Coverage実行では当該1件だけを非計測にして残るNative Sourceを全件集計する。

Runtime実行Identity分離後の現行Sourceでは、`test:restricted-process`の1349件と、同じ閉集合の通常Windows Process Gate 7件がそれぞれ全件合格した。Identity・署名・Recovery・4経路・開発計測へ直接影響する237件も全件合格し、TypeScript型検査、Traceability、lint、formatおよびRepository全体Checkerはエラー0である。通常`test`を一つの長時間Processで実行した際にWindows Process Gate 7件だけが時間上限へ到達したため、その結果を成功へ補正せず、設計済みの分離Gateをfresh Processで再実行して実子孫終了を確認した。試験母集団の増加はIdentity契約の追加によるもので、旧候補の署名・E2E結果をrevision 5の正式配布へ流用しない。

最初のmanifest候補は`git archive`上のLFと既存Windows Checkout上のCRLFを生バイト差として扱い、署名検証がProvider Effect前に停止した。原因は任意改変ではなく、Gitが許可するCheckout改行変換をPackage Hashと配布Tree再構成の両契約が表現していなかったことにある。Package content rootを宣言済みRepository textだけLF正規化するV2へ改め、配布Treeも`text=auto eol=lf`と同じbinary判定によりtextをLF正本、binaryを生バイト正本として再構成する。また、初回利用後にCRDD自身が作る`.crdd`では、Git管理する`external-send-policy.json`を署名Treeへ含めたまま、同じRoot内のRuntime状態だけを除外し、同じCloneの継続利用で自己不一致を起こさないようにした。LF／CRLF同値、内容差分拒否、binary生バイト一致、Runtime状態除外および類似名拒否を契約試験へ固定した。失敗したmanifest候補はRelease候補として使用せず、更新後のSource Commitから再署名する。

その後の署名済み一般Taskでは、配布検証がCommit A／Tree Aを正しく確認した一方、Runnerが隔離Candidateのbase RevisionにもAを要求し、manifest一件を加えた配布Commit B上の作業候補を拒否した。これはProvider出力ではなく、配布Identityと作業対象Repository Identityの接続漏れである。RunnerはTask前後に作業対象RepositoryのExecution Commit／Treeを独立観測し、CandidateをそのRevisionへ照合するよう是正した。配布内容は引き続きAとmanifest-only Bの関係へ結合し、親RepositoryがCRDDをsubmoduleとして利用する場合は、submodule側のA／Bと親側のExecution Revisionを分離する。署名SourceとExecution Revisionが異なる正常例、Candidateが誤って署名Sourceをbaseにする異常例、実行中のRevision変化、観測不能を契約試験へ追加した。

固定Revision `2738ed9`の独立確認では、この初回是正が配布Commit Bを一般の作業対象Revisionとして説明していたこと、Task後のRevision変化・観測不能を候補回収やTask失敗と独立した安全状態へ投影し切れていなかったこと、safe retryの全attemptを同じExecution Revisionへ固定していなかったこと、保存結果・検証設計・Quality Center・単一Native設定への伝播漏れを検出した。署名前に候補を破棄し、配布A／Bと作業対象Execution Revisionを別Identityへ分離した。post観測はsame／changed／unknownの三値として、Candidate処置・Recovery・cleanupとは別軸で保持する。changedは`canonicalRepositoryChanged:true`、unknownは`canonicalRepositoryChanged:null`かつ`effectStateUnknown:true`とし、いずれも安全再試行へ進めない。配布・Execution Identityと`execution_identity_mismatch`は限定された保存投影へ追加し、Provider本文、Host Pathまたは秘密を保存しない。この時点のrevision 4候補は後続のRuntime実行Identity分離前の履歴であり、現行revision 5のAuthority根拠へ流用しない。v0.18.0の2成果物Evidenceは当時版の履歴として変更しない。

続く固定Source候補`06450aa`の独立確認では、取消bindingの解放不明または最終結果不明へ収束する経路が、既に観測したTask後のRepository変化／観測不能をTask Resultの`canonicalRepositoryChanged:false`で上書きし得ることを検出した。cleanup不明の`cleanupConfirmed:false`、`manualRecoveryRequired:true`、`processRestartRequired:true`および`effectStateUnknown:true`を最終Authorityとして維持しつつ、Repository観測の三値だけを同じblocked結果へ合成する。各ケースは独立Processで実行し、Candidate破棄済み、Recovery ID 0件およびProcess poisonを確認する。文書側では、v0.18.0当時のrevision 2／3、2成果物および公開準備状態を現行契約のように読める箇所を履歴表示へ直した。当時のv0.18.1候補はrevision 4だったが、最終契約はrevision 5、閉じたRuntime実行集合、単一成果物および旧manifest署名domain拒否へ更新した。package content rootのV2 domainは別契約として維持する。是正後の旧候補で得た試験結果を、revision 5の正式署名E2Eまたは独立再確認の代用にはしない。

最初のv0.18.1署名候補はCommit A `86b88049d01f2f1b818aaf2b8ea266ae997b4972`／Tree `7d4b0282dd53f53082f70b5f1d686967386e72dc`と、manifestだけを加えたCommit B `8e6902c2cf11f47777d07c361ef618c1b08198ea`で構成され、manifest file SHA-256は`d38fbace2fc8ff38dde762d655d84a112dde80194f13a99c646a01fdc3beee17`だった。clean cloneと親Repository＋submoduleの双方で確認したところ、clean cloneの一般Taskは実Providerと独立Reviewerを含めて完了したが、親Repositoryでは外部送信PolicyのCommit固定読取りがProvider Effect前に停止した。この候補にtagまたは公開Releaseはなく、不採用として未公開のまま破棄した。

原因は、明示した`.crdd/external-send-policy.json`だけを読むGit object projectionが、選択対象外の`00_CRDD` gitlinkまで未対応modeとして拒否していたことである。対象外entryを投影から除外し、選択Path自身または祖先がgitlink／symlink／未対応modeの場合と全体展開では拒否を維持する。最初の是正Source候補`a96b72b13c645cfacd460c87ab1f622a20a8afd7`／Tree `7668825d480c4d46d8fda505d73c4e4e7b97867d`はmanifestを含まず、独立確認で通常Directoryのexact名を配下全体へ過剰投影し得ることと、実Policy consumer・未対応modeの試験不足を検出したため、これも署名せず固定候補から外した。mode別の選択へ戻し、通常blobはexact fileまたは末尾`/`付き明示Directory投影だけ、通常Treeは対象への祖先だけ、未対応modeは選択時または全体展開時だけ拒否する。無関係なsymlink／gitlink／未知modeと明示fileの正常例、それら自身・配下・全体展開の異常例、および親Repositoryの実Policy consumerを同じ契約試験へ追加した。

是正後のSource A `893498c0d02454a13667c94377c39e60b1898142`／Tree `f43d0c39ff5da1cb45a6aa1ef0ede515177929de`では、全体Checker、制限Process 1346/1346、通常Windows Process Gate 7/7、開発E2E 297/297および3系統の独立確認が合格した。manifestだけを加えたCommit B `1c2fd52eac8feda4dcead3662d65856b2c49548a`／Tree `41e9a7f35b2c7ac321309da118addc5dbc13a29d`では、fresh cloneの一般Task、親Repository＋`00_CRDD` gitlinkの一般Task、4経路4/4および復旧行列がすべて成立し、cleanup確認済み、手動Recovery不要、API key／従量課金fallbackなしだった。Runtimeが報告するmanifest identity `74ebf1b8713eb4b01856c1420f6d4df8092073daa992338e006ae14db5646b72`と、manifest file SHA-256 `3b50dd2aaa9bbb10325db4eecdf85904573b97ff93f0d0c28fcb34ecdd869c3a`は異なる意味の値として区別する。

最終独立監査は、上記Bが署名前に必要な正本文書の`Status: Stable`化、候補専用`Released Baseline`削除および時間に依存しない品質状態を含んでいないことを検出した。実装・E2Eの成立を否定するFindingではないが、そのTree自身が未完成状態を主張するため、上記署名候補にtagまたはReleaseを付与せず不採用とした。正本とReleaseメタデータをStableへ遷移した新しいSource Aを固定し、正式manifestだけを加えたBへ同じRelease Gateを適用する。署名後にしか確定しないBのIdentity、E2E結果、統合後確認およびRelease判断は、署名対象Treeへ自己参照させず、対象タグに結合した公式Release記録へ保存する。

Runtime Authorityの責務境界をRepository全体から閉じた実行依存集合へ移した候補Source Aは、Commit `a15b997924536dcd306c48a5924ba066627e3fdf`／Tree `ad058d8e768c598937e6cc3261db3cef5980f0ae`であった。そこから生成したrevision 5 manifestのRuntime実行Identityは`f2243b46b8cdde4a09e60efb7bdd61b48f012c4eb418cbdf4222d75306af1aaa`、manifest file SHA-256は`6d5bae8ab8004498d2a7d6bc0db63a32f514eafe3e4beec493bfc48e4661163b`、Release Sequenceは`2026090105`である。manifestだけを加えたCommit Bは`371151e9713e4c7e556db883d13af532bc82b3a1`／Tree `076310d110e2ecdadd6484309131f27de0d6860f`であり、AからBの変更Pathは`template/tools/coordinator/coordinator-package-manifest.json`一件だけである。

署名後には、Trust Core、閉じたPackage inventory、Package Gate、署名生成、Docker Desktop修復記録およびRuntime修復の直接影響129試験を実行し、129/129、失敗・取消・skip 0を確認した。この記録追記はRuntime実行集合、Policy、Native成果物またはmanifestを変更しないRelease文書変更であるため、Runtime実行Identityの不変を確認し、再署名および実Provider E2Eの再実行を要求しない。正式4経路E2EとRecovery Matrixは、この同一Runtime実行Identityに対する最終Release Gateとして一度実行した。

文書追記後のExecution Commit `35d3d0e3b335a344d830060f6eadc8afe089cec5`でも、固定配布検証は同じRuntime実行Identity `f2243b46b8cdde4a09e60efb7bdd61b48f012c4eb418cbdf4222d75306af1aaa`を返した。正式4経路E2Eの記録IDは`67496444-b9a5-494b-9dd2-92bdb301e79d`、結果SHA-256は`f64f7adf35cd4c362e967b7ea12f8f26953121a87531cd3e82d279d7374877c8`である。forward、reverse、same-codex、same-claudeの4/4が各一回で完了し、安全再試行0、全候補の内容一致・破棄・cleanupを確認した。手動Recovery、Process再起動、Effect不明、Repository変更、Host Path・秘密・Provider生出力の報告、API key／従量課金fallbackまたは追加購入はない。

同じExecution Commitに対するRecovery Matrixの記録IDは`3f9cbb74-5473-42bb-98c7-87f674017814`、結果SHA-256は`5315b87365a4d573a01ccd167803e5858a6a2e105985bcb382ab583664c8840f`である。timeout、出力量超過、不正出力および非0終了は期待する停止理由へ一致し、cancel、cleanup観測不明からのfresh recovery、親Process消失後の子Process終了とfresh recoveryが成立した。残存Operation Directoryはなく、行列全体のcleanup確認済み、手動Recovery不要で完了した。

固定Revision `f5b5084`の独立監査では、上記候補のRuntime実行Identityが共通Launcherから到達する署名・4経路・Recoveryの`script`実装を含まず、当該実行コードの変更後も旧署名Authorityを受理し得ることを検出した。また、現Identityに対するfresh clone／親Repository＋submoduleの公開`task`実測が未実施であること、Roadmapが完了前に本変更を除去したこと、およびv0.18.1固有の切戻し条件が不十分であることを検出した。上記Identity `f2243b46…f1aaa`、4経路およびRecovery結果は削除せず未公開候補の履歴として保持するが、最終Authority根拠へ流用しない。

是正では第三のIdentityを追加せず、共通Launcherの入口表をIdentity seedとして共用し、選択された署名・4経路・Recovery `script`の静的依存を推移的に導出した。非正規specifierと未束縛の動的importを拒否し、未選択の開発補助scriptはIdentityへ入れない。

次のSource AはCommit `ae35bb4889e0359d08166adb574aadf483736d99`／Tree `85c75d854b4a9f04208793f8cff903dfcb0bd6d4`、manifest-only BはCommit `423cb510e995915a0ce113de3e317a6f7e491132`／Tree `33a27615bd7df06eda9237fc391d57f4f49faae4`である。Runtime実行Identityは`33cca9b840e46fe290530232dcdd09c0f99e3d63b01c59f51362112428e2473a`、manifest file SHA-256は`698e4aa1971ac0209b3d363e82f1af10f29d66d60e165ed5f66e7d9175a8e922`、Release Sequenceは`2026090106`である。AからBの変更Pathは`template/tools/coordinator/coordinator-package-manifest.json`一件だけである。

同じIdentityに対する新規cloneと親Repository＋submoduleの一般Taskは双方完了し、候補を破棄した。4経路は4/4、Recovery Matrixは7シナリオが成立し、cleanup確認済み、正本変更・手動Recovery・API key／従量課金fallback・追加購入はない。実行条件、記録ID、結果Hashおよび一般化限界は[候補検証](../../07_Quality/Verification_Results/2026-09-01_Coordinator_v0181_Runtime_Identity.md)へ分離する。

この候補の独立確認では、依存抽出が正規表現に依存し、コメント、bare／absolute／URL module、存在しない`node:`指定または構文不明をFail Closedに閉じていないこと、および選択scriptのNode.js子Process／Worker targetが署名閉包と独立し得ることを検出した。そのため`33cca9b8…2473a`と上記E2Eは不採用の未公開履歴として保持し、最終Authority根拠へ流用しない。

現在は、コメントと構文tokenを区別する字句解析、実在する`node:`組込みmoduleと閉包内relative targetだけを許可するmodule契約、共通Launcher入口表とliteral importの双方向照合、および選択scriptのNode.js子Process／Worker target結合を実装した。残るGateは、新しいSource Aの固定、署名、fresh clone／submodule一般Taskの実行Revisionを含む再実測、4経路、Recovery、同じ固定候補の独立再確認、および人間による統合・Release判断である。現在、人間による追加判断は必要ない。
