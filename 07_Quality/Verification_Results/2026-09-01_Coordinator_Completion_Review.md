# Coordinator完成確認と未到達分岐の評価

状態: 是正・再確認中。全体完成およびリリースは未判定
担当責任者: Qual-Lab
確認日: 2026-09-01

## 結論

固定版`98ccc9dfad3528e566c5ee7b4ff522026484e66b`を、アーキテクチャ／安全性、試験／利用体験、文書／不足影響／準拠の3系統で独立確認した。5件を是正対象へ統合し、各確認者と修正方針を照合した。コードの変更、試験追加、案内更新を実施したことだけでは、指摘解消や全体完成としない。

同版のCoordinator試験は1,503件すべて合格した。一方、分岐網羅率の判定可能な部分集合には2,353の未到達分岐がある。既存試験による検証義務の充足、追加試験が必要な範囲、本番契約上到達しない防御分岐を分けて評価している。全未到達分岐の評価は未完了であり、合格件数や約82.76%という部分的な値から完成を推定しない。

## 対象と独立確認

| 項目 | 対象・結果 |
|---|---|
| 基準版 | Commit `98ccc9dfad3528e566c5ee7b4ff522026484e66b`、Tree `af17326134271ad973cc4d7d201ed9acffaff572` |
| 共通の機械確認 | 2026-08-31T15:33:36.211Z。388文書、2,688リンク、894アンカー、固定履歴参照24件。エラー・警告0。各確認者へ同じ結果を提供 |
| アーキテクチャ／安全性 | Russell。実装と設計、起動・所有・取消・結果公開・回復の境界を確認。追加の入口横断確認でSEC-02を検出し、初回の指摘なしから要是正へ訂正 |
| 試験／利用体験 | Darwin。現在の検証義務と実測範囲、未計測／未到達、公開診断・回復の表示を確認。TEST-01、UX-01 |
| 文書／不足影響／準拠 | Wegener。未リリース7意図、現行案内、分類・移行、過去固定履歴との分離を確認。DGI-03、DGI-04 |
| 限界 | `.crdd`の全内容、実Providerの全入力・全時点、全OS環境を網羅した確認ではない。今回の機械確認も意味の正しさや独立確認を代替しない |

SEC-02は是正によって生まれた別問題ではなく、初回の起動入口の横断確認で同種箇所を取り切れなかったものと分類する。確認者の初回結果を無言で上書きせず、この経緯を保持する。

## 指摘と是正対象

| 指摘 | 不足と対応 | 現在の解消判定 |
|---|---|---|
| TEST-01 | 現行分岐の再測定と、未到達部分から検証義務・既存根拠・追加試験への対応を行う。資源回収、耐久記録、成功公開への影響を優先する | 4試験と子プロセスの所有・終了観測是正を追加し、全体1,520/1,520成功・当該是正の限定独立確認完了。未到達全体を除外または受容していない |
| UX-01 | 公開診断・Docker復旧の固定案内を日本語へ統一する。機械向けJSON、状態値、ID、終了コード、三値、停止・禁止条件を保持する | 関連試験とRussell／Wegenerの限定独立確認で解消。読み上げの評価や全体完成は含まない |
| DGI-03 | CHANGELOGの英日要約を未リリース7意図へ同期し、工程強化と条件付き移行を示す。CHG-000055の現在差分を規範候補として評価し、初回の追加分類を履歴に保持する | Darwinの限定独立確認で記述不足の解消を確認。分類・移行の最終採用は人間の判断 |
| DGI-04 | 実施中の配置整理を予定のまま示すDiscoveryの2箇所を同期する。CHG-000055の「移動なし」を当時の記述に限定する | Darwinの限定独立確認で解消 |
| SEC-02 | 裸のRuntime名で保護操作を呼ぶpackageのショートカット3件を削除する。保護操作の入口一覧に対する回帰試験を追加する | 独立確認で見つかった共通入口の回帰対象漏れも補完。`bin/launch.ts`と拒否・非発火例を含めDarwinの限定再確認で解消 |

