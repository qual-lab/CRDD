# CRDD内部ツールの振る舞い仕様

Status: Stable
Owner: Qual-Lab
Last Updated: 2026-09-02

## 対象と読み方

本書はCRDD参照Runtimeの入力、利用条件、結果、停止・回復、および現在の実装範囲を所有する。上位の[エージェント組織](../04_Agent_Organization.md)や人間の決定権限を再定義しない。実行手順は[作業手順](../19_Workflows/01_Coordinator_Runtime.md)、成立方式は[アーキテクチャ](../06_Architecture/01_Architecture.md)、検証の現在状態は[品質確認](../07_Quality/01_Quality_Center.md)へ分離する。

既存実装を責務別に整理した仕様である。Local Personal一般Taskは各操作で必要な境界を検証し、永続的なRuntime有効化やPlatform Provisioningを公開Capabilityとして持たない。内容とReleaseメタデータはv0.18.1の最終候補としてStableであり、公開済みかどうかは公式タグまたは同等の不変なRelease識別子から確認する。網羅状態は本書の各制限と[変更トレース](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)で追跡する。

利用者の目的は[利用体験](../02_UX/01_User_Experience.md)、対象と導線は[情報構造](../03_IA/01_Information_Architecture.md)、表示・操作と本仕様の共同確認は[UIと仕様の対応](../04_UI/01_User_Interface.md#ui-spec-mapping)へ接続する。既存実装から再構成した対象の採用は[人間の内容採用記録](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#candidate-adoption-20260901)に基づき、現在の公開準備や新しい期限契約の検証完了とは区別する。

## 現在できること

### 正式配布物の有効期間

公開版は、署名manifestのrevision 5に`expiresAt: null`を明示することで、有効期限だけを理由とする起動停止を行わない。現行Runtimeはrevision 5だけを受理し、revision 2／3／4をfallbackまたは互換入力として扱わない。署名・Runtime実行Identity・実行権限を省略する設定ではなく、旧配布物の署名改変や期限の無断延長は拒否する。初期同意、操作の許可、候補、準備記録の期限は別契約のまま維持する。期限なしは永久サポートや将来の互換性保証ではない。

以下の既存実装範囲と、新しい期限なし契約の検証状態は[品質状態](../07_Quality/01_Quality_Center.md)で分ける。

Coordinatorは依頼を安全な候補成果物へつなぐ実行ツール、[Checker](#checker-contract)は文書を変更せず整合を検査する独立ツール、[platform-access](#platform-access-contract)はCoordinatorから利用するWindows内部部品である。以下のRuntime利用条件を、Checker単独実行の条件へ適用しない。

現在の実装候補は、CodexまたはClaude Codeを入口として、Coordinatorが理由付きで実行者と独立確認者を選び、公式CLIの既存Subscription OAuth Sessionだけを使って隔離されたローカルCandidateを作成・検証・回収する。現行Runtime実行Identityでは、fresh cloneと親Repository＋submoduleの一般Task、実Providerの4経路4/4、および失敗／timeout／cancel／親Process消失／cleanup不明を含むRecovery Matrixを実測した。字句解析、共通Launcher結合、子Process／Worker起動APIのimportと全利用箇所の照合、および説明不能な起動形のFail Closedも署名Identityへ含む。Frontは指定Profileであり実アプリのIdentity認証ではなく、固定Taskの成功を任意の実務Taskへ一般化しない。旧版での実務自己適用の有用性は[現時点の評価](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)で整理したが、比較優位は未実証である。実行単位EvidenceとA／B／C Release契約の限定再確認、最終Release CommitでのIdentity不変確認およびRelease判断は別に残る。

過去の`f2243b46…f1aaa`および`33cca9b8…2473a`に対する実測は未公開候補の履歴である。独立確認で、前者は共通Launcherから到達する署名・4経路・Recovery Runnerの閉包不足、後者は依存抽出と選択scriptの子Process／Worker targetをFail Closedに閉じる不足を検出した。どちらもv0.18.1の最終Authority根拠へ流用しない。字句解析、literal Launcher結合および子Process target結合を含む新しいIdentityの署名・fresh clone／submodule一般Task・4経路・Recovery・独立確認が完了するまで本CapabilityはRelease未完了である。

| 層 | 現在の状態 |
|---|---|
| 利用者が準備するもの | Windowsの認証済みローカル対話ユーザー、Docker Desktop Linux Engine、公式Codex／Claude Code CLIの専用Provider HomeでのSubscription OAuth login、真正性を確認した署名済みCRDD配布物、Repository単位の外部送信Policy |
| 通常実行 | 初回だけ全Provider処理境界を確認し、選択ユーザーと保護Runtime Stateに結合した単一Active同意を180日または明示取消まで再利用する。各TaskのRevision、Scope、Provider、AuthorityおよびCandidateは毎回検査する |
| 対象外 | API key、従量API、追加購入、有料fallback、Provider間の直接spawn、commit／push／merge／Release／公開、T3／T4相当のHost tamper resistance |

現在の`Coordinator Runtime`実装は、Codex／Claude Codeのどちらをフロントにした場合も、調整役が必要性、適格性、費用、プロバイダー特性および独立性を理由付きで判定し、必要なら別プロバイダーの実行者または確認者へ安全に委譲する。フロントだけで完了できる作業は委譲せず、委譲時は利用枠分散のためCodex→Claude Code／Claude Code→Codexを既定候補とし、同一プロバイダーは特性、独立性または反対プロバイダーの明示的不適格性を説明できる場合だけ選ぶ。これは現在のRuntime戦略であり、エージェント組織の固定プロバイダー対応関係ではない。

RuntimeはCRDDのAuthority、固定改訂版、検証、ReviewおよびCurrent Decision Setへ各役割を接続する。push、merge、Release、公開、購入または一般外部EffectはRuntime 1.0の対象外であり、Provider認証は公式CLIが既存Subscription OAuth Sessionを自身の専用Homeから利用する経路だけを標準対応とする。


## 共通起動入口

`40_Develop/coordinator/bin/launch.ts`は同じ配布物内の既存入口を選ぶ一回限りのCLIである。任意script、別Node、別配布物を選択する機能ではない。

| 用途 | 接続先 | 入出力条件 |
|---|---|---|
| `task --request-stdin --json` | 通常CLIの一般Task | 採用Repository向けの推奨入口。stdoutは非TTY。必要条件はOperationごとに検証する |
| `interactive <CLI引数>` | 通常CLI | stdoutが書込み可能な端末。Taskの構造化stdinは転送可能 |
| `automation <CLI引数と--json>` | 同じ通常CLI | stdoutは非TTY、`--json`必須。現在のWindows Runtimeで同意が不足する場合は停止し、自動承認しない |
| `verify-routes` | 署名済み4経路検証 | stdoutが書込み可能な端末、追加引数なし |
| `verify-recovery` | 署名済み復旧検証 | 端末不要、追加引数なし。内部子Process引数は公開しない |
| `sign-release <署名引数>` | 既存署名入口 | stdin／stdoutとも端末。引数検査と秘密入力は既存署名入口が所有 |

Node版・用途・入出力の不一致は対象入口を読み込む前に固定理由と終了コード64で拒否する。案内の`--help`は端末を要求しない。TypeScriptを解釈できない旧Nodeではこの説明自体を実行できないため、呼出し元のNode事前確認を省略しない。

既存入口の署名、Repository、Authority、同意、取消、cleanup、結果と終了コードを維持する。共通入口はそれらを事前成立させるAuthorityではない。接続後の未処理例外は終了コード2と状態未確認の説明を返し、成功結果や回収確認を生成しない。既存の直接入口は内部呼出しと既存利用のため保持する。人向け手順は共通入口を優先する。

Local Personal一般Taskは永続的なManaged／Hardened Runtime状態を前提にしない。公開CLIは`task`、`doctor`、`candidate`、`capabilities`だけであり、削除済みの有効化・無効化・準備commandを互換入口、失敗専用入口または将来予約として残さない。

### 検証結果の保存

4経路・復旧検証の通常CLIは、公開引数とNode版を確認後、検証済みの対象Repository直下`.crdd/verification-results/<UUID>/`へ`started.json`を保存してから既存の検証処理を実行する。終了時は`result.json`へ最終結果の限定要約を保存し、flush・read-back成立後だけ結果hashを持つ`complete.json`を追加する。共通起動入口からも同じ処理へ接続し、内部Recovery子Processとimportによる関数利用では保存しない。

保存対象は固定metadata、開始時Repository改訂版、既知の合否・停止理由・件数・回収状態・文法確認済み回復ID・検証済み結果が返した版識別子に限定する。自由文、入力、Task本文、Provider生出力、秘密値、host pathは保存しない。未知の理由は`unknown`、不正な値はnull等とし、不完全な配列／回復IDを完全な記録と表示しない。開始時HEADは実行配布版の証明ではない。

開始保存に失敗したら検証処理を呼ばず、部分的な記録領域は保持する。終了保存に失敗したら元の実行結果を端末へ残して終了コード2とし、実行結果と保存成否を混同しない。完了記録の欠落、壊れたJSON、異なるID／種別／開始時刻の組合せ、結果hash不一致は結果未確認であり、成功・資源不存在・自動再試行の根拠にしない。

記録は非Authorityのローカル診断情報であり、署名Evidence、Recovery台帳、実行許可を代替しない。通常Task・秘密入力・署名のログ保存へ拡張しない。

## 導入時のRepository単位

Runtimeは、有効化を明示した対象Repositoryだけを一つのOperation単位として扱う。通常のRepository、linked worktree、および`.git` fileを使うが`core.worktree`を持たない限定worktreeをRuntime 1.0の対象候補とし、bare Repositoryと標準submodule自身は対象外とする。

親RepositoryがCRDDをsubmoduleとして参照しているだけなら、CRDD側のGit metadataやRuntime Rootには触れない。CRDD-Communication等を別Repositoryへ分離した場合も、読取り依存として参照するだけならそのRepositoryを変更しない。変更対象にする場合だけ、そのRepositoryで個別に有効化し、Root、activation、local exclude、Candidate RevisionおよびOperationを分離する。Runtime RootをRepository間で共有せず、複数Repositoryへの同時書込みOperationはRuntime 1.0の対象にしない。

## RepositoryのObject Format

Release Identity Schemaは40桁SHA-1と64桁SHA-256のGit Object IDを表現できるが、Coordinator Runtime 1.0のRepository reader、Candidate Storeおよび一般Taskは40桁SHA-1 Repositoryだけを実行対象とする。CRDD配布Releaseの64桁Identityは、署名commandではpassphrase取得とFilesystem観測より前、正式RunnerではTask開始前に専用reasonで停止する。作業対象Repositoryはread-onlyのGit config／HEAD Object Format preflightをOperation作成、External Send Grant、Candidate Store、workspaceまたはProvider processより前に行い、SHA-256なら`coordinator_task_git_object_format_unsupported`で停止する。bind層も40桁だけへ限定し、64桁を40桁へ変換、切り詰め、別Repositoryへ読み替え、または後段の一般エラーへ流さない。これはSourceTree等のGit client選択ではなく、Repository Object Formatの能力境界である。

## 制御境界

RuntimeがOperation状態、実効Authority、Repository Identity、Provider起動、Result検証、停止、再開および完了条件を所有する。Codex Coordinator Agentが返す計画、Packetまたは判断集合は候補であり、RuntimeによるProfile、Authority、CapabilityおよびIdentity照合なしに実行しない。

Runtime 1.0が許可する変更は、Operation専用の隔離workspace内のローカル差分だけである。Provider子プロセスへcommit、push、merge、tag、Releaseまたは一般外部Effectの能力を与えない。

詳細な脅威、主体別権限および停止条件は[脅威モデル](../06_Architecture/coordinator/02_Threat_Model.md)を参照する。変更の判断と追跡は[`CHG-000015`](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)が所有する。

Task Promptは目的、受入基準、許可Pathおよび役割の搬送だけに使う。Repository本文は許可された読取り投影からだけ渡し、Password、Private Key、Session Token、API Keyその他のSecret値をPromptまたは投影へ含めない。認識可能なSecretをRuntimeが拒否しても未知Secretの不存在までは証明しない。

## 公開Taskの入力・結果・取消

### 入力と受理条件

入力例、範囲・同意、受入条件の責任、指定可能な経路の順に示す。JSONの妥当性はRuntimeが検証するが、依頼自体の意味の十分性は呼出し元が所有する。

```json
{"frontProvider":"codex","requestedExecutorProvider":"auto","objective":"Update the bounded fixture.","acceptanceCriteria":["The expected value is present."],"allowedPaths":["fixture.txt"],"readPaths":["fixture.txt","README.md"],"workClass":"bounded_implementation","planState":"complete","risk":"low","difficulty":"low","decisionImpact":"limited","isLocalCandidateOnly":true,"hasUnresolvedDirection":false,"requiresCrossContextAlignment":false}
```

- `task`は上記の形のexact JSONを標準入力から受ける。
- `readPaths`はProviderへ見せる開始Revisionの投影で、省略時は`allowedPaths`と同じになる。
- Runtimeは両集合の和に`allowedPaths`を必ず含め、Repository全体を暗黙に送らない。
- 初回だけRepository Policyの全Provider処理境界と、永続化しない現在Operation Previewを分けて表示する。
- 同じ単一Active境界はTaskごとの再確認なしで使えるが、短命GrantはProvider候補、Revision、目的および読取り範囲へ毎回結合する。
- 境界変更、180日失効、明示取消、別選択ユーザー、保護Runtime State変更または判定不能では再承認または手動回復前に停止する。

- 一般Taskを組み立てる上位Coordinatorは、`acceptanceCriteria`を単なる完成条件の文章として転送せず、作業に適用する確認母集団へ具体化してからTask Packetを要求する。
- 条件分岐では発火、非発火、境界、判定情報不足を含め、Trust／Security／Authority／Effect境界では入力・状態、alias／indirection／境界、lifecycle段階およびEffect発生点を含める。
- 各項目はExecutorの実装・検証と独立Reviewerの確認対象になり、上位Coordinatorは未評価項目を成功へ統合しない。
- 対象に該当しない軸は理由付き非該当とし、不要な組合せやAgentを機械的に増やさない。
- 現在のTask Packet Runtimeは、callerが与えた`acceptanceCriteria`のshape、件数、byte上限と外部送信Scopeへの結合を検査するが、自然言語上の母集団の完全性を生成または証明しない。
- この確認母集団の意味と作り方は[エージェントの着手前整合確認](../10_Agent.md#pre-execution-alignment-check)を正本とし、本仕様はTask Packetへの実装接続と現在の限界だけを所有する。

- `requestedExecutorProvider`は`auto`を既定とし、Coordinatorが作業特性、独立性および利用可能性から選ぶ。
- `codex`または`claude`は人間または上位CoordinatorがExecutorを明示制約する場合だけ使用し、指定Providerを含む完遂可能なExecution Slateが成立しなければ別Providerへ暗黙fallbackせずEffect前に停止する。
- 正式Route Matrixの同一Provider例外もこの公開Task fieldを通り、Runner専用の選定裏口を持たない。

#### Roleと編集可能範囲

一般TaskではRoleとClaude CodeのPermission Modeを分離する。
- Executorだけがread-writeの隔離Workspace、`Read,Glob,Grep,Edit,Write`および`acceptEdits`を同時に受け、非対話実行でもCandidateを作成できる。
- Independent Reviewerはread-only mount、`Read,Glob,Grep`および`dontAsk`へ固定する。
- どちらもBash、Web、MCP、SubagentおよびProvider Home built-in tool accessを拒否する。
- `acceptEdits`はCanonical Repositoryへの書込みAuthorityではなく、隔離Candidate内の編集を許可するだけである。
- Executorの`changedPaths`は各turnの書込み履歴ではなく、開始Revisionから見た最終Candidateの完全な差分集合とする。
- 一回是正時も先行Candidate差分を含め、Runtime所有inventoryと完全一致しなければ永続Candidate未発行として停止する。
- Runtimeは開始Revision、許可Path、Candidate inventoryおよび内容を検証し、範囲外、空差分、内容不一致または判定不能ではCandidateを破棄してCanonical RepositoryへEffectを発生させない。

### 結果・候補・停止

| 判定対象 | 利用側へ返す意味 | 別に確認する条件 |
|---|---|---|
| Taskの完了 | このOperationの結果が成立した | 正本への採用・公開とは別 |
| Candidate | 検証した一時候補と利用期限 | export／discard時もIdentityと期限を確認 |
| 資源回収 | 所有資源を回収できたか | 業務結果の成否から推定しない |
| 手動回復 | exact IDによる処置、またはIDなしで担当者への引渡し | IDの不存在を回収済みと扱わない |
| Process再起動 | `processRestartRequired`が現在Processの再利用禁止を示す | Candidate保持と資源回復の要否とは独立 |

内部のproducer検証、完了値の受渡し、不可逆なProcess停止は[実現方式](../06_Architecture/coordinator/01_Architecture.md#task-result-transport)が所有する。

- 成功時の`candidateId`は承認済みCandidateをRuntime Storeから明示export／discardするためのopaque IDであり、canonical Repositoryを変更しない。
- export結果のfile内容は未信頼データで、Credential不在を証明しない。
- Policyのexport可能期限を過ぎるとexportできず、明示discardまたは次回の安全なRuntime／Candidate入口でbounded GCの対象になる。
- 常駐serviceを持たないため、期限到達と同時の物理削除は保証しない。

- RecoveryのFilesystem不存在は`ENOENT`だけから判定する。
- 権限拒否、共有競合、I/O失敗、非file、linkまたは削除後の再観測不能を「消えた」と扱わず、Evidenceと処置可能なRecovery IDを保持して停止する。
- Host active bindingが既に不存在でも、exactかつ完全commit済みのpointerと全identity条件が一致する場合だけfresh Processで回復を継続する。
- Task AdmissionとDocker Process Controllerは同じexact Projectorを使い、clean以外のproduction inventoryをOperation Effect前に停止する。
- 公開理由は競合、partial、identity不一致、観測不能および一般利用不能の固定分類に限り、内部Pathやcaller文字列を返さない。

### 取消の要求・完了・失効

- 取消入口は、liveな同一Operationの認証済みcontrolに対して、`status`、`reason`、`cancellationRequested`および`processTerminationObserved`のexact receiptを返す。
- 終了観測済みなら`provider_cancellation_requested`、終了未観測なら`provider_cancellation_grace_exceeded`だけを受理し、重複取消は同じ取消Effect、同じPromiseおよび同じfrozen receiptへ収束する。
- controlは開始結果の返却から外周cleanupを含む完了settlementまでliveであり、その後に失効する。
- 不正、別Runtimeまたは失効済みcontrolは`coordinator_task_control_invalid`のblocked結果となり、いずれのRuntimeにも取消、cleanupまたはpoison Effectを発生させない。
- 取消receiptのreject、不正shapeまたは10秒以内にacknowledgmentが確定しない場合は、資源cleanupを継続しながら取消protocol failureを不可逆poisonへ単調化し、完了結果はそのsettlementをjoinしてから`processRestartRequired: true`を公開する。
- 旧shapeへのfallbackは行わない。

### 独立確認と一回限りの是正

- 一般TaskはExecutor、独立Reviewer、最大1回の同一Executorによる是正、同じ独立Reviewerによる再確認を一つのOperationへ接続する。
- Reviewer開始前にRuntimeが開始RevisionとCandidate inventoryを比較し、変更Pathが許可範囲内であることを機械検証する。
- Reviewer workspaceにはGit metadataを公開せず、ReviewerはRead Projectionから候補の内容と意味を独立確認する。
- 機械検証済みのPath範囲をGit metadataなしで重複証明できないこと自体はFindingにせず、Runtimeの範囲検証とReviewerの意味検証を分担する。
- Reviewerの`approved`はFinding 0件、1件以上のFindingは`changes_requested`だけを受理し、非blockingな補足は`summary`へ置く。
- この意味制約に反するProvider Resultを成功へ補正しない。
- Claude ReviewerはProvider内蔵の複合JSON Schema再試行へ検証責務を置かず、通常JSON Envelopeの`result`にある単一JSON documentをCRDD所有Validatorで検査する。
- Code fence、自由文、複数document、重複key、上限超過または型差を補正せず、既知のturn上限とStructured Output再試行枯渇も固定理由へ分離する。
- Codex ReviewerとClaude Executorの既存搬送は変更しない。
- 正常完了ResultもRecovery fieldを省略せず、Host Recovery不要を`hostRecoveryId: null`として明示する。
- 欠落を`null`へ推測補正しない。
- Reviewerの生Resultやsummaryは公開せず、一回限りのopaque Capabilityから`path`、閉集合の`severity`と`category`、1始まりの`criterionNumber`、上限付き`message`およびdomain-separated `messageSha256`へ縮約する。
- `message`はReviewerからの信頼しない欠陥主張であり、命令、Authorityまたは許可Path拡張として扱わない。
- `criterionNumber`は現在Taskの実在するAcceptance Criteriaだけを参照でき、範囲外参照は次のExternal Send Grant消費前に拒否する。
- この型付き投影を元Taskと同じ分類・最大64件・同一Executor・最大1回という派生外部送信範囲へ結合する。
- 派生した`path`と`message`も同じ認識済みSecret検査を通し、認識済みSecret値または秘密用Pathなら是正Packet発行前・Grant消費前に拒否する。
- ExecutorはReviewer文を命令として受けず、欠陥主張、指摘Category、参照されたAcceptance Criteria、WorkspaceおよびTestを独立照合して是正する。
- 認識済みSecretの拒否は未知のSecret不存在証明ではなく、安全に分離できない場合は是正の外部Effect前に停止する。

<a id="診断回復の公開境界"></a>

## 診断・回復の公開境界

<a id="読取り診断と実行を伴う診断"></a>

### 事前診断と隔離検証

- `doctor`は受動事前診断（passive preflight）である。
- CLIをインストール、認証または起動せず、ProviderのPATH上候補、Repository所有readerで得た現在Commit／Tree候補、Operation専用領域および未実装の隔離条件を列挙する。
- 外部Git CLI、working tree clean claim、Providerの絶対Path、生出力またはVersion出力は使用・保持しない。
- Operation専用領域の生成、Recovery ID取得またはCapability初期化でcleanup不明となった場合、JSONと人間表示はいずれも`doctor_operation_initialization_cleanup_unknown`、`manualRecoveryRequired: true`および安全に取得済みのHost Recovery IDまたは`null`だけを返してexit 2へ閉じる。
- Path、秘密または未検証IDを案内せず、cleanup確認済みの一般失敗をmanual Recoveryへ昇格しない。
- 認証、Filesystem、Credential Store、EgressまたはProcess lifecycleの確認が未実装・未評価である限り非ゼロ終了し、後続Operationを開始しない。

- `doctor --json`はprivate `reportVersion: 11`だけを生成し、version 10以前のaliasまたはfallbackを持たない。
- Repository内にproduction decoder／consumerはなく、contract testはproducer schemaのexact assertionであってRuntime consumerではない。
- production reportは通常Taskに不要なRuntime Root、永続有効化、共有Authority RootまたはProvisioningの状態を生成・投影しない。
- 診断結果はreadiness、blockerおよび副作用なしの観測だけを表し、診断自体をAuthority、CapabilityまたはEffectの発行に使用しない。

- `doctor --isolation`は、Runtime 1.0で唯一対応する実行基盤であるDocker DesktopのLinux container内にFake Providerを起動する。
- Docker CLIは固定install root、Docker Incの有効なAuthenticode署名を確認して選択した固定Hashおよび実体Identityへ照合し、PATH候補やDocker Contextから差し替えない。
- 固定DigestのProbe image、read-only root filesystem、全Capability削除、`no-new-privileges`、PID上限および`--network=none`を使用し、Operation専用の`workspace/`、`provider-home/`、`tmp/`だけをmountする。
- 動的Fake Providerライフサイクル観測（Dynamic Fake Provider Lifecycle Observation）は、同じrunのexact結果正規化、所有containerの回収、ID／name／labelの3軸不存在およびHost cleanupをFake限定で投影する。
- Codex／Claude Code、認証、外部Provider endpointまたは対象Repositoryの変更は実行しない。

### 明示的なDocker Desktop最終復旧

- `doctor --repair-docker-desktop-runtime`はWindows版Docker Desktopの既知破損に対する人間明示の最終復旧手段であり、通常Task、起動時診断、Provider失敗またはRecoveryから自動実行しない。
- Docker Engineの既知停止を二度観測し、固定`dockerInference` socketの既知アクセス不能、署名済みCRDD配布物、選択Local User、native Known Folderと一致するLocal App Data、保護Runtime Stateおよび単一の署名対象Policyに固定したDocker Desktop 4.41.2由来の直接Effect用成果物／Engine 28.1.1がすべて成立した場合だけ処置する。
- CRDDが厳密照合するのは、直接起動・停止・観測する固定executable集合のPath／size／SHA-256／handle IdentityとEngine応答版である。
- 未列挙DLL、resource、loader依存、installation全体または供給経路を完全Attestationせず、人間が真正性を確認した公式Docker配布物と正常なupdaterをLocal Personalの信頼計算基盤（Trusted Computing Base、TCB）に含める。
- 署名済みnative helperは選択User単位のWindows global mutexと成果物の更新排他handleを保持する。
- 公式shutdown後に残るProcessは、同じkernel process handleで実行Pathと作成時刻を照合し、そのhandleだけで停止・終了待機する。
- PIDやProcess名だけを停止Authorityにしない。
- WSLは`docker-desktop`だけをterminateする。

### Local Personalの準備契約

- Local Personal一般Taskでは、selected-user binder、Mount Grant、Provider eligibility、Subscription OAuth preflight、固定Docker CLI Effect executor、限定Egressおよびdurable Recoveryを各操作へ接続する。
- 永続的なRuntime有効化、共有Authority Root、Provisioning記録またはRepository単位のActivation Recordを、利用者が事前に作成する契約は持たない。
- 公開CLIは`task`、`doctor`、`candidate`と機械可読な`capabilities --json`に限定する。`activate`、`disable`、`provision`、`doctor --enable-runtime`および`--runtime-root`は公開構文ではない。
- `capabilities --json`は現在対応するLocal Personal Profileだけを返し、未実装候補や将来構想を利用可能な入口として列挙しない。
- 将来、常設Serverや複数Repository Bindingに永続状態が必要になった場合も、実在するconsumerと利用者成果から新しい責務境界を設計する。
- 未署名の開発branch、manifest欠落、改変checkoutまたは固定Native成果物欠落はEffect前に停止する。公式Release tagへ固定し、同梱manifestと必要なNative成果物を検証できるclone／submoduleは正式配布Rootになり得る。

- 現在のexact schemaでは、CRDD Revision／期待Revisionを単独fieldとして扱わない。
- `crddVersion`、`crddCommit`、`crddTree`および`packageContentRootSha256`の4値をmanifest署名とGate照合へ結び、いずれか一つでも異なる場合は`blocked`とする。
- 旧`crddRevision`は互換aliasを残さず廃止した。

## Runtime 1.0の実行基盤

### 現行Local Personal一般Task境界

#### 対応環境と認証

- Runtime 1.0はWindows上のDocker DesktopとLinux containerだけを正式対象とする。
- WindowsネイティブProvider実行、Git Bash直接実行、通常WSLディストリビューション、別Container RuntimeまたはDockerなしのfallbackを互換性要件にしない。
- Provider CLIを含む固定専用image、最小環境、Provider Home Mount Grantおよび限定EgressはRuntime adapterへ接続済みであり、Host側のCodex／Claude設定またはCredentialを暗黙に再利用しない。
- 未署名の開発branch、manifest欠落、改変checkoutまたは固定Native成果物欠落は署名済みRelease Authorityを欠くためEffect前に停止する。公式Release tagへ固定し、同梱manifestとNative成果物を検証できるclone／submoduleは正式配布Rootになり得る。

- Subscription Offeringはfamily名だけで許可しない。
- 現行PolicyはCodexを`chatgpt_subscription_oauth`、Claudeを`claude_max`へ固定し、公式CLIの読取り専用preflightでCodexの`Logged in using ChatGPT`またはClaudeの`subscriptionType=max`と厳密に照合する。
- 別Offering、API keyまたは判定不能時はProvider request前に停止する。
- これはOfferingの照合であり、exact Account／Tenant identityやProvider Terms本文をRuntimeが検証したという主張ではない。

- CodexのSubscription認証Probeは、公式CLIのexact成功文と、read-only認証Homeで発生する既知のPATH alias警告だけを、`docker start --attach`が実際に搬送したstdout／stderrの閉じた組合せとして判定する。
- 成功語の部分一致、未知行、重複行または制御文字を認証根拠にしない。
- ClaudeのJSON認証契約とは混在させず、一方の成功を他方へ流用しない。

#### 外部送信・入力投影・秘密の拒否

- 現行の一般Task経路は、開始Commitに固定された`.crdd/external-send-policy.json` revision 2をRepositoryからの提案として読み、閉集合の情報分類、選択Local User専用Provider Home Session、Subscription OAuth family、目的、Candidate保存、およびProvider Terms／SettingsをRuntimeが検証できない範囲をPolicy Hashへ結合する。
- Repository内の`decisionAuthority`自己申告だけではAuthorityにならない。
- v0.18.0実装候補は、全Policy Provider境界、Subscription経路、情報分類および目的を端末安全なcanonical JSONで初回表示し、選択ユーザー・保護Runtime State・exact Policy byteへ結合した単一Active同意として保存する。
- 同じ失効していない境界の通常Taskでは対話承認を繰り返さないが、Objective、Acceptance Criteria、書込み／読取り範囲、Provider候補、Revision、Candidate保存条件および派生Review転送fieldは非永続Operation Previewと短命Grantへ毎回結合して検査する。
- 180日失効、Policy境界・選択ユーザー・Runtime State identity／protectionの変更、明示取消、欠落または破損では旧世代を再利用不能にして再承認へ戻し、安全な残存0を確認できなければ手動回復で停止する。
- exact Provider Account／TenantとProvider Terms本文をRuntimeが検証しない境界は維持する。
- このLifecycleは契約試験済みの実装候補であり、Release済み能力を意味しない。
- Policy欠落、`enabled: false`、閉集合外のplaceholder、分類不能、Provider Session／Subscription family不一致、表示不能またはScope差は送信前に停止する。
- Read Projectionによる最小化と送信可能性の判定は別Gateである。

- 一般TaskのPromptはObjective、Acceptance Criteria、Allowed Paths、Readable Pathsおよび型付きRemediation参照だけからRuntimeが構成し、Repository file bytesをPromptへ埋め込まない。
- ソース本文は開始Commitから明示Read Projectionだけを隔離workspaceへ再構成してProviderへ見せるため、Policyが許可する機密ソースも外部送信対象になり得る。
- 一方、Password、秘密鍵、Session Token、API Keyその他のSecret値はPolicyの通常送信範囲に含めない。
- Task scope内の高確度Secret形式はGrant表示前に、Read Projection内の秘密用Pathまたは高確度Secret形式はProvider可視workspaceの書出し前に拒否する。
- 同じ検出primitiveをCandidate Storeにも使う。
- これはbounded heuristicであり、未知のSecret不存在、Provider内部の保持・二次利用またはSubprocessorを検証したという主張ではない。
- SecretをRepositoryとTask本文へ入れない運用、情報分類およびProvider Terms／Account Settingsの確認は引き続き必要である。

#### 候補の保存・期限・破棄

- Candidate本文はPolicyが保存を許可し、唯一の結果配送に必要な保存をProvider Effect前に確認できた場合だけ、1〜168時間のexport可能期限、件数／総容量上限、process間排他および既知Secret pattern拒否付きStoreへstaged保存する。
- Store Rootは選択ローカルユーザーのWindows Known Folder配下の固定`Qual-Lab\CRDD\CandidateStore`であり、fixed volume、non-reparse chain、安定Identity、選択ユーザーowner、および選択ユーザー／SYSTEMだけのprotected DACLをnative helperが処置前後に照合する。
- 既存の不正ACLをRuntimeが自動修復せず停止する。
- production排他は選択ユーザーbindingから導出したWindows kernel objectを使い、owner process終了時にOSが解放するため、時刻だけからstale lock fileを推測削除しない。
- 期限後はexportできず、明示discardまたは次回の安全なRuntime／Candidate入口で物理削除する。
- 常駐serviceやSchedulerをv1へ追加しないため、時刻到達と同時の物理削除は保証しない。
- Operation cleanup成功後だけexport可能なCandidate IDへpublishし、cleanup、rename後再確認、discardまたはpublishが不明な場合はHost、Docker、Candidate、Candidate StoreのRecovery IDを分離して返す。
- 同じCandidate Recovery IDはstaged／publishedのexact 1実体を全体GCと独立してdiscardでき、staged Candidateはexportできない。
- unknown／damaged regular fileは安定Identityへ結合したCandidate Store Recovery IDと明示`recover-store --confirm`だけでexact 1実体を削除し、Path、ageまたは名前だけでは推測削除しない。

#### モデル・推論・選定理由

- モデルと推論レベルはProvider任せにせず、CoordinatorがProvider Effect前にOperationの役割と確認済みの作業特性から選定する。
- 具体化済みで低難度・低リスク・限定影響のLocal Candidate実装は`low`、通常のCoordinator、レビュー、診断または方針整合は役割名だけで高コスト化せず`medium`、`high`は高難度、重大影響、高リスク、または未解決方針と複数コンテキスト整合が重なる場合だけ候補にする。
- Codexの既定選好は`sol`、Claude Codeは`opus`とする。
- ただし固定Codex `0.149.1`では`gpt-5.6`系のmodel metadataがTool利用を`code_mode_only`へ固定し、同Releaseの公式Linux `codex-code-mode-host`が隔離環境で`SIGTRAP`終了することを実測したため、Codexの実Task Profileは互換性を確認した`gpt-5.5`へ固定する。
- これは実行中の自動fallbackではなく、Profile解決時に理由を表示する固定Compatibility Profileである。
- 新しい固定Codex ReleaseでSolの変更・shell検証・構造化結果・cleanupが同じ境界を通った場合だけ再評価する。
- preferred／upperは同じ有効modelのままProfile IDを分け、推論量だけを既存Gateで切り替える。
- Fableは公式CLI上のalias候補であっても、利用可能性、費用特性および適用条件を確認するまで自動選定へ入れない。
- 速度は`normal`だけとし、`xhigh`／`max`、高速モード、任意Provider fallbackおよび実行中の黙示切替は自動選択しない。

- 選定時はProvider、役割、family、推論レベル、速度、選定理由、高コスト選択の有無および再選定条件をCoordinatorのOperation contextへProvider Effect前に表示する。
- 内部推論全文ではなく、人間と独立Reviewerが検証できる判断要約を保持する。
- 選定理由の欠落、閉集合外の分類、Profile不一致、またはRuntime-owned Selection Grant未接続では実行しない。
- 再選定はProvider内fallbackではなくCoordinatorへ戻り、旧選定をsupersedeする新しいGrantとして扱う。

- 作業特性の`workClass`、`planState`、`risk`、`difficulty`および`decisionImpact`はcaller申告である。
- Effect前の選定Eventは、実適格性の証明ではなく、Runtime所有Profileと実装済みCapabilityから作る事前選定候補であり、Provider Home、配布物、Policy、Subscription OAuthの実preflightと、request内でしか分からないquotaを明示的にdeferredと表示する。
- 表示不能なら実行しない。
- 後続preflightが不成立ならTaskは送信または結果公開へ進まず、`runtime_verified`とは表示しない。
- Provider request開始後のquota／失敗はEffect状態が曖昧になり得るため同じOperationで別Providerへ自動再送せず、cleanup後にCoordinatorの新Operationへ戻す。
- 高コスト`high`は明示的な人間Policyが未実装の現版ではcaller申告にかかわらず自動選択しない。

#### 委譲経路と独立した確認者

- 委譲経路選定（Delegation Route Selection）は、まず移譲が必要かを判断する。
- Front Agentだけで安全かつ十分に完了できる場合は`front_codex_only`または`front_claude_only`の`retained`結果を理由付きで返し、Selection Grant、子AgentまたはProvider Effectを発行しない。
- 移譲が必要な場合だけFront ProviderとExecutor Providerを独立軸とし、`Front Codex → Codex`、`Front Codex → Claude Code`、`Front Claude Code → Codex`、`Front Claude Code → Claude Code`の4経路を同じ契約で候補化する。
- 既定はFrontと反対のProviderを選び、Front側Subscription枠を実作業で消費し続けないよう負荷を分散する。
- ただし、検証、診断、方針整合、Architecture／Security review、Gap／Impact Auditおよび結果統合のように説明可能なProvider固有特性がある場合はCodexを優先でき、Front CodexからCodexへの委譲も許可する。
- 例えば具体化済み実装をClaudeへ移譲し、その独立レビューをCodexへ移譲する構成と、Front Codex自身がレビューを完了して子を作らない構成の両方を許可する。
- 役割名だけで高コストmodel／effortへ上げることはない。

- 一般TaskはExecutorとReviewerの実行編成候補（Execution Slate）を同じRuntime-owned Eligibility観測からProvider Effect前に一体評価し、完遂可能なReviewerがなければExternal Send Grant、Candidate Store、workspaceおよびExecutor Effect前に停止する。
- Reviewerは別Providerを優先する。
- 反対Providerが利用不能な場合でも、`low` risk、`limited` decision impact、方向確定済みのローカルCandidateかつ`bounded_implementation`／`bounded_verification`に限り、同一Providerの別Grant、別Task Packet、別Process／Container、Reviewer read-only workspace、session非永続およびExecutor生出力非共有を独立実行Contextとして許可する。
- Architecture／Security／Gap Audit、高リスク、未解決方針またはContext横断では同一Provider Reviewerへfallbackしない。
- 同一Provider Executorは、説明可能な作業特性、ユーザーの明示制約またはRuntime-owned観測で反対Providerの必要Capability、Subscription認証、公式配布物もしくはPolicy不成立を確認した場合だけ候補にする。
- quotaはrequest前に確定できず、適格性が不明なだけでは同一Providerへ推測fallbackしない。
- quota不足から有料APIへ切り替えず、選定後のpreflight／request差はcleanup後にCoordinatorへ戻し、必要なら新しいOperationとSelection Grantで再評価する。
- 外部送信承認は固定Slateが実際に使うProvider集合だけへ限定する。
- 全経路でCoordinator Gate、別実行Context、Provider Home leaseおよび最大深度2を要求し、循環またはProvider同士の直接spawnを拒否する。

#### 利用量と課金の境界

- 一般Taskの標準Profileは既存Subscriptionだけを使用する。
- Provider報告のAPI相当USD値は有限・非負の利用量metadataとして検証するが、実課金額または課金Authorityとは扱わず、`--max-budget-usd`を暗黙適用しない。
- 使用量は説明可能なmodel／effort選定、作業量別turn上限、timeoutおよび出力上限で制御する。
- Claude Codeの推論強度とturn上限は独立させ、検証済みTask PacketからRuntimeが読取りPath数、許可Path数、受入条件数、是正指摘数を導出する。
- 上限の計算と停止条件は[実行Architecture](../06_Architecture/coordinator/01_Architecture.md#task-turn-budget)を参照する。
- 例えば読取り6範囲・変更1範囲・受入条件4件・是正指摘0件のReviewerは、low／medium／highのいずれも最大10 turnsとなる。
- 上限は16であり、見積りが超える場合はタスク分割を求めて停止する。
- 自動的な高推論化、無制限実行または再試行はしない。
- これは使用量の強制や完了保証ではなく、早期完了を妨げない上限であり、Boolean Probeの2 turns・`$0.10`契約とは分離する。
- 明示的な費用上限は将来のopt-in有料API Profileだけの設定であり、標準ProfileのAPI key、有料API fallback、追加購入および自動plan切替は引き続き禁止する。

## 指定経路と復旧検証の受入条件

### 固定Task・指定経路・再試行条件

- 正式署名4経路行列は、実Providerの自由生成差を無制限に再実行しない。
- 固定fixtureはGit checkoutでもLFを維持し、RunnerがTask開始前に基準35 bytesを完全一致で確認する。
- CRLF変換、欠落または読取不能なら外部送信前に停止する。
- Candidate検証差は、生内容ではなくbundle契約fieldまたは公開fixtureのCRLF、終端LF欠落、未置換、その他byte差という固定識別子だけで診断する。
- 同じ経路を再試行できるのは、独立Reviewer不承認またはRunnerによるexact Candidate内容不一致の閉集合理由で停止し、永続Candidateがまだ発行されていないこと、または発行済みCandidateをexactに破棄したことをRuntimeが明示し、全Recovery IDが空、cleanup確認済み、Effect不明なし、正本変更なし、秘密・Host Path・生Provider出力の報告なしを同じ結果で確認できた場合だけである。
- Candidateの終了状態は`not_issued`、`discarded`、`recovery_required`の閉集合で表し、理由文字列やID欠落から推定しない。
- 上限は一経路3回とし、全試行結果を保持する。
- Provider非ゼロ終了、timeout、取消、Recovery曖昧、Candidate終了状態不明または観測不能を自動再試行しない。
- この再試行はRelease Verification Harnessの検証契約であり、通常Taskの失敗を成功へ変更するRuntime fallbackではない。

- このRunnerは公開の合成Taskをprocess内で固定構成する。
- 引数なしは`requested Codex Front → Claude Code Executor → Codex Independent Reviewer`、exact `--route reverse`は`requested Claude Code Front → Codex Executor → Claude Code Independent Reviewer`、exact `--route same-codex`は具体化済み検証というCodex特性により`requested Codex Front → Codex Executor → Claude Code Independent Reviewer`を選ぶ。
- `same-codex`はProvider独立Reviewerを維持し、同一Provider Reviewerを強制しない。
- それ以外の引数、任意Provider名、任意Taskまたは同一Provider強制を受理しない。
- Runnerの引数と結果は要求したFront軸を示すが、caller processが実Codex／Claude Code Frontだったことを観測・証明しない。
- Front実体を含むE2E成立は、該当する公式Frontからこの固定Runnerを起動したrun Evidenceと、Runnerが確認するProvider経路の両方で判定する。
- 変更候補は`40_Develop/coordinator/runtime/general-task-verification.txt`のexact 1件に限定し、期待byteとの完全一致をRuntime Candidate Storeから再確認した後にdiscardする。
- manifest内の署名配布Source Commit A／Tree Aと、manifest一件だけを加えた配布Commit B／Tree Bを、作業対象RepositoryのExecution Commit／Treeから分ける。Runtimeは配布内容をAとBの関係へ結合し、Candidate Revisionを実行前に独立観測した作業対象Revisionへ結合して、実行後も同じRevisionであることを再観測する。CRDD自身を作業対象にする場合だけExecution Revisionが配布Bと一致し得る。親RepositoryがCRDDをsubmoduleとして利用する場合、配布A／Bはsubmodule側、Execution RevisionとCandidate baseは親Repository側であり、両者を同一視しない。全Candidate Identity Hash、経路、独立Review、cleanup、Recovery ID不存在、canonical Repository非変更およびCandidate残存0も成立した場合だけPassを返す。
- TaskがCandidate IDを返した後はPass可否にかかわらずRuntime Candidate Storeのdiscardを試行し、処置不明ならIDを保持して手動回復を要求する。
- 通常の`coordinator task --request-stdin`契約は変更しない。

- `--route same-claude`はClaude特性により`requested Claude Code Front → Claude Code Executor → Codex Independent Reviewer`を選ぶ。
- 同一Executor Provider経路でもProvider独立Reviewerを維持し、同一Provider Reviewerを強制しない。
- 4経路Matrixは既存同意を取り消さない。
- 最初の経路は必要な初回同意または有効な既存同意の再利用を確認し、後続経路と許可された再試行は同じ境界の再利用を要求する。
- 各Runnerのcontract revision、要求経路、Executor／Reviewer、Candidate破棄、全Recovery ID空、秘密・Host Path・生Provider出力の非報告およびcanonical Repository無変更を完全一致で検査する。

### 復旧検証と合成観測の限界

- このRunnerは署名Releaseと配布Rootを先に検証し、固定Fake Workerだけでnonzero exit、timeout、出力上限、不正出力、取消、親Process実消失、およびcleanup観測不明からの手動Recovery相当経路を一括実測する。
- 通常Task Schema、Provider選択、任意command、任意image、任意timeout、任意signalまたは任意scenarioを入力として受理しない。
- 親消失では固定子Processがdurable Recovery IDと実Docker containerの受領を確定した後に親側が子Process treeを終了し、新しいProcessからexact IDの正式Recoveryを実行する。
- cleanup不明では観測を意図的に完了扱いせず、`manualRecoveryRequired`とexact IDを確認してから正式Recoveryを行う。
- どちらも所有Identityが一致する資源だけを回収し、Operation directoryとcontainerの残存0を確認する。
- Provider Home Credential、Provider Network、実Provider Request、API key、有料APIまたは追加購入は使用しない。
- このMatrixはProcess／Recovery境界の本番同等検証であり、実Provider自身を意図的に失敗させる契約ではない。

- 合成Fake観測候補は、callerが与えたtimeout、cancel、stdin／stdout／stderr量、終了状態、process tree／container不存在のclaimおよび結果exact 1件を構造的に評価するだけである。
- 正常形も`candidate`、`observationAuthority:false`、`fakeProviderExecuted:false`、`processAbsenceVerified:false`に固定し、実測、実Codex／Claude Codeの認証、subscription残量、追加費用不要性、Egress、Telemetry、自動更新またはOperation Capabilityを証明しない。
- subscriptionのquota／creditが不足または判定不能な場合は追加購入やAPI fallbackを行わず`blocked`とする。

### 固定版の結果と現在の未完了範囲

- 現在の機械固定では、4経路Runnerが要求入口Profile、実Executor／Reviewer、独立性、初回経路では有効な既存同意の再利用または新規同意、後続3経路では同意の完全一致再利用、Candidate破棄、全Recovery ID空、秘密・Host Path・生Provider出力の非報告およびcanonical Repository無変更を完全一致で検査する。
- 入口Providerの実Process IdentityはRunner単独ではattestせず、要求Profileと実Executor／ReviewerのEvidenceを区別する。
- v0.18.1の現行Runtime実行Identity `e290df01…d9d41`ではfresh clone／submodule一般Task、4経路4/4とRecovery Matrixを完了した。旧候補Identity `f2243b46…f1aaa`と`33cca9b8…2473a`は[未公開候補の署名済み履歴](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md#8-現在状態と残件)として保持し、最終Authority根拠へ流用しない。旧`48515eb`の実Task取消と旧`45ea2ac`の通常CLIによる実務1件は版の違いを保持する。実務有用性は[現時点の評価](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)へ集約済みだが、比較優位は未実証である。
- Runtime全体の監査指摘の是正・再確認と端末追加確認を完了し、人間が候補内容と移行方針を採用した。main統合およびReleaseは未完了であり、[品質の現在状態](../07_Quality/01_Quality_Center.md)で追跡する。

- 4経路実測より前の経緯として、production回復／CLI matrixの実装と旧固定版の独立確認を終え、正式署名一般Task Runnerの対話搬送、実行Identity、Release grammar、複合Recoveryおよび取消境界の機械確認と独立再レビュー／再監査を経て、固定1 Pathの`Codex Front → Claude Code Executor → Codex Independent Reviewer`成功経路を完走した。
- 当時の他経路未確認という状態は、後続の固定版`0c3e6d2`の4経路実測より前の履歴である。
- 現在の未完了事項は[品質の現在状態](../07_Quality/01_Quality_Center.md)を参照する。
- 完了した新配置の正式E2Eを、実Provider取消・是正の未証明範囲、Runtime全体の完成監査、統合およびReleaseの完了へ読み替えない。

- 正式署名Route Matrixは有効な初期同意を強制失効させず、保存済み同意があれば初回経路から再利用し、存在しない場合だけ一度確認する。
- 残る3経路は同じ同意の再利用を要求する。
- Release鍵passphraseは新しい署名Distributionを作るときだけ必要であり、通常Operationごとには要求しない。
- OAuth Sessionが失効した場合の公式再認証は別に必要となる。

<a id="checker-contract"></a>

## Checkerの入力・検査・結果

利用者は人間、保守エージェントまたはCIである。入力は対象Rootと出力・検査範囲のオプションであり、Provider認証、Docker、Release鍵、Coordinatorの有効化を必要としない。通常検査は文書を変更せず、外部URLへ通信しない。

| 入力・結果 | 契約と利用側の判断 |
|---|---|
| `--root` | 検査Rootを明示する。省略時は起動Directoryであり、最寄りGit Rootの自動選択ではない |
| `--scope` | 指定Markdownと直接の参照元・参照先を一段展開する。全体構造等の検査も残るが、全Markdown確認ではない |
| `--json` | 指摘配列を返す。配列が空でも対象全体の品質を保証しない |
| `--json --summary` | 指摘に加え、発見方式、要求・展開範囲、除外・未確認を返す。監査の共通入力ではこの範囲情報も読む |
| `--references <file-or-directory>` | 対象Pathは必須。相対PathはRoot基準で解決し、絶対PathもRoot内の場合だけ受理する。summaryで対象の参照関係を確認するための指定 |
| 正常に報告を構築した場合 | errorがあればexit 1、なければexit 0。warning・未確認があっても0になり得る |
| 未知引数・値欠落 | stderrへ引数エラーを返してexit 2。現行の`--help`も未対応である |
| 読取例外・中断・異常終了 | 完全な報告の取得を保証しない。出力途中や未取得を指摘0・完了へ補正しない |

Root外、symbolic link／junction、Gitlink等の境界を、参照先が存在することだけで確認済みにしない。Gitによる発見とFilesystem fallbackを区別し、fallbackの理由・未確認を保持する。公式の固定歴史参照は専用台帳条件で検査し、一般のリンク切れを許容する例外にしない。

指摘への対応は責務を持つ文書で行い、再検査する。専門的な意味、外部サイトの現存、CRDD準拠の採否は別途確認する。[操作手順](../19_Workflows/02_Checker.md)、[設計と試験対応](../06_Architecture/checker/01_Architecture.md)へ接続する。

<a id="platform-access-contract"></a>

## Windows内部部品の利用契約

platform-accessは独立したエンドユーザーCLIではなく、Coordinatorの用途別Adapterから固定実行物・検証済み要求で利用する内部部品である。通常利用者へnative引数、binary protocol、秘密鍵を操作させない。返された観測候補を、Task実行や外部送信の許可とみなさない。

| 用途 | 許可される処理 | 停止・結果の境界 |
|---|---|---|
| Root／Provider Home観測 | 選択主体、保護、実体をOSから観測 | HomeのCredential本文を返さず、Home作成・ACL修復を暗黙に行わない |
| CandidateStore／RuntimeState初期化 | 専用要求で固定最終Directoryが存在しない場合に限定作成 | 既存物を勝手に修復しない。作成後の失敗をEffectなしへ補正しない |
| Docker Desktop修復補助 | 別modeと許可済みPolicyで対象Process終了・固定起動 | 通常Taskの再試行と分離。helper終了だけでEngine復旧や退避領域の清掃完了としない |
| 準備Supervisor／Worker | 専用準備処理の範囲で隔離Workerを一回起動 | Job終了と一時Registry処置の復元確認を成功条件に含める。通常TaskごとのRegistry変更ではない |

部分・過剰な応答、nonce不一致、未知flag、異常終了、対象の前後不一致は成功候補へ補正しない。観測結果、操作発行、回収、再起動・手動回復を別々に上位へ伝える。公開表示へPath、SID、ACL、Credentialやraw OS errorを戻さない。

Local Personalで接続済みのHome／State観測と、未接続の保護済み有効世代・Hardened候補を区別する。具体的な成果物、protocol、資源所有、TSとRustの責務および試験は[Windows内部部品の設計](../06_Architecture/platform-access/01_Architecture.md)が所有する。

<a id="user-interface-contract"></a>

## 利用者接点の境界

| 操作・結果 | 現行契約と保持条件 | 不明・失敗時 |
|---|---|---|
| Task入力 | `--request-stdin`の構造化入力を対話入力と分離。目的・受入条件・読取り／変更範囲を検査 | 入力不正を実行へ渡さず停止。詳細は下記の公開Task契約 |
| Task結果 | 作業結果、候補、回収、回復ID、Process再起動を別の情報として返す | 人間表示は未取得を未確認とし、否定観測へ補正しない。回収不明・停止・再起動必要なら即時候補操作を案内しない。実端末等の[未確認範囲](../04_UI/01_User_Interface.md#open-issues)は残る |
| 候補の処置 | exact Candidate IDと対象Revision・期限を検証してexport／discard。exportは正本への採用ではない | 期限切れ、Identity差、不明状態で別候補へ置換しない |
| 取消・回復 | 取消要求と終了観測を分離。回復IDは発行元のexact値だけを利用 | IDなしでも不明は不明。Process再起動と資源回復は互いの代替ではない |
| Checker | 配布本体を公式Repositoryの入口から呼び出す。通常`--json`は指摘配列、`--json --summary`は対象・件数・未確認を含む報告。エラーありはexit 1、エラーなしはexit 0 | 警告、未確認、限定範囲、実行不能を0件によって消さない。機械検査は意味上の準拠・専門品質を認定しない |

上表は既存公開契約を利用者操作へ接続した概要であり、Runtime内部のAuthorityや成功条件を変更しない。UIと仕様の対応確認は両工程の完了を代替せず、[検証設計](../07_Quality/03_Verification_Design.md#tool-user-experience-verification)に未確認範囲を残す。
<a id="project-runtime-contract"></a>

## Project Runtime契約

v0.19の公開契約は、人間または許可されたMCP／CLI入口から一つのProjectとMilestoneを受け取り、複数ObjectiveとTask Graphへ計画し、v0.18 Single Task Runtimeを実行単位として使用し、統合済み結果とProject Stateを返すことである。MCPとCLIは同じ意味契約へ到達し、Transport固有入力からAuthority、Project正本または追加のEffect権限を生成しない。

Project RuntimeはTask総数を5件へ制限しないが、同時にRunningとなるTaskを最大5件に制限する。Dependency、共有資源、許可Path、仕様・判断の競合、Lock、Provider利用枠またはIntegration Boundaryが独立実行を許さない場合は5未満を選ぶ。利用可能な枠があっても実行可能性を確認できないTaskを開始しない。

Task失敗時は、現在Planを維持できる、影響部分の再計画が必要、人間判断が必要、の三結果へ分類する。再計画は承認済みMilestone Scope、Authority、費用・回数上限および保持する意図の内側だけで行う。Scope拡張、価値判断、Authority不足、重大Risk受容またはMilestone Acceptanceの変更を自動再計画しない。

個別TaskのCompletedまたはReviewer PassをObjective／Milestoneの成功にしない。全Taskの結果を統合し、仕様、共有判断、共有資源、Artifact、Dependency、残存Conflictおよび受入条件を確認した後だけObjective Acceptance、さらにMilestone Acceptanceを成立させる。統合または確認が不明なら進捗と候補を保持して通常成功を返さない。

Project Stateは、現在のMilestone／Objective、Task総数、Running／Ready／Waiting／Completed、Dependency、Blocker、Risk、Human Decision、Critical Path、Next Action、Integration State、Quality StateおよびCompletion Forecastを取得可能にする。未観測値を0または完了へ補正せず、Work ProgressとQualityを別に表示する。

Project Runtimeへの入力は、Project Identity、Repository BindingとRevision、Milestone目的と受入条件、許可された読取り／変更範囲、Provider送信境界、費用・回数・時間上限、最大同時実行数および再計画上限を明示する。最大同時実行数は1～5の範囲に限定し、省略時の既定値は実装が固定して表示する。MCP／CLI Adapterはこの入力を追加Authorityへ変換しない。

Task状態の`completed`はTask結果と資源回収の確認、Objective／Milestone状態の`accepted`は受入条件と統合の確認を意味する。`failed`、`cancelled`、`cleanup_pending`、`recovery_required`および`superseded`を`completed`へ数えない。`recovery_required`は現在の呼出しが終了してもProject Operationが終端していないため、通常の次Task開始またはMilestone成功を許可しない。

SchedulerはTask開始前に、現在のProject世代、Dependency、Task Authority、変更範囲、共有資源、Conflict reservation、Provider利用条件および実行中枠を再確認する。`starting`、`running`および実行資源が残る`cleanup_pending`を最大5枠へ数え、cleanup不明のTaskを空き枠へ補正しない。開始判断を耐久化する前、または開始直前の再確認に失敗した場合はProvider Effectを発行しない。

Project Runtimeは、Taskごとに一意なattempt IDとSingle Task Operation Identityを保持する。再試行、部分再計画、Parent再開またはMCP request再送で同じTask Effectを二重発行しない。古い世代、別attempt、別Projectまたは別Repository Revisionの結果を現在Taskへ適用しない。

取消は取消要求、Taskへの通知、Task終了、資源回収およびProject State反映を別々に観測する。MCP切断、Parent Process喪失、Promise完了または子Processへのsignal送信だけを取消完了としない。cleanup、Lock解放またはRecoveryが不明なら、取得できたIdentityと未確認事項を保持して通常成功を返さない。

同じRepository Bindingへ対話起点とスケジュール起点のOperationが到着した場合、Runtimeは要求を耐久キューへ記録し、対話起点を既定の優先Laneとする。優先Laneの存在だけで実行中Operationを横取りまたは取消せず、未開始のスケジュールOperationだけを待機させる。各Operationは固定Repository Revisionから隔離Workspaceを作り、正本Worktreeへ直接変更しない。正本への採用はRepository単位で直列化し、採用直前にRevision、dirty state、対象Pathおよび意味競合を再確認する。不一致なら自動上書きせず、承認Scope内の再計画または人間判断へ進める。

耐久キューはRepository-local `.crdd`の機械可読状態として保持し、要求Identity、起点、優先Lane、基準Revision、Scope、状態、所有者世代、lease、attempt、再開条件および結果参照を持つ。MD、Process内配列、時刻だけのstale判定またはLock fileの存在だけを排他根拠にしない。OS排他と所有者観測を組み合わせ、Parent喪失、期限切れ、重複起動または観測不能では新規Effectを止め、既存EffectとRecoveryを照合する。Runtimeを経由しない直接編集は強制排他できないため、Operation開始前と採用前の再確認を必須とする。
