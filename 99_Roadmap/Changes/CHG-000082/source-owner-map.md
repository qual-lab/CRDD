# 旧CROSの移管対応表

成果物種別: 変更計画の移管分析
対象: [CHG-000082第二段階](second-stage-plan.md)
基準Commit: `2b5b1b76`
状態: 対応表作成済み・限定独立レビュー済み
維持責任者: Qual-Lab

## 結論と範囲

### 現在の撤去処置 — 2026-10-14

旧`40_Develop/cros` PackageのSource・公開API・bin・専用試験・Package設定・Symbol登録を撤去した。旧SourceはGit Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` の当時Pathから再構成する。下表は移管前の比較入力で、現行配置を表さない。CROSの全体概念は維持し、現在の認証・認可はAccess Management、Context集約はDomain Model、ProfileはAI Adapter、活動はOrchestrator、公開入口はMCP／Workbenchが所有する。旧REST・共有設定・旧資格fallbackを新Ownerへ持ち込まない。

`executeRepositoryLocalOperation`、`createSurfaceOperationHandler`、`settleDelegatedResult`は本番Consumerのない純値試作品であり、Source／専用Oracleを新Ownerへ移植しない。RFD-IT-009の実Repository三状態比較、EST-IT-010の全採用Surface同値、EST-ST-011の実Task帰還はOPEN・正式Not Runを維持する。新構成の部分接続から全義務のPassや5Cの完成を推定しない。配布閉包・利用側回帰・限定独立レビューは進行中で、本表だけで全体完了を示さない。

旧CROSの18 Sourceファイルと1 bin入口を確認した。認証・認可はAccess Management、許可済みContextの集約はDomain Modelへ分ける。混在ファイルはSymbol群で分解する。これは移管の判断入力であり、Architectureの第二正本、実装移管済みの記録、現行契約の検証結果ではない。

現行契約は[ARCH-000013](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md)と[横断モデル](../../../06_Architecture/03_Boundary_and_Interface_Model.md)を参照する。旧実装のCredential固定Grant、一資格rotation、Bootstrap新規Identityは、新しいユーザー・Role・鍵交換2操作へ単純移動できない。秘密保護・競合拒否・非開示などの保持能力と、置換する業務意味を分ける。

調査範囲は`40_Develop`と`template/tools`のTypeScript定義・import・呼出し、公開export、対応試験と下記の旧検証記録。本番Consumer未観測は、この範囲で呼出しを確認できないという意味であり、不要・デッドコード・外部利用不存在の証明ではない。試験は今回再実行していない。

## Source全数と処置候補

以下のPathは`40_Develop/cros/`からの相対Path。移管先は論理的な責務Owner候補であり、新しいFile名・型・API・保存Schemaの確定ではない。

| 現行File／Symbol群 | 実際の責務・保持能力 | 現Consumer／試験 | 処置候補・新Owner | 現契約との差・削除前の条件 |
|---|---|---|---|---|
| `src/index.ts` | 公開型・操作のFacade | MCP、Workbench、配布入口／各Package型検査 | 全exportを確定Ownerの公開入口へ再接続。各PackageのRoot `src/index.ts`原則は維持 | exportの所属先・新API集合はDetailsで確定。全exportを追跡してから旧Facade撤去。Capability barrelを作らない |
| `src/access/credential.ts` | 発行・Verifier照合・現在Record認証・管理・失効・rotation、改訂競合拒否 | Workbench資格管理、MCP Resolver、HTTP／`connection-credential.contract.test.ts` | 置換設計→Access Management | userId、現在Role権限、対象ユーザーの全資格失効が未実装。一資格rotationを指定ユーザー交換と呼ばない |
| `src/access/registry-file-adapter.ts` | OS管理Rootの不変Revision Snapshot・完全検査・競合publish | Host回復CLI／`credential-registry-file-adapter.contract.test.ts` | 保存Adapter→Access Management | Rootを改名理由で変えない。新ユーザー契約のSchemaと移行は別途設計。生秘密は保存しない |
| `src/access/recovery.ts` | 旧回復計画・対象再検査・prepare／publish／settle、同じRecovery | Host回復CLI／`connection-credential.contract.test.ts` | 置換設計→Access Management | 旧管理資格だけ／全資格の2 modeとBootstrapは廃止対象。2操作×2入口、既存userId発行、途中失敗を新設計へ接続 |
| `src/access/recovery-file-adapter.ts` | 非秘密のprepared／settled記録、同じIdentity・読戻し | Host回復CLI／`credential-access-recovery-file-adapter.contract.test.ts` | 回復記録Adapter→Access Management | 過去結果をsuccessへ変更しない。失効確定／発行不明を保存できる新契約との対応は未確定 |
| `src/access/recovery-cli.ts` | Host用Adapter構成・計画表示・確認・結果表示 | `bin/cros.ts`／資格・回復契約試験 | 入口置換→Access Management | 旧mode入力を単純改名しない。新入口配分とCLI入力・秘密出力は詳細設計で固定 |
| `src/access/resolve.ts` | 現認証＋一回のExposure読取りからRequest Scopeを固定 | MCP `project-context/cros-resolver.ts`、HTTP／Remote・MCP試験 | 認可Scope解決→Access Management | 現在Roleへ変更。Domainは許可済み集合だけ受け取る。管理操作へ不要なContent読取りを追加しない |
| `src/access/types.ts` | Exposure／認可情報とRepository意味・contentを混在させた同一改訂Snapshot境界型 | 設定Reader、MCP Resolver、HTTP／型検査 | REVIEW・分割必須。Exposure／認可入力はAM、Repository意味・contentはDomain／Binding側。境界型の配置はDetailsで確定 | 新API形状は未固定。DomainへCredential／Grant解釈を持ち込まず、AMへcontent所有を移さない。旧同一Snapshotを使う全Consumerの前提を保持してから切替 |
| `src/access/session-context.ts`（認証・Session・Repository解決） | Request内の許可範囲とExposure／Revision判定 | Scope Resolver、HTTP、MCP／`session-access.contract.test.ts` | 認可部分を分離→Access Management | 旧固定Grantを現在Roleへ置換。短命Request Contextを永続Sessionへ拡張しない |
| 同File（Context Package） | 許可済み情報の派生Packet・制限情報の値変換 | 本番Consumerなし／旧専用試験 | pure prototype撤去。Domain入力集約は部分接続、RFD-ST-010はOPEN | 目的限定Identity・Consumer lifecycle・終了後第二正本0は未成立。旧値試験をST Passへ流用しない |
| 同File（Handoff作成・再開） | Identity・Revision・Authority拡張の純粋判定 | 本番Consumerなし／旧専用試験 | pure prototype撤去。ERB-IT-010／ERB-ST-013は5C依存OPEN | sourceActive／destinationEffectIssuedの値から実Owner停止・Effect・重複消費防止を推定しない |
| 同File（Repository-local operation／AI operating plan） | 局所値変換／規則・手順参照の入力copy | 局所操作試験を保持、AI計画は本番Consumerなし | AI計画prototypeのみ撤去。RFD-IT-009は不変更、RFD-IT-011はOPEN | 実AI入口間のSource・Revision・規則・制約・差理由比較は未成立。残存試験をrepository-local-operationへ改名 |
| `src/federation/project.ts`（`resolveAuthorizedRepositories`） | Session／Exposure／Revisionから許可集合を選ぶ | Scope Resolver／`project-federation.contract.test.ts` | 分離→Access Management | 内容集約と別責務。非許可集合のIdentity・存在・件数を搬送しない |
| 同File（`createPortfolioProjection`と投影型） | 許可済みSourceのProject集約・欠測・競合・Source Coverage | MCP Resolver、Workbench型、HTTP／同試験・MCP試験 | 分離→Domain Model | 認可済み集合を入力とし、Credentialを解釈しない。投影型をAMとDomainに重複定義しない |
| `src/activity/read.ts` | 許可集合内のProject選択、Reader呼出し・join・結果検査 | MCP Resolver、HTTP／Remote・MCP Runtime活動試験 | REVIEW→認可済みQuery合成Owner | 活動事実はOrchestrator／Execution Intelligence。AMは許可範囲判定のみ。Query合成を事実Storeへ変えない |
| `src/activity/types.ts` | 活動Event・観測・Reader契約 | MCP Runtime活動Adapter、HTTP、Workbench／型・契約試験 | REVIEW→既存活動Ownerと公開Query境界を照合 | DTO／Readerと実状態Writerを同一Ownerと決めつけない |
| `src/activity/validate.ts` | 活動観測の閉じた値検査、所有済みSnapshot | 活動Reader・MCP Adapter／活動契約試験 | REVIEW→公開活動契約Owner | unknownを空成功へ畳まない。Transport envelope・Host Path・生Provider出力を混入させない |
| `src/profile/administration.ts` | 管理可否判定とProfile Mutation検査が混在 | MCP Resolver、HTTP／Profile管理試験 | 分離→認可はAM、内容・Mutation意味はAI Adapter、入力搬送は各Surface | Profile語彙をAMへ複製しない。期待改訂・削除確認・採用後応答故障を維持 |
| `src/connection/http.ts` | 認証・Portfolio・活動・ProfileのREST、Client、Origin／TLS／入力制限／終了保証 | Workbench Server、旧Shared Host／`remote-transport.contract.test.ts` | 分解後撤去→AM／Domain／AI AdapterとMCP・Workbench | CROS REST廃止≠各能力廃止。認証と認可はAM、Browser APIはWorkbench、別Process接続はMCPへ |
| `src/configuration/shared-server-file-adapter.ts` | 固定設定からOrigin・Portと検証済みRoot・Exposure・Topic／Meeting操作を合成 | `template/tools/crdd-cros-server.ts`／`shared-server-config-file-adapter.contract.test.ts` | 分離→接続管理はAM、意味解析・CRUDはDomain、Listener設定はMCP／Workbench。既存Runtime Root resolver（現Domain内）とVersion ControlのGit Root検証を再利用 | 現在は`shared-server.json`。二設定案は未接続。Root resolverの最終配置は未確定で、新しいRoot検証実装を追加しない。設定例・Root検証・秘密分離を失わない |
| `src/tool/registry.ts` | 渡されたTool配列の選択と試験関数実行 | 本番Consumerなし／旧専用試験 | pure prototype撤去。実Surfaceの公開・dispatchは部分接続、RCM-IT-010はOPEN | 全入口の同一能力・状態軸・取消・cleanup比較は未成立。AMへ移さず、新汎用Frameworkを作らない |
| `src/surface/operation.ts` | Owner委譲、Revision判定、Surface同値性、結果受領の純粋判定 | 本番Consumer未観測／`surface-contract.contract.test.ts`、`result-return.contract.test.ts` | REVIEW・削除未決 | 実Effectや耐久ACKの証明ではない。後段実行系の結果搬送契約へ照合し、単なる中継を増やさない |
| `bin/cros.ts` | 旧Host回復の引数・OS Root・対話端末入口 | package.jsonのbin宣言。recovery-cli library契約試験はあるが、bin wrapperの本番呼出し・直接実行試験は今回未観測 | 旧Host入口の置換候補→AM責務。具体的bin名・配置・入口数はDetailsで確定 | 公開CLI契約変更と内部Symbol改名を区別し、旧Bootstrapを新版完成として残さない。新入口成立・旧bin削除済みとは扱わない |

## 保持する成立能力と旧根拠

| 既存根拠 | 当時確認された範囲 | 新構成で再確認すること |
|---|---|---|
| [資格管理Slice](Evidence/260927-1921_phase4-credential-administration.md) | 注入済み管理Context、Verifierのみ保存、一度表示、失効・競合、単体資格不要 | 現在ユーザー／Roleによる管理可否、ユーザー全資格交換、三可視境界。旧Profile／Grant方式のPassは流用しない |
| [旧Host回復](Evidence/260927-2205_host-access-recovery.md) | Host計画確認、同じRecovery、非秘密記録、Registry一更新、Product Data不変 | Bootstrapなしの既存ユーザー発行、対象／全員、現在状態・Authority再入場、途中失敗。旧2 modeのPassは流用しない |
| [旧Remote Transport](Evidence/260927-1939_phase4-remote-transport.md) | 現在資格照合、非許可Source非開示、平文外部送信拒否、loopback終了 | MCP／内部呼出しの全経路で同じ非開示・秘密保護・終了保証。Internet TLS・Host配置はこの記録の保証外 |
| [旧Project Context MCP](Evidence/260927-2029_phase4-remote-project-context-mcp.md) | 許可Sourceの五場面・Portfolio、Request認証、単体資格不要、Listener終了 | 新Owner接続、現在Role、一覧／個別取得のSnapshot整合。Topic／Meeting・管理・AI全体の証明ではない |

根拠は歴史的記録として変更しない。現在Sourceの試験名は移管後に内容との一致を見直し、単体試験は責務File、IT以降は成立させる境界に対応させる。上記試験の存在から、最新版の実測・本番全接続・E2E Passを推定しない。

## 移管・削除Gateの先行計画履歴

上表のpure prototype撤去は、[第二段階の固定対象と義務保持](second-stage-plan.md#旧cros試作品の撤去--2026-10-13)に従う。基準Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` の旧Pathと撤去前Hashを同計画で保持する。`Evidence/261007_*`の維持案は当時の移管分析であり、現行のprototype保持方針ではない。正式191項目・QA ID・Not Run・v0.22対象は変更しない。以下の代替能力Gateは、実際に成立している旧能力に適用する。

