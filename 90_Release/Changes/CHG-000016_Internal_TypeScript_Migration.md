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

この判断は内部Scriptの実装言語と実行境界を変更する。決定権限、公開範囲、単独package配布、Authority、Capability、Effect、準拠またはReleaseを変更しない。CoordinatorはCRDDと一体で利用するprivateなRepository内packageのままとする。

## 移行順序

1. Coordinatorのproduction moduleを全数strict型検査へ収束させる。
2. Coordinatorの`bin/`と`src/`を同じフォルダ配置の`.ts`へ改名し、内部importと実行commandを更新する。
3. Coordinatorのtestを`.ts`へ改名し、Node.jsネイティブ実行へ更新する。
4. Repository rootのchecker、fault injector、template checkerを`.ts`へ移し、現在の文書・AGENTS・package script・test fixture参照を更新する。
5. Node.js 24.12以上で、ネイティブ実行、二層型検査、Coordinator test、checker test、full checkerおよび必要な独立review／auditを新しい固定改訂版へ取得する。

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
