# REQ-000034の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000034` Repository固定Commitから使える標準Tool
探索元: [EXP-000005](../../../01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md)

## 1. REQの一次分析

```text
別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Repositoryに対応する標準Toolを迷わず使う
```

この要求で解くのは機能の有無だけではない。CRDD採用Repositoryの利用者が「未Commit作業と署名済み実行を区別して反復できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する |
| UX Need | Repositoryに対応する標準Toolを迷わず使う |
| 対象範囲 | CRDD採用Repositoryの利用者が、「別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する」状態から「現在Repositoryへ結び付いた標準Tool入口を選び、対応関係を手動照合せず利用できる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
CRDD採用Repositoryの利用者
        │
        │ wants to
        ▼
Repositoryに対応する標準Toolを迷わず使う
        │
        │ so that
        ▼
未Commit作業と署名済み実行を区別して反復できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| 利用場面 | Toolを導入または起動する時 |
| Goal | Repositoryに対応する標準Toolを迷わず使う |
| Outcome | 未Commit作業と署名済み実行を区別して反復できる |
| REQ固有の差 | Repository Bindingと実行Modeを確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Developerが「Repositoryに対応する標準Toolを迷わず使う」を判断する場面で、Repository Bindingと実行Modeを確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する
        │
        │ Repository固定Commitから使える標準Toolが変える体験
        ▼
After
────────────────
- 現在Repositoryへ結び付いた標準Tool入口を選び、対応関係を手動照合せず利用できる
```

Repository固定Commitから使える標準Toolは、単に内部方式を成立させる要求ではない。「別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する」状態から、「現在Repositoryへ結び付いた標準Tool入口を選び、対応関係を手動照合せず利用できる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。CRDD採用Repositoryの利用者がRepositoryに対応する標準Toolを迷わず使うことで、未Commit作業と署名済み実行を区別して反復できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000034
   │
   ├─ Same → UX-000010 Repository単独で日常作業を続ける
   └─ Same → UX-000016 仕事に必要な標準Toolを迷わず選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Repository単独で日常作業を続ける | `Same → UX-000010` | 利用者が得る最終成果は「横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在Repositoryで日常作業を開始・継続できる」で既存UX-000010と共通する。本要求が追加する条件は独立したGoal／Outcomeではないため、別IDへ分割しない。 | Repository Bindingと実行Modeを確認することが、この要求固有の成立条件になる |
| 仕事に必要な標準Toolを迷わず選ぶ | `Same → UX-000016` | 利用者が得る最終成果は「現在Repositoryと目的に対応する標準Toolを見つけ、利用可能性・Effect権限・開発実行・公式実行を区別して選べる」で既存UX-000016と共通する。本要求が追加する条件は独立したGoal／Outcomeではないため、別IDへ分割しない。 | Repository Bindingと実行Modeを確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Toolを導入または起動する時
        ↓
Repository Bindingと実行Modeを確認する
        │
        ├─ ★ Critical: 開発実行か正式実行か選ぶ場面
        ├─ ⚠ Failure:  外部の任意ToolやCandidateを正式版と誤認する
        └─ ✓ Quality:  入口・配布Identity・Authorityを明示する
        ↓
未Commit作業と署名済み実行を区別して反復できる
```

### Service Blueprintの処置

処置: `非該当`

「Repositoryに対応する標準Toolを迷わず使う」は、このREQでは複数主体間の時間差やHandoffを新しい体験成立条件にしない。Journeyと次表の責任境界で必要な分析を保持し、主体間の受け渡しが成果を左右する条件へ変わった時に再評価する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Repositoryで日常作業を進める](../../03_Experience_Map.md#repositoryで日常作業を進める)／[Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（CRDD採用Repositoryの利用者） | Repositoryに対応する標準Toolを迷わず使うために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | Repository Bindingと実行Modeを確認するための状態、根拠および選択肢を示す | 外部の任意ToolやCandidateを正式版と誤認する状態を成功・完了として表示しない |
| 運用・確認者 | 「入口・配布Identity・Authorityを明示する」ことと、未Commit作業と署名済み実行を区別して反復できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 補足する品質

- 結果または状態を最初に受け取る時: 未Commit作業を通常操作から排除しない。（避ける失敗: 別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する）
- 結果を判断または引き継ぐ時: Repository外の任意Toolを暗黙採用しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 署名済み実行と開発実行の違いを示す。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 現在Repositoryへ結び付いた標準Tool入口を選び、対応関係を手動照合せず利用できることで、別配布ToolとのVersion対応を手で調べ、誤った組合せで実行するという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Developerが「Repositoryに対応する標準Toolを迷わず使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | ArchitectureはRepository固定Tool入口を、ReleaseとVerificationは配布Identityと利用経路を具体化する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Repositoryに対応する標準Toolを迷わず使う」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「未Commit作業と署名済み実行を区別して反復できる」という成果を無断で弱めない。
