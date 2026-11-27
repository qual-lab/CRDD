/** 実ブラウザー試験をAM所有の合成状態と、製品の共有Serverに接続する。 @trace RFD-ST-016 */
import { createSharedBrowserAccessFixture } from "../../../access-management/tests/fixtures/shared-browser-state.ts";
import { startCrddServer } from "../../src/app.ts";

export function prepareSharedAccessBrowserFixture(
  directory: string,
  role: "administrator" | "manager" | "developer",
) {
  const access = createSharedBrowserAccessFixture(directory, role);
  return {
    addRepository: access.addRepository,
    baseline: access.baseline,
    registrations: access.registrations,
    users: access.users,
    setObservation: access.setObservation,
    async initialize() {
      await access.initialize();
    },
    async start(
      request: Omit<Parameters<typeof startCrddServer>[0], "localAccessRoot">,
      account: Readonly<{ issuer: string; subject: string }>,
    ) {
      return startCrddServer({
        ...request,
        localAccessRoot: await access.initialize(account),
      });
    },
  };
}
