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


## 後続区切り：実行モデルの24 Source整理 — 2026-11-12

基準改訂版は`c878b9798`。実行モデルを7モデルのcrud／validation／typesとstorage/store／lock、Rootの24 Sourceへ統合した。旧PathのWrapperや新しい保存Storeを作らず、保存Path・Schema・Hash・Lock Identity・CAS・現在性確認・保持条件・失敗／回復参照・State短命Mapの一回使用を保持する。機密検査の7値はCoordinatorのinput/secret-validationへ移管し、他のRoot公開を追加縮減しない。現在Rootは364項目（279値・85型）。

作成担当は旧663宣言を新Ownerへ対応付け、実衝突する私有名と必要な内部import／export以外の本文を、型・空白・block comment除去による補助比較で照合した。mapped conditional typeの先頭union整形差一件は目視確認した。これは構造変更の補助証拠であり、全挙動・実環境同等を証明しない。終了候補Reader二関数はState終端Protocolが呼ぶ固定条件のState Readerであり、最終候補ではstate/crudへ配置して値循環を解消した。

試験の私有import・Source抽出・Module Mock・型投影を実Ownerへ追従した。保存試験補助は9個の実Sourceを一度ずつ同じ閉包へ展開し、Stateの短命Mapを複製しない。既存EM32 Suiteを明示列挙して限定検証し、Repository-localの自己生成Rootだけを終了hookで回収する。実AI／Docker・Repository全体回帰・過去保持物は操作しない。結果と独立再レビューはこの区切りへ追記し、前段結果と合算しない。

利用側担当は二Reader移管後の候補SourceでCoordinator／Workbench／Executorの限定35件を再確認し全成功、CoStrict／CoTests／Executor／Workbenchの型4設定も成功した。先行の同35件とは重複計上しない。製品Sourceの独立確認はこの時点で必須残指摘0だったが、試験・台帳・文書を含む総合候補の独立再レビューはまだ未完了だった。後続の是正と最終独立再レビューの結果は次節へ記録する。


### 限定回帰の初回失敗・是正・最終確認

初回はEMの既存32 SuiteをFileごとに明示列挙し、255件中206成功・49失敗、cancel／skip0、324.84秒で終了した。これを成功記録へ上書きしない。失敗の原因と処置は次のとおりで、製品の期待安全条件を緩めていない。

| 失敗系統 | 原因と是正 | 成功した確認との対応 |
|---|---|---|
| link／一時操作の初期作成 | 最初のsymlink／hardlink APIがEPERM。通常実行でこれを捕捉した一時操作はblockedとなった。同じ自己生成Root限定の既存試験を必要権限付きで確認 | temporary-operation-lifecycle＋temporary-operation-cleanupの25件成功。実履歴のaliasは同じ履歴Suiteの11件成功。CoreとSnapshotのLink対照は最終4 Suiteに含む |
| 故障注入の同一binding | Module統合後の内部関数宣言へ旧外部overrideが届かず、解放／読戻し故障を発火できなかった。途中の実Lock namespace注入だけでは、内部acquireの差替えも届かなかった | 最終fixtureは9実Sourceを各一度だけ展開し、取得／借用照合／解放は同じLock閉包・Mapで揃える。指定内部functionだけ同じbindingへ差替え、StateのMap三個も各一実体。最終4 Suiteの88件全成功 |
| Error classの同一性 | fixture内でError classも再評価し、Root正本とのinstanceofが一致しなかった | classだけ再生成せず唯一のRoot正本を依存として注入。現在Readerのinstanceof期待を保持し最終88件で成功 |
| Source抽出の旧Owner・隣接宣言依存 | marker、修復候補、認証差分、配送Reader等が旧Sourceや次の関数位置を前提としていた。実Ownerへ追従し、必要箇所は既存の宣言抽出Helperを使う | 抽出・閉包の最小10件全成功、marker二件全成功、最終88件の対応ケースも成功 |
| markerの最小State fixture | 現v3の必須decisions／blockersが欠測していた。両配列を正規の空値として補完し、製品の欠測拒否は維持 | markerの模擬境界と実保存境界の二件全成功 |
| 履歴保持値の上位搬送 | 修復履歴ReaderとDecisionのfixtureが先行3分離のHistoryRepositoryInputへ未追従。保持日数30と既存revalidateによる現在確認を明示搬送した | 修復の再Reader・Decision Stateの後続ケースまで最終88件で成功。config_changedは下記の製品側引数搬送漏れも反証した |
| 終端の二つのModule実体 | 9 Source fixtureへactual dynamic Attempt namespaceを後から上書きし、新配置の直接Readerが試験閉包を迂回していた | 不要なdynamic再import／state module mockを撤去し、同じ実Source fixtureで終端Context・Reader・Writer・通知を接続。別Context拒否、一回consume、解放不明を最終88件で確認 |
| 固定Consumer集合 | Coの純粋state/validationを例外捕捉Ownerとして期待する旧表と、VC利用宣言の旧配置・重複が残っていた | Coの実境界state/queryと新OwnerのNamed import集合へ追従。検査式は不変更。Co coverage六件とVC閉包13件が成功 |

