# BHV-000012 ユーザー資格と現行Roleで利用範囲を確定し鍵を交換する

成果物種別: SPEC Detail
Behavior ID: `BHV-000012`
状態: Canonical
確認状態: 最新の権限分担を詳細へ伝播・限定独立レビュー済み・残指摘0。実画面・実装・E2E成立は未主張。
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 最小ユーザー・Role権限・資格の管理、要求毎の認可、独立失効、鍵交換2操作・2入口を成立させる。
- Source SPEC: [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md)
- 対象利用側: UI-000008／SCR-000008／PRT-000008
- 対象外: 新しいユーザー成果・Authority、一般IAM、回復専用Bootstrap、Role設定修復、採用済み入口以外のAPI・Process・保存Schemaの固定

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 接続／利用要求、ユーザー登録・名前／Role変更・Role権限変更、Repository登録・登録解除・公開範囲設定、資格発行、独立失効、指定ユーザー交換／全員交換、または同じ回復への再入場 |
| Precondition | Applicable | 通常管理は下の操作別契約で主体の現行Role・対象・必要状態を確認する。通常鍵操作はWorkbench固定administrator、Host交換はログイン済み操作者の対話CLI・既存Root／Pathを確認し追加認証不要。交換は既存対象・必要資格集合、全員交換の指定既存administratorを確認し、Hostまたは全員交換だけ明示確認する |
| Authority | Applicable | 業務管理manager／administrator、administrator Role変更・詳細権限と鍵3操作のadministrator専用、内容許可、Host交換を分離する。固定分担は内容設定から派生させない。通常鍵操作は同一Process Workbench限定・MCP非公開。要求毎に資格→ユーザー→一つの現行Roleへ結び直す |
| Input | Applicable | 対象userId、表示専用名、現行Roleと詳細権限、Credential ID／状態、Repository公開・実アクセス、鍵交換操作種別・入口・失効集合・既存発行先・保持情報、確定済みの同じRecovery ID。生Secretを保存・診断入力へ複製しない |
| Validation | Applicable | Effect前に入口Authority、対象Identity、現在の必要状態と確認条件を照合する。対象不明・管理者不存在・安全に確認不能・認可設定破損では新しいEffectを発行しない |
| State／Transition | Applicable | 資格の有効／期限切れ／失効／不明と、利用状態5区分・部分成立、回復の確認待ち／進行中／blocked／completedを分離する。鍵交換は旧失効＋新発行であり、永続resetting／rotating状態を増やさない |
| Sequence | Applicable | 新規発行は対象確認→発行→結果確定・一度だけSecret返却。独立失効は対象確認→失効→結果確定（新発行なし）。交換は4組すべて事前表示→入口条件・必要な明示確認→同じRecoveryへ結合→旧失効→新発行→結果確定→搬送→受領を別段階として扱う |
| Effect | Applicable | 通常管理は操作別に最小ユーザー情報・Role内容設定・Repository接続登録／Exposureを更新する。登録≠公開、解除≠Repository／Product Data削除。鍵交換は旧失効＋既存発行先への新発行だけで、ユーザーID・名前・Role・詳細権限・Repository登録・Product Dataを保持する |
| Output | Applicable | 許可範囲の自身／管理対象情報と操作別結果。新規発行は発行結果・一度表示Secret、独立失効は失効結果だけ（新発行・Secret・交換再入場なし）、交換は確定失効範囲・発行結果・結果改訂・同じRecovery IDと確認先・新資格再入場先を返す |
| Failure | Applicable | 未認証・未認可・非公開・取得不能・不明、対象競合、Secret再表示要求、既存administratorの有効Credential全喪失、認可破損、処置後の発行失敗・応答／Process喪失を分ける。許可外User／Repositoryの存在・名前・件数を含めない |
| Recovery | Applicable | 鍵交換は旧失効前から確定済みの同じRecovery IDへ結合し、種別・入口・対象・既存発行先・既知処置・発行結果を非秘密の耐久情報として保持する。再入場で現在状態を再観測し、記録からAuthority・完了を復元しない。独立失効の不明時は既知状態・確認先を返し、交換の発行／再入場を適用しない |

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで扱い、MCPへ鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱う。追加認証・専用資格・承認コード・OS管理者昇格は要求せず、既存Root／Path検証を維持し、検証済み範囲外へ越境しない。manager／administratorがユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministrator専用固定であり、Role内容設定で委譲しない。

ユーザーは安定userId（UUID）・管理者設定の表示専用名・一つの現行Roleを持つ。名前変更でIdentityやAuthorityを変えない。Role詳細権限はRoleが所有し、ユーザー／資格への個別追加権限を持たせない。Repository単体利用はCredential不要。初回Server設定方式は変更しない。

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
| Repository登録・登録解除 | Repository ID・現在登録状態・変更内容 | manager／administrator、変更前の現在認可と対象を確認 | 接続登録だけ更新。登録で公開せず解除でRepository／Product Dataを削除しない | 登録更新結果。公開・内容アクセスの成立を含めない |
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

