# Codexモデル・Host移行の着手前確認

## 結論

人間が承認した6.1 Sol標準／6 Luna軽量用途への移行では、モデル名だけでなくCode Mode Hostを含む固定配布物と実行契約の変更が必要である。公式CLI `0.159.2`の実バイナリ内で、両モデルは`code_mode_only`だった。現行助言のHost無効設定とは両立しない。

これは着手前の根拠整理であり、Hostの安全性、移行完了、署名または実Provider E2E合格の証明ではない。現在の助言用System Tool禁止、Repository非共有、暗黙fallback禁止、error・未知通知の拒否およびcleanup前の結果非公開を維持する。

## 固定配布物の静的確認

公式Release `rust-v0.159.2`のLinux musl向けArchiveをRepository-local一時領域で検査した。CLI、Host、ContainerおよびProviderは起動していない。

| 対象 | Archive SHA-256 | 本体SHA-256 | 本体Bytes |
|---|---|---|---|
| CLI | `26586b0d246d41a799b0ef8ee1add370f0fb0721b3709340f28db612381616ea` | `1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e` | 286754152 |
| Code Mode Host | `fb6b0c4a7b24ed0728d1208ebc0061383da60debc6d61cf63e02c48ac7f7630f` | `5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03` | 74068880 |

TarのPath、サイズ、Header checksumとArchive Hashを検査し、展開せず本体を読んだ。付属Sigstoreの署名と証明書の公開鍵の一致、公式Release Workflow Identityの一致は確認した。ただし証明書Chainの信頼とRekor inclusionは未検証であり、供給元検証完了とは扱わない。

| モデル | Tool Mode | 最低Client版 | 推論強度 |
|---|---|---|---|
| `gpt-6.1-sol` | `code_mode_only` | `0.153.0` | low / medium / high / xhigh / max / ultra |
| `gpt-6-luna` | `code_mode_only` | `0.155.0` | low / medium / high / xhigh / max |

同梱CatalogはAccountの利用可能性を証明しない。採用済みProfile Snapshotも初期設定の更新で上書きしない。

## 公式固定Sourceとの照合

| 確認対象 | 確認できた意味 | 残る確認 |
|---|---|---|
| V8初期化・公開API | 通常のV8 Contextへ限定Helperと登録済みToolを追加する。Node.js Runtimeを組み込む形ではない | 固定実バイナリでFS／Network／Processへの到達不能を反証する |
| Module読込み | 通常importと動的importの解決は拒否する | 例外経路、Resource上限と実環境の反証 |
| Tool集合 | `tools`と`ALL_TOOLS`はRequestの`enabled_tools`から作られる。Nested CallはCLI側Routerへ配送する | 助言Planの登録Tool母集合と除外後の全入口が閉じること |
| 公開JSONL | 既知Itemの一部だけを変換し、その他は省略する分岐がある | 通知0を禁止Effectなしの証明へ使用しない。実際の権限境界で確認する |
| Host Process | 固定Hostを別Processとして扱い、独自のIPC・取消・終了義務を持つ | CLI先行終了、IPC断、取消中Cell、Host残存と最終Container不存在 |
| Host設定 | stdio以外にgRPC／OTEL起動能力もある | Productionはstdio限定、telemetry未起動、固定Host、in-process fallback禁止 |
| Agent設定 | 固定Schemaには`agents.enabled`が存在する | `features.multi_agent_v2`の優先設定も閉じ、旧版の不明設定仮説を移植しない |

固定Sourceの参照先:

- [V8 Runtime初期化](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/code-mode-runtime/src/runtime/mod.rs)
- [公開HelperとTool構築](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/code-mode-runtime/src/runtime/globals.rs)
- [Module読込み拒否](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/code-mode-runtime/src/runtime/module_loader.rs)
- [JSONL変換](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/exec/src/event_processor_with_jsonl_output.rs)
- [Host接続とProcess管理](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/code-mode/src/remote_session/connection.rs)
- [Host入口](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/code-mode-host/src/main.rs)
- [固定設定Schema](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/core/config.schema.json)

## 着手前確認と次の処置

独立した読取り確認者は「計画修正」とした。内部計算をSystem Toolと分ける方向は成立し得るが、モデル更新承認から権限拡大を推定しない。固定Sourceの公開API確認を追加し、通知変換が省略を含むことを親担当でも照合した。

次の編集前に、Coordinatorの助言実行・配布・取消回復、AI Runtimeの互換条件と関連Quality義務へ最小設計差分を接続する。適用対象は内部計算だけであり、Repository、認証情報、任意FS、Network、Processまたは外部Toolを操作する新しいAuthorityをモデルへ与えない。

局所反証はHost欠落・差替え・起動失敗・fallback、禁止delegate、JSのFS／Network／Processアクセス、取消中Cell、遅延通知、CLI先行終了、IPC断、Host残存およびcleanup不明を含む。Provider送信と一時資源は実際に発生するため、実行全体をEffect 0とは表示しない。

初期Profileは`40_Develop/ai-runtime/src/default-ai-profile-catalog.json`へ外出しした。公開CatalogはSchema検証した独立コピーを深くfreezeする。モデル値はまだ旧値を保持しており、Host移行の成立根拠が揃う前に新モデルを実行可能と表示しない。

JSON外出しの局所確認ではFormatter、型、Lintが成功し、AI Runtime契約試験13件が成功した。深いfreezeへの変更試行、未登録Model、重複Profile、未知Propertyの拒否に加え、別Node Processで同梱JSONの正常読込み、欠落、構文不正およびSchema不正時の起動停止を確認した。Coordinatorの配布物観測器で現在Repositoryを読み取り、`candidate / platform_provisioner_distribution_observed`となった。これは新JSONを含む現在候補の配布物観測であり、署名や新モデルの実行合格ではない。

JSON外出しの完成後独立レビューはPass、是正Finding 0だった。確認者は旧2 Adapter・6 Profileの全値、独立コピーと深いfreeze、公開API維持、採用済みOwner Snapshot非上書きおよび静的JSON依存の配布閉包を確認した。独立実行はFormatter／型／Lint、Catalog契約9件、別Process起動拒否1件が成功した。Git操作禁止の確認範囲に合わせ、Git Fixtureを作る既存Integration試験は独立実行せず内容確認に限定した。親担当の13件成功と確認者の10件成功を混同せず、新署名や新モデル実行の合格へ流用しない。

### 禁止Toolの実行入口に残るGap

追加の独立した着手前確認も「計画修正」となった。固定Sourceの`ToolRouter`は受信した呼出しをRegistryへ渡し、Registryは登録名で実装を取得する。表示状態の検査はこのDispatch経路にない。`excluded_tool_namespaces`でNested集合から除外し、Code Mode Onlyで直接表示を隠しても、モデルが非表示Tool名を直接返した場合の実行前拒否を証明できない。

公式の`ToolPolicy.allowed_tools`は起動時の許可集合として登録・Dispatchを制限できるが、`ExtensionDataInit`経由の内部接続であり、今回確認した公開CLI設定には注入入口を発見できなかった。架空のCLI設定、モデルメタデータの差替え、通知がないことまたは読取りSandboxだけでこのGapを解消したとは扱わない。

Async質問／メッセージの固定HandlerはAgentMessageの搬送に限定されるため、CLIの捕捉出力と唯一のSchema適合最終結果へ閉じる設計は可能である。ただし内部制御Toolにも前後Hookが適用されるため、Hooks、notifyその他の設定継承を別途閉じる。非表示Toolの実行入口に残るGapの代替にはならない。

参照: [固定Router](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/core/src/tools/router.rs)、[固定Registry](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/core/src/tools/registry.rs)、[起動時ToolPolicy](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/ext/extension-api/src/tool_policy.rs)。

現在の移行案は、最小の起動Adapterまたは固定CLI変更で正式な起動時許可集合を注入し、禁止Toolの直接呼出しをEffect前に拒否できるか確認することである。通常の公式CLI更新から専用実行物の構築へ広がるため、これを未承認の採用判断とせず、必要な変更範囲と配布・保守費用を人間へ提示する。大きなRust forkの採用、権限緩和、Workbench AIのScope縮小を自己決定しない。

## 人間による範囲拡張の承認

2026-09-30の対話で、最小起動Adapterの追加を含む専用実行物の構築・配布・保守が承認された。助言用System Tool禁止、Repository非共有、暗黙fallback禁止およびcleanup後の結果公開を維持する。承認は局所試験、完成後独立レビュー、新署名または実Provider E2Eの合格を代替せず、Release判断でもない。

次は公式固定Sourceの起動時許可集合を利用する最小接続を具体化する。通常Executor／Reviewerの成立済み能力と助言専用の制限を分け、設定やモデル出力で制限を解除できない構成を確認する。

### 起動制限の具体化

追加の読み取り専門確認では、専用Driverで認証・通知・取消を再実装するより、公式CLIの既存経路を保持する狭い固定Patchが推奨された。既存Policyの許可集合との交差、他の制約の維持、助言専用の配線、Hookの別途禁止およびHostの終了観測を着手条件とした。これは完成後の独立レビューまたは実境界合格ではない。

`40_Develop/coordinator/runtime/codex-advice-startup.patch`を候補として追加した。追加確認で、Thread Managerから明示Policyを先行挿入すると暗黙のGuardian制限を飛ばすFinding 1を検出したため、Sessionが元のPolicyを解決した直後へ適用点を移した。Guardian fallbackを再実装せず、その結果を含む既存Policyと公式定数の`exec`／`wait`だけとの交差を取る。追加権限引数を公開せず、既存の厳しいPolicyも緩めない。通常Executor／Reviewerの実行物や現在のProduction配線はまだ変更していない。

| 確認対象 | 結果・Identity |
|---|---|
| 公式Source Commit | `ff6aec96948b70d94983af2641a6b67c94faeff5`。annotated tagの参照先を公開GitHub APIで確認した。 |
| Source Archive | 16,568,088 Bytes、SHA-256 `b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`。取得のみでBuildは未実施。 |
| 対象File | `codex-rs/core/src/session/session.rs`、変更前SHA-256 `de7eca05b55865c0ef03465a29bfb51e54d1eb78d253533d8b76e88712172f2d`。公開固定Commitから取得した実Byte列と一致した。 |
| Patch | SHA-256 `1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb`、追加17行・削除1行。 |
| 適用確認 | 検証したFileに対する`git apply --check`はExit 0。構文上適用可能であることだけを示し、Rust型検査や実行禁止の成立証明ではない。 |
| 現在候補の配布観測 | `candidate / platform_provisioner_distribution_observed`。新Patchを含む現在候補の観測であり、新署名ではない。 |
| 必要toolchain | 固定SourceはRust `1.95.0`を要求する。現在Hostの`rustc`／Cargoは`1.94.1`であり、異なるtoolchainでBuild済みとは表示しない。 |

次は固定Build環境と供給元検証を閉じ、実際のRegistryで直接／Nestedの禁止Tool、namespace、既存制約、再開／forkを反証する。その後にHost lifecycle、署名と元の失敗助言経路を確認する。既存の局所試験やパッチ適用確認を新モデルE2Eへ算入しない。

### 開発用Builderの具体化

Guardian制限を維持する是正後の読み取り再確認ではFinding 1が解消し、Builder実装へ着手可能とされた。完成後の独立レビュー、型検査または実境界合格を意味しない。

開発用`codex-advice-builder.Dockerfile`とTypeScriptの`prepare-codex-advice-build.ts`を追加した。入力Contextは検証済みの公開Source Archive、起動制限Patch、Dockerfileおよび入力Manifestだけである。Repository本文、Provider Home、認証情報をBuilderへMountしない。出力はRepository-local一時領域へ保持し、Runtimeへ自動採用しない。

Rust 1.95.0のlinux/amd64 imageをDigestで固定し、公式と同じmusl Targetを維持する。公式固定SourceのOpenSSL／libcap手順とV8 150.4.0の署名対象Checksum Manifestを使用する。V8 ManifestのHashと二つのPayload Hashを検証し、Cargo Lockを維持する。bwrapはstrip後のHashをCLIへ埋め込む。OS Package取得は完全固定ではないため、実際のPackage一覧を出力へ記録し、全依存のByte再現性が成立したとは主張しない。

準備ScriptのFormatter、Lint、strict型検査が成功した。実際の固定Archive／PatchのHash検証と新規Context作成はExit 0だった。これはBuild入力準備の成功であり、専用CLIのCompile、起動禁止保証、供給元信頼検証、新署名またはE2E合格ではない。新たなBuilder候補を読み取り確認へ渡し、Build自体はその結果を待っている。

Builderの着手前確認で、公式`GITHUB_ENV`形式を`source`すると空白入り`CMAKE_ARGS`がCommandとして解釈されるFinding 1を検出した。固定Keyの許可集合を検証し、各`key=value`を`env`の一つの引数へ保持する方式へ是正した。空白、追加`=`、ハイフン入りKey、未知Key、不正行および`$()`の非実行をBuild内の局所反証に含めた。是正後の読み取り再確認は新規Finding 0で、局所Buildへ着手可能とされた。

linux/amd64を明示し、ContextはCoordinator保守担当が7日を上限に評価する。清掃はexact Context、Build非稼働、未解決成果物参照なしおよび終了後不存在を条件とし、期限だけで自動削除しない。共有Docker Build Cacheをこの処理の所有資源と誤認して一括削除しない。固定候補の局所Buildを開始したが、現時点では依存取得・Build進行中であり、専用CLI成功結果は未取得である。Runtimeの採用、新モデルの実Provider実行および新署名は発行していない。

初回BuildではRust 1.95.0、Source／Patch／対象FileおよびV8 Manifest／二つのPayloadのHash検証が成功した。OpenSSL／libcapもBuildできたが、Cargo開始前に環境Keyの許可集合で停止した。固定ScriptはTargetのハイフンをアンダースコアへ変換するため、`CC_x86_64_unknown_linux_musl`等が正しい。対象4 Keyを実Scriptと再照合して是正し、拒否時にはKeyだけを診断する。値を実行したり、任意のKeyへ許可集合を広げたりしない。入力Manifestの保持期限変更だけで重い依存Buildをやり直さないよう、ManifestのCopyはCompile後へ移した。これは失敗箇所の局所是正であり、初回Buildを成功へ読み替えない。

二回目のBuildでは環境搬送の局所反証を越えてCargoへ到達したが、`--locked`がWorkspace版の更新を拒否した。固定Sourceの`Cargo.toml`は0.159.2で、`Cargo.lock`の内部Packageは0.0.0だった。公式固定Workflowは「Release tagはLockfileを更新せずCargo.tomlだけを変更する」と明記し、`cargo update --workspace`を実行している。候補Builderもこの更新を行うが、生成Lockの版番号0.159.2を0.0.0へ戻したByte列が元のLockと完全一致する場合だけCompileへ進む。Checksum、Git Revision、Package集合、依存関係等が変われば停止する。元と解決後のLockおよびHashは成果物側へ保持し、その後のCompileは`--locked`のままとする。外部依存の更新を無条件に許可する修正ではない。

三回目のBuildでは、Lock解決後の外部Package Block比較と全体正規化比較がともに成功した。変更は内部159 Packageの版番号だけで、外部依存の変更はなかった。正常Fixtureに加え、外部版番号、Checksum、Git参照、Package削除、依存追加およびPackage追加の六つの変更を拒否した。その後のbwrap Compileは`linux/sched.h`／`linux/loop.h`の欠落で停止した。公式Workflowが用いるZigを省いたため、公式Scriptのmusl-gcc fallbackへ進んだことが原因だった。

固定公式手順と同じZig 0.14.0を追加し、公式ArchiveのSHA-256 `473ec26806133cf4d1918caf1a410f8403a13d979726a9045b421b685031a982`と実行版を検証してから使用する候補へ是正した。glibc Headerの手動混在やTarget変更では解消しない。Zig使用時に公式Scriptが出力する四つのsysroot Keyだけを環境搬送の許可集合へ追加した。準備ScriptのFormatter／Lint／strict型検査は成功し、新しい入力Contextで四回目のBuildを開始した。現時点でCompile成功、禁止Tool拒否、新モデルE2Eまたは新署名の合格は主張しない。

四回目のBuild `i0frkylyg8soyf5skdf4kd11i`は終了コード0で完了した。CLIのrelease Compileは30分40秒で終了し、成果物出力も完了した。出力されたHash一覧では助言専用CLIが`be1b52e8a6dff97136418da39363029f2a84c4f1beceeddd876395bbb3ba71e8`、bwrapが`b005e748d5887a65eb4cd99bd8ad4a3b66e66c4a656137fe067d3da2e897df51`である。実体との独立照合、起動・拒否試験、Runtime採用および新署名は未完了であり、Build成功を実Provider E2Eの合格へ読み替えない。Builder準備ScriptのFormatter／Lint／strict型検査とGit差分の空白検査は成功した。

### 起動制限の局所反証計画

成功したBuild成果物の実体HashをHost上で再計算し、出力一覧との一致を確認した。Native試験専用stageをProduction成果物の固定後へ追加した。試験Patchは固定Sourceの二つのFile Hashを照合した後にだけ適用し、試験用SourceをRuntime実行物へ含めない。初回試験Buildは、contextなしの試験Patchに対して通常の`git apply`を使用したため、適用前に終了コード1で停止した。固定File Hash照合を維持したまま`--unidiff-zero`へ是正し、新しいexact Contextで再開した。Sourceおよび試験PatchのHash照合、Patch適用とRustfmt確認を通過し、現在はNative試験用のCompile中である。既存Production CompileはDocker Cacheから再利用され、実Provider依頼や新署名は発行していない。

