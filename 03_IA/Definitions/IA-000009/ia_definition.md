# IA-000009 ユーザー・Role権限・接続資格・Repository範囲・Access Recovery

成果物種別: IA定義
IA ID: `IA-000009`
状態: Canonical
確認状態: 最新の権限分担・登録解除・鍵の受け渡し未確認の判断を限定伝播済み。今回の契約・品質限定独立レビュー済み・残指摘0。UI／SPEC以降への追加判断伝播・全体Ready・実装成立は未主張。
維持責任者: Qual-Lab

## 意味と利用者成果

鍵の発行・独立失効・交換はadministrator専用固定で、Role詳細権限のON／OFF設定を設けない。通常入口は同一Process Workbench backendだけとし、MCPには秘密値の有無を問わず鍵操作の一覧・Schema・登録・dispatchを公開しない。Hostはログイン済みローカル操作者を信頼する対話CLIで、鍵交換2操作だけを扱う。追加認証・専用資格・承認コード・OS管理者昇格を要求せず、既存の管理Root／Path検証は維持する。manager／administratorはユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministratorだけが管理する。developerへ管理操作、managerへ管理者専用操作を設定で委譲しない。

Remote利用では接続資格からユーザーを識別し、現行Role詳細権限、Repositoryの公開対象、実アクセス可能性を分けて利用できる情報を判断する。manager／administratorはユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministratorだけが管理する。developerへ管理操作、managerへ管理者専用操作を設定で委譲しない。表示名は対象識別と自身表示に限り、本人性や権限ではない。管理能力と内容Accessを分ける。鍵交換の2操作と通常／Hostの入口・Authorityを別軸にし、ユーザー情報・Role権限・登録・Product Dataを保持する。単体Repository利用へCROS Credentialを要求しない。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000013](../../Analysis/UX-000013/ia_analysis.md) | 開発者、Project運営者／PMが接続・再接続する | ユーザー、自身表示、接続資格、Role詳細権限、Exposure、実アクセス、Repository情報責務、Session、管理能力 | 利用可能／資格要求／制限／利用不能／不明、一部だけ利用可能 | 資格→ユーザー→現行Role権限→公開対象→実アクセス。利用不能理由は非開示境界内だけで示す |
| [UX-000035](../../Analysis/UX-000035/ia_analysis.md) | manager／administratorが業務対象を維持し、administratorが管理者Role・鍵を、Host運用者が限定鍵交換を行う | ユーザー、Role権限、資格Metadata・状態・一度表示、Recovery対象・保持範囲・結果 | 資格の有効／期限切れ／失効／不明、Recovery確認待ち／進行中／blocked／completed | 対象ID・表示名→現行Role・資格状態→処置影響。緊急回復はログイン済みHost操作者の対話CLI→同じRecovery→再入場 |

userIdのUUID制約は正式UXから継承する。IAは安定した同一性を扱い、UUID版・Schema・生成方式を決定しない。

### 操作対象と担当Role

| 操作対象・内容 | manager | administrator | developer |
|---|---|---|---|
| ユーザー登録・表示名変更 | 許可 | 許可 | 不許可 |
| developer／managerの割当て・変更 | 許可 | 許可 | 不許可 |
| administratorの付与・解除・降格を含む変更 | 不許可 | 許可 | 不許可 |
| developer／managerの詳細権限 | 許可 | 許可 | 不許可 |
| administratorの詳細権限 | 不許可 | 許可 | 不許可 |
| 鍵の発行・独立失効・交換 | 不許可 | 許可 | 不許可 |
| Repository登録・登録解除 | 許可 | 許可 | 不許可 |
| Repository公開範囲 | 許可 | 許可 | 不許可 |

管理能力の固定割当と内容範囲を別に扱う。managerは変更前の現在管理権限による認可を経て、自身のRole内容範囲・公開範囲も明示更新できる。次要求から現行Role権限・Exposure・実アクセスを再評価する。管理能力だけから内容取得を許可しない。ユーザーの表示名はadministratorのものもmanagerが変更できるが、userId・Role・Credential・Authorityの変更とは別である。

