import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readStableBoundedFileSnapshot } from "../src/security/bounded-file-snapshot.ts";

function temporaryFile(bytes: Buffer) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-bounded-file-"));
  const file = path.join(root, "artifact.exe");
  fs.writeFileSync(file, bytes);
  return { root, file };
}

test("bounded snapshotは上限exactを同一fdから読み上限+1を拒否する", () => {
  const exact = temporaryFile(Buffer.alloc(4096, 0x5a));
  const oversized = temporaryFile(Buffer.alloc(4097, 0x5a));
  try {
    const snapshot = readStableBoundedFileSnapshot(exact.file, 4096);
    assert.equal(snapshot.bytes.length, 4096);
    assert.equal(snapshot.identity.size, 4096n);
    assert.throws(
      () => readStableBoundedFileSnapshot(oversized.file, 4096),
      /bounded_file_snapshot_invalid/u,
    );
  } finally {
    fs.rmSync(exact.root, { recursive: true, force: true });
    fs.rmSync(oversized.root, { recursive: true, force: true });
  }
});

test("bounded snapshotは読取り中growthとtruncateを拒否する", () => {
  for (const mutation of ["growth", "truncate"] as const) {
    const value = temporaryFile(Buffer.alloc(4096, 0x31));
    const originalReadSync = fs.readSync;
    let hasMutated = false;
    const replacement = function replacement(
      descriptor: number,
      buffer: NodeJS.ArrayBufferView,
      offset?: number,
      length?: number,
      position?: fs.ReadPosition | null,
    ) {
      const count = originalReadSync(
        descriptor,
        buffer,
        offset ?? 0,
        length ?? buffer.byteLength,
        position ?? null,
      );
      if (!hasMutated) {
        hasMutated = true;
        if (mutation === "growth") fs.appendFileSync(value.file, "x");
        else fs.truncateSync(value.file, 1024);
      }
      return count;
    };
    fs.readSync = replacement as unknown as typeof fs.readSync;
    try {
      assert.throws(
        () => readStableBoundedFileSnapshot(value.file, 8192),
        /bounded_file_snapshot_(?:changed|invalid)/u,
      );
    } finally {
      fs.readSync = originalReadSync;
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  }
});

test("bounded snapshotは同長leaf replacementとparent replacementを拒否する", () => {
  for (const mutation of ["leaf", "parent"] as const) {
    const value = temporaryFile(Buffer.alloc(4096, 0x41));
    const originalReadSync = fs.readSync;
    let hasMutated = false;
    const replacement = function replacement(
      descriptor: number,
      buffer: NodeJS.ArrayBufferView,
      offset?: number,
      length?: number,
      position?: fs.ReadPosition | null,
    ) {
      const count = originalReadSync(
        descriptor,
        buffer,
        offset ?? 0,
        length ?? buffer.byteLength,
        position ?? null,
      );
      if (!hasMutated) {
        hasMutated = true;
        if (mutation === "leaf") {
          fs.renameSync(value.file, `${value.file}.old`);
          fs.writeFileSync(value.file, Buffer.alloc(4096, 0x42));
        } else {
          const moved = `${value.root}.old`;
          fs.renameSync(value.root, moved);
          fs.mkdirSync(value.root);
          fs.writeFileSync(value.file, Buffer.alloc(4096, 0x42));
        }
      }
      return count;
    };
    fs.readSync = replacement as unknown as typeof fs.readSync;
    try {
      assert.throws(
        () => readStableBoundedFileSnapshot(value.file, 8192),
        /(?:bounded_file_snapshot_changed|EPERM)/u,
      );
    } finally {
      fs.readSync = originalReadSync;
      fs.rmSync(value.root, { recursive: true, force: true });
      fs.rmSync(`${value.root}.old`, { recursive: true, force: true });
    }
  }
});
