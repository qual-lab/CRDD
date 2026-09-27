# REQ-000041の利用者体験分析

成果物種別: UX分析

状態: UX再統合済み・独立再レビュー待ち
分析対象: [REQ-000041 Role別共有CredentialによるRemote CROS利用](../../../01_Discovery/Definitions/REQ-000041/requirement.md)

## 1. 要求の一次分析

```text
Remote CROSでは利用範囲を分けたい
        ↓
個人別User管理は導入・運用が重い
        ↓
利用者に必要なこと
利用者登録なしで適切な範囲へ接続し、管理者は接続資格を安全に維持・回復する
```

本要求には二つの独立した利用者成果がある。Remote利用者は一度受け取った接続資格で許可範囲だけを継続利用したい。CROS管理者はUser Accountを管理せず、Role別の接続資格を発行・失効・復旧したい。Repository単体利用へCROS認証を持ち込まないことは両成果の共通制約である。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Remote利用範囲の分離を個人別User管理で実現すると、導入・管理画面・申請・監査が現在目的に対して重くなる |
| 利用者に必要なこと | Remote利用者はRoleに対応する範囲だけを使い、管理者は共有Credentialを安全に発行・失効・回復する |
| 対象範囲 | 三Role、Role別共有Credential、通常ローテーション、Server HostからのAccess Recovery |
| 対象外 | User Account、個人別申請・承認、SSO、Multi-tenant IAM、Repository単体利用への認証強制 |

## 2. 利用者・目標・成果

```text
Remote利用者                         CROS管理者
    │ 接続する                          │ 利用範囲を維持する
    ▼                                  ▼
Role範囲だけを利用する             User管理なしでCredentialを管理する
    │                                  │
    ▼                                  ▼
再選択なしで安全に再接続する       漏洩・喪失後も通常管理へ戻る
```

| 項目 | 内容 |
|---|---|
| 主な想定利用者 | Remote CROS利用者、CROS管理者 |
| 関係する利用者 | Server Hostの管理Authorityを持つ運用者、Credentialを安全な別経路で受け取る利用者 |
| 利用場面 | 初回設定、再接続、発行、失効、ローテーション、Administrator全喪失または認可状態破損 |
| 目的 | User管理なしでRemote利用範囲を分け、管理不能時もProduct Dataを失わず復旧する |
| 得られる結果 | 利用者はRoleを毎回選ばず許可範囲だけを使い、管理者はCredential lifecycleを安全に閉じられる |
| この要求に固有の差 | Credentialは人ではなくRoleへ紐づき、Administrator能力と内容閲覧を分け、緊急復旧をRemote認証から切り離す |
| 根拠・確信度 | REQ-000041で人間確認済み。共有Secretの実運用負担はPilotで確認する |

## 3. 利用者に起きる変化

```text
変更前
個人別登録・申請を作るか、Server接続者へ広すぎる範囲を与える
        ↓
変更後
管理者がRole別Credentialを発行し、利用者は一度設定して許可範囲だけを利用する
管理不能時はServer HostからCredentialだけを安全に再構成する
```

Repositoryを直接利用できる人は従来どおりFilesystem／Git Accessの範囲で作業する。CROS Roleは同一Repository内のファイルを隠す仕組みにしない。

## 4. 利用者成果への統合

```text
REQ-000041
   ├─ Same → UX-000013 許可された作業領域だけをリモート利用する
   └─ New  → UX-000035 User管理なしでRemote Accessを維持・回復する
```

| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 許可された作業領域だけをリモート利用する | `Same → UX-000013` | Remote利用者が許可範囲だけを使い、非開示対象を推測しない成果は同じ | Workspace Grant方式を三Roleの共有Credential方式へ置き換える |
| User管理なしでRemote Accessを維持・回復する | `New → UX-000035` | 発行・失効・ローテーション・緊急復旧は、Remote利用者の閲覧成果とは異なる管理者の独立したGoal／Outcomeである | Credential lifecycle、Secret一度表示、Digest保存、Bootstrap再入場、Product Data保持 |

### Same判断の比較

#### 許可された作業領域だけをリモート利用する

比較対象: `UX-000013`

| 比較軸 | 既存UX | 現在の要求 | 差と統合判断 |
|---|---|---|---|
| 担い手 | Remote利用者 | Developer／Managementとして接続するRemote利用者 | Role名は増えるが成果の主体は同じ |
| 利用のきっかけ | Remote接続・再接続 | Role別Credentialの初回登録・再接続 | Credential方式の具体化である |
| 得られる結果 | 許可された範囲だけを利用できる | Roleが許すRepository Contextだけを利用できる | 同じ利用者成果である |
| 避ける失敗 | 非開示対象の存在・内容漏えい | Role外Repositoryの存在漏えい、Administratorからの内容権限推定 | 同じ失敗類型を補強する |

統合理由: Role別共有CredentialはUX-000013の実現境界を置き換えるが、Remote利用者が得る成果は変えない。

## 5. 重要な体験

### この要求での利用の流れ