上位保持値を搬送した後、修復のconfig_changed一子ケースが正常完了へ誤昇格することを検出した。current_historyとcurrent_deliveryの短命Writer wrapperが、元repository.revalidateへ任意の期待保持日数を渡していなかった。作成担当が両bindingと対応する私有型だけを是正し、active・Map同一性・used・元assertOwnerの条件を保持した。初期663宣言の本文比較はこの是正前の構造移管に対する補助結果であり、最終Source全ての本文不変更を意味しない。

既存PRL-UT-006へ実二宣言の局所評価を追加し、used前拒否、同日数true、日数変更false、Owner失効false、終了後のMap退役を両枝で確認した。同Suiteは六件全成功。修復の実保存対照でもconfig_changedを拒否した。Scopeは履歴消費枝の引数搬送だけで、通常再検証へ設定Readerや別Contextを追加していない。

最終Sourceで共通fixtureを利用する四Suite（runtime-core-crud、runtime-repair-storage、runtime-settlement、runtime-snapshot-io）を全件再実行し、88件全成功、fail／cancel／skip／todo0、161.42秒で終了した。途中の77件67成功10失敗、66件63成功3失敗、対象三親ケースの31件29成功2失敗は切分け中の結果であり、最終成功件数へ合算しない。後者の二失敗は同じconfig_changed子ケースとその親である。

初回32 Suite全件と是正影響subsetの再実行で解消を確認したものであり、最終候補で32 Suiteを再度一括実行したとは主張しない。子ケースが前段の失敗を越えて到達した分も含むため、異なる実行の件数を足して単一の総数へしない。今回exact Rootの各終了hookは完了し例外報告はない。過去保持物の走査・操作は行わず、全Rootを別途手動観測したとは主張しない。

親担当がCheckerのexact「Test Catalog・Symbol・Quality Local Itemの成果物関係を照合する」一件を読取り専用で確認し、1成功・失敗／skip／cancel0、625.97msだった。既存CatalogのSuite ID／Path／件数を維持し、移管した機密SymbolのIDとARCH-000014を保持した。新Ownerの未収録五Sourceだけを追加し、対応する既存verifiesへ結合した。現24 SourceのSymbol Pathは全て実在する。正式QAの評価を移管だけで成功へ変更しない。

最終追補後、実行モデルとVCの型検査、EM試験42 Fileの整形検査、同Fileの警告を失敗とするlint、外部四試験Fileの整形・lint、diff whitespace検査は成功した。EM lintには基準からの情報レベル10件が残るが、警告・エラーは0である。製品Sourceをformat対象へ含めて再変更していない。

試験・台帳・設計を含む最終固定候補を読取り専用の独立レビューへ渡し、文書の責務説明1件を是正した。「全物理I/Oはstore」という記述を、storeの共通I/O、lockの共通排他、state/crudの短命Mapに結合したCAS・出版／回復とrename／unlink発行の分担へ修正した。製品Sourceの追加移動やWrapperは不要とし、同じ確認者の再確認で残指摘0となった。過去比較基準と明示したEM05／Coordinator04の旧Source説明は履歴として保持する判断も確認済み。現在、人間の追加判断は必要ない。実AI・Docker・Repository全体回帰・過去保持物は操作していない。

### 完了表示と参照の再照合 — 2026-11-12

