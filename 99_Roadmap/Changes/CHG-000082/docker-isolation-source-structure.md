# Docker Isolationの構造再編と追加通信先設定

成果物種別: 変更計画
状態: In Progress — Source・固定資産の配置とImage情報縮小を実装、追加Allowlistは本番未接続
対象変更: [CHG-000082](change.md)
基準改訂版: `3583a62d9`
最終更新日: 2026-10-21

## 1. 結論と変更境界

Docker IsolationはDockerの隔離、通信制限、Processの終了、所有資源の回収を所有する。Repository設定の正本・読取りをDomain Model、既存の認可・外部送信同意との結合と実行時注入をCoordinatorへ分ける。

人間が提示したNetwork Allowlist設計案を起点とし、今回の追加合意を優先する。添付案の「設定SchemaもDocker Isolationへ集約」は、設定値の契約をDomain Model、Docker技術条件と実効集合の構成をDocker Isolationとする分担へ見直す。設定ファイルをDIが探索する構造にはしない。

| 区分 | 今回の扱い |
|---|---|
| 変更分類 | Source構造・内部APIの再編と、Repository内の編集・助言・レビューに共通適用する追加通信先機能。通信範囲の変更を単なる改名と扱わない |
| 対象 | Docker Isolation全Source、CoordinatorのEgress技術残存、Domainの設定読取り、既存同意を利用するCLI／Workbench、本番Consumer、Architecture／Quality／Symbol／Catalog／ひな型 |
| 保持 | Provider別固定Host、443 CONNECT、Proxy認証、公開DNS確認と検証済みIP接続、制限時間・容量、隔離Mount、取消・一次失敗・回収結果、同じ回復参照 |
| 対象外 | 新Proxy製品、TLS本文検査、Secret Manager、自動Host学習、動的Mount承認、独自Registry／State／Lock／Recovery、Docker再起動・修復、保持中②の削除、外部AI再試行 |
| 書込み範囲 | 現Repositoryのみ。実Docker・外部通信は別途、具体的な試験対象と許可範囲を確認する |
| 完成表示 | 配置・通常回帰と、通信制限を強制する新Image・実境界成立を分ける。有限代役だけで全体完成にしない |

着手前整合確認は親と読み取り専用の設計・品質確認者で実施した。主要な反証は、未Commit設定の無確認適用、古い送信同意の流用、設定生成だけを変更した際の固定argv読戻し不一致、Proxy Sourceだけを変更した際の旧Image利用である。結果を本計画へ統合した。

実装後は契約・安全境界と構造・直接伝播の独立レビューを実施し、必要な文書・影響監査を固定候補へ適用する。準拠基準・決定権限・Releaseを変更する計画ではないため、現段階で準拠監査やRelease監査を発火しない。実装中に境界が変われば再評価する。

## 2. 設定の所有と未Commit変更

設定先は対象Repositoryの`.crdd/config/network-policy.json`とする。

追加AllowlistはそのRepositoryだけに閉じ、別Repositoryへの共有・継承・自動合成を行わない。Provider Homeを複数Repositoryで共有しても、追加Allowlistや同意をその共有単位へ昇格しない。上位は選択したRepositoryと操作へ設定を結合し、別Repositoryの結果を再利用しない。

```json
{
  "version": 1,
  "allowedHosts": [
    "registry.npmjs.org",
    "pypi.org",
    "files.pythonhosted.org"
  ]
}
```

| 所有者 | 所有する処理 | 所有しない処理 |
|---|---|---|
| Domain Model | 値Schema・固定相対Path・既定値・安定読取り・不変の設定結果。不在／空／不正／観測不能の区別 | Docker、Proxy、DNS、安全な実行の許可 |
| Coordinator | 同じRepository・操作・設定結果を既存認可と送信確認へ結合し、確認済み値をDIへ注入 | Hostname技術判定、任意argv生成、独自Network Store |
| Docker Isolation | Provider固定集合、追加集合の技術検査・合成、実効設定Hash、Docker包装・Proxy起動・回収 | Repository探索、設定の変更採用、人間同意の発行 |
| Egress Proxy | 固定入力の再検査、認証、完全一致Hostと443 CONNECT、DNSと実接続の強制 | 実行中の設定再読取り、Host自動追加、許可本文の検査 |

人間は「Commitされた設定だけを使う」案を不採用とし、未Commit設定も利用することを希望した。Domainは検証済みRepository Rootの現在ファイルを一回だけ安定読取りし、その不変値を当該RepositoryのAI実行へ固定する。Git Commitは有効化の条件にしない。Providerへのログイン処理ではこの設定を読まない。

設定の読取り・形式検査成功は、その通信先の利用許可ではない。DIが構成した実効通信条件のHashを既存の外部送信同意境界へ含める。人間にはHashだけでなく追加Host一覧を示し、確認した値と実行値を一致させる。新しい確認台帳や承認専用API群は作らない。

- 空白・順序だけの変更と通信範囲の変更を区別する。生File Hashは由来確認用とし、実効集合のHashと混同しない。
- Domainの設定Snapshotは一回固定し、DIがProvider・用途ごとの実効Policyを一回構成する。追加集合は全役割共通だが、Provider固定集合・用途Identityは統合しない。Coordinatorは再計算せず、その同じ不変値とHashを表示・同意・要求・当該実行へ渡す。
- 実効HashはPolicy版、Provider、適用用途、整列した実効Host集合、443／CONNECT等の意味へ結合する。
- 同じ実効集合なら既定値／明示設定の違いだけで新たな通信許可と扱わない。
- 異なる集合へ以前の同意を流用しない。A→B→Aは既存同意の有効期限・取消・同境界一致条件へ従い、なお有効な同Aへの確認は再利用できる。新たなlast-seen管理は作らない。
- 確認後にFileが変わっても現在Taskは確認済みSnapshotだけを使う。次Taskで新たに読み、既存同意境界と照合する。
- Workbenchは確認のbooleanだけを送らず、表示した集合Hashを既存要求へ結合する。Serverの採用値と違えば発行0で再確認する。
- `.crdd`へのProvider書込み禁止は維持する。Domainが保存責務を所有することを、新しいWriter APIの実装要求へ拡張しない。この単位では人間によるJSON編集とHost側読取りで成立させる。