Repository登録状態は登録関係の属性、公開範囲はExposureの属性、内容の存在はRepositoryの情報として区別する。登録だけで公開・アクセス可能とせず、登録解除は登録と対応する公開設定を同時に解除し、CROSから対象へ以後アクセスできなくする。他対象の登録・公開設定と対象Repository／Product Dataは保持する。既存対象の属性・関係として扱い、新Objectや安定IDを追加しない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000013: ユーザー | ユーザー | Same | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使うを保持する |
| UX-000013: 接続資格 | 接続資格 | Same | ユーザーを認証する資格を保持する |
| UX-000013: Role | Role | Same | 利用者の権限分類を保持する |
| UX-000013: Role詳細権限 | Role詳細権限 | Same | Roleが所有する情報・操作許可を保持する |
| UX-000013: Repository Exposure | Repository Exposure | Same | 許可範囲へ公開されているRepositoryを保持する |
| UX-000013: 実アクセス可能性 | 実アクセス可能性 | Same | 公開対象を実際に取得できるかを保持する |
| UX-000013: 接続中の作業単位 | 接続中の作業単位 | Same | 一回の認証済み接続を保持する |
| UX-000013: システム管理能力 | 管理能力 | Rename | 最小ユーザー情報・Role権限・Credential等の管理を保持する |
| UX-000013: Repository情報範囲 | Repository情報範囲 | Same | Repositoryが所有する情報責務を保持する |
| UX-000013: リポジトリ | リポジトリ | Same | 内容の正本と情報境界を保持する |
| UX-000035: ユーザー | ユーザー | Same | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使うを保持する |
| UX-000035: Role | Role | Same | 利用者の権限分類を保持する |
| UX-000035: Role詳細権限 | Role詳細権限 | Same | Roleが所有する情報・操作許可を保持する |
| UX-000035: 接続資格Metadata | 接続資格 | Merge | ユーザーを認証する資格を保持する。元発行Identity（Credential IDとは別の非秘密Operation／Attempt相関情報）と発行・結果記録・配送・受領確認を別属性として保持 |
| UX-000035: 一度表示するSecret | Secret表示境界 | Rename | 発行／鍵交換後の一度だけの秘密表示を保持する |
| UX-000035: 接続資格状態 | 接続資格状態 | Same | 資格の有効・期限切れ・失効・不明を保持する |
| UX-000035: 管理能力 | 管理能力 | Same | 最小ユーザー情報・Role権限・Credential等の管理を保持する |
| UX-000035: Access Recovery | Access Recovery | Same | 通常管理またはHostから鍵だけを交換して接続へ戻る回復を保持する |
| UX-000035: Recovery対象 | Recovery対象 | Same | 鍵交換の対象ユーザー・失効資格集合・新資格発行先を保持する |
| UX-000035: 保持対象 | 保持対象 | Same | 鍵交換で変更しないユーザー情報・Role・詳細権限・Repository登録・Product Dataを保持する |
| UX-000035: Recovery結果 | Recovery結果 | Same | 回復現在地・終了後状態・次の行動を保持する。元発行事実と新しい明示交換の結果・Identityを区別 |

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000013: ユーザー | 安定userId。表示名の同名・改名でIdentityを変えず、一つの現行Roleへ結ぶ | ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | Same。意味上の識別と関係を保持する |
| UX-000013: 接続資格 | Credential IDとuserId。Secretを永続情報へ含めない | 接続資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない | Same。意味上の識別と関係を保持する |
| UX-000013: Role | `administrator`／`manager`／`developer`のRole ID | Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Same。意味上の識別と関係を保持する |
| UX-000013: Role詳細権限 | Role IDに結ぶ。ユーザーやCredentialへ個別追加権限を持たせない | Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Same。意味上の識別と関係を保持する |
| UX-000013: Repository Exposure | Repository IDと公開対象範囲。Role権限や実アクセスと別に扱う | Repository Exposure | Repository IDと公開対象範囲。Role権限や実アクセスと別 | Same。意味上の識別と関係を保持する |
| UX-000013: 実アクセス可能性 | Repository IDと現在の確認結果。公開済みから利用可能を推定しない | 実アクセス可能性 | Repository IDと現在の確認結果。公開設定だけから利用可能を推定しない | Same。意味上の識別と関係を保持する |
| UX-000013: 接続中の作業単位 | Session IDとCredential ID、userId。Credentialへ過去のRole権限を固定しない | 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Role権限へ結び直す | Same。意味上の識別と関係を保持する |
| UX-000013: システム管理能力 | 現行Role詳細権限の管理許可から判定し、内容閲覧範囲とは分ける | 管理能力 | 業務管理はmanager／administrator、管理者Role・詳細権限と鍵はadministrator専用固定。内容閲覧を自動的に得ない | Rename。UX13の識別・内容閲覧との分離を保持し、固定担当RoleはUX35入力から精緻化する |
| UX-000013: Repository情報範囲 | Repository IDと情報範囲の組で識別する | Repository情報範囲 | Repository IDとProject／Commercial／Topic／Meeting等の情報範囲。利用者RoleやExposureではない | Same。意味上の識別と関係を保持する |
| UX-000013: リポジトリ | Repository IDで識別する。Repository情報範囲は所有責務として別に扱う | リポジトリ | Repository ID。Role権限・Exposure・実アクセスを別々に満たす範囲だけ利用可能 | Same。意味上の識別と関係を保持する |
| UX-000035: ユーザー | 安定userId。表示名は属性であり、同名・改名でIdentityや権限を変えない。一つの現行Roleへ結ぶ | ユーザー | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない | Same。意味上の識別と関係を保持する |
| UX-000035: Role | `administrator`／`manager`／`developer`。Repository RoleやTask Roleと別 | Role | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role | Same。意味上の識別と関係を保持する |
| UX-000035: Role詳細権限 | Role IDに結ぶ。ユーザーやCredentialへ個別追加権限を持たせない | Role詳細権限 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし | Same。意味上の識別と関係を保持する |
| UX-000035: 接続資格Metadata | Credential IDとuserId。生Secretや同等値を含めず、古いRole権限を固定しない。元発行Identity（Credential IDとは別の非秘密Operation／Attempt相関情報）と発行・結果記録・配送・受領確認を別属性として保持 | 接続資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない。元発行Identity（Credential IDとは別の非秘密Operation／Attempt相関情報）と発行・結果記録・配送・受領確認を別属性として保持 | Merge。これらを既存接続資格の属性・関係へ統合する |
| UX-000035: 一度表示するSecret | 発行Attempt内だけ。永続情報へ含めない | Secret表示境界 | 資格発行Attempt内。永続Identityにしない | Rename。意味上の識別と関係を保持する |
| UX-000035: 接続資格状態 | Credential IDと現行状態。鍵交換は旧資格失効と新資格発行の関係であり、新しい永続状態を作らない | 接続資格状態 | Credential IDと現行状態。Reset専用永続状態を作らない | Same。意味上の識別と関係を保持する |
| UX-000035: 管理能力 | 業務管理はmanager／administrator、管理者Role・詳細権限と鍵はadministrator専用固定。内容閲覧を自動的に得ない | 管理能力 | 業務管理はmanager／administrator、管理者Role・詳細権限と鍵はadministrator専用固定。内容閲覧を自動的に得ない | Same。意味上の識別と関係を保持する |
| UX-000035: Access Recovery | Recovery IDを最初の失敗から再入場まで保つ。操作種別（指定ユーザー交換／全員交換）と入口・Authorityは別属性 | Access Recovery | Recovery ID、操作種別（指定ユーザー交換／全員交換）、入口・Authority属性。最初の失敗から再入場まで同じIdentity | Same。意味上の識別と関係を保持する |
| UX-000035: Recovery対象 | Recovery ID、対象userId、失効対象Credential集合、発行先userId。指定交換は同じユーザー、全員交換は指定既存administrator | Recovery対象 | Recovery ID、対象userId、失効対象Credential集合、発行先userId。指定交換は同じユーザー、全員交換は指定既存administrator | Same。意味上の識別と関係を保持する |
| UX-000035: 保持対象 | Recovery IDとユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataの保持区分 | 保持対象 | Recovery IDとユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataの保持区分 | Same。意味上の識別と関係を保持する |
| UX-000035: Recovery結果 | Recovery IDと結果改訂版。失効確定範囲と新資格発行結果を分離し、不明を保持する。元発行事実と新しい明示交換の結果・Identityを区別 | Recovery結果 | Recovery IDと結果改訂版。失効確定範囲と新資格発行結果を分離し、不明を保持する。元発行事実と新しい明示交換の結果・Identityを区別 | Same。既存結果の同一性・関係を保持する |

