
const express = require("express");
const router = express.Router();

const {
  getAdminOverview,
  getAllUsers,
  getAllAccounts
} = require("../controllers/adminController");

const { protect, authorize } = require("../middleware/authMiddleware");

// Only administrators can access these routes
router.use(protect, authorize("administrator"));

router.get("/overview", getAdminOverview);
router.get("/users", getAllUsers);
router.get("/accounts", getAllAccounts);

module.exports = router;