## 3. 適用条件と未確定事項

| 入力・場面 | 予定処置 |
|---|---|
| 設定の明示不存在 | 既定3Hostを不変値にし、既存送信確認の対象へ含める |
| `allowedHosts: []` | 正常。開発用追加Hostは0、Provider固定Hostだけ |
| 不正JSON・未対応版・不正Host | 既定値へ戻さず実行前に停止し、理由を返す |
| 読取り不能・Root不正・link・読取り中置換 | 不在へ畳まず停止。追加許可やDocker発行0 |
| 正常設定だが同意不一致・拒否・取消 | Provider／Networkを発行しない |
| 実行中の設定変更 | 現在実行へ反映0。次回実行の入力として再評価 |
| 許可外Host・HTTP・IP直接指定・wildcard | 拒否。実試験で見つかった追加Hostを自動許可しない |

人間は「追加の許可リストは役割によって分けずに適用する」と確定し、その範囲をRepository内のAI実行と明確化した。追加の開発用Hostは編集・助言・レビューへ共通適用し、役割別Allowlistは作らない。Provider固定集合はProvider別を維持する。追加設定に他ProviderのHostが明示された場合は、人間が確認した追加許可であり、固定集合の自動共有とは区別する。Direct／Isolated（独立Worktree）の違いで通信条件は分けない。Candidateは採用対象として固定した成果物であり、実行形態と混同しない。

Providerへのログイン・再ログインはProvider固定の通信先だけを使い、Repositoryの追加Allowlistを適用しない。これはAI実行の役割別制限ではなく、ログインとRepository内AI実行の用途境界である。認証コマンドへのRepository指定、Network設定の読取り、新しい同意やTask Grant接続は追加しない。先行案の対話認証への共通適用と`--repository`追加案は、この人間判断により取り下げた。既存のRepository非mount・Provider Home限定・対話手順・回収を維持する。

Hostnameの長さ・件数・総byte数には有限上限を設ける。ASCIIのDNS名だけを対象とし、URL・port・path・IP literal・末尾dot・wildcard・Unicodeは受理しない。大小文字の正規化、重複の受理／拒否、上限値は現行の引数・Proxy制限から実装前に導出し、TSとPythonの同じ入力母集団で一致を検証する。名称だけを理由に`resolve`／`policy`／`validation`を分割しない。

許可HostへのHTTPS本文・Packageの安全性・Install Scriptの無害化は保証しない。npm／PyPIを許可することは、その宛先へのデータ送信も可能にする。開発用資格だけを利用し、本番Secretを持ち込まない既存方針を維持する。

## 4. 全SourceのBefore／After候補

以下の既存DI Source32件の移動とRoot入口1件の参照追従、UT6件の責務別配置を実施した。Network技術残存の分配と新機能は未着手。File数削減そのものを目的にせず、所有状態・依存・変更理由を維持する。共通型は実共有がある場合だけ`types.ts`へ分離する。

| 現在の`src/`相対Path | 移管先候補 | 主な責務・分割判断 |
|---|---|---|
| `index.ts` | 維持 | 宣言済みAPIだけの明示公開。不要な試験専用公開を評価 |
| `execution/command-plan.ts` | `execution/plan.ts` | 本実行の固定Docker計画。Proxy包装は実効Policyと結合する既存構築処理として評価 |
| `execution/command-runtime.ts` | `execution/execute.ts` | 元計画・要求・実ID・清掃の相関。単なる中継は増やさない |
| `execution/command-session.ts` | `execution/session.ts` | 一回のProcess・取消・待機・通知・終了 |
| `execution/command-result.ts` | `execution/result.ts` | Process結果と一次失敗・Signalの型付き変換 |
| `execution/authentication-command-plan.ts` | `authentication/plan.ts` | 認証用隔離・stdio計画。認証許可を持たない |
| `execution/authentication-command-runtime.ts` | `authentication/execute.ts` | 同じ認証計画の実行と子Process終端 |
| `execution/probe-command.ts` | `probe/plan.ts` | 診断用途の固定command構築・実行。単なるargvラッパーの重複を評価 |
| `execution/probe-configuration.ts` | `probe/configuration.ts` | 診断Containerの構成照合 |
| `execution/probe-container.ts` | `probe/container.ts` | 実IDの観測・不存在・回収 |
| `execution/probe-result.ts` | `probe/result.ts` | 診断結果・取消・作成・不存在の変換 |
| `execution/probe-runtime.ts` | `probe/execute.ts` | 固定payload・期限・診断実行。上位Scenarioは引き取らない |
| `execution/attached-process.ts` | `probe/process.ts` | 診断用attachと取消。試験専用fixtureの本番公開を評価 |
| `execution/cli-config.ts` | `docker-cli/config.ts` | 空Docker CLI configの実体・作成・回収 |
| `execution/cli-environment.ts` | `docker-cli/environment.ts` | Docker用の最小環境。一般OS値はPAから取得 |
| `execution/cli-trust.ts` | `docker-cli/trust.ts` | 固定Docker CLIの信頼Snapshot・実体の観測・再照合。実行許可を発行しない |
| `execution/owned-windows-process.ts` | `process/start.ts` | Docker CLI子・stdio・終了補助子の所有。Windows固有部分のPAとの境界を確認 |
| `execution/process-environment.ts` | `process/environment.ts` | getter等を評価しないProcess環境のSnapshot |
| `execution/provider-assets.ts` | `image/assets.ts` | 固定Provider／Proxy Image・配置・Hash。過去実測を現在保証にしない |
| `cleanup/container-init-observation.ts` | `cleanup/init.ts` | Init省略・不正・必須条件の意味 |
| `cleanup/resource-configuration.ts` | `cleanup/plan.ts` | 通常清掃と再入場で同じ資源構成・予定処置を生成・照合 |
| `cleanup/resource-recovery.ts` | `cleanup/resource.ts` | 現在観測・構成照合・同実ID削除・不存在再観測 |
| `cleanup/recovery-executor.ts` | `cleanup/execute.ts` | CLI実体・最小環境と閉じた回収操作の接続 |
| `desktop/backend-state.ts` | `docker-desktop/backend.ts` | Windows／WSL backendの観測と限定停止 |
| `desktop/engine-state.ts` | `docker-desktop/engine.ts` | Engine応答・起動待ち・観測不能 |
| `desktop/runtime-directory.ts` | `docker-desktop/directory.ts` | 固定Runtime領域の実体・列挙・退避・非使用観測 |
| `desktop/repair-checkpoint.ts` | `docker-desktop/repair-state.ts` | 修復と退避処置のcheckpoint・遷移。不明を成功にしない |
| `desktop/repair-directory-disposal.ts` | `docker-desktop/dispose.ts` | 退避領域の限定回収と不存在確認 |
| `desktop/repair-operations.ts` | `docker-desktop/repair-operations.ts` | PA技術操作・前提・発行・観測の接続 |
| `desktop/repair-machine.ts` | `docker-desktop/repair.ts` | 意図保存・許可・処置順と中断の制御 |
| `desktop/repair-runtime.ts` | `docker-desktop/repair-session.ts` | 公開修復Session・取消join・終了後の同Scope回収 |
| `desktop/restart-machine.ts` | `docker-desktop/restart-state.ts` | 再起動の状態・要求・観測の順序 |
| `desktop/restart-runtime.ts` | `docker-desktop/restart.ts` | 再起動の公開操作・PA補助資源・checkpoint接続 |
| Coordinatorの`external-send/egress-proxy-policy.ts` | DI `network/policy.ts`、`image/assets.ts`と試験側へ分配 | Profile検査との結合を丸移動しない。Fixture用CIDR／CONNECT評価と過去検証定数を本番APIへ昇格しない |

