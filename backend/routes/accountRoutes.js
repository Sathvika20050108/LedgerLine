
const express = require("express");
const router = express.Router();

const {
  createAccount,
  getMyAccounts
} = require("../controllers/accountController");

const {
  getAccountStatement
} = require("../controllers/statementController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("account_holder"),
  createAccount
);

router.get(
  "/",
  protect,
  authorize("account_holder"),
  getMyAccounts
);

router.get(
  "/:accountId/statement",
  protect,
  authorize("account_holder"),
  getAccountStatement
);

module.exports = router;
