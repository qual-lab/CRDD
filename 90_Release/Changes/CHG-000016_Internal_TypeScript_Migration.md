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
