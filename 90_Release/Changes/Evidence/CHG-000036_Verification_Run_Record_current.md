# CHG-000036 selected-user binder署名済み往復検証記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`f5f25179`記録](CHG-000036_Verification_Run_Record_f5f25179.md)
- 実行日: 2026-08-24（Asia/Tokyo）
- 固定Git commit: `cfb003c172479efce0fc4e79ead70c704e05efa1`
- 固定Git tree: `c7e39a691c05e46d6ba24fa15d016725a16db907`
- 状態: selected-user binderを含む署名済みnative SupervisorからAppContainer WorkerのPA03／PR03往復、正常終了およびHost復元を実測したcomponent候補。統合、Release、Gate open、Claude Code Provider requestまたは認証の成立記録ではない。

## 結論

固定commitを`core.autocrlf=false`でGit archiveし、Git blobと同一byteの配布ツリーを構成した。固定Ed25519 Release鍵で署名Manifestを生成し、別の非永続RSA 3072-bit Code Signing鍵でSupervisorをAuthenticode署名した。公開証明書だけを人間承認済みの`CurrentUser\Root`および`CurrentUser\TrustedPublisher`へ一時登録し、証明書SHA-256をSupervisorの固定publisher Identityへ結合した。

同じrunでnative `coordinator.exe provision`へPA03 revision 3を渡し、OS認証済みの選択ローカル対話ユーザーをSupervisorとAppContainer Workerの直接Token観測で結合したPR03 revision 3候補を取得した。正常responseは、Release Manifest、両artifact、Authenticode、Known Folder由来`LOCALAPPDATA`だけの環境、AppContainer、create-time Job、worker loaded-image、接続元PID、PA03／PR03、worker終了、Job active process 0、selected-user binderおよびRegistry復元が一続きで成立した後にだけ返った。

## 固定結果

| 観測 | 結果 |
| --- | --- |
| Authenticode | `Valid` |
| process exit | `0` |
| response magic／byte length | `CRDDPR03`／`86` |
| response revision／role | `3`／`2` |
| response candidate／reason | `true`／`100` |
| access mask／principal flags | `1`／`131` |
| nonce | 一致 |
| principal hash | nonzero |
| selected-user binder | 一致 |
| Supervisor SHA-256／byte length | `06c0c04754d744ac980dc2bef1fd3b2b6d28ffffbd95a8c37b6a9c69620522da`／`112976` |
| Worker SHA-256／byte length | `85cbffe0147705c8942c4fef1fbe508c99370cb4fa27d5c9776cc6e2e37e1d77`／`139264` |
| signed Manifest SHA-256 | `6eafd2d3c8b9e2bf3fa113aa7885be3123cfc5c79343c0f3ad023f29fd351785` |
| response SHA-256 | `6770c1b2d96022d66a689f1242757d8b549dd9d49aed1484d947b19ad0d64a53` |

Manifestは署名後にexact byteを一時退避し、固定Release pathへ再materializeしてからWin32 `CreateFileW`によるnon-reparse read-only preflight handleを保持した。観測は通常file属性`32`、byte length `148`で、native process終了まで同じfile Identityを保持した。秘密鍵passphraseはマスク付きGUIからanonymous stdout pipeでNode signerへ渡し、command line、環境変数、fileまたは結果へ保存しなかった。

## 検証suite

- Rust Supervisor: 6 passed／1 ignored。ignoredのCurrentUser mutation試験は別実行で合格し、元状態へ復元した。
- Rust Worker: 8 passed。CLI: 1 passed。native core: 6 passed。
- Worker／release SupervisorのClippy `-D warnings`: 合格。
- native PE reproducibility: 合格。
- Coordinator Node契約試験: 437 passed、0 failed。
- Coordinator `check`: TypeScript、Biome lint／format合格。
- Checker契約試験: 151 passed、0 failed。固定Cargo command、exact `build.rs`を含むRust 8 source母集団および全命名規則を確認した。
- Checker `check`: TypeScript、Biome lint／format合格。
- Repository全体Checker: 369 Markdown、2,107 local links、583 anchors、error 0、warning 0。Git-ignored filesは対象外。

## 終了後の安全状態

実行結果自身の復元判定に加え、別processから次を再確認した。

- `CurrentUser\Root`、`CurrentUser\TrustedPeople`、`CurrentUser\TrustedPublisher`、`CurrentUser\My`: 対象一時証明書0。
- `HKCU\Console\LowBoxConsoleEnabled`: 元の不存在。
- `HKCU\Software`の`QualLab.CRDD.Coordinator.ProvisionRecoveryV1`: 不存在。
- 通常buildのSupervisor: `NotSigned`。
- 一時公開証明書file、Release staging／archive、deferred Manifest: 0。
- API key、Provider credential、Provider Home、Network request、Claude Code request、installer、Local Machine Store、管理者service、mergeまたはRelease: Effect 0。

## 調査中に確認したharness条件

