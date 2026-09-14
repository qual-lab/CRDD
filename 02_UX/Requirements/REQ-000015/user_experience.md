# REQ-000015の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000015` Runtime Data Rootの所有と用途
探索元: [EXP-000016](../../../01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md)

## 1. REQの一次分析

```text
.crddやOS領域に用途不明のFileが増え、消してよいか判断できない
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Runtime Dataの所有場所とLifecycleを理解する
```

この要求で解くのは機能の有無だけではない。Runtime運用者・保守者が「残存・清掃・回復を別Repositoryへ波及させず扱える」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | .crddやOS領域に用途不明のFileが増え、消してよいか判断できない |
| UX Need | Runtime Dataの所有場所とLifecycleを理解する |
| 対象範囲 | Repository所有者、Runtime運用者が、「`.crdd`やOS領域に用途不明のFileが増え、消してよいか判断できない」状態から「Repository固有データと横断Runtimeデータを区別し、Owner、保持、Git管理、清掃条件を確認できる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Runtime運用者・保守者
        │
        │ wants to
        ▼
Runtime Dataの所有場所とLifecycleを理解する
        │
        │ so that
        ▼
残存・清掃・回復を別Repositoryへ波及させず扱える
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| 利用場面 | Runtime Dataを作成または清掃する時 |
| Goal | Runtime Dataの所有場所とLifecycleを理解する |
| Outcome | 残存・清掃・回復を別Repositoryへ波及させず扱える |
| REQ固有の差 | 検証済みRoot・Owner・保持条件を確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Runtime導入・運用者が「Runtime Dataの所有場所とLifecycleを理解する」を判断する場面で、検証済みRoot・Owner・保持条件を確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- `.crdd`やOS領域に用途不明のFileが増え、消してよいか判断できない
        │
        │ Runtime Data Rootの所有と用途が変える体験
        ▼
After
────────────────
- Repository固有データと横断Runtimeデータを区別し、Owner、保持、Git管理、清掃条件を確認できる
```

Runtime Data Rootの所有と用途は、単に内部方式を成立させる要求ではない。「`.crdd`やOS領域に用途不明のFileが増え、消してよいか判断できない」状態から、「Repository固有データと横断Runtimeデータを区別し、Owner、保持、Git管理、清掃条件を確認できる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Runtime運用者・保守者がRuntime Dataの所有場所とLifecycleを理解することで、残存・清掃・回復を別Repositoryへ波及させず扱えるようになることを守る。

## 4. UX成果への統合

```text
REQ-000015
   │
   └─ New  → UX-000017 Runtime Dataを安全に保持・清掃する
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Runtime Dataを安全に保持・清掃する | `New → UX-000017` | 本要求が「保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる」という独立した利用者成果を最初に定義する。 | 検証済みRoot・Owner・保持条件を確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Runtime Dataを作成または清掃する時
        ↓
検証済みRoot・Owner・保持条件を確認する
        │
        ├─ ★ Critical: 永続化または削除の直前
        ├─ ⚠ Failure:  subdirectoryや別Rootへ同名データを作る
        └─ ✓ Quality:  用途別領域とcleanup条件を明示する
        ↓
残存・清掃・回復を別Repositoryへ波及させず扱える
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Runtime導入・運用者]
        │ 利用者行動: 保持すべき状態と一時物を理解して処置する
        ▼
[T: Runtime Dataを作成または清掃する時]
        │
        ├─ 時間差: 書込み前にRootを確認し、終了・清掃時に残存を再観測する
        ├─ 完了時: Data Owner、用途、Durability、cleanup条件、終了後の存在状態
        └─ 失敗時: 由来不明または観測不能なDataをRuntime導入・運用者へ返す
                     │
                     ▼
             [R: 提供System]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 保持、再観測、回復または安全な清掃を選ぶ

---------------- 可視境界 ----------------
                     │ 時間関係: 書込み前にRootを確認し、終了・清掃時に残存を再観測する
                     ▼
[S: Runtime／Tool]
        └─ 提供責務: 検証済みRootと用途別領域へDataを作成する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Runtime／Tool | 検証済みRootと用途別領域へDataを作成する | subdirectoryや別Repositoryへ同名領域を作らない |
| Runtime導入・運用者 | 保持すべき状態と一時物を理解して処置する | 由来不明物を名前だけで削除しない |
| 提供System | Owner・Lifecycle・cleanup条件を示して処置結果を返す | 観測不能を不存在として表示しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 用途不明の直下Fileを作らない。（避ける失敗: .crddやOS領域に用途不明のFileが増え、消してよいか判断できない）
- 結果を判断または引き継ぐ時: DurableとTemporaryを名前だけで混同しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 別RepositoryやOS領域への書込みを隠さない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| Repository固有データと横断Runtimeデータを区別し、Owner、保持、Git管理、清掃条件を確認できることで、.crddやOS領域に用途不明のFileが増え、消してよいか判断できないという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Runtime導入・運用者が「Runtime Dataの所有場所とLifecycleを理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはRoot、用途、Owner、Lifecycleを分け、ArchitectureとMaintenanceはPath契約と清掃を定める。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Runtime Dataの所有場所とLifecycleを理解する」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「残存・清掃・回復を別Repositoryへ波及させず扱える」という成果を無断で弱めない。
