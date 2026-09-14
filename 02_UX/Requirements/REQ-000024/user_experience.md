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
   ├─ Same → UX-000004 失敗後の再試行・回復を選ぶ
   ├─ Same → UX-000011 Project・Repository・Rootを区別して対象を選ぶ
   ├─ Same → UX-000019 必要なContextを渡し結果を同じ仕事へ戻す
   └─ Same → UX-000021 切断後も同じRequestへ戻る
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 失敗後の再試行・回復を選ぶ | `Same → UX-000004` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 複数AIへ仕事を委ねる時<br>現在REQのTrigger: AgentやRuntimeから結果が戻る時<br>Trigger差: 既存UXの「複数AIへ仕事を委ねる時」に対して現在REQは「AgentやRuntimeから結果が戻る時」を具体化するが、同じ「失敗後の再試行・回復を選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる<br>現在REQのOutcome: Evidenceと未確認範囲を保って採否を判断できる<br>Outcome差: 既存UXの「失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる」に対して現在REQは「Evidenceと未確認範囲を保って採否を判断できる」と要求固有に表すが、後者は同じ「失敗後の再試行・回復を選ぶ」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 失敗後に状態確認・再試行・回復を取り違え、二重Effectを起こす<br>現在REQのFailure: 結果帰還の失敗を実行失敗とみなし、生成済み結果を確認せずTaskを再実行する<br>Failure差: 現在REQは結果搬送失敗を契機として追加するが、誤再試行による二重Effectは同じである<br>同一Outcomeへ統合できる理由: 帰還状態は同じ回復選択成果に必要な判断情報である | Task Identity・Result・Evidence・帰還状態を照合することが、この要求固有の成立条件になる |
| Project・Repository・Rootを区別して対象を選ぶ | `Same → UX-000011` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 参照または操作対象を選ぶ時<br>現在REQのTrigger: AgentやRuntimeから結果が戻る時<br>Trigger差: 既存UXの「参照または操作対象を選ぶ時」に対して現在REQは「AgentやRuntimeから結果が戻る時」を具体化するが、同じ「Project・Repository・Rootを区別して対象を選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる<br>現在REQのOutcome: Evidenceと未確認範囲を保って採否を判断できる<br>Outcome差: 既存UXの「論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる」に対して現在REQは「Evidenceと未確認範囲を保って採否を判断できる」と要求固有に表すが、後者は同じ「Project・Repository・Rootを区別して対象を選ぶ」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: Project・Repository・Rootを混同し、別対象へ参照またはEffectを行う<br>現在REQのFailure: 別Project・別Revision・別Taskの結果を同じ帰還先へ混入する<br>Failure差: 現在REQは結果の帰還先を対象選択へ加えるが、Identityの違う対象を同一視する失敗は同じである<br>同一Outcomeへ統合できる理由: TaskとSource bindingは同じ対象選択成果のInformation条件である | Task Identity・Result・Evidence・帰還状態を照合することが、この要求固有の成立条件になる |
| 必要なContextを渡し結果を同じ仕事へ戻す | `Same → UX-000019` | 既存UXのActor: 外部Contextの所有者<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXの「外部Contextの所有者」に対して現在REQは「Project Operator／PM」だが、両者とも「必要なContextを渡し結果を同じ仕事へ戻す」を利用・確認する当事者であり、役割差だけでは別Outcomeにならない<br>既存UXのTrigger: 別AgentやToolへ仕事を渡す時<br>現在REQのTrigger: AgentやRuntimeから結果が戻る時<br>Trigger差: 既存UXの「別AgentやToolへ仕事を渡す時」に対して現在REQは「AgentやRuntimeから結果が戻る時」を具体化するが、同じ「必要なContextを渡し結果を同じ仕事へ戻す」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる<br>現在REQのOutcome: Evidenceと未確認範囲を保って採否を判断できる<br>Outcome差: 既存UXの「必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる」に対して現在REQは「Evidenceと未確認範囲を保って採否を判断できる」と要求固有に表すが、後者は同じ「必要なContextを渡し結果を同じ仕事へ戻す」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: Contextの出所またはTask相関を失い、結果を元の仕事へ安全に戻せない<br>現在REQのFailure: Result・Evidence・未確認範囲の一部が欠けるか、別Taskの結果を自動採用する<br>Failure差: 現在REQは帰還結果の完全性を詳しくするが、同じ仕事へ根拠付き結果を戻せない失敗は同じである<br>同一Outcomeへ統合できる理由: 結果完全性は同じContext往復成果のQuality／Validation条件である | Task Identity・Result・Evidence・帰還状態を照合することが、この要求固有の成立条件になる |
| 切断後も同じRequestへ戻る | `Same → UX-000021` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 応答喪失後に再接続する時<br>現在REQのTrigger: AgentやRuntimeから結果が戻る時<br>Trigger差: 既存UXの「応答喪失後に再接続する時」に対して現在REQは「AgentやRuntimeから結果が戻る時」を具体化するが、同じ「切断後も同じRequestへ戻る」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる<br>現在REQのOutcome: Evidenceと未確認範囲を保って採否を判断できる<br>Outcome差: 既存UXの「応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる」に対して現在REQは「Evidenceと未確認範囲を保って採否を判断できる」と要求固有に表すが、後者は同じ「切断後も同じRequestへ戻る」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 応答喪失後に新規実行し、同じRequestの状態・結果・回復義務へ戻れない<br>現在REQのFailure: 結果搬送が途切れた時、帰還済みか不明なTaskを新しいRequestとして扱う<br>Failure差: 切断位置は異なるが、同じRequest Identityへ戻らず重複または結果喪失を起こす失敗は同じである<br>同一Outcomeへ統合できる理由: 結果帰還状態の照合は同じ再接続成果を成立させる条件である | Task Identity・Result・Evidence・帰還状態を照合することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

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

### Service Blueprintの処置

処置: `作成`

```text
[U: Project Operator／PM]
        │ 利用者行動: 境界を越えた結果を同じTaskへ受け取る
        ▼
[T: AgentやRuntimeから結果が戻る時]
        │
        ├─ 処理・確認後: 結果、根拠、未成立範囲を受け取る
        └─ 失敗時: 別TaskやRevisionの結果を混入し自動採用するという停止理由、成立済み範囲、保持状態および再開条件
                     │
                     ▼
             [R: Project Operator／正本Owner]
                     │ 返却内容を確認
                     └─ 次の行動: 境界を越えた結果を同じTaskへ受け取る

---------------- 可視境界 ----------------
                     │ 処理・確認には時間差があり得る
                     ▼
[S: Agent／Runtime]
        └─ 提供責務: Result・Evidence・未確認範囲・帰還状態を同じTaskへ返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [外部Contextを送受信する](../../03_Experience_Map.md#外部contextを送受信する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 仕事を委ねた人 | Taskと帰還先を確認し、戻った結果の採否を判断する | 別TaskやRevisionの結果を同一視しない |
| Agent／Runtime | Result・Evidence・未確認範囲・帰還状態を同じTaskへ返す | Agent完了を成果物採用として表示しない |
| Project Operator／正本Owner | 候補を採用・却下・再作業へ振り分ける | 所有しない正本へ結果を自動反映しない |

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