- Windows PowerShell 5.1はUTF-8 BOMなしの日本語実行scriptをCP932として誤読した。実行用harnessをASCIIへ限定し、Windows PowerShell 5.1自身のparserで確認して解消した。production sourceの欠陥ではない。
- Windowsの`core.autocrlf`を有効にした`git archive`は137 tracked text fileをLFからCRLFへ変換し、署名処理が`release_manifest_distribution_tree_mismatch`で正しく停止した。`core.autocrlf=false`をarchive commandへ明示し、581 file／6,358,475 byteの再構成treeが固定Git treeと一致することを署名前に独立確認した。
- CurrentUser Trust StoreのSecurity Warningは通常Operationまたは無人fallbackへ持ち込まない。今回の一時self-signed証明書、目的、期間、Storeおよびrollbackに対する人間承認だけで実行した。
- E2E後の全suite確認で、既存`platform-access:test`の`--all-features`期待値、Cargo build script `build.rs`の正本／母集団およびClaude計画内local bindingの命名同期漏れを検出した。固定command、exact `build.rs`だけの許可および`noNetworkVersionProbe`への意味不変renameで是正し、Checker 151／151と両private package `check`を再合格させた。

## ETW観測経路の限定検証

2026-08-24に、後続の正式署名runで全module集合とNetwork非発火を同時観測するための決定論的QA観測器を実装し、未署名Workerの単体実行で観測経路を検証した。観測対象は固定Git commit `b6b58c80d44cdd3f41a2718f0f7b04bed698478d`／tree `6f173b82fe1b55ce946e95969c5c05870555614c`からbuild済みのWorkerで、SHA-256は`85cbffe0147705c8942c4fef1fbe508c99370cb4fa27d5c9776cc6e2e37e1d77`、byte lengthは`139264`だった。

Windows Performance Recorderのbuilt-in `Network.light` profileで同一traceを取得し、`Microsoft-Windows-TCPIP`（`2f07e2ee-15db-40f1-90ef-9d7ba282188a`）、Image Load classic（`2cb15d1d-5fc1-11d2-abe1-00a0c911f518`）およびProcess classic（`3d6fa8d0-fe05-11d0-9dda-00c04fd7ba7c`）だけを`xperf`で抽出した。対象Worker exact 1 start／end、対象image exact 1、全Image Load、対象TCP/IP event 0、同一trace内の`curl.exe`による`127.0.0.1:9`だけの陽性対照、ならびに`xperf -a tracestats`のlost event／buffer 0をQA観測器へ入力した。

| 観測 | 結果 |
| --- | --- |
| trace lost events／buffers | `0`／`0` |
| 対象Worker PID／終了 | `27392`／exact 1 end |
| 対象module数 | `11` |
| 対象TCP/IP event数 | `0` |
| ループバック陽性対照PID／TCP/IP event数 | `31712`／`28` |
| 観測器結果 | `accepted` |
| 観測器契約試験 | `6` passed、`0` failed |
| 観測器line／function／branch coverage | `100.00%`／`100.00%`／`95.00%` |

対象module集合は、対象Worker自身、`advapi32.dll`、`bcrypt.dll`、`kernel32.dll`、`KernelBase.dll`、`msvcrt.dll`、`ntdll.dll`、`rpcrt4.dll`、`sechost.dll`、`ucrtbase.dll`および`vcruntime140.dll`だった。対象Worker以外はすべて`C:\Windows\System32`配下だった。観測器は、trace loss、対象／陽性対照の欠落・重複・終了欠落、対象image欠落、System32外module、対象Network event、陽性対照Network event欠落またはloopback外addressのいずれかでFail Closedとする。

観測器追加後の全体確認は、Coordinator契約試験443件、Checker契約試験151件、両packageのTypeScript／Biome check、ならびにRepository全体CheckerのMarkdown 369件、local link 2,107件、anchor 583件で、error／warning 0だった。

この限定検証は、未署名WorkerをAppContainer外で単体起動し、stdin EOFによるexit 2までを観測したものである。したがって、正式署名Supervisor、AppContainer、native `provision`、PA03／PR03、selected-user binder、Registry復元または正式配布treeの同時成立根拠ではなく、前節の署名済みE2Eと合成して正式runを成立させない。実測後はWPR停止、trace／抽出結果を含む一時directory不存在を確認した。Registry、Trust Store、Provider credentialまたはNetwork外部送信のEffectは発行していない。

## 未完了と適用限界

- 全module集合とNetwork非発火のETW観測経路は未署名Worker単体で陽性対照を含めて成立したが、今回の正式署名runとは別runである。static PEの直接Network import 0、capabilityなしAppContainer、`networkEffectIssued:false`または別runの観測を、正式署名AppContainer Workerの同時実測へ読み替えない。
- protected active、Provider Home保護、Mount Grant issuer／store／clock／失効、Runtime-owned Claude artifact verifier、Egress、OAuth／subscription条件および固定prompt Provider requestは未完了である。
- mapped Supervisor imageと後からopenしたartifactの原子的自己結合は、採用済みMinimum Trust Boundaryではv1必須条件にしないが、方式成立またはVerified Imageを主張しない。
- 一時証明書を公式Publisher、次回run、Releaseまたは残存risk受容へ流用しない。正式Release用PublisherとTrust Store処置は別の人間判断を要する。
- 固定E2E後の`noNetworkVersionProbe`識別子renameはnative Supervisor／Worker、wireまたは公開結果を変更しないが、Repository全体のGit treeは固定`c7e39a`から変わる。したがって本記録は固定native componentの根拠として保持し、後続treeを公式Release、Gate openまたは署名済み全配布treeとする前に正式署名runを再実行する。
- normal Runtime Gate、Authority／CapabilityおよびClaude Code Provider requestは`blocked`のままである。

本記録は固定commitの実行履歴である。後続の文書だけの記録更新はこのrunを無効化しないが、実装、build条件、Manifest、署名条件または実行環境が変わった場合は流用せず再実行する。独立レビュー、採用・統合、残存risk受容およびRelease判断は未実施である。
