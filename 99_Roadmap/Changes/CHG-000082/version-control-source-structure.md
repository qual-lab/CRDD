# Version ControlのSource構造整理・棚卸し

成果物種別: 変更計画の移管分析
対象: [第二段階](second-stage-plan.md)／`40_Develop/version-control`
基準Commit: `5fa9a6c18`
状態: 対象の再配置・回帰・独立レビュー完了。全体QAと実System移行は別途
維持責任者・判断権限: Qual-Lab
確認日: 2026-10-20

## 1. 結論と変更境界

利用者の再編方針を基本とし、`git/command.ts`だけを合意済みの`git/read.ts`へ補正する。Version Controlを独立Packageとして維持し、Git操作の再実装・Library追加・安全条件の緩和を行わない。

現行Sourceは23 File・9,036行、Root公開は実行時61名と型37名である。添付の基準`add26c3`以降、同Packageの本体変更はなく、利用側閉包試験のPath追従だけがある。公開API維持を基本とし、移行比較の1操作・1型の退役だけは別判断とする。

調査範囲は全Sourceの宣言・依存・主要操作、Root公開、`40_Develop`と`template/tools`の参照、登録試験、対応Architecture・Qualityである。単純な文字列検索には試験内の反例文字列も含まれるため、本番利用と合算しない。今回の棚卸しで試験は再実行していない。

変更分類は非自明な実装Refactorの計画。実装時は詳細Architecture・公開API・Consumer・試験・Symbol・台帳へ伝播し、技術／品質の独立レビューと文書／直接影響の確認を行う。準拠基準・Release・外部AI・Docker実行は変更しないため、それらの監査・E2Eを今回の配置変更だけから追加しない。

## 2. After候補

以下は責務配置の候補であり、実装済みの宣言ではない。

```text
src/
├ index.ts                    実Ownerから公開名を明示列挙
├ repository/
│  ├ location.ts              exact Root検証・利用時の再確認
│  ├ layout.ts                Git管理領域・実体・構成の観測
│  ├ revision.ts              Revision／形式／固定Identity
│  ├ snapshot.ts              固定内容の検査・読取り・限定実体化
│  ├ changes.ts               変更集合の検査とGit差分観測
│  ├ worktree-view.ts         読取り用Tree・選択差分・ページング
│  └ ignore.ts                Repository-local除外の登録と安全な更新
├ workspace/
│  ├ worktree.ts              専用Worktree／Branchの作成・観測・終了
│  ├ candidate.ts             選択差分の固定・内容確認・専用Ref回収
│  └ merge.ts                 固定Candidateの明示Merge・二親確認
├ publication/
│  ├ change.ts                通常Stage／Commit／Pushの要求・結果と受付
│  └ git.ts                   上記操作の具体的なGit接続
└ git/
   ├ read.ts                  diff／ls-filesの既存限定実行
   ├ objects.ts               既存Object Reader。改名・参照追従のみ
   └ observation.ts           入れ子Repository等の有限な観測
```

Packageには現在binがない。今回のためにbin／CLI受付を新設しない。`git/read.ts`は全Git操作の共通実行基盤ではなく、`cli/command.ts`に相当するコマンド受付でもない。

## 3. 全Sourceの対応

PathはPackageの`src/`からの相対Path。

