# `.crdd` Runtime Dataの目標Architecture

状態: Candidate（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-12
Related:
- [現行Path棚卸し](01_Current_Path_Inventory.md)
- [文書化](../../03_Documentation.md#repository-local-working-storage)
- [Coding Standards](../99_Coding_Standards.md)

## 1. 目的と設計判断

`.crdd`は、検証済みRepository Rootに属する非正本の設定、Runtime状態、Evidenceおよび一時物を、用途とLifecycleが分かる形で収容する。Repositoryの正本文書、実装Source、再利用可能なScriptまたは複数Repositoryを束ねるCROS状態は所有しない。

| 判断 | 目標 |
|---|---|
| Repository境界 | 一つの`.crdd`には、そのRepositoryに属する情報だけを置く |
| Project階層 | Repository RootがProjectの物理境界であるため、同じ`project-id`でもう一段掘らない |
| 親子関係 | 子が親なしでは解釈できずLifecycleも継承する場合はDirectory階層で表す |
| 横断関係 | 複数領域を結ぶ関係だけを安定IDで参照し、関係台帳を無条件に増やさない |
| Git | 非秘密のRepository設定だけを`config/`の明示allowlistで追跡する |
| Runtime Data | 状態、Evidence、候補、一時物はGit管理しない |
| 直下 | `.crdd`直下にfileを置かない。新しい用途は所有とLifecycleを決めてから追加する |

## 2. Repository-local目標構成

凡例:

- `[G]`: 非秘密でGit管理できるRepository設定
- `[D]`: 終了後も意味を持つ耐久状態またはEvidence
- `[W]`: 処理途中の作業領域
- `[T]`: 再生成可能で短期保持する一時領域

```text
<Repository Root>/
└─ .crdd/
   │
   ├─ config/                              [G] Repository固有の宣言とPolicy
   │  ├─ repository-manifest.json             Project Identity、役割、Capability宣言
   │  └─ external-send-policy.json            外部送信の情報分類、送信先、条件
   │
   ├─ project-runtime/                     [D/W] Project実行の状態と結果
   │  ├─ state/                               現在状態と世代
   │  ├─ queues/                              Task Queueと待機状態
   │  ├─ results/                             Task・統合・採用の確定結果
   │  ├─ decisions/                           人間判断待ちと確定した判断
   │  ├─ recovery/                            Project Runtime固有の再入場情報
   │  └─ work/                                未確定Transactionとrollback用作業物
   │
   ├─ execution/                           [D] Execution Intelligence
   │  └─ <operation-id>/
   │     └─ events/                           Operation内の不変Event。要約はEventから投影する
   │
   ├─ verification/                        [D] 検証結果と根拠
   │  └─ <verification-id>/
   │     ├─ started.json                      対象改訂版と開始時点
   │     ├─ result.json                       判定、確認・未確認範囲
   │     ├─ complete.json                     flush/read-backを含む完了記録
   │     └─ artifacts/                        必要な検証Artifactがある場合だけ作る
   │
   ├─ candidates/                          [D/W] 未採用の成果物
   │  └─ <candidate-id>/
   │     ├─ metadata.json                     出所、対象、状態、関連Operation
   │     ├─ artifacts/                        候補差分と生成物
   │     └─ recovery/                         Candidate処理固有の回復義務
   │
   ├─ release/                             [D/W] Release候補と準備処理
   │  └─ <candidate-id>/
   │     └─ <distribution tree>                固定Commitから展開した配布Root。署名Manifestも配布内の正規位置に置く
   │
   ├─ communication/                       [D/W] Repository内Communication
   │  └─ <context-id>/
   │     ├─ state.json                        Meeting・Topic等の現在状態
   │     └─ candidates/                       昇格前のDecision・記事等の候補
   │
   ├─ tests/                               [T/D] 試験実行単位の生成物
   │  └─ <execution-unit>/
   │     └─ <run-id>/                        複数Runを保持する試験で必須。単一handoff入口はexecution-unit直下の固定入力を使用できる
   │        ├─ input/                         固定した試験入力
   │        ├─ output/                        試験出力
   │        └─ diagnostics/                   失敗時の診断情報
   │
   └─ tmp/                                 [T] Operation所有の短期一時物
      ├─ .operations/                         Workspace清掃から分離したLifecycle制御面
      │  ├─ <operation-id>.json               Identity、Owner Process、世代、直前世代、状態、用途、清掃契機
      │  └─ <operation-id>.lock/              排他中だけ存在するOwner付きLock。解放済み残存は次の再入場で回収する
      └─ <operation-id>/                       削除可能なWorkspace
         └─ work/                             再生成可能な中間file
```

## 3. 各領域の意味

| 領域 | 所有する情報 | 主な終了条件 |
|---|---|---|
| `config/` | Commit固定する非秘密のRepository宣言とPolicy | Repository設定の変更・削除がGitで確定する |
| `project-runtime/` | Project実行の現在状態、Queue、結果、判断、固有Recovery | 各状態のsettlement、保持規則または明示Migrationが成立する |
| `execution/` | 実行履歴、測定値、相関可能な診断情報 | Retentionと未解決参照を確認して清掃できる |
| `verification/` | 検証対象、結果、未確認範囲と判断根拠 | Evidence保持方針とRelease／監査参照が終了する |
| `candidates/` | 未採用成果物、由来、現在の処置、Candidate固有Recovery | 採用、破棄または期限切れ処置とRecoveryが確定する |
| `release/` | Release候補、Manifest、Gate Evidence、staging、Release固有Recovery | Promotion、破棄またはRecoveryが完了する |
| `communication/` | Repository内のCommunication状態と昇格候補 | Promotion、終了または保持方針が確定する |
| `tests/` | 特定試験Runの入力、出力、診断 | Run終了後、必要Evidenceを保持先へ移し清掃する |
| `tmp/` | Operation中だけ必要な再生成可能な中間物 | Operationの全終端経路で削除し、不存在を確認する |

## 4. `tmp/`の限定用途

`tmp/`は未分類物の退避先ではない。内容を失っても正本、結果、Authority、再開可能性または説明責任を失わず、同じ入力から再生成できるOperation内中間物だけを置く。

### 4.1. 配置判定

| 対象 | `tmp/` | 正しい配置 |
|---|---|---|
| 一回のOperationだけで使う生成ScriptまたはLauncher | 条件付きで可 | `tmp/<operation-id>/work/`。実行後に削除する |
| 繰り返し使用するScript | 不可 | `40_Develop`の実装または`19_Workflows`が参照する正式入口 |
| 再開時に必要なScript、引数、Identity | 不可 | 回復を所有するComponent配下の`recovery/`へ構造化して置く。秘密値は保存しない |
| 一時変換、展開、比較、組立て途中のfile | 可 | 所有Operationの`work/` |
| 正式な検証結果または監査根拠 | 不可 | `verification/`または正本のQuality成果物 |
| 診断log | 条件付きで可 | 一時診断なら`tmp/`、判断に使うなら`execution/`または`verification/`へ昇格する |
| Release staging | 不可 | `release/<candidate-id>/work/` |
| Provider出力または未採用Candidate | 不可 | `candidates/`。外部送信Policyと保持条件に従う |
| Cache | 不可 | `tmp/`をCacheとして流用しない。必要性を確認して別契約を設計する |
| 作業メモ | 不可 | 正本へ意味変換するか、追跡不要なら会話・Task内で閉じる |
| 所有者や用途を説明できないfile | 不可 | Effect前に停止し、推測で配置しない |

### 4.2. Operation所有契約

`tmp/<operation-id>/`を作る処理は、作成前に次を確定する。IdentityはRuntime内部でEffect後に生成せず、呼出し側が作成開始前に確定し、初回Capability返却前のProcess喪失でも同じexact Recovery参照を再構成できるようにする。

| 必須情報 | 意味 |
|---|---|
| `operation-id` | 他の実行と衝突しない所有Identity |
| Owner | 作成、利用、清掃を担当するComponentまたはProcess |
| Purpose | 中間物が必要な処理と再生成元 |
| Allowed content | 作成できるfile種別と最大範囲 |
| Evidence promotion | 判断根拠として残す情報がある場合だけ`required`とする。`verification/<id>/artifacts/`に存在するbyteとHashを独立検証したReceiptをOperation Identity・Owner世代へ結合し、callerのboolean自己申告では削除を許可しない |
| Terminal paths | 正常、失敗、取消、Timeout、親Process喪失 |
| Promotion | 残す必要が生じた情報の正式な移動先 |
| Cleanup trigger | 各終端経路と次回の安全な再入場 |
| Completion evidence | 削除要求ではなく、対象不存在の観測 |

`.operations/<operation-id>.json`は状態とOwner世代をWorkspaceの外で耐久化する。少なくとも上表を追跡できない実装は、`tmp/`への書込みCapabilityを取得できない。作成時には制御文書を`preparing`として排他的に公開してからWorkspaceを作り、Process再起動後もDirectoryを推測探索せず再入場できるexact Recovery参照を使う。既存Workspaceとの衝突時は所有権を推定せず、そのDirectoryを変更または削除しない。

| 状態または境界 | 必須処置 |
|---|---|
| `preparing`かつOwner Process消失 | 呼出し前に確定したIdentityと世代が一致する場合だけWorkspaceを再構成し、新世代へ再入場する |
| `active`かつOwner Process生存 | 二つ目の再入場をEffect 0で拒否する |
| `active`かつOwner Process消失 | 同じIdentityの`recovery_required`へ耐久遷移してから再入場する |
| `recovery_required` | exact Identityと現在世代または直前世代が一致する場合だけ新世代を発行する |
| 新世代を公開後、Capability返却前にProcess消失 | 元参照と直前世代の結合から新世代を回復可能にする |
| Lock解放要求後に物理削除失敗 | Lockを`released`へ耐久遷移し、次回取得者が安全に回収する |
| 清掃失敗 | Capabilityを失効させる前に`recovery_required`を公開し、利用可能なexact Recovery参照を返す |
| Workspaceの部分削除後に清掃失敗 | 外部の制御文書を保持し、再入場時にWorkspaceを再構成する。制御文書をWorkspaceより先に削除しない |

制御文書の更新は、`.operations/`内の排他的な一時fileへ書込み、fileのflush、atomic renameおよびread-backを順に確認する。初回公開は既存文書を置換しない排他的なlinkで行う。WindowsでDirectory自身を`fsync`できないことを成功へ読み替えず、rename前後のProcess消失ではOwner Processの消失、現在世代および直前世代から安全な再入場へ収束させる。一度利用した旧Recovery参照、旧Capability、Identity不一致および並行する再入場はEffect 0で拒否する。

### 4.3. Lifecycle

```text
Operationを開始
  ↓
Identityを呼出し側で確定
  ↓
.operations/<operation-id>.jsonをpreparingで排他的に公開
  ↓
tmp/<operation-id>/を排他的に作成
  ↓
再生成可能な中間物だけを書き込む
  ↓
正常 ─┬─ 必要Evidenceを正式領域へ昇格 ─┐
失敗 ─┤                                 │
取消 ─┤                                 ├→ tmpを削除 → 不存在を観測 → 完了
期限 ─┘                                 │
                                      │
親Process喪失／清掃不明 ─→ 作成時のexact Recovery参照で再入場
                                      ↓
                         Workspace再構成・清掃・不存在確認
```

清掃不能な`tmp`残存を成功へ畳まない。ただし、一時物自体を耐久Evidenceへ昇格して残し続けるのではなく、必要な意味だけを回復を所有するComponentの`recovery/`または`verification/`へ保存し、物理残存には削除義務を与える。Evidenceを生成しないOperationは、作成時に`not_required`を明示すれば昇格なしで清掃できる。Evidence必須時は、`allowedContent`に含まれる`work/`内のexact source、正式な昇格先、両者のbyte Hash、Operation Identityおよび現Owner世代が一致するReceiptだけを受理する。昇格先の同じHashだけ、または別のsourceから偶然得た同じ名前だけでは清掃を許可しない。

### 4.4. Recoveryの所有

Recovery記録は、状態遷移、再入場および解消を所有するComponentの配下へ置く。同じRecovery義務をRepository直下の汎用`recovery/`とComponent配下へ複製しない。

| Recovery対象 | 保存先 |
|---|---|
| Queue、Decision、Integration、Project State | `project-runtime/recovery/` |
| Candidate適用・rollback | `candidates/<candidate-id>/recovery/` |
| Release staging、署名、Promotion | `release/<candidate-id>/recovery/` |
| Docker、子Process、Host Resource | 対象を所有するPlatform／Runtimeの保護領域 |
| 複数RepositoryをまたぐCROS Operation | CROS Trust Domainの`recovery/` |

全Recoveryの一覧は保存場所を中央へ複製せず、各Ownerの共通Recovery Queryから読み取り専用Projectionとして構成する。Recovery IDからOwnerと保存先を決定論的に解決し、Filesystem全体の推測探索を行わない。

## 5. `config/`とRepository Identity

`repository-manifest.json`と`external-send-policy.json`は、どちらもRepositoryに結合する非秘密設定であるため`config/`へ置く。両者の責務は統合しない。

| 設定 | 所有するもの | 所有しないもの |
|---|---|---|
| `repository-manifest.json` | 安定したProject ID、表示名、Repositoryの役割、提供Capability、Context Surface、Policy参照 | Secret、絶対Path、現在状態、実行Authority |
| `external-send-policy.json` | 許可対象Provider、情報分類、目的、Session境界、候補保持条件 | Project Identity、Capability実装、送信実行の個別Authority |

実効的な許可はManifestの宣言だけでは成立しない。

```text
Repository Manifestの宣言
  ∩ CROS／配置先のTrust Policy
  ∩ Actor Authorization
  ∩ Operation Authority
  = 実行可能な範囲
```

## 6. CROSとの物理分離

複数Repositoryを束ねるCROS状態は、MCPを起動したRepositoryの`.crdd`へ保存しない。CRDDの子Directoryにもせず、配布主体とApplicationを識別できるOS管理の専用Runtime Rootを使用する。OS間で同じ論理Pathを識別できるよう、WindowsとLinuxのDirectory名はともにASCII小文字`kebab-case`へ統一する。

```text
Windows
%LOCALAPPDATA%\qual-lab\cros\<trust-domain-id>\
├─ config/                 Trust PolicyとProject登録
├─ repository-bindings/    Projectと検証済みRepository Rootの結合
├─ sessions/               複数Repositoryを扱う実行Session
├─ projections/            各Repositoryから取得した読取り投影
├─ recovery/               CROS横断Operationの回復義務
└─ tmp/                    CROS Operation所有の一時物

Linux configuration
${XDG_CONFIG_HOME:-$HOME/.config}/qual-lab/cros/<trust-domain-id>/

Linux durable state
${XDG_STATE_HOME:-$HOME/.local/state}/qual-lab/cros/<trust-domain-id>/

Linux temporary runtime
${XDG_RUNTIME_DIR}/qual-lab/cros/<trust-domain-id>/
```

| Root候補 | 判断 |
|---|---|
| `%LOCALAPPDATA%\qual-lab\cros\` | Qual-Lab公式配布のWindows既定。Linuxと同じDirectory名を使用し、PublisherとApplicationを識別する |
| `%LOCALAPPDATA%\cros\` | 短いが、別Publisherの同名Applicationと衝突し得るため公式既定にはしない |
| `%LOCALAPPDATA%\crdd\cros\` | CROSをCRDD配下の機能に見せ、責務分離と一致しないため使用しない |
| `%USERPROFILE%\.cros\`または`%USERPROFILE%\.crdd\` | OS標準のApplication Data領域を使えず、Repository-local `.crdd`とも混同しやすいため使用しない |

`qual-lab`はCRDD Contract上の固定名ではなく、公式配布物の既定Publisher namespaceである。Forkまたは組織内配布では、配布主体が所有する衝突しない小文字`kebab-case`のApplication Rootへ差し替えられる。Rootの値をSource各所へ埋め込まず、Platform AdapterがPublisher Identity、Application IdentityおよびOS標準Rootから解決する。

| Identity | 意味 |
|---|---|
| Project ID | Repositoryが表す論理Projectの安定Identity |
| Repository Binding ID | 特定のclone、worktree、検証済みRootとの実行時結合 |
| Trust Domain ID | 信頼するPublisher、Repository、接続主体、Credential参照および許可上限を共有する安定した境界 |
| Operation ID | 一回の実行、判断または検証単位 |

Directory探索だけでProjectを登録せず、Repository Manifest、検証済みRootおよびCROS側Bindingを一致させる。

同じTrust Domain内の複数Repository、MCP接続および並行実行はSession IDとOperation IDで分離する。信頼するPublisher、Credentialまたは組織境界が異なる対象は別の`<trust-domain-id>/`へ分離し、v0.21では一つのCROS Processを一つのTrust Domainへだけ接続する。Process起動ごとのランダムなInstance Directoryは作らない。

`trust-domains/`の中間Directoryは設けない。CROS Root直下の各DirectoryをTrust Domainとし、全Trust Domainで共有するRuntime状態、Repository Binding、CredentialまたはRecoveryを作らない。将来、複数Domainの入口だけを束ねるBrokerが必要になった場合は、CROS Rootへ共有領域を足さず、Authorityを持たない別Applicationの`qual-lab/cros-broker/`として設計する。

## 7. 現行配置からの移行境界

| 現行 | 目標 | 切替条件 |
|---|---|---|
| `.crdd/external-send-policy.json` | `.crdd/config/external-send-policy.json` | Loader、署名、Checker、ひな型、`.gitignore`、試験を同じ変更で切り替える |
| `.crdd`直下の生成Script・log・JSON | 所有領域または`tmp/<operation-id>/` | Reader、Recovery参照、Evidence昇格先を確認する |
| `test-tmp`、`test-fixtures`、`native-fixture` | `tests/<execution-unit>/<run-id>/` | 全Producerとcleanupを移行し、旧Path利用を機械検出する |
| `release-staging`、`release-e2e`等 | `release/`、`verification/`、`tests/` | Candidate、Evidence、一時展開を分類する |
| `project-runtime/adoption`内の混在 | `results/`と`work/` | 耐久結果とTransactionのIdentity・Lifecycleを分離する |

旧Pathの互換書込みは残さない。切替前に全Producer、Consumer、派生物、RecoveryおよびRelease経路を閉じ、旧Path利用をCheckerまたは契約試験で拒否する。

## 8. Path CapabilityとConsumer Closure

Repository-local Pathは、検証済みRepository Root Capabilityから共通Resolverが返した名前付きPathをCanonical値として使用する。Consumerは`.crdd`、Top-level領域またはCanonical Pathを再構成・再解釈しない。

| 入口 | 利用範囲 | 制約 |
|---|---|---|
| 公開Resolver | 通常のRuntime Data Consumer | 検証済みRoot Capabilityを必須とし、raw文字列Rootを受理しない |
| Working Directory入口 | Repository内から開始する既存Runtime Consumer | Git境界、symlink／junction、最寄りRootを検証してから公開Resolverへ接続する |
| 保護署名Resolver | 署名入口だけ | package内の固定module位置からRootを導出し、外部Git Processを秘密入力前検査へ追加しない。公開indexからExportしない |

Consumer集合は手書き一覧だけを正本としない。実Sourceからraw Resolver、保護署名Resolverおよび未登録Top-level領域の利用箇所を導出し、宣言した閉集合との差をCheckerで拒否する。既知Consumerごとの契約試験に加え、署名・Releaseを含む最終公開入口までの縦断反証を持つ。

## 9. 完成条件

- 全本番Producerが共通Path Resolverから目標領域を取得する。
- `.crdd`直下fileと未登録Top-level Directoryの新規作成を機械的に拒否する。
- `tmp/`の全ProducerがOperation所有、全終端経路、昇格、清掃、不存在確認を試験する。
- Repository-local状態とCROS／User／Host Runtime状態を混在させない。
- 現行のRecovery義務と正式Evidenceを失わず、旧Path Readerを0件にする。
- 移行後に旧Pathを再生成する回帰試験を持つ。
