# CHG-000036 正式署名AppContainer・ETW同時検証記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`f5f25179`記録](CHG-000036_Verification_Run_Record_f5f25179.md)
- 実行日: 2026-08-24（Asia/Tokyo）
- 固定Git commit: `afb6b70a040915e2826cb87b1ca7dd13f3bf1e95`
- 固定Git tree: `4703f0919c5da2e9120e1fe50705a7eb0e326675`
- 状態: 固定配布treeから生成した正式署名native Supervisorが、AppContainer Worker、選択ユーザー結合、OS所有読取り専用probe、ETW Network非発火観測およびHost復元を同一runで成立させたcomponent候補。Repository Mount Grant、通常Runtime Gate、Claude Code起動、統合またはReleaseの成立記録ではない。

## 結論

固定commitを`core.autocrlf=false`でGit archiveし、Git blobと同一byteの配布treeを構成した。固定Ed25519 Release鍵でManifestへ署名し、別の非永続RSA 3072-bit Code Signing鍵でSupervisorをAuthenticode署名した。公開証明書だけを人間承認済みの`CurrentUser\Root`および`CurrentUser\TrustedPublisher`へ一時登録し、証明書SHA-256をSupervisorの固定publisher Identityへ結合した。

同じrunで、署名済みnative `coordinator.exe provision`へPA03 revision 3を渡し、OS認証済みの選択ローカル対話ユーザーとAppContainer SIDをSupervisorによる直接Token観測へ結合した。WorkerはKnown Folder由来`LOCALAPPDATA`だけの最小Environment、AppContainer、create-time Jobおよびmitigation下で起動し、`C:\Windows\System32`に対する読取り専用Runtime probeをPR03 revision 3として返した。

同一ETW traceでは、対象WorkerのNetwork eventは0、loopback陽性対照は28、lost event／bufferは0だった。Worker成功とcleanup成功を別Gateとして評価し、Registry、Trust Store、recovery recordおよび一時成果物が元状態へ復元された場合だけrun全体を`accepted`とした。

## 固定結果

| 観測 | 結果 |
| --- | --- |
| run status | `accepted` |
| Authenticode | `Valid` |
| process exit／stderr bytes | `0`／`0` |
| response magic／byte length | `CRDDPR03`／`86` |
| response revision／role | `3`／`1`（Runtime） |
| response candidate／reason | `true`／`100` |
| access mask／principal flags | `1`／`131` |
| nonce | 一致 |
| principal hash | nonzero |
| Supervisor SHA-256／byte length | `bb2e1317750889e1b61eff1e0a8896c07c3dc488215843b4a8bdcfecaefa6334`／`123752` |
| Worker SHA-256／byte length | `6a31c3838cbc96d1db1d62923f295a3c019e2a9c88a57d60cf9442332ba88a91`／`139264` |
| signed Manifest SHA-256 | `c080cd00ce97aed95e51ab07ea4a8bedb9836feaea6d66ac136be8158b9ef661` |
| response SHA-256 | `7325797dad854500e387287ef75610f0ec1c19018f0e62e580e099d123e3229b` |
| target Worker PID／完了 | `31488`／`true` |
| target module数／Network event数 | `15`／`0` |
| loopback陽性対照PID／Network event数 | `16744`／`28` |
| trace lost events／buffers | `0`／`0` |
| Registry／Trust Store復元 | `true`／`true` |
| recovery record／temporary residue | `absent`／`0` |
| manual recovery required | `false` |

秘密鍵passphraseはマスク付きGUIからanonymous stdout pipeでNode signerへ渡し、command line、環境変数、fileまたは結果へ保存しなかった。Security Warningへの人間承認後もpassphrase画面が前面化されない事象を避けるため、検証harnessは同画面をtaskbar表示、TopMost、ActivateおよびBringToFrontする構成に限定した。このGUI処置はproduction credential APIではない。

## 選択ユーザー結合の補正

実Windows測定により、AppContainer Workerの`TokenUser`をSupervisorの`TokenUser`と一致させる旧仮説は不正確と判明した。AppContainer化でWorkerのToken principalは変わるため、`TokenUser`一致をAuthority根拠としてはならない。

固定runでは次を要求した。

- Supervisor自身の`TokenUser`、`AuthenticationId`およびToken flagsを起動前後で再観測し、選択ログオンセッションとの結合が変化していない。
- suspended child primary tokenが`TokenIsAppContainer = 1`である。
- childの`AuthenticationId`がSupervisorと一致する。
- childのAppContainer SIDがSupervisor自身の固定profileから導出したSIDとexact一致する。
- Workerが返すprincipal hashはnonzeroであるが、Workerの自己申告だけをAuthority根拠にしない。

