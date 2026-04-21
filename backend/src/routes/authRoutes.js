const express = require("express");
const config = require("../config");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === config.adminEmail && password === config.adminPassword) {
    return res.json({
      success: true,
      data: {
        user: {
          email: config.adminEmail,
          name: "Admin SEMAI"
        },
        token: "semai-demo-token"
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: "Email atau password salah."
  });
});

module.exports = router;
