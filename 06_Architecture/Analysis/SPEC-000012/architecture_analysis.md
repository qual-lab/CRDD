# SPEC-000012のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000012`
状態: 更新中（最新の権限分担の入力分析は限定独立レビュー済み・残指摘0）

## 1. 正式入力

- [SPEC-000012 ユーザー資格と現行Roleで利用範囲を確定しAccessを回復する](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md)
- 基準Commit: `ea99450f`

このSPEC Definitionだけを意味の正式入力とする。UX-000013／UX-000035／IA-000009は同Definitionの来歴であり、追加入力ではない。UI、既存設計、Source、Evidenceから不足する意味を補完しない。通常の工程Handoffではなく、採用済み契約への既存設計の是正伝播である。

## 2. 引き継ぐSPEC契約

鍵の発行・独立失効・交換は固定administrator専用で、Role設定のON／OFF対象にしない。通常鍵操作は同一Process Workbench backendだけ。MCPには鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作のみを扱い、追加認証・専用資格・承認コード・OS管理者昇格なし、既存Root／Path検証を維持する。

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

固定管理認可は主体の変更前の現行Roleと上表で判定し、Role詳細の内容設定から派生させない。manager自身の内容範囲変更も、変更前の現在管理認可→明示的なRole内容設定／Exposure更新→次要求で現行Role・Exposure・実アクセス再評価の順に分ける。更新受理や管理能力から内容アクセスを生成せず、administratorにも内容を自動付与しない。

| 対象 | 条件・振る舞い・結果 |
|---|---|
| ユーザー登録 | 予定Role・表示名を確認し、安定userId（UUID）と一つのRoleを登録する。managerはdeveloper／managerのみ指定可能。不存在の新規対象へ既存ID・変更前Roleを要求せず、鍵を自動発行しない |
| 表示名変更 | 対象既存userIdと新表示名を確認し、ID・Role・Credentialを保持する。managerもadministratorの表示名を変更可。名前をAuthorityにしない |
| 既存Role変更 | 対象userId・変更前後Roleを確認する。managerは前後ともdeveloper／managerだけ。administratorの付与・解除・降格はadministratorのみ。userIdとCredential結合を保持する |
| Role内容設定 | 対象Role・設定内容を確認し、managerはdeveloper／manager、administratorは三Roleを変更可。固定管理分担とユーザー／資格への個別追加権限は変更しない |
| Repository登録・登録解除 | manager／administratorが対象ID・現在登録状態・変更内容を確認し接続登録を更新する。登録だけでは公開せず、解除でRepository／Product Dataを削除しない |
| Repository公開範囲 | manager／administratorが対象ID・現在登録／公開状態・変更内容を確認しExposureを更新する。次要求で内容認可と実アクセスを別判定する |
| 認証・認可 | Credential→userId→現行Roleを結び、管理要求には固定分担、内容要求にはRole内容設定・Repository Exposure・実アクセスを適用する。古い権限を資格／Sessionに固定しない |
| 新規発行 | 同一Process Workbenchの固定administrator操作で既存userIdへ発行し、新Secretを一度返す。旧失効・交換Recovery再入場は伴わない |
| 指定ユーザー交換 | 対象既存userIdの全旧有効資格を失効し、同じuserIdへ新資格を発行。その他のユーザーの鍵を保持 |
| 全員交換 | 全ユーザーの全旧有効資格を失効し、指定既存administrator userIdへ新資格を発行。他ユーザーへの通常再発行・再配布は管理者が行う |
| 2入口 | 通常入口は同一Process Workbenchの固定administrator、Host入口はログイン済みローカル操作者の対話CLI。Host入口または全員交換だけ人間の明示確認を要求する |
| 独立失効 | Workbenchの固定administratorと対象を確認し、以後の要求で拒否する。新発行・Secret・交換再入場なし。結果不明は既知対象・状態と確認先を返す。開始済み取消やEffect 0の証明ではない |
| 保持・制約 | 鍵交換でuserId・表示名・Role・詳細権限・Repository登録・Product Dataを保持。特別ユーザー・追加権限・回復専用Bootstrap・認可設定破損修復を追加しない |
| 状態 | 利用5区分と部分成立、資格の有効／期限切れ／失効／不明、回復の確認待ち／進行中／blocked／completedを区別。永続resetting／rotationを増やさない |
| 可視性・秘密 | 自身表示可、非認証User情報0、現在他ユーザー参照を許可されていない主体の他User一覧・存在・件数0。非開示Repository保護。生Secretは発行／交換後だけ一度返し、保存・ログ・Evidence・会話へ複製しない |

単体利用の資格不要と初回Server設定方式は不変。API、UI配置、秘密Store、UUID版・生成方式、表示名構文、期限、保存Schemaはこの分析で確定しない。

## 3. Lifecycle・失敗・回復

