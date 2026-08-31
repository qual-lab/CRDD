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

## 後続処置と既存根拠の扱い

担当責任者はQual-Lab。TEST-01の未到達評価、追加試験、今回差分の独立再確認を、[Runtime完成](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)と[Tool・品質記録の是正](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)の同じ未リリース変更で続行する。現在の完成判断に影響するため、次版へ保留しない。分類・移行の最終採用と統合・リリースは人間の判断へ残す。

[署名版4f10201の実測](2026-09-01_Coordinator_Signed_E2E.md)と旧45ea2acの実務・是正結果は各版に限定して保持する。今回の表示・package案内・追加試験・子プロセス所有と終了観測の是正によって過去の実測版を書き換えない。変更後ソースの正式署名実測は未実施である。新しい実務能力の追加や再署名を反復デバッグの前提にせず、開発検証で是正を固定してから必要な再検証範囲を評価する。
