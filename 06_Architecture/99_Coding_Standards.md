# CRDD内部ツール・コーディング規約

Status: Stable (v0.21.0)
Owner: Qual-Lab
Last Updated: 2026-09-06
Scope: `40_Develop/**`の実装と、CRDDが配布する`template/tools/**`の現行Tool本体・起動入口・設定・Schema。v0.21移行目標は本文で区別する

## 1. 目的と正本

本書は、CRDD公式Repositoryが所有する内部ツールの命名、TypeScript／Rust source、試験および機械検査に適用する単一正本である。「Qual Suite準拠」のような外部参照だけでは規則を完了させず、CRDDで適用する値を本書に固定する。

実装・試験・ビルド定義は`40_Develop`、本書を含む実装設計は`06_Architecture`、反復する操作手順は`19_Workflows`が所有する。現行配布では採用Repositoryへ追加取得なしで届けるTool本体、固定Native成果物および配布Identityを`template/tools`が所有する。v0.21では[CHG-000076](../99_Roadmap/Changes/CHG-000076/change.md)により、Tool実装と固定Native成果物を各CRDD基準版の`40_Develop`へ移し、`template/tools`を薄い起動入口、設定、SchemaおよびRelease Manifestへ限定する。物理移動とConsumer Closureが完了するまでは目標状態を現行所有関係として扱わない。`99_Roadmap`はWork Lifecycleの案内、Change／Release AggregateとEvidenceを所有し、採用側で実行するToolの配布先として使用しない。`template/tools`には本書が成果物種別ごとに明示した命名だけを適用し、`40_Develop`のSource配置規則を機械的に複製しない。標準工程フォルダとその正本文書はCRDD文書規則で命名し、以下の実装ファイル命名を工程フォルダ名へ拡張しない。

本書はQual Suite Commit `d7493e25f719bef6e46b8dbba7926f9a74e1165e`、Tree `62fa90f2020803609935a10944dcffe03484af34`の`06_Architecture/qual-insight/99_Coding_Standards.md`と`90_Release/qual-insight/Changes/CHG-000004_Implementation_Naming_Convention.md`を設計入力として使用した。今後のQual Suite側の変更を自動採用せず、CRDD側の変更トレースと人間の決定権限を通じて本書を更新する。

TypeScript／Rustの実行境界、Biome、型検査、Node.jsおよびRust toolchainは本書を正本とする。旧名、互換層および移行の扱いは[本質的修正と互換層の境界](../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)を正本とする。

## 2. 適用境界

次へ適用する。

- `40_Develop/**`のファイル名、フォルダ名およびTypeScript識別子（TypeScript identifier）
- `40_Develop/platform-access/**`のRust識別子（Rust identifier）、Cargo設定および試験
- `40_Develop/**`が所有する試験、パッケージスクリプト（package script）および設定
- `template/tools/**`の現行Tool本体・起動入口・設定・Schema・固定Native成果物と、v0.21移行後に残る薄い起動入口・設定・Schema・Release Manifestのファイル名と識別子
- 新設または変更するCRDD所有の設定JSON key、IPC channel、activity event、DB名およびCSS class

次のmachine valueは、各契約が所有するため本書を理由に改名しない。

- 既存のChecker出力、Schema、protocol、CLI flag、環境変数、reason、statusおよび暗号domain
- 外部API、標準規格、Node.js APIまたは第三者packageが定める識別子
- 過去のCHG、Evidence、CHANGELOG、tagまたはReleaseに記録された当時のPathとcommand

これらを変更する場合は、命名整理ではなく各契約の破壊的変更として別に判断し、利用側と移行を追跡する。

### 2.1. 実装言語と実行境界

CRDD公式Repositoryが所有する内部Scriptは`.ts`を標準とし、Node.js 24.12 LTS以上のネイティブTypeScript型除去で実行する。Runtime依存として`tsx`、`ts-node`、Babel、Bundlerまたは専用の変換packageを要求しない。実行コードはESM、Node.js組込み機能および`import type`を基本とする。型検査は`noEmit`のTypeScript compiler確認としてRuntime実行から分離し、型検査の成功だけを実行成功、準拠またはリリース可否へ昇格しない。

ネイティブ実行で型除去できない`enum`、Runtime namespace、parameter property、decorator、path aliasまたはcompiler変換を前提とする構文を内部Scriptへ導入しない。

TypeScriptだけでは安全に確認できないOS APIへ接続する最小部分は、`40_Develop/platform-access/**`のprivate Rust実装に限定できる。CRDD本体、一般CLI、Policy、契約およびProcess lifecycleはTypeScriptに保持する。Rust成果物は公開CLI、独立製品、永続準備Lifecycleまたは採用RepositoryのBuild依存を所有せず、固定protocolで要求されたOS観測と限定操作だけを行う。この例外を内部Script一般のRust移行へ拡張しない。

BAT、CMD、PowerShellまたはShell ScriptをOS権限判定のRuntime実装やBuild orchestrationとして新設しない。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。Rustの固定成果物、toolchainおよび署名Identityへの結合は[Windowsネイティブ部品の設計](Details/platform-access/01_Architecture.md)が所有し、反復するBuild・検証手順は[Coordinator RuntimeのWorkflow](../19_Workflows/01_Coordinator_Runtime.md)が所有する。

Coordinatorのproduction sourceとtest sourceは、別々のstrict設定で`noEmit`検査する。攻撃的な不正shapeまたはNode.js API差替えを扱う試験fixtureは、`unknown`と実行時assertionで表現し、型に合わせて負例を弱めない。

Repositoryの基準Node.js版は`.node-version`と各packageの`engines.node`へ同義に固定する。特定のversion managerは要求しない。`.mjs`、`.cjs`または`.js`を残す場合は、bootstrapまたは外部互換等の明示理由と適用範囲を変更トレースへ記録する。移行途中であること自体は恒久例外の理由にしない。拡張子の変更によってfolder、決定権限、公開範囲、package境界または単独配布の可否を変更しない。

開発時の静的LintとFormatterは、Repository rootの`biome.json`を正本とするBiome 2.5.6へ固定する。BiomeはdevDependencyに限定し、Runtime成果物または実行時依存へ含めない。Lint、Formatter確認、TypeScript型検査およびRuntime testは別の確認軸として実行し、一つの成功を他の成功へ流用しない。既存Scriptへ一括自動修正を適用せず、移行または是正する単位ごとに整形と意味回帰を確認する。

CRDD所有のTypeScript packageは、全回帰用の公開`test` scriptから、Formatter確認、TypeScript型検査、Warningを失敗とするLint、package固有の静的契約検査、試験本体の順に到達できなければならない。試験本体は内部`test:run`へ分離し、通常の`npm test`から静的段階を迂回させない。Formatter確認が失敗した場合は試験を開始せず、意図的に`format`を適用して差分を確認した後、Formatter確認から再実行する。検証入口が未承認のSource書換えを自動実行してはならない。原因を限定する個別試験は、同じ固定改訂版で静的段階が成功した後にだけ直接実行でき、個別試験だけを全回帰完了へ読み替えない。

### 2.2. Platformと外部接続の境界

CRDD公式Repositoryで新しいToolまたはRuntimeを設計する場合、業務・Project・Authority・状態遷移等のCore契約を、OS固有処理およびCLI／MCP／HTTP等のTransport固有処理から分離する。現在一つのOSまたはTransportだけを実装する場合も、Coreの意味へWindows Path、SID、DACL、POSIX mode、UID／GID、signal、Console、service manager、Container HostまたはTransport sessionを直接持ち込まない。

```text
External Interface Contract
  ├ CLI Adapter
  ├ MCP Adapter
  └ Future Transport Adapter
        ↓
Tool／Runtime Core
        ↓
Platform Contract
  ├ Windows Adapter
  ├ Linux Adapter
  └ macOS Adapter
```

これは全Platform、全Transportまたは空のAdapterを先に実装する規則ではない。現在実在するOS／Transport依存とCore責務の境界だけを抽出し、未実装対象は未対応としてFail Closedにする。Platform名の分岐、共通Interfaceまたはstubの存在だけを互換性へ読み替えない。

