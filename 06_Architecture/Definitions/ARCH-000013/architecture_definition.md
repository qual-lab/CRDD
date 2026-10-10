# 接続主体・Role権限・資格とRepository FederationのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000013`
状態: 更新中（登録解除・鍵受け渡し判断のArchitecture全伝播候補。契約・品質の限定独立レビュー済み・残指摘0。Quality以降未追従）
維持責任者: Qual-Lab

## 1. 責務と境界

Credentialから既存ユーザーを識別し、管理要求は現行Roleの固定管理分担、内容要求はRole内容設定・Repository公開範囲・実アクセスで要求ごとに評価する。ユーザー・Role内容・Repository接続登録／Exposureの管理、資格発行／独立失効／鍵交換、Context集約は別責務とする。CROSはシステム全体の概念であり、認証・認可Packageの名前ではない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Access Management: ユーザー、Role詳細権限、資格・失効・鍵交換の相関、認可用接続／公開情報。Domain Model: 認可済み対象のContext・Portfolio投影 |
| 所有する責務 | 最小ユーザー管理、現行Role認可、Credential Lifecycle、Exposureと実アクセスの別判定、限定鍵交換、認可済みRepository集合の解決とSource-aware Federation |
| 所有しない責務 | 一般IAM、メール・Password・本人確認・自己登録／自己編集・SSO、複数Role、個別追加権限、個人行動監査、Repository内部ACL、Transport／Server Lifecycle、Task取消、認可破損修復 |
| 外部境界 | Remote Client、Host管理入口、既存Credential保存領域、Repository群。秘密値と許可外Identityを公開しない |

同一ProcessのWorkbenchは認可を維持した内部能力呼出し、別Processは同じHostでもMCPを利用する。Local呼出しでも現在Role・操作権限・Exposure・失効・取得可能性を評価する。Domain Modelは認可済みRepository集合を入力にContextを集約し、CredentialやGrantを解釈して権限を決めない。公開操作の呼出し元はAccess Managementの認可を迂回させない。

共有HostはWorkbench／MCP／内部能力／Repository群の配置形態で、第三のCROS REST・Gateway・Shared Server専用Lifecycleは撤去対象を維持する。ただし認可・非開示・Origin／TLS・終了保証を撤去しない。Browser↔Workbench RESTは維持する。

単体／CROSは起動時に明示選択し、設定の存在から自動切替しない。単体は検証済み起動Repository一つで資格不要、CROSは現在許可された集合を扱う。Repository操作の入力形式はそろえ、対象IDをAuthorityへ昇格しない。初回CROS構築時の管理資格発行方式は変更しない。今回の鍵交換を初回設定の再実行へ混ぜない。

## 2. UI観点の入力

| 正式分析 | 引き継ぐ意味 |
|---|---|
| [UI-000008](../../Analysis/UI-000008/architecture_analysis.md) | 自身・対象IDと表示名・現行範囲、通常管理、2操作×2入口、三可視境界、登録解除の両除去表示、元発行再観測／確定後の別明示交換／現在administrator非接続時Hostの導線 |

## 3. SPEC観点の入力

| 正式分析 | 引き継ぐ意味 |
|---|---|
| [SPEC-000012](../../Analysis/SPEC-000012/architecture_analysis.md) | ユーザー資格と現行Roleで認証認可し、独立失効と鍵交換を分け、情報保持・処置前停止・処置後不明・現在再観測を成立させる |

両分析は独立したSibling Contractとして統合する。UI／SPECの意味を本定義で変更しない。UI工程Exit未完了のため、今回は採用済み契約の是正伝播であり通常Handoff・Architecture Readyではない。

## 4. 両観点の統合判断

| 入力 | State Owner | Authority・Effect | Failure・Lifecycle |
|---|---|---|---|
| UI-000008 | 認識・表示の意味はUI、状態の確定はAccess Management等の実Owner | UIはAuthority・Effectを発行しない。通常管理とHost、操作範囲を別軸表示 | 全4組の事前表示、Hostまたは全員交換だけ明示確認、部分結果を隠さない。通常鍵操作はWorkbench、Host CLIは交換2のみ、MCP鍵操作非公開が採用済み。具体表示・案内は未確定 |
| SPEC-000012 | Access Managementのユーザー／Role／資格／認可・鍵交換状態。認可済み集約はDomain Model | 通常鍵3操作は固定administrator、Hostはログイン済みローカル操作者。通常管理は固定8操作の担当Roleでユーザー／Role内容設定／接続登録／Exposureの対象だけを更新し、鍵交換は鍵だけ変更する | 事前条件、旧失効、新発行、結果記録・搬送・受領を分離。発行／記録不明は元Identity再観測、確定後の受け渡し不明は別明示交換、現在administrator非接続は既存Host。登録解除は両除去読戻しを完了条件とし、開始済み取消を証明しない |

