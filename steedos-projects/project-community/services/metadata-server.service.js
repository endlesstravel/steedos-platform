const MetadataService = require("@steedos/service-metadata-server");

console.startTime = Date.now();

module.exports = {
  name: "metadata-server",
  namespace: "steedos",
  mixins: [MetadataService],
}
