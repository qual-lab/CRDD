# Coordinator Runtimeの脅威モデル

状態: Stable Baseline（v0.18.1）／Project Runtime Candidate（v0.19.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-02

## 1. 目的と境界

本書は、Local Personal ProfileのCoordinator Runtimeが一般Taskを外部AIへ委譲するときに保護する対象、信頼境界、主要脅威、制御および残存Riskを定義する。上位のAuthority原則は[Agent Organization](../../04_Agent_Organization.md)、実行構造は[Coordinator Runtimeの実行アーキテクチャ](01_Architecture.md)、Windows固有境界は[Platform Access](../platform-access/01_Architecture.md)が所有する。

現行RuntimeはOperationごとに必要条件を検証する。永続的な有効化状態、事前準備状態、導入用Supervisor、AppContainer bootstrapまたは互換入口を持たない。過去の探索で作成したこれらの候補は、初回公開の利用契約へ不要と判明したため実装・CLI・配布物から削除する。

## 2. 保護対象

- Canonical Repositoryの内容、Git Identityおよび未関連変更
- 選択ユーザーと専用Provider Home sessionのIdentity
- Provider Credential、Release秘密鍵、Tokenおよびその他の秘密値
- Task Packet、読取り投影、候補Workspaceおよび構造化結果
- 外部送信、Provider起動、候補操作、Docker復旧のAuthority
- Container、network、Mount Grant、Process、Lock、一時領域およびRecovery record
- 署名manifest、Platform Access成果物および配布TreeのIdentity
- 人間の入力、取消、Risk受容、統合およびReleaseの決定権限
- Project／Milestone／Objective／Taskの状態、Operation Queue、世代、Lease、Conflict予約、Integration候補および受入Evidence

## 3. 信頼境界