同じ対象の識別と関係を分析から保持する。表示名はユーザー属性、Secretは短命表示として扱い、独立した正本や安定IDを追加しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| ユーザー | 最小の接続主体。表示名は自身表示と管理者の対象識別だけに使う | 安定userId、表示名属性、一つの現行Role。表示名一致・改名はIdentity変更やAuthority根拠ではない |
| 接続資格 | ユーザーを認証する資格 | Credential IDとuserId。生Secretなし、古いRole権限を固定しない。元発行Identity（Credential IDとは別の非秘密Operation／Attempt相関情報）と発行・結果記録・配送・受領確認を別属性として保持 |
| Role | 利用者の権限分類 | `administrator`／`manager`／`developer`。一ユーザーにつき一つの現行Role |
| Role詳細権限 | Roleが所有する情報・操作許可 | Role IDへ結ぶ。ユーザー／Credentialの個別追加権限なし |
| Repository Exposure | 許可範囲へ公開されているRepository | Repository IDと公開対象範囲。Role権限や実アクセスと別 |
| 実アクセス可能性 | 公開対象を実際に取得できるか | Repository IDと現在の確認結果。公開設定だけから利用可能を推定しない |
| 接続中の作業単位 | 一回の認証済み接続 | Session ID、Credential ID、userId。認可は現行Role権限へ結び直す |
| Repository情報範囲 | Repositoryが所有する情報責務 | Repository IDとProject／Commercial／Topic／Meeting等の情報範囲。利用者RoleやExposureではない |
| リポジトリ | 内容の正本と情報境界 | Repository ID。Role権限・Exposure・実アクセスを別々に満たす範囲だけ利用可能 |
| 管理能力 | 最小ユーザー情報・Role権限・Credential等の管理 | 業務管理はmanager／administrator、管理者Role・詳細権限と鍵はadministrator専用固定。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／鍵交換後の一度だけの秘密表示 | 資格発行Attempt内。永続Identityにしない |
| 接続資格状態 | 資格の有効・期限切れ・失効・不明 | Credential IDと現行状態。Reset専用永続状態を作らない |
| Access Recovery | 通常管理またはHostから鍵だけを交換して接続へ戻る回復 | Recovery ID、操作種別（指定ユーザー交換／全員交換）、入口・Authority属性。最初の失敗から再入場まで同じIdentity |
| Recovery対象 | 鍵交換の対象ユーザー・失効資格集合・新資格発行先 | Recovery ID、対象userId、失効対象Credential集合、発行先userId。指定交換は同じユーザー、全員交換は指定既存administrator |
| 保持対象 | 鍵交換で変更しないユーザー情報・Role・詳細権限・Repository登録・Product Data | Recovery IDとユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataの保持区分 |
| Recovery結果 | 回復現在地・終了後状態・次の行動 | Recovery IDと結果改訂版。失効確定範囲と新資格発行結果を分離し、不明を保持する。元発行事実と新しい明示交換の結果・Identityを区別 |

