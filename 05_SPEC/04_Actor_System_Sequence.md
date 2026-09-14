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
