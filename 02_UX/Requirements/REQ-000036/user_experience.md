# REQ-000036の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000036` 差し替え可能なVersion Control境界
探索元: [EXP-000014](../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)

## 1. REQの一次分析

```text
未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
日常作業をCommit SHAや特定Git実装から切り離す
```

この要求で解くのは機能の有無だけではない。Developer／Runtime保守者が「未Commit状態でも作業し将来Version Controlを差し替えられる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う |
| UX Need | 日常作業をCommit SHAや特定Git実装から切り離す |
| 対象範囲 | CRDD Toolを使う人、Tool保守者が、「未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う」状態から「通常の読取り・編集は作業状態にかかわらず成立し、履歴機能が必要な時だけVersion Control能力を使う」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Developer／Runtime保守者
        │
        │ wants to
        ▼
日常作業をCommit SHAや特定Git実装から切り離す
        │
        │ so that
        ▼
未Commit状態でも作業し将来Version Controlを差し替えられる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| 利用場面 | Repositoryを読み書きし履歴機能を使う時 |
| Goal | 日常作業をCommit SHAや特定Git実装から切り離す |
| Outcome | 未Commit状態でも作業し将来Version Controlを差し替えられる |
| REQ固有の差 | 通常操作とVersion Control Capabilityを分けることが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Developerが「日常作業をCommit SHAや特定Git実装から切り離す」を判断する場面で、通常操作とVersion Control Capabilityを分けることが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う
        │
        │ 差し替え可能なVersion Control境界が変える体験
        ▼
After
────────────────
- 通常の読取り・編集は作業状態にかかわらず成立し、履歴機能が必要な時だけVersion Control能力を使う
```

Version 差し替え可能なVersion Control境界は、単に内部方式を成立させる要求ではない。「未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う」状態から、「通常の読取り・編集は作業状態にかかわらず成立し、履歴機能が必要な時だけVersion Control能力を使う」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Developer／Runtime保守者が日常作業をCommit SHAや特定Git実装から切り離すことで、未Commit状態でも作業し将来Version Controlを差し替えられるようになることを守る。

## 4. UX成果への統合

```text
REQ-000036
   │
   └─ Same → UX-000010 Repository単独で日常作業を続ける
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Repository単独で日常作業を続ける | `Same → UX-000010` | 既存UXのFailure: Commit済み状態または特定の履歴実装を前提にし、通常の読取り・編集を継続できない<br>現在REQのFailure: 未CommitであることやVersion Control Adapterの故障だけで無関係な日常作業まで停止する<br>Failure差: 現在REQはVersion Control境界を原因として特定するが、現在Repositoryで日常作業を続けられない失敗は同じである<br>同一Outcomeへ統合できる理由: 差し替え可能な履歴境界は同じLocal作業成果を守るArchitecture条件である | 通常操作とVersion Control Capabilityを分けることが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Repositoryを読み書きし履歴機能を使う時
        ↓
通常操作とVersion Control Capabilityを分ける
        │
        ├─ ★ Critical: 履歴Identityが本当に必要な場面
        ├─ ⚠ Failure:  Commitされていないだけで通常作業が成立しない
        └─ ✓ Quality:  外部境界Adapter越しに必要時だけ履歴を使う
        ↓
未Commit状態でも作業し将来Version Controlを差し替えられる
```

### Service Blueprintの処置

処置: `非該当`

このREQが変えるのは、Developerの通常作業をVersion Controlの状態や実装から切り離すことであり、利用者が観測する新しいHandoffを追加することではない。通常作業と履歴Capabilityの責任差はJourneyと責任境界で保持でき、別主体への時間差のある責任移送や回復受け渡しは成果の成立条件にならないため非該当とする。Version Control操作そのものを別Serviceへ委任し、その失敗・回復が利用者体験を左右する場合は再評価する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Repositoryで日常作業を進める](../../03_Experience_Map.md#repositoryで日常作業を進める)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Developer／Runtime保守者） | 日常作業をCommit SHAや特定Git実装から切り離すために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | 通常操作とVersion Control Capabilityを分けるための状態、根拠および選択肢を示す | Commitされていないだけで通常作業が成立しない状態を成功・完了として表示しない |
| 運用・確認者 | 「外部境界Adapter越しに必要時だけ履歴を使う」ことと、未Commit状態でも作業し将来Version Controlを差し替えられる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 補足する品質

- 結果または状態を最初に受け取る時: Commit SHAを通常ObjectのIdentityにしない。（避ける失敗: 未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負う）
- 結果を判断または引き継ぐ時: Git不在とRepository不正を区別する。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: Adapter故障時に無関係な操作まで止めない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 通常の読取り・編集は作業状態にかかわらず成立し、履歴機能が必要な時だけVersion Control能力を使うことで、未Commitでは処理できない、Git内部差でTool全体が壊れる等の制約を利用者が背負うという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Developerが「日常作業をCommit SHAや特定Git実装から切り離す」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | Architectureは目的別PortとAdapterを分け、Verificationは未Commit・代替実装・能力不足の境界を確認する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「日常作業をCommit SHAや特定Git実装から切り離す」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「未Commit状態でも作業し将来Version Controlを差し替えられる」という成果を無断で弱めない。
