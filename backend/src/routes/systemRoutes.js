const express = require("express");
const mqttService = require("../services/mqttService");

const router = express.Router();

router.get("/status", (_req, res) => {
  res.json({
    success: true,
    data: {
      mqtt: mqttService.getMqttState(),
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
