# Platform Accessの構造・Native接続再編

## 現在の位置 — 2026-11-07

共通Lockはwx方式の3 Sourceとなり、CurrentState・共有Home・Runtime状態・Host操作に続いてEI／Topic／Meeting／一時Operationも同じ取得・所有確認・解放へ接続した。PAのPipe／Supervisor／Leaseは残さない。PAの未使用環境契約記述と2定数も撤去した。現在の接続、独立是正と検証限界は[Lock変更記録§15](lock-boundary-design.md#15-file-lock群の共通化とpa残存機能の再評価--2026-11-07)を参照する。

PA全廃は未完了である。残るNative保護・OS観測・Desktop技術処理の利用先と外した場合の影響は[PA設計](../../../06_Architecture/Details/platform-access/01_Architecture.md#現在の残存範囲--2026-11-07)を正本とする。以下は段階ごとの調査・判断履歴であり、候補を現行Sourceへ読み替えない。

## 共通Lockのwx化候補 — 2026-11-07

§13時点の記録: 信頼境界も人間が採用し、[変更記録§13](lock-boundary-design.md#13-wxの実装と汎用storeの限定切替--2026-11-07)で共通wx処理とDomain汎用Store／AMの切替を進めていた。旧PID不存在Proof・オンライン回復API・自動回復後再取得を撤去。不要になったendpoint取得APIとWorker 2 Sourceも撤去した。当時はCurrentState・共有Home・Host操作等の全Scope切替は未完了であり、当時の8 Sourceを最終構成とはしなかった。以下は判断・調査履歴として保持する。

更新: A案（wx統一・残存時Fail Closed・全利用Process停止下の明示Recovery）は人間が採用した。ただし通常解放の最終照合→unlink間に非協調の置換が入る反証を確認し、[変更記録§12](lock-boundary-design.md#12-wx方式の採用と通常解放の境界--2026-11-07)の信頼境界だけを判断待ちとしている。製品方式変更はまだ開始していない。以下は採用前の候補整理として保持する。

現行9 SourceはOS方式のOwner移管であり、wx統一は未実装。Caller・保持区間・回復条件・既存試験を再照合し、[変更記録§11](lock-boundary-design.md#11-wxへ寄せる範囲の再評価--2026-11-07)に候補を具体化した。短期保存が先行候補だが、Reader・回復・検証Scriptも同じScopeで切り替える必要がある。共有Homeの所在とHost世代の終了契約、Crash残存時に停止する運用は実装前の判断事項である。

wxだけへ移せればWorker／Supervisor／固定子起動・監視を消し、3 Source程度へ縮小できる可能性がある。既存の即再取得保証を守るためだけの新監視や自動Recoveryは作らない。今回は設計調査のみで、製品方式・実AI・Docker・過去保持物は変更・操作していない。

## 取得後ID生成例外の確認 — 2026-11-07

[限定故障注入の結果](lock-boundary-design.md#9-取得後id生成例外の限定確認--2026-11-07)では、Domain／EIともUUID生成例外でopen descriptorと空Lock Fileが残ることを再現した。Domainは同scopeの再取得も拒否。EI保存本文の有限接続ではblockedの一方で清掃済み・残存なしへ誤分類する経路があった。自然発生頻度や公開保存API全体のE2Eは未評価である。

上記は修正前の確認である。その後、ID生成を最初の資源Effect前へ移す最小是正を実施した。公開API・保存Schema・回復条件は変更していない。修正後の限定検証と、共通Lockがwx統一ではなく既存OS方式のOwner移管であることは[変更記録§10](lock-boundary-design.md#10-id生成の最小是正とlock構成の確認--2026-11-07)を現在値とする。実AI・Docker・過去保持物は操作していない。

## File Lock群の移管評価 — 2026-11-07

[利用側・回復・既存試験の対応](lock-boundary-design.md#file-lock-migration-assessment)を整理した。4系統はNode実装済みでPA廃止の直接障害ではなく、Domainの下位OS Guardも共通化済み。File型の公開APIを今すぐ増やす推奨は取り下げ、保存・回復プロトコルは各Ownerへ維持する。Topic／MeetingとEIの取得・終了処理は技術候補だが、現段階で単純移動の利点は小さい。

一時OperationのLifecycle Lockは現在の製品srcに外部利用を確認できず、公開APIと試験が中心。共通Capabilityへの拡張や削除は行わない。Domain／EIの取得後ID生成が清掃try外にある区間、一時OperationのPID不明分類、最終照合→削除の交差を局所確認候補として記録した。今回は文書の静的照合のみで、製品・試験・回復方式・保持物は変更・操作していない。

## Node OS排他の共通Lock移管 — 2026-11-07

PAのPipe・非同期Worker／Supervisor・固定子起動と、DomainのFilesystem endpoint取得を`40_Develop/lock`へ移管した。旧PA再export・互換Wrapperは撤去し、利用側・Source Hash／コピーfixture・台帳・QA・Architectureを追従した。公開4入口と必要な7型は[共通Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)、保持区間・移管外・検証経過は[変更記録§7](lock-boundary-design.md#7-node-os排他の実装移管--2026-11-07)に置く。

対象回帰はLock23・Coordinator198・Domain17・Checker11・PA75・Executor10件成功。独立レビュー後のコメント清掃も追加指摘なし。新品試験領域は回収・不存在確認済み。新Lockの標準npm testはオフラインの依存未取得で未実施だが、同じ静的3軸と試験本体は既存固定ツールで確認した。実AI・Docker・過去保持物は操作せず、File型・Domain回復・長期Lease・Native Mutexは残した。PA全廃・全OS・Repository全体E2Eの完成ではない。

## 共通LockのPhase 1・2 — 2026-11-06、設計候補

新規`lock`Packageと、異なる保護対象へ一貫した排他契約を提供する人間方針を受け、[全Consumer棚卸し・契約候補・回復案と移行Gate](lock-boundary-design.md)を整理した。PA共有PipeだけでなくDomain固有Worker／wx、Access Managementの回復利用、Coordinator長期Lease、ExecutorのRepository横断Home、EI履歴、Nativeのユーザー別修復Mutexを区別する。旧Owner再開時のLock削除・保存上書きを合成反例で確認し、製品Primitiveを取り去らずに比較区間から最終処置までの保証を検証する必要を記録した。

今回は設計調査と新品の限定モデル実測だけで、製品Source・保存形式・PA依存・配布Nativeを変更しない。試験物は回収済み。実AI・Docker・過去保持物は操作しない。Phase 2の収束・新Package実装・Cross-platform成立・PA廃止は未完了であり、Consumer移行Gateは閉じている。

続く[保持区間と既存試験の照合](lock-boundary-design.md#6-利用側の保持区間と移管範囲--2026-11-06追補)では、Topic／Meeting独自File Lockの棚卸し漏れと長期Leaseの排他Directoryの説明不足を是正した。第一候補は現行endpointを維持したNode OS排他の技術移管であり、Home用の新共有Directoryは不要。File型は次段階、業務回復・長期Lease・Native Mutexは現Ownerに残す。今回追補は静的照合だけで、製品試験の再実行や移管成立を主張しない。

## Namespace旧子の撤去・Node統合案 — 2026-11-06

承認範囲は旧`terminal-v1`の新規作成・実体／ACL検査の撤去と、通常回復Directory初期化のNode統合案の整理である。保護Policy、通常HostRecovery保存DTO、既存保持物は変更しない。旧子用の固定再観測・専用fixture／Toolも退役し、親＋Recoveryの二実体・一Receiptへ縮小した。要求はCRDDNC01／CRDDNI01のまま、短命応答だけCRDDNR02 revision 2へ切り替え、旧応答fallbackはない。

着手前の独立確認と実装照合では、親の独立Identity・selected SID、Recoveryの作成時protected DACL・fresh実体・処置後照合、祖先Handleの保持・全取得資源の初回close、部分Effect／元理由の保持を不変条件とした。変更分類は限定的な技術Refactorであり、利用側・台帳・Architecture・Workflowと対象回帰・独立レビューを実施する。標準規範・Release・保存Schemaを変更しないため全体準拠／Release監査は追加しない。

新品run `9bc133a8a493cc0918fcf915abd2bde7`の既存Creation fixtureで保護付き作成・無変更reuse・不適合ACL／同名File拒否・旧子File／Directoryの同一性／内容不変を確認し、自作物を非再帰回収して不存在を確認した。制限環境の先行runはSID判定でDirectory作成前に停止し、条件は緩めていない。既存旧子、実共有領域、外部AI、Dockerは操作しない。旧子linkの実作成は行わず、Native本体に旧子名・探索／観測経路が存在しないことを静的反証で確認する。

PA通常96・Coordinator8・Checker35・VC13件成功、Namespace純粋／Protocol4件成功（3既存ignored）、Catalog439件valid、対象の型・書式・Rust全target確認成功。固定targetのrelease buildから配布Nativeを更新し、261,120 bytes・SHA-256 `6df45144263f041c2adf98279ae28440a7b4c0b5861560100c5e33d10736ffb6`をbootstrapと合成fixtureへ反映した。配布物自身の二mode不正要求も取得前拒否・revision 2・実体なし／未試行Receiptとして確認した。正式QA全体・実AI／Docker E2Eの成立ではない。独立レビューの旧Protocol説明指摘は親＋Recovery／revision 2へ是正し、再レビューに未解消の確定指摘はない。コミット・プッシュは未実施。

Node統合案と、SID／DACL・祖先Handle保護を外した場合の影響は[PA詳細設計](../../../06_Architecture/Details/platform-access/01_Architecture.md#namespaceの旧子撤去とnodejs統合の検討--2026-11-06)に置く。Policy維持ならNodeの既存初期化OwnerからWindowsの保護付き作成を先に完了し、Nodeによる通常mkdir先行は行わない。Policy撤廃ならNode標準へ一本化できるが、Windowsのmode 0700は厳密DACLの代替ではない。現在の許可はこのPolicy変更を含まない。

## 本番未使用の端末・旧Root観測の撤去 — 2026-11-06

人間承認により6 Sourceと部分削除候補を撤去した。確認コード・端末の5 File、旧Rust Root観測、Reader起動登録、旧Root Request／構成検査・AppContainer Pipe受付、未使用公式停止Wrapperが対象。代替・互換Reader・新Packageを作らない。現存37 Sourceは、本番利用中の共有Pipe、Home／Namespace、Native実体、環境差分、Docker補助Process等に限定する。PA全廃は未完了。

着手前の独立確認により、旧Root内のHome Hash・SID反例2件を存続Ownerへ移した。専用端末の試験・支援と旧Root専用Caseは退役し、共通入力上限・拒否書込み失敗と旧Root／AppContainer拒否を確認する。Provider Homeの要求・応答、共有Directory保護、Pipeの同期／非同期とHome Lease、DI内部の実停止処理は変更しない。型・試験・Symbol／Catalog・Architectureの直接伝播を確認する技術責務Refactorで、規範・Release監査は対象外とする。

限定回帰はPA96、Coordinator24（制限下23成功・リンク作成EPERM 1件を通常権限で再確認）、Executor7、Checker35、VC13件が成功した。PA／Coordinator／Executor／Checkerの型検査、PAの書式・LintとRust全targetコンパイルも成功。Rust通常試験は28成功・12既存ignored、退役CLI拒否は2成功。Catalog439件validは静的整合であり、正式QA全体や実AI／Docker E2Eの成功ではない。外部AI・Dockerコマンド・過去保持物は操作しない。独立レビューで見つかったDI設計の旧Wrapper説明とWorkflowの旧起動手順を是正し、再レビューの未解消指摘は0件。コミット・プッシュは未実施。

通常Runtimeに旧受付を残さないため、固定toolchain 1.94.1・固定依存・`--target x86_64-pc-windows-msvc --release --frozen --offline`の今回Cargo出力一件を取得し、既存固定配布Pathとbootstrap期待値へ反映した。実配布物は265,216 bytes、SHA-256 `5ef70c6702203df63c6d9c68c3c38cac855e9da79fee331848e5de1619b9cdea`。配布物自身のbootstrap照合、旧七mode拒否、旧Root／一般不正／入力上限の三拒否を実Processで確認した。Provider Home／Namespace初期化・Docker操作へ接続しない負例であり、バージョン／Release確定ではない。対象環境明示のRust通常試験28成功・12ignoredとCLI拒否2成功も再確認した。以前の無印cacheによる確認だけを配布物の根拠にしない。

配布更新後にもPA通常96件を再実行して全成功。固定配布物・bootstrap・合成fixtureのHash一致と現行接続の最終独立確認に追加指摘はなかった。DIは説明文だけの追従で、本番Source・公開API・停止条件は変更しない。新しい認可や回復管理、代替端末、旧入口の別名受付は追加していない。

## 未接続Host終端記録・専用Leaseの退役 — 2026-11-06

本番Consumerと削除履歴を照合し、旧Host終端記録の公開12操作、専用caller Lease、対応するRust受付・保存処理・専用検証Toolを代替なしで撤去した。通常のCoordinator回復記録はNode.jsの既存実装に残し、保存形式の移行や過去保持物の操作は行わない。Namespaceが共有していた保護・handle処理と診断fixtureは保持し、Namespace所有へ接続し直した。

技術責務のRefactorとして利用側、台帳、Architecture、試験を追従した。NamespaceのSID／DACL・祖先handle保護、共有PipeのWorker／同期・非同期契約は変更しない。実AI・Docker・保持物は対象外。規範・Releaseを変更しないため全体準拠・Release監査は追加しない。

限定回帰はPA 108、Coordinator 25、VC 13、Checker 35件成功。Rustは全targetコンパイル成功、Namespace関連4件成功・実環境診断4件ignored、旧六mode拒否1件成功。Checkerのリンク試験は制限環境でEPERMとなり、通常権限で35件全成功を確認した。Catalogは444件validであり、正式QA全体のPassや実Windows保護・実Docker成立を示さない。

固定差分の独立レビューで試験代役二箇所の旧Native mode許可と説明二箇所の追従漏れを検出し、旧六modeだけを除去した。存続四modeと旧mode不存在を既存Caseへ接続し、Coordinatorの追加有限4件と型検査は成功。再レビューの未解消確定指摘は0件。過去の実境界Evidenceを削除せず、現在のNamespace試験と退役Capabilityの履歴を区別した。コミット・プッシュは未実施。

残る判断は次のとおり。

| 対象 | 現在のOwner・次候補 | 変更しない保証／未確定事項 |
|---|---|---|
| Namespace作成・Path管理 | Node.js標準への移管候補 | Windows専用保護を撤廃するとSID／DACLの厳密照合・祖先差替え防止は失われる。OSユーザー専用領域と基本的なPath確認は別途維持する。今回は変更しない |
| 共有Pipe | CoordinatorのKernel／Authority、ExecutorのHome Lease、Domain Storageが直接利用 | Executorも直接取得しているためDomainへ単純移動できない。新Package・実装複製・逆依存は追加せず、配置は未確定 |
| 同期取得 | Domain等の同期保存に接続 | 同一threadの同期待機中にも取得を進めるWorkerが必要。非同期化は保存順序への影響を別途評価する |
| Native全体 | Docker Desktop Helper・Provider Home等が残る | 今回の退役だけでRust／PA全体の撤去完了とはしない |

現在のChecker責務は[責務境界整理](checker-responsibility-boundary.md)へ更新した。以下の全Source命名・Header検査と450件Catalogは先行候補の履歴であり、現在のChecker機能や全Source是正完了を示さない。

## 承認済みWorkspace値検査の接続完了 — 2026-11-06

人間承認により、QA-000007へ`RFD-UT-030`を一件追加した。既存のARCH-000009とWorkspace詳細のDomain所有DTOから、保存候補の閉形式・Workspace相関・Commit形式・表示名・関連CHG・選択内容の純粋検査を導出し、ARCH／DetailのQuality分析、検証設計、Quality CenterとDomainの既存二Case・Symbol Manifestを追従した。新しい製品機構や試験、規約・Checkerの免除は追加しない。無関係な公開集合RCM-UT-014／実Git RFD-IT-029の接続はこのSuiteだけから撤去し、他Suiteと過去Evidenceは維持する。

対象11Suiteに限定して同じChecker関数をメモリ内で実行した台帳・段階・全Header照合は成功した。これは製品Checkerの対象除外ではなく、原因層の限定確認である。Domainの既存二Caseを再実行し2／2成功、format／type／lint成功、Catalog450件valid・testExecution not_started、diffの空白検査も成功した。先行段階の関連107試験成功はその対象改訂版の局所結果として維持し、新義務の正式Passへ遡及転記しない。

11Suiteの分類不一致は是正済み。全体Header検査では別の既存DI integration/probe-asyncのpackageDocumentation不足に到達し、命名・コメントの全体課題も未是正である。直下の「10Suite是正・1Suite判断待ち」は承認前の履歴として読む。実AI・Docker・過去保持物は操作せず、コミット・プッシュは行わない。

## 試験段階の是正とChecker要求の評価 — 2026-11-06

今回の実装範囲は既存11Suiteの段階・QA接続と、その直接参照・Headerの是正。製品Source、公開API、規範、保存形式、試験のassertionは変更しない。技術・品質の独立確認、対象回帰と直接伝播確認を行い、規範・Release不変更のため準拠・Release監査は追加しない。

### 是正した10Suite

| 試験 | 維持する段階・接続先 | 根拠 |
|---|---|---|
| Executor lifecycle／probe／review-delivery／observation／controller／plan／attempt/validation | UT、ERB-UT-023 | 型・純粋値・有限DI／Command代役による入力、取消、通知、結果解釈。実DI・実Provider成立ではない |
| Coordinator execution/attempt-preparation | UT、PRL-UT-014とERB-UT-023 | 模擬Storeの準備相関・一回消費・二時計と用途別入力 |
| Coordinator execution/eligibility-observation | UT、ERB-UT-023 | 選定前の五軸分類。実認証・利用可能性のIT成立ではない |
| DI integration/isolation-lifecycle | IT、ERB-IT-004 | 本番Executor・DIの準備／実行／回収を有限CLI・Process・Directoryへ接続。実Dockerではない |

### 残る1Suiteと独立確認による是正

Domainのworkspace-technical-contractは保存候補の閉形式、Workspace相関、表示名・OID・選択の純粋検査でありUTが妥当。しかし既存のRCM-UT-014は公開export/import集合、RCM-UT-016はDomain共通Outcomeの専用義務であり、このSuiteの観測と一致しない。親が一度行ったRCM-UT-016への付替えは独立確認で否定され、撤回した。元のRCM-UT-014／RFD-IT-029の接続も適合済みとはしない。

QA-000007の既存UT-006はIdentity／Revision Policy、UT-028は管理状態の専用Schemaであり、Workspace候補の純粋値検査をそのまま充足する項目は確認できない。推奨はQA-000007に対象限定のUT義務を一件定義し、既存Suiteを接続すること。新しい製品機構・試験は不要だが、検証設計の追加になるため、今回その項目を無断追加せず判断待ちとする。IT-029の実Git義務と既存結果は維持する。

### Checker要求の評価（規則変更は未実施）

先の4,328件は、是正前候補の検出件数であり、固有識別子数ではない。内訳は責務コメント・参照2,770、命名1,557、型分類不能1。命名のみ4,328という旧説明は訂正する。複数tag不足は同じ宣言に重複計上される。

| 対象 | 現在の根拠・評価 | 推奨する次の処置 |
|---|---|---|
| File／Symbolの責務と設計参照 | Coding Standards §4.3の明示要求。Git実行Sourceの一行複数ARCH参照などは現行の一tag一ID形式と不一致。Checker独自要求とはいえない | 参照と責務を維持し、形式不一致と説明不足を別集計する |
| 局所Helperの全固定tagと非該当理由 | 規約は短い局所処理の簡潔さも求めるが、同時に全tag・非該当理由を要求。型検査専用Helperにも終了・清掃・境界の反復を生む。現在のCheckerは全tag側を実装している | 小さな純粋HelperはSummary／責務を基本とし、Effect・資源・外部境界を持つものだけ詳細化する案を規約側で評価する。現時点で免除しない |
| Type AliasのShape／Invariant／Security／Compatibility等 | 規約の型契約Headerに対応するため、Checkerだけが過剰とは断定しない。一つの既存型を再利用する局所型にも同じ記述量を要求する費用がある | 公開・共有契約と局所型の必要記述を区別する案を評価。型や保証を削るのではなく重複説明を減らす |
| Boolean接頭辞・配列複数形・固定定数分類 | §4の明示規則に対応。固定集合・型分類・escape解析等の複雑さはCheckerが独自導入したものではなく規約にも存在する | 外部契約名を保持し、文脈上明確な内部名まで改名する価値と、分類器維持費を比較する。全件改名はまだ行わない |
| 単独名の一律拒否 | §5の禁止集合に対応する一方、同節は関数・Methodの単独動詞を呼出し文脈で評価するとも定める。§3.2との適用境界は要整理 | 値の曖昧名と、対象の明確な操作名を分ける。文脈判断が必要なものを機械的に全て不合格にするべきか先に規約判断する |
| 型分類不能一件 | 型取得できないことは名前が悪い証明ではない。ただし現規約は分類不能を成功扱いしない | 型解決の故障か入力型の問題かを切り分け、分類不能と命名違反の表示を区別する |

規約の採用範囲や例外を今回変更せず、Checkerの検査を弱めて合格にする処置も行わない。Sourceの全Header自動生成や、命名の機械的一括置換を次の既定作業にはしない。

### 検証と限界

対象11Suiteの実行は107件成功（Executor20・Coordinator12・Domain2・DI73）。四Packageのformat／type／lintとCoordinator追跡検査は成功。Catalog450件validは静的結果であり正式Passではない。独立確認では上記Domain接続一件を検出し、誤った新接続を撤回した。全体のHeader検査は別の既存DI integration/probe-asyncのpackageDocumentation不足に到達し未合格。今回10Suite是正を横断Checker全体や11Suite全完了へ昇格しない。補助的な実行token列比較は検査Scriptのメモリ不足で未成立であり、回帰成功の根拠に含めない。実AI・Docker・過去保持物は操作せず、コミット・プッシュは行わない。

## 横断Checkerの既存失敗の是正 — 2026-11-06、未完了

今回の対象は、前節のPA整理で残った横断構造試験4失敗の最小是正である。Rust試験3ファイルをsnake_caseへ改名しCargo・参照・台帳を追従した。実際のRoot再export集合へCheckerの4Package期待値を合わせ、未登録の自動試験27Suiteと検証Tool4件を既存QA義務へ接続した。人間操作の未実施UATは自動試験として登録しない。試験のHeader不足も補い、実行処理・検査の免除は追加しない。types.tsで発見した回復開始stage定数は、値・順序を変えず既存validation.tsへ移管した。

- Rust全targetのoffline compile-checkは成功した。Native実試験や実修復の成功ではない。
- 関連試験はCoordinator9、DI22、Executor58、Domain13、VC実Git2、Workbench25が全件成功した。Workbenchの制限下20成功・5失敗は通常条件で25成功へ再確認し、外部AI・Dockerは使わない。
- Coordinatorの型・書式・Lint・追跡検査とCatalog450件の静的検査は成功した。CatalogのtestExecutionはnot_startedであり、正式なQA項目のPassへ換算しない。
- 当初の先行エラーを解消した全件走査で、全Packageにまたがる識別子命名違反4,328件と、既存登録済み11SuiteのUT／ITとQA Local Item段階の不一致が露出した。これらは未是正であり、横断Checker全体は未合格。命名の一括置換、規則の緩和、QA IDの機械的付替えは行わない。
- 読取り専用の独立確認は現在差分に追加の確定不整合を検出せず、上記広域課題を最小是正へ無断で拡張しない停止判断を支持した。4,328件と11Suiteの全件再導出を独立確認が実施したという意味ではない。

次の判断は、公開名・保存値・外部契約を保ちながら命名規則をどの対象へ適用するかと、11Suiteの実観測に対応する検証段階の確定である。条件付きのコミット・プッシュは未実施とし、現在差分を保持する。実AI・Docker・過去保持物の操作は行わない。

## 標準API直結と子環境の重複撤去 — 2026-11-06

利用者はPA廃止を第一候補とし、現行の強い保証を一律必須としない方針を採用した。今回はOS／PIDの標準API直結と同値環境入口の統合を実装する。親の着手前照合と読取り専用の独立確認では、Windows固定と現在OS選択、Profile付与の実差分、PID三値・入力拒否を保持条件とした。技術責務のRefactorとして、利用側・試験・台帳・Architecture・QAの追従と限定独立レビューを行う。規範・Release不変更のため全体準拠監査は実施しない。

PAのOS・PID観測二APIと専用Sourceを撤去し、Coordinatorは`process.platform`と、既存Ownerの入力検査後の`process.kill(pid, 0)`を直接使用する。ESRCHだけ不存在、他の失敗は不明。不正PIDではOS照会0、PID存在を同一世代と見なさない条件を維持し、反証試験を既存Coordinator試験へ移管する。CatalogとSymbolの旧試験・旧Source接続は撤去して新Ownerへ追従する。

環境はConsole／Node Reader／Supervisor／Nativeの四入口から`createChildProcessEnvironment({ platform?, userProfile? })`一入口へ統合する。任意envや任意Pathを受け付けるbuilderは作らず、実OS差とOS由来Profileの付与要否だけを選ぶ。Windows固定Consumerは明示optionを使い、Profileは必要な呼出しだけ付与する。Host記録TMP／TEMP・PowerShell五項目・Docker固有設定は実差分として維持する。DIの変更理由はPA利用API追従だけであり、Dockerの実行・回収・信頼検査・保存・期限は変更しない。

### 残機能の評価（未実装・判断候補）

| 機能 | 残す必要と推奨案 | 現方式を外す場合の影響 |
|---|---|---|
| 共有Pipe排他 | 保存Writer・Home・操作排他は現在も必要。Node実装を前提に、同期／非同期Consumerと保持寿命を照合して配置を決める | 全てCoordinatorへ移すと逆依存、各Ownerへ一式コピーすると重複。PA全廃の配置判断は未確定 |
| Runtime／Homeの厳密Token・ACL | 秘密・保存先の境界は必要。対話ログオン限定や固定ACL形状は必須と決めず、通常OS利用者境界で足りるか評価 | 独自の権限不備検出やService等の拒否が減る。Nodeのchmodだけで同等とは扱わない |
| OS所在のNative取得・中立環境 | 今回は維持。標準の起動環境を信頼してよいかを先に判断する | 親環境を根拠にできない現条件が変わる。C:\\Windows等の固定推測へは置換しない |
| Host終端の未接続記録・専用Lease | 本番接続を確認できない退役候補。旧Callerは既に廃止済みだが、PA私有技術契約維持の旧判断は別途更新が必要 | 通常Recovery記録は既存Node保存に残す。未接続の専用保護・保存能力を失う |
| Host Namespace初期化 | Coordinatorの本番接続あり。通常保存先初期化と特別ACLを分けて評価 | 無条件撤去では本番初期化が壊れる。特別ACL廃止には保護条件の再判断が必要 |
| Docker強制修復 | 公式停止・起動を第一候補とし、失敗時は人間へ戻す案を推奨 | 強制終了による自動復旧範囲が狭くなる。公式CLIをNodeから呼ぶことと組込みAPIだけの処理は区別 |
| 特殊reparse残存物 | 不明項目を自動削除せず保持・手動対応にする案を評価 | 自動回収能力が減るが、不明を安全へ読み替える必要はない |
| Jobによる親異常終了時の回収 | 通常取消・実終了観測は残す。補助子の子孫・親異常終了保証が本当に必要かを個別評価 | kill要求受付ではJobの子孫回収保証を代替できない。孤児残存の可能性と再入場を評価 |
| Native Artifact・Protocol | Nativeが最後まで不要になった後にBuild・配布・照合も撤去 | Native利用中は先に削除しない。外部Docker実行物の信頼確認とは別 |

保証変更を伴う残件を今回の名称統合に混ぜず、PA全廃／Native全廃の成立は主張しない。実AI・Docker・過去保持物は操作しない。

### 検証結果と未成立範囲

- PA通常全回帰143／143成功。DI通常回帰は制限環境で401成功・junction作成EPERM 1失敗・既存対象外5、その後製品・検査不変更で通常権限にて402成功・失敗0・既存対象外5。実Docker項目は未実行のまま維持する。
- CoordinatorのPlatform／Lease・Native読取り判定29／29、環境・Profile／所在故障の限定5／5、Task純粋閉包とNode直結の6／6成功。専用PID試験の2反証は既存Owner試験へ移し、Node標準のOS値を返すだけの旧試験は撤去した。新環境入口はWindows／非Windows・明示Windows固定・Profile付与／欠測を模擬し、実Native操作とは分けた。
- PA／DI／Coordinatorの型・書式・LintとCoordinator二追跡Checkerが成功。三PackageのSymbol Manifestはcomplete・issues 0、Catalogは450件valid・試験未開始という静的結果。Catalog成功を試験成功へ換算しない。
- 独立確認で旧Source必須の試験2箇所とCoordinator Architecture2箇所を検出し、Node直結のOwnerへ追従した。横断確認で露出した基準版由来のSource未分類2件は技術実行へ分類し、VC配置試験の同一verifies二重登録は1要素へ統合した。対象集合の免除や製品Sourceの追加変更は行わない。
- 横断Checkerの構造試験は通常権限で19成功・4失敗。残りは既存Rust試験File名`host-record.rs`、DIの廃止済configurationを要求する期待値（2試験）、既存authentication-management試験のSymbol不足であり、今回PAのNode直結へ伴う失敗とは分ける。全体Checker／QAを合格とはしない。実修復・Native Build・実AI／Docker・過去保持物操作は実施しない。
- 是正後のSource・利用側・管理情報・文書を固定した読取り専用の最終独立再レビューは、追加必須指摘なし。今回の限定結果をPA廃止や実環境の全保証成立へ拡張しない。

対象: CRDD v0.22 / CHG-000082 第二段階
基準Commit: `3e5bd9135`
状態: 既存TypeScript配置の移管・限定回帰・独立レビュー完了。Native接続抽出・Rust再配置は後続単位
決定権限: Qual-Lab

## 1. 採用方針と実行境界

人間の添付MDと追加合意を設計入力とする。Platform Accessは独立Packageを維持し、上位はTypeScript公開APIを呼び、その内部でRust Native Helperへ接続する。Rustは機能別のWindows実装を責務Folderの`mod.rs`から`#[cfg(windows)]`でビルド時に選択する。Linux／macOSの実装・空Stub・Driver Registry・Factoryは追加しない。

変更分類は、既存Capabilityの責務移管と構造Refactor。Architecture・Quality・Coding Standards・Source・公開API・Build・試験・Symbol・Catalog・既知Consumerを同じ単位で追従する。通常保存・Authority・Binary Protocol・失敗理由・回復参照の意味は変えない。現在Repositoryだけを書込みRootとする。実Docker操作・外部AI・②保持物削除・過去Evidence更新・Releaseは対象外。

親の照合と読取り専用確認者により、技術搬送と上位判断の分離、前後の開発観測確認、部分Effect・終了不明の保持、Cargo入口と検査母集団の追従を着手前に確認した。追加の人間判断は現時点で不要。技術・品質の独立レビュー、文書と直接伝播の確認を各固定単位で行う。標準工程・準拠表明・Release条件は変えないため準拠監査・Release監査は追加しない。実境界の操作が必要な場合は、その対象とEffectを別に提示する。

## 2. 移管対応表

| 現在の所有者・処理 | Platform Accessへ移す責務 | 上位へ残す責務 |
|---|---|---|
| Coordinator `platform-access/adapter.ts`・`protected-root-protocol.ts` | それぞれの固定要求・応答・nonce・長さ・版の技術契約 | 上位判断と用途。異なるProtocolを似たbyte処理だけで統合しない |
| Coordinator `platform-access/protected-root-windows-adapter.ts` | 固定Nativeの起動、Artifact前後確認、Root観測の搬送 | Root用途・初期化許可・WeakMap Capability発行／消費 |
| Coordinator `provider/home-windows-adapter.ts` | Home観測要求・応答検査・Native搬送 | Provider選択・10秒鮮度・Mount Capability発行／消費／失効 |
| Coordinator `host-execution/terminal-windows-adapter.ts` | 記録保存・読取り・対象観測の用途固定搬送と相関 | 終端記録の意味・Recovery判断・同じ回復参照・再入場と清掃許可 |
| Coordinator `host-execution/recovery-namespace-windows-adapter.ts` | 親観測・期待Identity結合・初期化の技術処理 | 用途・作成時点・処置判断 |
| DI `desktop/native-process.ts`・`native-process-lifecycle.ts` | 補助子取得、専用環境、固定Protocol、EOF／release／abort、子とstdioの終了 | 修復／再起動の承認・対象操作・回数・Engine再観測・Checkpoint |
| DI `desktop/runtime-directory.ts`・`repair-directory-disposal.ts` | OS実体・アクセス・Identityの技術観測 | Operation・退避・継続・保持・削除の判断とCheckpoint |
| Orchestrator `storage/protected-decision.ts`・`platform/windows-adapter.ts` | 新しい技術観測Ownerへの接続を照合 | 既存の上位Capability利用を技術APIと混同しない |

開発用Native観測のborrowは上位に残し、現在の前後二回確認を維持する。Native実行後の再確認に失敗したらCapabilityを発行しない。PAからCoordinator・DIへimportしない。DIの既存Policy Hashは上位が取得し、用途固定のPA操作へ値として渡す。任意argv・raw frame・任意実行物を受け付ける公開APIは作らない。

Native応答、Protocol完了、子Process終了、全stdio終了、cleanup成立は別の観測として維持する。初期化・保存の発行後失敗で部分receiptや`filesystemEffectIssued: null`を未発行へ畳まない。同期／非同期の方式変更、再送・timeout延長を移管へ混ぜない。

## 3. 目標配置

追加の人間判断により、Native実行物確認をPA内部へ閉じ、上位のArtifact token公開・管理を減らす。Root／Home、Host記録、Docker補助子、開発Session、出所診断の全Consumerを移管した後に公開begin／verifyを撤去する。単なるHandleへの改名・新Registryは行わない。通常操作の起動前後確認・固定Artifact・失敗時の発行事実は維持する。

```text
platform-access/
├ src/
│  ├ index.ts                         意味操作を明示公開
│  ├ artifact/identity.ts              Native成果物の同一性観測
│  ├ filesystem/                       entry・system-directory・local-app-data
│  ├ process/                          environment・termination
│  ├ host-record/                      既存の記録・namespace技術接続を移管
│  ├ docker-desktop/                   既存の補助子・固定Protocol・終了処理を移管
│  └ native/
│     ├ build.rs                       Cargoコンパイル前の準備
│     ├ main.rs                        固定CLI受付
│     ├ protocol/                      access・host_namespace・host_record
│     ├ filesystem/
│     │  ├ mod.rs                      cfgによる実装選択
│     │  └ windows/                    entry・root・保護・Known Folder
│     ├ process/
│     │  ├ mod.rs
│     │  └ windows/                    child・principal
│     ├ host_record/
│     │  ├ mod.rs
│     │  └ windows/                    対象・namespace・記録File・保存と既存排他
│     └ docker_desktop/
│        ├ mod.rs
│        └ windows/                    identity・publisher・repair
├ tests/                               TS・Rust試験を責務別に配置
│  ├ integration/native-cli.rs          固定Native CLIの結合試験
│  ├ integration/windows-entry-diagnostic.rs  明示限定のWindows診断
│  └ fixtures/                         Rust・TSの試験入力
├ Cargo.toml / Cargo.lock
├ rust-toolchain.toml
└ package.json / tsconfig.json
```

OS別Folderへ移しても同じ保証を他OSへ継承しない。非Windowsの現行拒否を維持し、実装時だけLinux／macOSを追加する。Host Record内部は依存を照合し、保存と不可分な容量予約を機械的に別責務へ切らない。既存排他を分離する場合は保存責務の`storage/lock.rs`へ置き、Lockを新設しない。単一の巨大`windows.rs`、転送だけのTS APIは作らない。

Cargo rootと`target/<target>/{debug,release}`を維持する。`[[bin]].path`、`package.build`、`[[test]]`を新配置へ明示接続し、Cargo Workspaceは作らない。Source／testsの移動と同じ単位でFixture相対Path、Rust実体の閉集合、Symbol、Catalog、coverage、Build／配布検査を切り替える。CRDD署名方式の退役とWindows Publisher検証は別能力であり、後者を削除しない。

## 4. 実行単位と検証

1. 既存PAのTS実装を機能別へ移す。公開名・型・戻り値・処理本文を維持し、直接Source読取り・動的import・`import.meta.url`のRoot導出を照合する。
2. Coordinator／DIに残るNative接続を用途別に抽出し、本番Consumerと試験を接続する。上位Capabilityと開発観測は残す。
3. Rustをnativeへ移し、責務別Windows配置へ接続する。Host Recordの実装と試験を責務で整理する。
4. Root API・Header・Coding Standards・Catalog・Symbol・利用側・Buildを全数再照合し、局所・回帰・独立レビューを行う。

基準版ではTSの静的14Fileと通常試験10件が成功した。Host専用試験・Rust・Docker復旧・全体QAはこの基準確認に含めない。

移管で確認する反証は、欠落／改変Artifact、前後Root・File差、偽token、Protocolの旧版・異種・欠測・余分frame、nonce不一致、起動前拒否、開始後取消、EOF・timeout・Process／stdio終了不明、発行後の保存部分Effect、同じ回復参照、未対応OSの明示拒否である。既存の固定形式と失敗条件を維持し、試験数から不存在や回収成功を推定しない。

物理移管や局所試験の成功だけでPA全体完成とは表示しない。実Nativeの再BuildはHashが変わり得るため、Build成功と固定配布成果物の有効化を分ける。古い配布成果物へ新しい実装成立を推定せず、必要な実境界確認と採用条件を別に満たす。

## 5. 最初のTS配置単位の結果

既存6実体を`artifact/identity.ts`、`filesystem/{entry,system-directory,local-app-data}.ts`、`process/{environment,termination}.ts`へ移し、Root入口と直接Consumerを接続した。基準Commit本文との比較は、必要な相対import変更・改行正規化後に6／6一致。Root公開名・型・戻り値、配布Root導出の深さ、固定Native Path・Hash・Protocol・終了処理は不変。Symbol・Catalog・coverage・公開allowlistと直接Source試験を追従した。

| 確認 | 結果 |
|---|---|
| PA通常`npm test` | 静的14File成功、10／10成功 |
| Coordinator／DI利用側 | 型検査成功。DI静的72File成功（既存Info 1、Warningなし） |
| DI Package境界 | 3／3成功 |
| Coordinator Host記録 | 30／30成功 |
| Domain試験台帳 | 25／25成功、実在371件の台帳検査valid |
| Header・公開入口・QA接続 | 3／3成功 |
| 本文・参照・空白 | 本文6／6一致、現行対象の旧TS Path参照0、差分空白検査成功 |
| 限定独立レビュー | Source・Consumer・文書・QAの残指摘0 |

台帳検査で前単位のWorkbench Query試験1件の未登録を検出し、既存試験を最小登録して是正した。検査義務・期待条件は弱めていない。Checker全体checkは未変更の`domain-model/tests/integration/storage-consumer-closure.integration.test.ts`の既存整形1箇所で停止し、全体成功とは扱わない。今回のPath短縮に伴った整形2箇所は是正した。

次は§2のNative接続抽出を行い、技術搬送の型付きAPIと上位Capabilityを分離する。Rust配置・Host Record分割・実Native再Build・必要な実境界・全体QAは未完了。Docker・外部AI・保持物は操作していない。今回の自己生成試験物は各試験の終了処理で回収した。

## 6. Root／Provider Homeの本番接続

`observeWindowsRuntimeState`と`observeWindowsProviderHome`をPA Root APIへ接続し、固定要求・応答・Artifact前後確認・閉じた環境・固定Nativeの同期起動をPAへ移した。純粋Protocolは`filesystem/protection.ts`、技術実行は`filesystem/root.ts`が所有する。上位二Adapterからspawn、Artifact比較、begin／verifyとNative token管理を撤去した。上位のRoot／Provider選択・鮮度10秒・Capability発行／消費／失効は維持した。

開発観測は上位の既存borrowを同期Readerへ投影し、要求構築後とArtifact後確認後だけに呼ぶ。nonce失敗はReader前、初回nullは開発Context拒否、期待Artifact欠落はBootstrap取得不能、後Reader拒否は応答不正より先とする。Readerを保存せず、例外も新しいcatchで別理由へ変えない。

返却結果は平坦な型付き観測と失敗区分で、Process発行、Filesystem要求発行、Helper終了、Artifact前後確認を別fieldで保持する。初期化を要求したNative起動後の失敗ではFilesystem要求発行を残す。上位へtoken・raw frame・実行物Pathを返さず、上位自身が保持する用途別Capabilityとは区別する。

旧Coordinatorの通常Bootstrap省略検出は、新しいPA試験へ移管した。同じ本文に対するBootstrap・前後確認・shell・argvの変異検出を維持し、Root／Home二用途、nonce・Readerの競合、未知応答とEffect保持を追加した。元の本番Session結合は新PA実装と私有Artifact依存へ接続し直し、実行順・取消・失効・前後Source差の期待条件を維持した。

現時点の確認: PA静的17File・通常11件、上位Root／Protocol8件、Session結合120件、通常の開発観測回帰128件、Windows Host限定1件、利用側・coverage契約14件が成功した。Windows Host初回のHardlink EPERMは実行環境制限として保持し、必要権限で同じ限定1件を確認して成功した。外部AI・Docker操作は行っていない。最終通常回帰128件と限定独立レビューを確認した。ただし、後続の着手前照合で純粋Protocol試験のPackage私有参照を検出し、前レビューの指摘0をこの点について訂正した。§7の試験移管で是正し、PA全体完成とはしない。

検査で発見した先行の残りは、Workbench Query試験の不足boundary説明3箇所と不要な局所Lint抑止2行、Domain試験の改行1箇所だけを是正した。処理本文・検査規則・期待条件を変えず、全体静的検査は成功（既存Info62、Warning0）、Header／公開／QA接続3件も成功した。先行記録の全体整形停止はこの是正前の結果として区別する。

残る公開token利用はHost記録の読取り・保存、DI補助子、開発Session、出所診断等である。これらの移管前にroot公開begin／verifyを削除せず、全Consumerが移行した後に撤去する。内部WeakMapを別名の公開Handle／Registryで代替しない。合意した最終API一覧のHost記録・Docker部分、Rust OS別配置は未実装を維持する。

## 7. Host記録保存先の初期化と試験Owner

`host-execution/recovery-namespace-windows-adapter.ts`の技術処理をPAの`host-record/namespace.ts`へ移し、`initializeWindowsHostRecordNamespace`を公開した。上位の通常作成入口がこのAPIを呼び、初期化する時点・失敗分類・Root作成・清掃判断は従来どおり上位に残る。追加の中継、token、Registry、Lockは作っていない。

親観測→期待Identity・利用者Hash結合→初期化、二要求のArtifact前後照合、固定argv・5秒・有界出力・部分receipt・不明Effectと終了値相関は維持した。同じFolder深さのため配布Root導出は不変。独立した観測操作は利用側がないため公開しない。

純wireとNative搬送の反証をPAへ実移動し、Coordinatorには上位作成との結合だけを残した。Root／Homeの先行試験でも私有Protocol importをPA側へ移した。公開APIを試験のためだけに拡張せず、失敗反証も削除していない。直接子Process利用元一覧は実際のPA Root／Namespace Ownerへ追従した。

確認結果: PA静的20 Fileと通常17／17、Coordinator型検査と上位結合2／2、子Process利用元1／1、Header・公開・QA接続3／3、台帳374件valid、全体静的検査成功（既存Info62、Warning0）。試験台帳は実行結果ではなく登録整合の確認として扱う。後続の§8是正を含む独立再確認は残指摘0。実Nativeの再Build・Docker・外部AI・保持中の②試験物は操作していない。

## 8. Session結合試験の公開境界への是正

先行Session試験に残ったPA私有Moduleのmockと動的importを撤去した。上位は公開APIの固定結果と同期Readerの投影だけを代替し、Artifact照合・wire・spawnの検出手順を再実装しない。PA実本体の反証と上位処置の反証は別試験として成立させ、単一試験で実Sessionから実PA内部まで通したとは表示しない。

旧30条件×四対象の対応は次のとおり。PA側の確認先は`root-observation.contract.test.ts`の二用途と既存五変異、上位側は`development-native-observation.integration.test.ts`の同名Caseである。

| 旧条件 | PAの検出義務と確認先 | 上位Session／Adapterの処置義務 |
|---|---|---|
| normal、checkout-normal | normal／development | 正常結果からだけCapability発行。前後Readerと公開API一回配送 |
| pre-artifact、checkout-artifact-mismatch | artifact-before | 固定拒否結果でCapability非発行・Effectなし |
| post-artifact、checkout-post-artifact-mismatch | artifact-after | 拒否・終了確認・発行済みEffectを保持 |
| environment | environment | 起動前拒否結果を伝播 |
| checkout-bootstrap-missing | bootstrap | Bootstrap取得不能を伝播 |
| checkout-pre-token、checkout-post-token | verify-before／verify-after、前後確認省略変異 | 段階に応じて未発行と発行後拒否を区別 |
| post-source、post-native、post-repository | PAは技術正常結果だけ | 観測後に変更されたSource／Native／Repositoryを次のProvider境界で拒否 |
| native-null、native-throw | borrow-first | 実Sessionの観測取得不成立をReaderから拒否 |
| unknown-context | borrow-first | 偽ContextからCapabilityを発行しない |
| cancel、expiry | borrow-first | 実Sessionの取消・期限切れを拒否 |
| cleanup-cancel、cleanup-expiry | borrow-first／development | 読取り清掃Contextと初期化要求を区別 |
| admission-source-hash、source-hash-mismatch | PA検出の対象外 | 受付時／再観測時のSource期待差を実Sessionで拒否 |
| old-token-stale、old-token-throw、old-token-second | borrow-first | 元観測の前後失効・例外をfresh観測で上書きしない |
| new-token-final | borrow-first | fresh観測の最終確認不成立を拒否 |
| borrow-token-stale、borrow-token-throw | borrow-first | 借用中の元観測失効・例外を拒否 |
| post-borrow-token | borrow-after | 後Reader拒否で上位Capabilityを発行せず、発行済みEffectを保持 |
| cleanup-old-token-stale | borrow-first | 清掃Contextでも失効観測を再利用しない |

模擬`nativeEffectObservations`は公開結果のEffect通過数であり、実Process開始・不存在の観測ではない。別に公開API配送数とReaderの0／1／2回をassertする。checkoutのPA内部Bootstrap回数・Artifact回数は上位試験から外し、PA実本体の厳密イベント順と変異検出へ移した。上位Sessionの観測回数0と公開API配送一回は引き続き確認する。受付で拒否するCaseは公開API・Readerとも0である。

Host補助子環境の純値試験もPAの`tests/unit/process/environment.contract.test.ts`へ実移動し、上位からPA非公開Sourceを読む依存を撤去した。新しい公開API・Fixture Facade・例外規約は追加していない。

最終確認: PAの静的21 File・通常18／18、Coordinatorの型検査・Host記録と上位接続31／31・通常開発観測128／128（50.4902秒）、Header／公開／QA接続3／3、台帳375件valid、全体静的検査（既存Info62・Warning0）が成功した。独立再レビューは残指摘0。今回のSource試験用`development-source-*`領域は終了後に残存なしを確認した。実Native再Build・Rust配置・Docker補助子移管と必要な実境界は引き続き未完了であり、PA全体の完成とは扱わない。

## 9. Rust配置の変更

人間の配置判断に従い、Rust実装は`src/native/`、Rust試験は既存の`tests/`へ統合する。Cargoの`build.rs`は`src/native/build.rs`へ置き、別の`native/`親フォルダは保持しない。Cargo入口、Fixture相対参照、Symbol台帳、検査対象、ArchitectureとCoding Standardsを同じ配置へ追従させる。過去Evidenceは変更しない。

配置後の固定Toolchainによる`cargo check --frozen --all-features --target x86_64-pc-windows-msvc`と、Rust単体・CLI試験の`--no-run`ビルドは成功した。これは試験実行・配布更新・Docker実境界の成功を意味しない。HostのHardlink非対応によるビルドキャッシュのCopy fallback警告は残る。①〜⑤全体は引き続き作業中である。

## 10. 配置追従とHost記録の接続確認

`build.rs`を`src/native/build.rs`、Rust CLI試験を`tests/integration/native-cli.rs`へ移動した。CLI試験からWindows退避領域の診断を`tests/integration/windows-entry-diagnostic.rs`へ分離し、明示実行限定のignored条件を維持する。Cargo Target、Symbol、Test Catalog、検査対象とcoverage入力を追従し、coverageの期待Source 14件がすべて実在することを確認した。

Host記録の技術搬送はPAの`src/host-record/record.ts`へ移管し、上位は意味検査済み本文と同じencode結果から技術期待値を投影する。上位の実Session・caller保存・Recovery判断はCoordinatorに残す。技術単体17件とNative実本文反証1件はPAへ配置し、上位の意味検査12件と実Filesystem caller結合8件を維持する。試験側の実投影関数注入も新境界へ追従し、異なるRealmのobjectを本番入力の代わりに渡さない。

現時点の確認結果はPA通常86件成功、Docker Isolation通常293件成功・実Docker試験1件未実行、Host caller結合8件成功、上位開発Sessionの通常127件成功である。制限環境でHardlink作成が拒否されたHost専用1件は通常権限で個別確認し成功した。PAの型・lint・format、公開入口・Source Header・Quality接続を含む構造検査5件も成功した。退避領域の実診断、Docker操作、外部AI依頼、固定Native配布物の更新は行っていない。

この単位時点では、上位Artifact token公開の縮小、利用側・設計・検証対応の全体照合と全体独立レビューを未完了として保持した。以後の処置は次節を現在値とする。

## 11. ①〜⑤の最終照合

状態: 今回の①〜⑤のSource構造・公開API・利用側移管を完了。通常回帰と限定独立レビューは残指摘0。実Docker操作・配布更新・外部AI E2Eの完成を含めない。

| 項目 | 現在の所有者・処置 | 維持する境界 |
|---|---|---|
| ① Host記録の技術実行 | PA `host-record/record.ts`／`namespace.ts`。通常の六u32型もPAに統一 | intentの意味、producer、処置順、caller保存、Recovery判断はCoordinator |
| ② Docker Desktop補助子 | PA `docker-desktop/helper.ts`／`protocol.ts`。DIの本番Callerと試験をRoot APIへ接続 | Policy選択、承認、Checkpoint、Engine判断、再起動・回復の可否はDI |
| ③ Artifact公開tokenの縮小 | Rootからbegin／verifyを撤去。`observeNativeArtifact`の実体・内容Hashで前後比較 | 内部の同Handle照合を維持。元失敗を新baselineで上書きせず、Bootstrap要求用途を維持 |
| ④ Rust配置・試験分離 | `src/native/<責務>/windows/`とcfg選択。Host記録の試験本体は`tests/integration/host-record.rs` | 私有moduleへのcfg接続・試験項目・ignored条件を維持し、完全修飾名は新moduleへ追従。容量予約と保存の不可分な所有を切らない |
| ⑤ 設計・公開入口・利用側・試験 | Architecture、Coding Standards、Quality、Catalog、Symbol、coverage、Cargo・npm入口を追従 | 新Framework・State・Lock・Authorityは追加しない。過去Evidenceを改名しない |

`observeNativeArtifact`は一回の既存Snapshotから、Root実体、実行Path、File実体のbigint値、内容Hashとbyte長を固定順でHash化する。任意の元Hashは非Authorityの比較条件であり、観測不能・元Hash不一致はnull、固定Bootstrap不一致は正常観測のfalseとして区別する。Source／Gitの意味と上位Capability判断は移管しない。

同一bytesの別Fileへの置換、本文・期待値の不一致、対象実体alias、既知FileのDirectory／Reparse属性、元実体の前後失効、最後の再観測拒否を試験する。Native環境欠測の検出はPA、公開失敗を受けた上位のCapability非発行はCoordinatorで確認する。移動した試験を元Ownerのconsumer一覧に残さず、新Ownerの実在試験と本番利用側へ接続する。

最終確認（2026-10-20）: PA通常88件、Docker Isolation通常293件、上位Session127件、関連境界・台帳70件、Host実Filesystem9件が成功した。Docker Isolationの明示Docker試験1件は未実行。通常Rustは47単体＋8CLI成功、23件は明示ignoredを維持した。固定Toolchainの書式・Clippy、PA静的検査、全体の書式・型・warning禁止Lint、Header・公開API・QA接続3件、台帳378件valid、差分空白検査が成功した。Lintの既存Info62件は残る。RustのHostキャッシュHardlinkは環境制約によりCopy fallbackとなる。

Source・安全境界と設計・配置を分離して独立確認し、指摘を統合して改名記述2箇所・新Pathの追跡・不要な抑制コメントを是正した。処理・試験条件・過去Evidenceは変更せず、最終候補の再確認は残指摘0。完全出力は端末で確認し、既存の再実行可能な試験へ接続する。実行単位のEvidence書庫は増やさない。

これは固定配布Nativeの更新・実Docker修復・外部AI E2Eの成功ではない。全Repository文書Checkerは不合格（3,520件）であり、過去Evidenceの旧参照等と既存Quality整合の負債を含む。今回の構造整理からRepository全体の品質PassまたはRelease可能とは主張しない。保持中②の試験物、Docker再起動、外部AIの再試行は対象外を維持する。
