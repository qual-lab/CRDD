# UI-000008 ユーザー・Role権限・接続資格とAccess回復

成果物種別: UI定義
UI ID: `UI-000008`
状態: Canonical（今回変更範囲の限定独立レビュー済み）
維持責任者: Qual-Lab

## 利用者成果と統合判断

| 正式入力と変換根拠 | 保持する成果・情報 | UIで成立させる対応 |
|---|---|---|
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)／[UX分析](../../Analysis/UX-000013/ui_analysis.md) | Roleで許可されたRepositoryだけをRemote利用する | 自身、現行Role権限、公開対象、実アクセスと部分成立を見分け、許可内の対象を選ぶ |
| [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)／[UX分析](../../Analysis/UX-000035/ui_analysis.md) | 最小ユーザー管理で接続を維持・回復する | 対象ID・表示名・Role・資格状態、処置影響、一度表示Secret、両Host回復種別と再入場を認識する |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)／[IA分析](../../Analysis/IA-000009/ui_analysis.md) | 同一性・関係・可視性・導線 | 各情報を独立して見分け、名前をAuthorityへ昇格せず通常管理とHost回復を分ける |

両観点を統合して認識・操作・Feedbackを定義する。ユーザーIDのUUID制約は正式入力から継承し、版・生成方式・Schemaを決めない。

## 表示面と情報の優先順位

| 対象 | 保持する意味・関係 |
|---|---|
| ユーザー | 安定userId、表示専用名、一つの現行Role。同名・改名はIdentity／Authority変更ではない |
| 接続資格 | Credential ID→userId。生Secretを含めず、古いRole権限を固定しない |
| Role／Role詳細権限 | administrator／manager／developer。詳細権限はRoleが所有し、ユーザー・資格への個別追加権限なし |
| Repository Exposure | Repository IDと公開対象範囲。Role権限・実アクセスとは別 |
| 実アクセス可能性 | Repository IDと現在の取得可能性。不明・取得不能を利用可能にしない |
| 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Roleへ結び直す |
| Repository情報範囲／リポジトリ | Repository IDと情報責務・内容正本。利用者Roleや公開設定ではない |
| 管理能力 | 現行Roleの管理許可。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／通常リセット後だけ一度表示。永続Identityを作らない |
| 接続資格状態 | 有効／期限切れ／失効／不明。リセット専用の永続状態は作らない |
| Access Recovery | 同じRecovery IDとAdministrator Recovery／Full Access Resetの種別属性 |
| Recovery対象／保持対象／結果 | 種別に結合した対象・Role影響、変更しないProduct Data、結果改訂・再入場先 |

| 利用場面 | 優先する情報 | 次の導線 |
|---|---|---|
| 通常利用 | 自身表示名、現行利用範囲・状態・部分可視 | 資格→ユーザー→現行Role権限→公開対象→実アクセス→情報源 |
| 通常管理 | 対象ID・表示名・Role・詳細権限・資格状態と処置影響 | 対象→現行値→登録／変更／発行／リセット→結果 |
| 緊急回復 | Administrator Recovery／Full Access Reset、対象・Role影響・保持範囲・現在地 | Host確認→種別・処置範囲→同じRecovery→Bootstrap再入場 |

名前の一致だけで対象を変えない。重要な不足・不明・制限と判断要否を詳細へ隠さない。

## 操作とFeedback

| 操作・場面 | 認識可能にする内容 | 避ける誤認 |
|---|---|---|
| 接続・再認証・Repository選択 | 現在の自身と許可・公開・実アクセス、結果と安全な次行動 | 認証だけで全内容へアクセス可能、部分可視を全体成立 |
| ユーザー登録、表示名／Role変更 | 対象IDと表示名、現行値・変更影響・結果 | 名前が本人性や権限、古いRoleの固定 |
| Role詳細権限の維持 | 対象Roleと許可範囲・変更影響・結果 | ユーザーや資格の個別追加権限 |
| 資格発行／通常リセット | 対象ID・Role、旧資格への影響、新Secret一度表示と結果 | ID・Role変更、旧資格使用可能、開始済み操作取消完了 |
| 独立した資格失効 | 対象資格・管理認可、失効結果、以後の要求拒否、結果不明時の既知状態と確認先 | 新資格の自動発行、リセットや取消完了との同一視 |
| Host回復 | 2種別の対象・Role影響・保全・結果・同じIdentityと再入場先 | Remote管理Authorityとの同一視、一律回復、Product Data削除 |

Secretは発行／通常リセット後だけ一度表示し、一覧・履歴・会話・Evidence・Repositoryへ保存／再表示しない。回復操作の具体的な画面／CLI分担は未確定で、通常Remote入口からHost回復の実行能力を推定しない。

## 状態と表示差