| 管理操作 | developer | manager | administrator |
|---|---|---|---|
| ユーザー登録・表示名変更 | 不許可 | 許可 | 許可 |
| developer／managerの割当て・変更 | 不許可 | 許可 | 許可 |
| administratorの付与・解除・降格を含むRole変更 | 不許可 | 不許可 | 許可 |
| developer／managerの詳細権限設定 | 不許可 | 許可 | 許可 |
| administratorの詳細権限設定 | 不許可 | 不許可 | 許可 |
| 鍵の発行・独立失効・交換 | 不許可 | 不許可 | 許可 |
| Repository登録・登録解除 | 不許可 | 許可 | 許可 |
| Repository公開範囲設定 | 不許可 | 許可 | 許可 |

固定管理認可は現行RoleとARCH-000013の8操作分担から判定し、Role内容設定から派生させない。manager／administratorはユーザー登録・表示名変更、developer／managerのRole変更・内容設定、Repository登録・登録解除・Exposureを管理する。administratorの付与・解除・降格・詳細権限と鍵操作はadministrator専用。managerはadministratorの表示名だけ変更可。

## 5. 構造と依存方向

```text
Workbench／MCP／管理入口
  → Access Management（現在認可）
       ├ ユーザー・Role・資格・公開／接続情報の管理
       ├ 許可されたRepository集合の解決
       └ 指定ユーザー交換／全員交換と同じRecoveryへの再入場
  → 認可済みDomain情報
       → Domain Model（Context／Portfolio投影）
       → 公開可能な結果を元入口へ搬送
```

これは論理責務の接続であり、新しいFramework、Server、Registry、LockまたはAPIを追加する指示ではない。認可判断をDomainへ移さず、Transport・AI Profile内容・Task進行をAccess Managementへ集約しない。

## 6. データ・状態・Interface

| 対象 | 関係と所有境界 |
|---|---|
| ユーザー | 安定userId（UUID）・管理用表示専用名・一つのRole。改名／同名はIdentityやAuthorityを変更しない |
| Role詳細権限 | developer／manager／administratorのRoleが内容設定を所有。固定管理分担と別軸で、ユーザー／Credentialへの個別追加権限なし。鍵を含む固定管理分担のON／OFF設定なし |
| 資格／Session | Credential ID→userId。現在認可時に現行Roleを参照し、古い権限を固定しない。Sessionから永続認証Storeを新設しない |
| Exposure／実アクセス | 公開範囲と現在取得可能性を別判定。不明を許可／不存在へ丸めない |
| 鍵交換相関 | 同じRecovery ID、種別・入口・対象・既存発行先・失効確定範囲・発行結果・再入場。非秘密の耐久情報としてProcess喪失後も保持 |
| 状態軸 | 利用5区分と部分成立、資格の有効／期限切れ／失効／不明、回復の確認待ち／進行中／blocked／completed。永続resetting／rotationなし |

- 通常管理の入力: 新規登録は予定Role・表示名（managerはdeveloper／managerのみ）、既存Role変更は対象ID・前後Role（managerは前後ともdeveloper／managerのみ）、名前変更は対象ID・新表示名（ID・Role・Credential保持）、Role内容設定は対象Role・変更内容、Repository管理は対象ID・現在登録／公開状態・変更内容を確認する。新規対象へ既存ID・変更前Roleを要求しない。

manager自身も変更前の現在管理認可→明示的なRole内容設定／Exposure更新→次要求の現行Role・Exposure・実アクセス再評価の順に処置する。更新受理≠内容取得、管理≠内容自動付与、登録≠公開、登録解除≠Repository／Product Data削除を維持する。

既存のユーザー／Host側管理領域と秘密保護境界を維持し、Repositoryへ秘密を移さない。Package改名を理由に保存Rootを変更しない。UUID版・生成方式、表示名構文、Verifier方式、物理Schema・File配置・更新確定方式は詳細設計で既存契約と照合する。新Storeや互換Readerを先取りしない。