| 現行 | 配置候補 | 理由・維持する境界 |
|---|---|---|
| `index.ts` | 同左 | 明示公開を維持。Capability内barrelを作らない |
| `repository/location.ts` | 同左 | Root能力の所有・発行・再確認を維持 |
| `git/layout.ts` | `repository/layout.ts` | 管理領域の観測と実体確認を所有 |
| `git/layout-adapter.ts` | `repository/layout.ts`へ同居 | 同じLayoutの入力拒否・結果投影。実処理を残し単独中継Fileを除く |
| `repository/revision.ts` | 同左 | 現在Revisionの操作・型 |
| `fixed-revision.ts` | `repository/revision.ts`へ同居 | 固定Identityも同じRevision責務 |
| `git/revision-adapter.ts` | `repository/revision.ts`へ同居 | HEAD／Ref観測と中立結果への変換を維持 |
| `fixed-snapshot.ts` | `repository/snapshot.ts` | 出力先能力・容量・Content Policy・部分成立結果を維持 |
| `git/fixed-snapshot-adapter.ts` | `repository/snapshot.ts`へ同居 | Object Readerへの実接続。単純reexportにしない |
| `local-change-set.ts` | `repository/changes.ts` | 比較基準・変更Path・結果契約 |
| `git/local-change-set-adapter.ts` | `repository/changes.ts`へ同居 | 有限Git出力の解析と変更集合への変換 |
| `repository/worktree-view.ts` | 同左 | 読取り表示・Path／Cursor検査 |
| `git/worktree-view-adapter.ts` | `repository/worktree-view.ts`へ同居 | Tree／差分への実接続と失敗区別 |
| `repository/local-ignore.ts` | `repository/ignore.ts` | 除外登録の受付・結果 |
| `git/local-ignore-adapter.ts` | `repository/ignore.ts`へ同居 | exactなGit除外File更新・所有Lock・読戻し・失敗相関を維持 |
| `git/worktree-management.ts` | `workspace/worktree.ts` | 専用Worktreeの技術操作。Taskや採否判断を持たせない |
| `git/workspace-candidate.ts`の固定・確認・回収 | `workspace/candidate.ts` | 一つのBaseと選択集合から固定し、専用Refだけを回収 |
| 同FileのMergeとMerge状態読取り | `workspace/merge.ts` | 固定後の別操作・取込先のEffectと二親確認を分離 |
| `change-publication.ts` | `publication/change.ts` | 通常の変更公開とCandidate統合を混ぜない |
| `git/change-publication-adapter.ts` | `publication/git.ts` | 独立した具体的Git操作と注入Runnerの試験境界を維持 |
| `git/read-command.ts` | `git/read.ts` | diff／ls-files限定、filter確認・環境・出力上限・合計期限は不変 |
| `git/commit-tree.ts` | `git/objects.ts` | loose／packed／deltaの実装は置換しない |
| `git/checker-observation-adapter.ts` | `git/observation.ts` | 実際にGitを呼び結果変換している。品質判断は移さない |
| `migration-closure.ts` | Runtime公開からの退役候補 | 本番Consumerなし。専用合成試験とQA義務の処置は§6で別判断 |

統合は安全条件の削除ではない。公開Adapter型・値・契約ID・revisionは保持し、File名だけを理由に改名しない。同名private関数・定数の衝突が生じる場合は、参照先の一意性を保った内部改名に限定する。

### Candidate／Mergeの分離

`mergeWorkspaceCandidate`と、その操作だけが使う`readCandidateMergeHead`を`merge.ts`へ移す。共有する`operateCandidate`、`verifyCandidate`、`temporaryIdentity`等は実Ownerの`candidate.ts`から内部参照し、複製や転送専用Fileを追加しない。依存は`merge → candidate → worktree`とし、逆依存を作らない。Rootは各実Ownerから直接exportする。

## 4. Capability・利用側・検証の対応

| 保持Capability | 主な利用側 | 主な検証・反証 |
|---|---|---|
| Root／Layout | Domain、AM、Checker、Coordinator、EI、MCP、Orchestrator、Visual、Workbench、配布入口 | 通常／linked／submodule、偽装境界、link、発行後変更、観測不能 |
| Revision／固定Identity | Coordinator、Checker、各観測利用側 | HEAD／Ref／packed参照、形式不一致、観測間変化 |
| 固定Snapshot | Coordinator、固定内容利用側 | loose／packed・delta・checksum、容量・Path・mode、出力先の実体、部分生成と回収 |
| Local Changes／Tree／Diff | Checker、Domain、Workbench等 | dirty・未追跡、比較基準、Path／Cursor、filter拒否、環境差替え・出力上限 |
| Local Ignore | Domain等のRepository-local保存 | 並行更新、exact Lock、原子的公開、読戻し、Effect不明と清掃不明の相関 |
| Worktree／Candidate／Merge | Orchestrator、本番Workbench／MCPのWorkspace経路 | dirty／stage非混入、Baseと固定Commit、二親順序、Conflict・HEAD変化、途中失敗、再入場、他資源保全 |
| 通常Stage／Commit／Push | Workbench `server.ts`、`project/surface.ts` | 選択Path、確認済み公開先、通信失敗／拒否／不明、Force・自動再送なし |
| Repository観測 | Checkerの観測・回帰選択経路 | nested境界、Gitlink、入力・出力・失敗の区別 |