1. 正式Detailsで新ユーザー／Role／資格と既存鍵交換2操作を具体化し、上記各候補Ownerを確定する。意味を持つ未接続能力は要求・既存Ownerへ照合し、削除採用が必要なら人間へ戻す。
2. Qualityへ正常・境界・準正常・異常・回復、非開示、改訂競合、失効後の次Request拒否、失効確定／発行不明を接続する。旧Local Item／Evidenceを新意味のPassにしない。
3. 公開exportの全数を新Owner・置換Consumer・試験へ対応付け、MCP、Workbench、Host入口と配布toolsを本番接続する。Package metadata／exports／scripts／lock／tsconfig／symbolも[第二段階計画](second-stage-plan.md)の接続閉包へ含める。
4. 同一Processの現在認可と別ProcessのMCP、Origin／TLS・入力制限・health・終了後接続拒否、Topic／Meetingの保存結果を能力別に確認する。healthはOwner自身の可用性だけを示し、全能力完成へ昇格しない。
5. 代替接続と必要な実境界の新根拠が揃ってから旧REST／Client／Shared Hostと旧cros Packageを撤去する。起動用Repositoryを暗黙公開せず、Browser↔Workbench APIは維持する。

対応表作成時点ではSource、実秘密Store、保存Root、Schema、現行Role権限、過去Evidenceを変更していなかった。上記5段階は当時の計画履歴であり、現在の撤去状態は冒頭の2026-10-14処置を参照する。新しい共有State／Registry／Lock／Gateway／IAM Frameworkは追加していない。実秘密Store・保存Root・過去Evidenceは不変更で、正式191項目・全体回帰・AM全体完成は未完了である。

## 限定確認結果

契約・品質の固定4文書レビューを統合し、境界型の混在、Root検証Ownerの漏れ、Facade／binの配置と観測表現の3指摘を是正した。是正方針を両確認者へ照合した後、限定再レビューは両観点とも残指摘0。差分空白検査とローカルリンク先存在確認は成功（アンカー全数検査ではない）。19入力の対応表確認に限定し、試験・実操作・新契約のE2Eは実行していない。
