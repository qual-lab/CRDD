# BHV-000012 ユーザー資格と現行Roleで利用範囲を確定し鍵を交換する

成果物種別: SPEC Detail
Behavior ID: `BHV-000012`
状態: Canonical
確認状態: 鍵提示方式の現行契約を候補伝播・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）。旧限定Passは履歴。Architecture／Quality／Source・実画面・全体Readyは未成立。
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 最小ユーザー・Role権限・資格の管理、要求毎の認可、独立失効、鍵交換2操作・2入口を成立させる。別操作の初回Host設定で最初の管理者と鍵を作成する。
- Source SPEC: [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md)
- 対象利用側: UI-000008／SCR-000008／PRT-000008
- 対象外: 新しいユーザー成果・Authority、一般IAM、回復専用Bootstrap、Role設定修復、採用済み入口以外のAPI・Process・保存Schemaの固定

## 2. Detailed Behavior

共有AI Profile四管理操作の認可は現在manager／administrator、developerは不許可とする。資格・初回完了・Roleが確認できない場合は観測不能とし、通常拒否や空Catalogへ畳まない。内容・改訂・CRUDは[BHV-000015](../BHV-000015/behavior.md)に保持し、この詳細では管理可否だけを渡す。Provider実行や鍵管理のAuthorityを追加せず、通常保存6操作・鍵3操作・Host交換2操作の既存境界を維持する。Source／本番入口は未接続である。

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 接続／利用要求、ユーザー登録・名前／Role変更・Role権限変更、Repository登録・登録解除・公開範囲設定、資格発行、独立失効、指定ユーザー交換／全員交換、発行／記録不明の元Identity再観測、または確定発行・受け渡し未確認からの別明示交換。初回はHost操作者の明示開始、確認済み途中は元初期化試行の再観測。MCP・自動起動から開始しない。 |
| Precondition | Applicable | 通常管理は下の操作別契約で主体の現行Role・対象・必要状態を確認する。通常鍵操作はWorkbench固定administrator、Host交換はログイン済み操作者の対話CLI・既存Root／Pathを確認し追加認証不要。交換は既存対象・必要資格集合、全員交換の指定既存administratorを確認し、Hostまたは全員交換だけ明示確認する。初回は既存OSユーザーのRoot／Pathと管理状態・途中記録の双方未初期化を確認。既存管理者やCredentialは要求しない。 |
| Authority | Applicable | 業務管理manager／administrator、administrator Role変更・詳細権限と鍵3操作のadministrator専用、内容許可、Host交換を分離する。固定分担は内容設定から派生させない。通常鍵操作は同一Process Workbench限定・MCP非公開。要求毎に資格→ユーザー→一つの現行Roleへ結び直す。初回はログイン済みHost操作者を信頼する別操作で、追加認証・資格・承認コード・OS昇格なし。表示名はAuthorityではない。 |
| Input | Applicable | 対象userId、表示専用名、現行Roleと詳細権限、Credential ID／状態、Repository公開・実アクセス、鍵交換操作種別・入口・失効集合・既存発行先・保持情報、非秘密の元発行Identity（Credential IDとは別）、発行／結果記録／提示結果と初回だけ同鍵の最初の接続確認の情報、交換由来だけ確定済みのexact Recovery ID。生Secretを保存・診断入力へ複製しない。初回は管理用表示名・現在の初期化確認を入力とし、未作成UUIDを要求しない。途中は確認済み元試行・既知UUID・個別結果を使う。 |
| Validation | Applicable | Effect前に入口Authority、対象Identity、現在の必要状態と確認条件を照合する。既存対象を必要とする操作での対象不明・管理者不存在・安全に確認不能・認可設定破損では新しいEffectを発行しない。初回は双方未初期化・明示開始を確認。既存・別Root・読取り失敗・破損・Lock使用中・未解決回復を未初期化へ丸めない。 |
| State／Transition | Applicable | 資格の有効／失効／不明と、利用状態5区分・部分成立、回復の確認待ち／進行中／blocked／completedを分離する。鍵交換は旧失効＋新発行であり、永続resetting／rotating状態を増やさない。初回4状態と未試行／不明を分離し、未開始から元試行・UUIDを推定しない。作成済み・発行済みを未初期化へ戻さない。 |
| Sequence | Applicable | 新規発行は対象確認→発行→結果確定・用途限定・短命な応答で採用済み入口へのSecret一度提示。独立失効は対象確認→失効→結果確定（新発行なし）。交換は4組すべて事前表示→入口条件・必要な明示確認→同じRecoveryへ結合→旧失効→新発行→結果確定→採用済み入口への一度提示を別段階として扱い、対象本人への製品外引渡し・受領は観測外とする。初回は明示開始→双方確認→表示名→最初のadministrator UUID作成→同じuserIdへ発行→結果記録→Host一度提示→exact同鍵の初回確認用限定接続成功を受領・接続確認→確認の保存・読戻し・清掃→初回完了・通常管理。各段階を別観測。秘密の提示は通常の同一Process backendから操作administratorのWorkbenchへ、Host交換・初回ではHost端末へ用途限定・短命に搬送する。汎用MCP／一般Transport DTO・一覧・履歴・Log・Evidenceへ生Secretを公開・保存せず、対象本人の受領済みを推定しない。 |
| Effect | Applicable | 通常管理は操作別に最小ユーザー情報・Role内容設定・Repository接続登録／Exposureを更新する。登録≠公開、解除≠Repository／Product Data削除。鍵交換は旧失効＋既存発行先への新発行だけで、ユーザーID・名前・Role・詳細権限・Repository登録・Product Dataを保持する。初回は最初のUUIDユーザー・表示専用名・一つのadministrator Roleと結合鍵だけを作成。登録・Exposure・内容権限を自動付与せずProduct Data不変更。 |
| Output | Applicable | 許可範囲の自身／管理対象情報と操作別結果。新規発行は発行結果・一度表示Secret、独立失効は失効結果だけ（新発行・Secret・交換再入場なし）、交換は確定失効範囲・発行結果・結果改訂・同じRecovery IDと確認先・新資格再入場先を返す。初回は作成UUID、発行・記録・Host提示・exact同鍵の初回確認用限定接続確認の個別事実、用途限定・短命な応答で採用済み入口へのSecret一度提示、次行動。部分結果を初回全体完了にしない。秘密の提示は通常の同一Process backendから操作administratorのWorkbenchへ、Host交換・初回ではHost端末へ用途限定・短命に搬送する。汎用MCP／一般Transport DTO・一覧・履歴・Log・Evidenceへ生Secretを公開・保存せず、対象本人の受領済みを推定しない。 |
| Failure | Applicable | 未認証・未認可・非公開・取得不能・不明、対象競合、Secret再表示要求、既存administratorの有効Credential全喪失、認可破損、処置後の発行失敗・応答／Process喪失を分ける。許可外User／Repositoryの存在・名前・件数を含めない。初回は作成・発行・記録・Host提示・exact同鍵の初回確認用限定接続確認の失敗／不明を別保持し、確認済み元試行を相関。秘密保存／再表示・自動再発行なし。 |
| Recovery | Applicable | 鍵交換は旧失効前から確定済みの同じRecovery IDへ結合し、種別・入口・対象・既存発行先・既知処置・発行結果を非秘密の耐久情報として保持する。再入場で現在状態を再観測し、記録からAuthority・完了を復元しない。独立失効の不明時は既知状態・確認先を返し、交換の発行／再入場を適用しない。初回の発行／記録不明は確認済み元試行再観測だけ。発行・記録確定で提示またはexact同鍵の初回確認用限定接続確認だけ不明なら作成済みadministratorへの既存Host指定交換を別明示操作とする。初期化に交換Recoveryを新設しない。 |

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで扱い、MCPへ鍵操作の一覧・Schema・登録・dispatchを公開しない。通常Host回復はログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱う。追加認証・専用資格・承認コード・OS管理者昇格は要求せず、既存Root／Path検証を維持し、検証済み範囲外へ越境しない。manager／administratorがユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministrator専用固定であり、Role内容設定で委譲しない。

