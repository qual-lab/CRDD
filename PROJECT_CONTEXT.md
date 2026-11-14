# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は判断しない。
> 詳細・判断理由は各Owner Artifactを参照し、履歴を本文へ蓄積しない。

## 1. 今どうなっているか

EMの共通値処理と履歴候補の所有境界を整理した。Task専用参照はTask validationへ局所化して同文法の三nullable処理を統合し、History専用Object／時刻検査も私有化した。履歴追記候補はHistory validationが所有し、StorageにはOwner・同版・保持・pending／fresh・物理出版を残す。公開93項目・保存形式・既存保証は不変。限定65試験と実保存5親・Co継続判断代表1親、両型検査・独立レビューの必須残指摘0を確認した。コミット前にも限定65試験・型／整形／警告・独立最終確認が成功し、実装不変の実保存6親は既存結果を使用する。全体回帰・実AI・Docker・過去保持物は対象外。[範囲と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)の「共通値処理と履歴候補の所有境界」を参照する。

EM公開補助三系統の調査を受け、独立した未信頼入力・搬送・Host認証記録の検査は維持し、同じ受付内の重複だけを整理した。資源更新は次Bookの検査を遷移へ一意化、Co二役選定は同じ検査済み設定を共有、私有Objective実行は受付済みPlanとexact参照一致の場合だけ再利用する。公開93項目・保存形式・Effect順は不変。限定57試験・EM／Co型検査・独立レビューの必須残指摘0を確認した。コミット前にも限定55試験・型／整形／警告・独立最終確認が成功し、受付IT2親は実装不変の既存結果を使用する。全体回帰・実AI・Docker・過去保持物は対象外。[範囲と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)の「受付済み値の重複検査整理」を参照する。

EMのState局所計算を既存の各Ownerへ移管した。Hash／Lease値はState operations、採用拒否はWorkspace、計画定義HashはObjective、資源差分はAttempt、履歴byteのHashと固定行検査はHistoryが所有する。同版候補・改訂相関はStateに残し、公開93項目・保存形式・既存保証は維持した。限定73試験・追加6試験と代表実保存32報告項目、EM／Coordinator型検査が成功し、独立レビューの説明コメント1点を是正した。新File／Facadeは追加せず、全体回帰・実AI・Docker・過去保持物は対象外。[実施範囲と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)の「State局所計算のOwner整理」を参照する。

EM保存試験の準備共有を完了した。固定10Sourceの読取り・型除去と、通常経路の同署名未束縛factoryだけを共有し、Map・Owner・状態・故障注入・保存領域は各Caseで独立させる。変異は毎回評価し共有しない。限定50報告項目と型・整形／警告検査、独立レビューの必須残指摘0を確認した。途中で見つけた終了Reader試験の旧Source参照は現Ownerへ是正し、検証内容を維持する。製品Source・公開93項目・保存契約は不変で、全体回帰・実AI・Docker・過去保持物は対象外。[範囲と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)の「保存試験Sourceの不変準備共有」を参照する。

EMの同版履歴候補は、同じ同期呼出しで検査済みのStateを共有する形へ整理した。最終遷移検査・Writerのfresh照合・Root93項目・保存形式は維持し、履歴意味計算はHistory、改訂相関はState、物理保存はStorageに固定する。Storageは分割せず三つの短命証拠の寿命と、取得済みOwner／一回Contextの違いを明記した。限定値10項目・代表実保存30報告項目・型検査が成功し、両独立再レビューの必須残指摘は0。全体回帰・実AI・Docker・過去保持物は対象外。[範囲と限定結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)の「同版履歴候補の導出と保存証拠の寿命」を参照する。

EMの局所検査と全State候補を分離し、History退役候補は完成CRUD、Task／Objective候補は各operationsへ集約した。Co自身の所在初期化失敗はCo所有型へ分離し、EM例外も維持して本番・scriptsのEffect／回復参照搬送を追従した。公開93項目・保存形式・単一Writer／CASは不変。モデル・境界の限定54項目と既存公開結果搬送1項目、型検査・独立再レビューが成功。続く修復準備共有は69条件を個別登録し、初回3失敗の故障配送を試験側だけで是正後、限定75報告項目が全成功した。Source変異3群8条件は専用Rootを維持する。今回生成Rootの終了清掃も確認済み。全体回帰・実AI・Docker・過去保持物は対象外。[範囲・是正・限定結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)末尾の依存分離／準備共有節を参照する。

共通Lockの名前を責務Package・保護対象で統一し、Repository内EM/構成/文書/長期Leaseは`.crdd/lock/`へ接続した。Repository非依存StoreとRepository横断資源は明示所在を維持する。実利用の切替は全利用者停止下で、旧名Lock・未解決義務の処置を旧Owner手順で確認できた対象だけに限る。新コードによる旧Lock本体の自動検出や旧新並走の相互排他は保証しない（[切替条件の正本](06_Architecture/Details/lock/01_Architecture.md)参照）。EM保存専用markerと単独清掃入口を撤去し、履歴保存もsaveRecoveryHistory一回へ完成操作化してCoordinatorの段階ループを撤去した。Rootは93項目（58値・35型）を維持。限定回帰・型検査・独立再レビューを完了し、必須残指摘0。全体回帰・実AI・Docker・過去保持物の処置と実利用切替は対象外。[実装と確認](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)末尾を参照する。


