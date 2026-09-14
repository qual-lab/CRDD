# REQ-000021の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000021` Remote要求結果の同一Identity再取得
探索元: [Remote Project Context](../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)

## 1. REQの一次分析

```text
Timeout後に同じ依頼を新規実行する／応答喪失と処理失敗を同一視する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
切断後に同じRequestへ戻る
```

この要求で解くのは機能の有無だけではない。Remote要求を行う人が「二重実行せず状態・結果・回復義務を取得できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Timeout後に同じ依頼を新規実行する／応答喪失と処理失敗を同一視する |
| UX Need | 切断後に同じRequestへ戻る |
| 対象範囲 | Remote要求を行う人、運用者が、「Timeout後に同じ依頼を新規実行する」状態から「同じRequest Identityから状態、結果、回復義務を再取得する」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Remote要求を行う人
        │
        │ wants to
        ▼
切断後に同じRequestへ戻る
        │
        │ so that
        ▼
二重実行せず状態・結果・回復義務を取得できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | 応答喪失後に再接続する時 |
| Goal | 切断後に同じRequestへ戻る |
| Outcome | 二重実行せず状態・結果・回復義務を取得できる |
| REQ固有の差 | Request Identityと現在Accessを再確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「切断後に同じRequestへ戻る」を判断する場面で、Request Identityと現在Accessを再確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Timeout後に同じ依頼を新規実行する
- 応答喪失と処理失敗を同一視する
        │
        │ Remote要求結果の同一Identity再取得が変える体験
        ▼
After
────────────────
- 同じRequest Identityから状態、結果、回復義務を再取得する
- Effectの成立、結果搬送、観測不能を区別する
```

Remote要求の応答が消えた時、同じ操作を再実行すると二重Effectの危険がある。利用者は「失敗した」と推測するのでなく、元の要求へ戻って現在状態を確認できる必要がある。

この変化で守るのは操作手順ではない。Remote要求を行う人が切断後に同じRequestへ戻ることで、二重実行せず状態・結果・回復義務を取得できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000021
   │
   ├─ Same → UX-000004 失敗後の再試行・回復を選ぶ
   └─ New  → UX-000021 切断後も同じRequestへ戻る
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 失敗後の再試行・回復を選ぶ | `Same → UX-000004` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 複数AIへ仕事を委ねる時<br>現在REQのTrigger: 応答喪失後に再接続する時<br>Trigger差: 既存UXの「複数AIへ仕事を委ねる時」に対して現在REQは「応答喪失後に再接続する時」を具体化するが、同じ「失敗後の再試行・回復を選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる<br>現在REQのOutcome: 二重実行せず状態・結果・回復義務を取得できる<br>Outcome差: 既存UXの「失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる」に対して現在REQは「二重実行せず状態・結果・回復義務を取得できる」と要求固有に表すが、後者は同じ「失敗後の再試行・回復を選ぶ」が成立した時の局所的な現れであり、別に採用・置換・検証するOutcomeではない<br>既存UXのFailure: 失敗後に状態確認・再試行・回復・清掃を取り違え、二重Effectを起こす<br>現在REQのFailure: Timeoutを未実行とみなし、同じRequestを確認せず新規Effectを開始する<br>Failure差: 現在REQは応答喪失という具体的な失敗契機を追加するが、誤った再試行選択による二重Effectは同じである<br>同一Outcomeへ統合できる理由: Request再取得は同じ回復選択成果の成立条件であり、別Outcomeではない | Request Identityと現在Accessを再確認することが、この要求固有の成立条件になる |
| 切断後も同じRequestへ戻る | `New → UX-000021` | 本要求が「応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる」という独立した利用者成果を最初に定義する。 | Request Identityと現在Accessを再確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
応答喪失後に再接続する時
        ↓
Request Identityと現在Accessを再確認する
        │
        ├─ ★ Critical: 再実行するか判断する直前
        ├─ ⚠ Failure:  Timeoutを未実行とみなし新規Effectを起こす
        └─ ✓ Quality:  同一Identityの照会を再実行より先に示す
        ↓
二重実行せず状態・結果・回復義務を取得できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Project Operator／PM]
        │ 利用者行動: 既存Requestを指定して再接続し、次の処置を判断する
        ▼
[T: 応答喪失後に再接続する時]
        │
        ├─ 処理・確認後: 結果、根拠、未成立範囲を受け取る
        └─ 失敗時: Timeoutを未実行とみなし新規Effectを起こすという停止理由、成立済み範囲、保持状態および再開条件
                     │
                     ▼
             [R: 運用・確認者]
                     │ 返却内容を確認
                     └─ 次の行動: 既存Requestを指定して再接続し、次の処置を判断する

---------------- 可視境界 ----------------
                     │ 処理・確認には時間差があり得る
                     ▼
[S: 提供System]
        └─ 提供責務: 同じIdentityの状態・結果・回復義務を保持し現在Accessで返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [RemoteでContextと結果へ戻る](../../03_Experience_Map.md#remoteでcontextと結果へ戻る)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Project Operator／PM | 既存Requestを指定して再接続し、次の処置を判断する | Timeoutだけで未実行と決めて新規Effectを起こさない |
| 提供System | 同じIdentityの状態・結果・回復義務を保持し現在Accessで返す | 古いSession権限や不明な結果を成功へ畳まない |
| 運用・確認者 | 切断前後のIdentity、Effect、再取得を反証する | 再接続成功だけから二重Effect不存在を推定しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 切断後もRequest Identityを失わない。（避ける失敗: Timeout後に同じ依頼を新規実行する）
- 結果を判断または引き継ぐ時: 状態不明を失敗や未実行へ畳まない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: 再接続時に別・拡大Authorityを生成しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: Recoveryが必要なら対象と次の操作を一意に示す。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 同じRequest Identityから状態、結果、回復義務を再取得する／Effectの成立、結果搬送、観測不能を区別することで、Timeout後に同じ依頼を新規実行するという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「切断後に同じRequestへ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはRequest、Attempt、Result、DeliveryおよびRecoveryを関連付ける。SPEC／Architectureは冪等な照会と再入場を分け、System Testは切断を含むLifecycle全体を確認する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「切断後に同じRequestへ戻る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「二重実行せず状態・結果・回復義務を取得できる」という成果を無断で弱めない。
