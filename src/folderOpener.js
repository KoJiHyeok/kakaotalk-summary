const { execFile } = require("child_process");

function openFolder(folderPath, { platform = process.platform, opener = execFile, logger = console } = {}) {
  return new Promise((resolve) => {
    let command = "xdg-open";
    let args = [folderPath];

    if (platform === "win32") {
      command = "explorer.exe";
      args = [folderPath];
    } else if (platform === "darwin") {
      command = "open";
      args = [folderPath];
    }

    try {
      opener(command, args, { windowsHide: true }, (error) => {
        if (error) {
          logger.warn?.("[watch] failed to open folder", error.message || String(error));
          resolve({ ok: false, error: error.message || String(error) });
          return;
        }
        resolve({ ok: true, error: "" });
      });
    } catch (error) {
      logger.warn?.("[watch] failed to open folder", error.message || String(error));
      resolve({ ok: false, error: error.message || String(error) });
    }
  });
}

module.exports = { openFolder };