完了後の再照合で、現行Architecture先頭に限定検証・独立再レビュー待ちの状態表示が残っていたため、既存の成功記録と同じ限定完了へ是正した。本記録の先行確認に残る未完了表示も、その時点の経過と後続結果を明示し、履歴を現在状態へ読み違えない形にした。製品Source・公開API・保存形式・安全判定は変更していない。

40_Developとtemplateの実装・試験・Scriptの静的import／dynamic import／URL参照を照合し、廃止した実行モデルSourceへの参照と外部からの内部Source参照は0件だった。現24 SourceのRoot直下はindex.tsだけである。既存の公開境界5件と保持設定6件の計11件、および成果物・Symbol・正式QA関係の限定1件を再確認し、全て成功、失敗・取消・skip0。これらはSource読取りと合成値の確認であり、物理保存や実AI／Dockerの追加成立を主張しない。今回も全体回帰・実AI・Docker・過去保持物は操作していない。

## 後続区切り：実行モデルの内部責務・公開契約整理 — 2026-11-12

基準改訂版は`38d51403f`。先行24 Source整理の完了記録と、この後続変更の候補・検証結果を区別する。Rootの未使用93値と内部File名／退役Temporaryの5型を外し、完成`RepairWriteRequest`を1型追加した候補は267項目（186値・81型）。NodeによるRoot読取りでも186値を確認した。外部Coordinator試験がfixture・局所検査に使用する24 helperはRoot限定Guardを維持して残し、公開最小化完了とは表示しない。exact一覧・用途・再評価Ownerは実行モデルArchitectureへ記録する。

修復の本番Callerは期待改訂と六つの固定論理更新だけを渡し、EMの完成操作が現在のStateを観測して同exact対象・元版・Ownerを照合し、候補構築と単一Writerへ接続する。成功・保存確認・解放が共同成立したときだけ確定Versionと対象Operationを返す。Request型はattempt/types、完成保存はstate/crud、利用側はCo execution/recoveryへ対応付ける。次Snapshotや任意出版byteの受渡し、期待差の自動再基準化、再試行、新しいStoreは追加しない。通常Operation／HostのhelperによるIdentity検査・照合Oracleは別用途として維持する。

### Temporary Operation退役の根拠と範囲

現基準の製品src／bin／scriptsとtemplateに、Temporary APIの本番CallerはなくRoot再exportだけだった。Git履歴では、導入`15209e748`からRuntime Data／Domain移管`337319269`、署名準備の本番Callerを持つ`a04ecb703^`までを照合した。同親版の`coordinator/scripts/prepare-release-runtime.ts`はcreate／resume／settleを実使用し、`a04ecb703`で署名準備・署名・昇格一式とともに撤去された。以後のwx統合`53209fad7`、3モデル分離`3a69f4af1`、24 Source整理`38d51403f`には新たな本番Callerがなかった。過去の25件成功等は当時の専用ライブラリ契約の記録で、本番接続の証拠へ拡大しない。

store.tsのprivate ID／SHA256／終端集合から末尾まで約1,600行を撤去した。create／resume／settle／evidence promotion、verification三Variant、型三個、Map二個と全専用helper、専用acquireLock値importを対象とし、Rootから隠すだけの実装や代替は残さない。共有のLock型・固定領域・安定File I/O・Error class・通常Reader／Writer・State codecは保持した。IT／ST各一Fileとfixture二Fileを退役し、active Catalogは411から409件、EMのSuiteは32から30件となる。実体のないPathを互換登録として残さない。

Catalogのrepository-storage corridorは現役のstate-io／保存Consumer閉包へ、Lock→EMの接続は現役のkernel／snapshot Lock試験へ対応付けた。専用Symbol六件を退役し、正式RDL-IT-003／004／ST-002のIDと元の検証義務は保持する。旧APIの自動化slice退役を、正式項目全体の成功・免除・一般清掃保証へ読み替えない。旧署名経路を説明する現行案内へ退役注記を加え、過去Evidence本文は変更しない。

過去tmp／.operations文書・回復参照の存在は未走査である。API退役後はその旧形式を製品APIから自動再開・清掃しない。由来不明物は保全し、必要な場合は個別承認の対象確認・処置へ残す。今回、過去保持物の移行・復旧・清掃は行わない。固定領域resolverのtmp枝は共有I/Oの受理域を変えないため維持し、旧Temporary Protocolが現役であるとは扱わない。

### Record取得の一正本化

