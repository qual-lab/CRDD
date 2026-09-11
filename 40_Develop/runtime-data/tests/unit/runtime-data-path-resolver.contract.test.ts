import assert from "node:assert/strict";
import test from "node:test";

import { resolveCrosRuntimeRoots } from "../../src/index.ts";

test("Windows CROS Rootはpublisher/application/trust-domain順で解決する", () => {
  const roots = resolveCrosRuntimeRoots({
    platform: "win32",
    trustDomainId: "company-a",
    publisher: "qual-lab",
    application: "cros",
    localAppData: "C:\\Users\\example\\AppData\\Local",
  });
  assert.equal(
    roots?.state,
    "C:\\Users\\example\\AppData\\Local\\qual-lab\\cros\\company-a",
  );
});

test("Linux CROS RootはXDGのconfig/state/runtimeを混在させない", () => {
  const roots = resolveCrosRuntimeRoots({
    platform: "linux",
    trustDomainId: "company-a",
    publisher: "qual-lab",
    application: "cros",
    homeDirectory: "/home/example",
    xdgRuntimeDirectory: "/run/user/1000",
  });
  assert.equal(roots?.config, "/home/example/.config/qual-lab/cros/company-a");
  assert.equal(
    roots?.state,
    "/home/example/.local/state/qual-lab/cros/company-a",
  );
  assert.equal(roots?.temporary, "/run/user/1000/qual-lab/cros/company-a");
});

test("相対OS Rootと不正なTrust Domainは拒否する", () => {
  assert.equal(
    resolveCrosRuntimeRoots({
      platform: "linux",
      trustDomainId: "Company A",
      publisher: "qual-lab",
      application: "cros",
      homeDirectory: "relative",
    }),
    null,
  );
});

test("Trust Policyで受理するDirectory IdentityはCROS Pathでも同じく受理する", async () => {
  const { inspectCrosTrustPolicy } = await import("../../src/index.ts");
  for (const identity of ["company-a", "a", "a1-b2"]) {
    const policy = inspectCrosTrustPolicy({
      schema: "cros/trust-policy/v1",
      trustDomainId: identity,
      trustedRuntimePublishers: [identity],
      repositoryAdmission: "explicit-binding-only",
      maximumCapabilities: [],
      transports: [],
      allowUnsignedLocalDevelopment: false,
    });
    assert.ok(policy);
    assert.ok(
      resolveCrosRuntimeRoots({
        platform: "linux",
        trustDomainId: identity,
        publisher: identity,
        application: "cros",
        homeDirectory: "/home/example",
      }),
    );
  }
  for (const identity of [
    "org.example",
    "org_example",
    "Company-A",
    "default",
  ]) {
    assert.equal(
      inspectCrosTrustPolicy({
        schema: "cros/trust-policy/v1",
        trustDomainId: identity,
        trustedRuntimePublishers: ["qual-lab"],
        repositoryAdmission: "explicit-binding-only",
        maximumCapabilities: [],
        transports: [],
        allowUnsignedLocalDevelopment: false,
      }),
      null,
    );
  }
});
