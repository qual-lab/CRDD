# REQ-000020の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000020` 欠測・競合を保つRepository Federation
探索元: [Repository横断Project Context](../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)

## 1. REQの一次分析

```text
Repositoryごとの状態を手で合成し、不足を見落とす／最新値らしい一つを選んでしまう
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
複数Repositoryを不完全性付きで一つのProjectとして見る
```

この要求で解くのは機能の有無だけではない。Project Operator／CROS利用者が「欠測・制限・競合を保ったまま横断判断できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Repositoryごとの状態を手で合成し、不足を見落とす／最新値らしい一つを選んでしまう |
| UX Need | 複数Repositoryを不完全性付きで一つのProjectとして見る |
| 対象範囲 | 複数Repositoryを横断するProject Operatorが、「Repositoryごとの状態を手で合成し、不足を見落とす」状態から「一つのProject Viewで、取得済み・欠測・競合を同時に確認する」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Project Operator／CROS利用者
        │
        │ wants to
        ▼
複数Repositoryを不完全性付きで一つのProjectとして見る
        │
        │ so that
        ▼
欠測・制限・競合を保ったまま横断判断できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | Federated Projectを開く時 |
| Goal | 複数Repositoryを不完全性付きで一つのProjectとして見る |
| Outcome | 欠測・制限・競合を保ったまま横断判断できる |
| REQ固有の差 | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「複数Repositoryを不完全性付きで一つのProjectとして見る」を判断する場面で、各RepositoryのIdentity・Source状態・Coverageを解決することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Repositoryごとの状態を手で合成し、不足を見落とす
- 最新値らしい一つを選んでしまう
        │
        │ 欠測・競合を保つRepository Federationが変える体験
        ▼
After
────────────────
- 一つのProject Viewで、取得済み・欠測・競合を同時に確認する
- Sourceごとの値と統合不能理由を理解する
```

複数Repositoryを束ねると、一部の取得失敗や値の競合を一つの正常値へ丸めたくなる。しかし利用者が必要なのは、見栄えのよい統合結果より、判断に使える正確な全体像である。

この変化で守るのは操作手順ではない。Project Operator／CROS利用者が複数Repositoryを不完全性付きで一つのProjectとして見ることで、欠測・制限・競合を保ったまま横断判断できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000020
   │
   ├─ Same → UX-000009 Projectの現在地を根拠と不完全性付きで理解する
   └─ Same → UX-000011 Project・Repository・Rootを区別して対象を選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Projectの現在地を根拠と不完全性付きで理解する | `Same → UX-000009` | 利用者が得る最終成果は「物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる」で既存UX-000009と共通する。本要求が追加する条件は独立したGoal／Outcomeではないため、別IDへ分割しない。 | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |
| Project・Repository・Rootを区別して対象を選ぶ | `Same → UX-000011` | 利用者が得る最終成果は「論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる」で既存UX-000011と共通する。本要求が追加する条件は独立したGoal／Outcomeではないため、別IDへ分割しない。 | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Federated Projectを開く時
        ↓
各RepositoryのIdentity・Source状態・Coverageを解決する
        │
        ├─ ★ Critical: 複数Sourceを統合する場面
        ├─ ⚠ Failure:  読めないSourceを推測補完し完全表示する
        └─ ✓ Quality:  partial・restricted・stale・conflictingを保持する
        ↓
欠測・制限・競合を保ったまま横断判断できる
```

### Service Blueprintの処置

処置: `作成`

```text
Project Operator／PM
        │ 論理Projectを照会
        ▼
CROS Federation
        │ Repository Bindingごとに取得
        ▼
複数Repository
        │ available／missing／restricted／conflicting
        ▼
Project Projection
        │ 不完全性を保った統合View
        ▼
Project Operator／PM
```

この図は、このREQで体験成立条件となる主体間の受け渡しを示す。詳細な責任と越えてはならない境界は次表で固定する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Projectの現在地を判断する](../../03_Experience_Map.md#projectの現在地を判断する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Project Operator／CROS利用者） | 複数Repositoryを不完全性付きで一つのProjectとして見るために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | 各RepositoryのIdentity・Source状態・Coverageを解決するための状態、根拠および選択肢を示す | 読めないSourceを推測補完し完全表示する状態を成功・完了として表示しない |
| 運用・確認者 | 「partial・restricted・stale・conflictingを保持する」ことと、欠測・制限・競合を保ったまま横断判断できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 補足する品質

- 結果または状態を最初に受け取る時: Sourceごとの取得状態と観測時点を保持する。（避ける失敗: Repositoryごとの状態を手で合成し、不足を見落とす）
- 結果を判断または引き継ぐ時: `missing`と`restricted`と`unavailable`を混同しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: 競合値をAIが勝手に一つへ統合しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: Partialでも分かる範囲と判断できない範囲を示す。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 一つのProject Viewで、取得済み・欠測・競合を同時に確認する／Sourceごとの値と統合不能理由を理解することで、Repositoryごとの状態を手で合成し、不足を見落とすという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「複数Repositoryを不完全性付きで一つのProjectとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはProperty単位のProvenanceとCoverageを持つ。SPECは統合決定表とFreshness条件を定め、ArchitectureはSource Adapterの失敗をProject全体成功へ隠さない。 |

Discoveryへ戻す条件は、想定した利用者、問題または「複数Repositoryを不完全性付きで一つのProjectとして見る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「欠測・制限・競合を保ったまま横断判断できる」という成果を無断で弱めない。
