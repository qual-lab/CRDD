# REQ-000011の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000011` Remote接続のWorkspace限定
探索元: [Remote Project Context](../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)

## 1. REQの一次分析

```text
Serverへ接続できれば全Projectを扱えると思う／取得不能を権限不足か障害か推測する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
許可されたWorkspaceだけへ接続する
```

この要求で解くのは機能の有無だけではない。Remote CROS利用者が「場所が変わっても開示範囲を理解して安全に使える」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Serverへ接続できれば全Projectを扱えると思う／取得不能を権限不足か障害か推測する |
| UX Need | 許可されたWorkspaceだけへ接続する |
| 対象範囲 | Remote接続利用者、CROS管理者が、「Serverへ接続できれば全Projectを扱えると思う」状態から「現在SessionへGrantされたWorkspaceだけが利用できると分かる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Remote CROS利用者
        │
        │ wants to
        ▼
許可されたWorkspaceだけへ接続する
        │
        │ so that
        ▼
場所が変わっても開示範囲を理解して安全に使える
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | Remote Sessionを開始・再接続する時 |
| Goal | 許可されたWorkspaceだけへ接続する |
| Outcome | 場所が変わっても開示範囲を理解して安全に使える |
| REQ固有の差 | Credentialから現在のWorkspace Grantを確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「許可されたWorkspaceだけへ接続する」を判断する場面で、Credentialから現在のWorkspace Grantを確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Serverへ接続できれば全Projectを扱えると思う
- 取得不能を権限不足か障害か推測する
        │
        │ Remote接続のWorkspace限定が変える体験
        ▼
After
────────────────
- 現在SessionへGrantされたWorkspaceだけが利用できると分かる
- `credential_required`、`restricted`、`unavailable`を区別する
```

Remote接続では、接続できたことと閲覧できる範囲を同一視しやすい。利用者は現在のCredentialで何を利用でき、何が見えず、次に何が必要かを誤認なく理解する必要がある。

この変化で守るのは操作手順ではない。Remote CROS利用者が許可されたWorkspaceだけへ接続することで、場所が変わっても開示範囲を理解して安全に使えるようになることを守る。

## 4. UX成果への統合

```text
REQ-000011
   │
   └─ New  → UX-000013 許可されたWorkspaceだけをRemote利用する
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 許可されたWorkspaceだけをRemote利用する | `New → UX-000013` | 本要求が「接続元やCredentialが変わっても、現在許可されたWorkspaceだけを利用し、利用不能理由と管理能力を内容閲覧から区別できる」という独立した利用者成果を最初に定義する。 | Credentialから現在のWorkspace Grantを確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Remote Sessionを開始・再接続する時
        ↓
Credentialから現在のWorkspace Grantを確認する
        │
        ├─ ★ Critical: 利用可能Contextを表示する時
        ├─ ⚠ Failure:  利用不能なRepositoryの存在や内容を推測表示する
        └─ ✓ Quality:  現在Grantだけを開示し不足を補完しない
        ↓
場所が変わっても開示範囲を理解して安全に使える
```

### Service Blueprintの処置

処置: `作成`

```text
CROS管理者
        │ Workspaceと接続CredentialのGrantを設定
        ▼
Project Operator／PM
        │ [接点] Credentialで接続・再接続
        ▼
提供System
        │ 現在Grantで利用可能Contextだけを投影
        ▼
[接点] 利用可能範囲と利用不能理由
        │
        ▼
Project Operator／PM
        └─ 失敗時: 利用不能なRepositoryの存在や内容を推測表示する場合は成功へ進めず、判断または回復を担う主体へ戻す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [RemoteでContextと結果へ戻る](../../03_Experience_Map.md#remoteでcontextと結果へ戻る)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| CROS管理者 | CredentialへWorkspace Grantを設定・失効する | Content閲覧権限をSystem管理能力から推定しない |
| Project Operator／PM | 現在許可された範囲を理解して利用する | 利用不能Repositoryの存在や内容を推測しない |
| 提供System | 接続ごとに現在Grantを確認し、許可範囲だけを返す | 古いSession Authorityを再利用しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 認証後もGrant外のRepository名、件数、状態を漏らさない。（避ける失敗: Serverへ接続できれば全Projectを扱えると思う）
- 結果を判断または引き継ぐ時: Credential切替や失効後は投影を再評価する。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: `Unlock`は別Credentialが必要で存在開示可能な場合だけ示す。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: System管理能力とContent閲覧範囲を混同しない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


## 6. 下流への引き渡し

```text
このREQで確定した利用者成果
        │
        ├─→ IA: 必要な情報・関係・見つけ方
        ├─→ UI: 誤認させない表示・操作意図
        ├─→ SPEC: 振る舞い・失敗・体験品質の条件
        └─→ Verification: 仮説を破る反例と観測
```

### 妥当性確認と未確認事項

| 確認する仮説 | 観測方法 | 現在未確認の範囲 |
|---|---|---|
| 現在SessionへGrantされたWorkspaceだけが利用できると分かる／credential_required、restricted、unavailableを区別することで、Serverへ接続できれば全Projectを扱えると思うという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「許可されたWorkspaceだけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはCredential、Session、Workspace、ExposureおよびSource可用性を区別する。Threat／SPEC／Architectureは開示可否とEffect Authorityを別契約として具体化する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「許可されたWorkspaceだけへ接続する」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「場所が変わっても開示範囲を理解して安全に使える」という成果を無断で弱めない。
