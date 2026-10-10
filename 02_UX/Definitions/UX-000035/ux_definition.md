# UX-000035 軽量なユーザー管理でRemote Accessを維持・回復する

成果物種別: UX定義
UX ID: `UX-000035`
状態: Canonical（鍵交換2操作の限定独立レビュー済み）
維持責任者: Qual-Lab

## 利用者成果

管理者が対象ユーザーを見分け、最小ユーザー情報・Role権限・Credentialを維持し、資格の漏洩・喪失後もProduct Dataを失わず通常管理へ戻れる。

```text
CROS管理者／Server Host運用者
        │ Remote利用範囲を用意・回復する時
        ▼
対象ユーザーとRole権限・Credentialを安全に維持する
        │
        ▼
軽量な管理で接続を継続し、管理不能時も再入場できる
```

## 利用者・状況・目的

| 項目 | 内容 |
|---|---|
| 主な想定利用者／利用状況 | CROS管理者とServer Host運用者が、小規模な共有CROSの接続資格を維持する状況 |
| 利用のきっかけ／場面 | ユーザー登録、表示名／Role変更、資格発行・鍵交換、漏洩、管理資格全喪失 |
| 目的 | 誰向けの資格かを把握し、最小管理でRemote利用範囲を維持し、安全に通常管理へ戻る |
| 得られる結果 | ユーザーの資格を発行・リセット・回復し、利用者へ必要な再設定だけを案内できる |

## 利用者に起きる変化

```text
変更前
個人登録・申請を管理するか、全員へ広すぎるAccessを与える
        ↓
変更後
安定ID・表示名・Roleで対象を識別し、管理不能時はHostから既存管理者の鍵を交換し、ユーザー情報・Role・権限設定は保持する
```

## 成立条件

- ユーザーIDを作成し、管理者が表示名とRoleを設定・変更し、ユーザーのCredentialを発行・リセットできる。
- 標準Roleは`administrator`／`manager`／`developer`とし、詳細権限はRoleが所有する。ユーザーやCredentialへ個別追加権限を持たせない。
- 表示名の同名・改名でIDや権限が変わったと誤認せず、本人確認にも使わない。
- リセットでID・Roleを保持し旧資格を以後の要求で拒否する。開始済み操作の取消完了とは区別する。
- Role権限変更は次の認可へ反映し、Credentialへ古い権限を固定しない。
- Secretは発行時に一度だけ受け取り、再表示やRepository保存をしない。
- Administrator能力とManagement／Development内容へのアクセスを分ける。
- 鍵交換は「指定ユーザーの鍵交換」と「全員の鍵を無効化して指定既存管理者へ再発行」の2操作とする。通常管理とHost回復はAuthorityと入口を分け、鍵交換の意味は共通にする。
- 処置前に対象ユーザーID・表示名、失効範囲、新資格の発行先と保持する情報を確認できる。Host入口と全員交換は人間が明示確認する。
- Recovery途中の失敗を成功へ畳まず、同じRecoveryへ再入場できる。
- Repository単体利用へCROS RoleまたはCredentialを要求しない。

## 重要な体験・失敗・品質期待

指定ユーザー交換はそのユーザーの旧有効資格すべてを失効して新資格を一度発行し、他ユーザーの鍵を維持する。全員交換は全旧有効資格を失効し、指定した既存administratorへ新資格を一度発行する。その管理者が他ユーザーへ再発行・再配布するまで、他ユーザーは旧資格で接続できない。表示名ではなくuserIdで対象を固定する。

失効後の発行失敗・応答喪失・Process喪失では、既知の失効範囲と発行結果の不明を同じRecoveryに保持し、利用者へ安全な確認先を示す。再入場時は現在状態を再観測し、再観測なしに完了・rollbackへ畳まない。旧資格が使える、処置が取り消された、開始済み操作も取消済みと説明せず、Secretを再表示しない。初回Server設定の方式はこの鍵交換の整理では変更しない。

```text
Credential状態を管理する
        ↓
対象ユーザーを確認し、表示名／Role変更・資格リセットを選ぶ
        │
        ├─ ★ 重要場面: administrator Roleのユーザー資格をすべて失った時
        ├─ ⚠ 失敗: Remote認証へ依存する／Product Dataを削除する／Secretを記録する
        └─ ✓ 守る品質: Host Authorityと明示確認でユーザー・Role・権限を保持し、鍵だけを交換する
        ↓
指定した既存管理者の新Credentialで通常管理へ戻る
```

### 重要な失敗

- Administrator能力からProject内容へのAccessを自動的に得る。
- 生Secretまたは受信可能な同等値を保存・再表示する。
- Access RecoveryでRepositoryやProject Context等のProduct Dataを削除する。
- 途中失敗後に別Recoveryを重ね、失効範囲や再入場先を失う。

### 体験品質への期待

- 日常管理はID・表示名・Role・Credentialだけで理解でき、メール・Password・申請等を要求しない。
- 処置前に対象のIDと表示名、変更するRoleまたはリセットの影響を確認できる。
- 破壊的な失効範囲と保持するProduct Dataを実行前に理解できる。
- 秘密値を含めず、Recoveryの現在地と次の行動を追跡できる。

## 必要な情報

ユーザーID、表示名、自身表示／管理対象一覧の可視範囲、Role詳細権限、Credential ID、Credential状態、有効期限、発行時のSecret一度表示、Repository Role、System管理能力、Recovery Identity、Recovery種別、失効対象、保持対象、結果、再入場方法。

## 責任境界・制約・対象外

