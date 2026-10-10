# SPEC-000012 ユーザー資格と現行Roleで利用範囲を確定しAccessを回復する

成果物種別: SPEC定義
SPEC ID: `SPEC-000012`
状態: Canonical
確認状態: 最新鍵管理判断の再伝播中・限定独立レビュー済み・残指摘0。Detail以降・全体Ready・実装成立は未主張。
維持責任者: Qual-Lab

## 振る舞いの目的と統合判断

鍵の発行・独立失効・交換はadministrator専用固定で、Role詳細権限のON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで提供し、MCPには秘密値の有無を問わず鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱い、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存Root／Path検証を維持する。他4管理群（ユーザー管理・Role設定・Repository登録・公開範囲管理）の担当Role・設定可否はOPENのまま保持する。

| 正式入力と変換根拠 | 保持する意味 | SPECで成立させる契約 |
|---|---|---|
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)／[UX分析](../../Analysis/UX-000013/spec_analysis.md) | Role許可内だけ利用し理由と管理能力を区別する | 資格からユーザーを識別し、現行Role・公開対象・実アクセスを別判定する |
| [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)／[UX分析](../../Analysis/UX-000035/spec_analysis.md) | 最小管理で対象を維持しProduct Dataを保って再入場する | 最小ユーザー・Role権限・資格の通常管理と2操作と2入口を別軸にし、情報を保持して既存ユーザーへ再発行する |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)／[IA分析](../../Analysis/IA-000009/spec_analysis.md) | 同一性・関係・状態・可視性・責任 | 対象相関・次認可反映・鍵交換・秘密境界・同じRecoveryを保持する |

| 対象 | 保持する意味・関係 |
|---|---|
| ユーザー | 安定userId、表示専用名、一つの現行Role。同名・改名はIdentity／Authority変更ではない |
| 接続資格 | Credential ID→userId。生Secretを含めず、古いRole権限を固定しない |
| Role／Role詳細権限 | administrator／manager／developer。詳細権限はRoleが所有し、ユーザー・資格への個別追加権限なし |
| Repository Exposure | Repository IDと公開対象範囲。Role権限・実アクセスとは別 |
| 実アクセス可能性 | Repository IDと現在の取得可能性。不明・取得不能を利用可能にしない |
| 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Roleへ結び直す |
| Repository情報範囲／リポジトリ | Repository IDと情報責務・内容正本。利用者Roleや公開設定ではない |
| 管理能力 | 鍵操作はadministrator専用固定。他4管理群の担当Role・設定可否はOPEN。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／鍵交換後だけ一度表示。永続Identityを作らない |
| 接続資格状態 | 有効／期限切れ／失効／不明。リセット専用の永続状態は作らない |
| Access Recovery | 同じRecovery ID、操作種別（指定ユーザー交換／全員交換）と入口・Authority属性 |
| Recovery対象／保持対象／結果 | 対象userId・失効資格集合・既存発行先、保持するユーザー情報・Role権限・Repository登録・Product Data、失効確定範囲と発行結果・結果改訂・再入場先 |

userIdは採用済UUID制約を継承する。版・生成方式・物理Schemaはここで確定しない。

## 契機・事前条件・Authority

| 契機 | 事前条件とAuthority | 判定不能時 |
|---|---|---|
| Remote接続／利用要求 | 資格で識別したユーザーの一つの現行Role詳細権限、Repository公開対象、実アクセスを別々に確認 | 未認証／非許可／未公開／取得不能／不明を許可へ補完しない |
| ユーザー登録・名前／Role変更・Role権限管理 | 現在の管理許可、処置対象と変更内容が確認できる。他4管理群の担当Role・設定可否はOPEN | 新しい管理Effectを発行せず確認可能な不足と次行動を返す |
| 新規資格発行・独立失効 | 同一Process Workbench backend、固定administrator権限、既存対象と操作内容を確認する。Host／MCPには提供しない | 新しい鍵Effectを発行せず、許可内の不足・次行動だけを返す |
| 鍵交換2操作 | 通常入口は同一Process Workbenchの固定administrator権限、Host入口はログイン済みローカル操作者の対話CLI。対象既存userId・必要資格集合・現在状態、全員交換の指定既存administratorを確認。全4組事前表示、Host入口と全員交換の3組だけ明示確認 | 新しいEffectを発行せず、確定済Recoveryがあれば同じIDで停止・再入場 |

通常管理権限から内容閲覧やHost回復Authorityを推定しない。Repository単体利用はCROS資格に依存させない。

## 振る舞い・状態・結果