先行段階では資源Checkpoint再保存を既存保存受付へ実体統合し、旧単独公開を撤去した（当時Root94項目）。上位はEM Readerの比較pairをそのまま渡し、元pair全文・Owner・fresh Reader／Writerの確認を維持する。限定19項目・型検査と独立再レビューを完了し、必須残指摘0。§14.64のmarker完成単位案は未実装のまま、後続のmarker自体の撤去方針で置き換えた。[範囲と検証](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.63以降を参照する。

先行段階では受付集合・終了観測の独立2入口を既存readStateへ実体統合し、Root95項目（60値・35型）となった。Queue／Lease Intent／受付世代の同版通常Readerと、終了履歴の回復ID・相関ID・解放確認を維持する。限定21項目・型検査と独立レビュー／文書再確認を完了し、必須残指摘0。保存三操作はmode付替えだけを採用せず未変更で残す。全体回帰・実AI・Docker・過去保持物は対象外で、EM差分は未Commit。[今回範囲](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.62を参照する。

照会系の通常CRUD整理として、本番未接続の三特殊Queryと専用投影を撤去した。通常Queue一覧・既存本番の同版取得・保存形式と認可を維持し、この先行段階ではRoot97項目（62値・35型）となった。限定回帰20項目・型検査と独立再レビューが完了し、必須残指摘0。業務操作と残る用途固定観測は同じ計画へ追加棚卸しのみを記録し、今回の許可からLease・回復・終了保存の撤去は推定しない。EM差分は未Commit。[範囲と検証](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.61を参照する。

4保存操作の意味OwnerをAttempt／Historyへ移し、単一物理Writerと3私有Map・初期化・pending再入場をStorageへ一体化した。認証終了と取得済みOwnerによるTask／定義保存も追従し、旧所在地の転送入口はない。公開100項目・保存形式・Lock／CASは維持する。限定回帰・型検査と独立レビューが完了し、必須残指摘はない。初回の旧試験参照不整合は利用側だけを追従し、Hardlink権限制限は限定1試験を通常権限で再確認した。一連のEM差分は未Commit。全体回帰・実AI・Docker・過去保持物は対象外。[今回の範囲と検証](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.60を参照する。

修復記録の公開名を`saveRepairRecord`／`resumeRepairRecordSave`へ統一した。宣言・Root・利用側・試験・現在設計を一括追従し、旧名の互換入口はない。公開100項目・保存形式・処理は維持し、選択した公開／Writer／実pending再開／Coordinator接続・型検査と独立レビューが完了、必須残指摘なし。この改名段階の後、上段の四操作移管へ進んだ。EM差分は未Commit。[改名範囲と限定結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.59を参照する。

EMのCheckpoint保存をAttemptへ実体移管し、Snapshotの同一alias二つを撤去して、公開済み`ExecutionStateSnapshot`を19field明示の保存正本、他二型を投影へ整理した。公開100項目・保存JSON・単一CASは不変。限定84項目、型適合と負例、代表保存Readerが成功し、独立レビューの必須残指摘なし。この先行段階では三私有Mapと四完成操作を単純移管対象から除外し、後続でWriterとの一体移管へ進んだ。全面移管や全循環解消の完了とは扱わない。EM差分は未Commit。[範囲・残置理由と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.57を参照する。

EMのHistory段階は、六符号化、必須行照合・保持・出版規則とBuffer捕捉を`history/operations.ts`へ集約し、限定回帰・独立レビューを完了した。Stateは全体復号・保持参照投影・同版の候補結合を維持し、物理保存は既存Writer／CASのまま。公開100項目・保存形式は変更しない。限定80項目と通常／判断／pendingの代表保存、最終修復保存29項目が成功し、独立レビューの必須残指摘なし。EM差分は未Commit。[現在範囲と結果](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.56を参照する。

修復49ケースの試験再編は`bfd01b54a`でCommit／Push済み。続くEM責務整理の第一段階は、資源の純粋な4操作を`attempt/operations.ts`、共有6値処理を`state/operations.ts`へ移し、値検査から保存CRUDへ戻る2経路を撤去した。公開100項目・保存形式・単一CASを維持し、限定回帰・独立レビューの必須残指摘なし。EM差分は未Commit。Historyの生成・保持・出版規則は§14.56へ進み、完成操作の意味Owner・Snapshot型と、残る純粋検査間の相互依存は未完了として維持する。[限定結果と現在の範囲](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.55を参照する。

先行する九入口統合の時点では、実行モデルのRoot公開は100項目（65値・35型）だった。九つの重複入口を既存の読取り・Checkpoint・完了・履歴操作へ統合し、技術Ownerと通常表示の取得範囲は区別した。Executor／DI／ADの上位依存とCoordinatorのWorkbench／MCP結合試験は、利用側Ownerへ移管して全assert・終了／清掃条件を維持する。AMのEM型結合を撤去し、VCの横断Consumer検査はChecker試験Ownerへ分離した。保存形式・Lock／CAS・認可・期限は変更しない。対象・限定検証と独立レビューの進行状態は[分離・公開整理計画](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)§14.33–14.54、責務は[実行モデル設計](06_Architecture/Details/execution-model/01_Architecture.md)を参照する。全公開物の絶対最小性・全保存経路・全体回帰成功までは主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。

後続の修復49故障ケースは、不変の技術前提と未束縛Source factoryを一回準備し、可変状態を分離した個別試験へ整理した。元の初回故障経路と93静的assert式、実Reader／Writer・Lock・CASを維持し、49ケース＋factory試験の53項目が約90秒で成功した。旧構成約53分とは別の証跡で、製品速度改善や全体回帰成功は主張しない。詳細・保証範囲は同計画§14.54を参照する。

先行の区切りでは実行モデルの内部Sourceを53から24ファイルへ整理し、利用側・試験・台帳・文書の追従、限定検証と独立再レビューを完了した。7モデルの操作・検査・型と共通保存／排他を分け、旧Pathの互換層は追加していない。機密検査の7値はCoordinatorへ移管し、その時点のRootは364項目（279値・85型）。保持設定の現在性確認で見つけた期待日数の搬送漏れ2箇所も是正した。初回32 Suiteの失敗と是正影響subsetの成功を分けて記録し、最終32 Suite一括再走や全体QA成功とは主張しない。独立レビューの文書指摘1件は是正・再確認済み、残指摘0。[現在の実行契約](06_Architecture/Details/execution-model/01_Architecture.md)、[限定結果と限界](99_Roadmap/Changes/CHG-000082/Evidence/261112_model-package-split-verification.md)を参照。全体回帰・実AI／Docker・過去保持物は操作していない。

3モデル分離後の構成モデルを、AI選定・Network Policy・保持設定・Manifestの各操作／検査／型と保存の15 Sourceへ整理した。未接続Trust検査を撤去し、固定Manifest読取りを共通入口に接続。Schema・保存先・JSON条件・Lock／CAS・元失敗／回復参照は維持する。予定の限定76件と関係11型設定は成功し、独立再レビューの必須残指摘は0件。検証指定ミスによる予定外Co試験13件と回収観測の限界はEvidenceへ別記し、この成功件数へ合算しない。先行3分離の完了表示と、この後続候補の状態は区別する。[現在の構成契約](06_Architecture/Details/configuration-model/01_Architecture.md)、[変更区切りと限定結果](99_Roadmap/Changes/CHG-000082/Evidence/261112_model-package-split-verification.md#後続区切り構成モデルの内部責務整理--2026-11-12)を参照。全体回帰・実AI／Docker・過去保持物は操作していない。

旧Domain Modelを文書・実行・構成の3モデルへ分離し、Source・利用側・試験・台帳・文書を追従した。3モデルは型を含め直接依存を持たず、上位Consumerが文書の3期待Identity、確定済みExecutionSelection、履歴を消費する分岐だけの保持日数を投影する。Helperは各実Ownerへ閉じ、AM RootはAM正本とする。保存Path`.crdd/domain-model`・Schema・Lock・CASと失敗／回復契約は不変更。先行3分離時点のRootは文書294・実行371・構成25の計690 Symbolで、旧31公開は実Ownerへ追従した。型17設定、主要限定219件と追従11件は成功し、3名の独立再レビューで必須残指摘0。全体回帰・実AI・Docker・過去保持物の操作は未実施で、今回の区切りを統合判断やRelease成立へ拡大しない。[分離計画](99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)、[検証記録](99_Roadmap/Changes/CHG-000082/Evidence/261112_model-package-split-verification.md)と[文書](06_Architecture/Details/document-model/01_Architecture.md)・[実行](06_Architecture/Details/execution-model/01_Architecture.md)・[構成](06_Architecture/Details/configuration-model/01_Architecture.md)の正本を参照する。

内部データ量の撤去候補35群のうち、追加判断で保留したAM表示名一群を除く34群を是正した。利用側・既存試験・Owner設計・QA定義を追従し、直接Consumerの型12設定と限定回帰・独立再レビューを確認。VCのEOF確認差と残存する旧説明も是正済み。判断対象23群・保留入力／ページング・Transport／Process／通信・実行予算は不変更で、全ガード撤去済みとはしない。[実施範囲と限定結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#内部データ量の35群是正とam表示名の保留--2026-11-12)を参照。コミット前の追加確認でも固定Source差分・保留範囲の一致と限定24件の成功を確認した。今回、実AI・Docker・全体回帰・過去保持物は操作していない。

容量ガードを全Packageへ横断走査した結果、既に是正した局所経路以外にも、内部Reader・外側結果捕捉・保存モデル・検証Tool等の任意量制約を発見した。13Packageとtemplateの566 Fileを母集団に、是正候補・Owner判断・保留入力／ページング・Transport／Process・形式／実行Policyを[全量棚卸し](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#容量件数取得範囲ガードの全package棚卸し--2026-11-12)へ記録した。この棚卸し段階では調査のみで製品Source・試験を変更しておらず、その後の34群是正は上段を参照する。実AI・Docker・全体回帰・過去保持物は操作していない。全ガード撤去済み・全体完成とはしない。

追加走査でClaude作業量・候補拒否Path診断・検証Tool所見投影の旧件数制約を発見し、後段診断型も含め是正した。硬Turn上限16・不正値／相関／固定Fixture条件を維持し、5 File 54件の限定回帰は成功。今回の実AI・Docker・全体回帰は未実施で、下段の先行実E2Eと区別する。[取り残し是正](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#claude作業量候補拒否診断検証投影の取り残し是正--2026-11-12)を参照する。

Task実行準備・Workbench Owner Artifact・AD Task／Advice結果の任意容量制約を、直接Consumerまで追従是正した。追加承認の範囲でCodex Task Imageを再構築し、新Schema二件と公式実行物三件の実Hashを照合して固定digest／bytesを更新した。新ImageによるExecutorの編集・レビュー・取消各一回は、終了・Cleanup・Home解放・終端保存・今回Root回収まで成功した。大容量の局所試験と有限の実E2Eは区別し、全体回帰・上位Task全体E2Eは未実施。Docker再起動／修復・過去保持物の操作は行っていない。[実Image反映と限定E2E](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#codex新schemaの実image反映とexecutor限定e2e--2026-11-12)を参照する。

### 結論

内部State・履歴・設定と表示・診断の独自容量拒否を撤去する限定変更を完了した。先行変更ではHTTP・MCP・CLI受信、Git Object展開・再帰深度、子Process出力の上限は不変更。Readerの容量引数と旧公開上限定数、設定再観測のOptional容量指定を撤去し、正常な旧容量超過は受理、不正Schema・相関・保存故障は拒否する。最終まとめ115件、旧16MiB超Stateと履歴の実保存、AM／EI／VC／Workbench・診断の限定回帰と型9設定、三独立再レビューを確認した。既存実体照合そのものの簡素化とは分離する。先行CheckerのEI旧期待集合は追加指示で現契約へ追従し、該当1試験が成功した。全体Checker・全体回帰の成功ではなく、全体品質の完成とはしない。実AI・Docker・過去保持物は操作していない。[対象範囲と検証](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#internal-storage-capacity-removal)を参照する。

追加指示により、Git Object Readerの独自容量・件数・深さ上限と`maximumBytes`入力を撤去した。Hash・宣言サイズ・形式・循環・Path検査は維持し、関連42試験・型四設定・独立再レビューを完了した。その段階ではHTTP・MCP・CLI受信、子Process出力と別契約の借用Tree予算は不変更。VC限定統合で見つけた既存Consumer一覧漏れ1件は、実利用を確認して期待一覧へ追従し、該当試験が成功した。一括回帰の成功へ合算しない。巨大Pack／Indexの旧上限超実測は未実施。詳細は[後続のGit Object整理](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を参照する。

続く追加指示で、借用作業Treeの単一File／合計容量・件数・深さ・全Path長の独自拒否も撤去し、変更一覧・許可／読取りPath・Reviewer取得内容とDomain結果保存まで同じ内部契約として追従した。実行領域22件は21成功・Junction権限不足1件を同Case権限付き再実行で成功、準備／Domain43件・要求等11件、型三設定と独立レビューを確認した。物理大容量Fileと代役による大量File／合計容量の検証を区別する。その段階ではSurface受信・別のGit固定候補selection・子Process出力／Timeoutは不変更。全体回帰・実AI・Docker・過去保持物は操作していない。[対象と限定結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を参照する。

保存前モデルに残っていたObjective／Task・回復記録・候補選択等の件数、自由本文・Path容量制限も追加指示で撤去し、Co作成／再計画・Domain保存値／投影・MCP結果・VC Commitまで追従した。旧二上限定数の公開と現行Reader試験・台帳の旧bounded名も整理済み。限定回帰・型5設定・独立レビューと独立71件成功を確認した。その後の再確認で発見した回復／受領情報の後段128／256件拒否と、検証Reader／集約の切詰めも追加是正した。正常129受領の実保存・129番目不正時の未受領129保持、257回復ID全量、型3設定・独立104件成功まで確認した。受信量、同時実行／再計画制御、ID／状態形式、別設定モデルやページ取得の制約は維持し、全ガード撤去済みとはしない。実AI・Docker・過去保持物・全体回帰は未実施。[今回の範囲・検証の区別](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を参照する。

判断・阻害条件・履歴を同じState Writerへ統合し、旧Host Store・Bearer・二段階Port・判断期限を撤去した。Blockerと提案・回答の1:N、再提案、中止と解消の区別、履歴確認後の問題単位退役を実装した。追加確認で見つけた進行制御と読取りも是正し、関連承認が揃うまで元回答を未適用で保持する。同じ効果・根拠の承認だけを共同適用し、正式回復の完了記録を新規実行と区別する。当該段階のqueryDecisionsはBlockerと提案を同じ改訂から返していたが、後続の照会整理で特殊入口として退役した。局所88件・公開境界13件・保存IT1件・公開判断IT4件・通常進行と品質受入4件、型4設定が成功し、Source／利用側・文書の独立再確認は必須残指摘0。今回の三点の修正は完了した。[追加是正の範囲と結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#blocker-progress-and-read)を参照する。

変更適用による別Blockerの副次解決・新問題の出現などの自動再評価は、人間の指示で今回の対象から分離し、担当・影響・再検討条件付きのv0.22残件とした。旧記録の自動移行・探索・削除は行わない。横断文書Checkerの先行未合格は残り、横断品質全体の完成ではない。全体回帰・実AI・Docker・過去保持物は操作しない。3モデル分離は上段の現行作業へ進んでいる。[再評価の残件](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#blocker-progress-and-read)と[先行の一体実装](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#blocker-proposal-cardinality)を参照する。

Domain公開削減の前提となるCoordinator試験整理で見つけた終了記録の不具合を是正した。資源未受領のCleanupがno-opでも、終了候補の改訂・前Hashを読取り元へ結合する。製品差分はDomainの当該6行と注釈のみ。候補UT7件・保存IT4件・公開境界13件・Host限定2件が成功し、型検査・台帳409件・独立再レビューも確認した。Host後段の古い入力／固定5資源fixtureは既存公開操作へ追従し、拒否・再入場・記録保全を維持した。今回の局所修正は完了だが、履歴・配送・修復fixture等の全依存撤去とRoot削減は未完了。全体回帰・実AI・Docker・過去保持物は操作していない。[局所修正の結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#settlement-revision-fix)と[公開整理の残件](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#coordinator-domain-test-ownership)を参照する。

Domain公開整理に先立ち、DI修復試験のOwnerを分離した。DIの3試験は自己の技術codec・型へ接続し、Domainとの独立比較2ケースは保存受理側の既存ITへ移管。基準45ケースをDI43＋Domain2として維持し、両型検査・既存公開境界20件・台帳409件を確認した。移管先の保存IT全Fileも32件成功し、独立レビューは必須残指摘0。DI製品Source・公開IFとDomain Rootは不変更、Coordinatorの接続整理は次段階。全体回帰・実AI・Docker・過去保持物は操作しない。[範囲と結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#di-repair-test-ownership)を参照する。

AMのRoot公開30関数・26型を維持し、内部のOutcome型を明示契約化、交換Snapshotを既存型Ownerへ移管した。本番未使用の個別発行Readerを撤去し、認証・情報非開示・提示／失効・保存不明の4試験を現役の管理一覧へ接続。Role検査重複と古い未接続コメントも是正した。限定31試験・AM／Workbench／MCP型検査、基準型との双方向6代入を確認し、Source／Consumerと文書・QAの独立レビューは残指摘0。全体回帰・実AI・Docker・過去保持物は操作しない。[現在の範囲と結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#am-internal-contract-closure)を参照する。

Coordinatorの長期Leaseの物理取得・保持・通常解放を共通wx Lockへ接続し、既存Owner喪失回復は維持した。回復の全fresh照合後、同じDomain短期保存排他内でFile回収・不存在・保存を行い、遅延回復者が新Ownerを処置しない。限定回帰で見つけた試験不整合は是正・再確認し、Source／契約・試験・文書の独立再レビューは必須残指摘0。別の既存Domain公開集合試験の失敗も、主体2関数の期待値漏れを追従して是正し、公開境界13試験と主体1試験の成功を確認した。初回の失敗記録は保持する。全体回帰・実AI・Docker・過去保持物の操作・実運用切替は行わない。[範囲と結果](99_Roadmap/Changes/CHG-000082/lock-boundary-design.md#long-lease-common-lock-change)を参照する。

EIの責務分離と文書・Header追従は限定228試験・利用側型検査・独立再レビューを確認し、追加の正式QA3項目とEI関連旧リンク48件も是正した。QA-000012は10項目、全13定義は203 unique。追加限定64試験、EI関連の文書構造・QA／Symbol参照・リンクの検査と独立再レビューは指摘0。入力検査はvalidation、遷移・保持はoperations、物理保存はstoreとし、公開契約・保存形式・安全判定は不変。他領域の既存不整合と上位未評価は残り、全体PassやArchitecture Readyは主張しない。EI整理時点では長期Task Leaseを変更せず、後続の変更は上段に示す。全体回帰・実AI・Docker・過去保持物は操作しない。[現在の範囲と結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#ei-qa-link-closure)を参照する。

EIを汎用Execution／ExecutionGroupと明示Storeの9操作へ再構成した。Task固有IDはCoordinatorのメタデータへ移し、EIのDM／VC依存・旧Factory・評価／改善提案を撤去。下位AIの計測確定とHost清掃後の保存確定を分離し、未解決保持と活動表示を維持する候補は限定回帰・独立レビュー済み。保存先準備の元Effect・回復参照もCoordinator診断へ保持する。旧永続データ移行はフロントAIの別作業。PAはFixを維持し、全体回帰・実AI・Docker・過去保持物の操作は行わない。[現在の範囲と結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#ei-execution-group-realignment)を参照する。

PAの残存機能を整理し、製品Source・Rust crate・固定配布exe・専用Build／計測入口を撤去した。開発実行はNative HashなしでSource／Gitの前後照合、観測根拠、Session期限・取消・実行回数を維持する。共有LCOV解析だけは既存利用Toolへ残し、固定Source scopeはv3へ更新。台帳はPA Ownerを退役して410件valid。選択した限定回帰と独立完成レビューを確認した。全体回帰・実AI・実Docker・過去保持物は操作していない。[現状](06_Architecture/Details/platform-access/01_Architecture.md#現在の構成--2026-11-11)を参照。以下のNative残存記述は先行段階の状態であり、この現在値を優先する。

Provider HomeをNodeの所在・物理実体確認へ切り替え、共有wx排他を維持した。旧保護／OS主体HashはOperation Identity v4から削除し、旧Lock・別key認証記録は保全停止する。Executor単独検証スクリプトも追従し、旧PA Home API／Nativeと専用Protocolを撤去した。限定回帰・独立確認の結果は[現在の境界](06_Architecture/Details/platform-access/01_Architecture.md#provider-homeのnode移管)を参照。PAにはWindows所在・子環境・Artifactの残存があり、PA全廃とはしない。全体回帰・実AI・実Docker・過去保持物は操作していない。

退避Directoryは保存済みRoot実体・親・現在source・廃棄許可を照合してNode標準で全体削除する方式へ整理した。子のSocket種別・個別実体照合・独自上限を撤去し、PA単一entryのNative API／実装／専用試験・診断も削除した。開始後取消は削除処理の完了を待ち、部分失敗・後観測不明を保持する。新品treeと外側Link先保全を限定確認し、特殊Socket実物・実Dockerでの新方式成立は未実施。Provider Home・Windows所在のNativeは残る。全体回帰・実AI・実Docker・過去保持物操作は行わない。[実装範囲・保証差・検証状態](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#退避root全体の標準削除と単一entry-native退役--2026-11-11)を参照する。

Docker Desktop Helperを退役し、Executor経由のDIで公式CLI・既存Node.js処理・共通wxを使う構成へ統合した。Native由来の修復所有Hash・重複Scope Hashは撤去し、基点を変えない運用条件と既存Directory実体検査を維持する。限定回帰・実Writer結合・独立再レビューは完了した。全体回帰、実Docker停止／起動／退避、残存Provider Home等のNative整理は未完了。[現在の結果と保証変更](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#desktop-helperの公式cli統合--2026-11-10)を参照する。

Runtime Stateの本番初期化・実体照合をCoordinatorの既存Node Storeへ統合し、Runtime専用のNative呼出し・公開入口・Capability再包装を撤去した。各段の非リンク・所在・実体確認、既存wx排他・保存世代・CASは維持するが、SID／DACL等の独立保証とは同等としない。続いて旧Native値4・初期化処理・未使用TS契約を撤去し、配布物を同期した。Provider Homeの保護とFilesystem観測は残存する。今回の限定検証と独立再レビューは完了、全体回帰は保留する。実AI・Docker・過去保持物は操作していない。[現在の変更と残存範囲](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#旧runtime-state-native処理の撤去--2026-11-11)を参照する。

ローカル要求主体はGitメール由来とする方針を採用し、VCの読取りAPI・bin、Coordinatorへの明示--principal-id搬送、Workbench／MCP単体入口を接続した。Coordinatorは主体を自動取得せず、上位主体の欠測・不正を保存先初期化前に拒否する。AMユーザーとOS実行主体を区別し、メールを本人認証とは扱わない。限定回帰78件・型検査7構成と独立再レビューが成功した。既存記録移行・全体回帰は未実施。[現在の変更と境界](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#gitメールによる要求主体と明示cli搬送--2026-11-10)を参照する。

Local AppData専用TS API・Native CLI／frameを退役し、固定配布物とBootstrap Hashを同期した。共用のNative保護／Helper内部取得は維持する。回復Matrixの両子はready前失敗も停止後closeを待ち、元理由・IDと停止／終了観測を分ける。局所18件・型／静的検査と独立レビューが成功。全体回帰は保留、実Matrix・実AI／Docker・Native保護／修復実境界は未実施、過去保持物は不変更。[限定完了と未実施範囲](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#local-appdata専用入口退役とmatrix失敗時の終了確認--2026-11-10)を参照する。

DIの共通設定と任意Desktop管理設定を分離した。上位が起動時に確定した`desktop.userDataDirectory`を修復・Directory観測／回収へ搬送し、PAの所在再取得を撤去した。Desktop未指定は通常初期化を妨げず、Desktop管理操作だけ発行前に拒否する。DI関連68件・Executor9件・Coordinator関連29件と型／静的検査、独立レビューが成功。全体回帰は保留、他OS／Engine単独は未対応、PA Nativeと過去保持物は不変更。[現在の変更と保証境界](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#任意desktop管理設定の分離--2026-11-10)を参照する。

PA外の本番子Process環境生成と未使用のCoordinator診断口を2026-11-10に整理した。回復Matrixは既存設定OwnerとNode.jsへ接続し、取消境界は未対応のまま誤成立を防ぐ。局所19件・型／静的検査と独立レビューが成功。全体回帰は人間の指示で他の残件整理後へ保留している。PA自身のNative保護・旧Host／Native試験の利用は残り、実AI・Docker・過去保持物は操作していない。[今回の範囲と残件](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#pa外の子環境と旧診断口の整理--2026-11-10)を参照する。

DIの子Process環境は2026-11-10に明示初期化へ接続した。`windowsDirectory`／`userHomeDirectory`をオンメモリへ固定し、実行中のambient再取得を撤去した。DI407成功・5対象外、Executor114成功、Coordinator関連99成功と独立再レビューを確認。今回試験物5 Rootは回収済み。PA自身のNative保護と古い保持物は維持し、PA全廃・実AI／Docker E2E・全体QAの完成とはしない。[今回の範囲と保証変更](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#diの明示初期化と子process環境--2026-11-10)を参照する。

PAのtaskkill接続は2026-11-09に撤去した。通常CLIと検証の故障注入は元ProcessだけのNode.js標準停止とし、親終了不明時の再入場は未実施として保持する。予定外Host試験からの最初の7領域は回収済み。その後に再現した4失敗を、Domainの厳密な資源未発行判定と試験のOwner／所在／停止下wx再入場へ是正し、元4件・認証代役5形・親停止1形が成功した。Domain全484件と周辺回帰も成功し、実装途中で今回作った8試験Rootと新品TEMPは全量照合後に回収して不存在を確認した。その後の人間承認で以前の再現調査4領域・60分中断回帰領域・空のWorkspace旧2領域も照合して回収し、全7領域の不存在を確認した。Docker影響未確認の古いHost試験物などは保持継続。Host全体回帰・実AI／Docker回復E2Eは未実施である。当時残件だった回復Matrixのready前失敗時の終了確認は、上記11月10日の変更で是正済み。詳細は[最新の保持物回収と残件](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#承認済み保持物の限定回収--2026-11-09)を参照する。

残るEI・Topic／Meeting・一時Operationの技術排他を共通Lockへ接続した。取得・所有照合・解放は一つのwx実装とし、保存・改訂・世代・根拠昇格は各Ownerに残す。EEXISTの自動待機・PID不在による削除・Lock専用staging/hardlink公開を撤去し、再入場の最初の変更前から終端清掃後まで必要な区間を保持する。先行13 Packageの旧試験・管理情報等7系統を最小是正し、関連再試験と独立再レビューが成功した。Coordinator通常回帰は成功1,726・失敗0・skip5で完走した。Repository Checkerは基準Commitの3,787件に対して今回追加17件を是正し、残る既存指摘は未解消。全体QA合格は未成立。実AI・Docker・過去保持物は操作していない。[現在の回帰・Checker差分と限界](99_Roadmap/Changes/CHG-000082/lock-boundary-design.md#17-設計品質登録とchecker差分の閉包--2026-11-07)を参照する。

PA全廃は未完了。人間承認により通常回復Namespaceだけを既存Node初期化へ直接接続し、専用Native保護・Protocol・検証Toolを撤去した。専用TEMPの保護はOS設定・運用前提で、共有・保護不明ACLをNodeが拒否する保証はない。Home／RuntimeのSID・DACL・祖先Handle、OS既定所在、reparse tag、Job Object／Publisher、DesktopのGlobal Mutexは維持する。[PA設計](06_Architecture/Details/platform-access/01_Architecture.md#現在の残存範囲--2026-11-07)と[変更記録](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#認証終了の保存順序是正現在)へ実装・検証範囲を接続した。Process代役の漏れは親Gitの固定と全子入口の既定拒否へ是正し、認証restartで判明した保存順序の不整合は追加承認によりCoordinatorだけを最小修正した。Domain保護は維持し、関連12試験・Domain拒否1試験・静的検査・独立Source再レビューは成功した。改訂数期待値と一般保存0回の検査を追従し、同じ候補でHost28形が成功・新品領域回収まで成立した。関連回帰62件も成功したが、前回通常回帰は再開時に最終集計を回収できず結果不明となった。制限環境の拒否10件の通常権限下成功とWorkspace追加確認二つの親120秒時間切れを区別し、11月9日のWorkspace限定確認は22成功・約164秒で完走し、当該新品領域を回収した。通常回帰の取り直しは親60分枠で中断し、最終集計なし・全体結果不成立となった。既存74.3分の実績に対して枠が短かった実行計画の不備であり、製品不合格とはしない。Source不変を確認し、そのTAPと領域は保全し、自動再実行は行わなかった。続いて人間承認による120分枠の新しい一回は、同Source・同母集団・非並行・新品TEMPで1,731成功・失敗0・取消0・skip5（約68.8分）まで完走した。Source不変も確認し、結果記録と実体照合の後に今回Rootだけを回収・不存在確認した。結果・回収条件の独立再レビューは残指摘0。今回のHost除外portable通常回帰は完走したが、旧保持試験物の回収・過去影響確認・全体QAは未完了。先行の実Docker CLI発行可能性は別件で、許可された読取りは固定Engine Pipe不存在により観測不能だった。Dockerの起動・再起動・更新・削除や過去保持物の操作は行わず、影響未確認分も保全する。全体QA・PA／Native全廃の完成とはしない。

Executorは7 Sourceへ整理し、共通の短命Controlが開始・取消配送・終端だけを所有する。製品の旧Session再現層・重複Cleanup照合・汎用二重Runnerと旧Recovery再構築を撤去した。元DI Snapshot＋key別checkpoint＋回収方針を通常・認証の必須通知からDomainへ保存し、再入場で同じ契約を使う。Operation Identity v3から資源名・Imageのコピーを撤去した。ID欠測時も元Intent・一意実ID・名前・所有Label、発見ID保存後の削除と事後不存在確認を維持する。

旧認証・Recovery試験Adapter撤去後の五系統に続き、最終診断中の取消の結果反映と、本番Factory検証を装っていた旧試験Runtime経路を是正した。公開Executor→共通DI試験と局所候補Oracleを分離し、試験・利用側・管理情報・文書を追従した。Executor全112件、利用側37件と静的検査が成功し、Source・利用側・Architecture／QAの独立確認は残指摘0。先行候補のCoordinator111件＋代表結合5件、Domain36件、DI90件の結果とは別集合で記録する。実Host／Windows Process Gate、実AI・実Dockerの再成立は未実施。対象外Checkerエラーと中断runの回収未確認は保持し、全体QA・Release完成とはしない。過去保持物は操作していない。[最終是正・結果と限界](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#executor-final-cancel-and-oracle-20261105)を参照する。

AI Adapterの公開境界を6関数・11型へ整理した。計画時にSchema・環境・許可参照・診断を解決し、結果・非0終了・認証解析を共通入口へ集約する。Coordinatorの助言JSON往復を撤去し、五軸の現在利用判断はCoordinatorへ移した。共有型の明示化、旧別名・未使用定数の撤去、Source宣言順の追従漏れも是正した。AI Adapter45件、Executor100件、Coordinator関連154件、保存14件、Workbench関連18件を各条件で確認した。DIは74ee4f19fを固定し差分0、実AI・Docker・過去保持物は操作していない。横断台帳不整合・文書参照展開先診断は全体合格に読み替えない。[現在の変更・検証範囲](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#ai-adapterの解決済み公開境界2026-11-05)を参照する。


DI内部の用途非依存化を整理した。固定五資源の構築はExecutor、DIは不透明key・技術期待値・安全なCRDD名前／Labelで実体を照合する。固定ImageのUser・Entrypoint・外部Network条件は既存Catalogへ集約し、Task／Adviceの選択はExecutorが行う。Rootは7関数・15型を維持し、保存Schemaと既知ID／欠測ID・Directoryの既存保証は変更しない。DI197件、Executor100件、Coordinator関連214件、AI Adapter6件が成功し、Source／Architecture独立レビューは必須残指摘0。Checkerの全Package公開一覧と認証検証Toolの旧接続は追従済みで、公開一覧2件・認証有限12件・生成子静的接続3件が成功した。Checkerの配布入口に残る既存型検査エラーと参照展開先診断は全体合格に読み替えない。実AI・Docker・過去保持物は操作していない。[変更記録](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#di内部の用途非依存化2026-11-04)を参照する。

DIの共有技術検査3公開の追加整理を完了した。IdentityはExecutor／Domain、期待値はExecutorの構築入力、技術的な実観測・回収検査と例外分類はDI内部へ整理し、Rootは共通6操作＋固定構成照会の7関数・15型となった。DI177件、Executor全100件、Coordinator関連206件が成功。制限付き環境で不成立だったWindows取消2件は、固定終了補助がOS logon errorになることを切り分け、通常環境で2件成功を確認した。期限・安全判定は不変。Source／Architecture独立再レビューは必須残指摘0件。実AI・Docker・過去保持物は操作しておらず、実境界・全体QA・Release完了とは分ける。[最終接続と検証結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#最終接続と検証結果2026-11-03)を参照する。

前段の2026-11-03のDI公開契約と専用送信同意の整理は、今回の非AI範囲を完了した。DIは共通6操作、固定構成照会1、独立して必要な共有検査3の10関数・15型へ整理した。Task開始時のRepository追加Hostを全Stageで固定し、DIが技術Policyと環境を生成する。専用送信同意・確認コード・初期同意保存・送信Grantと検証Scriptの旧モード判定は撤去し、通常認可・Scope／Packet・限定是正・Home／Ownerの保証は維持した。DI171件、Executor全97件、Coordinatorの実行・回復238件、単一Task検証49件、経路／Process安全25件等と対象Workbench回帰・静的検査が成功し、独立再レビューの必須残指摘0件。対象文書・台帳の診断0と、参照展開先3,405診断による全体不合格は分ける。ローカル送信Policyの旧4値はフロントAIが明示移行し、他設定の不変、関連30件、静的確認と限定独立レビューを確認済み。検証時点では未Commitのため本番のCommit固定読取りには未反映だった。今回の確定Commitを実行対象に指定する際に移行内容を使うことになり、次の実AI前にそのexact版を再照合する。自動移行や作業ツリーfallbackは追加していない。先行中断runの清掃未確認は後続成功で解消しない。実AI・Docker・過去保持物は操作しておらず、実境界・全体QA・Releaseの完了は主張しない。[現在の範囲と検証結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#di補助契約と専用送信同意の責務整理2026-11-03実装中)を参照。以下は各段階の確認履歴である。

2026-11-02のDI共通IF追加整理では、資源集合に続き単一Container・固定DirectoryもinspectIsolation／cleanupIsolationへ接続した。Executorに残ったDocker技術接続・不存在→inspect合成と技術型をDIへ移し、旧低位六関数のRoot公開を撤去。同期性・元Promise・既存照合条件を維持し、認証も既存共通Cleanup接続済みと確認した。Executor95件、DI対象65件、Coordinator対象216件と静的検査が成功し、独立再レビューの必須残指摘0件。DI Root全体の公開整理と実境界再成立は未完了。実AI・Docker・過去保持物は操作していない。[現在の範囲と残件](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#di技術契約への収束2026-11-02完成条件の更新)を参照。

2026-11-02のDI共通入口整理では、通常Attempt・認証・固定ProbeのSource接続と、Attempt／認証の通常・単独回収、旧用途専用実行入口の撤去を完了した。DI343件成功（既存対象外5件skip）、Executor93件成功、Coordinator対象12 Suite・240件成功、独立再レビュー必須残指摘0件。同期Containerの単独回収は従来契約を維持する例外であり、全操作の同一Owner化とは扱わない。実AI・Docker・過去保持物は操作しておらず、新入口の実境界再成立は未検証。[今回範囲と検証限界](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#通常attempt単独cleanup旧入口撤去の閉包)を参照。

Executor単独の限定実AI確認では、Codex／Claude双方の編集・レビュー・開始後取消を確認した。今回の全試験物は回収済み。先行二試行の検証Tool清掃不合格は履歴として保持し、名前非依存の試験tmp清掃へ是正後の残る四試行は終了値0だった。上位連携・全体QA・Release成立とは分ける。[条件・回収・限定結果](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#残る四試行の実ai確認と回収完了2026-10-30)を参照。

2026-10-30の最新限定実測では、HTTP表示から切り離したCoordinator公開API経由のDirect／Isolated編集が各一Taskとも合格し、`E2E_EXIT=0`を確認した。Codex編集・Claude承認・Domainの同Task終端照合・資源回収・清掃Gateが成立し、今回物は全回収済み。成功時primaryFailureはnull。これは直接API経路の承認済み一回の限定成立であり、以下のCore移管全体の評価、全体QA、Workbench HTTP遅延の修復とは区別する。[実行条件・結果と主張範囲](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#workspace-direct-api-real-ai-pass-20261030)を参照。

文書上のMilestone／Roadmap／WBSはCRDD文書群、Task分解は呼出し側、Taskの実行順序・再試行・調停はCoordinatorが所有する。共通モデル・CRUD・保存はDomain、Provider一段の準備・開始・取消・終了証拠は[Executor](06_Architecture/Details/executor/01_Architecture.md)、段階順序・Workspace・Host保存は任意のCoordinatorへ分離した。MCP／Workbenchは既定Coreのみ、AI利用時だけ`--automation`を明示する。対象Source移管と非AI確認は限定完了。Coordinator全回帰1,795件の二不合格は試験追従を是正し、二Suite十五件が別実行で成功した。Windowsのrename拒否はNode単独でも再現し、拒否元未確定。全体QA未合格。共通保存先`.crdd/domain-model/`はSource切替済み、実データ移行と人間操作の確認は未実施。実AI／Dockerは上段の承認済み限定試験を実施したが、移管全体・全体QAの成立根拠にはしない。[移管結果・Windows調査・残る範囲](99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md#executor-optional-final-results)を参照。過去保持物は操作していない。

保存の旧候補の結果は[状態Owner分離の記録](99_Roadmap/Changes/CHG-000082/coordinator-storage-ownership-plan.md)に保持する。現在の移管結果へ流用しない。

先行の認証確認診断是正は`81d9647a4`でcommit・push済み。Coordinator332件、Workbench HTTP／診断30件と独立レビューを確認したが、実AI編集E2E成立とは扱わない。[診断是正と状態Ownerの調査](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#auth-create-diagnostic-minimal-fix-20261027)を参照する。

診断付き固定版`c12fbfc6`の一回実AI編集試験は、2026-10-27の非AI事前確認が両方式成功した後、Directの認証確認準備でunknown／`coordinator_task_provider_failed`となり停止した。認証確認用Containerは作成済み・未起動、Provider開始・外部送信・共有書込みは技術記録上未発行で、段階診断は零、HTTP通信失敗なし。作成応答の受領・記録を含む詳細な失敗原因は未確定。Isolated未開始、再試行・再起動なし。同じexact回復IDの既存resumeでDocker／Host回収・排他解放・技術履歴確定と操作記録撤去は完了したが、上位Taskはrecovery_requiredのまま。元の失敗結果と新品合成Rootは2026-11-03までの再評価対象として保持し、期限だけで削除しない。既存停止Containerは保全、今回専用Container／Networkは不存在、標準bridgeのIdentity変更は原因未確定で削除対象にしない。専用端末・短命入口は回収済み、実行Source不変、過去保持物操作・生出力保存なし。[一回の停止箇所と回収結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-stage-diagnostic-once-20261027)を参照する。

先行候補の非AI診断是正・広域回帰1,869件の結果と未検証範囲は[当時の記録](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-stage-diagnostic-20261026)に保持する。現在の移管候補の検証とは区別する。

固定版`c01da3f4e`の承認済み一回実AI試験は、非AI事前確認の両方式成功・清掃後、Directの独立Review非承認で停止した。HTTP Timeoutと終了確定不成立は今回結果に現れず、四技術履歴の終了・Host清掃・Lease解放を確認したが、合成source.txtはBASEのままで編集E2Eは不合格、Isolated未開始。Reviewのdecision値・件数・指摘内訳は有限Tool結果に含まれず、具体理由は未確定。現在操作・回復待ち・配送待ちは零、今回の試験Container等の実行資源と短命入口は回収済みだが、blockedの合成Root・結果・終了要約待ち一件を2026-11-02までの再評価対象として保持する。再送・再起動・過去保持物操作・生出力保存なし。[一回結果と回収限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-settlement-fixed-ai-once-20261026)を参照する。

各Stageの終了保存成功・排他解放後にNode標準setImmediateでI/Oへ制御を返す最小是正を追加した。十五秒期限、Writer拒否、取消後の清掃継続、全最終確定とHost再観測は維持し、新Worker・Queue・Lockは追加しない。現候補でCoordinator323件・Windows実Writer四形・Workbench35件と静的検査は成功、独立レビューの文書Minor二件は是正済み。三Stage並行照会は初回保存後に応答し、子の通信5,980msと親のclose観測17,903msを区別して記録した。単一保存最大時間や前回実AI原因・編集E2Eの解消までは主張しない。AI再送・実Docker・過去保持物操作はなし。[制御返却と非AI最終結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#settlement-io-yield-20261026)を参照する。

終了確定の二重保存を最小是正した。同じProcessの元Ownerが既に保持するcompleted結果だけを最終確定で再利用し、別Stageが進めた状態へ古いSnapshotを再保存しない。blocked／欠測の再入場、Writer安全判定、transient退役・durable保持、十五秒期限は不変。制御返却追加前の候補ではCoordinator対象322件・Windows実Writer四形・Workbench35件、静的検査と限定独立レビューは成功／残指摘零。制御返却追加前の三Stage同期受領と並行HTTPは13,671msで十五秒内だが余裕が小さかった。後続の制御返却候補は別に評価し、前回実AITimeoutの唯一原因や解消を確定しない。AI再送・実Docker・過去保持物操作はなし。[最小是正・非AI測定と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#settlement-finalization-reuse-20261026)を参照する。

候補診断付き固定Source`482e20736`の一回実AI試験は、非AI事前確認が両方式成功した後、DirectのHTTP状態観測15秒Timeoutで停止した。取消後Taskはunknown／`coordinator_task_docker_recovery_finalization_unconfirmed`、Isolated未開始。今回の候補拒否診断はevent零で、候補検査故障の再現とはしない。今回実行資源は一覧に残らず、現在操作・回復待ち・配送待ちは零だが、Task unknownと終了要約待ち一件のため今回Rootを2026-11-02までの再評価対象として保持する。既存変更は保全、期待編集なし。再試行・Docker再起動・過去保持物操作は行わず、HTTP遅延と終了確定不成立の根本原因は未確定。[一回の結果と回収限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-candidate-diagnostic-once-result-20261026)を参照する。

候補検査停止の切り分けに、取得状況・Path件数／一致・既存の非秘密実行観測だけを既存Lifecycle通知と検証Toolの一取得器へ接続した。拒否条件・公開理由・Authority・cleanup・耐久Schemaは不変で、生出力は保存しない。Coordinator対象322件・Workbench対象35件、診断局所九件と両Packageの静的検査は成功し、独立再レビューの残指摘は零。[最小診断是正と検証範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#candidate-validation-minimal-diagnostic)を参照する。実AI再送・Docker操作・保持物操作は行わず、過去失敗の一意原因や編集E2E成功は未確定のままとする。

三判断分離後の固定Source `a5afae98e`で承認済みの合成編集E2Eを一回実行した。非AI事前確認はDirect／Isolatedとも成功したが、実AI DirectはCodex Executor attempt0のStageがcompletedを返した後の`coordinator_task_candidate_revision_invalid`で停止し、Claude・限定是正・Isolatedは未開始。過去三値はunknownを維持し、Provider内部のEffect成立を推定しない。合成source.txtはBASEのままで、候補取得不成立とProvider申告不一致のどちらかは未確定。HTTP故障なし、実行資源のcleanup／close確認済み、回復参照・副次失敗なし、試験Node零・Source不変。正常完了専用Gateはblockedへ拡張せず、結果と合成Rootを2026-11-02までの再評価対象として保持する。再送・再起動・旧保持物操作なし。実AI編集E2Eと前回是正の実AI反復は未成立のままである。[今回の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-continuation-edit-stop-20261026)を参照する。

過去のEffect履歴・旧実行の現在の安全性・新試行の実行許可を分離する最小是正を実装した。同じTask／Hostの既存技術終端条件が成立する通常継続では、過去の三値unknownを変更せず次段階へ進める。既存の実行許可検査を維持し、限定是正の前にも既存Workspace検査を接続した。新しいState・Registry・Lock・公開APIは追加しない。Codex→Claude→Codex→Claudeと拒否例の非AI通常291件、Windows専用の先行成功9件、試験接続追従後のOwner再入場・解放13件、静的検査と限定独立確認は成功／残指摘零。初回不合格は保持し、単一runの全体回帰や実AI編集E2Eの成功へ換算しない。失敗した合成試験Root25件は強制清掃せず、2026-11-02までの再評価対象として別記した。[調査・最小実装と検証範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-diagnostic-edit-stop-20261026)を参照する。

基準の実AI試験は診断追加版`e2223c180`でDirectが`unknown / docker_process_controller_recovery_unavailable`となり、限定是正試行（taskAttempt 1）の`operation_start_save`停止をTask相関のみの通知で観測した。今回再現した開始保存条件はこの結果と整合するが、当時のWriter内部の拒否分岐を直接記録したものではなく、唯一の原因と断定しない。初回Codex／Claudeの各五資源は不存在観測・Lease解放済みだがHost終了・最終確定は保留。四exact回復参照と合成Rootは変更せず保持し、回収完了とはしない。実AI再送・Docker操作・保持物操作は行っていない。

先行の同意入口拒否では、固定Source `ddee28f85`で承認済み合成編集E2Eを一回開始したが、Directが`coordinator_task_external_send_confirmation_unavailable`で実AI起動前にblockedとなり、Isolatedは未開始だった。Task終了・cleanup確認済み・回復参照と副次失敗は空、Docker一覧・実行Sourceは不変。再送・再起動なし。通常の初回送信同意は別の対話確認であり、Toolの`--external-send-confirmed`だけでは代替しない。確認入口のunavailable内のLock取得／Console接続のどちらかまでは未観測。このDirect領域は終了要約一件・解放済みLease根拠二件とともに保持し、清掃完了とはしない。この時点では対話端末での通常同意を伴う一回の再実行判断が必要だった。[停止理由と保持状態](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-edit-consent-stop-20261026)を参照する。

固定Source `8a9b85578`で新品のDirect／Isolated非AI事前確認を一回実行し、両方式の公開操作、既存変更保全、候補固定・二親Merge、履歴確定と試験Root清掃まで成功した。Tool終了零、両方式limitedProbePassed／closeConfirmed／runtimeClean／workspaceClean true、fixtureRootsRemoved true、清掃失敗なし。Docker一覧・実行Source不変、AI起動零。前回失敗結果は同一Hashのまま兄弟の`preflight-before-history-fix.json`へ保存した。続く開始前照合で、実AITaskの追加受付・結果記録を非AI専用Gateが拒否する不一致を検出し、製品Sourceを変更せず既存の終了記録保守へToolを接続した。最終対象三Suite二十六件、静的確認、独立再レビューは成功。実AI編集はまだ未実施。[新品の事前確認と追加接続](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-preflight-fixed-20261026)を参照する。

Isolated非AI試験の停止は、試験ToolがQueue退役APIを履歴搬送に使い、正常な採用・解放済みLease記録にも零を要求していた接続不一致だった。製品Sourceは変えず、既存の履歴専用搬送APIと方式別の終了状態照合へToolを修正した。対象HTTP二十六件・既存履歴搬送一件、静的確認、限定独立レビューは成功。固定Commit `b089fd2b3`の同じGateを今回Rootへ適用し、終了要約一件の確定と結果二件・Lease六組・Queueの不変を確認後、今回の合成Isolated Rootを清掃・不存在確認した。元の失敗結果JSONは変更せず保持する。これは清掃の完了であり、新品の全事前確認や実AI編集E2Eの成功ではない。実AI再送・Docker操作・旧保持物操作は未実施。[分類と限定是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-edit-e2e-20261026)を参照する。

Direct／Isolated実AI編集の前に、固定Source `dff1fce85`で新品の非AI事前確認を一回実行した。編集代役・既存変更保全・候補固定・二親Merge・Worktree／Ref回収は両方式で成功したが、Isolatedの終了記録が残り清掃Gateで停止した。AI送信は零。Workspace履歴行の退役未接続と、試験Toolが破棄後Queueへ開始前baselineを要求する不一致の少なくとも二点を当時確認した。停止直後時点ではresults二件・leaseEvidence十二件が正常な終了記録か追加の退役未接続かは未分類で、最小是正は未確定だった。Direct試験Rootは清掃済み、Isolatedは強制削除せず2026-11-02までの再評価対象として保持した。旧保持物・Docker再起動・再試行なし。実AI編集は未実施のまま。[停止結果と最小是正候補](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-edit-e2e-20261026)を参照する。

改善後Source `886f5ed3e`でClaude Opus 5.5／mediumの合成読取りを一回実行し、Task・実行completed、HTTP失敗・Timeoutなし、cleanup／close確認、回復参照・副次失敗なしで成功した。本体・合成入力は不変、再送・Docker再起動・既存保持物操作なし。今回合成Rootと短命入口は終了義務・非使用を確認後に清掃し、不存在確認済み。安全な結果JSONだけ期限付き保持する。前回本文は清掃済みのため今回は既存HTTP試験形式の744 bytesで、完全同一入力比較ではない。現在の条件で利用できることは確認したが、前回の支払い不調や終了1の原因、Source改善との寄与分離は未確定。Direct／Isolated編集E2E・全体E2Eは未実施。[今回の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-improved-source-once-20261026)を参照する。

本番保存経路のRepository実体再検証について、一回の確認内だけで重複していた探索を統合した。Coordinator保存借用の一回の再検証は五探索から二探索となり、前後のfresh確認、別I/O段階の確認、Lock・書込み・読戻し・拒否条件を維持する。Version Control全71件、保存・排他・履歴90件、HTTP検証25件は成功、静的確認も成功。計測器なしの同じ合成状態初期化と二Queue保存は、変更前約7.09秒から変更後約4.92秒／3.68秒となったが、任意Repositoryの性能保証ではない。元実AIの受信前18.6秒の占有処理とClaude終了1の原因は未確定で、実AI E2E成功とはしない。AI再送・Docker操作・既存保持物操作なし。[限定是正と検証範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#storage-revalidation-consolidation)を参照する。

IPC是正後のClaude Opus 5.5／medium読取りを同一合成Contextで承認どおり一回実行したが、状態観測のHTTP15秒Timeoutで不合格。最後のGETはClient開始からServer受信まで18,592ms、受信後の応答は658ms、Owner観測46msだった。子の入力待ちではなくServer受信前の遅延を観測したが、占有処理やProvider終了1との因果は未確定。Task一次理由はprovider_process_exit_nonzero。同ID取消・終了・実行資源回収は確認済み。本体・合成入力は不変、再送・Docker再起動・既存保持物操作なし。今回Rootは残存義務・未実行fixture・Git・非使用を独立確認後に清掃し、不存在確認済み。今回短命3ファイルとDirectoryも回収済み。安全な結果JSONだけ期限付き保持する。[一回の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-ipc-readonly-once-result)を参照する。

承認された検証Tool限定の是正として、HTTP子Processへの入力をstdin終端待ちからNode標準IPCの一件搬送へ変更した。HTTP15/60秒・親20/65秒・終了確認・Task Ownerは維持し、対象回帰25件、型・整形・lintと独立レビューを完了した。親を22秒停止する反例でも正式ClientのHTTP完了と子終了を確認した。実AI再送・Docker操作・保持物操作は行っていない。元実AIの親占有処理・Provider非0との因果・以前の15秒HTTP故障は未確定で、実AI E2E成功とは扱わない。[是正と非AI検証](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#verification-client-ipc-implementation)を参照する。

承認された計測付きClaude Opus 5.5／medium読取りを固定Source `b114c08f`・同じ合成Contextで一回実行した。GET13件は約0.57〜0.95秒だったが、最後はHTTP15秒故障ではなく、検証用Client子Processの親側20秒監視で停止した。Taskはprovider_process_exit_nonzero、取消結果・資源回収・終了は確認済み。親側callback処理に最大約8.3秒の観測遅延があり、元のGET15秒故障、最後の要求の停止境界、Provider非0との因果は未確定。再送・編集E2E・Docker再起動・既存保持物操作なし。今回Rootと短命四File・tmp directoryは安全条件を再確認して清掃・不存在確認済み。兄弟の非秘密結果JSONだけ期限付き保全する。[今回の実測と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-observation-timing-once)を参照する。

新Model読取りを固定Source `59cd8ec3`で各一回実行した。Codex `gpt-6.1-sol`／mediumは成功。Claude `claude-opus-5-5`／mediumはTask・実行completed、cleanup確認済みだが、状態観測のHTTP headers未観測Timeoutにより検証全体は不合格。再送せず、Direct／Isolated編集E2Eは未実施のまま停止した。保持中の採用済みCandidateは既存APIで終了・Workspace破棄し、未解決義務ゼロの試験領域9件を確認後削除した。Isolated2領域の履歴確定待ち各1件と、正式回復がresource_unconfirmedで停止した旧unknown領域は2026-11-01までの再評価対象として保持する。Docker再起動・強制削除なし。[今回の結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#new-model-ai-once-results-20261025)を参照する。

検証Toolのexact `/workspace/action` 全操作だけ60秒／親65秒へ是正し、AI受付・取消とAI状態観測を含むWorkbench viewは15秒／親20秒を維持した。型・静的確認、対象十八件回帰、新品合成Repositoryの非AI Direct／Isolated事前確認が成功した。固定・二親Merge・Candidate終了・Worktree／Ref回収まで成立し、当該adopt応答は約27秒。製品Source・Lock機構は変更していない。先行のLock失敗はinline起動引数のWorker継承によるもので、診断・回収は通常File起動とする。当該非AI事前確認では実AI0回、再送・Docker再起動なし。今回の成功を旧試験の成功・回収へ遡及しない。[原因・限定是正・確認結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#new-model-ai-e2e-approval-20261025)を参照する。

Repository Manifestの旧Capability宣言を統合先の`coordinator`、現名称の`mcp-server`／`domain-model`へ追従した。公式Codex CLI 0.164.0とClaude Code 2.1.310の新Image・技術Catalogを固定し、`.crdd/config/ai-selection.json`はCodex `gpt-6.1-sol`／medium、独立ReviewerだけClaude `claude-opus-5-5`／mediumを指定する。公開Readerと五役割の選定、非AIの起動・合成隔離・試験物回収と対象回帰は確認済み。現在は両新Modelの読取りTask／実行completedを各一回観測したが、Claude検証全体は状態観測Timeoutで不合格。Host RPC・編集E2Eは未確認。旧Modelへの暗黙fallbackはない。[設定とImage更新の結果・限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-image-update-20261025)を参照する。

先行の旧Model条件で承認されたDirect／Isolated編集E2Eは、実AI前の正式非AI事前確認で停止した。Directの合成変更・既存Dirty／Stage／未追跡保全は成功したが、IsolatedのWorkspace準備でHTTP応答未観測の15秒Timeoutとなった。作成自体は同UUIDの状態・Gitで成立を確認し、当該試験での再試行・AI送信は行っていない。先行試験のWorktree・専用Branchは既存公開discardで回収済み。終了要約一件の履歴確定は保存Owner取得不成立で止まったため、先行試験の合成Rootは2026-11-01まで保全する。編集E2Eは未実施のままである。[先行試験の失敗と回収状態](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-edit-preflight-timeout-result)を参照する。

修正版`1861c09aa`で同条件のClaude読取りを承認どおり一回実行し、Task／実行ともcompleted、HTTP故障・Timeoutなし、cleanupConfirmed trueとなった。既存停止Container以外のContainerや試験Networkは終了後一覧に残らず、本体・合成入力・選択設定は不変。今回はlimitedProbePassed trueであり、実AI編集・全体E2Eの成功ではない。今回合成Rootの履歴出版待ち一件は、終了後メンテナンスの保存Owner取得が不成立だったため保全し、2026-11-01を再評価期限とする。未解決回復・結果配送待ちは零、旧保持物は不変。[一回の成功結果と記録保全](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-turn-acceptance-result)を参照する。

ProviderのCLI実行制限と結果受理を分離した。Claudeの助言・編集・レビュー・boolean Probeは`num_turns`を正の安全整数の観測情報として扱い、CLI要求値や計画上限との比較で拒否しない。Claudeの起動引数とTask計画上限16、Codexの一依頼終端検査、既存Timeout・取消・回収は維持する。結果受理用の上限入力・上限超過判定fieldを撤去し、契約説明・改訂と利用側を追従した。過去の失敗・診断・保持物は不変。非AI回帰とレビューの確定結果は[今回の是正記録](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-turn-limit-result-separation)へ接続し、実AI成功へ読み替えない。

診断付きClaude読取りを承認どおり一回実行し、成功Envelopeの`num_turns`が数値3だったことを確認した。CLI終了0の後、CRDDの1〜2整数条件で拒否しており、今回は認証失敗・Container作成unknown・HTTP故障ではない。`--max-turns 2`との数え方の差やCLI側の意味は未確定で、当該実測時点では受理条件を変更しなかった。その旧比較条件は今回の現行方針へ置換済みである。今回の実行資源は回収確認済み、未解決回復・結果配送待ち（pendingDeliveries）は零、履歴出版待ち（historyPending）は一件。合成Rootは失敗記録と未配送履歴一件のため2026-11-01を再評価期限として保持する。AI再送・再起動・旧保持物変更は行わない。[今回の一回実測](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-turn-count-diagnostic-once-result)を参照する。

Claude助言のTurn数拒否に、有無・型と正規化済み数値表記だけの任意診断を接続した。AI Adapter→Controller一次失敗→状態・履歴→検証Toolの搬送を揃え、生出力・文字列／Object本文は保存しない。診断追加時点では1〜2整数の旧受理条件、取消・回収・実行許可を維持した。旧回数比較は冒頭の現行方針へ置換済みである。局所搬送三件と、Controller／Tool156件・状態契約一件・AI Adapter24件は成功した。実AI再送・Docker・認証・保持物の操作はなく、先行失敗の具体的な`num_turns`は未復元。[最小診断と非AI検証](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-turn-count-minimal-diagnostic)を参照する。

Claude再認証後の正式statusはconfirmed／cleanupConfirmed trueとなり、loginの三Container・二Networkとstatus用Containerの不存在を確認した。その後、同じ合成Context・固定質問・opus／mediumの読取りを承認どおり一回実行したが、Claude CLI終了0の後に`workbench_ai_claude_turn_count_invalid`でblockedとなった。HTTP故障・Timeoutはなく、実行資源の回収と入力不変は確認済み。再試行せず、失敗診断と未配送履歴一件のため今回合成Rootを期限付き保持する。当該先行試験時点の正規化は`num_turns`に1～2整数を要求していたが（現在は冒頭の正の安全整数契約へ置換済み）、実値は保存しておらず、上限超過・欠落・型不正の別は未確定。[再認証後一回の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-after-reauth-result)を参照する。

Codex／Claudeのstatus共通化では、Provider固有の正規出力・出力先・既知警告の検査をAI Adapterに閉じ、Coordinatorは共通結果と終了値だけを扱う。未ログインは確認操作完了／未認証であり、login成功やTask実行許可には昇格しない。共通化の非AI検証はCoordinator関連168件・AI Adapter24件、型・整形・lintが成功し、その検証自体では実Home・Docker・AI再送・login・先行保持物を操作していない。後続のClaude実認証結果は上段と区別する。[両Providerのstatus共通化](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-authentication-status-unification)を参照する。先行一回の実status失敗と回収済み結果は[元の比較記録](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-formal-authentication-status-result)へ維持する。

先行の非AI調査では、専用Homeの想定位置に認証Fileが存在することと、正式status／Task前probeの共通Mount構成を確認した。両経路には更新・telemetry抑止環境値の差があるが、原因とする根拠はなく製品修正は行っていない。既存二Suite38件は成功。資格本文・期限は未読で、この調査自体ではAI再送・実Container追加・login・Docker再起動・保持物変更なし。その後承認された正式status比較の結果は上段を参照する。[先行調査結果と比較案](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-authentication-path-investigation)を参照する。

追加診断付きのClaude読取りを承認どおり一回実行し、認証確認CLIの正規出力が「未ログイン」（`authenticationStatus: unconfirmed`）で終了1だったことを確認した。Container作成unknownではなく、作成後の認証確認で停止している。認証切れかContainer内の認証利用経路かは未確定で、AI本体・外部送信は未開始。今回はHTTP故障なし、回収確認済み、操作・未解決回復・配送待ちは零だが未配送履歴一件は保持する。再送・再起動・先行保持物の変更は行わない。[一回試験の診断結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-auth-diagnostic-result)を参照する。

読取り確認の失敗を非AIで切り分け、拒否条件を維持したまま認証三値とHTTP子の固定故障段階・終了観測だけを既存診断へ追加した。Coordinator影響158件、Workbench通常86件、静的検査と独立レビューは成功／残指摘零。残ったWindows保存・再入場試験も、旧CLI・Module代役の登録順・試験importだけを追従し、一件と関連CLI十九件の成功まで確認した。文書参照展開先3,368指摘と、元のClaude故障原因未特定は維持する。AI再送・Docker操作・保持物変更は行っていない。[診断の最小是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#readonly-failure-diagnostics)と[Windows試験の追従結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#windows-state-cli-followup)を参照する。

先行のClaude読取り確認は、認証確認Containerのstart／attachが終了1となり、Provider本体開始・外部送信は未発行のまま停止した。別にobserve用HTTP子Process故障も記録し、同IDの取消結果・技術一次故障は保持できた。その実行資源は回収確認済みで、Task返却の未解決recoveryIds・secondaryFailuresは空。ただし清掃済み履歴のDocker相関参照とhistoryPending一件は保持する。失敗調査と未配送履歴の保全のため同合成Rootを保持し、2026-11-01までに既存Ownerで履歴の配送・保持を確認して清掃判断へ戻す。先行unknown Rootは変更しない。再送・Docker再起動・編集二試験は行わない。先行observe故障の因果は現在も未確定であり、現在の次候補は上段の認証利用経路の非AI調査である。実AI E2EのPassではない。[先行結果と回収範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-confirm-result)と[再開前確認](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#pre-ai-readonly-readiness)を参照する。

修正済み前提からClaude読取りを承認どおり一回試したが、認証確認Containerの作成結果はunknownのまま、結果観測ではHTTP診断上timedOut false／ECONNRESETを記録して停止した。同じTaskの取消結果も保持できた。一方、保持記録のProvider本体はnot_started・外部送信not_issuedで、回収未確認と三つの副次失敗が残り、新しい合成Rootとexact回復参照を保持する。再送・追加再起動はしていない。[今回の診断・保持範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-once-diagnostic-result)を参照する。

追加調査では、Toolのobserve失敗後に同じTaskを取り消す順序を確認した。合成の無出力子を既存処理で取り消すと、元CLI記録と同じ終了1・stdout／stderr各0となったため、この終了形だけでDockerによるcreate拒否とは断定できない。loopbackが利用できる追加権限では、実HTTP Ownerと検証Clientの五要求・三条件比較はすべて成功し、切断は再現しなかった。通常制限下の実行はhandled0で比較成立前に停止したため、この成功へ含めない。既存Docker backendログ内にはUTC14:57:13〜19の起動遷移が記録され、bridge作成時刻もその窓内にある。ただし発行者、元要求との直接相関、HTTP切断との因果は未確定。この読取り・合成比較では追加の製品修正・AI再送・Docker操作・保持物変更は行っていない。[今回の事実と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#http-cancellation-and-backend-startup-diagnosis)を参照する。

単体create比較は、標準／CRDD経路の固定Python、固定Claude Imageの空Home、追加承認した実Claude Home指定で成功した。最新の実Home指定は474ms・終了0で、停止状態のMount表示を照合して今回Container・一時Fileだけ回収した。Container起動、probeによる認証Home本文の読取り・変更要求、認証・AI・通信、Docker再起動は行っていない。認証有効性や元故障の原因特定ではなく、保持物は不変更。[実Home比較の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-real-home-create-comparison)を参照する。

耐久Task受付と実行開始の分離、および検証ToolだけのHTTP Client別Process化を実装した。Task Owner・API・15秒HTTP期限は維持し、新Worker／Queueは追加していない。Workbench通常結合回帰85件、Coordinator関連回帰24件と限定独立再レビューは成功。子の受付応答本文完了は約2.9秒、取消は約11.7秒で、親の終了通知処理の遅延とは分離して観測した。同Processの過去の期限超過、元observeのECONNRESETとContainer作成unknownの原因は未解明で、実AI E2E・全体QA完了とはしない。変更4文書の指摘は零だが参照展開先には313指摘が残る。AI再送・Docker要求・保持物操作は行っていない。[結果と未完境界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#task-acceptance-candidate-verification)と[先行調査](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#http-real-task-storage-diagnosis)を参照する。

初回結果の回復参照搬送漏れは既存引渡し値を初回保存へ届ける最小修正を実装済みで、terminal検査は維持する。静的検査、助言22件、初回実保存一件、関連回帰269件、Catalog384件の検査は成功。単発保存Suiteも約四分五十三秒で二件すべて成功し、前回中断が早すぎた点は訂正済み。全体回帰・実AI完成ではない。[参照搬送の是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#advice-recovery-reference-handoff-fix)と[保存Suiteの切分け](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#single-task-state-duration-diagnosis)を参照する。

先行する合成設定の保存拒否は、空Git templateで作った確認fixtureの`.git/info`未準備として非AIで特定・是正済み。製品の安全条件は変更せず、保存Suite十一件・静的検査・限定独立レビューが成功した。この是正の試験物は清掃済みであり、新たに保持した今回Rootとは区別する。[保存準備の是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#selection-save-preparation-diagnosis)を参照する。

非AIの初回全体は1,850件中1,811成功・33失敗・6skipで不合格を保持する。全33失敗はSource・安全条件を変えず通常Windowsで成功確認し、関連正常系と環境skip一件を含む対象確認は計51件成功。AI Adapter24件・Workbench合成HTTP12件と静的検査も成功した。単一runの全体Passとは表示しない。[確定結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#元作業再開後の非ai回帰--2026-10-24)を参照する。

保持②は利用者承認の安全確認後、合成試験Root・対応する空のHost一時Root・旧marker一件だけを削除し、三対象の不存在を確認した。現行の状態・履歴に元参照はなく、対象ProcessとDocker資源も直前照会で不存在。AI再送・Docker再起動・認証領域操作・新しい回復機構の追加はない。旧試験の失敗・作成結果unknownとexact回復参照は履歴へ維持し、旧APIの回復成功や編集E2E成功には変更しない。[限定清掃の範囲と結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-disposal)を参照する。元失敗の因果は[読取り調査](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-readonly-diagnosis)の限定結論を維持する。

ClaudeのJSONエラー説明の取りこぼしは、既存AI Adapterの変換内で最小是正した。公開理由・APIを増やさず、生出力は保存しない。AI Adapter全24件、Coordinator影響回帰306件と静的検査が成功し、限定独立レビューは残指摘零。過去の実失敗原因は未特定で、実AI再送・Docker／認証操作・保持②の操作は行っていない。未実施の編集二試験や全体E2EをPassへ変更しない。[結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claudeエラー変換の最小是正と非ai回帰--2026-10-24)を参照する。

再承認後、通常ファイル入口でCodex／Claudeの認証状態と回収を確認した。新品合成Contextだけを使う実AI読取り試験はCodex成功、Claudeは起動後の終了値1でblocked。両方のProcess終了・Container／Network終了後不存在・Tree不変を確認した。AI起動計二回、再送なし。停止条件に従いDirect／Isolated編集二試験は未実施。Claudeの非0原因は未特定で、認証切れ・通信故障とは断定しない。Docker再起動・本体設定移行・保持②の操作は行っていない。[観測結果と停止範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#再承認後の合成実ai確認--2026-10-24)を参照する。

Repository別AI選択をTask・Objective・Grant・Packet・Operation Identityへ接続し、Home利用権限からModel選定を分離した。現在State／Project Snapshotはv5、Operation Identityはv2で、新形式だけを扱う。旧AI Profile／Store・MCP四Tool・Host Catalog起動依存を撤去し、Workbenchは選択Repositoryの設定Reader／CAS Writerと作業分類・明示選択へ接続した。Objective六Sourceと本番`public-*.ts`の整理、正式API・対象→操作のCLI・本番Consumer接続も完了した。

固定版`9db97f00a`の通常全体回帰は1,845件中1,788成功・52失敗・5skipで完走し、不合格として保持する。失敗は検証Tool・旧fixture・Owner参照・依存検査の追従漏れへ全数対応付け、通常実装と安全条件を変えず是正した。関連17 Suiteは217件全成功。実保存・Workspace・回復の影響四Suiteは102成功／1失敗で完走後、最後の試験側Owner搬送を是正し、当該Caseと公開境界の3件成功まで確認した。型・整形・lint・Trace・Header全数・台帳383件の検査と限定独立レビューは成功／残指摘0。一〜五の実装・本番接続・非AI検証は限定完了で、未解消の今回回帰失敗はない。実AI・実認証・人間確認・本体設定の実移行、全体QA・Releaseは未完了であり、全体完成とはしない。②のAI再試行と保持物の内容・Runtime状態・資源実体の操作は行わない。一度のDirectory metadata一覧観測は[最終確認の範囲と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#final-normal-regression)へ記録した。

Coordinator構造再設計の残る配置を56 Sourceへ一括移管し、今回のSource・利用側・試験・設計／登録追従を限定完了とした。公開Root217項目と保存B六Fileの本文は維持する。固定本番Sourceの全体回帰は1,854件中1,830成功・19失敗・5skipで完走。19失敗はすべて試験側の旧配置前提へ対応付け、修正版の対象Suiteを275件・13件・47件・21件で全成功まで確認した。最初の全体Commandを成功へ読み替えない。静的検査、Windows保存、直接利用側、限定独立レビューは成功／残指摘0。[最終結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3822-残るsource配置の一括移管と最終確認)を参照する。横断QAと実境界E2Eは別途残り、実AI②・保持物・実Docker・認証は今回の対象外。

Coordinator構造整理の先行単位では、承認済みの本番未接続Trust評価と旧terminal codec／caller保存候補を廃止した。旧4 Source・専用試験3本、登録・設定と設計／QAを追従し、直接利用側24件と共通排他・回復・保存・履歴96件が成功、限定独立確認の残指摘0。Native共通処理・通常回復・保存統合Bを維持する。独立Trustの上流意図は代替未接続のまま残し、廃止を品質成立へ換算しない。[対象と確認範囲](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3812-限定廃止の確認結果--2026-10-23)を参照する。

保存統合Bは、実装・旧試験の移行・固定版回帰の範囲を完了した。Task・Queue・Workspaceを共通Ownerと単一物理Writerへ接続し、履歴も同じRoot・保持設定へ切り替えた。旧ACK専用API・内部枝・二段リレーと旧設定Reader・配布例・Schemaを撤去した。固定通常回帰は1,862成功・失敗0・5skip、Workbench／MCP共通入口一件とWindows保存影響三十件も成功した。実AI・実DockerのE2Eと全体QAの完成ではない。次候補は利用者提示のCoordinator構造再設計であり、今回の保存契約を凍結基準にする。[確認結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)を参照する。

②の実AI編集E2Eの今回試験は利用者判断で終了し、2026-10-24に既知の今回試験物・旧Runtime記録を限定廃棄した。作成結果unknownと同じ回復参照は歴史記録へ維持する。旧APIの回収成功・E2EのPass・一般回復条件の緩和ではない。AI再試行は行わない。[当時の終了判断](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-edit-trial-ended-unresolved)と[今回の清掃結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-disposal)を区別する。

固定Commit `d4edcd1e`後の追従是正では、検証Tool3 Suiteの接続、Test Header全数Gate、現行文書43診断の是正に続き、確定誤検知236件を検査側で解消した。生診断は1,836→1,600、追加0。Checker全386件は385成功／既知1失敗（残1,600診断）で完走した。文書診断は現行0、歴史CHG旧参照3,353による全体不合格を維持する。Browser接続1場面も元失敗の原因未確定のまま。当該是正時点では、②のAI再試行・保持物削除は行わず、保持3 Hashと安全条件は不変だった。[今回の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)を正本とし、[先行の分類・文書是正](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)と[是正前の固定版結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression)を区別する。

v0.22のCHG-000082は進行中。Docker Isolationは`a04ecb70`でコミット・プッシュ済み。Direct／Candidateは共通のDocker方針を採用し、開発用`.env`がCoding AIから読まれ得るリスクを受容した。本番SecretはGit・通常開発環境へ置かず既存管理を使い、開発資格は本番権限なし・限定権限・期限ありとする。独自Secret Manager・file別ACL・動的Mount許可Frameworkは追加しない。固定Pathの最小Mount試験は二構成で成功し、通常Source書込みとGit／内部状態への書込み拒否を確認した。全link経路・任意Repository・製品実装全体の保証ではない。Coordinatorの借用実行は実装・結合試験と独立再レビューまで完了（限定範囲）。実Provider E2E・実データ移行は未実施。統合・タグ・リリースは含めない。条件と限界は[接続結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#借用実行接続の実装結合確認の区切り)を参照する。

Version ControlのWorktree管理に続き、名前付きCandidateの明示固定・別採用・二親MergeとOrchestratorの既存保存・排他への内部接続を実装した。選択外のCommit／Stage混入を避け、失敗後も同じ候補で再入場し、採否確定後の不要Refを回収する。新しい管理台帳・Lock・一般Recoveryは追加しない。公開Surface・本番Direct／Candidate切替はSource接続と限定検証を完了し、旧Bundle／Store本体・専用Native処理を撤去した。新構成全体の実境界評価と実データ移行は未完了。filter設定・gitlinkを含む作成は未対応として拒否し、部分試験を新Workspace全体の完成へ換算しない。現在の結果と限界は[採用・Git統合の実装結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#採用git統合のsource接続と実git確認)を参照する。

| 対象 | 現在の状態 | Owner Relation |
|---|---|---|
| 統合前の追加構造整理 | 旧Coordinatorの六単位と判断入口に続き、活動Reader四Fileと保存Bindingを状態照会へ移管し、C前の小Folder整理を限定完了（現Source82／70）。Orchestrator通常129件・利用側74件成功、Storage七Fileは不変、独立レビュー指摘0。残す型契約等は用途又は保存凍結の理由を記録。次はCの入口・Package統合、保存の最終評価は別単位。既存OPEN・横断検査3失敗とWorkbench既存lint二件・全体QA未完了を維持する。②の再試行・保持物操作は行わない | [活動照会とBindingの移管結果](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#27-活動照会と保存bindingの配置整理) |
| Cの統合・名称切替と保存再編 | Task／ObjectiveとExecutionをCoordinatorへ統合し、通信・構成・診断名と設計配置を切り替えた。保存統合Bの単一Writer・共通Owner・原子受領・履歴接続、旧ACK専用枝撤去と試験移行を完了。固定通常回帰1,862成功・失敗0・5skip、共通公開入口一件・Windows保存影響三十件も成功。C全体・実境界E2E・全体QAの完成とは区別し、過去CHGの文書不合格と②の保持物は維持する | [Bの確認結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)、[単一保存Lifecycle](06_Architecture/Details/coordinator/04_Task_Detailed_Design.md#unified-storage-lifecycle) |
| C前のCLI責務整理 | CLIを受付・引数・回復表示・取消の四Fileへ限定し、診断・版判定・同意端末を既存責務へ移管。通常全回帰1,717成功・失敗0・5 skip、局所120件・端末18件・直接利用側の試験と静的検査は成功、独立レビュー残指摘0で限定完了。関連Dynamic Fake coverageの連続二回出力不一致と既存命名検査3件は別件として維持し、全体QAのPassとはしない。C統合・②再試行・保持物操作は未実施 | [CLI整理の結果と計測課題](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#231-cli整理の確認結果と残る計測課題) |
| 残る実行系の再編 | 元観測の照合、Task入力と助言を分離し、Source83 File・公開API・利用側のC前対応表を確定。残す三Fileの循環と二Stateの保証単位を明確化。局所221件・Windows正常Owner結合1件成功、Source／文書の独立レビュー残指摘0。失敗合成試験Rootは清掃済み。Orchestrator回帰129件成功。Coordinator全回帰は1,714成功・追従漏れ1失敗・5 skipで完走し、責務分類二行の是正後に該当4件成功。C前を限定完了として直前で停止。C本体・D・実境界・全体QAは未実施で、②の再試行・保持物操作なし | [C前の処置と検証結果](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#22-c直前までの残存整理) |
| Docker Isolationの構造・追加通信先 | 配置・設定・同意・Workbench・Proxy接続と旧定義整理、限定実通信・回帰・独立レビューを確認。DNS上限不足を是正した固定Imageでnpm／pip取得、未許可・直接通信拒否、取得後待機取消・今回資源回収が成功。広回帰の追従漏れ1件は是正後再確認済み。製品全体E2E・Releaseとは区別し、既存②と先行2Rootのunknownは別に保持する | [対応表・集約結果・保持参照](99_Roadmap/Changes/CHG-000082/docker-isolation-source-structure.md) |
| Platform Accessの構造・Native接続再編 | ①〜⑤の移管・配置・公開API整理は完了。Host記録・Desktop補助子の技術処理をPAへ移し、上位の許可・回復判断は維持。PA88件・DI293件・Rust55件等の通常回帰、静的検査、台帳378件valid、限定独立レビュー残指摘0。明示Docker試験・配布更新・外部AI E2Eは対象外。全体文書検査の既存不合格は未解消 | [対応表・結果と残る検証境界](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#11-①⑤の最終照合) |
| WorkbenchのFramework・構造移行 | Express／Router／Query、画面分割・共有契約・全Client TSXの通常検査を接続。対象1〜5は最終通常78件・全Browser15件・表示検証・静的確認と限定独立再レビュー指摘0で完了。先行Browser失敗はreload応答境界まで特定して試験観測を是正したが、CDP内部原因の完全特定とは扱わない。実AI・実Hostの人間確認・全体QA・Releaseは別途 | [現在の結果と限界](99_Roadmap/Changes/CHG-000082/workbench-framework-structure.md#14-query画面分割共有配置と通常検査) |
| MCP ServerのSDK・構造移行 | stdio／HTTPを公式SDKへ接続し、全Toolを責務別配置へ移管。旧Router・Protocol重複公開を撤去。本番入口と現在認証は同じ要求別Factoryへ接続。是正後全100試験・公式Client両Transport往復・独立再レビュー指摘0。modern規格に限定し、実Provider・全体QA・Releaseは別途 | [対象四項目の結果と限界](99_Roadmap/Changes/CHG-000082/mcp-server-sdk-structure.md) |
| 検査・検証Packageの再編 | 工程・共通文書意味をDomainへ移し、旧Profile・中継を撤去。CheckerをCLI／Repository観測／診断表示へ整理した。公開三操作・三型と診断・観測順を維持。Domain249成功、Checker440成功／既存横断命名1失敗／手動1未実施。型・静的・台帳370 valid、独立再レビュー残指摘0。今回の再編と全体QA不合格（横断命名1,411、文書3,426診断）は区別する。②AI再試行・保持物削除・Docker操作は行っていない | [六項目の結果と限界](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#checker-refactor-closure) |
| AI AdapterのSource整備 | 命名・公開APIに加え、両ProviderのDocker配置・固定実行物情報をDIへ分離。利用側回帰・限定独立レビュー残指摘0。実AI・実Docker・正式全E2Eと他Packageの整備は別に残る | [配置との境界](06_Architecture/Details/ai-adapter/01_Architecture.md#docker配置とprovider操作の分離--2026-10-19)、[区切りと検証範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review) |
| Workspace／Orchestrator | ③の本番Workspace接続・旧Bundle／Store本体と専用Nativeの撤去、検証Toolの取消・終了確認移管を完了。変更範囲の実Git・結合回帰と限定独立レビューは完了した。新構成全体の回帰・実境界・移行の最終評価、②の実AI編集E2Eは残る | [撤去の区切りと現在残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-store-retirement) |
| Access Management／公開入口 | 責務別配置・公開API整理に加え、ユーザー有効状態の独立APIを接続。現在は鍵の有無から導出し、確認不能を無効と区別する。回帰・限定独立レビュー完了。保存Schema・権限分担は維持。MCPのロール更新Tool名は変更済み。初回設定・鍵操作の実入口と人間確認は後続E2Eへ保持する | [現在の構造・公開API](06_Architecture/Details/access-management/01_Architecture.md#source構造の再編--2026-10-19)、[区切りと検証範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review) |
| Docker Isolationの基準能力 | 旧Docker責務分離単位の実装・検証結果を保持する。技術的な実行・観測・取消・回収を分離し、状態保存・操作前後のOwner確認・結果受領は上位に保持。今回の再配置・追加Allowlist・未知残存の回収成功へ旧結果を流用しない。実境界の成立と限界は隔離設計の対象条件を参照 | [現在の計画・検証結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md) |
| 通常実行の署名依存 | Coordinator専用の署名入口・Manifest設定・固定AST graphと、Domainの旧署名専用profileを撤去。通常保存の失敗反証と旧入力拒否を確認し、限定独立レビューの残指摘0。汎用成果物署名・必要Artifact同一性・現在認可・隔離は維持する | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)、[保存設計](06_Architecture/Details/execution-model/03_Repository_Storage.md) |
| 検証 | 確定誤検知236件を検査側で是正し、生診断は1,836→1,600（追加0）。局所・QA Header全数3/3、関係16/16・静的確認成功。Checker全386件は385成功／既知1失敗（残1,600診断）で完走。Browser元原因未確定・正式QA未評価は維持する | [236件の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)、[分類・Browser調査](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-browser-triage) |

試験件数は実行範囲の結果であり、QA検証項目のPass数・実Docker／Providerの成功・Release可能を意味しない。

## 2. 何が危ない、または止まっているか

全体完成を阻むのは未処置の差分と未観測境界である。局所成功から全体の成立を推定しない。

| 残件 | 影響・処置 | Owner Relation |
|---|---|---|
| 回帰 | 3 Suite分類・Test Header・現行文書の限定是正、型・静的・関連回帰と独立確認は完了。Checkerの既存Source命名・責務Header未達、Browser元失敗・原因未確定、未実施Host境界・正式198項目評価・合成7領域清掃は分離して保持する | [現在の確認と残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 文書・工程の全体検査 | 最新Repository Checkerは現行0・歴史CHG旧参照3,353診断で全体Exit 1。現行43診断を是正したが、正式QA・実境界・全体完成の代替ではない。歴史Evidenceの一括改名やPass化は行わない | [検査の範囲と限界](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 整理後の実境界接続 | 上位接続の限定整理は確認済み。自動破棄保存前の中断から明示保持し、同じstateで新Taskへ接続する限定Caseと同File全16件が成功。新しい共有State・Registry・Lock・Recovery Frameworkは追加しない | [隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md)、[保存設計](06_Architecture/Details/execution-model/03_Repository_Storage.md) |
| 実境界 | 実Docker五資源・未起動認証構成・fresh回収・認証create不明の限定終了・公式Imageの版／三Hash／隔離を確認。009はWSL保守後に同ID正式終了。030は実Ctrl+Cとreviewer準備中の親喪失を元IDの回収・待ち0まで確認。Windows自動削除・汎用WSL fallback・executor実行中の親喪失・実Provider全E2Eは主張しない | [検証計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[実行手順](19_Workflows/01_Coordinator_Runtime.md) |
| 限定終了の実試験 | 診断付き新品一回が成功。Docker再起動1回、認証create結果不明の限定Classで不存在2回・終了保存・正式回収・履歴・操作除去・専用Root不存在を確認。以前の起動未確認Failと原因未確定は保持し、汎用unknown終了やDI全体完成へ換算しない | [実測と清掃記録](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 全体評価・収束 | DIの基準範囲完成照合は保持。補助Unit追加後の現在199項目の正式再評価・全体Checker不合格・後続E2Eは残る。未実施・不明・部分成立をPassへ畳まない | [Quality Center](07_Quality/01_Quality_Center.md)、[Reality Audit](07_Quality/05_Current_Implementation_Reality_Audit.md) |

## 3. 今、人間が決めることは何か

Checker整理では、利用者が未使用の汎用Outcome Adapter・専用結果型・旧ITの撤去と、QAの本番接続への具体化を承認した。Domain四状態の直接検査と、本番の診断・拒否・公開終了値を区別して確認する。現在追加の人間判断は必要ない。旧ITの結果を新しい本番保証へ流用しない。[採用と確認範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#検査検証packageの縮小--2026-10-19の途中見直し)を参照する。

今回の退避物はWSL限定保守と同ID正式終了まで確認済み。公開Taskの実Ctrl+C、reviewer準備中のCLI親喪失とも、元IDで資源回収・履歴・正式Readerの待ち0まで確認した。親喪失をexecutor実行中の成立へ拡張しない。再認証の技術構築・旧Docker環境profile・試験結合漏れを是正し、DIの完成条件へ現在の回帰・実測・独立レビューを照合した。一般Recovery拡張・追加再起動・記録手編集はしない。承認済みのClaude単独一回は終了・回収まで成功し、その実境界確認について追加の人間判断は必要ない。

| 対象 | 現在の判断・許可境界 |
|---|---|
| Docker隔離と簡素化 | 使い捨てと最小管理へ簡素化する方針は承認済み |
| 実境界の評価 | 009と030の今回の観測を正式義務へ限定接続する。未観測の全異常枝や全Provider経路のPassへ拡張しない。追加の故意破損・Provider依頼・再起動は予定しない |
| 実Docker再起動・外部AIへの新しい依頼 | 今回は発行していない。固定版の回帰失敗を先に処置し、②の送信範囲・回数・停止条件は別途確認する。保持中unknownの成功化・強制清掃・自動再送は行わない。[現在の結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression) |
| 初回設定・鍵操作の実入口と人間UAT | 後続E2Eで確認する |
| 最終統合・版・期限・リリース | 今回の局所結果から決定しない |

判断の正本は[CHG](99_Roadmap/Changes/CHG-000082/change.md)と[第二段階計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)。実行許可・採用・Release判断を区別する。

## 4. なぜこの状態・判断になったか

既存能力を新しい責務へ移し、過剰な署名・配布コピー・回復管理を減らしている。Docker隔離そのものは維持する。

| 方針 | 理由 | Owner Relation |
|---|---|---|
| 技術処理はDocker Isolationへ、Task保存・通知・受領は上位へ | 下位がCoordinator／Orchestratorを知る逆依存を避け、利用側の保存方式をDocker cleanup条件にしない | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md)、[Coordinator Task詳細設計](06_Architecture/Details/coordinator/04_Task_Detailed_Design.md) |
| 旧署名資格を別の資格へ置き換えない | Commit／Hashは追跡・同一性確認であり、実行許可やPublisher真正性ではない。現在の認可と隔離を各Ownerで確認する | [通常実行と配布の分離](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離) |
| Project Contextは現在投影だけにする | 詳細の第二正本や進捗書庫を作らず、人間・AI・MCP・Workbenchが同じ現在像を短時間で読めるようにする | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

過去の経過・判断・検証条件は既存CHGとGit履歴から追跡する。現在文書へ経過を追記し続けたり、新しい履歴書庫へ複製したりしない。

## 5. 次に何をすべきか

全17Packageの構造整理では、AI Adapterの助言・試験専用API整理とInit判定のDI移管を`b2e568ba`までコミット・プッシュ済み。利用者の添付方針に合わせてProvider共通契約中心のAfter候補を計画へ記録し、観測と環境変数の検査を`provider/validation.ts`へ同居した。関連86件・静的確認・独立レビューを完了し、判定条件と通常保存は維持する。[順序・After候補・現在結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review)を参照する。全体のFolder／File整理と名称・Header・公開集合の最終確認は残り、Package完成ではない。以下の回帰・実境界残件も保持し、②のAI再試行と保持物削除は行わない。

| 順序 | 次の作業候補 | 完了条件・停止点 |
|---|---|---|
| 1 | 固定版で再現した不整合の局所是正 | 新検証Toolの境界・Consumer、旧前提の試験・台帳・現行説明を接続し、未確定のWindows／Browser事象を区別する。②再試行・保持物削除なし |
| 2 | 是正後の候補を固定し再検証 | 同じ安全条件・検証義務を維持し、③の局所成立と全体評価を区別する |
| 3 | ②の限定実AI編集E2Eを再計画 | 送信内容・回数・停止条件を提示し、別途人間承認を得てから実行する |
| 4 | 実境界・移行結果を③とv0.22の最終評価へ接続 | 保持中unknownを成功へ書き換えず、採用・Release判断を別にする |

詳細な対象・順序・反証・担当は[第二段階計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)と[Workspace棚卸し](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md)に従う。v0.22全体の後続候補は[Roadmap](99_Roadmap/01_Roadmap.md)で確認する。

## Checklist

- [x] Project ID、Repository IDおよびRepository Roleを評価した。
- [x] 三つのIdentityがRepository Manifestと一致している。
- [x] 五場面を省略せず、結論を先に示した。
- [x] 現在事実と共有分析を区別した。
- [x] 正本が存在する内容をOwner Relationへ接続した。
- [x] Project Context固有の安定IDを追加していない。
- [x] 項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。
- [x] 確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。
- [x] Owner Artifactとの競合時はProject Contextを現在値として使わない。
- [x] 保存済みの次候補と対話時の追加提案を区別できる。
- [x] Gateを閉じる前に再投影要否を評価する。