```text
docker-isolation/
├ src/
│  ├ index.ts
│  ├ execution/       本実行の計画・実行・Session・結果
│  ├ authentication/  認証用隔離の計画・実行
│  ├ probe/           診断用ContainerとProcessの操作
│  ├ docker-cli/      Docker実行物・設定・最小環境
│  ├ process/         所有子Processの開始・搬送・終端
│  ├ image/           固定Image・実行位置・資産Identity
│  ├ network/         実効通信条件の純粋処理・Proxy本文。本番入力結合は後続
│  ├ cleanup/         所有資源の構成・回収・不存在確認
│  └ docker-desktop/  Desktop／Engine観測と既存修復・再起動
├ images/             Dockerfile四件・収録済み取得Build入力の期待値
└ tests/              Source責務へ追従。実試験と通常試験の境界を維持
```

旧`runtime/`は廃止し、Dockerfile四件は`images/`、内部固定Seccompは`src/execution/codex-executor-seccomp.json`、Proxy本文は`src/network/provider-egress-proxy.py`へ移す。AI Adapterの固定設定二件は`src/claude/`、内部結果Schema三件は`src/codex/`へ移し、利用者向け`.crdd/config/`と区別する。11資産は移動前後のraw byte SHA-256一致を確認し、COPY basename・mode・Container内Pathと現行Digestを変更しない。Build contextはレシピ所在と分け、既存助言準備Scriptの三入力搬送を確認する。他三Imageの実Build準備・実Build・新Image成立は今回未確認とする。PythonをTypeScriptへ書き換えない。

Domain側は`configuration/network-policy.ts`へ値契約・解析・既定値、`storage/network-policy.ts`へ実読取りを置く候補とする。保存形式と実効通信の検査を二重定義せず、転送だけのCRUD Fileを追加しない。後続のDomain全体構造精査を先取りしない。

`bin/`は現状存在せず、独立CLI要求がないため新設しない。製品公開入口は`src/index.ts`だけを維持する。

## 5. 公開APIと利用側の処置

| API群・現在の利用側 | 予定処置 |
|---|---|
| 本実行のplan／runtime／session／resultと型 | 新責務Fileへ配置。型付き結果・一次失敗・cleanupの相関を維持。候補名だけを公開APIへ増やさない |
| 認証planとFactory | 認証Folderへ移し、Provider固定集合だけを維持。Repository追加集合・Task Grantを渡さない |
| Probe作成・観測・取消・回収 | 診断の実Consumerへ照合。試験専用factory・fixtureは試験側へ移し、必要性のないRoot公開を撤去 |
| Desktop観測・修復・再起動・checkpoint | 既存の許可・保存・PA接続を維持。File改名のために新Stateを作らない |
| CLI実体・環境・資源回収 | 実利用側が必要なAPIだけ公開。raw commandを汎用公開しない |
| 新Network設定 | Domainの型付き設定読取りとDIの純粋な実効Policy構成を最小公開。具体名・全export集合は実装前にArchitecture API表へ確定 |
| Coordinator本番 | `provider/execution-plan.ts`、`provider/isolation-execution.ts`、Claude認証、`diagnostics/doctor.ts`を移管先へ接続。認可・Task・Profileの意味は維持 |
| 既存同意 | `external-send/policy.ts`、`consent-store.ts`、`consent-record.ts`、`grant.ts`の境界生成・expectedBoundary照合・確認・保存・再利用・Grant消費を同じ実効Policyへ結合 |
| Workbench | 画面の許可先表示→既存要求→Server照合→実行のHash相関。boolean確認だけでは成立としない |
| 対話再認証 | `cli/launch.ts`、`scripts/authenticate-claude-subscription.ts`、`provider/claude-subscription-authentication.ts`の既存入力・手順を維持。DI技術参照の配置追従だけを行い、Repository指定や追加Allowlistを導入しない |
| Tool・台帳・検査 | Symbol、Catalog、Source Header、公開API許可集合、deep import検査、coverageとSource Path参照を追従 |

