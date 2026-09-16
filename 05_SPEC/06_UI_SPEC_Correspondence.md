# UI／SPEC対応

状態: 是正済み・独立再レビュー待ち

この文書はUI契約ReadyとSPEC Readyの後に行う対応レビューの正本である。UI工程全体のExitとは別に判定する。UI契約またはSPEC契約をここで再定義せず、同じUX／IA Contextから導いたPresentation ContractとBehavior Contractの対応だけを確認する。

```text
          UX定義 + IA定義
              /       \
             ▼         ▼
      UI契約Ready   SPEC Ready
             \         /
              ▼       ▼
             対応レビュー
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      Pass      UI Gap    SPEC Gap
                            │
                  上流不足ならUX／IAへ戻す
```

## 1. レビュー対象

| 項目 | 対象 |
|---|---|
| 対象改訂版 | この文書、UI Definition、SPEC Definitionおよび双方の`pairs_with`を含む同一Git改訂版。実際のCommitはCHG-000073の独立レビュー記録で固定する |
| 対象関係 | 31組 |
| 判定単位 | UI／SPECの組ごとに、Shared Contextと8観点を確認する |
| 工程境界 | 対応PassはUI契約とSPEC契約の対応Closureを示す。Prototype／実画面評価を含むUI工程ExitまたはArchitectureへの通常Handoffは別Gate |

## 2. 対応関係と個別レビュー結果

| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |
|---|---|---|---|---|---|---|---|
| [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | UX-000001／IA-000001 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md)、[SPEC-000001](Definitions/SPEC-000001/spec_definition.md) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md) | UX-000002／IA-000002 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md)、[SPEC-000002](Definitions/SPEC-000002/spec_definition.md) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md) | UX-000003／IA-000002／IA-000003 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md)、[SPEC-000003](Definitions/SPEC-000003/spec_definition.md) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md) | UX-000003／IA-000003 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md)、[SPEC-000028](Definitions/SPEC-000028/spec_definition.md) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md) | UX-000003／IA-000002 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md)、[SPEC-000029](Definitions/SPEC-000029/spec_definition.md) |
| [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md) | UX-000004／UX-000022／IA-000003／IA-000012 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md)、[SPEC-000004](Definitions/SPEC-000004/spec_definition.md) |
| [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md) | UX-000022／IA-000003／IA-000012 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md)、[SPEC-000005](Definitions/SPEC-000005/spec_definition.md) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md) | UX-000005／IA-000002 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md)、[SPEC-000002](Definitions/SPEC-000002/spec_definition.md) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md) | UX-000005／UX-000009／IA-000002／IA-000006 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md)、[SPEC-000006](Definitions/SPEC-000006/spec_definition.md) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md) | UX-000015／IA-000006 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md)、[SPEC-000007](Definitions/SPEC-000007/spec_definition.md) |
| [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md) | UX-000006／IA-000004 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md)、[SPEC-000008](Definitions/SPEC-000008/spec_definition.md) |
| [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md) | UX-000008／IA-000020 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md)、[SPEC-000009](Definitions/SPEC-000009/spec_definition.md) |
| [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md) | UX-000010／UX-000011／IA-000006／IA-000007 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md)、[SPEC-000010](Definitions/SPEC-000010/spec_definition.md) |
| [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md) | UX-000012／IA-000008 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md)、[SPEC-000011](Definitions/SPEC-000011/spec_definition.md) |
| [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md) | UX-000013／IA-000009 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md)、[SPEC-000012](Definitions/SPEC-000012/spec_definition.md) |
| [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md) | UX-000014／IA-000010 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md)、[SPEC-000013](Definitions/SPEC-000013/spec_definition.md) |
| [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md) | UX-000016／IA-000011 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md)、[SPEC-000014](Definitions/SPEC-000014/spec_definition.md) |
| [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md) | UX-000018／IA-000013 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md)、[SPEC-000015](Definitions/SPEC-000015/spec_definition.md) |
| [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md) | UX-000017／UX-000022／IA-000012／IA-000003 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md)、[SPEC-000005](Definitions/SPEC-000005/spec_definition.md) |
| [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md) | UX-000017／UX-000022／IA-000012／IA-000003 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md)、[SPEC-000016](Definitions/SPEC-000016/spec_definition.md) |
| [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md) | UX-000019／UX-000021／IA-000014／IA-000003 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md)、[SPEC-000017](Definitions/SPEC-000017/spec_definition.md) |
| [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md) | UX-000020／UX-000031／IA-000015 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md)、[SPEC-000018](Definitions/SPEC-000018/spec_definition.md) |
| [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md) | UX-000007／IA-000005 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md)、[SPEC-000019](Definitions/SPEC-000019/spec_definition.md) |
| [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md) | UX-000023／UX-000026／UX-000029／IA-000016 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md)、[SPEC-000020](Definitions/SPEC-000020/spec_definition.md) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md)、[SPEC-000021](Definitions/SPEC-000021/spec_definition.md) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md)、[SPEC-000026](Definitions/SPEC-000026/spec_definition.md) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md)、[SPEC-000027](Definitions/SPEC-000027/spec_definition.md) |
| [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md) | UX-000025／IA-000021 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md)、[SPEC-000022](Definitions/SPEC-000022/spec_definition.md) |
| [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md) | UX-000027／UX-000028／IA-000018 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md)、[SPEC-000023](Definitions/SPEC-000023/spec_definition.md) |
| [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md) | UX-000030／IA-000019 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md)、[SPEC-000024](Definitions/SPEC-000024/spec_definition.md) |
| [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md) | UX-000032／IA-000022 | Shared | State／Trigger／Result／Failure／Recovery／Authority／Visibility／Constraintを確認 | Pass | なし。差異を検出した場合はUI／SPECのOwner工程へ戻す | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md)、[SPEC-000030](Definitions/SPEC-000030/spec_definition.md) |

