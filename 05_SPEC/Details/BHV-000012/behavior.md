# BHV-000012 ユーザー資格と現行Roleで利用範囲を確定し鍵を交換する

成果物種別: SPEC Detail
Behavior ID: `BHV-000012`
状態: Canonical
確認状態: 最新鍵管理判断を再伝播・限定独立レビュー済み・残指摘0。実画面・実装・E2E成立は未主張。
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 最小ユーザー・Role権限・資格の管理、要求毎の認可、独立失効、鍵交換2操作・2入口を成立させる。
- Source SPEC: [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md)
- 対象利用側: UI-000008／SCR-000008／PRT-000008
- 対象外: 新しいユーザー成果・Authority、一般IAM、回復専用Bootstrap、Role設定修復、採用済み入口以外のAPI・Process・保存Schemaの固定

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 接続／利用要求、ユーザー登録・名前／Role変更・Role権限変更、資格発行、独立失効、指定ユーザー交換／全員交換、または同じ回復への再入場 |
| Precondition | Applicable | 通常鍵操作はWorkbenchの固定administrator、Host交換はログイン済みローカル操作者の対話CLI・既存Root／Pathを確認する。追加認証は不要。交換では既存対象userId・必要資格集合を確認し、全員交換は指定既存administratorを確認する。Hostまたは全員交換だけ明示確認する。他4管理群の割当はOPEN |
| Authority | Applicable | 鍵3操作の固定administrator、他4管理群の未確定割当、内容許可、Host交換を分離する。通常鍵操作は同一Process Workbench backend限定、MCP非公開。認証した資格→ユーザー→一つの現行Roleへ要求毎に結び直し、古い権限を固定しない |
| Input | Applicable | 対象userId、表示専用名、現行Roleと詳細権限、Credential ID／状態、Repository公開・実アクセス、鍵交換操作種別・入口・失効集合・既存発行先・保持情報、確定済みの同じRecovery ID。生Secretを保存・診断入力へ複製しない |
| Validation | Applicable | Effect前に入口Authority、対象Identity、現在の必要状態と確認条件を照合する。対象不明・管理者不存在・安全に確認不能・認可設定破損では新しいEffectを発行しない |
| State／Transition | Applicable | 資格の有効／期限切れ／失効／不明と、利用状態5区分・部分成立、回復の確認待ち／進行中／blocked／completedを分離する。鍵交換は旧失効＋新発行であり、永続resetting／rotating状態を増やさない |
| Sequence | Applicable | 新規発行は対象確認→発行→結果確定・一度だけSecret返却。独立失効は対象確認→失効→結果確定（新発行なし）。交換は4組すべて事前表示→入口条件・必要な明示確認→同じRecoveryへ結合→旧失効→新発行→結果確定→搬送→受領を別段階として扱う |
| Effect | Applicable | 通常管理は最小ユーザー情報・Role設定・非秘密資格／検証情報を更新する。鍵交換は対象の旧資格失効と既存発行先への新資格発行だけであり、ユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataを変更しない |
| Output | Applicable | 許可範囲の自身／管理対象情報と操作別結果。新規発行は発行結果・一度表示Secret、独立失効は失効結果だけ（新発行・Secret・交換再入場なし）、交換は確定失効範囲・発行結果・結果改訂・同じRecovery IDと確認先・新資格再入場先を返す |
| Failure | Applicable | 未認証・未認可・非公開・取得不能・不明、対象競合、Secret再表示要求、管理資格喪失、認可破損、処置後の発行失敗・応答／Process喪失を分ける。許可外User／Repositoryの存在・名前・件数を結果へ含めない |
| Recovery | Applicable | 鍵交換は旧失効前から確定済みの同じRecovery IDへ結合し、種別・入口・対象・既存発行先・既知処置・発行結果を非秘密の耐久情報として保持する。再入場で現在状態を再観測し、記録からAuthority・完了を復元しない。独立失効の不明時は既知状態・確認先を返し、交換の発行／再入場を適用しない |

鍵の発行・独立失効・交換はadministrator専用固定で、RoleのON／OFF設定を設けない。通常鍵操作は同一Process Workbench backendだけで扱い、MCPへ鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで交換2操作だけを扱う。追加認証・専用資格・承認コード・OS管理者昇格は要求せず、既存Root／Path検証を維持し、検証済み範囲外へ越境しない。他4管理群（ユーザー管理・Role設定・Repository登録・公開範囲管理）の担当Role・設定可否はOPENである。

ユーザーは安定userId（UUID）・管理者設定の表示専用名・一つの現行Roleを持つ。名前変更でIdentityやAuthorityを変えない。Role詳細権限はRoleが所有し、ユーザー／資格への個別追加権限を持たせない。Repository単体利用はCredential不要。初回Server設定方式は変更しない。

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
| [SCR-000008／PRT-000008.spec-000012](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | 自身と許可範囲、通常管理・独立失効、2操作の影響と2入口の条件 | 事前停止、失効／発行の別結果、一度表示Secret、部分結果、同じ回復と現在再観測 | 限定レビュー済み・残指摘0 |

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
| 失敗 | 対象不明・管理者不存在・必要状態観測不能・認可破損で新Effect前停止。秘密保存・漏えい、Product Data／Role権限変更をしない | 保持情報の非変更と拒否結果を観測 |
| 結果不明 | 発行失敗・応答／Process喪失の既知失効と発行不明を別に保持 | 不明を成功・rollback・旧鍵有効・取消完了へ畳まない |
| 回復 | 同じIDと非秘密耐久情報を保持し、再入場時は現在再観測・現行Authority確認 | Secret再表示、特別ユーザー／権限追加、回復Bootstrap、記録によるAuthority復元を反証 |

検証では固定administrator以外の通常鍵操作、MCP鍵操作の一覧・Schema・登録・dispatch、Hostの新規発行・独立失効、追加認証要求、検証済みRoot／Path範囲外への操作を反証する。他4管理群の未決割当を暗黙に許可しない。

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
| 他4管理群の担当Role・設定可否 | OPEN | 上流方針Owner・Qual-Lab | 未確定割当の操作を許可しない | 方針確定後にDefinitionから再伝播する時 |

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
