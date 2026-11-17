const fs = require('fs');
const os = require('os');
const path = require('path');

const logPath = path.join(os.homedir(), '.npak-error.log');

function handleHumanError(err, actionName) {
  let reason = err.message;

  if (err.code === 'ENOENT') {
    reason = `Не найден указанный файл или папка: "${err.path}"`;
  } else if (err.code === 'EACCES' || err.code === 'EPERM') {
    reason = `Нет прав доступа для чтения или записи: "${err.path}"`;
  } else if (err.code === 'EISDIR') {
    reason = `Ожидался файл, но вместо него указана папка: "${err.path}"`;
  } else if (err.code === 'ENOTDIR') {
    reason = `Ожидалась папка, но указан обычный файл: "${err.path}"`;
  } else if (err.isCustom) {
    reason = err.message;
  }

  console.error(`\x1b[31m[ОШИБКА при операции "${actionName}"] Причина: ${reason}\x1b[0m`);

  const time = new Date().toLocaleString('ru-RU');
  const logLine = `[${time}] Операция: ${actionName} | Причина: ${reason}\n`;
  fs.appendFileSync(logPath, logLine, 'utf8');
}

module.exports = { handleHumanError };
