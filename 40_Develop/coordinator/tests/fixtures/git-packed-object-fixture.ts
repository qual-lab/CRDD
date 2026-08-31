import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { createDockerProcessEnvironment } from "../../src/security/docker-owned-process.ts";

const GIT_EXECUTABLE = "C:\\Program Files\\Git\\cmd\\git.exe";

export function createGitPackedObjectFixture(kind: "base" | "ofs" | "ref") {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  const temporaryRoot = path.join(repositoryRoot, ".crdd", "test-tmp");
  for (const directory of [
    repositoryRoot,
    path.join(repositoryRoot, ".crdd"),
    temporaryRoot,
  ]) {
    assert.ok(fs.lstatSync(directory).isDirectory());
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(
      fs.realpathSync.native(directory).toLowerCase(),
      directory.toLowerCase(),
    );
  }
  const root = fs.mkdtempSync(path.join(temporaryRoot, "git-packed-"));
  const identity = fs.lstatSync(root, { bigint: true });
  function dispose() {
    const current = fs.lstatSync(root, { bigint: true });
    assert.ok(current.isDirectory() && !current.isSymbolicLink());
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    assert.equal(current.birthtimeNs, identity.birthtimeNs);
    assert.equal(
      fs.realpathSync.native(root).toLowerCase(),
      root.toLowerCase(),
    );
    assert.equal(path.dirname(root), temporaryRoot);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  }
  try {
    const home = path.join(root, "home");
    const source = path.join(root, "source.git");
    const commonDirectory = path.join(root, "pack-only");
    const hooks = path.join(root, "hooks");
    for (const directory of [home, hooks, commonDirectory])
      fs.mkdirSync(directory);
    const osEnvironment = createDockerProcessEnvironment();
    const environment = {
      SystemRoot: osEnvironment.SystemRoot,
      WINDIR: osEnvironment.WINDIR,
      HOME: home,
      USERPROFILE: home,
      TEMP: root,
      TMP: root,
      XDG_CONFIG_HOME: home,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(home, "empty-config"),
      GIT_TERMINAL_PROMPT: "0",
      GIT_ALLOW_PROTOCOL: "",
    };
    fs.writeFileSync(environment.GIT_CONFIG_GLOBAL, "", { flag: "wx" });
    function runGit(args: string[], input?: Buffer | string) {
      const result = spawnSync(GIT_EXECUTABLE, args, {
        cwd: root,
        env: environment,
        shell: false,
        windowsHide: true,
        input,
        timeout: 10_000,
        maxBuffer: 2_000_000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr.toString("utf8"));
      return result.stdout.toString("utf8").trim();
    }
    assert.match(runGit(["--version"]), /^git version 2\.54\.0(?:\.|$)/u);
    runGit(["init", "--bare", "--object-format=sha1", "--template=", source]);
    const gitArguments = ["--git-dir", source, "-c", `core.hooksPath=${hooks}`];
    function writeGitObject(type: string, bytes: Buffer) {
      return runGit(
        [...gitArguments, "hash-object", "-w", "-t", type, "--stdin"],
        bytes,
      );
    }
    const base = Buffer.from(
      Array.from(
        { length: 400 },
        (_entry, index) =>
          `${index.toString().padStart(4, "0")}:${createHash("sha256").update(`fixed-${index}`).digest("hex")}\n`,
      ).join(""),
    );
    const files = [base, Buffer.from(base), Buffer.from(base)].map(
      (bytes, index) => {
        if (index > 0) bytes.write(`variant-${index}`, 100 + index * 100);
        return {
          name: `sample-${index}.txt`,
          bytes,
          id: writeGitObject("blob", bytes),
          mode: index === 1 ? "100755" : "100644",
        };
      },
    );
    const tree = writeGitObject(
      "tree",
      Buffer.concat(
        files.map((file) =>
          Buffer.concat([
            Buffer.from(`${file.mode} ${file.name}\0`),
            Buffer.from(file.id, "hex"),
          ]),
        ),
      ),
    );
    const revision = writeGitObject(
      "commit",
      Buffer.from(
        `tree ${tree}\nauthor Fixture <fixture@example.invalid> 0 +0000\ncommitter Fixture <fixture@example.invalid> 0 +0000\n\nfixed pack fixture\n`,
      ),
    );
    const packDirectory = path.join(commonDirectory, "objects", "pack");
    fs.mkdirSync(packDirectory, { recursive: true });
    const packPrefix = path.join(packDirectory, "pack");
    const ids = [revision, tree, ...files.map((file) => file.id)];
    const hash = runGit(
      [
        ...gitArguments,
        "pack-objects",
        "--index-version=2",
        "--threads=1",
        "--depth=1",
        `--window=${kind === "base" ? 0 : 10}`,
        "--no-reuse-delta",
        "--no-reuse-object",
        ...(kind === "ofs"
          ? ["--delta-base-offset"]
          : ["--no-delta-base-offset"]),
        packPrefix,
      ],
      `${ids.join("\n")}\n`,
    );
    assert.match(hash, /^[a-f0-9]{40}$/u);
    const packPath = `${packPrefix}-${hash}.pack`;
    const indexPath = `${packPrefix}-${hash}.idx`;
    const pack = fs.readFileSync(packPath);
    const index = fs.readFileSync(indexPath);
    const count = index.readUInt32BE(8 + 255 * 4);
    assert.equal(count, ids.length);
    const entries = Array.from({ length: count }, (_entry, position) => {
      const id = index
        .subarray(1032 + position * 20, 1032 + (position + 1) * 20)
        .toString("hex");
      const offset = index.readUInt32BE(1032 + count * 24 + position * 4);
      assert.ok(offset < 0x80000000);
      return { id, offset, type: ((pack[offset] ?? 0) >> 4) & 7 };
    }).sort((left, right) => left.offset - right.offset);
    const expectedType = kind === "base" ? 3 : kind === "ofs" ? 6 : 7;
    const selected = files.find(
      (file) =>
        file.id ===
        entries.findLast((entry) => entry.type === expectedType)?.id,
    );
    assert.ok(selected, `Git did not generate requested blob storage: ${kind}`);
    const target = entries.find((entry) => entry.id === selected.id);
    assert.ok(target);
    let payloadOffset = target.offset;
    while ((pack.readUInt8(payloadOffset++) & 0x80) !== 0) {
      /* object header */
    }
    const referenceOffset = payloadOffset;
    if (kind === "ref") {
      assert.ok(
        files.some(
          (file) =>
            file.id ===
            pack.subarray(payloadOffset, payloadOffset + 20).toString("hex"),
        ),
      );
      payloadOffset += 20;
    } else if (kind === "ofs") {
      let byte = pack.readUInt8(payloadOffset++);
      let distance = byte & 0x7f;
      while ((byte & 0x80) !== 0) {
        byte = pack.readUInt8(payloadOffset++);
        distance = (distance + 1) * 128 + (byte & 0x7f);
      }
      assert.ok(
        entries.some(
          (entry) =>
            entry.offset === target.offset - distance && entry.type === 3,
        ),
      );
    }
    const end =
      entries.find((entry) => entry.offset > target.offset)?.offset ??
      pack.length - 20;
    const payload = inflateSync(pack.subarray(payloadOffset, end));
    assert.ok(payload.length > 0);
    assert.deepEqual(fs.readdirSync(path.join(commonDirectory, "objects")), [
      "pack",
    ]);
    return {
      root,
      commonDirectory,
      revision,
      tree,
      files,
      selected,
      target,
      entries,
      packPath,
      indexPath,
      pack,
      index,
      payload,
      payloadOffset,
      referenceOffset,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function encodeVariableInteger(value: number) {
  const bytes: number[] = [];
  do {
    const next = value % 128;
    value = Math.floor(value / 128);
    bytes.push(next | (value > 0 ? 0x80 : 0));
  } while (value > 0);
  return Buffer.from(bytes);
}

export function mutateGitPackedObjectFixture(
  fixture: ReturnType<typeof createGitPackedObjectFixture>,
  mutation:
    | "index-checksum"
    | "pack-checksum"
    | "reference"
    | "offset"
    | "integer"
    | "base-size"
    | "copy"
    | "result-size"
    | "object-id",
) {
  // Git creates read-only pack artifacts. Only this owned fixture is mutated.
  fs.chmodSync(fixture.packPath, 0o600);
  fs.chmodSync(fixture.indexPath, 0o600);
  const index = Buffer.from(fixture.index);
  let pack = Buffer.from(fixture.pack);
  if (mutation === "index-checksum") {
    index[index.length - 1] = index.readUInt8(index.length - 1) ^ 1;
    fs.writeFileSync(fixture.indexPath, index);
    return;
  }
  if (mutation === "pack-checksum") {
    pack[pack.length - 1] = pack.readUInt8(pack.length - 1) ^ 1;
    fs.writeFileSync(fixture.packPath, pack);
    return;
  }
  assert.equal(
    fixture.target,
    fixture.entries.at(-1),
    "inner mutation requires the verified last delta object",
  );
  assert.ok(fixture.target.type === 6 || fixture.target.type === 7);
  if (mutation === "reference") {
    assert.equal(fixture.target.type, 7);
    pack.fill(0, fixture.referenceOffset, fixture.referenceOffset + 20);
  } else if (mutation === "offset") {
    assert.equal(fixture.target.type, 6);
    // Distance one cannot point at the start of an indexed object.
    pack = Buffer.concat([
      pack.subarray(0, fixture.referenceOffset),
      Buffer.from([1]),
      pack.subarray(fixture.payloadOffset),
    ]);
  } else {
    let delta: Buffer;
    const size = fixture.selected.bytes.length;
    const header = Buffer.concat([
      encodeVariableInteger(size),
      encodeVariableInteger(size),
    ]);
    if (mutation === "integer") delta = Buffer.from([0x80]);
    else if (mutation === "base-size")
      delta = Buffer.concat([
        encodeVariableInteger(size + 1),
        encodeVariableInteger(size),
      ]);
    else if (mutation === "copy")
      delta = Buffer.concat([
        header,
        Buffer.from([0x9f, 0xff, 0xff, 0xff, 0x7f, 1]),
      ]);
    else if (mutation === "result-size") delta = header;
    else {
      const changed = Buffer.from(fixture.selected.bytes);
      changed[0] = changed.readUInt8(0) ^ 1;
      const chunks = [header];
      for (let offset = 0; offset < changed.length; offset += 127) {
        const chunk = changed.subarray(offset, offset + 127);
        chunks.push(Buffer.from([chunk.length]), chunk);
      }
      delta = Buffer.concat(chunks);
    }
    let remaining = Math.floor(delta.length / 16);
    const objectHeaderBytes = [
      (fixture.target.type << 4) | (delta.length % 16) | (remaining ? 0x80 : 0),
    ];
    while (remaining > 0) {
      const byte = remaining % 128;
      remaining = Math.floor(remaining / 128);
      objectHeaderBytes.push(byte | (remaining ? 0x80 : 0));
    }
    pack = Buffer.concat([
      pack.subarray(0, fixture.target.offset),
      Buffer.from(objectHeaderBytes),
      pack.subarray(fixture.referenceOffset, fixture.payloadOffset),
      deflateSync(delta),
      Buffer.alloc(20),
    ]);
  }
  const packHash = createHash("sha1").update(pack.subarray(0, -20)).digest();
  packHash.copy(pack, pack.length - 20);
  const count = fixture.entries.length;
  const identifiers = Array.from({ length: count }, (_entry, position) =>
    index
      .subarray(1032 + position * 20, 1032 + (position + 1) * 20)
      .toString("hex"),
  );
  const position = identifiers.indexOf(fixture.selected.id);
  assert.ok(position >= 0);
  index.writeUInt32BE(
    crc32(pack.subarray(fixture.target.offset, -20)),
    1032 + count * 20 + position * 4,
  );
  packHash.copy(index, index.length - 40);
  createHash("sha1")
    .update(index.subarray(0, -20))
    .digest()
    .copy(index, index.length - 20);
  assert.deepEqual(
    createHash("sha1").update(pack.subarray(0, -20)).digest(),
    pack.subarray(-20),
  );
  assert.deepEqual(index.subarray(-40, -20), pack.subarray(-20));
  assert.deepEqual(
    createHash("sha1").update(index.subarray(0, -20)).digest(),
    index.subarray(-20),
  );
  fs.writeFileSync(fixture.packPath, pack);
  fs.writeFileSync(fixture.indexPath, index);
}
