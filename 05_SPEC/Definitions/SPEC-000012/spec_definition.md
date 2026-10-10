# SPEC-000012 ユーザー資格と現行Roleで利用範囲を確定しAccessを回復する

成果物種別: SPEC定義
SPEC ID: `SPEC-000012`
状態: Canonical
確認状態: 登録解除・鍵の受け渡し未確認の判断をDefinitionへ限定伝播・契約／品質独立再レビュー済み（残指摘0）。Detail以降・全体Ready・実装成立は未主張。
維持責任者: Qual-Lab

## 振る舞いの目的と統合判断

鍵の発行・独立失効・交換はadministrator専用固定で、Role詳細権限のON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで提供し、MCPには秘密値の有無を問わず鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱い、追加認証・専用資格・承認コード・OS管理者昇格を要求しない。既存Root／Path検証を維持する。manager／administratorはユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministratorだけが管理する。developerへ管理操作、managerへ管理者専用操作を設定で委譲しない。

| 正式入力と変換根拠 | 保持する意味 | SPECで成立させる契約 |
|---|---|---|
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)／[UX分析](../../Analysis/UX-000013/spec_analysis.md) | Role許可内だけ利用し理由と管理能力を区別する | 資格からユーザーを識別し、現行Role・公開対象・実アクセスを別判定する |
| [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)／[UX分析](../../Analysis/UX-000035/spec_analysis.md) | 最小管理で対象を維持しProduct Dataを保って再入場する | 最小ユーザー・Role権限・資格の通常管理と2操作と2入口を別軸にし、情報を保持して既存ユーザーへ再発行する |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)／[IA分析](../../Analysis/IA-000009/spec_analysis.md) | 同一性・関係・状態・可視性・責任 | 対象相関・次認可反映・秘密境界、元発行の確認範囲と各交換内exact Recovery／別明示交換を保持する |

| 対象 | 保持する意味・関係 |
|---|---|
| ユーザー | 安定userId、表示専用名、一つの現行Role。同名・改名はIdentity／Authority変更ではない |
| 接続資格 | Credential ID→userId、Credential IDとは別の元発行Identity、発行／結果記録／配送／受領確認を別属性として保持する。生Secretを含めず、古いRole権限を固定しない |
| Role／Role詳細権限 | administrator／manager／developer。詳細権限はRoleが所有し、ユーザー・資格への個別追加権限なし |
| Repository Exposure | Repository IDと公開対象範囲。Role権限・実アクセスとは別 |
| 実アクセス可能性 | Repository IDと現在の取得可能性。不明・取得不能を利用可能にしない |
| 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Roleへ結び直す |
| Repository情報範囲／リポジトリ | Repository IDと情報責務・内容正本。利用者Roleや公開設定ではない |
| 管理能力 | 業務管理はmanager／administrator、管理者Role・詳細権限と鍵はadministrator専用固定。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／鍵交換後だけ一度表示。永続Identityを作らない |
| 接続資格状態 | 有効／期限切れ／失効／不明。リセット専用の永続状態は作らない |
| Access Recovery | 各交換内のsame exact Recovery ID、操作種別（指定ユーザー交換／全員交換）と入口・Authority属性。別明示交換は別Operation／Recovery |
| Recovery対象／保持対象／結果 | 対象userId・失効資格集合・既存発行先、保持するユーザー情報・Role権限・Repository登録・Product Data、失効確定範囲と発行結果・結果改訂・再入場先 |

userIdは採用済UUID制約を継承する。版・生成方式・物理Schemaはここで確定しない。

## 管理操作の固定分担

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

固定の管理能力は現行Roleと上表の割当てから判定し、Role詳細権限の内容設定から派生させない。manager自身の内容範囲変更も、変更前の現在の管理認可→明示的なRole内容範囲／Exposure更新→次の要求で現行Role・Exposure・実アクセスを再評価、の順に分ける。更新受理だけでは内容取得可能とせず、管理者にも内容を自動付与しない。

administratorの表示名変更はmanagerにも許可するが、administratorの付与・解除・降格と詳細権限は許可しない。ユーザー登録・表示名／Role／業務設定の変更を鍵発行・失効と同一視しない。Repository登録・公開設定・内容の実在を別に扱い、登録だけで公開せず、登録解除では対応Exposureも同時除去し、他登録／Exposure・Repository本体・Product Dataを保持する。