SEC-02の対象は`external-send-consent:revoke`、`signed-recovery-matrix:verify`、`signed-route-matrix:verify`である。正規の共通起動入口や操作の意味は変更しない。一般の型検査、決定論的試験、ビルド用scriptは削除しない。追加試験は既知の保護入口を対象とする回帰防止であり、任意のShell式や将来の未登録入口を一般的に解析する検証器ではない。

## 分岐網羅率の再測定

機械記録は[同日の集計JSON](2026-09-01_Coordinator_Coverage.json)。Node.js `24.19.0`、Windows、対象packageは`40_Develop/coordinator`。`--experimental-test-coverage`と`src/**`、`bin/**`、`scripts/**`の包含条件で全`tests/*.test.ts`を実行し、TAPとLCOVを同時に保存した。試験一時物はRepository直下の`.crdd/test-tmp`へ限定した。実Provider、公式署名鍵、Docker修復は使用していない。

| 観測 | 結果 |
|---|---|
| 試験 | 1,503成功、失敗・取消・skip 0、exit 0、103,730.2001ms |
| 対象 | 155ファイル、ロード151ファイル、LCOVレコード163件 |
| 単一レコードとして判定可能 | 144ファイル、到達11,298／13,651分岐、未到達2,353、約82.76% |
| 同集合の内訳 | 未到達あり124ファイル、未到達なし20ファイル |
| 重複レコード | 7ファイル。mock由来の小さいレコードと実装のレコードを含むため、合計・最大・論理和で一つの率へ変換しない |
| 未ロード | 4ファイル。下記の別確認と測定限界を区別する |
| Runtime全体・Nativeの分岐網羅率 | 未確定。0%や100%へ補完しない |

生LCOVは`.crdd/test-tmp/closure-coverage-98ccc9d.lcov`、SHA-256は`00a36ad4352d590c7c134fc1a88b83618a323da54620c0197698cc1560d0465c`。JSONは対象別の分岐数と未到達行を保持する。同じ行に複数分岐があり得るため、行数を未到達分岐数へ読み替えない。この測定は是正前の上記固定版であり、後から加えた試験や表示修正を測定済みとは扱わない。

### 未ロードと別の確認

| 対象 | 分かることと限界 |
|---|---|
| `src/security/candidate-store-lock-worker.ts` | kernel-lock契約試験で実Workerの取得・競合・解放・所有者消失後の再取得を確認している。親のLCOVへ記録されないことを未試験とは扱わないが、Worker全分岐の到達も主張しない |
| `scripts/check-runtime-traceability.ts` | 通常の確認コマンドとcore契約試験が別にある。wrapperの読取り拒否等をすべて観測したとは扱わない |
| `scripts/check-native-runtime-trace.ts` | coreの正常／不正イベント検査とCLIの引数・サイズ・形式拒否を分ける。core試験だけで後者を済ませない |
| `scripts/check-platform-access-coverage.ts` | 出力先境界の契約試験と、Cargo／profile集計・Nativeの分岐測定可否を分ける。ツールの未計測値を成功率へ変換しない |

### 追加確認の優先対象

候補保存後のclose失敗、回復記録に同じ対象のintentが複数存在する場合、資源回収失敗後の保持処理自体の例外、Host喪失とTask終了の境界を、既存の正常・異常試験と照合する。公開成功の非発行、既存回復IDと記録の保持、回収不明の成功化禁止を確認する。これらの追加確認だけで未到達124ファイル全体を処置済みにはしない。

追加した4試験を含む`candidate-bundle-store.contract.test.ts`、`coordinator-task-runtime.contract.test.ts`、`docker-recovery-journal.integration.test.ts`は179/179成功、失敗・取消・skip 0、9,156.2844ms。productionを変更せず、Host解放完了前の確認済み失敗／回収不明、保持処理自体の例外、pending保存後のclose報告不明、同一Key／IDの複数intentを確認した。

終了処理の試験では、正常に解放済みのHost監視へ後から新たな喪失を発生させたfixtureが赤になった。本番の正常解放はSupervisor応答、終了、handle解放まで待ち、期待された閉鎖後の喪失通知は抑止される。このfixtureを本番不具合の証拠や修正理由には使わず、解放完了前の到達可能な通知順を追加確認する。