- Platform間では同じ機構ではなく、Authority、Identity、分離、Effect制限、cleanup、RecoveryおよびEvidenceの同じ保証を要求する。
- Transport Adapterはdecode／encode、request identity、取消通知および接続状態だけを所有し、CoreのAuthority、Project Model、状態遷移、Repository操作または成功条件を生成しない。
- CoreからOS固有moduleまたはTransport実装を直接参照する必要が生じた場合は、Adapter境界不足としてArchitectureへ戻す。単なる文字列整形、純粋なdata変換または既存の標準library型まで無意味にAdapter化しない。
- 対応Platform／Transportごとに、Build成果物、署名またはTrust Identity、必要環境、成立保証、未対応機能および検証済み範囲を明示する。未実装Platformを別Platformへ自動fallbackしない。
- Windows、LinuxおよびmacOSで方式が異なる場合、最小公分母へ保証を弱めず、各Adapterで同じCore要求を満たす。満たせない保証は対応済みと表示しない。
- 将来のToolも、最初のOS固有API、Filesystem規則、Process制御、Container接続またはTransport固有状態を追加する時点で、Coreに属する意味とAdapterが所有する方式を設計・試験へ分ける。
- 最初に機能を生成・利用したToolを、その機能の所有者と自動的に扱わない。別のRuntime、Transportまたは採用Repositoryから同じ意味を利用する独立した理由があり、変更理由、公開契約および試験境界を単独で説明できる場合は共通コンポーネントへ分け、元のToolには専用Adapterだけを置く。将来利用の想像だけで分けず、現在の利用側または採用済み計画から境界を説明できることを要する。

Platform Adapterの追加は、新しいBuild、配布、Threat Model、移行、検証およびRelease判断を伴う独立した対応である。CoreがPlatform非依存であることだけから、そのPlatformで利用可能または安全と主張しない。

## 3. ファイルとフォルダ

### 3.1. 基本形式

Toolの既定書込みRootは現在のリポジトリ内に限定する。現在のリポジトリは、Current Working Directoryではなく、対象Projectと正規化・実体確認した最寄りのVersion Control worktree Rootから解決する。Toolをsubdirectoryから起動しても、そのDirectoryをRepository Rootとして扱わない。Repository-localな非正本状態が必要な場合は、検証済みRoot直下の用途別`.crdd`配下へ集約し、候補Revision、Provider mountおよびGit管理対象から除外する。Repository-local `.crdd`はignore-by-defaultとし、Runtime状態、候補、log、一時成果物または生成物を個別列挙だけで追跡対象から外す設計にしない。Commit固定された内容自体がRuntimeの検証入力になる非秘密のRepository設定だけを、用途と正本性を確認した明示allowlistとして追跡してよい。選択Userに永続するProvider Home、Candidate Store、Recoveryその他のRuntime状態は、OS Known Folderから導出し保護を検証した固定Runtime Rootへ置く。Repository-local状態とUser／Host Runtime状態を混在させない。

親Directory、兄弟Repository、別Repository、OS一時Directoryまたはcaller supplied absolute Pathへ書き込む実装は、現在DirectoryやPath文字列だけから許可しない。用途限定Rootの事前許可またはOperationごとの人間承認、Root Identity、所有主体、保持期間、容量、cleanup／Recoveryおよび残存確認をEffect前に強制する。試験、release staging、Git worktree、archive、logおよび診断物も例外にしない。一時物は一つのOperation所有Rootへ集約し、正常・失敗・取消・親Process喪失の全経路と次回安全入口での回収を試験する。

| 対象 | 必須形式 | 例 |
|---|---|---|
| フォルダ | ASCII `kebab-case` | `checker/`, `test-fixtures/` |
| TypeScriptファイル | ASCII `kebab-case` | `crdd-check.ts`, `fault-injector.ts` |
| Rust moduleファイル | ASCII `snake_case` | `protocol.rs`, `windows.rs` |
| Markdownファイル | ASCII `kebab-case` | `coding-standards.md`, `threat-model.md` |
| 通常のJSONファイル | ASCII `kebab-case` | `provider-profile.json` |
| Pythonファイル | ASCII `kebab-case` | `provider-egress-proxy.py` |
| Plain text成果物 | ASCII `kebab-case` | `general-task-verification.txt` |
| 固定Native実行物 | ASCII `kebab-case` | `crdd-platform-access.exe` |
| 版固定Policy成果物 | ASCII `kebab-case`のsubject＋`-<major>.<minor>.<patch>.policy` | `windows-docker-desktop-4.41.2.policy` |
| Dockerfile | ASCII `kebab-case`のsubject＋`.Dockerfile` | `provider-egress-proxy.Dockerfile` |
| 試験ファイル | `<subject>.<kind>.test.ts` | `crdd-check.contract.test.ts` |

大文字小文字の混在、空白、意味を持たない連番、および表で対象別に定めた区切り形式以外を使用する命名は禁止する。TypeScript／Markdown／JSON／Python／Plain text／固定Native実行物／版固定Policy／Dockerfile subjectの通常名へ`snake_case`を、Rust moduleファイルへ`kebab-case`を適用しない。

### 3.2. Sourceの責務別配置と公開境界

`40_Develop/<subsystem>/src`の物理Directoryは、公開／非公開ではなくCapability、責務または外部境界を表す（MUST）。`internal/`、`common/`、`utils/`または`helpers/`のように、責務を示さず利用可否だけを表す汎用DirectoryをCRDD所有Sourceへ新設してはならない（MUST NOT）。既存の汎用Directoryを変更する場合は、同じ変更で全Consumerを責務別Directoryへ移行する。

`src/`直下を第一階層、Capability配下を第二階層として、CRDD所有SourceのDirectoryは原則として二階層以内に収める（MUST）。Package名または親Capabilityですでに表現できる`domain/`、`repository/`、`application/`等を形式的に重ねてはならない（MUST NOT）。第三階層が必要な場合は、独立した変更理由、利用側、公開境界および試験境界を説明し、独立Subsystemへの分離または第二階層への平坦化を先に検討する。

型だけを持つFileも、`outcome.ts`、`artifact-model.ts`のように所有する概念で命名する。複数責務の型を集める`types.ts`を既定の置場にせず、同じ変更理由と利用側を持つ一つの概念だけを扱う場合は概念名を使用する。`index.ts`は型本体の代替ではなく、Architectureが宣言した公開Symbolの明示的な再公開だけを所有する。

Source File名は主要責務を表す。次の標準Suffixへ自然に該当する場合はそのSuffixを使用し、該当しないFileを分類のためだけに無理に改名してはならない（MUST NOT）。

| Suffix | 所有する責務 | 判断する問い |
|---|---|---|
| `-model.ts` | Domain概念、Data構造または状態の表現 | 何であるか |
| `-types.ts` | 同じ責務に属する補助型集合 | どの型を一緒に使うか |
| `-store.ts` | 状態またはDataの保持、永続化および取得 | 何を保持するか |
| `-policy.ts` | Rule、Authority、選択、許可または適用判断 | 何を判断するか |
| `-adapter.ts` | 外部System、Platform、Providerまたは別Capabilityとの境界変換 | 何と接続するか |
| `-factory.ts` | 実装選択、Dependency Injectionまたは複数Dependencyの組立て | どう生成するか |

`-types.ts`は責務名を前置し、同じ変更理由と利用側を持つ補助型だけに限定する。裸の`types.ts`、複数責務を跨ぐ型集積および独立したDomain概念の退避先として使用してはならない（MUST NOT）。独立した意味を持つ概念は`-model.ts`または責務を直接表す具体名を使用する。

`-store.ts`はMemory、FilesystemまたはDatabaseという永続化方式ではなく、保持責務によって判断する。登録、索引または検索が主目的でも保持責務を所有する場合は、新しい標準Suffixとして`-registry.ts`を増やす前に`-store.ts`への統合を検討する。`-factory.ts`は単純なObject生成関数が存在するだけでは使用せず、生成判断が独立した責務を持つ場合だけ使用する。