| 段階 | 事前条件・確定事実・終了条件 |
|---|---|
| 通常管理の処置前 | 操作別の対象・変更内容と変更前の現在管理認可を確認する。新規登録は予定Role、既存Role変更は前後Role、名前変更は既存userId、内容設定は対象Role、Repository管理は対象IDと現在登録／公開状態を用いる。交換専用の対象集合・確認を一律要求しない |
| 鍵処置前 | 発行は既存userId、独立失効は対象Credentialと既存userIdの結合、交換は対象既存ID・必要資格集合・現行権限・入口Authorityと必要な明示確認を確認する。全員交換の発行先は指定既存administratorに限定する |
| 通常管理の処置前停止 | 対象・変更前の現在管理認可・操作に必要な状態を安全に確認不能、または認可破損では新Effectを発行しない。manager許可操作へadministrator存在条件を追加しない |
| 鍵処置の処置前停止 | 操作固有の既存対象・CredentialとuserIdの結合・必要資格集合・全員交換の指定既存administrator等が不明・不成立なら新鍵Effectを発行しない。通常入口は固定administrator、Hostはログイン済み操作者の既存Authorityを用い、追加資格認証を要求しない。中止と処置後の結果不明を区別する |
| 交換の相関 | 旧失効前に同じRecovery ID・種別・入口・対象・既存発行先へ結合し、失敗・耐久記録・再入場まで保持する。新規発行・独立失効へ交換Recoveryを追加しない |
| 交換の失効・発行 | 旧資格失効、新資格発行、結果確定・記録、結果搬送、結果受領を別段階で観測する |
| 失効後の発行失敗・応答／Process喪失 | 確定した失効範囲と発行不明を非秘密の耐久情報として同じRecovery IDへ保持する |
| 再入場 | 同じID・種別・対象へ戻り、現在状態を再観測し現在Authorityを再確認する。保存記録からAuthorityや完了を復元しない |
| 終了結果 | 現在再観測なしに完了・rollback・旧鍵有効・取消完了を推定しない。Secretを再表示しない |

副作用はユーザー情報・Role内容設定・Repository接続登録／Exposure・非秘密資格情報／照合情報・失効・回復記録の更新に限定する。鍵交換自体はユーザー情報・Role・権限・Repository登録・Product Dataの保持境界を変更しない。通常管理の結果不明も成功・失敗へ補完せず、現在状態を確認して再処置するが、交換専用Recoveryを追加しない。失効／交換の成功は開始済み操作の取消完了や過去Effect 0を証明しない。

## 4. Architecture評価と処置

既存[ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md)を更新する。認証・要求認可・ユーザー／Role／資格・回復状態のOwnerはAccess Management、認可済み対象のContext集約はDomain Modelへ分ける。新Framework・汎用Registry・Storeを追加する指示ではない。

| 観点 | 評価・引き渡し |
|---|---|
| Boundary／Component／Interface | 公開入口は現在の認可を迂回させず同じ契約を搬送する。Transport LifecycleやContext意味を認可Ownerへ集約しない |
| Data／State Ownership | 名前／ID／Role詳細権限／資格／Exposure／取得可能性を別に保持。要求認可は現在値で判断する |
| Failure／Recovery | 同じRecovery、既知失効と発行不明、Process喪失後の非秘密耐久情報と現在再観測を接続する |
| Security／Trust／品質 | 管理と内容、三可視境界、秘密非保存、未知の正常化禁止、取消非証明を反証する |
| 検証意図 | 固定8操作の三Role許可／拒否、操作別対象、managerのadministrator名前変更許可／Role・詳細権限・鍵拒否、developer管理拒否≠自身表示・許可内利用拒否、自己範囲変更の時間順、登録≠公開、解除≠削除をQualityへ渡す。通常発行の旧資格非失効、独立失効の指定対象外非失効・新資格／Secret非発行、交換の所定失効範囲、同名／改名、2操作×2入口、処置前停止・処置後不明・現在再観測なしの完了／権限復元／Secret再表示も反証する |

## 5. 未確認事項と統合

| 継承事項 | 判断者・再評価契機 | 未確認時の扱い |
|---|---|---|
| 自身表示名と安定ID、現行範囲・利用不能理由、接続負担・失敗後選択 | 代表利用者・Qual-Lab。実利用／前提変更時 | 定量条件・具体導線を確定しない |
| 対象識別とリセット確認負担、採用済みWorkbench／Host CLIの具体表示・案内、有効期限既定値 | 管理者・Host運用者・Qual-Lab。Pilot／回復実測時 | 期限・画面・配布手順を確定しない |

追加の採用判断は不要だが、継承Openは未解消。対応UI-000008との統合で契機・結果・Failure・Authority・Effect・状態を一件ずつ照合する。意味不足や競合はSPECとその来歴Ownerへ戻し、現行Sourceから埋めない。

## Checklist

今回の検証意図は通常鍵3操作の固定administrator、MCP鍵操作非公開、Host新規発行・独立失効なし、追加Host認証なし、交換4組表示・3組確認、対象不明・管理者不存在・安全な観測不能・認可破損のEffect前停止を含む。通常×指定交換へ追加確認を作らない。Quality Local Itemや実測結果はこの分析で確定しない。

- [x] 自身のSPEC Definitionだけを正式意味入力とした
- [x] 契機・条件・Authority・入力・状態・結果・Effectを保持した
- [x] 責務・Component・Interface・データOwner・外部境界を評価した
- [x] 失敗・回復・Process喪失・耐久相関・終了後観測を評価した
- [x] Security・品質・検証意図、Human InputとOpenを保持した
- [x] Sourceから意味を逆輸入せず、UIとの統合確認を示した
- OPEN: ARCH-000013・横断モデル・Architecture詳細・Quality・Sourceは最新分担へ未追従。前判断の限定Passは履歴であり、今回の分析候補のPassではない。工程Ready・実装・E2E成立を主張しない。
