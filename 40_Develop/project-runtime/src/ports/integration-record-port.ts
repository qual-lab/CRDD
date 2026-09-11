import type { ProjectRuntimePortResult } from "./port-result.ts";

export type ProjectRuntimeIntegrationRecord = Readonly<{
  kind: "integration" | "adoption";
  identity: string;
  value: unknown;
}>;

/** Durable, immutable publication requested by the integration application. */
export type ProjectRuntimeIntegrationRecordPort = Readonly<{
  write: (
    record: ProjectRuntimeIntegrationRecord,
  ) => ProjectRuntimePortResult<Readonly<{ written: true }>>;
}>;
