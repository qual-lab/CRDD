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

## 後続区切り：構成モデルの内部責務整理 — 2026-11-12

本節の基準改訂版は`3a69f4af108340db7d1c59bb129ceaa965bc4fde`。上記3分離時点の固定結果とは別の候補であり、今回範囲の実装・限定検証・独立再レビューを完了した。AI選定・Network Policy・保持設定・Manifestの4領域と保存にSourceを統合し、既存Schema・固定所在・JSON条件・Lock／CAS・失敗／回復相関を保持する。

既存の7試験Suiteと安定IDを維持し、Root固定期待、deep Source参照、保存故障注入、EM／VCのConsumer閉包とCoの実体ID取得対照を新Ownerへ接続する。Trust専用の未接続2試験は撤去し、Manifestの完成読取りについて正常Hash・真正不存在・不正Schema・Link・読取り中の置換・close失敗の対照を追加する。Catalogの件数変更や正式QAの自動成功化はしない。

この区切りの構成モデル型検査は成功した。既存7 Suiteの35件は初回28件成功、Link／hardlink権限による6件の停止を同じ6件だけ必要権限付きで再実行して成功、新Manifestの差替え1件は故障注入先をManifest自身のdescriptorに限定して再確認成功した。close失敗も先行するVCのmetadata読取りでなくManifest自身のdescriptorを一度閉じてから例外化し、公開結果のunavailableを確認した。期待する安全判定は緩和していない。

その後、初回候補ではManifestのJSON.parseによる重複Key最終値の受理と生byte Hashを対照し、既存7 Suiteは35件成功・失敗0・skip0、約5.9秒だった。ただし後続の独立レビューで、同候補のManifest受理条件とHash定義に旧Readerとの差異を検出した。この35件の成功を、以下の是正後候補の旧契約維持の根拠へ流用しない。

利用側の限定確認はEM保存Consumer閉包4件、Co実体ID取得点1件とLCOV4件、VC Consumer集合2件が成功した。VCでは今回のCM移設に加え、先行3分離時のCo／Executor／MCP／WB／Visual Previewの実Callerと、撤去済みEM型importの期待表漏れが露出したため、実SourceのNamed importを確認してexact集合へ追従した。Consumer除外や検査対象の縮小は行っていない。

親担当の静的対照では、既存39関数を上記基準版と新Ownerから`sourceDeclaration`で抽出し、型・Block Comment・空白を除いた宣言本文が一致した。新Manifest Readerと撤去したTrust関数はこの母集団に含めない。この対照は移管時の既存関数本文不変の補助根拠であり、全動作同等や未実施境界の成立証明ではない。関係する11型設定も再検査に成功した。

親担当のChecker限定対照「Test Catalog・Symbol・Quality Local Itemの成果物関係を照合する」1件も成功し、CMの15 Source、Symbolの参照Path不存在0、既存Catalog411件との対応を再確認した。

WorkbenchのManifest内容Identity再検証の追加対照は、既存Suiteから実Workspace Routeとひな型MCP LauncherのSource本文を検査する。保持日数の再検証とは別契約である。Suiteの`verifies`へ既存`workbench.http.workspace`を追加する。ひな型Launcher専用の既存Symbolはないため架空IDや新登録体系は作らず、対象Source Pathを既存QAと試験境界の説明で追跡する。この限定対照をRepository全体のSymbol登録漏れ是正とは扱わない。

Manifest利用側はAMのRepository管理23件・AM所在4件・MCP Launcherの公開接続1件が成功した。WB／ひな型MCPの実Sourceから取り出した再認可処理を、同Hash・変更Hash・不存在・観測不能・Root変更・取消と各2回呼出しに接続する局所1件も成功した。Readerの実呼出回数を含めて対照し、手書きした判定の代役で製品経路を置換していない。MCP Launcher確認は公開接続までであり、Workspace EffectやWB実E2Eの成功とはしない。

初回候補の限定確認は構成35件、EM／Co／VCの11件、AM／MCP／WBの29件、Checker関係整合1件で計76件。初回の環境拒否・是正後の同じ試験の再成功は重複計上していない。

上記予定の限定試験は既存のRepository-local生成Rootを終了hookで回収し、今回物以外の列挙・操作は行っていない。下記の検証手順逸脱はこの主張から分離する。正式QA結果を限定試験件数から自動更新せず、独立レビューは別途実施する。全体回帰・実AI／Docker・過去保持物の操作は含めない。

### 独立レビュー後のManifest契約是正（再レビュー済み）

3名の初回独立レビューを統合した結果、2系統を是正した。第1はManifest Readerが旧Document Readerにはなかった単一link拒否と厳密UTF-8拒否を追加し、生byte HashでWB／MCPの旧復号全文比較を変更していたこと。第2はQA記述がAI選定固有の厳密JSON・data descriptor条件をManifest／保持設定にも適用するよう読めたことである。

最初の確認者の一人は、厳密UTF-8／単一linkを既存保証の維持と評価したが、これは誤りだった。着手前の案を旧契約の事実と混同し、旧`fs.readFileSync(fd, "utf8")`の置換復号・nlink非検査との対照が不足していた。親担当は全指摘受領後に実装計画を修正し、各確認者との整合確認を経て、Manifestだけ`bytes.toString("utf8")`と復号後全文のSHA-256へ是正した。JSON.parseの重複Key最終値採用・BOM拒否を維持し、AI等の他設定の厳密JSONや生byte Hash・CASは変更しない。

