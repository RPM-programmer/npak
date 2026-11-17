const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { packTargets } = require(path.join(__dirname, "pack.js"));
const { unpackArchive } = require(path.join(__dirname, "unpack.js"));
const { handleHumanError } = require(path.join(__dirname, "errors.js"));

const rawArgs = process.argv.slice(2);
const args = [];
let format = "npak";
let formatExplicitlySet = false;

for (let i = 0; i < rawArgs.length; i++) {
  if ((rawArgs[i] === "--format" || rawArgs[i] === "-f") && rawArgs[i + 1]) {
    format = rawArgs[i + 1].toLowerCase().replace(".", "");
    formatExplicitlySet = true;
    i++;
  } else {
    args.push(rawArgs[i]);
  }
}

const command = args[0];

function delegateToZip(action, sources, target) {
  try {
    const isWin = process.platform === "win32";

    if (action === "pack") {
      const outZip = target.endsWith(".zip") ? target : `${target}.zip`;
      const sourceList = Array.isArray(sources) ? sources : [sources];

      if (isWin) {
        execFileSync("tar", ["-a", "-cf", outZip, ...sourceList], {
          stdio: "inherit",
        });
      } else {
        execFileSync(
          "python3",
          ["-m", "zipfile", "-c", outZip, ...sourceList],
          { stdio: "inherit" },
        );
      }
      console.log(
        `\x1b[32m[ZIP] Готово! Задача передана системному архиватору -> ${outZip}\x1b[0m`,
      );
    } else if (action === "unpack") {
      if (!fs.existsSync(sources)) {
        const e = new Error(`ZIP-архив "${sources}" не найден.`);
        e.isCustom = true;
        throw e;
      }
      fs.mkdirSync(target, { recursive: true });

      if (isWin) {
        execFileSync("tar", ["-xf", sources, "-C", target], {
          stdio: "inherit",
        });
      } else {
        execFileSync("python3", ["-m", "zipfile", "-e", sources, target], {
          stdio: "inherit",
        });
      }
      console.log(
        `\x1b[32m[ZIP] Успешно распаковано в папку: ${target}\x1b[0m`,
      );
    }
  } catch (err) {
    handleHumanError(
      err,
      `ZIP-${action === "pack" ? "упаковка" : "распаковка"}`,
    );
  }
}
if ((command === "pack" || command === "p") && args[1] && args[2]) {
  const source = args[1];
  const target = args[2];

  if (format === "zip" || (!formatExplicitlySet && target.endsWith(".zip"))) {
    delegateToZip("pack", source, target);
  } else {
    packTargets(source, target);
  }
} else if ((command === "unpack" || command === "u") && args[1] && args[2]) {
  const archive = args[1];
  const targetDir = args[2];

  if (format === "zip" || (!formatExplicitlySet && archive.endsWith(".zip"))) {
    delegateToZip("unpack", archive, targetDir);
  } else {
    unpackArchive(archive, targetDir);
  }
} else if (command === "pack-auto" && args.length > 1) {
  const targets = args.slice(1).map((p) => path.resolve(p));
  const firstItem = targets[0];
  const parentDir = path.dirname(firstItem);
  const baseName =
    targets.length === 1 ? path.parse(firstItem).name : "archive";

  if (format === "zip") {
    const outZip = path.join(parentDir, `${baseName}.zip`);
    delegateToZip("pack", targets, outZip);
  } else {
    const outArchive = path.join(parentDir, `${baseName}.npak`);
    packTargets(targets, outArchive);
  }
} else if (
  typeof command === "string" &&
  (command.endsWith(".npak") || command.endsWith(".zip"))
) {
  const archivePath = path.resolve(command);
  const ext = path.extname(archivePath);
  const folderName = path.basename(archivePath, ext);
  const outputDir = path.join(path.dirname(archivePath), folderName);

  if (ext === ".zip" || format === "zip") {
    delegateToZip("unpack", archivePath, outputDir);
  } else {
    unpackArchive(archivePath, outputDir);
  }
} else {
  console.log("Использование:");
  console.log("  Упаковать:   npak pack ./my_project ./archive.npak");
  console.log("  Распаковать: npak unpack ./archive.npak ./restored");
}
