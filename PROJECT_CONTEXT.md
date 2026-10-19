# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は判断しない。
> 詳細・判断理由は各Owner Artifactを参照し、履歴を本文へ蓄積しない。

## 1. 今どうなっているか

### 結論

②の実AI編集E2Eの今回試験は、利用者判断で終了したが、回収は未完了である。認証確認用Containerの作成結果unknown、同じ回復参照と試験物を保持する。停止Containerだけが遅れて残る可能性は今回に限り許容されているが、E2EのPass・回収完了・一般回復条件の緩和ではない。AI再試行は行わない。詳細と再評価条件は[今回試験の終了判断](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-edit-trial-ended-unresolved)を参照する。

固定Commit `d4edcd1e`後の追従是正では、検証Tool3 Suiteの接続、Test Header全数Gate、現行文書43診断の是正に続き、確定誤検知236件を検査側で解消した。生診断は1,836→1,600、追加0。Checker全386件は385成功／既知1失敗（残1,600診断）で完走した。文書診断は現行0、歴史CHG旧参照3,353による全体不合格を維持する。Browser接続1場面も元失敗の原因未確定のまま。②のAI再試行・保持物削除は行わず、保持3 Hashと安全条件は不変。[今回の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)を正本とし、[先行の分類・文書是正](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)と[是正前の固定版結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression)を区別する。

