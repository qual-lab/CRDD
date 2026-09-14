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
   ├─ New  → UX-000010 出所付きContextと結果の往復
   ├─ New  → UX-000042 現在必要なContextの選択
   ├─ New  → UX-000043 Context不足・競合時の非捏造
   └─ New  → UX-000044 Secretと不要情報を含めないContext
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 出所付きContextと結果の往復 | `New → UX-000010` | 既存成果へ統合すると「Chat AgentとCoding Agentの間を人間が転記せず、使ったContextと生成結果を同じTaskへ戻せる」を独立して変更・確認できなくなる。 | 「必要なContextだけを出所付きで渡す」から「何を使って判断・生成したか後から追跡できる」へ進むための固有条件を示す。 |
| 現在必要なContextの選択 | `New → UX-000042` | 既存成果へ統合すると「対象変更に必要なIntent、Decision、Evidence、現行Hypothesisだけを受け取れる」を独立して変更・確認できなくなる。 | 「必要なContextだけを出所付きで渡す」から「何を使って判断・生成したか後から追跡できる」へ進むための固有条件を示す。 |
| Context不足・競合時の非捏造 | `New → UX-000043` | 既存成果へ統合すると「不足や競合をAIの推測で埋めず、判断不能範囲を理解できる」を独立して変更・確認できなくなる。 | 「必要なContextだけを出所付きで渡す」から「何を使って判断・生成したか後から追跡できる」へ進むための固有条件を示す。 |
| Secretと不要情報を含めないContext | `New → UX-000044` | 既存成果へ統合すると「外部またはAIへ渡すContextが許可範囲の必要最小限だと確認できる」を独立して変更・確認できなくなる。 | 「必要なContextだけを出所付きで渡す」から「何を使って判断・生成したか後から追跡できる」へ進むための固有条件を示す。 |

Same／Newは技術用語の近さでは決めない。利用者、Goal、Outcome、重要場面およびFailureが同じかを比較し、この要求だけが補う条件を分けて記録する。

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

### このREQのService Blueprint

```text
利用者: 外部Contextの所有者
        │ 別AgentやToolへ仕事を渡す時
        ▼
提供System／AI
        ├─ 支援: 必要なContextだけを出所付きで渡す
        ├─ ★ 判断点: 外部境界へContextを出す直前
        ├─ ⚠ 防止: 全量投入・Secret混入・古い仮説の現在値化
        └─ ✓ 保証: Source・Revision・選択理由を保持する
        │
        ▼
利用者
        └─ 何を使って判断・生成したか後から追跡できる
                │
                ▼
運用・確認者
        └─ 品質とOutcomeを反例で確認する
```

この図は、このREQで利用者、提供System／AI、運用・確認者の間に生じる受け渡しを示す。詳細な責任と越えてはならない境界は次表で固定する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [対話と構築を往復する](../../03_Experience_Map.md#対話と構築を往復する)／[外部Contextを送受信する](../../03_Experience_Map.md#外部contextを送受信する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Chat Agent／Coding Agentの利用者） | 必要なContextだけを出所付きで渡すために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | 対象に必要なContext Packageを解決するための状態、根拠および選択肢を示す | 全量投入・Secret混入・古い仮説の現在値化状態を成功・完了として表示しない |
| 運用・確認者 | 「Source・Revision・選択理由を保持する」ことと、何を使って判断・生成したか後から追跡できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

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
