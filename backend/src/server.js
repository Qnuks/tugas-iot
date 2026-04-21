const app = require("./app");
const config = require("./config");
const mqttService = require("./services/mqttService");

mqttService.connectMqtt();

app.listen(config.port, () => {
  console.log(`SEMAI Backend API berjalan pada port ${config.port}`);
});
