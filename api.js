const { packTargets } = require("./pack");
const { unpackArchive } = require("./unpack");

module.exports = {
  pack: packTargets,
  unpack: unpackArchive,
};