- userIdは採用済みのUUID制約を保持する。UUID版・Schema・生成方式はUX／IAでは決めない。
- UXが定義すること: 管理者のGoal、通常管理と緊急復旧の体験、失敗、品質期待。
- 下流工程へ残すこと: 情報構造、管理画面／CLI、Digest方式、認証Protocol、耐久記録および実装配置。
- 制約: Administratorと内容Accessを分け、秘密値を正本・Prompt・会話へ複製しない。
- 対象外: 最小情報を超える一般アカウント管理、本人確認、メール・Password・自己登録・自己編集・申請、SSO／IdP、個人行動監査製品。
- 非管理者へ他ユーザー情報を開示せず、Remote管理能力とHost Recovery Authorityを同一視しない。

## 未確認事項と戻り条件

- 未確認事項: 対象識別とリセット確認の負担、管理画面とCLIの分担、有効期限の既定値。
- Host回復でも既存ユーザーIDへ資格を結び、ユーザー情報・Role・詳細権限・Repository登録・Product Dataを保持する。特別な回復ユーザー・権限を作らない。管理者不存在・対象不明・認可設定破損では処置前停止する。
- 現在判定: Pilotで確認する。現在のUX定義を止める事項ではない。
- 確認事項: 小規模共有Serverで安全性と管理負担の均衡が成立するか。
- 判断者: CROS管理者、Server Host運用者およびQual-Lab。
- 未確認時の影響: 定量的期限、画面配置および配布手順を確定しない。
- Discoveryへ戻す条件: 本人確認・自己管理・申請、複数Role、個別追加権限または個人行動監査が必要な場合。
- UX分析へ戻す条件: Credential lifecycleとAccess Recoveryが一つの管理者成果として成立しない場合。

## 検証意図

管理者が対象IDと表示名を区別して登録・変更・鍵交換し、同名・改名で認可が変わらず、ID・名前・Role・権限が保たれて旧資格が拒否されることを観測する。指定ユーザー／全員の処置範囲と通常／HostのAuthority差、管理資格全喪失から指定既存管理者への再発行、認可設定破損での処置前停止を確認する。Secret非保存、Administratorの内容非保有、失効後の発行失敗・応答喪失・Process喪失時の既知処置保持、同じRecoveryへの再入場と再観測なしの完了・rollback拒否、Repository単体非依存を含める。

## 下流への引き渡し

| 接続先 | 保持する意味 |
|---|---|
| IA（直後工程への正式な引き渡し） | ユーザーID、表示名、自身／管理対象の可視範囲、Role詳細権限、Credential metadata、Secret表示境界、Credential状態、管理能力、Recovery Identity、対象・保持範囲、結果、再入場。対象1人と全員の鍵交換範囲、通常管理とHost入口のAuthority差、既存ユーザーへの結合、情報・Role・権限保持、結果と再入場を保持する |
| Quality Analysis / UX（伴走） | 名前非Authority、通常リセットのID・Role保持と旧資格拒否、Role変更の次認可反映、Secret非保存、Role分離、Host回復でのRole設定保持とCredential交換、Product Data保持。対象1人と全員の鍵交換範囲、通常管理とHost入口のAuthority差、既存ユーザーへの結合、情報・Role・権限保持、結果と再入場を検証する |
| UI（後続Contract Relation） | 管理者の対象識別・表示名／Role変更・リセットの影響確認、発行とリセット後の新Secret一度表示、一覧・失効、Host Recovery確認、途中状態、既存管理者への資格再発行後の再入場。対象1人と全員の鍵交換範囲、通常管理とHost入口のAuthority差、既存ユーザーへの結合、情報・Role・権限保持、結果と再入場を保持する |
| SPEC（後続Contract Relation） | ユーザー相関、名前非Authority、Role権限変更、発行・Digest保存・検証・失効・期限・リセットと旧資格拒否、Host Recovery Authority、耐久記録、Effect境界。対象1人と全員の鍵交換範囲、通常管理とHost入口のAuthority差、既存ユーザーへの結合、情報・Role・権限保持、結果と再入場を保持する |

## 関係

- 元の要求分析: [REQ-000041](../../Analysis/REQ-000041/ux_analysis.md)
- 製品全体の整理: [想定利用者](../../02_Personas.md)、[利用体験の全体像](../../03_Experience_Map.md)、[サービス提供の流れ](../../04_Service_Blueprint.md)、[体験品質として守ること](../../05_Quality_Expectations.md)

## Checklist

- [x] UX IDと表題から独立した利用者成果を識別できる
- [x] 定義単独で利用者、利用場面および前後の状況を理解できる
- [x] 利用者の目的を理解できる
- [x] 得られる結果をUI操作ではなく独立した利用者成果として表現した
- [x] 利用前後の変化を必要な範囲で説明した
- [x] 成立条件を観察可能な意味で説明した
- [x] 重要場面を処置した
- [x] 重要な失敗を処置した
- [x] 体験品質への期待と必要性を処置した
- [x] 必要な情報をIAへ引き渡せる
- [x] UXが所有する責任と下流へ残す判断を区別した
- [x] 制約と対象外を保持した
- [x] 未確認事項と影響を明示した
- [x] 人間による評価または確認の必要性を評価した
- [x] 検証意図を具体的なTest Caseへ先取りせず定義した
- [x] IAへの正式な引き渡しを明示した
- [x] Quality Analysis / UXへの伴走入力を明示した
- [x] UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した
- [x] IAがUX Analysisを読み直さずDefinitionから開始できる
- [x] 下流成果物、Architectureまたは現行実装をUXへ逆輸入していない
- [x] DiscoveryまたはUX分析へ戻す条件を明示した
- [x] 補足定義へ必須情報を退避していない
