# 接続主体・Role権限・資格とRepository FederationのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000013`
状態: 更新中（最新鍵管理判断のArchitecture分析・定義直接同期を限定独立レビュー済み・残指摘0。横断モデル以降未完了）
維持責任者: Qual-Lab

## 1. 責務と境界

Credentialから既存ユーザーを識別し、現行Role詳細権限、Repository公開範囲と実アクセスを要求ごとに評価する。最小ユーザー管理、資格発行／独立失効／鍵交換、Context集約は別責務とする。CROSはシステム全体の概念であり、認証・認可Packageの名前ではない。

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
| [UI-000008](../../Analysis/UI-000008/architecture_analysis.md) | 自身・対象IDと表示名・現行範囲、通常管理、2操作×2入口、三可視境界、既知失効／発行不明と同じRecoveryへの導線 |

## 3. SPEC観点の入力

| 正式分析 | 引き継ぐ意味 |
|---|---|
| [SPEC-000012](../../Analysis/SPEC-000012/architecture_analysis.md) | ユーザー資格と現行Roleで認証認可し、独立失効と鍵交換を分け、情報保持・処置前停止・処置後不明・現在再観測を成立させる |

両分析は独立したSibling Contractとして統合する。UI／SPECの意味を本定義で変更しない。UI工程Exit未完了のため、今回は採用済み契約の是正伝播であり通常Handoff・Architecture Readyではない。

## 4. 両観点の統合判断

| 入力 | State Owner | Authority・Effect | Failure・Lifecycle |
|---|---|---|---|
| UI-000008 | 認識・表示の意味はUI、状態の確定はAccess Management等の実Owner | UIはAuthority・Effectを発行しない。通常管理とHost、操作範囲を別軸表示 | 全4組の事前表示、Hostまたは全員交換だけ明示確認、部分結果を隠さない。通常鍵操作はWorkbench、Host CLIは交換2のみ、MCP鍵操作非公開が採用済み。具体表示・案内は未確定 |
| SPEC-000012 | Access Managementのユーザー／Role／資格／認可・鍵交換状態。認可済み集約はDomain Model | 通常鍵3操作は固定administrator、Hostはログイン済みローカル操作者。他4管理群の担当Role・設定可否はOPEN。通常管理はユーザー／Role設定を更新し得るが、鍵交換は鍵だけ変更する | 事前条件、旧失効、新発行、結果確定・受領を分離。失効後失敗／応答・Process喪失は同じRecoveryへ既知失効と発行不明を耐久保持 |

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
| ユーザー | 安定userId（UUID）・管理者設定の表示専用名・一つのRole。改名／同名はIdentityやAuthorityを変更しない |
| Role詳細権限 | developer／manager／administratorのRoleが所有。ユーザー／Credentialへの個別追加権限なし。鍵発行・独立失効・交換は現行administrator専用固定で、ON／OFF設定へ含めない |
| 資格／Session | Credential ID→userId。現在認可時に現行Roleを参照し、古い権限を固定しない。Sessionから永続認証Storeを新設しない |
| Exposure／実アクセス | 公開範囲と現在取得可能性を別判定。不明を許可／不存在へ丸めない |
| 鍵交換相関 | 同じRecovery ID、種別・入口・対象・既存発行先・失効確定範囲・発行結果・再入場。非秘密の耐久情報としてProcess喪失後も保持 |
| 状態軸 | 利用5区分と部分成立、資格の有効／期限切れ／失効／不明、回復の確認待ち／進行中／blocked／completed。永続resetting／rotationなし |

既存のユーザー／Host側管理領域と秘密保護境界を維持し、Repositoryへ秘密を移さない。Package改名を理由に保存Rootを変更しない。UUID版・生成方式、表示名構文、Verifier方式、物理Schema・File配置・更新確定方式は詳細設計で既存契約と照合する。新Storeや互換Readerを先取りしない。

## 7. 失敗・回復・観測

| 操作 | 失効範囲 | 新資格の発行先 |
|---|---|---|
| 指定ユーザー交換 | 対象既存userIdの全旧有効資格 | 同じ既存userId。他ユーザーの鍵は保持 |
| 全員交換 | 全ユーザーの全旧有効資格。操作中管理者自身も含む | 指定した既存administrator userId。他ユーザー再発行・再配布は管理者の通常管理 |
| 独立失効 | 認可された対象資格 | 新発行なし。以後の要求拒否 |

- 通常の鍵操作は現行administrator、Host回復入口はログイン済みローカル操作者を信頼する。Hostは鍵交換2操作だけで、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存ユーザー単位RootとPath検証を維持し、任意Rootや別OSユーザーの状態へ越境しない。全4組で対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、Hostまたは全員交換の3組だけ明示確認する。
- 対象不明・必要な管理者不存在・必要状態の安全な観測不能・認可破損は新Effect前停止。認可設定を修復しない。
- 鍵交換はuserId・表示名・Role・詳細権限・Repository登録・Product Dataを保持。特別ユーザー、追加権限、回復専用Bootstrapを作らない。
- 失効後の発行失敗・応答／Process喪失では、既知失効と発行不明を別の事実として同じRecoveryへ保持する。別Recoveryを重ねない。
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

03〜06、07詳細領域Map、UI／SPEC Detailへの前判断の伝播・限定レビューは履歴であり、最新の鍵管理判断へ流用しない。[Access Management詳細](../../Details/access-management/01_Architecture.md)は前固定版で最新判断の限定反映・限定独立レビュー済み・残指摘0。今回のArchitecture分析と本定義の直接同期は限定独立レビュー済み・残指摘0。03境界モデルと01／02の案内は最新判断へ限定再伝播・限定独立レビュー済み・残指摘0。04〜08横断モデル、Domain集約・MCP／Workbenchの新契約Details、Quality・Sourceは再伝播未完了。保存・公開入口はOPENで、旧配置を新Ownerの完成形として扱わない。

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
- Qualityへ渡す意味は通常管理・要求毎認可・同名／改名・2操作×2入口・独立失効・3可視境界・処置前停止・処置後不明・再入場・情報保持・秘密非再表示・取消非証明。Local Item、試験、EvidenceはQualityで対応付ける。
- Task進行・取消・回復はOrchestrator等の既存Ownerに残す。資格の失効／交換で開始済み処理の完了を推定しない。

## 11. 情報源と完了境界

意味入力は2・3節の独立分析。Detailと対応レビューは具体制約／対応の照合、CHGは採用・変更履歴、旧Source／Evidenceは成立済み能力の比較に限定する。実装・Quality移管・Architecture Readyの主張は未完了。

## Checklist

- [x] UI／SPECの独立分析を統合し、契約・Authority・Effectを分離した
- [x] 責務・Boundary・Component・依存・データ状態Ownerを明示した
- [x] 2操作×2入口、独立失効と通常管理、Failure・Recovery・観測を接続した
- [x] Security・品質制約・検証意図・Human Input・Openを保持した
- [x] 既存Detail RelationとARCH-IDを維持した
- [x] 旧成立能力の比較と未照合範囲を分け、旧Evidenceを変更していない
- OPEN: Details・横断モデル・Quality・公開入口／Schema／移行・Source・実境界確認は未完了。UI工程Exitと通常Handoff、全体Readyを主張しない。