```text
[O: 接続資格] ──認証する──▶ [O: ユーザー]
      │                           │ 一つの現行Role
      │                           ▼
      │                       [O: Role] ──持つ──▶ [O: Role詳細権限]
      │                                                 │ 許可範囲を別確認
      │                                                 ▼
      │                                        [O: Repository Exposure]
      │                                                 │ 実際の取得を別確認
      │                                                 ▼
      │                                        [O: 実アクセス可能性]
      │                                                 │ 対象
      │                                                 ▼
      │                                            [O: リポジトリ]
      │                                                 ▲ 所有責務
      │                                        [O: Repository情報範囲]
      ├─接続を識別──▶ [O: 接続中の作業単位]
      ├─現在値を持つ▶ [O: 接続資格状態]
      └─発行時だけ──▶ [O: Secret表示境界]

[O: Role] ──採用済み担当Roleの固定管理操作（上表）──▶ [O: 管理能力]

[O: Access Recovery]
      ├─処置する──▶ [O: Recovery対象]
      ├─変更しない▶ [O: 保持対象]
      └─記録する──▶ [O: Recovery結果]
```

### 鍵操作と情報結果の関係

| 操作 | 旧資格への作用 | 新資格・Secret | 交換専用の回復条件 |
|---|---|---|---|
| 通常発行 | 既存資格は失効しない | 新資格を発行し、新Secretを一度だけ表示する | 適用しない。交換の失効・再入場条件を転用しない |
| 独立失効 | 指定したCredentialを失効する | 新資格もSecretも発行しない | 適用しない。交換の発行・再入場条件を転用しない |
| 交換 | 指定ユーザーまたは全員の旧有効資格を定義済み範囲で失効する | 指定交換は同じ既存userId、全員交換は指定既存administratorへ発行し、新Secretを一度だけ表示する | 同じRecoveryへ失効確定／発行不明を結び、現在状態の再観測後に再入場する |

