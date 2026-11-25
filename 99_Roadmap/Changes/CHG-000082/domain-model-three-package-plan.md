# Domain Modelの3パッケージ分離案

状態: 実装・利用側追従・限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
基準改訂版: `a7618c6d0fdade66fab1f81f24de714e21822f08`
対象: `40_Develop/domain-model`と本番・試験・Script・配布ひな型の利用側
更新日: 2026-11-12

<a id="document-layering"></a>
## 文書モデルの層構造整理 — 2026-11-15

### モデル中心への再整理（UI／SPEC工程モデルの先行実装）

#### 現行案内・UIの追従とArchitecture／Qualityの残存整理 — 2026-11-17

##### 現行設計と品質引渡しの是正 — 2026-11-17

人間は上記残件の継続を指示した。変更分類は現行Ownerへの設計・品質追従と、退役資料の適用母集団の是正である。親担当はArchitecture・Quality・保守・実装規約と現行Source／試験を照合し、複数正本をまたぐため読取り専用の専門確認を受けた。発火はMapの一意な非現行登録、非発火は本文の退役表示だけ、境界は重複・現行との衝突・未知区分・Map不成立、情報欠測は除外せず診断する条件として具体化した。既存規則に根拠のないskipを加える案、旧Domain単位を3重複製する案、退役資料へ架空の詳細設計を足す案は採用しない。

| 対象 | 是正と保持条件 |
|---|---|
| 詳細MapとDM | 既存Map内に非現行資料の所在・現在Owner・区分・理由を分離。既存MapモデルにretiredAreasを保持し、新しい公開操作・型・Registryを追加しない。不正・重複・現行衝突・Map不成立時は除外集合を空にする |
| Checkerの3 Consumer | Architecture、Quality、UI／SPEC後続比較が同じMap分類を使う。実Directoryと現行＋非現行の登録集合の一致、01文書の存在、通常リンク検査は維持。未知資料を除外しない。独立した読取り位置をキャッシュ統合しない |
| 現行3モデル | 既存の意味設計に基本ARCH、10適用判断、8Concern、7実装観点と3責務ずつの品質導出を接続。ConcernのPASSは設計処置のみ。Source・保存形式・Root集合・実行条件・既存試験の合格を新設しない |
| 担当Relation | 旧PAの共有状態記録はCoordinator、旧crosの活動・過去文書情報はDMへ接続。公式素材はWorkbenchの表示・導線だけをPartialで保持し、権利・用途・判断者の記録と独立Trust評価は未接続のまま。退役Coveredを現在Ownerへ流用しない |
| Qualityの現行集合 | 旧Domain7単位と退役設計の単位は通常の引渡し表から分離し、目標・Local ID・現在OwnerとOPENの処置を保持。3モデルの局所責務・結果・保存を既存正式IDへ接続し、配布／利用側閉包の上位義務を免除しない |
| Source条件3組 | ARCH-000005／QA-000003、ARCH-000010／QA-000001・000006の内容を現行の公開判断操作、EM State Writer、AD同梱Catalog、CM希望設定保存とCoordinator選定へ揃える。上流ARCH-000010の旧外部Catalog説明も追従 |
| 利用可否評価 | Coordinatorのprovider-availabilityとERB-UT-023へ正しく接続。旧AI Adapterへの誤配置とAIT-UT-005との誤対応を撤去し、独立Trust各軸の義務自体は保持 |
| QAの退役機構 | Host終端専用記録・私有Native Reader・Native所在／entry frame・旧署名修復の本文を現行検証要求から撤去。通常回復のEffect前記録・元対象相関・取消／終了／回収の区別を現在Node・公式CLI・wxのOracleへ接続。旧専用3 IDは履歴IDとして退役を明示し、新方式へPassを転記しない |
| 過去参照 | PA本文削除で切れた既存記録の4出現は、編集可能な過去説明と確認して旧参照注記だけを付与。リンク先・表示・当時の主張は維持し、固定byte記録・過去Runtime保持物は操作しない |

既存のRCM-UT-002／AUH-IT-003へ、現行のみ・非現行のみ・重複・衝突・未知区分・Header欠測・Map欠測・非現行文書欠測・未登録Directoryを追加した。不変fixtureは共有し、各差分の現在入力と期待診断を直接比較する。既存の診断Code・文言・Severity・CLI・Root公開数を変更しない。ひな型とArchitectureの適用説明も同じ区分へ接続する。

限定単体・診断変換55件と、既存Architecture結合1件が成功した。関連3設定の型検査も成功した。現在RepositoryへのArchitecture・Quality・SPECの専門観測では診断0だが、これを完全文書検査・全体回帰の成功としない。固定候補の技術・文書・準拠影響・直接伝播の独立確認を実施し、未確認の実境界・全体回帰・統合・Release判断は対象外とする。全体回帰・実AI・Docker・過去保持物の操作は実施しない。

初回固定候補の完全文書Checkerは1207 Markdownでerror0／warning0だったが、独立レビューは意味上の残指摘を検出した。Mapの§2／§3重複による退役除外の穴、3モデルの汎用的なARCH担当説明と正式検証IDの誤対応、QAの正式STに残るNative停止保証・9処置・Required分類と現在本文の矛盾を統合した。全確認者へ一括是正案を再提示して整合を確認した後、Map重複節は除外失効、ARCH行は固有責務、CM公開はRCM-UT-014・設定受付は既存Checker／DM義務を保持したRCM-UT-002へ追従した。CMの3試験はtraceとimport順だけを是正し、検証本文を削減していない。Symbolも同じ正式IDへ追従した。DM保存は活動CRUD・Semantic出版・Context Reader、EM保存は配置・I/O・再入場を区別して実際の既存項目へ接続した。

退役3 UTを現在の正式表に残したままRequiredから外す案は、既存の全件分類条件に矛盾するため採用しない。QA-000006内の独立した退役節へ元の3行を移し、Analysis／Definitionの現在Source対応、Required、統合の現行集合から3 IDだけを除いた。元ID・当時の定義と過去結果は保持し、新ID・代替実装・判定緩和はない。現行集合は207から204、履歴3件とは分ける。STは公式CLIの停止正常完了・status・既存Backend観測と操作終了を区別し、全Process不存在を要求しない。8処置の現在契約と旧9処置Schemaの拒否を維持し、Node・wx・DIへ移管済みの条件に残ったNative名称も追従した。

是正後の関連単体・診断変換・CM受付は61件、Root集合1件、既存Catalog／Symbol／正式Local Item関係1件が成功した。型検査4設定・変更TSの警告禁止確認と差分空白確認も実施した。正式IDの意味をSourceヘッダーだけから推定したことを共通原因として、引渡し先の正式定義・実試験・現在Ownerを同じ導出キーで再照合した。新しい検査Frameworkを追加せず、既存のMap・正式表・契約試験へ反証を残した。完全文書検査の構造成功だけを意味上の独立確認へ代替しない。

Architecture公開結合も、重複節の追加反証を含め再成功した。今回の最終限定確認は計64件成功、型検査4設定と警告禁止・作業本文の空白確認が成功した。独立再確認の途中で残ったCM公開IDの説明一句と、ST詳細反証の旧停止保証・旧Schema投影要求も正式な現在契約へ揃えた。技術・文書・限定準拠影響・直接伝播、3モデルの責務・品質引渡し、Qualityの独立再確認は今回範囲でPass、必須残指摘なし。これを全体回帰・実AI・実Docker・統合・Release判断へ読み替えない。

最終本文を固定した完全文書Checkerは1207 Markdown、15830 Local Link、2956 Anchorを確認し、error0／warning0、終了code0で完了した。明示した過去参照の存在・Anchorを未検査とする既存表示は保持しており、過去の実在証明ではない。今回専用試験Rootだけを作成時の所在・dev／ino・非Linkと照合して回収し、不存在を確認した。過去保持物は操作していない。独立Trust評価・公式素材記録の未接続、実環境の未評価と全体回帰保留は解消済み扱いにせず、統合・Release判断へ進めていない。

コミット前の再確認では、先行変更とCMの試験trace／Symbol追従を含む118 tracked差分を同じ承認範囲と照合し、新しい必須是正指摘はなかった。旧参照・Change受付も含む限定単体72件、公開Checker結合2件、Root集合1件、Catalog／Symbol／正式Local Item関係1件の計76件が成功した。型検査4設定、変更TS27 Fileの警告禁止確認、作業本文の空白確認、1207 Markdownの完全文書Checkerもerror0／warning0で再成功した。この再確認で作成した専用Rootだけを実体Identityと照合して回収し、不存在を確認した。全体回帰・実AI・Docker・過去保持物の操作は行っていない。コミット・プッシュはFeature上の保存であり、main統合・採用・Release判断ではない。

追記: 人間の追加指示により、PAの退役設計本文は削除した。現在Owner・保証変更・既存変更記録への短い退役案内だけを保持し、他の通常文書から旧節を指す参照は同じ退役案内へ更新した。過去CHG／Evidenceの参照先と本文は変更していない。以下の「PA本文の削除は未実装」という当初整理に対し、この本文削除だけを実施済へ更新する。検査母集団・詳細Map・品質引渡しの整理は未実装のままであり、後掲の16件は本文削除前の検査結果である。

人間は現行案内・Project ContextとUIの旧実装説明を最新化し、退役PAの過去設計が通常文書に必要かを他の文書と比較、Architecture／Qualityの残件を整理するよう依頼した。親担当は現在のCLI受付・能力一覧・Task／Project入力・認証・結果と取消解除、Workspace操作、文書と検査の正本を照合し、読取り専用の専門確認を受けた。変更分類は既存契約への文書追従と一意な登録・配置漏れの是正であり、製品の権限・実行・回収条件は変更しない。

| 今回是正した範囲 | 処置と保持条件 |
|---|---|
| 現行案内9リンク | Project ContextのPA未撤去段落を現在のNode／DI／Lock Ownerへ更新。CHG-000057のUI／SPEC／設計／品質・旧署名手順の現在案内、CHG-000017の退役したNative集計、CHG-000076の現在3モデル案内を追従。過去の判断・測定結果は遡及更新しない |
| UIの旧実装説明5リンクと周辺記述 | Task／Projectの機械向けJSON＋明示主体、認証Loginだけの対話、診断・回復、Workspace候補、取消要求／終端／回収／Listener解除を分けて説明。廃止した端末Helper・同意コード・署名入口・表示関数を現在の機能として案内しない |
| UI要求と未評価 | アクセシビリティ義務を保持し、参照先の節番号だけ追従。Workbenchの§9本文を完全保持。旧状態表示anchorは同目的の現在説明へ保持。今回の実端末・実認証・Provider／Docker再測定や全環境対応を主張しない |
| Coordinator詳細設計のChecklist配置 | 後ろに追記された所在初期化のOwner小節をChecklist前へ移動。チェック項目・状態・本文・順序は保持し、末尾空行だけ整形 |
| Quality統合の検証項目集合 | 正式定義に存在するQA-000006のHST-UT-001／ERB-UT-024、QA-000007のRFD-UT-030を§4の既存Local Item欄へ追記。他列・既存ID・Release処置・未確認を変えず、試験合格を追加しない |

現行案内／UIとChecklistの是正後、Checkerはerror33から18、warning0となり、追加診断はない。Architecture／Project Contextの局所17試験、CLIの純粋受付・help・能力表示・不正認証受付の限定6試験は成功した。実Login・Task実行・Docker操作は呼ばない。今回のCLI試験Rootは既存Repository-local helperで回収した。全体回帰や人間の利用品質評価へ読み替えない。

Qualityの登録追従後はerror16／warning0となった。開始時との診断多重集合比較は新規0・解消17で、残件は退役PAの旧リンク5、Architecture6、Quality5である。Quality解析の限定19試験も成功し、今回の限定試験は計42件成功した。独立確認は棚卸しアンカーの目的外着地1件を検出したため、同じIDを既存の全件棚卸し節直前へ移し、一意性と着地を再確認した。その他の今回差分に必須是正指摘はない。原文・比較結果を置いた今回専用試験Rootだけを作成時の所在・dev／inoと照合して回収し、不存在を確認した。過去保持物は操作していない。

##### 退役文書の比較と次の是正案（未実装）

通常の文書は現在の契約を主とし、当時の設計・結果はGitと既存CHG／Evidenceで追跡する方針に整理する。PAだけでなくcros（Historical Comparison）、artifact-signing／official-asset-governance（Superseded）、runtime-trust（廃止方式の比較設計）にも旧設計本文が残っている。一方、旧domain-modelの各Fileは現在Ownerへの短い誘導案内であり、現行詳細設計の提供ではない。

PAの旧設計全文は、現在の仕様として残す必要はない。既存の退役案内を「廃止対象・現在Owner・保持／撤去した保証・未評価と記録への参照」に縮小し、当時の本文をGit／既存記録から辿る案が適切である。ただし、物理Directoryを現行設計と無条件に数えるarchitecture.tsとquality.ts、Canonicalと書かれた詳細Map、旧検証単位を持つQuality統合の一体整理が先に必要。HeaderにRetiredを付けるだけの一律skipや、退役資料へ架空の詳細表・UTを足す処置はしない。PA本文の削除・履歴移設・検査母集団の変更は今回実装せず、後続の設計判断へ残す。

##### Architecture／Qualityの原因・Owner・最小是正案

| 系統 | 確認した内容 | 次のOwnerと処置 |
|---|---|---|
| 現行3モデルの詳細契約 | CM／DM／EMはArchitecture詳細設計と宣言するが、領域・基本設計Relation・適用／Concern判断・Quality引渡しの所定情報が不足 | 各モデルの設計Ownerが現行の責務から具体化する。形式的N/A・未実施Passで埋めない |
| 退役Domainの現行扱い | 退役案内を物理Directoryだけで現行詳細領域へ含め、Map集合・閉包と完全契約を要求している | Architecture／Checker Ownerが「現行詳細」と「退役案内・比較資料」を既存Mapと文書種別で整合させる。未知領域の欠落検出は維持する |
| Quality詳細領域被覆 | configuration-model／document-model／execution-modelの3領域が統合側で不足 | 新3モデルの正式な引渡しを具体化した後、既存統合表へ接続する |
| Quality検証単位 | 統合だけに旧crdd-domain-libraryのdependency-direction／public-surface／source-layout／consumer-closure／result-boundary／repository-boundary／distribution-identityが残る | 旧7単位を現在Ownerと保持義務へ対応付ける。単純削除・機械的な3重複製はしない |
| PA検証段階 | platform-access.docker-repairは本文で退役・N/Aだが、統合では現行Covered単位のまま | 現在のDI／Coordinatorが保持する保証・撤去済みNative保証・未確認の実境界を分離し、現行対象を追従する。PAへ架空UTは追加しない |
| 詳細→Goal | 統合だけにai-adapterとQA-000010の対応。AIT-UT-005はTrust各軸の純粋判定、詳細側もCoordinatorのProvider五軸評価と説明 | 実体のevaluateProviderAvailabilityはCoordinator execution/observation.tsにある。AI Adapterへの業務判断の復活や、Goalを増やすだけの修正はせず、評価対象と現在Ownerを照合して詳細／統合を追従する |
| Goal→Local／Local集合 | 正式定義にある3 IDが統合§4だけ未追従 | 今回、既存2行のLocal Item欄に限定して是正 |
| Source条件 | ARCH-000005とQA-000003、ARCH-000010とQA-000001／QA-000006の3組で本文不一致。キー欠落・余剰は0 | 前者は旧Acceptance Decision Port／Orchestratorと公開判断操作／Coordinator／State Writerの差、後者は外部構成からの選択と同梱Catalog／Repository別選択保存の差。上流の現契約を確認してAnalysisとDefinitionへ同じ意味を搬送する。比較を緩めない |

残る設計・検査母集団の変更は、この整理だけを実装・完成扱いにしない。担当責任者はQual-LabのArchitecture／Qualityと各モデル・CheckerのOwner、再開契機は現行詳細と退役資料の区分・引渡し範囲の確定である。現在の未達として保持し、Release可または全体品質成立へ進めない。新しい共通Package・Manager・移行台帳や、実AI・Docker・過去保持物の操作は追加しない。

#### 公開履歴のある過去参照への注記適用 — 2026-11-17

人間は公開後も旧リンクが生じることを指摘し、公開時のタグ・署名・固定byteと、現在ブランチで保守する文書を分ける方針を承認した。直前の公開済み一律除外案は採用せず、03・12・19・51をこの区別へ是正した。既存のexact tagへ参照先を置換する案内補正とは別に、旧リンク先・表示名・当時の主張を変えない直前注記だけを許可する。公開タグ、署名、byte固定Evidenceと移行Manifestは変更しない。タグへの収録だけから本文の永久byte固定や注記可否を推定しない。

着手前に全1207Markdownの完全なChecker結果を取得した。リンク診断3913件のうちChanges内は3902件で、初回は公開タグ収録3835件を除外候補としたが、人間の追加判断で再分類した。CHG-000070§6は、過去CHGの構造・案内更新とbyteがIdentityの固定Evidenceを明確に分けている。移行表のfixed_historyは当時の移動・Hashの記録であり、それだけを現在ブランチのchange.mdの永久byte固定宣言として扱わない。署名・固定Evidence、現行正本案内・必須導線は引き続き対象外とした。

| 対象 | 処置と保持条件 |
|---|---|
| 過去の影響ファイル一覧・移動結果 | 3827出現。旧Path、矢印、表示名、当時の帰属を保持し、対象Markdownリンクの直前だけに注記 |
| 過去の実装・試験・設計候補・段階結果の記述 | 67出現。日付・基準版と節本文を照合し、現在の案内ではない出現だけに注記 |
| 合計 | 49文書・3894出現。今回の挿入だけを逆変換すると、全49文書が付与前のbyteと完全一致することを確認 |
| Changes内の現在の案内 | 8出現を保留。CHG-000057冒頭の正本案内4・Release手順1、CHG-000017の現行カバレッジ案内2、CHG-000076の正本案内1。注記で欠落を隠さない |
| Changes外の残存リンク | 11件は不変更。UI現行説明5、退役PA設計の参照5、Project Contextの旧見出し1。現在説明と履歴の整理を各Ownerへ残す |

実資料の適用で表示名内code表記の注記が発火しないことを検出した。取得済みリンクの構文分類だけを最小是正し、コメント・Fenceの全token確認は維持、Inline codeのmaskは注記とリンク開始位置に限定した。表示名内のcodeは許容し、注記全体がcode／コメント内、間にコメントがある例と同target混在の反証を追加した。影響一覧と既に終了した移動結果のリンク直前にもexact注記を受け付けるよう、12と既存Change文法を追従した。通常項目・code削除表記・現在必要な後継導線を一般的に免除せず、codeへの注記・二重注記・余剰・階層の拒否は維持する。

付与後のCheckerはerror33／warning0で終了code1。付与前3927件から3894件減少し、診断の多重集合比較で新規診断0、除外された出現が全て既存のリンク／アンカー診断であることを確認した。これは現在の到達性検査を過去参照から分離した結果であり、当時の存在確認・リンク復旧・検証Passの追加ではない。残る33件はリンク／アンカー19（broken-link14、broken-anchor5）とArchitecture／Quality整合14であり、正式入口全体の成功は主張しない。公開タグの全参照Identityは付与前後で一致する。

変更分類は参照規則の限定例外の是正と既存記録への適用。対象は規則・既存Parser／文法・利用側・試験・品質定義と注記だけで、新しいFile・例外台帳・互換処理は追加しない。技術・文書・準拠影響・不足／直接伝播の独立確認を行う。全体回帰、実AI・Docker、過去Runtime保持物の操作、統合・Release判断は対象外とする。

限定単体11件・公開Checker結合5件・台帳関係1件、型検査3設定・Biome・diff確認が成功した。固定候補の技術・文書・準拠影響・直接伝播の独立再確認は今回範囲でPass、必須残指摘なし。独立確認でも全49文書の計画・実体byte、文脈、現在案内8出現の保留、公開タグ不変、完全reportの多重集合差を照合した。全report・原文・計画を保持した今回専用Rootだけを作成時の実体Identityと照合して回収し、不存在を確認した。正式入口全体・全体回帰の成功ではない。

#### 編集可能な過去記録の旧参照注記 — 2026-11-17

人間は`[旧参照]`をInlineリンクの直前に付ける明示方式を採用し、CRDD規則との整合確認後の是正を依頼した。変更分類は文書参照規則の限定例外と、そのParser／Checkerへの接続である。親担当は文書化§4.7、変更§5.1、保守§3.4、文書監査、Checkerの固定履歴Reader・Scope・参照Map、Artifactの全利用側を照合し、読取り専用の専門確認を受けた。旧参照の意味は現在の到達性を要求しない過去記述であり、当時の実在・検証・現在の有効性を証明しない。

| 編集対象 | 対応する意図・保持条件 |
|---|---|
| 03_Documentation§4.7 | 編集可能な過去本文の注記と、現行必須導線・Related・公開済み／固定byte記録の禁止を区別する |
| 12_Change§5.1、19_Maintenance§3.4、51_Document_Audit§4.2 | 旧literalと当時の主張を保持し、固定履歴の既存Identity照合は免除しない。注記の用途と現在案内をレビューする |
| DM ArtifactとUX利用側 | linkTargetsの文字列配列をlinksの出現モデルへ統一し、target・historical・Relatedを保持。履歴配置・Related・外部URLを文書規則として判定し、不適用は局所Issueと通常関係を残す。適用出現だけ現在のArtifact関係から除く。並列互換fieldと新Root公開は追加しない |
| Checker Repository | DMの出現判定を固定履歴契約と照合。不適用は専用errorと通常検査。適用時は存在／anchorだけ未検査とし、Root・Encoding・Link境界を維持する |
| Checker Scope／参照Map／計数 | 旧参照を現在のScope拡張・参照Mapへ使わず、存在・anchorの検査済み件数へ加算しない。既存uncheckedへ未検査を明示する |
| 既存試験・品質定義・Symbol | RCM-UT-001／AUH-IT-003で、同じtargetの通常参照、定義との二重解決、非発火表記、誤用、境界、Scope、Map、計数、固定履歴Hash拒否を反証する |

発火例はEvidence本文の注記付きInlineリンク。非発火例は通常リンク、注記とリンクの間の空白、escape、コード／コメント、参照形式。境界例は同じtargetの注記あり／なし混在とRelated内の注記であり、前者は出現を分離、後者はerrorと通常検査を行う。配置だけでは過去記述と証明できないため、文書監査が現行必須導線の隠蔽を確認する。情報不足の記録や公開済み／固定byte対象へ自動注記しない。

これは既存Checkerの責務整理と同じ変更意図の途中追加であり、規範と直接利用側のGateを再開する。必須確認集合は技術独立レビュー、文書監査、準拠影響確認、不足／直接伝播監査とする。基準版の有効化、統合・リリース判断、Repository全体のPackage回帰、実AI・Docker・過去保持物の操作は対象外とする。既存3902件への一括注記や、新しい例外台帳・Git履歴探索は追加しない。

限定確認はArtifact・文書・Schema・Graph関連27件、UX利用側とRoot公開集合14件、Checker公開入口のリンク・固定履歴5件が成功した。既存型検査3設定、変更TypeScriptのBiome確認、diff検査、新規規則の参照・見出しと例のFence除外も確認した。結合試験の最初の実行はWindows一時Pathの大小文字表記差によりGit初期化のassertionで停止した。判定を変えず、既存Repository-local試験RootをTEMPとして再実行し、成功後は各今回Rootを回収した。これらを正式入口全体や全Package回帰の成功へ読み替えない。

途中の影響確認で、Artifactの現在関係生成が別の本文走査から旧参照を復活させ得ることを検出した。読取り専用確認を受け、文書規則の適用判定をDMへ一元化した。構文捕捉の位置と、既存の可視行が持つ表示列から元列への区間対応をUTF-16単位で照合し、適用する同じ出現だけを現在の関係から除く。同じtargetの通常参照、現行Path／Relatedの誤用は関係を保持し、誤用は単独Parseでもpartialと局所Issueを返す。新Manager・Facade・公開Helperを追加しない。

初回固定候補の技術・文書・準拠影響・直接伝播確認では、F1（山括弧／Encoding付き外部URLの不適用分類）、F2（通常関係のFence／コメント条件の差）、F3（Checker設計の旧field案内）を検出し、候補を不合格として再開した。全指摘を統合して修正方針の整合確認を受けた後、F1は既存の参照分解へ接続、F2は元の可視本文生成と通常関係ループを維持して内部の元列対応だけを追加、F3は現行案内を更新した。4空白Fence、コメントで分割されたID、コメントで合成された見かけの注記、行内コメントとUnicode、CRLF、外部URLの山括弧・Title・一回Decodeを反証へ追加した。再修正後も限定46件、型検査3設定、Biome確認が成功し、既存Test Catalog／Symbol／Quality関係の限定1件も成功した。一般原因は、新しい注記の位置対応を作る際に通常本文の可視条件まで置換した点であり、同じ既存単体試験へ差分の反証を保持した。新しいChecker規則エンジンや共通Frameworkは不要と判断した。

再固定候補の技術独立レビュー・文書監査・準拠影響確認・不足／直接伝播監査は今回範囲で全てPass、必須残指摘なし。これは限定差分の確認であり、Repository全体の準拠表明・文書検査・回帰、統合またはリリース可否の承認ではない。既存の旧リンクへの付与は未実施であり、編集可能性・過去記述・現在導線との区別を確認してから対象出現を選ぶ。新しい注記の実装だけを理由に残存リンク違反の解消件数を加算しない。

#### Checker失敗全件の分類と限定是正 — 2026-11-17

人間の継続指示に従い、欠落していた試験本体の全結果と文書検査の全結果を別々に取得した。変更分類は試験の固定期待集合と現行品質記録の追従であり、製品Source・公開契約・診断・検査条件を変更しない。過去記録や設計の意味を変える対象は今回の機械的是正から分離する。技術・文書の独立レビューと変更対象の限定試験を実施し、Repository全体のPackage回帰・実AI・Docker・過去保持物の操作は行わない。

| 確認対象 | 完全取得した結果 | 処置 |
|---|---|---|
| Checker試験本体 | 473件、成功458・失敗14・skip1、取消0。約611秒 | 下記の3件と11件に全件分類。正式入口の成功とは扱わない |
| VC Consumer固定集合 | 2件失敗 | 実利用を確認し、publicationの実行時利用とsemantic publish／Leaseの型参照を既存固定集合へ追加。Suiteの再実行は9件成功 |
| 公開Module固定集合 | 1件失敗 | Coordinatorの旧一覧を是正後、同じassertionの後続で露出したEM／CMの旧一覧も現行Rootの宣言元に追従。全profileを照合し、当該試験1件成功。公開API自体は変更しない |
| Windowsの試験準備 | 11件失敗 | Link作成EPERMの9件、Gitのsh.exeによるNamed Object作成拒否の2件。同じ11試験を権限のある実行条件で限定再確認し、成功11・失敗0・skip0。試験の省略、OS設定変更、拒否条件の緩和はない |
| 文書検査 | 是正前3935件、是正後3927件、warning0 | 一意な追従漏れ8件のみ是正。残存違反は保持 |

Windowsの11件は、外側へのSymbolic Link、正本文書Root Junction、公式ひな型Root Junction、Checker Root Junction、linked submodule marker、Git列挙の外側／欠測／Link、gitdir祖先Junction、Detail Readerの祖先Link、nested試験所有集合の9観点と、親Index mode観測不能、実物submoduleからの検査の2観点である。いずれも製品判定前の試験準備で失敗していた。限定再実行は新規試験領域だけを使用し、準備領域を終了時に回収した。

品質定義13文書の現行ID集合は207件である。205件を記録した改訂d8b666d251f534df127433fc30e0cdce1706fc06との差分は、edd4d8bfaで追加済みのHST-UT-001とERB-UT-024の2件だけで、削除はない。既存試験・Symbol登録を確認し、Quality Centerと実装実体監査の現在件数だけを更新した。日付付き205件の過去記録を改変せず、件数更新を試験実行やPassの追加として扱わない。

QA-000006の既存境界適用行に両IDを追記した。QA-000003／QA-000006の既存Checklistは、チェック状態・本文・順序・件数を完全一致で保持して末尾へ移動した。QA-000007のRFD-UT-030は、外部境界段階を既定値N/Aへ揃え、同一Process内の値検査という非該当理由は同じ行の対象説明へ保持した。Quality Centerの二つのリンクは、同じ実在見出しの区切り記号だけを修正した。これにより件数不一致2、境界段階1、適用区分1、Checklist配置2、アンカー2の計8診断が解消した。

| 残存区分 | 件数 | 今回変更しない理由・次の確認Owner |
|---|---:|---|
| Changes内のリンク／アンカー | 3902 | 旧Pathを含む履歴と後日更新された本文が混在。既存移行表ではcurrent 1032、fixed_history 2237、未登録633件に分かれる。既存Hash照合やEvidence限定の履歴Readerを緩めず、保守Ownerが現在参照と当時の参照を分離してから移行方針を確定する |
| 現行UI説明 | 5 | 撤去済み同意・端末実装へのリンク。単なるRenameではなく、UI／SPECの現行挙動との照合が必要 |
| 退役PA詳細設計 | 5 | Retired文書のNative実装参照。現行Capabilityとして復活させず、保守Ownerが履歴参照としての扱いを確定する |
| Project Context | 1 | PA未撤去時の説明と旧見出しへの参照。アンカーだけ現行へ向けると本文の意味が変わるため、現在地の説明と履歴を分離して是正する |
| Architecture整合 | 7 | 詳細契約5、対象領域集合1、関係閉包1。退役domain-model案内を現行詳細として数える範囲と、CM／Coordinator／DM／EM等の正式設計表を確認する。検査通過のために架空の責務を追加しない |
| Quality整合 | 7 | 詳細領域・単位・水準、詳細とGoal、GoalとLocal Item、Local ID集合、Source条件の各閉包。不足義務と退役platform-access.docker-repairの水準指定を現Ownerに照合し、検証義務を削らずに更新する |

残るリンク3913件とArchitecture／Qualityの14件は、上表の分類と一致する。過去の履歴参照を一括置換したり、Retired文書を根拠なく現行対象から除外したりしない。これらの設計・履歴整理後に正式入口を再評価する。それまでChecker全体の回帰成立や文書検査Passは主張しない。

型検査3設定、変更TypeScript 10FileのBiome check、diff検査が成功した。関連単体・VC Consumer 35件、公開Module固定集合1件、Quality定義・分析19件は全て成功。独立レビューに必須残指摘はない。完全ログ取得用の今回専用Rootは作成時の実体Identityを照合して回収し、不存在を確認した。全体回帰や正式入口の成功は主張しない。

#### Change認識不能の診断をCheckerへ戻す — 2026-11-16

人間は81cb27d1bのレビューを踏まえ、unrecognizedだけを戻し、他は変更しない最小是正を承認した。変更分類は不要なIssue往復の撤去であり、規則・診断・観測・短絡の変更ではない。親担当は入力Union・分岐・Mapper・利用側・旧試験を照合し、generic／official／adopterの認識集合、失敗時の後続処理、残る三比較の受理条件を着手前に確認した。技術と文書・直接伝播の独立レビュー、関連試験とChecker単体の全体回帰を対象とする。準拠表明、Repository全体回帰・実AI・Docker・過去保持物の操作は対象外。

DMのinspectChangePlacementからunrecognized要求と分岐を撤去し、専用detailsの変数も不要化した。CheckerはchangeTraceRootFor失敗箇所で既存四fieldを直接追加し、同じ位置でcontinueする。到達不能となるMapper caseを撤去し、互換経路・新Helper・Facadeは作らない。Root227項目とChecker三関数・三型、filename／evidence／aggregate、40行Headerの観測を維持する。

DMと表示Suiteの旧unrecognized試験は撤去し、その検証義務をChecker公開入口の既存結合Suiteへ移した。試験Rootの準備を一回とし、三Modeの構成差分で正本側／template側の認識Pathと診断全field、認識不能時の集約ID検査の短絡を確認する。新Suiteはなく、既存Source・verifies・Local Itemの対応は維持する。Architecture／QAも更新する。

関連単体26件、三Modeを含む新結合1件、DM／Checkerの型検査と変更六TypeScript Sourceの整形・Lintが成功した。新結合の初回は試験Git Root未初期化で走査が空になる準備不備を検出し、既存initializeGitを追加して再実行した。失敗時と成功時の今回試験Rootは回収・不存在を確認した。固定候補の独立レビューに必須残指摘はない。

Checkerの正式入口npm testを一回実行したが、format:checkがRepository全体の1022Fileを確認する段階で、未変更のCoordinator試験continuation-decision.integration.test.tsとtask-durable-foundation.contract.test.tsの整形不一致により停止した。両FileにHEADとの差分がないことを確認した。検査を迂回せず、Checker試験本体・verify:repositoryの成功は主張しない。今回の回帰用Rootは回収・不存在確認済み。この時点では対象外二Fileの整形是正を人間の判断待ちとし、製品Source・規則・Checkerの検査範囲は変更しなかった。

追加承認後、対象二Fileのimportとassert.equalの改行だけをBiome formatで是正した。独立した読取り確認でも、式・文字列・assertion・import先に変更がない。正式入口の再実行は整形1022File・Checkerの二型設定・Lintを通過し、verify:repositoryで停止した。現在のRepository成果物1207Markdownの検査結果はerror3935／warning0で、broken-link3905、broken-anchor10、Architecture／Qualityの整合違反20。変更前の実行結果との同一性は確認しておらず、この件数を今回の変更起因または全て既存と断定しない。検査の無効化・文書の一括修正は行わない。

静的段階を通過した同じ実行コードについて、停止した正式入口とは別の診断としてChecker試験本体を一回実行し、終了code1となった。確認できた失敗にVCの既知Consumer固定集合二件があり、該当Suiteの再確認では9件中7件成功・2件失敗だった。Repository Location／Local Ignoreの集合はexecution-model/storage/publication.tsが未追従、用途別Named Symbolの集合はdocument-model/semantic/publish.ts、execution-model/state/lease.ts、execution-model/storage/publication.tsが未追従。該当Suiteや三Sourceを今回変更しておらず、修正は別の判断対象とする。試験本体の失敗全体をこの二件だけと断定しない。正式回帰の失敗は保持し、診断実行を回帰成功へ読み替えない。

正式入口・試験本体診断・VC局所再確認で今回作成した三つの試験用Rootはいずれも回収し、不存在を確認した。Repository全体のPackage回帰・実AI・Docker・過去保持物は操作していない。現在の作業変更は未コミットである。

#### Checker累積差分の確定前確認 — 2026-11-16

人間の指示に基づき、fa0006c7eからの累積差分を確認した。Quality欠測継続、基本図表示変換、Architectureモデル入力、UX／Discovery、Quality比較と残存四系統の相互作用、公開・利用側・試験・台帳・文書を対象とした。関連11試験Fileの149件、七つの型検査設定、37個の変更TypeScript Sourceの整形・Lintと差分空白検査が成功した。先行の固定候補で成功した限定結合・台帳・依存15件と試験領域の回収確認を区別して保持し、件数を単純に加算して全体網羅とはしない。

累積差分を対象とした独立した読取りレビューに必須残指摘はない。Root227項目、新Sourceと検証辺、別取得・短絡、診断・現在文書と過去断面の区別を再確認した。コミット・プッシュの技術的阻害事項はない。全体回帰・実AI・Docker・過去保持物は操作しない。統合・リリース判断は別とする。

#### Checker残存四系統のOwner接続 — 2026-11-16

人間はQuality参照捕捉、作業Lifecycle、Release、Artifact命名・配置の四系統すべての継続を指示した。基準はfa0006c7eと直前までの整理候補。着手前に親担当と読取り専用確認者が、先頭節・raw正規表現・観測と診断位置、限定Headerと二回read、部分モデル、次版Candidate時の短絡とTag null、公式配布と通常Parseの適用境界を照合した。変更分類はRule・診断・実体観測を維持するOwner整理。技術、文書と直接伝播の独立確認・限定回帰を対象とし、準拠表明、全体回帰・実AI・Docker・過去保持物の操作は対象外とする。現在、人間による追加判断は必要ない。

| 残存候補 | 変更後の意味Owner | Checkerに残す処理 |
|---|---|---|
| Quality参照と欠測 | 各完成Parseが先頭Coverageの定義ID／先頭Detailのtargetを捕捉し、Qualityの完成比較が欠測Issueを返す | Path解決、既存順のSet化、別read、物理列挙とlstat |
| ひな型の宣言と適用条件 | 共通Artifactの宣言構文をUI／Architectureのtemplate Parseへ接続。CommunicationとSPEC Sequenceは固有の完成Parseで本文・主要節・Issueを返す | 公式配布の対象選択、Changeひな型存在のGate、各readと診断配送 |
| Release | 既存inspectReleaseConsistencyがRoadmap表題・README版・Tag Identity・Evidence案内の出現を比較 | 固定文書集合、GitのTag／HEAD観測、someによる候補探索の短絡、Scope |
| Artifact／Change配置 | inspectArtifactPlacementが共通の名前文法、inspectChangePlacementがChange固有の宣言・配置を比較 | 対象Path認識とEvidence区分、40行Header取得、Evidenceの二回readとcontinue |

ひな型の工程固有文言を共通Artifactへ集める初期案は、着手前照合で退けた。Communicationには対応Ownerがなかったためcommunication/parse.ts一Fileを設けた。Source数を守るために別工程へ押し込まず、必要な文書モデルだけを追加する。任意Ruleを受け付ける公開Framework、Facade、Registry、互換Wrapper、第二の永続Schemaはない。Rootの追加は二Parse・二モデル型・独立した配置比較二操作で、現行227項目（値103・型124）。既存二Index Parserの通常モードは不変で、templateだけで追加宣言Issueを返す。対象外の既存局所IssueはCheckerの旧診断へ混入させない。

共通ArtifactはCommunication等の語彙を保持せず、工程Ownerが固定した文言条件を内部の局所比較へ渡す。ReleaseのRoadmap表題自体もDMに固定し、Checkerへ期待文言の正本を残さない。名前文法は旧正規表現の境界を維持する。Changeの見出しモデルとIDモデルは別取得のままで、両者を同じ参照に統合しない。診断code・文言・severity・Path、CLI・終了値、Link／Root・Git安全条件、観測例外・Scopeを維持する。

既存単体・表示・結合に反証を追加し、既存試験の検証内容を削除しない。単体はraw／Fence・先頭節・重複・節外参照、部分モデル、通常／template、空と欠測、nullと既知不一致、二取得断面・名前境界、案内出現数を確認する。既存結合はRepository準備を一回に保ち、ひな型四文書とEvidence配置の差分だけを追加する。新Suiteを作らず、公開固定集合、公開Module一覧、Source Symbolと既存verifies、Architecture／QAを更新した。

実行コードを固定した候補で関連単体・公開・表示116件と限定結合・台帳・依存15件、七つの型検査設定が成功した。37個の変更TypeScript Sourceの整形・Lintと差分空白検査も成功した。実装中の結合成功とは区別して同じ15件を固定候補で再実行し、両方の今回試験領域を回収して不存在を確認した。独立レビューではRelease Parseの旧Semantic説明と一行連結TSDocの追従を是正し、Sequenceの説明を主要節捕捉とtemplate時の固定文言検査に限定した。実行コード・API・Rule・assertionを変えずに再レビューし、必須残指摘はない。

棚卸しで追跡した四系統は対応済みとする。未知の全Rule不存在、全体回帰・実AI・Docker・リリース成立は主張しない。全体回帰・実AI・Docker・過去保持物は操作しておらず、現段階の結果は限定検証のEvidenceである。コミット・プッシュはこの作業では実施していない。

#### Qualityの四比較を完成操作へ移管 — 2026-11-16

基準はfa0006c7eと先行のChecker整理候補。変更分類は既存の意味Rule・診断・観測順を保持するOwner整理。着手前に親担当と読取り専用確認者が、閉包と定義被覆の別観測、Coverage欠測時の非対称条件、Architectureからの検証単位、先勝ちOwner Map、件数nullを照合した。技術・文書・直接伝播の独立確認と限定回帰を対象とし、準拠表明・全体回帰・実AI／Docker・過去保持物の操作は追加しない。現在、人間による追加判断は必要ない。

Quality定義の閉包・被覆・Local Item宣言件数を既存inspectQualityConsistencyへ、Architecture詳細の検証単位被覆を既存inspectDocumentRelationsへ移管した。既存要求Unionだけを拡張し、Root221項目（値99・型122）とCheckerの三関数・三型を維持する。新しいFile・Facade・公開型・Wrapperはない。参照本文の捕捉と集合編成は未移管として残し、Quality全体の整理完了とは表示しない。

Checkerの四直接判定は撤去し、旧位置でIssueを取得してreport/quality.tsが旧診断へ変換する。既知リンクの先行lstatと後の物理列挙は統合せず、Coverage欠測でも既知リンク不足は検出する。全期待集合が必要な余分と件数差だけを保留する。Local Item件数は既存先勝ちOwner Mapのサイズであり、宣言欠測を0にしない。読取り・Parse・Path・code・severity・message・診断順は維持する。

既存Quality／Semantic単体へ空・一致・不足・余分・同数差し替え、欠測方向、件数null／0、入力非変更を追加した。表示Suiteは実Producerの四Issueを旧四診断の全fieldと順序へ接続する。既存結合試験の準備を増やさず、四違反の差分を同時に加えて元の診断位置・順序・一件性を確認し、復元して既存検証を続ける。新Suite IDは追加せず、表示Suiteのverifiesを実Ownerへ追従した。

局所54件と限定結合・依存・台帳5件、七つの型検査設定、変更した22個のTypeScript Sourceの整形・Lintが成功した。新しい結合期待値の初回確認では、公開レポートの既存code整列を内部追加順と取り違えた試験不整合を検出した。製品sortは変更せず、内部追加順と公開整列順を別々に固定して再実行した。今回の試験領域は失敗時・最終成功時とも回収と不存在を確認した。独立レビューでは現行Semantic判定数の文書表記一件を是正し、先行移管時10判定と今回追加後11判定を区別して再照合した。再レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### UX／Discoveryの三被覆をモデルOwnerへ移管 — 2026-11-16

残る五系統のうちUX／Discoveryを続行する。基準はfa0006c7eと、直前までのChecker整理候補。親担当と読取り専用確認者は、期待集合の由来、実在ID追加とParseの順、診断位置、空集合・余分・同数差し替えを着手前に照合した。変更分類は既存Rule・診断・取得順を維持するOwnerと完成受付の整理。技術・文書・直接伝播の独立確認と限定回帰を対象とし、準拠表明・全体回帰・実AI／Docker・過去保持物の操作は追加しない。

UX自身の分析・定義被覆は既存inspectUxConsistencyの二caseへ移し、採用REQ期待集合は上位から渡す。UXからDiscovery型やSemanticへの依存を追加しない。Discovery自身の採用要求対定義には既存完成入口がなく、Parseへ外部観測を混ぜたり別Ownerの比較を代用したりせず、既存discovery/validation.tsにinspectDiscoveryCoverage(index, actualIds)一関数を追加した。新File・Facade・Registry・汎用Validator・公開型は作らない。Rootは221項目（値99・型122）となり、Checkerの三関数・三型は不変。

Checkerの旧三ifは撤去し、同じ読取りで捕捉したDiscovery／UXモデルと実在集合を元位置で完成比較へ渡す。File確認とID追加、partial、例外伝播、三code・文言・Path、旧件数と期待側包含の意味は維持する。report/convert.tsは新しい中立Issueから旧診断へ変換し、Ruleを再判定しない。

既存Owner単体へ六つの集合条件と入力非変更を追加し、UX分析が別の期待集合を使う反証を維持する。既存の診断Suiteは実Producerから三つの旧診断全fieldを確認する。既存の採用要求結合は準備一回を維持し、Discovery定義被覆とUX定義被覆を差分確認する。新しいFile・Suite IDは追加せず、既存Symbolの宣言元・検証辺はこのSource・Suiteを既に対象にしているため意味のない台帳項目を増やさない。公開固定期待値と現行Architecture／QAを更新し、過去の220項目等の変更記録は当時の断面として保持する。

限定検証はDiscovery／UX／Root／診断変換の52件、選択したChecker結合・依存・台帳の8件が成功した。七つの型検査設定と変更した19個のTypeScript Sourceの整形・Lint確認が成功した。今回の試験領域は回収と不存在を確認した。固定候補の独立した読取り専用レビューでは、三比較の条件、観測位置、partial、診断契約、Root221項目と文書追従に必須指摘はない。全体回帰・実AI・Docker・過去保持物の操作は実施しておらず、Checker全体の整理完了とは扱わない。残る候補はQuality、作業Lifecycle、Release、Artifact命名・配置の四系統。

#### Architecture比較入力のモデル化を先行 — 2026-11-16

残る六系統を既存完成契約へ対応付けた結果、Architectureは新しいRoot入口なしで意味投影をOwnerへ戻せるため先行する。基準はfa0006c7eに続くChecker責務整理の固定候補。親担当と読取り専用確認者が、二比較の低レベル入力、実Consumer、既存の独立Set負例、Map欠測、二回read、実領域追加位置、型だけの依存を着手前に照合した。変更分類は判定を維持する入力契約・Owner整理であり、意味Rule・診断code／文言・Scope・正常時順序を変えない。技術・文書・直接伝播の独立確認と限定回帰を対象とし、準拠表明・全体回帰・実AI／Docker・過去保持物の操作は追加しない。

既存inspectArchitectureConsistencyのarchitecture_relationsを分析・定義モデル列と登録モデル、architecture_detail_coverageをMap・詳細本文列と実在領域／定義・Ready・診断位置へ変更した。Helper内部で従来式から関係Set・出現列・Covered集合を導出し、Checkerの重複組立てを撤去する。新File・Facade・Wrapper・Root項目は追加しない。全体のRoot220項目とCheckerの三関数・三型を維持する。Map nullは旧空集合に対応させるだけで、不存在診断・Ready時のCovered拒否を省略しない。実領域集合は本文File欠測でも従来どおり追加する。

既存RCM-UT-002と診断変換の負例を同じ検証内容でモデルfieldへ追従し、Map nullの空集合とReady拒否を追加した。部分モデル・入力順・出現重複と診断順を保持し、分析件数の条件をID集合の厳密一致へ強化していない。モデルは取得位置で保持し、別の原文／Checklist readを統合しない。一時メモリの保持範囲は増え得るが、永続Cacheや管理機構は追加しない。

親担当の実測ではArchitecture・公開契約・診断変換43項目、選択したArchitecture結合6項目と台帳・依存3項目が成功した。関連六Packageと配布入口の七型設定、変更10 TSのBiomeとdiff確認も成功し、今回試験Rootは回収後不存在を確認した。独立読取りレビューで旧式との対応・null・二回read・実観測・型だけの依存・負例の保持・未完了範囲を照合し、必須指摘は0件だった。確認者は試験を再実行していない。全体回帰・実AI・Docker・過去保持物操作、コミット・プッシュは未実施。

残る五系統は独立候補のまま維持する。採用REQ対UX分析はUX自身の被覆規則なので既存inspectUxConsistencyの候補とし、入力元がDiscoveryだからという理由だけでSemanticへ置かない。Discovery自身の採用要求対定義には現在完成比較入口がないため、必要なRoot追加を隠蔽で回避しない。Quality・Releaseは既存比較の拡張、Work Lifecycle共通条件とArtifact命名／配置は完成モデル・Ownerの確定を先に行う。これらを今回実装済みとは扱わない。

<a id="checker-responsibility-inventory"></a>
#### Checkerの責務・重複棚卸しと内部表示移管 — 2026-11-16

人間のChecker方針に基づくPhase 1〜4のうち、棚卸し・To-Be責務確定、Checkerだけで成立する最小是正、試験・文書の追従を扱う。DMの追加変更が必要な残存Ruleは独立候補として提示し、未承認の移管を実装しない。直前のQuality欠測継続の8Fileは承認済みの別範囲として保持する。基準はfa0006c7eで、Sourceの32Fileと宣言関数88件を分類した。これは名前付きfunction宣言の目録であり、arrow関数・Callback・全分岐・動的Importを含む全挙動の網羅証明ではない。

親担当は現行Source・Root・bin／配布入口・全静的参照・Architectureを照合し、読取り専用確認者と着手前整合を確認した。変更分類はChecker内部の表示責務移管と調査結果の記録。専門的な意味Rule・DM契約・保存形式・CLI引数／出力／終了値は今回追加変更しない。技術・文書・直接伝播の限定確認と独立レビューを行い、準拠表明・全体回帰・実AI／Docker・過去保持物操作は対象外とする。

| 基準Source（src/配下） | 宣言関数 | 責務分類 | 主なConsumer | DM／専門Ownerとの対応 | Effect／残存候補 |
|---|---|---|---|---|---|
| `index.ts` | 宣言関数なし（型／再export） | 三完成操作と三型の公開境界 | 公開契約試験／Package利用契約 | 各CLIの同一実装 | 再exportのみ |
| `test-catalog/selection.ts` | `inspectResourceIntensiveTestAuthority`、`ownerForPath`、`isDocumentationPath`、`isSharedRuntimePath`、`applicableConsumerBindings`、`selectRegressionStaticOwners`、`selectRegressionTests` | 回帰対象・静的Owner・高負荷条件 | cli/test-catalog／plan／Owner試験 | DM台帳モデル | 同期計画のみ、許可や起動を発行しない |
| `test-catalog/plan.ts` | `buildRegressionStagePlan`、`aggregateRegressionStageResults`、`normalizeExplicitChangedPaths`、`pathIsAbsolute` | 段階・待ち・集約・変更Path受付 | cli/test-catalog／Owner試験 | DM台帳モデル | 同期計画のみ、起動なし |
| `cli/types.ts` | 宣言関数なし（型／再export） | 公開受付・終了値の型 | 三CLI／bin／Root | DMを再exportしない | 値宣言のみ |
| `cli/test-catalog.ts` | `runTestCatalog`、`invalidArguments`、`numericValue` | 台帳CLI・変更Path・回帰計画 | Root／command | DM readTestCatalog、selection／plan | Git／Filesystem読取りと出力、試験起動なし |
| `cli/semantic.ts` | `runSemanticCoverage` | Semantic CLI受付・明示保存接続 | Root／command | DM Compile／Coverage／Publish | 読取り・出力、明示writeのみ既存保存 |
| `cli/document.ts` | `runChecker`、`cliError` | 文書CLI受付・Root・終了値 | Root／command | repository/document、report | Repository読取りと出力 |
| `cli/command.ts` | `runCheckerCommand` | 三操作のMode選択 | bin/checker.ts | 下位CLIの完成操作 | 表示／下位操作のEffectのみ |
| `repository/work-lifecycle.ts` | `inspectWorkLifecycleRepository` | Change／Release案内の観測 | repository/document | Change完成Parse／Navigation | 列挙・read・lstat、本文条件と案内判断が残存 |
| `repository/ui.ts` | `inspectUiRepository` | UIとDetail対象の観測・配送 | repository/document | UI完成Parse／Consistency | 列挙・read・lstat |
| `repository/types.ts` | 宣言関数なし（型／再export） | Repository観測と参照の内部型 | repository各File | 型のみ | 値宣言のみ |
| `repository/spec.ts` | `inspectSpecRepository` | SPECと下流Traceの観測・配送 | repository/document | SPEC／Semantic完成操作 | 列挙・read・lstat・内容Fingerprint |
| `repository/semantic.ts` | `observeDocuments`、`compileSemanticIrFromRepository`、`compileQualitySemanticRelationsFromRepository`、`createSemanticCoverageGraphResult` | 専門観測からIR／Graphへの接続 | cli/semantic | DM Compile／Graph、Repository観測Port | 読取り、前提Issue時のGraph省略 |
| `repository/scope.ts` | `selectDocumentScope` | Scope検査と一段参照拡張 | repository/document | 観測済み参照モデル | Path境界・対象Set編成 |
| `repository/references.ts` | `createDocumentReferenceReader`、`resolveLocalTarget`、`isCanonicalRepositoryRelativePath`、`loadFixedHistoryMigration`、`historicalContent`、`resolveLinkWithFixedHistory`、`buildDocumentReferenceMap`、`inspectDocumentLinks`、`anchorsFor` | 現在・固定履歴の参照解決 | document／scope／Discovery-UX | DM参照Decode、VC Revision読取り | Git／Filesystem読取り、短命参照Cache |
| `repository/reality.ts` | `inspectRealityRepository`、`createRealitySymbolGraph`、`discoverRealitySymbolManifests`、`readRegisteredRealityTests`、`readRegisteredRealityTestsFromRepository` | Manifest／Catalog観測とGraph接続 | repository/document／Semantic | DM Reality／Catalog完成操作 | Repository読取り、前提Issue時のGraph省略 |
| `repository/quality.ts` | `inspectQualityRepository` | Quality観測・前提と比較順 | repository/document | Quality Parse／Analysis／Consistency／Semantic | 列挙・read・lstat、残存意味投影と比較あり |
| `repository/project-context.ts` | `inspectProjectContextRepository` | Project ContextとManifest観測 | repository/document | 完成Context Parse／Relation | Root・File・JSONの観測 |
| `repository/observe.ts` | `errorCode`、`lstatIfPresent`、`pathContainsSymbolicLink`、`isWithin`、`samePath`、`decodeGitConfigValue`、`fallbackDeclaredSubmodulePaths`、`observeRepositoryLayout` | Root・Layout・Link・Path観測 | repository各File | VC専門操作 | Filesystem／Git読取り |
| `repository/ia.ts` | `inspectIaRepository` | IA対象と取得順の編成 | repository/document | IA完成Parse／inspectIaConsistency | 列挙・read・lstat |
| `repository/document.ts` | `inspectDocumentRepository`、`changeTraceRootFor`、`isEvidenceFile`、`declaredChangeTraceId`、`hasChangeTraceDefinitionSignature`、`gitlinkRootFor`、`checkPhaseDiagramDispositionContracts`、`checkDiscoveryIdentityLinkOwnership` | 全体編成・文書観測・集計 | cli/document | Artifact／Release／Relation完成操作 | read・列挙・診断配列、残存意味判断あり |
| `repository/discovery-ux.ts` | `inspectDiscoveryUxRepository` | Discovery／UX観測・形式入力解決 | repository/document | 工程Parse／inspectUxConsistency | 列挙・read・lstat、三被覆判断が残存 |
| `repository/discover.ts` | `observeProjectFiles`、`isInitializedBaselineWithoutGit`、`walk`、`fail`、`inspectDirectory` | Git／Filesystem探索 | repository/document | VC専門操作 | Git／Filesystem読取り |
| `repository/architecture.ts` | `inspectArchitectureRepository` | Architecture観測・比較入力編成 | repository/document | 完成Parse／inspectArchitectureConsistency | 列挙・read・lstat、関係投影が残存 |
| `report/types.ts` | 宣言関数なし（型／再export） | 異なる診断／報告shapeの保持 | repository／report／CLI | 型のみ | 値宣言のみ |
| `report/semantic.ts` | `stringDetail`、`numberDetail`、`mapSemanticDomainIssueToDiagnostic` | Semantic中立Issueの変換 | repository/semantic／CLI | DM Semantic Issue | 純粋変換・不足値拒否 |
| `report/reality.ts` | `mapRealityDomainIssueToCheckerFinding` | Reality中立Issueの変換 | repository/reality | DM Reality Issue | 純粋変換 |
| `report/quality.ts` | `mapQualityDesignStateIssueToFinding`、`mapQualityDefinitionIssueToFinding`、`mapQualityAnalysisIssueToFinding`、`mapQualityRelationsIssueToFinding` | Quality固有の診断語彙変換 | repository/quality | DM Quality Issue | 純粋変換・不足値拒否 |
| `report/output.ts` | `writeDocumentReport` | 通常レポートのJSON／人間表示 | cli/document | DocumentReport | 出力callback |
| `report/document.ts` | `mapDocumentRuleIssueToFinding`、`mapDocumentIdentityIssueToFinding`、`mapStableReleaseIssueToFinding` | 文書・Identity・版・基本図の表示 | repository/document | DM DocumentIssue | 純粋変換・不足値拒否 |
| `report/convert.ts` | `mapArchitectureDomainIssueToFinding`、`mapIaDomainIssueToFinding`、`stringDetail`、`mapArtifactDomainIssueToCheckerFinding`、`mapUiDomainIssueToFinding`、`mapChangeDomainIssueToFinding`、`mapUxDomainIssueToFinding`、`mapDiscoveryDomainIssueToFinding`、`mapSpecDomainIssueToFinding` | 工程IssueとArtifactの専用変換 | 各工程repository | DM DocumentIssue | 純粋変換・不足値拒否 |
| `report/collect.ts` | `createFindingCollector` | 追加順・重複を保持する収集 | repository/document | 意味判定なし | 局所配列更新 |

公開RootはrunChecker／runSemanticCoverage／runTestCatalog、CheckerRunRequest／CheckerResult／CheckerFindingを維持する。実Process入口bin/checker.tsはcli/command.tsから同じ実装を選び、配布入口はbinを読み込む。Rootを直接利用する公開契約試験と、実bin／配布入口の試験を区別する。外部本番Packageに新しいRoot利用を仮定しない。完成した三操作と既存の利用契約を維持するため、参照数だけで公開を削除しない。

基本図の意味判定は既にDMのdiagramContractにあり、今回移すのはkind／missingItemsの拒否とseverity／code／Path／文言の表示処理だけである。既存report/document.tsの専用mapPhaseDiagramIssueToFindingへ旧blockを移し、Repositoryの旧表示組立てを撤去する。missing_phase_diagram_contractは接続確認としてRepositoryへ残す。七対象の選択、fallback、exists確認、read、Parse、配送位置は変えない。表示Pathは明示文脈を使い、空文字列とinvalid_phase_diagram_domain_issueの固定理由を維持する。新File・Facade・Registry・Managerは作らず、MapperはRootへ公開しない。

重複調査では、品質表の二ループは各々fresh readするため、同一本文と推測して統合しない。一般Artifactの参照・Related・Identity受付、Header窓、Checklist再read、Scope／固定履歴も対象範囲と観測時点が異なる。reportの同名stringDetail類は型検査が似ていても例外理由が異なり、汎用化しない。回帰計画とreadTestCatalogはOwnerが異なり、台帳の意味検査をCheckerへ再実装しているものではない。

DM独立変更候補は次のとおり。いずれも現在は未採用・未実装で、今回の内部移管の完了へ混ぜない。

| 候補 | 残存している意味判断／入力組立て | DM側で検討する完成契約 | Checkerへ残すもの |
|---|---|---|---|
| UX／Discovery三被覆 | 採用REQ対実在分析、採用REQ対実在定義、UX台帳対実在定義 | モデルと観測集合の被覆比較。別用途の投影比較で代用しない | File／Directory列挙、読取り、実在IDと診断配送位置 |
| Quality | Coverage／Detail本文からの参照捕捉、定義集合・詳細単位・Local Item件数の比較 | 取得した参照の構造捕捉と、実観測を受ける関係比較 | Path解決・lstat・File存在・欠測継続と観測順 |
| Work Lifecycle | UI／Architectureひな型のAuthority宣言、Communication／Sequenceの必須断片、Release Evidence案内の出現回数 | 成果物種別の局所Parseと案内モデル対観測結果の比較 | 公式Scope、ひな型・Evidence列挙、対象read |
| Release | 正本文書タイトル、README版と正本文書集合、Stable TagとHEADの相関条件 | モデルと版／Git観測を受けるRelease完成比較 | Git Revision観測、Candidate探索の短絡、取得断面 |
| Artifact命名／配置 | ID入りFile名、CHG配置・宣言ID一致、Evidence File名等の正本形式判定 | Artifactの配置・Identity契約。単なる任意Path検証とは分ける | Root／Link境界、対象Scope、物理Fileの列挙と種類確認 |
| Architecture | 関係Set・出現列をCheckerが組み立てて既存DMへ渡す | 既存比較を工程モデル入力へ寄せる候補。Rule追加ではない | 部分モデル捕捉、実在集合と別時点のread |

これらは単にDMへ関数を移す案ではない。既存のIssue分類・未知／欠測・対象Scope・短絡・観測順をどの完成契約で維持するかを確定し、DMのFix解除が必要なら別途承認を得る。Checkerだけの是正をもって全Rule二重管理ゼロや全体完成とは表示しない。

親担当の追加実測は診断変換・CLI・公開契約23項目、基本図・台帳・依存・Graphの限定6項目が成功した。Checkerと配布入口の二型設定、変更7 TSのBiomeとdiff確認も成功し、今回専用試験Rootの回収後不存在を確認した。既存Suite・Local Itemを維持し、diagnostics Suiteからreport-documentへのverifiesを追加した。初回追加単体試験はProducerのtemplate mode指定漏れで失敗したため、本番と同じ明示modeへ直し、期待値・製品の受理条件を変えず再実行した。

独立読取りレビューで固定例外・kind短絡・明示Path・空文字列・接続確認・七対象の取得と配送位置、試験・台帳・基準88宣言の正確性と限界、DM候補を未実装とする記載を照合し、必須指摘は0件だった。新Mapperにより現在の内部宣言は89件だが、Rootの三関数・三型は不変である。確認者は試験を再実行していない。直前のQuality継続試験とは別の限定集合として記録し、件数を合算して全体回帰の保証へ昇格しない。全体回帰・実AI・Docker・過去保持物操作、コミット・プッシュは実施していない。

#### CheckerのQuality欠測時継続とDMの限定是正 — 2026-11-16

基準fa0006c7eのDMをFixとした後、Checker棚卸しでCoverage欠測時のQuality全体returnを確認した。人間は「欠測エラーを残し、必要情報のない比較だけを保留して独立検査を続行する」挙動を採用し、DMの既存照合にも限定変更を承認した。旧APIを丸ごと省略すると独立した重複等も未評価になるため、独立変更として既存quality/analysis.tsの方向別比較を是正する。新File・Manager・Registry・Wrapper、公開関数・型、CLI field／code／文言は追加しない。保存・認可・期限・数量制約は変更しない。

親担当は現行正本・全利用側と比較の依存を照合し、読取り専用確認者の反証を統合した。Coverage全体の不足は不明でも、既知Coverageの正本外IDや情報源関係・要求段階の不足は確定できるため、比較全体を止めない。変更分類は承認済みの失敗時継続条件・入力欠測の扱い変更。技術・文書・直接伝播の独立確認、限定試験と既存の正常系回帰を実施し、準拠表明・Release判断・全体回帰・実AI／Docker・過去保持物の操作は対象外とする。編集は既存関数と試験・現行文書に限定する。

| 情報の状態／比較 | 処置 |
|---|---|
| 一工程以上でCoverage節欠測 | 既存の欠測エラーを一件追加し、定義本文・重複所有・Detail・件数・Local Item検査を継続 |
| 正本にあるIDが不完全なCoverageに見当たらない | 未評価。全体件数や不足側の不一致を生成しない |
| 取得済みCoverageに正本外IDがある | 既存の全被覆不一致Issueを一件返す |
| 既知Coverageの関係・要求段階が情報源関係に足りない | 既存Issueを返す。逆方向の余剰や件数は全節取得時だけ比較 |
| 未知Goal名 | 欠測時は名解決を保留。ただし列数・処置・既知Goal重複は継続 |
| 取得済み定義リンクの対象Fileがない | 実在エラーと確定できる集合差を維持 |
| 実定義が不完全なリンク集合にない | 孤立と推定しない。全節取得後に従来の完全一致を検査 |
| 読取り例外 | 握り潰さず伝播。未取得を空値や成功にしない |

DMは既存分析結果にhasCoverageSectionsを返し、値は渡されたモデル列の節取得可否だけを表す。部分モデルを捨てず、正常入力の判定順を維持する。CheckerのFile欠測時の既存早期停止は今回対象外とし、読取り済み本文のCoverage欠測だけを継続へ変更する。初期Checklistは既に欠測判定前に実行されており、その取得位置を変更したとは扱わない。既存Suite・Local Itemの検証を保持し、新しい試験File／IDは追加しない。

親担当の実測ではDMのQuality・公開契約・診断変換30項目、既存Quality結合と台帳・依存の選択4項目が成功した。Quality結合は正常基準と従来の検証を維持したまま、欠測＋定義不備＋重複所有、欠測による偽陽性の不在、Coverage復元後の集合不一致を確認する二つの差分を追加した。関連六Packageと配布入口の七型設定、変更4 TSのBiomeとdiff確認も成功した。今回の試験Rootは回収後不存在を確認した。独立読取りレビューで方向別比較・独立検査・正常時順序・例外伝播・試験と文書を照合し、必須指摘は0件だった。確認者は試験を再実行していない。全体回帰・実AI・Docker・過去保持物操作、コミット・プッシュは実施していない。

#### 完成受付・モデル入力整理の統合確認 — 2026-11-16

単体三受付、Local Item所有照合、UI／SPEC／UXの入力モデル化、Quality三caseとSemantic接続を含む37変更Fileを統合して確認した。変更した12単体・契約試験Sourceの110項目が成功し、変更33 TSのBiomeとdiff確認も成功した。旧三Inspector・旧型は40_Developと配布ひな型に参照がなく、新しいFile・Facade・互換入口は追加していない。限定Checker結合・台帳・依存・関連型検査と今回試験領域回収の実測は各節の結果を保持し、件数を単純合算して別の試験集合の保証としない。

独立した統合読取りレビューで、各範囲の相互干渉、Root220項目（値98・型122）、内部集約の非公開、旧参照の不在、部分値・観測とモデルの分担・既存診断順、同工程比較を残す理由と文書の完了範囲を照合し、新しい必須指摘は0件だった。確認者は試験を再実行していない。今回合意した受付・公開境界整理に既知の実装修正残件はないが、全体回帰・実AI・Dockerの保証は未確認のまま区別する。過去保持物は操作せず、コミット・プッシュも未実施。

#### Quality入力集約とSemantic接続の完結 — 2026-11-16

残るQuality三caseと下流のLocal Item照合を同じ変更単位とする。親担当は現行Source・全参照・Architecture・既存RCM-UT-002とChecker結合を照合し、読取り専用確認者と、出現順・Set初出順・Map後勝ち・段階Set複製・partial・別契約の先勝ち所有者を着手前に確認した。変更分類は既存判定とI/Oを維持する入力契約・意味投影Ownerの整理。文書と直接利用側の伝播確認、限定回帰、独立技術レビューを対象とし、規範・認可・保存形式を変更しないため準拠監査・全体回帰・実AI／Docker試験は追加しない。追加の人間判断は不要。

quality_definition_relationsは定義モデル列・完成工程分析結果・統合モデル、quality_goal_local_relationsは定義列・統合モデル、quality_goalsは完成分析結果を受ける。Checkerの定義関係・条件・義務・段階のMap／Set／出現列集約を撤去した。既存quality/definition.tsのRoot非公開の集約をQuality比較と下流Semanticが使い、SemanticのLocal Item段階入力も定義モデル列へ統一した。新File・Facade・互換入口は追加せず、Root220項目と公開関数名は維持する。

入力モデルを除外せず、旧文書順・各field順・重複出現・後勝ちと段階Setの複製を維持する。所有者の先勝ちMapは重複診断・件数に必要な別契約として残す。モデルは既存の読取り・Parse位置で捕捉し、局所Issue・所有者診断・同工程比較・Semantic比較・件数宣言の再readと診断順を変えない。各比較で独立した集約を行うため、計算と一時割当は増え得る。一度だけの集約・Cache・同一世代Snapshotは主張しない。旧試験の独立Set／出現列の不整合反証はモデルの対応fieldへ移し、既存assertionを維持する。

この節は直前の八操作表で未完了としたQuality入力範囲を閉じるもので、過去断面の記録を上書きしない。親担当の実測ではQuality・公開契約31項目とSemantic・診断27項目、選択したChecker結合・台帳・依存・Graph6項目が成功した。関連六Packageと配布入口の七型設定、変更33 TSのBiomeとdiff確認も成功し、今回試験Rootの回収後不存在を確認した。初回局所試験では試験入力追従時に改行を二重escapeした1件が失敗したため、元の複数行入力へ戻し、期待する診断順を変えず再実行した。

独立読取りレビューでは実装・型・入力順・部分モデル・先勝ちOwner分離・不整合反証・依存方向に必須指摘はなく、旧集合／Mapを直接受付する入力ヘッダー2か所の追従漏れを検出した。該当2行と同じ公開比較・Semanticの説明をモデル受付へ揃え、判定・型・API・読取り位置は変更していない。是正後の独立再照合で入力説明と現行契約の一致を確認し、必須残指摘は0件となった。確認者は試験を再実行していない。全体回帰・実AI・Docker・過去保持物は操作していない。コミット・プッシュは未実施。

#### 残る八照合の公開理由とUX入力のモデル化 — 2026-11-16

基準は069dd1fefに続く単体三受付・UI／SPECの変更候補で、Rootは220項目。変更分類は既存判定を維持する受付契約と利用側責務の整理。親担当は現行Architecture・Source・全参照を照合し、読取り専用確認者とUXの原文一致・期待Identity・partial・欠測・例外・Set順を着手前に確認した。文書と利用側の直接伝播、限定回帰と独立レビューを対象とし、規範・認可・保存形式・Effectを変更しないため、準拠監査・全体回帰・実AI／Docker検証は追加しない。人間の追加判断事項はない。

| 残る公開操作 | 利用先・入力の責務 | 結論 |
|---|---|---|
| inspectUxConsistency | Checkerのdiscovery-ux。局所モデル、参照境界の六観測、登録、UX／Journey集合 | 登録数と二関係SetのCaller組立てを撤去。既存台帳・分析列・Experience Mapモデルを受けOwnerが導出。外部観測は維持 |
| inspectIaConsistency | Checkerのia。分析／定義／台帳／投影モデル、実在ID集合 | 維持。複数文書・Directory集合の対応であり単体Parseでは完結しない |
| inspectArchitectureConsistency | Checkerのarchitecture。分析／定義／詳細／登録と実在集合・Ready条件 | 維持。局所IssueとReady条件・件数・集合の異なる契約を扱う完成比較 |
| inspectQualityAnalysis | Checkerのquality。工程別分析列、統合モデル、実在する正本ID集合 | 維持。既にOwner内で関係を集約して比較し、結果を後段照合へ渡す |
| inspectQualityConsistency | Checkerのquality。状態モデル、定義閉包、Goal行と集約関係 | 公開する複数文書比較の意味は維持。定義集約とGoal行の入力をモデルへ接続する整理は未完了 |
| inspectReleaseDocuments | Checkerのdocument。CanonicalDocumentの完成Parse結果列 | 維持。版集合・Candidate／Baseline・Stableの文書集合判定であり一文書へ畳めない |
| inspectReleaseConsistency | Checkerのdocument。Release文書・Changelog・README、版とTag観測 | 維持。複数成果物と外部Git観測の整合であり、局所Parseとは異なる |
| inspectChangeNavigation | Checkerのwork-lifecycle。ChangeIndexと観測済み変更ID列 | 維持。重複は局所Parseへ任せ、案内と実在集合の一致を追加評価する |

UXは既存types.ts／validation.tsへ変更を閉じ、新しいFile・Facade・互換受付・公開項目は追加しない。台帳の登録数は旧raw文字列一致式で導出し、構造化リンク数へ強化しない。解析へ渡す期待Identityは従来と同じDirectory IDである。分析モデルは旧Set更新位置でpartialも保持し、モデル順とモデル内Set順から関係を導出する。Experience Mapは同じ読取り位置で保持し、欠測nullだけを比較内の空Setへ対応させる。読取り失敗は例外のまま伝播する。既存RCM-UT-002と診断試験を入力追従し、既存検証を削除せず原文一致・期待Identityの反証を追加する。

Qualityの未完了範囲はquality_definition_relations／quality_goal_local_relations／quality_goalsの入力集約。定義モデルからのsource・goal・detail・obligation・level等の集約と、分析結果・統合モデルの受け渡しを同時に整理する必要がある。localItemLevels／BoundaryStagesはSemanticの工程横断比較でも使うため、公開を隠すだけでCallerの重複組立てを残す形にしない。次の同じ変更意図で、集約OwnerとSemantic利用側まで一括して扱う。今回この残件を完了済みとはしない。

親担当による単体・公開契約・診断変換41項目、選択したChecker結合・台帳・依存9項目が成功した。関連六Packageと配布入口の七型設定、変更30 TSのBiome、diff確認も成功した。今回作成した試験Rootは回収後不存在を確認した。独立読取りレビューの必須指摘は0件で、登録数の取得断面と期待Identity、partialの収集位置、Set順、欠測と読取り例外、既存assertionの保持、Quality残件の明示を照合した。確認者は試験を再実行していない。コミット・プッシュ、全体回帰・実AI・Docker・過去保持物操作は実施していない。

#### UI／SPECの同工程照合入力のモデル化 — 2026-11-16

残る十操作のうちUI／SPECを確認し、実体観測はChecker、取得済みモデルの意味投影は各工程Ownerとする。親担当と読取り専用確認者が着手前に、部分モデル・重複出現・観測件数・読取り位置・診断順を照合した。UI DetailはUiIndex、SPEC内の照合はSpecIndex／SpecAnalysis／SpecDefinitionを受け、比較用関係列・台帳集合・件数ラベル対応をOwner側へ移した。新しいFile・Facade・公開操作・互換入力は増やさず、Rootは220項目のままとする。

親担当の実測では単体・公開契約・診断変換の60項目、選択したChecker結合・台帳・依存・Graphの10項目が成功した。関連六Packageと配布入口の七型設定、変更26 TSのBiomeとdiff確認も成功し、今回作成した試験Rootの回収後不存在を確認した。独立した読取り専用レビューでは必須指摘0件。確認者は試験を再実行せず、旧式との対応・部分値・五観測件数・診断順・先行Parse整理との干渉なしを確認した。コミット・プッシュは未実施であり、全体回帰や実境界の完了を主張しない。

Filesystemの実在集合と五件数は既存観測位置・式を維持する。分析件数は二観点の観測集合の合計で、モデル数を使わない。読取り例外・不存在skip・局所Issue配送・照合順は変えず、partialモデルも照合へ渡す。モデルを評価時点まで保持する分、一時メモリに原文等が残るが、新しい保存・Cache・数量制約は導入しない。既存Suite・Local Itemへ入力と反証を追従し、新しい試験File／IDは追加しない。残り八操作を完了済みとは扱わない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### 単体三受付の完結とLocal Item所有照合のモデル入力化 — 2026-11-16

基準は069dd1fefの219公開。検査公開16操作を単体三、同工程集合／外部観測十一、工程横断二に分類した。着手前に親担当と読取り専用確認者が、単体三の適用範囲・モデル・診断・既存利用側を照合した。変更分類は完成受付と入力契約の再構成。保存形式・認可・読取り範囲・数量制約・既存code／文言は変えない。文書・利用側の直接伝播確認と独立技術レビューを対象とし、準拠表明・全体回帰・Release判断は行わない。

| 基準のCapability | 新しい完成受付／Owner | 保持する条件と利用側 |
|---|---|---|
| 任意Markdown中の分岐表・是正表 | 既存quality/verification-tables.tsのparseQualityTables、QualityTables | 本文からArtifact・表別件数／Issueとpartialを構築。一般Artifactの別Issueを混ぜず、Checkerの二read・二loop・区分別配送を維持 |
| 全MarkdownのDiscovery参照規則 | 既存discovery/validation.tsのparseDiscoveryReferences | 本文からArtifactModelと参照出現ごとのIssue。既存のCHG／Evidence除外・Fence除外を維持し、REQ文書だけへ狭めない。Artifact→Discovery依存は作らない |
| Reality Catalog限定登録 | 既存reality-traceability/catalog.tsのparseRealityTestCatalog、RealityTestCatalog | JSON解析と三field／Path重複検査を一括し、不正JSONと構造不正を別Issue・null結果で返す。Checkerは旧unobservable code／文言へ対応。全Schema検査・走査・新制限は追加しない |
| Local Item所有照合 | inspectQualityLocalItemOwnershipへ完成QualityDefinitionModelを渡す | 既存source.path／localIdsをOwnerが取り出し、先勝ち・重複出現・空Owner真偽条件・入力Map非変更を維持 |

旧三InspectorとQualityVerificationEvaluationは撤去し、名前だけの互換入口を残さない。Rootは220項目（値98・型122）で、操作数を増やさずReality登録Mapの明示モデル型を追加した。JSON不正の新しい中立Issueはcatalog.json.invalidであり、外部のChecker診断は変えない。現行の公開集合・同工程照合の扱いは別の変更単位で追跡し、残る十操作を無理にbatch化したとは表示しない。11照合のうち今回はLocal Item入力を是正し、残る入力の意味組立ての整理は継続対象とする。

既存試験は入力とassertionを追従し、35単体・契約と八つの限定Checker／台帳試験が成功。Catalog Link拒否の追加限定確認も成功し、今回専用の二試験Rootの終了後不存在を確認した。Quality診断変換の旧試験が、本番で別配送するChecklist Issueまで変換へ渡す不整合を検出したため、本番と同じfilterを入れ本文診断・重複所有の期待値を維持した。関連六Package・配布入口の型検査とBiome／diffも確認する。台帳は同じSource・試験Path・Local Itemを維持し、新しい試験Fileや恒久Checkerを追加しない。実AI・Docker・過去保持物・全体回帰は操作しない。独立レビュー結果は確定後に記録する。

#### 現行設計のOwner・公開入口説明の追従 — 2026-11-16

直前の第一範囲は、関連六Package・配布入口の型検査、変更16 TSのBiome・diff確認が成功した。限定44対象の成功と今回試験Root回収は親担当の実測であり、読取り専用独立レビューはこれを再実行していない。独立レビューの必須指摘は0件で、三受付の対象範囲・区分別診断・JSON不正と構造不正の区別・実モデルのLocal ID利用・残る集合比較の未完了範囲を確認した。コミット・プッシュ、全体回帰・実AI・Docker・過去保持物操作は実施していない。

追加確認で、Semantic設計二文書の旧domain-model配置・公開Owner・Storage責務・正本参照と、Checker設計の撤去済みRoot Helper／旧Discovery比較入口の説明が現行実装と不一致だった。変更分類は実装済み契約への文書直接伝播。親担当がcurrent Source・モデルfield・Rootを照合し、読取り専用確認者と着手前整合を確認した。ArtifactModelにfences fieldはないため、Fenceは完成Parse内部の捕捉・局所診断、checklist／anchors／linkTargetsはモデル値と区別する。

是正はSemanticの01／02とCheckerの01の三文書に限定し、semantic・artifact・reality-traceability・repository・storageの現在Owner、完成Parse・モデルを使う接続と、維持する独立raw参照受付を説明した。旧日付見出しは維持し、現行を説明する段落と正本参照だけを更新する。Source・公開IF・試験・保存Schema・過去Evidenceは変更しない。読取り位置・別観測・短絡・適用条件・診断順・原子的保存と失敗時保全は変更しない。文書・リンクと直接伝播の限定確認、独立レビューを対象とし、規範・認可・保存境界を変えないため準拠監査・全体回帰は追加しない。実AI・Docker・過去保持物の操作は行わない。結果は確定後に追記する。

#### 工程移管の完結と公開内部化候補六項目の結論 — 2026-11-16

直前の文書追従は、三文書の原文／モデル捕捉、更新した現Owner実Path、文書モデル正本への直接リンクと明示Anchor、現行Rootの操作名、公開契約表の連続性を一回限りの読取り確認で照合し成功した。撤去済みOwner／旧Root呼出しの断言が対象区画へ残らないこととdiffも確認した。恒久Checkerや新しいScriptは追加していない。読取り専用独立レビューで必須指摘は0件だった。確認者は試験・編集・外部操作を行っていない。

変更分類は既存判定と保存保証を維持するOwner・公開契約整理。着手前に親担当と読取り専用確認者が、Changeの局所重複短絡、Discoveryの全Markdown観測範囲、出版のBundle生成→Store一回、Topic／MeetingのRoot経路と故障注入Ownerを照合した。移管前のCapabilityと既存単体・契約・実Filesystem／Git結合を対応付けた。文書・利用側・直接伝播と独立技術レビューを対象とし、規範・認可・保存形式・Writer／Lock方式は変更しない。準拠表明・Release判断・全体回帰は対象外。

Change案内の比較は既存change/validation.tsのinspectChangeNavigation、DiscoveryのREQ表示参照とEXP分析Pathの不一致は既存discovery/validation.tsのinspectDiscoveryIdentityLinksへ移管する。単一判定のため汎用Unionや新しいRequest公開型は作らず、取得済みモデルと期待集合を受ける。旧二case・型枝を撤去し、Semanticには工程横断十判定だけを残す。Changeの重複時短絡・欠測と空集合の受理、Discoveryの参照出現と全Markdown対象、Checkerの取得・診断位置は維持する。

| 内部化候補 | 今回の処置 | 根拠・保持する契約 |
|---|---|---|
| createFilesystemSemanticBundlePublisher | 実装・Root公開を撤去 | Capability捕捉だけの転送Factoryを廃止。publishSemanticCoverageが明示Repositoryを受け既存Storeを一回呼ぶ |
| SemanticBundlePublisher | 型宣言・Root公開を撤去 | 外部にPublisherを組み立てさせず、Writerと内部故障Hookは維持 |
| TopicMeetingRepository | Root公開と生成入口の注入Overloadを撤去 | 本番はRootと期待Project。故障試験は既存内部createTopicMeetingOperationsへ接続し全assertionを維持。Root版の種別限定・期待Project検証は実Filesystem ITで別に確認 |
| inspectRealityTestCatalog | 独立入力受付として維持 | 既存一回観測／JSON解析と分離した三文字列field・Path重複の受付。全Schema版readTestCatalogと別契約。新readWrapperの追加や検査拡大は不要 |
| parseMarkdownLinkReference | 独立入力受付として維持 | 現在参照・固定履歴のraw参照をtargetとanchorへ分割し各一回Decode。不正でも他方の結果を保持。解析をCheckerへ複製せず、Filesystem／Git解決は上位に残す |
| MarkdownLinkReference | 上記受付の結果型として維持 | Decode結果と失敗を外部が一組で扱う。関数と型を分離して隠さない |

Rootは219項目（値98・型121）。二つの完成比較を追加し、不要三公開を撤去した。下記210→220等の表・数は当時の調査断面として保持する。今回の候補六項目の評価は閉じたが、数だけで全将来用途に対する公開最小性は主張しない。新File・Facade・互換処理は追加しない。

限定試験: 単体・Root・診断変換37、維持するCatalog／参照受付四、出版・活動CRUD・公開元／台帳等十、既存Checkerの変更案内・通常／固定履歴参照と台帳等七が成功した。台帳等四件の再実行を含む58実行・54対象項目で、全体回帰ではない。二つの今回専用Repository-local試験Rootは終了後の不存在を確認。関連六Packageと配布入口の型検査も成功した。故障注入は内部Ownerの保存前後例外と実Storeの部分書込み／原子的置換前失敗を区別し、実CLIの明示保存・失敗時Snapshot保全も確認した。独立レビューの結果は確定後に記録する。実AI・Docker・過去保持物は操作していない。

#### UX／IAの九比較のOwner移管 — 2026-11-16

直前の最終整理の独立レビューは実装・Consumer・故障試験移管に必須の修正なし。Publisher行撤去後に公開契約表を分断した空行一行を是正し、契約内容・Owner・Source・試験は変更していない。読取り専用再確認でscope1–2に残る必須指摘は0件となった。確認者は試験を実行していない。

変更分類は判断条件を維持する責務・公開元の移管。着手前に親担当と読取り専用確認者が、既存validationの責務、型限定依存、UX登録Issueの先頭追加・同kind抑止、IAの局所Issue継承・accepted対応・後勝ちMapを照合した。正式入力の六観測は既存Callerの取得を維持し、UXは再観測・補完しない。規範・認可・保存形式・I/O・適用条件は変えず、文書・直接伝播確認と独立技術レビューを対象とする。準拠表明・Release判断・全体回帰は対象外。

ux_projection／ux_formal_input／ux_analysis_registration／ux_relationsは既存ux/validation.tsのinspectUxConsistencyへ、ia_analysis_coverage／ia_index_coverage／ia_projection／ia_definition／ia_relationsは既存ia/validation.tsのinspectIaConsistencyへ移管した。入力契約は各types.tsのUxConsistencyRequest／IaConsistencyRequest、Rootは220項目（値97・型123）。Semanticの旧九case・型枝と専用六Helperを撤去し、新File・転送Wrapper・共通基盤は作らない。残るSemanticは12kind（工程移管候補2／Semantic維持10）。前段の公開数・分類表は当時の調査断面として保持する。

基準Capabilityとの対応: UXの投影・登録・正式入力・REQ／Journey閉包は同じ四caseと二Helperへ、IAの分析／登録被覆・投影・定義証拠・Object閉包は同じ五caseと四Helperへ対応付ける。UXの非空条件とJourney関係の非空条件を区別し、IAの受理済み対応だけを関係比較へ渡す。既存Owner試験の入力とassertionは削らず、新旧の診断変換・Root集合・Symbol検証辺を追従する。検証と独立レビューの確定結果は追記で区別する。全体回帰・実AI・Docker・過去保持物は操作しない。

#### UI／SPECの各四比較のOwner移管 — 2026-11-16

UX／IAの独立レビューでは実装・Consumer・型依存に退行指摘なし。追従二系統として、現行設計の旧projection入口とIdentity受付名、UX補助の旧引数説明を是正した。現行文書内の同じ旧Identity名も残存検索で追従し、SourceではHeaderだけを変更して本文を維持した。UX14試験・当該Biome・diff確認は成功。読取り専用再レビューで残る必須指摘は0件となった。確認者は試験を実行していない。

直前のUX／IA移管の検証結果: 純粋・Root・診断変換56試験、UX／IA結合九試験が成功。台帳追従で検証辺を既存辺と重複させた編集ミスを検出し、重複を除去して診断変換試験の正しい記録へ追加した。公開元・台帳・依存・Global Graph四試験を再実行して成功。今回作成した結合試験Rootの不存在も確認した。関連六Packageと配布入口の型検査、変更42 TSのBiome・diffが成功。九caseと六Helperは空白を除く本文一致を確認し、Checkerはimportと九呼出名以外を変更していない。文書の残存検索で前段Architecture入口を指す旧説明一文も修正した。独立レビュー結果は確定後に記録する。

変更分類は判断条件を維持する責務・公開元の移管。着手前に親担当と読取り専用確認者が、既存UI／SPEC validationの責務、型限定依存、局所Issue優先と既存重複式の同値性を照合した。前段のConsumer・Release・Quality・Architecture変更は保持する。規範・認可・保存形式・I/Oと適用条件は変更せず、文書・利用側・直接伝播と独立技術レビューを対象とする。準拠表明・Release判断・全体回帰は対象外。

ui_analysis_coverage／ui_index_coverage／ui_relations／ui_detail_coverageは既存ui/validation.tsのinspectUiConsistencyへ、spec_analysis_coverage／spec_definition_coverage／spec_coverage／spec_detail_coverageは既存spec/validation.tsのinspectSpecConsistencyへ移管した。入力契約は各types.tsのUiConsistencyRequest／SpecConsistencyRequestから直接公開する。Root216項目（値95・型121）、Semantic残存21kind（工程移管候補11／Semantic維持10）とする。下記210項目・37kindの表と前段212項目・29kindは、それぞれ当時の確認断面であり現行値と区別する。

基準Capabilityと置換の対応: UIのUX→IA網羅、登録集合、三者の出現重複と閉包は同じ局所三Helperへ対応付ける。SPECのUX網羅→重複→IA網羅、定義重複→登録網羅、件数→三者閉包は同じ局所三Helperへ対応付ける。重複式だけは同値の既存hasDuplicateへ統合し、Semanticの専用Helperを撤去する。両Detailは既存局所Issueを先に返す条件と集合境界を維持する。UI–SPECの正式対応・Detail対応・下流担当・EvidenceはSemanticへ残す。Consumerは同じread・lstat・集約・短絡位置で呼出し名だけを変更し、未知kindの拒否以外の新規判定を加えない。新File・転送Wrapper・Registryを作らない。

限定検証はUI／SPEC・Root・Semantic・診断変換69試験と、UI／SPEC結合八件・公開元／台帳／依存／Global Graph四件の計12試験が成功した。結合試験は今回専用Repository-local領域で実行し、終了後の不存在を確認した。試験入力・assertionを削らず、Owner試験とSymbol検証辺・公開元集合を追従する。関連型検査・静的確認と独立レビューの確定結果は追記で区別する。全体回帰・実AI・Docker・過去保持物は操作していない。

#### Architectureの八比較のOwner移管 — 2026-11-16

UI／SPEC移管の独立レビューは実装・Consumer・型依存・既存assertionに退行指摘なし。Detail被覆の現行説明一段落が旧Semantic入口を指す一点を是正し、Ownerと入口だけを各inspectUiConsistency／inspectSpecConsistencyへ揃えた。局所Issue優先・combined診断一件・Checklist追加配送なしと条件は変更しない。文書の残存検索・diff確認が成功し、読取り専用再レビューで残る必須指摘は0件となった。確認者は試験を再実行していない。

直前のUI／SPEC移管の静的確認: 関連六Packageと配布入口の型検査、変更34 TSのBiome、diff確認が成功した。旧八caseと六Helperは空白を除く本文の一致を確認し、SPECの重複Helper名だけを同値の既存処理へ統合した。Checkerの差分はimportと各四呼出名の変更だけで、UI–SPECの横断呼出し・取得・診断の位置は不変。独立レビューの結果は確定後に記録する。

変更分類は既存判断・公開元の責務移管。基準はRelease／Quality移管と下記全件棚卸しの作業候補である。着手前に親担当と読取り専用確認者が、Architecture局所の意味と取得済み集合の比較、type-only依存、Issue引継ぎ、件数とIdentity比較の差を照合した。規範・認可・保存形式・I/O・適用条件は変更せず、文書・直接伝播確認と独立技術レビューを対象とする。準拠表明・Release判断・全体回帰は対象外。

既存architecture/relations.tsへinspectArchitectureConsistencyとArchitectureConsistencyRequestを置き、cross_model、detail_map_coverage、readiness、registry_coverage、component_coverage、relations、detail_coverage、inputsの八kindを移管した。旧Semanticの対応する八case・型枝・局所四Helperと二入力型は撤去し、転送Wrapper・新File・Registryは作らない。Architectureモデルへの逆方向参照はimport typeだけとする。

基準版のCapability対応: 局所Issueの継承・同kind重複抑止はcross_model／detail_map_coverage／readiness、出現列と双方向閉包はregistry／component／relations、領域→関係→Ready時Covered所有者の順はdetail_coverage、view別件数→Directory exact集合はinputsへ同じ実装で対応付けた。Checkerの既存read・lstat・短絡位置を保ち、取得済み値から実在の再観測や全品質Passを主張しない。

Architecture専用の件数／Directory反証試験一件は、assertionを削らずSemanticからArchitecture試験へ移した。Root・旧分岐なし・逆依存なし・未知kind拒否と既存診断変換を追従する。Rootは212項目（値93・型119）、Semantic残存は29kind（工程移管候補19／Semantic維持10）。下記210項目・37kindの表は移管前の全件調査断面として保持し、今回の追加二公開はArchitectureの完成比較とその入力契約である。限定回帰・独立レビューの結果は確定後に追記する。全体回帰・実AI・Docker・過去保持物は操作しない。

<a id="document-public-inventory"></a>
#### 残るRelationと公開物の全件棚卸し（当時の記録） — 2026-11-16

Architecture移管の独立レビューでは判定・依存・Consumer接続の退行指摘はなく、新規未知kind試験の個別HeaderにLocal Itemの追跡IDが欠ける一点を是正した。@trace RCM-UT-002の記載だけを追加し、Architecture15試験・当該FileのBiome・diff確認が成功した。是正と記録の読取り専用再確認で、残る必須指摘は0件となった。確認者は試験を実行しておらず、実装や試験本文は変更していない。

直前のArchitecture移管の限定検証結果: Architecture・Semantic・Root・診断変換53試験と、Architecture結合六件・公開元／台帳／依存／Global Graph四件の計10試験が成功した。後者は今回専用のRepository-local試験領域で実行し、終了後の不存在を確認した。関連六Packageと配布入口の型検査、変更25 TSのBiomeとdiff確認も成功した。移管前の八caseと四Helper・二型は空白を除く本文の一致を確認し、判定追加・削除はない。独立レビュー結果は後続の確定記録で区別する。

文書追従後の読取り専用独立再レビューは必須是正指摘0件。確認者は試験を再実行していない。今回の完了範囲は棚卸しと方針の対応付けであり、次の実装は工程Owner移管を先行し、公開削減は完成操作への統合単位で進める。

調査結果: 規則Owner案は37kindすべてを対応付け、工程移管候補27／Semantic維持10とした。公開210項目は宣言元・分類・本番直参照・維持理由・統合候補を全数記録した。親担当の一回限りの対応表照合で、Root210名と37caseに重複・欠落がないことを確認し、既存のRoot固定集合・公開元・Global Symbol Graphの限定三試験も成功した。照合用処理をChecker・新規Script・新しい規約へ追加していない。独立技術レビューではSource変更を求める指摘はなく、URI参照受付の公開理由一行を正しい値契約へ追従した。これは調査記録の整合確認であり、27判定の移管成立や公開最小化完了ではない。全体回帰・実AI・Docker・過去保持物は操作していない。

対象はedd4d8bfa後続のRelease／Quality移管済み作業候補。変更分類は責務・公開契約の調査記録であり、この棚卸しでは製品Source・公開IF・保存形式・検査条件を変更しない。親担当は宣言・全Root利用側・既存の採用理由・試験を照合し、読取り専用の専門確認者と独立した完成契約／工程の規則／内部実現手段の区別を照合した。文書・直接伝播と独立技術レビューを対象とし、規範・Authority・実行保証を変えないため準拠監査・全体回帰は追加しない。実AI・Docker・過去保持物は操作しない。

母集団はRoot明示公開210項目（値92・型118）とSemanticの残る37kind。40_Developと配布template/toolsの実装・Script・試験について、Rootへのnamed import／export、namespace参照、深いPathのOwner試験を区別した。表の参照は本番・ScriptのRoot直接参照先であり、型の間接参照、Owner内部の使用、Reflection型試験を本番利用件数へ混ぜない。型の直接importがないことを、公開入力／戻り値のモデルが不要という根拠にはしない。全ての動的到達経路や外部利用者の不存在を証明する棚卸しではない。

##### 残る37判定の規則Owner・利用側

全37kindにChecker本番の呼出しがある。現配置は全てsemantic/relations.tsであり、下表の「移管候補」は移管済みを意味しない。期待集合が上位の観測から渡されることだけでSemanticへ残さず、違反を決める規則が一工程に属するか、複数工程の正式な対応を比較するかで分ける。

| kind | 規則Owner案／処置 | 本番利用側（Checker repository配下） | 規則と保持する境界 |
|---|---|---|---|
| `project_context_identity` | Semantic維持 | `project-context.ts` | Contextと別モデルのManifestのIdentity照合。同じ取得のschema・三Identity。局所partialとManifest不一致を混同しない |
| `artifact_relations` | Semantic維持 | `quality.ts` | 複数成果物のGraph・重複・参照比較。部分Graph・Issue順・入力不変 |
| `architecture_cross_model` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `architecture_detail_map_coverage` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `quality_local_item_relations` | Semantic維持 | `quality.ts` | Architecture Detail実体とQuality Local Item・段階・境界の対応。取得済みの単位・必要段階・境界を別々に保持 |
| `quality_detail_coverage` | Semantic維持 | `quality.ts` | Quality統合が宣言したDetail参照とArchitecture実体集合の対応。局所Issue抽出と追加被覆診断の順・部分モデル |
| `architecture_readiness` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `architecture_registry_coverage` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `architecture_component_coverage` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `architecture_relations` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `architecture_detail_coverage` | architectureへ移管候補 | `architecture.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ui_analysis_coverage` | uiへ移管候補 | `ui.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ui_index_coverage` | uiへ移管候補 | `ui.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ui_relations` | uiへ移管候補 | `ui.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `spec_analysis_coverage` | specへ移管候補 | `spec.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `spec_definition_coverage` | specへ移管候補 | `spec.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `spec_coverage` | specへ移管候補 | `spec.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ui_detail_coverage` | uiへ移管候補 | `ui.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `spec_detail_coverage` | specへ移管候補 | `spec.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ux_projection` | uxへ移管候補 | `discovery-ux.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ux_formal_input` | uxへ移管候補 | `discovery-ux.ts` | UXが受け入れるREQ正式入力と上位の六観測事実の照合。定義有無・同一REQ・Source Analysis混入・危険targetを別々に保持 |
| `ux_analysis_registration` | uxへ移管候補 | `discovery-ux.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ux_relations` | uxへ移管候補 | `discovery-ux.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ia_analysis_coverage` | iaへ移管候補 | `ia.ts` | UX定義集合ごとにIA分析があるというIAの被覆規則。期待集合=上位のuxIds。部分観測を全実在証明にしない |
| `ia_index_coverage` | iaへ移管候補 | `ia.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ia_projection` | iaへ移管候補 | `ia.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ia_definition` | iaへ移管候補 | `ia.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `ia_relations` | iaへ移管候補 | `ia.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `change_navigation` | changeへ移管候補 | `work-lifecycle.ts` | 当該工程の規則。上位の観測集合は取得済みの期待値であり、他工程の本文意味を再解釈しない。取得位置・期待集合・局所Issue・短絡・重複/後勝ち・診断順を維持 |
| `discovery_identity_links` | discoveryへ移管候補 | `document.ts` | REQ表示参照をEXP分析へ結合しないDiscoveryの参照規則。全Markdownの取得済みIdentity/Linkを対象とする。REQ文書だけへ狭めない |
| `identity_ownership` | Semantic維持 | `document.ts` | 複数文書・複数工程の安定ID所有の一意性。順序・重複ごとの診断と出典を保持 |
| `ui_spec` | Semantic維持 | `spec.ts` | UI・SPEC両定義と登録表の正式対応。重複→双方向閉包の順 |
| `ui_spec_details` | Semantic維持 | `spec.ts` | Screen・両Detail台帳・SPEC定義の対応。後勝ち・重複・件数・旧包括診断 |
| `ui_spec_downstream` | Semantic維持 | `spec.ts` | UI/SPECからArchitecture/Qualityへの担当・下流閉包。Single/Shared/Joint・別観測・Owner差を保持 |
| `ui_spec_evidence` | Semantic維持 | `spec.ts` | UI/SPECの対応Evidence・改訂と指紋。八観点短絡・理由順・同改訂相関 |
| `architecture_inputs` | architectureへ移管候補 | `architecture.ts` | UI/SPECごとのArchitecture分析被覆と分析Directory閉包。分析件数→実Directory集合の旧二条件。ID一致の強化や補完はしない |
| `quality_architecture_models` | Semantic維持 | `quality.ts` | Quality参照とArchitectureが所有する固定五文書の対応。Pathのjoin/resolve基点と同数差替え拒否 |

候補はArchitecture 8、UI 4、SPEC 4、UX 4、IA 5、Change 1、Discoveryの参照規則1の計27。Semantic維持は10。これは次の実装順を決める分類であり、27本の新しい公開関数・Source・Dispatcherを要求するものではない。工程ごとの既存の完成Parse／比較へ統合できるかを先に確認し、別read・短絡・診断順・入力不正と観測不能を保持してから段階移管する。

##### 公開を維持する独立契約と本番接続の区別

Rootから本番・Scriptへの直接参照がない七値は次のとおり。最初の五値は既存の採用済み純粋契約であり、未接続を理由に能力を退役させない。後の二値も値受付とFilesystem観測の境界が異なる。外部本番直参照がないことと、契約未成立／処理未使用を混同しない。

| 値 | 維持理由・現在の範囲 | 既存の確認先 |
|---|---|---|
| `applyProjectOperationCandidateDecision` | 候補の明示判断を純粋に評価する採用済み契約。正本Writerへの接続は未実施 | `document-model/tests/integration/candidate-adoption.contract.test.ts` |
| `projectProjectOperationSources` | 不完全・非開示のSourceを保持する純粋投影の採用済み契約。本番未接続 | `document-model/tests/integration/project-projection.contract.test.ts` |
| `fixQualityCandidate` | 品質候補の固定を表す採用済み純粋契約。本番Gate/Release許可とは別 | `document-model/tests/system/quality-change-control.contract.test.ts` |
| `integrateQualityGate` | 固定改訂と必須確認の統合を表す採用済み純粋契約。本番未接続 | `document-model/tests/system/quality-change-control.contract.test.ts` |
| `reenterQualityReview` | 是正後の再入場を表す採用済み純粋契約。実検証の自動実行はしない | `document-model/tests/system/quality-change-control.contract.test.ts` |
| `discoverRealitySymbols` | 観測済みSnapshotの純粋な集合受付。本番はobserveRealitySymbolRepository経由 | `document-model/tests/unit/artifact/result.contract.test.ts・public-boundary.contract.test.ts` |
| `parseRealitySymbolManifest` | 一文書一ParseのManifest独立受付。本番は観測操作内部から使用 | `document-model/tests/unit/public-boundary.contract.test.ts・checker/tests/unit/repository/reality.contract.test.ts` |

##### 完成操作への統合を先に検討する候補

| 優先 | 公開物 | 必要な是正／停止条件 |
|---|---|---|
| P1 | `createFilesystemSemanticBundlePublisher` | 完成出版がRepository Capabilityから既存Storeへ接続すればFactoryを内部化できる。Path・原子的置換・失敗分類・故障注入を維持 |
| P1 | `SemanticBundlePublisher` | 現在は公開出版関数の引数・Factory戻り値。完成出版へ統合するまでは単独で隠さない |
| P2 | `inspectRealityTestCatalog` | Reality登録読取りの完成操作へ閉じてから内部化を検討。全Schema版readTestCatalogへの置換は禁止 |
| P3 | `parseMarkdownLinkReference` | 全raw参照の取得元・URI一回Decode・失敗保持・固定履歴解決を対応付けてから内部化可否を判断 |
| P3 | `MarkdownLinkReference` | 上記の公開入力受付の結果型。関数だけ/型だけを先行撤去しない |
| P4 | `TopicMeetingRepository` | 公開createTopic/MeetingOperationsの注入Overload用。上位はRoot版を使うが、Owner試験・戻り値参照とOverloadを整理するまでは維持 |

P1が最小の優先実装候補である。Checker CLIはpublishSemanticCoverageのためだけにPublisherを構築しており、完成出版が明示Repository Capabilityから既存Storeへ接続すれば、FactoryとPort型をRootから外せる。これは単純なexport削除ではなく、利用側の組立てを完成操作へ戻す変更として扱う。原子的置換・Path境界・一次失敗・結果不明・対象外保全・故障注入の既存Ownerと試験を維持するまで旧契約を撤去しない。

P2は限定三field／Path重複のReality受付であり、readTestCatalogの全Schema照合・Repository走査へ置換しない。P3は取得済みArtifactだけでなく、現在参照・固定履歴のraw文字列と一回Decode／失敗保持を全件対応付けるまで残す。P4は現在の公開Overloadと操作型から参照されるため、型だけを隠さない。Repository Observation Portとその生成はAM・Checker・Scriptの独立した内容観測に使われるため現状維持とし、AMを既存Context読取りへ統合する場合も、例外・拒否・Root再確認・観測回数の検証を別に必要とする。

##### 公開210項目の分類と根拠

分類は、モデル・型／値契約118、完成操作86、独立入力受付4、内部実現手段2。型宣言の数は118だが、この分類の「モデル・型／値契約118」は117型とtestLevels定数であり、内部実現手段2のうち一つがSemanticBundlePublisher型である。分類の数とTypeScriptの値／型の数を混同しない。

以下は基準 `069dd1fef` の調査時点における宣言元・利用先・公開理由・処置の記録であり、現行Sourceの一覧ではない。現在の配置は[Document Modelの設計](../../../06_Architecture/Details/document-model/01_Architecture.md)、実装の `index.ts` と公開契約試験を参照する。候補六項目は「完成操作への統合後に内部化を検討」の意味である。取得済み入力から結果を返す純粋契約の成立と、正本保存・実観測・本番Gateの接続も区別する。

| 公開名 | 分類（値／型） | 調査時の宣言元（src配下） | 調査時の本番Root直接参照・理由 | 処置 |
|---|---|---|---|---|
| `federateTopicMeetingRelations` | 完成操作（値） | `activity/federate-relations.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/topic-meeting/access-resolver.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingRelationSource` | モデル・型／値契約（型） | `activity/federate-relations.ts` | 本番Root直参照なし。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `readTopicMeetingList` | 完成操作（値） | `activity/operations.ts` | `mcp-server/src/tools/topic-meeting.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingListReadResult` | モデル・型／値契約（型） | `activity/operations.ts` | 本番Root直参照なし。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `MeetingOutcomeCommandResult` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `ProjectOperationRecord` | モデル・型／値契約（型） | `activity/types.ts` | 本番Root直参照なし。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `ProjectOperationRecordKind` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`<br>`workbench-server/src/shared/view/types.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingAccess` | モデル・型／値契約（型） | `activity/types.ts` | `mcp-server/src/request/server.ts`<br>`mcp-server/src/tools/topic-meeting.ts`<br>`workbench-server/src/server/routes/record.ts`<br>`workbench-server/src/server/routes/repository-view.ts`<br>`workbench-server/src/server/topic-meeting/access-resolver.ts`<br>`workbench-server/src/server/topic-meeting/action.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingDocument` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`<br>`workbench-server/src/shared/view/types.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingListQuery` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/presentation/project.ts`<br>`workbench-server/src/server/presentation/record.ts`<br>`workbench-server/src/shared/view/types.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingPage` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/presentation/project.ts`<br>`workbench-server/src/server/presentation/record.ts`<br>`workbench-server/src/shared/view/types.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingRelation` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`<br>`workbench-server/src/shared/view/types.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicMeetingRepository` | モデル・型／値契約（型） | `activity/types.ts` | 本番Root直参照なし。注入Overloadと公開操作の型参照を構成する技術契約 | 統合後内部化候補 P4 |
| `TopicMeetingWriteResult` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `TopicPromotionCommandResult` | モデル・型／値契約（型） | `activity/types.ts` | `workbench-server/src/server/topic-meeting/action.ts`。Topic/Meetingの記録・照会・更新・関係の公開入力/結果 | 維持 |
| `ArchitectureDetailMapModel` | モデル・型／値契約（型） | `architecture/details.ts` | 本番Root直参照なし。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `ArchitectureDetailModel` | モデル・型／値契約（型） | `architecture/details.ts` | 本番Root直参照なし。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `parseArchitectureDetail` | 完成操作（値） | `architecture/details.ts` | `checker/src/repository/architecture.ts`<br>`checker/src/repository/quality.ts`<br>`checker/src/repository/semantic.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseArchitectureDetailMap` | 完成操作（値） | `architecture/details.ts` | `checker/src/repository/architecture.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `ArchitectureAnalysis` | モデル・型／値契約（型） | `architecture/validation.ts` | `checker/src/repository/architecture.ts`。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `ArchitectureCrossModel` | モデル・型／値契約（型） | `architecture/validation.ts` | 本番Root直参照なし。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `ArchitectureDefinition` | モデル・型／値契約（型） | `architecture/validation.ts` | 本番Root直参照なし。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `ArchitectureIndex` | モデル・型／値契約（型） | `architecture/validation.ts` | 本番Root直参照なし。Architecture文書の内容・出典・部分結果を受け渡すモデル | 維持 |
| `parseArchitectureAnalysis` | 完成操作（値） | `architecture/validation.ts` | `checker/src/repository/architecture.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseArchitectureCrossModel` | 完成操作（値） | `architecture/validation.ts` | `checker/src/repository/architecture.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseArchitectureDefinition` | 完成操作（値） | `architecture/validation.ts` | `checker/src/repository/architecture.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseArchitectureIndex` | 完成操作（値） | `architecture/validation.ts` | `checker/src/repository/architecture.ts`<br>`checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseMarkdownLinkReference` | 独立入力受付（値） | `artifact/links.ts` | `checker/src/repository/references.ts`。raw参照をtarget／anchorへ分離し、一回URI Decodeした値とDecode失敗を返す独立受付 | 統合後内部化候補 P3 |
| `parseArtifact` | 完成操作（値） | `artifact/parse-markdown.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/quality.ts`<br>`checker/src/repository/references.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `ArtifactModel` | モデル・型／値契約（型） | `artifact/types.ts` | 本番Root直参照なし。成果物の内容・出典・局所診断の共通モデル | 維持 |
| `ArtifactSource` | モデル・型／値契約（型） | `artifact/types.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/quality.ts`。読取り済み本文・相対出典の入力契約 | 維持 |
| `DocumentIssue` | モデル・型／値契約（型） | `artifact/types.ts` | `checker/src/report/convert.ts`<br>`checker/src/report/document.ts`<br>`checker/src/report/quality.ts`<br>`checker/src/report/reality.ts`<br>`checker/src/report/semantic.ts`。Parser・評価が返す中立診断の公開契約 | 維持 |
| `MarkdownLinkReference` | モデル・型／値契約（型） | `artifact/types.ts` | 本番Root直参照なし。一回Decode後のtarget/anchorとDecode失敗を保持する入力受付モデル | 統合後内部化候補 P3 |
| `ParseResult` | モデル・型／値契約（型） | `artifact/types.ts` | 本番Root直参照なし。complete/partial/invalidと部分モデルを区別する共通受付結果 | 維持 |
| `SourceLocation` | モデル・型／値契約（型） | `artifact/types.ts` | 本番Root直参照なし。診断と文書内容を結合する相対出典 | 維持 |
| `parseChangeDocument` | 完成操作（値） | `change/parse.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/work-lifecycle.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseChangeIndex` | 完成操作（値） | `change/parse.ts` | `checker/src/repository/work-lifecycle.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `ChangeDocument` | モデル・型／値契約（型） | `change/types.ts` | 本番Root直参照なし。Change本文・案内の内容モデル | 維持 |
| `ChangeIndex` | モデル・型／値契約（型） | `change/types.ts` | 本番Root直参照なし。Change本文・案内の内容モデル | 維持 |
| `parseDiscoveryAnalysis` | 完成操作（値） | `discovery/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseDiscoveryDefinition` | 完成操作（値） | `discovery/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseDiscoveryIndex` | 完成操作（値） | `discovery/parse.ts` | `checker/src/repository/discovery-ux.ts`<br>`checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `DiscoveryAnalysis` | モデル・型／値契約（型） | `discovery/types.ts` | 本番Root直参照なし。Discoveryの分析・定義・台帳モデル | 維持 |
| `DiscoveryDefinition` | モデル・型／値契約（型） | `discovery/types.ts` | 本番Root直参照なし。Discoveryの分析・定義・台帳モデル | 維持 |
| `DiscoveryIndex` | モデル・型／値契約（型） | `discovery/types.ts` | 本番Root直参照なし。Discoveryの分析・定義・台帳モデル | 維持 |
| `parseIaAnalysis` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseIaDefinition` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseIaIndex` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseIaObjectRelation` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseIaStateVisibility` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseIaStructureNavigation` | 完成操作（値） | `ia/parse.ts` | `checker/src/repository/ia.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `IaAnalysisModel` | モデル・型／値契約（型） | `ia/types.ts` | `checker/src/repository/ia.ts`。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `IaDefinitionModel` | モデル・型／値契約（型） | `ia/types.ts` | `checker/src/repository/ia.ts`。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `IaIndexModel` | モデル・型／値契約（型） | `ia/types.ts` | 本番Root直参照なし。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `IaObjectRelation` | モデル・型／値契約（型） | `ia/types.ts` | 本番Root直参照なし。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `IaStateVisibility` | モデル・型／値契約（型） | `ia/types.ts` | 本番Root直参照なし。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `IaStructureNavigation` | モデル・型／値契約（型） | `ia/types.ts` | 本番Root直参照なし。IAの文書ごとの内容・参照・状態モデル | 維持 |
| `createMeetingOperations` | 完成操作（値） | `meeting/create-operations.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/start.ts`<br>`workbench-server/src/server/topic-meeting/access-resolver.ts`<br>`template/tools/crdd-mcp-server.ts`。Meetingの記録と状態・完成操作の契約 | 維持 |
| `parseMeetingMarkdown` | 完成操作（値） | `meeting/markdown.ts` | `mcp-server/src/tools/topic-meeting.ts`<br>`workbench-server/src/server/project/surface.ts`<br>`workbench-server/src/server/routes/record.ts`<br>`workbench-server/src/server/topic-meeting/action.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `MeetingOperations` | モデル・型／値契約（型） | `meeting/types.ts` | 本番Root直参照なし。Meetingの記録と状態・完成操作の契約 | 維持 |
| `MeetingRecord` | モデル・型／値契約（型） | `meeting/types.ts` | `workbench-server/src/server/project/surface.ts`。Meetingの記録と状態・完成操作の契約 | 維持 |
| `MeetingState` | モデル・型／値契約（型） | `meeting/types.ts` | 本番Root直参照なし。Meetingの記録と状態・完成操作の契約 | 維持 |
| `applyProjectOperationCandidateDecision` | 完成操作（値） | `project-context/candidate-decision.ts` | 本番Root直参照なし。候補の明示判断を純粋に評価する採用済み契約。正本Writerへの接続は未実施 | 維持 |
| `parseRepositoryProjectContextMarkdown` | 完成操作（値） | `project-context/parse-context.ts` | `access-management/src/repository/register.ts`<br>`checker/src/repository/project-context.ts`<br>`coordinator/src/cli/request.ts`<br>`workbench-server/src/server/project/surface.ts`<br>`template/tools/crdd-mcp-server.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseRepositoryQualityProjectionMarkdown` | 完成操作（値） | `project-context/parse-quality.ts` | `workbench-server/src/server/project/surface.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseRepositoryReleaseProjectionMarkdown` | 完成操作（値） | `project-context/parse-release.ts` | `workbench-server/src/server/project/surface.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `createPortfolioProjection` | 完成操作（値） | `project-context/portfolio.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/project/access-reader.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `FederatedProjectProjection` | モデル・型／値契約（型） | `project-context/portfolio.ts` | `workbench-server/src/shared/view/validation.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `FederatedProjectSource` | モデル・型／値契約（型） | `project-context/portfolio.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `PortfolioProjection` | モデル・型／値契約（型） | `project-context/portfolio.ts` | `mcp-server/src/tools/project-context.ts`<br>`workbench-server/src/server/presentation/portfolio.ts`<br>`workbench-server/src/server/presentation/project.ts`<br>`workbench-server/src/server/project/access-reader.ts`<br>`workbench-server/src/server/routes/repository-view.ts`<br>`workbench-server/src/server/routes/shared-view.ts`<br>`workbench-server/src/server/start.ts`<br>`workbench-server/src/shared/view/types.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `ProjectContextSource` | モデル・型／値契約（型） | `project-context/portfolio.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/project/access-reader.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `readRepositoryProjectContext` | 完成操作（値） | `project-context/read-context.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/project/access-reader.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `projectProjectOperationSources` | 完成操作（値） | `project-context/source-projection.ts` | 本番Root直参照なし。不完全・非開示のSourceを保持する純粋投影の採用済み契約。本番未接続 | 維持 |
| `ProjectOperationCandidate` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `ProjectOperationCandidateDecision` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `ProjectOperationCandidateDecisionResult` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `ProjectOperationProjection` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `ProjectOperationSource` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `RepositoryProjectContext` | モデル・型／値契約（型） | `project-context/types.ts` | `workbench-server/src/server/activity/observe.ts`<br>`workbench-server/src/server/project/surface.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `RepositoryProjectContextReadResult` | モデル・型／値契約（型） | `project-context/types.ts` | 本番Root直参照なし。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `RepositoryQualityProjection` | モデル・型／値契約（型） | `project-context/types.ts` | `workbench-server/src/server/quality/types.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `RepositoryReleaseProjection` | モデル・型／値契約（型） | `project-context/types.ts` | `workbench-server/src/server/project-plan/types.ts`。Contextの内容・Source・投影・候補判断の公開契約 | 維持 |
| `inspectQualityAnalysis` | 完成操作（値） | `quality/analysis.ts` | `checker/src/repository/quality.ts`。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `inspectQualityConsistency` | 完成操作（値） | `quality/analysis.ts` | `checker/src/repository/quality.ts`。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `parseQualityAnalysis` | 完成操作（値） | `quality/analysis.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityDetailAnalysis` | 完成操作（値） | `quality/analysis.ts` | `checker/src/repository/quality.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityIntegration` | 完成操作（値） | `quality/analysis.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `QualityAnalysis` | モデル・型／値契約（型） | `quality/analysis.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityConsistencyRequest` | モデル・型／値契約（型） | `quality/analysis.ts` | 本番Root直参照なし。Quality内部五条件の閉じた受付。取得済み範囲を実在保証へ拡張しない | 維持 |
| `QualityDetailAnalysis` | モデル・型／値契約（型） | `quality/analysis.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityIntegration` | モデル・型／値契約（型） | `quality/analysis.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `inspectQualityLocalItemOwnership` | 完成操作（値） | `quality/definition.ts` | `checker/src/repository/quality.ts`。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `parseQualityDefinition` | 完成操作（値） | `quality/definition.ts` | `checker/src/repository/quality.ts`<br>`checker/src/repository/semantic.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `QualityDefinitionModel` | モデル・型／値契約（型） | `quality/definition.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityLocalItemOwnershipModel` | モデル・型／値契約（型） | `quality/definition.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `parseQualityCenter` | 完成操作（値） | `quality/readiness.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityRealityAudit` | 完成操作（値） | `quality/readiness.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityStrategy` | 完成操作（値） | `quality/readiness.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityVerificationDesign` | 完成操作（値） | `quality/readiness.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseQualityVerificationResult` | 完成操作（値） | `quality/readiness.ts` | `checker/src/repository/quality.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `QualityCenter` | モデル・型／値契約（型） | `quality/readiness.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityRealityAudit` | モデル・型／値契約（型） | `quality/readiness.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityStrategy` | モデル・型／値契約（型） | `quality/readiness.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityVerificationDesign` | モデル・型／値契約（型） | `quality/readiness.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityVerificationResult` | モデル・型／値契約（型） | `quality/readiness.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `inspectQualityVerification` | 完成操作（値） | `quality/verification-tables.ts` | `checker/src/repository/document.ts`。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `QualityVerificationEvaluation` | モデル・型／値契約（型） | `quality/verification-tables.ts` | 本番Root直参照なし。Quality文書・取得済み比較・所有・評価の公開契約 | 維持 |
| `FixedQualityCandidate` | モデル・型／値契約（型） | `quality-change-control/gate.ts` | 本番Root直参照なし。固定品質候補・必須確認・是正再入場の採用済み純粋契約 | 維持 |
| `fixQualityCandidate` | 完成操作（値） | `quality-change-control/gate.ts` | 本番Root直参照なし。品質候補の固定を表す採用済み純粋契約。本番Gate/Release許可とは別 | 維持 |
| `IntegratedQualityGate` | モデル・型／値契約（型） | `quality-change-control/gate.ts` | 本番Root直参照なし。固定品質候補・必須確認・是正再入場の採用済み純粋契約 | 維持 |
| `integrateQualityGate` | 完成操作（値） | `quality-change-control/gate.ts` | 本番Root直参照なし。固定改訂と必須確認の統合を表す採用済み純粋契約。本番未接続 | 維持 |
| `QualityCheckResult` | モデル・型／値契約（型） | `quality-change-control/gate.ts` | 本番Root直参照なし。固定品質候補・必須確認・是正再入場の採用済み純粋契約 | 維持 |
| `QualityCheckStatus` | モデル・型／値契約（型） | `quality-change-control/gate.ts` | 本番Root直参照なし。固定品質候補・必須確認・是正再入場の採用済み純粋契約 | 維持 |
| `reenterQualityReview` | 完成操作（値） | `quality-change-control/gate.ts` | 本番Root直参照なし。是正後の再入場を表す採用済み純粋契約。実検証の自動実行はしない | 維持 |
| `inspectRealityTestCatalog` | 独立入力受付（値） | `reality-traceability/catalog.ts` | `checker/src/repository/reality.ts`。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 統合後内部化候補 P2 |
| `discoverRealitySymbols` | 独立入力受付（値） | `reality-traceability/discover.ts` | 本番Root直参照なし。観測済みSnapshotの純粋な集合受付。本番はobserveRealitySymbolRepository経由 | 維持 |
| `RealitySymbolDiscoveryRequest` | モデル・型／値契約（型） | `reality-traceability/discover.ts` | 本番Root直参照なし。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `RealitySymbolDiscoveryResult` | モデル・型／値契約（型） | `reality-traceability/discover.ts` | 本番Root直参照なし。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `RealitySymbolDiscoverySource` | モデル・型／値契約（型） | `reality-traceability/discover.ts` | 本番Root直参照なし。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `createRealitySymbolGraph` | 完成操作（値） | `reality-traceability/graph.ts` | `checker/src/repository/reality.ts`。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `RealitySymbolGraph` | モデル・型／値契約（型） | `reality-traceability/graph.ts` | `checker/src/repository/reality.ts`。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `LoadedRealitySymbolManifest` | モデル・型／値契約（型） | `reality-traceability/manifest.ts` | `checker/src/repository/reality.ts`<br>`checker/src/repository/semantic.ts`。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `RealitySymbolManifest` | モデル・型／値契約（型） | `reality-traceability/manifest.ts` | 本番Root直参照なし。Manifest/観測Snapshot/Graphと独立受付の入力・結果 | 維持 |
| `parseRealitySymbolManifest` | 独立入力受付（値） | `reality-traceability/manifest.ts` | 本番Root直参照なし。一文書一ParseのManifest独立受付。本番は観測操作内部から使用 | 維持 |
| `parseCanonicalDocument` | 完成操作（値） | `release/parse.ts` | `checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseChangelog` | 完成操作（値） | `release/parse.ts` | `checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseReadme` | 完成操作（値） | `release/parse.ts` | `checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `CanonicalDocument` | モデル・型／値契約（型） | `release/types.ts` | 本番Root直参照なし。Release文書と版・Baseline・Stableの公開モデル | 維持 |
| `Changelog` | モデル・型／値契約（型） | `release/types.ts` | 本番Root直参照なし。Release文書と版・Baseline・Stableの公開モデル | 維持 |
| `Readme` | モデル・型／値契約（型） | `release/types.ts` | 本番Root直参照なし。Release文書と版・Baseline・Stableの公開モデル | 維持 |
| `ReleaseConsistencyRequest` | モデル・型／値契約（型） | `release/types.ts` | 本番Root直参照なし。Releaseの四条件と未確認Tagを区別する閉じた受付 | 維持 |
| `inspectReleaseConsistency` | 完成操作（値） | `release/validation.ts` | `checker/src/repository/document.ts`。Release文書と版・Baseline・Stableの公開モデル | 維持 |
| `inspectReleaseDocuments` | 完成操作（値） | `release/validation.ts` | `checker/src/repository/document.ts`。Release文書と版・Baseline・Stableの公開モデル | 維持 |
| `createFilesystemRepositoryObservationPort` | 完成操作（値） | `repository/create-observer.ts` | `access-management/src/repository/register.ts`<br>`checker/src/repository/reality.ts`<br>`checker/src/repository/semantic.ts`<br>`coordinator/src/execution/advice.ts`<br>`mcp-server/scripts/verify-task-real-providers.ts`。文書の技術観測と観測不能の公開契約 | 維持 |
| `observeRealitySymbolRepository` | 完成操作（値） | `repository/observe-symbols.ts` | `checker/src/cli/semantic.ts`<br>`checker/src/repository/reality.ts`。文書の技術観測と観測不能の公開契約 | 維持 |
| `RealitySymbolRepositoryObservation` | モデル・型／値契約（型） | `repository/observe-symbols.ts` | 本番Root直参照なし。文書の技術観測と観測不能の公開契約 | 維持 |
| `RepositoryObservationPort` | モデル・型／値契約（型） | `repository/types.ts` | `checker/src/repository/reality.ts`。現在の文書観測の入出力・観測不能を区別する技術契約。Checker本番が直接使用 | 維持 |
| `createSemanticBundle` | 完成操作（値） | `semantic/coverage.ts` | `checker/src/cli/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `createSemanticCoverageGraph` | 完成操作（値） | `semantic/coverage.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `SemanticCoverageBundle` | モデル・型／値契約（型） | `semantic/coverage.ts` | 本番Root直参照なし。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `SemanticCoverageGraph` | モデル・型／値契約（型） | `semantic/coverage.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `compileSemanticIr` | 完成操作（値） | `semantic/ir.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `SemanticIr` | モデル・型／値契約（型） | `semantic/ir.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `PublishSemanticCoverageRequest` | モデル・型／値契約（型） | `semantic/publish.ts` | 本番Root直参照なし。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `PublishSemanticCoverageResult` | モデル・型／値契約（型） | `semantic/publish.ts` | 本番Root直参照なし。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `publishSemanticCoverage` | 完成操作（値） | `semantic/publish.ts` | `checker/src/cli/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `compileQualitySemanticRelations` | 完成操作（値） | `semantic/relations.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `DocumentRelationsRequest` | モデル・型／値契約（型） | `semantic/relations.ts` | `checker/src/repository/spec.ts`。残る37比較の閉じた入力。移管で枝を絞り、unknown/巨大なoptional集合へ置換しない | 維持 |
| `evaluateDefinitionPairEvidence` | 完成操作（値） | `semantic/relations.ts` | `checker/src/repository/spec.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `inspectDocumentRelations` | 完成操作（値） | `semantic/relations.ts` | `checker/src/repository/architecture.ts`<br>`checker/src/repository/discovery-ux.ts`<br>`checker/src/repository/document.ts`<br>`checker/src/repository/ia.ts`<br>`checker/src/repository/project-context.ts`<br>`checker/src/repository/quality.ts`<br>`checker/src/repository/spec.ts`<br>`checker/src/repository/ui.ts`<br>`checker/src/repository/work-lifecycle.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `QualitySemanticRelation` | モデル・型／値契約（型） | `semantic/relations.ts` | `checker/src/repository/semantic.ts`。意味IR・Coverage・工程間比較の入力・結果 | 維持 |
| `parseSpecAnalysis` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecBehavior` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecDefinition` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecDefinitionCorrespondence` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecDetailCorrespondence` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecDetailIndex` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseSpecIndex` | 完成操作（値） | `spec/parse.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/spec.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `SpecAnalysis` | モデル・型／値契約（型） | `spec/types.ts` | 本番Root直参照なし。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecBehavior` | モデル・型／値契約（型） | `spec/types.ts` | 本番Root直参照なし。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecDefinition` | モデル・型／値契約（型） | `spec/types.ts` | `checker/src/repository/spec.ts`。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecDefinitionCorrespondence` | モデル・型／値契約（型） | `spec/types.ts` | 本番Root直参照なし。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecDetailCorrespondence` | モデル・型／値契約（型） | `spec/types.ts` | 本番Root直参照なし。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecDetailIndex` | モデル・型／値契約（型） | `spec/types.ts` | `checker/src/repository/spec.ts`。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `SpecIndex` | モデル・型／値契約（型） | `spec/types.ts` | 本番Root直参照なし。SPEC文書ごとの内容・出典・対応根拠モデル | 維持 |
| `createFilesystemSemanticBundlePublisher` | 内部実現手段（値） | `storage/semantic-store.ts` | `checker/src/cli/semantic.ts`。指定された保存先への出版契約 | 統合後内部化候補 P1 |
| `SemanticBundlePublisher` | 内部実現手段（型） | `storage/semantic-store.ts` | 本番Root直参照なし。完成出版を組み立てるための技術Port。単独隠蔽でなく出版操作の統合候補 | 統合後内部化候補 P1 |
| `readTestCatalog` | 完成操作（値） | `test-catalog/inspect.ts` | `checker/src/cli/test-catalog.ts`。試験台帳・段階と完成読取りの契約。試験起動の許可ではない | 維持 |
| `TestCatalog` | モデル・型／値契約（型） | `test-catalog/inspect.ts` | `checker/src/test-catalog/selection.ts`。試験台帳・段階と完成読取りの契約。試験起動の許可ではない | 維持 |
| `TestCatalogEntry` | モデル・型／値契約（型） | `test-catalog/inspect.ts` | `checker/src/test-catalog/selection.ts`。試験台帳・段階と完成読取りの契約。試験起動の許可ではない | 維持 |
| `TestCatalogReadResult` | モデル・型／値契約（型） | `test-catalog/inspect.ts` | 本番Root直参照なし。試験台帳・段階と完成読取りの契約。試験起動の許可ではない | 維持 |
| `TestLevel` | モデル・型／値契約（型） | `test-catalog/inspect.ts` | `checker/src/cli/test-catalog.ts`<br>`checker/src/test-catalog/selection.ts`。試験台帳・段階と完成読取りの契約。試験起動の許可ではない | 維持 |
| `testLevels` | モデル・型／値契約（値） | `test-catalog/inspect.ts` | `checker/src/cli/test-catalog.ts`。CLIと回帰選定が同じ段階値を使用。実行許可を生成しない | 維持 |
| `createTopicOperations` | 完成操作（値） | `topic/create-operations.ts` | `mcp-server/src/request/authentication.ts`<br>`workbench-server/src/server/start.ts`<br>`workbench-server/src/server/topic-meeting/access-resolver.ts`<br>`template/tools/crdd-mcp-server.ts`。Topicの記録と状態・完成操作の契約 | 維持 |
| `parseTopicMarkdown` | 完成操作（値） | `topic/markdown.ts` | `mcp-server/src/tools/topic-meeting.ts`<br>`workbench-server/src/server/project/surface.ts`<br>`workbench-server/src/server/routes/record.ts`<br>`workbench-server/src/server/topic-meeting/action.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `TopicOperations` | モデル・型／値契約（型） | `topic/types.ts` | 本番Root直参照なし。Topicの記録と状態・完成操作の契約 | 維持 |
| `TopicRecord` | モデル・型／値契約（型） | `topic/types.ts` | `workbench-server/src/server/project/surface.ts`。Topicの記録と状態・完成操作の契約 | 維持 |
| `TopicState` | モデル・型／値契約（型） | `topic/types.ts` | 本番Root直参照なし。Topicの記録と状態・完成操作の契約 | 維持 |
| `parseUiAnalysis` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiArea` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiComponent` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiDefinition` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/spec.ts`<br>`checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiDetailIndex` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/spec.ts`<br>`checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiHandoff` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiIndex` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/document.ts`<br>`checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiScreen` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/spec.ts`<br>`checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUiVisualBaseline` | 完成操作（値） | `ui/parse.ts` | `checker/src/repository/ui.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `UiAnalysis` | モデル・型／値契約（型） | `ui/types.ts` | `checker/src/repository/ui.ts`。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiArea` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiComponent` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiDefinition` | モデル・型／値契約（型） | `ui/types.ts` | `checker/src/repository/spec.ts`<br>`checker/src/repository/ui.ts`。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiDetailIndex` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiHandoff` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiIndex` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiScreen` | モデル・型／値契約（型） | `ui/types.ts` | `checker/src/repository/spec.ts`。UI文書ごとの内容・出典・関係モデル | 維持 |
| `UiVisualBaseline` | モデル・型／値契約（型） | `ui/types.ts` | 本番Root直参照なし。UI文書ごとの内容・出典・関係モデル | 維持 |
| `parseUxAnalysis` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxDefinition` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxExperienceMap` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxIndex` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`<br>`checker/src/repository/document.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxPersonas` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxQualityExpectations` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `parseUxServiceBlueprint` | 完成操作（値） | `ux/parse.ts` | `checker/src/repository/discovery-ux.ts`。当該文書の内容モデルと局所Issueを返す一文書一Parse | 維持 |
| `UxAnalysisModel` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxDefinitionModel` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxExperienceMap` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxIndexModel` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxPersonas` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxQualityExpectations` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |
| `UxServiceBlueprint` | モデル・型／値契約（型） | `ux/types.ts` | 本番Root直参照なし。UX文書ごとの内容・出典・正式入力モデル | 維持 |

今回の棚卸しだけで公開数を減らさない。現在、人間による新たな保証変更・リスク受容の判断は必要ない。実装は候補ごとに入力・失敗・取得・保存・取消・利用側と反証を閉じてから行い、未実施の全体回帰や現在の本番未接続を完了へ畳まない。

#### Consumer境界の保証固定とSemantic Owner再評価 — 2026-11-16

Qualityの文書是正後の読取り専用独立再レビューは必須是正指摘0件。親担当の限定57＋6試験、六Packageと配布ひな型の型検査、変更20TSの整形・警告確認、差分確認と、確認者の読取りレビューを区別する。Root210項目・既存の保存形式とConsumer挙動を維持し、次は残るRelationの全件Owner分類と公開物の必要性評価へ進む。全体回帰・実AI・Docker・過去保持物は操作していない。

Qualityの独立技術レビューで必須の実装修正は見つからず、Checker設計の旧quality_design_states呼出し先記載一箇所をQualityの完成入口へ是正した。Release節の完了範囲とQAの比較Owner表現も現行化し、製品Source・試験条件・対象集合・Ready分岐・診断field／順序は追加変更していない。

②Qualityの実装・利用側・試験・台帳・文書を上記Ownerへ追従した。Semanticの旧五case／型／私有本体は残さず、Quality内の完結した目標表試験一件をSemanticからQuality分析試験へ移し、assertionを維持した。純粋判定・Root・Semanticに残す三比較の57試験と、包括的なChecker品質結合・分岐表・台帳の限定六試験が成功した。包括試験一件は既存の反証を同じfixtureへ順次適用してCheckerを繰返し起動するため約74秒を要した。検証内容や製品期限を短縮せず、全体回帰は実行していない。自己生成Rootを回収し、終了後不存在を確認した。

②Qualityの着手前分類は、親担当が実本体・全Consumer・既存反証と照合し、読取り専用確認者と次のOwnerへ合意した。Source新設・Facade・Rule Registryは作らず、既存Sourceへ移す。

| 判定 | 意味Owner・配置 | 理由と保持条件 |
|---|---|---|
| inspectQualityVerification | quality/verification-tables.ts | 算術・是正条件。区分別Issueと合成順、全Markdownへの適用を維持 |
| inspectQualityLocalItemOwnership | quality/definition.ts | Local IDの出現列・先勝ち所有・重複。入力Map非変更 |
| inspectQualityAnalysis | quality/analysis.ts | 分析の重複・被覆と内部閉包。canonicalIdsは上位が取得済みの期待集合であり、全実在証明ではない |
| quality_design_states／quality_reality_state | quality/analysis.ts | Quality文書の状態規則。旧正規化と局所Issue→相関Issueの順を維持 |
| quality_definition_relations／quality_goal_local_relations／quality_goals | quality/analysis.ts | 同じQuality分析・定義・統合の内部閉包・処置。新inspectQualityConsistencyと閉じたQualityConsistencyRequestで直接受付 |
| quality_architecture_models／quality_detail_coverage／quality_local_item_relations | semantic/relations.tsへ維持 | 別工程のArchitecture集合・Detail実体・段階／境界との対応 |
| compileQualitySemanticRelations／evaluateDefinitionPairEvidence | Semanticへ維持 | IR・意味関係・工程間Evidence。Quality名だけを理由に移さない |

旧五kind・私有本体と転送はSemanticから撤去する。QualityからSemanticへの依存を追加せず、別read・後勝ち・短絡・非公開の内部エンジンを維持する。新完成操作一つと型一つが加わりRootは210項目となるが、これを削減目標にしない。検証は既存Quality純粋反証とChecker結合、Semanticに残す三比較へ限定し、全体回帰・実AI・Docker・過去保持物は操作しない。

①Consumer境界と②Release移管の固定候補は、それぞれ読取り専用独立再レビューで必須是正指摘0件。六Packageと配布ひな型の型検査、変更12TSの整形・警告確認、差分検査、最終のRoot・公開元・Global Symbol Graph三試験も成功した。確認者は試験を再実行していない。次はQuality固有評価と残るkindのOwner／Consumer分類、その後に公開物全件の必要性評価を行う。これらの未実施を完了へ畳まない。

Releaseの独立レビューで実装の判定退行は見つからず、文書の旧Semantic Owner説明三段落とRequestの値境界を追従した。raw全文／20行／16行の取得断面、別read、Path条件、Tag未確認null、診断順の説明は維持し、実装・Consumerの条件は追加変更していない。

②Releaseの判定は、同じ既存本体をrelease/validation.tsへ移管した。Stable四kindとinspectReleaseDocumentsをSemanticから撤去し、Checker・既存純粋試験はRootの新完成操作へ直接接続する。独立して取得した値をまとめず、呼出し位置・元の原文条件・Issue順は変更していない。Source新設・転送Wrapper・Registryは追加していない。未知kindはrelease_consistency_kind_invalidで拒否する。Rootは208項目（値91・型117）で、公開元一覧・固定集合・既存Symbolの検証辺を追従した。純粋判定・Root27試験、Stable／Candidate／CHANGELOGと台帳の限定23試験が成功し、自己生成試験領域を回収して不存在を確認した。これをQuality移管・全Semantic整理・公開物全件評価の完了とは扱わない。

①は読取り専用独立レビューで必須是正指摘0件。②の最初はReleaseだけを対象とし、既存の版集合操作とStable四判定をrelease/validation.tsへ戻す。狭いReleaseConsistencyRequestは既存types.tsで定義し、inspectReleaseConsistencyを完成操作としてRootへ直接公開する。旧Semanticの四kind・転送経路は撤去する。完成操作一つと型一つが加わりRootは208項目となるが、数を戻すための抽象化はしない。着手前に独立確認者と、値判定の同一性、別read・16行断面・原文条件・Tag null・Issue順、ReleaseからSemantic／Parseへの逆依存なし、未知kindの拒否を照合した。品質関係はこの固定候補の後に別に判断する。

①の限定10試験が成功した。MCPは両種別×四状態の実受付とProtocol全体・解決／read回数を固定し、AM／WBは完全な同じ内容からChecklist一項目だけ未評価にしたpartialを接続した。Co CLIは実本文・実Parserと有限依存を使用し、partialのID搬送・一回受付・取消解放、構造欠測と読取り故障の受付0を確認した。初回MCP試験の期待値に既存resultType／Server情報が欠けていたため試験だけ追従し、製品応答は変更しなかった。既存の例外・別read／診断順・Catalog早期走査0と同一観測集合の試験も成功した。自己生成Rootは既存Helperで回収して不存在を確認した。

基準版edd4d8bfaの完成受付を維持し、Consumer境界の限定検証、Semanticの判定Owner分類、Release／Quality順の移管、公開物の意味分類の順に進める。公開数を目標にせず、一文書一Parseとモデル型、独立した完成操作を維持する。全体回帰・実AI・Docker・過去保持物の操作は対象外。

最初の変更分類は検証接続の補強で、製品Source・公開API・拒否条件は変更しない。着手前に現行Consumer・Owner設計・既存試験を親担当と読取り専用確認者が照合した。MCPのinvalid／unavailableは内部で区別しつつ、非開示の既存Protocolでは共に-32602とする。cancelledは-32800、resolver例外とlist例外の既存分類は維持する。Project Contextは実ParserのChecklistだけ不備のpartial・非nullモデルをAM／Coordinator CLI／Workbenchへ接続し、Identity不一致・構造欠測・観測不能の拒否を維持する。CLIの有限依存確認を実Task・AIの成立としない。Checkerの別read・診断順とCatalogの同一受付内の観測集合は既存反証を再利用し、キャッシュ・Facade・代替Storeは導入しない。独立技術レビューと文書・直接伝播確認を実施し、規範・準拠基準・Authorityの変更がないため準拠監査と全体回帰は追加しない。現在、人間による追加判断は必要ない。

#### 完成受付への利用側統合

コミット前の読取り専用独立再レビューは必須是正指摘0件。公開元の固定一覧・単独確認と全Package元試験の保持・QA／変更記録の追従を確認した。確認者は試験を再実行しておらず、上記の親担当実測と区別する。統合・Release・全体品質の承認には用いない。

コミット前最終確認（2026-11-16）: 旧入口と削除Sourceの参照走査で、横断公開Module試験の文書モデル用固定一覧に撤去済み九Pathと重複一件が残っていたため除去した。固定集合の比較条件は緩めず、既存の検査関数を使う文書モデル単独の確認を追加し、全Packageの元の確認も維持した。該当確認を含む限定四試験が成功した。Root206項目・台帳Graph・CLI入力拒否・依存の限定七試験、六Packageと配布ひな型の型検査、変更TS全件の整形・警告確認、差分検査も成功した。今回生成した試験領域だけを回収し、不存在を確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

後続是正（2026-11-16）: 下記の既存二試験不整合も対象に追加し、両試験の成功を確認した。QA-000006のHST-UT-001／ERB-UT-024は後段の補足表から正式な4節へ移し、同じ検証義務・Oracle・終了後条件を保持した。旧品質状態Symbolは現在のSemantic実装へ対応付け、撤去済みNative TraceへのSystem試験の辺は除去し、実際に呼ぶScript／Taskの二辺を維持した。Unit試験は現在の試験補助FileとARCH-000004へ接続し、存在しない製品実装の検証と主張しない。Graph試験では正式Local ID、現行Semantic・試験補助への検証辺と旧Symbol不存在を確認する。旧Artifact集合検査の期待値も完成Parseの宣言元へ追従した。

未署名CLIの試験準備は旧domain-modelを除き、現行document-model／execution-model／configuration-modelを同じ粒度で複製する。既存のSource選別、未署名help、負例のexact結果、finallyの対象限定清掃は変更しない。製品Source・公開API・Root／Lock／署名の判定は変更せず、互換処理や新しい仕組みは作らない。変更分類は既存検証接続・台帳配置の是正であり、着手前に実際のimport・宣言元・QA節とSource依存を照合した。独立技術レビューと文書・直接伝播の確認を対象とし、規範・準拠基準・実行保証を変更しないため準拠監査と全体回帰は追加しない。

後続是正の限定結果: 旧失敗二試験、関連するReality・観測条件・履歴・保存証拠25試験、台帳・依存三試験が成功した（再実行の重複を合算しない）。Checker／Coordinatorの型検査、変更二TSの整形・警告検査と差分確認が成功した。自己生成の試験領域は終了後に回収して不存在を確認した。独立技術レビューではSource・試験・Symbol・QAに追加の必須是正指摘はなく、履歴記述の時点を明示した。確認者の読取り確認と親担当の実測を分ける。全体回帰・実AI・Docker・過去保持物は操作していない。

基準版5c7fea5b4に対し、公開補助を隠すだけでなく利用側が完成操作を呼べる構造へ統合する。変更分類は公開契約と利用側受付の実装リファクタリング。Artifact、Project Context、品質評価、Reality、Catalog、Topic／MeetingとChecker・MCP・Workbench・Script・試験を対象とし、採用済み規則・Authority・保存形式を変えない。現行設計・旧Source・既存試験のCapabilityを各統合先へ対応付け、別確認者の読取り専用着手前照合を行った。文書・直接伝播・依存影響と独立技術レビューを実施し、規範・準拠基準・Releaseを変えないため準拠監査・全体回帰は追加しない。実AI・Docker・過去保持物は操作しない。

| 既存Capability | 新Ownerと維持条件 | 利用側・確認先 |
|---|---|---|
| Artifactの構造、Identity、Related、Anchor、Link | parseArtifactの内容モデル・局所Issue。低レベル捕捉は内部とし自己再帰しない | Checker文書／参照Reader、Artifact単体・診断変換・参照境界試験 |
| Schemaのmatches・必須Property／節・許可状態 | parseArtifactの明示schemasオプション。Source順・Schema順・callback回数と例外を維持 | 旧Schema試験は完成Parseへ接続し能力を削除しない |
| Artifact Graphの重複・参照比較 | 解析済みモデルを受ける既存横断評価へ統合。部分モデルを勝手に破棄しない | Qualityの完成Parseと既存Graph反証 |
| 品質表の算術・是正条件 | Artifactの表観測を入力とする完成品質評価。全Markdownへの従来適用範囲・件数・Issue順を維持 | Checker既存の各読取り位置と品質表反証 |
| Project Contextの単体条件と外部Manifest比較 | 単体はParse、外部比較はSemantic。再読取りや空モデルへ補完しない | Checker、Workbench、MCP、CoordinatorのParse結果利用 |
| Catalog読取り・構造・実在照合 | readTestCatalogで閉じ、同じ観測試験集合を返す。不正構造で従来不要だった走査を始めない | CheckerのCatalog CLIと選択試験。計画・実行判断はCheckerに残す |
| Reality Manifest受付 | unknownの構造受付とJSON読取りを区別し、既存の失敗理由・Path・Subsystem・重複条件を維持 | Reality観測・独立Schema試験・Checker利用側 |
| Topic／Meeting一覧の早期拒否 | 完成一覧操作で入力検査→取消確認→対象・認可解決一回→取消確認→read。操作間キャッシュなし | MCPの-32602／-32800区別・resolver回数・例外分類・read前停止の契約試験 |

正常、局所不備、外部比較不備、入力不足・観測不能、取消・例外の代表例を、各既存Ownerの入力境界へ照合してから編集する。固定候補で実差分と再照合し、限定回帰と独立レビューの結果が揃うまで完了としない。目標公開数は保証を削る制約にしない。新しいFile・Facade・Registry・Manager・互換入口は作らない。

Rootは206項目（値90・型116）へ整理した。Schema・Graph・Identity・Anchor・Link・品質表二検査・Catalog読取り／走査／検査・一覧入力検査の部分入口をRootから撤去し、必要な内部エンジンは既存Ownerへ維持した。Artifact集合検査、Project Contextの独立boolean検査、Reality Manifestの独立Validatorの三Sourceを削除した。

Factoryの認可解決を遅延化すると汎用転送Wrapperが増えるため、その案は採用せず、既存activity/operations.tsのreadTopicMeetingListへ一覧受付だけを閉じた。MCPはこの完成結果をProtocolへ変換する。QualityVerificationResultは既存の文書モデル名なので衝突させず、完成評価結果はQualityVerificationEvaluationとした。宣言元とRootを同じ名称にし、asによる再命名は設けない。

回帰で検索語129文字を不正とする旧試験が露出した。容量上限を製品へ戻さず、長い検索語が対象解決まで進む反証へ追従した。Global Symbol Graph試験の5診断は基準版Sourceのメモリ内読込みでも同じ結果を再現した。内訳はEMの既存Local Item二件、旧品質状態Symbol一件、旧Coordinator Native Trace参照二件。今回のManifest統合による新規診断ではなく、対象外の既存不整合として保持する。Coordinator通常Task CLI試験も既存unsigned-runtime-fixtureの複製対象にexecution-modelがないため起動前に失敗した。既存試験の不成立を成功に数えない。

限定検証は完成受付・公開契約・Catalog・MCP等82件、工程の内部Owner試験19件、利用側結合21件、CHANGELOG九件、固定履歴参照二件、台帳・依存五件が成功した。これらの集合には再実行の重複があるため合算しない。Project Context／Portfolio／Realityの既存結合九件も成功した。六Packageと配布ひな型の型検査、変更45TSの整形・警告検査、差分空白検査は成功した。直接起動したMCP三試験はOS一時PathがLockの許可範囲外で拒否されたため、製品の制約を変えず、合意したRepository内の自己生成RootをTEMPへ渡して同じ五試験を再実行し成功した。リンク試験は権限不足で一度停止し、許可された自己生成範囲だけで再実行して成功した。今回生成した領域は既存Helper／finallyで回収し、終了後不存在を確認した。

独立技術レビューの指摘二件を是正した。Related専用filterがCHANGELOGへ誤適用されていた箇所だけを全Issue配送へ戻し、元の取得位置・選択版・診断順を維持した。歴史参照の捕捉Pathは単一backslashを相対slashへ正規化する。上記のCHANGELOG九件と固定履歴二件で再確認した。文書・利用側・台帳の直接伝播を含む固定候補の独立再レビューは必須是正指摘0件。確認者は試験を再実行しておらず、親担当の実測とは区別する。初回候補の確認時点では既存不整合二試験は未解消だったが、上記の後続是正で両試験成功を確認した。これを全体回帰、実文書品質PassやReleaseへ拡大して主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### 通常本文三件のChecklist項目追従

Visual Baseline・BHV-000012・SCR-000008の独自Checklistを、現行ひな型の項目列と結果記法へ対応付けた。本文の採用済み契約・Header状態・Authority・実装方式は変更しない。処置済みは既存本文の記録へ対応する範囲に限り、未確認事項を新しい合格・非該当へ読み替えない。UI／SPEC正本・ひな型・Parserと直接利用側を照合し、着手前の読取り専用確認を受けた。文書・直接伝播と既存評価の保持を独立レビューで確認し、規範・準拠基準を変更しないため準拠監査・全体回帰は追加しない。

VisualのCanonicalと既存N/Aは旧v0.21意味基準の記録として保持し、現行Productの視覚案・Font・Contrast・Zoom・Adaptive Profileの成立へ転用しない。現行項目では23件を理由・担当・影響・再評価契機付きOPENとした。BHVの方式境界の照合未完、Screenの実表示Accessibility未確認も各一件OPENへ接続した。新しい採用判断、視覚案作成、例外受容や実検証は行っていない。

三件をそれぞれの完成Parserへ渡す限定確認では、Checklist構文Issueは0件、末尾のOPENは計25件である。構文のcompleteは文書品質Pass・工程Exit・実装成立ではなく、未完了内容は各文書のOwnerへ残る。過去保持物・実AI・Dockerは操作しない。

Checklist・UI／SPECモデル・診断変換の限定35試験が成功した。通常UI／SPEC Readerを現Repositoryへ読取り専用で接続し、今回接続した五種の局所Checklist診断が0件であることを確認した。全体Checkerや全体回帰は実行していない。本文の意味・実装・視覚評価に関するOPENは維持する。

固定候補の独立レビューで、既存設計記録と新しい処置済み項目、旧判断と現行未評価、未完了の担当・影響・再評価条件、実行結果と品質状態の区別を確認し、必須是正指摘は0件だった。

#### Screenの局所診断と公開境界の全件棚卸し

変更分類は既存Parser接続と不要なRoot公開の整理。工程規則・保存形式・Authorityは変更しない。親担当は現行設計・全Root宣言・本番／試験／Script／配布入口の利用を照合し、別確認者から着手前の読取り専用確認を受けた。文書・直接伝播と依存影響を確認し、固定候補の独立レビューを行う。準拠基準・Releaseを変更しないため準拠監査を追加せず、全体回帰・実AI・Docker・過去保持物は操作しない。

ScreenはSPECの既存read位置でParseのissuesを一度配送し、resultを従来の関係比較へ渡す。不備でも部分モデルを破棄せず、祖先Linkを除外する。新しいReader・作成義務・IDや表の追加制約は設けない。通常本文のChecklist不一致二件は別対象のまま変更しない。

Root全265項目を本番・試験のnamed／namespace import、動的import、Script、配布入口と固定公開一覧へ照合した。内部構文Helper七値、完成Topic／Meeting操作が使う本文更新二値、内部の種類列挙一値と、専用中間型五件をRootから撤去する。内部実装・既存反証は維持し、外部のdeep importや互換Wrapperは増やさない。Architectureの可視本文化は完成Parser自身が所有するため、Consumer側の重複した事前処理も撤去した。

撤去する値はomitMarkdownFencedCode、isMarkdownTableSeparator、omitMarkdownCommentsAndFencedCode、omitMarkdownCommentsOutsideFencedCode、parseMarkdownFences、parseMarkdownTableRow、readCanonicalDocumentHeader、applyTopicPromotion、applyMeetingOutcomeTreatment、realitySymbolKinds。撤去する型はMarkdownFence、MarkdownFenceLine、TopicPromotion、MeetingOutcomeTreatment、MeetingOutcomeDisposition。Rootの最終集合は250項目（値102・型148）で、個々の名前はRootと独立した固定literalの公開契約試験へ保持する。

公開理由は「実利用」「独立した完成契約」「内部手段」を区別する。型は現在の明示import数だけで削らず、文書モデルと完成操作の入力・結果として参照可能にする。以下は全250項目をOwner単位で分類したものであり、数を目標や品質Passの根拠としない。

| Owner | 値 | 型 | 残す契約と理由 |
|---|---:|---:|---|
| activity | 2 | 14 | Topic／Meetingの連合照会とTransport受付の条件正規化、利用側の認可・一覧・更新契約。MCP／Workbenchが利用する |
| architecture | 6 | 6 | 文書単位の完成Parseと出典付きモデル。Checkerの関係比較へ接続する |
| artifact | 9 | 18 | 共通Markdown成果物、Identity、Link／Anchor、Related、Schema、Graphの独立した完成技術契約。工程固有の部分Parserとは区別する |
| change | 2 | 2 | 変更本文と台帳のParse・モデル |
| discovery | 3 | 3 | 探索分析・要求定義・台帳のParse・モデル |
| ia | 6 | 6 | IA文書ごとのParse・モデル |
| meeting | 2 | 3 | 完成したMeeting操作集合と本文Parse・記録・状態。本文の部分更新は内部へ限定する |
| project-context | 9 | 20 | 実利用される文脈読取り・投影・外部Manifest照合と、独立した候補判断・Source投影契約。未接続の完成操作を本番接続済みとは表示しない |
| quality | 11 | 9 | 九文書の完成Parse・モデルと、複数種の文書に現れる分岐／是正表の独立検査。全Markdownを対象とする現Consumerを維持する |
| quality-change-control | 3 | 4 | 固定候補・必須確認集合・再入場の独立した完成契約。実利用の有無とCapabilityの存続を混同しない |
| reality-traceability | 4 | 9 | 観測済みSymbolの受付・検査・Graph・Catalog比較。内部の種類配列は非公開とする |
| release | 3 | 3 | 正本文書・CHANGELOG・READMEのParse・モデル |
| repository | 2 | 7 | 文書／Symbol観測と明示された観測Port。Filesystemの観測不能を本文解析から分離する |
| semantic | 10 | 11 | 解析済みモデル間の比較・意味関係・被覆Graph・Bundle・出版。必要な評価結果を返す独立した横断操作を維持する |
| spec | 7 | 7 | SPEC文書ごとのParse・モデル |
| storage | 1 | 3 | Semanticの完成出版を支える明示Publisher契約。保存EffectはParseへ混ぜない |
| test-catalog | 4 | 3 | 試験一覧の読取り・発見・照合、CLIが利用する試験段階。内部構文Helperではない |
| topic | 2 | 3 | 完成したTopic操作集合と本文Parse・記録・状態。本文の部分更新は内部へ限定する |
| ui | 9 | 9 | UI文書ごとのParse・モデル。通常Screenの局所診断も接続する |
| ux | 7 | 8 | UX文書ごとのParse・モデルと正式入力の観測契約 |

「全てをParseだけにする」は保存・照会・連合操作まで廃止する意味ではない。既存Consumerの完成操作と独立した技術受付を維持し、表面的な関数数削減のためのFacadeを作らない。今回の棚卸しでRoot露出を撤去した機能も、内部処理自体が不要になったとは扱わない。

Screenの本番読取り接続により、SCR-000008にも既存Checklist項目集合不一致が見えるようになった。既知のVisual Baseline・BHV-000012と同じく、本文の判断・Checklistは今回変更しない。接続試験の成功と実文書の品質状態を区別する。

限定検証は単体・契約37件、台帳・依存・入口接続5件、Screen／通常Detail／関係・短絡9件、Topic／Meeting完成操作11件、Architecture横断1件が成功。対象TS十Fileの整形・警告確認、両Package型検査、差分空白検査が成功した。三つの自己生成試験領域は終了後の不存在を確認した。全体回帰や実文書の品質Passは実施・主張しない。

#### 通常AREA・CMP・Visual Baseline・BHVのParser接続

既存Parserがひな型にしか接続していなかった四文書を、Checkerの固定配置に存在する通常本文へ接続する。既存の局所Checklist診断だけを配送し、文書作成義務・任意再帰探索・新しい意味検査・横断比較を増やさない。Linkをたどらず、既存の工程比較と短絡順を維持する。Screenの局所Issue配送は対象外。公開契約265項目と保存形式は不変更で、新しいFile・Facade・互換処理は作らない。

対象の着手前整合確認は読取り専用の別確認者と行った。検証は四文書の正常／不備、不在・非対象配置、Link境界、一回読取り、診断理由と公開整列、既存短絡に限定する。今回生成する試験領域だけを回収し、全体回帰・実AI・Docker・過去保持物は操作しない。接続で既存のVisual BaselineとBHV-000012のChecklist項目集合不一致が顕在化したが、本文の判断を自動変更せず、製品接続の検証結果とは区別する。

局所単体・契約46件、台帳・依存・入口接続5件、新規接続3件と既存短絡1件、関連する既存結合8件が成功した。対象TS五Fileの整形・警告確認、両Packageの型検査、差分空白検査が成功し、自己生成試験領域の回収を確認した。独立レビューの文書読取り順の指摘を、実装を変更せずUI三文書とSPEC本文の各評価後の順序へ是正した。これらは限定検証であり、Repository本文全体の品質Passとは区別する。

#### Architecture・Qualityの完成ParseとSemanticへの統合

変更分類は、既存Capabilityの責務と公開契約を整理する実装リファクタリング。規範・保存形式・Authority・工程の受理条件は変更しない。着手前に現行Source・Owner設計・利用側・既存検証を照合し、読取り専用の別確認者から、二回読取り・局所と横断の診断順・ひな型限定条件・部分Mapと後勝ち・短絡保持の確認を得た。実装後の独立レビューとは区別する。文書・直接参照・依存影響はこの範囲で確認し、準拠基準・Release・外部実行を変更しないため準拠監査・全体回帰・実AI・Dockerは実施しない。

Architectureは入口の横断登録と定義台帳をparseArchitectureIndexへ統合した。分析・定義・領域のParseは、初回原文と別取得のChecklist原文を受け、両方を捕捉する。Ready宣言、Index登録、実在定義・領域・担当・閉包はSemanticが比較する。局所とReady／被覆の併存も旧一件診断へ統合し、登録重複は局所Parseからも取得できるが、Checkerでの配送は元の被覆位置に維持する。

Qualityは九文書の完成Parseを公開し、原文・状態・件数・表・出典・Checklistと局所Issueを返す。分析の関係・条件・後勝ちMapと、統合の横断表・詳細単位・Local Itemは完成モデルへ捕捉する。Semanticはその結果から外部被覆・目標／項目閉包・状態対・Owner・段階・境界を比較し、本文を再解析しない。比較後のMapを実Consumerが使うinspectQualityAnalysis／inspectQualityLocalItemOwnershipはSemanticの完成横断操作として残す。

独立した部分Checklist・ひな型・担当・追跡のRoot受付を撤去し、担当と追跡はモデルのassignment／trace、ひな型条件はtemplateContractへ統合した。後段の担当確認用の別readは残す。Qualityのrelations.ts／state.tsは撤去し、旧Wrapper・新File・Facade・Registry・Storeは増やさない。Rootは265項目（値112・型153）。公開数は目的ではなく、完成文書モデルと必要な横断契約を対応付けた結果である。

本番利用側、固定公開契約、既存試験、Symbol・検証関係、正式QAとOwner設計を追従した。対象28Fileの整形・警告確認、両Packageの型検査、差分確認が成功。単体・契約84件、台帳・依存・入口接続5件と、Checkerの関連限定結合36件が成功した。最後の局所Registry診断・ひな型状態条件等の整理後に、登録・Template・Ready・短絡の既存6件を再実行して成功した。6件は36件とは別の再確認であり、追加の独立した検証観点数とは扱わない。今回作成した二つの試験Rootは回収・不存在を確認した。

固定候補の独立レビューは、取得断面・Readyと局所不備の一件統合・Registry重複の旧配送位置・Quality状態対・Coverage欠測return・Mapの順序・相関取得時のIssue非配送・Template限定条件・旧公開撤去と依存を確認した。機能・依存・公開契約の必須指摘はなく、公開数説明の旧値一か所を265へ訂正した。実装・型・診断・試験・I/Oは変更しない。試験成功と読取りレビュー、限定確認と全入力同値性は区別し、全体回帰・実AI・Docker・過去保持物は操作していない。

#### UI・SPECの文書別完成Parseと横断比較への統合

UI九種類とSPEC七種類のChecklistを各文書の完成Parseへ接続した。新しい内容モデルはUiArea／UiComponent／UiVisualBaseline／UiHandoff／SpecBehaviorであり、既存のDetail台帳・Screen・対応文書のParseも局所Issue付きのParseResultを返す。部分parseUiDocument／parseSpecDocumentと八つの工程別比較公開を撤去し、比較は既存SemanticのinspectDocumentRelationsへ統合する。Rootは278項目（値126・型152）。spec/details.tsは撤去し、新しいFile・Facade・互換Wrapper・Storeは増やさない。

Detailの行・重複・Canonical宣言は文書内の条件、期待集合・Screen／Part／BHV件数は横断条件として分離する。Semanticは完成Parseの局所Issueと被覆結果を旧一件診断へ統合し、Checklistだけの不備をこの被覆経路で追加配送しない。不正行・重複出現・最後に抽出成立したbindings／behaviorsと出典を保持する。UIの一意節、SPECの先頭節・正式入力だけの次H2必須、raw／可視／Fence、既存の旧構文受理差は変更しない。

着手前の読取り専用確認で、Template条件を通常本文へ強めないこと、SPECが相関用に読むUI局所Issueを新しく配送しないこと、Definition根拠のFingerprint→各ペアfresh read→即評価と短Cell例外後の未読を維持することを固定した。AREA／CMP／Visual／BHVは現在読むひな型内容を捕捉する範囲であり、新しい通常Readerや通常BHV本文の検証成立を追加しない。

Source・本番利用側・固定公開契約・既存試験・Symbol・Owner設計と正式QAを追従した。両Packageの型検査、対象Sourceの整形／警告確認、差分確認が成功。単体・契約71件、台帳・依存・入口接続5件、CheckerのUI／SPEC限定結合36件が成功し、最後の重複解析削減・Template原文捕捉共用後に関連4件を再実行して成功した。今回作成した二つの試験Rootは回収・不存在を確認した。

固定候補の独立レビューはDetailの一件診断、Map・部分行保持、相関読取り時の局所Issue非配送、Fingerprintと各ペアfresh read、Template条件・通常BHV非読取り、旧公開・Source撤去と文書接続を確認した。機能・依存・公開契約の必須指摘はなく、内部重複判定関数の説明コメント不足一件を是正した。実装・型・診断・I/O・assertは変更しない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### UX・IAの文書別完成Parseと横断比較の接続

UX七文書・IA六文書を各一つの完成Parseへ接続した。UXの台帳・想定利用者・利用の流れ・サービス提供の流れ・品質期待・分析・定義、IAの台帳・Object関係・情報構造とNavigation・状態可視性・分析・定義は、原文・Artifact・全表・名前付き内容・出典と局所診断を保持する。部分Checklist受付二件、Handoff／正式入力候補の独立受付、外部集合を受け取る投影Parser二件と五比較入口のRoot公開を撤去した。新しい独立横断文書Parseは六件、文書モデルの明示公開は差引七型増で、Rootは278項目（値131・型147）。参照候補の項目型はモデル内部に留める。公開数の削減だけを目的に型をunknownへ置換しない。

両工程のparse.tsが内容捕捉・局所検査への接続、types.tsがモデル、validation.tsが固定Checklistと局所文法を所有する。UXのhandoff.ts／inputs.tsは完成Parseで実利用する具体的な内部構文処理として残し、旧公開のWrapperを新設しない。通常／ひな型は明示modeで区別し、ひな型へ通常用のID・成果物種別等の条件を追加しない。UXのraw内容、IAの可視本文とFence保持構造、Checklist、UXのsubstring投影、IAのexact一意節と4節null時だけの5節fallbackを維持する。既存試験の共通Checklist反証は試験内の小さな選択Helperで文書別Parseへ接続し、状態・期待列・保存領域を共有しない。

追加の着手前照合で、UX分析の台帳登録数、正式入力の六観測、IA定義の分析Mapは外部比較と確定した。UXのHeader・候補・禁止宣言を内容モデルへ捕捉し、六観測はux_formal_input、登録数はux_analysis_registrationで比較する。同じ分析readの完成モデルを使い、従来の正式入力→本文診断順を維持する。Markdown→HTML→裸Path→Entity順、限定Decode、Root文字列結合後の重複flag合成を変えず、Root検証・参照解決・定義readと境界確認はCheckerに残す。

IA定義Parseは分析Mapを受け取らず、文書内で有効な対応宣言mappingKeysと、分析ID・Object・記載Identityの照合材料を保持する。mappingKeysを外部成立済み対応と主張しない。ia_definitionが実分析Mapと比較し、局所構造・Checklist不備と同じdefinition-contract-invalid一件へ統合する。ia_relationsは実分析で受理できた対応列だけを使用し、未取得Objectを閉包へ数えない。比較は既存inspectDocumentRelationsの有限kindへ接続し、公開関数・Registry・Storeを増やさない。台帳・横断被覆・UX／Journey閉包もSemanticへ移し、工程側からの逆依存はない。

Checkerの列挙、別read、Link確認、早期return、不存在skip、短絡、診断順と既存文言を維持した。Checklistだけの位置では失敗理由、別の引渡し観測ではhandoffContract、後段投影では被覆Issue、基本図ではdiagramContractだけを使い、追加の局所Issueを重複配送しない。引渡し禁止語句の観測も完成モデルへ接続し、正本三語句・ひな型一語句の旧範囲を維持した。Source三件の追加、既存型Sourceの更新、試験の検証関係、Root固定期待値・Module境界、両Architectureを追従させた。既存Suiteの移動・新設はなく、Test CatalogのSuite PathとLocal Itemは維持する。

変更分類は公開完成操作・責務境界の整理。既存Capabilityは旧四用途（通常本文、ひな型、後段の別観測、基本図）と既存試験に対応付け、専門観点として内容捕捉／局所検査／外部比較、Map後勝ち、診断の一件統合、依存方向を確認した。文書・利用側の影響確認と独立レビューを適用し、規範・保存・認可・外部Effectの変更がないため準拠監査・実環境検証は実行しない。既存の安全条件を緩めず、全体回帰・実AI・Docker・過去保持物は操作しない。

限定単体・契約88件、台帳／依存等5件、実Checkerの関連52件が成功した。52件はUX・IAの本文・関係・正式入力と、その下流入力の既存契約を対象とし、全体回帰ではない。禁止記載の完成モデル接続後には関係する実Checker三件も再実行して成功したが、重複して総件数へ加算しない。両Package型検査、対象22TSの整形・警告を失敗とするLint、差分検査も成功した。既存Lint info一件は維持した。IA試験追従時のひな型mode渡し落としを是正し、製品検査を緩めて通していない。追加反証は外部Object不存在と局所不備の併存、Identity差異とChecklist不備、Map後勝ち、登録数0／複数、正本／ひな型の禁止語句範囲を確認する。メモリ内の旧新比較はIA67条件・UX88条件で一致したが、正式試験数や全入力同値証明へ加算しない。

今回専用.crdd/tests/dm-ux-ia-parse-3rwYrq、dm-ux-handoff-final-zNwjOOは子Process終了後に既存Helperで回収し、不存在を確認した。固定候補の独立レビューで投影捕捉Helper二件に旧比較責務のHeaderが残るP3を検出した。実装・型・抽出条件・assert・I/Oを変更せず、実在する引数・内容モデル返却とSemantic境界へHeaderだけを是正し、独立再確認で必須指摘0件となった。レビューは読取り専用の責務・契約・利用側・文書照合であり、親担当の試験を独立再実行したものではない。既知のCoordinator公開Module期待値不整合は別残件であり、全体Passと主張しない。UI／SPEC／Architecture／Quality等の未統合公開は後続範囲として残す。コミット・プッシュ、全体回帰・実AI・Docker・過去保持物の操作は行っていない。

#### Discoveryの文書別完成Parseへの統合

Discoveryの部分Checklist受付parseDiscoveryDocumentを撤去し、探索分析・要求定義・入口台帳の三Parseへ内容・出典・Checklist条件と局所診断を接続した。parseDiscoveryIndexもParseResultとnonnullのresultを返す。三文書型DiscoveryAnalysis／DiscoveryDefinition／DiscoveryIndexを明示公開し、Rootは276項目（値136・型140）となった。値公開は一件減り、モデル型は三件増える。件数削減を目的に未知型や巨大Unionへ置換しない。

既存validation.tsから内容捕捉をparse.ts、型をtypes.tsへ分離し、validation.tsは固定三定義・共通構文への内部接続・捕捉済みモデルの局所条件だけを所有する。旧部分関数を非公開へ移すだけのWrapperは残さず、三Parseが共有する内部捕捉処理へ統合した。通常文書は構造→Checklistの診断順を維持する。modeは明示的なtemplate／evaluated（既定evaluated）で、未知値やnullを拒否する。ひな型へ通常のID・成果物種別・Placeholder拒否は追加しない。分析／定義のraw Checklist節は可視断面へ置換せず、台帳のraw登録行・採用セルsubstring・最初ID・重複出現とSet初出順を維持する。

本番二Consumer、共通47定義・七基本図・Discovery本文・公開境界・診断変換の試験を接続した。Checkerは台帳／ひな型の実Issueを既存code・文言へ同じ位置で変換する。後段の採用集合は別readのresultだけを使用し、Checklist Issueを再配送しない。基本図の限定経路もdiagramContractだけを使う。Root確認前のearly return、存在しないTemplateのskip、read・短絡・診断順を変えず、UXのFilesystem観測は変更しない。

着手前に旧四入口の全参照と既存試験を照合し、通常本文／ひな型／台帳再read／基本図の四用途を確認者と照合した。変更分類は完成受付とモデル責務の整理であり、保存形式・規範・認可・外部Effectは変更しない。文書と利用側の影響確認および独立レビューを適用し、規範変更・準拠表明がないため準拠監査と実環境検証は実行しない。新Source二件と検証関係は既存Symbolへ登録し、試験Suite／Local Itemの追加や汎用Frameworkは不要だった。

限定単体・契約43件、台帳／依存等5件、実Checker10件の計58件が成功した。両Package型検査、対象13TSの整形・警告を失敗とするLint、差分確認が成功し、既存Lint info一件は維持した。追加試験は通常／ひな型の診断範囲、欠測時の内容と採用集合保持、raw節の出典、未知mode拒否、実Issueの旧表示と理由不足拒否を確認する。一度失敗した追加fixtureは旧raw行頭形式に合わない裸REQ行が原因で、fixtureだけを既存のbacktick形式へ是正した。検査は緩めていない。メモリ内の旧新代表比較48条件も一致したが、正式試験件数や全入力同値証明へ加算しない。今回専用.crdd/tests/dm-discovery-parse-LyUmf5は子Process終了後に回収し、不存在を確認した。固定候補を読取り専用で独立レビューし、必須指摘0件を確認した。内容・出典・局所検査・利用側の観測順・公開契約・台帳・文書を照合したもので、試験の独立再実行ではない。最後に診断変換のヘッダーも台帳・ひな型を含む実際の範囲へ補正した。既知のCoordinator公開Module期待値不整合と他工程の完成Parse統合は別残件とし、全体Passや全体完成は主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### 正本文書family・集合比較と限定Header観測の完成接続

Releaseの残る旧五公開を撤去し、CanonicalDocument／parseCanonicalDocumentとSemanticの完成集合評価inspectReleaseDocumentsへ統合した。既存release/types.ts・parse.ts・validation.tsとsemantic/relations.tsだけを使い、新File・Facade・Manager・Writer・互換Wrapperは作らない。モデルは共通Headerを持つCRDD正本文書familyの全文・Artifact・原文・全表・行出典・版・状態・Baseline・Candidate表示版・Ready／Released宣言を保持し、UI／SPEC等の工程固有内容の解析を代替しない。既存ArtifactModelと保存形式は拡張しない。

単体で判断できるCandidate以外のBaseline不備、CandidateのBaseline欠測・自身の版との同一はParseのIssueへ移したが、取得時に新しく配送しない。集合評価は非null版のSetと件数、全モデルのCandidate相関・Baseline・Stable観測候補を同じ断面から一回導出し、版不一致→文書順のCandidate外Baseline不備→Candidate相関という旧順へ統合する。Candidateの局所Issueは重複配送せず、集合文脈でモデル値から再構成し、旧件数・順序・detailsを維持する。Checkerの手製tuple／状態DTOとStable条件の重複組立てを撤去した。Stable候補は純粋な宣言相関であり、状態不整合・品質・公開許可の成立を示さない。official／scope・Git観測と後段処置はCheckerに残す。

Stable集合比較はstable_canonical_documents、Markdown宣言と対象版・Tag観測の比較はstable_release_documentへ接続した。先頭16行の観測は実際に渡された断面だけを捕捉し、本文を補完しない。Candidate三形式の優先順位、rawの対象版substring、Ready／Releasedの宣言とPath条件、Tag未確認のnull、列挙・Link拒否・read・some短絡・再read・診断順・版件数を維持する。旧五APIの宣言・参照を撤去し、release/validation.tsは完成受付の内部検査に閉じた。Rootは旧五値を二完成操作・一モデルへ置換し、274項目（値137・型137）となる。

着手前にParse局所診断と集合診断の統合順、非null版と版欠測を含む状態列、Stable候補と環境Gate、16行断面と全文、宣言とTagを確認者と照合した。変更分類は完成受付・モデル集合と公開境界の整理。文書／横断影響確認と独立レビューを適用し、規範・準拠基準・認可・外部Effectは変えないため準拠監査は実行しない。旧単体のtupleとstatesは実Producerで一致するfixtureだったため実Parserへ移し、元の版・状態・Baseline・順序反証を保持した。独立入力だから構成できた偽の不整合を新しい本番契約へ残さない。

限定単体・契約62件、台帳／依存等5件、実Checker10件の計77件が成功した。空／単件・版欠測・混在状態でもStable候補を品質へ読み替えないこと、内容・出典・入力不変・16行・優先順位を追加反証した。メモリ内の旧新比較は集合1332条件、Stable集合2664条件、Header32条件、限定宣言576条件で一致したが、正式試験件数や全入力同値の証明へ加算しない。独立レビューで共通Headerの出典が常に一行目になるP2を検出し、既存Header採用文法を変えず最初の採用fieldの原文行へ接続した。欠測はnull、捕捉済みHeaderの対応行がない場合は例外とし、BOM・Anchor・空行・同文言を含むタイトル・LF／CRLFを反証した。追加の着手前照合では、旧単件評価でも確定するCandidateの二局所不備をParseへ接続し、自己同一と別文書の欠測／複数Baselineが併存しても集合診断を重複・変更しない反証を追加した。

是正後も同じ77件と両Package型検査、対象9TSの整形・警告を失敗とするLint、差分確認が成功した。既存Lint info一件は維持した。今回専用.crdd/tests/dm-canonical-parse-0vuEeV、dm-canonical-review-74TYSM、最終dm-canonical-final-AghSGMは各子Process終了後に既存Helperで回収し、不存在を確認した。是正後の固定候補を読取り専用で独立再レビューし、必須指摘0件を確認した。レビューは試験の独立再実行ではなく、出典・局所診断／集合再構成・取得断面・内容保持・Root・設計の照合である。既知のCoordinator公開Module期待値不整合は未解消であり全体Passとは表示しない。全体回帰・実AI・Docker・過去保持物は操作していない。他工程の完成Parse統合・補助公開撤去と未接続本文は未完了として維持する。

#### CHANGELOGの完成ParseとStable版のモデル接続

Changelog／parseChangelogを既存release/types.ts・parse.tsへ追加し、旧inspectChangelogRelease／inspectStableChangelogを本体とRootから撤去した。局所規則は同一文書内の二言語・多版構造を扱うため、version引数で診断する版を明示し、最新版を推測しない。原文・Artifact・全表・raw行、既知二言語の全節出現・全版節・宣言試行と採用値／理由・移行注記と出典を保持し、指定版だけのIssueをParseResultで返す。過去版の旧形式を捕捉しても、現行規則による合否判定を勝手に追加しない。

ParserはFence・言語・版・宣言・必要説明を一回捕捉し、validateChangelogはモデルだけから言語節欠測／重複、対象版節数、宣言、二言語相関、必要説明を従来順に評価する。未閉鎖yaml／ymlの優先拒否と、通常本文・引用・他Fence・前版を宣言根拠にしない条件、同値重複・競合・分類不一致・不足理由を維持した。新しい入力規則・Writer・Manager・Facade・互換Wrapper・Fileは追加しない。

Stable版との見出し二件・日付一意の比較はSemanticのstable_changelogへ移し、捕捉済みモデルを使う。ただし旧APIが任意の期待版文字列を受け付けるため、通常の一行見出しへ狭めず、版指定の全raw原文正規表現を維持する判断を着手前に確認者と照合した。Stable観測で局所Parse Issueを追加配送せず、通常観測とStable観測の二つのread・空本文・Candidate Baselineの選択・適用条件・既存診断を維持する。Rootは二値を一Parse・一モデルへ置換し、276項目（値140・型136）となる。

既存の単体反証は完成ParseとSemantic経由へ移し、全履歴と対象版の区別、CRLFの本文・宣言行位置、旧版の欠測、入力独立、raw見出しとFence外の違い、改行期待版を追加確認した。既存Suite・Local Item・Sourceの検証辺で実利用を覆い、新しいSuiteやSourceの登録は不要。変更分類は文書モデル・局所検査・横断比較と公開境界の整理。文書／横断影響と独立レビューを適用し、規範・準拠基準・認可・外部Effectを変えないため準拠監査は実行しない。

限定単体・契約60件、台帳／依存等5件、実Checker26件の計91件が成功した。実Checkerは移行注記・完全例・Candidate Baseline・言語節／対象版欠測・宣言欠測／不正／同値重複／競合／不一致・閉鎖／未閉鎖YAML・他Fence・引用／本文・分類・Stable相関・adopter非適用を確認した。今回専用.crdd/tests/dm-changelog-parse-MYTHH6と是正確認用.crdd/tests/dm-changelog-review-4aboguは、各子Process終了後に既存Helperで回収し、不存在を確認した。旧新メモリ内比較は局所306条件・Stable304条件で一致し、正式試験件数や全入力同値の証明へ加算しない。両Package型検査、対象8TSの整形・警告を失敗とするLint・差分確認は成功した。固定候補の独立レビューは、未閉鎖YAMLの早期拒否によって別の閉じたYAML宣言も内容から落ちる一点を指摘した。閉じたYAMLの宣言捕捉後に未閉鎖の優先理由を返す形へ是正し、未閉鎖Fence内を有効な宣言にせず、理由・診断順・対象版・I/Oを維持した。宣言出典と全Issueの反証を追加し、是正後に単体60件・台帳等5件・実Checker26件を再実行した。是正後の診断旧新比較も4条件一致した。是正後の読取り専用再レビューで残る必須指摘0件を確認した。閉じた宣言の出典保持、未閉鎖内の非採用、旧拒否理由・全Issueと行位置、設計／記録の一致を確認し、初回比較・是正後比較・親担当の実測と独立読取りを区別した。既知のCoordinator公開Module期待値不整合は未解消として別管理し、全体Passを主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。正本文書集合・一般Headerと他工程の完成Parse統合は未完了である。

#### READMEの完成ParseとStable版比較の分離

Release関連の最初の区切りとして、READMEの部分版ParserとStable検査を、Readme／parseReadmeとSemanticのstable_readmeへ統合した。release/parse.ts・types.tsを合意粒度で追加し、他のRelease七入口は今回未完了として維持する。モデルは原文・Artifact・全表・raw行・Fence外行・採用Headerと位置・raw先頭20行・Candidate残留出現・二言語節を保持する。BOM／Fence／Anchor／太字行skipと先頭意味行の打切りを維持し、版欠測の新しい局所違反を追加しない。Parseのcompleteと空Issueは内容捕捉の完了だけを示す。

Stable比較はモデルの全原文に対するliteralなVersion表示と、捕捉済みの先頭20行Candidate／Baseline残留を従来順で評価する。行単位のincludesでは改行を含む期待値の意味が変わるため、着手前に確認者と照合し、原文へのsubstring比較を維持した。Headerの採用版で全文表示を代用しない。Checkerの二つの既存read・適用条件・File不在時の空本文・診断kind／code／文言／順は変更しない。旧二関数はRootだけでなく本体も撤去し、Wrapper・新しいValidator・Reader・保存状態は作らない。Rootは276項目（値141・型135）となる。

旧反証は完成ParseとSemantic経由へ移し、原文・出典・二言語本文・入力独立・版欠測・最初の意味行・rawとFence・20／21行・改行期待値を追加確認した。既存Suite／Local Itemを維持し、Symbolへ新二Sourceと実検証辺を追加した。変更分類は内容モデルと公開境界・工程間比較の整理。文書／横断影響確認と独立レビューを適用し、規範・準拠基準・認可・外部Effectは変えないため準拠監査は実行しない。

限定単体・契約57件、台帳／依存等5件、実Checker4件の計66件が成功した。旧新のメモリ内比較はHeader採用70条件・Stable比較350条件で一致したが、正式試験件数や全入力同値証明へ加算しない。今回専用.crdd/tests/dm-readme-parse-kocHdgは子Process終了後に既存Helperで回収・不存在確認済み。両Package型検査、対象9TSの整形・警告を失敗とするLintは成功した。最初のRoot固定期待列でReadmeの整列位置を是正してから最終試験を再実行し、既存Lint info一件は維持した。前区切りで確認した全Package公開Module試験のCoordinator期待値不整合は未解消であり、今回の限定成功へ含めない。固定候補の読取り専用独立レビューは必須是正指摘0件。版採用の文法と打切り、Header／全raw本文／20行残留の別観測、改行期待値、適用条件・別read・診断順、旧API本体／参照撤去、Root・Symbol・試験・現行文書・未完了範囲を確認した。親担当の実測と読取りレビューは区別し、確認者は試験を再実行していない。全体回帰・実AI・Docker・過去保持物は操作していない。README以外のReleaseと他工程の完成Parse統合・補助公開撤去は未完了である。

#### Changeの文書種別別完成Parseと案内のモデル接続

Changeの旧四公開を、ChangeDocument／parseChangeDocumentとChangeIndex／parseChangeIndexへ統合した。change/parse.ts・types.tsと既存validation.tsを用い、部分Header Parser・Boolean受付・旧名のWrapperは残さない。Canonical本文とひな型はmodeを明示し、原文・Artifact・全表行・先頭40行の宣言・期待Identity・実ひな型の名前付き本文・影響区画・収束表を保持する。局所Validatorは捕捉済みの見出し・影響行・収束行・本文行を使い、旧raw解析を再実行しない。内容と診断はParseResultのresult／issuesへ分離する。

番号条件は列挙元の期待Identityを優先し、本文の宣言不一致や非数値IDで適用を勝手に強めない。影響見出し数不一致は打切り、不正BlockはLegacy見出し・Phase診断へ継続する。Templateの不正診断後も別Templateの検査を続行する。Header専用観測は既存の先頭40行を同じ完成Parseへ渡して宣言だけを使い、元の二回readとID／標準見出しの評価順を維持する。そこで本文Issueを新たに表示せず、その取得断面から文書全体の成立を表示しない。

変更案内は全指定区画を出典付きで保持するが、旧どおり先頭区画だけからリンク全出現を採用する。局所重複はParseで一件、実在CHG集合との件数・包含比較はSemanticのchange_navigationへ移した。重複と欠落・未知IDが併存しても追加診断を出さず従来一件を維持する。区画欠測＋期待集合空の旧受理も維持する。Checkerは同じ観測位置で両結果を既存code・文言・順に表示する。新しいReader・共有Snapshot・Facade・保存状態は作らない。Rootは旧四値を二値・二モデルへ置換し、276項目（値142・型134）となる。

変更分類は内容モデル・完成受付と公開境界の整理。着手前にHeader断面・CHG79／80・局所重複と横断比較・診断数を確認者と照合し、文書／横断影響確認と独立レビューを適用する。規範・準拠基準・認可・外部Effectは変更しないため準拠監査は実行しない。旧試験は反証を削らず完成受付へ移し、Headerの二反証はArtifact試験からChange試験へ移管した。新モデルの原文・名前付き本文・出典・入力独立・宣言と期待IDの違い・40行境界・重複診断の分離を追加確認した。Suite／Local Itemは維持し、移管先Path・Sourceと検証辺を追従した。

限定単体・契約41件、台帳／依存等5件、実CheckerのChange本文・案内・Header経路6件、計52件が成功した。追加した全Packageの公開Module接続試験一件は、今回変更していないCoordinatorの期待値不整合で不合格。HEADにも同じSourceと旧期待値があることを確認し、対象外として記録する。文書モデル自身の公開Module集合は個別の読取り比較で確認し、この比較を正式試験一件として加算しない。メモリ内の旧新比較はCanonical2160条件・Template720条件・Header720条件・案内35条件で一致した。比較条件数を正式試験件数や全入力同値証明に数えない。実Checkerの専用.crdd/tests/dm-change-parse-3wIFb7は子Process終了後に既存Helperで回収し、不存在を確認した。初回の整形ではWindowsのmapped-fileエラーを成功扱いせず、通常の再実行で成功を確認した。両Package型検査・対象13TSの整形と警告を失敗とするLint・差分確認は成功した。固定候補の読取り専用独立レビューは必須是正指摘0件。モデル捕捉からの局所検査、期待IDと宣言ID、CHG閾値、打切り・継続、局所重複と横断の診断数、Header取得・評価順、Template後続処理、旧API撤去と試験／Symbol／文書追従を確認した。確認者は試験を再実行しておらず、親担当の実測と区別する。既存Coordinator不整合は未解消であり全検査成功とは扱わない。全体回帰・実AI・Docker・過去保持物は操作していない。今回の完成受付統合はChangeだけであり、他工程の補助公開撤去と未接続本文は未完了である。

#### 完成Parseへの公開境界整理 — 共通結果のArtifact統合

人間が採用した方向は、文書種別ごとにモデルと一つの完成Parseを提供し、文書単体で決定できる問題を同じ結果へ返し、モデル間の比較を後段Semanticへ分けることである。Topic／Meetingの更新・保存、Project Context取得、Semantic出版、Reality観測、Test Catalogと品質候補操作は別の実利用であり、この方向だけを理由に廃止しない。断片Parser・個別Validation・同じ文書の複数受付は利用側の呼出し順・観測境界を確認して完成受付へ統合する。BHV／CMPは実在文書とConsumerの接続を先に確定し、未使用Parserを追加しない。

最初の区切りとして、ルートoutcome.tsを廃止し、共通型をartifact/types.tsへ統合した。DomainIssue／DomainLocation／DomainOutcome／DomainStatusを宣言元と全ConsumerでDocumentIssue／DocumentLocation／DocumentResult／DocumentStatusへ改名し、as再命名や互換再exportを残さない。DocumentResultは観測側のunobservableを含む既存四状態を維持し、ParseResultは取得済み本文の三状態へ限定する。純粋な工程内容受付・Identity・基本図に三状態の型を接続し、Realityの観測不能をinvalidへ読み替えない。診断kind／reason／details・表示・Filesystem取得順・保存形式は変更していない。

validateDomainOutcomeは本番Consumerがなく専用試験だけだったため、Rootから隠すだけでなく本体も撤去した。専用Suiteはartifact/result.contract.test.tsへ移し、完全・部分・不正・観測不能、部分内容、全診断field、未知kindと入力不変を実Identity／Schema／Reality Producerで確認する。廃止APIだけに存在した任意Outcome入力の禁止field・不正型・未知状態・不正相関の拒否契約は退役し、別の実受付に同等検査を残したとは表示しない。Suite IDとLocal Itemは維持し、台帳のPath・検証後条件・Symbol検証辺を実Producerへ追従した。旧モジュールの依存例外も撤去した。

変更分類は内部責務・型名・未使用公開境界の整理。着手前に観測用途とParse用途、型名の意味、実Consumer、旧APIだけの保証退役を確認者と照合した。文書・横断影響確認と独立レビューを適用し、規範・準拠基準・認可・外部Effectを変えないため準拠監査は実行しない。新しいFramework・結果Validator・互換Facadeは作らない。公開総数は276を維持し、未使用値一件撤去とParseResult一型追加により値144・型132となる。

限定実行は影響する28ファイル149試験と台帳・依存4試験の計153件成功。両Package型検査、対象47TSの整形・警告を失敗とするLint、差分空白確認は成功した。型検査で新試験が旧四状態戻り型を受け付けないことを検出し、Identity受付自体を三状態へ狭めた。Root固定期待列の移管時重複一件とSymbolの旧検証辺は是正し、最終限定試験を再実行した。旧文字列診断・別責務の部分一致識別子は改変せず、既存Lint info二件も維持した。固定候補の読取り専用独立レビューは必須是正指摘0件。型の宣言／Consumer同時追従、四状態とParse三状態、未使用Validator撤去、実Producer試験と保証退役表示、台帳／Symbol、依存例外撤去、Root276項目と工程別統合未完了の区別を確認した。親担当の実測と独立読取り確認は区別し、確認者は試験を再実行していない。新しい試験物は作成せず、全体回帰・実AI・Docker・過去保持物は操作していない。

この区切りは共通結果基盤であり、各工程のparse.ts／types.tsへの責務統合、同一文書の受付統合、補助公開の全撤去とBHV／CMPの実利用接続は未完了である。276公開項目を最終形または全文書の完成Parseと表示しない。

#### 共通領域の責務整理と工程間比較のモデル接続

基本図・識別情報・Release Header・QualityとArchitectureの固定五文書比較を一括で整理した。変更分類は内容モデルのOwner・内部依存・公開境界の是正であり、規範・認可・保存形式・外部Effectは変更しない。着手前整合確認でraw／可視本文、UX固有表、Path基点、診断順と読取り回数を照合した。UI／SPEC／Architectureは存在しないChecklist種別を追加せず、既存Root台帳Parserで基本図を捕捉する修正計画も確認者と整合した。文書・横断影響の確認と独立レビューを適用し、準拠基準を変更しないため準拠監査は実行しない。

Artifact内部の基本図エンジンは表構文だけを所有し、七工程の固定ProfileとDiscovery固有条件は各工程へ移した。Checkerは従来七Pathの取得順・不存在skip・readを維持し、各工程モデルのdiagramContractだけを表示へ接続する。台帳自身のIssue・Checklist失敗を基本図診断へ混ぜない。旧Rootの基本図ParserとPath Catalogは撤去した。

parseIdentityDocumentはraw出現・一般宣言・手動改訂・リンクと出典を捕捉する。UX専用の表宣言はUX台帳モデルが保持し、Discoveryリンクの所有条件と宣言重複はSemanticが判断する。コメント／Fenceの扱い、adopter除外、一般宣言の後でUX表を集約する順序、別観測のリンク診断を維持した。Canonical Release Headerは同じ実装のままReleaseへ移管した。QualityIntegrationは最初のraw節から参照列を保持し、SemanticがArchitectureの既存単一Catalogと比較する。Checkerは元のPath基点・相対診断位置を渡し、固定五文書を重複定義しない。新Source・Facade・互換Wrapper・保存状態は追加していない。Rootは276項目（値145・型131）となる。

限定検証は単体・契約125件、台帳／依存4件、実Checker8件の計137件が成功した。基本図440条件、Identity60入力、Release Header6条件、Quality参照16条件の旧新比較もメモリ内で一致した。これらの比較条件数を正式試験件数や全入力同値の証明へ加算しない。今回専用の.crdd/tests/dm-common-boundary-au5DKTは既存Helperで回収し、終了後の不存在を確認した。両Package型検査、対象TSの整形・警告を失敗とするLintと差分空白確認を実施した。初回に検出した試験のreadonly変換と移管後の未使用Importは是正し、既存info二件は条件を変えず維持した。固定候補の読取り専用独立レビューは必須是正指摘0件。七工程Owner・共通構文・Identityの観測境界・Semantic比較・Release移管・Checker取得／診断順・旧公開撤去・Root276項目・試験／Symbol／文書追従を確認した。親担当の実測と独立レビューを区別し、確認者は試験を再実行していない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### 残るChecklist22種類のOwner統合と共通Catalog撤去

残る22種類を一括で完了した。実Consumerと文書の所在を照合した結果、旧UI／SPEC共用の三種類もUI側引渡し一種はUI、対応レビューとDetail対応二種はSPECが所有できるため、UI 9・SPEC 7・Architecture 6の非公開定義へ移した。文言・順序・派生列を変更せず、工程間Import・定義の複製・期待列取得APIは作らない。旧artifact/phase-checklists.ts、createPhaseChecklistItemsのRoot公開と全本番・試験参照、SourceのSymbol宣言を撤去した。

既存ui/parse.ts、spec/parse.ts、architecture/validation.tsのparseUiDocument／parseSpecDocument／parseArchitectureDocumentが、原文・Artifact・全表・可視Checklist節と出典・今回の期待項目・旧構文失敗理由を返す。kind／modeを明示し、不正値やPathからの推定fallbackを設けない。Architectureは通常用とTemplate専用の期待列を別kindとして維持し、modeで自動統合しない。UI／SPECの意味Parserは同じ非公開定義を直接利用する。Architectureの本文初回取得とChecklist二回目取得・理由の受渡しは維持し、意味Parser内の再評価を追加しない。新Source・Facade・互換Wrapperはない。

Checker三観測部は全Checklist条件を同じlstat・read・skip／continue・短絡・診断code／理由／表示順で完成受付へ接続した。全工程の接続後、本番Root ConsumerがなくなったinspectEvaluatedChecklist／inspectTemplateChecklistの二公開も撤去した。構文エンジンSource・判定条件・失敗理由は変更せず、七工程と同Package単体試験の内部Importへ閉じる。Rootは三つの完成受付追加と旧三公開撤去で281項目（値150・型131）を維持する。ChecklistFailure等の必要な公開型は変更しない。

全47種類の独立性試験は七工程の内容受付から観測し、全数・非空・順序・派生列と受付間の独立性を維持する。各Suiteは既存の検証内容を保ち、今回の22種×両方式にも原文・表／節の出典・不足・非表示・項目差・後続本文・不正kind／modeを追加した。内部化した構文エンジンの直接試験も全失敗理由・優先順を保持する。既存Suite／台帳／RCM-UT-001・002を維持するため新規Suite登録は不要。Symbolの検証辺は、実際に全47種を確認するChecklist Suiteに限り旧Catalogから七Owner実装へ付け替えた。他Suiteを一律に付け替えず、内部Sourceの配置・命名検査も除外しない。

最初の型検査でArchitectureのDocumentSection型Importと固定非空配列の先頭要素型を補足した。Import追加時の実行時／型専用ブロックの位置も型検査前に是正し、条件・Runtime処理は変えていない。Root内部化後の整形では一時的なWindowsのmapped-fileエラーが発生したため、その出力を成功とは扱わず通常の再実行で成功を確認した。対象17TSの整形・警告を失敗とするLint、両Package型検査と差分空白確認は成功。既存のuseTemplate提案二件はinfoであり、警告・失敗ではなく今回は変更しない。

限定検証は七工程・構文エンジン・固定Root・Reporterの99件、台帳／依存／受付4件、実CheckerのUI本文／Template、UI Detail欠落、UI引渡し、SPEC本文／Template、対応レビュー、Detail閉包の正常、Architecture Checklist、Architecture／Quality Templateの8ケース、計111件成功。実Checker8件はRootの構文検査公開を内部化する前に実行したが、本番処理・三内容受付・構文エンジンは以後変更せず、最終Rootの型検査・公開境界・全Owner単体・メタデータ検査は再実行した。今回専用`.crdd/tests/dm-checklist-closure-KvslIn`は子Process終了後に既存Helperで回収・不存在を確認した。

旧22配列とのメモリ内比較は、UI 216・SPEC 168・Architecture 144の計528条件で期待列・失敗理由が一致した。正式試験528件や全入力の同値証明とは扱わない。固定候補の独立レビューは必須是正指摘0件。Owner配分・非公開定義・Template派生列・内容／出典・エンジン一回呼出し・不正値拒否・独立性・Checkerの取得／診断順・Architecture二回読取り・旧公開／Source撤去・全47種類・Symbol検証辺・文書の完了／未完了区別を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。Checklistの残件は0であり、基本図の固定工程Profile・Identity／Release Header・その他の工程間関係・公開物全体の最終整理は別の未完了範囲として維持する。

変更分類は工程固有規則・完成受付と公開境界の整理。文書／横断影響の確認と独立レビューを適用し、規範・準拠基準・認可・保存・外部Effectを変更しないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Discovery三種類のChecklistを内容受付へ統合

Discovery三種類の期待項目を共通Catalogから撤去し、discovery/validation.tsの非公開定義へ移管した。parseDiscoveryDocumentは明示した種別・方式と取得済み原文を受け、Artifact・全表・可視Checklist節と出典・今回の期待列・旧失敗理由を保持する。Path推定・期待列取得専用Factory・新File・Facade・追加Root型はない。不正kind／modeは拒否し、期待列は別受付と共有しない。

採用REQ台帳のparseDiscoveryIndexと探索・要求の意味検査は専用入口を維持する。実在するRoot一種とTemplate三種の内容受付を閉じる新公開一件により、Rootは281項目（値150・型131）となる。分析／定義は同じ非公開配列を用い、raw構造判定・最初のEXP参照・構造不正時も継続するChecklist検査・Issue順を維持する。Checker共有観測部のRoot読取り前のearly return・Root read・Template不存在skip・read・診断理由と順序を変えず新受付へ接続し、共通Catalog・直接構文エンジンimportを撤去した。UX経路は今回変更しない。残る共通22種類とDiagramのOwner整理は未完了である。

Discovery単体fixtureは合成本文と検証内容を維持して新受付の期待列観測へ追従する。全47種類の試験は共通22＋Quality9＋IA6＋UX7＋Discovery3で全数・非空・独立性・派生順を維持する。三種類×両方式の原文独立捕捉・表／節位置・部分内容・非表示・項目違い・後続本文・不正kind／modeを反証に加えた。既存Suite／台帳／Symbol／RCM-UT-001・002は維持し、新しいSuite登録は不要である。

限定検証は文書モデル・固定Root・Reporter49件、台帳／依存／受付4件、実CheckerのDiscovery正本Checklist・理由付きOPEN等・末尾／種別・Template後続節・人間理解契約の5ケース、計58件成功。両Packageの型検査、対象7TSの整形・警告を失敗とするLint、差分空白確認も成功した。旧三配列を使う局所比較は三種類×両方式×12入力の72条件で期待列・失敗理由が一致した。正式試験72件や全入力同値証明とは扱わない。今回専用`.crdd/tests/dm-discovery-checklist-owner-ZrcPhJ`は子Process終了後に既存Helperで回収・不存在を確認した。固定候補の独立レビューは必須是正指摘0件。内容／出典・不正値拒否・旧失敗理由・独立性・early return／skip／read／診断順・raw構造とChecklist継続・EXP参照・UX維持・全47種類・Root・未完了表示と文書を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。

変更分類は工程固有規則・完成内容受付と利用側の整理。文書／横断影響の確認と独立レビューを適用し、規範・準拠基準・認可・保存・外部Effectを変えないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### UX七種類のChecklistを内容受付へ統合

UX七種類の期待項目を共通Catalogから撤去し、ux/validation.tsの非公開定義へ移管した。parseUxDocumentは明示した種別・方式と取得済み原文を受け、Artifact・全表・可視Checklist節と出典・期待列・元の構文失敗理由を持つ内容モデルを返す。Path推定・期待列取得専用のFactory・新File・Facade・追加Root型は作らない。不正kind／modeは拒否し、返却配列は別受付と共有しない。

台帳・Canonical投影・Journey関係の専用入口へ異なる文書種別を押し込まないため、完成内容受付一件をRootへ追加した。Rootは280項目（値149・型131）。分析・定義の局所評価は同じ非公開定義を使い、raw／可視本文・Handoff評価・Issue順を維持する。Checker共有観測部はUX実文書五種／Template七種の二ループだけを変更し、欠落時continue・既存lstat・read・診断理由と順序を維持する。Discovery三定義・共通エンジン呼出しはそのまま残す。共通Catalogに残る25種類とDiagram定義のOwner整理は未完了である。

既存のUX単体fixtureは同じ合成入力・検証内容を保って新受付の観測結果を使用する。全47種類の試験は共通25＋Quality9＋IA6＋UX7へ追従し、全数・非空・独立性・Quality派生順を維持する。UX七種類×両方式に内容／出典・欠落・非表示・項目違い・後続本文・不正kind／modeの反証を追加した。初回は新規試験の期待エラー名二つにIA表記が残って一件失敗した。製品は正しくUXの不正入力を拒否しており、試験期待値だけを是正して六ファイル48件すべてを再実行・成功した。台帳／依存／受付4件、実CheckerのUX正本Checklist・末尾／種別・Template後続節・Handoff拒否4ケースを加え、限定56件成功。既存Suite・台帳・Symbol・RCM-UT-001／002は維持し、新規Suite登録は不要である。

両Packageの型検査と対象7TSの整形・警告を失敗とするLint、差分空白確認は成功した。旧七配列を使う局所比較は七種類×両方式×12入力の168条件で期待列・失敗理由が一致した。正式試験168件や全入力の同値証明とは扱わない。今回専用`.crdd/tests/dm-ux-checklist-owner-ZrvJ0H`は子Process終了後に既存Helperで回収・不存在を確認した。固定候補の独立レビューは必須是正指摘0件。定義移管・内容／出典・不正値拒否・独立性・局所評価・UX読取り／診断順・Discovery維持・全47種類・Root・未完了表示・文書を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。

変更分類は工程固有規則・完成内容受付と利用側の整理。文書／横断影響の確認と独立レビューを適用し、規範・準拠基準・認可・保存・外部Effectを変えないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### IA六種類のChecklistを内容受付へ統合

IA六種類の期待項目を共通Catalogから完全撤去し、既存ia/validation.tsの非公開定義へ移管した。parseIaDocumentは種別・方式を明示し、原文・Artifact・全表・可視Checklist節と出典・今回の期待項目・旧構文の失敗理由を返す。期待列だけを返すFactory・新File・Facadeは作らない。未知kind／modeは拒否し、Pathから自動推定しない。

parseIaIndexは台帳解析、parseIaCrossProjectionはCanonical集合の横断投影であり、他文書やTemplateを流用すると契約を崩すため、完成した内容受付一件をRootへ追加する。Rootは279項目（値148・型131）。追加Root型はない。parseIaAnalysis／parseIaDefinitionは同じ非公開定義を使用し、旧可視本文に対する局所検査・Issueを増減しない。CheckerはTemplate六種と実文書四種の既存lstat・read・短絡・表示位置で新受付へ接続し、台帳解析・投影・分析・定義の別readと統合しない。共通Catalogに残る32種類とDiagram定義のOwner整理は未完了である。

全47種類の試験は共通32＋Quality9＋IA6として全数・文言非空・独立性・Quality派生順を維持する。IAの六種類×両方式に対し原文独立捕捉・表／節の位置・部分内容・欠落・非表示・項目違い・後続本文・不正kind／modeを追加した。同じ既存Suite・RCM-UT-001／002・台帳／Symbolを維持し、新規Suite登録は不要である。限定検証は文書モデル・固定Root・Reporter34件、台帳／依存／受付4件、実CheckerのIA正常分析・正本Checklist・Template Checklist・定義Mapping4ケース、計42件成功。両Packageの型検査と対象7TSの整形・警告を失敗とするLintは成功。IAの既存useTemplate提案はinfo一件で警告ではなく、今回変更していない。差分空白確認も成功した。今回専用`.crdd/tests/dm-ia-checklist-owner-yJ0Cj0`は子Process終了後に既存Helperで回収・不存在を確認した。

旧六配列を使う局所比較は六種類×両方式×12入力の144条件で期待列と失敗理由が一致した。正式試験144件や全入力同値証明とは扱わない。固定候補の独立レビューは必須是正指摘0件。定義移管・内容／出典・条件明示・不正値拒否・独立性・既存局所検査・Checkerの種類対応と取得／診断順・台帳／投影の責務分離・全47種類・Root・未完了表示を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。変更分類は工程固有規則・完成内容受付・利用側の整理であり、文書／横断影響の確認と独立レビューを適用する。規範・準拠基準・認可・保存・外部Effectを変更しないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Quality九種類のChecklistを内容受付へ統合

Qualityの九種類の期待項目を共通artifact/phase-checklists.tsのcreatePhaseChecklistItemsから完全撤去し、quality/readiness.tsの非公開定義へ移管した。既存parseQualityDocumentへ必要な場合だけ種別とtemplate／evaluated方式を明示し、入力→内容捕捉→期待項目選択→共通構文検査→失敗理由までQualityが所有する。新しい公開Factoryや期待列取得入口は作らない。Root278項目（値147・型131）は不変である。

内容モデルのchecklistContractは未指定時null、指定時は種別・方式・今回だけの期待列と元のChecklistFailureを保持する。Path推定・新しい検査・検査の二重呼出しは追加しない。不正な種別・方式は明示拒否する。原文を一度捕捉して同じ本文を評価し、analysis_detailの派生挿入位置・全項目の文言と順序・受付間の独立性を維持する。hasOpenChecklistのEOF条件とは目的が異なるため統合しない。nullの失敗理由を品質Pass・認可へ換算しない。

Checker Quality観測部は共通Catalog・期待配列・構文エンジンの直接使用を撤去した。同じlstat・read・不存在時の空本文・短絡・別read・既存診断code／文言／位置／順序で内容受付の失敗理由へ接続する。共通Catalogには残る38種類だけを保持し、共通構文エンジンはArtifactに残す。六工程へ七Factoryを分散する案は採らず、残る38種類とDiagram固定定義のOwner統合は未完了として追跡する。

旧全47種類の独立性試験は、共通38とQuality受付九種類を同じ試験内で観測する形へ追従し、全数・非空・配列独立性・派生列順を削らない。Quality九種類×両方式について正常・欠落・非表示・項目違い・後続本文・不正な種別／方式を追加した。既存Suite／台帳／Symbol／RCM-UT-001・002を維持し、新しいSuite登録は不要である。限定検証は文書モデル・固定Root・Reporter27件、台帳／依存／受付4件、Quality Reporter3件、実Checkerの品質閉包・ひな型欠落2ケース、計36件成功。対象5TSの整形・警告を失敗とするLint、両Packageの型検査、差分空白検査も成功した。今回専用`.crdd/tests/dm-quality-checklist-owner-5H7wid`は子Process終了後に既存Helperで回収し、不存在を確認した。

移管前の九配列との比較と元の構文エンジンを使う局所比較は、九種類×両方式×12入力の216条件で期待列・失敗理由が一致した。正式試験216件や全入力の同値証明とは扱わない。固定候補の独立レビューは必須是正指摘0件。定義移管・指定／未指定・不正値拒否・構文エンジン一回呼出し・独立性・派生順・全47種類・Checkerの取得／診断順・Root・文書を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。変更分類は工程固有規則のOwner統合・完成受付と利用側の整理。文書／横断影響の確認と独立レビューを適用し、規範・準拠基準・認可・保存・外部Effectを変えないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Architectureひな型・工程基本図の内容受付

旧inspectArchitectureDetailTemplateはparseArchitectureDetailTemplateへ置換した。原文・Artifact・全表・可視本文・二種類の固定必須表現と全出現・位置・局所validをresultへ保持し、旧Issueをissuesへ分ける。Checkerの可視化は同じ方法でDomain受付へ移し、lstat・別read・二種類の診断と表示順を維持する。未知kindは明示拒否する。旧名・互換Wrapper・追加Root型は残さない。

旧inspectPhaseDiagramTemplatesはparsePhaseDiagramTemplatesへ置換した。入力ごとに原文・Artifact・全表・期待図名・最初の選択節からEOF・Header・採用前の全行・後勝ちMap・不足項目を捕捉する。旧raw条件、Discovery人間理解の三条件、Headerの次行を飛ばす規則、最初の非Pipe行での停止、空名の非採用、重複後勝ち、入力順・一不正Source一Issueと不足項目の順序を維持する。未知PathはexpectedDiagrams=nullで対象外を示して原文だけを捕捉し、追加Issueや適合判定を発行しない。completeは内容捕捉の完了であり図の実在・品質Gateの成立ではない。返却期待列は固定定義と共有しない。

Rootは278項目（値147・型131）を維持する。Checklistの47配列は六つのChecker観測部と五つの工程モデルに加え、試験がRoot・横断・分析・定義・ひな型の別readで使用する。既存Parserだけではこの全受付を閉じられず、七つのFactory公開や空本文Parser経由の期待列取得へ分散しても実現手段を再公開するだけなので、今回は移管しない。Diagramの固定七対象も含め、共通Artifact内の暫定的な有限契約であり、工程固有規則のOwner移管完了とは扱わない。新File・Facade・逆Importは増やさない。

既存試験の検証内容をissues参照へ追従し、内容の独立捕捉・位置・重複／空名行・停止後の全表捕捉・対象外・部分入力・非表示内容・未知kindを反証に加えた。最初のChecker型検査でReporter試験の旧名参照一件を検出し、同じIssue比較へ追従した後に再検査した。限定検証は文書モデルとReporter42件、台帳／依存／受付4件、実Checkerの基本図欠落・Discovery人間理解・Architecture／Qualityひな型欠落3ケース、計49件成功。対象9TSの整形・警告を失敗とするLint、両Packageの型検査、差分空白検査も成功した。今回専用`.crdd/tests/dm-template-content-Le31pK`は子Process終了後に既存Helperで回収し、不存在を確認した。

旧実装とのメモリ内比較は、基本図552条件とArchitectureひな型48条件、計600条件でIssueの全field・順序が一致した。原文・コメント・Fence・CRLF、欠落・列／処置・重複・行停止・接頭表現を含む局所比較であり、正式試験600件や全入力の同値証明とは扱わない。固定候補の独立レビューは必須是正指摘0件。条件・対象外・部分内容・出典・重複・後勝ち・返却値の独立性・取得／診断順・旧公開撤去・試験・文書を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。Checker Architecture文書の同じ受付経路に残っていた旧Parser名と可視化Ownerの記載も現Sourceへ追従した。

変更分類は内容モデル・受付と利用側の責務整理。文書／横断影響の確認と独立レビューを適用し、規範・準拠基準・認可・保存・外部Effectを変えないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Qualityひな型の内容受付

Qualityの検証結果・分析・統合の三Boolean公開を、既存templates.tsのparseQualityTemplateへ統合した。原文独立捕捉・Artifact・全表・検査用本文・期待表現ごとの全出現と位置・局所validを返す。検証結果だけraw、分析／統合は従来Checkerで適用していたコメント・Fence除外を受付内へ移す。旧substring条件を保持し、節限定・列数検査・完全一致・重複拒否を追加しない。不足でも内容を返し、未知kindを明示拒否する。validを品質PassやChecklist全体の成立へ読み替えない。

Checkerのlstat・別read・Checklist受付・診断code／文言／位置／順序を維持する。旧三実装・Root公開を削除し、新一入口だけを追加する。Rootは278項目（値147・型131）。新File・Facade・互換Wrapper・追加Root型は作らない。既存の試験Suite／Symbol／台帳Identityを引き継ぎ、同じRCM-UT-002へ境界反証を追加するため、新しいSuite登録は不要である。

限定検証はQuality内容・固定Root・Reporterの37件、台帳／依存／受付の4件、実Checkerの品質閉包・ひな型欠落の2ケース、計43件成功。対象5TSの整形・警告を失敗とするLint、両Packageの型検査、差分空白検査も成功した。Rootは実importで147値を確認した。今回専用`.crdd/tests/dm-quality-template-VlC59c`と`.crdd/tests/dm-quality-template-boundary-8uGnY2`は子Process終了後に既存Helperで回収・不存在を確認した。

旧三関数とのメモリ内比較は空・適合・接頭接尾・重複・各必須表現の欠落と、raw／コメント／Fence／CRLFの124条件で一致した。正式試験124件や全入力の同値証明とは扱わない。最初の比較用コードは型注釈を除去せず起動時に停止し、型注釈を除去して再実行した。製品変更・試験物の追加は伴わない。固定候補の独立レビューは必須是正指摘0件。条件・重複／位置・部分内容・読取り／診断順・旧公開撤去・Root278項目・試験・文書を読取り確認した。親担当の実測と独立した試験再実行は区別し、後者は実施していない。

変更分類は既存工程モデルと受付・利用側の整理。文書と横断影響の確認、独立レビューを適用する。規範・準拠基準・認可・保存・実Effectを変えないため準拠監査は実行しない。工程Checklist／DiagramのCatalog、その他のひな型入口は未完了として残し、この変更を全工程の完成とは表示しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Quality状態・共通文書断面とUX引渡しの完成受付

Qualityの未完了Checklist・宣言件数のraw Boolean補助を撤去し、既存readiness.tsで原文・Artifact・全表・状態／件数宣言・出典・先頭ChecklistからEOFまでを持つQualityDocumentへ統合した。parseQualityDocumentは複数の現行Consumerが使う具体的な共通断面であり、新しい汎用文書Frameworkではない。Center／Reality状態入口はparseQualityCenter／parseQualityRealityAuditへ置換し、本文モデルと局所IssueをOutcomeへ分離した。旧公開四件を完成受付三件へ統合し、Root純減一件である。

着手前の読取り専用確認で、raw最初の状態・Centerの版接頭辞／Released Baseline除去、Center不明でもReality独立状態を検査し状態対不一致は追加しない条件、可視Checklist先頭→EOF、raw最初のLocal Item数行とNumber.parseIntを固定した。重複拒否・可視化・整数上限・新しい認可を追加しない。Checkerの初回Artifact集合→状態診断→各Checklist再read、Center初回値と後のReality再read・件数照合順を維持する。既に解析済みArtifactを受けるCanonical状態計算は、その独立した完成責務を維持する。

UXの旧二Boolean入口を、既存handoff.tsのparseUxHandoffへ統合した。contract／rootの閉じた実在二種に対し、原文・出典・選択節・全label出現・比較列・期待列と局所validを保持する。旧関数名・旧実装を残さず、indexOf、contractのH2/H3境界・Header二種除外・四label順、rootのH2境界・Header一種除外・関連label選択・三label順を維持する。非対象labelもentriesに残す。欠測null・存在する空節・不正kindを区別する。UX本文Parserは同じ捕捉モデルを保持し既存の包括診断に使い、追加診断の二重配送をしない。Template／Rootの既存read位置と文脈別の表示を維持する。旧二公開→新一公開で更に一件純減し、Rootは280項目（値149・型131）となる。

新File・Facade・互換Wrapper・Manager・保存Schema・工程間の直接型依存は追加しない。新型は正本Moduleに置き、外部が明示参照しない型をRootへ一律追加しない。試験内の二つの補助はPathと表種別を組み立てて旧Boolean oracleへ投影するfixtureだけであり、本番へ旧契約を残さない。Quality状態／Reality状態の既存全組合せ、Checklist・件数・UX引渡しの既存検証を削らず追従し、原文独立捕捉・全宣言・raw先頭・EOF・出典・非対象label・欠測／空・未知kindの反証を追加した。

限定検証はQuality・UX・公開境界・Reporterの47件、台帳・受付・逆依存4件、実CheckerのUX引渡し2ケースとQuality状態／件数／閉包の複合1ケース、計54件成功。両Packageの型検査、対象10TSの整形と警告を失敗とするLint、差分空白確認も成功した。Rootは実importでも149値を確認した。今回専用`.crdd/tests/dm-quality-handoff-1sd80y`は子Process終了後に既存Helperで回収・不存在確認済みである。

変更前実装と新モデルの局所比較は、UX引渡しの12入力×4表現×2kindの96条件、Qualityの状態・状態対・Checklist・件数90条件で一致した。比較はメモリ内だけで行い、追加の試験物・永続変換器を残していない。186件の正式試験や全入力の同値証明とは扱わない。独立レビューの必須是正指摘は0件。raw／可視・先頭値・EOF・状態対・kind別表条件、別read・表示順・直接件数比較、旧公開撤去・Root280項目・未完了表示を確認した。試験は親担当の実測、独立確認は読取りレビューであり独立した試験再実行ではない。

変更分類は工程内容モデル・完成受付・利用側の整理。文書／横断影響と独立レビューを適用し、規範・準拠基準・認可・保存・実Effectは変えないため準拠監査は実行しない。ひな型受付・工程定義Catalogなどの残る境界と公開物全体の最終整理は未完了として維持する。全体回帰・実AI・Docker・過去保持物は操作しない。

#### 台帳・横断投影とArchitecture品質引渡しの統合

Discoveryの採用要求Setだけを返す入口をparseDiscoveryIndexへ置換し、raw登録行・採用記載・出典・重複とID集合を保持した。parseUxIndexはArtifactSource受付と登録出現へ拡充し、関係集合を捕捉行から導出して重複解析を削減した。parseUxJourneyRelationsはparseUxExperienceMapへ置換し、raw Journey行・Cell列・REQ参照と出典を保持する。専用の最低7Cell・REQ列5・先頭Header／区切り／短行の扱いとSet初出順を維持する。

UX／IA横断投影はparseUxProjection／parseIaCrossProjectionへ置換し、内容モデルをresult、局所診断をissuesへ分離した。UXは旧indexOfの文字列先頭一致と次H2境界、IAは4節の一意結果がnullの場合だけ5節という専用条件を維持する。欠測・唯一の空節・重複を補完せず、旧被覆条件を維持する。UXの中立Issueを既存のChecker code・文言・相対Pathへ同じ観測位置で接続し、Issue追加によって後続readや診断順を変えない。

QualityのparseQualityDetailHandoffによるArchitecture raw再解析を撤去した。既存ArchitectureDetailModelにqualityHandoffを持たせ、原文の二表記・次H2必須・EOF非対応・最初の節・単純Pipe・段階列5／境界列6・後勝ちMap・固定候補列の最後という条件で捕捉する。可視qualityHandoffSectionsとは別断面であり、Quality Consumerは同じ既存readから構築したモデルの引渡し値だけを使う。追加のArchitecture局所Issueをここへ配送しない。旧試験の三検証をArchitectureの既存Suiteへ移し、出典・EOFと別表記の反証を追加した。試験削除・Suite／ID新設・検査設定の緩和は行わない。

変更分類は内容モデル・受付・Ownerの整理。着手前の読取り専用確認で上記のraw／可視・文字列境界・列位置・後勝ち・readと既存表示を固定した。新File・Facade・互換Wrapper・保存Schema・工程間の直接型依存は追加しない。新しい内容型は正本Moduleに置き、外部の明示型ConsumerがないままRootへ追加しない。Rootは旧専用Parser1件を撤去して282項目（値151・型131）となる。規範・準拠基準・認可・保存・実Effectは変えないため、文書／横断影響・限定試験と独立レビューを対象とし準拠監査は行わない。全体回帰・実AI・Docker・過去保持物は操作しない。

限定結果は台帳・本文・投影・引渡し・公開境界・Reporterの62件、受付・逆依存・台帳4件、実CheckerのUX／IA投影・UX関係／重複・Architecture→Quality閉包5件、計71件成功。両Packageの型検査、対象17TSの整形・警告を失敗とするLint、差分空白確認が成功した。IAの既存文字列結合にinfo1件があり警告／エラーとは区別する。Rootの実行時公開151件も実importで確認した。今回専用`.crdd/tests/dm-registry-projection-gv8v4s`は子Process終了後に既存Helperで回収・不存在確認済み。

独立レビューの必須是正指摘は0件。raw行認識・初出順、Experience Map列位置、UX indexOf、IAの一意節とnull／空、既存表示・配送順、raw Handoffの二表記・EOF・後勝ち・境界候補、同じreadと局所Issueの非配送、旧公開撤去・Root282項目・試験移植・残件表示を確認した。試験は親担当の実測、独立確認は読取りレビューであり独立した試験再実行とは扱わない。公開補助入口全体・共通領域の工程定義などの最終整理は完了していない。

#### Discovery・UX・IA本文と第一観測モデルの接続

Discovery分析・定義、UX分析・定義、IA分析・定義を既存の各validation.tsで内容モデルへ構築する入口へ置換した。原文・Artifact・期待Identity・名前付き節の全出現・表・出典と関係をresult、既存順の局所診断をissuesへ分離する。旧六inspect入口は撤去し、完成Parserへ利用側・試験を追従した。IA入口の既存型も原文・Artifact・可視表行を保持する。新File・Facade・互換Wrapper・永続Schemaは追加しない。Rootは283項目（値152・型131）で、六関数の名前と返却契約を置換する。新しい内容型を、直接の明示型ConsumerがないままRootへ一律公開しない。

着手前の読取り専用確認では、Discoveryの最初のEXP参照・raw必須文言・Placeholder・不正後も行うChecklist、UXのraw状態行数・台帳Link数・正式入力観測・Same比較・責任表・Blueprint、IAの一意exact節・可視本文とFence保持構造・部分Object／対応列・後勝ちMapを保持条件とした。名前付き節の捕捉は新しい必須見出し判定ではない。旧raw includes条件を厳密な節・可視Artifactの宣言で置き換えない。IAのexactSecondLevelSectionは重複／欠測nullと唯一の空節を区別する旧実装を維持する。

SPEC下流比較に渡していたarchitectureDefinitionsCombined／qualityDefinitionsCombinedを撤去し、同じ第一readで構築するArchitectureDefinition／QualityDefinitionModel列へ置換した。後の担当モデル用再readと統合・再利用しない。QualityにvisibleLinesを保持し、raw局所検査・Semantic表捕捉と旧可視substring比較を区別する。Semanticは固定IDのsubstringを各可視行へ照合し、exact ID集合へ検査を強めない。固定ID字句は改行を含まないため、旧文書連結のincludesとモデル列・行列のsomeは同じ出現条件である。物理件数・Directory集合は元の観測値を渡す。

試験追従時の機械編集で返却先の位置誤りを型検査が検出した。試験は今回編集前の捕捉内容から組み直し、既存の診断順・配列・拒否観点を維持した。TypeScriptのProgrammatic APIはこの環境のCompiler配布に含まれておらず、製品へ依存を追加しなかった。静的確認が成功するまで試験を開始していない。Formatterの一時的なWindows共有エラーは成功根拠にせず、通常の再実行で対象全件の整形を確認した。

Discoveryの原文独立捕捉・全探索参照・重複節・partial、UXの期待ID・状態宣言・名前付き本文と診断分離、IAの不正本文からのObject／Identity／関係保持を追加確認した。第一観測モデルでは、非表示のBHV参照を旧どおり被覆根拠に使わない反証を加えた。既存Suite・Local Itemを使い、試験削除・ID新設や検査設定の緩和は行わない。

限定結果は本文・Semantic・公開境界・Quality定義・Reporterの58件、受付・逆依存・台帳4件、実CheckerのDiscovery／UX／IAと下流Detailの10ケース、計72件成功。対象15TSの整形・警告を失敗とするLint、両Packageの型検査、差分空白確認も成功した。IAの既存文字列結合にはinfo1件があり、警告／エラーとは区別する。今回専用`.crdd/tests/dm-upstream-content-G7zQGq`は子Process終了後に既存Helperで回収・不存在確認済みである。

独立レビューの必須是正指摘は0件。raw／可視／Fenceの断面、IA一意節、partial内容、第一観測と後readの分離、旧substring条件、旧六入口撤去、Root283項目、Checklist・正式入力・Link数・診断順と未完了表示を確認した。試験は親担当の実測、独立確認は読取りレビューであり、独立した試験再実行とは扱わない。

変更分類は工程内容モデル・公開受付・Consumer搬送の整理であり、文書／横断影響と独立レビューを対象にする。規範・準拠基準・保存・認可・実Effectは変えないため準拠監査は実行しない。その他の工程間関係・台帳・横断投影、Quality Detail、共通領域の工程定義境界と公開物全体の最終整理は別の残件として維持し、全工程・全公開物の完成を主張しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### 横断・詳細・QualityとSemanticのモデル受付

ユーザーは残る四系統の継続を承認した。現在の実装区切りは、Architecture横断登録・五文書・詳細Map・詳細本文、Quality工程別分析・統合・定義、Semanticの明示表受付と、既存Reality／品質Gateの責務確認である。Discovery／UX／IA等の本文モデル統一と公開境界全体の最終整理は未完了であり、四系統すべての完成とは表示しない。

着手前に読取り専用確認で、横断節非空なら固定五文書、可視見出しとFence保持構造の分離、未知Fileの旧例外、詳細Structureの番号任意・専用終端、行filterと先頭行除外、初回本文とChecklist再読取りを固定した。Qualityはraw本文を対象とし、H3・次H2必須・EOF許容の違い、先頭節と後勝ちMapを維持する。単一の汎用文法へ変更しない。

旧inspectArchitectureCrossModelIndex／inspectArchitectureCrossModel／inspectArchitectureDetailMap／inspectArchitectureDetailとinspectQualityDefinitionをparse入口へ置換し、原文・Artifact・内容節・表・出典と部分関係をresultへ、診断をissuesへ分離した。QualityAnalysis／QualityIntegrationを既存analysis.tsで構築し、Coverage節だけを返す旧公開を撤去した。各モデルの型は正本Moduleに置き、外部が明示参照していない新型をRootへ一律追加しない。新File・Facade・互換Wrapper・保存Schemaは追加しない。Rootは283項目（値152・型131）である。

Semanticの表Lexer・明示見出し・先頭表・連続行・元の行番号を工程側の専用捕捉へ戻した。compileSemanticIrはArchitectureDetailModel、compileQualitySemanticRelationsはQualityDefinitionModel列を受け、旧SemanticSourceDocumentの公開型とSemantic内のraw表解析・実行形態再解析を撤去した。Hashのみ従来raw原文を使い、QA Path Identity、Local IDのexact出現個数、最初の実行形態表と最初の一致行、不明null、診断順を維持する。局所ParserのIssueとSemanticのIssueを相互代用しない。

Checkerは既存の同じreadで得た原文からモデルを構築し、観測の追加・統合をしない。QualityのCoverage欠測時の先行停止・実在集合と、Architectureの別read Checklistを維持する。Reality Graphは既にManifest・実在ID・試験台帳・前提Issueのモデル受付、品質Gateは固定改訂版・必須確認集合・同版結果の受付であり、これらへ本文の直接受付や宣言PASSからの成功推定を追加しない。

既存試験の観点を維持して新受付へ追従した。旧横断試験の可視／構造別引数は、同一raw原文から両断面を構築する試験へ移し、登録Link・見出し・構造Fence・未知Fileの拒否を残す。固定公開期待の改名後の辞書順追従不足を単体で検出し、期待値をSourceから生成せず固定Literalの並びだけを是正した。試験準備の断片組立ては試験内だけに置き、本番へ旧契約Wrapperを残さない。

限定検証は本文モデル・Semantic・公開境界・Reporter・Reality・品質Gateの80件、逆依存・受付・台帳4件、実CheckerのArchitecture横断／詳細とQuality閉包8件の計92件が成功した。両Packageの型検査、対象20TSの整形と警告を失敗とするLint、差分空白確認も成功。Lintには既存tools-naming試験の文字列結合にinfo1件があり、警告・エラーとは区別する。今回専用`.crdd/tests/dm-content-models-afNjwX`は子Process終了後に回収・不存在確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

独立レビューは文書追従1系統・2箇所を指摘した。Architecture本文に残った旧Quality第4引数ArtifactSourceの説明を現行4引数・モデル捕捉へ更新し、未完了一覧から撤去済みCompiler生本文解析を外して、実際に残る別観測combined・他工程本文・公開最終整理と区別した。製品Source・判定・診断・試験は変えず、是正後の文書の独立再確認で残る必須指摘0件を確認した。Crossの旧二段可視化と新直接可視化は既存二Helperの状態機械・同幅コメント除去・Fence境界から同値と確認した。これは全入力の実測同値証明ではない。試験は親担当の実測、独立確認は読取りレビューである。

#### Architecture登録台帳の内容モデル

変更分類は既存モデルの内容捕捉と受付・利用側の追従。既存relations.tsのArchitectureRegistryModelへ原文の独立捕捉・Artifact・全表行・台帳節・出典付き登録行を加えた。公開名・公開数282項目・保存形式・既存診断は変更せず、新File・Facade・互換処理を追加しない。登録内容から実在・品質・認可を推定しない。

着手前の読取り専用確認で、対象は表行だけではなく台帳節の全行である点、冒頭のReady観測と登録評価前の再読取りを統合しない点を固定した。最初の正確なH2区画・各行の最初の定義Link・全UI／SPEC出現順・集合と重複列・空と欠測を維持する。Checkerの同じ再読取りをraw捕捉してParserへ渡し、横断モデルの既存可視本文も同地点から作る。読取り回数・順序・診断順を変更しない。

既存試験を撤去せずArtifactSource受付へ追従し、行位置・重複・通常文行・同名節先頭選択・原文捕捉・診断との分離・空と欠測を追加確認した。Architecture・Semantic・公開境界・Reporterの46試験、受付・逆依存・台帳4試験、実Checkerの台帳被覆・入力関係・重複拒否・隣接横断モデルの4ケース、計54件が成功した。両Packageの型検査、対象4ファイルの整形・警告を失敗とするLint、差分空白確認も成功した。今回専用`.crdd/tests/dm-registry-boundary-juxWuM`は子Process終了後に回収・不存在確認済み。

独立レビューの必須是正指摘は0件。旧抽出条件、通常文行、出典と重複、先頭節選択、モデル／診断分離、冒頭Ready観測と登録前再読取りの分離、公開名・数と完成範囲を確認した。試験実行は親担当、独立確認は読取りレビューであり、独立した試験再実行とは扱わない。横断モデル・詳細本文などは今回の完成範囲に含めない。全体回帰・実AI・Docker・過去保持物は操作していない。

#### Architecture分析・定義の内容モデル

BHV本体は現行Checkerに直接の本文取得がなく、ひな型の存在確認だけであるため、未使用Parser・Readerを新設しなかった。次の実利用区切りとして、既存architecture/validation.tsの分析・定義をparseArchitectureAnalysis／parseArchitectureDefinitionへ置換した。旧ArchitectureBodyModelと旧2検査入口を撤去し、原文・Artifact・名前付き内容と出典を持つArchitectureAnalysis／ArchitectureDefinitionへ分けた。モデルはrelationsを保持し、診断はDomainOutcome.issuesへ分離する。Rootは282項目（値151・型131）で、新File・Facade・互換Wrapper・保存Schemaは追加しない。

分析はUI／SPEC観点・期待Identity・宣言・正式入力・継承契約・設計・九観点評価・処置・統合時確認・Checklistを、定義は責務・両入力・統合・構造・データ・失敗・品質・未確認・移行・引渡し・現行照合を保持する。exact見出しの全出現と先頭選択を分け、空／欠測・出典・全表行・原文を保持する。表は最初のHeader・直後Separatorと途中列幅不正nullを維持し、nullでも部分内容を原文・節・全表行へ残す。局所チェックは捕捉した節・表・構造断片を使い、旧Raw検査を別入口で再実行しない。

変更分類は内容モデル・公開受付・Consumer搬送の整理。着手前にひな型・現行分析／定義、九観点・未確認表・Placeholder・Ready条件、別readのChecklist理由、関係出現と物理ID集合を照合した。読取り専用の独立確認で、モデルへissuesを混在させずUI／SPEC同様にOutcomeへ分ける条件を取り込み、2回目read・exact表・判定語彙・partialの分析列保持を固定した。Checkerは1回目raw読取り→2回目Checklist読取り→モデル構築の順を維持し、同一改訂の保証を作らない。Semanticのarchitecture_inputsは分析モデル列から分析済み集合を導出するが、UI／SPEC期待集合・実在Directory集合は観測値のまま渡す。

旧単体・Reporterの検証内容を削らず新モデルへ追従し、原文の独立捕捉、issuesとの分離、期待Identity／view、正式入力・構造・関係・九行と行位置、同名節の全出現と先頭選択、途中幅不正のpartial内容を追加確認した。Rootの固定公開集合とSymbolの既存Semantic Suite検証辺を追従し、Suite・試験ID・品質義務は新設しない。

限定結果はArchitecture・Semantic・公開境界・Reporterの46試験、受付・逆依存・台帳4試験、実Checker結合7ケースの計57成功。九観点、未確認集合、候補／Ready、構造、Placeholder、正式入力節の境界を維持する。旧処理と新モデルは現行68分析／定義に通常・Tab見出し・重複節・幅変異・コメント・Fence・CRLFとReady／Checklist理由を与えた1,904条件で、関係と診断が一致した。正式試験1,904件や全実装の同値証明ではない。

最初の静的確認で整形1件が失敗した後、同一コマンド列の単体46件が実行される検証順序の逸脱があった。この実行を正式成功根拠にせず、整形を適用し、型・Lint・整形の成功を確認してから限定46件を再実行した。Windows共有エラーでFormatterが書き込めなかった途中結果も最終の成功と区別する。検査設定・安全判定・期限は変えていない。

固定候補の独立レビューは、追加したSemantic型importが責務ヘッダーより前にある配置1件を指摘した。importをヘッダー後の既存群へ移し、型の参照元・公開集合・判定・I/O・試験本文は変更していない。型検査・整形・差分確認と独立再レビューで是正を確認し、残る必須指摘は0件。Outcome分離・partial・exact条件・二回read・物理集合・旧公開撤去・Symbol・未完了表示には必須指摘がなかった。

結合のTEMP／TMPは今回専用`.crdd/tests/dm-architecture-boundary-GmRkQi`へ閉じ、子Process終了後に既存Helperで回収・不存在確認済み。文書／横断影響・独立レビューを確認し、規範・準拠基準・認可・実Effect・保存は変えないため準拠監査は行わない。全体回帰・実AI・Docker・過去保持物は操作していない。Architecture登録表・横断モデル・詳細全体、Quality・他工程、Reality／品質Gateへの接続は未完了として残す。

#### Definition対応の八観点根拠モデル

SPECのparseSpecDefinitionCorrespondence／SpecDefinitionCorrespondenceへ、原文・Artifact・全表行・対象改訂表・正規対応行・各先頭根拠節と八観点表の内容・出典を保持した。UI／SPEC定義はcorrespondenceTitle／correspondenceSectionsへ旧exact題名・見出しの先頭本文を保持する。欠測と空節、H3通過とH2終端、EOF、最初のHeader／直後Separator／幅連続を維持する。短Cellを構築時に補完・拒否しない。

八観点の比較はSemanticのevaluateDefinitionPairEvidenceへ移し、閉包・理由・改訂の全体比較はinspectDocumentRelationsのui_spec_evidenceへ統合した。CheckerはSpecIndex実モデルと即時評価列を渡し、期待集合・理由集計・不整合flagを独自に作らない。旧4公開入口・SpecCorrespondencePairと不要になったspec/correspondence.tsを撤去した。新規公開は完成Parser1・即時比較1・モデル1で、Rootは281項目（値151・型130）となる。新File・Facade・Manager・Store・保存Schemaを追加しない。Symbolから旧Sourceと検証辺を撤去し、Root提供元の固定契約も追従した。

変更分類はモデル・意味比較・公開境界の整理。着手前に旧四入口・ひな型・正式対応文書、fresh読取りとFingerprintの先行raw観測、短Cellの例外時点、八行・八観点の前提とevery短絡、全体の三診断順を照合した。全ペアを先読みしてから評価する代替は、例外後に後続Fileを読んでしまうため不採用。即時比較の独立公開はこの実Consumerの必要性による。読取り専用の独立確認は、旧例外を両定義read後へ残すこと、訪問済み理由だけ返すこと、exact見出しと実測Fingerprintの世代を変更しない条件で着手可能とした。局所解析が常に捕捉済みモデルを返す既存実態もUI／SPEC構築関数の型へ明示し、partial・局所違反を消したり品質Passへ変換したりしない。

旧試験を削らず、モデル抽出はSPEC、八観点比較・全体Issue・例外はSemanticへ追従した。原文の独立捕捉・出典行・正規Path・大小hex・短行・幅中断・先頭根拠、両定義の題名・exact節・空／欠測・同名先頭・H3通過を追加確認する。Checkerには実Fileの対応行を短Cellへ変異し、両定義read後のTypeErrorと後続ペア未読取り、読取り関数のfinally復旧を確認する1ケースを追加した。既存のSuite・Local Item・試験IDを使い、新しい本番故障注入Hookを作らない。

限定結果はUI・SPEC・Semantic・公開境界・Reporterの60試験、受付・逆依存・台帳4試験、対応根拠・定義・Coverageと例外境界の結合6ケース、計70成功。両Packageの型検査、変更13TSの整形・警告を失敗とするLint、差分空白検査を確認した。既存tools-naming試験のTemplate提案info1件は無関係に修正しない。Formatter書込み時の一時的Windows File共有エラーは最終の整形確認成功と区別する。旧処理と新モデルは現行32対応の節変異・欠測・Tab見出し・CRLF・Fence・短Cell・改訂の514条件で判定・訪問理由・例外・Issue順が一致した。正式試験514件や全実装の同値証明ではない。

結合のTEMP／TMPは今回専用`.crdd/tests/dm-evidence-boundary-51nH6t`へ閉じ、子Process終了後に既存Helperで回収・不存在確認済み。意味比較の四文字一致・正規化・理由書式等は変更しておらず、独立した意味採用を証明しない。固定候補の読取り独立レビューは判定・出典・例外時I/O・公開撤去・試験移植・Symbol・未完了表示を確認し、必須是正指摘0件だった。

着手案で検討したpairKeyの評価返値への追加は行わず、旧invalid／reasons形状を維持した。現Consumerは対応モデルの行順で即時評価し、全体比較はその評価列と対応モデルを使う。評価返値自体が独立したpair相関を証明するとは主張せず、新しい相関検査・識別子・判定条件を追加しない。この計画との差は既存判定・例外・I/Oの保証変更ではない。

文書／横断影響・独立レビューを確認し、規範・認可・実Effect・保存・準拠基準は変更しないため準拠監査は行わない。全体回帰・実AI・Docker・過去保持物も操作していない。

#### Architecture／Quality担当モデルへの接続

SPECに残っていた3つの担当用Parserと3型を撤去した。既存architecture/details.tsへArchitectureDetailAssignment／ArchitectureDetailTrace、quality/definition.tsへQualityDetailAssignment、quality/analysis.tsへQualityDetailTraceと各構築入口を置く。4モデルは原文・Artifact・全表行・出典を保持する担当契約であり、Architecture／Quality文書全体の概念モデルや自由文の意味解釈が完成したとは扱わない。既存3入口・3型を工程Owner別の4入口・4型へ置換し、Rootは283項目（値153・型130）となる。新File・共通Package・Facade・保存Schemaは追加しない。

変更分類は工程担当のOwner・入力搬送・公開契約の整理。着手前に旧定義／領域の先頭ID・最初の所属参照・厳密な担当行頭、中央表の六列／五列・後勝ち・Owner／Area重複・空Area、可視本文全体からの発行ID抽出、別観測combined読取りを照合した。読取り専用の独立確認は、表の採用行だけへID抽出を狭めないこと、定義／領域をkindと期待Identityで区別すること、空の最初の所属を後続から補完しないこと、Owner内で可視化して旧範囲を維持することを条件として着手可能とした。規範・認可・実Effect・保存・準拠基準は変更せず、文書／横断影響・限定回帰と独立レビューを行い、準拠監査・全体回帰・実AI・Docker・過去保持物操作は行わない。

Checkerは同じread点の原文と列挙元Identityをモデル構築へ渡す。モデル型同士は依存せず、Semanticだけが合成する。手製issued／quality集合、合同中央表、owner／ownership Wrapperは撤去する。初回combined本文と後のモデル用読取りは既存の別観測として維持し、同一世代や一括Snapshotの保証を作らない。QA側のサイズ比較・combined includes・実在件数・一診断と配送順も変えない。

旧SPEC Parser試験の検証内容を削らず、Architecture担当／中央表とQuality担当／中央表の各Owner試験へ移した。原文の独立捕捉、期待Identityと本文宣言の分離、出典行、空の先頭所属、別行／行内重複、不正行ID、Fence／コメント、空Area・後勝ちも確認する。Semantic／Reporter／固定公開集合をモデル入力へ追従した。初回の限定実行では、Root固定期待値の改名後リストが文字列順になっていない1失敗があった。期待Symbol集合を変えず静的な並びを是正し、最終の7ファイル68試験は成功した。Symbolは既存Suiteへ実OwnerとMarkdown基盤の検証辺を追従し、新Suite・試験ID・義務を増やしていない。

受付・逆依存・台帳の限定4試験、既存Checker結合7ケースも成功し、今回の限定範囲は計79試験成功。両Packageの型検査、変更14TSの整形・警告を失敗とするLint、差分空白検査を確認した。既存SPEC試験のTemplate提案info1件を無関係に自動修正していない。旧固定Parserと新担当モデルは、通常・重複・先頭欠測・先頭ID・空Area・列数不正・コメント・Fence・CRLFの70入力で旧抽出結果が一致した。これは正式試験70件や全実装の同値証明ではない。結合のTEMP／TMPは今回専用`.crdd/tests/dm-assignment-boundary-vuPQYd`へ限定し、子Process終了後に既存Helperで回収・不存在確認済み。

固定候補の読取り独立レビューは、工程Owner・型・出典・部分情報、旧条件・取得順・診断配送、移管試験・Symbol・公開契約・文書を確認し、必須是正指摘0件だった。実測の再実行と独立の読取り確認は区別する。

残るモデル化は、Definition対応の八観点根拠、BHV本体と実利用、Architecture／Qualityの担当以外の本文、他工程、既存Semantic Compiler・Reality／品質Gateへの全体接続である。担当モデルの完成や局所試験成功から、これらの成立を推定しない。

#### 下流担当の期待関係と比較のSemantic移管

CheckerのexpectedDetailRelations生成と、SPECのinspectSpecDetailDownstreamを、既存inspectDocumentRelationsのui_spec_downstreamへ統合した。入力はUiDetailIndex／SpecDetailIndex／SpecDefinitionと既存の下流担当投影・観測断面であり、期待MapをCallerに構築させない。Detail対応比較と下流比較は一つの私有導出処理を使い、定義出現順・索引の後勝ち・欠測時の省略を保つ。旧公開操作と専用Requestを撤去し、Rootは281項目（値152・型129）となる。Wrapper・新File・新Reader・保存Schemaは追加しない。

変更分類は既存意味比較のOwner・公開受付の整理。着手前に旧比較本体・Callerの期待導出・実在件数と定義出現列、初回combined読取りと後の所有投影用読取り、中央表・領域・QAの条件を照合した。読取り専用の独立確認は、UI Directory件数・実在SPEC件数をモデル配列長に置換しないこと、別読取りを統合しないこと、QAサイズ比較をexact集合一致へ強めないこと、Single／Shared／Joint・別行重複・空Area・後勝ち・一診断を維持する条件で着手可能と確認した。限定回帰・独立レビュー、文書・横断影響と公開集合・台帳を確認する。認可・実Effect・規範・準拠基準を変えないため準拠監査は行わない。

SPECの旧下流被覆試験を、反例・Oracle・入力不変性を削らずSemanticへ移した。手製の期待Mapは実工程モデル構築へ置換し、欠測した索引・定義、重複定義、BHVの後勝ちを追加確認する。初回47試験中1失敗は、追加した定義fixtureのリンクが既存Parserの正式Path条件を満たしていなかったためで、実モデルが明示参照を保持する正規Pathへ是正した。Parser・検査条件は緩めていない。移管先Suiteの既存SymbolにSPEC Detail解析Ownerとの検証辺を追加し、Suite・Local Item・試験IDを新設しない。

最終限定結果は、SPEC・Semantic・公開境界・Reporterの47試験、受付・逆依存・台帳の4試験、既存Checker結合7ケースの計58成功。両Packageの型検査、変更8TSの整形・警告を失敗とするLint、差分空白検査は成功した。既存試験のinfo級Template提案1件は失敗ではなく、無関係な自動修正は行わない。旧固定比較と現行分岐は、現在の取得モデルに欠測・Owner除外・中央行除外・件数・combined本文・QA／発行済み集合の変異を与えた185条件で同じIssueを返した。これは正式試験185件や全実装の同値証明ではない。結合のTEMP／TMPは今回専用`.crdd/tests/dm-downstream-boundary-9OkUeF`に限定し、子Process終了後に回収・不存在確認済み。

固定候補の独立レビューで、Symbolの移管先Suiteに追加予定の検証辺が反映されていない1件を検出した。辺を1件追加し、symbolId行の書式も是正した。旧SPEC Suiteの辺は維持し、JSON解析・対象Symbol実在・重複なしと、台帳／Symbolの限定1試験を再確認した。製品の比較本体・入力搬送・I/O・診断条件・移管試験本文には必須指摘がなかった。

この区切りで閉じたのは期待関係の導出と比較のOwnerである。ARCH／QA定義・領域・中央表の部分Parserと所有投影型は実Consumerがあるため維持し、工程Ownerの完成モデル化は未完了として残す。Raw combined本文の旧includes・別読取りも維持し、それらが新しい同一世代モデル契約を満たすとは主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。

Screen／Detail対応区切りでは、UiScreenへ目的・Composition・Part内容・Interaction・状態・Accessibility・昇格・未確認・出典を、SpecDetailCorrespondenceへ対象・両方向被覆・関係・Gap・引渡し・出典を保持する。現行PRTはScreen内の記述であり、独立part.mdやReaderを新設しない。現行Checkerが直接取得しないBHV本体も、未使用のParser公開や新しい読取りを先回りで追加しない。今回の対象は既存取得のScreen／PartとDetail対応根拠→Semantic→Checkerであり、BHV本体・Definition対応の八観点根拠・下流Ownership・CMP等は未完了として残す。

変更分類は複数Ownerのモデル・比較契約変更。着手前にScreen／Behavior／対応根拠のひな型と正本、旧Screen抽出・Detail対応比較、CheckerのI/O・件数・Mapと既存検証を照合した。独立確認者は、対象UIの最初の全本文一致、全表行の最初のID、期待Screen ID、欠測時の関係0と行情報保持、Pass／確認文言の旧includes、後勝ちとDefinition件数、両節形の出典保持を条件として着手可能と確認した。限定のモデル・Semantic・診断・公開境界・台帳・既存Checker結合、型・整形・Lintと独立レビュー、文書／影響確認を行う。規範・保存・認可・準拠基準は変更せず、準拠監査・全体回帰・実AI・Docker・過去保持物の操作は行わない。

既存ui/spec types.ts／parse.tsとsemantic/relations.tsに接続し、新File・Facade・Store・保存Schemaは増やさない。旧public parseSpecScreenRelations／inspectSpecDetailCorrespondenceとSpec内部の部分対応Parserを撤去し、完成parseUiScreen／parseSpecDetailCorrespondenceと実モデル入力のui_spec_details比較へ置換する。Rootは283項目（値153・型130）となる。Checkerはモデルを同じread点で捕捉し、Caller製の比較用tuple Setを新入口へ渡さない。下流Owner検査に必要な旧期待MapはCheckerへ残し、その未完了範囲を明示する。Sourceの抽出試験はUIへ、比較試験はSemanticへ内容を保持して移す。以下には先行区切りの結果を時点を分けて保持する。

Screen／Detail対応区切りの限定結果：モデル・Semantic・診断・公開境界・Markdown・Outcomeの8ファイル68試験と、受付・依存・台帳の限定4試験は成功した。Checker結合7ケースは6成功・1失敗であり、限定結合全件成功とは扱わない。両Packageの型検査、変更Source／試験の整形、警告を失敗とするLint、差分空白検査も成功した。旧実装と現行モデル比較のメモリ上206条件では、診断・順序・欠測・重複・後勝ちの一致を確認した。これは正式試験206件や全実装の同値証明ではない。独立レビューはSource・利用側・移植試験・台帳・未完了表示を確認し、必須是正指摘0だった。

未解消の結合失敗は「UI／SPEC Detailの領域担当はRelation別に閉じる」の初期正常確認である。現在文書を複製した入力に対し、今回変更前の固定Checker実装と現行実装の双方が同じ下流Coverage診断を返すことを別の自己生成領域で確認した。下流Ownerの現行文書と中央対応表に既存不整合があり、例として中央表がPRT-000020.spec-000030をexecution-intelligenceへ割り当てる一方、原因確認時点の領域文書では機械取得対象の担当行がなかった。今回のScreen構築・Semantic比較を通すために検査を緩めたり、複数領域の担当を推測で修正したりしない。下流Ownershipモデル化に入る前に、各領域Ownerの正本と中央表を照合して解消する。今回生成した結合・原因確認領域はすべて回収・不存在確認済み。全体回帰・実AI・Docker・過去保持物の操作は行っていない。

#### 下流担当の文書追従確認

変更分類は既存担当の文書伝播是正であり、製品Source・公開IF・保存・認可・検査条件を変更しない。旧版の局所表、現在のArchitecture定義・詳細、中央表と既存Parserの取得条件を照合し、読取り専用の着手前確認を行った。文書の参照・重複・担当境界と横断影響を確認し、独立レビューと限定の解析・結合確認を行う。準拠基準・上位要求を変えないため準拠監査は行わず、全体回帰・実AI・Docker・過去保持物も操作しない。

10件の閉包差分は、旧Domain Model領域7件とEI領域3件に分かれる。EIの旧局所表はeb514eb51の親版にあり、現行詳細にもARCH-000007／ARCH-000016／ARCH-000018のPartial表と同じ3Relationの維持宣言がある。今回、その宣言を一つの担当行へ構造化し、中央表への参照に3ARCHを併記する。旧機能・評価候補・時間的意図の全面実装を復活させず、新しいCovered表も設けない。

旧Domain Model側は、単なるFile移動として一律に文書モデルへ戻さない。先行調査で未確定として残した7件を、3分離後の責務正本と実Consumerに照合した。採用済みの分離境界に従う配置伝播であり、新しい業務責務・API・モデル間依存は追加しない。

| 対応関係 | Architecture定義 | 現在のモデル担当 | 担当しない処理・根拠 |
|---|---|---|---|
| PRT-000001.spec-000001 | ARCH-000001 | document-model：成果物検査の値・関係 | Checkerの実行・表示、意味採用は移さない |
| PRT-000005.spec-000009 | ARCH-000008 | execution-model：資源・回復・Operation記録 | 診断の生成・原因分類・Probeは上位と技術Ownerに残す。Coordinatorの既存Checkpoint保存へ接続済み |
| PRT-000006.spec-000010 | ARCH-000009 | configuration-model：Manifest読取り、document-model：期待3IdentityのContext照合 | Root技術検証はVC、結合・選定は上位。AMのManifest読取りとWBのContext取得で分担を確認し、モデルを直接依存させない |
| PRT-000006.spec-000031 | ARCH-000009 | モデル担当なし。旧担当を撤去 | WB repository-action.tsがVCのcommitChanges／pushRepositoryRevisionを直接呼ぶ。通常Commit／PushへWorkspace採用・実行保存を混入させない |
| PRT-000008.spec-000012 | ARCH-000013 | document-model：認可済みContext集約 | 認証・認可・鍵管理はAM。上位集約断面の既存Partialを維持する |
| PRT-000014.spec-000019 | ARCH-000002 | document-model：変更契約・成果物関係と実装宣言の値 | 全Consumer観測・実行はChecker、移行採用・Release判断は人間に残す |
| PRT-000018.spec-000023 | ARCH-000001 | document-model：Project Context・文書構造 | Checkerの実行・自由文の意味レビュー・品質採用は移さない |

中央表の当該UI／BHV／Relation行と、3モデルの01_Architecture.mdにある局所分担を同時追従する。複数Relationを持つUI行は担当の和集合を保持し、ARCH-ID・Relation ID・意味・診断条件は変更しない。ARCH-000013のPartial、EIの未実装義務、今回対象外の歴史的cros／platform-access等は維持し、旧domain-model領域を互換Ownerとして復活させない。この配置追従だけで上流全体の現行化・実装・品質成立を主張しない。

文書構造化後の限定確認では、既存ParserがEIの3ARCH・3Relationを重複なく取得することを確認した。現在の実Checker観測から同じ下流比較へ渡し、EI由来の3差分が解消して上表7差分だけが残ることを明示的に照合した。製品Sourceを変更せず、診断の観測だけをメモリ上で追加した原因確認であり、結合試験の成功や正式QA Passではない。SPEC／Semanticの既存21試験と差分空白検査は成功した。この確認は読取りのみで、試験用保存領域も作成していない。固定候補の独立レビューは必須是正指摘0件で、文書の時点表現だけを明確化した。

7件の配置伝播後は、実Checkerの既存下流観測・比較で専用診断0を確認した。3モデルの局所表について、ARCH集合・Relation出現列・重複なし・固定アンカー各1件、中央表の旧domain-model担当撤去、Commit／Pushへのモデル非介在を明示照合した。既存SPEC／Semanticの21試験とChecker結合7ケースが成功し、先行した結合1失敗は解消した。同数の誤差し替え、Screenとの協調誤変更、重複、完全／Shared閉包、Relation別領域、各ARCH別の被覆を削らず検証している。結合のTMP／TEMPは今回専用`.crdd/tests/dm-owner-boundary-vOibod`へ閉じ、子Process終了後に既存Helperで回収・不存在を確認した。独立レビューで中央§5に残った旧共通Root／保存Ownerの説明1件を検出し、同じ3分離の分担へ是正した。ARCH-000013のPartial・上位未接続は変更していない。全体回帰ではなく、現行の全歴史的配置や全工程のモデル化・実装・正式品質を保証しない。

台帳区切りでは、UiIndex／SpecIndexへ登録行の名前・Definition参照・正式入力・UI対応・件数宣言・出典を保持し、UiDetailIndex／SpecDetailIndexへ適用処置・領域・画面／部品／振る舞い対応・理由・出典を保持する。既存types.ts／parse.ts／validation.tsとspec/details.tsだけを使い、新しいFile・Facade・Store・保存Schemaは追加しない。UiIndexModel／UiRelationsModel／SpecIndexModelと部分parseUiDetailBindingsを撤去し、完成した台帳モデルと実Consumerの必要な検査入口へ接続する。公開は281項目（値153・型128）となる。型は旧3型を4モデルへ置換、値は必要なDetail構築2入口を追加し不要な部分Parser1入口を削減した結果であり、公開数自体を目標にしない。

変更分類は複数Packageのモデル・公開契約変更。着手前に旧台帳認識・件数表・Detail処置・Map抽出、Checkerの取得と診断地点、Root・利用側と既存検証を照合した。読取り専用の独立確認者は、厳密な登録行構文、件数表の最初のHeader／Separator／連続行、最後の抽出成立行、Cell内の最初のID、行不正時の対応保持、combined IssueとUI集合数条件、SpecでのUI診断非追加という差を維持すれば着手可能と確認した。限定のモデル・診断・公開境界・台帳・既存Checker結合、型・整形・Lint、独立レビューと文書／影響確認を行う。規範・認可・保存・準拠基準は変えず、準拠監査・全体回帰・実AI・Docker・過去保持物の操作は行わない。

登録entryと全表行・原文は分けて保持し、局所違反でもモデルを捨てない。SemanticとUI関係検査はIndex実モデルから関係集合を導出する。SPECの件数宣言は文字列をそのまま保持する。Detail構築は期待集合を受けず、内容と抽出済み対応を返す。期待定義集合との行・被覆検査は同じ一診断へ統合した既存条件でモデルを評価する。SpecのUI対応だけを読むConsumerは同じ読取り点のUiDetailIndex.bindingsを使い、UI被覆診断を追加配送しない。旧UI抽出の検証は削らずUI側の試験へ移し、Spec側にはBHV／関係利用の検証を残す。

今回の範囲は登録台帳とDetail統合台帳である。Screen／Part／Behavior本体、Detail対応根拠と下流Ownershipのモデル化、他工程、既存Semantic Compiler、Reality／品質Gateへの接続は引き続き未完了として扱う。以下には先行する分析・定義区切りの根拠を時点を分けて残す。

台帳区切りの限定結果：モデル・診断・Semantic・公開境界・Markdown・Outcomeの8ファイル65試験、Checker受付・逆依存・台帳／Symbol／品質項目の限定4試験、既存Checker結合9ケースが成功し、計78試験成功。結合はUI Detail欠落／OPEN化、SPEC BHV・Coverage欠落、同数の関係誤差し替え、完全／Shared Owner閉包、SPEC件数、UI／SPEC登録関係を確認した。追加4試験と移植した旧UI抽出の検証は、名前付き行内容・原文・出典、未認識行、短い不正行、欠測後の前値保持、最初のID、先頭件数表と途中終了、数値不明の非補完を反証する。両Packageの型検査、変更Sourceと試験の整形・警告を失敗とするLint、差分空白検査も成功した。Symbolは既存2Suiteから共通Markdown捕捉Ownerへの検証関係を追従し、新しいSuiteや義務を作っていない。

別の限定確認では、Git Indexの旧固定台帳・Detail実装と現行4台帳のメモリ上変異を使い、入力・期待集合条件1,068件でIssue・ID・関係・件数・後勝ちMapの同値を確認した。これは正式試験1,068件や全実装の同値証明ではない。結合試験のTMP／TEMPは検証済みの今回専用.crdd/tests/dm-index-boundary-9ekFVlへ閉じ、試験Process終了後に既存Helperで回収・不存在を確認した。過去保持物は操作していない。

固定候補の読取り専用独立レビューは必須是正指摘0。登録認識／全表行、件数表境界、短い不正行、最後の抽出成立行とCell内の最初のID、combined診断、Semanticのモデル利用、CheckerのI/O・診断順、旧公開撤去とRoot281項目、Source Header、試験移植・台帳、詳細本体等の未完了表示を確認した。限定実行結果と独立レビューの根拠は区別する。全体回帰・実AI・Dockerは未実施であり、その成功を主張しない。

分析モデルの区切りでは、UiAnalysis／SpecAnalysisを既存types.tsへ、parseUiAnalysis／parseSpecAnalysisを既存parse.tsへ接続し、局所Validatorが名前付き内容・節出現・参照・構文観測から旧判定を行う。旧inspectUiAnalysis／inspectSpecAnalysisとSpecAnalysisModelは撤去する。公開集合は279項目（値152・型127）となる。UiRelationsModelはまだ既存UI台帳契約が利用する型であり、この段階では撤去しない。新しいFile・Wrapper・Store・保存Schemaは追加しない。

変更分類は複数Consumerの公開契約・内部責務変更。着手前にUI／SPECの両観点ひな型、旧実装、Checkerの取得・診断・既存被覆、公開型と既存試験を照合した。独立した読取り確認者がUI正式入力の表示ID／リンク先ID照合、SPECのPath文字列受理、禁止語の節全体検査、一意節／先頭節／次H2必須／EOF許可の差、UI／SPECの重複処置の差を保持する条件で着手可能と確認した。限定の型・整形・Lint、局所モデルと診断・公開境界・台帳・既存Checker結合の反証、独立レビューと文書／影響確認を実施する。規範・保存・認可・準拠基準は変えず、準拠監査・全体回帰・実AI・Docker・過去保持物の操作はしない。

原文中の図・例を失わないため、分析・定義モデルは取得済みsourceを独立捕捉する。これを検査用の可視本文や参照集合へ混ぜず、診断・ログ・Bundleへの自動出版は追加しない。DocumentSectionには実際の終端種別を加え、SPEC分析の正式入力だけが次H2を要求する旧条件へ接続する。CheckerのSPEC側は同じreadの原文を渡し、読取り回数・順序や診断配送を変えない。モデルのpartialと期待IDを保持し、既存UI関係検査は実分析モデルから集合を導出する。

今回の完了対象は分析モデル→局所検査→Checker／既存被覆までである。詳細・台帳のモデル化、他工程、既存Semantic Compiler、Reality／品質Gateへの接続は未完了として残す。以下には先行した定義モデル区切りの結果を時点を分けて保持する。

分析区切りの限定結果：モデル・診断・公開境界・Semantic・Markdown・Outcomeの8ファイル61試験、Checker受付・逆依存・台帳／Symbol／品質項目の限定4試験、両観点の分析・定義・台帳閉包とChecklistに関する既存Checker結合6ケースが成功し、計71試験成功。2Packageの型検査、変更対象の整形・警告を失敗とするLint、差分空白検査も成功した。追加4試験は両観点の名前付き内容・表行・原文保持・呼出し元との独立、一意節の重複、表示／リンク先ID不一致、SPECのPath文字列受理、処置重複、正式入力と処置のEOF条件を反証する。既存の試験SuiteとSymbolの接続を利用し、新しいFile登録や検証義務は作らない。

別の限定確認では、Git Indexの変更前分析実装と現行のUI／SPEC両観点4文書をメモリ上で変異した196入力について、Issueと抽出関係の同値を確認した。これは正式試験196件やモデル全体の同値証明ではない。結合試験のTMP／TEMPは既存Helperが検証した今回専用.crdd/tests/dm-analysis-boundary-bucIwgへ限定し、試験Process終了後に同じHelperで回収・不存在を確認した。過去保持物は操作していない。

固定候補の読取り専用独立レビューは必須是正指摘0。両観点の内容・出典・原文独立捕捉、旧入力・節・重複条件、partial保持、Checkerの取得・診断順、原文の非出版、Root279項目と未完了範囲の区別を確認した。限定試験結果は実装担当の実行根拠、独立レビューは別の確認根拠として区別する。全体回帰・実AI・Dockerは未実施であり、その成功を主張しない。

UI／SPEC定義の今回区切りは、名前付きの成果・表示・操作・状態・条件・振る舞い・回復・受入内容と出典を持つUiDefinition／SpecDefinitionを構築し、そのモデルから局所検査とSemantic対応評価を実行する。変更分類は複数Ownerの責務整理・公開契約変更。先行する設計記録は以下へ時点を区別して残す。

着手前にはひな型、旧2Definition検査、部分UI対応Parser、Checkerの取得点と診断配送点を照合した。読取り専用確認者が、partialモデルの保持、期待IDと宣言IDの分離、Spec側でUI全体診断を追加配送しない条件、UIの一意節／SPECの先頭節／先頭pairs_withと旧includes契約の維持を確認した。適用する確認は限定の局所・Semantic・診断搬送・公開境界・台帳試験、型・整形・Lint、独立レビューと文書／影響確認。規範・保存・認可・準拠基準は変更せず、準拠監査・全体回帰・実AI・Docker・過去保持物操作は行わない。

旧inspectUiDefinition／inspectSpecDefinitionを完成したparseUiDefinition／parseSpecDefinitionへ置き換え、parseUiSpecPairsと旧SpecDefinitionModelを撤去する。新しい内部捕捉処理と局所ValidatorはRoot公開しない。公開集合は278項目を維持し、内訳は値152・型126。UI／SPECの型・解析Source4ファイルは実責務のため追加するが、空CRUD・Facade・Store・モデルRegistryは作らない。モデル→診断とモデル→対応比較が同じ取得本文を使い、後者の取得位置・順序は変えない。

Source・試験・Symbolの追従後に候補を固定した。初回の独立レビューで、SPECのpairs_withが改行を含む場合に参照位置がmarker行へずれる一件と、UI局所Validatorの不要な旧返却用配列が見つかった。参照値までの捕捉オフセットを加え、配列だけを削除した。受理構文・重複判定のSet・他の閉包用配列は維持した。同一行／次行／空行後／CRLFの位置とIssue同値を反証へ追加した。初回の新しい位置試験は、節本文の先頭改行を含む正確なslice位置と内容行位置を取り違えていたため、原文に合わせて期待値を訂正し、表行位置を別に検証した。

是正候補ではモデル・Semantic・診断搬送・公開境界・Markdown・Outcomeの8ファイル57試験、Checker受付・逆依存・台帳／Symbol／品質項目の限定4試験、既存UI／SPEC結合の限定3ケースが成功した。2Packageの型検査と変更対象の整形・警告を失敗とするLintも成功した。別途、Git Indexにある変更前の固定Sourceと現行追跡文書のメモリ上変異140入力でIssue・抽出関係の同値を確認した。これは新たな正式試験140件や全工程の同値証明ではない。結合試験は検証済みの今回専用.crdd/tests/dm-definition-final-IKOXsWだけを使用し、終了後に既存Helperで回収・不存在を確認した。

是正後の読取り専用再レビューで位置ずれ・不要配列の解消を確認し、今回範囲の必須残指摘0だった。確認者はUI／SPEC各4入力を独立に実行し、8件の参照位置の一致と受理構文の維持も確認した。対象外の他工程モデル、既存Semantic Compiler、Reality／品質Gateへのモデル接続は未完了のままであり、今回の経路成立から全体完成を主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。

追加の漏れ確認で、Architecture後半に旧集合入力と撤去済みparseUiSpecPairsを現役として扱う説明が2点残っていたため、現在の工程モデル入力と完成Parserへ訂正した。実装・公開IF・受理条件は変更していない。現行Sourceと同文書前半の契約へ再照合し、過去の変更経緯に記録した旧名は履歴として維持する。

人間の指摘により、工程別Validationの配置整理だけではなく、工程成果物の概念モデルを先に成立させ、Semantic／Reality Traceability／品質Gateがそれを使う方針へ実装順を修正する。[文書モデルの概念設計案](../../../06_Architecture/Details/document-model/01_Architecture.md#document-conceptual-models)を正本とし、本節では変更理由と現在の範囲だけを記録する。

テンプレートの宣言・条件・関係・検証義務と現行の関係投影型を照合した。現行SpecDefinitionModel等は成果物モデル完成とは扱わない。全工程の対象内容と依存、自由文と機械的な明示列の区別、モデルと診断の分離、部分情報・出典・重複・取得単位を具体化する。独立保存Schema・Store・新しいHash・汎用モデルFrameworkは作らない。最初にUI／SPEC Definition→局所検査→Semantic→Checkerまでの経路を閉じる案とし、細かな関数移動を目的として継続しない。

変更分類は、既存実装の責務分離を導く設計具体化。着手前に工程ひな型・Owner設計・実装とConsumerを照合し、読取り専用の別確認者が意味の捏造・解析差の喪失・未接続の完成表示をしない条件で設計記録へ進めると確認した。今回更新するのはArchitectureと変更記録で、Source・公開集合278・保存形式・規範・ひな型は変更しない。独立レビューと文書・直接参照・影響の確認を実施し、準拠基準は変更しないため準拠監査とRuntime回帰は実行しない。全体回帰・実AI・Docker・過去保持物は操作しない。

設計案の読取り専用独立レビューは、工程テンプレートへの対応、モデル／診断分離、同一取得・出典・重複・部分情報、宣言と確認の区別、自由文推論禁止、Reality／Gateの別入力、型・責務と未実装表示、CHGの正本参照を確認し、必須是正指摘0だった。これはモデル実装の成立や試験成功を意味しない。Source着手前にはUI／SPECのfield・出典・欠測表現と既存規則／Consumer／反証を具体化する。現在、人間による追加判断は必要ないが、実装時に既存の受理・拒否や保証を変更する必要が判明した場合は別に影響と判断を示す。

人間合意の対象は、成果物（Artifact）を土台として工程文書モデル、その上にSemantic／品質Gate、利用側にCheckerを置く責務整理である。実装依存はCheckerからモデルへ向け、EM／CMへの逆依存・共通Facade・互換Wrapperは追加しない。現行の294公開項目を単に隠すのではなく、工程内の完成検査・横断評価・利用側の受付へ既存の処理を統合する。診断の適用条件・順序・位置、保存形式、Authority、改訂・Lockは維持する。

初回の実装区切りは、回帰選択・静的Owner・高負荷条件と段階計画・結果集約をCheckerへ移管する。文書モデルには台帳構造・実在集合・登録関係の検査を残す。既存27試験は、台帳構造10試験とCheckerの選択15試験・計画2試験へ分け、削除しない。Rootの関連14項目を撤去し、現在の公開は280項目（値155・型125）となる。旧計画Sourceと旧Root公開を残さず、CheckerのRootにも内部Helperを追加しない。

変更分類は複数Packageの責務移管・公開契約変更。着手前に台帳・両Ownerの設計・利用側と既存試験を照合し、読取り専用の別確認者が移管境界を確認した。適用する確認は限定の型・整形・Lint、既存の台帳／選択／計画／公開CLI試験、公開境界、台帳・Symbol・文書の追従と独立レビュー。標準の規範・準拠基準は変更しないため準拠監査は実行しない。全体回帰・実AI・Docker・過去保持物の操作は対象外。

初回区切り時点では、工程OwnerのSource配置・工程内の完成検査、Semanticの工程モデル接続、Observer／Publisherの内部化、残るRoot公開縮小は未完了だった。以下の配置区切りを含む限定結果と、文書モデル整理全体の完成を区別する。

初回区切りの限定結果：文書モデルとCheckerの型検査、変更したSource／試験の整形・Lintは成功した。台帳構造・選択・計画・公開境界・公開CLI・高負荷条件の6ファイル45試験、逆依存と台帳／Symbol／品質項目追従の3試験が成功した。読み取り専用の独立レビューは、旧実装と全27試験本文の対応、CLI結果、公開撤去、台帳・Symbol・型include・文書を確認し、必須是正指摘0。段階計画の本体は整形以外に変更がなく、選択は同じUTF-16順序を与える局所比較へ接続した。DM前半の整列処理は維持した。

次の配置区切りでは、工程文書固有の21実装をArtifactからDiscovery／UX／IA／Spec／UI／Architecture／Quality／Change／Releaseへ移し、12試験を同じOwnerへ追従させる。Root280・保存形式・判定・診断順を維持し、旧PathのWrapperは作らない。UxFormalInputTargetはux/types.tsへ移し、共通Artifact型がUXの参照候補を所有しないようにする。Import、固定公開元、試験台帳、Symbolを一括追従する。段階的な配置整理であって、完成検査への統合や工程間関係の分離が済んだとは表示しない。

着手前の読取り専用確認では、spec-correspondence、UI／SPEC対応、Architectureの入力網羅性、Qualityの横断Goalに解析と比較が混在することを確認した。ParserをSemanticへ抱え込ませないため、工程側の解析済みモデルとSemantic側の完成比較を次の区切りで一緒に成立させる。Artifactの工程Checklist・Diagram・IdentityとRelease Header、Spec側のUI Parserは未完了として追跡する。保留中も既存の公開検査・利用側を維持し、新しい実行許可や品質Passを発行しない。

配置区切りの限定結果：文書モデル16ファイル86試験、Checkerの診断変換と共通文書解析8ファイル32試験、逆依存・台帳／Symbol／品質項目の3試験が成功した。文書モデル／Checkerの型検査、変更したSource／試験の整形・警告を失敗とするLint、差分の空白検査も成功した。読取り専用の独立レビューは移管21 Source・12試験の本文対応、公開280項目、旧Path撤去、台帳・Symbol・依存を確認し、実装上の必須是正指摘0。記録の時点表現だけを結果書戻しで是正した。Sourceは75ファイルで、実行時の循環・未解決Import・工程間の新しい直接Importはない。既存のactivity型間の参照は今回変更していない。

今回の区切りで完了したのは工程Ownerへの配置と専用型の分離であり、工程内の完成検査への統合・工程間比較と解析の分離・残る補助公開の撤去は次に残る。全体回帰・実AI・Docker・過去保持物は操作していない。前段で記録した横断試験2失敗は本区切りの限定成功へ混ぜず、全体Passとは表示しない。

工程間比較の初回統合では、解析済み集合だけを受けるUI／SPEC対応とArchitecture入力網羅性を、semantic/relations.tsのinspectDocumentRelationsへ本体ごと統合する。旧2関数・ArchitectureAnalysisCoverageRequestは宣言とRootから撤去し、閉じたDocumentRelationsRequestでkindごとの必須fieldを保持する。返値はreadonly DomainIssue[]。旧Architecture返値は可変配列型だったが、既存Consumerは追記・変更へ依存していないことを限定型検査で確認する。旧名のWrapper・汎用Rule登録・新しい保存状態は作らない。公開は279項目（値154・型125）となる。

UI本文ParserをUIへ戻し、同一契約だった見出し抽出2実装をArtifact内部のreadMarkdownSectionへ統合する。別契約であるUIの同名見出し一意検査は統合しない。UIの重複→三者閉包、Architectureの件数→Directory集合という順序、分析件数をexact ID照合へ強めない条件、本文の観測位置・順序・診断情報は維持する。未知kindは明示拒否し、空列を全品質Passにしない。

旧2比較の試験は検証内容を維持してSemanticへ移し、未対応kind、UIの最初の同名見出し・次H2・非表示領域を反証する。Root固定期待値、Checker本番・診断試験、試験台帳・Symbol・利用側Bindingを一括追従する。着手前の別確認者は閉じた入力型と比較順・Section抽出の契約維持を確認した。Quality横断処理や既存Semantic Compilerの生表解析はこの区切りで完了としない。

工程間比較区切りの限定結果：関係比較、Architecture／Spec／UI、Markdown、Root契約、既存Semantic、台帳、Checker診断変換の9ファイル68試験が成功した。台帳・Symbol・品質項目と逆依存の3試験、CheckerのSemantic利用側9試験も最終候補で成功し、今回範囲は計80試験成功。文書モデル／Checkerの型、変更Source／試験の整形・警告を失敗とするLint、差分空白検査も成功した。読取り専用の独立レビューは2比較本体・Section抽出・UI Parser・移管試験本文の対応、旧API撤去、閉じた種別、台帳・Symbol・利用側追従を確認し、必須是正指摘0だった。

追加確認したChecker Semantic利用側では、初回9試験中1件に既存期待値の矛盾が見つかった。MCPのSymbol宣言にある検証Tool向け試験を同じCase前半でCoverageから除外しながら、後半だけ加算を期待していた。対象IDの現存をtoolTestIdsで確認したうえでCoverageへの非混入を期待する形へ是正し、製品Graph・Symbol分類は変更せず9試験成功を確認した。単なる対象削除や期待値緩和ではないことを独立レビューでも確認した。先行失敗と最終成功を区別し、全体回帰・実AI・Docker・過去保持物の操作を行ったとは表示しない。

Quality横断目標の分離では、既存inspectQualityAnalysisが取得済み統合本文のArtifactSourceを受け取り、crossModelRowsとcrossModelReferencesを返す。旧第4引数の診断PathはArtifactSource.pathへ移し、既知の本番・試験呼出しを同時追従する。Callerが既に取得した同じ本文を使い、Filesystem読取り・Root解決・診断配送の順序は変えない。旧inspectQualityCrossModelGoalsは宣言とRootから撤去し、inspectDocumentRelationsのquality_goals分岐が解析済みCell列と目標Mapだけを比較する。新しい公開Parser・Wrapper・Fileは追加せず、公開は278項目（値153・型125）となる。

旧節抽出は次H2必須でEOF代替がないため、共通Section抽出に置換しない。Raw本文へコメント／Fence除去を追加せず、旧行filter・slice・Pipe分割・trim、行順・重複・不正列数を保持する。参照はfilter前の節全体から旧正規表現で取り、Checkerの同じ位置でPathへ解決する。行不正のcontinue、目標Mapの後勝ち、重複→処置違反→最終被覆の条件・診断順は維持する。固定5モデルPath集合の比較はChecker、Quality Detailの解析と比較の分離は別の未完了範囲として残す。

旧混在試験の横断目標部分だけをSemanticへ移し、Detail部分はQualityへ残す。解析の不正行・重複・表外参照・Rawコメント／Fence・CRLF・最初の同名節・次H2必須、欠測時の目標被覆違反を追加で確認する。既存Semantic SuiteのSymbolへQuality解析Ownerを結び、試験台帳の既存Suiteを維持する。着手前の読取り専用確認者は、元の解析対象と診断順を保持した分離として着手可能と判断した。

Quality分離の限定結果：解析・比較・公開境界・診断変換の4ファイル23試験、関連する逆依存・台帳／Symbol／品質項目の3試験、台帳整合の10試験、CheckerのArchitecture ReadyからQuality Mapping閉包へ至る既存結合試験1ケースが成功し、合計37試験成功。結合試験は内部の複数変異を含む1ケースを名前で限定し、約82秒で完了した。文書モデル／Checkerの型、変更7ファイルの整形・警告を失敗とするLint、差分空白検査も成功した。読取り専用の独立レビューは、旧計算・比較・解析対象・診断順・I/O順・旧API撤去・台帳とSymbol・未完了表示を確認し、必須是正指摘0だった。

結合試験のTMP／TEMPは、既存HelperがRepositoryと実体を検証した今回専用の.crdd/tests/dm-quality-boundary-ElXTzrへ閉じた。試験Processの正常終了後に同じHelperで回収し、Rootの不存在を再確認した。既存Helperや製品の一時領域Policyは変更していない。全体回帰・実AI・Docker・過去保持物は操作しておらず、今回の限定成功をそれらの保証へ拡大しない。

先行した横断試験ファイルを含む56試験では54成功・2失敗だった。失敗は基準版から古いCoordinator公開元の固定期待値と、この実行環境での試験用Junction作成のEPERMであり、今回の製品変更で検査を緩めて通していない。関連3試験の再確認結果と分け、横断試験全体の成功とは表示しない。失敗した今回の試験用Directoryは終了処理後の不存在を確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

## 実行モデル内部責務の追加整理候補 — 2026-11-12

状態: 今回範囲限定完了。Source・試験・台帳・文書の独立レビュー必須残指摘0。Root helper24件の最小化と全体回帰は未完。

基準`38d51403f`。本番未接続となったTemporary OperationをRootから隠すだけでなく、約1,600行の実装・孤立型・Map・専用試験／fixtureを代替なしで退役した。最後の本番Callerは署名準備で、a04ecb703における署名経路一式の撤去後に再接続されていない。共有I/O・通常保存／回復・過去保持物は対象外とし、過去記録の互換再開・清掃は作らない。

共通Record取得は受理条件の比較後、既存snapshotRuntimeStateRecordへ一正本化した。旧snapshotPlainRecordの別名Wrapperは残していない。配列二種・descriptor直結の条件差は今回変更していない。State単一Snapshotの全区画を作る候補は、名前だけでAttemptへ移さずStateの跨モデル責務として残す。局所Owner移動の候補表は調査結果であり、値依存循環の解消済みを意味しない。

修復の公開Input／ResultとRoot公開縮小を利用側・試験・設計へ対応付け、固定候補の独立レビューを完了した。関係八型設定と限定検証は成功、Ownerの13親・45子の58件も正常終了し、各fixtureの終了hookに例外報告はなかった。Source・試験・台帳・文書の必須残指摘は0で、今回範囲の限定完了とする。外部Coordinator試験が必要とする24 helperはRoot限定Guardを維持して残すため、公開最小化完了とはしない。各集合の重複・先行結果と未実施範囲はEvidenceで区別する。全体回帰・実AI／Docker・過去保持物の操作は対象外。

## 実行モデル内部整理の追加区切り — 2026-11-12

基準は`c878b9798`。Sourceを53から24ファイルへ統合し、7モデルのcrud／validation／typesとstorage/store／lock、Rootに責務を揃える。旧Source Pathの互換接続は作らない。機密検査はCoordinatorの送信境界へ移し、その7値だけRoot公開から外す。この区切りのRootは364項目（279値・85型）だった。追加の公開縮減は当該区切りでは判断せず、後続の内部責務整理候補で扱う。

初期の構造移管では旧宣言663個の本文を新Ownerへ対応付け、実衝突する私有名と内部import／exportを追従した。構造変更の補助比較であり、動作同等や全境界の成立証明ではない。後続の反証で見つけた期待保持日数の引数搬送漏れ2箇所は別に是正し、既存の現在性検査へ値を届ける。Stateの短命Mapと一回使用Protocolはstate/crudへ一括保持する。通常終了・回復・修復の保存Schema、CAS、排他、Identity、既存保持設定の再観測とFailure情報は維持する。

試験の私有import・Source抽出・Module Mockを実Ownerへ追従し、試験内だけの保存閉包でも各Sourceを一度だけ組み立てる。32既存EM Suiteの初回結果と是正影響subsetの再実行を分離して記録し、最終32 Suite一括再走とは扱わない。利用側の限定対照、型・整形・lint、台帳関係の確認は成功した。独立レビューの責務説明1件は文書を是正して再確認済み、残指摘0。全体回帰・実AI／Docker・過去保持物は操作していない。

## 構成モデル内部整理の追加区切り — 2026-11-12

3分離後の構成モデルを4領域（AI選定・Network Policy・保持設定・Manifest）と保存に再配置する。Sourceは`index.ts`、各領域の`crud.ts`／`validation.ts`／`types.ts`、`storage/store.ts`／`storage/lock.ts`の15 Fileとする。以下の§8／§9は3分離時点の対応表・公開候補として保持し、今回の現在構成は[構成モデル詳細](../../../06_Architecture/Details/configuration-model/01_Architecture.md)を正本とする。

未接続の`inspectCrosTrustPolicy`／`CrosTrustPolicy`を撤去し、固定Manifestの完成読取り`readRepositoryManifest`と結果型を公開する。外部本番利用のない`inspectRepositoryManifest`はRootから外し内部検査として維持する。公開総数は8関数・2定数・14型の24 Symbolとなるが、数合わせを目的としない。Root依存、形式・Schema、固定所在、JSON条件、Lock／CAS、部分Effectと回復参照を変更せず、旧PathのWrapper・別Package・代替Trust機構を追加しない。

Manifestは旧ReaderのUTF-8置換復号とJSON.parse条件、有効hardlinkの受理を維持する。IdentityはWB／MCPの旧全文比較と同じ復号後本文のSHA-256とし、同本文へ復号される異byte列を変更扱いしない。AI選定の厳密JSON・descriptor検査はAI専用であり、Manifest／保持設定へ一律に適用しない。他設定の生byte Hash・CAS・安全条件は変更しない。

試験のdeep参照・Module Mock・Source抽出と、EM／VCの保存Consumer閉包、Co実体IDの対照、Symbol／Catalog／正式QAを新Ownerへ追従する。基準の限定検証Evidenceは当時の記録として保持し、今回の新結果は同Evidenceの追加区切りへ記録する。予定の限定確認76件・関係11型設定と独立再レビューを完了した。予定外試験の誤起動と回収観測の限界は同Evidenceへ分離し、今回の成立を全体QA・統合・Releaseへ拡大しない。全体回帰・実AI／Docker・過去保持物は操作していない。

以下の初回分離の配置表・Root候補コードは、基準版a7618c6d0での対応案を比較記録として保持する。後続の構成／実行モデル整理で廃止・統合したSource名と公開集合を、現行APIの正本へ読み替えない。現在の構成は各モデルのArchitecture・実Root・固定期待契約試験、および上記の後続区切りを参照する。

## 1. 結論と変更境界

文書モデル（document-model）、実行モデル（execution-model）、構成モデル（configuration-model）を独立した3 Packageへ分ける。**3モデル間の直接依存は0**とする。実装importだけでなく、型import、再export、他モデル型のextends／Pick、deep import、dynamic import、package依存も禁止する。複数モデルの結合はCoordinator／Workbench／MCP等の既存Consumerが担当する。

旧domain-modelの互換Facade、第4の共通Package、Manager／Registry／Store、汎用Runner／設定Reader注入は作らない。相互依存をCallbackで隠すことも採用しない。

合意した境界に従ってSource・package設定・利用側を分離した。保存物は移行・操作していない。公開InputとConsumerの接続は下記のとおり変更する候補だが、保存Path・Schema・契約ID・CAS・Lock Identity・安全判定・失敗情報・Effect順序は変更しない。

| Owner | 所有する意味 | 所有しない意味 |
|---|---|---|
| document-model | 成果物構造、文書解析・診断、Topic／Meeting、Project Context、Semantic、Reality、試験Catalog | 設定Reader、Task実行状態、認証、Recovery許可 |
| execution-model | Objective／Task／Attempt／Queue／Workspace、Blocker／提案回答、State・History・回復記録、確定済み実行入力 | 設定の探索・選定、Docker操作、Provider解析、主体解決 |
| configuration-model | 設定・宣言の値、検査、読取り／保存、設定自身の固定配置 | 他モデルの型、実行State、一括Runtime領域管理、汎用保存Helperの配布 |

変更分類はPackage境界・利用側Inputの設計是正。現行Sourceと既存保存契約を着手前に照合した。今回は設計の責務・依存・利用側閉包を独立確認し、規格の準拠基準やリリース判断は変更しない。実装・移行の監査や全体回帰は実施しない。

## 2. 依存と受け渡し

- 各モデルは必要なVC／共通Lock／Node.jsを直接使用する。実行モデルの既存DI／AD技術結果型参照は維持する。
- 文書・実行・構成モデルの間には、型を含めて矢印を置かない。
- Consumerだけが複数モデルをimportし、取得結果を受け手Ownerの要求へ明示的に投影する。
- 各モデルは受け取る値を自分の境界で検査する。「構成モデルで検査済みだから無条件受理」としない。
- 値の受け渡しはAuthorityの追加・再発行ではない。既存のPrincipal・実行許可・保存相関はそのまま保持する。
- 自Package Rootへの逆importも撤去し、内部の実Ownerを直接参照する。

| Consumerで取得する情報 | 受け手へ渡す情報 | 受け手がしないこと |
|---|---|---|
| 構成モデルのRepositoryManifest | 文書モデルへprojectId／repositoryId／repositoryRoleの3期待値 | Manifest型のimport、設定File読取り |
| 構成モデルのAiSelectionConfig＋ADの解決結果 | 実行モデルへ具体技術選定と当時の相関値 | Config Schemaのimport、設定再選定 |
| 構成モデルの保持設定 | 実行保存InputへhistoryRetentionDays | readCoordinatorConfig呼出し、設定不正時の独自default |
| AMが確定した主体 | 各モデルへ既存の要求主体・認可Context | AM再認証、OS主体による勝手な置換 |
| VCが検証したRepository | そのまま各Ownerの完成操作へ | 他モデルからRoot Capabilityを借りる、任意PathをAuthority扱いする |

### 文書の期待Identity

`readRepositoryProjectContext(root, expectedIdentity)`の第2引数は文書モデル自身の要求とする。新しい共通型は作らず、既存`RepositoryProjectContext`の3 fieldを使う。

```ts
// document-model内だけで完結する引数型の案
expectedIdentity: Pick<
  RepositoryProjectContext,
  "projectId" | "repositoryId" | "repositoryRole"
>
```

ConsumerがManifestから3値を明示的に渡す。現行の三Identity完全一致、文書実体確認、内容改訂の意味は維持し、Manifest全文・Trust・権限を文書モデルへ渡さない。

### 確定済み実行入力

`ExecutionSelection`とその検査・Hash、`TaskExecutionSelections`と組合せ検査は実行モデルが正本となる。`ExecutionSelection`はADの`ModelSelection`を基礎とし、catalogIdentity／configIdentity／role／workType／sourceを自分の実行入力として定義する。roleを構成モデルの`AiSelectionRole`への参照にしない。

構成モデルには`AiSelectionChoice`・役割別希望設定だけを残す。Coordinatorの既存選定処理がConfigとADの結果を使い、実行モデルのInputへ各fieldを投影する。Hashの正規化順序・当時の選定元・Taskの担当相関・保存JSONは不変更とする。

Objectiveの明示choiceは既存`CoordinatorObjectiveRequest`の3 fieldの局所要求として定義する。構成モデルの型import／型別名にはせず、実行モデル内部で型・非空・文字形式・data-property条件を検査する。新しい共有Choice型やRoot aliasは作らない。上位Consumerが設定Choiceを使うことは許すが、モデル同士は参照しない。

## 3. 保持設定と既存の再検証

単なる「保持日数を一度渡す」だけでは既存保証を維持できない。現行は`runtime-store.ts`の6箇所と`runtime-history.ts`の4箇所で設定を読み、出版・flush前後にも現在readyで同じ日数かを確認している。

基底のRuntimeAccess／RuntimeExecutionStorageAccessと通常Queryは変更しない。保持日数を消費する操作・分岐だけ、既存Inputとの交差型等で実行モデル自身の保持日数を受け取る。混合分岐では履歴処理に入るまで日数の存在・妥当性を要求しない。上位のRecovery入口で設定不正を一律拒否しない。

上位Consumerが既存revalidateへ「現在設定がreadyで渡した日数と同じ」を結合するのも、履歴確認を要求された呼出しに限定する。通常の認可／Repository再検証で設定Readerを呼ばない。履歴を扱うInput側だけ、既存revalidateの任意の最終引数に期待保持日数を指定できる契約へ拡張する候補とし、通常呼出しは従来引数のまま、元の10箇所の設定確認だけ期待日数を渡す。例えば業務用は通常revalidate(operation,target)、履歴境界だけrevalidate(operation,target,expectedHistoryRetentionDays)とする。Root／終端用も通常呼出しと履歴確認呼出しを同じ原則で区別する。基底型を全操作共通の設定Contextへ変えない。

実行モデルは設定Reader・構成モデル型・設定本文を受け取らない。新しいgetConfig Callback／Provider／Registryや別のCallback fieldは作らない。

| 現Input・経路 | 是正候補 |
|---|---|
| RuntimeExecutionStorageAccess.observeRepositoryの結果 | 履歴を消費する保存操作側だけ保持日数と履歴確認可能な既存再検証を要求。基底と通常観測は不変更 |
| RuntimeSettlementStorageAccess | 終端の履歴処理を行う操作側だけ同じ拡張。単なる終端実体照合へ設定要件を加えない |
| 業務RuntimeAccess | 履歴を処置する操作側だけ交差Inputを使う。通常Queryは既存Input・再検証のまま |
| VC Repository単体のRecovery読取り／修復出版再入場 | 履歴を扱う必要がある場合だけ、実行モデル自身のroot・保持日数・既存再検証を持つ要求へ拡張する。非履歴分岐は設定未取得でも従来どおり。汎用Context Packageや新Authorityは作らない |
| maintainCoordinatorSnapshotRecords／transferCoordinatorSnapshotHistoryRecords | 実際の履歴保守に必要な要求を受け、既存OwnerのRepository束縛へ値を結合する。新Mapを追加しない |

要求型は既存の保存Inputに隣接して定義し、関数の引数契約から参照する。型の統一だけを目的とした新しい公開Context階層は作らない。設定を消費する分岐では、日数未取得／不正や同期再検証のthrow／false／Promise等を既存の停止条件どおり処理する。未消費分岐では設定に関する検査も拒否も発火させない。

保持設定を消費する処置では、その処置前の設定取得不成立で当該Effectを発行せず、再検証不成立でも現行のEffect有無・未確認・回復参照を維持する。ただし、設定取得失敗を非履歴Query／Recovery全体の停止へ広げない。設定不存在時30日と明示30日を新たに区別したり、Config Hash・設定世代一致を追加したりしない。この設計は既存の現在性確認を上位へ戻すものであり、新しい常時設定ガードではない。

## 4. 共通Helperは各実Ownerへ閉じる

共通している実装があることと、共通のドメインOwnerがあることを同一視しない。Model Rootを便利関数配布口にせず、必要な境界処理だけを実際の入力／保存Ownerへ局所化する。Helper File全文の3コピー、汎用Adapterの再建、新ライブラリの導入はしない。

| 現Helperと実Consumer | 分離後 |
|---|---|
| root-and-lock：AM初期化・Store・Lock、構成のAI設定保存 | AMは自身のRoot型・初期化・保存接続を正本化。構成はconfig保存内でNode／Lockへ直接接続。generic3関数をModel RootやAM Rootへ移し替えない |
| file-snapshot：AM、実行State、AI／Network設定、Co CLI、WB検証Script | 各Ownerの内部Readerへ必要な実体・EOF・close確認を局所化。StableFileIdentityの汎用Root公開は撤去 |
| plain-data snapshot：実行要求・保存、AI設定、Co／WB／MCP入口 | 各Ownerの閉Schemaに必要な検査として保持。getter／Proxy／過剰field拒否を削らない |
| 重複Key拒否JSON：AI設定、Co CLI／送信設定、WB HTTP／IPC／診断 | 保存ReaderまたはTransportの既存入力処理内へ。JSON.parseだけで同等とせず、重複Key拒否を維持 |
| outcome.ts | 文書診断専用なので文書モデル。全モデル共通結果へ拡張しない |
| secret-validation.ts | 実行入力・Workspace投影のPolicyとして実行モデル。設定モデルへ置かない |

AMの`FilesystemStoreRoot`はAM自身のRootから必要な型として公開する候補とし、MCP／WorkbenchはAM正本を参照する。構成モデルから再exportしない。AM既存の初期化・完成操作でRootを取得し、generic Factoryの新公開は追加しない。現在AM本番19 File、MCP3 File、Workbench11 Fileの型搬送が追従対象である。

局所化では必要な小規模処理が複数Ownerに残り得る。これを理由に同一保存Protocolや正規化を変えず、既存の境界試験を各Ownerに対応付ける。分離のための検査緩和・Quota復活・新しい保護Policyは認めない。

## 5. 配置とFilesystem操作のOwner

各OwnerがVCの検証済みRootから自分の固定配置を内部で求める。他モデルから全Path集合を取得したり、Parent Pathを逆算してAuthorityを拡張したりしない。所在・実体・前後同一性・Ignore登録の失敗情報は保持する。

| 固定配置・処理 | Owner |
|---|---|
| .crdd/configの設定Fileとその保存 | configuration-model内部 |
| .crdd/domain-modelのState／履歴、実行保存用tmp | execution-model内部 |
| 文書のTopic／Meeting、Semanticの出力 | document-model内部 |
| CoordinatorのLease／Workspace／EI Store接続／Image準備／保護Mount／検証領域 | 既存Coordinatorの当該処理内 |
| AMのHost管理RootとCROS配置 | AMの既存initialization/root.ts内 |
| Workbench／MCPの保存接続、検証Script | 既存の当該Owner内 |
| Executor／Visual Previewの試験領域 | 当該検証Owner内 |

`resolveCrosRuntimeRoots`／`CrosRootInput`の実本番ConsumerはAM初期化だけである。環境探索・Filesystem Effectを持たないPath計算なのでAM内部へ移す。構成モデルのCrosTrustPolicy宣言検査とは別に扱う。

一括のRuntimePath／Area enum／汎用ensure／FromWorkingDirectory WrapperはModel Rootから撤去する。Working DirectoryからRepositoryを確定する必要があるConsumerはVCを直接利用し、その後に当該Ownerの完成操作を呼ぶ。新しい汎用Path APIは追加しない。

実行Stateの`createCoordinatorRuntimeDataArea`と`assertRuntimeStateInitializationBoundary`は同じ実行保存Owner内へ一緒に移す（実装では既存storage/ensure-area.tsへ保持し、形式だけのinitialization.tsは新設しない）。本番外部Consumerがないため前者もRoot候補から外す。旧coordinator領域の明示不存在、親実体の前後一致、排他的作成と空の新規領域確認を保持する。実行一時OperationのRoot束縛も同じ実行保存Ownerに置き、作成・再開・根拠昇格・世代・Receipt・Hash・Lock・Effect順序を変えない。

### 領域確保失敗の公開契約

`RepositoryRuntimeDataAreaBlockedError`は単純なHelperではない。現CoordinatorのObjective／Decision／Queryがinstanceofで捕捉し、Effect不明・cleanup・回復参照を公開結果へ投影している。そのため**実行モデルの既存失敗契約としてRoot公開を維持**し、宣言をstorage/runtime-result.tsへ置く候補とする。Constructorの型は実行モデル自身の失敗payloadで定義し、他モデルensure関数のReturnTypeを参照しない。

構成保存はこのクラスをimportせず、既存の設定保存Resultで失敗を返す。Coordinator自身のEI／Lease等の領域失敗はそのOwner内で処理する。上位Consumerの既存投影を追従し、単なる未実施や一般Errorへ情報を潰さない。型・公開数削減だけを目的に、新しい例外階層や共通失敗Managerを作らない。

## 6. Afterと利用側の変更

```text
40_Develop/
├─ document-model/src/
│  ├─ index.ts
│  ├─ artifact/、activity/、topic/、meeting/
│  ├─ project-context/、semantic/、reality-traceability/
│  ├─ test-catalog/、quality-change-control/
│  ├─ repository/       # 文書観測だけ
│  ├─ storage/          # 文書保存だけ
│  └─ outcome.ts
├─ execution-model/src/
│  ├─ index.ts
│  ├─ objective/、task/、attempt/、decision/
│  ├─ state/、workspace/、identity/
│  ├─ repository/path.ts
│  ├─ plain-data/       # 実行入力の局所検査
│  └─ storage/          # State／履歴／一時操作／初期化と内部I/O
└─ configuration-model/src/
   ├─ index.ts
   ├─ ai-selection/     # 設定希望値だけ
   ├─ configuration/    # 宣言・期間・固定config所在
   └─ storage/          # 設定保存と内部I/O
```

JSON／data-property検査を置くためだけの共通フォルダやFacadeは必須にしない。上のBlock内で実際の責務へ隣接させる。

| Consumer | 変更 |
|---|---|
| Coordinatorの選定処理 | Config＋ADを取得し、実行Inputへfield投影。設定型をEMへ運ばない |
| Coordinatorの通常保存・終端・業務CRUD・Recovery・履歴保守 | 保持日数を消費する操作・分岐だけEM要求へ搬送し、履歴確認呼出しに限定して既存revalidateへ設定現在性を結合。通常Query／非履歴分岐を止めず、Root単体経路も取り残さない |
| Workbench／MCP | 各モデルを別々に利用。画面／API用の結合と入力投影を既存Consumer内で行う |
| AM | Host RootとCROS所在・StoreRoot型を自Ownerへ。Manifest／Trust設定は構成、文書Identity照合は文書へ3値投影 |
| Checker | 文書モデルを利用。Manifestの設定Path定数／値は構成から得るが、モデル同士は接続しない |
| Co CLI／WB HTTP・IPC／MCP | JSON／data-property／File読取りは自分の既存入力処理へ局所化 |
| Script／試験／coverage／品質台帳／template | importだけでなく旧Path列挙、namespace／dynamic import、Source抽出、Fixtureを追従 |

## 7. 保存と検証の成立条件

保存先`.crdd/domain-model`等はPackage名とは独立した現行Identityとして維持する。Schema、契約ID、改訂、Path、Principal、Lock Identity／世代、履歴保持、回復条件、実行取消やCleanupを変更しない。AppData側Decision Store、旧形式Reader、自動移行は追加しない。

| 維持対象 | 必要な確認 |
|---|---|
| 文書解析・Relation・Topic／Meeting・Semantic | 文書Ownerの既存契約／実保存試験、Manifest三値投影の一致／不一致 |
| Task／Attempt／Blocker／State／History／CAS | 実行Ownerの既存単体・保存・再入場・Consumer結合 |
| AI設定・Manifest／Trust・Network設定 | 構成Ownerの既存検査／保存／競合／失敗試験 |
| 保持設定 | 元の10再検証位置に対応する枝の初回不正・途中不正化・日数変更・同値・Effectと回復参照、および設定不正でも通常Query／非履歴Recoveryが新たに停止しない対照 |
| 局所化したI/O・入力検査 | 別Root／Link／File置換、Windows File ID表現、EOF／close失敗、重複Key／getter／Proxy拒否 |
| 領域失敗投影 | 元例外／Resultから理由・Effect不明・cleanup・回復参照が失われないこと |
| 依存ゼロ | Sourceと型の全import、再export、dynamic import、package設定、生成宣言のモデル間参照が0 |

基準版の既存試験を新OwnerとConsumerに対応付ける。今回の設計確認を、移管後の実装・型検査・試験成立の根拠にはしない。AM表示名と判断待ち制約は保留する。全体回帰・実AI・実Docker・過去保持物の操作は実施しない。

## 8. 全Source移管表

基準版137 Sourceを全数対応する。混在Sourceを役割別に分けるため、移管後のFile数が137になるとは限らない。

| 現Source（domain-model/src配下） | Owner／処置 |
|---|---|
| `index.ts` | 廃止（3つのRootへ置換） |
| `outcome.ts` | document |
| `activity/federate-relations.ts` | document |
| `activity/operations.ts` | document |
| `activity/types.ts` | document |
| `ai-selection/types.ts` | 分割：設定のAiSelection*→configuration／ExecutionSelection・TaskExecutionSelections→execution／AD再公開→正本直接参照 |
| `ai-selection/validation.ts` | 分割：設定Choice・Config検査→configuration／実行選定検査・Hash・Task組検査→execution。Objectiveのchoice境界はexecution内部で所有 |
| `artifact/activity-table.ts` | document |
| `artifact/anchors.ts` | document |
| `artifact/architecture-details.ts` | document |
| `artifact/architecture-relations.ts` | document |
| `artifact/architecture.ts` | document |
| `artifact/change.ts` | document |
| `artifact/checklist.ts` | document |
| `artifact/discovery.ts` | document |
| `artifact/document-header.ts` | document |
| `artifact/graph.ts` | document |
| `artifact/ia.ts` | document |
| `artifact/identity.ts` | document |
| `artifact/inspect.ts` | document |
| `artifact/links.ts` | document |
| `artifact/markdown.ts` | document |
| `artifact/parse-markdown.ts` | document |
| `artifact/phase-checklists.ts` | document |
| `artifact/phase-diagrams.ts` | document |
| `artifact/quality-analysis.ts` | document |
| `artifact/quality-definition.ts` | document |
| `artifact/quality-readiness.ts` | document |
| `artifact/quality-relations.ts` | document |
| `artifact/quality-state.ts` | document |
| `artifact/quality-templates.ts` | document |
| `artifact/release.ts` | document |
| `artifact/spec-correspondence.ts` | document |
| `artifact/spec-details.ts` | document |
| `artifact/spec.ts` | document |
| `artifact/types.ts` | document |
| `artifact/ui.ts` | document |
| `artifact/ux-handoff.ts` | document |
| `artifact/ux-inputs.ts` | document |
| `artifact/ux.ts` | document |
| `artifact/validate-schema.ts` | document |
| `artifact/verification-tables.ts` | document |
| `attempt/crud.ts` | execution |
| `attempt/lease.ts` | execution |
| `attempt/repair-types.ts` | execution |
| `attempt/repair-validation.ts` | execution |
| `attempt/settlement.ts` | execution |
| `attempt/types.ts` | execution |
| `attempt/validation.ts` | execution |
| `configuration/network-policy.ts` | configuration |
| `configuration/read-tool-config.ts` | configuration |
| `configuration/storage-paths.ts` | 分割：設定2定数・config固定所在→configuration内部／実行State・tmp→execution内部／tests等→既存の検証Owner |
| `configuration/types.ts` | configuration |
| `configuration/validate-declarations.ts` | configuration |
| `decision/crud.ts` | execution |
| `decision/operations.ts` | execution |
| `decision/request.ts` | execution |
| `decision/types.ts` | execution |
| `identity/validation.ts` | execution |
| `meeting/create-operations.ts` | document |
| `meeting/markdown.ts` | document |
| `meeting/types.ts` | document |
| `objective/crud.ts` | execution |
| `objective/request.ts` | execution |
| `objective/types.ts` | execution |
| `objective/validation.ts` | execution |
| `plain-data/json.ts` | 分割：設定JSON→configuration内部／CLI・HTTP・IPC→Co／WB等の既存入力Owner内部。Model汎用公開は撤去 |
| `plain-data/secret-validation.ts` | execution |
| `plain-data/snapshot.ts` | 分割：configuration／executionの入力検査とCo／WB／MCPの各入口へ、必要なdata-property検査だけ局所化 |
| `project-context/candidate-decision.ts` | document |
| `project-context/inspect.ts` | document |
| `project-context/parse-context.ts` | document |
| `project-context/parse-quality.ts` | document |
| `project-context/parse-release.ts` | document |
| `project-context/portfolio.ts` | document |
| `project-context/read-context.ts` | document |
| `project-context/source-projection.ts` | document |
| `project-context/types.ts` | document |
| `quality-change-control/gate.ts` | document |
| `reality-traceability/annotations.ts` | document |
| `reality-traceability/catalog.ts` | document |
| `reality-traceability/discover.ts` | document |
| `reality-traceability/graph.ts` | document |
| `reality-traceability/issue.ts` | document |
| `reality-traceability/manifest.ts` | document |
| `reality-traceability/validate-manifest.ts` | document |
| `repository/create-observer.ts` | document |
| `repository/filesystem-observer.ts` | document |
| `repository/observe-symbols.ts` | document |
| `repository/path.ts` | execution |
| `repository/require-storage-area.ts` | 分割：実行保存の公開失敗契約はexecution/runtime-resultへ／requireReadyは各固定保存Owner内部。CM由来型参照を除去 |
| `repository/resolve-storage-paths.ts` | 分割：設定固定Pathはconfiguration内部／State・一時操作はexecution内部／CROS配置はAM内部／他領域は既存の利用Owner内部。一括Path公開は撤去 |
| `repository/types.ts` | 分割：文書観測5型→document／実行保存観測→execution内部／設定観測→configuration内部／CROS入力→AM内部／VC別名→撤去 |
| `semantic/coverage.ts` | document |
| `semantic/ir.ts` | document |
| `semantic/publish.ts` | document |
| `semantic/relations.ts` | document |
| `state/activity.ts` | execution |
| `state/codec.ts` | execution |
| `state/crud.ts` | execution |
| `state/history.ts` | execution |
| `state/projection-types.ts` | execution |
| `state/projection.ts` | execution |
| `state/query.ts` | execution |
| `state/transition.ts` | execution |
| `state/types.ts` | execution |
| `state/validation.ts` | execution |
| `storage/ai-selection.ts` | configuration |
| `storage/ensure-area.ts` | 分割：config確保→configuration内部／State初期化・tmp→execution内部／保護Mount・Lease・EI等→Co等の既存Owner内部。汎用Model公開は撤去 |
| `storage/file-snapshot.ts` | 分割：EM／CM／AM各保存とCo CLI／WB検証の内部読取りへ必要部分を局所化。公開共有Helperは撤去 |
| `storage/network-policy.ts` | configuration |
| `storage/root-and-lock.ts` | 分割：config保存はconfiguration内部／AM StoreのRoot・排他接続とRoot型はAM正本。generic3関数のRoot公開は撤去 |
| `storage/runtime-history.ts` | execution |
| `storage/runtime-kernel-lock.ts` | execution |
| `storage/runtime-lock.ts` | execution |
| `storage/runtime-repository.ts` | execution |
| `storage/runtime-result.ts` | execution |
| `storage/runtime-store.ts` | execution |
| `storage/semantic-store.ts` | document |
| `storage/state.ts` | execution |
| `storage/temporary-operation.ts` | execution |
| `storage/topic-meeting-store.ts` | document |
| `storage/types.ts` | execution |
| `task/crud.ts` | execution |
| `task/queue.ts` | execution |
| `task/types.ts` | execution |
| `task/validation.ts` | execution |
| `test-catalog/inspect.ts` | document |
| `test-catalog/plan.ts` | document |
| `topic/create-operations.ts` | document |
| `topic/markdown.ts` | document |
| `topic/types.ts` | document |
| `workspace/command.ts` | execution |
| `workspace/crud.ts` | execution |
| `workspace/result.ts` | execution |
| `workspace/types.ts` | execution |
| `workspace/validation.ts` | execution |

## 9. index.tsの移管候補

分離前の基準Rootは721 Symbol（値480・型241）。以下は文書294、実行371、構成25の総690 Symbolである。値には定数・検査・例外クラスも含むため、操作関数の数ではない。実装時の全Consumer型検査で確定する候補であり、公開最小化完了とは主張しない。

3モデル間の再exportは0。Rootから除いた31 Symbolの処置を次節へ記す。Root候補に出ない内部型を、他モデルの型として再exportしない。

### document-model/src/index.ts

```ts
export {
  federateTopicMeetingRelations,
  type TopicMeetingRelationSource,
} from "./activity/federate-relations.ts";
export {
  validateTopicMeetingListInput,
} from "./activity/operations.ts";
export type {
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingListResult,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingRepository,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "./activity/types.ts";
export {
  omitMarkdownFencedCode,
  parseMarkdownAnchors,
} from "./artifact/anchors.ts";
export {
  type ArchitectureBodyModel,
  type ArchitectureCrossModelIndex,
  inspectArchitectureAnalysis,
  inspectArchitectureCrossModel,
  inspectArchitectureCrossModelIndex,
  inspectArchitectureDefinition,
  inspectArchitectureDetailTemplate,
} from "./artifact/architecture.ts";
export {
  type ArchitectureDetailCoverageRequest,
  type ArchitectureDetailMapModel,
  type ArchitectureDetailModel,
  inspectArchitectureDetail,
  inspectArchitectureDetailCoverage,
  inspectArchitectureDetailMap,
} from "./artifact/architecture-details.ts";
export {
  type ArchitectureAnalysisCoverageRequest,
  type ArchitectureRegistryModel,
  type ArchitectureRelationsRequest,
  inspectArchitectureAnalysisCoverage,
  inspectArchitectureComponentCoverage,
  inspectArchitectureRegistryCoverage,
  inspectArchitectureRelations,
  parseArchitectureRegistry,
} from "./artifact/architecture-relations.ts";
export {
  inspectChangeDocument,
  isChangeNavigationInvalid,
  isChangeTemplateInvalid,
  parseChangeTraceHeader,
} from "./artifact/change.ts";
export {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "./artifact/checklist.ts";
export {
  inspectDiscoveryAnalysis,
  inspectDiscoveryDefinition,
  parseAdoptedDiscoveryRequirements,
} from "./artifact/discovery.ts";
export {
  inspectRelatedOrder,
  parseCanonicalReleaseHeader,
} from "./artifact/document-header.ts";
export {
  type ArtifactGraph,
  type ArtifactGraphResult,
  type BuildArtifactGraphRequest,
  buildArtifactGraph,
} from "./artifact/graph.ts";
export {
  type IaAnalysisModel,
  type IaDefinitionModel,
  type IaIndexModel,
  inspectIaAnalysis,
  inspectIaAnalysisCoverage,
  inspectIaCrossProjection,
  inspectIaDefinition,
  inspectIaIndexCoverage,
  inspectIaRelations,
  parseIaIndex,
} from "./artifact/ia.ts";
export {
  inspectDiscoveryIdentityLinks,
  inspectStableIdentityDefinitions,
  inspectStableIdentityOwnership,
  parseStableIdentityOccurrences,
} from "./artifact/identity.ts";
export {
  inspectArtifactSources,
} from "./artifact/inspect.ts";
export {
  parseMarkdownLinkReference,
  parseMarkdownLinkTargets,
} from "./artifact/links.ts";
export {
  isMarkdownTableSeparator,
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownFences,
  parseMarkdownTableRow,
  readCanonicalDocumentHeader,
} from "./artifact/markdown.ts";
export {
  parseMarkdownArtifact,
} from "./artifact/parse-markdown.ts";
export {
  createPhaseChecklistItems,
} from "./artifact/phase-checklists.ts";
export {
  inspectPhaseDiagramTemplates,
  phaseDiagramTemplatePaths,
} from "./artifact/phase-diagrams.ts";
export {
  inspectQualityAnalysis,
  inspectQualityCrossModelGoals,
  inspectQualityDetailUnits,
  parseQualityCoverageSections,
} from "./artifact/quality-analysis.ts";
export {
  inspectQualityDefinition,
  inspectQualityLocalItemOwnership,
  type QualityDefinitionModel,
  type QualityLocalItemOwnershipModel,
} from "./artifact/quality-definition.ts";
export {
  hasQualityOpenChecklist,
  inspectQualityCenterState,
  inspectQualityRealityState,
} from "./artifact/quality-readiness.ts";
export {
  inspectQualityDefinitionRelations,
  inspectQualityGoalLocalRelations,
  inspectQualityLocalItemRelations,
  isQualityLocalItemCountInvalid,
  parseQualityDetailHandoff,
} from "./artifact/quality-relations.ts";
export {
  inspectQualityDesignStates,
} from "./artifact/quality-state.ts";
export {
  isQualityAnalysisTemplateInvalid,
  isQualityIntegrationTemplateInvalid,
  isQualityVerificationResultTemplateInvalid,
} from "./artifact/quality-templates.ts";
export {
  inspectCanonicalDocumentVersions,
  inspectChangelogRelease,
  inspectStableCanonicalDocuments,
  inspectStableChangelog,
  inspectStableReadme,
  inspectStableReleaseHeader,
  parseCandidateVersionHeader,
  parseReadmeVersion,
} from "./artifact/release.ts";
export {
  inspectSpecAnalysis,
  inspectSpecAnalysisCoverage,
  inspectSpecCoverage,
  inspectSpecDefinition,
  inspectSpecDefinitionCoverage,
  inspectUiSpecRelations,
  parseSpecIndex,
  parseUiSpecPairs,
  type SpecAnalysisModel,
  type SpecDefinitionModel,
  type SpecIndexModel,
} from "./artifact/spec.ts";
export {
  inspectSpecCorrespondence,
  inspectSpecCorrespondencePairEvidence,
  parseSpecCorrespondencePair,
  parseSpecCorrespondenceRevision,
  type SpecCorrespondencePair,
} from "./artifact/spec-correspondence.ts";
export {
  inspectSpecDetailCorrespondence,
  inspectSpecDetailDownstream,
  inspectSpecDetailIndex,
  parseSpecDetailAreaOwnership,
  parseSpecDetailCentralTrace,
  parseSpecDetailDefinitionOwnership,
  parseSpecScreenRelations,
  parseUiDetailBindings,
  type SpecDetailAreaOwnership,
  type SpecDetailCentralTrace,
  type SpecDetailDefinitionOwnership,
  type SpecDetailDownstreamRequest,
} from "./artifact/spec-details.ts";
export type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistFailure,
  ChecklistResult,
  MarkdownFence,
  MarkdownFenceLine,
  MarkdownLinkReference,
  SourceLocation,
  UxFormalInputTarget,
} from "./artifact/types.ts";
export {
  inspectUiAnalysis,
  inspectUiAnalysisCoverage,
  inspectUiDefinition,
  inspectUiDetail,
  inspectUiIndexCoverage,
  inspectUiRelations,
  parseUiIndex,
  type UiIndexModel,
  type UiRelationsModel,
} from "./artifact/ui.ts";
export {
  inspectUxAnalysis,
  inspectUxDefinition,
  inspectUxFormalInput,
  inspectUxRelations,
  isUxProjectionIncomplete,
  parseUxIndex,
  parseUxJourneyRelations,
  type UxAnalysisModel,
  type UxFormalInputObservation,
  type UxIndexModel,
} from "./artifact/ux.ts";
export {
  isUxHandoffTargetSetExact,
  isUxRootHandoffValid,
} from "./artifact/ux-handoff.ts";
export {
  parseUxFormalInputTargets,
} from "./artifact/ux-inputs.ts";
export {
  type ArtifactSchema,
  type ArtifactSchemaValidationResult,
  validateArtifactSchema,
} from "./artifact/validate-schema.ts";
export {
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "./artifact/verification-tables.ts";
export {
  createMeetingOperations,
} from "./meeting/create-operations.ts";
export {
  applyMeetingOutcomeTreatment,
  parseMeetingMarkdown,
} from "./meeting/markdown.ts";
export type {
  MeetingOperations,
  MeetingOutcomeDisposition,
  MeetingOutcomeTreatment,
  MeetingRecord,
  MeetingState,
} from "./meeting/types.ts";
export {
  type DomainIssue,
  type DomainLocation,
  type DomainOutcome,
  type DomainStatus,
  validateDomainOutcome,
} from "./outcome.ts";
export {
  applyProjectOperationCandidateDecision,
} from "./project-context/candidate-decision.ts";
export {
  isProjectContextManifestIdentityInvalid,
  isProjectContextProjectionInvalid,
} from "./project-context/inspect.ts";
export {
  parseRepositoryProjectContextMarkdown,
} from "./project-context/parse-context.ts";
export {
  parseRepositoryQualityProjectionMarkdown,
} from "./project-context/parse-quality.ts";
export {
  parseRepositoryReleaseProjectionMarkdown,
} from "./project-context/parse-release.ts";
export {
  createPortfolioProjection,
  type FederatedProjectProjection,
  type FederatedProjectSource,
  type PortfolioProjection,
  type ProjectContextSource,
} from "./project-context/portfolio.ts";
export {
  readRepositoryProjectContext,
} from "./project-context/read-context.ts";
export {
  projectProjectOperationSources,
} from "./project-context/source-projection.ts";
export type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
  ProjectOperationProjection,
  ProjectOperationProjectionItem,
  ProjectOperationSource,
  ProjectOperationSourceState,
  RepositoryProjectContext,
  RepositoryProjectContextReadResult,
  RepositoryProjectContextScene,
  RepositoryProjectContextSceneKey,
  RepositoryProjectContextTable,
  RepositoryQualityProjection,
  RepositoryReleaseDependency,
  RepositoryReleaseProjection,
  RepositoryReleaseScope,
} from "./project-context/types.ts";
export {
  type FixedQualityCandidate,
  fixQualityCandidate,
  type IntegratedQualityGate,
  integrateQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
  reenterQualityReview,
} from "./quality-change-control/gate.ts";
export {
  inspectRealityTestCatalog,
} from "./reality-traceability/catalog.ts";
export {
  discoverRealitySymbols,
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
} from "./reality-traceability/discover.ts";
export {
  createRealitySymbolGraph,
  type RealitySymbolGraph,
  type RealitySymbolNode,
} from "./reality-traceability/graph.ts";
export {
  type LoadedRealitySymbolManifest,
  type RealitySymbol,
  type RealitySymbolKind,
  type RealitySymbolManifest,
  realitySymbolKinds,
} from "./reality-traceability/manifest.ts";
export {
  validateRealitySymbolManifest,
} from "./reality-traceability/validate-manifest.ts";
export {
  createFilesystemRepositoryObservationPort,
} from "./repository/create-observer.ts";
export {
  observeRealitySymbolRepository,
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
} from "./repository/observe-symbols.ts";
export type {
  RepositoryDirectoryEntry,
  RepositoryDirectoryObservation,
  RepositoryEntryKind,
  RepositoryFileObservation,
  RepositoryObservationPort,
} from "./repository/types.ts";
export {
  createSemanticBundle,
  createSemanticCoverageGraph,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./semantic/coverage.ts";
export {
  compileSemanticIr,
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
} from "./semantic/ir.ts";
export {
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
  publishSemanticCoverage,
} from "./semantic/publish.ts";
export {
  compileQualitySemanticRelations,
  type QualitySemanticRelation,
} from "./semantic/relations.ts";
export {
  createFilesystemSemanticBundlePublisher,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
} from "./storage/semantic-store.ts";
export {
  discoverRepositoryTestFiles,
  inspectResourceIntensiveTestAuthority,
  inspectTestCatalog,
  loadTestCatalog,
  type ResourceIntensiveTestAuthority,
  selectRegressionStaticOwners,
  selectRegressionTests,
  type TestCatalog,
  type TestCatalogEntry,
  type TestLevel,
  testLevels,
} from "./test-catalog/inspect.ts";
export {
  aggregateRegressionStageResults,
  buildRegressionStagePlan,
  normalizeExplicitChangedPaths,
  type RegressionAggregateResult,
  type RegressionExecutionStep,
  type RegressionPlanEntry,
  type RegressionStage,
  type RegressionStagePlan,
  type RegressionStageResult,
  regressionStageOrder,
} from "./test-catalog/plan.ts";
export {
  createTopicOperations,
} from "./topic/create-operations.ts";
export {
  applyTopicPromotion,
  parseTopicMarkdown,
} from "./topic/markdown.ts";
export type {
  TopicOperations,
  TopicPromotion,
  TopicRecord,
  TopicState,
} from "./topic/types.ts";
```

### execution-model/src/index.ts

```ts
export type {
  TaskExecutionSelections,
} from "./task/types.ts";
export {
  inspectTaskExecutionSelections,
} from "./task/validation.ts";
export {
  applyCoordinatorResourceCleanup,
  applyCoordinatorResourceEvent,
} from "./attempt/crud.ts";
export {
  prepareCoordinatorLeaseAcquisitionConfirmation,
  prepareCoordinatorLeaseAcquisitionReservation,
  prepareCoordinatorLeaseRecoveryReservation,
  prepareCoordinatorLeaseRecoverySettlement,
  prepareCoordinatorLeaseReleaseIntent,
  prepareCoordinatorLeaseReleaseSettlement,
  prepareCoordinatorReleasedLeaseReconciliation,
  projectCoordinatorLeaseAcquisitionOwner,
  projectCoordinatorLeaseOwnerLossState,
} from "./attempt/lease.ts";
export type {
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairDisposalCheckpoint,
  DockerRuntimeRepairRetentionTargets,
} from "./attempt/repair-types.ts";
export {
  decodeDockerRuntimeRepairCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairRetentionTargets,
  dockerRuntimeRepairCheckpointIsSettled,
  dockerRuntimeRepairDisposalIsSettled,
  prepareDockerRuntimeRepairSessionCheckpoint,
  RUNTIME_REPAIR_ACTIONS,
  RUNTIME_REPAIR_DIRECTORIES,
  validateDockerRuntimeRepairCheckpointTransition,
} from "./attempt/repair-validation.ts";
export {
  captureRuntimeOwnedCoordinatorSettlementInputs,
  completeRuntimeOwnedCoordinatorSettlement,
  prepareRuntimeOwnedCoordinatorSettlement,
  publishRuntimeOwnedCoordinatorHistory,
  readRuntimeOwnedCoordinatorSettlementResult,
  registerRuntimeOwnedCoordinatorSettlementResultDeliveries,
  settleRuntimeOwnedCoordinatorResult,
  writeRuntimeOwnedCoordinatorHistoryCheckpoint,
} from "./attempt/settlement.ts";
export type {
  CoordinatorRepairRetentionReceipt,
  CoordinatorResourceBook,
  CoordinatorStateOperation,
  CoordinatorStateRepairOperation,
  CoordinatorStateTaskOperation,
  DockerRestartCheckpoint,
  TurnCountDiagnostic,
} from "./attempt/types.ts";
export {
  coordinatorAuthenticationClosureEvidence,
  coordinatorAuthenticationUnknownCanClose,
  coordinatorOperationNonce,
  coordinatorRepairCanComplete,
  coordinatorRepairCanSummarize,
  coordinatorRepairHistoryLineBytes,
  coordinatorRepairRetentionMatchesCheckpoint,
  coordinatorRepairSummaryBytes,
  coordinatorTaskResourcesAreSettled,
  createDockerRestartRequestId,
  decodeDockerRestartCheckpoint,
  dockerProcessControllerPublicCompletionReasons,
  isDockerRestartCheckpointSettled,
  PROVIDER_ADVICE_OUTPUT_REASONS,
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
  purposeResource,
  validateCoordinatorResourceBook,
  validateCoordinatorResourceBookTransition,
  validateHostRecoveryTransitionLineage,
  validCoordinatorOutcome,
  validCoordinatorPrimaryFailure,
  validCoordinatorRepairOperation,
  validCoordinatorRepairRetentionReceipt,
  validCoordinatorRepairSummary,
} from "./attempt/validation.ts";
export {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  type CoordinatorDecisionRequest,
  type CoordinatorDecisionResult,
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
} from "./decision/request.ts";
export type {
  CoordinatorAcceptanceDecision,
  CoordinatorAcceptanceDecisionInput,
  CoordinatorAcceptanceTarget,
  Decision,
  DecisionAnswer,
  DecisionRequest,
} from "./decision/types.ts";
export {
  createLocalPrincipalId,
  isPrincipalId,
} from "./identity/validation.ts";
export {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  type CoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveRequest,
} from "./objective/request.ts";
export type {
  CoordinatorObjectivePlan,
  ProjectMilestoneRecord,
  ProjectMilestoneState,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
  ProjectObjectiveState,
} from "./objective/types.ts";
export {
  type ExecutionPlanScope,
  inspectCallerTaskInputs,
  inspectExecutionPlan,
} from "./objective/validation.ts";
export {
  containsRecognizedSecretMaterial,
  containsRecognizedSecretScope,
  containsRecognizedSecretText,
  describeSecretMaterialPolicyContract,
  isRecognizedSecretBearingPath,
  SECRET_MATERIAL_POLICY_CONTRACT,
  SECRET_MATERIAL_POLICY_CONTRACT_REVISION,
} from "./plain-data/secret-validation.ts";
export {
  normalizeRepositoryRelativePath,
} from "./repository/path.ts";
export {
  compareActivityEventPositions,
  decodeActivityCursor,
  deriveActivitySourceCorrelation,
  encodeActivityCursor,
  inspectRuntimeActivityObservation,
  parseRuntimeActivityObservation,
} from "./state/activity.ts";
export {
  encodeRuntimeStateValue,
  hashRuntimeStateContent,
} from "./state/codec.ts";
export {
  classifyCoordinatorRepairPublication,
  classifyCoordinatorResourcePublication,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateRepairDisposalDecisionSnapshot,
  prepareCoordinatorStateRepairDisposalProgressSnapshot,
  prepareCoordinatorStateRepairRetentionHandoffSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  projectCoordinatorCurrentState,
  projectCoordinatorQueueProjectState,
  validateCoordinatorStateRepairDisposalTransition,
  validateCoordinatorStateRepairRetentionHandoffTransition,
  validateCoordinatorStateRepairSessionTransition,
  validateCoordinatorStateTransition,
} from "./state/crud.ts";
export {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryPending,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorHistoryTransfer,
  prepareCoordinatorTerminalRecordRetirement,
} from "./state/history.ts";
export {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  inspectCoordinatorProjection,
  inspectCoordinatorStateQueryResult,
  isCoordinatorObjectiveProjectionCorrelationValid,
  isCoordinatorProjectionSemanticallyValid,
  PROJECT_OBJECTIVE_STATES,
  PROJECT_TASK_STATES,
} from "./state/projection.ts";
export type {
  ActivityRepository,
  ActivitySource,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./state/projection-types.ts";
export {
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorStateQuery,
} from "./state/query.ts";
export {
  assertCoordinatorSnapshotTransition,
  type CoordinatorSnapshotObservations,
  coordinatorAdoptionWasRejected,
  coordinatorQueueIsClosed,
  coordinatorRejectedAdoptionEvidenceCanRetire,
  coordinatorSnapshotIntakeMatches,
  coordinatorStandaloneAdoptionIsClosed,
  validateCoordinatorUnifiedTransition,
} from "./state/transition.ts";
export type {
  CoordinatorLeaseKind,
  CoordinatorSnapshot,
  CoordinatorState,
  CoordinatorStateSnapshot,
  CoordinatorStoredTask,
  CoordinatorTaskSettlementFact,
  CoordinatorUnifiedSnapshot,
  HistoryRow,
  LeaseEvidenceContent,
  LeaseEvidenceEnvelope,
  LeaseKind,
  RuntimeAccess,
  RuntimeDomainSnapshot,
  RuntimeManagedExecution,
  RuntimeProjectDefinition,
  RuntimeReadResult,
  RuntimeStateEnvelope,
  RuntimeWriteResult,
  StateVersion,
} from "./state/types.ts";
export {
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_STATE_CONTRACT,
  COORDINATOR_STATE_SCHEMA,
  coordinatorHistoryLineBytes,
  coordinatorOperationSummaryBytes,
  decodeRuntimeDomainSnapshot,
  hashRuntimeProjectDefinition,
  hashRuntimeStateValueText,
  hasRuntimeStateKeys,
  hasRuntimeStateRecordKeys,
  historyRow,
  isRuntimeStateObject,
  isSha256Hex,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  prepareCoordinatorStateHistoryLine,
  projectCoordinatorTaskSettlement,
  snapshotRuntimeStateArray,
  snapshotRuntimeStateRecord,
  validCoordinatorSnapshot,
  validCoordinatorTaskState,
  validId,
  validLeaseEvidence,
  validResultReference,
} from "./state/validation.ts";
export type {
  RuntimeExecutionStorageAccess,
  RuntimeSettlementStorageAccess,
} from "./storage/runtime-repository.ts";
export {
  advanceRuntimeOwnedCoordinatorRecoveryHistory,
  advanceRuntimeOwnedCoordinatorRepairHistory,
  answerDecision,
  applyDecision,
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorHost,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorReferences,
  checkpointRuntimeOwnedCoordinatorResource,
  checkpointRuntimeOwnedCoordinatorResourceNotIssued,
  checkpointRuntimeOwnedCoordinatorRestart,
  cleanupRuntimeOwnedCoordinatorStateMarker,
  closeCoordinatorUnstartedTaskQueue,
  closeDecision,
  completeRuntimeOwnedCoordinatorCurrentRecovery,
  completeRuntimeOwnedCoordinatorRepair,
  confirmCoordinatorLeaseAcquisition,
  createCoordinatorQueueEntry,
  createCoordinatorSingleTaskQueue,
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  initializeCoordinatorSnapshot,
  initializeRuntimeState,
  maintainCoordinatorSnapshotRecords,
  observeRuntimeOwnedTransientTaskCompletion,
  queryDecisions,
  queryObjectives,
  queryPlan,
  queryQueue,
  queryRuntimeState,
  queryTasks,
  queryWorkspaces,
  readCoordinatorCurrentState,
  readCoordinatorExecutionState,
  readCoordinatorLeaseAcquisitionOwner,
  readCoordinatorLeaseOwnerLoss,
  readCoordinatorQueueEntry,
  readCoordinatorQueueProject,
  readCoordinatorSnapshotIntakeEpoch,
  readCoordinatorTaskIntakeState,
  readCoordinatorWorkspaceState,
  readDecision,
  readRuntimeOwnedCoordinatorAdmissionSnapshot,
  readRuntimeOwnedCoordinatorCurrentCompletionSnapshot,
  readRuntimeOwnedCoordinatorCurrentDeliverySnapshot,
  readRuntimeOwnedCoordinatorCurrentHistorySnapshot,
  readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot,
  readRuntimeOwnedCoordinatorRecoveryResult,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  readRuntimeOwnedCoordinatorRepairCompletionSnapshot,
  readRuntimeOwnedCoordinatorRepairHistorySnapshot,
  readRuntimeOwnedCoordinatorResourceBook,
  readRuntimeOwnedCoordinatorResourcePublicationSnapshot,
  readRuntimeOwnedCoordinatorStateSnapshot,
  reconcileCoordinatorReleasedLease,
  recordDecision,
  registerRuntimeOwnedCoordinatorRecoveryResultDelivery,
  requestDecision,
  reserveCoordinatorLeaseAcquisition,
  reserveCoordinatorLeaseRecovery,
  resumeRuntimeOwnedCoordinatorRepairPublication,
  resumeRuntimeOwnedCoordinatorResourcePublication,
  saveCoordinatorIntegrationRecord,
  saveCoordinatorLeaseReleaseIntent,
  saveCoordinatorManagedProject,
  saveCoordinatorWorkspaceRecord,
  savePlan,
  saveRuntimeOwnedCoordinatorHostCleanupPreparation,
  saveRuntimeOwnedCoordinatorOperationStart,
  selectCoordinatorQueueEntry,
  settleCoordinatorLeaseRecovery,
  settleCoordinatorLeaseRelease,
  settleCoordinatorQueueLeaseRelease,
  settleCoordinatorQueueRecovery,
  transferCoordinatorSnapshotHistoryRecords,
  updateCoordinatorQueueEntry,
  updateCoordinatorSingleTaskQueue,
  updateObjective,
  updateTask,
  verifyCoordinatorQueueIntake,
  writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure,
  writeRuntimeOwnedCoordinatorRecoveredHostCleanup,
  writeRuntimeOwnedCoordinatorRecoveryCheckpoint,
  writeRuntimeOwnedCoordinatorRecoveryTerminal,
  writeRuntimeOwnedCoordinatorRepairSnapshot,
  writeRuntimeOwnedCoordinatorRestartCheckpoint,
} from "./storage/runtime-store.ts";
export {
  classifyRuntimeSnapshotReentry,
  createRuntimeStatePendingFile,
  flushRuntimeStateFile,
  type RuntimeStateFileName,
  type RuntimeStatePendingFileName,
  readRuntimeStateFile,
} from "./storage/state.ts";
export {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyTemporaryOperationEvidencePromotion,
} from "./storage/temporary-operation.ts";
export type {
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationCapability,
  TemporaryOperationRecoveryReference,
} from "./storage/types.ts";
export {
  hasProjectTaskResultAcceptanceConflict,
  normalizeCoordinatorTaskProjects,
  prepareCoordinatorUnifiedTaskSections,
  prepareCoordinatorUnifiedTaskSnapshot,
  projectCoordinatorTaskSnapshot,
} from "./task/crud.ts";
export {
  inspectCoordinatorQueueIntake,
  prepareCoordinatorQueueEntryCreation,
  prepareCoordinatorQueueLeaseReleaseSettlement,
  prepareCoordinatorQueueOperationUpdate,
  prepareCoordinatorQueueRecoverySettlement,
  prepareCoordinatorQueueSelection,
  prepareCoordinatorSingleTaskQueueCreation,
  prepareCoordinatorSingleTaskQueueUpdate,
  prepareCoordinatorUnstartedTaskQueueClosure,
  projectCoordinatorQueueEntry,
} from "./task/queue.ts";
export type {
  CallerTaskInput,
  CoordinatorQueueEnqueueInput,
  ProjectDockerRecoveryAcknowledgement,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectResultAcceptance,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskResultFact,
  ProjectTaskStartPhase,
  ProjectTaskState,
  SingleTaskRecord,
} from "./task/types.ts";
export {
  coordinatorConsumerCompletionPolicy,
  decodeProjectResultAcceptance,
  inspectSingleTaskRecord,
  validCoordinatorState,
  validQueueEntry,
} from "./task/validation.ts";
export {
  inspectWorkspaceCommand,
  type WorkspaceCommand,
} from "./workspace/command.ts";
export {
  prepareCoordinatorIntegrationRecordCreation,
  prepareCoordinatorWorkspaceRecordUpdate,
} from "./workspace/crud.ts";
export {
  inspectCoordinatorWorkspaceResults,
  snapshotCoordinatorWorkspaceResult,
} from "./workspace/result.ts";
export type {
  CoordinatorResultRecord,
  CoordinatorWorkspace,
  CoordinatorWorkspaceCandidate,
  CoordinatorWorkspaceResult,
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
} from "./workspace/types.ts";
export {
  COORDINATOR_INTEGRATION_CONTRACT,
  isWorkspaceCommitId,
  validCoordinatorResultRecord,
  validCoordinatorWorkspace,
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
} from "./workspace/validation.ts";
export type { ExecutionSelection } from "./task/types.ts";
export {
  hashExecutionSelection,
  inspectExecutionSelection,
} from "./task/validation.ts";
export {
  RepositoryRuntimeDataAreaBlockedError,
} from "./storage/runtime-result.ts";
```

### configuration-model/src/index.ts

```ts
export {
  inspectAiSelectionChoice,
  validateAiSelectionConfig,
} from "./ai-selection/validation.ts";
export {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "./storage/ai-selection.ts";
export { readNetworkPolicy } from "./storage/network-policy.ts";
export {
  readCoordinatorConfig,
  readExecutionIntelligenceConfig,
} from "./configuration/read-tool-config.ts";
export {
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "./configuration/validate-declarations.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "./configuration/storage-paths.ts";
export type {
  AiSelectionCatalog,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
} from "./ai-selection/types.ts";
export type { AiSelectionConfigResult } from "./ai-selection/validation.ts";
export type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
} from "./storage/ai-selection.ts";
export type { NetworkPolicy } from "./configuration/network-policy.ts";
export type { NetworkPolicyReadResult } from "./storage/network-policy.ts";
export type {
  CrosTrustPolicy,
  RepositoryManifest,
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./configuration/types.ts";
```

## 10. 旧Rootから外す31 Symbolの追従

単にexportを隠すのではなく、下表の実Ownerと利用側を同時に変更する。Rootから外れても、保存Result内の未確認情報や正本Schema値を削除しない。

| Symbol | 処置 |
|---|---|
| `ModelSelection` | AD正本をConsumerが直接参照 |
| `Provider` | AD正本をConsumerが直接参照 |
| `ReasoningEffort` | AD正本をConsumerが直接参照 |
| `TESTS_RELATIVE_PATH` | 現Coの検証記録Script内の固定配置へ |
| `CROS_DIRECTORY_ID` | CROSのPath計算に必要な形式条件はAM初期化内部、宣言検査に必要なものは構成内部 |
| `CROS_TRUST_POLICY_SCHEMA` | 構成モデルの宣言検査内部。保存Schema値は不変更 |
| `REPOSITORY_MANIFEST_SCHEMA` | 構成モデルのManifest検査内部。保存Schema値は不変更 |
| `parseUnambiguousJsonDocument` | 設定Reader／Co CLI／WB HTTP・IPCの各入力Owner内部 |
| `snapshotPlainArray` | 実行／設定／Co／WB／MCPの各入力Owner内部 |
| `snapshotPlainRecord` | 実行／設定／Co／WB／MCPの各入力Owner内部 |
| `requireReadyRepositoryRuntimeDataArea` | 各固定保存Owner内部。未知・部分Effectを未実施へ畳まない |
| `observeRepositoryRuntimeDataArea` | 設定／実行保存／Co Lease／EI接続等の各固定対象観測へ |
| `resolveCrosRuntimeRoots` | 実本番ConsumerであるAM initialization/root.ts内部 |
| `resolveRepositoryRuntimeDataPaths` | 全Path集合の配布は撤去。各保存OwnerがVC Rootから自分の固定所在だけ構成 |
| `resolveRepositoryRuntimeDataPathsFromWorkingDirectory` | 本番利用なし。撤去。必要なConsumerはVCでRoot確定後にOwner完成操作へ |
| `CrosRootInput` | AMの既存Host初期化内部。CM型にしない |
| `RepositoryRootCapability` | VCのRepositoryを直接参照。別名再公開は撤去 |
| `RepositoryRuntimeArea` | 汎用Area enum公開撤去。各固定対象の内部契約へ |
| `RepositoryRuntimeDataAreaObservation` | 各保存Ownerの固定対象観測へ局所化。必要な公開結果のfieldを省略しない |
| `AiSelectionTemporaryReference` | AiSelectionSaveResultの未確認参照として保持。単独Root再exportだけ撤去 |
| `checkRepositoryRuntimeDataProtectionDirectory` | Co execution/operation.tsの保護Mount準備内部へ |
| `createCoordinatorRuntimeDataArea` | 実行モデルstorage/ensure-area.ts内部。本番外部Consumerなし |
| `ensureRepositoryRuntimeDataArea` | 各固定保存Ownerの準備＋VC Ignore登録に接続 |
| `ensureRepositoryRuntimeDataAreaFromWorkingDirectory` | Co Lease／Visual Preview等の既存Owner内へ。汎用Wrapperは撤去 |
| `readStableFileSnapshot` | 各保存／入力Owner内部の対象File読取りへ |
| `StableFileIdentity` | 各Owner内部の必要なIdentity定義へ。型が公開Result内で必要な場合は当該Resultから参照 |
| `sameStableFileIdentity` | 各Owner内部の実体比較へ |
| `createFilesystemStoreRoot` | AMの既存初期化と構成の設定保存内部へ。generic Factoryの再公開はしない |
| `FilesystemStoreRoot` | AMが正本として公開する必要型へ。構成は独立した私有Rootを使用 |
| `resolveFilesystemStorePath` | AM／構成それぞれの固定Store内部へ |
| `withFilesystemStoreLock` | AM／構成の既存保存処理から共通Lockへ直接接続 |

AMと構成のopaque Rootは別の私有保存対象であり、相互交換しない。AMのRoot型はMCP／WorkbenchまでAM正本で搬送し、構成保存はRepository Capabilityから自己のconfig境界を内部で確定する。既存の物理Lock Path・Hash namespace・Owner／Generation・回復参照は局所化を理由に変えない。

## 11. 設計確認と実装へのGate

今回の設計是正では、従来案の「実行→構成」「文書→構成」と共通保存Helperの構成Root配布を撤回する。前版の独立レビュー結果は、この変更後の依存0・Input変更の成立根拠へ流用しない。

実装着手前には、Source137件・Root721件と本案の各Owner／31除外処置を照合する。特に、Root単体のRecovery要求、10箇所の設定再読取り、AM Root型の搬送、例外のinstanceof投影、namespace／dynamic import／Sourceパス文字列を対象に含める。

限定検証の計画は次のとおり。今回の設計編集では実行しない。

1. 各モデル／全Consumerの型検査と、モデル間import・再export・package依存・生成型参照0の確認。
2. 文書3期待値、Config→AD→実行入力の投影、保持設定の初回拒否／途中変更／同値／再入場の契約試験。
3. Owner局所化したI/Oと入力検査の正常／異常、State／History／CAS、AM Root・Lock、元例外の失敗情報投影。
4. 既存Repository-local試験・Consumer結合・台帳とSource一覧の同期、および固定候補の独立レビュー。

まだ実装・package分離・型検査・回帰・保存移行の成立を示さない。実AI・Docker・全体回帰・過去保持物の操作はしない。

## 12. 今回の設計確認結果

読取り専用の独立レビューで、保持設定を基底Inputへ一律要求すると通常Query／非履歴Recoveryへ新しい停止条件が生じる指摘を受けた。Section3・6・7へ適用範囲と対照試験を反映し、更新候補を再レビューした。設計候補の必須残指摘は0件。

Source移管表137件、Root候補294／371／25の総690件・重複0、旧Rootから外す31件の全処置を確認した。実装時はCallbackへ期待日数の引数を渡した事実だけで再検証成立とせず、各本番Consumerが実際に現在値と比較することを元の10確認位置に対応する設定変更の負例で確認する。

上記は実装着手前の設計確認時点の結果である。後続の製品Source・試験の変更と検証は次節の実装状況へ記録する。上記は設計の確認結果で、移管後の型検査・限定回帰や全体成立の結果ではない。

## 13. 実装状況

3パッケージのSource・package設定・公開入口と、利用側のimport／Input搬送を切り替えた。旧domain-modelの追跡対象Source・試験・package設定・Symbol台帳は撤去し、互換Facadeは設けていない。各モデル間の型・実装・再export・package依存は0である。

設定の固定config保存、実行State／tmp、文書保存、AM Root、Co／WB／MCP／検証Scriptの入力・I/Oを各Ownerへ閉じた。初期化の内部処理は実行モデルの既存ensure-area.tsに保持する。Snapshot・History・CAS、保存先、Lock Identity、失敗と回復参照の意味は変更しない。

公開は文書294／実行371／構成25の計690 Symbol。試験台帳は411件へ追従し、正式QAとの対応を照合した。限定回帰の途中で検出した旧Fixture接続・旧容量期待・実際のI/Oに届かない故障注入も是正している。

検証結果・失敗の切分け・独立レビューの状態は[今回の検証記録](Evidence/261112_model-package-split-verification.md)を参照する。全体回帰・実AI・Docker・過去保持物の操作は実施していない。実装の区切りをCHG全体完了やリリース可能へ拡大しない。

## 14. 実行モデルの完成操作への再編 — 2026-11-12

基準は`639730463`。人間が採用した65関数案を、既存267公開物の削減・利用側接続・内部責務移管と一体で実装する。先行の24 Source整理と267項目への縮減結果は基準Capabilityの根拠であり、今回の変更後の成立証拠へ流用しない。現在は実装中であり、65入口・限定回帰・独立レビュー完了をまだ主張しない。

| 編集単位 | Ownerと処置 | 保持条件・確認 |
|---|---|---|
| 公開要求・表示契約 | Objective要求、判断操作要求／応答、状態照会／投影、WorkspaceCommand、活動一覧をCoordinatorの既存Ownerへ移管 | EMからCoordinatorへの実装・型依存0。保存モデルと保存用契約値はEM内部に保持 |
| 開始・終了 | 既存開始保存へ元の終端相関準備を接続し、入力固定は完成終了操作へ統合 | 開始保存済みでも準備失敗ならHost開始禁止。同じexact回復参照と保存Effectを返す。入力受理と保存確定を分け、元結果参照の再入場を維持 |
| Checkpoint・回復 | 用途固定の更新をlive／回復別の完成入口へ統合 | 必須情報を持つ判別入力。任意Snapshot・Optional集合を公開しない。Host事前検査→Authority消費→保存の順序を維持 |
| Queue・Lease | Queueの受付／更新、Leaseの取得／解放／回復へ同じモデル内の保存を集約 | 保存前Intentと物理処置後の観測を別入力とし、物理Lock・Process観測はCoordinatorに残す。元版・Owner・Generation・IDを保持 |
| Reader・履歴 | 用途固定の観測と完了操作へ内部段階を閉じる | live／回復／ACK前fresh読取りの権限差、不存在・pending不存在・unknownを区別。履歴件数・余剰行・相関の独立Oracleを維持 |
| 命名・Helper | EM内のCoordinator／Runtime由来識別子を意味に応じて改名し、不要なRoot公開を撤去 | 宣言元と全Consumerを同時変更。旧名Wrapper、別名再export、テストのdeep import迂回を作らない。Arrayは利用側の引数・失敗理由を照合 |

変更分類はPackage公開契約と内部責務の非自明な再編である。既存Architecture・QA・台帳・Co／Workbench／MCP／Script／試験を影響母集団とし、実装・利用側・保存安全性の独立レビューと文書／影響確認を実施する。準拠基準・決定権限・Releaseを変更しないため、準拠監査とRelease操作は対象外。着手前の読取り専用整合確認は着手可で、追加人間判断はない。

保存Schema・Path・field・contract値・Lock／Hash namespace・reason・IPC・既存の安全条件を変更しない。DI・AD等の下位Packageの正本名は改名しない。CMのSave追加は本範囲へ含めない。新しいManager・Registry・Store・Runner・共通Package・互換Facadeを追加しない。

試験は変更したモデル操作とConsumerの限定集合を先に固定して実施する。成功、拒否、初回保存後の準備失敗、保存不明、旧版・別Owner、途中例外、履歴未確認、受領待ちとfresh読取りを既存の反証へ対応付ける。試験一時物は既存Repository-local自己生成Rootだけとし、終了hookで同実体を回収する。全体回帰・実AI・Docker・過去保持物の走査・操作は禁止する。

### 14.1 要求・表示と開始／終了の接続状況

Objective要求、判断操作要求／結果、状態照会／投影、WorkspaceCommandと活動処理をCoordinatorの既存Ownerへ移管した。モデル側に上位要求型やCoordinator依存を残さず、移管した入力検査のUTも既存のCoordinator試験へ移した。保存モデル・保存Schema・contract文字列・Path・Hash namespace・reason・IPCは維持する。EMに必要なモデル検査としてinspectDecisionを公開し、保存codec／履歴投影を上位の判断検査に流用しない。

開始記録の保存後に既存の終端Context準備を接続した。準備が失敗・例外でもstartSavedと元exact参照・発行済みEffectを返し、Host要求へ進まない。旧Coordinator execution/settlement.tsは撤去し、既存persistence.tsが元観測を搬送する。終端保存用Repositoryの非列挙purpose/rootをspreadで落とす不整合を検出し、既知fieldを明示搬送する形で是正した。

終了入力の固定はcompleteOperation内部へ閉じた。inputAcceptedは保存確定とは別の結果であり、受理後のReader・Snapshot取得・符号化例外でも、同じ元結果をCoordinatorが保持して再入場できる。独立レビューで検出した受理後例外の搬送欠落を是正し、同参照の再入場とコピー拒否を有限試験で確認した。WriterのI/O例外・発行事実保持は既存契約を使用する。開始統合のレビューでは後続準備Readerの解放不明が先行Writerの成功へ隠れる指摘も検出し、両段階の解放確認と元reasonを統合結果へ反映するよう是正した。準備例外は解放不明とし、Source再レビューの必須残指摘は0件である。後続の未実装範囲の成立を意味しない。

現Rootは232公開物（165値・67型）であり、最終65関数案の完了ではない。Checkpoint・Queue・Leaseの集約、Reader／履歴の内部化と全公開物の最終削減、残る利用側・台帳の全照合は継続中。既存のRoot-only Guardは維持し、テスト用Facadeを追加していない。

今回の限定結果は、移管先／モデル側8試験Fileの47件（追加の判断モデル検査後、開始／終了・遷移を含む9 File・58件で再確認）、終了保存結合4件、Coordinator本番Owner再入場の指定1件、現在状態保存とpending再入場の指定群2件、公開・依存境界の指定3件が成功。集合は重複し得るため合算しない。現在状態の結合試験は最初に上記搬送不整合で失敗し、是正後の再実行で成功した。準備Readerの解放不明是正後も、終了保存結合4件と現在状態結合の指定群2件（約167秒）の成功を再確認した。全体回帰や実AI／Dockerの成功へ読み替えない。EM・Coordinator・AM・MCP・Workbenchの型検査も成功しているが、後続編集後は影響範囲を再確認する。

追加した「正常Owner1回」の限定ケースでは、旧DI内部名への故障注入、CoordinatorがHome排他を持つ旧前提、未Intent資源の未発行成功期待、旧cleanupOutcome入力、selectionHash欠測、抽出宣言の依存欠測を検出した。現在のExecutor入口、実共通Lockの取得・競合・解放結果、既存Cleanup通知とHost Module全体の再読込みへ試験だけを接続した。手書きSource閉包・global一時key・旧清掃証明代役は撤去し、不正cap・別plan・元版不変の反証は維持した。本番DI・Executor・ADは変更していない。Sourceレビューの必須残指摘は0件。Module全体を使う最終版の指定ケース1件も成功した（約124秒）。保持あり・複数回形や実Executor E2Eの成功へ拡大しない。

成功した試験は終了hookで自己生成物を回収する。一方、追加ケースの途中失敗には既存の安全条件でRootを保全した実行があり、全試験物の回収完了とは扱わない。由来を名前や時刻だけで推測して削除せず、今回の未回収試験物も残件として保持する。過去保持物の走査・処置はしていない。

### 14.2 Checkpoint・Lease・Queueと回復Readerの統合状況

live Checkpointの旧6入口は既存saveOperationCheckpointへ集約した。kind/valueを閉じたown-dataとして捕捉し、元Owner・操作ID・referencesの非対象pendingDeliveries保全と既存CASを維持する。回復Checkpoint、Host事前検査、正式未発行の元Controller照合は別の権限条件として維持しており、この集約だけで回復系全入口の最終整理を完了したとは扱わない。

Leaseの旧9入口はacquireLease／releaseLease／recoverLease／readLease、Queueの旧7入口はcreateQueue／updateQueueへ実処理を集約し、旧関数宣言を撤去した。各kindの必須tupleを型で対応付け、Intent保存・物理処置・結果観測の順とLock内の現在RootへのCallback結合を維持する。独立レビューでtuple自体の未捕捉を検出したため、既存snapshotStateArrayでProxy・Getter・独自iterator等を実行せず固定し、元の最小／最大arityを検査するよう是正した。追加の公開16kind負対照と既存候補試験を確認し、再レビューの必須指摘は解消している。

回復Readerの旧8入口はreadRecoveryStateの固定取得範囲へ集約した。通常、入場、資源出版、Host清掃、実行／修復履歴、実行／修復終了、配送の元ID検査とreadStateSnapshot引数は同じで、fresh読取りを使い回さない。live Owner ReaderとACK前結果Readerは権限差のある既存入口を維持する。保存Snapshot生成Helperはまだ一部の外部試験が使用しており、内部化・最終公開IFの残件である。

汎用Helper4件はRootから外し、Coordinatorは既存input/snapshot.tsを利用する。外部参照のない既定内部化対象の型21件もRoot再exportだけを撤去し、宣言・戻り値field・保存形式は保持した。モデル自身の試験は宣言元、外部試験はRoot限定のままである。この段階のRootは189項目（135値・54型）。後続の現行集合は§14.3で区別し、65関数案の全完了を主張しない。

限定検証ではRoot・依存境界／Lease／Queueの指定4 Fileで26件、Coordinatorの単発入力／結果投影3件が成功した。回復・修復接続の指定2 FileはVM内外のprototype比較を是正後、57件の全再実行が成功した。EM Reader／回収Writerの指定4件、終了保存の結合4件（約77秒）、Coordinator現在状態の保存とpending再入場の指定群2件（約225秒）も成功した。旧関数名と最終宣言位置を前提にした試験Source抽出は現在Sourceへ追従した。EM・Co・AM・MCP・Workbench・DI・Executorの型検査を確認した。集合の重複を合算せず、全体回帰へ拡大しない。

今回の失敗試行で保全された試験Rootは、実行時のexact所在と実体の対応を再確定できないものが残る。既知の試験名・PID・prefix・時刻だけを削除根拠にせず、走査や推測削除は行っていない。新たな記録機構や自動清掃を追加せず、この未回収を完成条件の残件として保持する。全体回帰・実AI・Docker・過去保持物は操作していない。

追加で、結果受領の保存不変条件の検証をEMへ移し、当該HelperのRoot公開を撤去した。Coordinatorの実受領処理の正常／再送／拒否試験は保持する。移管編集がテスト本体全体を除いていた指摘を独立レビューで受け、元の本体を復元し、モデルHelperの5検査だけを移管した。復元後のCo試験24件とEMの指定4件が成功した。現在Path正規化はCoordinatorの既存同一実装へ接続し、Project定義Hashの結合Oracleは全定義fieldと末尾LFを明示してNode SHA256で照合する。末尾LF欠測の試験期待を是正後、指定replan結合1件が成功した。変更試験の登録名を基準版と静的照合し、欠落として見えた3件は先行移管先のCo既存試験に同名で存在することを確認した。追加独立レビューの必須指摘は解消している。

### 14.3 回収保存の統合と外部試験の接続変更（限定検証中）

回収中の途中更新・再起動・終端・Host清掃確定は、既存の`saveRecoveryCheckpoint`へ実処理を統合した。旧三宣言は撤去し、新しい互換Wrapperは作らない。`RecoveryCheckpointRequest`は用途別に必要な証拠を必須にする。Host清掃では`assertAbsentOwner`とReaderのexact出版候補、その他では元の同期Owner確認を維持する。終端の通常→履歴→配送Readerの順序と、前Readerの解放確認、元版全文一致、保持設定の再検証を変えない。live Host準備と正式未発行の証拠は別の完成操作に残す。独立レビューで必須指摘なし。

外部試験から内部の保存遷移検査・投影・分類・候補生成への依存を撤去した。EM内部の純粋検査は宣言元で維持する。Coordinatorでは公開保存・読取り操作、現役のResource値操作と、対象外全文・改訂・元Hashを明記した独立期待DTOへ接続する。メモリWriter代役は実Writer検証と区別する。修復結果試験は自己生成Rootの実Filesystem／共通Lockを使い、初回の実Git観測後だけ固定Revisionの試験代役へ接続する。Root／Git配置は毎回実観測し、HEAD変更検出は既存の実Git試験へ残す。技術処置と応答故障は有限代役であり、解放不明の応答から実Lock解放失敗を証明したとは扱わない。

現Rootは157項目（102値・55型）。外部fixture専用の保存候補Helperに続き、履歴要約とHost更新の生成HelperもRootから内部化した。初回Identityの検査・回復ID導出と初期Host判定は既存Readerへ内包したが、候補Helperの外部fixture依存が残る。実受領の復号、Host系統照合、認証資源の検査、実E2Eの遷移Oracleも、利用側からの吸収可否を引き続き評価する。本番利用があることだけを最小公開の根拠にはしない。コード接続済みと限定検証の完了は区別する。

限定検証では、統合後のCo回収・再起動接続51件、EM回収Writerの指定3件、EM修復・境界の38件、再起動とHost観測の11件、Task保存の指定3件、修復Ownerの指定12件、現在状態・pendingの指定群2件が成功した。集合の重複を合算しない。修復結果の指定ケース（3 Root）は成功し、同File内の故障matrixと利用側の追加限定確認は継続中。7 Packageの型検査は成功したが、限定検証全完了・全体回帰成功とは表示しない。

新しい正常終了試験は既存の終了hookで自己生成Rootを回収した。一方、中断試行や先行失敗でexact所在・元実体との対応を再確定できないRootは未回収である。prefix・時刻・PIDだけで推測削除せず保全し、過去保持物の走査・処置は行わない。全体回帰・実AI・Dockerは未実施。

### 14.4 本番の検査・候補生成の内包化（限定検証中）

技術・利用側影響・文書の独立確認を行い、旧3値契約の説明残存を是正した。限定文書Checkerは、詳細設計台帳・Qualityの対応集合・旧PA anchor・旧Native trace参照等に18件の指摘を返した。今回の局所修正でこれらを解消したとは扱わず、横断追従の未確認・未是正として区別する。

0byte fixture是正後、保持済み再入場の指定1件と、成功・保持・取消後のexact履歴確定の指定1件も正常終了した。それぞれ既存終了hookに回収例外はなく、実Writer・Readerを通した観測と有限DI代役の境界を維持した。先行File matrix全体の再実行や、未確認の全領域成功とは区別する。

履歴要約の重複検査は既存の修復履歴Readerへ、Host清掃前の候補検査は既存の操作Readerへ内包した。`prepareRepairHistorySummary`・`prepareStateHostSnapshot`はRootから撤去し、EM内部の宣言と反証試験は維持する。Host清掃前Readerは次Snapshotや新しいAuthorityを返さず、同じ元版の準備成立事実だけを返す。Coordinatorの一回許可消費を検査より先へ動かさない。清掃確定後はWriterの確定改訂・Hashとfresh Readerのexact対象・Host token・清掃結果を照合する。

既存限定matrixでは、試験用marker除去が応答だけの代役だったこと、保持保存の故障注入が旧checkpoint種別に接続されていたこと、終了Writer内部の読取りを外側Readerの回数に含めていたことを検出した。正常marker処理は公開完成操作へ接続し、保持故障はretention_handoffへ、Reader注入は実際の前後二回へ是正した。保持済み再入場の失敗は、試験が履歴不存在を0byte Fileで表現していたため、製品の通常実体検査で拒否されていた。自己生成exact履歴Fileだけを通常File・非Link・nlink確認後に不存在へ戻し、ENOENT以外を再throwするfixtureへ是正した。Reader前後の停止、保持保存故障、保持済み再入場の各指定試験は成功した。File全体の再実行や全体回帰の完了とは表示しない。

今回の限定範囲でモデル・Root境界・遷移35件、Coordinator回収・再起動接続51件、Host準備保存と本番Owner再入場の指定各1件、Task実保存の指定2件、未出版pendingの指定4件が成功した。7 Packageの型検査、変更Sourceの整形・Lint、差分の空白確認も成功した。重複集合を合算せず、全体回帰・実AI・Docker・過去保持物は操作していない。初回Identity候補と保存codec等の残るRoot公開は、単なる存続確定にせず既存操作へ吸収できる範囲を継続整理する。

### 14.5 開始Identity・初期Host条件と汎用Hashの整理

開始前Identity検査と回復ID導出は、既存の`readOperationStateStage(kind: "operation_start")`へ内包した。閉じたown-data捕捉、同じ操作Owner・Repository結合、初期候補検査と最終再検証だけを行い、StateReader・Lock・Writer・Directory初期化へ進まない。結果はkind・status・operationIdentityの共同成立で事前検査済みの非Authority相関だけを表し、Stateは返さない。Home観測Capabilityを消費する前の検査位置と、開始保存時の再検査を維持した。

開始診断の既存試験は、開始とIdentity組立ての両本番本文へ接続した。Reader拒否・取得範囲の相違・Identity事実欠測では、Home観測・観測Capability消費・保存・Host要求が全て0となることを確認する。必須のモデル検査自体はEM側で別Owner・不正Identity・Getter不実行・最終失効とStateReader到達0を反証し、有限代役だけをモデル検査の成功根拠にはしない。

初期Hostのモデル条件は`state/validation.ts`の非公開判定へ移し、実Hostのhost_only・exact tokenはCoordinatorへ残した。固定範囲`initial_host`と既存host_cleanup Readerだけ、返却Snapshotと同じ版のexact一操作を評価する。通常current読取りで全操作を再導出せず、追加I/O・保存・Authorityを作らない。Coは成功・値あり・解放確認・元本文一致の後だけ不変のID一覧を使う。モデルの全文差分・再起動・参照残存の反証一式はEMの既存runtime-transitions試験へ移し、合法負例30件・比較省略／再起動guard変異・依存欠測を維持した。Coの実Host結合と状態／token差の反証は残す。

`hashStateText`はRootから外し、外部のLease実体Hash計算をNode.js標準へ直接接続した。UTF-8、入力文字列・要素順序、二重Hashを維持し、Leaseの取得・解放・回復方式は変えない。現Rootは157項目（102値・55型）。`prepareStateOperationSnapshot`の本番Co参照は0だが外部fixtureの候補生成依存が残る。保存codecの元本文・候補解釈、一般入力捕捉、Workbench検証scriptの全履歴読取りも既存接続が残るため、Root最小化や全codec内部化の完了とはしない。正規符号化を単なるJSON.stringifyへ置換せず、深いimportや互換Facadeも増やさない。

限定確認は、モデル・公開境界・Lease候補25件、Host準備／開始前Readerの指定1件、開始診断3件、Co回収・再起動接続51件、本番Ownerメモリ再入場1件、実Task保存の指定1件、長期wx Leaseの指定2件、Owner終了state_savedからの別Process実Host回復の指定1件が成功した。集合を合算せず、実Git／Filesystem／wxと有限技術代役の境界を維持する。技術・利用側影響の独立レビューに必須残指摘なし。全体回帰・実AI・Docker・過去保持物は操作せず、既存の横断Checker18指摘と先行未回収物を解消したとは扱わない。

### 14.6 初回候補Helperの外部試験依存撤去

`prepareStateOperationSnapshot`はRootから撤去した。実Rootを使う合成Operation登録・Host出版切断fixture・CLI切断fixtureは、公開`saveOperationStart`の実Writerへ接続する。開始保存・保存確認・Lock解放・exact回復ID、fresh本文の改訂・元Hash・対象外区画の不変を共同確認する。初回保存の期待値は明示DTOとし、同じ製品候補関数との自己比較をやめた。Contextの有限callbackは技術清掃成功を返さず、Host／Docker成立の根拠にはしない。

通常継続の試験は、8軸（正常・Lease・Owner・資源・未解決義務・Task・相関・Host）と両Providerの四段階を維持し、自己生成Git Rootで初期化→fresh Reader→実開始Writerへ接続した。拒否時は未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変とCoordinatorの次Provider Effect停止を観測する。正常時はReaderの改訂・exact操作・過去unknownの三値と旧操作全文の保全を確認する。修復中の開始拒否も、既知active版を実保存先へ置き、同じ公開Writerの拒否後に既知completed版へ戻す。

純粋なHost観測・再起動組立て試験は既存の有限入力fixtureを共用する。このfixtureは無引数の固定DTO・固定Hash期待値であり、任意Identityの候補生成や内部検査への間接接続は持たない。EM自身の候補反証は宣言元へ接続する。公開境界Guardは直接／間接の内部依存を引き続き拒否する。現Rootは156項目（101値・55型）。保存codec・入力捕捉・Workbench検証scriptの全履歴読取りは残件であり、公開最小化全体の完了とはしない。

限定確認は、公開境界・codec・遷移の指定3 Fileで25件、修復モデル・終了要約の指定2 Fileで21件、Host観測・再起動組立て16件、Objective回復の指定1親、通常継続の指定1親、現在状態保存とpending再入場の指定1親・1子、正常Owner1回の指定1親が成功した。集合を合算しない。変更16 Sourceの整形・Lint（警告0、情報18件）、EM／Coordinatorの型検査、HEADとの差分の空白検査を確認した。既存の試験項目・ファイル単位の台帳対応を維持し、新項目や件数を発行しない。独立レビューの文書残件1件は現行残件説明の更新で是正した。全体回帰・実AI・Docker・過去保持物は操作していない。先行の横断Checker18指摘と未回収物を解消したとは扱わない。

### 14.7 回復Ownerによる保存本文の再decode撤去

Coordinatorの回復記録は、元本文と同じ版の検査済みSnapshotを保持する。初回は元版一致確認後のfresh Reader値とし、資源出版の再入場後も出版後の値を使う。一般Checkpoint・認証不明終了・Host清掃確定の各保存後は、Writerの保存確認・改訂・Hashとfresh Readerの正常・Lock解放を確認した後だけ、元本文と保持Snapshotを同期して更新する。Snapshotは既存codecで再帰的に凍結された値を使い、新しい複製・検査・Owner管理やI/Oを追加しない。Restart専用記録は今回変更しない。

本番Coordinatorの`decodeStateSnapshot`直接参照3件を撤去した。Host条件・consumer判定は同じ保持Snapshotのexact IDとkindから取得する。元bytes／CAS・現在Owner確認・保存失敗後の停止は維持する。外部試験のdecoder依存と、元本文の正規符号化・入力捕捉・全履歴取得は残っているため、Root公開156項目とcodec最小化全体は未完了のままである。

限定試験では、回収接続の指定Fileで32件、元入力による本番Owner再入場の指定1親、Owner終了state_savedから別Processの実Host回復の指定1親が成功した。回収接続では一般保存後・認証不明終了後の拒否／古い読戻し／改訂差／Hash差／解放不明を反証し、本文と保持Snapshotの片側更新を拒否する。Host清掃の既存26故障条件にも両者の正規byte一致を追加した。consumerの別ID・別kind・先頭の別操作も反証する。既存試験項目・ファイル単位の台帳対応を維持し、技術・利用側影響・文書の独立レビューに必須残指摘はない。Coordinator型検査、変更4 Sourceの整形・Lint（警告0、情報4件）とHEAD差分の空白検査を確認した。全体回帰・実AI・Docker・過去保持物は操作せず、先行の横断Checker指摘と未回収物を解消したとは扱わない。

### 14.8 入力捕捉と保存codecの分離

公開受入要求、認証の資源Intent／Receipt、通常資源のIntent／Receipt、Host checkpointの6呼出しを、Coordinatorの既存`snapshotJsonValue`へ接続した。保存用codecの文字列化→再解析を入力コピーとして使わない。局所のunknown型assertionを実行時検査の成立へ読み替えず、Getter・Proxy・symbol・不正数・深度等の拒否、非列挙data propertyと特殊keyの保持、参照分離を維持する。保存本文の正規符号化・Hash・同一性比較と公開結果は変更しない。新しいHelper・Facade・Root公開は追加しない。

直接試験ではnull prototype・__proto__／constructor・整数風key・非列挙data・共有子objectの独立コピー・-0・安全整数・配列subclass・別realm配列・深度32／33・循環・不正型を対照にした。各入口でも捕捉拒否を後続境界へ接続し、認証では資源値操作とWriter、通常通知とHost checkpointではWriter、公開受入ではFile read／write／Root所在取得への到達0を確認する。

試験代役の単純JSON比較が正規比較と異なること、別realmの合成Host値が本番入力捕捉で拒否されることを検出した。Host checkpointの比較は既存正規codecへ接続し、再起動準備の有限組立ては同realmの閉包で評価するよう是正した。本番入力捕捉をJSON再解析で迂回せず、同じhelperを直接使う。既存の試験Owner・台帳項目は維持する。

限定確認は、入力捕捉・認証記録・現在回収・再起動準備の指定4 Fileで64件、別ProcessのOwner終了state_savedからの実Host回復の指定1親が成功した。公開受入の正常実Stateケースと入力拒否ケースは、同じFileの再実行で2件とも成功した。Coordinator型検査、変更11 Sourceの整形・Lint（警告0、情報8件）、HEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。Root156項目のままであり、外部試験のdecoder依存、保存正規符号化・比較、全履歴Readerの整理は残る。全体回帰・実AI・Docker・過去保持物は操作せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.9 全履歴取得の既存Readerへの接続

`readRecoveryState(root, { kind: "history" })`を追加し、通常Stateと同じ短期保存Lock内で履歴を全行検査する。新しい公開関数・型名・Storeは作らない。初期化済みStateと安定した履歴Fileを同じ観測へ結合し、最終実体・存在有無・Lock解放まで確認する。真正不存在は不変の空配列、読取り拒否・不正行・部分行・重複・0byte・未知物・pending・実体変化・解放不明は`historyRows:null`と値なしの停止で区別する。通常currentには追加履歴I/Oを発行せず、全履歴Queryにも保持設定読取りやAuthorityを追加しない。

Workbench検証scriptの診断は、同じReader一回の成功・State値・解放・履歴値の共同成立後だけ現在相関と全履歴を採用する。無関係な正常行も落とさず、診断途中の例外では従来どおり相関と一覧をクリアする。Fileを直接読む専用helperは唯一の利用が消えたためSourceごと撤去し、Symbol台帳の該当項目も削除した。旧File読取りとdecoderを代役にしていた既存診断試験も、検査済み履歴応答と現行のループへ接続した。

限定確認は、全履歴Queryの指定1親・13子で14件、既存Readerの指定2親、Root境界の5件、Workbench診断の指定1親と既存相関判定の指定1親が成功した。履歴の無関係な複数行、末尾破損・LF欠測・不正UTF-8・重複・0byte・pending・Directory、読取り中の出現・消失・置換・I/O失敗を反証する。Linkとhardlinkの実作成は環境の権限制約で実行できなかったため、今回は種別・nlinkのメタデータ故障注入として区別する。解放不明も既存保存Source fixtureの注入であり、実Lock故障を観測したとは扱わない。今回の自己生成Rootは既存hookで回収し、過去保持物には触れていない。

EM・Coordinator・Workbenchの型検査、変更7 Sourceの整形・Lint（警告・情報0件）とHEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。Rootは156項目のままで、外部試験のState／履歴decoder依存と、保存正規符号化・比較の利用整理は残る。全体回帰・実AI・Dockerは実行せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.10 外部履歴decoder利用と純粋モデル試験の分離

Coordinator現在状態試験の純粋な一次失敗／Command観測の親ケースを、EMの既存runtime-codec unit試験へ移した。現行の`validPrimaryFailure`と内部の履歴decoderを直接使い、旧名を参照するVM閉包と縮減enum代役を撤去した。正負の入力と履歴往復の確認は保持し、PRL-UT-006の既存項目と、実際に検査する既存attempt／history Symbolへの対応を追加した。新しい項目ID・Source・検査用Facadeは作らない。

実保存側では、通常完了と修復結果の履歴確認を公開全履歴Readerへ接続する。consumer・相関の変異は履歴としては正規であり得るためReaderの全件取得を認め、exact操作の終了観測で拒否する。旧形式・重複・空File・不正な再起動欄はReaderが値なしで拒否する。各変異後のState全文不変と、新しいpending等の保存物がないことを確認し、試験で取得した元履歴だけへ戻す。

この段階で履歴decoderを直接使うCoordinator試験は5 Fileから3 Fileへ減った。残るcurrent-host-transition-worker、docker-recovery-owner-reentry、runtime-repair-ownerと、State decoder・正規符号化／比較の利用整理は継続対象であり、Root156項目の最小化完了とはしない。製品Source・公開契約・保存形式は今回変更していない。

限定確認は、移管先EM codecの10件、Root境界5件、認証unknownの指定2親、現在状態保存とpending再入場の指定1親・1子、修復終了接続の指定1親が成功した。修復回収接続と修復失敗履歴接続の指定2親も成功した（約410秒・572秒）。今回の指定ケースはいずれも終了hookの回収例外なく完了した。EM／Coordinator型検査、変更3 Sourceの整形・Lint（警告0、情報6件）、追加した既存Symbolへの検証対応2件とHEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.11 正常Owner結合試験の実履歴Readerへの接続

`docker-recovery-owner-reentry.contract.test.ts`の履歴decoder呼出し5箇所を撤去した。修復直後の単一行を公開全履歴Readerから取得し、exact回復ID・生行・時刻・Node.jsによるlineHash／summaryHashを照合して試験の基準値とする。後続Taskの各段階では同じ実履歴Fileと引数の一致、Readerの成功・State値・Lock解放・履歴値、State／履歴本文の前後不変を確認し、元行の全field・件数・raw prefixを比較する。新しい保存Owner、検査Facade、任意File読取りAPIは追加しない。

引数だけを変えた時刻・重複の負例は、実Fileとの不一致を拒否する対照へ明確化した。実保存履歴の構文不正・重複をReaderが拒否する検証は、既存EM Reader試験が所有する。同じ責務の終端decoder再検査は既存helperに統合した。製品Source・公開契約・保存形式・安全条件は変更しない。履歴decoderの外部依存は残る2 Fileへ減ったが、State decoderと正規符号化／比較も継続対象であり、Root156項目の最小化完了とはしない。

Coordinator試験の型検査、変更Sourceの整形・Lint（警告0、既存情報2件）、HEAD差分の空白検査を確認した。限定回帰は正常Owner1回の保持なし・あり2親を一度実行し、2件とも成功した（約121秒・135秒）。両ケースの既存終了hookに回収例外はない。固定Sourceと文書の独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、先行未回収物や既報Checker指摘の解消とは扱わない。

### 14.12 Host遷移子fixtureの履歴decoder撤去

`current-host-transition-worker.ts`の履歴decoder呼出し4箇所と専用namespace importを撤去した。確認済み履歴は`execution_history`の検査済み`historyFile.bytes`と実Fileを比較し、単一LF行・exact ID・既存全文HashとState前後不変を保つ。引渡し失敗からの回復後は全履歴Readerの成功・値・解放を共同確認する。故障注入前に配置する45日前の無関係行も、実Fileへの配置後に同Readerで一件・元行・IDと本文不変を確認する。pending中の別操作行は検査済み元行の識別子だけの既知変異とし、通常Queryにpendingを許す例外や任意bytesを読む代役は追加しない。欠測・別行でのexact再入場拒否とState／pending／markerの不変は維持する。

旧行・現行行・整合した別IDの形式成立と、nonceだけを変えたID不整合の拒否をEMの既存runtime-codec試験へ追加した。既存PRL-UT-006とERB-IT-014で追跡し、新しい試験API・QA ID・保存形式は作らない。初回の限定Host試験3件は子fixture実行前の初期State読取りで停止し、親試験の空初期値に現行必須`decisions`・`blockers`が欠けていたことを確認した。当該初期値だけを補い、製品Readerの検査は変更しない。

EM codec11件と子fixtureの静的接続・資源Oracle確認2件、EM／Coordinator試験型検査、変更Sourceの整形・Lint、HEAD差分の空白検査を確認した。Hostの指定3親を同じ選択範囲で再実行し、history_checkpoint_pendingは成功（約64秒）、history_confirm_pendingは終端保存の確認不成立、handoff_failureは既存の孫Process60秒期限超過で失敗した。成功や限定回帰完了とは扱わない。今回の清掃未確認Rootは`C:\project\CRDD\.crdd\tests\current-host-transition-18936-2AGTlR`と`C:\project\CRDD\.crdd\tests\current-host-transition-18936-wamhnG`で、実体・参照・終了状態を確認できておらず保全し、今回削除しない。

history_confirm_pendingでは、準備処理は保持設定付きの履歴Readerを使う一方、終端Writerへの再入場入力には保持日数がなく、未確認履歴のpublish確認で拒否される搬送漏れを特定した。Coordinator finalizerは、同じ保存Snapshotのexact docker_taskに未確認履歴がある場合だけ既存`withHistoryRetention`を接続する。履歴なし・確認済み・他操作の場合の追加設定読取りは0とし、Owner・Host不存在・一回性・元版の照合は変えない。既存finalizer試験のOwner shapeを追従し、同じ保存前本文と本番の設定接続本文で6条件（未確認、初回不正、途中変更、確認済み、他操作、履歴なし）を反証した。指定2親は成功し、Co試験型検査・変更Sourceの整形・Lint（警告0、既存情報2件）も確認した。実pendingの指定1親は最終改訂版で成功した（約102秒、既存終了hookの回収例外なし）。追加の設定接続正本へのSymbol対応を既存試験項目へ追従した。固定Sourceの独立レビューに必須残指摘はない。handoff_failureの期限超過は別件として未是正のまま保持し、全指定ケース成功とは扱わない。

履歴decoder外部依存はruntime-repair-ownerの1 File、Rootは156項目のままであり、公開最小化完了とはしない。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.13 修復Owner履歴取得とRoot履歴decoderの内部化

最後の外部利用であるruntime-repair-ownerの13呼出しを撤去した。実保存済み履歴は全履歴Readerの成功・State値・解放・履歴値を共同確認し、元の行数・本文・exact ID・廃棄／保持結果を残す。旧保持行や別操作行は実File配置後の全履歴Readerで形式成立を確認し、専用完了Readerで対象相関を別に拒否する。history rename中断後のpendingは専用repair_history Readerのpublish段階と検査済みpending bytesを使い、単一LF行・exact ID・保存済みlineHash・State／pending／marker不変を確認する。通常Queryにpendingを許す例外を追加しない。切断材料の無関係な旧Task行は、publisherがpendingを解消した後に公開Queryで実保存行を確認し、純粋形式検査はEMが所有する。

外部からの履歴decoder呼出しと追加deep importがないことを確認し、RootのdecodeHistoryRowsを撤去した。EM自身の関連4試験のimportは内部正本へ追従し、固定公開期待値も更新した。decoderの本体・保存形式・安全条件・公開関数の追加はない。Rootは155項目（100値・55型）で、State decoderと保存正規符号化／比較の外部利用は継続整理対象とする。既存ERB-IT-014・RCM-UT-014・PRL-UT-006等の試験項目で追跡し、新しいQA IDや検査Facadeは作らない。

EMの公開境界・修復モデル・判断・State遷移の指定4単体Fileは53件成功した。EM／Coordinator／Workbench型検査、変更7 Sourceの整形・Lint（警告0、既存情報7件）、HEAD差分の空白検査を確認した。Coordinatorの指定3親は、completion exact対象（約97秒、10子）とIdentity／Session出版（約44秒、2子）が成功した。保持fresh出版はnone・stateの2子が成功し、history子の新規marker読取りだけがENOENTで失敗した（指定集合全体は約421秒、18項目中16成功・子と親の2失敗）。history pendingのpublish段階ではstate.lockが必須ではないため、試験側はENOENTだけを明示不存在として前後不変を確認し、存在時は同じbytesを比較する形へ是正した。Readerの条件や製品処理は変えず、読取り不能を不存在へ畳まない。最終改訂版では保持親を選択し、Node.jsの選択仕様により同親のnone・state・historyの3子も再確認した。親と3子の4項目がすべて成功した（約287秒）。指定範囲外の親や全Fileは再実行していない。既存終了hookの回収例外はない。固定Sourceと文書の独立レビューに必須残指摘はなく、marker是正後の独立再レビューも必須残指摘0で完了した。

handoff_failureの調査では、試験子のerror／signal assertionが受領済みstdout・stderrを失敗説明に含めていないことを確認し、既存status assertionと同じ出力を添えるよう補った。Process起動、既存60／120秒期限、出力生成、保存、安全判定は変えない。子本文の構文接続指定1親・型検査・整形・Lintは成功し、診断差分の独立レビューにも必須残指摘はない。実handoffは他の試験が完了してから指定1親を単独で一度再実行し、成功した（約61秒、既存終了hookの回収例外なし）。起動条件や既存の子60秒／親90秒期限は変更していない。今回の成功は前回の期限超過の原因特定・再発防止を意味せず、試験時間の変動要因は未確定として残す。先行の清掃未確認2 Rootは操作せず、解消済みとしない。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.14 検査済み保存原文のReader所有と利用側のJSON再生成撤去

State保存Readerの成功valueへ`sourceText`を追加した。Snapshotと本文Hashを検査した同じ`observed.bytes`を、既存の最終実体照合後にUTF-8文字列として返す。pending候補・別読取り・再符号化から作らず、decoder自体へ原文保持を追加しない。成功valueの凍結と拒否時のvalueなし、現在Owner・Lock解放・未知状態の停止を維持する。追加I/O・Root関数・公開型名・Authorityは作らないが、本文文字列分のメモリは保持する。これは暗号化・復号ではなく、検査済みJSON原文の受渡しである。

Coordinator回復処理のSnapshot再符号化16箇所を`Buffer.from(value.sourceText, "utf8")`へ置換した。元本文の全文比較、Writer before入力、改訂・Hash・解放照合、同じ成功valueからのbefore／snapshot同時更新は維持する。Host／再起動／Directory／資源の値比較は今回変更せず、比較用encoderとState decoderはRootに残る。公開数は155項目のままで、全公開物の最小化完了とはしない。変更利用側に原文のログ・HTTP応答への丸ごと搬送は追加しない。

有限Reader代役の旧返却shapeが追加fieldを欠き、正常経路まで拒否されることを初回限定試験で確認した。同じ試験内の既知の元本文・現行の符号化方式から原文fieldを付加し、stale・Hash違い・解放不明・Owner喪失などの負例を維持した。代役で実Reader・実排他の成立を主張せず、旧shapeへのfallbackは作らない。

限定確認は、EM全履歴Readerの指定1親・13子14項目（非ASCII・引用符・バックスラッシュ・末尾LF・元bytesとHash・凍結・拒否時値なし）、Co現在回収／再起動準備の指定2 File54項目、認証保存順の指定1親が成功した。実Host正常Owner1回の指定1親（約132秒）と本番Owner再入場の指定1親も成功し、今回の実保存試験に終了hookの回収例外はない。EM／Coordinator／Workbench型検査、変更9 Sourceの整形・Lint（警告0、既存情報5件）、HEAD差分の空白検査を確認した。固定Sourceの独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootと試験時間変動の未確定を解消済みとはしない。

### 14.15 本番の保存用encoder依存撤去と外部State decoder試験の分離

Coordinator本番に残る資源・Host・再起動・Directoryの4つの値比較を、両辺の既存`snapshotJsonValue`捕捉後の`isDeepStrictEqual`へ置換した。キー挿入順、null prototypeと通常Object、非列挙own field、配列subclass・別realm配列、共有参照、負のゼロの従来同値を維持し、配列順・値型・field欠測／追加は非同値とする。Proxy・accessor・symbol・toJSON・疎配列・余剰field・循環・深度超過・非安全整数は片辺だけでも比較前に拒否し、未知コードを実行しない。保存原文・Hash・CAS比較は今回変更しない。新しい比較Helper・公開API・互換経路は作らず、Coordinator本番のState decoder／保存用encoderへの直接依存はともに0となった。

外部decoder利用3 Fileも整理した。Host観測の純粋試験は既存EM fixtureが検査済みの固定Operationを再利用し、保存本文の検査を再実装しない。EM fixtureの戻り値へ既に取得済みのoperationを追加するだけで、外部用の汎用decoder代役は作らない。現在入場試験は実Fileを公開Readerで確認する。Task結果fixtureは配置後と配送後に別々のfresh Readerを使い、成功・値あり・解放・原文一致とexact対象を照合する。State decoderの外部利用は16 Fileから13 Fileへ減った。Rootの155項目とencoder／decoder公開は外部試験の追従が残るため維持し、公開最小化完了とはしない。

初回の指定6 Fileでは4件の追従不足を検出した。比較関数の有限依存接続、Host期待値を本番と同じrealmで構築する閉包、現在入場試験の旧Source期待Pathを是正し、製品の型・拒否・保存条件は緩めていない。未使用の模擬Root引数も明示した。最終の限定6 File72項目、EM公開境界5項目、Task通常結果受領の指定1親（約64秒）が成功した。Directory三用途回収と保存不明の指定1親も成功した（約290秒）。Task受領・Directory回収の両指定親で既存終了hookに回収例外はない。Co／EM／Workbench型検査、変更13 Sourceの整形・Lint（警告0、既存情報9件）、HEAD差分の空白検査を確認し、固定Sourceの独立レビューに必須残指摘はない。既存のQA／Symbol項目で追跡し、新しい試験項目IDは追加しない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootや試験時間変動の未確定を解消済みとはしない。

### 14.16 外部State decoderの子fixture・再計画試験利用の撤去

current-host-transition-workerの履歴確認後・配送後の2呼出しを、同じ真正Rootの公開Readerへ接続した。成功・値・解放、元Fileのbytes・HashとsourceText一致、読取り前後の本文不変を共同確認し、既存の対象Operationと履歴／配送状態のassertは維持する。unused model namespaceを撤去し、保存途中を通常Readerへ通す例外は追加しない。

snapshot-recovery-ownerの初回取得も、取得済み真正capの公開Readerへ接続した。元本文・Hash・exact回復ID・operationIdを保持し、後続の同版照合は保存原文を使う。評価閉包のunused encoder／decoder依存を撤去し、現在の本番比較処理が使うNode比較を接続した。汎用の外部decoder代役や深いimportは追加しない。

部分再計画の1親では、before・兄弟定義配置後・出版後を同じcapのfresh Readerで確認する。定義Hash不整合・Task順序不整合の2負例は今回の自己生成state.jsonへ配置し、Readerの拒否・値なし・解放・注入本文不変を確認する。各finallyで確認済みpublishedBytesだけに戻し、復元後のfresh Reader成功・原文一致を経て古世代Writer拒否の検査へ進む。任意byte列の純粋codec検査ではなく、実保存に対する公開Reader拒否の試験としてヘッダーも追従した。

初回の再計画指定親は、Git初期化だけでHEADがないfixtureに対して回復Readerがowner_invalidで停止した。保存Readerが要求する固定Revisionを満たすため、当該親だけに固定User・署名無効・hook無効の空Commit準備を追加した。他の親・保存Schema・Binding計算・Reader条件は変更していない。是正後の再計画指定1親（約46秒）、通常Host遷移の指定1親（約99秒）、子本文構文の指定1親、認証unknown coordinator_cliの指定1親（約93秒）が成功した。今回の既存終了hookに回収例外はない。

State decoder外部利用は13 Fileから10 Fileへ減った。Root155項目とencoder／decoder公開の撤去完了は主張しない。Co型検査、変更3 Sourceの整形・Lint（警告0、既存情報1件）、HEAD差分の空白検査と、固定Source・追加試験前提の独立レビューを確認した。既存PRL-IT-005・ERB-IT-014等で追跡し、新しいQA IDは作らない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootや時間変動の未確定を解消済みとはしない。

### 14.17 外部State codec依存とRoot二公開の撤去

残るState decoderと保存用encoderの外部直接利用を撤去し、Rootの`decodeStateSnapshot`／`encodeStateValue`を内部化した。公開集合は153項目（98値・55型）。保存形式・Hash・Schema・期限・安全判定は変更しない。EM自身の値検査試験は宣言元を使い、外部試験を内部importや汎用decoder代役へ迂回させない。

Coordinator試験の固定JSON生成は既存の`canonicalJson`へ接続した。これは既知の有限入力の生成だけであり、Schema検査や権限確認を行う契約ではない。共有資源fixtureは固定objectの宣言順を正規順へ揃えた通常JSON生成とし、内部codecの間接利用を撤去した。実保存を読む箇所は公開Readerの成功・値・Lock解放と元本文の照合へ接続する。過去版・未出版候補・有限Reader代役は、既知fixture本文の局所投影・raw SHA-256・exact bytesを使用し、実Reader／Writerの成立証明とは区別する。

純粋な値検査と上位の保存・回復拒否は責務を分ける。保持引渡しの合法checkpoint差分と遷移拒否は既存ERB-UT-036の`legal_source_change_before_oracle`、複数Repairの保存は既存runtime-repair-storageが所有する。Coordinator側の公開Writer拒否・Effect 0・非対象保持・故障到達は維持する。改訂・元Hash・本文・保存後のfresh読取りを照合する条件は削らない。

独立レビューで初回未作成をReader成功へ限定する誤り、Source評価の比較関数注入漏れ、有限ReaderのHash欠測、Git HEAD前提と署名／hook抑止の不足を検出して是正した。未出版fixtureを通常Readerへ通す例外は作らず、当該試験では明示配置した本文とpending除去の事実だけを確認する。製品ReaderやWriterの拒否条件は変更しない。

限定確認は、EMの公開境界・codec・遷移27件、ERB-UT-036の指定1親、Coordinator指定6 File72件、Task通常継続1親、通常Owner／再入場2親、修復回収1親、現在状態保存／pending再入場の1親1子、子fixture接続1親が成功した。Leaseの指定3親は初回2成功・1失敗で、追加した不適切な通常Reader要求を撤去後、当該1親が成功した（約168秒）。新規自己生成物は各既存終了hookの範囲で回収し、回収例外は報告されていない。

EM・Coordinator・Workbench・MCPの型検査、変更44 Sourceの整形・Lint（警告0）、HEAD差分の空白検査を確認した。独立レビューの必須指摘は是正・再確認済み。40_DevelopのEM外Source／試験に両codec名の直接参照は0、内部へ到達する試験FacadeもRoot限定Guardで拒否する。今回の三残件は完了とするが、全体回帰や公開集合全体の最小性をこの局所結果から主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。先行保全2 Root、既報横断Checker指摘、過去試験の時間変動は今回の解消対象ではない。

### 14.18 未参照型・試験専用型のRoot公開整理

外部のstatic／dynamic import、namespace参照と型参照を照合し、外部で型名を使わない16型と、外部試験だけが型名を使う1型のRoot公開を撤去した。今回の基準は先行153項目、変更後は136項目（98値・38型）である。新しい公開名は追加せず、実体を持つ98値の集合は基準と一致する。

| 対象 | Rootから内部化した型 |
|---|---|
| 操作・回復 | `OperationCheckpointRequest`、`RecoveryReadRequest`、`RepairDisposalCheckpoint`、`RepairRetentionTargets`、`TurnCountDiagnostic` |
| 判断・Objective | `DecisionAnswer`、`ProjectObjectiveState` |
| 保存 | `ExecutionModelReadResult`、`ExecutionModelSaveResult`、`Snapshot` |
| Lease | `LeaseAcquisitionRequest`、`LeaseReadRequest`、`LeaseRecoveryRequest`、`LeaseReleaseRequest` |
| Queue | `QueueCreateRequest`、`QueueUpdateRequest` |
| 外部試験のみ | `RecoveryCheckpointRequest` |

内部で使用する型宣言と、公開関数の引数・戻り値の型は維持した。外部4試験FileのRequest注釈は`Parameters<typeof import(EMRoot).saveRecoveryCheckpoint>[3]`へ接続し、別のRequest型・Facade・`unknown`化を追加していない。EM自身の試験は各宣言元のtype importを使う。Rootの固定型集合を同じ17項目分だけ更新し、既存の公開集合・内部境界・3モデル直接依存禁止の試験を維持する。各QA／Symbolは既存項目を使用し、新しいIDは発行しない。

`queryDecisions`／`queryExecutionState`／`queryQueue`／`queryWorkspaces`は今回は維持した。本番未接続という利用実績と、認可付き・対象限定の照会機能を提供するかという判断は分ける。Rootの型名削減を理由に、照会対象・認可・保存・回復条件を変更しない。実装関数、Schema、保存先、CAS／Lock、期限、失敗理由と回復参照は不変更とする。

現在投影のPROJECT_CONTEXTとEM設計を136項目へ同期し、先行267項目の実績や153項目段階の履歴と区別した。古い「外部試験の保存codec追従が残る」という現在説明も是正し、候補表に残すdecoderは内部契約と明示した。全公開物の最小性や全体回帰完了は主張しない。

限定確認は、今回の型参照追従先EMの指定8 File55件、Coの指定2 File54件が成功した。EM／Co試験／Workbench／MCPの型4設定、変更14 Sourceの整形・Lint（警告0）とHEAD差分の空白検査を確認した。Source・利用側・現在説明の独立レビューに必須残指摘はない。型だけの変更に対して長時間のHost試験や保存故障試験の全再実行は行わず、既存の実境界Evidenceを今回再実行したとは扱わない。全体回帰・実AI・Docker・過去保持物は操作していない。既報のChecker指摘、先行保全物と試験時間変動は別残件として維持する。

### 14.19 モデル別CRUDとState複合取得の分離

モデル単体のCRUDと、複数モデルを同じ保存版で扱う取得を分離した。旧`readExecutionOverview`とWorkspace側`readWorkspaceState`はStateの`readState(repository, binding, scope)`へ統合し、元の実装・Root公開・互換Wrapperを撤去した。`scope`は`execution`又は`workspace`の固定二範囲だけとし、元の返却fieldを実際に構築する。任意field・投影callback・全技術Snapshot・新Store／Registry／公開型は追加していない。未知・欠測scopeは既存Readerへ進む前に`orchestrator_state_read_scope_invalid`で拒否する。

Task側`readQueueProject`もStateの既存`readProjectExecutionState`へ接続し、重複するProject投影を削除した。正常対象・明示不存在・Schema不正の扱いを維持し、有効Schemaの不正IDをSchema不正とする旧誤分類だけ、既存の`orchestrator_state_identity_invalid`へ揃えた。SchemaとIDが両方不正の場合はSchema不正を優先する。取得値を更新候補にせず、保存・認可・回復条件を緩めない。

Coordinatorの通常状態表示は、同じ一回の`execution`取得結果からProjectと受付世代を既存の表示生成へ渡す。Projectを別Portで再読取りしない。Git Revision不一致時にWorkspace採用可否を確認する経路では、その前後のfresh取得を維持する。Workspace操作は`workspace`範囲を同版で取得し、排他取得前後や保存後に必要な再確認は削っていない。一般照会4関数は対象限定・認可契約が異なるため今回は維持した。

Rootは134項目（96値・38型）。削除3入口・追加1入口であり、内部型Mappingは固定二範囲の対応だけを表す。Sourceとtemplateの旧3入口・重複Project投影への実参照は0。Project ContextとEM設計を現在の責務・公開集合へ同期し、先行136項目等の履歴と区別する。既存QA／SymbolのPRL-IT-005・PRL-UT-007・PPR-UT-006と各Sourceへの対応を確認した。新しい試験IDや台帳の架空項目は追加しない。

限定確認は、公開境界・Project／Queue投影・偽Root拒否・Co状態照会・Workspace採用判定の指定6 File28件が成功した。追加した複合取得2親では固定field集合・技術区画非公開・未知scopeのI/O 0・下位失敗の同一性と、実Repositoryの初期不存在→初期化→破損拒否を確認した。固定Queue CRUDの指定1親、Workspaceの選択観測／時計例外の指定2親も実保存へ接続して成功した。Co追加試験は通常一回と採用確認前後の二回取得、同版のProject世代と受付世代、対象不存在と読取り不明を有限代役で区別し、実Gitの採用成立を主張しない。

EM／Co試験／Workbench／MCPの型4設定、変更22 Sourceの整形・Lint（警告0）、HEAD差分の空白検査を確認した。Sourceの独立レビューに必須残指摘はない。今回の自己生成Rootは既存hookの回収範囲で終了し、過去保持物には触れていない。全体回帰・実AI・Docker・過去のHost境界試験の再実行は行っていない。先行Checker指摘・保全物・試験時間変動を解消したとは扱わない。

コミット前に同じ固定候補のSource・template利用先と文書を再確認し、独立レビューに追加の必須指摘はない。公開境界／Project・Queue投影12件、Co同版照会1親、複合取得2親を再実行して成功した。先の型4設定にAM／DI／Executorを加えた関係7設定も成功し、22 SourceのLintと差分空白を再確認した。これらを全体回帰の代用とはせず、保留した品質課題・過去保持物は変更していない。


### 14.20 補助公開の撤去と受付Writer統合

対象はEM RootのvalidId・hashExecutionSelection・validWorkspaceDisplayName・validWorkspaceCandidateRequestと、その全利用側。値文法は既存のCo入力OwnerとEM内部保存検査へ分け、Hash生成は既存Co selection/resolveへ移した。Hashの正規化順序・SHA-256・保存値を維持し、Executorの固定検証fixtureは自身の既知入力からNode標準で同じHashを作る。製品のCoordinator依存は追加しない。EM自身の内部検査試験は宣言元へ接続し、Hash byte反証はCoの既存選定試験へ移管した。既存QA/SymbolのRCM-UT-001・PRL-UT-007・RFD-UT-030・CPR-UT-009を使用し、新しい項目や中継Facadeは追加しない。

Workspaceのコマンドは実際の名前・相対File Path・選択・CHG・UUID・Commit幅を入力境界で検査する。ダミーCandidateによるPath検査を廃止し、保存受理後のrequestをGitへ渡す。Git接続の同一モデル再検査は削除し、VC自身の技術入力・内容・実体検査は維持する。汎用Integration本文には必要なIdentityとCommit照合を残し、Workspaceモデル検査済みと誤認しない。

残る3つのうちverifyQueueIntakeは、同じ判定を新State保存／既存Queue受付のWriter内へ集約し、本体・Root公開・Co委譲入口を撤去した。処理は保存前に停止し、Owner喪失回復へ進まない。明示未保存の受付拒否は従来のreason・no_effect・cleanupConfirmedを維持し、保存／排他解放不明はunknownとして保持する。validateResourceBookはCo所有の認証回復ファイル、validateResourceBookTransitionはQAイベント列という独立境界で必要なため維持。EM Writerへ単純統合できたとは主張しない。保存Schema・Path・Lease・CAS・認可・DI照合・期限は不変更。

Rootは129項目（91値・38型）。限定回帰・独立レビューの結果は下記へ追記する。全体回帰・実AI・Docker・過去保持物の操作は行わない。現在の変更を全公開物の最小化完了、全体QA完了、統合又はReleaseと扱わない。


限定確認では、EMの公開境界・Workspace内部検査・Queue／保存改訂・結果受領の指定5 File19件、Coの選定／Workspace入力の指定2 File14件が成功した。旧Hashの固定byte、Property順変更、未知field拒否、型変換非実行、Path・UUID・Commit幅・重複選択を確認した。受付／退役／公開実行の指定3親と、実GitのWorkspace固定・採用・回収／再入場の指定4親も成功した。これらを重複なしの40件として扱い、途中の再実行は加算しない。新State未保存拒否のreason・manualRecoveryRequired・recoveryIdと、既存State受付拒否のcleanupConfirmedを追加assertし、その指定2親だけを最終再実行して成功した。

Executorの非AI単独検証スクリプトは成功し、externalAiIssued:false・dockerIssued:falseを返した。EM・Co本番／試験・Executor・Workbench・MCPの型6設定、変更40 TS Sourceの整形・Lint（警告0、既存情報18件）と差分空白を確認した。Symbolは既存Workspace入力試験からcommandsへの検証接続を追記し、QA項目は新設していない。最初の静的確認で見つけた旧import／不要import・型追従漏れ・配置を是正し、独立レビューで検出したmode暗黙変換と受付結果の相関も是正した。Source・試験・文書の再レビューに必須残指摘はない。

実GitケースのGit不存在確認に由来するstderrと、公開実行試験のEI記録競合診断は出たが、試験結果を成功へ読み替えたのではなく各既存Oracleの終了コード0を確認した。自己生成試験領域は既存cleanup hookで終了し、観測した今回のWorkspace／公開実行Rootも不存在を確認した。過去保持物の回収は行っていない。全体回帰と実AI／Dockerは未実施。先行Checker指摘・保全物・試験時間変動は別残件とする。


### 14.21 利用側別配送ACKの撤去（実装中）

承認範囲はconsumer別transient/durable方針、配送待ち、独立受領・ACKモデルを撤去し、Taskの終端更新と関連Operationの整理を同じWriterで確定すること。保存Schema更新を含む。旧永続データは自動補完・変換せず拒否し、移行はフロントAIの別作業とする。前段14.20の未コミット変更を保持する。

着手前照合では、単純に全Operationを技術回収後に即削除するとTask保存前の中断で相関を失うと確認した。現在SnapshotのStoredTask.settlement.recoveryIdsと元Operation/Attempt相関を使用し、Task関連OperationはTask保存でのみ整理する。単発は関連Task不存在・技術終端・実履歴確認後に既存Completion Writerで整理する。新しいmode・Receipt・ACK Store・Facadeは作らない。保存成功と呼出し元への表示成功は分ける。

確認対象は、正常Taskの同時更新、技術終端未確認の保持、Task保存失敗・解放不明の保全、同ID別Attemptの拒否、回復後同時整理、単発終了と再観測、未知/旧Schemaの拒否。Writerの実履歴行照合はReceipt追加ではなく今回除去するOperationへ接続する。履歴confirmedだけから実Fileの存在を推定しない。Operation未保存除去、Cleanup不明の成功化、Provider自動再送、旧Reader、過去保持物の操作は禁止する。

Source・利用側・試験/QA接続・Architectureを更新し、限定回帰と作成担当から分離した独立レビューを行う。規則・決定権限・Releaseを変更しないため標準準拠/Release監査は対象外。全体回帰・実AI・Dockerは実行しない。以下は実装中の計画であり、成立済みCapability・完成・統合判断として扱わない。

実装途中の確認では、Taskに結合したOperationを既存Task Writerの同じ候補で除去する接続と、Taskに結合しない単発Operationの既存Completion Writerへの接続を分離した。更新していないProjectのOperationを別Project保存に巻き込まないよう、現在のProject改訂との対応を確認する。回復義務の`settled`だけでCleanupを補完せず、技術終了・履歴・未解決参照の条件を維持する。

今回の途中結果として、EMの公開境界・保存codec・Task検査の指定3 File16件、Coの状態遷移・回復Adapterの指定2 File29件、およびCoordinator経由のTask正常終端保存1件が成功した。旧ACK前提のfixtureは、削除済みfieldを補完せず、旧fieldを含む保存形式の拒否又は技術終端の検証へ変更している。これらは今回の全Consumerの型検査・限定回帰・独立レビュー完了を示さない。先行14.20の検証結果も、今回のSchema・終端変更の検証へ流用しない。

残作業は、旧配送専用試験の意味の置換、故障・回復・再入場試験の追従、現行Architecture・Symbol・QAの更新、限定回帰と固定候補の独立レビューである。特に`runtime-settlement`と`runtime-transitions`の大きな既存試験に旧ACK呼出しが残っており、Package全体の型検査はまだ成立していない。互換関数を復活させて通さず、実履歴・原子的終端・未確認時保持の検証へ接続する。

読取り専用の中間確認では、回復後の正規retryでAttempt／Operation IDをnullへ戻す更新まで新しい相関検査が拒否する反例を検出した。確定済みの同じ回復義務を保持する場合を、新たなsettled生成と分けて是正した。既存retryの状態・ID解放・retryCount増加・元Cleanup確認・義務集合維持を条件とし、IDの任意付替えは引き続き拒否する。codecの既存限定試験へ正規retryと任意付替えの対照を追加して成功した。実Storeで回復・同時整理・retryまで接続する検証と最終再レビューは未完了である。

Coordinator経由のTask終端保存は、正常・0件・取消・保存前失敗・保存後応答喪失・履歴欠測／重複／不一致／未確認の指定9ケースが成功した。Operationを先に消さず、不成立の場合はTaskと技術参照を保全し、保存成立後の応答喪失は保存失敗と区別している。今回作成した`project-execution-*`の試験Rootは終了hookで回収され、実行後の同prefixの最新残存が今回実行以前の物であることを確認した。既存保持物には処置していない。大集合ケース・その他の旧試験追従・全Consumerの静的確認・文書台帳・最終独立レビューは引き続き残作業である。

### 14.22 検査系の公開と値Ownerの整理（実装中）

承認範囲は`inspect`等の検査公開を、利用側の責務と照合して完成操作へ統合すること。名称変更・空Wrapper・深いimportへの置換では完了としない。先行14.20と14.21の未コミット差分を保持する。現行の検査規則、保存形式、認可と回復条件は、この公開整理を理由に緩めない。

最初の編集単位は、EM内で使用されない`WorkspaceResult`と`inspectWorkspaceResult`をCoordinatorの既存`workspace/record.ts`へ移すこと、および`validateResourceBookTransition`の外部利用とRoot公開要否の再確認である。前者の閉形式・getter／Proxy拒否・相対Path・欠測・変更相関・参照分離を維持し、大集合の値検査試験も新Ownerへ移す。試験用保存代役は公開された資源更新操作の検査済み結果を受け取るようにし、内部遷移検査を重ねて呼ばない。モデル自身の内部検査・試験は維持する。

続く`inspectDecision`、`inspectSingleTaskRecord`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`は、保存モデルの検査とCoordinatorの受付・選定・返却値の検査を分ける。単に全規則をCoordinatorへコピーして第二の正本を作らず、既存CRUDが返す検査済み値の再検査を減らす。未保存の外部入力はReaderの結果とは扱わず、Effect前の検査を省略しない。

限定回帰は変更した意味に対応する値検査・本番接続・公開境界・型と文書台帳を対象にする。固定候補で独立レビューを行う。全体回帰・実AI・Docker・過去保持物の操作、標準規則・決定権限・Releaseの変更は対象外。移管だけの途中状態や先行試験成功を全公開整理の完了とは表示しない。

検査Owner整理の第一単位では、Workspace結果型と検査をCoへ移し、単発記録の検査をQueue Writer内へ集約した。Coの返却値は保存済みsingleTaskへ接続し、未保存の用途結果はCoの既存受付処理で検査する。仮のPrincipal／Taskを生成する検査は撤去した。純粋な単発保存値の負例はEMの既存UTへ移し、Workspace観測の大集合・参照分離はCoの既存境界試験で維持する。

独立レビューで、資源遷移検査の動的import Consumer（executor/scripts/verify-provider-real.ts）の見落とし、移管後の型辺の契約試験漏れ、Workbenchの内部deep importを検出した。資源遷移検査は公開を維持し、既存の保存済みQA列の独立検査へ接続する。型辺は新Ownerのexactなtype-only WorkspaceResultへ差替え、旧Owner・値import・別Symbol・重複の拒否は維持する。Workbenchは既存Co Rootの型importへ統合する。新公開口・Facade・互換Readerを追加しない。これらの是正後に同範囲を再レビューする。

第一単位の再レビューでは上記3指摘の是正を確認し、同範囲の追加必須指摘は0だった。Rootから外したのはinspectWorkspaceResult・inspectSingleTaskRecordの2関数とWorkspaceResult型で、先行ACK変更を含む現在のRootは119項目（84値・35型）となる。検査名だけを置換した公開Wrapperや、外部からのEM内部importは追加していない。動的importを含むConsumerの照合不足は、当該検証スクリプトの限定型検査でも補い、Root公開数のみから不要と判定しない。

今回の限定確認は、EMの公開境界・Task検査・Workspaceモデル検査とCoの用途結果検査の4 File13件、CoのWorkspace観測・単発Adapterの指定2件、型辺の指定2件、反復受付・更新・取消・回復を含む実Store単発の指定1親が成功した（重複なし18件）。実Store親は約316秒で終了した。Co本番strict、指定試験型、EM指定試験型、Workbench型とverify-provider-real.tsの限定型検査を確認した。後者のScriptは型検査のみで、実AI・Dockerは起動していない。指定変更SourceのLintは警告0、差分空白検査も成功した。今回作成したsingle-task-stateのRootは終了hookで回収され、実行後に観測した同prefixの最新残存は今回以前の物だった。過去保持物は処置していない。

残る4つのinspectは、利用実績だけではRoot公開の必要性を確定できない。再確認では、保存済みReader値・同一Resolver出力・捕捉済み要求の反復検査と、未保存Plan・raw選定・Process境界を越える完全Decisionの受付検査が混在していた。前者は既存完成操作の返却値の受け渡しへ集約できる。後者は現在の入力・返却契約の帰結であり、Root削除だけでは閉じない。Decisionの必要投影、保存済みPlan参照、正規選定の受付境界を整理したうえで削減可否を確定する。現在の4公開を最小構成として固定せず、規則コピー・検査目的の先行保存・二重照会・空Wrapperは追加しない。第一単位の成立を全公開物の最小性、先行ACK撤去又は全体回帰完了とは扱わない。

### 14.23 旧ACK試験の追従と終端保存の反証（実装中）

旧試験の受領API・受領fixtureを、技術終端とTask保存の直接確認へ更新する。Objective再入場では、回復未開始・技術終端後・Task保存後の停止点を区別する。診断rendererと上位受付に残っていたdeliveryPendingの項目も撤去し、terminal_confirmedの共同条件と「技術回収済み・Task保存待ち」の表示へ揃えた。新しい受領Store・互換入口・代替ACKは作らない。

追従中に、未解決参照があるTaskの同版再保存でOperation除去を試みる経路、Task相関の付替え、参照中の履歴行が期限整理される経路を是正した。独立確認で見つかったTask省略による単独Completionへの迂回も拒否した。有効な別Taskへの置換候補を先に値検査してから更新拒否を確認し、無効な空配列だけで反証したとは扱わない。単独Operationは終了後に除去され、Task関連はTask保存まで保持される現行契約へ試験を接続する。

EMの状態遷移11件、現在回復の全field照合とrendererの指定2件、真正Ownerの終了保存・再入場の指定1件は成功した。EM全試験型とCo試験型も成功した。Owner試験ではblocked結果の再入場を維持し、既に確認済みの終了結果を再保存しないことを確認する。旧ACK試験の全追従・実Store再入場の再確認・台帳と最終レビューは継続中であり、先行成功を今回の全成立へ流用しない。全体回帰・実AI・Docker・過去保持物は操作しない。

続く限定確認では、current-recovery-resourcesの指定File全32件と、外部Effect不明後のexact回復から一度だけretryする実保存の指定1件が成功した。前記の同File指定ケースは32件へ含め、重複加算しない。旧「耐久受領準備ガード」と「配送登録」の2試験は廃止した段階の試験として退役させ、前者の現在境界拒否はObjectiveのexact技術終端試験・Task原子保存の相関負例・既存保存故障9ケースへ対応付ける。後者は新しい登録段階を代替新設しない。公開組立ての試験はconsumer名の分岐ではなく、実WriterのOperation保持／単独除去と技術・保存の共同条件を検証する。この時点で残したHost子Process fixtureの旧登録呼出しは、後続§14.24で追従する。

実保存の段階間取消では、技術終端を記録した直後でも最終Task保存前はOperationが保持されることを確認した。上位の停止3枝で公開結果の回復参照が欠落していたため、同じrecoveredDockerのexact IDと種別を返すよう是正した。これは新しいACKや回復判断を追加せず、保持中の実体と返却参照の相関を維持する修正である。取消・拒否・State改訂・Queue改訂の4条件、混在Recoveryと回復未開始からの再入場は成功済み。技術終端直後の取消も約43秒の限定再実行で成功し、保存されたsettled義務・物理Operation残存・同じ公開回復IDを確認した。今回のintake試験Rootは登録済みhookで回収され、実行後の同prefix最新残存は今回以前の物である。過去保持物は処置していない。

### 14.24 Host fixtureのACK追従と検査済み選定の搬送（継続中）

Host fixtureの旧配送四故障モードとrecover_delivery子入口を退役した。履歴六故障・Host清掃・Completion保存故障・fresh Process再入場は維持する。Task未結合の利用側相関二形も単独Operationとして整理し、consumer名だけで保持しない。元Receipt・発行状態・不存在checkpointは、除去前の最後の実保存Bookから観測する。新しい受領状態、互換API、製品Hookは追加しない。

初回限定実行はfixture内の変数名重複で子がEffect前停止した。修正後に構文・子入口既定拒否等の局所五件が成功した。今回の三Root（current-host-transition-10656の7CDGea／EIQ27l／b2aqhZ）は、合成Docker前提の既存Host回復Ownerで回収し、各Rootの不存在まで確認した。次のhistory_confirm_pending失敗は合成履歴に旧Schemaが残っていたためで、新Schemaへ追従後に同条件が成功した。その失敗Root（current-host-transition-34616-8g3AE0）は全Host／markerの不存在を確認して回収した。古い保持物の一括削除や移行はしていない。

単独回復の実保存で、Task関連確認の通常ReaderへOwner専用target引数を渡す誤接続を検出した。Root単位の結合にはoperationIdがないため、真正な回復でも拒否されていた。関連確認だけ既存の通常履歴Readerへ接続し、以降のexact ID・Task相関・履歴・Owner・単独Completionの再結合は維持する。独立確認で権限検査の緩和ではないことを確認し、identifiedの実保存が成功した。通常noneと履歴確認出版前中断も成功している。これらは合成Docker結果を使うHost／Filesystem試験であり、実Docker境界の成立ではない。

旧結果領収書だけを読むdocker-recovery-settlement試験は退役し、現在のexact技術終端／Task原子保存の反証へ対応付けた。Source台帳とVCの既知Consumer確認、Co設計・品質Registryも追従する。廃止済みACK Record／Resource二IDは現行台帳から除き、既存Task／回復Evidenceに必要な相関と保存条件を残す。EMの修復phase・現Operation参照中の履歴保護も現契約へ追従し、該当二File26件が成功した。Co設計追跡Checkerとその11試験、Runtime追跡Checkerも成功した。

検査の第一単位は、ObjectiveからTaskへの構築・現在状態投影で受付／保存済み選定を再検査せず搬送し、Task受付内の二重捕捉を一回へ減らすこと。独立確認でWriter返却値の凍結不足を見つけ、既存WriterのvalidState直後にJSON由来の二選定と組を一度だけ凍結した。値規則・保存byte・認可は不変更。局所四File30件と実StoreのPR-D-N-01一件で同参照搬送・三箇所の凍結・再送返却の不変性を確認し、同単位の再レビューに必須残指摘はない。Rootの残る四inspect公開を最小構成として確定したわけではなく、未保存入力と完全モデル搬送の受付契約整理は残る。全体回帰・実AI・Docker・過去保持物は操作しない。

最後に、EMの正常終端・履歴・単独終了の大きい実保存親一件が約51秒、Coの現在状態保存・pending再入場の親と子一件が約195秒で成功した。後者に残った正常checkpointの旧deliveries空配列を撤去し、旧fieldを含む負例は拒否のまま維持した。EM側では確認済み履歴と同じ時刻のcheckpointを用い、固定行一致検査を緩めていない。初回失敗・調査用の一時fixture診断は最終Sourceへ残していない。

identified初回失敗のRoot（current-host-transition-404-ch65t5）も全Host／markerの不存在とRoot境界を確認して回収した。現在のCo設計・品質Registryに残っていた旧ACK肯定要件は全文置換し、独立再確認で当該文書指摘の残件はなくなった。旧Source／試験へのSymbol・Test Catalog参照も撤去した。全体回帰や実AI／Docker試験の成功を主張せず、先行の大きい未コミット変更全体の完了又は公開物の最小性へ拡張しない。

Test Catalogの局所検査・計画二File27件も成功し、削除済み二Pathと旧SymbolのSource・QA・Architecture内参照は0件だった。最終台帳差分の独立確認にも必須残指摘はない。EM型、Co本番／試験型と差分空白確認は成功した。今回のHost Rootは回収済みで、同prefixの最新残存は今回以前の物だった。未保存Plan・外部選定・搬送された完全Decisionの受付契約に基づく四inspectの公開整理は、次の変更単位として残す。

### 14.25 同一受付内の選定再検査の削減（継続中）

助言Packet発行は、入口で捕捉した選定をProvider・役割・用途の相関とPacket Hashへ再利用する。単独callerのvalidInputは発行処理へ統合し、同じ選定の再捕捉を撤去した。技術投影と選定Hashの既存受付は別途維持し、一回検査だけで全経路を置換済みとは扱わない。単発Task記録も、同一の選定を三回検査せず、一度の検査結果を役割判定と返却へ使用する。値規則、保存形式、認可、Effect順序は変更しない。

残るinspectDecisionは、完全なDecisionモデルがCoordinatorのProcess応答で搬送されるための受付検査である。Root名だけを隠す、完全モデル検査をCoordinatorへ複製する、検査目的で再照会する方式は採用しない。操作応答の必要投影へ絞る案も独立確認したが、人間判断により完全記録を維持する。直接のCoordinator操作はEMの検査済み成功値をそのまま返し、unknownな搬送結果の受付だけでモデル検査を行う。受付では検査関数の戻り値を捨てず、その独立捕捉済みDecisionを返す。質問・回答者・日時・理由・適用結果は減らさず、Contract版や保存形式も変更しない。

この変更単位の限定試験はPacket五件、単発Task二件、MCP受付二十三件の計三十件が成功した。完全応答の深い一致、元入力からの分離と検査済み判断の凍結、選定単体は有効でも外側modeと役割が異なる場合の拒否を確認する。EM・Co本番／試験・MCPの型検査と変更SourceのLintも成功した。外部Process・実Git・実Storeを新たに起動する試験はこの単位に含めず、全体回帰・実AI・Docker・過去保持物は操作していない。

最終局所候補の独立レビューに必須残指摘はない。完全記録、未知結果の受付検査、ID・履歴・Effect・回復の相関維持を確認した。先行の大きい差分全体又は残る四inspect公開の最小性まで完了したとは扱わない。

### 14.26 Coordinatorの受付と内部搬送の分離（継続中）

人間判断により、EMのRoot名を先に削るのではなく、Coordinatorの重複受付・内部搬送を先に整理する。実装上、未保存Planとraw選定の受付は保存より前に必要であり、保存内部化だけで三inspectを外せるという先行案は成立していなかった。検査目的の先行保存、現在Catalogでの過去選定の再解決、別名Wrapper、モデル規則のコピーは追加しない。

第一単位では、公開Objective入口で捕捉済みのrequestをprivateな既存実行本体へ渡す。raw受付のrunCoordinatorObjectiveも同じ本体へ接続し、本番経路の二度目の要求捕捉を撤去した。計画照合もrequest全体を捕捉し直さず、依存Callbackの未知Planと捕捉済み許可Pathだけを検査する。取消Signal・Principal・Binding・依存Planの検査、EI記録・保存・実行の順序は維持する。新しいRunner、Authority又は保存段階は作らない。

二役割Resolverは同じ捕捉済み設定とworkTypeから生成した二成功値を不変の組へ収める。組を再検査する段階と、その段階にしか存在しなかったai_selection_pair_invalidの返却型候補を撤去した。一方の失敗は元の拒否結果を維持し、Reviewerへ明示choiceは渡さない。助言PlanとTask Packetも同じ受付内の選定再捕捉を減らし、最初の捕捉値を返却とHashへ渡す。Hashの独立した未知入力受付は維持する。

純粋三File十六件、助言四File十九件、実保存前のBinding／Plan拒否二件が成功した。要求・Principal・Signalの拒否、未知field・Getter・Proxy、許可Path、元設定変更からの分離と凍結を確認する。Co本番／試験型、変更SourceのLintも成功し、当該Source単位の独立レビューに必須残指摘はない。依存Callbackの値と真の外部受付はなお検査対象であり、三inspectのRoot撤去や全体回帰の完了は表示しない。全体回帰・実AI・Docker・過去保持物は操作していない。

追加で、公開構成からTask終了・明示受入・再入場を通す合成実行の指定一件が約128秒で成功した。成功した限定検証は計三十八件であり、件数を全Consumerの完成根拠へ拡大しない。同試験では同一要求再入場時のEI記録にrecord_identity_conflictの拒否診断も出たが、試験の合否と区別し、EIの挙動変更はこの単位へ追加しない。今回の試験Rootは既存の終了hookで回収する契約で、過去保持物の移行・処置は行っていない。追従文書の独立確認にも必須残指摘はない。

### 14.27 Task受付から選定Grantへの確定値搬送（継続中）

Task制御の四Stageに、既存要求受付のaccepted返却値から推論した局所型を使用する。未検証値を型変換で通さず、担当選定の取り出しは捕捉済みの凍結組を直接使用する。controllerのinspectTaskExecutionSelections依存を撤去した。Grant更新の左右は未知値として個別検査を維持し、操作ID・Provider・試行番号と正規化済み内容を比較する。内容比較のためだけのHash生成と、それに伴う選定再捕捉を撤去した。保存Hashは変更しない。

技術投影も、正規Grantの一回消費値又はPacket受付の捕捉値だけを受ける型へ狭めた。元Hash照合・操作結合・Capabilityの一回性・鮮度は維持する。Grant発行・preflightの未知入力受付、Provider利用可否の現在観測、外部要求の拒否はこの変更で削除していない。新しいWrapper・Registry・状態・保存段階は追加しない。

指定Task制御四件と、Grant／Packet／Provider接続三File三十九件の計四十三件が成功した。受付で捕捉した組とGrant要求の同参照、凍結、キー順差の同値、Model／設定Identity差・未知field・nullのProvider開始前拒否を確認する。Co本番／試験型とSourceのLintは成功し、既存試験内のuseTemplate情報一件は警告・失敗ではないため無関係な書換えをしない。当該Source単位の独立レビューに必須残指摘はない。三inspectのRoot公開はなお残り、この局所改善を全受付整理・Root最小化・全体回帰の完了とは扱わない。全体回帰・実AI・Docker・過去保持物は操作していない。

続いて、Grant更新で比較済みreplacementを通常発行へ生のまま渡し、再捕捉していた経路を撤去した。通常発行と更新は、捕捉済み選定を受けるprivateな既存発行本体へ接続する。発行本体は利用可否・技術適合・Hash・時刻・ID重複とMap登録の実体を持ち、単なる別名Wrapperではない。通常発行の管理確認から操作確認・捕捉の順序、更新時の元Grant・鮮度・Hash・試行・操作確認は維持する。新規の状態、Owner、公開API又は保存段階は増やさない。

更新時の操作確認Callbackが生replacementを別Providerへ変更しても、比較した同じ選定・元Hashを発行することを反証試験へ追加した。発行・更新の操作確認回数は一回ずつで、新Grant成功後の旧Grant失効・新Grant一回消費を確認する。別操作・確認例外・利用不可・ID生成失敗では元Grantの消費が引き続き可能である。最終版で同じ三File三十九件と指定Task四件を再実行し成功した。前記四十三件との重複加算はしない。Co本番／試験型、警告0のLint、当該追加Sourceの独立レビューも成功し、無関係な既存useTemplate情報二件は書き換えていない。

文書最終確認では、成功後の旧Grant除去という説明を有効な元Grantの置換へ限定した。無効・期限切れの元Grantを従来どおり退役する処理は維持しており、更新失敗時の有効Grant保持とは区別する。コードの条件変更は行っていない。限定条件の独立再確認にも必須残指摘はない。

### 14.28 保存取得とLease識別値のOwner統合（継続中）

`readSnapshotIntakeEpoch`の専用実装・Root公開を撤去し、既存`readState`の固定`intake`範囲へ統合した。返却は受付世代だけとし、元の出版確認用読取りモード、明示不存在、破損拒否、短期排他と解放不明を維持する。通常の`execution`／`workspace`読取りへ出版marker許容を広げない。CoのPort単独構成はこの取得を一度だけ呼び、未初期化を暗黙初期化しない。Operationの段階取得`readOperationStateStage`は本文を変えず、保存内部から`attempt/crud.ts`へ移した。Root名・返却・処置順は不変更で、旧所在地のWrapperは残さない。

Leaseの意味入力を受ける既存`acquireLease`のIntent保存が、閉じたOwner入力・対象・種別を確認し、正本のIdentity・回復ID・Intentを生成する。保存前の既存通知へexact回復IDを渡し、保存不明時にも同じ参照を保持する。Coは成功値のIdentityとIntentを使って元の物理Lock取得・確認へ進む。Owner喪失の既存照会も同じIdentityと回復IDを返し、Queue解放の不存在観測へ同じIdentityを渡す。二つの生成HelperのRoot公開とCo側再計算を撤去した。保存Schema・Path・排他Scope・回復Protocolと通知順は不変更で、新しい保存段階・Store・Managerは追加しない。Rootは116項目（81値・35型）となった。

今回の限定検証は、保存取得・公開境界・故障fixtureの各指定試験、Lease候補と公開境界の二File十四件、実保存の区画検査一件、CoのPort取得一件、公開Objective再入場／不正Queue二件、Lease取得・解放途中／統合結果保存二件が成功した。二File十四件の再実行や先行公開境界試験を重複加算しない。新しいOwner入力のGetter・余剰field・PID不正でcallback零、正常時の不存在→Root→保存前通知、生成Intent一致を確認する。EM型、Co本番／試験型、変更Sourceの整形とLintは成功し、既存の情報レベル八件は製品の失敗・警告と扱わない。独立Source確認に必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作していない。

残る公開物の処置は次のとおり。単なるRoot非公開化で完了にしない。

| 集合 | 現在の必要性と次の処置 |
|---|---|
| Plan／選定の三inspect | 未保存Plan・外部選定は保存前に必要。保存内検査だけでは代替できず、検査目的の先行保存・Coへの検査コピー・別名Wrapperは採用しない。受付／内部搬送の重複は先行単位で削減したが、この三公開の撤去は未完了 |
| 完全Decisionのinspect | 人間判断により完全記録搬送を維持。直接APIは検査済み成功値を返し、未知のProcess搬送結果だけ同じモデル検査を使う |
| 資源Book更新・遷移検査 | Coの独立認証記録・Home横断記録と実記録イベント列のQAが使用する。Operation保存だけへの押込みは架空Operation又は先行保存を必要とするため行わない |
| 資源・修復のsettled判定／再起動ID | 既存の保存・段階取得結果へ、対象版に結合した次操作可否を返す統合候補。Effect前分岐を保存後検査へ遅らせない。今回未変更 |
| Host／Task回復ID解析・系譜検査 | Operation保存前の対象Root・nonce・排他選定で使用する。既存の生成側から確定値を搬送する経路の全対応が必要で、保存Readerだけに置換しない |
| Principal・状態定数・完了理由集合 | 入口での主体受付、空状態投影、Co結果とEM履歴の同一語彙に実利用がある。コピーによる正本二重化を避け、今回維持 |
| 出版marker回収 | 修復再入場と終端の二地点で、個別の処置／不存在／保存保全／解放結果を確認する完成操作。保存Helperという名前だけで削除せず、修復操作の結果契約と再入場順序を一体で見直す。今回維持 |

この単位の限定成功を、残る公開物全撤去・Root最小化又は先行の大きい未コミット差分全体の完了へ拡張しない。

### 14.29 修復Checkpointの保存結果への判定統合（継続中）

`saveRepairState`の成功valueに、返す`operation.checkpoint`を既存のEM検査で判定した`checkpointSettled`を追加した。通常Writer成功と同値の再観測成功を揃え、失敗・確認不明・解放不明では従来どおりvalueを返さない。Coは既存の成功条件がすべて成立した後だけ、対象・元版・判定を同時更新する。最終Checkpoint保存直後にその判定を使い、保存失敗後の過去のtrueを使用しない。Engine・Host安全性・Cleanup・Lifecycle失敗の個別条件は維持する。八処置の値上の終端は修復全体の成功ではない。

`isRepairCheckpointSettled`のRoot公開とCo本番の呼出しを撤去した。EM内部の検査とDIの技術実装は不変更。Co試験は保存成功ごとに、返却判定と既存DI技術検査の同値性を確認する。Rootは115項目（80値・35型）で、公開型・保存Schema・新Store・Wrapper・追加I/Oは増やしていない。既存Suite内の試験追従であり、Source／Test台帳のFile集合とTrace IDは変更しない。

EMの修復値・公開境界二File十八件、no-op異常入力／技術・保存対照二件、実保存の専用Owner一件は成功した。no-opの未確認Reader・Owner失効ではvalue:null、正常は同対象のtrue、初回実保存はfalseを確認する。EM型・Co本番／試験型、変更Sourceの整形・Lintは成功し、既存の情報レベル九件は警告・失敗としない。当該Sourceの独立レビューに必須残指摘はない。Coの指定三試験（28ケース）は約31.5分で成功し、既存の終了hookと不存在確認に例外はなかった。この結果は本節のCheckpoint統合段階だけに対応し、後続の観測結果統合へ流用しない。全体回帰・実AI・Docker・過去保持物は操作していない。

廃棄判定は、既存の再入場で全用途の不存在確認済み・新保存なしとなる経路があるため、今回の保存結果だけで置換しない。出版marker回収も修復再入場と終了の各必要事実を確認する完成操作として維持しており、単なる非公開化や別名Wrapperは追加しない。これらと資源判定の残る統合は未完了である。

### 14.30 残る操作判定とState出版の責務統合（修正候補・検証前）

人間指示により、機能ごとに回帰を挟まず、本番Source・利用側・試験コード・文書の追従を先にまとめる。先行実行中だった§14.29の試験は一回で終了し、その後の回帰はまだ起動していない。現在の修正候補の型検査は通過しているが、最終の限定回帰・独立レビューは未実施であり、本節全体の完成を表示しない。

| 修正対象 | 反映内容 | 不変更の境界 |
|---|---|---|
| 資源終端・再起動終端・認証不明の閉鎖条件 | 正常Readerの`value.operationStates`に、返す同じSnapshot内の操作参照と既存判定を結合。Co本番の三検査呼出しとRoot公開を撤去 | Effect前のfresh確認、Host／Home／Lease・履歴の独立条件、モデル内部の検査 |
| 修復廃棄の終端条件 | Readerと`saveRepairState`成功valueへ判定を投影。保存なしの再入場も同じReaderから取得し、対象・版と一緒に更新。Root検査を撤去 | 三用途の個別不存在、廃棄記録欠測はfalse、保持／not_applicableとの区別 |
| 出版markerの完了 | 実装をstorageからStateへ移し、`completeStatePublication`として公開。旧名・旧所在地・互換Wrapperを撤去 | 呼出し順・前後実体照合・本文保全・処置／不存在／解放の個別結果・失敗理由 |
| 試験・利用側 | Model内部の純粋検査は宣言元へ、外部利用は完成操作の同版観測へ接続。Coの有限Reader代役は既知段階の期待DTOを供給 | Root限定Guard、実資源と有限代役の区別、故障注入のOracle |

操作観測は取得結果だけの不変な値であり、保存Schema・新しいStore・Registry・Manager・Authorityは追加しない。判別Unionの各項目は同じ操作への参照を持つ。CoはID一致だけで別版の値を混ぜず、保持Snapshotの更新時には観測も同時更新する。再起動Scopeの構築でも、必要な操作の同参照観測が欠けていれば停止し、未知をScope外へ除外しない。元の保存本文・CAS・物理排他・技術Effectの順序は変更しない。

Rootは111項目（76値・35型）。既存Source／Suite内の処置で、File集合・Trace IDを新設していない。旧helperの外部import、旧marker名と旧Root公開の残存はSource走査で確認する。対象の整形・型・Lintと差分確認は修正時の整合確認であり、動作回帰・独立最終レビューとは別に扱う。全体回帰・実AI・Docker・過去保持物は操作しない。

### 14.31 validation由来18公開の全件処置

Rootの所在だけで必要性を判定せず、全18件を利用側とEffect前の責務へ対応付けた。処置は実装Owner移管七件、既存Readerへの統合によるRoot撤去二件、現在の受付契約として維持九件である。Rootは109項目（74値・35型）、validation由来は九件となった。公開最小性や現候補の動作検証完了は主張しない。

| 処置 | 対象 | 具体的な対応 |
|---|---|---|
| 完成操作のOwner移管 | applyResourceEvent、applyResourceCleanup | 本体をattempt/crudへ移し、旧再export・Wrapperを残さない。State候補は同じ純粋更新を使用 |
| 完成操作のOwner移管 | createLocalPrincipalId | 本体をstate/crudへ移し、形式検査は同じ構築規則を参照。prefixは内部の値契約として共有 |
| 値契約の正本化 | OBJECTIVE_STATES、TASK_STATES、PROJECT_STATE_CONTRACT、dockerProcessControllerPublicCompletionReasons | モデル別typesへ移管。Objective／Taskの状態型も同じ不変列挙から定義し、値のコピーを減らす |
| Root撤去 | createDockerRestartRequestId | 既存の排他取得後Readerをrestart_preparationへ置換。exact対象とScopeから同版の要求IDを導出し、prepared返却・私有準備へ搬送。追加I/O・保存なし |
| Root撤去 | validateHostRecoveryTransitionLineage | 検査済みpending lineageをoperationStatesへ投影。新しい意図は既存Writerと保存後fresh Readerを経てから技術処置に使用。実Hostの照合は維持 |
| 入力受付として維持 | inspectDecision、inspectExecutionPlan、inspectExecutionSelection、inspectTaskExecutionSelections、isPrincipalId | 完全モデル搬送又は未保存入力の拒否に必要。先行保存・再選定・Co規則コピーで置換しない |
| 保存前相関として維持 | parseDockerTaskRecoveryId、parseHostRecoveryToken | 失敗診断・Operation未作成・Host-onlyでも元相関を確認するため、保存Readerだけへ押し込まない |
| 独立記録受付として維持 | validateResourceBook、validateResourceBookTransition | Home横断の独立認証記録Readerと、IPC後の動的QAに実責務がある。更新Producerの成功だけで搬送後の連続性を代替しない |

純粋更新・主体構築を呼ぶ内部検査は保存・外部Effectを発行しない。循環する既存Module群では移管対象は関数宣言であり、移管した値定数は型Owner側で独立初期化する。新しいManager・Registry・Store・互換Facadeは作らない。保存形式・IPC・Hash Envelope・物理排他・Timeout・安全条件は変更しない。未要求の準備値と、正常読取り後の準備不成立は区別し、Readerのcompletedだけで再起動へ進まない。

利用側と試験コードも追従した。Coにあった純粋Host lineage二試験はEMの既存restart-checkpoint Suiteへ統合し、旧Co Suite・Symbol登録を撤去した。既存Trace IDを維持し、新Suiteや互換試験Adapterは追加しない。ID期待値はCoの既存試験補助にある固定Envelopeのfixture構築へ接続し、製品の入力検査のコピーとは分離する。新Readerの同参照・Scope違い・別ID・Getter・余剰field・不正Scopeの反証を既存Suiteへ追加した。

着手前の独立読取り確認と最終独立レビューを区別した。Source・利用側・試験コード・台帳・文書を先にまとめ、その後に下記の限定検証を行った。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.32 最終の漏れ確認と限定検証

独立レビュー二系統で、削除済みCo unit Suiteへのpackage script参照一件を検出し、そのPathだけを撤去した。coverage閾値と他対象は変更せず、再確認で解消した。

限定回帰の初回ではEM一件・Co五件が失敗した。EMは認証回収の受付条件と回収不要の事実を混同した期待値、Coはplanned Bookを一律未終端とした有限Reader代役が原因だった。製品判定を変更せず、EMは正本の判定との同値を確認し、Coは既知Book参照だけを肯定事実へ結合した。未知BookとモデルReader拒否は否定のまま保持する。変更範囲の警告全件確認で、旧受領field負例が候補へfieldを渡していない追従漏れも検出した。退役fieldを明示した候補の拒否・元bytes保全へ是正し、旧ACKの機能復活は行っていない。

| 検証 | 結果と境界 |
|---|---|
| EM公開境界・資源Book・再起動Checkpoint・状態遷移の四Suite | 32件成功。実Module読込みと新Reader、相関、異常入力を確認 |
| Co Host Identity・Host観測・再起動準備順序の三Suite | 22件成功。有限代役を用い、実Docker／実Host修復は実行しない |
| EM複合Stateの実保存Reader一件 | 成功。今回の自己生成Repositoryで不存在・同版・破損を確認 |
| Co通常Task終端・退役受領field拒否一件 | 成功。今回の自己生成Repositoryで保存・拒否・元bytes保全を確認 |
| Co Platform非依存の責務分類・純粋import閉包 | 六件成功。最終走査で検出した旧二Sourceと未登録五Source、Decision受付の限定依存を現行責務へ追従 |
| EM／Co型検査、変更TS／JSONの整形・警告検査 | 成功。全体回帰の代替ではない |
| Co実行資源・Task設計の追跡検査 | ともにaccepted |

限定回帰は計62件成功。先行段階の結果を現候補全体の回帰成功へ読み替えない。Root109項目・validation由来九件は理由付きで残しており、全検査公開の撤去や最小性の証明を完了とは表示しない。全体回帰と実境界E2E、別途追跡中の残件は未実施・保留のまま維持する。

### 14.33 Package全体の依存方向と試験Ownerの再整理（着手）

基準版はb2bdf0d0c。人間は本番だけでなくscripts・bin・試験・fixture・型・動的importを含めた依存方向の是正と、試験を削減せず適切なOwnerへ移管する方針を採用した。書込みは現在Repositoryだけ。保存形式、CAS、Lock、認可、安全判定、失敗・回復情報を変更せず、実AI・Docker・全体回帰・過去保持物を操作しない。

| 対象群 | 現在の問題 | 予定処置 |
|---|---|---|
| AD→Coordinator／DIの試験 | 利用側選定と技術配置の接続試験が下位にある | 接続試験をCoへ移し、AD単独検証はADへ残す。公開DI構成で足りる箇所は非公開参照を撤去 |
| DI→Executor／EMの試験と補助 | 技術保証と用途別構成・保存Book検査が混在 | DI単独検証、Executor接続、Co保存接続へ責務単位で分離。既存反証を全数対応付ける |
| Executor→EM／Coordinatorの試験・scripts | 上位保存と送信前検査が技術実行検証へ混入 | EMの値・遷移はEM、実行と保存の接続はCoへ。ExecutorにEM Adapterを残さない |
| VC／CheckerのEM試験補助借用 | 上位の試験補助なしに単独検証できない | 各Ownerで必要な局所試験準備へ整理。製品モデル規則を複製しない |
| EM→AD／DIの型と試験 | 永続契約の定義権限と技術契約が結合 | EMが保存形状を所有し、対応はCoで検証。意味のない実行時変換は追加しない |
| Co→Workbench／MCP、同列Packageの試験 | 利用者入口の試験が下位にある | 各入口Ownerへ移管。上位から下位の非公開fixture利用も独立に評価 |
| AMのEM向け型・文書解析 | 認可結果とモデル固有の接続が混在する候補 | 登録対象確認を削らずOwnerと適合点を確定してから処置 |

最初の編集単位はADのselection-consumers Suite全体のCo移管とする。試験名・全assert・Trace・Suite識別子を維持し、OwnerとPath、直接依存、設計案内を追従する。新Facade・共通Package・互換Wrapperは追加しない。各単位の限定静的確認・該当試験と独立レビューを行い、全移管完了と部分成立を区別する。CRDD標準の準拠基準・決定権限は変更しないため準拠監査は起動せず、Package責務・試験追跡・依存方向の専門確認を適用する。

EM公開案は107を最終固定せず、不要二入口の撤去に加え、二ReaderのreadState統合、回復完了二入口と回復履歴二入口の統合を推奨する。この六件削減が成立した案は103公開（68値・35型）。さらに三Stage保存を用途別入力のsaveRecoveryCheckpointへ統合できれば100公開（65値・35型）となるが、Authorityと保存順序を照合する前に確定・実装済みと表示しない。保存前検査を省略する統合や汎用Snapshot Writerは採用しない。

第一単位ではselection-consumersの二試験をCoへ移し、全assertと試験名、追跡ID、安定Suite／Symbol IDを維持した。DI内部配置関数の直接参照は既存公開構成のlocations.primaryへ接続し、製品公開を増やしていない。VCは四箇所のSource抽出を同Suite内の局所補助へ閉じ、EMへのimportを撤去した。構文木のexact宣言選択・欠測・重複拒否・型除去を維持し、モデル検査や新しい共通Packageは複製していない。CoとVCの型検査、変更対象の整形・警告確認、移管二試験とVC局所二試験は成功した。着手前読取り確認は最終レビューとは別に記録する。残る移管群とEMの公開削減は未実装であり、現Root109はこの単位では変えない。

第一単位の実装後独立レビューは必須残指摘なし。移動前後の二試験・26 assertと、Import／境界説明／公開構成への置換を除く試験本文の一致を確認した。VC局所補助もexport除去以外の関数本文と四呼出しを維持する。レビューは静的確認であり、親側が実施した限定四件の結果と区別する。

### 14.34 EM保存型の所有権と技術契約適合（着手）

AD／DIの実行時処理は変更せず、EMのExecutionSelection、OperationResources.snapshot、一次失敗のturnCountDiagnosticを同じProperty・値域・readonly性のEM保存契約として定義する。storage/lockのDIインライン型参照も同じ保存契約へ接続する。保存Schema・codec・検査本体・Hash・CAS・I/O順序・Root公開集合は変更しない。構造が同一の値に実行時コピーや変換Wrapperは追加しない。

EM単独の資源Book値試験はEMの保存型を使う。AD選定・診断とDI技術Snapshotへの型適合は、第一単位でCoへ移管した既存Suiteで型の双方向適合を確認する。EM srcの静的／型／動的参照とpackage宣言にAD／DIを戻さない境界試験を追加する。既存のEM修復技術接続試験はこの型単位とは別の移管対象であり、単独試験やPackage全体の独立性を先行して完成とは表示しない。

型Owner単位はEMの限定16件、Coの適合を含む三件と両型検査が成功し、実装後独立レビューの必須残指摘はない。AD／DI解決を拒否する新品NodeでEM Rootを読めることも局所確認した（保存・実行はしない）。Root109と保存検査は不変更。

### 14.35 AD試験の生成子コードと配置連携のOwner移管（着手）

通常import以外にcatalog-loading Suiteの生成子コードがEM Rootを起動していた。この試験は非公開化済みの旧Root理由定数を参照しており、AD配下からEMを操作する逆依存と旧公開前提が混在している。ADなしのEMロードはEMのITへ移し、子のerror／signal／exit／stdout確認と新品Processでの解決拒否を維持する。理由は現公開の全完了理由集合を親の同公開集合とexact比較する。AD拒否理由とEM保存語彙の対応は既存Co試験の10反例・exact理由集合・公開語彙包含の検証を維持する。UTへ子Process試験を追加せず、ITの台帳を登録する。

同Suite先頭の本文・拒否理由・固定Schema検査はADへ残す。末尾の両Provider計画と実DI配置のループはCoの既存selection-consumersへ移し、Codex alternate／Claude primary、全Model／alias／Effort／Tool／Session／stdin条件を維持する。Coでは両Packageの公開APIを利用する。試験の削減や旧非公開Rootの再公開は行わず、Trace・既存Suiteの残る責務・新所在地を接続する。

移管後のAD限定回帰で旧Schema Hash期待値一件が失敗した。Gitのa7618c6d0で承認済みのmaxItems／maxLength撤去前のitemArraySchemaと全体Schemaを読取り再構成し、旧期待Hash e07a0664…と一致することを確認。現SourceのSchemaはd7ff3776…であり、今回製品Schemaの差分はない。試験の固定期待値だけを現在の正本へ追従し、Hash検査や内容拒否を削除して通さない。元のHashは歴史上のEvidenceとして残す。

最終限定セットはEMの公開境界・資源Book・Task値三Suiteで16件、Coの選定・型適合・配置連携で四件、AD Catalogで三件、EM独立ロードIT一件、Coの全10拒否理由とEM公開語彙接続一件の計25件が成功した。型OwnerのEM／Coと移管対象ADの型検査、対象TSの整形・警告確認とJSON読取りも成功した。AD Catalogの今回作成した一時fixtureは既存finallyで回収され、過去保持物は操作しない。

独立レビューではSource・試験移管・登録に必須指摘なし、AD設計が解消済みDI参照を未処置とした記載一件を検出した。各Ownerへの移管済み範囲と残る他Package群を区別して是正した。全体回帰・実AI・実Dockerを実施済みとは表示せず、DI／Executor／Co／AM等の依存移管とEM公開入口統合は継続対象とする。

最終自己確認ではSelectionの比較対象を相手型のkeyofからではなく、保存契約の技術五fieldへ固定した。相手側のfield削除に比較対象まで追従して欠落を隠す反例を防ぐ。Coの型検査と四件を再確認し、文書是正と併せた独立再確認の必須残指摘はない。

### 14.36 DI／Executorの試験基盤借用の撤去（着手）

EMのtests/supportから借用するSource宣言抽出と新品Repository-local試験Root管理は、EMモデル規則ではなく試験準備の技術処理である。DI／Executorそれぞれの既存tests/supportへ局所化し、各Package単独で準備と清掃を行えるようにする。製品API・Facade・新しい共通Packageは追加しない。構文木のexact宣言・型除去・重複拒否、Root実体確認・未知状態での停止・同一実体だけの清掃を変えず、元Suiteの試験名とassertを維持する。

対象はExecutorのcontroller／notifications／binding／attempt-common／provider-real-cliのSource抽出、report.integrationのRoot管理とその本文反証、DIのeffect-cleanupのSource抽出とrepair-directory-disposalのRoot管理。変更キーは各FileのEM補助importと、report.integrationの補助Source所在だけ。型検査・対象の整形と警告確認、局所代役又は今回の新品Rootだけを使う限定試験で確認する。既存の試験補助実装を各Ownerへ局所化することと、EM資源Bookを使う接続試験・検証CLIのOwner移管を区別し、この単位だけで下位Package全体の独立性を主張しない。

四つの局所補助を各Symbol正本へ登録し、八利用Fileの元試験名65件・assert呼出し657個を変更前後で維持した。モデル規則は複製せず、試験基盤の必要なアルゴリズムだけを独立所有する。両Package型検査と対象TSの整形・警告確認は成功。限定範囲はExecutorのcontroller／notifications／bindingで12件、reportの新品Rootと故障模型で二件、attempt-commonで16件、provider-real-cliの純粋Reader一件、DIのHome技術排他一件と退避Root回収三件の計35件が成功した。全65件の実行成功とは主張しない。

DI退避RootのWindows実体試験は初回Junction作成が環境権限のEPERMで停止した。作成済み新品Rootは登録済み終了処理で回収され、exact Pathの不存在を確認した。同じ一件だけを許可された権限境界外で再実行し成功した。試験条件、製品の安全判定、Timeoutを変更せず、実Docker・実AI・過去保持物は操作していない。

実装後の独立レビューは必須残指摘なし。四補助の関数本文同値、八Fileの65試験・657 assert維持、旧EM補助参照0、Symbol／設計追従を読取り再確認した。これは残るモデル接続・検証CLIの移管や、全試験回帰の完成を意味しない。

### 14.37 Executor通知とEM記録・理由語彙の接続試験移管（着手）

Executor単独の理由凍結・一意性・用途Map・全理由受理・未知拒否はExecutorへ残し、EM公開理由列とのexact比較だけをCoの既存provider-advice-output Suiteへ移す。固定値コピー・型Unionだけへの弱い置換・新たな製品公開は行わない。現公開IFでは実列を取得できないため、Coのこの比較試験に限り実Producerの内部定数を読む。試験上のexact列比較を製品Consumerの深い参照許可へ拡張しない。

attempt-commonの16試験中、通知をEM資源Bookへ適用する一試験をCoのunit/execution/resource-recordへ移す。元の有限技術fixture実体はExecutorのtests/fixtures/attempt-executionへ一意に配置し、残る15試験とCo接続試験が同じ実装を利用する。準備・開始・取消と各呼出しの新しい状態、全故障条件を維持し、Book規則はfixtureへ入れない。登録済みの有限Producerを使う試験限定の接続であり、製品API・一般的な試験起動許可・実Docker／耐久保存の成立ではない。元test名・assert・Traceを維持し、移管先／fixtureのSymbolと台帳・設計を追従する。

直接import撤去後の閉包確認で、単独UTがisPrimaryFailureDiagnosticをEM記録Hostから読む間接依存も確認した。純粋診断検査と専用exactKeysの実体をExecutor内scripts/provider-diagnosticへ移し、Hostの旧export／旧importを撤去する。単独UT・実試験CLI・上位の検証scriptはこの純粋実体へ直接接続する。理由・用途・各field相関の検査を複製せず、I/O・モデル記録・Root公開・Wrapperを追加しない。記録Hostと実試験CLI自体の上位移管は引き続き別群とする。

混在した理由試験は、下位の技術単独検証とCoの接続比較という二名称へ分け、元のexact列比較は順序・全要素を含めて維持した。通知接続試験は元のtest名を維持する。移管前の三Suiteと、移管後の四Suite＋単一fixtureのassert呼出しは合計190個で一致する。固定値コピーや試験の削減で依存を除去していない。

Executorの二Suiteで18件、Coの記録接続と理由／Provider出力二Suiteで12件、CLI先行hookと現行Source／Symbolの限定二件、計32件が成功。Executor・Co・Workbenchの型検査と対象の整形／警告確認も成功した。EM／CoのModule解決を拒否した新品Nodeで、局所診断と有限Producerの開始・Completion・回収成功を確認し、直接importを隠しただけの間接依存ではないことを局所反証した。実AI・実Docker・過去保持物・全体回帰は操作しない。

実装後の独立レビューは必須是正指摘なし。fixture本体と純粋診断検査の同値、全190 assertの保持、理由列比較の上位移管、通知接続試験の本文、登録と残件の区別を読取り確認した。レビュー担当は試験を再実行しておらず、32件の実行結果は親側の限定検証として区別する。既存Symbol IDにCoordinator名が残るものも、実体の登録先はExecutorのsrc/lifecycle/attempt.tsであり、名前だけから逆依存と判断したり安定IDを改名したりしない。

### 14.38 次の検証CLI移管群の依存閉包（調査）

記録Hostの移動だけではExecutorのEM依存は閉じない。verify-provider-realはEMのBook検査と保存失敗型を直接読み、provider-attempt-hostはEMへの記録を行う。両者はCo側の検証接続Ownerへまとめて移す対象であり、旧入口を転送Wrapperとして残さない。ただし、単独技術検証のverify-provider-attemptとHome境界検証のverify-provider-homeもruntime-dataを共有するため、この補助を一括でCoへ移すと新たなExecutor→Co依存が生じる。

| 接続 | 現状と次の処置 |
|---|---|
| runtime-dataのEM参照 | 保存処理ではなく、Ignore登録失敗をExecutionStorageBlockedErrorへ変換する箇所。技術的な失敗観測を維持し、EM保存用の例外への変換を記録Ownerへ戻す。例外名だけを変えた独自互換型は追加しない |
| 記録Hostと実試験CLI | 両実体と対応する接続試験、package起動入口、Symbol、台帳、文書を同一単位で上位へ移管する |
| CLIの先行読込み禁止hook | 現在はCoordinatorの全Moduleを禁止する。移管後は検証script自身と製品Coordinatorの起動禁止を区別し、静的依存変異を拒否する既存反証を保持する |
| モデル側のConsumer Closure試験 | storage-consumer-closure内に旧scriptのPathがある。実Consumerの新Ownerへ追従し、移動だけで試験対象を欠落させない |
| VCのConsumer接続試験 | VC配下にもこれら上位scriptを対象とした検査がある。技術単独検査と上位接続を分離する対象であり、上位Pathを新Pathへ置換するだけでVCの依存是正完了としない |

本節は移管前の影響整理であり、このCLI群の移管・EM公開入口統合は未実装。記録形式、失敗理由、Effect情報、回収未確認、保存順序、既存の先行拒否を変更する許可とは扱わない。

### 14.39 試験領域準備のEM例外依存の除去

変更分類はPackage内部の責務分離。着手前にOwner、三Consumer、失敗の搬送先、既存試験の代役を照合し、独立読取り確認で着手可とした。追加のManager・例外型・Wrapperは作らない。標準のError/causeによるProcess内の情報保持と、既存CLIの明示JSON搬送は別の契約として確認する。準拠基準・保存形式・決定権限を変更しないため準拠監査は行わず、依存方向・失敗情報・試験追従の独立レビューを行う。

runtime-dataのrequireReadyはreadyを同参照で返し、nullは従来のinvalidReason、blockedは標準Errorのcauseへ元結果を同参照で保持する。理由、Effect発行／不明、回収、再試行、exact回復参照とeffectConfirmationを捨てない。実試験CLIは直前のensure結果がblockedの場合だけ既存ExecutionStorageBlockedErrorへ渡し、従来のJSON項目を維持する。Ignore登録・Directory確認・作成順序・Link拒否は変更しない。

旧CLI試験のModule代役二名が旧ExecutionData名のままだったため、現実体のRuntimeData名へ追従した。元のEffect0と公開失敗fieldのexact比較を保持する。既存public-boundary Suiteへ、新品NodeでEM／Co解決と書込み／Process起動を拒否し、補助と単独二入口の読込み、ready／null／blockedの扱いを検証する一件を追加した。既存SuiteのSymbol／台帳へ検証対象と終了条件を追加し、Suite・公開APIは増やさない。

限定検証は新しい技術補助一件、既存CLIのEffect前拒否・先行hook二件、Source／Symbol接続一件、Home排他Requestの純粋一件の計五件が成功。Executorの型検査、対象TSの整形と警告検査、JSON二正本の読取りと差分空白検査も成功した。試験内の書込み禁止は列挙したAPIと現在の読込み閉包を対象とし、将来の任意I/Oすべての不存在証明とは扱わない。CM側は旧名の非公開確認だけであり変更非該当。実装後独立レビューは必須是正指摘なしで、レビュー担当は読取りのみ、五件の実行は親側の検証である。全体回帰・実AI・Docker・実Home・過去保持物は操作していない。検証CLI／記録Host本体の上位移管とEM公開入口統合は引き続き未完了。

### 14.40 EM記録を行う検証CLI／Hostの上位移管

着手前に全import、生成子コード、fork先、Repository Root導出、Source走査、起動入口と登録、VC／EM Consumer集合を照合し、独立読取り確認で着手可とした。実装責務と試験Ownerの変更であり、工程規範・保存形式・権限判断は変えない。技術／品質の独立レビューと追跡・文書確認を実施し、全体回帰と準拠監査、実AI／Docker検証は実施しない。

provider-attempt-hostとverify-provider-realの実体、対応する二IT Suite（計九試験・208 assert）をExecutorからCoの同じ深さへ移した。Root導出、記録Intent／Receipt、Completion、取消、Timeoutと回収の順序は維持する。Executor public-boundaryから、Co SourceとTool接続を確認する二試験（17 assert）および専用OracleをCoのprovider-verification-boundaryへ移す。元の安定Suite IDは名前だけで変更せず、OwnerとPathを追従する。新しい接続Suiteは既存QA／Traceへ登録する。

技術補助のprovider-home／report／runtime-data／provider-diagnosticと有限task-trial／Source抽出はExecutorに残し、Coから明示的に利用する。製品Root公開、転送Wrapper、独立Lifecycleは追加しない。Executor側の独立ロード検証に残ったEM事前読込みとモデル拒否解除も撤去し、モデルを読めない条件を維持した。CLI先行hookはCoのsrc／binを拒否し、移管先の検証script自身を許容する。変異試験は製品Module評価零を維持する。

起動入口をCoのverify:providerへ移し、両Symbol・台帳・Co型検査対象・正式QAと設計、VC／EMの現行Path一覧を追従した。VC配下の上位接続試験自体のOwner不整合や、DIの用途混在fixtureの整理は未完了であり、Path追従だけで全Package依存是正完了とは表示しない。

限定回帰の初回14件中12件が成功し、二件で追従漏れを検出した。一件はCLI計画試験の生成子コードに残ったCo全体拒否hookであり、製品src／bin拒否へ追従した。他方はbe14e5babで撤去済みのsettlement.tsへの既存Source参照である。Git履歴と現行persistence／operationの終了観測搬送を照合し、検査対象を元観測Ownerのoperationへ更新した。assertは削除せず、元Factoryの一意性・深い参照拒否・逆照会拒否を維持する。二件とSymbol接続の計三件を再実行し全て成功した。既存十二件と合わせ限定十四件の各条件が成功。Source／Symbol検査は移管先Coも走査対象へ加えた。

Co本番／試験とExecutorの型検査、対象TSの整形・警告検査、JSON読取り、差分空白確認を実施した。新品の合成試験物は各既存試験の回収Oracleで処置し、過去保持物は操作していない。実AI・Docker・実Home・全体回帰は実行していない。EM Rootの公開数は109のままで、本移管をEM公開削減の完了とはしない。

Checkerの安定Suite／Symbol参照を含む意味接続の局所一件も成功し、限定検証は計15件となった。独立レビューでは、二scriptの処理本文、九試験・208 assert、接続二試験、上位読込み拒否、全搬送経路と現在参照、登録／文書に必須是正指摘なし。レビューは読取りのみであり、15件の実行結果は親側の検証として区別する。残るExecutorのtask-summary-observationのCo機密検査接続、DIの上位型／混在試験、Coの上位Consumer試験、VC内の上位接続検査、AM境界とEM公開統合は別途継続する。

### 14.41 Workbench診断表示の観測処理と試験のOwner移管

変更分類は検証処理の責務移管。最初は機密検査接続だけの分割を検討したが、唯一の外部ConsumerとTrialReportの意味がWorkbench専用であることを確認し、処理と二試験を同Ownerへまとめる方針へ修正した。着手前の独立読取り確認で着手可。Executorへモデル・表示の知識を残したまま試験だけを分けたり、新fixture／Facadeを追加したりしない。準拠基準や権限判断は変えず、依存方向・元結果保全・表示／非保存・専用子終了と追跡の独立レビューを実施する。全体回帰・実AI・Docker・過去保持物は操作しない。

task-summary-observationのscriptと二試験をWorkbenchの同じ深さへ実体移管し、唯一の利用側verify-workspace-summaryを同Ownerへの直接importへ接続する。通常／動的／生成子コード内のExecutor ConsumerとattemptPlan参照は明示的な下位Pathへ追従する。元normalizerの引数・返却参照・例外、説明文表示条件・機密検査・非保存・restore、明示承認／対話端末Gate、子の終了と全assertは維持する。元Suite／Symbol IDとTraceを保ち、Owner／Pathと正式QA・設計を追従する。旧詳細はExecutorへ複製せずWorkbenchを正本にして案内だけを残す。これはModule計測付き合成診断であり、通常の無計測E2Eや機密不存在の証明へ拡張しない。

二試験・34 assertを維持し、移管前後のscript本文と試験本文はOwner説明・参照先・整形を除いて一致する。限定二試験と、安定Symbol／Suite IDを読むChecker一件が成功した。WB／Executorの型検査、対象三Sourceの整形・警告確認、JSON三正本の読取りと差分空白確認も成功。試験物は合成値と新品子ProcessだけでFilesystem上の保存物を作らず、各子の終了を確認した。現行Executorのscripts／試験に上位EM／Co／WBの実importは残らず、上位Moduleを拒否する反証文字列は残す。DI等の別Package群とEM公開入口統合は未完了のまま区別する。

実装後独立レビューでは、旧表示詳細のうち結果記録と試験物処置の相関を説明する一段落がExecutorに残った追従漏れを検出した。同文のままWorkbenchの新正本へ移管し、Executorには案内だけを残した。再レビューで保証の削除・重複なし、必須残指摘なしを確認した。レビュー担当は読取りのみであり、三件の限定実行は親側の結果として区別する。

### 14.42 DI技術通知とEM記録の接続試験移管

変更分類は試験Ownerと依存方向の是正。DIのisolation-lifecycleにある20試験のうちEMを利用する二試験を特定し、独立読取り確認でCoへの移管を着手可とした。各test／t.test、全assert・JSDoc・拒否／取消ケースとCompletion待機・代役復元を維持する。技術判定・保存契約・公開API・権限は変えず、技術／品質の独立レビューと追跡／文書確認を行う。準拠基準の変更や全体回帰、実AI／Docker・過去保持物の操作は対象外。

作成Receiptの検査前通知からEM Bookへの記録・回収観測を確認する試験と、両Providerの実Executorから実DIへの共通接続試験を、Coの新isolation-resource-record Suiteへ移す。DIには18試験・143 assertを残し、Coへ二試験・42 assertを移し、元の計20試験・185 assertを保存する。DI Sourceや公開型は変更せず、実DIへ接続する有限fixtureを一意に利用する。captureIsolationRequestはfixtureへ入力を結合するための限定内部参照であり、新公開APIにしない。二つの固定設定文字列は同形の合成入力で、実環境探索や共通設定機構を追加しない。

通常／型／動的参照とmock.moduleのDI参照先を新Ownerからの同じ実Moduleへ接続し、元の二試験名と全子ケースを維持する。DI SuiteからEMと不要となった入力捕捉importを撤去し、ヘッダーを技術単独の責務へ追従した。新Co Suiteと既存有限fixtureをSymbolへ登録し、台帳・正式QA・DI／Co設計を追従する。旧有限Session群のExecutor型依存や、package-boundary内の上位Source検査は別残件として残す。

限定した両Suiteで、20個の親試験と53個の子ケースの計73件が全て成功した。Co本番／試験・DIの型検査と対象Sourceの整形・警告確認も成功。有限Filesystem／CLI／Processを使い、物理保存の耐久性、実AI・Docker・実Homeを検証したとは扱わない。

Checkerの安定Symbol接続一件も成功し、限定検証は計74件。JSON三正本の読取りと差分空白確認も成功した。独立レビューは必須是正指摘なし。二試験の本文同値、親試験20→18＋2、assert185→143＋42、t.test記述8→6＋2と各ループ、同じDI実体への接続、記録・回収順序と登録／文書を読取り確認した。74件の実行は親側の結果で、レビュー担当は再実行していない。

### 14.43 旧有限Sessionの型を実装Ownerへ統合

変更分類は試験契約の宣言Owner是正。Session実装がDIの試験補助にある一方、結果・通知・回収の五型だけをExecutorの試験用scriptから逆参照していた。五宣言を実装と同じDIのsession.tsへ一意に移す方針を独立読取り確認し、着手可とした。製品Source・Root公開・実行ロジック・安全判定・保存形式は変更せず、型適合と要求・取消・回収の有限回帰、追跡／文書と独立レビューを行う。準拠基準の変更、全体回帰、実AI／Docker・過去保持物の操作は対象外。

DockerSessionCleanup、DockerExecutionCallbacks、DockerSessionFailure、DockerCommandSessionResult、DockerCommandSessionの元宣言をDI有限Sessionへ移し、元のSnapshot・観測・分類・終了値とOptional field・通知の同期／非同期条件を維持する。purposeは文字列一般へ広げず、同じ既存九要素のPURPOSES[number]へ結合する。観測・SnapshotはDIの既存正本型、回収観測は既存の局所試験型を使う。空type importを撤去し、Executor-test・DI実行補助・Session試験・公開境界試験・Executor legacy-snapshot試験を宣言元へ直接接続する。旧宣言のコピーや再export、Wrapper、新ファイル・共通Packageは追加しない。

型検査でlegacy-snapshotの旧Import一件を検出し、元の型・assertを変えず新Ownerへ追従した。整形の初回はWindowsのFile mapping競合で停止したが、利用者Processを停止せず、後の同じ対象への整形で成功した。Sessionの処理本文・試験assert・期限は変更しない。今回の切出しは五型の逆依存だけを対象とし、他のOptions／Home Lease／固定構成／Probe評価型の上位依存、package-boundary内の上位検証は後続に残す。

Co型検査でdocker-effect-runtime試験の旧Callback Importも一件検出し、宣言元へ直接接続した。全Import列の再走査で五型の旧宣言元参照が残らないことを確認した。Session有限試験のSymbolは実際のfixture Ownerへ対応付け、製品共通operationsへの検証関係は実共通Lifecycleを通るSuiteへ結合する。Co接続の検証対象にも実際の有限Sessionを追加し、fixture検証だけから製品実行成立を主張しない。

DI SessionとExecutorのlegacy-snapshot・通知・binding・controllerで23件、DI公開境界の構成・未観測契約一件、Co binder／回収結果の二件とCheckerのSymbol接続一件の計27件が成功。DI／Executor／Co本番・試験の型検査、変更七TSの整形と警告確認、JSON読取りと差分空白確認も成功。構文抽出でSessionの説明・実行・有限候補の三関数本文が元の実装と一致することを別途確認した。保存・Host実体・実Process・Dockerの操作は行っていない。

実装後独立レビューは必須是正指摘なし。五宣言のProperty・Optional・null・通知同期性と九purposeの同値、実行／取消／Cleanup本文と期限の不変更、旧宣言／再export不在、確認した全型Consumerの直接接続と登録／文書の区別を読取り確認した。27件の実行結果は親側の検証であり、レビュー担当の再実行とは扱わない。

### 14.44 有限Runtimeの設定・Home Handle・Probe評価型の局所化

変更分類は試験契約の上位型依存撤去。既存の下位設定・Lock・戻り値から表せる三型を特定し、独立読取り確認を行った。Homeの単純なPickではLock.releaseの保持引数まで開放するとの指摘を受け、生存確認だけをPickし、解放は従来の引数なし戻り型へ限定する計画へ修正した。製品Source・Root公開・値処理・安全判定・保存形式は変えず、型の境界・有限回帰・登録／文書と独立レビューで確認する。全体回帰・実AI・Docker・過去保持物は操作しない。

createDockerIsolationRuntimeの引数へ、必要なIsolationSettingsと二所在を必須・readonlyのまま直接宣言する。内部の所在型と既存の構成型負例は同FactoryのParametersへ接続し、上位Optionsのimport／再exportを撤去する。Home取得の戻り値はLockのassertLiveと引数なしreleaseだけに限定し、利用側はその取得関数のReturnTypeを使う。実Lockを取得しない型負例を既存試験へ加え、release(true)が型エラーになることを固定する。

Probe評価の上位型注釈を撤去し、既存のObject.freeze・閉じたas const状態値を返す分類実体から型推論する。非同期ProbeはそのReturnTypeを参照し、状態・理由・欠測fieldを維持する。互換型のコピー・再export・新しい型ファイルは追加しない。固定構成入力DockerIsolationCommandInputは製品側でも利用されるため、この三型と混ぜて移管せず別Owner調査に残す。EMの子読込み検証のOwner分離も別残件。

Probeの純粋分類五件・非同期搬送一件、Home排他要求一件、構成型と未観測分類一件の計八件が成功。DI／Executor／Co本番・試験の型検査、対象四TSの整形・警告確認と差分空白確認も成功した。構文抽出でFactory・Home取得・Probe分類・非同期Probeの四関数は、型を除去した実行本文が元と同一であることを確認した。実Lockや実Homeを取得せず、外部資源・保存物は作成しない。Symbolでは有限Probe・Runtimeの実体を登録し、各関連試験を実際の有限実体へ接続する。

CheckerのSymbol接続一件も成功し、限定検証は計九件。独立レビューでは設定・二所在の必須性とreadonly、Home解放の引数制限、Probeの状態値域・nullable情報、型依存撤去と値処理の不変更、登録／文書の保証範囲を読取り確認し、必須是正指摘なし。九件の実行結果は親側の検証であり、レビュー担当は再実行していない。

### 14.45 固定構成OracleのOwnerと依存閉包の是正

固定構成入力は製品Executorが構築し、DI製品は旧形式を使用しない。Git履歴2cbbfd271／197af14b6と現行有限検証を確認し、旧argv Oracleと有限Runtimeの入力OwnerをExecutorへ揃える計画を独立読取り確認した。構成型のコピーでDIの逆依存を隠さず、実装・利用側・試験Ownerを同じ閉包で移す。製品Source・公開API・安全判定・期限・保存契約は不変更。型・有限の失敗／取消／回収・Source同値、登録／文書と独立レビューを実施する。全体回帰・実AI・Docker・過去保持物は操作しない。

execution-plan／executionの実体をExecutorのtests/support/isolation-plan／isolation-executionへ移し、全通常・型・動的・Source読取りとCo Consumerの参照を追従する。Sessionの九purpose＋readonly argv型はDI Sessionの実装Ownerへ一意に移し、各型Consumerを直接接続する。旧Rootや型の再export、互換Wrapper、新しい共通Packageは追加しない。DIの固定構成型への四参照はなくなり、InputはExecutorの構成と有限Oracleの間で完結する。

plan13試験・Effect cleanup15試験をExecutorへ全体移管し、元Suite／Trace IDを維持する。Runtime混在17試験はDI二試験＋Executor16試験へ分ける。実物Resolverの全11条件とDirectory実体検証はDIへ残し、旧argvへSeccomp所在を渡す二assertをExecutorの独立試験へ移す。実物の所在・bytes・hashの読取りは各caseの入力であり、検査規則を複製しない。残る15試験と専用runtimeFixtureはExecutorへ移管する。旧Factory・型・未観測分類一試験はExecutorの既存public-boundaryへ移す。対象は元46親試験から責務分割後47親試験となり、計331 assertを維持する。

両manifestと台帳は全体移動のOwner／Pathと分割Suiteを追従し、安定IDは改名しない。旧有限Oracleの正本案内はExecutorへ移し、DIには技術境界と比較履歴の所在を残す。DIのEM子読込み検証はこの固定構成閉包とは分け、次単位で扱う。

限定回帰はExecutorの移管三Suiteと既存公開境界で48件、DI実Resolver一件・有限Session十件、Co binder／回収結果二件、Checker一件の計62件が成功した。DIのDirectory実体試験は本文を維持したまま未実行とし、Junctionを追加作成していない。実行済み有限試験の自己生成Rootは既存の終了Oracleで回収され、過去保持物は操作しない。DI／Executor／Co本番・試験の型検査と、変更先・利用側の対象TSの整形・警告確認を実施した。移管に伴うImport順の整形後に再確認し、Sourceの安全判定を変更して通していない。

Executor既存plan／binding四件も成功し、限定検証は計66件。独立レビューでDI設計の旧「型の所有」一段落が現Ownerと矛盾する残存を検出した。固定構成と有限Runtime、DI Session、共通Lockの引数なし投影、Probe推論、製品認証を分けて是正し、試験型のRoot非公開条件は維持した。Source・試験本文の同値と全数対応は読取り確認で必須指摘なし。66件の実行は親側の結果であり、レビュー担当は再実行していない。

是正後の独立再確認で、型Ownerの区別と試験型非公開を確認し、必須残指摘なしとなった。

### 14.46 各Rootの独立ロードを各Ownerへ戻す

DIのpackage-boundaryがDIとEMを起動する二枝を持っていたため、EM枝を既存EMのpackage-boundary ITへ移す。独立読取り確認で着手可とした。各枝の子error／signal／exit／marker四assertを維持し、元の二子の検証を親一件から二件へ分ける。DI専用の保存API／業務Parser非公開確認はDIへ残す。元JSDocにあった回復ID解析は実際には行われていないため、Moduleロードだけの説明へ合わせる。製品Source・API・保存は変更しない。

DIの拒否対象は既存上位モデル・Coに加えExecutor／Workbench／MCPを明示し、Own Rootだけを起動する。実Sourceで参照がないProviderAdvicePlan型を特別に許可する試験Helper分岐も撤去し、元の同じ文字列を拒否負例へ変える。型・再export・動的importの禁止例にもExecutorを加え、検査を弱めない。製品の入力制約や新しい実行時検査を追加した処置ではない。

既存EM SuiteへERB-IT-014とQA-000006、DI Suiteにも元Traceを登録し、台帳終了条件・正式QA・両Owner設計を追従した。新Suite・Wrapper・許可例外・共通Packageは追加しない。DI／EMの限定二Suite八件とChecker一件が成功し、両型検査・対象Sourceの整形と警告確認・差分空白確認も成功。新品Nodeの終了を確認し、試験保存物やDocker／AI Processは作成しない。全体回帰・実AI・Docker・過去保持物は操作していない。

独立レビューは必須是正指摘なし。二枝・各四assert、DI専用の非公開確認、EM側のDI拒否と処理非追加、未使用許可例外の拒否化、登録／文書と保証範囲を読取り確認した。試験実行は親側の結果であり、レビュー担当は再実行していない。14.45と14.46の限定確認は重複するChecker一件を除いて計74件。DIの現在のコード・起動設定に残る上位Path文字列は拒否用の負例であり、上位Rootを起動するConsumerではない。全PackageのOwner移管とEM公開統合は引き続き未完了として追跡する。

### 14.47 公開MCP検証Toolと専用試験のOwner移管

変更分類は検証Tool・試験の依存方向是正。公開MCP入口を起動しMCP結果Parserを使う二scriptと専用Node fixture・47試験を、CoordinatorからMCPへ一括移管する。着手前の独立読取り確認で、この閉じた利用集合の移管を妥当とした。製品Source・Root公開・保存形式・Timeout・報告契約IDと改訂13・固定marker所在・回復順序は変更しない。技術／品質の独立レビュー、登録と文書の伝播確認を行い、準拠基準の監査・全体回帰・実AI／Docker・過去保持物の操作は対象外とする。

相対参照は元と同じModule／Sourceへ結合し、旧Pathの転送やParserの複製は置かない。既存の安定Suite／Symbol IDとQA項目を維持してOwner・Path・verifiesを実接続へ合わせる。Coのstrict対象から旧CLIを除き、MCP型検査は二scriptだけを明示追加する。VC／EMの現在Consumer一覧、設計・Workflow・正式QAとTrace台帳も新所在へ追従する。

最初の限定実行は47件中41成功・6失敗だった。旧HEADにもあるSource契約不整合を切り分けた。現Producerと試験値はv3だがReportはv2だけを受理していたため、Tool側を現v3のみへ追従する。旧v2と未知Scopeを拒否する負例を維持／追加する。また、既に一引数となったReaderを試験代役だけが旧64KiB引数必須としていたため、現行の引数数とexact引数列を検査する。製品判定や容量条件を緩める変更ではない。修正方針も独立読取り確認を経た。

再実行は47件すべて成功、MCP本体・起動入口とCo本番／試験の型検査、対象Sourceの整形・警告確認とCheckerの安定Symbol接続一件も成功。全47試験・289 assertを維持し、旧v2拒否ケースを追加した。固定Node子の終了・取消・遅延通知を確認し、実Provider CLIは起動しない。実AI・Docker・耐久保存や全Package完成の証拠にはしない。Coの他の上位Consumer試験とEM公開統合は別の残件として追跡する。

完成後の独立レビューは、人間向け現行設計対応表の旧所在三箇所を検出した。機械可読Trace台帳と同じMCP所在へPathだけを追従し、分類・状態・保証は変更しない。是正後の読取り再レビューで指摘解消と必須残指摘なしを確認した。限定48件の実行結果は親側のEvidenceで、レビュー担当は再実行していない。

### 14.48 利用側Source接続の確認を各Ownerへ分離

変更分類は既存試験のOwner是正。着手前の独立読取り確認で、Coのpublic-owner-boundaryに混在する上位二Sourceの確認を、既存WBのai-shared-task ITとMCPのruntime-activity-adapter ITへ分ける案を妥当とした。Coの旧参照拒否・自己迂回拒否・変異拒否の三assertは同じSuiteへ残し、利用側各一assertをそのまま移す。計五assertを保持し、対象Sourceと正規表現を変えない。新Suite・Facade・Wrapper・製品Source／公開API変更はない。

既存のPRL-IT-012／QA-000003を移管先へ関連付け、Symbolのverifiesと台帳の終了条件、各Suiteの責務・scope、三Owner設計と正式QAを追従する。整形・import順序だけの既存不整合は対象三Sourceで是正した。Source配線の確認であり、認可・Reader終了・HTTP／MCP疎通の実成立へ拡張しない。新しい正式検証項目は作らない。

限定した三試験すべて成功。Co本番／試験・WB・MCPの型検査とCheckerの安定Symbol接続も成功した。Source読取りとメモリだけの確認で試験保存物・AI／Docker Processは作成しない。全体回帰・実AI・Docker・過去保持物は操作していない。独立レビューは五assert・元の変異負例・各Ownerの登録／文書を確認し、必須残指摘なしだった。Coの実Workspace結果→MCP投影と回復→WB検証HTTPの結合試験は、引き続き別の移管残件である。

周辺のMCP Reader完了／取消二試験も成功。一方、既存Co公開集合試験で、be14e5babで導入済みのinspectCoordinatorDecisionResultが期待一覧から一件欠測していた。現行Root・実装・採用計画を照合し、独立読取り確認を経てexpectedへ一要素だけ追加した。exact集合比較・非公開確認・製品APIは変更しない。是正後のCo公開集合・自己迂回二試験は成功、独立再確認でも指摘なし。重複を除いたこの区切りの限定七試験が成功し、初回の失敗を履歴として保持する。

### 14.49 実ObjectiveのMCP結果投影を利用側へ移管

変更分類は結合試験のOwner是正。Coのworkspace-lifecycle末尾の一試験は、実Objective受付・保存・Workspace観測から本物のMCP結果Parserまでの利用側接続であるため、既存MCP runtime-activity-adapter ITへ全文を移す。着手前の独立読取り確認で妥当とした。実Git／保存を使う共有準備・観測三関数は既存Co workspace-surface fixtureへ一意に移し、両Suiteが利用する。新File・共通Package・Wrapper・製品Source／API・保存／Timeout変更はない。

全assert・有限Provider・開始通知の待機・二Taskの観測、HEAD不変・Queue状態とexact Root清掃／不存在の確認を維持する。元のprepareWorkspaceSurfaceは変更しない。両所在が同階層のため、試験Rootは元と同じRepository-local .crdd/testsである。元ヘッダーのNative排他という古い説明だけを既存共通排他へ合わせる。CoのMCP importを撤去し、試験のために下位Rootを拡張しない。

Symbol・verifies・台帳・scope・両Owner設計・正式QAを追従した。§14.48前の基準は対象三Source計19試験・277assert、§14.48のMCP Source一試験・一assertを含む現候補は計20試験・278assertであり、この移管では増減がない。MCP本体・Co試験の型検査と対象Source整形／警告確認が成功。移管した実Objective一試験と同じfixtureを使うCo Direct搬送一試験は約61秒で双方成功し、各終了hookで今回のRoot回収・不存在を確認した。実AI・Docker・全体回帰・過去保持物は操作していない。Checkerの登録接続確認も成功。独立レビューは移管本文と三helper・既存prepareWorkspaceSurfaceの同値、Root・通知・清掃条件と登録の保持を確認した。記録の親試験数に正規表現の.test呼出しを誤算入した一件を訂正し、試験の増減ではないことを明記した。是正後の読取り再確認で記録の一致と指摘解消を確認し、必須残指摘なし。Co回復→WB検証HTTP結合とEM公開統合は残件として追跡する。

### 14.50 AMのモデル型結合と二つの実接続試験

変更分類は型Ownerと試験Ownerの是正。独立読取り棚卸し・着手前確認を経て、AMのRepositoryContentAccessを既存repository/types.tsに置き、EM ExecutionModelAccessのimportを撤去した。七操作・Target二項目・readonly・Repository型と五許可／二拒否の本体は維持する。Root公開は増やさず、返却値のコピー・認可Wrapperは追加しない。

AMに混在した実EM Writer一試験と実DM本文／Portfolio一試験を、既存Workbench runtime-definition／management ITへ全文移管する。元のAM fixtureを一意に再利用し、全assertと真正Writer／Reader・清掃を保持する。同じ実accessの双方向代入と参照同一性の一assertを追加し、モデルがAM型を知る逆依存を作らない。既存RFD-IT-013／019・QA-000007・Symbol／台帳と両Owner設計を追従する。

AMのDM Parser／Filesystem ObserverとCM Manifestは、登録時のPROJECT_CONTEXT・Manifest三Identity照合と現在の内容認可で必要な実依存である。今回のEM型結合とは区別して維持し、登録保証を失わせる機械的な撤去はしない。変更には登録責務の別設計が必要となるため、これらを未処置のEM逆依存とは扱わない。

移管二試験とAMの現在版／失効／Manifest差／取消／解放不明の三親・11子、計16項目が成功。AM／Workbench型検査と対象Sourceの整形・警告確認も成功。初回の整形書込みはHostのFile mapping制約で一部不能だったが、再確認で対象四Sourceの整形が完了した。製品の認可・公開API・保存形式は不変。全体回帰・実AI・Docker・過去保持物は操作せず、今回のfixture Rootは既存終了hookで回収した。独立レビューと是正後再確認に必須残指摘なし。

### 14.51 VCのConsumer集合をRepository横断回帰Ownerへ分離

独立棚卸しと着手前確認を経て、VC consumer-closureの13親・61assertを、純VC五親とChecker回帰九親へ分ける。旧一試験のVC内部Candidate分類拒否と横断Owner検査を分割するため親数だけ一増となり、assertは61のまま。型契約・公開投影・自己Architecture一致・Git配置／ignoreはVCに残す。import解析・全Package Consumer集合・単一Owner・Checker接続は上位のRepository横断回帰が所有する。Checker製品機能へ移植せず、新公開API・Facadeはない。

publicExportNamesは実際にはVC単独だけが必要だったため、共有fixtureを増やす案を縮小し同Suite内に残した。Checkerには必要な既存二Helperだけを一意に移し、参照なしimportを除いた。移管前と同じRepository Root・Sourceと固定集合を照合する。Symbol／台帳・Checkerの明示型検査対象・各Owner設計と正式QAを追従する。

初回14親中11成功・三失敗を切り分け、VC側に必要なgetRepository importの接続漏れ、先行MCP移管で旧位置のままとなった期待配列の順序、既存のRepository型Consumer二所在の追従漏れを是正した。exact集合検査は維持し、実SourceのReader／型利用を根拠にCo state/typesを追加・EM history/typesを除いた。後者は製品Source変更ではない。再実行は14件すべて成功、VC／Checker型検査・対象整形／警告確認も成功。Source読取りのみで試験物を作らず、実AI・Docker・全体回帰・過去保持物は操作しない。独立レビューと是正後再確認に必須残指摘なし。


### 14.52 回復OwnerとWorkbench HTTPの境界を分離

Coの正常Owner四形のうちWorkbench HTTPを伴う三回形を、Workbenchの専用Host Suiteへ移管した。共通の実Owner検証本文は既存Co fixtureへ一意に置き、Coは一回・保持一回・二回を維持する。HTTPの固定RouteとClient・TimingはWorkbenchが所有し、Co fixtureは試験用の要求関数だけを受ける。全assert・保存通知順・十五秒期限・子close・Server close・復元を維持し、今回Rootの不存在assertを追加した。新製品API・Wrapperはない。

着手前の独立確認で、通常Workbench回帰はHost名を除外し専用Host入口で同じ試験を実行する方針を妥当とした。制限下の子HTTPはEACCESとなり、既存の同じHTTP単独試験でも再現した。許可された同じ局所試験では既存HTTPと移管Host三回形が成功した。製品期限・保護Policyは変更しない。EM統合後の再確認と完成後レビューは以下の現候補結果へ接続する。

### 14.53 EMの九入口統合と利用側追従

独立した着手前確認を経て、Rootを109項目から100項目（65値・35型）へ整理する。二Readerは既存readStateへ、三Stage保存はsaveRecoveryCheckpointへ、用途固定の完了・履歴二Wrapperは明示kindへ統合した。未利用の資源専用Readerを撤去し、Book遷移検査はbefore付きの既存受付へ閉じた。内部Readerの一意な実装をstate/crudへ移し、保存形式・Owner・Lock／CAS・一回認証終了・通知順は維持する。

本番・試験のimportに加え、生成子SourceとModule代役も共通入口へ接続する。Coの物理OwnerをEMへ結合する既存persistence関数は存続するが、EMの旧Root名を再公開する互換Facadeは置かない。実装APIの数だけでなく既存Writer・Readerの順序とEffect前拒否を検証する。

初回限定試験ではscopeだけの入力を厳密捕捉が拒否する不整合と、有限回収fixtureの未要求／未発行投影漏れを検出した。前者は許可された二つのProperty集合を明示し、後者は既知fixtureの終端条件を既存モデル契約へ追従した。未知scope・余剰field・Getterの拒否試験も追加し、安全判定を緩めない。現候補の限定回帰と是正後独立レビューを完了し、今回範囲の必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作しない。


限定回帰の修復結果六親は、最初の実行では全件不合格となった。原因は利用側の有限Reader代役が旧request.kindを解釈し、現在のscope／input.kindをcurrentへ誤配送していたためである。同型の五代役・引数期待にも追従し、EMの私有Writer試験は撤去済みWrapper抽出を止め、実state/crudの本体と内部Readerへ直接接続した。Task／Repairの完了・履歴代役は第4引数の用途をassertし、誤配送を定数補完で隠さない。元の故障枝・assertは維持し、製品判定は変更しない。関連した短い九試験と独立読取り再確認は成功・必須残指摘なし。六親の再実行は全件成功した。正常／保持／取消の一親は約213秒、故障系五親の内部49ケースは約3,181秒（53分）で終了した。五親の時間は順に約526・126・345・1,169・1,014秒であり、単一保存がこの時間を要したという意味ではない。各自己生成Rootの終了hookに失敗はなく、exact Root回収・不存在確認を通過した。

試験粒度の改善候補も区別して記録する。五親の内部には49故障ケースがあり、各ケースで新品Git Repositoryと実Lock・State／History保存を繰り返す。これは49件の独立した終了結果を表示する構造ではなく、今回の限定選択として重すぎた。故障分岐の全組合せと代表的な実保存境界を分ける改善をCoordinator試験Ownerの候補とする。assertの削除・本番判定の緩和は対策にしない。現在Repositoryでの読取り専用観測ではRoot確認約7ms、Revision取得約14msだったが、試験fixtureと同じ条件の保存・Lock別計測ではないため、遅延の主因をGit又は耐久化へ確定しない。試験時間の詳細計測と粒度見直しは次の回帰計画時に再評価し、現在実行中の試験へ変更を混ぜない。

人間との確認により、次の試験整理は「不変のベース準備を一回行い、その後は確認観点の差分を適用する」を方針とする。可変State・Lock・Owner・未完了処理はケース間で共有せず独立させる。実保存の必要な代表例は結合試験として維持し、各故障ケースは個別名で単独実行・時間計測できる形へ整理する。新しいFixture Managerや汎用復元機構は追加せず、進行中の実行へ変更を混ぜない。


最終の限定結果は、EM公開／Book／履歴／遷移の選択34項目、Reader・Host準備・認証終了・全履歴の18項目、再起動私有Reader、実終端Writer、Co現在保存・pending再入場、生成子の通常／認証再入場、Workbench三回OwnerとHTTP、VC／Checker14項目、台帳接続一項目、および追加是正の局所試験が成功した。重複する再確認を全体件数へ合算しない。HTTPは約8.6秒で既存十五秒内、実Host三回は約76秒で終了し、子close・Server close・代役復元・Root不存在を確認した。AMの二移管試験と現在認可の選択集合は§14.50の16項目の成功を維持する。実AI・Docker・全体回帰・過去保持物の操作はない。

変更TS／JSONの対象分割での整形・警告確認、関係Package型検査、Coの実行／Task追跡検査と差分空白確認も成功した。独立レビューはEM技術保証とOwner／登録／文書の二担当で実施し、Host要求の混合field拒否と新API説明・現況数値を是正後に再確認した。試験代役六系統の追加是正も独立確認済み・必須残指摘なし。試験実行の結果と読取りレビューの判断を区別する。この区切りの四項目は限定範囲で完了とし、試験粒度の改善、全体回帰、過去保持物の扱いを別件として残す。Commit／Pushはこの区切りで実行していない。

### 14.54 修復49ケースの不変準備とケース独立の整理

基準30f607171。変更分類はCoordinator試験の実装再編で、製品Source・API・保存Schema・Lock／CAS・期限は変更しない。基準で成功した五親49ケースの全故障組合せ・assertと実EM Reader／Writerを維持する。新品Git Repository・真正Root／Revision／保存Identity・本番Sourceと未束縛VM factoryは一回準備し、49個別ケースを直列実行する。State・履歴・Owner・Abort・故障注入・カウンタ・VM依存は各ケースで新規にする。既存fixture・台帳・QA・設計の追従と技術／品質の独立レビューを行う。工程契約／準拠基準を変えないため全体の準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物操作は対象外。

着手前の二担当確認で、一base方式と親ごと五base方式を比較した。合意した不変準備一回へ合わせ一baseを採用し、前caseの終了・清掃完了前の再利用拒否を持つ。実Lockと出版markerのstate.lockは区別し、清掃で故障結果を成功へ読み替えない。技術観測代役は真正観測した同capability参照だけへ限定し、未知Rootと明示Revision指定は実処理へ委譲する。別GitRoot・HEAD変更の検出は既存VC／Owner試験に残し、49ケースでの検証範囲に含めない。

不変準備にはgetRepositoryとgetRepositoryFromWorkingDirectoryの既知exact Path要求も含め、初回の真正結果を再利用する。明示Revisionと未知要求は実delegateする。初回のhook登録位置誤りはfile読込み時登録へ是正し、その試行だけが作った新品RootをCommit Identity・本文・空の保存区画・非使用から特定して回収／不存在確認した。過去保持物には触れていない。

追加診断では正常一case約47秒、lstat214,144回／約14.6秒、open22,397回／約11.3秒、fsync114回／約0.86秒を観測した。この計測は一時的なオンメモリ観測だけで、製品や試験Sourceへ永続Profilerを置かない。直前Snapshotからの再入場へ切り替える案も比較したが、初回故障の保証を変えるため独立確認に従い不採用とした。基準caseの初回入口とassertは変更しない。既存93静的assert式は構文木で系列ごと36／25／9／16／7の一致を確認した。


49組合せの対応は次のとおりで、元の初回入口・故障注入位置とassert式を維持する。

| 系列 | 個別ケース数 | 基準の静的assert式数 | 現在の入口 |
|---|---:|---:|---|
| 失敗・取消の履歴確定と故障再入場 | 15 | 36 | 初回から実行し、元の箇所だけ再入場 |
| 終了保存・開始前取消・保持 | 3 | 25 | 元の初回と取消／保持 |
| 終了Writer不明 | 5 | 9 | 初回の終端Writer故障 |
| 終了Reader／出版marker不明 | 14 | 16 | 初回の終了前後／marker故障 |
| 履歴各段のfresh確認不明 | 12 | 7 | 初回の履歴段階故障 |
| 合計 | 49 | 93 | 初回を再入場へ置き換えない |

個別名の選択だけで実際に一件が実行されることを確認した。親t.test方式では親が非一致だと子も実行されなかったため、49個別のトップレベル登録へ変更した。共有baseの直列guardにより、前caseの清掃が不明な場合は次caseへ進めない。

最終候補は49ケースとfactoryのA／B変異・通常Source三子（親を含む計53項目）が全成功し、89,680ms（約90秒）で終了した。先行の再編候補49件は100,021msで成功した。旧構成五親49ケースの3,180,562ms（約53分）と区別し、この環境の試験時間の比較だけとする。製品の処理速度改善やRoot変更耐性の同等証明へ拡張しない。全caseのOwner失効・有限Session未joinなし・実Lock／pending不存在、専用保存Directory／最終Rootの回収・不存在確認は成功した。

正常factoryと変異factoryの構築をcompileRepair一実装へ集約した。追加三子が直接反証するのは、変異Sourceが通常cacheへ漏れないこと。新しいcase依存閉包の構築はSource読取りと元49ケースの独立した期待結果でも確認する。既存の実Root・本番Source変異二条件は一意化前候補で118,989ms成功し、従来fixture経路の非固定Root観測を維持したことを確認した。一意化後はfactory三子と49ケースを同じ実行で再確認し、先行結果を未変更範囲と区別する。

対象二Sourceの整形／警告確認、Co本番・試験型検査、台帳／Symbol／正式QAの接続一件、基準assert式の構文木照合と差分空白確認が成功した。技術とOwner／QAの二担当による独立レビュー・局所是正後再確認は必須残指摘なし。試験実行は親、独立担当は読取り確認である。全体回帰・実AI・Docker・過去保持物は操作していない。30f607171は作業前に既存FeatureへPush済み。本試験再編はbfd01b54aとしてCommit／Push済み。

### 14.55 資源の純粋な値操作と保存依存の分離

基準bfd01b54a。追加提案の第一段階として、Logical Block・公開100項目・保存Schema・単一Writer／CAS・Lock・判定条件を変更せず、値検査から保存モジュールへ戻る依存を撤去する。実装詳細の責務是正であり、技術と品質／Ownerの二担当による着手前確認・完成後独立レビュー、限定回帰、文書・登録の伝播確認を行う。工程契約・決定権限・準拠基準を変えないため全体の準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物は対象外。現在、人間による追加判断は必要ない。

| 編集の識別子 | 対応する問題と適用先 | 保持する条件と確認 |
|---|---|---|
| E1 | `attempt/crud.ts`の資源イベント・清掃更新2関数と`attempt/validation.ts`のBook／遷移検査2関数を`attempt/operations.ts`へ実体移管 | Intent・Receipt・元実ID・正式未発行・不存在証拠の同じ規則を保持。旧所在地の再exportなし |
| E2 | `state/validation.ts`の6値処理を`state/value.ts`へ実体移管し全参照元を直接接続 | encoder、完全key検査、SHA-256文法、plain記録取得・descriptor検査の本文を変更しない。保存・全体候補への逆参照なし |
| E3 | `createLocalPrincipalId`を`state/crud.ts`から同じ主体検査Ownerの`state/validation.ts`へ実体移管 | prefix・メール検査・Root公開名・結果を保持し、validation→crudを撤去 |
| E4 | Root・内部試験・Source抽出・Symbol・Architectureの所在と依存契約を追従 | 公開集合、保存本文／Hash、資源Bookの正負例、新品Processでの独立ロードを確認 |

E1／E2／E3の宣言元移管後にE4の全参照を追従する。新しい汎用Package・Facade・互換Wrapperは作らない。Book検査を旧validationへ残す小さい案はState候補へ依存が戻るため不採用。二担当の着手前確認で、6値処理の依存がNode.js組込みと相互参照だけで閉じること、4資源処理が同じ遷移規則を一意に維持できることを確認した。

初回Intent、既知Receipt、正式未発行、不存在観測、ID差替え拒否と入力不正を対応付け、値処理の拒否・例外・符号化順・凍結を変更しない。これは実資源の存在／不存在を観測する変更ではない。残る純粋Validation間の循環、Historyの意味処理・完成操作、State Snapshot型の明示化は後続段階であり、本段階だけを全循環解消又は添付案全体の完了とは表示しない。

移管した11関数は基準の本文と空白以外の一致を確認した。新Ownerのimportへ通常参照・Source注入fixture・Symbolを追従し、旧所在地の再exportはない。公開集合・資源Book・codec・Lease・再起動・履歴候補の限定54項目が同じ最終Sourceで成功した。新品Nodeで保存／候補Moduleを拒否した資源更新も含む。実保存の不存在／同版／破損、作成失敗／置換／解放不明、重複資源の拒否は別の代表3項目、State相関の一項目と台帳／Symbol／QA接続の一項目も成功した。EMとCo本番／試験の型検査、対象整形・警告確認、差分空白検査は成功。

初回の追加集合では終了要約試験一件が旧v2本文・consumer別のfieldを期待して失敗した。基準も現候補も要約生成本文は同じv5であり、旧期待値を現行の共通Schema・回復相関IDへ追従した。全文・Hash・一次失敗・不明状態・誤相関拒否のassertを維持し、consumerを要約へ再導入しない。追従後に54項目を一括で再確認し、初回失敗を成功件数へ合算しない。製品判定の緩和、実AI・Docker・全体回帰・過去保持物の操作はない。独立レビューへ渡す候補をここで固定する。

固定候補の技術／品質・Owner二担当による独立レビューは必須残指摘なしで完了した。技術担当は資源操作の実行時依存閉包、VM注入、基準のv5要約と旧試験期待の不整合を確認し、品質担当はSymbol・台帳・QA・設計と未完了範囲の表示を確認した。両担当とも読取りレビューで、試験の実行根拠は親担当の記録である。第一段階は限定範囲で完了し、添付案全体の完了や全体回帰成功ではない。本EM差分は未Commit／未Pushであり、直前の試験再編bfd01b54aのPushとは区別する。

### 14.56 Historyの値生成・保持・出版条件とState整合の分離

§14.55の未Commit差分を保持した上で、Historyの意味規則を集約する。分類は公開契約・保存形式・判定・単一CASを変えない内部責務是正。変更可能範囲はEMのHistory／State／Attempt／Storage接続、内部試験と注入fixture、設計・QA・登録・現在投影。Repository内の新品試験物だけを使用する。全体回帰・実AI・Docker・過去保持物操作、Root公開追加、互換再export、汎用Frameworkは行わない。二担当の着手前整合確認で下表の責務を確認し、限定回帰と固定候補の技術／品質独立レビューを行う。工程契約・準拠基準を変えないため全体準拠監査は追加しない。追加の人間判断は不要。

| 編集の識別子 | 適用する責務 | 保持条件・反証 |
|---|---|---|
| H1 | State・Attempt・Storageの六つの要約／行符号化を`history/operations.ts`へ実体移管 | Schema・field・LF・Hash対象・例外を保持し、旧再exportを作らない |
| H2 | `prepareHistoryRetention`はStateの全体復号・現在参照投影としてStateへ移管。選別本体はHistoryの`retainHistoryRows`へ | 現在Operationの必須行・行Hash・要約Hashを選別前に全件照合。confirmedによらず欠測拒否。判断・未搬送・未解決参照、reviewAfter前、期間境界を保持 |
| H3 | 二出版候補の履歴部分をHistoryの`prepareHistoryPublication`へ集約し、Stateは同版のSnapshot候補と結合 | 同ID同本文の再追記なし、異本文／重複／部分行／pending全文差の拒否。State候補失敗時に履歴だけ成功返却しない |
| H4 | 既存intrinsic Buffer捕捉を`copyHistoryBytes`へ実体移管しTask側の同一重複を撤去 | Proxy・own equals／getterを信用せず独立コピー。TaskのcatchとRepairのnull拒否境界を維持 |
| H5 | 全Consumer・Source抽出／注入・Symbol・台帳・QA・設計の追従 | History operationsはNode・state/value・typeだけに依存。新品Nodeの独立ロード、公開100項目、実保存・再入場の代表で確認 |

H1の実体移管、H2の型と純粋選別、H3／H4の同版結合、H5の全参照追従の順に適用する。Historyへ全体復号ごと移す案はStateへの依存が戻るため不採用。Stateは単なる転送ではなく全体復号・参照導出・改訂とprevious生成・統合遷移検査を維持する。保存資格、Reader／Writer回数、Lock保持、pending作成・確定・読戻し順序は変更しない。履歴確定前の記録退役は引き続き拒否する。

六つの符号化とBuffer捕捉は、宣言の公開修飾・名前・空白以外の関数本体が移管前と一致した。History operationsの実行時依存はNode組込みとstate/valueだけで、全体Codec／CRUD／Storage／履歴Decoderに戻らない。内部の行と保持参照型はHistory側に置くがRootへ追加しない。全体CodecはState、新規固定一行とcanonical全行のDecoderはHistory validationに維持し、検査済み行だけを純粋出版へ渡す。append時の対象必須行を欠測へ誤分類しない。

新しいHST-UT-001の5反証と新品NodeのHistory独立ロードを追加し、既存の公開／資源／codec／Lease／再起動／修復／履歴候補と合計80項目が同じ最終Sourceで成功した。State相関の既存一項目も成功。実保存は通常終端一項目、判断保存一項目、pending一致再入場／不整合保全の二項目で確認した。修復履歴の保存代表は初回28子成功後、末尾の変異試験が基準にも存在しない旧fallback条件を探して停止した。製品の迂回は復活させず、不正なTask再読を注入する変異へ追従して、通常Lock取得一回・変異二回とWriter発行なしを維持し、29項目が成功した。最終整形候補の同代表も29項目すべてが成功し、69,763msで終了した。初回失敗・先行成功と最終再確認は別の記録とし、件数を重複合算しない。

正式局所項目・Symbol・台帳接続は、新規QA行の機械読取り形式を是正後に成功した。EM・Co本番／試験型検査、対象整形・警告・差分空白確認も成功。これらの局所結果を全体回帰へ合算せず、実AI・Docker・過去保持物は操作していない。固定候補の独立レビューへ進み、実保存の再確認結果と全担当の結果を統合してから完了を判断する。


固定候補の技術とOwner／品質の独立レビューは、両担当とも必須残指摘なしで完了した。必須行／両Hashの選別前全件照合、confirmed非依存、正規UTF-8・exact本文・重複拒否、intrinsic独立コピー、例外境界、物理Writerがimport追従だけであることを確認した。Source抽出の旧fallback変異は、現行Sourceへ誤ったTask再読を導入して検出する反証として妥当と確認した。独立担当は読取り確認、試験は親の実行記録である。新品実保存試験物は既存のexact cleanup hookが回収して終了した。全体回帰・実AI・Docker・過去保持物は操作していない。

Historyの生成・保持・出版条件の本段階は限定範囲で完了する。残るState完成操作の意味Owner配置、Snapshot型の明示化と純粋検査間の他の循環は未完了として維持する。第一段階と本段階のEM差分は未Commit／未Pushである。

### 14.57 Checkpointの意味OwnerとSnapshotの保存正本

§14.55–14.56の未Commit差分を保持して続行する。分類は公開契約・保存形式・保存資格を変更しない内部責務是正。Owner正本はEM設計、利用側はRoot公開と内部候補・保存試験。着手前に二担当でMapの更新点と型の展開結果を照合した。限定回帰・技術／品質の独立レビューと文書／登録追従を行う。工程契約・準拠基準を変更しないため全体準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物操作は行わず、書込みはRepository内の対象Source・文書と新品試験物に限定する。追加の人間判断は不要。

| 編集の識別子 | 適用先と対応する問題 | 保持条件・確認 |
|---|---|---|
| S1 | `saveOperationCheckpoint`をStateからAttemptのCRUDへ実体移管 | Map非依存で既存Reader・候補生成・Owned Writerを再利用。本文・公開名・六種の受付・保存順と不明保持を維持。旧再export／転送Wrapperなし |
| S2 | 公開済み`ExecutionStateSnapshot`を19field明示の唯一の保存正本にする | `UnifiedSnapshot`と`DecodedStateSnapshot`は同一aliasなので撤去し全内部参照を更新。Schema・nullable・readonly・optionalを維持 |
| S3 | `ExecutionOverview`と`Snapshot`を保存正本からの投影として定義 | 前者は6共通field、後者は9共通field＋投影固有7field。正本のProjectDefinitionと投影のProjectExecutionState、nullableと非nullを混同しない |
| S4 | Source抽出／注入・公開境界・型適合・台帳・QA・設計の追従 | 旧展開形との双方向代入、readonly／nullable／optional負例、正規codecと六種Checkpointの正常／拒否を限定確認 |

S1の実体移管とS2／S3の型定義後にS4の全参照を追従する。単一CAS・物理Writerは分割しない。旧Snapshot投影のSchemaは保存互換Readerではなく、同じ現在Stateからのメモリ投影である。

#### 三Mapと四つの保存調停操作を一体で残す根拠

| Stateに残すもの | Writer自身が更新する事実 | 単純に移した場合の問題 |
|---|---|---|
| `settlements` | 四種の短命証拠を元版・用途へ結合し、`commitStateSnapshotOwned`冒頭で一回消費 | 読取りだけでは一回性を再現できず、可変recordや汎用get/setを公開すると資格境界が弱まる |
| `initializations` | 領域準備後登録、初版rename直前の発行記録、成功／解放不明時の失効 | 物理出版と寿命が一体で、用途側へ移すとState Writerから逆参照が必要 |
| `historyAttempts` | 保存確認かつLock解放後だけ初回登録し、pending／発行済みを更新 | History行ではなく物理試行証拠であり、履歴という名前だけで移すのは不適切 |

`completeRecovery`、`saveRepairState`、`resumeRepairPublication`、`advanceOwnedRecoveryHistory`はこれらの証拠の生成・消費・失効と結合している。現位置から移すためだけのFacade、証拠Registry、用途CRUDからWriterへ戻る実行時循環は作らない。本段階ではStateの全体整合・物理保存調停として一体で維持する。将来全面移管する場合は、既存Storageへ単一Writerと私有出版証拠を一体移管する設計、初版・pending・Owner喪失・解放不明・一回消費の実保存根拠を先に閉じる必要がある。未実施の全面移管を完成とは表示しない。

Checkpointの関数本体は移管前と空白以外の一致を確認した。公開100項目（65値・35型）は同じ集合で、Source抽出／注入fixtureは新Ownerの実体を使用する。Snapshotの五名称は保存正本・二投影の三型に整理し、旧二aliasのSource／試験参照は0。独立した基準展開形との六方向代入と三key集合一致、readonly／nullable／Schema／Project形の期待型エラー、省略可能なLease実体とnullを確認した。型負例の関数は実行しない。

整形・警告確認、EMとCo本番／試験の型検査後、公開／資源／codec／Lease／履歴／修復と追加4項目を合わせた限定84項目が成功した。State資源・Host相関の代表一項目、実保存Readerの不存在／同版／破損と作成失敗／置換／解放不明の代表二項目、台帳／Symbol／正式QA接続一項目も成功した。Checkpointの候補・Writer代役は実CAS成功の証明ではなく、保存意味不変は本文一致・既存の候補／物理Reader試験と区別して確認する。関係ない全体試験を追加せず、実AI・Docker・過去保持物は操作していない。固定候補を独立レビューへ渡す。

技術とOwner／品質の独立レビューは両担当とも必須残指摘なしで完了した。Checkpointの実体一意性とSource注入、19fieldと二投影の型同値、旧alias参照0、型試験に強制castの偽装がないこと、Root集合と三Map不変を確認した。独立担当は読取りのみで、実行結果は親担当の証跡に基づく。本段階のCheckpoint移管・型整理は限定範囲で完了し、四完成操作の全面移管・他の純粋検査循環の解消は未実施として区別する。EMの一連差分は引き続き未Commit／未Push。

### 14.58 四保存操作の移管単位の具体化（実装前）

対象は§14.57で残した四操作。現在Sourceと私有状態の更新点を確認した設計案であり、製品Sourceの移管・挙動検証は未実施。公開名・Request／Result・保存形式・単一CASを変更しない。Mapを分散したり可変bindingを公開する案、空の転送Wrapperを追加する案は採用しない。

| 既存操作 | 意味側の責務 | 物理保存側の責務 |
|---|---|---|
| `completeRecovery` | exact対象の選択、Taskとの参照整合・終了条件、除去又は記録保持の結果解釈 | 私有終了Context、一回消費、同版候補確定、失効 |
| `saveRepairRecord` | 期待版と固定更新の受付、修復候補生成、同値更新・終了判定の返却 | 初版準備、Context登録、既存Writer、初期化Effect合成と失効 |
| `resumeRepairRecordSave` | 対象が同じ修復記録であることの値検査 | 固定File・marker・pendingの観測と再確定が実体の大半。完成操作自体をStorageへ置けば転送Wrapperを避けられる |
| `advanceOwnedRecoveryHistory` | 対象と履歴段階の選択、確認済み結果の解釈 | 私有履歴Context、固定File／設定の結合、一回出版・読戻しと失効 |

配置案は、Attemptに終了／修復更新、Historyに履歴段階操作、Stateに全体候補・参照・改訂整合、既存Storageの`publication.ts`に単一Writerと三私有Mapを一体で置く。初期化・prepare／commit／write・Lock解放後の証拠確定・`readHistoryResumeCandidate`も同じ物理所有者へ接続する。新Store・Registry・Managerは作らず、Root公開は増減させない。

用途側はMapを直接操作しない。既存四種proofの閉集合について、内部の一回の完成処理がContext生成→既存初期化が必要な場合だけ準備→既存Writer→Effect合成→finally失効を所有する。これは現状各操作で繰り返す実処理の集約であり、可変recordを渡す汎用get/setではない。既存Readerの結果を使用し、移管の都合で再読取りを追加しない。

四操作以外の必須同伴は次の三接続。`saveAuthenticationClosure`も同じsettlementsへ登録するため、proof発行から破棄までを同じ物理完成処理へ接続する。`writeStorageTaskSnapshotOwned`と`saveExecutionDefinition`は取得済みStorageOwnerでcommitを直接呼ぶため、同じOwnerを借用する閉じた内部出版処理へ組立てを移し、Lockの再取得・解放は追加しない。raw prepared、Map、Lock又は任意callbackを新たに公開しない。

実装の成立条件は、各proofの真正性・一回消費・発行事実・失効が同じ箇所に残ること、通常取得と借用Ownerの解放責務を混同しないこと、初版／pending／元版差／Owner失効／読戻し・解放不明と非対象保全の既存反証が維持されること。着手時はこれらをSource移管箇所と限定試験へ対応付け、固定候補の独立レビューを行う。設計整理を移管完了や新候補の試験成功へ読み替えない。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.59 修復記録の保存と保存再開の命名統一

人間が確定した二名称へ一対一で改名する。`saveRepairState`を`saveRepairRecord`、`resumeRepairPublication`を`resumeRepairRecordSave`とし、旧名の互換export・Wrapper・import aliasは作らない。四操作の配置変更と他二操作の命名は本段階へ混ぜない。§14.58のStorage移管は実装前のまま維持する。

変更分類は公開関数名の変更と全利用側の同時追従。着手前にRoot・宣言元・通常呼出し・試験代役・Source抽出／VM注入・固定公開集合・現在設計の全参照を照合した。名前以外の引数・結果・処理・Schema・IPC・保存Path・一回消費・Lock／CASは変更しない。過去の変更記録とEvidenceは当時の名称を保全し、この節の対応へ接続する。Root集合は二名称を置換するだけで100項目を維持する。

編集はN1=二宣言とRoot／通常Consumer、N2=試験の呼出し・Source選択・VM依存名・公開集合、N3=現在Architectureと本記録の順で全数対応する。既存Symbolと台帳はFile／Local Item単位であり、今回PathやIDは変わらない。限定確認は関係型検査・公開集合・EM修復Writer局所反証、Coordinatorの保存／再入場接続と試験登録の照合とする。固定候補の技術／品質の独立レビューを実施する。工程契約・準拠基準・保存方式は変えないため全体準拠監査・全体回帰は追加しない。実AI・Docker・過去保持物は操作しない。追加の人間判断は不要。


二名称を宣言元・Root・Coordinator・Source抽出・VM依存・代役・公開集合・現在設計の10 Fileへ適用した。改名直後に旧名への逆置換と空白除外Hashで名前以外の変更がないことを確認した。旧名の現行Source参照と互換exportは0、Rootは二名称置換後も100項目。過去記録は当時の名称を保持する。

限定公開／独立ロード13項目、修復Writerの局所2項目、Coordinatorの実pending再開4項目、factory／fresh出版接続5項目、登録接続1項目が成功した。最後の接続試験は4条件ごとの新品Repository準備を含む既存試験で261,471ms、実pending再開は90,266msで終了し、今回試験物を既存hookで回収した。これを全体回帰や製品処理の性能結果とは扱わない。

局所試験の初回には撤去済みpendingDeliveriesを参照する既存試験不整合が露出した。製品と保存形式は変更せず、九scenarioを維持して二つの旧配送caseを現行未解決参照の追加・並べ替えの拒否へ更新した。元guardと各guard除去変異の後続0／1、元本文保全のOracleは維持し、是正後二項目が成功した。初回失敗は成功件数へ合算しない。

対象整形・警告、EMとCo本番／試験の型検査、差分空白確認も成功。技術とOwner／品質の固定候補独立レビューは必須残指摘なし。独立担当は読取りで、実行根拠は親担当の記録に基づく。全体回帰・実AI・Docker・過去保持物は操作していない。§14.58の四操作移管は設計のままで、新たなWriter・Map移管を本改名へ混ぜていない。一連のEM差分は未Commit／未Push。
## 14.60 4保存操作のOwner移管（着手前整合確認）

変更分類は保存契約を維持する内部責務整理。基準は現在の作業版と14.58・14.59で確定した4操作とする。Attemptへ終了・修復候補の意味、Historyへ履歴段階の意味を移し、Storageへ単一Writer・初期化・再入場・既存3私有Mapを一体化する。認証終了、取得済みOwnerによるTask・定義保存も同じWriterへ接続し、排他の再取得・二重解放を追加しない。

独立した読取り専用の着手前確認で閉包を照合した。PublicationからState CRUDへの実行時逆依存を作らず、証拠消費はcommit冒頭、初期化証拠更新はrename直前、履歴試行登録は保存と解放確認後という順序を保つ。未知の内部用途は証拠登録・Effect前に拒否する。保存Schema、Root公開数、判定、期限と診断を変更しない。

限定回帰は保存・再入場・認証終了・Task・定義・履歴の変更意味から選び、固定候補で技術／試験の独立レビューを実施する。文書・台帳は配置と接続を同期する。規範・リリース変更ではないため準拠監査は実施しない。全体回帰、実AI、Docker、過去保持物の操作は対象外。現在、人間による追加判断は必要ない。

### 実装と限定検証の結果

| 所有者 | 今回の完成操作／実体 |
|---|---|
| Attempt CRUD | completeRecovery、saveRepairRecordの対象選定・候補・結果投影 |
| History CRUD | advanceOwnedRecoveryHistoryの段階選定・結果 |
| Storage publication | resumeRepairRecordSave、単一prepare／commit／write、初期化、3私有Map、再入場候補 |
| 内部の一回保存接続 | publishRecoveryStateが四証拠用途の生成・必要な初期化・保存・失効を一体化。publishStateOwnedがTask／定義の取得済みOwnerを借用し、排他を再取得・解放しない |

旧所在地の宣言・転送Wrapper・再exportを撤去し、Rootは100項目（65値・35型）のまま。Writerから用途CRUDへの実行時参照はない。初期化、prepareStateWrite、commitStateSnapshotOwned、writeStateSnapshot、readHistoryResumeCandidateの5本文は移管前と空白正規化後に完全一致した。旧Mapは3個のままStorageへ移り、意味側で生成していたContextの反復を内部の一回保存処理へ置き換えた。新Manager・Store・Registry・永続形式はない。

| 限定確認 | 是正後の結果 |
|---|---|
| 値・候補・Schema・型投影 | 68項目成功 |
| 公開・独立ロード・Checkpoint | 16項目成功 |
| 新保存接続UT／既存scope反証 | 2項目／4項目成功 |
| 修復の実保存・履歴段階／no-op | 29項目／1項目成功 |
| 通常終了一回証拠／履歴pending再入場 | 1項目／2項目成功 |
| Task pending故障／一般CRUDと保存故障 | 8項目／7項目成功 |
| 初期化証拠・pending再入場 | 1項目成功（Hardlinkを含む限定通常権限実行） |
| Coordinator未出版pendingの実再開 | 4項目成功、92,617ms |
| Source境界／登録・QA接続 | 1項目／1項目成功 |
| 静的確認 | 対象整形・警告、EM・Coordinator本番／試験型検査成功 |

初回の限定試験では、旧Context登録文字列への注入、fresh子の旧readState引数、撤去済みpendingDeliveries／resultReceiptsの期待が失敗した。製品判定を変えず、注入を現Storageの同一Mapへ接続し、子に明示scopeを渡し、旧fieldは不存在を確認する形へ追従した。初期化再試験は環境のHardlink権限制限（EPERM）で停止したため、当該1試験だけ通常Windows権限で再実行して成功した。初回失敗を成功へ合算しない。全試験は自己生成物の既存cleanupを使用し、失敗時の既知Rootについても不存在を確認した。

固定候補の独立技術レビューは必須指摘0。独立QA／Ownerレビューの2系統（旧物理Owner説明、移管先への境界試験接続漏れ）は、両担当に統合是正方針を再提示してから修正した。既存State側assertを保持してStorage側も確認し、該当試験・登録照合後の独立再レビューは必須残指摘0。レビュー担当は読取りのみで、実行証跡は親担当の限定実測である。全体回帰・実AI・Docker・過去保持物は操作していない。未Commit／未Pushであり、統合・Release判断ではない。
## 14.61 照会系を通常CRUDへ限定する整理

ユーザーは「通常CRUDだけ」の対象を照会系と確定した。queryQueueはモデル一覧として維持し、Decision＋Blocker、Project＋管理実行、Queue参照限定Workspaceを返す三つの特殊照会は廃止する。Rootだけを隠すのではなく、宣言・専用投影・型Mappingを撤去し、同じ特殊処理を別名Wrapperへ移さない。通常CRUDと既存の本番同版取得、認可、保存形式・Lock／CASは変更しない。

基準は14.60完了後の作業版。本番利用は三入口とも0で、外部利用はCoordinatorの2試験Fileに限定される。既存の単件Decision取得・通常Plan読取りと、試験自身が観測している自己生成保存物へ検証を追従する。Decision／Blockerの保存内容・対象相関のassertは維持し、通常Queryの失効認可・未実施も検証する。削除した特殊投影の公開成立は完成条件から除くが、下位の読取り・保存保証を緩めない。

変更分類は公開APIの限定退役と責務整理。台帳とArchitecture・公開契約試験を同期し、選択したモデル・保存・Coordinator結合だけを回帰する。固定候補の独立レビューを実施し、準拠・Release監査は規範／Release変更でないため実施しない。全体回帰・実AI・Docker・過去保持物は対象外。業務操作の追加棚卸しは読取りのみとし、Lease・回復・終了保存の撤去をこの許可から推定しない。

### 今回の実施結果

三特殊QueryのRoot・宣言・専用投影・型Mappingを撤去し、公開は97項目（62値・35型）となった。通常Query四用途の現在認可・取得／解放・同版versionを維持する。旧用途・未知／欠測kindは認可前に拒否する。本番Consumerは0で、Coordinatorの2試験Fileは既存readDecision・queryPlanと自己生成State確認へ追従した。保存形式・業務操作・本番readStateの同版取得は変更していない。

限定検証は公開・独立ロード14項目、EM Core／判断実保存2項目、Coordinator継続／明示無効化／一般CRUD保全3項目、登録照合1項目が成功した。対象整形・警告、EMとCoordinator本番／試験の型検査も成功。初回の追加Queue正例はPlan作成前に置いたため正しいabsent結果で失敗し、Plan保存後へ試験位置だけ是正して成功した。初回失敗は成功件数へ合算しない。今回の自己生成試験物は既存終了hookで回収する。

独立技術レビューは製品必須指摘0。軽微な型コメントの旧投影説明と、QA／Ownerレビューの現況97・先行100・退役前Queryの説明不整合を統合し、両担当の方針整合後に一括是正した。境界14項目・登録1項目の再確認と独立読み取り再レビュー後、必須残指摘0。Source／Suite／台帳の既存Stable IDを維持し、試験を削除して公開数だけを減らしていない。全体回帰・実AI・Docker・過去保持物の操作なし。未Commit／未Pushで、統合判断とは別である。

### 業務操作・残る用途固定観測の追加棚卸し（調査のみ）

| 対象 | 確認した実態 | 次に検討する整理 |
|---|---|---|
| completeStatePublication | State CRUDにあるが、内容は保存markerの三観測・除去・不存在確認。Coが保存終了／再入場で明示呼出し | Storage内部の保存・再入場完了へ統合可能か確認。配置変更だけで終えず、呼出し順と不明結果を維持できる場合だけ単独公開を撤去 |
| advanceOwnedRecoveryHistory | Historyのcheckpoint／publish／confirmedという段階をCoが繰返し駆動 | 回復記録の完成操作へ段階制御を閉じられるか確認。現在Owner・保持設定・段階別Effect／解放不明を失わせない |
| resumeResourcePublication | 上位がStorageRepositoryとbefore／candidate本文を渡し、EMがfresh本文と再比較する | Repair側と同様、確定対象からEM内で保存再入場材料を読む契約へ整理可能か確認。単純な統一Requestや任意Snapshot受付は作らない |
| readTaskIntakeState／readOperationCompletion | 前者はQueue・Lease Intent・受付世代の用途固定複合取得、後者は履歴相関を含む終了確認 | 通常モデル取得と用途判断を分離できるか確認。同版取得を逐次読取りへ分割せず、記録不存在を終了確認へ読み替えない |

一方、completeOperationとcompleteRecoveryは、元Processの真正終了観測と保存物からの明示再入場で証拠の種類が異なる。初期化二入口も信頼Rootと一般内容認可の境界が異なる。Leaseの各操作は永続Intentと上位の実Lockを結び、selectQueueEntryはCoから渡された選択差分だけを同版CASへ載せている。これらを名前や件数だけで重複・責務違反とは判断しない。追加表は削除許可や同等保証成立の主張ではなく、次の具体設計と限定検証の対象候補である。
## 14.62 用途固定観測の既存Readerへの統合

変更分類は公開入口統合と利用側追従。14.61完了後の作業版を基準に、readTaskIntakeStateとreadOperationCompletionの独立宣言を廃止し、既存readStateへ接続する。前者はQueue集合・Lease Intent・受付世代を通常readSnapshotの同版一回から返すqueue範囲、後者は回復IDと上位相関IDを結合したcompletion観測とする。既存intake範囲の出版確認付きReaderとは統合せず、両者の条件差を維持する。新規Reader・Map・永続状態・型の再定義・外部Helper複製は追加しない。

着手前に親担当と独立した読取り担当が、利用側・型・試験・保存の意味を照合した。完了観測は単なる操作不存在と区別し、保存結果のstatus・排他解放・履歴相関の共同成立だけを返す。旧入口からの転送Wrapperを残さず、Coの実呼出し・Source注入・試験を既存入口へ接続する。型・限定実保存・不正入力と同版取得・相関改変の反証、独立レビュー、台帳と設計追従を実施する。規範・Release変更でないため準拠監査は実施しない。

保存三操作は、phase／modeへの単なる付替えで隠さない。現在のOwner区間、履歴確定前後の判断、marker限定回収の独立性、上位が保持するbefore／candidateのexact結合を自動処置へ変えてはならない。特に資源再保存は改訂番号だけでは元candidateとの一致を代替できないため、既存証拠を保持する完成操作の設計を別に閉じる。今回この意味を変更せず、全体回帰・実AI・Docker・過去保持物は対象外とする。

### 先行二照会の結果

readTaskIntakeState／readOperationCompletionの独立宣言・Root・旧Wrapperを撤去し、利用側・Source代役・公開期待集合を追従した。Rootは95項目（60値・35型）。受付集合はqueue範囲で元の通常readSnapshot一回を維持し、既存intake範囲の出版確認モードと混同しない。終了観測は既存の回復Readerで元のcompletedOperation引数と完全key／値検査を使い、相関・読取り成功・解放の共同成立をoperationCompletionConfirmedへ投影する。Readerの元診断・保存値・回復情報は消さない。

限定検証は境界／Repository受付14項目、局所Reader2項目、実終端保存1項目、Co単発受付3項目、台帳接続1項目の計21項目が成功。Co受付3項目は219,595msで正常終了し、追加した停止検討時点ですでに完了していたため取消・中断扱いにはしない。受付前後停止1項目の単独再実行も成功したが21項目へ重複加算しない。各自己生成Rootの終了hookが実行され、試験の成功には既存の不存在assertを含む。

初回の局所試験では、旧Source fixtureがsnapshotStateRecordを注入していなかったため失敗した。実保存の追加正例も、別IdentityのfirstHistoryへ戻した後に照会して不成立となった。製品を緩めず、局所依存を現行Sourceへ追従し、実Driverが確定した同じ履歴直後へ検証位置を移して正相関true・別相関／履歴欠測／重複falseとState不変を確認した。初回失敗を成功へ合算しない。

EMとCo本番／試験の型検査、対象整形・警告、旧宣言・Consumer残存走査が成功した。Co大規模保存親Suiteは全件実行せず、変更呼出しは型検査、終了観測の実保存根拠は今回の限定EM試験で確認した。SourceとQA／Ownerの独立レビューは必須指摘0、文書の現在95・先行97・同版読取り条件を追従した独立読み取り再確認も必須残指摘0。全体回帰・実AI・Docker・過去保持物の操作なし。未Commit／未Push。

### 保存三操作の未完範囲

completeStatePublication、advanceOwnedRecoveryHistory、resumeResourcePublicationは今回変更していない。marker回収はpending保存やOperation除去と異なる時点で呼ばれ、履歴確定もHost／Lease条件と保持判断の間にある。自動で連続処置することは既存の判断順を変える。phase／modeへ移すだけでは内部段階の公開が残り、今回の目的を満たさない。資源再保存でも上位が保持する元before／candidateとのexact結合を、現行改訂番号だけへ弱めることはできない。保存の完成単位と結果契約を先に確定し、Owner／時点／診断を保持する利用側再編が残る。5入口の全面統合済みとは表示しない。
## 14.63 資源Checkpointの保存再入場を完成保存入口へ統合

基準は14.62完了後の作業版。resumeResourcePublicationの独立公開と宣言を廃止し、既存saveRecoveryCheckpointの資源出版再入場へ本体を統合する。上位はEM Readerが返したbefore／candidateの一組をそのまま要求へ渡し、各本文を再構築しない。元pairとのexact比較を改訂番号・名前・新Hashへ弱めない。Requestとpairは完全key捕捉し、rawBeforeはnullだけを受ける。

旧処理の用途分類、fresh Reader、元pair全文比較、Owner再確認、同じWriterへの接続をcase本体へ移し、旧宣言・転送Wrapperは残さない。正常入力のOwner確認位置と回数、File差替え・不明結果の保持を維持する。保存形式、Rootの他操作、DI／Executor／ADは変更しない。着手前に親担当と独立確認者で案を照合し、局所Source反証と限定実保存、型・台帳・文書、固定候補の独立レビューを実施する。全体回帰・実AI・Docker・過去保持物は対象外。

### 資源再保存の実施結果

旧resumeResourcePublicationの独立宣言・Root公開・呼出しを撤去し、同じ保存受付caseへ実体統合した。Rootは94項目（59値・35型）。上位はEM Readerの二本文の一組をそのまま渡し、候補再構築・新Hash・改訂番号による代替・新Mapを導入していない。通常Buffer入力から新用途を除外し、専用null入力、完全key捕捉、用途混在のOwner前拒否を型と実行時で一致させた。

限定検証は局所2項目、公開／Repository受付14項目、Co現在状態とpending再入場の実保存2項目、台帳照合1項目の計19項目が成功した。Coの親試験は165,357msで終了し、元Owner三位置の拒否／例外、読取り前後のFile差替え、元byteとmarker保全、保存後fresh本文比較を新入口で確認した。親内の他の保存観点も同じ新Request捕捉を通るため、全Package回帰ではなく当該一親の範囲に限定した。自己生成Rootは既存hookで回収し、実AI・Docker・過去保持物は操作していない。

EMとCo本番／試験の型検査、対象整形・警告、旧名の全TS走査と空白差分確認も成功。固定候補の独立技術レビューは必須0。QA／Ownerレビューで指摘された回復取得一覧のcompletion欠測と先行段階説明の不整合を、両担当へ統合方針再提示後に一括是正した。Root／登録の限定再確認と読み取り再レビューで必須残指摘0。過去の検証結果を現在の全面成立へ流用せず、marker後処理と履歴段階制御は未統合として次節の設計案と区別する。未Commit／未Push。

## 14.64 保存marker後処理を保存の完成単位へ統合

状態: 設計案のみ。未実装・未検証。現在の公開契約を変更したものではない。

基準は14.63実装後の作業版。completeStatePublicationをRootから撤去し、Storage私有の処置へ移す。保存再開はpendingの有無・保存結果とmarker処置を共同で完了し、修復の終了保存も同じ後処理を内部で実施する。mode／phaseだけを付け替えた単独marker入口は作らない。

着手前に独立確認者がSourceと案を照合した。id未指定の保存再開はpendingを出版せず、整合したcurrentがありpending・未知Fileがない場合だけ既存のmarker確認へ進む。no_pending＋marker成功をsnapshotConfirmedへ読み替えず、元保存結果とmarkerCleanupを別に返す。元WriterとmarkerのEffect／理由は個別に保持し、総Effectも返す。処置前と返却前に現在Ownerを確認する。

修復終了の既存Readerがcompleted・排他解放・repairCompletionAbsentを明示した場合は保存を捏造せずmarker後処理だけを完了する。その他は元の保存成功とOwner確認後だけ処置する。Coの最終fresh Readerと保持期限・exact対象の確認は残す。早期marker処置は整合済み保存物の短命File除去に限定し、本文・履歴・技術資源を変更しない。既存の実体照合と部分成功／不明の診断を維持し、限定実保存・独立レビューで確認する。全体回帰・実AI・Docker・過去保持物は対象外。

### 共通Lockの配置・命名統一（着手計画）

変更分類は共有Filesystem契約の非自明な内部整理。Repository内の共通Lockを .crdd/lock/<責務パッケージ名>.<保護対象>.lock に揃える。Scope識別子が必要な資源は保護対象名の後へ付ける。Repository非依存の明示Store、Repository横断Home、Host世代、Desktopは現在の共有所在を維持し、名前だけ同じ規則へ揃える。同じ資源の複数Consumerは同一名を使用する。

保持する保証はwx一回取得、元Owner・Generation・File Identityの照合、一回解放、残存時Fail Closed、既存の長期Lease回復条件。新しいRegistry、移行Reader、二重取得、自動Recoveryは追加しない。state.lock markerの撤去は別段階とし、この配置変更へ混ぜない。旧名と新名は相互排他しないため、有効化は対象資源の全利用者停止下で一括切替する。過去保持物は移動・削除しない。

着手前確認ではProvider HomeのExecutor/Coordinator/Script共有、長期LeaseのEM不存在観測とCoordinator回復、EI/AMのRepository非依存性を照合した。発火例は同じ対象の二重取得、非発火例は異なる対象、境界例は共有Homeの別Repository利用、情報不足例はLock親のLink・置換・観測不能とし、後者では取得しない。DI変更はDesktop固定Lock名の統一に限る。

確認は変更したOwnerの型・限定契約試験と独立技術/影響レビュー、直接文書整合を行う。全体回帰、実AI、Docker、過去保持物の操作、リリース/準拠監査は行わない。後二者は今回採用・リリース判定を扱わないため非該当。実装前基準は現在の共通Lock契約試験、各Ownerの取得/解放/回復試験と本変更前のSourceであり、別の保存形式は作らない。

### 共通Lock配置・命名統一の実装と限定確認

Repository内はEM state、構成モデルAI選定、文書モデルTopic/Meeting、Coordinator長期Leaseを.crdd/lockへ接続した。責務Ownerと保護対象をbasenameで表し、Identity本文・Owner・Generation・取得/解放方式は維持。Repository非依存EI/AM Storeと共有Home/Host/Desktopは既存の明示所在を維持してbasenameを統一した。Provider HomeはExecutor/Coordinator/Scriptと在庫判定が同名を使用する。

長期Leaseの取得/解放/回復/不存在確認、EM側の不存在確認を一括変更した。他対象Lockは通常Lease単体の不存在に影響させず、Workbench試験Root全体削除Gateでは共有folder全項目0を要求する。孤立したCoordinator ensureDirectoryと専用Headerを撤去した。state.lock markerは別段階の未対応。旧残存の自動変換・移動・削除と旧新二重取得は追加していない。

独立技術レビューの機能/安全必須指摘0。独立品質/利用側レビューでは、故障注入の旧親条件、共有folder不存在の旧期待、fixture全体削除Gateの絞込み、設計表の旧所在を是正し、再レビュー必須残指摘0。Workbench VMの既存旧Helper名と旧ACK既定fieldは現在Sourceへ追従し、旧field負例は維持した。

限定確認はEM実Lock6、Snapshot実Process1、EM公開/Repository14、共通Lock15、Co共有Scope4、DI Desktop設定4+模擬Command10、EI Store22、構成モデル11、文書モデル19、Executor Home2、AM Lock8、MCP保存故障5、Workbench準備/削除Gate2、長期Lease7、台帳関係1の計131項目が成功。リンク/ハードリンク作成とlocalhost接続が環境権限で拒否されたケースは、今回生成Root/localhost用途だけを通常権限で再実行して成功。検査は緩めていない。Co故障注入の追加2項目も成功し、今回の限定確認は計133項目となった。初回の新版Owner喪失試験では、旧tmp親まで削除する試験清掃が新配置の.crddへ当たってENOTEMPTYとなったため、試験所有のlock Directoryだけを削除するよう1行是正した。同一試験の再実行は成功し、製品の停止・回復条件は変更していない。

型検査はEM/構成/文書/EI/AM/DI/Executor/Coordinator製品・試験/Workbench/MCPで成功。限定Biomeと差分空白確認も成功（Template化の情報提案は未適用）。全体回帰、実AI、Docker、過去保持物操作は実施せず、実利用者の停止/切替やリリース完了とは扱わない。Commit/Push未実施。

### 保存marker撤去の着手前整合確認

共通Lock配置統一後の現在Sourceを基準に、marker専用のstate.lockとcompleteStatePublicationを撤去する。変更分類はFilesystem保存/再入場契約の非自明な簡素化。現在値・pending・履歴のSchema/元版/回復ID/本文/実体/Root/Owner/排他解放を維持する。初回出版はpending一件、資源再保存は元pair全文、Host清掃は既存終端条件と候補一致、履歴は同一行/保持/保存順、終了は履歴相関とOperation不存在を正本とする。保存後のfresh観測は前回呼出し成功の推定に使わない。

代表例は正常置換、pending書込み失敗、置換後の結果未搬送、履歴出版後のState未保存。境界例は同版pending・別候補・初期State不在。未知/旧state.lock/観測不能は保全停止とする。marker作成/差戻し/清掃Effectは偽装して残さず、実pending/置換のEffectを返す。旧markerの互換Readerや自動清掃は作らない。専用清掃入口/診断項目を廃止し、Co修復completionのfresh照会は維持、通常再入場の読取りは既存history種別へ統合する。

着手前独立確認は実装/利用側を読み取り専用で照合し、追加判断不要。marker削除そのものの旧試験義務は退役し、current/pending/historyの不正拒否・保全・fresh観測・借用Owner/解放保証を既存QAへ対応付ける。限定契約/実Filesystem試験、型、文書/台帳照合と独立技術/品質レビューを行う。全体回帰/実AI/Docker/過去保持物操作/リリース/準拠監査は対象外。既存の未Commit変更と保持物は保全する。

### 保存marker撤去の実装と限定確認

保存専用のdomain-model/state.lock、作成・差戻し・清掃処理、completeStatePublicationとCoordinatorの専用診断fieldを撤去した。共通Lockの排他、current/pending/historyの同一性・元版・対象・履歴・Owner確認は維持する。初期保存はpending一件を用い、実際のEffectだけを結果へ反映する。旧marker残存は未知Fileとして停止し、互換読取りや自動清掃をしない。§14.64の未実装案はこの方針で置き換える。Root公開は93項目（58値・35型）。

Coordinatorの完了後fresh照会は維持し、通常修復入口は既存の履歴付きReaderへ接続した。rename後・pendingなしのcurrentをfresh Readerが読めても、前回Writerの成功・結果搬送・耐久確定を推定しない。実Process境界試験で、completeRecoveryの一般Reader拒否が既存execution_completion Readerへの到達を妨げていたことを検出した。Lock解放とOwner確認後、coordinator_state_reentry_requiredだけを既存用途限定Readerへ渡す最小是正を行い、関連Task・未知File・旧marker・別候補・history.pending・他失敗理由の拒否は維持した。

限定確認は公開境界、保存Reader/Writer、pending故障7種、初期保存、実体置換、借用Owner、修復結果・修復Owner、完了保存の別Process再入場、台帳接続を対象として成功した。既存marker清掃試験はcurrent/pending/historyの拒否・保全とOwner確認へ置き換え、故障注入が実際に発火したことも確認した。最後の再確認はpending故障と限定配送9項目、公開境界10項目、実修復履歴保存29項目が成功。後者の初回1失敗は、既存.crddへのmkdir/EEXIST確認を禁止していた試験Hookだけをexact二Pathへ追従し、State変更禁止・counter・本文/実体確認を維持して是正した。EMとCoordinator製品・試験の型検査、対象8Sourceの整形、差分空白確認は成功。Lintはerror/warningなし（既存blockとTemplate化の情報提案のみ）。独立技術レビューと品質/利用側再レビューの必須残指摘は0。文書内のHost markerは保存markerとは別と明示し、Hostの保証は変更していない。全体回帰や実境界E2EのPassとは表示しない。

途中のcompletion_pending試験失敗で今回生成したC:/project/CRDD/.crdd/tests/current-host-transition-3424-xbkowPだけが残存した。同ケースの是正後再実行は成功した。今回Rootの親・実体・リンク不存在を確認して同Rootだけを回収し、終了後不存在を確認済み。過去保持物は操作していない。全体回帰・実AI・Docker・実利用者の切替・Commit/Pushは未実施。

### 履歴完成保存の着手前整合確認

現在の作業版を基準に、一段ずつ進めるadvanceOwnedRecoveryHistoryをsaveRecoveryHistoryへ置き換える。変更分類は保存調停の責務整理であり、履歴固定・保存・最終fresh確認の既存最大二保存をEM History内で完結させる。Coordinatorは対象・Host・保持・終了判断と前後の業務事実確認を所有し、checkpoint/publish/confirmedの順序を駆動しない。Root公開数は増やさず、旧入口・互換Wrapper・新State/Map/Managerは追加しない。

代表例は初回の二段保存、一段保存後からの再入場、確定済みno-op。反証は各保存前後の故障、最終Reader不明、段階不変、別Identity、Owner失効、Lock解放不明、保持設定変更とする。各段のfresh Reader、元対象Identity、単一Writerの一回Contextと保持設定再検証を維持する。既知Effectは累積し、Writer内throwで発行有無を観測できない場合だけ不明とする。中間段階の実保存試験は失敗注入で作り、旧一段公開を試験のために存続させない。

保存Schema・既存Path・履歴保持判断・Operation退役条件・Host/Docker処置は変更しない。既存の履歴実保存/回復試験と公開契約を新入口へ対応付け、限定回帰・型・利用側/文書照合と独立レビューを実施する。正本・利用側をまたぐため読み取り専用の技術整合確認と試験影響棚卸しを用いる。全体回帰・実AI・Docker・過去保持物操作、リリース/準拠監査は対象外であり、今回の内部責務整理からリリース可否は判断しない。

### 履歴完成保存の実装と限定確認

History CRUDのsaveRecoveryHistoryが、既存Reader/単一Writerによる最大二保存と最終fresh確認を所有する。段階進行と同じOperation Identityを確認し、失敗後の同呼出し再試行はしない。旧一段入口とCoordinatorの二箇所の段階ループは撤去した。Coordinatorは初回の技術結果・保持期限・終端事実を保持し、完成保存の成否と成功後のfresh観測だけを業務判断へ使う。追加Result投影・Root型・Wrapper・Mapは増やさず、Root93項目（58値・35型）を維持する。

累積Effectは既知trueを失わず、Writer呼出し中の例外だけ未確認nullとする。Reader/Writer呼出し前はLock解放未確認とし、応答の確認値だけへ更新する。独立技術レビューで外側のDocker履歴接続にも同じ例外時過大表示が見つかり、cleanupUnknown・失敗sticky・同Owner再発行0まで一括是正した。品質レビューのcheckpoint準備追従漏れは、保存済みhistoryを観測したOwner失効による中間停止へ直し、blocked・未confirmed・fresh publish段階を確認した。両独立再レビューは必須残指摘0。

限定確認はEM公開/依存境界10項目、保持/完成保存の有限契約7項目、EM実履歴保存・故障・再入場29項目、Co履歴接続2項目、段階後fresh故障12項目、実Owner五切断点6項目、通常Task現在値/pending再入場2項目、保持済み再入場1親試験（5条件）、保存失敗1親試験（20条件）が成功した。故障注入は公開呼出し回数から保存数を推測せず、実Lock取得・保存置換・解放境界で行う。内部試験補助への新たな外部Importは公開境界試験が拒否したため撤去し、既存公開APIと実Filesystem故障へ接続した。EM/Co製品・試験の型、対象整形、差分空白確認も成功。Lintはerror/warningなしで情報提案だけを残す。

保存失敗20条件の親試験は1657秒、保持済み再入場5条件は620秒を要した。両者には既存のケース別Git Root準備の反復が残る。製品の保存再試行とは区別し、Co試験Ownerによる不変準備共有・可変状態独立の改善候補とする。次の当該試験整理時に再評価し、今回の検証内容や期限は減らしていない。

途中の試験準備失敗に対応する今回生成Root C:/project/CRDD/.crdd/tmp/crdd-acceptance-st-Zn3lwkは、固定親・非link実体、合成README/Git利用者・Remote不在、保存物不在・空Lock領域を確認して回収し、終了後不存在を確認した。過去保持物は操作していない。全体回帰・実AI・Docker・リリース判定・Commit/Pushは未実施。

### コミット前の全変更最終照合

基準bfd01b54aからの全変更について、旧入口・旧保存markerの処理、利用側・scriptsのLock所在、Owner移管、公開93項目、試験台帳と設計を読み取りで再照合した。独立技術レビューはコード上の追加必須指摘0、品質/利用側レビューも追加必須指摘0。旧Lockからの切替条件だけは、[Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)を正本として具体化した。全利用者停止に加え、旧名Lockと未解決義務を旧Ownerの手順で照合・処置確認できた保護対象だけ有効化し、不明なら切替しない。新コードの旧Lock自動検出、旧新並走時の相互排他や旧Crash残存への自動Fail Closed継承は主張しない。保持物の処置と実利用切替は実施していない。

追加の限定再確認は公開/依存境界・保持/履歴完成保存17項目、Checkpoint/履歴純粋操作/保存投影/一回出版11項目が成功。EMとCoordinator製品/試験の型検査、差分空白確認、台帳418参照先の実在確認も成功した。直前までの実保存・Process境界・故障試験の成功結果は上記記録を使用し、長時間試験を機械的に反復せず、全体回帰・実AI・Dockerは起動していない。本節までの確認済み変更を同じ作業ブランチのCommit/Push対象とし、リリース/統合判断や実利用切替の完了とは区別する。

### 修復試験の追加25条件の準備共有 — 着手前整合確認

基準ad386d473に対し、Coordinatorのruntime-repair-result試験内の保存故障20条件と保持済み再入場5条件を、既存sharedRepairBaseへ接続する。変更分類は試験設計の調整。新品Git Root・Revision・保存IdentityとSource factoryだけを共有する。初回の子試験候補43項目は成功したが、既存49条件の単件選択契約も照合し、最終候補は同じトップレベル個別登録と直列guardへ揃える。State/history・Owner・AbortController・故障Hook・保存/技術counterはfixtureを条件ごとに作り、既存終了hookで保存物と生存参照を閉じてから次条件へ進む。

親担当は既存49条件の成立済み共有方式、fixtureの未初期化確認・排他不存在・join確認・正規Root清掃、今回25条件の全assertを照合した。製品Source・公開IF・保存Schema・検査・期限・故障条件は変更しない。登録済みの同試験/QA項目を維持し、同25条件と既存共有fixtureの限定回帰、型/整形/差分検査と独立レビューを行う。新しい共有helper・Store・Wrapperは作らない。公開補助IFと検査依存はこの後の読み取り棚卸しに限り、未確定の削除を同時実装しない。全体回帰・実AI・Docker・過去保持物操作、リリース/準拠監査は対象外。

### 追加25条件の準備共有 — 実装・限定確認

既存sharedRepairBaseと終了hookをそのまま再利用し、25条件を独立したfixtureで実行する。個別登録は既存49条件と同じトップレベル方式へ揃え、単件指定で1項目だけが実行・成功することを確認した。対象2群の静的assert式はそれぞれ12式・18式で、整形による末尾commaを除いて基準版と全一致する。条件・経路・故障位置・製品実装は変更していない。

初回の子試験候補は43項目成功し、対象20条件は56.2秒、対象5条件は20.0秒だった。最終の個別登録候補は既存49条件＋追加25条件＋factory三子と親の計78項目が全成功し、201,577ms（約3分22秒）で終了した。各条件の有限Session join・Owner失効・Lock/pending不存在、モデル保存領域の回収と最終Root回収は既存hookで確認した。基準版の2親試験1657秒/620秒との比較は、この環境・この限定集合の試験時間だけに限る。

Coordinator製品/試験の型検査、対象の整形、差分空白確認は成功。Lintはerror/warningなし（既存同型block等の情報提案のみ）。独立した試験/品質レビューは必須残指摘0。既存試験ファイル・同じQA項目内の整理であり、台帳の新規項目は増やしていない。全体回帰・実AI・Docker・過去保持物の操作はせず、製品SourceとRoot公開93項目は不変。今回の変更は未Commit。

### 公開補助IF・検査依存の後続棚卸し — 未実装

本番Consumerと入力の由来を照合すると、今回の対象をRootから隠すだけで安全に削減できる公開物は特定できなかった。未信頼入力の検査と、受付済みの同じ値の再検査を区別する。

| 対象 | 現在の利用と扱い |
|---|---|
| inspectDecision | Co decision/requestのコマンド応答復元。完全記録の搬送検査として維持。再照会への置換は二重取得、応答縮小は情報削除になる |
| inspectExecutionPlan | Co objective/planの未保存の依頼/依存処理結果の受付。savePlanへの機械置換は保存時期を変えるため行わない |
| Selection検査2関数 | 外部受付には維持。Co内部で同じ検査済み・凍結済み値を比較/Hash計算前に再検査する経路は削減候補。各経路の由来確認が必要 |
| validateResourceBook | Co authorityのsameRecoveryRecordが、Co所有の認証回復Filesystem JSONを検査。独立した入力境界として維持する |
| Recovery ID/Host Token解析 | Coが構成要素を照合に利用。単なる真偽検査ではない。Host物理命名のOwner整理は別候補であり、検査を消して代替しない |
| Principal構築/検査 | Workbenchの主体構築とCo/MCP受付が利用。公開名/挙動は維持し、既存state/valueへ実体を移してdecisionから巨大なstate/validationへの逆参照を除く候補 |
| resumeRepairRecordSave | 中断したexact保存候補の完成操作として維持。通常保存へ自動resumeを加える案は採用しない |
| ExecutionStorageBlockedError・状態/契約/理由定数 | 部分Effect/回復参照やモデル語彙の正本を利用側が必要とする。一般blockedへの圧縮や語彙の重複定義で隠さない |

次の最小実装候補は、(1) Co内部のSelection再検査を受付済み値の受渡しへ整理、(2) Principal補助を既存state/valueへ移管、(3) 行単位の履歴検査とState全体の退役判断を分離、(4) Task/Objectiveの局所検査と全State候補生成の循環を関数単位で整理、(5) Co自身のDirectory初期化失敗をEM例外生成から分離、の順とする。これは実装済みの宣言ではない。特にCo runtime-dataのEM例外生成は責務是正候補だが、Effect・解放不明・回復参照は失わせない。新しいFacade・共通Package・一括移植は不要。先に内部の再検査と依存を整理し、その結果を見て公開削減を再判定する。

### 局所検査と全State候補の依存分離 — 着手前整合確認

基準fd877bfb9で成立済みの公開93項目、通常CRUD、履歴未確認時の退役拒否、単一Writer／CAS、同Owner観測・Effect／解放不明の搬送を維持する。変更分類は内部責務分離と利用側例外Ownerの是正。History行検査を保存非依存とし、全Stateを使う履歴候補3関数は唯一利用するHistory CRUDへ局所化する。Objective／Taskの全State候補生成は各モデルのoperationsへ分離し、局所validationから全State検査への実行時逆参照を撤去する。小さい値処理だけを既存state/operationsへ置き、Schema定数はtypesへ置く。Root非公開の新しいモデルoperationsは実処理のOwnerであり転送Facadeではない。

Coordinator自身のDirectory初期化失敗は同Ownerの型で搬送し、EM由来の例外は維持する。正常、参照中、CAS差、未確認履歴、Owner失効、部分Effect／解放不明を既存の限定試験で確認する。観測callbackは元の位置・回数で呼び、先読み・memoize・自動再試行を追加しない。Source移管で試験を削らず宣言参照・型Owner・台帳・設計を追従する。着手前の技術／試験影響確認は読み取り専用の2担当結果を統合済み。全体回帰・実AI・Docker・過去保持物・Release／準拠判定は対象外。責務整理の限定確認後、試験準備共有は別の変更単位で進める。

### 修復試験の残る準備共有 — 着手前整合確認

実施結果：69条件の登録名を一意にし、単件指定で1条件だけの実行成功を確認した。初回の限定75項目は72成功・3失敗で、前置Reader故障2条件の配送先が完成保存内部にしかなく、保持済み再入場1条件も廃止済みのgeneric history読取りを想定していた。製品Sourceを変更せず、前置repair_historyの専用一回故障と現在のrepair_completion前置／最終freshへ追従した。前置未観測の期限はfalse／null、fresh失敗では先行確認済み期限を保持し、Doctor出力を一致させた。本文保全・追加保存／技術取得／観測／日時生成0と故障発火1を10assert追加し、静的assert総数は498となった。是正影響の4条件が成功し、両独立再レビューの必須残指摘0。

最終改訂版で、69条件・factoryの3子と親・残存単発と取消guardの計75報告項目が全成功（164736ms）。各条件でjoin／Owner失効／Lock・pending不存在／自己生成保存領域回収を確認し、file終了hookの共有Root回収と不存在確認も成功した。Scope外の保持物は走査・操作していない。EM／Coの型検査、限定整形・警告確認と差分空白確認も成功。これは対象を限定した回帰であり、全体回帰・実AI・Docker・過去保持物の操作は実施しない。Commit／Pushは今回依頼に含まれず未実施。

責務分離の限定確認・独立レビュー完了後、runtime-repair-resultの非変異44条件とinterruptedRepairOutcome経由25条件を既存sharedRepairBaseへ接続する。不変Git Root／Revision／保存Identityだけを共有し、各故障条件のState／History／Owner／Abort／counterは新規にする。各条件をトップレベル個別登録へ揃え、同条件の初回→再入場は分割しない。切断点は毎回実Producerから作り、保存本文を条件間で共有しない。

Source変異の3群8条件は、同じ親内で正規／変異の二fixtureを比較する経路を含むため今回は専用Rootを維持する。正規と変異の差を消す共通Source cacheや、未清掃の同Root再利用は導入しない。実Git変更検出の別Owner試験も固定Revision投影へ置換しない。元のassert式・故障発火・実Reader／Writer／Lock／CAS・join・Owner失効・Lock／pending不存在と自己生成領域回収を保持し、共有対象だけの限定回帰と独立レビューを行う。全体回帰・実AI・Docker・過去保持物は対象外。

### 局所検査と全State候補の依存分離 — 実装と限定確認

後続のCommit／Push依頼に基づき、基準fd877bfb9からの新規2ファイルを含む50Pathを最終照合した。独立技術／品質確認の追加必須指摘0、局所検査・公開境界・履歴候補・Queue候補の限定29項目とEM／Co型検査が再成功した。Root indexの差分なし、旧所在地参照・Co自身のEM例外生成・局所validationから全Stateへの逆参照は残っていない。長時間の75項目は直前の成功証跡を使用し、全体回帰・実AI・Docker・過去保持物を再操作しない。本段階を現在のFeatureのCommit／Push対象とし、統合・Releaseや全体回帰完了とは扱わない。

追加の既存公開結果搬送1項目は、`public-operation.integration.test.ts`の「Runtime Data失敗を公開Orchestrator結果まで意味変更せず投影する」である。先の54項目に含む`current-admission.contract.test.ts`の「現在入場: 有限Domain結果と領域失敗を公開DTOへ投影する」とは別の試験であり、二重集計ではない。追加1項目も成功した。

独立技術／品質レビューは実装の必須指摘0。両者が確認したCo結果投影Headerの旧EM単型説明を、実装済みの二Ownerへ更新した。今回の責務分離は完了し、次の試験準備共有は別の固定候補で確認する。

直前の依存分離段階は、EMの値・候補・公開・独立ロード46試験、Coの初期化例外／公開結果／EI診断／計測入口5試験、既存入場DTO1試験、Core CRUDと履歴退役・再入場の実Store代表2試験が成功した。移管36関数の型除去後本文は、局所成功／拒否関数名と整形の末尾commaを除き基準版と同一。EM／Coの型検査も成功した。既存単発終端試験の成功＋清掃未確認の矛盾入力をunknownへ、既存EI group試験の旧Source切出し名を現在の実受付関数へ追従し、検査／assert条件は維持した。独立レビュー前の記録であり、準備共有の追加44条件等はまだ本段階に含めない。

### 同版履歴候補の導出と保存証拠の寿命 — 着手前整合確認

基準15db5dcの公開93項目・保存形式・単一Writer／CASを維持し、同じ同期呼出し内の履歴要約・行・Snapshot候補だけが同じ検査済みStateを使用するよう整理する。Stateは全体改訂・対象外保全・最終遷移検査、Historyは意味計算、Storageは物理出版とfresh照合を所有する。異なる排他区間、最終候補検査とWriterの再読取りは削減しない。Taskの例外時nullとRepairの例外伝播も維持する。新しいContext、cache、公開型、転送Wrapperは作らない。

Storageは分割せず、初期化・通常出版・再入場と三WeakMapの生成／一回消費／失効を説明する。historyAttemptsは同Ownerの再入場に必要であり各呼出しfinallyで消すものではない。resumeRepairRecordSaveは実体を持つ保存再入場操作としてStorageに維持する。現在設計の旧件数・未完了段階の説明を履歴参照へ整理する。技術とQAの読み取り専用着手前確認を統合済みで、限定値試験・代表保存二経路・型検査・独立レビューを実施する。全体回帰・実AI・Docker・過去保持物・採用／Release判定は対象外。

実装後の限定値10項目とEM型検査は成功した。既存混在fixtureを一回用い、Task／Repairそれぞれで導出decode一回と最終遷移検査一回、実候補本文同値、意味計算の例外差、元Buffer変更時の拒否を追加確認した。元の変異反証は新しい私有実体へ追従し、assert内容を維持する。新しい試験登録名・Root公開・保存形式・Writer処理は追加しない。

代表実保存は終了要約二段確定と修復履歴fresh出版の二親を選択し、子条件を含む30報告項目が成功（121739ms）した。元版・Owner・File・設定・部分保存・解放不明・種別差・対象外保全の反証を含み、自己生成Rootは既存終了hookでexact実体確認後に清掃し、ENOENTを確認した。過去保持物の走査・操作はしていない。全体回帰・実AI・Docker処置は未実施である。

独立技術レビューは必須指摘0。QAレビューの説明指摘2件を採用し、取得済みOwnerの出版と短命Contextの出版を分離、初期化証拠が準備・解放成功後は後続出版まで生存することを明記した。試験の動的namespace参照警告1件も静的選択へ是正し、限定10項目・EM型・整形・警告検査・差分空白確認が再成功した。途中の試験用VM接続不足・型不一致と、Repository Rootでの型検査指定ミスは製品不具合ではなく、修正／正しいPackage指定後の結果と区別する。是正後の両独立再レビューを完了し、必須残指摘は0。今回範囲の整理を完了とし、全体回帰・Release成立は主張しない。

後続のCommit／Push依頼で7Pathを再照合した。QAの新節が既存Checkpoint本文を包含しないよう見出し配置のみ是正し、独立最終確認の必須残指摘0。EM型・終了／履歴／codecの限定11項目・整形／警告／差分空白確認が成功した。Rootの差分はなく、製品Sourceが直前の実Store検証から不変のため30項目の証跡を使用して再走しない。全体回帰・実AI・Docker・過去保持物は操作せず、この候補を既存FeatureへのCommit／Push対象とする。

### 保存試験Sourceの不変準備共有 — 着手前整合確認

基準eb1e80f6bで成立した保存試験の判定本文・故障注入・Map同一性・Owner／State／保存領域の独立を維持し、tests/support/runtime-storage-source.tsの10Source読取り・型除去・export抽出と通常経路の未束縛VM factoryだけを共有する。Source変異は各呼出しで実施し、変異後factoryは共有しない。通常factoryは順序付き依存名と内部関数override名の署名ごとに保持し、値・fixture結果・Ownerを保持しない。各評価で製品Map初期化を実行し、現在の依存値を引数で渡す。新しい製品API・Fixture Manager・保存／回復機構は作らない。

変更分類は試験準備の限定改善。読取り専用の着手前技術確認で、global名override、未知依存名、getter順、変異／compile／評価失敗の伝播を既存と同じに保つ案を確認した。通常準備一回、同署名の値差、Map独立、変異交互・失敗後の通常評価を直接反証する。既存Checkpoint／公開境界・代表Core保存／修復履歴の限定回帰と独立レビューを実施し、全体回帰・実AI・Docker・過去保持物は対象外とする。

実装は固定10Sourceの読取り・型除去・export／通常宣言抽出を遅延一回へ変更した。通常factoryの署名は依存名と内部override名の順序付き配列であり、初回評価成功後だけ未束縛コードを登録する。各fixture評価でMapを生成し、依存値・Owner・状態・保存領域を保持しない。Source変異は元の例外Class除去前に毎回適用し、そのfactoryを保持しない。反証試験で読取り10回固定・同署名compile一回・WeakMap実体／Ownerキー非共有、override値差・未知名／global名・内部関数差、変異交互、transform／compile／評価／getter例外とgetter評価順、初回評価失敗後の再生成を確認した。

限定確認は準備共有1、Checkpoint3、公開／依存境界10、現在Reader1、終了Reader五故障の1、代表実保存34の計50報告項目が成功した。代表実保存はCore CRUD／CAS、初期化途中rename前後、終端保存の一回証拠、修復履歴の変異／途中失敗／fresh確認の四親を選択し、子条件を含む34項目が197749msで成功した。自己生成領域は既存の実体限定清掃hookが正常終了しENOENTを確認した。Case間の可変状態共有や、故障／保存手順の削減は行っていない。時間値は対象限定の実行結果であり、製品性能の改善や全体回帰成功ではない。

終了Readerの既存試験1親は、移管前のstate/crudでcompleteRecoveryを検索して開始失敗した。参照Pathだけを実Ownerのattempt/crudへ是正し、五故障・判定・assertを維持して成功した。Coreの既存四親の構文木本文は空白・末尾comma以外同一、新規親は一つだけ。準備共有試験を既存Symbol／Test CatalogへQA006・ERB-IT-014と補助Sourceのverifies・三事後条件として接続し、別の台帳項目は作らない。型・整形・警告検査・JSON登録接続・差分空白確認も成功した。

独立技術レビューと品質レビューは必須指摘なし。製品Source・Root公開93項目・保存形式・Lock／CAS・期限は不変。全体回帰・実AI・Docker・過去保持物は操作していない。今回範囲の準備共有を完了とする。

後続のCommit／Push依頼で9Pathを再照合した。準備共有・Checkpoint・終了Readerの限定5親、型・整形・警告・Symbol／QA／試験台帳の接続・差分空白確認が再成功した。製品Source差分0、試験補助／試験本文も直前の固定候補から不変のため、代表保存34報告項目は既存証跡を使用し再実行しない。独立最終確認の必須指摘0。この確認済み候補を既存FeatureのCommit／Push対象とし、全体回帰・実AI・Docker・過去保持物・実利用切替は対象外とする。

### State局所計算のOwner整理 — 着手前整合確認

基準89ee04ae6の公開93項目・保存形式・同版候補・単一Writer／CAS・例外／回復相関を維持し、全78関数の分類（構造支援5・同版整合60・局所計算13）に基づく六項目を一括実施する。StateのHash／Lease値6関数と検査を既存operationsへ、STORAGE_CONTRACTをtypesへ一体移管する。採用拒否判定はWorkspace、計画定義HashはObjective、資源差分検出はAttemptの局所Ownerへ移す。旧再export・別名alias・新File／Facadeは作らない。

履歴は要約byteのHash計算・固定Hash照合と固定行検査を既存History operationsへ集約し、Task／Repairの要約可能条件とsourcePayloadSha256の結合はStateに残す。Repairの転送Helperは既存byte生成へ統合し、欠測null・固定時刻・Taskのcatch／Repairの例外伝播を維持する。Hash対象のLF・ID・正規順、Lease内容参照、資源のexact ID／key、欠測・同値・全対象走査を変えない。実行時のWorkspace逆参照を先に切り、Objective operationsやHistoryから全State／Attempt検査へ戻る循環を作らない。着手前の読取り専用技術確認を反映済み。利用側・Source試験・台帳・説明を同時追従し、局所値／Module独立ロード・公開集合・遷移／混在・代表保存の限定回帰と独立レビューを行う。全体回帰・実AI・Docker・過去保持物は対象外。

#### State局所計算のOwner整理 — 実施と限定確認

六項目の移管と直接利用側の追従を完了した。移管10関数の本文と、移管対象外61関数の本文を基準版と比較し、空白・末尾カンマを除き一致した。Schema識別値も不変。WorkspaceからState全体検査への実行時逆参照とRepair固定行の転送Helperを撤去し、要約可能条件・元State Hashの結合・Writer／fresh照合は維持する。Root index差分0、新File／Facade追加0。Symbol安定IDを維持して検証対象を更新し、Architecture・QA定義・試験台帳を追従した。

限定検証は値・Lease候補・履歴・混在Snapshot・Codec／遷移・公開93項目・新品Nodeの独立ロードを含む8ファイル73試験、Workspace／Checkpointの追加2ファイル6試験が全成功した。代表実保存はCore CRUD／CAS、終了要約、修復履歴、Lease保存区画の4親32報告項目が全成功した（32には修復親と28子を含むため、親数や独立条件数と混同しない）。既存のケース別保存領域と終了清掃を使用した。EMとCoordinatorの型検査、変更TSの整形・警告検査も成功した。

独立技術レビューは必須指摘なし。品質レビューの履歴Snapshot更新に関する説明コメント1点は、履歴相関と改訂・previousを更新する実装に合わせて是正した。実装・検証内容への指摘はない。全体回帰・実AI・Docker・過去保持物は操作していない。この限定範囲の完了を全体品質・実利用切替・Release成立へ拡大しない。

コミット前の再確認では、29Pathの差分・移管先参照・Symbol／試験台帳・説明の一致と、Root index差分0・新File追加0・差分空白問題0を確認した。限定73試験、EM／Coordinator型検査、変更TSの整形・警告検査が再成功し、独立最終QA確認の必須指摘は0。製品・試験本文は直前の検証済み候補から不変のため、追加6試験と代表実保存32報告項目は既存結果を使用し再実行しない。今回の確認済み差分を既存Featureへコミット・プッシュする。全体回帰・実AI・Docker・過去保持物は対象外。

### 受付済み値の重複検査整理 — 着手前整合確認

基準f97a99238で公開補助三系統の利用先を再照合した。DecisionはCo応答からMCPへの未信頼搬送、Plan／Selectionは未保存の依存返却・実行準備、資源BookはCo所有のHost認証回復記録にも独立した受付がある。検査コピー、検査専用CRUD overload、先行保存、記録Ownerの無断移管で公開数だけを減らさない。人間が承認した限定方針として、公開93項目と保存形式・認可・失敗／回復契約を維持し、同じ受付内の重複だけを整理する。

資源更新二関数は次Bookの検査を既存遷移検査の先頭へ一意化し、previous検査・相関・例外は維持する。Co二役選定は検査済みの同じ凍結設定を既存File内の私有選定本体へ渡し、外部要求検査・各AD適合・片側失敗拒否を残す。Coの私有受付実行は、依存が受付済みrequest.planとexact参照一致の値を返す場合だけ再利用し、別参照・不正返却値は元の検査を通す。Decisionの搬送検査とHost認証Storeの記録方式は変更しない。新File／Facade・brand・Map・永続fieldは追加しない。

技術的な着手前独立確認で三点の同値条件と反証を照合した。局所の不正Book・設定一回／役割別検査・exact Planと別参照・範囲外・getter／Proxy・依存例外を確認し、既存の選定・受付・資源更新・搬送契約に絞って回帰する。差分と必要な文書・Symbol／QA台帳を再照合し、固定候補の技術・品質独立レビューを行う。全体回帰・実AI・Docker・過去保持物は操作しない。標準の規範・準拠基準・リリースを変えないため、準拠監査や実環境E2Eは今回実施しない。

#### 受付済み値の重複検査整理 — 実施と限定確認

三点を実装し、Decisionの搬送検査と未保存／外部選定の独立した検査は維持した。公開Rootの差分0・公開93項目・保存形式・既存のEffect順序は不変。追加File・Facade・互換処理なし。既存3試験Fileに三つの親試験を追加し、元のassertionは削除していない。Architecture二正本、QA-000001／003／006、既存Catalogの事後条件、Objective受付試験のSymbol検証関係を追従した。

Coの選定・Objective搬送・Task搬送・助言選定／Dispatchの5File24試験、EMのBook・終端遷移・公開境界の3File31試験が全成功した。Coの既存Objective受付ITは範囲外計画と閉入力拒否の2親だけを実行し、Project保存／Task Effect 0、今回生成Rootの終了清掃が成功した。合計57試験は今回の限定選択であり、全正常保存や全体回帰の成功ではない。EM・Coの型検査と変更TSの整形・警告検査も成功した。

独立技術レビューと独立QA／文書レビューの必須指摘は0。資源の次値検査・元値の拒否、設定捕捉一回と役割別AD検査、exact Planと別参照／不正返却の区別を確認した。新しい保存・Authority・自動回復は追加せず、全体回帰・実AI・Docker・過去保持物は操作していない。今回はコミット・プッシュを行わず、変更済み候補として保持する。

後続のコミット・プッシュ依頼に対し、15Pathの実装・試験・QA・台帳・説明とRoot差分0を再照合した。限定55試験（Co24・EM31）、両型検査、変更TSの整形・警告検査が再成功し、独立最終確認の必須指摘は0。実装・試験本文は前回確認済み候補から不変のため、受付IT2親は既存結果を使用し再実行しない。この確認済み候補を既存Featureへコミット・プッシュする。全体回帰・実AI・Docker・過去保持物は対象外。

### 共通値処理と履歴候補の所有境界 — 着手前整合確認

基準c3835fd8aのLogical Block俯瞰で、State内の単独モデル専用六HelperとStorageの履歴追記候補生成を是正対象とした。公開93項目・保存形式・I/O順・失敗／再入場契約は維持する。Task専用四Helperは既存task/validationへ集め、同一文法のnullable三処理は私有nullableTaskReferenceへ統合する。validResultReferenceだけTask operationsから直接使う。History専用closedObject／timestampは既存history/validationの私有関数とする。新File・Facade・共通Package・互換exportは追加しない。

updateHistoryOwnedの現行行decode・未来拒否、Task入力解析／行追加、Decision投影／追加、同ID衝突・重複判定、追記byte組立を既存history/validationのprepareHistoryAppendへ移す。同Fileはモデル別の行検査と入力からの候補生成を所有し、History operationsへDecoderの逆参照を追加しない。追加なしは同じbefore Buffer、行順・元byte・例外は維持する。StorageはOwner・時刻／mode受付、resume_decisionのpending不存在早期終了、State同版結合・保持、pending実体・fresh確認・flush／rename／回収を元の位置と順序に残す。保存境界の再検証を局所重複とみなして撤去しない。

独立した着手前技術確認で依存と失敗順を照合した。六Helperの元受理域・呼出し元、既存／新規行の破損・未来時刻、Task／Decision重複・衝突・混在順序、追加なしの参照、不正JSONの例外、StoreでのEffect前停止と保存故障後の再入場を限定検証する。型・公開集合・新品Nodeロード・既存のTask／History／Decision試験と代表実保存を必要範囲だけ選び、文書・Symbol／QA台帳と独立技術・品質レビューを追従する。全体回帰・実AI・Docker・過去保持物は操作しない。規範・準拠・Release判断は変更せず、準拠監査と実環境E2Eは対象外とする。

#### 共通値処理と履歴候補の所有境界 — 実施と限定確認

State専用六Helperを撤去し、Taskの三nullable参照は私有一関数へ統合、必須参照検査はTask validationへ移管した。HistoryのObject／時刻検査は私有化し、履歴追記候補は既存History validationへ実体移管した。旧Helper名の転送・再export・新File／Facade・Root変更はない。公開93項目・保存形式・時刻／mode／Owner受付・保持・pendingと物理出版の順序を維持する。Task／Historyの旧三本文と、候補生成の委譲部分を除くupdateHistoryOwned本体が基準版と一致することを、空白・末尾カンマを除いて照合した。30Sourceの静的実行時importに循環はない。

既存8FileのTask参照・Queue候補・保存codec・Decision・History・公開集合・新品Node境界の限定65試験が全成功した。追加はTask文法と履歴候補の2親で、元assertionは削除していない。既存runtime-historyは指定した再搬送／衝突・pending正常二状態・pending不整合・破損／時計・fsync／renameの5親だけを実行し、全成功した。Coの既存continuation-decision ITは継続要求から適用・履歴再入場までの代表1親だけを実行して成功した。計71試験は今回の限定集合であり、全体回帰・実AI・Dockerの成立ではない。今回生成したRepositoryは既存終了hookの回収確認まで成功し、過去保持物は操作していない。

EMとCoの型検査、変更TSの整形・警告検査が成功した。初回整形はWindowsの一時的なFile共有エラーで2試験Fileを書けず、該当2Fileだけの再実行で整形と警告検査が成功した。試験失敗はない。Architectureの所有範囲、QA003／006、既存Symbolの検証関係とCatalogの事後条件を更新した。独立技術レビューと独立QA／文書レビューの必須残指摘は0。Stateは共通Helper置場ではなく保存値契約に限定し、Storageはモデル判定と物理保存証拠を結合するという境界を明記した。今回差分は未コミットで、全体回帰・実AI・Docker・過去保持物は対象外とする。

コミット前の再確認では14Pathの対応、旧Helper参照の撤去、公開Root差分0・新File追加0・差分空白問題0を再照合した。限定65試験・EM／Co型検査・変更TSの整形／警告検査が再成功し、独立最終QA確認の必須指摘は0。実装と試験の機能は前回固定候補から不変のため、実保存5親・Co継続判断1親は既存結果を使用して再実行しない。この確認済み候補を既存Featureへコミット・プッシュする。全体回帰・実AI・Docker・過去保持物は対象外。

### 最終Logicalレビュー後の試験Ownerと現行設計 — 着手前整合確認

基準48ea92d65で製品30Source・実行時静的117参照に循環はなく、公開93項目のうち92は本番直接利用、queryQueueは採用済みの認可付き通常CRUDとして維持する。残るDI／EM対照2親を調査したところ、回復ID親はRootだけでCoへ移管できるが、Checkpoint親の逐次内部decoder比較はRoot限定境界を破る。人間が承認した分解に従い、EM・DI各Ownerで独立DTO／profile別literal受理表を使って全field変異母集団・凍結・独立参照・hook未評価を保持し、Coは実技術通知から既存公開保存・読取りまでを接続する。直接比較を迂回Adapter・深import例外・新Root公開で復活させない。

元の4profile・全fieldパス・欠測／余剰／15置換値・getter／Proxyの対応を照合し、受理表は製品decoderの実行結果から生成しない。正常通知の遷移・終端・Session準備と廃棄不正遷移は各Ownerの期待値で反証する。回復ID親は全拒否例・exact三成分をCoへそのまま移す。EMの実保存・CAS・Owner・履歴・部分故障親は残す。DI変更はこの試験Owner整理に必要な試験・台帳・説明だけで、DI製品Sourceは変更しない。

独立した着手前技術確認で、機械的移動では成立しない境界と分解後の検証責務を照合した。既存Fileと試験fixtureだけを使い、新共通Package・Facade・製品APIを作らない。限定の値／Root境界・型と既存Co公開保存の代表成功／保持2ケースを実行し、旧観点と新Ownerの全数対応を確認してから旧対照親・DI importを撤去する。Architectureは現行モデル・契約・責務・保存・失敗境界中心へ整理し、移管経緯・旧公開数は本CHGへ寄せ、既存anchorと詳細文書参照を維持する。技術／品質・文書の独立レビューを行い、全体回帰・実AI・Docker・過去保持物は操作しない。準拠・Release判断は対象外。

### Principal値Ownerと捕捉済みSelection — 着手前整合確認

実施結果：主体ID2関数と固定prefixを保存非依存の`state/operations.ts`へまとめ、旧`value.ts`を撤去した。公開93項目と保存文法は維持。全Source／試験／現在設計の旧Path参照は0で、Symbolの安定IDを変えず現行Pathを更新した。EM・Coordinatorの型検査と、値／公開境界／独立ロード／選定／単発受付の限定38試験が成功した。改名前にも選定更新2試験とローカル主体2試験の成功を確認したが、改名後38件の内訳には合算しない。独立の技術レビューは必須指摘なし、QAレビューの説明見出し配置1点は専用節へ分離して是正した。改名に伴うimport折返し2箇所も整形した。全体回帰・実AI・Docker・過去保持物の操作は行っていない。

後続の名称判断で、値処理を細分化せず既存`state/value.ts`を`state/operations.ts`へ改名する。CRUDは保存操作、validationは全Stateの成立・相関検査、operationsは保存しない主体ID・記録値の構築・捕捉・変換を担当する。公開名・処理本文・保存形式・依存方向は変えない。全Source／試験の直接参照、Symbol台帳の現行Path、現在設計を追従し、旧Pathの転送Moduleや新しいHelperファイルは追加しない。過去段階を説明する本文の旧Pathは当時の記録として維持する。限定の値・公開境界・Module独立ロードと型検査で確認し、全体回帰・実AI・Docker・過去保持物は対象外とする。

基準ad386d473と直前の試験準備共有差分を保全し、公開名・挙動・93項目を変えずPrincipal構築/検査を既存state/valueへ移す。固定prefixも値Owner内の私有定数へ閉じ、旧位置の転送exportは残さない。decisionとtaskの局所検査は同じ値Ownerを直接使用し、Decisionの単独読込みが全State/保存を解決しないことを新品Nodeで確認する。保存形式・既存メール/主体の文法・認可の意味は変更しない。

Selectionは読み取り専用の呼出し元照合で、controllerのsameProviderSelection左側を初回の検査済み凍結値へ接続することと、openTaskSession内の本番execute callbackが同じ受付記録の選定を再検査する箇所だけを対象に確定した。右側の再発行結果、Resolver/実行依存の返却値、Filesystem/搬送入力、汎用Hash入口は検査を維持する。Hashの正規順をJSON.stringify直呼びで置換しない。新brand・Map・Wrapperは追加しない。

正常同値/別Object/キー順差、不正再発行・Provider/Model差、初回生Recordの途中変更、失効/Effect未発行、外部Resolver不正時の保存/実行0と、同じ捕捉済み値の実行搬送を限定検証する。親のSource照合と独立した着手前技術確認を実施し、追加の人間判断は不要とした。変更分類は値Owner分離と内部受渡しの局所是正。既存QAのModule境界/選定/受付試験へ追従し、型・限定回帰・独立レビューを行う。全体回帰・実AI・Docker・過去保持物操作は対象外。

### 最終Logicalレビュー後の試験Owner整理 — 実装と限定結果

基準48ea92d65から製品Source・Root93項目・保存形式は変更せず、EM／DI／Coordinatorの既存三Suiteだけを変更した。旧「技術checkpointと保存受理」の親はEMの独立受理表・八処置遷移、DIの独立受理表・Machine通知へ分解した。初期／継続／廃棄／対象の4profile・全field・欠測・余剰・15置換値・getter／Proxyの2,799入力を両Ownerで保持する。profile／field path／変異のキー列SHA-256は`e9026a98858c8e37c2b5ad75758fe1e47ff780bed21b6785acc84269008ab30c`。入力キーの一致は受理結果一致の証明ではなく、各Ownerの固定DTOと受理表を別に照合する。

初回は継続profileのretain_runtime結果をunknownへ戻せるという期待値が両試験で失敗した。後続start_runtime保存済みには先行処置の確定が必要なため、試験の受理表だけを修正した。製品の拒否条件は変更していない。再実行でEMの2親、DIの2親が成功した。回復IDの三成分比較は元の親と反証入力をCoordinatorへそのまま移して成功。Coordinator既存の公開saveRepairRecord接続は確認済みoperation.checkpointと元通知のexact一致を追加し、retained=false／trueの代表2親が実保存・読戻し・Lock／CASを通して成功した（約9秒）。初回の同2親は実行結果出力を取得できず成功証跡に数えず、Node Process終了確認後の再実行結果のみを採用した。

EM／DI／Coの型検査、変更TSの整形・警告検査は成功（Coの既存info 26件はwarningではなく、今回変更していない）。後続のEM公開／依存境界16項目とEM no-op／DI通常処置各1親も成功し、今回の独立した選択試験は合計25項目となる。繰返し実行を件数へ合算しない。既存全故障親・全体回帰・実AI・Docker・過去保持物は実行していない。現行Architectureはモデル→Logical Block→公開契約→保存境界→検証の順へ再構成し、以下へ基準版の説明全文を履歴として保存した。以下の公開数推移・旧入口・段階別状態は当時の比較資料であり、現行の正本や新しい実装指示ではない。

固定候補の独立技術レビューは必須指摘0、QAレビューは見出し再構成に伴うリンク追従漏れ1系統3箇所。両レビューへ最小是正案を再提示して整合を確認し、台帳2箇所は現Checkerが確認できる現行見出し、旧API詳細の公開境界参照は明示アンカーへ追従した。旧アンカーの現役参照0と現在の到達を確認した。台帳検査は今回のリンク不整合2件を解消し、`windows_process_restricted_profile_missing:40_Develop/workbench-server/tests/integration/recovery-http-owner.integration.test.ts`だけが残った。同entryが基準HEADと完全一致することを確認し、今回無関係な登録不整合として未解消を報告する。Checkerや保護条件は変更していない。リンク是正後の独立技術・QA再確認はともに必須残指摘0。最終の変更TS3Fileの整形・warning検査、変更JSON構文、diff空白検査も成功し、製品Source差分0を確認した。JSON台帳は既存Biome設定の対象外のため構文と専用台帳検査で確認し、未実施の整形成功を主張しない。

追加承認後の台帳是正（2026-11-15）：上記のWorkbench登録不整合を解消した。着手前に元試験のHost Windows宣言と共有本体、現CheckerがWindows用Profileとrestricted_processの両登録を要求する規則を照合した。一意な登録追従として該当entryのexecutionProfilesへrestricted_processを1行追加し、試験本体・Checker・製品API・安全判定は不変更。台帳418項目の整合検査はvalid・testExecution=not_started・effectIssued=false、実行Profileのexact照合とHost Windows検出の限定2試験も成功した。台帳の読取り検査は全体回帰ではなく、WorkbenchのHost統合試験自体は再実行していない。差分・既存レビュー指摘・現役リンクと禁止範囲を再確認してから、今回までの11ファイルをCommit／Pushする。追加差分の独立QA確認は必須残指摘0。Commit前のdiff空白検査も成功し、製品Source差分0と対象11ファイルを再確認した。

### 局所保存試験の不変コード準備 — 着手前整合確認

基準c2373d950で成立済みの公開93項目・保存形式と、開始／終端／履歴保存の既存反証を維持する。対象は既存runtime-transitionsとhistory-retention-boundaryの2試験Fileだけ。開始保存・終端準備・受理後例外・六条件の終端候補・初回Hostの依存欠測・十四条件の履歴完成保存について、同じSource宣言と未束縛factoryの組立てを条件ループ外へ移す。依存値の注入、関数生成、WeakMap、Owner、入力参照、counter、故障条件は各Caseで生成し、変異Sourceは別コードとして毎回の検証を維持する。新File・汎用Cache・Fixture Manager・製品APIは追加しない。

これは試験内部の不変準備の局所改善であり、受付条件・認可・保存順・正式QA結果は変更しない。上記六箇所を編集単位として元のscenario集合・assert・依存値の位置を照合する。親が現行の値／保存境界と計画を照合し、不足する仕様判断はない。変更TSの静的検査、当該試験親に限定した回帰、試験独立性の独立技術・QAレビューを行う。規範・準拠・Release判断や実資源を変更しないため全体監査・実境界E2Eは行わず、全体回帰・実AI・Docker・過去保持物は操作しない。

#### 局所保存試験の不変コード準備 — 実装と限定結果

上記六箇所の未束縛factoryをループ外へ移し、依存値を渡して関数を作る位置は各条件内に維持した。終端準備のWeakMapはfactory呼出し内で毎回生成し、終了候補の六条件も入力・Owner・保存counterを共有しない。初期Hostの依存欠測は通常のfactoryだけを再利用し、本文比較省略／再起動guardの変異は従来どおり別コードで評価する。新File・Cache・Wrapperは追加せず、製品Source・Root93項目・保存契約・既存scenario／assertは不変更。実行条件を展開した同一コードのコンパイル箇所は37回相当から6回相当へ減る構造だが、製品性能や全試験時間の改善値としては扱わない。

変更TS2Fileの型検査・整形・warning検査が成功。対象六箇所の限定11試験（開始・準備・受理後例外の3親、終端六条件、初期Host1親、履歴十四条件1親）も成功した。試験登録ID・検証義務・条件集合は同じため、新Suiteや正式結果を追加しない。独立技術・QAレビューはともに必須残指摘0。assert呼出し列は変更前と同じ441件／51件であり、具体的な引数・入力母集団・変異と可変閉包の独立は差分レビューで確認した。単なる件数一致だけを検証不変の根拠にはしない。diff空白検査と製品Source差分0も確認した。全体回帰・実AI・Docker・過去保持物は操作していない。

別途発見した残件：history-retention-boundaryのconsumer関数はCoordinatorのexecution/persistence.tsの二宣言を読み取って局所評価している。これは準備共有とは別の試験Owner問題であり、対象試験を削らず上位Ownerへ移す必要がある。今回この既存経路をCache化・改変せず、EM全体の試験依存解消済みとは表示しない。次のOwner整理で当該consumerを使う既存試験と引渡し先を照合する。

### 保持設定の上位搬送試験のOwner移管 — 着手前整合確認

人間の追加承認により、EMのhistory-retention-boundaryに残るconsumer補助と3試験をCoordinatorへ移す。元の通常非再観測、同値default／file、初期不正、途中変更・不正化・例外、Owner呼出し回数の観点を維持する。EM内部readHistoryRetentionDaysの外部importは作らず、Coが生成する日数とrevalidateへの期待日数搬送を新Ownerで直接確認し、日数null／不正値の早期拒否とcallback未呼出しはEMの既存「保持値の意味検査」に残す。新たな検査実装・Wrapper・製品APIは追加しない。

移管先はCoordinatorの専用UT一Fileとし、自己Sourceの宣言だけを一回準備、設定Reader・Owner・counterは各試験で独立させる。Policy／HistoryInputの局所型も同時移管し、EM試験のCo Source参照とSymbolの上位verifiesを撤去する。既存PRL-UT-006／QA-000003を維持して新所在のSuiteを台帳へ登録し、EM側の残る固有検査と対応付ける。親は現Owner・入力由来・Root限定境界と計画を照合済み。変更分類は試験Owner是正、保存形式・Scope・決定権限・実Effectは不変更であり、規範／準拠監査や実境界試験は追加しない。型・静的確認、移管3親と残るEMの直接関係親だけの限定回帰、独立技術／QAレビューを実施し、全体回帰・実AI・Docker・過去保持物は操作しない。

#### 保持設定の上位搬送試験のOwner移管 — 実装と限定結果

Coordinatorのtests/unit/storage/history-retention.contract.test.tsへconsumer補助・局所型・既存3親を移した。自己のpersistence宣言を一回compileし、Readerと可変状態は親ごとに生成する。Coは生成日数とrevalidate(30)の結果・読取り回数・通常呼出し・元Owner回数・元例外を直接確認する。旧readHistoryRetentionDays経由のnull拒否とcallback未呼出しはEM既存の不正日数母集団（nullを含む）へ残す。初期不正のCo試験では元の「通常再検証だけでは設定を読まない」を維持し、明示した履歴再検証がfalseとなることと元Ownerの追加一回を確認する。検査関数の複製や下位内部importは追加していない。

EMは該当補助・局所型・3親とCo Source参照を撤去し、残る4親とEM自身の保持値・Writer制御を維持する。Symbolの上位verifiesを新Ownerへ移し、QA-000003／PRL-UT-006は維持して試験台帳にCoordinator Suite一件を追加した。台帳全419 Suiteの整合検査はvalid・testExecution=not_started・effectIssued=falseであり、全419試験を起動した意味ではない。移管Co3親／残るEM4親とEMの公開・直接依存境界2項目の限定計9試験、両Packageの型検査、変更試験の整形・warning検査が成功した。独立技術・QAレビューはともに必須残指摘0。変更JSON構文・diff空白検査、対象EM FileのCo Source参照0も確認した。EM試験全体に残るCo Path文字列はstorage-consumer-closureの読取り専用配置監査であり、Co宣言の実行や上位処理への依存とは区別する。製品Source・Root93項目・保存形式は不変更。全体回帰・実AI・Docker・過去保持物は操作していない。

Commit前再確認：準備共有とOwner移管を合わせた対象10ファイルを再照合し、製品Source差分0・新Co試験の登録・旧観点の分担・EMの上位宣言実行依存撤去を確認した。両Packageの型・変更3試験Fileの整形／warning、台帳419項目の整合と限定19試験（EM16／Co3）が再成功した。先行11件と移管9件の重複する履歴親は合算していない。独立最終QA確認は必須残指摘0。この確認済み候補を既存FeatureへCommit／Pushし、全体回帰・実AI・Docker・過去保持物の操作は行わない。

### State・Taskの純粋候補と観測調停 — 着手前整合確認

基準938d704ffで成立済みの公開93項目・保存Schema・候補本文・単一Writer／CASと、観測不能時の拒否・元回復参照を維持する。67関数の分類から、Lease九用途とRoot観測、assertSnapshotTransitionと三つの閉鎖／退役判定を既存state/crudへ実体移管する。純粋なLease三用途も専用処置familyとしてまとめ、validationからCRUDへ戻るimport・旧位置の再exportは残さない。Task operationsの全State組込四関数はstate/validationへ移し、Taskの残る九操作・投影は既存task/crudへ統合、旧operationsを撤去する。結果封筒の二組の局所constructorも元field・freeze・既定値のまま専用名で移し、Storageの広い戻り値型へ置換しない。

編集単位は宣言名と直接参照で固定し、先に実体・型と利用側を一括対応、次に試験Source組立・Symbol／台帳・現行文書を追従する。新File・Facade・Runner・検査専用callbackは追加しない。StorageはStateの候補生成を元と同じ位置で呼び、fresh元本文・期待候補のexact比較・CASを維持する。単にimportを減らすための再検証撤去や観測の先取りをしない。

親の正本・宣言・参照照合と、読み取り専用の技術／QA着手前確認を統合した。Task型のParameters／ReturnTypeは宣言元へ追従し型だけの参照をruntime依存にしない。Lease9親、Queue4＋実行候補8親、History候補5親、局所独立ロード・公開境界、共通Source準備、代表Core保存／履歴保守／保存区画故障に限定して確認する。局所validationのCRUD／Storage解決拒否は緩めない。変更分類は内部責務と依存方向の是正であり、規範・決定権限・保存方式・Release判断を変えないため全監査や全体E2Eは追加しない。限定回帰・独立技術／QAレビューを行い、全体回帰・実AI・Docker・過去保持物は操作しない。

#### State・Taskの純粋候補と観測調停 — 実装と限定確認

Lease九用途・Root観測・全Stateの更新時調停と三つの閉鎖／退役判定の計14関数をstate/crudへ移した。候補封筒二関数もcompletedLeaseCandidate／blockedLeaseCandidateへ明示改名して同じOwnerに保持する。Taskの全State組込四関数はstate/validationへ、Task九操作／投影と専用封筒二関数はtask/crudへ移し、task/operations.tsを撤去した。新しい製品File・Facade・Wrapperはない。移管本文31宣言は専用constructor名と整形上の空白／末尾commaを除き基準版と一致する。元のfield・freeze・既定値・例外と観測順の維持は型／回帰／レビューで別に確認し、正規化比較だけを保証根拠にしない。

State validationは67関数から55関数へ、製品Sourceは30から29へ変わった。Runtime importの静的走査では29File・91辺・循環0。Storageの候補期待本文・Task投影の参照先だけをStateへ追従し、呼出し位置・fresh元本文・exact比較・再観測・CAS・物理出版は変更していない。Root93項目・保存形式・正式QA項目は不変更。旧Sourceの現在参照とSymbolを撤去し、既存の安定Symbolは現OwnerのPath／verifiesへ追従した。試験台帳は419項目valid・起動なしであり、全419試験の実行ではない。

初回の限定42項目は41成功・履歴候補のadoption-only一親がVM依存欠測で失敗した。候補の実Sourceが利用するWorkspaceのadoptionWasRejectedを試験用依存へ明示的に束縛し、製品規則やOracleを変更せず同Suite5親が成功した。Lease9・Queue4＋実行8・局所ロード／公開16の元成功は別に保持する。追加で移管した全State組込を使うcodec／遷移2親、Decision17親が成功。代表の実Store通常CRUD／認可／CAS、Source不変準備、履歴通常保守／再入場、保存区画／二世代拒否の4親も成功した（約41秒）。自己生成の試験領域は既存の限定清掃で終了し、過去保持物を操作しない。EM／Coordinator型検査と変更TSの整形・warning・diff空白検査が成功した。是正後の42項目一括再確認も全成功し、codec／遷移2・Decision17・代表実保存4と合わせた限定65項目が成功した。反復実行を件数へ合算しない。独立技術レビューは必須指摘0、QAのSymbol Path追従漏れ2箇所は両者へ統合是正案を提示して整合確認後に修正した。Lease／State CRUDの安定IDを維持してPathだけをstate/crudへ追従し、値遷移はvalidationに残した。Path実在・旧参照0・JSON・台帳419項目の整合と、独立技術／QA再確認で必須残指摘0を確認した。全体回帰・実AI・Dockerは実施していない。

Commit前の再確認：対象23ファイルを再照合し、Root差分0、旧Task operationsの実参照・転送入口0、Symbolの現Owner Pathと実在を確認した。EM／Coordinator型・変更TS17ファイルの整形／warning・台帳419項目の整合・diff空白検査が再成功した。Lease／Queue／History候補・公開／独立ロード42項目と、codec／遷移・不変Source準備3項目の計45項目が再成功。実装と試験が固定候補から不変のDecision17項目・代表実保存3親は既存成功を使用し、反復実行や先の65件へ重複加算しない。独立最終QA確認の必須残指摘0。この候補を既存FeatureへCommit／Pushする。全体回帰・実AI・Docker・過去保持物は操作していない。

### Leaseの変更単位分離 — 着手前整合確認

基準8cf60172cから、Leaseの公開四操作・候補九関数・Root観測・専用結果constructor二関数をstate/lease.tsへまとめる。既存withSnapshotOperationだけを通常State CRUDへの接続として使い、CRUDからLeaseへの逆import／再exportは追加しない。新File一つは独立したLeaseの変更単位であり、共通Package・Manager・汎用Lifecycleは作らない。Rootは新しい宣言元から公開し、93項目・overload・型推論・保存Schema・Scope・Lease Identity／世代・回復IDは維持する。

親は現行16関数と共有関数・排他区間・上位参照を照合し、独立した着手前技術確認を統合した。編集単位は16宣言（四操作のoverloadを含む）と直接参照、次にSource組立と台帳／文書で固定する。観測・通知は元位置、短期排他の取得→fresh読取り→候補→保存→解放も既存経路を保持する。Source準備は同じ閉包にLeaseを一回追加し、固定一覧と読取り数を10から11へ追従する。値・Map・Owner・保存領域の共有は追加しない。型／静的検査、Lease九親・公開／独立ロード、Source準備と既存代表実保存の必要subset、独立技術／QAレビューで確認する。規範・保存方式・権限・Release判断は変更しないため全体監査や実境界E2Eは追加しない。全体回帰・実AI・Docker・過去保持物は操作しない。

#### Leaseの変更単位分離 — 実装と限定結果

state/lease.tsへ16実装と九つのoverload宣言を移し、通常State CRUDには共通の排他内更新と横断調停を残した。元実装／署名は整形上の空白・末尾commaを除き基準版と一致する。Rootの四操作は新宣言元を直接参照し、旧位置のWrapperや再exportはない。型の宣言参照・Lease候補試験と安定SymbolのPath、既存Core試験の確認先、Architecture／QAを追従した。固定Source組立はLeaseを一回追加した11Fileとし、読取り11回・同署名factory一回・Map／Owner独立・override／変異／失敗後再生成の反証を維持する。初回warningで発見した未使用completed import一件は撤去し、その後の静的確認は成功した。

Lease9・公開／独立ロード16の25項目と、代表実Store CRUD／認可／CAS、Source準備、不正RootのEffect前拒否、保存区画／二世代拒否の4親、計29項目が成功した。代表4親は約36秒で終了し、自己生成のRootは既存の対象限定清掃を使用した。過去保持物には触れていない。EM／Coordinator型検査・変更TSの整形／warning・diff空白検査、台帳419項目の整合が成功した。公開93項目・保存形式・Lock Identity・観測／通知順とCASは不変更。静的Runtime import graphは30File・95辺・循環0で、Lease→State CRUDは既存withSnapshotOperationへの一方向だけ。逆参照はない。独立技術レビューは必須指摘0、QAの現行文書追従2箇所（QA006の固定Source数と詳細05のLease／証拠値Owner）は、両レビューへ統合案を提示して整合確認後に是正した。現役旧文言0・diff空白・台帳419項目の整合を再確認し、技術／QA再レビューの必須残指摘0を確認した。文書だけの是正のため実保存試験は再実行していない。全体回帰・実AI・Dockerは実施していない。

Lease分離のCommit前再確認：新Fileを含む14ファイルを対象に、旧所在地のWrapper・逆参照0、Root93項目、型・overload、Symbol Pathと実在、現役の11Source記述を照合した。EM／Coordinator型・変更TS7ファイルの整形／warning・台帳419項目の整合・diff空白検査が再成功し、Lease9／公開・独立ロード16／Source準備1の限定26項目も再成功した。実装・試験が固定候補から不変の代表実保存3親は既存成功を使用し、再実行・件数重複加算はしない。独立最終QA確認の必須残指摘0。この候補を既存FeatureへCommit／Pushし、全体回帰・実AI・Docker・過去保持物は操作しない。

<details>
<summary>基準48ea92d65のArchitecture本文（移管経緯を含む履歴）</summary>

### 実行モデルの責務と単一保存契約

成果物種別: Architecture詳細設計
状態: 完成操作への公開再編と今回範囲の限定回帰・独立再レビュー完了（全体回帰未実施。過去試験物の一部は由来再確定待ち）
担当責任者: Qual-Lab
最終更新日: 2026-11-14

#### 独立ロード検証の所有 — 2026-11-14

EM自身の公開RootがDIなしで開始できることは、EMの既存package-boundary ITが確認する。DI側の相互ロード試験からモデル側の一枝を移し、子のerror・signal・exit・固定markerの四観測を維持する。先行するAD／DIなしの公開理由集合検証とは別の旧反例として保持し、保存・Parser・技術処置は呼ばない。DIは上位を解決できない条件で自身のRootだけを確認する。試験の移管によって公開IFや保存Schemaを変更しない。

<a id="model-boundary"></a>
#### 1. 責務と依存

実行モデル（execution-model）はObjective／Task／Attempt／Queue／Workspace、Blocker・提案回答、State／History、回復記録と局所遷移・保存を所有する。Scheduling・再試行判断はCoordinator、単一技術実行はExecutor、Provider計画・解析はAI Adapter、Docker実体はDIが所有する。

3モデル間の実装・型・再export・deep import・dynamic import・package直接依存は0とする。実行モデルは設定を探索・再選定せず、構成モデルのReaderや型を受け取らない。必要なVC／Lock／Node.jsを使用し、保存契約はEM自身が定義する。旧domain-modelの互換Facadeを残さない。

`ExecutionSelection`の技術選定五項目、`OperationResources.snapshot`の非秘密資源情報、一次失敗の`turnCountDiagnostic`はEM所有の保存型とする。ADのModel選定型・診断型、DIのResourceSnapshotをEM Sourceから直接import又は型参照しない。元のProperty・閉じた値域・optional性・null許容・readonly性と既存保存検査は維持する。型の所有権変更だけを理由に保存Schemaや実行時コピー・変換Wrapperを追加しない。storageの終端観測も同じ`OperationResources["snapshot"]`を参照する。

技術型と保存型の現在の双方向構造適合はCoordinatorの既存selection-consumers Suiteで型検査し、片側の項目欠落・値域拡大・optional性・readonly性の差を検出する。これは値の認可・技術実行・永続化成功の証拠ではない。EM単独のBook値試験はEMの保存型を使い、AD／DIを必要としない。EM内に残るDI技術処理を含む連携試験のOwner移管は[変更計画§14.33–14.34](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で別途追跡し、この型整理だけでPackage全体の依存解消を完了とは表示しない。

<a id="public-api"></a>
#### 2. 公開入口と確定入力

`40_Develop/execution-model/src/index.ts`は、本番利用が必要とする完成操作と値契約を明示公開する。内部候補・汎用Helper・検証専用契約は必要性を確認してRootから外し、EM内部の試験は宣言元を参照する。外部Packageの試験は既存のRoot限定Guardを維持する。現在の公開は93項目（58値・35型）。用途別の読取り・保存・完了・履歴入口を既存の完成操作へ統合した。基準267項目から要求・表示契約と開始／終了の内部段階、用途別Checkpoint・Lease・Queue・Reader・回収保存の重複入口、外部利用のない内部型と候補生成・分類Helperを撤去した。現在の公開集合は実Rootと固定期待値の契約試験を正本とし、[当初分離時の対応案](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)とは区別する。

##### モデル別CRUDとState複合取得

モデル単体のCRUD・照会は各モデルが所有する。Projectの現在値取得はState側の`readProjectExecutionState`へ一本化し、Task側の旧`readQueueProject`と重複する投影処理は撤去した。有効Schemaの不正IDは既存のID不正理由へ統一し、Schema不正の理由は維持する。

複数モデルを同じ保存版で照合する取得は`state/crud.ts`の`readState(repository, binding, scope)`が所有する。固定四範囲の選択に限定し、任意fieldや投影callback・新Store・全技術Snapshotの返却には拡張しない。未知・欠測scopeは読取り前に拒否し、既定値へ補完しない。

| scope | 同じ一回の読取りから返すfield |
|---|---|
| `intake` | `intakeEpoch`のみ。既存の出版確認用読取りを使用し、未初期化は明示的な`null` |
| `queue` | `queueEntries`、`leaseIntents`、`intakeEpoch`を通常Readerの同版一回から返す |
| `execution` | `projects`、`queueEntries`、`intakeEpoch`、`schemaRevision` |
| `workspace` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

元の2複合Readerの取得範囲・Rootとbindingの検査・短期Lock・明示不存在・読取り不明・解放失敗を維持する。旧`readExecutionOverview`／`readWorkspaceState`の公開・実装・互換Wrapperは残さない。通常のQueue一覧照会は維持する。Decision＋Blocker、Project＋管理実行、Queue参照限定Workspaceの三特殊Queryは本番利用がなく、通常CRUDへ限定する後続整理で廃止した。

Coordinatorの通常状態表示は`execution`取得結果からProjectと受付世代を投影し、追加Portの構築と同じ状態の再読取りをしない。Git改訂が異なる場合のWorkspace採用確認を挟む前後のfresh取得、排他取得後・保存後の読戻しは保持する。Workspace操作でも`workspace`範囲を同じ版で取得し、個別モデルを順番に読む方式へ分解しない。

Port単独構成の受付世代取得は`intake`へ統合し、`readSnapshotIntakeEpoch`の実装・Root公開・利用側importを撤去した。他scopeの通常読取り条件は変えない。`readState`の二引数形式は`scope: "operation" | "recovery"`と用途別inputを受ける。前者の現在Owner、後者の真正Repositoryという権限境界は元のまま区別する。内部Readerは`state/crud.ts`に一意に置き、返却内容・読取り順序は維持する。

Leaseの取得Identity・回復IDは、`acquireLease`の既存Intent保存がRepository結合・Project・Queue・種別から生成する。呼出側はOwner世代とProcess IDを渡し、保存前通知でexact回復IDを受け取る。保存成功後は同じIntentを物理取得確認へ渡す。Owner喪失照会も同じIdentityと回復IDを返し、Queue解放の不存在観測へ同じIdentityを渡す。Coでの再計算と二つのRoot生成Helperは撤去し、保存形式・物理Path・排他と回復順序は変更しない。

##### 公開から外した内部契約と保持理由

資源イベント／回収更新で構築する次Bookは、`validateResourceBookTransition`の先頭で形を一回検査し、そのまま元Bookとの相関・遷移を検査する。更新側の同じ次値に対する先行検査は重ねない。元Bookの検査、未知値の拒否、ID／Label・Receipt・不存在証拠の保持は変更しない。CoのHost認証回復記録にも独立した受付があるため、この内部重複整理だけでBook操作のRoot公開を撤去しない。

資源記録の二更新とBook／遷移検査は`attempt/operations.ts`、明示メールからの主体構築と形式検査は`state/operations.ts`が実体を持つ。状態列挙・契約識別子・完了理由は対応モデルの`types.ts`を正本とする。旧所在地の再exportや中継Wrapperは作らず、宣言Ownerの移管自体を公開削減とは数えない。これらの値操作は保存・Root探索・外部Effectを呼ばない。

再起動ID生成とHost遷移相関検査はRootから撤去した。前者は`readState`の`scope: "recovery"`・`restart_preparation`範囲で、対象操作と`scopeSha256`を一回の既存読取りへ結合して返す。通常Readerの確認完了と準備値の成立は別で、`restartPreparation`が非nullであり、Coの同版・排他・現在性確認も成立した場合だけ使用する。Coは既存の排他取得後の再読取りをこの範囲へ置換し、追加読取り・先行保存を行わない。後者は同版の`operationStates.hostTransition`へ投影する。新規意図は既存Writerの検査と保存後Readerを経てから実Host遷移へ使い、保存済み意図の再入場も同じ返却値を使う。実Host token・marker・recordBefore・旧世代の照合はCoに残す。

残る八公開は、`inspectDecision`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`、`isPrincipalId`、`parseDockerTaskRecoveryId`、`parseHostRecoveryToken`、`validateResourceBook`である。未保存モデルと完全Decision搬送、入口主体、Operation保存前／Host-only相関、Repository Operationとは別の認証記録、IPC後の動的QAという独立した受付を持つ。保存を伴うCRUDへ押し込むと時点・Effect順又は検証範囲が変わるため、今回の保証維持範囲では維持する。規則のCo複製、検査目的の先行保存、別名の汎用Facadeで隠さない。これらを撤去する場合は当該受付契約の変更を別途評価する。

現在のRootは93項目（58値・35型）で、外部の完成操作・入力受付・モデル語彙として必要な集合を維持する。過去の件数推移・内部化対象・段階ごとの検証は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)に記録し、現行契約と混在させない。内部型は宣言元に保持し、外部試験のためだけの型公開やunknownへの置換を行わない。

外部試験の保存fixture・故障窓だけで必要だった下表11宣言は内部に閉じる。利用側は完成操作・現役の公開値契約・独立した期待DTOを使用し、外部Packageからの深いimportや互換Facadeを作らない。モデル自身の候補・遷移検査は宣言元で維持する。

| 内部化した用途 | 宣言 |
|---|---|
| 保存fixtureの技術断面4件 | `prepareStateCleanupSnapshot`、`prepareStateLifecycleSnapshot`、`prepareStateResourceSnapshot`、`prepareStateRestartSnapshot` |
| 修復fixtureの候補3件 | `prepareStateRepairSnapshot`、`prepareStateRepairCheckpointSnapshot`、`prepareStateRepairSessionSnapshot` |
| 履歴fixtureと故障窓4件 | `prepareRepairHistoryLine`、`prepareRepairHistorySnapshot`、`prepareStateHistoryLine`、`prepareStateHistorySnapshot` |

本番で必要な検査も、公開Helperを直接呼ぶことが必須とは限らない。履歴要約・Host更新・開始Identity・初期Hostのモデル判定は次の既存操作へ内包した。初回候補Helperの外部fixtureは公開Writerと固定入力へ接続し、Root公開を撤去した。保存codecの外部利用とRoot公開は撤去した。公開最小化全体の完了は、この局所整理だけから推定しない。

| 検査の所有と公開境界 | 本番で必要な意味 |
|---|---|
| 履歴Reader／Writerの内部検査 | `readState(root, {scope: "recovery", input: {kind: "repair_history", recoveryId}})`が要約成立を検査し、Coordinatorは同じ値検査を再実行しない |
| 操作Reader／Writerの内部検査 | `readState(owner, {scope: "operation", input: {kind: "host_cleanup", recoveryId}})`が同じ元版のHost清掃準備を検査し、元本文・対象・Host tokenを返す。一回Authorityの消費前に確認し、保存時にも元版を再検査する |
| 操作Readerの開始前取得 | `readState(owner, {scope: "operation", input: {kind: "operation_start", identityJson}})`がState読取り・Lock取得・初期化をせず、現在Ownerと初回Identityを検査し、回復ID・Identity Hash・操作IDだけを返す |
| 回復Readerの初期Host取得 | `readState(root, {scope: "recovery", input: {kind: "initial_host", recoveryId}})`と既存host_cleanup範囲が同じ版のexact一操作だけを再導出し、不変のID一覧を返す。通常currentでは再導出しない。Coは成功・元版・解放確認後だけ使い、実host_onlyとtokenを別に確認する |
| 初回候補生成 | `prepareStateOperationSnapshot`はRootから撤去。実Rootの試験は公開開始Writer、純粋観測の試験は固定入力を使い、内部候補への間接依存も残さない |
| 回復Ownerの同版保持 | CoordinatorはReaderが検査・凍結したSnapshotを既存回復記録の元本文と同じ版で保持する。再decodeせずHost・consumer判定に使い、保存結果とfresh Readerの改訂・Hash・解放確認後だけ両方を更新する |
| Coordinatorの入力捕捉 | 公開受入・認証通知・資源作成通知・Host checkpointの入力コピーは既存`input/snapshot.ts`の`snapshotJsonValue`を使う。保存codecのroundtripを使わず、未知実行の拒否と参照分離を維持する。保存本文の正規符号化・Hash・比較は別の既存契約であり、JSON.stringifyへ置換しない |

開始前取得の`kind: "operation_start"`・`status: "completed"`・`operationIdentity`は事前検査範囲の共同結果で、`value`はnullである。`lockReleased:true`はこの範囲でLockを取得していないことを表し、保存・開始許可・現在Stateの観測を意味しない。Getter等の不正入力、別操作Owner、最終再検証失敗では相関を返さず、StateReaderにも進まない。保存時の再検査・重複判定は`saveOperationStart`に残す。

Host清掃確定ではWriterが正規候補を生成・検査する。Coordinatorは保存結果のrevision／payloadSha256とfresh Readerの一致、同じ回復ID・Host token・cleanup確定を確認し、確認済み本文だけを次の元版に使う。利用側で次Snapshotを再構築しない。試験の既知Host差分期待値は、対象外全文・前改訂・元Hashを明記した独立DTOとし、製品validationの代替実装にはしない。

##### 要求・表示契約と開始／終了の境界

Objectiveの実行要求、状態照会・公開投影、判断操作の要求／応答、WorkspaceCommand、活動一覧はCoordinatorの既存Sourceが所有する。EMは保存モデルとその検査を所有し、Coordinatorへ依存しない。`inspectDecision()`は判断モデル自身の検査であり、Coordinatorが保存用の符号化や履歴投影を代用しないための入口である。

判断操作は完全な質問・選択肢・回答者・日時・理由・適用結果を返す。同じProcess内ではEMの完成操作が返した検査済み値を搬送し、表示のためだけに再検査・再照会しない。未知のProcess結果を受け付ける場合は、Coordinatorの既存結果受付がEMのモデル検査を一度使用し、その独立捕捉済みの返却値を結果へ載せる。検査段階を減らすために応答情報を削ったり、同じモデル規則を利用側へ複製したりしない。

`saveOperationStart()`は初回記録の保存後に、同じ元Owner・Repository・exact回復参照へ終端Contextを固定する。開始保存と終端準備は別の成立事実として`startSaved`と`completionContext`を返す。保存済みでも準備が失敗したら全体はblockedとなり、Host要求を発行せず、元参照・保存Effectを保持する。統合結果のlockReleasedは先行Writerと後続準備Readerの両方を反映し、準備Readerの拒否理由・解放不明を保持する。準備例外時は解放済みと推定しない。ContextはProcess内だけで使用し、保存値から復元しない。

`completeOperation()`は元Host結果と元Controller結果の参照一致を内部で固定し、入力受理を`inputAccepted`として保存結果と別に返す。受理後の保存失敗・例外でも同じ元入力を上位が保持できるようにし、別参照への差替えは拒否する。実Writerが保持する発行済みEffect・保存未確定・Lock解放不明は畳まない。Taskに結合したOperationはTask終端と同じStateで終了し、Task非関連のOperationは技術終端・履歴確認後に終了する。利用側の配送ACKは終了条件にしない。

<a id="repair-write-contract"></a>
##### Checkpoint・Lease・Queue・回復読取りの契約

正常なState Readerの`value.operationStates`は、同じ`value.snapshot.operations`の操作参照とモデル判定を不変の組で返す。実行操作は`resourcesSettled`／`restartSettled`／`authenticationClosureAllowed`、修復操作は`disposalSettled`を持つ。失敗・観測不能から空の成功観測を作らない。利用側はIDだけで別版の操作と組み合わせず、同じ操作参照を照合して使用する。回復Ownerの保持Snapshotを交換するときは観測も一緒に更新し、認証の分岐はEffect前のfresh取得に従う。Reader内の値投影のみで、追加I/O・保存field・Authorityは作らない。旧四判定関数のRoot公開とCo本番呼出しは撤去した。モデル検査自体はEM内部に維持する。

保存markerの`domain-model/state.lock`と専用`completeStatePublication`は撤去した。排他は共通Lock、更新候補はpending、確定内容はcurrentと履歴を正本とする。通常Readerはpending・未知File・旧marker残存を拒否し、明示再入場では元版/候補/回復ID/Owner/実体/履歴の照合を維持する。rename済み・pendingなしの正常currentはfresh読取りできるが、前回Writer成功や耐久確定を推定しない。Coordinatorは既存の履歴付きReaderと終了後の相関付きReaderを使い、新Wrapperを追加しない。

`saveRepairRecord()`の成功valueは、確認済み`operation`・`version`に対応する`checkpointSettled`と`disposalSettled`を返す。通常保存と同値の再観測で同じ契約を使い、保存不明・排他解放不明のvalueは`null`とする。Coordinatorは最終Checkpointの保存成功後、その判定を既存のEngine・Host安全性・Cleanup・Lifecycle条件と組み合わせる。八処置の値上の終端だけで修復全体の成功を表示しない。`isRepairCheckpointSettled`のRoot公開とCoでの再検査は撤去し、EM内部とDI内部の技術検査は維持する。

`saveOperationCheckpoint()`はresource／cleanup／host／lifecycle／references／restartを固定種別として受け、同じlive Owner・操作ID・改訂から保存候補を生成する。referencesでも対象外区画と現在Operationの相関を保持する。回復Owner向けの保存やHost事前検査をこの入口の権限へ混ぜない。

`saveRecoveryCheckpoint()`は回収中の途中更新・再起動・終端・Host清掃確定を固定種別として受ける。途中・再起動・終端は元の同期Owner確認、Host清掃確定は`assertAbsentOwner`とexact出版候補を要求し、証拠を相互代用しない。現在状態・履歴・技術終端の照合と各Readerの解放確認を維持する。live Host準備と正式未発行の元Controller照合は、それぞれ別の完成操作として維持する。

未確認履歴の出版途中から終端へ再入場する場合は、その履歴Readerが要求する保持日数と現在性確認を上位が同じ入力へ搬送する。Coordinatorは元Snapshotのexact操作に未確認履歴がある場合だけ既存の設定接続を使い、通常終了・確認済み履歴・他操作を理由に設定読取りを増やさない。保持設定不正・途中変更の拒否、元版一致・Host不存在・Ownerの一回性は維持する。

Leaseは`acquireLease()`・`releaseLease()`・`recoverLease()`・`readLease()`、Queueは`createQueue()`・`updateQueue()`へ用途固定の処置を集約する。Requestのkindごとに元の必須tuple型を持ち、共通のOptional集合や任意更新Callbackは受けない。入力tupleは既存のown-data配列捕捉で固定し、Getter・Proxy・疎配列・独自iterator・余剰symbolと不正arityを保存前に拒否する。Root観測Callbackは捕捉した値として保持し、実行は従来どおり短期Lock内の現在Rootへ結合する。保存Intentと物理処置後の観測は区別し、物理Lock取得・解放・回復はCoordinatorが所有する。

`readState(root, {scope: "recovery", input: request})`はcurrent／restart_preparation／admission／history／resource_publication／host_cleanup／initial_host／execution_history／repair_history／execution_completion／repair_completion／completionの固定取得範囲を持つ。各範囲の元ID検査・保存途中の照合条件を保持し、通常Readerの拒否を自動的に別範囲へfallbackしない。completionは回復IDと上位相関IDを必須とする。restart_preparationだけが元回復IDとscopeSha256を必要とし、他範囲への余剰scopeは読取り前に拒否する。live Ownerからの読取りと回復Ownerによるfreshな終端確認を区別し、配送・ACK専用の取得範囲は持たない。

`kind: "history"`はrecoveryIdを持たない閉じた要求で、初期化済みStateと同じ短期Lock内にある履歴を全行検査する。成功・値あり・解放確認・`historyRows !== null`の共同成立後だけ利用し、真正不存在は不変の空配列、不正・観測不能・pending・実体変化・解放不明は値なしの停止とする。取得途中の存在／不存在変化も最終照合し、部分行を返さない。通常currentの追加履歴I/Oは0で、`historyRows:null`は未要求を表す。履歴Queryに保持設定の読取り・変更や操作Authorityを追加しない。Workbench検証scriptはこの完成操作を使い、履歴の直接File読取りとdecoder呼出しを再実装しない。

State Readerの成功valueは、検査済みSnapshot・本文Hashと同じ読取りから`sourceText`を返す。これはUTF-8・正規JSON・末尾LFを検査したstate.json原文であり、pending候補や利用側で再生成した本文ではない。最終File同一性・現在Owner・Lock終了などの成功条件を変えず、拒否時はvalueを返さない。文字列と成功valueは不変とし、追加I/O・公開関数・Authorityは作らないが、本文文字列分のメモリ保持は増える。Coordinatorは元本文・Writer入力・全文比較にこの原文を使用し、SnapshotのJSON再生成をしない。原文を新しいログ・HTTP応答へ丸ごと転送しない。Coordinatorの値比較は既存のown-data捕捉後にNode.js標準で行い、保存用encoderを使わない。外部試験の固定値生成は既存試験用JSON処理へ接続済みであり、保存codecはEM内部へ閉じる。

外部試験でも、実保存済み履歴の確認はこのReader又は対象用途の完成観測へ接続する。履歴として有効な別consumer・別相関の行を、全履歴Readerが無条件に拒否することは要求しない。同じ操作の終了観測が対応関係を別に検査する。一次失敗・Command観測の純粋な値検査はEMのunit試験が実検査関数を直接確認し、CoordinatorのITから内部関数を抽出しない。正常Owner結合試験も、修復直後と後続Task各段階の実履歴を公開Readerで取得し、元修復行の本文・時刻・両Hashと件数を照合する。引数だけの変異・重複を実File不一致として拒否する対照と、EMが所有する実履歴の構文検査を区別する。子Processの保存途中の確認には既存の用途固定Readerが検査した履歴本文を使い、pendingを通常Queryへ通す例外は作らない。外部の履歴decoder依存は撤去済みであり、decodeHistoryRowsはEM内部の値検査と試験だけが使用する。Rootは全履歴取得の完成Readerを公開する。State decoderと保存用encoderの外部直接利用も撤去し、両関数のRoot公開を廃止した。実保存の検査は完成Readerへ、過去版・保存前候補の期待値は既知fixture本文の局所投影とraw Hashへ分離する。外部の固定値生成には既存の試験用canonicalJsonを使い、Schema検査の代役にはしない。EM自身の値検査試験は内部宣言元を使う。

汎用のRecord／Array捕捉・Object／key検査はEM Rootから公開しない。Coordinatorの入力捕捉には既存input/snapshot.tsを使用し、保存codecや内部Snapshot生成を入力検査の代用にしない。外部試験は宣言済みRootの完成操作又は現役の値契約だけを使い、Root限定Guardを維持する。

##### 修復更新の完成InputとResult

`saveRepairRecord`は、`attempt/types.ts`の`RepairSaveRequest`として期待するStateVersion又は初回のnullと、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの固定論理更新を受ける。Coordinatorは次Snapshotや符号化byteを生成して渡さず、EMが同exact対象・期待改訂／Hash・現在Ownerを照合して候補を構築する。相関、非対象の全文保全、正規符号化、単一WriterのCAS・一回consume・解放確認は維持する。

成功・保存確認・排他解放が共同成立した場合だけ、確定Versionと対象Repair Operationをvalueとして返す。不明／拒否時に新しい改訂や候補を利用側の正本へ補完せず、Coordinatorは既存のsticky停止と元回復参照を保持する。期待改訂不一致の自動再読込み・再基準化・再試行は追加しない。

State全体の候補生成は、Task・Operation・Decision・履歴等を一つの保存改訂へ結合する跨モデル責務である。名前にRepairやTaskを含むことだけを理由に別validationへ移さず、単一CASとSource Mapを分断しない。モデル内validationの既存相互参照は今回一律に解消せず、他二モデルとの直接依存0というPackage境界と区別する。

ExecutionSelection、inspectExecutionSelection、TaskExecutionSelectionsと担当組の保存検査は実行モデルに置く。Hash生成はEMの内部利用がなく、Coordinatorの既存selection/resolveが正規化済み選定を同じbyte・SHA-256で識別する。ADのModelSelectionを基礎に当時のcatalogIdentity／configIdentity／role／workType／sourceを固定する。CoordinatorがConfigとADの解決結果を明示投影し、実行モデルは役割・選定相関・形式を自身の境界で検査する。Hashの正規化順序・保存JSON・設定取得時の意味は変更しない。

保存WriterもReaderと同様に、検査済み選定二件と組を不変値として返す。JSON由来の保存値を検査した時点で一度だけ凍結し、その後のCoordinatorの状態遷移とTask要求構築は同じ値を搬送する。未信頼のTask要求は受付で一度捕捉し、同じ受付内でモデル検査を繰り返さない。Root公開の要否と検査自体の要否は分けて評価し、検査済み返却値の再利用だけで外せる経路と、未保存入力・Process結果の境界を区別する。

<a id="consumers"></a>
##### 内部の責務構成

`index.ts`と、objective／task／attempt／decision／workspace／state／historyの各`crud.ts`・`validation.ts`・`types.ts`、objective／task／attempt／history／stateの`operations.ts`、`storage/store.ts`・`storage/lock.ts`・`storage/publication.ts`で構成する。各crudは完成操作の意味、validationは局所検査、operationsは保存しない値操作・用途候補、typesは契約を所有する。

固定所在、共通File読取り／書込み、一時保存資源のI/Oは`storage/store.ts`、共通の排他取得・保持・解放と保存Ownerは`storage/lock.ts`が所有する。単一StateのCAS・保存／回復と、短命Mapに結合したEffect順序は`storage/publication.ts`が所有し、共通保存primitiveへ接続する。同Fileはrename／unlink等も発行するため、全物理I/Oをstoreへ集約したとは扱わない。短命Mapと一回使用ProtocolはWriterと一体で置く。`state/crud.ts`は同版の意味整合と候補の接続を所有し、重複Writerや中継だけのWrapperを作らない。

共通Record取得は既存snapshotStateRecordへ統一し、同じ受理域のsnapshotPlainRecord実装と別名Wrapperは残さない。配列二種の理由分類・引数検査、およびdescriptor検査は条件が異なるため今回変更しない。

旧repository／identity／plain-dataのSource分散と旧PathのWrapperは残さない。機密検査の7値公開は撤去し、AIへの送信境界を所有するCoordinatorのinput/secret-validationへ移した。先行の24 Source整理では他のRoot公開を維持し、その後267項目へ縮減した段階を経て、現行集合は§2の93項目となる。各段階を通して、保存先・Schema・Hash・Lock Identity・CAS・現在性確認・失敗／回復相関は不変更とする。

#### 3. 保持設定と利用側

基底ExecutionModelAccess／OperationStorageAccessと通常Queryは不変更。保持日数を消費する保存操作・履歴処理分岐だけ、既存Inputに履歴保持日数を加える。非履歴Query／Recovery入口を設定不正で一律停止しない。

上位Consumerは履歴確認を求められた既存revalidate呼出しに限り、現在設定がreadyで期待保持日数と同じことを結合する。履歴Input側の既存revalidateは任意の最終引数expectedHistoryRetentionDaysを受け、通常呼出しは従来引数のまま設定Readerを呼ばない。元runtime-storeの6箇所・runtime-historyの4箇所の当該枝・Effect順序へ対応付ける。Root単体のRecovery・修復出版再入場と履歴保守も取り残さない。

履歴と配送の一回保存Ownerも任意の期待保持日数を元repository.revalidateへ転送し、active・Map同一性・used・元Owner照合と日数の途中変更拒否を両立する。通常の引数なし再検証へ設定読取りを追加しない。

新しい設定Callback field・Context階層・Reader注入は作らない。追加引数を渡しただけでは比較成立とせず、本番Consumerの現在性確認と途中設定変更の負例で検証する。設定不存在時30日と明示30日を新たに区別せず、Config Hashや世代一致も追加しない。

<a id="storage"></a>
#### 4. 保存・初期化・回復

保存先は既存`.crdd/domain-model/`のstate.json・history.jsonl等を維持する。Package名と保存Identityは別であり、Schema・契約ID・Lock Path／Hash namespace・CAS・Principal・回復参照・履歴保持条件を変更しない。自動移行・旧形式Reader・過去保持物の操作は追加しない。

State／Task／Queue／Decision／回復義務は既存の単一SnapshotとWriterで扱う。History確認前に必要な判断記録を退役させず、未確認・部分Effect・配送・回復相関を落とさない。既存Blocker 1:N提案回答、未適用・解消・中止を維持する。

初期化作成と旧coordinator領域の不存在確認はstorage/store.ts内部へ一緒に置く。真正不存在、親実体の前後一致、排他的作成、空の新規領域を維持し、一般ensureで既存領域を新品としない。旧署名準備の専用Temporary Operationは、本番Callerがa04ecb703で撤去済みのため、作成・再開・根拠昇格・終了・専用Map／型／検証Variantまで代替なしで退役する。汎用の一時操作Storeは作らない。共有の領域・固定File I/Oと通常State／Attempt回復は維持する。過去のtmp／.operations文書の有無は未走査で、旧APIによる再開・清掃を提供せず、由来不明物は保全し個別承認の対象確認へ委ねる。

領域確保の失敗は既存ExecutionStorageBlockedErrorを実行失敗契約として公開し、Coのinstanceof投影へ接続する。単なる一般Errorや未実施に変換せず、Effect不明・Cleanup・元回復参照を保持する。宣言はstorage/store.tsで所有し、他モデルのReturnTypeへ依存しない。

局所I/O・EOF・close・Getter／Proxy拒否は各入力／保存Ownerへ必要分を置く。共通Helper全文の複製や第4Packageは作らない。詳細な局所遷移・出版の契約は[API・単一保存](../../../06_Architecture/Details/execution-model/05_Runtime_Domain.md)を参照する。保持設定・Owner配置の新しい境界は本書を正本とする。

##### 保存証拠の寿命と物理出版の分類

| 内部処理 | 主な入口・責務 | 終了条件 |
|---|---|---|
| 初期化 | prepareOwnedStateInitialization：exact新規領域と初回候補の結合 | 初期化証拠の成功／失敗・解放結果を区別 |
| 通常出版 | writeOwnedStateSnapshot／writeStateSnapshot：候補を単一Writerへ接続 | 元版・Owner・File・設定のfresh照合、CAS、保存確認とLock解放 |
| 再入場 | resumeRepairRecordSave：exact修復保存の中断状態を再観測 | 未知の保存物を確定せず、既存の出版相関を照合 |
| 特殊候補の出版 | publishRecoveryState：用途候補を短命Contextへ結合 | 一回消費とfinallyによるContext失効 |
| 取得済みOwnerによる出版 | publishStateOwned：Task／定義候補を単一Writerへ接続 | 排他を再取得・解放せず、Owner寿命は呼出し側が管理 |

settlementsは一回の保存呼出しの候補・元版・OwnerをContextへ結合し、消費後はfinallyで破棄する。initializationsはexact初期領域・本文だけの証拠を保持し、準備・解放成功時は後続出版まで保持する。解放失敗、既存の出版終了またはContext失効条件で削除する。historyAttemptsは同じ生存Ownerでの履歴試行とpending候補を保持するため、各呼出しfinallyでは消さない。弱参照のOwner寿命に従い、Process再起動後の正本やfresh照合の代替にはしない。

resumeRepairRecordSaveはLock・保存物・途中結果を扱う完成した保存再入場操作であり、Storageの実体をRootから直接提供する。公開Ownerの見た目のためのAttempt転送Wrapperや、新しいMap／Managerは作らない。短命証拠とWriterを分散させないため、publication.tsは行数だけで分割しない。

<a id="verification"></a>
#### 5. 検証と未確認

公開集合、3モデル直接依存0、全Consumer型、State／History／CAS／Lock、初期化・途中失敗・回復・Receipt／相関を既存試験へ対応付ける。保持設定の初回不成立・途中変更・同値と、設定不正でも非履歴処理を止めない対照を含む。

型・Source移管だけで保存や再入場の成立を主張しない。限定回帰と独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。

保存Source試験補助は、同じ試験ProcessでSourceを編集しないことを前提に、固定10Sourceの読取り・型除去・宣言抽出を一回準備する。通常経路は順序付き依存名と内部関数override名が同じ場合だけ未束縛factoryを再利用し、依存値・fixture結果・Owner・保存領域は保持しない。factory評価と製品Map初期化は各ケースで実行する。Source変異は毎回適用してcompileし、通常factoryへ混入させない。この試験準備共有は製品の保存・Lock・CAS・回復の保証変更ではない。

各段階の限定検証、失敗と是正、未確認範囲は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)を正本とする。過去の成功件数を現在候補へ合算せず、局所成功から全体回帰や公開最小性の成立を主張しない。

##### 補助検査の公開境界

validId・validWorkspaceDisplayName・validWorkspaceCandidateRequestはモデル内の保存検査として維持しRoot公開しない。CoordinatorのID入力は既存のstate/validation、Workspaceコマンドの表示名・Path・選択は既存commandsで確認する。仮のCandidateをPath検査のために組み立てず、Git接続は保存が受理したCandidate Intentを使う。汎用の採用結果本文は検証済みWorkspaceモデルと同一視せず、Coordinatorが利用するIdentity・Commit相関を確認する。

verifyQueueIntakeとCoordinatorの委譲入口は撤去する。新StateはsaveProjectExecutionState、既存StateはcreateQueueの同じ短期保存排他内でsnapshotIntakeMatchesを用い、受付世代・Queue・要求Hash・Project・Milestoneの相関を保存前に確認する。古い受付の明示未保存拒否と保存／解放不明は区別し、後者をno_effectへ変換しない。

validateResourceBookはCoordinator所有の認証回復ファイルを読む独立境界と、保存済みQAイベント列の検査に必要な受付である。後者はbeforeを明示して同じ内部の遷移正本を利用する。validateResourceBookTransitionの独立Root公開は撤去した。別記録をEMのState Readerが検査済みと扱わず、同義Wrapper・履歴の再構築・汎用検査Frameworkは作らない。外部の保存代役はapplyResourceEvent／applyResourceCleanupの検査済み結果を使用する。

WorkspaceResultとinspectWorkspaceResultはCoordinatorの結果搬送契約であり、EMの保存モデルではないためCoordinatorの既存workspace/record.tsへ移す。EMからの宣言・Root公開は撤去し、相対Path・欠測・変更相関・参照分離・getter／Proxy拒否の試験は新Ownerで維持する。

inspectSingleTaskRecordはQueueの保存・読取り内部に閉じる。単発更新のWriterは未検証入力を捕捉し、Lease観測や更新候補生成の前に記録の閉形式と終端相関を検査する。CoordinatorはWriterが返したsingleTaskを次の現在値として使用する。実行Adapterの用途結果はCoordinator自身が検査し、検査のために仮のPrincipal・Task・Attemptを生成しない。保存後の表示を保存前の成功へ読み替えない。


##### 読取り・Checkpoint・回復結果の共通入口

- 三引数の表示用readStateは既存の取得範囲を維持する。二引数のoperation／recoveryはそれぞれのOwner・元版・Lock条件で検査し、未知scope・余剰field・Getterを読取り前に拒否する。
- saveRecoveryCheckpointは既存更新に加え、resource_not_issued・host_cleanup_preparation・authentication_unknown_closureを同じ閉集合で受ける。未発行は元Operationの現在Owner、Host準備は元本文と再読取り、認証終了は元Ownerと二回の不存在観測・一回証拠の検査を維持する。
- completeRecovery／saveRecoveryHistoryはdocker_task／runtime_repairを必須引数で区別する。未知用途はOwner callbackと保存前に拒否する。旧固定用途Wrapperは置かない。
- validateResourceBookのbefore指定は同じ内部の遷移検査へ接続する。省略時は値検査だけであり、呼出側が必要な比較を省略してよいという変更ではない。
- 読取り専用のreadOperationResourcesStageは撤去し、既存operation取得結果からexact回復IDの資源を取得する。追加読取り・技術操作は行わない。

保存Schema、Authority、Lock／CAS、認証終了の一回証拠と通知順序は変更しない。通常の利用側も試験・生成子SourceもRootの共通入口を利用し、内部実装への迂回は追加しない。


##### 純粋な資源操作と保存依存の境界 — 2026-11-14

| Owner | 所有する処理 | 持たない依存 |
|---|---|---|
| `attempt/operations.ts` | 資源イベント・清掃観測の適用、Book構造と単調遷移、認証未確認資源の不存在辺の差分検出 | State候補・CRUD・Storage |
| `state/operations.ts` | plain値の正規符号化、記録捕捉・主体ID、Hash・Lease ID／証拠の構築と局所形式検査 | 他モデルの実行時処理・全体候補・保存・Authority |
| `state/validation.ts` | 複数モデルの同版整合と全State候補 | 資源値処理のためのAttempt CRUD、主体構築のためのState CRUD |
| `state/crud.ts` | 現在版の意味・取得と用途候補の接続 | 資源更新の別実装、物理Writerとその私有Map |
| `storage/publication.ts` | 単一Writer／Lock／CAS・初期化・再入場・短命証拠の寿命 | Attempt／History CRUDへの実行時依存 |

主体IDの固定prefixは`state/operations.ts`の私有定数とし、Decision／Taskの局所検査は同じ値処理を利用する。公開名・文法・保存形式は変えず、Decision検査のために全State検査をロードしない。Coordinatorでは初回受付で独立・凍結捕捉したSelectionを再利用する。再発行側・Resolver・保存／搬送入力の検査とHashの正規順は維持し、内部受渡しの省略を未信頼入力の無検査へ拡張しない。

Stateの値処理は`state/operations.ts`の一つの実体を内部Consumerが直接利用する。所有範囲はExecution Stateの保存値契約・主体／Identity・正規化・相関に直接関係する処理だけとし、複数利用元があることだけを追加理由にしない。全Stateの整合や物理保存は追加しない。単独モデルの参照文法はそのモデルに閉じ、Taskの候補・回復・結果参照の同じnullable文法は`task/validation.ts`の私有一実体へ統合する。必須結果参照の検査も同Fileが所有し、Task operationsだけが内部利用する。履歴入力の閉じたObject／UTC時刻検査は`history/validation.ts`の私有処理とする。汎用commonや転送exportを設けない。Root93項目・保存本文とHash・Intent／Receipt／正式未発行／不存在の条件を維持し、清掃観測の不明を不存在へ変換しない。

未信頼Objectをdescriptorで独立捕捉する処理と、JSON復号済み値のkey検査は前提が異なる。名前・戻り値が似ているだけで検査を統合せず、Callerが持つ値の由来・例外契約に従って使い分ける。

新品NodeでState候補・CRUD・Storageの解決を拒否しても資源の値更新が使えることを確認する。型だけの参照をAuthorityにしない。局所値検査と全State候補の逆依存は分離するが、局所検査同士の全参照を禁止するものではない。Historyの意味Owner・完成操作・明示Snapshot型は下記の現行責務に従う。

`hashStateText`を局所値Ownerへ閉じることで、Workspaceの局所検査から全State検査へ戻る実行時参照を持たない。単一採用結果の`adoptionWasRejected`はWorkspace、計画全体の同一性HashはObjectiveの局所validation、資源の新しい不存在辺の検出はAttemptが所有する。資源差分を検知した後の一般保存拒否と専用証拠の確認はStorageに残す。Lease証拠は内容検査・構築・Hashを同じState operationsへ置き、保存形式識別子`STORAGE_CONTRACT`はstate/typesを正本とする。文字列・LF・ID・参照保持と例外契約は変更しない。

##### 履歴の生成・保持・出版候補とState整合 — 2026-11-14

| Owner | 実体を所有する処理 | 所有しないもの |
|---|---|---|
| `history/operations.ts` | Operation／Repairの要約と行、Task／判断の行生成、必須行の両Hash照合、元順序の保持・期間選別、同IDのexact比較、pending全文一致、intrinsic Buffer捕捉 | 全State復号、改訂更新、Decoder、保存・Lock・Authority |
| `history/validation.ts` | 共通履歴の全行decode・重複／部分行／未知Schema拒否 | 全Stateの退役判断、物理保存、実資源の終了確認 |
| `state/validation.ts` | 全体復号、現在操作選択と終端条件、判断・未搬送・未解決・現在操作の保持参照／必須Hash投影、履歴候補と同じ元版のSnapshot候補結合 | 履歴本文の独自符号化、期間選別・pending比較の別実装 |
| `storage/publication.ts`／`storage/store.ts` | 元版・現在Owner／設定・File実体照合、単一CAS、pending保存・確定・読戻し | 履歴要約／行の別の値生成 |

`prepareHistoryRetention`の内部入口は、保存済み全体Stateから参照を導出するためState側に置く。Historyは、検査済み行と同じStateの保持参照・必須Hashだけを受け、現在Operationが履歴確認済みか否かによらず欠測・行Hash差・要約Hash差を選別前に拒否する。単なる参照保護と必須行の存在照合を混同しない。現在参照・reviewAfter前・保持期間境界の行を、元順序・元本文のまま残す。

二つの出版候補は、同じ同期呼出しで検査済みの元Snapshotからexact操作・固定行・確認済み次版を導出する。要約・行の意味計算はHistoryへ委譲し、Stateは改訂・元Hash・対象外保全と最終遷移を検査する。canonical全行と固定一行の検査、History側のexact比較・重複拒否・期間整理・pending全文一致は維持する。導出中に同じ元本文を再decodeしないが、最終遷移検査は元本文と候補を独立して検査する。Writerのfresh読取り、異なるLock区間や外部入力境界で検査済み値を使い回さない。どちらかの候補が不成立なら全体候補も不成立とする。

Task／RepairのBuffer捕捉はHistoryの共通実体を使う。Proxy・非Buffer・intrinsic取得失敗を拒否し、own equals／lengthを使わず独立コピーする。Task入口のcatchとRepair入口の例外伝播、各結果のコピー条件・入力捕捉順序を維持する。Schema・Hash対象・Root93項目・物理保存順・Reader／WriterとLock保持条件は変更しない。値候補成功は保存・退役・実資源回収の成功ではない。

Historyの意味計算はhistory/operations、完成保存はhistory/crud、同版への結合はstate/validation、物理出版はstorage/publicationに一意に配置する。Stateを単なる保存先へ縮めず、全モデルの相関・改訂保証を維持する。

通常履歴と判断履歴の追記受付は`history/validation.ts`の`prepareHistoryAppend`が所有する。現行全行と未来時刻を先に検査し、Task入力、同版Decisionの投影の順で固定行を追加する。同ID同本文は追記せず、異本文は候補全体を拒否し、追加なしは元Bufferを返す。全Stateの復号・File・Owner・保持設定は扱わない。低レベルのHistory operationsへ全行Decoderの逆依存を追加しない。

`storage/store.ts`の`updateHistoryOwned`は、候補受付前のOwner／時刻／modeとresume_decisionの早期終了、候補取得後のState結合・保持・pending照合と物理出版を接続する。候補のnullと例外は元の停止契約へ返す。Storageは単純なI/O Wrapperではなく、モデルの判定を現在Owner・fresh本文・CAS・実終了証拠へ結合するが、行重複やDecisionイベントの意味規則を再実装しない。

`prepareHistorySummary`は既存encoderのbyteを複製・再符号化せずHash化し、既に固定されたHashだけを照合する。要約可能条件はTask／RepairごとにStateから既存Attempt判定へ接続し、導出元State HashはStateが付加する。`operationHistoryLine`はTaskの固定済み行Hashを照合し、初回候補にも使うhistoryLineBytesの意味は変えない。Repairの転送Helperは置かず、既存repairHistoryLineBytesを履歴欠測null・保存済みoccurredAtの条件で使用する。HistoryからAttempt validationへの逆参照は追加しない。


##### 局所検査から全State候補への逆依存の撤去 — 2026-11-14

Objectiveの定義更新候補とEntity単位の更新用Hashは`objective/operations.ts`、Project定義全体の同一性Hashは`objective/validation.ts`、Task／Queueの同版候補・投影は`task/operations.ts`が所有する。両operationsは全State検査とモデル局所検査を使用するが、State検査は局所validationだけを参照し、用途候補へ戻らない。小さい値処理は既存`state/operations.ts`の単一実体を利用し、全Stateのdecode・相関・遷移を同ファイルへ移さない。Schema・保存識別子は`state/types.ts`に置く。

Historyの`historyRow`と全行検査は`history/validation.ts`が所有する。全Stateの閉鎖判定・履歴確認・参照保全を必要とするpending生成／記録退役／搬送確定は、唯一の利用元であるHistory CRUDの局所関数とする。状態を使う候補を、Attemptからも利用する履歴行生成operationsへ混ぜない。義務観測・時計・受付世代発行の位置と回数、失敗の短絡順を維持する。

局所validationの新品NodeロードでState検査・CRUD・Storageを解決しないことを確認する。この分離は局所検査同士のすべての参照を禁止するものではなく、全Stateの同版相関はStateが引き続き所有する。公開93項目・Schema・Hash本文・単一Writer／CASは変更しない。

##### Checkpointの完成操作とState保存証拠のOwner — 2026-11-14

`saveOperationCheckpoint`の実体はAttemptのCRUDが所有する。同じ操作の現在値を既存Readerで取得し、六種の候補生成と元版照合Writerへ接続する。State側に旧宣言・再export・転送Wrapperを残さず、Rootの公開名・引数・結果・保存順は維持する。

Storageにある`settlements`はWriterが短命証拠を一回消費する状態、`initializations`は初版の物理出版と失効の状態、`historyAttempts`は保存確認かつLock解放後に確定する発行・pending再入場の証拠である。単なるAttempt／Historyの値モデルではなく、単一Writerの調停状態として一体で所有する。

`completeRecovery`と`saveRepairRecord`の対象選定・候補・結果投影はAttempt CRUD、`saveRecoveryHistory`の完成保存と段階制御はHistory CRUDが所有する。`resumeRepairRecordSave`は固定保存物の再観測とpending確定であるためStorageに置き、Rootから直接公開する。旧所在地の転送Wrapperは残さない。

内部の`publishRecoveryState`は既存の四証拠用途だけを受け、Context生成・必要な初期化・一回の保存・finally失効を一体で行う。Mapや可変証拠は返さない。認証終了も同じ入口を使う。`publishStateOwned`は取得済みOwnerでのTask／定義保存だけを単一Writerへ接続し、排他の再取得・解放をしない。両関数はRoot非公開で、新しいManager・Registry・Mapはない。

保存形式、初期化Effect、元版比較、証拠消費、rename直前の発行状態更新、保存と解放成功後の履歴試行登録を維持する。PublicationからState CRUDへの参照は既存Reader結果の型だけで、実行時の逆依存は作らない。

##### Snapshotの保存正本・投影・Reader結果 — 2026-11-14

| 型／結果 | 役割 | Schemaと差分 |
|---|---|---|
| `ExecutionStateSnapshot` | 19fieldを明示した唯一の保存値正本 | state/v4。定義のみのprojects、nullableの業務結合・受付世代を保持 |
| `ExecutionOverview` | 保存正本の6fieldをPickした技術現在集合の投影 | 正本と同じstate/v4。独立保存しない |
| `Snapshot` | 9共通fieldと7投影固有fieldを組み合わせるモデル操作用の値 | project-snapshot/v7はメモリ投影の識別。管理Project・non-null結合と受付世代を持つ |
| `decodeStateSnapshot`の結果 | 検査済み正本と本文HashのReader結果封筒 | 保存値そのものの別名ではなく、現在本文との相関を付加する |

同一だった`UnifiedSnapshot`／`DecodedStateSnapshot`の型別名は撤去し、内部・試験も公開済みの正本名を使う。正本を投影のOmit合成で定義せず、投影が正本を参照する向きへ統一する。保存JSON、Schema、null許容、配列readonly、Leaseの省略可能なphysicalIdentityとnull許容は変更しない。JSONの解析と値の符号化であり、暗号化・復号化は行わない。公開型の追加や削除はない。


##### 特殊Queryの退役と通常CRUD — 2026-11-14

queryDecisions（Decision＋Blocker）、queryExecutionState（Project定義＋管理実行）、queryWorkspaces（Queueが参照するWorkspaceだけ）は、モデル単体の通常CRUDではなく用途固定投影だった。3宣言・Root・内部の専用分岐・ExecutionContentViewsの対応型を撤去する。通常のqueryPlan／queryObjectives／queryTasks／queryQueue、単件Decision取得、既存本番のreadState同版取得は維持する。特殊照会の同名Wrapperや新Facadeは作らない。

readExecutionContentの用途はplan／objectives／tasks／queueに限定し、旧三種・未知用途は認可／Repository観測前に拒否する。通常Queryの現在認可、Lock、同版version、absent／unknownと解放確認は維持する。Decision保存内容とBlockerの相関は既存単件取得と自己生成保存物で確認し、通常Queryの認可負例とは区別する。

この区切りはRoot全体を通常CRUDだけにしたという主張ではない。当該段階では既存readStateの複合取得、readTaskIntakeStateとreadOperationCompletionの用途固定観測、保存・回復の業務操作は変更しなかった。後続で二観測を既存Readerへ統合した。後者の必要性と配置は次のOwner判断へ分け、排他内の同版観測を逐次読取りへ分解しない。


##### 受付集合と終了観測の既存Readerへの統合 — 2026-11-14

独立したreadTaskIntakeStateは撤去し、既存readStateのqueue範囲へ接続する。Queue集合・Lease Intent・受付世代は元のreadSnapshot通常モードを一回だけ使用し、field参照・明示不存在・結合・読取り失敗・解放不明を維持する。既存intake範囲は出版確認付きモードのままで、二つの読取り条件を同一視しない。

独立したreadOperationCompletionは撤去し、readStateのrecovery範囲でkind=completionと回復ID・correlationIdを要求する。完全key捕捉後に値を検査し、同じreadStateSnapshotのcompletedOperation引数へ渡す。operationCompletionConfirmedは単なる操作不存在ではなく、同じ操作nonceの残存拒否、終了履歴の現Schema・回復ID・上位相関、読取り成功と排他解放の共同成立である。Readerのreason・value・回復参照等を封筒ごと保持し、falseを不存在へ読み替えない。

二宣言・Root公開・旧Wrapper・利用側の別名importは残さない。保存方式・型の正本・新Mapは追加しない。この二Reader統合の段階では保存三操作の完成単位は未変更だった。後続で資源再保存を既存の完成保存入口へ統合した。phaseやmodeへの名前付替えだけを完成扱いにしない。


##### 資源Checkpoint再保存の完成入口 — 2026-11-14

独立したresumeResourcePublicationは撤去し、saveRecoveryCheckpointがkind=resource_publicationの要求を受ける。上位はreadStateのresource_publication観測が返したbefore／candidateの一組を、そのままpublicationとして渡す。別々の本文を組み立てず、EMがrequestの三keyとpublicationの二keyを捕捉する。専用の元本文引数はnullのみで、通常Buffer入力の型からこの用途を除外する。

case本体は元のclassifyResourcePublication、fresh ReaderのresourcePublicationRecoveryId、両本文のexact比較、Owner再確認、既存Writerと保持設定再確認を保持する。未知field・用途混在はOwner観測前に拒否し、上位の保存後fresh Readerと候補一致確認も残す。元pairを改訂番号や新Hashで代替しない。旧Root名・別名Wrapper・新Map／Readerはない。

completeStatePublicationは保存marker自体とともに撤去した。saveRecoveryHistoryは要約固定・履歴保存・最終fresh確認を一回で完結させ、Coordinatorの段階ループは撤去した。変更計画§14.64のmarker組込み案は実装せず、marker不要化で置き換えた。

##### 退役設計本文の整理 — 2026-11-17

旧Domainの5文書と、CROS・Artifact Signing・Official Asset Governance・Runtime Trustの4文書を、現在Ownerへの短い退役案内へ整理した。旧本文・転送見出し一覧は削除し、新しいArchiveや互換Anchorは作らない。当時の設計・観測結果はGit履歴と既存の変更・検証記録で追跡する。

通常文書の参照は現在のモデル・保存・認可のOwnerへ接続し、旧Path棚卸しの件数や容量を現在の事実として扱わない。変更履歴内の削除済み見出しへの参照は、既存の`[旧参照]`規則で履歴と区別する。詳細設計Mapの非現行登録を維持し、4領域の分類をRetiredへ統一した。通常リンク・領域実在の検査は除外しない。

署名機能と独立Trust評価器には代替実装を追加していない。公式資産の表示接続はPartial、権利・利用・判断記録の接続は未成立のままであり、ARCH・ReleaseのMissing／OPENを解消済みとしない。保存形式・Path・公開API・品質義務・判定結果は変更しない。

Checkerの汎用Architecture試験は、Checklistの取得元だけを退役した署名設計から現行Checker設計へ変更した。15項目が同一であることを照合し、検証内容・期待値は維持した。限定22試験、Checkerの型検査2構成と対象試験の静的検査は成功した。文書検査は1,207文書・15,466リンク・2,877アンカーを確認し、Error／Warningは0件だった。中断された初回検査の空結果は採用していない。

独立レビューで、過去Commit Cのexact Path許可一覧を現在Ownerへ置き換えた誤りを検出した。当該一覧は元の本文へ復元し、Workflowの今回差分をなくした。現在案内の参照更新と、過去の許可範囲・固定観測の保存は別の処置とする。Qualityのリンク表示名も現在の案内に揃え、導出キー・Local ID・判定・未確認本文は変更しない。

指摘是正後の固定候補は、現在Owner・未達の意味確認と、文書・参照・試験接続・直接伝播の独立再確認の双方で必須残指摘0となった。今回専用試験Rootは、作成時の所在・dev／ino・Linkでないことを照合して回収し、不存在を確認した。全体回帰・実AI・Docker・過去保持物の操作は実施していない。これを全体品質・実環境・統合の成立へ読み替えない。

##### 独立Trust評価・素材専用機能の要求範囲整理 — 2026-11-17

人間判断により、独立Trust評価器・汎用Policy管理と、公式素材の専用画面・判断API・Engine・Storeを製品要求・開発残件から外す。単なる未接続注記や対象外ラベルで旧本文を温存せず、要求、UX、IA、UI／SPEC、Architecture、QAの本文と派生表を改訂する。既存Ownerの内容同一性・認可・隔離・品質確認、導入責任者の判断、素材文書の出所・権利根拠・許可用途・対象版・判断者と収載・公開時の人間判断を維持する。安定ID・関係は維持し、専用機能の廃止を既存の実行許可や権利確認の免除へ広げない。

着手前に上流系列とQA／現在Ownerの観点を読取り専用で独立照合した。基準版は`a0fb5effc`。要求18／25からUX20・IA15・UI13／SPEC18、要求35からUX30／31・IA19／15・UI19／13・SPEC24／18へ伝播する。工程・文書の独立確認と不足／影響の伝播確認を行う。製品実装・公開API・中核準拠基準・リリース判断は変更しないため、それらの全面監査や実環境の検証は今回行わない。

QA-000010では専用評価・署名方式と抽象的な重複だけの10項目、QA-000011では専用Store・判断競合だけの3項目を現行集合から撤去する。正式項目は204から191件となるが、成功数を増やすものではない。現存するAIT-ST-004・AIT-UT-005・AIT-IT-008の試験は実行経路・権限・隔離・Task／Reviewer契約を現在も検証しているため、既存の検証内容を維持して説明を実対象へ合わせる。純専用試験・実装は既に撤去されており、復活させない。共用assertionの旧署名項目への参照は撤去する。過去の事実はGit履歴と既存変更・検証記録で追跡し、現行の検証本文・開発待ちには残さない。

反証は、署名や公式表示だけで実行可能・品質確認済みになること、専用Policy操作が必要になること、素材文書の存在を専用Store完成と扱うこと、権利不明の収載を許すこと、現存する具体的試験を廃止機能と一緒に失うこととする。全体回帰・実AI・Docker・過去保持物の操作は対象外。未評価をPassにしない。

限定確認は文書モデル36件、既存Ownerの75件、Architecture／台帳接続の2件が成功した。75件の初回ではProvider Home Coverageの旧試験Path期待値1箇所が失敗したため、現在の実在Pathへ追従し、75件を再実行して全成功を確認した。assertを削除・緩和していない。Coordinatorの本番／試験とCheckerの本番／配布入口の4型構成は成功。変更した試験11Fileの静的検査は成功し、安全なimport整形4Fileを追従した。既存の情報レベル提案1件はエラー・警告ではなく、この範囲では自動のunsafe修正を適用しない。

初回候補の文書検査は1,207文書・15,445リンク・2,870アンカーを確認してError／Warning 0件。途中のQA集計・段階要約・IA名称対応・改訂Fingerprintと削除節への参照の不整合は、規則を緩めず正本側を追従した。旧署名本文と一緒に失ってはならない作業対象Revision／Git投影の現行契約と既存Anchorは維持した。

完成後の二観点独立レビューで、旧検証意図・SPECの旧副作用引用・SCR／BHVのGrant／Component／機械的結果返却・現行案内の旧Policy前提・現在版再署名待ちを検出した。全結果を統合し、両確認者との方針整合後に本文と派生投影を是正した。さらにAIT-IT-002／003は利用先のない抽象的な重複と判明したため、初回候補193件から2件を追加撤去した。REQ-000034は既存のQA-000001のRCM-IT-003／005／RCM-UAT-006、配布入口はRCM-IT-008／009、観測不能はQA-000006の現在境界へ対応済みであり、新しい抽象Helper・検証項目は作らない。根拠不足を区別する人間判断はAIT-UAT-006に残し、既存Ownerの異常拒否や未観測を変えない。

更新固定候補の再確認では旧PA義務照合行のAIT-IT-002参照1件を検出し、そのtokenと区切りだけを削除した。他のPRL／ERB／AIT-UT-005、OPEN、保持物条件は維持する。是正後の二観点独立再レビューは必須残指摘0。限定36件と75件は更新後も再成功した。最終文書検査は1,207文書・15,441リンク・2,870アンカーでError／Warning 0件。今回専用試験Rootは作成時の所在・dev／ino・Linkでないことを再照合して回収し、不存在を確認した。全体回帰・実AI・Docker・過去保持物の操作は実施していない。

##### Checker単体全試験とSemantic入力追従 — 2026-11-17

基準版`8398051e1`でChecker自身の26試験Fileを既存test-runnerから全件実行した。474件中471成功・2失敗・人間の計画理解を確認する明示Skip 1、約9分46秒だった。失敗2件はQA-000010の旧空Semantic表を試験入力へ残した同一原因であり、17個の現在Semantic関係そのものの欠落ではない。旧表・独立Trust機能を復活させず、試験の共通qualitySourcesから同文書一件だけを撤去した。未信頼入力の拒否・必須関係の閉包・17件の完全性を検査する既存assertは変更しない。

更新したrepository/semantic試験Fileは9件すべて成功し、直前に失敗した2件も解消した。その他25File・465件は実装・入力とも不変更のため、直前の全試験結果（成功464・明示Skip 1）を継承する。結果を重複加算せず、現行自動試験の473件と未実施の人間確認1件を区別する。修正後に全26Fileを再実行したとの主張はしない。

Checker範囲のFormatter・Lint、型検査2構成は成功し、変更FileのFormatter・Lintと両型構成も再成功した。補助的に実行したbiome checkのimport／export整列診断8件は、packageが要求するFormatter・Lintとは別のassist診断であり、規約・検査設定を変更せず区別した。製品Source・公開API・診断契約・台帳ID・試験assertは変更しない。今回の試験専用Rootは所在・dev／ino・Linkでないことを再照合して回収し、不存在を確認した。リポジトリ全体回帰・実AI・Docker・過去保持物は操作していない。更新固定候補の独立確認は必須指摘0であり、旧空表の寄与0、現在の17関係の完全性と既存拒否条件の維持、台帳変更不要、結果継承と未実施の区別を確認した。今回のChecker整理と自動回帰確認はここで区切り、明示Skipの人間確認・全体品質・Releaseの成立は別に保持する。

##### 実行モデルの二役割選定受付の内部化 — 2026-11-25

基準版`ce27372e0`。編集・独立レビュー担当の選定組は、新規受付ではCoordinatorが同じ確定設定から生成し、再開時は実行モデルの保存Readerが検査した同版の組をTask本文とは別に渡す。組の閉形式・役割・選定元・設定／Catalog／分類の相関検査は保存Ownerに残し、`inspectTaskExecutionSelections`のRoot公開だけを撤去する。認可、送信前確認、保存形式およびLock・CASは変更しない。

限定回帰で設定検査一回と二役割の技術照合、単発・Objective・助言の搬送、不正な保存選定の拒否、公開境界、MCP・ローカルHTTPの利用側を確認した。保存Readerを追加せず、保存された選定を現在のCatalogで引き直さない。独立レビューと不足・影響の確認では、本番の選定の由来、Packetの相関、保存形式、利用側への伝播を確認し、旧引数が残った関数説明を更新した。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 単一Writerと固定保存入出力の統合 — 2026-11-25

`storage/publication.ts`を廃止し、State・履歴の物理Writer、再入場、CAS、三つの短命証拠を既存`storage/store.ts`へまとめた。初期化候補の操作／回復義務の相関はState、未受領資源の不存在判定はAttemptへ戻した。履歴候補・用途別遷移は既存の値所有者を利用し、Writerが元版・実体・Ownerを短期排他内で再確認する。保存形式、取得・再検証・証拠消費・保存・読戻し・解放の順序と公開集合は変えていない。

限定試験は公開／独立ロードと保存検査31件、故障注入の保存境界6件、自己生成領域の通常保存／初期化再入場／終端／修復4件、修復履歴・再入場29件、Coordinatorの利用側5件、Checkerの公開境界1件が成功した。独立レビューでは旧Writer本文と短命証拠を照合し、ソース準備対象が11から10になった現役文書の記述を追従した。実行時依存の循環、旧Pathへの現役参照、追加の読取り・保存・Lock取得はない。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### Queue選択の完成操作化 — 2026-11-25

`selectNextQueueEntry`が同じ短期保存Owner内でQueueを選ぶ。現在Ownerの保全、対話優先、待機中の予約、未開始の予約、同順位ID順、必要な待機／復帰だけの一回保存を維持した。外部から選択関数や差分を渡す入口は撤去した。CoordinatorはLease前後の選択結果と自分の実行対象を照合し続け、選択自体を認可や実行所有にしない。

旧・新の値処理を合成Queueで比較し、独立レビューの71,874組で選択・理由・世代・候補が一致した。実Storeでは読取り故障で保存しないこと、短期排他解放後に再取得できること、旧選択関数を実行しないことを確認した。公開数・保存形式・読取りとLock取得の回数は変更していない。

##### MCP判断の差し替え入口撤去 — 2026-11-25

判断Toolを正式な`submitDecision`に限定した。既存の要求検査の後、信頼済みローカルまたは共有Repositoryを選び、現在認可と公開直前の再認可を維持する。旧設定の判断関数は呼ばず、互換HTTP／stdio開始関数も公開から撤去した。試験は製品の共通Transportへ直接接続し、有限代役は試験内だけで組み立てる。Objective／状態照会の既存経路、判断の完全応答と不正結果の拒否、保存順序は変更していない。この段階ではEMの判断モデル検査をRootから外していない。

##### 判断モデル検査の内部化 — 2026-11-25

`saveDecision`が判断候補の完全な本文と対象IDを検査し、検査済みの値を返す。既存履歴の再開、新規State確定、最終履歴の保存順は維持する。不正候補では新規Stateと最終履歴を確定しない。Coordinatorは判断本文を再検査せず、正式操作内部で結果の状態・回復参照・履歴との相関を検査する。MCPは認可済みの正式操作の完全応答を使い、結果未確認時の失敗と公開直前の再認可を維持する。追加の読取り・保存・Lock・Catalog照会はない。`inspectDecision`と旧Coordinator結果検査のRoot公開を撤去した。

限定回帰では不正候補の拒否と完全応答、履歴再入場、公開契約とMCPの結果搬送を確認した。境界を横断する独立レビューで、未検査の判断本文を受け取る旧公開入口が残らないことを確認し、是正後の必須指摘は0件。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 助言の配送受付から技術計画への確定選定搬送 — 2026-11-25

配送受付で完全選定を一度捕捉する。Packet側が同じ不変値であれば再捕捉せず、別参照なら閉じた全項目をその値と照合する。技術計画には捕捉済みの選定を渡し、計画本文からの再取得・再検査を撤去した。技術Catalog照会、拒否条件、取消確認、Packetの発行・一回消費、Hash・保存形式は変更していない。この段階では単体選定のRoot公開は維持する。

限定回帰で別参照の同値・不一致、余剰・Getter・Proxyの拒否、確定選定の同参照搬送、Packet発行と一回消費、取消・回収状態を確認した。独立レビューの必須指摘は0件。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 実行前の選定照合を現在操作と技術適合に限定 — 2026-11-25

Task全体・各段階・助言の事前照合には、新規受付で確定した選定、又は保存Readerが検査・凍結した同版の選定だけを渡す。未知値を再捕捉する受付を事前照合から撤去した。現在の操作とRepositoryの照合、選定件数、AI Adapterの技術照合と最初の不一致での中断は維持する。未知値の閉形式検査は実際の受付・保存のOwnerに残し、設定読取り、Catalog照会、Packet発行・消費を追加しない。

限定回帰と独立レビューで、選定の由来・同参照の搬送、現在操作／技術適合の拒否と呼出し順、外部通知経由で選定を差し替えられないことを確認した。単体選定のRoot公開は引き続き残る。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 発行済みPacketから開始計画へ選定を一本化 — 2026-11-25

Task・助言の開始準備へ完全選定を別渡しせず、同じ発行結果のPacket参照・使用参照を渡す。管理、Mount、Homeの照合後に元のPacketを一回消費し、発行済み参照・操作・Provider・役割・試行の相関が成立した場合だけPacketの選定から技術計画を組む。未発行・別Packet・旧入力を拒否し、取消・失効、送信条件、保存形式、Catalog照会数は変えない。Doctorの隔離Probeは通常開始とは別の入口であり、この変更では触らない。

限定回帰と独立レビューで、別発行の参照、用途混在、取消・回収、引渡しと技術計画の一致を確認した。単体選定のRoot公開は発行前と保存開始の残る利用側を整理するまで維持する。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### Packet発行で確定選定と本文を分離 — 2026-11-25

Task・助言のPacket発行へ確定済み選定を本文と分離して渡す。選定の再検査を撤去し、本文の閉形式、用途・Provider・役割の相関、送信・Ownerの条件を維持する。選定は従来と同じ十項目・順序で独立した不変値に揃え、発行時Hashの直列化順と一回消費・取消を維持する。読取り、Catalog照会、永続化の追加はない。回復記録の開始・完了が共用する検査は現在の入口と観測順を保つため維持し、EMの保存検査も変更しない。

##### 単発助言の受付から技術計画までの選定を一本化 — 2026-11-25

単発Taskで確定した不変の選定を一度取得し、Project Contextの投影と結合して助言Packetへ固定する。配送・技術計画はそのPacketを受け、選定の再取得・再検査・別搬送をしない。投影本文からの選定差替え、要求のGetter、技術Catalogと不一致の候補はProvider呼出し前に拒否する。選定と本文のHashの順序、許可参照・機密・通信先の検査、取消、読取りとCatalog照会の回数は維持する。限定回帰と独立レビューで確認し、全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 単体選定のRoot公開撤去 — 2026-11-25

`inspectExecutionSelection`をEMの保存モデル内だけで使用し、Rootは92項目（56値・36型）とする。Taskと助言は通常準備で同じPacketの選定を使用し、選定付きの未接続Probe分岐は撤去する。Doctorの隔離Probeは既存の選定を持たない入口を維持する。回復記録の開始・完了は準備済み選定を受け、Provider相関と値記述子を観測前に確認する。開始保存での完全な選定検査、完了時の保存済み選定との全項目一致、元Owner・保存版・資源の照合は維持する。保存形式、読取り・Catalog照会・Lock取得の追加はない。

保存選定の閉形式・過去値・Getter／Proxyの試験は検査を所有するEMへ移した。旧Probeを模した準備試験は製品のTask経路に追従させ、Doctorの隔離Probeは既存の資料・通知・取消・回復試験で確認する。全体回帰・実AI・Docker・既存保存物の操作は行っていない。

##### 設定済みServerのObjective受付を一回化 — 2026-11-25

ローカル・共有の新規／再開はCoordinatorの正式操作で要求と計画を一度捕捉する。Serverは受付に先行して計画を検査せず、確定後のProject／Workspace識別子から対象と主体を選ぶ。Workspaceの遅延読込み後は現在認可・観測と実行入口を同じ同期区間に置き、読取り・保存・Lock取得の増加を避ける。認可・取消・結果未確認の分類、共有の公開直前認可を維持する。未使用の計画検査転送を撤去し、試験は正規の要求を通す。CLI、直接構成、EMの保存検査、計画検査のRoot公開はこの段階では変更しない。

##### 通常の同版照会と技術操作の読取りを分離 — 2026-11-25

同版照会は `readQueueState`、`readExecutionState`、`readWorkspaceState` に切り替え、旧scope指定の受付は残さない。利用側へ渡る項目、上位の対象・権限確認、保存版の読取りとLock取得の回数、不在・破損・観測不能の区別は変えない。`readState` は現在Ownerまたは回復権限を要求する技術経路だけに限定し、その取得内容の縮小は次の段階で扱う。

##### 技術照会の全State投影を撤去 — 2026-11-25

技術照会の構造化した返却項目は、同じ保存版の改訂・操作記録・未解決の回復義務と従来の照合結果に限る。全保存型はRootから外し、通常のProjectを技術経路から公開しない。保存形式・保存本文の完全一致・元Ownerと回復権限・Lock取得と解放・読取り回数を維持する。Host回復の同版比較は、既存codecが一意な正規表現を検査した本文を厳密な照合に使う。物理形式を確認する試験は試験所有の本文を使い、製品の全状態投影へ依存しない。

##### 履歴・終了の候補本文を保存Ownerに閉じる — 2026-11-25

技術照会は履歴確定の段階と終了確定の準備成立だけを返し、進行前後の本文・履歴ファイル・実体参照を上位へ渡さない。Coordinatorは同じ段階で正式な履歴／終了確定へ接続する。保存Ownerの履歴照合・現在確認・候補完全一致・排他・読取り回数は変更しない。本文を比較する試験は保存Owner側で、利用側は正式Writerと実保存された対象・元版・結果で確認する。

##### 資源回収の途中保存で候補の組を内部化 — 2026-11-25

資源回収では、同じ読取りで観測した元版と候補をEMが一組で固定し、Coordinatorへは完全一致と確定後の照合だけを渡す。既存Writerは別の組・偽造・Owner失効・分類不正を停止させ、保存直前の再読取りと排他を従来どおり使う。候補本文の上位での生成・保持は廃止し、本文の照合をHashだけに置換しない。保存形式、読取り回数およびRootの公開項目数は変更しない。

##### 回復Writerの元版入力を読取り由来の証拠へ変更 — 2026-11-25

再起動、回収、Host確認、認証不明の終結は、元版をCoordinatorでBufferへ変換せず、同版を比較できる`versionEvidence`を引き回す。Writerはその値を内部で元本文へ接続し、既存の完全byte比較、現在Ownerの確認とLock内の再確認を維持する。生Bufferを回復保存の受付に残さず、新しいStore・Lock・Root関数は追加しない。照会結果の元本文は、物理保存を検証する試験の追従と一緒に別段階で撤去する。

##### 保存本文を比較する試験を試験所有ファイルに接続 — 2026-11-25

Host回復、資源と修復結果、TaskおよびWorkspaceの試験は、各試験が生成した保存ファイルを比較する。Readerが返した本文ハッシュは同じ版の観測を確かめるために使い、既存の保存結果・全区画・失敗時の不変性の比較を省略しない。比較対象の元版は書込み前に取得し、遅延した別操作の準備中に元版が変わらないことを確かめる箇所は従来の観測位置を保つ。製品のReaderやWriterには読取り・保存・Lockを追加しない。変更対象外のTask結果試験補助が元本文を参照するため、公開照会からの本文撤去は未完了とする。

##### 計画受付と保存の順序を照合 — 2026-11-25

設定済みServerからの新規・再開は、Coordinatorの正式受付で計画を検査し、Taskごとの実行入力を照合してから対象解決へ進む。直接構成の差し替え入口では、ServerがCoordinatorの同じ受付関数で捕捉した要求を渡す。どちらも、計画を先に保存したり、再開時に検査前の入力で既存Queueを検索したりしない。

計画の構造・依存閉包・許可範囲はEM、実行要求との受入条件照合・Taskごとの指示・対象解決の順序はCoordinatorが所有する。受入条件は既に捕捉した文字列配列の件数と順序付き完全一致で比較し、JSONへの変換は行わない。一般定義の `savePlan` は認可と保存版を要する別操作であり、管理実行の新規・再開の両方に先行する純粋な受付には使えない。単なる改名やCoordinatorへの検査規則の複製は行わず、公開境界の最終判断を残す。正式入口の試験で新規と再開の両方について、循環・範囲外・受入条件の不一致・Task入力欠測が対象解決前に拒否されることを固定する。

##### 現行の保存・実行設計と再編範囲の照合 — 2026-11-25

利用側・公開集合・保存境界の独立Gap照合で見つかった現行設計の不一致を是正した。Queueの選択はEM、単一WriterとCAS・途中保存の再入場は`storage/store.ts`、回復処理での元版指定は`versionEvidence`である。公開契約・判断・Queue・Writer・履歴・選定・計画搬送を対象にした限定回帰は86件成功した。元版の見かけだけを偽造した値とProxyを拒否し、副作用を起こさない反証も追加して、該当2件を再確認した。全体回帰、実AI・Docker、既存保存物の操作は行っていない。公開照会の保存本文と計画検査の公開要否は、この照合をもって解消済みとはしない。

##### 技術照会の保存本文撤去と計画受付の確定 — 2026-11-25

人間の承認に基づき、最後のTask結果試験補助を試験所有ファイルのバイト比較と公開照会の同版ハッシュ照合へ切り替え、技術照会の`sourceText`を撤去した。内部の完全本文比較、保存形式、権限確認、製品の読取り・保存・Lock取得は変更しない。計画検査は新規・再開とも認可・保存観測前に必要なため、人間の判断で`inspectExecutionPlan`の独立公開を今回は維持する。別名の受付や互換処理は設けない。

Rootの公開集合は94項目（値59・型35）。技術照会の固定形状、履歴・回復Writer、Taskの終端と再入場を含む最終差分の限定回帰35件、EM・Coordinator・CRDD Serverの型検査が成功した。独立Gap再確認に必須残指摘はない。全体回帰・実AI・Docker・既存保存物は対象外とし、コミット・プッシュは行っていない。

##### 同一保存版の照合を索引化 — 2026-11-25

保存版の復号中に、操作IDとHost、回復IDと技術操作、Taskと回復参照を一度対応付ける。既存の終了・履歴・未解決の検査は維持し、Host欠測・重複・未回収の組を成功へ補完しない。開始と終端の候補生成、Project定義とTaskの照合、判断とBlockerの照合およびCoordinatorの活動結果の重複検査も同じ断面内の索引へ切り替えた。要約と履歴行は同じ要約値から符号化し、正規本文・Hashを変えない。索引は処理ごとの局所値で、保存Schema、Root公開、複数段の保存、Lock取得、確定後の読戻しは変更しない。

実保存なしの状態codec試験で、清掃確認済みHostとDocker Taskが各1・16・129件のとき、Docker Task識別値の解析回数を1・16・129回に固定する。欠測・重複HostとLease未解放を反証する。案Bの同一本文再検証削減と、合意したSource構成（モデルの`transition.ts`、`history/records.ts`、`lease/`、`composition/`）への移行はこの性能差分に含めない。現行のRoot公開集合との一致は、合意した最終配置への一致を意味しない。

129件の既存実保存試験は索引化後の限定実行で約247秒で成功した。前回の約340秒は実行条件が同一ではなく、この差を案A単独の短縮量とは扱わない。通常終端・履歴不一致、旧履歴行生成とのバイトおよび二種のHashの一致、EM／Coordinatorの型検査、独立再レビューを確認した。

##### 実行モデルの宣言元とファイル構成を確定 — 2026-11-25

合意した31ファイルへ移行した。各モデルの遷移、履歴行、Lease、全体の状態組立てをそれぞれ `transition.ts`、`history/records.ts`、`lease/`、`composition/` に配置した。物理保存は引き続き `storage/store.ts` と `storage/lock.ts` が所有する。旧位置の転送は設けない。Rootは59値・35型を維持し、各公開項目の宣言元も照合した。計画の独立検査は維持し、選定・判断の旧検査と全Snapshot型は公開しない。

保存形式、単一Writer、排他内の再検証、CAS、保存と読戻しの順序を変更しない。案Aの1・16・129件に対する解析回数の反証を含むEM限定96件、Coordinatorの終端2件、Serverの保存境界8件、Checkerの公開元・台帳・旧参照3件、およびEM・Coordinator・Serverの型検査が成功した。Windowsのリンク作成権限を要する保存境界は、試験用の一時領域で権限付き限定再実行を行い、10件が成功した。全体回帰、実AI、Docker、既存保存物は対象外とした。

約247秒は案A実施時の実保存129件の結果であり、配置変更後の所要時間ではない。この移管は同じ保存の逐次処理を短縮しない。既存の保存境界を守ったまま、同じ本文の再検証を減らせるかは案Bとして別途扱う。

##### 同じ観測内のパス確認を統合 — 2026-11-25

実行モデルと構成モデルでは、一回の保存領域観測で同じ正規パスを二度求めず、指定パスと一致した正規パスから実体を再取得する。Version Controlは指定パスと正規パスが完全一致する場合だけ、中間の実体取得と解決後の実体取得を一回にする。別名の場合の双方の照合、別段階での再観測、排他、CAS、最後の読戻しを維持する。上位の認可・Git配置確認の再発火条件、保存形式、公開IFは変更しない。

既存試験を変更せず、同一操作のNodeファイルAPI呼出し回数を再計測した。履歴保存は2,874→2,574回／2,955→2,655回、AI設定初回保存は243→210回、5パス選択観測は1,446→1,396回。上位経路ではHTTPのAI設定初回保存が1,820→1,733回、Workspace作成が8,456→7,787回。Git子Process内部のI/O、試験準備、処理時間の比較はこの計数に含めない。

独立確認の指摘に対し、同名・別名、実体の差し替え、ファイルシステムのアクセス拒否、観測途中の消失と最初からの不存在を区別する24件の反証を、既存試験を書き換えずメモリ内で追加確認した。全体回帰、実AI、実Docker、既存保存物は対象外とした。

##### 単体WorkbenchのAI設定保存で同じ段階の配置確認を統合 — 2026-11-25

単体では保存委譲前に書込み用Repositoryを取得し、保存中と公開前は書込み用Repositoryを一度だけ現在観測し、受付時の正規パスと完全一致で照合する。Windowsの大文字・小文字だけが異なる場合も、書込み用Repositoryの正規パスが受付時と異なれば従来どおり拒否する。共有では設定管理・選択Repositoryの現在認可とGit配置確認を併用し、単体の処理で代用しない。異なる段階への観測再利用、保存形式、排他、CAS、読戻しの変更はない。

HTTP経由の単体AI設定初回保存は同条件の計測でNodeファイルAPI呼出し1,733→1,241回、うちVersion Control 1,517→1,025回となった。既存HTTP試験2件と型検査が成功した。別途メモリ内9件で、単体の同一段階の観測回数、共有の両照合、受付前・保存中の拒否、保存後の確認失敗と取消、正規パスの字面違いを反証した。既存試験は変更せず、全体回帰・実AI・Docker・既存保存物は対象外とした。

##### 回復履歴の新規途中ファイルの重複読取りを撤去 — 2026-11-25

現在回復の履歴確定で新規作成した履歴・状態の途中ファイルは、作成処理で行う直後の本文照合を利用する。別の処理を挟まない重複読取りだけを撤去した。既存途中ファイルを使う再入場、元版CAS、flush後の再確認、最終読戻しを維持する。独立Gap確認で指摘されたリンク数変化は、新規の2対象に限り既存のflush前の実体観測で検査し、そのflushの発行記録とfsyncより前に停止する。

同条件のCoordinator試験で履歴保存一回のWriter固定ファイル確認は40→37回、NodeファイルAPI呼出しは2,574→2,418回／2,655→2,499回。正常終端・履歴不一致、修復履歴の途中故障と再入場、リンク数・実体・観測不能を変えたメモリ内8件、型検査を確認した。既存試験は変更せず、全体回帰・実AI・実Docker・既存保存物には触れていない。

##### 保存確認を維持し、回復の元版を再符号化しない — 2026-11-25

残る履歴観測の統合案は採用しない。Writer入場時と候補組立て直前の間にOwnerや保持設定の確認があり、その間の差し替えや一時ファイルの出現を後の一致だけで成功に変えない。従来の観測順を維持し、Writerの固定ファイル確認は37回のままとする。

同じ読取りで復号・正規符号化との一致を確認した本文を独立コピーし、回復の履歴・完了候補へ元版として渡す。元版CASのバイト列、保存順序、排他、最後の読戻しは不変。2件の合成Task終端で旧式をメモリ上だけで再現した比較では、保存ごとの符号化呼出しは725→722回／831→828回、全状態検証31回・3読取り・2書込みは同じ。短縮時間や129件の再計測結果ではない。保存・公開境界18件、修復履歴と故障再入場12件、型検査と独立再レビューを確認した。既存試験の変更・全体回帰・実AI・実Docker・既存保存物の操作は行っていない。

##### 回復履歴の保存を一回の排他に統合 — 2026-11-25

回復履歴の保存は同じ短期Lockを借用して要約固定と履歴確定を行う。通常の二段保存ではLockの取得と解放は各5回から各1回に、専用Readerは3回から2回になった。最後のState本文の再読を行わず、従来の結果形式で確定候補の版とハッシュを返す。この変更は回復履歴だけに適用し、他の保存や上位の観測手順は変更しない。

CAS・同期・履歴内容の照合・再入場は維持する。独立レビューを受け、最後の途中ファイル混入と同じ本文の履歴ファイル差し替えをファイルの名前・実体で拒否し、Lock解放後のOwner再確認も残した。Windowsの試験用保存先でLock一回・State再読なし・途中故障と再入場を、Coordinatorの限定試験で結果と回復参照の搬送を確認した。129件の所要時間、全体回帰、実AI、実Docker、既存保存物は今回の検証対象外とした。

##### 回復履歴の保持設定と保存領域の確認を分離 — 2026-11-25

回復履歴Writerの固定ファイル読取りでは、同じLock内で観測済みの保存領域の実体を照合する。入口・書込み・最終確定では正規パスまで含む確認を維持する。保持設定は候補導出・各書込みの判断・最終確定で確認し、ファイル読取りだけでは再取得しない。Stateの置換直前は、設定と現在所有者の確認後にCASで取得した両ファイルの実体を再確認する。その他の保存経路・書込み順序・保存形式・公開契約は変更しない。

同じ少数件の試験では、領域観測は84回の完全観測から20回の完全観測と66回の実体照合に変わり、この箇所のNodeファイルAPI呼出しは756→378回になった。本番の設定Readerを試験用Repositoryに接続した場合、保持値の確認は59→12回、設定ファイルありの設定I/Oは1,121→228回、操作全体のI/Oは3,198／3,279→1,808／1,889回。既定値経路の設定I/Oは826→168回。計数は保存処理内に限り、処理時間や蓄積時の短縮量は確定していない。

Windowsの限定試験では読取り途中の領域差し替え、State置換直前の保持日数変更、所有者確認後のCAS対象差し替えをそれぞれ拒否し、同一回復IDでの再開を確認した。独立レビューで今回の変更を止める指摘はなかった。履歴ファイル側に元からある本文照合から置換・削除までのコールバック順は変更していない。全体回帰・実AI・実Docker・既存保存物は対象外とした。

##### 回復履歴の読取り区間と候補再利用を整理 — 2026-11-25

固定ファイルの実体と保存領域は読取り前後に引き続き確認し、Lock・所有者の再確認だけを読取り区間へ移した。書込み前は設定・所有者確認後にLockを確認し、履歴／Stateの置換・削除直前にCAS対象の実体を確認する。履歴のWriterでは候補を一度導出し、物理書込み時に再観測した本文・実体・保持日数が一致する場合だけ利用する。中間Reader、二段の保存、既存の回復方法は維持した。

同じ少数件の試験で、保存1回につきLock有効確認は94→42回、リポジトリ実体照合は109→57回。設定ファイルありのI/Oは1,808／1,889→1,344／1,425回。保持日数確認は12回、Writer内の固定ファイル確認は33回で変わらない。読取り中・保持設定確認中のLock失効と履歴差し替えを追加反証し、独立再レビューで今回の変更を止める指摘はなかった。全体回帰・実AI・実Docker・既存保存物は対象外とした。

##### 途中Stateを同じ回復履歴保存内で引き継ぐ — 2026-11-25

正常経路は同じLock内で確定した途中Stateを次段へ渡す。二段目WriterでStateと最初に読んだ履歴の現物、途中ファイルの状態、保持設定、所有者を照合する。途中失敗後の別呼出しは現物を読む。読取りだけの区間からLockの有効確認を外すが、Writer入場・書込み・確定・解放は維持する。

同じ少数件の試験で、Readerは2→1回、Lock有効確認は42→24回、保持日数確認は12→11回。設定ファイルありのI/Oは1,344／1,425→1,167／1,235回。Writer内の固定ファイル確認33回は維持した。二段間のState・途中履歴の変化を実ファイルで拒否し、同じ回復IDでの再開を確認した。全体回帰・実AI・実Docker・既存保存物は対象外とした。

##### 回復履歴の入場・親領域・途中ファイル同期を整理 — 2026-11-25

同一の回復履歴保存では登録済みの所有者と結合を確認し、Lockの現在性は物理入場で確認する。固定ファイルごとは保存領域自体、親は読取り区間で照合し、書込み前と確定時は正規パスを含む確認を残す。設定付き再検証を未指定の再検証と置き換えることはせず、現行の入力契約を保つ。同じWriterで作成・同期・読戻し済みの途中ファイルだけ、置換前の二度目の同期を省く。CAS・既存の途中ファイルの再同期・履歴正本の同期は維持する。

同じ少数件の試験で、設定ファイルありのI/Oは1,167／1,235→867／935回。Lock有効確認は24→15回、リポジトリ実体照合は52→41回、親を含む保存領域関係のI/Oは360→197回、同期は8→5回。Windowsの試験用保存領域では親の実体差、最初の同期失敗時の置換なし、別呼出しでの途中ファイル再同期を確認した。全体回帰・実AI・実Docker・既存保存物は対象外とした。

##### 回復履歴の同一Lock内で読取りを共有 — 2026-11-25

本番の所有者・設定確認は保存領域を変更しない同期観測として明記した。同じWriter内で履歴候補へ渡した入力、作成時に同期・読戻し済みの途中ファイル、同期後に一度照合した履歴正本を再利用する。CASと実体・明示不存在の確認、既存途中ファイルの再同期、二段の保存と既存の再開方法は維持する。

少数件の試験では、Writer内のファイル確認は33→18回、設定ファイルありのI/Oは867／935→744／790回。Lock有効確認は15回、保持設定確認は9回のまま。新規途中ファイルの同一本文・別実体への置換、次段の途中ファイルの出現、既存の同期失敗・再入場を実ファイルで反証した。129件の所要時間、全体回帰・実AI・実Docker・既存保存物は対象外とした。

##### Task回復の終端保存と履歴初回固定を統合

Task回復で新しい終端Stateを書く場合、改訂を追加せず同じ本文に履歴時刻・行Hash・未確認値を含める。履歴の実際の追記と確認済みStateの確定順は維持する。終端保存不要時の無書込みと履歴側の初回固定、通常終端・Docker修復の各専用判断、保存形式、Rootの公開項目は維持する。保存排他とCASは同じWriterに残す。別操作の追記では未出版Task行の欠測だけを許し、存在する行の不一致や確認済み行の欠測を許さない。

影響照合はEMの終端候補・履歴・保存と、CoordinatorのHost回復再入場、保持を共有する通常終端・修復履歴を対象とする。旧二段の前提で固定されていたWindowsの故障注入を実際の確定点に移し、同じ行で再開することと後続の改訂数を確認する。保存データの移行、全体回帰、実AI・Dockerは対象外。利用者向けの操作や準拠基準を変更しないため、別途の準拠監査は対象外。

限定確認では、回復終端から履歴確認までのState更新が3回から2回になった。Windows実ファイルで終端・履歴・確認の各置換前後の六故障点と、CLI・Workbench・再起動代役などを含む対象21ケースが成功。別操作の未出版行と確定済み欠測の区別、通常終端、修復の値契約、EMの公開・依存境界も限定確認した。独立レビューで発見したHost再清掃経路、認証不明記録を含む再入場、別履歴途中ファイルとの競合、旧改訂数および設計表を是正した。所要時間と総I/Oは再計測していない。

##### Task回復終端の読取りと保存を同じLockに統合

対象はTask回復の終端Writerと既存履歴保存。終端Writerが同じLock内で元版、途中本文、候補を扱い、同じ復号結果を通常の遷移規則へ渡す。初回読取りでは確認済み領域を再利用し、物理処置前の所有者確認、CAS、同期、確定順を維持する。独立レビューと限定影響照合では公開入口、無書込み、exact途中保存、通常終端・修復への非波及を確認した。保存形式とRoot公開項目は不変で、準拠基準を変えないため準拠監査は対象外。

対象限定試験はEM26件とCoordinator6件が成功。置換故障、変更された途中本文の停止、同じ候補の再開で、それぞれ終端WriterのLock取得一回を実ファイルで確認した。同じ合成入力で各7回の再計測では、終端から履歴確認までのLock取得は前回の3回から2回、全State復号は19回から15回。1／16／129件蓄積時のI/O呼出しは1,280／1,340／1,486回から1,036／1,095／1,231回、前回／今回の所要時間中央値は188／258／825 msから133／203／669 ms。書込み不要の対照でI/O呼出しの差は2回だった。全体回帰、実AI、Dockerおよび保存済みデータは対象外。

##### Task回復履歴で同じ本文の復号結果を引き継ぐ

Task回復履歴の既存Lockと短命の保存証拠に、元Stateと候補の検査結果を結合した。Writerでは現物・候補の全文、所有者、Repository結合、履歴・保持条件、途中ファイルの実体を検査してから使う。通常の遷移規則と置換前CAS、同期、履歴→確認済みStateの順序は維持し、修復履歴と別呼出しには引き継がない。独立レビューで私有の証拠と所有者の一致を値の参照より先に確認した。EM47件・Coordinator9件の限定確認、型検査および公開境界を確認した。既存のSource抽出型試験は移管済みの所有元と現行のLock入口へ追従し、元の反証を維持した。

自己生成の合成Stateを各7回測定した結果、履歴保存の全State復号は13回→2回、初回固定を伴う対照は23回→3回。1／16／129件の終端から履歴確認までの中央値は、前回の133／203／669 msに対し134／174／374 ms。ファイル操作の呼出しは1,036／1,095／1,231回で変わらなかった。全体回帰、実AI、Docker、既存保存物は対象外。

##### Task回復終端のファイル確認を物理処置の節目へ寄せる

終端Writerの連続読取り内では同じLockで確認した保存領域を再利用し、各ファイル実体の検査は残した。新規途中ファイルは排他的作成・初回同期・作成時の全文照合を再利用し、既存途中ファイルの再入場では元Stateの事前照合と再同期を維持する。置換前の所有者・Lock・領域、元State全文・両実体のCASは維持し、置換後は同期済み候補と正本の実体および残存ファイルを照合する。履歴保存、通常終端、修復、共通Lockの契約は変更しない。独立レビューで、再入場の事前照合を残した。EM27件・Coordinator9件の限定確認で、置換直前の途中本文変更がCASで停止することと新規・再開のopen回数を確認した。

同じ合成入力を各7回計測。1／16／129件蓄積時の終端WriterのファイルAPI呼出しは580／599／680回から186／200／231回、履歴確認までの全体では1,036／1,095／1,231回から642／696／782回。所要時間中央値は134／174／374 msから96／128／336 ms。後続履歴の呼出し数456／496／551回は変わらない。試験と計測は自己生成領域のみ。全体回帰、実AI、Docker、既存保存物は対象外。

##### Task回復履歴の読取り重複を整理

同じLockを借りたTask履歴に限り、Readerの最終ファイル名一覧を一回にまとめ、Writerの読取り区間では親の実体を照合する。新規追記はWriterで照合済みの元State・履歴を再読せず、置換直前に所有者・Lock・保持設定を確認して実体をCASする。初回観測を再利用するState途中ファイルは、従来の保存判断位置で実体または不存在を再確認し、履歴置換時も不存在を確認する。既存途中ファイルの全文照合と再同期、履歴正本の同期・読戻し、確認済みState置換前の本文CASは維持する。通常終端・修復履歴・共通Lockは変更しない。

独立レビューでState途中ファイルの確認位置を是正した。EM35件、Coordinatorの対象9件と最終差分の再確認4件が成功。State途中ファイルが後から現れた場合は履歴途中ファイルを作成せず、履歴置換直前の元State変更は置換を止めて候補を保持し、元State復元後は同じ履歴行で再入場した。自己生成の合成入力を各7回測定し、1／16／129件の履歴保存でファイルAPI呼出しは456／496／551回から411／439／483回、終端から履歴確認まででは642／696／782回から597／639／714回。所要時間中央値は96／128／336 msから89／126／329 ms。全体回帰、実AI、Docker、既存保存物は対象外。

##### Task回復保存の領域証拠を同じLock内で引き継ぐ

初回に確定した保存領域と親の実体を同じTask履歴のReaderからWriterへ渡す。書込み・確定では正規パスで祖先を確認し、親・保存領域の実体、Repository／所有者、保持設定、LockとCASを従来の処置境界で確認する。Writerの読取り入場だけは同じLockの直前段で観測済みの保持確認を重ねない。通常終端・修復・共通Lockは変更しない。独立レビュー、EM35件・Coordinator9件の限定確認が成立し、Lock保持中に保存領域を同名の別実体へ差し替えても正本の置換を発行せず、元Stateと途中ファイルを保持した。

同じ合成入力を各7回測定し、1／16／129件の終端から履歴確認までのファイルAPI呼出しは597／639／714回から522／564／639回。所要時間中央値は89／126／329 msから82／115／323 ms、Lock取得は2回のまま。全体回帰、実AI、Docker、既存保存物は対象外。

##### 共通Lockの保持確認でファイルを開き直さない

排他モードを`wx+`にし、親・Path・descriptorの実体を確認後、取得済みdescriptorで同じ長さの改変も本文で検出する。親の型と実体は一回の観測で確認する。解放時のclose後の正規Pathと本文の再照合、非協調のPath置換を原子的には保証しない境界、既存の保存順序とCASは維持する。

基準と変更後のLockだけを差し替え、同じ合成入力を各7回測定した。1／16／129件で終端から履歴確認までのファイルAPI呼出しは522／564／639回から454／496／571回。Lock Fileを対象とする呼出しは122回から74回、Lock取得は2回のまま。所要時間の中央値は86／139／355 msから75／135／351 msで、蓄積時の改善は小さい。独立レビュー後の再確認、Lockの型・Lint・18件、各利用側の限定試験（Coordinatorの修復履歴接続49件を含む）が成立した。EM側修復履歴の12ケースは新旧Lockとも旧Source文字列が見つからず、故障注入前に停止する既存の試験不整合を確認した。全体回帰、実AI、Docker、既存保存物は対象外。

##### 固定ファイルの読取りで名前の属性確認を重ねない

固定ファイルReaderで、名前の属性確認を入口とdescriptor終了後の各一回に集約した。本文の取得前後で開いた実体を照合し、終了後に同じFile実体・単一リンク・正規パスであることを確認する。保存領域、Lock、CAS、同期、保存順序は変更しない。修復履歴の旧故障注入箇所を現行の置換直前のOwner確認へ追従し、従来の12ケースを含む46件が成立した。

同じ合成入力を各7回測定し、1／16／129件の終端から履歴確認までのファイルAPI呼出しは454／496／571回から438／476／551回、所要時間中央値は70／116／326 msから70／114／335 ms。Lock取得と保存回数は不変で、速度向上は確認していない。EMの限定試験は固定I/O・履歴・終端の20件が成立。別の再入場試験は新旧Readerとも実ハードリンクの作成が`EPERM`で未成立。全体回帰、実AI、Docker、既存保存物は対象外。

##### 結合済みの保存起点を再照合するときは実体を一回読む

初回の物理結合と公開関数は従来どおり正規パス確認の前後で実体を観測する。EMが生成した保存借用の再確認に限り、正規パス確認後の実体一回を初回の結合値と照合する。Owner／保持設定のcallbackとその順序、保存領域の確認、Lock、CASは維持する。利用側が公開関数を直接呼ぶ経路は変えない。

同じ合成入力を各7回測定し、1／16／129件の終端から履歴確定までのファイルAPI呼出しは438／476／551回から412／450／525回に減った。26回の内訳は終端側4回、履歴側22回の属性観測で、Lock取得と保存回数は不変。所要時間の改善はこの測定から一般化しない。EMの限定確認（公開境界・保存起点17件、通常履歴・Lock18件、修復履歴46件）と独立レビュー・限定影響監査を実施した。レビューで見つかった保持設定の合成試験の差し替えを追従し、保存起点と合わせて11件を再確認した。全体回帰、実AI、Docker、既存保存物は対象外。

##### Task回復履歴の新規書込みから重複する領域と設定の確認を外す

空履歴の二つの不存在を同じ領域観測で囲み、新規追記では候補導出時の保持日数を使って書込み直前に再照合する。読取りしない区間の親確認と、履歴本文確認の直後に途中名を調べる際の領域の重複確認を省く。Lock取得2回、Stateの置換2回と履歴の置換1回、所有者・設定の書込み直前確認、State本文CAS、途中ファイルからの再開は維持した。

合成のTask回復を各7回測定し、1／16／129件のファイルAPI呼出しは412／450／525回から403／443／518回。終端側は不変。所要時間の一貫した改善は確認していない。Coordinatorの実保存試験で候補導出後の設定変更はEffectなし、履歴同期直後の異物出現は既存正本・元State・異物を保全して停止することを確認した。通常履歴・保持設定16件、修復履歴46件の限定確認と独立レビュー・限定影響監査を実施。全体回帰、実AI、Docker、既存保存物は対象外。

##### 新規Task履歴の同一処置境界で所有者の観測を一回にする

候補導出済みの新規追記だけ、通常のRepository現在性、操作所有者、日数付き現在性を一度ずつ検査する。所有者を二度呼ばず、通常の現在性も日数付きの現在性も省かない。設定観測の前に所有者を確認し、後続のLock／領域／CASを維持する。再開処置と修復は従来どおりとする。

1件の合成入力を各7回測定し、所有者観測は20回から14回。観測がI/Oを行わない従来の計測では403回のまま。保存起点、専用領域と対象の不存在を実ファイルで検証する代役を使うと663回から585回に減った（終端132回は不変、履歴531回から453回）。これは代役付きEMの計測で、実Coordinator全体のI/O・所要時間は主張しない。限定回帰と独立レビュー・限定影響監査を実施。全体回帰、実AI、Docker、既存保存物は対象外。

##### Task回復の保持設定確認から保存起点の重複観測を外す

Coordinatorは従来の設定Readerを保存起点の現在性とは分けてEMへ渡す。同じ書込み境界では操作所有者、保存起点、保持設定を順に一回ずつ確認する。所有者確認内部の専用Hostの不存在確認と、その前提となる保存先確認、書込み直前のLock・領域・CASは維持する。一体型の入力を使う修復などの経路は変更しない。Root公開項目と保存形式は増やさない。

Configuration Modelの設定読取りを含む1件の合成入力を各7回測定し、保存起点の専用観測は21回から15回、ファイルAPI呼出しは777回から759回。所有者観測14回、設定読取り9回、Lock取得2回・置換3回は不変。設定を読まない前計測との絶対値比較は行わず、速度向上と実Coordinator全体の回数は主張しない。限定回帰で所有者・保存起点の失効時の短絡、実保存の観測順と設定変更時の停止、修復への影響を確認し、独立レビュー・限定影響監査を実施した。全体回帰、実AI、Docker、既存保存物は対象外。

##### 同一Lockの新規Task履歴で確定候補を組み直さない

Readerが導出した候補を同一Lock、回復ID、元履歴本文、保持日数に結合する。Writerは元Stateと元履歴の本文・実体、途中ファイル、現在の設定をそれぞれ照合してから候補を再利用する。通常の本文検査・CASと、別呼出しからの再開・修復の候補生成は変更しない。固定状態Readerの同名属性観測では、入口の属性を本文取得に使い、末尾の実体と単一リンクを一回の観測で確認する。

合成Inputを各7回測定し、新規履歴候補の導出は2回から1回。ファイルAPI呼出しは1／16／129件で403／443／518回から402／440／515回に減った。設定を実ファイルで読む前回の別測定とは比較しない。所要時間の一貫した改善は未確認。限定回帰では、Reader返却後に履歴名が出現した場合に、元State・出現した履歴を保全してEffectなしで停止することを確認した。独立レビューで回復IDの照合を明示し、再確認した。全体回帰、実AI、Docker、既存保存物は対象外。

##### 専用Hostの解放後は確定済み保存起点を再利用する

終端保存・履歴確定・回復完了では、回復の受付で確定し直前に実体照合したディレクトリと操作IDを専用Hostの不存在観測へ渡す。Git配置の解決だけを外す。Host領域と対象の実体・明示不存在の確認、観測不能時の停止、排他・CAS・保存順序は変更しない。

試験用Repositoryで実Coordinatorの終端保存と履歴確定を前回と同じ区間で計数。NodeファイルAPI呼出しは既定設定で2,295回から737回、設定ファイルありで2,385回から827回（終端606→196回、履歴1,779→631回）。両条件とも区間内の .git 照会は1,425→0回、Git起動は0回のまま。設定ファイルありの計数なし各5回では合計時間中央値258→117 ms（今回の範囲100–173 ms）。回復完了のI/Oや全体回帰の時間は測っていない。

##### 回復の保存起点は初回捕捉と再照合を分ける

Hostの不存在観測を挟む保存起点の照合は二つとも維持する。後段を省くと観測中の保存起点の差替えを検出できないため、一回に束ねない。代わりに確定済み結合値との再照合では、EM既存の再照合と同じく正規パスと実体を一度ずつ観測する。初回捕捉、保持設定、排他、CAS、保存順序は維持する。

同じCoordinator経路のファイルAPI呼出しは既定設定で737→699回、設定ファイルありで827→789回。削減38回はすべて保存起点の属性再取得で、終端保存196→187回、履歴確定631→602回（設定ファイルあり）。保持設定の読取り回数とGit照会0回は不変。計数なし各5回の中央値は117→99 ms（今回は92–129 ms）で、前回の範囲と重なる。限定回帰では保存起点差替え、履歴確定途中からの再入場、修復履歴を確認した。回復完了のI/O、全体回帰、実AI、Docker、既存保存物は対象外。

##### 新規Task履歴の候補照合で保持設定を読み直さない

設定の再確認を分離した新規Task履歴では、同一LockのReaderが候補へ結び付けた保持日数をWriterの候補照合に使う。保存起点・操作所有者・元本文と候補の照合は残し、書込みや同期・置換前の設定変更は従来どおり拒否する。途中ファイルからの再入場と修復履歴には適用しない。

同じCoordinator経路で設定読取り10→9回。設定ファイルありの履歴確定602→583回、終端保存を含めると789→770回。既定設定では699→689回。終端保存187回、Git照会0回、Lockと置換回数は不変。保持設定を候補照合後に不一致にして、Writerの設定確認一回で書込みなしとなることを確認した。認証CLI試験の後段では、履歴置換直後の属性照合が `published_replaced` で停止する既存不整合を、今回の変更を外した対照でも再現した。失敗した置換直後の追加観測では作成時刻と変更時刻が変わり、照合対象のうち変更時刻は従来から除外されていた。

##### Windowsで置換先の作成時刻を引き継ぐ場合の保存確認

Windowsの名前置換で、確定先が以前の同名ファイルの作成時刻を引き継ぐことがある（[Windowsのファイル名トンネリング](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/fltkernel/nf-fltkernel-fltgettunneledname)）。対象は履歴確定とTask回復終端での置換の直後に限る。同一ファイルID・通常ファイル・単一リンクと他の属性が一致し、作成時刻だけが違う場合に、安定した読取りで確定候補の本文と照合する。通常の読取り・CAS・書込み順序は変更しない。

履歴・Stateの同一実体、別ファイル、異なる本文の6ケースを含むEMの限定56件と、以前失敗した認証CLI経路およびWorkbench経路が成功した。両パッケージの型検査と独立レビュー・限定影響監査も完了した。通常のCoordinator経路のファイルAPI呼出しは終端187回、履歴583回、合計770回のままで、追加の本文読取りは発生しなかった。全体回帰、実AI、Docker、既存保存物は対象外。

##### 新規Task履歴の保持日数を最初の書込みから固定する

同じLockのReaderから新規追記候補と設定を別々に受け取った場合に限り、履歴途中ファイルを作る直前に設定を再照合し、作成発行後はそのWriter内で日数を固定する。設定を途中で変更しても次の新規保存から反映する。所有者・保存先・Lock・CASと履歴→Stateの順序を維持し、既存途中ファイルからの再入場、設定を分けて渡さない入力、修復履歴は変更しない。

同じCoordinator経路で設定読取り9→4回。設定ファイルありでは履歴確定583→488回、終端保存込み770→675回。既定設定では689→639回。終端保存187回、Git照会0回、Lock・置換回数は不変。計数を外した各5回の中央値は前回118 ms、今回は90 ms（範囲82–159 ms）で、測定範囲が重なる。書込み前の設定差でEffectなし、最初の履歴途中ファイル同期後の設定編集で現保存は完了・次の読取りは新値、置換時のCAS拒否を実保存試験で確認した。

##### Workspace作成の保存起点・配置・Lock確認の重複を整理する

Serverは同じWorkspace要求の受付で確定した正規保存先を記録操作へ渡す。VCの保存Identityは、構造グラフを再照合した一つの配置観測から投影する。EMは同じ登録済みRepositoryを借用した直後の保存先・Lockの再照合と、検査済みStateの再符号化・再検証を省く。Lease前の既存状態拒否、Lease取得後の照合、Git処置と認可、保存時のCAS、終了時の排他確認はいずれも変更しない。

了承後のWorkspace作成でNodeファイルAPI呼出しは7,159→6,602回（VC 2,098→1,681、EM 3,274→3,234、共通Lock 1,577→1,477、その他は不変）。Git起動9回とLock取得9回は変えない。I/O計数用の観測を含むため速度の比較には使わない。VC観測途中の差替え、Workspace作成後の保存故障からの再入場、保存・解放の両失敗、共通Lockの実体・世代照合は限定回帰で確認した。HTTPのAI設定初回保存は1,243回のままで、認可とGit除外登録の境界は未変更。全体回帰・実AI・Docker・既存保存物は対象外。

続く変更では、新規Workspace作成に限り、Lease確定時に検証したQueueの所属とWorkspaceの世代・所属を返し、確定直後の短期Lock付き読取りを省く。Lease前の拒否、作成意図を保存する時点の世代CAS、Git処置と回復の順序は維持する。同じ計数条件で6,602→6,505回（EM 3,234→3,185、共通Lock 1,477→1,429）、Lock取得9→8回、Git起動9回。限定回帰では正常作成、指定世代の不一致でGit処置なし・Lease解放、Git処置後の保存失敗からの再入場を確認した。

HTTPのAI設定初回保存は、Git除外登録の受付で同じ配置を取り直さず、1,243→1,163回（VC 1,025→945）。書込み境界の再照合、HTTPの認可、CASおよび不明な出版を再送しない処置を維持した。計数付きの値であり、所要時間の比較には使わない。

次に新規作成の管理処理で、Lease予約前の状態読取りを予約自身の読取りへ統合した。状態不明ならLeaseの予約もGit処置も行わない。実Gitを用いた同じ管理処理の計数で、ファイルAPI呼出しは6,505→6,408回（EM 3,185→3,136、共通Lock 1,429→1,381）、取得は短期State Lock 7→6回、操作Lease 1回のまま、Git起動9回のまま。公開サービスの対象解決・認可処理はこの計数に含まない。

短期State LockはLeaseの予約・取得確定、Workspaceの作成意図・結果保存、Leaseの解放意図・解放確定の6か所で取得する。操作LeaseはGit処置をまたぐが、State全体の保存排他はGit処置や操作Leaseの実体取得・解放をまたがない。排他を一つにまとめる案は、別操作の保存待ちと強制終了後に残る排他・回復入口を変えるため、この重複削減には含めない。

限定影響確認ではHTTP／MCPの共通サービス、他のWorkspace操作、EMの取得・回復、VCの作成を照合した。初回の短期Lock解放不明に限り、旧先頭Readerの失敗と異なり保存済みLease予約が残り得る。物理Lease取得とGit起動は0で、元の回復参照を返して停止する。状態破損で予約しない場合と、予約保存後の解放不明を実保存試験で区別する。保存形式やCRDD準拠基準は変更しないため、移行・準拠監査は行わない。

##### Workspaceの作成結果とLease解放意図の保存は分ける

結果保存の失敗とLease解放意図の失敗は別の結果である。前者は元の作成意図を保持してLease解放を試み、後者は確定したWorkspaceを `ready` のまま保持して物理Leaseを残し、解放の回復参照を返す。Git成功後、一時ファイルを開く直前に後者だけを拒否する実保存試験を追加し、Git作成は1回、Workspaceは `ready`、同じ回復参照のLeaseが残ることを確認する。この反証は置換後不明や物理Leaseの回復処理そのものを検証するものではない。

単一の書込みにすると二つを独立して確定できなくなるため採用しない。短期Lockだけを共有して二つの書込みを残す場合、管理処理の取得は理論上7→6回だが、失敗後の現在状態の照合、二回のCAS・書込み、物理解放前の生存確認は残る。短期Lock解放不明時の失敗の帰属も変わるため、汎用借用入口やWorkspace専用の層間接続は追加しない。変更した意味と検証の対応を独立確認し、公開契約・準拠・保存形式の変更は行わない。

実Gitによる正常作成の6,408回を呼出し元で分けると、Workspace記録の二度の書込みで1,450回、Lease解放意図で725回、解放確定で818回、その他で3,415回。次の調査はLock取得数ではなく、同じ短期Owner内でWriterが取り直す状態と保存先の観測を対象とする。CASに必要な現在版・実体の照合も一緒には省かない。

##### 通常の保存候補に同じ短期Lockの元版を再利用する

業務遷移を照合した元版と同じ改訂を更新する場合に限り、その正規本文を候補組立てに再利用する。候補組立て専用のState読取りと元版本文を作り直す処理を外す。物理Writerによる現在本文の完全一致、途中物の検査、置換直前のCASと従来の書込み順序は維持する。遷移照合後に現れた同版異本文または履歴途中ファイルを拒否し、現在本文と途中物を保全することを実保存試験で確認した。初期化や同じ候補の再入場の読取りを統合せず、専用の回復・履歴WriterとRoot公開契約は変更しない。

正常なWorkspace作成の管理処理でファイルAPI呼出しは6,408→6,090回（EM 3,136→2,908、共通Lock 1,381→1,291、その他は不変）。Lock取得は7回、Git起動は9回のまま。計数対象に公開サービスの認可・対象解決は含めず、所要時間の比較に使わない。既存の試験台帳に登録済みのEM／Server試験で通常更新、初期化、再入場と故障を限定確認する。

独立レビューで故障注入箇所をReader末尾から物理Writer入口へ是正した。後発差を拒否する責務が候補組立てのReaderから物理Writerへ移るため、異常時の理由コードは変わり得る。既知の利用側は両理由とも一般の保存失敗として扱い、個別の処置を分岐しない。保存成功条件と失敗時に現在本文・途中物を保全する保証は維持する。

##### 通常Writerの連続読取りでOwner確認をまとめる

既存Stateに新しく途中ファイルを作る通常保存だけを対象とする。同期前と同期後の各区間で、現在ファイルと途中ファイルを連続して読み、ファイルごとの正規パス、親・領域・対象の実体を照合する。OwnerとLockは同期・置換の直前に確認し、置換直前に両ファイルの実体と履歴途中ファイルの不存在を確認する。本文比較と置換後読戻し、初期化・途中保存からの再入場・修復・履歴専用Writerは維持する。同期後の履歴途中ファイル出現と、本文照合後の同一内容・異実体への差替えを故障注入し、元データを置換しないことを確認した。

正常なWorkspace作成の管理処理でNodeファイルAPI呼出しは6,090→5,580回（EM 2,908→2,608、共通Lock 1,291→1,081、VCなどは不変）。Lock取得7回、Git起動9回を維持する。既存台帳のEM／Server試験と独立した影響確認で検証し、保存形式・公開契約・CRDD準拠基準は変更しない。計数は公開サービスでの先行読取りを含まず、速度を示さない。

##### 通常Writerの新規途中ファイルは作成時の同期を使う

作成後に途中ファイルへ書き足さない通常保存に限り、作成時の同期・本文読戻しを使い、二度目の同期とその直前の二つの本文再読を外す。置換前には両本文の比較、Owner・Lock、実体と途中履歴の不存在を照合し、置換後にも正本を読み戻す。既存途中ファイルの再入場、初期化、修復、履歴保存の同期は変更しない。正常時の新規途中ファイルの同期1回、初回同期失敗、置換直前の同一内容の差替えと履歴途中ファイル出現を既存試験で確認した。電源断時の新しい保証は主張しない。

実Gitを使ったWorkspace作成の管理処理では、ファイルAPI呼出し5,580→5,268回（EM 2,608→2,326、共通Lock 1,081→1,051）、Lock取得7回とGit起動9回は不変。計数は公開サービスの先行読取りを含まず、速度を示さない。既存台帳のEM／Server試験と独立確認を使い、保存形式・公開契約・準拠基準は変更しない。

##### 通常Writerの置換後の正本文を一度だけ読み戻す

新しい途中ファイルを使う通常保存では、置換直後に保存領域と正本の実体を確認し、末尾の一回で同じ実体と候補本文の完全一致を確認する。置換前CAS、初期化、既存途中ファイルからの再入場、修復と履歴は変更しない。正常保存の正本open一回と、置換後の同一本文・異実体への差替え及び読取り不能で成功を返さないことを実保存試験で確認した。最後の読戻しは排他の代替ではなく、「置換後に正本が読め、候補と一致した」という成功条件を確認する。これを撤去して同期・置換・実体確認のみを成功条件にする変更は含めない。

同じWorkspace作成の管理処理ではファイルAPI呼出し5,268→5,040回（EM 2,326→2,158、共通Lock 1,051→991）、Lock取得7回、Git起動9回。計数は公開サービスの先行読取りを含まず、処理時間を示さない。既存台帳のEM／Server試験と独立確認を使い、保存形式・公開契約・準拠基準は変更しない。

##### 通常Writerの置換後は本文を開かず、実体だけ確認する

人間判断により、既存Stateに新しい途中ファイルを作る通常保存の成功条件を、同期・置換・置換先の実体確認・排他解放に絞る。置換前の本文CAS、同期済み途中ファイルの読戻し、置換後の途中ファイル不存在、正本のファイルID・単一リンク・サイズ・更新時刻等の照合は維持する。置換で変わり得る変更時刻と、Windowsで引き継がれ得る作成時刻は除き、正本本文を独立に読めることは成功条件に含めない。初期化、再入場、修復・履歴の確定条件は変更しない。正常時の正本open 0、置換後の実体観測不能、同一本文の異実体への差替えを実保存試験で確認した。

同じWorkspace作成管理処理のファイルAPI呼出し5,040→4,770回（EM 2,158→1,948、共通Lock 991→931）、Lock取得7回、Git起動9回。公開サービスで先行する観測は計数範囲に含まず、所要時間の比較に使わない。

##### Workspace新規作成からTaskのLease記録を外す

同じ短期保存排他の下でTaskの予約と同じ物理操作Lockの取得を競合させる。Workspace作成は作成意図と結果だけを保存し、TaskのLease予約・取得・解放意図と終了証拠を追加しない。操作LockはGit直前と両保存で照合する。取得時の短期排他解放不明はGit前に停止し、操作Lockの解放を試みる。Git成功後に操作Lock解放だけが失敗してもreadyを維持する。操作Lockの残存は手動確認とし、Task回復参照を発行しない。作成意図済みなら同じWorkspaceのWorktreeを観測し、未作成から自動再実行しない。Task、採用、廃棄の処理と保存形式は変更しない。

ServerはEMの用途限定の完成受付 `beginWorkspaceCreation` を使用する。余分になったLease取得確定からのWorkspace用投影は両Packageから撤去する。正常作成は短期Lock 6→3回、操作Lock 1回、Git起動9回。ファイルAPI呼出し4,770→2,766回（公開サービスの先行読取りを含まない）。実Gitと故障注入の既存試験に双方向のTask競合、Git直前の操作Lock喪失、結果保存後の解放失敗を接続する。

##### Workspace保留と廃棄を保存・操作の排他境界へ揃える

保留と解除は表示名の変更と同じ短期保存に統合する。EM公開口を `updateWorkspaceMetadata` に置き換え、名前又は保留期限だけを閉形式で受け、既存Lease・残存操作Lock・利用中・対象結合・元世代を確認する。廃棄は作成専用受付を置き換えた `beginWorkspaceWorktreeChange` の限定用途とし、Taskと同じ操作Lockを取得するがTaskのLease証拠を作らない。廃棄意図、実Gitの結果、除去の順と、参照・保留、期待HEAD、変更破棄確認、部分失敗後の同対象再入場を維持する。残存操作Lockは作成と同じ手動確認とする。保存形式とHTTP／MCPの要求形は変えない。

実Gitによる正常処理では保留・解除とも短期Lock1回、廃棄は短期Lock4回と操作Lock1回。旧ソース上の8回／10回から、それぞれ1回／5回になる（公開入口の先行読取りは別）。旧保留を用いた保存・解放両失敗の結果合成試験は、引き続き従来Leaseを使う再観測へ付け替えて保持する。再観測、候補固定・終了、正本採用は今回の変更対象外。

##### Workspace選択のQueue割当と既存Workspaceの再観測を分離する

Workbenchの選択は単なる画面変更ではなく、未割当のQueueと既存Workspaceの結合を保存する。選択が失敗又は利用可能と観測できない場合には新規割当を保存しない。再観測は同じQueueとの既存結合を要求し、新しい割当を作らない。両操作を作成・廃棄と同じ `beginWorkspaceWorktreeOperation` の閉じた用途へ移し、物理Lockは共有するがTask Leaseの取得・解放をStateへ記録しない。Gitの観測結果からのState更新は実行モデルが行う。候補固定・終了、正本採用、Taskは変更しない。

実Gitの正常経路では選択・再観測とも管理処理は短期Lock2回と操作Lock1回。選択のHTTP／MCP共通サービスでは認可・対象確認の短期Lock1回を加える。再観測での別Queue拒否、新規選択でのlocked又は不成立時の無書込み、正常割当、既存の作成失敗からの再観測とTask Lease証拠不変を照合した。

##### 候補固定・候補終了の排他をWorkspaceの物理操作へ揃える

作成等と同じ `beginWorkspaceOperation` の固定用途へ移し、候補固定・終了でもTask用のLease証拠を書かない。対象は既存Workspaceの候補欄に限定する。固定意図と結果を別々に保存し、候補終了は採否記録→Ref回収→回収証拠→候補除去の順を保つ。Ref回収証拠は同じWorkspace・操作・候補Commit・採否・参照不存在へ結合し、後発失敗で既存記録を書き換えない。正本採用はMerge先の回復と採用証拠の利用側があるため、この変更では従来の二つのLeaseを維持する。

実Gitの正常経路では、管理処理の候補固定は短期Lock3回と操作Lock1回、候補終了は短期Lock5回と操作Lock1回。公開サービスの先行読取りは別。Ref回収と候補除去の途中失敗、別Processでの再入場、正本採用の再入場を限定確認する。

##### 正本採用はWorkspace側のLease記録だけを外す

正本採用のWorkspace側を共通の操作Lockへ寄せ、Task用の外側Lease記録を作らない。採用先の既存Leaseは取得・解放・回復・退役に必要な証拠を維持する。Merge直前に両排他を確認し、候補の保存時は採用先Leaseの同一Owner世代・Process・保持状態を確認する。採用先LeaseをWorkspace操作Lockより先に解放する。採用先Leaseの回復はWorkspace側に残った物理Lockを除去しない。残ったWorkspace側は他のWorkspace操作と同じ手動確認とする。

実Gitの正常採用の管理処理は、短期Lock8回、Workspaceの操作Lock1回、採用先Leaseの物理Lock1回。採用先の証拠だけを生成する。Merge直前の採用先Lease喪失、Merge成立後の保存失敗、別Processの再入場を検査する。公開サービスの先行読取りは別。

##### Workspaceの汎用保存公開を撤去する

現行の採用結果は固定候補・採用先・Commit・処置の記録であり、現在の採用結果照会は採用先Leaseの終了証拠を条件にしない。一方、既存形式の単独採用記録の履歴確定と、未解決の採用先LeaseがあるQueueの終了判定には別の条件がある。今回、採用先Leaseの発行・検査・解放、履歴判定、既存保存形式は変更しない。

製品利用のない汎用Workspace保存をRootから撤去する。廃棄時の時計異常は用途限定の実保存を通して無書込み・解放・後続保存を確認する。固定候補の九つの不正値はEMの保存形式の検査に直接通し、Serverでは遷移条件を満たす不正な採用候補の保存拒否・状態不変と正当な途中状態の保存を確認する。

自己生成RepositoryによるWorkspaceの限定計測では、作成のGit起動は確認待ち3回・HEAD不一致3回・了承後9回。保存排他と操作Lockを分けた取得回数の既存検査も通過した。HTTP／MCP受付の先行読取り、OS内部のI/O、既存保存物および全体回帰はこの結果に含めない。

##### 現行の正本採用をRepository単位の操作Lock一つにする

固定候補を正本へ取り込む操作は、Workspace操作とTaskが共有するRepository単位のLockで直列化する。採用先専用Leaseは発行せず、取得・解放証拠も保存しない。固定候補と採用先の結合、Merge直前と採否記録直前の操作Lockの生存確認、排他内の保存世代照合、Merge成立後の同候補への再入場は維持する。解放不明はWorkspace操作の共通結果で返す。旧版との並走、旧採用記録の互換・移行・清掃はこの変更の成立条件に含めない。

自己生成Repositoryで正常採用を計測し、短期保存排他が8回から4回、物理操作Lockが2回から1回になった。HTTP／MCP受付の先行読取りは別。実Git試験で同時採用の拒否、Merge直前のLock喪失時の停止、Merge後の保存失敗からの再入場を確認する。開発検証の清掃GateはWorkspace操作のLease証拠がゼロであることを要求し、Taskを実行する経路の取得・解放証拠は引き続き別に照合する。

##### 退役した採用専用Leaseと単独採用の履歴処理を削除する

旧 `canonical-adoption` の受付、保存値、回復、終了証拠および単独採用の履歴退役を撤去する。通常Task Leaseの物理Lock名、回復ID、Queue結合、証拠の取得・解放順序は変えない。通常Queue終了時のLock不存在確認は、Repository単位の共通操作Lockに一回だけ行う。退役時の結果の除去は同じQueue・Project・Milestoneに限定し、ID文字列が一致する別の結果や参照中の成果根拠は保持する。現行のWorkspace採用・候補回収記録、Mergeの再入場、既存の保存排他・CASは維持する。

旧Leaseを含むSnapshotは新版で受理しない。互換読取り・移行・既存保存物の変更は行わない。通常Taskの取得・解放不明、別Processの排他、回復相関の試験は現行Leaseで引き継ぎ、採用専用の検証だけを退役する。

自己生成Repositoryで再計測した通常採用はLock取得5回（短期保存4回・操作1回）、NodeのファイルAPI呼出し4,651回（VC 3,110、EM 1,001、共通Lock 540）。終了Queue一件の退役は1,334回（EM 968、共通Lock 366）。Queueの終了判定一回ではLock不存在確認を2回から1回に減らした。これらは計数用の観測付きで、経過時間やOS内部I/O、HTTP／MCP受付全体の計測ではない。

##### Workspace・設定保存・Queue退役の再観測を整理する

- Workspaceでは操作Lockの不存在を確定した最終領域観測を、同じ短期排他内の直後の取得へ渡す。作成・廃棄・候補固定・候補終了をServer共通サービス入口から測り、各正常経路のLock領域完全観測は3→2回。Lock取得回数・Git処置・保存時の生存確認は維持する。公開入口のProject／Queue／Workspace適用範囲を確認する先行読取りは、後段の取得・保存とは別に残す。
- AI選定設定の前段で使うローカルGit除外登録は、受付で読んだ除外本文を同じ登録処理の元版にする。既存除外ファイルありのVC登録処理で、新規追記時の除外ファイル読取り3→2回、登録済みの再要求は2→1回。後者は書込み0。認可、除外登録、設定保存、各書込みのCASと再入場の順序は変えない。
- 終了Queueの退役は、通常履歴Writerが検証済みのStateの正規本文をCASに、検証済みの値を保持参照の導出に使う。保持計算のためのState再符号化・全体再検証をなくし、既存pendingのID照合を集合にする。退役一件のState全体検証34→33回、再送・無変更の経路4→3回。残る33回のうち20回がState候補の組立てと遷移検証にある。要約保存と履歴確定・退役、Stateと設定の再確認、ファイル読取り・書込み回数は変えない。

計数は同じ試験用Repositoryの対象区間だけを比較し、所要時間・製品全体のI/O削減量に読み替えない。全体回帰、実AI・Docker、既存保存物および採用経路の設計変更は対象外。

続く変更で、同じ段階で検査した元版・候補を遷移検査に渡し、物理Writerは現物の本文CAS後、検査済みの現在版から保存候補を独立に再構築する。完全一致・履歴途中物の拒否・初期化・再入場の条件は変えない。退役一件でState正規復号は33→13回、組立てと遷移検査の復号は20→4回。再送・無変更は3回のまま。操作Lock領域の観測回数も同じ6回で、ファイル読取りと保存段階は削っていない。別保存結合、元版・世代差、保存中の差し替え・途中故障を限定回帰で確認した。

計数器を外し、同じ一件の退役操作だけを変更前後それぞれ3回、実行順を入れ替えて計時した。中央値は153→167 ms、範囲は149～168 msと147～170 msで重なる。この小規模入力で待ち時間が短くなったとは確認できていない。

蓄積時は、退役対象を一件に固定し、別IDの保持済みQueueを1／16／129件加えた自己生成Stateで比較した。変更前は今回の再復号削減だけを適用しない実装、変更後は現在の実装を使う。計数器を外し、各条件5回ずつ、変更前後と件数の順序を入れ替えて計時した。中央値と範囲は以下。記録の準備、検証、片付けは計測に含めない。全試行で退役一件、履歴一行、再送による追加なし、保持済みQueueの不変を確認した。

| 保持済みQueue数（退役対象を除く） | 変更前の中央値（範囲, ms） | 変更後の中央値（範囲, ms） |
|---:|---:|---:|
| 1 | 151（138～159） | 139（128～163） |
| 16 | 178（165～185） | 164（148～177） |
| 129 | 396（380～419） | 307（290～334） |

129件では約22%短縮し、両範囲は重ならない。1・16件では範囲が重なる。対象の重複復号削減はここで区切り、物理照合と保存段階は維持する。全体回帰・実AI・Docker・既存保存物の操作は実施していない。

</details>
