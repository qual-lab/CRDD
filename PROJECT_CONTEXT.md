# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は判断しない。
> 詳細・判断理由は各Owner Artifactを参照し、履歴を本文へ蓄積しない。

## 1. 今どうなっているか

### 結論

v0.22のCHG-000082は進行中。Docker Isolationは`a04ecb70`でコミット・プッシュ済み。Direct／Candidateは共通のDocker方針を採用し、開発用`.env`がCoding AIから読まれ得るリスクを受容した。本番SecretはGit・通常開発環境へ置かず既存管理を使い、開発資格は本番権限なし・限定権限・期限ありとする。独自Secret Manager・file別ACL・動的Mount許可Frameworkは追加しない。固定Pathの最小Mount試験は二構成で成功し、通常Source書込みとGit／内部状態への書込み拒否を確認した。全link経路・任意Repository・製品実装全体の保証ではない。Coordinatorの借用実行は実装・結合試験と独立再レビューまで完了（限定範囲）。実Provider E2E・実データ移行は未実施。統合・タグ・リリースは含めない。条件と限界は[接続結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#借用実行接続の実装結合確認の区切り)を参照する。

既存実装との差分を整理し、Version Controlの共通Git読取りに続いて、固定BaseからのWorktree作成・観測・明示終了時のWorktree／専用Branch削除を実装した。採用・取込済み又は不採用・破棄確定後に不要資源を回収し、新しい管理台帳・State・Lockは追加しない。上位Task・採否・非使用の調停、本番Direct／Candidate切替・旧Bundle撤去は未完了。filter設定・gitlinkを含む作成は未対応として拒否し、部分試験を新Workspace全体の完成へ換算しない。現在の検証結果と限界は[実装・実Git試験](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#git-worktree管理の部分実装と実git試験)を参照する。

| 対象 | 現在の状態 | Owner Relation |
|---|---|---|
| Workspace／Orchestrator | Snapshot v3と既存Leaseを使い、実Worktree管理・Task搬送の限定結合まで実装。UT73・IT24成功、独立再レビュー指摘0。実Provider・採用Git統合・公開Surface・実データ移行は未接続／未実施で、全体完成ではない | [限定実装と検証](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#orchestratorの実装限定結合結果2026-10-17) |
| Access Management／公開入口 | 専門Packageへの接続と旧CROS Package・REST／Gateway撤去の区切りは完了。初回設定・鍵操作の実入口と人間確認は後続E2Eへ保持する | [変更の現在地](99_Roadmap/Changes/CHG-000082/change.md)、[接続と後続E2E](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#今回の区切りと後続e2e--2026-10-14) |
| Docker Isolation | 実装・検証完了。技術的な実行・観測・取消・回収を分離し、旧Docker両Folderとruntimeを撤去。状態保存・操作前後のOwner確認・結果受領は上位に保持。実境界の成立と未実証の限界は隔離設計の現在表を参照 | [現在の計画・検証結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md) |
| 通常実行の署名依存 | Coordinator専用の署名入口・Manifest設定・固定AST graphと、Domainの旧署名専用profileを撤去。通常保存の失敗反証と旧入力拒否を確認し、限定独立レビューの残指摘0。汎用成果物署名・必要Artifact同一性・現在認可・隔離は維持する | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 検証 | DI通常337件・実Host Process7件、認証隣接30件、状態回収の実Windows42件が成功。Coordinator全回帰の9失敗は試験結合だけを是正し24件再検証。未変更母集団との対応評価は1,921成功・対象外5・未解消失敗0。元全回帰Failを保持し、単一run全件成功とはしない | [変更計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[品質の現在投影](07_Quality/01_Quality_Center.md) |

試験件数は実行範囲の結果であり、QA検証項目のPass数・実Docker／Providerの成功・Release可能を意味しない。

## 2. 何が危ない、または止まっているか

全体完成を阻むのは未処置の差分と未観測境界である。局所成功から全体の成立を推定しない。

| 残件 | 影響・処置 | Owner Relation |
|---|---|---|
| 回帰 | 本Packageの回帰・是正・独立レビューは完了。実Provider全E2Eと後続改修の回帰は今回結果で代替しない | [変更計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 文書・工程の全体検査 | 全Repository Checkerは3,341件のエラーで不合格。Changes内リンク等3,321件とIA／UI／SPEC工程契約20件。Changes外の現行リンク切れは0件だが、歴史Evidence・今回差分への影響の分類は未完了 | [変更計画と検査の範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 整理後の実境界接続 | 上位接続の限定整理は確認済み。自動破棄保存前の中断から明示保持し、同じstateで新Taskへ接続する限定Caseと同File全16件が成功。新しい共有State・Registry・Lock・Recovery Frameworkは追加しない | [隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 実境界 | 実Docker五資源・未起動認証構成・fresh回収・認証create不明の限定終了・公式Imageの版／三Hash／隔離を確認。009はWSL保守後に同ID正式終了。030は実Ctrl+Cとreviewer準備中の親喪失を元IDの回収・待ち0まで確認。Windows自動削除・汎用WSL fallback・executor実行中の親喪失・実Provider全E2Eは主張しない | [検証計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[実行手順](19_Workflows/01_Coordinator_Runtime.md) |
| 限定終了の実試験 | 診断付き新品一回が成功。Docker再起動1回、認証create結果不明の限定Classで不存在2回・終了保存・正式回収・履歴・操作除去・専用Root不存在を確認。以前の起動未確認Failと原因未確定は保持し、汎用unknown終了やDI全体完成へ換算しない | [実測と清掃記録](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 全体評価・収束 | DI完成照合は完了。全197項目の正式再評価・全体Checker既知不合格・後続E2Eは残る。未実施・不明・部分成立をPassへ畳まない | [Quality Center](07_Quality/01_Quality_Center.md)、[Reality Audit](07_Quality/05_Current_Implementation_Reality_Audit.md) |

## 3. 今、人間が決めることは何か

今回の退避物はWSL限定保守と同ID正式終了まで確認済み。公開Taskの実Ctrl+C、reviewer準備中のCLI親喪失とも、元IDで資源回収・履歴・正式Readerの待ち0まで確認した。親喪失をexecutor実行中の成立へ拡張しない。再認証の技術構築・旧Docker環境profile・試験結合漏れを是正し、DIの完成条件へ現在の回帰・実測・独立レビューを照合した。一般Recovery拡張・追加再起動・記録手編集はしない。現在、追加の人間判断は必要ない。

| 対象 | 現在の判断・許可境界 |
|---|---|
| Docker隔離と簡素化 | 使い捨てと最小管理へ簡素化する方針は承認済み |
| 実境界の評価 | 009と030の今回の観測を正式義務へ限定接続する。未観測の全異常枝や全Provider経路のPassへ拡張しない。追加の故意破損・Provider依頼・再起動は予定しない |
| 実Docker再起動・外部AIへの新しい依頼 | 対象・影響・送信範囲を確定した時点で必要な許可を確認。過去の一回承認を流用しない |
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

| 順序 | 承認済みの次の作業 | 完了条件・停止点 |
|---|---|---|
| 1 | Workspace方式の現行棚卸し・対応表は整理済み | 保存先の宣言と本番接続、既存workspace表記の別概念、能力・利用側・排他を区別した |
| 2 | Architecture／Qualityの反映・独立確認は完了 | [Workspace詳細](06_Architecture/Details/orchestrator/03_Workspace.md)と新RFD-IT-029へ接続、残指摘0。Direct書込み・Git許可・Commit／dirty・具体Schemaは実装前に固定する |
| 3 | Version Control→Orchestrator→Coordinator→公開入口の順に切替 | 旧能力の置換・本番利用側接続を確認してから旧Ownerを撤去する。今回の棚卸しでは実装しない |
| 4 | 新構成の回帰・独立レビュー・実境界と後続E2E | 旧DIの成功や単なるGit Worktree生成を新構成全体の成立根拠にしない |

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