登録解除は同じ受理操作・採用改訂で対象登録と対応Exposureを除去し、両読戻し確認で完了する。対象外の登録・ExposureとRepository本体・Product Dataは保持する。片側残存や観測不能を完了とせず、両除去から開始済み処理の取消やEffect 0を推定しない。これは論理更新契約であり、物理的なatomic保存方式の成立を主張しない。

## 7. 失敗・回復・観測

| 操作 | 失効範囲 | 新資格の発行先 |
|---|---|---|
| 指定ユーザー交換 | 対象既存userIdの全旧有効資格 | 同じ既存userId。他ユーザーの鍵は保持 |
| 全員交換 | 全ユーザーの全旧有効資格。操作中管理者自身も含む | 指定した既存administrator userId。他ユーザー再発行・再配布は管理者の通常管理 |
| 独立失効 | 認可された対象資格 | 新発行なし。以後の要求拒否 |

- 通常の鍵操作は現行administrator、Host回復入口はログイン済みローカル操作者を信頼する。Hostは鍵交換2操作だけで、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存ユーザー単位RootとPath検証を維持し、任意Rootや別OSユーザーの状態へ越境しない。全4組で対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、Hostまたは全員交換の3組だけ明示確認する。
- 通常管理は対象・変更前の現在管理認可・操作に必要な状態を安全に確認不能、または認可破損なら新Effect前停止。manager許可の通常管理へadministrator存在条件を追加しない。
- 鍵処置は発行の既存userId、独立失効のCredential-userId結合、交換の対象・必要資格集合・全員交換の指定既存administrator等を操作別に確認し、不明・不成立なら新鍵Effect前停止。Hostへ追加資格認証を要求せず、認可設定を修復しない。
- 鍵交換はuserId・表示名・Role・詳細権限・Repository登録・Product Dataを保持。特別ユーザー、追加権限、回復専用Bootstrapを作らない。
- 発行または非秘密結果記録が不明なら、Credential IDとは別の元発行Identityで既知事実を再観測する。交換由来だけ元exact Recoveryを保持し、通常発行へ交換Recoveryを追加しない。この不明段階から新しい交換を開始しない。
- 発行・記録確定後の配送／受領不明は「発行済み・受け渡し未確認」とし、確定発行を不明へ戻さない。Secret再保存・再表示・自動再発行なし。現在administratorが既存交換を別Operation／Recoveryとして明示選択できる。元処理のIdentity・事実を維持し、各交換内部だけsame exactを維持する。
- 別の指定ユーザー交換は先発行鍵を含む対象の全旧有効資格を失効し同じuserIdへ発行する。全員交換は全旧有効資格を失効し指定既存administratorへ発行する。遅延旧応答で失効鍵を利用可能と案内せず、別交換成功を旧Secret受領・rollback・取消完了としない。現在administrator認証が成立しない場合は既存Host交換入口だけを用い、一般の認可失敗をHostへ迂回させない。
- 再入場では現在状態と現在Authorityを再確認する。保存記録からAuthority、完了、rollback、旧鍵有効、開始済み取消完了を推定しない。
- 生Secretは発行／交換後だけ一度返し、保存・ログ・Evidence・会話へ複製／再表示しない。鍵交換成功・失効はTask取消完了や過去Effect 0を証明しない。

## 8. 品質・保護・未確認事項

三可視境界（自身表示可／非認証User情報0／現在他ユーザー参照を許可されていない主体への他User一覧・存在・件数0）、Repository非開示、管理と内容閲覧の分離、現行Role反映をすべての利用側で維持する。

継承Openは、代表利用者・Qual-Labによる自身表示とID・利用不能理由・接続負担の理解、管理者／Host運用者・Qual-Labによる対象識別・確認負担・採用済みWorkbench／Host CLIの具体表示・案内・有効期限既定値の評価。実利用、Pilot、回復実測または前提変更で再評価する。未確認の定量条件・期限・画面・配布手順を確定せず、上流の意味不足はUI／SPECへ戻す。

### 8.1 UI／SPEC Detailの配置制約