## 3. 完了条件

- UIの操作ごとにSPECの契機と結果がある。
- SPECの失敗・回復ごとに、直接UIを持つ場合は認識可能なFeedbackがある。
- 表示状態とSystem状態を一対一と仮定しない。
- 一方だけでAuthority、Effect、状態または例外を創作しない。
- 直接UIを持たない振る舞いは理由と運用Feedbackを示す。

## 4. 観点別レビュー結果

| 観点 | 現在の結果 | 確認内容 |
|---|---|---|
| Shared Context | Pass | 各組が同じUX／IAの意味を保持する |
| State | Pass | 表示状態と意味状態を一対一と仮定せず、矛盾を残さない |
| Interaction／Trigger | Pass | UI操作にSPECの契機・条件・結果が対応する |
| Result／Feedback | Pass | SPEC結果を必要な利用者が認識できる |
| Failure／Recovery | Pass | 失敗、保持、回復条件と表示・導線が矛盾しない |
| Authority | Pass | 操作可能性、開示、拒否およびEffect権限が矛盾しない |
| Visibility | Pass | IAの可視性・非開示境界を双方が保持する |
| Constraint | Pass | 共通制約を片側で消していない |
| Coverage | Pass | Shared、UI-only、SPEC-only、直接UIなしを区別する |

## 5. CoverageとGap処置

| 区分 | 意味 | 現在の処置 |
|---|---|---|
| Shared | UIの認識・操作・FeedbackとSPECの契機・状態・結果を対応させる | 上記31組を全件確認済み |
| UI-only | 視覚順、色以外の識別、Keyboard、読上げ等 | UI定義で保持し、SPECへ振る舞いを発明しない |
| SPEC-only | 直接UIを持たない振る舞い、内部で完結する契約 | 理由、運用Feedback、人間確認をSPEC定義に残す |
| Gap | 片側または上流のCanonical Contractが不足する | UI／SPEC／IA／UXのOwner工程へ戻す。現在の未解消Gapはない |

## 6. ArchitectureとQualityへの接続

- Architectureの正式入力はUI DefinitionとSPEC Definitionである。この対応レビューは両入力の対応Closureを示すEvidenceであり、第三の仕様ではない。UI工程Exitが未完了の間はArchitectureへの通常Handoffを許可しない。
- UIとSPECはそれぞれQuality Analysisへ入力を渡す。対応レビューから新しいQuality Contractを発明しない。

## 7. 補足分析

なし。

## Checklist

- [x] UIとSPECが同じUX・IA Contextを保持している
- [x] Shared Stateの意味が一致する
- [x] InteractionとTriggerが矛盾しない
- [x] ResultとFeedbackが矛盾しない
- [x] FailureとError Presentationが矛盾しない
- [x] Recoveryが両側で成立する
- [x] Authorityが矛盾しない
- [x] Visibilityが矛盾しない
- [x] Constraintが片側で欠落していない
- [x] UI-only Responsibilityを識別した
- [x] SPEC-only Responsibilityを識別した
- [x] Shared Responsibilityを識別した
- [x] GapのOwner工程を特定した
- [x] UI／SPEC独自の第三仕様を作っていない
- [x] 未決事項をAI推測で補完していない
