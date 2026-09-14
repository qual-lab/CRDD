# REQ-000023の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000023` 異なるAI Runtime LifecycleのAdapter分離
探索元: [EXP-000026](../../../01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md)

## 1. REQの一次分析

```text
名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Provider固有LifecycleをAdapter越しに正確に扱う
```

この要求で解くのは機能の有無だけではない。Runtime保守者・運用者が「Provider差を隠さず共通Runtimeから安全に利用できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる |
| UX Need | Provider固有LifecycleをAdapter越しに正確に扱う |
| 対象範囲 | AI Runtimeを追加・利用する人が、「名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる」状態から「現在Runtimeが対応するLifecycleと未対応範囲を理解し、適切なAdapter経由で利用できる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Runtime保守者・運用者
        │
        │ wants to
        ▼
Provider固有LifecycleをAdapter越しに正確に扱う
        │
        │ so that
        ▼
Provider差を隠さず共通Runtimeから安全に利用できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| 利用場面 | Providerを選択・取消・回復する時 |
| Goal | Provider固有LifecycleをAdapter越しに正確に扱う |
| Outcome | Provider差を隠さず共通Runtimeから安全に利用できる |
| REQ固有の差 | 現在CapabilityとLifecycle Semanticsを確認することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Runtime導入・運用者が「Provider固有LifecycleをAdapter越しに正確に扱う」を判断する場面で、現在CapabilityとLifecycle Semanticsを確認することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる
        │
        │ 異なるAI Runtime LifecycleのAdapter分離が変える体験
        ▼
After
────────────────
- 現在Runtimeが対応するLifecycleと未対応範囲を理解し、適切なAdapter経由で利用できる
```

異なるAI 異なるAI Runtime LifecycleのAdapter分離は、単に内部方式を成立させる要求ではない。「名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる」状態から、「現在Runtimeが対応するLifecycleと未対応範囲を理解し、適切なAdapter経由で利用できる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Runtime保守者・運用者がProvider固有LifecycleをAdapter越しに正確に扱うことで、Provider差を隠さず共通Runtimeから安全に利用できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000023
   │
   ├─ Same → UX-000007 内部変更後も成立済み能力を安全に使う
   └─ Same → UX-000008 故障した境界と影響範囲を理解する
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 内部変更後も成立済み能力を安全に使う | `Same → UX-000007` | 既存UXのFailure: 内部責務やAdapterの変更後に公開Capabilityが退行する<br>現在REQのFailure: Provider固有Lifecycleを共通挙動と仮定し、差し替え後に開始・取消・回復が壊れる<br>Failure差: 現在REQはProvider Adapterの差を原因として具体化するが、内部変更後に成立済み能力を失う失敗は同じである<br>同一Outcomeへ統合できる理由: Provider lifecycle適合は同じ成果を守るArchitecture／Validation条件である | 現在CapabilityとLifecycle Semanticsを確認することが、この要求固有の成立条件になる |
| 故障した境界と影響範囲を理解する | `Same → UX-000008` | 既存UXのFailure: 故障した入口・実行・結果搬送の境界が分からず、影響を全体へ広げる<br>現在REQのFailure: Providerの設定不能・開始失敗・取消不能・回復待ちを同じ失敗として扱う<br>Failure差: Provider固有状態が加わるが、故障点と利用可能範囲を理解できない失敗は同じである<br>同一Outcomeへ統合できる理由: Lifecycle状態の外在化は同じ故障理解成果の診断条件である | 現在CapabilityとLifecycle Semanticsを確認することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Providerを選択・取消・回復する時
        ↓
現在CapabilityとLifecycle Semanticsを確認する
        │
        ├─ ★ Critical: Provider Effectと完了観測の境界
        ├─ ⚠ Failure:  設定可能を実行可能とみなし同じ取消挙動を仮定する
        └─ ✓ Quality:  開始・完了・取消・回復差を外在化する
        ↓
Provider差を隠さず共通Runtimeから安全に利用できる
```

### Service Blueprintの処置

処置: `作成`

```text
Runtime導入・運用者
        │ [接点] Provider候補と必要な処理を選ぶ
        ▼
提供System
        │ Provider固有の利用可否・開始・取消・回復差を確認
        ▼
Provider
        │ 実行状態・結果・残存状態を返す
        ▼
[接点] 共通状態とProvider固有差
        │
        ▼
Runtime導入・運用者
        └─ 失敗時: 設定可能を実行可能とみなし同じ取消挙動を仮定する場合は成功へ進めず、判断または回復を担う主体へ戻す
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Runtime導入・運用者 | Provider差と現在状態を理解して開始・取消・回復を選ぶ | 設定可能を実行可能とみなさない |
| 提供System | Provider固有Lifecycleを失わず共通の判断材料として返す | 異なる取消・回復を同一挙動と仮定しない |
| Provider | 実際の受理・開始・完了・残存状態を通知する | 要求受理をEffect完了として報告しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 設定可能を実行可能と見せない。（避ける失敗: 名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる）
- 結果を判断または引き継ぐ時: Provider固有の停止・回復差を隠さない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 未対応RuntimeはEffect前に停止する。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 現在Runtimeが対応するLifecycleと未対応範囲を理解し、適切なAdapter経由で利用できることで、名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れるという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Runtime導入・運用者が「Provider固有LifecycleをAdapter越しに正確に扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | ArchitectureはAdapter境界を、SPECとVerificationはRuntimeごとのLifecycleと診断を具体化する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Provider固有LifecycleをAdapter越しに正確に扱う」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「Provider差を隠さず共通Runtimeから安全に利用できる」という成果を無断で弱めない。
