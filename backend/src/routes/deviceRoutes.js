const express = require("express");
const deviceService = require("../services/deviceService");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const data = await deviceService.listDevices();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await deviceService.registerDevice(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
