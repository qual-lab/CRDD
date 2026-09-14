# REQ-000003の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000003` Objectiveから統合までのProject Lifecycle
探索元: [Project Runtime](../../../01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md)

## 1. REQの一次分析

```text
Task数、Agent log、個別結果から進捗を組み立て直す／内部処理の節目ごとに再指示する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Objectiveと受入条件でMilestoneを委ねる
```

この要求で解くのは機能の有無だけではない。Project Operator／PMが「内部Taskを追わず統合済みの完成を判断できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Task数、Agent log、個別結果から進捗を組み立て直す／内部処理の節目ごとに再指示する |
| UX Need | Objectiveと受入条件でMilestoneを委ねる |
| 対象範囲 | Project Operator、Objectiveの決定権限者が、「Task数、Agent log、個別結果から進捗を組み立て直す」状態から「Milestoneの成立状態、判断待ち、統合結果をProjectの仕事として理解する」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Project Operator／PM
        │
        │ wants to
        ▼
Objectiveと受入条件でMilestoneを委ねる
        │
        │ so that
        ▼
内部Taskを追わず統合済みの完成を判断できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | Projectの成果をまとめて任せる時 |
| Goal | Objectiveと受入条件でMilestoneを委ねる |
| Outcome | 内部Taskを追わず統合済みの完成を判断できる |
| REQ固有の差 | 目的・受入条件・判断点を渡すことが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「Objectiveと受入条件でMilestoneを委ねる」を判断する場面で、目的・受入条件・判断点を渡すことが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Task数、Agent log、個別結果から進捗を組み立て直す
- 内部処理の節目ごとに再指示する
        │
        │ Objectiveから統合までのProject Lifecycleが変える体験
        ▼
