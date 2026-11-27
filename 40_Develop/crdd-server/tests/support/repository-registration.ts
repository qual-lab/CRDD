/** AMの登録試験へ、自己生成Repositoryの配置観測を渡す。 @trace RFD-IT-021 */
import { readRepositoryLocation } from "@qual-lab/crdd-version-control";

export function observeRegistrationDirectory(directory: string) {
  const root = readRepositoryLocation(directory)?.directory;
  return root
    ? {
        directory: root,
        isCurrent: () => readRepositoryLocation(root)?.directory === root,
      }
    : null;
}
