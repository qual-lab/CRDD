# REQ-000017の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000017` 出所付きContext Packageの解決
探索元: [Project間Context交換](../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md)

## 1. REQの一次分析

```text
次のAgentへ必要そうな情報を手で貼り直す／Agentが何を参照したか推測する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
必要なContextだけを出所付きで渡す
```

この要求で解くのは機能の有無だけではない。Chat Agent／Coding Agentの利用者が「何を使って判断・生成したか後から追跡できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 次のAgentへ必要そうな情報を手で貼り直す／Agentが何を参照したか推測する |
| UX Need | 必要なContextだけを出所付きで渡す |
| 対象範囲 | Contextを利用する人・AI、情報所有者が、「次のAgentへ必要そうな情報を手で貼り直す」状態から「対象Taskに必要なContextがSourceとRevision付きで解決される」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Chat Agent／Coding Agentの利用者
        │
        │ wants to
        ▼
必要なContextだけを出所付きで渡す
        │
        │ so that
        ▼
何を使って判断・生成したか後から追跡できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「外部Contextの所有者」 |
| 利用場面 | 別AgentやToolへ仕事を渡す時 |
| Goal | 必要なContextだけを出所付きで渡す |
| Outcome | 何を使って判断・生成したか後から追跡できる |
| REQ固有の差 | 対象に必要なContext Packageを解決することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。外部Contextの所有者が「必要なContextだけを出所付きで渡す」を判断する場面で、対象に必要なContext Packageを解決することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 次のAgentへ必要そうな情報を手で貼り直す
- Agentが何を参照したか推測する
        │
        │ 出所付きContext Packageの解決が変える体験
        ▼
After
────────────────
- 対象Taskに必要なContextがSourceとRevision付きで解決される
- 利用したContext集合と不足範囲を後から追跡する
```

Chat AgentとCoding Agentの間で人間が文書や会話を転記すると、出所、改訂版、選択理由が失われる。全Context投入は過剰共有と認知負荷を増やす。

この変化で守るのは操作手順ではない。Chat Agent／Coding Agentの利用者が必要なContextだけを出所付きで渡すことで、何を使って判断・生成したか後から追跡できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000017
   │
   └─ New  → UX-000019 必要なContextを渡し結果を同じ仕事へ戻す
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 必要なContextを渡し結果を同じ仕事へ戻す | `New → UX-000019` | 本要求が「必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる」という独立した利用者成果を最初に定義する。 | 対象に必要なContext Packageを解決することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
別AgentやToolへ仕事を渡す時
        ↓
対象に必要なContext Packageを解決する
        │
        ├─ ★ Critical: 外部境界へContextを出す直前
        ├─ ⚠ Failure:  全量投入・Secret混入・古い仮説の現在値化
        └─ ✓ Quality:  Source・Revision・選択理由を保持する
        ↓
何を使って判断・生成したか後から追跡できる
```

### Service Blueprintの処置

処置: `作成`

```text
外部Contextの所有者
        │ [接点] 目的・送信先・選択範囲を確認
        ▼
提供System／AI
        │ Secretと不要情報を除き出所付きContextを渡す
        ▼
外部Agent／Tool
        │ 結果・使用Context・未確認範囲を返す
        ▼
[接点] 採用前の候補結果
        │
        ▼
外部Contextの所有者
        └─ 失敗時: 全量投入・Secret混入・古い仮説の現在値化場合は成功へ進めず、判断または回復を担う主体へ戻す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [対話と構築を往復する](../../03_Experience_Map.md#対話と構築を往復する)／[外部Contextを送受信する](../../03_Experience_Map.md#外部contextを送受信する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 外部Contextの所有者 | 送信目的と範囲を確認し、帰還結果の採否を判断する | 接続済みであることを包括許可とみなさない |
| 提供System／AI | 必要最小限のContextを出所付きで搬送し候補として戻す | Secretや無関係Contextを黙示送信しない |
| 外部Agent／Tool | 許可されたContextから結果と未確認範囲を返す | 結果へ正本採用権限があると仮定しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 対象Artifact、上位Intent、制約Decision、必要Evidence、現在有効なHypothesisを選ぶ。（避ける失敗: 次のAgentへ必要そうな情報を手で貼り直す）
- 結果を判断または引き継ぐ時: 古い、競合する、利用不能なContextを暗黙に統合しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: Secretや許可外情報をPackageへ含めない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 不足ContextをAgentの推測で補完しない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 対象Taskに必要なContextがSourceとRevision付きで解決される／利用したContext集合と不足範囲を後から追跡することで、次のAgentへ必要そうな情報を手で貼り直すという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | 外部Contextの所有者が「必要なContextだけを出所付きで渡す」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはContext Package、Source、Revision、Selection ReasonおよびTask Relationを分ける。ArchitectureはResolverとTransportを分離し、Verificationは出所喪失と過剰投入を反証する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「必要なContextだけを出所付きで渡す」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「何を使って判断・生成したか後から追跡できる」という成果を無断で弱めない。
