# 第二段階：責務・状態所有・実行境界の再編計画

成果物種別: 変更計画
状態: In Progress（Docker Isolation完成後、Workspace方式とCoordinator再編の棚卸し・詳細設計へ）
対象変更: [CHG-000082](change.md)
基準改訂版: `98cab6e3278a61684c557a6499cfb602e2d19111`
維持責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-19

## 1. 結論と実行境界

<a id="source-structure-review"></a>

### 全Packageの構造・責務レビュー — 2026-10-19

現在の構造整理の基準は、コミット・プッシュ済みの`673aa5c0`とする。利用者が提示した10/18「CRDD v0.22 リファクタリング方針・Source Code Structure Review」を基本入力、10/15「共通ルールとモジュール別Before / After案」を補足入力とする。後者の認証・Subscription・Billing専用Folder案は、前者で独立性を確認する方針へ改訂されており、例示Treeをそのまま作成しない。

**今回は全Packageの棚卸しと規約・設計の再整理を開始する。全Packageの移管完了ではない。** Workspace新経路のSource接続と旧Bundle／Store撤去は先行しているが、Phase 01全体の受入完了を主張しない。②の実AI編集E2Eは終了扱い・回収未完了で、unknownと同じ回復参照・保持物を維持する。AI再試行、保持物削除、Docker再起動は本作業へ含めない。構造変更ごとに、この未確認境界と独立して検証できる範囲を確認し、実AI成立を要する変更は別途判断へ戻す。

#### 変更経路と着手前整合確認

| 項目 | 今回の扱い |
|---|---|
| 変更分類 | 非自明な保守・Refactor。Source構造規約、Architecture、検査、Package利用側へ影響する |
| 正本 | 共通命名・配置・Headerは[コーディング規約](../../../06_Architecture/99_Coding_Standards.md)、能力・依存・公開契約は各Package詳細設計。計画本文で再定義しない |
| 先行整合確認 | 現行規約、17Packageの入口・exports・第一階層と添付案を照合。独立した読み取り確認も実施し、CRUD同居、React Component境界、旧Package列挙の追従を編集対象とした。完成後レビューとは区別する |
| 維持する意味 | 既存認可、外部送信、Git明示採用、隔離、失敗・取消・回収、Production／Quality Trace。過去Evidenceは不変更 |
| レビュー・監査 | 規約・設計・利用側の独立レビュー、文書構造と影響伝播確認。実装後はPackage固有静的確認・局所・必要回帰・公開IF確認。実境界は変更した意味から選び、必要時に別途許可を得る |
| 実行しない判定 | 今回は準拠表明・最終統合・リリースを扱わず、準拠監査や全E2Eを規約編集だけから機械発火しない |
| 人間判断 | 公開能力の削除、永続／通信契約変更、権限・保証変更、複数の有力な責務配置で利用者影響が異なる場合に、影響・推奨・代替を示す。現在の棚卸し・規約整合には追加判断なし |

#### 実施順序と入口の初回棚卸し

以下は`673aa5c0`の実Path・package exports・binを読んだ初回一覧であり、各File本文・全Consumer・保証の精査完了ではない。全17Packageに`src/index.ts`がある。CLIが存在しないLibraryへ`bin/`を新設する義務はない。

| 順序 | Package | binの実File | 初回の重点 |
|---:|---|---|---|
| 1 | ai-adapter | なし | Provider共通／固有処理、Profile・Catalog、静的runtime資産、Docker構成との境界 |
| 2 | access-management | access-management.ts | access／management／stateの実責務、User／Role／Credential／認可と保存 |
| 3 | domain-model | なし | Repository／Context／CRUD／保存。公開Subpath `./outcome`の実Consumer |
| 4 | version-control | なし | Git／Worktree／Candidate／Merge。標準Gitとの責務重複 |
| 5 | docker-isolation | なし | execution／desktop／cleanup、使い捨て・回収の現在保証 |
| 6 | coordinator | coordinator.ts | 単発AI調整、provider／task／authority／state-storageの残存責務。公開`./cli`も照合 |
| 7 | orchestrator | なし | Task／Queue／Workspace／Decision、state／storage／lease等の重複有無 |
| 8 | execution-intelligence | なし | record／store／projection／evaluationの所有状態と導出可能性 |
| 9 | checker | checker.ts | Rule・検査・診断。package exports未定義とRoot公開入口の実Consumer |
| 10 | semantic-coverage | なし | 意味・コンパイル・coverage・migration。`bundle`は名前だけで旧Candidate Storeと同一視しない |
| 11 | verification-runner | verification-runner.ts | catalog／regression、実行・分類・結果取得の責務 |
| 12 | artifact-signing | なし | 署名ライブラリの公開範囲、正式配布専用責務。通常Runtimeへ再導入しない |
| 13 | official-asset-governance | なし | 公式素材の管理判断と署名Packageとの境界 |
| 14 | visual-preview | visual-preview.ts | Preview起動とbrowserの検証用途、通常製品との境界 |
| 15 | platform-access | なし | TS公開入口とprivate Rust、filesystem／process／Docker Desktop技術境界 |
| 16 | mcp-server | なし | MCP Protocolと専門API。配布CLI入口`template/tools/crdd-mcp-server.ts`の実接続を照合 |
| 17 | workbench-server | workbench-server.ts | HTTP／CSRと専門API、connection／management等。MCP依存を復活させない |

Package個別の順序を基本としつつ、Coordinator／Orchestrator／Docker Isolation／Version Control、Checker／Semantic Coverage／Runner、署名／公式素材、MCP／Workbenchの各境界は横断して照合する。フォルダ名だけから責務逸脱・デッドコード・削除可能を確定しない。

#### Packageごとの作業と完了条件

1. 基準Capability・公開API・bin／配布入口・依存・全Consumer・既存試験と過去Evidenceの成立範囲を対応付ける。
2. 不要処理の削除・既存Owner／標準機能への委譲、過剰分割の統合を先に評価する。名称変更だけで完了しない。
3. 残す処理のBefore／After Treeに主要Fileの責務と公開型・関数を付記し、移動・改名・統合・分割・維持の理由を示す。
4. 実際の責務・状態・操作からSymbol名とHeaderを見直す。通信・永続契約の改名は内部Symbol改名と区別する。
5. Architecture・Source・公開入口・全Consumer・設定／配布・UT対応・IT以降の検証責務を同じ単位で更新する。旧経路を互換中継として残さない。
6. 静的確認、正負例、局所・回帰、公開Symbol集合・非公開漏出・deep import・旧参照と必要な実境界を確認し、固定候補を独立レビューへ渡す。

細分化・汎用化・File削減数は目的にせず、新しいRegistry、Lock、Recovery、監視Process、共通Frameworkを追加しない。実現不能な保証や既存能力の喪失を見つけた場合は、追加実装より前に影響を返す。

#### 助言の責務整理と試験専用API撤去（2026-10-19）

基準は`afd059a6`。変更分類は既存の責務再配置と、利用者が承認したメモリ保存公開APIの撤去。助言の共通振分けを`provider/advice-command.ts`、型・契約値を`provider/advice-contract.ts`、CLI固有処理を既存Codex／Claudeの`execution-plan.ts`へ置いた。新しいProvider別Fileの増設案より、既存計画Ownerへの同居を選ぶ。依存は共通振分け→具象計画→共通契約の一方向とし、内部具象関数はRootへ公開しない。出力抽出は共通Helperと単一結果契約を持つため`provider/advice-result.ts`へ同居する。引数、環境、配布Identity、出力受理集合・拒否順序は変更しない。

`createAiProfileCatalogRegistry`／`AiProfileCatalogRegistry`は本番利用がなく、試験4箇所だけだった。承認に基づき本番API・同型の専用型・本体を削除し、各Package内の試験用Storeへ置き換えた。他Packageの試験への依存や公開test APIは追加しない。Registry単独の専用Caseを1件退役し、CRUD・改訂競合・削除確認・MCPの現在認可・事前取消・保存後応答故障／取消の確認は維持する。通常Filesystem Storeと保存Schemaは不変更。既存の検証義務`RCM-UT-002`等は退役しない。

着手前の独立確認は助言移管・API撤去とも整合。実装後の自己確認ではAI Adapterの静的三軸と全32件、Coordinator／MCP静的確認、助言・結果29件、MCP管理3件、公開入口／Header／QA3件、Symbol Graph16件が成功。試験33→32は上記専用Caseの退役による。最初の制限環境では既存Link試験2件がEPERMになり、許可された実行環境で全32件を再確認した。実体CLI二関数の空白を除く本文は基準と一致し、AST同等性の証明とはしない。独立レビューは実体技術・利用側・直接影響に指摘0、File Headerの旧説明1件（二File）を検出し実責務へ最小是正した。是正後の静的三軸は成功。文書Checkerは現行0、歴史CHG旧参照3,353による全体Exit 1。新しいDocker・Provider成功、全Package完成、正式QA Passは主張しない。

残るAI Adapter内精査は、Provider計画のImage・Seccomp等のOwnerと残る命名・Header・公開集合。②のAI再試行、保持物削除、Docker操作、外部送信は行わない。歴史Evidenceは不変更。今回は局所技術レビューと現行文書・直接影響確認を行い、準拠基準・Releaseの変更を伴わないため全体準拠監査・実E2Eは実施しない。

#### 初回単位の具体的処置

| 編集対象 | 処置と確認 |
|---|---|
| コーディング規約§3.2／§4／§4.3／§8 | CRUD同居、静的config／schemas、分割前の削減検討、実Component限定PascalCase、実態に基づくHeader確認、旧Package列挙を更新。公開入口・Header必須項目は維持 |
| AI Adapter詳細設計 | 現行Treeと目標Treeを区別し、runtime静的5資産のconfig／schemas移動案、共通Providerと固有差・隔離Ownerの照合点を示す |
| 現在の1,600診断 | 新規約による再評価対象。React27件も実Component利用を確認して分類する。規約更新だけで検査接続済み・診断解消とは表示しない |
| 次のSource単位 | ai-adapterの全Source・公開API・資産参照・既存Evidenceの対応表を確定してから実装。単なる5資産移動だけでPackage完成としない |

通常CLIのparseと業務手順が独立する例は分割候補、同じ概念の小規模CRUDは非分割候補、保存と排他の境界が交差する例は同居理由を評価、Consumerや由来が不明な旧処理は削除せず確認待ちとする。規約・設計の整理を、未完了E2E・Browser元原因未確定・正式QA未評価の解消へ換算しない。

#### AI Adapterの最初のSource単位（2026-10-19）

規約・計画は`d9672eb0`でコミット・プッシュした。次の配置変更は同Commitを基準とし、Package全体の完了と区別する。既存Capabilityは[AI Adapterの公開操作](../../../06_Architecture/Details/ai-adapter/01_Architecture.md#71-責務別配置と公開操作)、Qualityは既存`ERB-UT-032`・`ERB-IT-004`等と各試験のLocal Itemを維持する。[先行の固定版結果](workspace-runtime-inventory.md#workspace-fixed-regression)と[検証Tool・文書是正](workspace-runtime-inventory.md#verification-tool-document-closure)は当時の成立範囲に限り、今回の移動後結果へ流用しない。

| 基準の実体 | 現在の実体・主要公開関数 | 処置・保証の確認 |
|---|---|---|
| `src/output/unambiguous-json-document.ts` | `src/provider/json.ts`／`parseUnambiguousJsonDocument` | 共通の構文解析として移動。重複key・escape・BOM・末尾拒否は既存正負例で確認 |
| `src/output/task-envelope.ts` | `src/provider/task-result.ts`／`extractProviderTaskEnvelope` | 搬送解釈と非公開診断の集計として移動。Task採否・Process終了・cleanupは引き取らない |
| `src/output/provider-error.ts` | `src/provider/error.ts`／`classifyProviderNonzeroExit` | 非0終了の分類として移動。対応UTも`tests/unit/provider/error.contract.test.ts`へ移動 |
| `runtime/`のJSON5資産 | `config/`二設定と`schemas/`三Schema | [静的資産の対応](../../../06_Architecture/Details/ai-adapter/01_Architecture.md#source構造レビューの目標と現行の区別2026-10-19)。五Hashは移動前後で完全一致。Docker COPY入力名・Container Path・固定Imageは不変更 |

利用側はRootの明示export、Codex／Claude正規化、Profile認証結果、助言抽出のJSON参照、Coordinatorの資産検査、Checker公開集合、Symbol／Test Catalogの実Pathを追従した。意味ID・公開Symbol・通信値・JSON本文・返却値は変更していない。三SourceはTSDoc・import・空行を除くCode本文の基準比較で一致する。JSON走査のHeaderを構文拒否・部分値と文書全体の区別へ具体化し、非0分類Helperの不足項目を補った。新しい分割層・中継・型集合は追加していない。

Source観測の`config/`・`schemas/`追加は既存Observerへの必要な追従である。範囲構成が内容Hashに含まれるため、旧新のHashを同一扱いせず、旧記録を補正しない。既存の7試験で追加・内容変更・削除・link拒否・上限・二読取り差・対象外不変を確認した。Scope文字列・公開shape・現在認可と回収条件は変更していない。

自己確認では、AI Adapterの静的三軸と全33件、Coordinator静的確認・既存Trace確認、資産／両Provider計画22件、利用側のTask／助言29件、Source観測7件、公開入口・Header・QA接続3件、Symbol Graph16件が成功した。通常制限環境の初回試験では既存link操作2件がEPERMとなったが、同じRepository内合成物だけを用いる実行許可後は基準版・変更版とも33件成功。構成の整形・型の追従漏れも局所修正後に静的確認を再実行した。未完了の全体命名Gate、Browser元失敗、実AI編集E2Eと正式QA評価を、この局所結果でPassにしない。

独立した技術・限定文書／影響確認では軽微2件（分類順のHeader表現、Coordinator詳細の観測対象列挙）を是正し、限定再レビューの残指摘0件を確認した。Repository Checkerは現行0、歴史CHG旧参照3,353で全体Exit 1を維持する。過去Evidenceを編集せず、結果の大きな複製書庫も追加していない。

残るPackage内の精査は`advice/`の用途・Provider固有CLI分岐、Profile／Catalog／保存と契約属性、Codex／Claude計画中のImage・Seccomp等のOwner、Symbol／変数名・Headerと公開集合である。`advice/`を丸ごと改名するだけの処置は保留し、実責務とConsumerを先に確認する。②のAI再試行・保持物削除・実Docker操作・Image取得／更新は実施していない。

#### ProfileとProviderの責務配置（2026-10-19）

初回移管は`14ef13ce`でコミット・プッシュした。次の単位では、Profileの設定・選定と、Providerの実行条件の純粋判定を区別する。新しい観測・認証・実行許可は追加しない。

| 旧実体 | 現在の実体 | 判断理由・維持する条件 |
|---|---|---|
| `profile/model.ts` | `profile/resolve.ts` | 実態はModel本体でなくCatalogからの一意選定。明示Profile、Family／Role／Tier、拒否・fallbackなしを維持 |
| `profile/administration.ts` | `profile/crud.ts` | 同じProfileの登録・更新・削除と入力／結果検査。改訂競合・削除確認・既存Adapter限定・採用最大一回を分散しない |
| `profile/environment.ts` | `provider/environment.ts` | Profile設定でなく固定CLI環境の検査。禁止名、取得一回、順序と例外伝播を維持 |
| `profile/subscription-status.ts` | `provider/subscription-status.ts` | 認証Probe出力の分類。Offering相関、Codexのexact文言／既知Warning、Claudeの五条件を維持 |
| `profile/eligibility.ts` | `provider/availability.ts` | Provider観測の五軸評価。理由優先順、unknown拒否と直前確認候補の区別を維持 |

`ObservationState`／`ProviderObservation`は一Fileだけの利用だったため、新しい共通型Fileを作らず、`availability.ts`の非公開型へ同居させた。前者は非公開の`ProviderObservationState`とし、状態値は不変更。`profile/types.ts`は複数Consumerで使う既存Profile実行Identityへ限定する。認証・課金方針はProfile契約属性として維持し、Process内の同期Snapshot RegistryとFilesystem Storeは変更理由・Effect・失敗境界が異なるため統合しない。

公開入口のSymbol集合・通信値・保存shape・意味IDは維持し、実体Path、Checker期待公開集合、Symbol実Pathを同期した。Coordinatorと対応試験のCatalog型deep import四箇所は、既に公開済みのRoot型へ接続した。AI Adapterの利用側結合試験も自PackageとWorkbenchの公開入口を使い、新しい公開型・中継は追加していない。過去の旧CROS比較文書は現行仕様でなく歴史的比較として維持する。

自己確認はAI Adapter静的三軸・全33件、Coordinator／MCP静的確認、Profile選定・五軸評価・環境搬送・助言利用側35件、MCP管理3件、公開入口／Header／QA3件、Symbol Graph16件が成功した。移動五Sourceの型除去後Codeは、import・TSDoc・空白を除く基準テキスト比較で一致し、AST同等性や全体完成の証明とはしない。Profile型の局所化とHeader具体化以外に操作本体を変更していない。

完成後の独立技術・限定文書／影響確認は指摘0件。Repository Checkerは現行0・歴史CHG旧参照3,353によるExit 1を維持する。追加読取りではProcess内Registryの呼出しはAI Adapter／MCPの試験4箇所だけで、本番Consumerは見つかっていない。今回の配置変更では公開能力を削除せず維持するが、存続の必要性を確定したとは扱わず、残る不要機能評価で公開契約と試験用代替を照合する。

助言のProvider固有CLI／出力処理、Provider計画の固定Image・Seccomp等、残る命名・Headerと公開集合の精査は継続対象であり、AI Adapter全体完了ではない。②の再実行・保持物削除・実Docker・外部AIの依頼は行わない。

新方針の現物差分と最初の実装（2026-10-17）: [差分・実装順序](workspace-runtime-inventory.md#10-新方針と既存実装の差分実装順序2026-10-17)を整理した。既存DIに`.env`別maskはなく追加不要、明示コピー防止のsecret検出は一括撤去しない。VCのTree／差分二Adapterを共通の有限Git読取りへ接続し、是正後の静的三軸と全50件成功。続いてWorktree作成・観測・明示終了時の専用Worktree／Branch削除を実装した。filter利用・gitlink作成は未対応として拒否し、独自の変換・管理台帳・State・Lockを追加しない。[実装と実Git試験](workspace-runtime-inventory.md#git-worktree管理の部分実装と実git試験)に現在結果・部分成立・制約を集約する。上位Task／採否の本番接続・Merge・Direct切替・旧Bundle撤去は後続で、今回を全体完成としない。

開発情報・共通隔離方針の採用（2026-10-17）: 人間はローカル開発用`.env`がCoding AIから読まれ得るリスク、本番SecretのGit／通常開発環境外での既存管理、開発資格の本番権限なし・限定権限・有効期限、Direct／Candidate共通DI方針を採用した。[DI正本](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#workspace-isolation-policy)と[判断差分](workspace-runtime-inventory.md#9-開発情報と共通隔離方針の変更2026-10-17)へ反映する。独自Secret Manager・file別ACL・動的Mount許可Frameworkは作らない。以前の隠蔽試験は当時の反例として保持し、新方針の不合格へ流用しない。Git／内部状態書込み・認証領域等の境界は維持する。Source共通化・Cloud権限の実確認は未実施で、今回は文書伝播だけ。

Direct限定実証の結果（2026-10-17）: 人間承認後、[棚卸し§8の結果](workspace-runtime-inventory.md#承認済み一回の実証結果と終了2026-10-17)の固定Image・合成Directory型一件を実行した。通常編集と固定Path保護の11項目後、hardlink別名から元dummy内容を読めたためFailで停止。これはGit書込み成功の実測ではなく、別名経由の書込み・秘密保護は未実証。二件目と後続刺激はNot Run、追加試験なし。Host保護対象不変・Container0・専用Root不存在を確認し、清掃で元Failを成功化しない。製品Sourceは不変更、Direct本実装は未着手。次は既存link／実体検査の再利用可能性を読取り評価し、新しい機構や試験を自動追加しない。

Direct最小構成の実証計画（2026-10-17）: [棚卸し§8](workspace-runtime-inventory.md#8-directの最小mount案と限定実証計画未実装未実行)へ、現在TreeのRW共有と保護対象だけの空readonly Mount、合成物による正常対照・別経路・親差替え・Host不変・終了後確認を整理した。固定maskは未知秘密・実行中の新規秘密を包括せず、Direct全体の保護成立は未主張。既存Imageとexact試験Rootを固定し、別途実行許可を得るまで試験器作成・実Docker・Source本実装を行わない。

Direct／Candidate方針訂正の現物照合（2026-10-17）: 人間は現在Treeと同一ファイルdirtyをDirectのInputにし、allowedPathsを指示・事後検証だけへ限定した。共有Gitの更新はVC、Candidateは固定Baseのclean Worktree、自動Commit／Promotion／Stash／Reset／Clean／Rollbackなしを採用した。[照合・変更／撤去候補・保証不足・代替案](workspace-runtime-inventory.md#7-directcandidateの簡素化方針と現物の再照合2026-10-17)を整理した。既存DIは単一作業Root bindで保護Pathの除外がなく、新Directの基本保護は未成立。Git読取りのtextconv等も未接続。複雑な機構を先に足さず、最小構成の成立確認計画を提示してから判断する。今回はSource・実データ・実Mount・Git書込みを変更／実行しない。下段のDirect／dirty一般方針の人間確認待ちはこの判断で解消し、技術構成・具体API等の未決と区別する。

Workspace設計伝播の確認結果（2026-10-17）: 文書／ArchitectureとGap影響／Qualityの固定候補確認を一つの監査集合として実施し、全結果後に3指摘を統合した。ARCH-000015の旧Owner説明と目標の衝突、現在品質集合197／198の不一致、Merge後分析・資料保存のQA導出欠落を、両確認者との事前照合後に是正した。対象再レビューは両者残指摘0。構造Checkerは既知3341 errors／0 warningsから増分0、既存Runtime／Orchestrator Trace検査はaccepted、Semantic Registry二文書Hash一致、Local Item全数再計数198。新方式の試験結果ではなく設計伝播と参照整合の確認であり、実装／移行／新方式の実測は未実施。Direct AI書込み・共有Git許可・Commit時点／dirty・API／Schemaの未決が該当実装前の停止条件であることを維持する。

Workspace契約のArchitecture／Quality反映（2026-10-17）: 人間指示により[OrchestratorのWorkspace横断契約](../../../06_Architecture/Details/orchestrator/03_Workspace.md)を新設し、中央モデル・責務定義・担当Package詳細へ伝播する。QualityはARCH分析→統合→既存QA-000003／005／006／007／008の方式別追加条件と新実Git項目RFD-IT-029へ接続する。新設はQA-IDでなくLocal Item一件で、設計集合13定義・198項目、新方式結果は全件Not Run。旧Candidateの正本Effect 0・採用時Commit／Push 0を新Git操作へ機械的に流用せず、コード候補・Direct編集・固定・取込とContext提案を分ける。今回の変更分類は複数正本・Package・Qualityへ及ぶ設計伝播で、着手前の契約・品質確認により意味の衝突を整理した。完成時は文書／不足影響の独立確認と差分・リンク・構造Checkerを実施する。準拠基準や公開Release判断を変えないため準拠監査は実施しない。Source・実データ・Ref・Docker・外部AIは変更／実行しない。Direct AI書込み・共有Git許可・Commit時点・dirty・API／Schema・実移行は該当実装前の停止条件として保持する。旧形式はフロントAIの確認・保全・清掃で切り替え、新Runtimeへ互換Readerを追加しない。

次の再編範囲（2026-10-17）: 人間はCandidateをWorkspace方式へ変更する方針を提示し、まず現行保存先・能力・利用側・Queue／排他の棚卸しと対応表作成を指示した。[Workspace方式の棚卸しと移管対応](workspace-runtime-inventory.md)へ現物根拠、移管先候補、撤去条件、既存試験、必要な新検証、未決事項を整理する。新設WorkspaceはDirect／Isolatedの継続作業領域であり、既存の閲覧範囲や短命実行領域のworkspace表記は意味別の改名対象とする。今回は計画更新だけで、Source・Schema・実保存データ・Dockerは変更しない。次はArchitecture／Qualityの契約具体化であり、旧Candidate Storeを先に撤去しない。

Docker Isolation完成照合（2026-10-17）: §5の静的検査、移管先回帰、本番Consumer結合、実Docker局所確認、固定候補の契約・品質独立レビューを確認し、本Packageの実装・検証を完了した。Docker技術処理は下位Root APIへ接続し、上位は既存の実行許可・正本保存・Task判断・通知伝播を所有する。旧CoordinatorのDocker両Folderとruntime、通常実行のCRDD署名前提は撤去済み。新State・Registry・Lock・Recovery Frameworkは追加していない。実Provider全E2E、後続Coordinator／Orchestrator再編、全197義務の正式再評価、全体Checkerの既知不合格は別の残件であり、本完了をv0.22全体完成・Release判断にしない。

最終回帰と試験結合是正: 同じ通常回帰は1,926件、1,912成功・9失敗・対象外5・取消0、988207.9211ms、exit1で終了した。全失敗は`docker-restart-preparation-order.contract.test.ts`の自己完結したVMに新しい本番predicateが未接続だった同一原因である。全結果確定後、このFileのimportと既存JSON同Realm結合7行だけを追加し、本番Source・共通fixture・設定・Oracleは変更していない。同File全24件は24成功・失敗0（578.448ms）、現静的全段階はexit0、lint54情報・警告0。修正前SHA-256 `c0e1775cd11864af3fc61b3a0f5616b6a7da14bc714bf14fc5ef04c06541a04e`、修正後`ddfb9938e53ddc8df19ab1e841b0f26a269c9867c8f33a1ec133e9ce2901ce18`、両固定候補レビュー指摘0。他試験のConsumerや共有変更はなく、独立確認した比例的回帰範囲に従い、当該Fileの旧15成功・9失敗を新24成功へ対応付けた。現行評価は1,921成功・対象外5・未解消失敗0であり、元全回帰Failを保持する。単一run全件成功とは表示せず、同じ全母集団の機械的再実行は行わない。

終了後確認: 公開CLI専用試験Rootは非使用・非reparse・exact範囲の確認後に回収し、不存在を確認済み。親喪失の元Taskはblockedのまま保持し、回収成功をTask成功へ変更していない。通常RepositoryのCoordinator現在状態は操作0・未解決0・配送0で、今回の実測を実行別Evidence書庫へ複製しない。現在追加の人間判断は不要。完了内容をコミット・プッシュし、統合・タグ・リリースは行わない。

以下は完成照合前の各時点の経過である。現在の判定は上記の完成照合・最終回帰・終了後確認に従う。各段落の「現在」「実行中」「未完了」は記録当時の状態を示す。

先行Coordinator通常全回帰の停止と局所切分け: 起動済みの同じ回帰はexit1で終了し、回復CLIの理由不一致二件を検出した。該当Fileを単独実行して11成功／2失敗を再現した。署名拒否時代のSourceコピーfixtureにGit境界がなく、`git rev-parse`が本体CRDDを返すことを実測したため、製品Sourceや期待理由を変えず、当該invokeCliだけに自己Git境界・公開marker一件・local identity／署名とhook無効のcommit・exact Root確認を追加した。本体stateの存在／Hashもfinallyで前後不変を確認する。既存のpreparation拒否・exit2・exact ID・清掃fieldを維持して13/13成功（7899.2021ms）。初回整形はWindowsのmapped sectionエラー1224で停止し、試験終了後の再整形と全静的検査は成功。修正は試験だけで、本番Source・共通fixture・実Docker・認証を変更していない。通常全回帰の合格はまだ未確定であり、元失敗を成功へ合算しない。

完成監査の検査更新: DIの既存Host Windows実Process profileは7/7成功（4166.1261ms）。通常337件とは別の観測として、実子孫終端・出力上限・spawn失敗・Native読取り専用終了を確認した。現在文書7Pathの独立レビューは、旧anchor保持と現在状態2文の同期を統合是正し、両再レビュー残指摘0。続く計画からの旧anchor1箇所も同じ明示保持で直し、両限定確認指摘0。最終Checkerはerror3341／warning0（Changes内3321、その他は既知IA／UI／SPEC20）、DI関連0で、今回のリンク増分は解消した。17 Manifest・774 Symbolの重複ID／所在欠落／未定義verifiesは0。Coordinatorの現静的全段階はexit0、既存lint情報54・警告0。最新通常全回帰は同じ起動済みProcessを継続観測し、観測待ちを理由に再起動していない。

完成監査Source二件の固定候補確認: 契約観点は指摘0、品質観点のP2一件は新Using／旧公開名のRoot非公開を直接反証するOracle不足だった。両者へ方針を照合し、既存の非公開一覧へ二名だけ追加した。Sourceは不変更、同File3/3成功（221.8733ms）、最終SHA-256 `38bb31388497bf57f8a7a1be325f9e613c6a358eaa48f1547e76148e46e00496`、両限定再レビューは残指摘0。最新Coordinator通常全回帰は既存portable profileで実行中であり、先行版の1,916成功を今回結果に流用しない。

030試験物の終了後確認: 最終history JSONLは3行／SHA-256 `007294b4174808236efedaa00d88610fe4d9fd9342dba48b52203b2704eb470c`。取消一件と親喪失の両元IDを保持し、後二件の元実行結果はblockedのままで、回収成功をTask成功へ変更していない。合成markerは`CRDD_PUBLIC_TASK_BASE`、追跡File3件と差分0。専用Root内は50File／23Directory、reparse0・使用Process0で、現在Coordinator領域は終了済みstate／historyだけだった。必要な測定と限界は本計画へ記録し、元ログを実行別Evidence書庫へ移さず、承認済み自己生成試験Rootの回収対象とする。

現在の完成監査（2026-10-17）: 030親喪失で残ったClaude元IDも通常doctorで`docker_task_recovery_completed`／exit0となり、Docker・Host清掃、全排他解放、履歴・操作除去を確認した。正式Readerはrevision72、操作0・未解決0・配送0、lockReleased=true、本文Hash `2a14bde65ee41d34298cb1c7b1d0e77ec307e52abb0d3f973466cbc29323ac12`。実Docker一覧に今回のContainer／Networkはなく、合成Repositoryの追跡差分も0。親喪失はexecutor完了後のreviewer準備中であり、executor実行中や公開結果JSONの成功を主張しない。直前の限定Sourceは実Windows隣接42/42成功（300302.5386ms）、静的全段階成功、両独立レビュー残指摘0である。

同完成監査の未達を2件へ統合した。再認証のCLI／環境／System32組立てを既存DI認証Fileの固定Factoryへ移し、Coordinatorは技術planだけを渡す。Factoryは従来のdependencies生成冒頭で一回呼び、初回失敗時点・元snapshotの寿命と各execute前の再検証を維持する。低位UsingはRoot非公開・内部試験限定。もう1件は上位汎用環境の旧Docker二profileを撤去し、native／supervisorを維持する。両観点へ統合方針を照合済みで、新State・Lock・Registry・認証方式・Frameworkは追加しない。移管後DI337/337成功（34682.3771ms）、静的三軸成功。認証隣接は初回29/30で、旧試験が通常9操作だけを期待し、実際の旧資源回収・事後回収30操作の保存を数えていないことを実Windowsでも確認した。Sourceの保存を減らさず、全39操作の固定順序と78遷移へOracleを追従し30/30成功（1760.0893ms）。Source限定レビューは完了。現版Coordinator全回帰、現在文書・台帳の同期と完成照合は残っている。

今回のWSL保守削除と正式終了（2026-10-17）: 人間がLinux／WSL側から今回のexact退避Rootだけを安全確認後削除すると許可した。停止中のdocker-desktopを通常起動し、固定`/mnt/host/c/Users/nakas/AppData/Local/Docker/run.crdd-stale-e606e088c571e2caf3c4fd55f75170c3`を読取り照合した。WindowsではAF_UNIXの四entryが、WSLでは通常空fileとして観測された。両者の型・Identity単位を混用せず、Windowsの元親／旧Root／現在run実体と現在state、WSLのexact realpath・非link・同device内の別実体・隠し項目を含む直下exact四名・全件0byteを確認。再帰／forceを使わず四固定Pathだけを順次unlinkし、各境界で同一sh内の親／旧Root／現在run実体を再確認、空Rootだけをrmdirした。親の成功列挙で旧Root不在、Windows NodeとNativeの明示不存在、親／現在runの元Identity維持とEngine readyを確認した。他退避物・認証情報・Image／Container／Volumeは未変更。初回realpathの非対応`-e`と、事前比較二回のWSL device跨ぎ固定／親inode単位混用は処置前停止・rm0として保持し、実測済みWSL値と同sh内比較へ訂正した。権限変更・追加Docker再起動・Provider依頼はない。

同ID終了の限定是正: 保守削除後の正式再入場はprimary／failedの不存在を保存したが、未作成auxiliaryの確認で停止した。補助targetはNode／Native不存在なのに、その手前で別Pathの現在sourceのcanonical成立を要求していた。現在sourceのrealpathがCodexのPackage LocalCache配下へ解決されることを観測したが、一般的なPath仮想化対応は追加しない。DIは、固定targetのNative明示不存在＋Node ENOENT時だけ、親のNode／Native実体・現在Ownerの前後確認で現在不存在を返す限定経路へ修正した。存在targetのsource正規化・非alias・処置前後保護条件は不変更。関連4/4（203.3063ms）、上位結果26/26（3833.6386ms）、Owner no-op1/1（518.0787ms）、DI全336/336（32682.0227ms）と静的三軸が成功。固定Source SHA-256 `1a9b0ed3842f4bd504a448532271830537e89a976a116543f0a0b91b504dfc0e`、試験`adf58b56566180953e9b450905cb7ca6f791f4719dd27da289da1f17f4601068`。契約／品質の独立確認は、表分断P3一件を段落移動のみで是正し、最終残指摘0。独立試験各2/2（185.4427ms／174.6236ms）。新State・Lock・Framework・Schema・署名依存は追加しない。

修正版の同じexact回復IDでの正式再入場はexit0・`runtime_repair_recovered`。履歴・完了・Native／CLI清掃が全confirmedとなり、正式Readerの再読もcompleted／Lock解放・現在操作0／未解決0／配送0。履歴1行SHA-256 `b3df76bd630ca5bdba0043c5aa733ef932ce91a0e46d29727d0cb9b9af98480b`。これは「人間承認のWSL保守削除後、製品の正式処理で現在不存在と終了を確定」であり、Windows自動disposal成功・WSL汎用fallback実装・四endpointのNative実体観測・Windows根本原因確定ではない。009の今回実退避／起動／保守処置／正式終了の観測へ接続し、030・実Provider全E2E・DI全体完成は別に残す。

Windows削除拒否の追加診断（2026-10-17）: Docker Desktopは4.93.0.240920、Windowsは26200.9711、afunix.sysは10.0.26100.8972。afunixはRUNNING／SYSTEM_STARTで、版数差だけを原因にしない。今回のexact退避Rootは現在ユーザー所有・同ユーザーFullControlだが、leaf ACLの読取りもError1920であり、leaf固有ACLや残存handleは完全排除できない。既存ignored診断へexact Pathの`FindFirstFileW`と`FindClose`を追加し、Hostで1/1完走。四leaf全てattrs1056・tag=`0x80000023`（AF_UNIX endpoint）を観測した。同じ四leafの非追従CreateFileWはaccess128／0の両方でopen段階1920、通常Rootの正対照はopen・basic・tag・close成功。検索handleも全close成功。生内容・接続・削除・ACL変更はなく、検索tagをNative実体確認・削除Authorityの代用にしない。

Dockerログの固定分類では、16:40:44 JSTにrun内四socketとsecrets、16:58:13にsecretsについて`moved ... aside`／`could not be cleared`を確認した。該当時間窓のSystemログにNtfs／disk／FilterManagerの該当記録はなかったが、正常性証明にはしない。初回の単純文字列1920分類4件は数値部分一致を区別していないためエラー件数に採用せず、時刻・固定句の分類を使用する。[Docker Issue #676](https://github.com/docker/desktop-feedback/issues/676)の9月30日コメントでは同4.93・同四socketについてWindows削除不能とLinux側unlink成功が報告され、10月7日のDocker側コメントは4.92での起動回避策を述べている。これは今回の原因確定やLinux削除の実証ではない。

診断結論は、退避先のAF_UNIX endpointに対するWindowsのopen／ACL取得／削除境界での異常が最有力。通常Root権限不足を示す根拠はなく、CRDD独自の許可判定だけで止まる現象でもない。一方、特定kernel／driver／filter、残存handle、破損の有無、CRDDとの因果は未特定とする。契約／品質の独立読取りでもこの限定結論へ整合し、権限変更・再起動・削除方法の総当たりを正当化しない。WSL一覧ではdocker-desktopがStoppedだったため、起動を伴うLinux側読取り／削除は未実行。Rust整形・差分検査は成功した。製品Source・保存遷移は不変更で、009全体完成・退避物清掃完了へ換算しない。

今回の退避Root削除の調査・実行（2026-10-17）: 人間は「今回の退避フォルダを丸ごと安全に削除できるか調べ、問題なければ削除して進める」と許可した。対象は以下の009で作ったexact Root一件だけ。親／旧Root／現在runのNode実体とcanonical Path、保存済み回復ID・旧Root実体・settling／discard、直下exact四名・全て非Directoryのreparse entry、退避前Docker Process不存在・同Rootを処置するNode／Native Process不存在を直前確認した。契約／品質の読取り確認では、非追従の削除意味と単独保守条件に限り妥当とし、Path確認と削除の原子性や敵対的差替え耐性を一般保証しないとした。[Microsoft Directory.Delete仕様](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.delete?view=net-10.0)はreparse point先へ再帰しない。製品の自動削除条件は不変更。

最初の保守preflightはPowerShellのUTC／Local DateTime比較の誤判定で削除要求前に停止した。両辺をUTCへ揃え、同じ全preflight後に`System.IO.Directory.Delete(exactRoot, true)`を一回発行したが、最初の`dockerEthernetVfkit`で「ファイルにアクセスできません」と例外終了した。削除後観測でも旧Rootの元Identityと四entryすべてが残り、現在runのIdentityは元のまま、Engineはready／観測子清掃confirmedだった。これはNative openのError1920と別の実削除失敗観測であり、削除のWin32数値を推測しない。ACL変更・個別socket削除・別コマンドfallback・追加再起動・回復記録の手編集・正式再入場の反復は行っていない。物理削除は未完了。人間の今回許可を期限付き保持への切替や新しい保存遷移の採用へ読み替えず、従前の限定保持案も未採用のままとする。

実Host退避の現在結果（2026-10-17）: 人間は009と030を「今確認する」と判断した。009で公式Desktop pluginの正常停止を確認後、正式CLIの`doctor --repair-docker-desktop-runtime --json`を一回実行した。primary退避と新Runtime起動、Engine ready、Native／CLI清掃は確認できたが、退避物の自動破棄前観測で停止し、exit1・`runtime_repair_state_unavailable`となった。exact回復IDは`docker-runtime-repair.a8daa5ccf50967dc18f3e52a04756104a05799eb38822fe7f591d518522022b8.f67ed840223ebfbca22ece2e4f86ce8576f35173a6663c99d6efccaaf2f43757`。正式Readerでphase=`settling`、disposition=`discard`、outcome=`recovered`、Primary null、破棄intent保存済み／削除要求未発行／不存在unknown、履歴・完了未確定を確認した。技術的な起動成功と処理全体の完了を区別し、009全体Passとはしない。

同試行の読取り専用原因確認: exact対象は`C:\Users\nakas\AppData\Local\Docker\run.crdd-stale-e606e088c571e2caf3c4fd55f75170c3`。元DirectoryのNative実体はvolume=`1687905628`、index=`160722211703614430`、creationTime=`134366964440628066`で一致し、新しい`run`とは別実体だった。直下の`dockerEthernetVfkit`／`dockerInference`／`sailor-ingest.sock`／`userAnalyticsOtlpHttp.sock`は属性Archive・ReparsePointだが、非追従Native観測でopen不能。`platform-access/tests/cli.rs`の明示Root限定ignored診断はHostで1/1成功し、4entryすべてCreateFileW段階のWindows Error1920、属性読取り権限とaccess0の両方で同じ結果だった。陽性対照のDirectoryは両権限でopen・基本情報・tag・close成功。これは失敗段階の特定であり、4entryのAF_UNIX tag・削除安全性・故障原因の証明ではない。初回制限環境ではLOCALAPPDATAのsandbox差をRoot検証が拒否し、対象open前に停止した。追加再起動・削除・ACL変更・回復記録書換え・Provider依頼は行っていない。030は未実行で、現在の修復Operationを閉じる経路の評価が先行する。

公式配置Imageの実確認（2026-10-17）: Host試験File SHA-256 `3558edf60bdb665ddf27eec0b555b57542f31c95b2adb19c5fbba3eaae5a61c3`の承認済み一回が1/1成功（12175.801ms、Case11937.1997ms）。固定実Image `sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e`の通常entrypoint版表示は公式0.159.2。同じ実Imageの別ContainerでCLI／Host／bwrapの実byte HashがAI Adapter固定三値へ一致した。二Containerを順次作成し、実構成のnone・非root・read-only・cap-drop・no-new-privileges・Mountなし、Image既定entrypoint／User／Workdirを照合し、各元IDの回収・三Filter不存在・専用Root清掃後だけcompletedを出した。別読取りでRoot残存0・元の停止Container一件のみ維持を確認。Warningは版表示に`WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)`と末尾LF一件、Hash側は空で、元のまま保存する。認証・AI依頼・Image取得／更新・Docker再起動・既存データ削除なし。通常Oracleと実Sourceの失敗三形は2/2（299.4143ms）、固定候補の契約／品質再レビュー指摘0、独立各2/2（300.0838ms／329.7026ms）。初回型・整形制限・VM抽出の試験不具合、cleanupのみを一次へ複製した試験器P2は是正前結果として維持する。現Dockerfile Hashは既存固定`92bc2fc6498fee09f745b1710fdb7ada7f868ef06b44d27499d6f6343407e29a`に一致するが、今回の実測は再Build・公式取得元再検証・Host機能・助言結果の成功ではない。正式義務の全体評価と他の実境界は別に確認する。

最新の認証作成結果不明・限定終了の実測（2026-10-17）: 診断付き試験器SHA-256 `ea98b75132f847c83007c828c8e84e29c7b6132ccef7e9de3472e4abf558e9a7`で、承認済み新品一回を実行しexit0・completedとなった。exact回復IDは`docker-task.15c4127edc004ec12bf2cf4f750c94e1954a04fa53eaea356cf3c32f3fdc2760.2206d000613178fc1ee68b814c454e6fc88b7f6c3fcf3fdcb8b4193decf5db0e.d1c64466af8a8c1d4f103fd4f60626fb98659a64565e57c83344b89af49e931d`。`absent_auth`で再起動1回、準備用のexact試験Container回収1回、限定不存在観測2回・終了保存1回、最終不存在sample2回、正式回収・Host清掃・Lock解放・履歴・現在操作除去・専用Root清掃まで全assertが成立した。製品側の既存資源発見回収／削除は0回。終了後の別読取りもRoot不存在・Engine29.8.1・元の停止Container一件のみ維持を確認した。外部AI依頼・認証情報・既存永続データ削除・追加試行なし。承認は消費済み。これはProvider起動前の認証create結果不明という限定Classの実証であり、汎用unknown終了、Provider実行、退避二領域の実修復、取消・親喪失やDI全体完成ではない。前の起動未確認Failとその原因未確定は保持する。

上記実測の独立照合: 契約／品質とも出力と実assertの対応に指摘0。unknownは実create／inspectの正対照後に試験準備が実Writerへ保存した切断状態であり、自然発生した通信障害や本番Controllerのunknown自動保存を実証しない。不存在も準備回収で作り、製品回復中の追加削除0と区別する。標準bridgeは構成同一を条件に既定二地点のID再捕捉を許し、全Network ID不変とは主張しない。実測の成功から前回の起動未確認原因を確定しない。

既知失敗終了後の回帰: 通常Host全回帰は1,921件中1,916成功・失敗0・取消0・対象外5、1074668.936ms、exit0で終了した（開始2026-10-17T07:12:39.164Z、終了07:30:33.780Z）。同じ実行を中断・再実行せず、固定Sourceで完走した。別実行の`Coordinator現在状態の保存とpending再入場`も1/1成功（238958.7205ms、失敗・取消・skip0）。実保存・履歴・配送・pending再入場を含む回帰結果であり、実Docker／Provider成功やDI全体完成へ換算しない。元の限定実試験Failと実境界三群の未確認は維持する。

起動未確認の切分け: `start_unconfirmed`かつ`effectOutcomeUnknown=false`は、現在の単一stop→start経路ではlaunch要求前の再確認拒否または評価中例外を示す。起動待ちTimeoutの根拠ではなく、`request=issued`は先行stop受付でも成立する。旧実測には停止位置がないため、全回帰終了後に固定`startFailure`診断を追加した。既存の確認順・回数・短絡・期限・要求・Effect・清掃・Primaryを維持し、Runtime結果とsettled通知→上位→手動試験器へ搬送する。耐久checkpointのSchemaは変更しない。六確認のfalse／throwとリセット、最終liveのfalse／throw、launch拒否、Ready信頼拒否、期限のOracleを確認した。関連90/90（171.1611ms）、上位・試験器28/28（747.8031ms）、DI通常全336/336（32002.1706ms）、両check成功。初回の制限環境27/28は既存junction EPERM、Lint七警告と整形一回のOS1224は是正前結果として保持する。契約／品質の独立再レビューは残指摘0・限定Pass、独立90/90各175.4558ms／197.2385ms。新観測・待機延長・再試行・Recovery追加・実Docker操作はない。診断追加前の全回帰を追加後の全体成功へ流用せず、元の実試験Failと実境界未確認を維持する。

今回試験物の終了・清掃確認: 回復ID `docker-task.03960d838267dcf88ea396db74bfaea7ed16d1e320b01abf2c71772d2235e3d6.7d91793b9ab16808c4b8dc4276b8c4773769649051126d4323dd6119770a22aa.4743924c5a836b49d9528b4c091476645541b842cf972ca297d8196eab57a7db` の正式APIで資源清掃・Host清掃・Lock解放・履歴出版・操作除去を確認した。実Readerが混在する通常v2／再起動記録v3の履歴2行を受理し、v3の元`docker_restart_start_unconfirmed`・issued・blocked・Effect不明false・Primary null・Task blockedを保持した。現在操作／未解決／配送0、二走査47entry一致、履歴SHA-256 `1af9dc52332ed4b913ba77f7cfbee6e070c27ff44740e49f8b52a48678f41030`。非使用・exact Root・非reparse確認後に専用Rootを削除し不存在確認済み。既存停止Container一件を維持し、追加再起動・再試験はない。この結果は既知失敗からの正式終了であり、当初のunknown限定終了や再起動成功ではない。

最新の限定実試験と既知失敗終了（2026-10-17）: 試験器SHA-256 `e9ad08964e4bf6cbe710098661da06606a802db7a7494ea7bea75f88eb40676d`で承認一回を実行。bridge比較は通過したが、再起動処理一回が`docker_restart_start_unconfirmed`でblocked。停止段階通過・起動未確認、request issued、cleanup confirmed、result blocked／request issued／effectOutcomeUnknown falseを保存した。追加試験・再起動なし。人間の別承認で通常起動しEngine応答を確認後、同じexact IDで実Docker／Host回収・Lock解放まで成立したが、終端predicateが既知失敗も拒否して履歴を確定できなかった。

是正は共通predicateの既知失敗一形に限定し、Task資源終端・Owner退役・Host不存在の既存条件とunknown限定終了の再起動completed条件を維持した。再起動記録ありの終了要約v3へ既存非秘密checkpointを必須保存し、再起動なし通常v2 bytes・結果IDを不変更とする。元のPrimary／outcomeへ再起動失敗を上書きせず、固定済みv2履歴・ACKを新版Hashへ再結合しない。UT10/10（757.7889ms）、repair Model込み先行30/30（2058.3944ms）、実Writer／Host／履歴／操作除去2/2（84641.6618ms）が成功。契約／品質の固定候補独立レビューは全重大度残指摘0、独立UT各10/10（668.1826ms／675.1314ms）。実WriterのDI再起動結果は合成で実再起動成功ではない。今回の残存操作が要約・履歴未固定であることを確認し、同じ正式APIで終了処理中。元の実試験Failは成功へ変更しない。

初回Producer後の比較是正（2026-10-17）: daemon初期化の一次ログと契約／品質の着手前照合を基に、手動fixtureの既存正対照・exact保存確認直後の一地点だけで標準bridge IDを再捕捉する。Id／Created以外の全構成一致・一意性・未使用・実ID inspectを維持し、ID不変でも一回枠を消費する。既存再起動後の一回枠と独立し、以後は各新IDへ固定する。他資源比較・削除Authority・本番Recovery・新Effect・待機・再試行は不変更。初回前／証拠失敗／枠の早期使用・反復／捕捉後ID差／構成差／独自Network差を反証し、通常Host12/12（810.7344ms）成功。追加変異の固定本文出現数期待の初回11/12は訂正前結果として保持する。契約／品質の独立レビューは全重大度残指摘0、独立の局所VM契約1/1（全体405.2384ms）と2/2（369.7252ms）が成功。静的三軸・両Traceも成功。人間が別途承認した修正版の新品一回・再起動最大一回を試験器SHA-256 `e9ad08964e4bf6cbe710098661da06606a802db7a7494ea7bea75f88eb40676d`で実行中。過去の実測Failは維持し、この局所結果を実Docker成功へ換算しない。

最新固定候補の実行結果（2026-10-17）: Coordinator通常Host全回帰は1,921件中1,916成功・失敗0・取消0・対象外5、791017.1284ms、exit0で終了した。開始06:34:34.715Z、終了06:47:45.705Z。先行失敗を消さず、この改訂版の結果として扱う。実Docker／Provider全体の成功ではない。

続く承認済み新品一回の限定試験は不合格。試験器SHA-256 `53682fb6abef305e35307613f330c23549bb059b456b645ba77cfcb331a9af6a`、`stage=restart`、line524の再起動前bridge ID固定比較で停止した。構成比較ではなくID比較であり、変更の原因と両IDは未確定。再起動要求0・回収呼出0・自動再試行なし・Provider要求なし。不明の限定終了へ未到達であり、通常回帰成功から補完しない。回復ID `docker-task.b712e61b439e7abdc2276bda341f57c3c01aec0b8c1ea6b4db8c7fe23f68daf1.bf44d8a1e176a15be3047495439e2321ff54d51cc4d49b5401537adf927528cc.2791b520f00675ec9fbe334b7603af3197b668879b0cad6e815bef1f3942ac6a` の正式APIでDocker／Host回収・Lock解放・履歴・操作除去を確認。比較用Siblingも全要求未発行を照合して正式回収した。専用Rootの操作／未解決／配送すべて0、二走査47entry一致、履歴SHA-256 `9e197126cbf9ab32ce86f88b72ad96ce17ab7a7a0cae51280a94a19de31271ff`、非使用・非reparse・exact Root確認後に削除し不存在確認済み。既存停止Container一件は維持した。今回の一回試験承認は使用済みで、未使用の再起動枠を追加試験へ流用しない。

### 現在の完成範囲と未接続の分類（2026-10-17）

DI詳細§5の完成条件に従い、実Provider全E2E・後続Coordinator／Orchestrator再編をDI Package完了へ無条件追加しない。先の残件説明でこれらをまとめた点を訂正し、未完了自体は保持する。

| 対象 | 現在の処置 | Owner・次の確認 |
|---|---|---|
| 現行設計集合 | 13定義・197項目、Manifest上Relationあり146／なし51。17 Manifest・774 Symbol、重複ID・未定義Local参照0。031の実Suite接続を追加した後の再計数 | Quality。先頭列の一意IDと現Manifestの読取り再計数であり、個別Test／実行／Passの全数監査ではない。欠損Path・不明verifies参照0は先行全数照合の結果 |
| 旧署名五項目・旧Handoff二項目 | AIT-IT-009／ST-010／UT-011／IT-013／IT-015、ERB-ST-011／IT-012は明示退役。Missingからの再実装やPass換算をしない | QA-000010／000006の現在適用訂正を優先し、歴史Oracleを維持 |
| 上位Handoff・人間確認 | ERB-IT-010／ST-013、PRL-UAT-002／010は上位未接続・人間確認として別範囲に保持 | Orchestrator／Quality。後続上位再編・E2E開始時に再評価。DI完成を上位完成へ拡張しない |
| DIに直接必要な実境界 | 3群のSource／Test／既存結果を品質側が独立読取り照合済み。下記の不足観測を残す | DI／Coordinator／Quality。内部・代役の成功を実観測へ拡張せず、実Provider全E2Eを無条件追加しない |
| Checkerの19工程契約指摘 | AMの既存文書構造・集合・候補状態・旧Hash／Checklistの不整合であり、今回DI差分由来ではない。全失敗枝の個別原因確定までは未実施 | AM設計／Quality。AM整合再開時に修正・再レビュー。全体Checker不合格・v0.22全体Gate未成立は維持 |
| Arch下流対応の一指摘 | PRT2.spec2／3、PRT3.spec4／5、PRT5.spec9、PRT11.spec5、PRT12.spec17の7関係とSCR／BHVを中央表・DI／Coordinator詳細へ伝播。契約／品質の独立確認とも全重大度指摘0 | Architecture／Quality。配置伝播の限定確認でありChecker全体合格ではない。28／29のモデル選択はDI非担当、ARCH／QAの意味は不変更 |
| Checkerの旧Area検出 | 固定02_Activity_Context読取りとARCH→全Area直積は、正本の「自身が所有するRelationだけ」のN:N責務を表せない。今回の直接伝播確認では文書の全数照合を用い、複製文書や一律担当追加をしない | Checker／Architecture。現行詳細入口と明示Relation集合を検出する契約へ見直す候補で再評価。エラー非表示・全体監査免除・全体Gate通過は行わない |

7関係の着手前照合は契約／品質の両結果を統合済み。受理はTask作成まで、照会・次行動分類は読取り／分類まで、診断は許可Probeまでに保ち、DIの技術処理への配置接続だけを伝播する。清掃対象・Authority・保持・保存、引継ぎ・結果再取得・再発行判断は上位のまま。一般Filesystem清掃や照会ごとの新Probeは追加しない。

| 実境界の残る確認 | 現在ある根拠 | 追加で必要な観測・許可境界 |
|---|---|---|
| ERB-ST-009 | 現Schemaの実Writer／履歴・同ID再入場・保持物から新Task接続に加え、今回のNative実退避・新世代起動・Engine ready・承認WSL保守清掃・同ID正式終了を観測 | Windows自動disposal成功とは区別し、正式義務の評価で今回実測と既存反例を照合する。追加領域の退避は失敗世代Continuation条件のまま、正常環境を壊して通さない。今回の一経路だけを009全異常枝・DI全体Passへ換算しない |
| ERB-IT-031 | 本番DIの五資源回収に加え、専用実Caseで通常entrypointの公式版・三実行物Hash・実Image Digest・起動Warning・隔離構成・元ID回収・不存在を一組として確認 | 現在配置物の不足観測は解消。既存固定取得／包装根拠と現在実物の対応を正式評価で照合し、再Build・Host機能・助言成立へ拡張しない |
| ERB-ST-030 | 実Node取消・実Docker資源回収・保存記録から別Process回収の部分観測、公開CLI取消の局所反証 | 既存固定Probeは内部取消または残存作成後の診断子喪失であり、公開Task CLIの二scenarioを代用しない。本番公開Taskは実Provider準備・認証を要し、固定Workerの公開選択はない。新たな恒久seamや複数Authority代役を追加せず、公開二scenarioの成立には実Provider操作の許可が必要。DI詳細§5が別範囲とする後続実Provider E2Eと、DI技術境界の完成条件を人間判断へ戻して照合する。ST-030全体Passは未成立 |

上記は新機能追加ではなく現在の完成条件の不足根拠である。人間は009と030を今確認すると判断済み。009は初回の破棄前観測で停止した後、人間承認のWSL保守清掃と限定是正を経て、同じ回復IDの正式終了まで確認した。Windows自動disposal成功や009の全異常枝の成立とは区別する。auth-create限定終了と031の実測成功は、009の処理全体や030の公開取消／親喪失の観測を兼ねない。新Framework・Recovery・Timeout延長は追加しない。030の実行前には固定試験入力・送信内容・回数と取消／親喪失の操作を限定する。

残る判断の再計算（WSL保守と同ID終了後）: 期限付き保持への新遷移案は採用せず、今回承認されたexact Root清掃と既存正式終了で残存を解消した。元の破棄意図・過去の不明要求は保持し、履歴・状態を手編集していない。030は今確認する判断済みで、固定送信内容・回数・監視手順を実行前に確定する。DI全体完成・コミット／プッシュは残る実境界と完成監査後とする。

030公開CLI試験の準備確認（実行前）: 既存公開入口・入力Reader・取消結合・固定Profile Catalogを読取り照合した。試験Repositoryに公開用の一行`CRDD_PUBLIC_TASK_BASE`だけを用意し、対象`verification-marker.txt`のBASE→OKという合成Taskを使う案である。対象製品RepositoryのSource・文書・認証情報を送信しない。候補requestは604 UTF-8 bytes、JSON SHA-256 `60269de97c68e86fd13f23478b39f36adb1fc606be064d1ca35ca2c7dfaeef8f`で、既存`snapshotCoordinatorTaskRequest`がaccepted、readPathsは当該一Fileだけ。front=codex／executor=claude、bounded_implementation・complete・low・low・limited・local candidate only。既存Claude executor候補はPROFILE-200001／200002のopus・mediumだが、実選択・Home可用性・同意・送信は未確認であり、受理をProvider起動成功へ換算しない。

030の実行前固定: `.crdd/tests/public-task-cli/`一領域に、自己生成Git Repository（三追跡File: marker・gitignore・非秘密の送信policy）、request、外部端末の一時Scriptを準備した。pretty JSON実入力675bytes／SHA-256 `16b032f43e504cd8f2eed19a2936c6e90761090c61982e766bca41458e081836`、JSON正規化は上記604bytesと同Hashでaccepted。Script SHA-256 `29f88c005d8db6c064736536399b3bdada1f76ca1690cd6b69f97d22cfd6b4f6`、PowerShell構文Error0。共通公開CLIを子Processで実行し、stdinはfile EOF、stdoutは公開JSON、stderrは既存lifecycleだけ画面へ転送する。通常同意は既存の別CONIN$／CONOUT$で行い、表示・入力成立を実確認するまでProvider送信の成立を主張しない。Code自動入力・API key fallback・秘密の記録はしない。二Task各一回が上限であり、完了競争ではReviewer／修正もあり得るため、AI依頼各一回の保証とは説明しない。

着手前の契約／品質照合は、この構成と通常同意・外部Observerを組み合わせる条件で整合した。PowerShell側もCtrl+Cで中断され得るため、Script完走やCLI_EXIT表示をOracleにしない。別Observerが元NodeのPID・開始時刻・実行物・引数・合成Repo、元回復IDを先に捕捉し、executor開始通知と実資源の正対照後に刺激する。Ctrl+Cは人間の実Console操作だけ、親喪失は元Nodeだけとし、子tree一括終了をしない。刺激前に完了した場合は不成立、例外・観測不能・失敗で自動再実行しない。前Taskの正式回収・現在state／履歴・候補処置・Process／資源終端と合成tracked内容不変を確認してから次へ進む。試験Rootは正式終了・参照解消・非使用後だけ清掃する。恒久Launcher・新公開seam・新しいAuthority代役は追加しない。

030公開Ctrl+C実測（2026-10-17 08:50:59〜08:52:12Z）: 修正版一回で通常同意を受け、Claude opus／low executorの`OP-281064348841424424346766178965915489084`開始を観測した。元CLI PID38280／開始08:50:59.4057265Z、Container `9990141f5a40f2f324b9ac3434a262f8222a8bd9311b30c941dc28931aac2de0`の稼働とproxy・authを正対照として捕捉後、人間が実端末でCtrl+Cを一回入力した。公開JSONは人間から最終JSONだけを受領し、`coordinator_task_cancelled_after_provider_cleanup`、cleanupConfirmed=true、manualRecoveryRequired=false、candidateDisposition=not_issued、canonicalRepositoryChanged=false、各回復ID=null。境界settledはProcess tree終了・Container／Network不存在・cleanupを確認し、Provider完了自体は未観測と保持する。履歴は同じ元回復IDでcancelled／provider_operation_cancelled／hostCleanup=confirmed／lease=released。元CLIのCIM不存在、試験Container不存在、合成tracked差分なしを確認し、正式Readerはrevision24・操作0／未解決0／配送0・lockReleased=true。結果JSON SHA-256 `74a14d83d2dac32c9713680da6267d8a41ecae067e877e7fe60e0af9b75f3330`、events `85886f90b73ce28e918a164bb873cce880694c8a5848d794cbfa76fdd2010752`、この時点のhistory `33bd43c8abec4c7ce68ae0dd34a680cb321607e279c52f3532f7948c07099dab`。端末監視PSはCtrl+Cで中断されexit記録なし、結果判定はそのScript完走へ依存しない。stderrのSyncWriteStream error／close監視数警告13→16は未処置として残し、親喪失・030全体・DI全体Passへ換算しない。標準bridge IDも観測間で変化したためEngine世代不変は主張しない。

030公開CLI親喪失の実測（2026-10-17 08:53:35〜08:54:28Z）: 別の合成Task一回を通常同意で開始し、CLI PID17444／Process API開始08:53:35.0572437Zを固定した。最初の停止前確認はCIM時刻のマイクロ秒丸め（08:53:35.0572430Z）と完全一致せず、Effect 0で停止した。Process APIが元metadataと完全一致することを再確認し、08:54:27.9313516Zにexact CLI一件だけを終了した。子tree終了・Docker再起動・記録手編集は未実施。刺激時点はexecutor完了後のCodex reviewer準備中であり、executor実行中の親喪失とは区別する。Claude元回復ID末尾`29f0b2bf21fbd450d48fb6991102388f9b5f71400dc1454a3f2e0114168ba4cd`とCodex元回復ID末尾`ee16a94fb6cd1379c54984ce608e94f3189d60ef7d870a43568faa991ce02ce5`を捕捉した。両IDの通常doctorは各一回とも`docker_task_recovery_preparation_unconfirmed`で停止、正式Readerは`coordinator_state_reentry_required`／lockReleased=true。current revision55とpending revision56の差はCodex一資源の作成receipt（dockerId・receiptSource・request）と前版結合だけ。`state.json` SHA-256 `1ea45768f0f59c2a779c938cb1f41946947b44a02f0b01b925366caa92e31e76`、`state.pending.json` `ef2de701f8b39e43df2d817220a0349733ecedeac483916ebe959d6ecec95e77`、events `4f489a1864d082e32bc148f410416ee49a6aa09865d8df71ae802ac047443d9c`。作成済みCodex／proxy／auth資源と元記録は保持し、手動削除・再試験を行わない。保存途中の資源receiptから正式回収へ再入場する既存接続を調査中であり、030親喪失は不成立、DI全体も未完了。

親喪失是正の着手前整合確認: 契約・品質の読取り結果を統合した。実物のcurrent／pendingは既存codecでともにvalid、既存の通常遷移検査もtrueで、pending対象の`create_provider`一欄を既存`prepareCoordinatorStateResourceSnapshot`へ戻すとpending全bytesと完全一致した。この純粋照合を出版Authority・実資源の存在・回収成功へ昇格しない。是正範囲はexact対象の単一資源Receipt出版途中を既存Reader／Writerとfresh回収Ownerへ接続することだけ。一般Readerのpending拒否、通常Owner失効、Host／Home／Runtime／state排他、別操作保全を維持する。current／pendingの実体・canonical全bytes・Repository結合・previous Hash・固定Identity・一資源だけの完全再導出を検査し、元Ownerの新Effect不能と既存排他取得後に同じ候補を既存Writerへ渡す。別IDのpending、他操作変更、別本文・旧版・marker不整合は停止、既出版なら同候補の短命物回収だけ。新create・再Task・新Lock／Registry／Framework・手動rename／削除は追加しない。局所反証は保存確定前中断→fresh Process、別本文・別Owner・他操作差、出版後中断、pending清掃失敗とcreate要求0。実Provider再試験を最初の再現手段にしない。後続にHost token／兄弟操作の不整合があれば別事実として調査し、推測で緩和しない。監視数警告も16通知の逐次／並行・全settle後の基準数復帰を先に局所確認し、上限変更で隠さない。

資源Receipt再入場の実装・局所結果: 一資源の完全再導出分類、専用Reader、既存Writerへの限定再接続を追加した。初回11件は10成功・fixtureのRepository結合取り違え1失敗、修正後の対象2件は値モデル成功・専用Readerのmarker取得漏れ1失敗。両者は失敗として保持し、後続成功へ合算しない。marker取得条件とOwner false／throw（初回・再読後・Writer入口）・marker欠測／不正・current／pending差替え拒否を補強後、対象2/2成功（159509.5743ms、Host158449.5106ms）。その後のSource差は戻り値Objectの整形だけで、静的全段階を再実行してexit0、lintは54情報・警告0。契約／品質の再レビューは本番指摘0、試験の拒否地点到達数assert一件を補強予定。現在は同じ候補の隣接四File回帰中であり、終了後にassert追加と同Case再確認を行う。実物のcurrent／pendingと資源はまだ処置せず保持する。

監視数警告の限定診断: AI・Dockerを使わず既存Kernel Lockを16回取得・解放すると、stderrのerror／close監視は直後16、イベント処理後0へ戻った。解放直後に合成lifecycle通知を送ると17件警告を二件再現し、通知自体はtrue、全settle後の監視は基準0へ戻った。これは短命Workerのstdio配管と通知時点の一時重複の再現であり、恒久的な監視漏れ・実Task全分岐の不存在証明にはしない。警告上限の変更・隠蔽・新管理機構は追加しない。

資源Receipt再入場の最終確認と実物処置: 拒否地点の到達数assertを追加し、format／lint／strict成功後のHost単一Caseは1/1（172524.4548ms）。契約・品質の限定再確認はともに残指摘0。本番Sourceは隣接40/40成功時から不変更。元current／pending両Hashの不変を再確認し、同じCodex回復IDへ通常doctorを一回適用した結果、`docker_task_recovery_completed`／exit0、Docker・Host回収、履歴、全排他解放、操作除去とCLI清掃を確認した。新Provider・再起動・手動削除はない。続く同TaskのClaude元IDは`docker_task_recovery_host_active_or_unknown`で停止した。現在revision66／操作1、全五資源identifiedかつabsent、lease released、ownerEffect disabled、workspaceReusable false、Host root／marker両explicit absentだが、Host cleanup欄はnot_requestedのまま。共有Hostを後続Codexで正式回収した後、先行操作の終了へ接続できない条件を調査する。同じ試験の残1件を完結する範囲であり、未知残存の一般回復・再起動・記録手編集へ広げない。030全体とDI全体は未完了。

既回収Hostへの終了接続の着手前照合: 契約・品質の読取り確認を統合し、lease released、旧Owner disabled、Workspace再利用不可、五資源identified／absent、Host遷移なし、未解決再起動なしの場合だけ既存Root／marker不存在確認へ進める方針とした。fresh Ownerと既存三排他・正確なRoot／token相関を維持し、不明・片側不存在・再出現は拒否する。不存在時は既存host pending保存・読戻しからconfirmed Writerへつなぎ、過去の削除要求を捏造しない。新Framework・共有State・再起動・物理削除は追加しない。

同接続の局所確認: 初回33件は32成功・新VM fixtureのkind欠落1失敗。fixtureを実契約どおり補正し、checkpointの別token・別field・別kind・非終端・Owner喪失・保存失敗を加えた実行は34/34成功（1567.6442ms）、strict型検査成功。固定候補の独立レビューを統合し、Workspace再利用とcodec有効な未解決再起動の拒否例不足、および新試験のnon-null assertion警告1を試験だけで是正した。最終局所34/34成功（1655.1719ms）、全静的検査exit0・警告0／既存情報54、両再レビュー残指摘0。実Claude記録への適用前に隣接四Fileを実Windowsで回帰中であり、元記録を保持する。

| 030の確認 | 実行手段・開始条件 | 必要な終了観測・停止条件 |
|---|---|---|
| 公開Taskの取消 | 外部可視端末で通常の`task --request-stdin --json`。JSON入力はEOFで閉じ、通常の外部送信同意を使う。executor実Process開始と現在の実資源を確認後、人間がCtrl+Cを一回入力 | NodeのkillをWindows Ctrl+Cの代役にしない。元IDのTask結果・取消・Process／Container／Network回収・正式状態の終了を相関する。入力前にTaskが終わった場合は未確認として止める |
| 公開CLI親Processの喪失 | 別の新しい試行で元回復IDを先に取得し、executor開始後にCLIのexact PIDだけを終了する。子Process treeを先回りして削除しない | 新Processの通常doctorへ同じ回復IDを渡し、元Ownerの失効・現在実資源・回収・履歴／配送状態を観測する。通常Task再試行や新規Recoveryを代用しない |
| 共通の実行境界 | 二scenario各一回を上限案とする。Profile・Provider／Model変更・Fallback・恒久試験入口・Docker再起動は追加しない | reviewerもProvider依頼であり、executor開始だけで試験が完了する保証はない。実行前に後続起動を含む許可境界と監視手順を固定する。秘密・生Provider出力を記録せず、失敗時は追加試行をせず今回資源の正式回収だけに戻る |

030初回入口確認（2026-10-17 08:47Z）: 実Node CLIは送信同意前に`coordinator_task_external_send_confirmation_unavailable`／exit 2で終了した。executor／reviewer／候補／回復IDはすべてnull、cleanupConfirmed=true、manualRecoveryRequired=false、canonicalRepositoryChanged=false。lifecycle記録は空で、取消刺激は未実施。試験ScriptがstdoutをFileへredirectした一方、既存Windows端末契約はstdout.isTTYを必須とするため、製品ガードを変えず試験側だけ修正する。初回の結果・Process記録は上書きせず保持する。

030入口の限定是正: 一時Scriptのstdoutを実端末へ継承し、stdinは固定File EOF、stderrは既存lifecycleを記録・表示する構成とした。公開最終JSONは端末で確認し、同意コード・端末全文を保存しない。修正Script SHA-256 `d740e3094a963c0ee649240a92d94e66f43f01743c16c71cf01c58315cb5d0cd`、端末だけの確認Script SHA-256 `cf562e82438750a1e7d48f7be58bc1d1c4dd9143c9b390cf02e58712c9e06f5c`。08:50:18ZのAIなし実端末確認はstdinTTY=false／stdoutTTY=true／stderrTTY=false／console=available、Provider要求なし。契約・品質の独立読取りはともに追加指摘0。これは同意・取消・親喪失・資源回収の成立根拠ではない。人間が修正版の取消Task一回と当該試験物回収を新たに承認した。失敗時に自動再実行せず、元IDで正式回収し、親喪失scenarioは別に扱う。

先行するWindows読取り診断では陽性対照assertと整形を補強し、CLI試験binaryのcompile-onlyとRust整形検査は成功した。先行出力の成否を修正版の新実測へ読み替えない。Cargoのincremental hard-link不可はcopy fallbackの警告であり、API診断結果やDI完了の根拠ではない。

同伝播の実行確認: 全回帰終了後に上記3文書だけを編集し、中央7行とDI局所7行・Coordinator接続、対応SCR／BHV、28／29の除外、明示anchorを全数確認した。契約／品質の固定候補独立確認はともに残指摘0。Source・Test・Runtime挙動は不変更であり、文書の配置伝播だけを理由に実Docker再試験や通常全回帰を再実行しない。意味Coverageは現Coordinator文書Hashから再投影した。

失敗後の読取り診断: 標準bridgeの現在inspect二回は同ID・同構成Hashで一致し、Docker Desktop／backendのProcess開始時刻は試験前から不変だった。失敗時間帯のNetwork event出力は空で、bridgeの生成時刻は06:48:33.620943477Z。これは試験中にID差が起きた原因やEngine再起動を証明しない。試験器の再起動API未到達を維持し、条件を緩和せず追加実試験もしない。

追加の現在ログ確認: その後更新されたDockerの`log/vm/init.log`では、06:48:10〜45Zの833 JSON行中、06:48:31Zのkernel初期化、06:48:33.014Zの起動開始、06:48:35.774Zのdaemon初期化完了とAPI待受を固定句分類で確認した。raw本文・認証値は複製しない。bridge生成時刻と同じ窓に内部daemon初期化があり、Desktop Process不変をEngine世代不変へ読み替えられない。子の明示Docker要求はimage inspect→固定`create --network=none`→container inspectだけで、再起動／修復／Network変更の要求はない（契約側独立読取りも一致）。省電力復帰等の開始原因は未確定。[Docker公式Resource Saver説明](https://docs.docker.com/desktop/use-desktop/resource-saver/)は一覧応答がVM起床を意味しないことの参考であり、今回原因の証明ではない。初回create境界の標準bridge再生成を試験器でどう扱うかは反証中で、Source未変更・実再試験なし。

標準bridge比較の限定是正（局所確認完了）: 契約／品質の着手前結果を統合し、手動fixture内だけを変更した。本番Recovery・削除Authorityは不変更。全一覧の実ID指定inspectと標準bridge一件・default指定・Container空・既知17field／IPAM等のshapeを要求し、Id／Created以外の全fieldを比較材料へ保持する。再起動前は元IDを固定し、exact再起動のcompleted確認後の一地点だけ新IDへ更新、以降は新ID固定。bridgeだけ比較上の初期IDへ正規化し、独自Network／Container／Volume／Imageの完全一致を維持する。既存Simulationの固定inspect応答と、型／欠測／未知shape／時点外ID差／構成差／他Network差・比較省略の反証を追加。最終局所12/12（717.8145ms）・strict／整形／警告禁止Lint成功、契約／品質の独立レビューは全重大度残指摘0。契約側12/12（771.9788ms）、品質側11成功・Host専用junction EPERM1（917.3518ms）を別結果として保持し、親の通常Host12/12へ混ぜない。最初の読取り追加時の旧回数期待と、型・Lint指摘を是正し、初回不合格は最終成功へ混ぜない。[Docker公式資料](https://docs.docker.com/engine/network/drivers/bridge/)は起動時bridge自動生成だけの根拠であり、ID永続性や旧実試験の消失ID構成を証明しない。過去のFailは維持し、追加実試験は行っていない。人間が修正版の新品限定試験一回・Docker再起動最大一回と失敗時の同試験物回収を新たに承認した。現在の全回帰終了後に直列実行し、他のDocker処理または失敗で停止する。外部AI・認証情報・既存Container／Image／Volume削除は対象外。

最終候補回帰の追加是正（2026-10-17）: Coordinatorの通常Host全回帰はexit1で終了し、全体不合格を保持する。最終出力の全文・件数集計は取得できず、把握した失敗二件を全失敗件数とは断定しない。実行Profileの旧反復宣言は保持ありを含む三構成の明示照合・13Case／全112Caseへ同期した。旧「未署名なので停止」の公開記録STは署名撤廃後に実Docker Matrixへ到達し、exit0を返した。通常回帰を実Dockerなしとした従前の説明は誤りである。実CLI／Matrix main／Recorderを維持し、先頭Producer一件だけを既存有限理由で拒否、子内の全外部Process APIを禁止し到達1／要求0・exit2・公開JSONと保存summary・完了Hashを確認するSTへ是正した。通常Hostの関連二File18/18（2332.3312ms）、strict・整形・警告禁止Lint成功。制限環境の初回は既存junction作成EPERM一件で17/18、同Source通常Hostで解消した。契約／品質の独立レビューは全重大度残指摘0、契約側18/18（2440.9526ms）、品質側新ST1/1（951.9122ms）が成功した。Source差分の追加static checkも成功。全体再回帰は未完了。実Matrixは明示した手動実境界入口に保持し、通常試験の合格へ数えない。

今回の承認一回の実試験（2026-10-17、不合格）: Coordinator全回帰終了後、新品の`.crdd/tests/auth-create-closure/`で診断付き不存在形を一回実行した。試験器SHA-256は`cd4e16d52a47e13f0525c3543b6ab74b4abad9b2c4bde2b343c923c2b7423474`。再起動は一回でcompleted・stopFailureなしだったが、recover段階の全Network ID集合比較で停止した。追加ID`11faf2085d5ca80f67ef57abd508ffd9273b40d765b23da9dd166ec653c57e16`は実inspectで標準`bridge`／driver`bridge`／scope`local`、消失IDは`ad1de0b64191ff67fa6cfd5553f89cf59a87a7194ab51011eebd7811cbdcdc09`。旧IDの構成は捕捉していないため同一Networkの再生成とは断定しない。不存在二読取り・限定終了保存へは未到達、追加再試験なし。失敗後は同じ回復ID`docker-task.82c64cd00760955ce424dc191f61c442b853f7a2cf106884cb2b487290af69a2.79380dc92a46072f5eaa42ccbc603bce4ff86315ebc4b778a391c361f8fbb522.ed16ec2bd3ddc959f334a6aae38f83bc6661d81a724e7891b972c3b7809ba9c7`の正式APIで試験資源を回収し、比較用Siblingも全資源未要求を確認して同じ正式APIで回収。両者のDocker／Host清掃・Lock解放・履歴保存・操作除去を確認した。これは存在する資源の回収結果であり、当初の不存在形の合格ではない。専用Rootの現在操作・未解決・配送はすべて0、境界付き二走査47entry一致、清掃前履歴SHA-256は`a4bd623a359eecad0bf2fed8c8c30aa36ffeecd7b8dbaac1f2d5ebf57d3fd7a6`。外部AI・認証情報・既存Dockerデータ削除はなし。今回の再起動許可は使用済みで、追加再起動・再試験へ流用しない。

保持物から新Taskへの接続確認（2026-10-17）: 変更前のOwner再入場Suiteは通常Hostで15/15成功（284011.7245ms）。同じ既存Caseへ保持あり構成を追加し、自動破棄判断の保存直前を一回拒否した後、代役を解除して同じ回復IDの実保持API・Writer・履歴出版・操作除去を通した。自己生成primary一件の実体と内容、他二用途の明示不存在、七日期限、同ID再入場二用途の期限・state／history不変と技術再処置0を確認。同じstateを再初期化せず実Host／Home排他の新Taskへ接続し、元修復履歴と保持物を終了後まで保全した。修正版の限定Caseは1/1成功（82241.5764ms）、追加後の同File全体も通常Hostで16/16成功（450699.7225ms、失敗・取消・skip0）。静的三軸・両Trace成功、契約／品質の限定再レビューは残指摘0。初回は通常回復が自動破棄へ進むことを試験が見落とし、待判断の期待で失敗した（54016.4742ms）。本番処理は変更せず、中断位置を既存の保持条件へ合わせた。旧失敗Rootは由来・exact ID・内容・非使用・非reparse確認後に試験清掃し、製品回復成功とは数えない。実AppData／Native退避・Desktop修復・実Docker／Providerの成立はこのCaseから主張しない。

全Repository Checkerの追加観測（2026-10-17）: 初回3352 errorから、Project Contextの必須Checklist復元と一意な現行Pathの直接同期後は3341 errorで不合格。3321件は`99_Roadmap/Changes/**`内のリンク／アンカー指摘であり、場所だけから全件を歴史Evidenceまたは修正不要と分類しない。Changes外の現行リンク切れは0件、残る20件はIA／UI／SPECの定義・分析・詳細・引渡し・対応表の工程契約である。対象CanonicalとChecker SourceはHEADから不変更だが、それだけで基準版の合否や今回差分への非影響を断定しない。Project Context実Reader7/7（180.1093ms）と、現行Path・署名退役記述の直接同期の契約／品質限定再確認は残指摘0。旧認証create fixtureの現行DI／state／通常CLIへの接続は合成境界10/10（638.2409ms）で確認した。過去Evidenceは機械改名せず、全体検査の不合格と未分類範囲を保持する。

一回承認の実認証create限定終了（2026-10-17、不合格）: 固定Image・空の専用Rootで不存在形を一度実行したが、再起動前の全資源集合比較でNetwork差を検出し停止した。`restartCalls=0`、回収呼出0、Provider要求0、自動再試行なし。開始時と停止時のNetwork実集合は保存しておらず、時刻周辺のEngine eventも取得できなかったため、差の具体内容・原因は未確定である。回復IDは `docker-task.ef56fff621c54eb551272f1e7cf282379204b462fcdac0124a348f927800c217.3c58d7e65c6cace0f769c7d1e3d15203a0796c6b209ee06518971487beadedb3.4ab9da011f91229fc5bf3a74627e7f368db8c4c52a8288ac3dcaf4fe7b5ce86b`。試験Container `0c3274623e4d34e33547fc4749e11bc020e99546c1fea7aeb1971101e30f8bac` は現在保存由来の構成と実IDを既存DIで再照合して回収、予定三Container・二Networkの不存在を確認した。診断用`--input-type=module`のWorker継承でTask準備・Host世代取得が確認不能になったが、同引数なしの通常起動では同じ二Hostを既存世代排他・Host回収APIで回収し不存在を確認した。これは試験物清掃であり、unknown限定終了・Task全体回復・実再起動成功には数えない。専用Rootは内容・非使用確認後に試験清掃し、過去状態を成功へ書換えない。今回の試験は終了しており、未使用の再起動枠を追加再試験の承認へ読み替えない。

同失敗の限定診断是正: 既存の四資源集合のAssertionErrorだけについて、両側各128件以下・全要素64hexのNetwork IDを、一回のown data descriptor Snapshotから検証・重複除去・並べ替えして追加／消失へ分ける。疎配列・accessor・継承value・不正値・上限超過では追加field全体を省略し、元の停止・baseline差・再試行禁止は維持する。ラベル・名前・raw error・他資源本文・新Storeは追加しない。独立指摘の元iterator再走査と継承Property受理を是正し、静的三軸と合成境界の既存10/10（659.279ms）、契約／品質の最終限定再確認残0・独立各1/1（348.4909ms／342.3516ms）が成功した。これは次回の原因観測を可能にする試験診断だけで、今回のNetwork差の原因を特定したことにも、実Docker再試行の承認にもならない。

現行接続の追加回帰: 通常Hostの`current-host-transition.integration.test.ts`と`coordinator-docker-recovery-cli.integration.test.ts`は43/43成功（871908.0997ms、失敗／取消／skip0）。実Writer・履歴出版・配送・CLI・別Process再入場の接続は確認したが、Docker再起動の技術結果は代役であり実再起動成功へ拡張しない。これで旧fixtureの現行接続確認を閉じ、Network差の実観測・残る実境界／全体回帰／Reality Auditを保持する。

承認済みDocker実境界の三確認（2026-10-17）: Engineの接続先不存在を確認後、人間の承認範囲でDesktop未起動を確認し一度だけ通常起動した。Linux Engine応答・固定三Imageのローカル存在を確認し、専用strict・整形・警告禁止Lintを通した。本番DI Ownerの五資源実ID回収1/1（6538.1365ms）、空Homeの未起動認証五資源構成／Receipt1/1（6023.3417ms）、認証保存記録から別Processの正式回収1/1（6590.005ms）が成功した。各Caseが自己生成実ID・名前の不存在を確認し、三種の試験Directoryは残存0。二つの試験Labelは個別指定のContainer一覧も空だった。固定Imageは変更せず、再起動・修復・既存データ削除・実認証情報・外部AI依頼はなし。これは三つの実境界だけの結果であり、保持物とfresh Task・認証create unknown限定終了・Owner喪失・実Provider／全体E2Eの成功へ拡張しない。

上位接続の責務整理の区切り（2026-10-17）: 資源文法集約後のDI全通常回帰は静的三軸と319/319成功（33252.4149ms）。通常Hostの上位五Fileは178/178成功（234121.7893ms）で、実状態保存・元Owner失効・Effect前拒否・既存回復／Receipt／清掃／配送の接続を保持した。契約・品質の独立確認は残指摘0、独立DI各13/13（645.3681ms／694.5153ms）、上位拒否2/2（535.9567ms）も成功。expectation反復と二回不存在確認は操作前後の元版・Owner確認、発見IDの先行保存、限定終了条件を所有するため上位に保持する。Docker実観測・構成照合・削除・不存在確認自体はDIが所有済みで、配列反復だけを移す中継APIは増やさない。既存Provider HomeのWindows観測Owner呼出しは認証・保護とTaskの相関であり、Docker実行環境の判断ではないためDIへ移さない。両者の追加読取り反証でも必須の技術移管残存はなく、上位接続の責務整理は完了とする。Coordinator全体のOS非依存化・巨大Fileの可読性整理・Docker Isolation全体完成とは区別する。保持物とfresh Task、旧fixture、実境界・E2E・Reality Audit・最終回帰／独立確認は残る。

上位薄化・資源文法の集約候補（2026-10-17）: 両着手前確認後、既存DI plannerへ八項目の同期文法判定を集約し、planner自身と上位三利用側の重複正規表現を置換した。Task／Authority／Home／Packet相関・command全文・用途順は維持する。上位の一部では従来下位で行っていた重複名・digest拒否が開始前へ早まるため、本文等価移管ではなく、同じ不正計画のEffect前拒否として確認する。既存回復の再入場・清掃・配送へ新条件は追加しない。DI／Coordinator静的確認、文法・公開APIの関連13/13（569.1394ms）が成功。現在、通常Hostで上位三利用側と既存回復を再回帰中。Source／独立確認・実境界は未完了であり、新State・Registry・Lock・Frameworkは追加していない。

Seccomp所在往復撤去の確認結果（2026-10-17）: DIの`npm test`は静的三軸と通常318/318成功（34652.8499ms、exit0）。Symbol Graph12/12（942.8246ms）、Checker静的三軸も成功。契約・品質の独立確認は全重大度の残指摘0で、独立planner／runtime各25/25（251.405ms／267.9455ms）、上位の欠測拒否1/1（435.7599ms）も成功した。Seccompの上位Path往復撤去はこの範囲で確認済みとする。資源文法の重複検査、回復の技術反復・Provider Home観測の限定整理、旧回復fixture、実境界・E2Eと全体完成は残る。通常318件にはHost専用Profile・実Docker／Providerを含めない。

上位薄化・Seccomp所在往復の撤去候補（2026-10-17）: 両着手前照合に基づき、DI plannerが固定Artifactの読取り・照合・option構築を所有し、上位は適用要否と期待Hash／bytesだけを渡す方式へ変更した。Pathを返す公開Resolverと上位の検証関数注入を除去し、旧Path入力・欠測・不正Identityを拒否する。実体Resolverの全反例を保全し、後発欠測で新規開始を拒否しても既存Contextの清掃は阻害しない反例を追加した。Provider／Task意味、元command完全一致、Primary Failure・受領・取消・回収の所有は不変更。DI静的三軸と関連39件、清掃独立性追加後のruntime15件は成功。Coordinator静的確認成功、関連141件は制限内139成功・Host専用2失敗、同じSourceの通常Host再実行で141/141成功（1718.4767ms）。新しい固定fixtureへ古いHashを記載した初回UT2失敗は、現ArtifactとAI Adapter正本の期待Identityを照合して試験を訂正した。実Artifactは変更していない。独立確認とDI全体再回帰はこれからで、実Docker・Provider・全体完成は未成立。

Domain専用profile撤去の区切り（2026-10-17）: 同一Sourceの通常Host再回帰は静的三軸と122/122成功（35681.9465ms、exit0）。初回の準備Timeout1件は再現せず原因未確定として保持し、初回記録を削除・Passへ置換しない。契約・品質のSource／試験／文書の限定再確認は残指摘0。Domainの署名専用profile撤去はこの範囲で確認済みとし、上位の重複検査・技術反復整理へ進む。Docker実境界・実Provider・全体E2E・Reality Audit・最終独立レビューはまだ完了していない。

Domain全回帰と限定独立結果（2026-10-17）: 通常Hostの`npm test`は静的三軸成功、122件中121成功・1失敗（45895.0109ms、exit1）。唯一の失敗は変更していないroot-and-lockの実Process競合試験で、10秒内に子Processのreadyが揃わなかった。同じSource・同じPackage作業場所で当該Caseだけを確認し1/1成功（440.3618ms）。初回失敗の原因は未確定であり、単純合算して全体Passにしない。契約・品質の独立確認はSource／試験指摘0、旧Resolverと未着手表示の文書追従1件を検出し、全結果・方針整合後に保存設計を同期した。通常Root検証・Consumer導出・未登録領域拒否、汎用署名と歴史Evidenceは保持する。

Domain署名専用profileの撤去候補（2026-10-17）: `storage=signature`の型・入力許可・v4 Reader・固定Root／preparation配置・専用Lock／staging・専用清掃とcatch特例を撤去した。通常v3・公開四API・`.operations`配置と通常保存／再入場／清掃順を維持する。旧storage fieldは値がundefinedでも作成・回復処置前に拒否し、v4とstorage付き文書は通常v3へ変換しない。署名専用二Caseを退役し、保全済み通常三反例と旧入力／文書拒否へ接続した。静的三軸と通常Hostの関連IT24/24（3382.3985ms、exit0）は成功。全体回帰・独立確認はこれからであり、旧ローカル状態・秘密設定・歴史Evidenceは変更していない。

保全Caseの独立是正確認（2026-10-17）: 契約・品質の確認を統合し、rename失敗の実発火確認不足1件を是正した。対象文書への到達回数を計数し、公開前・公開後とも1回以上を確認する。公開後のcatch再保存を妨げるexact一回条件は追加しない。静的三軸と通常Host同Case1/1（396.9795ms）、契約側独立1/1（384.8282ms）が成功し、両再確認の残指摘0。読戻し発火・exact参照・世代・正式再入場・清掃Oracleは維持する。これで通常三反例の保全は確認済みだが、本番の署名専用profile削除はまだ未着手である。

専用profile撤去前の通常保証保全（2026-10-17）: 旧署名試験に混在していた再入場公開前・公開後・読戻し失敗の三反例を、同じITの通常v3／`.operations`経路へ独立Caseとして接続した。既存署名Caseはまだ削除していない。公開前は旧参照、公開後と読戻し失敗は次Identity・世代2の参照、再入場後の文書／work不存在を確認する。静的三軸は成功。制限環境では作成がblockedとなり試験は失敗、通常Hostの同じCaseは1/1成功（377.9897ms、exit0）。これはmockによる保存境界の確認であり、実Process喪失・専用profile撤去後・全体完成の証明ではない。独立確認後に専用分岐の削除へ進む。

現在投影の利用側追加確認（2026-10-17）: 下記三失敗の是正に加えてDomainの実Readerへ入力したところ、縮小時に判断場面の固定表と先行要約見出しを落としていたことを検出した。Readerを緩めず、`PROJECT_CONTEXT.md`の表と`### 結論`を復元した。DomainのRepository Context／Project Projection七件とCoordinatorの関連十四件は再実行して成功（167.2865ms／312.8417ms）。制限環境の別Reader試験一件はsymlink作成EPERMで停止し、通常Hostで同じ三Fileを再実行して10/10成功（784.408ms、exit0）。先行の読取り独立確認はこの欠落を検出しておらず、更新版を再確認へ渡す。

現在の回帰結果（2026-10-17）: Coordinator通常回帰session49865は終了し、1,918件中1,855成功・57失敗・6未実施（1336299.2148ms、exit1）。失敗した19Fileを同じSourceで通常Host再確認し、353件中350成功・3失敗（160030.1894ms、exit1）だった。残った3失敗は、廃止Case ID参照1件と、履歴蓄積で`PROJECT_CONTEXT.md`が65,536byteの助言入力上限を超えた2件。前者は現行Caseと正常対照へ接続し、後者はIdentity・五場面・観測境界・Owner参照を保った現在投影へ縮小した。上限、比較、実Repository入力は緩めていない。是正後のCoordinator静的確認と関連2Fileの14/14（414.7187ms、exit0）は成功。独立確認、Domain専用profile撤去、上位の限定整理、実境界と最終回帰は残る。以下の「継続中」「未分類」は各時点の経過であり、この現在結果で更新する。複数実行の成功数を合算して全体Passにはしない。

Domain全回帰と専用profile残存（2026-10-17）: 制限内の全121件は77成功・44失敗で、Link・試験Repository保存・排他回復の権限制限を含んだ。同じ固定候補を通常Hostで再実行し、静的三軸と121/121成功（39009.7567ms、exit0）を確認した。これは変更前の署名専用profileを含む候補であり、次の削除後へ結果を流用しない。追加照合でDomainの`storage: signature`／v4／固定Root分岐が残ることを確認した。契約・品質の読取り確認は現production Consumerなし、通常v3／公開四APIは維持し専用profileのみ退役可能とした。共通writeDocumentの再入場公開前・公開後・読戻し失敗三反例を通常経路へ保全し、旧入力・旧回復参照・v4文書を処置前に拒否する。旧signatureの自動探索／互換Reader／回復は作らず、フロントAI清掃に限定する。Source変更は未着手、Domain設計の現行記述を同時に追従する。Coordinator通常回帰は同じsession49865で継続中。長時間位置のPR-N-03依存／競合予約は通常Hostの同一Caseでは1/1成功（6497.6874ms、60秒上限内）。途中停止・全体成功とはまだ判断しない。

上位三Fileの責務精査（2026-10-17、読取りのみ）: 契約／品質の着手前照合で、Docker CLI／Engine・OS分岐・九要求の進行・Process取消／終了・実ID観測回収は既にDI所有と確認した。`provider/execution-controller.ts`と`task/recovery.ts`全体をDIへ移すと、Task保存・Authority・Consumer配送・Home／Host所有が下位へ逆流するため行わない。残る限定整理対象は、①上位とDIで重複する資源名／Label／Digest／用途構造検査、②Seccompの固定Host Path搬送の往復（execution-plan／adapterを含む全利用側）、③回復expectation探索と二回不存在観測の技術反復、④Task回復内のWindows Home観測名の直接参照を既存Provider Home Ownerへ局所化する点である。Provider／Modelの意味照合はAI Adapterの既存Ownerへ照合し、DIへ押し込まない。新Framework・共有State・Lock・汎用Recoveryは不要。現在の全体回帰を先に回収し、元command完全一致、発行／Receipt保存順、Primary Failure、取消・回収、元Owner再利用拒否、Consumer受領の既存反証を保った最小差分で進める。上記は未実装の整理計画であり、薄いAdapterへの全体完了宣言ではない。

撤去後の回帰分類（2026-10-17）: Docker Isolationの`npm test`は静的三軸と通常316/316成功（32861.0081ms、exit0）。実Host専用試験・実Docker／Providerの成立は含まない。Coordinator通常回帰はsession 49865で継続中。初期のCandidate保存失敗は同一Caseを通常Host権限で再実行して成功し、Candidate Store全13件とNative入力境界4件も17/17成功（8097.8877ms）。Git試験Repositoryのconfig書込み拒否で止まったCandidate採用Caseも通常Hostの同一試験1/1成功（2347.7009ms）。これらは制限環境差として区別し、製品検査・Oracle・Skip条件を緩めていない。残る失敗の全件分類とCoordinator全体成功は未確定。

S5B 専用署名方式の物理撤去・限定レビュー（2026-10-17）: 旧Source18件・専用試験等20件に加え、公開署名設定例と配布Manifestを撤去した。現行Workflowの旧鍵生成・準備・署名・昇格Commandを廃止案内へ置換し、過去版のCommit C判断記録・正式Evidence・署名・HashとLocal秘密設定は変更していない。設計・QA6／10・DomainのOwner例外・System試験を現在Ownerへ同期した。独立レビューのST読取り残存1件と文書／例外追従漏れを是正し、契約・品質の限定再確認は全重大度の残指摘0。Coordinator静的三軸と両Trace、Domain静的三軸、System／退役31/31（7421.1075ms）、Domain公開／保存利用側16/16（808.3561ms）成功。保全した通常保証を旧graph保証の再実装と混同せず、削除をQA197のPassへ数えない。現在Coordinator通常回帰を実行中で、Candidate保存系等の失敗があり未分類。旧回復fixture、保持物・次Task、上位責務の精査、実境界・全体E2E・Reality Auditと全体完成は残る。Commit／Pushはまだ行わない。

S5B 回帰追従の再確認（2026-10-17）: Runnerは静的三軸成功後、全52 Case中51成功・既存の人間確認1件未実施（21159.6228ms）。権限制限を受けたリンク試験だけは同じCaseを通常Host権限で別実行し1/1成功（190.4691ms）。同じリンク試験を通常実行では明示除外し、製品側の拒否条件は弱めていない。Version Controlの利用側閉包12/12（1375.63ms）、差分空白検査も成功。これは旧署名撤去に伴う試験追従の結果であり、実Docker／Provider、全体E2E、最終独立レビューの成立ではない。

S5B 撤去実行中（2026-10-17）: ④のNative検証Toolは実Source断面の固定構築・Artifact選択・close待機を3/3で確認し、契約／品質の独立確認は残指摘0。Compilerや実Process全体の成立へは昇格しない。必要な四群を保全後、Coordinator固有署名・配布Tree／Manifest・固定AST graphのSource18件と専用試験等20件を撤去し、Symbol・台帳・型検査・実行入口を追従した。撤去後の台帳25/25、Symbol Graph12/12、関連Coordinator23/23、Domain保存利用側4/4が成功した。Version Controlの子Process公開入口照合はpending再入場追加による七場面へ追従し12/12成功。Runnerの旧署名除外を撤去し、現行Windows試験Owner／Fileの期待値を修正後、両言語dispatchの局所1/1が成功。Runner全体の先行実行ではこの期待値不整合とリンク準備EPERMの2件が失敗しており、全体成功とは表示しない。現在設定・手順・設計の旧記述、全体再実行と固定候補の独立レビューは未完了。過去Evidence・秘密設定・汎用成果物署名は変更していない。

S5B 大撤去前の能力照合（2026-10-17）: 契約／品質の読取り照合で、旧八Module・九Scriptと配布Tree／Manifest／AST graph専用試験は退役可能と確認した。旧Source改造を固定graphで拒否する保証そのものは再実装しない。現在の実機能として、①TS子Wrapper入力拒否、②DI内部Primitive非公開、③保存Workerの固定構築、④残すNative検証Toolの起動・artifact選択・close待機を保全する。Task回復の旧loader非参照も旧Suite撤去時に現在境界へ保持する。独立Trust evaluator、汎用artifact-signing、既存の実Process・Root・隔離・Native検査、QA197と過去Evidenceは不変更。

①②は新TS子入口ITと既存DI Package境界へ接続した。六拒否assertの本文不変、実namespaceの内部五Primitive非公開、4/4（189.8919ms）・台帳25/25（11659.1243ms）・Symbol Graph12/12（977.7694ms）・整形／型／警告禁止Lint成功。契約／品質の独立4/4（196ms／194.5565ms）、残指摘0。旧Observer投影は退役群に残し、同投影を新しい公開契約へ移植しない。

③はDomainの既存root-and-lock UTに実private本文の構築断面を接続した。二OS×取得値1／-1／-2、固定URL、options／workerDataのexact key・freeze・共有4byte、Rootと相対Lockの順序付きHash、unref／release一回／失敗時terminate要求を確認する。新Case1/1（111.8904ms）・整形／型／警告禁止Lint成功、両独立1/1（109ms／112.6921ms）、残指摘0。実Worker／OS排他の成立は既存実試験へ保持し、terminate要求を実終了へ昇格しない。④のNative検証Toolの通常構築・終了確認が残っているため、旧混在Suite本体はまだ削除しない。

S5B 現行試験の旧graph依存撤去（2026-10-17）: Host namespaceの旧AST guardと、Native環境不成立fixtureの旧署名mock二つを撤去した。Session試験の旧mock呼出し0は実Source三件の旧import／Verifier不存在確認へ置換し、Git出所mockは現diagnostics Ownerへ接続して通常実行からの呼出し0を維持した。関連192/192（47958.2049ms）、環境欠測5用途のspawn／Filesystem／Network／Authority／Capability 0、型・整形・警告禁止Lint成功。契約／品質の独立確認は残指摘0。実Native／Docker／Providerの成立は主張しない。

同じ退役の前提として、DIの通常Package境界試験を新設し、現src全数のliteral依存とRoot実API四件を確認した。Node builtin・同src・PA Root一件だけを許し、上位六Packageのtype-only／再export／dynamic、PA内部、親越境、未知module、非literal六形を反証する。完全TypeScript解析や敵対Sourceの安全証明ではない。初回レビューのdynamic連結式見逃し一件を単独literal限定へ是正し、3/3（187.4879ms）と両独立3/3（198ms／187.36ms）が成功、残指摘0。台帳25/25（11919.6937ms）・Symbol Graph12/12（956.6471ms）成功。旧混在Suiteの逆依存Case一件だけを撤去し残15Caseを保持する。修正前通常316/316（32268.385ms）とは別に、是正後の通常全回帰316/316（31881.5875ms）と整形・型・警告禁止Lintが成功した。Host専用試験と実Docker／Providerはこの通常Profileに含まない。旧署名本体・残る保証の能力対応・実境界／E2E・全体完成は未完了。

S5B 現行資産試験の分離（2026-10-17、限定確認完了）: 旧配布Suiteの19Caseから、レシピCOPY、公開Provider構成と設定Hash、助言準備の実本文三入力搬送の3Caseだけを`runtime-assets.contract.test.ts`へ本文不変で分離した。QA-000006にREQ-000016由来のunknown gate前提確認として限定接続し、Local Item全体のPassとは扱わない。型・整形・警告禁止Lint、3/3（226.2704ms）、台帳25/25（12458.3577ms）、Symbol Graph12/12（953.0011ms）が成功。契約／品質の独立確認は残指摘0、両者の独立実行も3/3（239ms／226.7489ms）成功した。旧Suite残16Caseは15成功・既知PA graph未結合1失敗（3568.6251ms）を維持する。別途、下位のrecovery-executor／command-runtime／attached-processの48/48（626.9369ms）を確認したが、旧AST検査の全保証を置換済みとはしない。署名本体、残試験の能力対応、実Build／Provider／Docker／E2Eと全体完成は未完了。既存のQA197の意味・件数と過去Evidenceは変更しない。

今回のDocker Isolation完成条件には、Coordinatorの残存技術処理の撤去まで含める。`src/docker-desktop/`は廃止し、Desktop／OS差・修復・再起動の技術判断をDIへ集約する。`src/docker-execution/`のDocker起動・観測・資源回収もDIへ閉じ、Coordinatorは許可・現在状態・結果／通知の接続だけを既存の実行調整／状態管理へ残す。別名のCoordinatorフォルダへ技術処理を移すだけでは完了しない。ファイル数を一律に固定するのではなく、上位がDocker Desktop／Linux等を意識せず必要な接続だけを所有することを確認する。実回収接続→旧経路撤去／残存責務の再配置→全体回帰・独立レビュー・実境界／E2E→Commit／Pushの順とし、撤去を別改修へ先送りしない。

### 修復退避物の後続処置 — 着手前整合確認 2026-10-16

S5B Native分離の限定独立結果（2026-10-17）: 契約／品質とも全重大度の残指摘0・限定Pass。契約側がNative通常二形とcoverage／Profileの計10/10（2137ms）、品質側がNative通常二形2/2（2162.85ms）を独立再実行して成功した。品質側はstage版との関数本文完全一致も独立確認した。Symbol Graph12/12（889.9031ms）とRuntime Traceも成功。通常Hostでのjunction一件成功は別根拠であり、独立側の制限環境実行で再確認したとは扱わない。旧署名群本体・混在Suiteの残部は未撤去で、S5B全体・実Docker／Provider／E2E・全体完成は未成立とする。

S5B Native観測保全の分離結果（2026-10-17、独立確認前）: 単一Native Git観測をdiagnosticsの同名Fileへ、実Git・Blob差・途中差替え・junctionの試験を専用ITへ分離した。移動前後のSource関数本文・試験本文は改行正規化後の完全一致を確認。Source／Test Symbol、台帳の結合block、strict、Host Profile、coverage母集合と未到達義務を追従した。関連10/10（2526.6352ms）と台帳25/25（11120.4294ms）成功。junction一Caseは制限環境のEPERMで停止後、同じCaseを通常Hostで1/1（188.2735ms）成功、自己生成Root残存0。coverage fixtureの分母追従漏れ一箇所を15→16へ是正し、現在10/10は修正後。型・整形・警告禁止Lint・差分確認成功。旧配布処理と混在Suiteの残部はまだ保持しており、署名Framework退役・全体回帰・実Docker／Provider／E2Eの完了ではない。

S5Bの能力別撤去計画（2026-10-17）: 契約／品質の読取り確認で、旧八Moduleの本番importは退役群内部と旧配布Identityに閉じ、他Packageの通常Sourceからの依存はないことを確認した。ただし混在試験を一括削除しない。初回編集は、単一NativeのGit照合関数と実Git／途中差／junction試験を`diagnostics/native-git-provenance.ts`と同名ITへ本文不変で分離し、旧全Tree／閉包照合とは別のSource・Test Symbol／台帳・Host Profileへ接続する。これは新しい抽象化・Framework・保証の追加ではなく、退役対象から現在の観測を保全する配置変更である。

| 現在の責務／検証 | 処置・保持先 |
|---|---|
| Coordinator専用鍵生成・署名・準備コピー・昇格・staging・全scripts graph | 九Scriptと専用設定・試験を退役する。汎用artifact-signingは維持 |
| 旧Manifest・固定Release鍵・期限・巨大AST／配布Tree閉包・旧Trust Gate | 八Moduleと専用試験を退役。独立Trust evaluator・歴史Evidenceは維持 |
| 単一Native Git Blob・Root／Native／Git再観測 | 旧配布Identityから分離して現行観測として保持 |
| レシピ・Provider設定・公式入力・Native前後token | 混在distribution ITの当該本文を保持し、署名graph依存だけ除く |
| 各spawn前のfresh CLI／config／Ownerとclose、認証attach | 既存DI recovery-executor／command-runtime／attached-process／owned-processへ具体対応を確認してから旧graph反証を退役 |
| Windows終端・TS子wrapper・Domain保存Worker・Host namespace／terminal | 既存PA／Coordinatorの実本文・実依存試験へ保持。意味の対応前には旧Caseを削除しない |
| Symbol／Catalog・strict・coverage母集合・Host Profile・Workflow | 物理処置と同時に実Ownerへ接続。QA197の件数をPassの代替にしない |

最初の分離後も旧署名Tool・AST宣言・保護Path検査は残るため、専用Frameworkの退役完了は未成立とする。現在のNative固定Artifact、公式CLI／Image出所、Root／送信許可／隔離・取消・回収を削らず、新しい巨大graphを作らない。`.env-crdd`等の実ローカル秘密値や歴史ManifestはこのSource撤去で削除しない。実体の移行・清掃はフロントAIが現在の参照・非使用を確認する。

S5A限定結果（2026-10-17）: 契約／品質の固定候補独立確認は全重大度の残指摘0・限定Pass。両確認者がLauncher全Suiteを各9/9（3006ms／2991.5514ms）で独立再実行した。実TTY Probe・Docker・Providerは未実行。次のS5BではCoordinator固有の署名準備・昇格・巨大graphと専用配布Identityを物理撤去し、残るNative単一観測と現行Task／認証／隔離の保証を照合する。旧modeの直接拒否を、旧Script全体の不存在やFramework退役完了へ広げない。

S5の退役方針とLauncher切替（2026-10-17、独立確認前）: 本番importを照合すると、旧package-verificationの利用はCoordinator専用署名Toolと旧配布Identityだけに閉じている。承認済みの通常署名廃止・配布責務への分離に従い、専用sign／promote／prepare／staging／keygen／巨大graphを退役し、汎用artifact-signingと単一Native Git観測を保持する。契約／品質の着手前確認は阻害なし・追加人間判断不要。まずS5Aで共通Launcherの旧二mode・dispatch・help・TTY条件を撤去し、現在の六modeを維持した。旧modeのTTY／非TTY・引数あり／なし・NUL拒否、実binのexit64、引数非開示・help・旧import不存在を含む9/9（2942.8487ms）成功。Source／tests strict・対象四Fileの整形／警告禁止Lint成功。実端末専用Probeも廃止mode拒否へ同期したが、実端末再実行は未実施。S5Bの残Script本体・専用graph・配布Identity・試験・設定／台帳の物理撤去、広い回帰、実境界／E2E、全体完成は未完了。

S4限定独立確認結果（2026-10-17）: 契約・品質とも全重大度の残指摘0・限定Pass。契約側はexport不存在とdrain拒否2/2（425ms）、品質側は実子Process経由のpoison拒否を含む7/7（24295.5641ms）を独立再実行して成功した。current Sourceへの旧APIのimport／alias／namespace／再export／dynamic import再注入とv0.21比較の2Caseも成功した（2898.7298ms）。任意署名のprimitive試験1件は既知PA `child_process_unbound`によりfixture準備で失敗し、変更したcopied issuer削除後の分岐へは未到達として保持する。廃止資格の安全性を別名で再実装せず、次は旧AST宣言・保護Path・Coordinator固有署名Toolの整理へ進む。実Docker／Provider・全体E2E・全体完成は未成立、Commit／Pushなし。

S4局所結果（2026-10-17、独立確認前）: 三APIと資格状態を削除し、現Module公開namespaceから三API・試験factoryが存在しないことを確認した。Task入力Proxyで旧試験を置換した一般Task・四経路・Process安全状態の三Suite71/71（59413.9889ms）が成功、失敗／取消／skip0。廃止API不存在1/1（251.2756ms）、Source／tests strict・対象10Fileの整形／警告禁止Lint成功。署名資格の一回消費・TTLだけを退役し、Task／送信許可・Runner・fresh Process試験を維持した。専用AST graphと任意Tool全体、実Docker／Providerと全体E2Eは未完了である。

S4旧署名資格API撤去の着手前照合（2026-10-17）: 本番利用0と試験利用先を実Sourceで確認し、契約／品質の確認条件を統合した。三API、固定資格Record、WeakMap、TTL、試験factoryを一体で撤去し、署名資格の一回消費保証は退役する。Task・送信許可・Runnerのpoison／drain・fresh Process保証は維持し、旧issuerへのProxy入力読取り0は現Task入力のget／ownKeys／descriptor読取り0へ移す。旧専用二Caseは実namespaceの四export不存在へ置換し、任意配布のfixed／installed拒否は保持する。新資格・State・Lock・Frameworkを追加しない。QA197・v0.21比較・歴史Evidenceは不変更。現在の専用AST宣言・保護Path検査は旧API条件を残すため、次のgraph整理を要する未完了として保持し、旧APIの空実装は戻さない。型・整形・Lintは成功し、関連回帰を実行中。独立レビューと任意配布Tool全体・全体E2Eは未完了。

S3限定結果（2026-10-17）: 最終41/41（4420.0881ms）成功、契約側の同Suite独立再実行41/41（4509ms）、品質側の関連四Caseも4/4（721.3116ms）成功。契約／品質の独立レビューは全重大度残指摘0・限定Pass。台帳25/25（18434.4667ms）、Orchestrator Trace、Source／tests strict・整形・警告禁止Lint・差分確認が成功。全配布回帰19件は18成功・既知PA `child_process_unbound`一件失敗を維持し、current三利用と旧比較の各Caseは成功した。これは実Provider／Dockerの実行結果ではない。旧資格三API・専用graphと任意署名Toolの整理、広い回帰、実境界・全体E2Eを残し、全体完成・Commit／Pushはまだ行わない。

S3実Provider検証Toolの切替（2026-10-17、独立確認前）: 契約／品質の着手前照合を統合し、`verify-orchestrator-real-providers.ts`から任意配布Root引数・旧二API・動的Verifier読込みを撤去した。実Toolの固定CheckoutでSource／Gitを観測し、既存Domain Readerによる64KiBの公開MCP入口観測を追加する。入口HashはReaderのUTF8文字列を対象とし、原子的ロードや生byte完全性は保証しない。結果改訂12で対象Repositoryと実行Sourceを分け、終了時の不成立は検証問題として既存終了・回収・一次失敗と独立に保持する。閉集合投影・未発行拒否・Source／入口の途中差を含む41試験が成功、Source／tests strict・整形・Lint成功。current名前付き利用は5→3、実Source集合の対象1Caseは成功。v0.21比較は不変更。実Provider／Docker未実行で、独立確認・台帳／関係伝播・広い回帰と全体完成は残る。

S3前段の未発行診断是正（2026-10-17）: Orchestrator実Provider Toolの署名切替調査で、引数・環境・事前観測の失敗まで回復不明と記録する誤分類を確認した。契約／品質の読取り確認を統合し、引数構築後・spawn直前のProcess-local sticky flagで未発行を分離した。未発行は標準出力のみの既知拒否とし、結果保存・fixture処置・回復要求を行わない。前段のDirectory作成も結果保存直前へ遅らせた。発行後の同期例外と後続例外は既存の不明処理を維持し、新State／Lock／Recoveryは追加しない。実本文VMの七境界を含む対象Suite39/39（4181.5094ms）、Source／tests strict・整形・警告禁止Lint・差分確認が成功。契約／品質の独立確認は両方残指摘0・限定Passで、追加Caseの独立再実行も各1/1成功した。先行S2のWorkflow試験一箇所は選択Checkout表記へ追従し、関連3/3・静的検査が成功、両確認者が是正妥当と確認した。実Docker／Providerなし。S3署名切替本体、旧API撤去、全体回帰・実境界／E2Eは未完了。

S2 限定結果（2026-10-17）: 一般Task改訂27、四経路15、二経路2、結果記録4へ接続し、署名専用結果をSource四fieldと固定状態へ置換した。固定module Rootの実観測本文、初回拒否、終了時差分・例外、候補破棄／取消先行と一次理由保持、経路間tuple、旧Producer保全を反証した。四Suite84件は83成功・link作成権限制限一件で、同一Caseの通常Host再実行1/1は成功。契約側も同じ四Suiteを独立再実行し同じ83成功・EPERM一件、品質側の関連15Caseは全成功。両独立監査は全重大度の残指摘0・限定Pass。current利用五件／v0.21比較二Case、台帳25Case、両Trace、Source／tests型と対象整形／Lint・差分確認は成功した。実Docker／Provider・全体E2E、旧専用API／任意署名Tool・全配布graph、残存上位責務・保持物／次Taskは未完了。歴史Evidence・QA197の成立数は変更せず、Commit／Pushは全体完成後とする。

S2 一般Task／経路別検証の着手前整合確認（2026-10-17）: 契約／品質の読取り確認を統合し、旧issuerと署名専用結果項目を一般Task・四経路・二経路・結果記録で同時に移行する。固定module Rootの既存Source観測とGit改訂は実行許可でなく検証対象の追跡に使う。開始前欠測はTask開始0。終了時は取消・遅延completion・候補破棄・監視解除を含むfinally後に内容／内部実体／改訂を再照合し、一次失敗を上書きせず独立した検証状態として返す。Source不一致を対象Repository変更やProvider Effect不明へ転用しない。四経路の全retry・二経路の成功結合は同じSource tupleを要求する。内部実体Hash・Root・旧署名項目を新版へ公開しない。共有Recorderの未移行Producerが必要とする旧投影は維持し、新版四fieldと固定状態を追加する。current利用表は一般Task一利用だけ6→5、v0.21比較・歴史Evidence・Native／CLI／Image・隔離と回収保証は不変更。初回拒否、終了時五値差・観測例外、一次失敗と取消・候補処置の保全、各tuple fieldの欠落／型／差、改訂拒否、安全投影を反証する。標準規範／準拠基準は変えず、契約・品質独立レビューと関係伝播を行い、実Provider／全E2Eは別の完成条件として維持する。

S1 回復試験の署名前提撤去（2026-10-17）: 契約／品質の着手前照合に基づき、固定Worker Matrixから旧署名資格の発行とprivate前提関数を撤去した。親APIと内部子の両入口はNode対応版だけをEffect前に確認し、既存の七形・exact ID・取消・子終端・清掃本文を保持する。代替資格は作らない。改訂2の実結果と説明は署名不要を明示し、Script名・公開reasonはTool群移行中の暫定識別子として維持する。current利用表は当該一件だけ6へ減らし、v0.21比較は不変更。実本文VMによる親／子両形・省略／後置変異・失敗結果の四Caseは成功。配布検査と合算した23件は22成功・既知PA child_process graph一件失敗。Launcher／記録22件は21成功・link権限制限一件で、同一Caseの通常Host再実行1/1は成功。台帳25/25、Source／tests型・整形／Lint・両Trace・差分確認が成功した。独立確認のMinor二件は両確認者の合意した方針で説明・件数だけを訂正し、修正版六Caseが成功。契約側の最終再確認は利用上限で停止したが、同じ固定候補を別の独立確認者が再確認し、残指摘0・限定Pass、Matrix四Caseの独立再実行成功を得た。これらは実七シナリオや実Docker／E2E成立の代替ではない。

検証関係の二不整合是正（2026-10-17）: MCPの補助Scriptは親ITが三形の子Process実行・結果・清掃を所有するため、独立Suiteとして重複したSymbol一件だけを撤去した。修復CLIの削除済みDesktop dispatch参照は、現在の修復Caller境界を所有する既存Symbolへ置換した。親Suite・Catalog・試験本文・QA197・Schema／規則・歴史Evidenceは不変更。Symbol Graph12/12、親IT3/3、CLI13/13、Catalog25/25が成功し、契約／品質の固定候補独立確認は全重大度残指摘0。これは検証関係の構造整合だけの成立であり、全Reality Audit・実Docker／E2Eの成功ではない。旧署名API／専用Tool・配布graph、残存上位責務の精査と実境界は引き続きOPEN。

R Session接続の着手前再照合と候補（2026-10-17）: Source観測／読取りCLIの限定完了後、契約・品質の両確認者へ残るSession接続を再提示し、元tokenの継続性と結果のSource追跡、current Consumer表の三利用撤去を統合した。既存observeの第二引数priorIdentityだけで元admissionを搬送し、本番はMap欠測拒否→旧token確認→Source／新Native→Repository再確認→旧token再確認→新token最終確認を行う。孤立試験は第二引数を無視できるが、本番借用のMap必須条件は緩めない。実観測値との一致後にだけ凍結したScope／期待Hashを既存inspect・実測結果へ搬送する。新Store・Callback Framework・Runtime互換は作らない。旧二配布APIのcall二件／type query一件をcurrent表から撤去し10→7、v0.21表・比較fixture・歴史Evidenceは不変更。開発欠測理由の変更はHome／保護Root／terminalの三File四箇所だけで、namespaceのQ方式は維持する。

同候補の限定結果（2026-10-17）: 代表8件、新Hash／token境界10件、実本文の三確認省略変異・Map欠測・同内容差替え・borrow例外が成功した。実測結果を改訂3へ更新し、実観測Scope／期待Hashの凍結・同参照搬送まで含む最新三Suiteは216/216（49088.7753ms）成功・Exit0・失敗／取消／skip0。Namespace／Host記録／保護Rootの別四Suiteは42/42（2986.6021ms）、台帳25/25（21521.3193ms）、Source／tests strict・warning禁止Lint・Trace・二生成Projection・差分確認が成功。初回の広い指定には四つの誤ったFile名が含まれたため、そのExit0を七Suite成立とは解釈せず、実在Pathの四Suiteを別に実行した。実測搬送UTの追加時のnullable型不一致は肯定assertで修正し、27/27（465.386ms）も確認した。現配布回帰19件は18成功・既知PA child_process graph一件失敗（5902.6003ms）で、current Consumer7とv0.21比較のCaseは成功。契約／品質の最終独立レビューは全重大度残指摘0・限定Pass。旧署名API・専用Tool・全配布graph、保持物・次Task・実境界／E2Eと全体完成はOPENを維持する。実Docker／Provider／再起動・Commit／Pushなし。

R着手前整合確認（2026-10-17）: 現行通常Sourceの旧`package-verification.ts`直接依存は`task/development-measurement-session.ts`の二APIだけであり、通常Native四AdapterからのGit／署名GateはQで解消済み。残るSessionは同Source RootのNativeを明示拒否し、別署名配布と旧AST閉包を要求していた。契約・品質の読取り専用照合を統合し、[Architecture §9のSession移行方針](../../../06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)へ正式に分離した。SessionのTask数・期限・予約・Operation結合・取消・送信許可は不変更。期待Hash一値は`expectedSourceSha256`へ明確化し、署名Native Root／Releaseの二設定を撤去する。着手前観測の11 Package固定対象は463 File・10,042,617 byte・最大454,275 byteで、採用した有界観測の上限内である。任意の`policies/`も観測対象へ含め、現在不存在を存在しない実行義務へ補完しない。

R Source観測の限定進捗（2026-10-17）: Sessionと既存実測Toolが同じ規則を使うため、両独立観点の着手前照合に従い、同じtask責務内の具体的な`development-source-observation.ts`一Fileへ読取り処理を置いた。Package Root公開・任意Root注入・新Store・新Authorityは追加しない。固定Sourceに対する内容Hashと実体Hashの分離、二読取り、必須Source欠落・空・junction／hardlink・途中差・File／容量／階層上限の反例を確認した。契約Moderate二件と品質Moderate二件／Minor一件は全結果統合後に是正し、Directoryの逐次上限列挙、nlink確認、既存同Root清掃handle、変更後非null Oracleへ接続した。整形・両strict・警告禁止Lint、実Filesystemと列挙本文の6/6（2918.2523ms）成功、限定独立再確認は両観点とも残指摘0。自己生成Root残存0。実Sourceのportable Hashは別の逐次走査・独立再構成でも一致した。

既存`measure-development-providers.ts --describe-source`へ読取りだけの期待値生成入口を追加した。通常実測のpacket／RuntimeRoot／Task準備より前に分岐し、Scope、期待Hash、件数、byte数と非Authority／Provider未発行だけを返す。Source実体Hash・Root・本文を公開しない。実入口で464 Fileの観測を確認した。ENOENTだけを不存在とするinventory、実main本文の分岐位置Oracle、親Processだけの七Case登録へ是正し、分類変更前の関連二Suiteは138/138（25439.2357ms）成功・Exit0・失敗／取消／skip0。Windows junctionの一CaseはHost Profileへ分類し、実script・閉集合も同期済み。先行Host Case追加の追従漏れ二領域（12件／15件）も現物へ同期し、新一件を含む母集団は111件、Profile契約は3/3（408.2101ms）成功した。初回の重複登録回帰は中断し、exact親子三Processの終了と残存自己生成86Fileの内容確認後回収を確認した。最終七Caseは7/7（4203.5697ms）、台帳25/25（22583.1059ms）が成功した。追加のSymbol Graph検査は11/12成功・二不整合（MCP fixtureのCatalog欠落、Coordinator旧dispatch Symbol参照）が残っており、全体Reality Auditは未合格として後続是正へ保持する。Source観測と読取りCLIの最終契約／品質レビューは残指摘0・限定Pass。packageの表示空白Minorも値不変で解消し、Profile再確認3/3（409.4552ms）と差分空白確認が成功した。同限定確認時点ではSession本番・固定Bootstrap借用・旧入力Schema撤去は未接続であり、R全体・署名依存全撤去・Package完成を主張しない。Docker／Provider／再起動・Commit／Pushは行っていない。

編集一次キーはSession入力→同OwnerのSource／Bootstrap観測→同Root借用→既存実測Toolの期待Hash生成→試験／設計／QA・台帳の順。新Fileを一律追加せず、Sourceは既存Session Ownerへ閉じる。正常・旧field拒否・期待Hash差・Source追加／欠落／変更／link／途中差／全上限、Repository改訂差、Native Hash／token差、署名／Git配布API呼出し0、全development Adapter経路とraw packet入口を反証する。既存単体・Native結合・実測搬送・計測・環境不能試験を維持する。通常Sourceと任意配布の境界を独立レビューし、旧全配布graph／fixtureの未成立を隠さない。新Store・Lock・共有State・Registry・Framework・Releaseコピー・Runtime互換は追加しない。追加の実Docker／Provider／再起動なしで着手可能であり、現時点の人間判断は不要。着手時点では実装と生成入口接続は未完了で、全体完成・Commit／Pushはまだ不可。

Q限定結果（2026-10-17）: 通常4AdapterをPA既存Artifact Ownerの固定Bootstrap確認へ接続した。通常の固定Hash・同token前後確認は維持し、HEAD Blob一致は追跡／任意配布に分離した。現物読取りはBootstrap／token確認true、Git Provenance falseで、開発中のNativeとHEAD差を正しく区別した。Provider Homeの説明契約は改訂7、通常方式は`fixed_bootstrap_native_artifact`／Revision `null`。開発借用の非candidateは従来provenance理由・要求0を維持する。PA静的三軸と10/10（3702.1455ms）、最終上位5 Suite 164/164（28642.3439ms）、Git単一Native API 2/2（2982.3076ms）、台帳25/25（21734.3706ms）、両strict・警告禁止Lint・Trace・二生成Projection・差分確認が成功。PA Root置換一件のEPERMは通常Windows権限で同一試験成功後、PA全体も通常制限内で再成功し、製品不良と区別した。

旧配布のdeclared検査は全文Hash以外のexact起動・所有・flowも含むため、その成功を仮定していない。通常試験は既存Module境界と実本体Oracleへ接続し、namespaceの固定exe／二mode／環境／5000ms／上限／nonce／親実体／同token四時点、Home／保護Rootの開始・前後確認省略とshell／argv変異を確認した。登録Hash・許可集合・検査比較処理は更新せず、proof metadataだけを実Ownerへ同期した。広い170件の3失敗中、terminalの旧mock2件は是正後に成功、残る旧署名閉包fixture一件は未置換のままOPEN。動的Fake coverageは制限内Host初期化で停止したが、通常Windows権限のdoctor一件成功（495.0192ms）、同coverage入口はExit0・2回一致（payload SHA256 `25d528ed243ad92629d72ca4fb9ac607d23e15a974d52263338b745fa52cf1b8`）。出力内のNot Verified義務は維持し、coverage生成成功を全義務充足にしない。独立契約Minor一件・品質Minor二件を統合是正し、最終両確認は残指摘0・限定Pass。追加のDocker／Provider／再起動はなし。旧配布graph縮小、保持物・次Task、実境界／E2E・全体完成はOPENで、Commit／Pushはまだ行わない。

Q追加回帰: Docker Isolationの`npm test`は静的三軸と通常313/313成功（33684.5067ms、Exit0、Fail／Cancel／Skip0）。PA／unsigned自己生成試験Rootの残存0を確認した。これは通常回帰の結果であり、実Docker・再起動・Provider・E2Eの代替ではない。

Q統合条件: 二呼出し間のRoot／File継続同一性を新しい保証にしない。正本の主張は各呼出し内のRoot／File前後一致と、二観測間の固定Artifact全6 field・同方式一致までとし、追加の共有token寿命は作らない。通常方式は`fixed_bootstrap_native_artifact`かつrevision `null`、開発方式は従来の`fixed_development_candidate`かつrevision `null`を必須とする。方式差・field差・各要求の観測token失効を拒否する。契約・品質の条件を統合済みで、この範囲内に追加の人間判断はない。

Q通常Native確認の縮小・着手前照合（2026-10-17、設計候補／Source未変更）: 通常4Adapter（protected-root、Provider Home、Host terminalのread／save・通常／既知file、Host namespace初期化）が単一NativeのHEAD Blob一致を実行Gateにしている。現在の採用済みNativeとIndexは固定Bootstrap Hashに一致するがHEAD旧Blobと異なり、通常doctorが停止する。Index許可・先行Commit・常時trueでは迂回しない。採用済みの通常実行／追跡／任意配布分離に従い、通常は既存PA artifact Ownerの用途限定compositionで固定相対Path・Root/file実体・非link・size・採用済みBootstrap Hashを確認し、元観測tokenを各要求直前／直後に検証する方向とする。PAの汎用観測自体は固定Hashを要求しないため、その値だけで成功としない。Git Provenance APIとBlob反証は追跡／任意配布用途として維持し、通常呼出しを撤去する。新State・Lock・資格・Frameworkは追加しない。

通常経路ではHEAD由来一致を証明しなくなることをArchitecture／QAに明記し、実測していないRevisionはnull、方式は固定Bootstrap確認として表示する。terminal Current／Knownは同方式・固定Artifact全tupleと既存の対象snapshotを照合し、Git条件削除から共同成立を推定しない。開発Contextの既存確認、固定環境・argv・Protocol／nonce・権限・部分receipt・要求済み事実・Effect不明・cleanupは維持する。反証は、HEAD差＋固定Hash一致の通常肯定と既存Git API拒否、Hash／欠落／link／Root／size／直前token差の要求0、要求後差の成功0と既発行事実保持、namespace第2要求直前差の第1要求保全・第2要求0、terminal二観測のArtifact差拒否。既存のPA Artifact実Filesystem・development-native-observation・namespace・terminal-record・protected-root試験を拡張し、通常Sourceの配布境界Oracleも新条件へ接続する。既知配布18/19をallowlistで解消せず、別の配布縮小単位で扱う。契約・品質の着手前確認は条件付き着手可、説明field変更を含む最終統合照合後に正本／Source編集へ進む。現在追加の人間判断は不要で、全体完成は未成立。

P配置の限定結果（2026-10-17）: 旧4Fileを既存provider／taskへ移し、38利用側・Symbol・coverage・Source読取りを同期した。先頭Headerとimportを除く本文SHA256は4件とも移管前と一致し、private singleton・依存graph・保存／処置・QA197は不変。旧両Folderは不存在。両strict・41Fileの書式／警告禁止Lint、Trace、二生成Projectionと差分確認が成功。関連347件は346成功・junction作成EPERM一件でExit1、同一一件は通常Windows権限で1/1成功（424.764ms）。台帳25/25（19937.6086ms）。配布19件は18成功・既知PA child_process未結合一件でExit1（7614.623ms）、current／v0.21分離Caseは成功。契約指摘0、品質CQ-P-Q01／02の旧Path正規表現・無変化変異とQ03の現Owner文書を、統合案の両確認者照合後に是正した。変異は現needle一意性と非同値を要求し、対象23/23（656.5569ms）が成功。初回23件のRoot起動によるpackage.json不存在は試験の指定作業場所で再実行し解消、製品処理は変えていない。最終再レビューは進行中。実Docker・Provider・再起動はなし。Native／HEAD・配布graph、実保持物と次Task・実境界／E2E・全体完成はOPENを維持する。

O先行是正の結果（2026-10-17、限定完了）: Proxy包装・認証Home・Seccomp実体照合を既存DI Ownerへ集約した。Resolverの実関数本文SHA256は旧Index／移管後とも`3a13bf591041d9b4ab2a1a535c410b6a5f5b0d47f4494524146e5e22dfede696`、同じ固定実物へのPathも一致。Provider二種・Workspace三形・Init／対話二値の24構成は九argv全文の順序付きJSON SHA256 `036f75bfd667da709b6b7af63f3f441685b67a051956e26dd8e87e3d3370a0cf`を維持した。上位38/38（1336.0259ms）、下位関連25/25（628.2561ms）、台帳25/25（23061.754ms）、両静的三軸・Trace／生成Projection・差分確認が成功。契約Minorのprofile長差は既存plannerへ同期して32／33境界を追加、品質Moderate CQ-O-Q01はimage型確認を正規表現前へ移し、getter object／Proxyのgetter0と型確認省略変異の拒否で是正した。境界fixtureの初回型推論失敗は明示構造型で修正後に再確認した。最終DI通常313/313（33502.2832ms）・Exit0・Fail／Cancel／Skip0、契約／品質の残指摘0・限定Pass。旧Resolver File／Source Symbolの現在参照0。実Docker・Provider・再起動なし。4File配置・実境界・全体完成はこの結果から主張しない。

P最終照合: 統合是正後の契約／品質再確認は全重大度残指摘0・限定Pass。4本文Hashと旧両Folder不存在を再確認した。追加の回復・再入場・準備・委譲・Manifest・署名の6 Suiteは60件中55成功・5失敗（15382.7937ms、Exit1）で、失敗はすべて旧署名fixture／preflightの準備段階にある。現在署名fixtureが既知配布閉包拒否へ到達することは観測済みだが、5件すべてを同一原因と断定せず後続の配布縮小で照合する。配置単位だけを閉じ、広い回帰と全体完成は未成立のままにする。

P旧docker-executionの責務配置・再着手前照合（2026-10-17）: 先行技術2群の是正後に両確認者と再照合した。上位計画の投影／元Runtime相関はprovider/isolation-execution、実行許可・通知・Provider結果とTask状態の調整はprovider/execution-controller、固定公開語彙はprovider/execution-result-reasons、Task現在状態・元版・排他・受領・保存・終了はtask/recoveryへ移す。すべて既存Folder内へのrenameで、別名の技術dump・新Module数・新抽象を増やさない。Headerとimport以外の全文Hash、private singletonと循環依存graphを不変に保ち、既知38利用側・文字列読取り・Symbol／設定／coverage・試験固定表を同期する。current境界のPathだけを変更し、v0.21比較の8旧Pathと歴史Evidenceは保持する。旧folder／wrapper 0、新実exportと本番接続、上位関連回帰・台帳・静的検査・独立契約／品質を確認する。状態・理由・保存・通信・Authority・QA197は不変更。実Docker／E2E・全体Gateは未完了のまま維持し、準拠基準不変更のため準拠監査は追加しない。現在人間判断は不要。

O旧4File配置前の技術残存是正・着手前照合（2026-10-17）: 契約観点は4配置を妥当としたが、品質観点でcommand-effectsに残るProxy包装走査・コンテナ内Home定数と、別File経由のSeccomp実体照合を検出した。全結果を統合し、4File移動はこの二群の是正後に再固定する。Proxyの固定22引数は既存DI command-planの単一private構築関数へ集約し、元create_proxy一件の固定arity／option／二env／末尾imageを全文再照合してprofile/tokenだけを返す。上位はProvider相関だけを確認する。認証Homeも同Ownerで既存metadataの環境名からだけ生成し、上位二構築箇所を接続する。正常九argvは不変。Seccomp Resolverは既存DI command-runtimeへ同本文・同一実物の相対URLで移し、三本番Callerと既存試験を同じRoot exportへ接続する。旧Resolver File／Source Symbolを撤去し既存DI Ownerへ検証関係を移す。欠測／重複／包装外decoy／不正名／別profile、実体差／link／読取り中差替え、Mount返却一回・Authority0／Docker0を確認する。新Module／State／Lock／Registry／Frameworkなし。本文不変の3配置はその後に実施し、現在／v0.21比較Pathを分け、歴史Evidence・通信・Schema・QA197は維持する。独立契約／品質、直接設計・台帳伝播と静的／関連回帰を行い、準拠基準不変更のため準拠監査・実Docker／Provider要求はこの局所単位では実行しない。現在人間判断は不要。

N回復実行のCLI／環境Owner移管・着手前照合（2026-10-17）: 残るrecovery-lifecycleのCLI snapshot・検証と環境生成を既存DI recovery-executorへ移す。固定本番factoryはmanagementDirectory／assertOwnerの二keyだけを明示搬送し、旧の注入可能な低位factoryはDI直接技術試験用として維持する。構築時の短命config処置は既存のまま、CLI／環境は要求時だけ遅延実行する。module共有snapshotは成功した初回observeでだけ設定し、後続・別Executor・close後も同じ値をverifyする。observe失敗は未設定、verify失敗は再observeしない。要求時の環境→Owner／CLI→config→最終Owner→spawn順、二つの既存理由、元executor／closeを保持する。両独立観点の照合を統合し、実factory本文・二生成・両CLI失敗・環境拒否・余剰getter未評価・close後cache、上位二key搬送と実config回収、既存四fixture・root公開集合・Symbol／設計／台帳を確認する。新State／Lock／Registry／Frameworkを追加せず、既存cacheのOwner移管だけを行う。本番状態・Schema・QA197・歴史Evidenceは不変更。実Docker／Provider／再起動は実行せず、限定独立確認と直接文書伝播を行い、準拠基準不変更のため準拠監査は追加しない。現在人間判断は不要。

同移管の結果（限定完了）: Coordinator本番の回復本体からCLI cache／helper・CLI出所と環境生成の技術importを撤去し、固定factory入力は借用所在と同期Owner確認の二keyだけになった。低位実config試験と三fixtureの監視対象も同期した。両Packageの静的三軸、下位関連14/14（618.2478ms）、上位回復／認証限定終了の通常36/36（1417.4843ms）、台帳25/25（20110.9053ms）、Trace・二生成Projection・差分検査が成功。独立品質Minor CQ-N-Q01（余剰getterが非列挙でspread退行を見逃す）は両確認者へ統合照合後、列挙可能なgetterへ是正した。現行本文は三生成でgetter0、一意な実本文spread変異はgetter1・低位到達前拒否を確認し、製品Sourceは不変更。是正後の対象12/12（358.2211ms）とDI静的三軸＋全通常310/310（33140.7011ms）はExit0・Fail／Cancel／Skip0、契約／品質の最終残指摘0・限定Pass。元executor／close、環境とCLIの別理由、cacheの元寿命は維持した。自己生成current-recovery／recovery-executor試験領域残存0。実Docker・Provider要求・再起動・Commit／Pushなし。旧4File全体撤去、Native／HEAD不一致、旧配布graph、実保持物・次Task・実境界／E2E／Reality Auditは未完了。完全出力は既存試験入口から再生成できるため実行別書庫を追加しない。

M取消試験専用入口の撤去（2026-10-17、限定完了）: 最後の`normalizeDynamicFakeProviderCancellationForFixture`は本番Consumerを持たず、STの二Caseだけから呼ばれていた。契約／品質の着手前照合を統合し、試験側で廃止compositionを再構成せず、製品中継・専用型・未使用importと中継依存二Caseを撤去した。分類の反証は既存DI UTへ集約し、旧status0／SIGKILLも同じ配列へ移した。上位は既存post-missingの実本番本文からblocked・非Authority三fieldと観測済みack／終了事実を確認し、既に得た事実をfalseへ戻さない。child_process importのexact棚卸しを実Source23件へ同期した。私有関数・本番制御・QA197・Schema・DTO・歴史Evidenceは不変更、新API・新helper・試験用合成を作らない。準拠基準不変更のため準拠監査と実Docker／Provider試験はこの撤去の根拠にせず、固定候補の契約／品質独立レビューを実施した。現在人間判断は不要。

同撤去の局所結果: 対象5Fileの整形・Source／tests strict・warning禁止Lint、DI分類・本番上位投影・公開取消検証入口・相互境界の40/40（8150.3884ms）、台帳25/25（20578.8708ms）が成功、Fail／Cancel／Skip0・Exit0。初回型検査は試験VMの結果型に追加観測fieldがなかったため停止し、実結果の型だけを補い再実行した。製品本番の制御本文は変更していない。Traceの9資源／18状態／19遷移／10不変条件／7Bindingは受理され、二生成Projectionと差分検査を同期した。試験件数の二件減は重複中継Caseの退役であり、QA197義務の削減ではない。独立品質Minor CQ-M6-Q01を両確認者へ統合照合し、残ST一CaseのHeaderとCatalogを純粋planner／入口形だけの部分根拠へ訂正した。環境は既存node_process、終了条件はresult_observedとし、実Runtime／資源終端の成立を主張しない。訂正後のSource／tests strict・整形／Lintと台帳25/25（20490.8667ms）が成功し、契約／品質の最終残指摘0・限定Pass。DI全通常回帰も静的三軸＋309/309（33288.0257ms）成功。全体Native／HEAD不一致、旧配布graph、実保持物・次Task・実境界／E2E／Reality Auditと残る4FileはOPENを維持する。

M診断本体の配置・着手前照合（2026-10-17）: CLI／環境・raw技術実行・Host保存・記録codecを各既存Ownerへ分離したProbe本体は、診断順・上位二保存・同対象私有相関・公開結果・診断回復を所有する。両独立観点の照合を統合し、既存`diagnostics/`配下の`isolation-probe.ts`へ本文不変で物理移動する。current 18参照（CLI／doctor／検証script／動的Source読取り／tsconfig／Symbol／coverage／固定Path検査）を同期し、Symbol ID／Canonical ID／QA197・DTO・token・保存・理由・singletonは不変更。新File複製／re-export中継／Frameworkは作らない。Header以外の本文Hash、旧現在Path0、静的検査・公開入口／投影／Host排他／境界・台帳を確認し、固定候補の独立レビューを行う。準拠基準不変更のため準拠監査は追加しない。取消fixture正規化と4実行／回復File、通常起動・旧配布graph・全体GateはOPENを維持する。現在人間判断は不要。

同配置の結果（2026-10-17、限定完了）: Header除外本文SHA256は前後`07197407894f776c2085eb998a86aae5ba5653eabb808bb4765e92e3e8a15ff3`で一致。旧Sourceは不存在、`40_Develop`の旧Path参照0。Source／tests strictと対象整形・warning禁止Lint、公開CLI・本番投影・Host排他・回復・境界を含む13 Suiteの151/151（25122.3894ms）、台帳25/25（21311.3644ms）が成功し、失敗／取消／skip0・Exit0を確認した。child_process importのexact棚卸しは型専用を含む24件と一致し、実Process所有やRuntime許可の証明とは区別した。Shell禁止の全Source走査は維持した。契約Minor一件の「既存File」という誤読を生む句を両確認者へ統合照合して訂正し、それ以外は契約／品質とも残指摘0。残存docker-executionは4Fileであり、実行・回復本体の分離と旧フォルダ撤去、上記Native／HEAD不一致、別件の配布graph、動的coverage33/34、実境界／E2E／Reality Auditは未完了。実Docker・外部AI・再起動・Commit／Pushなし。完全出力は既存試験入口から再生成できるため、実行別Evidence書庫を追加しない。

M Probe記録のOwner集約・着手前照合（2026-10-17）: Probe回復の型・codec・実体照合・token／候補判定・記録読書き・子分類とmount再構成を既存host-execution/recovery-recordへ移す。HostとProbeのexact記録境界を同じOwnerで扱い、新File／Store／State／Lockを作らない。小さな安全読取りhelperは各Moduleのprivateに留め、共通Frameworkへ昇格しない。内部のgeneric名だけ用途明示名へ変更し、formatter／候補判定のscriptsとSTは新Ownerへ直接接続、旧互換wrapperは残さない。型はtype-only import、Root公開APIを増やさず、DI固定資源記述以外の技術判断を持ち込まない。両独立観点の照合を統合し、改名／export／import／Header以外の本文一致、初回null IDと確定ID再保存の実Writer→Reader全文・Hash・token／旧token拒否、token四軸・Root／marker／子実体・未知子／link／部分欠測と必須四用途、書込み前拒否を確認する。上位全Callerの二保存・fresh回復順・私有相関、既存結果recordとHost排他、Symbol／台帳／coverage固定母集団を追従し、既存閾値は弱めない。Schema／token文法／理由／時刻／JSON改行と保存順不変更。実Docker・Provider・再起動は0。限定独立レビューと直接設計伝播を実施し、準拠基準不変更のため準拠監査は追加しない。現在人間判断は不要。

同集約の結果（2026-10-17、限定完了）: 25宣言は改名／export／import差と二箇所のBiome整形だけを補正した本文Hashが全一致した。Probeは134224→102872 bytes、記録Ownerは14593→50934 bytes。新File・互換中継は追加せず、上位の私有Map・前後二保存とfresh回復順は維持した。実記録試験は制限内junction作成拒否を失敗として分離し、通常Host同候補1/1（335.1748ms）が成功。その後のEACCES反証追加を含む最終既存記録coverage44/44（7827.286ms）が成功し、recordは行99.63%／分岐86.86%／関数100%、対象二File全体97.67%／81.27%／97.62%で90／70／80閾値を維持した。上位四投影＋Host排他73/73（838.1823ms）、結果record14/14（2451.5501ms）、台帳25/25（21975.1196ms）、Source／tests strict・対象11File整形／warning禁止Lint、Trace／二Projectionと差分確認が成功。最初の投影4失敗は既存定数のHeader欠測により関数抽出が定数exportを巻き込んだもので、定数値不変の責務Header追加で是正した。移管Patchの区切り・反復行適用失敗は実物を再照合して残差だけを適用した。契約残0、品質Minor一件はQA6／DI設計の撤去済み三中継の維持句を両観点へ統合照合して是正し、固定修正版は両方残指摘0・限定Pass。Schema／歴史Evidence／非Authority説明は維持した。自己生成Probe記録・結果record試験の残存0。実Docker／Provider要求・再起動なし。

追加回帰の未解消（同日）: 動的Fake coverage入口は制限内・通常Hostとも失敗。固定34Caseを通常出力で確認すると33成功／1失敗で、既存passive doctorの通常Operation作成が`doctor_operation_initialization_cleanup_unknown`、内側は`host_recovery_namespace_initialization_failed`で停止する。読取り診断で、現在／IndexのNative SHA256は`a85d46241ba5cb4d771d2b6c493254262492935e3a5e9d20fea2bd486acc9cc9`、HEAD版は`dcebc4ee0ec8fa358dae0306d8e8a3cc1050c79a7e886573b388b5ee2fafcbf0`で不一致と確認した。既存provenance入口はHEADと照合してnullを返すため、制限だけの問題ではなく未Commit NativeとHEAD検査の不一致である。Index受理・Gate緩和や迂回Commitで補完しない。今回の記録44件の成功で補完せず、別件の旧Native配布graph未結合とともに通常起動・全体回帰のOPENへ保持する。閾値緩和、Case除外、再起動、追加Recoveryやwhitelistは行わない。記録集約の限定完了をDocker Isolation全体完成・Commit／Pushへ昇格しない。

M Host状態保存のOwner移管・着手前照合（2026-10-17）: Probe内のHost状態遷移関数だけを既存operation-workspace-lifecycleへ本文不変で移す。Docker CLI／Process／inspectを持たず、Host marker／token／adoptを所有するためである。新Module／Store／Lock／root公開APIは作らない。依存は同じHost Ownerの既存関数とrecord formatterだけに閉じる。両独立観点の読取り専用確認を統合し、兄弟回復関数の成功だけを直接根拠にしない。移管実関数のbegin／cancel／absent、marker全文・Hash・adopt順、null Capabilityの明示Root／adopt0、Root不一致・不正遷移の保存0、上位四投影と既存Host回帰、本文一致と設計／Symbol同期を確認する。token／Schema／bytes／同期順・私有Mapは不変更。実Docker・外部AI・再起動は発行しない。準拠基準不変更のため準拠監査は追加せず、固定候補の契約／品質レビューを行う。現在人間判断は不要。

同移管の結果: 本文SHA256は前後`98c75a4dbd44fafef43f97fcce259880a3c0b22f4dad3059b3777b7546b44b6c`で一致。Source／tests strict・整形・warning禁止Lint、最終通常Hostの実本文／実import／既存別Process再入場3/3（809.9179ms）、本番四投影9/9（611.3432ms）が成功。実importは元Capability更新・marker全文／Hashと正式回復後のRoot／marker不存在まで確認した。最初の追加試験は同期清掃、次は不存在確定後に通常清掃を使う誤りで失敗したが、製品遷移本体は不変更。正規の世代解放→同token回復へ修正し、試験の一次失敗・清掃失敗を分け、異常時の排他解放も追加した。各生存handleを停止確認してから再実行し、失敗自己生成4領域はPID／Path非使用・非reparse・閉じた内容を再確認して底から回収、残存0。最終成功は修正版だけの根拠とする。契約／品質の独立確認は両方残指摘0・限定Pass。ArchitectureのHost Owner記述、生成Projection二領域、Traceと差分検査を同期した。Docker／Provider要求・再起動は0で、実Docker成立や全体完成へは昇格しない。Probeの記録Reader／Writer・診断配置、他の実行／回復残存と旧フォルダ撤去は未完了。

M試験専用中継の撤去・着手前照合（2026-10-17）: 製品内の作成argv用fixture三関数は下位plannerの配列copyだけであり、本番Consumerを持たない。契約／品質の読取り専用照合で、下位六profileの固定Hash・全argvと上位本番搬送に固有保証が保持されることを確認した。中継専用一Caseは撤去し、取消Suiteは既存DI root plannerへ三Pathだけを明示投影する。新wrapper／互換入口は追加しない。QA197義務・他Case・保存／通信／Host順序・歴史Evidenceは不変更。Symbolの直接verifiesを同期し、静的三軸・下位planner／上位投影／取消Suite・台帳・独立確認を行う。実Docker／Provider／再起動／E2Eと全体完成の根拠にはしない。現在人間判断は不要。

同撤去の結果: 旧三関数の現行Source／tests参照0。Source／tests strict・対象整形／warning禁止Lint、下位実planner＋本番四投影＋取消Suite17/17（1043.7127ms）、台帳25/25（20250.7649ms）、Traceと二Projection更新、差分確認が成功した。契約／品質の固定候補レビューは両方残指摘0・限定Pass。準備時の削除区切り検索不一致は編集前に停止し、型検査コマンドの設定Path誤記も即時停止して実在strict設定で再実行した。Source保証の失敗と混同しない。試験専用三中継だけを撤去完了とし、残る正規化中継とHost記録／診断配置は引き続き未完了。

M未使用の正規化／評価中継の撤去（2026-10-17）: Repositoryの全利用側・現行設計／QAを照合し、通常隔離正規化・Lifecycle fixture正規化・最終評価fixture公開の三中継が定義以外に利用先を持たないことを両確認者と確認した。三定義と未使用VM代役だけを削除し、本番の私有投影／最終評価・候補相関・下位分類は保持した。新API・互換層・試験Case削減はない。分類関数が型参照だけになったLint警告をinline type importへ是正後、Source／tests strict・整形／warning禁止Lint、上位submission／completionと下位分類8/8（395.9557ms）が成功。旧三名の現在参照0、生成Projection二領域・Trace・差分確認が成功し、固定候補の契約／品質再確認は両方残指摘0・限定Pass。Probeは147406→137438 bytesとなったが、取消fixture正規化、Host記録・診断本体の配置と旧5 File撤去はまだ未完了。全体完成・実Docker成立・Commit／Pushへ昇格しない。

M固定bindingの限定確定（2026-10-17）: 品質指摘CQ-M-Q01（同期readerの拒否Promiseが未処理になる）とCQ-M-Q02（試験が実受信bindingでなく閉変数を観測する）を両確認者へ統合照合後に是正した。真正Promiseだけを組込みthenで即時消費し、待機・任意then/getter評価を追加しない。実Node子の二event-loop turn後にreject通知0・getter0・読取り1・mkdir0を確認。全Callerの実binding参照とfactory一回を観測し、copy変異を製品catch外のOracleで拒否した。関連15/15（890.9354ms）、DI静的三軸と通常全309/309（33535.2674ms）が成功、契約／品質の独立再確認は残指摘0・限定Pass。実Docker・Provider要求・再起動なし。先行試験残存owned-process-d9aWIQは内容・記録PID二件とPath使用Processの不存在・非reparseを確認し、ready.jsonと空Directoryだけを回収、終了後不存在を確認した。残fixture中継・Host record／診断本体・旧フォルダ撤去・全体Gateは未完了で、全体完成後だけCommit／Pushする。

M実装中の結果（2026-10-17）: 本番固定bindingを全Probe Callerへ接続し、CoordinatorのCLI WeakMap／Win32判定／環境生成を撤去。Hostの私有Container／absence参照と前後二保存は維持した。固定資源記述をDI作成・inspect・上位recordへ共通接続し、Image／Name／Label／Engineの値は変更していない。Attach試験専用export・Timer helperを製品から外し、同じ三故障の実Node子確認を下位既存Suiteへ移した。通常Host権限で1/1（3scenario、1295.0814ms）が成功、実Dockerは不使用。型検査で旧引数残存・closure代入のnarrowing・試験局所型を是正し、削除範囲が隣接型へ及んだ箇所は直ちに基準版と照合して復元した。上位4投影は当初旧VM依存により9失敗→全10/10（301.8748ms）。広い確認は旧Host VMとDI構成VMのimport残存を検出し、依存接続だけ是正後68/68（347.9855ms）成功。台帳25/25（20757.7161ms）、Traceと生成Projectionを更新。通常DI全回帰と固定候補の独立確認はこれから確定する。残fixture wrapper／Host record／診断本体の責務配置・旧フォルダ撤去・全体Gateは未完了のままである。

M着手前照合（2026-10-17）: Probe残存を技術構成・Host相関・検証専用へ分類した。既存DI probe-runtimeへ本番固定binding factory一つを置き、platform拒否→CLI snapshot観測→同期management読取り一回→固定env領域生成の旧順序を保持する。読取りcallbackは返却後保持せず、Host型・WriterをDIへ渡さない。fresh CLI検証は各技術要求直前に行い、通常／四故障／取消／稼働残存／fresh回復を同じbindingへ接続する。重複Image／Name／Label／EngineをDI計画由来へ統一し、Host前後二保存・rollback・record形式・私有Container／absence相関は維持する。attach試験専用面は製品から外し既存下位試験へ接続する。技術除去後に上位診断と記録を責務Ownerへ配置し、164KBをDIや別フォルダへ丸投げしない。契約／品質の着手前照合は統合案へ整合、現在人間判断は不要。既存四投影Suite／Host排他・直接Caller／coverage・Symbol／Catalogと設計を伝播し、固定候補レビューと影響回帰を行う。準拠基準・規範の変更はないため準拠監査は追加しない。実Docker・外部AI・再起動・全体完成はこの変更から主張しない。

L限定確定（2026-10-17）: 統合是正後のDI通常全回帰306/306（33773.1547ms、Exit0）、上位関連136/136（1484.0081ms）、Orchestrator静的確認と関連38/38（3081.1542ms）が成功。契約／品質の固定新版再レビューはともに残指摘0・限定Pass。台帳25件、Traceと生成Projectionも確認済み。実行loopの下位所有と上位開始保存の分離だけを限定完了とし、Coordinatorの5 File撤去、Probe／Recovery本体、配布の既知PA未結合、実保持物・次Task・実Docker／Session全体実Process／E2E／Reality Auditは未完了。全体完成前のCommit／Pushは行わない。以下のL「実装中」「独立確認前」「再確認前」は経過記録である。

L独立指摘と統合是正（2026-10-17、再確認前）: 契約Moderate一件はwait登録が同期開始通知の後だった起算差、品質Moderate一件は技術失敗と遅いACK失敗の複合Oracle不足、Minor一件はReceipt欠測時も位置比較が成功するOracleだった。両結果を集約して両観点へ是正計画を照合し、通知破損＋終端不明でも旧猶予後清掃を止めない条件付きwait消費で整合した。Provider waitを開始観測直後へ移し、拒否handlerも即時登録。上位はEPIPE／ACK拒否の二順序・清掃二形・ACK二形の八組を一次診断全文で確認し、二guardの個別省略変異を同じ試験で拒否。下位はReceipt exact一回／位置非負／先行を確認し、省略変異を拒否。通知後へwaitを戻す変異も同じOracleを破った。変異はメモリ内だけでSource／Filesystemへ保存せず、対照成功と個別失敗を分けた。wait移動変異の初回は試験準備の文字列不一致で未実行、対象を確認後に実行して拒否を観測した。実Host6件は制限内2成功4失敗（Native取得・子終端）で終了、自己生成Worker／親の不存在を再確認し、同候補の通常Host権限再実行6/6（3491.6167ms）は成功。実Docker・上位Session全体の実Process成立へ流用しない。

L固定候補の局所結果（2026-10-17、独立確認前）: 技術loopをDIの`execution/command-session.ts`へ移し、同Runtimeの私有start／cleanup／元結果照合を接続した。Coordinatorは不透明cancel／completionと有限hookだけを用い、下位の技術分類を再計算しない。新規製品Source一件に対し専用IT一件を追加し、既存Runtime／上位binderの実接続試験も補強した。上位開始確認の保留中に九目的・回収一回が完了し、公開だけが待つこと、遅い拒否／例外がblockedを保ち再実行しないこと、通知の例外／Promiseと認証拒否後の停止を確認。型検査で追加Runtime methodの旧fixture欠測とclosure値の過剰narrowingを検出・是正した。静的DI／上位Source／試験検査、DI通常305/305（33223.8876ms）、上位関連135/135（1432.059ms）、試験台帳25/25（21343.1614ms）、Trace 9資源／18状態／19遷移／10不変条件／7接続が成功。Semantic Projection二件を再生成した。実Docker・外部AI・再起動は行っていない。独立確認、Windows Process Gate、残存Probe／Recovery本体の移管、旧フォルダ撤去と全体Gateは未完了でありCommit／Pushは行わない。

実行loop移管L（2026-10-17、着手前照合完了・実装中）: 実CallerのTask開始通知はOrchestratorの開始保存Promiseへ接続しているため削除しない。一方でそのawaitが現Controllerの清掃まで止めるため、技術実行と上位開始確認を分離する。DIは九purpose・raw Handle・開始／待機／取消／技術分類／元清掃を所有し、Coordinatorは有限同期の許可・予定／未発行／実行予定／Receipt保存と認証／AI受理、上位開始確認・Mount／現在状態／公開結果を所有する。DIの同じRuntimeへ一回限りのcancel／completionを接続し、返却前hook0・Handle終端一回・清掃一回・元結果照合を維持する。試験用Candidateだけにprimitive seamを設けproductionAuthority false、本番Factoryは固定primitiveを維持する。新FileはDI execution/command-session.ts一件であり、汎用実行Framework／永続State／Registry／Lockは作らない。契約／品質の着手前照合はともに整合し、300秒起算を上位確認後からDI開始観測直後へ移す意味差を設計へ明記した。上位確認の暗黙の新期限は追加せず、保留中の取消／自然終了／技術期限でも清掃が進み、上位最終成功だけは確認settle前に公開しないことを反証する。変更分類は既存CHG内の責務分離と実行待機の是正。固定候補の契約／品質独立レビュー、直接伝播・通常回帰と既存Windows Process Gateを行い、規範／準拠基準の変更がないため準拠監査は追加しない。実Docker／外部AI／全体Gateは別途未成立を維持する。

構成診断の技術Owner分離（2026-10-17、限定レビュー完了）: CoordinatorのDocker／Codex option走査を撤去した。既存DI command-planが固定包装optionのarityと先頭位置imageを照合し、外側三設定と凍結した内側payloadを分離する。既存AI Adapter codex/execution-planはpayloadだけから承認・sandboxを分類し、Coordinatorは元相関とClaude適用外を含む既存通知だけを組み立てる。新File・PreparedPlan field・Store・Lock・Authorityは追加しない。payload中のDocker風flagを隔離設定と誤認していた診断差だけを是正し、payload内digest再出現は保持する。不正shape／Proxy／accessor・未知包装を固定fallbackへ閉じるが、falseは確認不能の診断値であり設定不存在・安全性成立ではない。契約／品質の着手前照合で意味不変移管と誤認是正の違い、delimiter全数一致の誤りを統合し、固定包装構文に従う最小案で整合した。Root公開集合・両下位設計・上位診断設計を同期し、既存Source／SuiteのSymbol・QA IDを維持する。実行・取消・資源回収・保存の本体と歴史Evidenceは変更しない。静的四設定成功、下位・上位関連120件と追加の実planner接続後125件（1025.8139ms）、DI通常294件（33537.7475ms）が成功。初回Lintのnon-null assertion、試験のunion narrowing不足、Task fixture欠測は検出後是正した。AI Adapter初回は公開集合の順序差、次はSandboxのhardlink EPERMでExit1、是正と同範囲の通常権限再実行で32/32（1896.4148ms）成功。実Docker・外部AI・再起動は行わず、通常起動／取消／回収の残存5 Fileと全体Gateは未完了。

残存5 Fileの次の処置は、単なる改名でなく次の責務境界で進める。

K初回の独立レビューは契約Moderate2（包装の値欠測、診断入力上限）・品質Minor1（descriptor継承値の受理）。全結果を統合して両観点へ是正案を照合し、入力診断だけを補強した。commands9／create argv420／Codex payload256を全descriptor取得前に確認し、最大形は実plannerから9／420を実測、各＋1を拒否する。包装値の`--`開始拒否と、必須key／valueのown確認を追加。隔離VMでHostを変更せず正常肯定・汚染accessor拒否/getter0・欠測key拒否を確認し、own-value検査省略変異は同じOracleを破った。静的四設定・整形・Lintと当該17/17（261.7646ms）が成功。補強後の通常回帰はDI296/296（33470.9524ms）、AI Adapter32/32（2384.2177ms）。Coordinator関連の再実行ではHost取消試験を含めて制限内のProcess終端拒否によりExit1、同じ3 Fileを通常権限で実行し128/128（1629.3555ms）が成功した。試験起因のProcessは限定したコマンド本文の現在観測で残存なし、通常権限の試験内でも子孫不存在を確認した。Catalog25/25（21114.8095ms）、Trace・Semantic二領域・差分確認も成功。固定候補を再レビューし、初回レビューを新版へ流用しない。

| 現在のFile | Docker Isolationへ閉じる処理 | Coordinatorに残す処理 |
|---|---|---|
| `process-controller.ts` | 九コマンドの順序・Handle・待機・期限・取消・技術終了と回収 | 許可、effect前の保存、認証／AI結果の意味、元操作への通知、Mount／現在状態の終了 |
| `isolation-probe.ts` | 診断用Docker実行、OS差、inspectと技術回収 | 診断用途の選択、許可、Host保存と公開診断への接続 |
| `recovery-lifecycle.ts` | CLI／実資源の再観測・技術処置の残余 | exact回復相関、現在状態・履歴、保持引渡しとConsumer受領 |
| `command-effects.ts` | 技術計画／実行／回収に残る判断 | AI AdapterのProvider計画と上位の照合済み入力を下位へ渡す接続 |
| `process-controller-result-reasons.ts` | 技術分類の生成は下位 | 利用者向けの固定理由語彙と公開結果の意味 |

実行loop移管では、CREATE前の元相関保存→要求発行→実Receipt保存、CREATE中取消でもReceiptを先に残すこと、開始観測拒否時の終端、一次失敗と清掃結果の分離、cleanup後の遅延取消、元操作の同ID再入場を維持する。上位の正本保存・認証／結果解釈を下位へ移さず、下位は登録された用途限定の接続だけを呼ぶ。詳細は既存Docker Isolation設計§6の通知・最終結果・配送失敗・終了後条件に従い、新Event Bus／Queue／共有状態を作らない。上位のraw Handle保持・Docker purpose loopが消えたことと、全利用側／反例の接続を確認するまで完了とはしない。

K再レビューで試験反証の範囲と、descriptor mapの継承getter発火順にMinor各1を検出した。両指摘を統合し、map経由の参照をやめ元入力からown descriptorを直接取得する方式へ簡略化した。index／purpose／argvのown-value三条件を個別に弱化する変異と、旧map lookup変異を同じ隔離VM Oracleで検出した。疎配列＋余剰key・継承getter・必須key欠測・accessorは正常版で拒否/getter0。旧lookup変異もnullにはなるがgetter1となるため検出でき、初回の変異結果Oracle期待違いを訂正した。Claude時の不要なCodex投影呼出しも省き、公開通知は同値。新版の静的確認、局所7/7（178.5341ms）、DI通常296/296（32499.0132ms）、Coordinator関連125/125（948.2775ms）、Trace・差分検査が成功した。実行／回復／保存の契約は変更せず、固定新版の契約／品質の再レビューは残指摘0で、この診断配置単位を限定Passとする。全体loop移管・旧5 File撤去・実境界と全体Gateは未完了のままであり、Commit／Pushは行わない。

Task公開・清掃判定と回復IDの配置整理（2026-10-17、限定レビュー完了）: Docker操作を持たない3 Sourceをtask/cleanup-eligibility、task/recovery-projection、state-storage/recovery-identityへ本文不変で移した。Task／controller／CLI／状態保存とcurrent-admissionの固定Path期待・動的importを同じ新Ownerへ接続し、対応UT2 Suite・12 Caseもtask配下へ移設した。公開理由Map・DTO・回復ID文法・freeze・不正shape拒否・清掃条件を変えず、未使用projectionの削除も行わない。新抽象・Module・Store・root exportを追加しない。契約／品質の着手前照合を統合し、実装詳細の配置整理として独立レビューと直接伝播を選択、準拠／公開基準の監査は追加しない。Symbol／verifiesと試験台帳のOwner・Path、Architectureを同期し、正式QA ID・197項目・歴史Evidenceは不変更。移管直前に取得したimport／File Header除外の本文Hash3件が移管後も一致する。静的三軸、関連338/338（16449.0366ms）、現在資源27/27（847.7544ms）が成功。Catalog初回は旧UT Path2件の残存でExit1、同期後25/25（21299.343ms）が成功。Semantic Coverage二領域とTrace9資源・18状態・19遷移・10不変・7bindingを再確認、旧現在参照0・差分検査が成功。executionは8→5 File。残る大規模な起動・観測・回収／Probe・配布、実Docker／E2E／Reality Auditは未完了であり、全体完成後だけCommit／Pushする。 契約レビューのHeader境界Minor1を実責務へ是正し、整形・Lint・当該5/5（189.4363ms）・差分確認が成功。契約／品質の再確認はともに残指摘0で、この配置単位を限定完了とする。

Provider準備一群の配置統合（2026-10-17、限定レビュー完了）: 操作・選定・Packet・Mount／Authority・短期WeakMapを所有する上位6 Sourceを既存providerへ移し、execution-adapter／execution-composition／execution-plan／preparation-lifecycle／preparation／execution-typesへ命名した。DIに上位の判断・状態を移さず、残るDocker技術処理の別名移動とも区別する。新Module・wrapper・Storeは作らない。両Provider facade・Task本番利用・UTは同じ新singletonを参照し、30秒二時計・一回消費・失効／Mount解放順・不明保持・乱数8→32・公開DTO・保存値を維持する。契約／品質の着手前照合を統合し、実装詳細の配置変更として独立レビューと直接伝播を選択した。準拠／公開基準は不変更。Symbol6 IDと全verifies、新Path、Coordinator／AI Adapter現行設計と配置表を同期し、QA ID197項目・歴史Evidenceは不変更。静的三軸成功。関連回帰はSandboxのリンク作成制限でExit1、同範囲の権限あり再実行で236/236（3601.2651ms）成功。Catalog25/25（20735.7825ms）、Semantic Coverage二領域再生成、旧6 Path／旧6 Symbol現在参照0、差分検査が成功。本文比較はindexに先行Eの乱数・資源名移管差分が含まれたため、その明示差分だけを補正し、import／File Header以外の6本文一致を確認した。実Docker・Provider要求なし。executionは14→8 Fileであり、大規模実行／回収・Probe・配布と全体実境界／E2Eは未完了。 固定候補の契約／品質の独立確認はともに残指摘0。準備6 Sourceの上位配置として限定完了し、残存技術処理や実Docker全体の成立へは拡張しない。

Host記録の相関検証統合（2026-10-17、限定レビュー完了）: Dockerを操作しない旧host-transition-stateの二関数を既存host-execution/recovery-recordへ統合し、validator／private canonical helperを責務名へ変更した。Token・Hash・改行・property順序・エラー理由・必須次状態の任意性・返却凍結は名前以外本文等価。model、回収Caller二箇所、準備ITの実関数VM注入を新Ownerへ接続し、UT現物2件をHost Owner配下へ移す。新Module・Store・Lock・互換wrapperは作らず、旧Sourceを撤去した。Symbol／CatalogはSuite1→1、正式QA ID197件・歴史Evidenceは不変更。契約／品質の着手前照合を統合し、実装詳細の責務再配置として直接伝播と独立レビューを選択。準拠基準／公開要求の変更はないため当該監査は追加しない。静的三軸と関連31/31（1275.7749ms）、二関数の名前正規化後本文等価、旧現在参照0、Semantic Coverage二領域再生成と差分検査が成功。JournalにHost記録Module全体と既存Host ITを加えた新coverageは、初回Sandbox内のjunction EPERMでExit1、同範囲の権限あり再実行で41/41（7699.2406ms）・97.18/79.43/97.01が成功した。旧小Moduleの母集団と同一とは表示しない。Catalog25/25（20683.1894ms）も成功。契約／品質の実装残指摘0、文書の時点表現Minor1を同期した。実Host遷移・保存・清掃の本番同等接続noneは1/1（84153.8531ms）成功、自己生成Root残存0。実Dockerは代役であり実Docker全体成立へ拡張しない。実Docker／外部AI・全体Gateは未実施、executionは15→14 File。

保存判定の所有先統合（2026-10-17、限定レビュー完了）: 旧recovery-state-machineのJournal専用三分類を既存Journalへ、Snapshot再入場分類を既存settlement-storeへ本文等価で統合した。未使用の解放集約・説明・定数と旧Sourceを撤去し、executionは16→15 File。旧UT8件は現役6件を責務別UT二Suiteへ移し、未使用集約2件を退役した。未知／不正件数を含む清掃拒否を補強し、repair-ownerは移管後の実関数をVMへ渡す。新製品Module・Store・Lockなし、保存Schema・Writer順序・Host lineage・正式QA ID197項目・歴史Evidenceは不変更。契約／品質の着手前照合を統合し、実装詳細の責務整理として独立レビューと直接伝播を選択、準拠／公開基準を変えないため当該監査は追加しない。静的三軸、関連34/34（9506.1902ms）、補強後UT6/6（440.8074ms）、Catalog25/25（15747.7981ms）、関数本文4件の等価比較とSemantic Coverage二領域再生成が成功。Journal＋Host遷移のcoverageは96.93/79.04/96.83で閾値90/70/80を維持するが、旧Snapshot込み母集団と同一とは表示しない。Snapshotは専用UTと実Writer再入場で別に確認する。実Writerの未出版pending三切断窓はExit1で、outcomeの再入場後state全文一致assertが失敗した。この失敗後は原因不明のまま再試行せず、現在Callerの履歴確定と試験のpublication-only期待を切り分けた。自己生成repair-owner Root残存0。契約レビューの文言Minor2を時点限定と両File Headerで是正し、契約／品質の再確認は残指摘0だが、Host失敗の是正・確認まで本単位の物理Gateは未完了。初回整形の一時的な共有Fileエラーは再実行して解消した。全体Gateは未完了、Commit／Pushは全体完成後。 原因はoutcome出版後に履歴2版を確定する現行Callerに対する旧Oracleだった。製品は変えず、透過rename観測で初回pending完全一致、後続は正規時刻と実modelから再導出したexact二版・履歴一行・改訂+2・元操作不変・技術取得0を確認するよう是正した。旧元版Writer拒否と重複pendingも確定後本文／履歴不変へ接続した。是正後の静的三軸、実Host4/4（202343.9197ms、identity/checkpoint/outcome三切断窓）が成功、試験Root残存0。実行前の契約／品質再確認も残指摘0で、旧失敗を新版成功へ流用していない。残りの実Docker／全体Gateは未完了。

本番実行物・環境compositionのDI固定（2026-10-17、限定レビュー完了）: Coordinator command-effectsのCLI初回／再確認helperと環境注入をDI既存本番factoryへ移し、公開入力を借用所在／Receiptだけへ縮小した。CLI二失敗理由、起動・短期観測・cleanupのfresh確認順は維持し、内部Candidateだけを試験用genericとする。上位とHost境界試験の二Callerを更新し、Engine／環境／終端説明はDI固定投影の同値転送へ変更。未知key・技術依存・Accessor・Proxyを観測前拒否し、固定Factory実本文→実Candidateの局所接続を追加。整形・Source／test／Host試験strictと警告失敗lint、固定説明期待を含む関連22/22（1045.8984ms）が成功。DI通常npm testは292/292（32710.7826ms）、Catalog25/25（16376.4179ms）、Semantic Coverage二領域再生成、差分検査が成功。初回型／Lint指摘は試験前に是正した。公開Factoryの無観測構築肯定も加え、固定候補の独立確認へ渡す。ファイル数は16のままだが、上位の環境選択を除去する実責務移管である。実Docker／外部AIなし、全体Gateを維持する。 独立確認のCQ-F-Q01ではdescriptorの継承valueと任意観測省略の実効継承参照を検出した。own descriptor検査とCandidateへのown undefinedで閉じ、隔離VMの正負対照・旧in変異を追加。最終DI通常293/293（32937.9103ms）、上位strict三種・警告失敗Lint・Effect9/9（1010.4058ms）が成功し、契約／品質の再確認はともに残指摘0。全体完成ではない。

資源名・乱数検査のDI移管（2026-10-17、限定レビュー完了）: 旧`provider-resource-plan.ts`の技術生成をDI既存command-planへ移し、上位Sourceを撤去した。乱数Ownerと取得順は上位、有限namespace・型／長さ・hex化・命名防御はDIとし、既存6field・九command・永続Identity・Provider／権限判断は維持する。旧直接UT一件はERB-UT-023へ移し、上位両Providerの取得順・資源名／label／command接続と不成立時のMount返却／発行前停止を補強した。静的三軸と関連40/40（549.6782ms）が成功。上位ITは初回起動flag不足で26/27・Exit1、正規module mock設定で27/27（1067.9111ms）。DI通常は初回の新2export期待未同期でExit1、期待同期後のnpm testは291/291（32315.4788ms）、Catalog25/25（14516.318ms）、Semantic Coverage二領域再生成が成功した。独立確認のOracle Moderate1・用語と現在投影Minor2を統合し、正常実planと変異を共通の正規位置Oracleへ渡すよう是正した。用語・移設UTのローカル名も同期し、補強後の静的確認と40/40（555.6133ms）、差分検査が成功。契約／品質の限定最終再確認はともに残指摘0。executionは17→16 File。全体Gate・実Docker／外部AI未実施、全体完成後Commit／Pushの条件を維持する。

未使用の旧排他・結合補助の撤去（2026-10-17、限定レビュー完了）: 本番Consumerが0になった`docker-execution/recovery-lock-controller.ts`と`state-binding.ts`、専用IT／fixture／UTを撤去する。旧controller IT2・UT3、旧binding UT2の計7 Caseを退役し、当時はstate-machineの同期解放集約2件・Snapshot判定を保持したが、後続の保存判定所有先統合で集約は退役、Snapshot判定はsettlement-storeへ移管した。現行のKernel／Owner／資源／再起動準備とJournalは維持する。新しい排他・互換helperは作らない。正式QA ID・197項目・歴史Evidenceは不変更。coverageの旧2includeと専用2試験Pathだけを除き、残る3Sourceと90/70/80閾値は維持する。Symbol／CatalogとQAの旧一時解放に関する現在主張を同期する。着手前の契約／品質確認を統合し、整形・Source／test strict・警告失敗Lint、現行資源／再起動準備／状態判定／model64/64（2097.224ms）、実Kernel三domain1/1（234.9151ms）、Catalog25/25（14918.0141ms）が成功。Semantic Coverage二領域を再生成し、diffcheck成功。固定候補レビューの文書Minor2件を是正し、契約／品質の限定再確認はともに残指摘0。executionは19→17 Fileとなるが、残存技術処理・配布・実保持物／次Task・実境界／E2Eの全体Gateは未完了である。

旧Desktop／回復一覧経路の撤去（2026-10-17、限定レビュー完了）: Desktop記録3 Source、旧record-model、旧verified-root回復／Inventory／ACK／correlation／receipt群を撤去し、`src/docker-desktop/`の実不存在を確認した。共用canonical・CLI確認・固定DI操作型と、現在の開始／終了・資源／Host／Owner・保存／受領・再起動5操作は保持する。旧3 UT・Session handoff／worker・同意Inventory結合Suiteを退役し、一般同意保証は既存同意Suiteへ、現在Capabilityはruntime Suiteの5 Caseへ、公開loader相関は既存Host故障試験へ対応した。旧形式graphの4 binding・3状態・3遷移・専用不変条件を退役し、現在Traceは9資源・18状態・19遷移・0試行分類・10不変・7 bindingで受理。正式QA ID・設計総数・歴史Evidenceは変更しない。関連123/123（10720.683ms）、marker追従後の資源／Trace36/36（867.7502ms）、Host loader1/1（405.1187ms）、Catalog25/25（15320.8556ms）、DI通常290/290（33063.8948ms）が成功。長い上位回帰は26/27・Exit1（275763.0162ms）で、失敗は是正前の旧marker一件、Objectiveとmodel各Caseは成功したが統一greenとは表示しない。Source／試験／graphと文書伝播の是正後、契約／品質の限定独立再確認はともに残指摘0。現在execution配下は19 Fileで、最終責務配置は未完了。配布の既知PA未結合、実保持物・fresh Task、初期publication／Host喪失／再ログオン／稼働Containerと全体E2E・Reality Auditは残る。全体完成後だけCommit／Pushする。

以下は先行単位の記録であり、数値・未撤去・「次」は各時点の状態を示す。現在状態は直前の撤去結果を参照する。

旧記録撤去前の現行保証分離（2026-10-17、限定レビュー完了）: `state-storage/model.ts`が借用していた`exactRecordKeys`／`validateHostSnapshot`を同Fileのprivateへ本文等価で移し、旧record-model importを除去した。旧定義の短期重複は旧消費者の一体撤去までに限定する。現model経由の正常Host肯定・token／Hash差・子Identity余剰field拒否を追加し、静的三軸とmodel／修復／再起動30/30（1213.4615ms）が成功。旧回復Suiteの現行再起動準備拒否Caseを既存準備Suiteへ、現在5操作・DI root・Package境界Caseを既存再起動Suiteへ移設し、両Header／SymbolへQA-000003・PRL-IT-013を伝播した。ACK2Caseの不足反例は既存Orchestrator settlementへ統合し、旧SuiteからCase／専用importを除去。Proxy trap直接0と旧ACK／別Attempt各実入力の独立全文不変を補強後、静的確認、再起動38/38（692.8895ms）、Catalog25/25（15599.5733ms）、Orchestrator mock入口1/1（229.7424ms）・通常入口1/1（394.1967ms）が成功。両独立再レビューは残指摘0。Semantic Coverage二領域を再生成し、Traceは9資源・21状態・22遷移・0試行分類・11不変・11bindingで受理。旧API・Inventory・Desktop3 Sourceはまだ撤去しておらず、旧Suite全削除、実Host公開loader相関の残確認、実再ログオン等の未置換Gateは次の閉集合へ保持する。全体完成・実Provider E2Eは主張しない。

実Provider検証の旧一覧依存撤去（2026-10-17、限定レビュー完了）: 検証Scriptから旧全域Inventoryの動的importを除去し、同一対象操作の七段階・Identity・改訂順序と公開結果を共同で照合する方式へ切り替えた。報告契約は改訂11とし、対象操作の終了をRepository全体の空状態へ拡張しない。取消では完全なProvider終了診断と正常完了またはTree終了を必須とする一方、上位のunknown・回復義務を保持する。親喪失では旧親のsettled通知を仮定せず、fresh再入場の耐久ACK後終了を確認する。相関省略・共同判定無条件化・別Identity・欠測・重複を反証し、静的三軸、関連38/38（4813.1913ms）、検証Tool Graph1/1（839.8149ms）、Catalog25/25（15404.4895ms）が成功。既存Graphのmain二Hashだけを固定Sourceへ同期し、許可範囲は広げていない。契約／品質の限定独立再確認は残指摘0。実Provider E2E・全体Passは主張しない。次は旧回復API・Inventory・旧record model・Desktop残3 Sourceと専用試験を対応付けて一体撤去する。配布18/19の既知PA未結合、execution20・実保持物／fresh Task・全体検証は未完了。

現在再起動Callerの配置確定（2026-10-17、限定レビュー完了）: `docker-desktop/restart-recovery.ts`を`diagnostics/runtime-restart.ts`へ移動した。index保存版との比較でFile Headerの`@packageDocumentation`追加以外は処理本文完全一致、相対import深さ・公開関数名・現在checkpoint／保存契約は不変更。CLI、query付きauth verifier／simulation、Host worker、再起動IT、Symbol IDと参照を新配置へ同期し、旧Path／IDの現在参照0を確認。旧公開境界Caseの不存在module／旧API期待を、現在5操作の私有接続、DI公開Root、checkpoint型、exact二exportsと実private subpath拒否へ修正した。レビューの星再公開／private追加import見落としMinorを同じOracleと反例で是正し、契約／品質の限定再確認は残指摘0。静的3軸、再起動／準備36/36（626.8941ms）、是正後境界1/1（703.3189ms）、auth／Host worker局所11/11（734.7701ms）、実Hostの再起動代役→移動Caller→保存→通常CLI一件（44410.2583ms）が成功。実Docker再起動・外部AI・認証情報は使わず、自己生成Host試験Root残存0。Semantic Coverage二領域も再生成済み。Desktop配下は旧再起動記録3 Sourceだけになった。次は実Provider検証Scriptの旧global Inventory依存を同exact operationの現在終了証拠へ対応付け、その後に旧API／Inventory／record model／記録3 Source／専用旧試験を一体撤去する。現在の結果が証明しないRepository全体空を捏造せず、新State・Registry・Lock・互換Readerを追加しない。残execution20・実保持物／fresh Task・全体回帰／Reality Audit／実境界／E2Eは未完了、Commit／Pushは全体完成後。

旧修復4 Sourceの閉集合撤去（2026-10-17、限定レビュー完了）: `repair.ts`、Record Store、Continuation Store、hardlink履歴出版を削除し、専用4 IT・support・workerも撤去した。現在のManifest Consumerは11から10へ減り、最後の旧修復`preparedBoundary` Gateとcurrent assuranceを除去した。v0.21固定比較、任意配布相関、旧再起動記録4 Sourceと他45 Caseは維持する。Symbol8登録・Catalog4登録と旧REPAIR-HISTORYの41要素／境界map14を削除し、現行Callerのcheckpoint／履歴／保持へ結合ブロックを同期した。正式Local ItemのID・意味・設計総数197・歴史Evidenceは不変更。旧Stage専用の状態遷移反例と正常期待件数の残存、旧wrapper撤去後のloader期待、Headerの時点矛盾を是正した。静的3軸、Trace／loader15/15（325.4569ms）、current／v0.21・反証5/5（6206.7638ms）、Catalog25/25（22882.4854ms）、台帳9資源・21状態・22遷移・0試行分類・11不変・11bindingの受理とSemantic Coverage二領域再生成が成功。契約／品質の限定再レビューは残指摘0。配布全体は18/19（8784.3519ms）で既知のPA child_process未結合を維持し、これを成功へ含めない。Coordinator Desktopは8から4 Sourceへ減った。残4とexecution20、旧残余API、保持物・fresh Task、全体回帰・Reality Audit・実境界／E2Eは未完了。追加Docker再起動／外部AI依頼は行わず、全体完成後だけCommit／Pushする。

旧修復Store撤去の準備（2026-10-17、限定レビュー完了）: 現在の実行経路が使用しない旧Inventoryから、旧Desktop Directory名だけを特別許可するimportと分岐を撤去した。旧名Directory／File／類似名／Linkは既存unknown-entry拒否へ入り、本文・兄弟markerを変更しない。空Rootの正常対照を含む一件を、既存の検証済みRepository内試験Rootと即時cleanup hookへ接続し、Host限定1/1（471.9191ms）・当該prefix残存0を確認。制限内junction作成EPERMは別の失敗として保持する。他45 Case・現在Reader・製品の保存Schemaは不変更。

旧Store専用試験が持つ`ERP-IT-001`の一般保存保証は、既に同IDを所有するExecution Intelligenceの既存ITへ接続する。実Orchestrator記録入口と組込みアプリの公開Recorderから、同一自己生成Repositoryの実Writer／Store／Readerへ各一件を保存し、識別情報・観測元・時刻・欠測・結果全文を独立期待へ照合した。再送とReader後のbytes不変、入力前後不変、Lock／一時物残存0も確認。既存の並行・部分保存・衝突・不正入力反証を複製せず維持し、別契約のverification-result-recordへ付け替えない。レビューの期待／入力参照共有Minorをclone分離で是正し、両専門再レビューは残指摘0。修正版の書式・strict・warning禁止Lintと全83/83（13941.9671ms、Host Exit0）が成功。先行の制限内全回帰81成功・Git/MSYS拒否1・link skip1は成功へ含めない。新Store／API／Framework・Provider実行は追加していない。次は旧修復4 Source／4 Suite／support／worker・current Manifest Gateと登録の閉集合撤去。Desktop8／execution20、旧残余API、物理保持物・fresh Task、全体回帰・Reality Audit・実境界／E2Eは引き続き未完了で、Commit／Pushは全体完成後とする。

旧修復CLIと署名修復後wrapperの撤去（2026-10-17、限定レビュー完了）: 契約／品質の着手前照合を統合し、旧adopt／close／after-repairと署名Root指定をparser・Help・実分岐から削除した。専用dispatcherとAfterVerified wrapper、commandの到達不能な旧Task fallbackも撤去。現行のrepair／retain／restart／recoverは維持する。旧形式の表示は廃止commandでなくフロントAI移行へ案内し、旧chainを現在stateへ推測変換しない。current Consumerは12から11へ減らし、旧wrapper前提の三assuranceはv0.21比較へ限定、再導入は現Sourceで拒否する。残る`repair.ts::preparedBoundary`のManifest Gate、旧namespace・record群・旧46Caseはこの単位では撤去しない。Arch／QA／Symbolを直接同期し、歴史Evidence・v0.21比較・認証unknown限定classは不変更。旧四flagの単独／値付き／混在両順序は実binからUsage64・Process／同期保存0、実分岐ではRoot／Writer前拒否を確認した。実bin反証1/1（7511.7423ms）、CLI options全15/15（14139.4533ms）、現CLI選択5/5（480.1938ms）、再起動／準備／修復Caller62/62（4946.9435ms）、現Consumerと旧比較2/2（7832.1673ms）、静的検査と両台帳は成功。途中の試験型・未使用import・古い期待値は追従し、Biomeの一時的共有File書込み拒否は同じ対象の再実行で解消した。独立確認の文書伝播漏れ（Arch概要／QA006／Workflow）と、旧仕様の合法完全形不足を是正した。完全形4入力を含む実bin全20入力・routerのRoot前拒否・現行6経路肯定とcurrent／旧比較を最終3/3（9544.4114ms、83584 Exit0）で確認し、契約／品質の再レビューは残指摘0。配布全体は18/19（10303.8739ms、Exit1）で、従前と同じPAのchild_process未結合一件を残す。実Docker再起動・late create・再ログオン・E2Eの成立やDesktop全廃を主張しない。

旧再起動実装の撤去（2026-10-17）: 製品ConsumerのないCoordinator `docker-desktop/restart-execution.ts`と`restart-state.ts`、専用UT／ITを削除。技術保証はDIの既存Machine／固定Runtime、保存と再発行拒否はCoordinatorの現在checkpoint／Callerに対応付けた。旧phase再生・WeakSetを移植せず、新Frameworkは追加しない。両専門確認を統合し、DI既存ITへ停止要求とabortの応答順二形、および許可喪失＋release不明／取消＋abort例外の反証を補強した。Symbol4登録とCatalog2登録を撤去し、旧試験に依存した二つの保証参照は現行三Suiteへ接続。DI再起動73/73（192.9778ms）、Coordinator再起動／準備36/36（566.7781ms）、Catalog25/25（15187.2574ms）、両台帳・静的検査は成功。契約／品質の固定候補レビューは残指摘0。続くDI通常全回帰の初回Exit1は、先行追加した同期exportがVM切出しに残る試験側構文エラーだった。既存2試験の4箇所で同期export修飾子の除去だけを追加し、assert・製品・変異条件は不変更。局所18/18（366.5207ms）と限定独立レビュー残指摘0を確認後、DI通常全290/290（32817.3094ms、Exit0）を確認した。初回失敗を成功へ含めない。CoordinatorのDesktop Sourceは10から8へ減ったが、残8とexecution20、物理保持物・次Task・上位全体回帰／実境界の完成は未成立。

旧保持候補APIの撤去（2026-10-17）: `prepareCoordinatorStateRepairRetentionSnapshot`と一般遷移の旧保持例外を削除した。期限付き引渡しへ前提条件を直接統合し、改訂と元版参照は一回だけ生成する。旧値の読取り・履歴bytesは維持し、codec合法な旧判断候補の新規出版は拒否する。Headerの未接続表記も既存専用Writerへ同期。Formatter・Source／試験strict・Warning禁止Lint、関連51/51（4538.066ms）は成功し、契約／品質の限定レビューで実装指摘なし。実Hostの新規実測・次Task・物理保持物・旧Dockerフォルダ撤去・全体検証の成立は含まない。

保持Caller／CLI限定接続の結果（2026-10-17）: 初回固定読取り・一度の7日期限・専用Writerから履歴／終了へ接続し、公開期限・入力ID照合・停止表示を更新した。独立Moderate2（retainのhistory.pending再開漏れ、操作不存在再入場後のblocked保持表示拒否）を、既存HistoryReader共通化とobserved限定の技術flag条件で是正。旧receipt欠測の保存前拒否、再入場の観測／日時生成0、元receipt全文・一行・除去・前後期限一致を確認した。Header Minorも説明だけ同期。最終Formatter・Source／試験strict・Warning禁止Lint、Caller26/26（4440.9871ms）、CLI2/2（502.1898ms）、実Host通常／state中断／history中断の4/4（207975.6597ms、親含む）は成功。契約／品質とも残指摘0、自己生成Root残存0。先行失敗は旧期待・試験fixtureの型／counter基準を是正したもので、成功へ含めない。旧保持候補API撤去・次Task・実保持物、旧Coordinator Dockerフォルダ・署名graph撤去、全体回帰／Reality Audit／実境界／E2Eは未完了。Commit／Pushは全体完成後だけ行う。

保持Caller／CLI切替の着手前整合（2026-10-17）: 初回の固定DI読取り→一度のUTC期限生成→専用Writer→既存履歴／終了へ接続する。保存済みreceipt再入場は観測・日時生成をせず、Reader前後期限一致を確認。旧receipt欠測値は昇格しない。契約／品質の照合で、終了済み再入場の技術flagは通常終了と同じくfalseのまま、検証済みcompletion／履歴／exact ID／正規期限／CLI解除で引渡し表示を行うと確定した。新provenance field・State・Lock・回復管理は作らない。旧候補APIの撤去、実Hostの切断／再入場・次Task接続と全体検証は本番切替後も確認する。

保持引渡し終了候補／Readerの限定接続（2026-10-17）: 有効receipt付き第三形、操作ありの候補＋exact履歴行、操作なしの検証済み行からの期限搬送を接続。履歴初回時刻の未接続もreceipt.decidedAtへ是正し、pending固定時刻を最優先・通常形は従来どおりとした。独立品質指摘の「操作除去後、codec合法な旧receipt欠測行の拒否」を試験へ補強。最終Formatter・Source／試験strict・Warning禁止Lint、関連50/50（4251.9429ms）、実Host1/1（171396.7872ms）、portable1/1（608.4577ms）、Runtime台帳検査は成功。契約／品質とも残指摘0、自己生成Root残存0。Caller／CLI・前後Reader期限一致・fresh Task、実保持物の引渡し、旧Coordinator Dockerフォルダ撤去と全体検証は未完了。先行Host成功は補強後候補の根拠へ流用しない。

保持引渡し終了の着手前整合（2026-10-17）: 契約／品質の両照合で既存終了の第三形と期限metadata搬送を先行する。有効receipt付き保持だけを終了候補に加え、技術終端・履歴確認・参照0等を維持する。Readerは操作ありのexact履歴一致または操作なしの検査済み行から期限だけ返し、blockedと通常二形はnull。期限到来を終了条件にしない。Caller／CLI切替は後続で、Reader前後の期限一致、既保存receiptの再生成禁止、通常完了から保持成功を推定しない条件を接続する。

期限前履歴保護の限定接続（2026-10-17）: 検査済みreceipt由来の条件付きmetadataを既存Reader返却へ追加し、期限前／通常保持期間／active参照を独立ORで接続した。active confirmedでも行欠測は拒否し、操作除去後の期限同時刻以降だけ通常保持期間へ戻す。line・要約Hash・行Hashと旧非handoff形は不変更。Formatter・Source／試験strict・Warning禁止Lint、関連値モデル25/25（1374.9677ms）、既存Runtime台帳検査は成功。契約／品質の限定レビューは残指摘0。初回の試験型推論エラーと旧履歴fixtureの段階抜けは是正し、失敗を成功件数へ含めない。Caller・completion・CLI・fresh Task、実引渡し、旧Coordinator Dockerフォルダ撤去・全体回帰／実境界は未完了。

保持引渡しWriter／pending限定接続（2026-10-17）: 製品欠陥なし、独立指摘の合法checkpoint差拒否と共同status／解放Oracleを試験へ補強した。修正版のFormatter・Source／試験strict・Warning禁止Lint、model20/20（1137.5673ms）、portable1/1（531.8774ms）、実Host1/1（166734.1423ms）は成功。契約／品質の再確認は残指摘0、自己生成Root残存0。初回Host成功や試験型エラーは修正版根拠へ流用しない。次は検査済みreceipt由来の期限前履歴保護だけを接続する。両専門照合に従い、activeな保持履歴はconfirmedでも行必須・期限と独立保護とする。Caller・completion・CLIと実引渡しは未接続である。

保持引渡しWriter／pendingの着手前整合（2026-10-17）: 契約・品質の両照合は整合。既存保存用途へ`retention_handoff`を明示追加し、外側／Kernel共通validatorと専用出版modeへ接続する。通常用途へのfallback、同値特例、新Store／Lockは追加しない。保存前切断と保存後metadata残存を実Writerで確認し、候補日時・三用途・改訂・元版Hashを再生成しない。Caller・履歴期限・completion・CLIは今回の単位では未接続とする。

上位receipt純粋候補の最終結果（2026-10-17）: mixed absent二形の肯定と、codec合法なcheckpoint一軸差に対する全文再導出拒否を既存UTへ補強した。Header／Archは明示保持receiptだけの非Authority Node実体投影へ同期し、製品処理は不変更。最終Source／試験strict・対象Formatter／Warning禁止Lint、Coordinator45/45（4537.5537ms）、DI16/16（636.8031ms）、契約／品質の限定再確認は残指摘0。元Callerと旧非handoff bytesを維持する。専用Writer／pending・期限前履歴保護・completion・Caller／CLI・fresh Task・実引渡しと旧Coordinator撤去は未接続であり、以下のレビュー待ち表記は当時の経過である。

上位receiptの純粋候補を実装（2026-10-17）: 既存保持入口は不変更のまま専用Handoff候補／全文再導出を追加した。条件付きretentionはcanonical UTC・exact7日・元checkpoint用途相関を必須とし、一般遷移からの導入／変更を拒否する。新handoffだけsummaryへ投影し、履歴時刻をdecidedAtに固定する。DIの既存identity検査を再利用するtargets decoderへ型所有を集約し、独立コピー／hostile拒否を確認した。Source／試験strict・対象Formatter／Warning禁止Lint、DI Package静的checkが成功。Coordinator model／Caller45/45（4557.8503ms）、DI関連16/16（636.8031ms）が成功した。初回Lintのoptional chain一件は是正済み。専用Writer／pending・期限前履歴保護・completion・Caller切替・CLI・fresh Taskは未接続。独立レビュー待ちで、全体完成・Commit／Pushは未成立。

上位receiptの着手前整合（2026-10-17）: 専用純粋候補と条件付きsummaryから先行する。現retain Callerは維持し、新候補の物理保存・期限前履歴保護・completionは未接続とする。新receiptだけ正規UTC・exact7日・元checkpointとの用途別実体相関を持ち、一般更新は導入／変更を拒否する。既存Node実体検査をDIの純粋targets decoderで再利用する。契約／品質の照合で、旧Callerを先に壊す案は専用候補の一時並存へ訂正し、receiptを無期限保護する拡張案は採用しなかった。期限後の診断履歴整理と物理削除は別Effectであり、利用者管理への引渡し後は永久再特定を保証しない。切替後の旧候補撤去、Writer／pending・CLI／履歴／終了・fresh Taskを残件として維持する。

保持照合の下位読取りは限定完了（2026-10-17）。独立指摘の最終read後guardと独立コピーのOracle不足を、既存試験の6回目限定4失効・post各一件省略変異・入力別参照／未凍結維持で是正した。製品処理は不変更。最終Package静的check、関連4/4（626.4551ms）、契約／品質の再確認残指摘0で限定Pass。新Hash・Store・Lock・Repair Native Session・物理処置なし。次は上位のreceipt保存、exact7日と期限前履歴保護、一行出版・引渡し終了・利用者案内を接続する。実物理対象・旧Coordinator撤去・全体完成は未成立。

期限付き保持の着手前照合（2026-10-17）: 日付だけでは操作除去後に同名別実体を区別できないため、明示保持限定で三用途の既存Node実体を既存一行履歴へ条件付き投影する。追加Hash・Store・Lock・Registryは作らない。下位は固定Artifact／KnownFolder／元Scopeと二読取り、上位は時刻・exact7日・保存／読戻し／解放・期限前履歴保護・終了を所有する。nullは元retained absent＋not_required＋fresh二回absentに限り、expected非nullの正規継続世代も許可する。契約／品質の二確認へ具体境界を統合済み。今回は下位読取りから実装し、保持引渡し全体や旧Coordinator撤去を完了扱いにしない。独立レビュー・関連静的／局所検証・必要な実境界を維持し、準拠基準・Communication変更はないため当該監査は追加しない。

保持照合の下位読取り候補: 既存repair-runtimeへ固定入口を追加し、実decoder・元Scope・三用途の二読取り・各境界前後の現在確認・独立凍結コピーを接続した。初回strictでfactoryの明示不存在実値が`confirmed_absent`であることを検出し、checkpoint側`absent`と分けて是正した。最終Package静的check（三軸、67 File）と回収／保持照合・公開集合の関連4/4（638.1834ms）が成功。正常・元から不存在・expected非nullの不存在・live source存在、観測差・失効・途中失敗を模擬技術境界で確認し、用途写像とexpected-null過剰拒否の本文変異は同じ期待で拒否した。実Filesystem・実Docker・上位保存・履歴／期限／終了・保持引渡し全体は未確認。独立レビュー待ちであり、Package全体完成・Commit／Pushは未成立。

一回出版・終了接続の最終結果（2026-10-17）: 下記の契約／品質指摘を統合是正し、両独立再確認は残指摘0・この単位の限定Passで確定した。実Filesystem Host限定確認は成功済み。実物理削除・保持引渡し・配布閉包・旧経路撤去・Package全体は未完成である。以下の再確認待ちは当時の経過を示す。

2026-10-17の縮小判断: 通常discardは三用途の不存在確認後に既存修復履歴へ一度だけ出版する。別種別・別Writer・二行管理は採用せず、`disposal`は判断時刻とcheckpointだけとする。既存純粋試験には回収途中の履歴出版を許す反例があるため、既に不可能だったとは扱わない。codec・要約生成・履歴Reader・completion・Callerの全Gateを同じ条件へ揃え、要約確定後のprogressも拒否する。非discard要約と過去Evidenceは不変更。明示保持の7日引渡しは別の未完了条件として維持する。契約／品質の両確認へ方針照合済みで、新Store・履歴種別は追加しない。

一回出版候補を実装し、Source／試験strict・対象Formatter／Warning禁止Lintが成功した。Caller25/25（3918.0377ms）と拡張Host1/1（211730.638ms）が成功し、三用途後の履歴一行・要求unknown保全・現在操作除去・除去後exact再入場と行bytes不変を確認した。HostのDocker・物理削除は代役であり実回収全体の根拠ではない。独立確認の要約全文Oracle不足と旧二行契約の残存を統合是正し、固定fixture由来の全field比較・failed／auxiliaryのcodec合法な一軸負対照を追加したmodel19/19（1423.5059ms）が成功。最終再確認待ち。初回Callerのbinding欠測による24/25、Rootからのnpxによる取得失敗、追加試験の否定選択がHostも選んだ実行は成功へ数えない。最後の実行は所有Runner treeだけを停止し、自己生成Root一件を内容・非リンク・既知Process終了確認後に清掃して不存在を確認した。正のexact指定でno-op1/1（514.856ms）を再実行した。Docker・Provider・再起動・Commit／Pushは未発行。

真正Filesystem Callerの限定確認: Host試験1/1（162338.7615ms）が成功した。実Writer／Reader／Kernelを使い、処置後保存拒否から同IDで再入場し、要求unknownを保全して三用途を確定する。Docker／物理回収境界は代役であり、全回収の実証ではない。専用Rootの不存在を確認した。後続出版と終了整理はこの試験時点では未接続で、独立レビューと全体完成は未主張である。

真正Writerへ向けたCaller接続候補（2026-10-17）: 公開compositionはHeaderと設計表の文言Minor2を是正し、契約／品質とも残指摘0の限定Passで閉じた。続く着手前確認ではsave既定撤去・六purpose明示、primary→failed→auxiliaryの直列保存、既存not_issuedの再入場前unknown化、fresh Readerの本文／解放／exact判断確認を統合した。Writer排他内のOwner callbackにReaderを混ぜず、旧history分岐より先にdisposalを処置する。再入場の到達阻害は、共通Readerの修復Historyモードだけに未出版の判断待ち／discardをtechnical_stateとして追加する方針を両確認へ照合して是正した。Completion資格は拡張しない。

Source／試験strictと対象整形・warning禁止Lintが成功。Caller/model＋模擬Writer／DIの25/25（3917.7175ms）、既存modelとReader no-opの通常20/20（1574.6191ms）は成功、Host専用は除外である。途中の試験型のvariant未絞込み、旧retained結果の観測済み期待、fixtureのpublication優先を是正した。既存保持試験はdecision保存拒否を明示して判断待ち状態を作り、新回収試験では拒否を解除し三用途、primary不明による後続0、処置後保存拒否からのunknown保全と同ID再入場・元結果不変を確認する。真のFilesystem Writerでの新Caller接続、Reader二追加形とCompletion拒否の実接続、保存故障の全軸、Host物理回収は未確認であり、独立レビューへ渡す前に補う。三用途が値上で揃っても後続出版／終了整理は未接続なのでblockedを維持する。既定7日の保持引渡し、旧Coordinator撤去、配布18/19、全体検証・Commit／Pushは残る。

配布閉包の現物確認は18成功／1失敗（12969.2832ms）で、全体Passではない。内部Driverから既存Platform Accessの`entry-observation.ts`が初めて本番閉包へ入り、旧`package-verification.ts`の子Process登録がこの読取りNative入口を持たず`platform_provisioner_runtime_dependency_child_process_unbound`で拒否する。新composition自体にspawn／新Repair Sessionはない。旧署名・配布graphの撤去対象と結合して処置し、単に検査を緩めたり成功へ読み替えたりしない。この失敗は局所15件や内部Driverレビューとは別の未完了条件である。

回収composition接続（2026-10-17）: 契約／品質の着手前照合後、既存repair-runtimeへ固定公開入口を追加した。新Repair Native Sessionなし、元checkpointの実decoder／全九処置終端／Host・Engine・cleanup、fresh Artifact／KnownFolder／元H相関のScope再導出、Driver待機後の取消・Artifact・現在確認を接続する。元HはAuthorityにしない。委譲後の想定外例外はunknownとし、未発行へ畳まない。初回のnot-settled反例は先頭処置をunknownにして後続終端と矛盾するcodec不正だったため、末尾処置だけunknownへ直して実codec合法を先に確認した。修正版の静的三軸、公開集合・新composition・内部Driver・元Sessionの関連15/15（650.5952ms）が成功。新試験は三用途と前提一軸差・待機後失効・部分結果を模擬境界で確認したもので、真正Writer保存・Host物理回収ではない。固定候補の独立確認、真正Writer／後続出版／保持引渡し・旧Coordinator撤去と全体検証は未完了。

内部Driverの最終限定確認（2026-10-17）: 中間Directoryだけの実体差に対する独立反証を追加し、対象leafを不変にした削除0・全5Path保全と、当該祖先Native比較一件だけを省いた変異の拒否を確認した。製品Sourceはこの最後の是正で不変更。静的三軸・局所2/2（176.7251ms）、関連13/13（382.545ms）、Catalog指摘0、staged／unstaged差分空白検査成功。契約／品質の最終再確認はともに残指摘0・内部Driver単位の限定Passである。上位保存・物理Host・Package全体の成立へは昇格しない。固定配布接続の前段最終再確認も残指摘0で完了しており、以下の再確認待ち表記は当時の経過である。

次の本番接続は、新しいRepair Native Sessionを取得しない。元Sessionのjoin後に保存したsettled／cleanup confirmedを上位が確認し、元HをAuthorityでなくScope相関材料としてだけ使う。専用Writerの用途別intent保存後、固定Artifact・KnownFolder・Local親と元Scopeのfresh一致を下位で照合して回収し、同じ操作へ進捗を保存する。新Hで旧Scopeを再現する方式や、元修復Machineにdisposeを追加する方式は採用しない。Artifact更新等で元Scopeを再現できない場合は新Effect0で停止し、この単位で新たな移行管理を作らない。実装前に品質観点の照合を加え、保存失敗・部分処置・再入場・元結果不変を接続試験で確認する。

2026-10-17の内部Driverは固定三用途factoryへ接続した。Root込み256件／深さ8、全preflight後の単発unlink／空Directory rmdir、Node／Native単位別の実体照合、親・現在source保全を実装した。初回の試験VMでBuffer欠測を修正して局所2件成功、その候補の通常回帰283/283（33817.7098ms）はHost除外である。独立確認では集合変化後の追加要求停止、部分失敗の正確な要求列／残存全文、rejected Promiseの処理を是正した。Windows名検査不足の指摘は固定Nativeが全componentを拒否する接続を確認して撤回し、第二validatorは作らない。祖先だけの実体／直下残存名確認、Native拒否接続、late実体／tag／link数差、異常型、取消と二つの本文変異を反証へ追加した。Formatter一時file mapping拒否とLintの二指摘は解消し、最終静的三軸と局所2/2（157.2639ms）は成功。最終再レビュー、Host物理回収、Session／Writer／後続出版・保持引渡し、旧経路撤去は未完了。実Docker・Provider・再起動・Commit／Pushは発行していない。

2026-10-17の物理回収着手前照合では、Platform Accessの単一entry読取り観測とDIの既存固定Scope・Node非再帰回収へ責務を分ける方針を、契約／品質の両確認へ統合した。Repair Native Sessionへの可変entry ProtocolとScope重複、Native tree削除、共有State／Lockは追加しない。raw属性・tag・Native固有単位の実体・linkCountを明示close後に返し、Node実体へ未実証で変換しない。一要求一Process／exact Path／完全frame／Artifact前後／正常終了で相関し、新nonceは不要と確認した。三固定用途、非使用、保存済み意図、現在Owner／Scopeと親Rootの共同条件は維持する。変更分類は既存回収境界の具体化で、独立レビュー・直接文書影響・NativeとNodeの静的確認／関連試験・必要なHost実境界を実施する。準拠基準変更・公開変更はなく準拠／Communication監査は追加しない。現在、人間の追加判断は不要。

自己生成AF_UNIX実測は、sandbox bind拒否、正常closeによる端点消滅、異常終了子の残存端点という三結果を区別した。最後だけがNode unlink成功→明示不存在を証明する（tag0x80000023、Dirent link=true、lstat EACCES）。全専用Rootと試験子の清掃・終了を確認し、Docker・認証・外部AIは使用していない。詳細な実行書庫は追加せず、方式選択の限定根拠をDI詳細設計へ記録した。製品のNative観測／実回収Driver・後続出版・completion・保持引渡しは引き続き未完了である。

単一entryのraw観測はNative／TypeScriptとbootstrap固定配布へ接続済み。元の保護APIとRepair Session Protocolは不変更。13行の取得・照会・解放・出力故障反証を`ERB-UT-039`へ接続し、QA／Symbol／Catalog／Centerの現物13定義・197項目へ同期した。close結果を常時成功へ変える一意本文変異は、同じUTのclose行で拒否された。診断コンパイル初回の依存panic戦略不一致と想定外.o保持は成功へ数えず、確認後清掃し、正しい試験依存で正常0／変異101・Source不変・専用Root不存在を確認した。Native通常47成功／明示専用23未実行＋CLI8成功、Node通常9成功（3633.9628ms）、Catalog0。独立確認のOracle不足2件とCenter現在値の残存196三箇所は是正・両再確認残0、同期故障反証単位を限定Passとした。実Win32の故障そのものや全handle不存在をUTから推定しない。

固定配布Nativeはrelease Buildと実Hashを照合し、bootstrap値・旧System Directory fixtureだけを`a85d46241ba5cb4d771d2b6c493254262492935e3a5e9d20fea2bd486acc9cc9`へ同期した。過去署名Manifestは変更せず、正式Release Assurance全体の成立にはしない。公開APIのfile／Directory／hardlink同実体・nlink2／junction別tag・別実体／不存在・内容保全と自己生成物清掃を実Hostで確認した。初回の制限内hardlink EPERMは失敗として区別し、既存Host Windows profileへ分離、通常9/9（4093.628ms）はHost除外、実Host1/1（334.456ms）は別根拠である。配布接続レビューMinor2（清掃前Root／親実体確認、File Header範囲）を是正した最終静的check・実Host1/1（327.3384ms）は成功。初回Formatterのfile mapping拒否は再整形で解消し試験成功へ含めない。固定Hashと新旧Known Folder二用途も確認済み、Catalog0、試験Root残存0。配布接続の最終再確認とDI Driver／三用途回収／後続出版／保持引渡し、旧経路撤去と全体検証は未完了。Docker／Provider／再起動／Commit／Pushは未発行。

専用Writer／pending接続を実装中（2026-10-17）。現在Sourceと契約／品質の着手前確認を統合し、既存private runtime_repair用途を六種へ固定、既定用途を撤去して本番Caller・既存試験へ明示搬送する。外側／Kernel内は共通private再導出helper、pending分類は専用四用途の一意判定を使用する。同値progressだけは物理Writer／Context前で既存Reader自身のKernelへ分岐し、同期Owner・元版／raw由来Hash・対象exact一件・短命物なし・解放を共同確認する。新Store／Lock／共有管理を追加せず、元結果・履歴・他操作を保全する。値候補の時点で未接続だった保存入口を閉じる単位であり、Driver・後続要約・completion・保持引渡しは引き続き未実装。実Docker／Provider・再起動の許可にはしない。

専用保存接続は限定完了した。明示六用途を外側／Kernel内／pending再開へ搬送し、三用途同値だけ既存Readerで無書込み確認する。初回試験strictのnullable Buffer一件と、既存出版VMの新依存欠測を是正した。初回関連71件は70成功／1失敗であり成功へ読み替えない。最終静的check（Source／試験strict、Warning0、既存Info54、両台帳受理）、関連71/71（6394.4764ms）、配布19/19（11061.6146ms）が成功。最終新品Host1/1（133600.5946ms）は三用途保存、rename前切断からの同exact pending出版、出版後marker清掃、同値の六変更API要求0・state実体／mtime不変、短命物／未知entry拒否、外側／Kernel内の片側guard省略での拒否と両方省略時のOracle破壊を確認した。元checkpoint／outcome不変とDI再取得0を確認し、元履歴の出版後保全は前段modelの独立根拠として分ける。旧checkpoint／Sessionの実Writer回帰1/1（22597.8459ms）も成功し、終了後のrepair-owner自己生成Root残存0。契約／品質の固定9File独立確認はともに残指摘0・限定Pass。旧Manifest Gate二件、旧46 Case、実Driver・後続要約・completion・保持引渡し、全体回帰／実境界／E2Eは未完了で、Commit／Pushは行っていない。

回収進捗のmodel接続に着手した（2026-10-17）。契約／品質の両確認を統合し、未出版・保持判断待ちからだけ専用decisionでdiscardを確定、以後の専用progressは一用途のみ更新する。元要約出版前だけの処置判断変更であり、既出版・明示保持済みは拒否する。disposal内の要約／履歴は後続専用・今回はnull限定、DI initializerで三用途の初期値を単一所有し、通常更新からの偽装・元結果変更・時刻変更・改訂だけの同値保存を拒否する。元版から完全再構築する専用validatorを用い、一般遷移へ例外権限を増やさない。今回の値候補を物理Writer／保存再開・削除・後続履歴・completionの成立とは扱わず、これらは続けて接続する。既存completion・保持7日引渡しは変更しない。

model接続の限定単位は実装・再確認済み。初回の試験型推論4件とlint警告1件を是正し、兄弟fixtureの未終了修復二件という不正前提は既存codecを緩めず終了済み兄弟へ訂正した。静的check（Source／試験strict、Warning0、既存Info54、両台帳受理）、関連54/54（6306.4283ms）、DI通常281/281（34989.6722ms）、配布19/19（10382.9162ms）が成功。独立確認のMinor二件は、未接続Writerを接続済みに読めるHeaderと、codec不正だけで拒否される負例だった。両者へ統合方針を照合後、文言とcodec合法な実体／時刻差替えの反証へ是正し、最終静的check・repair-model19/19（1157.5317ms）・diff check成功、契約／品質とも残指摘0・限定Pass。DI通常と関連54件はこの最後の負例追加前の同製品処理の根拠として区別する。後続summary/historyはまだnull限定、専用Writer・pending再開・物理回収・後続出版・保持引渡しは未接続で、全体完成ではない。Docker／Provider要求・再起動・Commit／Pushは発行していない。

退避物なし修復終了→fresh Taskの限定接続を完了した。初回Hostは試験代役のawaitEngine例外で失敗（75606.7728ms）し、同ID正式回復で履歴／completion・未解決0・技術Effect0を確認後、exact自己生成45項目を清掃し不存在を確認した。新品修正版Host1/1は177355.9764msで成功、normal-owner残存0。最終通常check Exit0（既存Info54、Warning0、両台帳受理）、同File portable3/3（537.7739ms）、repair-model17/17（1152.0938ms）成功、契約／品質の実行込み最終確認は残指摘0・限定Pass。失敗Rootの清掃は新品成功へ流用せず、保持物回収・期限付き引渡し・実Docker／Native・全体完成は未成立である。

回収進捗の純粋値契約を既存DI checkpoint File・Root・UTへ実装した。合法10形、purpose固定、初回意図の独立保存、確定後tuple固定、要求unknown保全を契約／品質の着手前確認へ照合した。過去の観測unknownだけを根拠に要求を永久拒否する案は、fresh肯定観測成立の反例により撤回し、実Driverの現在確認へ責務を分けた。型・decoder・validator・値上終端だけを公開し、元九処置checkpoint、保存Owner／物理処置／保持引渡しは変更しない。完全同値のWriter no-opと、前意図の実保存確認前の削除0は後続接続の検証義務へ残す。

初回全体確認で公開集合の期待未同期を検出し、追加した純粋三関数だけを明示同期した。静的check、関連12/12、DI通常280/280（33457.4566ms）、配布19/19（10663.006ms）が成功した。独立品質確認の終端欠測負例不足を、各用途のunknown／unobserved計6形がdecoder上合法のまま終端falseとなる期待へ是正した。是正後の静的check・新旧unit10/10（219.6619ms）・diff check成功、契約／品質の最終再確認は残指摘0・限定Pass。280件結果は負例追加前・同じ製品Sourceの回帰として区別する。Source宣言のAST比較はパーサ不在で未実施であり根拠に数えない。実保存・Driver・物理回収は未実装で、次は既存修復操作と専用Writerへ接続する。

退避物なし修復終了→fresh Taskの接続確認に着手する。既存正常Owner1回Caseだけを実修復API・DI Using／Machine・実Writer／history／completionの後へ接続し、Host／Homeはその後に作る。修復stateを再初期化せず、同Root・Repository結合・改訂／元版Hash、元修復履歴行のbytes／Hash／時刻を保全する。修復中に捕捉した実state bytesを入力とする純粋Task追加候補がnullとなることを確認し、実Writer／beginの拒否とは区別する。終了後に既存のTask開始・実Host／Home回収・対象除去まで通す。DIのNative／技術と既存Docker証明だけを模擬し、実Docker／再起動・新Source／Store／Lockは追加しない。修復未終端なら試験Rootを保持し、全Host清掃・mock復元と元失敗保持を試みる。ERB-IT-014を既存SuiteのHeader／Symbolへ接続し、新Suiteは増やさない。契約／品質の着手前確認を統合済みで、2回Caseの意味、保持物回収・期限付き引渡し・実境界の未完了は維持する。

退避物回収の着手前整合確認で、元checkpointの退避確定相関と履歴ReaderのID単独重複拒否を確認した。契約／品質の両確認結果を統合し、元checkpoint・元修復要約を不変とし、同じ修復操作の後続処置と既存JSONLの種別別要約へ接続する方針を採る。通常回収を先に実装するが、保持の期限付き責任引渡しも同じ完成目標へ残す。ArchitectureのDI／Coordinator、QA-000006、Workflowへ適用条件・四代表例と未実装境界を伝播する。実体型・OS削除意味、具体Schema、Reader／Writer／終了判定はSource着手前に再照合する。変更分類は既存修復の終了契約変更で、独立レビュー、文書・直接影響確認、関連回帰と必要な実境界を実施する。CRDD準拠基準を変えないため準拠監査は追加しない。現在、人間の追加判断は不要で、Host削除・再起動の実行は行わない。

退避物の使い捨て方針を人間が承認した。修復成功後、安全確認できた不要な実行時退避物はDocker Isolationが回収し、不存在確認後に現在状態を整理する。調査用に明示保持する場合だけ期限付きで利用者管理へ引き渡し、既定期限は7日とする。期限時には削除・延長を判断し、経過時間だけで参照中・使用中・観測不能の物理資源を削除しない。Image・Volume・Provider Home・認証領域は対象外である。

実Source照合と契約／品質の読取り確認では、`settling/retained_by_human_decision`の修復が残るとTask開始を拒否し、completionは`stale=absent/disposition=not_applicable`だけを除去することを確認した。これは実機上の残存検出や新しいDocker障害ではなく、現在設計の未完了分岐である。DIは固定三退避先へのrenameと実体観測だけを持ち、削除・期限付き引渡しの実装は未完了である。元の修復結果と後続の回収確認を分け、履歴の30日設定の流用、Gate緩和・phase移動・過去checkpoint書換えだけで完了させない。今回の承認を任意のHostフォルダ削除や追加Docker再起動の許可へ拡張しない。次は既存Architecture・Qualityへ適用条件と反証を接続し、最小実装・局所試験・独立確認を行う。退避物なしの修復終了→同Rootでのfresh Task開始も独立した検証対象として維持する。

文書候補の契約／品質独立レビューでは、元修復履歴行の不変範囲、後続行の固定・保護条件のQA伝播、計画見出しの所属を是正し、最終再確認は両者とも残指摘0・限定Passとなった。DIの静的checkと既存checkpoint／Directory／Host操作18/18（647.2138ms）も成功したが、新回収処理は未実装であり、この結果を新機能や実Docker回収の成立根拠へ流用しない。次は削除許可型・OSの意味と具体Schema／全履歴利用側を照合してSourceへ接続する。

### 先行単位の限定結果と残件

現在修復の保持CLI接続に着手する。既存の保持判断・適格条件・実Writer／履歴は変更せず、`doctor --retain-docker-runtime-repair <exact-repair-id> [--json]`を既存parserと現在修復CLIへ接続する。修復／保持のpurposeを必須引数として明示搬送し、保持指定の欠測・不正・他操作混在をRoot／処置前に拒否する。保持の開始前取消だけはRoot解決前に拒否し、通常修復の取消後metadata確定の意味を変えない。正常は技術再取得0、保持と履歴の確認、completion=false／exit 2である。履歴不変・退避物引渡し・Task資源不存在は主張しない。契約／品質の着手前照合はこの最小Adapterで整合した。既存の実保持Writer／保存後取消と、実parser・router・CLI関数本文の搬送／省略変異を共同根拠とし、新Host行列・状態・Lock・Frameworkは追加しない。変更分類は公開入口の既存Capability接続で、Architecture・QA・Workflowへ直接伝播し、CLIと関連保持回帰・固定候補独立確認を行う。準拠基準・権限・物理保存契約は不変更で、当該変更へ準拠監査や全工程監査は追加しない。現在、人間の追加判断は不要である。

保持CLI接続は候補実装と限定検証を完了した。製品変更は既存parserとCLI組立てだけで、明示purposeを既存APIへ渡す。開始前保持取消はRoot／API前に拒否し、通常修復のmetadata確定と保存後の保持事実は変えない。実binの欠測／混在二形は引数不正・exit 64で、七Process APIへの要求counter 0。実parser／router／CLI本文はexact ID・目的・Signal・Rootを一回だけ搬送し、目的欠測／repair化／ID差替えを既存Oracleが拒否する。最終公開DTOは保持四形で全文比較し、合法別IDと解除不明の成功丸めを拒否する。

初回Source strictのunknown spreadと既存router VMの旧依存名欠測を検出し、固定DTOの明示構築と現在Admission名／Root引数照合へ是正した。両失敗は成功へ数えない。最終静的四段・通常check（既存Info54、Warning0、両台帳受理）、CLI／保持core40/40（7338.0749ms）、修正版現在system5/5（615.9131ms）、配布19/19（11315.0968ms）が成功した。既存Windows保持Writerは通常保存113548.4051ms／rename前切断116414.0345msの両形が成功（親を含む出力3/3、計229963.477ms）し、今回`repair-owner-*`残存0。coreAPIと当該Host試験は今回不変更で、実Docker／Provider要求や再起動は発行していない。

固定七Fileの独立確認で、Workflowのmetadata処置過小記述と保持DTOの部分比較というMinor二件を検出した。統合方針を両確認者へ照合後に是正し、再確認は残指摘0。Host終端成功・自己生成Root残存0とcoreAPI／Host試験不変更も両確認者へ照合し、保持CLI接続の最終限定Pass・残指摘0を確定した。保持は終了整理待ち／exit 2であり、物理退避物の引渡し、現在記録の除去、修復後のfresh Task回収、旧修復Gate二件と全体E2Eは未完了である。

旧AfterRecorded単独撤去の着手前照合を完了した。契約／品質の初回差（identified資源＋restartの新Host交差Case要否）は、実Sourceで資源Driverがrestartに分岐せず、終了述語が独立していることと、既存known_idが確定restart保持下の発見ID保存・削除直前読戻しまで確認することを再照合し、追加Case不要へ整合した。必要な保証は次の既存Ownerへ対応する。これは旧薄wrapperと専用入口だけの撤去判断であり、Docker Isolation全体の完成判断ではない。

| 旧入口で保持すべき意味 | 現在のOwner・根拠 | 次の処置 |
|---|---|---|
| exact IDと再起動後のfresh回収 | 現在Root／Owner、restart checkpoint、今回の公開restart→通常CLI二形 | 旧関数・専用CLI flag／help／parser／分岐を一単位で撤去し、旧flagは処置前に明示拒否する |
| identified／unknownのID保存後回収 | current-resources、全五用途順序、state-runtime known_id／不正ID変異、identified-providerの実Root公開Consumer | 既存保証を共同利用し、新しいHost行列や汎用unknown終了を追加しない |
| 元principal／一次失敗・結果・兄弟保全 | 現在Identity全文不変、fresh Owner、履歴／CLI二形 | 全境界を代役にした旧直接VM一件は退役。実再ログオンは全体Gateとして未完了を維持する |
| 通常実行への署名・旧保存依存排除 | 現在Repository stateと公開Consumer、配布検査のcurrent集合 | 当該Consumer一件とlive Gate 3→2だけ同期し、v0.21比較・過去Evidence・共通promotion保証は維持する |
| 撤去対象外 | AfterVerified、repair／close／adopt、共通Observer／旧Reader／codec、旧46 Case（当該関数への直接呼出し0件） | 連鎖削除しない。実Daemon、初期publication、Host片側消失＋資源、実稼働回収は全体残件へ保持する |

この単位は複数Consumerに影響する既存設計の実装置換として、CLI引数／router、restart準備／組立て、資源回収、配布検査の回帰と契約／品質の固定候補独立確認を行う。人間が採用済みの通常署名非必須・現在形式限定の範囲であり、新しい権限・準拠基準・移行方式は追加しない。以下の二形成功を全体完成へ拡張しない。

旧記録後入口のSource撤去と関連回帰を限定完了した。旧wrapper168行・CLI import／help／分岐・flag／返却propertyを削除し、旧chain実本文VM一件を退役した。通常CLI・既存公開Consumer・AfterVerified／repair・共通Observer／Reader／codecは維持する。旧flagは実parserの引数不正と実binのexit 64へ接続し、同期Process要求counter 0とRoot／処置分岐前の拒否順を確認した。current名前付きConsumerは12件、残る本番Manifest Gateは2件へ同期し、旧Guardはv0.21比較だけに保持する。通常五入口と回収Sourceへ旧APIを再導入する六反例を拒否し、promotion相関と過去Evidenceは変更していない。

初回型検査の空help出力呼出し一件を除去後、静的四段と通常checkは成功（既存Info54、Warning0、両追跡台帳受理）。実bin拒否Oracle追加後の最終関連97/97（19635.4719ms）、Consumer限定4/4（1540.2959ms）が成功した。固定11Fileの独立確認はSource／試験の残指摘0、QAの先行Case上限を現在の全体未完了と混同するMinor一件を検出した。統合方針を両確認者と照合し、「このCase単独」と共同根拠の退役判断を分離し、要求0の記述を同期Process観測へ限定した。修正後の文書再確認も契約／品質とも残指摘0となり、旧専用入口の単独撤去を限定Passとした。旧46 Caseや実Daemon／実再ログオン等の全体Gateは未完了で、Docker／Provider要求・再起動・Commit／Pushは発行していない。

現在のCLI再入場二形を限定確認した。認証確認の作成結果unknown形は、実際のDI発見／二回不存在観測と専用Writerを通し、別Processの通常CLIがHost清掃・履歴一件・対象除去まで成功した（132766.285ms）。Docker応答・再起動結果だけは代役であり、実Daemonの限定終了や実再起動成功を意味しない。同時実行の五資源未要求形は親試験の90秒期限で失敗し、restart完了・Host清掃確定・履歴出版途中を保持した。同exact IDの正式Consumerで再入場し、対象除去・履歴本文不変／重複なし・兄弟操作不変を確認した。診断スクリプトの履歴summary参照階層誤りは製品失敗とせず、正しい階層で一次失敗・execution・outcome保持と短命物不存在を再確認した。関連Process0と全46項目の実体・本文Hash二読取り一致後、自己生成Rootだけを清掃しENOENTを確認した。

両確認者の着手前照合に基づき、試験harnessのrestart二形だけを内側120秒／外側180秒へ統一した。他26形・製品期限・成功Oracle・要求条件は不変更。通常形の新品単独は全OracleとRoot清掃まで成功した（68607.2709ms）。静的四段、比較／配置VM1/1（8.0566ms）、profile3/3（434.9402ms）が成功した。auth形の最終待機値は前実行から不変である。最初の期限超過を成功へ読み替えず、全体回帰・旧AfterRecorded全能力の置換・実Docker終了／E2Eは未完了とする。今回の変更分類は試験実装詳細と結果記録であり、契約／品質の固定四File独立再確認は残指摘0、限定Passとなった。新しい工程契約・準拠基準・認可・Effectを作らないため、この局所変更へ全工程監査・準拠監査は追加しない。現在、人間による追加判断は必要ない。

通常回帰の部分診断（2026-10-16）: 固定SourceでCoordinator portable相当を実行したが、1202540msで監視期限に達し、所有する試験Process treeだけを終了した。子終了とdescriptor解放を確認し、終了後の既知三PIDとその直下の子の再観測も空だった。全子孫・試験残存の清掃完了はまだ主張しない。最終集計は未出力であり、失敗表示67行にはFile親の失敗も含むため独立した欠陥67件とは扱わない。観測した群は配布検査2、回復Runtime49、現在回収準備10、再起動結合6。既存三prefixに加えPowerShell初期化二試験を診断だけで除外したため、通常portable成功や全体回帰完了ではない。結果は一時領域`.crdd/tests/crdd-coordinator-portable-Z19XG4/`の`summary.json`と`test.tap`へ保持する。途中終了で追加された試験領域は参照・内容・非使用を確認して回収し、正式Evidenceへ複製しない。実Docker／Provider要求・再起動は発行していない。

同診断からの二試験是正を限定完了した。再起動結合fixtureの終端結果に、実DI結果の`request`／`effectOutcomeUnknown`と本番同義の未発行cleanup分岐を接続し、旧二項目欠測の拒否を確認した。回収準備VMと二つのWriter VMには実model依存を接続した。独立指摘の初期Host未到達も、正規Identityの実prepare／decode、null・確定未発行restartの肯定、三依存の各二回到達と依存欠測による肯定Oracle破壊で是正した。新対照の初回realm差失敗はJSONコピーの境界調整だけで修正し、最終静的四段と二File全37/37（904.357ms）、両独立再確認の残指摘0を採用する。製品Source、Schema、清掃条件は不変更。先の失敗表示のうち現在回収準備10・再起動結合6が対象であり、残る配布2・回復Runtime49、未実行範囲、物理試験物清掃は未解消。初期Hostの私有判定対照を物理cleanup全体の実証へ拡張しない。

配布検査の先頭原因を限定是正した。回収Executorの`run`はconfig実体照合後・spawn直前のOwner確認を追加した実本文であり、argvは不変だった。検査の固定本体Hash一値と字句親`createRecoveryExecutor`一件だけを同期し、正常graph、確認欠測・前後移動・別親の反証を追加した。静的四段・追加1/1と両限定レビュー残指摘0、DI通常入口の277/277（32679.1709ms）が成功した。Executor本体、公開API、argv、署名条件は不変更。配布試験全14件は12成功／2失敗（1207.0806ms）であり全体未完了。176 Sourceの読取り分類で残る8 Fileは、DI `desktop/backend-state.ts`・`engine-state.ts`・`restart-machine.ts`、上位`docker-desktop/repair.ts`のProcess検査、DI `desktop/native-process-lifecycle.ts`・`native-process.ts`のlifecycle検査、DI `execution/attached-process.ts`・`authentication-command-runtime.ts`のflow検査である。これらを実Sourceと検査契約の差へ分解してから是正し、固定Hashを一括追従させない。回復Runtime群では廃止済み`beginRuntimeOwnedDockerRecoveryWithHostBeginObserver`への試験呼出しを確認したが、対応する保証の新方式接続は別に確認するため、失敗群の一括削除は行わない。

残存失敗の読取り分類（契約／品質の確認者による。実装完了のレビューではない）:

登録同期前の解析器是正を限定完了した。Native共有取得関数の`Promise<Outcome & { ownerBindingSha256: ... }>`を、検査の三利用点が型literalではなく実本体として誤採用する不具合を確認した。既存token列の本体開始を一つのprivate関数へ統一し、型の区切り・文字列・本体なし宣言と不整合を区別した。未対応のconditional／mapped／indexed型を一般受理せず、nested indexed拒否のMinorも全深度のatom識別で是正した。実Nativeとメモリ内の型alias対照のgraph全文・spawn Owner・本体範囲一致、旧first-brace／root-only拒否変異の検出、配列・tupleの肯定を確認した。最終静的四段と関連7/7（618.9071ms）、両独立再確認残指摘0。製品Nativeの型・処理・API、8 Fileの登録値は不変更。修正版で176 Sourceを読み取り再検査し、残存は同じ8 Fileで追加失敗なし。全配布閉包はまだ不成立である。

移管8 Fileの登録同期は限定完了した。backendの登録一覧・稼働一覧を引数Hashと受領先で別callsiteとして扱い、出所確認Mapは一意なsource/function所有者集合との双方向完全一致へ補正した。現在の実登録は総数42／Runtime26（移管前indexは41／25）であり、前段の予定件数ではなく実母集団を照合した。各callsiteの静的出現数一回、片側欠測・重複、出所キーの欠落・余剰・差替えを反証した。現Owner八Fileの肯定と引数・期限・Artifact確認・初期待機・Lifecycle接続・attach・許可・joinの変更拒否、上位repairへの直接spawn再導入拒否を確認した。Native Protocol自体はDIの既存試験が所有し、本配布検査の検出範囲へ広げて表示しない。追加で、旧Matrixの既存変更`ready.operationRoot`搬送だけに由来する本体Hashを同期し、暗黙Rootへ戻す反例を拒否した。製品のSource実行条件・argv・署名Authorityは不変更、新State／Lock／Frameworkなし。静的四段成功、契約／品質の限定独立再レビュー残指摘0。配布17件は16成功／1失敗（2034.2152ms）で、残る全配布閉包は`consumer_handoff:composition_issue:shape`。撤去済みの通常署名実行許可を要求する旧検査の処置を、任意配布と現行実行の保証対応から次に確認する。実Docker・署名・全体完成は未成立。

現行／旧比較のConsumer検査訂正を限定完了した。名前付き利用は現行13件（任意配布／検証7、開発観測3、未撤去の本番Manifest Gate 3）を独立したexact集合とし、旧handoff必須はv0.21比較だけへ限定した。動的な任意Tool利用は既存の別flow検査が所有し、13件を全呼出し数とは扱わない。通常五入口のSource欠測、旧三APIの未使用・別名・namespace・default・literal dynamic・再exportを拒否し、whole型専用宣言と空の実行時依存を残すinline型専用を区別した。promotion三相関と現存Gateの相関は維持する。実Assurance本文の現行／固定旧投影、prepare欠測、current枝省略・版条件逆転を反証した。静的四段、関連4/4（1631.2067ms）、配布19/19（13150.7885ms）、DI通常277/277（32846.6402ms）が成功、契約／品質の最終限定再レビュー残指摘0。新Runtime State／Lock／Frameworkと実Docker要求はなし。本番`repair::preparedBoundary`と旧After二経路のManifest依存、旧API／Tool撤去、回復Runtime試験、全体回帰・Reality Audit・実境界／E2Eは未完了である。

| 対象 | 確認した原因 | 次の処置・未達条件 |
|---|---|---|
| 配布8 File | backend／engine／restart／nativeの移管登録漏れ、attach／認証flowの追加変更、上位repairから消えた旧Effect登録の残存 | 現Owner・固定引数・artifact前後確認・終端と旧保証の対応、登録同期と反証を限定完了。上記19/19を根拠とし、Protocol全体・旧Manifest本番Gate撤去の証明にはしない |
| 回復Runtime49行 | 実Case48＋終了hook1。廃止開始APIの呼出し46（HostBegin16／RuntimeState29／PendingBase1）、旧公開境界期待1、Trace集計1、Host残存hook1 | 旧Suite一括削除・恒常skip・互換API復活はしない。現在の試験所有者へ保証を対応付け、Traceも意味に基づいて接続する。入口存在確認の前倒しと旧残存清掃は下記のとおり完了したが、46 Caseの保証移行は未完了 |
| 現方式の置換根拠不足 | 初回出版前の別Process中断、Host先行消失とidentified／unknown資源の組合せ、同stable利用者の再ログオン後回収 | 既存の現在Owner／Writer／DIへ限定対照を接続する。state_savedは初回三確認後であり出版前中断の代替ではない。Workbenchの応答は採用済みtransient配送であり、旧回答の再表示を復活させず、資源回収と診断を確認する。旧handoff形式・汎用unknown終了を追加しない |

旧Proxy負例三形にはloopのNetwork値が処置入力へ入らず同じ拒否を繰り返す不足がある。移行先はnone／egress-only／追加Networkを実inspect入力へ搬送する。旧世代解放方式は復活させず、現在の三排他保持・再検証で失効後の処置0と終了を確認する。今回の49行から独立した製品欠陥49件を主張せず、未到達の保証を確認済みへ丸めない。

途中終了した配布試験の複製65領域は清掃済み。今回のsummaryが列挙したexact Rootを対象に、全件がRepository内の実Directoryで直下が`distribution`／`oracle`だけであること、全子が通常File／Directoryであることを確認した。各metadata・本文Hashの一覧を再読取りで全件一致させ、関連試験Process参照0の確認後に当該65領域だけを削除した。96,283 File、1,537,008,238 bytesを回収し、各RootのENOENTと当該prefix残存0を確認した。この時点では回復記録を含む`crdd-coordinator-recovery-test-run-n720At`と診断Rootは対象外だった。Docker永続データ・認証情報・製品Git履歴には触れていない。内容manifestを正式Evidenceへ複製せず、ここでは処置結果と対象境界だけを保持する。

旧fixtureの漏出防止を限定完了した。親が七phaseから必要APIを一度だけ選び、欠測ならDirectory・子Process・Host生成前に失敗する。子も同じ選択literalをHost生成前に照合し、途中変更時は既存exit70と欠測診断を保持する。七phaseの欠測／選択API存在を親子別々に反証し、静的四段・新Case1/1（481.2834ms）が成功、契約／品質の限定再レビューは残指摘0。これは旧46 Caseの保証を置換した根拠ではない。

`crdd-coordinator-recovery-test-run-n720At`の46 Host／markerは、token・schema・元本文Hash・実体・六空子Directoryと非使用を確認し、既存の正式回復入口で回収・不存在確認した。診断起動の`--input-type=module`が内部Workerへ継承される初期失敗は成功へ数えず、通常Node起動での正式成功と区別する。製品の期限・回収条件は変更していない。残る46準備親は、空の`runtime-state`と廃止API欠測一項目だけの`handoff.json`という閉集合を再照合し、非再帰削除した。空のnamespaceと親Rootも除去・不存在確認済み。Docker／Provider要求は0。診断Root`crdd-coordinator-portable-Z19XG4`は引き続き保持しており、全`.crdd/tests`清掃完了とはしない。

旧本番三Gateの撤去準備では、まず現在checkpoint保存・全解放・確定から別Processの通常CLI回収までを、五資源未要求に限定して接続する。この一CaseだけでAfterRecorded全体を置換済みとはせず、auth作成unknown等の未置換保証を照合した後に撤去範囲を判断する。次に現在修復の保持指定入口と、修復後のfresh Task回収を別々に確認し、旧AfterVerified・close／adoptへ進む。修復成功からTask資源不存在を推定せず、旧記録移行はフロントAIが扱う。各段階の能力・利用側接続が成立するまで、残る旧処理を置換済みとは表示しない。

五資源未要求の接続確認を限定完了した。`restart_cli_entry`はDI再起動結果だけを代役にし、公開再起動組立ての各checkpointを実model全文・改訂・元版Hashへ照合、全解放後確定と同要求二回目の下位到達0・本文不変を確認する。二操作Scopeの実Kernel排他を再取得・解放し、別Processの通常CLIが同exact IDのHost両不存在・履歴一件・対象除去まで成功した。元一次失敗／結果、兄弟操作とHost実体／本文は初回後・二回目拒否後・CLI後に保全する。配置Oracle不足等を是正後、静的四段、比較／配置VM1/1（491.9942ms）、profile3/3（430.4623ms）、実Host1/1（81245.924ms）、関連準備24/24（640.3961ms）が成功し、両限定独立再確認は残指摘0。最終VMだけの編集前後でworker SHA-256 `1bde46e12b3cca40494b7bfb9f6b9f8b0caf4feb04ce1af721e52c7ef41c9420`と親Host Case本文Hashが不変、自己生成Root残存0。初回strict／Lint／VMの失敗値は成功へ混ぜない。Host profileは27 Case／全104項目へ同期した。製品Source・旧AfterRecordedは不変更。auth作成unknown終了、実Native再起動、旧経路全体の置換と全体E2Eは未完了である。

再実行入口はCoordinator Packageから`npm run check`の後、`node --experimental-test-module-mocks --test --test-name-pattern='restart_cli_entry$' ./tests/integration/current-host-transition.integration.test.ts`とする。最終の通常`check`もExit0（整形887 File、Lint888 File・既存Info54／Warning0、両台帳受理）。完全出力はこの入口で再生成できるため実行別Evidence書庫へ複製しない。Catalog JSONはBiome対象外であり、個別formatの「対象なし」を検証成功へ数えない。

auth作成unknownの接続試験では、初回が試験用子Bの60秒期限で履歴出版途中に切断された（Exit1、107860.8697ms）。専用保存・Host両不存在・終了保存・履歴書出しまで進んだことは確認したが、新品Case成功とはしない。同IDの正式再入場は`owner_retirement_unconfirmed`で拒否され、準備が専用History Readerで受理した有限形を、退役確認だけが通常Readerへ戻して自己拒否する接続漏れを実状態で特定した。通常Readerの解放確認付き拒否・Host不存在・Host清掃出版なし・completionなしの場合だけ既存History Readerへ接続し、元本文全文一致とfresh Owner・既退役を維持する最小修正を行った。新State／Lock／Schema／Writer緩和はない。静的四段、12形を追加した局所1/1（355.0003ms）、関連51/51（1133.0616ms）、配布19/19（12513.6323ms）、両限定独立再確認残指摘0。通常checkもExit0（既存Info54、Warning0、両台帳受理）。

修正版の同exact ID正式再入場は`recovered`、全共同確認true、対象だけ除去、履歴一件・本文不変、元primary／execution／outcome保全、短命物不存在を確認した。非Native要求は0で、Docker／Provider／再起動は行っていない。失敗Root`current-host-transition-R0cZzE`は46項目のmetadata／Hash二走査一致と昇格CIMの関連Process0を確認後、自己生成試験物だけ清掃しENOENTを確認した。この処置は失敗試験の清掃根拠であり、新品auth Caseの成功へ流用しない。試験harnessだけをauth形のB120秒／A180秒へ分離し、他Case・製品期限は不変更。履歴execution比較のMinorも解消し、固定候補の契約／品質残指摘0。新品実行の終端結果は別に確認する。

同意二試験の一時領域是正を限定完了した。`external-send-consent-runtime.contract.test.ts`と`external-send-consent-docker-recovery.integration.test.ts`は同じidentity-bound helperでRootを生成し、全fixtureのfinallyを対応する清掃handleへ接続する。Root DTO・同意／失効／Recovery inventoryの刺激と製品Sourceは不変更。dangling junctionの別targetもRepository内へ限定し、呼出し前の試行済み記録で二重清掃を防ぐ。main一次失敗の後もlink・未試行target・fixtureを各一回試行し、最初の失敗を保持する。実清掃本文を使うVM32組で順序・回数・失敗Identityを確認した。清掃例外は削除後の観測失敗も含むため、一律の物理Root保持とは表示せず、清掃未確認を成功へ丸めない。静的四段が成功し、制限内28/29（junction作成EPERM）と同じ候補の通常Host29/29（1392.4247ms）を区別して記録する。今回三prefixの試験Root残存0、当該二FileのOS一時領域参照・Root直接再帰削除0、diff check成功、契約／品質の固定二File独立レビューは残指摘0。全試験Rootの刷新・全影響回帰・旧経路撤去・実Docker／E2Eは未完了。

Store／Policy試験Rootの限定是正: Desktop修復記録fixtureと外部送信PolicyのRepository fixtureを既存の同実体清掃handleへ接続した。着手前の品質照合でPolicy helperの無引数Host生成から間接的なOS一時領域書込みを検出したため、専用`crdd-policy-host-`親を明示し、真正Host cleanup→実操作RootのENOENT→空の既知回復基底だけの確認→親handle清掃へ接続した。生成・清掃・内容が不明なら親を保持して失敗とする。製品Source、保存Schema、故障刺激は変更していない。制限内の二Suiteは65件中21成功／44失敗、同じ候補の通常Host権限では65/65（7321.8799ms）が成功した。初回formatのWindows Error1224は対象一Fileだけ通常Host権限で整形し再検査した。最終の実操作Root相関・不存在assert追加後は静的四段・Policy4/4（1640.1995ms）成功、契約／品質の固定三Fileレビュー残指摘0。65件結果は当該assert追加前と区別し、最終全65再実行済みとはしない。今回三prefixの試験Root残存0。全OS一時領域解消、実Docker回復成功、全体回帰・Package完成へは拡張しない。

ACK二失敗の限定是正: 全Source・Script・現行Registryの呼出しを照合し、Host既定Windows Rootを暗黙選択する未使用のACK／確定wrapper二つだけを撤去した。実Callerがある`FromVerifiedRoot`本体と現在のsettlement-store、Reader、保存・GC処理、Schema、公開理由の優先順は不変更。API試験は両旧入口の不存在と明示Root本体の存在を同時に確認する。旧ACK fixtureは現十一項目decoderで拒否される負例として保持し、現形式の受理、固定Repository欠測の拒否、別Attemptの拒否、入力全文不変を分離した。初回Lintの動的namespace参照Warning一件を静的参照へ是正後、静的四段・限定6/6（541.4137ms）・Orchestrator受理／状態遷移と終了接続30/30（333.75ms）が成功し、契約／品質の固定二File独立レビューは残指摘0。通常`npm run check`もExit0（既存Info54件、Warning0）で、両追跡台帳を受理した。ACK保存・GC実成立や旧Runtime Suite全体の成功は主張しない。次段落の初回二失敗はこの候補で是正済みであり、他試験の一時領域・旧経路撤去・全影響回帰・実境界・E2Eは残る。

試験Root是正の限定着手: 旧journalはconsent-storeと回復lifecycleが本番利用しており、旧名だけを理由に試験を削除しない。`docker-recovery-journal.integration.test.ts`と`docker-recovery-runtime.contract.test.ts`の一時Root作成だけを現在Repositoryの`.crdd/tests`へ移す。個別実行・回帰Runnerの双方へ同じ制約を適用するため、global preloadや新Runner設定は使わずtest-only helperを両試験が直接利用する。生成時と清掃時の実体を同じhandleへ結合し、祖先／Root不一致・観測不能は削除0、清掃後はENOENTを確認する。runtimeの既存環境復元・内容／実体Oracleは維持する。契約／品質の着手前照合でjournal側清掃の生成時実体との未結合を検出し、統合補正方針を両確認者と照合した。製品Source・回復条件・期限・保存形式は対象外で、他試験のOS一時領域使用まで解消済みとは扱わない。初回検証は静的四段・Root反証2件とjournal全26件が成功。runtimeの限定6件は4成功／2失敗で、既存公開API集合とACK拒否理由の期待差を検出した。実TEMP再入場Caseは成功し、試験Rootのafter清掃も完了したが、旧Suiteの成立・全体回帰成功へ読み替えない。二失敗の是正は現在の製品契約との照合後に行う。 修正版の品質指摘一件（CWD非依存の正常対照がRoot自身をCWDにしていた）をpackage実DirectoryへのchdirとRoot差assertで是正した。最終候補の静的四段・journal26/26（8313.9545ms）・実TEMP再入場1/1（575.175ms）・diff checkが成功、契約／品質再レビューは残指摘0。今回四prefixの試験Root残存0を確認した。この二ファイルのRoot是正だけを限定完了とし、初回二失敗・他のOS一時領域使用・旧処理撤去は未解消として保持する。二失敗の調査では、未使用のHost既定Root ACK wrapperのexport残存と、旧receiptContentIdentity等を渡すfixtureが現在の閉じた受理Schemaへ不一致であることを確認した。期待値だけを合わせず、現在の利用側・設計との照合を次に行う。

### Probe起動・取消のDI集約 — 着手前照合 2026-10-16

固定payloadの集約を限定完了した。六profileのPython本文と期限はDIの既存`PROFILES`だけが所有し、上位の重複本文・create引数生成を撤去した。上位の私有Identityはprofile必須とし、現在の六形と旧記録再入場専用の`legacy_recovery`を明示的に分離する。旧形式への暗黙fallbackや保存Schema変更は追加していない。固定基準版の六payloadのbyte長・SHA-256と作成argvを独立期待値にし、inspect／cleanup双方の14組、欠測・空・未知profileで下位呼出し0、合法な別profileへの変異拒否を確認した。初回品質指摘のcleanup側Oracle不足と設計本文の旧分岐説明を是正し、静的検査・構成投影5/5（239.0929ms）、契約／品質再レビュー残指摘0を確認した。同じ製品SourceのDI通常277/277（33236.3698ms）は当該試験・文書是正前の結果として区別する。実Docker・外部AI・再起動は発行していない。次は全体回帰の試験Root是正と旧回復経路の能力照合・撤去を進める。全体完成・Commit／Pushは未成立。

次段落は固定payload集約前の取消移管の結果であり、payload重複の残件表記は当時の状態を示す。

取消・稼働残存の技術移管を限定完了した。`probe-runtime.ts`が三地点の同期三Path捕捉、fresh構成、attach・ready・SIGTERM・completion・joinと稼働残存開始を所有し、上位は二保存・同ID相関・Host清掃・公開最終判定を保持する。上位の旧attach型・中継・技術要求wrapper・未使用期限を撤去した。初回独立確認の三指摘（eager join例外による一次原因喪失、理由優先順のOracle不足、上位残存開始未到達）を是正し、複合故障・公開DTO全文・合法別対象変異を追加した。元失敗を保持し、join不明と上位cleanupが最終理由へ順に反映される。通常の取消分類は固定旧版との156条件比較が一致。修正版の静的検査、DI通常277/277（33326.9716ms）、上位関連11/11（349.8439ms）、台帳25/25（11287.0363ms）が成功し、契約／品質再レビューは残指摘0。是正前の277件成功やformat失敗を現候補の根拠へ流用しない。新State・Lock・Registry・実Docker操作は追加していない。実取消・実稼働回収は未確認で、固定payloadの上位重複、旧回復経路撤去、全体回帰・実境界・E2Eは残る。Package全体の完成とCommit／Pushは未成立。

以下3段落は今回の移管前の限定結果／着手前記録であり、「次」「まだ残り」「未完了」は当時の状態を示す。取消・稼働残存開始の現在状態は上段を参照する。

完了待機の限定成立: 固定profileのstart --attach、期限、CLI確認を含む時計測をDIへ移し、生出力ではなく閉じた隔離判定・lifecycle判定・計測事実を返す。旧二normalizerとの読取り専用比較は119条件・238結果が一致した。隔離判定とlifecycle判定のSignal／stderr条件差を維持し、新たな拒否条件を足していない。初回品質確認の搬送・私有評価Oracle不足とHeader不整合を是正し、実15helper・本番run本文・既存WeakMap群を接続する独立試験を追加した。通常／四故障の対象相関、合法別profile／ID変異、lifecycleだけblocked、候補全文と最終消費を確認し、Symbol／Catalogへ登録した。修正版の静的検査・上位関連6/6（290.6122ms）・DI関連6/6（210.1974ms）・台帳25/25（12115.4501ms）が成功、契約／品質再レビューは残指摘0。DI通常274/274と関連36/36は追加Oracle前の結果であり、現在の全体回帰成功とはしない。途中で誤って実行したWindows Process Gateは制限内で失敗し、自己生成の未終了Worker一件だけを親子PID・作成時刻・固定Scriptで再確認して終端・不存在確認した。この失敗を成功へ読み替えず、実Docker・実取消は今回実行していない。次は残存開始・取消の技術所有を同じ移管契約で閉じる。Package全体・旧経路撤去・E2Eは未完了。

候補実装の現在地: `execution/probe-runtime.ts`に固定六profileと既存Engine判定・createを接続し、通常／四故障／取消／残存作成の既存Callerを新作成境界へ変更した。上位の二保存とcreate unknownの保持は維持する。独立品質確認で作成対象搬送と最終投影のOracle不足を検出したため、六形の全create argv、全Callerのprofile／Probe名／三Path／Binding相関と合法一軸変異拒否、実投影によるunknown未回収と保存失敗後の補償回収の全文期待を追加した。失敗直後の同ID保持と回収後の参照null・保持false・cleanup confirmedを混同しない。製品Sourceの結果優先順・回収条件は不変。是正後の対象3/3・失敗0（300.7572ms）、DI通常272/272・失敗0（32199.7338ms）、契約／品質再レビューは残指摘0。上位接続／台帳29/29（12876.2878ms）は追加Oracle前の実行結果として区別する。上位の固定payload重複、同期実行・残存開始・取消待機の技術所有はまだ残り、このEngine/create部分だけで集約全体やPackageの完成とは扱わない。新管理状態・実Docker要求・署名・再起動は追加していない。

次の移管単位の着手前照合: 契約／品質の二確認を統合し、Engine・create・ID保存後の同期実行／残存開始・取消実行をDIの一つの技術群へ集約する方針とした。Hostのnull-ID保存→create→exact-ID保存→実行という上位順序を保持し、下位からWriterを呼ぶpipelineを作らない。固定payloadと技術timeout・計測はDI、profile選択と公開解釈は上位。取消await間の既存mount現在性確認は狭い読取りだけを下位へ渡し、失効後の前進Effectは0とする一方、取得済みhandleのjoinとexact補償回収は継続する。元失敗と回収factsを分離しつつ、公開reasonの現行優先順は変更しない。新State・Lock・Registryは追加しない。正式な境界は[DI詳細設計](../../../06_Architecture/Details/docker-isolation/01_Architecture.md)へ反映済みであり、実装・上位要求列試験・実境界は未完了。

### 修復Writerと全Machineの本番接続 — 着手前照合 2026-10-16

通常回帰の再収集（2026-10-16）: 静的通常入口成功後のCoordinator portable実行は、旧Journal／Recovery試験がOS一時領域を使用することを出力から確認したため中止し、Exit1で終端した。全件数や全失敗集合は確定しておらず、全体回帰成功へ数えない。旧署名・旧配布閉包、旧修復記録、試験のリンク／rename権限制限による失敗を確認した。今回の試験Process残存は読み取り専用のProcess一覧で0、明示観測した`crdd-coordinator-recovery-test-run-Ztty60`はPathNotFoundで不存在を確認した。他のOS一時物全体の清掃完了は主張しない。以後の広い実行前に、試験一時Rootを検証済みRepository内へ限定する実行設定／既存fixtureを照合する。旧試験の失敗を理由に製品保証や許可集合を弱めず、署名前提の試験は現方式の成立能力との対応後に処置する。

診断Probe観測・回収の実装（2026-10-16）: DIの`execution/probe-container.ts`へfresh inspect／Running肯定、実ID限定removeと三軸不存在の同期群を移し、全既存Callerが利用する上位の私有関数を接続した。上位のHost保存・私有参照相関は維持し、新しい共有状態・通知guardは追加していない。独立レビューで新入力検査と既存plannerのProbe名規則差、三軸の対象相関Oracle不足、旧Headerを検出し是正した。不正名三形×三APIの要求前拒否、64文字正常対照、三軸の別合法値への搬送変異拒否を確認。変異VMのrealm差による別理由拒否も是正した。修正版の関連3 Fileは9/9・失敗0（1085.4898ms）、DIの通常`npm test`は整形・型・Lintと271/271・失敗0（31160.0627ms）。Coordinatorの通常静的入口も成功し、固定7 Fileの契約／品質再レビューは残指摘0。QA／Symbol／台帳の追加4 Fileも同期し両限定再確認は残指摘0、台帳25/25・失敗0（11601.9152ms）。この単位を限定完了とし、作成・start・attach・取消全体、旧記録撤去と実Dockerは未完了。今回Docker要求・再起動・外部AI・Commit／Pushは発行していない。

Orchestrator依存検査の限定完了: 修正版の関連3 File（依存境界・単Task Adapter・上位実行）は81/81・失敗0・Exit0（373954.7678ms）で終端した。全単体73/73と固定7 Fileの両再レビュー残指摘0に合わせ、この単位を限定完了とする。旧候補81件の結果は採用していない。今回作成した`project-execution-*`領域の残存はなく、10月8日の既存一領域は今回の清掃対象に含めていない。仮想依存検査の設定ファイルも物理保存していない。

観測・回収移管の着手前方針（限定完了前の記録）: `isolation-probe.ts`のDocker技術観測・回収群を対象とした。現在の次単位は先頭のProbe起動・取消のDI集約を参照する。通常doctor、故障4形、取消、旧Probe回復の全Callerが同じinspect構成／Running、実ID限定remove、ID・名前・labelの三軸absenceへ接続するところまでを対象とする。既存DIの固定command・構成・結果分類を利用し、下位へHost token／保存本文／上位Capabilityを渡さない。上位は私有参照・payload候補・三Pathの投影と、Host世代／保存／公開結果相関を保持する。新State・Lock・Registry・Session管理Mapは追加しない。作成・start・attach・取消全体の技術Session化と、旧record／署名Matrix撤去は後続であり、この単位だけでDocker Isolation完成としない。旧Matrixの実行中Container回収は過去の成立能力として保持し、現方式の真正Owner・保存・fresh Consumerを使った別実境界が成立するまで削除しない。v0.18復旧7/7と後続保持物集約の過去Evidenceは参照用に維持するが、現版成功へ流用しない。追加実Docker／再起動／外部AIは今回許可されていない。

着手前の契約／品質照合では、下位のRunning観測は`runningConfirmed`等の肯定だけを表し、falseを停止・不存在の証明へ使わない。observeとcleanupを分け、cleanupは削除直前にfresh inspect／構成照合を行い、remove後の三軸確認まで所有する。旧再入場の「既に不存在ならremove 0」も保持する。固定入力は実ID／Probe相関／選択済み候補集合／三mountをEffect前に捕捉し、上位の単一候補と旧source未保存時の既存集合を勝手に統合しない。既存reason・要求順・取消の開始前／ready後inspectを維持する。

同照合で提案された「成功DTOコピー防止の同期一回通知」は、実際の入力経路を再確認して不採用とした。上位は私有参照から得た値で固定ESM importを同期直呼出しし、その場の閉じた結果だけを判定する。外部DTOを受け入れる引数・再採用API・差替え依存・保存済み成功値の再利用は新設しない。コピー注入にはSource／module loaderの改変が必要であり、これを新しいRuntime脅威として広げない。既存absence Mapには下位DTOをAuthorityとして保存せず、上位が保持するexact ID／Probe／Host／Root／CLI相関だけを登録し、既存の照合・一回消費を維持する。blocked・throw・不正結果・私有参照欠測ではMap登録とHost遷移0を確認する。新しい通知guard・WeakMap・Receipt Frameworkを追加せず固定同期接続で成立する、という統合方針に両確認者が整合した。

Orchestratorの現責務による依存検査（2026-10-16）: 旧Folder集合が空となる検査を、設計のFile単位境界へ切り替えた。現58 Fileを純粋32／業務11／接続11／保存3／公開entry1へ重複なく対応し、未知・欠測・空集合を拒否する。型専用辺と実行時辺をASTで分け、混在named typeを別辺にし、純粋集合外の実行時参照、内部型Path、自己公開entry／保存等の型参照、許可外Node symbolを拒否する。Node型除去の局所実測では通常inline-type-only import／exportは空ロードを残し、宣言全体のimport typeだけ消えることを観測した。監査指摘に従い、空named宣言と通常inline-type-only宣言にも実行時辺を保持する反証を追加した。型だけであることから所有境界の例外を作らない。

状態受理のSnapshot参照を既存Orchestratorヘルパーへ統一し、配送型は三状態・五項目参照と終了観測の最小構造をOrchestratorが所有する。Coordinator内部戻り型への参照やcast・新公開APIは追加しない。着手前にはDescriptor条件を同義と判断したが、品質監査でprototype継承valueの実差を検出した。旧local helperのまま新VM反証を実行すると、get/set未定義accessorを受理して失敗した（118.3513ms）。共有Descriptor判定一条件を`Object.hasOwn`へ是正し、隔離realm内のdata受理／accessor拒否／getter0・旧in式のexact一変異検出・Host prototype不変を確認した。RecordとArrayへの波及を含む全Orchestrator Unit73/73（1110.2934ms）、境界4/4（492.8547ms）と静的検査は成功。旧候補の関連3 File81/81（355999.6583ms）はhelper是正前であり、最終根拠へ流用しない。修正版の同関連回帰を実行中。固定7 Fileの契約／品質再レビューは残指摘0だが、機械確認の完了はその終端後に確定する。Sourceの新Framework、Docker操作、外部AI、Commit／Pushは発行していない。

CLI試験参照の現構造接続（2026-10-16）: Launcherと取消・対話境界の3試験ファイルが旧`coordinator-command.ts`等を参照していたため、現`command.ts`／`task-cancellation.ts`／`task/execution.ts`へ接続した。stdin読取りは`request-input.ts`が所有し、commandはimport済みreaderへ委譲する。独立レビューで変異試験の別理由拒否と文字列照合の弱さを検出したため、既存TypeScript APIの仮想overlayで、同Projectの正常コード受理、構文診断0、取消6変異の固有failureとimport欠測なしを確認する形へ補強した。stdinは実Task関数・実代入先・readerのsymbol相関、nested function除外、node:fs由来のdefault／namespace／named aliasによるfd0読取りを照合する。別receiver・named alias・別未呼出し関数decoyを含む7scenarioを反証した。仮想fileは物理作成せず、APIをsnapshot解放後に終了する。初回の旧import不整合・仮想Projectのreader欠測・unbound fs反証を成功へ丸めず、修正後の取消／Launcher全20/20（3971.2454ms）、stdin対象1/1（1627.9382ms）、静的三軸成功を採用する。整形は制限内でWindows error1224となったため対象一Fileのみ通常Host権限で成功させた。契約／品質の限定再レビューは残指摘0。実stdin・実Console全体の成立は主張しない。製品Source・取消条件・Docker操作は不変。続くOrchestrator非依存試験は旧Core Folder集合が現配置に存在せず、Core空集合で1失敗／3成功（100.4431ms）を再現した。無言の除外や許可集合拡張ではなく、現Architectureのファイル責務へ照合して是正する。全体完成後のみCommit／Pushする。

通常回帰の試験解析是正（2026-10-16）: Coordinatorの通常portable回帰はExit1で終了した。出力が省略されたため全失敗件数・全失敗一覧は未確定とする。publication／signed-general試験のraw scannerはtemplate・正規表現で進捗を失いメモリ枯渇していたため、既存TypeScript API／仮想Filesystem／ASTへ置換した。publicationはentry起点の相対依存とImportEquals、systemは旧From条件に対応する集合と非literal sentinelを維持する。仮想Sourceは物理保存せず、snapshot解放後のAPI終了を共有イベント列で観測する。試験Rootは検証済みRepositoryの`.crdd/tests/crdd-history-publish-*`直下だけとし、祖先非link・清掃前実体一致・清掃後不存在を確認する。製品Source・許可集合・署名条件は変更していない。静的三軸成功。制限内の全2ファイルはhardlink EPERM等でExit1、同候補を通常Host権限で再確認し62/62・失敗0（29496.2602ms）となった。契約／品質の限定再レビューは残指摘0。これは通常回帰全体の成功ではなく、旧パス・配布／署名契約・本番現在状態に関する残失敗の是正を続ける。Docker・外部AI・再起動・Commit／Pushは発行していない。

現在入場の台帳伝播漏れを是正した。既記録の旧global inventory Case廃止方針に対し、`TRANS-ACTIVE-TO-RECOVERY.from`にだけ残っていたADMISSIONを除去した。IDなし観測拒否は既存OPERATOR-TRANSFER Caseへ結合し、全回復IDなし・操作生成／Provider開始／清掃要求0を確認する。追加Oracleの初回は旧fixtureがDocker資源保持を仮定していたため一件失敗し、その旧仮定だけを除去して再確認した。製品Sourceと後続12回復Caseは不変。静的検査、通常`npm run check`の両台帳、台帳10/10（326.4298ms）、終端53/53（495.1428ms）、Task Runtime全164/164（1019.0283ms）が成功。lintの既存54件は情報表示でありエラー／警告ではない。契約／品質の限定再レビューは残指摘0。全体E2E・実Docker限定終了・旧経路撤去・Package完成は別の未完了範囲として維持する。

旧検証Tool全体の固定検査を通常実行から明示的な任意入口へ分離した。通常の型・整形・lint・二台帳検査と、生存する四つの境界試験は保持する。独立レビューの除外範囲過大・別引用形式の閉集合検出漏れを是正し、Legacy除外はCoordinatorのintegrationだけに限定した。通常文字列・single quote・backtick・動的templateの追加／改名を同じOracleで拒否する。初版scannerはtemplate再走査不足で長時間化し、今回のworkerだけを照合後に停止した（111306.3786ms、Exit1）。template再走査・進捗guardと反例の局所走査へ是正した後、静的検査・選択契約3/3（415.1278ms）、Runner全体52成功／失敗0／既存人間UAT一件未実施（15601.3849ms）が成立し、契約／品質の限定再レビューは残指摘0。任意の旧graphは既知のchild_process_unboundでExit1のまま、通常台帳のADMISSION異常系一件も未解消であり、全体回帰・旧Matrix置換完了とは扱わない。

旧Matrixの移行根拠を分解した。failure四形と取消は既存個別実体へ対応し、清掃観測を省略した正常exitと外部親による終端は現在方式の実Owner／保存／fresh Consumerへ別々に接続する。`cleanup_withheld`は保存三確認・実Reader・Host一回・五資源未要求から終了0、finally未実行・実Host残存、別Processの同exact ID回復、履歴一件・対象除去・兄弟本文／実体保全まで成功した。改称後の局所／profile3/3（51666.325ms）、台帳25/25（12713.4693ms）成功。auth用局所counterを全Process発行監視の証明へ拡張しない。

外部親終端の初回は制限内の補助status1と元子close未到達で失敗し、試験Runnerが残った（Exit1、2成功／1失敗、114645.2107ms）。自己生成worker `41948`と子孫だけを再観測後に終了し、同exact IDの正式fresh回復は全共同field confirmed・violations 0で成功した。対象は`.crdd/tests/abandon-owner-1olJCF`、回復IDは`docker-task.34f6d0601260134ad6503a0babd22e43a09a00a7bb24e60068b241813ddc94d2.92f7632672830301a71131873e64090e682b490d345358c89e68dd098b7bc0d4.41e261d6e241194d00fcf8ca21435c5d726c602148dd168be3160bd94bdda249`。Rootは履歴一件・未解決0、54項目の二走査・非使用・境界を確認後に清掃し不存在を確認した。親helperの失敗時清掃不足を、同owned childへの負例専用fallback一回・close確認とprimary／cleanup分離で是正した。実本文の局所反証とprofile3/3（479.6737ms）・静的検査成功。通常Host権限では同修正版の親終了・fresh回復、局所反証、profileの4/4（27313.2271ms）が成功し、契約／品質の限定再確認は残指摘0。失敗結果を消さず、fallback成功を正例へ数えない。Host profileは5mode・12項目／全103項目へ同期した。旧Matrixの稼働Container回収能力は未置換で、旧Script／CLI／graphを削除しない。Docker・Provider要求、再起動は行っていない。

最新の承認済み限定実試験は`stage=restart`の直前baseline比較で停止した。差の分類は`networks`のみで、実再起動要求・準備削除・本体削除は各0。exact IDは`docker-task.26761f9b1e5a1ea0ae0889f450e93f2278452387450ed1da58706c21b1060ab3.d314ac22eb383414a2da8bbc0542f9bc964780ae0641b12be27f8589ba5430b1.d643a6ab3eea63ca05727b4780185879774d71756183b54944664c7cdeb8f735`。同IDの正式回収はDocker／Host／排他／履歴／操作除去すべてconfirmed、pending／unresolved 0、履歴一件、未要求の兄弟fixture保全、55項目の二走査一致・非使用を確認し、専用Rootを清掃・不存在確認した。既存停止Containerは維持。Network差の具体原因は未確定で、直後の既存イベント読取りには該当Networkイベントがなく、原因不存在の証明にはしない。再試行せず、今回の承認による試験実行は消費済みとする。実再起動・限定unknown終了の成立は引き続き未実証。

inspect構成・Path照合を`docker-isolation/src/execution/probe-configuration.ts`へ等価移管した。上位は既存六payload集合／単一候補の選択と三mount Pathだけを渡し、Host・保存・Authorityは移さない。既存の文字列pids・追加SecurityOpt許容、descriptor読取り、実realpath、OS別比較と拒否条件を維持。下位3件・公開集合込み5件、上位搬送2件、台帳25/25（13377.6316ms）が成功した。独立品質Minor二件はaliasによる非同値Pathでの観測順序Oracle・逆転変異と、QAの私有参照取下げへの説明限定で是正した。是正後のDI全通常270/270（31541.5213ms）・静的検査成功。契約／品質の限定再確認は残指摘0。実Docker、Host世代Owner実失効、旧graph、全体完成はこの移管単位から主張しない。

診断Probeの結果分類移管は限定完了した。作成ID・ID集合・三軸不存在の四関数を`docker-isolation/src/execution/probe-result.ts`へ移し、上位四利用箇所はRoot公開の二normalizerへ接続、旧実体・exportは撤去した。旧HEADと新blockの全文SHA-256はともに`2b9c36311cb9a18decb27554eb464caeaba3be6f951aa0a59fe79f7318353279`で条件不変。Host保存・世代・Authority、inspect判定はこの単位では不変更。QAのAI結果項目を流用せず`ERB-UT-038`へ接続し、ARCH／Detail分析、Symbol、Catalog、現在Quality Centerを伝播した。検証項目節だけの再集計は13定義196項目、QA-000006は32項目であり実行／Pass数ではない。

静的検査、局所3件、公開集合を含む5件、台帳25件が成功した。DI全通常は公開集合更新漏れ一件を検出・是正後267/267（30882.6298ms）で成功。独立品質のMinor二件は成功時reasonの全文Oracleと現在集計の更新漏れで、Sourceを変えず是正し、静的・対象5/5（556.3411ms）で再確認した。契約／品質の限定再レビューは残指摘0。この267件はassert／文書是正前の同Source結果と区別する。実不存在・回収、旧署名graphと全体完成の証明にはしない。次はinspect構成とPath同一性の技術判定を下位へ移し、上位にpayload選択・Host／保存連携だけを残す範囲を照合する。

現在の診断候補: 二読取りspy是正後の追加実試験も、同じ`docker_restart_stop_unconfirmed / request=not_issued / effectOutcomeUnknown=false`で停止した。exact IDは`docker-task.f86b848cbdc80a734a999dd8d180d15422fa9e06ac9264a5427cecee8472bd9f.64c3c391406634dbaf6ce6105903a66972e76a15be3790c5685642cc63427513.5b49a4b42052e48bb3676b23a8684904b368eecb6279fa5568c22e2b19569477`。この回も実停止／再起動0・削除0・専用保存0だった。人間が承認した失敗時処置として、同ID正式回収の全確認、履歴一件、別の未要求fixture・host_only、pending／unresolved 0、二回tree一致55項目、非使用と既存Container不変を確認し専用Rootを清掃・不存在確認した。

失敗箇所を同じunknownへ潰す不足を、DIの既存Machine→Runtime結果の`stopFailure`（閉enum／null）へ補った。再観測、要求順・回数、期限、既存reason／primaryFailure、checkpointと回復判定は不変更。停止成功／未実施はnull、stop開始でresetし、cleanup不明でも診断を保持、settledと返却を一致させる。境界失効を待機期限と誤分類する独立指摘を、既存一回のlive結果保持で是正した。Machineは公開せず型だけRoot exportし、上位は診断を搬送するだけ。契約／品質の限定再確認は残指摘0。最終候補のDI全通常264/264（30484.0516ms）、親11/11（653.1492ms）、実保存・履歴・終了のHost1/1（28654.7036ms）が成功した。先行全通常263件は追加反例前の結果として区別する。

停止命令だけを必ずnot_issuedの代役へ固定した実読取り確認は、stopFailure=`stop_request_unconfirmed`・代役到達1・Effect不明false・実停止0・Helper回収confirmedで終了した。これはその時点の停止前確認通過だけを示し、同時点の真正上位Ownerや実停止・再起動・限定終了の証明ではない。診断付きの新品一回は別途承認待ちで、自動再試行しない。全体の旧経路撤去・署名graph・回帰・Reality Auditは未完了のまま。

最新の限定実試験は未成立である。先行二試験は、それぞれ同じexact回復IDの正式入口でDocker／Host回収・履歴・排他解放・operation除去を確認し、非使用と自己生成内容を確認して専用Rootを清掃した。二試験目の停止前観測では、試験spyが正規の無config一覧要求を拒否する欠落を局所再現し、その完全一致要求だけを透過するよう試験側を是正した。options参照・固定値の保持と差替え変異を含む静的四段・関連10/10が成功し、契約／品質の限定独立再確認は残指摘0である。製品の停止条件・期限は変更していない。

再停止後のSource照合で、同spyが`observeDockerRuntimeEngine()`の固定無config要求`--host <endpoint> version --format {{json .Server}}`も拒否し、Engine観測がunknownへ畳まれることを契約／品質の読み取り専用確認で特定した。一覧経路だけの反証では停止前読取りを網羅できていなかった。次の最小是正は二つの固定読取りだけの透過と、実Engine本文・classifier・一覧・Machineを接続した合成反証であり、製品条件・期限・Recoveryは変更しない。これを唯一の実原因または再試験成功の予測には使わない。Engine readyとDesktop／backend不在の組合せも要求未発行を返し得るため、別の状態組合せとして確認する。追加実操作はまだ許可されていない。

上記試験側の是正後、静的四段と関連11/11（749.5953ms）が成功し、契約／品質の限定独立再確認は残指摘0となった。実Engine本文・実classifier・実一覧本文を同じMachineへ接続し、正常JSON→空一覧→模擬停止→既知未起動、壊れたJSON／例外／非0の不正出力、Native不在とEngine readyの組合せを確認した。version透過省略・広域許可・options差替え変異も検出した。pipe／Native／WSLは代役で、実再起動成功を証明しない。人間から今回停止した試験物だけの同ID正式回収・非使用／内容確認後清掃を追加承認されたため処置中。追加再試験・再起動は承認対象外である。

同ID正式回収はrecoveredとなり、Docker／Host回収、排他解放、履歴、operation除去の全確認を得た。対象履歴一件、別の未要求fixture一件・host_only、pending／unresolved 0、二回tree一致55項目（Rootを含む）、非link、試験Node 0と既存exited Container一件だけを確認して、専用Rootを削除・不存在確認した。続く再起動なしの既存Native診断はartifact verified／client absent／Desktop verified／backend running／Engine ready・cleanup confirmed、Helper解放confirmedだった。これは順次取得した現在値であり、過去失敗時や次回試験時のatomic状態を証明しない。停止要求は発行していない。

追加承認後の新品試験もstage `restart`で停止した。現在のexact回復IDは`docker-task.30a86ff90870335e2a41aa5b309c3ea91a19b9b120ba8da79836368af63fd7fe.a959edb2d3bb23311e88e8105fec0a666eca2aa17bc7fb8420ad0b4d94768786.151296fde208e7b7839a5741bcc6dbdeac4a72be025b20132a19552480101650`、Rootは`.crdd/tests/auth-create-closure/`、自己生成created Containerは`ce281f0bf8e0efa515780a1091741f569e31e8f35e8689cdf2efc1a649b21359`。restart関数呼出1だが、耐久結果は`docker_restart_stop_unconfirmed / request=not_issued / effectOutcomeUnknown=false / cleanup=confirmed`で、Docker停止・再起動の実発行は合計0回である。準備削除・製品削除・不存在round・専用保存はいずれも0、Rootと同IDを保持した。既存exited Container一件は不変。自動再試行・追加再起動は行わず、停止前判定の原因を読み取りで切り分ける。spy欠落を今回の唯一の原因と断定しない。

広いPackage Filesystem回帰はExit1で未通過。旧配布graph・固定Hash・移管前契約との不整合が残り、局所成功を全graph・Package完成へ読み替えない。以下の「回収中」「比較停止」「確認中」は先行時点の経過であり、現在状態は本段落を優先する。

停止原因の観測補強と旧graph誤拒否の限定是正: 手動試験の失敗診断へ、AssertionErrorのactual／expectedがown property四集合の閉集合である場合に限り、差のある固定名称`containers / networks / volumes / images`だけを追加した。実値・Path・例外本文は追加しない。四種類の差と、継承fieldを閉集合と誤認しない反例を確認し、静的四段と局所9/9、契約／品質の是正後再確認は残指摘0。最初の実試験の比較元は失われており、今回の診断追加で過去の差を特定できたとはしない。人間から同ID正式回収→非使用・内容確認後の専用Root清掃→新品の限定試験一回、Docker再起動は合計一度（これまで実発行0）の追加承認を得て、同ID回収を実行中である。

全graphの最初の停止は、Script相対Pathを基準に兄弟Package importを解決していたため、Platform Access公開入口を識別できない誤拒否と特定した。`assertProcessWrapperConsumerBoundary`の解決元だけをRepository基準へ補正し、公開`scripts/*` key、許可集合、他resolverとexact graph条件は不変更。実Sourceの相対／full Path同値、private／foreign／alias／query／percent拒否、full key拒否、正規化省略・二重prefix変異を確認し、静的四段・局所1/1・契約／品質再確認は残指摘0。全graphはその先の`verify-signed-recovery-matrix.ts`の既存bodySHA不一致へ進んだ。実diffは明示`ready.operationRoot`搬送の追加であり、Hashだけの追従はまだ行わない。関連File全portable回帰は別実行で確認中、全graph・全回帰・Package完成の成功とはしない。

現在不存在classの実試験結果: 静的四段・局所9件とHost清掃manifest1件の成功、契約／品質の実操作前レビュー残指摘0を確認後、一回実行した。stage `restart`の非対象baseline比較で停止し、再起動関数呼出0・削除0・専用保存0だった。exact回復IDは`docker-task.59bcf6875eb719d101e2d3fe2fee7768110a1365ec69b1ab3f2ca12ed0fd51c3.8b31dcf5d7116411a6f54bd83fd1612f2ef39d6dfd3532d4645c8215b99ce6fb.3aa12e4b022e4be1b329e38b3e6cfabf60f9dde2104947e46412f3799774bc9d`、Rootは`.crdd/tests/auth-create-closure/`、自己生成停止Container IDは`f7d1fc6fee81a5dd6fe7ffda3cb2694b819d9178c319afce642b2659ded79f5b`。Rootとunknown状態・Containerを保持し、自動再試行や再起動はしない。読取りでEngine29.8.1、対象createdと既存exited一件、対象は読取り専用の自作Home bindのみ・network none・Volumeなしを確認した。比較元集合は当該Processのメモリだけで、失敗診断が差の分類を保持していなかったため、何の集合が変化したかは未特定であり、製品または外部Docker処理の原因へ断定しない。不存在classの実成立は未確認のまま。別途全体`npm test`は875Fileの静的検査へ進み、試験fixtureの条件式内代入を等価な条件前代入へ是正した後、旧署名配布graphの既知`platform_provisioner_runtime_dependency_child_process_unbound`で停止した。試験本体の全回帰成功とはしない。

現在不存在classの実接続準備: 人間から同じ専用Root・固定Image・自己生成停止Container一件とDocker再起動一回の新たな限定承認を得た。既存手動親へ`--execute-approved --verify-absent-auth`の完全一致形だけを追加し、既知ID発見modeを維持する。実create／inspect／unknown保存後、同exact IDの本番再起動完全成功・現在保存・非対象集合・構成を再確認し、自作exact IDを試験準備で一回回収する。その準備回収と製品の削除を分け、後者0、実DI不存在二round、専用Writer直後のunknown／null ID／null receipt・absenceと保存三確認、履歴・終了を要求する。これは既知createを準備回収した現在不存在classの実接続であり、未知Daemon queue・将来の遅延create・旧経路全能力の置換証明ではない。再起動不明、構成差、回収失敗、観測不能と専用保存失敗では後続を停止し、同Root／IDを保持して再起動を再発行しない。静的四段と追加mode・旧mode・profileの局所9件は成功、独立確認前のため実操作はまだ行っていない。新State／Lock／Store／Frameworkは追加しない。

現在の限定確認: 認証unknown終了後の実履歴保存からtransient終了まで、実Root／Kernel／Filesystemを使うHost試験1/1が成功した（50538.22ms）。その接続で、通常Readerを先に通す外側guardが専用出版を拒否する欠落を検出し、既存private出版pairの元本文／候補による純粋な差分照合へ修正した。排他内のfresh Root・Owner・CAS・一回使用検査は維持する。ACKも同じpairへ統一し、部分Effect後は再入場のEffect 0や解放不明で破棄せず、三確認成功まで保持する。8経路の正常・元本文不正・候補差・認証情報差・複数pair、Reader単独拒否、guard省略変異とACKの中断／再開・Buffer分離を本番本文で反証した。静的四段と関連56/56が成功し、契約／品質の限定独立再確認はともに残指摘0。これは実Daemon・再起動・実Consumer ACKの証明ではない。広い保存・pending再入場回帰は制限内のhardlink作成EPERMを分け、同じ候補を通常Host権限で1/1成功（195860.2923ms）。Docker Isolation通常258/258、実Windows6/6、台帳25/25も成功した。実Windowsは制限内でNative取得・子終端の4件が失敗し、同じ候補の通常Host権限で全件成功したもので、元失敗を消さない。失敗試験の残存Root一件は記録PID二件と固定Workerの不存在、自己生成ready.json一件・非link・exact Rootを確認して回収した。実境界、旧処理撤去、全影響回帰とPackage完成は未完了。以下の未完了表示は各時点の経過として区別する。

保存入口の追加反証も限定成立した。自己生成Root内の真正Host／管理CapabilityへRepositoryを結合し、その実operationIdをfixture Identityへ反映した一般Snapshot保存でも、専用候補は固定理由`coordinator_state_authentication_closure_owner_required`・Effect false・本文／短命物不変で拒否された。専用Writerでは既存Kernel取得だけを代役化し、実排他取得後に論理Ownerを失効させた新query版が、取得1・blocked・Effect false・排他解放・本文不変として停止することを確認した。実Owner喪失の発生機構や実Daemonの証明ではない。mock復元と真正Host清掃をfinally／終了処理へ含め、自己生成Root残存0を確認。静的四段後、同固定候補Host1/1（31828.7484ms）と関連55/55（1235.8939ms）が成功し、契約／品質の限定独立確認は残指摘0。一般Writer二重guardの省略変異、全終了利用側、実restart／DI観測、旧経路撤去と全体完成は引き続き未完了。

Driver本文から実保存への限定接続を追加確認した。本番の資源期待値投影・checkpoint保存・資源回収の三関数を一意抽出し、実Root／Kernel／通常・専用Writerへ接続した。Readerは実Fileを復号する代役、Owner生存・DI観測・再起動結果は合成で、実Daemon・本番長期排他を証明しない。正常、既知ID優先、各roundの観測不明／Owner失効、専用Writer拒否／例外／読戻し差／解放不明、保存済み再入場とID相関変異の12条件を確認した。VM realm差の受渡しと型注釈不足は試験側で是正し、製品Sourceは変更していない。初版Oracleの耐久ID比較不足Moderate一件を是正し、identified保存IDだけを別の合法IDへ変える一意変異が同じ削除直前Oracleへ一回到達し、相違検出・削除0・blockedとなることを確認した。正規経路の同ID保持、他四資源・資源外全文保全、二round間の再確認と保存順、保存済み再入場の通常cleanup更新0も確認。静的四段後の修正版Host1/1（29665.0389ms、失敗／取消／skip0、Exit0）が成功し、契約／品質の是正後限定再確認は残指摘0。関連portable＋profile55/55（1437.5955ms）はID反例補強前の候補結果として区別する。一般Writer迂回と専用Writer排他内Owner失効、全終了利用側、実restart／Daemon観測、旧処理撤去と全体完成は未完了。

専用物理Writerの部分接続も確認した。自己生成Git Root・真正Repository借用・既存Kernel・実Writerを用い、合成したcodec合法auth unknown／完了再起動状態から、別operationId・Owner失効・元版差の拒否と本文不変を確認した。exact `state.pending.json`→`state.json`のrenameだけを故障注入し、部分Effect・候補保持・排他解放、復元後に同じ元版からの再入場、revision／previous Hash・読戻し・短命物不存在を確認した。資源配列を差し戻すだけでは他四資源保全を独立観測できないというMinor一件を是正し、purpose別全文比較と他資源／authの単独変更負対照で補強した。型注釈不足の是正後、静的四段と修正版Host1/1（3554.2258ms）、profile2/2（130.8522ms）が成功。契約／品質の是正後限定再確認は残指摘0。Host分類は16File・101Case、自己生成Root残存0。Owner生存、再起動、Docker不存在は合成入力であり、この試験は実DaemonやDriverを証明しない。専用Writerの一般保存迂回・排他内失効等の反証、Driverの順序・拒否・保存済み再入場、全終了利用側、実境界と旧経路撤去は引き続き未完了。

認証unknown限定終了の現在地: 専用候補・既存Writer内の一回保存Context・回収Driverと共通終了判定への接続を候補実装した。契約／品質の限定確認で、Writer Ownerと対象TaskのoperationId照合不足、共通履歴Readerに旧資源判定が残る二つの接続欠落を検出し、元版／候補のexact対象一件・Identity不変・operationId一致の外側／排他内照合と共同資源判定への置換を行った。保存前unknownと保存後の専用不存在を分けた一軸反例を追加した。追加試験の型注釈不足と、通常の未要求／未発行終端まで拒否するとした試験期待値を是正してから再実行した。さらに実Sourceの外側wrapperと排他内guardを独立抽出し、別Owner・重複対象・Identity差・Owner失効、guard省略変異を到達counterで反証した。このVM試験は実Kernel／Filesystem保存を証明しない。最終固定候補の整形・Source strict・全試験strict・Lintと関連53/53（1141.9225ms）が成功し、局所修正・純粋値契約・二重guard反例の契約／品質独立再確認は残指摘0・限定Pass。既存state_saved別Process回復も1/1（63742.006ms）成功。ただし専用物理WriterとDriverの肯定・拒否・保存中断・再入場の追加試験は未完了であり、これらの結果を新限定経路の到達証明へ流用しない。本番限定終了・旧経路撤去・Package完成は未成立。新Store・Lock・Map・互換Reader・追加再起動は導入していない。今回の自己生成資源試験Root残存0も確認した。

旧回復経路の撤去前Gate: 旧restart fenceが担っていた「認証Probeの作成結果がunknownかつ実ID未発見でも、要求終端後に限定終了する能力」は未置換である。今回の実測は既知ID発見・回収であり、この能力の根拠へ拡張しない。現在Driverは発見なしをunknownへ保持し、通常cleanupと資源終端判定もID未確定の不存在を拒否している。したがって旧After二入口・Observer・Docker固有journalの撤去より先に、既存Architectureのauth専用限定Classを接続する。旧署名形式・跨版採用・handoffを新Runtimeへ復活させない。

旧Ownerの正常清掃後失効は、本番Adapter計画・真正Host／Kernel・実binderと毎回の実管理借用へ接続して確認した。同じauth create／startの肯定各一回、真正cleanup completed後の回復世代保持中／解放後の下位開始0、cached借用変異の個別検出を確認。代役のcounterを実config／Handle生成の実測とは表示しない。実行profile・Header／Symbolの同期と各commandの独立Oracleに関する3指摘を是正し、関連10/10（587.72ms、Host222.7375ms）、静的三軸成功、契約／品質の限定再確認は残指摘0。試験Root残存0。この単位はRoot存続中のKernel失効・既発行CLI／Daemon要求終端・限定unknown終了の証明ではない。次はそのKernel失効反証と、専用候補／Writerおよび全終了利用側への接続である。

Root存続中の世代失効の反証も追加した。Supervisor取得だけを代役とし、query付きの本番module一個でprivate世代・実Filesystem・Adapter計画・binderを共有する。生存肯定各一回→assertLive falseの実到達一回→true復帰後も元Owner／create／start不可、各commandの開始増分0とcached借用変異の個別検出、Root／markerの実体・本文不変を確認した。同moduleの真正cleanup completed、Supervisor解放一回と外側finallyのmock復元、自己生成Root残存0を確認。静的三軸後の関連11/11（650.5906ms、失効Case62.082ms）、profile同File2Case・全100Case、契約／品質の限定再確認残指摘0。これは論理Kernel故障を受けた本番世代機構の不可逆失効であり、実Kernel故障・既発行CLI／Daemon終端・限定unknown終了の実証ではない。後続は合意済みの専用候補／Writerと全終了利用側の接続、反証と実境界確認である。外部不存在観測を短期Writer排他中に行わず、既存CASと専用Hash相関を分離する。

最小接続の照合範囲は、同じTaskのauthだけunknown、他四資源通常終端、Provider未開始・外部送信／共有書込み未発行、旧Owner／start経路失効、元CLIと既受理Daemon要求の終端、exact再起動の完全成功、現在Root・元版・Host／Home／Runtime排他、およびDIの二系統不存在観測である。再起動blocked＋最終not_issuedは限定終了のfenceにしない。既存absenceへ過去unknownを保持した専用候補／Writerを接続する案を検討するが、通常cleanupを緩めず、全終端・履歴・配送・次受付の共同判定と実生成点の反証が揃うまで本番許可しない。新しいStore・Registry・Lock・汎用Recoveryは追加しない。現在は契約／品質の着手前照合中で、実装済みとはしない。

実境界の現在結果と是正方針: 同じIDの正式Writerで再起動未発行の準備保存・読戻し・排他解放を確認後、承認済みの正式再起動入口を一回実行した。結果は`docker_restart_stop_unconfirmed / request=not_issued / cleanupConfirmed=true`、耐久checkpointは`unknown / confirmed / blocked`である。NativeのCLI観測は一度verifiedとなり、後の同時点観測はabsent・Windows三固定CLI一覧空・absentだった。短命CLIの自己干渉は原因候補であり、通常Desktop Processの誤分類や旧binary混入の根拠はない。Rust fmt、Clippy、release Buildと配布Hash一致、46通常試験成功・23明示ignored、CLI7成功を確認した（Build cacheのhardlink警告は別途発生）。追加再起動は行わない。

同じ既存current Consumer入口を一回使い、実ID発見・identified耐久保存・exact Container回収・Host清掃を確認した。二回不存在、非対象操作全文・既存Docker資源集合・再起動checkpoint不変、全排他解放は成功。返却は予測どおり`docker_task_recovery_terminal_unconfirmed`で、履歴未確定・操作保持のままである。これは実資源の回収成立であってTask終了や再起動成功ではない。旧resultが最終requestとEffect不明を捨てるため、要求前拒否でも終端Writer／履歴Readerが永久拒否する欠落を特定した。

統合した最小是正は、既存checkpoint.resultへDI最終`request / effectOutcomeUnknown`を必須保存し、上位unknownを保持したまま、blocked・最終not_issued・Effect不明false・回収confirmedだけを終了可能にすること。既存finalize・closed Owner・全排他解放・CASと結果全文first-winsを維持し、終端Writer／履歴Readerを同じ純粋判定へ接続した。初期Host判定にも同じ終了条件を接続し、再起動欄だけを保持して他のTask初期条件を全文固定する。実相関・codec合法性を確認した正負例、Effect不明guard／全文比較省略変異、48旧組合せ・128新交差例、hostile／旧形式拒否と結果全field不変を確認した。関連54/54（1307.8416ms）、実finalize→実Writer→Host清掃→履歴／対象除去1/1（30824.8328ms）、修正版state_savedのfresh回復1/1（39204.3951ms）、Source／全試験strict・対象整形／Lint成功。契約／品質の限定独立再確認は全重大度残指摘0。既存保存・pending再入場の広いHost回帰1/1（143614.052ms）と台帳25/25（13041.0706ms）も成功したが、全影響回帰とPackage全体完成は未完了。旧resultは新decoderで拒否し推測補完しない。専用Rootは人間承認後、Process参照なし・試験Container不存在・既存排他5取得解放・54項目の二重走査を確認し、exact Rootだけを削除して不存在を確認した。新Framework・互換Reader・再起動追加は行っていない。

停止診断の是正結果: 親catchへ固定失敗分類・既知code・自fileの実frame行番号・要求件数と再起動結果分類だけを追加し、例外本文／stack／Path／actual／expectedは出力しない。診断失敗はunknown/null、処置条件と正常reportは不変更。Error本文の自URLをframeと誤認するMinorを是正し、71単独故障・12変異、通常相関／profileを含む8/8（621.4664ms）、Source／tests strict・整形／Lint・差分検査が成功した。固定候補の契約／品質独立再確認は全重大度残指摘0。保持中Rootで引数なし拒否がmanifestを変えないことも確認した。同じRootの読取り限定診断では、module差替え前後Reader、再起動準備／即時許可再確認、初回checkpointモデル候補が成功。上位入口から下位への委譲直前で意図的に停止し、委譲到達一回・排他解放成功を確認した。実Docker実装・保存・再起動はこの診断では呼んでいない。元の実証停止原因は未確定で、再実行許可や実回収成功には読み替えない。

限定実証の現在結果: 手動親は`stage=restart`でblocked、自己生成Container `f78e488d251fa70e25c5d06cf4ec8b11f40911ed0a019af2ca0d24771b975fd3`とexact Rootを保持した。対象回復IDは`docker-task.6af05fab2d2d29afe7e2f8ba76aae8c4c52f6b56e2a9c2bdd945334e214541df.b175fc9c5c62a6b42bc930854b54d426253a908d088a105fc4e5f951137d55ff.23f8677c694da83b167145b6ac9f0f1f7db99a076fdf479addce69604b3b86ac`、再起動checkpointはnullのまま。Containerはcreated・構成照合true、既存停止済みContainerは維持した。自動再試行・削除・新規試験作成は行わない。診断の`--input-type=module`がWorkerへ継承された場合のLock取得拒否は元障害と分離し、同optionなしの正式Reader、同IDの再起動準備と取得排他の即時解放は成功した。実証停止原因はまだ未確定。親catchが詳細を捨てているため、機密を含めない失敗分類・発生箇所・要求件数の診断を先に補い、同じ対象を調査する。実証成功・実回収・Package完成は未成立。

親統括の模擬反証Gateは是正後の契約・品質独立再確認で残指摘0となった。試験Headerだけを最終同期し、処理・assertion不変更、整形／Lint・差分検査も成功した。台帳25/25（13547.8646ms）成功。これは実境界の証明ではない。承認済みの一回のDocker Desktop再起動を含む専用実証へ移る前に、Engine29.8.1応答・稼働中0・既存停止済み1件・専用Root不存在を再観測した。以下の独立再確認中／実操作不可はこの最終確認前の経過である。

親統括の本文反証（2026-10-16、是正後の固定候補を独立再確認中）: 新しい製品hookやFrameworkを作らず、既存親の四関数を一意に抽出し、型消去・固定meta URL・閉じたdynamic import解決だけを変換して、scenarioごとに新品の同realm閉包で評価した。Nodeの実module cache、Process、Filesystem、Dockerへは接続しない。named spawn bindingは差替えと復元を実際に切り替え、登録表・Listener終了を毎回確認する。初回独立確認のModerate4・Minor1を統合し、Git二要求、Root／能力二値、Domain引数、空configとCLI信頼Snapshotを閉集合化した。正常一形、66単独故障、接続・境界・四地点のbaseline比較・二manifest比較を含む12変異を確認し、通常相関・profileを含む8/8（579.8323ms）が成功した。観測成功の固定field差、両走査成功後の本文差、再起動四field・回収五fieldの単独不成立、rm直前Reader拒否二例、正常／拒否報告の全文を確認する。各故障は到達一回、段階、既発生件数、後続0、ID確定前null／確定後同ID、清掃不明時の非成功を個別期待値で照合する。現在のcodec・Writer・Kernel・Nativeの実保証はこの合成境界から推定しない。Source／全試験strict、対象整形／Lint・差分空白検査成功、実Docker操作0。是正後の独立確認が残り、実操作不可を維持する。

親候補レビューの是正（2026-10-16、全統括未検証）: 回収メソッド入場を実削除件数としないよう、同じ固定Docker Process要求をpass-through観測し、削除直前のdurable identified確認、exact IDのrm要求と成功返却を別々に数える候補へ修正した。最終Root清掃を通常try内の明示段階へ移し、未知top-level・reparse・未知種別・走査上限を拒否する二回の実体／本文manifestと、元Rootの再照合後だけ処置する。部分削除時にRoot保持を断定せず、検証とRoot清掃の確認を分離する。成功表示はRoot不存在後だけとし、既存永続データの非削除へ説明を限定した。Symbolの直接検証先は新fixtureへ修正した。値相関・入口・profileの通常5/5（327.3145ms）が成功。新しい清掃前実体Caseは制限環境でjunction作成EPERMとなり、同Caseだけ用途限定の制限外確認で1/1成功（216.2314ms）した。Windows Host profileへ一件追加し総97件・15Fileへ同期した。是正部分の契約／品質限定再確認は残指摘0。台帳25/25（19586.624ms）と対象静的三軸も成功した。自己生成試験Root残存0、実証Root未作成。全統括の模擬反証は既知ModerateとしてOPENであり、実Docker／再起動は未実施、実操作不可を維持する。

実証親の候補実装（2026-10-16、実操作不可）: `tests/fixtures/docker-auth-create-closure-verifier.ts`に明示手動入口を追加した。通常runnerから選択せず、明示引数・module mock起動option・Windows・新品exact Rootを要求する。固定CLI／空config、全資源集合と既存Containerの非秘密投影、既存切断子、現在Reader、既存再起動一回、同じ本番DI executorの発見と削除直前identified保存の読戻し、二回の不存在と自己生成Root回収を候補接続した。packet欠測・子終端不明・相関不一致は同Rootと証明できる参照だけを保持し、再起動／削除へ進まない。親値相関の正常・反例と引数なし実入口拒否は3/3成功（227.4128ms）だが、全統括の模擬反証・独立レビューは未完了。これを実Docker実施の許可Gateへ使用しない。新Store／Lock／sidecar、本番Source・期限変更、実Docker／再起動操作は追加していない。

通常例外確認の限定結果（2026-10-16）: 五故障5/5（77605.7013ms）、Host実Process終了後のfresh回復1/1（58157.9404ms）、Host profile契約2/2（134.3794ms）、台帳25/25（12175.0109ms）が成功し、失敗／取消／skip0。Source／全試験strict・対象整形／Lintと差分空白検査は成功。独立確認の二指摘は、Host選択契約を3接頭辞・展開10件・総96件と新5値loopの全数確認へ同期し、説明を実Writer返却後・結果検査前のfixture例外へ限定して是正した。契約／品質の六Path限定再レビューは全重大度残指摘0・Pass、CQ-AUTH-Q01は解消。worker SHA256 `a7f6dfd8c80dd827fe11bf24e0ab1af9948eb0414235ec309f4e222fd2b6c11c`、親試験 `60d8fdc16e3846ab95a04d0e51047f13d9aef6d6658f92d103f45cf226c31908`、profile契約 `ee1107140af277f7d177ab3c1aed78e6dbb8a1ab8792f72e62c65f9f7a7f641e`。実Docker操作・再起動は0で、親統括のpacket欠測時の保持／再発見・削除前保存・回収確認はOPENのまま。次はその親統括を完成させてから承認済み限定実証へ進む。全体完成とCommit／Pushは未実施。

認証作成切断子の通常例外確認（着手前照合）: 親統括の実操作前に、既存fixtureと既存Host試験で五故障を確認する。image確認、create後inspect、unknown保存前、実Writer返却後かつ結果検査前のfixture例外、packet直前を独立刺激とし、前半三形はintent_saved、後半二形はunknownの全文を実modelから導出する。Docker境界の代役、Store呼出し前後のfixture故障、packet前故障を区別し、Writer内部の応答喪失を実測したとは主張しない。真正Capabilityのabandon一回、実Home排他の再取得・解放、Host世代解放、一次例外保持、同exact ID・非対象全文・Host実体保持を要求する。fakeは専用実証Rootを拒否し、Docker実行adapterの閉じた代役だけを使う。新Store／Lock／sidecarと本番Source変更は行わない。契約／品質の読取り専用着手前確認を統合済み。静的三軸→局所実Process試験→固定候補の契約／品質独立レビューを実施し、標準規範不変更のため準拠監査は非該当。実Container回収・親統括・再起動・Package完成は未成立であり、実Docker操作は引き続き行わない。追加の人間判断は不要。

残件の依存順（2026-10-16）: 現在公開回復の拒否確認は成立したが、旧`recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver`は記録後再起動／Desktop修復後の旧入口からまだ到達する。したがって旧四Gateは、現在の四反例と一対一で置換済みとはせず、当該旧入口の撤去まで保持する。次は承認済みauth-create限定実証の準備・実施と現在方式への終了接続を優先し、その後に旧再起動／修復経路・journalと対応試験を一体撤去する。既定OS一時領域の共通作成入口もTask／Workbench／doctorの一体切替へ含める。新しい一般回復・共有管理・Lockは作らず、旧形式互換を維持する目的で残さない。試験の移管件数だけを完成進捗へ読み替えない。

現在公開回復の四拒否結果（2026-10-16、限定完了）: Source／全試験strict・整形／Lint成功後、既存producerから四拒否と最後の正常fresh回復へ結合した1/1（73989.7168ms）、台帳25/25（14098.8734ms）が成功し、失敗／取消／skip0。fixture SHA256 `46c02a7e5dbfa30e01bdc0aa474c77f441b8347190beefb0cae6c38fb32ddb0d`、親試験 `a4d21a4fe311e3b1b20a73767a462106fc444b75d22d3fdf5be5033b46365886`の固定候補に対する契約／品質の独立確認は全重大度残指摘0・限定Pass。実Reader・公開入口を通した拒否前後の本文／実体保全と保存・Host処置0、正常時の実Writer／Host処置到達を分離した。自己生成`abandon-owner-*`残存0、差分空白検査成功。旧四Gateを意味単位で置換済みとする判断は未実施であり、default TEMP経路・旧Suite全体・実Docker・Package完成の成立には流用しない。以下の検証中は着手時点の経過である。

現在公開回復の入場拒否（2026-10-16、検証中）: 旧journalのpartial bootstrap／no-intent duplicate／premature pointer／解放後pointer再出現の四Gateは、旧形式固有の刺激を現在方式へ復活させない。まず現在の`recoverRuntimeOwnedDockerTaskForCurrentConsumer`で、本文不正、codec合法だがprevious Hashが現在元版と一致しないpending、未知entry、top-level binding項目破損の四拒否を確認する。第四形は正規foreign Repositoryの受理検証ではなく、binding項目破損の拒否に限定する。既存producer→fresh回復子の固定test-only argvへ結合し、実Readerは維持、保存・出版の明示入口とHost回収だけをpass-through spyにする。安全なRepository借用を処置に数えない。各注入直後の領域名閉集合・全File実体／本文、対象と非対象のHost Root／markerを基準に、拒否直後・fixture復元前の不変、blocked完全tuple・same exact ID、保存／Host回収0とProcess allowlistを要求する。復元後baseline再一致を確認できた場合だけ同じ子で正常回復へ進み、実Writer／Host回収の正到達でspy未結合を排除する。旧四Gateはまだ削除せず、この正負結果と独立確認後に意味対応を判断する。既定OS一時領域の共通作成入口はTask／Workbench／doctorへ接続しているため、一呼出しだけの部分変更は行わず利用側一体切替の残件とする。Source／期限・実Docker操作・新Frameworkは追加しない。

旧Host初期化試験の責務移管（2026-10-16、限定完了）: 旧`docker-recovery-runtime.contract.test.ts`から次の六Caseを既存`host-recovery-record.contract.test.ts`へ同名（`Host Windows:`接頭辞だけ追加）で移した。実装・回復条件は変更しない。

| 旧Caseの識別内容 | 移管先で保持する刺激・判定 |
| --- | --- |
| Operation Directory生成primitive | Effect前・rollback確認済み・共有保存場所不正のopaque分類 |
| 初期化中のProcess消失 | Root生成前／生成後の同期切断、子PID・終端・到達packet、marker/token、生成後Root実体保全 |
| 同期I/O不明 | initial marker／Root／host_only短命物のIdentity不明とexact ID取得可否 |
| rename後観測失敗 | 実在するsuccessor本文HashとIDの対応 |
| 同一bytesの別Identity | 本文一致だけでIDを返さない |
| outer rollbackのcached ID | 削除後例外／実体差替え／観測不能でcached IDを返さない |

自己生成親は既存Repository-local tests resolverへ固定し、子にも明示argvで渡す。直接fixture清掃は製品回復成功と区別する。旧「production TEMPのnonnull失敗ID」は非Windows本番Callerの無引数呼出しとdefault `os.tmpdir()`が残るため未置換として旧Suiteへ保持する。既定親を明示親へ切替える別Source単位で再評価し、明示親試験だけで同等移行とはしない。Header／SymbolのPRL-IT-013接続、Catalog分類、Host閉集合4→10・全体85→91を同期した。Source／全試験strict・対象整形／Lint成功後、移管先とprofileの12件は11成功・既存リンク試験1件がEPERMで失敗した。同じ固定候補の該当一件だけを権限制限外で再実行し1/1成功（49.0452ms）を得た。台帳25/25（16965.5934ms）、自己生成Host初期化fixture残存0、差分空白検査成功。File HeaderがReader専用だったMinor一件を文言だけで是正し、最終Host試験SHA256 `81e7a4e52f756fc28ea9de991970e1f537fadf705bfa5388641c5eea4c2ca5e9`に対する契約／品質の限定再確認は全重大度残指摘0。旧Suite全体は未実行で、全面Passへ読み替えない。Source撤去・限定auth-create実証と全体完成は引き続き残る。

Host清掃の論理故障B（2026-10-16、限定確認完了）: 固定候補の品質指摘一件は、現在本文と私有beforeをcleanup一値へ縮約していた試験Oracleの不足だった。本番Sourceは変更せず、両Bufferのコピーを、故障段階から実modelで独立再導出した期待全文・revision・previous・payloadSha256へ照合する。版競合では追加一版を保持し、同cleanupの追加版とcodec合法な元版Hash差を同じOracleが拒否する。修正版のSource／全試験strict・対象整形／Lint成功後、実Process列と結合したstate_saved1/1（95859.586ms、失敗／取消／skip0）、台帳25/25（18564.5261ms）が成功した。自己生成`abandon-owner-*`Root残存0・差分空白検査成功。親試験SHA256 `d165840929195ef44f4aa2fcef1dd2c0373430beb55fd6ae08f5255cf56d7c7d`。契約／品質の独立再確認は残指摘0で、正常二形・故障24形の論理Source境界に限定したPassである。実Writer内部・Kernel／Filesystem故障、実Docker、旧92Caseの移行・旧処理撤去と全体完成は証明しない。以下のB検証中／未着手は先行時点の経過であり、現在の残件ではない。

Host清掃の論理故障B（2026-10-16、検証中）: 契約／品質の具体化照合を統合し、既存state_savedの実初期Snapshotをcodec確認後、同一realmの私有WeakMapへ一Ownerを登録して、本番五関数を一意抽出した。正常not_requested／pendingの二対照と、削除直前のRoot／Lock／世代失効・元版差、pending Writer処置前拒否／例外・commit後確認／解放不明、読戻し差／例外、清掃blocked／throw／観測unknown、清掃後失効、confirmed Writer処置前拒否／例外・commit後確認／解放不明・読戻し差／例外／Hash差の計26形を分離する。現在本文は実model候補を反映してから故障を注入し、私有Ownerの確認済みbeforeと同一視しない。実Reader成功後の削除直前Owner guard一箇所だけを省略した変異をHost要求0の同じOracleで拒否する。故障一回・前段到達、非対象全文、段階別Host／Writer要求・反映、実際にsticky flagが立つ形だけの反復停止を要求する。清掃後Root失効のように現Sourceがstickyを保証しない形へ永久停止を捏造しない。実Sourceと実modelの論理反応だけが対象で、Reader／Writer内部・実Kernel／Filesystemの故障成立を主張しない。Source／期限・新Store／Lock・実Dockerは不変更。strict注釈を補正し静的三軸成功後、実Process列と結合して実行中である。

実ProcessのHost清掃Writer拒否（2026-10-16、A限定完了）: Source／全試験strict・整形／Lint後、合意した五子列を含むstate_saved1/1（68260.8302ms）、台帳25/25（13439.8285ms）、失敗／取消／skip0が成功した。fixture SHA256 `8c6e29d20bc55461ac08fedc2e646c54976a92b6f0411a422b36e77d2fea2ee2`、親試験 `8d41bb6f5a435e1cf143e7acfb2c59080a20a5e74269c5d537673545277a785a`。Source `a35866108e48fd4d26e9f08c288b45e9257eb2ab60a98d1d20d7bed83954d32f`は不変更。checkpoint要求3／2／1／0と実呼出2／2／1／0、Host処置0／0／1／0、final Writer要求0／0／0／1・本体0を各段で観測し、対象本文残存・同exact ID・非対象全文／実体保全と後段fresh完了へ結合した。契約／品質の固定候補独立レビューはAだけ全重大度残指摘0・Pass。全試験子終端、自己生成Root残存0、差分空白検査成功。Bの同呼出し清掃後保存故障、Root／Owner・Lock失効、読戻し／解放不明、清掃blocked／throwは未着手の論理故障Gateとして残り、実Kernel／Filesystem故障注入の成立を主張しない。旧Suite移行、Source撤去、実Docker・全体回帰／Reality Audit・Package完成も未成立を維持する。以下の着手はA完了前の経過である。

Host清掃の保存拒否と論理故障確認（2026-10-16、着手）: 契約／品質の着手前照合を統合し、実Processの同ID列を「pending Writer拒否→pending保存後切断→実Host回収後切断→既にabsentからfresh confirmed Writer拒否→最後の正常fresh完了」に拡張する。拒否は固定test-only argvで対象Writer入口へ限定し、実Writer本体を呼ばず固定blockedを返す。清掃前拒否はHost処置0・実体保持、清掃済みfresh拒否はHost再処置0・本文／版／両不存在不変を要求する。後者を同じ呼出し内の清掃後保存故障の証明とはせず、その保証、Root／Lock失効・読戻し／解放不明・清掃故障は実Sourceと実modelのメモリ境界試験で別に確認する。実Kernel／Filesystem故障注入の成立とは表示しない。Source／期限・新Store／Lock・実Dockerは不変更。公開operationRetained=nullを保持成功へ読替えず、親がexact対象の実state残存と非対象保全を観測する。既発生Effectと未発行を分け、保存後不明では旧版不変を一律要求しない。現在は実子側の二拒否から実装し、残る論理故障Gateは未完了を維持する。

清掃二切断の限定結果（2026-10-16）: 静的三軸後の修正版state_saved1/1（46919.8815ms）、元Root／markerのdev・ino・birthtime観測補強後も1/1（46439.8126ms）が成功した。台帳25/25（11202.6467ms）、差分空白検査成功。fixture SHA256 `76bdbb0b638c0697bbae719c100de51045d5e27437cf031ec8372b7ed977581d`、親試験 `f1d3a3e041d8d3eae794a089bad937f377c5fb719dd725bcbbfb6aba1c1ae15d`、製品Source `a35866108e48fd4d26e9f08c288b45e9257eb2ab60a98d1d20d7bed83954d32f`不変。契約／品質の固定候補レビューは二切断の限定範囲で全重大度残指摘0・Pass。pending実保存後→次Processで実清掃後・confirmed保存前→最後のfresh完了を同exact IDで結合し、途中はTask完成にしない。先行失敗Root hZX80Eは既に対象終了済み、fBuOMYは同exactの本番回復で全確認true・Process要求calls[]を得た。両方とも自己生成53項目・非link・対象履歴一回・他の未要求試験操作だけを確認した後、試験物の物理回収と不存在確認を別に行い、`abandon-owner-*`残存0。実行別Evidence書庫は作らない。Writer false／throw／読戻し・解放不明、Owner／Root失効、清掃blocked／throwのGateは未完了。旧92Caseの残余移行・旧Source／署名／配布graph撤去・実Docker・全体回帰／Reality AuditとPackage完成は未成立を維持する。以下の再実行中／保持は当時の経過である。

清掃二切断の試験期待補正（2026-10-16）: 初回は実Storeの循環依存による先読込みでhook未結合となり、子の通常終了を終端Oracleが拒否した。同じSourceのquery namespaceをhook登録後に読み込む既存fixture方式へ修正した。次はpending_savedへ到達したが、固定二改訂の期待と実三改訂が相違した。全未要求でも既存resource-cleanup checkpointが同値操作を一度保存するためであり、契約／品質の再照合後に、lifecycle→resource-cleanup→Host pendingを実modelで再導出する期待へ訂正した。次子もpending版から同値resource-cleanup候補を一度導出し、操作・参照・配送の全文不変とSnapshot改訂／元版Hashの既存一保存を分離する。以下の「二改訂」「二子のstate bytes不変」は撤回した事前仮説であり、現在のOracleではない。Source／期限／切断位置は不変更。先行失敗Rootは保持し、成功へ読み替えない。修正版静的三軸成功後に再実行中である。

清掃pending二切断の実接続（2026-10-16、着手）: 契約／品質の事前照合を統合し、既存state_saved試験の同exact IDで、実pending Writerの三確認後と、実Host回収後・confirmed Writer呼出前へ二つの強制終了子を順次接続する。親は実子pidと終端、同期packet・一回到達、finally未実行、Home排他再取得、短命物／履歴不存在、modelで再導出した二改訂後のpending全文とprevious Hash、各時点の非対象本文／Host実体を確認する。初回はRoot／marker存在、二回目は同じ両実体の不存在を要求し、状態全文は変わらない。最終fresh子だけが確定保存・履歴一回・対象除去へ進む。固定argv4二値以外は拒否し、正常recovery・元abandon・host_started、Source／model／Host／Kernel／期限、実Dockerは不変更。今回閉じるのは二切断で、Writer／Owner・Root失効／清掃故障の反証は別の未完了Gateとして維持する。静的三軸→局所実Host→台帳・独立契約／品質確認の順で固定し、全体完成へ流用しない。

同じ最終候補の既存abandon経路も1/1（55848.9963ms）、失敗／取消／skip0で再成功した。Source Hash不変、`abandon-owner-*`残存0、差分空白検査成功。次は下記未完了のpending／故障再入場を確認する。

実Process二境界の限定結果（2026-10-16）: 修正版は静的三軸成功後、保存直後／Host開始後2/2（88796.6461ms）、資源回収・状態model・実行profile32/32（1394.6352ms）が成功した。独立確認のpure反証不足を統合是正し、五用途×五要求状態（issued含む）、実行評価四項目、同Identityの正規successor tokenの計30例で実codec成功を先に確認した。全文比較だけを省略した一意なメモリ変異を、同じ入力・同じ拒否Oracleが全件検出する。workspaceReusable=true等のcodec不合法群とは区別した。是正後strict／整形／Lint、保存直後1/1（39922.4566ms）、台帳25/25（11530.1369ms）が成功し、契約／品質の再レビューは純粋反証・実Process二境界に限定して全重大度残指摘0。Source SHA256 `a35866108e48fd4d26e9f08c288b45e9257eb2ab60a98d1d20d7bed83954d32f`、子fixture `8c82467b0c8c3977fcfe4b76e6bcb6d194d5fd8fe99257826e336518b8ec41f4`、親試験 `fd569388c6fa2fc4779a2ef3cd760a476a2e8e84edfb8672a2207598242d1fd5`。先行失敗Root nynAyyとpure fixture失敗Root qAgrkpは、同exactの本番回復で全確認true・Process要求calls[]を得た後、自己生成物・非link・対象履歴一回を確認して物理回収し、現在不存在を確認した。実二Caseの成功と後片付けを別の事実として扱い、実行別Evidence書庫は追加しない。清掃pending／物理清掃後切断、Writer・Owner／Root・清掃故障の実接続Gateは未完了で、例外経路全体・旧Suite撤去・Package完成のPassではない。以下の検証中・保持は是正前の経過である。

初期保存直後の回復停止の再現と最小是正（2026-10-16、検証中）: 静的三軸成功後の実子Process強制終了二Caseは、保存直後が`docker_task_recovery_host_absence_unconfirmed`で失敗（16695.4315ms）、Host開始後は成功（48784.1604ms）。初期Hostをstarted限定の不存在遷移へ渡していたことを特定した。失敗Root `.crdd/tests/abandon-owner-nynAyy`は保持する。契約・品質の着手前照合を統合し、既存modelから初期操作を再導出、実退役のsettling／disabledと清掃not_requested／pending以外の差、および対象未解決・配送を拒否する私有判定を二Callerで共有した。確認は遷移不要を返すだけ、清掃は既存Host回収を使う。通常started遷移、model／Host下位、Kernel／期限は不変更。修正版静的三軸は成功し実二Caseを再実行中。pending切断、保存／失効反証、独立確認は未完了で、先行失敗を成功根拠へ読み替えない。

実Process消失二境界の移行（2026-10-16、着手）: 旧92Caseのうち保存直後・Host開始後のProcess消失を、既存実Owner／fresh回復試験へ追加する。契約・品質の事前照合を統合し、対象exact IDの保存確定・読戻し・Writer解放後かつHost要求前と、本番begin ready直後を分離する。同期相関通知後に自己Processを強制終了し、親の終端確認・finally未実行・実Host状態・Home排他再取得・短命物不存在を別々に観測する。同じIDの別Process回復後に対象除去・兄弟Host実体と本文保全・履歴一回を要求する。既存abandon反例は維持し、Source・Kernel・期限・新Store／Lock・実Dockerは変更しない。初期Host状態で回復できない可能性は未確認の仮説として保持し、再現した場合は根拠を保存して最小是正を別途照合する。旧Suite全削除やPackage完成の根拠にはしない。必須確認は静的三軸、局所Host試験、契約／品質の独立確認と直接QA／台帳整合。規範不変更で準拠監査は追加せず、実Docker試験は承認済み別Gateを保持する。

現在入場の限定完了（2026-10-16）: 修正版は契約・品質の両再レビューで全重大度残指摘0・限定Pass。修正後の台帳25/25（13824.3117ms）、失敗／取消／skip0を確認した。実Repositoryを通常のNode入口から観測してavailable・lockReleased=true、Coordinator領域を作成しないことも確認した。親の診断用`--input-type=module`起動はWorkerへ同引数が継承され`ERR_INPUT_TYPE_NOT_ALLOWED`となることを固定Workerで確認したため、その起動方法のblockedを製品の排他不具合や権限競合へ分類しない。通常入口では成功しており、Sourceの期限やKernel処理は変更しない。以下の独立確認前／再確認中は当時の経過とする。旧92Caseの保証移行、旧回復／再起動分岐、保持物、限定unknown終了、配布graph・全体回帰／Reality Audit／実境界とPackage完成は未完了で、完了後だけCommit／Pushする。

現在入場の独立指摘是正（2026-10-16、再確認中）: 契約・品質の指摘四原因を統合した。CLI診断は一度捕捉したRootを一般診断と入場観測へ渡し、Resolverが二度目に別Rootを返す反例、二重解決・診断Root差替え変異、解決throw時の両処置0を実組立て本文の同じOracleで確認した。初回不存在の途中でだけ排他を失効させ、完全blocked DTO・到達一回・解放一回・領域不存在を確認し、最終生存条件だけを省略したメモリ変異を実Inspector本文と同じ完全DTO Oracleで拒否した。release false／throwの完全相関、既存三SourceへのSuite Symbol登録、旧在庫DTO負例の意味表示も是正した。Reader・Kernel・期限・旧投影のSourceは変更していない。Source／全試験strict・整形／Lint成功後、修正版入場3/3（2399.2194ms）、Task DTO／terminal Trace54/54（718.0222ms）、失敗／取消／skip0。先行176件・実Host等は先行候補の結果と区別し、CLI改修後の局所根拠だけを追記する。台帳検査と両独立再確認を終えるまで限定Passとしない。

現在入場の接続結果（2026-10-16、独立確認前）: Source／全試験strict・対象整形／Lint成功後、Task・現在入場・Windows adapterの関連176/176（2973.3683ms）、現在回収・状態モデル・旧投影の非回帰35/35（1400.5107ms）、入場可と同Home拒否を結合した実Host1/1（67589.8811ms）が成功した。先行175件中のjunction権限拒否は同一Caseで確認後、同じ候補を通常権限で176件全再実行した。Task Process結合のfixtureは既定OS tmp参照で準備失敗したため、契約・品質の事前照合後に三呼出しだけ既存Repository-local tests領域へ変更した。変更後は通常6/6（1571.2634ms）、Windows実Process制御2/2（1379.9466ms）、失敗／取消／skip0。実Process profileのsandbox実行は取消観測が期限切れとなり、通常権限で同じ二Caseを成功した事実と分けて保持する。取消実装・期限の延長は行わない。現在入場と放棄Ownerの自己生成Rootは残存0。旧Task回復分岐内の旧inspect呼出しは残り、旧Sourceを全撤去済みとは扱わない。独立レビューと台帳・直接伝播確認、旧経路の残余移行は未完了。

現在状態による入場観測への切替（2026-10-16、着手）: 変更分類は、採用済みRepository-local現在状態への本番依存切替と旧全域拒否の撤去である。契約・品質の着手前確認を統合した。Task通常／開発・CLI診断が同じ検査対象Rootを運び、既存Reader・Kernel排他で安定currentを読めた場合だけ入場可能とする。未解決・配送・修復を含む安定本文を全域拒否せず、同Home／未終端修復等の衝突は既存begin・Writer・modelが実操作文脈で判定する。初回は同排他下の二回の明示不存在、Rootと排他の生存、解放確認を共同条件とし、既存空領域・partial・pending・未知物・解放不明は拒否する。通常Readerの不在拒否は変更しない。結果は有限理由・入場可否・排他解放だけで、Snapshot・内部ID・実行Authorityを搬送しない。旧global inventoryによる`CASE-RECOVERY-ADMISSION`は廃止し、観測不能の`CASE-OPERATOR-TRANSFER-ADMISSION`と他段階の回復遷移は維持する。Orchestrator正本のcontainer_host境界・保証集合は変更せず、未使用なWindows adapterの旧観測候補と根拠のない部分保証だけ撤去する。Source／型／整形／Lint後の局所回帰と契約・品質の独立レビュー、直接文書・QA・Registry伝播を実施する。規範・準拠基準・公開権限の変更でないため全工程監査・準拠監査は追加しない。旧92Caseの保証対応、実中断・Host先行欠測・限定unknown終了と実Dockerは別の未完了範囲であり、この切替で旧Suite全撤去やPackage完成を主張しない。

開始拒否移行の限定判定（2026-10-16）: 下記の是正後固定候補は契約・品質の両独立再確認で全重大度残指摘0・限定Pass。台帳検査25/25（11090.4187ms）、Exit0・失敗／取消／skip0も終端確認した。自己生成二領域の承認済み削除と今回の試験Root清掃を完了し、`abandon-owner-*`残存0、一時型検査設定も回収した。以下の「独立確認中」「再確認中」はこの判定前の経過であり、全試験strictの現在値は成功・旧型エラー0。ただし子fixtureの旧API経路は残存し、旧Runtime Suite全体・実Docker・限定unknown終了・全体回帰とPackage完成は引き続き未成立である。

開始拒否の独立確認是正（2026-10-16、再確認中）: 契約側の全短命物保全不足と品質側のRoot失効に対する同Home競合の代替拒否、計二件を是正した。Coordinator直下の全名前集合・種別・dev／ino／birthtimeNs・本文を注入後と拒否直後、資格負例後・手動復元前に比較する。履歴／Lock／未知File追加、本文変更、同本文の別実体への置換を同じOracleで拒否し、元実体・本文への復元を確認する。Root失効だけ全既存操作と異なる専用Homeへ切替え、実Home取得hook一回、実ReaderのRoot拒否・値なし、Writer／Host開始0、全領域不変と専用Home再取得を確認する。正常beginは失効前の肯定対照とし、HEAD復元後は旧CapabilityでRepository操作を再開せず世代解放とProcess終了だけを行う。Source／全試験strict・整形・Lint成功後の修正版Host1/1（58447.1883ms）、Exit0・失敗／取消／skip0、自己生成試験Root残存0。先行pure選択5/5（566.3567ms）も成功したが、旧Runtime Suite全体の移行完了とはしない。製品Source・旧Recovery三Case・kill fixtureは変更せず、旧経路撤去・限定unknown終了・実Docker・全体回帰／Reality AuditとPackage完成は残る。

旧開始APIの直接Caller移行候補（2026-10-16、独立確認中）: 旧五Callerの意味を現行begin拒否へ対応した。既存abandon producerへ不正current／pending／未知entry、Reader後の有効な同Home未終端状態追加、abandon後の耐久同Home残件、Home取得後Root失効の六反例を接続した。Home・Reader／Writer・Hostは実物、固定タイミングだけ試験wrapperで注入し、各到達・拒否・既存本文／Host保全・Host開始0・実行Authority非発行・実Home再取得を確認する。Reader後競合の実Writer注入を二重Leaseの証拠とはせず、Root失効の復元後に旧Capabilityで新Taskを再開しない。静的三軸後の修正版Host1/1（62589.9048ms）、Exit0・失敗／取消／skip0。開始専用二Caseを撤去し、混合三Caseは開始刺激と専用第二Hostだけを除いてRecovery限定へ改名した。三CaseのRecovery実行本文・入力fixture・既存保全Oracleは変更前後一致を確認した。親の直接Callerが0となった不存在exportのnamed importと未使用helper／importを除去し、全試験strictは成功（旧一件から0）、旧Fileの整形／Lintも成功した。子fixtureは別namespaceで旧開始APIを呼ぶ文字列本文が残るため、実行経路全体の移行完了ではない。旧Recovery／kill fixture、旧Source・配布graph、限定unknown終了、実Docker・全体回帰／Reality Audit・Package完成は残す。Production Source、旧API復活、新Store／Lock／Framework、実Docker／Provider要求は追加していない。

旧normal／直列Home／abandon三試験の撤去候補（2026-10-16、限定完了）: 契約・品質の全保証対応で不足した正常解放の相関を、実Owner Caseへ補強した。complete前の元tuple false、complete後の真正別Owner／別operation ID／別recovery ID各一軸false・state bytes不変・元tuple true継続、逆順finalize後の元tuple trueを確認する。追加時の型注釈不足を是正し、静的失敗後に誤って開始した先行実行は根拠から除外した。改めてstrict・整形・Lint成功後の固定候補で正常1／2回Host2/2（98012.3992ms）、portable4/4（650.7478ms）、Exit0・失敗／取消／skip0。新abandonの修正版Host1/1と共同で旧三試験の意図を引き継ぎ、三Caseと実使用のないimport十件だけを撤去した。旧Fileの整形・Lintは成功、全試験strictは旧開始APIのexport欠落一件（先行九件から減少）で未合格。旧APIは他Callerが残るため復活も未使用扱いの削除も行わず、次の移行対象とする。撤去後の契約・品質独立確認は文書の時点表示を是正して全重大度残指摘0・限定Pass。Source strictも成功したが、旧export欠落一件・旧Source撤去・実Docker・unknown終了と全体完成は未成立である。

放棄Ownerの別Process回復（2026-10-16、限定成立）: 実begin／abandon／世代解放をproducer子Processへ閉じ、終了後に別子Processが真正Rootと同じexact IDで本番`recoverRuntimeOwnedDockerTaskForCurrentConsumer`を呼ぶ固定試験を追加した。Home観測だけを模擬し、実Home排他・Writer・Host回収・履歴・transient終了と非対象全文保全を確認する。Process発行監視は同期／非同期七入口の不許可要求を反例で拒否した後、実回復中の違反をsticky観測する。Native起動は必須ではなく、発生した許可要求だけを集計する。初版のnonce参照誤りとNative起動必須という試験側の誤った仮定、独立確認の非対象物理Host保全不足Moderate一件を是正した。兄弟Root／markerのbigint dev／ino／birthtimeNsとmarker bytesを前後照合し、各一回の一時欠測を同じOracleで拒否、finally復元後の実体／本文再一致を確認する。静的三軸と修正版Host1/1（77588.1628ms）、Profile2/2（149.1085ms）、台帳25/25（10730.541ms）が成功、Exit0・失敗／取消／skip0。契約・品質の是正後差分は残指摘0で、修正版Host終端も成功した。現在のHost分類は14File・83Case。初版残存二領域は同exact回復の終了確認後、読取り専用Git試験物を含む削除の人間明示承認を得て別処置で回収し、`abandon-owner-*`実領域0を確認した。当時の全試験strictは旧9件のみで新規0、旧3Caseは保証対応まで保持した。現在は上段の保証対応後に撤去済みの固定候補であり、撤去後の独立確認済みである。旧begin APIは他Callerも残るため、3Caseの削除だけで型エラー全解消とはしない。実Docker・限定unknown終了・旧処理撤去・全体回帰とPackage完成は未成立。

同一Host／Homeの直列実行是正（2026-10-16、独立確認前）: 前段の正常1回に続き、同じmanagement・Host領域・Homeで2回の技術終端を保持してから清掃するCaseを追加した。test-only候補は2回目の開始が独立実行でも拒否され、保存モデルがHost物理清掃まで要求する一方、正常completeはLease解放だけを保存する接続不整合を再現した。Host tokenはstateだけの決定論的Hashで正常復帰後に元へ戻るため、新しい世代管理機構は追加しない。既存正常Ownerの同じWriter版でLease解放と旧Owner disabledを保存し、保存・読戻し・排他解放を全て要求する。同Home新開始のモデルへ、旧操作全文不変・同一Host lineage・技術終端・実行評価既知・資源義務なしを共同条件とする限定経路を追加した。旧操作の物理清掃・成功は捏造せず、別Hostの完全清掃条件を維持する。着手前照合は契約・品質の両観点で整合し、追加人間判断なしの既存能力是正と分類する。規範・準拠基準・公開権限を変更しないため準拠監査は追加せず、直接Architecture・品質接続と限定独立レビューで確認する。

修正版は対象Source／試験のstrict・整形・Lint、portable8/8（1157.965ms）、実Hostの正常1回／同Host2回2/2（93600.9678ms）、関連回帰46/46（2117.9797ms）、台帳25/25（19512.3967ms）が成功、失敗・取消・skip0、Exit0。2回分の実保存nonce／回復ID、各begin／complete／清掃予定での先行記録・非対象全文保持、実Home排他の競合と再取得、同じHost tokenへの復帰、交差した清掃／結果証明の拒否、一度の真正Host清掃と逆順finalize、履歴2行との正確な相関を確認した。UTはdecode成功の条件単独反例・同じ開始版での旧操作正常化偽装と、同Host条件省略／disabled保存省略のメモリ反例を含む。独立確認の文書時点・例外表現・Symbol接続のMinor三点を是正し、契約・品質の再確認は全重大度残指摘0・限定Pass。当時は旧normal／同Home／abandonの3Caseを保持し、abandon物理回復・実Docker・旧Source撤去・全体回帰／Reality Audit・Package完成は未成立、全試験strictの旧9件も未解消だった。現在のabandon結合と三Case撤去候補・型検査残件は上段に従う。一度の限定再起動許可は未使用である。

放棄・再入場の当時の着手前照合: 旧実行のbegin・abandon・Host世代解放をproducer子Processへ閉じ、その終了を親が確認してから別の回復子Processを開始する。abandon前後のstate全文・改訂・exact IDとHost marker不変、実Home Lease再取得、正常解放証明false・清掃準備nullを確認し、排他解放を清掃へ読み替えない。回復側はRootを自身で検証し、既存の`recoverRuntimeOwnedDockerTaskForCurrentConsumer`からtransient終了まで本番policyを通す。五資源未要求を照合し、Process発行境界のsticky観測でDocker／Provider要求0と固定Native実行を分ける。親は両子Processの終了、対象exact履歴、非対象全文不変、対象state除去、Host／marker／短命物不存在を個別に確認する。新しいSource失効機構・Store／Lock・Docker再起動は追加せず、失敗時に元理由とexact参照・残存を保持する。当時はこの結合確認と独立確認後に旧Case撤去を判断する予定とした。現在は上段の保証対応後に撤去済みの固定候補であり、撤去後独立確認済みである。

> 以下の先行単位では、検証範囲・保持判断・型エラー件数を当時の改訂版の経過として記録する。現在の三Case撤去と型検査残件は冒頭の最新段落に従い、先行段落の現在形を現在Treeの状態へ流用しない。

正常1回の実Host結合（2026-10-16）: 既存`docker-recovery-owner-reentry`へ、本番Owner→実Root／Home排他／Host／現在Writer→真正Host清掃→履歴／transient終了のCaseを追加した。Home観測とDockerのcleanup／mount／terminal証明だけを厳密tupleで模擬し、保存・Kernel・Hostは模擬しない。active中の同Home競合拒否、正常解放後の再取得、清掃前finalizeの本文／履歴不変、偽Capabilityと清掃結果コピーの拒否、真正清掃後の対象だけの除去・非対象全文保持・履歴・短命物／Host／marker不存在を確認した。途中の拒否は試験の非契約理由と履歴参照先を訂正し、製品条件を緩めていない。独立確認で見つかった台帳Profile、Host実行の閉集合、例外時の回収・模擬復元と解放falseの処置を是正した。修正版2Fileは5/5成功（31451.4469ms）、Exit0、失敗・取消・skip0、自作Root残存0。Source／対象試験strict・整形／Lint、Runnerの静的確認と台帳25/25（15595.4846ms）、台帳検査0、変更PathのWindows段階選択1と接頭辞によるCase非重複も確認した。契約・品質の独立再確認は残指摘0・限定Passである。

正常1回の限定Pass時点では、旧Case撤去・通常完了Capability全体の成立とは分け、旧normal／同Home／abandonの3Caseを全対応と撤去後確認まで保持した。当時は同一Host／同一Homeの直列2回、abandon後のfresh回復への物理結合、実Docker、全体回帰・Reality Audit・Package完成は未成立で、全試験strictの旧9件も残っていた。この正常1回の変更単位ではSource／Schema／過去Evidenceは不変更だった。現在のSource変更と直列2回の結果は上段に従う。新Store／Lock／FrameworkとEvidence書庫は追加せず、一度の限定再起動許可は未使用である。以下の旧pointer移行時点の未完了表示を、本単位の結果へ読み替えない。

通常完了の拒否・旧pointer刺激の移行（2026-10-16）: 当時の旧normal／同Home／abandonは、正常Owner→実Lease→実保存→Host清掃の結合とabandon物理保全が不足したため未置換のまま保持した。現在は上段の保証対応後に撤去済みの固定候補であり、撤去後独立確認済みである。一方、旧pointer Case一件と未登録completeの重複断言は、現行Owner拒否試験と実Host保存試験の共同根拠へ移して撤去した。未登録／不正completionとHost完了拒否では、各直前からHost復帰・Lease解放・lifecycle保存・清掃Capabilityの増分0、operations全文・Host不変、正常解放証明false・清掃準備null、同元入力の再入場を確認する。既存mockのv2種別欠落を`docker_task`へ追従し、Source拒否を緩めない。Minorの各入力OracleとHeader／SymbolのQA3・PRL-IT-013接続を是正し、修正版Owner1/1（485.3038ms）、実Host1/1（139568.1861ms）、strict・整形／Lint、相互Trace／台帳0指摘と試験Root残存0を確認した。Host初回のhardlink EPERMは環境制限で、用途限定の実Host再実行成功と区別する。修正版の独立確認は残指摘0・限定Pass、旧pointer Case／重複断言の撤去後独立確認も契約・品質の両観点で残指摘0・限定Pass。当時の全試験strictは旧一Fileの9件で未合格（先行13件から減少）であり、正常・同Home・abandonを完成扱いにしなかった。現在の保証対応と型残件は上段に従う。Source／Schema／旧許可辺／結果／過去Evidenceは不変更、新Store／Lock／Frameworkは追加しない。

既知資源IDと相関回収の現在接続（2026-10-16）: 旧identified相関回収Case一件を、新しい`cli_entry_orchestrator_identified`へ対応付けて撤去した。親の実Writer三版（意図・発行・ID確定）の各改訂／元版Hash・他操作不変、旧Owner解放後の別Process実Resolver、その返却ID→公開回復composition→DI構成照合／exact五要求→config／Host回収→同相関／未受領配送保持を確認する。Docker／Authenticode応答だけを模擬し、固定Nativeの既知操作は元Process APIへ委譲する。未知要求はsticky拒否、ProviderのID照会・inspect・同ID rm一回・ID／名不存在を全数消費し、rm直前のfresh state ID、config同実体・空・回収後不存在を確認した。Headerの模擬範囲と固定reason断言のMinor二点は是正し、修正版Host1/1（65440.5685ms）、DI反例28/28（431.2486ms）、上位資源反例26/26（783.0069ms）、既存三条件回帰3/3（112073.6471ms）が成功。先行Host1/1は新版根拠に流用しない。修正版二Fileの独立確認は残指摘0・限定Pass、旧identified相関Caseの撤去後固定差分も契約・品質の両観点で残指摘0・限定Pass。実Docker daemon・実Publisher・実Provider E2E・新modeのCLI起動成立は含めない。当時は旧normal完了・Home直列再利用・abandon／pointer等と旧API参照の型13件、旧Source撤去・全体回帰・実境界の残件を保持した。現在の三Case撤去済み固定候補と型残件は上段に従い、旧Source撤去・全体回帰・実境界の未完了は維持する。以下の相関段落で述べた未置換Caseは本単位で処置した先行状態である。

上位相関の現在保存接続（2026-10-16）: 旧Owner喪失後のexact相関解決Case一件を、既存`cli_entry_orchestrator`の実Host条件へ移した。初回保存前の上位相関を内部IDとは別値で固定し、Owner解放後の別Processで実Resolverを用いる。真正Rootのexact一致と明示不存在、偽造Capabilityコピーの拒否、読取り前後state bytes不変、短命物不存在と排他解放を確認し、Resolver返却IDを実CLIへ搬送する。回収後も同相関・exact配送ID・未受領を維持し、ACK待ちをTask完了へ畳まない。静的確認、修正版Host1/1（53268.5544ms）と既存Orchestrator回復ST1/1（18558.6595ms）が成功。修正版二Fileの契約・品質確認は残指摘0・限定Pass、旧相関一件の撤去後固定差分も契約・品質の両観点で残指摘0・限定Pass。全五資源未要求のため、既知IDの要求済み資源を持つ旧相関回収Caseは未置換のまま保持し、次の結合確認対象とする。旧API復活・新State／Lock／Framework・実Docker要求・過去Evidence変更はない。全体目標は縮めない。当時の旧試験13型エラーを現在件数とは扱わず、現在の型残件は上段の一件に従う。

旧Recovery試験の移行（2026-10-16）: 廃止済みObserver／AppData pointer形式の`recovery-cleanup-probe.ts`と専用三Case・専用型／helperを撤去した。旧APIの復活や偽Receiptは追加しない。既知exact IDによるfresh Host回収は`current-host-transition`のA／B／C（3/3、107859.274ms）、保存marker清掃は`current-state-marker-cleanup`（制限内hardlink拒否後、実Host2/2、1697.9341ms）へ対応する。引渡し前失敗は元例外を外部の非0終了／stdout空で保持し、finallyで準備Owner解放・別PIDの本番CLI・Host／marker／短命物不存在・元結果／一次失敗の履歴保持・非対象操作不変を確認する。全五資源未要求の完全形を明示し、同じ捕捉Oracleのthrow省略変異と既存CLI三用途を含む修正版5/5（217410.0754ms）、資源回収26/26（731.0489ms）が成功した。初版の例外内部消費と変異評価context衝突は是正済みで、初版の成功を根拠にしない。契約・品質の修正版二File再確認は残指摘0・限定Pass、撤去後差分の契約・品質再確認も全重大度残指摘0・限定Pass。Symbol既存SuiteへQA-000003／PRL-IT-013を追加し、Header／QA／Symbol相互一致と既存台帳検査0指摘を確認した。Source strict成功、全試験strictは旧一Fileの13件に減少したが未合格。現行Source／台帳から旧Probe参照0、過去Evidenceは不変更。実Docker回復・未伝達IDの自動発見・旧Suite全体移行完了は主張しない。新Store／Lock／Framework・Evidence書庫は追加しない。

失敗履歴の最終限定結果: 契約Minorの旧進捗文を同期し、品質指摘`CQ-FAILH-Q01`（既知のNative回収成功を集約cleanup unknownで失う）を是正した。同呼出しの既知true保持とfreshでの非復元を、実DI Runtime／Machineの観測資源回収不明・Native回収成功の対照と旧上書き変異で確認した。関連74/74（3945.4201ms）、Source／対象試験strict、整形・Lint・差分確認成功。修正版の実Host五切断点＋一次失敗再入場7/7（151510.4337ms）、Exit0・失敗／取消／skip0、自作`repair-owner-*`残存0。修正前7/7は新版の根拠に流用しない。契約・品質の修正版独立確認は全重大度残指摘0・限定Pass。CLI選択13/13も成功した。保持判断待ち失敗の処遇、後日の回復観測、限定auth-create unknown終了、旧処理／旧型18件・全体回帰／Reality Audit／実境界は残るため、Docker Isolation全体完成・Commit／Pushは未成立。新しいEvidence書庫・Store・Lockは作成しない。以下の本単位の「実行中」は先行経過である。

失敗履歴の前提分離（2026-10-16）: `prepareCoordinatorStateRepairCompletionSnapshot`が履歴要約の成功限定へ暗黙依存しないよう、既存Architectureの終了条件（recoveredのstatus／reason、outcome回収確認、一次失敗なし、Engine ready、Host safe、checkpoint回収確認・失敗なし、九処置終端）を同関数へ明示した。既保存summary／hash・履歴の再検証は維持する。codecとsummary受理を意図的に緩める依存故障注入で18反例の除去拒否・入力不変を確認し、モデル16/16、関連71/71（3064.071ms）、Source／対象試験strict、整形・Lint成功。契約・品質の限定独立レビューはいずれも残指摘0・Pass。これは純粋値契約の補強で、失敗履歴・物理Writer・実Docker・全体完成の成立ではない。Task・履歴Schema・公開入口は不変更。既存契約への実装整合として技術／品質の限定独立レビューを行い、準拠条件は変更しないため準拠監査を追加しない。

失敗・取消履歴の変更対象は、①修復要約の適用条件・自己完結decoder、②既存履歴Reader／Writerの再入場、③本番compositionの結果返却である。失敗理由・cleanup不明・未確定slotを保存しても、技術再実行・成功・現在状態除去を許可しない。履歴再入場の固定recovered返却とNative回収trueの補完をなくし、同じ操作の保存事実から返す。除去済み再入場の`repairCompletionAbsent`も成功履歴だけに限定する。着手前の契約・品質照合で、保持判断待ちの失敗を先に履歴へ固定すると判断変更不能になることを検出したため、その失敗は現在状態で保持し、処遇の遷移・入口を接続した後に履歴化する。履歴開始後の操作固定は維持し、過去のunknownを後着callbackで成功へ書き換えない。保存失敗ではexact IDと先行一次失敗を維持する。新Store／Lock・回復Framework・Task履歴bytesは追加／変更しない。「失敗結果の記録」と「安全な状態除去」を区別した発火・非発火・情報不足の表をArchitectureへ固定し、候補実装した。モデル126組合せと破損反例、mainの失敗／取消12組合せ・二段出版故障10組合せ・exact取消再入場・保持未決の非発火を含む関連73/73（3834.5493ms）、strict・整形・Lint成功。先行試験の期待値と返却変異の適用箇所を是正し、旧成功結果だけの根拠を失敗履歴へ流用しない。実Host五切断点・除去済み偽装拒否と既存の一次失敗確定試験は実行中で、独立レビューは未完了。

CLI切替の着手前照合: 既存の明示修復flagを維持し、通常修復の呼出しだけを現在Root／取消結合／新修復compositionへ切り替える。exact再入場は既存`--recover-isolation`で新修復IDをTask／Host／Probeより前に分類する。通常doctor・Task回復・旧close／adoptは変更せず、保持物処遇と限定unknown終了能力が揃うまで旧依存の全撤去を完成扱いにしない。CLIはOS・Path・Sessionを判定せず、固定fieldと有限reasonだけを投影し、一次理由と取消解除の失敗を分ける。発火例は明示修復と正規exact修復ID、非発火例は通常doctor／Task ID、境界例は取消済みexact再確認、情報不足例はRoot／結合・解除不明である。結合失敗／Root拒否では下位呼出し0、解除不明は既完了状態を戻さずexit2、内部値のgetter・Proxy・未知fieldを公開しない。契約専門家の読取り専用照合は着手可。実装・品質の限定独立レビューとCLI契約試験を行い、新Store／Lock／Framework・flag改名・保持物削除・Docker実要求はこの切替で追加しない。

最新のCLI限定結果: 通常修復と新exact IDを新compositionへ切替え、旧通常修復関数へのCLI依存を撤去した。旧close／adoptとTaskの旧after経路は代替未成立として保持した。初回独立確認の三指摘（公開結果の共同相関、新規取消の成功Oracle、実router接続未反証）と、自己検出した旧options fixtureのkind欠落を統合して是正した。現Sourceの保持判断待ちを失わない四分類を確定し、停止時の部分事実と除去済み再入場の技術詳細非復元を維持する。実parser＋本番doctor分岐の六経路と分類無効化変異、新規取消／取消済みexact metadataの分離、getter／Proxy拒否・内部値非公開・解除後表示を確認した。System選択13/13（812.5569ms）、options全15/15（4503.8875ms）、関連71/71（2986.292ms）が成功。Source strict・対象試験strict・整形・Lint・差分確認は成功し、契約・品質の修正版限定再レビューは全重大度残指摘0・Pass。System File全体・実Docker／Provider／全体E2EのPassではない。

本番終了接続の最終限定結果: 履歴切断点の期待値を更新した実Host親29/29（244330.2093ms）、Exit0・失敗／取消／skip0、自作試験領域残存0。新mainの切断点11/11と別の根拠として確認し、品質指摘CQ-MAIN-COMP-Q01は解消、契約・品質とも限定Passである。以下の当該再回帰実行中という記述は先行経過として扱う。保持物処遇、blocked／cancelled履歴、限定auth-create unknown終了、旧Source／試験撤去、全体回帰・実境界・Reality Auditは残っており、Docker Isolation全体完成・Commit／Pushは未成立。

最新の本番履歴接続結果: 修正版の実Host試験39/39、Exit0（646325.1532ms）、失敗・取消・skip0。保持保存二形、初回pending三形、Identity追加／Session二形、本番入口経由の履歴五切断形、技術分類、故障・種別変異・対象外保全を確認し、自己生成`repair-owner-*`試験Directoryの残存0を確認した。契約・品質の修正版Sourceは残指摘0で、品質確認者はこのHost結果を限定成立の根拠へ反映可能とした。これは本番履歴接続の限定結果であり、以下の実行中記述を更新する。後追加の未接続修復終了候補はHost39の根拠に含めない。終了候補追加後の関連42/42（2436.0042ms）、Source strictと対象試験strict、整形・Lint・差分確認は成功した。状態除去の物理接続、保持物の処遇、CLI切替・旧処理撤去・全体回帰・実境界は引き続き未完了。

現在の限定結果: 修復履歴の保存部は、修正版実Host24/24（205890.4627ms）、既存状態保存回帰3/3（179629.7151ms）、関連36/36（1371.0076ms）が成功した。失敗・取消・skip0、Exit0、静的三軸・差分確認成功、自作試験Root残存0。契約・品質の最終限定レビューは全重大度残指摘0・Pass。保存途中五形、十一故障・差替え、六つのkind／scope変異、非空Task／他修復／回復参照／配送の全文保全とRepairのTask配送fallback0を確認した。先行Hostの試験時刻・変異対象数・混在fixture誤り、既存回帰の環境hardlink拒否・phase飛越は試験側で是正し、製品の許可辺・保護条件は緩めていない。先行失敗結果を修正版成功へ流用しない。本番修復呼出しへの接続、保持物引渡し、状態除去、CLI、blocked履歴、実Docker／Providerと全体完成は未成立である。以下の「検証中」はこの限定結果より前の経過として扱う。

#### 保持判断・終了整理の着手前照合

退避物不存在の終了整理: 履歴確認済みの`settling`／recovered／`not_applicable`で、九処置終端・Engine ready・Host safe・cleanup confirmed・stale absent・一次失敗なしのexact修復だけを現在状態から除去する。CLI consumerと同IDの回復参照・配送不存在も要求し、他操作・全参照・配送は全文維持する。通常更新の暗黙除去拒否とTask completionは変更せず、修復専用の値候補と既存completion保存骨格へ接続する。契約の読取り専用着手前照合は着手可。正常除去、未終端／保持物／未確認履歴の拒否、対象外保全、通常Writerでの除去拒否、保存途中再入場を順に検証する。退避物がある場合の新しい回収方針は人間の判断待ちであり、この単位では実フォルダ削除・DI再取得・新Store／Lockを行わない。

終了整理の値候補: `prepareCoordinatorStateRepairCompletionSnapshot`を追加した。初回レビューのModerate一件は、非空の他Task／他修復／回復参照／配送を持つ既存fixtureでの全文保全・対象だけ除去・版相関と、全操作消去の一条件変異を同じOracleで拒否する試験により解消した。再レビューは全重大度残指摘0・限定Pass。修正版関連42/42（2372.0734ms）、Source strict・対象試験strict、整形・Lint・差分確認は成功した。純粋な値候補だけの成立であり、既存completion Reader／Writerへの種別固定接続、保存途中再入場および本番呼出し接続は未完了。先行したHost39件の結果を本候補の物理成立へ流用しない。

終了整理の物理接続: 既存`current_completion`へ種別を固定し、修復専用Reader／Writerを同じKernel／CAS／読戻しへ接続した。Sourceレビューで検出した履歴行欠測の許容（契約Major一件と品質Moderate一件の同一原因）は、修復だけReader・排他内Writer双方のexact行必須条件へ是正した。Taskの既存欠測許容は不変。非空の別修復行だけを残す拒否例と各guardのメモリ変異で、二層を独立に反証した。Task試験のprivate helper切出し漏れ一件も是正した。修正版実Host8/8（116820.7497ms）、Exit0、失敗・取消・skip0、自作fixture残存0。先行7/7を修正版根拠へ流用しない。関連全回復試験では先行変更に未追従のfixture三件（null履歴fieldとVM scope変数）を是正し26/26（750.7083ms）、strict・整形・Lint・差分確認成功。修正版Sourceの契約・品質レビューは残指摘0で、最終機械結果の照合中。本番修復compositionとCLI接続はまだ未完了。

次の本番接続の着手前照合: completion前置のpublicationありは終了保存だけ、除去済み観測はmarker清掃とfresh確認だけへ閉じる。解放不明は全停止、blockedかつ解放済みからは既存History Reader／厳密metadata出版が別途対象を証明した場合だけ従来経路へ進める。終了保存・清掃・fresh確認の各共同fieldと現在Ownerを要求し、一旦終了分岐へ入った後の失敗はsticky停止して技術処置へfallbackしない。履歴からcheckpoint／Native詳細を復元せず、既確認outcome/historyとcompletion確認を別に返す。retainedは対象外。契約の読取り専用照合は着手可で、新Store／Lock／Schema・追加人間判断は不要と確認した。

本番終了接続の候補実装: 同じ修復compositionへ終了Reader／Writer、既存marker清掃、fresh除去確認を接続した。終了確認・既知Effect・排他確認を別に返し、先行outcome／履歴確認を後続失敗で消さない。除去済み再入場はcheckpoint／Native／outcome詳細を履歴から復元しない。保持物は対象外。関連71/71（3039.9138ms）とSource strict／対象試験strict、整形・Lintが成功し、Sourceの契約・品質確認は残指摘0。新main実Host11/11（141421.1557ms）、Exit0・失敗／取消／skip0で、通常・exact pending・不正pending・非空の他履歴だけ・Owner失効・取消duplicate・rename前後／marker削除後の実再入場を確認した。先行物理8件を新mainの根拠へ流用しない。品質確認のModerate一原因は既存履歴五切断点の期待値未追従で、正常四形は対象だけ除去した純粋候補、確認済み履歴欠測はblocked／履歴確認true／終了確認false／本文保持／再追加0へ更新した。同Host親を再実行中で、この再回帰完了まで限定全体Passを保留する。旧試験型エラー18件は全試験strictで同じ二Fileだけに残り、新たな型エラーは増えていない。

本番履歴接続の着手前照合: 修復専用History Readerへ、履歴が未開始の技術状態を示す読取り専用分類`technical_state`を追加する。exact対象がrepairing・outcome／summary／history=null、canonical履歴全行正常・同ID行なし・history pendingなしの場合だけとし、Native許可・Writer資格を生成しない。技術再開にはこの分類を要求し、一般のblockedを技術処置へfallbackしない。初回current不存在・Identity追加・保持判断のpendingを失わないため、blockedでも排他解放を確認できた場合だけ、既存の厳密な修復metadata publisherを一度呼べる。completed・保存確認・解放・現在Ownerが揃った後にfresh専用Readerを必須とし、救済のno_pending／blockedでは停止する。completed診断を再呼出しで上書きしない。履歴出版対象は同じ現在Ownerとcodec確認済みoperationIdへ結合し、各段後のfresh Readerを挟んで最大二段、失敗・解放不明・段階不変なら停止する。新規recovered・保持不要の結果保存後、または同呼出しの明示保持保存後だけ履歴を開始できる。重複保持拒否は維持し、取消済みでも現在保存Ownerが有効ならmetadata確定だけを許す。履歴失敗でも既保存outcome・保持判断・既知Effect・exact参照を保持し、履歴確認とは別に返す。契約・品質の読み取り専用照合を統合し、通常Task Reader／履歴bytes、Schema、DI／Native、CLI、操作除去・引渡し・blocked履歴は変更しない。新しいStore・Lock・Frameworkは追加しない。

本番履歴接続の候補実装: 同じ修復compositionへ専用Reader／Writerを接続し、既確定outcome・保持事実・履歴確認・累積履歴Effect・排他確認を分離した。初版レビューのModerate二件（既存metadata有限形の遮断、保存済み保持確認の投影漏れ）とMinor二件（前置排他観測、Header追従）を是正した。静的三軸と関連41/41（2383.4167ms）は成功し、契約・品質の修正版Source再レビューは全重大度残指摘0。実Hostの本番入口経由の保持／初回pending／追加・Session／五履歴切断形と故障反証は実行中であり、最終成立には含めない。先行実Host29/29（220237.9199ms）は是正前Sourceの限定結果で、修正版の根拠へ流用しない。

変更分類は既存修復の保存・終了接続である。Coordinator詳細設計、QA-000006、既存状態モデルと物理Writerを照合し、契約・品質の読み取り専用確認を統合した。準拠基準・リリース判断は変更しないため準拠監査を追加しない。Source・検証・設計の伝播は限定独立レビューで確認し、旧処理撤去と全体完成は別途確認する。

| 対象 | 今回の処置と確認 |
|---|---|
| 保持判断 | exact修復が`awaiting_disposition`・recovered・pendingの場合だけ、人間の明示保持操作から`settling`・retainedへ進める。技術終端、Engine ready、Host safe、cleanup confirmed、一次失敗なしも共同要求する。変更はphase／dispositionだけとし、処置前取消・失効では保存0、保存後は巻き戻さない。 |
| 状態遷移 | Repairだけを許可辺で検査する。自己遷移、repairingからsettling／awaiting_disposition、awaiting_dispositionからsettlingを扱う。今回のCLI transient経路はawaiting_deliveryを生成しない。Taskの状態順序は変更しない。 |
| 履歴 | Task要約と別の`repair-summary/v1`を既存`history-row/v2`へ収める。既存Task要約byteを変えず、固定時刻・内容Hash・行Hash・confirmedと30日設定を共用する。Task配送・管理資格は合成しない。 |
| 保存途中 | 保持確定、履歴checkpoint、履歴出版確認、操作除去の切断点を既存Writerの有限な再導出へ接続する。旧pending分類を緩めず、各用途の元版・実体・全文・Root／Ownerを再確認する。 |
| 状態除去 | recoveredの共同終端、保持処置、履歴保存・読戻し、CLI固定consumer、同ID参照／配送なしを要求する。物理保持物の引渡し責任が未確定なら除去しない。履歴期限は物理退避Directoryの削除許可ではない。 |
| 反証・回帰 | phase全辺、別ID・非recovered・未回収・一次失敗・Owner失効、保持以外全文不変、Task混在、各保存切断点とfresh再入場、重複履歴・時刻変更・期間境界を確認する。Native／Dockerの再取得・操作0を確認する。 |

新Store・Lock・Registryや自動削除は追加しない。blocked／cancelledの安全終端の履歴化は後続OPENとし、失敗を成功へ変更しない。物理保持物の保持上限・人間引渡しは現在契約と照合を続け、未決事項を無期限のRuntime追跡または自動削除へ補完しない。この段落は計画であり、実装・検証済みを表さない。

保持接続の現在候補: Repairの許可辺と専用保持候補を既存修復compositionの明示retain用途へ接続した。初版の32/32とHost3/3（218974.7924ms）後、独立確認は契約Moderate2（判断変更の専用辺迂回、fresh出版後の誤ったblocked返却）・品質Moderate1（判断欠測の反証不足）を返した。両者へ統合是正を照合し、判断変更を共同終端・全文不変の一辺へ閉じ、当該呼出しの出版確認＋通常Reader＋現在Ownerだけで追加Writer／DIなしの保持確認を返す。codec合法な判断欠測と判断条件省略変異、通常checkpoint迂回、出版部分不成立・Reader／Owner不明を反証した。修正版の静的三軸、関連33/33（1283.8109ms）、正常・切断両Host3/3（218976.2119ms）が成功、失敗・取消・skip0、Exit0。fresh保持確認、追加Writer／DI0、currentと旧pending全文一致、短命Fileと試験Root残存0を確認し、契約・品質の限定最終再レビューは両方とも全重大度の残指摘0・Pass。初版Hostの誤Oracleを修正版の根拠へ流用しない。履歴出版・保持物引渡し・操作除去・CLI接続は未完了。これは保持判断の値・保存・保存途中確定だけの成立で、退避物の削除や全体修復完了を示さない。

修復履歴の値候補: 契約・品質の着手前照合を統合し、Task encoder／専用関数を変更せず、Repair専用summary／line／履歴Snapshot／出版候補とschema判別decoderを追加した。初回false、時刻・Hash固定、確認の単調性、非対象全文保全、九slotの合法終端・schema／ID交差・余剰情報・期間境界・偽Buffer比較を反証した。通常修復Writerは履歴更新を外側と排他内で拒否する。Task summary／行のgolden byte・Hashを含む静的三軸と最終関連36/36（1325.1024ms）、最終実Host1/1（92213.0298ms）が成功、失敗・取消・skip0、Exit0。outer拒否はI/O0、outer guard省略変異でも排他内読取り到達後に拒否し、初回／確認候補を不保存、本文不変・短命物と試験Root残存0・技術入口増分0を確認した。契約・品質の限定最終レビューは全重大度残指摘0・Pass。専用物理出版・fresh再入場・保持物引渡し・状態除去・失敗の安全終端履歴・通常CLIは未接続であり、値候補と通常Writerの拒否を本番履歴保存の成立へ読み替えない。Docker／Provider／再起動・Commit／Pushは行わない。

修復履歴の物理接続候補（検証中）: 次の着手前照合では、契約・品質の二観点から既存のKernel排他・固定File観測・pending保存・fsync／rename／読戻しを再利用する方針を確認した。Task／Repairは種別固定入口から入り、Readerがexact操作から導出した種別を既存の私有`current_history` Contextへ保存し、排他内でcurrent／candidate双方の種別・operationIdと現在Rootを再照合する。Readerの三段階、Writerの候補再導出・JSONL出版・最終読戻しは種別別関数を使う。RepairでTask配送へのfallbackは行わず、通常Repair Writerの履歴更新拒否も維持する。候補Sourceの静的三軸と関連36/36（1327.8409ms）、実Host正常出版1/1（100802.7588ms）が成功した。契約・品質の独立レビューはSource指摘0だが、両方から同じ検証不足Moderate1を受けた。Productionを変更せず、既存Host試験へ五つの有限中断形、Owner／operationId拒否、File／設定差、非対象全文、保存故障と種別・fallbackの限定変異を追加する統合是正を両確認者へ照合済みである。第一追加分の実Host6/6（110840.178ms）は、初回state pending、history pending、history rename後state未確認、confirmed＋marker、confirmed行欠測のfresh再入場を成功し、固定時刻・Hash・本文、confirmed欠測の書込み／再追加0、Owner／operationId拒否、短命物・自作Root残存0、技術入口増分0を確認した。失敗・取消・skip0、Exit0。正常系列とこの第一追加分を、残余matrix完了後の最終Passへ流用しない。File／設定差、故障、種別誤配線、非対象全文保全の物理実証と本番修復呼出しへの接続は未完了。新しいStore／Map／Lock、Docker操作、保持物削除、状態除去は追加していない。

未出版pendingの現在候補: 着手前の契約・品質照合でmetadata出版とNative再開を分離した。初回currentなしも旧WeakMapの復元とは扱わず、現在明示Ownerによる単一空Repairの有限出版へ限定し、新Store／Lock／耐久証拠を増やさない。純粋分類、既存Writerの私有出版用途、exact参照時の修復Owner接続を候補実装した。読取りとWriterの両排他で領域・File実体・全文を照合し、通常初期化条件は維持する。Source／新試験の静的確認、先行局所19/19、全修復Owner Host21/21（378194.7033ms）が成功。独立確認はSource欠陥0と、物理2mode未確認・codec合法な禁止遷移の反証不足のModerate各1件を返した。両者へ統合是正を照合しProductionを変えず、同じOracleによる用途誤配線・全文比較省略のメモリ変異、元版Hash差・非対象変更／除去・初回条件違反のdecode成功反例、既存currentへのIdentity追加とSession専用の実Writerを追加した。修正版のUT10/10（384.5659ms）、関連モデル／接続27/27（956.7107ms）、追加Host3/3（43006.6726ms）、失敗・取消・skip0、Exit0。追加Hostの初回停止は0byte履歴fixtureと試験組立て依存不足であり、正規の非空合成履歴と実依存へ訂正、診断用の例外再throw変異は撤去した。Host21/21は試験追加前のSource同一根拠として区別し、修正版の契約・品質の限定最終再レビューはいずれも全重大度の残指摘0・Pass。未回収checkpointの安全停止を技術再開成功へ読み替えない。保持判断・履歴・終了整理、CLI切替・旧処理撤去・実Docker E2E、旧試験型18件は引き続き残る。全体完成後だけCommit／Pushし、Docker再起動保留を維持する。

出版済みmarkerの現在接続: 通常Reader前に既存marker清掃を一回呼び、四確認と現在Ownerの共同成立後だけReaderへ進む。新Reader／Store／Lockは追加せず、pending本文は確定しない。清掃後不明でも既知の除去事実を診断へ保持する。Source／新試験の静的確認、局所・モデル・既存清掃18/18（894.8834ms）が成功。通常制限Profileの既存Hostハードリンク反例はEPERMで停止し、成功へ丸めず、Repository内だけの実Host Profileで清掃と新修復接続2/2（19882.3037ms）、失敗・取消・skip0、Exit0を確認した。実Writerのoutcome出版後unlink一回拒否から、Abort済み同IDでmarkerだけを回収し、current全文不変・再保存0・DI再取得0を観測した。契約0・品質Minor1（HeaderのEffect記述漏れ）を統合し、一行だけ訂正・整形確認後の両最終レビューは全重大度の残指摘0・限定Pass。別件の全DI回帰では固定公開APIの期待一覧に新Session入口一件の記載漏れを検出し、期待一覧だけを同期した。再実行は静的三軸と全258/258（30037.0627ms）、失敗・取消・skip0、Exit0。試験Root残存0、差分確認成功。未出版pending、保持判断・履歴・終了整理、CLI切替・旧処理撤去・実Docker E2Eは引き続き未完了。

追加接続の現在候補: 保存済み不可逆一次失敗の結果確定に限り、同exact参照・現在Root／Revision・通常Reader・既存Writerで記録だけを確定する。技術処置の成功や再実行を生成しない。初版のメモリ7/7と実Windows1/1後、独立確認は契約Moderate1（取消による記録確定の遮断）・品質0を返した。両者へ統合案を照合し、記録限定分岐と通常DI開始前の取消判定を分けた。修正版はSource・新試験の静的確認、メモリ8/8（738.5748ms）・モデル込み16/16（768.4722ms）、実WindowsのAbort済み同ID再入場1/1（36359.2853ms）が成功、失敗・取消・skip0、Exit0。DI入口・Native取得・技術観測が増えず、phase／outcome以外を保持する。取消済みcleanup二状態の肯定、対象外・Owner失効と先頭guard復活変異を確認した。修正版の契約・品質の限定最終再レビューはいずれも全重大度の残指摘0・Pass。pending再確定・保持判断・履歴・終了整理・CLI切替・旧処理撤去・実Docker E2Eは残る。Docker再起動保留と全体完成後だけCommit／Pushを維持する。以下は前の接続候補の限定結果である。

上位保存接続の現在候補: `coordinator/src/diagnostics/runtime-repair.ts`をDI固定Sessionと既存のRoot／Revision・Writerへ接続した。Identity→初checkpoint二保存、各通知、join後cleanup＋不可逆primary同版、outcome次版を扱う。技術完了後の取消と後着Native故障、first-wins、incomplete、retained未承認を分離する。実Root・Kernel・Writer／Filesystemと実DI Runtime／Machine（DI Root入口はUsing＋模擬Scope・技術境界へ差替え）の正例・三段階四故障、およびメモリ結果の先行候補16/16（168067.2627ms、Exit0）が成功し、試験Root残存0。独立確認は契約0、品質Moderate2／Minor1（結果共同field、Owner失効、模擬範囲Header）を検出した。両確認者へ統合是正を照合し、Production不変更で共同field・Native確認／理由変異、準備保存後とEffect直後のOwner失効／revalidate省略変異を同じOracleで拒否し、Headerを訂正した。静的三軸・新試験strict、修正版メモリ4/4（631.6737ms）、モデルを含む12/12（651.0224ms）が成功。修正版の契約・品質の限定最終再レビューは両方とも全重大度の残指摘0・Pass。Host16/16はHeader訂正前の処理・Oracle同一根拠として区別し、新Oracleの成立は修正版4/4・12/12で確認した。最終outcome保存途中からのfresh確定、保持判断・履歴・終了整理・pending再確定・CLI切替・旧処理撤去・実Docker E2Eは未完了。全tests型は既知2ファイル18件を保持し、完成後だけCommit／PushとDocker再起動保留を維持する。

現在の作業候補では、保存済み両世代からの同exact部分継続を内部Machine／実Operationsへ接続した。世代固定と追加四処置の各確定後の5切断点について、新Sessionが未完了suffixだけを実行し、初回待機・完了済み処置を再発行しない。再起動確定済みでは、未readyなら継続待機だけ、既readyならHost処置・待機0で再観測する。待機ready後に現在観測を行い、Process／run／保持物／Engine／Artifact／Scope／許可／取消の単独反例を成功へ確定しない。観測中の新世代差替えとIdentity比較省略変異の拒否も追加した。静的三軸と対象8/8（307.0421ms）が成功。直前候補の全DI257/257（29248.9968ms）は最後の変異Oracle追加前であり、最終候補全回帰へ流用しない。途中の試験追加でreadonly差替えの型エラー2件を検出し、型を弱めず明示的な試験差替えへ是正、静的三軸から再実行した。独立確認で新fresh入口の直接負例不足1件（CQ-PARTIAL-Q01）を検出した。両確認者へ統合是正を照合し、Production不変更でSchema適合する6不正形と入口guard無効化変異を追加した。観測・通知・前提・Effect・待機0、入力全文不変を同Oracleで確認。是正後は静的三軸・Machine10/10（365.9679ms）・最終全DI258/258（29389.6527ms）、失敗・取消・skip0、Exit0。契約・品質の最終限定再レビューは両方とも全重大度の残指摘0・Pass。真正上位Owner／Writer／CLI・旧上位処理撤去・実Docker E2Eは未完了。Docker操作・外部AI要求0、全体完成・Commit／Pushは未実施。

以下の段落は前の区切りの結果であり、「部分継続未接続」の表示は当時の状態を表す。現在候補の部分継続実装は上段とDI詳細の接続中契約を参照する。

固定本番組立て`runDockerRuntimeRepairSession`を既存runtimeへ接続し、任意依存を受ける内部関数は`Using`へ改名した。Native取得と同じ固定配布Rootを共用し、入力検査後のArtifact一回捕捉、同descriptorでの取得、同Session／H／nonce／KnownFolder／Artifact SHAのfactory搬送と準備後照合を実装。内部組立て→実Operations→実Machine→実Runtimeを通す正常／継続と、15拒否・失効条件、nonce差替え・準備検査省略変異を局所5/5（232.7491ms）で確認し、静的三軸が成功した。実Native・実Filesystemは最下位境界の個別試験に従属し、真正Writer／CLIとfresh部分継続は未接続。全DI回帰254/254（29162.8278ms）、失敗・取消・skip0、Exit0を確認。独立確認で現行Arch／QA／Headerに残った旧未接続表示とScope試験範囲の過大表示を是正し、契約・品質の限定最終再確認はいずれも全重大度の残指摘0・Passとなった。処理・Oracle・過去Evidenceはこの説明是正で変更していない。全体完成・Commit／Pushは未実施。

実Adapter候補の初回全回帰252/252（29206.362ms）後、独立確認でHeader説明1件と「停止confirmed後もEngine transient／Process残存なら退避しない」試験不足1件を検出した。両確認へ統合案を照合し、処理・Schema・Root・Nativeを変えず、説明限定と二軸注入／注入到達1／停止事実単調保持／追加退避0を追加した。ガード除去のメモリ変異を両軸で同じ固有Oracleが拒否する。是正後は静的三軸・局所4/4（200.1727ms）・全DI253/253（29299.2855ms）、失敗・取消・skip0、Exit0。契約・品質の限定最終再レビューは両方とも全重大度の残指摘0・Passである。実H／Artifact／KnownFolderの固定本番組立て、fresh部分継続、真正Writer／CLI、旧上位処理撤去・実境界確認は残るため、全体完成・Commit／Pushは未実施。

次の実接続として、DI内部`repair-operations.ts`へ同じNative子・固定Directory Access・Engine／Backend観測を九処置へ接続した。実Adapterと実Machine・実Runtimeを通す局所3/3（172.083ms）と静的三軸が成功。通常起動4Effect／初回失敗後8Effect、公式停止能力不存在だけの明示不要、両世代保存、発行後取消の事実保持、片側lock・世代差・意図後失効・観測cleanup不明の停止を確認した。Native結果不明は未発行成功へ補完しない。これは最下位OS境界を模擬した接続根拠であり、実H／Artifact／KnownFolderを固定する本番組立て、fresh部分継続、真正Writer／CLIは未接続。新候補の全回帰・独立確認はこれから行う。Docker要求・外部Provider要求は発行していない。

両世代固定の新候補は、全DI回帰249/249（28862.8102ms）、失敗・取消・skip0、Exit0。契約・品質の独立再確認は両方とも全重大度の残指摘0・限定Passとなった。前候補のHeader訂正も解消済み。これは内部Machineの保存先行接続までの根拠であり、実技術Adapter、完全fresh条件、保存後crashの部分継続、真正上位Owner／Writer／CLIは引き続き未成立である。次は同じNative子・Directory factory・Engine観測を実Adapterへ固定し、その後、保存済み両世代からの同exact部分継続を接続する。Docker再起動の保留・保持物削除禁止・全体完成後のCommit／Pushを維持する。

観測cleanup候補の全DI回帰247/247（28914.0995ms）後、独立確認で準備直後の捕捉経路の試験不足1件を検出した。通常返却／直前取消の両条件と捕捉順序変異の拒否を追加し、実装不変更で理由保持・Machine前停止を確認した。限定再確認は本体指摘0、helperの前提説明1件を実際のMachine開始前停止へ訂正した。その後の着手前照合に従い、内部観測をcurrent／failed_launchへ分け、初回timeoutと完全継続値の後に両世代を同一候補で保存してから停止意図へ進む接続を実装した。静的三軸と関連19/19（359.6527ms）が成功。実Adapterの完全fresh判定、保存後crashの部分継続、真正Writer／CLIは未接続であり、fresh部分候補は現段階で発行0として停止する。新状態field・Lock・互換Readerは追加していない。この新候補の全回帰と独立確認は未完了で、全体完成・Commit／Pushは主張しない。

実Adapter具体化に必要な観測境界を接続した。旧構成Rootを要求しない内部Desktop修復Engine観測を既存修復処理へ共用し、固定endpoint・環境・出所前後・4KiB／5秒・Timeout分類を維持する。三用途の33対照と回収Oracle負対照を含む5試験が成功。観測cleanup不明は既存checkpoint fieldへ限定理由を追加し、同prepareの局所Reader→runtimeのabort選択→join後未保存候補へ接続した。既保存理由優先、観測、Nativeの固定順位とcleanup unknown ORを正本化し、時間順first-winsとは区別した。DI静的三軸と16/16（185.0994ms）、上位修復モデル8/8（301.5833ms）、上位Source strictと対象format／lintが成功。上位tests strictは既知2ファイルの18件だけで、新試験の型エラーは0。補助的Biome checkのimport整理2件は既存並びの指摘で、標準のformat／lint軸は成功している。実Adapterのsticky検出・完全fresh条件・世代bind通知と本番Writer／CLIは未接続、全体完成は主張しない。

Directory factoryのlock肯定Oracle補強後、契約・品質の限定再確認は両方とも全重大度の残指摘0・Pass。Sourceは変更せず、最終根拠は静的三軸と対象8件、245件の全回帰は試験補強前として維持する。次は、同じNative子・固定Directory factory・段階付きEngine待機を実Adapterへ接続し、固定Repair06に公式停止能力がない場合だけの明示不要、完全fresh継続判定、停止後のknown＋Process absentと退避直前再照合を実装する。現在はこの実接続と真正上位Owner／Writer／CLIが未成立であり、Package完成・コミット／プッシュは未実施である。

Directory factoryと段階値契約の全DI回帰は245/245（27156.0341ms）、失敗・取消・skip0、Exit0。独立確認は契約0、品質Moderate1（factoryのlock肯定値返却未観測）を検出した。統合案を両確認者へ照合し、Sourceを変えず三用途のEACCES→正Identity、entry前後2／実体前後2／open1／変更0と、下位観測後null返却変異の同Oracle拒否を追加した。静的三軸と是正後対象8/8（255.2956ms）が成功。245件は試験是正前として分離し、修正版の限定再レビュー待ち。実Adapter・実H／Artifact／KnownFolderの同系列結合・本番Writer／CLIは未接続のままである。

実Adapterの着手前照合で、旧Sourceは初回180秒timeout後の完全fresh条件においてEngine transientも継続停止へ許容し、その停止後の退避前にはknown＋Process absentを要求することを再確認した。旧能力を落とさずtransientをknownへ偽装しないため、内部待機をstage＋checkpoint入力、元wait分類と非永続continuationの分離へ変更した。初回timeout・初回起動／旧退避confirmedと継続値だけ追加停止へ進め、継続再起動後の継続値は拒否する。合わせてScope捕捉targetsを観測・lock・renameへ閉じ込めるDirectory factoryを追加し、既存退避入力検査を共用した。静的三軸と関連24/24（355.9716ms）が成功。初回の試験は旧fixtureの退避未確認と、差替え保存callbackに対する不要なobject同一性assertで2件失敗し、合法な先行退避と段階値を持つfixtureへ是正した。契約・品質の着手前統合案は照合済み。実Adapter／本番入口・Writer接続、完全fresh条件の実搬送は未成立であり、現固定候補の独立レビューを次に行う。

準備→実Machine接続の是正後固定候補は、契約・品質の限定再レビューで全重大度の残指摘0・Pass。最終全DI回帰も243/243（27724.1537ms）、失敗・取消・skip0、Exit0を確認した。静的三軸・差分検査は成功し、試験用repair／runner-link残存Directoryは0。これは模擬技術Adapterと実Machine・保存通知の内部接続の根拠である。次は同じ捕捉済みScope targetsとNative子へ実技術Adapterを固定し、実H／Artifact／KnownFolderを同じ取得系列へ結合する。その後に真正Coordinator Owner／Writer／CLI、旧処理撤去、履歴・実境界確認へ進む。Docker再起動は保留、Provider要求・永続Dockerデータ削除・実runtime Directory変更は行っていない。

内部接続の固定候補は全DI242/242（26673.1535ms）が成功したが、独立確認はSource安全性0と試験不足3件（実execute肯定搬送、準備後許可単独喪失と結果相関、準備通知一回性）を検出した。両結果の統合案を照合後、Sourceを変えず通常一slotの三段保存・execute1、拒否／許可喪失execute0、全不要化と通知二重化のメモリ変異拒否、各通知本体回数を追加した。静的三軸と是正後局所8/8（140.5149ms）が成功。242件は試験是正前として区別し、是正後固定候補の限定再レビュー待ち。実Adapter／真正Scope／Writer／CLIは未接続のままである。

Native生涯→準備保存→実Machineの内部接続を追加した。初回／fresh捕捉・取得前拒否、実HとScopeの期待値照合、準備awaitと保存通知前後の取消・生存・現在許可確認、準備拒否時Machine0と同子abort／join、最終cleanup候補の未保存返却を実装した。静的三軸と局所7/7（133.3402ms）が成功。初回の試験counter衝突と戻り型推論の誤り、および意図的thenable負例のLint指摘は是正済み。実Scope生成と実技術Adapterは内部模擬境界で、真正Owner／本番Writer／CLI接続・全体完成は未成立。固定候補の独立レビューと全DI回帰を次に実施する。

Native生涯の是正後全DI回帰は239/239（26658.3996ms）、失敗・取消・skip 0、Exit0。再確認で実Listener解除の直接観測不足1件を追加検出し、試験だけに開始前／返却直後の実Listener集合比較と、remove回数1を維持した誤callback変異の拒否を追加した。静的三軸と最終局所4/4（98.8071ms）が成功し、契約・品質の最終限定レビューは両方とも全重大度の残指摘0・Pass。239件は最後のOracle補強前として区別する。Catalog接続は25/25（11661.0068ms）成功。一方、Runner結合確認は既存fixtureのWindows試験期待先不一致（実際`platform-provisioner-release-identity`、期待`docker-isolation-host`）とリンク作成EPERMで失敗し、全体成功とは扱わない。前者は後続の利用側整合、後者は実行環境制約として分離する。実runtimeのScope／準備保存／Machine／Adapter／Coordinator結合は引き続き未完了である。

Native生涯所有の進捗: `desktop/repair-runtime.ts`へ内部取得・同じ子の一回close／join・購読解除を追加した。初版は静的三軸、局所3件、全DI238件が成功したが、独立確認で取消理由上書きとclose選択／終了後signalのOracle不足を検出した。両結果の統合案を両確認者へ照合し、最初の停止理由保持、close個別回数、合法な回収不明、通知順序、終了gate無効メモリ変異を追加した。是正後は静的三軸と局所4件が成功（101.253ms）。追加試験の型エラーは修正済みで、型検査失敗時の試験成功を最終根拠にしない。修正版の再レビュー・全回帰は未完了。新しい管理StateやLockは追加せず、Rootは非公開。Scope・準備保存・実Machine／Adapter・Coordinator本番接続は次の残件であり、本部品だけをruntime全体完成としない。

runtime着手前の契約・品質確認を統合した。初回／fresh入力の分離、取得前拒否、既存R/V/Hの一回捕捉、close一回性・取消とNative喪失の分離、最終cleanup返却を固定する。具体化では可変Docker親Identityを操作全体Scopeへ固定する案を退け、安定Local親と固定対象名だけへ結合する。既存32桁退避名APIへ64桁nonceを直接渡さず、別domainのHashから下位でDirectory IDを導出する。合意後、既存固定Path導出を共用するScope読取りhelperを`runtime-directory.ts`へ追加した。Root非公開・書込み0で、同じ凍結targetsを後続Adapterへ渡す。Source・試験の静的三軸と局所7/7（236.7118ms）が成功し、UTF-8文字数変異、材料差、Local観測不明、可変対象を読まない範囲を反証した。runtime本体・実Adapter・Native取得／回収・真正Owner・CLIは未接続であり、準備の一部を全体完成としない。

Scope候補の全DI回帰は235/235（26792.1105ms）、上位Source strictと差分検査が成功。独立確認は契約0、品質Moderate 1／Minor 1（realpath要求先・回数の観測漏れ、Root非公開説明の件数差）を検出した。両者へ照合後、試験だけを是正し、Localのみ／正常1回、不正入力lstat・realpathとも0を必須断言し、realpath要求をDocker親へ変えるメモリ変異を同Oracleで拒否した。初回の変異生成は整形後の改行へ一致せず負対照未生成で失敗したため、一意な`.native(localAppData)`の置換へ修正した。Source／Schema／APIは不変更。静的三軸と修正版局所14/14（304.9594ms）が成功。235件は試験是正前として区別し、修正版の最終限定確認は未完了。実runtime・Adapter・Native生涯・上位Writer／CLI接続も未成立。

Scope試験是正後の契約・品質の最終限定確認は、両方とも全重大度の残指摘0・Pass。是正後の根拠は静的三軸と局所14件であり、235件の是正前履歴とは区別する。次は、ここで返す同じtargetsを実Adapterへ渡し、真正H／Artifact／KnownFolderを同じ取得系列へ結合するruntime本体を実装する。Scope単独の成功を同じNative Sessionの取得／回収・現在Writer・CLI・実修復の成立とは扱わない。

Machine固定候補の独立確認は契約Major 2／Minor 1、品質Moderate 1を検出した。両結果を集約し、①通常五処置のfresh前提を省略しない／ready後の追加四処置を安全性不明でも発行しない、②不正Effect観測でも耐久元版由来unknown候補を一度通知、③同呼出し内の通知再利用禁止と外側runtimeの呼出し間直列化を分離、④六故障モードの注入必須到達・対象／段階／一回性、取消／許可喪失の到達と理由、issued通知省略メモリ変異の拒否、を両確認者へ照合後に是正した。Source／試験の型・書式・Lintと7/7（279.9099ms）が成功。各九slotの不正観測五種×Owner生存／喪失、初期ready／unknownとreadyかつHost安全性unknownを追加反証した。Schema・通常validator・Root公開集合・Native・上位Writerは不変更。現在は修正版の独立再確認前であり、実Adapter／Native取得・回収／Writer／CLI／履歴の本番接続と全体完成は未成立。

修正版の全DI回帰は234/234（26490.6207ms）、失敗・取消・skip 0、Exit0。契約・品質の最終限定再確認はともに全重大度の残指摘0・Pass。これは内部Machineの順序・通知と合成技術境界に限定し、実Adapter／Native取得・join／真正Owner／実Writer／CLI／実修復の成立へ拡張しない。次の接続は、同じNative Sessionを取得から最終回収まで外側runtimeが所有し、準備通知の保存成功前はMachineの処置0、準備拒否・部分取得・取得待ち取消でも同じ子をabort／joinし、最終checkpointのcleanupだけを実回収結果から返す順序である。新たなStore・共有Registry・Lock Frameworkは追加しない。

下位Machine着手前の契約・品質確認を集約した。処置許可と事実記録Ownerを別の同期確認へ分離し、発行後取消でも既発生事実を保持する。意図保存直後だけ同呼出しから発行し、freshの保存済み未確定意図は再発行しない。発行観測と結果の二段保存、保存拒否後の通知0、合法な保守的unknown返却、既存unknown以降の観測・通知・処置0を固定する。追加四処置は既知の初回起動失敗に限定し、Engineの五分類を混同しない。Native取得／回収は後続runtime、Machineは技術順序のみ。Source・Schema拡張や新Store／Lock／Frameworkは追加せず、各九処置の三切断窓・保存拒否・取消・不要と未発行失敗の違いを局所反証する。Source本体・実Adapter接続は未完了。

Machine本体の進捗: DI内部`desktop/repair-machine.ts`へ固定九処置の順序と二段保存を実装し、Rootは非公開のままとした。通常5／限定継続9、九slotそれぞれの意図・発行・結果保存拒否／例外、意図後許可喪失・取消、発行後取消、fresh四形状、明示不要と未発行失敗／不明、保存Owner喪失、Engine五分類と不正通知の4試験が成功（201.8049ms）。Source・試験の型／書式／Lintも成功。新試験を既存`ERB-IT-014`、SymbolとCatalogへ接続した。初回の試験では「明示不要後にEngineがreadyになった肯定経路」まで失敗扱いしていたOracleを訂正し、整形不一致後の結果は最終根拠に使わず、静的三軸成功後に再実行した。実技術Adapter、Native取得／join、実Writer結合、CLIと履歴は未接続で、旧処理置換・全体完成は主張しない。固定候補は独立確認待ち。

実装進捗: 修復専用の一保存Contextを既存Writerへ接続した。Task資格を偽造せず、同じRoot／Kernel排他／元版CAS／読戻しを利用する。初期化後の失敗で発生済みEffectを消す問題と、対象外変更の直接反証不足を両確認者の統合指摘から是正し、限定再レビューは両観点とも全重大度の残指摘0。これは真正Invocationの本番組立てを含まない限定Passである。

その後、専用Session開始候補をDI Root、Coordinatorの値モデル、同じ物理Writerの用途分岐へ接続した。通常更新はconfirmed→pendingを拒否し、専用入口だけが未終端・一次失敗なし・旧回収済みのexact対象についてcleanup以外を変えずに保存する。Root APIと技術checkpointの局所8/8、関連状態／Writer40/40、実Windowsの専用保存・再入場1/1（20368.7469ms）が成功。対象整形／Lint・Source strictは成功し、試験型の一時的な新規1件を是正後、全試験型は既知の旧契約18件だけを保持する。再入場追加後の固定候補は独立再確認前であり、実DI Session取得・真正Invocation・全Machine／CLI／履歴の接続は未完了。自己生成試験Root残存0、Docker操作・Provider要求0。新Store／Lock／永続Session fieldは追加していない。

固定候補の独立確認は契約0件・品質Minor 1件（拒否試験の回収失敗値がSchema外）を検出した。両者へ統合是正を照合し、正規`helper_cleanup_unknown`へ変更、4つの拒否元すべてについて復号成功を先に断言してから専用候補の拒否を確認した。Source／Schema／判定条件は不変更。是正後の当該7/7（333.2703ms）、DIの静的三軸と全227/227（26648.5175ms）が成功。両観点の最終限定再確認は全重大度の残指摘0・Passである。これは値契約と物理Writer用途分岐の区切りであり、Native取得・真正Owner・Machine／CLI／履歴の本番接続および全体完成は未成立。

具体化で、同exact修復の再入場時に「前の補助子は回収済みだが新しい補助子を取得した」状態を通常cleanup単調遷移だけでは記録できないことを確認した。両専門確認を集約し、未終端・一次失敗なし・旧cleanup confirmed／失敗なしの場合だけ、下位の専用Session開始候補（cleanupだけpending、他全文不変）と修復Writerの用途限定分岐で扱う。通常更新の巻戻し拒否は維持し、pending／unknownを新取得で解消しない。中間診断と操作全体の一次終端失敗を分け、再開可能な観測不明は循環運用履歴と技術値へ保持する。新Store・永続世代field・Frameworkは追加しない。この追加具体化も人間判断は不要と確認済みで、Source接続・履歴保存の成立は未完了。

変更分類は採用済み責務分離の実装・接続であり、修復の新機能や新しい回復Frameworkではない。基準は現在の`715d79053d654ac56914d5087126d4170501c4e8`上の作業候補。Source調査と契約・品質の読取り専用確認を集約し、[DIの本番接続契約](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#修復machineの本番接続契約実装未完了)と[Coordinatorの保存Owner契約](../../../06_Architecture/Details/coordinator/01_Architecture.md)へ反映した。現在、人間による追加判断は必要ない。

| 処置対象 | 実施する接続／検証 |
|---|---|
| 保存Owner | 明示CLI呼出し内の私有修復Context。検証Root・現在Revision・内部生成nonce／ID・exact主体／Scope・元版・生存を固定。Root借用や偽TaskでWriterへ入らない。 |
| 既存Writer | `settlements`／初期化資格へ修復variantを限定追加。同じKernel排他・CAS・読戻し・pending確定を再利用。対象外全文を保全。新Store／Lockなし。 |
| 下位Machine | 準備一回、同期厳密true保存gate、通常五処置・起動失敗後追加四処置、三Directory。各Effect前の現在許可と同じNative Sessionを確認。 |
| 終了 | 最終技術checkpoint→release／abortとstdio join→最終返却→同じ保存Ownerでcleanupとoutcomeを別版保存。失敗callback再利用・処理再発行なし。 |
| fresh再入場 | 同じexact ID・主体・Scope・三実体・元版。合法な同pending確定までは技術Effect 0。不明slot再発行、別Root／Revision・別操作への再結合を拒否。 |
| 反証 | 初回／各checkpoint／最終保存拒否、取消、部分取得失敗、通知のthrow／Promise／thenable／再入／重複、Native喪失、解放false／throw、遅延通知、非対象保全。実Root・Kernel・Writer＋DI本体を通し、外部技術Effectだけ差替える。 |

現在の不確実性は、Task前提の初期化・Writerと旧修復Storeを同時に残さず接続できるか、保存途中のfresh確定と失効後の事実記録が現在モデルへ一致するかにある。現状維持は旧AppData／署名／OS依存を残し、別Store新設は採用済み単一現在状態に反するため採らない。同じ物理Writerの判別分岐を選ぶ。Source、Arch、QA、CLIと直接利用側の伝播、独立レビュー・不足影響確認を実施する。準拠基準・新しい公開能力・リリース判断は変更しないため、その採用／公開監査は本接続では追加しない。実Docker再起動の保留、保持物の削除禁止、旧正式Evidence維持、完成後だけCommit／Pushを不変条件とする。上記のSource実装は未完了。

### 修復保存前の同利用者相関 — 2026-10-16

再確認で、時間差Caseの通知待ち無期限と旧候補表示の混在を是正した。試験待機だけ2秒へ有界化し、通知を無効化した本文VMの負対照でもtimeoutを検出して同じ子をabort／joinし、timerを解除する。Productionの期限・判定は不変更。追加負対照の初回はVM間のObject prototype差を`deepStrictEqual`が拒否したため、同じ二fieldの個別assertへ修正した（226件中225成功・1失敗、26254.4622ms）。固定後の時間差3/3（2572.563ms）、DI静的三軸と全226/226（26187.4162ms）が成功。Rust全46成功／0失敗／23明示ignored・CLI7成功も再確認。Native Hashは下段の`736c3cff…`と同じ。契約・品質の最終再確認はともに全重大度の残指摘0で限定Pass。全体のWriter／Machine未接続は維持する。

限定独立確認は契約Moderate 1・品質Moderate 2を検出した。統合是正を両確認者へ照合し、①未リリースRepair Identityだけ`ownerBindingSha256`へ同期（Task／旧記録のSession込み`localUserBindingHash`とは別計算、旧key受理なし）、②最初のframe以後の要求外stdoutを到着時点で失敗にし、H成功後の別イベントによる余分frame／1byteを反証、③UT-037を異なる32byteと独立期待値に変更し、先頭半分反復／逆順を検出する。命令・41byte・Mutex方式・期限・Restart能力・旧Manifestは不変更。

是正後の固定Nativeは377344bytes、SHA-256 `736c3cffc0dbb1d033faab8a0b720b55bc81f14ae148203ed96754492e8e3126`。単一pinとfixtureを同期した。DI静的三軸と全225/225（24397.5645ms）、修復モデル6/6（302.408ms）、Coordinator Source strict／対象format・Lint、PA静的三軸とNode8/8（3221.6414ms）、Rust対象UT1/1・fmt／Clippyが成功。実HostのV/H/Qのみ1/1（1439.4211ms）で同じNativeの読取り・正常終了を確認した。Dockerの起動・停止・再起動・認証は発行していない。更新候補の再レビューは未完了で、Writer／全Machine／実修復／E2EのOPENは変わらない。

以下は是正前候補の履歴であり、当時のHash・件数・確認前の状態を保持する。現在候補の結果は上段を参照する。

真正修復Ownerと同じWriterへの接続前に、既存Native Mutexの選択利用者を上位の修復Identityへ結合する情報が不足していた。Root読取りCapabilityだけをWriter資格へ昇格せず、同じNative子の固定H読取りを追加する。Repairは最新`CRDDDR06`、41byteを維持し、同じrunで捕捉した利用者Hashを既存Mutex名とH payloadへ使用する。IのProcess観測と通常Policy payload、RestartのDS01／H禁止は不変更。初期R→V→Hの後だけ非秘密相関を返す。相関Hashは認可・現在Mutex所有・Writer Authorityではない。

NodeはH一回取得、通常commandとの相関分離、競合write前拒否、timeout／後着／異種frame・取消・stdio失敗を確認する。取得失敗は同じ子の回収へ閉じ、旧05 fallbackや再取得で不明を消さない。Native再Buildは377344bytes、SHA-256 `fb8705be9ba8272177ca70861a42541b88d38c545efbbd02827a983e375ec5ee`。単一bootstrap pinと合成fixtureを同期し、旧署名Manifestは変更しない。

局所結果：DI静的三軸、追加Native境界16/16、DI全223/223（23633.4883ms）、PA静的三軸・Node8/8（3044.7944ms）、Rust46成功／0失敗／23明示ignoredとCLI7成功、台帳25/25（10338.5073ms）が成立した。実HostのV/H/Qだけの正式Caseは1/1（1563.8402ms）成功し、生Hashを出力せず補助子の正常回収を確認。制約環境での同読取りはNativeのL分類で取得不能、実Host条件でのみ取得成立したため、Lから既存Owner存在やDocker故障を断定しない。Dockerの停止・起動・再起動・認証・削除は行っていない。

途中のDI全回帰はNative置換とpin同期が実行中に重なり、221件中219成功・2失敗となった。固定子試験で新旧pin不一致を観測した結果であり、実装不具合の是正・期待値緩和は行わず、同期後の固定候補で再実行して上記223成功を確認した。旧上位修復は63件中60成功・同じ旧3件失敗（3551.9518ms）、全試験型は既知の旧API18件が未解消。ERB-UT-037を追加し、現物再集計は13定義・195設計項目で、Pass件数ではない。限定独立確認はこれから行う。修復専用Writer、DI全Machine、保存前通知、fresh再入場、旧Store／署名経路撤去、実修復と全体E2EはOPEN。

### Task／修復の現在状態分離 — 2026-10-16

現在の限定結果：九処置checkpoint／現在state unionの指摘5件を是正し、契約・品質の独立再確認は残指摘0。Root公開集合の文書1句も実装・公開集合試験・終端契約へ同期した。続く実Hostの停止原因は、私有`completionPending`だけで既存専用Readerを選ぶ修正で解消した。専用Readerでもexact Root／ID・元版全文・Owner・解放確認を保持し、既退役だけWriter 0、active等はWriter 0で拒否する。追加7反例を含む関連60/60（1978.153ms）、修正後の失敗Host Caseだけ1/1（29539.1455ms）が成功し、この限定是正の契約／品質独立確認も残指摘0。旧25件全体の再成功や実Docker成立は主張しない。保持した失敗試験Rootは自作一Commitのfixture・全件非link・対象境界を確認して回収し、不存在確認済み。以下は原因検出時点の経緯であり、継続中・保持中という当時の記載は現在状態ではない。修復専用Writer・全Machine・履歴と全体完成は引き続きOPEN。

後続の実Host保存試験は同じ実行の終了を確認し、25件中24成功・1失敗、Exit1（744657.051ms）。失敗は`completion_pending`の`docker_task_recovery_owner_retirement_unconfirmed`。専用Readerで完了保存のpendingを確認した準備の直後に、旧Owner退役が通常Readerで同じpendingを拒否している。保持した自己生成Repositoryのcurrent／pendingはいずれも最新codecで復号でき、pendingは実完了候補と全文一致した。再実行や新回復機構の追加より先に、退役時のfresh読取りを既存の専用Readerへ接続する限定是正を着手前確認中。残存は`.crdd/tests/current-host-transition-cxN9SZ`の1領域だけで、未確認の清掃や削除は行わない。この実行中に純粋モデルの是正を行ったため、全結果を修正後の固定候補根拠として流用しない。

最新v2のみを受理する判別unionと、DIの固定九処置／三用途Directory checkpointを実装候補へ接続した。Task専用利用側はkindを確認し、同居する修復の全文を保全する。既存Task Writerは修復の新規・変更を拒否し、終端処理による修復除去も禁止する。修復専用Writer・真正Owner・全Machine・履歴／配送の接続は未完了で、この値契約の成立を本番修復の完成にしない。

契約／品質の独立確認で、未観測処置の偽recovered、清掃巻戻し、Task未解決参照への修復混入、終端後の処置／一次失敗変更、Writer拒否guardの未反証を検出した。九処置終端predicate、清掃4×4遷移、kind参照、終端後固定と直接guard／変異Oracleで是正した候補を再確認中。Source strict・対象整形／Lint、DI全206/206（22529.8369ms）、関連62/62（3040.0933ms）が成功。全試験型検査は旧回復APIを前提とする既知18件で失敗し、全体Passとはしない。Windows実Writer試験は同じ実行を継続観測中で、修復反例のVM試験を実Kernel／実保存の根拠にしない。実Docker再起動保留・全体完成後だけCommit／Pushする条件は不変更。

### 修復対象のOS所在観測から旧保存Root依存を外す — 2026-10-16

次の全Machine移管の着手前照合：既存現在モデルはProvider／Home／五資源を必須とするTask専用構造である。Repairへ偽のTask情報を入れない。まず同じ`operations`にTask／実行環境修復の判別unionを設け、最新Schemaの厳格な復号・初期値・遷移と全対象外保全を純粋試験で固定する。上位の判別名・公開契約は環境中立とし、OS選択、Desktop個別phase、任意Path、WSL名・Native Sessionを上位要求へ持ち込まない。DI技術checkpointの閉集合と非秘密相関はDI所有として定義し、上位は保存・元版一致・許可と共通結果を所有する。旧形式の二重Reader、別Store／Lockは作らない。

順序は、現在モデル→同じWriterへの修復専用接続→DI全Machine→本番Rootとfresh再入場→保持判断・履歴／配送→旧Store／署名・互換経路撤去とする。通常停止／退避／起動、起動失敗後のrun→Secrets Engine二退避と一回の再起動、各意図保存・unknown再発行禁止、同じexact ID、取消・一次失敗／cleanup分離を既存Caseから移管先・現在記録・本番Root試験へ対応させてから旧処理を削除する。

既存Nativeは同じ選択利用者のRepair／Restart helper間で共通Mutexをコマンドループ全期間保持することをSourceで照合した。最終の技術Effectとその結果checkpointまで同じSessionを保持し、その後release／abortをjoinしてcleanup結果を別checkpoint／終端判定へ保存する。新共有Lockは不要であり、上位の終端保存までMutexを保持する保証にはしない。Host全利用者・手動操作との排他や、Node Directory renameとMutex確認の原子性は保証しない。現在state Writerの短期Lockを技術操作全期間の排他へ代用しない。実同時取得・異常終了後停止の反証はMachine本番接続の検証へ保持し、Source照合だけで実境界成功を主張しない。

全修復Machineの接続調査で、旧preparedBoundaryが保護RuntimeState RootからLocalAppDataを逆算し、旧AppData Store／署名経路へ依存していることを確認した。現在状態をRepository内へ移す際に、この旧保存Rootを下位へ移植しない。既存APIには等価な所在観測がないため、Platform Accessに固定LocalAppDataの引数なし・読取り専用観測を追加する。Rustの既存SHGetKnownFolderPath取得を再利用し、専用modeと固定frame、Nodeの固定Artifact前後観測・空環境・5秒／有界出力から接続する。任意GUID／利用者／Path選択、環境変数fallback、Root作成・ACL・Authority・新Store／Lockは追加しない。

契約／品質の着手前確認を統合した。返却は呼出しProcessの利用者の所在観測だけで、意図した利用者との一致、Directory Identity、排他、修復許可を証明しない。DIが後続の現在Owner確認と組み合わせ、上位へOS Pathを公開しない。既存System Directory protocolとLauncher環境を変更せず、固定Native再Build後のHash・配布metadata・既存利用側を同じ候補へ同期する。合成境界、Rustの実OS観測、配布Nativeからの実読取りを区別し、protocol／書込み失敗・余分argv・前後Artifact差・Pathのlink／file／realpath不明等を反証する。全Machine接続・現在state化・旧経路撤去は別途未完了として保持し、本読取り追加を全体完成としない。

限定結果：配布Nativeは377344bytes、最終再BuildのSHA-256 `45a9f6d0e330b2db8280356f893f71f1dfacace9ac40f9cb430a24ef205dca6d`へ更新し、旧署名Manifestは変更しない。Platform Accessの静的三軸と最終NativeによるNode8/8（3023.6494ms）、Cargo fmt／Clippy、Rust通常45成功・0失敗・23明示ignoredとCLI7成功・0失敗、台帳25/25（14630.4786ms）が成立した。合成35条件と実配布Nativeの新旧所在観測を区別する。Nodeの読取り観測成功を実利用者一致、修復許可や全Machine完成の証明にしない。

独立確認では、現行Process検査への未登録、実OS CaseのUT分類、frame値境界の旧Local Item流用を検出した。既存検査内の固定argv・結果結合・Artifact由来・関数本文Hashを新旧両所在入口へ同期し、余分argv・Hash迂回・結果結合・timeout変更・未知Ownerを本番検査で拒否する追加Caseが1/1成功（252.6964ms）。実OS CaseはUTから外しCLI／Node ITへ保持し、純粋frameは新`ERB-UT-035`へ接続した。一次導出元・条件表・項目・Symbol・現行件数193を同期し、旧履歴値は時点限定して保持する。最大正常frameの用途magic・LE長・全本文を独立assertし、同長の誤magic／本文の一時変異はそれぞれ新assertで失敗、復元前後Hash一致と正常再成功を確認した。整形後Source SHA-256は`8ae7bd019c3f7e6e4a147ebf00e2cacbd4cff26be63798336e39d5075261454c`。契約／品質の最終限定再確認は全重大度の残指摘0・限定Passである。

広い配布Filesystem回帰（`node --test --test-concurrency=1 40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`）は同じ実行の終了を確認し、Exit1で不合格。新しい所在観測Caseは成功したが、旧restart-machine／Native Source参照、移管先のProcess閉包未追従と、それを前提にした候補fixture等が失敗した。出力が大きく返却上限で省略されたため総成功／失敗件数はここで断定しない。試験の途中に`as const`だけを付けた型修正を行ったため、この結果を最終候補全文の新規検証根拠にせず、残件検出として扱う。再実行より先に検出済みの原因境界を是正する。

別の読取り全数確認では、Coordinator／DI／PAの`src`配下で`node:child_process`を直接importする23 Sourceを既存本番静的検査へ個別入力し、7 Sourceが拒否された。対象はDIの`cleanup/recovery-executor.ts`、`desktop/backend-state.ts`、`desktop/engine-state.ts`、`desktop/native-process-lifecycle.ts`、`desktop/native-process.ts`、`desktop/restart-machine.ts`、`execution/attached-process.ts`である。この23母集団は以前のProcess閉包8件と同じ集計ではないため増減へ換算しない。旧契約の試験型18件、全Machine・現在state union・旧署名／履歴経路撤去、実Docker修復と全体E2Eも引き続きOPEN。今回の局所確認は準拠基準・公開採用を変えないため準拠監査非該当、対象の文書／関係伝播は上記限定契約・品質確認に含めた。Docker再起動・Provider依頼・認証情報使用・実退避は行っていない。

### Desktop修復のHost操作実体の移管 — 2026-10-15

既存修復の公式停止、固定Docker backend停止、初回run退避、失敗起動後のrun／Secrets Engine退避の実体をDocker Isolationの既存desktop Moduleへ移す。CoordinatorのPreparedBoundary・操作記録・署名履歴型は下位へ移さず、上位の意図保存→fresh境界／取消確認→技術処置→結果保存・ledger反映を維持する。停止結果はEngine停止完了と同一視しない。

退避先は下位がlocalAppData・32桁操作ID・固定用途から導出し、任意source／target操作APIを作らない。非Windows、不正Path、Proxy／Accessor、Identity不一致、link／file、観測不能は処置しない。初回runは元Identity一致を先に要求し、同Identityの退避先既存を未発行retainedとする。Continuationでは同Identityの退避先既存でもunknownを保持する。成功にはrename後の退避先実体一致と元不存在の両方が必要である。

四接続はCoordinatorからDIのprivate Sourceへdeep importする、Root非公開の暫定cross-package接続であり、最終Package境界は未成立である。全Machine移管時にDI内部privateへ閉じ、Root公開集合は増やさない。WSL単独公開を全Machine移管まで保留する方針を維持し、固定停止実体だけを下位へ移す。新State・Lock・Store・Framework、互換Reader、保持物の削除は追加しない。移管前のDI静的3軸は成功、既存repair回帰は62件中59件成功・既知の同3件失敗を確認した。実Host操作は行わず、下位の固定引数・分類・前後観測反証と上位同一回帰、固定候補の契約／品質独立確認を行う。全修復Machine・現在state化・旧署名／履歴経路の撤去と実境界は引き続きOPEN。本単位は標準規範・準拠基準を変えないため準拠監査非該当、追加人間判断不要。

初回候補の反証: 下位通常200件と台帳25件は成功したが、独立確認でPath字句条件、退避後親観測の反証、暫定cross-package接続の表現、二Local Itemの境界記載の計4点を検出した。両確認者へ統合した是正方針を再提示して整合後、既存上位と同じ字句受理集合へprivate guardを揃え、不正PathのFS0と上位predicateとのparityを確認した。親の退避後変更／観測不能を三用途で追加し、当該条件を除いたメモリ変異を同Oracleが拒否することを確認した。Root非公開と最終Package境界未成立を明記し、Trace／境界も補完した。修正版の局所6/6（221.1677ms）とDI静的3軸・上位Source strictは成功。上位修復は63件中60件成功・基準と同じ旧3件失敗（4962.2303ms）であり、全体Passではない。全試験型も旧契約18指摘を保持する。台帳横断で先行の実junction CaseのWindows実行Profile登録漏れを検出し、実Sourceの用途へ合わせて既存二Profileを付与、25/25成功（10067.4906ms）を確認した。実Docker・WSL停止・実退避・Provider要求は行っていない。

修正版のDI通常回帰は201/201成功（23165.6661ms）、失敗・取消・skip0、Exit0。契約／品質の固定候補再確認は全重大度の残指摘0・限定Pass。差分空白検査と、上位修復試験の自己生成領域残存0も確認した。実修復・全Machine・現在state化・旧署名／履歴経路の撤去、既知上位3失敗・旧型18件、実境界とPackage全体完成は未成立であり、今回の限定Passへ含めない。Commit／Pushは全体完成後の条件を維持する。

### 現在回収Ownerの退役保存接続 — 2026-10-15

異常終了時に`ownerEffect=active|unknown`が残ると、現在回収Driverは三排他取得後も退役を保存せず、後段のHost不存在遷移で停止する。契約・品質の着手前確認を統合し、既存の私有準備・lifecycle Writerで旧Ownerの新規要求不能を保存する。候補は元操作からphaseの`executing→settling`と`execution.ownerEffect→disabled`だけを内部構築し、他の評価・資源・一次失敗・結果・履歴・他操作を維持する。後期状態の巻戻しは拒否し、既にdisabledならfresh全文・世代・全排他を再確認して書込み0とする。

Driverは準備・取消確認、退役保存と読戻し、再度の取消確認、既存DI回収の順とする。保存不明後は後段処置0で停止し、保存済み退役は取消で戻さない。新Schema・Store・Lock・公開API・Frameworkは追加しない。これは孤立CLIの終了、遅延createの無害化、資源不存在やunknown限定終了を証明せず、それらはOPENに保持する。実Docker／Provider要求・再起動は行わず、Source型・対象静的検査・正常と境界反証・固定候補の契約／品質独立確認を実施する。標準規範・準拠基準を変えないため本単位の準拠監査は非該当、追加人間判断は不要。

限定結果: 私有helperとDriver順序を接続し、21条件のOwner／Writer／読戻し反証、退役拒否・退役後取消を含む局所23件が成功した。関連5Fileは66/66成功（941.8455ms）、失敗・取消・skip0。Source strictと対象3Fileの整形／Lintは成功、全試験型は旧回復契約18指摘だけを保持し新規指摘0。実Filesystem試験の初回はsandboxのhardlink EPERMで新箇所未到達、用途限定実行の次回は新2例通過後に起動option不足で既存module mock箇所が停止した。正しい既存Host profileのoptionで再実行した同一候補は1/1成功（133285.6753ms）、Exit0・失敗／取消／skip0。active／unknown各実Driver退役保存後取消でrevision・previous・Hash・非対象全文保持を確認し、実行後の自己生成Root残存0を確認した。契約／品質の限定独立確認は全重大度の残指摘0・Pass。実Docker／Provider／再起動、孤立CLI・遅延create・unknown限定終了とPackage全体完成は未成立であり、Commit／Pushは未実施。

### 認証作成結果不明の限定終了：再起動前後の保存順序 — 2026-10-15

切断子の補正後確認（2026-10-16）: 固定候補AB09F7D...の静的三軸後、通常host_started→fresh回復1/1（65537.7328ms、失敗／取消／skip0）が成功した。専用Root外の起動拒否も再確認し、Root作成0・既存Coordinator本文不変、自己生成Host試験Root残存0である。これは通常modeへの影響確認と安全な入口拒否だけで、auth専用のcreate前後例外・packet欠測の処置や実Docker成功を証明しない。親統括と故障確認を次の必須作業とし、実操作不可を維持する。

切断子の限定レビュー（2026-10-16、実操作不可を維持）: 通常producerへの影響確認1/1（66112.5235ms、失敗／取消／skip0）と自己生成Root残存0を得た。契約レビューの一件は、create後のinspect／unknown保存／packet失敗・timeoutを、親がEffect不明として保持・再発見できる経路の未実装であり、実操作前のOPENとして保持する。品質レビューの一件は真正Capabilityを外側finallyへ搬送していない点で、ready直後に保持するよう補正した。packetのReceipt／Provider開始値もsavedUnknownの同exact操作から導出し、未登録・未開始／未送信／共有書込み未発行を実値で断言した。補正後strict・整形／Lint成功、固定fixture SHA256 `ab09f7dbe88601c98fac5e6e54bf95aa8991d6405c66b25dcfbe8fae28fe3cbb`。通常例外の故障代役による解放確認と、親統括のbaseline・同ID一回再起動・packet欠測時の既存identity照合・保持／回収は未完了で、レビュー指摘を全解消や実境界Passへ読み替えない。親は保存済みname／Label／Imageだけを削除許可にせず、現在Owner・元版・exact構成とbaselineを再検証し、複数候補・観測不能・他資源差では削除／再起動せず同IDとRootを保持する。追加sidecar、共有State、Store／Lockは作らない。

実測用切断子の候補実装（2026-10-16）: 既存試験子に通常回帰から呼ばない`auth_create_unknown`を追加した。自己生成Git Rootを`CRDD/.crdd/tests/auth-create-closure`へexact固定し、canonical差・link・親Repository代用を拒否する。通常Taskと同じ`planDockerIsolationCommands`が生成する`create_subscription_auth_probe`だけを採用し、authentication専用Labelの別生成器やargv手書きへ置換しない。固定Image、空の読取り専用Home、network none・read-only・non-root・cap-drop・no-new-privileges・pids32・Workspaceなしを独立に照合する。真正intent Writerのstatus／snapshot／解放とfresh読戻しをcreate前に確認し、同期CLIの作成成功・ID・inspect構成・created状態を正対照とした後、Receipt未登録のまま実Writerでunknownを保存し、全文読戻し後に切断する。spawnSyncは当該同期CLIの終了だけを確認し、取得済みhandle・子孫tree／孤立CLI・daemon queueの終端証明とは表示しない。これは試験準備が既存Writerで作る切断で、本番Controllerのunknown自動保存の成立根拠ではない。Source／全試験strict・整形／Lint成功、承認Root外の起動はfixture作成前に拒否し既存Coordinator本文不変を確認した。通常producerの影響確認中。全資源baseline・一回の本番再起動・DI発見IDの削除前保存・二回不存在と回収を統括する実測側は未完了であり、この候補はまだ実Dockerへ発行していない。承認された一回の再起動は未使用のままである。

2026-10-16の人間判断: `.crdd/tests/auth-create-closure/`と既存固定Image・自己生成Containerだけを使う限定試験、および同試験に結合した検証付きDocker再起動一回が承認された。認証情報・Repository内容・外部AIは使わず、既存コンテナ／Image／Volume等の永続データを削除しない。他のDocker作業を検出した場合は停止する。一般の再起動保留を解除する判断ではなく、実行前の現在状態再確認・試験設計・回収確認を必要とし、現時点では未実施である。以下の回答前保留表示は先行時点の記録として区別する。 承認後の用途限定読取りでもLocal Engineは29.8.1、全コンテナ状態一覧はexited一件だった。通常制限下のAPI接続拒否と区別し、作成・削除・再起動要求は発行していない。この一時点の観測を実試験開始時の競合不存在証明へ流用しない。

2026-10-16の承認後準備: DIの整形・Source型・Lintは成功し、再起動Runtime／Machineの既存契約試験は63/63成功（263.7048ms）、失敗・取消・skipは0だった。これは実Docker再起動の根拠ではない。契約・品質の読取り照合を統合し、限定試験の順序を次へ固定した。実試験は未実施で、一回の再起動許可は未使用である。

| 順序 | 実施内容と判定 |
|---|---|
| 1 | 明示したLocal endpoint・固定Image、空の試験Homeの読取り専用mount・network none・Workspaceなしを照合する。既存Container／Image／Volumeの基準観測を保持し、別のDocker作業を検出したら停止する。 |
| 2 | 自己生成Containerの実create受付・実ID・inspectを正対照として確認し、上位へのReceiptだけを欠測させる。Daemon内部の未完了要求を再現したとは扱わない。 |
| 3 | 所有する旧CLIの取得済みProcess handle、終了・stdio終端と子Process回収を確認する。PID不存在やkill要求だけで代用しない。 |
| 4 | 同exact回復IDの本番入口`restartRuntimeOwnedDockerForRecovery`からDIへ一度だけ委譲する。発行前保存、受付、終端、Native回収、通知と外側排他解放を個別に読戻す。不明時は再発行しない。 |
| 5 | 受付済みの停止Containerは再起動で消えると期待しない。再起動後にexact IDと名前・Label・Image・隔離構成をfresh照合し、既存回収経路で自作exact IDだけを一回回収する。予期せぬ消失は正対照不成立として停止する。 |
| 6 | 回収後にID・完全一致名・名前＋Labelの不存在を、明記した間隔・観測期間でfresh二回確認する。自作Process／一時領域不存在と既存資源不変を確認する。残存の正対照、一覧失敗、Owner失効の拒否は既存差替え試験と対応させる。 |

この実測で評価するのは、既知受付済み資源についてのReceipt欠測後の発見・回収と、限定した観測期間内の不存在である。Daemon内の遅延queue、将来の遅延create／start不存在、他版での一般成立、Task成功や次Attemptの許可へ拡張しない。本番unknown限定終了は有効化せず、未実測範囲はOPENのまま保持する。新しいStore・Lock・Registry・Frameworkは追加しない。

2026-10-16の実接続前照合: 現在の真正回収OwnerはRoot／Revision・exact ID・Host世代と既存三排他、退役保存を確認できるが、旧Docker CLIや遅延要求の終端を保存値だけから証明できない。DIの`observeAbsent`は名前／名前＋Labelの二軸観測であり、二回のfresh観測や将来の要求到達不能を意味しない。契約・品質の読取り専用確認も同じ結論である。generic cleanup・資源単体終端の緩和や、未観測の終端をtrueにした本番接続は行わない。

次の実装接続点は、①authだけunknown・他四資源通常終端・Provider未開始／送信と共有書込み未発行・旧Owner disabled・旧領域非再利用・同exact再起動の共同条件、②既存DI観測の前後でOwner／全文を再確認する専用候補保存、③Host／終端／履歴／配送／completion／次操作受付の同じ操作全体判定、である。Schema field・Store・Lock・Frameworkを増やさず、元request unknown・一次失敗・対象外全文を保持する。ただし、孤立CLI・既受理daemon要求・後発startの終端を実証するまで、これらを本番の終了許可として有効化しない。仮の真偽値を与えた試験だけで完成扱いしない。

同日の読み取り専用確認では、明示したLocal Linux Engine pipeへDocker APIが応答し、Server Versionは29.8.1、コンテナ状態一覧はexited一件だった。制限環境からの接続拒否と、用途限定の読み取りで得たAPI応答を区別する。これはTask資源の不存在や遅延要求終端の根拠ではない。固定ベースImageの既存配置だけを読み取り、pull／create／start／stop／restart／rm／Provider依頼は発行していない。限定実境界試験は、既存固定Image、`.crdd/tests/auth-create-closure/`と自己生成Containerだけを使い、一度の検証付き再起動・既存永続データ非削除・試験物回収に範囲を限定して人間へ確認した。再起動保留を解除する回答までは実行しない。

現在の再起動requestId／Scopeは同じRepository・操作を結ぶが、認証作成結果が不明になった後で再起動したという順序を証明しない。既存absence Hashも実観測・順序の代替ではない。着手前の契約／品質確認を統合し、まず既存遷移検査へ順序不変条件を追加する。再起動checkpointの初期化と同じ更新では資源配列全体を変更せず、初期化後は差分のある要求を`intent_saved`・`issued`・`unknown`へ新たに進めない。同値保持、実発見による`unknown|issued→identified`、真正な未発行判定、既知IDの通常回収は維持する。作成意図のunknown化は初期化前の独立更新で行う。

対象は既存保存モデル・純粋試験・直接正本の整合であり、新しいfield、Store、Lock、Framework、再起動操作は追加しない。汎用再起動を認証専用へ制限せず、全五用途の順序を確認する。認証unknown専用の実観測・Writer・遅延要求排除・共通の操作終端判定と全利用側は後続であり、generic cleanupと資源単体の終端条件は緩めない。実Docker再起動は引き続き保留。保存順序の成功を限定終了・旧Owner停止・実資源不存在・実再起動・Package完成へ昇格しない。既存Source型・保存モデル全試験、前提を一つずつ破る反証と固定候補の契約／品質独立確認を行う。標準規範・準拠基準は変更しないため、この単位の準拠監査は非該当、追加人間判断は不要。

限定結果: 既存遷移へ二条件を実装し、全五用途の禁止五遷移を初期化前・後・同時更新で反証した。同値保持、unknown正規化後の初期化、実ID発見、通常回収、request同値の観測変更と初期化の混在も確認した。保存モデル2Fileは7/7成功。関連回帰の初回13失敗は先行の非同期公開関数を試験Source抽出が扱えないSyntaxErrorであり、抽出時の`export async`処置だけを追従した。修正版4Fileは43/43成功（649.7625ms）、失敗・取消・skip0、Exit0。Source strict・対象3Fileの整形／Lint・差分空白検査は成功。整形時の一時的なOS1224は再実行で解消した。全試験型は旧回復契約の18指摘を保持し、新しい型指摘は0。契約／品質の限定独立確認は残指摘0・Pass。限定終了の実接続と全体完成を意味しない。

### Runtime資産の責務別移管 — 2026-10-15

Coordinatorの旧`runtime/`全12資産を、Docker Isolationの隔離資産6件、AI AdapterのProvider設定・出力Schema5件、Coordinatorの試験fixture1件へ移す。既存内容、改行、byte数、SHA-256、Image digest、Provider版、Container内Path、COPY basenameとmodeは変更しない。過去Evidenceと通信契約の文字列は改名対象ではない。

着手前の契約・品質照合で、兄弟Packageの`src/`だけを集める配布処理では11資産が欠落することを確認した。配布集合へ固定11Pathを明示し、任意の`runtime/**`や`tests/**`を含めない。ビルド入力はDockerfile所在Directoryと同一視せず、公式実行物と各Ownerの設定を既存basenameで組み合わせる。既存の助言Image準備入口はレシピ取得先だけを変更する。seccompは既存の単一ResolverとAI Adapter宣言のPath一致を確認する。

初期比較は実資産のraw bytesを基準とし、移動後12件の完全一致、旧Path参照、固定配布集合、DockerfileのCOPY入力、Claude／Codex計画、通信制限、固定textと署名検証Toolの直接利用側を確認する。移動は互換複製を残さず、空の旧Directoryを除く。固定候補の契約・品質独立確認を行う。実Docker Build・認証・Provider依頼・再起動は行わず、実Image再検証やPackage全体完成を主張しない。新たなFramework・権限・公開Surfaceを追加しない内部配置変更であり、追加人間判断は不要。標準準拠条件を変えないため、この単位だけの準拠監査は非該当。

限定結果: 全12件をraw checkoutのbyte数・SHA-256一致で移動し、旧Directoryを除去した。独立確認の3原因（固定textの直接試験参照、宣言だけに留まった配布収集Oracle、AI Adapter正本との版・Path相関）を一括是正した。本番の収集・安定読取り・metadata検査を用いたread-only試験で固定11資産・2Owner metadata・通常試験物の除外を確認し、資産欠測・metadata欠測・pending除去を固有理由で拒否した。配布用canonical bytesの判定と、移動時raw bytes不変の判定は分ける。Provider宣言との相関・片側変異の拒否と、実prepare本体による助言contextの三入力bytes搬送も確認した。後者のbinary依存は仮値であり公式binary検証の根拠ではない。

2026-10-15、Node v24.19.0。新5Caseは5/5成功（880.5313ms）、関連7File回帰は111/111成功（52018.9657ms）、失敗・取消・skip0、Exit0。最終参照確認でTask Packet試験の旧Path正規表現1箇所も追従し、追加11CaseがRepository-local専用TMP／TEMPで11/11成功（2031.9884ms）。初回のOS一時領域における旧Host記録renameのEPERMは成功値へ混ぜず、保存先を限定した再実行と区別した。専用Rootは試験終了後に削除・不存在を確認した。Source strict・対象試験型・対象整形／Lint・差分空白確認は成功。契約／品質の限定最終独立再確認は全重大度残指摘0・Pass。既知の全配布graph拒否`child_process_unbound`、修復Machine・旧署名依存の残存、新経路の実Docker・全体E2Eは未完了で、この資産移管の成功へ含めない。実Docker／Provider／Build・再起動・Commit／Pushは行っていない。

### 今回の区切りと後続E2E — 2026-10-14

最終候補`635ce3f9e080768572116b0b4923e828b61ca291`の対象回帰は480成功・失敗0、人間UAT1件Skipで終了した。Source／契約と結果同期の最終限定独立確認は残指摘0、AM17義務は確認済み13・部分確認2・人間UAT未実施2である。今回の区切りは成立し、コミット・プッシュ後に計画済みのDocker周りの責務分離へ進む。初回実Hostと人間理解を後続E2Eへ保持し、CHG全体／正式191／v0.22全体の完成と区別する。詳細は[集約検証結果](Evidence/261014_access-management-verification.md)を参照する。

人間の判断により、初回設定・鍵操作の実入口縦断と、人間が操作の意味を理解できるかの確認は後続E2Eへ回す。`RFD-ST-016`／`RFD-ST-026`の未確認の実入口範囲、`RFD-UAT-007`／`RFD-UAT-027`の人間確認をPassへ変更しない。既存の局所試験が証明する範囲は保持し、未確認範囲を正式評価と現在投影へ明記する。

今回の区切りは、それ以外の是正、検証義務と実行根拠の対応、現在文書・Reality Auditの整合、固定候補の回帰、独立レビューと指摘是正までとする。この区切りが成立したらコミット・プッシュし、その後に計画済みのOrchestrator／Coordinator／Dockerの責務分離・大改修へ進む。これはAccess Managementの全検証完了、v0.22全体完成またはリリース承認ではない。後続E2Eの未実施義務は削除・免除せず保持する。

固定候補の回帰終了後、QA義務の独立照合で試験不足を検出した。是正は既存試験への反例追加に限定し、時間経過のみの同一内容要求、登録解除と既開始読取りの終了の分離、Browser管理三操作・manager自己内容変更後の再認可、失効／旧Role／Exposure外／管理のみ／実体不明のBrowser拒否を補う。製品Source、Time・Registry・Recovery Frameworkは追加しない。局所確認を先に行い、義務対応の独立再確認後に新しい固定候補の回帰へ戻す。実行結果と途中失敗の原因は[集約検証結果](Evidence/261014_access-management-verification.md)にまとめ、実行別書庫を作らない。

2026-10-14の人間承認：認可集合・Repository実体が不明なら全体停止を維持し、認可済み文書の欠落・競合は状態を明示して読めた分を表示する。要求・QAの部分可視契約へ詳細Readerと本番Consumerを揃える。承認はこの表示・停止の区別に限定し、新しい認可・保存・回復Frameworkを追加する許可とは扱わない。

#### 区切り後の現在地と後続E2Eの再開条件 — 2026-10-14

今回の限定区切りはCommit `10e347511a275f7b31d1eec8b77cfd0cb2034124`、Tree `44e999ae9fa7b7d6f8da3e17da6430106ff8e47a`として`codex/feature/v0.22`へPush済み。対象Source／Testは検証候補のPackage Treeと一致する。以降、実行系の順序9〜11へ進むが、Access Managementの未実施確認を完了扱いにしない。

| 後続項目 | 再開時に確認すること | 完了を証明する根拠 |
|---|---|---|
| `RFD-ST-016`の実Host断面 | Workbench指定／全員、Host指定／全員の実入口で、対象・影響・必要な確認と一度提示を観測する。通常鍵発行／独立失効との分担を維持 | 実TTY／実HTTPの非秘密の相関・回数・保存前後・終了状態。模擬callbackや人間の閲覧申告で資源回収を代替しない |
| `RFD-ST-026`の実Host初回縦断 | Host表示名入力と明示開始→一度提示→MCP限定discoverまたはWorkbench専用connect→確認保存終了→次要求の通常接続 | 固定実入口での段階・応答順・通常Authority発行時点・所有資源の終了。初回途中を通常成功にしない |
| `RFD-UAT-007`のAM断面 | 人間がUser／表示名／Role／鍵、管理と内容許可、登録と公開、解除と削除、失敗時の次行動を区別できるか確認 | 人間の実操作、達成・選択理由・理解できない点。自動試験をUATへ流用せず、同Local Itemの他工程由来の義務も免除しない |
| `RFD-UAT-027` | 人間が初回設定から接続へ進み、既存・途中・不明を区別して次行動を選べるか確認 | 人間の実操作と理解確認。サービス側出力成立を本人受領保証へ強めない |

実行時は、その時点の公開入口・版と状態保存先を再確認し、影響するRoot、鍵交換範囲、秘密の取扱いと清掃を具体的に示す。現在の実資格・既存状態を、試験のために無断初期化・交換・削除しない。秘密値をChat、ログ、Evidenceへ複製しない。Dockerの大改修自体はこれらの合格根拠ではなく、逆に未実施UATを理由に新しいDocker回復機構を追加しない。

#### Portfolio部分表示の着手前整合と実装範囲

以下は切替候補の実施時点の照合記録である。当時のHEAD・未Commit・未完了表示は現在の状態へ流用せず、現在地は前節と集約検証結果を参照する。

変更分類は、承認済み要求を実現する詳細設計・結果契約・Consumerの是正。意味OwnerはDomain、認可・登録実体はAM、表示はWorkbench、Machine搬送はMCP。現在HEADは`378d93cb6ffb0cc7c9561e0572d62bdd656f3312`の未Commit候補で、過去の正式Evidenceは変更しない。

| 条件 | 結果・観測 | 変更しない境界 |
|---|---|---|
| 認可集合が不明、資格不成立、Repository実体不明、取消 | 一覧全体を固定拒否。内容・存在情報を部分公開しない | 現在AM認可、Root検証、公開前再確認、既存descriptor清掃 |
| 認可済みRoot、本文と三Identityが一致 | Sourceはcomplete、本文相関revisionを保持 | 文書を正本化せず、元Artifactへ追跡 |
| 認可済みRoot、本文が取得・解析できない | Sourceはunavailable（未確認）、context／Role／revisionはnull、Projectはpartial | 既存Observerは不存在と観測不能を区別する結果型を持たないため、missingと断定しない |
| 認可済みRoot、取得した文書のProject／Repository／Roleが不一致 | Sourceはconflicting（競合）、外国のIdentity・本文・版を公開せずnull | 宣言Identityは認可済みmanifestからのみ取得 |
| 既存の中立Snapshotが明示的に文書未提供 | Sourceのmissingは維持 | Filesystem不存在証明へ読み替えない |
| 正常・未確認・競合の混在 | 正常Sourceを表示し、各不完全状態を併記。競合優先、全Source completeの場合だけProject complete | 未許可Sourceの枠や期待Repositoryを推測しない |

Readerは技術的Rootの不成立を文書未確認へ畳まず、既存Version ControlのRoot再観測を使う。中立Sourceには読取り状態を明示し、取得できない本文の版はnullにする。既存の状態・結果型を拡張するだけで、新しいStore／Registry／Lock／診断Directoryは作らない。

利用側母集団はDomainの純粋集約・Reader、AMの集合→Domain結合試験、MCPの公開内容Tool、Workbenchの本番Reader／JSON Inspector／Portfolio描画、各Symbol／QA対応である。Domainで認可しない。Workbenchの既存全集合公開前照合は維持し、MCPも公開時の現在集合を照合する。既存の比較処理を使えるか所有者とConsumerを照合し、新しい汎用認可Frameworkへ一般化しない。

局所反例は、正常＋本文欠落、正常＋解析不正、正常＋三Identity競合、本文不成立とRoot不成立の区別、取得中の公開解除・失効・取消、未許可Source非開示、null版と完全集合状態の相関、Browserの読めた情報と未確認／競合表示である。変更した意味からDomain／AM／MCP／Workbenchの静的確認・局所試験・全回帰、限定独立レビュー、文書・直接伝播とGap影響照合を実施する。標準の準拠基準を変更しないため準拠監査、外部送信・署名・実Host操作を変更しないため署名Provider E2Eはここでは実行しない。後続E2Eの既承認残件は維持する。

今回の局所確認：WorkbenchのBuild成功後、`node --test --test-concurrency=1 ./tests/integration/*.test.ts ./tests/system/credential-administration-browser.contract.test.ts ./tests/system/workbench-server-entry.integration.test.ts`を実行し、78 Case成功・失敗／取消／Skip 0、Exit 0、415091.5923ms。実Browser11場面と公開CLIを含む。Node v24.19.0、HEAD `378d93cb6ffb0cc7c9561e0572d62bdd656f3312`の未Commit候補であり、実行前の完全な入力固定を取得していないため正式Local Item全体の新Passへ流用しない。制限環境の先行実行は子Gitを利用できずExit 1、制限外の同コマンドで該当箇所を通過した。実Host資格・Docker・外部AIを使わず、自己生成Rootとloopbackを使用した。

Header是正7ファイルは今回候補へ反映済み。Workbench／MCPの三つのparameterized試験で既存Headerをループ内の個別Test直前へ移し、公開CLIとAMのNamed Helperへ実責務・観測・清掃のHeaderを追加した。Workbench管理ITのCRUD・公開失敗・入力拒否の既存観測へ個別Case Traceを接続した。処理・Oracleは不変更。全数接続検査はこれらを越えてCoordinatorの`native-protection-entry`にSymbol登録がないことを検出し、まだ合格していない。限定独立レビューの記述2指摘を是正し、再レビューPass・全重大度残指摘0。AM対象8 Case（19322.8761ms）、MCPの結果fixture・公開HTTP21 Case（22165.4298ms）、Workbench公開CLI8 Case（14633.1978ms）の局所再回帰は全成功・失敗／取消／Skip 0・Exit 0。AM／MCP／Workbenchの書式・型・Lintも全Exit 0。現在Ownerリンク2箇所とCLI名の是正は限定独立再レビューPass・残指摘0、履歴blob実在確認と過去Evidence差分0を確認した。完全出力は端末で確認し、同じ対象試験とNode test-name-patternから再生成できるため実行別書庫は追加しない。正式義務全体の評価と固定候補全体のレビューは別途残る。

### 現在の完了順序 — 2026-10-13

現在：①〜④は限定完了、⑤共有配置・旧CROS撤廃は進行中、⑥全体整合は未完了。実TLSを含むWorkbench公開CLI8/8（15184.105ms）とMCP公開CLI System18/18（20355.4239ms）、各静的3軸が成功し、両試験の限定独立再確認Pass・残指摘0。公開試験証明書の明示CA検証、未信頼拒否、Forwarded上書き、初回接続・現在認証・manager Profile操作・失効後拒否、所有終端・Process・試験Root回収を確認した。Workbench終端の終了観測保留中のfresh接続拒否、Backend要求一件維持も確認済み。MCP試験本文上限の独立指摘はBufferバイト数計測へ是正した。共有利用全体の反証、旧CROS撤去後の全体品質整合、正式191項目・Reality Audit・全体回帰は残る。実運用Proxy・Linux配置・実OS Signalの成立は主張しない。現在追加の人間判断はない。 旧MCP Shared Host／Resolver・専用入口の撤去はMCP86/86・静的3軸成功と限定独立再確認Pass・残指摘0で閉じた。過去のGateway Evidenceと正式191項目Not Runは保持し、全体完成とは区別する。 2026-10-14：旧CROS Package・REST library全撤去は能力対応と限定独立確認Pass・残指摘0で閉じた。AM152/152・MCP86/86・Runner44 Pass／人間UAT1 Skip、台帳0指摘、AM8file収集を確認。Coordinator製品Source型は成功、Docker持越し試験18型不一致は別件として保持する。

### 旧CROS Package全撤去の着手前確認 — 2026-10-14

結果：旧CROS Package撤去の限定Gateは完了。基準HEAD比33 Path（先行撤去込み）を削除し、Package Directory不存在、現行Source／入口／Symbol／Catalog／Runner／配布／VC集合の旧Package参照0を確認した。Host管理情報・論理CROS名・過去Evidenceは不変更。配布SiblingはAMへ、署名fixtureの物理MCP Directoryは`mcp-server`へ同期し、Package名は維持した。未署名fixtureはAM存在・CROS不存在・help終了・回収成功、開発版配布閉包1/1（21628.8746ms）、descriptor1/1（383.5193ms）成功。AM152/152（211237.8868ms）、MCP86/86（105158.7407ms）、Runner44 Pass・人間UAT1 Skip・Fail0（14438.7349ms）、VC Consumer12/12（1665.2209ms）成功。AM／MCP／WB／Runner／Checker静的検査とVC型、Coordinator製品Source単独型は成功。Checker Lint54 infosは保持し、Coordinator全checkは持越しDocker試験18型不一致で未合格として分離する。文書の現在／履歴と削除先リンクを是正し、旧Gitリンク24件は実在確認済み（現行名は`378d93cb…`、改名前は`b8fad534…`）。限定独立再確認Pass・全重大度残指摘0。正式191項目、全体Checker、共有利用全体の残る評価、⑥とAM全体完成は未完了を維持する。

対象は⑤の承認済みPackage撤去と既存利用側の接続閉包である。CROS全体概念は維持する。旧Source・試験・署名済みEvidenceは基準Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` とGit履歴で再構成し、歴史的Evidence本文・Hashを改変しない。現行外部Productionから旧`cros/src`のimportは0件で、残存は配布・試験収集・fixture・台帳の旧Owner参照である。新Framework、Host管理状態の移行、鍵操作、Docker／Provider／署名操作は本単位で行わない。

| 残存責務 | 新Ownerと予定処置 | 必要な反証・終了条件 |
| --- | --- | --- |
| Credential・認証・登録・Exposure・旧回復 | Access Management。旧Role固定資格・full reset・手編集共有設定は新契約へ移植しない | 現在User／Role・失効・管理操作・限定Host交換を既存試験へ対応し、未対応能力を撤去済みとしない |
| Portfolio／Repository意味 | Domain Model＋AMの認可集合。旧Registry由来の集約は撤去 | 認可集合外本文0、欠測の非開示、実本文とSource改訂の相関 |
| Profile／Activity | AI Adapter／Orchestrator。MCPとWorkbenchが直接利用 | 現在認可・実保存・取消後待機の既存本番接続を保持 |
| REST・旧CLI・共有設定 | 旧Packageとともに撤去。現在MCP／Workbench公開入口・可視設定例を維持 | 第三Surface・旧Fallback・死んだ入口が残らない |
| 値だけのLocal Operation／Surface／Result Return | 実Consumerなしの試作品として評価。RFD-IT-009／EST-IT-010／EST-ST-011の義務を保持 | 純値fixtureを実Surface／Taskの証明へ流用せず、5C依存を独立保留する |
| 配布閉包 | 既存`RUNTIME_SIBLING_COMPONENTS`と署名／unsigned fixtureの旧CROS参照をAMへ同期 | 現Package名・Source集合、欠測拒否・閉包受理。再署名の成立は別実行で確認 |
| 試験収集 | Verification Runnerの既存Owner母集団へAMを接続し、旧CROSは本体撤去時に除外 | AM実在試験を収集・選択でき、不存在／未対応Ownerを正しく拒否 |

読取り専用の現行Runner実測では、台帳検査49指摘のうちAM関連17件、AMの実在試験収集0件だった。台帳のAM8試験は実在するが、RunnerのOwner母集団が未接続のため不存在・未対応として報告されている。これは試験未実行やSource不存在とは分ける。既存一覧へのAM追加を先行でき、旧CROSの除外は本体撤去と同時に行う。独立した着手前確認を依頼中で、Source切替前に結果を統合する。

AM収集の先行是正は限定完了。Runnerの既存Owner／段階判定／変更Path判定／静的・試験dispatchへAMを接続し、両ServerのOwnerを現行Package名へ統一した。AM結合BlockとMCP接続Corridorは既存Architecture・試験へ接続し、QA ID・台帳IDは変更していない。旧Domain Anchor・Profile順序・改名前CLI2参照・Source1参照を同期した。台帳検査0指摘、AM8file収集、MCP内のAM名によるOwner混同なし。最終Runner45件中44 Pass・Fail/Cancel 0・人間UAT 1 Skip、14408.2909ms、静的3軸・Exit 0。Git試験は各祖先を作成前にlstatで確認し、.crdd／tests junction反例のリンク先作成0、正常変更集合とexact fixture回収・残存0を確認した。更新6Pathの限定独立再確認Pass・全重大度残指摘0、diff check成功、基準HEAD不変。途中の失敗・環境拒否は最終成功へ読み替えない。旧CROS Ownerは本体撤去まで維持し、正式191項目・全体Checker・AM全体完成は未完了である。

必要確認は能力対応、対象Package／利用側回帰、静的3軸、台帳／Symbol／配布閉包、限定独立レビューと現在文書の整合である。標準規範・外部実行境界を新設しないため、準拠基準の新規採用監査とProvider E2Eをこの局所撤去の根拠には要求しない。正式191項目・全体Checker・⑥・AM全体完成は未完了を維持する。現在追加の人間判断はない。

### 旧Shared Host・MCP旧認証接続の撤去 — 2026-10-13

本番Consumerは新AM ResolverとWorkbench同Host直接接続へ切替済みである。旧MCPのShared Host／CROS Resolver、専用公開CLI・混在設定例を撤去する。CROS Package内の旧REST library・旧資格・未使用Surfaceは後続撤去であり、本単位でPackage全廃とは表示しない。維持する能力は新Ownerと実試験へ、廃止した構成固有の能力は再実装しない。変更分類は採用済み二Surface構成の接続閉包。Role／鍵操作権限・Host保存先・Schema・旧正式Evidenceは不変更。署名・Provider・Docker操作は今回不要で実行しない。

| 旧能力・処置 | 現在のOwner／接続・確認 |
| --- | --- |
| 要求毎認証・非開示・公開解除・失効、Repository／Project拘束 | AMの現在認証・集合→Domain実本文／CRUD。access-capabilitiesの本人、内容12操作、foreign Project・集合欠測・本文待機中失効／解除・Relationで確認 |
| Profile四操作・改訂競合・非管理非開示、活動取得 | AM現在Role／認可→AI Adapter／Orchestrator。access-capabilitiesの実HTTP・実保存で確認 |
| TLS／Host／Origin・秘密非表示・Signal／Socket終了 | streamable-httpの公開CLI・実TLS18 Case。運用Proxy／Linux／実OS Signalの成立へ拡大しない |
| Profile遅延認可・二依存拒否、採用後故障／取消、結果相関／実行可能Property | 旧複合試験からai-profile-adapterへ本文・Traceを保持して3 Case移設 |
| 活動開始済みReader join取消 | 旧複合試験からruntime-activity-adapterへ本文・Traceを保持して1 Case移設 |
| RESTとMCPの同一Origin、Gateway health、HTTP入口stdin EOF | 旧Gatewayだけの構成能力として撤去。新Surfaceへ偽装移植・新Framework追加なし |
| 可視の設定・管理方式 | MCP／Workbench既存exampleを維持。User／資格／登録／公開は既存Host初期化・Workbench管理操作が正本で、cros.json手編集設定を新設しない。Workflow／template AGENTS／Storage／旧比較設計を同期 |

旧複合9 Caseのうち現Adapterに属する4 Caseは保持し、旧認証に依存する5 Caseと旧Gateway専用4 Caseを撤去した。撤去前MCP全95 Case・静的3軸が成功（88833.9423ms）。撤去後MCP全86/86・静的3軸が成功（100108.7133ms、Exit 0）。正式191項目・QA ID・Not Runは不変更。旧GatewayのRFD-ST-004 Evidenceは当時の観測として保持し、新経路のST Passへ流用しない。独立確認の文書・台帳指摘2件を是正し、限定再確認Pass・全重大度残指摘0で本撤去Gateを閉じた。CROS Package全撤去・全体整合の完了とは区別する。

撤去Pathは基準Git Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` の `40_Develop/mcp-server/src/shared-host/server.ts`、`src/project-context/cros-resolver.ts`、`tests/integration/cros-project-context-mcp.integration.test.ts`、`tests/integration/cros-shared-server.integration.test.ts`、`tests/system/cros-projection-non-disclosure.contract.test.ts`、`tests/system/cros-shared-server-entry.integration.test.ts`と、`template/tools/crdd-cros-server.ts`、`template/tools/cros-shared-server-config-example.json`で再構成する。Source／試験の現行参照は撤去し、過去Evidenceの本文・署名・Hashは変更しない。

### 旧CROS試作品の撤去 — 2026-10-13

旧CROSにだけ存在するContext Package、Handoff作成・再開、AI行動計画、汎用Tool Registryは、本番Consumerへの接続がない試作品である。Root公開、自Package試験、現行設定・配布入口を照合し、実際の能力の代替完了とは分けて撤去する。新Ownerへ同じ試作品を移さず、義務と未成立範囲を以下へ保持する。Session・Repository解決と局所操作のRFD-IT-009は不変更。過去Evidenceは不変更、削除Pathへの現在リンクだけ履歴参照へ変更する。

| 撤去対象 | 新Ownerの義務・現在状態 | 未成立範囲 |
| --- | --- | --- |
| ContextItem／ContextPackage／createContextPackage | Domain ModelのRFD-ST-010はOPEN。認可済みSource・Portfolioは入力側の部分接続 | 目的限定Package Identity、Consumer lifecycle、終了後第二正本0 |
| resolveAiOperatingPlan | フロントAI入口・CheckerのRFD-IT-011はOPEN | 複数実AI入口のSource／Revision・規則・制約・差理由の比較 |
| createHandoff／resumeHandoff／CrosHandoff | OrchestratorのERB-IT-010／ERB-ST-013は5C依存OPEN | 旧Owner終了・実Effect・重複消費防止。sourceActive:false／destinationEffectIssued:trueの値は実観測ではない |
| tool/registry.ts | 実Toolを所有する各SurfaceのRCM-IT-010はOPEN。公開・dispatchは部分接続 | CLI／MCP／Coordinator／Workbenchの同一能力、状態軸、取消、cleanupの全比較 |

正式191項目、QA ID、Not Run、v0.22対象は変えない。旧Sourceの再構成はGit Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` の下記Pathを使用する。撤去直前のSHA-256も固定する。撤去前CROS全34 Case・静的3軸は成功（7435.4705ms）。専用5 Caseを削除し、RFD-IT-009の1 Caseと他28 Caseを保持する。件数減少は義務の廃止ではない。撤去後CROS29/29（6748.1132ms）とCROS／MCP／Workbench静的3軸成功、固定16Pathの限定独立再確認Pass・残指摘0。結果記録更新前のレビュー対象diff Hashは`3bdb99fc6f573556c029028867e40cf4d85ef97a`。台帳登録Path欠落0、対象Source／export／Symbol／Catalog旧参照0、exact Git履歴参照確認、差分空白検査成功。最新全体Checkerは3058 errors・0 warnings、今回のQA／Domain／計画／削除PathとCHG-000080影響一覧形式に関する指摘0。以前の全体3057との差1の原因は未特定で、全体解消や新規違反なしを主張しない。旧REST／Shared Host／CROS Package全撤去と正式191項目は引き続き未完了。

| Path（40_Develop/cros起点） | 撤去前SHA-256 |
| --- | --- |
| src/access/session-context.ts（部分撤去） | 50609adb5bc13cd515fdd105f93fb24ce8a1ddef6eb0d5ded15244960ce3fa68 |
| src/tool/registry.ts | 937e083e19b8b781f2bf8829877bc8f54328e81ac815fa65355f46f5b815b167 |
| tests/system/context-handoff.contract.test.ts | 59b0752ab8961687158282f4a79cf70c5ab02cf4e0fad1ecd6720288f6af382b |
| tests/integration/tool-registry.contract.test.ts | 7fab486e705c8f1f90e5b972c472d08dfa2de3b121a1c0203fe56c10f45622a9 |
| tests/integration/local-operation-ai-plan.contract.test.ts（局所操作のみ改名して保持） | 18c254222d359dfda5053f6f76f2edc8203c92984723bf7a7099c78128db950c |

以下は⑤の先行局所確認の履歴であり、現在の状態は上段の撤去記録を優先する。

①〜④の現在接続の限定Gateを閉じた。④最終候補の全IT54/54・全Browser13/13と限定独立再レビュー残指摘0は当該撤去範囲の根拠であり、正式191項目や全体完成へ昇格しない。⑤公開CLI候補は明示mode、既存Host RootとHost Profile、自己生成鍵の専用connect POSTと要求毎Bearer、非開示、合成Signal終了、異常Child終了観測を接続し、限定独立再レビューPass・残指摘0。Workbench公開Origin追加後の同CLI5/5（10170.2498ms）と静的3軸は成功した。試験Driverの--input-type継承によるWorker失敗はDriver是正後成功と分離し、製品保証を緩和しない。MCP既存HTTP optionsとWorkbench StartRequestへHTTPS publicOriginを接続した候補を検証中。単一Host／TLS終端Header／Originを認証前検査し、loopbackと要求毎Bearerを維持する。独立指摘のURL正規化で消える禁止入力を解析前の文字形検査へ是正した。是正後MCP局所2/2（608.5697ms）・同HTTP System13/13（12665.299ms）、Workbench共有Origin局所2/2（673.8676ms）が成功し、自己生成Root清掃と差分確認済み。Workbench単体／共有の通常管理既存回帰2/2（68642.6556ms）も成功し、独立確認は継続中。公開設定ありの実CLI、実TLS終端、正常公開内容・Role／Exposure／取消の共有縦断、旧CROS残4prototypeの義務還元と撤去、旧REST／Gateway／Shared Host／CROS Package撤廃、⑥全体整合・正式191・AM完成は未成立。Credential／Portfolio／Profile／Activityは新Ownerへ接続済み。現在追加人間判断なし。 各Server設定Readerを明示--crosだけへ接続し、配布exampleと非秘密Git allowlistを追加した。MCP Reader／共有境界3/3（793.8931ms）・同HTTP System14/14（12268.8856ms）、Workbench Reader／共有境界3/3（927.6461ms）・同CLI5/5（11215.2394ms）と静的3軸・自己生成Root清掃が成功した。独立確認は保証表現1件を取得時Identityと取得済みDescriptor相関へ限定して是正し、再確認中。実CLI公開設定と実TLS通信は未観測で、設定接続を共有全体完成へ流用しない。 設定Reader保証表現の限定再確認はPass・残指摘0。Workbench公開設定あり／なし実CLIは最小自己生成Git Root＋公式Logoだけで6/6（13781.4597ms）成功し、公開HTTPS案内と内部loopback観測を分離した。先行public Caseの421はFetch ClientのHost搬送による試験構成差で、Hostを保持する実Node HTTP Driverへ是正した別実行の成功と分離する。製品Header検査は緩和していない。公開配置Header経由の接続／要求毎認証／管理とHost Profile読取り／非開示／合成Signal後ProcessとListener回収、自己生成Root不存在を確認した。実TLS通信は未完了である。 Workbench公開設定ありCLIの限定独立確認はPass・残指摘0。MCP公開設定あり／なし実CLIを最小自己生成Git Rootで2/2（7775.0538ms）、同HTTP System15/15（16753.2334ms）確認した。公開案内とloopback観測を分離し、初回接続・本人・manager Host Profile管理・失効・合成SIGTERM後Exit0とListener回収、秘密非開示、自己生成Root不存在を確認した。URL待機を固定診断・有限時間・監視解除へ是正し、終了不明でfixtureを削除しない。実TLS／Proxy通信・OS Signal搬送の証明へ流用せず、MCP実CLIの独立確認は継続中。 MCP実CLI清掃の独立再確認はPass・残指摘0。setupからChild生成後まで一つのfinallyへ結合し、生成前／URL待機前の注入失敗を正常接続と分離して回収、最終同System17/17（18412.2095ms）成功。Workbenchに公開試験証明書の明示CA検証を用いた実localhost TLS終端→公開CLI→AM縦断を追加し、同CLI7/7（13945.9458ms）成功した。未信頼証明書拒否、Host preserve、Client由来Forwarded上書き、認証と非開示、Child／Proxy／Upstream終了とfresh接続拒否を確認した。先行Proxy close後ECONNRESETは試験Client pool再利用で、Agent falseでfresh接続と区別した。旧失敗Root1件はterminal・exact Node不存在・リンクなし確認後回収し、準備物と現在fixture不存在を確認済み。実TLS限定独立確認は継続中で、MCP TLS、実Browser TLS、実運用Proxy／Linux配置／実OS Signalへ成立範囲を拡大しない。

Browser搬送基礎段階の記録：未選択booleanは一件のfalseへ変換し、重複・File・Repository／Action Token差を拒否する。専用結果の閉じた五fieldを操作・種別・理由・Effectへ相関し、Mainのfresh取得は現在route／query／選択Repositoryを維持して待機後も確認する。独立確認でcreateの正規競合理由不足とdelete／Relation相関の緩さを検出し、Domain／Serverを変えずInspectorと負例を是正した。静的3軸と関連IT7/7は成功した。当時はフォーム有効化と実Browser反例が未接続で、現在の候補成立は先頭段落で区別する。この値検査だけを実Browser保存や③全体完成の根拠にしない。

Backend接続段階の記録：Source・試験・QA・Catalogに続き現在投影の文書限定再確認もPass・残指摘0となり、当時の関連Server／管理回帰42/42（155378.0269ms）と所有試験資源清掃を確認した。その後のBrowser接続と現在Gateは先頭段落で区別する。現在の次対象はGit操作・本文リンクであり、通常起動、旧MCP／CROS撤廃、正式191項目とAM全体完成も未成立である。

③のTopic／Meeting内容POST Backend候補を接続した。閉Form・Body搬送後fresh AM集合・同Project操作構成・Domain一回配送・取消待機後C2を使用し、要求専用200結果／配送前400／配送後503を旧Standalone／Remoteの303／500と区別する。HTTP入力変換は`topic-meeting/action.ts`、Root／認可集合構成は既存`access-resolver.ts`へ分けた。両種別のCRUD、競合、確認不足、重複・未知・非許可入力と欠測／不正confirmed拒否は実HTTPで成功した（CROS局所1/1、48739.6296ms、静的3軸成功）。Meeting fixtureの開催日時／Outcome表欠落、追加試験の型注記不足は契約を緩めず是正した。

初回限定レビューのMajor 1・Moderate 2は是正した。必須field・boolean／列挙／OUT／CHG／TOPIC参照IDは配送前検査し、不正／欠測でDomain本文read 0・AM byte不変、同じ観測の正常正対照を確認した。保存後の公開解除・鍵失効・例外・実HTTP切断は実出版一回と既知本文保持、固定503または取消成功本文0を確認した。取消はServerResponse close実通知とend本文件数を相関し、正常正対照1、fresh GET後も再Mutation 0を確認した。同Project sibling公開解除も503・実出版一回を確認した。昇格は対象不存在・正常・競合、Outcomeは二件の早期Close拒否・一件目非Close・全件処置後Closeまで確認した。最終CROS局所1/1（74430.7885ms）、静的3軸、差分・所有Root不存在、Source／試験／QA／Catalogの限定再レビューPass・残る実装指摘0を確認した。現在投影の古い残件表示だけを同期し、再レビューへ返す。これは内容POST Backendの限定成立であり、Browser操作、Git／本文、通常起動、旧MCP／CROS撤廃、正式191項目とAM全体完成は未成立である。

共有Profileの表示領域評価はDesktop 1440×900、Tablet 1024×768、Mobile 390×844のCSS viewportを指定し、実innerWidth／Height、ページ横overflow 0、Panel内包、Form操作32px以上・文字12px以上、Profile IDからAdapter／ModelへのTab移動を同一DevTools接続で確認した。初回の別接続によるviewport解除と、限定レビューのTab計測相関・Header不足は是正した。最終System10/10（95417.8925ms）、静的3軸、限定再レビュー残指摘0、所有試験Root不存在を確認した。既存の実Browser Zoomは別試験で27組合せが成功（87396.0211ms、Skip 0）した。並行Browser負荷下のDriver timeoutは製品故障と断定せず、最終Systemは単独実行した。CSS viewport評価を実Zoom証明や全UI／AM完成へ拡張しない。

③着手前（Backend接続前）の履歴：内容POSTはBody搬送後のfresh AM集合から既存Domain／Version Controlを一回呼び、公開前のC2を確認する方針を照合した。本文も選択Rootの既存Catalog／Readerへ接続する。読み取り専用確認で追加人間判断なし。処置前拒否と配送後の結果不明・既知処置後の公開不可を分離し、新Recovery／ACK／共通Routerは作らない。当時はArchitecture契約だけを追加しSource・Consumer・反証は未接続だった。現在のTopic／Meeting Backend成立と残るBrowser／Git／本文は先頭の最新段落で区別する。

共有ProfileのBrowser通信・状態管理の限定Gateは、既存Form／TableのMain／Access共用、閉Catalog／Mutation相関検査、memory資格搬送、一回保存とfresh読取りを接続した。内容権限なしmanagerのCRUD、developerのCatalog／Form非表示・POST 0、保存後GET故障と不正JSON応答の既知保存／結果不明分離、自動・明示再取得による再Mutation 0、取得中切断・遅延応答拒否・再接続freshだけの採用を確認した。途中7/10のfixture待機不足と8/10の重複シナリオによるDriver上限超過は成功へ書き換えず、操作可能状態への同期と独立manager Caseへの反例分離で是正した。製品とDriverのtimeout・retryは変更しない。最終実Browser10/10（102468.8405ms）、応答検査／接続取消4/4、静的3軸、差分確認、所有Browser・Listener・Profile清掃と試験Directory不存在、限定独立再レビュー残指摘0を確認した。notice世代持越しと明示再取得後POST不増の指摘は是正済み。Visual三Profile・通常CLI・旧経路撤去・正式191項目・AM全体完成は未成立で、実行別Evidence書庫は追加しない。

共有ProfileのBackend限定Gateは、既存Host Catalog AdministrationのDIと要求毎AM認可によるGET／POSTに接続した。混合構成・未構成fallback、閉Form、developer操作0、manager／administrator四操作、未確認削除・競合・失効・Catalog故障を確認した。独立レビューの後段反証不足をTest-only wrapperで是正し、Snapshot後の降格／失効は403・一回、保存後の降格／失効／例外は503、実切断を含む全分岐で保存一回・成功本文0・次要求の改訂と対象値一致・再Mutation0を確認した。最終結合42/42（172645.5026ms）、既存実Browser回帰8/8（88394.7992ms）、静的3軸はExit0、限定再レビュー残指摘0。Server SHA256 `439e6976b237f664cc625537e5da0772120b244eaa20a701de8824635b9363a1`。完全出力は実行端末で確認し既存コマンドから再生成できるため実行別書庫は追加しない。これはHTTP Backendの限定成立であり、新Browser Form・通常CLI・旧MCP依存撤去・正式191項目・AM全体完成の根拠ではない。次は既存Form／TableをMainとAccessで再利用し、memory資格のCSR搬送・fresh読取りへ接続する。

活動読取りの限定Gateは、2026-10-13に単体／同Host CROSの直接Owner接続、固定Identity・Project分離・ページング、開始前取消0・開始後二Root各一回join・成功本文0・次要求正常まで確認した。最終結合42/42（151400.9034ms）、同実装の実Browser8/8（82437.7361ms）、静的3軸は全Exit0、差分検査・Source Hash一致・所有試験Root不存在、限定独立レビュー残指摘0。途中41/42の接続リセットは成功へ書き換えず、次要求を独立した新しいHTTP接続にして切り分けた。原因確定、製品の再送追加、旧MCP撤去、正式191項目・AM全体の完成は主張しない。Server SHA256 `873ea3624bb36eaf544970a5e95f23c56b2f68a4b18a71bb7f43381495faa9cb`、活動Reader SHA256 `e614b990abfdb4a164027e6093949f02852e447ffa529a72385e48a35c824a13`。完全出力は実行端末で確認し、既存試験コマンドから再生成できるため実行別書庫は追加しない。

1. 活動読取りを単体／同Host CROSとも既存Orchestratorへ直接接続し、実HTTP取消・回帰・限定独立レビューを閉じる。
2. Profileの一覧・作成・更新・確認付き削除を既存AI AdapterのHost Catalogへ直接接続する。現在manager／administrator認可、保存Owner分離と応答喪失時の非再送を維持する。
3. 選択Repositoryへの内容保存・Git操作・本文リンクを専門Ownerへ接続する。
4. Workbenchの旧Remote設定・MCP Client／Adapter・分岐と不要試験を撤去する。MCPは独立入口として維持する。
5. 通常CLIと共有Host配置を閉じ、代替接続の成立を確認した旧REST／Gateway／Shared Hostおよび`40_Develop/cros` Packageを撤去する。配布検証・起動Tool・現行Symbol／Catalog・Consumer参照も同時に更新する。
6. 撤去後の全構成について正本・Source・設定・試験・Reality Audit・正式検証義務と全体独立レビューを確認する。

旧`cros` Package撤廃は後続の任意整理ではなく、この変更の完了範囲である。CROSという全体概念は維持し、認証・認可はAccess Management、Context処理はDomain Model、ProfileはAI Adapter、活動読取りはOrchestratorが所有する。未接続能力を残したままPackageだけを削除しない。歴史的Evidenceは変更しない。

Profileの接続では、検査済みHost設定から既存Store／Administrationを構成し、Workbenchへ注入する。Browser指定Root、AM state PathからのCatalog Path合成、起動Repositoryへのfallback、新Store／Lock／認可Frameworkは追加しない。未構成・Root不成立・破損は未取得として扱い、正常Storeの正式なRevision 0初期値とは区別する。構成・認可・表示・保存の責務は[Workbench詳細設計](../../../06_Architecture/Details/workbench-server/01_Architecture.md)へ接続する。

### WorkbenchのMCP依存全撤去への方針訂正 — 2026-10-13

残4系統の移管に向け、選択RootのGETを同Host専門Ownerへ直接接続し、限定独立再レビューで残指摘0を確認した。初回レビューの全集合再確認不足・重複ID受理を是正し、一つの短命AM集合からSurface／Portfolio／同Project Topic・Meeting／Git表示を構成し、公開直前に全Root・管理改訂・正規化全集合を再確認する。Exposure・資格・sibling・Binding・manifest変化は部分公開0、同値順序変更は許容、重複IDは認証とRoot観測前拒否。最新IT2/2、実Browser8/8、Workbench回帰50/50、全Exit0と所有資源cleanupを確認した。Profile未取得を単体既定へ補完せず、内容保存未接続を無効表示する。WorkspaceはRepository全体の公開分類で、内部Path ACLではない。新ACL・Router・Session・Registry・Lockは追加しない。共有AI／Candidateへ起動Rootを流用せず、後半実行系の未接続を保持する。内容POST、本文リンク、Profile／Activityの直接Owner接続、残MCP撤去、公開CLI、共有TLS、旧REST／Gateway撤去、正式191項目とAM全体完成は残る。追加人間判断は不要。

Browserの既知リンク／GET検索／戻る操作を、同Origin Model取得とhistoryへ接続した。IDなしリンク・検索で選択Repositoryを維持し、外部／download／別tab／修飾click／POSTを横取りせず、表示世代・所有Signalで旧応答を拒否する。接続中pagehideの保留GET取消・Root解放・終了後応答非採用と、合成pageshowの資格Headerなし再開を確認した。初回Systemは6/8・Exit1で、試験がReact管理外のリンクをRootへ残した観測混入を是正した。最終System8/8・Exit0（84.46792秒）、同実装の全回帰50/50・Exit0（185.2523222秒）、静的3軸・Build・JSON・差分検査成功、所有Browser／Listener／Directory不存在、限定独立レビュー残指摘0。新Router依存・Cookie・Session保存・認可層は作らない。合成通知は実Browser cache保存復元の証明ではない。CROS内容POST／本文リンク／選択全内容Model／共有配置、残4系統のMCP依存撤去と正式191項目・AM全体は未成立で、GET基盤だけを全体完成へ昇格しない。

管理直接接続の修正後限定独立再レビューはPass・全重大度残指摘0。静的3軸・Vite Build、局所4/4（18360.0738ms）、実Browser8/8（85707.2831ms）、Workbench全回帰50/50（190213.339ms）、全Exit0・Fail／Cancel／Skip／Todo0、差分確認と所有Browser／Bootstrap Root残存0を確認した。Standalone／CROS同Hostの本人＋四read＋七保存、fresh資格／Role、登録と公開の分離、拒否・保存故障・取消と応答抑止、非秘密結果、表示・清掃の限定成立である。前回の文書／metadata指摘2件は解消し、処理本体Hashは不変。残るPortfolio、Topic／Meeting、AI Profile、Activityの4系統、共有TLS、全内容入口、公開CLI、MCP依存全撤去、正式191項目、AM全体は未成立。追加人間判断は不要で、次は残4系統の直接Owner接続へ進む。下段の確認中表記は先行時点の履歴である。

管理直接接続の初回限定レビューはMajor1／Moderate1で停止した。処理本体ではなく、現行Workbench§6.2.1／6.3・QA007／009に旧Remote管理MCP契約が残ることと、MCP Client試験のHeader／刺激が管理経路を示すことが原因である。現行契約を全配置の直接AM四read＋七保存へ同期し、独立MCPの管理Tool／限定discover・登録と鍵の非公開義務だけを別Surfaceとして保持した。MCP Clientの残4系統反証は公開Portfolio Tool定数へ変更し、純粋管理InspectorのRelationを分離した。AM／Role／Schemaと過去Evidence・正式191 Not Runは不変更。修正前のSource全回帰50/50・Exit0（189131.789ms）は意味の回帰根拠として保持するが、未修正文書のPassにはしない。修正後の静的3軸と局所4件成功（18360.0738ms）。新固定候補の実Browser・全回帰・限定再レビューは確認中である。

管理系統のMCP分岐を撤去した。`management/operations.ts`は同Process AM APIと共通結果投影だけを呼び、中継用ManagementConnection型・MCP Tool定数・Network分岐を削除した。本人・四read・七保存と既存Role分担を維持し、Repository登録はWorkbenchだけ・登録と公開は別操作とする。Systemの旧Remote管理は同HostのCROS要求Header→Workbench→AMへ置換し、MCP Serverを起動しない。静的3軸と局所4件成功（18682.6392ms）、実Browser8/8成功（79342.5364ms）、各Exit0・Fail／Cancel／Skip／Todo0、各所有Browser／Listener／Directory清掃確認済み。管理試験のSymbol／Catalogを直接AM接続へ同期し、MCP Client検証Relationを除外した。全回帰と限定独立レビューは現在確認中。管理以外のPortfolio／Topic・Meeting／Profile／Activityの4系統は旧MCP依存が残る。共有公開配置・全内容接続・公開CLI・正式191項目・AM全体完成は未成立を維持する。

Browser接続候補の限定独立再レビューはPass・全重大度残指摘0。初回レビューの2指摘（System固定式の相対URL限定捕捉、開始後取消の反証不足）を是正し、同Origin＋pathname捕捉、fetch待機／Reader待機の同Signal取消・固定失敗・Reader解放・再送0・非取消失敗保持を確認した。修正後focused IT2/2（228.0696ms）、実Browser8/8（91800.395ms）、Workbench全回帰50/50（172993.6303ms）、各Exit0・Fail／Cancel／Skip／Todo0、Vite Build・Formatter・tsc・Lint・差分検査成功。自己生成Browser／Bootstrap Rootの現在一覧0件、各所有Browser Tree／Workbench Listener／DevTools Listener／Directoryの終了後不存在を確認した。先行Systemは8件中2Pass／6Fail・Exit1（132079.6206ms）であり、計測是正後の別実行で成功した事実と分離する。過去の失敗を上書きしない。今回の限定結果は鍵管理／接続だけで、共有TLS、全内容入口、公開CLI、MCP依存撤去、正式191項目／EST-ST-013全体、AM全体は未成立。次は5能力の専門Package直接接続と旧MCP経路撤去へ進む。以下の「実行中」「未確認」は先行時点の履歴である。

Browserの非永続な接続資格保持・同Origin Authorization搬送をSourceへ接続した。本文16 MiB上限、切断／鍵切替後の遅延応答拒否、Reader取消・解放、自動再送0を合成Transportで確認した。実Browserのmanual redirectは303のstatus／Headerを隠すため、専用接続POSTを200の閉JSON（status: completed）へ変更し、確認後の次GETだけに資格を添える。既存AM保存・認可を変更せず、初回確認と通常内容取得の分離を維持する。根拠は[Fetch Standard](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque-redirect)。修正後の静的3軸・Vite Buildと接続／通常管理3件成功、Exit0・Fail／Cancel／Skip／Todo0（22.4639533秒）。旧Remote管理1件も含む局所回帰であり、MCP撤去の完成証明ではない。専用Chromeの本番Bundle確認を実行中で、実Browserの結果・限定独立レビュー・共有公開配置・全内容接続・正式191項目・AM全体完成は未成立である。下段の303・Browser未接続は先行候補の履歴であり、現在の応答契約ではない。

共有Browserの主体分離に向け、CROS Server-globalの接続鍵とNoticeを撤去し、通常要求の一つのAuthorization Headerから当該要求だけのAM Contextを作る候補へ切り替えた。専用接続POSTは確認だけを行い、次GETに資格を暗黙継承しない。静的3軸とLocal対象1件成功（9.7553872秒）、Exit0・Fail／Cancel／Skip／Todo0。A接続後の資格なしBは未認証、別Credentialのdeveloperは別UUID本人、A失効をBへ継承せず、鍵・RootはModel非表示を確認した。初回一出版・Headerなし／Origin不正拒否と状態不変・所有Root／Listener回収も維持する。新Session／Store／Cookie／Lockは追加しない。Browser memory／Header送信・共有公開Origin・全内容入口・MCP撤去は未接続で、旧48件やloopback Local限定レビューを現在の共有完成へ流用しない。

追加反証では、重複Authorization HeaderをNode HTTPでexactに送り、不正Bearerとともに認証済みModelを生成しないことを確認した。通常管理2件と静的3軸成功、Exit0・Fail／Cancel／Skip／Todo0（20.216219秒）。先行fixtureの失敗は資格発行Operation IDの重複、後続raw Header試験の失敗はHost Header欠落であり、fixtureを有効な別発行ID・exact Hostへ修正した。拒否をSourceで弱めていない。Server SHA-256 `8ed058cd2248071a9166f7386bcd2743650d3563fe0b2d6b354699ee02e2f4dc`、試験SHA-256 `5a51d8944c0e922ef406393ad338970810889320eea3d60683b748cf2c012ed3`。このHTTP主体分離候補を限定独立レビューへ渡し、Browser・共有公開・依存撤去・全体完成は未成立を維持する。

主体分離の限定独立再レビューはPass・全重大度残指摘0となった。Workbench詳細の公開POST未接続という旧2句と、無条件の構成Bearer説明を是正し、Standalone限定DI／CROS要求Header／AM保存Root／登録対象Rootの境界を同期した。Source／Test Hash不変、同認証意味の現在記述全数照合と差分確認成功。対象2件と静的3軸だけの限定結果であり、Browser memoryとHeader送信、共有TLS配置、全内容入口、WorkbenchのMCP依存撤去、公開CLI、正式191項目、AM全体完成は未成立を維持する。次はBrowserの非永続な鍵保持・要求Header送信を接続し、各専門Packageへの直接呼出しと旧MCP経路撤去を同じ採用構成へ閉じる。

人間は、LocalだけでなくRemote利用でもWorkbenchのMCP依存を外すと明示した。「Remote AdapterだけにMCPを残す」というAIの解釈を取り消す。Workbench／MCPは対等な公開入口とし、業務・状態・保存は各専門Package APIが所有する。WorkbenchのRemote用MCP ClientとProtocol定数importを完成構造へ残さず、新Gateway・共通Framework・代替RESTを勝手に追加しない。

Remoteの具体配置も人間が確定した。2026-10-13の「OK」は、Browserが共有Host上のWorkbench Serverへ直接アクセスし、そのServerが同Hostの専門Package APIとRepository群を利用する形を採用する判断である。Local Workbench backendから別HostのMCP／CROSへ接続する経路は撤去対象とする。MCP Server自身のAI／Machine公開能力は廃止せず、Workbenchと独立して同じ専門Package APIへ接続する。後続の配置確認中という段落は当時の判断待ち履歴として保持し、現在の未決として扱わない。

採用後の読み取り専用着手前照合は、5能力の同Host移管に追加人間判断不要とした。PortfolioはAM許可集合→Domain、Topic／MeetingはAM今回集合→Domain CRUD／同Project Relation、ProfileはAM管理判定→AI Adapter CROS Catalog、Activityは許可対象→Orchestrator／Execution Intelligence、通常管理／本人はAM共通APIへ直接接続する。旧MCP Client／5 Adapter／Endpoint入力／Remote分岐を撤去し、通信と独立した結果検査だけは責務を確認して保持する。

共有Browser利用の実在Gapは二つである。第一に、現Workbenchはloopback由来Originだけを検査するため、既存の外部TLS終端・固定公開HTTPS Origin／Host・終端によるForwarded Header除去／上書き・内部Listener直接到達禁止という配置契約をWorkbench Transport Ownerへ移す。第二に、現接続鍵とAction TokenはProcess全体で共有されるため、同Serverへ接続するBrowser間で主体を分離できない。接続鍵はBrowser memoryだけ、各API要求のAuthorization Headerから要求専用AM Contextを構成し、Server-globalのログイン鍵を撤去する。静的Shellは資格不要、URL／Web Storage／log／汎用Modelへ秘密0、切断時参照解放、各要求fresh認可を維持する。新Session Store／Cookie Registry／Gateway／ACL Frameworkは作らない。複数Browserの本人・Role・Repository・遅延応答の非混同を必須検証とする。これは共有公開を成立させる具体化であり、既存Local限定Passを共有完成へ流用しない。

現行SourceのMCP依存は、Portfolio、Topic／Meeting、AI Profile、Runtime Activity、通常管理の5能力と共通HTTP Clientに存在する。通常管理はLocal／Remote処理が同一Fileに混在する。Localの同Process直接AM／Domain読取りと専用接続POSTはこの方針と整合するが、Remote MCPへの先行移管は改訂対象であり、その回帰成功を新構成の完成根拠にしない。

Remote利用の具体配置を確認中である。Browser→共有HostのWorkbench Server→同Host専門Package APIであれば、Workbench backendから別HostのCROSへ接続する旧経路を撤去し、MCPを介さず既存能力を維持する。別Host CROSへのbackend接続まで必要なら、MCP以外のTransport採用が別途必要であり、具体利用形態の判断前に新Transportを実装しない。現在の実行中Workbench回帰は同じハンドルで終端まで確認し、構成判断後にArchitecture／SPEC／QA／Source／配布入口を対応付けて切り替える。過去の正式Evidenceは改変しない。

上記の先行Workbench候補に対する`npm test`は終端確認済み。Vite Build・書式・型・Lint成功、全48件成功、Fail／Cancel／Skip／Todo0、Exit0（196.1633266秒）。Local CROSの専用POSTと起動本文非読取りを含むが、Remote MCP残存も含む現在候補の回帰であり、人間が訂正した依存全撤去後の成立・公開CLI／Browser・AM全体完成を証明しない。新構成では対象差分と利用側を固定して必要な回帰・独立レビューを行う。

### 公開起動入口のアクセス管理接続 — 2026-10-13

Local CROSのServer接続候補を構成した。配布Rootの固定Logo／JSとHost AM Rootを分離し、CROS起動時のContext／Topic・Meeting／Profile Catalog／活動Reader構成を止めた。専用接続POSTは同Origin・Host・Content-Type・閉Form・Action Token・取消を検査し、確認後303だけで通常本人・内容・管理・鍵操作を公開しない。次GETのaccess Model、既存管理／鍵入口へ接続し、要求ごとの資格不成立で接続材料と旧表示を解放する。内容入口は全数接続前の拒否状態であり、完成へ固定しない。局所静的3軸とLocal管理対象1件成功（10.0639977秒）、Exit0・Fail／Cancel／Skip／Todo0。本文不正な自己生成起動RepositoryでShell配信・起動本文非変更・.crdd生成0、秘密非表示、接続／切断、初回一出版、失効後非表示、旧内容Route拒否とListener不存在を確認した。公開CLI／Browser／選択内容全入口と全体完成は未成立。Package全回帰と限定独立確認へ進む。

Local専用POSTの独立レビューでOrigin欠落受理を検出し、exact Origin必須へ是正した。通常／credential_stored双方で欠落Origin・不一致Hostの400と状態byte不変を反証した。Hostを正規化するfetchでは反例を作れないことを試験失敗から確認し、Host反例だけNode HTTPでexact Headerを送信した。局所1件成功（10.6891616秒）、後続`npm test`のBuild・静的3軸と全48件成功（173.0612904秒）、全Exit0・Fail／Cancel／Skip／Todo0。是正後の限定独立再レビューは全重大度残指摘0・Pass。server SHA-256 `315522927b2ffa624c96356b2faa8f6580bcf80f9bb1be33d330af596428ad3f`、試験SHA-256 `2f8e578d8846718a4c382d62d1a34b13e5de528b7cce897dc4ff87c5b80369c8`。今回所有Root／Listenerの終了後不存在を確認し、2026-10-09生成の旧2 Rootは不操作でRepository全体残存0とはしない。このPassはloopback Local接続だけ。共有Browser主体分離／TLS公開、Workbench MCP撤去、公開CLI／実Browser／全内容入口／正式191項目／AM全体完成は未成立を維持する。

Repository登録のSurface判断を確定した。2026-10-13の人間回答は「登録はWorkbenchだけにする」。既存manager／administrator分担、サーバー上の対象Root検証、登録と公開の分離を維持し、MCP登録Tool／Schema／dispatchは追加しない。鍵3操作のMCP非公開は不変。下段のRemote登録判断待ちは当時の履歴であり、現在の未決ではない。

Workbenchの接続資格受理を既存`credential/administration.ts`へ限定追加した。閉FormとAction Token検査後だけAM用途判定へ渡し、初回候補は既存確認保存後に通常認証を取り直す。管理fixtureのLocal対象1件成功、Fail／Cancel／Skip／Todo0、Exit0（7.6829438秒）、Workbench書式・型・Lint成功。通常接続の状態byte不変、不正・重複field／取消／誤鍵の非更新、初回確認の一出版と同鍵再要求の非更新、新User／資格0を実保存へ照合した。既存設計§2.5の限定discover表現と同Process専用POSTの対応は追加着手前照合中で、未決の意味を公開入口へ先行接続しない。公開HTTP／Browser／全内容入口・正式191項目の成立とは区別する。

追加照合は、MCP完全discoverとLocal閉connect POSTの入力差を明示し、同POST内の通常本人・内容・管理・鍵操作0と次HTTP要求のfresh認可を維持する条件で着手可・追加人間判断不要となった。AM詳細§2.5、Workbench詳細§6.3、既存QA初回義務とSource Headerへ伝播した。最新Workbench静的3軸と管理2件成功、Fail／Cancel／Skip／Todo0、Exit0（14.5562667秒）。接続関数SHA-256 `0d41a3c94d5546be52d6c17f169af40619b3ae73df1a009d674bcf6c9c609c11`、管理試験SHA-256 `38cee132f108577db5f2780e51f6f64dc3b283d41bfdec624bd36df15ad00ac9`。Source保存本体の変更はなく、AMの2 Header行だけSurface別前提へ同期した。公開POST／Browser／起動・全内容入口は未成立を維持し、この限定候補を独立確認へ渡す。

限定独立レビューのModerate1は、既存suite SymbolへのRFD-IT-024登録とCatalogの状態不変・一出版・再要求非更新3終了条件の補正で是正した。Source／Test Hash不変、HeaderとSymbolの全数一致・JSON構文・ID一意性・差分確認成功、Workbench静的3軸と対象2件再実行成功（15.3637804秒）、全Exit0・Fail／Cancel／Skip／Todo0。対象11Pathの限定再レビューはPass・全重大度残指摘0、固定集合SHA-256 `49d61c65ba3831d6c974bfb126233ea2ec86ca289274befeff254cbe26af348b`、HEAD `378d93cb6ffb0cc7c9561e0572d62bdd656f3312`。この結果は内部接続資格受理だけで、公開POST・Launcher・Browser・全内容入口・正式191項目・AM全体完成へ拡張しない。実行別Evidence書庫を追加せず、正式試験入口から再生成できる。次は既存Serverへの公開POSTと未認証Access Modelの接続である。

後続Launcher限定レビューはMajor2／Moderate4を検出した。主因はCROS Profile Storeのconfig保存候補に各操作時のdirect-chain検証がなく、認証済み管理操作からLink先へ保存できること。Windowsのconfig/stateは同一Root、Linuxは別Rootである。既存AI Adapter Store Ownerだけに構成時・snapshot・adoptのchain再検証と不足suffixの逐次非再帰mkdirを追加し、機能撤去を最終解にしない統合方針をレビュー担当と整合した。新Store／Lock／Root Framework、AM state／認証、Catalog Schema／Revision、単体利用は不変更。既存Store試験へ親Link・Catalog Link・構成後Linkの出版0／target不変を接続し、静的3軸と対象4件成功（1.7887992秒）。作成中置換・観測不能・manager公開Mutationと他5指摘の完全是正・再レビューは未完了である。

上記6指摘の是正候補では、観測不能とmkdir直後の親Link置換で候補本文の書込みopen0・target不変を直接反証した。Store対象5件成功（1.8340787秒）、AI Adapter全32件成功・Fail／Cancel／Skip／Todo0（3.1830971秒）、各静的3軸成功。公開STからIT Traceを除き、既存Rootのfresh／破損current／孤立pending／replaceを実ProcessでExit2・Listener案内0・全材料byte不変として確認した。公開ST11件成功（10.7725803秒）。Canonical Tool期待集合の完全一致とdiscover／list／call全応答・Header・Process出力の模擬秘密非露出を確認し、managerの公開Profile createでconfig Snapshot一件・AM改訂不変更を確認した。設計と既存ST Catalogへ限定同期した。既存IT断面をST入力として使用した反証であり、正式ST／IT結果へ昇格せず、191件Not Runと旧Evidenceを維持する。MCP全回帰と新固定候補の再レビューは進行中で、6指摘の独立解消判定はまだ未成立である。

是正後のMCP全88件成功、Fail／Cancel／Skip／Todo0、Exit0（74.755475秒）。限定独立再レビューは全重大度残指摘0・Pass（基準HEAD `378d93cb`、対象10Path差分Hash `cd9c7fcd1bfaa79e342921fa749fa3f179b0e8e2`）。6指摘の解消はこの起動Sliceだけであり、developer／内容Exposure／配布Root／Workbench／旧REST撤去／正式191／AM全体完成のPassへ拡張しない。

Local Workbenchの先行内部接続では`project/access-reader.ts`を追加し、現在AM集合→既存Domain固定本文→Portfolioを直接構成する。新Store／Session／Protocolは追加しない。既存管理fixtureへ内容許可なし・正常取得・本文不正・Exposure解除・資格失効・開始前取消の反例を接続し、Workbench静的3軸と対象2件成功（12.1535986秒）。Root・Tokenを結果に出さず、空認可だけ正常空集合とする。これは同Process Readerの局所成立で、画面・内容操作・起動入口の完成ではない。後続は全入口を要求単位の選択Repositoryへ結合する。

同じ先行接続で`resolveAccessRepository`と`topic-meeting/access-resolver.ts`を追加した。明示IDを今回許可集合へ結合し、非許可／未登録を同じnull、空IDの暗黙選択と起動Root fallbackを禁止する。Topic／Meetingは指定Repositoryだけへ保存し、Relationは同Projectの許可集合を既存Domainへ渡す。自己生成fixtureでTopicの実作成・読戻し、非許可／未登録、公開解除と資格失効、開始前取消を接続し、静的3軸と対象2件成功（15.1860861秒）。単一Repositoryの局所観測であり、複数Repository同名ID・全Relation断面・公開UI／起動・AI／Git全入口は未成立を維持する。Root／操作は当該要求だけに使用し、長期認可cacheを作らない。

Workbench Local CROSの着手前照合では、管理Tokenだけを追加すると起動Repositoryに固定されたContext／Git／Topic／AI／Candidateを迂回公開することを確認した。配布Root（Logo／JS）、Host AM Root（認証／管理）、要求ごとの現在許可内容Rootを分離する。未認証は固定CSR接続画面だけ、本文読取り0。内容入口全数で現在AM許可集合→選択Repository Binding→既存Domain／Version Control／Activityを構成する。長期AI Ownerは処理相関だけを保持し、各操作前に現在認可を取り直す。新Session／Registry／Lockや操作別ACLは追加しない。単体Modeの無資格利用、選択Repository切替、同Project Relation、Git・Profile・AI・Candidate、取消joinを維持する。正本／実装の詳細照合と反証は本番切替前の条件であり、これを管理UIのみの完了へ縮小しない。

Root分離の限定独立再レビューはPass・全重大度残指摘0（基準HEAD `378d93cb`、対象差分Hash `3ae1c501a6632f50ab7d35aa74c659e11825d0fc`）。新Reader固有のRoot／親junction、異OS・相対base、二観測dev／ino差、作成・更新・削除0とmarker不変を反証し、設計・Catalog・QA現在評価を限定同期した。静的3軸と対象16件成功、10.9393098秒。これはRoot分離だけの成立である。

後続MCP Sourceは`--cros --http`をAM Resolverと既存CROS Profile Storeへ接続し、既存状態不明／未設定とTransport混在を開始前拒否した。公開Processの10件成功（6.9804969秒）。自己生成Host fixtureで初回Tool拒否→discoverによる接続確認保存→次要求のadministrator本人取得→同鍵失効後401、鍵Tool非公開と秘密非表示を確認した。配布TS入口は専用ESM型検査と書式・Lintへ追加し、Package本体のNodeNext条件を維持した。全静的検査成功。manager／developer・内容Exposureの公開Process検証、配布Root検証、Workbench本番入口、後続固定候補レビューは未完了であり、この限定成立から本番Capability全体成立を表示しない。

AM全回帰は是正後152件成功、Fail／Cancel／Skip／Todo0、Exit0（172.4159784秒）。前回ハンドル喪失で未確認だった結果を流用せず、新実行の端末終了結果を確認した。旧正式Evidenceや191項目Not Runは変更しない。MCP全回帰は同一の実行を継続して確認する。

先行局所結果：既存Host環境入力選択をRoot Ownerへ移し、通常用の作成0読取りAPIを追加した。AM書式・型・LintとHost入口／公開API契約の15件は成功、失敗・取消・skip・todo0、Exit0（16.7542909秒）。自己生成Host fixtureで不在作成0・既存内容非変更・非Directory拒否を直接確認した。保存内容やLauncher成立はこの試験から推定しない。新固定候補の独立確認と公開入口の接続は未完了。

承認済み単一Repository／CROS利用の本番接続として、既存Workbench入口と配布MCP入口を切り替える。着手前の読み取り専用専門確認を統合し、現在追加の人間判断は不要。通常起動は現在Repository固定、MCP stdioは資格不要、通常HTTPの既存`CRDD_MCP_HTTP_BEARER_TOKEN`はローカルTransportの保護として維持する。`--cros --http`は各要求の現在AM資格へ接続し、固定Tokenとの混在を拒否する。`--cros --stdio`は資格搬送契約がないため開始前拒否する。

CROSの保存先入力選択を既存Host初期化から共用し、通常Launcherは既存Directoryの非Link・親chain・実体Identityだけを検証して読む。Directory作成・初期化・鍵発行は行わない。不在、部分構成、不正、観測不能を未初期化の成功へ変換しない。初回設定は既存Host入口だけが所有する。Workbenchの鍵入力は専用POSTから要求／接続用Memoryへ渡し、CLI引数・環境・URL・Git・応答・log・Browser永続Storageへ保存しない。Local CROSとRemote MCPの混在・暗黙fallbackは拒否する。

維持対象は通常RepositoryのProject Context／Topic／Meeting／AI操作、AMの現在Role・Exposure・失効、初回未完了の限定入口、鍵操作のMCP非公開、既存配布Root検証である。新Session／Registry／Lock／Root Framework、旧形式Reader、Coordinator／Orchestrator／Docker再設計は対象外。

必須検証はmode×transport×資格の起動Matrix、既存／欠落／Link／破損Rootの作成0と内容非変更、実ProcessのCROS HTTP現在認可、Workbench専用POSTと秘密非露出、取消・重複signal後の要求joinとListener／子Process回収、配布入口の不正Root拒否である。Package／Browser回帰、設計・QA・Symbol・台帳の直接伝播と新固定候補の独立レビューを行う。既存47件／Browser7件／Visual27条件はLauncherの成立根拠へ流用しない。旧REST撤去・正式191項目・AM全体完成はこの入口接続と残余Capability確認後に判断する。

### Relation判定のDomain移管 — 2026-10-12

固定11Pathの限定独立再レビューはPass・全重大度残指摘0。初回のexact種別／ID搬送検証、公開操作表、QA正式行の3指摘を是正した。Domain120／MCP61の計181 Case、各書式・型・Lint、差分確認成功（Fail／Cancel／Skip 0、所要時間40.4931327秒／18.1593036秒）。固定kind／固定IDの一時変異は各focused試験で検出し、Source SHA-256 `a17afd01ab2c543916d36bd9e019a0d742c431a2e2d3363b87c82be67f3c3ded`へ完全復元した。自己生成CRUD試験Directory残存0。詳細な実行ログは書庫化せず、Packageの`npm test`と固定反証から再生成する。DomainへのRelation判定移管は局所成立だが、認可自体・AM本番Resolver・全公開操作母集合・全体Readyは未成立である。

基準Commitは`57dfc409`。採用済み責務分離の具体化として、旧MCPのRelation Owner判定をDomainへ移し、認可・同Project集合選定は構成Ownerへ残す。着手前の親照合と読み取り専用確認は着手可。Sourceを集合から導出し、構造不整合は全読取り前拒否、結果は限定fieldから再構成する補強を統合した。新Store／Lock／認可Frameworkは作らない。Domain／MCP回帰、公開API・Symbol、設計・QA・直接参照・差分確認、完成後の限定独立レビューを行う。標準規範とDockerは不変更のため準拠監査・Provider E2Eはこの局所範囲では対象外。AM本番Resolver・Workbench・Launcher・鍵配送・旧CROS撤去・正式191項目・全体完成は未成立を維持する。追加人間判断は不要。

### Project拘束の着手前整合 — 2026-10-12

固定7Pathの限定独立再レビューはPass・全重大度残指摘0。Domain119／MCP61の計180 Case、各書式・型・Lint、差分確認が成功（Fail／Cancel／Skip 0、所要時間41.3263155秒／17.9465809秒）。両種別の拘束付き通常CRUD・削除後不存在と、foreign本文・incoming Relation・注入契約への余分な引数拒否を確認し、自己生成試験Directory残存0。CPR-IT-010／011の局所接続であり、AM本番Resolver・実HTTP・Relation移管・正式191項目評価・全体完成は未成立。巨大な実行ログや新たなEvidence書庫は追加しない。

基準Commitは`6864ad11`。既存設計の同一Project条件を共通保存Ownerへ接続する是正として、Domain公開生成関数・保存・試験・詳細・QAを対象にする。読み取り専用の着手前確認で、保存契約注入への未実装保証付与と、incoming Relationのraw読取り迂回を反証へ追加した。Root＋期待Projectと注入契約をoverloadで分け、指定値不正はRoot観測前、foreign入力は保存前、既存本文と関連候補は公開前に固定例外へ閉じる。新Store／Lock／Parser／Schema／Wrapperは追加しない。必要確認はDomain/MCP回帰、技術・品質の限定独立レビュー、直接文書伝播・差分確認。規範・準拠基準とDockerは不変更のため準拠監査・Provider E2Eはこの局所範囲では対象外。AM Resolver／実HTTP、Relation移管、全体Gateは未完了として保持する。追加人間判断は不要。

### Topic／Meetingの認可前入力検査 — 2026-10-12

基準Commitは`0bb4b5c8`。全12 Toolで共通入力検査→取消→Repository解決一回→取消再確認→Domain操作を接続した。独立レビューの解決例外分類・一覧条件検査順序の2指摘を是正し、既存Domainの純粋検査を共用した。Node v24.19.0でMCP61／Domain118の計179 Case、各書式・型・Lint、差分確認が成功（Fail／Cancel／Skip 0、所要時間19.0879618秒／40.6481743秒）。固定11Pathの限定独立再レビューPass・全重大度残指摘0。新しい保存・認可・Parser・Frameworkは追加せず、巨大な実行ログをEvidenceへ保存しない。次はmanifestと本文のProject拘束、Relation移管、AM要求からTopic／Meetingへの本番搬送である。公開Launcher／Workbench切替・鍵配送・旧REST撤去・正式191項目評価・AM全体完成は未成立。既存の人間回答待ちは維持し、この局所是正に追加判断は不要。

### AMのWindows追加保護を対象外化 — 2026-10-12

基準Commitは`2df488d8`。人間判断により、AM保存専用のWindows ACL検査・修復・Native保護接続を保証と実装Gateから外す。REQ-000041、AM詳細02、QA-000007、本計画、PROJECT_CONTEXTの5文書へ直接伝播する。既存Hostのアクセス制御に依存し、追加ACL保証は提供しない。Root実体・非link・排他・秘密非保存／非公開・現在認可は維持し、他Package／Provider Home／署名鍵の保護は不変更。実Root・ACL・Source・旧Evidenceは変更しない。

着手前の読み取り専用契約確認は着手可。前段のWindows保護接続未成立表示は、この判断前の履歴で現在の阻害条件ではない。固定5文書の契約・品質・直接影響を含む限定独立レビューで旧Gate表示の競合1件を是正し、再レビューはPass・全重大度の残指摘0。参照先欠落0、既存190項目・Not RunとSource／旧Evidence不変更、差分確認成功。標準規則とSourceを変えないため準拠監査・Package回帰・実E2Eは対象外。保存実装全体Readyは未主張。残件は完全Schema・容量・初回／鍵段階・本番接続である。

### AM保存データ・整理単位の具体化 — 2026-10-12

以下はWindows追加保護を対象外化する前の固定候補・レビューの履歴である。Native保護接続の未成立は現在の実装阻害条件ではなく、上段の人間判断に従う。秘密非保存・非公開のSource／Consumer接続は別の残件として維持する。

基準Commitは`69b0a681`。変更分類は採用済み責務の保存設計具体化。AM詳細02§4.4、QA-000007、本計画、PROJECT_CONTEXTの4文書に限定する。編集一次キーは保存包絡・User／Credential・KDF・初回Root／最初の保存・完了相関の整理・容量／保護未確認。旧SourceのVerifier、改訂出版、Root／LockとConsumerを照合し、着手前の読み取り専用契約確認は着手可。一般IAM・ACL Framework・Receipt Store・新Lock・Source／実Store／旧Evidence変更は対象外。

単一currentと短命pendingを使う具体化候補であり、完全SchemaやNative保護接続が完了したとは扱わない。根拠のない集合別件数上限は追加せず、byte予算を比較候補として残す。鍵の期限なし、電源断保証対象外、通常失効・現在認可・破損拒否を維持する。固定4文書の契約・品質限定独立レビューは両方Pass・全重大度の残指摘0。ローカル参照先欠落0、190項目・Not Run不変、Source／旧Evidence不変更、差分確認成功。標準規則とSourceを変えないため準拠監査・Package回帰・実Provider E2Eは対象外。実装Readyは未主張。

### AM保存保証の採用 — 2026-10-12

基準Commitは`7ef32ef8`。Qual-Labは通常保存・読戻し確認までを採用し、電源断直前の更新喪失により失効済み鍵・交換前の鍵・縮小前のRole／Exposure／Repository範囲が再受理され得るリスクを受容した。気付かれなければ明示処置まで続き得る。未実測の可能性であり、物理電源断以外の突然停止は未評価。保証の正本は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)とする。

変更分類は人間が採用した保証範囲・リスク受容の直接伝播。REQ、AM詳細01・02、QA-000007、本計画、PROJECT_CONTEXTの6文書に限定する。着手前の読取り専用契約確認は着手可。通常失効・認可・破損拒否・Process喪失・改訂競合を弱めず、新回復機構・耐久性の追加基盤・電源断試験は作らない。Source、実Store、秘密値、旧Evidenceは不変更。Schema・保護・容量・初回Root・鍵段階・本番接続の実装Gateは維持する。

固定6文書に契約・品質の独立レビュー、参照・直接影響・差分・既存190項目とNot Runの確認を行った。初回の要求内保証範囲と旧判断記録の時点表示の2指摘を統合是正し、限定再レビューは両方Pass・全重大度の残指摘0。ローカル参照先欠落0、差分確認成功、190項目・Not Run不変。標準規則・Sourceを変更しないため準拠監査・Package回帰・署名Provider E2Eは対象外。保証範囲の採用を保存実装成立へ読み替えない。現在、追加の人間判断は不要。

### 保存途中の再入場候補 — 2026-10-11

以下は2026-10-11固定時点の履歴である。保証範囲の人間判断待ちは上段2026-10-12の判断により解消済みで、現在の判断待ちを表さない。

基準Commitは`8847169a`。変更分類はAM保存設計の具体化。固定範囲はAM詳細02、QA-000007、本計画、PROJECT_CONTEXTの4文書で、編集一次キーは保存物・出版順序・base／next／unknown判定・初回非適用・既存品質項目への接続・現在の判断である。親照合と読取り専用契約確認で着手可。再入場は既存の完全currentがある通常保存に限定し、初回相関・鍵Effect・current不在を自動処置へ一般化しない。既存Root・Kernel Lockとexact回収を利用し、新Store・Lock・Receipt台帳・履歴Directoryを作らない。Source・実Host管理Root・秘密・Docker・過去Evidenceは不変更。

単一現在Fileと短命pending、同じ同期排他区間の現在認可・競合・出版・読戻し、既知出版とcleanup不明の別観測を具体化する。契約・品質独立レビュー、文書参照・直接影響・既存IDとNot Run・差分を確認する。実装や標準規則を変えないためPackage回帰・準拠監査・署名Provider E2Eは今回対象外。固定4文書の契約・品質限定再レビューは両方Pass、全重大度の残指摘0。190項目・Not Run不変、差分確認成功。これは候補記録の整合結果で、保存保証の採用や実装Readyではない。初回レビューで電源断直前更新の喪失による旧鍵／旧権限再受理の未確認リスクを検出し、弱い保証での採用推奨を撤回した。通常管理のReceipt非目標を維持し、pending削除後の応答喪失は元要求不明と現在状態を分離する。既知出版を不明に戻さず、旧Owner終了・排他終了から遅延Effectなしを評価する。鍵／認可の電源断後の安全再開・保証範囲・残存リスクは人間判断待ちで、通常6操作の候補をその承認へ読み替えない。Schema、容量、Verifier保護、初回Root準備・最初の出版・鍵段階のpending処置、本番Consumerは未完了で実装Gateを維持する。

### 鍵の期限なしの設計・品質伝播 — 2026-10-11

基準Commitは`b259e51b`。変更分類は採用済み要求の直接伝播。UX-000035／IA-000009／UI-000008／SPEC-000012／ARCH-000013の分析・定義と関連状態投影、SCR-000008／BHV-000012、Access Management詳細01／02、7工程品質分析・QA-000007・Quality Center／Integration、本計画・PROJECT_CONTEXTを対象とする。着手前の親照合と読取り専用品質確認で着手可・追加人間判断なし。編集一次キーは接続鍵の期限なし、資格状態、時間経過と明示失効・現在認可の別、表示・刺激・観測・Oracle・現在OPENである。

現在有効な既存／新規鍵は時間だけで失効・交換せず、明示失効・交換後の旧鍵は拒否し、Role／詳細権限／Exposure変更は次要求へ反映する。形式不正・無効・観測不能の拒否も保持する。失効済みの再有効化と、旧CROS保存形式の移行完了は推定しない。同意、Lease、判断用Capability、Candidate・履歴保持の期限、旧Evidence・旧Source／Schema／Hashは不変更。対応表の旧引用2行は採用前履歴と明示して保持する。新Local Item・UT・Timer・更新Workerを作らず、既存RFD-ST-003／RFD-IT-013／RFD-UAT-007へ観測を統合する。

必須確認は契約・品質独立レビュー、文書・直接影響・期限対象分類・既存ID／段階／件数・参照・差分確認。標準規則・Source・Store・実行境界は不変更なので、準拠監査・Package回帰・署名／Docker／Provider E2Eは対象外。固定32文書の契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。初回レビューの対照条件・現在表示・空白と、再レビューで判明した履歴状態上書きを統合是正し、旧基準Commit・正式入力・限定結果を保持した。190項目ID・Not Run不変、差分確認成功。設計・品質の伝播から保存Gate、鍵発行・配送・公開入口・実E2E・全体Readyの成立を推定しない。

### 鍵の有効期限の採用記録 — 2026-10-11

基準Commitは`d9e0b3d9`。人間は鍵の期限なしを採用した。要求正本REQ-000041と探索履歴EXP-000036、本計画・PROJECT_CONTEXTの4文書へ判断を記録する。変更分類は未決運用方針の確定。親の着手前照合では、期限による自動失効なし、明示失効・交換後の旧鍵拒否、現在Role・公開範囲の要求毎確認、資格や状態が不明な場合の拒否を保持することを確認した。期限なしを無条件のアクセス許可にしない。

独立契約レビュー、文書・参照・直接影響・差分確認を行う。標準規則・Source・Store・実行境界を変更しないため、準拠監査・Package回帰・Docker／Provider E2Eは今回は対象外。既存の過去判断とEvidenceは当時の記録として保持する。UX／IA／UI／SPEC／Architecture／Qualityの期限切れ状態・未決表示への伝播は後続とし、全伝播済みや鍵発行実装Readyを主張しない。保存Gate・実保存・Host入口・発行と配送の未成立は維持する。固定4文書の限定独立再レビューはPass、全重大度の残指摘0。要求内の対象母集団・検証意図・UX引き渡しを同期し、差分確認成功。判断記録の完了としてコミットし、下流伝播と実装の未完了は維持する。

### 初回Host設定の横断モデル・Surface詳細伝播 — 2026-10-11

基準Commitは`fe648037`。正式入力はARCH-000013・Access Management詳細01／02。固定範囲はArchitecture横断01〜08、Workbench／MCP詳細、本計画・PROJECT_CONTEXTの12文書。変更分類は承認済み設計候補の直接伝播。編集一次キーは所有者、初回と通常Host回復の分離、4状態・処理順、非秘密元試行相関、個別事実、失敗分岐、案内／非公開境界、Quality引渡し・現在状態。

着手前の読取り専用契約確認は着手可。発火は既存Root検証・双方未初期化確認・Host明示開始、非発火は既存管理状態・通常鍵喪失、境界は確認済み途中、情報不足は新作成停止と元試行が確認できる場合だけ再観測。Workbenchは初回案内だけ、MCPは初期化一覧・Schema・登録・dispatch・状態照会非公開。元試行の発行／記録不明と確定後の配送／受領だけ不明を分離する。

固定12文書へ契約・品質独立レビューと文書・参照・直接影響・差分確認を実施し、両結果完了後に統合是正する。初回レビューの統合4原因（実行単位表の欠落、Workbench既存担当の狭義化、旧レビュー時点の競合、句点後空白）を両確認者へ再提示・方針整合後に是正した。限定再レビューは両方Pass・全重大度の残指摘0。参照254件欠落0、非対象79行一致、差分確認成功。レビュー後は結果・状態だけ同期した。既存3行だけPartialを維持し、他19 UI・29 BHV・31 Relation、固定8分担、通常Host回復2操作、過去Evidenceを変更しない。新ID・公開API・CLI引数・Store・Framework・Sourceは追加しない。標準規則・Source非変更のため準拠監査・Package回帰・Docker／Provider E2Eは対象外。Quality・物理保存・本番公開入口・実E2E・全体Readyは未完了。追加の人間判断は不要、資格期限は回答待ちを維持する。

### 初回Host設定の基本設計・AM詳細伝播 — 2026-10-11

基準Commitは`ad15d5cf`。正式入力はUI／SPEC独立Architecture分析、配置制約はSCR-000008／BHV-000012。固定範囲はARCH-000013、AM詳細01・02、本計画・PROJECT_CONTEXTの5文書。変更分類は採用済み意味の設計具体化・直接伝播。編集一次キーはOwner、入口、4状態・Sequence、非秘密元試行相関、個別事実、失敗分岐、内部操作候補、検証引渡しと完了境界。

着手前契約確認は着手可。相関確定前UUID／鍵Effect0、短命pendingと耐久進行記録の分離、Root準備の既知Effect保持を計画へ統合した。発火は双方未初期化確認＋Host明示開始、非発火は既存・通常鍵喪失、境界は確認済み途中、情報不足はRoot／観測／排他等不明の新作成停止。初期化・交換・Lock回復を混同しない。単一current／pending／lockは物理候補のまま、別Store・Framework・新安定ID・Source・旧Evidenceを変更しない。

固定5文書に契約・品質独立レビュー、参照・文書・直接影響・差分確認を実施し、両結果完了後に統合是正する。固定候補の契約・品質レビューは同一Minor1原因（Checklist2箇所のOPEN表記）を統合・方針整合後に是正し、両限定再確認はPass・全重大度の残指摘0。参照78件欠落0、差分確認成功。レビュー後は結果・状態のみ同期した。横断モデル・Workbench／MCP詳細・Quality・Source・保存方式採用・本番接続・実E2Eは未完了。標準規則・Source非変更のため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。追加の人間判断は不要、資格期限は回答待ちを維持する。

### 初回Host設定のArchitecture入力分析 — 2026-10-11

基準Commitは`a2f4fe01`。UI-000008とSPEC-000012それぞれ自身のDefinitionだけから独立分析する。固定範囲は両Architecture分析・本計画・PROJECT_CONTEXTの4文書。変更分類は採用判断の下流直接伝播。編集一次キーは初回開始、4状態、ユーザー成立前のOwner、個別事実、元試行と別交換の分離、負契約と検証意図。新ID・API・保存Schema・File・Lock・Source・一般Recovery・過去Evidenceは変更しない。

着手前の読取り専用契約確認は着手可。通常Host回復2操作への限定、初回の所有状態、3つの失敗経路、負契約、現在の未追従範囲を計画へ統合した。発火は双方未初期化確定とHost明示開始、非発火は既存状態／通常鍵喪失、境界は確認済み途中試行、情報不足は別Root・破損・読取不能等の新Effect前停止。元試行の発行／記録不明では再観測だけ、発行・記録確定後の配送／受領だけ不明では作成済みadministratorへの既存Host指定交換を別明示操作とする。

固定4文書に契約・品質の独立レビューと参照・文書・直接影響・差分確認を行い、両結果完了後に統合是正する。標準規則・Source・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。固定候補の契約・品質限定独立レビューは両方Pass・全重大度の残指摘0。参照61件欠落0、差分確認成功。レビュー後は結果と状態だけ同期した。ARCH-000013の基本設計・横断投影・Details・Quality・Source・具体保存・本番接続は初回設定に未追従で、前段Passを工程Readyへ流用しない。現在、追加の人間判断は不要。資格期限の回答待ちを維持する。

### 初回Host設定のUI／SPEC Detail伝播 — 2026-10-11

基準Commitは`6a458972`。正式入力はUI-000008／SPEC-000012の初回設定。SCR-000008、BHV-000012、configuration-trust Area、UI Detail01、Workbench画面構成の追補13、SPEC Detail01、Detail対応02、本計画・PROJECT_CONTEXTの9文書に限定する。変更分類は採用済み判断の下流詳細化・直接伝播。編集一次キーは入口・入力、4状態、個別結果、元試行相関、通常回復との分離、検証意図と引渡し。同じSCR／PRT／Interaction／BHVの操作種別とし、新ID・API・Store・Source・旧Evidenceを追加・変更しない。

着手前の契約確認は着手可。配送と受領、初期化試行と交換Recovery、Detailed Behavior表の各観点の初回負契約を分離する指摘を計画へ統合した。発火は双方未初期化確定とHost明示開始、非発火は既存管理状態・通常鍵喪失、境界は確認済み途中、情報不足は読取り不能等の新Effect前停止。未試行から試行／UUIDを推定せず、双方確認後の新作成を拒否しない。作成済み・発行済みを未初期化へ戻さず、発行／記録不明は元試行再観測だけ、発行・記録確定で配送または受領だけ不明なら作成済みadministratorへの既存Host指定交換を別明示操作とする。

固定9文書に契約・品質の独立レビュー、リンク・文書・直接伝播・ID・差分確認を行い、両結果完了後に統合是正する。標準規則・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。旧31 Relation・旧Gate・通常管理8分担・通常Host回復2操作は維持する。具体表示・Visual・Architecture／Quality／Source・正式QA・実E2E・全体Readyは未完了。現在、追加の人間判断は不要。資格期限は回答待ちを維持する。

現在結果：初回の契約・品質レビューを完了し、現在投影の旧Pass競合、Architecture／Quality引渡し不足、BHV表の文境界、観点数表記の4原因を統合した。両確認者へ是正方針を再提示して整合確認後に是正し、再レビューの書式1原因6箇所も解消した。最終限定再レビューは両観点ともPass・全重大度の残指摘0。参照391件欠落0、未変更31 Relation・旧Hash・Workbench旧Gate本文不変、差分確認成功。レビュー後は結果と状態だけ同期した。Architecture／Quality／Source・実画面・正式QA・実E2E・全体Readyは未成立で、次はArchitectureへ伝播する。

### 初回Host設定のUI／SPEC伝播 — 2026-10-11

基準Commitは`a0766d28`。固定範囲はUX-000035／IA-000009のUI・SPEC分析4文書、UI-000008／SPEC-000012、UI横断01・02・03・05、SPEC横断01・06、本計画・PROJECT_CONTEXTの14文書。各分析は自身の正式入力だけを利用し、Definitionで統合する。編集一次キーは初回開始・4状態・部分結果・権限・負例・後続引渡し。通常Host回復2操作、MCP鍵操作非公開、内容自動付与なしを維持する。新ID・Object・Schema・Source・保存先・期限・旧Evidenceは不変更。

着手前契約確認は着手可。候補の契約・品質独立レビューを両方完了してから結果を統合・是正する。参照・直接影響・差分確認を行う。標準規則・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。Detail以降・全体Ready・実装完成は未主張。

現在結果：初回の契約・品質レビューを完了し、正規の未試行と観測不能の混同、一次変換表の同期不足、途中再入場の二重作成防止義務、レビュー入力Hashの4原因を統合・方針整合後に是正した。中断した再レビューを再開し、書式1原因（6箇所）も是正した。最終限定再レビューは両観点とも全重大度の残指摘0。契約側の直接読取りが環境側で失敗したため、親が現物から取得した該当本文・差分範囲・Hashの固定読取り投影を用いて独立判定し、品質側の現物確認と区別した。参照761件欠落0、過去対応区画不変、差分確認成功。レビュー後は結果・状態のみ同期し、Detail・Architecture／Quality／Source・正式QA・実E2E・全体Readyは未完了。次はDetail・Architectureへの伝播である。

### 初回Host設定のIA伝播 — 2026-10-11

基準Commitは`50f93594`。正式入力はUX-000035だけとし、そのIA分析・IA-000009定義・横断01〜04・本計画・PROJECT_CONTEXTの8文書に限定する。新IA ID・情報Objectを作らず、既存管理能力の開始条件・初期化状態・確認済み初回試行の非秘密相関から、成立したadministratorユーザー・初資格・Secret表示境界へ結ぶ。未作成段階の情報を資格属性だけに閉じず、初回試行を交換Recoveryへ統合しない。

編集一次キーは初回の情報関係、導線、状態・可視性・時間関係、責任、検証意図、後続引渡しとその投影である。未初期化確定時の一度作成・一度受領、既存状態の初期化拒否、未試行／観測不能の試行推定0・新作成0、確認済み途中の同試行再観測、発行記録不明と確定発行配送不明の分離を代表照合する。内容自動付与0・MCP／自動起動0・通常Host回復2操作は保持する。具体Path・Schema・API・Source・期限・旧Evidence・UX13分析は不変更。

着手前の契約確認は着手可・追加の人間判断なし。固定8文書の契約・品質独立レビューを統合し、正式表・関係図・引渡しへの同期不足、既存交換の停止／Recovery条件の初回への混入、表見出し・書式を是正した。最終限定再レビューは両観点とも全重大度の残指摘0。ローカル参照168件欠落0、差分確認成功。標準規則・Source・実行境界を変更しないため準拠監査・Package回帰・Provider／Docker E2Eは今回非該当。UI／SPEC以降・Source・正式QA実行・本番接続・全体Readyは未完了で、次はUI／SPECへの伝播である。

### 初回Host設定のUX伝播 — 2026-10-11

基準Commitは`4cf405d8`。正式入力はREQ-000041の採用済み初回設定。REQ分析・UX-000035・UX横断5文書・本計画・PROJECT_CONTEXTの9文書に限定する。既存の利用範囲を用意・維持・回復する成果の開始条件としてSame統合し、新IDは追加しない。Host明示開始、未初期化確定、表示名、最初のadministrator UUID、鍵一度受領と通常管理への移行を、重要場面・失敗・必要情報・責任・検証意図・IA引渡しへ接続する。

初回設定と通常Host回復の交換2操作を分離する。既存・途中・破損・観測不能を未初期化にせず、作成済みユーザー／発行／記録／受け渡しを別事実として保持する。発行・記録不明は元試行再観測、確定発行後の受け渡し不明だけ既存Host指定交換へ進む。Repository登録・公開・内容アクセスを自動付与しない。資格期限は未決を維持する。

着手前の読取り専用契約確認は着手可、追加の人間判断なし。固定9文書に契約・品質の独立レビューと文書・参照・直接伝播・差分確認を実施し、全結果統合後に是正する。候補は独立レビュー待ち。Source／実行境界／準拠規則を変更しないためPackage回帰、Provider／Docker E2E、準拠監査は今回非該当。IA以降、具体保存・入口・本番接続・正式QA実行・全体Readyは未完了である。

限定結果：固定9文書の契約・品質レビューを4原因へ統合し、観測不能と確認済み途中試行の分離、主要成果への初回利用開始の同期、体験マップの列責務、現在表示・書式を是正した。最終再確認は両観点とも全重大度の残指摘0。対象分析・定義の連続空行0件、参照先360件欠落0、差分確認成功。後続は結果と状態だけ同期した。IA以降・Source・正式QA・実E2E・全体Readyは未完了で、次はIAへの伝播である。

### 初回Host設定の要求反映 — 2026-10-11

基準Commitは`cddd333c`。人間が承認した最小初回設定をREQ-000041の正本とEXP-000036の判断履歴へ反映する。変更分類は採用判断の要求具体化で、固定範囲はこの2文書・本計画・PROJECT_CONTEXTの4文書。親の正本照合と読取り専用契約確認で、通常管理・Host回復との分離、既存Root、秘密非保存、表示名の非Authority、未初期化／途中／既存／不明の境界を照合した。編集一次キーは初回設定の要求・成立条件・失敗・検証意図・UX引渡しとその履歴・現在投影である。

| 代表例 | 期待する処置 |
|---|---|
| 正しいHost Rootで管理状態と途中記録の双方が未初期化と確定 | 明示設定で表示名入力→最初のadministrator UUID作成→同ユーザーの鍵一度表示 |
| 既存管理状態があり、管理鍵だけを失った | 初期化せず既存Host交換2操作を使う |
| ユーザー作成後や資格発行後に中断 | 既知事実と元試行の非秘密相関を保持。確定発行・受け渡し不明なら既存Host指定交換、発行・記録不明なら元試行の再観測 |
| Root不明、破損、読取不能、排他・回収確認待ち | 未初期化と判断せず、新しいEffectを発行しない |

固定4文書へ契約・品質の独立レビュー、文書参照・直接影響確認を行う。標準規則・Source・実環境を変更しないため準拠監査・全回帰・署名E2Eは対象外。UX→IA→UI／SPEC→Architecture／Details→Quality→Sourceへの伝播と具体保存・相関・入口は未完了。新Schema・秘密操作・初期化Source・既存データ移行・過去Evidenceは変更しない。資格期限の回答待ちも維持し、要求の採用を実装Gate成立へ読み替えない。

限定結果：固定4文書の契約・品質独立レビューを統合し、記録日付と現在投影の2箇所を是正した。最終再確認は両観点とも全重大度の残指摘0。相対参照70件は欠落0、差分空白検査は成功。要求反映の限定結果であり、下流伝播・実装・実境界・全体完成の根拠ではない。

### AM固定管理判定の局所実装 — 2026-10-11

基準Commitは`cafdad6c`。変更分類は確定済み固定管理分担のSource具体化。親・契約・品質の読取り専用着手前確認で、保存Gateに依存しない純粋部分だけを先行することを照合した。編集一次キーは新Packageの固定判定、Root公開、対応UT・Symbol・Catalog・この設計接続である。8分担を10具体操作へ分け、三Role×全操作と対象Roleの全組合せを検査する。新ACL、Host操作、認証、保存、鍵発行、内容権限初期値、公開read、旧Consumerは変更しない。既存CROSの代替本番接続は未成立のまま維持する。

新Packageの固定依存は現行CROSと同じ版・Integrityを保持し、外部取得なしでpackage-lockを作成した。既存CROSに導入済みのBiome／TypeScriptを検証用だけに使用し、型検査は既存CROS導入済みの同版tscを使用し、検証コマンドで同版Node型Rootを指定した。新Packageのtsconfig／package／SourceにCROS Path依存は追加していない。新Packageの実行コードにCROS依存はない。format・type・lintは成功、公開Root経由の4 UT Caseは成功（基本分担30判定、Role対象54判定、未知・欠落・余分field、accessor／Proxy非実行・入力不変）。RFD-UT-020に対応する候補試験の局所成功であり、正式Local Item結果／Evidence評価はNot Run。この局所結果は純粋判定の対象範囲だけで、IT／ST・保存・資格・本番接続の根拠ではない。固定20ファイルの契約／品質限定独立レビューを5原因へ統合是正し、最終再レビューは両観点とも全重大度の残指摘0。Source公開集合、検証環境の記録、Header観測範囲、局所実行と正式Not Run、現在投影の限定を揃えた。余計なRuntime exportの一時注入では対応Caseの失敗を観測し、除去後4 Case成功を確認した。V8 Coverageは対象Source2ファイルのline／branch／function各100%。相対リンク913件は欠落0、差分空白検査は成功した。これらは今回の純粋判定候補の限定結果である。標準規則・外部Runtimeを変えないため全回帰・署名E2E・準拠監査は今回対象外。文書・関係・実装影響と独立レビューで固定候補を確認する。

人間はこの作業中、初回Host明示初期化で表示名を受け、最初のadministratorをUUIDで作成し、そのユーザーの鍵を一度表示する最小構成を承認した。通常Host回復は既存ユーザー交換2操作だけで、初期化を回復の抜け道へ転用しない。これは後続のREQ／UX以降へ伝播する判断で、今回の純粋関数へ初期化・Host主体を追加していない。初回設定Source・実データ操作は未着手、資格期限の回答待ちも維持する。

### AM公開読取りの具体化 — 2026-10-11

基準Commitは`190f12c3`。AM詳細02§3.1、本計画、PROJECT_CONTEXTを固定範囲とする。変更分類は採用済み情報境界の詳細設計候補。編集一次キーは公開read結果と操作別投影で、親・契約・品質の読取り専用着手前確認を行った。自己Identity、固定管理能力、内容権限、Exposureによる許可集合を分け、実アクセスを現在管理改訂の保証へ混ぜない。解放不明ではSnapshotを公開せず、既知読取事実を内部保持する候補を選ぶ。新Receipt、Lock、共有State、秘密Store操作、Source、過去Evidenceは変更しない。

文書・直接影響確認と契約／品質の限定独立レビューを実施した。操作候補が対象非依存のAuthorityに見える1原因を統合是正し、対象制約・現在再認可・MCP非投影を明示した。両限定再レビューは全重大度の残指摘0、ローカル参照58件の欠落0、差分空白検査成功。標準規則・実行系を変更しないため、準拠監査・全回帰・署名実E2Eは今回対象外。既存QAの反証面へ接続し、Not Runを維持する。詳細権限語彙、接続表示、鍵相関・保持、初回設定・移行、資格期限と本番接続は未完了。この限定結果はAPI・保存全体の完成ではない。

### AM保存境界の反証と読取り排他候補 — 2026-10-11

基準Commitは`719a835f`。AM02§4.2、本計画、PROJECT_CONTEXTの3文書を固定範囲とする。変更分類は保存詳細の候補選定用局所確認。親と契約・品質の読取り専用着手前確認を行い、Lock競合と改訂競合の分離、再取得結果からのexact回復ID、Reader例外の分類を確認手順へ反映した。Source本番・秘密Store・Docker・過去Evidenceを変更しない。文書・直接影響確認と契約／品質の限定独立レビューを行う。標準の準拠基準や外部Provider境界を変えないため、準拠監査・実Provider E2Eは今回対象外。

同じPCのWindows 10.0.26200.0／C: NTFS／Node v24.19.0で、A保持中のB callback 0拒否、A後の古改訂要求write 0、pending fsync後／rename後のexit(23)と既存exact Lock回収・次更新を確認した。一方、非排他Readerとの並行置換はEPERMを2回観測し、分類実行は41回出版後の次の置換が不成立となりpendingが残存した。Readerも同じ既存Lockへ閉じた対照は100出版成功だが、旧／新各2回の読取りとbusy61・recovery_required1を別に保持する。全子join・自己生成work回収済み。実測は本番AM保存・公開read・状態回復・他環境の証明ではない。

編集一次キーはAM02§4.2と今回の計画・現在投影。同じLockを使うreadは短命Filesystem Effectを持つことを明示し、結果型・認可・解放不明・再取得の本番接続は未完了とする。契約・品質の限定独立レビューで、共通の前段確認時点と観測の狭義化の2原因を統合是正し、両再レビューは全重大度の残指摘0。ローカル参照57件は欠落0、差分空白検査成功。probe script・空子Directoryも回収済み。鍵期限の判断待ちを迂回せず、公開Schema・元発行相関・保持清掃・初回設定の残件は維持する。

### AM保存部品の適合確認 — 2026-10-11

基準Commitは`2b4f56b2`。変更分類は保存詳細の具体化前の技術調査。固定範囲はAM詳細02の§4.1、本計画、PROJECT_CONTEXTの3文書。親と契約・品質の読取り専用確認で既存Root／Lock／読取り部品を照合した。新しいFramework、権限、秘密保存先、Source本番接続、過去Evidenceは変更しない。文書・参照・直接影響確認と契約／品質の限定独立レビューを行い、標準準拠基準を変えないため準拠監査、Docker／Provider境界を触らないため実E2Eは今回対象外とする。

既存Lockは同じRoot／Lockを使う同期協調Writerの候補として適合するが、CROS Root解決は文字列のみで、安全な初回準備を別に接続する必要がある。現在状態・pending・Lockをstate Root直下へ置く候補とし、保存専用の子Directoryを追加しない。Lock回収と鍵交換Recoveryを区別し、既知出版がclose／解放故障で失われない搬送を残件とする。

Windows 10.0.26200.0・C: NTFS・Node v24.19.0で同Directoryの通常置換・byte読戻し100回は一致し、自己生成作業領域を回収した。前段§4.1の確認時点では、並行読取り、Process喪失、他Windows版／Filesystem、Linux、電源断耐久は未確認だった。追加局所結果は§4.2に記録し、本番接続・他環境の未確認は維持する。単一File採用・実装Gate成立・Quality Passへ広げない。鍵期限の運用判断は人間へ確認中であり、未回答を既定値の採用と扱わない。

編集の一次キーはAM02の§4.1と本計画・現在投影の今回節。契約・品質の限定独立レビューで、重複する環境限定とLinux Root説明の計2件を統合是正し、両再レビューは全重大度の残指摘0。3文書のローカル参照56件は欠落0、差分空白検査は成功。Source移管前に公開Schema、元発行相関、配送観測、保持清掃、初回設定の残件を閉じる。限定レビュー完了を物理保存の実装Gate成立へ拡張しない。

### 登録解除・鍵受け渡し判断のQuality全伝播 — 2026-10-11

基準Commitは`c4cd0fd3`。固定範囲はQualityの7工程分析、QA-000007／QA-000009、Quality Center、本計画、PROJECT_CONTEXTの12文書。変更分類は採用済み判断の検証義務への伝播。親による正本照合と契約・品質の読取り専用着手前確認は着手可で、追加の人間判断は不要。Source・Test・過去Evidenceは変更しない。

既存RFD-IT-021／ST-022に同一受付操作・採用改訂の登録／Exposure両除去読戻し、片側／不明拒否、他設定・本体保持、旧実行取消非証明を接続する。RFD-IT-017は元発行Identity再観測と通常発行Recovery新設0、RFD-ST-016は各交換内exactと確定後の別明示交換、RFD-UAT-007は3分岐の理解を確認する。EST-IT-010は非鍵搬送同値、EST-ST-015は鍵Recovery参照も含むMCP4面非公開に限定する。新しいLocal IDを作らず185項目・Not Runを維持する。

編集の一次キーはSource ID／既存Local ID／現在状態節とし、観測・Oracle・終了後条件まで対応させる。片側除去、両除去済みでも旧処理終了未観測、通常発行不明、確定発行後配送不明、別交換と元操作の混同、遅延失効鍵応答を反証する。正当な別操作の新発行を元操作の重複発行0と混同しない。

固定12文書の契約・品質独立レビュー、文書参照・直接伝播・差分確認を実施する。標準規則・Source・実環境・準拠表明を変更しないため、準拠監査・全回帰・Docker／Provider E2Eは今回対象外。固定12文書は契約・品質限定独立レビュー済み、是正後は全重大度の残指摘0。通常WorkbenchとHostのOracle区別、入力文の区切り、現在投影の時点競合を統合是正した。ローカル参照945件の欠落0、Local Item一意185件、差分空白検査成功。結果・状態の同期だけを行い、更新項目Not Runを維持する。物理保存・公開read・元発行Identity／配送観測の具体保存・保持清掃・Source移管・本番接続は未完了で、この更新を実装Gate成立としない。

### 登録解除・鍵受け渡し判断のArchitecture全伝播 — 2026-10-11

基準Commitは`9b278dad`。固定範囲は入力分析2件、ARCH-000013、横断01〜08、Access Management／Workbench／MCP詳細01の3件、本計画とPROJECT_CONTEXTの計16文書。確定UI-000008／SPEC-000012を独立入力として、登録解除の両除去読戻し・対象外保持・取消非証明と、元発行再観測／確定後の別明示交換／現在administrator非接続時の既存Hostを、各Ownerの責務断面へ伝播する。AM詳細02は前段確定入力として変更しない。

変更分類は採用済み判断の設計伝播。契約・品質の読取り専用着手前確認は双方着手可で、現在追加の人間判断は不要。片側除去、両除去済み・旧処理終了未観測、通常発行不明、発行・記録確定後の受け渡し不明、遅延した失効鍵応答を反証対象とする。通常発行のIdentityとCredential IDを区別し、各交換内部のexact相関と別明示交換の別Operationを混同しない。

固定16文書の契約・品質独立レビュー、文書参照・直接影響・差分確認を行う。新ID・API・Schema・Store・Lock・Source・秘密操作を追加せず、他ARCH・31 Relation・旧Ready・過去Evidenceを維持する。標準規則・Source・実環境を変更しないため、準拠監査・全回帰・Docker／Provider E2Eは今回対象外。現在は伝播候補・契約・品質の限定独立レビュー済み・残指摘0であり、Quality・Source・物理保存・公開read・配送観測・保持清掃・本番接続は未完了である。

限定確認結果：契約レビューは残指摘0、品質レビューの現在投影同期漏れ1件を統合是正し、両限定再レビューはPass・全重大度の残指摘0。16文書のローカル参照259件は欠落0、差分空白検査成功。非対象の対応行、旧Ready、過去Evidence、AM詳細02、Sourceは未変更。レビュー後は今回の状態・結果記録だけを同期した。

### 管理API・保存設計の旧OPEN更新 — 2026-10-11

基準Commitは`b7f86571`。確定REQ-000041／BHV-000012に合わせ、AM詳細02の登録解除・鍵受け渡し未確認の処置判断を更新する。本計画とPROJECT_CONTEXTを含む3文書が今回の固定範囲。変更分類は採用済み判断の詳細設計への伝播で、契約・品質の読取り専用着手前確認は双方着手可。新しい人間判断は不要。登録／Exposure片側残存、両除去済みでも旧処理終了未観測、通常発行不明、確定発行で受け渡しだけ未確認、管理認証喪失を照合し、元Identity・各交換exact Recovery・別明示交換の分離を保持する。

契約・品質の限定独立レビューと文書参照・差分確認を行った。新Schema・保存方式・Lock・Source・秘密操作・過去Evidenceは変更しないため、全回帰・準拠監査・Docker／Provider E2Eは対象外。ARCH-000013・入力分析・横断モデル・AM詳細01・Surface詳細・QAへの全伝播は後続であり、この3文書の更新をArchitecture全体完了にしない。物理保存・公開read・配送観測・保持清掃・本番接続のOPENは維持する。固定3文書の限定独立レビューは契約・品質ともPass、全重大度の残指摘0。文書参照54件の欠落0、差分空白検査成功。レビュー後は結果・現在状態だけを同期した。

### 登録解除と鍵の受け渡し未確認のDetail伝播 — 2026-10-11

基準Commitは`14546497`。確定UI-000008／SPEC-000012からSCR-000008／BHV-000012へ詳細化し、Area・Workbench候補§13・Detail入口／対応・Definition対応の下流状態・本計画・PROJECT_CONTEXTの10文書へ伝播する。独立レビューで検出した現在投影の状態漏れに対し、UI概要4文書・SPEC概要1文書の状態だけを追加同期し、15文書へ固定範囲を拡張する。編集は、対象2 Detailの操作・状態・Flow・検証義務の置換、5詳細投影の追従、上位対応と現在状態の同期に分ける。発行／記録不明、確定発行・受け渡し未確認、管理認証喪失の3分岐、登録と対応Exposureの同時除去と取消非証明を全利用側へ接続する。

変更分類は採用済み判断の詳細化。契約・品質の着手前整合確認は統合済みで、追加の人間判断は不要。旧31 Relation・旧Gate・Definition本文／Hash・過去Evidenceを変更しない。新ID／API／Schema／Store／Recovery／取消処置／Visual実装を追加しない。固定15文書へ契約・品質独立レビューと文書参照・直接影響確認を行う。Source・標準規則・実環境を変更しないため全回帰・準拠監査・Docker／Provider E2Eは対象外。今回のDetail候補は契約／品質限定独立再レビュー済み（残指摘0）、Architecture／Quality／Source・実画面・全体Readyは未成立である。

限定結果：契約・品質の独立レビューを3原因へ統合し、現在投影の状態漏れ・Coverage重複・句点後空白を是正した。固定15文書の再レビューは両観点ともPass、全重大度の残指摘0。参照1,055件の欠落0、差分空白検査成功。未変更31 Relation、Workbench旧§1〜12、Definition本文・Hashを保持した。レビュー後は今回の状態と結果記録だけを同期し、過去の計画段階の判定は変更しない。次はArchitecture／AM詳細への追加判断伝播である。

### 登録解除と鍵の受け渡し未確認のUI／SPEC伝播 — 2026-10-11

基準Commitは`562f5aaf`。UI7文書・SPEC5文書・本計画とPROJECT_CONTEXTの計14文書を固定範囲とする。正式入力は確定UX／IAで、観点別分析を独立させ、UI-000008／SPEC-000012で統合する。登録と対応Exposureの同時除去、他対象・本体保持、元発行／記録不明の再観測と確定発行・受け渡しだけ未確認の別明示交換を、表示・動作条件・検証意図・現行1組対応へ伝播する。

変更分類は採用済み判断の工程伝播。契約・品質の着手前整合確認を統合し、同時除去完了／片側残存、発行確定・未確定／受け渡し未確認、現在認可喪失の代表例を正本へ照合した。今回の契約・品質独立レビューと文書参照・直接影響を確認する。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。一般SPECモデルは今回固有の契約Ownerでないため変更せず、旧32組・Hash・引用・Passを保持する。Detail／Architecture／Quality／Sourceは次段として未伝播を維持する。新ID／一般Recovery／Schema／Store／画面配置を追加せず、現在追加の人間判断は不要。今回の契約・品質独立レビューを統合是正し、限定再レビューは両観点ともPass・全重大度の残指摘0。14文書の参照747件の欠落0、差分空白検査成功。旧32組の対応本文・Hash・引用は不変で、Source・Detail・QAは未変更である。

### 登録解除と鍵の受け渡し未確認のIA伝播 — 2026-10-11

基準Commitは`db8b64e2`。確定UX-000035を正式入力としてIA分析・IA-000009・横断4文書へSame統合する。登録状態と公開設定の同時解除・他対象と本体保持、発行／結果記録／配送／受領確認、元発行Identityと各交換内exact Recovery／別明示交換のIdentity、状態別の次行動を既存Objectの属性・関係として具体化する。新Object・安定ID・一般Recovery・Secret保存・自動再発行は追加しない。

変更分類は採用済みUXの情報構造への伝播。着手前の契約整合確認を統合し、固定8文書の契約・品質独立レビュー、文書参照・直接影響を確認した。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。UI／SPEC以降・QA実行・Sourceは追加判断未伝播で、旧限定Passを今回へ流用していない。現在、追加の人間判断は不要である。

今回の限定確認結果：契約・品質の独立レビューを一括統合して是正し、再レビュー後の残指摘は全重大度0。元発行の確認情報は既存資格の属性へ統合し、変換表とCanonical対象表を同期した。発行・記録不明と受け渡しだけ未確認を下流への引継ぎでも区別した。参照160件の欠落0、差分空白検査成功。これは今回のIA伝播範囲の結果であり、下流・実装・実環境・全体品質の成立は主張しない。

### 登録解除と鍵の受け渡し未確認のUX伝播 — 2026-10-11

基準Commitは`913d0ea5`。REQ-000041を正式入力として分析・UX-000035・横断5文書へSame統合する。利用者成果と既存IDを維持し、登録解除後のCROSアクセス停止と本体保持、発行／記録不明と受け渡し未確認の区別、明示新交換と元処理の再観測、管理鍵喪失時の既存Host案内を引き渡す。新しい回復機構・Secret保存・自動再発行は追加しない。

変更分類は採用済み要求のUX具体化。着手前の契約整合確認を統合し、固定候補の契約・品質独立レビューと文書参照・直接影響を確認した。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。IA以降・QA実行・Sourceは未伝播で、旧限定Passを今回へ流用しない。現在、追加の人間判断は不要である。

限定確認結果：契約・品質の独立レビューと是正後の再レビューは最終ともにPass、全重大度の残指摘0。体験章の配置、図の3分岐、各交換内と別交換のIdentity、横断表の列責務、文境界空白の5件を統合是正した。9文書の参照先348件は欠落0、差分空白確認は成功。UXへの限定伝播までの結果であり、IA以降・QA実行・Source・本番接続・UX全体Readyの成立ではない。

### 登録解除と鍵の受け渡し未確認の判断 — 2026-10-11

人間は、登録解除時に対象の公開設定も同時に除去することと、発行・結果記録確定後の受け渡し未確認には秘密再表示・自動再発行をせず既存交換を明示再実行することを採用した。意味の正本は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#発行済みの鍵を受け取れなかった場合)。Repository／Product Dataは削除せず、現在認可・事前表示・既存確認条件を保持する。

基準Commitは`50230c49`。今回はREQ・本計画・PROJECT_CONTEXTの3文書で採用判断を固定する。契約・品質の着手前確認を行い、固定候補の独立レビュー、文書参照・直接影響を確認する。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。新しい鍵発行やHost操作も行わない。

後続の正式順序はREQ→UX-000035の分析／定義→IA-000009の分析／定義→UI-000008／SPEC-000012→SCR-000008／BHV-000012→ARCH-000013／AM詳細→QA-000007とする。既存IDを維持し、横断投影・検証義務・本番Consumerまでの伝播を確認する。AM詳細02の旧OPENは直ちに実装Readyへ変更せず、確定上流から順に更新する。これらの下流は今回未伝播で、先の限定レビューを最新判断のPassへ流用しない。

旧発行／結果記録が確定し、配送／受領だけ不明の場合に限り、新しい明示交換を別Operation／別Recoveryとして開始する。旧事実と旧exact Identityは保持し、先の資格を現在状態から失効集合へ結合する。発行自体・結果記録不明は元の発行Identityと既知事実で現在再観測し、交換由来だけは元exact Recoveryを保持する。通常発行へ交換Recoveryを新設せず、新交換でUnknownを消さない。現在administratorとして接続できない場合は既存Host入口を使う。一般Recovery、秘密再表示、追加認証、未承認の自動再試行は追加しない。

限定確認結果：固定3文書の契約・品質独立レビューは最終ともにPass、全重大度の残指摘0。指定／全員の交換範囲、通常発行Identityと交換exact Recovery、確定／不明の保持、検証意図、旧候補の時点表示を統合是正した。参照先56件は欠落0、差分空白確認は成功。要求への採用判断固定までの結果であり、下流伝播・QA実行・Source・本番接続・Handoff／Readyは未成立。

### 管理API・保存設計の具体化 — 2026-10-11

基準Commitは`a604f323`。固定4文書（AM詳細01・新詳細02・本計画・PROJECT_CONTEXT）で[具体化候補](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md)を整理する。変更分類は採用済み境界の設計具体化。契約・品質の着手前確認を統合し、操作別API・内部と公開readの分離・保存方式比較・出版後故障・一度限りのSecret・全件明示移行を対象とする。固定候補の契約／品質独立レビュー、文書参照と直接伝播を確認する。標準規則・Source・実環境を変更しないため、準拠監査・全回帰・Provider／Docker E2Eは今回実行しない。

単一現在Fileを第一候補とするが、既存改訂Fileの排他的出版をそのまま流用できない。排他Owner、出版保証、保持清掃、公開Schema、Secret受領不明後の処置は実装Gateを阻害する未決として保持する。通常保存＋読戻しのTopic／Meeting判断をAMへ流用しない。追加の人間判断は現段階では不要だが、実データ移行のUser対応や保証拡張では確認する。Source移管・秘密Store操作・鍵発行・旧データ削除は行わない。レビュー結果は固定候補確認後に記録し、候補整理を実装Readyへ読み替えない。

限定確認結果：契約・品質の独立レビューは最終ともにPass、全重大度の残指摘0。操作別前提、旧設定全fieldのOwner対応、排他の未採用条件、登録とExposureの参照整合、入口別配送、評価済みOPENを統合是正した。登録解除時のExposure残存処置は上流未決として維持する。4文書の参照先57件は欠落0、差分空白確認は成功。Source・試験・Checker・実環境は今回未実行／未変更で、既存Not Runと実装Gate未成立を維持する。

第一段階の名称・物理配置整理を基準とし、第二段階は責務、状態所有、公開操作、本番利用側を整理する。Package単位で段階的に実装・検証するが、上位と下位の契約は実装前に一括照合する。Packageの実装完了と、上位Capability全体の成立を区別する。

現行CRDDの工程順序を維持する。既存REQ／UX／IA／UI／SPECの意味を確認し、変更が必要な箇所だけ所有工程へ戻す。その後Architecture基本設計・詳細設計、Qualityの検証義務・検証設計を更新し、実装・検証へ進む。添付の概念図を理由に工程順序を変更しない。

| 項目 | 今回の扱い |
|---|---|
| 人間の許可 | 第二段階の計画作成に続き、2026-10-09に計画Commit後の1〜5着手、続いて1〜8の完了までの継続を許可。CROS Package維持判断は同日の後続判断で見直し、Access Managementへの責務再編を進める。移管の具体Ownerは§11で照合し、未決候補を一括採用したとは扱わない |
| 変更分類 | 非自明な責務再編。公開入口・保存契約・安全境界を変更する箇所は破壊的変更として個別に影響を提示する |
| 変更意図 | 既存採用Capabilityを保持し、重複状態・不要中継・過剰管理を削り、構造を説明可能にする |
| 書込み範囲 | 現在のCRDD Repository。外部Runtime、認証領域、別Repositoryの変更は本計画だけでは許可しない |
| 対象外 | 新しいAI機能、汎用Recovery／Lock Framework、Event Bus、共有実行Registry、先行したLinux配備、氏名・メール・Password・登録申請・IdPを持つ汎用User Account。UUID・表示専用名・Role・Credential紐付けの最小管理は§11で採用済み、正式伝播中 |
| 歴史的Evidence | 当時の名称・署名・Hash・内容を保持。新構成の成立根拠には流用しない |
| 旧形式の移行 | フロントAIの確認・清掃手順が所有する。本番Sourceへ旧形式互換Readerを追加しない。未解決資源・参照を名前だけで消さない |
| v1.0との関係 | 添付は方向性であり、全候補をv0.22必須へ昇格しない。Release範囲・期限は別の人間判断 |

## 2. 着手前の照合と最初のGate

現行の[責務対応資料](Evidence/261007_develop-responsibility-mapping.md)、Orchestrator詳細設計、Package集合・直接importを確認した。現行設計にはCoordinator単体利用、Coordinatorの耐久記録・受領確認、Host排他への上位依存が残り、添付の目標と単なる配置変更以上の差がある。現行CROS HTTP、MCPのShared Host組立て、WorkbenchのPackage内部参照も移管対象の候補である。

現行Source全体・動的入口・配布閉包の全数照合はまだ行っていない。次の対応表を固定するまで削除・置換を開始しない。

| 固定するもの | 必要な内容 |
|---|---|
| 成立済みCapability | 公開操作、利用形態、正常・失敗・取消、過去の成立根拠と現在の限界 |
| 契約と利用側 | 公開API、CLI、MCP、Workbench、scripts、設定、保存値、Symbol、試験、配布・署名閉包 |
| 状態・資源の所有 | Task／Attempt／Queue、結果、Candidate、認証Home、Process、Container、Network、Lock、Recoveryの現在Ownerと移管先 |
| 各Fileの処置 | 維持／移動／統合／分割／廃止／判断待ち。分割では対象Symbolまで特定する |
| 既知不足 | 第一段階の責務混在12件、Native試験のSource分類、4試験SuiteとscriptsのSymbol接続、手動端末Probe、旧Recovery APIの型不整合、持ち越した5C |

旧5Cは免除せず、新しいOwner・必要保証・検証へ対応付ける。ただし旧方式の追加是正を先に完成させてから捨てる進め方は採らない。新契約で不要となる項目には理由を残し、旧Gateを新構成の合格へ読み替えない。

この段階の成果は、責務のBefore／After、依存方向、保持する保証、廃止候補の利用側影響、未決判断である。ArchitectureとQualityの独立確認後、人間が必要な変更を判断し、実装順を固定する。

## 3. Packageの推奨対応順

### 鍵の提示と初回接続確認の採用記録 — 2026-10-12

基準`b406cc81`。人間は、通常発行・交換をWorkbenchへ一度だけ提示し追加受領ボタン不要、初回をHost端末へ一度提示して最初の接続成功を受領・接続確認とする最小構成を採用した。要求正本は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#鍵の提示と初回接続確認の採用--2026-10-12)。通常の管理者画面への提示を対象User本人の受領証明にせず、製品外の安全な引渡しを残す。発行／記録不明と確定発行後の提示不明を区別し、既存再観測／明示交換、秘密再表示0・自動発行0を維持する。

読み取り専用の着手前確認は採用記録へ着手可。現行の通常認証は初回completedを要求し、completedは初回接続確認を要求するため、確認前の通常Authority発行で循環を回避しない。exact初回試行・資格へ相関した限定確認の保存・読戻し・清掃が成立した後だけ通常権限へ進む。内部遷移／handshake、入口Owner、具体観測・公開Schemaは後続設計で確定し、今回AI判断で閉じない。

今回の4文書はREQ41／AM詳細02／本計画／PROJECT_CONTEXT。変更分類は人間判断の採用記録と直接伝播。Source／Test／実Host／秘密／旧Evidence／正式191結果は不変更。契約・品質・文書・直接影響の限定独立再レビューはPass、Critical／Major／Moderate／Minorの残指摘は各0。追加の人間確認操作と既存initializationの機械的判定を分離するModerate1を是正し、差分検査成功。Source・標準規則・Provider／Dockerは不変更のためPackage回帰・準拠監査・署名E2Eは対象外。採用記録後にUX〜Qualityへの正式伝播、具体入口・保存・本番Consumerを接続する。新Receipt Store、追加の人間確認ボタン／独立確認Workflow、Timer、Session、認証Framework、MCP鍵操作を作らない。初回接続確認後だけ通常Authorityへ進む機械的判定は、既存initialization状態・保存Ownerの責務として維持する。

### 鍵の提示方式の工程伝播 — 2026-10-12

基準77e84641。前段は採用記録を4文書へ反映し限定独立再レビューPass。本段はREQ→UX→IA→UI／SPEC→Detail→Architecture→Qualityの依存順で正式伝播する。読み取り専用の着手前確認により、Quality前のARCH-000013・UI／SPEC Architecture分析・AM基本詳細・Workbench境界を追加照合対象とした。具体入口Owner・handshake・Schemaをこの伝播で自己確定しない。新ID／Local Item／Store／Workflow・Source／Test／実Host／秘密／旧Evidence・正式191結果は不変更。文書・意味・直接伝播の限定独立レビューを行い、Package回帰・署名E2E・準拠規範変更は対象外。

最初の固定候補はUX／IAの分析・定義4文書と、UXの体験／提供責務／品質期待3投影、IAのObject／導線／状態責任3投影、本計画の計11文書。限定レビューはCritical0／Major2／Moderate2／Minor1。提示を受領へ強めた表現、現在状態と01入口投影の未同期、UX投影の同文複製、IA補足なしとの矛盾、日付を是正する。統合方針を指摘元へ再提示して整合確認し、01入口2文書を加えた13文書を再確認対象とした。再確認では旧本文の提示時受領表現と表書式が残りMajor1／Minor1。直接母集団を再照合し、Personaの利用場面一件も含めた14文書で通常の提示と初回の同鍵接続確認を全数同期する。Persona自体は不変で、場面説明だけ更新する。投影は各文書の既存UX35／IA9主表へ統合し、補足は元の「なし。」に戻す。通常提示≠対象本人受領、Host一度提示と同鍵最初の接続確認、追加受領操作なし、失敗時の再観測／明示交換を工程固有の意味へ変換する。旧Passを流用しない。UI／SPEC以降の今回差分は未適用、全工程伝播・実装成立は未完了。無関係Persona／Definitionは成果・対象者が不変のため変更しない。

機械確認ではUXの同REQへのfragment違い重複参照を新規指摘として検出し、既存正式入力一件を参照する表現へ是正した。14文書の再確認では、IA一般Metadataに旧配送・受領確認属性が残存するMajor1を検出した。統合方針を指摘元と照合し、通常は発行・結果記録・提示結果（対象本人受領は観測外）、初回だけHost提示と同鍵最初の接続成功による受領・接続確認へ、分析／変換対応／定義／引渡し30行を同期した。新しい受領属性・Storeは作らず、過去CHGの時点記録は保持する。IA-000009の構造指摘はHEADのIA定義bytesをメモリ上の読取り入力として再検査しても存在する。Source・Checkerを弱めず、現行と基準に共通の構造不足として後続の同CHG完結時に照合する。全体Checker成功・IA工程全体完成を主張しない。

14文書の限定独立再レビューはPass、Critical／Major／Moderate／Minorの残指摘は各0。最終Checkerは全体3057 errors／0 warnings、変更14文書では基準から存在するIA-000009構造指摘1件のみ。新規リンク／アンカー指摘0、差分検査成功。結果を現在表示へ同期する。このPassは提示方式のUX／IA伝播差分のみで、IA構造不足、UI／SPEC以降、Source・本番入口・正式検証・全体Readyは未完了。

### 鍵提示方式のUI／SPEC伝播 — 2026-10-12

基準5206b158。前段UX／IAの14文書は限定独立再レビューPass。読み取り専用の着手前照合に基づき、UI／SPEC分析4・定義2・SCR8／BHV12、直接案内・対応投影11の計19文書へ一括伝播する。本計画を追跡に含め、レビュー後の現在地だけPROJECT_CONTEXTへ同期する。通常提示と観測外の本人引渡し、初回Host提示とexact同鍵限定接続確認、追加受領操作なし、確認保存・読戻し・清掃後だけ通常Authority、失敗2分岐を工程固有の意味へ接続する。旧Hash・引用・正式Evidence・旧時点Passは不変更で、現行一組だけ再評価する。

変更分類は採用済み契約の直接伝播。契約・文書・直接影響の限定独立レビュー、リンク・差分・Checkerを確認した。Source／Test／実Host／秘密／正式191結果、新ID／Store／Framework、Visual Baseline・Layoutは不変更。Package回帰・署名E2E・準拠規範変更は対象外。実装参照とSPEC02〜05は既存対象投影がなく変更不要。具体Owner・接続方式・SchemaはArchitectureへのOPEN。初回レビューのMajor2・Moderate1を是正した際に、同じ条件の過剰反復が見出し・状態名・対象外行へ混入したため全124件を撤去し、必要なFlow・終了条件・検証意図・引渡しへ役割別に統合した。現在段落の誤Passと表記も修正し、固定20文書の最終限定独立再レビューはPass・全重大度0。通常Secretは用途限定・短命な搬送による一度提示だけとし、一般MCP／DTO／履歴／Log／Evidenceへ公開しない。旧引用・Hash・時点結果は不変更。今回のUI／SPEC伝播差分だけを閉じ、後続Architecture／Quality／Source・実画面・正式検証・全体Readyは未成立。

Checkerは現行20文書と全変更MarkdownをHEAD bytesで読んだメモリ基準入力の双方で3057 errors／0 warnings。対象の16 code／path指摘は基準にも存在し、旧記録と現在Definition集合のFingerprint不一致も両方に残る。新規リンク／アンカー指摘0。これを全体Pass・既存指摘解消の根拠にせず、同CHG完結時の構造不足照合へ残す。新版へ合わせて旧Hashを書き換えない。

### 最小鍵提示方式のArchitecture伝播 — 2026-10-12

基準`07d21331`。UI／SPECの限定Passは伝播入力であり、Architectureの完成根拠へ流用しない。UI8／SPEC12の分析2、ARCH13、AM詳細2、横断01〜08、Workbench／MCP境界、旧CROSの置換案内の16文書を対象とし、本計画を含む17文書を固定候補として契約・文書・直接影響の独立レビューへ渡す。通常は操作administratorのWorkbench一度提示、初回／Host交換はHost端末提示、通常本人受領は観測外、追加受領操作・Receipt・Session・Store・Lock Frameworkなしを維持する。

初回はHost提示→exact同鍵限定接続成功→確認の保存・読戻し・短命材料清掃／Lock終了→completed／通常Authority。各段階の未確認・失敗・観測不能は完了表示と通常Authorityを阻止する。清掃は有効資格の削除ではない。接続Owner・Protocol・保存Schemaはこの直接伝播ではOPENのままとし、次の実装設計で閉じる。現Sourceでは通常認証がcompletedを要求し、MCP本文前Resolverから呼ばれるため初回へ流用できない。初回本人照合だけで通常権限を与えない。

Host明示交換後は、同じ初回attempt／userの確認対象を直近提示した新資格へ結び直す必要がある。現Parserは初回credentialの元operationId＝attemptIdを要求するため、そのまま新交換資格を適用できない。初資格の歴史的参照と確認対象Bindingの具体形状は次段で確定する。旧発行の既知事実を新交換成功で上書きせず、元Secretの受領・rollback・取消完了を推定しない。

変更分類は採用済み契約の直接伝播。固定17文書の伝播差分は契約・品質限定独立再レビューPass・全重大度0。旧受領方式の現行表・OPEN残存を全数是正し、旧field集合をAM02の現Source比較へ分離した。非鍵管理の結果受領1行への誤置換は基準へ復元した。旧限定Passは固定版履歴に限定する。Source／Test／Schema実体／Host／秘密／旧Evidence／正式191・E2Eは不変更。Package回帰・署名E2E・準拠規範監査はこの文書差分の対象外。Qualityへの負条件・観測義務は引渡しに保持し、QA-000007等の実定義は次段で更新する。旧CROS本文全体を現行化せず、代替本番接続の確認前に撤去しない。AM全体完成・Architecture Ready・Release可能を主張しない。

Checkerの候補と全変更MarkdownをHEAD byteへ差し替えたメモリ内基準入力は双方3057 errors／0 warnings。対象17Pathは既存`ui-spec-detail-downstream-coverage-invalid`の同じ1 code/pathのみで、新規リンク／anchor指摘0。全体Passには使わず、正式検証と構造不足の解消は同CHGの残件として保持する。最終意味是正は見出し・リンク・IDを変更せず、差分空白確認成功。巨大な実行結果の書庫は追加しない。

### 初回限定接続と確認対象Schemaの具体化 — 2026-10-12

基準`5a8f6ce9`、着手時clean。採用済み最小提示方式のArchitecture具体化としてAM詳細2文書とMCP／Workbench詳細を更新する。着手前の親照合・読み取り専用専門確認は、限定要求の完全検査→AM同Lockでfresh相関→確認保存・読戻し・短命清掃・Lock終了→応答の順を推奨、追加人間判断不要とした。通常Authorityは次要求で取り直し、鍵管理をMCPへ公開しない。Client応答受領保証・追加ACK・新Session／Store／Lock・実Host処置は対象外。

後応答のfinishから保存する案は、Client受領保証を強めず、応答後故障窓と秘密を保持する後続lifecycleを増やすため不採用。現MCPの通常認証はcompleted必須で本文前に実行するため、用途分類と完全検査後の限定確認を分ける。Workbench現接続は旧RESTで未成立、同一UI操作から限定discoverとfresh通常読取りへ切り替える。任意MCP Clientへの対応をこの固有Protocolから推定しない。

目標Schemaはrevision 2、通常presentationと初回connectionの事実を分離し、歴史的initialCredentialIdと直近confirmationCredentialIdを保持する。Host交換の新資格保存・確認対象Binding更新を同改訂、提示成功は後続別出版とする。v1耐久状態の実在棚卸し・フロントAI移行はOPEN、旧confirmedの自動転用と互換Readerを作らない。Source／Test／実Schema／Host／秘密／正式Evidence／191項目は不変更。

今回の5文書差分は契約・品質の限定独立再レビューPass・全重大度0。提示前unconfirmedの保存とサービス側出力観測、非秘密exact Bindingからの遅延確認、現行OPENの役割分離を是正した。正常／不正／競合／取消／保存・応答故障の反証を既存初回Local Itemへ引き渡し、Quality定義とSourceを次の候補で接続する。Checkerは候補・同5文書をHEAD byteへ差し替えたメモリ内基準ともexit 1だが対象5Pathの指摘0。最終是正は見出し・リンク・ID不変更、差分空白確認成功。全体Passとは扱わない。Source不変更のためPackage回帰・Provider／Docker E2Eは今回未実行。準拠規範・Releaseを変更しないため準拠監査は実行せず、AM全体完成や実装Readyを主張しない。

### 最小鍵提示と初回接続のQuality接続 — 2026-10-12

基準`be4d5064`、着手時clean。変更分類は採用済み最小提示・初回限定接続・v2目標Schemaの品質設計への直接伝播。親の導出元／既存Item照合と読み取り専用の品質着手前確認は、既存項目へ不足なく接続可能・追加人間判断不要とした。編集はQA-000007／009、REQ／UX／IA／UI／SPEC／ARCH／Detailの7分析、Quality Integration／Center、本計画の12文書。品質戦略は意味変更がなく対象外、Source／Test／Host／秘密／旧Evidence・正式結果は不変更。

RFD-IT-017は提示前unconfirmedと一度出力・提示結果別出版、IT018は独立失効後の遅延通知拒否、ST016は交換と現在資格への提示相関を検証する。初回のIT024／025、ST026、UAT027とUT028へ完全discover・同Lock fresh・初期資格／確認資格の区別・応答前確定・次要求の通常認証、取消・競合・応答喪失・v2拒否面を接続する。EST-ST-015は鍵／初期化開始／状態Reader非公開・呼出し0と、正規の初回確認Owner exact 1回を区別する。新Item・ID・ACK・Receipt・Session・Store・Lockは作らず、191項目・段階・日本語Condition Class・正式Not Runを維持する。

編集は現行の鍵関連導出・Item・統合行に限定し、非鍵のConsumer結果受領・Topic／Meeting・通常管理保存・内容権限・旧固定版の局所結果を変更しない。義務／検証設計／実行結果を分け、候補12文書の契約・品質限定独立レビューとリンク／差分・集合照合を実施する。今回は文書設計でProvider／Docker実行・Package回帰・準拠規範監査は対象外。必要なSource／Parser／公開API／保存／本番Consumer・実境界の確認は続く同目標のGateであり、将来へ免除しない。候補12文書の限定独立再レビューはPass・全重大度の残指摘0。正式191行のID・段階・Condition Class・実行形態の基準一致と差分空白確認は成功。全体Checkerの既知3057 errorsは未解消。次の計数同期をSource接続前Blockerとし、実装Ready・AM完成を主張しない。

### 管理操作の計数不整合 — Source接続前の既存Blocker

最小提示Qualityの再レビューで、既存の現在文書に「通常6操作」が残る計数不整合を確認した。SourceのUser管理4操作とRepository管理3操作は通常7保存操作である。固定管理判定はProfile管理1種・鍵3種を加えた11要求種別。REQ-000041の表は対象Role別に分けた9分担行であり、操作数ではない。Profileの一覧／登録／変更／削除を1つの認可要求`manageAiProfiles`で判定するため、11を全公開API数と呼ばない。

これは今回の提示差分による実装欠落でも、Sourceの許可範囲を増減する判断でもない。Ownerの現在本文と直接投影を別の固定候補で「9分担行・11認可要求種別・通常7保存操作」へ同期する。REQの9行表、過去固定8／通常6の時点履歴、旧Evidence、実装権限は変更しない。担当Qual-Lab、再評価契機は今回限定Quality差分のコミット直後。次のSource接続・正式項目実行・本番Consumer着手までの必須Blockerであり、将来改善として保留しない。今回の限定差分PassだけでQuality全体Pass・Source Readyへ進まない。

### 管理操作の計数同期候補 — 2026-10-12

基準`9450f111`、着手時clean。変更分類は既存の管理分担・認可要求・通常保存操作の計数訂正と直接伝播。親照合と読み取り専用の契約・品質確認は「Role別分担9行／11認可要求種別／通常保存7操作」で一致し、新しい人間判断は不要。Role表の9行はAPI件数ではなく、Profileの4操作は共通`manageAiProfiles`で認可する。通常保存7操作はUser4＋Repository3で、ProfileのCatalog、鍵Lifecycle、初回設定・Host交換を含めない。

現在のREQ／IA／UI／SPEC／ARCH／Detail／Qualityと直接投影を編集一次単位として分類し、旧時点の限定レビュー・候補結果・Evidenceは維持する。SPECの現行分担表だけに漏れていた採用済みProfile行を既存本文と同じ許可条件で補い、実装Headerの「11実操作」を「11認可要求種別」へ訂正する。Sourceの処理・公開型・許可集合・Test・実状態は不変更。191正式項目のID・段階・条件分類・実行形態・Not Runを維持する。AM詳細§2の計数表が現在の具体母集合を所有し、他工程は意味に応じた要約を置く。

必須確認は現行誤計数の残存分類、Role分担表とSource discriminator／保存入口の一致、191正式行の構造照合、差分空白・直接参照、および固定差分の独立レビューである。標準規範・権限の採用・実操作は変更しないため、準拠監査・Provider／Docker E2E・Package回帰を本候補の完成根拠には使わない。固定41Pathの最終限定独立再レビューはPass・全重大度の残指摘0。計数Blockerは解消した。候補と文書をHEAD byteへ差し替えたメモリ内基準はともにChecker 3057 errors・0 warnings、対象12指摘の内容も同じで、新規指摘の増加なし。最後の語句是正は見出し・リンク・ID不変更。191正式行の属性一致と差分空白確認も成功した。Source Ready・AM完成・全体Checker Passは主張しない。

### 管理状態Schema v2の実装候補 — 2026-10-12

基準`d589fcc9`、着手時clean。変更分類は採用済み最小提示方式への保存型・Parser・初回資格Writer・利用側試験の切替。親照合と読み取り専用の契約・品質確認で、初回中の単一Host交換、失効途中の旧確認参照、新資格と確認対象の同改訂結合、初回完了後の歴史IDと後続交換の分離を確認した。未解決交換0をcompletedの全Snapshotへ要求すると既存の通常交換能力を失うため、初回確認の出版条件だけに適用する。新しい人間判断・Store・Lock・Receipt・互換Readerは追加しない。

Sourceは状態contractのschemaRevision 2だけを受付け、資格presentationと元初資格／確認資格の相関を検査する。初回資格Writerは両ID同値・not_attemptedで保存し、同元試行への再入場ではSecretを返さない。別contractのpending revision 1と、通常保存のbase／next／unknown・現在認可・既存資源回収を維持する。AM全回帰とMCPの実HTTP利用側回帰、静的3軸、限定独立レビューを実行する。旧実Host状態・秘密・Evidence・正式191項目の結果は変更せず、v1は起動拒否となるため実状態棚卸し・フロントAI移行はOPEN。

旧field／旧版拒否、Host交換のprepared／revoked／新資格、誤結合・Workbench初回交換・複数交換・元発行違い・資格欠測、元提示不明を保ったcompletedと後続交換を反証した。実Filesystemの失効途中Snapshotはread可能でも両認証が拒否し、byteを変更しないことを確認した。固定8Pathの限定独立レビューはPass・全重大度の残指摘0。AM64／MCP68の計132 Case、各静的3軸・差分空白確認は成功。MCP回帰には旧REST／Shared比較Consumerを含み、本番代替入口の完成証明ではない。提示の先行unconfirmed出版・実TTY／HTTP一度出力、遅延提示確認、初回確認出版・公開Protocol／Launcher、通常鍵3操作・Host交換の本番Writerは残る。実Host移行・初回全体・AM完成・Release可能を主張しない。

### 資格提示状態の保存候補 — 2026-10-12

基準`54de8db6`、着手時clean。変更分類は採用済み一度提示の前後状態保存と非秘密exact相関の実装。親照合・読み取り専用の契約／品質確認で、confirmedには元発行・資格・提示Operation・期待改訂をすべて要求し、初回交換中は単一Host新資格保存段階だけ許可することを固定した。純粋な閉入力と対象判定をcredential/presentation.ts、既存Lockと物理出版をstate/file-store.tsへ置く。新Store・Lock・Receipt・一般Recovery・秘密の再取得APIは作らない。

`recordCredentialPresentation`は信頼済み内部RootのConsumerだけに使用し、MCP／HTTP操作へ公開しない。開始成功はunconfirmedの別出版・読戻し・材料清掃・Lock終了後の非秘密Bindingだけを返す。観測後のconfirmedは同じ提示Operationと現在資格をfresh照合する。再入場・不一致・失効・交換・別改訂では更新0。資格以外の状態・初回歴史IDは保持する。出力観測・生Secretの短命所有・Workbench管理認可・実TTY／HTTP Consumerは次に接続する。

局所6 Caseは、三状態×二target、exact各軸・失効、初回／完了後×Host／Workbench交換、rename・読戻し・材料清掃・Lock解放故障を実Filesystemで確認した。局所成功後のAM全回帰で、新内部APIをRuntime公開一覧へ追加する追従漏れ1件を検出し、明示集合にそのSymbolだけを追加した。権限判定や未知公開の拒否は弱めていない。Headerの計数と古い公開範囲説明も現在集合へ同期した。独立レビューのMajor 1件は、出版済みpendingの処置より先に再入場を拒否して清掃完了を誤表示する順序であった。既存pendingをexact処置してから対象を選び、処置した呼出しはBindingなしで停止するよう是正した。故障別の再入場でcurrent byte維持、未出版材料保持、出版済み材料不存在、既存Lockのexact回収と再表示拒否を確認した。是正後の局所6／AM全70 Case・AMとMCPの各静的3軸・差分空白確認成功、固定7Pathの限定独立再レビューPass・全重大度の残指摘0。これは保存側だけの局所成立であり、正式191項目・実Host状態・旧Evidence・実TTY／HTTP Consumer・AM全体完成は未変更。

### 初回接続の用途判定と確認保存候補 — 2026-10-12

基準`d7810f50`、着手時clean。変更分類は採用済み初回限定接続の内部認証・確認保存実装であり、Role権限・Schema・準拠基準は変更しない。Architecture／Qualityと既存通常認証・保存Capabilityを親照合し、読み取り専用の専門確認を統合した。技術・品質の独立レビューと実Filesystem／KDF／既存Lock／子Process故障の反証を行い、工程・準拠契約の変更がないため全工程監査・準拠監査は追加しない。新しい人間判断はない。

`resolveConnectionAuthentication`は一回の同Lock認証から通常本人または非Authority初回相関を返す。完全discover検査後の信頼済みConsumerだけが`confirmInitialConnection`を呼び、同じLockで資格・提示confirmed・元試行／User／最新確認資格・改訂・未解決交換0を再照合する。初回completedへ一出版し、その直後改訂と同歴史相関だけを再観測する。保存用operationIdは一回生成するが、User・資格・元試行・Sessionは追加しない。閉入力と純粋条件はcredential/initial-connection.ts、物理処置は既存state/file-store.tsへ置く。Signalは開始前Gateとし、同期保存開始後の取消はConsumerが保存終了後に応答を抑止する。

局所8 Caseは、候補に通常本人権限を含めないこと、同相関一出版と直後だけの再観測、後続改訂拒否、閉入力・開始前取消のRoot／KDF 0、相関四軸、失効／提示／交換、四保存故障、同期保存後の取消による既知出版保持、実子Process喪失、並行二Process一出版、不正材料保持を確認した。独立レビューのModerate 1件は、故障後の次要求が通る用途判定の試験不足であった。四故障それぞれについて直接confirmと次要求Resolverを独立fixtureで確認し、未出版は状態未確認・材料保持、出版済みはexact処置後normal・全材料とLock不存在・次通常認証成功、current byteとUser／資格各1の不変を確認した。Sourceの追加是正は不要だった。修正後の局所8／AM全78 Case、AMとMCPの各静的3軸・差分空白確認成功、固定7Pathの限定独立再レビューPass・全重大度の残指摘0。

本候補は保存側の部分実装で、完全discoverの公開検査・実TTY／HTTP提示・Host初期化入口・Workbench本番接続・正式191項目・AM全体完成を主張しない。実Host状態、旧Evidence、Schema、既存鍵の秘密には触れない。次はMCP完全要求検査から本保存Ownerを呼び、保存終了後の取消を応答前に再確認するConsumerへ接続する。

### MCP初回限定接続の局所Consumer — 2026-10-13

基準`5cba8653`、着手時clean。変更分類は採用済みMCP初回限定要求と保存Ownerの接続であり、Role・Schema・公開鍵操作は変更しない。親照合と読み取り専用の契約／品質確認を統合し、通常discoverの検査・応答を単一pure Ownerへ共通化、確認失敗の固定非開示写像、HTTP認証観測と確認出版0の分離、実HTTP保留／切断／取消／同Binding並行の反証を固定した。技術・品質の限定独立レビューと関連AM／MCP回帰を行い、準拠基準変更・工程改訂・外部送信を伴わないため準拠監査や外部実Provider E2Eは追加しない。人間判断はない。

`createAccessMcpResolver`のnormalは既存通常Handler、initialはTool依存なしの限定Handlerへ分ける。`request/discover.ts`が完全Protocol検査と固定非秘密応答を通常Route／初回で共用し、正規discoverだけ既存`confirmInitialConnection`をexact一回呼ぶ。保存／清掃／Lock終了後、Signalを再確認して成功公開を止める。Header用途判定後の不正HTTP本文では認証観測はあり得るが確認出版0とする。新しいStore・Lock・Session・ACK・MCP鍵操作は作らず、Transportの既存順序と終了処理を維持する。

試験の初期差は、Lock内部のrenameをcurrent出版へ混ぜた計数、一覧SchemaがCatalog本文を読まない既存契約に対する期待違い、故障注入の対象範囲であった。正式currentのexact Pathだけを出版観測・rename故障対象にし、正常意味や未知入力拒否を弱めない。故障試験が失敗して残した自己所有Node試験Processはexact PID／CommandLineを確認して終了し、再実行でListener closeを必ず待つよう修正した。強制終了付きの実行は原因診断だけで完成根拠へ流用しない。

独立レビューのMajor 1件は、新Source／試験の台帳登録不足とITからSTへの直接Traceであった。局所試験はQA-000007のRFD-IT-024／025へ限定し、EST-ST-015には必要な入力断面を供給するだけで正式ST未成立／Not Runを維持する。MCPのdiscover／初回Handlerと試験をsymbol.json・Test Catalogへ登録し、先行したAM提示／初回接続Source・試験の未登録も同じ原因として是正した。既存state保存試験のRFD-IT-017／018と提示SourceへのRelationも同期した。Schema・実測Source・正式結果は変更しない。修正後の局所7／MCP全75 Case・AM／MCP静的各3軸・差分空白確認が成功。AM全78 Caseも同じSource候補で成功した。台帳ID・Pathの一意性と全登録Path・test-suiteのCatalog接続、自己生成試験Root残存0を確認した。Repository Checkerは3057件・exit1を維持し、AM／MCP／test-catalog対象Pathの指摘抽出0。固定10Pathの限定再レビューは全重大度の残指摘0で、保存側と局所HTTP接続の範囲だけ成立した。旧CROS／Shared・公開Launcherの既存回帰を新AM Launcherの成立へ流用しない。公開Launcher／Workbench／Host TTY、実Host旧状態移行、正式191項目、AM全体完成は未成立のまま維持する。

### Host初回段階の非Authority読取り — 2026-10-13

基準`df4593f4`、着手時clean。Host初期設定の着手前照合で、既存保存APIを直列呼出しするだけではProcess喪失後の元試行を再取得できず、新しいattemptIdで途中状態を拒否することが分かった。親照合と読み取り専用の契約確認を統合し、既存正本のHost専用Readerを先に接続する。変更分類は初回の再入場に必要な非Authority読取りで、Role・Schema・初期化Authorityは変えない。技術・品質の限定独立レビューと実保存・故障・実Process喪失の局所反証、関連AM／MCP静的確認・回帰を行う。準拠基準改訂・外部送信・実Host操作がないため全工程監査・実Provider E2Eは追加しない。人間判断はない。

Readerは既存Root／Lock／current／pending／replaceを使い、完全状態・既知出版清掃・Lock終了後にfresh／in_progress／existingを返し、不明はunknownへ閉じる。生成済みID・提示段階・交換有無を非秘密に搬送し、追加User・資格・UUID・Secret再取得は0。freshは最新AM入力三Fileの不存在だけでHost開始許可ではない。旧二Directoryの不存在・旧Writer停止、Root準備はHost切替Ownerが別に扱い、フロントAIによる旧構成清掃／停止が未確認なら初期化しない。旧形式Reader・新Store／Lock／Process Registryは作らない。

純粋投影をinitialization/host-state.ts、物理Readerを既存state/file-store.tsへ配置し、Package Root・Symbol・既存保存IT／Test Catalogを同期した。RFD-IT-024／025の部分接続で、正式191 Not Runを維持する。局所3／AM全81 Case、AM／MCP静的各3軸・差分空白確認成功、固定9Pathの限定独立レビューPass・全重大度の残指摘0。freshから各生成段階・提示段階・completed、current欠測とpartial／孤立材料・初回base材料・Lock解放不明を反証し、実子ProcessのUser出版直後喪失から同attempt／Userを再観測して追加User0・同Userへの資格を確認した。台帳Path・Symbol IDの一意性、test-suite全Catalog接続、自己生成試験Root残存0を確認した。Root準備・Host初期化composition・実TTY一度提示・鍵交換・実Host移行・本番入口・AM全体完成は未成立。次はこのReaderで再観測した保存段階を使ってHost入口と一度提示を結ぶ。

### Host初回保存段階と一度提示の接続 — 2026-10-13

基準`51ec76c1`、着手時clean。変更分類は採用済み初回設定の保存APIとHost提示Consumerの接続。親の正本・直接利用側照合と読み取り専用契約確認で着手可、追加人間判断なし。既存検証済みRootを入力として、freshだけ旧二領域不存在を生成前と相関保存Lock内で照合、保存済みcorrelated／user_storedは元試行で再開、credential_storedは秘密再取得・再表示0とする。提示前unconfirmed保存の全終了後だけ鍵行をTTYへ一writeし、callbackをjoinしてから非秘密相関でconfirmedを保存する。取消・error・closeが先なら遅延callbackで成功へ戻さず、共有stdoutはend／destroyしない。Node v24.19.0の[Writable契約](https://github.com/nodejs/node/blob/v24.19.0/doc/api/stream.md#writablewritechunk-encoding-callback)を確認し、falseは再送条件でなく追加書込みの停止、callback error後のerror通知は当該Listenerで処置する。callback未着では完了を捏造しない。

編集はAM initializationの実処理、Package公開集合、既存保存ITとSymbol／Catalog、詳細設計と現在結果投影に限定する。既存Root／Lock／保存Schemaを再利用し、旧Parser・新Registry／Lock／Recovery・OS追加認証・Secret保存は作らない。局所故障・段階別再入場・書込み順序・Listener回収と関連回帰、固定候補の限定独立レビューを行う。Root準備・CLI最終入口・実TTY／Workbench本番接続・正式191項目・AM全体完成は本局所試験から主張しない。標準準拠基準・外部Provider境界を変えないため、全工程監査・実Provider E2Eは本差分の確認には追加しない。

局所6 Caseの初回実行で、正常認証の期待statusを旧名authenticatedとしていた試験差を検出し、既存APIのcompleted／unavailableへ修正した。Sourceの成功条件は弱めていない。独立レビューMajor 1件は、write callback後のerror／close通知tickでfailedを再確認せずconfirmed保存へ進む可能性だった。最終解決時のfailed再評価と、callback成功直後のerror／close反例を追加した。Listener保持中の通知は失敗へ、解放後の別stream故障は完了した提示へ遡及させない。再レビューは固定8Pathの限定Pass・全重大度の残指摘0。

修正後の局所6／AM全87／MCP全75 Caseが成功、Fail／Cancel／Skip0、各Exit0。Node v24.19.0、AM／MCPの書式・型・Warning禁止Lint各3軸、差分空白確認成功。基準OIDはsha1 `51ec76c1a35e0fa1db192162b21b51ad44285717`、実測Source Blobは`74882a32794971faa83227952617806ac9cfb22b`、保存IT Blobは`5f29d9d8f3d9637d277b42bcc6b1f4689dda9f6b`で、開始から終了まで不変。Root内生成物はFixtureが回収し、終了後のaccess-management-store-*残存0。Symbol／Path重複・登録Path欠落0を確認した。再生成は各Packageのnpm testと既存state ITのHost初回名称絞込みで可能なため、実行別ログの書庫は作らない。RFD-IT-024／025の局所断面であり、実TTY・Host Root準備／CLI・通常鍵管理／Host交換・Workbench本番接続・旧REST撤去・正式191項目・AM全体完成は未成立。MCP回帰に含まれる旧REST／Sharedの比較成功を本番代替の完成へ流用しない。

### Host保存先準備と正式初回入口 — 2026-10-13

基準`f0effe23`、着手時clean。親の正本・Source・配布入口照合と読取り専用契約確認は着手可、追加の人間判断なし。既存CROS Root Resolverが返すstateだけをHost準備Ownerで扱い、OS baseから不足chainを非再帰mkdirして各段階を再検証する。EEXISTは再観測、他故障は停止し、exact作成集合を内部結果へ保持する。失敗をEffect0にせず、権限修復・自動削除はしない。旧管理／旧回復領域の既知存在と観測不能を別理由へ閉じ、ENOENTだけ不存在にする。Root交換・link・file親・部分作成・競合を反証する。旧Writer停止／旧入力清掃はフロントAIの切替前提で、Sourceへ旧Parser・共有Lock／Registryを追加しない。

正式入口はPackage名と一致するbin/access-management.tsと配布用crdd-access-management.ts。薄い入口から公開されたHost commandへ委譲し、--help／未知・重複・位置引数／環境不足／未対応OS／非TTYではRoot準備・prompt・保存0とする。その後にRoot準備・表示名一回入力・既存initializeFromHostへ進む。readlineは自分のinterfaceだけfinallyで閉じ、共有stdin／stdoutをend／destroyしない。内部作成Path集合は公開CLIへ出さず、固定理由と準備Effect有無へ写像する。Source・公開集合・package設定・Symbol／Catalog・局所試験・詳細設計を同期し、静的／関連回帰・独立レビューを行う。実Host秘密Root、旧Evidence、外部Providerは不変更。実TTY縦断・通常鍵／Host交換・Workbench本番接続・旧REST撤去・正式191項目・AM全体完成は本局所確認から主張しない。

修正後の局所9件・競合1件、AM全96件、MCP全75件が成功し、Fail／Cancel／Skip0、各Exit0。AM／MCPの書式・型・Warning禁止Lint各3軸と差分空白確認も成功した。Symbol ID重複・登録Path欠落0、Host試験Root残存0。固定14Pathの限定独立再レビューは新規指摘0、全回帰完了を条件とした限定Passであり、その条件を同候補のAM96件で確認した。未作成の明示state baseはexact最寄り既存祖先から作成し、Git worktreeの通常file markerを既存Root検証と分離して受理する。末尾separator／`.` segmentは既存Resolverと同じRootへ正規化する。Root dev／ino比較はBigIntで行い、Numberの精度へ依存しない。実Linux Filesystem・実Host TTYは未確認である。

最初の全回帰では既存の初回User競合が95／96（新規created成功結果0）で失敗した。同候補局所6回と単独全96件では再現しなかったが、原因解消とは扱わない。試験OracleとRuntime Lockは変えず、失敗時だけstatus／reason／publication／cleanupConfirmed／revision／createdとchild終了code／signal／stderr byte数を返す診断を追加した。本文・User情報・Path・Recovery参照・秘密値は診断へ含めない。追加後の局所競合と全回帰は成功した。再発時はこの診断から原因を分類し、成功件数だけで過去失敗を消さない。記録は本要約と再実行可能なnpm testへ集約し、実行別Evidence書庫は作らない。正式191項目Not Run、通常鍵管理／Host交換・Workbench本番接続・旧REST撤去・AM全体未完成を維持する。

### 通常鍵管理の保存接続の着手前確認 — 2026-10-13

基準90c791c8、開始時clean。初回入口の限定完了後、採用済み通常発行・独立失効を既存保存Ownerへ接続し、指定／全員交換・Host交換・Workbenchの一度提示へ順に閉じる。親のSource／Architecture／BHV／QA照合と読取り専用着手確認により、新しい人間判断は不要。現在administrator・初回completed・exact対象・期待改訂・未解決交換0を同Lockで確認し、pending処置／容量予約前の乱数・KDF・新発行・新失効0を反証する。公開Source・台帳・IT・結果と利用側まで対応する。MCP鍵公開、新Receipt／履歴／Store／Lock、Host通常発行／独立失効、最後の管理資格保持の追加guardは作らない。

着手確認で提案された「同request ID＋既失効から元要求completed再観測」は親が反証し撤回した。現Schemaのtop operationIdは操作種別・対象を持たず、資格自身のoperationIdは元発行Identityである。既失効を再出版せず固定拒否し、認可済みreadで現在事実だけを示す。Canonicalに元失効要求の再入場completed必須はなく、新履歴を増やさない。通常発行の元発行相関とこの独立失効の限界を混同しない。RFD-IT-017／018の局所接続を進めるが、正式191項目とWorkbench実提示の未成立は検証前に解除しない。

通常発行・独立失効の保存候補を接続した。局所9件、修正後AM全105件／MCP全75件と両Packageの書式・型・Warning禁止Lint各3軸が成功、Fail／Cancel／Skip0・各Exit0。Symbol ID重複・登録Path欠落0、自己生成store Root残存0、差分空白確認成功。固定11Pathの限定独立再レビューは全重大度の残指摘0。初期化の歴史的attemptを通常受付IDへ再利用できる漏れと、失効結果へtokenを許す公開型を是正し、認証前拒否・乱数／KDF0・byte不変とoperation判別型のcompile反証を追加した。型反証の期待エラー注釈位置は修正後の正式入口で再確認した。

反証は、三Role／exact対象／改訂拒否、生成前容量予約、乱数・生成KDF・ID衝突、current rename・読戻し・材料清掃・Lock解放故障のSecret返却0、未解決交換／先行材料保持、最後の管理資格の自己失効、遅延提示の更新0、二Processの三競合と一採用である。最初の並行試験はNode v24.19のeval起動構成で失敗したため、通常の試験fixture入口とstdin入力へ変更した。親は全Processをcloseまでjoinし、stdoutはstatus／生成回数／固定理由／出版／清掃の非秘密集合だけ。通常発行の専用非秘密観測Reader、交換4組、Workbench一度提示・本番接続、正式191項目とAM全体完成は未成立のまま維持する。実行別Evidence書庫を増やさず、同候補のnpm testから再実行する。

### 元発行Identityによる非秘密の現在観測 — 2026-10-13

基準9ac2902e、開始時clean。前段の通常発行・独立失効は保存Sliceとして限定Pass・コミット済みであり、全体鍵管理の完成ではない。次は資格recordを元発行IDとuserIdから観測する専用Readerを鍵責務と既存保存Ownerへ接続する。親の正本照合と読取り専用着手確認により人間判断は不要。読取りはRoot・Bearer・元発行UUID・User UUIDを検査し、同Lockの完全current→初回completed→現在administrator→exact相関の順とする。その後の既存材料処置がnone以外なら当該要求のfact0、次要求でfreshに再評価する。清掃・読戻し・Lock不明でもfact0。

投影は改訂・資格ID・User ID・元発行ID・提示状態・現在失効だけを所有・凍結する。record不在は固定未取得で、未発行・元要求失敗・削除を推定しない。現在失効は元失効要求のcompletedでもReceiptでもない。通常管理read四kind、MCP、Secret取得・再表示・生成、Store／Lock／履歴は増やさない。発行から提示三状態と失効、未許可／初回途中／未知・別User、先行材料処置後のfact0、破損／清掃／解放不明、own field集合と秘密非透過を既存RFD-IT-017／018へ反証する。実装・試験・本番Workbench接続はこの着手記録時点では未完成。

修正後の局所4件、AM全109件／MCP全75件と両Packageの書式・型・Warning禁止Lint各3軸が成功した。Fail／Cancel／Skip0・各Exit0、試験終了後の自己生成store Root残存0、差分空白確認成功。固定8Pathの限定独立再レビューはPass・全重大度の残指摘0。出版済み材料の直接反証不足を是正し、administratorと対象相関を維持したcurrent=nextから初回は事実を返さず材料を処置し、次要求だけ観測することを確認した。pending削除故障はcurrent=next保持・replace不存在・pending残存・Lock解放として記録し、解除後の処置要求も事実非返却、次の新要求だけ観測した。失敗前後を未出版やrollbackへ読み替えない。

限定Passは現在資格recordの非秘密観測だけを対象とする。元失効要求の完了証明、秘密再表示、通常管理read／MCP拡張、新Receipt／履歴／Store／Lockはない。Workbench本番Consumer、交換、実提示、実Host／Linux、旧REST撤去、正式191項目とAM全体は未成立のまま。先行保存Sliceと同様に、各Packageの試験から結果を再生成し、実行別のEvidence書庫は追加しない。

### 鍵交換4経路の保存接続の着手前確認 — 2026-10-13

基準`144244f7`、開始時clean。親の正本・Source照合と読取り専用着手確認を完了した。追加の人間判断は不要。対象はWorkbench指定／全員とHost指定／全員の4経路で、準備候補だけを完成状態としない。credential責務の純粋候補、既存file-storeの相関・失効・資格保存、非秘密再観測、提示Owner、未解決記録整理、Host／Workbench本番Consumerの順に接続する。新Store・Lock・Session・Receipt・一般履歴・MCP鍵操作・旧Evidence変更はない。

現在改訂・Authority・対象・発行先・事前表示した旧資格集合を照合し、Workbench全員とHost2種だけ明示確認を要求する。準備相関を保存・読戻し・清掃した後だけ旧集合を失効し、失効段階確定後だけ容量確認と一回の新資格生成・保存へ進む。各段階は別改訂で、最初の失敗と既知段階を保持する。旧資格0件も許可する。初回途中は同UserへのHost指定だけとし、新資格保存とconfirmationCredentialId結替えを同改訂へ置き、元初資格・試行を保持する。初回completed後の歴史IDは変更しない。

元entryは起点相関として不変。再入場は現在administrator、または資格喪失時の既存信頼Host入口でexact交換を再照合する。Host継続では事前表示・確認を再適用し、新Recoveryや対象拡張を行わない。current=nextの既知出版材料を処置した要求は先へ進まず、次の新要求で段階を再観測する。credential由来current=base材料は自動出版・削除・再生成・新交換をせず保持停止する。

credential_storedの保存・清掃・Lock解放後だけ一回の短命Secretを返し、提示前unconfirmedを既存提示Writerで確定する。交換終了と提示処置は分ける。当初はSecret破棄確認によるrecord除去も候補としたが、2026-10-13の再照合で撤回した。現在方針は提示confirmedのexact record除去、またはnot_attempted／unconfirmedから別の明示交換への一出版置換である。秘密の物理消去を保証せず、Process喪失やtoken nullを破棄証明へ変換しない。終了済み旧集合のReceiptを再構成しない。具体条件はAM詳細の「非秘密の交換状態確認と終了方針」を正本とする。

4経路・旧集合0／1／複数・不正対象／確認／改訂、各出版故障の次段Effect0、base／next材料、実Process喪失・競合、自己／全員失効後のAuthority、初回Binding、提示処置と遅延通知を既存RFD-IT-013／017／018等へ接続する。正式191項目、本番提示と入口、AM全体は未成立を維持する。

準備候補の限定結果：局所6件、修正後AM全115件・書式／型／Warning禁止Lint各3軸が成功した。Fail／Cancel／Skip0・Exit0、終了後の自己生成store Root残存0。通常6改訂と初回7改訂の余裕を予約する境界、Host指定旧資格0件、初回前段・別User拒否、非対象全field保持を確認した。3種の一時変異は指定空集合の誤拒否、初回前段の誤許可、非対象Role設定変更を各試験で検出し、復元後6件成功。固定7Pathの限定独立再レビューは全重大度の残指摘0。CatalogのID／Path重複0、全AM suite未登録0、Symbol実体欠落0、差分空白確認成功。Repository Checkerの当該7Path指摘0、全体Exit1は維持する。集計fieldの初回参照誤りにより全体Errors／Warnings数を取得していないため推定値を記録しない。

限定Passは準備の現在認証・exact集合・確認条件・改訂容量・入力不変だけ。保存・旧失効・新資格生成・提示・再入場・record整理・Host／Workbench本番Consumerは未接続で、正式191項目とAM全体は未成立。MCP公開面に変更がないため新MCP回帰は今回対象外とし、直前75件を交換完成の根拠に流用しない。次は既存file-storeへ交換本体の三出版を接続する。

### 非秘密交換Readerと終了方針の再照合 — 2026-10-13

基準HEAD `d71ade80`。変更分類は保存済み交換の非秘密現在観測と設計同期。現在のadministratorまたは信頼Host、exact参照・完全current・材料処置・Lock解放を既存Ownerへ閉じる。通常WorkbenchはHost起点も読めるが継続できず、初回途中は同UserのHost指定だけを許す。状態・履歴・Lock・秘密再取得APIを新設しない。親照合と独立した契約／試験レビューを実施し、静的3軸・AM／MCP回帰・文書直接影響確認を対象とする。標準規範・外部Provider・Docker・実Host保存を変えず、準拠監査と署名Provider E2Eはこの局所段階では実行しない。現在、人間による判断は必要ない。

最初の限定レビューはModerate2件で不成立。提示三状態のうちnot_attemptedしか試験していないことと、Workbench自己交換後のHost観測が試験されていないことを是正する。統合是正方針を確認者へ返し、整合確認後に既存suiteへ追加した。既存Catalogへ観測の意味だけを追加し、suite ID・Symbol・Local Item・正式191項目は維持する。提示状態の固定化とHost起点限定化の二変異で各失敗を観測し、復元後に静的検査と回帰を再実行する。結果は後続の固定候補確認で確定し、初回129件の成功を是正後全体結果へ流用しない。

終了方針の旧「破棄確認だけでrecord除去」は再照合で撤回した。confirmedのexact整理と、未確認から既存入口の`previousRecoveryId`による別明示交換への原子的置換に限定する。Sourceの終了処理はまだ未実装であり、Reader・保存coreの成功で代替しない。実提示・本番Host／Workbench・旧REST撤去・正式191項目・AM全体完成は未成立を維持する。

確定した局所結果：Node v24.19.0、Reader局所5/5・Exit0、7.4369115秒。是正後各Packageの`npm test`はAM130/130・155.5333602秒、MCP75/75・64.645641秒、全Exit0・Fail／Cancel／Skip0、書式・型・warning禁止Lintの各3軸成功。固定9Pathの限定独立再レビューは全重大度残指摘0。二変異は各対象CaseでExit1を確認してexact復元し、上記全回帰で成功を確認した。HEAD `d71ade809d8fe770d196970ca51f8ed9ca99b529`とtracked差分Hash `6b96aeee423332d7874ac3830ce368308a38670c`は回帰終了前後で一致。鍵交換Source／保存Source／保存試験のGit Blob OIDは順に`6298ab0060df216bab180123a3adf0ee47e3e20b`／`99de137e3d53259d905fba847e5a81c29c990533`／`a38f87058cbf2c14ba6a6d8ab3a2c73904b0be5d`。Symbol／Catalog ID・Path重複0、登録実体欠落0、自己生成store Root残存0、差分空白検査成功。Checkerは全体3057 errors／0 warnings・Exit1、対象9Path指摘0。完全出力は端末で確認し、上記コマンドで再生成できるため実行別書庫は追加しない。後続の結果同期は文書だけで、実行Source・試験を変更しない。正式191項目・全体Readyは未成立を維持する。

### 交換終了処理のSource接続着手 — 2026-10-13

基準`af05b896`、着手時clean。承認済み終了方針内の実装追加として、親照合と独立した読取り専用契約確認を行った。現在認可・exact参照・表示・確認・容量を維持し、新State／Lock／履歴を追加しない。未確認storedから既存2入口の任意previous参照で別preparedへ一出版置換し、再送は新recordを優先する。失敗結果は今回operationと最後に耐久確認したrecordの三値を分ける。初回・現在権限・秘密再取得0・既存省略要求は不変。確認済み整理・負例／境界／Process喪失／競合・本番Consumerと正式191項目は残る。

現候補では四経路×未提示／提示未確認の引継ぎ・同要求再送と別参照拒否、置換rename失敗時の旧相関保持、置換確定後清掃失敗の新相関保持とfresh継続を局所反証した。静的3軸成功、引継ぎ局所2 Case成功・Exit0（6.2332794秒）、先行の鍵交換関連11 Caseも成功。全回帰・固定候補独立レビューは未実行で、未コミットの途中候補である。Sourceの一部接続から終了処理全体・本番成立を主張しない。実Host・秘密値・Docker・Provider・過去Evidenceは不変更。

終了候補と既存保存Owner、内部2入口を追加した。先行純粋候補試験は既存6件＋追加3件の9件成功、静的3軸成功。局所保存で両起点×両終了入口、未確認拒否、record以外保持、出版／読戻し／清掃／解放と二失敗分離、引継ぎ三出版／終了一出版の実Process喪失前後、初回Host同User・最新確認対象保持を確認した。実Process断面1 Caseは8条件を実行して成功。先行全AM139件は成功したが、現在候補へそのまま流用しない。その後、通常6／初回7・終了1／初回2改訂余裕の境界と、引継ぎ同／別操作・終了の二Process競合3条件を追加し、各局所1件成功を確認した。現在候補を固定し、最終全回帰・独立レビューへ渡す。既存Catalog2項目へ意味Tagだけを追加し、Symbol／Local Item／191項目・公開MCP・Schema・新Store／Lockは不変。終了保存成功を本番Consumerの完成としない。結果は未確定で、実Host／Workbench・旧REST撤去・正式項目・AM全体は未成立を維持する。

確定した局所結果：Node v24.19.0、最終各Packageの`npm test`でAM141/141・186.9874873秒、MCP75/75・69.773434秒、全Exit0・Fail／Cancel／Skip0・静的各3軸成功。固定11Path限定独立レビューのModerate1件は、通常新規と引継ぎを区別しない旧null説明を3現行箇所で是正した。統合是正方針確認後のSource Header1行・文書だけの修正で実行ロジック／試験不変、静的3軸と該当故障2 Caseを再実行して成功（5.675919秒・Exit0）。限定独立再レビューは全重大度残指摘0。

実行前後HEAD `af05b8962399adadf9938fdfe25b17589c9482e8`とtracked差分Hash `cf15bfc12e87fdf3bc56ea388238b5258cf4012d`一致。説明是正後Hashは`3e232a9af2a26b9017df91ff93a8145dc4ba26f5`。鍵交換Source／保存Source／保存試験のGit Blob OIDは説明是正後に`c3352aac3db812df2ce9838b8250400c5c641db7`／`005dd8e8fac2e2e6c2afae9ce483920b7a3bd5f1`／`6c3019abc67a92627aa63fae046326668fec78f8`。全体Checker3057 errors／0 warnings・Exit1、対象11Path指摘0。Symbol／Catalog ID・Path重複0、登録実体欠落0、自己生成store Root残存0、差分空白検査成功。全Process／検証session終了済み。完全出力は端末で確認し、各公開testと対象node testで再生成可能なため実行別書庫を増やさない。結果同期は3文書だけでSource／Test不変。

今回の局所保存・終了coreは閉じるが、短命Secretの本番提示Owner、通常Workbench鍵3操作・Host交換2操作、MCP／Workbench本番Launcher、旧REST撤去、実Host移行／Linux、正式191項目・AM全体完成は未成立を維持する。次は既存提示Writerと終了APIを実Consumerへ接続する。現在、人間による追加判断は不要。

### 非鍵管理の公開接続に向けた着手前確認 — 2026-10-13

基準`d7ee403`、作業Treeはclean。既存の通常保存7操作と管理読取り4種をMCP／Workbenchへ接続する。保存処理・認可・状態のOwnerはAccess Managementのままで、入口ごとのStore、Lock、Session、Receipt、Registry、互換層を追加しない。これは承認済み責務再編内の公開契約具体化であり、鍵管理の限定成立を通常管理やAM全体完成へ拡張しない。

着手前の読取り専用確認で、4読取り＋7保存の能力分解と候補Tool名の既存集合との非衝突を確認した。Sourceは未編集。次の補正をAM／MCP／Workbench詳細とQA-000007／QA-000009へ統合して固定し、独立確認後に実装する。

| 対象 | 固定する条件 |
|---|---|
| 公開集合 | 現在manager／administratorだけに通常管理を一覧表示し、callでは各AM APIの現在認可を再評価。developer本人表示は通常接続側の別責務で、管理一覧から代替しない |
| 管理読取り | 空の閉入力、Tool固有の対象と改訂だけ。Binding・Path・資格を公開せず、Roleの既存filter、Exposureのnullと明示空を保持。四応答を同一改訂のSnapshotへ合成しない。応答上限と超過時の全体未取得を具体化する |
| 保存入力・結果 | 受付UUID・期待改訂と操作固有fieldだけ。Tokenと管理Rootは構成／要求closureのみ。既知出版・清掃・最初の失敗を閉投影し、内部理由の自由文字列透過、再送保証、rollback推定をしない |
| 取消・配送 | 完全入力検査→開始前取消確認→AM同期操作最大一回→終了後取消確認。開始後は終了待ちし、応答喪失で保存を戻さず自動再送しない |
| 利用側 | Workbench同ProcessはAM直接、Remoteは採用したMCP。公開Launcher、通常接続、旧REST撤去は後続まで未完成を維持 |
| 品質 | 既存RFD-IT-013／021・RFD-ST-022・RFD-UAT-007とEST-IT-002／010・EST-ST-013へ接続。新Local Itemを発行せず、正式191項目Not Runを維持 |

人間判断待ちはRemote Repository登録の一件だけ。内部APIが受ける登録対象の絶対Rootを、Remote manager／administratorのMCP入力として採用するかは未確定である。採用する場合はHost上のPathを明示し、認可前の対象観測0・既存上限／Root／manifest検証・結果へのPath非公開を保持する。不採用なら登録は同Process Workbench／Hostだけとし、Remoteは登録以外の管理操作を提供する。新しいInventoryやopaque selectorは作らない。これは管理状態の保存Rootの構成注入とは別の判断である。判断前に登録ToolとそのRoot入力Schemaを採用済みへ変更しない。

必要な独立確認は契約・品質、文書／参照・直接伝播・変更影響。実装後はAM／MCP／Workbenchの静的検査・回帰と実HTTP／Browser縦断を行う。標準準拠基準やProvider／Dockerは変更しないため、準拠監査と署名Provider E2Eをこの接続単位の初回検証へ追加しない。人間判断以外の六補正は既存契約から一意に処置できる。実装、実境界、公開Launcher、正式QA評価と全体完成は未評価である。

非鍵管理6文書の初回限定独立確認はMajor2／Moderate3。先行Sliceの禁止句と現在候補の混在、保存結果Union／失敗分類の不足、表示名制約の部分再定義、通常認証と管理API拒否の混同、登録Root入力とPath非公開結果の混同を是正した。統合案を指摘元へ再提示して整合確認し、先行pendingと新出版準備の失敗を分離した。Sourceの出版成功→Lock終了不明→primaryFailureの経路は実Sourceで再照合し、当該固定理由のrelease_unknownへのmappingを維持した。既知失敗に付随する非公開secondaryは推定しない。初回scoped Checkerは展開範囲448 errors／0 warnings・Exit1、対象6Path指摘0、参照153件・追加アンカー2・Checklist各一件を確認した。

是正後固定6文書の限定独立再レビューはPass・全重大度残指摘0、開始／終了HEAD `d7ee403cc0ecd18fc88545194f726bfa854521bd`と全6 SHA-256一致。参照155件欠落0・追加アンカー2・Checklist各一件・差分確認成功。文書候補の整合だけの結果で、Source Ready・正式191項目・本番接続・AM全体完成へ昇格しない。Remote登録Root指定の人間判断は未回答で、Source未編集を維持する。

非鍵管理の独立先行範囲を着手前確認者へ再提示した。Remote登録の判断は登録Tool／Root入力／Schema採否だけに影響し、確定した四読取り＋登録以外六保存には依存しない。10操作のWIPとしてSource接続を先行できることを確認した。登録は一覧・Schema・dispatch・Workbench UI／POSTに追加せず、unsupported／fallback／Root selector／互換分岐も作らない。25／Profile構成時29という途中件数は局所実測に限り、M1-B採用・最終集合・公開Launcher完成とは扱わない。既存登録状態の一覧・解除・公開更新を確認しても登録生成経路の成立とはしない。Remote登録は11番目の最終Gateとして保持し、正式191項目・登録縦断・AM全体の未完成を維持する。

先行Source WIPとしてMCPの`src/access-management/protocol.ts`へ十操作の固定名・閉入力Schemaを作成した。既存AMと同じUUIDv4・期待safe改訂・Role／Workspace構造を使い、usernameの値判定はAMへ残す。Packageの静的三軸成功。直接診断で十名一意・空入力read四件・登録名と秘密／管理Root／Binding入力なしを確認した。最初の診断は登録名除外のassert記述が誤って等値を要求し失敗したため、意図どおりの非等値へ訂正して成功した。Source変更や検査条件の緩和ではない。この診断は正式Test Symbol／QA評価ではなく、一覧・dispatch・実AM委譲・HTTP／Browser・Metadata／回帰は未接続。Remote登録判断待ちと全goalの未完成を維持する。

MCP先行十操作を現在通常認証、四read／六保存のAM公開API、閉結果投影、既存一覧／dispatchとHTTP Resolverへ接続した。developerの通常認証は維持し、管理呼出し・開示を拒否する。managerでは管理十Toolを含む25件、Profile構成時は29件の局所構成となる。登録Tool・鍵・Host・初回操作を追加しない。局所正常1件成功（7.7581223秒）、出版／材料清掃／Lock終了故障の親＋3条件4件成功（5.0718563秒）。出版失敗はunconfirmed、保存後清掃／解放不明はconfirmedを保持し、実File改訂とrename一回を確認した。Source実測によりLock終了不明のprimary分類を確認した。

補強後MCP全80 Case・静的三軸成功、Fail／Cancel／Skip0、Exit0、62.6997892秒。先行76件成功は追加故障試験前の値として区別する。四readのfilter・公開範囲nullと明示空、六保存・解除後本体保持、managerのadministrator登録／Role／内容拒否、入力拒否・開始前取消の現在File不変、登録名非公開を確認した。Symbol／Catalogへ実体と既存Local Itemを接続したが、正式191項目はNot Run。16 MiB超過、未知理由等の未実測反例、Workbench direct／Remote UI、本番Launcher、登録の人間判断と縦断、旧REST撤去・AM全体完成は未成立で、固定候補独立レビューは未完了である。

非鍵管理Sourceの初回限定独立レビューはMajor1／Moderate2。同期保存後にTransport取消を処置する機会がないこと、詳細設計の未接続表示の残存、結果分類・読取り失敗・応答容量の境界試験不足を指摘した。統合是正案を再提示して確認し、保存終了後に一回だけevent loopへ戻り、到着済み取消を確認する。切断通知の到着保証・保存rollback・待機時間延長・新Recoveryは追加しない。実Clientを出版直後に切断する局所試験は成功し、当該yieldを除去した一時変異は期待どおり失敗、Source SHA-256 `7dceb2dea383744550c0d5590cc5caf47b4b6c52cacddb4fa62ce314293b9b7b`へ復元した。

結果投影の反証は、別ProcessでNode組込みModule mockをAM公開Rootへ限定して適用し、MCP公開RootのResolverを経由する。差替えの呼出し数を確認し、未適用では失敗する。既知十二理由・未知理由と継承Property名、読取り拒否／観測不明、開始前取消のProducer呼出し0、最終JSON-RPCのUTF-8 16 MiBちょうどと一byte超過の全体未取得を確認した。容量試験は合成Owner結果の搬送限界だけで、AM状態の容量成立ではない。実AM保存と実HTTPの既存回帰を代替しない。最初の試験はWindows絶対PathでのModule差替えが未適用となり失敗し、同一Moduleのfile URL指定に訂正して成功した。本番Sourceの追加API・深いprivate import・Frameworkはない。固定候補再レビューと全回帰完了前のため、正式191項目・本番全体・AM完成は未成立を維持する。

追加反証後MCPの`npm test`は静的三軸と全82件成功、Fail／Cancel／Skip0、Exit0、68.2308839秒。是正後固定16Pathの限定独立再レビューはMajor0／Moderate2で、前回の取消と結果境界の指摘は解消した。残る試験Rootの異常終了時回収とAM詳細の現在句を、統合是正案の確認後に修正した。試験Rootの所有者を親だけにし、childはexact Rootを検証・利用する。正常・mock前例外・実timeoutの三経路で子終端後に親がexact Rootを回収し、別sentinel不変を確認した。最初の静的再確認はfixture局所値の型推論指摘1件で失敗し、公開McpResponse型注釈で是正した。失敗を全体成功へ流用せず、是正後の静的三軸と三反証が成功した。MCP全82件の結果はこの試験所有者是正前の値であり、最新版全回帰・再レビュー結果へ流用しない。登録判断・本番接続・正式191項目・全体完成は未成立を維持する。

最新版の`npm test`は静的三軸＋全84件成功、Fail／Cancel／Skip／Todo0、Exit0、79.2087563秒。normal／mock前例外／timeoutの3終了modeを含む。固定16Pathの最終限定独立再レビューPass・全重大度残指摘0、開始／終了HEAD `d7ee403cc0ecd18fc88545194f726bfa854521bd`と全SHA-256一致、差分確認成功、自己生成結果試験Rootとsentinel残存0。前回Major1／Moderate2と再レビューModerate2は解消した。実行別Evidence書庫を追加せず、正式試験Sourceと再実行入口から再生成する。非鍵10操作WIPの局所成立だけを確定し、Remote登録判断、Workbench本番、公開Launcher、旧REST撤去、正式191項目とAM全体完成は未成立のまま保持する。

### Workbench通常管理と本人表示の本番接続着手 — 2026-10-13

基準HEAD `7d8cda0e`、着手時clean。承認済みAccess Management完成に向け、同Processの四管理read＋七保存（登録含む）、Remoteの四管理read＋六保存をCSR管理画面へ接続する。Remote登録Root指定M1だけを判断待ちに保ち、疑似Tool・fallback・新Registryを追加しない。既存SCR-000008／BHV-000012・Workbench §6.2.1へ着手前整合を照合し、読み取り専用確認者の条件を統合した。追加の人間判断はM1だけである。

必要な本人表示がRemote MCPで欠落していたため、既存AMの`readCurrentAccess`を空閉入力の`crdd.get_current_access`へ接続する。通常三Roleだけに提供し、初回限定discoverを変更しない。公開は同改訂のuser／contentAccess／permittedRepositoriesだけ、内部managementOperations・資格・Root／Binding・他Userは0。MCP途中集合はdeveloper16、manager／administrator26、Profile構成時30（登録採用後は管理側だけ各＋1）。旧25／29と全84件は前段固定版の局所履歴であり、本段成立根拠へ流用しない。

編集の一次キーは、①AM共通結果投影、②MCP本人搬送、③Workbench同Process／Remote管理接続、④CSR表示、⑤直接品質・追跡接続である。AMの`management/result.ts`は既存結果から非秘密の閉結果へ写す実責務を持ち、MCPのprivate重複mapperを撤去する。HTTP／JSON-RPC、取消、容量上限はTransport Ownerへ残す。Workbenchは同じAM結果投影とRemote閉検査を利用し、管理Store・Role判定・受領ACK・Session・Receipt・再送・一般Recoveryを新設しない。

各管理readの改訂は独立表示し、保存は一回・保存後fresh観測、応答喪失で自動再送0。Local登録のみ「サーバー上のRepositoryフォルダ」を明示し、Root／Bindingを結果へ返さない。取消は開始前Effect0、開始後同期保存joinと到着済み取消による応答抑止、終了は所有Request／Response／Socket／Listener join。実AM／MCP／Workbench回帰、共通六保存の入口同値、Local登録とRemote非提供、全Role本人、現在認可、拒否／不明／既知出版、実Browser操作と影響画面の既存Visual profileを評価し、固定候補の独立レビューと直接影響確認を行う。標準準拠基準・Provider／Dockerは不変更で、準拠監査と署名Provider E2Eはこの接続の初回反証に追加しない。正式191項目・公開Launcher・旧REST撤去・AM全体完成は継続Gateである。

本人公開と結果Owner移管の局所実装候補を接続した。AMの純粋projector三入口をRootへ公開し、MCPの保存mapperとread投影の重複を撤去した。通常本人Toolは三Roleと管理操作を分離し、初回Handler／discoverは不変更。実HTTPで三Role本人・最小field集合・他User／資格／managementOperations非公開、Role変更と失効後fresh拒否、初回通常非提供を確認した。別Processの固定Producer試験は本人の三Roleと五未取得理由、入力不正／事前取消の呼出し0まで追加した。

初回の静的再確認では改名後の型参照残存と試験局所値の型推論指摘があり、参照と公開McpResponse注釈を修正した。初回全MCPは85件中83件成功／2件失敗で、失敗は既存Tool集合のexact期待値に本人一Toolがなかったためである。未知Toolを許す検査緩和はせず、二集合へ本人定数だけを追加した。是正後の静的三軸と該当境界6件は成功、13.9657999秒。AM／MCP全回帰は実行中で、固定候補独立レビューとWorkbench画面／本番接続は未完了。前段84件Passを本候補の全回帰成功へ流用しない。

是正後MCPの`npm test`は静的三軸＋全85件成功、Fail／Cancel／Skip／Todo0、Exit0、83.6560028秒。AM初回全回帰の失敗はRoot公開APIのexact期待集合に純粋projector三関数がなかったためで、三名だけを追加し、固定権限33判定や既存許可集合は変更していない。是正後静的三軸と当該四試験成功、0.2743046秒。AM全回帰の再実行は終端待ち。共有結果投影と本人公開の固定候補独立レビュー前で、Workbench実画面・本番接続・全体完成は未成立のままである。

AM全回帰の再実行は静的三軸＋全150件成功、Fail／Cancel／Skip／Todo0、Exit0、190.8644844秒。MCP85件と合わせ235件を確認した。固定21Pathの限定独立レビューPass・全重大度残指摘0、tracked差分Hash `400a02b13eb67aab79bf5601d0e6ad233f619058`と新AM結果投影SHA-256 `d9f125448b1aa621fe6fdd24608345d6347da8e4ebeb4fc25684ee647ce44fdf`の開始／終了一致、差分確認と自己生成結果試験Root残存0を確認した。本人搬送と結果Owner移管の局所範囲だけを閉じ、Workbench画面／本番接続、公開Launcher、Remote登録M1、旧REST撤去、正式191項目とAM全体完成は継続する。

Workbench通常管理の実装途中結果：基準Commit `378d93cb`。同Process七保存／Remote六保存、本人と四管理read、個別改訂のForm、保存後の現在投影再取得を接続した。局所実HTTP二経路は成功（12.0310442秒）、不正Origin・Action Token重複・未知field・username重複の実保存0、Remote登録非提供、降格後の拒否と内部Path／資格非開示を確認した。初回二経路失敗は試験Repositoryの必須`PROJECT_CONTEXT.md`欠測であり、登録契約は変更せずfixtureを補った。MCP Clientの固定応答反証一件はID差・不正UTF-8・16 MiB超過・事前取消・非許可URLの拒否と再送0・reader解放を確認した。実HTTP終了保証の代替にはしない。

静的三軸とVite Build成功。既存鍵管理の実Chrome五件成功（49.2249468秒）。初回通常回帰は43件中42成功／1失敗（168.7472729秒）、Failは新BundleのGit Index不一致だけである。生成物のステージ固定後、該当配布／Node依存閉包二件は成功（0.7599301秒）。初回回帰を全体Passへ読み替えず、追加Client反証を含む全回帰を再実行する。新通常管理画面の実Browser操作・Visual profile、取消／切断の直接反証、追跡情報更新、独立レビュー、公開Launcher、Remote登録M1、旧REST撤去、正式191項目とAM全体完成は未成立。実行別Evidence書庫・新State／Lock／Sessionは追加しない。

Workbenchの再実行回帰は静的三軸・Buildと全44件成功、Fail／Cancel／Skip／Todo0、Exit0（187.4815745秒）。既存鍵管理を含む通常管理の実Chrome試験は、保存前の入力変更をfresh再投影と誤認する待機条件を固定改訂表示へ直した後、全6件成功（74.4500771秒）。新通常管理の四Formは実保存・fresh改訂、重複submit一POST、結果Focus、Storage不保持、鍵発行0を確認した。7保存の全Form操作・失敗表示・Remote Browser同値・公開Process終了義務の全成立は主張しない。

Visual再評価には自己生成AM状態を構成して通常管理の実Formを含めた。初回は27測定後のGit状態比較が、fixtureの`.crdd`除外初期化により不一致となり失敗した。fixtureへ先に`.gitignore`を固定し、現在本人のDOMが成立することと管理状態が不変であることを追加して再実行中。機能契約やVisual閾値を弱めない。新DOM識別子を追加したBuild後の最新版全回帰・Browser／Visual終端・追跡情報確認・独立レビューは継続する。

Visualでは管理Formのcheckboxラベルと、構成済み鍵管理の全員交換確認ラベルに21〜22pxの操作領域不足を検出した。両者を既存40pxの確認操作スタイルへ接続し、全九Profileの閾値・評価範囲は維持して再実行中。既存fixtureでは鍵管理未構成のため露出していなかった不足であり、過去Visual成功を本候補へ流用しない。

実HTTP通常管理の局所二経路へ、Body未完了での利用側切断とServer終了を追加した。静的三軸・二経路成功（20.0895003秒）、実保存状態不変・Request終了・Listener不存在を確認した。Handler境界の局所根拠であり、公開Launcher全Process／Signal／全RegistryのEST-ST-013全成立へ昇格しない。最新版DOM／CSS後の全回帰・Browser・Visual、追跡情報更新と独立レビューは継続する。

操作領域是正後のVisual全27測定は成功、Fail／Cancel／Skip／Todo0、Exit0（100.6628118秒）。現在本人DOM・構成済み管理Form、Desktop／Tablet／Mobile、実Browser Zoom100%／200%／400%、試験用管理状態不変、Browser Tree／Profile／Listener不存在を確認した。既存32px基準・測定範囲は不変更。Browser終了最大7841ms、Tree観測最大6217ms、子Process終端fallback1回は参考値として観測し、通常終了へ偽装しない。新Buildの配布物／Node依存閉包二件も成功（0.6715413秒）。対象のSource・Test・台帳・現状表示を固定して限定独立レビューへ渡す。全7FormのBrowser操作・失敗表示・Remote Browser同値・公開Launcher全終端、旧REST撤去、正式191項目・AM全体は未成立である。

### Workbench Remote全ConsumerのMCP単一路への切替 — 2026-10-13

独立レビューは固定候補（HEAD `378d93cb`、tracked差分Hash `10251ce3f5388852903988bbd8b634b3ccffdf65`）へMajor1／Moderate4を返した。完全Endpoint契約違反、結果集合のIdentity重複、登録成功IDの相関不足、配置表不整合、Remote Browser確認不足を是正する。固定最新版の全44回帰は終端成功（208.4612083秒）、Browser六件も成功（81.2054535秒）だが、レビューはFailであり、局所候補を完成扱いにしない。

Endpointの是正を旧field併存・推定・互換Readerで行わず、既採用Architecture §4.1へ合わせるため、影響範囲をRemote全Consumerへ拡張する。読み取り専用確認者との着手前整合結果は条件付き着手可、追加の人間判断なし。以下の表は成立済み能力の保全対応であり、旧RESTの成功を新MCP経路の検証結果へ流用しない。

| 能力 | 現行比較入口 | 新接続と意味Owner | 必須の保全確認 |
|---|---|---|---|
| Portfolio | CROS `readRemotePortfolio` | 明示Endpoint→既存Project Context MCP→Domain表示投影 | 検索・状態・Query拘束Cursor、五場面、Source Coverage、欠測。部分結果を全体成功へ畳まない |
| AI Profile | CROS `readRemoteAiProfileCatalog`／`executeRemoteAiProfileMutation` | 同じEndpoint→AM現在認可→AI Adapter管理 | 現在Role、改訂、登録Model、削除確認、拒否／未構成／保存後応答喪失の識別 |
| Runtime Activity | CROS `readRemoteRuntimeActivity` | 同じEndpoint→AM現在認可→Orchestrator Reader | Project、現在状態、Event、出所、Cursor、Source別unknown。部分成功禁止 |
| Topic／Meeting | Workbench `topic-meeting/mcp-adapter.ts` | exact Endpoint→AM→Domainの既存Tool | Repository拘束、CRUD、Relation、競合、Outcome、closeと非開示 |
| 通常管理 | Workbench `management/operations.ts` | exact Endpoint→既存本人・四read・六保存Tool | fresh認可、集合一意性、操作別結果ID相関、再送0、Remote登録非提供 |

編集一次キーは接続型／Form／表示、共通MCP搬送、能力別Consumer、結果Inspector、Canonical配置表、QA／Symbol／Catalog、実HTTPとBrowser反証の順にする。構成は完全`mcpEndpoint`一つへ統一し、旧`baseUrl`／`mcpBaseUrl`、暗黙path追加とFallbackを新構成へ残さない。既存Domain／AM／MCP／AI Adapterの公開型・Inspectorを利用し、旧REST DTOをcastして成功へ変換しない。管理結果の一意性・操作相関は既存Inspector／呼出し境界へ最小追加する。

撤去対象はWorkbench Backendから旧CROS RESTへの接続である。Browser向け同一Origin HTTP、Local同Process能力、鍵管理のMCP非公開、実Host状態、旧正式Evidenceは不変更。Remote登録RootのM1判断は独立して維持し、Tool／Form／dispatchを追加しない。新Framework／Store／Lock／Session／Registry、Runtime互換Readerは追加しない。旧REST helperは全Consumer置換と必要な能力観測後だけ参照0を確認して撤去する。

回帰面はQA-000007の現在認証・内容範囲・通常管理、QA-000009の完全Endpoint／搬送／取消／終了、QA-000004の活動、QA-000005のTopic／MeetingとPortfolio・AI Profileの既存項目をOwnerごとに照合する。完全`/mcp`、originのみ、二重path、URL秘密／query／hash、旧field、redirect、容量／UTF-8／Envelope相関、応答喪失、Role変更／失効／Exposure解除／foreign対象、Server closeを反証する。Remote Browserでは正常・拒否・unknown・既知出版と清掃不明、fresh表示、登録Form非表示、秘密／Path非開示、再送0を確認する。

新固定候補の独立レビューは全ConsumerのSource・Test・設計・QA・台帳・起動／利用側を一つの集合へ含め、全結果終了まで編集しない。文書・直接伝播・Gap影響はその固定集合へ含める。標準準拠基準・Provider／Docker自体は本切替で変更せず、署名Provider E2Eを最初の原因確認には使わない。既存全回帰を新候補へ流用せず、静的三軸・Build・全回帰、Local／Remote実Browserと資源終端を再実行する。公開Launcher・旧CROS Package全撤去・正式191項目・AM全体完成は別の継続Gateであり、未対応能力が残る間は旧処理を不要扱いしない。

Remote切替の途中実装：共通`callMcpTool`は完全な`/mcp` Endpointをそのまま使用し、暗黙path追加を撤去した。originのみ・二重path・URL資格／query／hash・非許可HTTP等の拒否と、集合重複／登録ID欠測の局所反証二件が成功（0.5596469秒）。既存接続型・Form・Topic／Meeting等の旧origin入力はまだ切替前であり、新搬送と混在する途中状態を完成と表示しない。`ai-profile/mcp-adapter.ts`と`activity/mcp-adapter.ts`は既存MCP Toolと意味OwnerのInspectorへ接続する薄いAdapterとして作成し、静的三軸成功。本番Serverへは未接続、実HTTP能力別試験も未実行。新Framework・共有State・認可再実装は追加していない。次にPortfolioの結果検査・取得、接続型／Formと全Consumerを一体切替する。新候補の全回帰・Browser・レビューは未成立。

Remoteの本番Consumer切替候補：接続型・接続Form・表示・管理／Portfolio／Profile／Activity／Topic・Meetingの要求を完全`mcpEndpoint`一つへ揃えた。Workbench Serverから旧CROS REST helperのimportと呼出し、`mcpBaseUrl`と推定Fallbackは撤去した。旧CROS helper本体・Packageは他Consumerと能力置換の確認前なのでまだ削除しない。Portfolioは既存BrowserのContext／Source検査を`project/portfolio-result.ts`へ移し、ServerとBrowserで共有する。MCP一覧と全Project取得が成立した後だけ全体投影を返し、途中失敗・一覧との相関不一致は全体取得失敗とする。原子的な複数Call Snapshot保証は追加しない。

Topic／Meetingの独自HTTP搬送を共通Clientへ置換し、Page内の詳細とTopic／Meeting両Pageは全settleを待ってから結果を返す。全HTTP要求を既存の進行中Promise集合へ接続し、切断Signalを各Remote呼出しへ渡し、Server終了時にjoinする。新Store／Registry／Lock／Sessionは追加しない。Profile変更のdispatch後故障を400の入力拒否へ丸めず503の結果未確認へ分け、自動再送しない。

静的三軸・Build成功。単一Endpoint後のAM実HTTP／結果反証四件成功（16.3285415秒）。旧CROS認証fixtureを使う既存Remote Topicの実MCP一件は、新Portfolio取得・選択Repository・Topic表示／更新の経路で成功（4.7711927秒）した。この比較fixture成功を新AMの全能力認可・失効の成立へ流用しない。旧REST前提の接続／Profile等の試験追従、新AM能力別実HTTP・Remote Browser、結果未確認／現在性／取消／終了反証、台帳、全回帰と新固定候補レビューは未完了。現時点でAM全体完成や旧Package不要を主張しない。

旧REST前提の実HTTP試験追従：Profile試験を新AM状態＋実MCPへ置換し、manager／administratorの作成と接続後developer降格による次変更拒否・Catalog改訂不変を確認した。静的三軸と三件成功（9.6833526秒）。接続・Portfolio・活動・失効試験は自己生成の登録Repository、Orchestrator現在状態とExecution Intelligence履歴から実MCPへ接続し、成功（8.3945368秒）。初回の活動fixture不成立は本文相関hashをGit改訂へ流用していたためで、検査は弱めずVersion Controlの実改訂観測とfixtureの初期Commitへ補正した。Topic／Meeting全Action写像は完全Endpointへ追従後に成功した。実行ごとのEvidence書庫を増やさず、正式試験Sourceを再実行入口とする。新経路の全能力・公開Launcher・Remote Browser・全回帰・新固定レビューは未完了である。

新Remote管理の実Browser局所結果：`node --test --test-skip-pattern='issue|self|\ball\b|(?:^| )management$' tests/system/credential-administration.browser.contract.test.ts`でRemote管理・Root準備・親Caseの三件成功（34.0383893秒）、Fail／Cancel／Skip／Todo0、Exit0。四Formの実AM→MCP→Workbench保存・fresh表示、二重submit一回、Local登録Form非表示、FocusとStorage不保持を確認した。拒否・出版不明・出版確認済み＋清掃不明・応答喪失の表示と再送0はBrowser内の固定応答注入で確認し、実AM／MCPの保存／清掃故障を再現した根拠へ昇格しない。Backend故障と表示の縦断接続、最新全Browser・全回帰終端・新固定候補レビューは残る。

単一Endpoint切替後のWorkbench全回帰は静的三軸・Buildと全47件成功、Fail／Cancel／Skip／Todo0、Exit0（211.0305533秒）。新AMのPortfolio／実活動／失効とProfile二Role、Topic表示更新／全Action写像を含む。Local／Remoteを合わせた最新版の実Browserを再実行中。Source・台帳・起動入口・残存CROS依存の照合、新候補の限定独立レビューと正式191項目の評価は未完了で、47件からAM全体や旧Package廃止可を推定しない。

切替後の最新版実BrowserはLocal鍵三経路・Local通常管理・Remote通常管理と準備／親Caseを合わせ全七件成功（99.4258573秒）。全47回帰に続き、Visual全27測定も成功（94.4195132秒）。Browser正常終了最大2035ms、Process Tree観測最大984ms、子Process終端fallback0は参考値であり恒久保証ではない。追加四Adapterと共通結果検査をSymbolへ対応付け、Schema検査はWorkbench32 Symbol・findings0、Test Catalog303登録・findings0。これらは正式Local ItemのPass数ではない。

Source検索でWorkbench Remote旧`baseUrl`／`mcpBaseUrl`とREST helper呼出しを撤去済みと確認した。残る`baseUrl`はWorkbench自身のlocalhost URLで、接続先設定ではない。公開Launcherの単体／`--cros`、初期化済みHost Rootの読取り結合、初回経路、通常認証・終了保証は未接続である。次の着手前確認へ移し、起動時mkdir／初期化／鍵発行、新Store／Session／Lockを追加しない。公開入口切替・旧CROS全Consumer撤去・新固定候補レビュー・正式191項目・AM全体完成は未完了を維持する。

### Workbench鍵管理の本番接続着手 — 2026-10-13
基準`d02d784c`、開始時clean。採用済み通常発行・独立失効・指定／全員交換を旧CROS資格管理からAMへ置換する。親と読み取り専用確認者がAM／Workbench正本・既存Consumer・品質義務を照合し、追加人間判断なし。旧profile発行は既存userIdへの発行へ、rotateは指定／全員交換へ置換し、update_accessは鍵から撤去してUser／Role管理へ分離する。旧公開形状は互換維持せず、移行はフロントAIが旧Writer停止・旧入力確認を担当する。旧正式Evidenceは保持する。

同Processの検証済みAM Root＋Server memoryのBearerを明示依存とし、Remote MCP構成との同時指定を拒否する。現在administrator専用Readerを既存credential/management.tsとstate/file-store.tsへ追加し、同改訂のactorUserId・User選択候補・資格Metadata・一件以下の交換相関だけを不変投影する。認証・初回・材料・清掃・解放不明はSnapshot0、材料を処置した要求は次fresh取得へ分ける。readManagementState四kind・MCP公開集合は変更しない。

鍵は汎用Client Modelの例外から撤去し、既存管理POSTの用途限定no-store短命応答だけへ搬送する。保存→提示前unconfirmed→HTTP byteとfinish観測→confirmed→交換だけrecord終了の順で、応答はfinish前に固定されるため交換全体完了や本人受領を主張しない。開始済みfinalizerはServer終了でjoinし、BrowserはCSR局所状態だけで一度表示、reload／GET／再送0。新State／Lock／履歴／受領ACK／Frameworkを追加しない。通常発行・失効の追加確認0、指定交換事前表示、全員交換明示確認、Host操作分離を維持する。

AM RFD-IT-013／017／018、HTTP RFD-ST-016、Browser ERB-ST-022、MCP鍵非公開EST-ST-015を既存項目へ接続する。静的3軸、AM／Workbench／MCP直接回帰、固定候補独立レビュー、差分・Symbol／Catalog・正本直接伝播を必須とする。標準準拠基準やProvider／Docker不変更のため準拠監査・署名Provider E2Eはこの接続単位では対象外。Reader局所から上位完成を推定せず、専用HTTP／CSR／本番Consumerまで同goal内で進める。non-key管理7操作・Launcher・旧REST撤去・正式191・AM全体は引き続き残件である。

先行Reader候補は、AMの既存credential/management.tsとstate/file-store.ts、Package Rootへ接続した。資格管理一覧の局所3 Caseと書式・型・Warning禁止Lint各3軸成功、Exit0・2.6938226秒。現在管理者の一改訂投影とRole降格、stored交換相関、先行base／next材料での非認可保持・処置要求の事実0・次fresh取得、初回途中・破損・読取り・Lock解放故障でSnapshot0を確認した。最初の読取り故障注入は実装がdescriptorを読むためPath比較のHookが発火せず、open境界の注入へ修正した。Source保証を弱めていない。まだ固定候補独立レビュー・全回帰とWorkbench専用HTTP／CSR／本番Consumerは未完了であり、上位完成ではない。

Workbench候補の追加局所結果：同Process AM Rootを注入し、通常発行・独立失効・指定交換・全交換・本人交換を実HTTPで確認した。旧形式、重複operation／Action Token／期待改訂、未知Root field、改訂不一致、異なるOrigin／Host、不正Content-Typeの拒否後は管理状態の全文一致を確認した。書式・型・Warning禁止Lint各3軸と対象1 Case成功、Exit0・14.3616896秒。これはITの一Case内の境界確認であり、正式ST／Browser／全体Pass件数へ加算しない。

交換終了の認可は通常AM入口へ限定した。他ユーザー指定は現在操作主体の鍵、本人指定／全交換は当該要求の新管理者鍵を短命に使用し、現在Role・資格・改訂・交換相関を再評価する。WorkbenchからHost終了を使う候補は独立した境界照合で却下し、Sourceから撤去した。後処置故障・取消・競合・実Browser、全回帰と固定独立レビューは未完了。Architectureへ専用POST・非秘密一覧・presentingと受領の区別・終了待機を具体化し、Test Header／Symbol／Catalogを現Sourceへ追従した。追加の人間判断は不要。

Workbench追加局所後の全回帰は33 Case中32成功・1失敗、Cancel／Skip0、Exit1・133.1909307秒。失敗は追跡Browser BundleのWorking Tree Blobと未更新Git Index Blobの差で、機能Caseは成功しても全回帰Passとはしない。判定を緩めず、固定候補のBuild・ステージ確定時に同試験を再実行する。その後、全交換の表示対象とFormの送信集合を同じ値へ統一し、接続ユーザー名、前記録終了≠新交換の日本語表示、fresh一覧で有効性を確認できない旧応答鍵の表示停止を追加した。更新後の静的3軸・Vite Buildは成功、294.81 kB／gzip 86.03 kB。画面変更後の実Browserと固定候補全回帰・独立レビューは未完了である。

AM追加Reader後の全回帰は150 Case中149成功・1失敗、Cancel／Skip0、Exit1・187.1418803秒。失敗はPackage Rootの固定公開集合へ`readCredentialAdministrationState`を反映していなかったことで、採用した一入口を期待値へ追加し完全一致Oracleを維持した。是正後の静的3軸・当該UT全4 Caseは成功、Exit0・0.3196352秒。全150 Caseの是正後再実行と独立レビューは未完了で、局所再成功を全体Passへ置換しない。

Workbenchの交換故障候補を六保存点と秘密応答開始時のclose／throwへ拡張した。静的3軸と対象親1＋故障子8の計9 Case成功、Exit0・36.0343147秒。出版1〜4の停止は秘密応答なし、5／6は既に提示した事実を保持し確認／終了不明を隠さない。出力二故障は同じ実HTTPのResponseを破棄してClientのECONNRESETとServer終了joinを観測し、revision5・stored交換・unconfirmedを保持、確認／終了出版0・自動再送0。重複closeは同じ終了Promiseを返す。自己生成試験Rootだけを使用し、実Host／外部Provider／DockerへEffectを発行していない。最初の試験挿入位置と型注釈の誤りは静的入口で検出・修正し、未実行の候補を成功結果へ混ぜない。取消競合・提示後の現在Role変更・実Browser・全回帰・限定独立レビューは未完了である。

Workbench固定17Pathの限定独立レビューはFail（Critical0／Major2／Moderate1／Minor1）。Browserの操作・短命表示の未観測、Bundle未ステージによる全回帰失敗、現在Architectureの故障評価未同期、結果型Headerのrevision表記を統合した。指摘元との統合是正方針照合は整合・追加人間判断不要。既存Browser終了処理を再利用する専用System試験を追加し、Productionへの試験Route／任意Script受付／新Frameworkは作らない。HeaderはcontractRevisionへ修正し、実型へfieldを追加していない。旧Evidence・正式191 Not Run・公開Launcher未成立は保持する。

是正後の実Browser試験は親1＋通常発行／本人交換／全交換3の計4 Case成功、Exit0・35.8143783秒。POST一回、当該応答の鍵とDOM内一致、次操作開始で消去、通信失敗後の完了表示0、GET／URL／Storage／reloadへの非保持、交換後旧接続unavailable、Browser所有Tree・DevTools／Workbench Listener・専用Root清掃を確認した。秘密はBrowser内比較だけでNodeへ返却せず、console／画像／trace／本文logは保存しない。初回2実行のContext置換故障は成功へ混ぜず、操作前の読取り専用readyとreload後の観測だけを再入場させた。鍵操作Scriptは一回で、発行不明の再送を追加していない。再現入口は`npm run test:credential-browser`。新Symbol／Catalogは既存QA6／7のSTへ接続した。

修正後AM全150／MCP全75と各静的3軸成功、Fail／Cancel／Skip0、Exit0・196.9745874秒／63.2985089秒。Workbench静的3軸とVite Build成功、生成BundleだけIndexへ確定し、一致Oracleを緩めず全41 Case成功、Fail／Cancel／Skip0、Exit0・160.1243424秒。旧33 Caseへ故障子8 Caseを追加した41 Caseで、別実行のBrowser4 Caseを重複計上しない。新固定候補の限定独立再レビューと現在状態への同期はまだ未完了である。

新固定19Pathの独立再レビューは旧4指摘解消、残Moderate2（欠測試験親の準備依存、cleanup assertによる後続回収省略）。統合案を指摘元へ再提示し整合確認後、System試験内だけの固定Root準備と全段cleanupへ是正した。共有`.crdd/tests`は削除・改名せず、同じ準備helperを自己生成fresh Rootの`.crdd`不存在から実測する反証を追加した。Browser／Server終了・両Listener観測・削除範囲確認・Directory削除・ENOENTを独立試行し、全段終了後だけ結果をassertする。Root範囲不正では削除0を維持し、新しいResolver／Framework／Root公開APIは追加しない。

是正後のbootstrap1＋Browser3＋親1の計5 Case成功（46.7307135秒）。清掃assertの期待値だけを一時変異した試験は想定どおりPass1／Fail4・Exit1（57.1969662秒）、全専用Directory0だった。変異前SourceのSHA-256`3DA5B278390747FACE912F14861809AD475CEA7B43AA40856E1DC9FE8F20FF3F`へexact復元し、復元後Browser全5成功・Exit0（41.9686897秒）、Workbench全41成功・Exit0（168.583887秒）、Cancel／Skip0、静的3軸・Build・Bundle Index一致・差分確認成功。これらは意図的な負例と通常回帰を分けた値で、変異のFailを通常成功へ丸めない。

固定19Pathの最終限定独立再レビューはPass・全重大度の残指摘0、開始／終了の全SHA-256一致。試験Rootの独立準備、全段清掃の独立試行、失敗時の専用Directory不存在と秘密非搬送を再照合した。AM全150／MCP全75／Workbench全41／Browser全5の成功はこの接続の根拠に限り、正式191項目、非鍵管理7操作、公開Launcher・通常接続・旧REST撤去・AM全体の未完成を維持する。結果だけをProject ContextとQuality Centerへ同期し、実行別Evidence書庫を追加しない。

結果同期後の全体Checkerは3057 errors／0 warnings・Exit1。変更21PathではProject Contextの既存構造指摘1件だけで、他20Pathは0件。該当判定が読むIdentity・見出し・Checklist行はHEADと完全一致し、今回の更新は最新結果の段落だけであるため、この既存指摘を新規故障や解消済みとは扱わない。全体Ready未成立を保持する。

### Host交換の提示Consumer接続着手 — 2026-10-13

基準`d75542ad`、着手時clean。承認済みHost交換2操作への実装接続として、親照合と独立した契約・lifecycle確認を実施し、追加人間判断なし。初回の私有TTY提示を`credential/present-key-to-terminal.ts`へ移管し、初回と`credential/exchange-from-host.ts`の具体2Consumerで共有する。Package Rootへ共通Writerを公開せず、保存・認可・CLI選択を共通提示処理へ集約しない。Node TTYの一write・callback join・先行取消／error／close・通知tick・共有stream保持は不変。新Lock／Receipt／Store／履歴・Provider／Docker・過去Evidenceは追加／変更しない。

交換と終了のoperation UUIDは別に保持し、交換結果→unconfirmed→confirmed→終了で毎回直前の確定revisionを使う。新tokenだけ一度提示し、stored再入場でtokenを再取得しない。confirmedだけ終了、未確認は別明示交換へ案内する。保存後取消をEffect0へ変換せず、終了不明は元相関と出版・清掃を保持する。新対話確認や表示内容・CLI引数選定はHost入口が所有する。初回既存局所回帰・Host2経路／初回・保存／提示故障・取消・遅延通知・再入場を既存ITへ接続し、静的3軸・全回帰・固定候補独立レビューを実施する。ST実TTY・Workbench・公開Launcher・正式191項目・AM全体は未成立を維持する。準拠基準と外部Provider境界を変更しないため準拠監査・署名Provider E2Eはこの接続段階では対象外。

現在候補はAM全147/147 Case・Exit0・217.2495565秒、MCP全75/75 Case・Exit0・68.0589303秒、各静的3軸成功。Host指定／全員、一度表示時のunconfirmed、保存済み三提示状態の再入場、開始前／保存後／TTY中取消と遅延error、終了publish失敗時の元参照を反証した。現在観測不明時に清掃を推定せず、保存済み終了後の取消もcompleted応答へ戻さない。限定独立レビューの実指摘は試験不足2件で、是正後の提示開始／確認／終了出版故障とCLI材料処置を含む対象2 Caseは9.0387939秒・Exit0で成功した。停止guardを一時無効化した変異はCLIの期待Exit2に対するExit0で失敗し、復元後のSource SHA256は28BAC3B3F0D6EC06F8D3D372D1639D5558987D89E247D5BA9EB5F3359CC9103Cで全回帰時と一致した。固定11Pathの限定独立再レビューはPass、全重大度の残指摘0。Checker対象11Path指摘0、全体3057 errors／0 warnings・Exit1。自己生成Root残存0、差分空白確認成功。Symbol2件と既存suite／Catalogを接続し、Local Itemの新設や正式191項目のPassにはしない。実Host TTY・Workbench本番・公開Launcher・旧REST撤去・AM全体は未成立。

Host CLIの公開入口へ指定／全員交換を接続した。材料処置後の再実行、OS操作者とAM Userの区別、確認済み前記録の整理と新交換の区別、同交換の固定集合とUUID、入力interface終了後の鍵提示を採用した。通常・途中再開・未確認stored置換・confirmed整理・初回指定、対象拒否・否認・EOF・取消・表示後改訂競合、CLI自身が材料を整理した要求のprompt／鍵0と次fresh要求を確認した。初回データのID不一致と故障結果の期待値不一致は試験データ／期待値だけを修正し、Sourceを弱めていない。前交換参照の推定追加というレビュー案は、通常未提示発行との識別不能とprevious省略時の既存継続契約に反するため撤回された。置換開始時のexact旧相関と、確定後の新交換IDによる継続を維持し、新Schema／推定Guardを追加しない。提示保存のcleanup／Lock故障は既存Writer試験、compositionは四・五・六番目のrename故障を直接反証する。実Host管理領域や旧Evidenceは変更していない。

### 交換本体の保存接続の着手と固定条件 — 2026-10-13

基準98363c47、開始時clean。親と読取り専用確認者が既存正本・保存意味を照合し、現在Authorityを先行材料処置より前に確認すること、同Lock要求内のadmissionだけで失効後も進むことを確定した。別要求はfresh認可で、起点entry・旧集合・同Recoveryを保持する。prepared未確定時は耐久Recoveryを返さず、current=next材料処置要求は停止、credential base材料は保持停止する。追加人間判断・新Store／Lock／Framework／MCP鍵操作はない。

Source候補は4経路を既存保存Ownerの三出版へ接続し、pure候補と物理処理を分ける。core保存結果は提示・record整理の完了と区別する。実Process試験は既存credential-management-workerを拡張し、秘密のargv／stdout搬送や新しい実行別Directoryを作らない。三出版故障・生成／容量・拒否Actor・初回Binding・現在再入場・実Process喪失と競合を既存QAへ接続する。提示Owner・非秘密交換read・record整理・Host／Workbench本番Consumer・正式191項目・AM全体は残る。この着手記録を完成根拠にしない。

交換保存候補の限定結果：局所10件、修正後AM全125件／MCP全75件と両Package静的3軸成功。Fail／Cancel／Skip0・各Exit0、全回帰終了後の自己生成store Root残存0。三出版の各prepare／rename／読戻し／清掃、生成／容量、拒否Actor、初回Binding、旧資格0件、別要求の現在管理者／Host継続、主Failureと解放不明を確認した。実Processを三出版の前後で終了する6条件と同ID／別対象／全員・指定の3競合を観測し、base保持停止・next処置後のfresh継続・stored再生成0を区別した。失効後の旧鍵再認証を誤追加する一時変異を検出し、復元後に成功した。最初の試験型注釈不足は静的入口で是正し、その後の局所・全回帰結果だけを正式な当候補の実測値とする。

固定11Pathの限定独立レビューは全重大度の残指摘0。Symbol ID・Catalog ID／Path重複0、登録実体欠落0、差分空白確認成功。Repository Checkerは全体3057 errors／0 warnings・Exit1、当該11Path抽出指摘0。全体Passとはしない。保存coreのcompletedは提示前の結果で、未解決recordとnot_attemptedを保持する。非秘密交換read、提示・record整理、本番Host／Workbench、実Host／Linux、旧REST撤去、正式191項目、AM全体は未成立。次は保存済み交換の非秘密再観測と終了処置を同じ所有者へ接続する。実行別Evidence書庫や新State／Lockを作らない。

### 共有AI Profile管理のRole採用と本番接続 — 2026-10-12

Source候補の局所結果：基準`ec2a2e3e`、Node v24.19.0。AM60／AI Adapter30／旧CROS34／MCP68／Workbench33の計225 Case（追加Workbench33 Caseは旧比較Consumerの回帰）、各書式・型・Warning禁止Lint成功、Fail／Cancel／Skip0、全Exit0。実HTTPと自己生成実Catalog Storeでmanager／administrator四操作・developer非開示・次要求のRole変更／失効、遅延認可・二依存拒否・採用後取消／応答故障の改訂保持を確認した。AM新試験の初回途中Fixture不整合は正規の一User・一Credential・元発行相関へ是正し、局所再試験後にAM全回帰を再実行した。最初の失敗を現在の成功へ混ぜない。Biomeの一時OS1224は同じ対象の再実行で解消した。固定29Pathの限定独立再レビューはPass・全重大度残指摘0。全体Checkerは3057 errors／exit1を維持し、変更29Path抽出はProject Context構造の既存1件のみ。判定に使う三Identity・五見出し・Checklist見出しとcheckboxの17行が基準HEADと順序込み完全一致し、差分起因0を確認した。Repository全体Passとは扱わず、正式191項目Not Runと本番Launcher／Workbench・鍵配送・旧REST撤去・AM全体未完成を維持する。実行別ログ書庫は作らず、各Packageの`npm test`から再生成する。

Qual-Labは既存四操作（一覧・登録・変更・確認付き削除）をmanager／administratorへ許可する方針を採用した。鍵はadministrator専用を維持する。登録済みAdapter／許可Modelを参照するProfile限定操作であり、Provider Adapter登録・Model Catalog変更・CLI配置・Provider実行Effectの許可を拡大しない。Repository単体へCROS資格・Roleを要求しない。

基準`e08d09b3`、着手時clean。変更分類は採用済み管理Authorityの具体化・追加区分の直接伝播と接続。着手前の親照合と読み取り専用確認は着手可・追加人間判断不要。Profileの内容Chain（REQ16→UX18→IA13→UI10→SPEC15→ARCH10→AI Adapter）と認可Chain（REQ41→UX35→IA9→UI8→SPEC12→ARCH13→AM）を交点で接続する。固定管理区分は8から9、具体判定操作は10から11へ追加する。現在の要求・定義・詳細・QAの件数を同期し、過去限定結果・正式Evidenceは変更しない。

SourceではAMが既存通常認証の同改訂Roleから許可／拒否／観測不能だけを返す用途限定入口を所有する。Catalog操作中までAM Lockを保持せず、別Owner／別改訂の保存原子性を作らない。AI Adapterへ旧CROS純粋Mutation検査を移し、MCP・旧HTTPが同公開契約を使用する。MCPは一覧の現在認可と、Callの完全入力検査→開始前取消→現在認可→一回Catalog操作→取消再確認を接続する。未知状態は通常拒否へ丸めず、採用後の応答故障・取消からrollback・暗黙再Mutationを行わない。

必須反証は三Role、Header後のRole変更・失効・初回未完了・状態不明、一覧／Callの現在値、非管理Store観測0・存在非開示、不正入力・未知Adapter／Model・競合・未確認削除のEffect0、採用後取消／故障の改訂保持、Provider・鍵・任意CLI変更0、旧Parser参照0、旧REST能力保持とLocal管理回帰である。QA1のRCM-IT-005（Catalog／改訂／採用後故障）、RCM-IT-010（Tool Lifecycle）、RCM-ST-012（旧Consumerから新契約への移行閉包）とQA7のRFD-UT-020（純粋判定）、RFD-IT-013（資格→現在Role断面のみ）、RFD-UAT-007（管理の違いの理解）へ接続する。RFD-IT-021／ST-022の通常6 AM保存操作はProfileへ流用せず、QA4へProfile契約を複製しない。必要な独立レビュー・文書直接影響・Package回帰・差分・終了後観測を行う。標準規範・Provider実行・Docker・Host秘密は不変更のため、準拠監査・署名Provider E2Eはこの接続段階の対象外。文書24件の独立再レビューは全重大度残指摘0・Passとして`ec2a2e3e`へ固定した。続くSource局所候補は固定9区分／11具体操作、AMの用途限定現在判定、AI AdapterへのParser移管、MCP遅延認可を接続する。本番入口・正式191項目・AM全体完成は未成立である。

全16現行親Folderを対象に、変更不要も理由付きで処置する。`docker-isolation`の独立Package化は2026-10-14に人間承認済みであり、以下の技術責務境界で実装する。

2026-10-09の人間判断により、当初案の実行系6〜8を公開入口9〜11の後へ移す。大改修に先立ちCROS／MCP／Workbenchを整理するため、改訂後は公開入口を6〜8、実行系を9〜11とする。実行系の要求・結果・取消の目標契約は順序0で照合するが、その実装を前倒ししない。

前半の公開入口整理では現行の実行APIと安全境界を維持し、UI／Protocolの責務を実行内部から分離する。後半の差し替えに備えるためだけの中継Frameworkや二重実装は作らない。未成立の実行機能は未成立のまま示し、公開入口の限定完了と実行系を含む全体完成を区別する。公開入口を閉じるために実行系の変更が不可欠と判明した場合は、その依存を示して順序を再判断し、黙って大改修を前倒ししない。

| 順序 | 主対象Package | 主な作業・閉じる範囲 | この順序の理由 |
|---|---|---|---|
| 0 | 全体のArchitecture／Quality | 前節の対応表と上位・下位の要求／結果／取消／状態Ownerを固定する。Docker分離、単体Coordinator入口等の判断を得る | 下位を先に作り、後から上位の都合で契約を作り直すことを避ける |
| 1 | `version-control` | Repository／Revision／Git操作／採用時の短い書込み境界を整理。Layout観測とExclude更新を分離 | Domain保存と候補採用の基盤。worktree採用を前提にしない |
| 2 | `domain-model` | 意味・CRUD・保存の責務を整理。Topic／Meeting、投影と候補判断、型集合の混在を処置。改訂競合・必要な短時間排他・atomic公開を評価 | 上位が保存方式を重複実装しないため。DomainからGit Commit／Pushを発行しない |
| 3 | `execution-intelligence` | 実行事実・要約と評価候補を分離。時刻、欠測、保持設定と最小Event契約を確認 | 実行系再編に先立ち、記録する事実と記録Ownerを決める。実行制御を持たせない |
| 4 | `ai-adapter` | ProfileとProvider固有要求・CLI引数・結果変換・エラーを整理。公式CLIを未改造で使う | CoordinatorからProvider差を外す。AdapterからTask進行や履歴保存を発行しない |
| 5 | `platform-access` | 実行系が本当に必要とするOS保証と呼出し側を全数照合。必要Native部品だけ整理し、Nodeで同じ保証を満たせる部分は置換候補にする | Docker／Processの設計前にOS保証を確認。Package廃止やRust全面置換は事前決定しない |
| 6 | 現行`cros` → `access-management`／`domain-model`等 | 認証・認可・管理回復と接続RegistryをAccess Managementへ再編し、Context集約・通信・実行判断を分離する。全Source・公開API・利用側の対応とArchitecture／Qualityを固定してから移管する | CROSを全体システム概念とPackage名に分ける。単純改名で現行責務全部をAccess Managementへ吸収せず、旧Package撤去は全責務と利用側の接続後とする |
| 7 | `mcp-server` | Machine向け公開契約とstdio／HTTP lifecycleを閉じる。Shared Host所有と配布入口の巨大組立てを整理 | CROSの責務整理を受けて公開入口を整理。実行内部は現行契約を維持し、単一RepositoryとCROSで操作Schemaを不用意に分岐させない |
| 8 | `workbench-server` | 本番組立てをbinからSourceへ移し、Browser API／同Hostの専門API直接呼出し／共有HostへのBrowser接続を接続。変更通知・編集中入力保護を具体化 | 公開入口の責務整理を実行系大改修より先に閉じる。WorkbenchのMCP依存はLocal／共有とも撤去し、UX／IA・Visualの人間確認とBackend整理を区別する |
| 9 | `docker-isolation`／現行CoordinatorのDocker関連処理 | Docker固有の実行・取消・観測・清掃・診断・Desktop操作と必要最小の再入場を移す。上位へ閉じた実行事実を通知し、既存能力と実境界を照合する | 後半の大改修では最初に技術資源Ownerを閉じる。上位は許可・正本状態・通知の接続へ絞り、下位は上位を知らない |
| 10 | `coordinator` | AI Adapterと隔離APIを利用する実行・Executor／Reviewer・進捗・取消・結果返却へ集約。重複永続状態とConsumer保存依存を削る | 下位の終了条件が成立してからAI実行を組み立てる。下位から上位をimportしない |
| 11 | `orchestrator` | Task／Attempt／Queue・実行順・判断待ち・耐久結果を一つのOwnerへ集約。採用した本番入口を接続し、整理済み公開入口の利用側を追従する | Coordinatorの実結果を上位状態へ接続する。内部モックだけで本番完了にしない |
| 12 | `artifact-signing` | 任意正式配布の対象と必要な真正性保証に合わせ、Release Tooling／Runtime検査の境界を整理 | Source移管ごとの反復署名を避ける。ただし実行系設計に影響する保証は順序0で先に判断する |
| 13 | `official-asset-governance` | 保存と認可・判断実行の混在を処置。比較交換・確定単位を保つ | 実行系と独立して閉じられる。今回も第三の中継層を追加しない |
| 14 | `semantic-coverage` → `checker` → `verification-runner` → `visual-preview` | Compiler／結果変換、Rule／CLI、Catalog／許可／回帰選択等を整理。新所有者の検査と実行Profileを完成させる | 全体の最終契約へ合わせる。移管中に必要な検査追従は各順序で先に実施し、ここまで放置しない |
| 15 | 全体 | 全回帰、Reality Audit、独立レビュー、必要な実Provider／未署名通常入口E2E（任意正式配布署名は適用時だけ独立評価）、移行・公開文書・現在状態を更新 | 全Package単体の合格だけから全体完成を推定しない |

## 4. 大改修する実行系の切り方

### 通常Runtimeの署名依存撤去への方針訂正 — 2026-10-14

次のSource単位は、承認済みの既存Platform Access内Node境界である。非Authority・非変更のNative Artifact同一性観測と固定System Directory観測を移し、製品／Scriptの全import・exact配布検査・型Project・Symbol／Catalog・coverage・fixtureを同じ候補へ追従させる。旧Path／shim・下位から上位importは0を確認する。正式Runnerへ同OwnerのNode＋Rust静的／実行／選択を明示接続する。正常・欠落・改変・実体置換・偽token・Process／Protocol異常と終了を既存QAへ接続し、独立レビューを行う。Rust本体・Native Hash／Protocol・既存用途権限は不変更。Windows環境BuilderとDocker専用環境の責務分離は次の単位へ残す。現在の署名Manifest結合fieldは新しい通常Runtime保証にしない。

限定確認結果: この訂正に関するArchitecture・脅威モデル・QA・Workflow・計画・現在投影の10文書は、契約／直接伝播と品質の独立再確認で全重大度の残指摘0となった。旧回復Oracle全文は比較専用区画へ保持し、旧handoffの2 IDは別意味へ再利用せず現Runtime非適用とした。Sourceの旧issuer／consumer／revoker撤去、新しい通常入口の実測、上流Ownerへの残伝播、Package完成をこの文書確認から推定しない。Source・過去正式Evidenceはこの訂正単位で変更していない。差分書式検査は成功した。先行する広域Checkerは2677 errors／0 warningsで未合格、対象内ではPROJECT_CONTEXTの形式指摘1件が残るため全体Passとは表示しない。

人間が[実行・追跡・正式配布の三分離](../../../06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)を承認した。以前の「旧署名保証を維持して新Ownerへ移管する」方針を訂正する。通常Coordinator実行・Task・Workbench助言／候補・認証・Docker運用介入はCRDD独自署名Manifestと署名由来Runtime Capabilityを必須にしない。必要な現在認可、送信同意、Repository／用途・Home、固定入口と必要Artifact同一性、Docker隔離、取消・清掃・unknown・同じRecovery IDは維持する。

| 母集団 | 処置 | 完成確認 |
|---|---|---|
| 通常実行Gate | 署名issuer／consumer／revokerと署名欠測による拒否を撤去・再接続。Hash Capabilityや常時true Gateへ置換しない | 未署名の選択Checkoutから許可済み実行へ到達し、許可・用途・必要実体不成立はEffect前停止 |
| Source／Artifact追跡 | 基準Commit／Treeと作業Tree差、必要Native／CLI／Image／設定のIdentity／Hashを相関する。巨大AST実行閉包と全Repositoryコピーを通常実行から外す | 不一致・観測不能を停止し、Hash一致を真正性・Authority・実行中変更不能へ昇格しない |
| 正式配布 | 必要時だけRelease／QA Ownerが真正性を評価。通常Runtimeとは独立した任意機能 | 任意署名の失敗が通常実行のCapability発行・失効へ波及しない。署名未実施を署名Passにしない |
| 旧署名記録・物理残存 | 過去Evidence／署名／Hashは不変更。旧chainをCommit／Hashへ機械置換しない。フロントAIが必要内容と未解決参照を保全して移行・清掃 | Runtimeに互換Reader・二重Schema・新移行Frameworkを追加しない。移行不能・未完了・現在相関不明は新Effect0 |

Sourceは未変更である。少なくともCoordinatorの`cli/command.ts`、`task/execution.ts`、`workbench-ai/advice-execution.ts`、`workbench-ai/change-candidate-executor.ts`、Orchestratorの`operation-composition.ts`、Workbench公開入口、署名scripts、固定Consumer graph・関連試験を処置する。`package-verification.ts`全体を無条件に削除せず、必要Artifact観測・任意Release検査・試験用配布照合と、廃止する通常実行Capabilityを分ける。旧実測は基準能力との比較だけに使用し、新経路の成功を証明しない。

| 正本・利用側 | 今回の設計訂正／後続処置 |
|---|---|
| Coordinator詳細・脅威モデル | 三分離、旧署名Gate廃止、現在許可と出所／同一性の境界を更新。旧V6は比較基準へ限定 |
| Docker Isolation・Orchestrator・AI Adapter詳細 | 署名を開始条件にしない。技術実行／上位判断／Provider差を維持。旧Execution Authorization Portは撤去・再接続対象 |
| QA-000006／QA-000010・Workflow・現在投影 | 未署名実行の反証と配布読取り評価を分け、Source未適合・未実測を表示。過去正式結果は不変更 |
| REQ-000018／REQ-000025、SPEC-000018、ARCH-000014、Domain・runtime-trust・artifact-signing詳細 | 署名・準拠・完全性・Publisher・利用者判断の独立Meaningを保持。残る旧Runtime前提をSource切替前に照合・直接伝播し、未処置のまま全体整合済みとしない。将来Trust Policyをv0.22へ追加しない |
| Platform Access | 固定Hashの同一性観測を署名や実行許可と混同しない。共通OS処理を既存PackageのNode境界へ移す配置は人間了承済み。Rust／Node両試験を接続し、旧Coordinator wrapperを残さない |

この訂正は採用済みSecurity／実行境界の変更であり、計画とArchitecture／Quality・手順の更新を先行する。契約・品質の着手前照合では追加人間判断なし。固定文書の独立レビュー、文書／直接伝播／Gap確認を実施する。Source、鍵、実Provider、Docker、旧実物、過去Evidence、Release判断は今回文書単位では変更しない。標準準拠の主張やCommunicationを変更しないため、それらの全監査・公開操作は発火させない。

順序9は新境界を先に固定し、共有Node技術処理の移管と並行して旧Runtime署名依存を撤去する。署名Gateを先に常時通過へ変える暫定実装は作らない。新しい公開Input／Result／Event・現在状態・入口を接続し、未署名の開始、拒否条件まで到達する失敗、取消・親喪失・同ID回復・実資源不存在、全本番Consumer、必要な実Provider境界を検証する。固定候補の回帰と独立確認が成立してからCommit／Pushする。実署名・署名E2Eは通常実行の完成条件から外し、任意配布機能を実施する場合だけ別の適用範囲で扱う。

### Docker技術処理の集約と通知接続への方針訂正 — 2026-10-14

人間の追加指示により、順序9の完成対象を「通常隔離の限定抽出」から「Docker固有の技術処理の集約」へ訂正する。Docker Desktopの実処理をCoordinatorへ残す旧判断は、以下の着手時点の履歴であり、現在の完成条件ではない。Docker利用、署名以外の既存安全条件、使い捨て資源、一次失敗と清掃結果の分離は維持する。署名必須の訂正は直前の三分離判断を適用する。下位通知と上位状態の契約は[Docker隔離詳細設計](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#6-通知と上位状態の接続)を正本とする。

| 対象 | 処置と完成時の所有者 |
|---|---|
| Container／Network、Docker CLI、所有Process、待機・取消・清掃・診断 | Docker Isolationへ集約。上位でargv、inspect解析、終了手順を重複実装しない |
| Docker Desktop／WSL／Engineの停止・開始・観測・固定修復 | 実処理はDocker Isolation。実施可否・人間承認・影響範囲の判断は上位に維持 |
| AI実行許可、Provider Home利用許可、配布・実行能力の採用 | 既存の上位／専門Ownerに維持。下位は検査済み技術入力とfreshな生存・実体観測だけを借用 |
| Coordinatorの状態管理 | 下位の事実を元Operationへ相関し正本状態へ反映。必要な通知だけをOrchestratorへ伝播する薄い接続処理 |
| Orchestratorの状態管理 | Coordinatorの公開結果・通知からTask／Attempt・進行・再試行・採否を管理。Dockerの生操作や技術Stateを重複所有しない |
| 回復・介入・履歴の正本保存 | 既存の上位保存Ownerへ維持。ただし巨大Fileを現形で温存する理由にはせず、Dockerの技術判定と実処理を分離する |

通知は用途限定callbackとしてCoordinatorが登録する。Docker IsolationからCoordinator／Orchestratorをimportせず、直接Orchestratorへ送らない。新event bus、共有State、Registry、Lock、永続通知Queue、汎用Port Frameworkは作らない。通知を新しいAuthorityや唯一の回復根拠にせず、元Identityと現在観測を維持する。Consumerの任意保存・表示や耐久ACKをDocker cleanup完了条件にしない。

#### 残存Sourceの処置と実施順

追加の完成条件: Coordinator／OrchestratorのDocker境界はOS・配置形態を知らない。公開入力・結果・通知と本番分岐からOS選択、Windows／Desktop専用型、CLI／pipe／System32／WSL／Process方式を除去する。現在残る`DockerIsolationDependencies.platform`、上位のEngine定数・Windows環境構築・CLI snapshot／Path、回復処理のwin32／WSL／Desktop分岐は未移管であり、薄いAdapter完成の根拠にしない。下位内部で実装を選択し、未対応は新Effect前に共通の未対応結果へ停止する。今回Linux対応は新設しない。汎用のPlatform Access・配布Trust・正本保存、過去Evidenceと診断表示は別母集団として維持するが、業務制御をOS固有reasonへ依存させない。詳細は[環境依存の境界](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#環境依存を上位へ公開しない)へ接続する。

| 順番 | 現在のSource群 | 処置 |
|---|---|---|
| 9A | `docker-execution/`の通常実行・診断・認証・技術回復 | 既存抽出候補を維持し、未完の上位試験接続・投影Oracleを閉じる。旧API復活や検査緩和で成功へ戻さない |
| 9B | `cli-trust.ts`、`owned-process.ts`のDocker専用環境、`wsl-state.ts`、`current-artifact-trust.ts`（旧`restart-state.ts`は現行Machine／checkpointへ保証対応後に撤去済み） | 純粋技術判定とDocker専用観測を下位へ。汎用の署名・Runtime能力検証は既存専門Ownerに残す。Source・Test・配布Guardを同じOwnerへ接続 |
| 9C | `restart-machine.ts`、`repair-native-process.ts`、`repair-native-process-lifecycle.ts`（旧`restart-execution.ts`は現行固定Runtime／Callerへ保証対応後に撤去済み） | 停止・開始・Engine観測・Native Protocol・Process終端を下位へ。許可・既存保存との接続を分離し、固定APIから本番へ到達させる |
| 9D | `repair.ts`、`restart-recovery.ts` | exportとEffect発生点ごとに技術Plan／観測／実処理と上位判断／記録を対応付けて分割。約7.5千行の`repair.ts`を丸ごと移さず、上位にDocker実処理を残さない |
| 9E | `repair-record-store.ts`、`repair-continuation-store.ts`、`repair-history-publication.ts`、`restart-record.ts`、`restart-handoff-record.ts`、`restart-continuation-record.ts`、既存Docker回復保存 | 正本保存・相関・承認／fence・履歴意味は上位。現在制御は下位からの環境中立projectionのみを使い、旧Desktop Schema／phaseを上位分岐へ流用しない。Docker固有構成・技術結果の判定は下位。旧形式はフロントAIが移行し、Runtime互換Reader・二重Schemaは追加しない。約4.5千行の記録Storeを新しい下位Storeへ機械移動せず、現在Schemaとexact Identity・利用側・移行入力・停止条件を照合する |
| 9F | 全本番利用側と通知 | Coordinator経由の状態更新・必要時Orchestrator伝播、取消・遅延／重複・配送失敗・親喪失を確認。旧重複実装・未接続利用側0を照合し、全回帰・独立レビュー後にCommit／Push |

今回の変更分類は、人間が指定した技術Owner境界の拡張と上位Adapter化である。追加の読取り専用着手前照合は、旧Desktop非移管方針との競合、巨大Fileの責務混在、通知欠測と正本状態の分離を確認した。現時点の追加人間判断はない。実際のDocker停止・修復・再起動、許可条件・保存Schema・公開操作の変更は、移管許可だけから実行・採用しない。

固定候補では、上位製品Sourceに残るDocker／WSL／Desktopのspawn、wait、kill、inspect、rm、技術診断を全数照合し、薄い接続・既存Trust／Authority観測・正本保存以外の残存を未完了として扱う。下位から上位import 0、全本番Consumerの下位Root接続、旧Native helperの真正性・Job所有・終了保証、配布閉包、通知・返却の相関と実Windows／Docker境界を確認する。移管ファイル数や下位単体試験の成功だけで完成としない。

### 順序9の着手前Source照合 — 2026-10-14

基準Commit `2b2d7caf`。Access Managementの限定区切りと後続4項目の保持を確認した後、現行Coordinatorの`docker-execution/`24 File、`docker-desktop/`15 Fileと直接接続を読取り照合した。39 File全体を新Packageへ機械移動する案は採らない。隔離の技術処理と、Provider差・Task／助言・実行許可・保存が混在するためである。以下は配置候補の照合結果であり、新Package作成・保証削除・Source変更の成立記録ではない。

| 確認した接続 | 現在の混在 | 次の設計で分ける境界 |
|---|---|---|
| `docker-execution/types.ts` | Docker資源・コマンドに加え、Workbench助言Packet・Task役割・選定・Mount／Authority型を持つ | 下位は隔離に必要な入力・資源・実行結果だけ。Task／助言／Modelの意味を下位へ移さない |
| `docker-execution/provider-composition.ts` | Packet消費・選定Grant・Provider Authority・Home Mountと時計を組み立てる | 上位Coordinatorが既存Ownerへ接続し、隔離Ownerから上位State／Packetをimportしない |
| `docker-execution/process-controller.ts` | Docker制御とProvider結果正規化・Task結果解析・Authority消費・Recoveryを同時に持つ | Docker開始・待機・取消・回収の事実を返し、Provider差はAI Adapter、実行判断はCoordinatorへ分ける |
| `provider/codex-docker-adapter.ts`等 | Provider固定入口が共通Docker準備に結合 | Provider識別名だけで新しい中継層を増やさず、既存Adapterの必要な記述と利用側を照合する |
| `state-storage/docker-recovery-journal.ts`と`docker-desktop/` | Task資源の記録とDesktop修復・再起動の運用処理が別に存在する | Task隔離と明示的なHost運用介入を区別し、全Fileを隔離Packageへ吸収したり既存能力を無根拠に削除しない |

Access Managementのユーザー・鍵・Role・Repository公開範囲は公開Surfaceの現在認証・認可へ残す。Provider用認証Home・隔離資源の利用条件を、CROSユーザー資格と同じ管理対象へ統合しない。新しい共有State・Registry・Lock・Recovery管理は追加しない。既存能力・過去Evidence・全利用側と代替Ownerの対応を固定し、Package境界と必要な実環境保証の採用を確認してからSourceを変更する。後続実Host ST／人間UATを、この読取り照合の成功で閉じない。

このSource照合の限定独立確認はPass・全重大度残指摘0。以下の比較を経て、2026-10-14に人間が独立Package化と完成までの継続を承認した。完了後にCommit・Pushする。Source抽出、実Docker確認、固定候補の独立レビューはこれから実施するため、事前確認を完成根拠へ流用しない。

| 選択肢 | 利点 | 費用・残る制約 |
|---|---|---|
| 独立`docker-isolation` Package | 隔離・開始・取消・回収の責務を親Folderで示し、AI依頼なしの局所試験と公開依存を分離できる | Package設定・公開API・直接利用側・配布閉包の追従が必要。現39 Fileを丸ごと移せず、上位依存を先に分ける必要がある |
| Coordinator内の責務Module | Package数を増やさず、既存組立てへ段階的に接続できる | Coordinatorの親FolderがAI実行判断と技術資源Ownerを引き続き包含する。ModuleでもTask／助言・Provider差との分離は必要で、混在の温存ではない |

着手時点の判断履歴: 採用した選択は独立Package。新しいServer／CLI／共有Stateを作る目的ではなく、隔離の技術Ownerを明確にする目的に限定した。この時点ではDesktop修復・再起動の移管を含めなかったが、現在は上の方針訂正により技術実処理を移管対象に含める。運用介入の許可・保存正本は上位に保持し、新しいRegistry・Lock・汎用Recovery管理は追加しない。

今回の変更は複数Packageにまたがる実行資源Ownerの責務分離である。基準Commitは`715d7905`、書込み範囲は現在のRepositoryだけ。Architecture・Quality・Source・本番利用側・配布閉包を対象に着手前整合確認を行い、技術境界と品質の独立レビュー、直接伝播の文書確認、移管漏れのGap確認を実施する。準拠基準そのもの、Communication、Release判断は変更しないため、それらの全監査・公開処理は今回発火させない。

完成前には、開始前拒否、作成結果不明、開始・待機・取消、遅延通知、Process終了、exact資源の清掃、清掃観測不能、親喪失後の同じ回復参照を既存能力と照合する。一次失敗と清掃結果を分離し、観測不能を不存在へ変換しない。実Dockerの局所試験は外部AI依頼を伴わない。本番CoordinatorのTask・助言・CLI回復Consumer、診断、署名配布の閉包を新Ownerへ接続し、未接続Consumerがある間はPackage完成としない。

#### 記録後Task回復の現在方式への置換 — Source照合 2026-10-15

Orchestrator接続の着手前照合: 契約・品質の読取り専用確認を統合した。現在のcompositionは旧同期回復と旧相関探索へ接続し、ObjectiveはPromiseを待たず旧recovered＋IDなしだけを受けるため、新方式へ切替が必要である。固定Rootの用途限定公開2関数へ接続し、必須signal搬送、Dockerだけのawait、exact awaiting_delivery共同条件、前後のQueue／状態／義務・取消確認と既存CAS、既存ACK二段を使う。新Lock／Framework／Schemaは作らない。runtime_process、旧CLI flagsと限定unknown Classは変更しない。Source・試験・両Owner Architecture・QAの直接伝播と独立レビューを必須とする。現行CLI候補全24回帰の終端後に回復Moduleを新候補へ編集する。実Docker・再起動は行わない。

履歴の物理接続候補: 既存settlementsの現在終端専用ContextとReader／Writerへ接続した。時刻・段階・候補は保存材料から導出し、File実体と本文・保持設定を各保存で再確認する。新Map／Lock／Schemaや旧実行資格の復元は追加していない。初回の実I/O 11件は8成功・3失敗で、Host清掃Cとの誤分類、通常Readerの正常状態、履歴本文不正時のprepare拒否を是正した。失敗3件の再確認3/3後、固定候補全11件が成功・失敗／取消／skip0・exit0（253992.7532ms）。関連19件も成功（573.8662ms）、Source strict・対象format／lint・差分空白検査成功。全試験型は旧API18件が残る。Biome checkのimport整理assist 6件はformat／lintと分離して未処置である。

同候補の独立確認は、品質Major1・Minor1を検出した。履歴未確認＋confirmed state.pendingの再入場では、canonical履歴が既に固定全文で出版済みであることをReader／Writer双方へ追加し、欠測・別ID行のみの交差反例と、全物理Caseの非対象操作全文不変を追加した。両観点へ是正方針を再提示して整合確認済み。是正箇所の局所1/1（26542.6551ms）と関連19/19（632.1343ms）は成功し、両独立再確認は全重大度残指摘0。修正版の全11再回帰は実行中であり、機械結果の完走を待つ。保持期間後の確認済み履歴行の欠測は正当で、再追加しない。Repo単位markerだけから特定操作の出版直後とは推定しない。履歴配送・通常CLI・全体E2E・Package完成・Commit／Pushは引き続き未成立。Docker／Provider要求・再起動は行っていない。以下の未接続記述は先行段階の履歴である。

次の接続に対する着手前確認: 保存Identityの利用側からOrchestratorだけ耐久配送を登録し、登録後は既存の結果参照・上位ACK・整理経路を使う。未受理の登録保存へACK前提のrecoveredDelivery Readerを流用しない。既存settlements内の現在配送専用ContextとWriterを用い、旧live終端入力を合成しない。CLI／Workbenchは共通回復Driverで除去せず、各固定用途の実際の返却境界へ接続する。履歴確認、保存途中のexact候補、元版・Root・Host不存在、一次失敗と他操作不変を再確認する。awaiting_deliveryの新設定、新Map／Lock／Schema／Framework、実Docker再起動は追加しない。この着手前確認は実装・完成レビューではなく、配送Sourceは未接続である。

修正版の機械結果確定: 上記の全11再回帰は11/11、失敗／取消／skip0、exit0（256831.6738ms）で完走した。レビュー時と実行後のSource・試験4FileのSHA-256不変を確認した。両独立再確認の残指摘0と合わせ、現在回収の履歴出版・fresh再入場に限った確認は完了。結果配送・通常CLI・Package全体の完成へ拡張しない。

現在回収の耐久配送登録候補: 既存settlementsへ`current_delivery`を追加し、保存済み利用側からOrchestratorだけ既存配送一件を登録するReader／Writer／Driverを接続した。未受領登録を旧ACK Readerへ流さず、元版・固定要約・履歴実体・Root・Host両不存在を照合する。CLI／Workbenchは共通Driverで登録も操作除去も行わない。登録途中はexact pendingとRepo結合markerだけを再構成し、同Owner失敗後は停止、fresh Ownerでだけ再入場する。先行する終了Writerの失敗も同Ownerへ保持し、後続履歴・配送への進行を止める。新Map／Lock／Schema／Frameworkは追加していない。

局所の実ファイル配送4件は4/4・失敗／取消／skip0・exit0（116091.5772ms）。正常、state出版前後、marker回収前からの別Process再開を確認した。関連20試験は成功（660.0685ms）、Source strict・対象format／lint・runtime traceは成功、全試験型は旧API18件のみ。履歴実体の最終再照合と終了保存失敗の保持を追加した固定修正版について、既存11＋配送4の全15再回帰と独立確認はこれから完了を確認する。登録候補は耐久ACK・操作整理・実CLI／Workbench返却・全体E2E・Package完成の証明ではない。実Docker・Provider要求・再起動なし、Commit／Push未実施。

配送登録の初回固定候補: 全15物理回帰は15/15・失敗／取消／skip0・exit0（372681.2355ms）、既存の現在状態保存・履歴・ACKの2試験も2/2（133837.8554ms）成功した。一方、独立確認は同根因の不正pending受理をMajor1へ集約し、Workbench物理対照不足をModerate1として返した。全結果統合・両観点の是正方針照合後、登録済みcurrent＋同内容pending＋markerをReader／Writer双方で拒否し、Workbench用Identityの一時返却対照を追加した。Reader側だけをメモリ上で無効化し、Writer単独でもEffect 0拒否する反証を含む。型／format／lintは成功、試験型は旧API18件のみ。

追加後の局所2件は製品処理前にWindowsの起動引数長上限で失敗した（ENAMETOOLONG）。固定試験本文を`tests/fixtures/current-host-transition-worker.ts`へ機械的に抽出し、親子の実行を標準入力へ変更した。Root・回復ID・故障種別の意味は維持し、再入場も同じfixture本文を使う。実行時のSource複製Directoryは作らない。修正版の局所2件・全16回帰・独立再確認が終わるまで限定Passとしない。先行失敗の自己生成4領域は資源要求0・Host／marker不存在・fixture commitを確認したが、非使用確認が完了せず保留した。引数長失敗で保持された2領域も含め、名前や経過時間だけでは削除しない。

是正後の現在結果: 引数搬送を直した局所2件は2/2・失敗／取消／skip0・exit0（50857.6665ms）。Readerだけをメモリ上で無効化した実Writer拒否と、Workbenchの実経路での状態全文・履歴・改訂不変／配送0を確認した。関連20件も成功（771.8852ms）、両独立再確認は全重大度残指摘0。Source strict・対象5Fileのformat／lint・runtime trace・差分空白検査成功。固定修正版全16回帰は実行中であり、その完走と固定Hash・試験Root不存在を確認してから限定Gateを閉じる。先行失敗の6領域は、試験と同じ起動条件でexact排他の取得・解放を確認し、未要求資源・Host／marker不存在とfixture Identityを照合した上で限定清掃した。実Docker・Provider要求はなく、ユーザーの認証領域・永続データを変更していない。

配送登録の限定Gate確定: 修正版の全16件は16/16・失敗／取消／skip0・exit0（414427.4839ms）で完走し、実行前後の対象Source／試験／fixture5FileのHash不変と今回の自己生成Root残存0を確認した。両独立再確認の残指摘0と合わせ、現在回収の履歴確認から必要な耐久配送登録・保存途中fresh再入場までを限定完了とする。CLI／Workbenchの実返却・操作整理、通常CLI切替、旧Task回復経路と署名依存の残存撤去、全体回帰・実境界E2E・Package完成は残る。Commit／Pushは全体完成後の条件を維持する。

現在Rootの技術回収組立て候補: `recoverRuntimeOwnedDockerTaskFromCurrentRepository`で既存Owner取得→DI資源→Host遷移／清掃→全解放→終端→履歴→配送登録を接続した。既Host不存在ならconfig再作成・資源再削除を行わず、出版途中だけ既存保存Ownerへ渡す。最初の失敗と解放失敗を分離し、段階間取消は新Effectを止める。操作は保持し、内部準備キーは公開reportへ出さない。同期下位要求中の即時取消・Task全体回復・結果返却・操作整理は主張しない。旧CLI入口とAppData／署名経路はまだ置換していない。

同組立ての実Host局所1件は初回に期待改訂数が1不足して失敗し、資源回収確認の1改訂を期待値へ追加後1/1・失敗／取消／skip0・exit0（29760.5836ms）成功した。本文VM抽出のasync export対応漏れも是正し、各段階停止・例外・解放false／例外・六取消点を含む関連21件は21/21（590.6203ms）成功。Source strict・対象Lint成功、全試験型は既存18件のみ。固定候補の独立確認と全17物理回帰はこれから完了を確認する。Docker要求・Provider依頼・再起動・Commit／Pushなし。

同候補の独立確認は契約Moderate 1・品質Moderate 3で未合格。全結果を統合し、編集前に両確認者へ次の是正方針を再提示して整合を確認した。新たな管理機構・公開API・下位段階順は追加／変更しない。

| 指摘と原因 | 一次編集箇所と予定処置 | 確認方法 |
|---|---|---|
| Proxy取消入力がinstanceofを通りtrapを実行し得る | 回収組立てのsignal検査でisProxyを先行拒否 | genuine Signalを包むProxyの全trap・prepare・yield・Effect 0 |
| 準備／短期Writer解放不明の結果相関が不足 | 各既存失敗returnで観測済みfalseだけcleanupReasonへ独立保持。履歴／配送の保存確認済み事実も保持 | 元reason、Lock結果、確認済みfieldと後続Effect 0の全field Matrix。throwだけからLock不明を推測しない |
| 模擬試験が全枝の後続Effectと結果を直接観測しない | 既存シナリオをexact event列と全結果fieldへ拡張 | 後段余分event・確認済みfield欠落をメモリ上の変異で検出。deliveryPending=trueも含める |
| 実Host fresh再入場が同本文再出版を検出できない | driver Caseの二回目だけexact state／history／pending／markerへの書込み系操作をspyしfinallyで復元 | 実呼出し0と全文不変を確認し、同本文writeの変異も検出 |

旧候補の全17回帰は終端まで固定して観測し、是正後結果と区別する。是正後に静的確認、関連試験、実Host driverと全17回帰、両独立再確認を行う。この是正は今回の固定組立て内だけであり、CLI／Workbench返却・操作整理、旧入口撤去とPackage全体完成は引き続き未成立。

是正の現在結果: 旧候補17件は17/17・失敗／取消／skip0・exit0（418321.8128ms）。SourceのProxy拒否、観測済み解放不明の独立理由、履歴／配送保存事実の保持を是正し、VMは33形のexact呼出し列と全結果fieldへ拡張した。実Host spyでは同本文writeの内部open／writeも観測するため期待値を補正し、追加確認でHost marker監視漏れを補完した。Host pathは初回前のexact操作から固定し、synthetic markerのwrite→unlink正対照後だけfresh Driverを計測する。途中のSchema期待値誤り（operationIdはidentityJson内）も修正した。最終局所driver1/1・exit0（28538.831ms）、関連21/21・exit0（1124.6337ms）、Source strict・対象format／lint成功。両独立最終再確認は全重大度残指摘0・限定Pass。最終固定4Fileの全17回帰は別実行中であり、旧spy版回帰を最終版の根拠へ流用しない。今回の失敗試験Root2件は由来・未要求資源・非使用・Host不存在を確認して清掃した。実Docker／Provider要求・再起動なし。

先行設計時点の記録: 次の一時返却・終了整理に向けた保存marker単独清掃は、契約・品質の読取り専用着手前照合を完了した。verified Rootと既存Kernel排他からRepo結合markerだけを一回回収し、Task／受領／Docker完了を返さない。通常Readerと既存Task Writerを緩めず、新Schema／Map／Lockを作らない。current初回出版前、pending、不正／未知／実体差は対象外。正本とQAへ前後観測・既知削除事実の保持・解放不明停止を反映したが、Sourceと試験はまだ未着手である。

技術回収組立ての最終Gate: Host marker／rootの監視を含む固定最終候補は、全17件が17/17・失敗／取消／skip0・exit0（422253.8943ms）で完走した。対象4FileのHash不変と自己生成試験Root残存0を確認し、両独立最終再確認の残指摘0と合わせ技術回収組立てに限って確認完了とする。旧spy版17件（442630.1967ms）は履歴値として区別する。通常入口、用途別返却・操作整理、旧回復／署名経路撤去、全体E2E・Package完成は残る。

保存marker単独清掃の実装候補: 既存`settlement-store.ts`へRootだけを受ける`cleanupRuntimeOwnedCoordinatorStateMarker`を追加した。三観測と処置直前のRoot／領域・全本文・実体の再照合、既存Kernel排他、exact marker unlink一回、後観測と解放を分離する。unlink後例外でも明示不存在を観測できた削除事実は保持し、保存全体確認やTask完了にしない。32形の固定primitive反証と、実Repository／Kernelの不存在・正常・foreign・pending・使用中・hardlink・unlink後例外・fresh再入場は2/2・失敗／取消／skip0・exit0（1668.1797ms）。Source strict・対象format／lint・両traceability確認成功、全試験型は従前の旧18件のみ。Symbol／Test Catalog／Host試験入口へ接続した。独立確認はこれから実施し、通常CLI／Task Writerへはまだ接続していない。Docker要求・Provider依頼・再起動なし。

保存marker限定清掃の局所Gate確定: Source／試験の独立指摘は0、品質確認で検出した現在文書の着手前表現2箇所を同期し、両独立最終再確認は全重大度残指摘0・限定Pass。Source／試験Hash不変、差分空白検査0、自己生成Root残存0を確認した。関連3Fileのportable再回帰も22/22・失敗／取消／skip0・exit0（1384.1816ms）。この完了は保存marker限定清掃だけであり、通常CLI、用途別結果返却・終了整理、Task／ACK／Docker資源回復全体、QA-000006全体またはPackage完成へ拡張しない。現在は後続の用途別返却接続の着手前照合中である。

中断後transient終了の原則再照合: 先行検討した『CLI出力callback／Workbench応答finish後だけ操作整理』『fresh再handoff』は実装していない。契約・品質の読取り専用反証により、これは一時回答を表示Recoveryへ過剰強化し、採用済みの『Producer cleanupは表示・任意保存に依存しない』『Process終了後の一時回答再取得は非保証』へ反すると確認した。現在回復ではgenuine技術Ownerの五資源・Host・Lease／旧Effect終端、必要Candidate・一次失敗・終了要約／履歴の保全後、CLI／Workbenchの対象pending配送0という既存Completion条件で操作を除去する。診断はその後に返し、I/O失敗でTask回復状態を復元しない。Orchestratorの耐久ACKと通常live応答経路は不変。追加の人間判断は不要と両専門確認で評価した。

この経路変更は承認済み簡素化への是正であり、正本はCoordinator詳細・QA6、利用側は現在回復Owner・既存State Reader／Writer・通常CLIと既存Workbench／Orchestrator Consumerである。着手前整合確認は契約・品質の2観点で実施済み。実装候補には既存settlementsの現在終了専用variantと既存Completionモデル／Writerを使い、現在元版・固定consumer・必要履歴・pending候補の有限形を再照合する。新Map、Lock、Schema、Receipt、再表示Framework、Workbench回復endpointは作らない。一般規範・準拠基準は変更せず準拠監査は非該当。現在方式のSource・試験・直接文書伝播と固定候補の独立レビューを必須とし、通常CLI本番切替・旧経路撤去・全体回帰・必要な実境界E2Eは後続で閉じる。現在は設計是正までで、中断後transient終了Sourceは未接続である。

中断後transient終了のSource候補: 現在終了Readerと既存`settlements`の`current_completion`を共用Writerへ接続し、genuine回収準備からの一回APIを追加した。CLI／Workbenchの固定consumerだけを受け、Orchestratorは拒否する。current＋exact終了pendingのfresh再入場は技術終端・履歴を再保存せず、同じ終了候補だけを出版する。除去後markerは限定清掃で扱い、表示受付・元Task成功を復元しない。通常CLIはまだ旧入口であり、新しい公開Recovery endpointは作っていない。

初回局所確認では、実Host4ケースの処理・清掃は通過したが親試験が履歴行外側にrecoveryIdがあると誤認して4件失敗した。`summary.recoveryId`への期待値是正後、CLI／Workbench・終了pending・除去後markerの4/4・失敗／取消／skip0・exit0（101835.3448ms）が成功した。Owner模擬試験は保存済み＋Lock解放不明の相関結果を検出し、上位statusをblockedへ確定する実装を是正した。Owner17形を含む関連23件は23/23・exit0（1314.6413ms）。Source strict・対象format／lint・両traceability確認成功、全試験型は従前の旧18件のみ。foreign／同current pending拒否とdurable降格拒否の実Host追加2件は実行中。固定候補の独立確認と全21物理回帰、通常CLI切替、旧経路撤去、全体E2E・Package完成は未完了。今回の試験Root残存0、Docker要求・Provider依頼・再起動なし。

追加反証2件の終端: foreign／同current pendingを保持した拒否、Orchestratorのtransient終了拒否と実状態不変を含む2/2・失敗／取消／skip0・exit0（53990.115ms）成功。固定Source／試験5Fileの全21回帰と契約・品質の独立確認を開始した。固定候補中は対象Source／試験を変更せず、全結果の統合前に是正を開始しない。通常CLIの旧Root／署名回復経路はまだ切替前である。

通常CLI接続の着手前照合: 契約・品質の両観点を統合し、flagなし通常回復だけを現在Rootの組立てへ切り替える。CLIは取消binding・Root・単一呼出し・unbind・表示、回復Moduleは私有Ownerの固定consumer・技術共同条件・transient終了／durable保持と公開field投影を所有する。旧flags、限定unknown終了Class、通常live、Orchestrator ACKとSchema／Lockは変更しない。unbind不明を別CLI結果へ保持し、一次理由と既完了状態を変更しない。文書・Source・試験の直接伝播と独立レビューを必須とし、準拠基準変更や新Frameworkは対象外。通常入口からの拒否・正常・取消・I/O失敗、公開漏洩、旧flag非転送を反証する。実Docker再起動の保留は維持する。

通常CLI接続の固定候補: 既存回復Module内で技術Driver→私有準備Mapの固定consumer→用途別終了→公開field投影を接続し、CLIは現在cwdと取消・unbind・表示だけを所有する。binding拒否／開始前取消／Root拒否は組立て0、完了後取消・unbind不明・render／write例外は再実行／状態復元0。旧再起動後flagsは旧入口を維持し、新方式へ無視・転送しない。初回の実CLI3条件は2成功・Orchestrator親期待改訂数だけ1不足で失敗した。登録保存1回分を期待値へ加え、未受領行も確認した先行修正版は3/3・exit0（79319.7216ms）。自己生成Root残存0、Source3Hash不変。旧候補の局所＋CLI33/33（12398.3842ms）と区別する。

同候補の独立結果を統合し、継承contract getter非実行、blocked相関、文書／直接Trace同期の3点を是正した。own descriptor値だけで全分岐を選び、blockedも除去未確認・Task未完了・保持不明または保持の閉集合とし、成功専用理由の流用を拒否する。getter0、statusだけ変更、完了field単独変異、成功理由差替えを反証した。修正版の33/33・失敗／取消／skip0・exit0（12372.0275ms）、Source strictが成功。修正版の通常CLI3条件を含む実Host全24条件は24/24・失敗／取消／skip0・exit0（586514.5487ms）で終了し、自己生成Root残存0を確認した。契約／品質の限定独立再確認は残指摘0。これはCLI／Workbenchの技術回収と表示前終了、Orchestratorの未受領保持までの限定成立であり、上位耐久ACK、旧経路撤去、限定unknown Class、実Docker・全体E2E・Package完成は未完了。

次のOrchestrator接続候補では、固定Rootから現在回復・相関解決の用途限定公開APIへ接続し、同じ必須AbortSignalでDocker回復をawaitする。既存の上位settled保存→ACK耐久保存→下位終了を維持し、待機前後とACK各段の状態／Queue／取消を再確認する。関連既存18件と相関・共同条件の局所2件、実保存を使う非同期正常経路1件（40866.1221ms）は成功した。待機中の取消・拒否・状態世代変更の追加反証も成功したが、Queue変更を含む固定回帰と独立レビューは進行中であり、新候補の完成扱いにはしない。新しいState、Lock、OwnerまたはACK Frameworkは追加していない。

同候補の固定回帰は44/44・失敗／取消／skip0・exit0（174564.6193ms）。独立指摘を統合し、試験の型API2箇所・Root Header・直接QA Traceを是正した。ACK前二段は既存通知後の取消を実保存で試験し、settled保持／ACK0と耐久ACK保持／finalize0、両方のTask再試行0・exact回復ID保持を確認した（非同期6条件＋親の7/7・exit0、54365.5459ms）。ガード無効化は本番block抽出と配置照合に限定し、両負対照をOracleが拒否した。局所3/3・exit0、全試験型は新規エラー0・既知旧18件のみ。修正版全4File回帰と独立再確認は未終端で、旧候補44件を新版の完了根拠へ流用しない。

修正版全4File回帰は47/47・失敗／取消／skip0・exit0（195365.6636ms）で終了した。契約／品質再確認で型・Trace・Root Header・ACK二段Oracleは解消。残る試験Headerの3fieldだけを実際の停止段階へ同期した（処理・assertion・IDは変更なし）。この結果は現在Rootの相関・非同期待機・既存ACKへの上位接続に限定し、旧回復経路・署名依存撤去、限定unknown終了Class、実Docker・全体E2E・Package完成は未完了のままとする。

Header是正後の契約／品質の限定最終再確認は、いずれも全重大度残指摘0・限定Pass。自己生成intake Root残存0、Source型・対象Lint／整形・diff確認は成功。全試験型は旧回復契約18件だけを保持する。次は旧回復入口・署名依存・Desktop修復の置換と未完了条件の閉鎖へ戻る。実Docker再起動の保留と、完成後だけCommit／Pushする条件は維持する。

Desktop修復の次の技術移管は、契約／品質の着手前照合により読取り二責務を先行する。Directoryロックの型・前後照合・固定FS接続をDI `desktop/runtime-directory.ts`へ、起動待機と180秒／1秒の定数を既存DI `desktop/engine-state.ts`へ移した。Rootは本番固定入口だけ、依存・時計・sleep差替えは内部試験のみ。WSL停止は単独Effect APIを新設せず、修復Machine全体の後続移管までprivateのまま維持する。記録・履歴・署名準備はまだ上位に残る。新State／Lock／Frameworkは追加しない。

読取り移管の是正前記録：移管前の修復基準は64件中61成功・3失敗（3172.4758ms）。失敗は実Store履歴採用の`historical_provenance_invalid`、同Case未到達によるTrace、署名版更新fixtureのnullであり、移管後も同じ3件を保持した。既存待機／ロック2Caseの全OracleをDI直接試験へ移し、公開Rootの固定FS接続・非公開seam・未知エラー／close故障・取消後観測0を追加した初回候補では、DI関連7件と型・対象Lintが成功した。新Directory SourceとDI Rootの固定graph確認も成功したが、独立レビュー・全DI回帰・上位Root接続の確認は当時未完了だった。是正後の現在結果は次段落とする。既存engine-state／上位repairのProcess定義と配布全閉包検査の不整合は引き続き未解消であり、局所成功を修復全体・旧署名撤去・実Docker・Package完成へ拡張しない。

読取り移管の独立指摘は、非Windows判別、返却専用startup_timeoutの観測入力混入、close失敗の既知open拒否誤分類の三点へ統合した。上位でOS分岐を増やさず下位でFS0拒否し、観測入力は4状態・待機結果は5状態へ区別した。close失敗は固定未確認へ変換してnullとし、再close・新Stateを追加しない。既知open3コード正例とclose4コード全例の各処置件数、非WindowsのFS／内部観測0、型の除外を反証し、局所8件成功。上位修復は62件中59成功・同じ旧3失敗（5302.8934ms）。Source型・対象Lint成功、修正版DI全195/195・失敗／取消／skip0・exit0（22621.7366ms）が成功した。品質の限定最終再確認は全重大度残指摘0。契約確認はSource／試験の残指摘0、実行中表記の同期だけを最終再確認する。既知上位3失敗・配布Guard不整合・修復全体・実境界は未完了のまま維持する。

読取り二責務の限定Gate：是正前／現在結果の文書表示も同期し、契約・品質の最終独立確認はいずれも全重大度残指摘0・限定Pass。これで上位に置いていたロック観測と起動待機の技術処理をDIへ移す単位は完了した。WSL停止・修復Machine全体、現在記録への置換・署名依存撤去、旧試験型18件と配布Guard、実Docker・全体E2Eは引き続き未完了である。

同候補の独立確認結果: 契約と品質の全結果を統合し、Reader排他解放不明を終了wrapperが共通拒否の`lockReleased: true`で消すMajor1と、技術Driver単独の操作保持／後段終了の範囲および内部候補の本番未接続表示に関する文書2点を是正対象とした。両確認者は一括修正方針へ整合回答済み。Reader取得後の拒否は理由・排他解放事実を保持し、下位Writer未発行と上位cleanupUnknownへの伝播を一連の反証で確認する。Reader前の拒否・例外から解放不明を捏造しない。通常live、durable ACK、Schema、Lockと既存履歴は変更しない。21件の実行候補は終端まで固定し、修正版の根拠へ流用しない。

transient終了候補の是正後限定Gate: 上記旧候補21件は21/21・失敗／取消／skip0・exit0（505475.6344ms）で終了した。初回是正後の全21再実行26624は追加Moderate1（正常Reader後のOwner不一致にも成功理由を透過）を検出したため意図的に中止し、完走・新版の根拠として扱わない。Reader自身の失敗・解放不明だけを透過し、後段の意味拒否を固定理由へ分離した。Reader blocked／解放不明／例外／正常後Owner失効／候補欠落の5反証を同じ本番wrapper→上位で接続し、Writer0・cleanupUnknown・理由・一回性を確認した。最終修正版の局所19/19（588.4745ms）、実Host終了4条件＋marker清掃1条件の5/5（105727.9428ms）、Source strict・対象format／lintが成功し、両独立最終確認は全重大度残指摘0。対象Source／試験Hash不変を確認。中止試験Root1件は実要求全未発行・全固有排他取得／解放・追跡File0・reparse0を確認して削除し、試験Root残存0。全21再回帰は通常入口切替後へ保持する。このGateは内部限定API候補に限り、通常CLI・上位ACK・旧経路撤去・全体E2E・Package完成・Commit／Pushは未完了である。

履歴出版の値契約: 既存modelへ`prepareCoordinatorRecoveredHistoryPublication`を追加し、固定occurredAt／行Hash・canonical履歴・pending全文・現在保持設定から履歴とconfirmed Snapshotの候補を再導出する。同じ行は再追加せず、異内容・重複・余分／欠測pending・設定差による全文不一致を拒否する。保持判定時刻は固定occurredAtへ結合し、別の現時点整理をこの終了処理へ混ぜない。初回候補の独立品質確認で入力Bufferのequals差替えによる偽一致1件を検出し、全結果統合・両観点の是正方針照合後、新関数内だけをProxy拒否・intrinsic view取得・所有copy後の比較へ是正した。8 hostile Buffer、偽true pending、Proxy・上限超過・元bytes／descriptor不変を追加し、修正版の関連2File 18試験が成功・失敗／取消／skip0・exit0（966.3468ms）。Source strict・対象format／lint・runtime traceは成功、修正版の両独立再確認は全重大度残指摘0・限定Pass。新helper Framework、Map、Lock、Schema、旧Owner復元は追加しない。この関数はまだ物理Writerへ未接続であり、実出版・保存途中のfresh再入場・用途別配送・CLI・全体完成を主張しない。次は既存settlements／物理Reader／Writerの現在終端専用経路へ接続し、保存途中A〜EとConsumer境界を実I/Oで閉じる。

終了保存の限定レビュー是正: 初回固定候補の契約／品質レビューでMajor各1（解放後Host不存在の再観測欠測、再起動confirmed＋結果nullの通過）を検出し、全結果統合・両観点の是正方針照合後に修正した。既存観測の各Writer確認への接続と、再起動の終了組合せを明示するだけに限定し、新Lock／状態は追加していない。Host初回・Writer直前のpresent／unknown／例外、再起動48組合せと結果null拒否無効化の反証を含む模擬14件は成功・失敗／skip0・exit0（484.9733ms）。実Root再出現の拒否とfresh Owner再入場を既存Host試験へ追加し、修正版全5件は5/5・失敗／取消／skip0・exit0（87637.0495ms）。Source strict、対象format／lint、runtime trace、差分空白検査は成功し、自己生成Root残存0。修正版の契約／品質最終限定再確認は全重大度残指摘0。試験全体型は既知の旧API18件が残る。履歴・用途別配送・通常CLI、実Docker／Provider／unknown Class・全体E2Eは未成立であり、終了保存の限定PassをPackage完成へ拡張しない。下記は先行候補の結果であり、全体未完了・Commit／Push未実施を維持する。

現在回収の終了保存候補: 既存準備Mapに解放試行・全解放確認・終端試行を追加し、全逆順解放後だけ同じexact操作・元本文の終了Writerへ一回接続した。五資源既知終了、Host清掃確認・遷移解消・旧Effect無効を要求する。既存結果と一次失敗は保持し、結果欠測だけ既存failed_closedのblockedへ固定する。新Schema／Map／Lock・旧Journal Readerは追加しない。模擬本文の14試験が成功し、実Host／Kernel／Writerの正常・結果欠測2件も再実行成功。先行全5件のうち同2件は、追加終了保存による改訂増分の試験期待値不足で失敗し是正した。修正版の全5件回帰と限定独立レビューは進行中。Source strict成功、全試験型は従前の旧API18件が未成立。履歴・配送・通常CLIの接続と全体E2Eは未完成であり、この終了保存をTask回復全体完成としない。Docker／Provider要求・再起動は発行せず、Commit／Pushは未実施。

Host終端記録の通常署名撤去候補: `terminal-windows-adapter.ts`の二実行OwnerをGit Native出所・実体の前後照合へ切替え、開発borrow／fresh再借用、取消、同参照、Native frame・終了code相関と保存Effect三値を維持した。export済みModule入口8件とcaller-checkpointの準備／保存／読戻し各階層から署名専用時刻引数を無互換で撤去した。二回観測は各成功時の不変なPackage内部出所情報を比較し、改訂完全tuple・Artifact全field・通常／開発区分の差を共同拒否する。非Authority metadataはframe／保存本文／最終candidateへ拡散しない。既存UTの全対象差・取消・部分結果にcross-call差と比較無効化を追加。既存AIT-IT-002へ二クラスsave／read／observeの前後故障と4種類の比較無効化を接続した。追加試験がprobe子にも登録される出力混入を局所2試験で再現・是正した後、同3Fileの154件が成功・失敗／skip0・exit0（22471.244ms）。Windows caller保存は制限環境で6件停止し、用途限定の自己生成Root実行で引数旧位置の1件を是正後8/8・失敗／skip0・exit0（3872.5573ms）。固定検査は二実行body／8関数flow・proof・旧Manifest tupleを限定更新し、Host閉グラフ1試験も成功（504.8135ms）。Source strict・対象Biome check成功、試験型は旧回復API18件のみ。独立レビューでは最終candidateの3つのspread分岐への内部metadata混入（Moderate1）と、現在Architectureの旧署名句（Minor1）を検出。両監査結果を統合し、3分岐を明示field投影へ是正、全分岐でmetadata3key不存在をassertし、spread復元変異で混入を直接検出した。TargetのModule exportをPackage公開と取り違えた品質指摘は、root exports・src/index・製品Consumerの実照合により撤回。中継wrapperは追加せず、Package内部成功観測と外部公開を区別した。Package公開集合の静的反例も既存UTへ追加。是正後の同4Fileは162/162・失敗／取消／skip0・exit0（25339.6967ms）。固定Source／試験Hash不変を確認し、契約・品質の最終限定再確認はいずれも全重大度残指摘0・Pass。旧配布全Fileの失敗、旧回復API18型、実Native／ACL／Docker／Provider／認証・再起動・全体E2Eは別の未成立条件として維持する。実Native／Docker／Provider要求・認証・再起動なし。現在の直接Manifest参照はrepair／recovery-lifecycleの2File。全体未完了、Commit／Push未実施。

共有回復領域の通常署名撤去候補: `initializeHostRecoveryNamespaceWindows`の必須Manifest照合を、固定Git改訂の単一Native照合へ置換した。着手前の実装契約／品質確認を統合し、初期baselineと一つの長期tokenを維持して各spawn前後を再照合する。正常時は出所5・直接実体3・token開始1／確認4・要求2。各発生点の欠測・例外・改訂完全tuple差・Artifact差・token失効で発行回数、親観測、終了確認とFilesystem Effectのfalse／nullを保持する。既存frame／部分receipt／本番作成順序の3試験は成功・skip0・exit0（263.7429ms）。pre2／postの改訂・token確認を個別に外す4変異は、各専用反例で誤成功になることを検出した。Source strictと対象Lintは成功。先行する配布検査試験のtuple推論2エラーも`as const`で是正し、全試験型の残りは旧回復API18件。両独立レビューの同一Minor1（型・decoder・試験Headerの旧署名5句）を統合是正し、処理本文Hash不変を確認した。修正版IT3/3・exit0（335.3741ms）、対象5FileのBiome checkとSource strictも成功。両観点のHeader再確認は全重大度残指摘0・限定Pass。追加の配布Filesystem全File回帰はexit1で終端し、旧署名集合・移管済みSourceの静的定義不一致等の失敗を確認した。完全stdoutは通常試験出力として保存せず、同Fileの実行で再生成する。これを局所成功で上書きしない。変更入口に絞ったHost Native閉グラフ1試験は成功・exit0（472.9988ms）。生成されたcrdd-development-package-*の残存0を確認。Native本体、保存先、回復ID、権限、再起動は変更せず、新State／Framework／実Docker／Provider要求はない。同処置時点の旧Manifest直接利用はterminal-windows-adapter、repair、recovery-lifecycleの3File。全体完成・Commit／Pushは未成立。

保護Root／Provider Homeの接続候補: 両Windows Adapterの旧固定Manifest呼出しを単一Native出所照合へ置換した。補助Process前後のArtifactとRepository改訂版tupleを比較し、開発Contextは既存borrow／終了後のfresh再借用を維持する。旧署名結果2field・signed_release表示を撤去し、Provider Home契約を改訂6へ同期した。署名専用時刻引数は両公開Adapter、Home facade、Task・助言・Store・Consent・Repair／Recovery・Orchestratorの全Source利用側から除去し、Task内部の呼出し位置と129個の試験用開始入力も更新した。固定静的検査は当該2Sourceのbodyと旧Manifest呼出し要求だけを追従し、出所／改訂版／token／開発参照の一箇所変異を拒否する局所試験1件が成功。通常経路30caseを既存結合試験へ追加し、開発経路・Task・助言・Protocol・Orchestrator facadeを含む6Fileの313件が成功・skip0・exit0（22916.8196ms）。実子Process／Host／取消の8件も成功・skip0・exit0（1873.2799ms）、Native環境不成立のEffect0試験1件も成功。Source strictは成功、試験型は従前の旧回復API18件のみ不成立。新しい実Docker／Provider要求・認証操作は行っていない。独立契約のdescriptor Minor1と品質のpost Artifact／終了相関Moderate1を統合是正し、descriptorを凍結した通常／開発の二経路objectへ同期した。通常post Artifactだけの差を6targetへ追加し、補助子正常終了後の停止結果ではHomeも終了確認trueを保持する。post Artifact比較だけを一時無効化すると6targetすべてが失敗し、Source2FileのHash完全復元後は静的検査とSource strictが成功。修正版の同じ6Fileは319/319・失敗／skip0・exit0（23213.8815ms）、固定検査変異1件も成功した。通常回復トレース検査もaccepted。修正後の両独立再確認は全重大度の残指摘0・限定Pass。実Native境界と全体検証は未完了。Source全数照合では旧Manifest直接参照は同処置時点で4File（terminal-windows-adapter、recovery-namespace-windows-adapter、repair、recovery-lifecycle）に残る。下記の読取り関数単体の記録はこの接続前時点を示す。

読取り関数単体の先行記録（Adapter接続前）。下位6Fileのうち保護Root／Provider Homeの署名依存を撤去する前提として、既存`platform-access/release-identity.ts`へ非Authorityの読取り関数を追加した。両観点の着手前確認と統合に従い、nearest検証Root、採用先prefix、現在Revisionの完全tuple、固定Blobのmode100644・size・SHA-256、Platform Accessの同handle観測と終了前のRoot／Revision再確認を接続する。新State／Lock／実行資格は作らず、署名・Publisher・全Checkout一致を主張しない。既存AIT-IT-002の同じ試験File／Symbolへ接続し、Host試験入口にも追加した。Source strictと対象整形・Lintは成功、全試験型は従前の回復API18件のみ不成立。局所試験はRoot直下／01_CRDD、文書差分、Native不一致・欠落、mode差、Git欠落、不正HEAD／Root／入れ子Git、読取り例外、観測途中のHEAD／Native差替えを確認した。実junctionは制限環境でEPERMを検出し、自己生成Repository内Rootだけに限定したWindows実行では3/3成功・skip0・exit0（修正版1408.0377ms）。実CheckoutのNative376320 bytesも基準Commit `715d79053d654ac56914d5087126d4170501c4e8`のBlobと一致した。実行物は起動せず、Docker／Provider／認証情報は使用していない。File全体の初回回帰は12件中11成功・1失敗で、旧署名集合の静的照合が`runtime_signing_files_unobservable`となる既存未完了境界を確認した。修正版の全File最終回帰は13件中12成功・同じ1失敗・exit1（7460.335ms）であり、これを局所成功で上書きしない。独立確認の2指摘は試験Oracleに限定され、追跡済みREADME Blobとworktree差分の直接照合、および初回Native観測後のexact Blob open時差替えで補強した。最後のtoken検証だけを一時無効化すると両prefixのlate-swap Oracleが失敗し、Source完全復元Hash一致と静的確認・3試験成功を再確認した。両観点の修正後独立確認では試験Oracleの是正を確認し、残るfixture責務Header1行も実体へ同期した。文書・Headerの最終再確認も両観点とも全重大度の残指摘0・限定Pass。この読取り関数単体の固定候補時点では両Adapterへの接続・旧署名時刻引数／結果語彙・全Consumer・exact静的graphの一括追従が未完了であり、旧Manifest直接参照は6Fileだった。接続後の現在状態は直前の接続候補記録で区別する。

下位署名照合の撤去計画（Local Personal処置時点の記録）: 最初に`authority/local-personal-grant.ts`の署名依存を外し、唯一の本番Consumerが既存で搬送するmanagementの実Operation照合へ統一する。着手前の実装契約／品質確認を統合し、時計確認→毎回一回のstrict true確認→cache／生成の順、実Operation一致を先に確認したうえで開発Contextが存在するときだけ作業可能確認を要求する。引数必須化はConsumer型へ伝播し、契約改訂2で署名非必須を明示する。既存Profile／Provider／Operation形状、30秒TTL、bundle／Grant／Home／Egressと送信許可は変更しない。UTは既存Local Itemを維持し、実管理参照の反証は既存Task Runtime ITへ接続する。新State／Lock／Grant／Hash資格・Framework、実Docker／Provider依頼なし。型・関連UT／IT・本文／Symbol／Catalog照合と固定候補の独立レビューを行い、旧巨大静的Verifierは未同期を明記して後続一体撤去する。追加の人間判断は不要。実装候補では署名import／Release確認と開発・通常の二重資格分岐を撤去し、既存Operation確認をcache前のstrict true一回へ統一した。Consumerの管理引数と公開改訂2を同期。既存UTは全6 Profile・不正参照・期限内失効・時計・TTL・非boolean／例外へ刷新し、本番組立ての同じ確認本文でOperation先行と開発Contextのtrue／false／不正／例外を反証した。Consumerの発行・消費試験は同じmanagement搬送をassertする。実管理参照の通常／偽造／別Operation／清掃後cache拒否は既存Task Runtime ITへ接続しSymbolを追従した。関連24件と用途限定Windows Task Runtime165件（996.4425ms）は成功・exit0、Source strict／対象整形・Lintは成功、試験型は既知旧Recovery18件のみ不成立。Provider Authorityの6Source／9Test coverageは連続2実行一致、集計418/461分岐、変更Source33/38分岐・7/9関数であり、5未到達はNot Verifiedを維持する。未到達はcanonical JSONのundefined防御と固定生成値のProfile／Registry／Policy／Bundle不成立で、現在の反証・再確認条件を測定器へ同期した。再生成は`node 40_Develop/coordinator/scripts/check-provider-authority-coverage.ts`、payload SHA256は`9f9917cef7c997721dcc64459988afc0bfbfe77bb946f8fffa04b89ab3cba3a1`。本番確認本文の局所反証は実開発SessionやNative搬送の根拠にしない。固定候補の実装契約／品質の独立確認ではSource・試験の必須指摘0。計画の残件数に関する品質指摘1件を是正し、修正後の両独立再確認は全重大度の残指摘0・限定Pass。旧静的Verifier・他6File・旧資格APIと全体E2Eは未完了、Commit／Push未実施。

通常署名Gateの利用側撤去を継続中。Taskの公開開始引数と試行入力から署名資格を外し、CLI・Workbench候補・Orchestratorを同じ通常Task入口へ接続した。Orchestratorの署名専用Port／Adapter・発行失敗・未使用資格の失効不明から合成する回復分岐は削除し、実処理の回収不明に対するProcess停止と回復Identityは維持した。開始準備の保存後、委譲前の取消は実保存状態から発火させる試験へ置換した。通常Task公開契約は改訂36。局所3件、契約／停止条件3件、CLI／公開Owner18件が成功し、Coordinator Source strict・Orchestrator型・Workbench型・対象Lint・差分検査は成功。試験型確認は旧回復API18件のみ不成立。削除Source／試験のSymbol・Catalog・現行対応表とChecker公開集合を追従した。広い関連4試験Fileは86/86成功・失敗／取消／skip 0・exit0（496,363.8757ms）。その実行中に更新した公開契約・停止条件3件とCLI／公開Owner18件も別途成功。公開index母集団のPA追加とDIの移管済み技術APIを照合し、固定公開一覧試験1件が成功した。独立確認の指摘を統合し、Orchestrator入力契約を改訂3、委譲前取消理由を`before_delegation`へ訂正した。既存実行Eventで理由とEffect0、実保存の取消・回復0・委譲0を確認し、新しい保存欄は追加しない。現在Architecture／QA／AUTH-TASK投影を一括同期し、明示履歴比較は維持した。追加回帰は172件中169件成功・3失敗（junction EPERM、旧OS tmp Host記録rename EPERM、それに伴うTrace未到達）だった。既存fixtureを検証済みRepository `.crdd/tests`へ限定し生成直後hookとHost明示親を接続、意図的junction生成失敗後も残存0を確認した。修正版のTask Runtime全164件は用途限定Windows実行で164/164・exit0（975.0714ms）、実Docker／Provider要求なし。型確認は旧回復API18件のみ、Source／Orchestrator型・対象Lint・差分確認は成功。任意署名ToolのTask呼出し試験も現在の2引数へ追従し、同ToolとOrchestrator公開契約は53/53・exit0（33,745.4016ms）。追加の現在要約とMarkdown実装Pathの追従漏れも、関連文書全体の現在句検索とJSON8Pathとのexact一致で是正した。固定修正版の実装契約／品質の限定最終独立再確認は全重大度の残指摘0・Pass。判定範囲は通常Consumerの旧Gate撤去と関連反証に限り、全体成功を主張しない。旧資格3 API・専用静的検査・任意署名Tool、通常入口とTask終端、全体回帰／E2E、実Docker再起動保留は残る。Commit／Pushは未実施。追加のSource全数照合時点では、旧固定Manifest検証の直接呼出しが通常Runtime内の7Fileに残っていた。先行処置で`authority/local-personal-grant.ts`を解消し、同処置時点で残る6Fileは次のとおり（`platform-access/protected-root-windows-adapter.ts`、`provider/home-windows-adapter.ts`、`host-execution/terminal-windows-adapter.ts`、`host-execution/recovery-namespace-windows-adapter.ts`、`docker-desktop/repair.ts`、`docker-execution/recovery-lifecycle.ts`）。通常Consumerの資格引数・発行・消費の撤去と、これら下位の旧署名照合撤去は区別し、後者は未完了とする。次の編集前に、各呼出しが得るNative実体／protocol／Hash／Rootの必要な保証と署名由来の条件を分離し、現在の実体観測へ接続する。検査全削除・常時true・新Hash資格へ置換せず、任意配布検証は独立させる。

通常署名Gate撤去の先行着手：採用済み三分離に従い、撤去対象の旧署名閉包へ移管先を再固定する作業より、通常Gateの一体撤去を先行する。最初の編集単位としてWorkbench助言のFactory issuer引数、consume依存、run第三引数と旧署名拒否理由を撤去し、本番LauncherをVerifiedRoot一引数へ接続した。無効Rootは依存構築前に停止し、同じ拒否Runtimeで取消優先も確認。Processの片付け中と回収不明による停止を旧署名拒否から分離した。助言16・入口接続3試験、Workbench静的3軸・Coordinator Source strict／対象Lint、契約・品質の限定最終再確認は成功・残指摘0。実入口8試験は制限環境のlocalhost EACCESを分離し、用途限定権限で同じ固定候補を再実行して8/8・exit0（10,937.6913ms）を確認した。Docker再起動・Provider依頼・実Credentialは使用していない。次はTask API・CLI・候補生成・Orchestratorの型と利用側を一体更新し、旧資格の発行・消費・失効と専用層を撤去する。任意配布の署名・真正性検査、歴史Evidence、現在の送信許可／Root・Revision／実行物確認・取消・回収は保持する。通常Gate全体、8Sourceの旧配布検査、旧API型18件、通常入口とTask終端・E2E・Package完成は未完了で、Commit／Pushは行っていない。

配布検査の現在進捗：旧DI内のtaskkill生成と削除済み自己呼出しを要求していた静的検査を、PAの固定生成OwnerとRoot経由のDI／既存試験scriptへ同期した。生成点は一対一で移し40件（Runtime24／検証Tool16）を維持する。PA限定のChildProcessは型注釈二件・instanceof一件だけを許し、type-only迂回を含む21変異を拒否する。局所2試験、PA静的3軸・6試験、上位Source strict／対象整形・Lintは成功。契約・品質の限定最終独立確認は残指摘0。配布全7件は5成功・2失敗で未完了、先頭停止はrecovery-executorへ移った。下位全Sourceの読取り照合で残る未同期はrecovery-executor、backend-state、engine-state、native-process-lifecycle、native-process、restart-machine、attached-process、authentication-command-runtimeの8File。実処理を旧構造へ戻さず、現在Ownerとの照合を順次是正する。実Docker再起動は保留のままで、通常入口・Task終端・旧API型18件・旧署名Gate撤去・全体検証も未完了。Commit／Pushは行っていない。

現在の限定移管結果：五用途の回収順・Network／Image／Mount／Init期待値を既存DI構成Ownerへ移し、CoordinatorはAI Adapter判断と現在資源の一意結合へ限定した。公開入力の直接取得を独立確認の指摘に従い固定11個のown data捕捉へ是正し、getter／Proxy／暗黙変換の実行0を試験した。DI静的3軸と191件、上位接続34件、上位Source strict／対象Lintが成功し、契約・品質の限定最終再確認は全重大度残指摘0。配布境界は4/6で、`owned-windows-process.ts`に対する既存`platform_provisioner_runtime_dependency_child_process_unbound`の2失敗を別残件として保持する。実Docker再起動は人間判断で保留し、Docker／Provider実要求・認証使用・永続データ削除は行っていない。Task全体・Package完成・Commit／Pushは未成立。

順番1の限定候補は実装・局所確認済みで、独立再確認待ち。Host Readerのexplicit Root搬送と現在stateからのCLI解決を接続した。実現在状態・既存Kernel排他・実CLIを用いるWindows試験は1/1成功（109265.5264ms）。単一Host／Probeのexact引数、Schema-validな二操作の重複拒否、別Repository・旧token・非Probeの処置0、非公開Rootの出力0を確認した。処置境界だけをspyへ置換しており、実Docker回収の根拠にはしない。Reader欠測・解放不明の実private本文故障注入1件も成功。Runnerは静的3軸・50成功／失敗0／人間UAT1未実施。全試験型の旧回復契約18件は残り、順番2〜5とPackage全体完成は未達。

独立確認の追加是正として、旧試験のHost回収5呼出し・埋込みHost Reader4呼出しへfixtureの既知Rootを全数同期した。互換fallbackは追加していない。実argvの欠落・余分・誤Owner・重複搬送を反証する試験を追加し、最終Runnerは静的3軸・51成功／失敗0／人間UAT1未実施、CLI15成功。Host Readerの広いSource変更は未許可Provider試験を含むため計画限定で、直接試験Path変更の実搬送と区別する。旧Recovery APIの18型不一致と旧統合Oracleの実行不能は、現在Owner・Writerへ移管する直接回帰の残件として保持し、Root引数同期だけで旧回帰成功や順番1全体Passを主張しない。

追加是正後の固定候補は実装契約／品質の限定独立再確認で全重大度の残指摘0。この確認はRoot搬送・現在Reader／CLI・台帳選択・直接試験Pathの模擬実dispatchに限る。旧統合suiteのロード不能と18型不一致はPackage完成Gateの未成立事項として維持し、次に順番2の現在Recovery Owner・既存Writer接続と合わせて最新方式へ刷新する。Docker／Providerの実要求、現在回収全体、Package完成、Commit／Pushはまだ成立していない。

順番2の現在Owner／途中Writerを接続し、実装契約・品質の限定独立再確認で残指摘0となった。既存準備Mapを判別付き集合へ更新し、Host世代、元本文、Home／Runtime排他と固定保存欄を共同照合する。是正後の実Windows現在状態試験は1/1成功（114494.5543ms）。resourceの処置前意図、cleanupとHostの不明、lifecycleの実変化を保存し、対象欄・全他操作・配送／回復集合・Schema／Repository結合・改訂／元版・実本文Hashを独立期待値で照合した。保持排他のfalse／例外と世代確認不能は清掃不明として保持し、後着成功で消さない。marker差だけを排他喪失へ読み替えない。取得null／例外は保存0・清掃未確認・成功取得分の全逆順解放を反証した。関連Host／故障注入113試験、Host記録のWindows2試験、Source strictと対象整形／Lint・差分検査は成功。Docker／Providerの実要求は0。これはmarker存続中の途中接続で、Host清掃後保存、DI回収、旧API18不整合、通常署名Gate撤去、全体E2Eは未完了。次は順番3の既存DI回収Executorへの現在状態接続へ進む。

旧`recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart`は署名検証、AppData一覧、五件の再起動chainとpending submissionを要求する。現在の単一checkpointだけではこの旧Readerへ到達できないため、旧経路を微修正して残さず、通常回復と記録後回復を同じ現在操作へ接続する。再起動成功だけをTask回復成功にしない。

順番3の資源接続を既存現在Owner内へ追加し、Source契約と品質の限定独立再確認は残指摘0となった。五用途の固定期待値、Container先行、Proxy接続前後の二構成、意図不明の保存と発見IDの削除前保存・読戻しを接続する。削除直前の同期Owner確認を既存DI optionsへ結合し、一度の確認失敗後は後着成功で後続処置を再開しない。既存absenceのfresh二軸確認と部分absent／unknownの保存・再入場を反証し、試験Symbolは上位2・下位3 Ownerへ接続した。局所23件、DI既存182件・静的3軸、上位Source strict／対象整形・Lintが成功。Runnerは静的3軸と通常50件、制限環境のLink EPERMを別にした専用権限1件が成功、人間UAT1件未実施。新testの計画実行はexact Path選択・Provider Effect 0。これらは模擬状態と実DI固定Process境界の確認であり、本番config、Host清掃後保存と全体E2Eは未成立。次は既存Host世代からの管理領域借用と、下位が所有する一意短命config・実入口の接続を進める。

本番用config接続では、genuine Host回復世代の同じtokenからstarted marker、Rootと記録済みmanagement実体を照合して借用し、生managementを復元しない。DI側で一意な短命子を作り、旧同接頭辞の残存を採用・削除せず96件まで数える。自作Identityのcloseだけを全経路で行い、清掃不明後は同OwnerのConfig生成／Docker要求／Writerを停止する。DI静的3軸と190試験、上位結合27試験、Host Windows3試験が成功し、Source契約／品質の限定独立確認は全重大度の残指摘0。全体の実Storage接続、実Docker、通常CLIとHost終端は未成立であり、次は順番4の限定unknown終了Classの既存保証を照合する。

| 順番 | 既存Owner内の変更 | 維持する反証・完成条件 |
|---|---|---|
| 1 | Host記録Readerへ同じ操作のexact Rootを明示搬送する。元management／mount／HostGenerationからRootを導出し、fresh入口は検証済みRepositoryの現在stateからtokenと一致する単一操作の`hostPaths.root`を選ぶ | tokenだけから親を推測しない。0件・複数・不正現在状態・別Root・link・置換はEffect 0。操作Root削除後も同じ親のmarkerを読めること。別親列挙・OS tmp fallback・新Registryなし |
| 2 | 現在Root・exact操作・既存Host世代／Home排他へ結合するfresh Recovery Ownerを、既存現在状態Writer内へ限定接続する | Root Readerや保存JSONだけで処置・書込みAuthorityを生成しない。元版・全対象・更新後の読戻しと解放を確認。任意Snapshot Writer・生management復元・新Lock Frameworkなし |
| 3 | DIの既存資源回収Executorへ、現在操作の五用途・実ID・Image／Network／Mount期待値を渡す。発見したIDは回収前に同じstateへ保存する | 名前／Label一致だけで削除しない。known ID／replacement／foreign／複数一致／inspect中消失／観測不能を反証。通常の空照会では過去create unknownを閉じない |
| 4 | 記録後回復のCodex認証Probe create不明だけ、同Task・要求・Scopeのconfirmedな再起動記録、旧Owner不能、Provider未開始・送信未発行・共有書込み未発行、遅延Create無害化と現在不存在を照合する。既存モデル内の限定absenceを追加する | 過去unknownをnot_issued／identifiedへ変更しない。Providerの安定名、別認証フロー、Generic unknownへ一般化しない。条件欠測では同じ回復参照を保持して停止。Engine readyを過去要求成功の根拠にしない |
| 5 | Docker不存在確定後だけ同世代Host token遷移・実領域清掃・現在state確定へ接続し、CLI／Orchestratorを最新入口へ移す | token更新の意図／元版／再観測を既存Host checkpointへ接続し、返却喪失・保存不明を保持。元一次失敗・Candidate／Evidenceを保全。Task再実行・durable Consumer ACKは別責務 |

Host配置について追加の不一致を確認した。`createOwnedOperationDirectories(temporaryParent)`は指定した親へmarkerを作れるが、`loadHostRecoveryRecordByToken`はOS tmpを固定で読む。一方、本番の保護されたcreatorは現在もOS tmpを使う。したがってReaderだけRepository tmpへ固定する案も不適切であり、上記1では現在state／元Ownerが保持するexact Rootを使う。保存先変更をこのReader修正の副作用にしない。現在stateに対応しない旧世代はフロントAIの移行対象で、Runtimeによる旧形式探索・採用は行わない。

順番4の着手前再照合では、停止根拠を既存DI再起動のNative CLI不存在・Desktop不存在・Engine停止・backend停止・前後Trustへ結合できることを確認した。Taskの`outcome.cleanupConfirmed=true`を前提にするとunknown資源の清掃確定前には到達できず循環するため、同Taskの再起動checkpointを用いる。旧Parentからの新要求はHost世代喪失・取消・Effect失効・各commandの現在性確認へ接続し、raceを反証する。過去unknownを保持したまま認証Probeだけの現在absenceを、清掃・履歴・配送・操作除去・次Attemptで同じ限定述語へ接続する。Daemon受理済みcreateの遅延反映はSource／Mockだけでは未閉包であり、空Home・Workspaceなし・Provider依頼0・試験Probe一件・再起動一回の実測を人間へ許可依頼したが、人間判断で再起動は保留となった。実施せず、Class採用・完成の根拠にしない。

順番4の準備として、現在状態の資源終了判定をprivate述語へ集約した。履歴・結果配送・操作除去・同Homeの次操作開始は、従来どおり未要求／確定未発行、または実ID確定かつ不存在の場合だけ進む。9状態×4入口×CLI／Workbenchを同じ入力から独立評価し、unknown／issued／intent_savedのabsenceは四入口と通常cleanup更新入口で拒否する。Model／再起動UT7件と関連回復結合27件、Source strict・対象整形／Lint・差分検査が成功。契約・品質の限定独立確認は全重大度残指摘0。新しいunknown終了Class・実Storage・旧Owner停止・実Docker再起動の成立には拡張しない。全試験型の旧API18不整合は再確認したが未解消である。

順番5のSource着手前確認では、既存Host APIを別Processから使う実Windows試験を追加した。Kernel排他だけを解放して旧Operation登録を保持した同Processでは真正な回復世代でも遷移拒否・marker全文不変となる。Sourceの拒否は緩めず、別Processで事前計算tokenと全marker本文の一致、旧token拒否、新token世代再取得、Root／marker清掃と全排他解放を確認した。実Windows4件、対象整形／Lint・差分確認は成功、契約・品質の限定最終再確認は残指摘0。初回の同Process拒否はSource失敗ではなく試験境界の不一致として訂正し、未注入の返却喪失をHeaderから除いた。実Docker不存在は合成前提であり、真正な返却喪失、現在Writerとの共同確定、本番入口接続と全体完成は未成立。次は同じHost pending欄へ遷移前意図を保存し、実markerがold／expectedのどちらかだけを認める4状態の接続へ進む。

順番5の再入場準備をSourceへ接続した。保存済みabsent遷移の旧marker／予定markerだけを完全本文で照合し、予定tokenを私有Ownerへ保持して取得後・Writer直前にも再確認する。別の正式pending二種はこの限定入口の取得前で停止し、別分岐の未完成義務として維持する。独立確認のMajor一件・Moderate一件とHeader同期Minor一件を是正し、契約／品質の限定最終確認は残指摘0。関連35試験、Source strict・対象整形／Lint・差分確認が成功。旧本文比較を除く一時変異はold側foreign反証が拒否し、Source復元後も35件成功。全試験型は既存旧API18件だけが残る。実Host遷移と現在Writerの共同確定、物理清掃、本番切替、通常署名Gate撤去・全体E2Eは未完了である。

順番5のHost遷移Driverと固定Writerを接続した。意図保存・全読戻し、処置直前の全元版、実Host更新、予定tokenとmarker全文確認、私有token更新、保存確定を順序化する。四状態、処置前後の例外、返却token差、保存拒否と元版差を反証し、同Ownerの追加処置0・fresh予定markerの再処置0、非null一次失敗・blocked結果と他操作の保持を確認した。追加反証で見つかった汎用Host保存の先行token更新Major一件は、捕捉payloadと実markerへ結合した私有tokenの一致要求で是正。契約／品質の限定最終再確認は残指摘0。関連37試験、Source strict・対象整形／Lint・差分確認が成功。既存の実Windows現在状態回帰も2/2成功（主要Case145578.2769ms）、自己生成Root残存0。追加の専用Windows試験では新Driver・実Host／Kernel排他・実Storageを別Processで接続し、新規遷移の意図／token確定二版を完全比較した。同Owner反復とfresh settled再入場・各解放後も物理公開は二回のままで、他操作と非null一次失敗・元結果を保持した。独立確認で見つかった反復Writer観測不足とCatalogの過大表示は是正し、限定最終再確認は残指摘0。是正後1/1成功（11641.7899ms）、自己生成Root残存0。Runner計画は同試験一件とWindows profileを選択し、Effectなし。pending旧／予定tokenの実Storage接続、競合CAS、Host物理清掃後の最終状態、本番切替、旧API18型不整合と全体E2Eは未完了。Docker／Provider実要求は0で、再起動保留を維持する。

Host清掃の現在接続を追加した。既存host.cleanupのpending保存・全読戻し後に同じ世代でRoot／markerを回収し、両不存在を再観測してから専用Writerでconfirmedを保存する。保存中の全元版・Host／Home／Runtime排他を維持し、一般checkpointのconfirmed拒否、一次失敗と元結果を保持する。既存準備MapとIdentity指定Host世代を再利用し、追加Map／Lock／台帳なし。関連40試験、実Windows5試験（清掃接続Case14178.7552ms）とSource strictが成功し、試験Rootは清掃済み。試験型は既存18件の旧API不整合が残る。出版途中接続と合わせた契約／品質の限定最終再確認は残指摘0。

追加Source照合で見つかった出版途中の再入場不足を、既存private Reader／Writerへ接続した。A（旧current＋lockのみ）、B（旧current＋lock＋exact候補pending）、C（confirmed current＋lockのみ）だけを認め、元本文・固定候補・受理形を既存準備Mapへ保持する。confirmed＋pendingは自然到達根拠がないため拒否する。通常Readerを緩めず、再確定中は汎用checkpoint・Host遷移・資源回収・config実行を拒否する。lock作成後、出版直前、出版直後へ実I/O故障を入れた後、別Processで同じ候補へ再確定し、短命材料の不存在と確定後の追加Writer 0を確認した。正常＋A／B／Cの実Windows4/4成功（63692.1765ms合計）、関連40試験成功。pending改変・lock改変・confirmed＋pendingの拒否と全本文・他操作・元結果の保持も照合した。契約／品質の限定最終再確認は全重大度の残指摘0であり、Task全体回復・本番切替・競合CAS・実Dockerへ成功を拡張しない。

先行Source調査では通常Owner・Host記録・DI回収・現在Writerと過去試験への対応を確認した。旧Journal／Reader／署名Gateを削除する前に、新入口でknown／unknown、親喪失、保存返却喪失、Host片側欠落、別Task不変とConsumer ACK分離を再検証する。実Docker再起動は人間判断で保留し、完成・Commit／Pushは未成立のまま維持する。

#### 順序9の抽出進捗 — 2026-10-14

2026-10-15の現在準備・DI本番呼出し候補：現在Repositoryのexact操作・全Scope・既存Host／Home／Runtime排他を同じ準備Mapへ結合し、CoordinatorはDI Rootへ現在確認・要求前保存・通知だけを渡す。旧phase／handoff・配布Root引数・署名資格は通常再起動から撤去した。独立確認で見つかった「外側排他解放前のcompleted保存」を是正し、終了通知ではpending／結果未確定、全逆順解放後に同じclosed Ownerの一回限定終端保存とした。解放false／throwはunknown／blocked、終端保存拒否はpending保持。短期Writer排他は再起動Scopeへ循環参入せず保存確認・lockReleasedを別評価する。有効な対象欠落、後段Host／Home／Runtime取得失敗と解放三条件、終端保存拒否、再試行0のOracleを追加した。Source strict・対象整形／Lint、準備10件・組立て13件・CLI14件の計37件は成功。準備のうち旧記録後回復一件は歴史的基準で、新経路完成の根拠へ含めない。DI静的三軸・通常182件も再実行し成功。改名後の実Windows現在状態試験も1/1成功（92,688ms）。これは既存Writerと管理Ownerの確認であり、fresh準備Map・Kernel排他との一体確認を代替しない。実準備Map・実Host／Home／Runtime排他・実Writerの一体試験を既存Windows Caseへ接続した。要求四段階のexact読戻し・改訂／前本文Hash・対象以外不変、解放前終端拒否、全解放後一回終端化、終端Hash相関、完了後再入場の要求済み保持と一時材料0を確認。技術完了入力は合成で、Native／Dockerの実処置根拠にはしない。独立確認の終端相関OracleとHeader境界のMinor二件を是正後、同試験は1/1成功（102,710ms）、自己生成Root残存0。固定候補の契約／品質限定再レビューは全重大度残指摘0。上位全試験型の既知旧契約18件、記録後Task回復、修復側、旧通常署名Gateの残余、全影響回帰と必要実境界は未完了。Docker再起動・外部AI依頼・秘密Store変更・Commit／Pushは行っていない。

上位保存接続候補の限定確認：Source strictと対象整形・Lintは成功。実Windowsの現在状態試験は、制限環境のHardlink権限不足とModule Mock起動設定不足を別に記録した後、権限・設定を満たす同じ試験で1/1成功（93,251ms）、自己生成Root残存0。ただしその後の独立確認で、fresh Readerの排他終了不明の透過漏れ、Writer境界の失効Oracle不足、Case Header未追従を検出した。固定理由と`lockReleased=false`を保持し、実Lock回収後のfalse／throw観測欠測、Writer入場後のOwner失効、正常時の複数回確認を既存Caseへ追加した。実OS解放失敗の再現とは扱わない。修正後の実Windows試験は1/1成功（93,613ms）、契約／品質の限定再レビューはともに全重大度の残指摘0。先行成功を新版へ流用していない。全試験型の既知旧契約18件、本番準備Map／DI Root接続とPackage完成は未解消である。

次の上位接続の着手前照合：旧再起動のAppData・署名・phase／handoff経路を現Repositoryの単一checkpointへ置換し、DI Rootへ接続する。契約／品質の読取り専用確認は着手可。既存`dockerRestartPreparations`と取得済みHost／Home／Runtime排他を唯一の処置Ownerとし、Root Readerや保存JSONだけからWriterを発行しない。保存Ownerの私有入口`writeRuntimeOwnedCoordinatorPreparedRestartCheckpoint`を追加し、対象exact操作・回復参照・元本文と現在Ownerを照合して既存Writerへ渡す候補を実装した。確認closureは保持中排他とRoot実体だけを同期確認し、Writer内で状態Lockを再取得しない。状態のfresh読取りと元版完全一致はこの保存入口が行う。別操作・失効・例外・古い元版の保存0を既存実Filesystem試験へ追加した。上位準備Mapへの実結合は未完了であり、この候補をfresh再起動全体の完成としない。既存管理Ownerの保存API、Schema、Rust、秘密値、実Docker、過去Evidenceは変更しない。新Map・Lock・Registry・互換Reader・Frameworkは作らない。

2026-10-15のDesktop候補の限定是正：契約／品質の独立確認で要求状態、公開入力捕捉、Symbol重複、実観測Consumer選択と一次失敗Oracleの5指摘を統合した。上位checkpointの耐久意図unknownと下位の実Native要求状態を分け、下位は実要求試行前だけunknownへ進み、helper取得失敗／取得中取消はnot_issuedを維持する。上位の保存済み意図は巻き戻さない。公開入力はProxy／Accessor／余分Fieldを取得前に固定拒否し一回捕捉する。重複Symbol一件を除去し、既存実観測試験を下位変更時の選択集合へ接続、三故障の一次／cleanup理由を明示assertした。PA静的三軸・6件、DI静的三軸・通常182件、新入口29件、Runnerの回帰選択1件と静的確認は成功。実観測の選択は実行許可ではなく、Docker再起動・Provider依頼は行っていない。修正後候補の契約／品質限定再確認はともに全重大度の残指摘0。本番Root接続、fresh Writer、修復固定入口、旧署名Gate撤去と全体完成は引き続き未成立。

2026-10-15のDesktop実体移管候補：Native補助ProcessとProtocol lifecycle、再起動MachineをDocker Isolationの`desktop/native-process.ts`、`native-process-lifecycle.ts`、`restart-machine.ts`へ実体移管した。コピー・旧Path shimは作らず、Machine34試験とNative技術29試験を同じOwnerへ移した。混在していた固定配布textのLF確認一件はCoordinatorへ分離し、実在するtext ArtifactへSymbol関係を結合した。新Root入口`restartDockerRuntime`は取得・停止・起動・取消・回収を一操作へ閉じ、上位入力は要求ID・取消・現在確認・発行前checkpoint・同期通知だけ。Nativeの実受付だけを一回通知し、終端観測と配送を分離、返却後通知を止める。参考起動時間は起動処理全体の単調時計差であり、OSサービス内部の実測とは区別する。Source strictと下位静的三軸・通常177試験が成功し、その後追加した取得待機中取消・終端配送失敗・初回拒否を含む新入口27試験も成功した。Owner／Catalog収集は実Path完全一致と三つの移管先Test ID存在で確認し、固定14件への依存を廃止した。生Session／MachineのRoot公開はないが、上位の旧修復・再起動Consumerはまだ下位private Sourceへ依存する途中版で、Root公開規則への適合・本番切替は未成立。旧配布Guard／固定Source反例のPath、現行stateのfresh Writer、修復側固定入口、通常署名Gate撤去と全体確認も未完了。部分移管を完成・Commit／Pushの区切りとしない。新State・Registry・Lock・互換Reader・Framework、Rust変更、Docker再起動・外部AI依頼は行っていない。

2026-10-15の再起動失敗分離：既存driverと準備・本番組立ての結果へ、固定理由またはnullの`primaryFailure`／`cleanupFailure`を接続した。最終reasonのcleanup優先は維持し、元の保存・境界・取消・handoff・準備失敗を別fieldへ保持する。未知の接頭辞付き例外を固定失敗へ分類し、生本文を公開しない。取得時cleanup不明、外側helper／排他解放のfalse・throw、正常後のcleanup失敗、Context再使用と開始前拒否を既存ERB-IT-014へ接続した。初回独立確認の準備時原因上書きMajor 1件と下位失敗後の外側成功Oracle不足Moderate 1件を統合是正。準備の一次分類を全排他解放前に固定し、逆順の全解放を試行する。現在のcleanupConfirmedと途中のcleanupFailureを分離し、後着成功で失敗履歴を消す一時変異は追加2Caseが固有断言で拒否、Source復元済み。Engine ready＋観測cleanup不明は一次成功であるため、レビュー側の誤ったstart失敗Oracleをnullへ訂正した。Source strict・対象六File整形／Lint、driver／準備／組立て／Machineの136試験は成功。全試験型は既知の旧回復契約18件が残る。追加品質指摘の解放識別Oracle不足Moderate 1件も是正し、三Lockを各一回・取得逆順で解放するexact列を確認した。取得順解放への一時変異は6Caseが固有Oracleで拒否し、Source復元後136試験成功。契約・品質の限定最終再レビューは残指摘0。Runnerは通常49成功・Windows Link作成権限不足1失敗・人間UAT1未実施で、同Link反例を専用Windows権限で1/1成功と確認した。自己生成試験領域は残存0。Formatterの書込み1224は未成功のまま区別し、提示された同じ差分をapply_patchで反映して読取り整形検査・Lint・Source strictを成功させた。現行の旧phase・署名付き準備経路を移管済みとは扱わず、現在状態のfresh Writer接続とDesktop操作全体の下位集約・新通常経路・全体検証は未完了。新State・Lock・Registry・回復Framework、Docker再起動、Provider依頼、履歴別Evidenceは追加していない。

2026-10-15の単一再起動checkpoint実装：現在状態モデルへ必須nullableの`dockerRestart`を接続し、初回null、要求ID再計算、閉じた48直積、要求／結果／回収の単調性、同Snapshotの未解決最大一件を検査する。検査責務は`state-storage/restart-checkpoint.ts`、保存は既存Writerの固定checkpoint入口へ接続し、他操作と元Task結果を保持する。旧形式の欠落fieldを補完せず、移行はフロントAIが所有する。Source strict・対象六File整形／Lint・Owner／model／新UT計8試験は成功。実Windows Writerとpending再入場は是正後1/1成功（92061.2595ms）、自己生成Repository残存0。独立確認のModerate 3件を統合是正し、受付既知の降格禁止、拒否前後本文の完全同値／Effect 0、更新後の全操作保全を固定した。非対象操作の誤更新と誤追記＋blockedの一時変異はいずれも固有Oracleで拒否し、Source復元済み。契約・品質の限定再確認は残指摘0。現在許可・同一稼働Owner・Host-wide排他と固定下位運用入口の本番接続、旧phase保存撤去、fresh回復入口、通知・通常署名Gate撤去・全影響回帰／E2Eは未完了であり、Package完成・実再起動成功とは扱わない。

2026-10-15の再起動要求契約の限定確認：Coordinator／Docker Isolation詳細・QA-000006・本計画の固定4文書を契約と品質の独立確認へ渡した。状態の交差制約と排他の解放対象に関するModerate 2件を統合是正し、許容組合せ表、blocked後の回収だけの進行、結果／要求ID不変、State Writer更新排他と終端まで保持するHost-wide排他を明示した。両観点の再確認は残指摘0。追加人間判断はない。これは移管先設計の成立に限り、現在SourceのSchema・固定下位運用入口・本番保存／再入場・実環境を成立済みとは扱わない。次はこの固定契約を既存現在状態モデル／Writerへ実装し、旧phase保存の本番接続を置換してからDesktop操作全体を下位へ閉じる。

2026-10-15のDesktop操作と保存境界の着手前整合：旧phase保存を下位へコピーせず、既存exact操作に一度だけ結合する単一再起動要求を現在Snapshotへ置く。発行前にunknownを耐久化してから固定下位操作を呼び、停止／起動の個別段階は短命値とする。要求IDはScope／既存fenceの非秘密Hashと元操作から再計算し、許可には使わない。未発行と清掃不要を区別し、Owner喪失後の過去unknownをready観測で成功へ変換しない。既存Host排他・現在承認を維持し、新Registry／Lock／履歴chainは追加しない。一操作二度目の要求は許可しないため追加人間判断は不要。Architecture／QAへこの移管先契約を接続中で、Source Schema・Writer・本番接続・新実境界の成立はまだ未完了である。

2026-10-15の現行回復保証接続：Owner試験へ別管理主体・元Mount欠落／コピー・復帰後の計画／回収結果差替えの処置拒否と再発行ゼロを追加した。初期化失敗後のabandonは現在操作集合を保持し、正常Home解放の事実へ昇格しないことを確認。Owner／model計5試験成功、対象整形／Lintと限定独立再確認は残指摘0。全試験型の旧契約不一致18件は未解消。実保存試験の移管前Mock参照7箇所を現行の同じOwnerへ同期し、限定独立確認は残指摘0。Windows現在状態の実保存・pending再入場はHard Link反例を含む実環境Profileで1/1成功（87889.1309ms）、自己生成Repository残存0。通常制限ProfileのLink拒否、初回のModule Mockオプション不足と旧参照による停止を成功へ丸めない。Docker／Provider要求は発行していない。旧Observer・動的子Process fixture・旧Pointerの試験全数移行、Desktop全処理の移管、通常署名Gate撤去と全体検証は未完了。

2026-10-15の修復回帰再開：修復試験のOS一時領域への書込み10箇所を、検証済みRepositoryの`.crdd/tests`へ集約した。親のLink／非Directoryを拒否し、既存の失敗時清掃を維持。旧Source参照を現物へ訂正し、物理prefixだけを命名規則へ同期した。Source strict・対象整形／Lint・限定独立確認は成功、残指摘0。全64試験を実行し61成功、旧履歴adoption／そのTrace／署名版跨ぎadoptionの3件は失敗として保持する。自己生成試験Directory残存0を確認した。旧契約の保存方式と維持すべき保証を対応付けて刷新し、失敗試験の削除・期待値緩和で完成としない。

2026-10-15の上位試験整合：認証CommandのOwner喪失Fixtureへ現行の資源Receipt／回収依存を接続した。両処理は呼出しを拒否し、例外が吸収されても結果表示前の独立counter判定と利用側のゼロ確認で見逃さない。対象Integration 1/1、負対照2件の固有断言による拒否、対象二Fileの整形／Lintが成功。限定独立再確認は残指摘0。上位全試験型の不一致は19件から18件となり、残りは旧Recovery APIと現行引数の試験刷新である。Production・理由・回復ID・回収判定は変更していない。Docker／Provider要求は発行せず、自己生成負対照領域は削除済み。全体回帰・Package完成ではない。

2026-10-15のEngine観測移管: 旧Machineの結果／pipe分類と固定CLI観測をDocker Isolationの`desktop/engine-state.ts`へ移した。Rootは再起動用の入力なし観測と修復用の検証済み構成領域だけを受ける二入口、共通state／cleanup型へ限定し、Runtime公開28項目を完全一致照合した。再起動はconfigなし・16,384 bytes、修復は同一Rootのconfig／Home・4,096 bytes、両方5秒と固定endpointを維持する。Publisher前後・明示pipe不存在・close不明・修復の一時Timeout分類を保持した。上位MachineはRoot結果へ接続し、repair／adopt／closeは操作ごとのclosureで観測回収不明をsticky保持、以後の観測0、最終blocked、元exact ID・Native固有cleanup・既存blocked一次reasonを維持する。旧不要観測Helper・endpoint定数を撤去し、旧三Caseの本文Oracleを下位へ移管した。正常22本とclose handleの負対照4本、下位静的3軸・90/90、上位Machine34/34・操作内不明／fresh独立／ID／一次reasonの局所1/1・Actor一覧1/1・Source strict／対象Lint、Runner50成功／失敗0／人間UAT1未実施を確認。契約と品質の限定独立再確認は残指摘0。実Docker・実pipe・実Publisherの新実測、FullRepairSuite、Desktop操作・全体9Cの成立ではない。旧修復判定seamの試験依存は整理対象として残る。FullRepairSuiteの既存OS一時Directory fixtureは、全体回帰前にRepository内の自己生成試験領域へ刷新する。観測回収不明のReportから新しい現在状態・再入場への接続も9E／9Fで閉じ、closureのfresh性を新Effect許可へ読み替えない。

2026-10-15の実行物Trust集約: 旧`current-artifact-trust.ts`を撤去し、既存Docker Isolationの`execution/cli-trust.ts`へ固定契約を統合した。Rootの`describeDockerRuntimeArtifactTrustContract`は既存7条件と同一Policy Hashを返すだけで、実体検証成功やAuthorityを発行しない。上位repair／recoveryは相関Hashを参照し、Nativehelperの既存nested結果はHashを除外して形状を維持した。下位静的3軸・86/86、上位Source strictとNativehelper契約30/30は成功。独立確認で検出した下位変更時の上位試験選択漏れを既存Consumer Bindingへ接続し、cli-trust／Root両PathからNativehelperとCoordinator staticが選ばれることを反証した。Runner静的3軸・50成功／失敗0／人間UAT1未実施、契約と品質の限定独立再確認は残指摘0。Rust・Native Protocol・Policy値・過去Evidence・実Dockerは変更していない。

次のDesktop実操作移管の着手前確認: 生Sessionを上位へ返すだけの移管は完成形にしない。`restart-recovery.ts`の取得→技術再観測→Machine→停止／起動→releaseを下位の固定運用入口内部へ閉じ、上位callbackは既存の許可再確認と環境中立checkpoint保存へ限定する。Nativeframe・stdin／stdio・有界清掃、停止後のProcess／Engine／backend再観測、取消後の後続Effect抑止、記録失敗とfresh再入場の既存Oracleを保持する。Engine観測は二用途の差を保持する。再起動はconfigなし・16,384 bytes・既存三状態とcleanup、修復は検証済みRuntime Rootのconfig／Home・4,096 bytes・ETIMEDOUTのtransient分類を維持し、pipe不存在と観測不能・close不明を区別する。raw Process結果・pipe／WSL型・任意argv・生SessionをRootへ追加しない。修復のRuntime Directory退避・exact rename・Lockと上位の許可／記録は別Ownerとして同じ利用側まで接続する。新Frameworkや共有Stateを追加せず、旧Desktop phase Schemaは新しい現在状態の正本として温存しない。

2026-10-15のbackend観測移管: 旧CoordinatorのWSL一覧分類をDocker Isolationの`desktop/backend-state.ts`へ移し、上位は入力なしの`observeDockerRuntimeBackendState`とstopped／running／unknownだけへ接続した。固定二操作・用途固定環境・有界bytes・厳密encodingと集合整合を維持し、観測不能を停止へ畳まない。旧四Caseは判定本文を維持して移管し、Task状態用の旧Traceを流用せず、ARCH-000008からQA-000006／ERB-UT-034へ接続した。局所合成ITの九反例、Root公開25項目の完全一致、下位静的3軸・85/85、上位再起動Machine37/37、Source利用側一覧1/1、上位Source strict、Runner49成功・失敗0・人間UAT1未実施を確認した。契約と品質の限定独立再確認は残指摘0。現在設計集合は13定義・192項目であり、旧191件の履歴は保持する。この観測は一時点の一覧分類であり、Engine停止、実Process不存在、再起動完了、実WSL境界やAuthority成立を証明しない。Desktopの実処理、記録・許可の上位分離、新state回復、通常署名Gate撤去と全体回帰は未完了である。

順序9Bの着手前照合: 着手時点のDocker環境・CLI Trustは、Coordinatorの`windows-child-environment.ts`、`windows-directory-bootstrap.ts`、`diagnostics/platform-access-release.ts`にある汎用Node技術処理へ依存する。これらを一括してDocker Isolationへ移すと、Console・Host管理・Provider Home・任意配布検査までDocker依存になるため、その配置は採用しない。汎用の必要Native成果物観測・System Directory取得・中立子Process環境は既存Platform AccessのNode境界、Docker固有環境とCLI TrustはDocker Isolationへ分ける。人間は既存Platform AccessにTypeScript入口・試験を加える配置を了承済みであり、追加の配置判断待ちは解除する。Rust／Node両試験と配布入口を同Ownerへ接続し、別PackageやFrameworkを作らない。任意環境builder・Coordinatorへの逆依存・旧wrapperを追加せず、Native固定Hash・Protocol・保存・用途別Authorityは維持する。署名用観測という旧名は実体／Hash観測の責務へ訂正し、旧Runtime署名Gateは三分離判断に従い撤去する。旧署名対象Pathを現在のRuntime実行資格として温存しない。現在、Native Artifact観測を`platform-access/src/artifact/identity-observation.ts`、System Directory観測を`platform-access/src/windows/system-directory.ts`へ移管した。この移管単位はNode静的3軸・5試験、利用側のNative観測84試験・Release Identity10試験・配布境界6試験で確認し、Runnerは静的3軸・49成功／失敗0／人間UAT1未実施。Root公開9件とNode／Cargo両段階の厳密順・5失敗境界を反証し、契約と品質の限定独立再確認は残指摘0。実Rust全体・旧署名Gate撤去・Package全体完成を意味しない。2026-10-15の次候補では、共通環境をPlatform Accessの`windows/child-environment.ts`、Docker用環境とCLI実体／Publisher検査をDocker Isolationの`execution/cli-environment.ts`／`cli-trust.ts`へ移した。旧三Fileを撤去し、用途固定のRoot利用へ接続。任意環境builderはprivateのまま、null prototype・NUL拒否・固定4項目・修復専用Driveを維持した。局所確認はPA静的3軸・5試験、下位静的3軸、上位Native／Host終端114試験、実環境8試験、Windows Adapter9試験、配布境界6試験が成功。利用側台帳をPA→Coordinator／Docker Isolationへ接続し、環境の固定構成・不明停止を別Process試験で確認した。内部API名は`createDockerCliEnvironment`／`createDockerDesktopRepairHelperEnvironment`へ統一し、wire・保存Schemaは変更していない。配布Guardの依存許可はPA Rootだけに限定し、上位六PackageとPA deep importを拒否する。名称差だけと逆変換で一致した本文4・意味Graph1の固定値を更新し、その他の検査は維持。旧試験Path、Node部品だけを持つ配布fixture、実SourceのProcess利用側一覧を同期した。下位静的3軸・81試験、PA静的3軸・5試験、配布6試験、実環境8試験、変更した配布反例2試験が成功。Docker CLIの実Publisher／前後同一性も読取りで成立し、Docker要求／Provider依頼は発行していない。利用側選択が未分類の変更を全登録先へ閉じることも24試験で確認。公開Rootの未使用四定数を撤去し、既存環境CaseでRuntime公開24項目を完全一致照合、余分・欠落の派生集合を拒否する。Symbolのpackage-api接続と収集Caseの十一File表記を同期した。下位静的3軸・81試験は成功し、契約・品質の限定独立再確認は全重大度の残指摘0。順序9Cの用途固定Platform Access入口へ旧Process終端API参照を接続し、上位Source strict型検査は成功した。実tree・配布新経路・Docker内の既存終了処理は未完了として次の所有Process境界で確認する。Sourceの署名Gate撤去・通知・Desktop実処理・新state回復は未完了である。

順序9Cの共通Process境界の着手前照合: 実Provider検証Scriptの旧終端APIは復活させず、既存Platform Accessへ用途固定の所有子Process tree終了入口を配置する。入力は呼出し元が所有するChildProcessと有界待機条件とし、任意実行物・引数・環境builder・PID Registryは公開しない。固定Windows終了補助の開始、終了値、closeと元子Processのcloseを別に観測し、要求発行だけからtree終了やDocker清掃を推定しない。遅延通知、開始失敗、非zero／signal、出力超過、期限切れ、補助子close不能と元子の先行終了を既存ARCH-000008／ERB検証へ接続する。Helperの技術結果はPlatform Access、MCP子の入力EOF・元Process終了・公開結果は既存検証Script、Docker資源全体の回収はDocker Isolationが所有する。共通入口の追加は人間了承済みの既存Package内に限定し、Rust・署名・権限・保存Schemaを変更しない。現在、用途固定SourceとRoot APIを接続し、PA静的3軸・6/6、利用側Script ST36/36、上位Source strict型検査、Process Owner一覧1/1、Runner49成功／失敗0／人間UAT1未実施を確認した。公開集合は21項目。合成九境界で開始前拒否、非zero／signal、error後close未到達、期限、出力超過時kill一度と保持量、close後追加kill0を反証した。元子の直前生存観測をOS exact Identity保証へ広げず、ConsumerのEffect記載と模擬tree Caseの表現を同期した。共通APIをDocker内の所有Processへ接続し、taskkill定数・重複wrapper・raw補助spawnと任意終端環境callbackを撤去した。PA不正PID0／NaNの要求0反例を保持し、DIの元子／補助子合成失敗Caseは型とstreamを正したfixtureで維持する。通常DI静的3軸・80/80、実Windows Process5/5が成功。PAの固定APIでも自己生成Node親・子孫の不存在を通常Host権限で確認し、Sandboxでのhelper終了1は実環境成立へ流用しない。Runnerの旧Coordinator固定を解消し、通常ITで両既存Windows prefixを除外、専用段階で選択Ownerを直列搬送する。該当計画は22項目・IT14項目・Windows1項目で、二Ownerの厳密順、通常段階重複0、失敗後後続0、未承認要求0を保持。Runner静的3軸・49成功／失敗0／人間UAT1未実施、契約・品質の限定独立再確認は全重大度残指摘0。共通終了処理の移管単位は成立したが、Desktop実処理と9C全体は未完了。配布閉包は5/6で、旧GuardがNode ChildProcessのruntime importをchild_unboundへ拒否しており、新通常実行経路の配布成立は主張しない。新しい管理機構を追加せず、署名Gate撤去と既存処理移管の残件として扱う。

次のDesktop移管の着手前照合: `wsl-state.ts`は一覧Process結果だけを扱う純粋技術判定として下位へ移す。`current-artifact-trust.ts`のDocker Inc／cache-only Authenticode／操作中Identity・Hash条件はCRDD独自Runtime署名とは異なるため維持し、下位の技術Ownerへ集約する。`restart-state.ts`は技術進行とintentRecorded／recordConfirmed／相関・再送禁止が混在するためFile全体の移管はしない。技術進行・OS名・停止開始操作は下位、許可・記録・完了と回復義務は既存上位Ownerへ分け、既存の環境中立checkpointへ接続する。旧Desktop Schemaを現行上位状態として温存せず、旧形式はフロントAIの移行手順へ分ける。新しいState、Registry、汎用回復Frameworkを追加しない。既存UTの文法／部分集合／不明拒否、ordered-stage／境界差／取消／記録失敗／Effect不明の意味を新Ownerと実Callerの試験へ全数対応させる。

現在の抽出候補: 認証五資源の作成Receipt保存・別Process本番清掃再入場は実Dockerで確認済み。汎用所有Process試験をdocker-isolationへ移し、上位取消を固定ready_tree公開診断へ再接続した。下位実Windows 5 Case、上位実Node取消2 Case、上位選択回帰125 Caseは成功。配布Guardの旧参照を実Ownerへ更新し、固定Node本文の意味graphも含む配布6 Caseは成功。下位Rootのcandidate／raw primitive公開は撤去済み、試験用candidateは同Package内部だけに閉じた。上位は本番単一Runtimeと同じborrowPathsを狭いbinderで結合する。旧上位20 Caseの観測は上位7、下位cleanup13、下位実config1へ全数対応し、限定独立レビューは全重大度0件。下位静的3軸＋65 Case、上位Codex Adapter20 Case、選択strict型検査、試験台帳／Runner43 Caseが成功。実Docker三試験の再確認は3/3成功した。署名／配布契約回帰は154件中149成功・5失敗で終了した。移管前のProcess参照に依存する反例3件を新Ownerへ接続し、認証のCLI・最小環境・作業場所・許可生存・終了通知の検査を維持した。Windowsリンク試験2件は実環境Profileで確認し、broken junctionは対象作成後に削除して構築した。修正後の同5件、配布境界6件、選択strict型検査は成功。全154件の修正後固定候補回帰は未完了である。Repository全体Checkerは2967指摘、下位設計・Source・QA-000006をscopeとした実行はglobal指摘259、同対象Pathの指摘0であり、Repository全体正常は主張しない。回復境界のraw第4引数・三wrapper・結果型を上位Sourceから削除し、既存Executorの三操作へ置換した。下位Rootのraw三helper公開も撤去し、Package内部の技術試験だけがprivate Sourceを利用する。配布Guardはこの三helperの実内部Consumerだけを認め、Root再公開の三反例を拒否する。旧上位技術11block・12callを下位の既存試験Fileへ移し、現行の名前・Network契約へfixtureを同期、Provider意味はinitRequired booleanへ限定した。同File17件と下位全76件が成功、下位静的3軸・上位選択strict・配布6件も成功した。上位のraw runner試験17call・12blockは、戻り列・受取Expectationを観測する三操作fixtureへ更新した。技術11blockと旧Docker応答fixtureは下位へ集約し、上位は回復ID保持・完了再読取り・処置順・記録保持のOracleを残した。限定読み取り確認はDraftの残指摘0。ただし当該suiteは旧beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserverの静的importでロード失敗しており、新しい試験成功は未成立である。旧記録生成fixtureも旧形式を前提としており、現行state方式への刷新が必要。旧Source APIの復活や互換Reader追加では処置しない。上位全試験型は20件の不一致を観測して未合格である。公開Runtimeのplatform入力は撤去し、下位が現在OSを選択する最初の変更を実施した。下位静的3軸・78件、上位選択strict・配布6件は成功。platform入力撤去後の実Docker三試験も3/3成功（26917.4055ms）し、未起動五資源の作成Receipt・別Process再入場・本番Ownerの実ID清掃を確認した。Engine 29.8.1の稼働を読取り確認し、再起動・実認証・Provider依頼・永続データ削除は行っていない。試験台帳のOwner照合23件も成功した。設計・計画・QAの方針訂正4文書は限定独立再確認2観点で残指摘0だが、Windows環境・CLI Trust・Desktop技術処理と通知接続は未移管で、環境非依存境界全体の完成ではない。Processの終了値分類と出力上限の純粋判定を`command-result.ts`へ集約し、上位は用途別の固定理由とAI Adapterの非0終了解釈だけを保持する。既存の公開理由、期限→出力超過→Signal→非0終了→完了の優先順、UTF-8上限値、Node Process返却型を維持した。専用UTとCatalog／Symbolを接続し、下位静的3軸・80件、上位Controller／取消108件、配布6件・選択strict、台帳23件が成功。配置・Header指摘の是正後、限定独立再確認はPass・残指摘0。metadata/設計/品質・変更範囲の再照合、固定候補の技術・品質独立レビューも未完了。実Provider E2Eと後続のCoordinator／Orchestrator再編は別の未完了範囲を維持し、Package全体完成・署名準備完了はまだ主張しない。Docker再起動・Provider依頼・共有管理構造追加は行っていない。

認証Processも下位の共通Ownerへ接続し、上位の直接spawnと単独child.kill実装を撤去した。元生成Command／固定Engine、許可生存、対話inherit、非対話期限・上限、元子と終端補助子joinを下位で所有する。終了不明はin_flight・exact回復参照を上位に保持し、後続操作・完了保存・Home解放を拒否する。下位全30 Caseと上位認証全15 Case、静的3軸・製品／対象試験型が成功。旧UT内の任意Node実行wrapper試験は撤去し、許可喪失joinを下位IT、終了未確認時の業務停止を上位UTへ分離した。実Windowsの共通Owner終端3 scenarioの既存実測とは観測範囲を分ける。配布Guardの新Owner登録、公開primitive整理、認証清掃のexact資源条件の再照合、既存統合回帰と完成候補レビューは残る。実認証や実Provider依頼は行っていない。

認証技術計画の移管: 公式CLI選択・専用Home Authority・Proxy意味は上位に保持し、五資源／九開始操作／観測・清掃操作の固定argv構築を下位へ移した。元Command相関、payload凍結、名前差替え、HOME等の構成上書き、配列getter拒否を追加し、下位全27 Caseと上位認証のportable14 Caseが成功。実Nodeによる旧Lock喪失Caseは今回は選択外であり、新Ownerの終了試験へ移す。認証の直接spawn・Lock監視と結果搬送はなお移管途中で、認証全経路完成・実認証成功は主張しない。配布Guard・公開集合・旧Recovery接続・固定候補レビューも未完了。

同期診断も用途別技術投影へ移管した。固定version／create／inspect／三種の不存在Filter／実ID start・SIGTERM・removeを下位で構築し、上位の直接spawnSyncと重複argv構築を撤去。上位が3Mountだけを投影し、events／projection／managementは下位へ渡さない。追加3 Caseを含む診断局所8 Case、既存取消診断のportable3 Caseが成功。実Windows Caseは既存windows_process_controlへ接続し、通常profileと分離した。配布Guardは移管後の固定候補を再登録するまで未成立、対話認証は次の移管対象。旧Evidenceは維持する。

診断attachの追加移管: 固定実Container IDから下位がstart --attachを構築し、共通Process Ownerへ接続した。上位の第二spawn実装176行を撤去し、3故障の固定Node fixtureも同じOwnerへ接続した。新しい模擬5 Caseと下位全22 Case、Runner台帳23 Caseが成功、製品Source／対象試験型も成功。実Windowsの3故障確認は初回制限環境で終端不成立（成功へ丸めない）。その自己生成子PID・親・固定Scriptを再照合して単独回収し、同じ試験をWindows Process権限のあるprofileで再実行して1 Case成功（3 scenario、810.1044ms）を確認した。実Provider依頼、Docker再起動、永続データ変更はなし。Process本体変更に伴う配布Guardの再固定、同期診断／対話認証の移管、公開primitive整理、完成候補レビューは残る。以前の配布成功を変更後Sourceへ流用しない。

最新の限定確認では、Runner全48件は47成功・人間UAT1保留、Docker Effect／Process Controller／所有Processの影響回帰131件は全成功。後者の初回5失敗は、移管前のconfig処理参照とReceipt欠測を清掃成功へ扱う旧期待を是正した。欠測時の拒否を弱めず、Process終端確認とDocker資源不存在を分けて確認した。Source型・対象試験型・差分空白検査も成功。配布Guardの実Process Ownerを下位へ同期し、新配布契約6件と既存閉包・拒否の選択試験を確認した。Symbol・Catalog・Runner・CheckerのOwner接続は更新済みだが、完成候補の独立レビューは未実施。

追加の着手前照合では、隔離診断の同期／attached ProcessとClaude対話認証のspawnが上位に残ることを確認した。固定Docker構成、Process、stdio、出力上限、取消とcloseは下位へ収束させ、Scenario、Home Authority、対話許可、認証結果、回復記録はCoordinatorに残す。任意argvの汎用Executorや新しいRecovery管理を追加しない。これらの移管と公開Rootの技術primitive／試験候補の整理が順序9の残件である。

旧Recovery試験18型不整合は単純な引数追加では直さない。通常開始／完了はstate.jsonへ接続済みだが、fresh再入場・相関Resolver・契約説明には旧Journal方式が残り、旧試験の一部は廃止済み開始APIを子Process文字列からも呼んでいる。下位のexact資源観測試験を上位のTask相関・保存・再入場保証の代替にしない。旧形式だけの刺激、現行契約へ移す義務、未置換のfresh能力を分類し、上位の順序10〜11との境界を明示して処置する。旧API復活、偽清掃Receipt、旧Suite一括削除は禁止。過去Evidenceは変更しない。

詳細設計の着手前独立照合では、同Processの元結果とfresh Process再入場、spawn直前の実行物照合、用途限定callback、下位の固定Docker構成を補正し、契約上の残指摘0を確認した。これはSource完成後の独立レビューではない。

| 断面 | 現在の処置 | 確認と残件 |
|---|---|---|
| Docker技術計画 | 新Packageの`execution/command-plan.ts`が九purposeと固定隔離flagを構築。Coordinatorの準備とEffect前照合が同APIを利用し、旧`provider-command-plan.ts`と重複入力型を撤去 | 新PackageのFormatter／型／Lintと純粋試験3件成功。全利用側回帰・Symbol／Catalog追従は未完了 |
| 所有子Process | 実開始・有界待機・stream／出力上限・tree終端を新Packageの`execution/owned-windows-process.ts`へ抽出。旧Fileは既存Host環境の結合と委譲へ限定 | Coordinator製品Source型成功。公開技術APIの最終閉集合、実Process回帰、固定Source検査5群の移管は残る |
| Docker実資源 | 実ID／構成の観測と清掃、元清掃結果の照合、空CLI configと実Processを新Packageの本番Runtimeが所有する。Coordinatorは上位計画の検証・技術投影・委譲へ限定。fresh回復の固定同期CLIも下位へ接続し、未知作成の発見は名前／Labelの単一実IDと構成を照合する | 新Packageの静的検査と限定17件成功。未知・非作成用途の要求0、用途別Network、元結果、環境snapshot→最終CLI／config照合、元Process失敗の非成功化を確認。公開API最終閉集合、既存回帰と配布検査の追従は未完了 |
| 現在の実環境 | Docker Desktop 4.93.0を通常起動、Engine 29.8.1を観測。本番下位Runtimeで三Container・二Networkの作成、公式CLIの`--version`、実ID清掃と不存在を確認 | Host局所1/1成功・Exit0（5961.1421ms）。初回はNetwork期待構成の投影差により回収確認が失敗し、用途別空配列への是正後に成功した。初回の二Networkも実ID／構成再照合・不存在後に回収し、自己生成試験Directory残存0。再起動・修復・AI依頼・認証・永続データ削除なし |
| 既知試験不整合 | Coordinatorの旧Recovery二Fileに18件の型不整合が残る | 今回の回復接続で現契約へ対応する。架空Receiptや旧API復活で型だけ通さない |
| 配布・署名 | 旧位置の固定Source検査、sibling閉包、fixture、署名前欠落反例を読取り特定済み | 新Package実体と上向き依存禁止を検査するよう追従し、委譲Fileだけで保証を推定しない |

通常清掃とfresh回復の構成照合を`cleanup/resource-configuration.ts`へ共通化し、二Ownerの重複判定を撤去した。固定五作成用途・資源種別・名前・Label・実ID・Imageと用途別NetworkをEffect前に検査する。fresh回復の同期実行・実ID観測・限定削除・ID／名不存在は下位が所有し、CoordinatorのHelperは上位意味から技術期待値を作る委譲へ限定した。本番Runtimeは固定Filesystem／Processを内部で結合し、primitive差替えは明示的な試験候補入口へ分離した。環境はplain data snapshotとして先に固定し、その後でCLIとconfigをfresh照合する。旧Recovery試験の対応、公開APIと試験専用Consumerの最終閉集合、配布・署名検査、Symbol／Catalog、完成候補の独立レビューは未完了である。

検証用依存は既存と同じ固定版で取得し、インストールScriptを実行しなかった。今回だけのRepository内npm cacheとread-only CLI確認用Directoryは清掃済み。新Packageの独立回帰成功はDocker隔離完成・実資源回収成立・署名実E2E成功ではない。Rootの清掃は検査済みReceiptを必須根拠とし、旧試験候補だけに存在したReceiptなしの名前清掃へfallbackしない。上位の資源観測型の重複も撤去し、新Ownerの型を利用する。以上の残件を閉じるまでCommit・Pushを完了報告しない。

後半の実行系では実装順を下位から、要求設計を上位から行う。改訂後の段階9〜11を一度に全置換しない。前半で整理した公開入口へのAPI追従は各Package変更に含め、最終実境界は新構成で再確認する。

| 段階 | 閉じる内容 | 次へ進む確認 |
|---|---|---|
| 隔離境界 | 使用資源、入力、開始・終了、取消、Process終了、清掃、親喪失時に残る資源と最小処置 | Provider依頼なしの実Docker局所試験で、成功・開始失敗・取消・終了観測不能を区別できる |
| Coordinator実行 | Profile解決済み要求、公式CLI、Executor／Reviewer、進捗通知、最終結果。一次失敗を清掃結果で上書きしない | 下位の実結果を用いた結合試験と固定Taskの局所実Provider確認。表示・任意保存を清掃条件へ入れない |
| Orchestrator進行 | 受付、Queue、Task／Attempt、結果の耐久保存、人間判断、再開 | 本番入口から正常・取消・中断再入場・候補採否・競合を確認し、共有状態の重複がない |
| 公開利用側 | CLI／Workbench／MCPの実行経路と表示・操作 | 同じ公開Capabilityと認可を使い、単体試験成功を公開全体の完成へ昇格しない |

Dockerは隔離を維持し、Containerの継続利用を回復目標にしない。資源を安全に処置し、新しいAttemptを開始できることを目標とする。過去のunknownを成功へ変更せず、現在の資源不存在と再実行可能性を別に評価する。成立が立証された限定ケースだけを閉じ、汎用強制削除や共有Recovery管理へ拡張しない。

Consumerの結果保存はそのOwnerが担当する。Orchestratorの耐久受領と、Dockerの資源回収を分離する。応答文章とCandidate本体も区別し、意味のある候補・失敗根拠だけ必要なOwnerで保全する。

## 5. Packageごとの完了・Commit条件

主対象は一Packageとするが、API変更に伴う直接利用側、試験、設定・配布入口、Architecture／Quality／Symbolの追従は同じ変更に含める。Folderを厳密に一つに限定して壊れた呼出し側を残さない。一時的な汎用Adapterや旧方式互換Frameworkを増やさず、必要な連動切替は同じCommitへまとめる。

1. 該当する正本と公開契約、保持する保証、変更しない範囲を確認する。
2. 必要なArchitecture／Quality更新と人間判断を先に済ませる。
3. Source・試験・直接利用側・Schema・Symbol・設定・入口を更新する。
4. Formatter・型・Lint・静的契約、Package回帰、影響利用側の結合試験を実行する。
5. 外部資源Ownerを変更した段階では、その局所実境界を先に確認する。全E2Eを最初の影響分析にしない。
6. 固定差分を独立レビューし、対象内指摘を是正・再確認する。
7. 現在状態・対応表・CHGを更新し、完了したPackage単位でCommitする。Pushは人間が許可した運用範囲に従う。

Packageの限定完了は未検証の全体をPassと表示しない。既知の基準版不整合は切り離して記録するが、今回の変更が使う契約の不整合は先に解消する。削除前には代替先と利用側の接続、新しい根拠を照合する。

## 6. 判断が必要な地点

| 判断 | 提示する根拠 | 判断時点 |
|---|---|---|
| Coordinator単独の本番入口を廃止するか | 現行CLI／Workbench／MCP／scriptsのConsumer一覧、Orchestrator経由の代替、失う操作 | 順序0、公開入口変更前 |
| `docker-isolation`を独立Packageにするか | 現行File・資源Owner・AI Adapterとの依存、独立試験の実益、Package内Module案との比較 | 2026-10-14に独立Package化を人間承認済み。技術責務に限定し、完成後Commit・Push |
| worktreeか現行隔離Snapshotか | Canonical保護、候補採用・競合、共有Git metadataとMount境界、運用費用 | 順序1〜2の設計。採用まで新方式を作らない |
| 署名・Native保証をどこまで削るか | 現在守る保証、具体的Consumer、Node／既存隔離による代替と残存Risk | 順序0で設計制約、順序5・12で具体的削除判断 |
| CROS Package維持か廃止か | 必要なRegistry／認可／RoutingのOwnerと、移管で増える依存・中継 | 2026-10-09の維持判断は後続の人間判断で見直し。認証・認可を`access-management`へ再編し、その他責務を実Ownerへ移した後に旧`cros`を撤去する。専用REST／Gateway／Shared Host廃止方針は維持する |
| Workbenchの利用導線・表示・Visual | 現行UX／IAとの比較、Screen Inventory／Flow、代表画面と代替 | 順序8の接続維持後、画面再設計前 |

これらを一括質問せず、必要な根拠が揃った地点で推奨と影響を提示して止める。単なる内部File移動へ追加判断を要求しない。

## 7. レビュー・監査と収束

現在は1〜5へ着手しているが、未決Architecture候補の採用・全Sourceの監査・全体の実境界試験を完了したとは扱わない。順序0の全体照合は継続し、既存設計に整合する限定内部整理から進める。未決契約の削除・置換は照合と判断前に行わない。各Packageでは変更した責務に対する独立レビューと、必要な文書・不足影響監査を選ぶ。準拠基準自体を変更する場合だけ準拠監査を追加する。Communication／市場探索は公開訴求を変更しない段階には追加しない。

最終確認は変更した意味から全回帰面を導出する。正式Evidenceは判断に必要な結論・対象版・条件・根拠参照へ集約し、実行ごとの巨大ログをCHGへ保存しない。通常履歴・一時物の保持と、正式Evidenceの保持を分ける。

収束条件は、採用済みCapabilityの全対象にOwner・利用側・検証が対応し、重複状態と不要中継の処置が説明でき、未決の必須条件を将来へ隠していないことである。理想構造の完成や試験量の最大化を目的にしない。

## 8. 1〜5の着手結果 — 2026-10-09

計画Commitは`459d598d`。現行設計・Source・直接利用側から処置を具体化し、未決の実行系改修は前倒ししていない。

| 順序 | 現在の処置 | 次の確認 |
|---|---|---|
| 1 Version Control | 除外設定更新を既存`git/local-ignore-adapter.ts`へ移し、Layoutは観測・共通再検証へ限定した。公開API、128KiB上限、関数本体、結果型、Lock・更新順序を維持。限定独立レビュー指摘0 | この限定移管は確認済み。worktree方式変更・採用境界の設計変更は未採用で、別途比較する |
| 2 Domain Model | 共通活動操作・型を`activity/operations.ts`／`activity/types.ts`へ移管。一時保存型は`storage/types.ts`へ限定し、投影と候補判断を同じContext領域の別Fileへ分離。限定独立レビュー指摘0 | 本体・型・公開集合一致、Package回帰106件とCROS／MCP／Workbench型接続を確認。全体Checkerの未変更Coordinator指摘は別残件として保持する |
| 3 Execution Intelligence | 改善提案を`evaluation/improvement-candidates.ts`へ移管し、事実Eventの検査・Summaryを一方向に利用する。公開API・提案本文・結果値不変、限定独立レビュー指摘0 | 基準・変更後各82件のPackage回帰、公開入口契約、Orchestrator／Workbench型接続を確認。保存方式や採用Authorityは変更しない |
| 4 AI Adapter | Provider認証Probeの出力判定・非正常終了分類をAI Adapterへ移し、Coordinatorの引数再検証を既存Provider記述へ接続。限定独立レビュー指摘0 | Package回帰13件、Controller／Effect結合126件を確認。隔離資産の移管は後半のDocker Owner確定まで先行させず、署名・実Provider境界の未評価を保持する |
| 5 Platform Access | OS保証と実利用側を照合。Namespace初期化・親chainと対象観測を分離し、公開Protocol・権限・終了条件は維持 | 通常Native回帰と限定独立レビューで確認する。実OS専用fixture、Docker Desktop部品の撤去・Native廃止・再署名は局所整理の完了に含めず、後半実行系の判断へ対応付ける |

### Version Controlの限定確認

- 基準Package回帰46件全件Pass。移管後に所有者分離の契約試験を追加し、最終47件全件Pass、Skip／Failとも0。
- Formatter、型検査、LintはPass。通常／linked worktree、七つの更新失敗段階、実Process競合、再入場、公開Symbol・Consumer閉包の既存試験を維持した。
- 移動したブロックを基準`98cab6e3`と機械比較し、Owner名の説明・末尾改行以外は一致。関数本体・結果形式の変更なし。
- 着手前の独立確認と変更後の限定独立レビューを実施。指摘0。既存両Fileと試験SuiteのSymbol登録は変更不要。
- 実Git試験の一時RootはRepository内`.crdd/tests/stage2-version-control`へ限定。Docker／Provider依頼、認証領域変更、署名・Release操作は行っていない。
- これは除外更新Owner移管の成立根拠であり、第二段階全体の完了・新方式Candidate採用・署名配布の成立根拠ではない。

### Domain Modelの限定確認

- 活動操作の実体は一つのまま保持。Topic／Meetingの種別固定操作、保存実装、Cursor、改訂競合、削除確認、昇格・Outcome処置は変更していない。
- 読取り投影は`project-context/source-projection.ts`、候補採否判断は`project-context/candidate-decision.ts`が所有する。判断条件・結果値・保存形式は不変。新しい公開Symbolや中継層は追加していない。
- 基準版と変更後のPackage回帰は各106件全件Pass、Skip／Failとも0。Formatter、型検査、Lint、CROS／MCP Server／Workbench Serverの型検査はPass。
- 移管した関数本文、活動型・一時保存三型、Rootの公開Symbol集合を基準Commitと機械比較し一致した。直接参照、Symbol登録、Architectureの配置、Checkerの公開Path集合を追従した。
- 着手前整合確認と変更後の限定独立レビューを実施し、指摘0。全体Checkerの公開入口検査はPassだが、未変更CoordinatorのNative試験Header・型分類・Test Symbol登録で二つの検査が失敗した。全体Passとは扱わず、後半の実行系整理へ残す。
- Docker、外部Provider、署名・配布、保存Lifecycleの変更は対象外。候補判断関数の移動を正本Effectの実行検証とは扱わない。

### Execution Intelligenceの限定確認

- 改善提案を既存の評価領域へ分離し、記録・検査・要約は既存Ownerに保持した。新抽象、Provider呼出し、採用権限、自動変更は追加していない。
- 提案関数本文とRoot公開Symbol集合を基準版と機械比較し一致。不正Eventの拒否、欠測、根拠Event ID、契約文字列、`proposal`、Authority非付与は不変。
- 基準・変更後各82件のPackage回帰は全件Pass。Formatter、型、Lint、Orchestrator／Workbenchの型検査はPass。Checkerの公開入口・依存方向・階層の限定3検査はPass。
- Architecture、Symbol、新Ownerを検証する既存二Suite、直接参照、Checker期待集合を追従。着手前確認と変更後の限定独立レビューは指摘0。
- 全体Checkerの未変更Coordinator指摘と、後半の実行系・署名実E2Eは残る。局所結果から全体完成を主張しない。

### AI Adapterの限定確認

- 認証Probeの判定は`profile/subscription-status.ts`、非正常終了分類は`output/provider-error.ts`が所有する。Process・取消・回収・実行AuthorityはCoordinatorに保持する。
- 基準`57495b94`の旧関数本文と、移管後の二関数本文を独立レビューで機械比較し一致した。Offering、厳密認証と対話認証の別契約、分類順序・上限・理由値は変更していない。
- 引数再検証では既存の認証記述とClaude引数Builderを利用する。引数順序、助言経路の例外、Docker設定は不変。公開入口、Symbol、Controller試験の実装参照、Checker期待集合、Architectureを追従した。
- AI Adapterの書式・型・Lint・回帰13件はPass。Controller／Effect結合試験126件はPass、Skip 0。変更SourceのLintとCoordinatorのSource型検査はPass。Coordinatorの試験型検査は未変更二Fileの既知18件で失敗し、全体Passとは扱わない。
- 固定差分の限定独立レビューは指摘0。実Provider／Docker起動、認証操作、署名・配布は行っておらず、これらの実境界成立の証拠ではない。

### Platform Accessの保証・利用側照合

| 保証の所有範囲 | 現行利用側 | 今回の処置・Nodeへの置換評価 |
|---|---|---|
| RootのIdentity・アクセス観測 | CoordinatorのPlatform Access境界とRoot契約。検証済み実起動に未接続の入口は未接続のまま保持 | `root_observation`／`protection`を維持。NodeのPath文字列・stat・accessは同handleのWindows権限照合と同じ保証ではない。未接続を不要の根拠にしない |
| Provider Home／Candidate Store／Runtime Stateの保護 | `provider/home-windows-adapter.ts`、`platform-access/protected-root-windows-adapter.ts` | `protected_root`／`principal`／`protection`を維持。固定Known Folder、利用者SID、非Reparse、同handle Identity・DACL、限定初期化を環境変数や通常File APIで代替しない |
| System Directoryと最小子Process環境 | Platform Accessの`src/windows/system-directory.ts`／`child-environment.ts`と`src/artifact/identity-observation.ts`。Docker専用環境はDocker Isolationの`src/execution/cli-environment.ts` | `windows_directory`を維持。OS取得値と環境変数の文字列を同一視せず、Docker専用値と共通OS値を分離 |
| Host Namespaceと終端記録 | `host-execution/terminal-windows-adapter.ts`とcaller checkpoint | Namespaceの三実体・保護・初期化を`host_namespace`、十一／十二対象の読取り・再照合・終了を`terminal_target`、容量・予約・保存・読戻しを`host_record`へ分離。保存区間の排他・receiptは同じ同期Ownerへ保持し、追加Frameworkを作らない |
| 固定Docker Desktop・署名Publisher・所有子Process | `docker-desktop/repair-native-process.ts`と既存修復・再起動入口 | WinVerifyTrust、Process実体、suspended→Job→resume、終了確認を維持。Node spawn・hashだけへの置換は同じ保証の根拠がない。修復削減は後半の実行系へ接続する |
| 固定Protocolと結果搬送 | Native `main.rs`／`protocol`、上記TS Adapter | Rust側の未信頼入力検査とTS側の未信頼応答検査は異なる境界。片側だけ成功することを理由に重複として削除しない |

上表は現在利用する保証とOwnerの照合であり、新しい保証の採用・実OS検証の完了ではない。Nodeへ移せる純粋なcodec・hashだけを抽出するための新APIは追加しない。必要性のない移管は依存と検証費用を増やすためである。

### Platform Accessの限定確認

- 対象観測の530行を`filesystem/terminal_target.rs`へ移管し、基準`9f6fd8c2`とブロック全体の機械比較で一致した。公開範囲、八／九handleの保持・逆順close、十一／十二実体の別契約、部分取得・元失敗と終了不明は不変。
- Rust直接利用側は`host_record`へ保持し、既存fixtureの名前・実行条件を変更しない。Native公開入口、wire、TS Adapter、Docker修復処理は変更していない。
- Architecture、Symbolと既存試験の実体参照、Module宣言、Coverageの明示Source集合を追従した。Coverage集合の存在しない旧`provider_home.rs`参照は現行`protected_root.rs`へ訂正した。
- 基準・移管後の通常Native回帰は各44単体＋6CLIがPass、23件は明示ignored。Cargo書式確認・Clippy（warning拒否）はPass。ignoredの実OS専用fixture、計測Coverage、署名・実Dockerは今回実行していない。
- 新Sourceは既存Native検証入口の再帰Source閉包へ含まれる。現行署名済み実行物を新Treeの検証証拠へ流用せず、後半で新しいBuild Identity・配布閉包・必要な署名境界を確認する。
- 限定独立レビューの文書図1件を是正し、Namespaceの直接dispatchと対象／記録要求を実装に合わせて分けた。是正後の未解決指摘0。実装上の保証漏れ・本体変更は検出していない。

## 9. CROS／MCP／Workbenchの移管前照合 — 2026-10-09

本節はPackage維持判断変更前の照合・実測履歴である。維持判断と以下の実施順は§11で見直された。現在のOwner方針と再開Gateは§11を優先し、本節の維持前提を現在の実装許可へ流用しない。過去の判断・観測・検証結果自体は変更しない。

### 結論と判断境界

CROSの登録・Credential・認可・横断投影は独立した責務として、2026-10-09の人間判断で独立Package維持を承認した。CROS専用REST／Gateway／Shared Hostは廃止対象であり、BrowserとWorkbench Server間のPresentation APIは維持する。以下の対応をArchitecture／Qualityと利用側へ具体化してから実装する。未決の実行系構成をこの判断から採用しない。

着手前の読取り専用確認により、現行利用側、移管先の不足、保持保証と依存順を照合した。これは段階6の独立完成レビューや実装許可ではない。変更経路は既存CHG内の責務再編であり、実装時はArchitecture／Quality、直接利用側と配布入口の不足影響・文書確認、固定差分の独立レビューを行う。準拠基準・公開訴求・Release判断は変更しないため、準拠監査・市場探索・署名実E2Eをこの棚卸しへ追加しない。

### 現行利用側と移管案

| 現行入口・利用側 | 移管先・処置案 | 保持する成立条件と現在の不足 |
|---|---|---|
| Workbench Server→`readRemotePortfolio`→CROS REST | 既存MCPの`crdd.list_projects`／`crdd.get_project_context`へ切替 | 一覧はProject ID・状態・Source数のみで、完全なPortfolioではない。個別取得との整合、許可Source、五場面、欠測・競合を保持する読取り手順を設計する。接続済みとは扱わない |
| Workbench Server→`readRemoteAiProfileCatalog`／`executeRemoteAiProfileMutation`→CROS REST | Profile参照・管理をMCPの専門Adapterへ接続してから切替 | 現行MCPには未接続。systemAdmin限定、expectedRevision競合、削除確認、理由・現在Snapshotを保持する。管理権限からProject本文アクセスを生成しない |
| Workbench Server→`readRemoteRuntimeActivity`→CROS REST | Runtime活動の読取りをMCPへ接続してから切替 | 現行MCPには未接続。要求ごとの現在Credential・Exposure、許可Repository集合、cursor、limit（既定20・1〜50）、`observed/absent/unknown`、Event欠測・継続を保持する。欠測を空一覧の正常状態へ畳まない |
| Workbench Server→Topic／Meeting MCP Adapter | 既存MCP操作を維持 | 明示Repository、改訂競合、確認付き削除、Relationの非開示を保持。共通通信処理を整理する場合も汎用接続Frameworkを追加しない |
| CROS `connection/http.ts`内の型とReader契約 | 認可・横断投影の実責務Ownerへ移す | Exposure Snapshotに加えRuntime observation／event／readerも対象。MCP resolver、設定Reader、Workbenchの直接利用側を同じ切替へ含める |
| MCP `shared-host/server.ts`のREST・MCP・Gateway三Listener組立て | Shared Host／Gatewayを撤去し、MCP自身のHTTP lifecycleへ集約 | Origin、TLS終端、mirror header、Bearer、payload制限、切断・停止時の取消／join、Listener／Socket回収を維持する。Local呼出しはTransportを省いても認可を省かない |
| `/.well-known/cros-health`、Shared Server起動・設定・運用入口 | 旧入口を撤去し、必要な受付観測をMCP自身へ対応付ける | Transport受付は認証、Project参照、Provider正常、実行能力の成立を証明しない。旧URLの利用側、公開Launcher、設定、試験・運用手順の全数照合は未完了 |
| Credential発行・回復 | 既存Local管理入口に保持 | 秘密の発行能力をMCPへ新設しない。MCPは認証済み要求を認可へ接続する |
| Browser→Workbench API | 維持 | Server→CROS RESTの廃止と混同しない。表示導線・Visualの再設計は別の人間確認へ戻す |

### 現行Ownerと本番未接続の区別

読取り専用の移管前確認を完了し、次の三能力を旧RESTから新Ownerへ対応付けた。下表は実装前の処置であり、新MCP接続の完成根拠ではない。

| 能力 | 意味・操作の現行Owner | 保持する試験と移管時の不足 |
|---|---|---|
| Portfolio | CROS `federation/project.ts`の`createPortfolioProjection`／`resolveAuthorizedRepositories` | CROSの許可Source・無効Bearer非開示、MCPのWorkspace限定搬送、WorkbenchのCoverage・失効後Current表示拒否を保持。一覧と個別取得の間で別Snapshotを混入させない読取り契約が必要 |
| AI Profile管理 | AI Adapter `catalog/types.ts`と`profile/administration.ts`の`createAiProfileCatalogAdministration`。CROSは管理可否を判定する | AI Adapterの競合・確認付き削除Oracle、CROSの非管理者403・Catalog非開示、Workbenchの管理者限定表示を保持。MCP Schema／route／Resolverは未接続。本番CROS LauncherもAdministrationを注入していない |
| Runtime活動 | 現行CROS `connection/http.ts`の観測・Event・Reader契約。実状態はOrchestratorが所有する | CROSのReader入力を許可Repositoryに限定するOracleと非開示Project拒否、WorkbenchのRemote活動表示を保持。型・読取り契約をTransportから分離する。MCPと本番CROS LauncherのReader注入は未接続 |

現行の主なOracleはCROS `remote-transport.contract.test.ts`、MCP `cros-project-context-mcp.integration.test.ts`、Workbench `workbench-server.contract.test.ts`およびAI AdapterのCatalog／Administration試験にある。REST試験の成功だけでは管理操作全体を網羅しない。`template/tools/crdd-cros-server.ts`はRegistry・Exposure・Topic／Meetingだけを組み立て、設定型にもAdministration／Runtime Readerがない。したがって、本番未接続を単なるTransport移動で解消済みと扱わない。Credential発行・回復は既存Local管理入口に保持する。

### 削除までの依存順

1. 承認済みCROS PackageをOwnerとして、共通契約と保持する認可・結果意味をArchitecture／Qualityで固定する。Exposure・Runtime観測／Reader型をHTTP Transportから分離し、Root export・設定Reader・MCP Resolver・Workbenchの直接利用側を追従する。
2. 未接続のProfile管理・Runtime活動をMCPへ接続し、正常、拒否、競合、欠測、取消と終了後状態を確認する。本番Launcherの依存注入も閉じる。現行`crdd-cros-server.ts`と設定型は両能力を注入しておらず、optional Portとfixture成功を本番成立へ読み替えない。
3. WorkbenchのREST利用四入口をMCPへ切替え、既存Topic／MeetingとBrowser APIを維持する。
4. 代替接続・試験・設定・公開入口・Symbolを照合した後、CROS REST／Shared Host／Gatewayを撤去する。旧通信実装を互換Readerとして残さず、導入側移行はフロントAI手順へ接続する。

REST試験は機械的に削除せず、認可、管理、ページング、結果検証、取消・終了のOracleを新Ownerの試験へ対応付ける。未対応Capabilityがある間は旧処理を置換済みと表示しない。Docker／Coordinator／Orchestrator大改修は前倒ししない。

### 段階6の型所有者分離 — 着手前照合

後続の共通認可接続は、既存認証関数を置換せず、HTTPとMCPに重複する認証後のSnapshot／Session／許可Repository集合だけをCROS `access/resolve.ts`へ集約する。着手前確認で認証順序とSession失敗の入口別処置を照合した。Contentでは各認証一回・Snapshot一回、ProfileとContent POSTではSnapshot零回を維持する。Reader故障を認証失敗へ丸めず、管理権限だけでContentを開示しない。Rootへ新関数一つを意図的に公開するが、新Tool、Store、Authority、Frameworkは追加しない。既存HTTP／MCP回帰、観測回数と失敗反例、実装・品質独立レビューで確認する。検証完了は未確認である。

共通化候補のCROS33件とMCP51件は成功したが、独立レビューは両観点で同じMinor1件を検出した。Readerを裸で渡すと従来のReceiverを失うため、HTTP二箇所・MCP一箇所だけを元入力への呼出しclosureへ訂正する。全結果統合と是正方針照合後、両入口の既存試験へ通常method Readerと観測回数のOracleを追加した。認証順序、失敗結果、公開集合、Authorityは変更せず、修正後候補で回帰と再レビューを行う。

是正後の固定候補はCROS33件、MCP51件、Workbench33件と各静的確認・Workbench BuildがPass、Fail／Skip／取消0。MCPに存在しないformat scriptを指定した初回確認は失敗して試験へ到達せず、既存Biomeで対象二Fileを整形して静的確認から再実行した。九Pathの限定再レビューは実装・品質とも指摘0。認証後Scopeの共通Owner接続を限定完了とし、段階6〜8のTool登録・本番接続・旧REST撤去は継続する。実Provider／Docker／署名操作は行っていない。

基準Commitは`3b3827a5`。既存HTTP内の四公開型だけを移す。認可Snapshotは`access/types.ts`、Runtime活動のEvent／観測／Readerは詳細設計§6.1と同じ`activity/types.ts`が所有する。Portfolioを扱う`federation`へ活動型を混在させない。HTTP lifecycle Handle、実関数、Validator、認可分岐、公開Symbol集合と型shapeは維持する。設定ReaderとRoot exportを同時に切替え、MCP Resolver／Shared Host／非開示試験、WorkbenchとCROS試験は既存Root参照で追従する。代表登録は`cros.public-api`と`cros.remote-transport`からの型依存閉包として照合し、毎Fileの新登録や新中継は作らない。

着手前の読取り専用確認で型Ownerと全直接利用側を照合した。新しい状態・資源・Authority・Effect・取消経路は導入せず、既存HTTP回帰とCROS／MCP／Workbench静的確認を使う。公開型本文一致・公開集合保持・代表登録到達を確認し、固定差分を独立レビューへ渡す。新MCP接続・本番Launcher・旧REST撤去は後続に保持し、今回の型分離を段階6全体の完成としない。準拠基準・外部公開訴求を変更しないため、準拠監査・市場探索・署名実E2Eは今回非該当である。

移管前CROS回帰は33件Pass。移管後は四型の宣言本文とRoot公開80 Symbolの集合一致、CROS／MCP／Workbenchの書式・型・Lint成功を確認した。初回静的確認の未使用importを除去後、CROS全回帰は32件Pass・1件Failとなったが、失敗は既存Config試験の準備中の`git init`異常終了であり、Config操作の拒否Oracleへ到達していない。同じ固定Sourceの局所再実行は1件Pass。これを無言で全Passへ補正せず、全回帰を再確認する。新型FileはRootの明示exportとHTTPのtype importへ直接接続し、代表Symbolから未到達の型として扱わない。

同じ固定Sourceでの最終回帰はCROS全33件、MCP全51件、Workbench全33件がPass、Fail／Skip／取消0で終了した。各静的確認とWorkbench BuildもPass。最初の試験準備中の異常終了は原因未確定のまま保持し、最終成功をその原因解消の証明にはしない。固定七Pathの実装・品質の独立レビューは双方指摘0。型所有者分離を限定完了とし、新MCP Tool、本番Launcher接続、旧REST撤去および段階6全体の完成は主張しない。

### 基準回帰の確認

- CROS Packageの静的確認と回帰33件はPass、Skip／Fail 0。これは現行RESTを含む基準結果であり、新MCP接続の結果ではない。
- MCP Packageは初回50件中1件が旧改名Path二箇所のENOENTで失敗した。試験の参照を現行`transport/stdio.ts`／`transport/streamable-http.ts`へ訂正後、静的確認と50件がPass、Skip／Fail 0。ProtocolがError envelopeを所有するassertionと対象数は不変である。
- 上記実行対象はHEAD `d25f4851`とMCP試験の二Path訂正。実行結果はTool出力から確認し、再実行は各Packageの`npm test`を使用する。外部Provider・Docker・認証・署名操作は行っていない。巨大ログの複製は作らない。
- Workbenchの基準回帰は33件中31件Pass・2件Fail。Node依存閉包の旧入口Pathと、現行Vite Build結果に未追従の追跡Bundleを検出した。入口・Server・Browser参照を現行配置へ訂正し、Bundleを再生成した。再BuildのSHA-256は`ffcecf344cbc6559b07e0a94a1d5615c08b34208fe0d4d865b7e5f2609f0d3ef`で一致。静的確認・対象二試験に続き、是正後の全回帰33件もPass、Skip／Fail 0。Browser実操作・Visual評価・実Provider成立を示す結果ではない。
- MCP試験・Workbench依存試験・生成Bundle・本節の固定差分を限定独立レビューし、指摘0。試験参照更新の意味と保持条件、Bundle Hash／Index Blobの一致を確認した。独立確認者はBuild・試験を再実行しておらず、実行結果は親のTool出力から確認した。Repository内の専用試験一時Rootは終了後にcacheだけであることを確認して回収する。

Related:
- [現行の責務対応と第一段階結果](Evidence/261007_develop-responsibility-mapping.md)
- [Orchestrator詳細設計](../../../06_Architecture/Details/orchestrator/01_Architecture.md)
- [コーディング規約](../../../06_Architecture/99_Coding_Standards.md)
- [変更管理](../../../19_Maintenance.md)

## 10. 段階1〜5の全体照合と是正対象 — 2026-10-09

### Profile管理のMCP接続 — 着手前照合

基準は`b5733c6e`。既存CROS RESTの管理権限判定と操作別Mutation検査をCROS `profile/administration.ts`へ移し、AI Adapterの既存Catalog管理・保存・改訂競合は再利用する。MCPの一覧・作成・更新・削除を同時登録し、現在systemAdminでない主体へ管理ToolとCatalogを開示しない。管理RequestはContent Exposureを読まないよう、既存ResolverのContent Scopeを必要な操作で一回だけ解決する。既存Profileの構造ValidatorはAI Adapterから再利用できる入口にし、MCPでRole／Model語彙を別定義しない。未知入力拒否、非管理dispatch零回、改訂競合、未確認削除、保存後故障・取消の非再送を確認する。同期採用済み変更は応答取消で巻き戻さない。RESTと本番Launcher／Workbenchの代替接続・撤去は後続であり、新Store・DTO・Lock・Recoveryを作らない。関連Package回帰と実装・品質の独立レビューを行う。実Provider・Docker・署名はこの接続に不要で実行しない。

Profile四ToolとCROSの認可接続を実装し、管理者／Developerの一覧全件対照、非管理Catalog読取り0、Content読取り0、正常CRUD、期待改訂競合、未確認削除、未知入力、事前取消と採用後故障／取消の非再Mutationを確認した。初回試験はメモリRegistryの初期改訂1を0と誤認して失敗したため試験入力を訂正した。AI Adapter既存試験は新公開SymbolとDomain共通Validator依存のfixture追従漏れ2件を検出し、公開集合とfixtureの検証済み依存先だけを同期した。旧Storeの初期改訂0やRuntime契約は変更していない。

独立レビューは結果の相関不足Major1と、Helper Trace・非管理読取りの否定観測・Resolver HeaderのMinor3を返した。全結果と是正方針を両観点へ統合し、AI Adapterの既存Profile管理責務で操作／理由／改訂／対象Profileを共同検査する。成功は期待改訂+1とexact対象反映または削除後不存在、拒否は操作・理由固有の存在条件と改訂を満たす場合だけ公開する。Proxy／accessor非実行と所有済みCatalogを維持し、追加snapshot／executeは呼ばない。矛盾した成功・拒否、元値の後続変更を反証した。MCP全56件、AI Adapter全29件、CROS全33件と書式・型・LintはPass、Fail／Skip／取消0。Workbench全33件とBuildは相関是正前候補でPassしており、是正後の利用側回帰と独立再レビューは未完了である。本番Launcher・耐久Store Remote接続・失効全母集合・入口比較・旧REST撤去はこの局所結果で閉じない。

是正後Workbench全33件、Build・書式・型・LintもPass、Fail／Skip／取消0で終了した。実装再レビュー指摘0と品質Minor1（拒否反例二つの原因混在）を統合し、二Snapshotの改訂だけを一致させ、操作不一致と対象不存在を独立して反証した。Source・正常Case・QA IDは不変。最終静的確認、局所3件とMCP全56件はPass、両観点の限定再確認も指摘0。Profile管理のMCP Adapter接続を限定完了とする。CROS／MCPの公開Launcher構成、WorkbenchのRemote切替、Credential非秘密管理、設定分離と旧REST／Shared Host撤去は未完了である。巨大実行ログは保存せず、再実行可能なPackage試験と対象差分へ根拠を集約する。

### 非秘密Credential管理のMCP接続 — 着手前照合

この着手前案は後続の人間判断（§11）により停止した。Source編集・試験追加は未実施であり、旧CROS Owner前提の確認を移管後の実装許可・完成根拠へ流用しない。三操作の保持義務は新Owner計画へ引き継ぐ。

基準Commitは`2f398f0a`。変更分類は承認済み二Surface再編内の既存能力接続である。MCP詳細設計§3.3の一覧・Grant変更・失効を既存CROS関数へ一回だけ直接委譲する。Request Resolverが現在Credentialを認証し、systemAdminの場合だけ三Toolを公開する。管理操作はContent Exposureを読まず、Profile名から管理権限を生成しない。発行・rotation・Host回復、Registry保存形式、Content認可、旧REST、公開Launcherは変更しない。追加State／Lock／任意結果Portや結果防御Frameworkは作らない。

正常管理、非管理者非開示、自己demote／失効の次Request反映、未知対象、不正field／型／Proxy／accessor、publish競合・例外、処置前取消と採用後取消を確認する。取消・応答故障で保存を巻き戻さず、追加inspect・publish・自動再試行を行わない。発火例は現在systemAdmin、非発火例は有効Developer、境界例は自己権限変更、判定不能例はRegistry例外であり、それぞれ三操作公開、Tool非公開、次Request反映、内部故障非開示へ閉じる。

着手前の実装・品質確認では、既存Owner再利用と三Toolの閉じた入力へ整合を確認する。Credential操作全体はQA-000007の`RFD-ST-003`、局所HTTP認可接続は`RFD-IT-013`、入力・故障・取消はQA-000009の`EST-IT-002`へ対応する。IT結果をST全体の成立へ流用せず、Local／Remote本番Launcher、耐久Store、Workbench移管と秘密発行は未完了として維持する。固定差分の実装・品質の独立レビューと直接文書伝播を行い、準拠基準・公開訴求・Release判断は変更しないため準拠監査・市場探索・署名実E2Eは行わない。

### Runtime活動の共通OwnerとMCP接続 — 着手前照合

次の固定候補は、既存HTTPの活動検査をCROS `activity/validate.ts`へ、許可Project選択・Reader呼出し・結果検査を`activity/read.ts`へ移す。新MCP `crdd.get_runtime_activity`は設計済みprojectId／cursor／limit契約だけを搬送し、一覧とRoutingを同時接続する。現在Requestで解決した許可集合だけをReaderへ渡し、非許可はReader零回、Reader不在・故障・不正結果を空成功にしない。既存Readerは取消Signalを持たないためPromise競争を追加せず、取消前は呼ばず、開始後はReader完了をjoinしてから取消応答へ戻す。Reader自体の中断・実Provider取消を保証しない。新State／Frameworkを作らず、旧REST・本番Launcher・Workbench切替は代替接続完了まで維持する。Source境界の既存回帰、新Toolの入力／結果／非開示／待機取消反例と独立レビューで確認する。

活動Toolの初回回帰は51件Pass・2件Failで、任意cursor／limitを必須扱いした入力Snapshotを検出した。既存plain-data取得と明示した許可field検査へ是正し、試験コードの型指摘も訂正した。独立レビューはReader由来Objectの検査後変更・Proxyによる余剰情報透過と、取消joinを入力拒否義務へ混在させた問題を検出した。CROSに新Frameworkを作らず既存Domain Modelのplain-data SnapshotとOrchestratorのProjection copyを利用し、所有済みの固定結果だけを公開する。Proxy／accessor非実行、primitive語彙、nested余剰値、元Object変更の非透過を反証する。取消joinは導出元付き`EST-IT-014`へ分離し、HeaderとSymbolへ接続した。初回Lintの非null断言一件と、再レビューの表空行・Event Header二点も限定是正した。

最終Runtime候補のCROS全33件、MCP全53件、Workbench全33件と各書式・型・Lint、Workbench BuildはPass、Fail／Skip／取消0。両独立再レビューは指摘0で、元結果の暗黙文字列化と検査後透過を許容していない。全体Checkerは既知と同じ3,038件で未合格であり、この局所成功で解消しない。公開Launcher、Workbench本番MCP接続、Profile管理四Tool、旧REST撤去、実Reader取消・公開Process終端と実Providerは未完了である。実Provider、Docker起動、秘密鍵・署名操作は行っていない。

限定移管と局所回帰は成立しているが、Package全体の完了は未確定である。二つの読取り専用確認を統合し、以下を全数追跡する。CROSの採否待ちを理由に独立した是正を停止せず、後半の実行系大改修も前倒ししない。

| 対象 | 不足と最小処置 | 保持する条件・確認方法 | 現在状態 |
|---|---|---|---|
| Domain ModelのTopic／Meeting保存 | rename後のLock解放失敗を上位の入力不正・Effect 0へ丸める経路を除く。保存Ownerから一次失敗とcleanup結果を分離して搬送する | 正常CRUD・Revision・Relationは不変。rename後close／unlink故障と実ファイル・公開結果の相関を局所試験する。汎用Recovery Frameworkを追加しない | 一次失敗／cleanup分離、MCP／Workbenchの誤変換、部分write・一回読戻し・静的親link拒否は局所是正済み。実Process競合等の保存全体保証は次行で未完了を維持 |
| Topic／Meetingの保存境界 | 親Directoryのlink経由を拒否し、保存確定・読戻しの観測を接続する | Root外書込み禁止、保存形式・ID・認可Ownerは不変。親link・途中置換・読戻し失敗・実Process競合を反証する | 通常保存後の一回読戻し、部分write失敗、静的親link拒否と取得順固定の協調Writer実Process競合は確認済み。非協調Processの親差替え防止は判断待ち。電源断耐久性は人間判断により今回対象外 |
| Version Control公開入口 | 跨Packageの実体Path importを既存Root exportへ接続し、閉包試験へ禁止例を追加する | 新API・中継Fileは作らない。署名閉包のPath文字列とimportを区別する | 既知Consumer集合の接続・閉包確認は完了。固定47件と独立レビュー指摘0。Coordinator配布Suiteの試験側旧Path追従も133件・独立レビュー指摘0で確認済み。Coordinator全Package完成ではない |
| 現在の設計・Header | Domainの廃止済み入口、AI Adapterの旧配置参照、純粋計画のEffect記載、EI WriterのEffect・排他記載を実体へ合わせる | 関数本文・公開結果・Authorityは不変。書式・型・Lintと限定独立確認を行う | 訂正済み。限定独立確認は指摘0 |
| AI Adapter純粋試験3Suite | Codex／Claudeの構造化結果とBilling試験を実装Ownerへ移し、Symbol／Catalog／回帰入口を接続する | 14 caseの拒否例・Oracleを保持する。Coordinator結合試験は一括移管しない | 移管済み。14 case本文・Oracle不変、Package回帰27件と関連Consumer34件を確認 |
| 上記3SuiteのQA対応 | 現在のRCM-UT-016／AIT-UT-005はProvider結果／Billingの検証意味と一致しない。Canonicalから該当義務を再照合する | 物理移動を理由にQAの意味を改変しない。正しいLocal Itemへの接続を確定してから全体Passを評価する | ERB-UT-032／033へ訂正。移管と追加容量試験の限定独立レビューは指摘0。Codexの16KiB実入力境界を観測し、28件の回帰はPass |
| Topic／Meeting操作試験のQA対応 | Reader専用のCPR-IT-008へ更新試験が混在していた。保存操作はCPR-IT-010、保存例外はCPR-IT-011、公開故障応答はCPR-IT-012へ分離する | Readerの正本Effect 0は維持し、詳細設計§9.1・SPEC-000013、Suite Header、SymbolとCatalogを接続する | QA接続を訂正し、両種別のRepository／公開CRUDと協調Writer競合を確認済み。公開面の全操作母集合、Remote故障・投影再読取り・実OS cleanup全体の未評価は保持する |
| Source／Symbol閉包 | 単純Path照合の候補を、代表入口への集約登録と個別責務の方針へ照合する | Path差を直ちに欠落と断定しない。実体・公開helperの対応で判定する | 現行TS候補10FileとJSON設定1Fileを再集計し、全候補に代表実装・内部補助・配布設定の処置を照合。下記対応を参照。個別条件の試験網羅や全Package完成を意味しない |

実OS fixture、Coverage計測、新Build／署名閉包、実Provider・Docker、ST／UATと人間受入は未評価として後続の実境界確認へ接続する。局所回帰や安全な拒否を上位保証の完成へ昇格しない。過去Evidenceは当時の条件のまま保持する。

今回の参照・Header訂正後、Domain Model 106件、Execution Intelligence 82件、AI Adapter 13件、Workbench Server 33件、Version ControlのConsumer閉包12件は全件Pass、Skip／Fail 0。五Packageの書式・型・LintはPass。既知Consumer集合へ実利用側2件を追加し、厳密集合比較は維持した。限定独立レビューは指摘0。これらは上表の未是正の保存保証・QA対応を満たす根拠ではない。実Provider依頼、Docker操作、認証・署名・Release操作は行っていない。

### 保存例外の局所是正と全体Checker再確認

MCP公開応答の次段階では、明示Schema拒否と保存境界の内部故障を分離する。ID書式・Revision・limit・states件数の公開Schemaを前検査へ同期し、Query／CursorはDomainの既知一覧拒否3理由だけをlist呼出しに限定して対応付ける。書込みで同じ理由の例外が出ても内部故障とし、例外本文・秘密値・Pathを公開しない。既存MCP操作3件はReader項目008から010へ、新故障試験は012へ接続する。Workbench、Remote失敗、投影再読取りと実OS cleanupは未評価として後続へ保持する。

独立レビューで参照IDと不正Markdownの拒否が内部故障へ変わる反例を確認し、固定参照ID Schemaと既存Domain Parserの配送前検証を追加した。owner／none参照と正常結果は不変。QA導出表・条件表、File／共用Helperの012接続も同期する。MCP回帰51件と書式・型・LintはPass、最終追加反例の局所4件もPass。保存後の例外は実更新済みRevisionを保持した注入で検証しており、実OS故障・rollback・cleanupの保証へ昇格しない。

是正後のSource・品質／文書の独立確認は残指摘0。最終Header更新後も書式・型・Lintと局所4件はPass。全体Checkerは3025件で未合格（前回3026件から今回SuiteのCatalog Owner不一致1件を解消）。変更したMCP詳細設計、QA定義、試験Pathそのものの新指摘はないが、CHG本文から旧MCP試験Pathへの既知broken-linkは残る。未完了のWorkbench応答・保存Owner保証・横断移管整合を後続で閉じる。

### Workbenchの保存故障応答

入力評価後、Local操作／Remote要求の直前にだけ配送段階を記録する。前段拒否は既存400、配送以降の内部故障は固定500へ分離し、正常blocked結果の303は維持する。自己生成の空Topic保存先を通常fileへ変え、入力不正と保存開始時故障を対比する。通常Topic CRUDへ改訂競合・削除確認の反例も接続する。Listenerの終了は新しいTCP接続で確認し、HTTP keep-aliveの既存接続切断とは分ける。試験Root回収は観測assertionが失敗してもfinallyで実行する。

この局所処置はRemote故障、Workbench保存後故障・投影再読取り、実OS保存確定・cleanup全体の完成ではない。Workbench全回帰33件、局所2件、書式・型・LintはPass。Sourceと品質／文書の独立レビューは指摘0。全体Checkerは3024件で未合格であり、今回SuiteのCatalog Owner不一致1件を解消した。Workbenchの別Suiteに残る既知Owner不一致3件は未是正として区別する。実Provider、Docker、署名、実Browser操作の検証根拠にはしない。

### Topic／Meeting保存Ownerの失敗分離

既存同期Lockと短命Fileの形式を維持し、一次処理とcleanupの失敗を標準AggregateErrorで分離する。close失敗でもunlinkを試み、rename失敗後の短命Fileはexact unlinkのENOENTだけを不存在として扱う。新Recovery／Kernel Lock Frameworkは導入しない。Repository SuiteをReader用008から正常010・故障011へ訂正し、旧Reader Oracleは維持する。独立レビュー2指摘は試験所属RepositoryへのRoot固定と分析の失敗構造記述へ是正し、再レビューは両方指摘0。訂正前の全回帰108件と、訂正後の局所3件・書式・型・LintのPassを区別する。最終全体Checkerは3024件で未合格、今回の変更Pathへの指摘0。親link、読戻し、write自体の部分失敗、耐久性、実Process競合は未完了であり、保存全体完成とは表示しない。注入closeは実Handleを閉じた後の失敗報告で、実OS close失敗時のHandle回収を証明しない。実Provider・Docker・認証・署名・公開操作は行っていない。

### 改名後の試験Owner追従

MCP 9件・Workbench 3件のCatalog Ownerだけを現行Packageへ訂正した。全14登録についてSymbol所属、実Pathと実File存在を照合し、JSON解析・差分確認はPass、限定独立確認は指摘0。ID、Oracle、実行環境と必須性は不変で、実試験やCROS REST／Sharedの廃止判断を代替しない。

### 保存保証の未決判断

2026-10-09の人間判断: Topic／Meetingの保存完了は通常の保存＋内容・ID・改訂の読戻し一致までとする。電源断耐久性は今回の保証へ含めない。非協調Processの親Directory差替え防止の範囲は別の判断待ちであり、この決定から免除しない。

通常の保存完了＋読戻し確認の範囲は上記判断で確定した。静的link拒否＋協調Writer競合と非協調Processの親Directory差替え防止を分け、後者の必要範囲のみ人間へ確認中である。既存Path部品の事前／事後確認だけで競合置換防止・Root外Effect 0を主張しない。未回答を高い保証の採用や保証の免除へ読み替えず、独立した移管・試験整合を継続する。

Topic昇格・Meeting Outcome処置のcatchを純粋Markdown変換だけへ限定した。既存Repository契約へ更新前／実更新後の例外を注入し、両公開操作から同じ例外が伝播すること、実更新後のRevisionと状態を保持することを確認した。不正変換はblocked・既存理由・Effect 0と更新0回を別に確認した。新fault試験はVCS Rootを検証し、Repository-local `.crdd/tests`の非link親と自己生成領域だけを使用する。

固定候補のDomain Model回帰107件、書式・型・LintはPass。実装・品質／文書の二つの独立レビューは是正後指摘0。QAの010は部分検証であり、保存Ownerの一次失敗／cleanup、読戻し、親link、MCP／Workbenchの内部故障応答は未完了のまま保持する。

全体Checkerは未合格。2026-10-09の実行では3026件（broken-link 3002、broken-anchor 5、Catalog Owner不一致14、verifies対象欠落3、Project Context契約1、UI／SPEC Detail下流Coverage 1）を検出した。今回更新したDomain詳細設計、QA-000005、Detail分析、Domain Symbolと操作試験Pathへの指摘は0だが、これを全体完成の根拠にはしない。現在文書・Registryの移管不整合と、変更禁止の過去Evidenceに残る当時の参照を区別して後続処置を決める。

### AI Adapter純粋試験と品質接続の移管

Claude結果9件、Codex結果3件、課金方針2件を実装Ownerの試験Directoryへ移管した。コメント・import移設を除く本文・Oracleは基準Commit `5c33ba70`と完全一致し、Runtime Source、安定Symbol／Catalog IDと過去Evidenceは変更していない。ARCH-000004／000015の結果解釈からERB-UT-032、ARCH-000010と既存Subscription方針からERB-UT-033へ導出し、旧Domain Outcome／Trust軸への誤接続を解消した。

独立レビュー3指摘はcoverage入口の旧Path、15 Headerの外部境界表記、容量契約値と実拒否観測の混同を是正し、再レビューは両観点とも指摘0。AI Adapterの書式・型・Lintと27件、Coordinator関連Consumerの限定strict型・書式・Lintと34件はPass、Skip／Fail 0。Coordinator全体checkは既存Checker試験の整形1件で停止、全体型検査は既知Recovery二Fileの18件で未合格。実Provider・Docker・認証・署名・費用・取消／cleanup・16KiB実逸脱拒否の成立をこの移管結果から主張しない。coverage入口の6試験Pathは実在を確認し、未実行の他試験をPassへ計上しない。

### Sourceと代表Symbolの候補照合

四Packageの`src/`とManifest Pathを再比較し、TS候補10FileとJSON設定1Fileを確認した。以前の8件を固定母集団にせず、現行実体を基準に再集計した。各HeaderのARCH、公開入口、内部importとTestの`verifies`を読取り専用で照合し、次の処置を確定した。個別File登録を増やすだけの変更は行わない。

| Package／候補Path | 現在の登録・担当範囲 | 処置 |
|---|---|---|
| Version Control `repository/revision.ts` | `version-control.public-api`のRoot明示exportと登録済みGit Revision Adapterへ接続 | Revision観測・Format検査を代表範囲として維持 |
| Domain Model `artifact/graph.ts`、`artifact/validate-schema.ts`、`artifact/parse-markdown.ts` | `crdd-domain-library.artifact-entry`とARCH-000008の`crdd-domain-library.source.src.index`。公開境界試験は双方を参照し実操作を検証 | 各実体をRootの代表範囲として維持 |
| Domain Model `reality-traceability/discover.ts` | `crdd-domain-library.reality-traceability-entry`からRoot公開。公開境界試験へ接続 | Discoveryを代表範囲として維持 |
| Domain Model `reality-traceability/issue.ts`、`reality-traceability/annotations.ts` | 登録済みGraph／Manifest検査とDiscoveryが使用する非公開の共通処理 | 内部補助として代表登録を維持 |
| Execution Intelligence `input/plain-data-snapshot.ts` | 登録済みEvent・評価・Store・投影・時刻由来分類が使用する入力防御 | 内部補助として維持。新公開Symbolは作らない |
| AI Adapter `profile/types.ts` | 登録済みProfile実行照合・Eligibilityが利用し、Rootが実行Identity型を公開 | 型契約の代表範囲として維持 |
| AI Adapter `codex/advice-distribution.ts` | Root公開と登録済み助言Commandが固定配布Identity・初期化条件を利用 | Command代表の担当範囲として維持 |
| AI Adapter `catalog/default-ai-profile-catalog.json` | 登録済みCatalog Resolverが静的import。詳細設計§5の配布設定・Schema・署名閉包対象 | TS Sourceではなく配布設定として維持 |

この照合で個別登録の実欠落は検出していない。到達・担当範囲の確認を、全正常・拒否・故障条件の試験済みや配布・署名の実検証済みへ昇格しない。安定ID、Source、公開集合と正方向Relationは変更していない。

### Codex容量境界の実入力確認

既存normalizerは変更せず、単一exact JSONへ有効なASCII空白を加えた16,383／16,384／16,385 bytesの入力を渡す。上限以下の受理と超過拒否、正規化値、生出力非公開を確認した。追加後のAI Adapter全28件と書式・型・LintはPass、Skip／Fail 0。移管14 Caseの当時の限界は保持し、追加試験を新しい成立根拠として区別する。Claudeの容量契約、実Process出力制限、費用・取消・cleanupの成立には流用しない。

Source対応表と容量試験・正本追従の固定5Fileは独立した二観点の確認で指摘0。全体Checkerは3,041件で未合格（broken-link 3,032、broken-anchor 4、Project Context契約1、verifies対象欠落3、UI／SPEC Detail下流Coverage 1）。今回の更新5Pathへの指摘は0で、過去CHGの旧試験Path参照は当時のEvidenceとして改名しない。verifies欠落3件はCoordinatorの旧Runtime Data Resolver参照であり、現在のDomain保存責務への対応を別途照合する。

### 通常保存後の読戻し確認

登録・更新のrename後、既存Record Lockを保持したまま保存先を一回読み直す。同じ読取りから得たUTF-8 bytes、ID、改訂とProject IDを保存予定値へ照合し、欠落・読取り失敗・解析失敗・不一致は完了として返さない。保存済み正本の自動rollback、読戻し再試行、新しいLock／Recoveryは追加しない。人間が採用した通常保存＋読戻しの範囲に限定し、電源断耐久性は保証しない。

Topic／Meetingと登録／更新の4経路について、正常と9故障分類の40組合せを一つの契約試験へ接続した。実bytes・改訂の保持、一次失敗とcleanup併発、Lock保持、読取り回数、不正UTF-8とmock復元・試験Root回収を確認する。既存close故障注入は所有Lock descriptorだけへ限定し、読戻しで使うFilesystem内部descriptorと混同しない。Domain Model全109件、MCP全51件、Workbench全33件と各Packageの書式・型・LintはPass、Skip／Fail 0。これは実Provider・Docker・実Browser・実OS故障や保存全体保証の完成根拠ではない。

独立レビューのSource指摘0と品質Minor2件を統合し、Meeting helperの正常／異常TraceとQA011の登録・更新対象範囲だけを訂正した。実装・40組合せ・assertion・ID・Oracleは不変で、両観点の限定再レビューは指摘0。訂正後の書式・型・Lintと局所4CaseもPass。親link、write自体の部分失敗、実Process競合と非協調Processの親差替え範囲は引き続き未完了として扱う。

### 旧Runtime Data検証参照の是正

Coordinatorの三Suiteに残る旧Resolver参照を、実際の試験本文とOracleに基づいて処置する。鍵生成Suiteは保存領域をfixture準備に使うだけで保存保証を検証しないため、当該関係を削除する。Orchestrator Compositionと開発Provider測定Suiteは、実生成したDomainの停止Errorから理由・Effect・cleanup・retry・回復参照を保持する公開投影を検証するため、`domain-model.runtime-area-result`へ接続する。Reader／Writerへ機械置換せず、Source、試験本文、QA ID、他の関係と過去Evidenceは変更しない。静的確認と独立レビューが完了するまで、是正済みの検証結果とは扱わない。

JSON解析・差分確認と旧参照0／新参照2の照合はPass。固定差分の実装・品質の独立レビューは双方指摘0。全体Checkerは3,038件で未合格だが、検証参照対象の欠落3件は解消した。残る内訳はbroken-link 3,032、broken-anchor 4、Project Context契約1、UI／SPEC Detail下流Coverage 1。試験本文とRuntimeは不変で、このMetadata是正のための実Provider・鍵生成・署名試験は実行していない。

### 保存途中の部分書込み失敗

短命Fileを排他的openで所有確定してから同じdescriptorへ書込み、close確認後だけrenameする。open失敗は他者Fileに触れず、write・close・rename失敗では所有する短命Fileだけを回収する。一次失敗、undefined例外、close／unlink併発を既存AggregateErrorへ保持し、新Recovery・Lock・再試行は追加しない。24組合せの反証を既存QA011へ接続する。親link、実Process競合、実OS close失敗と電源断耐久性はこの是正の成立根拠に含めない。実測・独立レビューは未完了である。

実測結果: Domain Modelの書式・型・Lintと全110件、MCPの同静的確認と全51件、WorkbenchのBuild・同静的確認と全33件はPass、Skip／Fail 0。最初の追加試験はEEXIST注入の内部open再帰で失敗したため、他者Fileの準備を注入外のdescriptorで行うよう訂正し、静的確認から全回帰を再実行した。Runtimeの不足を注入の修正で隠したものではない。独立Sourceレビュー指摘0と品質Minor1を統合し、Detail分析表への直接伝播だけを是正した。両観点の再確認は指摘0。既存の40読戻し組合せと正常・rename故障Oracleは維持した。今回の処置で保存全体や1〜8全体を完了とは扱わない。

### 静的な保存先親linkの拒否

既存Adapter内のDirectory観測をCRUD・一覧・CHG参照へ接続し、recursive mkdirを一階層作成へ置換する。Root・種別親・Record親のlink／junction・通常Fileを拒否し、ENOENTだけをmissingとする。Lock・短命File・rename・削除・cleanupの前に該当chainを確認し、新Lock・Recovery・公開Capabilityは作らない。観測直後の非協調Process置換はこの変更では防止せず、必要範囲の人間判断待ちを維持する。固定候補の回帰・独立確認は未完了である。

1〜5の再照合では、Version ControlのRoot公開入口への全Consumer追従が実未完了と判明した。代表3件の是正を全Consumer完成へ拡張せず、この親link処置後に実importと配布閉包のPath文字列を分類して全利用側を接続する。Domainの協調Writer実Process競合も残る。Execution IntelligenceとAI Adapterの追加必須Source是正は今回特定しておらず、Platformの実OS専用fixture・新Build／署名は後半の実境界に対応付ける。CROS Packageの採否待ちは段階6実装の停止条件であり、他の独立した残件を止める理由にはしない。

固定候補の実測結果: Domain Model全112件、MCP全51件、Workbench全33件と各Packageの書式・型・Lint、Workbench BuildはPass、Fail／Skip 0。実装と品質の独立レビューは双方指摘0。初回局所試験では既存published故障試験のcause不存在assertionが一度失敗したが、以降の局所・全回帰では再現せず、原因未確定として保持する。新fixtureのDirectory改名後junction作成はWindowsでEBUSYとなったため、初期状態から静的linkを置くfixtureへ訂正した。Productionの再試行やOracle緩和は行っていない。この結果は非協調Processの差替え防止、実OS close故障、電源断耐久性、実Provider／Docker／署名の根拠ではない。

### Version Control全利用側の公開入口接続 — 着手前照合

変更分類は既存公開契約への内部接続是正とする。基準はCommit `6ace24bb`。読取り専用確認で、本番／scriptsの40FileとTemplate入口1Fileの実importは既存Root exportだけへ切替可能と確認した。関数本文、Git引数・結果、公開Symbol集合、鍵・署名Authority、過去Evidenceは変更しない。署名scriptの二SymbolをRootへ移すため、保護import検査の対応表だけを同時追従する。実行primitive・実体Sourceの観測Path文字列は別責務であり置換しない。

試験側のdeep importは15File。Root非公開Symbolを直接検証する三Suiteは内部Adapter試験として維持し、残る公開契約の利用をRootへ接続する。新APIや公開中継は作らない。Consumer閉包試験はPackage外の実importを全数走査し、deep import、動的import、Namespace、再exportを未使用に畳まない反例へ補強する。用途別集合の厳密照合は維持する。Rootの静的依存閉包拡大は保護経路の静的契約と影響Packageの型・回帰で確認し、実署名・配布成立は未評価として分ける。

必須確認は実装と品質／伝播の独立レビュー、Consumer閉包・保護署名経路の契約試験、影響Packageの静的確認と関連回帰。規則自体・準拠基準・公開Surfaceを変更しないため、この接続是正に新しい準拠監査や実Provider／Docker／署名は要求しない。新しい公開APIが必要、関数本文や署名保証を変更する必要が判明した場合は実装を止め再整理する。

本番／scripts／Templateの41Fileと公開契約を使う12試験FileをRootへ接続した。初回独立レビューで検出した生成子Processの6参照とOrchestrator mockの2参照も接続した。閉包Helperは局所トークン走査でコメント・文字列と宣言を区別し、同一行、コメント付き宣言、backtickのliteral動的importも拒否する。任意計算specifierや任意生成Sourceの完全解決は保証しない。既知子Process六経路とmockの旧参照は既存Caseで個別照合し、内部Adapter三Suiteの非公開Symbolと実体観測Pathは保持した。

固定候補のVersion Control全47件と書式・型・LintはPass。入口変更後のExecution Intelligence全82件、AI Adapter全28件、Visual Preview全10件、Workbench全33件と各静的確認、Workbench BuildはPass。Orchestratorの静的確認と回復接続mockの1件もPass。Coordinatorの上位受理Reader試験は、初回のmodule mock用起動flag不足と、以前の移管で残った廃止済みStorage／Task二Pathを訂正して1件Pass。Host Windows保存scenarioはこの実行から除外しており、六子Process経路の実環境成立とは扱わない。

Coordinator全体checkは既知Checker整形1件で停止し、型検査も既知Recovery二Fileの18件で未合格。LintはExit 0（参考情報54件）。署名保護flowの局所三件は1件Pass・2件Failで、`compilePlatformProvisionerManifestPayloadCandidate`の保護import対応不足を検出した。現在入力と、基準版のVC二importだけ新表へ正規化した比較入力は同じ理由で停止する。この比較は基準版全体の実試験ではなく、今回の入口変更以外にも不足が存在する切り分けである。既存署名保証を緩めず、未解消として後続へ保持する。初回レビュー結果を最終版へ流用せず、修正後の独立再レビューは未完了とする。実Provider、Docker操作、秘密鍵・実署名・公開は行っていない。

57Fileの再レビューは品質指摘0、実装側にテンプレート式内literal動的importの見落とし1件が残った。両観点で是正方針を照合し、閉包Helperだけをテンプレート本文と式へ分けた局所走査に変更した。nested式・object式内のimport拒否と、本文・エスケープ・式内文字列／コメントの非発火を既存Caseへ追加する。正規表現本文のbacktickを誤認した初回回帰は45件Pass・2件Failであり、正規表現literalと除算の対照を追加して再実行する。Source全構文を解決する汎用parserではなく、任意計算specifier・任意生成Sourceの保証は追加しない。Runtime、公開集合、利用側Path、保護map、QA IDは不変。静的確認と最終回帰・修正後再レビューの結果は完了後に別記する。

是正後のVersion Controlは書式・型・Lintと全47件Pass、Fail／Skip 0。新しい固定候補の独立再レビューへ渡す。他Packageの結果は各入力が不変の範囲に限って保持し、Coordinator全体静的・署名経路・Host Windows六経路の残件は解消扱いにしない。

固定57Fileの最終独立再レビューは実装・品質とも指摘0。Version Control公開入口への今回の利用側接続是正は限定範囲で完了とする。段階1〜5全体の完了ではない。次の署名局所是正は、現行`manifest-trust.ts`に存在する二Symbolに対し、保護import表が廃止済み`trust-core.ts`を要求する第一段階改名の追従漏れである。現行Sourceを確認し、署名保証を維持した別の固定候補として処置する。

### 署名保護import表の改名追従 — 着手前照合

基準Commitは`9b99331f`。変更分類は第一段階改名の接続漏れ是正であり、保護表のimport元だけを現行`manifest-trust.ts`へ同期する。二Symbolの必須性、同名decoy・alias・欠落・重複・事前Effectの拒否、署名入力とAuthorityは維持する。正常Source受理、旧Pathへ戻した入力の拒否、既存保護flow反例を確認する。実鍵・署名・Docker・Providerは使わず、Source契約試験と静的確認、実装／品質の限定独立レビューで確認する。新しい保証や許可集合の拡大が必要なら停止し、単純なPath同期へ混ぜない。

保護import表の一Pathを同期し、既存Caseへ旧Path拒否の反例を追加した。変更二Sourceの書式・Lint、production strict型検査はPass。署名保護flow局所三件は3件Pass、Fail／Skip 0。関連Suite全体は実行中で、独立レビューとともに完了未確認。既知Recovery試験の型不足やCoordinator全体静的の未合格は解消主張に含めない。

限定した三Fileの独立レビューは実装・品質とも指摘0。関連Suite全体の実行結果は引き続き確認中であり、局所3件の成功を全体へ拡張しない。

関連Suite全体はExit 1で終了した。今回対象の署名保護三件は全件成功したが、別Caseに残る旧`host-runtime`／`docker-runtime`とOrchestrator `src/core`等の参照でENOENTを検出し、意図した拒否phaseの不一致も残った。全SuiteをPassとは扱わず、試験側移管漏れとその他停止原因を分類して後続是正する。局所三件と独立レビュー指摘0を根拠に、保護import表の改名追従だけを限定完了とする。実署名・配布・Coordinator全体完成ではない。

### Topic／Meetingの正常CRUDと協調Writer競合 — 着手前照合

変更対象は既存`CPR-IT-010`の正常CRUD網羅と保存排他の実Process観測で、保存Runtimeは変更しない。Topic／Meeting双方の登録・一覧・取得・更新・期待改訂拒否・確認なし削除拒否・確認付き削除を実bytesと改訂へ接続する。新しいfixtureは検証済みRepository-local `.crdd/tests`へ限定し、mock・子Processを回収してRoot不存在を確認する。既存Relation付き削除・変換・Outcome・昇格の試験を保持し、Repository CRUDだけで公開操作全体の完成を主張しない。

実Process競合は第一子がexact既存Lockを実openした後に自己生成readyを発行し、第二子の更新拒否と終了・正本不変を確認してから第一子を解放する。spawn直後にerror／closeを観測し、保留・joinには期限を設ける。fixtureがdescriptorを返す前に失敗した場合は自身で回収する。finallyでは所有子のclose確認後だけRootを回収し、join不能やcleanup併発を一次失敗で隠さない。通常の協調Writer更新を対象とし、異常死回復、同時open勝者選択、非協調親差替え、電源断保証へ拡張しない。新Lock、Recovery、公開APIや共有Stateは作らない。

正常CRUDの既存Caseを両種別の全操作へ補強し、Repository-local fixtureへ切り替えた。Domain Model全112件と書式・型・LintはPass、Fail／Skip 0。保存Runtimeは不変で、協調Writer実Process競合はこのCaseでは未実装・未確認。QA-000005へ通常経路の追加観測と限界を直接接続し、限定独立レビューへ渡す。

両独立レビューは同一原因のMinor1を返した。古改訂入力が保存済み本文と同じでは誤保存を検出できないため、有効な異bytes候補を渡し、拒否直後の正本bytesと改訂保持を両種別でassertする。全結果統合と両観点の是正方針照合後に限定修正し、Runtime・QA ID・正常更新・Relation解消と削除Oracleは保持する。

Oracle修正後は書式・型・LintとRepository Suite全7件Pass、Fail／Skip 0。先の112件全回帰の対象と、この修正後局所再実行の対象を区別する。その他Package入力・Runtimeは不変で、固定候補の限定再レビューで是正解消を確認する。

修正後の限定再レビューは両観点とも指摘0で、Repository正常CRUDの補強は確認済み。協調Writer実Process競合と公開操作母集合の網羅は引き続き残件である。

### 配布閉包試験の旧Path追従 — 着手前照合

基準Commitは`0b2b49a6`。関連Suite全体で発見した試験側の参照漏れを処置する。`host-runtime`は`host-execution`、kernel-lock・子entrypoint・Lock supervisorは現行Fileへ、`docker-runtime`は`docker-execution`のowned-process／command-effectsへ、CLI lifecycleは現行非internal Fileへ対応させる。Orchestratorのintegration-resultと未使用sibling fixtureは現行candidate Folderへ置く。架空攻撃File名、状態・reason、役割IDと既存拒否Oracleは維持し、廃止Folderをわざわざ作って試験を通さない。

実行能力伝播反例の局所再現では、dispatchの正本を置換できず、意図した変異が未発火であった。現行Sourceと空白だけが異なるfrom／toを同期し、既存の変異発火assertion・拒否phaseを保持する。Runtime・公開API・Authorityは変更しない。Source対応と静的確認、速い伝播反例、実fixture利用側を確認した後に関連Suite全体を再実行する。実装と品質の限定独立レビューを行い、別の契約不足があればPath同期へ混ぜず分類する。実Provider・Docker・実鍵・実署名は使わない。

旧Path同期後の伝播反例・内部lifecycle反例は局所2件Pass。固定候補の実装・品質レビューは同じ原因のMinor2件を返した。攻撃側と許可対照の相対importが実fixtureへ接続していないため、それぞれ実Docker Process OwnerとCoordinator子入口へ同期する。duplicate_path置換には書込み直後の発火assertionを追加する。両結果を統合してから限定是正し、Runtime・許可集合・既存拒否理由とcandidate対照は維持する。修正前候補の全Suiteは是正前に停止したため、完走・全体Passの根拠には使用しない。是正後は該当3ケースを先に確認し、新しい固定候補で再レビューと全Suiteを行う。

是正後の書式・Lint、差分空白確認はPass。duplicate_pathの変異発火と拒否、実Ownerを指すsibling importの直接拒否、実Coordinator wrapperを指す許可対照を含む該当3ケースは3件Pass、Fail／Skip 0。局所成功は配布Suite全体や実署名の成立ではなく、全Suiteと修正後独立再レビューは未完了である。

配布閉包試験の修正後独立再レビューは両観点とも指摘0。全Suiteは引き続き実行中で、終了前に全体Passへ更新しない。

修正後の配布Filesystem Suiteは全133件Pass、Fail／Skip 0で終了した。実行入力のRuntime Sourceは不変で、実鍵・実署名・Provider・Docker操作は行っていない。今回の試験側移管追従は独立レビュー指摘0と全Suite結果により限定完了とする。Coordinator全Packageの型・既知Recovery・Host実環境の未評価を、この結果で解消しない。

### Topic／Meeting協調Writerの実Process確認

既存の着手前条件を具体化し、固定ESM eval Sourceと固定import先、所有Root内の入力・結果Fileで実子Processを起動する。通常入口とevalで異なるargv位置は`slice(1)`へ固定した。第一子のexact Lock open後にreadyを発行し、第二子のcloseと拒否tuple、第一子保留と正本保持を確認してからreleaseする。子のclose、保存結果、改訂2／3、Lock・短命File不存在を共同確認する。Runtime・公開API・Lock形式は不変で、新Frameworkは作らない。

初回局所試験はfixtureのRepository子Root作成漏れで失敗した。実Operation開始前の不足であり、自己生成の空Rootを確認して回収した。Root作成とRepository構築をcleanup対象のtry内へ移し、書式・型・Lintと局所1件はPass。最終Oracleへstatus／reasonと後続更新後の短命File不存在を追加して全回帰・独立レビューへ渡す。取得順を固定した協調Writer以外の保証を追加しない。

追加後のDomain Model全113件と書式・型・LintはPass、Fail／Skip 0。実装・品質の独立レビューは同じMinor1件を返した。子hookがdescriptorを返す前の一次失敗にclose失敗が併発すると上書きするため、closeを一度だけ別tryへ置き、AggregateErrorのcauseに元失敗を保持する。両結果統合後に試験fixtureだけを是正し、Runtime・Lock形式・取得順・正常Oracleは維持する。実OS close失敗の回収保証へ拡張しない。

fixture是正後の書式・型・Lintと局所競合1件はPass、Fail／Skip 0。全113件は是正前候補の結果として区別し、修正後の限定再レビューへ渡す。実OS close失敗注入・非協調Writer・異常死は今回の確認対象外である。

是正後の実装・品質再レビューは両観点とも指摘0。取得順を固定した協調Writerの競合・正本保持・Lock解放・後続更新再利用の確認は限定完了とする。公開操作全母集合と非協調親差替えの未決範囲は解消主張に含めない。自己生成domain-writer Rootの残存0を確認した。

### Topic／Meeting公開CRUDの接続 — 着手前照合

基準Commitは`0b5ae212`。Repository正常CRUDと公開種別固定の既存Caseを照合すると、公開Topic／Meeting面からの通常update・改訂競合・確認なし／確認付きdeleteが未観測である。既存`CPR-IT-010`の同Caseを両公開操作へ拡張し、本文bytes・改訂・拒否Effect 0・削除後の取得／一覧と実体不存在を確認する。種別誤用・専用操作の非公開・既存検索／Relation／昇格／OutcomeのOracleは保持し、正本種別を生成時に固定するRuntimeは変更しない。新fixture Rootは検証済みRepository-local `.crdd/tests`へ限定し、finally回収を観測する。これは通常CRUDの公開接続であり、全公開操作母集合・実OS故障・非協調Writerの完成主張ではない。静的確認、局所とPackage回帰、実装・品質の限定独立レビューを行う。

初回確認は削除前確認の返却値に存在しないexistsを期待したため、型確認と局所試験が失敗した。実契約のrecord／relationPathsへ照合を訂正し、書式・型・Lintの成功後に局所1件を再実行してPass、Fail／Skip 0。Runtimeは不変で、自己生成Rootはfinallyで回収した。Package回帰と固定10ファイルの限定独立再レビューPass・全重大度の残指摘0である。

補強後のDomain全113件と書式・型・LintはPass、Fail／Skip 0。限定レビューは品質指摘0、実装Minor1件で、競合・確認なし削除・確認付き削除のstatusが未観測だった。全結果統合後、既存reason／Effectとblocked／blocked／completedを共同確認する3assertの追加を両観点へ照合して是正した。Runtime・入力・正本bytes・QA IDは不変。最終局所確認と限定再レビューの結果を別記する。

status相関追加後の書式・型・Lintと公開CRUD局所1件はPass、Fail／Skip 0。先の全113件と最終局所の対象を区別し、限定再レビューへ渡す。domain-public-crud Rootの残存0を確認した。

是正後の実装・品質の限定再レビューは両観点とも指摘0。status・reason・Effectと実bytes／改訂の相関を確認し、Runtime・入力・QA IDは不変である。通常公開CRUDの補強を限定完了とし、全公開操作母集合や非協調Process・実OS故障の未確認範囲は保持する。

最終status相関候補で`domain-model`の`npm test`を再実行し、書式・型・Lintと全113件がPass、Fail／Skip／取消0で終了した。これは今回の公開CRUD補強と既存Package回帰の結果であり、上記対象外の保証や実Provider・Docker・署名E2Eの成立を示さない。

## 11. Access Managementへの再編 — 2026-10-09の途中見直し

### 結論と変更境界

人間は独立`cros` Package維持の先の判断を変更し、認証・認可・権限管理を`access-management`へ再編する方向を提示した。CROSはRepository群と専門Capabilityが連携して成立する全体システムの概念とし、一Packageの名称と同一視しない。Package数削減ではなく、名前・配置から責務を予測できる構造を目的とする。本節はSource照合と移管計画であり、正式Architectureの反映・新Packageの実装・旧Packageの廃止は未完了である。

基準は`2f398f0a`。直前の非秘密Credential MCP接続は計画のみで停止し、Sourceへ追加していない。既に接続したProfile／活動MCPの現行能力を保持し、新Ownerへの追従と新しい検証を行う。旧維持判断と旧基準の独立レビューは履歴として残し、新構成の採用・完成判定へ流用しない。1〜5の確認済み範囲は撤回せず、Domainへの移管影響がある公開集合・型・Consumerだけを再確認する。段階9〜11の実行系大改修は前倒ししない。

### 現行全Fileと移管候補

現行`cros/src`の18 TS Fileと`bin/cros.ts`を列挙し、公開入口、実import、主要関数と利用側を照合した。候補先は現行命名規約に従い、`src/<責務>/<file>.ts`までとする。子index・再export専用File、新しい空Folderは追加しない。以下の候補名は移管前のArchitecture／Quality照合で固定し、機械的な名前変更だけを完成としない。

| 現行Path（`40_Develop/cros/`起点） | 現在の実責務 | 処置・新Owner候補 | 保持するもの／追加確認 |
|---|---|---|---|
| `src/access/credential.ts` | Credential発行・認証・一覧・Grant変更・失効・rotation | `access-management/src/credential/operations.ts` | 明示Grant、管理とContentの分離、非秘密Metadata、inspect／publish競合。秘密発行はHost／Local限定 |
| `src/access/registry-file-adapter.ts` | Credential Registryの不変Revision保存 | `access-management/src/credential/file-store.ts` | 完全Snapshot検査、競合、現在OS Rootと保護条件。不必要な保存方式変更はしない |
| `src/access/recovery.ts` | 管理資格喪失時の計画・対象再照合・限定回復 | `access-management/src/recovery/operations.ts` | 同一回復Identity、管理者確認、Content Grant非発行。Docker回復や汎用Recoveryへ統合しない |
| `src/access/recovery-file-adapter.ts` | 回復prepare／settleの不変記録 | `access-management/src/recovery/file-store.ts` | 現行保存先・排他作成・flush／読戻し。履歴保持の変更は今回の改名へ混ぜない |
| `src/access/recovery-cli.ts` | Hostの対話回復操作 | `access-management/src/recovery/cli.ts` | 人間確認・秘密の一回表示・Remote非公開 |
| `bin/cros.ts` | 回復mode／OS Root入力・端末I/O | `access-management/bin/access-management.ts` | Package同名の主要入口。一つのbin。OS領域変更なし。公開コマンド名・環境名の移行は別に対応付ける |
| `src/access/resolve.ts` | 認証済みAccess→同一Exposure Snapshot→許可集合 | `access-management/src/access/resolve.ts` | Request一回観測、現在Credential、systemAdminからContent非生成 |
| `src/access/types.ts` | ExposureとRepositoryの同一観測型 | `access-management/src/access/types.ts` | DomainのContext型と認可Snapshotを混同しない。Domain→Access Management依存を作らない |
| `src/access/session-context.ts`（Credential／Session／Exposure／Repository解決） | Credential SnapshotとSession、Binding／改訂を使う認可 | `access-management/src/access/session.ts`／`resolve.ts`／`types.ts`へ責務分離 | 型と関数名を実責務へ合わせる。RepositoryのDomain情報と認可用Bindingを分け、必要な型だけRoot公開 |
| 同File（ContextItem／ContextPackage／createContextPackage） | 目的・Source・改訂・欠測を持つ値変換prototype | 撤去。RFD-ST-010のDomain新Owner Gapを保持 | 目的限定Identity・Consumer lifecycle・第二正本0は未成立。固定Git履歴と現在処置は上段の撤去節を参照 |
| 同File（Handoff／resume、局所操作、AI行動計画） | Task相関・Authority照合の値判定、局所値更新、共通計画copy | Handoff／AI計画prototype撤去、RFD-IT-009局所操作は保持 | ERB-IT-010／ERB-ST-013は5C依存OPEN、RFD-IT-011もOPEN。旧値を実Effect・旧Owner終了の証明にしない |
| `src/federation/project.ts`（resolveAuthorizedRepositories） | Grant／Exposure／改訂の認可フィルタ | `access-management/src/access/resolve.ts` | 認可済みRepository集合を返す。Portfolio生成は行わない |
| 同File（createPortfolioProjection・3公開型） | Context Identity照合、Project集約、欠測・競合の投影 | `domain-model/src/project-context/portfolio.ts` | DomainはCredential／Sessionを入力にせず、認可済みDomain情報を入力にする。MCP／WorkbenchのPortfolio型も新Ownerへ追従 |
| `src/profile/administration.ts`（resolve） | systemAdminによるAI Profile管理可否 | `access-management/src/access/administration.ts`候補 | AI AdapterのCatalog管理実体を再実装しない。Content観測不要・非管理非開示 |
| 同File（parseMutation） | 閉じたMutation入力の検査 | AI Adapterの既存Profile管理責務へ統合候補 | operation／Revision／Profile語彙はAI Adapter、Transport envelopeはMCP。認可Packageへ業務入力Schemaを残さない |
| `src/activity/read.ts` | 許可集合のProject選択、Reader待機・結果検査 | 分離候補。対象認可はAccess Management、観測・結果契約はOrchestrator | 任意Repository探索禁止、unknown／欠測、Reader joinと取消限界を保持。Orchestratorの内部大改修はしない |
| `src/activity/types.ts` | Orchestrator投影・Runtime Event・Reader入力型 | Orchestratorの既存活動公開領域へ統合候補 | Repository型依存をDomainの非認可情報へ限定。実行事実の正本をExecution Intelligenceへ勝手に変更しない |
| `src/activity/validate.ts` | Orchestrator状態相関と活動応答の閉包検査 | Orchestratorの既存公開投影Validatorへ統合候補 | MCP／Workbenchで共有。Access Managementへ上位Task意味検査を持たせない |
| `src/configuration/shared-server-file-adapter.ts` | Origin／Port、接続設定、Root検証、Context解析、Exposure、Topic／Meeting生成が混在 | SPLIT。接続・Exposure設定はAccess Management、ContextはDomain、Listener設定と本番組立てはMCP／Workbench | 設定の存在によるMode切替禁止。現在Binding／Context改訂検査を維持し、単体から兄弟Repoを探索しない |
| `src/connection/http.ts` | CROS REST ServerとRemote Client、入力stream・応答変換 | 代替MCPと本番Consumer成立後DELETE | Browser↔Workbench RESTは対象外。認可・競合・活動欠測・終了保証は新経路で実証 |
| `src/tool/registry.ts` | Tool配列の選択と試験関数実行 | prototype撤去。実SurfaceのRCM-IT-010は部分接続・OPEN | 全入口の状態軸・取消・cleanup比較は未成立。固定Git履歴へ戻れ、新汎用Registryは作らない |
| `src/surface/operation.ts` | 汎用Ownerへのinspect／apply、Surface転送、委譲結果相関 | REVIEW。固有意味を持つ実Ownerへ統合またはDELETE | 本番Consumerは検索で見つからず自Package試験のみ。Handoff／Result義務を消さず、値の投影とTask採用判断を分ける |
| `src/index.ts` | 上記責務全体の明示公開 | 全移管後DELETE。新Ownerの`src/index.ts`から必要Symbolだけ公開 | 同型DTOや互換barrelを追加しない。未対応の公開契約を消さない |

### 保存正本の実照合

現行RootはDomainの`repository/resolve-storage-paths.ts`にある`resolveCrosRuntimeRoots`で決まり、Windowsでは`<LOCALAPPDATA>/<publisher>/cros/<trustDomainId>/`、Linuxでは既存XDG config／stateの同じ三segmentを用いる。Credentialはstate直下の`credential-registry/registry-<revision>.json`、管理回復は`credential-access-recovery/`、接続設定はconfig直下の`shared-server.json`から読む。これはSource上の配置規則の確認であり、利用者の実秘密Fileを読んだ結果ではない。

現行には独立したRepository Connection Registry保存Adapterが見当たらず、`shared-server.json`のrepositories／workspaceIdsを読んでBindingとExposureを構成している。「Registry」という名称だけから新Storeを作らない。接続設定のOwnerをAccess Managementへ定め、HTTP設定と分ける際にも既存Host Rootと秘密の保護を維持する。将来の設定File名変更はFrontend AIの明示移行へ接続し、Sourceへ旧互換Readerを追加しない。Package改名を理由に`cros`というOS Path segment、Token version、秘密Verifier、保存改訂を変更しない。

共有Rootは複数Ownerが利用するCROS全体の配置契約であり、Access Management固有の内容所有へ集約しない。現時点の物理Providerは`domain-model/src/repository/resolve-storage-paths.ts`であるが、それをDomainの意味Owner確定と扱わない。現在の配置とPath Identityを維持し、将来のProvider変更またはOwner別Rootへの移行は、全Consumer・保存Path・保護・移行を対応付けた別判断とする。Access ManagementがAI Profile内容を所有する構造や、AI AdapterからAccess Managementへの保存依存を作らない。

| 保存内容 | 現行Path（既存Root起点） | 内容Owner／利用側 | 今回の処置 |
|---|---|---|---|
| Credential Registry | state内`credential-registry/` | Access Management候補 | Path・秘密保護・不変Revisionを維持 |
| 管理回復記録 | state内`credential-access-recovery/` | Access Management候補 | Path・限定回復契約を維持 |
| 接続・公開・Listener設定 | config内`shared-server.json` | Access Management／MCP／Workbenchへ責務分離候補 | 内容分離とFile移行を対応付け、Rootは変更しない |
| AI Profile Catalog | config内`ai-profile-catalog/` | AI Adapterの`profile/store.ts` | 内容・Schema・保存先を維持。管理可否だけAccess Management |

### 利用側・検証の移管母集合

| 利用側／成果物 | 必要な処置 |
|---|---|
| MCP `project-context/adapter.ts`とResolver | Portfolio型・生成はDomain、Credential／ScopeはAccess Management。Requestごとの認可を必ず経由 |
| MCP Profile／Runtime活動Adapter | Profile入力はAI Adapter、管理可否はAccess Management、活動型・検査は実Ownerへ接続 |
| Workbench `server.ts`／`credential/administration.ts`／`browser/client-model.ts` | Local認可と非秘密管理をAccess Managementへ、表示型はDomainへ、Remote ClientはMCPへ切替。Browser REST維持 |
| `template/tools/crdd-cros-server.ts`とMCP Shared Host | 新MCP正式入口・設定・Reader注入とWorkbench代替を確認後に撤去。旧起動能力を先に消さない |
| CROSの12試験File、MCP／WorkbenchのCROS結合・System試験 | 検証義務のOwnerと観測境界で移管・補強する。過去結果を新配置へ流用せず、新しい対象で実行 |
| Checker命名、Version Control Consumer閉包、Coordinator配布閉包 | package名・SourcePrefix・公開集合・実依存に追従。配布のためだけにAccess Management全体を署名閉包へ追加しない |
| 共有Rootの全利用側 | DomainのRoot公開API・契約試験、AI AdapterのProfile Store・保存試験、CROSのCredential／Recovery／設定試験、MCPのShared Server入口試験を照合。移管後の新候補でPath Identityと保護条件を再検証 |
| Package metadata／build契約 | `package.json`のname・exports・bin・scripts、`tsconfig.json`、`symbol.json`を新Ownerへ対応付ける。`package-lock.json`は採用Package graphとmanifestから再生成する派生物であり、独立正本・手編集対象としない。旧名の実利用と歴史記録を区別し、全接続・bin案内・検証成立後だけ旧Packageを撤去 |
| Domain公開Trust Policy契約 | `inspectCrosTrustPolicy`／`CrosTrustPolicy`／`CROS_TRUST_POLICY_SCHEMA`は既存宣言Validatorとして現状維持し、Domain試験・Architecture・公開集合・履歴を照合する。改名／廃止は別判断。新しい運用必須Policy、Coordinator Authorityへの統合、Schema変更は行わない |
| Architecture／Quality／symbol／Template設定／案内／Project Context | 現行Owner・導出元・新API・配置と一致させる。過去Evidenceは変更しない |

以下は現行12試験Fileの全数対応である。Pathは`40_Develop/cros/tests/`起点、各名称には`.contract.test.ts`が付く。現Traceは正式QA適合判定ではなく照合入力であり、QA ID・本文・Oracle・過去結果はこの計画更新で変更しない。一Fileを一Ownerへ強制せず、複合責務は分割候補とする。保持Oracleは新Ownerで再実行し、過去Passや自己Package試験だけを代替能力の成立・削除根拠にしない。

| 現行試験File | 現Trace | 対象責務 | 移管・分割・代替候補 | 保持Oracle／未決 |
|---|---|---|---|---|
| `integration/connection-credential` | RFD-IT-013 | Credential・要求認可 | Access Managementへ移管 | 明示Grant、失効、秘密非保持、管理とContent分離。公開MCP／Workbench結合は別確認 |
| `integration/credential-access-recovery-file-adapter` | RFD-IT-013 | 管理回復の保存・再入場 | Access Management回復へ移管 | 人間確認、同一Identity、Registry確定、秘密非保持、再入場 |
| `integration/credential-registry-file-adapter` | RFD-IT-013 | Registry保存 | Access Management保存へ移管 | OS Root、別Adapter読戻し、Revision競合、保存保護 |
| `integration/repository-local-operation` | RFD-IT-009 | 局所値契約 | AI計画Caseだけ撤去し、局所操作を改名して保持 | RFD-IT-011の実AI入口比較はOPEN。残存Oracleを変更しない |
| `integration/project-federation` | PPR-IT-002 | 認可集合・Portfolio | Access Management認可／Domain投影へ分割 | 許可集合外非読取り、欠測、Identity不一致、競合 |
| `integration/remote-transport` | PPR-IT-002／RFD-IT-013 | Remote認可・情報非開示 | MCPの実経路で代替後に旧REST試験撤去 | Request毎認可、Workspace非開示、Registry改訂、Token非報告。代替本番検証は未完了 |
| `integration/shared-server-config-file-adapter` | PPR-IT-002／RFD-IT-013 | Host設定・Root・Context・Exposure | Access Management／Domain／MCP設定へ分割 | 不正Root・Context拒否、Binding、Grant不一致、現在Path Identity |
| `integration/surface-contract` | EST-IT-010 | Surface間Owner・結果・取消 | REVIEW。実Owner・本番Surface試験へ代替 | 同一Owner、Authority、Effect、取消、結果相関。抽象FixtureだけでServer成立を主張しない |
| `integration/tool-registry`（撤去） | RCM-IT-010 | 試験関数の登録・選択 | prototype専用試験撤去。実Surface比較の義務はOPEN | 公開可否、Host availability、Authority、取消、cleanupを全入口で観測する義務は保持 |
| `system/context-handoff`（撤去） | ERB-ST-013／RFD-ST-010 | Context引渡し・再入場の値判定 | prototype専用試験撤去。Domain／Orchestratorの義務はOPEN | ERB-IT-010も5C依存OPEN。値関数から本番ST成立を推定しない |
| `system/result-return` | EST-ST-011 | 結果引渡し・再実行制御 | REVIEW。実Orchestratorの結果受領へ対応 | createdBy、改訂、差分、Evidence、返却先、Authority、replay。新汎用DTOは作らない |
| `system/session-access` | RFD-ST-003／RFD-ST-004 | Session・Exposure・公開操作 | Access Managementへ移管しMCP／Workbench実Surfaceを補強 | Session終了、失効、Workspace／Repository認可、非開示。新Surface接続の検証は未完了 |

Tool Registry等の本番未使用判定は、今回のTS Source検索による確認であり、動的参照・設定・公開案内・Git履歴・過去VerificationとCanonical義務を含む削除Gateは未完了である。

### 実施順・再開Gate

1. 本表の未決候補をSource・Canonical義務・過去Capabilityから確定し、基本／詳細ArchitectureとQAを新Ownerへ対応付ける。必要な人間判断だけを提示する。
2. Credential・認可・限定Access Recovery・接続設定をAccess Managementへ移す。DomainのPortfolio／Context処理を分け、Root明示公開・型依存・試験を同時追従する。
3. 業務入力・活動投影・Tool／Surface／Handoffの残存責務を既存Ownerへ統合または削除する。段階9〜11の大改修が不可欠なものは依存を示し、段階6〜8の完成へ隠さない。
4. MCP／WorkbenchのLocal・Remote本番Consumer、単体／CROS Mode、設定と公開入口を接続する。認可前読取り0、非開示、改訂競合、処置前／後取消、終了後状態を新経路で確認する。
5. 全責務・公開集合・利用側・代替実測が閉じた後、旧REST／Gateway／Shared Hostと`cros`Packageを撤去する。全回帰・独立レビュー・Reality Auditと現在投影を更新する。

実装前整合確認と固定候補前照合を新Ownerでやり直す。独立した実装・品質観点で本計画を確認し、全結果を統合して是正する。保存Path・Token・Grantの意味を変える必要が判明した場合は改名へ混ぜず影響と人間判断へ戻す。新IAM Platform、氏名・メール・Password・登録申請・IdPを持つ汎用User Account、汎用Registry／Lock／Gateway／互換Serverは対象外。最小ユーザー管理は後述の現在採用判断に従い正式伝播する。現時点で全1〜8の完成・Release可能は主張しない。

### 正式Architecture着手前の照合結果

本節の照合表・二案は追加Input採用前の履歴である。現在の採用範囲は[現在の採用判断](#現在の採用判断)とREQ-000041を優先する。表の判断待ちを現在の停止条件として扱わない。

基準Commit `fd7ae93a`でArchitectureと品質の読み取り専用確認を完了した。これは移管後の独立レビューや完成判定ではない。全結果を統合すると、Package名の変更とは別に、認可方式の正本間矛盾が存在する。以下を処置するまで、認可方式を固定したSource移管と旧Owner撤去は開始しない。

| 照合事項 | 確認した差・必要な処置 | 現在状態 |
|---|---|---|
| 認可方式 | REQ-000041は固定三RoleとRole別共有Credentialを採用し、Credentialごとの任意Workspace Grantを不採用としている。UX-000013／035、IA-000009、UI-000008、SPEC-000012はこの意味を継承する。一方、CROS詳細設計§2・保存／保守契約・現行`credential.ts`は固定名をCredential Profileとし、明示Workspace集合と管理可否を実効権限としている。現在Sourceを根拠に上流を改変せず、同一CHG内でQual-Labの判断を確認する | 判断待ち。今回のPackage再編承認は認可方式変更の承認ではない |
| 専門Capabilityの詳細設計 | `Details/access-management/01_Architecture.md`を認証・要求認可・Credential保存・限定Host回復・接続設定の設計Ownerとする。`Details/cros/01_Architecture.md`はシステム連携の設計として残し、同じSchemaや認可規則を再定義しない | 設計反映未実施。永続Userを追加しないという条件は追加Input前の前提。新IAM Platform・汎用User Account・永続Sessionは対象外を維持し、最小の耐久User IdentityとRole／Credential紐付けは後述の追加Inputの認識確認待ち |
| 直接伝播の範囲 | ARCH-000013、Architecture入口・Component／Interface／Data Flow／Detail Map／Traceability、Domain保存契約、MCP／Workbench／AI Adapter詳細設計を照合する。CROS詳細設計のIdentity、設定、Credential、登録、完了条件、回復、実装構造も対象とし、一部のOwner表だけで閉じない | 移管候補表を入力とし、意味と保存契約を維持して反映する。過去Evidenceは不変 |
| 設定と保存Root | 接続・公開設定は`access-management.json`、Transport設定は`mcp-server.json`へ分離する候補。前者は接続Repository RootとWorkspace集合、後者はOrigin／Port等を所有する。旧`shared-server.json`からの移行はフロントAIの手順とする。既存OS Root・秘密Store・AI Profile Storeは変更しない | 内容と正本を設計で確定してから実装。新Registry Store・旧互換Readerは作らない |
| 品質の導出元 | QA-000001／004／007／009に加え、QA-000006のERB-ST-013もContext引渡しと実再開の区別へ追従する。既存Local Itemを保持し、Portfolio値生成、要求認可、活動値の検査、実行停止／再開の観測を別の保証として扱う | QA更新未実施。値関数や自己Package試験を本番Surface・実取消・再開の完成根拠にしない |

以下は、ユーザー・Role・Credential分離の追加Inputを受ける前に提示した二案である。現在の選択肢をこの二案へ限定せず、後述の追加Inputを優先して認識確認する。両案ともユーザー登録なし、Bearer Secretの別経路配布、管理権限から内容閲覧権限を推定しないことを維持する。

| 案 | 利用者・管理者への影響 | 必要な処置 |
|---|---|---|
| 採用済み固定三Roleを維持 | DeveloperはDevelopment、ManagementはDevelopmentとManagement、Administratorは管理のみ。Credential単位の任意の範囲設定を通常管理へ増やさない | 上流は維持。詳細設計・Source・QAを採用済みの三範囲へ一致させ、保存済み設定への影響を確認する |
| 現行の明示Grant方式を採用 | 固定三Profile名は選択・表示の補助で、CredentialごとにWorkspace集合と管理可否を設定できる。柔軟だが管理対象が増える | REQ-000041の不採用判断を人間が変更し、UX→IA→UI／SPEC→ARCH→QAへ正式伝播する。Sourceが存在するだけでは採用しない |

人間への推奨は、現在の軽量運用意図と既存要求に従い固定三Roleを維持する案である。ただしこの推奨を採用判断と扱わない。回答前は上流の権限意味、Token・Verifier・保存改訂、認可Source、秘密値、実Host設定を変更しない。設計Ownerの候補整理は継続可能だが、新Ownerの完成や旧Packageの廃止を表示しない。

この照合結果・二案と現在投影の三文書差分は、Architectureと品質の限定独立レビューで双方指摘0。差分空白確認も成功した。確認対象は判断待ちの記録であり、認可方式の採用、正式Architectureの移管、Source・QA完成または回帰成功を示さない。

### Tool／Surface中継の責務照合

認可方式の判断待ちと独立して、基準Commit `fd7ae93a`の二Sourceと三試験、公開型の利用、ARCH-000010／015、QA-000001／009を読み取りで照合した。`40_Develop`と`template`のTS／JSONにおける関数・公開型の参照は、定義・Root export・自Package試験だけだった。これは現在の静的な利用集合の観測であり、外部Consumerや任意の動的参照の不存在証明ではない。Git履歴には第一段階改名とv0.21の境界検証変更が存在するため、過去試験を不要扱いせず、変更・削除前に当時の保証範囲を確認する。

| 現行Source／試験 | 実際に成立する範囲 | 移管・撤去の処置候補と保持する義務 |
|---|---|---|
| `cros/src/tool/registry.ts`／`integration/tool-registry`（撤去前の照合） | Callerが与えた登録配列の状態照会と実装関数呼出し。登録一覧は試験内で組み立てており、Repositoryの実Tool発見や公開Server登録とは未接続 | 2026-10-13にpure prototypeを撤去。実Surfaceの部分接続は置換完了ではなくRCM-IT-010はOPEN。現在処置は上段の撤去節を参照。Access Managementへ移さず、新Registry Packageは作らない |
| `cros/src/surface/operation.ts`の共通操作Handler／`integration/surface-contract` | Callerが与えた同期Ownerを呼ぶ。試験は四つのSurface名に対し別々のメモリOwnerを作り、同じ結果を比較する。本番CLI・HTTP・MCP・Workbench接続や外部取消資源の観測ではない | 汎用Handlerを別Packageへ横流ししない。Topic／Meeting、Profile、活動等の既存業務APIと本番AdapterをEST-IT-010へ接続して同等性を確認する。文字列のSurface名や固定残存件数から実入口・cleanupの成立を推定しない。代替確認後の削除候補とする |
| 同Fileの`settleDelegatedResult`／`system/result-return` | Task・Request・Authority・Revision・既処置集合・complete値を同期判定する。`effectCount: 1`は返却値で、実Task保存・Candidate反映・既処置集合更新を発行しない。試験は`producerId`、変更Hash、Evidenceの保存先への搬送を観測していない | 結果受領・Taskへの結合はARCH-000015が定める既存Coordinator／Orchestratorへ対応付ける。EST-ST-011の実帰還・相関保持・再送による重複Effect 0を観測するまで、この値判定を本番ST成立としない。単純な型移管や同名関数追加で新しい結果受領Ownerを増やさない |

Domain Modelの`configuration/read-tool-config.ts`は保持期間設定のReaderであり、名称にToolを含むだけで能力Registryの代替にしない。Orchestratorの`candidate/integration-result.ts`は既存の結果Schema検査を所有するが、上記委譲結果と同じSchemaではないため機械的な統合やDTOの複製をしない。実接続を追跡して保持保証を対応付ける。これらの照合でSource・QA・過去Evidenceは変更しておらず、新しい回帰成功・削除許可・段階6〜8完了を主張しない。

### 追加Input — ユーザー・Role・Credentialの分離

#### 現在の採用判断

2026-10-09、人間は最小ユーザー管理をv0.22へ採用した。ユーザーは`userId`（UUID）、管理者が設定・変更する`username`、Roleを持ち、Credentialをユーザーへ紐づける。表示名は管理対象の識別とWorkbenchの現在認証ユーザー表示だけに使用し、認証・本人確認・認可の根拠にしない。標準Roleは`developer`／`manager`／`administrator`、詳細権限はRoleに置く。リセットはユーザーIDとRoleを保ち旧Credentialを拒否する。氏名・メール・Password・申請・自己編集・SSO／IdP・一般IAMへ拡張しない。

初回の正式伝播としてEXP-000036に旧判断履歴と採用変更を分離し、REQ-000041を現在モデルへ更新した。Discovery入口も追従した。これで採用範囲の認識確認待ちは解消したが、UX／IA／UI／SPEC／BHV／SCR／ARCH／QA、Source、保存Schema、既存設定移行、回帰は未追従である。先の認可方式照合表と二案は変更前の診断・提案履歴であり、現行方式として採用しない。認可Source移管は新要求の下流設計を固定してから行う。

上流7文書の固定差分はArchitecture・品質の限定独立レビューで5指摘を統合是正し、両観点の再レビューで残指摘0。REQ-000011本文も現行認可境界へ揃え、旧Phase 4 Passを履歴へ限定した。差分空白確認は成功した。これはDiscovery更新の確認であり、下流伝播・Source・保存移行・実境界試験の完成証明ではない。

UXの直接伝播はREQ-000011／041の分析、UX-000013／035の定義、工程横断の5文書へ反映した。既存UX IDを維持し、自身表示・非認証非開示・非管理者の他ユーザー非開示、通常リセットとHost回復の分離、Role詳細権限を保持した。9文書の固定差分をArchitecture・品質で独立確認し、指摘を統合是正した後、両観点の最終限定レビューは残指摘0。差分空白確認も成功した。これは今回のUX変更範囲の確認であり、全UX完成、実装やE2E成功ではない。次はIAへ正式伝播し、UI／SPEC、詳細設計、Architecture、Qualityと実装へ順に接続する。

UUID版、表示名の構文・正規化・一意性、Role権限語彙、既存Credentialの移行／再発行、Bootstrapとの結合と緊急Recoveryの最小ユーザー情報処置は後工程で確定する。既存OS Root・秘密保護・単体利用のCredential不要・管理権限から内容権限を推定しない意味・Product Data保持は維持する。開始済み操作の取消をリセットの成功から推定しない。Source・実秘密Store・保存Schema・過去Evidenceは初回上流編集では変更しない。

IAの直接伝播はUX-000013／035の2分析、IA-000009の1定義と横断4文書へ反映した。UXのUUID継承制約と公開／実アクセスの正式入力も補い、固定9文書をArchitecture・品質で独立確認した。UUIDの正式入力、回復2種の属性と引き渡し漏れを統合是正し、両観点の最終限定レビューは残指摘0。21分析Objectから16Canonical Objectへの対応と既存IA ID、通常リセット／Host回復、三可視境界を維持した。差分空白確認は成功した。これは今回の文書伝播だけの確認であり、全IA、UI／SPEC、Source・保存Schema・移行・回帰・E2Eの完成ではない。次はUI／SPECへ正式伝播する。

UI／SPECの直接伝播は各UX-000013／035・IA-000009の3分析とUI-000008／SPEC-000012の定義、計8文書へ反映した。認可・情報非開示とReset／Host RecoveryのEffect・Lifecycleを含むArchitecture・品質の独立レビューを実行し、独立資格失効とProcess喪失後の回復情報保持の2指摘を統合是正した。最終限定レビューは両観点で残指摘0。差分空白・ローカルリンク先を確認した。これはDefinition直接伝播のみであり、UI／SPEC Details・横断投影・対応レビュー・Architecture／Quality／Source・保存Schema・移行・E2Eは未追従。入口と旧対応記録の完成表示を再確認待ちへ更新し、旧引用を最新完成証明にしない。次はSCR-000008／BHV-000012と横断投影へ接続する。

#### 鍵交換の途中見直し — 2026-10-10

人間は鍵だけの処置を採用し、操作を指定ユーザー交換と全員交換の2つへ統合した。要求正本はREQ-000041、理解確認・比較理由はEXP-000036が所有する。通常管理とHost回復はAuthority・入口を分けるが処置は共通。ユーザーID・表示名・Role・権限設定・Repository登録・Product Dataは保持し、回復専用ユーザー・追加権限・特別Bootstrapを作らない。全員交換は指定した既存administratorへ新資格を発行する。旧Role初期化と認可設定破損の自動回復保証は廃止し、破損・対象不明・管理者不存在では処置前停止する。初回Server設定の方式は今回変更しない。

変更分類は採用済みCapabilityの破壊的な回復意味変更。同じCHGのAccess Management再編意図で、基準はCommit `15b7ce3e`。今回の編集母集団はEXP-000036、REQ-000041、REQ-000041のUX分析、UX-000035、計画、現在投影の6文書。Authority・秘密保護・失効範囲と部分失敗の着手前整合確認を実施し、独立レビュー、文書整合と限定伝播監査で固定候補を確認する。CRDD規範と準拠基準は変更しないため準拠監査は行わず、Source未変更のため実E2Eは行わない。名前変更／単体利用は鍵交換非発火、対象資格紛失は指定交換、全漏洩は全員交換、管理者全資格喪失はHostから既存管理者を指定し、状態不明はEffect前停止する。

旧要求の回復2種を保持したIA／UI／SPEC、SCR-000008／BHV-000012、横断投影、Architecture／Quality／Source・保存Schema・移行はこの判断に未追従。前の限定Passは前の固定版だけの結果であり、新判断の完成証明へ流用しない。Source・実秘密Store・旧Evidenceを変更せず、要求→UX→IA→UI／SPEC→Detailの順に再伝播する。

今回6文書の固定候補は、Authority・回復意味と品質・検証義務の両観点で独立確認した。旧「通常リセット対Host回復」の別処置表現と、Process喪失条件のUX引き渡し不足を統合是正し、両観点の限定再レビューは残指摘0。差分空白とローカルリンク先の確認は成功した。これは要求・UXの今回変更範囲だけの結果で、IA以降の伝播、Source・保存移行・実回復・E2Eの成立ではない。

#### 鍵交換2操作のIA伝播 — 2026-10-10

基準版はCommit `8fc444e5`。正式入力UX-000035からIA分析、IA-000009、IAルート4投影へ操作範囲と入口・Authorityの別軸、既存ユーザーへの発行、情報保持、処置前停止、途中失敗後の同じRecoveryと再観測を伝播する。計画と現在投影を含む8文書を今回の編集母集団とする。IA-IDとObject数、三可視境界、Role・公開・実アクセスの別判定、単体利用非依存は維持する。

変更分類は採用済み回復意味の下流伝播。着手前整合確認で正式UXとの一致を確認した。対象1人／全員、通常／Host、管理者不存在・状態不明・認可設定破損、失効確定／発行不明を代表例として照合する。固定候補の独立レビューはAuthority・IA契約と品質・検証義務の2観点、文書整合・限定伝播を対象とする。規範・準拠基準・Sourceは変更せず、準拠監査・実E2Eは今回実施しない。現在、追加の人間判断は不要である。

固定8文書を両観点で独立確認し、限定Pass・残指摘0を得た。差分空白検査とローカルリンク先確認も成功した。IA分析・定義・横断投影まで新判断へ追従したが、全IA完成の判定ではない。UI／SPEC以降は未追従であり、旧レビュー結果を新判断の成立根拠にしない。次はUI／SPECの分析・定義へ伝播する。

#### 鍵交換2操作のUI／SPEC直接伝播 — 2026-10-10

基準版はCommit `29c276f2`。正式UX-000035とIA-000009を各工程で独立分析し、UI-000008とSPEC-000012へ統合する。対象は4分析・2定義・各工程入口の状態表示・計画・現在投影の10文書。旧回復種別・Role初期化・未決Bootstrap結合を現行契約から撤去し、2操作の失効集合・既存発行先と2入口のAuthorityを別軸で保持する。独立失効・三可視境界・Role／公開／実アクセス・単体利用非依存は変更しない。

変更分類は採用済み回復意味の下流伝播。着手前整合確認を行い、全員交換で自身旧資格も失効する影響、情報保持、処置前停止、失効確定／発行不明、応答・Process喪失後の同じRecoveryと再観測を代表反例として確認する。UIは認識・操作・Feedback、SPECは条件・Effect・結果・失敗の責務で更新する。固定候補はAuthority・契約と品質・検証義務の2観点で独立レビューし、文書整合・限定伝播を確認する。規範・準拠基準・Source未変更のため準拠監査・実E2Eは行わない。現在、追加の人間判断は不要。

初回固定候補は品質観点が残指摘0、契約観点が中程度1指摘であり、全体Passではなかった。UIの導線が明示確認を全鍵交換へ拡張していたため、両観点で是正方針を照合し、事前情報表示を維持したまま「Host入口または全員交換のみ」明示確認へ限定した。修正後固定10文書は両観点の限定独立レビューで残指摘0・Pass。差分の空白検査と変更文書のローカルリンク先存在確認も成功した。Detail・横断投影・UI／SPEC対応レビュー、Architecture／Quality／Source・保存Schema・移行・実証は未追従であり、次は画面詳細・BHVと横断投影へ伝播する。旧Passは当時の固定版の結果であり、新判断の成立根拠にしない。

#### 鍵交換2操作のDetail伝播 — 2026-10-10

基準Commitは`9184bb22`。採用済みUI-000008／SPEC-000012を既存SCR-000008／PRT-000008／BHV-000012へ具体化する。変更分類は同一CHGの契約変更の直接伝播で、追加の人間判断はない。書込み範囲は現在Repositoryだけ。新ID、Store／Schema、Role権限、Authority、管理画面／CLI分担、Source・旧Evidenceは変更しない。

編集単位はD1 Screen、D2 Behavior、D3 Area Guide、D4 UI Detail一覧、D5 SPEC Detail一覧、D6 Detail対応、D7〜8 UI／SPEC工程Rootの状態、D9本計画、D10 PROJECT_CONTEXT。D1〜2は現行Definitionから独立に具体化し、D3〜6は両者の接続と現在状態を投影する。着手前整合確認では契約専門観点が着手可とし、旧Role別鍵・Workspace Grant・権限再構成・Bootstrap再入場を撤去する範囲へ限定した。単体利用、通常管理、独立失効と初回Server設定方式は維持する。

代表例は2操作×2入口の4組すべてを照合した。事前情報表示は全4組、明示確認はHost入口または全員交換の3組のみ。対象不明・管理者不存在・必要状態を安全に確認不能・認可破損は新Effect前停止。失効後の発行失敗・応答／Process喪失は既知失効と発行不明を同じ回復へ保持し、現在再観測なしの完了／rollback／旧鍵有効／取消完了を禁止する。既存20 SCR／20 PRT／30 BHV／32 Relationは増やさない。

必須確認集合は契約観点と品質観点の限定独立レビュー、文書の差分・リンク確認と限定伝播確認。標準RuleやSourceを変更しないため準拠監査・実E2Eはこの段階では対象外。Definition対応32組の旧引用・Hashは歴史記録として維持し、現行Definition対応レビューとWorkbench候補の横断投影は後続で更新する。Architecture／Quality／Source・保存Schema・移行・実証も未追従であり、Detailの限定対応から工程Exit・v0.22完成を推定しない。

初回固定10文書は契約観点が残指摘0、品質観点が軽微1指摘（CQ-DETAIL-Q01）。Screenの共通completed表示が鍵交換だけの失効・発行結果を他操作へ適用していたため、両観点で是正方針を照合し、表示する意味セルだけを操作別の確定結果へ限定した。独立失効は発行なし、名前変更は鍵処置なしでも当該操作完了となり、失効確定／発行不明はcompletedへ丸めない。修正後固定10文書は両観点の限定独立再レビューで残指摘0・Pass。差分空白検査とローカルリンク先存在確認も成功（不存在0、アンカー全数検証ではない）。次はDefinition対応レビューとWorkbench候補横断投影、続いてArchitecture／Qualityへの伝播。既存Visual BaselineとArea原則の適用は保持するが、具体的な管理画面／CLI分担・Layout・CMPは未固定のまま明示する。

#### 鍵交換2操作の横断投影・Definition対応 — 2026-10-10

基準Commitは`69f8d463`。変更単位は表示面、操作・状態、UI引き渡し、Workbench画面候補の追補、UI-000008／SPEC-000012の現行1組の対応、本計画とPROJECT_CONTEXTの7文書。複数正本にまたがる契約伝播として読み取り専用の着手前整合確認を行い、着手阻害0・追加人間判断なし。旧32組のHash・引用・Pass、WorkbenchのG1〜G5と旧判断は履歴として維持し、現行区画を追加する。画面／CLI分担、Layout、権限、Source、Schema、旧Evidenceは変更しない。

確認母集団は2操作×2入口の4組、独立失効、通常のユーザー／Role管理、接続と三可視境界。全組の事前表示、Hostまたは全員交換だけ明示確認、処置前停止、失効後の発行失敗・応答／Process喪失の既知失効／発行不明、同じRecovery・現在再観測、Secret非再表示と取消非証明を照合する。Definition対応とDetail対応を別判定にし、実画面評価・UI工程Exit・Architecture／Quality／Sourceは未完了のまま保持する。

必須確認集合は契約・品質の限定独立レビューと文書差分・リンク・履歴保持確認。標準Rule・実装・外部Runtimeを変更しないため準拠監査・実E2Eは今回は実施しない。旧Passを新改訂版へ流用しない。

初回固定7文書は契約観点が中程度1、品質観点が軽微2で限定Fail。追補挿入による旧Checklistの分断と、引き渡し／対応文書の現在状態競合を統合し、両確認者と是正方針を照合した。追補本文を変えず旧Checklist全項目の後へ移動し、Detail限定確認済み・現行Definition対応と横断投影は再レビュー待ち・後工程未完了へ現況語を同期した。関連する工程Root2文書とDetail入口3文書の現況語も同期し、固定母集団は12文書へ拡張した。正本Definition・2Hash、旧32組の引用／結果、旧Gate・Checklist、Sourceは不変。修正後12文書は限定再レビュー待ち。

最終限定確認では、現況語同期の末尾OPEN3行の漏れを同じ原因の是正として修正し、両確認者が固定12文書を再確認した。契約・品質とも全重大度の残指摘0・限定Pass。差分空白検査成功、ローカルリンク先不存在0。旧32組のレビュー対象・引用区画と旧Workbench Checklistは基準版との完全一致を確認した。Definition2Hashも不変。結果状態だけを限定独立レビュー済みへ同期し、工程Exit・実装・E2E・v0.22完成は主張しない。次はArchitecture／Qualityへの伝播であり、管理画面／CLI分担と実画面評価の未確認は保持する。

#### 鍵交換2操作のArchitecture分析・責務定義伝播 — 2026-10-10

基準Commitは`ab4aa215`。変更分類は採用済みUI-000008／SPEC-000012への既存Architectureの是正伝播であり、UI工程Exit後の通常Handoffではない。各自身Definitionを独立分析し既存ARCH-000013へ統合する。UI意味、権限、初回設定、単体利用、REST撤去範囲、Source・秘密File・Schema・旧Evidenceは変更しない。人間の追加採用判断は不要で、公開入口・画面／CLI分担・期限・保存確定方式は未確定のまま保持する。

着手前の読み取り専用確認により、Architecture横断のComponent表も直接Consumerとして同時更新する必要を確認した。固定範囲は2分析、ARCH-000013、Component責務表、Architecture入口、本計画、PROJECT_CONTEXTの7文書。旧User無し・Role別資格・固定Workspace Grant・Bootstrap回復の意味を現行最小ユーザーと現行Role認可・鍵交換2操作へ更新し、Access Managementと認可済みDomain集約の境界を明示する。新Framework／Store／APIは作らない。

確認する母集団は通常管理・接続／自身表示・3可視境界、2操作×2入口、独立失効、処置前停止と処置後の発行失敗・応答／Process喪失、同じRecovery・現在再観測・Authority非復元・秘密非再表示・取消非証明。既存発行入口限定と新2操作の対応はDetails／Source照合待ちとし、Remote MCPの秘密発行公開やCLI固定を先取りしない。

必須確認集合は契約・品質の限定独立レビュー、差分・リンクと直接伝播確認。標準Rule・Source・外部Runtimeを変更しないため準拠監査、全テスト、実E2Eはこの段階では実施しない。旧Remote MCPのBearer・非開示・単体・Listener終了Evidenceは歴史比較として参照し、新方式のPassへ流用しない。他の既存資格／回復能力は次段で全Source／試験／Evidenceを対応付け、未照合を置換済みとしない。

7文書は限定独立レビュー済み。初回レビューで主要図の旧責務表示と子節番号の不整合を検出し、統合方針を両確認者へ照合して是正した。契約・品質の限定再レビューはともに残指摘0。差分空白確認とローカルリンク先確認も成功した。03〜08横断モデル、CROS／MCP／Workbench等のDetails、Quality・保存Schema・移行・Source・実境界は未追従。基本定義から全体Readyや実装可能状態を主張しない。

#### 鍵交換2操作のArchitecture横断モデル伝播 — 2026-10-10

基準Commitは`46e9ca95`。採用済みARCH-000013を03境界、04データフロー、05故障回復、06配置の4モデルへ是正伝播する。着手前整合確認は親と読み取り専用の契約確認者で行い、操作／入口の別軸、現在認可とDomain集約、処置前停止と失効後不明、Secret非耐久化を照合した。追加の人間判断は不要。日本語の操作・表示を基本とし、既存正式名とIDは必要な箇所で維持する。

編集の一次単位は境界・状態・失敗・配置の責務とし、全4モデルへ対象別に処置する。通常管理と独立失効、鍵交換2操作×2入口、現行Role、同名／改名、三可視境界、情報保持、失効確定／発行不明／結果受領、同じRecoveryの現在再観測を反映する。発火例はHostまたは全員交換の確認、非発火例は通常入口の指定ユーザー交換に追加確認なし、境界例は管理権限と内容閲覧の分離、情報不足例は必要状態不明で新Effect前停止。秘密発行の具体入口、画面／CLI、保存確定方式は決めない。ER局所ラベルは概念関係の表示であり保存Schemaを発行しない。

最初の固定範囲案は4モデルと入口・計画・PROJECT_CONTEXTの7文書だったが、現在状態を参照するComponent表とARCH-000013も状態表示だけ同期し、固定候補を9文書とする。07／08はaccess-managementのDetailsと配置を同時に接続する次段へ残す。未作成の詳細設計への架空リンクや、旧Coveredから新配置成立の推定をしない。

必須確認集合は契約・品質の限定独立レビュー、文書のリンク・用語・差分確認と、03〜06および現況参照の直接伝播確認。準拠規則・Source・外部Runtimeは変えないため準拠監査、全回帰、実E2Eはこの段階では実施しない。過去Evidence、Source、保存Root、Schema、新Store／Registry／Lock／Framework、Docker／Orchestrator／Coordinatorの実行系は変更禁止。現在は9文書を作成済み・限定独立レビュー済みであり、UI Exit、Architecture Ready、QA Handoff、詳細設計・実装完成を主張しない。 初回の契約確認で管理状態と派生認可集合の混在、図案内の漏れを検出し、品質確認の重複指摘と合わせ2件へ統合した。両確認者へ是正方針を照合し、2箇所を最小修正した後の限定再レビューは両観点とも残指摘0。ローカルリンク先の欠落0、差分空白確認成功。Source・過去Evidence・UI／SPEC正本2Hashは不変。

#### 旧CROSの移管前Source照合 — 2026-10-10

基準Commitは`2b5b1b76`。[移管対応表](source-owner-map.md)で18 srcと1 binの19入力を全数処置し、混在FileをSymbol群で分解した。対応表は移管分析でありArchitectureの第二正本ではない。Credential固定Grant・一資格rotation・Bootstrap新Identityは新ユーザー／Role／鍵交換契約に非互換で、単純移動できない。Portfolioの認可選択と純粋集約を分離し、活動・Profile・設定・Transportを実責務へ照合する。Tool／Surface／Handoff等は本番Consumer未観測として削除未決を保持する。

編集母集団は対応表、本計画、PROJECT_CONTEXT、旧CROS Details冒頭の現況表示の4文書。着手前の契約専門確認で着手可。旧根拠の対象版と成立能力を保持し、Source・秘密Store・Root・Schema・過去Evidence・実行系は変更しない。変更分類は既存CHGの移管前影響調査。契約と品質の限定独立レビュー、文書・直接伝播確認を実施した。規範・準拠基準・Sourceは変更しないため準拠監査・全回帰・実E2Eは対象外。3指摘を統合是正し、両観点の限定再レビューは残指摘0。現在は対応表作成済み・限定独立レビュー済み。Details／QA更新・Owner移管・置換実装・本番接続・旧削除・新契約成立は未完了。現在、追加の人間判断は不要。

#### Access Management詳細の意味具体化 — 2026-10-10

基準Commitは`dcebc3c0`。正式ARCH-000013、SCR-000008／PRT-000008.spec-000012、BHV-000012から[Access Management詳細](../../../06_Architecture/Details/access-management/01_Architecture.md)をCandidateとして具体化する。編集単位は新Details、07の本領域／ARCH13対応、旧cros冒頭参照、ARCH13現況、本計画、PROJECT_CONTEXTの6文書。着手前契約確認は着手可。新Detailsは意味・Owner・情報関係・要求毎認可・通常管理・独立失効・2操作×2入口・同じ回復と部分失敗・秘密境界・品質導出を所有する。

保存Schema、UUID版・名前制約、Role権限語彙、資格期限、具体API／入口、書込み確定・再入場・保持清掃はOPEN。既存Root・Verifier・競合拒否・不変publishは保持候補として照合するが、新保存の完成を主張しない。Source・秘密Store・旧Evidence・Domain詳細・初回Bootstrapは変更しない。移管対応表を設計の第二正本にしない。

変更分類は採用済み契約の詳細設計伝播。固定候補の必須確認は契約と品質の限定独立レビュー、文書・直接伝播確認。規範・準拠基準・Sourceは変更せず、準拠監査・全回帰・実E2Eは今回対象外。現在は作成済み・両観点の限定独立レビュー済み。07は本領域の部分接続だけで、08、Domain集約、MCP／Workbench新Details、Quality／Source・移行・新実境界は未完了。現在、追加の人間判断は不要。OPENを閉じる具体化が上流意味・Authority・秘密公開・保証範囲を変える場合は人間へ戻す。

初回確認の指摘は3件へ統合した。発行・結果記録の確定を配送／受領喪失で不明へ戻さず、故障処置と品質反証を別観測へ訂正した。現在投影の部分接続状態とChecklistのOPEN表示も同期した。両確認者との是正方針照合後、固定6文書の限定再レビューは契約・品質とも全重大度の残指摘0。Source・API・Schema・上流意味・旧Evidenceは不変であり、保存・公開入口等のOPENとCandidate／Partialを維持する。

#### 鍵管理の固定・ローカル入口・MCP非公開 — 2026-10-10

人間は後続対話で、鍵の発行・失効・交換をadministrator専用の固定操作とし、RoleのON／OFF設定を不要とした。通常の鍵操作は同一Process Workbenchから呼ぶ。Hostの回復CLIはログイン済みローカル操作者を信頼し、追加認証・専用資格・承認コード・OS管理者昇格を設けない。対象・影響の事前表示と既存確認は残す。Host入口は鍵交換2操作だけで、通常管理や独立失効を追加しない。既存Root・Path検証は維持する。

鍵発行・独立失効・交換は、Secretを返すか否かを問わずMCPへ公開しない。Tool一覧、Schema、登録、dispatchに含めない。生Secret非保存・一度表示、保持情報・同じ回復・部分結果は維持する。前案の6群すべて可変という判断と発行権限OFFの未決論点は、この判断で置き換えた。残るユーザー管理、Role設定、Repository登録、公開範囲管理の可変性は今回確定しない。

基準Commitは`ba578309`。変更分類は要求判断と公開・認可境界の変更。EXP-000036、REQ-000041、ARCH-000013、AM詳細、本計画、PROJECT_CONTEXTの6文書へ限定反映する。着手前契約確認は着手可・追加人間判断不要。固定候補の必須確認は契約と品質の独立レビュー、差分・文書・限定伝播確認。準拠規則・Sourceは変えないため準拠監査・全回帰・実E2Eは今回対象外。UX・IA・UI・SPEC・SCR／BHV・Architecture分析／横断モデル・07／08・Quality・Sourceへの再伝播は未完了で、前判断のPassを流用しない。実秘密Store・保存Schema・API・過去Evidenceは未変更。

限定独立レビューは契約・品質の両観点を完了した。初回の固有指摘3件（残る4管理群の未確定境界、UX引渡しの旧入口条件、現在状態への旧Pass表示）を統合是正し、同じ6文書の再レビューは両観点とも残指摘0。差分空白とローカルリンク先の存在確認も成功した。これは6文書の限定反映の完了であり、下流再伝播、Source、保存・公開API、実境界、全体Readyは未完了である。

#### 最新鍵管理判断のUX再伝播 — 2026-10-10

基準Commitは`5d9008e4`。REQ-000041だけを正式入力として、同REQのUX分析、UX-000035、UX横断5文書と本計画・PROJECT_CONTEXTの9文書へ限定伝播する。着手前契約確認は着手可。UX-000013は既存の現行権限に基づく非開示条件で追従できるため変更不要。既存の利用者成果・IDは維持し、鍵の固定administrator、Workbench通常入口、追加認証なしのHost交換2操作、MCP鍵操作非公開、4組表示・3組確認と他4管理群未確定を伝える。全入口同値は公開された操作範囲に限定する。

必須確認は固定候補の契約・品質独立レビューと、文書・リンク・差分・限定伝播確認。Source・QA・IA以降・標準規則・ひな型・過去Evidenceは変更しない。規則・実行系を変更しないため準拠監査・全回帰・実E2Eは対象外。現在は限定独立レビュー済み・残指摘0で、UX全体Ready・実装成立を主張しない。追加人間判断は不要。

#### UX再伝播の限定確認結果 — 2026-10-10

今回9文書の契約・品質限定レビューは両観点とも残指摘0。Checker確認で、UX-000035の状態と確認結果を別行へ分離し、REQ-000041分析の比較対象IDと統合理由を既存規則に適合させた。この局所2修正も両観点の再確認で追加指摘0。既存ID・成果・採用意味・Checker規則は変更していない。

全体Checker（`node 40_Develop/checker/bin/checker.ts --root . --json --summary`）は初回3,060件、形式是正後3,058件のerror、warning 0、Exit 1。対象はMarkdown 1,179ファイルで、全体Passではない。変更9文書に残る指摘はPROJECT_CONTEXTの`project-context-projection-contract-invalid`のみで、判定入力のIdentity・五場面見出し・Checklistは基準版と同じ。今回のUX契約レビューと、全体の既存機械不整合を分離する。完全JSON出力は通常検証の一時結果として保存せず、上記コマンドで再取得する。ローカルリンク先不存在0・差分空白確認成功。IA以降・Quality・Source・実境界は未伝播・未成立である。

#### 最新鍵管理判断のIA再伝播 — 2026-10-10

基準Commitは`bba2f8d6`。正式UX-000035から同UXのIA分析とIA-000009、横断4文書へ限定伝播し、UX-000013のIA分析は正式UXが持つ現行権限による可視性・責任表現へ補正する。本計画・PROJECT_CONTEXTを含む9文書が対象。既存ID・Objectと意味上の関係を維持し、鍵操作の固定administrator、Workbench通常入口、MCP鍵操作非公開、ログイン済みHost操作者の交換2操作、追加認証なし、既存Root／Path、4組表示・3組確認、他4管理群OPENを分ける。着手前の契約確認は着手可・追加人間判断不要。

固定候補の必須確認は契約・品質の独立レビュー、文書・リンク・差分と限定伝播確認。両観点とも再レビュー済み・残指摘0。UI／SPEC以降、Quality成果物、Source、標準規則、ひな型、過去Evidenceは変更しない。規則と実行系を変更しないため準拠監査・全回帰・実E2Eは今回対象外。以前の限定Passは最新判断の根拠に流用せず、全IA Ready・実装成立を主張しない。

固有指摘3件（入力元と統合後条件の混同、管理能力図の固定／可変関係、誤記）を一括是正した。Source Identity／Relationの21行を実分析へ全数一致させ、固定説明文とRecovery図のObject名を既存契約へ適合させた。契約・品質の再レビューはともに残指摘0。全体Checkerは初回3,058件、局所形式是正後3,056件error・warning 0・Exit 1で全体Passではない。変更9文書に残る指摘は基準版から判定入力不変のPROJECT_CONTEXTだけ。実行コマンドは前節と同じで、巨大結果は保存しない。ローカルリンク先不存在0、差分空白確認成功。IA以降の全体完成・Source・実境界は未成立。

#### 最新鍵管理判断のUI／SPEC定義再伝播 — 2026-10-10

基準Commitは`a7ec88aa`。UX-000013／UX-000035／IA-000009をそれぞれ独立した正式入力としてUI／SPECの6分析、UI-000008／SPEC-000012、UI横断4文書、SPEC入口・現行対応区画、本計画・PROJECT_CONTEXTの16文書へ限定伝播する。UX13分析へ他入力の鍵条件を逆輸入せず、Definitionで初めて統合する。旧32組のHash・引用・レビュー記録、既存ID、過去Evidenceは維持する。

着手前契約確認は着手可・追加人間判断不要。発行・独立失効・交換の結果を分け、固定administrator、Workbench通常入口、MCP鍵操作非公開、Hostログイン済み操作者の交換2操作、追加認証なし、既存Root／Path、4組表示・3組確認、他4管理群OPENを保持する。固定候補の契約・品質独立レビュー、対応照合、文書・リンク・差分・Checkerを必須確認とする。現在は限定独立レビュー済み・残指摘0。

SCR／BHV、Area、Workbench候補、Visual、Architecture／Quality／Sourceは次段で再伝播し、前判断のPassは最新判断へ流用しない。標準規則・ひな型・実秘密Store・Sourceは変更しないため、準拠監査・全回帰・実E2Eは今回対象外。UI／SPEC工程全体Ready・実装成立は未主張。

UI／SPEC定義再伝播の限定確認結果: 契約・品質の独立レビューは是正後ともにPass、残指摘0。現在状態と更新前固定版の履歴を分離し、OPENの箇条書きと履歴参照を修復した。差分空白・ローカルリンク確認は問題なし。全体CheckerはExit 1で、対象文書の既存構造・集合改訂版・Checklist判定等の16指摘が残るため、Checker Passを主張しない。旧32組のHash・引用・過去Passは保持し、最新1組の限定レビューと区別する。次はSCR／BHV・Area・Workbench候補へ伝播する。

#### 最新鍵管理判断のUI／SPEC詳細再伝播 — 2026-10-10

基準Commitは`3b7168f8`。UI-000008からSCR-000008内のPRT-000008全節、Area Guide、UI Detail入口・Workbench Screen Architecture追補へ、SPEC-000012からBHV-000012・SPEC Detail入口へ独立して具体化し、Detail対応の1 Relationを照合する。当初9文書に上位入口4文書と2Definitionの現在状態同期を加え、計画とPROJECT_CONTEXTを含む15文書を対象とする。新規発行・独立失効・交換を分離し、通常鍵操作の固定administrator・同一Process Workbench、MCP鍵操作非公開、Hostログイン済み操作者の対話交換2操作・追加認証なし・既存Root／Path、4組表示・3組確認、他4管理群OPENを保持する。

着手前整合確認は着手可・追加人間判断不要。専門観点の計画確認からPRT全節、MCP全体と鍵操作の区別、発行／独立失効／交換の結果差を照合対象へ含めた。固定15文書の契約・品質の限定独立再レビューはともに残指摘0。上流入力外の技術境界、上位文書の現況競合、AreaのOPEN処置不足を統合是正した。差分空白確認とローカルリンク先存在確認は成功（不存在0）、未変更31 Relationは基準版と一致。結果だけの状態同期後、2Definitionの現況更新に伴うHashを現行1組対応へ同期する。全体Checkerはerror 3,056件・warning 0・Exit 1、変更15文書の指摘は13件で未通過。限定レビュー結果をChecker全体Passへ読み替えず、全体判定の是正は後続へ残す。巨大結果は保存しない。旧Gate・Visual・未変更31 Relation・過去Evidenceを改変／最新Pass化しない。標準・ひな型・Source・Schema・実秘密Storeは変更せず、準拠監査・全回帰・実E2Eは対象外。Architecture／Quality／Sourceと実画面は後続未完了で、全体Readyを主張しない。

#### 最新鍵管理判断のArchitecture分析再伝播 — 2026-10-10

基準Commit `93cfba7b`。UI-000008／SPEC-000012の独立Architecture分析、ARCH-000013の直接同期、本計画とPROJECT_CONTEXTの5文書を対象とする。鍵3操作の固定administrator・同一Process Workbench、MCP鍵操作非公開、Hostログイン済み操作者の交換2操作だけ・追加認証なし、4組表示・3組確認、参照許可と鍵操作の区別、他4管理群OPENを保持する。新規発行・独立失効へ交換Recoveryを付与せず、交換の相関は旧失効前から同じIDへ結合する。採用済み入口と具体表示・案内の未確認を分離する。

着手前専門確認は着手可。ARCH-000013の旧管理認可・可視境界・入口分担も同期対象へ含めた。固定5文書の契約・品質独立レビューは状態表示の競合1件を共通原因として検出した。前固定版のPassと今回候補を分離し、統合是正後の両観点の限定再レビューは残指摘0。差分空白確認成功、ローカルリンク先不存在0。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回5文書内はPROJECT_CONTEXTの既知指摘1件のみであり、限定レビューを全体Passへ読み替えない。結果の巨大出力は保存しない。旧Evidence・Source・Schema・秘密Store・保存Root・標準・ひな型は変更していない。03〜08横断モデル・新Owner Details・Quality・本番接続は後続未完了とする。実行系・準拠規則を変えないため実E2E・Source全回帰・準拠監査は今回は対象外。現在、追加の人間判断は不要。工程Ready・実装成立・全体Passを主張しない。

#### 最新鍵管理判断のArchitecture境界再伝播 — 2026-10-11

基準Commitは`bcc51f72`。03境界モデルへ最新判断を再伝播し、01入口・02責務表・ARCH-000013の追従状態、本計画とPROJECT_CONTEXTの6文書を同期する。着手前の読み取り専用契約確認は着手可・追加人間判断不要。変更分類は採用済み意味の設計伝播と現在投影の同期。通常鍵操作とMCP一般経路を分け、固定administratorの同一Process Workbench、追加認証なしのHost対話CLI交換2操作だけ、MCP鍵操作の一覧・Schema・登録・dispatch非公開を保持する。他4管理群の担当Role・可変性はOPENとし、現在参照許可と鍵操作権限を混同しない。

新規発行・独立失効・交換を別境界・別結果として扱う。交換Recoveryは旧失効前から同じexact IDに結合し、失効・発行・結果記録・搬送・受領を分離する。発火例はWorkbench鍵3操作とHost交換2操作、非発火例はMCP鍵操作とHost発行・独立失効。通常入口の指定ユーザー交換だけ追加確認なし、残る3組は明示確認とする。対象不明・必要な既存administrator不存在・認可破損・安全な観測不能は新Effect前停止として照合する。

固定6文書の必須確認は契約・品質の限定独立レビューと、文書・リンク・差分・直接伝播確認。共通原因の2指摘（発行／独立失効の対象Identity、管理情報／資格のWriter範囲）を統合是正し、同じ6文書の契約・品質限定再レビューはともに残指摘0。04〜08、新Owner Details、Quality、Source、物理API／Schema／Store、保存Root、旧Evidence、標準・ひな型を変更しない。実行系や準拠規則を変更しないため、Source全回帰・実E2E・準拠監査は今回は対象外。全体Ready・実装成立・本番接続を主張しない。

境界再伝播の限定確認結果: 差分空白確認成功、6文書のローカルリンク102件を確認して不存在0。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回6文書の残指摘は基準版から保持するPROJECT_CONTEXTの契約指摘1件のみで、限定独立レビューを全体Passへ読み替えない。実行コマンドは既出の`node 40_Develop/checker/bin/checker.ts --root . --json --summary`。巨大出力は保存せず、次は04〜08と新Owner Detailsへ最新判断を伝播する。

#### 最新鍵管理判断のArchitecture横断モデル・対応表再伝播 — 2026-10-11

基準Commitは`77d86943`。04状態／データフロー、05故障、06配置の鍵断面、07詳細対応表のARCH-000013、08のSCR-000008／BHV-000012／`PRT-000008.spec-000012`の3行を更新する。01／02／03／ARCH-000013の案内、本計画とPROJECT_CONTEXTの同期を含む11文書が対象。着手前の読み取り専用契約確認は着手可・追加人間判断不要。変更分類は採用済み意味の設計伝播と現在投影の同期である。

新規発行・独立失効・交換の3操作を分け、対象資格のexact Identity、旧失効前の同じRecovery結合、失効・発行・記録・搬送・受領の別事実を反映する。確定発行を後続の記録・配送／受領失敗だけで不明へ戻さない。通常鍵操作は同一Process Workbenchの固定administrator、Hostは信頼したログイン済み操作者の対話CLI交換2操作だけで追加認証なし、MCPの全鍵操作は一覧・Schema・登録・dispatch非公開。他4管理群の操作主体・可変性はOPEN。4組表示・3組確認、保持情報と現在参照許可による非開示を維持する。

07／08はAccess Managementの意味Owner、Domain Modelの認可済みContext集約・中立なRoot／保存部品、Workbenchの通常鍵操作Surface、MCPの鍵操作非公開境界を分ける。08対象3行はPartialとし、新Owner Details・具体API／保存・本番接続の未完了を保持する。残り19 UI行・29 BHV行・31 Relation行、既存ID／Relationは変更しない。Docker／Task／一般Recovery、Source、Quality、物理Schema／API／Store、保存Root、旧Evidence、標準・ひな型は変更しない。

固定11文書の必須確認は契約・品質の限定独立レビュー、文書・差分・リンク・対象外Relation不変とChecker確認。共通原因の2指摘（発行／独立失効の処置前停止、操作別結果Ownerと交換限定Recovery）を05だけで統合是正し、固定11文書の契約・品質限定再レビューはともに残指摘0。新しい実行系・準拠規則を変更しないためSource全回帰・実E2E・準拠監査は今回は対象外。新Owner Details以降と全体Ready・QA Handoff・実装成立は未完了である。

横断モデル・対応表再伝播の限定確認結果: 差分空白確認成功、ローカルリンク210件の不存在0。08の対象外79対応行（19 UI・29 BHV・31 Relation）は基準版と完全一致、全82行と既存Identity／Relationを維持した。是正後の全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回11文書にはPROJECT_CONTEXTと08の既知契約指摘2件が残る。限定レビューを全体Coverage・Quality Readyへ読み替えず、新Owner Details・Quality・Sourceへの伝播で後続処置する。巨大実行結果は保存せず、既出のCheckerコマンドで再取得する。

#### 最新鍵管理判断のMCP詳細再伝播 — 2026-10-11

基準Commitは`4248f3bd`。MCP詳細、本計画、PROJECT_CONTEXTの3文書を初回候補とし、節名変更の直接参照を持つ旧CROS比較詳細とWorkbench詳細を加えた5文書を対象とする。両Detailsは当該参照段落とWorkbench直前の同じ鍵行だけを同期し、全面追従を主張しない。採用済み意味の設計伝播と現在投影の同期で、着手前の読み取り専用契約確認は着手可・追加人間判断不要。旧非秘密資格一覧・個別Grant変更・独立失効Tool候補を撤回し、MCPの鍵操作は一覧・Schema・登録・dispatch非公開とする。通常鍵3操作は同一Process Workbenchの固定administrator、Hostは追加認証なしの対話交換2操作だけ、初回Bootstrapと既存Root／Path検証は不変。

MCP要求のCredential認証は存続し、Access Managementが現在userId／Role・Exposure・Binding・実アクセスを評価する。Domainは認可済み集合の意味解析・集約だけを担当する。Profile／Activityの既存非鍵能力と型名は移管比較入力として維持し、旧systemAdmin・資格固定Grantを新Canonicalへ採用しない。他4管理群と新Role割当・具体型はOPEN。鍵断面の担当RelationはPartial、他Relationは今回再評価せず、旧Evidenceも不変である。

発火例は非秘密一覧・失効を含む鍵Tool公開要求、非発火例はMCPのBearer認証と認可済み非鍵能力。別Process WorkbenchもMCPでは鍵操作不能とする。管理群のRole・具体API・保存・本番接続不明はOPENのまま保持する。変更意味からMCP全登録閉包・直接Call拒否・鍵Owner呼出し0と認証継続のIT／ST観測をQualityへ渡すが、QA Local Item・Source・実境界は未更新である。

必須確認は固定5文書の契約・品質限定独立レビュー、差分・ローカルリンク確認。初回3文書のレビュー結果を全数統合し、旧Host全喪失語1箇所と直接参照2箇所・近傍の同じ旧鍵行を是正した。両レビューへ統合是正方針を再提示して整合を確認し、固定5文書の限定再レビューは両観点とも全重大度の残指摘0。差分空白確認成功、ローカルリンク77件の不存在0、旧アンカー参照0、MCP localhost Transport lifecycleは基準版と一致した。全体Checkerはerror 3,056件・warning 0・Exit 1で、今回5文書内はPROJECT_CONTEXTの既知指摘1件だけである。巨大結果は保存せず、限定Passを全体Passへ読み替えない。実行系・標準・秘密Store・Schema・Transport lifecycle／TLS／Originは変更しないため、Source全回帰・実E2E・準拠監査は今回は対象外。Workbench／Domain詳細、Quality、Source、本番接続は後続未完了。全体Ready・実装成立を主張しない。

#### Workbench／Domain詳細の新Owner境界再伝播 — 2026-10-11

基準Commitは`0f5b7765`。Workbench・Domain詳細と01／02／ARCH-000013／07／08の現在状態、計画・PROJECT_CONTEXTの9文書を対象とする。着手前の読み取り専用契約確認は着手可・追加人間判断不要。通常鍵操作の同一Process administrator固定、MCP全鍵操作非公開、Host交換2操作だけを維持する。交換4組表示／3組確認を通常発行・独立失効へ転用しない。Domainは認可済み集合の意味集約と中立なRoot／保存部品だけを所有し、認可状態・資格Secret・交換Recoveryを引き取らない。

固定候補の契約・品質独立レビューで固有3件（現行設計の旧認可語、交換の保持範囲、Domain末尾のRelation欠落）を検出し、全結果を統合した。冒頭の旧Quality観測表は全セルを履歴として保持し、現在導出と混在させない方針を両レビューへ再提示して是正した。限定再レビュー結果は次段落に記録する。具体API・物理Schema・保存・受領方式、Quality導出、Source・本番接続はOPEN。旧Evidence・Visual・UI／SPEC Identity・対象外Relation・既存Root／保存保証・初回構築は変更しない。Sourceや準拠規則を変えないため全Source回帰・実E2E・準拠監査は今回は対象外。差分・リンク・対象外不変とCheckerを確認し、限定設計伝播を全体Readyへ読み替えない。

限定確認結果: 意味上の固有3件と表構造の1件を是正し、固定9文書の契約・品質限定再レビューはともに全重大度の残指摘0。ローカルリンク229件の不存在0、08の全82対応行は基準版と一致。Workbenchの旧Quality観測8行とReality13行は全セル不変。差分空白確認成功。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。対象内はPROJECT_CONTEXTと08の既知契約指摘2件で、後続Quality／投影整合で処置する。巨大出力は保存しない。境界の設計候補伝播だけの限定完了であり、具体API・保存・受領方式、Quality・Source・本番接続・全体Readyは未完了。現在、この限定作業について追加の人間判断は不要。

#### 最新鍵管理・現在認可のQuality再導出 — 2026-10-11

基準Commitは`b6682e6b`。QA-000007／QA-000009、REQ（000011・000041）／UX（000013・000035）／IA-000009／UI-000008／SPEC-000012／ARCH-000013、SCR-000008／PRT-000008・BHV-000012・RelationとAM／Workbench／MCP／Domain詳細を入力母集団とする。着手前整合確認で検証責務の分離を補強し、追加人間判断なしで着手した。初回9文書の必須契約・品質レビューを全数統合し、表配置・適用と導出接続・現行認可・固定管理者負例・保持情報・交換再入場・到達範囲を是正した。統合方針は両確認者と整合済み、限定再レビューと4セル追従の最終確認は全重大度の残指摘0。

本段落は2026-10-11の鍵管理Quality再導出時点の履歴である。QA-000007／QA-000009と7工程分析の固定9文書で契約・品質の限定独立レビューを完了し、全重大度の残指摘0。新規4項目（RFD-IT-017通常発行、018独立失効、019認可済み集約、EST-ST-015 MCP鍵操作非公開）と既存更新項目はNot Runである。旧Evidenceは旧契約の歴史的証跡として維持し、新契約のPassに流用しない。現在のIT017／018はNode crypto技術部分だけSource／Test Symbol・候補局所実行接続済み。正式191項目／EvidenceはNot Run、保存・発行確定・失効・認証主体・現在Role・配送・本番入口は未接続。全体Quality Ready・Release可能を主張しない。

差分空白確認は成功。初回変更9文書のリンク872件は不存在0、Checker全体は既知error 3,056・warning 0・Exit 1で未通過。Source・設定・秘密・旧Evidenceは変更せず、実回帰・Provider／Docker実E2E・準拠監査は今回の文書設計対応では実行しない。後続は具体API・保存・受領契約と移管Source／Testへの接続であり、設計Passを実行Passにしない。

#### 業務管理と管理者資格・鍵の分担 — 2026-10-11

Qual-Labは、managerを業務上のアクセスを決める信頼された管理担当者とし、administratorを鍵と管理者資格の管理担当者とする分担を採用した。正式な操作別担当Roleは[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#要求)が所有する。manager自身の内容範囲も明示設定で変更可能とする一方、管理者資格の付与・解除・変更と鍵3操作はadministrator専用である。登録だけで公開せず、登録解除はProduct Dataを削除しない。Role設定による固定境界の迂回は許可しない。

変更分類は人間が採用した権限分担の要求への反映。基準Commitは`d6fc1844`。今回の編集対象はREQ-000041・本計画・PROJECT_CONTEXTの3文書だけとし、下流への伝播完了や実装成立を主張しない。着手前の読み取り専用契約確認は着手可・追加判断不要。表の全操作、manager自身の明示変更、administratorの降格拒否、登録と公開の分離を代表例として照合する。標準規則・Source・設定・秘密Store・旧Evidence・既存Host交換2操作・MCP鍵非公開は変更しない。ユーザー削除、委任Framework、承認Workflowは追加しない。

固定3文書の独立契約レビューと差分確認を行う。影響伝播は未完了としてUX→IA→UI／SPEC→Architecture→Quality→Sourceへ追跡する。旧4管理群OPENは履歴として保持し、今回の正式担当Roleへ置き換える。具体API・Schema・保存・初回設定・本番接続は未完了のままで、以前の限定Passを新判断の根拠に流用しない。Sourceを変更しないため実回帰・Docker／Provider E2Eは今回実行せず、CRDD準拠規則を変えないため準拠監査も対象外とする。

限定確認結果: 上流3文書の独立契約レビューで現在投影の旧OPEN残存1件を検出・是正し、同じ3文書の限定再レビューは全重大度で残指摘0。差分空白確認成功、ローカル参照45件の不存在0。Source・秘密・旧Evidenceは不変。これは担当Role判断の上流反映だけの確認であり、下流伝播・実装・Quality・実境界は未完了である。

#### 権限分担のUX伝播 — 2026-10-11

基準Commitは`d6fc1844`と、その後に採用済み判断を反映・限定独立レビューした上流3文書の作業差分。正式入力はREQ-000041だけとする。分析・UX-000035・横断5文書に業務管理と管理者資格・鍵の分担を伝播し、本計画とPROJECT_CONTEXTを同期する。既存UX-000035へのSame統合とし、UX-000013は現在Role／Exposure／実アクセスの成果が不変のため変更不要とした。新UX・権限語彙・画面・API・Schema・保存方式を追加しない。

着手前の契約・品質確認はともに着手可。manager自身の明示範囲変更、変更前の現在権限と次要求反映、administratorの降格を含む変更拒否、developer管理拒否、登録≠公開、解除≠Product Data削除を、担い手・Same比較・導線・責任境界・失敗・品質期待・引渡し・検証意図へ接続する。鍵MCP非公開、Workbench通常鍵管理、Host交換2操作、名前非Authority、三可視境界、単体非依存、既存Recovery条件は保持する。

固定9文書の契約・品質独立レビューと文書／リンク／差分確認を行い、全結果統合後に是正する。IA以降・QA Local Item・Source・本番接続・実境界は未完了。以前のPass・旧Evidenceを新判断へ流用しない。Source・実行境界・準拠規則を変更しないため、実回帰・Provider／Docker E2E・準拠監査は今回対象外とする。

限定確認結果：契約・品質の独立レビューは最終ともにPass、残指摘0。初回4件と再確認2件を統合是正し、担い手の冒頭説明、資格喪失条件、鍵3操作の検証・引渡し、登録・登録解除、旧確認結果の履歴限定、交換ごとの発行先を明確にした。既存UX IDとSame判断は不変、差分確認は成功した。Checkerはerrors 3,056・warnings 0で未通過であり、対象内のPROJECT_CONTEXT形式指摘も残る。この限定結果を全体の機械検査Pass・QA実行・Source実装・本番接続・Release可能の根拠にしない。次はIA以降へ最新分担を伝播する。

<a id="quality-role-propagation"></a>

## 最新権限分担のQuality伝播 — 2026-10-11

基準Commitは `14b51821`。採用済み固定8操作と通常6操作をQA-000007／009、7工程分析、Quality Center、本計画、PROJECT_CONTEXTの12文書へ伝播する。変更分類は採用済み要求の検証設計・現在投影更新。着手前の契約・品質の読み取り専用確認は両方着手可・追加人間判断不要。固定管理許可と可変内容権限、managerのadministrator表示名のみ変更、管理許可≠内容取得、登録≠公開、解除≠削除、通常管理にはadministrator存在を要求しない条件を維持する。

| 検証責務 | 処置 | 段階／観測境界 |
|---|---|---|
| 固定8操作×三Roleの純粋判定 | RFD-UT-020追加 | UT／外部境界N/A |
| 通常6操作の入力・変更前認可・保存・読戻し | RFD-IT-021追加 | IT／Direct Boundary |
| Workbench公開入口から結果表示・次要求まで | RFD-ST-022追加 | ST／System/E2E |
| 利用者による分担・対象・受理と利用可否の理解 | RFD-UAT-007更新 | UAT／User Acceptance |
| 採用済み非鍵入口の搬送同値、非採用入口非公開 | EST-IT-010更新 | IT／Related 2 Blocks |

鍵操作のRFD-ST-016／IT-017／IT-018、内容認可のST-003／004／IT-013、Domain集約IT-019、MCP鍵非公開EST-ST-015の責務は保持する。新規・更新項目はNot Run。各Sourceの固有条件、段階、Local Itemを全7分析へ接続する。現在のLocal Itemは定義内ID重複排除で182→185件、QA-000007は19→22件。旧Evidence・ID・Source・Test・秘密・保存Rootは変更しない。

固定12文書を契約・品質の独立レビューへ渡し、全結果を統合してから是正する。文書・直接伝播・参照・表構造の確認を行う。実装・標準規則を変えないためPackage実回帰・Docker／Provider E2E・準拠監査は対象外。Quality Integration全体の一覧追従、具体API・保存・Source・Test・実境界は後続であり、全Quality統合完了・Quality Ready・Release可能は主張しない。Profile管理Roleは別途OPEN。現在、人間による追加判断は不要。

限定確認結果：契約・品質の初回指摘を統合して7点を是正し、再確認の表現1箇所も処置した。最終は両観点とも限定Pass・全重大度の残指摘0。ローカル参照938件は欠落0、185 Local Itemの再集計とQA7検証表13列の連続性を確認。差分空白確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は結果と待ち状態のみ同期する。新規・更新項目Not Run、具体API・保存・Source・Test・本番接続・全Quality統合とReady未成立は維持する。次は具体的な公開API・保存契約の設計照合であり、旧Evidenceを改変せず、不要なFrameworkやRecoveryを増やさない。

<a id="architecture-role-detail-propagation"></a>

#### 権限分担のArchitecture詳細伝播 — 2026-10-11

基準Commitは`8a50c3c0`。AM／Workbench／MCPの3詳細だけへ採用済みARCH-000013の固定8管理分担を具体化し、ARCH-000013・横断01〜08の9文書は現在状態だけ同期する。本計画・PROJECT_CONTEXTを含む固定14文書を対象とする。着手前の読み取り専用契約・品質確認はいずれも着手可・追加人間判断不要。変更分類は採用済み意味の詳細設計への直接伝播で、新しい権限・一般IAM・Frameworkは追加しない。

編集の一次単位は認可・操作別入力・処置・結果・非公開の責務である。AMの固定管理認可とRole内容設定、通常6操作、managerのadministrator名前だけ変更、変更前認可→明示更新→次要求の内容評価、登録≠公開／解除≠削除、通常管理と鍵処置の固有条件を分ける。WBは入力・表示、MCPは非鍵要求搬送だけを具体化し、鍵の一覧・Schema・登録・dispatch非公開を維持する。Profile管理Role・具体API／Schema・保存・本番接続はOPEN。通常管理の保存後不明を未保存・rollback・Effect0へ丸めず交換Recoveryを追加しない。

固定14文書の契約・品質独立レビューと文書・直接伝播・参照・差分確認を実施する。代表照合は固定8分担×三Role、操作別対象、manager正常管理に管理者存在不要、Host追加認証なし、自己内容変更の時間順、通常失効の対象限定、内容・登録・公開・削除の別意味である。Quality導出キー・安定ID・07／08のPartial・他Relation・歴史Evidenceを維持する。Source・実行境界・準拠規則を変えないためPackage回帰、Provider／Docker E2E、準拠監査は対象外。候補反映・限定独立レビュー済み・残指摘0であり、全体Ready・Release可能は主張しない。

限定確認結果：初回は契約Minor 1・品質Pass 0。全結果と是正方針を一括統合し、AM詳細の未確定範囲を示す2箇所を内容権限の具体語彙へ限定した。最終は契約・品質とも限定Pass・全重大度の残指摘0。ローカル参照245件は欠落0、差分確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果の状態のみ同期する。次はQualityへの最新分担伝播で、Source・本番接続・全体Readyの未完了を維持する。

<a id="architecture-role-model-propagation"></a>

#### 権限分担のArchitecture基本設計・横断伝播 — 2026-10-11

基準Commitは`2e5462bf`。正式意味入力はUI-000008／SPEC-000012のArchitecture分析2件、SCR／BHVは配置制約の照合に限定する。ARCH-000013と横断01〜08の9設計文書、本計画とPROJECT_CONTEXTの計11文書を固定対象とする。採用済み分担の直接伝播で、契約・品質の着手前確認はともに着手可・追加人間判断不要。Details・Quality・Source・設定・過去Evidence・他ARCH-ID・非対象Relationは変更しない。

ARCH-000013を固定8分担の統合正本とし、横断はComponent所有、交換境界、操作別入力・時間順、失敗、実行単位、Detail対応の固有断面へ投影する。変更前の現在管理認可→明示更新→次要求の内容再評価、管理≠内容、登録≠公開、解除≠削除を維持する。通常管理と鍵処置の停止条件を分け、manager正常管理にadministrator存在条件、Hostに追加資格認証を要求しない。Role内容設定による固定管理分担の再委譲を設けない。

固定11文書の契約・品質独立レビュー、文書・直接伝播・参照・差分確認を行う。代表照合は8操作×三Roleの許可／拒否／不明、managerのadministrator名前のみ変更、developer管理拒否≠自身利用拒否、操作別対象、自己内容変更の時間順、登録／公開／取得と解除／削除、鍵3操作の過剰Effect反証。旧鍵契約Passは履歴であり、今回候補は独立レビュー待ち。実行境界・Source・準拠規則を変更しないためPackage回帰・Provider／Docker E2E・準拠監査は対象外。07／08のPartialと非対象行を維持し、Architecture詳細・Quality・Source・本番接続・全体Readyは未完了。

限定確認結果：初回は契約Moderate 1・Minor 1、品質Pass・残指摘0。全結果と是正方針を一括統合し、表示名の旧設定主体表現1件・文境界空白2件を是正した。最終は契約・品質とも限定Pass・全重大度の残指摘0。ローカル参照212件は欠落0、差分確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果の状態のみ同期する。ARCH-ID・非対象RelationとPartialを維持し、旧Evidenceは不変。次はAccess Management／Workbench／MCP等のArchitecture詳細へ最新分担を伝播する。Quality・Source・本番接続・全体Readyの未完了は維持する。

<a id="architecture-role-analysis-propagation"></a>

#### 権限分担のArchitecture入力分析伝播 — 2026-10-11

基準Commitは`ea99450f`。UI-000008／SPEC-000012のArchitecture分析2件を、それぞれ自身のDefinitionだけから更新する。本計画・PROJECT_CONTEXTの状態同期を含む固定4文書が今回の範囲である。変更分類は採用済み分担の直接伝播。契約・品質の着手前整合確認はともに着手可、追加人間判断は不要。ARCH-000013・横断モデル・Architecture詳細・Quality・Source・設定・過去Evidenceは変更しない。

固定8管理操作を現行Roleから判定し、Role内容設定と分離する。UI分析は対象認識・操作・Feedback、SPEC分析は操作別入力・処置前認可・Effect・結果へ接続する。managerのadministrator表示名変更は許可、管理者付与・解除・降格・詳細権限・鍵は拒否。新規登録は予定Role、既存Role変更は前後Role、内容設定は対象Role、Repository管理は登録／公開状態を用いる。manager自身の変更前認可→明示更新→次要求で現行Role・Exposure・実アクセス再評価、管理≠内容、登録≠公開、解除≠削除を保持する。

固定4文書の契約・品質独立レビュー、文書・直接伝播・リンク・差分確認を行う。代表例は8操作×三Roleの許可／拒否、administrator名前のみ変更、登録予定Roleと既存前後Role、自己範囲変更の時間順、対象／現在認可不明の新Effect前停止である。既存鍵3操作・Host／MCP・秘密・交換専用Recoveryを保持し、developer管理拒否を自身表示・許可内利用拒否へ広げない。新API・Schema・一般IAM・Recoveryは追加しない。Source・実行境界・準拠規則を変更しないため、Package回帰・Provider／Docker E2E・準拠監査は対象外。固定候補提出時は限定独立レビュー待ちであった。分析2件の確認をArchitecture全体Ready・実装・QA実行の成立へ読み替えない。

限定確認結果：初回の契約Moderate 1・品質Minor 1を一括統合し、両確認者へ是正方針を再提示して整合した。通常管理と鍵処置の停止条件、PROJECT_CONTEXTの部分伝播表示を是正。最終再レビューは両観点とも限定Pass・全重大度の残指摘0。ローカル参照49件は欠落0、差分確認は成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果と状態のみ同期する。ARCH-000013・横断モデル・Architecture詳細・Quality・Source以降は最新分担へ未追従であり、次はARCH-000013と横断モデルへ伝播する。

<a id="ui-spec-role-detail-propagation"></a>

#### 権限分担のUI／SPEC詳細伝播 — 2026-10-11

基準Commitは`e3df322d`。正式入力は限定独立レビュー済みUI-000008／SPEC-000012。SCR-000008、BHV-000012、configuration-trust Area、Workbench画面体系の現行§13、UI／SPEC詳細対応、詳細入口2文書、本計画とPROJECT_CONTEXTの固定9文書を対象とする。契約本文・Hashが固定されたDefinition、旧G1〜G5、非対象31 Relation、過去Evidence、新ID・Visual候補・Architecture／Quality・Source・設定・秘密Storeは変更しない。

変更分類は採用済み分担の詳細化・直接伝播。親照合と契約／品質の着手前確認を統合し、詳細入口の状態追従2文書を補強した。初回編集前確認は両観点で着手可・追加人間判断不要。固定8操作をUI操作表とBHVのInput・Authority／Validation・Effect・Outputへ接続する。登録予定Roleと既存変更前後Role、表示名だけの変更、Role内容設定、Repository登録／公開状態を分ける。managerによるadministrator表示名変更は許可するが、administrator付与・解除・降格・詳細権限・鍵は拒否する。developer管理拒否を自身表示・許可内利用の拒否へ拡張しない。

manager自身の範囲変更は変更前の現行固定管理認可→明示内容更新→次要求のRole・Exposure・実アクセス再評価とする。更新受理≠取得成立、管理≠内容自動付与、登録≠公開、解除≠Repository／Product Data削除を保持する。現在認可・対象・必要状態不明は新Effect前停止。鍵3操作のWorkbench／Host／MCP境界、4組事前表示・3組明示確認、既存交換専用Recoveryは不変で、新IAM・一般Recoveryを追加しない。

固定9文書へ契約・品質独立レビュー、文書・リンク・直接伝播・ID・差分確認を行い、両結果を統合してから是正する。代表例は8操作の各Role許可／拒否、managerのadministrator名前のみ変更、登録予定Role、Role変更前後、manager自己内容変更の時間順、対象／現在認可不明、鍵操作の範囲外Effect非発行である。Source・実行境界・準拠規則を変更しないため、Package回帰・Provider／Docker E2E・準拠監査は今回対象外。固定候補提出時はレビュー待ちであった。詳細設計の限定確認を実画面・保存・認可実装・QA実行・本番接続・全体Readyへ読み替えない。

初回固定9文書の結果は契約Moderate 3・Minor 1、品質限定Pass・残指摘0。全結果を統合し、両確認者へ是正方針を再提示して整合した。Repository操作のTrigger列挙、鍵失敗の保持条件の適用範囲、最新8操作のArchitecture／Quality引渡し未伝播範囲、空行を是正した。9文書のローカル参照373件は欠落0、旧G1〜G5本文・非対象31 Relationは不変。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。新固定候補の再レビューと最終局所確認は契約・品質とも限定Pass・全重大度の残指摘0。最後のSPEC詳細入口のArchitecture／Quality責務分離も確認済みである。確認後は固定9文書の限定結果・状態だけを同期した。旧結果を最新候補のPassへ流用せず、実画面・本番認可・QA実行・Source・実E2E・全体Readyは未成立のまま保持する。次はArchitectureへ最新分担を伝播する。

<a id="ui-spec-role-propagation"></a>

#### 権限分担のUI／SPEC定義伝播 — 2026-10-11

基準Commitは`9ecad6ea`。正式入力はUX-000013／UX-000035／IA-000009。UX35／IA9のUI分析・SPEC分析4文書、UI-000008／SPEC-000012定義、UI横断01／02／03／05、SPEC横断01／06、本計画とPROJECT_CONTEXTの固定14文書を扱う。UX13分析・ID集合・Detail／Visual・Architecture／Quality・Source・設定・秘密Store・過去Evidenceは不変更。SPEC横断02〜05は担当Roleの旧規則を持たない一般モデルであり、今回意味を追加せず参照先の定義で精緻化する。

変更分類は採用済み分担の下流詳細化・直接伝播。着手前の契約／品質確認を統合し、UIの正式引渡しを対象に補強した。各分析は正式入力一件から独立導出し、定義で統合する。8操作固定分担、managerの管理者表示名変更と管理者Role変更の別、自己範囲の変更前認可→明示更新→次要求反映、登録≠公開・解除≠削除を操作・事前条件・結果・拒否・検証意図へ接続する。固定管理能力をRole内容設定から派生させず、設定による管理委譲を追加しない。鍵3操作・MCP鍵0・Host交換2・4表示3確認・既存Recovery境界は維持する。

代表照合はmanager業務管理許可、administrator表示名変更許可、managerの管理者付与／解除／降格／詳細権限／鍵拒否、developer管理拒否、対象／現在認可不明の新Effect前停止。UI表示だけで認可を代替せず、内容範囲更新受理を取得可能・開始済み取消へ拡張しない。対応レビューは現行1組を8観点で確認し、旧32組・Hash・引用・Passは履歴として維持する。

固定候補の契約／品質独立レビュー、文書・直接伝播・リンク・ID・差分確認を行う。全必須レビュー結果を統合してから是正する。標準規則・実行境界・Sourceを変更しないため準拠監査、Package回帰、Provider／Docker実E2Eは今回対象外。固定候補提出時は作成者照合済み・独立レビュー待ちであった。Detail以降・QA実行・Source・本番接続・全体Readyは未完了。現在追加の人間判断は不要。

限定結果：契約／品質独立レビューの統合6指摘と再レビューの表現1指摘を是正し、最終は両観点とも限定Pass・全重大度の残指摘0。Host回復の発火条件、鍵3操作の結果差、新規登録と既存変更の前提差、過剰Effectの反証、現行／履歴の区分、レビュー入力Hashを精緻化した。最終状態同期前に確認した16文書の参照先832件は欠落0、旧32組の対応本文と旧Hashは不変、新ID・Source変更なし。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は状態と結果記録のみ同期し、UX35定義ヘッダー・UX概要の2箇所もUI／SPEC定義限定確認済み／Detail以降未伝播へ追従した。レビュー入力と状態同期後のDefinition Hashは現行対応へ別記した。Detail・Visual・Architecture／Quality・Source・本番接続・全体Readyは未完了。次はSCR／BHV・Area・Workbench候補の詳細伝播である。

#### 権限分担のIA伝播 — 2026-10-11

基準Commitは`c04ccd69`。正式入力は限定レビュー済みUX-000035であり、UX-000013の利用成果・分析は不変。UX35のIA分析、IA-000009定義、IA横断4文書、本計画とPROJECT_CONTEXTの固定8文書に限定する。変更分類は採用済み権限分担の下流詳細化・直接伝播。新しいIA ID・Object・API・Schema・Source・秘密Store・旧Evidenceは変更しない。

着手前の契約・品質確認はともに着手可。既存IA9へSame統合し、Source欄のUX13意味を保持してUX35由来の固定担当Roleを精緻化する。8操作の許可／拒否、manager自身の変更前認可・明示範囲更新・次要求反映、administrator表示名変更と管理者資格変更の分離、登録≠公開・解除≠削除をObject属性・関係・導線・可視性・時間関係・検証意図・引渡しへ接続する。鍵3操作の結果差、Host交換2操作、MCP鍵0、既存Recovery境界は不変。判定情報不足は許可へ畳まない。

代表照合はmanagerの業務更新を許可、managerのadministrator降格・developer管理を拒否、administrator表示名だけの変更を許可、現在権限・対象不明は停止。固定候補の契約／品質独立レビュー、文書・直接伝播・リンク・ID・差分確認を行い、全結果統合後に是正する。標準規則と実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは今回対象外。UI／SPEC以降・QA実行・Source移管・本番接続・全体Readyは未完了。現在追加の人間判断は不要。

限定確認結果：固定8文書の契約・品質独立レビューは最終ともにPass、全重大度の残指摘0。固定管理能力をRole詳細権限から派生させない図、一次IAモデルの鍵3操作結果、横断投影の文境界を統合是正した。参照先152件は欠落0、既存ID集合は不変、差分確認は成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過（対象内PROJECT_CONTEXTの形式指摘を含む）。レビュー後は結果記録と状態同期だけを行い、上流UXの未伝播表示2箇所もIA限定確認済み／UI・SPEC以降未伝播へ直接追従した。これは契約本文の再変更でも全体Readyでもない。実回帰・実E2Eは未実行、QA実行・Source・本番接続は未完了。次はUI／SPECへの伝播である。

#### 管理権限の初期割当 — 2026-10-10（6群表全体が旧提案の履歴）

以下は現在の割当契約ではない。鍵3操作は後続判断でadministrator専用固定へ置換し、他管理群は2026-10-11の業務管理と管理者資格・鍵の分担で確定した。当時の未確定表示を現在判断として使わない。

人間は、管理操作を以下の6群として個別設定し、初期状態ではadministratorだけへ許可する案を承認した。後からRole設定を変更できる。ユーザー／Credential単位の追加権限とRole継承は追加しない。

| 管理操作群 | administrator初期値 | manager初期値 | developer初期値 |
|---|---|---|---|
| ユーザー登録・表示名／Role変更 | 許可 | 不許可 | 不許可 |
| Role詳細権限変更 | 許可 | 不許可 | 不許可 |
| 資格発行・独立失効 | 許可 | 不許可 | 不許可 |
| 指定ユーザー／全員の鍵交換（通常入口） | 許可 | 不許可 | 不許可 |
| Repository登録管理 | 許可 | 不許可 | 不許可 |
| Repository公開範囲管理 | 許可 | 不許可 | 不許可 |

既存内容範囲の初期値（developer=Development、manager=Development＋Management、administrator=内容なし＋System管理）はREQ-000041の採用意味を保持する。管理と内容閲覧を分離し、Hostの鍵交換はOS Authorityとして上表の外に置く。Task・AI依頼・Git Push・受入判断をこの6群へ含めない。現在Roleの変更前権限と期待改訂で変更要求を認可し、変更結果を次要求から使う。機械キー・Schema・保存・公開API・Sourceは未変更である。

当時の着手前確認では、administratorから資格発行権限を外せる設定と全員交換後の再発行との境界を未確定とした。これは後続判断で鍵操作を固定契約としたため、現在の判断待ちではない。仮説だけを理由に権限保護の追加ガードや回復機構を作らない。

変更分類は採用済み管理権限の詳細化と未決境界の記録。基準Commitは`ba578309`。今回の追記は判断履歴であり、AM詳細の第二正本ではない。正式REQ・UX以降の設計・品質・Sourceへの伝播は未着手。新しい認可Framework、共有State、Lock、秘密Store、旧Evidence変更は行わない。後続では契約・品質の限定独立レビューと直接伝播を確認し、標準規則・実行系を変更しない段階では全回帰・実E2Eを完成根拠として要求しない。

#### 採用前のInput整理（履歴）

以下の未確定表示は追加Inputを受けた時点の記録であり、現在の採用範囲は上記を優先する。

人間は、接続主体、`developer`／`manager`／`administrator`のRole、およびRoleに対する詳細権限設定を分ける構造を希望した。さらにユーザーの独立IDとCredentialの紐付け、Credentialのリセットを提示した。これは既存の「ユーザー管理なし・Role別共有Credential」とも、現行Sourceの「Credential単位の明示Grant」とも異なる方向であり、Package改名だけの変更として扱わない。先の固定三Role維持というAI推奨を、この新Inputの採用判断へ流用しない。

| 項目 | 人間から確認できた方向 | AIの具体化候補／未確定事項 |
|---|---|---|
| 接続主体 | Credentialとは独立したユーザーIDにCredentialを紐付ける | 非秘密の`userId`をUUIDとする。UUIDの具体版、表示名、発行・無効化の操作は未確定 |
| Roleと権限 | ユーザーのRoleとRoleに対する詳細権限設定を分ける | Repository／Workspace／操作範囲と管理能力をRole設定へ置き、Credential単位で任意の追加権限を作らない案。権限語彙・一ユーザーに割り当てるRole数は未確定 |
| Role識別名 | 人間は`developer`／`manager`／`administrator`を提示した | 既存`management`から`manager`への正式識別子変更と保存移行は未実施。名前の置換だけで権限意味を変更しない |
| Credentialリセット | ユーザーへの紐付けを持ち、リセット可能にする | ユーザーID・Roleを保持し、旧Credentialを失効して新しい秘密値を発行する。旧Credentialの以後の接続を拒否する案。既存の進行中操作の取消を自動的に保証せず、開始済みEffect・再認可の境界は設計で照合する |
| 管理規模 | 詳細な登録Workflowは今回のInputでは要求されていない | 最小構成はユーザーID・Role・Credential紐付けのみとし、氏名・メール・Password・登録申請・外部IdPを追加しない提案。v0.22に含める最小範囲について認識確認待ち |

担当責任者・採用判断者はQual-Lab。このInputは同じCHGのAccess Management再編へ接続し、新しいCHGやIAM Frameworkを作らない。正式採用時はREQ-000041のUser／Principal管理対象外と任意Grant不採用判断を確認して、UX／IA／UI／SPEC／ARCH／QAへ伝播する。既存CredentialをUUIDユーザーへ機械的に移すか、再発行するかは保存・秘密保護の影響を確認して決める。実秘密値を調査資料・Git・Project Contextへ複製しない。Source、秘密Store、保存Schema、Roleの意味、過去Evidenceはこの記録更新では変更していない。


#### 初回Host設定のQuality分析伝播 — 2026-10-11

基準Commitは`4933f9d4`。採用済み初回設定をREQ／UX／IA／UI／SPEC／ARCH／Detailの7品質分析へ伝播し、本計画・PROJECT_CONTEXTと合わせた固定9文書を扱う。変更分類は採用済み設計からの検証義務導出・直接伝播。着手前契約確認は着手可、追加の人間判断なし。

REQ〜ARCHは対象Source各1複合義務、Detailは3処置行として未接続差分を明示する。これは必要Local Item数ではない。正の成立・保存・回復はQA-000007、MCPの四面と状態照会非公開はQA-000009へ引渡す候補。ARCHだけ初回純粋判定のUT Required候補を保持し、固定8管理操作のRFD-UT-020を流用しない。既存185項目の件数・過去限定Passと新義務の充足を区別する。未定義をNot Runや差分0へ畳まない。

初回編集前に両方の未初期化確認、既存管理状態の拒否、観測不能、部分発行、受け渡し／受領不明、同じ元試行の再観測と別の明示交換を照合した。秘密・Store・Root・旧Evidence・Source・新ID・QA Definitionは不変更。固定9文書の契約／品質独立レビュー、文書・直接影響・参照・差分確認を実行する。標準規則・実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは対象外。レビュー完了後に結果を同期してPhase単位でコミットする。契約・品質の限定独立再レビューは両方Pass、全重大度の残指摘0。四状態表記、Process喪失時の新Process再観測、UTと外部境界の別軸、追加文の空白を統合是正した。参照先849件欠落0、非対象の対応表439行不変、差分確認成功。結果・状態だけを同期し、初回義務の定義・実行・全体Readyは未成立を維持する。次はQA-000007／QA-000009でSame／New／Mergeを評価し、DefinitionとLocal Itemを確定する。


#### 初回Host設定の検証項目定義 — 2026-10-11

基準Commitは`d4fc6f86`。QA-000007／QA-000009、7工程分析、Quality Center／Integration、本計画・PROJECT_CONTEXTの固定13文書を扱う。変更分類は採用済み義務の検証設計と直接伝播。着手前の品質確認は着手可、追加人間判断なし。初回5項目をNew、MCP非公開はEST-ST-015へSame統合する。純粋判定／保存直接境界／新Process再観測と別交換引渡し／実Host縦断／利用者達成は独立に計画・結果記録でき、通常管理の前提・入口と異なるため分ける。新しいQA-ID・API・Store・Source・秘密Root・旧Evidenceは変更しない。

UTはARCH由来だけ、ITは相関確定前Effect0と既知Root準備Effectの別、3時点Process喪失・同元試行新Process読戻し・現在Host再照合・両確定後だけ別明示交換、STは一度配送／受領／通常接続を個別観測、UATは四状態・次行動・正常達成を確認する。MCPの4面と状態照会0・Bearer継続はQA-000009が所有する。旧未定義Gapは定義接続だけ解消し、新規・更新項目Not Runと実装／実行未完了を維持する。

必須確認は契約・品質独立レビュー、文書・直接影響・全数対応・ID／段階／参照・件数確認。標準規則と実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは今回対象外。実装Gateは保存・配送観測等の具体化を残す。全結果統合後に是正し再レビュー、結果同期後にPhaseコミットする。今回13文書の契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。工程別接続数、前段と今回の結果時点、段階別判定、公開MCPからの初回Owner／状態Reader呼出し観測を是正した。全13定義190項目、QA-000007は27項目、差分確認成功。新規・更新項目Not Run、Source／Test・保存・受領・清掃・本番接続・新Evidenceは未完了を維持する。次は保存・公開入口の具体化とSource／Test実接続である。

#### 初回Host状態の純粋判定実装 — 2026-10-11

基準Commitは`cd18eb0b`。保存Gateと資格期限が未確定のため、初回Hostの実保存・鍵発行・入口実装は先行しない。当初範囲はAMの純粋判定SourceとUT、公開Root、既存公開集合Oracle、Package試験入口、Symbol、AM詳細02、本計画・現在投影の9File。品質レビューで試験台帳登録と現在投影の漏れを検出し、既存台帳・QA-000007・Center・Integration・ARCH／Detail分析の6Fileを直接是正へ追加して固定15Fileへ拡張した。変更分類は採用済み四状態・開始条件の実装詳細化。Current Repository onlyで、Host管理Root・秘密・Docker・Provider・旧Evidence・旧CROSの実処理は不変更。

着手前整合確認は必要とし、親の正本照合と読取り専用品質確認で着手可・追加人間判断なし。編集一次キーは観測分類→四状態／開始条件／次処置、ARCH-000013→RFD-UT-023→Source／Testの接続である。管理未初期化＋進行試行不存在＋明示開始だけ開始候補、同元試行の確認済み途中は再観測、既存は拒否、片側欠落・不明・矛盾は停止。`same_attempt`の分類は呼出側の照合済み入力で、本関数から保存・Identity・Host Authorityを証明しない。進行試行と完了履歴を分け、未実装の保存Ownerを置換済みとしない。

構造評価: Variationは四状態、Common Contractは単一同期関数、Creation／Selectionは返却値のみ、State-dependent Behaviorは入力分類に閉じる。Composition／RecursionはN/A: 外部処理を合成・再帰しない。Lifecycle OwnershipとExternal BoundaryはN/A: Handle・共有状態・I/Oを取得しない。ConcurrencyはN/A: 共有状態なし。TimingはN/A: 時刻・期限を判定しない。Failure／Observabilityは未知分類を停止結果として保持する。Securityは結果を実行Authorityにしない。実装知識の上位還元はN/A: 新しい保証は追加せず、既存の四状態を技術的入力分類へ対応した。

必須確認はAM Packageのformat・type・lint・全UTと、契約／品質の限定独立レビュー、文書・直接影響・Symbol参照・差分確認。標準準拠規則は不変更のため準拠監査は対象外。I/O・実処置は未接続のためHost実試験・署名・Docker／Provider E2Eは実行せず、必要な後続Gateへ残す。Node v24.19.0でローカルキャッシュから固定開発依存を配置し、静的3軸と7 UT（既存4＋初回3）は成功。初回には24組合せを含む。正式Local Item評価はNot Run、保存・資格・Host入口・本番Consumer・全体Readyは未成立。固定15Fileの契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。台帳の登録漏れと現在投影の矛盾を是正した。試験台帳は当該ID・Path各1件で実在、差分確認成功。結果状態だけを同期し、この実装単位をコミットする。
# AM管理対象別の現在読取り — 2026-10-12

基準Commit `fd2ff9e1`。採用済み通常管理の四対象読取りを具体化する。親の正本・Source・既知Consumer照合と読取り専用専門確認を統合し、追加人間判断なし。四literalのkindだけを入力とし、不正kindはLock前にEffect0で拒否。既存保存Ownerの同じLockで完全current→認証→初回completedと対象認可／DTO準備→許可後の短命材料照合→解放確認へ接続する。`management/read-state.ts`は純粋投影と閉DTOだけを持つ。管理者の内容範囲0でも管理参照は可能、管理≠内容を維持する。接続表示はrepositoryId/bindingIdの非AuthorityだけとしRootを公開しない。Exposureは全登録順、未設定null・明示空[]・設定済み範囲を分ける。

AM全51 Case・静的3軸成功、固定11ファイルの限定独立レビューPass・全重大度残指摘0。既存RFD-IT-013／021／024へ3 Caseを追加し全Role×全kindの完全DTO・現在Role・初回途中拒否・種類外情報0・材料保持・清掃／解放不明を確認した。本人read・既存認証・State Schema・実Host・鍵・旧Source・歴史Evidenceは不変更。新Framework・Store・Lock・MCP公開を追加しない。必須確認はAM全回帰・限定契約／品質独立レビュー・文書／Symbol／台帳／現在投影・直接影響・差分確認。最終Node v24.19.0の`npm test`は51/51成功、Fail／Cancel／Skip0、34.7896128秒、exit0。対象は基準`fd2ff9e1`からの11ファイル、レビュー時差分hash `6825bd2eb2b8242df5f566fcb8424d23bafc605c`、新Source SHA-256 `188F57D1C4C86C965F587CD357751B6066EE19EF79544C8DE8D40CB86394B520`。完全stdoutは同じコマンドで再生成可能として実行ごとの書庫は追加しない。結果表示だけ同期する。標準規範は不変更のため準拠監査、実Surface未接続のため署名Provider E2Eは対象外。内容実アクセス認可・鍵管理・配送・本番接続、191項目正式Not Runを残す。

# AM本人の現在権限読取り — 2026-10-12

基準Commit `41cce35f`。変更分類は採用済み読取り契約のSource接続・直接伝播。親の正本照合と読取り専用専門確認を統合し、追加の人間判断なし。既存保存Ownerの同じLock内でcurrent検査→資格照合→認証後の短命材料照合→本人投影→解放確認を接続する。`access/current-access.ts`は純粋投影と固定DTOだけを所有する。管理候補は既存10操作・対象Roleの固定分担を使い、内容範囲∩Exposureが空のRepositoryは返さない。初回途中でも本人表示は可能だが管理実操作・初回完了には昇格しない。

実Host・鍵実処置・既存認証の清掃順・保存Schema・Lock・旧Source・過去Evidenceは不変更。新Framework・公開MCP操作は追加しない。管理対象別読取りの接続表示Schemaは次工程へ残す。必須確認はAM全回帰・静的3軸、契約／品質の限定独立レビュー、Symbol／台帳／現在投影・直接文書・差分確認。標準準拠規則は不変更のため準拠監査、実Surface未接続のため署名Provider E2Eは対象外。191項目正式Not Runを維持する。初回試験で公開export集合の追従漏れと、失効した初回資格を完全Schema不正でなく通常失効として期待した試験前提を是正した。独立レビューで交差後Workspaceの観測不足Moderate1を是正し、両Workspace公開からRole別の狭まり・非秘密2キーを完全tupleで確認した。最終Node v24.19.0の`npm test`は静的3軸・全48 Case成功、Fail／Cancel／Skip0、32.2402851秒。基準`41cce35f`からの固定11ファイルの限定独立再レビューPass・全重大度残指摘0、差分確認成功。完全stdoutは同じコマンドで再生成可能とし、実行ごとの書庫は追加しない。結果状態だけ同期し段階コミットする。

# AM鍵生成・照合の技術層 — 2026-10-12

## 後続: 要求毎の認証主体解決

基準Commit `c2472e2e`。配送回答待ちと独立して認証主体を接続する。読取り専用整合確認で、Lock外Snapshot解決案は現行契約と不一致として退け、既存private locked内の専用入口を採用する。保存Ownerがcurrent検査・pending照合→純粋資格照合／現在User／Role投影→解放確認を担当し、鍵差はcredential/authentication.tsへ閉じる。Rootには専用入口と固定型だけを公開し、汎用callback／Session／Store／Lock Frameworkを追加しない。

RFD-IT-013前半とIT024初回非更新へ2 Caseを接続、AM全35 Case・静的3軸成功。現在投影4箇所の同期漏れと句点後空白2箇所を是正し、固定13ファイルの限定独立再レビューPass・残指摘0。設計／品質／台帳／Symbol直接伝播と差分確認成功。最新段落の追加だけで既存の現在表示を同期済みとせず、固定候補前に現在表示と履歴の区分を全直接影響先で照合する。新しい監査Frameworkは追加しない。標準準拠規則不変更のため準拠監査は非該当、実Host／公開Surface／Provider未接続のため実E2Eは後続Gateへ保持する。配送・受領判断、内容認可・管理実処置・本番接続は未完了、191正式Not Run。実Host Store・旧Source・旧Evidence・初回鍵保存処置は不変更。

## 後続: 初回資格保存の局所接続

基準Commit `01d5ce3e`。先行した読取り専用整合確認に従い、AM既存保存Ownerと公開Root、既存RFD-IT-024試験を変更する。容量予約→一生成→完全資格・初回credential_storedの同改訂出版→読戻し→既存Lock解放を接続する。元発行はattemptId、出版操作は別UUID。再入場は保存済み資格IDだけを返し、生鍵を復元しない。cleanup不明の部分結果に生鍵を含めない。実Host Store、旧Source、旧Evidenceは変更せず、新Root／Lock／Receipt／回復Frameworkは作らない。

AM全33 Case・静的3軸成功。直接投影の同期漏れModerate1を是正し、固定10ファイルの限定独立再レビューPass・全重大度の残指摘0。直接伝播・差分確認成功。標準準拠規則不変更のため準拠監査は対象外、Host／Provider本番未接続のため署名・Docker／Provider E2Eは後続Gateで行う。配送方式の人間判断と認証・現在認可・本番接続は別段階であり、この保存部分から191項目正式Passや全体完了を推定しない。

基準Commitは`5d012458`。読取り専用着手前整合確認で、技術層と初回保存は採用済み契約内で着手可、新しい人間判断なし。配送方式は後段の判断として分離し、cleanup不明の部分結果へSecretを追加しない。変更分類は既存暗号方式の責務移管準備と直接品質接続。User保存・旧Source・実Host Store・旧Evidenceを変更しない。

単一`credential/token-material.ts`で12byte ID・32byte Secret・16byte salt、cros.v1形式、固定scrypt、形式・同長比較を扱う。Role・保存・配送・期限・回復Frameworkを引き取らない。Package Rootだけで明示公開し、capability barrelを追加しない。既存Sourceは比較入力であり本番fallbackにしない。

RFD-IT-017／018の技術部分に2 Caseを追加しAM全29 Case・静的3軸成功。固定vectorと暗黙既定の一致、明示options、不正形式の暗号処理0、誤Secret・Runtime故障を確認した。必須確認は限定契約／品質独立レビュー、文書直接伝播・Symbol／台帳・差分確認。標準準拠は不変更、保存／本番未接続のため実Host・署名・Provider／Docker E2Eは対象外。191 Not Run・鍵管理全体未成立を維持する。固定13ファイルの限定独立再レビューPass・全重大度の残指摘0。旧現在表示4箇所を同期し、結果状態だけ更新して段階コミットする。

# AMユーザー・Role管理4操作の着手前照合 — 2026-10-12

基準Commitは`14826a3a`。採用済み通常管理のうち、ユーザー登録・表示名変更・Role変更・Role内容範囲更新を先行接続する。変更分類は既存意味・分担の実装具体化。配送判断と独立して着手でき、追加人間判断は不要。親の正本・Source・既知Consumer照合と読み取り専用専門確認を統合した。基準AM全35 Case・静的3軸の再確認は成功したが、以下4操作の実装結果ではない。

汎用`updateAccessManagementState`のcallbackを直接使う案は採用しない。現在のcallbackはbytesだけを返すため、認可拒否をthrowや不正bytesで表すと通常拒否が保存・清掃故障へ誤分類される。また、callback内UUID生成は容量確認に先行してしまう。既存APIの契約は変更せず、既存private保存部品を使う用途限定処理とする。新しい汎用callback、二段preflight、Lock、Receipt、履歴、回復Frameworkは作らない。

| 所有箇所 | 接続する責務 | 保持する境界 |
|---|---|---|
| `management/user-role.ts`候補 | 4操作の閉じた入力、現在認証・固定管理分担と対象の純粋判定、意図したfieldだけを変える候補構築 | Filesystem・Lock・保存・公開応答を所有しない。再export専用Fileにしない |
| 既存`state/file-store.ts` | 同じLock内の現在読取り・前材料照合・期待改訂・認証・管理許可・対象・容量・生成・完全parse・出版・読戻し・解放 | 既存private部品を再利用し、通常管理専用処理に限定する |
| Package Root | `registerUser`、`updateUserName`、`changeUserRole`、`updateRoleContentAccess`と必要な閉じた型を明示公開 | raw内部Snapshot・資格材料・Lock参照を公開管理結果へ透過しない。本番Surface接続は別Gate |

登録User UUIDは認証・管理許可・対象・正確なcurrent／pending容量確認後に一回だけ生成する。固定長の非採用placeholderで容量を計算し、生成後の完全候補もparse・容量確認する。衝突や生成故障は書込み0・再生成0。他3操作は乱数不要で、明示受付operationIdを使う。容量計算は既存出版部品と共有し、同じ上限を二重実装しない。

認証・管理許可成立前は固定非開示拒否だけとし、対象存在、改訂、出版事実、Lock回復参照を返さない。成立後だけ今回の非秘密な操作相関、期待／観測／採用改訂、今回の出版、清掃結果を投影する。前操作pendingの処置で確認した出版を、今回入力operationIdのEffectへ結合しない。前材料を処置した要求は今回更新0で止まり、再観測／再要求へ戻す。既知出版後の清掃・解放不明は未完了のまま既知Effectを保持し、Rollback・暗黙再更新を行わない。

反証対象は、三Roleと各対象Role、誤鍵・失効・未知資格、改訂競合、途中初期化、欠測対象・変更前Role差、不正名・未知／重複範囲、余分field・Proxy・accessor、不正相関、容量超過、UUID衝突／故障、出版前後・清掃・Lock解放故障、先行pending処置である。拒否時のUUID／書込み0、成功時の対象field以外不変、資格・初回・未解決交換・Repository／Exposure保持、結果への秘密・内部Path非搬送、全所有材料の終了後条件を確認する。最後のadministrator保持条件は採用されていないため、新たなguardを追加しない。

品質接続は既存RFD-IT-021の4操作部分とする。登録／Exposure管理、内容認可、Host／Workbench／MCP本番Consumer、ST／UATは残り、191項目正式Not Runを維持する。実Host Store、鍵実処置、初回・配送、旧Source・過去Evidence、Docker／Providerは不変更。限定独立レビュー、Package回帰、公開集合・Symbol／台帳、設計／品質／現在投影への直接伝播・差分確認を行う。標準規範を変えないため準拠監査、実Surface未接続のため署名Provider E2Eはこの局所段階では実施しない。4操作は現時点で未実装であり、この計画を接続完了やレビュー済み実装として扱わない。

上段は着手時点の状態である。通常4操作をSource・公開Root・Symbol・台帳へ接続し、既存保存ITに6 Caseを追加した。AM全41 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。公開関数を保存Ownerへ置き純粋意味Ownerを一方向に呼ぶことで循環依存・薄い中継を作らない。準備byteの構築だけを既存出版と共有し、登録以外の生成0・登録の容量前生成0・相関分離を実観測する。初回レビューの2原因と表現1件を是正し、現在認可・対象・期待改訂を先行材料の清掃前へ移した。誤鍵・developer・改訂競合・禁止対象のbase／next材料byte保持、巨大文字列・配列の詳細走査前拒否を確認した。実Host・旧Source・旧Evidenceは不変更。36組は試験内の分担組合せであり、36 Local Itemや正式Pass件数ではない。

# AM初回管理者保存の局所接続 — 2026-10-12

基準Commitは`61146288`。変更分類は採用済み初回User段階のSource接続と直接伝播。着手前の読取り専用確認でcanonical baseline・同User再入場・生成前入力検査・容量予約・既存Lock・物理出版だけの共通化を照合した。追加人間判断なし。対象はAM詳細02、AM Source公開入口と保存部品、既存UT／IT、QA-000007・Center・Integration・本計画・現在投影。旧Evidence・実Host Store・Secret・鍵・Docker／Providerは不変更。

相関revision1からUser IDと別出版IDを生成し、`user_stored`を保存・読戻しする。同User再入場は追加UUID／User／名前更新0。通常更新の認可・期待改訂・変更許可は維持し、共通化はpending→replace→current→読戻し→清掃だけとする。新Root、Lock、Receipt、履歴、回復Frameworkを作らない。

必須確認は静的3軸・AM全回帰、契約／品質の限定独立レビュー、文書直接伝播・差分・試験Root不存在確認。標準準拠規則は変更しないため準拠監査は対象外。鍵・認証・本番Host未接続のため署名／Docker／Provider E2Eは実行せず後続Gateへ残す。初回全体や191項目の正式Passへ昇格しない。

初回限定レビューで出版前拒否の清掃事実とUUID0 Oracleを各1件、User経路の競合／解放不明／材料観測不足を1件検出した。既存構造内で結果分類を是正し、直接件数・User固有Process境界を追加確認した。既存Lockのbusy拒否と全join後再入場を区別し、新しい待機機構は追加しない。品質投影の旧現在表示6箇所と試験件数を同期し、AM全27 Case・静的3軸成功、固定10ファイルの限定独立再レビューPass・全重大度の残指摘0。結果だけ同期して段階コミットする。次は鍵生成・照合と初回鍵保存、本番Root／認証／Consumerの接続である。

# AM保存の項目・容量・段階具体化 — 2026-10-12

基準Commitは`fa2f4ffc`。読取り専用の着手前照合で、Repository Bindingは既存Owner分離で具体化可能、操作単位の内容権限は上流未定義と確認した。今回は採用済みDevelopment／Management範囲だけを固定し、新しい操作別認可を追加しない。current 16 MiB／pending 17 MiBを割当制限として採用し、個別件数制限・履歴Storeを追加しない。

変更対象はAM詳細02、QA-000007、本計画、現在投影。初回排他的作成・相関先行・User保存・資格記録・配送を分け、通常保存のpending処置を鍵処理へ一般化しない。秘密Store、ACL、Source、過去Evidenceは不変更。契約・品質・直接影響の限定独立確認と差分確認を行う。標準規則・実行系を変更しないため準拠監査・Provider／Docker E2Eは今回対象外。

方針具体化と実装完了を分ける。全判別Unionの機械Schema、公開API対応、状態組合せ検査、保存Adapterと本番Consumer接続・局所試験は残る。現在、この固定範囲について追加の人間判断は不要。

固定4文書の契約・品質・直接影響限定独立再レビューはPass、全重大度の残指摘0。通常発行の相関保存先不足、初回baselineと閉Schemaの矛盾、旧OPEN表示の時点競合、QA見出しを是正した。通常発行は完全Credentialと元発行IDを同時出版し、新Receiptを作らない。ローカル参照先不存在0・差分確認成功。正式試験190項目・Not Run、Source／実Store未変更と後続実装Gateを維持する。

## AM状態Schemaの純粋実装 — 2026-10-12

基準Commitは`0fca0c92`。状態Schemaとbytes parserをAMのstate/parse.tsへ配置し、Package Rootから明示公開する。新しい通常Receipt、不完全Credential、履歴Store、Lock Frameworkは作らない。内容語彙・容量の採用済み契約、未解決交換中の資格整理禁止、初回完了後の歴史的参照を具体化する。着手前読取り専用照合は条件付き着手可・追加人間判断なしで、条件を設計へ反映した。

RFD-UT-028をNew導出し、ARCH／Detail分析、QA定義、Symbol、試験台帳、Quality Center／Integrationを接続する。純粋検査と保存ITを分離する。構造評価: Variationは段階変種、Common Contractは単一bytes parser、Creationは所有JSON値、State-dependent Behaviorは段階相関、Compositionは閉集合の局所検査、Lifecycle／External BoundaryはN/A: I/O・外部資源なし。新しい上位意味は追加せず、実装知識の還元は既存詳細の機械形状への具体化に限定する。

Node v24.19.0でFormatter・type・warning禁止LintとAM全11 Case成功（新4 Case）。正式191項目評価はNot Run。必須確認は契約・実装・品質・直接影響の限定独立レビューと差分・参照確認。標準規則不変更のため準拠監査、I/O未接続のため実Host・署名・Docker／Provider E2Eは今回実行しない。実Host Store・ACL・旧Evidence不変更。保存Adapter／公開API・鍵実処置／本番Consumer・実境界試験は残る。

限定独立再レビューはPass・全重大度の残指摘0。交換対象集合の全数一致、全員交換の受領者Role、完了初回の保持資格の配送事実を是正した。有効資格0件からのHost交換は集合一致で許可し、存在しない最小件数を要求しない。全体Checkerでは3058件を観測し、今回変更Pathの2件を照合した。新UTのID表記漏れは是正し、PROJECT_CONTEXTのChecklist表現不一致は基準Commitにも存在するため今回の局所完了と分離する。他Pathの指摘はこの段階で基準版差分を確定しておらず、全体Passは主張しない。巨大な実行結果の書庫は作らず、局所判定と未完了範囲だけを保持する。

是正後のChecker再確認は3057件、今回変更Pathは上記の基準版由来Checklist指摘1件だけで、新UTのSymbol接続指摘は解消した。

## AM初回相関保存の局所接続 — 2026-10-12

基準Commit `672ffe68`。採用済み初回保存契約の実装具体化として既存検証済みRootの最初の相関保存だけを接続する。親の正本照合と読取り専用専門確認で着手可、追加人間判断なし。同元試行の完全baseline再観測と旧観測callbackの排他・同期read-only境界を計画へ統合した。既存Root準備・旧入力の本番観測・User UUID・鍵・配送・Host入口は対象外で、通常保存の自動破棄を初回へ一般化しない。

編集一次キーはARCH-000013の初回相関→既存state保存Owner→RFD-IT-024保存部分→公開Root／Symbol／台帳／現在投影。新規、明示開始なし、既存・途中・unknown、残存材料、partial、同元試行、別元試行を別処置とする。現在値はwx排他的作成後に完全Schemaと正確byteを読戻す。Process喪失は部分write後とclose後readback前、競合は二Process採用一件、解放失敗は既知出版保持を実観測する。Root・Lock・保存部品は前段を再利用し、新しいFramework・Receipt・履歴は追加しない。

必須確認は実Filesystem／Process局所試験、形式・型・Lint、契約・実装・品質の限定独立レビュー、文書・直接影響・公開集合・Symbol／台帳・差分確認。標準規則不変更のため準拠監査、鍵／Provider／Docker／本番Host未接続のため署名E2Eは実行しない。実Host Storeと旧Evidenceは不変更。AM全23 Case・静的3軸成功。固定12Pathの独立レビュー待ち。191項目正式評価はNot Run、初回全体・認証・鍵・本番接続は未成立。

固定12Pathの限定独立再レビューはPass・全重大度の残指摘0。runtime入力をLock・JSON化前にprimitive検査し、getter／toJSON非実行と作成0を確認した。古い未実装表示を候補履歴へ限定し、UT023＋IT024相関部分と後続未接続範囲を分離した。静的3軸・23 Case再成功、差分確認成功、自己生成試験Root残存0。Checkerは前段と同じ3057件、今回変更Pathは既存PROJECT_CONTEXT形式指摘1件。その他の基準版差分は未確定で全体Passを主張しない。局所範囲をPhaseコミットし、次は初回のRoot準備・User／鍵後続段階・認証・本番Consumer接続へ進む。

## AM内容実アクセスの局所接続 — 2026-10-12

基準Commit `3842ade3`。採用済み現在内容認可の実装具体化として、同改訂の資格／User／Role内容範囲／Exposure／登録から、既存VC RootとDomain固定manifestへ接続する。親の正本照合と読取り専用専門確認は条件付き着手可、追加人間判断不要。技術的Root能力の今回要求限定使用、Lock内bounded観測と解放後本文取得、認可前／pending異常時の外部観測0を契約へ具体化した。新Framework・Store・Session・Lock・Host操作は追加しない。

編集一次キーはARCH-000013内容認可→AM保存Owner→既存VC／Domain観測→RFD-IT-013局所試験→Symbol／台帳／現在投影。必須確認は静的3軸、Package全回帰、固定候補の契約・実装・品質限定独立レビューと直接伝播／差分確認。標準規則不変更のため準拠監査、本番Consumer未接続のため署名E2Eは今回実行しない。旧CROS・実Host・秘密Store・歴史的Evidenceは不変更。正式191項目Not Runを保持し、本番Consumerが次要求に能力を使い回さない接続とDomain集合搬送は残件とする。

局所結果: Node v24.19.0の`npm test`で静的3軸と全54 Case成功、失敗／取消／skip0、Exit 0、所要38.2869794秒。固定9ファイルの限定独立再レビューPass・全重大度残指摘0。Binding不一致をSchema-validとするレビュー反例は既存Parserが拒否するため訂正・撤回し、改ざんcurrentのparse拒否・対象観測0・byte不変・材料0を同Caseで確認した。基準HEADは実行前後`3842ade3`、新Source SHA256 `dd7c72e67df5b83558d4579f00b6a5bffd5ac210cdd302c8d268f697f9299191`、tracked差分Hash `a670f87561125cbefad40a4e8306a2d109c8a412`。結果全文は端末出力で、上記コマンドから再生成し実行ごとの書庫は増やさない。差分確認成功・自己生成試験Root残存0。状態投影はこの結果だけを同期し、本番Consumer・Domain搬送・鍵管理・配送・正式191項目・全体完成は未成立を維持する。

## AM登録・公開範囲管理の実装接続計画 — 2026-10-12

初回独立レビューのMajor 1件は、登録Rootと固定Fileの容量上限欠落だった。方針を確認者へ再提示・整合後、既存Domain観測Ownerの同じdescriptorへ任意容量上限を追加し、AM登録だけ各1 MiBを指定した。RootはPath処理前32,768 code unit以下を確認する。巨大Root観測0、manifest／Contextの個別上限+1、上限内Context、保存0・開閉一致を追加確認した。AM45件・Domain113件は全成功、失敗・取消・skip0、各静的3軸成功。Domain回帰所要40.289秒。未指定Consumerは不変更、実Host・旧Evidence・191正式Not Runを維持し、追加のModerate 1件は新しい容量引数の不正値反例不足で、既存RCM-UT-014へ不正Capabilityと0／負数／小数／NaN／Infinity／非safe integerを組合せ、Root解決より先の拒否を追加した。Sourceは不変更、両Package全回帰・静的3軸を再成功した。固定18ファイルの限定独立再レビューPass・全重大度の残指摘0。

現在結果: Package公開3操作・Symbol・台帳へ接続し、既存実Filesystem ITへ4 Caseを追加した。`npm test`（Node v24.19.0、Package既定の直列実行）は45成功・失敗0・取消0・skip0、静的3軸成功、所要32.147秒。対象は基準`4402c487`に今回のSource／試験差分を加えた作業Tree。認可前観測0の正対照、Identity不一致、登録≠公開、解除≠本文削除、空Exposure、先行材料保持・今回更新0、出版後清掃不明を確認した。結果全文は端末出力で、実行ごとの書庫は増やさず同じコマンドから再生成する。固定18ファイルの限定独立再レビューPass・全重大度の残指摘0。実Host・本番Consumer・正式191項目・全体E2Eの完成証明ではない。

基準Commit `4402c487`。採用済み登録・解除・Exposureの3操作を接続する。親の正本／Source照合と読み取り専用専門確認を統合し、着手可とした。登録時は現在認証・固定管理許可・期待改訂・未登録を確認した後だけ外部Rootを観測する。Version Controlのexact Git Root検証、Domainの固定File観測・Canonical manifest解析・Project Context解析を再利用し、双方のprojectId／repositoryId／repositoryRole一致を要求する。Binding式はAMのSchemaと候補で共有する。登録は公開0、解除は旧Rootの観測0で登録と対応Exposureを同じ改訂から除く。本文・Product Dataを変更しない。

Exposureは既存登録とdevelopment／managementの明示集合だけ。空集合も既存Schemaどおり明示的な公開範囲0として保持し、未採用の空record禁止を追加しない。Rootの観測は登録時点の事実で、取得時の再検証を代替しない。通常保存・短命pending・既存Lockを再利用し、Framework・Store・一般Registry・回復機構は追加しない。

編集一次キーはARCH-000013の登録／解除／Exposure→同じ保存Owner→既存RFD-IT-021・IT001／002／012の部分接続→Source／Symbol／試験台帳→直接現在投影。認可前観測0、偽Git・link・欠測・Identity不一致、登録≠公開、解除対象外不変、Root消失時解除、容量・出版／清掃故障、先行材料相関を確認する。実Filesystem回帰、静的3軸、契約・実装・品質の独立レビュー、文書・直接伝播・差分確認を必須とする。標準規則不変更のため準拠監査、Host／Workbench／MCP未接続のため実E2Eは後続へ保持する。191正式Not Run、旧CROS・旧Evidence・実Host管理データは不変更。

## AM通常保存Adapterの局所接続 — 2026-10-12

基準Commitは`d47d6855`。変更分類は採用済み通常保存契約の実装具体化。保存・Process喪失・秘密境界へ影響するため、着手前に親の正本照合と読取り専用専門確認を行った。pending包絡を同じPathで状態byteへ上書きする案は相関喪失の反例により不採用。既存構造の最小解として一件の短命replaceを使い、固定serializerと4 Path再入場表をAM詳細へ還元する条件で着手可。追加人間判断は不要、新Lock／Receipt／履歴／Recovery Frameworkを作らない。

実装範囲は既存Rootのcurrent読取り・通常更新・保存材料の再入場。Root作成、初回出版、認証・鍵実処置、旧Store移行、本番Workbench／MCP接続は対象外として保持する。認可は将来利用側が同じ同期callback内で照合し、Root Capabilityや状態parseからAuthorityを生成しない。鍵・初回・資格の保持条件を通常更新で検査する。

確認対象はSource／公開Root／Package試験入口／Symbol／試験台帳、RFD-IT-021接続、AM詳細、本計画、現在投影。必須確認は契約・実装・品質の限定独立レビュー、文書・直接影響・参照・差分確認と実Filesystem局所試験。標準規則不変更のため準拠監査、Provider／Dockerを扱わず本番入口未接続のため署名実E2Eは今回対象外。全体Checkerの前段3057指摘を解消したとは扱わない。旧正式Evidenceと実Host管理データは不変更。

通常保存、改訂競合、不正候補、base／next／unknown再入場、実子Process喪失、出版後清掃・Lock解放不明を局所確認する。静的3軸とPackage全試験を通した後、固定候補を限定独立レビューへ渡す。全体保存／初回／鍵／認可Capabilityは未完了のまま、局所範囲だけPhaseコミットする。

固定13Pathの限定独立再レビューはPass、全重大度の残指摘0。callbackの同期・認可評価・メモリ候補限定と外部／永続Effect 0を契約へ明記し、Schema-validな資格・交換・既存User除去の拒否とpartial pending保持停止を追加確認した。Node v24.19.0でformat・type・warning禁止Lintと全19 Case成功（保存IT 8、既存UT 11）。実子Process終了と自己生成試験Root残存0、差分確認成功。Checkerは3057件、今回変更Pathは基準版にも存在するPROJECT_CONTEXTのChecklist指摘1件で、他Pathの基準版差分は未確定。全体Passは主張しない。正式191項目評価はNot Run、実Host Store・旧Evidenceは不変更。次は初回Root／出版、認証・鍵実処置と本番Consumer接続の残件を扱う。

## 許可集合から実本文への搬送 — 2026-10-12

基準`7642b4dd`の許可集合を実本文と中立Sourceへつなぐ局所接続を行う。既存Domain Reader成功結果に本文Snapshot相関revisionを追加し、同descriptorの安定読取りで解析したUTF-8 textからSHA-256を一回算出する。固定prefix、同text同値、同解析結果でも空白変更なら別値、失敗の版非返却を直接確認する。AM集合の管理改訂やGit HEAD、Stable ID、生byte同一性、署名・認可の証明にしない。AM既存ITで許可集合→各Reader一回→4項目Source→Portfolioを搬送し、空認可の本文0・本文不明の固定停止を確認する。

着手前専門確認は着手可・追加人間判断不要。既存RFD-IT-019／PPR-IT-019・002の部分接続、Domain／AM回帰・静的3軸・固定候補の限定独立レビューと直接文書整合を実施する。現在Schema、認可、Lock、旧Evidence、null／missingの旧意味、失敗理由集合は変えず、Store／Framework／履歴を追加しない。成功Readerの公開型に必須revision追加があり、既知Consumerは当該試験と今回搬送試験だけなので同時追従する。標準規範不変更の準拠監査、実Surface未接続の署名E2Eは対象外。本番MCP／Workbench、性能／lifecycle、鍵管理／配送、旧REST撤去、正式191項目、AM全体完成は残る。

局所結果: Node v24.19.0の各Packageの`npm test`でDomain118／AM57、計175 Case成功、Fail／Cancel／Skip0、両Exit0。Domain41.6481471秒、AM45.6357766秒。各静的3軸成功、Domain試験の同値concat→template同期後も静的3軸と直接3 Case再実行成功（0.7463208秒）。最初のBiome書込みはOS1224で不成立、同じ処理の再実行で解消した。初回値を成功結果へ混ぜない。固定8Pathの限定独立レビューPass・全重大度残指摘0、基準HEAD `7642b4dd`、固定tracked差分Hash `3742ea562c6901c31e5863dcaf05530905bdde72`、Reader SHA256 `69c90539b948fbfc1cf076b848580c9a6df6cb741b615d8886f1497cce042dae`、Domain直接試験SHA256 `05ef5a9982c0fa05111717c1945ce89736848165e9205113a7f78adfe674fcea`、AM搬送試験SHA256 `68b8fc7307c935ca31ac9142b8d33bdaac3629378ee87dd5cb4acdb071e85d3d`。差分空白確認成功、自己生成AM／Domain Reader試験Root残存0。完全出力は上記コマンドで再生成できるため実行別書庫を追加しない。結果同期だけを行い、本番Consumerと実failure集約停止、正式191・全体完成は未成立を維持する。

## 活動取得の新Owner接続に向けた現行照合 — 2026-10-12

### 現在認可MCPと直接利用側の実装候補 — 2026-10-12

最新局所結果：更新候補の固定22Path限定独立再レビューはPass・全重大度残指摘0。Node v24.19.0、各Packageの`npm test`でMCP66／CROS34／Orchestrator91／AM59／Workbench33の計283 Case成功、Fail／Cancel／Skip0、全Exit0。各書式・型・Warning禁止Lint、Workbench Build成功。所要はMCP46.8986723秒、CROS7.3977354秒、Orchestrator UT2.3874662秒＋IT17.8614216秒、AM69.6410548秒、Workbench134.9554538秒。基準HEAD `021eec11fb1a15c0ccfa79adbed92f9967169a65`を維持。新CROS読取りSHA256 `acb0c68c9013c417b36191ffd46110cc31e615beb58f2ae637f880afeb6e17ad`、実AM HTTP試験SHA256 `b29c1363379e410f4f5d9475fadadec0881a5d7e7b242d6942f8ebea06e6cc47`。全回帰後のTest Headerは説明3行だけの同期で実行本文不変。差分／Index差分空白検査成功、自己生成MCP／活動試験Root残存0。完全出力は各コマンドから再生成できるため実行別書庫を増やさない。局所接続のみ完了で、公開Launcher／Workbench本番MCP切替、鍵管理・配送、Profile接続、旧REST撤去、正式191項目・AM全体完成は未成立を維持する。

初回の固定22Path独立レビューはMajor1・Moderate1でFailだった。旧注入Readerの返却Sourceと選択集合の相関不足、実AM→Owner→HTTPの非空状態／履歴の正対照不足を検出した。全指摘の是正方針を指摘元と整合し、入力重複と返却Source余剰／不足のexact拒否、順序非依存の受理、ID非開示、Root A状態とRoot B履歴の同応答、A公開解除後のB履歴保持を追加する。新AM構成を常時absent／空履歴にする一時変異は正対照のobserved assertionでFailし、Source SHA256 `cfa435c737f45af96b5838bda9faeb0731c477e87e9799e09aaceeb75350d68a`へ完全復元した。復元後の全回帰・更新候補の独立再レビューが終わるまで局所完了にしない。AI Profileのmanager／administrator採用回答は別の後続接続へ正式伝播し、この候補のRole・鍵契約には混ぜない。

基準`021eec11`から、活動MCPをOrchestrator所有の観測型・Parserへ直接接続する。要求Projectと応答Projectをexact比較する。AM Resolverは各Callで現在許可集合を再取得し、同Projectの全対象からProject／Repository／検証済みRootだけをReaderへ渡す。許可対象0件は非開示null、集合・Root不明は全体停止とし、部分集合へ後退しない。開始前取消はReader0、開始後はjoinして応答公開を止める。

着手前の読み取り専用確認を統合し、旧CROSは既存認可集合を受けるReader接続だけを保持する。同型結果・重複Parser・公開Aliasは撤去する。旧REST Clientでも要求Projectと応答Projectを照合する。Workbench旧REST受取は今回の直接Consumerなので、新Owner固有の出所を暗黙転記せず、表示Propertyを明示再構成し、履歴観測理由を現行の画面語彙へ変換する。Local旧ReaderとRemote MCPの本番切替は後続であり、今回結果をその完成根拠にしない。

変更分類は採用済み責務再編の本番接続追加。対象はCROS活動接続・HTTP・公開入口、MCP活動Adapter・AM Resolver、Workbench受取投影と直接試験。Role・鍵・保存Schema・Host Root・Provider・Dockerは変更しない。新State／Registry／Lock／Session／Fallback／Frameworkは追加しない。過去正式Evidenceは不変更。現在の候補は未レビューであり、AM全体・正式191項目・旧REST撤去の完成を主張しない。

必須確認は実HTTPの現在認可と実保存読取り、要求Project不一致拒否、失効・Exposure解除、非秘密応答、開始前取消・開始後join、15Tool登録、旧REST／Shared Host／Workbench表示回帰、出所field非転記、旧結果型参照0、Architecture／QA／Symbol／Catalog追従、固定候補の限定独立レビュー。標準規範・外部AI実行は不変更のため、準拠監査と署名Provider E2Eはこの接続段階では対象外。人間の追加判断は現時点で不要。

### 実保存ReaderのOwner候補接続 — 2026-10-12

設計Gate後のSource候補では、`orchestrator/src/activity/types.ts`・`validate.ts`・`read.ts`へ活動観測と実保存読取りを接続した。遠隔認可の成立をこのAPI単独へ主張せず、信頼した同Process Consumerが今回認可済みのProject／Repository／技術的Rootだけを渡す。状態は一度読み取ったSnapshotのProject値と受付世代だけから既存Queryで投影し、実履歴はExecution Intelligence正本を読む。保存Bindingは`identity/repository-binding.ts`へ抽出し既存Compositionも共用する。AM Binding、資格、Roleの搬送は0。

実保存の局所5 CaseとOrchestrator全回帰（UT 73・IT 15、計88件）、書式・型・Lintが成功した。自己生成した`runtime-activity-*`試験Directoryは終了後0件。初回の局所失敗ではPush先設定の全体状態をGit改訂取得の条件へ流用していたため、既存VCのGit改訂専用Readerへ是正した。上流未設定の実Repositoryでも改訂を取得し、Git改訂不明時は継続を発行・受理しない。未接続の旧CROS／Workbench Readerはまだ撤去しない。

Source候補の初回独立レビューではMajor 1・Moderate 3・Minor 2を検出した。Project／Source／Cursorの共同相関、理由の閉包・Event順序、Validatorの直接反証、旧Binding byte互換、現在句・Traceを一括是正した。公開観測は要求projectIdを必須とし、投影Project・出所・Page末尾Cursorの相関を保持する。Cursorのbyte契約は内部`activity/cursor.ts`へ共用し、StoreやAuthorityを追加しない。局所7 Caseが成功し、Binding長・Project相関・継続相関を外した3つの一時変異は期待どおり失敗、exact候補へ復元した。旧式で保存→新Readerで取得する片方向互換も確認した。

是正後・変異復元後のOrchestrator全回帰はUT 73・IT 17、計90件成功、静的3軸成功、自己生成活動試験Directoryは0件。この固定候補の再レビューで前6指摘の解消を確認したが、offset付き日時の文字列順と実時刻順の逆転をModerate 1件として検出した。並び順・Validator・Cursor境界を同じ実時刻比較へ是正し、offset二Pageと同じ実時刻のID順反証を追加した。局所8 Case成功、文字列比較へ戻す追加一時変異は期待どおり失敗し復元済み。

日時是正・変異復元後の全回帰はUT 73・IT 18、計91件成功、静的3軸成功、活動試験Directoryは0件。固定14ファイルの限定独立再レビューは全重大度の残指摘0。単一Snapshot、旧Binding byte互換、現在Root／Git、独立欠測、Project／Source／Cursor相関、実時刻の全体ページングをOwner局所範囲で確認した。MCP／Workbenchの既存型検査も成功した。本番MCP AM Resolver・Workbench・旧全Consumerの接続、旧処理撤去、取消後joinの公開入口反証、正式Quality実行は未完了。型や実保存の局所成功を活動能力全体の完成へ読み替えず、191正式項目はNot Runを維持する。現在、追加の人間判断は不要。`file-store.ts`責務調査で特定した再配置候補は未実施で、新Framework追加の許可として扱わない。

基準HEAD `85e57b773c2432f7ee019e0c7e1ec3a39a7d64f3`、着手時clean。前段は実HTTP十四Toolの局所接続までで、活動取得は未接続である。今回の調査では次を確認した。これはSource移管済み・活動取得完成の表示ではない。

| 現行実体 | 確認できた責務・制約 | 次の接続で保持すること |
|---|---|---|
| `cros/src/activity/types.ts`、`validate.ts` | Orchestrator現在投影と非秘密Event要約の閉じた観測契約。現在状態と履歴欠測を独立保持する。 | 認証管理へ内容型を集約せず、活動Ownerへ配置する。状態・Property・ページ上限・秘密非透過を変えない。 |
| `cros/src/activity/read.ts` | 許可済みRepository集合からProjectを選択し、注入Readerを一回呼び、完了を待って結果を検査する。 | 現在AM認可集合だけを渡す。非許可は読取り0、故障は正常空集合にしない。旧CROS型とAM型の相違を無断castで隠さない。 |
| `workbench-server/src/activity/observe.ts` | 単一RepositoryのOrchestrator公開QueryとExecution Intelligence履歴を実際に読む。Cursor、上限、Project絞込みを持つ。 | 新Readerを複製せず再利用・責務移管を評価する。複数Repositoryの投影を先頭選択や推測で合成しない。 |
| `orchestrator/src/operation-composition.ts`の公開状態Query | Runtime所有Decision Storeの既存認証を経由する。AM認証だけで直接代替できる契約ではない。 | 二重認証や無断認証迂回を避け、必要な読取り専用接続を設計する。延期済み実行／Docker回復の大改修へ範囲を広げない。 |
| MCP／旧HTTPの活動Reader構成 | 現行SourceはReaderの注入入口。実Readerを構成する本番経路の成立根拠は未確認で、既存試験の合成Readerを本番接続証明には使えない。 | 型移管・注入接続・実保存読取り・公開入口を別の確認段階として追跡し、最終的に全能力の本番接続を閉じる。 |

Orchestrator基準の`npm run check`は書式（67 File）・型・Lint成功。`npm test`もUT 73件・IT 10件、計83件成功。Source不変更。読み取り専用の着手前専門確認により、型・検査と注入Readerだけでは能力が成立しないこと、AMとOrchestratorのBindingを流用できないことを確認した。Orchestrator／MCP／QAへ新Ownerの読取り契約を具体化し、現在状態の複数Source競合、一件不明時の部分成功禁止、出所、全体ページング、現在集合変更後のCursor拒否を明示した。改訂観測不能時は第一Pageの観測を保持するが継続Cursorを発行せず、Cursor付き再要求も明示拒否する。固定Snapshotや新Storeは追加しない。実Readerは既存Workbench処理を移管・再利用し、旧全Consumerを追従させる。新Store／Lock／Recovery／Framework、旧通信入口の先行削除は行わない。

8文書の限定独立レビューは是正後再確認まで完了し、全重大度の残指摘0。配置・旧時点比較の区別・Quality正式項目への伝播・出所の決定性・改訂不明時の継続拒否を確認した。Source着手前の設計Gateだけが成立し、活動取得のSource・実保存・本番Consumer・実HTTP／Workbench確認は未完了、正式191項目はNot Runを維持する。現在、追加の人間判断は不要。

## AM認証によるTopic／Meeting MCP接続 — 2026-10-12

局所結果：基準HEAD `5e235a2a02a78c9e1eca277bcf91ac0121872e80`、Node v24.19.0、2026-10-12 JST。各Packageの`npm test`でMCP65／Domain120／AM59の計244 Case、書式・型・Lint成功、失敗／取消／skip／todo 0、全Exit 0。最終MCP再実行29.3127592秒、変更のないDomain45.1805834秒／AM47.2918874秒。限定独立レビューの2指摘（旧2 Tool説明の現在形残存、Repository ID必須Schemaの直接検証不足）を是正し、再レビューは全重大度残指摘0・Pass。Source SHA256 `5bdeac9b641846c1ba064cb9f54a1b0441108a8f8e71d68963733c102e3895b9`、IT SHA256 `c4ae182f53555d79e6088612bc4beb1a3299c8cc7e0a37516c34dd8a3f6f79a4`。Schemaの必須指定を外した一時変異は期待どおり失敗し、復元後のroute SHA256 `eb01acb7dbd3c836cce3e632c76cbef356f5b35cc7f2aee0f08f5b565a915803`と差分なしを確認した。自己生成試験Directory残存0。端末で結果を確認し、実行別Evidence書庫は追加しない。正式191項目Not Run、本番Launcher／Workbench未切替、活動／Profile・鍵配送・旧REST撤去未完了、AM全体未完成を維持する。

基準HEAD `5e235a2a02a78c9e1eca277bcf91ac0121872e80`、着手時clean。既存Portfolio構成を保持し、`request/access-resolver.ts`の`createAccessMcpResolver`へTopic／Meeting全12操作を追加する。承認済み再編内の実装追加であり、公開Launcher切替ではない。着手前の読み取り専用専門確認は着手可・追加人間判断不要で、条件を本節へ統合した。

完全Schema検査と開始前取消の後だけ、同要求の現在AM許可集合を再取得する。明示Repository非許可はnullから既存`-32602`、集合・Root・構成不明は固定`-32603`。同Project全Repositoryを既存Version Control公開入口で再観測し、manifest Project拘束付きDomain操作とDomainのRelation判定へ接続する。一件不明でも部分集合へ後退しない。新State／Lock／Session／Cache／認可Framework／read-write権限分離は追加しない。旧CROS・Shared Host・REST・Launcher・実Host秘密は不変更。

必須検証は実HTTP全12操作、入力不正／事前取消の対象観測0、非許可拒否、現在Role／Exposure／失効、foreign本文の保存0、Relation0／1／多と異Project非探索、Root不明の全体停止、既存Portfolio保持、HTTP終了と自己生成Root回収。同期保存開始後の取消からrollback・Effect0は推定しない。MCP／AM／Domain回帰、静的3軸、固定候補限定独立レビューとArchitecture／QA／Symbol直接整合を実施する。規範不変更で準拠監査、Provider／Docker不変更で署名Provider E2Eは対象外。正式191項目・本番切替・AM全体完成は未成立を維持する。

## AM認証によるProject Context専用MCP接続 — 2026-10-12

後続Topic／Meeting接続の着手前整合で二つの欠落を確認した。第一はMCPの完全入力検査・取消より先にRepository解決を行う順序、第二はmanifest Projectと本文Projectの拘束である。第一を先行是正し、同じ共通Adapterへ遅延Resolverを渡して検査→取消→現在解決一回→取消再確認→Domain操作にする。全12 Toolの不正／正規／取消／解決例外と既存CRUDを確認し、独立レビューする。Schema複製・新Framework・認可Storeは追加しない。第二はDomain Ownerの拘束とRelation移管、新AM MCP構成・HTTP試験で接続するまで未完了として保持する。旧Shared Host・Profile・活動・鍵・Docker・REST撤去は今回不変更。追加人間判断は不要。

局所結果: 基準HEAD `b3e52577b91d13d905a060b30e3ec78adbdffb96`、Node v24.19.0、2026-10-12 JST。各Packageの`npm test`でMCP60／AM59／Domain118の計237 Case成功、静的3軸成功、失敗／取消／skip0、全Exit 0。所要はMCP17.8825312秒、AM48.5784778秒、Domain42.3691866秒。固定8Pathの限定独立再レビューPass・全重大度残指摘0。新Source SHA256 `1b50e182ea344aa1fb9a01480009d920ab65cb947728bb2a911c4126c82d939c`、是正後IT SHA256 `7ecd503711809be176e050d5807917550307ec2d095d79776b05beb83863ddeb`。実行前後HEAD一致、差分空白検査成功、自己生成`mcp-access-context-*`残存0。完全出力は端末で確認し、上記コマンドから再生成できるため実行別書庫は増やさない。結果同期後も公開Launcher／Workbench切替、Topic／Meeting・活動・ProfileのAM接続、鍵管理／配送、旧REST撤去、正式191項目とAM全体完成は未成立を維持する。

固定8Pathの限定独立レビューで、開始後取消の直接反証不足1件を検出した。Source変更は行わず、同期本文open直後のabortと当該descriptor close、後続本文0、固定-32603・resultなし・再実行0を新Caseで確認する是正方針を指摘元と整合した。開始前取消の-32800とは区別し、EST-IT-014は開始前だけの部分接続を維持する。

基準`b3e52577`、着手時clean。承認済み再編内の追加実装として、既存HTTP Transportへ新`project-context/access-resolver.ts`を構成する。通常認証→HTTP本文待機→内容Callの現在許可集合→同期Domain固定本文→4項目Source→Portfolioを同じ要求内で接続する。Tokenは本文待機から再認証まで要求専用closure内だけに保持し、永続化・共有State・Session・応答・Error・別要求へ渡さない。JavaScript文字列の消去保証はしない。Rootや管理改訂を公開結果へ追加しない。

着手前専門確認を統合し、品質接続はPPR-IT-002、RFD-IT-013／019、HTTP拒否・取消の直接観測はEST-IT-002／014とする。CPR-IT-008はRecord Reader専用のため今回対象外。初回未完了のHandlerなし、本文待機中失効の固定エラー・Reader0、Exposure解除の正常空Portfolio・Reader0、本文不成立の全体停止、開始前取消のCollection／Reader0、別要求の再評価と非秘密応答、close後Listener不存在を反証する。同期Reader開始後のI/O中断・Effect0は主張しない。

実Host・鍵配送・Profile管理Role・旧Resolver・SharedHost・REST／Gateway・Topic／Meeting・活動・route共通契約は不変更。新旧認証fallbackは禁止。自己生成Repository-local試験Rootだけを使い、新CLI・Store・Lock・Frameworkは追加しない。MCP／AM／Domain回帰と静的3軸、固定候補限定独立レビュー、Symbol／台帳・設計／QA／現在表示の直接整合を必須とする。標準規範・Provider／Docker不変更のため準拠監査・署名Provider E2Eはこの段階では対象外。正式191項目Not Run、MCP全能力本番切替・AM全体未完了を維持する。

## 通常接続の認証とMCP搬送の着手前確認 — 2026-10-12

基準HEAD `426ec875`、着手時clean。既存MCPの唯一の本番CROS構成はShared Hostから旧Resolverを利用し、Workbenchは旧Remote RESTも利用する。AM本文搬送の局所成功はこの本番構成の置換完了ではない。旧能力は保持し、Project Context専用Resolverと実HTTP搬送契約の接続から進める。

読み取り専用の専門確認により、`authenticateCredential`は初回`credential_stored`にも本人を返すため、通常Handler発行へ単独利用できないことを確認した。先行して同一既存Lock/current内の有効資格と初回`completed`を要求する`authenticateNormalConnection`を追加する。既存初回認証の意味・順序は保持し、共通の保存認証処理だけを再利用する。新入口は認証・初回完了を確認する前にpendingを処置せず、対象Repositoryを観測しない。結果は既存の非秘密本人投影／固定拒否／状態未確認だけ。新Store・Lock・履歴・Session・受領Gateは追加しない。

次のMCP接続は、Headerで通常認証→本文待機→内容操作時にfresh許可集合→同期固定本文Reader→4項目Source→Portfolioの順とする。許可空集合だけ正常空結果、本文一件不明は全体停止、Root／秘密非透過、本文待機中の失効・Exposure変更反映、開始前取消で本文0、別要求再評価を反証する。新旧資格fallbackは禁止する。旧Resolver・Shared Host、Topic／Meeting・活動・Profile、REST／Gatewayはこの先行認証変更では不変更。Profile管理Roleと鍵配送方式は既存人間回答待ちを維持する。

変更分類は承認済み責務再編内の実装追加。正本はAM／MCP詳細、品質は既存RFD-IT-013／024、Sourceと既存公開集合・実保存試験を追従する。静的3軸・AM全回帰・固定候補の限定独立レビュー・直接文書整合・差分確認を必須とする。標準規範不変更のため準拠監査、Provider／Docker不変更かつ公開入口未接続のため署名E2Eはこの先行段階では対象外。本番MCP／Workbench、鍵管理・配送、正式191項目、全体完成は未成立を維持する。

局所結果: Node v24.19.0、AMの`npm test`で静的3軸と59/59 Case成功、Fail／Cancel／Skip0、exit0、44.1985384秒。未完了・未知・失効資格とpending／replace併存の完全不変、状態・清掃・解放不明の非開示を確認した。独立レビューの反証不足Moderate1とHeader追従Minor1を是正し、固定8Pathの限定再レビューPass・全重大度残指摘0。基準HEAD `426ec875bb1c6deb2671e471af4bad8f56b7b327`、Header同期後の差分Hash `32deb72937cab39708a652c2afcf8842f27b470a`、実行Source SHA256 `8c3704f614c02ea4a4bef6c3e316bdaa6719c630541e328ca261c685ce8bd0bc`、実行IT SHA256 `d09772f6eab971c09d6c82ba047a0de03468f415cf4b1168753c08e326878293`。最終実行後のHeader4行は実行本文・Source不変更で結果に影響しない。試験Root残存0、差分確認成功。完全出力は上記コマンドで再生成できるため実行別書庫を追加しない。通常認証の保存境界のみ局所完了で、MCP専用Resolver・HTTP搬送・本番切替、191項目正式Not Run、AM全体未完了を維持する。

## 同要求の許可Repository集合 — 2026-10-12

基準`4e9aaaad`から、既存AM保存Lockで現在認証・初回完了・Role内容とExposureの積集合を一度に確定する内部入口を追加する。Repositoryは一意、全許可workspaceIdsを保持し、各実Root／Binding／manifestを一回検証する。管理改訂はmanagementRevisionとして本文revisionと区別する。認証済み0件は成功空集合、認証・清掃・実体・解放不明は集合なし。旧単一対象入口、現在Schema、秘密保存先、通常鍵処置、初回・Host配送、歴史Evidenceは変更しない。

着手前確認は既存設計／RFD-IT-013・019と専門確認を照合し、一意性・全範囲保持・版番号区別を計画へ統合した。新State／Lock／Frameworkを追加しない。AM回帰・静的3軸・固定候補限定独立レビュー・文書／Symbolの直接整合を実施する。標準規範変更なしのため準拠監査、実Surface未接続のため署名E2Eは実施しない。本番Consumer・性能／lifecycle・本文搬送・鍵配送・旧REST撤去・正式191項目とAM全体完成は残る。追加人間判断は不要、既存配送方式回答待ちは維持する。

局所結果: Node v24.19.0の`npm test`でAM全56/56、静的書式・型・warning禁止Lint成功、Fail／Cancel／Skip0、exit0、41.6042213秒。初回未完了の有効資格反例とHeader同期の指摘を是正し、固定9Pathの限定再レビューPass・全重大度残指摘0。基準HEAD `4e9aaaad`、固定tracked差分Hash `b5c92046b1151891f1fd10f300ec3709f90a3195`、保存Source SHA256 `0e02d8b66e430dd00faef678bfdc53f4e75222e786486b0503f3a0bebc6e18cb`、最終試験SHA256 `e5de8f39e7e1f6a035c08fa14e3c4b259f63b7040ce4355433f4d96c1f5cff66`。全実行後のHeader4行同期は実行本文とSource不変更で、結果に影響しない。差分空白検査成功、自己生成AM試験Root残存0。完全出力は上記コマンドで再生成可能として実行ごとの書庫は追加しない。最初の試験データID不一致による失敗は修正前の値で、現在の成功に混ぜない。AM全体完成や正式191項目のPassへ昇格しない。

## 固定Project Context本文Reader — 2026-10-12

基準HEAD `a2fc57e2`、着手時clean。承認済み責務再編内で、既存技術的Rootと固定本文観測・解析を接続する実装追加。着手前整合確認は読み取り専用確認者と親がArchitecture・公開集合・既存QAへ照合し、着手可・追加人間判断不要。直接義務をPPR-IT-019へ補正し、同じ試験で成功Contextを中立Source／Portfolioへ渡す部分だけPPR-IT-002へ接続する。

正常は最大1 MiBの安定本文と三Identity一致、非成立は固定unavailable。不存在／Directory／Link、上限境界／超過、解析不正、各Identity不一致、descriptor取得後の例外／途中変更、handle終了を実Root試験で観測する。Root／期待manifestは認可証明でなく、期待manifestとの複数File原子性・現在性再保証はしない。AM本番認可→Readerと利用側搬送は後続OPEN、null／missing変換・新Lock／履歴／互換層・実Host操作は追加しない。

必須確認はDomain全回帰・静的3軸、変更契約／Source／QA／Symbol／Catalog／文書直接影響の限定独立レビュー。標準規則・決定権限・保存／通信契約を変更せず準拠監査は非該当。Provider・Docker・公開Launcherを変更しないため署名実E2Eはこの局所段階では実行しない。過去正式Evidenceは不変更。現在は実装・試験候補であり、レビュー／正式Local Item全体Pass・AM全体完成を主張しない。

局所結果: 2026-10-12 JST、Node v24.19.0、Domainの`npm test`は静的3軸と全118 Case成功、失敗／取消／skip0、Exit 0、39.5047224秒。固定10Pathの限定独立レビューPass・全重大度残指摘0。開始／終了HEAD `a2fc57e26ecb29f4e5b9359e8ce27116e1c13464`、tracked差分Hash `3a92c13fd3d7982c854773bf4d2bf34fc2f66251`一致。新Reader SHA256 `e81b6fb56ed7719c9b1498fc3ee484aca042b6e9fc8e8b484b9c5a8c7caf6476`、新試験 SHA256 `2727408a38a7fcb59b5121eedb22161382a9d4e3d2b3fcb788ae93c539f0beab`。自己生成Reader試験Root残存0、差分空白検査成功。完全出力は端末で確認し、上記コマンドから再生成可能なため実行別書庫は増やさない。実装と直接QA接続の局所範囲だけを閉じ、AM認可からの本番搬送・正式Local Item全体評価・全体完成はOPENを維持する。

追加回帰: AMの`npm test`も静的3軸・全54 Case成功、失敗／取消／skip0、Exit 0、38.1671677秒。Domain118と合わせて172 Caseを確認した。AM Sourceは不変更で、ReaderをAM本番利用側へ接続した根拠ではない。

## 認可済みPortfolioのDomain移管 — 2026-10-12

基準HEAD `d306a455`、着手時clean。承認済み責務再編内の配置・内部API変更として、旧CROS純粋集約と3結果型をDomainへ移管する。認可は旧CROSのまま保持し、DomainがCredential・Exposure・Root・Bindingを解釈する構造を作らない。2本番Consumerは既存Scopeの共通4項目変換へ接続し、中継公開Fileを追加しない。着手前の読み取り専用整合確認は条件付き着手可・追加人間判断不要。条件を本項の試験と変更禁止範囲へ統合した。

維持する能力は両Identity照合、欠測・競合優先、昇順、不変結果、入力非変更、正本化しないこと。Domain純粋試験、CROS認可→Domainの統合試験、HTTP／MCP／Workbenchの既存回帰、文書・QA・Symbol／Catalog整合と固定候補の限定独立レビューを行う。新Framework、Store、認可変更、結果shape／状態語彙変更、本文Reader、観測不能のmissing化、旧REST撤去、実Host操作は対象外。標準規則・外部Effect・署名対象実行方式を変更しないため、全体署名E2E・準拠監査はこの移管段階では実行しない。AM本番接続と全体Readyは後続Gateを維持する。

限定独立レビューは過剰な欠測保証、設計表のRoot／Binding入力混在、QA見出し前空行の3指摘を返した。統合是正方針を指摘元へ再提示して整合を確認した。null／missingを「認可済みCROS Source SnapshotでContext未提供」という旧意味へ合わせ、Filesystem不存在・Reader正常完了・観測不能との識別を保証しない。旧`content:{}`→missing／partialを維持し、既存config Readerの読取り／解析失敗時の停止を変更しない。実Reader分類はOPENのままで、新たなReader／fallback・状態語彙・結果shape・認可・Root／Binding APIは追加しない。

局所結果: 2026-10-12 JST、Node v24.19.0、各Packageの`npm test`でDomain115、AM54、CROS34、MCP56、Workbench33の計292 Case成功、失敗／取消／skip0、全Exit 0。各書式・型・warning禁止Lint成功、Workbenchの既存Build成功。所要はDomain47.758983秒、AM45.9366613秒、CROS10.4359836秒、MCP15.048612秒、Workbench133.6860602秒。レビュー是正はHeader／文書のみで実行コードは不変、是正後Domain静的3軸とDomain2／CROS2の対象4 Caseを再実行して成功した。固定22ファイルの限定独立再レビューPass・全重大度残指摘0。固定tracked差分Hash `7e81702dc6e4f067cdb54c62608878f14143081d`、新Domain Source SHA256 `2d3aeaeef2a8df411b6232a09ca97f97fba5d6c212913bfa0086f4089ac5ddc3`、新認可Source SHA256 `93f6c61d5482694f2df43ff461714391f5fde494c7567d88d4dd84f81ea9809a`、新Domain試験 SHA256 `4db4002b8654d49be08ed8d4ac2f93acd9379fb60eb32764a0887406755b1f72`。実行前後HEAD `d306a455`一致、差分空白検査成功、自己生成AM試験Root残存0、現行Source／Symbol／Catalogの旧集約実体参照0。完全出力は端末で確認し、上記コマンドから再生成できるため実行別書庫は増やさない。結果同期は現在投影だけで、AM本番認可・Reader・鍵管理／配送・ST／UAT・旧REST撤去・正式191項目・全体完成は未成立を維持する。