ユーザーは安定userId（UUID）・管理者設定の表示専用名・一つの現行Roleを持つ。名前変更でIdentityやAuthorityを変えない。Role詳細権限はRoleが所有し、ユーザー／資格への個別追加権限を持たせない。Repository単体利用はCredential不要。初回Host設定は下記の別操作とし、通常Host回復を増やさない。

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

固定管理能力は現行Roleと上表の割当てから判定し、Role詳細権限の内容設定から派生させない。managerによるadministratorの表示名変更は許可するが、そのRoleの付与・解除・降格・詳細権限・鍵操作は許可しない。developerの管理拒否を自身表示・許可内利用の拒否へ広げない。

### 通常管理の操作別契約

| 操作 | Input | Authority／Validation | Effect | Output |
|---|---|---|---|---|
| ユーザー登録 | 登録予定Role・表示名 | 変更前の主体の現行Roleと固定分担。managerはdeveloper／managerのみ。対象の変更前Roleは要求しない | 新しい安定userId・表示名・一つのRoleを登録。鍵は発行しない | 登録結果。新Credential／Secretなし |
| 表示名変更 | 対象既存userId・新表示名 | manager／administrator。administratorの表示名も可 | 表示名だけ更新しuserId・Role・Credential保持 | 同じ対象の表示名変更結果 |
| 既存ユーザーRole変更 | 対象userId・変更前後Role | managerは前後ともdeveloper／managerだけ。administratorの付与・解除・降格はadministratorのみ | Roleだけ更新、userId・Credential結合保持 | 更新結果。次要求から現行Roleで認可 |
| Role詳細権限設定 | 対象Role・現在内容・変更内容 | managerはdeveloper／managerのみ、administratorは三Role。固定管理分担は設定対象外 | Role内容範囲の明示更新。固定分担不変 | 更新結果。内容取得成立を主張せず次要求で再認可 |
| Repository登録・登録解除 | Repository ID・現在登録状態・変更内容 | manager／administrator、変更前の現在認可と対象を確認 | 登録は接続登録だけ更新し公開しない。解除は同じ操作で登録と対応Exposureを除去。他登録／Exposure・対象本体・Product Data保持 | 登録更新結果。解除は両除去確認済みのみ完了。以後の対象アクセス停止と開始済み操作終了未観測を別に扱う |
| Repository公開範囲設定 | Repository ID・現在Exposure・変更内容 | manager／administrator、変更前の現在認可と対象を確認 | Exposureだけ明示更新 | 更新結果。次要求でRole・Exposure・実アクセスを別判定 |

