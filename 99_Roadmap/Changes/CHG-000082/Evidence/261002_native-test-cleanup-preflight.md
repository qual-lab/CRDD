# Native試験の所有一時領域清掃 — 着手前確認

成果物種別: 変更の調査・計画記録
変更ID: `CHG-000082`
記録日: 2026-10-02
基準Commit: `a14b0d6461d3dfb295dd4dca954a9ee83015ffcf`
維持責任者: Qual-Lab

## 結論

既存Native試験の清掃観測Gapは、末尾の不存在確認だけでは閉じない。終了確認に失敗すると、一時領域の自動削除が先に走り得るため、**取得時から自動削除を抑え、所有TaskとHostの終了を確認した後だけ明示清掃する**方向へ計画を修正する。

この記録はSource編集前の調査結果であり、実装採用、試験合格、旧Host残存三件の削除許可または実Task再開ではない。Windows再起動を利用する限定回復方式は人間判断待ちであり、その判断をこの別の試験Gapの確認から推定しない。

## 変更経路と対象

| 項目 | 今回の処置 |
|---|---|
| 分類 | 保存結果で判明した試験終了後条件の不足に対する着手前調査。 |
| 保持する意味 | 元の六Host scenario、起動Policy、結果Oracle、正常・異常の区別を維持する。 |
| 調査対象 | `run_crdd_host_scenario`の試験自身が取得したHome／Workspace。実在する旧三Rootは対象外。 |
| 正本／利用側 | Coordinator詳細設計7.5.1、QA-000006のERB-IT-025〜029、固定試験Patch、Build入力固定、既存の限定適用Evidence。 |
| 着手前確認 | 親のSource／Quality／実行環境意味の照合と、読取り専用の技術確認。完成後監査として流用しない。 |
| 今回実行しない操作 | Source編集、Rust compile、Docker／Native／Provider実行、実Root清掃、署名、実Task再開。 |
| 必要な独立確認 | 本記録の技術解釈、文書・追跡、品質・直接影響を同じ固定版で確認する。準拠基準、配布Identityを変更しないため全回帰・再署名を本調査の確認に使わない。 |