次のNative試験について読み取り着手前確認を行った。既存の`make_session_and_context`はSessionを直接組み立て、Policyを既定値へ設定するため、Production起動Patchの成立根拠として使用しない。実際に`Session::new`へ入る`make_session_with_config_and_rx`をtest-onlyで拡張し、既存試験は既定値で委譲して維持する。固定Runtime Patch自体は変更しない。

実Sessionが捕捉したPolicyから公式Registryを構成し、trusted／external／prependの全登録入口、直接呼出しとCode Mode由来の呼出しを確認する。shell、patch、MCP、web、permissions、agent、質問／メッセージ、clockおよび未知名について、plain・空・既定・別namespaceを処置する。拒否結果だけでなく、無害なHandlerの到達カウンタ0を確認する。exec／waitの正常到達、既存Policyの空集合・片側のみ・別namespaceのみ・追加制約、Guardian fallbackとの交差および捕捉後の変更による緩和不能も反証する。

是正後の読み取り着手前確認は追加Build可能と判定した。Native試験Buildは`bfepescy40lekwl0wkm681ro9`、試験Patch Hashは`7df73f7e5c2db0680e43a77faf786656b60eaf42460ac3c97daffcfe79bc868f`、Builder Hashは`badceac8373be09f9019bf30f8c476d1de0bff15d782c8a9015ca1445b0082ce`である。DockerのBuild履歴から稼働中を確認した。準備ScriptのFormatter、Warningを失敗とするLint、Coordinatorのstrict型検査およびGit差分の空白検査は成功した。Native試験結果はまだ取得していない。

ProviderへのTurn送信は行わず、offline model、試験認証、専用の空HomeとDisabled Code Mode Providerを使用する。Sessionは成功・失敗の両経路で終了させる。この試験はRegistryへの配送境界を扱い、実HostのJS→IPC→Router、Host取消、Process回収または署名E2Eを代替しない。現時点では計画確認であり、追加Native試験のCompile／実行は未実施である。

### 公式配布物の署名確認

