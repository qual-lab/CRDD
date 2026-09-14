# REQ-000024の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000024` 境界を越えるTask結果の帰還
探索元: [Project間Context交換](../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md)

## 1. REQの一次分析

```text
Agent結果を探し、元の相談へ貼り戻す／別Taskの結果混入を人間が見分ける
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
境界を越えた結果を同じTaskへ受け取る
```

この要求で解くのは機能の有無だけではない。仕事を委ねた人が「Evidenceと未確認範囲を保って採否を判断できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Agent結果を探し、元の相談へ貼り戻す／別Taskの結果混入を人間が見分ける |
| UX Need | 境界を越えた結果を同じTaskへ受け取る |
| 対象範囲 | Taskを委ねる人、結果を受け取る人が、「Agent結果を探し、元の相談へ貼り戻す」状態から「同じTaskに結果、Evidence、未解決事項が戻る」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
仕事を委ねた人
        │
        │ wants to
        ▼
境界を越えた結果を同じTaskへ受け取る
        │
        │ so that
        ▼
Evidenceと未確認範囲を保って採否を判断できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | AgentやRuntimeから結果が戻る時 |
| Goal | 境界を越えた結果を同じTaskへ受け取る |
| Outcome | Evidenceと未確認範囲を保って採否を判断できる |
| REQ固有の差 | Task Identity・Result・Evidence・帰還状態を照合することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「境界を越えた結果を同じTaskへ受け取る」を判断する場面で、Task Identity・Result・Evidence・帰還状態を照合することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Agent結果を探し、元の相談へ貼り戻す
- 別Taskの結果混入を人間が見分ける
        │
        │ 境界を越えるTask結果の帰還が変える体験
        ▼
After
────────────────
- 同じTaskに結果、Evidence、未解決事項が戻る
- Task IdentityとSource bindingから帰還先を確認する
```

Coding Agentが結果を作っても、元の対話やProject判断へ戻らなければ、人間が再び転記・照合しなければならない。結果だけでなく、どのTaskとContextから生まれたかを保つ必要がある。

この変化で守るのは操作手順ではない。仕事を委ねた人が境界を越えた結果を同じTaskへ受け取ることで、Evidenceと未確認範囲を保って採否を判断できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000024
   │
   ├─ Same → UX-000008 同一要求への再接続
   ├─ Same → UX-000015 再試行と回復の選択
   ├─ Same → UX-000029 Project・Repository・Rootの対象確認
   └─ New  → UX-000051 Task結果の相関と完全性
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 同一要求への再接続 | `Same → UX-000008` | 利用者はともにProject Operator／PM。起点は「切断後に同じRequestへ戻る」と「境界を越えた結果を同じTaskへ受け取る」、失敗は「成果を失う失敗」と「成果を失う失敗」で異なるが、得る成果は「応答喪失後に新規実行せず、同じ要求の状態・結果・回復義務へ戻れる」で共通する。 | 本要求側の起点とFailureを、同じ成果の追加成立条件として補う。 |
| 再試行と回復の選択 | `Same → UX-000015` | 利用者はともにProject Operator／PM。起点は「複数AIへ任せる範囲と権限を理解する」と「境界を越えた結果を同じTaskへ受け取る」、失敗は「成果を失う失敗」と「成果を失う失敗」で異なるが、得る成果は「失敗後に新規実行、状態確認、回復、清掃を取り違えない」で共通する。 | 本要求側の起点とFailureを、同じ成果の追加成立条件として補う。 |
| Project・Repository・Rootの対象確認 | `Same → UX-000029` | 利用者はともにProject Operator／PM。起点は「Project・Repository・Rootを区別して対象を確認する」と「境界を越えた結果を同じTaskへ受け取る」、失敗は「成果を失う失敗」と「成果を失う失敗」で異なるが、得る成果は「論理Projectを一つに見ながら、操作対象のRepositoryとRootを取り違えない」で共通する。 | 本要求側の起点とFailureを、同じ成果の追加成立条件として補う。 |
| Task結果の相関と完全性 | `New → UX-000051` | 既存成果へ統合すると「Result、Evidence、未確認、Risk、帰還状態を同じTaskとして確認できる」を独立して変更・確認できなくなる。 | 「境界を越えた結果を同じTaskへ受け取る」から「Evidenceと未確認範囲を保って採否を判断できる」へ進むための固有条件を示す。 |

Same／Newは技術用語の近さでは決めない。利用者、Goal、Outcome、重要場面およびFailureが同じかを比較し、この要求だけが補う条件を分けて記録する。

## 5. 重要な体験

### このREQのJourney

```text
AgentやRuntimeから結果が戻る時
        ↓
Task Identity・Result・Evidence・帰還状態を照合する
        │
        ├─ ★ Critical: 結果を候補として受け入れる場面
        ├─ ⚠ Failure:  別TaskやRevisionの結果を混入し自動採用する
        └─ ✓ Quality:  相関Identityと完全性を保持する
        ↓
Evidenceと未確認範囲を保って採否を判断できる
```

### このREQのService Blueprint

```text
利用者: Project Operator／PM
        │ AgentやRuntimeから結果が戻る時
        ▼
提供System／AI
        ├─ 支援: 境界を越えた結果を同じTaskへ受け取る
        ├─ ★ 判断点: 結果を候補として受け入れる場面
        ├─ ⚠ 防止: 別TaskやRevisionの結果を混入し自動採用する
        └─ ✓ 保証: 相関Identityと完全性を保持する
        │
        ▼
利用者
        └─ Evidenceと未確認範囲を保って採否を判断できる
                │
                ▼
運用・確認者
        └─ 品質とOutcomeを反例で確認する
```

この図は、このREQで利用者、提供System／AI、運用・確認者の間に生じる受け渡しを示す。詳細な責任と越えてはならない境界は次表で固定する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [外部Contextを送受信する](../../03_Experience_Map.md#外部contextを送受信する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（仕事を委ねた人） | 境界を越えた結果を同じTaskへ受け取るために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | Task Identity・Result・Evidence・帰還状態を照合するための状態、根拠および選択肢を示す | 別TaskやRevisionの結果を混入し自動採用する状態を成功・完了として表示しない |
| 運用・確認者 | 「相関Identityと完全性を保持する」ことと、Evidenceと未確認範囲を保って採否を判断できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 補足する品質

- 結果または状態を最初に受け取る時: Result、Evidence、未確認範囲、残存Riskを同じTaskへ結ぶ。（避ける失敗: Agent結果を探し、元の相談へ貼り戻す）
- 結果を判断または引き継ぐ時: 別Project、別Revision、別Taskの結果を混ぜない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: Agent完了を成果物採用やEffect成功と表示しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 帰還失敗時も生成済み結果の所在と再取得方法を保持する。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 同じTaskに結果、Evidence、未解決事項が戻る／Task IdentityとSource bindingから帰還先を確認することで、Agent結果を探し、元の相談へ貼り戻すという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「境界を越えた結果を同じTaskへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはTask、Context Package、Result、Evidence、DecisionおよびHandoffを関係付ける。SPEC／Architectureは相関IdentityをTransport境界で保持し、Verificationは誤配送と欠落を反証する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「境界を越えた結果を同じTaskへ受け取る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「Evidenceと未確認範囲を保って採否を判断できる」という成果を無断で弱めない。