`-service.ts`、`-runner.ts`、`-registry.ts`、`-errors.ts`および`-cli.ts`は標準Suffixにしない。既存のecosystem入口、公開契約またはError taxonomy等で必要な場合は、所有責務と適用範囲をArchitectureまたは変更トレースで説明する。標準Suffixへ分類できない場合は、`checker-pipeline.ts`、`semantic-coverage.ts`、`runtime-recovery.ts`、`artifact-parser.ts`のように責務を直接表す具体名を使用する。

`*-utils.ts`、`*-helper.ts`、`*-common.ts`および`*-manager.ts`は、主要責務を隠すため新設または維持してはならない（MUST NOT）。禁止語を別名へ機械置換せず、状態保持、判断、境界変換、生成、解析、回復等、そのFileがOwnerとして持つ責務へ分解または改名する。外部製品の正式名称、Protocol fieldその他の変更不能な語彙は対象外だが、内部Source File名へ同じ曖昧語を流用しない。

```text
src/
├ index.ts          Rootを公開境界にする場合の明示allowlist
├ <capability>/     Product／Domain上の責務
├ adapters/         外部契約と内部契約の変換
├ boundary/         信頼境界の入力検査・正規化
├ migrations/       期限と削除条件を持つ移行処理
├ ports/            外部Effectまたは実装差を反転する契約
└ ...               Architectureで責務を定義したDirectoryだけ
```

表中のDirectoryを全Subsystemへ形式的に作らない。実在する責務だけを作り、Subsystem固有のCapability名を優先する。`domain/`、`application/`、`repository/`、`protocol/`、`transports/`等を使う場合も、各名称の意味をArchitectureで固定する。同じfilenameまたは似たalgorithmが複数Subsystemにあることだけを共通化の根拠にせず、同じ意味契約、変更理由、利用側および検証境界を独立して説明できる場合だけ共通Ownerへ移す。

| 境界 | 規則 |
|---|---|
| 公開Symbol | Architectureが指定したRootまたはCapability境界の`index.ts`から明示exportした集合だけを公開面とする |
| 非公開実装 | Architecture宣言済みの公開`index.ts`からexportしない。`internal/`というPath名を非公開性の根拠にしない |
| Subsystem内参照 | 責務別Directory間の明示Pathを許可する。循環依存とOwner不明の共通置場を作らない |
| Subsystem間参照 | Architectureが相手Subsystemに宣言したexactなRoot／Capability `index.ts`だけを使用し、Source deep importを禁止する |
| 試験 | 公開契約試験は`index.ts`を使う。非公開単位の試験だけが同一Subsystemの実装Pathを参照できる |
| 移行 | 旧Path、新Path、全Consumer、削除条件および公開export集合を同じ変更で照合する |

公開面は近傍にある任意の`index.ts`の存在だけで成立しない。Architectureが公開入口としてexact Pathを宣言したRootまたはCapability `index.ts`だけを入口とし、宣言した公開Symbol集合と実export集合を契約試験で完全一致させる。未宣言export、宣言漏れ、他Subsystemからのdeep importおよび旧Path残存を拒否する。CLI、MCP、Workbench、試験または生成Toolを例外Consumerにしない。巨大なRoot Barrelを新設せず、独立した変更理由と利用側を持つCapabilityはCapability別入口を維持する。

公開`index.ts`はSymbolを明示して再公開し、無名の`export * from`を使用してはならない（MUST NOT）。Architectureがnamespace自体を公開契約として定義する場合の`export * as <namespace> from`は、namespace名と利用側を契約試験で固定した場合だけ使用できる。`internal`その他の非公開実装Pathを公開してはならず、公開入口に追加するSymbolはArchitectureの公開集合と同じ変更で更新する。

Package Rootへ任意の`.ts` Sourceを平置きしてはならない（MUST NOT）。TypeScript Sourceは責務に応じて次の所有Directoryへ置く。既存の平置きSourceを変更する場合は、入口、package script、試験、設定および文書参照を同じ変更で移行する。

| Directory | 所有するSource | 所有しないもの |
|---|---|---|
| `src/` | Library／Runtime本体、Application、Domain、Adapterおよび再利用する実装 | CLI起動だけの薄い入口、試験専用注入器 |
| `bin/` | 人間またはpackage scriptが直接起動する薄いCLI入口 | Domain判断、重複した実装本体 |
| `scripts/` | 開発、生成、移行または診断の用途限定Script | 公開Runtime入口、通常利用で必須の実装 |
| `tests/` | 試験、試験Runnerおよび試験専用支援 | Production Consumerが利用する実装 |

`bin/`と`scripts/`も、実装本体を再定義せず`src/`または他Subsystemの宣言済み公開入口を利用する。Package Rootには`package.json`、TypeScript設定、lockfileその他のecosystemがRoot配置を要求する設定だけを置く。単一Fileの便宜を理由に例外化せず、Root配置が外部ecosystem契約として必要な場合だけ、exact filenameと理由を本節または対象Architectureへ追加する。

### 3.3. ecosystem予約名

次はNode.js、TypeScript、Rust、Cargo、Gitまたは一般的なRepository discoveryが固定する予約名であり、命名例外のallowlistではなく固有の文法として扱う。

- 任意のpackage rootにある`package.json`と`package-lock.json`
- TypeScript設定の`tsconfig.json`、`tsconfig.strict.json`、`tsconfig.tests.json`
- Rust crate rootの`Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`、Cargo build scriptの`build.rs`および`.gitignore`
- Rust executable入口の`src/main.rs`
- Git設定の`.gitignore`
- Repository、Release台帳または配布用ひな型など、`40_Develop`の外側で入口を所有する`README.md`

上記以外の新しい予約名を推定しない。必要になった場合は、所有するecosystem、exact Pathおよび検出規則を本書へ追加してから使用する。

`40_Develop`は実装、試験、packageおよび実行設定だけを所有し、配下に`README.md`を置いてはならない（MUST NOT）。実装の構造と公開面はArchitecture、反復可能な導入・開発・実行手順はWorkflow、検証義務と結果はQualityが所有する。packageの機械入口は`package.json`と公開`index`等で表し、説明を実装Directoryへ複製しない。

## 4. TypeScript識別子

| 対象 | 必須形式 | 例 |
|---|---|---|
| class / interface / type | `PascalCase` | `CheckerReport`, `RuntimeProfile` |
| enum相当の型名 | `PascalCase` | `RiskLevel` |
| 関数 / メソッド | `camelCase`の動詞句 | `resolveRepositoryRoot()` |
| 変数 / parameter / property | `camelCase`の責務名 | `repositoryRoot` |
| Booleanの変数 / parameter | 意味に合う補助動詞predicate、または主語＋閉じた状態／イベントpredicate | `isReady`, `hasFindings`, `configurationMatches` |
| Array / readonly Array | 内容を表す複数形 | `findings`, `candidatePaths` |
| 真の定数 | `UPPER_SNAKE_CASE` | `MAX_INPUT_BYTES` |

Boolean規則はBoolean型の変数とparameterへ適用する。`null`または`undefined`を除いたunionの全構成がBooleanまたはBoolean literalである場合もBooleanとして扱う。許可する文法は、次の三つの閉集合だけである。

- 補助動詞prefix: `is`、`has`、`can`、`should`、`did`、`does`、`was`、`were`、`will`。prefixの直後は大文字で始まる責務名とし、prefix単独を許可しない
- 主語先行suffix: `Active`、`Allowed`、`Available`、`Complete`、`Completed`、`Confirmed`、`Created`、`Eligible`、`Exceeded`、`Executed`、`Failed`、`Issued`、`Present`、`Absent`、`Recorded`、`Released`、`Removed`、`Requested`、`Required`、`Settled`、`Spawned`、`Started`、`Submitted`、`Terminated`、`Transferred`、`Exists`、`Fails`、`Match`、`Matches`、`Throw`、`Performed`。suffixの前には小文字で始まる主語を一つ以上置く
- standalone state: `released`、`closed`、`submitted`、`present`、`settled`、`exceeded`、`confirmed`、`terminated`、`exists`