### 子Processの結果と終了観測の分離不足

Node.js `24.19.0`の内蔵`internal/child_process`には、`EMFILE`／`ENFILE`でstdio構築前に戻り、次のtickに`error`を通知する経路がある。`docker-owned-process.ts`はその子のerror監視を設定する前にstdio欠落をthrowしていた。また、errorでも解決する結果Promiseを終了待ちに使い、`docker-effect-runtime.ts`の短時間commandはclose未確認でも所有集合からhandleを外していた。これは実際のOS資源枯渇を観測した報告ではなく、実producerと本番consumerの接続から確認した欠陥である。

3系統の着手前照合後、取得直後からerrorと独立したcloseを所有し、搬送不成立でも子の所有を失わないよう是正する。結果の早期失敗と資源終了を分け、PIDがなくても終了を推測しない。回収中のinspect／removeが作る子も含め、close未確認handleが残る間は設定領域削除・context破棄・回収成功を許さない。候補経路とreceipt経路の双方を検証し、対象同定、Authority、回復ID、公開schema、終了要求の対象を拡張しない。

### 未到達部分の一次評価と次の検証

Russellが、未到達の多い15ファイル・1,121分岐について、既存試験、実装上の利用側、測定外の実行層を読み合わせた。これは個別分岐すべての除外判定ではない。残る109ファイル・1,232分岐はこの詳細照合の対象外であり、15ファイル内にも以下の対応確認が残る。

| 対象（未到達数） | 既存根拠と未完了の照合 |
|---|---|
| `docker-recovery-runtime-internal.ts`（241） | exact資源・receipt・置換拒否は契約試験と別層の署名復旧結果に根拠あり。home lock解放不明、inventory失敗、tombstone競合を個別のassertionへ対応させる |
| `docker-desktop-runtime-repair.ts`（222） | 手順、直前再確認、取消、unknown、実Storeのintentに根拠あり。測定外のOS関数と既存実修復結果の版・操作範囲を照合する |
| `verify-signed-general-task.ts`（77） | 成功・失敗・取消・複合回復は契約試験と4経路実測に根拠あり。共通validatorの拒否とRunner固有の未到達結果を分ける |
| `docker-desktop-repair-record-store.ts`（76） | 履歴、hash chain、pending、上限、不明状態に根拠あり。旧revision、欠損field、順序、重複の既存mutation試験との対応を確認する |
| `doctor.ts`（57） | AND判定、入力拒否、所有回収、置換、timeoutに根拠あり。表示・純粋集約と実操作の準備を分離し、前者はUX-01も参照する |
| `docker-effect-runtime.ts`（55） | 短時間commandの所有保持と回収中の追加handleは今回の必須是正。その他の未到達全体を同時解消とはしない |
| `git-object-reader.ts`（55） | looseと既存Repositoryのpacked再構成は試験済み。一方delta処理3関数は未到達。下記の形式固定試験を追加する |
| `docker-isolation.ts`（54） | 固定Worker、境界値、timeout、provenanceと署名復旧結果に根拠あり。純粋判定と親LCOV外の実Docker確認を条件別に対応させる |
| `authority-root-locator.ts`（52） | exactデータ、包含拒否、pending停止に根拠あり。検索票は実行権限ではない。未接続の高保証activationと現行のlocator読取り・保存を分け、後者を対象外にしない |
| `runtime-traceability.ts`（44） | 参照・状態・資源・検証区分の不整合拒否に根拠あり。診断表現の同値分岐と別の不整合の見逃しを分ける |
| `provisioning-record-store.ts`（44） | 保存、再読取り、不正Root、pending復旧に根拠あり。未接続activationとは別に、現行利用経路とI/O失敗の対応を確認する |
| `provisioning-record-pure-core.ts`（40） | canonical拒否と全署名確認に根拠あり。型・長さ・時刻境界の既存mutationへの対応が残る |
| `repository-workspace-runtime.ts`（37） | 許可外、差替え、偽Capability、認識済みSecret拒否に根拠あり。深さ、case衝突、Directory/file不一致、容量を実inventory条件と照合する |
| `repository-git-layout-internal.ts`（35） | 置換、時刻、mode、close失敗の試験と独立確認に根拠あり。OS拒否と所有lock限定条件の残りを照合し、作成者の自己確認を独立Passにしない |
| `candidate-store-kernel-lock.ts`（32） | 実子の競合、終了、再取得とprotocol拒否に根拠あり。Workerの親LCOV未計測と残る個別分岐の未処置を分ける |

