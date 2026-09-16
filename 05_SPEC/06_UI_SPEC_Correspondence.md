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
| 対象改訂版 | UI／SPEC Definition集合 SHA-256: `bc437b08e9229950331e4bcdb2c3771ab8c9222fd07b9281d9d968d8eaae5576` |
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
| State | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000001）「検査前／不備あり／機械確認済み。意味判断は別状態」／SPEC事実（SPEC-000001）「対象と条件を同じ改訂版へ固定して機械検査し、指摘位置・理由・意味判断が必要な範囲を返す。／同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない。」／対応: 事前検査を実行し意味レビューへ案内するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000001）「意味レビュー前に機械判定できる不備を落とす」／SPEC事実（SPEC-000001）「検査対象と条件を受け取った時／事前条件: 検査対象、対象改訂版および検査条件が揃っている」／対応: 事前検査を実行し意味レビューへ案内するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000001）「同じ入力へ同じ指摘と修正可能な場所を返す」／SPEC事実（SPEC-000001）「同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない。」／対応: 事前検査を実行し意味レビューへ案内するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000001）「検査範囲や理由が分からない」／SPEC事実（SPEC-000001）「入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。」／対応: 事前検査を実行し意味レビューへ案内するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000001）「対象→指摘→場所→所有成果物」／SPEC事実（SPEC-000001）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 事前検査を実行し意味レビューへ案内するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000001）「意味レビュー前に機械判定できる不備を落とす。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000001）「検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない」／対応: 事前検査を実行し意味レビューへ案内するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#表示面と情報の優先順位) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000001）「検査対象: 確認する成果物または範囲／検査条件: 適用した機械規則／指摘: 条件に反した観測／修正責任: 正すべき正本」／SPEC事実（SPEC-000001）「正常: 同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない／境界: 検査対象内／対象外、検査可能／検査不能を分け、対象外を変更しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「Repository内容を変更しない読取り検査」と矛盾する結果を返さない」／対応: 事前検査を実行し意味レビューへ案内するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md#制約) | 一致 | UI事実（UI-000001）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000001）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 事前検査を実行し意味レビューへ案内するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000002

共有Context: UX-000002、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「準備中／許可待ち／実行中／停止。権限発行前後を分ける」／SPEC事実（SPEC-000002）「目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。」／対応: UIの権限発行前後とSPECの提案・受理・拒否・blockedを対応させる。Task完了後の上位受入はUI-000004との組が所有し、この組へ含めない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「複数AIへ任せる範囲と権限を理解する」／SPEC事実（SPEC-000002）「目的・受入条件・対象範囲を委任する時／事前条件: 目的、受入条件、許可範囲、担い手候補、判断主体を確認できる」／対応: 委任範囲と権限を確定して受理するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「委任状態・停止理由・回復先を行動可能に示す」／SPEC事実（SPEC-000002）「受理結果から実行対象・未委任判断・完了条件を一意に確認できる。」／対応: SPECの受理結果と未委任判断を、UIの委任状態・停止理由・次の行動として示す。Objective／Milestone受入結果はUI-000004との組が所有する。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「暗黙の範囲拡張や回復不能」／SPEC事実（SPEC-000002）「不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。明示拒否は失敗扱いで再発行せず、判断待ちは未完了として保持する。」／対応: 委任範囲と権限を確定して受理するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「目的→範囲と担い手→許可→実行」／SPEC事実（SPEC-000002）「受理前の拒否またはblockedは提案へ戻せる。」／対応: 受理前に止まった委任を、UIの目的・範囲・担い手の確認へ戻す。受理後の状態再観測と上位受入判断は別の対応組が所有する。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「委任する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000002）「Project運営者が委任範囲を決める。Runtimeは範囲を拡張しない」／対応: 委任範囲と権限を確定して受理するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000002）「目的、作業、決定権限、受入条件を別の対象として示す」／SPEC事実（SPEC-000002）「正常: 受理結果から実行対象・未委任判断・完了条件を一意に確認できる／境界: 委任範囲内／範囲外、判断主体一致／不一致を分け、未委任範囲を受理しない」／対応: UIが示す委任対象・権限・条件を、SPECの受理可否と未委任判断へ対応させる。観測不能と三段階受入はそれぞれ状態照会とUI-000004の組で確認する。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#制約) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000002）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 委任範囲と権限を確定して受理するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000003

