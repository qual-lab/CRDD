# REQ-000028の利用者体験分析

成果物種別: UX Analysis

状態: UX再統合済み・独立再レビュー待ち
分析対象: [REQ-000028 AI入口と共通正本の分離](../../../01_Discovery/Definitions/REQ-000028/requirement.md)

## 1. REQの一次分析

```text
入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
入口が違っても同じCRDD正本と判断境界を使う
```

この要求で解くのは機能の有無だけではない。Chat Agent／Coding Agentを使う人が「会話全文の転記なしで対話と構築を往復できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる |
| UX Need | 入口が違っても同じCRDD正本と判断境界を使う |
| 対象範囲 | Chat Agent・Coding Agentを使う人が、「入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる」状態から「どのAI入口からでも同じ正本と境界へ案内され、入口固有差だけを理解すればよい」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Chat Agent／Coding Agentを使う人
        │
        │ wants to
        ▼
入口が違っても同じCRDD正本と判断境界を使う
        │
        │ so that
        ▼
会話全文の転記なしで対話と構築を往復できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| 利用場面 | ChatからCodingまたは逆へ引き継ぐ時 |
| Goal | 入口が違っても同じCRDD正本と判断境界を使う |
| Outcome | 会話全文の転記なしで対話と構築を往復できる |
| REQ固有の差 | Agent Operating ContextとTask Identityを渡すことが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Developerが「入口が違っても同じCRDD正本と判断境界を使う」を判断する場面で、Agent Operating ContextとTask Identityを渡すことが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる
        │
        │ AI入口と共通正本の分離が変える体験
        ▼
After
────────────────
- どのAI入口からでも同じ正本と境界へ案内され、入口固有差だけを理解すればよい
```

AI入口と共通正本の分離は、単に内部方式を成立させる要求ではない。「入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる」状態から、「どのAI入口からでも同じ正本と境界へ案内され、入口固有差だけを理解すればよい」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Chat Agent／Coding Agentを使う人が入口が違っても同じCRDD正本と判断境界を使うことで、会話全文の転記なしで対話と構築を往復できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000028
   │
   └─ Same → UX-000019 必要なContextを渡し結果を同じ仕事へ戻す
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 必要なContextを渡し結果を同じ仕事へ戻す | `Same → UX-000019` | 既存UXのActor: 外部Contextの所有者<br>現在REQのActor: Developer<br>Actor差: 既存UXの「外部Contextの所有者」に対して現在REQは「Developer」だが、両者とも「必要なContextを渡し結果を同じ仕事へ戻す」を利用・確認する当事者であり、役割差だけでは別Outcomeにならない<br>既存UXのTrigger: 別AgentやToolへ仕事を渡す時<br>現在REQのTrigger: ChatからCodingまたは逆へ引き継ぐ時<br>Trigger差: 既存UXの「別AgentやToolへ仕事を渡す時」に対して現在REQは「ChatからCodingまたは逆へ引き継ぐ時」を具体化するが、同じ「必要なContextを渡し結果を同じ仕事へ戻す」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる<br>現在REQのOutcome: ChatとCodingの入口間で会話全文を複製せず、正本・判断境界・Task Identityを渡して同じ仕事へ結果を戻せる<br>Outcome差: 現在REQは「必要なContextを渡し結果を同じ仕事へ戻す」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: Contextの出所・現行性・Task相関を失い、結果を同じ仕事へ戻せない<br>現在REQのFailure: ChatとCodingの入口ごとに第二正本を作るか、会話全文を転記して不足をAIが補完する<br>Failure差: 入口間の引継ぎが追加されるが、正しいContextと結果を同じ仕事へ往復できない失敗は同じである<br>同一Outcomeへ統合できる理由: Agent Operating Contextは同じContext往復成果を入口間で成立させるInformation条件である | Agent Operating ContextとTask Identityを渡すことが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
ChatからCodingまたは逆へ引き継ぐ時
        ↓
Agent Operating ContextとTask Identityを渡す
        │
        ├─ ★ Critical: 別Agentが仕事を再構成する場面
        ├─ ⚠ Failure:  入口文書が第二正本になり不足をAIが補完する
        └─ ✓ Quality:  同じCanonical Sourceと明示した不足を使う
        ↓
会話全文の転記なしで対話と構築を往復できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Chat Agent／Coding Agentを使う人（Developer）]
        │ 利用者行動: 入口が違っても同じCRDD正本と判断境界を使う
        ▼
[T: ChatからCodingまたは逆へ引き継ぐ時]
        │
        ├─ 時間差: ChatとCodingの作業は別Sessionで進み、明示Handoff時に接続する
        ├─ 完了時: 参照正本、Task Identity、判断境界、帰還結果、未確認範囲
        └─ 失敗時: 不足Contextまたは別Task結果をChat Agent／Coding Agentを使う人へ返す
                     │
                     ▼
             [R: Chat Agent／Coding Agentを使う人（Developer）]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: Contextを補うか、同じ仕事として継続・採否判断する

---------------- 可視境界 ----------------
                     │ 時間関係: ChatとCodingの作業は別Sessionで進み、明示Handoff時に接続する
                     ▼
[S: Coding Agent]
        └─ 提供責務: 指定された正本から変更候補と検証結果を返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [対話と構築を往復する](../../03_Experience_Map.md#対話と構築を往復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Human／Chat Agent | 仕事の意図・参照正本・判断境界を選び結果を判断する | 会話全文を第二正本として渡さない |
| Coding Agent | 指定された正本から変更候補と検証結果を返す | 参照不能な不足を推測で補完しない |
| 提供System | 入口間でTask Identityと選択Contextを保持する | 別Taskの結果を現在の仕事へ混入しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 入口文書を第二の正本にしない。（避ける失敗: 入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になる）
- 結果を判断または引き継ぐ時: 接続済みを準拠やAuthorityの根拠にしない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 参照不能時に規則を推測補完しない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| どのAI入口からでも同じ正本と境界へ案内され、入口固有差だけを理解すればよいことで、入口ごとに複製された規則が食い違い、同じRepositoryで異なる判断になるという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Developerが「入口が違っても同じCRDD正本と判断境界を使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | DocumentationとAgent設計は案内と正本を分け、Verificationは複数入口で同じ基準が選ばれることを確認する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「入口が違っても同じCRDD正本と判断境界を使う」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「会話全文の転記なしで対話と構築を往復できる」という成果を無断で弱めない。
