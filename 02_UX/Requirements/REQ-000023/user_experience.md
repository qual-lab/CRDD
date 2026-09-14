# REQ-000023の利用者体験分析

状態: UX意味再分析済み・独立レビュー待ち
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
| 根拠・確信度 | 探索元の課題と採用要求から導いた設計上の想定。個人属性、利用頻度および許容負担は未実測。 |

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

全36要求を横断比較し、この要求から生じる成果候補をCanonical UX成果へ接続した。同じIDへ接続する場合も、要求固有の成立条件を失わない。

| UX成果候補 | 処置・接続先 | 判断理由とこの要求が補う内容 |
|---|---|---|
| 内部変更後の公開体験維持 | `Same → UX-000021` | `REQ-000005`と同じ「内部変更後の公開体験維持」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「異なるAI Runtime LifecycleのAdapter分離」はその成立条件を別の責務境界から補う。 |
| 故障範囲の理解 | `Same → UX-000022` | `REQ-000005`と同じ「故障範囲の理解」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「異なるAI Runtime LifecycleのAdapter分離」はその成立条件を別の責務境界から補う。 |
| Provider固有Lifecycleの正確な表示 | `New → UX-000050` | 「Providerごとの利用可能性、停止、取消、回復差を理解できる」を独立して変更・検証する成果である。REQ-000023では「Provider固有LifecycleをAdapter越しに正確に扱う」をGoalとし、Provider Effectと完了観測の境界に設定可能を実行可能とみなし同じ取消挙動を仮定することを防ぐため、既存成果への条件追加ではなくNewとして追跡する。 |

## 5. 重要な体験

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

### JourneyとSupporting Model

要求固有の区間は上のFlowが所有し、長い時間軸や複数主体との関係は次の既存成果物へ接続する。統合図をこの文書へ複製しない。

| Supporting Model | 処置 | 理由・参照先 |
|---|---|---|
| Experience Change | `作成` | 本文冒頭で、この要求が変える利用前後の仕事・認知・判断を示した。 |
| Experience Flow／Journey | `既存参照` | 本要求が関わる時間軸は[Runtimeを導入・更新・回復するJourney](../../03_Experience_Map.md#runtimeを導入更新回復する)を参照し、要求固有の区間は上表で示す。 |
| Service Blueprint | `非該当` | 本要求では複数主体の協調そのものを新しい体験成立条件にせず、必要な責任境界は次節で示す。 |
| User／Task Flow／Storyboard | `非該当` | 具体的な操作、画面遷移または利用環境の描写はIA／UIで具体化し、この要求分析では先取りしない。 |

### 責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Runtime保守者・運用者） | Provider固有LifecycleをAdapter越しに正確に扱うために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | 現在CapabilityとLifecycle Semanticsを確認するための状態、根拠および選択肢を示す | 設定可能を実行可能とみなし同じ取消挙動を仮定する状態を成功・完了として表示しない |
| 運用・確認者 | 「開始・完了・取消・回復差を外在化する」ことと、Provider差を隠さず共通Runtimeから安全に利用できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 重要場面・失敗・品質期待の対応

| 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|
| Provider Effectと完了観測の境界 | 設定可能を実行可能とみなし同じ取消挙動を仮定する | 開始・完了・取消・回復差を外在化する |

要求から得た追加の品質期待は次のとおりである。主Flowの品質を置き換えず、下流で具体化する観測点として保持する。

| 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|
| 結果または状態を最初に受け取る時 | 名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れる | 設定可能を実行可能と見せない。 |
| 結果を判断または引き継ぐ時 | 必要条件を満たしていないのに完了・正常と理解する | Provider固有の停止・回復差を隠さない。 |
| 失敗・不足から次の行動を選ぶ時 | 成立不能の理由や回復先が分からないまま作業が止まる | 未対応RuntimeはEffect前に停止する。 |

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
| 現在Runtimeが対応するLifecycleと未対応範囲を理解し、適切なAdapter経由で利用できることで、名前やCLI形状が似ているだけで既存Adapterへ設定し、認証・取消・回復が壊れるという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | 役割ごとの利用頻度、許容待ち時間・操作負担、用語理解および支援技術差 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| IA以降 | ArchitectureはAdapter境界を、SPECとVerificationはRuntimeごとのLifecycleと診断を具体化する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Provider固有LifecycleをAdapter越しに正確に扱う」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「Provider差を隠さず共通Runtimeから安全に利用できる」という成果を無断で弱めない。
