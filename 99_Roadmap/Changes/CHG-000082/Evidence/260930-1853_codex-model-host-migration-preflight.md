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

## Checklist

- [x] 人間承認のモデル方針と旧候補の履歴を区別した。
- [x] 固定Archiveと本体のIdentityを照合した。
- [x] 署名一致、公式配布物のBundle検証およびPatch適用後の専用CLIを区別した。
- [x] 公式固定Sourceで公開API、import拒否と通知省略を確認した。
- [x] 着手前確認を完成後の独立レビューとして扱わなかった。
- [x] Provider起動や権限拡大を実施しなかった。
- [ ] OPEN: Tool集合の閉包とHostの実境界反証を完了する。成立根拠がなければHost有効化前に停止し、具体的な不足へ戻る。
