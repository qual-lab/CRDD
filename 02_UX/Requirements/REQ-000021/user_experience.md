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
| 失敗後の再試行・回復を選ぶ | `Same → UX-000004` | 利用者が得る最終成果は「失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる」で既存UX-000004と共通する。本要求が追加する条件は独立したGoal／Outcomeではないため、別IDへ分割しない。 | Request Identityと現在Accessを再確認することが、この要求固有の成立条件になる |
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
Project Operator／PM
        │ Request Identity
        ▼
Remote Runtime
        │ Durable Stateへ記録
        ▼
実行処理
        │ 切断・Timeout
        ▼
Remote Runtime
        │ 同じIdentityの状態・結果・回復義務
        ▼
再接続したProject Operator／PM
```

この図は、このREQで体験成立条件となる主体間の受け渡しを示す。詳細な責任と越えてはならない境界は次表で固定する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [RemoteでContextと結果へ戻る](../../03_Experience_Map.md#remoteでcontextと結果へ戻る)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Remote要求を行う人） | 切断後に同じRequestへ戻るために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | Request Identityと現在Accessを再確認するための状態、根拠および選択肢を示す | Timeoutを未実行とみなし新規Effectを起こす状態を成功・完了として表示しない |
| 運用・確認者 | 「同一Identityの照会を再実行より先に示す」ことと、二重実行せず状態・結果・回復義務を取得できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

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