既存Egress Moduleの公開5関数には本番利用とFixture評価が混在する。`describeEgressProxyTopology`の本番記述はDIへ移す。`compileEgressProxyPolicyCandidate`、`evaluateProxyConnectForFixture`、`evaluateResolvedAddressesForFixture`、`describeSpecialPurposeRegistrySnapshot`は既知Consumerを再照合し、試験専用のものを`tests/support/`へ配置する。Pythonの実強制とTSの模擬評価を同一の検証根拠と扱わない。

## 6. 実施順序と検証

1. 本対応表とAfterを確認し、Architecture／Qualityへ保持保証・Repository内AI実行の全役割共通設定・同意境界と、ログインのProvider固定通信を具体化する。
2. Network以外のSource配置・名前・Header・公開API・Consumer・試験を移管し、既存通常回帰を通す。
3. Domainの現在設定読取り、Coordinatorの同意結合、DIの実効値・Proxy包装を一つの入力搬送として接続する。
4. Proxyの起動入力・技術拒否・Source Hashを更新し、旧定数・試験専用本番API・旧参照を撤去する。
5. 通常回帰、独立レビュー、直接文書・QA接続を確認する。
6. 固定Imageの準備と限定実通信試験の許可を得て、npm／pipの実取得、未許可・直接通信の拒否、取消・回収を確認する。新Imageと本番利用側を接続してから通信能力の完成を判定する。

| 検証面 | 必要な確認 |
|---|---|
| Domain設定 | 不存在／空／不正／過大／読不能／link／同容量差替え／読取り後変更、Root外へEffectなし |
| 同意 | 同じ集合、未承認の別集合、空白・順序、既定／明示同値、A→B→A、確認拒否・取消・保存失敗、古い画面Hashで発行0 |
| TS・Python | Host入力母集団、Provider間分離、固定443、IP・wildcard拒否、有限上限、起動時不正拒否 |
| 適用範囲 | Repository Aの追加集合がBへ混入しない。編集・助言・レビューは同じ追加集合を使用し、ログインはProvider固定集合だけ。共有Provider Homeを設定共有の根拠にしない |
| 固定包装 | 生成→読戻しの一致、余分なenv・重複・差替えの拒否、argv個数・文字列長・総byte上限の導出 |
| 実行lifecycle | 要求前拒否・部分作成・結果不明・取消・遅延通知・同実ID清掃・不存在と観測不能・一次失敗の保持 |
| 実通信 | 固定Image、内部Network・Proxy二Network、npm install／pip install、HTTP／未許可Host／IP／private DNS拒否。Host側でSnapshot後にFileを変更しても現在権限が変わらないこと |
| Provider書込み保護 | Providerと同じ隔離条件から設定Fileへのwrite／rename／unlinkを試み、拒否とHost byte不変を直接観測。Host側編集の試験と混同しない |
| 配布・根拠 | Proxy Source・Dockerfile・固定Image digest・本番計画・診断・清掃期待値の相関。過去Evidenceは不変更 |

Proxy引数は現在22要素・二envの固定順である。追加入力に合わせ、生成だけでなく投影・診断上限・認証plan・清掃期待値・保存済み計画の検査も同期する。上位へ任意envや任意Proxy commandを公開しない。

新Proxy Sourceは現Imageには入っていない。固定digest・Source Hash・診断の過去実測定数を機械更新して検証済みと表示しない。実Image作成・実通信は現在未承認／未実施であり、失敗時に新Recovery機構を追加せず、原因と既存回収可能範囲を返す。

## 7. Image同一性とBuild情報の分離

2026-10-21の人間の方針に従い、通常実行の主要な同一性確認は固定Image Digestとする。公式配布物の取得・Build時の出所、署名・完全性検証を撤廃する変更ではない。AI AdapterはProviderの実行仕様、Docker IsolationはImage内容・配置・Docker起動を所有し、同じ版・Hashを双方で独立した正本にしない。

| 段階 | 所有する確認と情報 | 通常実行への持込み |
|---|---|---|
| 取得・Build | 公式取得元、Archive／Binary、Sigstore等の署名・完全性、Build入力とその検証 | 取得・Buildの入力・手順へ分離。専用Registryや新しい署名Frameworkは作らない |
| Image作成・Release | 検証済み入力から作成したImageと固定Digestの対応 | Docker Isolationの現在Image定義を単一正本とする。値の複製でなく同じ定義を参照 |
| 通常AI実行 | 現在許可された固定Imageの指定、実IDとの照合、暗黙Pull・自動更新の禁止、Mount／Network等の実構成 | 内包Binary・Schema等の個別Hash検査をImage確認と重複して要求しない。禁止をbooleanの宣言だけで成立としない |
| Hostからの外部入力 | Image外から渡すSeccomp、Mountされた設定、Repository追加通信先等 | Image Digestでは保護されない。入力ごとの既存検査・固定Snapshot・同意の相関を維持 |

### 現行利用側の初回確認と処置

着手前の`src/image/assets.ts`は、旧`provider-assets.ts`を移動しただけで、Archive・Sigstore・Schema等のHashを含んでいた。現在は取得・Build入力の期待値を`images/build-inputs.json`へ分離し、実行用APIはImage・版・配置と外部Seccomp照合材料へ縮小した。同JSONは収録済み固定入力であり、完全なBuild manifestや検証実行結果ではない。既存の資産・実Image観測試験は期待値を削らずBuild入力へ接続する。配置・APIの回帰と独立レビューが終わるまで完了とはしない。