Code Mode HostのGitHub Attestation取得はHTTP 404だった。Attestation未取得を署名不正または署名確認済みへ読み替えず、付属のSigstore Bundleを検証した。[公式検証手順](https://docs.sigstore.dev/cosign/verifying/verify/)に従い、公式Cosign v2.4.3を公開Releaseから取得した。検証ToolのSHA-256は`a2ac24e197111c9430cb2a98f10a641164381afb83df036504868e4ea5720800`で、同じ公式ReleaseのChecksumと一致した。Tool自体の取得根拠は公式HTTPS配布とChecksum一致であり、これを独立したTool署名検証と表現しない。

`verify-blob`には付属Bundle、exact Certificate Identity `https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.159.2`およびOIDC issuer `https://token.actions.githubusercontent.com`を必須条件として指定した。公式Codex CLIの実体Hash `1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e`、Code Mode Hostの実体Hash `5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03`の双方が、終了コード0と`Verified OK`を返した。署名検証省略のFlag、任意Identityの正規表現または透明性ログ確認を無視するFlagは使用していない。公開Sigstore Rootの取得に内部Contextを含めず、Cacheを無効化しRootのPathもRepository-local一時領域へ限定した。この結果は公式配布物だけに適用し、Patch適用後の専用CLIへ公式署名が残るとは主張しない。

Native試験Build `bfepescy40lekwl0wkm681ro9`は終了コード101で停止した。Compilerは試験moduleのglob import経由の`assert_eq`と標準macroの衝突だけを7箇所で報告した。試験moduleで標準macroを明示importし、Production Patch、PolicyまたはOracleは変更していない。新しい試験Patch Hashは`35a050c4ab6df76a07dfdff4696f3fd462a34f65911bf5f8d58d3f235f9e855e`である。準備ScriptのFormatter・Lint・strict型検査と固定SourceへのPatch適用確認を再実行して成功し、新しいexact Contextで再開した。旧Buildの失敗を合格へ補正していない。

再開したNative試験Buildは`h8tk6mazovkpwiw89gedvpr6i`、Builder Hashは`ce5ec929eac8a68949a50b6c477476dafc131d5a2c355ff8e3e8acd0d01b217b`であり、Docker履歴と同じProcess handleから稼働中を確認した。署名検証用の公開実行物とToolはRepository-local一時領域`codex-01592-attestation`へ限定し、Coordinator保守担当が2026-10-07までに保持要否を評価する。清掃は検証Processの終了、未解決参照なし、exact実体の確認と終了後不存在観測を条件とし、共有Cacheまたは名前だけを根拠にした削除は行わない。

Native試験候補の着手前確認では、二重Arcによる型不一致、無期限待機および終了後不存在の観測不足を検出した。候補は既存Arcをそのまま使用し、試験Workerの待機・取消後join・Session shutdownに期限を設け、正常・panic・意図的待機超過で終了経路を確認する構成へ是正中である。Sessionのhook受信口の閉鎖を観測し、直接観測しないProcess／Listenerの不存在は局所試験の成立主張から分離する。完成後の独立レビューまたはNative試験Passではない。

### Native試験の実行時異常

Build `h8tk6mazovkpwiw89gedvpr6i`は終了コード101で終了した。Rustのrelease試験Compileは19分20秒で完了したが、試験実行物は`crdd_advice_startup_ceiling`の実行開始時にsignal 11（SIGSEGV）で停止した。取得した出力には個別試験の開始・結果がなく、試験内の異常か、試験実行物の起動・初期化の異常かはまだ特定できない。Compile成功を起動制限の合格へ読み替えず、`ERB-IT-024`を未観測として維持する。原因切分け後に再実行し、Runtime採用・新署名・実Provider送信はそれまで進めない。

Quality DefinitionのLocal Itemを重複排除して数え、170件を確認した。Quality Integration、Quality Center、現行実装照合およびProject Contextの現在投影へ追加項目を反映した。v0.22対象は40件、観測済み11件・未観測29件であり、試験実行の失敗を未観測件数から除外していない。過去の固定Evidenceの測定件数は変更しない。

反映後のRepository CheckerはError 1・Warning 0だった。残るErrorは`stable-release-tag-identity-mismatch`で、公開済みv0.21.0 tagとv0.22作業HEADの不一致である。新規項目に伴う台帳・件数・Relationの4件は解消したが、全検査Passとは表示しない。タグの移動やCheckerの弱化は行わない。

原因切分け用BuilderはCompileを`--no-run`で独立したstageに固定し、後続stageで同じ試験実行物の`--list`、選択試験の順に実行する。試験一覧表示では試験本体を実行しないため、一覧表示前の異常と試験本体の異常を分離できる。Compile済みstageは後続診断で再利用する。新しいContextは`.crdd/tmp/codex-advice-build-892Si5`、Builder Hashは`b5022200d1ef58019b79dae4714b5df37f300a5d4d62af3c1351719070a17c9d`で、保持期限は2026-10-07T13:23:35.182Zである。現時点ではCompile中であり、原因確定または試験合格は未主張である。

分離後の準備ScriptについてFormatter、Warningを失敗とするLint、Coordinator strict型検査およびGit差分の空白検査が終了コード0だった。診断Buildの同じProcess handleを再確認し、固定Sourceの試験依存と`core_test_support`のCompileまで進行している。静的確認をNative起動・試験実行の成功へ流用しない。

追加確認で、`build-inputs.json`のCopyがNative試験stageの親にも含まれ、保持期限の変更だけで試験Compile Cacheが無効になる配置を見つけた。現在のBuild Contextは変更せず、次候補では同ManifestのCopyをProduction／試験のscratch成果物stageへ移した。Source・Patch・toolchain・試験条件はCompile入力として維持し、Manifestは成果物へ同梱する。記録の時刻変更とCompileの意味変更を分離する是正であり、実行中候補のBuilder Hashや検証結果を上書きしない。

### 実Host試験の着手前確認

独立した読み取り確認と固定Sourceの再照合により、Native Registry試験と実Host接続試験は分離して評価する。実Host試験の最小経路は、実`Session::new`、`capture_step_context`、Tool Router、Code Mode Handler／Service、公式Hostのstdio、Broker、実Registryである。Provider Turnは開始せず、この試験だけで公開CLIの助言E2Eを主張しない。

| 確認対象 | 実行・観測する内容 | 合格へ読み替えないもの |
|---|---|---|
| 正常 | 検証済みexact Host実体、実`exec`での内部計算、通知と結果帰還 | HostのFile存在確認だけ |
| 継続 | `store/load`、pending Cellのyield、実`wait`とexact Cellのterminate | preempt要求だけ。固定stdio試験はpreempt後もCellが継続することを示す |
| 禁止 | 通常のTool非公開と、試験限定の不正なTool定義を実Hostへ搬送した場合のBroker／Router拒否・Handler到達0 | dispatch待機の停止や別Guardの拒否 |
| JS境界 | `require`、`process`、動的import等の拒否 | Registry試験だけによるJS隔離主張 |
| 終了 | Cell終了、exact Host PID／generationの回収、stdio終了、reader／writer／driver／dispatch Worker終了を期限付きで観測 | Session shutdown、ConnectionのDrop、cancel要求またはPID不存在だけ |

固定Sourceの`ConnectionSupervisor::run`は取消後にHostのkill／waitへ進むが、reader／writer／driverのJoinHandleは別の所有資源である。`Connection::Drop`はcancelを発行するだけであり、Session shutdown後にも共有Host参照が残り得る。試験限定の観測は実所有者の終了地点へ接続し、全参照解放と各Worker終了を確認する。単に終了通知を新設して成功を返す代替実装は使わない。通常Executor／Reviewer、Production Policy、Tool許可集合およびHost受理条件は変更禁止とする。これは着手前確認であり、実Host実行または完成後レビューの合格ではない。

Native起動異常の調査では、固定Sourceの`core/tests/common/lib.rs`に試験開始前の三つのconstructorがあり、その一つが`codex_arg0::arg0_dispatch`を呼ぶことを確認した。同関数は`std::env::args_os`等とProcess補助初期化を使う。起動初期化は切分け対象であるが、現時点ではSIGSEGVとの因果を証明していない。constructorの削除、検証条件の弱化、Target変更またはProduction Patch変更を、原因確認なしに行わない。

一覧表示で異常が再現した場合の診断候補は、Repository-local `.crdd/tmp/codex-advice-native-diagnostic-20260930.Dockerfile`（SHA-256 `375db0f6f6fe6c176885b5920a6058258522ed8cf455b5569f63b4ba8c8ca0b8`）に保持した。実行中Contextの固定Dockerfileを基礎に、同じCompile済みstageからGDBによる`run --list`と最大20 frameのbacktraceだけを取得する。引数・ローカル変数・生Provider出力は表示せず、Debuggerの版と実体Hashを結果へ保持する。GDBは診断stageだけの依存で、Runtime配布物へ含めない。診断成功を試験Passにせず、Production実行物のHashが変わらないことも確認する。現在Buildがterminalになるまで追加Buildを開始しない。診断候補もCoordinator保守担当が2026-10-07までに保持要否を評価し、由来・未解決参照・非稼働・終了後不存在の確認なしに削除しない。

### 起動異常の切分け結果

分離したBuild `f26fvabfailsesxi6w6f05bon`は試験Compileを18分51秒で完了し、Production CLI／bwrapのHash再照合も成功した。後続の`--list`は0.8秒以内にSIGSEGV・終了コード139で停止したため、選択試験本体には到達していない。

同じCompile済みstageをCacheから再利用した診断Build `j2neqg6l3qpfrtzjn4ygi8st3`のbacktraceは、muslの`_start_c`（`dlstart.c:141`）から`_start`だけを示した。Rust試験や試験constructor以前の起動ローダー境界であり、constructor原因仮説を修正する。診断Toolの自動Script読込みは安全な既定値で拒否されたままとし、拒否を解除していない。GDBの終了コード0は診断出力取得だけを意味し、試験Passではない。

ELF診断Build `qn1rkbk19mq0p92c1lx346aul`では、試験実行物だけでなく、助言専用CLIとbwrapの`--version`も終了コード139だった。三つともPIEだが`PT_INTERP`として`/lib/ld-musl-x86_64.so.1`を保持していた。Production成果物のHashは以前の一覧と一致するが、実行可能な成果物としては不成立であり、採用・配布・署名へ進めない。

重い再Compileの前に、同じRust 1.95.0と`x86_64-unknown-linux-musl`で、固定文字列を出すだけの最小測定を行った。C/C++依存やProviderを使わず、Rust最終linkerと再配置条件だけを比較した。Build `wnsw3mdurniwqj8afhviz3vew`の結果は次のとおりである。

| Rust最終linker／条件 | 終了コード | 観測 |
|---|---:|---|
| `/usr/bin/x86_64-linux-musl-gcc`、既定 | 139 | 起動失敗を再現した |
| 同linker、`link-arg=-static`だけ | 139 | 単純なFlag追加では解消しなかった |
| `/usr/bin/gcc`、既定 | 0 | main到達。PIEを維持し`PT_INTERP`なし |
| musl-gcc、静的再配置と`-static` | 0 | main到達。ただしPIEではなくなるため採用しない |

修正案は、固定musl Target、Rust、Production PatchとOracleを維持し、Rust最終linkerだけを固定GCCへ変更することである。OpenSSL／libcapとC/C++依存のmusl／Zig設定は変更しない。成果物ではPIE、外部Interpreterなし、共有Library依存なし、`--version`成功を確認し、bwrap起動を重いCodex Compile前のGateへ置く。最小測定の成功をProduction実行物またはNative試験の合格へ流用しない。固定Sourceと実測結果を独立した読み取り確認へ渡し、是正前の整合を確認中である。

診断候補は追加した比較条件を含めSHA-256 `fa85779347a5ef418c5465d64cd3432e423e0fcab51a960d9d20b70ae4b495fa`となった。以前の候補Hashは履歴として保持する。最小測定Sourceと各出力は同じRepository-local Contextの`link-comparison-artifacts`へ保持し、既述のOwner・保持期限・cleanup条件を適用する。Provider送信、Repository共有、Docker Desktop再起動または永続Dockerデータ削除は発行していない。

### Rust最終リンクの局所是正

読み取り専用の独立した着手前確認は、Rust最終linkerだけをGCCへ変更する案を実施可能と判定した。ただし、実成果物のPIE、Interpreter／共有Library依存なし、実行不可Stack、Rust musl起動コード・libcのリンク元、および期限付き起動の観測を条件とする。完成後の独立レビューではない。

最小測定Build `mbdch0po3qqhmwnm7p3hst9y4`では、GCCを使ってもRust sysrootのmusl `rcrt1.o`と`libc.a`が実際のリンク入力になることをLink Mapで確認し、mainへ到達した。続くBuild `4m3rnup268go4gfwi9jfycwqn`はELF検査、muslリンク元確認、およびHost側の`Scrt1.o`、`crti.o`、`libc.a`を混入させた3反例の拒否を終了コード0で完了した。出力は既存exact Contextの`link-map-artifacts`／`link-guard-artifacts`へ保持し、以前に定めたOwner・保持期限・清掃条件を適用する。この結果は最小測定だけであり、専用CLIやNative試験の合格ではない。

Builderは元の環境Keyと値を照合してからRust linkerだけを変更し、C/C++、Zig、OpenSSL、libcapの設定を保持する。GCC版・実体Hash・変更前後の値を成果物へ記録し、bwrapとCLIのLink MapとELF検査結果を保存する。bwrapの期限付き`--version`を重いCLI Compile前に置き、CLI起動が成功しなければ成果物を公開しない。Native試験実行物にも同じlinker、ELF検査と期限付き一覧表示を適用する。Nativeのリンク元直接観測および実Host試験はまだ未完了である。

最初の是正候補Build `lhaaptozozqjynve15lmhgruj`は、`cargo rustc`が仮想Workspaceではなく具体的Packageを要求するためCompile前に終了コード101で停止した。固定SourceのCargo Manifestを確認し、bwrapとCLIのexact Manifest Pathを明示して是正した。Formatter、Warningを失敗とするLint、Coordinator strict型検査と差分空白検査は成功した。

再開候補は`.crdd/tmp/codex-advice-build-233OGW`、Builder SHA-256 `b446962015e2300076daa2799c232d4b6eace5ce1bd182f04f422099800f3ee7`、保持期限2026-10-07T14:07:52.804Zである。現在は同じBuild Processから進行を観測している。Runtime採用、署名、Provider依頼、Docker Desktop再起動または永続Dockerデータ削除は行っていない。

2026-09-30 14:13 UTCに同じBuild履歴`r07cobey7feysdb1xob1iz1fl`の稼働を再確認した。bwrapは5.46秒でCompileを完了し、Link MapのRust musl起動コード・libc確認、ELF検査および期限付き`--version`を通過して次のCLI Compileへ到達した。起動確認が失敗すれば後続Compileへ進まない構造であり、以前のbwrap起動失敗を実成果物で越えた局所根拠となる。CLI Compileはまだ稼働中で、CLI起動、Native試験または実Providerの合格へ読み替えない。

### Native試験のリンク元観測候補

試験stageだけに`codex-advice-native-linker.sh`を追加する案を独立した読み取り確認へ渡し、実施可能との回答を得た。引数配列を再分割せず、`-o`をちょうど一つ要求し、出力親の実体を固定Targetの`release/deps`へ照合する。安全な一段下の出力名だけを受理し、symlink、既存map、並行・再試行の上書きと元引数の別map指定を拒否する。実試験binary名のmap、記録した出力の実体およびmapの`OUTPUT`宣言を照合してから、Rust musl起動コード・libc、ELFとHashへ接続する。Source／Policy／OracleやC/C++設定は変更しない。

候補をBuilderと準備Scriptへ具体化し、Formatter・型・Lintと空白検査は成功した。具体化後の読み取り再照合とwrapperの実argv・衝突・拒否反証は未完了である。稼働中のProduction Contextは変更せず、同Build終了後に別の固定Contextで実施する。linker設定変更に伴うCargo再Compile量は未観測であり、再Compileしないとは主張しない。これは試験観測の候補で、Native試験合格または独立レビューPassではない。

具体化後の読み取り確認は、GCC response file、`-Xlinker`および`-Wl`経由の出力変更が検査した`-o`を迂回し得るFinding 1を検出した。未対応のresponse fileと`-Xlinker`を拒否し、`-Wl`のcomma区切り要素から出力・mapの変更指定を拒否する候補へ是正した。実Cargoが未対応形式を必要とする場合も黙って許可せず、局所観測と解析契約へ戻す。修正後の反証と再照合はまだ未実施である。

是正後の読み取り再照合は新規Finding 0・着手前具体化確認Passとなった。局所実行のPassではない。診断候補へ通常の最小Rust linkとmain到達、別出力・別map・response file・`-Xlinker`・重複出力の8反例、および親範囲外・記録衝突・出力欠落・symlink出力の拒否を追加した。稼働中Production Buildの入力は変更せず、同Build終了後に局所実行する。

現在候補のCoordinator全体`npm run check`は終了コード0だった。Formatter、実装・試験の型検査、Warningを失敗とするLint、Runtime能力Graph、Coordinator Runtime TraceabilityおよびProject Runtime設計Traceabilityを確認した。その後に`npm run test:portable`を開始した。まだ稼働中であり、完了件数や全回帰Passは主張しない。ProductionのRust Compileでは固定公式Sourceの未使用import・不要mut警告が出ており、CRDDのTypeScript静的検査成功と外部Sourceの警告を混同しない。外部Sourceへ無関係な修正Patchは追加しない。

### AI Profile管理の回帰結果

現在の未Commit候補に対し、`40_Develop/ai-runtime`で`npm test`を実行した。Formatter、型検査、Warningを失敗とするLintの順に成功した後、Catalogと耐久Storeの試験13件が成功し、失敗・取消・skipは0、全体終了コード0だった。試験実行時間は約1.38秒である。同梱JSONの不変投影、未知Model／Property・重複・秘密値の拒否、欠落／構文・Schema不正時のModule停止、改訂競合、削除確認、Repository単体とCROSの別Owner保存、およびCoordinator／Workbenchの同じProfile解決を確認した。新モデルのProvider実行、Code Mode Hostまたは署名Runtimeの成立を示す結果ではない。

実行時点は2026-09-30 14:10 UTC、結果再確認は14:11 UTCである。未Commit入力のSHA-256は次のとおりで、試験前後で対象を編集していない。完全な標準出力は同じ実行Toolの結果に保持される。再実行は上記packageで同じ`npm test`を使用する。

| 対象 | SHA-256 |
|---|---|
| `src/catalog.ts` | `8dd61ec09cb3de70e6505e2c4b0e47903521bde2ddf62ae6bcad874ca1dc1d7c` |
| `src/default-ai-profile-catalog.json` | `cc6b90aeaa23cd9790585bfa062111acb06844366551347bcbbbc49f257a3977` |
| `tests/ai-profile-catalog.contract.test.ts` | `5113eab3d82d8f7bab1195eb87ffb7e750113b5b904be688364e136c84f97828` |
| `tests/integration/ai-profile-catalog-store.integration.test.ts` | `5546cf96fbafccfa1aff626595b477951042ee6ebdbf383f50e866954a540eef` |

### Production起動とNativeリンク処理の局所結果

Production Build `r07cobey7feysdb1xob1iz1fl`は終了コード0で完了した。CLI Compileは32分04秒で、固定CLIの期限付き`--version`は`codex-cli 0.159.2`、bwrapは`bubblewrap built for Codex`を返した。保存したELFはx86_64／ELF64／PIE、外部Interpreterなし、共有Library依存なし、実行不可Stackである。Link MapはRust sysrootのmusl起動コードとlibcを使用している。Hostで再計算したCLI SHA-256は`0008fff7d6bab9e2e0732e82f95f12b3237832361cab89ee61557f6df3f4b197`、bwrapは`07bc720e15a730d717e81b42acb3b95049803360738115c6f6c59830accef7c2`で、Buildの記録値と一致した。これは起動と成果物構造の結果であり、Tool制限、Host境界または実Providerの合格ではない。

局所Build `w1wvw2tde04nobs2ek9gpym9i`も終了コード0で完了した。Native linker wrapperは最小Rust入力のmain到達と出力／mapの結合を確認し、8形式の引数迂回、親範囲外、衝突、出力欠落およびsymlink出力を拒否した。衝突反例で表示された上書き拒否は意図した結果である。wrapper SHA-256は`5bd52ebdb3b5666ca7d4663b9da9ea5b5a466d485fca1ace60585b7d6686e9cc`だった。旧exact Context内の`native-linker-wrapper-artifacts`へ保存し、既述の保持・清掃条件を適用する。

その後、現候補から新しいContext `.crdd/tmp/codex-advice-build-NQThQl`を準備した。Builder SHA-256は`036342a91de5673c3c177801e074a24001a02d5ce245d2ee9388a1c8c1d596f3`、保持期限は2026-10-07T14:42:30.980Zである。同ContextからNative起動試験の構築を開始した。Production Compile stageはこの実行ではCacheとして再利用されず、依存取得から進行している。再Compile量を未観測のまま軽量と表示しない。Coordinator portable回帰も同じ実行で継続中であり、まだ最終結果はない。Runtime採用、署名、Provider送信やDocker再起動は行っていない。

### 実Host終了観測の接続箇所

固定Sourceの再照合では、`Connection::establish`がreader、writer、driverおよびsupervisorをそれぞれTaskとして生成する。writerは待機中・書込み中とも取消を選択でき、readerは読取り待機を取消できるが、受信済み通知のchannel送信は別の待機箇所である。supervisorはHostをkill／waitした後、残るTaskのJoinを明示的に待たず終了する。これらは終了観測を設けるべき箇所であり、Source上の構造だけから残存または回収成功を断定しない。

`DelegateRuntime::start`はdelegate本体と結果搬送を別Taskとして生成する。取消ではdelegateへ取消Tokenを渡す一方、結果搬送の`completion_stop`を解除して遅延結果を送らない構造になっている。搬送Taskが終了してもdelegate本体が終了したとは限らない。実Host試験では、実所有箇所へ試験限定の観測を接続し、delegate本体、結果搬送、接続TaskとHost processを別々に確認する。結果非搬送、取消要求またはHost PID不存在を全資源回収の代替根拠にしない。この照合は試験設計の具体化であり、Production変更や実Host試験Passではない。

### MCP利用側の回帰結果

同じ未Commit候補に対し、`40_Develop/mcp`で`npm test`を実行した。Formatter、型検査およびWarningを失敗とするLintの後、46件が成功し、失敗・取消・skip・todoは0、終了コード0だった。試験時間は7191.0078msである。Project Context、Topic／Meeting、CROSの許可済みOwner配送、Shared Server公開入口、stdio／HTTPの入力拒否と終了・取消、公開結果DTOおよびRecovery相関を確認した。外部Provider送信を伴わないローカル試験であり、新モデル助言、Code Mode Hostまたは署名E2Eの合格へ算入しない。実行したpackage.jsonのSHA-256は`3a17a0f099622c1d0e5b3232a08b593678993812f9861ee655f393a902a8cf55`である。

### Workbench現在投影の追随漏れと是正

Workbenchは`npm run check`のFormatter・型・Lint、次に`npm run build`を終了コード0で通過した後、`npm run test:run`を実行した。初回は21件中19成功・2失敗だった。両失敗の実値は正本の未観測`29 / 40`であり、試験が旧`28 / 39`を期待していた。正本・実装・未観測扱いは変更せず、二つの期待値を現在正本へ一致させた。

静的検査後の再実行は20成功・1失敗だった。残る失敗は次Gateの旧文言の正規表現であり、実値はQuality Centerの現在文言と一致していた。現在文言の完全一致へ更新し、検査を緩めて通過させず、再度静的検査を通して全21件を再実行中である。変更対象は`project-surface.contract.test.ts`と`workbench-server.contract.test.ts`の三つの期待値だけである。Production Build出力とGit Indexの一致試験は成功している。図・Visual・UX妥当性または実Providerの成立をこのローカル試験だけから主張しない。

最終のWorkbenchローカル再実行は21件成功、失敗・取消・skip・todoは0、終了コード0、試験時間47394.44msだった。未観測件数と次Gateを正本どおりに投影する二経路を含めて成功した。独立レビューおよび署名実Provider検証は別に必要であり、この結果でQualityの観測済み件数を増やしていない。

### Coordinator portable回帰の確定結果

先行したCoordinator全静的検査の成功後、同じ候補の`npm run test:portable`は終了コード0で完了した。tests 2128、suites 2、pass 2120、fail 0、cancelled 0、skipped 8、todo 0、duration 1716828.8929msだった。明示したHost Windows専用範囲を除くportable実行であり、Host Windows実境界、署名固定Snapshot、実Providerおよび新しい外部CLIのNative試験はこの結果だけで成立しない。skip 8件は未実施として保持し、Quality観測済みへ算入しない。出力ではSource AにRelease manifestを保持しないためManifest-only Commit Bで実行すべき固定Snapshot試験のskipも明示されている。全実環境Profileの合格とは表示しない。

### CROS利用側の回帰結果

`40_Develop/cros`の`npm test`はFormatter・型検査・Warningを失敗とするLintの後、33件成功、失敗・取消・skip・todoは0、終了コード0、試験時間4836.8074msだった。Credential発行・失効・ローテーション、競合時の非公開、Host回復計画、許可済みRepositoryのFederation、Shared Server設定、Remote AI Profile管理、Session切断後のGrant失効と同じIdentityでの再入場を確認した。外部ProviderやDocker再起動を発行せず、署名実Provider E2Eの代替としない。

### Windows実子プロセスの局所回帰

Coordinatorの同じ静的検査済み候補から、`--test-name-pattern=^Host Windows: (本番共通process:|Task→Controller→共有Processの取消結合:|取消結合:)`で三つの既存試験Fileを実行した。9件成功、失敗・取消・skip・todoは0、終了コード0、試験時間4183.9597msだった。実子プロセスのUTF-8標準入力、正常／非0終了、待機期限と取消の区別、重複取消、stdout／stderr制限、起動失敗、実子孫終了とclose、およびTask／Controllerまでの取消搬送を確認した。Docker cleanupはtrue／falseの模擬結果であり、実Docker資源回収ではない。

選択しなかった`Host Windows: Codex Executor SandboxはWorkspaceだけを書込み可能にする`は実Docker Containerを発行するため、別の実境界試験として残す。今回9件の成功を`test:host-windows`全体、実Docker Sandbox、Code Mode Hostまたは署名E2Eの合格へ読み替えない。

### Project Operation利用側の回帰結果

`40_Develop/project-operation`の`npm test`はFormatter・型検査・Warningを失敗とするLintの後、19件成功、失敗・取消・skip・todoは0、終了コード0、試験時間1146.7293msだった。五場面・Release・Qualityの正本読取り、欠測の拒否、Topic／Meetingの登録・編集・一覧・検索・Cursor分割、Relation解決、CHG昇格、Outcome移管、未処置Outcomeを残したClose拒否、および明示確認前の削除拒否を確認した。現在正本を変更せず、実Provider E2Eや人間の作業導線評価へ算入しない。

Native検証Buildは履歴`oq8c9bsnw2rwwytxlvv9mzcpk`、開始2026-09-30T14:42:49.330648014Zとして同じ実行の稼働を確認した。Quality Centerの原因切分け中という旧説明だけを、CLI起動確認済み・Native試験構築中へ更新し、未観測`29 / 40`と次Gateは維持した。

### Version Control利用側の回帰と閉包是正

`40_Develop/version-control`の初回`npm test`は静的検査後、45件中44件成功・1件失敗だった。新しい`prepare-codex-advice-build.ts`がRepository Locationの既知Consumer集合へ未登録だったためであり、実際のRoot検証を迂回した失敗ではない。Scriptが公開Portでexact Rootを検証し、Runtime Data経由で同Root直下の`.crdd/tmp`へ新規Contextだけを作成することを確認した。ArchitectureのConsumer表と全数一致試験の期待集合に同Scriptを追加し、検査を弱めず対応した。

是正後はFormatter・型・Warningを失敗とするLintを再実行し、全45件成功、失敗・取消・skip・todoは0、終了コード0、試験時間25977.6607msだった。公開試験は試験専用のローカルbare RepositoryへのPushであり、CRDDの外部RemoteへCommit／Pushしていない。この結果をNative Tool制限、実Code Mode Host、署名または実Provider E2Eの合格へ算入しない。

### Runtime Dataと署名ライブラリの回帰

Runtime Data初回は36件中35件成功・1件失敗だった。新Build準備ScriptのConsumer登録漏れに加え、領域作成のblocked結果を通常Errorへ落とす実欠落と、Topic探索の固定除外式をRoot所有と扱う誤検出があった。Scriptを既存の`requireReadyRepositoryRuntimeDataArea`へ接続し、Effect状態、cleanup、再試行可否とexact回復参照を保持する。既知Consumer集合へ追加し、Topic Fileの固定探索除外式だけをliteral検査から区別した。同Fileへ別の`.crdd` literalを追加すると引き続き拒否される反証を追加した。raw Root構築の禁止は変更していない。

Formatter差分1件を修正した後、Runtime Dataの静的検査と36件すべてが成功した。失敗・取消・skip・todoは0、終了コード0、試験時間4791.3023msだった。Coordinatorも変更後のFormatter、実装・試験の型検査、Lint、能力閉包と二つの設計トレース検査を再実行し、終了コード0だった。実行中のDocker Build Contextは変更していない。

Artifact Signingは静的検査後、8件成功、失敗・取消・skip・todoは0、終了コード0、試験時間306.7423msだった。鍵参照preflight、一回消費、競合、TTY／EOF／取消を試験fixtureで確認した。実Release鍵とPassphraseを使用せず、Release署名を発行していない。

### 共通Domain・実行知・意味Coverageの回帰

静的検査後、Domain Libraryは39件成功（29233.5908ms）、Execution Intelligenceは56件成功（11818.7595ms）で、いずれも失敗・取消・skip・todoは0、終了コード0だった。Kernel Lockの実Process競合と回復、観測不能、Repository境界、実行事実の保存・公開・鮮度分類を含む。実Providerの成立をこの結果から推定しない。

Semantic Coverage初回は候補採用の意味キー`project-runtime.candidate-adoption`がQA／Symbolに存在する一方、機械抽出元の詳細設計表へ未伝播で、二つの試験が拒否した。同じ候補採用契約は上位Architectureの引渡し表に既にあり、追加要求やAI推測でなく詳細設計のInterface節と意味表へ接続した。現在のPilotは18キー（Coordinator 8、Project Runtime 10）となる。候補採用の実装Symbolと`CPR-IT-006`／`CPR-UT-009`への接続を明示的に確認する。追加後に顕在化したClaude認証の既存Symbol二つの古い期待集合も、現行Relationへ追随した。

最終のSemantic Coverageは全静的検査と16件すべて成功、失敗・取消・skip・todoは0、終了コード0、859.3325msだった。読取り専用Pilot生成も終了コード0。生成Graphで接続可能なことは試験実行・Evidence成立を意味しない。

### Project Runtime・検証Runner・Visual Previewの回帰

Project Runtimeは静的検査後、単体66件（1644.2849ms）と結合5件（212.0729ms）がすべて成功し、失敗・取消・skip・todoは0、終了コード0だった。検証Runnerでは既存のCatalog全数検査が新規試験二つ（Workbench AI Profile Catalog Flow、Workbench Node Dependency Closure）の未登録を検出した。両試験の実在Source、Owner、段階、外部Provider非実行と終了後条件を確認してCatalogへ登録した。再実行は41件成功・人間の計画理解評価1件skip、失敗・取消・todoは0、終了コード0、12011.6747msだった。人間評価を自動Passへ変換しない。

Visual Previewは制限環境で9件成功・所有子ProcessのFallback確認1件失敗（`descendantTerminationRequired`がfalse）だった。原因を本番不具合と断定せず、同じSourceの実Host局所試験を行い1件成功、続いて実Hostで静的検査と全10件成功（12839.9897ms）、失敗・取消・skip・todoは0、終了コード0を確認した。操作対象は試験生成Node子Processとlocalhost Listenerだけであり、Dockerや本番Browserを操作していない。制限環境で全件成功したとは主張しない。実Hostのこの結果も実Browser全画面の再評価ではない。

Official Asset Governanceも静的検査後、11件成功、失敗・取消・skip・todoは0、終了コード0、6362.1104msだった。判断の完全性、同一Revision競合、Effect／cleanup不明時のexact Recovery参照を確認した。公開・収載の本番Effectは発行していない。

### Repository Checkerの再観測

変更後のChecker静的検査は終了コード0。全Repository検査（2026-09-30T15:25:57.639Z）はMarkdown 1156件、リンク18091件、アンカー2057件を確認し、Error 1・Warning 0だった。唯一のErrorは`stable-release-tag-identity-mismatch`で、公式Stable v0.21.0タグと作業中feature HEADの不一致である。公開済みタグを動かさず、検査を弱めず、全Repository Passとは表示しない。今回の追加設計・参照に新しいリンク／アンカーErrorはなかった。Checker全試験は別の実行として進行中であり、完了結果をまだ主張しない。

### Native起動制限試験の完了と残る実Host確認

同じBuild履歴`oq8c9bsnw2rwwytxlvv9mzcpk`は終了コード0で完了した。Native試験Binaryの列挙で2658件を認識し、選択した`crdd_advice_startup_ceiling`一件は成功、失敗0、未選択2657件、試験時間0.45秒だった。意図的なassertion panicを捕捉して終了経路を確認するため、ログ内の`intentional cleanup-path assertion`は試験失敗ではない。Native compileは22分07秒で終了した。完全ログと固定入力はRepository-local `.crdd/tmp/codex-advice-build-NQThQl/startup-artifacts/`へ出力した。これらは生成物でGit管理へ追加せず、既定の保持期限2026-10-07T14:42:30.980Zを維持する。同出力CLIのSHA-256は`3b2a63c6a7c2d291706bfa7ecd4afbbae8a7f1a0f6160bbee1867b691b8d59d1`である。

この結果は実Sessionの起動PolicyとRegistry制限のNative試験であり、実Code Mode Hostの接続・終了、署名済み配布または実Provider E2Eの合格ではない。読み取り専用の着手前確認では、実Hostへの接続経路は成立するが、Host Child、reader／writer／driver／supervisor、stderr drain、delegate本体と結果搬送、Core Workerとdispatchの終了を既存APIだけでは全数観測できないことを確認した。結果搬送の停止やCell閉鎖をdelegate本体終了へ読み替えず、試験Patch限定の観測を追加して反証する。Productionの許可集合を広げない。

### Checker全回帰で検出した不足

Checker全回帰は375件中373件成功・2件失敗、取消・skip・todoは0、終了コード1、434063.1721msだった。失敗は固定NativeリンカーとSource Patchの所有命名契約未登録、および取消回復fixture Helperのヘッダー欠落である。固定リンカーはCargo試験リンクの引数搬送だけで、Runtime実装やBuild orchestrationを所有しないことを規約へ明記した。Checkerはそのexact Pathだけを区別し、任意Shellと別OwnerのPatchを拒否する反証を保持する。回復fixtureは`PRL-ST-004`への責務Headerを追加した。是正後のFormatter、型検査、Warningを失敗とするLintは終了コード0だった。全体成功は局所再試験と独立確認が完了するまで主張しない。

局所再試験は二回とも終了コード1だった。最初の命名判定を通過して、追加44件の不整合が顕在化した。内訳は新規Provider境界型三つのHeader／Trace欠落24件と、既存識別子の命名不整合20件である。さらに取消境界試験の`PRL-ST-003`が同Test SymbolのRelationに未登録だった。これらは同時に45個の機能欠落を意味せず、Header・命名・Relationの是正対象である。現在の全回帰成功を主張せず、是正後に再確認する。

指定した回帰是正差分の読み取り専用独立レビューはPass、Finding 0だった。対象は固定Build命名、取消Helper Header、Version Control／Runtime Data Consumer、candidate-adoption意味表、Semantic CoverageとCatalog登録である。この判定を追加44件、実Host、署名または実Provider E2Eへ流用しない。人間は区切りのよい時点のCommit／Pushを指示した。未完了範囲を記録したうえで、追加不整合の是正と局所再試験後を区切りとする。

### 回帰是正の局所再確認とCheckpoint

追加44件は、Provider境界型三つの固定Header、既存値を変えない識別子改名と全Consumerの追随で是正した。取消・清掃の既存`PRL-ST-003`をTest FileとSymbolへ接続した。複数Local Itemを一行で持つ既存Test Caseは、通常二経路`PRL-ST-001`と回復再入場`PRL-ST-003`へ分割し、全三対象で正常完了未観測・終了分類`not_observed`・Tree終了と元の清掃入力、blockedとexact mismatch Oracleを保存した。改名・型Header・Relation補完と分割の独立レビューは対象限定Pass、Finding 0だった。

CoordinatorのFormatter・型・Lint・能力閉包と旧設計トレース検査は終了コード0。変更した四試験Fileは55件成功（3173.5012ms）、公開失敗理由の全数接続試験は1件成功（312.942ms）だった。分割後の公開Process試験Fileは34件成功（2859.3002ms）。命名・型Headerの全数検査は成功したが、Test Headerの後続検査がCatalog登録済み二試験のSymbol欠落を検出した。Production Composition→Advice DispatchとNode Server／Shell／Browser Clientの実在Ownerを確認し、各Test Symbolへ既存QA Local Itemを接続した。Workbench試験Helper三つには既存の型・関数説明を維持したまま試験観測tagを補った。Workbench静的検査は終了コード0、Node依存閉包は2件成功（365.6952ms）、全Test Header／Symbol Relationの最終局所検査は1件成功（268.1924ms）だった。これらを実Providerや実Host合格へ算入しない。

このCheckpointは専用Build入力・モデルCatalog外出し・回帰是正の保存であり、専用Runtimeの有効化、Release署名、全体E2EまたはRelease完了ではない。全Checker回帰の再実行、実Code Mode Host観測、必要な署名E2Eと全体品質確認を続ける。

### 固定CheckpointのChecker全回帰と実Host観測器の局所反証

Commit `2734243005153e765ec7832f21f3a1f4c81a0dc3`で`40_Develop/checker`の`npm run test:run`を実行し、全375件成功、失敗・取消・skip・todoは0、終了コード0、266298.8002msだった。直前のFormatter・型・Lintも成功している。これはChecker契約の全回帰であり、Stableタグとfeature HEADの差に起因する既知のRepository検査Errorを解消したことや、実Host・Provider E2E成立を意味しない。

実Host試験用の観測器をRepository-local `.crdd/tmp/codex-advice-lifecycle-observer-20261001.rs`で試作した。SHA-256は`00895479572c1efeb14c3cd722647ea906dba5e1e0effe56f34b36189b68dd69`。ローカルRust `1.94.1`で`rustfmt --edition 2024`、`rustc --edition 2024 --test`を実行し、同名`.exe`の三試験が成功した。搬送Task終了だけでdelegate本体終了としない、未観測Host回収と未出現の必須Taskを成功にしない、同PIDの別世代と回収失敗を区別することを確認した。観測器はkill／abort／取消を発行しない。まだ実Hostや公式SourceのTaskへ接続しておらず、実行基盤の終了保証として使用しない。

この試作Sourceと実行物は生成・試験用でGit管理外とし、Coordinator保守担当が実Host観測Patchへ反映・再試験後に清掃する。保持上限は2026-10-08であり、未解決の観測参照がある場合は理由と新しい保持判断を残す。名前や期限だけで所有不明な資源を削除しない。次は試験Patch限定featureへ観測器を結合し、公式固定Host、実Session、Router、BrokerとRegistryを通す反証へ接続する。

### 試験専用featureと遅延通知の分離

2026-10-01、観測器のHost回収を現在のglobal scopeとPIDから探索する方式から、開始時に取得した観測scope・PID・世代を保持するToken方式へ変更した。同PIDを別scopeで再使用しても古い回収通知が新Hostの回収根拠にならない反証を追加した。

固定SourceのRepository-local試験コピーに、CoreからCode Modeへ伝播する`crdd-lifecycle-observation` featureと、feature有効時だけ公開する観測moduleを追加した。reader／writer／driver／supervisor／stderrの五Taskはspawn前に観測guardを予約し、Futureの終了または破棄で記録する。guardは取消・kill・abortを発行せず、ProductionのTool集合を変更しない。未pollのFutureも予約済みとして扱い、破棄を実際に観測する反証を追加した。

観測module SHA-256は`8aaf4c744ea72ff6a3bd7204c419b32eb674b6b5b08a9ffbc02adb1cf06d66d6`。ローカルRustの構文整形と単独module試験は終了コード0、6件成功・失敗0だった。これはcross-crateのCargo compileや実Host終了の証明ではない。Host Tokenの実Child回収経路、delegate本体／結果搬送、Core Worker／dispatch、watcher、Session起動／終了への接続は未完了であり、全Task終了をまだ主張しない。試験コピーは`.crdd/tmp/codex-advice-test-check-20260930/codex-rs`に保持し、同じ2026-10-08の保持上限と未解決参照の清掃条件を適用する。

### 実Child回収と全Task接続の具体化確認

実Childの開始Tokenを`spawn → establish → Supervisor`へ保持し、handshake失敗時の回収とSupervisorの`child.wait()`実結果に接続した。`wait`失敗または未回収Tokenの破棄を回収成功にしない。delegate本体と結果搬送、要求／yield監視、Core Worker／dispatch、Session起動／終了を追加し、対象の12 Roleをspawn前予約で接続した。構文整形は成功したが、Cargo・実Hostは未実行である。

読み取り専用の具体化確認では、Host回収Tokenと12 Role接続は整合している一方、後続子Taskが新しいglobal観測範囲へ混入し得る点と、内側Future破棄と終了登録の順序保証が不足している点を検出した。これを実Host合格へ進む前の是正事項とした。

試験feature限定のTokio task-localで開始時の観測範囲を子Taskへ継承し、内側`Pin<Box<F>>`を破棄した後にguard終了を登録するwrapperへ変更した。内側Dropを同期barrierで保留し、その間はclosureがfalseである反証を追加した。更新module SHA-256は`3bb244b8c49e0a6fb66e394b0e7cd6e0e53f8bb116411734af5cdb449389d67b`。featureなしのローカル単独module試験は7件成功・失敗0・終了コード0。feature有効時の観測範囲継承反証は追加済みだが未実行であり、この7件へ算入しない。

全観測範囲のclosureと個別取消の帰属を区別する。実Host試験は一観測範囲一シナリオとして構成し、複数connection／Cell／request間の個別因果をRole存在だけで主張しない。現在は是正後の読み取り専用確認、cross-crate compile、実Session／Router／Host／Broker／Registry反証が残る。ProductionのTool許可集合、取消、killまたはabort処理は変更していない。

### 観測feature有効での反証結果

未poll FutureのDropも開始時scopeを継承するため、task-localを`Option<Observation>`とし、scopeを`observe_future`呼出時に構築した。task-localの`None`をglobal scopeへ置換しない。旧scopeで作成した未poll FutureのDropが子登録しても、新scopeの必須Roleを満たさない反証を追加した。読み取り専用再確認は観測器限定Pass、追加Finding 0だった。実Host、Core compile、全資源closureは判定対象外である。

試験Contextは`.crdd/tmp/codex-advice-build-gFU1UU`。独立観測module SHA-256は`80f16aa7d1b76eac58843d6ca807a4d181e60a5aee48d4e64384b7dc72d10339`、Cargo入力は`774d661fa222467f6b10ec76e5a9b055b20f2efddb67f75f3504bb3397904f8a`、独立Dockerfileは`b4639d0ca44e43ac60a38311f281dbfc20c774834e722949b2409c3f4677980f`。固定Rust 1.95.0 imageとTokio 1.52.3でfeature有効の9試験が成功、失敗・無視・filterは0、終了コード0だった。Build履歴は`l9k464sovuagaywxvt0tov0hi`、生成image manifestは`a7c3239350b8c97371e33caeb84f7e31f6bfcaae9b777bedf8c5afb96073af7e`。この試験imageをRuntimeとして有効化しない。

最初の`observation-probe`経路はCLI本体まで再Buildする過剰な依存を持っていたため、session `44257`を意図して停止し終了コード1を観測した。これを試験成功へ算入しない。後続の独立Dockerfileだけが9試験の根拠であり、Provider要求、Docker再起動、永続データ削除は実施していない。

実Code Mode crateへ観測hooksを接続した`cargo check --locked -p codex-code-mode --features crdd-lifecycle-observation`を開始した。Dockerfile SHA-256は`adc0f62c4e66fcb691ddaeb5509314982438a664e659a29dd1bfd2e85131196f`、観測中sessionは`53785`。現在はコンパイル進行を確認しただけで、成功未確定である。Contextを進行中に変更せず、同じhandleから終端結果を確認する。Contextと試験imageはCoordinator保守担当が保持し、2026-10-08までに未解決参照・稼働Buildと必要根拠の保存を確認してexact対象の清掃判断を行う。共有cacheをこの試験の所有資源として一括削除しない。

その後、同sessionでCode Mode crateの型検査が`Finished dev profile`、81.89秒で完了した。観測feature有効の実crateコードがコンパイル可能であることは確認できた。これは既定GNU開発targetの`cargo check`であり、musl Native試験実行、Coreとの接続、実Host終了または署名E2Eへ読み替えない。Dockerのimage書き出し・展開は引き続き観測中で、Build全体の終了はまだ確定していない。予定image manifestは`0bf93f538eac429da4f59207375c0529db386c16449d9913beb72564f28c80ad`だが、現時点で展開完了を主張しない。

最終pollでsession `53785`の終了コード0とimage展開完了を確認した。Build履歴は`mck8bfxd2s6e7l5v8vy4vljmc`。固定platform指定に関するDockerfile warningは1件で、Compiler Errorまたは試験成功の追加根拠ではない。生成imageは上記のexact manifestで保持し、Contextと同じ清掃・保持条件を適用する。

### Core側feature伝播の型検査と実Session試験の準備

前回imageのconfig digestはローカルimage Identityとして解決できず、manifestによる参照もBuildKitが外部Repositoryとして解決しようとして停止した。最初のCore Buildは終了コード1、履歴`24bcm86bm7a067be3t2hqf66i`で、コンパイルを開始していない。exact manifestをローカルで読取り照合し、試験専用alias `crdd-advice-code-mode-check:0bf93f538eac429d`を付けた。aliasの解決先は`0bf93f538eac429da4f59207375c0529db386c16449d9913beb72564f28c80ad`と一致する。これは公開Releaseタグ、外部pushまたはRuntime採用ではない。

新Context `.crdd/tmp/codex-advice-build-czF0DQ`でCore Cargo featureとCore delegate観測入力を加え、固定musl環境の`cargo check --locked --target x86_64-unknown-linux-musl -p codex-core --lib --features crdd-lifecycle-observation`を実行した。Dockerfile SHA-256は`5b5e125cbbbb0bddf423d68c3872ed111eda98c49c9eea93affc56449d98b069`。session `60132`は終了コード0、型検査195.3秒で完了、image書き出し・展開も完了した。履歴`hs7k2ai7da7lpf3hkk0gsar57`、image manifest `c6a2076e3aa45f20938a387b636919b87e22e6bd1c8ec2c951559e9d3f380194`。未使用`ToolCallSource` importのCompiler Warningが1件あり、同importは固定公式Sourceにも存在する。警告なし検査とは主張せず、無関係な公式Sourceを是正目的だけで変更しない。

試験コピーには既存startup試験Patchを適用し、既存のSession helperはDisabled Providerを維持した。実Host試験だけが明示Providerを渡す別helperを追加した。最初の正常計算シナリオは実`capture_step_context`、捕捉したRouter、Code Mode Handler、固定HostとBroker workerを使用し、成功結果とexact `42`行を確認する。assertion panicもSession終了後に再通知する構成で、全登録Task終了・Host回収と正常経路の必須Roleを確認する。正常計算で通らないdelegate配送・禁止Tool・取消を合格へ算入しない。この新試験は構文整形のみで、着手前具体化確認とNative test compile、Host実行は未完了である。

公開Source照合用の`.crdd/tmp/codex-advice-source-inspection-20261001`、追加Context、試験imageとaliasもCoordinator保守担当が保持する。2026-10-08の保持上限、未解決参照と稼働Buildの確認、exact対象の清掃条件を適用する。共有Docker cacheや名前だけで一致する別資源を削除しない。

### 実Host試験の着手前指摘と是正（2026-10-01）

読取り専用の着手前確認で、Session起動失敗が終了処置を迂回すること、および未指定cwdが固定公式Sourceの作業Directoryへ解決されることの2件を検出した。Native実行前に試験コピーを是正した。本番Policy、許可Tool、通常Executor／Reviewerと既存Disabled Provider試験の条件は変更していない。

- Host試験は空WorkspaceをConfigBuilderの`ConfigOverrides.cwd`へ渡す。構築後のcwd書換えで代用しない。HomeとWorkspaceのTempDirは呼出側が終了観測まで保持する。
- Session構築、準備と計算を30秒期限・panic捕捉へ含め、取得済みSessionを外側で保持して共通のshutdownへ渡す。起動未取得の場合もProvider参照を解放する。
- 登録済み資源の終了確認`resources_settled`と正常シナリオ成立`is_closed`を分離した。空scopeで資源が登録されなかったことは正常試験Passではない。正常成功には従来の全登録Task、Host reapと9Role観測を引き続き要求する。
- 空scope、Task未終了、Host未回収およびreap失敗を正常成立へ算入しない負例を追加した。

`rustfmt --check --edition 2024`は対象3ファイルで終了コード0、追跡対象の`git diff --check`も終了コード0。更新したregistry試験SHA-256は`64ecf2df84a37f3d42b77e1fcba66a7d89b893a949b15dd8c581baa5f204cdee`、Session helperは`8c732bd25d1e63eca368fbb86b1c2c201e055c4030237fe1b20dcf82226cffec`、観測moduleは`c3687f77e7e45456832e7827fd3237bfc1224324db3a5cd29414d14942beadea`。独立した着手前再確認へ渡した段階であり、新しいNative compile、負例実行、Host実起動、独立完成レビューおよびE2Eは未完了である。前のコンパイル結果をこの更新版へ流用しない。

着手前再確認は対象限定で追加Finding 0件、先の2件を解消と判定した。これは完成後レビューではない。Native試験Context `.crdd/tmp/codex-advice-host-native-20261001`を固定し、Dockerfile SHA-256 `af1d0ec97dea051c3d3f4a8bbcfe68d1cb53c51feec2c9cc95811cf14747bf85`で`cargo test --locked --release --target x86_64-unknown-linux-musl -p codex-core --lib --features crdd-lifecycle-observation --no-run`を開始した。観測sessionは`45547`。HostとNative linkerのHash照合はBuild内で両方成功、整形確認も成功し、Compiler進行を確認している。まだコンパイル成功・試験実行・Host実測は確定していない。

前回Core型検査のimage manifest `c6a2076e...`は現在のDocker image一覧で見つからなかった。履歴上のCompletedをimageの現存と読み替えず、現在存在するalias `crdd-advice-code-mode-check:0bf93f538eac429d`のexact manifest `0bf93f538eac429da4f59207375c0529db386c16449d9913beb72564f28c80ad`を確認して使用した。新ContextもCoordinator保守担当が所有し、2026-10-08までの保持上限と、稼働Build・未解決参照を確認したexact清掃条件を適用する。進行中のContextを変更せず同じhandleで終端を観測する。

同sessionの再観測でNativeコンパイルの進行を確認した。実行用Context `.crdd/tmp/codex-advice-host-run-20261001`を別に準備し、コンパイル中の入力は変更していない。実行用Dockerfile SHA-256は`4cc5358d8b7abaf1f1332e25334cbd7cc058c34193b2e9d8879c50333107465c`。実行手順は固定Host Hash、実行物別Link Map、musl起動部品、ELFの非動的依存と非実行stackを照合し、試験一覧にexactな正常試験名が存在することを確認した後、ネットワークなしでその1件だけを実行する。0件実行を成功へ算入しない。まだこの実行段階は開始していない。新Contextにも同じ担当責任者、保持上限およびexact清掃条件を適用する。

更新した観測moduleをローカルRustの`rustc --edition 2024 --test`で構築し、`--test-threads=1`で8件Pass、Fail／Ignored／Filtered 0件を確認した。追加した資源終了とシナリオ成立の区別の負例も含む。Tokio featureを無効にしたローカル確認であり、固定musl target、Tokio継承、実Hostまたは全E2Eの根拠へ流用しない。実行物`.crdd/tmp/codex-advice-lifecycle-std-20261001.exe`も同じ保持・清掃条件の試験一時物である。Native Buildは引き続きsession `45547`で観測する。

Native Build session `45547`は終了コード1で終了した。履歴`l76r87yivhc95v78n9pta8d2w`。試験の新規コードに、存在しない`crate::features::Feature`参照2箇所と`assert_eq!`の曖昧参照1箇所があり、Compilerが拒否した。固定Sourceの`codex_features::Feature`と`std::assert_eq!`へ限定是正した。更新registry試験SHA-256は`d9fea47d42c89b402444d1584e56340b57d33cad1e708de7bcddcebd993664c2`。整形確認後に同じ検証条件で再Buildを開始し、新sessionは`41439`。先の失敗をHost動作不良や本番Policy失敗へ読み替えない。固定公式Source由来の未使用import warning 1件も残っており、警告なしとは表示しない。

実行手順の読取り専用確認は追加Finding 0件だった。実行時はBuild完了後に確認したimmutable Image ID／Digestを渡し、RUN cacheを使わず新しい実測を行う。手順確認を実Host試験結果へ流用しない。

再Build session `41439`では試験コードの参照エラー3件は再発していないが、Feature有効化の`Result`を無視していた新規警告2件を検出した。この候補を実Host実測へ進めない。試験Sourceコピーだけを変更し、両Featureの有効化成功を`expect`で必須確認した。失敗時は既存のpanic捕捉と共通終了処置へ進む。更新registry試験SHA-256は`17aa799b30ecf9a042dbca64ab42b1e4080ddef98aaa40d94c1d42c9459ff7c3`、整形確認は成功。進行中のBuild Contextは変更せず、その入力Hash `d9fea47d...`と是正後Sourceを区別する。現在のBuild終端と是正後候補のNative検証は未確定であり、先行候補の結果を是正後Hashへ流用しない。

次の固定候補では、新Host試験と補助関数のHeaderに規約の刺激・観測・判定・清掃を追加した。Session helper SHA-256は`ab2c7f4c5d4e2f41f4c98ba00d97f09b128a4ff5bce3f1e877e04a691c631662`、registry試験は`62be430e47549c935e4dee3200906d4c8467f2751d80575e2a22d02978fc48d1`。整形確認は成功。別Context `.crdd/tmp/codex-advice-host-corrected-20261001`、Dockerfile SHA-256 `e6e1f27e3864f1111715c53d1c05032b67bae70aa1953e365ae2e2c10244ec2b`を準備した。旧Build完了後にimmutable imageを照合し、依存部品だけを再利用して2ファイルを再コンパイルする計画であり、旧試験結果は流用しない。旧Link Mapは確認したcontainer内のexact `/out`範囲で保持移動し、新Mapを別に取得する。再コンパイルはnetworkなし、offline／locked条件で行い、警告2件の再発を拒否する。着手前読取り確認へ渡した段階で、まだ実行していない。新Contextも同じ担当責任者と2026-10-08までの保持・exact清掃条件を適用する。

### Nativeコンパイル終端と警告是正候補の再検証

session `41439`は終了コード0で終了し、Native試験実行物のコンパイルとimage展開を確認した。コンパイル所要時間は20分53秒、Build履歴は`pap0qqmyjcuqhby5buo5p8d8m`、image manifestは`7a121915b2846e0ee61ab63b62245c9947f8605ae1a0f7646727dd7e630987ef`。この入力には新規警告2件が残るため、実Host試験には使用しない。試験実行はまだ行っておらず、正常動作やE2E Passとは主張しない。

警告是正候補の着手前読取り確認は対象限定でFinding 0件だった。Dockerfile、Source Hash、旧Map保持と新Map取得、offline／locked条件を確認した。raw `sha256:`をFROMへ渡した最初の試行は外部Repository名として解釈され、コンパイル開始前に終了コード1で停止した。履歴は`qas9yg7m7snjtw19leds3u87f`。imageの現存とexact Identityを読取り確認し、局所試験専用alias `crdd-advice-native-check:7a121915b2846e0e`を付け、aliasの解決先が上記manifestと一致することを再確認した。公開Releaseタグ、Runtime採用または外部pushではない。

確認済みaliasでcacheを使わず警告是正Contextを再Buildした。session `50104`でSource Hash照合と整形確認は成功し、networkなしのNative再コンパイルが進行中である。終端結果と実Host試験は未確定。新aliasにもCoordinator保守担当、2026-10-08までの保持上限、稼働Buildと未解決参照を確認したexact清掃条件を適用する。

### 既存試験と実Host反証の範囲照合

固定Sourceの`code-mode/src/remote_session_tests.rs`と現在の試験コピーを照合した。既存の試験名や全件数から、まだ実測していない境界を成立済みへ繰り上げない。

| 確認した対象 | 実際に確認する範囲 | 現在の不足 |
|---|---|---|
| `provider_returns_missing_host_error` | 存在しないHostへの起動要求が拒否されること | 固定Hostの差替え、起動途中失敗、in-process fallback不存在とは別である |
| `shutdown_before_open_does_not_spawn_the_host` | 起動前shutdown後のexecute拒否 | 実行中Cell取消、起動後shutdown、Host reapと登録Task終了の証明ではない |
| `provider_reuses_its_live_process_host` | Provider内部参照の共有 | 実Hostの起動・生存・回収を観測する試験ではない |
| `crdd_advice_startup_ceiling` | 実Sessionの起動Policyと無害なHandlerカウンタによる直接／Code Mode由来の配送制限 | 実HostのJS環境、import拒否、Host側からのdelegate搬送は別途必要である |
| 観測器の独立反証 | scope継承、未poll、Drop順、PID再利用、資源終了とシナリオ成立の区別 | 実Hostと実Core workerが同じ観測経路へ接続されたことを単独では証明しない |
| 新しい正常計算試験 | 実Session、捕捉Router、実Core worker、固定Host、exact結果と終了観測 | 再コンパイル進行中であり未実行。禁止delegate、FS／Network／Process、import、取消、IPC断は含まない |

この照合により、正常計算が合格してもHost移行全体は未完了であることを確認した。既存試験を廃止せず、未確認の実Host境界を次の反証へ接続する。試験用モデル名はProvider送信なしのSession構築条件であり、承認された新モデルの利用可能性や実Provider E2Eの証明には使わない。

### 実Host正常試験の初回失敗と試験入力の是正

警告是正候補のsession `50104`は終了コード0で完了した。Nativeコンパイルは11分19秒、履歴`o2ha3jxouvtks3harfdrg1ic9`、image manifest `60d4253e9e7e1fa469225d53088c526af688a795f60e00fe82fa40855b562f6e`。新規のResult無視警告2件は再発せず、固定公式Source由来の警告1件が残る。exact imageの現存を読み取り確認し、試験alias `crdd-advice-host-corrected:60d4253e9e7e1fa4`の解決先も照合した。

新しい実行物で、Host Hash、実行物に対応する新Link Map、musl起動部品、ELFの動的依存不存在と非実行stackを確認した。試験一覧は2659件で、そのうちexact正常試験1件をnetworkなしで実行した。履歴`fbo9vtbbc10u3wojjfilk5n8f`は終了コード101で失敗した。実行1件はFail、Pass 0件、未実行2658件である。正常結果のassertionでpanicが発生し、共通のshutdown、全登録資源終了および隔離Root保持のassertion通過後に再通知された。正常結果と9Roleの成立は証明できておらず、Host全体やE2Eの合格へ算入しない。

固定Archiveの`code-mode-runtime/src/runtime/globals.rs`を再照合したところ、Hostは`console`を明示的に削除し、正式出力APIとして`text`を登録していた。試験入力`console.log(6 * 7);`はこの契約に適合しない。実測したerror本文は初回assertionに含まれていないため、これ以外の原因不存在までは断定しない。Productionを変更せず、試験入力を`text(6 * 7);`へ是正し、固定試験の結果だけをassertion失敗時のローカル診断へ追加した。

更新Source Hashは`16fbf7ca93f0efb849da0df18bdca342ad93ea62e90beaa490bc273c881f752e`、整形確認は成功した。新しい固定Context `.crdd/tmp/codex-advice-host-text-20261001`、Dockerfile Hash `b1553cf8dcf951e454c10c27b07408a3ab687d17ff332bb987e6960216afeaf0`を準備した。既存Mapの保持先は未使用のexact `/out/native-link-maps-before-text-correction`とし、新Mapを再取得する。前の失敗候補を成功へ読み替えず、着手前確認後に再コンパイルと実測を行う。新ContextとaliasにもCoordinator保守担当、2026-10-08までの保持上限とexact清掃条件を適用する。

正式APIへの是正の読取り着手前確認はFinding 0件だった。確認者も固定Sourceの`text_callback`が値を結果Contentへ搬送することを確認した。結果診断は今回の固定計算・秘密値なしのローカル試験だけへ限定し、Provider出力公開の一般契約へ流用しない。

固定baseのIdentityを再照合し、cacheを使わずtext是正候補の再コンパイルを開始した。sessionは`83013`。Source Hashと整形確認は成功し、Nativeコンパイルが進行中である。実行手順は大量の試験一覧をログへ保存したまま画面出力を省略する変更だけを行い、pipeline失敗、exact試験名の確認、実行1件のOracleは維持した。更新した実行Dockerfile Hashは`78528b07366f2deeea5c48271925b4cefc933341bbb27d97ffeec383f3e8723d`。再コンパイルと再実測はまだ合格未確定である。

### JS能力反証の追加候補

正常試験の再コンパイルを待つ間に、進行中の固定Contextとは別の試験SourceコピーへJS能力反証を追加した。正常計算の起動・隔離・終了処理を共通helperへ移し、別の試験から`require('node:fs')`、`process.pid`、不正な専用protocolを引数にする`fetch`、通常`node:fs` importと動的importを実捕捉Routerへ順に渡す。各cellの失敗結果に加え、能力不存在または固定module-loaderのimport拒否理由を要求する。network遮断や不正protocolによる拒否だけで能力不存在を証明しない。その後に同じSessionで`text(6 * 7)`の正常結果、9Roleおよび全登録資源終了を確認する。禁止Toolのdelegate配送、取消またはIPC喪失をこの結果へ含めない。

Source Hashは`41f8805c3e7bdff07cf7dba104ac71adbcca15d42b7f227e0a0f568ffdd2fb2b`。整形確認と対象限定の読取り着手前確認は成功し、追加Finding 0件だった。Helperと試験Headerに刺激・観測・判定・清掃および`ERB-IT-024`へのTraceを記載した。起動から全cell実行までの期限・panic捕捉と終了時のSession所有を維持した。まだこの追加候補はNative compile・実測を行っていない。正常候補session `83013`の進行中入力Hash `16fbf7ca...`と混同せず、その結果を新しいSource Hashへ流用しない。

### 正式text APIによる実Host正常試験の結果

text是正候補session `83013`は終了コード0、Nativeコンパイル11分28秒で完了した。履歴`xh0fcii2daom4qoabp689oaz5`、image manifest `76e7d1f040aea8afd4869eb69416bbb72048bb30746ad7eade95ed30a5cfdb43`。exact imageと試験alias `crdd-advice-host-text:76e7d1f040aea8af`の一致を確認した。

cacheを使わず、更新実行Dockerfile `78528b07366f2deeea5c48271925b4cefc933341bbb27d97ffeec383f3e8723d`でHost Hash、実行物別の新Map、musl部品とELF条件を再確認した。実Host正常試験1件はPass、Fail／Ignored 0件、未実行2658件、試験5.12秒だった。session `73521`はimage展開まで終了コード0で完了し、履歴`ej54asyh1td4pwy592e2x0b6u`、結果image manifest `cfb40f3db42f3f194815698872dd72d51d51a86226953e59f71cf920fa8ba38a`を確認した。exact 42行、正常結果、9Roleと全登録Task終了、Host reap、隔離Rootの終了時保持がこの試験の成立範囲である。

この合格のSource Hashは`16fbf7ca93f0efb849da0df18bdca342ad93ea62e90beaa490bc273c881f752e`であり、追加中のJS・Cell終了候補とは別である。禁止アクセス、禁止delegate、取消、IPC喪失、公開CLI、実Provider E2Eまたは移行全体の合格へ流用しない。正常実測imageと試験aliasも同じ担当責任者、2026-10-08の保持上限とexact清掃条件を持つ。

結果imageをnetworkなし・read-only・Host Mountなしの一時containerで読み、保存したHash記録を確認した。Native試験実行物は`f246933a9e336e70e125c466f3937f2ae3da101f573abc77eaf2d9b77cf04ed5`、新Link Mapは`8610b76dfa7e66a9ef641055f3c7a0feedef7bd273ec1c9b4593da87be68695c`、Mapの出力対応記録は`d46799f644ebed93b1bd3ed6a5ebbbc70e9f02af72b20a8c9d8d87248a5d4d23`だった。確認用containerは所有した一時資源として終了時に除去し、永続Dockerデータは操作していない。

### QA接続Gapの是正（2026-10-01）

実Host試験候補のHeaderは`ERB-IT-024`を参照していたが、同項目の正本は起動Policy・登録・配送を対象とし、Disabled Code Mode Providerによる局所検証と明示していた。正常実測や実HostのJS能力・Cell終了を024の完成根拠へ算入することはできない。前の着手前確認における「Trace整合」はID存在の確認に留まり、Owner義務範囲の確認不足だった。確認者もこの評価を訂正した。

Coordinator詳細設計7.5.1・11節を正式な導出元にして、QA-000006へ実Host正常025、JS能力拒否026、禁止delegate配送027、保留Cell終了028、Host喪失／IPC断029、公開CLI取消／親Process喪失030を追加した。025～029はIT、030はSTであり、既存024の保証範囲は維持する。追加の着手前確認は、025のHost差替え等を別途反証すること、027の実Core到達、029と030のscenario別評価、清掃完了と観測不能停止の分離を条件に着手可だった。完成後の独立レビューとは扱わない。

全6項目は未観測とする。既存Source Hash `16fbf7ca...`の正常計算は履歴上の個別実測として保持するが、新しい検証項目全体または変更後Sourceの合格へ読み替えない。新SourceのHeader、Build入力と試験Hashを再固定してから実行する。追加候補のBuildはまだ開始していない。

今回の分類は、承認済みモデル／Host移行に対する検証接続不足の是正である。QA設計、Architectureの導出キー、統合投影、試験Traceおよび現在品質状態を伝播対象とする。Policy・Authority・Provider送信範囲・署名・通常Executor／Reviewerは変更しない。QA／設計の独立レビュー、文書と不足影響の確認を行い、準拠基準を変更しないため準拠監査は追加しない。現在、新しい人間判断は不要である。

完成後の対象限定独立確認は、025に公開CLI終了を混ぜたOracleと、Reality Audit内の旧集計の残存を指摘した。025をCore Session shutdown／Host終了へ訂正し、現在集合・内訳・移管一覧を同期した。再レビューはFinding 0、QA設計整理と文書・伝播影響に限定してPassだった。定義表から抽出した一意Local IDは176件、移管表の一意集合は46件である。新6項目は全て未観測であり、v0.21の22件未観測と既観測11件は変更していない。

Checker packageの`npm run check`は終了コード0で、Formatter、型およびLintを通過した。Repository Checkerの再実行は終了コード1、Error 1／Warning 0で、残る指摘はfeature HEADと公開済みv0.21 tagの既知不一致だけだった。今回追加した導出キーの集合・試験段階・外部境界および条件区分の不整合は解消した。これはRepository全体のPassではない。契約全回帰はsession `88130`で実行中であり、本記録時点では終端結果を取得していない。

ignored試験Sourceの新Hashは`7a45e454f5e19e5e611f1450806eed08eed7bfe0eb45607ede9fa72b47916f06`で、正常025・JS拒否026・Cell終了028および共通helperのTraceをOwnerへ修正した。まだ再Build・実測していない。prepared Build Contextの旧Source Hashを使わず、新Hashへ再固定してから実行する。

session `88130`は終了コード0で完了した。Checker契約試験は375件、Pass 375、Fail／Cancelled／Skipped 0件、278366.6561msだった。実行中にQA文書の指摘2件を是正したため、この結果だけを最終固定文書集合の全数確認とは扱わない。Checker／契約試験Sourceは変更しておらず、文書の最終構造は別途Repository Checkerで再確認する。実Host、署名またはProvider E2Eの結果ではない。

QA設計整理はCommit `32245461`として作業ブランチへpushした。最終文書を対象にしたRepository Checker session `62523`も終了し、Error 1／Warning 0、理由は既知の`stable-release-tag-identity-mismatch`だけだった。今回の変更由来の構造・関係Findingは0件であり、この既知指摘を消すために公開タグやHEADを変更していない。

### 新Traceで固定した実Host三試験（2026-10-01）

固定候補の正常計算、JS能力拒否、保留Cell終了は、実Hostを用いる別Processの局所試験として全3件成功した。公開CLI取消、禁止delegate、Host喪失、IPC断、署名または実Provider E2Eの完成を示す結果ではない。試験Sourceと観測Hookはまだignored領域の候補であり、追跡する試験Patchへの統合・固定候補の完成後レビューが未完了であるため、Quality Centerの正式な観測済み件数は変更しない。

| 固定入力／結果 | Identityまたは観測 |
|---|---|
| Registry試験Source | `7a45e454f5e19e5e611f1450806eed08eed7bfe0eb45607ede9fa72b47916f06` |
| Session試験Source | `ab2c7f4c5d4e2f41f4c98ba00d97f09b128a4ff5bce3f1e877e04a691c631662` |
| Build Dockerfile | `168636d62de671ec13938f38bacbcfa9f2af13a6e1af7bcc38130b30929ffe6b` |
| 実行Dockerfile | `c5fd9f3c79b4f922160b065c88217800fb8b8a08255312ed0d6789fa91249180` |
| 再コンパイル | session `15196`、終了コード0、11分23秒、履歴`ypoog8g4bgdhves6axnjh8fly` |
| コンパイルimage manifest | `f5cfc2459e5d143bced3c6d84ae3a61a00e0b73ed23f24b5e60eafda79913089` |
| 試験実行 | session `79855`、終了コード0、履歴`dehy96ootls36jyryhwa1v5q0` |
| 結果image manifest | `de8aec62d41d5671736d407069b80485c3a4d842052f0ef3564e699b7d657857` |
| 試験実行物 | `c723d4d3ed8b6b760805ce043d03f7574c79053572a03998988a0f0ec594489e` |
| 新Link Map | `404f2d08eefe083264e5d55c401e92a6eb2e79618b8a4ed12cb2944454884a8c` |
| Link出力記録 | `d46799f644ebed93b1bd3ed6a5ebbbc70e9f02af72b20a8c9d8d87248a5d4d23` |

Source Hashとrustfmt、offline／lockedのNative compile、新Mapに結合したmusl部品、固定Host Hash、ELFの動的依存不存在と非実行stackを確認した。compile時には既存のunused import警告1件が残り、追加した未使用Result警告はなかった。Dockerfileのbase ARG既定値に関する警告は残るが、実行時のbaseはexact Identityへ解決している。

| exact試験 | 結果 | 観測範囲 |
|---|---|---|
| `crdd_advice_host_normal_cell` | Pass 1、Fail／Ignored 0、5.11秒 | 実Session・捕捉Router・Core・固定Hostによるexact 42行。 |
| `crdd_advice_host_js_capability_rejections` | Pass 1、Fail／Ignored 0、5.04秒 | require／process／fetchの能力不存在と通常／動的import拒否を別Cellで確認。その後同じSessionの正常計算が成功。 |
| `crdd_advice_host_pending_cell_termination` | Pass 1、Fail／Ignored 0、5.03秒 | 開始済み同じCellのYieldedからLiveCell Terminatedを確認し、後続正常計算が成功。公開CLI取消の証明ではない。 |

各試験で9Role成立、登録Taskの全終了、Host reapと終了時の隔離Root保持を確認した。各Processの他2660試験は未実行であり、全回帰には算入しない。compile後の最初のdigest参照はローカルmetadata解決で失敗し、試験を開始しなかった（履歴`7rs97c19qhib89tr0g8vi0rs5`）。専用tagのIdentityを再確認し、`--pull=false`で同じmanifestへ解決した再実行だけを上表の根拠とする。ネットワークなしの検証用containerは`--rm`で終了し、Provider Turn・署名・Docker再起動・永続Dockerデータ削除は行っていない。

次の禁止delegate試験の着手前確認では、unknown名一件だけでは027全体を満たさないこと、実captured Routerを空Registryで置換しないこと、および各要求の搬送相関が必要と指摘された。既知禁止名・namespace付き禁止名・未知名を、本番Policyと既存exec／waitを保持した同じStepから実Coreへ個別搬送する計画へ具体化する。Roleの存在だけを要求相関へ読み替えない。

今回のContextとローカルimageのOwnerはCoordinator保守担当とし、保持上限は2026-10-08とする。実行中Build、未解決参照または未保存根拠がある間は削除せず、exact Identityと終了を確認してから清掃する。履歴上の局所Passを有効化・署名・Releaseの承認へ読み替えない。

Evidence追加Sectionの読取り独立確認は対象限定Pass、Finding 0件だった。確認者はSource／Dockerfileの4 HashとOracleの範囲を再照合し、実測報告との文書整合を確認した。image内ログ・実行物を独立再取得した再検証ではなく、試験PatchまたはRuntimeの完成後レビューにも流用しない。更新後Repository Checker session `41864`は終了コード1、Error 1／Warning 0、21467msで、既知の`stable-release-tag-identity-mismatch`だけが残った。今回の記録更新に由来する構造Findingは0件であり、Repository全体のPassとは扱わない。`git diff --check`も成功した。

### 禁止delegate候補のコンパイル是正と故障試験の着手前照合（2026-10-01）

禁止delegate候補は、既知禁止名、namespace付き禁止名と未知名の三要求について、実Hostから実Core Registryの拒否までをCell・Runtime呼出ID・Tool名で相関する。全六段階をexact順序で一回ずつ要求し、全資源終了後にも再照合する。初回結果だけが整っていても、後から重複要求が観測された場合は合格にしない。実captured RouterのPolicyと既存exec／waitは保持し、禁止候補の無害なHandlerは全終了後まで呼出回数0を要求する。

固定候補のコンパイルsession `92521`は終了コード1だった。新しい試験モジュールの`assert_eq!`三箇所が、外側の`pretty_assertions`と標準preludeの同名macroによりE0659となった。試験は開始しておらず、この結果を拒否試験のFailまたはPassへ算入しない。履歴は`7ely3ekl1rkfyi5lgczlkwxe8`である。

既存の隣接試験モジュールと同じ`use std::assert_eq;`を明示し、rustfmtを適用した。旧固定候補を変更せず、新Context `.crdd/tmp/codex-advice-host-delegate-fix-20261001`を作成した。更新したRegistry試験Source Hashは`3fde76fc3ce5c1ab852a37f02554310b67cb84fb7239aaef70704361266263ad`、Dockerfile Hashは`627deb7849340527fbc59092b8338a759324d26838862129aa68f3eeff1832c3`である。他の六入力Hash、比較値、拒否条件、終了処理とProduction Policyは変更しない。局所差分と四試験の実行手順の読取り確認はFinding 0件だった。完成後の試験・Runtimeレビューではない。

exact base `f5cfc2459e5d143bced3c6d84ae3a61a00e0b73ed23f24b5e60eafda79913089`を再確認し、cacheなし・networkなしでsession `80982`の再コンパイルを開始した。七Source Hashと整形確認は成功したが、本記録時点ではコンパイルと実Host四試験の終端結果は未取得である。実行Context `.crdd/tmp/codex-advice-host-delegate-run-20261001`のDockerfile Hashは`eb61ef8d5df3028310cee3d1a02d8d9149cb6e4e695c99b83a4a9e51cf2c2367`であり、新実行物・新Mapの結合、固定Host、muslとELF条件を確認してから四試験を別Processで実行する。前の三試験の結果を新候補へ流用しない。

次の`ERB-IT-029`はHost喪失とクライアント側IPC端点喪失を別scenarioにする。読取り着手前確認では、PIDを後から再取得する方式を避け、exact Connectionと世代に結合した実Supervisor所有のChildへ限定する案を採用した。Host喪失は`try_wait == Ok(None)`を確認して`start_kill`を発行し、実wait／reapを別に観測する。Reader喪失は同Connectionの実Reader Taskを終了させ、その所有stdout読取り端を破棄する。合成Failed通知、failure書換えまたは共有取消Tokenの直接操作で故障を代替しない。

Cellの結合は実ExecutionStarted受理点で固定し、別Cell・別世代・既終了・観測不能・二重注入を拒否する。注入Channel閉鎖後はselect枝を無効にし、即時反復を作らない。Host停止とstdout EOFは競合するため、最初のSupervisor分岐を固定せず実測記録とする。同じpending要求の失敗、同世代Hostの実回収、全登録Task終了を共同Oracleにする。Reader喪失を自然EOFやwriter I/O異常の証明へ拡張しない。この予定契約は着手前照合であり、実装・型検査・実注入は未実施である。

追加ContextにもCoordinator保守担当、2026-10-08の保持上限と前節のexact清掃条件を適用する。QA項目の観測数、署名、Runtime有効化またはRelease判断は変更しない。

本Sectionの記録正確性の読取り独立確認は対象限定Pass、Finding 0件だった。Build履歴を独立再取得した検証ではなく、027／029またはRuntime全体の完成へ流用しない。Repository Checker session `72911`は終了コード1、Error 1／Warning 0、34825msで、既知の`stable-release-tag-identity-mismatch`だけが残った。今回の記録更新による新規構造Findingは0件であり、Repository全体のPassとは扱わない。

### 禁止delegateを含む実Host四試験の結果（2026-10-01）

session `80982`は終了コード0で完了した。Nativeコンパイルは14分30秒、履歴`wtdhajka64uaswhm3ryq7ydro`、生成image manifestは`d9ad9bc457d6a6596664e0af0797bd69a7fe69a3a287202a9dbb54837a63ab66`である。生成imageと試験alias `crdd-advice-host-delegate:d9ad9bc457d6a659`のexact Identityを確認し、cacheなしで四試験を実行した。

実行session `81655`は終了コード0、履歴`gxa0h808xzkvs7i53townp38w`、結果image manifestは`a65c06f0d39947b61987f6a4a5056b190d5a24bb9e74b05122a5d838df397462`だった。固定Host Hash、今回生成した実行物と新Link Mapの結合、musl部品、動的依存不存在と非実行stackを確認した。

| exact試験 | 結果 | 今回の観測範囲 |
|---|---|---|
| `crdd_advice_host_normal_cell` | Pass 1、Fail／Ignored 0、5.11秒 | 実Session・captured Router・Core・固定Hostの正常計算と終了観測。 |
| `crdd_advice_host_js_capability_rejections` | Pass 1、Fail／Ignored 0、5.04秒 | require／process／fetchと通常／動的importの拒否、後続正常計算、終了観測。 |
| `crdd_advice_host_forbidden_delegate` | Pass 1、Fail／Ignored 0、5.04秒 | 既知禁止名、namespace付き禁止名、未知名を別Cellで実Host→IPC→Core→同じcaptured Registryへ搬送。六段階のexact要求相関、Hostへ返る拒否結果、Handler呼出0、要求ごとの後続正常計算と全終了後の相関再確認。 |
| `crdd_advice_host_pending_cell_termination` | Pass 1、Fail／Ignored 0、5.03秒 | 同じ開始済CellのYielded→Terminated、後続正常計算と終了観測。公開CLI取消ではない。 |

正常・JS拒否・Cell終了では九Role、禁止delegateでは追加のDelegate Body／Delivery／Core Dispatchを含む十二Roleが成立し、全登録Task終了、Host reapと終了時の隔離Root保持を確認した。各Processの他2661試験は未実行であり、四件を全回帰へ読み替えない。Queue受理をHostの結果受信と同一視せず、Hostのexact拒否結果を別に要求した。

結果imageをnetworkなし・read-only・Host Mountなしの一時containerで読み、保存済みHashと四ログの合格行を再取得した。試験実行物Hashは`88bd51b02293eb00fba99b3a2b6fe55f9ef45494c40c4d6a494a592299ec3e92`、新Map Hashは`ad860be9ca61e95949b9b56189b7b69b42fa673183054fab61a52a183a977d78`、出力記録Hashは`d46799f644ebed93b1bd3ed6a5ebbbc70e9f02af72b20a8c9d8d87248a5d4d23`だった。確認containerは終了時に除去し、Provider要求、Docker再起動、署名と永続Dockerデータ削除は行っていない。

試験候補はまだignored領域にあり、追跡中のTest Patchへ統合していない。今回の実測は固定候補の個別根拠として保持し、QA項目の完成集計やRuntime有効化へ算入しない。Host喪失／IPC断、公開CLI取消／親Process喪失、Host差替え・不在・fallback等の別義務を未確認のまま閉じない。

四試験結果Sectionの記録範囲限定の独立確認はPass、Finding 0件だった。確認者は現在SourceとOracleへの一致を確認したが、image／ログの独立再取得や試験Patch全体の完成後レビューではない。Repository Checker session `47435`は終了コード1、Error 1／Warning 0、19774msで、既知の`stable-release-tag-identity-mismatch`だけが残った。`git diff --check`は成功した。

### 故障注入Ownerの局所反証と実Host候補（2026-10-01）

故障注入は試験featureと明示Ownerの両方がある場合だけ有効にする。OwnerはHost起動開始時に捕捉し、実ExecutionStartedのCell、Host PID／世代および実Driver pending Requestを結合する。取消Tokenは状態の読取りだけに利用し、現在対応と発行履歴を分離する。独立確認で、同一Ownerの別Connectionに同じRequest IDがある場合の解除波及を検出した。自身のPID／世代に属するCellだけを解除対象に是正し、二Connectionの同一Request ID反証を追加した。局所Source再確認はFinding 0件だった。

固定Context `.crdd/tmp/codex-advice-fault-owner-20261001`のOwner Source Hashは`74b3f0a0bf8d45d5c483c9a156fd615897f0a0906cccc4e53f68f995425336d6`、Dockerfile Hashは`3090710c7035f68e4e9a398fd63e44746121ef6a8f7c773141e704afbbf4a92b`である。十SourceのHashと整形を確認し、offline／locked／networkなしで型検査と単体試験を実行した。

session `83345`は終了コード0、コンパイル1分59秒、履歴`mfbrcjqi5vauipl2ybwur8w8h`、結果image manifestは`5ef486741dcb0c4f24533fd8035b7e888fb4d722bf2c45eb9b5953f442615bf8`だった。`exact_pending_and_history`、`request_removal_is_connection_scoped`、`startup_owner_is_captured`は3 Pass、0 Fail／Ignored、他82試験は未実行である。実行物Hashは`aa2939208ca2b52b67ba1060e4a5c3dabf599c5bf13360beb6e0d52164369396`。結果imageからnetworkなし・read-only・Host Mountなしで三件のログとHashを再取得し、一時containerを除去した。これはOwnerの状態管理反証であり、実Host故障や`ERB-IT-029`の成立根拠ではない。

実Host候補にはHost喪失とクライアントReader端点喪失を別試験として追加した。実Coreの未完了Cellが同じIDでYieldedとなった後、実Wait Futureをpollしてexact pending Requestを観測し、その対象へ一回だけ注入する。同じWaitの失敗、実Supervisor分岐、現在pending解除、共通shutdown、九RoleとHost reapを共同で要求する。事前確認でWaitの数値期限とOwnerへのTarget値搬送の型不整合二件を是正した。自然Yieldは故障結果に算入せず、Reader端点喪失を自然EOFやHost喪失へ読み替えない。

固定Registry試験Source Hashは`62af7a05f1ddc977908aa5f3cf0d6a76189b41dd9538f8bb2910f7fc6b5e701e`、Contextは`.crdd/tmp/codex-advice-host-faults-20261001`である。最初のBuildはDockerfileのFROMへimage IDを名前として渡したためmetadata解決で終了コード1となり、コンパイルと試験は未開始だった。同じexact imageに用途限定aliasを付けIdentity照合後、session `14254`で再コンパイルを開始した。本記録時点ではその終端結果と実Host二故障の結果は未取得である。

試験Sourceと補助機構はまだignored候補であり、追跡中Test Patch、QA観測集計、署名Runtimeや全E2Eへ算入しない。追加ContextとaliasにもCoordinator保守担当、2026-10-08の保持上限および既存のexact清掃条件を適用する。Provider要求、署名、Docker再起動および永続Dockerデータ削除は行わない。

局所是正と本Sectionの記録限定独立確認はPass、Finding 0件だった。image／ログの独立再取得や実Host二故障の成功確認ではない。Repository Checker session `48084`は終了コード1、Error 1／Warning 0、22532msで、既知の`stable-release-tag-identity-mismatch`だけが残った。ignored候補をこのCheckerで確認済みとは扱わない。

### 実Host六試験の再確認と二故障の実測（2026-10-01）

session `14254`は終了コード0で完了した。Nativeコンパイルは14分42秒、履歴`jflabqyg6jnncxwnf2llfo8wh`、生成image manifestは`5affccc1c17ab22d2c1e051c0951bdfa367139f7d470d0cdc6449f80472fe502`だった。今回のSourceと十補助SourceのHash、整形を確認し、offline／locked／networkなしでビルドした。旧候補の実行物やLink Mapを新候補の結果へ流用しない。

実行Context `.crdd/tmp/codex-advice-host-faults-run-20261001`のDockerfile Hashは`4558d52a1b5c0bab8ad0cde4fec70871e0b3e9e26a4772b025e0fa9c0be7af5f`である。固定Host、今回生成した実行物と新Link Mapの結合、musl、動的依存不存在と非実行stackを確認してから、六試験を別Process・個別期限付きで実行した。session `53476`は終了コード0、履歴`5ynjx8rbsfev4h3hwcyab2xvz`、結果image manifestは`f80033d63d6d2e631896d66acc9871457e649dc6dfd8865af1280a1d6ae86d12`だった。

| exact試験 | 結果 | この候補で確認した範囲 |
|---|---|---|
| `crdd_advice_host_normal_cell` | Pass 1、Fail／Ignored 0、5.12秒 | 実Session・Router・Core・固定Hostの正常計算、九Role、Host reapと全登録Task終了。 |
| `crdd_advice_host_js_capability_rejections` | Pass 1、Fail／Ignored 0、5.04秒 | 禁止JS能力／importの拒否、後続正常計算と共通終了条件。 |
| `crdd_advice_host_forbidden_delegate` | Pass 1、Fail／Ignored 0、5.04秒 | 三種の禁止delegateの相関付き実搬送・Registry拒否・Handler 0、後続正常計算、十二Roleと最終再確認。 |
| `crdd_advice_host_pending_cell_termination` | Pass 1、Fail／Ignored 0、5.04秒 | 同じCellのYielded→Terminated、後続正常計算と共通終了条件。 |
| `crdd_advice_host_loss` | Pass 1、Fail／Ignored 0、5.04秒 | exact Host／世代／Cell／Requestに結合した実pending要求へHost終了要求を一回発行。同じWaitの失敗、実Supervisor終端分岐の存在、現在pending解除、九Role・実reap・全Task終了。最初の分岐名は固定しない。 |
| `crdd_advice_host_reader_endpoint_loss` | Pass 1、Fail／Ignored 0、5.03秒 | exact Connectionの実Readerを喪失させ、同じWaitの失敗、実`reader`終端分岐、現在pending解除、九Role・Host reap・全Task終了。自然EOFやwriter異常の試験ではない。 |

各Processの他2663試験は未実行であり、六件を全回帰へ拡張しない。二故障は正常な次Cellを要求せず、故障したConnectionの失敗搬送と回収を確認した。全scenarioで隔離Home／Workspaceを終了観測まで保持し、公開CLI取消／親Process喪失や外側Container／Networkの閉包をこのNative ITで証明したとは扱わない。

結果imageからnetworkなし・read-only・Host Mountなしで六ログとHashを再取得し、一時containerを除去した。実行物Hashは`2cee382608c0145f1199ecf8c1a6b9111d8079eb6994e3f6199017ff391f0fc0`、新Map Hashは`a8ceb7eafd41850380a9b49c62da618738ff86c3ba625450da3faf93b6ac5dad`、出力記録Hashは`d46799f644ebed93b1bd3ed6a5ebbbc70e9f02af72b20a8c9d8d87248a5d4d23`である。候補Sourceはまだtracked Test Patchへ統合しておらず、QA観測集計、署名Runtime有効化、実Provider E2EやReleaseの完了へ算入しない。

六試験結果Sectionの記録範囲限定の独立確認はPass、Finding 0件だった。image／ログの独立再取得や029全体の完成判定ではない。Repository Checker session `52317`は終了コード1、Error 1／Warning 0、24546msで、既知の`stable-release-tag-identity-mismatch`だけが残った。`git diff --check`は成功した。

### 追跡中の試験Patchへの統合と正式ビルドの再開（2026-10-01）

局所候補の実Host六試験、故障注入Owner三試験および終了観測の反証十一試験を、起動制限一試験と合わせて追跡中のTest Patchへ統合した。正式実行の対象は二十一件であり、各試験をexact名で別Processへ割り当てる。固定Host、試験実行物とLink Mapの結合、musl、動的依存不存在、非実行stack、個別期限およびPass 1／Fail・Ignored 0を実行条件とする。局所候補の既存Passを統合後候補へ流用しない。

最初の正式ビルドsession `28597`は終了コード1だった。履歴`xbqh2q026euxnzrevdhwo0csn`は2026-10-01 06:40:21開始、07:10:53終了、`failed`であり、試験バイナリのコンパイル前に`assert_cmd v2.1.2`を取得できなかった。Cargoの終了コードは101、理由は`attempting to make an HTTP request, but --offline was specified`だった。試験本体は未実行であり、この結果を二十一件のFailまたはPassへ算入しない。固定Contextは`.crdd/tmp/codex-advice-build-3tCbgK`、Dockerfile Hashは`a201c8b07720b0baffb2ef259ab3374be7b99096df87063c3182f18e471cfb68`である。

是正では、試験コンパイル前に`cargo fetch --locked --target x86_64-unknown-linux-musl`による公開依存の取得だけを分離した。取得前後でCargo.lockの一致、Lock関連Hashおよび既に生成したProduction成果物Hashを要求する。依存取得段階ではコンパイル・試験を行わず、試験コンパイルと実行は引き続き`--network=none`、`--offline --locked`とする。依存不足を理由に試験のNetwork境界やOracleを緩和しない。

更新した固定Context `.crdd/tmp/codex-advice-build-iEuzSe`から、session `95360`、履歴`c8de5glfy3ftfl4qcgeb0gwqd`を2026-10-01 07:17:15に開始した。

| 固定入力 | SHA-256 |
|---|---|
| Dockerfile | `5255258d06ae861ea8e06a72468bbdf2ff6b81f2471a6eff70b1f6d802a31185` |
| Test Patch | `03e916f0371b80cf4f7038b54f3b81356218d277acc506dd3f473a4acc15cc31` |
| 十八件の試験Source Hash一覧 | `f812775b4254a47376adcc99491c7752869daed403df39d7b998ae95cdf51b80` |
| Production Patch（変更なし） | `1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb` |
| 固定公式Host | `5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03` |

本Sectionは再開時点の記録であり、再ビルドの終端成功、二十一件のPass、`ERB-ST-030`、Workbench本番接続またはv0.22全回帰の成立を示さない。公開CLI取消・親Process喪失の試験補助については、言語例外の人間承認が未取得であり、Native補助を作成していない。既存の署名Runtime、QA観測集計、有効化およびRelease判断を変更しない。

Contextと出力のOwnerはCoordinator保守担当、保持上限は2026-10-08とする。実行中Buildまたは未解決参照がある間は削除せず、必要Evidenceを保存してからexact Identity・非使用・不存在を確認する。Provider要求、Docker再起動および永続Dockerデータ削除は行わない。

### 統合後候補の正式二十一試験の終端結果（2026-10-01）

再開したsession `95360`は終了コード0で完了した。履歴`c8de5glfy3ftfl4qcgeb0gwqd`は`completed`、2026-10-01 08:08:11終了、全体50分55秒、25／25段階完了である。試験バイナリのコンパイルは19分19秒、個別試験の実行段階は40.5秒だった。前節の再開時点で未取得だった結果を本節で追記し、前回の失敗記録は保持する。

| 対象 | 実行件数 | 結果 | 観測範囲 |
|---|---|---|---|
| 起動制限 | 1 | Pass 1、Fail／Ignored 0、5.49秒。 | 起動時のTool集合と、意図的なassertion失敗を含む清掃経路。ログ内の意図的panicを試験全体のFailへ読み替えない。 |
| 実Host六scenario | 6 | 各Pass 1、Fail／Ignored 0、5.04～5.06秒。 | 正常計算、JS能力拒否、禁止delegate、同じCell終了、Host喪失、Reader端点喪失を別Processで確認。公開CLI取消ではない。 |
| 故障注入Owner | 3 | 各Pass 1、Fail／Ignored 0。 | pendingと履歴、Connection別解除、起動時Owner捕捉の反証。実Host試験の代替ではない。 |
| 終了観測の反証 | 11 | 各Pass 1、Fail／Ignored 0。 | delegate相関、scenario未実行、Taskのpoll前登録・破棄順序・元Scope、PID再使用、空／未観測、結果配送と処理終了、reap失敗・別世代を独立反証。 |

結果は`.crdd/tmp/codex-advice-formal-verification-20261001-r2`へ出力され、二十一件の保存ログそれぞれについて、一件だけの`test result: ok. 1 passed; 0 failed; 0 ignored;`を再取得した。Core側の各Processで他2663試験、Owner／観測側の各Processで他84試験は未実行である。二十一件を公式Codex全試験、CRDD全回帰またはv0.22全体のPassへ読み替えない。

| 生成物／結合根拠 | SHA-256 |
|---|---|
| Core試験実行物（Build内で記録） | `62c0a5ba2cea9acc0d3413ca3a17c0dc461b28ad7376964e6a719e02c15126b3` |
| Core Link Map（出力から再ハッシュ） | `807fd06c65b3a4eaae1dfd4a88ab8a0cef4aa4c60c0c8c11731878b7784a64c5` |
| Core出力記録（出力から再ハッシュ） | `d46799f644ebed93b1bd3ed6a5ebbbc70e9f02af72b20a8c9d8d87248a5d4d23` |
| Owner／観測試験実行物（Build内で記録） | `f2c41487b5429dc74cb8f376ece7e3f7ba3cdac605490b538446993f53c67bc6` |
| Owner／観測Link Map（出力から再ハッシュ） | `9e0815cf81f09ab1045631f71ab3abf61ef1bc87a092c7797fcf0e34e72ec33e` |
| Owner／観測出力記録（出力から再ハッシュ） | `0caa5c54fc6708e94ee37d8b5e4eaa3e532c5f147c36e4b5e28f78f5e4b9eed2` |
| Production CLI（出力から再ハッシュ） | `366286511b5d8d4d804ca9a7539eb7be7f6ea38f083bf5629e7b12ca828ba1b3` |
| bwrap（出力から再ハッシュ） | `07bc720e15a730d717e81b42acb3b95049803360738115c6f6c59830accef7c2` |

Cargo.lockは依存取得前後で一致し、出力されたLock Hash `e85460a5c2a1f92d73ca0a40219c846f6a10d729f3186667485372c3aa82cfbf`を再ハッシュで確認した。Production CLIとbwrapのHashは取得前後および試験終了後で一致し、出力からも一致を確認した。試験用PatchをProduction成果物へ採用していない。BuildKitは既存の固定`linux/amd64`指定に関する`FromPlatformFlagConstDisallowed`警告一件を出した。成功結果から警告不存在を主張しない。

前節の再開記録の独立確認は記録範囲限定Pass、Finding 0件だった。確認者は固定Contextの七入力を再ハッシュし、記載HashとDockerfileの取得・offline境界を確認した。ビルド履歴の独立取得、今回の終端結果またはRuntime完成の確認ではない。今回の終端結果と統合後試験基盤は、別途固定内容の独立確認へ渡す。

公開CLI取消／親Process喪失の`ERB-ST-030`、本番コマンドへのHost接続、実Provider E2Eおよび全回帰は未完了である。現在の本番助言コマンドはCode ModeとHostを無効にしており、このNative結果から本番成立を推定しない。承認待ちNative補助は未作成、署名Runtime・QA観測集計・Release判断も不変とする。

統合後Native検証基盤と本節の終端記録の独立確認は対象限定Pass、Finding 0件だった。確認者は二十一件の保存ログを独立確認し、CLI、bwrap、解決済みLock、両Link Mapと出力記録を再ハッシュした。固定入力、試験feature限定、Production段階不変、取得とoffline試験の分離も確認した。Build履歴の独立取得や試験の再実行ではなく、`ERB-ST-030`、本番接続、全回帰、署名E2E、QA集計またはRelease判断のPassへ流用しない。

コミット前のCoordinator静的確認session `87960`は終了コード0、Formatter 681件・Lint 682件、Production／Test型検査および三機械契約確認が成功した。Repository Checker session `84774`は終了コード1、Error 1／Warning 0、25354msで、既知の`stable-release-tag-identity-mismatch`だけが残った。今回の構造Findingは0件であり、Repository全体のPassとは扱わない。CHGの影響ファイル一覧へ今回の五対象を追加し、範囲、Phase、AcceptanceおよびQA集計は変更しない。

### 試験専用OS補助の承認と局所検証（2026-10-01）

人間は、公開CLI取消・親Process喪失の検証に使用する最小Rust補助を試験専用として承認した。前節の未承認・未作成は当時の状態として保持する。補助はRepository-localな`.crdd/tmp/codex-advice-cli-cancellation-20261001/native-control`で準備し、Production Runtimeや配布物へ組み込んでいない。TypeScriptが試験の入力・観測・判定を所有し、Rustは固定CLIの直接子起動、世代固定参照によるSignal発行、終了観測と回収だけを扱う。任意PIDや実行物の指定、Provider要求、Docker再起動および永続Dockerデータ削除は行っていない。

helperが子をforkし、未execの直接子にpidfdを確保してから起動gateを開く。取得できるまで子のexecを許可しない。質問ファイルのstdinと試験制御のstdinを分け、exec状態pipeの終了、Signal受理、Process終了および直接子回収を別の観測として扱う。exec状態pipeのEOFだけではCLI開始を確認済みとしない。

| 確認 | 結果 | 限定範囲 |
|---|---|---|
| Rust書式・Clippy・コンパイル | 成功。全targetの警告をエラーとして評価した。 | 固定Rust 1.95.0、Linux muslの試験補助。 |
| 固定制御parser | Pass 3、Fail／Ignored 0。 | 三固定値、不正値、重複の局所評価。 |
| TypeScript書式・Lint・strict型 | 成功。 | 固定mockを使う局所試験Runner。 |
| mockを用いたOS反証 | 九ケースを三試験へ配置し、Pass 3、Fail／Skipped 0。 | SIGINT、SIGKILL、不正制御、制御EOF、Signal通知切断、質問ファイルのsymlink／directory／FIFO拒否、exec失敗。実CLIやHostではない。 |

取消・強制終了と通知切断の試験では、mockが専用質問入力を読み終えた通知と子のstatを取得してから制御を注入し、終了後に同じPIDのstatが`ENOENT`となることを確認した。SIGINT／SIGKILLケースでは受理通知とwait状態を別々に照合した。通知切断ケースではhelper非zeroとmock子の不存在を確認した。質問ファイルの不正形状は子開始前に拒否し、exec失敗は開始成功へ読み替えず直接子回収を観測した。

固定Build履歴`1pzg3cnurhn64afsx4a89i5lj`は終了コード0で完了し、三OS試験の実行は271.8msだった。RustとNodeの試験実行段階は`network=none`であり、準備段階だけで公開された固定Toolchain、Node imageとLock指定のlibcを取得した。Repositoryや既存Credential Homeを試験Containerへmountしていない。初回Build `vg7bojpsazakvnks5xh091b13`はrustfmt未導入で試験前に失敗し、専用Build環境へ必要componentを加えて再実行した。

| 固定入力 | SHA-256 |
|---|---|
| Linux補助Source | `3e8fe7ceb635456c282eb269da51592b750ceab45727af900c42dd2efbefd8b1` |
| 制御parser Source | `91e043a0c4a174886f1f101e1681e5485eebb4db19520f00395d4999e70222fd` |
| mock Source | `5a9416b693f9576744a1da6fae273bcbe528eef159ca70e64042706bff34fea1` |
| OS試験Source | `76667ab57a78a85c3ba393dee1739acf739b5a93aac7119219f0731b31d52475` |
| 専用Dockerfile | `e40bc006db7ac1a0a698b98122e6ac719e996bee62a8b9e7b9a9192d08284bc9` |

独立確認で、通知失敗時の清掃、質問ファイルの形状検査、Test Header、Runnerの失敗搬送と期限付き終了待ちを是正した。固定Sourceの再確認は対象限定Pass、追加Finding 0件である。確認者によるOS試験の独立再実行ではない。

残る未確認は、通知pipe満杯と全通知段の切断、gate終了・許可前子終了、fork後pidfd取得失敗、補助の絶対期限、Runnerの過長通知・開始通知欠測・stdio close欠測、実CLI取消、CLI親Process喪失とHost Tree回収である。これらを九ケースの結果から成立済みとせず、`ERB-ST-030`、本番接続、署名E2E、全回帰およびQA観測集計を変更しない。

専用準備物と試験結果のOwnerはCoordinator保守担当、保持上限は2026-10-08である。未解決参照や実行中検証がある間は削除せず、必要Evidenceの保存、exact対象・非使用および削除後不存在を確認する。

記録更新後のRepository Checker session `70091`は終了コード1、Error 1／Warning 0、27629msで、既知の`stable-release-tag-identity-mismatch`だけを返した。1156 Markdown、18098 local link、2057 anchorを確認し、今回の文書構造Findingは0件だった。Git管理外の試験準備物はChecker対象外であり、前述の個別Gateと独立確認を代替しない。既知Findingを免除せず、Repository全体のPassとは扱わない。

### 試験Runner故障と補助の実期限の局所確認（2026-10-01）

前節の未確認から、Runnerの過長通知拒否・開始通知欠測、および補助自身の180秒期限を追加確認した。ProductionとNative補助Sourceは変更していない。

| 追加確認 | 結果 | 限定範囲 |
|---|---|---|
| 通知上限拒否と開始通知欠測 | 固定mockを生存させ、通知observerの上限を32 byteへ絞る場合と、開始通知を不可視にする場合を個別実行。両ケースで失敗を返し、固定stop後のhelper closeと通知由来の直接子PIDのstat不存在を確認した。 | 合成したobserver故障であり、Native通知pipe満杯の実測ではない。 |
| 清掃失敗とIdentity欠測の同時保持 | 独立レビューで診断上書き一件を検出し、両Errorを保持する集約へ是正。元Errorを順序付きで保持する局所反例が成功した。 | 実OSのclose欠測ではなく診断搬送の反証。 |
| 補助の実180秒期限 | 制御stdinを開いたまま固定mockを待機させ、180062.1msで試験成功。補助結果2、非常停止受理、直接子reap、wait状態9、mock readyと子stat不存在を共同確認した。 | 外側190秒の観測期限とは別。期限切れを取消成功へ読み替えない。 |

型、書式とLintを成功させてから、専用Container内の`network=none`で実行した。OS Runner履歴`mmmj5me5sz93f4d9ga73mdnz9`は終了コード0、五試験Pass／Fail 0、5325.3msである。五試験は既存九OSケース、追加二observer故障ケースと局所集約反例を含む。期限試験履歴`exvikx0qyoo0gzg4ve1dqoncq`は終了コード0、一試験Pass／Fail 0、全試験180137.5msである。既存Credential HomeやRepository mount、Provider要求、Docker再起動は行っていない。

固定入力SHA-256は、OS Runner `0b149b9543890b113ba3a9ae54c478600fff97775d4c7964e6cee2b7215b0162`、期限試験 `290d4894a2a523774e29eb9355670db13d4f63e0e9eeda8ede6ca84ae88d5f57`、Dockerfile `ed9c6f2028e3874a0dcb2f6a7c6f1fdc6403d6fa972a831be52305cef8c53061`である。Source独立再確認は対象限定Pass、残るFinding 0件。確認者によるOS再実行や終端結果の独立取得ではない。

残る未確認は、Runnerのstdio close欠測、Native通知pipe満杯と全通知段の切断、gate終了・許可前子終了、fork後pidfd取得失敗、実CLI取消、CLI親Process喪失とHost Tree回収である。`ERB-ST-030`、本番接続、署名E2E、全回帰、QA集計とRelease判断は変更しない。保持Ownerと上限、exact清掃条件は前節と同じである。

本節の記録独立確認は範囲限定Pass、Finding 0件。記録更新後のChecker session `61671`は終了コード1、Error 1／Warning 0、20161msで、既知の`stable-release-tag-identity-mismatch`だけを返した。今回の文書構造Findingは0件であり、Repository全体のPassを主張しない。

### 通知満杯と公開CLIのオフライン取消実測（2026-10-01）

固定mockによる通知満杯の反証と、固定公開CLI・公式Hostを使う取消／親CLI喪失の局所観測まで進めた。本番Coordinator、`ERB-ST-030`全体、署名E2E、全回帰またはReleaseの合格ではない。

| 確認 | 結果 | 限定範囲 |
|---|---|---|
| 実FIFOの通知満杯 | readerを保持したままnonblocking書込みを行い、1 byteでも`EAGAIN`になる状態を確認。helper結果2、close、全Processがobserverだけへ戻ること、FIFOの不存在を確認した。 | 特定通知段の特定や全通知段の切断ではない。 |
| FIFO作成後の失敗 | 独立レビューで作成処理の所有範囲漏れ一件を検出し、清掃用tryへ移した。作成直後の固定失敗から、元理由の保持・FIFO不存在・observerだけへの復帰を確認した。 | 固定mockと試験Runnerの清掃反例。 |
| 実CLIのSIGINT取消 | 実際の保留Cell ID `1`、CLIと一意な直下公式Hostの世代・実行物Hash・UIDを確認してから注入。Signal受理、直接子reap、helper close、終了後の全Process一覧、fixtureの全Socket／listener終了を確認した。 | init付き専用Container、rootの試験observer、dummy認証、オフライン刺激だけ。 |
| Hostの親CLI喪失 | 別Containerで同じ開始条件を確認し、CLIだけへSIGKILLを注入。wait状態9と直接子reapを確認し、Hostの残存なく開始時のinit／observer二世代だけへ戻った。 | Coordinatorや試験Runner自身の親喪失を代替しない。 |

通知満杯の履歴`rxg55f5m1hm9pmerz87tt2r5l`は終了コード0、一試験に二反例を配置し、Pass 1／Fail 0、32.5msだった。固定Sourceの独立再確認は対象限定Pass、Finding 0件である。Nodeの通知上限を小さくする前節の合成故障とは異なり、今回は実OSのFIFO満杯を観測した。

実CLIは`0.159.2`のhelpと公式固定SourceのSchemaへ照合した。`features.code_mode_host`は`enabled=true`と`disable_in_process_fallback=true`を併記し、Host不在を内部実行へfallbackさせない。初回は旧設定`features.agents`が認識されず、要求数0で停止した。公式の`multi_agent`／`multi_agent_v2`をfalseへ固定して再実行し、Nativeの許可Tool集合は変更していない。fixtureのdummy認証を固定値へ統一し、取消前の輸送失敗と注入後の予定切断を区別した。書式・警告を失敗とするLint・strict型検査、およびfixture／parser八試験は成功した。

試験Runnerの独立確認では、fixture取得後の同期起動失敗時の所有範囲、helperのstdio回収、Host fallback禁止の三点を是正した。同期起動失敗反例は結果2を保持し、fixture Socket 0、listener停止、observer以外のProcess不存在を確認した。是正Sourceの再確認は対象限定Pass、Finding 0件だった。

初回の実取消では、実Hostが終了した後もNode PID1へ引き取られたZombieが残り、結果2で停止した。この旧結果を成功へ変更していない。[Linux waitの契約](https://man7.org/linux/man-pages/man2/wait.2.html)と[Dockerのinit指定](https://docs.docker.com/reference/cli/docker/container/run/#specify-an-init-process)を照合し、独立した着手前確認の後、孤児のreapを担当するinit付きの試験構成へ変更した。最終走査はobserver終了とContainer停止より前に行い、init／observerのPID・起動tick・親・UID・実行物Hashが開始時と同じであることを確認した。Hostの生存、Zombieまたは読取り失敗は除外していない。initのHashは実観測値であり、事前検証済み固定入力とは区別する。initのreapをCLI自身のHost回収保証や本番構成の保証へ読み替えない。

| 実CLI局所実測 | exact Container ID | 最終結果 |
|---|---|---|
| SIGINT取消 | `ce7f10fa9d7d7f608eee24bb3b8637d1ce9a8c59368fa228582695510861cda9` | 終了コード0。実CLI PID 20／起動tick 116709、公式Host PID 73／起動tick 116789。最終Processは開始時と同じinit PID 1とobserver PID 7だけ。 |
| 親CLI喪失 | `fcff4d45456492509e0421de8d6bc84def7b5dd78ae49197a77a303e566971a9` | 終了コード0。実CLI PID 20／起動tick 117467、公式Host PID 78／起動tick 117508。最終Processは開始時と同じ二世代だけ。 |

固定Buildは`ky0dc62yahpiykdtmn8x8xakz`、imageは`sha256:191717bf0ce22203c2559d7c71cce14c702c171f8b5004d4118a651f4e55a5e8`である。CLI実行物は`366286511b5d8d4d804ca9a7539eb7be7f6ea38f083bf5629e7b12ca828ba1b3`、公式Hostは`5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03`で、準備時の再ハッシュも一致した。実CLI observer Sourceは`61fcb195800bdf40608eaf8eeebacaedaf760be33003cb396d888c0454e30abc`、fixtureは`45b693bc3480b6c6697f92a97748677fdaf8df5c4a4832905fd1abefd94006b8`、専用Dockerfileは`7161f1a386c9a186f0c8783191b986ba9b913ffbfa687060a652d24073816d16`である。

すべて`network=none`・mountなし・非privilegedであり、実Provider要求、既存Credential Home、Repository共有、Docker再起動、永続Dockerデータ削除を行っていない。Production Source、署名Runtime、QA集計は変更していない。残る補助故障の全分岐、本番相当の入力・権限・Process構成、公開Coordinator取消、署名E2Eおよび全回帰は未確認として保持する。準備物と診断物の保持Owner、上限とexact清掃条件は前節のままである。

本節と固定Source・非追跡結果記録の独立確認は対象限定Pass、Finding 0件だった。確認者はSource Hashと実行Contextへの複製一致、世代前後照合、残存・欠測の拒否、旧失敗の保持、主張の限定を確認した。実Container結果・Build履歴の独立再取得やOS再実行ではない。今回所有する停止済み試験Container五個は、exact ID・image・所有label・mountなし・終了状態を再確認して削除し、不存在を確認した。imageと非追跡準備物は、前述の保持条件で残す。

記録更新後のChecker session `86563`は終了コード1、Error 1／Warning 0、24815msで、既知の`stable-release-tag-identity-mismatch`だけを返した。1156 Markdown、18098 local link、2057 anchorを確認した。Git管理外の局所試験はChecker対象外であり、今回の個別Gate・独立確認を代替しない。Repository全体のPassとは扱わない。

### 本番接続の着手前確認と非rootの限定実測（2026-10-01）

本番助言コマンドは通常Task用`0.149.1`の配布Identityを参照し、Code ModeとHostを無効にしている。独立した着手前確認で、助言専用Image／CLI／Host／bwrapのIdentity分離、共有認証Homeの互換性、本番隔離条件、initの所有者、出力抽出・署名・Recoveryの利用側を接続前の確認対象へ加えた。通常Executor／ReviewerとClaudeは変更しない。これは完成後レビューのPassではない。

変更前の`npm run check`はFormatter・strict型検査・警告を失敗とするLint・三つの静的契約検査まで終了コード0だった。助言コマンド、Packet、Executorと通常Codex計画の四試験Fileは22件すべて合格し、417msだった。既存基準の確認であり、新しい助言経路の成立根拠ではない。

前節の固定CLI・Host・helper・observerを変更せず、専用Dockerfileへ非rootの試験targetだけを追加した。Build `ixz776sjhx65iccm6uhk4pk3z`のImageは`sha256:4fd983bd673051c4b9f0617860f4466dbe0f6a8fe2292151101bb6b7c5a63edc`、Dockerfile Hashは`c798473b4cafd36cbba6f89f01abd1708835953928a84f47f606017c60b120dc`である。初回Buildは専用Dockerfile名の指定漏れで開始前に失敗したため、実名を明示して実行した。

| 限定実測 | exact Container ID | 観測結果 |
|---|---|---|
| SIGINT取消 | `72177cb57763dae55fd947ef80c84706f1271022774f5c0ede12954c9df0f99d` | 終了コード0。実Cell `1`、CLIと直下HostのUID 65534・固定Hashを確認。helper close後は開始時と同じinit／observer二世代だけとなり、fixture Socket 0・listener停止を確認した。 |
| CLI喪失 | `a7da85ac65c800ed22eb3ae580e4d0657f67bc7d42c914317e28e8157ed82517` | 終了コード2、`blocked`。実Cell、CLI／HostのUIDとHash、helper close、最終二世代、Socket 0・listener停止は観測したが、途中で汎用`Error`を記録した。失敗段階を区別できず、合格としない。 |

両Containerは別々に実行し、UID／GID 65534、read-only root、cap-drop ALL、no-new-privileges、既定seccomp、pids-limit 64、network none、memory 1GiB、CPU 2とした。Host bind、Repositoryおよび既存Homeの共有はない。匿名tmpfsは`/fixture/home/.codex`と`/fixture/output`を各16MiB・mode 0700・UID／GID 65534、`/tmp`を16MiB・mode 1777・同UID／GIDとし、すべてrw／nosuid／nodev／noexecである。PromptはImage内のread-only regular file、Homeと出力は新規の空状態だった。initのUID、実行物Hashと世代は実観測し、固定配布物とは主張しない。

CLI喪失の失敗を回収済みという最終値だけで取り消さない。次は既存observerの失敗段階・固定エラー分類を診断し、原因を特定してから再確認する。権限追加、sandbox無効化、未知状態の合格化は行わない。本番の`/work`、専用tmp／認証Home、egress、init方式、署名閉包、公開Coordinator取消と実Provider E2Eは未確認として保持する。Production Source、署名Runtime、QA集計とRelease判断は変更していない。

本節の記録は対象限定独立レビューでPass、Finding 0件だった。Build・OS・Container条件の独立再取得ではない。今回所有する停止済みContainer二個は、exact ID・Image・所有label・終了状態・Host共有なしを再確認して通常削除し、fresh一覧で不存在を確認した。Imageと非追跡入力は前節の保持条件で残す。走査中のPID消滅は原因候補であり、現在の`Error`だけから実原因とは断定しない。

### 診断付き再実測と助言専用配布候補（2026-10-01）

非rootのCLI喪失を再実測し、今回は終了コード0で終了した。ただし前節の汎用`Error`は再現せず、原因確定や旧失敗の解消とは扱わない。observerへ固定された失敗段階、エラー分類とerrnoだけを追加した。走査、残存判定、権限、待機期限および清掃条件は弱めず、エラー本文、Host PathやProvider出力は記録していない。書式、警告を失敗とするLintとstrict型検査は成功した。初回のBiome実行はGit管理外の対象を処理せず失敗したため、専用設定を明示して一Fileの処理成功を確認した。

| 限定実測 | 根拠 | 結果と限界 |
|---|---|---|
| 診断付きCLI喪失 | observer SHA-256 `74cd51da9d25fdf30ec14625fe54a04ac16a7375ee5086364b1b1c61164e6a1f`、Build `otbiuj95ycsp3jyvz4wyqiisa`、Image `sha256:00b0c8073fd66c8cbd8569d831305c5bb9374fe91772a2c83b187e06d4007b9f` | 前節と同じ非rootの局所構成。実Cell `1`、CLI PID 20／起動tick 46677、Host PID 70／起動tick 46692と固定Hashを確認した。helper終了0／close、開始時と同じinit PID 1／tick 46639とobserver PID 7／tick 46646だけへの復帰、fixture Socket 0／listener停止を観測した。失敗一覧は空、診断値はnull。 |
| 終了後状態 | exact Container `bb42f63e9281cfea31d7ca4e589a64ed65862bc31b67e268a333e0472dc6ee51` | 所有label、固定Image、終了コード0、停止状態、Host mountなしを再取得した。今回の一回成功を断続的失敗の不存在証明にしない。 |

配布候補の着手前確認では、通常ProviderからのIdentity分離、固定三実行物、Hostの隣接配置、Build Contextのallowlist、明示的な空CMDを確認対象とした。`40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile`を追加し、承認済みの助言専用CLI、公式Hostとbwrapだけを固定Python baseへ配置した。init、試験helper、実Home、Repository、Promptおよび診断ログを含めない。公式固定Sourceの`InstallContext`が現在実行物に隣接するHostを解決することへ配置を照合した。

| 配布候補 | 確認結果 |
|---|---|
| Build | `uriecsb9q7rqqdl0t0uzyxgqf`。network none、固定base `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`。 |
| Dockerfile | SHA-256 `3438a2779bbf858f810d17d44f53425e70e3421babda9209af65480e9da351f6`。 |
| Image | `sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36`。amd64／Linux、USER `65534:65534`、WORKDIR `/work`、専用CLI ENTRYPOINT、継承CMDなしをinspectした。 |
| CLI | regular file、root所有、mode 0555、286610712 byte、SHA-256 `366286511b5d8d4d804ca9a7539eb7be7f6ea38f083bf5629e7b12ca828ba1b3`。 |
| 公式Host | regular file、root所有、mode 0555、74068880 byte、SHA-256 `5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03`。 |
| bwrap | regular file、root所有、mode 0555、529792 byte、SHA-256 `07bc720e15a730d717e81b42acb3b95049803360738115c6f6c59830accef7c2`。 |
| 起動版確認 | 非root、read-only root、network none、cap-drop ALL、no-new-privileges、pids-limit 64で`codex-cli 0.159.2`を観測した。read-only状態でPATH alias作成不能のWarningが出た。版表示の成功をHost実行、認証または本番成立へ読み替えない。 |

通常Executor／Reviewer、Claude、助言Command Plan、署名RuntimeおよびQA集計は変更していない。共有認証Homeの読書き互換性、本番ContainerのPID1とHost回収、本番の入力・egress・出力抽出、専用ImageのRuntime接続、署名E2Eと全回帰は未確認である。配布候補は未採用であり、追加の利用者向け準備操作を設けない。ImageとBuild入力は2026-10-08までを保持上限とし、exact Identity・未解決参照・実行中資源の不存在を確認した別の清掃操作で処置する。保持期限だけでは削除しない。

固定Source、専用包装境界と本節の記録整合は独立レビューで対象限定Pass、Finding 0件だった。Image、Build履歴と実Container結果の独立再取得ではない。Coordinatorの`npm run check`はFormatter・strict型検査・警告を失敗とするLint・三つの静的契約検査まで終了コード0だった。助言コマンド、PacketとExecutorを含む指定四Fileの試験実行は13件成功、失敗0件、150msだった。新Imageの本番接続や全回帰を検証した結果ではない。

今回所有する診断Containerは結果をGit管理外の検証記録へ保存した後、上記exact ID・Image・所有label・停止状態・Host共有なしを確認して通常削除し、fresh一覧で不存在を確認した。記録更新後のChecker session `55135`は終了コード1、Error 1／Warning 0で、既知の`stable-release-tag-identity-mismatch`だけだった。Repository全体Passへ読み替えない。

## Checklist

- [x] 人間承認のモデル方針と旧候補の履歴を区別した。
- [x] 固定Archiveと本体のIdentityを照合した。
- [x] 署名一致、公式配布物のBundle検証およびPatch適用後の専用CLIを区別した。
- [x] 公式固定Sourceで公開API、import拒否と通知省略を確認した。
- [x] 着手前確認を完成後の独立レビューとして扱わなかった。
- [x] Provider起動や権限拡大を実施しなかった。
- [ ] OPEN: Tool集合の閉包とHostの実境界反証を完了する。成立根拠がなければHost有効化前に停止し、具体的な不足へ戻る。