After
────────────────
- Milestoneの成立状態、判断待ち、統合結果をProjectの仕事として理解する
- 許可済みの目標範囲では進行を委ね、判断が必要な時だけ戻される
```

人間が内部Taskを一つずつ起動・監視しても、Projectの目的が成立したかは分からない。利用者が委ねたいのはTask実行ではなく、Objectiveを受け入れ可能な結果へ進める一連の仕事である。

この変化で守るのは操作手順ではない。Project Operator／PMがObjectiveと受入条件でMilestoneを委ねることで、内部Taskを追わず統合済みの完成を判断できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000003
   │
   ├─ Same → UX-000002 委任範囲と権限を理解して任せる
   ├─ Same → UX-000003 委任中の状態と判断要否を理解する
   ├─ Same → UX-000004 失敗後の再試行・回復を選ぶ
   └─ New  → UX-000005 目的と受入条件でMilestoneを委ねる
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 委任範囲と権限を理解して任せる | `Same → UX-000002` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 複数AIへ仕事を委ねる時<br>現在REQのTrigger: Projectの成果をまとめて任せる時<br>Trigger差: 既存UXの「複数AIへ仕事を委ねる時」に対して現在REQは「Projectの成果をまとめて任せる時」を具体化するが、同じ「委任範囲と権限を理解して任せる」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる<br>現在REQのOutcome: 内部Taskを追わず統合済みの完成を判断できる<br>Outcome差: 既存UXの「実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる」に対して現在REQは「内部Taskを追わず統合済みの完成を判断できる」と要求固有に表すが、後者は同じ「委任範囲と権限を理解して任せる」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 委任範囲や実行権限が曖昧なまま仕事を開始し、暗黙に対象が広がる<br>現在REQのFailure: Milestone委任で目的・受入条件・人間へ戻す判断点が欠け、内部Taskへ委任範囲が流出する<br>Failure差: 委任の粒度は異なるが、どちらも実行前に任せる範囲と権限を理解できない失敗である<br>同一Outcomeへ統合できる理由: 目的・受入条件・判断点は同じ委任成果をMilestone単位で成立させる条件であり、別の利用者成果ではない | 目的・受入条件・判断点を渡すことが、この要求固有の成立条件になる |
| 委任中の状態と判断要否を理解する | `Same → UX-000003` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 複数AIへ仕事を委ねる時<br>現在REQのTrigger: Projectの成果をまとめて任せる時<br>Trigger差: 既存UXの「複数AIへ仕事を委ねる時」に対して現在REQは「Projectの成果をまとめて任せる時」を具体化するが、同じ「委任中の状態と判断要否を理解する」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 内部logを読まず、実行中・待機・停止と現在必要な判断を理解できる<br>現在REQのOutcome: 内部Taskを追わず統合済みの完成を判断できる<br>Outcome差: 既存UXの「内部logを読まず、実行中・待機・停止と現在必要な判断を理解できる」に対して現在REQは「内部Taskを追わず統合済みの完成を判断できる」と要求固有に表すが、後者は同じ「委任中の状態と判断要否を理解する」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 実行中・待機・停止と判断要否を区別できず、内部logから状態を推測する<br>現在REQのFailure: 個別Taskの進行だけが見え、Milestone全体の統合状態と現在必要な判断が分からない<br>Failure差: 観測粒度は異なるが、どちらも委任中の現在地と人間の次行動を理解できない失敗である<br>同一Outcomeへ統合できる理由: Milestone状態は同じ状態理解成果の上位集約であり、独立したGoal／Outcomeを追加しない | 目的・受入条件・判断点を渡すことが、この要求固有の成立条件になる |
| 失敗後の再試行・回復を選ぶ | `Same → UX-000004` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 複数AIへ仕事を委ねる時<br>現在REQのTrigger: Projectの成果をまとめて任せる時<br>Trigger差: 既存UXの「複数AIへ仕事を委ねる時」に対して現在REQは「Projectの成果をまとめて任せる時」を具体化するが、同じ「失敗後の再試行・回復を選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる<br>現在REQのOutcome: 内部Taskを追わず統合済みの完成を判断できる<br>Outcome差: 既存UXの「失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる」に対して現在REQは「内部Taskを追わず統合済みの完成を判断できる」と要求固有に表すが、後者は同じ「失敗後の再試行・回復を選ぶ」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 失敗後に状態確認・再試行・回復・清掃を取り違え、二重Effectまたは回復不能を起こす<br>現在REQのFailure: Milestone内の部分失敗を全体失敗とみなし、Task再実行とProject回復を取り違える<br>Failure差: 対象範囲は異なるが、どちらも失敗後の処置選択を誤ることで仕事またはEffectを損なう<br>同一Outcomeへ統合できる理由: Milestone固有の失敗状態は同じ回復選択成果の判断材料であり、別成果ではない | 目的・受入条件・判断点を渡すことが、この要求固有の成立条件になる |
| 目的と受入条件でMilestoneを委ねる | `New → UX-000005` | 本要求が「内部Taskを逐次操作せず、目的・受入条件・統合状態からMilestoneの完成と必要な判断を理解できる」という独立した利用者成果を最初に定義する。 | 目的・受入条件・判断点を渡すことが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Projectの成果をまとめて任せる時
        ↓
目的・受入条件・判断点を渡す
        │
        ├─ ★ Critical: Task成功とMilestone完成を区別する
        ├─ ⚠ Failure:  Task件数を完成と誤認する
        └─ ✓ Quality:  統合・品質・判断待ちを分けて示す
        ↓
内部Taskを追わず統合済みの完成を判断できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Project Operator／PM]
        │ 利用者行動: Objective・受入条件・判断点を渡し、Milestoneの採否を判断する
        ▼
[T: Projectの成果をまとめて任せる時]
        │
        ├─ 処理・確認後: 結果、根拠、未成立範囲を受け取る
        └─ 失敗時: Task件数を完成と誤認するという停止理由、成立済み範囲、保持状態および再開条件
                     │
                     ▼
             [R: 品質確認者]
                     │ 返却内容を確認
                     └─ 次の行動: Objective・受入条件・判断点を渡し、Milestoneの採否を判断する

---------------- 可視境界 ----------------
                     │ 処理・確認には時間差があり得る
                     ▼
[S: 提供System／AI]
        └─ 提供責務: 内部Taskを編成し、統合状態と判断待ちを返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Projectの現在地を判断する](../../03_Experience_Map.md#projectの現在地を判断する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Project Operator／PM | Objective・受入条件・判断点を渡し、Milestoneの採否を判断する | Task件数だけから完成を推定しない |
| 提供System／AI | 内部Taskを編成し、統合状態と判断待ちを返す | 部分成功をMilestone完成へ畳まない |
| 品質確認者 | 受入・統合・品質の成立を反証する | 未確認範囲を便宜的に完了へ変えない |

### 補足する品質

- 結果または状態を最初に受け取る時: 依頼時にObjective、受入条件および委ねる範囲を理解できる。（避ける失敗: Task数、Agent log、個別結果から進捗を組み立て直す）
- 結果を判断または引き継ぐ時: 進行中は内部Taskを読まなくても、現在地と次の判断要否が分かる。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: 部分Task成功をMilestone完成と表示しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 失敗時は、失われた仕事、保持された結果、再開条件を区別する。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| Milestoneの成立状態、判断待ち、統合結果をProjectの仕事として理解する／許可済みの目標範囲では進行を委ね、判断が必要な時だけ戻されることで、Task数、Agent log、個別結果から進捗を組み立て直すという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「Objectiveと受入条件でMilestoneを委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはObjective、Milestone、Task、Integration、QualityおよびDecisionの関係を分ける。SPECとArchitectureは各状態の成立条件と再開契約を具体化し、総合試験はTask数でなく一連の委任体験を確認する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Objectiveと受入条件でMilestoneを委ねる」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「内部Taskを追わず統合済みの完成を判断できる」という成果を無断で弱めない。
