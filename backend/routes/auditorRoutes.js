const express = require("express");
const router = express.Router();

const {
  getOverview,
  getAllTransactions,
  getAllLedgerEntries,
  getAllAuditLogs
} = require("../controllers/auditorController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// All routes are restricted to auditors
router.use(protect, authorize("auditor"));

router.get("/overview", getOverview);
router.get("/transactions", getAllTransactions);
router.get("/ledger", getAllLedgerEntries);
router.get("/audit-logs", getAllAuditLogs);

module.exports = router;