Git形式の追加確認は現在の検証義務であり、将来機能ではない。`readVariableInteger`、`applyDelta`、`decodePackOffset`は今回のLCOVで呼出し到達0だった。既存の`git-object-reader.integration.test.ts`にはpacked再構成試験があるため、「pack全体が未試験」とは判定しない。初回検索が`packed`を取り落とした点を、実測のpack index／object処理への到達と照合して訂正した。

次はRepository-localの試験領域でGitが生成した小さなbase／OFS_DELTA／REF_DELTAを形式検査し、looseへのfallbackなしで内容・object ID・投影Pathを確認する。壊したindex／pack checksum、deltaの参照・copy範囲・結果長・object IDは、狙う内側の検証へ届くよう外側checksumとの違いを分けて拒否を確認する。公開利用側はTaskのworkspace再構成、Repository事前確認、外部送信policyの読取り、署名manifestのRepository観測である。試験設計案の段階であり、生成成功・追加試験合格・本番欠陥の確定はまだ主張しない。

### 是正途中の全体試験と実行環境の切り分け

上記Process是正前に表示修正・4試験・起動回帰試験を合わせた全体試験をsandbox内で実行し、1,512件中1,505成功・7失敗、取消・skip 0、99,955.6284ms、exit 1だった。失敗7件はいずれも既存の実子終了を伴うTask／Controller／OwnedProcess試験で、終了待ちの期限超過またはclose未確認である。生記録は`.crdd/test-tmp/closure-remediation-tests.tap`。この実行を合格としない。

同じソースのOwnedProcess試験5件を通常のWindows権限で再実行すると5/5成功した。実行制限の影響を分離する根拠にはなるが、全7失敗の解消や追加検出したstdio欠陥の解消を意味しない。試験終了後、今回の子PID不存在を観測し、PID記録だけが残った5個のRun固有フォルダを、範囲・内容・再解析点不在を確認して削除した。Provider、Docker資源、他Runのプロセス・フォルダは操作していない。

### 是正後の結合試験で見つかった試験側の不足

子プロセス所有の是正後、通常のWindows権限で全体試験を実行し、1,520件中1,517成功・3失敗、取消・skip 0、104,821.5904ms、exit 1だった。生記録は`.crdd/test-tmp/closure-process-remediation-final.tap`、SHA-256は`1d24cfcb9dabac6497c73bd137b10418e1f8cfe203ee050e832a8c0ade473fce`。Taskの取消結合2件とControllerの取消結合1件が未成立であり、この実行を合格としない。

本番の回収処理は所有handleの終了待機を行う。一方、上記試験の模擬回収は主子の結果受領直後に不存在を検査し、終了補助子のcloseを待つ本番手順を省いていた。Russellの読み合わせでこの差を確認し、模擬回収2箇所を保持済みhandleの終了待機へ接続した。既存のPID不存在、補助子込みのclose、取消要求の回数、回収成功／不明とイベント順序の検査は維持した。失敗記録は回収内部のassertionを直接報告していないため、3件すべての実発生順を観測済みとは主張しない。

Task2件・Controller2件は是正後に通常権限で5反復し、20/20成功した。これは該当結合の反復確認であり、全体試験の再確認や本番Docker実測の代用ではない。

### 全体再試験