現在状態、能力、方針、照合または過去動作には、上記から意味に合うpredicateを使用する。一文字違い、大小文字違い、未知prefix／suffixおよび文法上不自然な組合せを、任意の`camelCase` Booleanとして許可しない。機械検査はこの三集合と完全一致し、集合の追加または削除は本書の変更として扱う。単に検査を通すため曖昧な名詞を使用しない。動作を表す関数は動詞句を使用し、Boolean predicateを値として公開する場合も同じ境界を使用する。object propertyはSchemaまたは公開結果契約の一部になり得るため、その所有契約が定める形式を優先する。

外部または共有function signatureを満たすため宣言が必要だが、そのfunction body内で参照しないparameterだけは、単一の先頭`_`＋`camelCase`で未使用を明示できる。参照が1件以上あるparameter、local variable、function、methodまたはpropertyへこの形式を使用してはならない。

配列規則は`Array<T>`、`readonly T[]`、alias、型制約付きジェネリック（generic）およびnullable unionを含む同じ意味の可変／不変配列へ適用する。型parameterは制約を循環なしに解決し、制約のないジェネリックは一般の`camelCase` bindingとして扱う。固定位置に別の意味を持つtuple、`Buffer`、TypedArray、`Set`および`Map`は複数形規則の対象外だが、実際の責務が分かる名前を使用する。機械検査では末尾の`s`、不規則複数形`Children`、`Criteria`、`Indices`、`Vertices`、`People`、`Media`、`Data`、集合として用いる`Evidence`／`Inventory`、exact standalone collective `evidence`、および標準的な引数vector名exact `argv`を複数形として扱う。これらを任意の単数名またはファイル別例外へ一般化しない。destructuringではproperty名ではなくCRDD所有のlocal binding名を検査する。

真の定数とは、module scopeの`const`で共有し、実行中に概念上変化しないlimit、pattern、contract literal、固定policyまたは既定値である。機械分類はprimitive／regular expression／固定template、固定値だけの配列・object・二項式、固定値から作る`Set`、固定引数1件の`Object.freeze(...)`、`BigInt(...)`、`Symbol(...)`および限定した組込み要素（intrinsic）の参照に限定する。直接記述した配列・objectは、module-localかつ非exportで、要素が再帰的に固定され、全参照を分類でき、変更、alias、引数渡し、returnその他のescapeが一件もない場合だけ固定集約値（fixed aggregate）とする。固定集約値からのreadは、元のliteral構造へ各segmentを照合できるown data property、範囲内でholeのないcanonical非負整数index、および配列自身の終端`length`だけを許可する。中間segmentも同じ直接literalでなければならず、終端はnullishを含まないBoolean／string／number／bigintだけとする。利用文脈は、括弧、`as`、`satisfies`、non-null wrapper、代入ではない明示した二項readおよびテンプレート補間（template interpolation）を途中の式合成として最外利用先まで畳み、最終的に直接`void`参照または非export・非destructuring変数宣言の初期値（VariableDeclaration initializer）へ到達した場合だけ許可する。二項式またはテンプレート補間自体を終端許可にはしない。代入演算子、`++`／`--`、`delete`、引数渡し、`new`、return／yield、export、destructuring、暗黙return、tagged template、条件式、commaその他の未定義文脈は一般bindingへfail closedにする。`constructor`、`prototype`、`__proto__`、method、accessor、spread、重複key、dynamic key、範囲外index、aggregate自体の取出しおよび型または由来を分類できないreadも一般bindingへfail closedにする。`Object.freeze(...)`を固定集約値とする場合は、global `Object.freeze`のexact 1引数が再帰固定された直接配列／object literalである場合だけとする。分類不能な参照が一件でもあれば一般bindingとして扱う。同じCRDD所有のプロジェクト依存グラフ（project graph）のmodule定数を参照するときはシンボル（symbol）の宣言元とinitializerを循環なしに再評価し、単なる名前の一致や任意のimportを固定値とみなさない。`Date`、`Date.now`、`Date.prototype.toISOString`、TypedArrayの組込み`byteLength` getterおよび、固定algorithm・入力・出力encodingを持つ`createHash(...).update(...).digest(...)`の終端ダイジェスト（terminal digest）だけを固有の構文として認める。shadowされたglobal、`Date.parse`、`Date.prototype`単体、`createHash(...)`の生成handle、動的値を凍結したobject、Path、snapshot、`WeakMap`、decoderその他のresource handleまたは一時的な`const` bindingを大文字化しない。判定順は関数binding、真の定数、Boolean、Array、一般の変数とする。型または構文を分類できないCRDD所有宣言は成功扱いにせず、規約または実装へ戻す。

名前付き関数式（`named function expression`）と名前付きclass式（`named class expression`）も、それぞれ関数名と型名の規則へ含める。取得アクセサー（`get accessor`）と設定アクセサー（`set accessor`）は関数相当宣言（function-like declaration）として走査し、内部名のcaseと曖昧名を検査する。外部契約が所有するoverride名とobject／interface propertyは機械property境界を優先するが、設定アクセサーのparameterとbody内bindingは通常の識別子規則へ含める。

TypeScript `enum`構文はNode.js native type strippingの対象外なので導入しない。「enum相当」はliteral unionまたは凍結objectから導く型の表示名だけを指す。

## 4.1. Rust識別子

Rustは`40_Develop/platform-access/**`のprivate crateだけへ適用する。module／file、function、method、variableおよびparameterは`snake_case`、struct、enum、traitおよび型は`PascalCase`、定数およびstaticは`SCREAMING_SNAKE_CASE`とする。FFIの`unsafe`はWindows API接続moduleへ限定し、各blockへ所有権、pointer lifetimeおよび解放責務の安全根拠を記載する。Rust標準の命名と型境界は`rustfmt`、rustcおよびClippyで検査し、TypeScript AST分類器へ混在させない。

`40_Develop/platform-access/target/**`は生成物であり検査母集団とGit管理から除外する。ただし`target`実体が通常Directoryかつsymbolic link／junctionでないことを除外前に確認し、通常file、symbolic link、junctionまたは分類不能な実体は検査失敗とする。`.rs`実体は同crateのexact `build.rs`、`src/**`または`tests/**`へ限定し、`Cargo.lock`を追跡する。crate rootの別名`.rs`をCargo build scriptとみなさない。`.bat`、`.cmd`、`.ps1`、`.sh`その他のShell ScriptをOS権限判定またはbuild orchestrationとして`40_Develop/**`へ追加しない。

## 4.2. Process・対話・実行コンテキスト境界

CRDD所有Toolから子Processを開始する場合は、実行ファイルと引数配列を分離した`spawn`、`spawnSync`、`execFile`または同等APIを使用し、Shellによるcommand再解釈を無効にする。JSONその他の構造化入力は責務を持つTypeScript Runtime内で構成し、上限付きbyte列として標準入力または所有する固定protocolへ渡す。PowerShellのtext pipeline、`ConvertTo-Json`、長い`Start-Process ... -Command`、入れ子Shell、Shell固有の標準入力encoding property、または搬送だけを目的とする一時fileへ再構成してはならない。OSまたは外部ToolがShellを契約として必須化する例外は、送信byte、quoting、利用側、失敗形および代替不能性を所有契約へ固定し、通常のProcess起動へ一般化しない。

