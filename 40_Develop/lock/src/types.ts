/** 協調する単一Hostのwx排他契約。生存監視・自動回復は提供しない。 */
/** 単一Hostの協調File排他の入力・取得世代・結果を定義する。 */
export type LockRequest = Readonly<{
  directory: string;
  name: string;
  identity: string;
}>;

/** 回復時に対象を照合する非Authorityの取得参照。PIDによる回復許可ではない。 */
export type LockReference = LockRequest &
  Readonly<{
    owner: Readonly<{ processId: number; processIdentity: string }>;
    generation: string;
    directoryIdentity: Readonly<{ device: string; inode: string }>;
    fileIdentity: Readonly<{ device: string; inode: string }> | null;
  }>;

/** 元取得だけを一度解放する。生存不明・不一致時はPathを削除しない。 */
export type Lock = Readonly<{
  reference: LockReference;
  assertLive(): boolean;
  release(): boolean;
}>;

/** 既存Fileは自動削除せず停止する。初期化失敗の残存も同じ取得参照で保持する。 */
export type LockResult<L extends { release(): boolean } = Lock> =
  | Readonly<{ status: "acquired"; lock: L }>
  | Readonly<{
      status: "blocked";
      reason:
        | "lock_exists"
        | "lock_input_invalid"
        | "lock_observation_unknown"
        | "lock_initialization_failed";
      reference: LockReference | null;
      cleanupConfirmed: boolean;
      descriptorClosed: boolean;
    }>;
