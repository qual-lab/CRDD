# 3モデル分離の限定検証

対象変更: CHG-000082
基準版: a7618c6d0fdade66fab1f81f24de714e21822f08
状態: 限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
更新日: 2026-11-12

## 対象と主張の範囲

[分離方針](../domain-model-three-package-plan.md)に従い、文書・実行・構成の3モデルを型依存も含め独立させた。旧domain-modelの互換入口と第4の共通Packageは追加していない。保存Schema・Path・Lock・CAS・Principal・回復参照は維持し、既存の保存物は移行・削除・再解釈していない。

今回の対象は実装、全Consumerの静的確認、限定回帰、独立レビューである。全体回帰、実AI、Dockerの実操作・E2E、過去保持物の操作は対象外。新Packageの成立を製品全体・Release成立へ拡大しない。

## 検証条件

- Node.jsの既存ネイティブTypeScript実行、固定済みTypeScript／Biomeを使用した。
- 新3Packageの開発依存はローカルcacheからoffline・install Script無効で展開した。
- I/O試験はRepository-localの自己生成Rootと実体照合付き清掃を使用する。共有親や過去の同prefix領域を列挙・削除しない。
- Link／Junction／hardlinkを伴う試験は、制限環境のEPERMと製品拒否を区別した。該当試験だけ用途限定で再実行した。
- Checkerの既存試験にOS一時領域の作成が残っていたため、当該試験をRepository-local補助へ是正した。以後の確認はその自己生成Rootへ限定した。

## 静的確認

| 確認 | 現在結果 |
|---|---|
| 新3Packageのformatter・型・警告を失敗とするlint | 成功。既存infoは区別 |
| 全利用側17型設定 | 成功。Lockは既存Co compiler/typeRootsを使用 |
| 3モデル間のSource／型／再export／dynamic／package依存 | 0。公開境界の正負対照で確認 |
| 公開Symbol | 文書294／実行371／構成25。重複0 |
| 旧Rootから外す31 Symbol | 実Ownerへ移管・局所化・必要Result内に保持 |
| 試験台帳411件・Symbolと正式QA対応 | 読取り整合検査の指摘0 |
| 変更差分の空白検査 | 成功 |

## 限定回帰の最終結果

| 対象 | 結果 |
|---|---|
| 文書モデルの公開境界・文書期待Identity・Topic／Meeting・Semantic・Catalog | 9 File・58件成功 |
| 実行モデルの公開境界・純粋モデル・保持scope・State／History／CAS・保存Consumer閉包 | 12 File・84件成功 |
| 構成モデルの公開境界・設定保存・Network・保持設定・config実体 | 7 File・34件成功 |
| AM Root・CROS・wx | 12件成功 |
| Coordinatorの保護Rootと設定接続 | 3件成功 |
| Checkerの公開／Source境界・台帳 | 14件成功 |
| Executorの検証Script・合成CLI・単独利用境界 | 14件成功 |
| 独立レビュー後のAM公開型・Co境界2件・DI独立性2件・AD／VC独立性・Checker配布 | 対象8件成功 |
| WorkbenchのHelper削減後のHTTP定義／開始境界 | 3件成功 |

主要な固定候補37 File・219件に加え、独立レビュー後の追従11件を確認した。途中の失敗は下表の是正後に同じ対象を再確認した。WorkbenchのHTTP接続とChecker配布試験のGit処理は制限環境の拒否を分離し、同じ対象だけ必要権限の審査後に成功を確認した。いずれも今回生成したRepository-local Rootの終了回収を確認している。

Workbenchの局所Record Helperは保存なしの直接対照でも正常値・freeze・余剰field拒否・Getter呼出0・Proxy trap0を確認した。これは既存の正式試験件数へ加算しない。単なるPromise完了や成功件数からProcess不存在・Authority失効・cleanup成立を推定しない。

## 検出事項と是正

| 原因 | 処置 |
|---|---|
| VM Fixtureが非公開化したrequireReady等をRootから得ていた | 実Ownerの私有Moduleを明示注入。製品Rootへ再公開しない |
| 保存・回復の旧正例が保持Contextを渡していなかった | 試験上位が明示日数と既存再検証を搬送。非履歴処理には新ガードを追加しない |
| readSync故障注入が現ReaderのreadFileSyncへ届かなかった | 実際のdescriptor読取りを差し替え、閉鎖・不一致の反証を維持 |
| 旧容量上限を前提にした固定I/O期待 | bytes受理と、その後の同Mapによる置換拒否を対照確認。製品へ上限を戻さない |
| 新SuiteのQAを既存複合Suiteから過剰継承 | 正式Local Item／Headerから再導出し全試験Symbolを照合 |
| Source列挙・Root namespace・動的子Process本文の旧Path | 新Owner・実Moduleへ追従。旧Facadeや代替fallbackを作らない |

## 独立レビュー

初回候補の内容指紋は`1ad90c747efdee34186b5dda4713cfa0bfbbfa9ab796d8a58f131fbe412e20eb`。作成担当と確認担当を分離した3名の読取り専用レビューを実施し、全結果を統合して是正案を各確認者へ再提示した後に修正した。

| 指摘 | 是正 |
|---|---|
| WBへ未使用の配列Snapshotと汎用Path集合が残存 | 未使用処理を削除し、実利用の固定領域だけに限定 |
| AM Root型の正本移管が公開型期待／現在説明へ未反映 | FilesystemStoreRootを含む30関数・27型へ期待と説明を追従 |
| Checker配布Fixtureが旧Packageをコピー | 実利用する文書・構成の2モデルを搬送し、今回生成Rootを回収 |
| Co試験のSymbol台帳／import期待が旧Ownerを参照 | 実行モデルの正本へ追従 |
| DI／AD／VCの独立性試験が新モデルを検出しない | 新3モデルを拒否対象として網羅 |
| 初期化の文書上の配置が実装と不一致 | storage/ensure-area.tsへ追従し、形式だけの再分割は追加しない |

保持設定10箇所の搬送、非履歴処理の要件不変、私有I/OのOwner、保存Schema・Path・Lock Identity・CASを独立確認した。是正候補の内容指紋`53aafa2e8bc716eb6ab84dc86095d85a561258e0b2349aa7aefe8184e723afce`を同じ3名へ読取り専用で渡し、全結果を統合した。必須残指摘は0件。

全レビュー終了後、Workbench利用側の3期待Identity投影呼出しの改行1箇所をformatterへ揃え、本書・計画・正本・現在投影の状態表示だけを実結果へ更新した。意味・公開契約・保存内容の追加変更はない。今回の限定検証範囲の完了を、全体回帰・Release・統合の成立へ拡大しない。

## コミット前の追加確認

人間の追加依頼に従い、旧Packageへの実参照、3モデル相互依存、利用側、台帳Pathと文書の現在表示を再走査した。作成担当から分離した読取り専用の最終確認でも必須残件は0件。3モデルの公開境界・保持設定搬送・CheckerのSource／試験台帳整合を限定再実行し、34件が成功した。Checkerのリンク作成1件は制限環境のEPERM後、同じケースだけ必要権限の審査を経て成功を確認した。試験の既存終了処理で今回生成Rootを回収し、過去保持物は調べていない。

今回、製品Source・公開契約・保存形式への追加変更はない。追加依頼は現在の作業ブランチへのコミット・プッシュを含むが、mainへの統合やReleaseを意味しない。

## 未実施

全体回帰、実AI／実Docker E2E、過去保持物の検査・回収・移行。