| 軸 | 表示上の区別 |
|---|---|
| 利用状態 | 利用可能／資格要求／制限／利用不能／不明 |
| 複数対象 | 一部だけ利用可能を別の部分成立として示す |
| 資格状態 | 有効／期限切れ／失効／不明。永続resettingやrotation状態を追加しない |
| 回復状態 | 確認待ち／進行中／blocked／completed、選択種別と同じRecovery ID |
| 可視性 | 自身表示可／非認証User情報0／非管理者の他User一覧・存在・件数0 |

Repository非開示対象の存在・名前・件数を理由表示でも漏らさない。未観測・古さ・競合を空や不存在へ丸めない。通常リセットの完了を開始済み操作の取消表示に使用しない。

## 視覚表現とアクセシビリティ

対象名・状態語・意味順で情報を区別し、色だけに依存しない。結論・重大な不足・主要操作・根拠・詳細の順を視覚順と読上げ順で保つ。キーボードと文字表示だけで対象確認・判断・戻り先へ到達できるようにする。部品・レイアウト・具体VariantはDetailで比較・評価する。

## 制約

管理能力は内容閲覧権限ではない。表示名をログイン名・本人確認・Authorityとして扱わず、メール・Password・自己登録・自己編集・SSO・一般IAM・複数Role・個別追加権限を追加しない。Repository単体利用にCredentialを要求しない。UI独自の正本・業務規則・状態Storeを作らない。

## UI／SPEC対応レビューへ渡す項目

| 対応単位 | UIの操作・Feedback | SPECで対応させる条件・結果 |
|---|---|---|
| 利用・自身表示 | 自身と許可内Repository、非成立・部分成立 | 資格→ユーザー→現行Role、公開・取得の別判定と三可視境界 |
| 通常ユーザー／Role管理 | 対象・現行値・変更影響・結果 | 管理認可、ID維持、Role権限と名前の分離、次認可反映 |
| 通常リセット | 旧資格拒否、新Secret一度表示、ID／Role保持 | 対象相関・失効／発行の確定、取消保証との分離 |
| 独立した資格失効 | 対象と失効結果、結果不明時の確認先 | 現行管理認可、以後の要求拒否、新発行なし、開始済み取消非証明 |
| Host回復2種別 | 対象・Role影響・保全・結果・再入場 | 別Host Authority、同じRecovery、種別ごとの具体処置と未決処置 |

- pairs_with: [SPEC-000012](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md)

SPECを正式入力にせず、同じUX／IAから独立に導いた条件・結果と照合する。

## 未確認事項・人間判断・戻り条件

| 継承元 | 未確認事項 | 判断者・再評価契機 | 未確認時の影響 |
|---|---|---|---|
| UX-000013 | 自身表示名と安定ID、現行Role範囲・利用不能理由の理解、接続負担・失敗後の選択 | 代表利用者・Qual-Lab。実利用確認／前提変更時 | 定量条件と具体導線を確定しない |
| UX-000035 | 対象識別とリセット確認の負担、管理画面／CLI分担、有効期限既定値 | 管理者・Host運用者・Qual-Lab。Pilot／回復実測時 | 期限・画面・配布手順を確定しない |
| UX-000035 | Bootstrap-user結合、緊急時ユーザー情報処置 | Host運用者・Qual-Lab。SPEC Detailで処置範囲を具体化する前 | 通常リセットのID保持を緊急回復へ流用しない |

UUIDは採用済み継承制約として保持し、版・生成方式・Schemaはこの工程で決めない。表示名構文・正規化・一意性、物理保存形式も先取りしない。新しい本人確認・自己管理・複数Role・個別追加権限が必要ならDiscovery／UXへ戻す。正式入力の不足や競合は意味のOwnerへ戻し、現行Sourceから補完しない。

両回復種別の具体失効集合はSPECで確定する。対象識別、一度表示Secret、処置前確認の理解が成立しない場合はUI Detail／UXへ戻す。追加の採用判断はないが、継承Openが解消したとは扱わない。

## 検証意図

同名・改名でも対象IDと権限を誤認しないこと、三可視境界、Role／公開／実アクセスと部分成立、通常リセットの影響・秘密一度表示・取消非証明を確認する。両Host Recovery種別の対象・Role影響・保全・結果・再入場を見分けられることをQualityへ渡す。

## 完了境界

今回のDefinition直接伝播の候補である。UI Detail、Visual、横断投影、対応レビュー、Architecture／Quality／Sourceは未追従であり、UI Ready・実装完成・E2E Passを主張しない。過去Evidenceは当時の記録として維持する。

## 補足定義

なし。

## Checklist

- [x] UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Surface ResponsibilityとInformation Priorityを定義した
- [x] Presentation、Interaction、Visible StateおよびFeedbackを定義した
- [x] Error・Recovery Presentationを評価した
- [x] AccessibilityとVariantの必要性を評価した
- [x] Failure・Risk、ConstraintおよびNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するSPECとのRelationを明示した
- [x] Behavior Rule、Architecture方式またはSource実装を先取りしていない
- [x] Visual ArtifactだけでContractを代替していない
- [x] 補足定義へ必須情報を退避していない
