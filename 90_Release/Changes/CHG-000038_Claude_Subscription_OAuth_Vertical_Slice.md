# 変更トレース: Claude Subscription OAuth Vertical Slice

- 変更ID: `CHG-000038`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Claude Code 2.1.220の固定image、最小環境、専用Provider Home、限定Egressおよび既存Subscription OAuthの縦接続
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Claude Execution Plan revision 3→7、Provider Lifecycle revision 5→6。通常Runtime Gateはまだ有効化しない）
- 移行要否: `migration_required: true`（発行済みproduction state、Mount Grantおよびconsumerは0。旧revisionへのalias／fallbackは設けない）
- 関連正本: [`CHG-000028`](CHG-000028_Claude_Execution_Plan_Foundation.md)、[`CHG-000030`](CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[`CHG-000037`](CHG-000037_Claude_No_Network_Version_Probe.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

Claude Code 2.1.220の`--bare`はOAuth／Keychainを読まずAPI key経路だけを許すため、既存Subscriptionを使うCoordinator Runtimeの概念と両立しないことをexact binaryのhelpで確認した。固定prompt argvを`--safe-mode`、空のsettings sources、空のMCP設定、tool無効、session非永続、最大2 turns、API相当budget `$0.10`へ変更し、公式Claude.ai loginだけを許すManaged Settingsを固定imageへ組み込んだ。

固定image、専用Provider Homeの一時bind mount、親環境を継承しない明示環境、internal Provider networkとdual-network Proxyによる限定Egressを順に実測した。Providerの直接外部通信と非許可hostnameを拒否し、許可した`claude.ai`だけTLS到達できること、および終了時のcontainer／network残存0を確認した。既存Subscription OAuth loginは専用Provider Homeと同じEgress境界で成功し、read-only Provider Homeとnetworkなしの公式`auth status`で`claude.ai`方式、Claude Max、logged-in状態を確認した。

人間が直前承認した固定promptをexact 1回実行し、Claude process exit 0、1 turn、限定Proxyだけの通信、API key環境0およびcleanup残存0を確認した。ただし返答を単一キーJSONとして検証できなかったため、run全体はFail Closedでblockedとし、自動再送しなかった。exact binaryが`--json-schema`を受理することを追加通信なしで確認し、次の候補argvへ固定Schemaを追加した。Schema追加後の実Requestは未承認・未実行である。

その後の人間による再承認で、Schema追加後のexact 1 commandを実行したがClaude processはexit 1となった。raw outputは値を保持せずHashだけを記録したため、Structured Outputの検証再試行失敗、`--max-turns 1`との境界または別のProvider errorを一意に確定できない。cleanup残存0と、終了後もClaude Max OAuthが`loggedIn: true`であることをnetworkなしで確認した。追加の自動再送は行っていない。

人間が最大2 turns、API相当budget `$0.10`で再承認した3回目は、process exit 0、response subtype `success`、Structured Output 1 property、2 turns、CLI報告API相当cost `$0.022397`およびcleanup残存0となった。ただしlocal verifierはstring `available`の完全一致を確認できずblockedとした。公式資料はstring `enum`／`const`の大文字小文字差を許容しcase-insensitive比較を案内しているため、local比較を緩めず、Schemaをboolean `status: true`へ変更した。boolean Schemaを含む全argvはnetworkなし、Credentialなしで受理済みで、boolean Schemaによる実Requestは未実行である。

人間が承認したboolean Schema最終runはprocess exit 0、response subtype `success`、Structured Output 1 property、boolean value `true`、2 turns、CLI報告API相当cost `$0.04699`、限定Proxy通信およびcleanup残存0となった。最初のlocal verifierはproperty名exact比較をfalseとしたが、原因はPowerShellの式境界で1要素配列がscalar stringへ展開され、`$properties[0]`が`status`ではなく先頭文字`s`を返す検証ハーネス欠陥だった。同じ式を固定fixtureで再現し、`System.Object[]`を保持する修正後にexact key `status`、boolean `true`を確認した。これにより実Claude固定prompt Vertical Sliceは成立したが、production Runtime Authority、Mount Grant、image配布およびDocker adapter接続はblockedを維持する。

本変更は実測adapterをproduction Runtime Authorityへ昇格しない。Provider Homeの保護effect／観測、Mount Grant issuer／clock／atomic store／consume／revoke、image配布、manifest verifier、環境置換およびDocker topologyのRuntime接続が未完了であるため、通常GateはFail Closedを維持する。CHG-000030で棄却したcaller由来bindingの先行storeを復活させず、selected-user binderとProvider Home保護観測を先に接続する。

外部へ送信したのはAnthropic公式公開URL、公開version、許可hostnameへの空の疎通用requestおよび人間が開始したOAuth protocolだけである。Repository内容、Path、Credential、token、Provider Home内容、固定promptまたは利用者情報を記録成果物へ送信していない。

## 発火・非発火・境界・情報不足

- 発火例: 人間がOAuth bootstrapを明示し、exact image、専用Provider Home、internal network、限定Proxy、最小環境およびcleanupを同じrunで構成できる場合だけ、`auth login --claudeai`を起動する。
- 非発火例: 通常`doctor`、API key、Console login、Host既定Claude home、Host proxy、PATH lookup、Repository mountまたは固定prompt requestからOAuthを開始しない。
- 境界例: transient bind mountとEgress probeの成功はRuntime-owned Mount Grant、Authorityまたはproduction Egress Capabilityの発行ではない。OAuth login成功も自動化されたSubscription利用許可、quota十分性または追加購入許可を意味しない。
- 判定情報不足例: image Identity、Provider Home保護、mount先、Proxy、network attachment、cleanup、認証方式または人間Authorityの一件でも確認不能なら、login／requestを成功扱いにしない。

## API課金の別Profile境界

人間の決定権限者は、標準ProfileをSubscription専用とし、API key、従量API、追加credit購入および自動plan切替を原則禁止かつv1非対応とする方針を採用した。quota不足、認証失敗、Provider errorまたはSubscription条件不成立を、有料APIへのfallback契機にしない。

将来有料APIを利用する場合は、Subscription経路の例外またはfallbackではなく、ユーザーが明示設定する別の有料API Profileとして扱う。設定は有料API Policyの評価を可能にするだけで、request、購入または実行Authorityを単独では発行しない。exact Provider／Account、Subscription Homeと分離したCredential source、明示予算およびOperation Authorityをすべて結合できる場合だけ、別Capabilityとして将来評価する。現在のClaude Vertical Sliceに有料API Profileの設定面、Credential取込みまたは実行経路は追加しない。

## 実測状態

固定値、拒否／許可試験、cleanupおよび未発火Effectは[`Verification Run Record`](Evidence/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice_20260824.md)を正本とする。

現時点で成立した範囲は次である。

- Claude Code 2.1.220の署名／Hash済みbinaryを固定local imageへ組込み
- Managed Settingsのbyte列とSHA-256をimage identityへ結合
- fixed argvのexact binary互換性をnetworkなし・Credentialなしで確認し、request／cost／token 0を観測
- OS Known Folder由来の専用Claude Provider Homeを保護し、Host既定homeをimportせず、一時sentinelのwrite／deleteだけでbind mountを確認
- Provider direct egress拒否、非許可hostname拒否、許可hostname TLS到達およびcleanupを確認
- Claude.ai Subscription OAuth login成功、Claude Max offering観測、identity非記録の`auth status`成功
- 承認済み固定prompt exact 1 requestのprocess／network／cleanup成功、result contract失敗によるFail Closed
- `--json-schema`追加後argvのnetworkなし・Credentialなし互換性確認
- Schema追加後exact 1 commandのexit 1、cleanup成功、OAuth継続および原因未確定を記録
- 最大2 turns／`$0.10`上限runのProvider structured successとlocal string gate不成立を区別
- casing不確実性を除去するboolean Schema候補のnetworkなし互換性確認
- boolean Schema最終runのProvider success、normalized `{status: true}`、隔離条件およびcleanup成功
- 単一要素scalar化によるlocal verifier誤判定の決定論的再現と修正

## 未完了と処置

- quota観測と認証状態のRuntime-owned binding
- Runtime-owned selected-user binder、Provider Home保護effect／観測およびMount Grant lifecycle
- signed manifest verifier、固定image配布、最小環境置換、Proxy／Docker topologyおよびcleanupのRuntime adapter接続
- timeout、cancel、process tree終了、Operation終了時revokeおよびRecovery
- 固定改訂版へのRepository全体checker、独立Agent／Architecture／Security ReviewおよびGap／Impact Audit

本変更は`In Progress`、Gate blocked、Authority／Capability非発行および非Releaseを維持する。OAuth同意、Subscription利用、保護対象の採用・統合、残存risk受容およびReleaseは人間の決定権限へ残す。
