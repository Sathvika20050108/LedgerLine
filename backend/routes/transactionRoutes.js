
const express = require("express");
const router = express.Router();

const {
  deposit,
  withdraw,
  transfer,
  getMyTransactions
} = require("../controllers/transactionController");

const {
  reverseTransaction
} = require("../controllers/reversalController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// Account-holder money movement routes
router.post("/deposit", protect, authorize("account_holder"), deposit);
router.post("/withdraw", protect, authorize("account_holder"), withdraw);
router.post("/transfer", protect, authorize("account_holder"), transfer);

// Recent transaction history
router.get("/", protect, authorize("account_holder"), getMyTransactions);

// Administrator-only reversal route
router.post(
  "/:transactionId/reverse",
  protect,
  authorize("administrator"),
  reverseTransaction
);

module.exports = router;
