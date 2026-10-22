# 接続主体・Role権限・資格とRepository FederationのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000013`
状態: 更新候補（2026-10-12の最小鍵提示契約を伝播。今回差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。旧限定Passは履歴。Source・本番接続は未成立）
維持責任者: Qual-Lab

## 1. 責務と境界

Repository登録の利用者入口はWorkbenchだけとする（2026-10-13人間判断）。manager／administratorの既存管理分担とサーバー上の対象Root検証を維持し、登録だけで公開しない。MCPにはRepository登録のTool・入力Schema・dispatchを置かず、登録解除・公開範囲等の採用済み非鍵操作は維持する。鍵3操作のMCP非公開は別の固定境界として維持する。

Credentialから既存ユーザーを識別し、管理要求は現行Roleの固定管理分担、内容要求はRole内容設定・Repository公開範囲・実アクセスで要求ごとに評価する。ユーザー・Role内容・Repository接続登録／Exposureの管理、資格発行／独立失効／鍵交換、Context集約は別責務とする。CROSはシステム全体の概念であり、認証・認可Packageの名前ではない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Access Management: ユーザー、Role詳細権限、資格・失効・鍵交換の相関、初回管理状態・非秘密試行相関、認可用接続／公開情報。Domain Model: 認可済み対象のContext・Portfolio投影 |
| 所有する責務 | 最小ユーザー管理、現行Role認可、Credential Lifecycle、Exposureと実アクセスの別判定、限定鍵交換、明示初回Host設定、認可済みRepository集合の解決とSource-aware Federation |
| 所有しない責務 | 一般IAM、メール・Password・本人確認・自己登録／自己編集・SSO、複数Role、個別追加権限、個人行動監査、Repository内部ACL、Transport／Server Lifecycle、Task取消、認可破損修復 |
| 主な外部境界 | Remote Client、Host管理入口、既存Credential保存領域、Repository群。秘密値と許可外Identityを公開しない |