また、`IsTokenRestricted`はrestricting SID listの存在だけを判定するAPIであり、AppContainer identityの判定ではない。そのためchildの必須条件から除外し、Supervisor自身がrestricted tokenでないという既存の禁止条件は維持した。`TOKEN_APPCONTAINER_INFORMATION`は可変長情報として二段階取得し、上限、pointer範囲、最小SID長、`IsValidSid`、`GetLengthSid`およびexact SID比較を行った。

## ETW同時観測

Windows Performance Recorderと決定論的QA観測器を同一runへ結合した。対象Workerのmodule集合は、対象Worker自身と次の`C:\Windows\System32`配下14 moduleだった。

- `advapi32.dll`
- `apphelp.dll`
- `bcrypt.dll`
- `bcryptprimitives.dll`
- `kernel.appcore.dll`
- `kernel32.dll`
- `KernelBase.dll`
- `msvcrt.dll`
- `ntdll.dll`
- `ntmarta.dll`
- `rpcrt4.dll`
- `sechost.dll`
- `ucrtbase.dll`
- `vcruntime140.dll`

同一traceで`curl.exe`を`127.0.0.1:9`へ接続させ、観測器がNetwork eventを検出できる陽性対照を取得した。対象0件だけを根拠にせず、陽性対照28件とtrace loss 0を同時に要求した。外部Network endpointへの送信は行っていない。

## probe範囲と未成立の境界

正式runのprobe対象は`C:\Windows\System32`であり、OS所有の読取り専用対象である。検証用一時配布directoryおよびRepository rootをAppContainerから開く試行は`RootOpenFailed`となった。これはAppContainer隔離がRepositoryを暗黙公開していないことを示す一方、次を成立させない。

- Repository Mount Grant
- Provider Home Mount Grant
- Authority Rootへのアクセス
- protected active
- 通常Runtime Gate
- Claude Code Provider request

RepositoryまたはProvider Homeを公開するには、Mount Grant issuer／store／clock／失効、対象Path Identity、ACLまたはmount Effect、起動直前再確認および終了時cleanupを別の契約として接続する必要がある。

## 検証suite

- Coordinator Node契約試験: 443 passed、0 failed。
- Coordinator `check`: TypeScript、Biome lint／format合格。
- Rust Supervisor: 8 passed、1 ignored。Worker: 8 passed。CLI: 1 passed。native core: 6 passed。
- Worker／release SupervisorのClippy `-D warnings`: 合格。
- native PE reproducibility: 合格。
- Checker契約試験: 151 passed、0 failed。
- Checker `check`: TypeScript、Biome lint／format合格。
- Repository全体Checker: 369 Markdown、2,107 local links、583 anchors、error 0、warning 0。Git-ignored filesは対象外。

## 終了後の安全状態

実行結果自身の復元判定に加え、別processから次を確認した。

- WPR記録session: 停止済み。
- `HKCU\Software\QualLab.CRDD.Coordinator.ProvisionRecoveryV1`: 不存在。
- 一時証明書、Registry変更、Release staging、trace、抽出結果および一時directory: residue 0。
- API key、Provider credential、Provider Home、外部Network request、Claude Code request、installer、Local Machine Store、管理者service、mergeまたはRelease: Effect 0。

## 未完了と適用限界

- 本runはWindows Execution Environmentの署名済みAppContainer vertical sliceとETW Network非発火を同時実測した。Repository／Provider Home Mount Grantは未実装であり、Claude Codeはまだ起動していない。
- Runtime-owned Claude artifact verifierと固定provider image、Egress、OAuth／subscription条件、固定prompt Provider requestおよびstructured result統合は未完了である。
- mapped Supervisor imageと後からopenしたartifactの原子的自己結合は、採用済みMinimum Trust Boundaryではv1必須条件にしないが、方式成立またはVerified Imageを主張しない。
- 一時証明書を公式Publisher、次回run、Releaseまたは残存risk受容へ流用しない。正式Release用PublisherとTrust Store処置は別の人間判断を要する。
- normal Runtime Gate、Authority／CapabilityおよびClaude Code Provider requestは`blocked`のままである。

本記録は固定commit／treeの実行履歴である。後続の文書および契約表示だけの更新はこのrunを無効化しないが、native実装、build条件、Manifest、署名条件または実行環境が変わった場合は流用せず再実行する。独立レビュー、採用・統合、残存risk受容およびRelease判断は未実施である。
