# REQ-000014の利用者体験分析

成果物種別: UX Analysis

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000014` Repository Tool能力の明示Registry
探索元: [EXP-000025](../../../01_Discovery/Analysis/EXP-000025/exploration.md)

## 1. REQの一次分析

```text
存在するファイルや名前から能力と実行許可を推測する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
現在Repositoryで利用可能なCapabilityを知る
```

この要求で解くのは機能の有無だけではない。RepositoryでToolを使う人が「名前やPathを推測せず適切な入口を選べる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 存在するファイルや名前から能力と実行許可を推測する |
| UX Need | 現在Repositoryで利用可能なCapabilityを知る |
| 対象範囲 | Repositoryで作業する人、AI、外部Toolが、「存在するファイルや名前から能力と実行許可を推測する」状態から「登録済み能力、現在利用可能な能力、許可された操作を区別して選べる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
RepositoryでToolを使う人
        │
        │ wants to
        ▼
現在Repositoryで利用可能なCapabilityを知る
        │
        │ so that
        ▼
名前やPathを推測せず適切な入口を選べる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| 利用場面 | Toolで処理を始める時 |
| Goal | 現在Repositoryで利用可能なCapabilityを知る |
| Outcome | 名前やPathを推測せず適切な入口を選べる |
| REQ固有の差 | Repositoryが公開するCapabilityを確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Developerが「現在Repositoryで利用可能なCapabilityを知る」を判断する場面で、Repositoryが公開するCapabilityを確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 存在するファイルや名前から能力と実行許可を推測する
        │
        │ Repository Tool能力の明示Registryが変える体験
        ▼
After
────────────────
- 登録済み能力、現在利用可能な能力、許可された操作を区別して選べる
```

Repository Tool能力の明示Registryは、単に内部方式を成立させる要求ではない。「存在するファイルや名前から能力と実行許可を推測する」状態から、「登録済み能力、現在利用可能な能力、許可された操作を区別して選べる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。RepositoryでToolを使う人が現在Repositoryで利用可能なCapabilityを知ることで、名前やPathを推測せず適切な入口を選べるようになることを守る。

## 4. UX成果への統合

```text
REQ-000014
   │
   └─ New  → UX-000016 仕事に必要な標準Toolを迷わず選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 仕事に必要な標準Toolを迷わず選ぶ | `New → UX-000016` | 本要求が「現在Repositoryと目的に対応する標準Toolを見つけ、利用可能性・Effect権限・開発実行・公式実行を区別して選べる」という独立した利用者成果を最初に定義する。 | Repositoryが公開するCapabilityを確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Toolで処理を始める時
        ↓
Repositoryが公開するCapabilityを確認する
        │
        ├─ ★ Critical: 実行入口を選択する場面
        ├─ ⚠ Failure:  存在するファイルを利用可能Capabilityと誤認する
        └─ ✓ Quality:  能力・入口・制約・現在状態を明示する
        ↓
名前やPathを推測せず適切な入口を選べる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Developer]
        │ 利用者行動: 目的と必要Effectに合うToolを選ぶ
        ▼
[T: Toolで処理を始める時]
        │
        ├─ 時間差: Capability登録後の利用可能性確認はTool起動時に行う
        ├─ 完了時: 登録Capability、現在の利用可能性、必要Effect権限、実行Mode
        └─ 失敗時: 未登録または利用不能なCapabilityと理由をRepository／Tool Ownerへ返す
                     │
                     ▼
             [R: Repository／Tool Owner]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 別Toolを選ぶか、Registry更新を依頼する

---------------- 可視境界 ----------------
                     │ 時間関係: Capability登録後の利用可能性確認はTool起動時に行う
                     ▼
[S: 提供System]
        └─ 提供責務: 登録済みCapabilityと現在の利用可能性を返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Repositoryで日常作業を進める](../../03_Experience_Map.md#repositoryで日常作業を進める)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Repository／Tool Owner | Repositoryに対応するCapabilityと正式入口を宣言する | 存在するFileだけを利用可能Capabilityと表示しない |
| Developer | 目的と必要Effectに合うToolを選ぶ | Toolの表示を実行Authorityとみなさない |
| 提供System | 登録済みCapabilityと現在の利用可能性を返す | 未登録Toolを推測で起動しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 未登録能力を推測表示しない。（避ける失敗: 存在するファイルや名前から能力と実行許可を推測する）
- 結果を判断または引き継ぐ時: 利用不能理由を登録欠落と権限拒否で分ける。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 一覧表示だけでEffect Authorityを与えない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 登録済み能力、現在利用可能な能力、許可された操作を区別して選べることで、存在するファイルや名前から能力と実行許可を推測するという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Developerが「現在Repositoryで利用可能なCapabilityを知る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはCapability、Availability、Authorityを分け、UI／MCPとVerificationは同じRegistry投影を利用する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「現在Repositoryで利用可能なCapabilityを知る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「名前やPathを推測せず適切な入口を選べる」という成果を無断で弱めない。