manager自身の内容範囲も、変更前の現在の管理認可→明示的なRole内容範囲／Exposure更新→次要求で現行Role・Exposure・実アクセスの再評価、と分ける。管理能力から内容閲覧を自動付与せず、更新受理を内容取得・開始済み取消完了と表示しない。表示の非表示／無効化だけで認可を代替せず、BHVの処置前判定で拒否・不明を扱う。

各操作は変更前の現行Roleと固定分担、操作固有の対象・現在状態をEffect前に確認し、不一致・不明・未認可では新Effectを発行しない。通常管理の結果不明を交換専用Recoveryの旧失効・新発行へ変換しない。保存Schema・新Store・一般Recoveryは追加しない。

## 3. Behavior Flow

| 操作 | 失効範囲 | 発行先 | 維持する条件 |
|---|---|---|---|
| 指定ユーザー交換 | 対象既存userIdの全旧有効資格 | 同じ既存userId | 他ユーザーの鍵を保持 |
| 全員交換 | 全ユーザーの全旧有効資格 | 指定既存administrator userId | 他ユーザーの通常再発行・再配布は管理者が行う。操作中管理者自身の旧鍵も失効 |
| 独立した資格失効 | 指定した資格 | なし | 以後の要求を拒否し、新資格を自動発行しない |

