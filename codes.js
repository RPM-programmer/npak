const path = require("path");
const TIER_3_POPULAR_EMOJI = require(path.join(__dirname, "emoji_codes.js"));
const { getCjkChars } = require(path.join(__dirname, "cjk.js"));
const NIBBLE_MAP = {
  0: 0b0000,
  1: 0b0001,
  2: 0b0010,
  3: 0b0011,
  4: 0b0100,
  5: 0b0101,
  6: 0b0110,
  7: 0b0111,
  8: 0b1000,
  9: 0b1001,
  SEP: 0b1010,
  CMD_DIR: 0b1011,
  CMD_FILE: 0b1100,
  CMD_DATA: 0b1101,
  CMD_END: 0b1110,
  CMD_BIN: 0b1111,
};
const REV_NIBBLE_MAP = Object.fromEntries(
  Object.entries(NIBBLE_MAP).map(([k, v]) => [v, k]),
);
const TIER_1_ULTRA_COMMON =
  " \n\r\t" +
  "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё" +
  "etaoinshrdlcumwfgypbvkjxqz" +
  ".,!?-_:;()[]{}\"'/\\+=*<>@#$%^&|~`" +
  "0123456789" +
  "ОЕАИНТСРВЛКМДПУЯЫЬГЗБЧЙХЖШЮЦЩЭФЪЁ" +
  "ETAOINSHRDLCUMWFGYPBVKJXQZ";
const TIER_2_COMMON_SYMBOLS =
  "«»—–…№₽$€£¥©®™°±×÷≈≠≤≥∞√∑∏∫∂∆πµΩ" +
  "→←↑↓↔⇒⇔•·▪▫●○■□▲△▼▽◆◇★☆✓✔✕✖✗✘" +
  "ўЎіІїЇєЄґҐ" +
  "äöüßÄÖÜéèêëàâîïôùûçÉÈÊËÀÂÎÏÔÙÛÇáíóúñÁÍÓÚÑ";
const CHAR_TO_NUM = new Map();
const NUM_TO_CHAR = [];
function registerChar(char) {
  if (!CHAR_TO_NUM.has(char)) {
    const code = NUM_TO_CHAR.length;
    CHAR_TO_NUM.set(char, code);
    NUM_TO_CHAR.push(char);
  }
}
for (const char of TIER_1_ULTRA_COMMON) registerChar(char);
for (const char of TIER_2_COMMON_SYMBOLS) registerChar(char);
for (const char of TIER_3_POPULAR_EMOJI) registerChar(char);
for (const char of getCjkChars()) registerChar(char);
for (let cp = 0x0020; cp <= 0x323af; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  if (cp >= 0xe000 && cp <= 0xf8ff) continue;
  if (cp >= 0xf0000) continue;
  registerChar(String.fromCodePoint(cp));
}
function charToCode(char) {
  const code = CHAR_TO_NUM.get(char);
  if (code !== undefined) return code;
  return NUM_TO_CHAR.length + char.codePointAt(0);
}
function codeToChar(num) {
  if (num < NUM_TO_CHAR.length) {
    return NUM_TO_CHAR[num];
  }
  return String.fromCodePoint(num - NUM_TO_CHAR.length);
}
module.exports = {
  NIBBLE_MAP,
  REV_NIBBLE_MAP,
  CHAR_TO_NUM,
  NUM_TO_CHAR,
  charToCode,
  codeToChar,
};