v0.22のCHG-000082は進行中。Docker Isolationは`a04ecb70`でコミット・プッシュ済み。Direct／Candidateは共通のDocker方針を採用し、開発用`.env`がCoding AIから読まれ得るリスクを受容した。本番SecretはGit・通常開発環境へ置かず既存管理を使い、開発資格は本番権限なし・限定権限・期限ありとする。独自Secret Manager・file別ACL・動的Mount許可Frameworkは追加しない。固定Pathの最小Mount試験は二構成で成功し、通常Source書込みとGit／内部状態への書込み拒否を確認した。全link経路・任意Repository・製品実装全体の保証ではない。Coordinatorの借用実行は実装・結合試験と独立再レビューまで完了（限定範囲）。実Provider E2E・実データ移行は未実施。統合・タグ・リリースは含めない。条件と限界は[接続結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#借用実行接続の実装結合確認の区切り)を参照する。

Version ControlのWorktree管理に続き、名前付きCandidateの明示固定・別採用・二親MergeとOrchestratorの既存保存・排他への内部接続を実装した。選択外のCommit／Stage混入を避け、失敗後も同じ候補で再入場し、採否確定後の不要Refを回収する。新しい管理台帳・Lock・一般Recoveryは追加しない。公開Surface・本番Direct／Candidate切替はSource接続と限定検証を完了し、旧Bundle／Store本体・専用Native処理を撤去した。新構成全体の実境界評価と実データ移行は未完了。filter設定・gitlinkを含む作成は未対応として拒否し、部分試験を新Workspace全体の完成へ換算しない。現在の結果と限界は[採用・Git統合の実装結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#採用git統合のsource接続と実git確認)を参照する。

| 対象 | 現在の状態 | Owner Relation |
|---|---|---|
| Workspace／Orchestrator | ③の本番Workspace接続・旧Bundle／Store本体と専用Nativeの撤去、検証Toolの取消・終了確認移管を完了。変更範囲の実Git・結合回帰と限定独立レビューは完了した。新構成全体の回帰・実境界・移行の最終評価、②の実AI編集E2Eは残る | [撤去の区切りと現在残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-store-retirement) |
| Access Management／公開入口 | 専門Packageへの接続と旧CROS Package・REST／Gateway撤去の区切りは完了。初回設定・鍵操作の実入口と人間確認は後続E2Eへ保持する | [変更の現在地](99_Roadmap/Changes/CHG-000082/change.md)、[接続と後続E2E](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#今回の区切りと後続e2e--2026-10-14) |
| Docker Isolation | 実装・検証完了。技術的な実行・観測・取消・回収を分離し、旧Docker両Folderとruntimeを撤去。状態保存・操作前後のOwner確認・結果受領は上位に保持。実境界の成立と未実証の限界は隔離設計の現在表を参照 | [現在の計画・検証結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md) |
| 通常実行の署名依存 | Coordinator専用の署名入口・Manifest設定・固定AST graphと、Domainの旧署名専用profileを撤去。通常保存の失敗反証と旧入力拒否を確認し、限定独立レビューの残指摘0。汎用成果物署名・必要Artifact同一性・現在認可・隔離は維持する | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 検証 | 確定誤検知236件を検査側で是正し、生診断は1,836→1,600（追加0）。局所・QA Header全数3/3、関係16/16・静的確認成功。Checker全386件は385成功／既知1失敗（残1,600診断）で完走。Browser元原因未確定・正式QA未評価は維持する | [236件の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)、[分類・Browser調査](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-browser-triage) |

試験件数は実行範囲の結果であり、QA検証項目のPass数・実Docker／Providerの成功・Release可能を意味しない。

## 2. 何が危ない、または止まっているか

全体完成を阻むのは未処置の差分と未観測境界である。局所成功から全体の成立を推定しない。

| 残件 | 影響・処置 | Owner Relation |
|---|---|---|
| 回帰 | 3 Suite分類・Test Header・現行文書の限定是正、型・静的・関連回帰と独立確認は完了。Checkerの既存Source命名・責務Header未達、Browser元失敗・原因未確定、未実施Host境界・正式198項目評価・合成7領域清掃は分離して保持する | [現在の確認と残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 文書・工程の全体検査 | 最新Repository Checkerは現行0・歴史CHG旧参照3,353診断で全体Exit 1。現行43診断を是正したが、正式QA・実境界・全体完成の代替ではない。歴史Evidenceの一括改名やPass化は行わない | [検査の範囲と限界](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 整理後の実境界接続 | 上位接続の限定整理は確認済み。自動破棄保存前の中断から明示保持し、同じstateで新Taskへ接続する限定Caseと同File全16件が成功。新しい共有State・Registry・Lock・Recovery Frameworkは追加しない | [隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 実境界 | 実Docker五資源・未起動認証構成・fresh回収・認証create不明の限定終了・公式Imageの版／三Hash／隔離を確認。009はWSL保守後に同ID正式終了。030は実Ctrl+Cとreviewer準備中の親喪失を元IDの回収・待ち0まで確認。Windows自動削除・汎用WSL fallback・executor実行中の親喪失・実Provider全E2Eは主張しない | [検証計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[実行手順](19_Workflows/01_Coordinator_Runtime.md) |
| 限定終了の実試験 | 診断付き新品一回が成功。Docker再起動1回、認証create結果不明の限定Classで不存在2回・終了保存・正式回収・履歴・操作除去・専用Root不存在を確認。以前の起動未確認Failと原因未確定は保持し、汎用unknown終了やDI全体完成へ換算しない | [実測と清掃記録](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 全体評価・収束 | DIの基準範囲完成照合は保持。現在の198項目の正式再評価・全体Checker不合格・後続E2Eは残る。未実施・不明・部分成立をPassへ畳まない | [Quality Center](07_Quality/01_Quality_Center.md)、[Reality Audit](07_Quality/05_Current_Implementation_Reality_Audit.md) |

## 3. 今、人間が決めることは何か

今回の退避物はWSL限定保守と同ID正式終了まで確認済み。公開Taskの実Ctrl+C、reviewer準備中のCLI親喪失とも、元IDで資源回収・履歴・正式Readerの待ち0まで確認した。親喪失をexecutor実行中の成立へ拡張しない。再認証の技術構築・旧Docker環境profile・試験結合漏れを是正し、DIの完成条件へ現在の回帰・実測・独立レビューを照合した。一般Recovery拡張・追加再起動・記録手編集はしない。承認済みのClaude単独一回は終了・回収まで成功し、現在追加の人間判断は必要ない。

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
| 技術処理はDocker Isolationへ、Task保存・通知・受領は上位へ | 下位がCoordinator／Orchestratorを知る逆依存を避け、利用側の保存方式をDocker cleanup条件にしない | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md)、[Orchestrator設計](06_Architecture/Details/orchestrator/02_Detailed_Design.md) |
| 旧署名資格を別の資格へ置き換えない | Commit／Hashは追跡・同一性確認であり、実行許可やPublisher真正性ではない。現在の認可と隔離を各Ownerで確認する | [通常実行と配布の分離](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離) |
| Project Contextは現在投影だけにする | 詳細の第二正本や進捗書庫を作らず、人間・AI・MCP・Workbenchが同じ現在像を短時間で読めるようにする | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

過去の経過・判断・検証条件は既存CHGとGit履歴から追跡する。現在文書へ経過を追記し続けたり、新しい履歴書庫へ複製したりしない。

## 5. 次に何をすべきか

全17Packageの構造整理では、AI Adapterの助言責務整理と試験専用メモリ保存API撤去を`e2fbc02b`までコミット・プッシュ済み。続いてProvider配布記述とDocker要件のOwnerを照合し、助言ImageのInit判定をDIへ移管した。関連回帰・Host限定3件・独立レビューを完了し、通常の設定保存・実行条件は維持する。[順序・現在結果・残件](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review)を参照する。残る名称・Header・公開集合の総点検は後続で、Package全体・Source全面移管の完了ではない。以下の回帰・実境界残件も保持し、②のAI再試行と保持物削除は行わない。

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
