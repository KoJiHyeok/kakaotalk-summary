const test = require("node:test");
const assert = require("node:assert/strict");
const { openFolder } = require("../src/folderOpener");

test("openFolder uses explorer on Windows", async () => {
  let received = null;
  const result = await openFolder("C:\\Temp\\watch folder", {
    platform: "win32",
    opener: (command, args, options, callback) => {
      received = { command, args, options };
      callback(null);
    }
  });

  assert.equal(result.ok, true);
  assert.equal(received.command, "explorer.exe");
  assert.deepEqual(received.args, ["C:\\Temp\\watch folder"]);
  assert.equal(received.options.windowsHide, true);
});

test("openFolder returns failure details instead of throwing", async () => {
  const result = await openFolder("C:\\Missing\\watch", {
    platform: "win32",
    logger: { warn() {} },
    opener: (command, args, options, callback) => {
      callback(new Error("cannot open folder"));
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /cannot open folder/);
});

test("openFolder catches synchronous opener errors", async () => {
  const result = await openFolder("/tmp/watch", {
    platform: "linux",
    logger: { warn() {} },
    opener: () => {
      throw new Error("spawn failed");
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /spawn failed/);
});