成立済み能力と過去Evidenceは[Version Control詳細設計の基準版移行表](../../../06_Architecture/Details/version-control/01_Architecture.md#9-基準版capabilityの移行)を比較入力とする。実装履歴は`9c462a2e9`（Worktree）、`5038b6bdd`（固定・明示Merge）、`174bef00d`（公開入口）、`9e99cdf10`（Workspace回帰是正）を確認した。過去の署名・Provider結果は当時の根拠として維持し、新配置の検証を代替しない。

他PackageのSourceはRoot公開入口を利用している一方、Coordinatorの一部試験はObject／Layout等の内部へ直接接続している。配置換え時には単なるPath追従と正式APIへの接続判断を分け、試験用内部Symbolを無条件にRoot公開しない。利用側閉包試験内の不正import反例は、本物の未移管参照として消さない。

## 5. 実装前に固定する検証境界

1. 全Sourceの移動と公開集合・型・契約値を照合する。操作順・引数・環境・出力上限・期限は不変。
2. 既存の実Git試験をRepository内の自己生成領域だけで再実行する。本体のBranch／Index／dirtyは試験対象にしない。Push試験は合成Local Remoteを用い、外部Remoteへ送信しない。
3. Worktreeの作成要求・登録観測・部分成立・取消／失敗後の資源状態を分ける。自動Rollback・強制回収・新しい回復機構は追加しない。
4. 単一結果や試験件数から全能力完成を推定しない。実行していない境界と既知の全体QA不合格を区別する。
5. Root／File／関数Headerを実際の読取り・書込み・Process起動へ合わせる。`effect N/A`なのにFS／Git操作を呼ぶ既存の説明は、操作本体を変えず訂正する。

## 6. 人間へ返す判断：移行比較APIと専用合成試験

### 確認できた事実

`inspectMigrationSystemClosure`と`MigrationConsumerObservation`は、専用`migration-system-closure.contract.test.ts`と、その固定Consumer一覧Fixtureだけが使う。本番の移行・公開・回復入口では呼ばれていない。比較対象も`producer`等の合成配列であり、実SourceからConsumerを発見せず、公開／署名／Release／Recoveryを実行しない。

削除で失うのは、不足・余剰、旧契約・別Snapshot混在、固定役割の存在という合成集合の比較機能である。実Systemの移行保証を既に検証できていた、と扱わない。[現在のReality Audit](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)も、固定観測配列は実Consumerの実行を証明しないと区別している。

### 選択肢と推奨

| 選択肢 | 得るもの／失うもの | QAの扱い |
|---|---|---|
| 専用比較処理を試験側へ移す | 局所比較を残し、Runtime公開を減らせる。ただし本番で使わない比較処理を自分の試験だけのために維持する | 実System試験と表示しない。実移行の確認義務は未成立のまま |
| 比較処理・専用合成試験・Fixtureを撤去する（推奨） | 実行時1操作・1型と専用3Fileを退役し、不要な維持対象を減らす。合成集合の判定機能自体は失う | `RCM-ST-012`の実Consumer移行確認義務は削除せずOPENを維持。既存の実利用側・境界試験を接続し、足りない実境界を明示する |

`RCM-ST-012`のOwnerは[QA-000001](../../../07_Quality/Definitions/QA-000001/quality_definition.md)である。Version Control詳細の`contract-migration-closure`と[Quality対応表](../../../07_Quality/04_Quality_Integration.md)へ同じ処置を伝播する。古い署名経路の記述を今回の命名変更だけで現行要求へ復活させない。

利用者は比較処理・専用合成試験・Fixtureの撤去を承認した。実Consumer移行確認義務はOPENのまま残す。新しい移行Runner・Registry・永続状態・同じ比較処理の恒久的な移し先Packageは作らない。

## 7. 今回の棚卸し結果と未実施

棚卸し時点の読取り専用の技術／品質確認で、配置案とCandidate／Mergeの一方向分離は妥当と確認した。移行比較の退役と、実Consumer確認義務を分ける条件を利用者が承認した。その後、Source16 Fileへの再配置、移行比較の退役と既存試験・利用側・台帳の追従を実施した。実Git63件、関連Coordinator54件、台帳・保存境界29件が成功した。独立レビューのHeader誤記20関数を処理不変で訂正し、公開／Header／QA接続8件も成功した。最終確認結果と全体品質の留保は[変更計画](second-stage-plan.md)へ要約する。
