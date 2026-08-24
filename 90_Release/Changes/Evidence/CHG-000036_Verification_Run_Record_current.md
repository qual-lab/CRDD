# CHG-000036 署名済みAppContainer往復検証記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`38f6a310`記録](CHG-000036_Verification_Run_Record_38f6a310.md)
- 実行日: 2026-08-24（Asia/Tokyo）
- 固定Git commit: `f5f251794f00ff85fdee098203bf8744a8a67983`
- 固定Git tree: `9d99d2a20f9f381120c638dad9074a08bb55e3cc`
- 状態: 署名ManifestとAuthenticodeを同一runへ結合したnative Supervisorから、AppContainer WorkerのPA03／PR03往復および正常終了を実測したcomponent候補。統合、Release、Gate openまたは実Provider起動の成立記録ではない。

## 今回確認したこと

非パッケージWin32 Supervisorが作成する名前付きPipeを`\\.\pipe\CRDD.Coordinator.<supervisor-pid>`へ固定し、`PIPE_REJECT_REMOTE_CLIENTS`、first instance、限定DACL、Pipe objectだけのLow integrity mandatory labelおよび接続元PID一致を維持した。Worker側は同じ固定prefixと10進PIDだけを受理し、`LOCAL\`修飾、別prefix、PID 0、先頭0、suffixおよび余分引数を拒否する。

固定commitをarchiveし、両Rust成果物を同一Release stagingへ配置した。Ed25519 Release Manifestを固定Release鍵で署名し、別の非永続RSA 3072-bit Code Signing鍵でSupervisorをAuthenticode署名した。公開証明書だけを人間承認済みの`CurrentUser\Root`および`CurrentUser\TrustedPublisher`へ一時登録し、証明書SHA-256をSupervisorの固定publisher Identityへ結合した。

同じrunでnative `coordinator.exe provision`へPA03 revision 3を渡した結果は次のとおりだった。

| 観測 | 結果 |
| --- | --- |
| Authenticode | `Valid` |
| signer certificate SHA-256 | `3c3a6adc13379a3a5e8fda0a268f4416578ab394d7b36b87637a8c9a84a7fe0c` |
| process exit | `0` |
| response magic／revision | `CRDDPR03`／`3` |
| response candidate／reason | `true`／`100` |
| access mask／principal flags | `1`／`193` |

正常responseは、Supervisor内部のmanifest／artifact／publisher検証、Known Folder由来`LOCALAPPDATA`だけの環境、AppContainer process生成、create-time single-process Job、worker loaded-image照合、接続元PID一致、PA03書込み、PR03 exact frame、worker exit 0、Job active process 0およびRegistry exact restoreを通過した後にだけ返る。したがって、この固定runではそれらの制御経路が一続きで成立した。

## suiteと成果物検証

- `platform-access:test`: Supervisor 5 passed／1 ignored、Worker 8 passed、CLI 1 passed、native core 6 passed。ignored 1件はCurrentUser Registryを変更・復元する明示試験であり、今回の実往復が同じ復元経路を通過した。
- `platform-access:lint`: Worker／release SupervisorのClippy `-D warnings`合格。
- `platform-access:build`: 固定Rust toolchain `1.94.1-x86_64-pc-windows-msvc`で合格。
- `platform-access:native-bootstrap-pe`: 2 build byte-identical。Supervisorは102,400 byte、SHA-256 `7b806089f2a385b73af1dde010837d03db6b09fd2a407f81c73e40d1c6caa7b6`。Workerは139,264 byte、SHA-256 `895eb5626d4d28a7ca5ae10faf20c577a4ac3518536ffe3ab95d1fa72a67c999`。x86-64 CUI、ASLR／NX、exact import集合、delay import／TLS／bound import／CLR 0および内部Worker Hash結合を確認した。MSVC linker Identityと既存local Cargo cacheのsupply-chain Identityは未検証である。
- `test`: Node契約試験437 passed、0 failed。
- `check`: TypeScript、Biome lintおよびformat合格。lint 153 files、format 152 files、warning 0。
- full CRDD checker: 364 Markdown、2,093 local links、583 anchors、error 0、warning 0。Git-ignored filesは対象外。

## 終了後の安全状態

- `HKCU\Console\LowBoxConsoleEnabled`: 元の不存在へ復元。
- `HKCU\Software`の`QualLab.CRDD.Coordinator.ProvisionRecoveryV1`: 不存在。
- 一時Release staging／archive: 0。
- 一時Code Signing証明書: `CurrentUser\Root`、`CurrentUser\TrustedPublisher`、`CurrentUser\My`の3 Storeで0。
- 通常buildのSupervisor: `NotSigned`へ復元。
- API key、Provider credential、Network、installer、machine-wide Store、管理者service、Provider起動、mergeまたはRelease: Effect 0。

## 未完了と適用限界

- 実processのNetwork非発火と全runtime module集合は今回観測していない。static PEの直接Network import 0をその代用にしない。
- selected-user binder、protected active、Provider Home、Mount Grant issuer／store／clock／失効、Egress、OAuth／subscription条件およびClaude Code限定probeは未完了である。
- mapped Supervisor imageと後からopenしたartifactの原子的自己結合は、採用済みMinimum Trust Boundaryではv1必須条件にしないが、方式成立またはVerified Imageを主張しない。
- 今回の一時証明書を公式Publisher、次回run、Releaseまたは残存risk受容へ流用しない。正式Release用PublisherとTrust Store処置は別の人間判断を要する。
- normal Runtime Gate、Authority／CapabilityおよびClaude Code起動は`blocked`のままである。

本記録は固定commitの実行履歴である。後続の文書だけの記録更新はこのrunを無効化しないが、実装、build条件、manifest、署名条件または実行環境が変わった場合は流用せず再実行する。