反証では、displayName内の0x80／0x81がともに置換文字へ復号され、生byte Hashは異なっても旧Readerが返す本文と新Identityは同じになることを確認した。有効hardlink、正常多byte、異本文の異Hash、BOM拒否も同じ既存ケース内へ追加した。是正後の固定Sourceでは構成7 Suite・35件が成功（失敗0・skip0、約6.1秒）。EM／Co／VCの予定11件とChecker関係整合1件も正しい選択条件で再確認成功した。是正後のAM／MCP／WBの同対象29件も再成功し、関係11型設定と変更TS30 Fileのformatter／警告を失敗とするlintを再確認した。是正候補の内容指紋`33e5747a7160d068a4d74b4d6514789cfc98150f952a7dcfd70e38cff0a3ede8`を3名へ読取り専用で再提示し、必須残指摘0件を確認した。全結果終了後は本書・設計・計画・現在投影の状態表示だけを実結果へ更新し、製品Sourceと試験は変更していない。検証手順逸脱の正当化や全生成物不存在の証明へ拡大しない。

### 検証手順の逸脱と影響

Coの予定5件を再確認する際、実行担当が`--test-name-pattern`を最初のFile引数の後ろへ置いた。そのためNodeが選択条件を適用せず、LCOV4件に加え`repository-operation-runtime.contract.test.ts`の13件全体を起動した。後者は11件成功・2件がLink作成のEPERMで停止した。この実行を76件や是正後の予定成功件数へ加算せず、失敗2件の権限付き再実行は行っていない。

13件の実行対象は次のとおりである。

1. 実体IDの5取得点はWindowsだけ符号を補正し他の拒否条件を維持する
2. Windowsの上位bit付きIDで操作作成・再検証・回収が成立する
3. Coordinator保存先借用は現在Repositoryと有効Ownerだけに結合する
4. 保存の四用途はRevisionとOwnerの条件を分離しRoot参照を搬送値へ混入させない
5. 保存借用は呼出しごとの二探索と実体差替え拒否を維持する
6. Repository実体と開始Revisionをopaque capabilityへ固定して再照合する
7. 開始後にHEAD参照先が変わればEffectと結果公開の双方で失効する
8. detached HEADとpacked refを限定形式で解決し不正入力を拒否する
9. SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否する
10. 宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否する
11. loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否する（EPERM）
12. linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否する（EPERM）
13. 公開契約はcaller supplied identityを採用せずPathを返さない

既存fixtureの`temporaryRepository`／`linkedRepository`と外部Ref試験がOS一時領域へ新品Rootを作成し、今回のRepository限定境界に反した。各試験の終了hookには自分が作ったexact Rootの回収が登録され、実行は終了した。失敗出力から特定できた4 Root（`crdd-operation-external-ref-ndp2V6`、`crdd-operation-repository-ZZt9Fy`、`crdd-operation-linked-external-ref-HwZaON`、`crdd-operation-linked-repository-vSJWVO`）は、そのexact Pathだけを読取り確認し、すべて不存在だった。それ以外の生成Rootは出力にexact Pathがなく、終了hookの例外がなかったこと以上の不存在実測は主張しない。過去Rootの列挙や新しい削除は行っていない。

Sourceと既存出力を照合した範囲では、追加13件のEffectは合成Git Metadata・操作Directoryの作成、変更、観測と回収であり、実AI・Docker・外部送信・Desktop／OSサービス変更の呼出しはない。限定選択肢をFile前に固定する条件へ戻し、同じCo予定5件だけの再実行は成功した。以後の追加実行は停止し、試験自身のOS一時領域使用は今回の機能是正とは分けて親担当へ報告した。

### Root公開の最終精査とコミット前確認

人間の追加指示に従い、外部本番利用がなくなった`inspectRepositoryManifest`のRoot再exportだけを撤去した。Manifest Readerと局所試験は`manifest/validation.ts`の検査を継続利用し、関数の実装・受理条件・保存形式は変更しない。公開は8関数・2定数・14型の24項目となる。前段の25項目はその確認時点の記録であり、現在集合は構成モデルの設計と固定期待試験を正本とする。

追加試験は構成モデルの公開境界2件とManifest値検査2件の明示した2 File、およびCheckerのCatalog／Symbol／正式QA関係検査1件だけとし、全5件が成功した。選択条件はすべてFile引数より前に指定し、他Suite・Coの試験・実資源を起動していない。整形差1箇所を修正した後、構成モデルのformatter・型・警告を失敗とするlintも成功した。

Symbol台帳はFile／Module単位であり、内部の検査実装とRoot Moduleは存続するため安定IDや件数を不必要に変更しない。既存CatalogのSuite Path／IDも維持し、Root固定集合と非公開化の負例、正式QA・現行設計・計画を24項目へ追従した。過去の固定Evidenceや試験手順逸脱の観測限界は上書きしない。

固定候補の内容指紋`138122e83c1ab852accd7bb36ae01fa3f38b776353354108249f8863dd71592c`を、作成担当から分離した確認者へ読取り専用で渡した。Root24項目、内部検査の継続、外部参照不存在、台帳と現行文書、過去結果・誤起動の観測限界との分離を確認し、必須残件は0件。確認終了後はこの状態記録だけを更新し、製品Source・試験は変更していない。人間の指示に従い既存作業ブランチへコミット・プッシュする。main統合・Release・全体QAの成功を意味しない。今回も全体回帰・実AI・Docker・過去保持物は操作していない。
