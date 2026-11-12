# Coordinator Runtimeの脅威モデル

状態: Candidate（通常利用側の旧署名Gateは撤去済み。旧API・実境界検証は未完了）
担当責任者: Qual-Lab
最終更新日: 2026-10-14

## 1. 目的と境界

現在の設計判断は[実行・追跡・正式配布の三分離](01_Architecture.md#9-通常実行追跡正式配布の分離)とする。CRDD独自署名と署名Capabilityを通常Taskの資格にしない。以下の旧署名Manifest・配布Treeによる制御は移管前比較基準として扱い、現在の実行許可へ再利用しない。通常Task・CLI・Workbench助言／候補・Orchestratorの旧資格引数・発行・消費は撤去済みである。旧資格3 API・専用静的検査・任意署名Toolの再接続と実Provider／全体E2Eは未完了である。

本書は、Local Personal ProfileのCoordinator Runtimeが一般Taskを外部AIへ委譲するときに保護する対象、信頼境界、主要脅威、制御および残存Riskを定義する。上位のAuthority原則は[Agent Organization](../../../04_Agent_Organization.md)、実行構造は[Coordinator Runtimeの実行アーキテクチャ](01_Architecture.md)、Windows固有境界は[Platform Access](../platform-access/01_Architecture.md)が所有する。

現行RuntimeはOperationごとに必要条件を検証する。永続的な有効化状態、事前準備状態、導入用Supervisor、AppContainer bootstrapまたは互換入口を持たない。過去の探索で作成したこれらの候補は、初回公開の利用契約へ不要と判明したため実装・CLI・配布物から削除する。

## 2. 保護対象

- Canonical Repositoryの内容、Git Identityおよび未関連変更
- 選択ユーザーと専用Provider Home sessionのIdentity
- Provider Credential、Release秘密鍵、Tokenおよびその他の秘密値
- Task Packet、読取り投影、候補Workspaceおよび構造化結果
- 外部送信、Provider起動、候補操作、Docker復旧のAuthority
- Container、network、Mount Grant、Process、Lock、一時領域およびRecovery record
- 任意正式配布の署名manifest、Platform Access成果物および配布TreeのIdentity
- 人間の入力、取消、Risk受容、統合およびReleaseの決定権限
- Project／Milestone／Objective／Taskの状態、Operation Queue、世代、Lease、Conflict予約、Integration候補および受入Evidence

## 3. 信頼境界

```text
Human / Local OS User
        ↓ authenticated decision
Coordinator Host Runtime
  ├ Selected checkout / required artifact identity inspection
  ├ Repository / Authority controller
  ├ Provider Home / Candidate / Recovery controller
  └ Platform Access
        ↓ bounded capability
Docker / Provider CLI
        ↓ untrusted structured output
Candidate verification / Independent review
        ↓ verified result only
Human
```

Provider出力、Repository内文書、Docker出力および外部入力は、読取り可能であることだけから指示またはAuthorityへ昇格しない。Local UserとOS管理境界はTCBであり、同一Userによる意図的なCredential窃取やKernel侵害への完全耐性は主張しない。

## 4. 主要脅威と制御

| 脅威 | 失敗影響 | 主な制御 | 終了時の確認 |
|---|---|---|---|
| 選択入口・必要Artifactの不一致 | 別実行物、構成取り違え | 選択Checkout／Packageの固定入口、必要Native・CLI・Image・設定のIdentity／Hashと用途限定条件。CRDD署名や巨大な実行閉包を必須にしない | 不一致・観測不能は対象Effect前に拒否 |
| Hash・Commitを真正性やAuthorityと誤認 | 未承認送信、偽Publisher表示 | 同一性、Publisher真正性、現在の用途別実行許可を独立評価。任意配布署名から通常実行Capabilityを発行しない | 署名・HashだけでTaskを許可しない |
| SecretのPrompt・log・環境流出 | Account侵害、外部漏えい | Secret値をTask Packetへ含めない、専用Provider Home、最小環境、出力抑制 | `credentialReported=false`、既知Secret検査 |
| Repository外Pathへの逸脱 | 別Project破壊、情報漏えい | 検証済みworktree root、相対Path閉集合、Mount Grant、reparse／Identity確認 | Canonical Repository未変更、Grant失効 |
| RoleとAuthorityの混同 | 未承認Effect | Authorityを操作別Capabilityに分離し、一回消費・期限・対象を固定 | 未消費Capability失効 |
| Provider同士の直接実行 | Scope・Credential・Cost拡張 | Coordinatorだけが各Provider Processを起動し、出力を次のAuthorityへ直接流用しない | 全子Process不存在 |
| 外部送信の過剰化 | 許可外情報送信 | Repository-local Policy、Provider・目的・情報分類・Subscriptionの固定、最小投影 | 許可境界と実送信先を照合 |
| 候補の取り違え・直接反映 | 誤変更、Canonical破壊 | base Commit、Path、内容Hash、Candidate ID、構造化結果の照合。Reviewerはread-only | 採用前はCanonical未変更 |
| Reviewer自由文の命令化 | Scope拡張、Prompt injection | 閉集合Findingだけ抽出し、同じExecutorへの限定是正Capabilityへ変換 | 元Scope・最大round維持 |
| timeout／取消後の残存 | 後続Effect、資源漏れ | 新Effect停止、Process tree／Container／network／Mount／readerを逆順回収 | cleanupの直接観測 |
| owner loss／観測不能 | orphan、未知Effect | Effect前Recovery record、exact Recovery ID、新ProcessでのIdentity再結合 | read-back後だけ完了化 |
| stale／別Operation Recoveryの誤処置 | 他Task破壊 | Repository・User・package・Operation Identityを結合し、曖昧時は上書きしない | `manualRecoveryRequired`を維持 |
| Docker Desktop破損復旧の過剰処置 | Host状態破壊 | 通常Taskから分離、固定Process／Directory／mutex、最終手段のrenameは事前状態と回復契約を要求 | Engine再観測と残存記録確認 |
| Docker再起動後にcreate応答喪失を未作成と誤認 | 既存資源の見逃し、二重Effect、永久停止 | 現在の回復記録と同じexact Identity、必要なProcess世代切替の実観測、exact名・所有labelの不存在を相関する。旧署名履歴を現在の許可へ流用せず、旧形式はフロントAIの移行確認またはEffect 0で停止 | 空一覧だけ、任意の再起動、署名／Hashだけでは収束させない。過去unknownは保持 |
| Console入力競合・文字化け | 誤承認、停止不能 | runtime-owned reader、入力種別の明示、一回入力、UTF-8機械結果と人間表示の分離 | reader／pipe／child終了 |
| Cost目的の不適格model選択 | 品質低下、利用枠浪費 | 適格性を先に判定し、難易度・Risk・判断影響・Costから説明可能に選択 | Provider Effect前の選定記録 |

### 4.1 v0.19 Orchestratorの脅威

次はv0.19.0 Orchestratorに対する設計上のControlである。実装段階ごとに検証へ接続し、該当Controlと終了時観測が成立した範囲だけを公開能力とする。

| 脅威 | 失敗影響 | 設計上のControl | 実装後に必要な終了時観測 |
|---|---|---|---|
| 古いProject世代・別Task結果の混入 | 状態破損、誤受入、Effect重複 | Project／Task／attempt／Operation／Repository Revisionを結合し、expected generation一致時だけ投影 | 別世代の結果反映0、Evidence保持 |
| Queue／Leaseの二重所有またはstale奪取 | 同じMilestone・Taskの二重実行 | 耐久Queue、OS排他、owner generation、時刻だけに依存しない所有喪失判定 | 同じrequest identityのProject Operationは最大1。同一Task attempt／Operation IdentityのEffect再発行0 |
| 容量・Conflict判定の競合 | 6件目起動、同一資源の並行変更 | 状態世代と同じtransactionでslot／Conflictを予約し、Effect直前に再検証 | 上限外・競合Task Effect 0 |
| Transport・Schedule入力のAuthority化 | 未承認Objective、Scope拡張 | CLI／MCP／Scheduleは検証済み要求の搬送だけを行い、Authority生成を禁止 | Adapter由来Authority 0 |
| 古い・置換済み人間判断の適用 | 誤再計画、別Milestoneの再開、Authority偽装 | decision ID、Project／Milestone、世代、改訂版、選択肢、認証済み人間主体を現在の判断要求へ結合し、accepted decision receiptを専用再開遷移へ要求する。MCP metadataやProvider identityからAuthorityを作らない | stale／superseded／不正入力によるDecision Record・Project変更・Task Effect・Authority生成0 |
| 別主体による判断・同じ回答の再送 | 誤適用、二重再開 | 継続Bearerは廃止する。信頼入口で認証したPrincipalを要求時の回答先へ固定し、回答時にexact一致を確認。対象・世代・Revision・選択肢を同Ownerで検査し、時間経過だけの失効は設けない | 別主体・別対象・世代差・未知選択の適用0。同一回答の再入場はState再保存0、AI自動再送0 |
| 判断保存と履歴確定の部分状態 | 回答喪失、状態とQueueの不整合、重複適用 | 判断・Blocker・対象状態・必要なQueue変更を同じState CASで確定する。履歴失敗でも保存済み回答・適用を保持し、再入場で同じ履歴を出版する。State確定不明を無保存へ変換しない | State旧／新の相関、履歴未確定の表示、再入場で元回答・適用時刻不変、片側更新0 |
| 判断応答喪失 | 二重記録・二重適用 | 同じIDの要求・回答を再観測し、同じ本文だけ保存不要で再送可能とする。別本文への置換や新しい権限発行を行わない | 同一要求／回答はState保存0。別回答・別本文を拒否し、履歴だけ再入場できる |
| 人間判断理由の注入・漏洩 | Prompt injection、秘密混入、表示崩れ | bounded UTF-8単一行として検査し、選択肢・対象・認可から分離する。非空commentは判断理由としてStateと履歴へ保存するが、Provider・Task Packet・診断ログへ転送しない。利用者が秘密を入力しない運用を前提とする | 理由からAuthorityやScopeを拡張しない。現在認可された読取りだけに理由を返し、外部AI送信0 |
| 個別Task成功のProject成功化 | 未統合成果物の採用、受入誤判定 | Task、Objective、Milestoneを別状態・別世代とし、受入EvidenceとCross-task整合を要求 | Integration前のMilestone受入0 |
| Integration候補の正本混入 | 未承認変更、既存変更の上書き | 隔離Workspace、固定候補hash、Adoption Authority、fresh Revision、短時間Adoption Lock | 採用前の正本Effect 0 |
| 未対応Platformへの暗黙fallback | 保証低下、別OS機構での未観測Effect | Orchestrator CoreをPlatform Contractへ限定し、Adapter不在・保証未成立をFail Closed | Project／Task／Provider Effect 0 |
| Project取消・Parent喪失後の部分残存 | slot誤解放、後続Task起動、Recovery衝突 | 対象Taskごとの終了・cleanup・Project State投影を分離し、unknownをexact Recoveryへ保持 | 全資源照合前のQueue完了0 |

回復母集団は要求・回答・後日適用・閉鎖の保存前、CAS確定、応答喪失、履歴出版失敗と再送を含む。回答済み・未適用は理由と元回答を保持し、現在条件での明示applyだけを許可する。閉鎖だけではBlocker・Queueを解消しない。Host独立世代・Hash連鎖・SID／DACL・祖先Handleによる判断保護は維持しない。同じOSユーザーによるStateの意図的改変・巻戻しは新方式の独立防御対象外で、AIへRuntime領域の書換え権限を与えないことと、旧記録の明示切替を運用条件にする。

## 5. 任意の正式配布署名と移管前V6方式の比較基準

以下は旧V6方式を比較するための脅威と検査であり、現在の通常Runtimeの必須Gateではない。任意の正式配布を実施する場合にだけ配布単位で適用を評価する。AST依存閉包、署名Manifest、実行Capabilityの発行・消費と上位Portによる利用側閉包は旧実装の撤去対象であり、新しい通常実行へ移植しない。現在の実行許可・固定入口・必要Artifact同一性・隔離・取消と資源回収は第4節とCoordinator詳細§9の契約に従う。

Coordinator固有署名に続き、2026-10-19に[汎用成果物署名Component](../artifact-signing/01_Architecture.md)も廃止した。旧署名・秘密入力・Manifest配置の脅威は旧方式の比較に限定する。現在は必要Artifact同一性・出所観測・現在認可・隔離を別々に確認し、Hashを配布元真正性とみなさない。

Runtimeの信頼単位は、Coordinator本体、共通Launcherから到達する署名・4経路・Recovery実行コード、到達した兄弟ComponentのNode module解釈を決めるpackage metadata、Security Policyおよび`crdd-platform-access.exe`から機械的に算出するRuntime実行Identityである。CRDD Git TreeはRelease Identityと出所を示すが、文書だけの変更でRuntime Authorityを失効させない。Launcherの入口表をIdentity算出のseedとして共用し、選択されたscriptの推移的な静的依存を含める。字句解析はコメントや文字列中の見せかけを依存として扱わず、構文として認識したimportだけを閉包へ加える。実在する`node:`組込みmoduleと閉包内relative target以外のmodule、非literalの動的import、入口表とliteral importの不一致、解析不能なsourceをProvider Effect前に拒否する。到達した兄弟Componentの`package.json`はexactなpackage名、版、`private: true`および`type: module`を満たし、そのbyteを閉包へ含める。選択scriptの子Process／Worker起動APIはnamed importの閉集合と全binding利用を照合し、同じsourceまたは同じ閉包へ結合されたliteral targetと既知の固定終了経路だけを許可する。namespace／default／dynamic import、binding再代入、間接呼出し、可変argvまたは未説明の利用は依存閉包の迂回として拒否する。削除済みSupervisor field、旧revision、別名Path、欠落artifactまたは互換fallbackを受理しない。

Release秘密鍵は任意の正式配布署名時だけHuman-only入力として使用し、環境、File、logまたはRuntimeへ保存しない。通常利用者と開発E2Eは秘密鍵もCRDD署名済み配布物も必須としない。旧V6のEd25519方式とDocker CLI等のVendor Authenticode検査は別の出所検査であり、後者を署名縮小だけを理由に撤去しない。

署名処理では、秘密入力前のP検査が一回限りの不透明な能力を発行し、その能力を消費したS検査だけが秘密鍵読取りと署名へ到達できる。P検査の省略、別入力への差替え、能力の偽造・再利用、P観測値の署名への流用、S検査後の値再解釈、および署名・配置後の結果field差替えを脅威として扱う。保護経路の反証は単に最終結果が拒否されたことではなく、期待した検査段階と理由が最初の拒否であり、Capability未発行かつEffect 0であることを確認する。

実行能力の利用側は、OrchestratorのExecution Authorization Port、Coordinator Adapter、能力消費、最初のProvider Effect、取消、回復および公開結果までを同じ利用側閉包として検査する。Producerまたは代表利用側だけの更新を完成とせず、Actual利用側集合と独立したExpected集合を完全一致させる。CanonicalなCapability、Path、IdentityまたはStateを利用側で再構成、fallback、混合または別名化しない。

## 6. Provider Homeと外部送信

Provider HomeはOSから選択ユーザーを結合し、Repository-local `.crdd`とは分離した専用sessionとして観測する。親Process環境の全継承を行わず、必要なOS値とRuntime所有値だけを渡す。他ProviderのCredential、Proxyまたは任意PATHを混入させない。

外部送信の初期確認は、送信先Provider、目的、情報分類、Subscription、候補保持、利用者およびPolicy Hashへ結合する。境界が変わらない限りOperationごとの確認を繰り返さない。許可はAPI key課金fallback、追加購入、任意外部ToolまたはRepository外読取りを含まない。

## 7. 取消・回復・Fail Closed

Providerの終了、Promiseの完了または取消要求の受理はcleanup完了を意味しない。成功結果は、Process tree、Container、network、Mount Grant、Console reader、候補一時領域、LockおよびRecovery義務が確認できた場合だけ返す。

確認できない場合は、既知のRecovery ID、`manualRecoveryRequired`、`processRestartRequired`および`effectStateUnknown`を正確に返す。未知状態を推測して消去せず、再起動だけで義務を解消したとみなさない。復旧後も元Taskを自動再実行しない。

## 8. 削除したSurface

次は現行利用者契約へ不要であり、互換性を理由に残さない。

- 永続的なRuntime有効／無効状態
- 事前Platform Provisioning
- 有効化Record、Authority Root、Provisioning CA／証明書Store
- 導入用`coordinator.exe`とAppContainer bootstrap
- 削除済みcommandを常に`blocked`で返す互換shim

必要条件は一般TaskのPreflightで直接検証する。将来、実在する利用者と運用から新しい導入Effectが必要になった場合は、削除した設計を復活させず、新しいChange Intent、Authority、移行、Recoveryおよび利用者結果から設計し直す。

## 9. 残存Riskと主張しないこと

- TCB内の同一Local User、OS管理者、Kernelまたは署名鍵管理者の悪意を完全には防がない。
- Providerの利用規約、保存、二次利用、Account Tenant IdentityをRuntimeだけで完全検証できない。
- 限定EgressはProvider destinationの許可を補強するが、Provider側の内部処理を証明しない。
- Independent ReviewはFinding検出能力を高めるが、欠陥不存在やHuman Authorityを証明しない。
- Docker DesktopのWindows固有破損をRuntimeが常に自動復旧できるとは主張しない。
- Local Personal ProfileはRemote、Multi-project、Organization Runtimeまたは任意外部Tool Authorityを提供しない。

これらは成功表示から隠さず、現在のOperationに影響する場合は停止し、人間の判断へ戻す。

## 10. 検証義務

- manifest改変、旧revision、余分・欠落file、削除済みfieldをProvider Effect前に拒否する。
- Task、Review、Remediationの正常・準正常・異常を公開入口から確認する。
- Secret、Host Path、raw Provider outputおよびCanonical Repository変更が報告・発生しないことを観測する。
- timeout、cancel、Provider失敗、owner loss、cleanup不明、Recovery競合を注入し、終了後資源を確認する。
- 外部送信許可の再利用と失効条件、model fallbackおよび同一Provider例外を検証する。
- 削除したcommand、module、Native成果物およびmanifest fieldがhelp、parser、配布物、文書から再出現しないことを契約試験で固定する。
- Orchestratorでは[現在のアーキテクチャ](../coordinator/03_Task_Architecture.md)と[詳細設計](../coordinator/04_Task_Detailed_Design.md)が示す状態、資源、Lock、Authority、Effectおよび失敗注入点を、[機械可読な設計対応](../../../07_Quality/Registry/coordinator-task-design-traceability.json)によって正常・準正常・異常の`PR-*`検証へ接続する。古い世代、重複request、容量競合、Queue owner喪失、Parent喪失、Transport切断、Integration conflict、採用直前Revision差およびPlatform不在を含める。

機械試験は独立したArchitecture／Security Review、文書監査、不足／影響監査および準拠監査を代替しない。
