# Coordinator完成確認と未到達分岐の評価

状態: 既存候補は採用・PR #32統合済み。公開準備の追加差分を検証中・未リリース
担当責任者: Qual-Lab
確認日: 2026-09-01

## 結論

検証完了後の2026-09-01、人間が[候補内容と移行方針を採用](../../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#candidate-adoption-20260901)し、その後PR #32の統合とタグ・公開を承認した。[公開準備計画](../../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#release-preparation-20260901)に従い、現在は期限なし配布契約とCheckerの追加差分を準備ブランチで確認している。以下の旧固定版の完成評価を追加差分へ流用せず、各確認時点での判断待ちも履歴として保持する。

固定版`147fb29`の[完成評価](#completion-assessment-147fb29)を3系統で完了した。その版では追加の実装必須事項は検出されず、アーキテクチャ／安全性と文書／不足影響／準拠はPass。試験／利用体験に残ったWindows Terminalの未確認も[追加確認](#windows-terminal-verification)で解消した。これは公開準備の追加差分の完成や最終リリース判断を代替しない。以下の初回監査と是正履歴はそのまま保持する。

固定版`98ccc9dfad3528e566c5ee7b4ff522026484e66b`を、アーキテクチャ／安全性、試験／利用体験、文書／不足影響／準拠の3系統で独立確認した。5件を是正対象へ統合し、各確認者と修正方針を照合した。コードの変更、試験追加、案内更新を実施したことだけでは、指摘解消や全体完成としない。

同版のCoordinator試験は1,503件すべて合格した。一方、分岐網羅率の判定可能な部分集合には2,353の未到達分岐があった。後続で対象124ファイルを検証義務・既存根拠・追加試験・別の観測層に分類し、追加境界を含む1,585試験が成功した。今回の評価と追加試験を独立確認し、追加の本番欠陥や試験必須条件は検出されなかった。記録2点の是正と確認結果は末尾に分離する。変更後の正式実測は末尾の48515ebの結果で成立した。結果記録の限定確認も完了したが、全体完成判断は別に残り、合格件数や部分的な網羅率から完成を推定しない。

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
| TEST-01 | 現行分岐の再測定と、未到達部分から検証義務・既存根拠・追加試験への対応を行う。資源回収、耐久記録、成功公開への影響を優先する | 未到達124ファイルの意味評価、追加境界、全体1,585/1,585成功を限定独立確認。記録2点は末尾の是正・再確認へ接続。未到達全体の除外・受容ではなく、変更後の正式実測は48515ebで成立。結果記録の限定確認は完了。全体完成判断は別に扱う |
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

### 読取り・再検証・終了境界の追加確認

基準版`5f988ef52017af4b677f8a6641dacb11aebf785d`を変更する前に、同じ包含条件で全試験を再測定した。1,535/1,535成功、失敗・取消・skip 0、102,791.5153ms。単一レコード144ファイルでは11,468／13,800分岐に到達した。7ファイルの重複レコードと4ファイルの親LCOV未ロードは前回と同様に分離し、Runtime全体の率へ合算しない。

- 生TAP: `.crdd/test-tmp/closure-coverage-5f988ef.tap`、SHA-256 `a65c63988d7f351bdb1a08c58af7b9a2c5757a763acf65a97f64482dc7fc0336`
- 生LCOV: `.crdd/test-tmp/closure-coverage-5f988ef.lcov`、SHA-256 `0f59e89618f333fcea21568dea9b200650e86a4c015785b2ebaf94c0c3932a08`

旧124ファイルのうち、GitとLock以外の優先13ファイルをRussell、残る109ファイルをWegenerが既存試験・利用側と照合した。109ファイルの分類は、重点6、既存優先対象への隣接3、CLI等18、表示・入力・取消9、OS・資源17、Provider・Task20、Trust・Root36である。これは旧1,232未到達分岐をすべて個別実証した意味ではない。候補専用のTrust-floor／StoredLocatorと、通常のLocal Personal権限経路、未実装blocked固定のActive-pointer入口を分けた。Native helperは別名の`docker-desktop-repair-policy.contract.test.ts`に実子・終了・protocol異常試験があり、source名だけによる試験不存在の推定を訂正した。

具体的に不足していた条件は、[検証設計](../03_Verification_Design.md#読取りと権限再確認の境界)へ接続して既存試験に追加した。

| 境界 | 追加根拠と限界 |
|---|---|
| Lockの生成失敗・IPC・解放中競合 | Worker／Supervisorの生成例外、解放重複、送信・終了要求の例外、形状違反、遅延終了、失敗後通知を補完。非取得と回収不明を分離。初段では同期取得timeout後の実終了は未確認だったが、後段の実子試験で終了完了・同identity再取得まで追加確認した。null返却時点の終了済みを意味しない |
| 初回同意 | resolve／persist／revoke各々のLock後再観測5形と解放例外、計18件追加。元記録不変と操作済みだが解放不明な結果を区別 |
| Provider権限・Mount | 発行前／消費前の再検証拒否と5種類のbinding差12件、consume後・有効化前の期限到達／Source失効2件。権限非発行、元Capability再利用不可、次Grantへの非残存を確認 |
| 署名情報の読取り | manifest-loader／release-identity各4故障。短読取り、open後・読取り後・Path側の実体差を取得FD限定で注入。close1回、hash／権限非発行、元byte保持、復元後正常を確認。自然発生したOS競合の実測ではない |
| 結果保存・回復投影 | read-backの短読取り・内容差・Path実体差と、不正なHome hash配列を追加。完了記録非発行、開始記録保持、getter非実行を確認 |
| 候補Filesystem・隔離設定 | 階層65、単一file 64MiB超、junctionを公開captureへ接続。隔離の反証を4形から21形へ補完。総量・file数・変更数・候補保存内容の各上限は別確認 |
| 認識済みSecret | 引用符・escape後のSource参照と既知literal、文字列内と未閉鎖文字列を区別。検出規則は変更せず、未知Secretや全JavaScript解析の保証は追加しない |

trace検査CLIへ合成入力を実子Processで渡したところ、不正引数の未捕捉例外後にWindowsのnative assertionが発生し、期待exit 1ではなく`0xC0000409`となる試行を2回観測した。内部破損の原因まで特定したとはしない。CLIの同期境界で失敗を捕捉し、固定理由だけをstderrへ返して`exitCode=1`で終了するよう是正した。正常JSON・exit 0と検査不成立JSON・exit 2は維持した。Pathやstackを表示せず、直接`process.exit()`で終了させない。

是正後のCLIを含む7試験は5反復で成功した。その後、stderrが固定理由と改行だけであることを厳密比較し、7/7成功、1,151.3286msを確認した。ETWの収集、通信の非発火、署名済みWorkerの起動をこの合成入力試験で測定したとは扱わない。

追加途中の全体試験は制限環境で1,580件中1,573成功・7失敗、取消・skip 0、117,786.3247msだった。生記録は`.crdd/test-tmp/closure-boundaries-final.tap`と同名LCOV。この実行は不合格として保持する。失敗した既存の実子終了3試験ファイルを、同じsourceの通常Windows権限で再実行すると101/101成功、2,036.1216msだった（`.crdd/test-tmp/closure-process-normal-permission.tap`）。実行制限による差を分離する根拠であり、全体再試験の成功や残る境界の完了には読み替えない。

追加途中のChecker契約は208/208成功、217,625.7141ms。型検査2構成・package定義のLint／整形・Runtime対応検査も成功した。Lintで出た文字列連結の情報提示3件は同じ意味のtemplate式へ是正した。開発E2Eは通常Windows権限で286/286成功、23,190.2565ms、失敗・取消・skip 0。12試験ファイルをpackageの`development-e2e:verify`から実行し、検証済みNodeが子にも選ばれるPATHを確認した。実Provider・署名・Docker修復の成功ではない。

全体試験の失敗時に残った試験専用フォルダ5個は、`ready.json`だけが含まれること、そこに記録された10個の子PIDがすべて存在しないこと、exact Pathと非再解析点であることを確認して削除した。ほかのRunの資源やRuntimeの回復記録は削除していない。

Lock同期取得の5秒timeoutは、独立Node子内の本番Workerに対しmodule評価前だけを遅延させて実測した。本番URL、空env、pipeName、共有state、timeout条件を維持し、終了要求→取得null（終了未観測）→実Worker exit→terminate完了→同identity再取得・解放→子close／exit 0を確認した。null返却時点でWorkerが終了済みとは主張しない。初回は試験子の`--input-type=module`が復元後Workerへ継承される起動ミスで失敗したため、その不要flagを除去した。本番の待機条件は緩和していない。

kernel全25/25成功、11,952.0948ms、失敗・取消・skip 0。生TAPは`.crdd/test-tmp/kernel-real-timeout-5f988ef-01.tap`、SHA-256 `2f5e31cfc337620cb47117a63d0bd27dd0115816d5d54c3dee59f8702920ff38`。試験file SHA-256は`6533eb8846b02ca6972b08df54b48b2493f507fe0d6148377440d7e7380bde56`。非Windows枝は現在のWindows対象外、完了済みtimer／重複settle／terminal設定後のclosed guardは実producerの解除・支配条件で評価し、削除済みcallbackの人為的再呼出しや全分岐到達のための本番hookは追加しない。

先行失敗と切り分け記録のSHA-256は、全体TAPが`64feab1d71df4b246bc1f0e404b7f1e9b281b2a8e6148d84b22406c3025d7957`、同LCOVが`82f4238a171c6cc351d6fc93a96ddf012c08942b309a2f744f23a0a111f2f5fd`、通常権限101件のTAPが`23b1dd9f587f759d72936921a2453554f0723139cc7828077e4c1447210444f3`である。後続の成功でこれらの失敗記録を置き換えない。

### 未到達部分を現在の検証義務へ対応させた判断

workspaceの残る4上限も追加確認した。1,000変更Pathは実fileから候補を発行し、1,001は拒否した。20,000filesと合計256MiBは、対象workspaceだけの一貫したFS観測を用い、上限内では全読取りと後続sentinel到達、超過時は対象guardで停止しsentinel未到達となることを確認した。上限内でも後段の変更数／許可Path条件では拒否されるため、両側の`null`だけを判定根拠にしていない。実descriptorのcloseと読取りbyte総量、正規Repository全file hashの保持を確認した。

保存内容16MiBは実fileでcaptureを成立させ、公開persistからStoreのbundle検査・認識済みSecret検査を通過してpolicyの確認へ1回到達した。16MiB＋1byteはその前に停止した。policy確認の試験用getterで意図的にthrowし、native Store観測・書込みへ進ませていない。この到達確認を、実Storeへの保存成功や正式署名E2Eとは扱わない。workspace全12/12成功、7,622.6192ms、失敗・取消・skip 0。試験SHA-256は`e29293287cdf06089f26aed4dc7977712bcc687fc6801f80129eb17ed9a2250c`。本番hook・export・特別な起動flagは追加していない。

率を上げること自体を完成条件に追加せず、次の共通原因・利用側に対応させる。担当責任者はQual-Lab。いずれも永久除外や未到達枝の実行済み認定ではなく、対応する前提を変更したときに再評価する。

| 対象群 | 現在の根拠・適用境界 | 再評価契機 |
|---|---|---|
| 純粋validationと共有decoder | 不正型、動的入力、非canonical、binding差の試験とconsumerの候補判定を照合。field別の同じ拒否先へ至る短絡枝を、独立したRuntime能力の未実装数へ数えない | 受理集合、共有decoder、成功結果を使う側の変更 |
| Recovery engineと修復Record | 本番finallyと試験が同一の`releaseRecoverySynchronizations`を使い、解放false／throw後も全解放と第一失敗を保持する。Recordのwriter／readerも同じshape・合法遷移検証を共有し、正常chainとstage・順序・旧revisionの反証がある | helper、終了結果の上書き、Record遷移、保存形式の変更 |
| Desktop修復 | 直前再確認・取消・helper喪失・package差・実Store intent・応答不明後停止に契約試験がある。OS shutdown／WSL／renameの全実経路は未実測で、署名復旧7/7をその証拠にしない | 修復実装・対象OS・実運用で該当する故障の発生。影響がある間は実OS確認済みと表示しない |
| Task Runner、Doctor、Docker Effect | exact候補、byte・版・履歴差、複合Recovery、signal登録解除、必須checkのAND、子close未確認handle保持、所有外・置換拒否を具体試験へ接続。default依存と実OSの配送は別層 | 入口、producer／consumer、所有資源、取消／公開結果の変更。今回のProcess変更後は正式実測の再固定が必要 |
| Locator、Provisioning Store／pure core | 非Authority候補の保存・pending回復、実署名・全署名検証・失効時刻・動的入力の拒否に根拠あり。通常Local PersonalのTask権限とは未接続の経路を区別 | 候補を本番権限へ接続、管理プロファイルの有効化、署名・失効条件の変更 |
| Runtime対応検査 | source／試験・状態・資源・終了条件・未観測資源の反証を確認。型別の同じ診断表示の未到達をRuntime権限の独立義務にしない | 対応モデル、参照先、検査自体の意味の変更 |
| Git layout | 同名置換・同サイズ改変・mode・close失敗・初期Root／親／Repository Identityの既存反証と独立確認へ接続。全syscall故障を実発生させたとはしない | 同定・読書き順・終了観測・対象Git形式の変更 |
| 親LCOV外のWorker／CLI、非Windows、別端末、Native内部 | 既存の実子試験・限定署名実測と、現在のWindows対象外・別の観測層を分離。未ロードを自動で未試験または合格へ補完しない | 対象環境・入口・Native実装の変更、該当条件の実運用発生 |

この判断は、追加で確定したLock timeoutとworkspaceの独立上限を省略する根拠にはしない。追加試験と固定差分の独立確認、変更後の正式実測有効性を合わせて、TEST-01の解消可否を判定する。

### 追加境界を含む全体再試験

すべてのsource・試験を固定して通常Windows権限で再実行し、Coordinatorは1,585/1,585成功、失敗・取消・skip 0、121,832.8082ms、exit 0だった。Node.js 24.19.0、包含条件とRepository-localのTEMP／TMP、TAP／LCOV同時出力は基準測定と同じである。

| 観測 | 結果 |
|---|---|
| 単一レコード部分集合 | 144ファイル、11,633／13,920分岐到達、未到達2,287 |
| 重複レコード | 7ファイル、対象名は基準測定と同じ。163レコード／151ファイル。合算・最大値・論理和で補正しない |
| 親LCOV未ロード | 4ファイルを維持。今回実子から確認したtrace CLIとLock Workerも、親LCOV未ロードを実行不在と読み替えない |
| 生TAP | `.crdd/test-tmp/closure-boundaries-confirmed.tap`、SHA-256 `97785fbcf22898dd61fddfbe33a23609ad2a191ce4fc5ba959650699c7052498` |
| 生LCOV | `.crdd/test-tmp/closure-boundaries-confirmed.lcov`、SHA-256 `5906abdaf3f2eb61d38defd1c65dec84a68d2c708fe320864c6cbbed6f22ccf7` |
| 変更された実行script | `scripts/check-native-runtime-trace.ts`、SHA-256 `e6390dbe14d262a811ffc2ece30b8a2a586febc41a8ee93cfec06ad6d08fa0dd` |

測定対象は次節のTS識別情報とkernel試験の改名前後の区別から再識別する。故障注入を含む計測で分母自体も変わるため、以前との差をRuntime全体の品質改善率として示さない。今回の50試験追加と隔離の既存試験内17変異は、確認した意味で評価する。型検査2構成、Lint、整形、状態・資源の機械可読対応検査も成功した。これらは変更後の正式署名実測、独立確認またはリリース判断の代用ではない。

### 測定対象の再識別と改名後の最終試験

基準Commitは`5f988ef52017af4b677f8a6641dacb11aebf785d`。以下は最終試験対象の変更13TSの作業コピーbyteに対するSHA-256である。Pathは`40_Develop/coordinator/`からの相対。非変更TS・package等は基準版を用いる。TS限定の`git diff --no-ext-diff --binary HEAD -- <以下の13Path>`は`80d0962232617c784fac2723f0bcbdf8b18890b6cb562e93875e1af77ecdbde6`だった。後続コミットからは同じ基準版とのTS差分を照合する。文書だけの追記をTSの実行版変更とは扱わない。

| 変更TS | SHA-256 |
|---|---|
| `scripts/check-native-runtime-trace.ts` | `e6390dbe14d262a811ffc2ece30b8a2a586febc41a8ee93cfec06ad6d08fa0dd` |
| `tests/candidate-store-kernel-lock.contract.test.ts` | `96e85597cc415e461c68c819bd12da5d11a7f2fe27d5b7d41eaf2cb935a24525` |
| `tests/docker-recovery-public-projection.contract.test.ts` | `d3513c57a0738818c189a8bfe8a6edb2277211269753dac9bfe38b0e1b35dc49` |
| `tests/doctor.contract.test.ts` | `272d17c67f1ae8a79ad3255c66711da99c81c8927c609c16483bf24a65c3cb46` |
| `tests/external-send-consent-runtime.contract.test.ts` | `ba327ab806c30a392a65ac7a2ad4658b7630f443c575f11ac1c463b885378fb4` |
| `tests/native-runtime-trace.contract.test.ts` | `285b2a0f1087511cd81124a030c3dd530665ea4b538073149bb37795f03d9314` |
| `tests/platform-provisioner-manifest-loader.contract.test.ts` | `c15dc106660c3704545142ad9b2940ce250878efe1b92914d4653ea59789aa6a` |
| `tests/platform-provisioner-release-identity.contract.test.ts` | `ded8c6a93bed19aed4def3cf5f901f61fc6b716c445bad9d7b9a8e6e2efb14fd` |
| `tests/provider-authority-runtime.contract.test.ts` | `35b59e8790be730daa6b83ed3c758baf2ba1f8de94d14498d9cc83b733edcb72` |
| `tests/provider-home-mount-grant-runtime.contract.test.ts` | `a4733f454c665c764c385f9795634f4004ab0cbc9116fce5351e6f64180c5214` |
| `tests/repository-workspace-runtime.contract.test.ts` | `e29293287cdf06089f26aed4dc7977712bcc687fc6801f80129eb17ed9a2250c` |
| `tests/secret-material-policy.contract.test.ts` | `618106ef47b13f528819adbee2a3e726c7b402bc8b3219cdc2d59a05f93f22b0` |
| `tests/verification-result-record.contract.test.ts` | `97c1d0dd35a9f5b688dae5bd808e8823ac0014c59cc31e1fddf4a3eead66ce3f` |

coverage測定時との差はkernel試験の変数`NativeWorker`→`nativeWorker`、`data`→`workerPayload`だけである。最終ファイルの該当変数を逆変換したbyteのhashは、改名前に記録した`6533eb8846b02ca6972b08df54b48b2493f507fe0d6148377440d7e7380bde56`へ一致した。この照合は測定後の再識別であり、測定前に新しく観測したとは記録しない。Gitの改行変換と作業コピーbyteのhashを区別する。

改名後はcoverageを付けず同じCoordinator全試験を実行し、1,585/1,585、失敗・取消・skip 0、136,512.1254ms、exit 0だった。生TAPは`.crdd/test-tmp/closure-final-naming.tap`、SHA-256 `b1328b392b25a1cfc996c7bcc83c78955147c1a2f596c1eaf2f5fcd0ce5613ef`。Checker契約は208/208、失敗・取消・skip 0、240,507.6874ms、exit 0。開発E2Eは同じ本番コードで286/286、23,190.2565ms、exit 0であり、kernelの変数改名は当該12試験ファイル集合に含まれない。実Provider・Docker修復・Release秘密鍵は使用していない。

### 追加境界の独立確認と記録是正

19変更ファイルを固定したGit binary diffのSHA-256は`80ca8a6f98b7952c532f3b3c9147945deb967df3baa004e3296a7ac79e734dfa`。共通Checkerは2026-08-31T17:13:53.278Z、389文書・2,734リンク・909アンカー・固定履歴24、エラー・警告0、exit 0。`.crdd`は除外範囲である。同じ結果を各確認者へ渡し、重複実行しなかった。

Darwinはtrace CLIと親追加4試験、doctor／workspaceの計7ファイルを独立確認しPass・指摘0。Russellはkernel、Provisioner2、同意、Authority、Mountの計6試験を独立確認しPass・指摘0。各自が作成した試験は他方へ割り当てた。Wegenerは品質・CHG・ロードマップの6文書と根拠の接続を確認し、現在表の時点不一致と測定対象の再識別不足のMinor 2件を返した。追加の本番欠陥や試験必須条件は検出されなかった。

全結果を取得して3者と記録限定の是正方針を整合した後、現在TEST-01行とLock表を同期し、上記の対象TS識別・改名前後の区別・最新結果を追記した。過去の1,520件結果、失敗、署名実測本文は変更しない。コード変更・再試験・再署名をこの記録是正の前提にせず、記録の限定再確認へ渡す。

是正後の共通Checkerは2026-08-31T17:20:19.086Z、389文書・2,734リンク・909アンカー・固定履歴24、エラー・警告0、exit 0。Wegenerが2指摘の解消、全13TSのHash一致、測定時点と現在表示の区別を再確認し、限定Pass・追加指摘0を返した。これによりTEST-01の未到達評価・追加試験部分を解消と判定する。変更後の正式実測、Runtime全体完成、統合・Releaseはこの判定へ含めない。

### 現在の後続処置

全体再試験後のChecker契約試験では207/208成功、1件失敗だった。原因は追加したLock試験の変数名`NativeWorker`と`data`が既存命名規則に適合しないことであり、試験内で`nativeWorker`と`workerPayload`へ変更した。意味・本番コードは変更していない。是正後のLock全25件と命名7件は32/32成功、32,153.8304ms、exit 0。上記のTAP／LCOVは改名前の測定として保持する。

担当責任者はQual-Lab。今回の未到達評価・追加試験と記録2点の独立再確認を完了し、署名版`48515eb`で変更後の正式実測も成立した。[Runtime完成](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)と[Tool・品質記録の是正](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)の同じ未リリース変更で、結果記録の限定確認を完了し、全体完成評価を追跡する。現在の完成判断に必要な事項を次版へ保留せず、分類・移行の最終採用と統合・リリースは人間の判断へ残す。

[署名版48515ebの再実測](2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)で4経路4/4、固定Workerの復旧7シナリオ、実Task取消と通常回収を確認した。4f10201と旧45ea2acの実務・是正結果は各版に限定して保持し、過去の実測版を書き換えない。これ以降の結果・現在案内の同期は文書だけの変更であり、Runtimeの実行契約・署名配布物・測定値を変えない。記録更新のための再署名・Provider再実行は行わない。

<a id="completion-assessment-147fb29"></a>

## 署名実測後の全体完成評価

対象はCommit `147fb295dc87ba3cdb1544a7cd7220101aefb496`、Tree `84b5817fcf7ea9301208be48e9e68d5d90b99fc6`。2026-09-01に3系統の独立確認を行い、全結果を取得してから記録の同期方針を照合した。対象成果物は確認中に変更していない。

共通Checkerは2026-08-31T17:47:44.743Zにリポジトリ全体へ実行し、389文書・2,736リンク・919アンカー・固定履歴24、エラー0・警告0、exit 0。同じ結果を各確認者へ渡し、重複実行していない。Git管理外の`.crdd`全体を検査した意味ではない。

| 観点・確認者 | 根拠の適用と判定 |
|---|---|
| アーキテクチャ／安全性・Russell | Pass。`98ccc9d`以後の本番変更5ファイルは是正・独立再確認の集合に含まれる。署名版`48515eb`と対象版の`40_Develop`および`template/tools`に差分なし。4経路・復旧・実Task取消の記録Hashも一致し、現在の完成条件を阻む追加の実装事項は検出なし |
| 試験／利用体験・Darwin | 確認済み範囲に追加の実装指摘なし。1,585試験、Checker208試験、開発E2E286試験と独立確認を検証義務へ接続。UX／IA／UI／SPECの操作、表示、同意、候補と採用、取消、回復の分離を照合。全対象の完成判定は下記WT-SCOPE-01が残るため条件付き |
| 文書／不足影響／準拠・Wegener | Pass、追加指摘0。未リリース7意図（CHG-000012／013／014／015／017／054／055）、CHANGELOG英日、移行、README、ひな型、CHG-000055 §24～26、品質記録、ロードマップを照合。`98ccc9d`以後のルート規範・ひな型・READMEは不変で、既存監査と後続是正の有効範囲を接続できる |

各確認者が以前に作成した試験・文書の独立性は、他担当による確認結果から確保した。今回の判定は試験件数、coverage率または担当者の名称だけを根拠とせず、担当観点の契約、変更範囲、利用側と実測条件を照合している。

旧`45ea2ac`の実務・是正は、変更されていないTask指示・是正搬送・レビュー・候補処理の限定根拠として適用できる。変更された共通Process／Git境界は個別の反証試験と新しい署名実測で補完した。旧版の処理時間や成功率を現在版の測定値へ読み替えず、追加の再署名・Provider再実行を今回の記録更新の条件にしない。

### 完成評価時点で残った処置

| 事項 | 不足・影響 | 次の処置 |
|---|---|---|
| WT-SCOPE-01：端末の対象と実測範囲 | [UI §4](../../04_UI/01_User_Interface.md#4-現行表示の参照と表現方針)と検証設計はWindows Terminal／PowerShellを対象とするが、実測は`WT_SESSION=false`のPowerShell。PowerShell限定へ変更した明確な人間判断はなく、Windows Terminalを確認済みとはできない | Qual-LabがWindows Terminalで指定項目を追加確認するか、現在の対象を確認済みPowerShellへ限定するかを判断する。前者は端末観測結果、後者は明示した対象範囲と影響を現在の品質状態へ接続する。未処置のまま全体完成へ昇格しない |
| 候補の採用・分類・移行・統合 | 7意図の完成評価と、最終的に採用することは別。特にCHG-000055の規範候補・移行必要の評価案は人間による最終採用前 | 端末の処置後、対象固定版と7意図の分類・条件付き移行を示してQual-Labの判断へ渡す。独立に保留できる意図を不可分な一択にせず、Stable化・統合を先取りしない |
| リリースと未完了作業の整理 | 完成評価は公開許可ではない。長期研究、自律Operation、Issue #30、統合・Releaseの未処置部分は残る | 必要な採用判断後、完了根拠をCHGへ接続して完了部分だけロードマップから除く。最終Releaseは統合後Identityと必要な確認を対象に別途判断する |

Windows Terminalの扱いは既存対象の未確認であり、新しい実装要望ではない。読み上げは承認済みの未評価範囲として維持する。全OS・全取消タイミング・全Desktop修復操作、悪意ある同一ユーザーへの完全耐性、初見理解時間、人間の実作業時間、利用枠分散や直接実行に対する総合優位を今回のPassから主張しない。有用性の限界は[既存の集約評価](../../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)を維持する。

今回の完成確認記録、Quality Center、ロードマップの3文書を同期した差分はWegenerが限定再確認し、Pass・追加指摘0だった。共通Checkerは2026-08-31T17:53:42.753Z、389文書・2,737リンク・925アンカー・固定履歴24、エラー0・警告0、exit 0。担当別判定の記録一致、WT-SCOPE-01と人間判断の分離、旧根拠の保持を確認した結果であり、端末未確認や全体条件付き判定を解消したものではない。

<a id="windows-terminal-verification"></a>

## Windows Terminalの追加確認と残件の解消

2026-09-01、承認済み対象を狭めずWindows Terminalで追加確認した。対象Commitは`8901820`。署名版`48515eb`から`40_Develop`および`template/tools`の差分はなく、現在の入力・表示関数を使う既存の参照プログラムを実行した。秘密入力、署名、外部送信、Provider実行は行っていない。

| 観測対象 | 結果と限界 |
|---|---|
| 実行環境 | Windows `10.0.26200.0`、PowerShell `5.1.26100.9168`、Node.js `24.19.0`、`WT_SESSION=true`。起動前にインストール情報からWindows Terminal `1.24.11911.0`を確認。script内の版表示だけを実行版の検出根拠にしない |
| 時刻・幅 | ローカル時刻2026-09-01 02:55:59～02:56:21（JST）。初期幅120列。利用者が変更した後の列数と拡大率は未取得 |
| 入力一致 | `123456`で`matched`、期待結果一致、回収確認済み、exit 0 |
| 入力不一致 | `654321`で`mismatched`、期待結果一致、回収確認済み、exit 0 |
| 時間切れ | `timeout`、期待結果一致、回収確認済み、exit 0 |
| 入力待ち取消 | 時間指定による`cancelled`、期待結果一致、回収確認済み、exit 0。実Taskへ物理Ctrl+Cを送った試験ではない |
| 終了・表示 | `TERMINAL_CHECK_EXIT=0`。終了後も画面を残し、日本語と長いIDの折返し・文字拡大を確認するよう案内した。利用者は「読めた」と回答。人間の表示観測であり、全端末・支援技術の対応を証明しない |

生記録はRepository-localの`.crdd/test-tmp/windows-terminal-check-e2507818135f43db875b9756cc22501e.log`、SHA-256 `8ec08ce73f9917bb8bd63a4bee71b0748faf82dd6747ddad1dfed6c9afc5627c`。起動scriptは`.crdd/test-tmp/windows-terminal-check-147fb29.ps1`、SHA-256 `9a12f412ba2c69df9fae6d935db180174f81f59527ed1e1dfa7870a9f4655ea2`。表示例は`.crdd/test-tmp/terminal-display-reference.ts`、SHA-256 `7d56a7b4d05b08f79f4fddcdf294ec92c457b6cc71431c051fba66ba9f94970d`。起動script名の旧短縮Commitは実行対象の同定に使わず、上記対象Commitと実装差分を用いる。

Transcriptには文字の重複、行の折返し、表示例の未収録があり、画面の完全記録とは扱わない。4件のJSON結果と終了コードは実行結果、人間の回答は表示の観測として分離する。実TaskのCtrl+Cと通常回収は[署名版48515ebの実測](2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)を別根拠とする。

Darwinが実ログのHash、実行環境、4結果、使用する入出力関数、実装差分と人間の回答を独立確認し、追加確認を限定Passとした。これによりWT-SCOPE-01を解消と判定する。追加実装、再署名、再実測は不要。読み上げ、全環境・全取消時点、総合的な有用性の未実証は既存の限界として維持する。残るのは7変更意図の内容採用・分類・移行、工程移行・統合、最終リリースの人間判断であり、確認結果から自動承認しない。

本記録、UI、Quality Center、ロードマップの4文書の同期差分もDarwinが限定再確認し、Pass・追加指摘0。共通Checkerは2026-08-31T17:58:51.040Z、389文書・2,741リンク・930アンカー・固定履歴24、エラー0・警告0、exit 0だった。旧条件付き評価の保持、追加確認による解消、人間の判断待ち、観測の限界が一致することを確認した。Runtimeコード、署名済み配布物、過去の実行記録は変更していない。

<a id="release-preparation-verification"></a>

## 公開準備の追加差分の検証

基準Commitは`6a4f09d7623f49118650cbae79d6bd1c41f37a16`、Treeは`850527920cbb29704f4b189544963f68dff885e3`。準備ブランチで、期限なしmanifest revision 3、期限付きrevision 2の読取り互換、公開案内、およびCheckerの表示解析を確認する。対象の検証義務は[検証設計](../03_Verification_Design.md)を参照する。以下は開発確認であり、公式鍵、実Providerまたは実Docker操作は使用していない。

### Runtimeの開発確認

Windows上のNode.js `24.19.0`を絶対Pathで起動した。基準版に対する`40_Develop/coordinator`と`40_Develop/platform-access/src/bin/coordinator.rs`のGit binary diffのSHA-256は`1233bc4c96e7e09a41d96aed99a7306fc21a62ff9718cabc453846f02788c06d`。新規の共有入力`tests/fixtures/release-manifest-validity-vectors.txt`は別途SHA-256 `98fcfb319002f248c5772f27310f50dc3442efddaacd5c3926f21e690f7ee35e`で同定する。後続の文書記録変更をRuntime実行版の変更へ読み替えない。

| 確認 | 結果・範囲 |
|---|---|
| Coordinator全試験 | 1,588/1,588、失敗・取消・skip 0、109,925.9063ms、exit 0 |
| 開発E2E | 既存12試験ファイルの286/286、失敗・取消・skip 0、exit 0。全試験と重なる件数を加算して独立な網羅数にしない |
| 期限契約の重点確認 | TS関連9ファイル111/111。rev2期限付き、rev3期限付き／期限なし、時刻境界、型不正、revision不一致、CLI排他指定、秘密入力前停止を確認 |
| TS・Rustの共有入力 | TS 13/13、Rust manifest 2/2。共有する3入力で受理意味を照合 |
| Native全試験 | fresh targetで35成功・2 ignored、失敗0。Registry Effect試験は未実施。親から起動するprobeは単独実行対象としてはignoredで、親試験内での実行は成功 |
| 静的確認 | Coordinator production／testの型検査、Biome lint・format、Rust rustfmt・Clippyは成功 |
| 設計対応検査 | `accepted`。資源9、状態20、遷移21、不変条件10、検証対応10。件数だけを動的観測の代用にしない |

### 初回失敗と再確認の区別

最初の制限付き実行では、Coordinator全試験は1,581/1,588、開発E2Eは284/286だった。失敗は実Node子Processの終了観測に集中し、`provider_cancellation_grace_exceeded`または終了未観測を返した。同じソースを通常のWindows権限で実行すると、関連結合17試験、上記全1,588試験および開発E2E286試験が成功した。試験の判定、待機上限、Runtimeコードはこの再実行のために変更していない。

実行環境の制約が主要な原因候補だが、初回のOS側拒否理由そのものは取得しておらず、特定APIのアクセス拒否と断定しない。初回と再実行では複数の試験集合が一部並行したため、負荷を完全に固定した比較でもない。初回失敗を削除せず、制限付き環境でも成功したとは主張しない。

以下の生ログはRepository-local `.crdd/test-tmp/`に保持する。Git管理対象ではなく、恒久記録は本節の対象・条件・結果・限界である。

| ログ名 | SHA-256 |
|---|---|
| `release-preparation-coordinator-2026-08-31T18-30-58-029Z.log`（初回） | `877379853fdc4f4efc6730c8882b357d69046ba001ec9db9820a689c67315ca3` |
| `release-preparation-development-2026-08-31T18-31-12-336Z.log`（初回） | `4aece41822b76d2734f0d994c191d35c1ada86f67c92f2539d9f1d0ed21a7fc3` |
| `release-preparation-coordinator-2026-08-31T18-34-05-147Z.log`（再実行） | `f62cf3478a993161e896317369f4206a58a271c181397d2c2e4f63e2f831cb75` |
| `release-preparation-development-2026-08-31T18-33-45-188Z.log`（再実行） | `b9dbabe5895d54f7c4f0d8c72c9e31161f2865cf07babe913492dd68e66d33db` |

### Checkerの追加確認

実ヘッダー、README冒頭の版表示、移行注記の表示語を対象とする31回帰例を追加した。Checker契約ファイルは232/232、197,005.6147ms、命名・試験発見の全7件は7/7、37,520.1317msで、どちらも失敗・取消・skip 0、exit 0。2試験ファイルを別々に実行し、現在の全所有試験239件を確認した。型検査・Biome lint・formatも成功した。

配布正本`template/tools/crdd-check.ts`のSHA-256は`cf39857e0f5b0a52e6bb3cf3c79965cc0fa0883de0d63fe379327805adf88492`、契約試験`40_Develop/checker/crdd-check.contract.test.ts`は`b4332bbe82ae701873ebb3707510eab033a76699e962a9dd3282043eb6a2860c`。生TAP `.crdd/test-tmp/checker-header-migration-final.tap`は`cfe79eefde6483a3b4526d721296613d99d4ac8e68e0c00b5f5b71bce2b01526`。規範上の移行義務、過去CHANGELOG、履歴Evidenceを変更せず、現在の正しい表示を検査できることと、真の不一致・不足を拒否することを分けて確認した。

### 追加差分の独立確認と是正

基準版に対する全追跡差分のGit binary diff SHA-256 `b476ca4155880c6510028a6e7b32d3ec45fd403274d5e1b27c9e7b631725d5d9`と、上記の新規共有入力を固定して3系統へ渡した。親が実行した共通Checkerは2026-08-31T18:40:03.607Z、389文書・2,754リンク・946アンカー・履歴24件・版付き正本28件、エラー0・警告0、exit 0。Git管理外は未確認範囲であり、各確認者は同じ全体検査を重複実行していない。

Russellは自身が実装していないRuntimeの期限契約を、生成・現在検証・履歴検証・Native・利用側・他の期限との分離まで照合し、限定Pass・指摘0とした。Darwinは自身が実装していないCheckerを確認したが、Wegenerの文書／不足影響／準拠確認で以下2件が検出された。全結果取得後、Darwinは説明なし項目の見逃しを認め、当初の無条件Passを当該項目未解消へ訂正した。

| 指摘 | 原因・是正方針 | 保持条件 |
|---|---|---|
| DGI-REL-01 | CHANGELOGの恒久見出しに「準備中・予定日」が残る。英日を公開前後で成立する差分説明と公式Release参照へ変更する | 公開・最終署名済みと先取りせず、旧版の実測・移行・過去CHANGELOGは変更しない |
| DGI-REL-02 | 移行ラベルの存在だけを確認し、説明が空でも受理する。旧新ラベルの一致後に非空白の説明があることを確認し、各ラベルの空・空白・内容ありを回帰試験にする | 説明の十分性を機械推論せず、表示語の閉集合、機械キー、移行義務を維持する |

3者が統合是正方針の整合を確認してから変更を開始した。Runtimeの契約・実装は変更せず、当該限定Passを維持する。英日CHANGELOGの公開条件を時点非依存へ修正し、過去v0.17.0以下の英日本文不変を照合した。

Checkerは旧新・英日・7分類ごとに28試験を追加し、それぞれ空／空白／内容ありの3入力、計84検証を行った。最終契約ファイルは260/260、213,100.8043ms、命名・試験発見は7/7、42,136.8427msで、現在の全所有267件が成功した。失敗・取消・skip 0、exit 0、型・lint・formatも成功。これは前節の239件後に行った新しい確認であり、両者を加算しない。

是正後のChecker本体SHA-256は`cbce71becbd2b717b7bb9133815805e82402ff07b4329ee48ac516a81e0a7508`、契約試験は`f38281782be3756ed8f38a74a074861ce15c84ccabe927a500c68cba36921bba`、生TAP `.crdd/test-tmp/checker-migration-explanation-final.tap`は`8663243444f11a1103cb4e2801dc79064b52a794786d21229ea88288dd44da45`。

是正後の全追跡差分SHA-256 `b3b3652956117af6aa4e1e8123ff854ba9e4bfa12c34e71066b07ae43e8f64f3`と同じ共有入力を固定して限定再確認した。共通Checkerは2026-08-31T18:48:50.001Z、389文書・2,755リンク・947アンカー・履歴24件・版付き正本28件、エラー0・警告0、exit 0。DarwinがE2を、WegenerがE1／E2と結果の記録を再確認し、双方Pass・追加指摘0だった。これにより2指摘を解消と判定する。本段落と現在案内の同期は結果メタデータの追記であり、確認済み実装や試験条件を変更しない。

### 残る確認

最終統合版の正式署名、4経路・復旧・公開Task入口および配布ZIPの確認は、本節の開発試験・独立確認とは別に完了を判定する。担当責任者はQual-Lab、追跡先は[公開準備計画](../../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#release-preparation-20260901)。これらが未完了の間は追加差分をRelease可能としない。