```text
管理者がRole別Credentialを発行する
        ↓
利用者が秘密値を一度登録して接続する
        ↓
Role範囲だけを利用する
        │
        ├─ ★ 重要場面: 漏洩・全喪失・認可破損を検出した時
        ├─ ⚠ 失敗: User管理へ拡張する／秘密値を保存・再表示する／Product Dataを消す
        └─ ✓ 守る品質: 通常失効とServer-local Recoveryを分け、安全な再入場を示す
        ↓
新Credentialを配布し通常管理へ戻る
```

### サービス提供の流れの処置

処置: `作成`

```text
【利用者・責任者】CROS管理者／Remote利用者
        │ 発行・受領・接続・失効・復旧
        ▼
【利用者接点】Workbench管理画面または管理CLI／接続設定
        ├─ 時間差: 発行・配布・登録・接続、失効要求・失効確定、Recovery開始・終了後確認を分ける
        ├─ 完了時: Credential ID、Role、状態、期限、次の配布・接続手順
        └─ 失敗時: 秘密値を再表示せず、失効・再発行・Host Recoveryへの安全な導線
                     ↓
             【回復・判断する人】CROS管理者またはServer Host運用者
                     └─ 次の行動: 通常失効・再発行、または同じRecovery IDでHost Recoveryへ再入場する

---------------- 可視境界 ----------------
                     │ 時間関係: Remote利用とHost RecoveryのAuthority・開始・完了を分ける
                     ↓
【提供側】CROS Access管理能力
        └─ Userを作らず、Secret Digest、Role、状態、Recovery記録を管理する
```

### 製品全体の整理への接続

- 利用の流れの統合先: [リモートで情報と結果へ戻る](../../03_Experience_Map.md#リモートで情報と結果へ戻る)
- サービス提供の流れの統合先: [共同のサービス提供の流れ](../../04_Service_Blueprint.md#1-共同のサービス提供の流れ)

### この要求での責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Remote利用者 | 渡されたCredentialを秘密値管理へ保存し、漏洩時に利用を止める | RoleやRepository範囲を自己申告で拡張しない |
| CROS管理者 | Role別Credentialを発行・失効・ローテーションする | User Accountを作らず、Administrator能力から内容閲覧を得ない |
| Server Host運用者 | Remote認証不能時にローカル対話CLIでAccess Recoveryを行う | Product Dataを削除せず、秘密値を耐久記録へ残さない |

### 補足する品質

- Secretは発行時一度だけ表示し、ServerはDigestだけを保持する。
- 通常ローテーションと緊急Recoveryを別の判断・Authorityとして示す。
- Recoveryの対象、保持するProduct Data、結果および再入場方法を秘密値なしで追跡できる。

## 6. 下流への引き渡し

| 接続先 | この要求から保持する意味 |
|---|---|
| IA（直後工程への正式な引き渡し） | Role、Credential metadata、Secret表示境界、Credential状態、Repository Role、管理能力、Recovery Identity、対象範囲、耐久結果 |
| Quality Analysis / UX（伴走） | Role範囲、非開示、User非管理、Secret非保存、ローテーション、全喪失・認可破損Recovery、Repository単体非依存 |
| UI（後続Contract Relation） | 初回登録、発行時一度表示、Credential一覧・失効・再発行、Recovery確認と再入場 |
| SPEC（後続Contract Relation） | 認証、Role解決、Digest検証、発行・失効・期限・ローテーション、Recovery AuthorityとProduct Data保持 |

### 妥当性確認と未確認事項

- 確認する観測: 三Roleでの初回接続、通常再接続、発行・失効・ローテーション、全喪失Recovery。
- 未確認事項: 共有Credentialの配布負担、管理画面とCLIの分担、有効期限の既定値。
- 現在判定: 後続確認が必要。UX定義を進めることは妨げない。
- 確認事項: 小規模共有Serverで個人管理なしに安全かつ理解可能に運用できるか。
- 判断者: CROS管理者、Remote利用者およびQual-Lab。
- 未確認時の影響: 定量的な期限、画面配置および配布手順を確定しない。
- Discoveryへ戻す条件: 個人別失効・監査が必要、固定三Roleで運用不能、または共有Secret配布が許容不能な場合。

## Checklist

- [x] 同じREQのDiscovery定義を正式入力として一意に特定した
- [x] REQの問題、望ましい変化、制約および未確認事項を保持した
- [x] REQにない意味をAIの推測だけで追加していない
- [x] 利用者、判断する人および関係する利用者を必要な範囲で特定した
- [x] 利用場面と前後の状況を特定した
- [x] 現在の体験、困りごとまたは回避方法を説明した
- [x] 目的を解決策の操作ではなく利用者の目的として表現した
- [x] 利用前後の仕事、理解、判断または行動の変化を説明した
- [x] 得られる結果を独立した利用者成果として定義した
- [x] 重要場面を評価した
- [x] 避ける失敗を評価した
- [x] 体験品質への期待を評価した
- [x] 人間による評価または確認が必要な事項を評価した
- [x] IA、UI、SPECまたはArchitectureの結論を先取りしていない
- [x] New、SameまたはNot Applicableを利用者成果の同一性から判断した
- [x] 統合判断の理由を追跡できる
- [x] 未確認事項と影響を明示した
- [x] IAへの正式な引き渡しを明示した
- [x] Quality Analysis / UXへの伴走入力を明示した
- [x] UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した
- [x] DiscoveryまたはUXへ戻す条件を明示した
- [x] 補足分析へ必須情報を退避していない
