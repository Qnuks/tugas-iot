const express = require("express");
const actuatorService = require("../services/actuatorService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await actuatorService.listActuatorStates(req.query.deviceCode || null);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await actuatorService.setActuatorState(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