Git基準のsnapshotPlainRecordと現snapshotRuntimeStateRecordを、製品変更前に宣言単位で局所評価した。普通／null prototype・空・未知／欠測Key・非列挙・symbol・getter・Proxy／revoked Proxy等15値と、通常／空／欠測／不正／callback／ProxyのKey集合八形を組み合わせ、120対照すべて同値、入力値のgetter／trap実行0、非null結果の凍結null prototypeを確認した。Key集合へ明示したcallbackは受理域比較のため従来どおり呼ばれる条件を含み、任意callbackの無実行保証へ拡大しない。Gitからの読取りだけで、基準コードの別経路を保存・配布しない。

受理域が同じRecord二実装は既存snapshotRuntimeStateRecordへ統一し、旧関数全文と別名Wrapperを撤去、四Sourceの内部consumerを同じ実名へ接続した。配列二種は理由分類とmaximumLength引数検査が異なるため統合せず、descriptorの直接null入力等の挙動も変更しない。共通改訂／codecは初回・同値no-op・区画間保全条件が異なるため一律にまとめない。State単一Snapshot全体の構築は跨モデルCASの責務として現Ownerに残し、名前・行数だけを根拠に大移動しない。EM内部validationの既存相互参照を今回全解消したとは主張しない。

既存objective validation Suiteへ128組の期待値反証を一Case追加し、浅い入れ子参照の保持・入れ子非凍結も確認した。同Case一件と、objective／runtime-codec／repair-modelの三Suite37件は全成功（重複合算しない）。Temporary退役後の共有I/Oはstate-io三件・runtime-repository四件・storage-consumer-closure四件の計11件が成功した。いずれもfail／cancel／skip0。後者の生成物は自己生成Repository-local Rootだけで、各終了hookに例外報告はなかった。全Rootの別途手動観測や過去物の不存在は主張しない。

担当四Sourceとobjective試験Fileの整形検査は成功、警告を失敗とするlintは警告・エラー0（情報レベル一件は残存）、diff whitespace検査も成功した。親担当がEM、Co strict／tests、Executor、Workbench、MCP本体／launcher、AMの関係八型設定を確認し全て成功した。Catalog／Symbol／正式QA関係のexact一Caseは1成功・失敗／skip／cancel0、465.5msだった。当初結果待ちだったRepairの限定回帰と候補全体の独立レビューは、下記の最終限定確認で結果を確定した。先行結果を流用して完了とはせず、全体回帰・実AI／Docker・過去保持物は操作していない。

### 親担当の検証順序の是正

CoのRepair Owner対照を起動した時点で、対象二Fileのimport整形と試験の非null assertion警告が静的段階に残っていた。exact一Caseは20.36秒で成功し、対象の自己生成Rootの終了hookも完了したが、静的確認を先行させる手順が揃っていないため正式の最終成功件数へ合算しない。Sourceの安全判定を緩めず、assert.okによる存在確認とimport整形を是正した。親担当が型・整形・警告を失敗とするlintの成功後、同じexact一Caseだけを再確認し、1成功・失敗／skip／cancel0、20.165秒で終了した。Root内の自己生成修復Stateと失効中初期化の終了hookにも例外はなかった。Co strict／tests、EM型、新Source二Fileの整形、親試験二Fileの警告を失敗とするlintは成功した。Scope拡大、実AI／Docker、過去保持物の操作はない。

Co reentryの故障注入wrapperを新四引数へ追従した点は、親担当が型・静的確認を行った。全reentry Suiteの広域実行はしていない。模擬DIを使うOwner／回復の関係subsetは別の限定結果として記録し、型確認だけから実統合成功を主張しない。

### 最終限定確認と今回範囲の完了

模擬DIを使うOwnerの既存13親ケースは、45子ケースを含む58件が全成功し、失敗・取消・skip0、1,448.531秒（約24分8.5秒）で正常終了した。再実行・期限変更は行わず、各fixtureの終了hookが通過した。途中の進行確認はexact scriptに限った親／子の作成世代とCPU時間のCIM読取りで、コマンドライン本文の出力、kill、別の試験起動はしていない。終了後のケース別時間を照合し、保持引渡し約228秒、保持三cut約300秒等、実保存を繰り返す個別ケースの時間が積み上がったことを確認した。一般的な性能保証や個々のOS I/O遅延の原因特定へ拡大しない。