| 操作 | 契約と結果 |
|---|---|
| 登録 | 現在許可された主体が安定userId、表示専用名、一つの現行Roleを持つユーザーを扱う。担当Roleの具体割当はOPEN |
| 名前変更 | 対象userIdを維持し、名前を認証・認可・一意性根拠にしない |
| Role／詳細権限変更 | 標準Roleはdeveloper／manager／administrator。詳細権限はRoleが所有し、次の認可から現行値を用いる |
| 新規発行 | Workbenchの固定administrator操作で資格を既存userIdへ結合し、新Secretを一度だけ返す。旧資格失効や鍵交換の再入場は伴わない |
| 認証 | 資格から既存userIdを識別し、CredentialやSessionへ古い権限を固定しない |
| 指定ユーザー交換 | 対象既存userIdの全旧有効資格を失効し、同じuserIdへ新資格を発行して新Secretを一度だけ返す。他ユーザーの鍵は保持する |
| 全員交換 | 全ユーザーの全旧有効資格を失効し、指定した既存administrator userIdへ新資格を発行して新Secretを一度だけ返す。他ユーザーへの通常再発行・再配布は管理者が行う |
| 独立した資格失効 | 対象資格とWorkbenchの固定administrator権限を確認し、失効した資格を以後の要求で拒否する。新資格を自動発行しない。結果不明時は既知対象・状態を保持し、開始済み操作の取消完了やEffect 0を推定しない |
| 利用範囲 | Role許可・Repository Exposure・実アクセスが成立する範囲だけ利用可能とし、Repository情報責務を別に保持する |
| 自身／管理対象情報 | 認証済自身表示可、非認証User情報0、現在他ユーザー参照を許可されていない主体の他User一覧・存在・件数0 |
| 鍵交換の保持境界 | 通常／HostともユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataを保持する。特別ユーザー・追加権限・回復専用Bootstrapを作らず、認可設定破損は処置前停止する |

資格は有効／期限切れ／失効／不明を区別する。鍵交換は旧失効＋新発行の関係であり、新しい永続resetting状態を作らない。利用状態5区分と複数対象の部分成立は別軸として返す。回復は確認待ち／進行中／blocked／completedを区別する。要求発行、状態確定、結果受領を同一視しない。

## 失敗・回復・副作用

無効・期限切れ・失効資格、対象不明・競合、Role不整合、公開／取得不能、Secret再表示要求、全管理資格喪失、認可破損、回復途中失敗を区別する。許可外User／Repositoryの存在・名前・件数を理由にも含めない。

副作用は最小ユーザー情報・Role設定・非秘密資格情報／検証用情報・失効と回復記録の更新に限定する。生Secretまたは受信可能な同等値を保存・ログ・Evidence・会話へ複製しない。Digest等の方式はArchitectureで確定する。鍵交換は両入口でユーザー情報・Role・詳細権限・Repository登録・Product Dataを変更しない。初回Server設定方式は変更しない。

鍵交換と開始済み操作の取消は別の契約であり、リセット成功は取消完了や過去Effect 0を証明しない。採用前に管理処置を中止した場合と、処置後に結果受領できなかった場合を混同しない。結果不明時は成功・失敗を推定せず、既知の対象・現在状態を確認してから再処置する。回復途中失敗後は別Recoveryを重ねず、同じID・種別・対象へ再入場する。

対象既存userId、全員交換の指定既存administrator、必要な資格集合・現行Role権限、入口Authorityと必要な明示確認を処置前に確認する。対象不明・管理者不存在・必要状態を安全に確認不能・認可設定破損では新しいEffectを発行しない。事前条件確認、旧資格失効、新資格発行、結果確定・受領を区別する。失効後の発行失敗・応答喪失・Process喪失では、確定した失効範囲と発行結果の不明を非秘密の耐久情報として同じRecovery IDへ保持し、再入場時は現在状態を再観測する。再観測なしに完了・rollback・未失効・開始済み取消済みを推定せず、Secretを再表示しない。記録は操作種別・入口・対象・発行先・既知処置・発行結果・再入場を相関し、保存Schemaや新Storeはここで決めない。

## 受入条件と検証義務

確定済みRecovery ID・種別・対象・既知処置結果を非秘密の耐久情報としてProcess喪失後も保持する。同じ回復へ再入場する際は現在状態を再観測し、保存記録からHostのログイン済み操作者・Effect完了・回復完了を復元または推定しない。物理保存方式や新Storeはここで決めない。