試験側の回収待機と保護入口ガード補完後、Node.js `24.19.0`・通常のWindows権限でCoordinatorの全試験を再実行し、1,520/1,520成功、失敗・取消・skip 0、95,902.8465ms、exit 0だった。生TAPは`.crdd/test-tmp/closure-process-final-confirmed.tap`、SHA-256は`41dc1751390d2cf18c1f14cf6762b1168ae48cc230b6664e4ec8f8e0125c16d4`。型検査2構成、Lint、整形確認も成功した。実Provider・署名・Docker修復を実行せず、試験一時物は`.crdd/test-tmp`へ限定した。

実行は`40_Develop/coordinator`で、検証済み`C:\Program Files\nodejs\node.exe`へ`--test --test-reporter=tap --test-reporter-destination=<上記TAP絶対Path> ./tests/*.test.ts`を渡した。`TEMP`と`TMP`はRepository直下の`.crdd/test-tmp`。同じ基準版`98ccc9d`に対する本変更のpackage・source・試験を対象とし、試験実行中はそれらを編集していない。変更されたproductionのSHA-256は次のとおりで、Git履歴上の本変更と合わせて対象を再識別する。

| 実装（`40_Develop/coordinator/src/`からの相対Path） | SHA-256 |
|---|---|
| `security/docker-owned-process.ts` | `2a96a2d4bbf3f2ba3c250efb3b27070f0729639cca382e9c02084e977cad8a5d` |
| `security/docker-effect-runtime.ts` | `95e7edb8527274389c2d07e1c2bcf4bb0f98cef250ac5a0ab29de5d97cfa0c96` |
| `core/docker-recovery-command-report.ts` | `08030eba12bdcb5764a1a105f74fb3283deaa632452475d1d44b44d2604b63e3` |
| `core/doctor.ts` | `943449e5c9664cb2719705509e1ee5d991b46f88af8ed88c8bac848e064abe12` |

この合格は既存の全自動試験と今回追加した境界の結果である。Git delta形式の追加検証、未到達分岐の評価、変更後の正式署名実測を完了へ変更しない。

### 是正の限定独立再確認

28差分を固定し、共通Checkerを2026-08-31T16:13:01.680Zに全体実行した。389文書、2,728リンク、911アンカー、固定履歴参照24件、エラー・警告0。`.crdd`はGit除外であり、このCheckerの検査範囲に含まない。RussellはProcess／Effectと模擬回収の接続、DarwinはSEC-02の追加ガードと試験記録、Wegenerは過去・現在の時点と品質案内の同期を独立再確認し、各担当範囲をPass・追加指摘0として返した。自分で作成した差分の自己承認は割り当てず、TEST-01全体の解消やRuntime完成へ拡張していない。

### Git格納形式とLock失敗通知の追加確認

前節の是正をCommit `43086fd`へ記録・pushした後、productionは変更せず、同じTEST-01の不足へ試験を追加した。上記の「次は」「未実施」はそれぞれの確認時点の記述として保持し、以下を追加根拠とする。

Gitの[結合試験](../../40_Develop/coordinator/tests/git-object-reader.integration.test.ts)と[生成fixture](../../40_Develop/coordinator/tests/fixtures/git-packed-object-fixture.ts)では、Windowsの固定実行ファイルにあるGit 2.54.0を用い、通常object、OFS_DELTA、REF_DELTAを生成した。対象blobの形式・参照先を検査し、packだけの領域から公開3関数でCommit／Tree、内容byte、hash、mode、指定Pathだけの復元を確認した。外側checksum2種と、内側の参照・offset・整数・base長・copy・結果長・object IDの7種を壊した拒否を合わせ、既存2件を含む14/14成功、失敗・取消・skip 0、6,094.4611msだった。Gitはfixture生成に限り、本番の外部Git非使用は変更していない。他OS、別Git版、全pack形式・全サイズの網羅は主張しない。

Node.js `24.19.0`で同試験だけにcoverageを付け、`git-object-reader.ts`の到達は144／219分岐、約65.75%だった。全体試験の率との比較値ではない。先の未到達3関数へ到達し、内側の拒否も243行の実行回数2、249・289・296・443・495・128行のthrow側分岐回数2を観測した。集計LCOVであり、一つの試験へ一意に帰属する通知履歴とは扱わない。外側checksumを整合した変異と合わせて、公開関数が`null`を返したことだけに依存しない根拠とする。