## 契機・事前条件・Authority

| 契機 | 事前条件とAuthority | 判定不能時 |
|---|---|---|
| Remote接続／利用要求 | 資格で識別したユーザーの一つの現行Role詳細権限、Repository公開対象、実アクセスを別々に確認 | 未認証／非許可／未公開／取得不能／不明を許可へ補完しない |
| ユーザー登録 | 主体の変更前の現行Roleと固定割当て、登録予定Role・表示名を確認。managerはdeveloper／managerだけを登録できる。新規対象に変更前Roleを要求しない | 新しい管理Effectを発行せず、許可内の不足・次行動を返す |
| 表示名変更 | 主体の現行Roleと固定割当て、対象既存userId・変更する表示名を確認。administrator表示名もmanagerが変更可。ID・Role・Credentialは保持 | 新しい管理Effectを発行せず、許可内の不足・次行動を返す |
| 既存ユーザーのRole変更 | 主体の変更前の現行Roleと固定割当て、対象userId・変更前後Roleを確認。managerは前後ともdeveloper／managerだけを対象とする | 新しい管理Effectを発行せず、許可内の不足・次行動を返す |
| Role詳細権限設定 | 主体の変更前の現行Roleと固定割当て、対象Role・設定内容を確認。managerはdeveloper／managerの内容設定だけを変更可 | 新しい管理Effectを発行せず、許可内の不足・次行動を返す |
| Repository登録・登録解除・公開範囲設定 | 変更前の現行Roleがmanager／administratorであり、対象Repository ID・現在の登録／公開状態・変更内容を確認 | 新しい管理Effectを発行せず、許可内の不足・次行動を返す |
| 新規資格発行・独立失効 | 同一Process Workbench backend、固定administrator権限、既存対象と操作内容を確認する。Host／MCPには提供しない | 新しい鍵Effectを発行せず、許可内の不足・次行動だけを返す |
| 鍵交換2操作 | 通常入口は同一Process Workbenchの固定administrator権限、Host入口はログイン済みローカル操作者の対話CLI。対象既存userId・必要資格集合・現在状態、全員交換の指定既存administratorを確認。全4組事前表示、Host入口と全員交換の3組だけ明示確認 | 新しいEffectを発行せず、確定済Recoveryがあれば同じIDで停止・再入場 |

通常管理権限から内容閲覧やHost回復Authorityを推定しない。Repository単体利用はCROS資格に依存させない。

## 振る舞い・状態・結果

| 操作 | 契約と結果 |
|---|---|
| ユーザー登録 | manager／administratorが安定userId、表示専用名、一つの現行Roleを持つユーザーを登録する。managerはdeveloper／managerだけを指定でき、administratorの新規付与もadministratorだけに許可する。鍵は自動発行しない |
| 名前変更 | manager／administratorが全Roleの対象userIdを維持して表示名だけを変更する。名前を認証・認可・一意性根拠にせず、Roleと資格を変更しない |
| Role変更 | managerは変更前後ともdeveloper／managerの対象だけを扱う。administratorの付与・解除・降格はadministratorだけ。userIdとCredential結合を維持し、次要求から現行Roleを評価する |
| Role詳細権限変更 | managerはdeveloper／manager、administratorは三Roleの内容範囲を明示変更する。固定管理操作は変更しない。次要求で現行Role・Exposure・実アクセスを再評価する |
| Repository登録・登録解除 | manager／administratorが接続登録を更新する。登録だけでは公開せず、解除は対応Exposureを同時除去する。他登録／Exposure・Repository本体・Product Dataを保持し、片側だけの除去を完了にしない |
| Repository公開範囲設定 | manager／administratorがExposureを明示更新する。次要求で現行Role・Exposure・実アクセスを別判定し、公開だけでは内容アクセス成立としない |
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

無効・期限切れ・失効資格、対象不明・競合、Role不整合、公開／取得不能、Secret再表示要求、既存administratorの有効Credential全喪失、認可破損、回復途中失敗を区別する。許可外User／Repositoryの存在・名前・件数を理由にも含めない。

