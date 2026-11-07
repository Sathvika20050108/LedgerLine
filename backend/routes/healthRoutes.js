
const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "LedgerLine API",
    status: "healthy",
    message: "All systems operational"
  });
});

module.exports = router;
