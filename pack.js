const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rawPalette = require("chalk-palette");
const chalk_palette = rawPalette.default || rawPalette;
const { NIBBLE_MAP, CHAR_TO_NUM } = require(path.join(__dirname, "codes.js"));
const { handleHumanError } = require(path.join(__dirname, "errors.js"));

class DiskBitWriter {
  constructor(fd) {
    this.fd = fd;
    this.hash = crypto.createHash("sha256");
    this.chunkBuf = Buffer.alloc(65536);
    this.offset = 0;
    this.highNibble = null;
  }

  writeNibble(nibble) {
    if (this.highNibble === null) {
      this.highNibble = nibble;
    } else {
      const byte = (this.highNibble << 4) | nibble;
      this.highNibble = null;
      this.chunkBuf[this.offset++] = byte;
      if (this.offset === this.chunkBuf.length) {
        this.flush();
      }
    }
  }

  alignByte() {
    if (this.highNibble !== null) {
      this.writeNibble(0);
    }
  }

  writeRawBuffer(buf) {
    this.flush();
    this.hash.update(buf);
    fs.writeSync(this.fd, buf);
  }

  writeString(str) {
    for (const char of str) {
      const code = CHAR_TO_NUM[char];
      if (code !== undefined) {
        const numStr = String(code);
        for (let i = 0; i < numStr.length; i++) {
          this.writeNibble(NIBBLE_MAP[numStr[i]]);
        }
        this.writeNibble(NIBBLE_MAP["SEP"]);
      } else {
        const fallback = String(CHAR_TO_NUM["?"]);
        for (let i = 0; i < fallback.length; i++) {
          this.writeNibble(NIBBLE_MAP[fallback[i]]);
        }
        this.writeNibble(NIBBLE_MAP["SEP"]);
      }
    }
  }

  writeBinaryFile(fileBuf) {
    this.writeNibble(NIBBLE_MAP["CMD_BIN"]);
    this.alignByte();

    const sizeHeader = Buffer.alloc(4);
    sizeHeader.writeUInt32BE(fileBuf.length, 0);
    this.writeRawBuffer(sizeHeader);
    this.writeRawBuffer(fileBuf);
  }

  flush() {
    if (this.offset > 0) {
      const slice = this.chunkBuf.subarray(0, this.offset);
      this.hash.update(slice);
      fs.writeSync(this.fd, slice);
      this.offset = 0;
    }
  }

  finish() {
    let padding = 0;
    if (this.highNibble !== null) {
      padding = 4;
      this.writeNibble(0);
    }
    this.flush();
    return {
      padding,
      checksum: this.hash.digest().subarray(0, 4),
    };
  }
}

function canCompressAsText(buffer) {
  if (buffer.length === 0) return true;
  for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
    if (buffer[i] === 0) return false;
  }
  const str = buffer.toString("utf8");
  if (str.includes("\uFFFD")) return false;
  return true;
}

function countTotalItems(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return 1;

  let count = 0;
  const items = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const item of items) {
    count++;
    if (item.isDirectory()) {
      count += countTotalItems(path.join(targetPath, item.name));
    }
  }
  return count;
}

function packTargets(sources, outputArchivePath) {
  let fd = null;
  try {
    const sourceList = Array.isArray(sources) ? sources : [sources];

    if (!outputArchivePath.endsWith(".npak")) {
      outputArchivePath += ".npak";
    }

    let totalSteps = 0;
    for (const src of sourceList) {
      if (!fs.existsSync(src)) {
        const e = new Error(`Путь "${src}" не существует.`);
        e.isCustom = true;
        throw e;
      }
      totalSteps += countTotalItems(src);
    }

    if (totalSteps === 0) {
      const e = new Error(`Выбранная папка пустая — нечего упаковывать.`);
      e.isCustom = true;
      throw e;
    }

    fd = fs.openSync(outputArchivePath, "w");
    fs.writeSync(fd, Buffer.alloc(9));

    const writer = new DiskBitWriter(fd);
    const bar = chalk_palette.animation.progressBar(totalSteps);
    let currentStep = 0;

    function writeSingleFile(fullPath, relPath) {
      writer.writeNibble(NIBBLE_MAP["CMD_FILE"]);
      writer.writeString(relPath);

      const fileBuf = fs.readFileSync(fullPath);

      if (canCompressAsText(fileBuf)) {
        writer.writeNibble(NIBBLE_MAP["CMD_DATA"]);
        writer.writeString(fileBuf.toString("utf8"));
        writer.writeNibble(NIBBLE_MAP["CMD_END"]);
      } else {
        writer.writeBinaryFile(fileBuf);
      }

      currentStep++;
      bar.update(currentStep);
    }

    function walkDir(baseRoot, currentPath) {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        const relPath = path.relative(baseRoot, fullPath).replace(/\\/g, "/");

        if (item.isDirectory()) {
          writer.writeNibble(NIBBLE_MAP["CMD_DIR"]);
          writer.writeString(relPath);
          writer.writeNibble(NIBBLE_MAP["CMD_END"]);

          currentStep++;
          bar.update(currentStep);

          walkDir(baseRoot, fullPath);
        } else if (item.isFile()) {
          writeSingleFile(fullPath, relPath);
        }
      }
    }

    for (const src of sourceList) {
      const stat = fs.statSync(src);
      if (stat.isFile()) {
        writeSingleFile(src, path.basename(src));
      } else if (stat.isDirectory()) {
        if (sourceList.length > 1) {
          const folderName = path.basename(src);
          writer.writeNibble(NIBBLE_MAP["CMD_DIR"]);
          writer.writeString(folderName);
          writer.writeNibble(NIBBLE_MAP["CMD_END"]);
          walkDir(path.dirname(src), src);
        } else {
          walkDir(src, src);
        }
      }
    }

    const { padding, checksum } = writer.finish();
    const header = Buffer.concat([
      Buffer.from("NPAK"),
      checksum,
      Buffer.from([padding]),
    ]);
    fs.writeSync(fd, header, 0, 9, 0);

    const finalSize = fs.fstatSync(fd).size;
    fs.closeSync(fd);
    fd = null;

    const sizeMB = (finalSize / (1024 * 1024)).toFixed(2);
    console.log(
      `\n\x1b[32mГотово! Упаковано в ${outputArchivePath} (${sizeMB} МБ / ${finalSize} байт)\x1b[0m`,
    );
  } catch (err) {
    if (fd !== null) fs.closeSync(fd);
    handleHumanError(err, "Упаковка в .npak");
  }
}

module.exports = { packFolder: packTargets, packTargets };