副作用は最小ユーザー情報・Role内容設定・Repository接続登録／Exposure・非秘密資格情報／検証用情報・失効と回復記録の更新に限定する。生Secretまたは受信可能な同等値を保存・ログ・Evidence・会話へ複製しない。Digest等の方式はArchitectureで確定する。鍵交換は両入口でユーザー情報・Role・詳細権限・Repository登録・Product Dataを変更しない。初回Server設定方式は変更しない。

鍵交換と開始済み操作の取消は別の契約であり、鍵交換成功は取消完了や過去Effect 0を証明しない。採用前に管理処置を中止した場合と、処置後に結果受領できなかった場合を混同しない。結果不明時は成功・失敗を推定せず、既知の対象・現在状態を確認してから再処置する。元発行または結果記録が未確定の交換途中失敗では別Recoveryを重ねず、同じexact ID・種別・対象へ再入場する。確定発行の受け渡しだけ未確認の場合の明示新交換とは区別する。

対象既存userId、全員交換の指定既存administrator、必要な資格集合・現行Role権限、入口Authorityと必要な明示確認を処置前に確認する。対象不明・管理者不存在・必要状態を安全に確認不能・認可設定破損では新しいEffectを発行しない。事前条件確認、旧資格失効、新資格発行、結果確定・受領を区別する。失効後に発行自体または結果記録が未確定となった場合は、確定した失効範囲と発行結果の不明を非秘密の耐久情報として同じRecovery IDへ保持し、再入場時は現在状態を再観測する。再観測なしに完了・rollback・未失効・開始済み取消済みを推定せず、Secretを再表示しない。記録は操作種別・入口・対象・発行先・既知処置・発行結果・再入場を相関し、保存Schemaや新Storeはここで決めない。

### 登録解除と鍵の受け渡しの条件・結果

登録解除は対象の登録と対応Exposureを同じ受理操作で除去する。事前の別操作による公開解除を必須にせず、以後の対象CROSアクセスを停止する。他Repositoryの登録／Exposureと対象Repository本体・Product Dataは保持する。両関係の除去を確認できる場合だけ解除完了を返し、片方残存または確認不能を成功へ畳まない。物理Transaction・Schema・Store方式はここで決めない。登録解除完了は開始済み操作の取消完了を証明しない。両関係の除去確認済みでも既存操作終了が未観測なら、解除完了とは別に未観測を保持し、取消成功・過去Effect 0・実資源終了へ読み替えない。新しい取消処置は追加しない。

発行自体または結果記録が不明なら、Credential IDとは別の非秘密な元発行Identityで現在再観測し、新交換を開始しない。交換由来だけ元のsame exact Recoveryを保持し、通常発行へ交換Recoveryを新設しない。発行・結果記録が確定し配送／受領だけ未確認なら、「発行済み・受け渡し未確認」と示し、確定事実を維持する。Secretの保存・再表示・自動再発行はしない。現在認可されたadministratorが人間の明示した既存交換を新しく開始でき、そのOperation／Recoveryは元処理とは別にする。現在の管理認証を失った場合は、Workbench認可を迂回せず既存Host交換入口へ案内する。

元発行と新交換の事実・Identityを別に保持する。指定ユーザー交換は先の発行鍵を含む対象userIdの全旧有効資格を失効し同じ既存userIdへ発行する。全員交換は先の発行鍵を含む全ユーザーの全旧有効資格を失効し、指定した既存administratorへ発行する。他ユーザーは通常の再発行・再配布を要する。各交換内では同じexact Recoveryを保持するが、新交換を元処理の再開として扱わない。新交換成功は旧Secretの受領・rollback・開始済み操作取消を証明しない。現在状態で失効した旧鍵を、遅延した元応答から利用可能と案内しない。

## 受入条件と検証義務

確定済みRecovery ID・種別・対象・既知処置結果を非秘密の耐久情報としてProcess喪失後も保持する。同じ回復へ再入場する際は現在状態を再観測し、保存記録からHostのログイン済み操作者・Effect完了・回復完了を復元または推定しない。物理保存方式や新Storeはここで決めない。

