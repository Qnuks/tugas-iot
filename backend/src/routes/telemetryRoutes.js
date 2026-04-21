const express = require("express");
const telemetryService = require("../services/telemetryService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await telemetryService.getTelemetryList(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await telemetryService.ingestTelemetry(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", async (req, res, next) => {
  try {
    const csv = await telemetryService.exportTelemetryCsv(req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=semai-telemetry.csv"
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
