# 現行CLI・MCP・Workbenchの操作・表示参照

状態: v0.22 Featureの現行Source投影（実端末・実Providerの今回検証ではない）
担当責任者: Qual-Lab
最終更新日: 2026-11-17
工程規則: [UI](../25_UI.md)、[UIと仕様の対応レビュー](../24_UI_Behavior_Specification.md)

## 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 論理画面／領域構成図 | CROS Workbench | Project概要、Source Coverage、操作領域の配置 | 既存参照 | [UI Detail](Details/01_UI_Detail.md)と[Workbench Screen Architecture](Details/02_Workbench_Screen_Architecture.md) | v0.22 Candidate | 15画面を実装・実Browser観測済み | 人間UATとAI関連2画面の実Provider成立 | UATまたはScreen Contract変更時に再評価する |
| 画面／操作Flow | Agent Handoff | 対話、構築、判断待ち、再開の操作順序 | 作成不能 | [Agent Handoffの表示](#91-agent-handoffの表示)は判断待ちの単一表示例であり、操作順序のFlowではない | v0.22 Candidate | 未作成 | 対話から構築、判断待ち、再開までの操作遷移 | Group BのUIで作成し、SPECと共同確認する |
| 表示状態／Variant図 | Orchestrator結果 | 完了、停止、回復、判断待ちの表示差 | 作成不能 | [Orchestratorの状態表示](#8-orchestratorの状態表示)は表示原則であり、状態Variantの対応図ではない | v0.22 Candidate | 未作成 | 状態ごとの表示差、優先度、操作可能性 | Group BのUIで作成する |
| 主要Component関係図 | CROS Workbench | 表示Componentと責務境界の関係 | 既存参照 | [Workbench Screen Architecture](Details/02_Workbench_Screen_Architecture.md)、[Workbench Architecture](../06_Architecture/Details/workbench-server/01_Architecture.md)および[Workbench視覚基準](Details/Visual/workbench-hero/visual-baseline.md) | v0.22 Candidate | Browser ReactとNode Authorityを分離済み | 人間UATと実Provider境界 | 責務境界または画面構成変更時に再評価する |
| UI／SPEC対応図 | 現行Tool操作 | 表示・入力と振る舞い契約の対応 | 既存参照 | [Workbench UI／SPEC Detail対応](../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)。本書の[概観](#6-uiと振る舞い仕様の対応)は補助投影 | v0.22 Candidate | Workbench実装とHTTP／Browser試験へ接続済み | AI関連2画面の実Provider E2E | 対応またはBehavior変更時に共同レビューする |

## 1. 対象と読み方

本書はv0.22 Featureの現在のCLI・MCP・Workbenchの操作・表示参照である。Sourceから確認した受付・結果搬送と、UIとして維持する表示要求・未評価の利用品質を区別する。過去の端末確認・署名版E2Eは当時のEvidenceとGit履歴に残し、現在の表示成立へ転用しない。

現在の接続は[配布Coordinator入口](../template/tools/crdd-coordinator.ts)→[CLI起動](../40_Develop/coordinator/bin/coordinator.ts)→[対象・操作の受付](../40_Develop/coordinator/src/cli/command.ts)→用途別APIである。[CRDD Server配布入口](../template/tools/crdd-server.ts)と[Workbench](../06_Architecture/Details/workbench-server/01_Architecture.md)は各Transport・認証の境界を保持する。CLIの利用条件を、そのままMCP／HTTPの認証済み主体や認可へ流用しない。

## 2. 操作接点と表示構造

| 接点 | 現行の入力・操作 | 表示と次の行動 | 保持する境界 |
|---|---|---|---|
| 案内・診断 | `help`、`capabilities --json`、`doctor`、`doctor --isolation` | 対応操作、診断理由、対象と次の処置を確認する | 構文受付・能力一覧から実行権限やDocker利用可能性を生成しない |
| 単一Task | `run task --request-stdin --json --principal-id <local.email.address>` | 標準入力で構造化要求を渡し、標準出力のJSON終端結果を読む | 呼出し側がWorkspaceと主体を明示。Task結果のstdoutは非TTYを要求し、直接の人間向け表示は上位Clientが所有する |
| 読取り助言 | `run advice --request-stdin --json --principal-id <local.email.address>` | Repository Contextを基に助言を取得する | 本文は`read_only_advice`、編集Pathは空、Workspaceはnull。結果は助言であり変更・採用を意味しない |
| Project | `run objective --request-stdin --json --principal-id <local.email.address>` | 有効な新規開始の初回保存で内部初期化する | Task受付とProjectの目的・状態遷移を同一視しない |
| Provider認証 | `auth status codex\|claude [--json]`、`auth login codex\|claude` | 状態確認と公式対話ログインを区別する | Loginだけはstdin／stdoutを直接端末へ接続し、JSON出力を受け付けない。生対話をTask本文・診断・Snapshotへ保存しない |
| 取消 | 実行中のCLIへSIGINT／SIGTERM | 取消要求後も終端結果を待つ | 要求受付、Process終了、回収確認、Listener解除を区別する |
| 回復・保守 | `recovery inspect <id>`、`recovery resume <id>`、`recovery resume <id> --restart-docker`、`maintenance repair`、`maintenance repair --retain <id>` | exactな対象と結果を確認する | 表示だけで再送・再起動・削除を許可しない。明示的なDocker再起動の前に、[同じDockerを使う他の実行・回復を止める](../19_Workflows/01_Coordinator_Runtime.md#正常なdockerで作成結果不明のtaskを回復するとき) |
| Workspace候補 | Workbench／MCPとCoordinatorのWorkspace操作 | Workspace ID、Base／Candidate Commit、固定・採用・回収結果を分ける | 旧CLIのcandidate export／discardを現行入口として案内しない。採用はTask完了と別判断 |
| Checker | 対象、`--json`、`--summary`、Scope | 診断、対象、未確認範囲を読む | 指摘0を全範囲検証済みやRelease可としない |

上表の構文は[能力一覧の実装](../40_Develop/coordinator/src/lifecycle/environment.ts)と[CLI契約試験](../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts)に接続する。本書の更新では操作を実行しておらず、認証・実Task・Docker・回復の成功を新たに確認したものではない。

## 3. 状態の認識と操作条件

通常Task／ProjectはJSON要求・結果の機械向け入口である。構文不正、主体不正、Node版・出力条件の不一致では受付を拒否する。CoordinatorがGit利用者情報を勝手に補完することはなく、ローカルCLIの主体は入口が確定して引数で渡す。Workbench／MCPはそれぞれの認証済み主体を伝播する。

Taskの要求本文はstdin、結果はstdoutへ分離する。認証Loginの公式対話とは異なる。旧PAの端末writer／reader、確認コード入力、初回同意の対話Runtimeは現在の接続ではない。送信・実行の許可をCLI起動、モデル選定または保存成功から推定しない。

| 状態 | 表示上の意味 | 次の行動 |
|---|---|---|
| 受付拒否 | 実行開始前の不正・不足 | reasonと入力契約を確認する。空の結果を成功にしない |
| 処理中・取消要求済み | 終端結果は未取得 | 終了・回収結果を待つ。ウィンドウ終了やSignal送信だけを取消完了にしない |
| 実行完了・回収確認済み | 操作結果と技術的な回収を別々に観測 | 成果の採用・Commit・受入は別の操作として扱う |
| 終了・回収不明 | 残存や未確定処置を否定できない | 返された回復参照と記録を保持し、自動再試行しない |
| 認証状態・Login結果 | Providerの状態観測または公式対話の結果 | 対話の完了、認証結果、資源回収を区別する |

通常Task CLIは`status === "completed"`かつ`cleanupConfirmed === true`で終了コード0とし、それ以外の操作結果は2、引数等の受付不正は64を返す。取消Listener解除が確認できなければ元結果を保持しつつunknownと二次失敗を搬送する。詳しい相関は[Task受付](../40_Develop/coordinator/src/cli/command.ts)と[取消接続](../40_Develop/coordinator/src/cli/command.ts)が所有する。

## 4. 現行表示の参照と表現方針

Task／ProjectのJSONキー・状態・理由・回復参照を、表示都合で書き換えたり欠落をfalseへ補正したりしない。上位Clientは「結果→理由→次の行動→追跡情報」の順に整理する。技術回収、業務上の完了、採用、受入は別表示とする。進捗を残時間や成功確率へ変換しない。

診断・回復の人間向け表示は[回復結果の投影](../40_Develop/coordinator/src/cli/command.ts)、Provider Loginの端末条件は[認証CLI](../40_Develop/coordinator/src/cli/command.ts)を参照する。廃止したrenderSafeHumanCommandReportや旧端末確認プログラムを現行の表示根拠にしない。Coordinator固有のRelease鍵・署名・昇格は[廃止済み](../19_Workflows/01_Coordinator_Runtime.md#coordinator固有署名方式の廃止)であり、通常操作の準備として案内しない。

文字サイズ・配色・折返しはCLIでは端末、Workbenchではその画面が所有する。表示のために秘密・生Provider出力・内部Capabilityを復元しない。色だけに依存せず、操作できることとできないこと、未確認と失敗を文言でも示す。

## 5. アクセシビリティ・利用品質の義務

- 対話開始を認識でき、キーボードで確認・拒否できる。正しい入力の確定に余分なEnterを要求しない。
- 文字化け、折返し、長いID、低コントラストで重要条件や次操作が読めなくならない。
- 入力待ちの端末が見えないまま時間切れにならないことを確認する。時間切れや読取り失敗では許可を発行しない。
- 秘密入力は秘匿し、非秘密入力と混ぜない。秘密を入力保持・ログによって復元可能にしない。
- 実行結果が読める前にウィンドウが閉じないことを公開起動経路ごとに確認する。ホスト端末の所有とRuntimeの所有を分ける。
- 対象とするアクセシビリティプロファイルに従い、読み上げ順序、拡大・折返し、色非依存、対話／非対話の環境差のうち適用する観点を確認する。対象範囲と未評価環境は§7で区別する。WCAG等の適合は本書で宣言せず、未評価の読み上げ対応を利用可能と扱わない。

<a id="ui-spec-mapping"></a>

## 6. UIと振る舞い仕様の対応

| 操作単位 | UIが所有する確認 | 契約・実装・試験の接続 |
|---|---|---|
| Task／Project受付 | 主体・対象・入力不正・JSON終端を識別する | [CLI受付](../40_Develop/coordinator/src/cli/command.ts)、[CLI試験](../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts) |
| Provider認証 | 状態確認と対話Loginを分け、秘密を表示記録へ複製しない | [認証受付](../40_Develop/coordinator/src/cli/command.ts) |
| Workspace候補 | 固定・確認・採用・回収をTask完了と分ける | [候補昇格の振る舞い](../05_SPEC/Details/BHV-000027/behavior.md)、[Workspace結合試験](../40_Develop/crdd-server/tests/integration/workspace-lifecycle.integration.test.ts) |
| Workspace作成 | 選択ブランチのHEADから作成する。元の未コミット変更がある場合は、引き継がないことを案内して確認を待つ | [Workspace横断契約](../06_Architecture/Details/coordinator/05_Workspace.md) |
| 取消・回復 | 要求・終端・回収確認を区別する | [取消試験](../40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts)、[回復CLI試験](../40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts) |
| Workbench表示 | 画面の状態・次行動とBehaviorを同じ意味で示す | [UI／SPEC対応](../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)、§9 |
| Checker | 指摘・検査範囲・未検査を読み分ける | [Checker契約](../05_SPEC/07_Current_Behavior_Reference.md#checker-contract)、[操作手順](../19_Workflows/02_Checker.md) |

Sourceの現行接続とSPECの旧Runtime記述を自動的に同一視しない。UIと仕様の共同確認は[共有契約](../24_UI_Behavior_Specification.md)に従い、旧署名・旧端末の試験結果を現在版の成立へ読み替えない。

<a id="open-issues"></a>

## 7. 既知差・未確認事項と完了判定

| 対象 | 現在確認できること | 未評価・次の確認 |
|---|---|---|
| CLI構文・結果搬送 | 現行Sourceと契約試験の接続を参照できる | 本更新は実端末での可読性・操作品質の再測定ではない |
| 認証の対話 | 公式対話へ接続する入口と端末条件がある | 実認証、読み上げ、全端末・OSの利用品質を本書更新から保証しない |
| Task取消・回復 | 取消配送・解除不明と操作結果を区別する | 実Provider・実Dockerの取消・回収を今回は実行しない |
| Workbench | §9と既存UI／SPEC Detailが表示要求を所有する | 人間UAT、未評価の実Provider境界、支援技術確認は別Gateで保持する |
| 過去の端末・署名版確認 | 当時のEvidenceとGitで追跡する | 現行Sourceの試験・実測として転用しない |

現在の検証範囲と未評価は[Quality Center](../07_Quality/01_Quality_Center.md)で確認する。過去の結果を削除・再評価せず、最新実装の説明から履歴の数値・手順を分離する。

<a id="8-orchestratorの状態表示"></a>

## 8. Coordinatorの状態表示

Projectの目的、Taskの処理中・終端、Workspace候補、Blockerの判断待ち、技術回収を別々に示す。件数やCompleted表示だけからRelease可能性を推定させない。内部Queue・Lock・保存段階を利用者に解釈させず、何が止まっているか、判断・再観測・明示操作のどれが必要かを説明する。

Blockerは提案と回答の履歴を持ち、回答だけで自動解決したと表示しない。適用結果と現在状態を確認し、拒否・保留や未観測を承認済み・実行再開へ補正しない。現行の[判断モデル](../06_Architecture/Details/execution-model/01_Architecture.md)と[Coordinator](../06_Architecture/Details/coordinator/01_Architecture.md)へ接続する。旧継続Capabilityや耐久ACKの手順を新しい操作条件として復活させない。

## 9. v0.22 Project Operation／CROS Workbench

本節は、同じProject Operation契約を立場に応じた粒度で投影する要求を示す。v0.22ではこの要求を満たす最小Workbenchを実装するが、図の配置を固定Pixel Layout、特定GUI FrameworkまたはCommercial Schemaの確定とは扱わない。

```text
Project: PRJ-001
────────────────────────────────
Overview

Topics          8 Open
Meetings        4 This week
Changes         5 Active
Quality         1 Blocked
Commercial      認証が必要

Source Coverage
├ Development Repository   available
└ Management Repository    credential_required
```

| 表示層 | 主表示 | 詳細へ退避する情報 |
|---|---|---|
| Repository作業 | 現在RepositoryのContext、現在の変更、次の行動 | 兄弟Repository、Project Federation、内部Binding |
| Project | Milestone、主要Topic、Meeting、品質、判断待ち、Source Coverage | Repository ID、Git Revision、取得診断 |
| Portfolio | Projectごとの注意状態、主要判断、観測時点 | 個別Topic、Meeting、CHG、Repository詳細 |

Project表示は、利用可能なContextだけから作った結果を全Projectの完全な状況として見せない。Source Coverage、観測時点および`missing`、`credential_required`、`restricted`、`unavailable`、`conflicting`または`unknown`のうち、利用者が判断に必要で開示可能な状態を近接して示す。

`Commercial 🔒`等の鍵表示は、対象の存在を開示でき、別の有効なConnection Credentialで利用できる`credential_required`だけに使用する。恒常的な`restricted`へUnlock操作を表示せず、存在開示が許可されない対象の名前、件数または状態を表示しない。UnlockはServer内で権限を追加する操作ではなく、Client側で別Credentialを選び、次のRequestをそのCredentialで認証する操作として扱う。

Meetingからの`Topicを更新`、`新規Topic化`、`Decision候補化`等は、対象正本への変更候補を作る操作として表示する。操作成功を正本更新済みまたは人間判断済みと表示せず、候補、確認、採用、再投影を区別する。

最小Workbenchの完成には、Project／Portfolioの選択、Project View、Source Coverage、Topic／Meeting／判断待ち、正本への導線、Credential切替状態、および既存公開契約を通した一つ以上の定型操作を含める。画面内だけの集計、直接Filesystem更新、独自Authority判定または独自状態Storeで同じ結果を再実装しない。

### 9.1. Agent Handoffの表示

```text
Task: Repository変更
状態: 判断待ち

必要な判断
  どの公開範囲を採用するか

根拠
  Topic／Decision候補／対象Revision

再開条件
  決定を正本へ記録し、ContextとAuthorityを再検証

[対話で確認する]
```

Handoff表示では、現在のTask、停止理由、必要な判断、根拠、決定主体、許可済みEffectおよび再開条件を近接して示す。Chat Agent／Coding Agentの内部推論、会話全文、Credential、秘密値またはopaqueなCapabilityを表示しない。`対話で確認する`はChat Agentへ判断要求を渡す入口であり、判断済み、CRDD準拠済みまたはRepository Effect許可済みという表示にしない。