| Detail | Relation | 現在の接続・戻し先 |
|---|---|---|
| [SCR-000008／PRT-000008](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | `PRT-000008.spec-000012` | 対象・事前表示・状態・部分結果・一度表示Secretを配置制約として保持。Layoutと採用済みWorkbench／Host CLIの具体表示・案内はUI Detailへ戻す |
| [BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md) | 同じ既存Relation | Trigger・Authority・Validation・失効／発行・結果・Recoveryを保持。振る舞い変更はSPEC Detailへ戻す |

登録解除・鍵受け渡しの採用判断を入力分析・基本設計・横断モデル・利用側詳細へ伝播した候補であり、今回の契約・品質限定独立レビューは完了・残指摘0。前判断の限定Pass・旧Evidenceを流用しない。Quality・Source・具体保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

## 9. 互換性・移行・成立済み能力

| 基準版の確認範囲 | 新Owner／利用側 | 必要な新確認・移行 |
|---|---|---|
| [旧Remote Project Context MCP](../../../99_Roadmap/Changes/CHG-000082/Evidence/260927-2029_phase4-remote-project-context-mcp.md): Bearer検証、許可範囲だけのPortfolio、単体資格不要、Listener終了 | Access Managementで認可済集合を解決→Domain Model投影→MCP搬送 | 現行Roleとユーザー資格で同じ公開・非開示・終了境界を再検証。旧Workspace集合方式のPassを新版へ流用しない |
| 旧CROS資格管理・Host回復 | Access Managementと承認済み管理入口 | [移管対応表](../../../99_Roadmap/Changes/CHG-000082/source-owner-map.md)で19入力を照合済み。[旧Details](../../Details/cros/01_Architecture.md)は比較資料。新保存・入口・全Consumerの接続と実測は未完了で、対応表から置換済みとしない |
| 最小ユーザー管理・鍵交換2操作 | Access Management→Workbench／MCP等の利用側 | 新Schema・保存移行・本番接続・実境界Evidenceは未実施。現在の旧Sourceから新成立を推定しない |

旧Evidenceは歴史記録として不変。最新構成への移行はフロントAIの手順で扱い、旧互換Readerを追加しない方針を維持する。ただし具体的な保存変更は未確定で、現行秘密Fileの操作をこの設計更新で許可しない。

## 10. 実装と検証への引き渡し

- 認可判定・ユーザー／Role／資格・鍵交換状態のOwnerをAccess Management、認可済みContext集約をDomain Modelへ分け、MCP／Workbenchは同じ認可契約を使う。
- 通常の鍵発行・独立失効・交換は現行administrator専用の固定操作として同一Process Workbenchから呼ぶ。Hostの鍵回復CLIはログイン済みローカル操作者を信頼し、追加認証なしで同じ鍵交換2操作を呼ぶ。MCPにはSecret有無にかかわらず鍵操作のTool・Schema・登録・dispatchを置かない。具体API・入力・受領方式はDetailsで閉じる。
- Qualityへ渡す意味は固定8操作×三Roleの許可／拒否／不明、managerのadministrator名前のみ変更、developer管理拒否≠自身利用拒否、操作別対象、自己範囲変更の時間順、登録≠公開、解除≠削除、通常管理・要求毎認可・同名／改名・2操作×2入口・独立失効・3可視境界・処置前停止・処置後不明・再入場・情報保持・秘密非再表示・取消非証明。Local Item、試験、EvidenceはQualityで対応付ける。
- Task進行・取消・回復はOrchestrator等の既存Ownerに残す。資格の失効／交換で開始済み処理の完了を推定しない。

## 11. 情報源と完了境界

追加の検証義務は、片側除去／観測不能、対象外変更、両除去済み・開始済み終了未観測、元発行IdentityとCredential IDの混同、通常発行への交換Recovery追加、不明段階からの新交換、確定発行の不明化、別交換と元処理の相関混同、遅延失効鍵の利用案内、別交換成功による旧受領・rollback・取消推定である。保存確定・配送観測・保持清掃・公開readは詳細設計の未完了事項として別に閉じる。

意味入力は2・3節の独立分析。Detailと対応レビューは具体制約／対応の照合、CHGは採用・変更履歴、旧Source／Evidenceは成立済み能力の比較に限定する。実装・Quality移管・Architecture Readyの主張は未完了。

## Checklist

- [x] UI／SPECの独立分析を統合し、契約・Authority・Effectを分離した
- [x] 責務・Boundary・Component・依存・データ状態Ownerを明示した
- [x] 2操作×2入口、独立失効と通常管理、Failure・Recovery・観測を接続した
- [x] Security・品質制約・検証意図・Human Input・Openを保持した
- [x] 既存Detail RelationとARCH-IDを維持した
- [x] 旧成立能力の比較と未照合範囲を分け、旧Evidenceを変更していない
- OPEN: Details・横断モデル・Quality・公開入口／Schema／移行・Source・実境界確認は未完了。UI工程Exitと通常Handoff、全体Readyを主張しない。
