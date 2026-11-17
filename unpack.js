const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rawPalette = require("chalk-palette");
const chalk_palette = rawPalette.default || rawPalette;
const { REV_NIBBLE_MAP, codeToChar } = require(
  path.join(__dirname, "codes.js"),
);

const { handleHumanError } = require(path.join(__dirname, "errors.js"));

function unpackArchive(archivePath, targetFolder) {
  try {
    if (!fs.existsSync(archivePath)) {
      const e = new Error(`Файл архива "${archivePath}" не найден на диске.`);
      e.isCustom = true;
      throw e;
    }

    const buf = fs.readFileSync(archivePath);

    if (buf.length < 10) {
      const e = new Error(`Файл "${archivePath}" слишком мал или поврежден.`);
      e.isCustom = true;
      throw e;
    }

    if (buf.subarray(0, 4).toString() !== "NPAK") {
      const e = new Error(
        `Файл "${archivePath}" не является архивом формата .npak.`,
      );
      e.isCustom = true;
      throw e;
    }

    const savedChecksum = buf.subarray(4, 8);
    const padding = buf[8];
    const dataBytes = buf.subarray(9);

    const actualChecksum = crypto
      .createHash("sha256")
      .update(dataBytes)
      .digest()
      .subarray(0, 4);
    if (!savedChecksum.equals(actualChecksum)) {
      const e = new Error(
        `Целостность архива "${archivePath}" нарушена! Файл изменен или поврежден.`,
      );
      e.isCustom = true;
      throw e;
    }

    let mode = null;
    let currentPath = "";
    let textChunks = [];
    let digitBuffer = "";

    fs.mkdirSync(targetFolder, { recursive: true });

    let byteIdx = 0;
    let isLowNibble = false;
    const totalBytes = dataBytes.length;

    const bar = chalk_palette.animation.progressBar(100);
    let lastPercent = 0;

    while (byteIdx < totalBytes) {
      const currentPercent = Math.floor((byteIdx / totalBytes) * 100);
      if (currentPercent > lastPercent) {
        lastPercent = currentPercent;
        bar.update(lastPercent);
      }

      if (byteIdx === totalBytes - 1 && isLowNibble && padding === 4) {
        break;
      }

      const currentByte = dataBytes[byteIdx];
      const nibble = isLowNibble ? currentByte & 0x0f : currentByte >> 4;

      if (isLowNibble) {
        byteIdx++;
        isLowNibble = false;
      } else {
        isLowNibble = true;
      }

      const token = REV_NIBBLE_MAP[nibble];

      if (token === "CMD_DIR") {
        mode = "DIR";
        currentPath = "";
      } else if (token === "CMD_FILE") {
        mode = "FILE_PATH";
        currentPath = "";
      } else if (token === "CMD_DATA") {
        mode = "FILE_DATA";
        textChunks = [];
      } else if (token === "CMD_BIN") {
        if (isLowNibble) {
          byteIdx++;
          isLowNibble = false;
        }

        const binSize = dataBytes.readUInt32BE(byteIdx);
        byteIdx += 4;

        const binContent = dataBytes.subarray(byteIdx, byteIdx + binSize);
        byteIdx += binSize;

        const fullOutPath = path.join(targetFolder, currentPath);
        fs.mkdirSync(path.dirname(fullOutPath), { recursive: true });
        fs.writeFileSync(fullOutPath, binContent);
        mode = null;
      } else if (token === "CMD_END") {
        if (mode === "DIR") {
          fs.mkdirSync(path.join(targetFolder, currentPath), {
            recursive: true,
          });
        } else if (mode === "FILE_DATA") {
          const fullOutPath = path.join(targetFolder, currentPath);
          fs.mkdirSync(path.dirname(fullOutPath), { recursive: true });
          fs.writeFileSync(fullOutPath, textChunks.join(""), "utf8");
        }
        mode = null;
      } else if (token === "SEP") {
        const num = Number(digitBuffer);
        const char = codeToChar(num);
        if (mode === "DIR" || mode === "FILE_PATH") {
          currentPath += char;
        } else if (mode === "FILE_DATA") {
          textChunks.push(char);
        }
        digitBuffer = "";
      } else {
        digitBuffer += token;
      }
    }

    bar.update(100);
    console.log(
      `\n\x1b[32mУспешно распаковано в папку: ${targetFolder}\x1b[0m`,
    );
  } catch (err) {
    handleHumanError(err, "Распаковка архива");
  }
}

module.exports = { unpackArchive };