- 生TAP: `.crdd/test-tmp/git-delta-43086fd-02.tap`、SHA-256 `c3bf45faf546301f0fdf00eee36be9a447adae1dca73c774bcd99725c8c690c1`
- 生LCOV: `.crdd/test-tmp/git-delta-43086fd-02.lcov`、SHA-256 `417ed1d76829a61c446f3e03e04e0bbc46631d66bb8f787e5f3b8a7d37bed8fc`
- Git結合試験SHA-256: `4a8f5401bc2782e9df9721af42258a0a07d5c2c0a992bc034d587f37951bdf71`
- Git生成fixture SHA-256: `b540488e2133c716abd53347b74fa61ed3af7cf3cfa6f51becae98cfaae55e0e`

[Lock契約試験](../../40_Develop/coordinator/tests/candidate-store-kernel-lock.contract.test.ts)は既存Supervisor factoryを使う3件を追加し、3/3成功、失敗・取消・skip 0、571.5483msだった。不正root／nonce／timingの17ケースでfactory呼出し0、上下限の正常2ケースを確認した。3段階のsend同期例外では操作失敗を返し、通知・失効・単一終了処理による回収確認が成立した。登録済みlistenerの例外でも後続listener、failureDetected／loss、失効が成立した。解除済みlistenerと終了後の通知も確認した。実Worker／OS競合の再現とは区別する。同ファイルSHA-256は`dc4152f1b50f5c3e4c2e61caf33839cd374891bd795f55b28a5829dc80134916`。

生成物はRepository直下の`.crdd/test-tmp`に限り、Git fixtureの生成途中失敗と通常終了で同じ所有Rootを回収する。追加確認後の`git-packed-*`残存なしを確認した。いずれも実Provider、署名鍵、Docker修復を使わず、型検査と整形確認も成功した。生ログは生成物としてGit管理せず、上記hashと試験sourceから再識別・再実行できるようにする。

追加後のCoordinator全体試験は1,535/1,535成功、失敗・取消・skip 0、105,623.6599ms、exit 0。実行条件は前節と同じNode.js `24.19.0`・通常のWindows権限で、基準Commit `43086fde4c90ff9b8719409fba53c2fcbf540709`、Tree `cc0fd909dd10bced97d07d0329fc4dce97b09044`へ上記3試験ファイルの変更を加えた対象である。試験実行中にsource・試験は変更せず、実行後も記載したSHA-256と一致した。生TAPは`.crdd/test-tmp/closure-git-lock-43086fd-full.tap`、SHA-256 `3ffd18eeeb30311458e6e3d499ecb8a3c51946ccd1e3dbf9b69aa364396c3dae`、終了時点2026-09-01 01:23 JST。型検査2構成、Lint、整形確認も成功した。

### Lockの残る分岐と後続の対応

Wegenerが基準coverageにある32の未到達行を実装・既存試験へ読み合わせた。元JSONには分岐識別子がないため、行ごとの条件側を確定した一覧ではない。上の追加3試験も32分岐全体を解消した根拠にはしない。

| 基準sourceの行 | 照合結果と必要な処置 |
|---|---|
| 222、318、450 | 非Windows専用戻り。今回のWindows測定外として区別し、全OS検証済みとはしない |
| 305、459、463、540、618、645、668 | 今回の入力拒否・通知例外・send例外が対応する範囲。ただし463の環境構成不能は未確認であり、行全体の完了へ広げない |
| 128、148、320 | 別の公開APIの不正hash／root・nonce入力。今回のSupervisor root／nonce試験で代用しない |
| 79、162、183、235、258、262、269 | 同期Worker timeout、遅延error／exit、対話Workerの生成・送信例外、重複release等。既存の単発正常・timeoutとは別の順序を追加確認する |
| 346、413、483、552、625、632、634、648、655 | malformed形状、kill／spawn同期例外、回収不明後の呼出し、await後のloss、終了中の競合、release-readyとexit監視の間等。既存の類似試験から成立を推定しない |
| 176、633 | 到達不能候補。timer解除とterminal設定の順序から再照合し、行情報だけで除外を確定しない |
| 367 | 通知処理の再入・listener snapshotを含む防御guardの到達性が不明。評価を残す |