```text
利用要求 → 資格でユーザー識別 → 現行Role権限／公開／実アクセスを別判定 → 許可範囲の結果

新規発行: Workbench固定administrator → 対象確認 → 新発行 → 結果確定／用途限定・短命な応答で採用済み入口へのSecret一度提示 秘密の提示は通常の同一Process backendから操作administratorのWorkbenchへ、Host交換・初回ではHost端末へ用途限定・短命に搬送する。汎用MCP／一般Transport DTO・一覧・履歴・Log・Evidenceへ生Secretを公開・保存せず、対象本人の受領済みを推定しない。
独立失効: Workbench固定administrator → 対象確認 → 失効 → 失効結果（新発行・Secret・交換再入場なし）

交換: Workbench固定administrator または Hostログイン済み操作者の対話CLI
  → 対象・失効範囲・発行先・保持情報を提示
  → Host入口または全員交換のみ明示確認
  → 前提を現在状態と照合
      ├ 不明／不足／破損 → 新Effect前停止
      └ 成立 → 当該交換のexact Recoveryへ結合 → 旧資格失効 → 新資格発行 → 結果確定 → 採用済み入口へのSecret一度提示 → 新資格で再入場（対象本人への引渡し・受領は観測外）
                     ├ 発行／記録不明 → 元発行Identityと元exact Recoveryで再観測
                     ├ 発行／記録確定・提示・引渡し未確認 → 別明示交換（別Operation／Recovery）
                     └ 現在の管理認証喪失 → 既存Host交換入口
```

通常入口の指定ユーザー交換は追加明示確認を要求しないが、対象・影響の事前提示は行う。処置前中止と、処置後の提示・引渡し未確認を分離する。発行／記録不明時は元Identityで再観測し、Secret再表示・別Recoveryの重複開始をしない。発行／記録確定・受け渡しだけ未確認時の別明示交換は、元処理の再開や重複開始と区別する。失効／鍵交換の成立は開始済み操作の取消完了や過去Effect 0を証明しない。

### 提示と初回接続の終了条件

通常の提示先は操作administratorのWorkbench、Host交換の提示先はHost端末。対象本人への安全な製品外引渡し・受領は観測外であり、追加受領操作・通常受領記録を作らない。初回はHost端末へ一度提示し、同じ元試行・初資格の最初の限定接続成功を受領・接続確認とする。

初回確認の保存・読戻し・清掃を確認する前に通常Authorityを発行しない。KDF一致・callback完了・通信到達だけで成功にしない。具体的な接続入口・観測方式・保存SchemaはArchitectureへのOPENであり、このDetailから実装Ownerや成功観測を捏造しない。追加人間操作・Receipt Store・Session・Timer・認証Frameworkなし。

### 初回Host設定の処理順と終了条件