接続資格・資格状態・Secret表示境界の情報関係として区別し、Access Recoveryへ結ぶのは定義済みの交換条件だけとする。通常発行・独立失効について未定義の失敗・回復契約や回復状態の不存在保証を新設しない。

図は情報関係の投影であり、API実行順や保存Schemaではない。Roleで許可されてもExposureなしなら利用対象にせず、Exposureされても実取得不能なら利用可能としない。実取得可能でもRole外を開示しない。不明を許可や不存在へ畳まない。

操作種別と入口・Authorityは別の属性とし、4組合せを別Objectへ分けない。

| 入口と操作 | 処置前表示 | 明示確認 |
|---|---|---|
| 通常Workbench × 指定ユーザー交換 | 対象ID・表示名、失効範囲、発行先、保持情報 | 追加確認なし |
| 通常Workbench × 全員交換 | 同上 | 必須 |
| Host CLI × 指定ユーザー交換 | 同上 | 必須 |
| Host CLI × 全員交換 | 同上 | 必須 |

| 鍵交換の操作 | 失効する旧有効資格 | 新資格の発行先 | 他ユーザーへの影響 |
|---|---|---|---|
| 指定ユーザー交換 | 対象userIdの資格すべて | 同じ既存userId | 他ユーザーの鍵は保持 |
| 全員交換 | 全ユーザーの資格すべて | 指定した既存administrator userId | 管理者による通常の再発行・再配布まで旧資格は利用不能 |

| 入口 | 処置前の権限・確認 | 操作の意味 |
|---|---|---|
| 通常管理 | 同一Process Workbenchの固定administrator権限。全員交換だけ人間が明示確認 | 上記2操作 |
| Host緊急操作 | ログイン済みローカル操作者と人間の明示確認。追加認証・専用資格・承認コード・OS管理者昇格なし | 上記と同じ2操作 |

両入口でユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataを保持する。表示名を対象Identityにせず、特別ユーザー・追加権限・回復専用Bootstrapを作らない。初回Server設定方式は変更しない。

交換の発行自体または結果記録が未確定となる発行失敗・応答喪失・Process喪失では、失効確定範囲と発行結果の不明を非秘密の耐久的な事実として同じRecovery IDへ結ぶ。再入場は現在状態の再観測後に判断し、再観測なしに完了・rollback・旧資格未失効・開始済み操作取消済みへ畳まない。Secretを再表示せず、元処理の発行・記録が未確定のまま新しいRecoveryを重ねない。対象ユーザー、全員交換の既存administrator、必要な資格集合・現行権限を安全に確認できない場合や認可設定が破損している場合は処置前停止する。鍵交換は認可設定を修復しない。

### 登録解除と鍵の受け渡しに関する情報関係

最新UX-000035の追加判断を既存Objectの属性・関係へ統合する。新Object・安定ID・回復機構を追加せず、通常発行をAccess Recoveryへ結ばない。