WorkbenchとMCPは、同一Hostの専門Package APIへ認可を維持して直接接続する対等な入口である。別Processであることを理由にWorkbenchをMCPへ依存させない。各要求で現在Role・操作権限・Exposure・失効・取得可能性を評価し、Domain Modelは認可済みRepository集合を入力にContextを集約する。CredentialやGrantの解釈をDomainへ持ち込まず、認可を迂回させない。既存の内容領域workspaceId(s)と新設Workspaceは[別の契約](../../Details/coordinator/05_Workspace.md#2-方式識別所有境界)とし、内容閲覧権限から作業操作の許可を推定しない。

共有HostはWorkbench／MCP／内部能力／Repository群の配置形態で、第三のCROS REST・Gateway・Shared Server専用Lifecycleは撤去対象を維持する。ただし認可・非開示・Origin／TLS・終了保証を撤去しない。Browser↔Workbench RESTは維持する。

単体／CROSは起動時に明示選択し、設定の存在から自動切替しない。単体は検証済み起動Repository一つで資格不要、CROSは現在許可された集合を扱う。Repository操作の入力形式はそろえ、対象IDをAuthorityへ昇格しない。初回CROS設定はログイン済みHost操作者の明示操作で、管理用表示名を入力し、最初のadministrator UUIDを作成して同userIdの鍵をHost端末へ一度提示する。通常Host回復2操作とは別で、既存状態・鍵喪失を再初期化しない。MCP／Remote Workbench／Server自動起動へ初期化能力を公開せず、追加認証・OS昇格を設けない。単体利用の前提にしない。

## 2. UI観点の入力

| 正式分析 | 引き継ぐ意味 |
|---|---|
| [UI-000008](../../Analysis/UI-000008/architecture_analysis.md) | 自身・対象IDと表示名・現行範囲、通常管理、2操作×2入口、三可視境界、登録解除の両除去表示、元発行再観測／確定後の別明示交換／現在administrator非接続時Hostの導線、初回4状態と個別結果・通常管理への移行 |

## 3. SPEC観点の入力

| 正式分析 | 引き継ぐ意味 |
|---|---|
| [SPEC-000012](../../Analysis/SPEC-000012/architecture_analysis.md) | ユーザー資格と現行Roleで認証認可し、独立失効と鍵交換を分け、情報保持・処置前停止・処置後不明・現在再観測と初回Host設定の開始・中断・成立条件を成立させる |

両分析は独立したSibling Contractとして統合する。UI／SPECの意味を本定義で変更しない。UI工程Exit未完了のため、今回は採用済み契約の是正伝播であり通常Handoff・Architecture Readyではない。

## 4. 両観点の統合判断

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000008 | 認識・表示 | 認識・表示の意味はUI、状態の確定はAccess Management等の実Owner | UIはAuthorityを発行しない | 通常管理とHost、操作範囲を別軸表示し、UI自身はEffectを発行しない | 全4組の事前表示、Hostまたは全員交換だけ明示確認し、部分結果を隠さない | 通常鍵操作はWorkbench、通常Host回復CLIは交換2のみ、MCP鍵操作非公開を維持する。初回の4状態・個別結果・通常管理への導線を保持し、具体表示・案内は未確定 |
| SPEC-000012 | 状態・振る舞い | Access Managementのユーザー／Role／資格／認可・鍵交換状態。認可済み集約はDomain Model | 通常鍵3操作は固定administrator、Hostはログイン済みローカル操作者 | 通常管理は9 Role分担行の担当Roleで対象だけを更新し、鍵交換は鍵だけ変更する | 事前条件、旧失効、新発行、結果記録・提示結果を分離し、発行／記録不明は元Identityで再観測する | 確定後の受け渡し不明は別明示交換、現在administrator非接続は既存Host。登録解除は両除去読戻し、初回は元試行相関確定後に生成し、同鍵限定接続・確認保存／読戻し・短命清掃・Lock終了を確認するまで完了しない |

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
| 共有AI Profileの一覧・登録・変更・確認付き削除 | 不許可 | 許可 | 許可 |

Profile管理可否は要求ごとに現在資格・初回完了・Roleから判定し、許可／拒否／観測不能を分ける。内容・Schema・StoreとProfile限定操作は[ARCH-000010](../ARCH-000010/architecture_definition.md)に保持し、AMへ集約しない。別OwnerのAM管理改訂とCatalog改訂を同一視せず、AM LockをCatalog操作中まで保持しない。認可時点以後のRole変更は次操作から反映し、Provider・鍵・Repository内容の権限をProfile許可から派生しない。

固定管理認可は現行RoleとARCH-000013の9 Role分担行から判定し、Role内容設定から派生させない。manager／administratorはユーザー登録・表示名変更、developer／managerのRole変更・内容設定、Repository登録・登録解除・Exposureを管理する。administratorの付与・解除・降格・詳細権限と鍵操作はadministrator専用。managerはadministratorの表示名だけ変更可。

## 5. 構造と依存方向

```text
Workbench／MCP／管理入口
  → Access Management（現在認可）
       ├ ユーザー・Role・資格・公開／接続情報の管理
       ├ Host明示初回設定（管理状態・元試行→最初のユーザー・資格）
       ├ 許可されたRepository集合の解決
       └ 指定ユーザー交換／全員交換と同じRecoveryへの再入場
  → 認可済みDomain情報
       → Domain Model（Context／Portfolio投影）
       → 公開可能な結果を元入口へ搬送
```

これは論理責務の接続であり、新しいFramework、Server、Registry、LockまたはAPIを追加する指示ではない。認可判断をDomainへ移さず、Transport・AI Profile内容・Task進行をAccess Managementへ集約しない。

## 6. データ・状態・Interface

Access Managementは期限なしの資格照合と要求毎の現在認可を分離する。時間経過による失効・交換を担当するTimerや更新Workerは設けない。明示失効・交換、現在権限の変更、形式不正・観測不能の拒否を保持する。旧失効資格の復活や旧CROS保存形式の移行完了は、この設計判断から推定しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000008 | UIは認識・表示、Access Management等の実Ownerは確定状態 | UI表示は認証・認可Authorityではない | UIは永続状態を更新せず、許可された操作結果だけを表示する |
| SPEC-000012 | Access Managementはユーザー・Role・資格・交換、Domain Modelは認可済み投影 | 現行Roleの固定管理分担または信頼済みHost入口 | 操作別の対象だけを更新し、認可不能・観測不能では新Effectを発行しない |

| 対象 | 関係と所有境界 |
|---|---|
| ユーザー | 安定userId（UUID）・管理用表示専用名・一つのRole。改名／同名はIdentityやAuthorityを変更しない |
| Role詳細権限 | developer／manager／administratorのRoleが内容設定を所有。固定管理分担と別軸で、ユーザー／Credentialへの個別追加権限なし。鍵を含む固定管理分担のON／OFF設定なし |
| 資格／Session | Credential ID→userId。現在認可時に現行Roleを参照し、古い権限を固定しない。Sessionから永続認証Storeを新設しない |
| Exposure／実アクセス | 公開範囲と現在取得可能性を別判定。不明を許可／不存在へ丸めない |
| 鍵交換相関 | 同じRecovery ID、種別・入口・対象・既存発行先・失効確定範囲・発行結果・再入場。非秘密の耐久情報としてProcess喪失後も保持 |
| 初回設定 | 双方未初期化、確認済み途中、既存、観測不能を区別。ユーザー成立前の状態・非秘密元試行相関はAMが所有し、成立後にUUID／資格へ結ぶ。試行参照は非Authorityで、交換Recovery・Lock回復・Credential IDへ転用しない |
| 状態軸 | 利用5区分と部分成立、資格の有効／失効／不明、回復の確認待ち／進行中／blocked／completed。永続resetting／rotationなし |

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

- 通常の鍵操作は現行administrator、Host回復入口はログイン済みローカル操作者を信頼する。通常Host回復は鍵交換2操作だけで、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存ユーザー単位RootとPath検証を維持し、任意Rootや別OSユーザーの状態へ越境しない。全4組で対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、Hostまたは全員交換の3組だけ明示確認する。
- 通常管理は対象・変更前の現在管理認可・操作に必要な状態を安全に確認不能、または認可破損なら新Effect前停止。manager許可の通常管理へadministrator存在条件を追加しない。
- 鍵処置は発行の既存userId、独立失効のCredential-userId結合、交換の対象・必要資格集合・全員交換の指定既存administrator等を操作別に確認し、不明・不成立なら新鍵Effect前停止。Hostへ追加資格認証を要求せず、認可設定を修復しない。
- 鍵交換はuserId・表示名・Role・詳細権限・Repository登録・Product Dataを保持。特別ユーザー、追加権限、回復専用Bootstrapを作らない。
- 発行または非秘密結果記録が不明なら、Credential IDとは別の元発行Identityで既知事実を再観測する。交換由来だけ元exact Recoveryを保持し、通常発行へ交換Recoveryを追加しない。この不明段階から新しい交換を開始しない。
- 発行・記録確定後の提示・引渡し（初回は同鍵接続確認）不明は「発行済み・受け渡し未確認」とし、確定発行を不明へ戻さない。Secret再保存・再表示・自動再発行なし。現在administratorが既存交換を別Operation／Recoveryとして明示選択できる。元処理のIdentity・事実を維持し、各交換内部だけsame exactを維持する。
- 別の指定ユーザー交換は先発行鍵を含む対象の全旧有効資格を失効し同じuserIdへ発行する。全員交換は全旧有効資格を失効し指定既存administratorへ発行する。遅延旧応答で失効鍵を利用可能と案内せず、別交換成功を旧Secret受領・rollback・取消完了としない。現在administrator認証が成立しない場合は既存Host交換入口だけを用い、一般の認可失敗をHostへ迂回させない。
- 再入場では現在状態と現在Authorityを再確認する。保存記録からAuthority、完了、rollback、旧鍵有効、開始済み取消完了を推定しない。
- 生Secretは通常の操作administratorのWorkbench画面、Host交換・初回設定のHost端末へ用途限定・短命に搬送して一度提示する。一般MCP／DTO・一覧・ログ・Evidence・会話へ公開・保存・再表示しない。通常の提示は対象本人の製品外引渡し・受領を証明せず、追加受領操作や記録を作らない。鍵交換成功・失効はTask取消完了や過去Effect 0を証明しない。

### 7.1 初回Host設定

既存Root／Pathの検証下で管理状態と進行中初期化記録の双方未初期化を確認し、Host明示開始を受け付ける。単一File不在、Root作成、別Root、読取不能、破損、Lock使用中、未解決回復を未初期化証明にしない。確認済み元試行相関を非秘密で耐久確定してからUUID作成・資格発行へ進む。具体確定方法・Root準備は未完了である。

状態遷移と処理順は[AM詳細§4.1](../../Details/access-management/01_Architecture.md#41-初回host設定のstateとsequence)で具体化する。Host一度提示→exact同鍵の初回確認用限定接続成功→確認の保存・読戻し・短命材料清掃とLock終了→初回completed・通常Authorityの順とする。限定接続中は通常管理・内容Authorityを発行せず、いずれか未確認・失敗・観測不能なら完了表示と通常Authorityは0。KDF一致・callback完了・通信到達だけで接続成功にしない。発行／記録不明は元試行再観測、両確定後の提示または接続確認だけ不明は既存Host指定交換を別明示操作とする。別UUID・自動再発行・再初期化・Secret保存／再表示0。初回試行を交換Recoveryへ統合しない。

Host交換後は、同じ初回試行・作成ユーザーの確認対象を、直近に一度提示した新しい有効資格へ結び直す必要がある。旧資格・元発行の既知事実は保持し、新交換成功を旧Secret受領の証明にしない。具体Binding・接続Owner・Protocol・保存Schemaは詳細設計で確定する。現Sourceの通常認証や初回資格Bindingをそのまま初回確認へ流用しない。

Repository登録・Exposure・内容権限の自動付与とProduct Data変更は0。表示名は識別補助でAuthorityではない。通常管理9分担とHost回復2操作は維持し、管理者不存在・認可破損を初期化で修復しない。

## 8. 品質・保護・運用

非認証Remote情報0と、信頼されたHost操作者への初回結果表示を混同しない。

三可視境界（自身表示可／非認証User情報0／現在他ユーザー参照を許可されていない主体への他User一覧・存在・件数0）、Repository非開示、管理と内容閲覧の分離、現行Role反映をすべての利用側で維持する。

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000008 | 非認証・非許可主体へのIdentity開示、秘密再表示、部分結果の全体完了化 | 三可視境界、対象・影響の事前表示、一度提示、失敗・不明・再入場表示を反証する |
| SPEC-000012 | 古いRole固定、登録と公開の混同、失効・発行・提示・初回確認・取消の混同 | 現在認可、操作別Effect、両除去読戻し、exact Recovery、初回4段階と通常Authority非発行を反証する |

継承Openは、代表利用者・Qual-Labによる自身表示とID・利用不能理由・接続負担の理解、管理者／Host運用者・Qual-Labによる対象識別・確認負担・採用済みWorkbench／Host CLIの具体表示・案内の評価。実利用、Pilot、回復実測または前提変更で再評価する。未確認の定量条件・画面・配布手順を確定せず、上流の意味不足はUI／SPECへ戻す。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000008 | 自身表示とID、利用不能理由、接続負担、対象識別と具体表示・案内の理解 | 代表利用者、管理者／Host運用者、Qual-Lab | OPEN。未確認の定量条件・画面・配布手順は確定しない | 実利用、Pilot、回復実測、表示・案内の固定候補 |
| SPEC-000012 | 初回限定接続の具体Owner／Protocol、保存Schema、旧状態移行、本番Consumer | Qual-Lab、人間の決定権限者 | OPEN。論理契約だけを保持し実装成立へ引き上げない | 詳細設計、Source接続、移行設計、本番実境界確認 |

Architecture固有の追加人間判断はない。入力の意味不足または競合はUI／SPECへ戻し、詳細設計・Source・旧Evidenceから補完しない。

### 8.1 UI／SPEC Detailの配置制約

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000008／PRT-000008](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | UI-000008 | 対象・事前表示・状態・部分結果・一度表示Secret、初回入力・4状態・通常管理への導線 | Source UIとの直接Relation | Covered | Layoutと採用済みWorkbench／Host CLIの具体表示・案内はUI Detailへ戻す |
| [BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md) | SPEC-000012 | Trigger・Authority・Validation・失効／発行・結果・Recovery、初回開始・途中・提示・引渡し（初回は同鍵接続確認）不明の分岐 | Source SPECとの直接Relation | Covered | 振る舞い変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000008.spec-000012`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

登録解除・鍵受け渡し・旧初回設定の限定レビューは当時の固定版だけに適用する。今回の最小提示方式を反映した基本設計・詳細・横断・Surface候補は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。Quality・Source・具体保存・本番接続は未完了であり、旧Pass・旧Evidenceを流用しない。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| Remote Project ContextのBearer検証、許可範囲だけのPortfolio、単体資格不要、Listener終了 | [旧Evidence](../../../99_Roadmap/Changes/CHG-000082/Evidence/260927-2029_phase4-remote-project-context-mcp.md) | Access Managementで認可済集合を解決し、Domain Model投影をMCPへ搬送 | 旧Evidenceは履歴として保持 | 旧Remote Project Context MCPの固定Evidence | 現行Roleとユーザー資格で公開・非開示・終了境界を再検証し、旧Workspace集合方式のPassを流用しない |
| 旧CROS資格管理・Host回復 | [現在の処置](../../../99_Roadmap/Changes/CHG-000082/source-owner-map.md#現在の撤去処置--2026-10-14) | Access Managementと承認済み管理入口 | 旧Package撤去済み。旧Detailsは履歴比較のみ | [現行AM設計](../../Details/access-management/01_Architecture.md) | MCP／Workbenchの新契約、正式191項目、全体検証は未完了 |
| 最小ユーザー管理・鍵交換2操作 | 現行AM設計と既存局所Source／試験 | Access ManagementからWorkbench等の利用側 | 論理契約と局所接続を保持 | 現行Detailsと局所検証記録 | 新Schema、保存移行、本番接続、実境界Evidenceは未完了。現在の旧Sourceから成立を推定しない |

旧Evidenceは歴史記録として不変。最新構成への移行はフロントAIの手順で扱い、旧互換Readerを追加しない方針を維持する。ただし具体的な保存変更は未確定で、現行秘密Fileの操作をこの設計更新で許可しない。

## 10. 実装と検証への引き渡し

- 認可判定・ユーザー／Role／資格・鍵交換状態のOwnerをAccess Management、認可済みContext集約をDomain Modelへ分け、MCP／Workbenchは同じ認可契約を使う。
- 通常の鍵発行・独立失効・交換は現行administrator専用の固定操作として同一Process Workbenchから呼ぶ。Hostの鍵回復CLIはログイン済みローカル操作者を信頼し、追加認証なしで同じ鍵交換2操作を呼ぶ。MCPにはSecret有無にかかわらず鍵操作のTool・Schema・登録・dispatchを置かない。具体API・入力・提示方式・初回限定接続確認方式はDetailsで閉じる。
- 初回設定はAMの別明示操作として双方未初期化確認、元試行相関の耐久確定、個別事実と4状態、3つの失敗経路を実装へ渡す。限定接続の成功と確認保存・読戻し・短命材料清掃・Lock終了を別に反証し、未確認・失敗・観測不能からcompletedや通常Authorityを生成しない。具体内部操作はAM詳細、Surface案内は各Surfaceへ引き渡す。
- Qualityへ渡す意味は9 Role分担行×三Roleの許可／拒否／不明、managerのadministrator名前のみ変更、developer管理拒否≠自身利用拒否、操作別対象、自己範囲変更の時間順、登録≠公開、解除≠削除、通常管理・要求毎認可・同名／改名・2操作×2入口・独立失効・3可視境界・処置前停止・処置後不明・再入場・情報保持・秘密非再表示・取消非証明。初回の相関確定前Effect0、二重作成0、Secret非保存・再表示0、登録・公開・内容自動付与0、個別事実≠全体完了、元試行と別交換の非混同も含む。Local Item、試験、EvidenceはQualityで対応付ける。
- Task進行・取消・回復はOrchestrator等の既存Ownerに残す。資格の失効／交換で開始済み処理の完了を推定しない。

## 11. 情報源と現行照合

追加の検証義務は、片側除去／観測不能、対象外変更、両除去済み・開始済み終了未観測、元発行IdentityとCredential IDの混同、通常発行への交換Recovery追加、不明段階からの新交換、確定発行の不明化、別交換と元処理の相関混同、遅延失効鍵の利用案内、別交換成功による旧受領・rollback・取消推定である。保存確定・提示結果観測・保持清掃・公開readは詳細設計の未完了事項として別に閉じる。

意味入力は2・3節の独立分析。Detailと対応レビューは具体制約／対応の照合、CHGは採用・変更履歴、旧Source／Evidenceは成立済み能力の比較に限定する。実装・Quality移管・Architecture Readyの主張は未完了。

AM初回詳細は候補反映済みである。横断モデル・Workbench／MCP詳細・Quality・公開入口／Schema／移行・Source・実境界確認は未完了で、UI工程Exitと通常Handoff、全体Readyを主張しない。

## Checklist

- [x] UI分析とSPEC分析だけを正式入力として統合した
- [x] UI ContractとSPEC Contractを入力別に保持した
- [x] 独立したArchitecture Responsibilityを説明できる
- [x] 所有する責務、所有しない責務およびBoundaryを明示した
- [x] Major Component、Interfaceおよび依存方向を明示した
- [x] Data／State Ownershipを明示した
- [x] Authority、EffectおよびLifecycleを入力別に評価した
- [x] Failure Boundary、Recovery責任および観測を明示した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