新規発行: Workbench固定administrator → 対象確認 → 新発行 → 結果確定／Secret一度返却
独立失効: Workbench固定administrator → 対象確認 → 失効 → 失効結果（新発行・Secret・交換再入場なし）

交換: Workbench固定administrator または Hostログイン済み操作者の対話CLI
  → 対象・失効範囲・発行先・保持情報を提示
  → Host入口または全員交換のみ明示確認
  → 前提を現在状態と照合
      ├ 不明／不足／破損 → 新Effect前停止
      └ 成立 → 同じRecoveryへ結合 → 旧資格失効 → 新資格発行 → 結果確定 → 搬送／一度表示Secret → 結果受領 → 新資格で再入場
                     └ 発行失敗・応答喪失・Process喪失
                        → 既知失効／発行不明を同じRecoveryへ耐久保持
                        → 再入場時の現在再観測・Authority再確認
```

通常入口の指定ユーザー交換は追加明示確認を要求しないが、対象・影響の事前提示は行う。処置前中止と、処置後の結果受領不能を分離する。処置後は現在再観測なしに完了・rollback・旧資格利用可能を推定せず、Secret再表示・別Recoveryの重複開始をしない。失効／鍵交換の成立は開始済み操作の取消完了や過去Effect 0を証明しない。

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000008／PRT-000008.spec-000012](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | 自身と許可範囲、通常管理・独立失効、2操作の影響と2入口の条件 | 事前停止、失効／発行の別結果、一度表示Secret、部分結果、同じ回復と現在再観測 | 最新分担の限定独立レビュー済み・残指摘0 |

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
| 失敗 | 対象不明・管理者不存在・必要状態観測不能・認可破損で新Effect前停止。秘密保存・漏えいをせず、鍵操作の失敗ではProduct Data／Role詳細権限を変更しない | 鍵操作の保持情報の非変更と、各操作の事前拒否結果を観測 |
| 結果不明 | 発行失敗・応答／Process喪失の既知失効と発行不明を別に保持 | 不明を成功・rollback・旧鍵有効・取消完了へ畳まない |
| 回復 | 同じIDと非秘密耐久情報を保持し、再入場時は現在再観測・現行Authority確認 | Secret再表示、特別ユーザー／権限追加、回復Bootstrap、記録によるAuthority復元を反証 |

検証では固定administrator以外の通常鍵操作、MCP鍵操作の一覧・Schema・登録・dispatch、Hostの新規発行・独立失効、追加認証要求、検証済みRoot／Path範囲外への操作を反証する。固定8操作のRole別肯否、managerによるadministrator表示名変更許可とRole付与・解除・降格・詳細権限・鍵拒否、developer管理拒否、現在認可不明のEffect前停止を検証する。通常発行の旧失効なし、独立失効の指定Credential–userId一致・指定外失効なし・新資格／Secretなし、交換範囲逸脱なしを反証する。

これは検証義務の導出入力であり、Quality項目・Test・実行Evidenceの成立を示さない。

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: 対象相関、要求毎認可、2操作×2入口、失効と発行の分離、情報保持、秘密一度表示、部分結果と同じ回復・現在再観測。
- 配置を固定してはならない事項: 採用済みWorkbench／Host CLI／MCP非公開境界以外のProcess、Transport、保存方式、Class、Function、秘密保護方式、Frontend／Backend分割。
- Architectureで決める事項: ARCH-000013の責務再編でComponent、Boundary、Data／State OwnerとFailure Boundaryを更新する。旧設計・Sourceは本改訂に未追従であり、本書を実装成立根拠にしない。

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 採用済み入口以外の実装配置・物理保存・秘密保護 | OPEN | Architecture工程 | その他の配置・Store・Schemaは未固定 | Architecture Detailで具体化する時 |
| 有効期限既定値と実利用条件 | OPEN | SPEC／UX Owner・Qual-Lab | 期限・利用頻度・確認負担は未固定 | Pilot／回復実測または前提変更時 |
| 具体API・保存・実画面と本番認可 | OPEN | Architecture／実装・UI工程Owner | 固定分担の設計だけでは本番成立を主張できない | 後続のArchitecture・Source・実境界検証時 |

## 補足分析

現在SPEC Definitionの意味を既存BHVへ詳細化し、旧Role別鍵・Access再構成・Bootstrap再入場を置き換える。限定した詳細契約の更新であり、工程Exit・Architecture／Quality伝播・実装・E2Eの完成ではない。

## Checklist

- [x] Source SPECから導出し、新ID・Authority・Store／Schemaを追加していない
- [x] TriggerからRecoveryまで全観点を評価した
- [x] 独立失効と2操作×2入口、情報保持と秘密境界を区別した
- [x] 正常・境界・失敗・結果不明・回復の反証をQualityへの入力へ接続した
- [x] 利用者認識が必要な結果を既存SCR／PRTへ接続した
- [x] Process喪失と再入場を非秘密耐久情報・同じRecoveryへ接続した
- [x] 未確認事項をOPENとしてOwner・影響・戻り条件とともに残した