| 既存の情報対象 | 保持する属性・関係 | 次の行動と時間的な意味 |
|---|---|---|
| Repository登録状態・Repository Exposure・リポジトリ | 同じRepositoryに結ぶ登録関係と対応公開設定を同時に解除する。他対象の登録・公開設定と対象Repository本体・Product Dataは保持する | CROSから対象へ以後アクセスできない。別の先行公開解除を必須にせず、登録解除から開始済み操作の取消完了や本体削除を推定しない |
| 接続資格Metadata／接続資格 | 元発行Identity（Credential IDとは別の非秘密Operation／Attempt相関情報）、資格ID・userId、発行事実と結果記録の確認、配送と受領確認を別に保持する。Secretは保存しない | 発行と記録が確定し受け渡しだけ未確認なら「発行済み・受け渡し未確認」。確実な未受領や未発行へ畳まず、現在認可されたadministratorが既存交換を明示して新しく実行できる。発行自体または結果記録が不明なら、元発行Identityと既知事実で現在再観測する。交換由来だけ元のexact Recoveryを保持する。新交換を開始しない。通常発行へ交換Recoveryを新設せず、未確定の元処理を別交換で置換しない |
| 接続資格状態 | 発行時の事実と現在の有効／失効等を区別し、旧応答の由来となる資格へ相関する | 遅延した旧応答から失効済み鍵を利用可能と案内しない。新交換の成功で旧Secret受領・rollback・取消を証明しない |
| Access Recovery・Recovery対象・Recovery結果 | 各交換内は同じexact Recovery。確定発行後の新交換は別Operation／別Recoveryで、旧発行事実を保持し旧資格を新交換の失効対象へ結ぶ | 指定ユーザー交換は当該ユーザーの発行済み資格を含む旧有効資格すべてを失効し同じ既存ユーザーへ発行。全員交換は全旧有効資格を失効し指定既存administratorへ発行する。他ユーザーは通常の再発行・再配布まで利用できない |
| 管理能力・入口とAuthority | 現在administrator認証とログイン済みHost操作者を別に扱う | 現在の管理者認証が使えなければ既存Host交換入口へ。通常Workbench認可を迂回せず、追加認証・新Authorityを作らない |

情報導線は、資格の発行・記録の確認→受け渡し確認→現在の資格・権限→次の行動とする。発行・記録確定／受け渡し未確認は明示新交換、発行・記録不明は元Identity再観測、管理者認証喪失は既存Host入口へ分岐する。Secret再表示・自動再発行は案内しない。新交換も2操作の対象・既存発行先・保持範囲、4組の事前表示・3組の明示確認を保持する。

## 状態・可視性・時間的な意味

| 観点 | 保持する区別 |
|---|---|
| 利用状態 | 利用可能／資格要求／制限／利用不能／不明、部分可視。部分成立を全体利用可能としない |
| 資格状態 | 有効／期限切れ／失効／不明。鍵交換は旧資格失効＋新資格発行であり、rotationや新しい永続resetting状態を追加しない |
| 名前変更 | userIdとRole権限は名前の同名・改名に依存しない |
| Role変更 | 変更前の現在管理権限で更新要求を認可し、次要求で現行詳細権限・Exposure・実アクセスを再評価する。CredentialやSessionへ古い権限を固定しない |
| 鍵交換 | 同じuserId・Roleを保持し、旧資格を以後の要求で拒否する。開始済み操作の取消完了とは別 |
| ユーザー可視性 | 認証済み利用者の自身表示を許可。非認証入口へユーザー情報0、現在他ユーザー参照を許可されていない主体へ他ユーザー一覧・存在・件数0 |
| Repository可視性 | 非開示対象の存在・名前・件数を漏らさない。利用不能理由も開示許可範囲内で示す |
| 秘密 | 発行／鍵交換後の新Secretを一度表示。保存済みSecretを一覧・ログ・Evidence・会話・Project Contextへ再表示しない |
| 緊急回復 | ログイン済みHost操作者と対象・保持範囲を別に確認。確認待ち／進行中／blocked／completedを区別し、同じRecoveryへ再入場する |

発行要求と受領、失効要求と確定、回復開始と終了後確認を同一視しない。両入口で同じ既存userIdとユーザー情報・Role権限を保持する。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 利用者には自身表示名と実際に利用できるRepository、状態・部分可視・次の行動。管理者には対象ID・表示名・Role・資格状態・処置影響。緊急時は対象・保持範囲・回復現在地 |
| 情報のまとまり | 同じユーザーの資格と現行Roleへ辿れるが、名前・Identity・認可を混同しない。通常管理とHost回復はAuthorityを分ける |
| 見つけ方 | 通常利用は資格→ユーザー→現行Role権限→公開対象→実アクセス。業務管理は操作対象・担当Role→対象ID・表示名／Repository登録状態→Role／公開範囲→変更影響。鍵管理はadministrator→対象ID・資格状態→処置影響。鍵交換は通常Workbenchの固定administrator権限またはログイン済みHost操作者→操作種別・対象userId・失効集合・発行先・保持範囲→同じRecovery→既存ユーザーの新資格で再入場。Host入口と全員交換は人間が明示確認する |
| 対象維持 | 処置前の対象IDを維持し、同名や名前変更で別ユーザーへ移らない。欠損・古さ・競合・不明は正常や許可へ丸めない |

### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000013 | Role詳細権限の管理、公開設定、実アクセスの確認、Repository情報範囲の宣言、ユーザー／接続文脈の提供を別責任とする | 現在許可された主体がRoleと詳細権限、Repository Ownerが情報責務を維持し、利用者が許可内の次行動を選ぶ。一つの判定から他の成立を推定しない |
| UX-000035 | manager／administratorが業務管理を、administratorが管理者Role・詳細権限と鍵を、ログイン済みHost操作者が限定鍵交換を、Repository OwnerがProduct Dataを維持する | 通常の鍵操作はadministrator専用固定。manager／administratorはユーザー登録・表示名変更、developer／managerの割当て・詳細権限、Repository登録・登録解除・公開範囲を管理する。administratorの付与・解除・降格を含むRole変更、administrator詳細権限と鍵3操作はadministratorだけが管理する。developerへ管理操作、managerへ管理者専用操作を設定で委譲しない。Hostの鍵交換はログイン済みローカル操作者と人間確認。管理能力は内容閲覧権限ではない |

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。Repository RoleはRepositoryの情報責務、利用者Roleは許可分類である。DEVのProject、MGMTのCommercial、各RepositoryのTopic／Meetingは自身の開示範囲を所有し、単一Repositoryでも必要範囲を同居できる。managerという名前だけから全Repositoryへの実アクセスを保証しない。

## 失敗・制約・未確認事項

### 重要な失敗

- UX-000013: 認証成功・公開済み・実取得可能の一つだけで全体許可を推定する。部分可視を全体成立へ畳む。非開示対象や他ユーザー情報を漏らす。
- UX-000035: 同名ユーザーを取り違える。表示名を本人性・Authorityへ昇格する。資格へ古い権限を固定する。Secretを保存・再表示し、回復でProduct Dataを削除し、未確定の元処理へ別Recoveryを重ねる。

採用済みWorkbench／Host CLI入口の表示具体化、Digest、Protocol、物理Schema・Path・Process構成は本定義で決めない。一般アカウント管理、メール・Password・本人確認・自己登録・自己編集・申請、複数Role、個別追加権限、SSO／IdP、個人行動監査製品は対象外。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | 自身表示名と安定ID、現行Role範囲・利用不能理由の理解、接続負担・失敗後の選択 | 代表利用者、Qual-Lab | 実利用確認が必要 | 定量条件と具体導線を確定しない |
| UX-000035 | 対象識別・リセット確認の負担、採用済みWorkbench／Host CLI入口の具体的な表示・案内、有効期限既定値。既存userIdへの結合と情報・Role保持は採用済み | 管理者、Host運用者、Qual-Lab | Pilot／後工程で確認 | 期限・画面・配布手順を確定しない |

IA固有の追加判断はない。UUID版、表示名構文・正規化・一意性、Role権限語彙、保存形式を先取りしない。本人確認・自己管理・申請、複数Role、個別追加権限、個人監査、または現在の情報構造で開示境界を表せない必要が判明した場合はDiscovery／UXへ戻す。

## 検証意図

登録と対象公開設定の同時解除、他対象・本体保持、発行・記録・配送・受領確認の非同一性、3分岐の次行動、元／新Identityの分離と各交換内exact保持、現在認可・Secret非保存・失効済み旧応答の利用案内拒否を反証する。

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000013 | 自身と利用可能情報を示す時 | 名前Authority化、三可視境界違反、Role・公開・実アクセスの混同、部分成立の全体化 | 許可・公開・実取得の範囲だけ開示し、非開示存在・名前・件数を漏らさず安全な次行動へ戻る |
| UX-000035 | 登録・名前／Role変更・資格リセット、既存administratorの有効Credential全喪失 | 対象取り違え、ID／Role喪失、古資格利用、取消完了推定、Secret保存、Product Data削除 | 最小管理で対象と処置影響を理解し、2操作の失効範囲・既存発行先と2入口のAuthorityを別軸で確認し、情報保持と同じRecoveryで安全に再入場する。対象不明・管理者不存在・認可設定破損は処置前停止、発行自体または結果記録が不明なら元発行Identityで現在再観測し、交換由来だけ同じexact Recoveryを保持する。通常発行へ交換Recoveryを新設しない。発行・記録確定で受け渡しだけ未確認なら確定事実を保持し、現在認可の下で人間が明示した別Operation／別Recoveryの新交換を選べる。 |

