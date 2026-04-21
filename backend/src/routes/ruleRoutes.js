const express = require("express");
const ruleService = require("../services/ruleService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await ruleService.listRules(req.query.deviceCode || null);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const data = await ruleService.updateRule(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