| 観点 | 受入条件 |
|---|---|
| 正常 | 最小ユーザー登録・変更、Role権限管理、資格発行／認証／鍵交換／独立失効、許可内利用が別条件で成立する |
| 境界 | 同名・改名、三Role、三可視境界、固定8操作とRole内容設定、管理と内容、登録と公開と取得、解除と削除、5状態と部分成立、単体利用を分ける |
| 管理分担 | 8操作を固定担当Roleで処置前認可する。managerのadministrator表示名変更は許可し、管理者付与・解除・降格・詳細権限・鍵操作とdeveloper管理を拒否する。対象／現行認可不明は新Effectなし |
| 内容範囲変更 | manager自身も変更前の現在認可で明示更新し、次要求で現行Role・Exposure・実アクセスを評価する。更新受理から取得可能・開始済み取消を推定しない |
| 鍵交換 | userId／Role保持、旧資格の以後拒否、新Secret一度表示、開始済み取消非証明 |
| 失敗 | 名前Authority化・古権限固定・秘密再表示／保存・非開示漏えい・Product Data削除をしない |
| 回復 | 2操作の失効集合・既存発行先と2入口のAuthority・明示確認を別軸で検証する。処置前中断は新Effectなし、失効後に発行自体または結果記録が未確定なら既知失効／発行不明を同じexact Recoveryへ保持し、現在再観測なしに完了・rollback・Authority復元を推定しない |
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

登録だけまたはExposureだけの除去を解除成功にせず、孤立Exposureを現在公開中として示さないこと、他対象・本体の保持、発行／記録不明と受け渡しだけ未確認の分岐、元発行IdentityとCredential IDの区別、通常発行への交換Recovery新設0、明示新交換の別Identityと対象範囲、現在認可・Host案内、Secret再表示／自動再発行0、遅延旧応答の失効鍵利用案内0を反証する。新交換成功から元Secret受領・rollback・取消完了を推定しない。既存の全4組事前表示・3組明示確認を維持する。登録解除完了は開始済み操作の取消完了を証明しない。両関係の除去確認済みでも既存操作終了が未観測なら、解除完了とは別に未観測を保持し、取消成功・過去Effect 0・実資源終了へ読み替えない。新しい取消処置は追加しない。

| 交換の入口と操作 | 事前表示 | 明示確認 |
|---|---|---|
| 通常Workbench × 指定ユーザー | 対象ID・表示名、失効範囲、発行先、保持情報 | 追加確認なし |
| 通常Workbench × 全員 | 同上 | 必須 |
| Host CLI × 指定ユーザー | 同上 | 必須 |
| Host CLI × 全員 | 同上 | 必須 |

固定administrator以外の通常鍵操作、MCPの鍵操作一覧・Schema・登録・dispatch、Hostからの発行・単独失効を拒否する境界を確認する。Hostに追加認証を要求せず既存Root／Pathを保持し、交換全4組で対象・影響を事前表示、Hostまたは全員交換の3組だけ明示確認する。8操作の許可／拒否を確認する。managerによるadministrator表示名変更は許可し、administratorの付与・解除・降格・詳細権限・鍵操作、developerの管理操作、Role設定による固定割当ての迂回は拒否する。manager自身の範囲変更は変更前認可と明示更新、次要求での現行Role・Exposure・実アクセスの再評価を分ける。登録だけの公開・内容取得、登録解除によるProduct Data削除、管理拒否による自身表示・許可内利用の拒否を反証する。対象・現行認可・必要状態を確認不能なら新Effectなしで停止し、既知結果と不明を区別する。

受入条件各行をQualityの義務へ渡す。通常管理の対象維持と要求毎認可、処置前中止／処置後結果不明、秘密一度表示・非保存、2操作と2入口、情報保持、処置前停止、失効確定／発行不明と終了後状態を反証する。実装・試験手順や実測成功は先取りしない。

通常発行で旧資格が失効しないこと、独立失効で指定Credential以外を失効させず新資格・Secretを発行しないこと、指定ユーザー／全員交換で定義した失効範囲を超えないことを、それぞれの負の検証義務としてQualityへ渡す。独立失効では対象Credentialと既存userIdの結合を確認し、別ユーザーや別Credentialへ処置を広げない。交換専用のRecovery条件を他操作へ転用しない。

## 完了境界

登録解除・鍵の受け渡し未確認のDefinition・現行1組対応は限定伝播・契約／品質独立再レビュー済み（残指摘0）。前判断の限定Passは履歴であり、SCR／BHV・Area・Workbench候補・Visual・Architecture／Quality／Sourceは最新分担へ未追従。全体Ready・実装完成・E2E Passを主張しない。過去Evidenceは当時の記録として維持する。

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