## 後続工程との関係

各引渡し先は、登録・対応公開設定の同時解除と他対象・本体保持、発行／結果記録／受け渡しの区別、元Identity再観測と明示新交換の分離、管理者認証喪失時の既存Host案内を保持する。各交換内の同じexact Recoveryと、確定発行後の別Operation／別Recoveryを区別し、通常発行へ交換用Recoveryを新設しない。

UI／SPEC／Qualityへの各引渡しは、固定administrator鍵操作、Workbench通常入口、MCP鍵操作非公開、追加認証なしのHost交換2操作、既存Root／Path、4組表示・3組確認と採用済み担当Roleの固定境界を保持する。独立失効は新鍵発行も開始済みTaskの取消も行わない。

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 自身／管理対象の可視差、対象ID・表示名・Role権限、公開／実アクセスと部分可視、資格状態・処置影響、新Secret一度表示、鍵交換2操作の範囲・既存発行先、2入口のAuthority差、保持範囲・現在地・再入場。失効確定と発行不明、権限設定破損での処置前停止を区別する |
| SPEC（UX＋IAの正式入力） | ユーザー資格相関、現行Role認可・Exposure・実アクセスの別判定、名前非Authority、Role変更の次認可反映、鍵交換のID／Role保持と旧資格拒否・取消分離、Secret非保存、2操作の失効集合・既存発行先と入口Authority、Identity・ユーザー情報・Role権限・登録・Product Data保持。発行自体または結果記録が不明なら元発行Identityで現在再観測し、交換由来だけ同じexact Recoveryを保持する。通常発行へ交換Recoveryを新設しない。発行・記録確定で受け渡しだけ未確認なら確定事実を保持し、現在認可の下で人間が明示した別Operation／別Recoveryの新交換を選べる。 |
| Quality Analysis / IA（伴走） | 各Objectの同一性と関係、名前とAuthorityの差、三可視境界、Role／公開／実アクセスの未成立と部分可視、処置対象取り違え、2操作と2入口の別軸、Secret非保存・単体利用非依存。対象不明・管理者不存在・認可設定破損での処置前停止、発行自体または結果記録が不明なら元発行Identityで現在再観測し、交換由来だけ同じexact Recoveryを保持する。通常発行へ交換Recoveryを新設しない。発行・記録確定で受け渡しだけ未確認なら確定事実を保持し、現在認可の下で人間が明示した別Operation／別Recoveryの新交換を選べる。再観測なしの完了・rollback拒否も検証する |

Architecture／Sourceへ直接引き渡さない。

鍵3操作の引渡しは、通常発行＝新Secret一度・既存資格失効なし、独立失効＝指定資格失効・新資格とSecret発行なし、交換＝定義済み失効範囲＋一度発行・情報保持・同じRecoveryを区別する。交換専用の回復条件を他操作へ転用しない。

UIは操作対象と担当Role、登録状態／公開範囲／内容存在、変更前後と次要求からの影響を区別して提示する。SPECは変更前の現在権限による認可、固定管理境界と次要求反映を保持する。Quality Analysis / IAはmanagerによるadministratorの付与・解除・降格・詳細権限変更と鍵操作、developer管理、設定迂回の拒否、administrator表示名変更の許可、登録≠公開・解除≠削除を反証する。

## 情報源

- [UX-000013のIA分析](../../Analysis/UX-000013/ia_analysis.md)
- [UX-000035のIA分析](../../Analysis/UX-000035/ia_analysis.md)

## 補足分析

なし。

## Checklist

- [x] IA定義だけで情報契約を理解できる
- [x] 全入力UXの利用者成果・場面・対象・状態・導線を保持した
- [x] 情報Objectと利用者にとっての意味を定義した
- [x] IdentityとRelationを定義した
- [x] Source Identity／RelationからCanonical Identity／Relationへの変換を明示した
- [x] 全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] StateとVisibilityを定義した
- [x] Temporal Meaningを定義した
- [x] Priority・Grouping・Findabilityを定義した
- [x] ResponsibilityとAuthorityを分けて定義した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] Failure・Risk・Constraintを定義した
- [x] Human Inputの必要性を評価した
- [x] UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] Verification Intentを明示した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceを正本としていない
- [x] 補足分析へ必須情報を退避していない