共有Context: UX-000003、IA-000002、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）を区別する」／SPEC事実（SPEC-000003）「ready・running・waiting・blocked・completed・failedを観測根拠付きで区別する。」／対応: UIとSPECで同じTask状態を一対一に示す。取消要求・取消完了・取消結果不明はSPEC-000028との組だけが所有する。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「現在の実行状態と必要な判断を確認する」／SPEC事実（SPEC-000003）「受理済みの仕事の状態を照会する時／事前条件: 同じTask識別情報と現在の観測結果がある」／対応: 委任した仕事の状態と判断要否を返すの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「観測時点・停止理由・必要な判断を行動可能に示す」／SPEC事実（SPEC-000003）「同じTaskの現在状態、観測時点、判断要否、次に許される行動を返す。」／対応: SPECが返す観測時点・判断要否・次の行動をUIの状態Feedbackとして示す。取消結果はこの組へ含めない。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「古い観測を進捗・完了と誤認させない」／SPEC事実（SPEC-000003）「観測不能や古い状態を進行中・完了へ推定しない。」／対応: 古いTask観測をUIとSPECの両側で現在状態へ丸めない。取消要求受理の扱いはSPEC-000028との組で確認する。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「Task→現在状態→判断要否→待機・入力へ進める」／SPEC事実（SPEC-000003）「失敗理由と安全な戻り先を返す。」／対応: 状態照会の失敗時は、UIを同じTaskの状態・判断要否・許された次行動へ戻す。取消とRecovery Identityは別契約で処置する。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「状態と判断要否を見る。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000003）「Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない」／対応: 委任した仕事の状態と判断要否を返すに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000002）「作業（Task）、結果（Result）、次の行動（Next Action）を別の対象として示す」／SPEC事実（SPEC-000003）「正常: ready・running・waiting・blocked・completed・failedを観測根拠付きで区別する／境界: Task識別情報一致／不一致、観測済み／観測不能を分け、別Taskの状態を返さない」／対応: exactなTask、現在状態、結果、次の行動だけを状態照会の表示対象とする。Effectと回復義務は取消・回復の組が所有する。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000003](Definitions/SPEC-000003/spec_definition.md#制約) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000003）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 委任した仕事の状態と判断要否を返すとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000028

共有Context: UX-000003、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「取消要求済み、取消完了、取消結果不明・回復必要を区別し、一般の完了・失敗へ畳まない」／SPEC事実（SPEC-000028）「exactなTaskと試行へ取消を一度だけ要求し、外部作用の終了と終了後資源を別々に観測する。／cancelledまたは取消と競合した既存の完了結果を、対象Identity、観測時点および終了後状態付きで確認できる。」／対応: Taskの取消と終了確認の共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「主要な操作・判断として取消すを示す」／SPEC事実（SPEC-000028）「実行中または判断待ちのTaskについて、利用者が取消を選ぶ時／事前条件: 対象の依頼識別情報、Task識別情報、試行識別情報、現在世代、現在状態および作用状態を確認できる」／対応: Taskの取消と終了確認の契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「取消後も観測時点、停止理由、必要な判断を行動可能に示す」／SPEC事実（SPEC-000028）「cancelledまたは取消と競合した既存の完了結果を、対象Identity、観測時点および終了後状態付きで確認できる。」／対応: Taskの取消と終了確認の結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「古い観測や一律表示を進捗・完了と誤認させない」／SPEC事実（SPEC-000028）「対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。」／対応: Taskの取消と終了確認の失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「Task→現在状態→判断要否→待機・入力・取消・回復の導線へ戻れる」／SPEC事実（SPEC-000028）「終了を確認できない場合は同じRecovery Identityへ未解消義務を結び、取消要求を再発行せず回復または再確認へ戻す。」／対応: Taskの取消と終了確認の回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000028）「対象Taskと試行へ限定した取消権限を持つ主体。実行、回復、清掃または別Taskの権限を含まない」／対応: Taskの取消と終了確認に必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000002）「Request、Attempt、Effect、Result、Recovery Obligation、Settlement Observationを別の対象として示す」／SPEC事実（SPEC-000028）「正常: exactなTaskへの取消要求後、Process終了と終了後資源を観測し、取消完了を返す／境界: Task／試行／世代／取消権限の一致と不一致を分け、別対象へ取消を発行しない／観測不能: 不明を取消完了へ丸めず、取消の重複発行と新規Provider作用を0に保つ」／対応: Taskの取消と終了確認に必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000028](Definitions/SPEC-000028/spec_definition.md#制約) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000028）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。取消を回復、清掃または再試行の代替として扱わない。」／対応: Taskの取消と終了確認とUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000002／SPEC-000029

共有Context: UX-000003、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「入力・判断待ちを実行中、停止、完了、失敗と区別する」／SPEC事実（SPEC-000029）「許可された判断または追加入力をexactな判断点へ一度記録し、同じTaskの再開条件を成立させる。／記録した判断、対象Task、判断点、現在世代および次状態を一意に確認できる。」／対応: 判断待ちTaskへの判断返却の共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「主要な操作・判断として判断を返すを示す」／SPEC事実（SPEC-000029）「Taskが特定の人間判断または追加入力を待ち、利用者が回答する時／事前条件: Request、Task、判断点、現在世代、許可された選択肢または入力形式を確認できる」／対応: 判断待ちTaskへの判断返却の契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000002）「判断後も同じTaskの現在状態と必要な次行動を示す」／SPEC事実（SPEC-000029）「記録した判断、対象Task、判断点、現在世代および次状態を一意に確認できる。」／対応: 判断待ちTaskへの判断返却の結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#操作とfeedback) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「古い観測や一律表示を進捗・完了と誤認させない」／SPEC事実（SPEC-000029）「古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。」／対応: 判断待ちTaskへの判断返却の失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#状態と表示差) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000002）「Task→現在状態→判断要否→入力→同じTaskの状態確認へ戻れる」／SPEC事実（SPEC-000029）「記録後に再開結果を観測できない場合は、判断を重複記録せず同じTaskの状態照会または回復へ戻す。」／対応: 判断待ちTaskへの判断返却の回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000029）「その判断点へ結合した人間の決定権限。委任範囲、Provider実行、取消、回復または別判断点の権限を含まない」／対応: 判断待ちTaskへの判断返却に必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#表示面と情報の優先順位) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000002）「Task、決定権限、Request、Attempt、Result、Next Actionを別の対象として示す」／SPEC事実（SPEC-000029）「正常: exactな判断点へ許可された判断を記録し、同じTaskを再開可能にする／境界: Task／判断点／世代／決定権限の一致と不一致を分け、別対象へ判断を適用しない／観測不能: 判断記録済みか不明な時に重複記録または新規Task作成を行わない」／対応: 判断待ちTaskへの判断返却に必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000002](../04_UI/Definitions/UI-000002/ui_definition.md#制約) | [SPEC-000029](Definitions/SPEC-000029/spec_definition.md#制約) | 一致 | UI事実（UI-000002）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000029）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。判断返却を委任、取消、回復または採用判断へ流用しない。」／対応: 判断待ちTaskへの判断返却とUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000003／SPEC-000004

共有Context: UX-000004、UX-000022、IA-000003、IA-000012

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000003）「失敗後の作用なし、作用済み、作用不明と、回復要否を区別する」／SPEC事実（SPEC-000004）「同一依頼、外部作用の状態、回復義務、現在権限を照合し、状態確認・回復・再試行を分類する。／作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す。」／対応: 失敗後の再試行と回復を安全に選別するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000003）「主要操作として再試行または回復を選ぶ」／SPEC事実（SPEC-000004）「失敗・取消・切断後に継続方法を選ぶ時／事前条件: 同じ依頼、試行、Effect状態、回復義務、現在Grantを照合できる」／対応: 失敗後の再試行と回復を安全に選別するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000003）「外部作用状態、回復対象の識別情報、終了条件を示す」／SPEC事実（SPEC-000004）「作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す。」／対応: 失敗後の再試行と回復を安全に選別するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000003）「結果不明の処理を新規実行して外部作用を二重実行させない」／SPEC事実（SPEC-000004）「古い権限、曖昧な識別情報、作用不明では再発行を拒否する。」／対応: 失敗後の再試行と回復を安全に選別するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000003）「失敗→作用状態→同じ依頼の結果→回復処置または再試行へ進める」／SPEC事実（SPEC-000004）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 失敗後の再試行と回復を安全に選別するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000003）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000004）「回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない」／対応: 失敗後の再試行と回復を安全に選別するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#表示面と情報の優先順位) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000003）「Request、Attempt、Effect、Result、Recovery Obligation、Recovery Actionを別の対象として示す」／SPEC事実（SPEC-000004）「正常: 作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す／境界: Effectなし／成立済み／不明、回復Identity一致／曖昧を分け、不明時に再実行しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る」と矛盾する結果を返さない」／対応: 失敗後の再試行と回復を安全に選別するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000004](Definitions/SPEC-000004/spec_definition.md#制約) | 一致 | UI事実（UI-000003）「表示の都合で状態、根拠、対象範囲または開示境界を弱めない」／SPEC事実（SPEC-000004）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 失敗後の再試行と回復を安全に選別するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000003／SPEC-000005

共有Context: UX-000022、IA-000003、IA-000012

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000003）「残存の存在、不存在、観測不能と、回復可能、清掃可能を区別する」／SPEC事実（SPEC-000005）「回復義務と清掃処置を同じ識別情報へ結合し、処置後に不存在または安全な終了を再観測する。／処置の発行だけで完了せず、終了後確認によって義務を解消する。」／対応: 残存資源を清掃し終了後を確認するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000003）「主要操作として残存資源を清掃する」／SPEC事実（SPEC-000005）「回復または清掃可能と分類された残存を処置する時／事前条件: exact Recovery Identity、清掃可能判定、対象Rootを確認できる」／対応: 残存資源を清掃し終了後を確認するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000003）「残存、観測不能、不存在を区別して示す」／SPEC事実（SPEC-000005）「処置の発行だけで完了せず、終了後確認によって義務を解消する。」／対応: 残存資源を清掃し終了後を確認するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000003）「名前や経過時間だけで由来不明物を削除させない」／SPEC事実（SPEC-000005）「由来不明、参照中、観測不能は削除せず、義務を保持する。」／対応: 残存資源を清掃し終了後を確認するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000003）「停止→残存観測→同じRecovery Identity→清掃→不存在確認→義務解消へ進める」／SPEC事実（SPEC-000005）「応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。」／対応: 残存資源を清掃し終了後を確認するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000003）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000005）「回復義務に結合した清掃Capabilityを持つ運用者またはRuntime」／対応: 残存資源を清掃し終了後を確認するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#表示面と情報の優先順位) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000003）「Data Item、Retention、Recovery Obligation、Cleanup Evidenceを別の対象として示す」／SPEC事実（SPEC-000005）「正常: 処置の発行だけで完了せず、終了後確認によって義務を解消する／境界: 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない」／対応: 残存資源を清掃し終了後を確認するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000003](../04_UI/Definitions/UI-000003/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#制約) | 一致 | UI事実（UI-000003）「表示の都合で状態、根拠、対象範囲または開示境界を弱めない」／SPEC事実（SPEC-000005）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 残存資源を清掃し終了後を確認するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000004／SPEC-000002

共有Context: UX-000005、IA-000002

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「Task完了／Objective受入／Milestone受入を別にする」／SPEC事実（SPEC-000002）「目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。／受理結果から実行対象・未委任判断・完了条件を一意に確認でき、Task完了、Objective受入、Milestone受入を別の判断として保持する。」／対応: 委任範囲と権限を確定して受理するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「目的と受入条件で節目を委ねる」／SPEC事実（SPEC-000002）「目的・受入条件・対象範囲を委任する時／事前条件: 目的、受入条件、許可範囲、担い手候補、判断主体を確認できる」／対応: 委任範囲と権限を確定して受理するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「委任範囲、受理状態、統合・品質・判断待ちを分けて示す」／SPEC事実（SPEC-000002）「受理結果から実行対象・未委任判断・完了条件を一意に確認でき、Task完了、Objective受入、Milestone受入を別の判断として保持する。」／対応: 委任範囲と権限を確定して受理するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「タスク件数または依頼受付だけを完成と誤認する」／SPEC事実（SPEC-000002）「不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。明示拒否は失敗扱いで再発行せず、判断待ちは未完了として保持する。」／対応: 委任範囲と権限を確定して受理するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「Milestone→目的と受入条件→Task根拠→受入判断」／SPEC事実（SPEC-000002）「受理前の拒否またはblockedは提案へ戻せる。受理後の結果不明は同じ依頼識別情報の再観測へ戻し、Task完了後の受入判断待ちは対応するObjectiveまたはMilestoneの判断へ戻す。」／対応: 委任範囲と権限を確定して受理するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「目的と受入条件で節目を委ねる。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000002）「Project運営者が委任範囲を決める。Runtimeは範囲を拡張しない」／対応: 委任範囲と権限を確定して受理するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000004）「プロジェクト（Project）: 継続する活動の境界／節目（Milestone）: 人が委ね受入を判断する到達点／目的（Objective）: Milestoneを成立させる目的／作業（Task）: 実行可能な仕事単位／決定権限: 誰が何を決められるか／受入条件: 上位成果を受け入れる条件」／SPEC事実（SPEC-000002）「正常: 受理結果から実行対象・未委任判断・完了条件を一意に確認できる／境界: 委任範囲内／範囲外、判断主体一致／不一致を分け、未委任範囲を受理しない／観測不能: 受理後の観測不能を結果不明として同じ依頼識別情報へ結合し、未発行・完了・新規Taskへ丸めず再観測する／完成段階: Task完了、Objective受入、Milestone受入を別の状態・判断として保持し、下位完了から上位受入を推定しない」／対応: 委任範囲と権限を確定して受理するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000002](Definitions/SPEC-000002/spec_definition.md#制約) | 一致 | UI事実（UI-000004）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000002）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 委任範囲と権限を確定して受理するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000004／SPEC-000006

共有Context: UX-000005、UX-000009、IA-000002、IA-000006

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）を区別する」／SPEC事実（SPEC-000006）「部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる。」／対応: UIの完全・部分・制限・古さ・競合・不明を、SPECのCoverageとFreshnessを持つ読取り投影へ対応させる。三段階受入はSPEC-000002との組だけが所有する。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「プロジェクトの現在地を根拠と不完全性付きで理解する」／SPEC事実（SPEC-000006）「Projectまたは節目の現在地を照会する時／事前条件: Project IDと許可された情報源を解決できる」／対応: UIで現在地を確認する操作を、SPECのProject IDと許可Sourceを使う読取り契機へ限定する。節目の委任操作はSPEC-000002との組で確認する。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「根拠、不完全性、観測時点を同時に示す」／SPEC事実（SPEC-000006）「部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる。」／対応: SPECの部分投影、Source、Coverage、FreshnessをUIの根拠・不完全性・観測時点として示す。委任受理結果はこの組へ含めない。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「欠測や古い値を完全な現在値と誤認することを避ける」／SPEC事実（SPEC-000006）「競合・欠測・開示制限を正常値で補完しない。」／対応: UIとSPECの両側で、欠測・古さ・競合・制限を完全な現在値へ補完しない。Task件数による上位完成誤認はSPEC-000002との組で確認する。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「プロジェクト→現在投影→不足・競合→情報源→次の判断へ戻れる」／SPEC事実（SPEC-000006）「失敗理由と安全な戻り先を返す。」／対応: 投影が不完全な場合は、UIを不足・競合・Sourceの確認へ戻す。Milestone受入判断への導線はSPEC-000002との組が所有する。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「プロジェクトの現在地を根拠と不完全性付きで理解し、UIだけに正本変更権限を持たせない」／SPEC事実（SPEC-000006）「Project情報を閲覧できる主体。投影は正本変更Authorityを持たない」／対応: UIの現在地確認をSPECの読取りAuthorityだけへ限定し、委任・受入Authorityをこの組へ流用しない。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000004）「プロジェクト、リポジトリ、読取り投影、対象範囲を別の対象として示す」／SPEC事実（SPEC-000006）「正常: 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる／境界: Project一致／不一致、完全／欠測／古い／競合を分け、別Projectの情報を混ぜない」／対応: UIのProject・Repository・Projection・CoverageをSPECのSource・Coverage・Freshnessへ接続し、委任の目的・権限・受入条件はこの組へ含めない。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000006](Definitions/SPEC-000006/spec_definition.md#制約) | 一致 | UI事実（UI-000004）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000006）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Projectと節目の現在状態を投影するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000004／SPEC-000007

共有Context: UX-000015、IA-000006

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「complete／partial／開示制限（restricted）／stale／競合あり（conflicting）」／SPEC事実（SPEC-000007）「Projectごとの網羅範囲、観測時点、重要差、根拠を保った比較結果を返す。／比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す。」／対応: 複数Projectを比較可能な投影へ統合するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「複数プロジェクトを根拠付きで比較する」／SPEC事実（SPEC-000007）「許可された複数Projectを比較する時／事前条件: 比較対象Projectごとの閲覧許可とCoverageを確認できる」／対応: 複数Projectを比較可能な投影へ統合するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000004）「比較値から根拠・古さ・不足へ戻れる」／SPEC事実（SPEC-000007）「比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す。」／対応: 複数Projectを比較可能な投影へ統合するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#操作とfeedback) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「単一Scoreや欠測した集計で健全性を断定する」／SPEC事実（SPEC-000007）「非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。」／対応: 複数Projectを比較可能な投影へ統合するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#状態と表示差) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000004）「Portfolio→差→対象範囲（Coverage）→Project→情報源（Source）」／SPEC事実（SPEC-000007）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 複数Projectを比較可能な投影へ統合するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000004）「複数プロジェクトを根拠付きで比較する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000007）「各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない」／対応: 複数Projectを比較可能な投影へ統合するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#表示面と情報の優先順位) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000004）「プロジェクト（Project）: 論理的な案件・活動／リポジトリ（Repository）: Projectの一部を所有する正本境界／結合情報（Binding）: Repositoryと検証済みRootの結合／プロジェクト項目: リポジトリが正本として所有する文書その他の項目／読取り投影（Projection）: 正本から導出した読取りView／対象範囲（Coverage）: 投影が扱えた範囲」／SPEC事実（SPEC-000007）「正常: 比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す／境界: 閲覧可能／非開示、Coverage同等／相違を分け、非開示Projectの存在を漏らさない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、非開示Projectを探索・変更しない」と矛盾する結果を返さない」／対応: 複数Projectを比較可能な投影へ統合するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000004](../04_UI/Definitions/UI-000004/ui_definition.md#制約) | [SPEC-000007](Definitions/SPEC-000007/spec_definition.md#制約) | 一致 | UI事実（UI-000004）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000007）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 複数Projectを比較可能な投影へ統合するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000005／SPEC-000008

共有Context: UX-000006、IA-000004

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000005）「観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別」／SPEC事実（SPEC-000008）「利用可能な実行記録から観測事実、未観測、評価、改善候補、出所、観測時点を区別して返す。／評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる。」／対応: 実行事実と評価を区別して取得するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000005）「実行事実を出所と観測時点付きで比較する」／SPEC事実（SPEC-000008）「実行結果を振り返る時／事前条件: 取得対象とする実行、情報源、観測時点を確認できる」／対応: 実行事実と評価を区別して取得するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000005）「出所・時点・観測状態を保持する」／SPEC事実（SPEC-000008）「評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる。」／対応: 実行事実と評価を区別して取得するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000005）「未観測を0または正常へ畳む」／SPEC事実（SPEC-000008）「欠測を正常値へ補完せず、評価を観測事実として返さない。」／対応: 実行事実と評価を区別して取得するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000005）「実行→観測→根拠→評価→改善候補」／SPEC事実（SPEC-000008）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 実行事実と評価を区別して取得するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000005）「実行事実を出所と観測時点付きで比較する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000008）「実行記録を閲覧できる主体。評価の閲覧は評価採用Authorityを含まない」／対応: 実行事実と評価を区別して取得するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#表示面と情報の優先順位) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000005）「実行（Execution）: 一回の実行／観測（Observation）: 観測した値と観測状態／情報源（Source）: 観測元／評価（Assessment）: 事実に対する評価／改善候補（Improvement Candidate）: 改善候補」／SPEC事実（SPEC-000008）「正常: 評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる／境界: 観測済み／未観測／不明、事実／評価を分け、欠測を正常値へ補完しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用。実行記録、対象Task、Providerを変更しない」と矛盾する結果を返さない」／対応: 実行事実と評価を区別して取得するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000008](Definitions/SPEC-000008/spec_definition.md#制約) | 一致 | UI事実（UI-000005）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000008）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 実行事実と評価を区別して取得するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000005／SPEC-000009

共有Context: UX-000008、IA-000020

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000005）「各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける」／SPEC事実（SPEC-000009）「認証・起動・実行・取消・結果搬送・回復の観測点を相関し、故障位置と残る利用可能範囲を返す。／原因未確定と確定済みを分け、Providerごとの差を保持する。」／対応: 実行基盤の故障境界と利用可能範囲を診断するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000005）「故障した境界と影響する能力を特定する」／SPEC事実（SPEC-000009）「AI実行環境の処理が停止または失敗した時／事前条件: 診断対象、境界ごとのCorrelation ID、許可されたProbeを確認できる」／対応: 実行基盤の故障境界と利用可能範囲を診断するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000005）「失敗した場所・影響範囲・利用可能性を分ける」／SPEC事実（SPEC-000009）「原因未確定と確定済みを分け、Providerごとの差を保持する。」／対応: 実行基盤の故障境界と利用可能範囲を診断するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#操作とfeedback) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000005）「一律の失敗表示で無関係な能力まで停止する」／SPEC事実（SPEC-000009）「一つの失敗から全機能停止や原因を断定しない。」／対応: 実行基盤の故障境界と利用可能範囲を診断するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#状態と表示差) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000005）「故障→境界→影響する能力→継続可能範囲→回復」／SPEC事実（SPEC-000009）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 実行基盤の故障境界と利用可能範囲を診断するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000005）「故障した境界と影響する能力を特定する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000009）「運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない」／対応: 実行基盤の故障境界と利用可能範囲を診断するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#表示面と情報の優先順位) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000005）「実行基盤: AIによる仕事を成立させる外部環境／境界: 認証、起動、取消、結果取得、回復のどこを確認したか／故障: 成立しなかった境界と観測根拠／利用可能能力: 故障後も続けられる仕事／回復経路: 故障した境界を安全に戻す方法」／SPEC事実（SPEC-000009）「正常: 原因未確定と確定済みを分け、Providerごとの差を保持する／境界: 診断対象内／対象外、原因確定／未確定を分け、診断から修復Effectを発行しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない」と矛盾する結果を返さない」／対応: 実行基盤の故障境界と利用可能範囲を診断するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000005](../04_UI/Definitions/UI-000005/ui_definition.md#制約) | [SPEC-000009](Definitions/SPEC-000009/spec_definition.md#制約) | 一致 | UI事実（UI-000005）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000009）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 実行基盤の故障境界と利用可能範囲を診断するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000006／SPEC-000010

共有Context: UX-000010、UX-000011、IA-000006、IA-000007

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#状態と表示差) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000006）「確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）／手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能」／SPEC事実（SPEC-000010）「検証済みRepository Root、Repository ID、Project ID、Binding、現在改訂版を区別して対象を解決する。／横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。」／対応: Repositoryと実行対象のBindingを解決するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000006）「現在リポジトリだけで日常作業を完結する／プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する」／SPEC事実（SPEC-000010）「手元のRepositoryで作業を開始し対象を選ぶ時／事前条件: 開始PathからRepository境界を一意に検証できる」／対応: Repositoryと実行対象のBindingを解決するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000006）「手元を既定にし横断を任意に保つ／各識別情報と物理基点フォルダの結合を明示する」／SPEC事実（SPEC-000010）「横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。」／対応: Repositoryと実行対象のBindingを解決するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#操作とfeedback) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000006）「CROS未設定で手元作業まで止まる／同名や近いパスを同じ対象と誤認する」／SPEC事実（SPEC-000010）「名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。」／対応: Repositoryと実行対象のBindingを解決するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#状態と表示差) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000006）「Project→Repository→Binding→検証済みRoot／Repository→手元の正本→作業、必要時だけCROS」／SPEC事実（SPEC-000010）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: Repositoryと実行対象のBindingを解決するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#制約) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000006）「現在リポジトリだけで日常作業を完結する／プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000010）「現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない」／対応: Repositoryと実行対象のBindingを解決するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#表示面と情報の優先順位) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000006）「プロジェクト（Project）: 論理的な案件・活動／リポジトリ（Repository）: Projectの一部を所有する正本境界／結合情報（Binding）: Repositoryと検証済みRootの結合／プロジェクト項目: リポジトリが正本として所有する文書その他の項目／読取り投影（Projection）: 正本から導出した読取りView／対象範囲（Coverage）: 投影が扱えた範囲／手元の情報（Local Context）: 現在Repositoryが所有する正本／手元の作業（Local Work）: 手元で開始・完了できる仕事／リポジトリ横断情報源（Cross-repository Source）: CROSから得る追加情報／履歴管理能力（Version Control Capability）: 履歴を扱う差替可能な能力」／SPEC事実（SPEC-000010）「正常: 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる／境界: 検証済みRoot／隣接Root、Binding一意／曖昧を分け、別Repositoryを選ばない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象解決は読取り専用で、Repository・worktree・Git状態を変更しない」と矛盾する結果を返さない」／対応: Repositoryと実行対象のBindingを解決するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000006](../04_UI/Definitions/UI-000006/ui_definition.md#制約) | [SPEC-000010](Definitions/SPEC-000010/spec_definition.md#制約) | 一致 | UI事実（UI-000006）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000010）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Repositoryと実行対象のBindingを解決するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000007／SPEC-000011

共有Context: UX-000012、IA-000008

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#状態と表示差) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000007）「受付前／受付済み／作用前失敗／作用後失敗／結果あり」／SPEC事実（SPEC-000011）「通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。／入口の違いでAuthorityや結果の意味が変わらない。」／対応: 複数入口で同じ依頼・結果契約を保つの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000007）「通信方式を変えても同じ公開契約・入力・権限判断で操作する」／SPEC事実（SPEC-000011）「stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時／事前条件: 公開Application契約へ適合する入力と利用可能なTransportがある」／対応: 複数入口で同じ依頼・結果契約を保つの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000007）「公開契約・入力・権限判断・状態・結果を通信方式間で一致させる」／SPEC事実（SPEC-000011）「入口の違いでAuthorityや結果の意味が変わらない。」／対応: 複数入口で同じ依頼・結果契約を保つの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#操作とfeedback) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000007）「通信方式によって入力・権限判断・状態・結果の意味が変わる」／SPEC事実（SPEC-000011）「Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。」／対応: 複数入口で同じ依頼・結果契約を保つの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#状態と表示差) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000007）「入口→同じ公開要求→Runtime→同じ結果」／SPEC事実（SPEC-000011）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 複数入口で同じ依頼・結果契約を保つの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#制約) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000007）「通信方式を変えても同じ公開契約・入力・権限判断で操作する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000011）「呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない」／対応: 複数入口で同じ依頼・結果契約を保つに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#表示面と情報の優先順位) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000007）「公開依頼（Public Request）: 外部Actorの意図／公開契約（Public Contract）: 入力と結果の意味／通信手段（Transport）: 意味を運ぶ通信方式／作用状態（Effect State）: 作用発行の有無／公開結果（Public Result）: 利用者へ返る結果」／SPEC事実（SPEC-000011）「正常: 入口の違いでAuthorityや結果の意味が変わらない／境界: 対応Transport／未対応Transport、同義入力／不正入力を分け、入口固有値で意味を変えない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する」と矛盾する結果を返さない」／対応: 複数入口で同じ依頼・結果契約を保つに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000007](../04_UI/Definitions/UI-000007/ui_definition.md#制約) | [SPEC-000011](Definitions/SPEC-000011/spec_definition.md#制約) | 一致 | UI事実（UI-000007）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000011）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 複数入口で同じ依頼・結果契約を保つとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000008／SPEC-000012

共有Context: UX-000013、IA-000009

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#状態と表示差) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000008）「利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）」／SPEC事実（SPEC-000012）「接続資格を検証し、現在有効なWorkspace GrantとRepository Exposureから利用可能範囲を確定する。／System管理能力と内容閲覧権限を別に判定する。」／対応: 接続資格からWorkspace利用範囲を確定するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000008）「許可された作業領域だけへ接続する」／SPEC事実（SPEC-000012）「リモート接続を開始または再接続する時／事前条件: 接続資格を検証でき、WorkspaceとRepository Exposureが現行である」／対応: 接続資格からWorkspace利用範囲を確定するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000008）「現在の利用許可範囲（Grant）だけを開示し不足を補完しない」／SPEC事実（SPEC-000012）「System管理能力と内容閲覧権限を別に判定する。」／対応: 接続資格からWorkspace利用範囲を確定するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#操作とfeedback) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000008）「利用不能なリポジトリの存在や内容を推測表示する」／SPEC事実（SPEC-000012）「未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。」／対応: 接続資格からWorkspace利用範囲を確定するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#状態と表示差) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000008）「接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源」／SPEC事実（SPEC-000012）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 接続資格からWorkspace利用範囲を確定するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#制約) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000008）「許可された作業領域だけへ接続する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000012）「Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する」／対応: 接続資格からWorkspace利用範囲を確定するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#表示面と情報の優先順位) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000008）「接続資格（Connection Credential）: 接続を認証する資格／接続中の作業単位（Session）: 一回の接続文脈／利用可能領域（Workspace Grant）: 接続中の作業単位（Session）が利用できる作業領域集合／作業領域（Workspace）: Repository公開のまとまり／公開関係（Exposure）: RepositoryをWorkspaceへ公開する関係／管理能力（System Capability）: サーバー（Server）の管理能力」／SPEC事実（SPEC-000012）「正常: System管理能力と内容閲覧権限を別に判定する／境界: 有効／期限切れCredential、Exposureあり／なしを分け、非開示対象の存在を返さない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0」と矛盾する結果を返さない」／対応: 接続資格からWorkspace利用範囲を確定するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000008](../04_UI/Definitions/UI-000008/ui_definition.md#制約) | [SPEC-000012](Definitions/SPEC-000012/spec_definition.md#制約) | 一致 | UI事実（UI-000008）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000012）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 接続資格からWorkspace利用範囲を確定するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000009／SPEC-000013

共有Context: UX-000014、IA-000010

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#状態と表示差) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000009）「観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける」／SPEC事実（SPEC-000013）「観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。／候補の出所、判断者、採否、反映先を辿れる。」／対応: Meeting内容を候補化し所有正本へ昇格するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000009）「会議の内容を候補として整理し正本へつなぐ」／SPEC事実（SPEC-000013）「Meetingの項目を継続論点または決定候補として扱う時／事前条件: Meeting Item、出所、候補種別、所有正本、判断主体を確認できる」／対応: Meeting内容を候補化し所有正本へ昇格するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000009）「候補・判断・反映結果を区別する」／SPEC事実（SPEC-000013）「候補の出所、判断者、採否、反映先を辿れる。」／対応: Meeting内容を候補化し所有正本へ昇格するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#操作とfeedback) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000009）「会議記録が自動的に正本へ昇格する」／SPEC事実（SPEC-000013）「文字列一致だけで統合・分割せず、会話を自動採用しない。」／対応: Meeting内容を候補化し所有正本へ昇格するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#状態と表示差) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000009）「Meeting→Item→候補→既存Topic比較→採否→所有正本」／SPEC事実（SPEC-000013）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: Meeting内容を候補化し所有正本へ昇格するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#制約) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000009）「会議の内容を候補として整理し正本へつなぐ。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000013）「候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする」／対応: Meeting内容を候補化し所有正本へ昇格するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#表示面と情報の優先順位) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000009）「会議（Meeting）: 時間境界を持つ対話／会議項目（Meeting Item）: 会議内の観察・問い・判断候補／候補（Candidate）: 正本更新前の提案／論点（Topic）: 継続して扱う論点／関係（Relation）: 同一・関連・派生等の判断／判断（Decision）: 採用・却下・保留」／SPEC事実（SPEC-000013）「正常: 候補の出所、判断者、採否、反映先を辿れる／境界: 新規候補／既存候補、採用／却下／保留を分け、未採用候補で正本を変更しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0」と矛盾する結果を返さない」／対応: Meeting内容を候補化し所有正本へ昇格するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000009](../04_UI/Definitions/UI-000009/ui_definition.md#制約) | [SPEC-000013](Definitions/SPEC-000013/spec_definition.md#制約) | 一致 | UI事実（UI-000009）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000013）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Meeting内容を候補化し所有正本へ昇格するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000010／SPEC-000014

共有Context: UX-000016、IA-000011

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000010）「利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）」／SPEC事実（SPEC-000014）「登録能力、利用可否、固定改訂版、配布根拠、必要Authorityを照合して利用候補を返す。／未登録能力を推測せず、版不一致や欠落を明示する。」／対応: Repositoryに適合する標準Toolを解決するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000010）「固定Commitに対応するツール／実行基盤と利用可能性を知る」／SPEC事実（SPEC-000014）「目的に合う標準Toolを選ぶ時／事前条件: Repositoryの固定改訂版、登録済み能力、配布根拠を読める」／対応: Repositoryに適合する標準Toolを解決するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000010）「Commit・配布集合・Manifest・実行基盤の対応を検証する」／SPEC事実（SPEC-000014）「未登録能力を推測せず、版不一致や欠落を明示する。」／対応: Repositoryに適合する標準Toolを解決するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000010）「版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する」／SPEC事実（SPEC-000014）「Tool一覧の閲覧だけで実行Authorityを発行しない。」／対応: Repositoryに適合する標準Toolを解決するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000010）「仕事→必要能力→登録Tool→配布根拠→起動」／SPEC事実（SPEC-000014）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: Repositoryに適合する標準Toolを解決するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000010）「固定Commitに対応するツール／実行基盤と利用可能性を知る。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000014）「Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない」／対応: Repositoryに適合する標準Toolを解決するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#表示面と情報の優先順位) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000010）「利用能力（Capability）: Toolが提供する仕事上の能力／利用可否（Availability）: 現在利用可能か／実行権限（Authority）: 実行時に許される作用／配布物（Distribution）: 配布単位／配布目録（Manifest）: 配布内容と根拠／実行環境との結合（Runtime Binding）: 配布と実行環境の結合」／SPEC事実（SPEC-000014）「正常: 未登録能力を推測せず、版不一致や欠落を明示する／境界: 登録済み／未登録能力、改訂版一致／不一致を分け、候補提示から実行Authorityを発行しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用で候補を返し、Toolまたは配布物を実行・変更しない」と矛盾する結果を返さない」／対応: Repositoryに適合する標準Toolを解決するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000014](Definitions/SPEC-000014/spec_definition.md#制約) | 一致 | UI事実（UI-000010）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000014）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Repositoryに適合する標準Toolを解決するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000010／SPEC-000015

共有Context: UX-000018、IA-000013

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000010）「有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）」／SPEC事実（SPEC-000015）「許可値、利用可能性、用途、費用・品質制約、優先順位を検証し、実効選択と再選定条件を返す。／コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。」／対応: AIモデル構成を検証し実効選択を決めるの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000010）「AIモデル選択を検証可能な構成として更新する」／SPEC事実（SPEC-000015）「AIモデル構成を読込み、更新または選択する時／事前条件: 構成Candidate、許可値、利用可能性、用途、優先順位を確認できる」／対応: AIモデル構成を検証し実効選択を決めるの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000010）「構成変更を検証し実効選択を観測可能にする」／SPEC事実（SPEC-000015）「コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。」／対応: AIモデル構成を検証し実効選択を決めるの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#操作とfeedback) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000010）「未知または非対応のモデルを実行可能と表示する」／SPEC事実（SPEC-000015）「未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。」／対応: AIモデル構成を検証し実効選択を決めるの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#状態と表示差) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000010）「設定→検証→利用可能候補→選択→理由・再選定条件」／SPEC事実（SPEC-000015）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: AIモデル構成を検証し実効選択を決めるの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000010）「AIモデル選択を検証可能な構成として更新する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000015）「構成管理者が更新を採用し、Runtimeが検証済み構成から選択する」／対応: AIモデル構成を検証し実効選択を決めるに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#表示面と情報の優先順位) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000010）「AIモデル（Model）: 利用候補のAIモデル／構成（Configuration）: 許可候補と制約／作業上の役割（Task Role）: 実行・確認等の必要役割／利用可否（Availability）: 現在利用可能か／選択結果（Selection）: 今回の実効選択／再選定条件（Fallback Condition）: 再選定する条件」／SPEC事実（SPEC-000015）「正常: コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる／境界: 許可値／未知値、利用可能／利用不能を分け、不正構成を暗黙fallbackしない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ構成を保存する。選択はProvider実行Effectを発行しない」と矛盾する結果を返さない」／対応: AIモデル構成を検証し実効選択を決めるに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000010](../04_UI/Definitions/UI-000010/ui_definition.md#制約) | [SPEC-000015](Definitions/SPEC-000015/spec_definition.md#制約) | 一致 | UI事実（UI-000010）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000015）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: AIモデル構成を検証し実効選択を決めるとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000011／SPEC-000005

共有Context: UX-000017、UX-000022、IA-000012、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000011）「残存の存在、不存在、観測不能と、回復可能、清掃可能を区別する」／SPEC事実（SPEC-000005）「回復義務と清掃処置を同じ識別情報へ結合し、処置後に不存在または安全な終了を再観測する。／処置の発行だけで完了せず、終了後確認によって義務を解消する。」／対応: 残存資源を清掃し終了後を確認するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000011）「保持内容を確認して清掃するか保留する」／SPEC事実（SPEC-000005）「回復または清掃可能と分類された残存を処置する時／事前条件: exact Recovery Identity、清掃可能判定、対象Rootを確認できる」／対応: 残存資源を清掃し終了後を確認するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000011）「残存、観測不能、不存在を区別して示す」／SPEC事実（SPEC-000005）「処置の発行だけで完了せず、終了後確認によって義務を解消する。」／対応: 残存資源を清掃し終了後を確認するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000011）「名前や経過時間だけで由来不明物を削除させない」／SPEC事実（SPEC-000005）「由来不明、参照中、観測不能は削除せず、義務を保持する。」／対応: 残存資源を清掃し終了後を確認するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000011）「同じRecovery Identityで清掃し、不存在確認後に義務を解消する」／SPEC事実（SPEC-000005）「応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。」／対応: 残存資源を清掃し終了後を確認するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000011）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000005）「回復義務に結合した清掃Capabilityを持つ運用者またはRuntime」／対応: 残存資源を清掃し終了後を確認するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#表示面と情報の優先順位) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000011）「Recovery Obligation、Cleanup Evidence、Settlement Observationを別の対象として示す」／SPEC事実（SPEC-000005）「正常: 処置の発行だけで完了せず、終了後確認によって義務を解消する／境界: 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない」／対応: 残存資源を清掃し終了後を確認するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000005](Definitions/SPEC-000005/spec_definition.md#制約) | 一致 | UI事実（UI-000011）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000005）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 残存資源を清掃し終了後を確認するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000011／SPEC-000016

共有Context: UX-000017、UX-000022、IA-000012、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000011）「一時、保持必要、回復必要、清掃可能、不明を区別する」／SPEC事実（SPEC-000016）「検証済みRoot、所有者、用途、耐久性、保持期限、回復要否に従って書込みと処置を制御する。／Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる。」／対応: 実行時データの配置・保持・清掃を制御するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000011）「実行時データの保持内容を見て、清掃または保留を選ぶ」／SPEC事実（SPEC-000016）「実行時データを作成・保持・清掃する時／事前条件: 検証済みRuntime Root、用途、所有者、耐久性、保持・清掃条件を確認できる」／対応: 実行時データの配置・保持・清掃を制御するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000011）「用途別領域と保持・清掃条件を示す」／SPEC事実（SPEC-000016）「Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる。」／対応: 実行時データの配置・保持・清掃を制御するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#操作とfeedback) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000011）「subdirectoryや別基点へ同名の実行時データを作らせない」／SPEC事実（SPEC-000016）「用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。」／対応: 実行時データの配置・保持・清掃を制御するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#状態と表示差) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000011）「作業→データ用途→保持判断→清掃→不存在確認へ進める」／SPEC事実（SPEC-000016）「応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。」／対応: 実行時データの配置・保持・清掃を制御するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000011）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000016）「各領域Ownerに限定した書込みCapability。別用途・別Repositoryへ転用しない」／対応: 実行時データの配置・保持・清掃を制御するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#表示面と情報の優先順位) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000011）「Runtime Root、Data Item、Durability、Retention、Cleanup Evidenceを別の対象として示す」／SPEC事実（SPEC-000016）「正常: Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる／境界: Repository-local／OS管理Root、耐久／一時、参照中／清掃可能を分ける／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する」と矛盾する結果を返さない」／対応: 実行時データの配置・保持・清掃を制御するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000011](../04_UI/Definitions/UI-000011/ui_definition.md#制約) | [SPEC-000016](Definitions/SPEC-000016/spec_definition.md#制約) | 一致 | UI事実（UI-000011）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000016）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 実行時データの配置・保持・清掃を制御するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000012／SPEC-000017

共有Context: UX-000019、UX-000021、IA-000014、IA-000003

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#状態と表示差) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000012）「準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）／進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）」／SPEC事実（SPEC-000017）「出所付き入力、Task識別情報、試行、結果、現在Grantを結合し、同じ依頼の状態・結果を取得する。／情報搬送と実行、結果生成と結果帰還を別状態として返す。」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000012）「必要な情報だけを出所付きで渡す／切断後に同じ依頼へ戻る」／SPEC事実（SPEC-000017）「Agent間引継ぎまたは切断後の再接続を行う時／事前条件: 同じRequest Identity、入力出所、Attempt、結果、現在Grantを照合できる」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000012）「情報源・改訂版・選択理由を保持する／同一識別情報の照会を再実行より先に示す」／SPEC事実（SPEC-000017）「情報搬送と実行、結果生成と結果帰還を別状態として返す。」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#操作とfeedback) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000012）「全量投入・秘密情報混入・古い仮説の現在値化／Timeoutを未実行とみなし新規外部作用（Effect）を起こす」／SPEC事実（SPEC-000017）「応答喪失を未実行とみなさず、別依頼として再発行しない。」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#状態と表示差) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000012）「情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事／再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務」／SPEC事実（SPEC-000017）「応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#制約) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000012）「必要な情報だけを出所付きで渡す／切断後に同じ依頼へ戻る。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000017）「送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#表示面と情報の優先順位) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000012）「仕事用情報一式（Context Package）: 選択した仕事用情報一式／情報源参照（Source Reference）: 出所と改訂版（Revision）／選択理由（Selection Reason）: 含めた理由／作業（Task）: 受け渡し先の仕事／引き渡し（Handoff）: 役割間の移送／結果（Result）: Taskから戻る成果と状態／判断（Decision）: 結果とともに元の仕事へ戻す判断・未解決事項／依頼（Request）: 利用者の同一依頼／試行（Attempt）: 依頼を実行した個別試行／外部作用（Effect）: 外部へ生じ得る変更／結果（Result）: 試行または依頼の結果／回復義務（Recovery Obligation）: 残存を処置し、終了後を確認するまで残る義務／回復処置（Recovery Action）: 回復義務を解消するために実行する行動／終了確認（Settlement Observation）: 回復後に残存や作用が解消したことの確認／次の行動（Next Action）: 現在許される行動」／SPEC事実（SPEC-000017）「正常: 情報搬送と実行、結果生成と結果帰還を別状態として返す／境界: Request Identity一致／不一致、接続中／切断、結果あり／未取得を分け、別依頼を再発行しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない」と矛盾する結果を返さない」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000012](../04_UI/Definitions/UI-000012/ui_definition.md#制約) | [SPEC-000017](Definitions/SPEC-000017/spec_definition.md#制約) | 一致 | UI事実（UI-000012）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000017）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Task情報と結果を同じ仕事へ引き継ぎ再取得するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000013／SPEC-000018

共有Context: UX-000020、UX-000031、IA-000015

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#状態と表示差) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000013）「確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする／識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする」／SPEC事実（SPEC-000018）「準拠、完全性、配布者、利用者所有の信頼方針、品質根拠を独立に評価して結果を返す。／公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。」／対応: Runtimeの信頼要素を独立評価するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000013）「実行環境の信頼の各要素を別々に評価する／識別表示と保証の根拠を分けて確認する」／SPEC事実（SPEC-000018）「実行基盤を選択または公式配布物を確認する時／事前条件: 対象Artifact、準拠根拠、Hash・署名、Publisher、利用者Trust Policyを確認できる」／対応: Runtimeの信頼要素を独立評価するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000013）「保証要素と決定権限を分離表示する／識別表示と検証可能な信頼根拠を別に示す」／SPEC事実（SPEC-000018）「公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。」／対応: Runtimeの信頼要素を独立評価するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#操作とfeedback) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000013）「一つの署名表示を全保証と誤認する／アイコンや見た目を署名・準拠・品質保証と誤認する」／SPEC事実（SPEC-000018）「一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。」／対応: Runtimeの信頼要素を独立評価するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#状態と表示差) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000013）「成果物（Artifact）→各根拠→利用者方針→導入判断／公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断」／SPEC事実（SPEC-000018）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: Runtimeの信頼要素を独立評価するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#制約) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000013）「実行環境の信頼の各要素を別々に評価する／識別表示と保証の根拠を分けて確認する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000018）「Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する」／対応: Runtimeの信頼要素を独立評価するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#表示面と情報の優先順位) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000013）「準拠（Conformance）: CRDD契約への準拠／完全性（Integrity）: 成果物（Artifact）が改変されていない根拠／配布者（Publisher）: 成果物（Artifact）を作成・配布した主体／信頼方針（Trust Policy）: 利用環境が信頼する条件／配布物（Distribution）: 評価対象の配布物／品質主張（Quality Claim）: 検証済みの品質主張」／SPEC事実（SPEC-000018）「正常: 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める／境界: 準拠／完全性／配布者／利用者方針／品質根拠を別軸にし、一要素のPassを全体信頼へ広げない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り評価だけを返し、Runtime実行Capabilityを自動発行しない」と矛盾する結果を返さない」／対応: Runtimeの信頼要素を独立評価するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000013](../04_UI/Definitions/UI-000013/ui_definition.md#制約) | [SPEC-000018](Definitions/SPEC-000018/spec_definition.md#制約) | 一致 | UI事実（UI-000013）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000018）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: Runtimeの信頼要素を独立評価するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000014／SPEC-000019

共有Context: UX-000007、IA-000005

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#状態と表示差) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000014）「維持／変更／廃止／未確認」／SPEC事実（SPEC-000019）「旧能力、Producer、全Consumer、派生物、署名・Release経路を新所有者と検証根拠へ対応付ける。／宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。」／対応: 責務変更後の利用側閉包を検証するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000014）「維持・変更・廃止された能力と利用側を確認する」／SPEC事実（SPEC-000019）「責務・契約・接続部を変更する時／事前条件: 移動したCanonical Contract、旧Owner、新Owner、利用側母集団を特定できる」／対応: 責務変更後の利用側閉包を検証するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000014）「旧能力・全利用側・置換根拠を閉じる」／SPEC事実（SPEC-000019）「宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。」／対応: 責務変更後の利用側閉包を検証するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#操作とfeedback) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000014）「主経路だけ移行し副次利用側を取り残す」／SPEC事実（SPEC-000019）「代表経路だけのPassや旧処理の推測削除を許さない。」／対応: 責務変更後の利用側閉包を検証するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#状態と表示差) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000014）「変更→能力→全利用側→置換→反証根拠」／SPEC事実（SPEC-000019）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 責務変更後の利用側閉包を検証するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#制約) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000014）「維持・変更・廃止された能力と利用側を確認する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000019）「変更責任者が移行候補を作り、独立確認後に完了を判断する」／対応: 責務変更後の利用側閉包を検証するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#表示面と情報の優先順位) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000014）「利用能力（Capability）: 成立済みの利用者能力／正式契約（Canonical Contract）: 能力の意味契約／利用側（Consumer）: 契約を利用する入口・派生・配布経路／置換先（Replacement）: 変更後の所有者と実装／能力維持の根拠（Preservation Evidence）: 能力保存の反証根拠」／SPEC事実（SPEC-000019）「正常: 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない／境界: 宣言Consumer／導出Consumer、移行済み／未移行を分け、未確認Consumerを閉包済みにしない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない」と矛盾する結果を返さない」／対応: 責務変更後の利用側閉包を検証するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000014](../04_UI/Definitions/UI-000014/ui_definition.md#制約) | [SPEC-000019](Definitions/SPEC-000019/spec_definition.md#制約) | 一致 | UI事実（UI-000014）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000019）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 責務変更後の利用側閉包を検証するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000015／SPEC-000020

共有Context: UX-000023、UX-000026、UX-000029、IA-000016

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#状態と表示差) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000015）「固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）／計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）／計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする」／SPEC事実（SPEC-000020）「対象改訂版、指摘、是正、試験層、根拠、残るGateを同じ変更へ結合して現在状態を評価する。／未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する。」／対応: 変更・監査・試験・品質の閉包を評価するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000015）「監査合意から是正・反証までを一つの改訂版で閉じる／試験層ごとの保証と未確認範囲を理解する／作業・変更・根拠・品質を役割別に辿る」／SPEC事実（SPEC-000020）「変更候補を工程移行または公開判断へ進める時／事前条件: 同じ変更改訂版、監査集合、是正、試験層、Evidenceを特定できる」／対応: 変更・監査・試験・品質の閉包を評価するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000015）「合意事項と試験を全数対応させる／開始から清掃まで段階的に反証する／正本を分け全影響ファイルを列挙する」／SPEC事実（SPEC-000020）「未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する。」／対応: 変更・監査・試験・品質の閉包を評価するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#操作とfeedback) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000015）「一部是正や監査回数を完成と誤認する／単発成功や試験件数から一連の状態変化全体を保証する／同じ説明を複製し代表ファイルだけで済ませる」／SPEC事実（SPEC-000020）「試験件数や一部監査完了から全体Passを推定しない。」／対応: 変更・監査・試験・品質の閉包を評価するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#状態と表示差) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000015）「固定版→監査集合→統合方針→是正→再固定→判断／変更→不確実性→試験層→実行結果→現在保証／Roadmap→Change→対象ファイル→Evidence→Quality→Release」／SPEC事実（SPEC-000020）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 変更・監査・試験・品質の閉包を評価するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#制約) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000015）「監査合意から是正・反証までを一つの改訂版で閉じる／試験層ごとの保証と未確認範囲を理解する／作業・変更・根拠・品質を役割別に辿る。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000020）「各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める」／対応: 変更・監査・試験・品質の閉包を評価するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#表示面と情報の優先順位) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000015）「ロードマップ項目（Roadmap Item）: 未完了の仕事／変更（Change）: 採用した変更意図／変更ファイル（Changed File）: 変更が入ったファイル／改訂版（Revision）: 確認対象の固定版／指摘（Finding）: レビュー・監査の指摘／是正（Remediation）: 指摘への構造是正／試験層（Test Layer）: 確認の粒度／検証根拠（Evidence）: 実行条件と観測結果／品質状態（Quality State）: 現在の保証状態」／SPEC事実（SPEC-000020）「正常: 未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する／境界: 未実施／非該当／失敗／Pass、現改訂版／旧改訂版を分け、一部結果を全体Passへ広げない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない」と矛盾する結果を返さない」／対応: 変更・監査・試験・品質の閉包を評価するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000015](../04_UI/Definitions/UI-000015/ui_definition.md#制約) | [SPEC-000020](Definitions/SPEC-000020/spec_definition.md#制約) | 一致 | UI事実（UI-000015）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000020）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 変更・監査・試験・品質の閉包を評価するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000021

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「未許可、許可済み、要求済み、受理済み、Effect不明、Effect成立、Effect成立・結果不明、送信済みを区別する」／SPEC事実（SPEC-000021）「送信前検査、要求発行、要求受理、外部Effect成立、結果観測および結果搬送を区別する。」／対応: UIとSPECで要求受理後のEffect不明とEffect成立後の結果不明を別状態にし、どちらも未送信へ戻さない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「送信範囲へ同意するか送信を止める」／SPEC事実（SPEC-000021）「情報を外部へ送る時／事前条件: 送信先、目的、情報分類、対象範囲、同意の有効性を確認できる」／対応: 外部送信の同意範囲を検証して送信するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「同意、要求受理、Effect不明、Effect成立、Effect成立・結果不明、結果観測を分離して示す」／SPEC事実（SPEC-000021）「送信前検査、要求発行、要求受理、外部Effect成立、結果観測および結果搬送を区別する。」／対応: SPECの送信LifecycleをUIで同じ順序と意味に分け、Effect成立可否と結果搬送可否を独立して判断可能にする。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「接続済みを包括許可とせず、結果不明を未送信と誤認して二重送信させない」／SPEC事実（SPEC-000021）「期限切れ・範囲変更・不明な同意ではEffect 0で停止する。」／対応: 外部送信の同意範囲を検証して送信するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「Effect不明では成立を推測せず同じ依頼を再観測し、Effect成立・結果不明では成立済みEffectを保持して結果搬送または再観測へ戻る。どちらも自動再送しない」／SPEC事実（SPEC-000021）「同じ依頼識別情報を保持してEffectと結果を再観測し、結果不明のまま同じEffectを再発行しない。」／対応: UIの二つの不明状態をSPECの同一依頼再観測へ接続し、Effectの二重発行を0に保つ。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000021）「送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない」／対応: 外部送信の同意範囲を検証して送信するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000016）「Destination、Purpose、Information Classification、Consent、Outbound Packageを別の対象として示す」／SPEC事実（SPEC-000021）「正常: 送信前検査、要求発行、受理、外部Effect成立、結果観測および結果搬送を区別し、利用した同意範囲と同一依頼識別情報を結果へ結合する／境界: 同意範囲内／範囲外、有効／期限切れ／不明を分け、範囲外では送信Effectを発行しない／観測不能: 要求受理直後の切断をEffect不明、Effect成立後の結果搬送失敗をEffect成立・結果不明として分け、同一依頼識別情報で再観測する。結果不明のまま同じEffectを再発行しない」／対応: 外部送信の同意範囲を検証して送信するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000021](Definitions/SPEC-000021/spec_definition.md#制約) | 一致 | UI事実（UI-000016）「表示の都合で情報分類、送信範囲または開示境界を弱めない」／SPEC事実（SPEC-000021）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 外部送信の同意範囲を検証して送信するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000026

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「送信済み、返却済み、候補、採用を別状態として示す」／SPEC事実（SPEC-000026）「外部結果を送信時の依頼識別情報・出所・信頼状態へ結合し、未信頼候補として元の仕事へ返す。／結果受領と候補採用を分け、元の依頼と出所に結合した未信頼候補を返す。」／対応: 外部処理の結果を元の仕事へ持ち帰るの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「同じ送信依頼の結果観測から、出所付きの持帰り結果を確認する」／SPEC事実（SPEC-000026）「許可済み外部処理の応答を受け取る時／事前条件: 送信時の依頼識別情報、出所、外部応答を照合できる」／対応: UIで結果観測を開始する契機を、SPECが応答・依頼Identity・出所を照合できる時に限定する。結果不明の回復はSPEC-000021との組が所有する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「結果観測と未信頼候補への投影を分離して示す」／SPEC事実（SPEC-000026）「結果受領と候補採用を分け、元の依頼と出所に結合した未信頼候補を返す。」／対応: 外部処理の結果を元の仕事へ持ち帰るの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「外部反応を要求、因果または方針へ自動昇格させない」／SPEC事実（SPEC-000026）「送信時の識別情報へ結合できない結果は採用可能な候補へしない。」／対応: 外部処理の結果を元の仕事へ持ち帰るの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「送信時の同じ依頼と出所へ戻り、結果を再取得できる」／SPEC事実（SPEC-000026）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 外部処理の結果を元の仕事へ持ち帰るの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない」／SPEC事実（SPEC-000026）「外部結果を受領して元の仕事へ返せる主体。新規送信と候補採用のAuthorityは含まない」／対応: 外部処理の結果を元の仕事へ持ち帰るに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000016）「Context Package、Source Reference、Task、Handoff、Resultを別の対象として示す」／SPEC事実（SPEC-000026）「正常: 結果受領と候補採用を分け、元の依頼と出所に結合した未信頼候補を返す／境界: 依頼Identity一致／欠落／曖昧を分け、結合不能な応答を採用可能候補へしない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない」と矛盾する結果を返さない」／対応: 外部処理の結果を元の仕事へ持ち帰るに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000026](Definitions/SPEC-000026/spec_definition.md#制約) | 一致 | UI事実（UI-000016）「表示の都合で出所、改訂版、送信範囲または開示境界を弱めない」／SPEC事実（SPEC-000026）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 外部処理の結果を元の仕事へ持ち帰るとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000016／SPEC-000027

共有Context: UX-000024、IA-000014、IA-000017

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「返却済み、候補、採用を区別し、採否前の候補を正本と同一視しない」／SPEC事実（SPEC-000027）「候補の出所、対象、判断主体、現在改訂版を確認し、採用時だけ所有正本へ反映する。／採否と反映先を辿れ、却下・保留では所有正本を変更しない。」／対応: 持ち帰った候補を所有正本へ昇格するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「持ち帰った候補を採用、却下または保留する」／SPEC事実（SPEC-000027）「持ち帰った候補を採用・却下・保留する時／事前条件: 未信頼候補、出所、対象正本、現在改訂版、判断主体を確認できる」／対応: 持ち帰った候補を所有正本へ昇格するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000016）「投影と採用を分離し、候補の採否と反映先を示す」／SPEC事実（SPEC-000027）「採否と反映先を辿れ、却下・保留では所有正本を変更しない。」／対応: UIの採用・却下・保留と反映先をSPECの正本Effectへ対応させ、送信・受理・Effect観測はこの組へ含めない。 |
| Failure | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#操作とfeedback) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「外部反応や依存新版を要求・因果・方針へ自動昇格しない」／SPEC事実（SPEC-000027）「結果受領や送信許可を候補採用Authorityへ流用しない。」／対応: 持ち帰った候補を所有正本へ昇格するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#状態と表示差) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000016）「送信候補から境界確認、結果観測、出所付き結果、採否へ進める」／SPEC事実（SPEC-000027）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 持ち帰った候補を所有正本へ昇格するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000016）「候補の採否を所有正本の決定権限者へ戻す」／SPEC事実（SPEC-000027）「所有正本の決定権限者だけが採用できる。送信同意や結果受領を流用しない」／対応: 持ち帰った候補を所有正本へ昇格するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#表示面と情報の優先順位) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000016）「Returned Candidate、Source Reference、Decision、対象正本を別の対象として示す」／SPEC事実（SPEC-000027）「正常: 採否と反映先を辿れ、却下・保留では所有正本を変更しない／境界: 採用／却下／保留、対象改訂版一致／不一致を分け、採用時以外は所有正本を変更しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ所有正本を更新する。却下・保留では正本Effect 0」と矛盾する結果を返さない」／対応: 持ち帰った候補を所有正本へ昇格するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000016](../04_UI/Definitions/UI-000016/ui_definition.md#制約) | [SPEC-000027](Definitions/SPEC-000027/spec_definition.md#制約) | 一致 | UI事実（UI-000016）「表示の都合で出所、判断主体または正本境界を弱めない」／SPEC事実（SPEC-000027）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 持ち帰った候補を所有正本へ昇格するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000017／SPEC-000022

共有Context: UX-000025、IA-000021

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#状態と表示差) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000017）「現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown）」／SPEC事実（SPEC-000022）「発生時点、対象改訂版、出所、現在有効性、置換関係を評価して参照結果を返す。／Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する。」／対応: 過去情報と現在有効な意図を区別して解決するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000017）「当時の仮説と現在有効な意図を区別する」／SPEC事実（SPEC-000022）「過去の推論情報や判断を現在の作業で参照する時／事前条件: 情報の出所、発生時点、対象改訂版、置換関係を確認できる」／対応: 過去情報と現在有効な意図を区別して解決するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000017）「現行性・選択範囲・使用改訂版を追跡する」／SPEC事実（SPEC-000022）「Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する。」／対応: 過去情報と現在有効な意図を区別して解決するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#操作とfeedback) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000017）「履歴を上書きし競合する理由を勝手に統合する」／SPEC事実（SPEC-000022）「古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。」／対応: 過去情報と現在有効な意図を区別して解決するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#状態と表示差) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000017）「現在の仕事→選択した情報→根拠→過去値比較」／SPEC事実（SPEC-000022）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 過去情報と現在有効な意図を区別して解決するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#制約) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000017）「当時の仮説と現在有効な意図を区別する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000022）「履歴を閲覧する主体。参照から現在方針の採用Authorityを推定しない」／対応: 過去情報と現在有効な意図を区別して解決するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#表示面と情報の優先順位) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000017）「推論の背景（Reasoning Context）: 当時の仮説、判断、学びが生じた背景／過去値（Historical Value）: 当時は有効だった内容／現在有効な意図（Current Intent）: 現在の仕事で有効な判断・方針／選択理由（Selection Reason）: なぜ今回その情報を使うか／有効性: 現在値、履歴、置換済み、不明の区別」／SPEC事実（SPEC-000022）「正常: Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する／境界: 現在有効／置換済み／失効／不明を分け、過去情報を現在意図へ自動昇格しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない」と矛盾する結果を返さない」／対応: 過去情報と現在有効な意図を区別して解決するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000017](../04_UI/Definitions/UI-000017/ui_definition.md#制約) | [SPEC-000022](Definitions/SPEC-000022/spec_definition.md#制約) | 一致 | UI事実（UI-000017）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000022）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 過去情報と現在有効な意図を区別して解決するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000018／SPEC-000023

共有Context: UX-000027、UX-000028、IA-000018

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#状態と表示差) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000018）「下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別／作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason）」／SPEC事実（SPEC-000023）「工程固有の物語、構造、必要図、凡例、入力・出力関係、作成不能理由を検査する。／人間が理解する順序と機械的な関係閉包を両立する。」／対応: 文書の物語・構造・図と工程引継ぎを検査するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000018）「課題と判断の物語から構造化詳細へ進む／工程固有の図から状態・関係・未接続を理解する」／SPEC事実（SPEC-000023）「工程成果物を作成・更新・引き渡す時／事前条件: 対象工程、正式入力、必要図、引き渡し条件を特定できる」／対応: 文書の物語・構造・図と工程引継ぎを検査するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000018）「物語と構造化した情報を両立する／図の意味・凡例・正本関係を固定する」／SPEC事実（SPEC-000023）「人間が理解する順序と機械的な関係閉包を両立する。」／対応: 文書の物語・構造・図と工程引継ぎを検査するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#操作とfeedback) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000018）「確認項目順と専門語だけで文書を埋める／必要な図を黙って省略しAIごとに記法が変わる」／SPEC事実（SPEC-000023）「Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。」／対応: 文書の物語・構造・図と工程引継ぎを検査するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#状態と表示差) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000018）「問題と目的→判断→構造化詳細→根拠→次工程／上流意図→工程図→要素の意味→下流義務」／SPEC事実（SPEC-000023）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 文書の物語・構造・図と工程引継ぎを検査するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#制約) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000018）「課題と判断の物語から構造化詳細へ進む／工程固有の図から状態・関係・未接続を理解する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000023）「工程成果物の作成者と確認者。Checker結果は意味採用Authorityを持たない」／対応: 文書の物語・構造・図と工程引継ぎを検査するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#表示面と情報の優先順位) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000018）「物語（Narrative）: 問題・目的・判断へ至る物語／構造化した詳細（Structured Detail）: 条件・関係・状態の構造表現／図（Diagram）: 工程の関係・流れを示す投影／図の要素（Diagram Element）: 図中の対象・関係／判断（Decision）: 採用した判断と理由／引継ぎ義務（Handoff Obligation）: 次工程が失ってはならない意味」／SPEC事実（SPEC-000023）「正常: 人間が理解する順序と機械的な関係閉包を両立する／境界: 必要図あり／作成不能、正式構造／説明例を分け、説明例を正本関係として検出しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り検査だけを行い、文書内容や工程状態を自動変更しない」と矛盾する結果を返さない」／対応: 文書の物語・構造・図と工程引継ぎを検査するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000018](../04_UI/Definitions/UI-000018/ui_definition.md#制約) | [SPEC-000023](Definitions/SPEC-000023/spec_definition.md#制約) | 一致 | UI事実（UI-000018）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000023）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 文書の物語・構造・図と工程引継ぎを検査するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000019／SPEC-000024

共有Context: UX-000030、IA-000019

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#状態と表示差) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000019）「候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）」／SPEC事実（SPEC-000024）「素材の由来、権利確認、許可した用途、決定権限者、対象版を記録して利用可否を返す。／確認済み・未確認・利用不可を区別し、許可範囲へ戻れる。」／対応: 公式素材の由来・権利・用途を確認するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000019）「視覚素材の出所・権利・用途を確認する」／SPEC事実（SPEC-000024）「公式Repositoryへ素材を収載または再配布する時／事前条件: 素材、出所、権利確認、許可用途、決定権限者、対象版を確認できる」／対応: 公式素材の由来・権利・用途を確認するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000019）「由来・権利・用途を追跡する」／SPEC事実（SPEC-000024）「確認済み・未確認・利用不可を区別し、許可範囲へ戻れる。」／対応: 公式素材の由来・権利・用途を確認するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#操作とfeedback) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000019）「見た目だけで権利や信頼保証を推定する」／SPEC事実（SPEC-000024）「生成手段だけで権利を推定せず、用途外利用を許可しない。」／対応: 公式素材の由来・権利・用途を確認するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#状態と表示差) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000019）「素材→由来→権利→用途→収載・派生」／SPEC事実（SPEC-000024）「本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。」／対応: 公式素材の由来・権利・用途を確認するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#制約) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000019）「視覚素材の出所・権利・用途を確認する。UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。」／SPEC事実（SPEC-000024）「権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない」／対応: 公式素材の由来・権利・用途を確認するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#表示面と情報の優先順位) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000019）「素材（Asset）: 利用候補の視覚・文章素材／由来（Provenance）: 生成・取得・編集の由来／権利確認（Rights Statement）: 収載・公開・再配布の権利根拠／許可用途（Allowed Use）: 許可された用途／派生物（Derivative）: 原本から作成した派生物」／SPEC事実（SPEC-000024）「正常: 確認済み・未確認・利用不可を区別し、許可範囲へ戻れる／境界: 由来・権利・用途が確認済み／未確認／利用不可を分け、許可用途を拡張しない／観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする」と矛盾する結果を返さない」／対応: 公式素材の由来・権利・用途を確認するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000019](../04_UI/Definitions/UI-000019/ui_definition.md#制約) | [SPEC-000024](Definitions/SPEC-000024/spec_definition.md#制約) | 一致 | UI事実（UI-000019）「UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。／表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。／視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。」／SPEC事実（SPEC-000024）「API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。」／対応: 公式素材の由来・権利・用途を確認するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

### UI-000020／SPEC-000030

共有Context: UX-000032、IA-000022

| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |
|---|---|---|---|---|
| State | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#状態と表示差) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000020）「recorded、not_recorded、unknownを最終結果として区別し、preparedとpublishingは記録処理中のUI状態として分離する」／SPEC事実（SPEC-000030）「prepared、publishing、recorded、not_recorded、unknownを区別し、要求受理、Effect発行、完成記録の確認を同一視しない」／対応: 実行事実を同じ契約で記録するの共有最終状態だけを対応付け、UI固有の途中状態や別SPECの状態を混入させない。 |
| Trigger | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000020）「記録を依頼し、結果に応じて取得、修正後の再依頼、同一試行の再観測を選ぶ」／SPEC事実（SPEC-000030）「AIまたはToolの観測可能な実行段階が確定した時／事前条件: Execution Identity、Source、観測時点、観測項目と値または未観測理由を検査できる」／対応: 実行事実を同じ契約で記録するの契機と事前条件が成立した時だけ、この組のUI操作を発火する。 |
| Result | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#振る舞い状態結果) | 一致 | UI事実（UI-000020）「recorded、not_recorded、unknownと、同じExecution・Attempt、完成記録または再観測先を示す」／SPEC事実（SPEC-000030）「記録結果は取得側がSource、Observed At、観測状態を再解釈せず読める形にする」／対応: 実行事実を同じ契約で記録するの結果だけを、この組に対応するUIの判断可能なFeedbackとして示す。 |
| Failure | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#操作とfeedback) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000020）「unknownを未記録と推定して新しい記録試行を再発行させない」／SPEC事実（SPEC-000030）「Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。」／対応: 実行事実を同じ契約で記録するの失敗を、この組のUIで成功・不存在・完了へ丸めず示す。 |
| Recovery | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#状態と表示差) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#失敗回復副作用) | 一致 | UI事実（UI-000020）「記録対象→記録Attempt→結果→完成記録、拒否理由または同一Attemptの再観測へ進める」／SPEC事実（SPEC-000030）「Effect成立が不明な場合は自動再発行せず、同じExecution Identityと記録Attemptで再観測できる回復義務を返す。」／対応: 実行事実を同じ契約で記録するの回復義務を、この組に対応するUIの次の行動へ接続する。 |
| Authority | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#制約) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#契機事前条件authority) | 一致 | UI事実（UI-000020）「UIは記録を依頼するが、記録AuthorityをTask実行、評価採用または別Source変更へ流用しない」／SPEC事実（SPEC-000030）「許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない」／対応: 実行事実を同じ契約で記録するに必要なUI操作だけを、同SPECのAuthorityとEffect境界の内側に限定する。 |
| Visibility | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#表示面と情報の優先順位) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#受入条件と検証義務) | 一致 | UI事実（UI-000020）「記録対象、許可範囲、記録Attempt、結果状態、根拠、次の行動をこの順で示す」／SPEC事実（SPEC-000030）「正常: 異なる作成側から同じ契約で記録し、取得側が意味を変えず比較できる／境界: 同一再送、複数作成側、並行書込み、部分記録を別Executionや完成記録へ誤統合しない／観測不能: 保存Effect不明をnot_recordedへ丸めず、同じIdentityで再観測可能にする」／対応: 実行事実を同じ契約で記録するに必要な不足・観測不能だけを、UIが開示可能な範囲で隠さず示す。 |
| Constraint | [UI-000020](../04_UI/Definitions/UI-000020/ui_definition.md#制約) | [SPEC-000030](Definitions/SPEC-000030/spec_definition.md#制約) | 一致 | UI事実（UI-000020）「記録結果不明を成功、未記録または空へ畳まず、UIに不変Storeを作らない」／SPEC事実（SPEC-000030）「生Provider出力、秘密情報または不要な個人情報を一律に記録しない。保存方式、DB製品またはProcess配置は本定義で固定しない。」／対応: 実行事実を同じ契約で記録するとUIの制約をともに保持し、この組だけで実装方式や権限を拡張しない。 |

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
