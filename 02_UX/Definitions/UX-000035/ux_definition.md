# UX-000035 User管理なしでRemote Accessを維持・回復する

成果物種別: UX定義
UX ID: `UX-000035`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

CROS管理者がUser Accountを管理せずRole別Credentialを維持し、漏洩・喪失・認可破損後もProduct Dataを失わず通常管理へ戻れる。

```text
CROS管理者／Server Host運用者
        │ Remote利用範囲を用意・回復する時
        ▼
Role別Credentialを安全に維持する
        │
        ▼
User管理なしで接続を継続し、管理不能時も再入場できる
```

## 利用者・状況・目的

| 項目 | 内容 |
|---|---|
| 主な想定利用者／利用状況 | CROS管理者とServer Host運用者が、小規模な共有CROSの接続資格を維持する状況 |
| 利用のきっかけ／場面 | 初期発行、追加発行、失効、ローテーション、漏洩、Administrator全喪失、認可状態破損 |
| 目的 | 個人別User管理なしでRemote利用範囲を維持し、安全に通常管理へ戻る |
| 得られる結果 | Role別Credentialを発行・失効・回復し、利用者へ必要な再設定だけを案内できる |

## 利用者に起きる変化

```text
変更前
個人登録・申請を管理するか、全員へ広すぎるAccessを与える
        ↓
変更後
Role別Credentialだけを管理し、異常時はServer HostからCredential状態を復旧する
```

## 成立条件

- Administrator、Management、DeveloperのRole別Credentialを発行・失効・ローテーションできる。
- Secretは発行時に一度だけ受け取り、再表示やRepository保存をしない。
- Administrator能力とManagement／Development内容へのアクセスを分ける。
- Administrator RecoveryとFull Access ResetをServer Host上の対話操作から実行できる。
- Recovery前に失効対象、Role処置、保持するProduct Dataを確認できる。
- Recovery途中の失敗を成功へ畳まず、同じRecoveryへ再入場できる。
- Repository単体利用へCROS RoleまたはCredentialを要求しない。

## 重要な体験・失敗・品質期待

```text
Credential状態を管理する
        ↓
発行・失効・ローテーションを選ぶ
        │
        ├─ ★ 重要場面: 全Administrator Credentialを失った時
        ├─ ⚠ 失敗: Remote認証へ依存する／Product Dataを削除する／Secretを記録する
        └─ ✓ 守る品質: Host Authorityと明示確認でAccessだけを安全に再構成する
        ↓
Bootstrap Credentialで通常管理へ戻る
```

### 重要な失敗

- Administrator能力からProject内容へのAccessを自動的に得る。
- 生Secretまたは受信可能な同等値を保存・再表示する。
- Access RecoveryでRepositoryやProject Context等のProduct Dataを削除する。
- 途中失敗後に別Recoveryを重ね、失効範囲や再入場先を失う。

### 体験品質への期待

- 日常管理はRoleとCredentialだけで理解でき、User管理を要求しない。
- 破壊的な失効範囲と保持するProduct Dataを実行前に理解できる。
- 秘密値を含めず、Recoveryの現在地と次の行動を追跡できる。

## 必要な情報

Role、Credential ID、Credential状態、有効期限、発行時のSecret一度表示、Repository Role、System管理能力、Recovery Identity、Recovery種別、失効対象、保持対象、結果、再入場方法。

## 責任境界・制約・対象外

- UXが定義すること: 管理者のGoal、通常管理と緊急復旧の体験、失敗、品質期待。
- 下流工程へ残すこと: 情報構造、管理画面／CLI、Digest方式、認証Protocol、耐久記録および実装配置。
- 制約: Administratorと内容Accessを分け、秘密値を正本・Prompt・会話へ複製しない。
- 対象外: User Account、個人別申請、SSO、IdP、個人監査、Multi-tenant IAM。

## 未確認事項と戻り条件

- 未確認事項: 共有Credentialの配布負担、管理画面とCLIの分担、有効期限の既定値。
- 現在判定: Pilotで確認する。現在のUX定義を止める事項ではない。
- 確認事項: 小規模共有Serverで安全性と管理負担の均衡が成立するか。
- 判断者: CROS管理者、Server Host運用者およびQual-Lab。
- 未確認時の影響: 定量的期限、画面配置および配布手順を確定しない。
- Discoveryへ戻す条件: 個人別失効・監査が必要、固定三Roleで運用不能、または共有Secret配布が許容不能な場合。
- UX分析へ戻す条件: Credential lifecycleとAccess Recoveryが一つの管理者成果として成立しない場合。

## 検証意図

User登録なしでRole別Credentialを発行・失効・ローテーションし、全喪失または認可破損からProduct Dataを維持して再入場できることを観測する。Secret非保存、Administratorの内容非保有、途中失敗およびRepository単体非依存を含める。

## 下流への引き渡し

| 接続先 | 保持する意味 |
|---|---|
| IA（直後工程への正式な引き渡し） | Role、Credential metadata、Secret表示境界、Credential状態、管理能力、Recovery Identity、対象・保持範囲、結果、再入場 |
| Quality Analysis / UX（伴走） | User非管理、Secret非保存、Role分離、通常ローテーション、全喪失・認可破損Recovery、Product Data保持 |
| UI（後続Contract Relation） | 発行時一度表示、一覧、失効、再発行、Recovery確認、途中状態、再入場 |
| SPEC（後続Contract Relation） | 発行・Digest保存・検証・失効・期限・ローテーション、Recovery Authority、耐久記録、Effect境界 |

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
