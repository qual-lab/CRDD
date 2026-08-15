# 変更トレース: CRDD内部ScriptのTypeScript完全移行

- 変更ID: `CHG-000016`
- 状態: `Draft`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-16
- 対象: CRDD v1.x / v2.xで管理する内部Script
- 対象version: 未決
- 変更分類: `breaking`
- 移行要否: `migration_required: true`
- 関連正本: [`12_Change.md`](../../12_Change.md)、[`19_Maintenance.md#33-internal-typescript-runtime`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 判断

人間の決定権限者は、CRDD内部Scriptを既存の責務別フォルダ配置のままTypeScriptへ完全移行する方針を承認した。`.ts`を標準とし、Node.js 24.12 LTS以上のネイティブTypeScript型除去で実行する。Runtimeへ`tsx`、`ts-node`、Babel、Bundlerまたは専用の変換packageを追加しない。

開発時のLintとFormatterはBiome 2.5.6へ統一する。Repository rootの単一`biome.json`を正本とし、Biomeは固定versionのdevDependencyとしてのみ保持する。既存`.mjs`はLint対象に含め、Formatterの強制対象は移行済み`.ts`から段階適用する。TypeScript型検査、Lint、Formatter確認およびRuntime testを独立した合否軸として維持する。

この判断は内部Scriptの実装言語と実行境界を変更する。決定権限、公開範囲、単独package配布、Authority、Capability、Effect、準拠またはReleaseを変更しない。CoordinatorはCRDDと一体で利用するprivateなRepository内packageのままとする。

## 移行順序

1. Coordinatorのproduction moduleを全数strict型検査へ収束させる。
2. Coordinatorの`bin/`と`src/`を同じフォルダ配置の`.ts`へ改名し、内部importと実行commandを更新する。
3. Coordinatorのtestを`.ts`へ改名し、Node.jsネイティブ実行へ更新する。
4. Repository rootのchecker、fault injector、template checkerを`.ts`へ移し、現在の文書・AGENTS・package script・test fixture参照を更新する。
5. Node.js 24.12以上で、ネイティブ実行、二層型検査、Biome Lint／Formatter確認、Coordinator test、checker test、full checkerおよび必要な独立review／auditを新しい固定改訂版へ取得する。

## 現在状態と保持条件

作業環境のNode.js 22による確認は移行中の中間確認に限る。Node.js 24.12以上の固定環境でネイティブ実行を確認するまで、この変更を`Resolved`、採用済み、準拠、StableまたはReleasedとしない。

Node.js組込み機能、ESMおよび`import type`を使用し、`enum`、Runtime namespace、parameter property、decorator、path aliasまたはcompiler変換を必要とする構文を導入しない。`.mjs`、`.cjs`または`.js`を残す場合は、移行途中以外の明示理由を本変更へ追加する。

Coordinator Runtime 1.0の12 implementation blocker、6 current-run evidence、Gate blocked、Authority／Capability／Effect非発行および非Release境界は変更しない。

## 停止条件

- Node.js 24.12以上で既存のRuntime意味を維持できない。
- 変換package、Bundlerまたはcompiler出力をRuntime必須依存にする必要が生じる。
- 拡張子変更が外部公開API、package単独配布、既存Schema、Authority、CapabilityまたはEffectの変更を要求する。
- 現在の利用側を一意に移行できず、復旧経路を示せない。

上記を検出した場合は該当単位を停止し、人間の決定権限者へ影響、代替案および残るリスクを戻す。

## 2026-08-16 — Biome導入とproduction strict収束

Biome 2.5.6を固定devDependencyとして導入し、Repository rootの`biome.json`をLint／Formatter規則の単一正本にした。制御文字を明示的に拒否するsecurity regexとRFC 8785の倍精度境界fixtureは意図した利用であるため、該当2 ruleだけを理由付きで無効にする。既存`.mjs`はLint対象、移行済み`.ts`はFormatter確認対象とし、既存実装への一括自動整形を行わない。

Coordinatorのproduction 38 moduleを全数strict型検査へ追加した。現行Node.js 22.18.0の中間確認では、二層型検査、Biome LintおよびFormatter確認がPassした。型注釈またはRuntimeロジックの変更はなく、既存の外部入力、fail-closed、Authority／Capability／EffectおよびGate境界を変更しない。この処置は`Applied`／`Self-checked`であり、`.ts`改名、Node.js 24.12以上のnative実行および独立review／audit前は`Resolved`ではない。

## 2026-08-16 — production TypeScript移行 1 / 38

一括改名の中間試行により、`.mjs`で有効だったJSDoc型を`.ts`へ機械的に残すだけではTypeScriptの実parameter型にならず、型境界を弱めることを確認した。この試行差分は固定せず破棄し、module単位で実TypeScript型へ置換する経路へ戻した。`@ts-nocheck`、抑制commentまたは`noImplicitAny`無効化は採用しない。

最初の単位として`authority-root-path-lexical.mjs`を同一配置の`authority-root-path-lexical.ts`へ移し、外部入力を`unknown`、成功後を`string`へ絞るtype predicateを実装した。直接import 2箇所を`.ts`へ更新し、Biome Formatter、二層型検査、Biome Lint／Formatter確認およびCoordinator全255件がPassした。Runtime判定、Path上限、Platform分岐、Authority／Capability／EffectおよびGateを変更しない。`Applied`／`Self-checked`であり、全移行と独立review／audit前は`Resolved`ではない。

続いて`runtime-activation-identity.mjs`を同一配置の`.ts`へ移し、外部入力を`unknown`、成功後を`string`へ絞るtype predicateへ置換した。Activation IDのpatternと上限、直接import 2箇所、readiness、Authority／Capability／EffectおよびGateを変更しない。productionの移行済み数は2 / 38である。

型注釈を必要としない`runtime-activation-locator-binding-contract.mjs`も同一配置の`.ts`へ移し、直接利用側6箇所を明示`.ts` importへ更新した。公開契約値、readiness、Authority／Capability／EffectおよびGateは変更せず、productionの移行済み数は3 / 38である。

`runtime-activation-locator-binding.mjs`を`.ts`へ移し、公開入力を`unknown`、内部response引数を実TypeScript型へ置換した。初回activationだけを扱う候補境界とfail-closed理由、Locatorとの5 field結合、Authority／Capability／EffectおよびGateを変更せず、productionの移行済み数は4 / 38である。

`authority-root-profile.mjs`を`.ts`へ移し、公開入力とPath predicateを`unknown`から安全に絞り、response helperをgeneric TypeScript型へ置換した。CLI／環境の優先順位、明示activate要求、Path非出力、Authority／Capability／EffectおよびGateを変更せず、productionの移行済み数は5 / 38である。

`platform-key-storage-policy.mjs`を`.ts`へ移し、外部入力を`unknown`、platform familyを正本objectのkey unionへ絞るpredicate、追加結果を保持するgeneric responseへ置換した。P-256、preferred／明示fallback、秘密鍵非入出力、Authority／Capability／EffectおよびGateを変更せず、productionの移行済み数は6 / 38である。

`platform-provisioner-package-gate.mjs`を`.ts`へ移し、外部入力と観測値を`unknown`、candidate／blocked responseと追加fieldをgeneric TypeScript型へ置換した。CRDD同梱・単体非許可、manifest結合、caller観測非Authority、Effect未発行およびGateを変更せず、productionの移行済み数は7 / 38である。

`runtime-root-profile.mjs`を`.ts`へ移し、公開入力とPath predicateを`unknown`から安全に絞り、selectionを保持するgeneric responseへ置換した。CLI／環境／Repository既定の優先順位、明示enable、Path非出力、Authority／Capability／EffectおよびGateを変更せず、productionの移行済み数は8 / 38である。

`authority-prelaunch-verifier.mjs`を`.ts`へ移し、3つの公開入力と内部contextを`unknown`、blocked理由を`string`へ置換した。Runtime時計、Bundle／Grant再検証、Registry結合、Capability未発行およびGateを変更せず、productionの移行済み数は9 / 38である。

`enrollment-certificate-renewal.mjs`を`.ts`へ移し、外部入力とEnvelope／SPKI snapshot入力を`unknown`、UTC predicateとgeneric responseを実TypeScript型へ置換した。30日更新窓、Identity継続、時計／CA Trust／永続化未成立、Authority／Capability／EffectおよびGateを変更せず、productionの移行済み数は10 / 38である。

## 2026-08-16 — production TypeScript移行 21 / 38

shared plain-data snapshotを含む次の11 moduleを同一配置の`.ts`へ移行した。

- `plain-data-snapshot`
- `cli-options`
- `authority-file-bundle`
- `authority-grant-verifier`
- `authority-trust-loader`
- `git-local-exclude`
- `provisioning-ca-pure-core`
- `offline-enrollment-bundle-pure-core`
- `platform-provisioner-trust-core`
- `provider-isolation-profile`
- `root-protection-policy`

plain-data snapshotの返却値を許可keyごとの`unknown`として表現し、利用側が文字列、数値、配列要素、署名entryおよび時刻を使用前に実行時検証する境界へ統一した。`noUncheckedIndexedAccess`で検出した配列境界は、要素の存在確認後にだけ比較または署名検証へ渡す。外部入力を型アサーションで信頼せず、`any`、`@ts-nocheck`、抑制commentまたはstrict設定の緩和を導入しない。

Authority、Enrollment、Provisioning CA、ProviderおよびRoot Protectionの既存fail-closed理由、暗号domain、件数／byte budget、Authority／Capability／Effect非発行、12 implementation blocker、6 current-run evidenceおよびGate blockedを変更しない。この単位は二層型検査のPassまで`Self-checked`であり、Biome、Coordinator全test、full checker、Node.js 24.12以上のnative実行および独立review／audit前は`Resolved`ではない。

`host-recovery-record.mjs`を同一配置の`.ts`へ移し、token入力を`unknown`から既存pattern検証後の文字列へ絞り、token生成引数を文字列として固定した。Recovery token、record Hash照合、Filesystem境界および回復処置を変更せず、productionの移行済み数は22 / 38である。

`repository-git-layout.mjs`の公開境界を同一配置の`.ts`へ移し、外部入力を`unknown`、絶対Path predicateをtype predicate、layoutを保持するresponseをgeneric型へ置換した。Git metadataの内部Resolver／writerは後続単位に分離し、公開候補、Path非出力およびEffect非発行を変更せず、productionの移行済み数は23 / 38である。

`initial-enrollment-runtime-state.mjs`を同一配置の`.ts`へ移し、外側入力をexact plain-data snapshotで`unknown`から絞り、Challengeの時刻をdata descriptorとprimitive stringの確認後にだけ使用する境界へ置換した。Runtime所有時計、最初の検証試行による一回消費、永続台帳未実装、Authority／Capability／Effect非発行を変更せず、productionの移行済み数は24 / 38である。

`authority-root-locator.mjs`を同一配置の`.ts`へ移し、canonical JSON生成から未検証recordへの型アサーションを除去し、primitive値とown data descriptorだけを再帰処理する境界へ置換した。raw Buffer長はintrinsic getterの存在とsafe integer結果を確認してからcopy上限へ使用する。Locator Schema、Hash、activation binding、Path非出力およびEffect非発行を変更せず、productionの移行済み数は25 / 38である。

`egress-proxy-policy.mjs`を同一配置の`.ts`へ移し、special-purpose address snapshotをreadonly tuple／CIDR ruleとして固定し、公開fixtureのpolicy、CONNECT要求およびDNS結果から`any`を除去した。外部入力はplain-data record／array snapshotとprimitive検証後にだけ使用する。既存IANA snapshot、longest-prefix判定、private address拒否、Authority未成立およびProxy Effect未実装を変更せず、productionの移行済み数は26 / 38である。

`runtime-activation-transition.mjs`を同一配置の`.ts`へ移し、`Record<string, any>`を廃止した。compile／decode Coreの候補結果とactivation recordをexact plain-data snapshotとfield別primitive検証で再構成し、初版およびdisable遷移の比較にだけ渡す。遷移規則、canonical byte ownership、Filesystem／Persistence／Capability非発行を変更せず、productionの移行済み数は27 / 38である。

`provisioning-signature-primitives.mjs`を同一配置の`.ts`へ移し、JCS値、再帰snapshot状態、bounded writer、SPKI／署名入力およびexact verification入力を消去可能なTypeScript型へ置換した。raw Bufferはintrinsic byte lengthの存在、数値型、安全整数および上限を確認後にだけowned copyへ移す。RFC 8785／8410／8032／4648、P-256 low-S、既存budget、Authority／Capability／Effect非発行を変更せず、productionの移行済み数は28 / 38である。

`provisioning-record-pure-core.mjs`を同一配置の`.ts`へ移し、準備記録、署名包絡、信頼起点鍵集合および失効一覧をreadonlyのexact型へ置換した。外部入力は引き続き`unknown`からown data descriptor、primitive、配列形状、canonical UTC、Hash、ID、SPKIおよび署名の実行時検証で絞り、nullableなprevious record Hashもrevision規則と独立に型確定してから使用する。型アサーション、`any`、抑制commentまたはstrict設定の緩和は導入していない。JCS／署名／集約検証、件数・byte budget、fail-closed理由、Authority／Capability／Effect非発行およびGate blockedを変更せず、productionの移行済み数は29 / 38である。

`provisioning-record-enrollment-binding.mjs`を同一配置の`.ts`へ移し、公開入力を`unknown`、登録証明書結合、準備記録の署名entry、信頼起点鍵entryおよび準備認証局発行鍵を実行時snapshot後のreadonly型へ置換した。canonical化後に再取得するJSONも`unknown`としてexact object／array境界を通し、SPKIは長さ、base64url canonical性、DERおよびkey ID一致を検査してから使用する。準備記録、登録証明書、Platform scope、Provisioner Identity、installation keyおよびCA seriesの全結合、Runtime所有Trust／rollback／clock未成立、Authority／Capability／Effect非発行およびGate blockedを変更せず、productionの移行済み数は30 / 38である。

`bin/coordinator.mjs`を同一配置の`.ts`へ移し、package script、READMEの実行例、CLI testの起動PathおよびPlatform Provisioner manifest fixtureを`.ts`へ更新した。command引数は既存parserの結果も`unknown`としてplain recordへ再snapshotし、diagnostic reportの異なるshapeは共通の`any`へ丸めず、表示に必要なfieldだけをown data propertyから実行時に絞る。usage errorも専用Error型へ置換した。CLI grammar、終了code、Path非出力、doctorのpassive性、Provision／activate／disableのEffect未実装およびGate blockedを変更せず、productionの移行済み数は31 / 38である。

`initial-enrollment-pure-core.mjs`を同一配置の`.ts`へ移し、オンライン登録チャレンジ、登録要求、登録証明書、署名entryおよび各Envelopeを具体的なreadonly型へ置換した。exact record／array、canonical raw JSON decoder、payload／Envelope wrapperはgeneric型で同じRuntime検証を共有し、Buffer長はintrinsic getterの存在、数値型、安全整数および上限を確認してからowned copyへ移す。P-256所有証明、Ed25519 CA署名、成果物別domain、30分／180日の時刻境界、一回消費／Runtime Trust未成立、Authority／Capability／Effect非発行およびGate blockedを変更せず、productionの移行済み数は32 / 38である。

`runtime-root-path-identity.mjs`を同一配置の`.ts`へ移し、Directory Identity、snapshot、選択source、sessionおよびGit exclude write要約を具体的なreadonly型へ置換した。選択profileの入れ子fieldと例外のwrite実績はown data descriptorから`unknown`を絞り、`Record<string, any>`と型アサーションを廃止した。realpath／Identity再検証、Repository containment、初回snapshot結合、Path／Identity非出力、Capability未発行およびfail-closed回復を変更せず、productionの移行済み数は33 / 38である。

`repository-git-layout-internal.mjs`を同一配置の`.ts`へ移し、Filesystem Identity、snapshot、layout、stable file readおよびexclude writerを具体的なreadonly型へ置換した。公開入力は`unknown`からstringへ絞り、Filesystem例外はown propertyから`ENOENT`だけを判定し、write実績は専用Error型で保持する。併せてstrict設定へ`noImplicitAny`を明示し、TypeScript版の既定展開に依存せず暗黙の`any`を拒否した。Git metadataのnon-link／Identity再検証、bounded read、lock／fsync／rename／post-write verification、Path非出力およびfail-closed境界を変更せず、productionの移行済み数は34 / 38である。

`execution-environment.mjs`を同一配置の`.ts`へ移し、一時Directory群、Filesystem Identity、mount snapshot、host recovery state／recordおよびWeakMap内の所有状態を具体的なreadonly型へ置換した。公開されたowned object、Capability、回復tokenおよび環境変数は`unknown`からown data propertyで絞り、JSON回復記録もplain record、状態、Identityおよびchild集合を実行時検証してから利用する。秘密環境変数の除外、Directory Identity再検証、host recovery、Path非出力およびCapabilityの非偽造境界を変更せず、productionの移行済み数は35 / 38である。

`docker-isolation.mjs`を同一配置の`.ts`へ移し、Docker CLI snapshot、mount集合、process結果、container Identity、absence observation、recovery recordおよびprobe結果を具体的な型へ置換した。Docker inspect JSONはown data propertyと配列を実行時検証し、永続回復記録もIdentity、containerおよびchild集合を`unknown`から検証してから使用する。CLI／image pinning、owned Capability、networkなし／read-only隔離、回復時のcontainer同一性、Path／秘密非出力、Authority／Effect非発行を変更せず、productionの移行済み数は36 / 38である。

`runtime-activation-record.mjs`を同一配置の`.ts`へ移し、onboarding dependency、implementation snapshot、activation recordおよびcandidate結果を具体型へ置換した。readiness sourceは既存の単一implementation snapshotから`unknown`値として保持し、canonical JSONはown data propertyだけを再帰処理する。raw Bufferのintrinsic byteLength getterも存在を確認してから使用する。12 blocker／6 evidence、activation record Schema、canonical Hash、raw decoder、Authority／Capability非発行およびGate blockedを変更せず、productionの移行済み数は37 / 38である。
