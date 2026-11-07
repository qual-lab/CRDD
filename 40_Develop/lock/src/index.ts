/** 単一Host・ローカルFilesystemの協調wx排他を提供する。 */
export { acquireLock } from "./operations.ts";
export type { LockRequest, LockReference, Lock, LockResult } from "./types.ts";
