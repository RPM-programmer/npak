const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
console.log(`Определена система: ${os.platform()} (${os.arch()})`);
try {
  console.log("Установка зависимостей и глобальной команды npak...");
  execSync("npm install", { stdio: "inherit" });
  execSync("npm install -g .", { stdio: "inherit" });
  console.log(
    "\x1b[32mКоманда npak успешно зарегистрирована в системе!\x1b[0m",
  );
} catch (err) {
  console.error(
    "\x1b[31mДля глобальной установки в Linux/macOS запустите скрипт через sudo node setup.js\x1b[0m",
  );
}
if (os.platform() === "linux") {
  const sudoUser = process.env.SUDO_USER;
  const home = sudoUser ? path.join("/home", sudoUser) : os.homedir();
  const iconSrc = path.join(__dirname, "npak-icon.png");

  if (fs.existsSync(iconSrc)) {
    const iconDir = path.join(
      home,
      ".local/share/icons/hicolor/512x512/mimetypes",
    );
    const mimeDir = path.join(home, ".local/share/mime/packages");
    const appDir = path.join(home, ".local/share/applications");

    fs.mkdirSync(iconDir, { recursive: true });
    fs.mkdirSync(mimeDir, { recursive: true });
    fs.mkdirSync(appDir, { recursive: true });

    fs.copyFileSync(iconSrc, path.join(iconDir, "application-x-npak.png"));
    const ns = "http://" + "www.freedesktop.org/standards/shared-mime-info";
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="${ns}">
  <mime-type type="application/x-npak">
    <comment>Node Pack Archive</comment>
    <magic priority="50">
      <match type="string" offset="0" value="NPAK"/>
    </magic>
    <glob pattern="*.npak"/>
  </mime-type>
</mime-info>\n`;

    fs.writeFileSync(path.join(mimeDir, "npak.xml"), xmlContent, "utf8");
    let npakBin = "npak";
    try {
      npakBin = execSync("which npak").toString().trim();
    } catch (_) {}

    const desktopContent = `[Desktop Entry]
Name=NPAK Unpacker
Comment=Распаковка архивов .npak
Exec=${npakBin} %f
Icon=application-x-npak
Terminal=true
Type=Application
MimeType=application/x-npak;
`;
    fs.writeFileSync(
      path.join(appDir, "npak-unpacker.desktop"),
      desktopContent,
      "utf8",
    );
    if (sudoUser) {
      try {
        execSync(
          `chown -R ${sudoUser}:${sudoUser} "${path.join(home, ".local")}"`,
        );
      } catch (_) {}
    }

    try {
      execSync(
        `update-mime-database "${path.join(home, ".local/share/mime")}"`,
      );
      execSync(
        `gtk-update-icon-cache "${path.join(home, ".local/share/icons/hicolor")}" -f`,
      );
      execSync(`update-desktop-database "${appDir}"`);
      execSync(`xdg-mime default npak-unpacker.desktop application/x-npak`);
      console.log(
        "\x1b[32mИконка и ассоциации .npak для Linux настроены!\x1b[0m",
      );
    } catch (_) {}
  }
}
