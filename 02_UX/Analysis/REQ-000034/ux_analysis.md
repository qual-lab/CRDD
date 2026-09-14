# REQ-000034の利用者体験分析

成果物種別: UX Analysis

状態: UX再統合済み・独立再レビュー待ち
分析対象: [REQ-000034 Repository固定Commitから使える標準Tool](../../../01_Discovery/Definitions/REQ-000034/requirement.md)

## 1. REQの一次分析

```text
別配布ToolとのVersion対応を手で調べ、誤った組合せで実行する
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Repositoryに対応する標準Toolを迷わず使う
```

この要求で解くのはToolの有無だけではない。CRDD採用Repositoryの利用者が、取得した固定Commitに対応するTool／Runtimeを自分で別Releaseと照合せず、版不一致や改ざんを避けて利用できる状態へ進めないことを問題として扱う。具体的な配布方式、OS別形式または更新頻度はここで確定しない。

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
固定Commitに対応するTool／Runtimeを手動Version照合なしに利用できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Developer」 |
| 利用場面 | Toolを導入または起動する時 |
| Goal | Repositoryに対応する標準Toolを迷わず使う |
| Outcome | 固定Commitに対応するTool／Runtimeを手動Version照合なしに利用できる |
| REQ固有の差 | Commit・配布集合・Manifest・RuntimeのBindingが検証できることが成立条件になる |
| 根拠・確信度 | 採用要求から導いた仮説。fresh cloneとsubmoduleで入口発見から代表起動まで迷わず進めるかは未確認。 |

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

この変化で守るのは特定の配布方式ではない。CRDD採用Repositoryの利用者が、Repositoryに対応する標準Toolを迷わず選び、固定Commit対応のTool／Runtimeを手動Version照合なしに利用できることを守る。

## 4. UX成果への統合

```text
REQ-000034
   │
   └─ Same → UX-000016 仕事に必要な標準Toolを迷わず選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 仕事に必要な標準Toolを迷わず選ぶ | `Same → UX-000016` | 既存UXと本要求は、現在Repositoryと目的に対応するToolを発見し、適切な入口を選ぶ同じ成果を扱う。本要求は固定Commit、配布集合、Manifest、Runtimeの整合と、別Releaseの手動照合を不要にする条件を追加する。 | 版不一致・欠落Runtime・改ざんManifestを対応版と誤認せず、固定Commit対応Toolを起動する |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Toolを導入または起動する時
        ↓
Commit・配布集合・Manifest・Runtimeの対応を確認する
        │
        ├─ ★ Critical: 発見したTool／Runtimeを起動する直前
        ├─ ⚠ Failure:  版不一致・欠落Runtime・改ざんManifestを対応版と誤認する
        └─ ✓ Quality:  固定Commitと配布物の対応を検証し、不一致はEffect前に拒否する
        ↓
固定Commitに対応するTool／Runtimeを手動Version照合なしに利用できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: CRDD採用Repositoryの利用者]
        │ 利用者行動: Repositoryから標準Tool入口を発見して起動する
        ▼
[T: Toolを導入または起動する時]
        │
        ├─ 時間差: clone／submodule取得後、起動時にCommitと配布物の対応を確認する
        ├─ 完了時: Repository Commit、Manifest、配布集合、Runtime Identity、代表起動結果
        └─ 失敗時: 版不一致・欠落・改ざんをCRDD／Tool Publisherへ返す
                     │
                     ▼
             [R: CRDD／Tool Publisher]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 正しい固定Commit／配布物を取得するか、配布状態の確認を依頼する

---------------- 可視境界 ----------------
                     │ 時間関係: Repository取得とTool起動の間に配布物が別更新されても固定Commitを基準にする
                     ▼
[S: 提供System]
        └─ 提供責務: 固定CommitとManifest／Runtimeの対応を検証して起動する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| CRDD／Tool Publisher | 固定Commitに対応するManifestとRuntimeを同梱・提示する | 別Releaseとの手動照合を利用者へ転嫁しない |
| Repository利用者 | Repositoryから標準入口を選び、不一致時は起動を止める | 名前やVersionを推測して別配布物を混ぜない |
| 提供System | Commit・配布集合・Manifest・Runtimeを検証して起動する | 不一致・欠落・改ざん状態でCapabilityを発行しない |

### 補足する品質

- Toolを発見する時: 現在の固定Commitに対応する入口を提示し、別Releaseの手動照合を要求しない。
- 起動する時: Commit・配布集合・Manifest・Runtimeの不一致、欠落または改ざんをEffect前に拒否する。
- 拒否された時: 不整合の対象と正しい取得先を示し、Version推測を利用者へ要求しない。


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

Discoveryへ戻す条件は、想定した利用者、問題または「Repositoryに対応する標準Toolを迷わず使う」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「固定Commitに対応するTool／Runtimeを手動Version照合なしに利用できる」という成果を無断で弱めない。