[Source SPECの初回設定](../../Definitions/SPEC-000012/spec_definition.md#初回host設定の条件状態結果)を別操作として詳細化する。ユーザー成立前の相関情報は既存の管理能力が所有し、成立後は同じ作成UUID・Credentialへ結び付ける。具体保存・相関方式はArchitectureで決め、新Domain Object・安定ID・一般Recoveryを追加しない。

```text
Host明示開始 → Root／Path・双方未初期化を確認
  ├ 既存／不明／破損等 → 新しい初期化Effect前停止
  └ 確認 → 表示名 → UUID作成 → 同じuserIdへ鍵発行 → 結果記録 → Host端末一度提示 → exact同鍵の初回確認用限定接続成功を受領・接続確認 → 確認の保存・読戻し・清掃 → 初回完了・通常管理
  初回確認のいずれか未確認・失敗・観測不能 → 初回完了表示0／通常Authority0
途中再入場 → 確認済み元試行と現在の個別事実を再観測
  ├ 発行／結果記録不明 → 元試行再観測だけ
  └ 発行・記録確定／Host提示またはexact同鍵の初回確認用限定接続確認だけ未確認 → 別明示Host指定ユーザー交換
  初回確認のいずれか未確認・失敗・観測不能 → 初回完了表示0／通常Authority0
```

| 状態・条件 | 認識する結果と次の行動 |
|---|---|
| 双方未初期化を確認・明示開始 | 管理状態と途中の初期化記録の双方を確認した後だけ、表示専用の管理用名入力→最初のadministrator UUID作成→同じuserIdへ鍵発行・結果記録→Host端末へのSecret一度提示→exact同鍵の初回確認用限定接続成功による受領・接続確認→確認の保存・読戻し・清掃確認→初回完了／通常Authorityへの接続と進む。 |
| 既存管理状態・ユーザー・管理者あり | 初回設定を拒否する。鍵喪失は既存Host交換へ。管理者不存在・Role／認可破損を再初期化で修復しない |
| 確認済み途中 | 非秘密の元初期化試行と、作成UUID・発行・結果記録・Host提示・exact同鍵の初回確認用限定接続確認を別事実として保持・再観測する。作成済み・発行済みを未初期化へ戻さない。 |
| 発行または結果記録が未確認 | 確認済み元試行の再観測だけ。新交換・再初期化・自動再発行なし |
| 発行・記録確定、Host提示未確認 | 確定発行とHost提示不明を分離。作成済みadministratorを対象とする既存Host指定ユーザー交換を別明示操作として案内する |
| 発行・記録・Host提示確定、同鍵初回接続未確認 | 提示済みと接続確認不明を分離。同じ別明示交換を案内し、旧Secret受領済みとは示さない |
| 観測不能・不明 | 新Effect前に停止し、確認先を示す。単一ファイル不存在・別Root・読取り失敗・破損・Lock使用中・未解決回復を未初期化にしない。未試行と不明を区別し、存在未確認の試行・UUIDを推定しない |
| 必要な結果を確認 | Host一度提示、exact同鍵の初回確認用限定接続成功、確認の保存・読戻し・清掃確認がすべて成立した場合だけ初回完了と通常管理への接続を示す。個別の途中結果から全体完了を推定しない。 |
| 初回確認の失敗・未確認・観測不能 | 初回完了と通常Authorityを成立させない。確定した事実は元試行へ結合して保持し、未確認段階を明示する。発行／記録不明は元試行再観測、両確定後の提示・接続未確認は既存明示Host交換とし、保存・清掃の処置はArchitectureで確定する。 |

これは第三のHost回復ではない。別交換だけがその交換内のexact Recoveryを持ち、元初期化試行との関係を保持する。通常管理9 Role分担行、通常Host回復2操作、MCP鍵非公開、既存交換4表示・3確認は不変。既存対象が不明・必要管理者が不存在の場合の交換拒否を、双方未初期化確認後の最初の管理者作成の拒否へ広げない。

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000008／PRT-000008.spec-000012](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | 初回設定の4状態・個別結果、自身と許可範囲、通常管理・独立失効、2操作の影響と2入口の条件 | 事前停止、失効／発行の別結果、一度表示Secret、部分結果、元Identity再観測／別明示交換／既存Hostの3分岐 | 鍵提示方式の対応を更新・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）（旧Passは履歴） |

認証済自身の表示は許可する。非認証User情報0、現在他ユーザー参照を許可されていない主体の他User一覧・存在・件数0を維持する。管理能力と内容閲覧権限は別に判定する。

| 交換の入口と操作 | 事前表示 | 明示確認 |
|---|---|---|
| 通常Workbench × 指定ユーザー | 対象ID・表示名、失効範囲、発行先、保持情報 | 追加確認なし |
| 通常Workbench × 全員 | 同上 | 必須 |
| Host CLI × 指定ユーザー | 同上 | 必須 |
| Host CLI × 全員 | 同上 | 必須 |

## 5. Verification Intent

| 条件 | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| 正常 | 最小ユーザー／Role管理、資格発行・要求毎認可、2操作の失効集合と既存発行先、独立失効の新発行なし | Source SPECの正常義務へ統合 |
| 境界 | 同名・改名、三Role、三可視境界、管理と内容、公開と取得、単体利用、2操作×2入口を区別 | 通常×指定は明示確認の追加なし、他3組は明示確認必須。事前表示は4組すべて |
| 失敗 | 既存対象を必要とする操作での対象不明・管理者不存在・必要状態観測不能・認可破損で新Effect前停止。秘密保存・漏えいをせず、鍵操作の失敗ではProduct Data／Role詳細権限を変更しない | 鍵操作の保持情報の非変更と、各操作の事前拒否結果を観測 |
| 結果不明 | 発行／記録不明と確定発行・受け渡し未確認を分離し、解除の両除去と既存操作終了観測を別に保持 | 不明を成功・rollback・旧鍵有効・取消完了・実資源終了へ畳まない |
| 別明示交換 | 確定発行・受け渡しだけ未確認から、現在認可と対象集合を再確認した別交換 | 別Operation／Recovery・先発行鍵を含む失効集合・既存発行先・4表示3確認。新成功≠旧Secret受領 |
| 回復 | 元発行Identityと既知事実を保持し、交換由来だけ同じexact Recovery。認証喪失は既存Host | Secret再表示、特別ユーザー／権限追加、回復Bootstrap、記録によるAuthority復元を反証 |

検証では固定administrator以外の通常鍵操作、MCP鍵操作の一覧・Schema・登録・dispatch、通常Host回復からの新規発行・独立失効、追加認証要求、検証済みRoot／Path範囲外への操作を反証する。9 Role分担行のRole別肯否と、共有Profile四管理操作の許可／拒否／観測不能、managerによるadministrator表示名変更許可とRole付与・解除・降格・詳細権限・鍵拒否、developer管理拒否、現在認可不明のEffect前停止を検証する。通常発行の旧失効なし、独立失効の指定Credential–userId一致・指定外失効なし・新資格／Secretなし、交換範囲逸脱なしを反証する。

これは検証義務の導出入力であり、Quality項目・Test・実行Evidenceの成立を示さない。

### 登録解除と発行・受け渡しの確定条件

登録解除は同じ受理済み操作で対象の登録と対応Exposureを除去する。別の先行公開解除を必須にせず、他登録・Exposure、対象Repository本体・Product Dataを保持する。両除去を確認した場合だけ解除完了とし、片側残存・観測不能を完了にしない。解除完了と開始済み操作終了未観測は別に保持し、取消成功・過去Effect 0・実資源終了を推定しない。新しい取消処置は追加しない。

発行または結果記録が不明なら、Credential IDとは別の非秘密の元発行Identityと既知事実で現在再観測する。交換由来だけ元のexact Recoveryを保持し、通常発行へ交換Recoveryを作らない。発行・結果記録が確定し提示・引渡し（初回は同鍵の接続確認）だけ未確認なら「発行済み・受け渡し未確認」とし、確定発行を不明へ戻さない。秘密再表示・保存・自動再発行をせず、現在許可されたadministratorが別の明示交換を選ぶ。管理認証を失った場合は既存Host交換入口へ案内し、Workbench認可を迂回しない。

別交換は別Operation／Recoveryとし、旧処理の事実・元発行Identityと分離する。各交換内は旧失効前から同じexact Recoveryへ結合する。指定交換は先の発行鍵を含む対象ユーザーの全旧有効資格を失効して同じ既存userIdへ発行し、他ユーザーの鍵を保持する。全員交換は先の発行鍵を含む全旧有効資格を失効して指定既存administratorへ発行し、他ユーザーは通常再発行・再配布へ戻る。4組の事前表示・3組の明示確認と保持情報を再適用する。遅延した旧応答で失効鍵を利用可能と表示しない。新交換成功を旧Secret受領・rollback・開始済み取消完了へ読み替えない。

検証では片側除去だけの解除完了、確定発行の不明化、元発行IdentityとCredential IDの混同、通常発行への交換Recovery転用、遅延旧応答の失効鍵利用可能表示、新交換成功による旧Secret受領・取消完了の推定を反証する。

初回設定の検証は、双方未初期化・明示開始後の一度作成／発行／Host提示とexact同鍵の初回確認用限定接続成功による受領・接続確認と確認の保存・読戻し・清掃を別の成立条件として、既存・不明での初期化Effect 0、元試行再入場の別UUID・追加鍵・自動再初期化0、Host提示未確認と提示済み・同鍵初回接続未確認、Secret保存／再表示・MCP公開0を別観測する。Qualityへの導出入力で、未実行をPassにしない。各段階の未確認・失敗・観測不能を注入し、初回完了表示と通常Authorityの発行がともに0となる反例をQualityへ渡す。

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: 初期化4状態・元試行と作成UUIDの結合・作成／発行／記録／Host提示／exact同鍵の初回確認用限定接続確認／確認の保存・読戻し・清掃成立後の初回完了・通常Authority・通常回復との分離、対象相関、要求毎認可、2操作×2入口、失効と発行の分離、情報保持、秘密一度表示、部分結果の3分岐、各交換内exactと別明示交換のIdentity、登録と対応Exposureの同時除去・取消非証明。初回の各必要条件が未確認・失敗・観測不能なら完了表示0・通常Authority0とする。具体的な観測Owner・方式・Schema・未解決段階の処置はArchitectureで確定する。
- 配置を固定してはならない事項: 採用済みWorkbench／Host CLI／MCP非公開境界以外のProcess、Transport、保存方式、Class、Function、秘密保護方式、Frontend／Backend分割。
- Architectureで決める事項: ARCH-000013の責務再編でComponent、Boundary、Data／State OwnerとFailure Boundaryを更新する。旧設計・Sourceは本改訂に未追従であり、本書を実装成立根拠にしない。

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 採用済み入口以外の実装配置・物理保存・秘密保護 | OPEN | Architecture工程 | その他の配置・Store・Schemaは未固定 | Architecture Detailで具体化する時 |
| 実利用条件 | OPEN | SPEC／UX Owner・Qual-Lab | 利用頻度・確認負担は未固定。鍵の期限なしは採用済み | Pilot／回復実測または前提変更時 |
| 具体API・保存・実画面と本番認可 | OPEN | Architecture／実装・UI工程Owner | 固定分担の設計だけでは本番成立を主張できない | 後続のArchitecture・Source・実境界検証時 |

## 補足分析

現在SPEC Definitionの意味を既存BHVへ詳細化し、旧Role別鍵・Access再構成・Bootstrap再入場を置き換える。限定した詳細契約の更新であり、工程Exit・Architecture／Quality伝播・実装・E2Eの完成ではない。

## 鍵の期限なし方針の接続 — 2026-10-11

期限なしの実装条件: 時間経過だけで鍵の失効・交換・再発行を行わず、明示失効と現在認可を別に評価する。観測不能・無効・失効資格を受理しない。具体Schema・保存・本番接続は未成立。

## Checklist

- [x] Source SPECから導出し、新ID・Authority・Store／Schemaを追加していない
- [x] TriggerからRecoveryまで全観点を評価した
- [x] 独立失効と2操作×2入口、情報保持と秘密境界を区別した
- [x] 正常・境界・失敗・結果不明・回復の反証をQualityへの入力へ接続した
- [x] 利用者認識が必要な結果を既存SCR／PRTへ接続した
- [x] Process喪失後を元Identity再観測・別明示交換・既存Hostへ分け、各交換内exactを保持した
- [x] 未確認事項をOPENとしてOwner・影響・戻り条件とともに残した