| 観点 | 受入条件 |
|---|---|
| 正常 | 最小ユーザー登録・変更、Role権限管理、資格発行／認証／リセット／独立失効、許可内利用が別条件で成立する |
| 境界 | 同名・改名、三Role、三可視境界、管理と内容、公開と取得、5状態と部分成立、単体利用を分ける |
| 鍵交換 | userId／Role保持、旧資格の以後拒否、新Secret一度表示、開始済み取消非証明 |
| 失敗 | 名前Authority化・古権限固定・秘密再表示／保存・非開示漏えい・Product Data削除をしない |
| 回復 | 2操作の失効集合・既存発行先と2入口のAuthority・明示確認を別軸で検証する。処置前中断は新Effectなし、失効後の発行失敗・応答喪失・Process喪失は既知失効／発行不明を同じRecoveryへ保持し、現在再観測なしに完了・rollback・Authority復元を推定しない |
| 観測不能 | 不明を完了・許可・不存在へ丸めず、未確定処置を進めない |
| 対応UI | UIの対象確認・状態・操作・Feedbackに契機・結果・失敗を対応付ける |

## 対応するUI

- pairs_with: [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)

UIを正式入力にせず、同じUX／IAから独立に導いた内容を対応レビューする。

## 制約

一般IAM、メール・Password・本人確認・自己登録・自己編集・SSO・複数Role・個別追加権限・個人行動監査を追加しない。採用済み入口境界以外のAPI、UI配置、Process構成、秘密Store、物理保存方式はこの定義で決めない。既存SourceのCredential単位Grantを根拠に上流制約を変えない。

## 未確認事項・人間判断・戻り条件

| 継承元 | 未確認事項 | 判断者・再評価契機 | 未確認時の影響 |
|---|---|---|---|
| UX-000013 | 自身表示名と安定ID、現行Role範囲・利用不能理由の理解、接続負担・失敗後の選択 | 代表利用者・Qual-Lab。実利用確認／前提変更時 | 定量条件と具体導線を確定しない |
| UX-000035 | 対象識別とリセット確認の負担、採用済みWorkbench／Host CLIの具体表示・案内、有効期限既定値 | 管理者・Host運用者・Qual-Lab。Pilot／回復実測時 | 期限・画面・配布手順を確定しない |

UUIDは採用済み継承制約として保持し、版・生成方式・Schemaはこの工程で決めない。表示名構文・正規化・一意性、物理保存形式も先取りしない。新しい本人確認・自己管理・複数Role・個別追加権限が必要ならDiscovery／UXへ戻す。正式入力の不足や競合は意味のOwnerへ戻し、現行Sourceから補完しない。

2操作の失効集合・既存発行先・情報保持は採用済み。対象不明・管理者不存在・認可設定破損や必要状態を安全に確認できない場合は処置前停止する。具体化で保持情報の非変更や安全な再入場が成立しない場合はSPEC／UXへ戻す。

## 検証意図

| 交換の入口と操作 | 事前表示 | 明示確認 |
|---|---|---|
| 通常Workbench × 指定ユーザー | 対象ID・表示名、失効範囲、発行先、保持情報 | 追加確認なし |
| 通常Workbench × 全員 | 同上 | 必須 |
| Host CLI × 指定ユーザー | 同上 | 必須 |
| Host CLI × 全員 | 同上 | 必須 |

固定administrator以外の通常鍵操作、MCPの鍵操作一覧・Schema・登録・dispatch、Hostからの発行・単独失効を拒否する境界を確認する。Hostに追加認証を要求せず既存Root／Pathを保持し、交換全4組で対象・影響を事前表示、Hostまたは全員交換の3組だけ明示確認する。他4管理群の担当Role・設定可否を未決のまま引き継ぐ。

受入条件各行をQualityの義務へ渡す。通常管理の対象維持と要求毎認可、処置前中止／処置後結果不明、秘密一度表示・非保存、2操作と2入口、情報保持、処置前停止、失効確定／発行不明と終了後状態を反証する。実装・試験手順や実測成功は先取りしない。

## 完了境界

今回の最新鍵管理判断を反映したDefinition候補である。横断投影と現行1組の対応は今回確認するが、SCR／BHV・Area・Workbench候補のDetail、Visual、Architecture／Quality／Sourceは最新判断に未追従。全体Ready・実装完成・E2E Passを主張しない。過去Evidenceは当時の記録として維持する。

## 補足定義

なし。

## Checklist

- [x] UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [x] Current State、Behavior、ResultおよびState Transitionを定義した
- [x] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [x] ConstraintとNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するUIとのRelationを明示した
- [x] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [x] 結果を観測可能な契約として定義した
- [x] 補足定義へ必須情報を退避していない