| 現行箇所 | 確認した役割 | 予定処置 |
|---|---|---|
| `image/assets.ts` | Image／実行位置と取得・Build用Hashを同じ戻り値へ格納。Codexの現行実行Image Digestを内外で重複定義 | Build用情報と小さな実行時Image記述を分離し、現行Digestの重複を除去。公開APIと利用側も追従 |
| Coordinator `provider/execution-plan.ts`、`provider/isolation-execution.ts` | Image選択と実行直前照合、Seccomp Hash／容量の受渡し | Providerの意味は維持し、Docker固有の検査材料はDI内部へ閉じる。新しいtoken・管理層を追加しない |
| Coordinator `workbench-ai/advice-execution-plan.ts`、Claude認証 | 用途に応じた固定Image Digestの取得 | 単一Image定義を参照。助言／編集等で異なる実Imageまで同一化しない |
| DI `execution/plan.ts` | Host Seccomp実物の容量・実体・Hash確認、`--security-opt=seccomp=...`指定 | Image内にないため検査を維持。単なるDigest化を理由に削除しない |
| DI `execution/plan.ts`の助言init条件 | 現行・旧回復対象ImageのDigestを直接比較 | 現行定義の重複と、旧exact Recoveryを識別する履歴値を区別。保持中の回復参照・旧構成を壊さない |
| DI execution／authentication／probeのplan | `--pull=never`を生成 | 生成・実行直前の照合・終了後観測までの利用側と負例を確認し、暗黙Pullを許さない |

実施前に全fieldを取得・Build／Image固定／通常実行／診断・試験へ対応付け、未対応の保証を残したまま削除しない。特にImage IDとRegistry manifest digestを同じ形式名だけで同一視せず、現行のinspectと起動参照が扱うIdentityを確認する。Digestは内容の同一性の確認であり、それだけで取得元の真正性や、外部Mount・実行時入力の正しさを証明しない。

本単位はAllowlistの新Image準備と整合させて実施する。Source／API・本番Consumer・Build入口・試験を追従させ、固定Imageの限定検証が必要な時点で対象と許可を示す。現時点でImage取得・Build・Docker操作・外部AI再試行・保持物削除は追加実行しない。Architecture／Qualityへの確定反映と独立レビューを経るまで、縮小を実装済み・検証済みと表示しない。

## 8. 基準版で確認した状態

2026-10-20、基準Commit `3583a62d9`でDIの`npm test`を実行し、format／typecheck／warning禁止Lintと通常293件が成功、明示Docker試験1件はskipだった。所要19.6262964秒、失敗・取消0。既存Lint Info1件とNode型除去の実験的警告を確認した。これは追加通信機能の検証結果ではない。

基準のCapability・過去結果は[DI詳細設計](../../../06_Architecture/Details/docker-isolation/01_Architecture.md)と[第二段階計画](second-stage-plan.md)へ接続する。旧実境界結果は当時のImage・構成の根拠として維持し、新方式のnpm／PyPI通信成功へ流用しない。ログ書庫・新しい運用状態は作らない。

## 9. 初回の配置・参照追従

基準`3583a62d9`からDI32 SourceとUT6を移動し、Root export、DI内部・fixture／IT、Coordinatorの本番・IT／ST、DomainのCatalog選択、Checker公開module集合、Symbol／Catalogと現行Architectureを追従した。Root公開117項目の名前集合は不変。importと構成Path追従を除いた32 Sourceの型除去後本文は基準と一致し、固定`runtime/`6資産はGit差分なし。実行物RootとSeccompの`import.meta.url`参照は同じ所在を指す。

初回回帰は参照書換えが通常の`.`文字列に触れた不具合と、試験の旧import除去正規表現を検出した。基準本文へ戻して参照だけを是正し、拒否条件・Case・Oracleは弱めていない。最終DI通常293件成功・明示Docker1件未実行、全体format／type／warning禁止Lint成功（既存Info62）、Header／Root公開／QA接続3件成功、Catalog378件valid。台帳・保存Consumer・上位再起動接続の初回44件のうち1件は他Package試験を誤ったcwdで実行したため不合格となり、その試験を所有Packageから再実行した。通常範囲を明示して再実行した上位関連87件は全成功。

横断の構造検査2件は成功した。全Sourceの命名検査は基準HEADにも存在するPAの`src/docker-desktop/helper.ts`を最初の拒否として不合格となり、それ以降の全件成立は未確認である。今回のDI配置を理由にPAへ追加改名や例外を広げず、規則を維持して既存不合格を残す。

Domainの台帳・保存Consumerを所有Packageから再実行して29件成功した。契約・配置と品質の限定独立レビューは、AI Adapter現行設計の旧Path2件と現在投影を是正後、両観点とも残指摘0。今回閉じるのは配置・参照追従の単位だけであり、後述の未知残存の回収・新Allowlist・全体QAは未完了を維持する。

### 試験選択の逸脱と保持

上位の試験選択で、明示実行を要するWindows／Docker試験を除外せず実行した。これは今回の配置単位の許可範囲外であり、失敗をSourceの回帰成功へ換算しない。外部AI依頼・認証・再起動は行っていないが、Container作成要求の結果不明を記録したため、実資源なしとは表示しない。

今回生成した`.crdd/tests/docker-isolation-host-Eeblb1/`と`.crdd/tests/claude-authentication-record-peeH0E/`を保持する。前者は`resources.json`／`cleanup.json`に元Identity・Receipt・回収観測、後者は既存Recovery記録に元資源名と`in_flight`を保持する。既存の保持中②とは別であり、いずれも削除していない。

人間から今回候補だけの読取り確認を承認され、固定・前後検証済みDocker CLIと既存最小環境で`crdd-auth-60dc704cb462f0ee`／`crdd-auth-6292799e4ba1a99e`をexact name filterで照会した。双方終了値1、ID取得不能のため不存在は未確認。追加作成・起動・削除・再起動・再試行は行わず、同じ参照と試験記録を保持する。専用Recovery機構は追加しない。

以後の配置回帰は、既存の`--experimental-test-module-mocks`と明示除外`^(Host Windows:|Windows Process Gate:|Docker explicit:)`を適用し、通常回帰と実境界を混在させない。局所Sourceの配置確認と、今回の未確定残存・新Allowlist実境界の成立は別に追跡する。

## 10. 固定データ配置・Image情報縮小の確認 — 2026-10-21