既存のGapと実行結果は[Native二十一試験の品質適用記録](260930-1853_codex-model-host-migration-preflight.md#native二十一試験のquality適用と清掃観測gap2026-10-02)を保持する。過去の合格、Hash、未充足条件は変更しない。

## 固定Sourceと一次情報

| 対象 | 確認したIdentity／限界 |
|---|---|
| 公式Source Archive | `.crdd/tmp/codex-01592-migration/official-source.tar.gz`、SHA-256 `b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`。Archive内Cargo.lockのtempfileは`3.27.0`、crate checksumは`32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd`。 |
| 起動Patch | `40_Develop/coordinator/runtime/codex-advice-startup.patch`、SHA-256 `1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb`。変更なし。 |
| 試験Patch | `40_Develop/coordinator/runtime/codex-advice-startup-test.patch`、SHA-256 `03e916f0371b80cf4f7038b54f3b81356218d277acc506dd3f473a4acc15cc31`。変更なし。 |
| 試験入力一覧 | `40_Develop/coordinator/runtime/codex-advice-startup-test-inputs.sha256`、SHA-256 `f812775b4254a47376adcc99491c7752869daed403df39d7b998ae95cdf51b80`。変更なし。 |
| APIの一次情報 | tempfile公開tag v3.27.0の[TempDir実装](https://raw.githubusercontent.com/Stebalien/tempfile/v3.27.0/src/dir/mod.rs)と[Builder実装](https://raw.githubusercontent.com/Stebalien/tempfile/v3.27.0/src/lib.rs)。公開API名と版だけで調査し、Repository本文、診断log、秘密値は送信していない。公開tagの意味確認をCargo.lockのexact crate bytesとの暗号一致へ読み替えない。 |

## 判明した不足と修正方向

| 現行Source／APIの意味 | 反証・影響 | 次単位の方向 |
|---|---|---|
| Helperは通常のTempDirを取得し、shutdown／終了待機後にassertする。 | assert失敗のunwindでもDropが削除を試みる。「終了未確認なら保持」が未成立。 | Task／Host取得前、Root生成時から自動清掃を無効化する。失敗後のkeep追加だけでは閉じない。 |
| TempDirのDropは削除Errorを無視する。 | Drop実行から清掃成功を推定できない。 | closeの結果とRoot不存在を別々に観測する。 |
| closeは削除結果を返し、TempDirを消費する。自動清掃無効でも明示削除は実行する。 | close失敗時も同じTempDirを再利用できない。 | 処置前に所有Pathを保持し、二Rootを個別に処置・観測する。無条件の再削除にしない。 |
| keepは自動清掃を無効化しPathを返す。 | Path保持は非使用証明や回復Authorityではない。 | 保持対象・失敗理由・未確認条件を記録し、自動再入場許可を作らない。 |
| resources_settledは空集合でも成立し得る。 | 未登録を終了済みへ畳むと、Root削除の前提が崩れる。 | 必須Roleの登録・終了とHost終端を、空集合の集計だけから推定しない。 |

## 次単位で閉じる条件

| 場面 | 必要な処置／反証 |
|---|---|
| Root取得途中の失敗 | 取得済み対象と未取得対象を分ける。元失敗を保持し、作成途中の残存を消失扱いしない。 |
| 正常完了 | 必須Role・全所有Task・Host終端を確認後、HomeとWorkspaceを明示清掃し、それぞれの不存在を確認する。 |
| error／timeout／panic | 元結果を保持する。終了確認の成否を独立評価し、終了未確認なら削除0・保持を強制する。清掃成功をscenario成功へ昇格しない。 |
| 一Rootだけ清掃失敗 | 他Rootの処置と観測を独立に記録し、部分成立を全体成功へ畳まない。 |
| 不存在観測が失敗 | 明示不存在と観測不能を区別する。exists=falseへの畳込みを拒否する。 |
| 新候補の作成 | 試験Patch・生成Source・入力一覧・Builder／利用側のHashを同じ候補へ対応付ける。旧署名候補と旧Evidenceは不変。 |
| 実測 | Source採用後に静的Gate・局所反証・必要な実Host境界を順に確認する。実行範囲と停止Gateを事前照合し、現段階では実行しない。 |

変更ファイル単位ではなく、取得、登録、終了、処置、観測、結果搬送の各意味から反証を導く。現在は計画修正であり、これらの条件を実装済みとは表示しない。v0.22の観測済み`11 / 46`、全体`119 / 176`と新実Task停止を維持する。

## 限定独立確認の結果

技術解釈、文書・追跡、品質・直接影響の三観点は、同じ固定二文書への読取り確認を完了し、全て限定Pass、Finding 0であった。確認対象はこの結果追記前のEvidence SHA-256 `7578a168a6321e862e23c894b995f10ec6a7f57e44f9c7eb4c5eaa750389b67b`と、CHG本文`4a047cc3798fcc8ee086c4e3f3abde4560db2c9f9170b01e91f5fdc8c603fb5a`で、各確認の開始・終了Hashが一致した。

Passは調査記録の技術解釈と適用境界だけを対象とする。確認者は試験・Source編集・実Root操作を実行せず、Source採用、清掃、Local Item成立または実Task再開を承認していない。三結果の統合後、この節とChecklistだけを結果書戻しとして追記した。確認対象Hashと追記後Hashを取り違えず、元の記録、許可範囲と残るOPENを維持する。三確認者はこの結果だけの書戻しを整合済みとした。

## Checklist

- [x] 固定Source、Patch、入力一覧と旧検証結果の境界を確認した。
- [x] 自動Drop、明示close、保持を区別した。
- [x] 終了未確認時の削除を防ぐ条件を取得前へ戻した。
- [x] 元error／timeout／panic、部分清掃と観測不能を別に評価する計画を残した。
- [x] 旧三Rootの限定回復、試験Rootの清掃Gapと通信断の原因を混同していない。
- [x] 本固定記録の三観点の独立確認と結果統合を完了し、調査記録だけの限定Passとして残した。
- [ ] OPEN: exact crate bytesの照合、新Source候補・反証・実測は未実施。実測へ進む前に停止Gateと実行範囲を再照合する。
