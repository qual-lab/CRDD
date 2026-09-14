# REQ-000009の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000009` Project・Repository・Root Identity分離
探索元: [Repository横断Project Context](../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)

## 1. REQの一次分析

```text
Repository名や配置から論理Projectを推測する／横断結果の操作対象が曖昧になる
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Project・Repository・Rootを区別して対象を確認する
```

この要求で解くのは機能の有無だけではない。Project Operator／Runtime利用者が「論理Projectを一つに見ながら誤った場所へ作用しない」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Repository名や配置から論理Projectを推測する／横断結果の操作対象が曖昧になる |
| UX Need | Project・Repository・Rootを区別して対象を確認する |
| 対象範囲 | Project Operator、Repository管理者が、「Repository名や配置から論理Projectを推測する」状態から「一つのProjectとして見ながら、必要時に各Sourceへ辿る」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Project Operator／Runtime利用者
        │
        │ wants to
        ▼
Project・Repository・Rootを区別して対象を確認する
        │
        │ so that
        ▼
論理Projectを一つに見ながら誤った場所へ作用しない
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | 参照または操作対象を選ぶ時 |
| Goal | Project・Repository・Rootを区別して対象を確認する |
| Outcome | 論理Projectを一つに見ながら誤った場所へ作用しない |
| REQ固有の差 | Identityと検証済みRootを確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「Project・Repository・Rootを区別して対象を確認する」を判断する場面で、Identityと検証済みRootを確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Repository名や配置から論理Projectを推測する
- 横断結果の操作対象が曖昧になる
        │
        │ Project・Repository・Root Identity分離が変える体験
        ▼
After
────────────────
- 一つのProjectとして見ながら、必要時に各Sourceへ辿る
- Project、Repository、検証済みRootを区別して確認できる
```

一つのProjectが複数Repositoryに分かれても、利用者は物理配置から案件全体を再構成したくない。一方、異なるRepositoryやRootを同一視すると、根拠と操作対象を取り違える。

この変化で守るのは操作手順ではない。Project Operator／Runtime利用者がProject・Repository・Rootを区別して対象を確認することで、論理Projectを一つに見ながら誤った場所へ作用しないようになることを守る。

## 4. UX成果への統合

```text
REQ-000009
   │
   ├─ Same → UX-000009 Projectの現在地を根拠と不完全性付きで理解する
   └─ New  → UX-000011 Project・Repository・Rootを区別して対象を選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Projectの現在地を根拠と不完全性付きで理解する | `Same → UX-000009` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: Project状況を確認する時<br>現在REQのTrigger: 参照または操作対象を選ぶ時<br>Trigger差: 既存UXの「Project状況を確認する時」に対して現在REQは「参照または操作対象を選ぶ時」を具体化するが、同じ「Projectの現在地を根拠と不完全性付きで理解する」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる<br>現在REQのOutcome: 検証済みRepository／RootをSourceとして選び、別の場所の状態をProjectの現在値と誤認せず理解できる<br>Outcome差: 現在REQは「Projectの現在地を根拠と不完全性付きで理解する」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: 欠測・制限・競合・古さを完全なProject現在値として信じる<br>現在REQのFailure: 同名または近いPathを同じRepositoryと誤認し、誤ったSourceからProject状態を読む<br>Failure差: 現在REQは誤ったSource選択を原因として追加するが、誤ったProject現在地を理解する失敗へ収束する<br>同一Outcomeへ統合できる理由: Identity確認は根拠付きProject理解を成立させる情報条件であり、別成果ではない | Identityと検証済みRootを確認することが、この要求固有の成立条件になる |
| Project・Repository・Rootを区別して対象を選ぶ | `New → UX-000011` | 本要求が「論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる」という独立した利用者成果を最初に定義する。 | Identityと検証済みRootを確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
参照または操作対象を選ぶ時
        ↓
Identityと検証済みRootを確認する
        │
        ├─ ★ Critical: Effect対象を確定する直前
        ├─ ⚠ Failure:  同名や近いPathを同じ対象と誤認する
        └─ ✓ Quality:  各Identityと物理Rootの結合を明示する
        ↓
論理Projectを一つに見ながら誤った場所へ作用しない
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Project Operator／PM]
        │ 利用者行動: 目的に合う対象候補を選び、確認結果から実行可否を判断する
        ▼
[T: 参照または操作対象を選ぶ時]
        │
        ├─ 時間差: Identity確認は参照・Effect前に完了し、曖昧ならその場で停止する
        ├─ 完了時: Project・Repository・RootのIdentityとBinding
        └─ 失敗時: 一致しないIdentityと未検証Rootを運用・確認者へ返す
                     │
                     ▼
             [R: 運用・確認者]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 対象を選び直すか、Binding確認を依頼する

---------------- 可視境界 ----------------
                     │ 時間関係: Identity確認は参照・Effect前に完了し、曖昧ならその場で停止する
                     ▼
[S: 提供System]
        └─ 提供責務: Identityと検証済みRootを照合し、exactな対象または拒否理由を返す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Projectの現在地を判断する](../../03_Experience_Map.md#projectの現在地を判断する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Project Operator／PM | 目的に合う対象候補を選び、確認結果から実行可否を判断する | 名前やPathの類似だけで同一対象と決めない |
| 提供System | Identityと検証済みRootを照合し、exactな対象または拒否理由を返す | 曖昧な対象へEffectを発行しない |
| 運用・確認者 | 誤結合・Root外・観測不能の反例を確認する | 読取り可能性を実行権限へ読み替えない |

### 補足する品質

- 結果または状態を最初に受け取る時: 同じProject IDを持つRepositoryを一つのViewで理解できる。（避ける失敗: Repository名や配置から論理Projectを推測する）
- 結果を判断または引き継ぐ時: 名前の一致だけでRepositoryやRootを同一とみなさない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: 変更操作前には対象RepositoryとAuthorityを確認できる。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 利用できないRepositoryの内容を推測で補完しない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 一つのProjectとして見ながら、必要時に各Sourceへ辿る／Project、Repository、検証済みRootを区別して確認できることで、Repository名や配置から論理Projectを推測するという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「Project・Repository・Rootを区別して対象を確認する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはProject、Repository、RootおよびBindingを別Entityとして関連付ける。UIは通常表示とSource詳細を分け、Architectureは検証済みIdentityを公開結果まで保持する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Project・Repository・Rootを区別して対象を確認する」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「論理Projectを一つに見ながら誤った場所へ作用しない」という成果を無断で弱めない。