11資産を本文再保存なしで移動し、各raw byte SHA-256の完全一致と旧Path不存在を確認した。6件のJSONはparse成功。旧Assetの全62fieldを実行定義またはBuild入力へ対応付け、値は既知のPath移動以外不変更。取得Hashを確認する試験と助言Image準備ScriptはBuild入力へ接続し、実行APIからArchive／Binary／Sigstore Hashを返さない。現行助言Imageのinit判定は単一定義を参照し、旧回復対象Digestは保持した。

全体format／型検査／warning禁止Lintと既存二Traceability検査、AI Adapter静的検査が成功した。通常回帰はDI293成功・明示Docker1未実行、AI Adapter35成功、上位の資産・計画・助言・実Image観測Oracle関連50成功。AI Adapter初回はsandbox内で試験用link作成等が拒否され3不合格だったが、同じ試験を必要なFilesystem権限で再実行して35成功。実Docker・外部AI・保持物削除は行っていない。

Header／Root API／責務階層の3検査は通常環境で成功。Path分類の試験用link作成はsandboxで拒否されたため、Repository-local試験Rootと必要権限で確認し成功した。同じローカルTMP指定でHeader検査まで一括再実行すると、既存fixtureのRepository境界前提が変わり1不合格となったため、この一括結果を全成功とはしない。Headerは元の環境の成功、Path分類は用途限定環境の成功を別に扱う。全命名検査の既存PA指摘は未解消である。

現行Source・Architecture・Registry・Workflow・templateに対する旧資産Pathの検索は0件。過去Evidenceと保持中の回復参照は検索置換対象外とした。設計・品質の独立レビューは全結果を統合し、本文HashとSource集合観測の区別、実行定義とBuild入力のOwner説明2箇所を最小訂正して、双方残指摘0を確認した。追加Allowlist接続は後続であり、今回の通常成功を全Imageの実Build・実通信・未確定残存の回収成立へ拡張しない。

## 11. 設定Reader・実効値の純粋構成 — 2026-10-21

Domain公開APIに`readNetworkPolicy`／`NetworkPolicy`／`NetworkPolicyReadResult`、DI公開APIに`prepareDockerNetworkPolicy`／`DockerNetworkPolicy`／`DockerNetworkPolicyResult`を追加した。値のJSON文法・既定値はDomain、固定Pathの有界読取りはDomain storage、Provider固定集合と技術Host条件・実効HashはDIが所有する。新Writer・Lock・Registry・Recoveryは追加していない。

Repository設定と配布例を`.crdd/config/network-policy.json`／`template/.crdd/config/network-policy.example.json`へ用意し、非秘密設定だけGit追跡の明示allowlistへ追加した。未Commitの現在値を読む契約であり、File Hashを実行許可や同意Hashと同一視しない。Readerは最大16KiB・32要素・各253文字、DIはASCII・label63文字・443 CONNECTへ制限する。Unicodeを小文字化してASCIIへ補正する抜けを、正規化前のASCII確認と反例`K.example`で塞いだ。

追加UT3件、IT4件と既存の公開API・保存Consumer・試験台帳を接続した。Domain全253成功、DI全296成功・明示Docker1未実行。設定Readerの実hardlink作成はsandboxで拒否されたため、必要権限で再実行して拒否条件を確認した。公開型2件の期待集合追従漏れは検出・是正済み。台帳380件valid、Header／Root公開／責務階層3件と全体format／型／warning禁止Lintが成功した。配布例追加後は局所Reader4件も再確認した。

独立レビューは、標準IP判定だけでは短縮・整数・16進・8進表記をDNS名として受理する1原因を検出した。標準URL parserを検査だけに使用し、hostnameが入力から変わる場合・IPになる場合・解析失敗は既存blockedへ閉じる最小是正を両観点で整合した。負例6形式と数字を含む通常DNS名2形式を追加し、静的・UT3件・DI全296成功（明示Docker1未実行）を再確認。設計・品質の再レビューは双方残指摘0である。独自IP parser・DNS照会・新管理機構は追加していない。

この固定単位は読取りと純粋構成だけの完了である。Coordinatorの同意生成・再利用・Grant、Workbenchの表示Hash、本番plan・診断・cleanup期待値、Python Proxyと固定Imageは未接続。ログインへ追加Hostは渡さず、新通信の実Build・実通信・実AI成立を主張しない。

## 12. 本番接続と限定通信試験の準備 — 2026-10-21

先行単位の未接続部分を実装中。現在設定を一回読み取り、Provider別の凍結した実効値を既存Policy記録・同意・Grant・Task Packet・実行計画へ渡す。既存同意の境界Hashを更新し、旧通信条件の同意を流用しない。Workbenchは許可HostとHashを示し、開始時の再照合で変化を拒否する。ログインは固定Provider通信のまま、Repository設定を読まない。

独立レビューで3点を検出し最小是正した。Provider／実効Hash変更で確認checkboxだけを作り直し、依頼本文は保持する。共有表示では設定読取り直前に既存の現在認可集合を再照合し、応答前照合も維持する。助言Grantの説明・公開Scopeを実装の通信Hashへ同期した。先行await内で資格を失効させる実HTTP反例は403、設定Fileのopen 0、新しい開始0を確認。助言局所7件とWorkbench型検査、Orchestrator通常単体66件が成功した。UIの実DOM動作、全回帰、再レビューは別途確認する。

開始時のHash不一致はProvider／Docker Effect前に拒否するが、既存のOperation／Workspace準備までFile Effect 0とは主張しない。この表現訂正に新しい承認基盤や管理状態を追加しない。

限定実通信は利用者承認済み。固定PythonからPullなし・Build通信なしで新Proxyを作成し、公式Node 24 LTSを一度取得・Digest固定する。合成内容だけでnpm `is-number@7.0.0`とpip `six==1.17.0`を直列に取得し、非許可Host・直接通信拒否、取得後待機の取消と回収を確認する。同時Container最大2、専用Network最大2、Imageは保持する。認証情報・Repository本文・外部AI・Docker再起動／修復・既存資源削除は対象外。失敗時は再試行せず、今回の実IDに結合した安全な回収だけを行う。

