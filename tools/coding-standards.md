# CRDD内部ツール・コーディング規約

Status: Candidate
Owner: Qual-Lab
Last Updated: 2026-08-17
Scope: `tools/**`と、CRDDが配布正本として所有し`tools/**`から参照する`template/tools/**`の実装

## 1. 目的と正本

本書は、CRDD公式Repositoryが所有する内部ツールの命名、TypeScript／Rust source、試験および機械検査に適用する単一正本である。「Qual Suite準拠」のような外部参照だけでは規則を完了させず、CRDDで適用する値を本書に固定する。

本書はQual Suite Commit `d7493e25f719bef6e46b8dbba7926f9a74e1165e`、Tree `62fa90f2020803609935a10944dcffe03484af34`の`06_Architecture/qual-insight/99_Coding_Standards.md`と`90_Release/qual-insight/Changes/CHG-000004_Implementation_Naming_Convention.md`を設計入力として使用した。今後のQual Suite側の変更を自動採用せず、CRDD側の変更トレースと人間の決定権限を通じて本書を更新する。

TypeScript／Rustの実行境界、Biome、型検査、Node.jsおよびRust toolchainは[CRDD標準の保守](../19_Maintenance.md#33-internal-typescript-runtime)を正本とする。旧名、互換層および移行の扱いは[本質的修正と互換層の境界](../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)を正本とする。

## 2. 適用境界

次へ適用する。

- `tools/**`のファイル名、フォルダ名およびTypeScript識別子（TypeScript identifier）
- `tools/platform-access/**`のRust識別子（Rust identifier）、Cargo設定および試験
- `tools/**`が所有する試験、パッケージスクリプト（package script）および設定
- CRDDが配布正本として所有し`tools/**`のprivate package entry adapterから参照する`template/tools/**`の実装ファイル名と識別子
- 新設または変更するCRDD所有の設定JSON key、IPC channel、activity event、DB名およびCSS class

次のmachine valueは、各契約が所有するため本書を理由に改名しない。

- 既存のChecker出力、Schema、protocol、CLI flag、環境変数、reason、statusおよび暗号domain
- 外部API、標準規格、Node.js APIまたは第三者packageが定める識別子
- 過去のCHG、Evidence、CHANGELOG、tagまたはReleaseに記録された当時のPathとcommand

これらを変更する場合は、命名整理ではなく各契約の破壊的変更として別に判断し、利用側と移行を追跡する。

## 3. ファイルとフォルダ

### 3.1. 基本形式

| 対象 | 必須形式 | 例 |
|---|---|---|
| フォルダ | ASCII `kebab-case` | `checker/`, `test-fixtures/` |
| TypeScriptファイル | ASCII `kebab-case` | `crdd-check.ts`, `fault-injector.ts` |
| Rust moduleファイル | ASCII `snake_case` | `protocol.rs`, `windows.rs` |
| Markdownファイル | ASCII `kebab-case` | `coding-standards.md`, `threat-model.md` |
| 通常のJSONファイル | ASCII `kebab-case` | `provider-profile.json` |
| 試験ファイル | `<subject>.<kind>.test.ts` | `crdd-check.contract.test.ts` |

大文字小文字の混在、`snake_case`、空白、意味を持たない連番および同じ責務に複数の区切り形式を混在させる命名は禁止する。

### 3.2. ecosystem予約名

次はNode.js、TypeScript、Rust、Cargo、Gitまたは一般的なRepository discoveryが固定する予約名であり、命名例外のallowlistではなく固有の文法として扱う。

- 任意のpackage rootにある`package.json`と`package-lock.json`
- TypeScript設定の`tsconfig.json`、`tsconfig.strict.json`、`tsconfig.tests.json`
- Rust crate rootの`Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`および`.gitignore`
- Rust executable入口の`src/main.rs`
- Git設定の`.gitignore`
- packageまたは主要成果物の入口にある`README.md`

上記以外の新しい予約名を推定しない。必要になった場合は、所有するecosystem、exact Pathおよび検出規則を本書へ追加してから使用する。

## 4. TypeScript識別子

| 対象 | 必須形式 | 例 |
|---|---|---|
| class / interface / type | `PascalCase` | `CheckerReport`, `RuntimeProfile` |
| enum相当の型名 | `PascalCase` | `RiskLevel` |
| 関数 / メソッド | `camelCase`の動詞句 | `resolveRepositoryRoot()` |
| 変数 / parameter / property | `camelCase`の責務名 | `repositoryRoot` |
| Booleanの変数 / parameter | `is` / `has` / `can` / `should`で始まる`camelCase` | `isReady`, `hasFindings` |
| Array / readonly Array | 内容を表す複数形 | `findings`, `candidatePaths` |
| 真の定数 | `UPPER_SNAKE_CASE` | `MAX_INPUT_BYTES` |

Boolean規則はBoolean型の変数とparameterへ適用する。`null`または`undefined`を除いたunionの全構成がBooleanまたはBoolean literalである場合もBooleanとして扱う。動作を表す関数は動詞句を使用し、Boolean predicateを値として公開する場合は同じprefixを使用する。object propertyはSchemaまたは公開結果契約の一部になり得るため、その所有契約が定める形式を優先する。

配列規則は`Array<T>`、`readonly T[]`、alias、型制約付きジェネリック（generic）およびnullable unionを含む同じ意味の可変／不変配列へ適用する。型parameterは制約を循環なしに解決し、制約のないジェネリックは一般の`camelCase` bindingとして扱う。固定位置に別の意味を持つtuple、`Buffer`、TypedArray、`Set`および`Map`は複数形規則の対象外だが、実際の責務が分かる名前を使用する。機械検査では末尾の`s`または不規則複数形`Children`、`Indices`、`Vertices`、`People`、`Media`、`Data`を複数形として扱う。destructuringではproperty名ではなくCRDD所有のlocal binding名を検査する。

真の定数とは、module scopeの`const`で共有し、実行中に概念上変化しないlimit、pattern、contract literal、固定policyまたは既定値である。機械分類はprimitive／regular expression／固定template、固定値だけの配列・object・二項式、固定値から作る`Set`、固定引数1件の`Object.freeze(...)`、`BigInt(...)`、`Symbol(...)`および限定した組込み要素（intrinsic）の参照に限定する。直接記述した配列・objectは、module-localかつ非exportで、要素が再帰的に固定され、全参照を分類でき、変更、alias、引数渡し、returnその他のescapeが一件もない場合だけ固定集約値（fixed aggregate）とする。固定集約値からのreadは、元のliteral構造へ各segmentを照合できるown data property、範囲内でholeのないcanonical非負整数index、および配列自身の終端`length`だけを許可する。中間segmentも同じ直接literalでなければならず、終端はnullishを含まないBoolean／string／number／bigintだけとする。利用文脈は、括弧、`as`、`satisfies`、non-null wrapper、代入ではない明示した二項readおよびテンプレート補間（template interpolation）を途中の式合成として最外利用先まで畳み、最終的に直接`void`参照または非export・非destructuring変数宣言の初期値（VariableDeclaration initializer）へ到達した場合だけ許可する。二項式またはテンプレート補間自体を終端許可にはしない。代入演算子、`++`／`--`、`delete`、引数渡し、`new`、return／yield、export、destructuring、暗黙return、tagged template、条件式、commaその他の未定義文脈は一般bindingへfail closedにする。`constructor`、`prototype`、`__proto__`、method、accessor、spread、重複key、dynamic key、範囲外index、aggregate自体の取出しおよび型または由来を分類できないreadも一般bindingへfail closedにする。`Object.freeze(...)`を固定集約値とする場合は、global `Object.freeze`のexact 1引数が再帰固定された直接配列／object literalである場合だけとする。分類不能な参照が一件でもあれば一般bindingとして扱う。同じCRDD所有のプロジェクト依存グラフ（project graph）のmodule定数を参照するときはシンボル（symbol）の宣言元とinitializerを循環なしに再評価し、単なる名前の一致や任意のimportを固定値とみなさない。`Date`、`Date.now`、`Date.prototype.toISOString`、TypedArrayの組込み`byteLength` getterおよび、固定algorithm・入力・出力encodingを持つ`createHash(...).update(...).digest(...)`の終端ダイジェスト（terminal digest）だけを固有の構文として認める。shadowされたglobal、`Date.parse`、`Date.prototype`単体、`createHash(...)`の生成handle、動的値を凍結したobject、Path、snapshot、`WeakMap`、decoderその他のresource handleまたは一時的な`const` bindingを大文字化しない。判定順は関数binding、真の定数、Boolean、Array、一般の変数とする。型または構文を分類できないCRDD所有宣言は成功扱いにせず、規約または実装へ戻す。

名前付き関数式（`named function expression`）と名前付きclass式（`named class expression`）も、それぞれ関数名と型名の規則へ含める。取得アクセサー（`get accessor`）と設定アクセサー（`set accessor`）は関数相当宣言（function-like declaration）として走査し、内部名のcaseと曖昧名を検査する。外部契約が所有するoverride名とobject／interface propertyは機械property境界を優先するが、設定アクセサーのparameterとbody内bindingは通常の識別子規則へ含める。

TypeScript `enum`構文はNode.js native type strippingの対象外なので導入しない。「enum相当」はliteral unionまたは凍結objectから導く型の表示名だけを指す。

## 4.1. Rust識別子

Rustは`tools/platform-access/**`のprivate crateだけへ適用する。module／file、function、method、variableおよびparameterは`snake_case`、struct、enum、traitおよび型は`PascalCase`、定数およびstaticは`SCREAMING_SNAKE_CASE`とする。FFIの`unsafe`はWindows API接続moduleへ限定し、各blockへ所有権、pointer lifetimeおよび解放責務の安全根拠を記載する。Rust標準の命名と型境界は`rustfmt`、rustcおよびClippyで検査し、TypeScript AST分類器へ混在させない。

`tools/platform-access/target/**`は生成物であり検査母集団とGit管理から除外する。`.rs`実体は同crateの`src/**`へ限定し、`Cargo.lock`を追跡する。`.bat`、`.cmd`、`.ps1`、`.sh`その他のShell ScriptをOS権限判定またはbuild orchestrationとして`tools/**`へ追加しない。

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
- Rust sourceは固定toolchainの`rustfmt --check`、rustc、Clippy Warning拒否および`cargo test --locked`で検査する。
- CheckerとCoordinatorのprivate packageが所有する`lint`は、Repository rootのBiome設定を`--error-on-warnings`付きで実行し、Warningが1件以上ある場合は各packageの`check`を失敗させる。Infoはこの継続Gateの失敗条件ではなく、固定版ごとの検証結果として区別する。
- Checker packageの命名contract testは、ファイル／フォルダの検査母集団を`tools/**`と`template/tools/**`の全Pathとし、未知のsubfolderまたは後続packageも同じ規則へ含める。型付き識別子の検査母集団は固定TypeScript 7.0.2で`tools/checker/tsconfig.json`、`tools/coordinator/tsconfig.strict.json`および`tools/coordinator/tsconfig.tests.json`から得たCRDD所有sourceとする。実Pathで重複を除いたproject source集合と両Path配下のTypeScript実ファイル集合を完全一致させ、未所属source、project外実体、symbolic link、取得不能または未分類構文を成功扱いにしない。Rust sourceは`tools/platform-access/src/**`の閉集合として別に数え、TypeScript projectへ算入しない。型から完全判定できない動詞句、責務名および自然言語上の妥当性は独立reviewで確認し、機械検査だけを規約全体の完全証明としない。
- 型検査、Lint、Formatter、Coordinator試験、Checker試験およびRepository全体Checkerを別の合否軸として維持する。
- renameでは、正本、import、package script、設定、試験、文書、AI入口および現在の移設先を同じ変更で更新する。
- 過去の固定履歴は書き換えず、旧Pathから現在Pathへの移行を後続の変更トレースへ記録する。
- rename後の最終状態へ、旧名または廃止済み入口を維持する互換shim、alias、wrapperまたは重複実装を残さない。単一の配布正本へ委譲しpackage責務を分離する`tools/checker/crdd-check.ts`のentry adapterは互換wrapperではない。

人間可読な説明ではローカル表示名を先に示すが、コード、filename、Schema key/value、contract IDおよび上表の機械値そのものは翻訳しない。

規則違反、利用側漏れ、分類不能または外部契約との競合を検出した場合は、例外名を足して通過させず、責務を特定して正本修正または移行へ戻す。
