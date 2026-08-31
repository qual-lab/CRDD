type RuntimeStateBinding = Readonly<{
  rootPath: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
}>;

export function isExactDockerRuntimeStateMutationBoundary(
  expected: RuntimeStateBinding,
  current: RuntimeStateBinding,
  recoveryIds: readonly string[],
  recoveryId: string,
) {
  return (
    current.rootPath === expected.rootPath &&
    current.runtimeStateIdentityHash === expected.runtimeStateIdentityHash &&
    current.runtimeStateProtectionHash ===
      expected.runtimeStateProtectionHash &&
    current.localUserBindingHash === expected.localUserBindingHash &&
    current.runtimeStateBindingHash === expected.runtimeStateBindingHash &&
    recoveryIds.some((candidate) => candidate === recoveryId)
  );
}
