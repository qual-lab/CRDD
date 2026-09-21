# Actor／System間Sequence

```text
Actor              Public Contract        Runtime／Owner        External Boundary
  │ request              │                       │                       │
  ├─────────────────────>│ validate              │                       │
  │                      ├──────────────────────>│ authorize             │
  │                      │                       ├──── request ─────────>│
  │                      │                       │<── accepted ─────────┤
  │                      │                       │<── completed／unknown ┤
  │                      │<── result／recovery ──┤                       │
  │<── observable result ┤                       │                       │
  │                      │                       │                       │
  │ reconnect／recover   │                       │                       │
  ├─────────────────────>│ same identity          │                       │
  │                      ├──────────────────────>│ observe／settle        │
  │<── current state ────┤                       │                       │
```

要求発行、受理、Effect成立、完了通知、結果搬送、終了後確認を同じ矢印へ畳まない。直接外部EffectがないSPECではExternal Boundaryを非適用とする。

## 補足分析

なし。

## Checklist

- [x] 全SPEC DefinitionのActorとAuthorityを処置した
- [x] 要求、受理、Effect、結果観測および終了を全数評価し、統合する段階には理由を記録した
- [x] 利用者操作と内部実装呼出しを同一視していない
- [x] 個別SPEC Definitionの意味を再定義していない
- [x] Architecture方式を先取りしていない