利用側担当の最終限定集合はEM37件・VM二件・Co純粋26件・Owner58件で123件が成功した。Session不一致の追加Host対照29件の再成功はEM37件内との重複であり、足さない。Record担当の純粋37件・共有I/O11件、親担当のCo修復Ownerexact一件と各途中再確認も、これらと重なり得るため独立した数字のまま保持し、総数へ合算しない。親担当のCo修復Owner最終一件は20.165秒で成功し、前述の静的是正前の同一件は正式成功件数へ含めない。

固定したSource・試験・台帳・文書の独立レビュー結果をすべて受領し、必須残指摘は0だった。これにより今回範囲を限定完了とする。Root267項目（186値・81型）、Source24 File、Catalog409件、EM既存Suite30件を現在値とし、退役専用slice・旧基準の実行件数とは区別する。Rootに残した24 helperの最小化は未完であり、既存Guardを緩めず利用側のOwner・契約を再評価する残件として実行モデル設計へ追跡する。

この状態更新では製品Source・試験・台帳を変更していない。全体回帰・実AI／Docker・過去保持物は引き続き未実施・未操作で、全体QA、統合、Release又は公開最小化完了の主張ではない。

### 最終静的確認と変更済み試験20 Fileの追補

上段の限定完了後、変更済みの実在TypeScript 33 Fileを横断する`biome check`で、import整列・type-only import・折返しの取り残しを検出した。format単独とlint単独ではimport整列の要求を取り切れていなかった。安全な自動是正だけを23 Fileへ適用し、unsafe修正、判定本文・期待値・fixture条件の変更は行わない。33 Fileの警告を失敗とする統合check、EM／Coordinator試験の型検査、diff whitespace検査は成功した。独立確認者の再確認でも追加の必須指摘は0だった。

変更済みEM試験の実在20 File（結合5・単体15。退役Suite二件とfixture二件を除く）だけを明示列挙して追加確認した。189件中185成功・4失敗、取消・skip0、147.885秒で終了した。失敗三件は試験自身のhardlink作成に対するEPERMで、marker一件とSnapshot I/O二件である。残る終端保存一件は、親担当が既存の`--experimental-test-module-mocks`起動設定を付けずに実行したことによる`mock.module`未提供だった。既定のFile並行実行であったことも含め、Package標準設定による全件成功とは扱わない。

製品Source・安全判定・試験期待値を変えず、必要なhardlink作成権限と既存Module Mock設定、File逐次実行を指定し、失敗した四つのexactケースだけを再確認した。4成功・失敗／取消／skip0、31.634秒で終了した。各ケースの自己生成Repository-local試験物の終了hookに例外報告はなかった。先の185成功と、この失敗四件の解消を対応付けた結果であり、189件全件を再実行したとは表示せず、先行の123件等とも合算しない。過去保持物は走査・操作していない。

成果物・Symbol・正式QA関係のexact一件も再確認し、1成功・失敗／取消／skip0、435.693msだった。現行設計の「他のRoot公開は今回追加削減せず」という先行24 Source整理時の文を、先行段階と後続267項目への縮減を区別する説明へ是正した。追加の製品挙動変更はない。今回範囲の限定完了、公開最小化の24 helper未完、全体回帰・実AI／Docker未実施という境界を維持する。

### コミット前の限定再確認

人間からの再確認・コミット指示に従い、基準`38d51403f`との差分、完成修復Inputへの利用側接続、退役処理・公開集合、台帳と現行説明を再照合した。今回範囲の追加漏れは検出しなかった。独立確認者も最終二文書を読取り専用で再確認し、必須残指摘0だった。既知の24 helperは追跡中の残件であり、公開最小化完了とはしない。

長い保存試験を繰り返さず、EMの公開境界とobjective検査の既存二Fileだけを再確認し、13成功・失敗／取消／skip0、1.181秒だった。成果物・Symbol・正式QA関係のexact一件も1成功、661.007ms。EMとCoordinator試験の型二設定、変更済み33 TypeScript Fileの統合静的検査、差分の空白検査はすべて成功した。これらは先行結果と合算しない。製品Source・試験の追加変更はなく、全体回帰・実AI・Docker・過去保持物は操作していない。今回の確認結果を既存作業ブランチへコミット・プッシュし、main統合・Releaseは行わない。
