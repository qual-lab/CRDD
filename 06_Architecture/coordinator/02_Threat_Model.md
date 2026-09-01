# Coordinator Runtimeの脅威モデル

状態: Stable（v0.18.1）
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

機械試験は独立したArchitecture／Security Review、文書監査、不足／影響監査および準拠監査を代替しない。
