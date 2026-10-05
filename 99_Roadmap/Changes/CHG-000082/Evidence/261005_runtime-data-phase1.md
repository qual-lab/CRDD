# Runtime Data整理① — tmp／verification

成果物種別: CHG実施・確認記録。
状態: ①の承認済み限定整理は独立確認Pass。②〜④は未着手。
対象: Repository-local `.crdd/tmp`と`.crdd/verification`。

## 1. 結論

検証履歴JSON 2件と終了済み資料を正規の`artifacts`配下へ集約し、Cargo増分キャッシュ、導入済みInstallerと試験中断残存を回収した。現在の固定Path入力と依存する可能性がある既存資料は、人間判断により元位置で保全して④へ引き渡す。①は全一時領域を空にする工程でも、製品全領域の自動清掃実装を完成させる工程でもない。次の全E2E義務、署名候補、認証、固定Native試験物と未解決参照を失わせず、限定整理と有限な保全例外を独立確認する。

## 2. 基準と変更経路

同じCHG-000082の[縮小計画](261004_runtime-state-shrink-plan.md#14-repository内整理の適用順)として、①から順に扱う。配置・清掃はRuntime Data詳細設計、必要根拠はQuality、実装・反復ToolはCoding StandardsのOwnerへ接続する。

今回は内容保全移動と再生成可能なBuild cacheの限定回収であり、回復契約、署名配布物、認証、外部AI、Dockerの操作は変更しない。実装・試験の意味を変える後続是正は、別の固定候補で静的確認、必要な回帰、独立レビューを行う。今回の確認をその完成後レビューへ流用しない。

## 3. 確認した母集団

| 対象 | 初回確認 | 処置 |
|---|---|---|
| `tmp`直下 | 413ファイル、1,465.91MiB。Script 243件、JSON 36件、Text／result 97件、Archive 25件等が混在する。 | 参照・用途・利用側の分類対象。今回一括移動しない。 |
| `verification`直下 | 初回18ファイル。 | 履歴JSON 2件と旧実測出力16件を正規Artifactへ移動し、直下は0件になった。 |
| `verification`全体 | 読取り可能範囲で6,987ファイル、約1.48GiB。 | 容量概数は調査時の観測であり、アクセス制限領域の完全な棚卸しではない。 |
| 五つの検証Build領域 | Cargo targetと結果・Fixtureが混在する。 | 増分キャッシュだけを対象にする。 |

全体容量は調査時の1,516.47MiBという集計値を用いる。個別領域のアクセス拒否が後に判明したため、これを全Filesystemの完全観測としない。

## 4. 内容保全移動

移動先は`.crdd/verification/coordinator-retention-inventory-261004/artifacts/`である。

| ファイル | SHA-256 | 結果 |
|---|---|---|
| `exact-e2e-residual-1791122131821.json` | `f46adbfa0281df3c3cfa4398c1010f8473d4c19d905f5b1796b5d08efab7a6d8` | 内容不変、旧位置不存在。 |
| `exact-recovery-recheck-1791121454825.json` | `13e73f3121bd39b690483a098f2468a8cd1c747d55b8bc7b97b974c8c87cb689` | 内容不変、旧位置不存在。 |

現行CHG Evidenceの参照2箇所を更新した。過去の原結果内のPath、Identity、観測結果は書き換えていない。前に移動した棚卸しMarkdownも同じ保存領域へ残す。

## 5. 増分キャッシュの限定回収

対象は`.crdd/verification/`内の次の五領域に限る。

- `chg-000082-native-capacity-261003`
- `chg-000082-native-test-owner-261003`
- `chg-000082-terminal-publication-261003`
- `chg-000082-native-protection-261003`
- `chg-000082-terminal-current-261003`

各領域の`target/debug/incremental/`と`target/x86_64-pc-windows-msvc/debug/incremental/`だけを回収した。RustのSource、依存、固定試験実行物、結果、署名配布物は削除していない。

| 確認 | 結果 |
|---|---|
| 絶対Pathと範囲 | 全対象が検証済みRepository内の列挙済み領域にある。 |
| Link／Reparse | 対象の親経路と対象内で0件。 |
| 使用中確認 | 対象Pathを含むProcessのコマンドライン・実行物Path、およびCargo／rustc／link／clを照会し該当0件。全OS資源不存在の証明ではない。 |
| 回収 | 10領域、2,916ファイル、528,256,188 byte（約503.8MiB）。 |
| 終了確認 | 列挙した10領域の残存0件。 |
| 保全確認 | 五領域直下の記録・Source等とtarget内の非増分領域の選択した記録・実行物等、647ファイルの前後SHA-256が一致した。全Repository不変の主張ではない。 |

初回の処置コマンドは構文エラーで実行前に停止した。次の確認は`capacity-r1`へのアクセス拒否で削除前に停止した。対象をcacheと直下保全物だけへ限定した後に上記処置を実施した。アクセス拒否を不存在へ畳んだり、ACLを変更したりしていない。

## 6. 残る是正

| 項目 | 必要な処置 | 未処置の理由 |
|---|---|---|
| Native実機Fixtureの固定Path | `windows_terminal.rs`と`windows_protection.rs`の固定試験実行物・作業Rootを、再生成可能な正式試験入口へ接続する。 | 現在のWorker所有・同一性確認を弱めずに移す必要がある。target全体は保全した。 |
| 旧Launcherと出力16件 | 初回分類後、旧Launcher 8件と出力16件を同じ履歴Artifactへ内容不変で移した。 | 現行入口からの参照はなく、旧Scriptを新しい実行入口として再利用しない。完了後の保持再評価は残る。 |
| tmp直下413件 | 実行中・再入場・署名準備・候補・結果・再生成物を区別する。 | 拡張子と経過時間だけでは廃棄できない。 |
| アクセス制限Fixture | 元の試験Ownerと終了条件を確認する。 | 観測不能のまま一括回収せず、追加の保護変更を今回推定しない。 |

この表は初回時点の未処置を示す。現在の処置と人間が承認した④への引渡しは§13を優先する。②のProject Runtime世代履歴、③のExecution不変記録、④の署名Release Treeの清掃はまだ変更しない。

## 7. 限定処置の読取り確認

別の確認者は移動先2JSONの現在Hash、CHGの参照2箇所、実施順と未完了表示を確認し、記録に重大な誤りや危険な完成主張を認めなかった。削除前のProcess／Reparse観測、回収量と前後Hashは過去の観測であり、確認者が独立再実行したものではない。①全体の完成後レビュー、製品回復のPass、全E2E Passには昇格しない。

## 8. 旧実測入力・出力と導入済みInstallerの整理

### 8.1 旧v0.21 Launcherと出力

`tmp`直下の旧v0.21 Launcher 8件を、対応する出力16件とともに`.crdd/verification/legacy-v021-docker-repair-261005/artifacts/`へ移した。全24件の移動前後SHA-256は一致し、`verification`直下のファイルは0件となった。

Source、Workflow、CHGと一時Scriptの参照を照合し、8件のLauncherを現行の入口として参照するものは見つからなかった。処置直前のProcess照会でも対応コマンドラインは0件だった。履歴Scriptの固定Path・回復IDは変更せず、実行していない。保存領域の説明に「履歴資料であり実行入口ではない」と記載した。

旧Scriptの恒久Tool化は行わない。現在の正式入口を使うために必要な能力は既存Workflowへ接続し、古い操作をそのまま再利用しない。CHG／検証参照終了時に必要な根拠の昇格・清掃を再評価する。

### 8.2 Docker Desktop Installer

`.crdd/tmp/Docker-Desktop-4.93.0-Installer.exe`は導入済み外部製品のダウンロード物として回収した。実装・署名配布物やDocker実行データではない。

| 確認 | 結果 |
|---|---|
| 導入済み実行物 | `C:/Program Files/Docker/Docker/Docker Desktop.exe`のProduct Versionは`4.93.0.240920`。 |
| 回収対象 | 正規Repository内の通常File、627,791,792 byte。 |
| SHA-256 | `c139124c9cf71477dc565c3c0ea5a18f90b93d68ebe9aaa848a065960416c0bc`。 |
| 使用中 | exact Pathのコマンドライン・実行物Path、Docker Installer Processの照会で該当0件。 |
| 終了後 | Installerの不存在を確認した。 |
| 非発行 | Docker開始・停止・再起動、インストール、Provider依頼は発行していない。 |

Docker本体、認証Home、Container、Image、Network、永続データはこの処置で削除していない。Installerがなくても導入済み実行物は残るが、将来再導入する場合は別途取得が必要である。

増分キャッシュとInstallerの回収合計は1,156,047,980 byte（約1.08GiB）である。履歴資料の移動は容量削減に数えていない。

## 9. 終了済み確認記録と動的参照の区別

終了済み確認記録5件を`.crdd/verification/historical-checks-261005/artifacts/`へ移した。

| ファイル | SHA-256 |
|---|---|
| `chg70-check.json` | `239e99bf04ff24de234a6d3ea6ad4632f5d0c112bf7cd876ffdc8606f8cff20c` |
| `ux-check.json` | `fbeada6b351a5b89395b53b9d1651477d69cb8b6deb5ad167509a239f4500ff8` |
| `naming-gap-cfc46179.json` | `9bad7be0ff7d5c5fceeff71bc2a35caca02b30ef92f3731065beb21c5a392701` |
| `source-header-gate.txt` | `99f8093ab5b6faf6a56b81243387dd3f75a0a5c7ca864b861aaba0b5658e1be8` |
| `native-local-item-mapping-20261002.md` | `265ff05093d2610c918576f0d8aaf1ba525c2bc42acdd90c94473220513d0f13` |

全件で移動前後Hash一致と旧位置不存在を確認した。Source、Workflow、CHG、一時Scriptの確認範囲で直接の利用参照は見つからず、確認処理自身を除いたProcess照会でも該当0件だった。最初の使用中照会は確認処理自身に一致して移動前に停止したため、自己Processを除外して再確認した。過去の検証結果を現在のPassとして再利用しない。

一方、現在のE2Eは`workbench-e2e-collection-261004-<case>.result.json`と`*.settlement.json`を動的に参照する。具体的なbasenameが検索に現れないことを、未参照の根拠にはしない。署名用の`*.retention.json`、`*.expected-release.json`と現行E2E結果は今回移動・削除していない。Visual探索の画像も人間判断の根拠になり得るため保全した。

次の処置は、現在のLauncherとその入力・出力の組を特定し、履歴資料と現行の再入場入力を分けることとする。移動する場合はProducer／Consumerの参照も同時に処置する。拡張子による一括移動・削除や、旧結果を失わせる上書きは行わない。

## 10. 全数分類の固定と旧版専用資料の集約

追加整理前の`tmp`直下399Fileを、File名、用途仮分類、byte数、SHA-256で固定した。分類資料は`.crdd/verification/coordinator-retention-inventory-261004/artifacts/tmp-file-classification.md`である。本文、Prompt、認証値は収録していない。用途仮分類は削除可能性の判定ではない。

旧v0.20／v0.21専用の92Fileは、既存の`.crdd/verification/legacy-v021-docker-repair-261005/artifacts/`へ集約した。全92件で移動前後Hash一致、旧位置不存在を確認した。Repository実装・Template・Workflowと一時Scriptの直接参照照合では、この組の内部参照だけが見つかった。処置前の対象名に一致する他Processは0件だった。旧入力・出力の本文、固定改訂版と回復IDは変更していない。履歴Scriptは実行入口として再利用しない。

`tmp`直下は307Fileとなった。追加の履歴Directoryを作って回数分増殖させず、既存の保管単位へまとめた。現在のE2E入力・Script、署名用の保持情報、Visual資料とBuild入力は保全した。上記分類資料の予定処置には、④のRelease入力照合へ引き渡す対象も明記した。

再利用するE2E能力の正式入口化と、終了済み試験Fixtureの終了処置は残る。現在の一時E2E Scriptには旧HEADと作業差分Hashの固定、隣接Helper、相対importと結果名の動的参照がある。これらを単純移動して実行可能と主張しない。必要な能力だけ正式Sourceへ接続し、新しい固定候補で確認する。単発Native反証Fixtureを一律に製品Toolへ昇格することも要求しない。

## 11. 試験所有の中断残存と増加の再確認

`.operations`の10記録はOwnerが`runtime-data-test`、状態が`recovery_required`、世代1、Evidence昇格不要であり、既存の中断試験名と一致した。記録中のOwner Process ID `15696`／`24332`は現在のProcess照会では存在しなかった。名前だけで削除せず、各耐久記録のexact Identity・世代を既存の`resumeTemporaryOperation`へ渡し、新世代のCapabilityを取得して`settleTemporaryOperation`で失敗終端へ処置した。

全10件が`temporary_operation_settled`で終了し、作業Directoryと制御文書の不存在を明示的に確認した。制御文書の手動編集、Lockの強制解除、Docker操作、Provider依頼は行っていない。一回の実施入力は同じ棚卸しArtifactの`cleanup-test-residuals.ts`に保存した。これは新しい汎用Cleanup Toolではなく、処置済みの同じ対象へ再実行しない。

Formatter確認、型検査、Warningを失敗とするLintの後、Runtime Data全36試験が成功した。試験後に`.operations`の直接File 0、`.operations/.staging`のFile 0、`tmp`内の`runtime-data-test-*`Directory 0を確認した。この実測では新しい未処置残存は増えていない。全Repository、全Subsystemの増加防止を証明した結果ではない。

## 12. 一括退役の停止と残る判断

署名retention／expected-release、現行E2E再入場情報を含む一括退役案は、固定Pathの動的Consumerを壊す可能性があるとして実行環境の安全審査に拒否された。移動処理は実行されておらず、307Fileは元位置に残る。別経路でこの拒否を迂回しない。

残る対応は、現行候補の入力・保持情報を元位置に保全したまま、調査履歴だけを退役させる範囲を再固定すること、および現在のConsumerを保つ移行を個別に確認することである。入力の移動が必要な場合は、exact対象、移行先、Consumerの更新、再実行への影響を示して人間判断を得る。①の完了・独立レビューPassはまだ主張しない。

共通増加防止は[縮小計画§15](261004_runtime-state-shrink-plan.md#15-①④共通の増加防止)へ整理した。自動清掃と有限保持は今後の各Ownerの実装課題であり、計画への記載だけで全領域を実装済みとはしない。

## 13. 承認後の処置と①の出口

2026-10-05、人間は「現行入力を元位置で保全し、④で参照先を確認して回収する。その他の履歴整理を先に閉じる」扱いを承認した。これは署名・E2E入力の一括移動、過去の不明結果の成功化、未完了試験の免除を承認したものではない。

追加で、終了済みの文書・Source移行用Script17件を既存の`.crdd/verification/historical-checks-261005/artifacts/`へ内容不変で移した。実装、Template、Workflow、CHGと一時Scriptの直接参照確認では該当参照なし、処置前の他Process照会も0件だった。全17件の前後Hash一致と旧位置不存在を確認した。過去Scriptは現在の実行入口にしない。

| 対象 | 現在の処置 | Owner・再評価契機 |
|---|---|---|
| `tmp`直下の既存290File | 元位置の有限集合として名称・Hashを固定して保全。全件の現在必要性を確認済みとは主張しない。 | CHG-000082整理担当。④のConsumer・保持照合と次の固定E2E準備。 |
| 既存63Directory | `.operations`は通常制御面として維持。他のBuild、Native／Browser試験、署名組立て、認証関連実測領域は名前だけで回収しない。 | ④でOwner・参照・必要根拠を照合。認証情報を一括移動・複製しない。 |
| 固定Native試験実行物とアクセス制限Fixture | 保全。安全な再生成・終了条件を確認せずACL解除やtarget全体削除をしない。 | ④の試験領域整理。既存の保持期限を削除許可へ読み替えない。 |
| 移動済み履歴・分類作業資料 | 既存の三つの保管単位へ集約。新しい実行ごとの保管先にしない。 | ④とCHG Gate終了時に必要な根拠だけ残して再評価する。 |
| 次のE2E能力・未完了case | 義務を維持。旧HEAD／dirty固定Scriptを現在の再実行入口として扱わない。 | 次の固定E2E入口を準備する担当。正式入口が全能力を持つとは未確認。 |

有限保全集合は`.crdd/verification/coordinator-retention-inventory-261004/artifacts/retained-inputs.md`にある。新規追加は認めず、新しいScriptは正式実装・試験入口、一回の作業物はOperation所有領域へ置く。④ではこの固定値との差分、現在参照、Owner、保全・回収条件を確認する。①の完了が④の物理回収完了を意味しないことを維持する。

保存量の増加防止をRuntime Data詳細設計§3.1へ戻し、Coordinator Workflowに検証／CHG Gate終了時の保持確認・清掃を接続した。現在の検証記録を自動削除しない契約は維持し、新しい回復Frameworkは追加していない。通常ログの数値上限と自動ローテーション、Project Runtime／Execution／Releaseの実装・移行は各後続段階の未完了事項である。

## 14. ①の独立確認結果

読み取り専用の確認者`coordinator_retention_shrink_alignment`が、固定したRuntime Data設計、Coordinator Workflow、縮小計画と本記録を、文書・影響・保全の観点で独立確認した。結果は限定Pass、指摘0件、確信度は高である。

確認者は保全集合290件の現在byte数とSHA-256、`tmp`のFile290／Directory63、元位置保全と④への有限引渡し、新規追加禁止、未完了E2E・未実装自動清掃の維持を確認した。削除前のProcess／Reparse、移動前Hash、過去の回収処置と36試験を当時に独立再実行したとはしていない。

確認対象の固定値は次のとおりである。この結果追記と状態投影は固定候補に対する確認結果の記録であり、保持・削除契約の追加変更ではない。

| 対象 | レビュー対象SHA-256 |
|---|---|
| Runtime Data詳細設計 | `ebd17580f867e8da0c1442632975fdc4e7afb57fa485f5176ab87d4be697b4e1` |
| Coordinator Workflow | `8f111f39ac435ea492d58a4d0b50e15081c5ecb2746fe5de89126c74166a481d` |
| 縮小計画 | `f6349e55a1e377fbc7dd543bfc01a994789d7092c278809055787081cf1902bd` |
| 本記録 | `c27fa0a1012a5746dc59299e87fccc464a31b6eb1d5b16e8deb13a52a71919cc` |

結果のProject Context投影を追加確認した際、リセット前の旧Host三件を現在も未処置とする表行が見つかった。Owner Evidenceの明示リセット結果へ現在事実を合わせ、旧三件の観測を履歴として分離した。再確認はPass、追加指摘なしである。個別の旧三件を通常の製品Recoveryで清掃成功したとの主張や原Evidenceの履歴変更は行っていない。

Passは人間が承認した①の限定出口に限る。④のConsumer全数確認と物理回収、Coordinator縮小実装、全E2E、製品回復やReleaseのPassではない。次は②のProject Runtime世代・終了記録を、同じ保持分類で確認する。

## Checklist

- [x] 人間が指定した①から順に着手した。
- [x] 履歴根拠の移動で本文・Hashを保全し現行参照を更新した。
- [x] 再帰削除の絶対Path、Repository境界、Reparseと使用中を処置前に確認した。
- [x] 固定試験実行物の参照を検出し、target全体の回収を止めた。
- [x] Access Deniedと不存在を区別し、保護を解除していない。
- [x] 移動と回収を製品回復成功・E2E Passへ読み替えていない。
- [x] 終了済み資料と、④でConsumer照合が必要な固定保全集合を区別し、承認された引渡しのOwnerと契機を記録した。
- [x] 一時領域の既存APIで十件を回収し、全36試験後の試験残存0を確認した。
- [x] 保全集合への新規追加を許可せず、保持規則を設計・利用手順へ接続した。
- [x] 承認された①の限定出口を固定候補で独立確認し、限定Passと後続の未完了義務を記録した。
