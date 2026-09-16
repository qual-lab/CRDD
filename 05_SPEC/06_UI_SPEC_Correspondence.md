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
| 対象改訂版 | UI／SPEC Definition集合 SHA-256: `d2ba1021c763573852a65db5713bed5b682eb75c180e461fab526096deaad965` |
| 対象関係 | 31組 |
| 判定単位 | UI／SPECの組ごとに、Shared Contextと8観点を確認する |
| 工程境界 | 対応PassはUI契約とSPEC契約の対応Closureを示す。Prototype／実画面評価を含むUI工程ExitまたはArchitectureへの通常Handoffは別Gate |

## 2. 対応関係と個別レビュー結果

| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |
|---|---|---|---|---|---|---|---|
| [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | UX-000001／IA-000001 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000001spec-000001) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md) | UX-000002／IA-000002 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000002spec-000002) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md) | UX-000003／IA-000002／IA-000003 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000002spec-000003) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md) | UX-000003／IA-000003 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000002spec-000028) |
| [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md) | UX-000003／IA-000002 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000002spec-000029) |
| [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md) | UX-000004／UX-000022／IA-000003／IA-000012 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000003spec-000004) |
| [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md) | UX-000022／IA-000003／IA-000012 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000003spec-000005) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md) | UX-000005／IA-000002 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000004spec-000002) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md) | UX-000005／UX-000009／IA-000002／IA-000006 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000004spec-000006) |
| [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md) | UX-000015／IA-000006 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000004spec-000007) |
| [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md) | UX-000006／IA-000004 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000005spec-000008) |
| [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md) | UX-000008／IA-000020 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000005spec-000009) |
| [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md) | UX-000010／UX-000011／IA-000006／IA-000007 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000006spec-000010) |
| [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md) | UX-000012／IA-000008 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000007spec-000011) |
| [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md) | UX-000013／IA-000009 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000008spec-000012) |
| [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md) | UX-000014／IA-000010 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000009spec-000013) |
| [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md) | UX-000016／IA-000011 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000010spec-000014) |
| [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md) | UX-000018／IA-000013 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000010spec-000015) |
| [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md) | UX-000017／UX-000022／IA-000012／IA-000003 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000011spec-000005) |
| [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md) | UX-000017／UX-000022／IA-000012／IA-000003 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000011spec-000016) |
| [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md) | UX-000019／UX-000021／IA-000014／IA-000003 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000012spec-000017) |
| [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md) | UX-000020／UX-000031／IA-000015 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000013spec-000018) |
| [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md) | UX-000007／IA-000005 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000014spec-000019) |
| [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md) | UX-000023／UX-000026／UX-000029／IA-000016 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000015spec-000020) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000016spec-000021) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000016spec-000026) |
| [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md) | UX-000024／IA-000014／IA-000017 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000016spec-000027) |
| [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md) | UX-000025／IA-000021 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000017spec-000022) |
| [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md) | UX-000027／UX-000028／IA-000018 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000018spec-000023) |
| [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md) | UX-000030／IA-000019 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000019spec-000024) |
| [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md) | UX-000032／IA-000022 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし。差異検出時はUI／SPECのOwner工程へ戻す | [組別Evidence](#ui-000020spec-000030) |

## 3. 組別Evidence

### UI-000001／SPEC-000001

共有Context: UX-000001、IA-000001

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | UI-000001「事前検査と意味レビューへの案内」の表示状態を、SPEC-000001「事前検査を実行し意味レビューへ案内する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI-000001「事前検査と意味レビューへの案内」の利用者操作は、SPEC-000001「事前検査を実行し意味レビューへ案内する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000001「事前検査を実行し意味レビューへ案内する」の結果を、UI-000001「事前検査と意味レビューへの案内」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000001「事前検査を実行し意味レビューへ案内する」の失敗理由を、UI-000001「事前検査と意味レビューへの案内」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000001「事前検査を実行し意味レビューへ案内する」が定める安全な戻り先と未解消義務を、UI-000001「事前検査と意味レビューへの案内」の次の行動へ対応付ける。 |
| Authority | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI-000001「事前検査と意味レビューへの案内」の操作可能範囲を、SPEC-000001「事前検査を実行し意味レビューへ案内する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#表示面と情報の優先順位) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000001「事前検査を実行し意味レビューへ案内する」の結果・不足・観測不能を、UI-000001「事前検査と意味レビューへの案内」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#制約) | 一致 | UI-000001「事前検査と意味レビューへの案内」とSPEC-000001「事前検査を実行し意味レビューへ案内する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000002

共有Context: UX-000002、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI-000002「委任・実行状態・判断」の表示状態を、SPEC-000002「委任範囲と権限を確定して受理する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の利用者操作は、SPEC-000002「委任範囲と権限を確定して受理する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000002「委任範囲と権限を確定して受理する」の結果を、UI-000002「委任・実行状態・判断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000002「委任範囲と権限を確定して受理する」の失敗理由を、UI-000002「委任・実行状態・判断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000002「委任範囲と権限を確定して受理する」が定める安全な戻り先と未解消義務を、UI-000002「委任・実行状態・判断」の次の行動へ対応付ける。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の操作可能範囲を、SPEC-000002「委任範囲と権限を確定して受理する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000002「委任範囲と権限を確定して受理する」の結果・不足・観測不能を、UI-000002「委任・実行状態・判断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#制約) | 一致 | UI-000002「委任・実行状態・判断」とSPEC-000002「委任範囲と権限を確定して受理する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000003

共有Context: UX-000003、IA-000002、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#振る舞い状態結果) | 一致 | UI-000002「委任・実行状態・判断」の表示状態を、SPEC-000003「委任した仕事の状態と判断要否を返す」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の利用者操作は、SPEC-000003「委任した仕事の状態と判断要否を返す」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000003「委任した仕事の状態と判断要否を返す」の結果を、UI-000002「委任・実行状態・判断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000003「委任した仕事の状態と判断要否を返す」の失敗理由を、UI-000002「委任・実行状態・判断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000003「委任した仕事の状態と判断要否を返す」が定める安全な戻り先と未解消義務を、UI-000002「委任・実行状態・判断」の次の行動へ対応付ける。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の操作可能範囲を、SPEC-000003「委任した仕事の状態と判断要否を返す」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000003「委任した仕事の状態と判断要否を返す」の結果・不足・観測不能を、UI-000002「委任・実行状態・判断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#制約) | 一致 | UI-000002「委任・実行状態・判断」とSPEC-000003「委任した仕事の状態と判断要否を返す」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000028

共有Context: UX-000003、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#振る舞い状態結果) | 一致 | UI-000002「委任・実行状態・判断」の表示状態を、SPEC-000028「Taskの取消と終了確認」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の利用者操作は、SPEC-000028「Taskの取消と終了確認」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000028「Taskの取消と終了確認」の結果を、UI-000002「委任・実行状態・判断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000028「Taskの取消と終了確認」の失敗理由を、UI-000002「委任・実行状態・判断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000028「Taskの取消と終了確認」が定める安全な戻り先と未解消義務を、UI-000002「委任・実行状態・判断」の次の行動へ対応付ける。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の操作可能範囲を、SPEC-000028「Taskの取消と終了確認」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000028「Taskの取消と終了確認」の結果・不足・観測不能を、UI-000002「委任・実行状態・判断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#制約) | 一致 | UI-000002「委任・実行状態・判断」とSPEC-000028「Taskの取消と終了確認」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000029

共有Context: UX-000003、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#振る舞い状態結果) | 一致 | UI-000002「委任・実行状態・判断」の表示状態を、SPEC-000029「判断待ちTaskへの判断返却」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の利用者操作は、SPEC-000029「判断待ちTaskへの判断返却」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000029「判断待ちTaskへの判断返却」の結果を、UI-000002「委任・実行状態・判断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000029「判断待ちTaskへの判断返却」の失敗理由を、UI-000002「委任・実行状態・判断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000029「判断待ちTaskへの判断返却」が定める安全な戻り先と未解消義務を、UI-000002「委任・実行状態・判断」の次の行動へ対応付ける。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#契機事前条件authority) | 一致 | UI-000002「委任・実行状態・判断」の操作可能範囲を、SPEC-000029「判断待ちTaskへの判断返却」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000029「判断待ちTaskへの判断返却」の結果・不足・観測不能を、UI-000002「委任・実行状態・判断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#制約) | 一致 | UI-000002「委任・実行状態・判断」とSPEC-000029「判断待ちTaskへの判断返却」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000003／SPEC-000004

共有Context: UX-000004、UX-000022、IA-000003、IA-000012

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#振る舞い状態結果) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の表示状態を、SPEC-000004「失敗後の再試行と回復を安全に選別する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#契機事前条件authority) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の利用者操作は、SPEC-000004「失敗後の再試行と回復を安全に選別する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000004「失敗後の再試行と回復を安全に選別する」の結果を、UI-000003「失敗後の再試行・回復・清掃」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000004「失敗後の再試行と回復を安全に選別する」の失敗理由を、UI-000003「失敗後の再試行・回復・清掃」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000004「失敗後の再試行と回復を安全に選別する」が定める安全な戻り先と未解消義務を、UI-000003「失敗後の再試行・回復・清掃」の次の行動へ対応付ける。 |
| Authority | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#契機事前条件authority) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の操作可能範囲を、SPEC-000004「失敗後の再試行と回復を安全に選別する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#表示面と情報の優先順位) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000004「失敗後の再試行と回復を安全に選別する」の結果・不足・観測不能を、UI-000003「失敗後の再試行・回復・清掃」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#制約) | 一致 | UI-000003「失敗後の再試行・回復・清掃」とSPEC-000004「失敗後の再試行と回復を安全に選別する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000003／SPEC-000005

共有Context: UX-000022、IA-000003、IA-000012

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の表示状態を、SPEC-000005「残存資源を清掃し終了後を確認する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の利用者操作は、SPEC-000005「残存資源を清掃し終了後を確認する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の結果を、UI-000003「失敗後の再試行・回復・清掃」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の失敗理由を、UI-000003「失敗後の再試行・回復・清掃」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」が定める安全な戻り先と未解消義務を、UI-000003「失敗後の再試行・回復・清掃」の次の行動へ対応付ける。 |
| Authority | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI-000003「失敗後の再試行・回復・清掃」の操作可能範囲を、SPEC-000005「残存資源を清掃し終了後を確認する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#表示面と情報の優先順位) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の結果・不足・観測不能を、UI-000003「失敗後の再試行・回復・清掃」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#制約) | 一致 | UI-000003「失敗後の再試行・回復・清掃」とSPEC-000005「残存資源を清掃し終了後を確認する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000004／SPEC-000002

共有Context: UX-000005、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI-000004の未発行・受理・拒否・判断待ち・結果不明をSPEC-000002の委任状態へ対応付け、Task完了・Objective受入・Milestone受入を別状態として保持する。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI-000004の節目委任操作はSPEC-000002の目的・範囲・Authority検証を発火し、不足・競合時はTaskを発行しない。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000002の受理・拒否・判断待ち・結果不明と三段階の完成結果を、UI-000004が同じ意味の表示へ分ける。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000002のblocked・明示拒否・受理後観測不能を、UI-000004が成功または未発行へ丸めず理由付きで示す。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | UI-000004の同一依頼へ戻る操作を、SPEC-000002の提案修正・同一依頼再観測・Objective／Milestone判断への戻り先へ対応付ける。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI-000004の委任可能範囲をSPEC-000002のProject運営者Authorityに限定し、Runtimeによる範囲拡張を許さない。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000002の未委任判断・完成段階・未解消状態を、UI-000004が節目の現在状態として隠さず表示する。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#制約) | 一致 | UI-000004とSPEC-000002はいずれもTask完了からObjective／Milestone受入を推定せず、実装方式を固定しない。 |

### UI-000004／SPEC-000006

共有Context: UX-000005、UX-000009、IA-000002、IA-000006

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#振る舞い状態結果) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の表示状態を、SPEC-000006「Projectと節目の現在状態を投影する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#契機事前条件authority) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の利用者操作は、SPEC-000006「Projectと節目の現在状態を投影する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000006「Projectと節目の現在状態を投影する」の結果を、UI-000004「Project・節目・Portfolioの状況把握」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000006「Projectと節目の現在状態を投影する」の失敗理由を、UI-000004「Project・節目・Portfolioの状況把握」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000006「Projectと節目の現在状態を投影する」が定める安全な戻り先と未解消義務を、UI-000004「Project・節目・Portfolioの状況把握」の次の行動へ対応付ける。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#契機事前条件authority) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の操作可能範囲を、SPEC-000006「Projectと節目の現在状態を投影する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000006「Projectと節目の現在状態を投影する」の結果・不足・観測不能を、UI-000004「Project・節目・Portfolioの状況把握」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#制約) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」とSPEC-000006「Projectと節目の現在状態を投影する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000004／SPEC-000007

共有Context: UX-000015、IA-000006

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#振る舞い状態結果) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の表示状態を、SPEC-000007「複数Projectを比較可能な投影へ統合する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#契機事前条件authority) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の利用者操作は、SPEC-000007「複数Projectを比較可能な投影へ統合する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000007「複数Projectを比較可能な投影へ統合する」の結果を、UI-000004「Project・節目・Portfolioの状況把握」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000007「複数Projectを比較可能な投影へ統合する」の失敗理由を、UI-000004「Project・節目・Portfolioの状況把握」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000007「複数Projectを比較可能な投影へ統合する」が定める安全な戻り先と未解消義務を、UI-000004「Project・節目・Portfolioの状況把握」の次の行動へ対応付ける。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#契機事前条件authority) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」の操作可能範囲を、SPEC-000007「複数Projectを比較可能な投影へ統合する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000007「複数Projectを比較可能な投影へ統合する」の結果・不足・観測不能を、UI-000004「Project・節目・Portfolioの状況把握」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#制約) | 一致 | UI-000004「Project・節目・Portfolioの状況把握」とSPEC-000007「複数Projectを比較可能な投影へ統合する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000005／SPEC-000008

共有Context: UX-000006、IA-000004

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#振る舞い状態結果) | 一致 | UI-000005「実行事実と故障境界の診断」の表示状態を、SPEC-000008「実行事実と評価を区別して取得する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#契機事前条件authority) | 一致 | UI-000005「実行事実と故障境界の診断」の利用者操作は、SPEC-000008「実行事実と評価を区別して取得する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000008「実行事実と評価を区別して取得する」の結果を、UI-000005「実行事実と故障境界の診断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000008「実行事実と評価を区別して取得する」の失敗理由を、UI-000005「実行事実と故障境界の診断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000008「実行事実と評価を区別して取得する」が定める安全な戻り先と未解消義務を、UI-000005「実行事実と故障境界の診断」の次の行動へ対応付ける。 |
| Authority | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#契機事前条件authority) | 一致 | UI-000005「実行事実と故障境界の診断」の操作可能範囲を、SPEC-000008「実行事実と評価を区別して取得する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#表示面と情報の優先順位) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000008「実行事実と評価を区別して取得する」の結果・不足・観測不能を、UI-000005「実行事実と故障境界の診断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#制約) | 一致 | UI-000005「実行事実と故障境界の診断」とSPEC-000008「実行事実と評価を区別して取得する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000005／SPEC-000009

共有Context: UX-000008、IA-000020

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#振る舞い状態結果) | 一致 | UI-000005「実行事実と故障境界の診断」の表示状態を、SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#契機事前条件authority) | 一致 | UI-000005「実行事実と故障境界の診断」の利用者操作は、SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」の結果を、UI-000005「実行事実と故障境界の診断」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」の失敗理由を、UI-000005「実行事実と故障境界の診断」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」が定める安全な戻り先と未解消義務を、UI-000005「実行事実と故障境界の診断」の次の行動へ対応付ける。 |
| Authority | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#契機事前条件authority) | 一致 | UI-000005「実行事実と故障境界の診断」の操作可能範囲を、SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#表示面と情報の優先順位) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」の結果・不足・観測不能を、UI-000005「実行事実と故障境界の診断」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#制約) | 一致 | UI-000005「実行事実と故障境界の診断」とSPEC-000009「実行基盤の故障境界と利用可能範囲を診断する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000006／SPEC-000010

共有Context: UX-000010、UX-000011、IA-000006、IA-000007

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#状態と表示差) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#振る舞い状態結果) | 一致 | UI-000006「Repository内作業と対象選択」の表示状態を、SPEC-000010「Repositoryと実行対象のBindingを解決する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#契機事前条件authority) | 一致 | UI-000006「Repository内作業と対象選択」の利用者操作は、SPEC-000010「Repositoryと実行対象のBindingを解決する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000010「Repositoryと実行対象のBindingを解決する」の結果を、UI-000006「Repository内作業と対象選択」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000010「Repositoryと実行対象のBindingを解決する」の失敗理由を、UI-000006「Repository内作業と対象選択」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#状態と表示差) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000010「Repositoryと実行対象のBindingを解決する」が定める安全な戻り先と未解消義務を、UI-000006「Repository内作業と対象選択」の次の行動へ対応付ける。 |
| Authority | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#制約) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#契機事前条件authority) | 一致 | UI-000006「Repository内作業と対象選択」の操作可能範囲を、SPEC-000010「Repositoryと実行対象のBindingを解決する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#表示面と情報の優先順位) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000010「Repositoryと実行対象のBindingを解決する」の結果・不足・観測不能を、UI-000006「Repository内作業と対象選択」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#制約) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#制約) | 一致 | UI-000006「Repository内作業と対象選択」とSPEC-000010「Repositoryと実行対象のBindingを解決する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000007／SPEC-000011

共有Context: UX-000012、IA-000008

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#状態と表示差) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#振る舞い状態結果) | 一致 | UI-000007「入口をまたぐ共通依頼・結果」の表示状態を、SPEC-000011「複数入口で同じ依頼・結果契約を保つ」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#契機事前条件authority) | 一致 | UI-000007「入口をまたぐ共通依頼・結果」の利用者操作は、SPEC-000011「複数入口で同じ依頼・結果契約を保つ」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000011「複数入口で同じ依頼・結果契約を保つ」の結果を、UI-000007「入口をまたぐ共通依頼・結果」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000011「複数入口で同じ依頼・結果契約を保つ」の失敗理由を、UI-000007「入口をまたぐ共通依頼・結果」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#状態と表示差) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000011「複数入口で同じ依頼・結果契約を保つ」が定める安全な戻り先と未解消義務を、UI-000007「入口をまたぐ共通依頼・結果」の次の行動へ対応付ける。 |
| Authority | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#制約) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#契機事前条件authority) | 一致 | UI-000007「入口をまたぐ共通依頼・結果」の操作可能範囲を、SPEC-000011「複数入口で同じ依頼・結果契約を保つ」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#表示面と情報の優先順位) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000011「複数入口で同じ依頼・結果契約を保つ」の結果・不足・観測不能を、UI-000007「入口をまたぐ共通依頼・結果」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#制約) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#制約) | 一致 | UI-000007「入口をまたぐ共通依頼・結果」とSPEC-000011「複数入口で同じ依頼・結果契約を保つ」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000008／SPEC-000012

共有Context: UX-000013、IA-000009

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#状態と表示差) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#振る舞い状態結果) | 一致 | UI-000008「Workspace接続と利用可能範囲」の表示状態を、SPEC-000012「接続資格からWorkspace利用範囲を確定する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#契機事前条件authority) | 一致 | UI-000008「Workspace接続と利用可能範囲」の利用者操作は、SPEC-000012「接続資格からWorkspace利用範囲を確定する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000012「接続資格からWorkspace利用範囲を確定する」の結果を、UI-000008「Workspace接続と利用可能範囲」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000012「接続資格からWorkspace利用範囲を確定する」の失敗理由を、UI-000008「Workspace接続と利用可能範囲」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#状態と表示差) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000012「接続資格からWorkspace利用範囲を確定する」が定める安全な戻り先と未解消義務を、UI-000008「Workspace接続と利用可能範囲」の次の行動へ対応付ける。 |
| Authority | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#制約) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#契機事前条件authority) | 一致 | UI-000008「Workspace接続と利用可能範囲」の操作可能範囲を、SPEC-000012「接続資格からWorkspace利用範囲を確定する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#表示面と情報の優先順位) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000012「接続資格からWorkspace利用範囲を確定する」の結果・不足・観測不能を、UI-000008「Workspace接続と利用可能範囲」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#制約) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#制約) | 一致 | UI-000008「Workspace接続と利用可能範囲」とSPEC-000012「接続資格からWorkspace利用範囲を確定する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000009／SPEC-000013

共有Context: UX-000014、IA-000010

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#状態と表示差) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#振る舞い状態結果) | 一致 | UI-000009「Meeting・Topic・候補の処置」の表示状態を、SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#契機事前条件authority) | 一致 | UI-000009「Meeting・Topic・候補の処置」の利用者操作は、SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」の結果を、UI-000009「Meeting・Topic・候補の処置」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」の失敗理由を、UI-000009「Meeting・Topic・候補の処置」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#状態と表示差) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」が定める安全な戻り先と未解消義務を、UI-000009「Meeting・Topic・候補の処置」の次の行動へ対応付ける。 |
| Authority | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#制約) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#契機事前条件authority) | 一致 | UI-000009「Meeting・Topic・候補の処置」の操作可能範囲を、SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#表示面と情報の優先順位) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000013「Meeting内容を候補化し所有正本へ昇格する」の結果・不足・観測不能を、UI-000009「Meeting・Topic・候補の処置」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#制約) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#制約) | 一致 | UI-000009「Meeting・Topic・候補の処置」とSPEC-000013「Meeting内容を候補化し所有正本へ昇格する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000010／SPEC-000014

共有Context: UX-000016、IA-000011

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#振る舞い状態結果) | 一致 | UI-000010「Tool・AIモデル構成の選択」の表示状態を、SPEC-000014「Repositoryに適合する標準Toolを解決する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#契機事前条件authority) | 一致 | UI-000010「Tool・AIモデル構成の選択」の利用者操作は、SPEC-000014「Repositoryに適合する標準Toolを解決する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000014「Repositoryに適合する標準Toolを解決する」の結果を、UI-000010「Tool・AIモデル構成の選択」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000014「Repositoryに適合する標準Toolを解決する」の失敗理由を、UI-000010「Tool・AIモデル構成の選択」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000014「Repositoryに適合する標準Toolを解決する」が定める安全な戻り先と未解消義務を、UI-000010「Tool・AIモデル構成の選択」の次の行動へ対応付ける。 |
| Authority | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#契機事前条件authority) | 一致 | UI-000010「Tool・AIモデル構成の選択」の操作可能範囲を、SPEC-000014「Repositoryに適合する標準Toolを解決する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#表示面と情報の優先順位) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000014「Repositoryに適合する標準Toolを解決する」の結果・不足・観測不能を、UI-000010「Tool・AIモデル構成の選択」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#制約) | 一致 | UI-000010「Tool・AIモデル構成の選択」とSPEC-000014「Repositoryに適合する標準Toolを解決する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000010／SPEC-000015

共有Context: UX-000018、IA-000013

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#振る舞い状態結果) | 一致 | UI-000010「Tool・AIモデル構成の選択」の表示状態を、SPEC-000015「AIモデル構成を検証し実効選択を決める」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#契機事前条件authority) | 一致 | UI-000010「Tool・AIモデル構成の選択」の利用者操作は、SPEC-000015「AIモデル構成を検証し実効選択を決める」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000015「AIモデル構成を検証し実効選択を決める」の結果を、UI-000010「Tool・AIモデル構成の選択」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000015「AIモデル構成を検証し実効選択を決める」の失敗理由を、UI-000010「Tool・AIモデル構成の選択」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000015「AIモデル構成を検証し実効選択を決める」が定める安全な戻り先と未解消義務を、UI-000010「Tool・AIモデル構成の選択」の次の行動へ対応付ける。 |
| Authority | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#契機事前条件authority) | 一致 | UI-000010「Tool・AIモデル構成の選択」の操作可能範囲を、SPEC-000015「AIモデル構成を検証し実効選択を決める」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#表示面と情報の優先順位) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000015「AIモデル構成を検証し実効選択を決める」の結果・不足・観測不能を、UI-000010「Tool・AIモデル構成の選択」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#制約) | 一致 | UI-000010「Tool・AIモデル構成の選択」とSPEC-000015「AIモデル構成を検証し実効選択を決める」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000011／SPEC-000005

共有Context: UX-000017、UX-000022、IA-000012、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI-000011「実行時データの保持・清掃」の表示状態を、SPEC-000005「残存資源を清掃し終了後を確認する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI-000011「実行時データの保持・清掃」の利用者操作は、SPEC-000005「残存資源を清掃し終了後を確認する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の結果を、UI-000011「実行時データの保持・清掃」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の失敗理由を、UI-000011「実行時データの保持・清掃」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」が定める安全な戻り先と未解消義務を、UI-000011「実行時データの保持・清掃」の次の行動へ対応付ける。 |
| Authority | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI-000011「実行時データの保持・清掃」の操作可能範囲を、SPEC-000005「残存資源を清掃し終了後を確認する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#表示面と情報の優先順位) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000005「残存資源を清掃し終了後を確認する」の結果・不足・観測不能を、UI-000011「実行時データの保持・清掃」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#制約) | 一致 | UI-000011「実行時データの保持・清掃」とSPEC-000005「残存資源を清掃し終了後を確認する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000011／SPEC-000016

共有Context: UX-000017、UX-000022、IA-000012、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#振る舞い状態結果) | 一致 | UI-000011「実行時データの保持・清掃」の表示状態を、SPEC-000016「実行時データの配置・保持・清掃を制御する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#契機事前条件authority) | 一致 | UI-000011「実行時データの保持・清掃」の利用者操作は、SPEC-000016「実行時データの配置・保持・清掃を制御する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000016「実行時データの配置・保持・清掃を制御する」の結果を、UI-000011「実行時データの保持・清掃」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000016「実行時データの配置・保持・清掃を制御する」の失敗理由を、UI-000011「実行時データの保持・清掃」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000016「実行時データの配置・保持・清掃を制御する」が定める安全な戻り先と未解消義務を、UI-000011「実行時データの保持・清掃」の次の行動へ対応付ける。 |
| Authority | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#契機事前条件authority) | 一致 | UI-000011「実行時データの保持・清掃」の操作可能範囲を、SPEC-000016「実行時データの配置・保持・清掃を制御する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#表示面と情報の優先順位) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000016「実行時データの配置・保持・清掃を制御する」の結果・不足・観測不能を、UI-000011「実行時データの保持・清掃」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#制約) | 一致 | UI-000011「実行時データの保持・清掃」とSPEC-000016「実行時データの配置・保持・清掃を制御する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000012／SPEC-000017

共有Context: UX-000019、UX-000021、IA-000014、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#状態と表示差) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#振る舞い状態結果) | 一致 | UI-000012「Agent間の情報引継ぎと再接続」の表示状態を、SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#契機事前条件authority) | 一致 | UI-000012「Agent間の情報引継ぎと再接続」の利用者操作は、SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」の結果を、UI-000012「Agent間の情報引継ぎと再接続」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」の失敗理由を、UI-000012「Agent間の情報引継ぎと再接続」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#状態と表示差) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」が定める安全な戻り先と未解消義務を、UI-000012「Agent間の情報引継ぎと再接続」の次の行動へ対応付ける。 |
| Authority | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#制約) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#契機事前条件authority) | 一致 | UI-000012「Agent間の情報引継ぎと再接続」の操作可能範囲を、SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#表示面と情報の優先順位) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」の結果・不足・観測不能を、UI-000012「Agent間の情報引継ぎと再接続」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#制約) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#制約) | 一致 | UI-000012「Agent間の情報引継ぎと再接続」とSPEC-000017「Task情報と結果を同じ仕事へ引き継ぎ再取得する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000013／SPEC-000018

共有Context: UX-000020、UX-000031、IA-000015

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#状態と表示差) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#振る舞い状態結果) | 一致 | UI-000013「Runtime信頼判断と公式識別」の表示状態を、SPEC-000018「Runtimeの信頼要素を独立評価する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#契機事前条件authority) | 一致 | UI-000013「Runtime信頼判断と公式識別」の利用者操作は、SPEC-000018「Runtimeの信頼要素を独立評価する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000018「Runtimeの信頼要素を独立評価する」の結果を、UI-000013「Runtime信頼判断と公式識別」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000018「Runtimeの信頼要素を独立評価する」の失敗理由を、UI-000013「Runtime信頼判断と公式識別」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#状態と表示差) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000018「Runtimeの信頼要素を独立評価する」が定める安全な戻り先と未解消義務を、UI-000013「Runtime信頼判断と公式識別」の次の行動へ対応付ける。 |
| Authority | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#制約) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#契機事前条件authority) | 一致 | UI-000013「Runtime信頼判断と公式識別」の操作可能範囲を、SPEC-000018「Runtimeの信頼要素を独立評価する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#表示面と情報の優先順位) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000018「Runtimeの信頼要素を独立評価する」の結果・不足・観測不能を、UI-000013「Runtime信頼判断と公式識別」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#制約) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#制約) | 一致 | UI-000013「Runtime信頼判断と公式識別」とSPEC-000018「Runtimeの信頼要素を独立評価する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000014／SPEC-000019

共有Context: UX-000007、IA-000005

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#状態と表示差) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#振る舞い状態結果) | 一致 | UI-000014「成立済み能力と利用側の確認」の表示状態を、SPEC-000019「責務変更後の利用側閉包を検証する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#契機事前条件authority) | 一致 | UI-000014「成立済み能力と利用側の確認」の利用者操作は、SPEC-000019「責務変更後の利用側閉包を検証する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000019「責務変更後の利用側閉包を検証する」の結果を、UI-000014「成立済み能力と利用側の確認」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000019「責務変更後の利用側閉包を検証する」の失敗理由を、UI-000014「成立済み能力と利用側の確認」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#状態と表示差) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000019「責務変更後の利用側閉包を検証する」が定める安全な戻り先と未解消義務を、UI-000014「成立済み能力と利用側の確認」の次の行動へ対応付ける。 |
| Authority | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#制約) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#契機事前条件authority) | 一致 | UI-000014「成立済み能力と利用側の確認」の操作可能範囲を、SPEC-000019「責務変更後の利用側閉包を検証する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#表示面と情報の優先順位) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000019「責務変更後の利用側閉包を検証する」の結果・不足・観測不能を、UI-000014「成立済み能力と利用側の確認」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#制約) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#制約) | 一致 | UI-000014「成立済み能力と利用側の確認」とSPEC-000019「責務変更後の利用側閉包を検証する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000015／SPEC-000020

共有Context: UX-000023、UX-000026、UX-000029、IA-000016

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#状態と表示差) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#振る舞い状態結果) | 一致 | UI-000015「監査・変更・試験・品質の追跡」の表示状態を、SPEC-000020「変更・監査・試験・品質の閉包を評価する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#契機事前条件authority) | 一致 | UI-000015「監査・変更・試験・品質の追跡」の利用者操作は、SPEC-000020「変更・監査・試験・品質の閉包を評価する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000020「変更・監査・試験・品質の閉包を評価する」の結果を、UI-000015「監査・変更・試験・品質の追跡」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000020「変更・監査・試験・品質の閉包を評価する」の失敗理由を、UI-000015「監査・変更・試験・品質の追跡」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#状態と表示差) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000020「変更・監査・試験・品質の閉包を評価する」が定める安全な戻り先と未解消義務を、UI-000015「監査・変更・試験・品質の追跡」の次の行動へ対応付ける。 |
| Authority | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#制約) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#契機事前条件authority) | 一致 | UI-000015「監査・変更・試験・品質の追跡」の操作可能範囲を、SPEC-000020「変更・監査・試験・品質の閉包を評価する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#表示面と情報の優先順位) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000020「変更・監査・試験・品質の閉包を評価する」の結果・不足・観測不能を、UI-000015「監査・変更・試験・品質の追跡」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#制約) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#制約) | 一致 | UI-000015「監査・変更・試験・品質の追跡」とSPEC-000020「変更・監査・試験・品質の閉包を評価する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000021

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#振る舞い状態結果) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の表示状態を、SPEC-000021「外部送信の同意範囲を検証して送信する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の利用者操作は、SPEC-000021「外部送信の同意範囲を検証して送信する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000021「外部送信の同意範囲を検証して送信する」の結果を、UI-000016「外部送信の同意・持帰り・採否」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000021「外部送信の同意範囲を検証して送信する」の失敗理由を、UI-000016「外部送信の同意・持帰り・採否」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000021「外部送信の同意範囲を検証して送信する」が定める安全な戻り先と未解消義務を、UI-000016「外部送信の同意・持帰り・採否」の次の行動へ対応付ける。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の操作可能範囲を、SPEC-000021「外部送信の同意範囲を検証して送信する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000021「外部送信の同意範囲を検証して送信する」の結果・不足・観測不能を、UI-000016「外部送信の同意・持帰り・採否」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#制約) | 一致 | UI-000016「外部送信の同意・持帰り・採否」とSPEC-000021「外部送信の同意範囲を検証して送信する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000026

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#振る舞い状態結果) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の表示状態を、SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の利用者操作は、SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」の結果を、UI-000016「外部送信の同意・持帰り・採否」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」の失敗理由を、UI-000016「外部送信の同意・持帰り・採否」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」が定める安全な戻り先と未解消義務を、UI-000016「外部送信の同意・持帰り・採否」の次の行動へ対応付ける。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の操作可能範囲を、SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000026「外部処理の結果を元の仕事へ持ち帰る」の結果・不足・観測不能を、UI-000016「外部送信の同意・持帰り・採否」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#制約) | 一致 | UI-000016「外部送信の同意・持帰り・採否」とSPEC-000026「外部処理の結果を元の仕事へ持ち帰る」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000027

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#振る舞い状態結果) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の表示状態を、SPEC-000027「持ち帰った候補を所有正本へ昇格する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の利用者操作は、SPEC-000027「持ち帰った候補を所有正本へ昇格する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000027「持ち帰った候補を所有正本へ昇格する」の結果を、UI-000016「外部送信の同意・持帰り・採否」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000027「持ち帰った候補を所有正本へ昇格する」の失敗理由を、UI-000016「外部送信の同意・持帰り・採否」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000027「持ち帰った候補を所有正本へ昇格する」が定める安全な戻り先と未解消義務を、UI-000016「外部送信の同意・持帰り・採否」の次の行動へ対応付ける。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#契機事前条件authority) | 一致 | UI-000016「外部送信の同意・持帰り・採否」の操作可能範囲を、SPEC-000027「持ち帰った候補を所有正本へ昇格する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000027「持ち帰った候補を所有正本へ昇格する」の結果・不足・観測不能を、UI-000016「外部送信の同意・持帰り・採否」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#制約) | 一致 | UI-000016「外部送信の同意・持帰り・採否」とSPEC-000027「持ち帰った候補を所有正本へ昇格する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000017／SPEC-000022

共有Context: UX-000025、IA-000021

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#状態と表示差) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#振る舞い状態結果) | 一致 | UI-000017「過去情報と現在有効な意図の選択」の表示状態を、SPEC-000022「過去情報と現在有効な意図を区別して解決する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#契機事前条件authority) | 一致 | UI-000017「過去情報と現在有効な意図の選択」の利用者操作は、SPEC-000022「過去情報と現在有効な意図を区別して解決する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000022「過去情報と現在有効な意図を区別して解決する」の結果を、UI-000017「過去情報と現在有効な意図の選択」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000022「過去情報と現在有効な意図を区別して解決する」の失敗理由を、UI-000017「過去情報と現在有効な意図の選択」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#状態と表示差) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000022「過去情報と現在有効な意図を区別して解決する」が定める安全な戻り先と未解消義務を、UI-000017「過去情報と現在有効な意図の選択」の次の行動へ対応付ける。 |
| Authority | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#制約) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#契機事前条件authority) | 一致 | UI-000017「過去情報と現在有効な意図の選択」の操作可能範囲を、SPEC-000022「過去情報と現在有効な意図を区別して解決する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#表示面と情報の優先順位) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000022「過去情報と現在有効な意図を区別して解決する」の結果・不足・観測不能を、UI-000017「過去情報と現在有効な意図の選択」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#制約) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#制約) | 一致 | UI-000017「過去情報と現在有効な意図の選択」とSPEC-000022「過去情報と現在有効な意図を区別して解決する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000018／SPEC-000023

共有Context: UX-000027、UX-000028、IA-000018

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#状態と表示差) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#振る舞い状態結果) | 一致 | UI-000018「文書の物語・構造・図のNavigation」の表示状態を、SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#契機事前条件authority) | 一致 | UI-000018「文書の物語・構造・図のNavigation」の利用者操作は、SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」の結果を、UI-000018「文書の物語・構造・図のNavigation」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」の失敗理由を、UI-000018「文書の物語・構造・図のNavigation」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#状態と表示差) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」が定める安全な戻り先と未解消義務を、UI-000018「文書の物語・構造・図のNavigation」の次の行動へ対応付ける。 |
| Authority | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#制約) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#契機事前条件authority) | 一致 | UI-000018「文書の物語・構造・図のNavigation」の操作可能範囲を、SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#表示面と情報の優先順位) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」の結果・不足・観測不能を、UI-000018「文書の物語・構造・図のNavigation」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#制約) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#制約) | 一致 | UI-000018「文書の物語・構造・図のNavigation」とSPEC-000023「文書の物語・構造・図と工程引継ぎを検査する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000019／SPEC-000024

共有Context: UX-000030、IA-000019

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#状態と表示差) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#振る舞い状態結果) | 一致 | UI-000019「公式素材の由来・権利・用途確認」の表示状態を、SPEC-000024「公式素材の由来・権利・用途を確認する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#契機事前条件authority) | 一致 | UI-000019「公式素材の由来・権利・用途確認」の利用者操作は、SPEC-000024「公式素材の由来・権利・用途を確認する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000024「公式素材の由来・権利・用途を確認する」の結果を、UI-000019「公式素材の由来・権利・用途確認」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000024「公式素材の由来・権利・用途を確認する」の失敗理由を、UI-000019「公式素材の由来・権利・用途確認」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#状態と表示差) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000024「公式素材の由来・権利・用途を確認する」が定める安全な戻り先と未解消義務を、UI-000019「公式素材の由来・権利・用途確認」の次の行動へ対応付ける。 |
| Authority | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#制約) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#契機事前条件authority) | 一致 | UI-000019「公式素材の由来・権利・用途確認」の操作可能範囲を、SPEC-000024「公式素材の由来・権利・用途を確認する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#表示面と情報の優先順位) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000024「公式素材の由来・権利・用途を確認する」の結果・不足・観測不能を、UI-000019「公式素材の由来・権利・用途確認」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#制約) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#制約) | 一致 | UI-000019「公式素材の由来・権利・用途確認」とSPEC-000024「公式素材の由来・権利・用途を確認する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

### UI-000020／SPEC-000030

共有Context: UX-000032、IA-000022

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#状態と表示差) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#振る舞い状態結果) | 一致 | UI-000020「実行記録の依頼と結果確認」の表示状態を、SPEC-000030「実行事実を同じ契約で記録する」の振る舞い状態へ対応付け、未観測・失敗・完了を混同しない。 |
| Trigger | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#契機事前条件authority) | 一致 | UI-000020「実行記録の依頼と結果確認」の利用者操作は、SPEC-000030「実行事実を同じ契約で記録する」の契機と事前条件を満たす場合だけ発火する。 |
| Result | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000030「実行事実を同じ契約で記録する」の結果を、UI-000020「実行記録の依頼と結果確認」が利用者の判断に必要なFeedbackとして欠落なく示す。 |
| Failure | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000030「実行事実を同じ契約で記録する」の失敗理由を、UI-000020「実行記録の依頼と結果確認」が正常・不存在・完了へ丸めず区別する。 |
| Recovery | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#状態と表示差) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000030「実行事実を同じ契約で記録する」が定める安全な戻り先と未解消義務を、UI-000020「実行記録の依頼と結果確認」の次の行動へ対応付ける。 |
| Authority | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#制約) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#契機事前条件authority) | 一致 | UI-000020「実行記録の依頼と結果確認」の操作可能範囲を、SPEC-000030「実行事実を同じ契約で記録する」のAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#表示面と情報の優先順位) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000030「実行事実を同じ契約で記録する」の結果・不足・観測不能を、UI-000020「実行記録の依頼と結果確認」が開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#制約) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#制約) | 一致 | UI-000020「実行記録の依頼と結果確認」とSPEC-000030「実行事実を同じ契約で記録する」は同じ上流制約を保持し、片側だけで実装方式や権限を拡張しない。 |

## 4. 完了条件

- UIの操作ごとにSPECの契機と結果がある。
- SPECの失敗・回復ごとに、直接UIを持つ場合は認識可能なFeedbackがある。
- 表示状態とSystem状態を一対一と仮定しない。
- 一方だけでAuthority、Effect、状態または例外を創作しない。
- 直接UIを持たない振る舞いは理由と運用Feedbackを示す。

## 5. 観点別レビュー結果

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

## 6. CoverageとGap処置

| 区分 | 意味 | 現在の処置 |
|---|---|---|
| Shared | UIの認識・操作・FeedbackとSPECの契機・状態・結果を対応させる | 上記31組を全件確認済み |
| UI-only | 視覚順、色以外の識別、Keyboard、読上げ等 | UI定義で保持し、SPECへ振る舞いを発明しない |
| SPEC-only | 直接UIを持たない振る舞い、内部で完結する契約 | 理由、運用Feedback、人間確認をSPEC定義に残す |
| Gap | 片側または上流のCanonical Contractが不足する | UI／SPEC／IA／UXのOwner工程へ戻す。現在の未解消Gapはない |

## 7. ArchitectureとQualityへの接続

- Architectureの正式入力はUI DefinitionとSPEC Definitionである。この対応レビューは両入力の対応Closureを示すEvidenceであり、第三の仕様ではない。UI工程Exitが未完了の間はArchitectureへの通常Handoffを許可しない。
- UIとSPECはそれぞれQuality Analysisへ入力を渡す。対応レビューから新しいQuality Contractを発明しない。

## 8. 補足分析

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
- [x] 対象Definition集合のSHA-256を固定し、再レビュー入力を再構成できる
- [x] 組別Evidenceの理由を対象UI／SPECの具体的契約事実で説明した
- [x] 未決事項をAI推測で補完していない
