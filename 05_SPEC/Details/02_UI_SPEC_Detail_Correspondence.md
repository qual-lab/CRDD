# UI／SPEC Detail対応

成果物種別: UI／SPEC Detail対応投影
状態: OPEN
維持責任者: Qual-Lab

## 1. 対象範囲

- UI Detail: [UI Detail](../../04_UI/Details/01_UI_Detail.md)
- SPEC Detail: [SPEC Detail](01_SPEC_Detail.md)
- Definition対応: [UI／SPEC対応](../06_UI_SPEC_Correspondence.md)

v0.21.0のDefinition対応は維持する。SCR／PRT／InteractionとBHVが未発行であるため、Detail対応は未実施であり、Definition対応のPassから推定しない。

## 2. UIからBHVへのCoverage

OPEN: UI DetailとSPEC DetailのIdentity発行後に全件評価する。

## 3. BHVからUIへのCoverage

OPEN: 利用者認識が必要なResult、Failure、Pending、Reject、UnknownおよびRecoveryをBHV発行後に全件評価する。

## 4. Definitionへ戻すGap

現時点ではDetail未作成のためGapを判定しない。PilotでDefinition不足を発見した場合、本対応文書へ意味を追加せず、Owner Definitionを再開する。

## 5. Architecture／Qualityへの引き渡し

新しいDetail Contractに基づく通常Handoffは未成立である。v0.21 Releaseの当時のHandoff結果は変更しない。

## 補足分析

WIPとの比較はCanonical Detail成立後のReality Auditまで行わない。

## Checklist

- [x] Definition対応とDetail対応を分けた
- [x] v0.21 Definition対応を遡及変更していない
- [x] Detail未発行をCoverage済みへ畳んでいない
- [x] Gapを対応表で補完しない戻り先を明示した
- OPEN: UI／SPEC Detail発行後に双方向Coverageを全件評価する