試験器はNetwork部分の実測であり、製品の認証Containerを含む全体E2Eや取得処理中の取消を代替しない。初回レビューのRoot検証・失敗時回収、承認済みImage固定、作成前件数上限の3指摘を処置中。実通信試験は未実行であり、保持中②と先行2Rootの結果不明を回収済みへ変更しない。

### Image準備の停止

初回Proxy Buildが非0で終了したため、その場で停止した。Node Image取得、試験Container／Networkの作成、npm／pip通信は発行していない。再Build・Docker再起動は行っていない。自己生成の`network-policy-build-GVbEyp`だけに時刻・停止段階とBuild入力のコピーを保持する。既存の②・先行2Rootとは別物である。

失敗した準備呼出しはstderrを固定失敗へ変換した後に保持しておらず、一次エラー本文・終了値の詳細を再構成できない。今回の診断上の不足として残し、原因を確定済みとはしない。同じ最小環境でローカルhelpを読むとBuildxを検出せずlegacy builderとなり、DockerfileにはBuildKit用のCOPY属性があるため、Builderと入力形式の不整合が有力候補。help・既存ログの読取りだけでは元の非0理由を一意に確定できなかった。新しい管理機構は追加せず、再開前にこの候補と最小修正・診断方法を人間へ提示する。

Workbenchの固定候補通常結合回帰78件は全成功。確認checkboxのProvider／Hash結合は実Component＋React要素の局所構成で追加確認し、関連4件成功。これは実Browser DOM操作の観測ではない。

### 再承認後の準備と一回の限定試験

利用者の再承認に基づき、試験専用Docker設定から既存公式Buildx `0.37.1`を明示した。同じDockerfile・固定PythonをPullなし、Build Networkなしで一回再Buildして成功した。Node `24-bookworm-slim`の取得はその後一回だけ実施した。Build入力の出所・raw Hashは`docker-isolation/images/build-inputs.json`、限定試験の固定実ID・Node公式取得Digestは`tests/fixtures/network-policy-images.json`へ記録した。Imageは保持し、本番Image定義は未切替である。

| 準備結果 | 固定値 |
|---|---|
| 新Proxy実ID | `sha256:6cf0e234af7f41ddfcaaad225edcb8bbf335de7a29d9af4450be95dc401e1f89` |
| Node実ID・公式取得Digest | `sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5` |
| 実行した試験Source raw SHA-256 | `e0e42aaffbf6239a69c17d334852a6f4d6ad40994e82fea920f5d4c21f79efbb` |
| 試験時刻 | `2026-10-20T16:44:22.065Z`（日本時間2026-10-21） |

試験器の独立再レビューでは、Root・Image・資源件数上限に加え、cleanup／記録保存失敗が一次エラーを上書きしないことを確認し、限定範囲の残指摘0となった。その後一回だけ実行したが、npm場面のClientで`network_trial_client_failed`となり停止した。pip場面は未実行、再試行なし。今回の二Container・二Networkは元の64桁ID、所有label・構成のfresh照合で回収し、元ID一覧と今回label一覧の空を確認した。attach子Processもjoin済みである。

失敗段階`npm_acquisition`は取得、版確認、非許可Host拒否、直接通信拒否を一括しており、Clientの固定失敗markerだけではどの操作が原因か特定できない。npm／Proxy／試験器のいずれかへ原因を断定しない。Node Clientの構文は通信なしのcompileで正常だった。次の最小是正は、Clientの段階・固定理由分類・終了区分とProxyの非秘密診断を、回収前に区別して保存すること。診断を加えるための実通信再試行やDocker再起動は自動実行しない。

通常回帰はDI297成功・明示Docker等3未実行、Orchestrator単体66成功、Workbench結合78成功。公開API期待集合の追従漏れ1件を修正し、該当Caseは成功した。設定Fileがないためopen 0になる偽の反証をレビューで検出し、有効Fileの正対照open>0→途中失効open0・403へ是正して共有IT2件成功。Network本番接続の再レビュー残0、全体format／型／warning禁止Lintと既存二Traceability検査も成功した。試験台帳382件valid。これらを実通信成功や1〜4の全完了へ換算しない。

今回のBuild用Rootと試験Rootは、上記の必要最小限の結果を残し、記録のImage固定値・回収確認・Process終了と全子の非Link／範囲を照合してから、exact二Rootを回収し不存在確認した。保持中②と先行2Rootのunknown・同じ回復参照は変更していない。新Imageの本番有効化、実通信成功、旧Proxy Runtime定義の整理と最終回帰・コミット／プッシュは残件である。

## 13. DNS境界の是正と限定通信の成立 — 2026-10-21

### 原因の切分けと是正

利用者の診断付き一回承認で同じImageを実行した結果、npmの`install`段階・終了1、Proxyの`ready:1 / tunnel_failed:2`を区別できた。版確認・非許可Host・直接通信の検査には未到達。今回も再試行せず、資源とattach子を回収した。この時点では通信先・認証・取消の不具合と断定していない。

固定公開Host `registry.npmjs.org`のDNS読取りでIPv4 12件＋IPv6 12件を観測した。実Proxy関数へ同形24件を通信なしで与えると、旧上限16件によって接続前に`dns_answer_count_invalid`へ拒否される反例を再現した。DNS上限を32件へ是正し、24／32件の受理、33件拒否、末尾を含め一件でも非公開IPが混入する拒否を確認した。許可Host・443・直接通信禁止・全IP公開性検査は変更していない。

候補増加で一要求の接続待機を倍増させないよう、接続開始時の単調時刻で全候補共通15秒期限を固定し、各Socketには残余時間だけを設定する。通信なしの実関数反証で、32候補が応答しない場合の期限・全失敗Socket close、第一候補5秒失敗後の第二exact IP成功・timeout解除・呼出し側所有を確認した。接続失敗診断は4つの固定理由だけを追加し、IPや生例外を保存しない。診断・期限の独立再レビューは残指摘0である。