この表は未確認を将来へ移す承認ではない。担当責任者Qual-Lab、再確認契機は現在のTEST-01の追加検証設計・実行である。残存不確実性は主に異常通知・終了競合時の停止と回収であり、全体完成判断前に処置する。

### 追加差分の独立確認と検査対象件数の同期

共通Checkerを2026-08-31T16:24:56.120Zに全体実行し、389文書、2,734リンク、911アンカー、固定履歴参照24件、エラー・警告0だった。この結果を共通入力として、Russellは自分が作成していないGit試験2ファイル、Darwinは自分が作成していないLock試験追加を独立確認し、各範囲をPass・指摘0で返した。Wegenerの文書／影響確認はConditionalで、別の同期入口に属する320行を今回確認済み範囲へ含めないこと、`cleanup_confirmed_failure`を終了失敗ではなく操作失敗と回収成立に分けて説明することの2点を返した。全結果の取得後に3確認者と是正方針を整合し、該当記録を修正した。

別枠のChecker契約全体は208件中207成功・1失敗、195,608.4106ms、exit 1だった。新しいGit生成fixture1件に対し、命名試験の固定対象数が159のままで実数160と一致しなかった。追加Pathが同fixture1件だけであることを確認し、`coordinatorTests`を160、重複除去後の`uniqueTotal`を322へ同期した。実Path集合とTypeScript project集合の完全一致、命名検査、既存assertionは削除していない。これはファイル追加時の利用側同期漏れであり、本番readerの欠陥やChecker規則の不備として扱わない。初回の失敗を全体Checkerの成功で上書きせず、再試験を別結果として記録する。

### 命名と検査対象の水平確認

件数同期後の命名試験は7件中6成功・1失敗、38,908.6475ms。同じ版のChecker全体も208件中207成功・1失敗、194,518.9425msだった。件数の不一致を通過した後、型付き識別子の検査が内部名8箇所を検出した。今回の追加試験・fixtureに7箇所、先の表示試験にBooleanの名前1箇所があった。配列名を内容の分かる複数形、未使用parameterを責務付きの名前、Booleanを状態の分かる名前へ是正した。型、三値、property key、値、実行順序、判定条件は変更していない。

ユーザーの水平確認依頼を受け、変更行だけでなく`40_Develop`と`template/tools`のPath・型付きsource全体を命名試験へ通した。是正後は7/7成功、22,490.9261ms。全322 TypeScript sourceの実Pathとproject集合が一致し、命名違反0だった。RustのPath集合は既存9件を維持し、Rust識別子の新しい実測まではこの結果へ含めない。

Wegenerは読み取り専用で、Checker／Coordinator／platform-access／配布Checkerのpackage、tsconfig、試験入口、固定件数と専用coverage集合を確認した。今回の追加に伴う同期は既知の2値だけだった。Coordinatorの`tests/**/*.ts`、既存結合試験からのimport、Biomeの包含条件が新fixtureを含む。Checker自身の試験集合、Rust構成、5つの用途限定coverage集合へGit fixtureを追加する必要はなく、過去Evidenceの件数は当時の値を保持する。

この水平確認は任意の将来ファイルの登録漏れを否定するものではない。既存の集合一致検査を維持する。規則の不足ではなく、ファイル追加の反映先と別枠の命名検査を確認し切っていなかったことが原因であり、新しい規則やCHGを追加しない。

検査中にpackageが定めるLint／整形確認とは別の`biome check .`も実行し、既存のimport整列支援から94件のエラーが出た。この別コマンドを合格とはしない。package定義の`lint`／`format:check`はいずれも成功した。importの機械的一括並替えは今回の命名・対象集合是正へ混入させない。

命名是正後の変更対象は次のSHA-256で再識別する。上記の命名前の個別試験hashは当時の根拠として保持する。

