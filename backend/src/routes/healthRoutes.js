const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "SEMAI Backend API",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
