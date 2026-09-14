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
| Repository単独で日常作業を続ける | `Same → UX-000010` | 既存UXのFailure: 横断機能・Commit済み状態・特定履歴実装を前提にし、現在Repositoryで日常作業を始められない<br>現在REQのFailure: Repositoryに対応する固定Toolを選べず、外部の任意ToolまたはCandidateへ依存する<br>Failure差: 現在REQはTool起動条件を追加するが、Repository単独の日常作業が外部条件で止まる失敗は同じである<br>同一Outcomeへ統合できる理由: Repository Bindingは同じLocal作業成果のCapability発見条件である | Repository Bindingと実行Modeを確認することが、この要求固有の成立条件になる |
| 仕事に必要な標準Toolを迷わず選ぶ | `Same → UX-000016` | 既存UXのFailure: Toolの存在・利用可能性・Effect権限・実行Modeを混同し、仕事に合う入口を選べない<br>現在REQのFailure: 開発候補または外部Toolを署名済み公式Runtimeと誤認して起動する<br>Failure差: 現在REQは配布物と実行Modeの識別を具体化するが、適切なToolを選べない失敗は同じである<br>同一Outcomeへ統合できる理由: 固定Commitと署名状態は同じTool選択成果に必要なInformation／Authority条件である | Repository Bindingと実行Modeを確認することが、この要求固有の成立条件になる |

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

処置: `作成`

```text
CRDD／Tool Publisher
        │ Repositoryに対応する固定配布物を提供
        ▼
Developer
        │ [接点] 開発実行か署名済み実行かを選ぶ
        ▼
提供System
        │ Repository Bindingと実行Identityを確認
        ▼
[接点] 正しいTool起動または理由付き拒否
        │
        ▼
Developer
        └─ 失敗時: 外部の任意ToolやCandidateを正式版と誤認する場合は成功へ進めず、判断または回復を担う主体へ戻す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Repositoryで日常作業を進める](../../03_Experience_Map.md#repositoryで日常作業を進める)／[Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| CRDD／Tool Publisher | 対応Repositoryと配布物のIdentityを提示する | 外部の任意Toolを公式配布物として扱わない |
| Developer | 反復用開発実行と公式Runtimeを目的に応じて選ぶ | Candidateを正式版と誤認しない |
| 提供System | Repository Bindingと実行Modeを確認して起動する | 手動のVersion推測だけで実行対象を選ばない |

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
