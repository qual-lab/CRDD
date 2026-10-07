# CROS WorkbenchのProduction実装

変更ID: `CHG-000082`
状態（Status）: `In Progress`
担当責任者: Qual-Lab
最終更新日: 2026-10-07

## 現在状態

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | Phase 5のProduction Closureを進行中。画面・共有Server・Topic／Meeting・Version ControlとAIのProduction接続は既存Evidenceに保持する。署名Runtime `45254e2b`と独立レビュー済みTool `1b756ac2`による公開MCP実Provider E2EはRun `2e55c8cd2897464b`で合格した。正常二経路、取消、親Process喪失後のexact Recovery、再入場時の人間採用判断待ちおよび最終在庫清掃を観測した。Observer接続是正の静的検査と局所158／158も合格した。この合格をWorkbench実Provider経路、Quality移管母集団および未観測の検証義務全体またはRelease可能状態へ拡張しない |
| 対象改訂版 | `v0.22.0` |
| 責務再編の現在順序 | [新しい1〜8の完了計画](Evidence/261007_develop-responsibility-mapping.md#23-責務再編を完了させる計画)を同じCHG内で実施する。段階1〜4を完了し、全18領域・830Fileの予定処置、基本設計、詳細API・利用側・保存・設定／移行・QA引渡しと独立設計レビューを固定した。三観点の是正後再レビューはPass・必須残件0件。設計集合は13定義・172項目。全体Checkerは1,572件Failで、全体Passとしない。[段階4の完了判定](Evidence/261007_develop-responsibility-mapping.md#段階4の完了判定--2026-10-08)から、段階5AのDomain統合へ進む。段階5以降のSource移管・全回帰・署名E2E・Release可能状態は未成立。各段階完了時にコミットし、人間判断が必要なときだけ停止する。プッシュ・統合・Releaseは別の許可に従う |
| 保存方式刷新② | 完了。実装、受付世代接続、終了整理、本番v2保存Port、Repository切替、現署名・production初期化、全回帰結果の処置とArchitecture／Quality最終独立レビューを完了し、コミット・プッシュ済み。全品質項目・全製品E2Eの成立とは分離する。[完了判定](Evidence/261005_project-runtime-phase2.md#36-②の完了判定) |
| 保存方式刷新③ | Execution IntelligenceのJSONL化、安全診断・実績割当・一般Operation、30日既定のTool別設定と新形式切替を完了。独立再レビュー二観点Pass、必須是正0件。移行済み旧領域は人間指示により清掃済み、未解決10件は新履歴で保護。追加指定の既知閉包6指摘も反証・直接回帰・独立再レビューで解消した。署名E2Eは未完了のまま維持する。[③の完了判定](Evidence/261006_execution-intelligence-phase3.md#③の完了判定--2026-10-06)、[追加是正の判定](Evidence/261006_execution-intelligence-phase3.md#検証と完了判定) |
| 成立済み | G1〜G5のScreen Architecture、Direction A、5画面のSecondary展開、Production Shell、公式ロゴ、Project Context共通Reader、Topic／Meeting Record ReaderとRepository CRUD Core、共通Applicationの検索・絞込み・安定並び順・Query拘束Cursor、WorkbenchのTopic／Meeting独立Detail、Workbench／Repository単体MCPのTopic／Meeting CRUDと同一Repository内Meeting Outcome処置、Remote CROSのCredential／Workspace／Exposure／Repository Revision再検証付きTopic／Meeting Routing、同じSessionとExposure Snapshotに限定したRepository間Owner Relation解決、Workbenchの許可済みPortfolio Source明示選択・Remote Topic／Meeting MCP読書き・Owner Repository付きRelation遷移・Local fallback禁止、許可済みPortfolio Federation、Repository mode／CROS federation表示、Project Portfolioの検索・状態絞込み・20件単位Query拘束継続読込・Source別五場面Detail・欠測保持、作業ツリー読取り、選択Stage／Unstage／Commit／確認済み通常Push、拒否・通信断・結果不明・再観測、Role別Credential Core、Token非保存、永続Registry、Workbench Credential管理Surface、Bearer Remote Transport、Workbench Remote接続／更新／切断、Project Runtime状態Toolの非曖昧化、CROS CredentialによるRemote Project Context MCP、Host限定Access Recovery、AI Profileの閉じた共通Schema・一意解決・四軸Availability・Owner別耐久Snapshot・改訂競合付き採用Core・Repository／CROS WorkbenchのProfile限定管理・`systemAdmin`以外へのCatalog非開示・Coordinator／Workbench Consumer接続、Workbenchの現在Session限定AI依頼Port、読取り助言／変更候補の明示、開始／観測／取消、事実／共有済み分析／追加推論／次の選択肢の分離表示、Coordinatorの依頼種別別Mode Router・現在Process内観測・取消・未知状態非推測、読取り助言の利用者依頼・Profile・内容Hash付き許可済み投影をEffect 0で固定する専用Task Packet、許可参照へ拘束した専用Result Parser、Workbench選択Profile IDのCoordinator Task Request→Route Candidate→Executor Selection Grantへのexact搬送とReviewerへの非伝播、Runtime ActivityのRepository実構成、Execution Intelligence EventのProject限定継続読込、Remote CROSのCredential／Exposure再検証付きActivity投影、未接続／absent／unknown／observedの分離表示 |
| 未成立 | Workbenchの読取り助言／変更候補の実Codex／Claude検証、必要な四経路E2E、残るQuality義務の個別処置、および最新Treeの最終配布固定・署名・照合。公開MCP E2Eと最終回復在庫確認は今回成立済みであり、旧失敗結果は履歴Evidenceとして保持する。画面Visual成立、公開MCP成立および局所試験からWorkbench全体の実境界成立を推定しない |
| Phase／Gate適用判断 | `Applicable`: 画面Shell、読取り投影、書込みEffect、Remote接続を分けて成立確認する必要がある |
| 現在Phase | `Phase 5 — Production Closure` |
| 現在Gate | `Passed: Phase 4`: User Accountを追加せず、Role Credentialから許可範囲だけのSessionを作り、Repository単体／Remote CROS、Repository／CROS Profile Ownerおよび非管理者へのCatalog非開示を分離した |
| 次のGate | 人間の最新指定により、是正前に全E2Eの結果を収集する。最新の両助言は成功したが、送信確認の時間切れ、Project RuntimeのProvider開始前停止と未実行経路が残る。残りの実行と結果保存→根本原因ごとの是正計画→必要な是正・再検証→残るQuality義務の個別処置→最終候補の回帰・独立確認→配布固定・再署名・最終照合→人間の採用・Release判断へ進む。旧三件を削除せず、未成立の回復機能や品質義務を免除しない。[全体確認の途中結果](Evidence/261004_all-e2e-collection.md) |

共有管理フォルダのACL移行を前提に復旧設計を広げる案は取り下げ、現在の承認質問にしない。2026-10-04の人間の確認により、まずE2Eを実行し、再現性のある問題だけ対応を検討する。実アクセス権変更・共有環境の初期化・Process停止・旧三件削除は行っていない。以前の局所設計・実装・試験は履歴として保持し、回復全体の成立またはRelease可能とは扱わない。[再開方針と確認結果](Evidence/261004_workbench-e2e-restart.md)を現在の案内とする。

## 契機 / 起点

| 項目 | 記載内容 |
|---|---|
| 種別 | v0.22 Product Capability実装 |
| 情報源 | Workbench Discovery、REQ-000040、UI／SPEC Detail Pilot、CHG-000081 |
| 理由 | 人間・AI・MCPが同じProject Contextを利用できる状態に加え、人間がProject、Topic、Meeting、Repository作業へ進む軽量な入口をProductionとして成立させる |
| 起点となる探索（EXP） | [EXP-000029](../../../01_Discovery/Analysis/EXP-000029/exploration.md)、[EXP-000030](../../../01_Discovery/Analysis/EXP-000030/exploration.md) |
| 対象要求（REQ） | [REQ-000040](../../../01_Discovery/Definitions/REQ-000040/requirement.md) |
| 不具合／監査是正の場合の逸脱契約 | N/A: 新Capabilityの実装である |
| ロードマップ参照 | [v0.22 CROS Workbenchの最小実装](../../01_Roadmap.md#12-v0220--project運営複数repository) |
| 情報源コンテキストの改訂版 | CHG-000081 Phase 6 Passed時点 |
| 人間による着手判断の参照 | 本対話でv0.22 Discovery、Direction A、公式ロゴ利用および実装継続を確認済み |

## 主な変更意図

### 2026-10-06の範囲見直し — 署名対象と一時配置の縮小

人間の承認により、同じv0.22の実行・検証入口を成立させる変更として署名範囲縮小を追加する。理由は、全体Tree照合のために候補ごとのRepository全体展開が増え、終了処置と再署名の負担を生んでいたためである。release／release-stagingの63候補は明示廃棄済みであり、旧一時wrapperから再利用しない。コミット・プッシュは停止する。

| 段階 | 処置と完了条件 | 現在状態 |
|---|---|---|
| 契約確認 | 成立済みの実行閉包、子入口、Native、Policy、Provider、設定Owner、原子公開と過去Evidenceを変更後Ownerへ対応付ける。 | 着手前の二観点確認を統合済み。[ArchitectureのV6方式と再編後の閉包](../../../06_Architecture/Details/coordinator/01_Architecture.md#署名範囲の縮小--v6方式と再編後の閉包)を記録した。完成後レビューではない。 |
| 署名・配置の変更 | V6の署名／検証、選択FileのGit出所照合、最小一時配置、原子Manifest公開と終了・中断の処置を公開入口から接続する。 | 現行V6／履歴V2・V5・V6の分離、Signerと昇格前後の選択File照合、最小一時配置と終了清掃を接続した。既存公開準備入口のbinding局所8件と限定独立レビューはPass。本体Manifestの再署名と署名付き実境界は未実施。 |
| 利用側と伝播 | Runtime公開説明、昇格、履歴読取り、Domain Library、Native設計、Workflowと既存QAの検証設計を揃える。 | 未完了。通常Runtimeが既に持つ実行閉包検証は維持する。 |
| 検証と閉鎖 | 型・整形・Lint後に局所反例、必要な回帰、固定候補の独立レビュー、必要な署名付き実境界を確認する。 | V6／履歴分離9件、選択File出所と読取り上限2件、Manifest昇格14件は静的確認後に成功。旧全体展開fixtureを最小RuntimeとNativeの固定試験入力へ刷新し、署名入口・端末補助37件が成功した。その後の限定レビューで`.git`不存在判定の不足1件を両入口で是正し、production読取り再レビューは限定Pass。最小準備・清掃の追加局所4件も成功した。公開入口接続、変更全体の回帰・独立レビューは未完了。実署名、Provider依頼、Docker／ACL操作はまだ行わない。 |

実行JSONの恒久保存やverification整理は、この変更の前提条件にしない。過去の署名値・結果・Root・Hashを新方式へ書き換えず、V5履歴専用検証と現在Capability発行を分ける。全体配布Treeの一致保証は終了するが、Runtime集合、固定Policy、Nativeと必要な利用側の検証を弱めない。実行中の不変保証を前後Hashだけで成立扱いしない。既存のAIT-IT-002／003／013、AIT-ST-010を用い、新QA IDや新しい署名・清掃Frameworkを増設しない。

入口接続では、旧`prepare-release-candidate`が候補を作成して終了する方式を完成形として残さない。既存の一時操作Ownerを準備から署名・昇格・終了清掃まで維持し、Process-local能力をJSON化しない。署名済みstaging自身からの昇格、終了不明時の同じ回復参照、成功・失敗・取消時の清掃を保持する。未評価の正常準備を拒否試験の成功から推定しない。

最小準備の追加局所試験4件は静的確認後に成功した。固定GitのRuntime集合とNativeだけを展開し、正常終了時の作業領域・操作記録の不存在を確認した。操作記録を一時的に読めなくした反例では清掃未確認と同じ回復参照を保持し、記録復元後の同じSessionから終了処置できた。隣接する試験入力は変更していない。これは公開署名入口、実署名または昇格全体の成功を意味しない。

準備処理の限定独立レビューで、不正終端値による有効Session失効と、耐久的な回復移送後の再入場の未検証を検出した。既存5値の実行時検査を追加し、不正値ではOwnerを呼ばずSession・状態・同じ回復参照を保持する。合成試験でOwner移送とexact作業Directoryの清掃失敗を個別に与え、同じ参照を既存再入場APIへ渡して終了・不存在まで確認した。整形・Lintと現在の全Source／試験の型検査は成功し、更新した局所4件と固定2ファイルの限定再レビューもPassとなった。自身で作成した共通fixture、出所照合実装、Signerおよび公開workflow全体は、この限定レビューの対象外である。

利用側整合の確認では、旧準備入口を残した集合宣言、保護対象のVCS barrel参照、昇格入口のRuntime Root手組を検出した。準備処理の固定入力Ownerへの直接参照、変更済みの既知Consumer集合、昇格時の既存RuntimeData読取り専用観測へ揃えた。Rootとtmpの前後境界Identity、operation/work境界、`.git`の明示不存在を維持する。利用側整合14件と、出所照合・最小準備・昇格の回帰28件は静的確認後にすべて成功した。準備importと昇格観測の追加差分も限定独立レビューPassであり、公開入口・実署名・変更全体の独立レビューは引き続き未完了である。

公開準備入口を同一端末内の準備→署名→昇格→終了処置へ置き換えた。限定独立レビューで検出した、停止期限を保証しすぎた説明と、試験の必須Header・部分確認範囲の不足2件を是正した。直接子へのSIGKILL停止要求と返却待ちを区別し、時間切れ相当でも終了処置せず同じ回復参照を保持する反例を追加した。静的確認後の局所8件と固定2ファイルの限定再レビューはPassとなった。実署名、TTYおよび実子Processの終了は対象外である。

既存Native保護検証Toolの6起動点と昇格の1起動点を固定Owner・引数・内容Hashへ接続した。Tool graphは全登録39件、検証用13件、Runtime26件を受理し、Native9改変・昇格3改変の局所反例を拒否した。Native／Cargo／ACLを実行した根拠ではなく、公開入口の追加是正後に同じgraphを再確認する。

全SourceのHeader検査では、Signer試験の終了hookのHeader不足と、公開準備試験が旧CPR-IT-001へ接続されたままの登録を検出した。hookの責務を明記し、新試験の実際の確認範囲に合わせて既存AIT-IT-013へ接続した。Production Named Symbolと全Test Sourceの機械検査2件は成功した。試験登録の記載もbinding部分境界へ限定し、実署名・TTY・子Processの未評価を保持する。

追加独立確認では、Native構造試験の品質追跡不足と、共有fixtureの祖先検査前の再帰Directory作成を検出した。前者はERB-IT-001／002とAIT-IT-013の確認範囲をFile・Case・Symbolで分け、起動本体・graphの件数とHashを維持した。後者は最初の書込み前にRoot・`.crdd`・`tests`を全数確認し、alias・型不正・canonical不一致・観測不能では書込み0、ENOENTだけ段階作成・再観測へ接続した。全指摘の是正方針を監査間で確認してから適用し、固定候補の再監査は両範囲ともPass・追加指摘0となった。局所4件、全Header検査2件、Native graph局所2件は成功した。署名入口・端末補助の回帰37件も成功し、実署名を成功扱いしていない。

変更全体の二観点レビューでは、初回中断前の参照搬送不足と、Signer固有の署名直前差替え／Git marker観測不能の反例不足を検出した。全結果を統合し、両確認者と整合した限定方針で是正した。署名準備は既存AI実行キューへ未接続であるため、新しいstateやDBを追加せず、起動側が開始前から保持する両識別子を必須非秘密引数として既存Ownerへ搬送する。内部ID生成を廃止し、不正入力は作成前に拒否する。Signer本体を変更せず、Runtime／Native差替え時の秘密鍵読取り0・Manifest不存在・能力再利用拒否と、dangling Git marker／EACCES拒否を試験へ追加した。是正前の関連局所57件、Runtime Data42件、Version Control45件は成功した。是正後の準備4件、CLI8件、Signer反例2件も成功し、固定改訂版の再レビューへ渡す。実TTY・署名・実子Process終了は未評価のままである。

二観点の独立再レビューはPass、必須追加指摘0となった。参照搬送で変わった既存Lifecycleの固定登録1値だけを更新し、登録集合・検査ロジック・昇格処理を維持した。構造検査はSource31・検証用起動13・Runtime起動26を受理し、改変拒否2件と登録限定の独立確認もPassとなった。最終の整形・型・Lint・三構造検査とHeader検査2件は成功し、操作記録の残存0、release／release-stagingの不存在、本体ManifestのHash不変を確認した。

現在の未解決事項は、旧V5 Manifestを現在V6の昇格試験へ使う前提不整合と署名付き実境界確認である。旧Manifestを新方式へ書き換えて試験を通したり、Process検査を弱めたりしない。新方式の手順説明は更新したが、実行再開許可またはRelease成立を意味しない。今回新しいEvidence JSONは追加せず、旧Manifestを保全した。コミット・プッシュは引き続き人間指定により停止する。

2026-10-07、人間は署名試験を延期し、`tmp`・`tests`・旧`verification`のうち明らかに不要な内容の清掃を許可した。空試験Directory8件、既存fixture由来のPID記録97件、元Archiveを保全した同HashのBuild Source Archive21件、正式集約済みの旧静的collectorと結果13件、終了診断31領域、完了済み試験・移行資料5領域、旧配布tar8件、終了済み試験・画面確認32領域、置換済みTool139件と診断生成物21件を回収した。残ったPID9件は生成時刻より後の別Processへの番号再利用と確認した。計3890File・1199Directory、1,297,532,280 bytesを回収し、不存在を確認した。巨大ログを正式Evidenceへ複製していない。

`tests`は回復記録を持つ失敗fixture一件だけを保全した。旧`verification`は未解決の唯一原本5領域、固定Native入力・未移行Owner・現行診断根拠7領域、旧回復Toolが参照するE2E結果4領域の計16領域を保全する。collectorは退役したが、回復参照の消失を避けるため後者の結果だけは残す。過去の失敗値を成功へ変更しない。`tmp`のBuild21領域は正式Source・固定入力との照合と非使用確認により回収可能と判定したが、安全審査がフォルダ全体削除を停止したため、exactな21領域の人間承認を依頼した。承認前に分割削除等で拒否を回避しない。残る10領域と133直下Fileは下表の理由で今回の回収対象外とした。元Archive、認証、本体Manifest、固定Native入力と既存のGit差分は保全し、コミット・プッシュ停止と署名延期を維持する。全物理残存の解消とは表示しない。

| 残存集合 | 保全理由と次の処置条件 |
|---|---|
| `tmp/codex-01592-attestation`、`codex-01592-migration` | 正式Build入口の固定Host・Source入力。参照を正式配置へ置換し、同一生成を確認してから回収する。 |
| `tmp/.operations` | 空の既存Owner管理領域。一般生成物の一括削除から除外する。 |
| `tmp/codex-advice-auth-compat-20261001`、`codex-advice-auth-refresh-20261001` | 認証関連入力・結果。認証・清掃参照の確認なしに回収しない。 |
| `tmp/codex-advice-cli-cancellation-20261001` | 実CLI／OS試験の唯一の補助Source。正式Source化と利用側置換後に回収する。 |
| `tmp/codex-advice-formal-verification-20261001-r2`、`codex-advice-provider-image-20261001` | 現在の品質根拠・固定Production入力。正式な必要根拠と入力の非消失確認後に整理する。 |
| `tmp/codex-advice-patch-baseline-20261001` | alias一件を含むため今回の非alias回収集合から除外する。参照先を確認するまで辿ったり削除したりしない。 |
| `tmp/sign-v022-csr-5a2d6b02`、署名記録55File | 唯一署名情報の非消失確認が残る。延期した署名確認の再開前に再評価する。 |
| 直下の認証Tool1・回復Tool26・Provider／回復／認証記録43・Provider試験結果8 | 記録の役割・回復参照を保全する。現在使用中とは断定せず、実E2E再開前に解決状況と必要最小限の記録を再評価する。 |

同日、人間が旧Build21領域の削除を明示承認した。対象Root・祖先の非alias、現在Processの非使用、各Fileの排他読取りを再確認して回収し、21領域すべての不存在を確認した。追加回収は398File・33Directory、4,424,632,119 bytes。今回の清掃累計は4288File・1232Directory、5,722,164,399 bytesとなった。前段の承認待ちは解消済みであり、現在の削除待ちではない。固定Source Archiveと本体ManifestのSHA256は清掃前後で一致した。`tmp`は保全理由を持つ10領域・133直下File、旧`verification`は16領域、`tests`は失敗fixture一件となり、許可された不要物の清掃を完了した。必要入力・未解決原本の全廃はこの完了に含めない。

残した`tests/host-caller-4326d29c-f315-4a4f-8fc0-4d1816873df1`は、人間の再確認指定を受けて内容を照合した。回復記録のruntime／repository／user Hashは試験用の反復文字、対象Identityも試験Sourceと一致する合成値であり、実運用の未解決回復原本ではなかった。現在のSource・設定・状態からの参照とProcess利用はなく、失敗原因と是正は既存文書へ記録済みである。既存の不要物削除許可に基づき、非alias・exact集合20File・排他読取り・非使用を再確認して仮Repositoryを回収した。追加20File・14Directory・29,604 bytes、累計4308File・1246Directory・5,722,194,003 bytes。対象の不存在と`tests`配下が空であることを確認した。先の一件保全は調査中の判断であり、現在の残存一覧ではない。

人間の追加指定により、`template/.crdd`の直下は現行保存先定義の9領域（config、project-runtime、coordinator、execution-intelligence、candidates、release、communication、tests、tmp）を保持する。設定例4件があるconfigには`.gitkeep`を置かず、空の8領域だけを`.gitkeep`で保持する。下位フォルダ・状態・Lock・logは作成しない。廃止済みverificationと旧release-stagingはひな型へ追加しない。現行定義との集合一致、8placeholderの存在、設定例以外の実データ不存在とGit差分の形式を確認した。配布ひな型の空フォルダ保持であり、利用側のRuntime状態をGit追跡する許可ではない。

旧verificationの残りについて、人間は旧E2E4領域の再確認後の回収と、未解決結果5領域の現在情報確認後の回収を指定した。Project RuntimeのqueueEntries・leaseEvidence・leaseIntents・decisionRecoveriesは空、Repository-localと旧OS保存先のCoordinator状態Rootはなく、旧回復Toolは撤去済みRelease候補に依存していた。現在の利用参照がない過去診断として9領域と旧参照Tool4件を回収し、39File・9Directory・200,053 bytesの不存在を確認した。累計4347File・1255Directory・5,722,394,056 bytes。過去のblocked・cleanup不明を成功へ変更せず、実Docker回復・再起動・Provider依頼は行っていない。現在のverification残存はNative試験関連7領域だけであり、固定パス・補助Source・生成物のBefore／Afterを人間へ提示するまで変更しない。

今回の清掃は保存物の処置であり、実装・保証・権限を変更しない。再評価と残存処置はCHG-000082の整理④で追跡し、署名試験や全E2Eの完了と混同しない。

Workbenchを、独自の正本やAuthorityを持たない薄い利用面として実装する。Production形態はTypeScriptのNode localhost ServerとReact Browser UIとし、ViteはBrowser BundleのBuildだけを所有する。同じ画面契約を将来のRemote CROSでも再利用できるようにし、Next.js等のFull-stack FrameworkやElectron等のDesktop包装は現在の成立条件へ含めない。

左上のブランド表示には、[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または類似アイコンで代替しない。

## 現在状態と構造変更

### 現在の検証と次のWorkbench見直しの順序

人間は、まず現状の設計・実装で必要な局所試験、署名付きE2E、全回帰および独立レビューを完了し、結果と残課題を示して一区切りつける方針を確認した。その後にWorkbenchのUX／IAを再検討する。現状の試験が通ることを、表示スペースと作業導線の十分性の証明とは扱わない。

後続の見直し対象は、表示スペースの役割・情報量・優先順位、表示情報と人間の作業の対応、一覧・詳細・比較・編集の遷移、およびAI相談から人間判断・操作への導線である。現在の検証候補へ未分析のUX変更を混在させず、検証結果の提示後に人間との認識合わせから開始する。見直しの採用内容またはRelease可否をこの順序の確認だけから確定しない。

| 項目 | 変更前 | 変更後 |
|---|---|---|
| Workbench実体 | Visual FixtureとCanonical UI／SPEC Detailだけが存在する | `40_Develop/workbench`がProduction Web Surfaceを所有する |
| Application意味 | CROS、Project Operation、Version Control等に分散した公開契約がある | Workbench Adapterが既存公開契約を利用し、意味やAuthorityを作らない |
| 実行面 | FrameworkとProcess配置が未決 | localhost限定のNode Server＋React Browser UIとし、ViteはBrowser Buildに限定する |
| Branding | Visual Fixtureが公式ロゴを参照する | Production Shellも同じ公式Asset Identityを使用する |
| Desktop包装 | 未定 | 対象外。OS統合上の必要性が実証された場合に別判断する |

詳細設計は[Workbench Architecture](../../../06_Architecture/Details/workbench/01_Architecture.md)を正本とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`99_Roadmap/Changes/CHG-000082/change.md`](./change.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md`](./Evidence/261002_host-orphan-recovery-design.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-item-reconciliation.md`](./Evidence/261002_quality-item-reconciliation.md)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_native-test-cleanup-preflight.md`](./Evidence/261002_native-test-cleanup-preflight.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-visual-preview-projection.md`](./Evidence/261002_quality-visual-preview-projection.md)
- [`40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts`](../../../40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts)
- [`40_Develop/coordinator/src/security/host-terminal-record.ts`](../../../40_Develop/coordinator/src/security/host-terminal-record.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-lease.ts`](../../../40_Develop/coordinator/src/security/host-terminal-caller-lease.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts`](../../../40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts)
- [`40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts`](../../../40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts)
- [`40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts)
- [`40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts`](../../../40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts)
- [`40_Develop/platform-access/src/terminal_protocol.rs`](../../../40_Develop/platform-access/src/terminal_protocol.rs)
- [`40_Develop/platform-access/src/windows_terminal.rs`](../../../40_Develop/platform-access/src/windows_terminal.rs)
- [`40_Develop/platform-access/src/windows.rs`](../../../40_Develop/platform-access/src/windows.rs)
- [`40_Develop/platform-access/src/main.rs`](../../../40_Develop/platform-access/src/main.rs)
- [`40_Develop/platform-access/tests/cli.rs`](../../../40_Develop/platform-access/tests/cli.rs)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](../../../40_Develop/coordinator/src/security/docker-isolation.ts)
- [`40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts)
- [`40_Develop/coordinator/tsconfig.strict.json`](../../../40_Develop/coordinator/tsconfig.strict.json)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](../../../07_Quality/Definitions/QA-000003/quality_definition.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md`](./Evidence/260930-1853_codex-model-host-migration-preflight.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md`](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md`](./Evidence/260929-1428_phase5-production-selection-contract.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md`](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Details/workbench/01_Architecture.md`](../../../06_Architecture/Details/workbench/01_Architecture.md)
- [`06_Architecture/Details/visual-preview/01_Architecture.md`](../../../06_Architecture/Details/visual-preview/01_Architecture.md)
- [`06_Architecture/Details/ai-runtime/01_Architecture.md`](../../../06_Architecture/Details/ai-runtime/01_Architecture.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Definitions/ARCH-000010/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md)
- [`06_Architecture/Details/mcp/01_Architecture.md`](../../../06_Architecture/Details/mcp/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](../../../04_UI/04_Visual_and_Accessibility_Direction.md)
- [`04_UI/06_Current_Interface_Reference.md`](../../../04_UI/06_Current_Interface_Reference.md)
- [`05_SPEC/07_Current_Behavior_Reference.md`](../../../05_SPEC/07_Current_Behavior_Reference.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](../../../40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/ai-runtime`](../../../40_Develop/ai-runtime)
- [`40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts`](../../../40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-model-profile-runtime.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts)
- [`40_Develop/coordinator/scripts/check-runtime-capability-graph.ts`](../../../40_Develop/coordinator/scripts/check-runtime-capability-graph.ts)
- [`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts)
- [`40_Develop/coordinator/src/security/codex-advice-distribution.ts`](../../../40_Develop/coordinator/src/security/codex-advice-distribution.ts)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-container-init-observation.ts`](../../../40_Develop/coordinator/src/security/docker-container-init-observation.ts)
- [`40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json`](../../../40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts)
- [`40_Develop/workbench/package.json`](../../../40_Develop/workbench/package.json)
- [`40_Develop/workbench/package-lock.json`](../../../40_Develop/workbench/package-lock.json)
- [`40_Develop/workbench/tsconfig.json`](../../../40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/vite.config.ts`](../../../40_Develop/workbench/vite.config.ts)
- [`40_Develop/workbench/symbol.json`](../../../40_Develop/workbench/symbol.json)
- `40_Develop/workbench/client/entry-client.ts`（削除）
- [`40_Develop/workbench/client/entry-client.tsx`](../../../40_Develop/workbench/client/entry-client.tsx)
- [`40_Develop/workbench/client/workbench-app.tsx`](../../../40_Develop/workbench/client/workbench-app.tsx)
- [`40_Develop/workbench/client/workbench-ai-request-panel.tsx`](../../../40_Develop/workbench/client/workbench-ai-request-panel.tsx)
- [`40_Develop/workbench/client/workbench-projection-panels.tsx`](../../../40_Develop/workbench/client/workbench-projection-panels.tsx)
- [`40_Develop/workbench/src/presentation/workbench-client-model.ts`](../../../40_Develop/workbench/src/presentation/workbench-client-model.ts)
- [`40_Develop/workbench/src/presentation/workbench-components.ts`](../../../40_Develop/workbench/src/presentation/workbench-components.ts)
- [`40_Develop/workbench/bin/workbench.ts`](../../../40_Develop/workbench/bin/workbench.ts)
- [`40_Develop/workbench/src/index.ts`](../../../40_Develop/workbench/src/index.ts)
- [`40_Develop/workbench/src/ai-profile-surface.ts`](../../../40_Develop/workbench/src/ai-profile-surface.ts)
- [`40_Develop/workbench/src/ai-request.ts`](../../../40_Develop/workbench/src/ai-request.ts)
- [`40_Develop/workbench/src/credential-administration.ts`](../../../40_Develop/workbench/src/credential-administration.ts)
- [`40_Develop/workbench/src/project-plan-surface.ts`](../../../40_Develop/workbench/src/project-plan-surface.ts)
- [`40_Develop/workbench/src/project-surface.ts`](../../../40_Develop/workbench/src/project-surface.ts)
- [`40_Develop/workbench/src/quality-surface.ts`](../../../40_Develop/workbench/src/quality-surface.ts)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除）
- [`40_Develop/workbench/src/remote-topic-meeting.ts`](../../../40_Develop/workbench/src/remote-topic-meeting.ts)
- [`40_Develop/workbench/src/runtime-activity.ts`](../../../40_Develop/workbench/src/runtime-activity.ts)
- [`40_Develop/workbench/src/owner-artifact-surface.ts`](../../../40_Develop/workbench/src/owner-artifact-surface.ts)
- [`40_Develop/workbench/src/workbench-server.ts`](../../../40_Develop/workbench/src/workbench-server.ts)
- [`40_Develop/workbench/scripts/workbench-ai-verification-http.ts`](../../../40_Develop/workbench/scripts/workbench-ai-verification-http.ts)
- [`40_Develop/workbench/tsconfig.json`](../../../40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/src/presentation/workbench-shell.ts`](../../../40_Develop/workbench/src/presentation/workbench-shell.ts)
- [`40_Develop/workbench/tests/integration/project-surface.contract.test.ts`](../../../40_Develop/workbench/tests/integration/project-surface.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-server.contract.test.ts`](../../../40_Develop/workbench/tests/integration/workbench-server.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts`](../../../40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts)
- [`40_Develop/workbench/dist/client/assets/workbench-client.js`](../../../40_Develop/workbench/dist/client/assets/workbench-client.js)
- [`40_Develop/workbench/tests/system/workbench-visual.integration.test.ts`](../../../40_Develop/workbench/tests/system/workbench-visual.integration.test.ts)
- [`40_Develop/visual-preview/src/browser-zoom-verifier.ts`](../../../40_Develop/visual-preview/src/browser-zoom-verifier.ts)
- [`40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts`](../../../40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md`](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md`](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-0025_phase5-signed-csr-distribution-closure.md`](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1123_phase5-mount-grant-fresh-observation.md`](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- [`.gitignore`](../../../.gitignore)
- [`40_Develop/cros/src/project-federation.ts`](../../../40_Develop/cros/src/project-federation.ts)
- [`40_Develop/cros/src/connection-credential.ts`](../../../40_Develop/cros/src/connection-credential.ts)
- [`40_Develop/cros/src/credential-access-recovery.ts`](../../../40_Develop/cros/src/credential-access-recovery.ts)
- [`40_Develop/cros/src/credential-access-recovery-file-adapter.ts`](../../../40_Develop/cros/src/credential-access-recovery-file-adapter.ts)
- [`40_Develop/cros/src/credential-access-recovery-cli.ts`](../../../40_Develop/cros/src/credential-access-recovery-cli.ts)
- [`40_Develop/cros/bin/cros-access-recovery.ts`](../../../40_Develop/cros/bin/cros-access-recovery.ts)
- [`40_Develop/cros/src/remote-transport.ts`](../../../40_Develop/cros/src/remote-transport.ts)
- [`40_Develop/cros/src/runtime.ts`](../../../40_Develop/cros/src/runtime.ts)
- [`40_Develop/cros/src/index.ts`](../../../40_Develop/cros/src/index.ts)
- [`40_Develop/cros/tests/integration/connection-credential.contract.test.ts`](../../../40_Develop/cros/tests/integration/connection-credential.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts`](../../../40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts`](../../../40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/project-federation.contract.test.ts`](../../../40_Develop/cros/tests/integration/project-federation.contract.test.ts)
- [`40_Develop/cros/tests/integration/remote-transport.contract.test.ts`](../../../40_Develop/cros/tests/integration/remote-transport.contract.test.ts)
- [`40_Develop/cros/tests/system/session-access.contract.test.ts`](../../../40_Develop/cros/tests/system/session-access.contract.test.ts)
- [`40_Develop/cros/symbol.json`](../../../40_Develop/cros/symbol.json)
- [`40_Develop/mcp/src/protocol/project-runtime-protocol.ts`](../../../40_Develop/mcp/src/protocol/project-runtime-protocol.ts)
- [`40_Develop/mcp/src/protocol/project-context-protocol.ts`](../../../40_Develop/mcp/src/protocol/project-context-protocol.ts)
- [`40_Develop/mcp/src/protocol/topic-meeting-protocol.ts`](../../../40_Develop/mcp/src/protocol/topic-meeting-protocol.ts)
- [`40_Develop/mcp/src/adapters/application-adapter.ts`](../../../40_Develop/mcp/src/adapters/application-adapter.ts)
- [`40_Develop/mcp/src/adapters/project-context-adapter.ts`](../../../40_Develop/mcp/src/adapters/project-context-adapter.ts)
- [`40_Develop/mcp/src/adapters/topic-meeting-adapter.ts`](../../../40_Develop/mcp/src/adapters/topic-meeting-adapter.ts)
- [`40_Develop/mcp/src/composition/cros-project-context-application.ts`](../../../40_Develop/mcp/src/composition/cros-project-context-application.ts)
- [`40_Develop/mcp/src/transports/request-handler.ts`](../../../40_Develop/mcp/src/transports/request-handler.ts)
- [`40_Develop/mcp/src/transports/stdio-transport.ts`](../../../40_Develop/mcp/src/transports/stdio-transport.ts)
- [`40_Develop/mcp/src/transports/streamable-http-transport.ts`](../../../40_Develop/mcp/src/transports/streamable-http-transport.ts)
- [`40_Develop/mcp/src/index.ts`](../../../40_Develop/mcp/src/index.ts)
- [`40_Develop/mcp/symbol.json`](../../../40_Develop/mcp/symbol.json)
- [`40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts`](../../../40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts`](../../../40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts`](../../../40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts)
- [`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/stdio-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts`](../../../40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts)
- [`template/tools/crdd-mcp.ts`](../../../template/tools/crdd-mcp.ts)
- [`40_Develop/project-operation/src/index.ts`](../../../40_Develop/project-operation/src/index.ts)
- [`40_Develop/project-operation/src/repository-project-context.ts`](../../../40_Develop/project-operation/src/repository-project-context.ts)
- [`40_Develop/project-operation/src/topic-meeting.ts`](../../../40_Develop/project-operation/src/topic-meeting.ts)
- [`40_Develop/project-operation/src/topic-meeting-repository.ts`](../../../40_Develop/project-operation/src/topic-meeting-repository.ts)
- [`40_Develop/project-operation/src/topic-meeting-application.ts`](../../../40_Develop/project-operation/src/topic-meeting-application.ts)
- [`40_Develop/project-operation/symbol.json`](../../../40_Develop/project-operation/symbol.json)
- [`40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts)
- [`40_Develop/version-control/src/change-publication.ts`](../../../40_Develop/version-control/src/change-publication.ts)
- [`40_Develop/version-control/src/git/change-publication-adapter.ts`](../../../40_Develop/version-control/src/git/change-publication-adapter.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/change-publication.integration.test.ts`](../../../40_Develop/version-control/tests/integration/change-publication.integration.test.ts)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- [`template/22_Topics/_Template/topic.md`](../../../template/22_Topics/_Template/topic.md)
- [`template/23_Meetings/_Template/meeting.md`](../../../template/23_Meetings/_Template/meeting.md)
- [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)
- [`Evidence/260927-1733_phase1-production-shell.md`](./Evidence/260927-1733_phase1-production-shell.md)
- [`Evidence/260927-1748_phase2-project-context-reader.md`](./Evidence/260927-1748_phase2-project-context-reader.md)
- [`Evidence/260927-1759_topic-meeting-record-contract.md`](./Evidence/260927-1759_topic-meeting-record-contract.md)
- [`Evidence/260927-1812_phase2-read-only-project-surface.md`](./Evidence/260927-1812_phase2-read-only-project-surface.md)
- [`Evidence/260927-1836_phase3-change-publication-it.md`](./Evidence/260927-1836_phase3-change-publication-it.md)
- [`Evidence/260927-1845_phase3-repository-work.md`](./Evidence/260927-1845_phase3-repository-work.md)
- [`Evidence/260927-1921_phase4-credential-administration.md`](./Evidence/260927-1921_phase4-credential-administration.md)
- [`Evidence/260927-1939_phase4-remote-transport.md`](./Evidence/260927-1939_phase4-remote-transport.md)
- [`Evidence/260927-1945_phase4-workbench-remote-connection.md`](./Evidence/260927-1945_phase4-workbench-remote-connection.md)
- [`Evidence/260927-1954_phase4-workbench-connection-surface.md`](./Evidence/260927-1954_phase4-workbench-connection-surface.md)
- [`Evidence/260927-1959_mcp-runtime-state-tool-name.md`](./Evidence/260927-1959_mcp-runtime-state-tool-name.md)
- [`Evidence/260927-2014_phase4-project-context-mcp.md`](./Evidence/260927-2014_phase4-project-context-mcp.md)
- [`Evidence/260927-2022_phase4-test-catalog-closure.md`](./Evidence/260927-2022_phase4-test-catalog-closure.md)
- [`Evidence/260927-2029_phase4-remote-project-context-mcp.md`](./Evidence/260927-2029_phase4-remote-project-context-mcp.md)
- [`Evidence/260927-2037_topic-meeting-repository-crud.md`](./Evidence/260927-2037_topic-meeting-repository-crud.md)
- [`Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md`](./Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md)
- [`Evidence/260927-2120_meeting-outcome-treatment.md`](./Evidence/260927-2120_meeting-outcome-treatment.md)
- [`Evidence/260927-2157_ai-profile-catalog.md`](./Evidence/260927-2157_ai-profile-catalog.md)
- [`Evidence/260927-2257_phase5-screen-reality-audit.md`](./Evidence/260927-2257_phase5-screen-reality-audit.md)
- [`Evidence/260927-2303_phase5-runtime-activity.md`](./Evidence/260927-2303_phase5-runtime-activity.md)
- [`Evidence/260927-2309_phase5-owner-artifact-surface.md`](./Evidence/260927-2309_phase5-owner-artifact-surface.md)
- [`Evidence/260927-2324_phase5-runtime-activity-composition.md`](./Evidence/260927-2324_phase5-runtime-activity-composition.md)

</details>

## 想定する影響

- コンテキスト: Project／Portfolio、Topic／Meeting、Quality、正本Relation、AI依頼、Repository Worktree、接続設定
- 成果物: Workbench Architecture、Quality Analysis／Definition、Production Source、Test、Evidence
- 利用者 / 運用: Developer、Project Operator、PM、Management、Administratorが同じ入口を役割内で利用する
- データ / インターフェース / 移行: 既存CROS／Project Operation／Version Control公開契約を利用し、Workbench専用正本を追加しない
- セキュリティ / プライバシー / コスト: localhost既定、Repository／Session Authorityを再評価せず、非開示情報を推測しない。Desktop Runtime依存は追加しない

## 対象外 / 変更してはならないこと

現在品質の一項目適用、旧集計の不整合と採用Scopeの再照合は[品質投影記録](Evidence/261002_quality-visual-preview-projection.md)を参照する。この記録更新からSource、検証義務、AuthorityまたはRelease Scopeを変更しない。

- 対象外: Electron等のDesktop包装、Force Push、Merge、Rebase、通常Discard、Workbench内会話履歴の正本化、本格Trust Policy管理
- 変更してはならないこと: CROS／Project Operation／Version ControlのAuthority、Project ContextのOwner、非開示Sourceの存在秘匿、CHG-000081で固定したDirection Aと公式ロゴの使用

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 新しい利用者入口、Process、HTTP境界およびRepository Effectを追加する | 各Phase Gateと独立レビュー |
| 変更する契約母集団 | Applicable | Workbench UI／SPEC Detail、関連Architecture、Quality、公開Application Contract | Phase 0／1で固定する |
| 既知の利用側母集団と対象別の予定処置 | Applicable | Local Browser、将来Remote CROS、Repository単体利用 | Screen／入口別のSystem試験で確認する |
| 安全上重要な層間搬送 | Applicable | UI操作から既存Application Contract、Version Control Effectへの搬送 | 書込みPhaseでEffect前後を確認する |
| 保護対象Effect／Recoveryの耐久Authority | Applicable | Commit／Push、Credential管理は既存Authorityだけを使う | Effect実装前に再照合する |
| 残存資源／Recovery／Authority義務を伴う取得transaction | Applicable | HTTP listener、Browser request、Git process、Remote session | Integration／System試験で確認する |
| 発火例／非発火例／境界例／情報不足例 | Applicable | Local／Remote、権限あり／なし、部分観測、結果不明を分ける | Screenごとの契約試験 |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | loading／empty／partial／restricted／unknown／failedを正常へ畳まない | UI stateとApplication結果の照合 |
| 固定前の実差分照合 | Applicable | Source追加前にArchitecture／Qualityを固定する | 各実装Phase開始前 |
| 根拠の主張軸（入口形態） | Applicable | Repository単体、Local CROS、Remote CROSで可用能力が異なる | Public Surface E2E |
| 根拠の主張軸（観測基盤） | Applicable | DOM、HTTP、Application Contract、Git／Remote境界を分ける | Verification Design |
| 根拠の主張軸（成果物Identity） | Applicable | UI／BHV／ARCH／QA／Source／Test／Evidenceを接続する | Reality Audit |
| 根拠の主張軸（lifecycle） | Applicable | Server開始、要求、Effect、結果、shutdown、資源0を分ける | Host E2E |
| 未解消の不一致 | OPEN | UI／CSR画面、Application Contract、実データ、Production全Profile STおよびShared Server運用境界は接続済み。Project Runtime公開MCPはRun `2e55c8cd2897464b`で通常二経路・取消・exact Recovery・最終回復在庫確認まで合格した。旧取消Oracleおよび終了後Observer接続の不一致は是正・独立確認済みである。Workbench実Provider、必要な四経路、残る個別品質項目および最終配布署名は未完了である | 未完了の実境界と個別品質項目を確認し、最終固定候補の回帰・独立レビュー・再署名後にRelease判断へ渡す |

## 変更経路の計画

- 適用判定: `Applicable`: Architecture Detail、Quality、Development、Reality Auditを順に進める
- 計画した主な工程 / 共通責務: Reality Audit→Architecture Detail→Quality義務→Production Skeleton→読取り面→書込み面→Remote接続→E2E
- 選択理由: Canonical Detailを既存WIPへ合わせず、既存公開契約を利用する最小Surfaceとして実装するため
- 予定する検証: Formatter、型、Lint、単体／結合／System、実Browser visual profile、Repository Checker、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Electron先行は包装と配布の責務を増やし、現時点の利用者成果に必要ないため採用しない

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | 読取りSurfaceとRepository／Credential Effectを同時に完成扱いしないため |

### PhaseとGate

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 0: Reality Audit／Production Boundary | 現行実装、再利用契約、配置、素材、対象外を固定する | CHG、Architecture Detail、Map | Current Reality照合、Repository Checkerの構造・Relation検査 | 第二正本・Authority生成0、利用する公開契約と実行面が一意 | Passed |
| Phase 1: Production Skeleton | localhost ServerとBrowser Shellを成立させる | `40_Develop/workbench` | 静的確認、Server lifecycle、Browser smoke、公式ロゴ読込 | 公開入口からDirection A Shellを表示し、shutdown後資源0 | Passed |
| Phase 2: Read-only Project Surface | Project／Portfolio／Topic／Meeting等を公開契約から表示する | Adapter、View Model、Screens | Contract／System／Accessibility | 欠測・制限・部分成功を保持して主要読取りFlowが成立 | Passed |
| Phase 3: Repository Work | Tree／Diff／Stage／Commit／通常Pushを接続する | Version Control Adapter、確認Flow | Effect前後、失敗、結果不明、回復 | Force Push 0、暗黙再送0、選択差分だけを処置 | Passed |
| Phase 4: Connection／AI Surface | Local／Remote接続、Role別Credential、AI依頼面を接続する | CROS／Runtime Adapter | Authority、Disclosure、Session lifecycle | User管理を追加せず、許可範囲だけで同じ契約を利用 | Passed |
| Phase 5: Production Closure | 15 Screen範囲、Visual、E2E、Reality Auditを閉じる | 全Production Surface | 全回帰、実Browser、独立レビュー | Blocking Finding 0、未観測を明示しRelease判断へ引渡し可能 | In Progress |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| 通常producerの共有管理DirectoryとNativeの固定保護条件が一致しなかった | 同じHost回復責務の局所不一致として調査したが、現Directoryから他利用者の実変更可能性までは実証していない | 当初、保護付き作成と限定ACL移行の設計・実装・試験を追加した。現在は追加拡張を止め、固定E2Eと再現した失敗を優先する | 追加基盤の完成を保存済み署名Runtimeの固定E2E開始の一律前提にしない。旧三件や回復全体の未成立を消去しない | ACL移行案は取り下げ、現在の承認質問にしない。権限変更・共有OS作成・旧三件削除は未実施 | 過去の局所確認と配布128試験を保持し、製品全体の完成へ一般化しない。[現在の方針](Evidence/261004_workbench-e2e-restart.md)、[旧比較](Evidence/261002_host-orphan-recovery-design.md#共有管理フォルダの保護不一致と次の判断--2026-10-04) |
| 既存Host残存一件に、既知の`workspace/fixture.txt`、7bytesが存在した。2026-10-04に人間が限定設計への追加を承認した | 元の回復参照がない同じHost残存を安全に処置する責務の具体的な反例であり、汎用非空清掃の追加ではない | Phase 5の限定Recoveryへ指定file一件を別クラスとして追加。空クラス・現行十一実体Schemaは緩めない | 十二実体・同handle内容／リンク数確認・fileからの非再帰処置・部分再入場を設計、実装、Qualityへ接続する。全体Gateと新実Task停止は維持する | 人間は、この作業の試験以外でCoordinatorを利用していないことと設計対象への追加を回答した。これはProcess終了、非使用、実停止・削除の承認ではない | 専用codec、観測、Native保存／読戻し、Adapter・callerと記録準備をSource接続した。空TEMP／TMPの実所在取得停止をHost専用環境で是正し、30 Host UT／8 caller IT／9 Windows Adapter UTと選択3契約が成功した。読み取り専用実診断は専用保存子Directory欠落で停止した。初期化入口・正常固定OS保存・本番再入場・公開処置は未成立。[現在の結果](Evidence/261002_host-orphan-recovery-design.md#十二実体の記録準備と実環境の保存境界--2026-10-04) |
| 元の回復参照を確定できない空のHost残存が観測され、同じCHGで限定保守経路を追加する人間判断を得た | 実Provider検証後の残存から安全に回復できない、既存Recovery責務の欠落であり、新しい汎用清掃Capabilityではない | Phase 5へ空のhost_onlyに限る対象確認・fresh承認・非使用確認・限定処置・不存在観測を追加 | 新実Task停止を維持する。候補判定、実観測、Authority、実処置、公開入口および全資源観測を分けて閉じる。局所UTをRecovery完成へ読み替えない | 設計・実装・局所反証・独立確認は本対話で承認済み。2026-10-03にCoordinator所有範囲の終了・利用抑止・排他で閉じる方向を確認し、Windows再起動を前提にしない。実在三件の削除、元Token生成、実Process停止、Provider再送、Docker再起動、Releaseは含めない | 第一単位は候補設計とAuthorityを発行しない内部Policy。全利用側と旧形式の閉包、作成前排他、OS処置境界・再入場はOPEN。方式の採否待ちではなく承認範囲内の再設計中。[現在記録](Evidence/261002_host-orphan-recovery-design.md) |
| 署名済み実境界で障害修復Protocolが意図的に返す公式停止の未発行を上位Runtimeが失敗扱いした | Workbench AI実Provider E2Eを成立させるDocker境界のProduction Closureであり、同じIntent内の実境界Gapである | Phase 5へ障害修復の`not_issued`受理契約是正を追加 | Repairでは公式停止を発行せず、上位Runtimeが`false / not_issued`だけを正常分岐として受理する局所契約試験、署名済み修復、Host Windows回帰を追加 | 既存の修復ID・耐久記録・Trust・削除禁止を維持し、`true / unknown`を成功へ補正しない | 対応中 |
| Workbenchの将来展開を踏まえ、表示層をReact＋Viteへ固定する人間判断を得た | Project Context、Topic／Meeting、Repository、AIおよびShared Serverを一つのWorkbenchへ展開する同じProduction Intentであり、別Capabilityではない | Phase 5へVite Browser Build、固定Asset配信および既存15画面のReact移行を追加 | Node側のAuthorityとHTTP操作契約を維持し、CSR、JSON Read Model、CSP、allowlist、既存IT、実Browser Visualを再確認する。全画面Component化前を移行完了と表示しない | React＋Vite採用は本対話で確認済み。Next.js、Electron、業務AuthorityのClient移動は対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 段階移行境界やSSRとの二重管理を残さず、既存15画面本体をClient-side React Componentへ移行する人間判断を得た | React＋ViteをWorkbenchのProduction表示基盤として固定する同じIntentの完結条件であり、新しい利用者Capabilityではない | Phase 5へ全画面CSR、JSON Read Model境界、Raw HTML Fragment廃止、SSR／Hydration廃止およびBrowser DOM再読取り廃止を追加 | 既存15画面、Form、Action Token、権限、Server Effect、同一Origin／CSP、3表示Profile×3 Zoomを不変条件として再検証する。旧署名候補は移行前Evidenceとしてのみ保持し、移行後に新しい固定候補を作る | 本対話でスコープ拡大とSSR不採用を確認済み。Clientへの業務Authority移動、Next.js、Electronは引き続き対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 純粋CSR移行後の署名候補を直接起動すると、Node実行グラフが旧SurfaceのReact rendererへ到達し、空のAI Profile Storeが返す既定Catalog Revision 0を実行計画が拒否した | 署名配布物と実Provider E2Eを成立させる同じWorkbench Production Closureであり、新しい利用者Capabilityではない | Phase 5へBrowser-only Panel分離、Node依存閉包検査、Revision 0のStore→Composition→Dispatch統合試験およびJSON境界の整数検証を追加 | Server RuntimeからReact value依存を除外し、既定Catalogの初期Revision 0だけをexactに受理する。負数・小数・破損・観測不能は拒否し、最初の採用だけをRevision 1とする | SSR再導入、Node DOM所有、Revisionの暗黙補正は対象外。現行方針のまま是正可能なため追加判断なし | 局所型・Lint・Build、Workbench統合20件、Coordinator局所11件をPass。不連続Revisionと連続Revisionの破損Envelopeは独立反証とし、どちらもEffect前に拒否する。署名候補の直接起動と実Provider E2Eは後続で再固定する |
| 純粋CSR修正後のSource Commitを署名できたが、署名stagingにVite生成済みBrowser Bundleが存在せずWorkbenchを直接起動できなかった | 署名済みWorkbenchを利用者入口から起動する同じProduction Closureであり、CSR Sourceだけの成立を配布成立へ誤認しないため | Phase 5へ固定Browser BundleのGit追跡・署名Tree収載契約を追加 | Vite生成結果を設計正本へ昇格せず、固定Pathの派生AssetをSource Commitへ収載する。Build再実行後も追跡Bundleが一致し、Manifest除外Source Treeから直接起動できることを要求する | Runtime Build、Node側React import、署名後の未追跡Asset追加は対象外。現在方針の完結に必要な一意修正であり追加判断なし | `.gitignore`の包括除外を廃止し、固定Bundleを追跡対象へ追加した。Git追跡集合を検査する`ERB-IT-021`を追加し、Workbench 21／21 Pass。旧署名候補はSource／配布閉包不一致のため流用しない |
| 署名候補の実Provider E2EがMount Grant消費前に`workbench_ai_advice_mount_authorization_unavailable`で停止した | 既存Architectureが要求する一回限り観測Capabilityとfresh再観測を、本番助言Runtimeへ接続する同じProduction Closureである | Phase 5へMount Grant発行後・消費前のProvider Home再観測を追加 | 発行用観測と消費用fresh観測を別Capabilityとして局所反証し、再観測不能ではGrant消費0・Provider Effect 0・Operation cleanup完了を要求する。修正後の署名候補で実Provider E2Eを再実行する | Provider Home契約、Mount Grant TTL、Repository非共有、外部送信許可範囲は変更しない。既存契約へ一意に整合するため追加判断なし | 実装・局所試験・型検査・Coordinator Portable全回帰・独立確認済み。再署名、実Provider E2Eは継続 |
| Mount修正後の署名候補が次のSelection境界で`workbench_ai_advice_selection_unavailable`に停止した | Workbench専用助言Operationが一般Selection Runtimeの必須Repository結合と、Selection Grantを必要とする明示委譲の要求意味を欠いていた。設計済みのMount前／Effect直前二段階Selectionも未接続だった。同じProduction Closure内の接続Gapである | Phase 5へ元Repository Identity結合、Selection再発行Lifecycleおよび明示委譲Selection要求を追加 | 一般SelectionのRepository結合条件と`none`のGrant非発行契約を弱めず、元RepositoryをOperationへ内部結合する。Workbenchの明示Provider／Profile選択を`beneficial`かつ`explicit_user_delegation`として要求する。Mount前の初回SelectionをMount後に失効し、同じ入力による再SelectionのProvider、Profile、Model、推論強度、速度および理由が完全一致する場合だけEffectへ進む。発行済みSelectionは意味検証前からcleanup対象として保持し、旧Selection失効失敗と不正な再SelectionをAuthority残存不明へ閉じる。Production接続を局所反証し、修正後署名候補でE2Eを再実行する | Repository／WorkspaceのProvider Mount、Path搬送、任意読取りAuthority、Selection TTL、`none`経路および外部送信許可範囲は変更しない。既存Architectureへ一意に整合するため追加判断なし | Production Selection対象35／35、型・Lint・Capability Graph／Traceability、Workbench 21／21、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後候補の独立確認、再署名、実Provider E2Eは継続 |
| Repository結合・二段階Selection修正後の署名候補も初回Selectionで`workbench_ai_advice_selection_unavailable`に停止した | WorkbenchがProduction Selection契約へ渡す要求意味の接続Gapであり、同じ助言Production Closureの継続である | Phase 5へWorkbench Selection要求契約とProduction直接結合試験を追加 | Selection Grantを必要とする明示AI実行を`none`へ畳まず、`beneficial`／`explicit_user_delegation`、明示Provider／Profile、Coordinator役割、Operation chainを含む閉じた要求Objectを渡す。Mock fixtureで余分なPropertyを含めて完全比較し、Productionが生成した初回・再発行要求を実Selection Runtimeへ渡して旧Grant失効、新Grant消費およびProvider準備までを反証する | `none`のGrant不要契約、Profile選択、Repository非共有、外部送信許可およびProvider Effect Gateは変更しない。既存契約へ一意に整合するため追加判断なし | 局所35／35、型・Lint・Capability Graph／Traceability、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後独立確認、再署名および実Provider E2Eは継続 |
| 署名実Provider E2Eが17件の不一致で停止した | 実Provider境界を成立させる同じProduction Closureであり、17件は独立した新Capabilityではなく、Provider境界診断の閉集合、正規Candidate Identityの利用側互換、人間受入待ちの期待値という3つの契約ずれから派生していた | Phase 5へLifecycle診断の設定・開始・終了Event分離、Candidate Identity非縮退、`integration_pending`終端のE2E期待を追加 | 既知Lifecycle Eventを違反へ誤分類せず、同じOperationへ相関する。Canonical Candidate IDをIntegration Recordまで完全保持する。Task完了・候補採用をObjective／Milestone受入へ昇格せず、人間の明示受入は別Capabilityに維持する | Docker Desktop内部socket障害との時間的相関は有力仮説として分離し、CRDD原因と断定しない。受入Authority、外部送信範囲、Provider HomeおよびDocker Recovery契約は変更しない | Source、Architecture、Qualityおよび局所契約を是正。局所33／33、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 93／93、独立確認Finding 0。再署名および実Provider E2Eは継続 |
| 再署名後の実Provider E2Eで正常2経路は成立したが、取消経路に2件の不一致が残った | stdio EOFは親Transport喪失による取消要求であり、取消完了ではない。Productionは終了観測不能を`blocked / unknown`とexact Runtime Process Recovery義務へ閉じたが、検証Oracleだけが即時`cancelled / settled`を要求していた | Phase 5の検証OracleとE2E所有fixture清掃を改訂 | 取消要求、Provider／Process終了、結果、cleanupを分離し、不明時は一意なRecovery義務と最終Inventory cleanを必須にする。E2Eが所有する既知fixture変更だけを開始前内容へ戻す | 公開MCPへ新しい取消Toolを追加せず、Transport喪失、取消要求、取消完了およびRecoveryを混同しない。Productionの保守的な停止契約を弱めない | 静的検査一式、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 10／10、局所System 30／30、独立確認Finding 0。再署名実Provider E2Eおよび四経路E2Eは継続 |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| N/A: 現時点で途中見直しなし | N/A | N/A | N/A | UI／SPEC Detailと既存公開契約 | N/A |

## 変更影響の伝播確認

- 情報源の改訂版: CHG-000081 Phase 6 Passed
- 監査結果の参照: CHG-000081独立レビューFinding 0
- 上流 / 同層の正本更新: Workbench Architecture Detailを追加した
- 下流影響の再探索: Quality、Development、Test Catalog、Reality AuditをPhase順に更新する
- 再監査の結果: Phase 0固定候補で実施する
- 伝播例外: N/A: 例外なし

## 実装の参照

- [`40_Develop/workbench`](../../../40_Develop/workbench)
- 公開API: `startWorkbench`
- CLI: `node 40_Develop/workbench/bin/workbench.ts`

## 検証

- 検証義務: Workbench Architecture Detailの8導出キーを既存Quality目標へ接続し、Production境界を`ERB-IT-021`、Production DOMを`ERB-ST-022`へ分けた
- 検証設計: localhost直接境界ITと実Browser System／E2Eを分離した
- 結果参照: [Phase 1 Production Shell](./Evidence/260927-1733_phase1-production-shell.md)、[Phase 2 Project Context Reader](./Evidence/260927-1748_phase2-project-context-reader.md)、[Topic／Meeting Record Contract](./Evidence/260927-1759_topic-meeting-record-contract.md)、[Phase 2 Read-only Project Surface](./Evidence/260927-1812_phase2-read-only-project-surface.md)、[Phase 3 Change Publication IT](./Evidence/260927-1836_phase3-change-publication-it.md)、[Phase 3 Repository Work](./Evidence/260927-1845_phase3-repository-work.md)、[Phase 4 Project Context MCP](./Evidence/260927-2014_phase4-project-context-mcp.md)、[Phase 4 試験台帳の閉包確認](./Evidence/260927-2022_phase4-test-catalog-closure.md)、[Phase 4 AI Profile Catalog](./Evidence/260927-2157_ai-profile-catalog.md)、[Phase 4 Workbench AI依頼Port](./Evidence/260927-2210_workbench-ai-request-port.md)、[Phase 5 15画面Reality Audit](./Evidence/260927-2257_phase5-screen-reality-audit.md)、[Phase 5 Runtime Activity](./Evidence/260927-2303_phase5-runtime-activity.md)、[Phase 5 Owner Artifact Surface](./Evidence/260927-2309_phase5-owner-artifact-surface.md)、[Phase 5 Runtime Activity実構成](./Evidence/260927-2324_phase5-runtime-activity-composition.md)、[Phase 5 Project Plan構造化投影](./Evidence/260927-2337_phase5-project-plan-projection.md)、[Phase 5 Quality構造化投影](./Evidence/260927-2350_phase5-quality-projection.md)、[Phase 5 Documentation検索](./Evidence/260927-2352_phase5-documentation-search.md)、[Phase 5 Runtime Activity閉包](./Evidence/260928-0014_phase5-runtime-activity-closure.md)、[Phase 5 Topic／Meeting Collection／Detail](./Evidence/260928-0031_phase5-topic-meeting-collection-detail.md)、[Phase 5 Repository Tree／Diff](./Evidence/260928-0044_phase5-repository-tree-diff.md)、[Phase 5 Topic／Meeting Relation遷移](./Evidence/260928-0053_phase5-topic-meeting-relation-navigation.md)、[Phase 5 Topic→CHG昇格接続](./Evidence/260928-0105_phase5-topic-change-promotion.md)、[Phase 5 Project Portfolio遷移](./Evidence/260928-0115_phase5-project-portfolio-navigation.md)、[Phase 5 AI結果Provenance](./Evidence/260928-0207_phase5-ai-result-provenance.md)、[Phase 5 現在の15画面Reality Audit](./Evidence/260928-0243_phase5-current-screen-reality-audit.md)
- 追加結果参照: [Phase 5 Remote CROS Topic／Meeting Routing](./Evidence/260928-0253_phase5-remote-topic-meeting-routing.md)
- 追加結果参照: [Phase 5 Repository間Owner Relation](./Evidence/260928-0305_phase5-cross-repository-owner-relation.md)
- 追加結果参照: [Phase 5 Remote Workbench Topic／Meeting](./Evidence/260928-0325_phase5-remote-workbench-topic-meeting.md)
- 追加結果参照: [Phase 5 Workbench AI一回送信境界](./Evidence/260928-0415_phase5-workbench-ai-send-boundary.md)
- 追加結果参照: [Phase 5 Workbench Provider Adapter](./Evidence/260928-0425_phase5-workbench-provider-adapter.md)
- 追加結果参照: [Phase 5 署名Runtime閉包と助言Execution Plan](./Evidence/260928-0439_phase5-signed-runtime-closure-and-advice-plan.md)
- 追加結果参照: [Phase 5 Provider Command／Output境界](./Evidence/260928-0500_phase5-provider-command-and-output-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Runtime Packet](./Evidence/260928-0530_phase5-advice-runtime-packet.md)
- 追加結果参照: [Phase 5 `workbench_advice` Docker境界](./Evidence/260928-0600_phase5-workbench-advice-docker-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Production Runtime](./Evidence/260928-0635_phase5-workbench-advice-production-runtime.md)、[Phase 5 Workbench変更候補Production Runtime](./Evidence/260928-0715_phase5-workbench-change-candidate-runtime.md)、[Phase 5 AI二画面の現在Reality Audit](./Evidence/260928-0725_phase5-ai-screen-reality-audit.md)、[Phase 5 AI Runtime Package Closure](./Evidence/260928-0750_phase5-ai-runtime-package-closure.md)、[Phase 5 変更候補の採否境界](./Evidence/260928-0911_phase5-candidate-disposition.md)
- 追加結果参照: [Phase 5 Workbench実Browser Visual Gate](./Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)
- 追加結果参照: [Phase 5 React＋Vite Shell移行](./Evidence/260928-1535_phase5-react-vite-shell-migration.md)（SSR／Hydrationを使用していた移行途中の履歴Evidence。現行表示構造は後続の純粋CSR Evidenceが置き換える）
- 追加結果参照: [Phase 5 Docker Process終了全体期限](./Evidence/260928-1543_phase5-docker-process-termination-budget.md)
- 追加結果参照: [Phase 5 Workbench純粋CSR移行](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- 追加結果参照: [Phase 5 純粋CSR Runtime閉包検証](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- 追加結果参照: [Phase 5 署名CSR配布閉包](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- 追加結果参照: [Phase 5 Mount Grant fresh再観測](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- 追加結果参照: [Phase 5 Workbench Repository結合とSelection更新](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- 追加結果参照: [Phase 5 Workbench Production Selection契約](./Evidence/260929-1428_phase5-production-selection-contract.md)
- 追加結果参照: [Phase 5 複数Docker Recoveryの検証付き再起動](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- 追加結果参照: [Phase 5 実Provider E2Eの契約整合](./Evidence/260929-2254_phase5-real-provider-contract-alignment.md)
- 追加結果参照: [署名Runtimeの終了後Observer接続是正と公開MCP E2E再実測](./Evidence/260930-1440_signed-runtime-recovery-observer.md)
- 追加結果参照: [Workbench助言の実Provider出力拒否と診断搬送の是正](./Evidence/260930-1621_workbench-advice-result-rejection.md)
- 追加結果参照: [Shared Gatewayの非開示境界と品質適用](./Evidence/261002_shared-gateway-non-disclosure.md)。`RFD-ST-004`だけを新しい実HTTP根拠へ接続し、Host回収・実Provider・全体品質の未成立は維持する
- 追加結果参照: [品質176項目の固定候補照合](./Evidence/261002_quality-item-reconciliation.md)。全項目の候補集合と旧版の観測主張108件の現行適用未照合を追跡する。Profile搬送の局所36試験とWorkbench HTTP一試験を入口別に照合し、公開CLI／MCP Transportから現行Catalog・Task選定への結合不足を分けた。旧二JSONの廃止条件と四経路の画面なし実行の公開入口未対応も現行実体から確認した。現在の品質件数と停止Gateは変更しない。
- 追加結果参照: [Profile選択の現行UTとRole反例の補強](./Evidence/261002_profile-selection-current-ut.md)。局所60件の根拠を記録し、Transport同等性、PRL-UT-014全体、全体品質と実回復の未成立は維持する
- 追加是正参照: [公開ObjectiveのProfile搬送と試験登録](./Evidence/261002_objective-profile-transport.md)。任意Profile入力、MCP SchemaとTask搬送の実装接続漏れ、先行Host候補UTの登録漏れを是正した。局所117件の結果を全入口・実回復・全体品質へ拡張しない
- Quality Center: `RFD-IT-014`と`RFD-ST-015`を、Workbench→Version Control→実Git／bare Remote、実Browser確認、故障分類および再観測のEvidenceとして観測済みにした。`ERB-ST-022`も15画面、Desktop／Tablet／Mobile、100%／200%／400%の27条件、React commit後の画像確定待ち、終了所要時間および終了後不存在Evidenceへ接続した。`ERB-IT-020`は残存子Processへの世代Identity限定Fallback実発行とIdentity不一致時のEffect 0へ接続した

## 実際の影響 / 逸脱

- 実際に通った工程 / 共通責務: Discovery、UX、IA、UI／SPEC、UI／SPEC Detail、Architectureへの伝播
- 計画との差: Desktop包装を追加せず、計画どおりlocalhost ServerとBrowser Shellだけを実装した
- 追加 / 削除した工程・検証と理由: Visual Previewの成立を流用せず、Workbench固有の`ERB-IT-021`と`ERB-ST-022`へ分離した
- 経路不足から生じた指摘事項: 初回Mobile smokeでNavigationが一行横Scrollになったため、320px相当では3列折返しへ是正した
- 最終的に有効だった検証: 固定Route IT、15画面×3表示Profile×3 Zoomの実Browser Visual Gate、Repository Checker
- Production Closureで追加した検証: 署名Runtime配布観測がVersion Controlの5つのGit子Process呼出しを未登録として拒否することを確認し、閉集合登録後にPlatform Provisioner／署名Manifestの局所契約試験143件をPassした
- 署名済みDocker障害修復で、Repair Protocolが公式停止`S`を意図的に発行せず`false / not_issued`を返す一方、上位Runtimeが`true / confirmed`だけを正常としていた実境界不一致を検出した。Repairは`K`、Docker WSL停止およびrun世代退避を所有する既存境界を維持し、上位Runtimeは意図的な未発行だけを受理する。`true / unknown`は引き続き停止し、署名済み再実行、Host Windows回帰および実Provider E2Eが完了するまでPhase 5は閉じない

## 正本コンテキストの更新

- Workbench実装構造: `06_Architecture/Details/workbench/01_Architecture.md`
- UI／Visual: `04_UI/Details/**`
- System Behavior: `05_SPEC/Details/**`
- 実装・試験: `40_Develop/workbench/**`（Phase 1以降）

## リリース

- 対象リリース: `v0.22.0`
- 収録リリース: 未収録
- 処置: 実装・検証・独立レビュー後に人間が判断する

## 既知の制限 / 残るリスク

- localhost Web SurfaceがDesktop固有操作なしで必要な利用体験を満たすかはProduction Dogfoodで確認する。
- 公式ロゴはRepository内の承認済みAssetを使用するが、配布Packageでの単一Ownerと収載方法はPhase 1で固定する。
- WorkbenchのAI依頼Surfaceは選択Profile ID、読取り助言／変更候補、一依頼だけの外部送信確認を明示するApplication Portまで成立した。読取り助言は一般TaskのExecutor／Reviewerへ流用せず、Task Hash、Catalog Revision、exact Profile ID、Providerへ確認を結合して一回だけ消費する専用DispatchをProduction Compositionへ接続した。Effect前取消、Effect後取消競合、Provider例外、cleanup不明および不正結果は自動再送または成功へ畳まない。Provider Adapterはexact ProfileをCodex／Claudeの一方へだけ渡し、専用Execution PlanとProvider Command Planでstdin搬送、Repository／Workspace mountなし、Tool／Sessionなし、API Key／有料fallbackなしを固定する。Executor CoreはCodex JSONLのTool Eventを拒否し、Claude Envelopeから助言JSONだけを抽出して生metadataを公開しない。Executor Coreから署名Runtimeへ渡すOperation、Profile、Task／Projection Hash、PromptおよびCommand Hashは`ADVICEPKT-*`の一回消費Packetへ固定し、別Owner消費、再利用、取消後利用および共有境界拡張を拒否する。Production Runtimeは署名配布物Capability、Operation世代、Provider Home、Selection、Docker回復、Host cleanupおよび最終Recovery確定を所有し、両cleanup完了後だけ助言JSONを返す。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- Coordinatorに現在Process限定Mode Routerを追加し、読取り助言／変更候補を別Executorへ一回だけ配送する契約、取消後の遅延完了保護および未知Identityの非推測を`ERB-UT-023`で確認した。Workbench Production Compositionは読取り助言の専用Dispatch、Provider別固定Adapter、署名済みProduction Runtimeに加え、変更候補の明示許可Path、exact Executor Profileおよび署名済みProject Runtime Single Taskを接続した。候補は未信頼・未採用Identityとして公開し、候補生成とは別の確認・採用・破棄操作を接続した。採用は現在候補との一致、明示確認、Project Runtime Lease、Revision・dirty・Scope再観測、Receiptと耐久記録を必須にし、Commit／Pushへ拡張しない。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- AI結果は四区分の各項目を本文と一件以上の正本参照の組へ変更した。Coordinator Mode RouterはExecutor結果を閉じたSchemaで実行時検証し、専用Advice Result Parserは単一JSONを許可済み読取り投影のexact参照集合へ拘束する。根拠参照なし、投影外参照、重複Key、複数JSON、余分なKeyまたは過大値を部分公開せずblockedへ閉じる。Workbenchは参照を表示するが、参照から任意Path読取りAuthorityを生成しない。固定Provider Executorへの同契約接続は成立済みであり、今回是正後の署名候補再固定・直接起動と実Provider E2Eは未確認である。

## Nativeビルド出力の運用規則 — 2026-10-07

人間は無印`debug/release`をCargo標準の自動生成として許容しつつ、CRDDの正式入口では対象環境を明示し、無印成果物を利用しない方針を採用した。[コーディング規約](../../../06_Architecture/99_Coding_Standards.md#native-build-output)を正本とし、Architecture詳細とWorkflowから接続する。対象環境の指定なし、対象成果物欠落、複数候補ではfallbackせず停止する。Cargo補助出力の存在だけを違反・削除許可へ変換しない。

今回の経路はNative運用規則の文書変更であり、対象・出力・補助生成の区別を着手前に照合した。文書と利用側の独立整合確認を行い、署名・E2E・準拠監査は実装や準拠基準を変更しない今回の範囲では実行しない。ビルド入口の実適合、Coverage cache共有への変更、Native残存回収は後続の配置整理で処置する。今回の記載を実装移行完了へ読み替えない。新たな人間判断、削除、署名、Docker操作、コミット・プッシュは行わない。

追加した規約節、Workflow、Architecture参照および本記録を固定範囲として独立確認し、修正が必要な指摘0件だった。直接リンク・アンカーと差分の空白検査も成功した。確認は文書整合に限定し、実装適合・実ビルド・cache清掃の成立を含まない。

### 共有キャッシュへの実装移行と清掃

CoverageとNative保護試験のビルド先を`40_Develop/platform-access/target`へ統一した。実行物は今回のCargo JSON出力から取得し、対象環境、入力・実行物Hash、保存先とcache祖先のIdentityを照合する。試験ごとにビルド一式を複製せず、短命の計測値・結果だけを`.crdd/tests`へ置く。Coverage成功時はその領域を回収し、失敗時は小さな結果を保持する。共有cacheは実行単位の清掃対象にしない。

Formatter、Lint（警告0）、型検査、局所契約試験9件、実Coverage計測、実Native保護試験が成功した。Native試験は4拒否例、別Processの保護確認、入力と境界の不変、exit/closeおよびfixture2件の不存在を観測した（86ms）。Coverageの対象5ファイルは行51.06%、関数54.29%、領域53.45%であり、固定toolchainではbranch計測不可のままである。これらを全体品質合格や本番Recovery成立へ読み替えない。

独立レビューの祖先確認に関する2指摘を是正し、再レビューで解消・追加重大指摘なしを確認した。参照、使用中Process、Root、aliasを確認して旧`coverage-*`／`closure-*`81領域（45,767ファイル、11,132,015,618bytes）を削除し、残存0を再観測した。通常のCargo cacheと他の未処置領域は維持する。生の実行結果をEvidence書庫として追加しない。署名、E2E、Docker操作、コミット・プッシュは今回実行していない。

### 旧verificationのNative試験入口整理

旧7領域の利用側を調べ、自己生成namespace試験を正式TS入口へ移した。今回Cargoが返す共有cache内の実行物とfreshなtests領域で再実行し、元19拒否例、全close、入力不変、exit/closeとfixture不存在を確認した（是正後60ms、終了値0）。成功後の一時領域は不存在である。型・Formatter・Lint、Rustfmt・Clippy、局所契約試験4件が成功した。独立レビューの失敗時保存境界の指摘を是正し、再レビューで解消・追加必須指摘なしを確認した。祖先置換と失敗条件の試験は局所反証であり、実timeout全体の実測とは区別する。

旧capacity領域の`capacity-r1`、publication領域の`fixture`と`fixture-r2`は読取り拒否のままであり、不存在や不要とは判定していない。残る固定試験と歴史診断も未移行である。旧7領域全体の回収、④全体、署名・E2EまたはRelease可能の完成主張は行わない。生結果の書庫や試験ごとのBuild複製は追加しない。

旧Native保護領域だけは正式入口への能力移行を独立確認し、物理回収対象とした。旧`cargo-home/config.toml`はoffline、固定Windows target、領域内のtarget-dir、固定Rust compiler、cache自動清掃なしを指定していた（SHA-256 `ed76cb2c73394af49f6eecd116495e5a3af4d7dee3c08ff19f01d61e37845878`）。他の過去実行JSONがこの旧設定を使用した事実は履歴として保持し、現在の再実行能力へ読み替えない。歴史入力の物理回収であり、過去記録の書換えや他6領域の処置は行わない。新入口の再実測は72ms、4拒否例・両Worker・handle終了・入力と境界不変・exit/close・fixture2件不存在が成立した。本番接続、厳密期限、親喪失は未検証のままである。

回収前に旧保護領域1,292ファイルの非reparse、領域内で閉じるhardlink12組、排他open、削除直前Hashを確認し、leaf Fileと空Directoryを回収した。82,026,252bytes分の生成物と領域Rootの不存在を確認した。この時点の旧verification残り6領域・読取り拒否3箇所は、次の追加処置で確認する。namespaceのpackage入口も再実行で成功した（85ms）。

### 残るNative試験の移行と旧実物の終了処置 — 2026-10-07

正式入口`platform-access:verify-terminal-fixtures`へ、対象・保存・容量（前後）・現在候補・cold・rename・公開・disposition・既知fileの九能力十実行とNode／Native排他互換一件を移行した。今回Cargoの共有cache実行物、固定Node、入力と直接helperのHash、祖先Identityを前後照合する。修正後十一実行は全件成功、各自己生成対象は不存在、known-fileのreparseは拒否を実観測した。namespaceも再実行成功。Native通常44件成功・23件ignored、入口／Oracle契約7件成功、型・整形・Lint成功。全E2E・署名・公開Recoveryは検証範囲に含めない。

旧Root読戻し・mutationの歴史診断二入口は廃止した。全bytes・ACL・Identity・closeは現在候補／cold／rename、四変更操作の拒否と公開後stage不存在は現在候補／cold／rename／公開へ継承した。旧二名同Identityの失敗診断は成功能力に読み替えない。元の診断追加Git版は`f61706558ea3a7fc0cd54cde85dce029461aeca2`である。初回の一時所在指定不一致と編集中入力変化は成功にせず保持・終了確認後に回収し、固定候補で再実測した。

独立レビューの必須指摘一件（直接helper二ファイルの入力Hash不足）は是正し、再レビューで必須指摘0。実測成功とは別に、試験判定・保存／清掃境界・歴史能力の対応を確認した。実行Owner Hashは`e54b459791795a9200e900d16e3b6426992df09ce86296dbccff6459a9bd03e2`、Native入力Hashは`59eb329855a39acf8133dfbbb7eae37f94cc98c25bc5c50312dde023ec45e00d`、Oracle Hashは`1f0fe1be61ceec5b63803af6f83c72f20aa9c836f83544aea45de5bd16608040`。

人間が承認した三Directoryと内側六Fileだけ権限を修復した。capacity-r1は空、publicationのfixture／fixture-r2は各8192byteの人工値`x`を持つstage／publicと5byteの人工旧値`prior`であり、実候補・認証情報ではない。旧六領域は2,041File・266,834,866bytes、hardlink54組は領域内で閉じ、alias0。相対Pathと各内容Hashを昇順連結した台帳Hashは`c67462411fe84c3703c1a877fc067af3f3072317ffcaf2302ce66e28c4d7abdb`。現在参照と実行Processは0。削除直前の排他open・Identity／Hash再照合後にleaf Fileと空Directoryを回収し、六領域と`.crdd/verification`の不存在を確認した。排他openは同一hardlink実体を一度だけ取得し、閉じた集合を別の使用中Processと誤認しない。権限修復用三ファイルも回収済みで`.crdd/tests`は空。生結果の書庫はCHGへ追加しない。実測後の入口コメント移動は関数の直前へ説明を戻す編集だけで、実行処理を変更していない。コミット・プッシュは人間の停止指定を維持する。

### tmpの有限清掃と残る根拠の分類 — 2026-10-07

今回の処置は保存物の清掃であり、Runtime・署名・回復契約を変更しない。現在のProject Runtime v2状態は受付・Queue・Lease・結果・判断回復の各集合が空で、tmpへの参照はない。tmpを参照する実行Processは観測されなかった。Docker APIはEngine pipe不存在で観測不能のため、Dockerへ渡したビルド・試験領域は今回回収しない。

| 分類 | 処置と理由 |
|---|---|
| 旧端末ラッパー22件 | 既に回収した旧release配置を参照する、実行単位に固定した復旧・再起動・観測用の控え。現在参照と排他読取りを再確認して回収する。実操作は再実行しない |
| 旧署名コピー`sign-v022-csr-5a2d6b02` | 2,023File・35,629,103bytes、aliasと複数hardlinkは0。現行Source・設定・状態から参照されない旧全Repositoryコピー。排他読取り・内容再確認後に回収する |
| 現行builder入力 | `codex-01592-migration/official-source.tar.gz`と`codex-01592-attestation/codex-code-mode-host-x86_64-unknown-linux-musl`を保持。前者SHA-256は`b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`、後者は`5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03`で74,068,880bytes。取得・照合根拠も後続整理の対象とする |
| 局所診断と専用試験Source | `auth-create-plan-preflight-261004.mjs`、認証互換／更新、CLI取消、正式21試験の識別根拠は保持。再実行能力・未成立条件を失わないようEvidence処置と合わせて分類する |
| 終了結果・署名ログ・archive等 | 名前や日付だけで不要判定せず、後続のEvidence整理で正式記録との対応と固有情報を確認する。生結果の書庫をCHGへ追加しない |

読取り専用の独立着手前確認では、必須入力と固有試験根拠の保持、Docker使用状態未確認の領域の据置き、現在状態とのexact参照照合を確認した。これは清掃結果の独立レビューではない。tmp全体の不存在は完成条件にせず、現行ビルドの能力を保持する。コミット・プッシュ、署名、Provider依頼、Docker再起動、権限修復は行わない。

第一回収として旧ラッパー22件と署名コピー2,023Fileを処置した。削除前に検証済みRepository Root、現在集合の空、tmp参照Processの不存在、alias拒否、各FileのHash／サイズと排他openを再確認した。署名コピーの事前台帳Hashは`261639d5ff4abbc632be96fc4b3cee987a18c617f529b26e6ecf887dc02a6b77`。処置後に対象22Fileと署名コピーRootの不存在を確認した。残る107直下Fileと8子Directoryは、現在入力・固有試験根拠・終了控えが混在するため、Evidenceの意味処置と使用確認に接続して継続分類する。

人間の追加指定により、不要な試験根拠・終了控え・ビルド物の回収を先行する。正式二十一試験は既存[終端記録](Evidence/260930-1853_codex-model-host-migration-preflight.md#統合後候補の正式二十一試験の終端結果2026-10-01)へ判定・対象版・限界・成果物Hash・独立確認を記録済みで、残存21ログの各一件成功も再読取りで一致した。試験本体のtracked Patchと公式Sourceは保持し、過去実測を再実行や全体Passへ変更しない。`formal-verification`の61File・1,035,492,801bytes、未採用`provider-image`の7File・361,211,591bytes、公式Source展開控え`patch-baseline`の8,704File・86,369,194bytesを有限回収対象とする。Source展開控えの相対symlink `vendor/bubblewrap/LICENSE → COPYING`一件は辿らずlink自身だけ処置する。

Docker APIのコンテナ一覧は未確認のまま保持する。一方、WSL実行中一覧は終了code0で空、Docker Desktop／backend／daemon／WSL VMのHost Processは0、tmp参照Processと現在処理は0と再観測した。今回は人間指定に基づくHost側の非使用・排他確認済み物理控えの回収に限定し、旧retentionのDocker内部一覧の確認完了、Docker資源不存在、実Provider試験や回復の成功とは表示しない。

現行builderがtmpの固定二入力を読むのは過去の取得配置を直接参照する実装であり、通常Runtime／署名の依存ではない。tmpの恒久保持を正当化する契約ではなく、再ビルドの取得・配置整理が残る。tmpだけに存在する取消・認証試験のコードは、単なるlogと区別し、正規試験への移管要否を確認するまで保持する。

### 公式Codexへの復帰と助言境界の縮小 — 2026-10-07

人間は、Codex内部まで改造する品質要求は依頼しておらず、公式Codexを既存Dockerで隔離する役割分担へ戻すことを指定した。以前の最小起動Adapter承認は過去の判断として保持するが、専用Buildの継続根拠にしない。変更意図は同じWorkbench助言の完結であり、新しいCHG・Recovery Framework・追加防御を作らない。

| 対象 | 予定処置と完了確認 |
|---|---|
| 専用CLI | 助言だけ公式未改造0.159.2へ置換。CLI・Hostの公式配布Hashと新Image実Digestを確認する。通常Task公式0.149.1は変更しない |
| 既存防御 | Repository／Workspace非共有、Docker非root／root filesystem読取り専用、既存mount・権限・通信制限、認証、外部送信確認、API-key fallback禁止を維持 |
| 結果 | 内部計算の既知通知と最終本文を分離。独自PolicyのTool集合制限を保証しない。Error・不正形式・最終結果不正とcleanup未確定は拒否 |
| Lifecycle | init・取消・終了後回収と旧exact Recovery Identityを保全。新Imageとの照合を計画・Effect直前・清掃・再入場へ伝播する |
| 廃止 | 独自Source Build／Patch／試験Patch／linker／配布Identityと関連試験を全数棚卸しし、旧根拠を新方式へ流用しない。公式配布へ切替後、不要tmp材料を回収 |
| 検証 | コマンド計画・出力抽出・配布・Docker構成・取消／Recovery・署名閉包への局所回帰と独立レビュー。実署名・外部Provider E2E・Release判断は別途扱う |

読取り専用の着手前確認で、通常Taskと助言の配布責務分離、公式CLI実体Hash一致、採用済みモデルの最低Client版と0.159.2の整合を確認した。人間承認したDocker通常起動後、公式実行物を配置するImageを作成し、実Digest `sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e`、CLI版およびCLI・Host・bwrapのHashを確認した。初回のImage参照表記誤りは包装定義で是正した。CLI起動時の読取り専用filesystemによるPATH alias作成Warningは保持し、実助言の失敗不存在へ読み替えない。

局所29試験とDocker Effect／Recoveryの129試験は失敗・skip 0で成功し、ProductionとTestの型検査も成功した。旧Source Build入口とPatch／linkerを撤去し、旧exact Recoveryのinit構成は保持した。過去の改造CLIは基準Commit `823cb32deaa0e21a28aad73942ab5a05a9aa0950`から追跡できる。独立レビュー、署名と実Provider E2Eは未完了であり、新方式全体の完成を表示しない。Docker再起動／修復／永続データ削除／外部AI依頼は発行していない。

公式CLI移行の独立レビューは対象限定Pass。旧Tool禁止説明の直接伝播漏れを是正し再確認した。旧改造Buildの3領域（formal-verification、provider-image、patch-baseline）を参照・非使用・実体・Hash・排他読取り確認後に回収し、不存在を確認した。今回作成した配置Context2領域もImage確定後に回収した。計5領域・約2.2GBを削除し、新公式Imageと取得元公式配布物は保持した。tmp全体の清掃完了とはしない。

横断確認ではConsumer閉包14試験中13成功、命名契約19試験中18成功。失敗は先行Native整理のcoverage scriptによる直接.crdd Root構築と、fixed-runtime-signing.fixture.tsの命名規則不一致であり、本公式CLI移行のSource変更とは分離して未解消を保持する。規則を弱めず、次の整理でOwner実装を修正する。署名・外部AI依頼・コミット・プッシュは今回実行していない。

### tmpの追加回収と横断確認二件の是正 — 2026-10-07

終了済みの署名・復旧・Workbench診断のトップレベル104ファイル（78,581bytes）を、現在参照・非使用・実体と排他読取り確認後に回収した。さらに人間のexact対象承認に従い、公開配布アーカイブ、取得検証Tool、旧取消試験の複製実行物とstdout／stderrの11ファイル（710,575,169bytes）を回収し、全対象の不存在を確認した。公開取得元・版・Hash・署名照合結果は既存のモデル・Host移行根拠に保持する。現行公式CLIとHost本体のHashは不変であり、配布物の複製を根拠の正本として永久保持しない。

Coverage入口はRepository Root検証と既存Runtime Dataのtests領域取得へ接続し、Runtime Data／Version ControlのConsumer閉集合にも追加した。固定署名Fixtureはfixed-runtime-signing-fixture.tsへ改名し、二つの直接importを更新した。追加Native終端試験入口のstrict検査一覧漏れも是正した。処理意味、署名、Docker実行、祖先Identity、共有targetと終了清掃は変更していない。独立Sourceレビューは対象限定Pass、必須指摘0である。

関連六試験ファイルは62件中61件成功した。唯一の命名横断失敗は、初回の検査対象漏れを是正した再実行で、既存Sourceの258件のHeader／Trace／識別子指摘へ具体化した。元の二件の違反を解消したことを横断検査全体Passと同一視しない。ProductionとTestの型検査、変更箇所の整形・Lintは成功した。未処置指摘を弱い規則へ変更せず、次のSource整理対象として保持する。

tmpには現行公式Imageの明示入力、旧認証互換／更新・取消の固有試験Sourceとその対応資料、および未処置の旧取得物が残る。これらを別の一時フォルダへ移して清掃済みとはしない。固有試験の正式Ownerへの移行または能力の廃止判断が必要であり、tmp全体の清掃完了を主張しない。実署名・実Provider E2E・Docker再起動・コミット・プッシュは行っていない。

### 旧改造CLI診断の廃止と空領域の清掃 — 2026-10-07

命名試験は不要なchecker-naming親を作らず、tests直下の一意なnaming-fixtureだけをfinallyで回収する構成へ変更した。対象試験1件と整形・Lintは成功し、既存の空checker-namingは削除・不存在確認済みである。共有tests親は削除しない。

codex-advice-auth-compat、auth-refresh、cli-cancellationの旧三診断領域は、廃止した改造CLI専用の試験候補として撤去対象とする。独自Rust補助を新方式へ昇格せず、旧診断Sourceの再実行能力は廃止する。過去の限定結果・失敗・未成立条件は既存モデル・Host移行根拠で保持する。新公式CLIの認証・取消・親Process喪失と実Provider E2Eの義務は維持し、旧診断撤去を能力移管済みまたは新方式Passとは表示しない。旧認証Source Archiveとstatic Image exportはこの診断の終了に合わせて撤去対象とする。

auth-create-plan-preflight-261004.mjsの実FilesystemによるClaude→Codex連続処置は、現行の差替え契約試験へ完全には移管されていない。これだけは今回の撤去から除外し、正式試験への最小移行後に回収する。tmpに必須の本番Sourceがあるとは説明しない。

operations管理領域の先頭ドットは安全保証ではなく内部管理面の識別である。現行temporary-operation-storeが開始時に.operationsを作り、記録とLockの確定時に.stagingを作る。名前を通常のoperations/stagingへ変えることは可能だが、exact再入場参照・試験・Architectureの同時変更を要するため、今回の物理清掃と分離する。


独立確認で単発診断の実Filesystem境界が既存の差替え試験だけでは代替できないと分かったため、docker-effect-runtime.contract.test.tsへ『実config清掃後はClaudeからCodexへ同じ管理領域を再利用できる』を追加した。固定Sourceのprivate config三関数を試験内だけで使用し、Productionへ試験Exportを追加していない。旧診断の互換Task条件は既定falseの試験引数へ限定し、現行の実モデル選定や設定は変更しない。計画検証は物理領域作成前に行う。実config作成・Identity確認・削除二回、清掃前の計画差替え拒否、清掃後のCodex開始と終了後の空を確認した。CLI信頼とProcessは差替えであり、Docker実行・Provider成立は主張しない。

型・整形・LintとEffect全17試験が成功し、移行の限定独立レビューはPass、必須指摘0である。初回の試験前提誤りは本体欠陥とせず、準備前の検証へ移して是正し、残った自己生成空領域も回収した。その後、旧三診断領域・旧二Archive・単発mJSの70ファイル（157,683,575bytes）を現在状態空・操作記録空・稼働Container 0・実体と排他読取り確認後に削除し、全六対象の不存在を確認した。旧診断Sourceの再実行能力は廃止し、過去のMD根拠は保持した。

公開取得元の複製も永続Cacheにしない。公式Imageのexact Digestを再確認し、公式CLI／Hostの固定Hashを再照合後、取得二領域の5ファイル（360,844,108bytes）を回収した。Imageは保持し、Image再作成時は公式Release rust-v0.159.2からCLI／Hostを再取得・検証してprepare-codex-advice-image.tsへ明示入力する必要がある。CLI本体のSource Buildは不要である。tmpの残存は空の.operations/.stagingだけ、testsは空である。今回の75ファイル回収を新公式CLIの認証・取消E2E完了へ読み替えない。

## 後続対応 / ロードマップ

固定CLI本体のモデル情報で、助言用`gpt-5.6-sol`は`code_mode_only`だが現行助言実行ではHostを無効化する不整合を確認した。実測errorもCode Mode利用不能の固定文言へ一致した。設定関連のもう一件は未特定である。人間は後続判断として6.1 Solを標準、6 Lunaを軽量用途とするProfileと対応固定CLIへの移行を承認した。旧5.5互換Profile／5.6 Host案は判断前の候補履歴として保持し、現在の採用方針にはしない。

公式CLI `0.159.2`の固定配布物では両モデルがCode Mode専用だった。Hostを正式に含めるだけでなく、非表示Tool名の直接呼出しを実行前に拒否できる許可集合が必要である。公式Sourceの起動時`ToolPolicy`はこの制限を持つが、公開CLI設定からの注入入口は今回の確認で未発見だった。専用実行物の構築・配布・保守を伴う最小起動Adapterへの拡張は人間が承認した。助言用の権限は広げず、通常Executor／Reviewerと専用制限を分け、局所反証と独立レビュー後に再署名・実Provider E2Eへ進む。現在は新モデル実行、Host有効化、権限緩和またはerror無視を行っていない。初期ProfileのJSON外出しは型・Lint・契約試験13件と配布物観測を通過し、独立レビューPass・Finding 0である。根拠、未確認範囲および着手前確認は[モデル・Host移行の着手前確認](Evidence/260930-1853_codex-model-host-migration-preflight.md)を参照する。

署名Runtime `52249c52`の再診断では、拒否対象が完了error通知二件と判明した。固定文字列分類は設定関連一件、code mode関連一件に一致したが、原因の確定ではない。正常終了・資源回収後もWorkbench助言は拒否されており、受理条件を緩めず固定CLIの設定契約へ戻って確認する。診断Toolは独立レビューを通過し、本文や未知値は保存していない。通常E2E合格へは算入しない。根拠と限界は[Codexエラー通知分類](Evidence/260930-1801_workbench-advice-error-classification.md)を参照する。

先行する通知契約の是正は[通知契約照合](Evidence/260930-1643_workbench-advice-notification-contract.md)に記録した。署名Runtime `ecb7fb1d`のCodex単独実測は正常終了・資源回収後に`workbench_ai_codex_tool_event_forbidden`で停止した。正常な思考通知の誤拒否と不正・更新Itemの検査漏れを局所是正し、関連257件と独立レビューを通過した。その実測時点では具体的なItem種別を観測しておらず、原因を思考通知と断定していない。後続の署名Runtime `52249c52`でも拒否が続き、上記診断でerror通知を特定した。解消確認、Claude助言と変更候補およびWorkbench全体のE2Eは未完了である。

Phase 4までの接続とPhase 5の13画面を閉じ、15画面のProduction DOMを3表示Profile×3 Zoomの実Browserで観測した。読取り助言、変更候補の生成と別操作での採否、Shared Serverの公開入口はProduction Compositionまで接続済みである。署名Runtime `45254e2b`と是正済み検証Tool `1b756ac2`によるRun `2e55c8cd2897464b`は、Project Runtime公開MCPの通常二経路、取消、exact Recovery、最終回復在庫確認まで合格した。再入場後の人間の採用判断待ちは意図した停止であり、自動採用完了を主張しない。是正前の失敗結果は履歴Evidenceとして保持する。次はWorkbench実Provider E2Eと必要な四経路E2Eを実測し、残る品質項目を個別照合する。その後、最終回帰・独立レビュー、最終配布固定、再署名、署名拒否試験および直接起動確認を閉じて人間のRelease判断へ渡す。現在の限定合格を全体Quality ReadyまたはRelease可能へ読み替えない。


## 署名一時配置とCoordinator入口統合 — 2026-10-07

人間はbin/launch.tsをbin/coordinator.tsへ統合し、署名処理をtmp/signature/の準備→署名→正式Manifest適用→フォルダごとの清掃として整理する方針を採用した。operations/stagingへの単純改名は行わない。共有一時処理の現在の本番利用側はprepare-release-runtimeだけである。

通常処理の所有者はsrc/core/coordinator-command.tsへ移し、旧doctor／project／capabilities／candidate／task直接入力、同一PID、stdio・cwd、外部端末条件を維持する。署名閉包検査と直接利用側・試験は移動した所有者へ追従し、検査を弱めない。

署名一時配置はCoordinator詳細設計の整理方針に従う。異なる操作IDの同時署名拒否、保存途中の中断、正式適用前後の中断、適用済み再入場の署名0回、清掃失敗と終了後不存在を確認する。現在は新配置切替済みとはしない。実署名・Provider E2Eとコミット・プッシュは実行しない。


### 入口統合の限定確認結果

型検査・対象七ファイルの整形／Lint・diff確認は成功した。入口と取消の19件、移動後の署名閉包2件、Version Control利用側10件は成功した。引数なしhelpの互換指摘を是正し、独立再レビューは入口統合限定でPass、必須残件0となった。

入口・CLI・対話境界の収集は51件中50件成功、未変更verify-native-protection.tsの既存Shell搬送検査1件は失敗した。全回帰Passへ拡張しない。旧候補で開始した包括Package試験は長時間未完了のため、そのexact試験Processだけを終了した。最新候補の包括Package確認は残る。実署名、署名一時配置の実装切替、製品E2Eは未完了である。


### Native Root接続と空試験親フォルダの是正 — 2026-10-07

Nativeスクリプトの横断指摘は、三入口がGitを直接呼びRepository Rootを再解釈していたことが原因である。verify-native-protection／verify-native-terminal-namespace／verify-native-terminal-fixturesを既存Version ControlのverifyRepositoryRootとresolveVerifiedRepositoryRootへ接続した。Root一致とNative Oracleは維持し、既知Consumer集合へ接続先を追加した。型検査と該当横断試験1件は成功した。

空のtests/coordinator-launchは試験親Directoryの残存だった。試験はtests直下の一意な自作領域だけを作成・削除する方式へ変更し、整形確認後の再実行1件成功と終了後不存在を確認した。空の旧tmp/.operations/.stagingとその親もexact空・非aliasを確認して削除した。現在の空Directoryは想定トップ領域tests／tmpだけである。共有一時処理の旧既定配置は署名配置切替前にはまだ実装に存在し、この物理清掃だけで廃止済みとはしない。

### 署名一時配置の切替と移行責務の分離 — 2026-10-07

署名準備を`tmp/signature/work`へ切り替え、制御文書・Lock・保存確定前Fileを同じsignature Rootへ集約した。通常完了ではRootごと回収する。正式Manifest適用後の中断は、候補と正式Manifestの全File Hash一致を確認した場合だけ清掃へ進む。不一致・観測不能では候補とexact回復参照を保持し、新たな署名や強制削除を行わない。Signerと昇格入口も最新signature配置だけを受け付ける。

旧構成の移行は署名だけに限定しない。Coordinator、Project Runtime、Execution Intelligence、設定、ログ、候補、一時領域および試験結果の棚卸し・保全・移行・清掃をフロントAI手順へ明記した。実装は採用済み最新構成を扱い、移行専用の旧Reader／Writer・二重書込み・Fallbackを増やさない。現行Capabilityに必要な過去署名の真正性検証は移行互換と混同しない。

局所確認はRuntime Data全44件、Coordinator準備・中断12件、Signer Root／昇格配置2件が成功した。型検査、対象整形・Lint、diff確認も実施した。保存・公開・読取り・最終清掃の失敗7変種を含む限定独立再レビューはPass、必須追加指摘0である。実署名・対話端末・製品E2E・全体移行完了の主張には拡張しない。人間指定によりコミット・プッシュは行っていない。

### 移管Evidenceの正式要約化 — 2026-10-07

人間承認により、Recorder14実行42JSONとNative4JSONを既存の整理④Markdownへ集約し、Release案内を要約へのリンクへ変更した。過去の結果・時刻・対象版・固有署名Identity・未記録観測・失敗義務を維持し、重複本文と開始／完了管理Fileを恒久書庫にしない。限定独立再レビューPass後、範囲・非使用・記録相関・削除直前Hashを確認し、46File・157,884 bytesを回収、全件不存在を確認した。実署名・製品E2E・現在品質の全体合格は主張しない。コミット・プッシュは行っていない。

### Runtime Trust起動接続の採用範囲是正 — 2026-10-07

人間からの処遇再確認によりRoadmapの将来版と上流の独立読取り評価を照合した。Coordinatorが利用者Trust Policyを有効化してProvider起動Gateへ消費する義務は現行v0.22の採用範囲ではなく、ARCH-000014の読取り評価契約を過剰拡張したものだった。現行Semantic Required行とAIT-IT-014を除去し、IDは再利用しない。評価部品の既存二試験とOracleは保持し、AIT-IT-001の部分境界へ再接続した。署名・完全性・起動時Gate・既存Trust候補部品・将来Roadmap・上流Canonical IDは変更していない。

正本からSemantic Coverageを再生成し、17意味の実装Relation17、自動Test Relation16、手動確認待ち1となった。実装追加・過去Missingの実証解消・全体品質Passとは表示しない。過去CHGと監査の判定は履歴として維持する。

限定独立レビューは2026-10-07にPass。適用表に残った旧AIT-IT-014参照を是正し、現行の必須参照不存在を再確認した。Semantic Coverageの16試験、独立読取り評価Gateの2試験、変更対象の形式・LintおよびCoordinatorの型検査はPass。全体Checkerは16指摘を検出し、このうち旧ID残存1件を今回是正した。他の既存リンク・Quality対応表／適用判定の残件は全体Passとして扱わない。署名・実Provider E2E・将来Trust起動接続の成立は主張しない。

### Docker回復縮小の保存契約・反証具体化 — 2026-10-07

Coordinator詳細設計に、現在状態の閉集合、保存途中の再入場、結果受理後の回収、および認証Probeに限定したunknown終了条件を具体化した。基本情報のOwnerを`operations`へ一本化し、回復と未受理結果は参照で接続する。旧作成結果のunknownは保持し、現在の資源不存在だけから過去成功や旧OwnerのEffect不能を推定しない。Runtime Dataの署名一時配置参照を現行`tmp/signature`へ合わせた。

独立設計レビューの指摘に従い、保存途中のFileは正規Snapshotと同一形式・同一bytesとし、元revisionと元Fileのexact bytes Hashへ結合した。初回保存と既知元版喪失、保存済み更新と同版異内容を区別する。追加JournalやLock Frameworkは作らない。既存QA Local Itemへ中断・参照不整合・遅延Create・終了後不存在の反証を接続した。限定設計再レビューはPass、必須指摘0である。Source切替と実境界成立の判定ではない。

既存回復状態機械、Recovery Runtime、Process Controllerの局所基準試験は215件成功、失敗・取消・skipは0だった。新保存方式の実装試験ではない。Coordinatorの整形、Production／Test型検査、Lintは成功したが、後続の能力Graph検査は`platform_provisioner_runtime_dependency_child_process_unbound`で停止した。全体Checkerの既存15指摘も残るため、全回帰Passとは表示しない。

現在状態の本番保存接続、限定unknown終了の実装、通常履歴の保持設定、利用側の切替および実境界・署名E2Eは未完了である。今回、Docker再起動、実Provider依頼、実署名、旧回復記録の削除は行っていない。

### 保存再入場判定の第一実装 — 2026-10-07

既存の回復状態機械へCoordinator Snapshotの純粋な再入場判定を追加した。元版／次版のexact bytes Hash、Repository結合、初回Root条件、明示不存在／観測不能、previous改訂相関、非安全整数・overflowを照合する。返却は非Authorityの処置候補で、File・Lock・Docker操作を発行しない。新規三Caseを含む単体十一件と、既存Recovery Runtime／Process Controllerを含む局所回帰218件は全件成功し、失敗・取消・skipは0だった。型・対象整形・Lint・diff確認も成功した。固定Source二Fileの限定独立レビューはPass、必須指摘0である。全Snapshot検証、物理保存と清掃、本番Writer接続、限定unknown終了、全体Checkerの既存残件および実環境E2Eはこの判定へ含めない。旧記録の削除・実署名・Provider依頼・Docker再起動は行っていない。

### 現在状態の保存先・排他接続 — 2026-10-07

既存Repository Operation Ownerへ内部保存先借用を追加し、Root・論理／実体Identity・発行revisionとOwnerを再観測する。公開検証結果へPathを追加せず、借用をAuthorityとして扱わない。既存Windows排他primitiveのCoordinator専用namespaceを追加し、Host試験プロファイルへ接続した。保存先とOwner失効、同Root競合、別Root・Project Runtimeとの独立、解放後再取得の局所二件、および先の再入場三件を合わせた五件が成功した。型検査・対象Biome・diff確認も成功し、限定独立レビューPass、必須是正0である。保存Root Hashの導出、全Snapshot Schema、物理Writer、既存排他との取得順、doctorの再入場Root、本番切替は未完了である。実署名・Docker再起動・Provider依頼・旧記録削除は行っていない。

### 回復記録の内容検証と物理保存の分離 — 2026-10-07

着手前確認で、旧base／段階FileはNative Authorityそのものではないが、Coordinatorの資源選択・回復相関・Host清掃前提へ結合していると確認した。単純なWriter置換を避け、既存八宣言を`docker-recovery-record-model.ts`へ移し、Runtimeから共通の内容検証を利用する形へ分離した。宣言本文は空白正規化したGit基準版比較で全八件一致し、条件や既存受理範囲を変更していない。新しい互換Reader、保存方式の二重正本、Native操作やAuthorityは追加していない。

分離後の回復状態機械・Recovery Runtime・Process Controller局所回帰218件は全件成功、失敗・取消・skipは0だった。型検査、対象Biome、diff確認は成功し、Source二FileとArchitecture追加説明の限定独立レビューはPass、必須是正0である。能力Graph検査は既存の`platform_provisioner_runtime_dependency_child_process_unbound`で停止するため、全体検査Passとはしない。全Snapshot Schema、Writer、Host処置前提の最新状態接続、旧保存撤去、限定unknown終了および実署名E2Eは未完了である。

### 現在状態codecの構造相関 — 2026-10-07

`coordinator-state-model.ts`へ最新Snapshotの閉じた型と本文検査を追加した。固定操作情報とHost遷移の確定JSON本文を文字列として保持し、外側のkey整列によってNative証明の項目順・Hashを変更しない。五purposeの要求状態と現在観測、一次失敗と最終結果、操作と回復・搬送参照を分離した。別Repository、重複・孤立参照、不正改訂、未知field、非正規本文、不正UTF-8、BOM、getter／Proxyを拒否する。ID確定済みで観測unknownになっても資源IDを保持する。

独立レビューの二指摘（Host許可辺の未限定とBuffer accessor評価）を是正し、現行三辺への限定と組込みbyte取得・コピー、拒否反証を追加した。型検査・対象Biome・関連単体十四件が成功し、Source／Test／Architectureの限定再レビューはPass、必須残件0である。先の218件回帰を今回の新codecの回帰数へ合算しない。Snapshot間の遷移不変条件、実Writer・Host回収接続、旧保存撤去と署名E2Eは未完了である。今回もDocker操作、Provider依頼、署名と旧実物削除は行っていない。

### 現在状態の物理保存Port — 2026-10-07

通常操作Ownerへ結合した保存Portを追加した。既存排他、検証済みRepository結合、bounded読取りを用い、現在状態とpendingを固定配置へ保存する。Runtime Data Ownerの排他的領域作成と初回本文を結合し、空の既存領域や公開後の状態喪失を初回へ読み替えない。本文とFile Identity、再openしたdescriptorを照合し、同内容の別Fileを拒否する。保存確認と排他終了を別に返す。

改訂間では固定Identity、確認済み資源ID、一次失敗、結果と受理参照を保持する。回復と搬送の変更も操作Ownerへ結合し、unknownを未発行へ変更しない。終端証明が未接続の間は操作・回復・搬送の削除を拒否する。独立レビューの指摘を是正し、初回準備前のOwner照合と排他解放未確認時の初期化証拠失効も追加した。

型検査、対象Biome、単体三件と実Windows Filesystemの保存・再入場一件はPass、作業差分とstaged差分の形式検査もPass。公開後の状態消失、同内容の実体差し替え、hardlink、別pending、Owner失効、unknown負方向の反証を含む。実装・Architectureの限定再レビューはPass、必須実装指摘0である。ただし追加二指摘の専用反例試験（別Owner初回候補のEffect0と領域未作成、公開前保存失敗と排他解放失敗後の初回再試行拒否）は未完了であり、保存Slice全体の検証完了とは表示しない。本番Producer、doctor再入場、Host終端、旧保存撤去、履歴設定、署名E2Eは引き続き未完了。Docker操作、Provider依頼、署名と旧実物削除は行っていない。

### 責務再編・Architecture Closureの完了計画 — 2026-10-07

人間との確認に基づく親フォルダ統合・AI固有処理分離・CROS REST／Gateway廃止・Native内部整理を、同じCHGの責務再編として扱う。[対応案と完了計画](./Evidence/261007_develop-responsibility-mapping.md#23-責務再編を完了させる計画)に、全能力・File照合、ARCH基本設計、Details／Quality、設計独立確認、依存順の実装、全体回帰・Reality Audit、固定候補署名E2E、完了判定の順序とGateを記録した。計画はCommit `3389345e`と後続具体化案を基準とする。

計画作成時点ではArchitecture正本・Source移管は未着手だった。既存Snapshot／回復縮小等の未完了義務は対応付けて維持し、この計画だけで解消済み・全体Pass・Release可能とは表示しない。PR統合・Release判断は別に保持する。

### 責務再編の現在地 — 2026-10-08

段階1〜4、段階5AのDomain Model統合と5BのAI Adapter／Platform Access移管は局所検証まで完了した。最新5B Sourceの配布閉包全133契約、AI Adapter全13契約、Coordinatorの型・固定計画と両Provider準備42契約が成功した。Native通常50試験・全target Clippy、利用側八Package型接続は確認済みだが、実環境専用Native23件、全体回帰・固定Source独立レビュー・署名E2Eは別に残る。次は5CのCoordinator共通実行・Orchestrator移管・実行記録。残るProvider別組立てを最終配置として固定しない。[計画と検証範囲](Evidence/261007_develop-responsibility-mapping.md#段階5bの局所完了判定--2026-10-08)を正本とする。

段階5C〜F、全親フォルダのFile名・責務・配置精査、段階6〜8は未完了である。局所成功や設計独立確認を、全Sourceの独立レビュー・実E2E・Release準備完了へ拡張しない。