[アーキテクチャ](../27_Architecture.md#24-状態処理順序副作用)の資源取得transactionに該当するToolでは、対象範囲で到達し得るobserver、Identity取得、再検証、parserおよび初期化を個別のthrow境界として試験する。各境界でcleanup成功とcleanup不明を区別し、Identity取得前はIDを捏造しないoperator transfer、取得後は対象に存在する同じexact IDの保持を確認する。内包producerのtyped failure集合を、認証・認可・可視性で区分した各consumerとJSON／人間表示／exit等の該当する公開形態へ対応づけ、境界外のconsumerへ対象の存在、IdentityまたはRecovery Authorityを投影しないことも確認し、projector単体またはsource配線だけで成立を推定しない。read-only観測、取得Effect前の拒否、残存所有なしで終了を決定論的に観測できる局所資源は理由付き非該当とし、Recovery Authorityを新設しない。

秘密入力はdirect TTY、外部送信等の対話承認はCRDD所有の固定console device、OAuthは公式Provider CLIとsystem browserのように、所有する対話入口を一つにする。固定console deviceを使う場合は、deviceの検査、表示、入力、取消およびhandle回収を一回の実操作を所有するlifecycleへ結合し、非リダイレクト、既存reader不存在、表示／入力失敗時のFail Closedを確認する。可用性確認だけのopen／closeを保護対象Process内の独立Gateとして先行させ、その後に同じdeviceまたは別のnative Effectを開始してはならない。診断用の受動確認は後続Effectを同じProcessで継続せず、結果の観測後に終了する。これはredirected standard inputへのfallbackを許可しない。対話端末を取得できない場合、標準入力、環境変数、argv、一時fileまたは別Shellへ推測fallbackしない。実行に必要な公開の構造化Taskと、passphrase、credential、OAuth codeその他の秘密を同じ搬送へ混在させない。

Release、署名、Authority、Recoveryその他の保護対象操作は、packageの`engines`宣言またはPATH上の表示名だけを実行RuntimeのAuthorityにしない。絶対Pathとversionを確認した実行ファイルを使用し、package scriptまたは子Processも同じ実行Runtimeへ結合する。親Processだけを絶対Pathで起動しても、package script内の裸のcommandがPATH上の旧Runtimeを再選択できる場合は結合済みと扱わない。未対応version、実体差または判定不能時は、対話入力、Release検証およびEffectより前に停止する。

秘密入力、署名、Authority発行、Recoveryまたは実Provider Effectを開始する保護操作を、裸のRuntime名を含むpackage aliasへ公開してはならない。人間向け手順は、検証済みRuntime実行ファイルとRepository所有entrypointの双方を絶対Pathで指定する。一般の型検査、静的解析、決定論的試験またはbuild orchestrationはpackage scriptを利用できるが、それを保護操作のAuthorityまたはRelease成立根拠へ流用せず、実行版不一致を明示的に検出する。

<a id="release-signing-development-boundary"></a>

Release署名または同等の発行Authorityを使用するToolでは、日常の開発反復と正式な署名済み配布検証を別の入口へ分離しなければならない（MUST）。開発入口は、productionと同じ意味契約、正常・準正常・異常、cleanupおよび利用側を固定fixture、試験専用鍵、Fake Adapter、契約試験または結合試験で再実行可能に検証し、公式Release秘密鍵、公式passphrase、実署名manifest、実Provider送信またはRelease Authorityを要求してはならない（MUST NOT）。署名を使わない通常Toolへ、存在しない鍵、署名段階またはRelease状態を追加しない。

正式署名入口は、[リリース準備状態](../19_Maintenance.md#release-signing-verification-boundary)で固定した候補だけを対象とする。配布Root、Source Root、Commit／Tree、package・artifact Identity、引数、実行Runtime、既存manifestおよび署名前に判定できるFilesystem条件を、秘密入力より前にFail Closedで全て検査しなければならない（MUST）。秘密入力後も同じ対象Identityと改変不在を再確認し、事前検査を署名時の再検査へ流用しない。非秘密条件の不一致、入力誤りまたは署名失敗ではmanifest、Authorityまたは成功状態を発行せず、候補を修正する場合は正式署名を反復デバッグへ使わず開発入口へ戻す。

公式Release秘密鍵の内容またはpassphraseを`.env`、`.env-crdd`、Repository-local `.crdd`、argv、環境変数、標準入力redirect、一時file、logまたは試験fixtureへ保存して反復入力を省略してはならない（MUST NOT）。Repository RootのGit管理外`.env-crdd`には、公式Release担当者が所有する秘密鍵fileの絶対Pathだけを`CRDD_RELEASE_PRIVATE_KEY_PATH`として置ける。この参照は鍵内容、passphraseまたは署名Authorityではなく、Signerは署名時だけ同fileを読み、対象fileの存在と型を秘密入力前に検査し、鍵内容をpassphrase入力後の署名時にだけ読む。将来、OS保護の鍵Handle、Hardware-backed鍵、Credential Storeまたは署名Serviceを採用する場合も、値をToolへ公開せず、鍵用途、利用主体、候補Identity、回数、取消および監査を別の保護契約として確認する。採用Repositoryまたは一般利用者は公式Releaseの署名を検証する側であり、公式Release秘密鍵またはpassphraseの保有・入力を要求されない。

Source、fixture、CLIおよび子ProcessのPathは、Repositoryを意図的に現在Directoryへ結合する契約を除き、moduleまたは明示Rootから絶対化する。試験起動Directory、Shell、Node versionまたはsession環境の偶然に依存させない。Process境界を新設・変更する試験は、少なくとも引数の完全一致、Shell非使用、構造化入力byte、未対応Runtime、対話端末不成立、起動Directory差およびEffect前停止を、該当する範囲で確認する。

子Processの環境境界は`spawn`／`spawnSync`等へ渡した`env` objectのshapeだけで確認済みとしない。対象OSが空または非空の環境mapへ補う値を含め、実子から見えるkey／値の集合を秘密値を出力しない限定試験で確認する。親環境の置換が必要な内部Processでは用途別の固定Profileを使い、OS由来で必要な値、固定neutral値、意図して渡すRuntime所有値を区別する。PATH、Home／profile、proxy、Credential helper、tokenおよびRuntime injection設定は、必要性と取得元を個別に立証していない限り実値を渡さない。Windowsでは環境名の大小文字alias、重複、NULおよびOSによる補完を同じ確認母集団へ含める。Provider、Docker、native helper、Worker等の異なる実行基盤を一つの最大環境へ統合せず、用途別に処置または理由付き非該当を示す。

標準入力、標準出力、標準エラー、console device、pipe、socket、file descriptorまたは同じProcessを複数の搬送・対話・制御役割へ使用する実装は、役割ごとの所有者、redirect、EOF、close、取消、上限およびcleanup後条件を契約試験へ対応付ける。一方の役割を模した単体試験だけで兼用の成立を推定せず、公開CLIまたはRuntime入口が実際に使用するProcess構成で、構造化入力と対話入力、結果と診断、通常完了と取消等の該当する組合せを同時に再現する。役割間の干渉を観測または不変条件で否定できない場合は、同じchannelまたはresourceへ結合しない。

Trust、Security、Authority、Filesystem／Network／Process EffectまたはRecovery境界を新設・変更する試験は、正本の着手前整合確認で定めた確認母集団を使用する。適用可能な入力／状態、alias・symlink・junction・indirection・境界、preflightからEffect直前および結果公開までのlifecycle段階、各Effect発生点を組合せ、正常、拒否、境界、判定不能および処置件数0を確認する。全組合せを実行しない場合は同値分割、境界値、除外理由および未評価範囲を示し、肯定試験、最終Gateの拒否またはcoverage率だけから前段の安全性を推定しない。

Trust、Authority、Recoveryまたは安全上重要な結果をAPI、IPC、callback、event、return値、fileまたは永続記録で搬送する試験は、production wiringから実producer、対象範囲で把握できるproduction consumerおよび外部公開契約を特定する。肯定入力は実producer出力、またはproductionと共有するCanonical validator／generatorから作り、手書きfixtureだけでproducerとの結合成立を主張しない。外部状態、共有状態または資源不存在をTraceや完成根拠へ登録する場合は、実API、FilesystemまたはProcessから取得した観測値を判定に用い、期待するliteralを観測値として代入しない。期待値は、Effect前に固定した入力、正本契約または対象観測と独立したProducer結果から導出し、観測した出力を別名で期待値へ循環させない。同じ観測変数をassert後のTraceへ結合し、期待値と異なる候補値および反証状態では判定とTraceの両方が成立しないことを確認する。別の呼出しまたはprocessで保護対象Effect／Recoveryの十分な根拠または不可欠なAuthority predicateになる耐久状態だけをAuthority-bearing stateとして扱う。発行条件成立前の失敗は新規Authority 0、exact intent発行後の失敗は同じintentのRecovery保持、retryでは別・拡大Authority 0、partial／mismatch／unknownでは処置0とEvidence保持を確認する。fresh Authorityへ再結合する通常のqueue、progress、checkpointまたはEvidenceは、それだけではAuthorityにしない。

外部イベント、非同期I/O、子Processまたは取消可能な処理を扱う契約試験は、開始前、保留中、正常完了、失敗、取消、タイムアウト、遅延・重複通知および資源回収を同じ状態母集団に含める。コールバックとイベントが同じ失敗から連続して発生する場合、取消と完了が競合する場合、または保留中のI/Oと終了処理が競合する場合を排他的な単発モックへ分解して成立を推定しない。対象実行基盤の実際の基本機能を使う限定試験、または実契約と同じ複合順序を再現する試験用実装を少なくとも一つ含め、イベント監視、保留要求、ハンドル、ロックおよび子Processの残存0を確認する。

Workerまたは別Threadが所有するOS lockの直後に、Console、別Workerまたは子Process等の境界へ進む場合は、取得APIのreturn、固定sleep、event-loop turn数またはJS-levelのWorker round-tripだけをnative resourceのcross-boundary readinessとみなさない。実OS resourceと後続Processを組み合わせた反復試験でnative crashが残る場合は、同一Process内の待機を継ぎ足さず、独立Supervisor Process等のresource所有境界へ分離する。その取得、readiness、releaseおよびexitを明示応答で確認し、その後にlock identity、所有generationおよび耐久Recovery recordを最初の後続Effect前に再確認する。timeout、error、exit、置換、retireまたは判定不能では後続境界を開かず、既存のcleanup／RecoveryへFail Closedで戻す。単独lock試験だけで、実Operation状態へ結合したlockとConsole／child spawnの複合順序を成立済みと推定しない。

複数境界の結合不具合を人間の反復操作だけで探索しない。pureな計算、adapter状態機械、実子Process、OS resource、公開Runtime入口の順に、下位Gateを通過した場合だけ次の境界を開く再実行可能な試験へ分解する。固定公開値と試験専用実装で再現できる入力、通知順、取消またはcleanupを手動確認へ残さず、一度観測した失敗順序は原因を所有する層の回帰試験へ追加する。物理端末の表示・focus・key入力等、実OS環境でしか確認できない最終境界は限定実測として分離し、その実測を下位Gateの代替にしない。人間の承認または外部送信Authorityを試験用入力で自動成立させない。

実行環境が所有するSandboxまたは権限制約により、実子孫Processの終了、OS handle、端末その他の実資源を観測できない場合、同じ試験を毎回一般失敗として流して後から口頭で補正しない。制限環境で実行できる母集団と、実OS能力を必須にする専用Gateを、共通の安定した試験名または機械可読な分類で閉集合へ分ける。通常の全体試験は専用Gateを含む完全母集団のまま維持し、制限環境用の成功だけを全体合格へ読み替えない。専用Gateは必要な実環境で別に成功させ、両方の件数、対象改訂版および実行環境を一つの検証結果へ集約する。分類名、除外集合および専用Gate集合の差は契約試験で検出し、対象追加を暗黙に未実行へしない。

cleanupの試験は、例外を捕捉したことまたは終了値を返したことだけで合格にしない。各cleanup試行の成否、全試行を継続したこと、listener・handle・lock・child Process・一時Authority・回復記録の終了後状態、および不明時に通常成功を返さないことを確認する。削除対象が既に存在しない場合と、削除APIが無言で失敗した場合を同じ成功として扱わない。

取消要求の記録またはPromiseの解決だけを取消完了と扱わない。取消源をOperation所有の一つの状態へ収束させ、対象処理への伝播、保留処理の終了または安全な完了待ち、資源回収、Authority／Capabilityの非発行または失効、および取消後のFilesystem／Network／Process Effect 0を確認する。非同期Authority確認の全利用側は、待機直後かつ最初のEffect前に取消・失効・Revision・Identityを再確認し、既に生成した未使用Capabilityを再利用可能な状態へ残さない。

同じSecurity対象をpreflightとAuthority Gate等の複数段階で読む場合、bounded read、canonicalization、上限、Identity、alias拒否およびdecodeの共通primitiveを優先する。fresh再観測等により実装を分ける必要がある場合は、受理集合、拒否集合、判定不能、情報公開およびEffect前停止の同等性と意図した差を同じcontract test集合で確認する。後段が拒否するため安全という理由で、前段のRepository外read、一時Operation、Grant、秘密入力または別Effectを許可しない。

## 4.3. Source Header Documentation

Source HeaderはCodeの逐語説明ではなく、Symbolが存在する理由、所有責務、保証および設計由来をSourceから辿るために使用する。TypeScriptではTSDoc形式、Rustでは同じ意味を持つRustdoc形式を用いる。Public／privateではなく、名前を与えて独立した責務を持たせたSymbolを対象とする（MUST）。

| 対象 | 扱い |
|---|---|
| Function、Method、Accessor、名前付きFunction式 | 実行責務Headerを適用する |
| Interface、Type Alias | 型契約Headerを適用する |
| Class、名前付きClass式 | 状態所有Headerを適用し、個別Methodには実行責務Headerを適用する |
| Local Variable、通常の`const`、匿名Callback、Inline Object Type | Symbol Headerの対象外とする |

既存Symbolもprivateであることを恒久免除にしない。意味を確認せず名前だけから定型Headerを一括生成せず、Symbolの責務、Owner、失敗・Effect・境界を確認して移行する。短い局所処理でも独立した名前と責務を与えた場合は、巨大な説明ではなく簡潔なSummaryと`@responsibility`を残す。

Header項目は宣言種別ごとに分ける。型宣言へ実行時の入出力を形式的に書かせず、実行責務へ型の互換性を形式的に書かせない。いずれも平易なSummary、`@responsibility`および`@trace`を共通必須項目とする。非該当項目も省略せず、`N/A:`に続けてそのSymbolで非該当となる理由を記録する。単に`N/A`、`none`または同じ定型理由を全Symbolへ複製して処置済みにしない。ProductionのNamed Symbolは、それが実現する既存ARCH-IDへ接続する。SymbolごとにARCH-IDを新設せず、複数Symbolが同じARCH-IDを実現してよい。責務を持つNamed SymbolをどのARCH-IDにも接続できない場合はDocumentation例外にせず、Architecture側のGapとして戻す。存在しないID、File Pathまたは説明用の局所名をCanonical Traceとして捏造しない。

全Production Fileは、個別Symbol Headerとは別に、File先頭へSummary、`@responsibility`および一つ以上の実在`@trace ARCH-XXXXXX`を持つFile Headerを置く（MUST）。File HeaderはFileがまとめる責務境界を説明し、内部Symbolの逐語一覧や無関係なARCH-IDの和集合にしない。公開入口だけは`@packageDocumentation`も加え、公開するCapabilityとExport境界を説明する。TypeScriptの`src/`だけでなく、実行責務を持つ`bin/`、`scripts/`および配布入口も同じProduction母集団へ含める。Rustのcrate root、moduleおよびBuild Scriptは同じ意味をRustdoc module Headerで保持する。Test Fileは後述するQuality Local Item用Headerを使い、Production File Headerを重複させない。

```ts
/**
 * <Fileがまとめる責務のSummary>
 *
 * @responsibility <Fileが所有する責務境界>
 * @trace ARCH-XXXXXX
 */
```

実行責務HeaderのCanonical形は次とする。項目の並びも機械検査と人間の読取りを安定させるために維持する。

```ts
/**
 * <Summary>
 *
 * @responsibility <責務>
 * @trace ARCH-XXXXXX
 * @input <入力。なしなら N/A: 理由>
 * @returns <出力。なしなら N/A: 理由>
 * @precondition <事前条件。なしなら N/A: 理由>
 * @postcondition <事後条件。なしなら N/A: 理由>
 * @effect <Effect。なしなら N/A: 理由>
 * @failure <失敗条件。なしなら N/A: 理由>
 * @invariant <不変条件。なしなら N/A: 理由>
 * @boundary <境界。なしなら N/A: 理由>
 * @security <Security条件。なしなら N/A: 理由>
 * @concurrency <並行性。なしなら N/A: 理由>
 */
```

型契約Headerは、InterfaceおよびType Aliasが表す値の形、成立条件、利用境界および互換性を記録する。

```ts
/**
 * <Summary>
 *
 * @responsibility <型契約が所有する責務>
 * @trace ARCH-XXXXXX
 * @shape <主要な構造・識別子・Relation>
 * @invariant <常に守る条件>
 * @boundary <利用できるSubsystem・外部境界。なしなら N/A: 理由>
 * @security <Authority・秘密・公開条件。なしなら N/A: 理由>
 * @compatibility <互換性・Version条件。なしなら N/A: 理由>
 */
```

状態所有Headerは、Classが所有する生成条件、Lifecycle、Effectおよび並行性を記録する。Class内の個別Methodは実行責務Headerを別に持つ。

```ts
/**
 * <Summary>
 *
 * @responsibility <状態と操作の所有責務>
 * @trace ARCH-XXXXXX
 * @construction <生成時に必要な値と成立条件>
 * @lifecycle <生成から終了までの所有関係>
 * @effect <共有・外部Effect。なしなら N/A: 理由>
 * @failure <生成・Lifecycle上の失敗。なしなら N/A: 理由>
 * @invariant <Lifecycle中に守る条件>
 * @boundary <Subsystem・外部境界。なしなら N/A: 理由>
 * @security <Authority・秘密・公開条件。なしなら N/A: 理由>
 * @concurrency <並行性・Lock・取消条件。なしなら N/A: 理由>
 */
```

```ts
/**
 * Project Runtimeの受入判断を適用する。
 *
 * @responsibility 人間の判断を検証し、許可された状態遷移だけを適用する。
 * @trace ARCH-000005
 * @input 受入判断と現在の目的状態。
 * @returns 適用後の状態と公開結果。
 * @precondition 判断対象のIdentityとRevisionが現在状態へ一致する。
 * @postcondition 許可された遷移だけが一回適用される。
 * @effect 受入済み判断を目的状態へ反映する。
 * @failure 古い判断、対象不一致または不許可遷移を拒否する。
 * @invariant 別目的の状態とAuthorityを変更しない。
 * @boundary Project Runtimeの判断適用境界。
 * @security 判断主体のAuthorityと対象Identityを再確認する。
 * @concurrency 同じ目的への競合判断をRevisionで直列化する。
 */
export function applyHumanDecision(...) {
  // ...
}
```

固定項目は、Symbolごとに次を明らかにするために使用する。

| tag | 記録する内容 |
|---|---|
| `@input`／`@returns` | Function-likeが受け取る値と返す値 |
| `@precondition`／`@postcondition` | 呼出し前提と完了後に成立する条件 |
| `@effect` | 外部・共有Effect、または純粋計算である理由 |
| `@failure` | 区別して返す失敗、または失敗を所有しない理由 |
| `@invariant` | 成立中・終了後に守る条件、または局所値である理由 |
| `@boundary` | 外部System、Process、Filesystem、Network、Platform、別Subsystemとの境界、または境界を持たない理由 |
| `@security` | Authority、秘密、信頼・情報公開の処置、または非該当理由 |
| `@concurrency` | 並行Actor、Lock、Queue、取消競合の処置、または同期局所処理である理由 |
| `@shape`／`@compatibility` | 型契約が表す構造と、利用側が依存できる互換性条件 |
| `@construction`／`@lifecycle` | Classの生成条件と、状態・資源の所有開始から終了まで |

HeaderはCodeから明白な「値を返す」「関数を実行する」等を反復しない。ArchitectureからImplementation Detailを逆輸入せず、現行実装に存在するという理由だけで新しいCanonical意味を`@trace`へ追加しない。設計由来が不明な場合は推測でHeaderを埋めず、Architecture Gapとして所有工程へ戻す。

実装または試験によって、上位正本にない順序、境界、状態、所有、並行性、資源Lifecycle、回復、外部契約または利用者から観測可能な振る舞いが必要だと判明した場合は、[実装知識の上位還元](../27_Architecture.md#44-implementation-knowledge-promotion)を評価する。この評価は任意に省略しない。別言語・別Framework・別の内部構造でも同じ成果または保証へ必要なら`Applicable`として責務を持つ上位工程へ戻し、現在の変更トレースへ候補、還元先、影響する利用側および再開条件を残す。技術固有の方式であり別実装で変更しても保証が変わらない場合は`N/A`とし、その理由をレビューまたは変更トレースから取得可能にする。判断不能な場合は`OPEN`として上位を推測で補完せず、Source HeaderやTestだけを正本の代用にしない。

```text
実装で発見した知識
  ├─ Applicable → SPEC／Architecture等を再開し、更新後の正本から実装・Qualityへ再伝播
  ├─ N/A        → 実装固有である理由を保持
  └─ OPEN       → 判断先と再開条件を保持し、完成主張を停止
```

Test CodeではARCH-IDへ直接接続せず、検証するQuality Local Itemへ接続する。Test File HeaderはそのFileが扱う一つ以上のLocal Itemを示し、個別Test Case、名前付きTest Helperおよび名前付きFixtureは対応する一つ以上のLocal Itemへ`@trace`する。Local ItemがArchitectureとのRelationを所有するため、Test側へARCH-IDを重複記載しない。匿名CallbackやInline Object等、独立責務を持たない処理はSymbol Header対象外だが、`test`／`it`等で宣言する個別Test Caseは匿名Callbackであっても検証責務を持つため、呼出し直前のTSDocを必須とする。

Test File Headerは、File全体の検証範囲を示す。

```ts
/**
 * <Summary>
 *
 * @packageDocumentation
 * @responsibility <Fileが所有する検証責務>
 * @trace XXX-UT-001
 * @level UT
 * @scope <対象Component・Boundary・Scenario>
 * @boundary <外部境界の段階。なしなら N/A: 理由>
 */
```

個別Test Case、名前付きTest Helperおよび名前付きFixtureは次の固定Headerを持つ。Helper／Fixtureも入力準備の責務と失敗が検証結果へ影響するため、項目を省略しない。

```ts
/**
 * <Summary>
 *
 * @responsibility <検証または準備の責務>
 * @trace XXX-UT-001
 * @precondition <開始前の状態。なしなら N/A: 理由>
 * @stimulus <操作・刺激。なしなら N/A: 理由>
 * @observation <取得する観測値>
 * @oracle <合否判定>
 * @cleanup <終了後条件・清掃。なしなら N/A: 理由>
 * @boundary <到達する境界。なしなら N/A: 理由>
 */
```

```text
Production Named Symbol → ARCH-ID
Test Case／Named Test Helper／Fixture → Quality Local Item
Quality Local Item → Architecture Meaning
```

Test Levelを含むLocal Item IDとTest Fileの論理配置が不一致の場合は、どちらかを説明で上書きせず、Quality Definitionまたは試験配置の誤りとして是正する。

機械検査は、対象となるProduction Named SymbolのHeader、Summary、全固定tagの非空値、実在ARCH-IDへの`@trace`、Test Case／名前付きTest Helper／FixtureのHeader、実在Local Itemへの`@trace`、Test Levelとの一致、曖昧なFile名および公開入口からの無名Barrel Export等、決定論的に判定できる構造を扱う。Header本文の責務妥当性、`N/A`理由の妥当性、責務分割、Common Contract、過剰抽象化およびCanonical IDとの意味一致は独立reviewで確認する。機械検査のためだけに同じ定型文を複製してはならない（MUST NOT）。

## 5. 曖昧な名前

次の単独名を新設または維持しない。

- `helper`
- `util`
- `manager`
- `data`
- `info`
- `common`
- `misc`
- `doThing`
- `run`
- `execute`

`runChecker`、`executionResult`、`commonGitDirectory`のように、責務を一意にするcompound nameは許可する。外部APIが要求するoverride名またはmachine keyは適用境界外だが、内部aliasには責務名を使用する。

## 6. 試験名

試験ファイルは`<subject>.<kind>.test.ts`とし、試験種別（test kind）の`kind`は次の閉集合から選ぶ。

| kind | 使用条件 |
|---|---|
| `unit` | 単一moduleの局所計算だけを確認する |
| `contract` | 公開挙動、Schema、CLI、package、投影または複数の安全条件を一つの契約として確認する |
| `integration` | 複数component、process、OSまたはFilesystemの実境界を結合して確認する |
| `boundary` | Trust、Security、resourceまたは入出力境界を専用に確認する |
| `golden` | 固定fixtureと期待成果物の完全一致を確認する |
| `current` | 現在状態の固定snapshotを確認する |

一つの試験ファイルが複数kindを同時に所有する場合は、責務ごとに分割する。分割自体が検証リスクを増やす既存集合は、公開挙動と安全条件を包含する`contract`へ一度収束させ、後続の実質変更で分割する。

CRDDが所有するToolの実行可能な試験は、主試験レベルをDirectory、試験種類をfilenameで表す。存在しない試験のために空Directoryを作らない。

```text
tests/
├ unit/
├ integration/
├ system/
├ acceptance/
├ performance/
├ longevity/
├ fixtures/
└ support/
```

`unit`、`integration`、`system`、`acceptance`、`performance`、`longevity`は[品質保証](../16_Quality_Assurance.md#17-test-levels-and-regression)のUT、IT、ST、UAT、PT、LTに対応する。`fixtures`と`support`は試験レベルではなく、runnerの実行対象にしない。回帰専用Directoryは作らず、回帰runnerが既存試験を選択する。E2E表示だけで配置を決めず、公開入口から利用者成果までなら`system`、限定したComponent連鎖なら`integration`に置く。

Rust等の言語またはFrameworkの標準配置を維持する場合は、物理Directoryの移動を強制せず、試験カタログで同じ論理レベルを明示する。PTまたはLTのコードが存在しても通常runnerから自動実行せず、人間の明示指示と実行上限がなければEffect 0で停止する。

## 7. 機械識別子（machine identifier）

| 対象 | 必須形式 |
|---|---|
| CRDD所有の新しい設定JSON key | 既存設定objectに合わせた`camelCase` |
| IPC channel | `feature:action` |
| activity event value | `snake_case` |
| DB table / column | `snake_case` |
| CSS class | `kebab-case` |

設定JSONの規則をChecker report等の既存machine outputへ拡張しない。既存Schemaへ新しいkeyを追加する場合も、そのSchemaの正本が定める形式を優先する。

## 8. 検査と変更手順

- Biomeは表現できるTypeScript filenameとsource規則を検査する。
- Rust sourceは固定toolchainの`rustfmt --check`、rustc、Clippy Warning拒否、`cargo test --locked`、locked buildおよび固定`llvm-tools-preview`によるcoverageで検査する。stable toolchainがbranch mappingを生成せず分母0を返す場合は率へ換算せず`Not Available`とし、region／function／line実測とセキュリティ判断上の検証義務を別の確認として記録する。coverage runnerは実Directoryとして検証したcrate直下の`target`へrun固有Directoryを作り、既存treeを削除または再利用しない。
- CheckerとCoordinatorのprivate packageが所有する`lint`は、Repository rootのBiome設定を`--error-on-warnings`付きで実行し、Warningが1件以上ある場合は各packageの`check`を失敗させる。Infoはこの継続Gateの失敗条件ではなく、固定版ごとの検証結果として区別する。
- Checker packageの命名contract testは、ファイル／フォルダの検査母集団を`40_Develop/**`と`template/tools/**`の全Pathとし、未知のsubfolderまたは後続packageも同じ規則へ含める。型付き識別子の検査母集団は、固定TypeScript 7.0.2でCRDD所有の全TypeScript packageが宣言する`tsconfig*.json`から取得する。現在の対象はartifact-signing、checker、coordinator、crdd-domain-library、cros、execution-intelligence、mcp、official-asset-governance、project-operation、project-runtime、runtime-data、semantic-coverage、verification-runnerおよびversion-controlである。実Pathで重複を除いたproject source集合と両Path配下のTypeScript実ファイル集合を完全一致させ、固定件数を母集団Identityの代用にせず、未所属source、project外実体、symbolic link、取得不能または未分類構文を成功扱いにしない。各packageの再生成可能な依存Directoryである`node_modules`はRepository Rootの`.gitignore`で全階層を既定除外し、lockfileだけを追跡する。Checker試験runnerはpackage root以下の`.test.ts`をnested folderまで安全に再帰列挙し、正規化したrelative Pathのordinal順で実行する。root外解決、重複または大文字小文字だけが異なるPath、symbolic link／junction、未対応entryを拒否し、`node_modules`はexact名かつ実Directoryと確認できた場合だけ除外する。runner列挙集合と`40_Develop/checker/tsconfig.json`が所有するChecker試験集合を件数ではなくPathの完全一致で検査し、0件、欠落または余剰を成功扱いにしない。Rust sourceは`40_Develop/platform-access/src/**`と`40_Develop/platform-access/tests/**`の閉集合として別に扱い、固定件数ではなく許可Rootへの包含と空集合拒否を確認し、TypeScript projectへ算入しない。型から完全判定できない動詞句、責務名および自然言語上の妥当性は独立reviewで確認し、機械検査だけを規約全体の完全証明としない。
- 同じ命名contract testは、曖昧なSource File名、裸の`types.ts`、公開`index.ts`のPackage Headerおよび無名Barrel Exportも全母集団へ検査する。公開Header本文の意味、`@trace`が示す設計との一致、条件付きtagの十分性および非公開Symbolの公開漏れは、機械検査の成功だけで成立済みとせず独立reviewで確認する。
- `template/tools/**`の実行入口は、その入口を実装する責務の型検査Projectへexactに一度だけ所属させる。Checker入口`template/tools/crdd-check.ts`は`40_Develop/checker/tsconfig.json`が所有する。Coordinator入口`template/tools/crdd-coordinator.ts`とMCP入口`template/tools/crdd-mcp.ts`は、配布対象を増やさない`40_Develop/checker/template-tools-tsconfig.json`が所有し、通常のChecker source projectへ混在させない。新しい入口を追加する場合は、実体の追加と同じ変更で所有Projectを明示し、未所属または複数Projectへの重複所属を許可しない。
- Runtime実行Identityへ含めるDirectoryには、実行時に読み取る設定、Policy、Schema、Native成果物その他の実依存だけを置く。設計対応、試験台帳、Coverage、監査入力その他の検証専用投影は`07_Quality`へ置き、実行時Directoryへ混在させない。配布Toolであることだけを理由にCoordinatorのRuntime実行Identityへ含めず、公開入口または正式な署名・検証入口から到達する依存閉包で判定する。誤配置を是正して実行集合が変わる場合は、その一回のIdentity変更を検証し、以後の文書・検証投影更新がRuntime再署名を発火しないことを確認する。
- 型検査、Lint、Formatter、Coordinator試験、Checker試験およびRepository全体Checkerを別の合否軸として維持する。
- Release署名または発行Authorityを持つToolでは、開発入口が公式鍵・passphrase・実署名Effectなしで反復可能なこと、正式署名入口が全非秘密条件を対話入力前に拒否すること、失敗時にmanifestまたはAuthorityを残さないこと、および一般利用者の経路が署名検証だけで成立することを契約試験へ接続する。
- renameでは、正本、import、package script、設定、試験、文書、AI入口および現在の移設先を同じ変更で更新する。
- 過去の固定履歴は書き換えず、旧Pathから現在Pathへの移行を後続の変更トレースへ記録する。
- rename後の最終状態へ、旧名または廃止済み入口を維持する互換shim、alias、wrapperまたは重複実装を残さない。単一のChecker公開Use Caseへ接続する`40_Develop/checker/bin/crdd-check.ts`と`template/tools/crdd-check.ts`は、実装を複製しない用途別launcherであり互換wrapperではない。

人間可読な説明ではローカル表示名を先に示すが、コード、filename、Schema key/value、contract IDおよび上表の機械値そのものは翻訳しない。

規則違反、利用側漏れ、分類不能または外部契約との競合を検出した場合は、例外名を足して通過させず、責務を特定して正本修正または移行へ戻す。
