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

署名manifest revision 4は、CRDD Commit／Tree、Coordinator package root、Policy Hashおよび単一Native成果物`template/tools/coordinator/windows-x64/crdd-platform-access.exe`だけを結合する。旧revision、削除済みSupervisor field、別Path aliasまたは欠落fallbackを受理しない。

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

## 7. 検証義務

- help、parser、dispatch、module、Native binaryおよび現行文書から削除Surfaceが消えている。
- 削除commandは未知commandとしてusage errorになり、専用statusや互換結果を返さない。
- `capabilities --json`が公開CLI閉集合と非対応境界をEffect 0で返す。
- manifest revision 4が単一Platform Access成果物をexactに結合し、旧revision／旧fieldを拒否する。
- Repository textのLF／CRLF差だけを同じGit正本内容として検証し、意味差分とNative成果物のbyte差を拒否する。
- TypeScript、Rust、Checker、format／lintおよび全Repository試験が固定候補で合格する。
- fresh clone／submodule相当の採用環境で、Capabilities確認から一般Taskの有用結果までを再現する。
- timeout、cancel、Provider失敗、owner loss、cleanup不明およびRecoveryの既存保証が削除後も成立する。
- Architecture／Security、Test／UX、Document、Gap／ImpactおよびConformanceの独立確認を同じ固定改訂版へ実行する。

## 8. 現在状態と残件

公開入口、旧Stateful subsystem、導入用Supervisor、AppContainer準備契約および旧manifest候補は、現行Source、CLI、配布候補、正本および試験母集団から削除した。Platform Accessの現在契約は、選択ユーザーの通常Processで固定署名成果物を最小環境かつ上限付きI/Oにより呼び出す一成果物構成である。

Repository全体のTypeScript試験は最終Source候補を通常のローカルユーザーProcess境界で1339件中1339件合格した。これに先立つ制限Process内のrunでは`taskkill.exe`を許可されない7件だけが安全側の終了未確認となり、同じ7件を通常Processで再実行すると全件合格した。Rustの通常試験、Clippy、Format、Native Coverage、TypeScript Coverage、Coordinator Checkおよび全体Checkerも合格した。この環境差を本番実装の成功へ補正せず、制限Process内の事実と通常Processで実終了を観測した根拠を分けて保持する。LLVM CoverageがWindows実子のBootstrap環境を変更するため、実子の完全環境一致は通常Rust試験で必須とし、Coverage実行では当該1件だけを非計測にして残るNative Sourceを全件集計する。

最初のmanifest候補は`git archive`上のLFと既存Windows Checkout上のCRLFを生バイト差として扱い、署名検証がProvider Effect前に停止した。原因は任意改変ではなく、Gitが許可するCheckout改行変換をPackage Hashと配布Tree再構成の両契約が表現していなかったことにある。Package content rootを宣言済みRepository textだけLF正規化するV2へ改め、配布Treeも`text=auto eol=lf`と同じbinary判定によりtextをLF正本、binaryを生バイト正本として再構成する。LF／CRLF同値、内容差分拒否およびbinary生バイト一致を双方の契約試験へ固定した。失敗したmanifest候補はRelease候補として使用せず、更新後のSource Commitから再署名する。

残る作業は、固定Source候補のCommit A／Tree A、manifest revision 4だけを加えたCommit B、fresh clone／submodule相当のCapabilities確認と署名済み一般Task E2E、異常／回復行列、同じCommit Bに対する独立確認および人間のRelease判断である。

現在、人間による追加判断は必要ない。v0.18.1の最終Releaseは、上記検証と独立確認が完了した固定候補に対して別途判断する。