### 修正Imageと一回の実測

利用者は修正Imageの一回Buildと限定試験・回収を明示承認した。既存固定PythonからPullなし・Build Networkなしで作成したProxyは`sha256:4270d4dc5c3cddd9733712eb202309a51250b858a53e68882889edc88f413766`、Source raw SHA-256は`a27b81eb548ce2211094dc120c19fb0b819e1ee6b03dcfbb74a6e4b9b2a6c728`。Node Imageは前回固定した同一実IDを使用し、取得・更新していない。

一回の限定試験で次を確認した。実効Policy Hashは両場面とも`0e749a897760b0b846c61ce1e366fed2aa17669d975c6d75390158600acac532`。

| 対象 | 観測した成立条件 |
|---|---|
| npm | `is-number@7.0.0`をProxy越しに取得し、コード実行せず版を確認 |
| pip | `six==1.17.0`をProxy越しに取得し、コード実行せず配布Metadataの版を確認 |
| 非許可Host | 同じ認証付きProxy経路で`example.com:443`へのCONNECTが403、非許可名を診断へ記録しない |
| 直接通信 | internal-only ClientからRegistryへのTCP接続は失敗。上のProxy取得成功と分離して観測 |
| 取消 | 取得・拒否確認後の待機Clientを元IDで停止しattach子のclose／joinを確認 |
| 回収 | 自己生成した各場面の二Container・二Networkだけを元ID・fresh構成で回収し、元IDと今回label一覧の空を確認 |

この成功はDNS上限の是正と整合する。ただし失敗時のContainer DNS応答そのものは保存しておらず、Host DNSとの完全一致や当時の唯一原因まで証明したとはしない。成果はNetwork部分の成立であり、認証を含む製品全体E2E・実AI・取得中取消・全RepositoryのSecret保護へ拡張しない。②・先行2Rootのunknownは別の未解決状態を維持する。

### Owner統合と最終確認

成功したProxy ImageをDIの`image/assets.ts`へ単一定義として適用し、上位の実行前照合と通常認証も同じ定義へ接続した。`describeDockerProxyTopology`をDIへ移し、Coordinatorの実Consumer三系統とdoctorはDIの公開入口を参照する。旧定義の過去Probe成功・Source Hash・検証日をRuntime判断から撤去した。四つの非本番CIDR／CONNECT参照関数は意味を変えずCoordinatorの`tests/support/`へ閉じ、製品からのimportは0。移管の独立レビューは残指摘0。

最終品質レビューで、DI試験がCoordinatorの私有試験helperを参照する1件を検出した。Root検証・全祖先と生成RootのIdentity・差替え拒否・不存在確認を同じ意味のDI専用fixtureへ移し、製品API・共通Framework・例外を追加せず解消した。実通信断面は変更せず再試行していない。Filesystemだけの通常回収・別実体差替え拒否、Clientの有限診断を3件で確認した。正式な最終回帰・文書再レビューの結果は下記へ集約する。

### 最終回帰の集約

| 対象 | 確認結果 |
|---|---|
| Docker Isolation通常回帰 | 304件中302成功・失敗0・明示実行等2未実行。固定Pythonによる通信なし反証を含む |
| Domain Model | 253成功・失敗0 |
| Workbench | Build成功、79成功・失敗0。実Browser／実AIの全体E2Eとは区別 |
| AI Adapter | 35成功・失敗0 |
| Orchestrator | 単体66成功、公開Owner・単発状態の結合6成功・失敗0 |
| 最終移管後の上位接続 | Claude／Codex実行計画・認証・Proxy参照48成功・失敗0。外部AI・実Dockerは使わない |
| Coordinator広域通常回帰 | 1,815件中1,809成功・1不合格・5未実施。唯一の不合格は台帳ID順序の期待値で、是正後に対象File全3件成功。別途、影響先4File128件成功。元実行のexit 1は書き換えず、単一実行の全成功とは表示しない |
| 静的・台帳・構造 | 全体format、Source／Test型検査、warning禁止Lint、既存二Traceability検査が成功。Lintの既存info63件は残る。台帳382件valid、Root公開・責務階層・全Test Header接続の3検査成功 |
| 独立レビュー | 設計・品質の限定再レビューは残指摘0。任意Hash入力の最小修正も双方残指摘0。最終集約値・現在投影・台帳順序是正の品質再確認も残指摘0 |

Coordinatorの広い通常回帰は終了し、検出した追従漏れは上記の別実行で確認した。先行の長時間回帰の開始後に最終移管を行ったため、その結果と最終差分の影響先再確認を区別し、Source是正後の広域通常回帰を別に実行した。この表を製品全体E2E成功またはリリース可能の表示にしない。新規Build・通信試験の自己生成Rootは全て回収し、Source Hashを再確認した。先行unknown保持物と同じ回復参照、既存PA命名不合格、全体Checkerの既知不合格は変更していない。

広回帰から、Proxy公開項目・境界診断2箇所・Grant試験設定の追従漏れと、任意通信Hash追加時の既存Profile指定入力拒否を検出した。後者はexact field集合を置換したことが原因で、既存2形と各Hash付き2形の計4形だけを受理する最小修正とした。余剰field・不正Hash・Getter／Proxy拒否を維持し、両Provider・Objective全8組合せをHashあり／なしで確認した。影響先4File128件は全成功、独立確認残指摘0。再度の広回帰中に検出した台帳ID順序の期待値は正規順へ追従し、対象File3件成功。開始済み広回帰の不合格は後続成功で書き換えない。

局所確認で除外指定を欠いた呼出しがWindows親子Process取消2件も選択し、sandboxでは子終了未確認として不合格となった。終了hookは自己生成Processを回収した。同じ2件を必要なHost権限で実行して双方成功し、Process不存在とcloseを確認した。Docker処理は模擬で、実Docker・外部AI・認証は使っていない。通常回帰では三つの明示専用prefixを引き続き除外する。