```text
Human / Local OS User
        ↓ authenticated decision
Coordinator Host Runtime
  ├ Signed distribution verifier
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
| 改変・不一致配布物の実行 | 任意コード、契約すり替え | Ed25519 manifest revision 5、閉じたRuntime依存集合、Security Policy、Runtime実行Identity、単一Platform Access SHA-256のexact照合 | Provider Effect前に拒否 |
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
| Console入力競合・文字化け | 誤承認、停止不能 | runtime-owned reader、入力種別の明示、一回入力、UTF-8機械結果と人間表示の分離 | reader／pipe／child終了 |
| Cost目的の不適格model選択 | 品質低下、利用枠浪費 | 適格性を先に判定し、難易度・Risk・判断影響・Costから説明可能に選択 | Provider Effect前の選定記録 |

### 4.1 v0.19 Project Runtime候補の脅威

次は設計確認で固定する未実装のProject Runtime Candidateに対する設計上のControlであり、v0.18.1の現在能力として主張しない。実装段階ごとに検証へ接続し、該当Controlと終了時観測が成立するまで公開能力へ昇格しない。

| 脅威 | 失敗影響 | 設計上のControl | 実装後に必要な終了時観測 |
|---|---|---|---|
| 古いProject世代・別Task結果の混入 | 状態破損、誤受入、Effect重複 | Project／Task／attempt／Operation／Repository Revisionを結合し、expected generation一致時だけ投影 | 別世代の結果反映0、Evidence保持 |
| Queue／Leaseの二重所有またはstale奪取 | 同じMilestone・Taskの二重実行 | 耐久Queue、OS排他、owner generation、時刻だけに依存しない所有喪失判定 | 同じrequest identityのProject Operationは最大1。同一Task attempt／Operation IdentityのEffect再発行0 |
| 容量・Conflict判定の競合 | 6件目起動、同一資源の並行変更 | 状態世代と同じtransactionでslot／Conflictを予約し、Effect直前に再検証 | 上限外・競合Task Effect 0 |
| Transport・Schedule入力のAuthority化 | 未承認Objective、Scope拡張 | CLI／MCP／Scheduleは検証済み要求の搬送だけを行い、Authority生成を禁止 | Adapter由来Authority 0 |
| 古い・置換済み人間判断の適用 | 誤再計画、別Milestoneの再開、Authority偽装 | decision ID、Project／Milestone、世代、改訂版、選択肢、認証済み人間主体を現在の判断要求へ結合し、accepted decision receiptを専用再開遷移へ要求する。MCP metadataやProvider identityからAuthorityを作らない | stale／superseded／不正入力によるDecision Record・Project変更・Task Effect・Authority生成0 |
| 判断用継続Capabilityの盗難・replay・残存 | 別主体による判断、二重再開、長期Authority残存 | raw値はClientへ一度だけ返し、Runtimeは対象・主体・世代・改訂版・有限期限へ結合したhashと消費状態だけをRepository外のOS管理・Runtime保護Rootへ先に耐久化。Root identity、選択ユーザー、固定Volume、非reparse chain、Owner／Protection、atomic updateをPlatform Adapterで観測する | Repository状態改変・Root保護差・別主体・別decision・期限切れ・replayのEffect 0、無効入力後も正規Capabilityは期限内に一度だけ利用可能、raw値のRepository／Provider／Task Packet／ログ／Record保存0、終端後の失効確認 |
| 判断Capability発行・受理後の部分状態 | 保護Record作成前のraw返却、二重発行、Capabilityだけ消費、MilestoneとQueueの不整合、`prepared`だけの失効、観測不能な保護Rootへの架空遷移、二重Lease、二重Task Effect | Platform Adapterだけが保護Recordを`absent → issued`へ作成・readbackし、その後だけraw値を返す。Root間の原子性を仮定せず、同Adapterが`issued → prepared`へCAS更新・readbackする。Decision／MilestoneをProject Stateへ一括適用・readbackした後だけ`prepared → finalized`へCAS更新・readbackする。Project側だけが不明で保護Rootを更新できる場合は、別の検証済みRecovery Storeへexactな回復意図を先に耐久化してから保護Recordを`recovery_required`へ進める。保護Root自体が不明なら同Rootの遷移を主張せず、別Recovery Storeだけへ回復意図を残す。そこも不明なら手動回復・Effect不明・Process再利用禁止とする。`prepared`の失効はProject旧世代・未適用のfresh確認後だけ、Recoveryは回復意図・保護Root・Project Stateを結合し、matching new世代ならfinalized、verified old/unappliedならinvalidatedへ収束してから回復意図をsettleする。Queueは保護Rootの`finalized`とProject側のID・世代一致をfreshに読取り観測した後に別更新する | 発行保存失敗・応答喪失、`prepared`後、Project適用後、保護Root読取り失敗、CAS応答喪失、readback不明、Recovery Store不明、取消・置換・期限、Process喪失を含む故障・再送で、確認できた状態だけを記録する。架空の保護Root遷移0、不明時Queue／Task Effect 0、Capability、Lease、Task Effectは各最大1回 |
| Capability応答喪失 | 判断不能の長期停止、複数Capabilityの同時有効化 | raw未受領を自動推定せず、同じ主体・Objective requestの明示置換だけを受ける。旧hash失効receipt後に新しい1件を発行し、置換requestを冪等化 | 旧token Effect 0、新token一回成立、二重置換・replay拒否、旧・新同時有効0 |
| 人間判断commentの注入・漏洩 | Prompt injection、Secret漏洩、表示崩れ | bounded UTF-8単一行として検証し、Authority・Scope・選択肢から分離。raw値をProvider、Task Packet、ログ、永続Record、通常結果へ渡さない | comment有無で判断結果不変、拒否時Effect 0、外部送信・永続化・反射0 |
| 個別Task成功のProject成功化 | 未統合成果物の採用、受入誤判定 | Task、Objective、Milestoneを別状態・別世代とし、受入EvidenceとCross-task整合を要求 | Integration前のMilestone受入0 |
| Integration候補の正本混入 | 未承認変更、既存変更の上書き | 隔離Workspace、固定候補hash、Adoption Authority、fresh Revision、短時間Adoption Lock | 採用前の正本Effect 0 |
| 未対応Platformへの暗黙fallback | 保証低下、別OS機構での未観測Effect | Project Runtime CoreをPlatform Contractへ限定し、Adapter不在・保証未成立をFail Closed | Project／Task／Provider Effect 0 |
| Project取消・Parent喪失後の部分残存 | slot誤解放、後続Task起動、Recovery衝突 | 対象Taskごとの終了・cleanup・Project State投影を分離し、unknownをexact Recoveryへ保持 | 全資源照合前のQueue完了0 |

保護更新ごとの回復母集団には、初回作成、prepare、finalize、失効および期限更新のCAS未成立、成立後の応答喪失、readback不明を含める。fresh確認で、exactな`absent`＋raw未返却＋Project未適用はEffect 0で回復意図だけを終端し、`issued`は失効、`prepared`は回復待ち、matching newはfinalized、verified old/unappliedはinvalidated、`expired`＋Project未適用はexpiredのまま安全に終端する。不明・競合では観測できた継続状態を変えず、独立Recovery Intentをrequiredに保持する。

## 5. 署名済み配布物

Runtimeの信頼単位は、Coordinator本体、共通Launcherから到達する署名・4経路・Recovery実行コード、Security Policyおよび`crdd-platform-access.exe`から機械的に算出するRuntime実行Identityである。CRDD Git TreeはRelease Identityと出所を示すが、文書だけの変更でRuntime Authorityを失効させない。Launcherの入口表をIdentity算出のseedとして共用し、選択されたscriptの推移的な静的依存を含める。字句解析はコメントや文字列中の見せかけを依存として扱わず、構文として認識したimportだけを閉包へ加える。実在する`node:`組込みmoduleと閉包内relative target以外のmodule、非literalの動的import、入口表とliteral importの不一致、解析不能なsourceをProvider Effect前に拒否する。選択scriptの子Process／Worker起動APIはnamed importの閉集合と全binding利用を照合し、同じsourceまたは同じ閉包へ結合されたliteral targetと既知の固定終了経路だけを許可する。namespace／default／dynamic import、binding再代入、間接呼出し、可変argvまたは未説明の利用は依存閉包の迂回として拒否する。削除済みSupervisor field、旧revision、別名Path、欠落artifactまたは互換fallbackを受理しない。

Release秘密鍵はRelease署名時だけHuman-only入力として使用し、環境、File、logまたはRuntimeへ保存しない。通常利用者と開発E2Eは秘密鍵を必要とせず、固定済みの署名配布物を検証して使う。Authenticodeは追加Defenseであり、Ed25519 Release Identityを置換しない。

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
- Project Runtimeでは[詳細設計](03_Project_Runtime_Design.md)の状態、資源、Lock、Authority、Effectおよび失敗注入点を、正常・準正常・異常の`PR-*`検証へ接続する。古い世代、重複request、容量競合、Queue owner喪失、Parent喪失、Transport切断、Integration conflict、採用直前Revision差およびPlatform不在を含める。

機械試験は独立したArchitecture／Security Review、文書監査、不足／影響監査および準拠監査を代替しない。