| 対象（Repository相対Path） | SHA-256 |
|---|---|
| `40_Develop/coordinator/tests/candidate-store-kernel-lock.contract.test.ts` | `4523c514d55650815ba7b6f614c93ac13baa23463192b467e7d73a9acf994aa8` |
| `40_Develop/coordinator/tests/fixtures/git-packed-object-fixture.ts` | `d3f4b9ea1d31293de1b1ea582d761c13c355d44221a08ad400e3b5e17f49197f` |
| `40_Develop/coordinator/tests/coordinator-docker-recovery-cli.integration.test.ts` | `dd70fb4d640697ed10894d143bf535e60db438ca590b97377adeca58ef071236` |
| `40_Develop/checker/tools-naming.contract.test.ts` | `ef12cf82bf274b4ace6a82a09d7f3a190332ad986fd4468453c1a12e86aa4449` |

命名是正後、同じ基準`43086fd`に対する現差分でCoordinator全体を再実行し、1,535/1,535成功、失敗・取消・skip 0、111,592.9973ms、exit 0だった。Node.js `24.19.0`・通常のWindows権限、Repository直下の試験領域という実行条件は前回と同じで、対象source・試験は実行中に固定した。生TAPは`.crdd/test-tmp/closure-git-lock-naming-final.tap`、SHA-256 `b8335d3fcb64d94b50fd27ab61bd033a8cd07098572eab4a1131040d1ac9d018`。この再実行にcoverageは付けておらず、命名前の個別LCOVを新しい全体測定とは扱わない。

同じ命名是正後の対象でChecker契約全体も208/208成功、失敗・取消・skip 0、216,565.1387ms、exit 0だった。実行は`40_Develop/checker`で固定Nodeへ`./test-runner.ts`を渡し、実行中に対象source・試験を編集していない。完全出力は同実行のツール記録へ保持し、Repositoryには生成ログを追加しない。再実行方法と変更対象hashは上記から取得できる。

### 水平是正とロードマップ整理の限定独立確認

現差分を固定し、共通Checkerを2026-08-31T16:38:26.778Zに全体実行した。389文書、2,731リンク、908アンカー、固定履歴参照24件、エラー・警告0。RussellはGit fixtureの機械改名を前回hashへ復元一致する差分として確認し、DarwinはLockと表示試験の機械改名、Checkerの対象数同期、ロードマップ整理を確認した。両担当範囲はPass・指摘0だった。Wegenerは品質3文書を確認し、前回2点の解消と追加記録を確認したが、package定義と異なるBiomeコマンド表記1点を返した。全結果取得後に3者と方針を整合し、実際のscript名への1文訂正を行った。限定再確認はPass・指摘解消・追加指摘0だった。品質案内はこの結果へ同期した。

ロードマップでは9箇所の重複した実績説明を既存CHG・正本・品質記録への参照と次の処置へ整理した。未完了11項目、判断状態、担当、再評価契機、v0.18の義務と将来研究候補の区別は保持した。完了していない作業を削除したり、現在の検証義務を将来へ移したりしていない。この確認は今回差分に限定し、TEST-01全体、Runtime完成、統合またはリリースの判定ではない。

## 後続処置と既存根拠の扱い

担当責任者はQual-Lab。今回差分の限定独立確認は完了し、残るTEST-01の未到達評価、追加試験とその独立確認を、[Runtime完成](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)と[Tool・品質記録の是正](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)の同じ未リリース変更で続行する。現在の完成判断に影響するため、次版へ保留しない。分類・移行の最終採用と統合・リリースは人間の判断へ残す。

[署名版4f10201の実測](2026-09-01_Coordinator_Signed_E2E.md)と旧45ea2acの実務・是正結果は各版に限定して保持する。今回の表示・package案内・追加試験・子プロセス所有と終了観測の是正によって過去の実測版を書き換えない。変更後ソースの正式署名実測は未実施である。新しい実務能力の追加や再署名を反復デバッグの前提にせず、開発検証で是正を固定してから必要な再検証範囲を評価する。
