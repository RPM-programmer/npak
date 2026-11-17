const CJK_RANGES = [
  [0x3000, 0x303f],
  [0x3040, 0x309f],
  [0x30a0, 0x30ff],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7af],
  [0x3400, 0x4dbf],
];

function getCjkChars() {
  const chars = [];
  for (const [start, end] of CJK_RANGES) {
    for (let cp = start; cp <= end; cp++) {
      chars.push(String.fromCodePoint(cp));
    }
  }
  return chars;
}

module.exports = { getCjkChars };
