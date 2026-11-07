
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Link
} from "react-router-dom";

import Transactions from "./pages/Transactions";
import Statements from "./pages/Statements";
import Accounts from "./pages/Accounts";
import AuditorDashboard from "./pages/AuditorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";

import "./App.css";

// Get logged-in user
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

// Reusable Back button
function BackToDashboard() {
  return (
    <Link to="/" className="back-button">
      <span>←</span> Back to Dashboard
    </Link>
  );
}

// Wrapper for account-holder inner pages
function PageWithBack({ children }) {
  return (
    <div className="page-wrapper">
      <BackToDashboard />
      {children}
    </div>
  );
}

// Account Holder Dashboard
function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = getUser();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          window.location.href = "/login";
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`
        };

        const accountResponse = await fetch(
          "http://localhost:5000/api/accounts",
          { headers }
        );

        const accountData = await accountResponse.json();

        if (!accountResponse.ok) {
          throw new Error(
            accountData.message || "Unable to load accounts"
          );
        }

        setAccounts(accountData.accounts || []);

        const transactionResponse = await fetch(
          "http://localhost:5000/api/transactions",
          { headers }
        );

        const transactionData = await transactionResponse.json();

        if (!transactionResponse.ok) {
          throw new Error(
            transactionData.message || "Unable to load transactions"
          );
        }

        setRecentTransactions(transactionData.transactions || []);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.balance),
    0
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="app-container">

      {/* Sidebar */}
      <aside className="sidebar">

        <h2 className="logo">
          LedgerLine<span>.</span>
        </h2>

        <p className="menu-title">MAIN MENU</p>

        <nav>
          <Link className="nav-link active" to="/">
            Dashboard
          </Link>

          <Link className="nav-link" to="/accounts">
            My Accounts
          </Link>

          <Link className="nav-link" to="/transactions">
            Transactions
          </Link>

          <Link className="nav-link" to="/statements">
            Statements
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <p className="menu-title">ACCOUNT</p>

          <button
            className="nav-link"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

      </aside>

      {/* Main dashboard */}
      <main className="main-content">

        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back to LedgerLine</p>
          </div>

          <div className="user-profile">
            <div className="avatar">
              {(user.full_name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <span>
              {user.full_name || "Account Holder"}
            </span>
          </div>
        </header>

        <section className="welcome-section">
          <h2>
            Welcome back, {user.full_name || "User"}!
          </h2>

          <p>
            Here's what's happening with your accounts today.
          </p>
        </section>

        {/* Summary cards */}
        <section className="summary-grid">

          <div className="summary-card balance-card">
            <p>Total Balance</p>

            <h2>
              {loading
                ? "Loading..."
                : `₹ ${totalBalance.toFixed(2)}`}
            </h2>

            <span>Across all accounts</span>
          </div>

          <div className="summary-card">
            <p>Total Accounts</p>

            <h2>
              {loading ? "..." : accounts.length}
            </h2>

            <span>Your accounts</span>
          </div>

          <div className="summary-card">
            <p>Account Status</p>

            <h2>
              {loading ? "..." : "Active"}
            </h2>

            <span>LedgerLine account</span>
          </div>

        </section>

        {error && (
          <p style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {/* My accounts */}
        <section className="section-card">
          <h2>My Accounts</h2>

          {loading ? (
            <p>Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p>
              No accounts found. Create your first account.
            </p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                style={{ padding: "12px 0" }}
              >
                <strong>
                  {account.account_type.toUpperCase()}
                </strong>

                <p>
                  Account: {account.account_number}
                </p>

                <h3>
                  ₹ {Number(account.balance).toFixed(2)}
                </h3>
              </div>
            ))
          )}
        </section>

        {/* Recent transactions */}
        <section className="section-card">
          <h2>Recent Transactions</h2>

          {loading ? (
            <p>Loading transactions...</p>
          ) : recentTransactions.length === 0 ? (
            <p>No transactions available yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Initiated By</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        {transaction.transaction_type}
                      </td>

                      <td>
                        ₹ {Number(transaction.amount).toFixed(2)}
                      </td>

                      <td>
                        {new Date(
                          transaction.created_at
                        ).toLocaleString()}
                      </td>

                      <td>
                        {transaction.initiated_by}
                      </td>

                      <td>
                        {transaction.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="section-card">
          <h2>Quick Actions</h2>

          <div className="actions-grid">

            <button
              onClick={() => window.location.href = "/transactions"}
            >
              Make Transaction
            </button>

            <button
              onClick={() => window.location.href = "/accounts"}
            >
              View Accounts
            </button>

            <button
              onClick={() => window.location.href = "/statements"}
            >
              View Statements
            </button>

          </div>
        </section>

      </main>
    </div>
  );
}

// Redirect users according to their role
function RoleRedirect() {
  const token = localStorage.getItem("token");
  const user = getUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "auditor") {
    return <Navigate to="/auditor" replace />;
  }

  if (user.role === "administrator") {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === "account_holder") {
    return <Dashboard />;
  }

  return <Navigate to="/login" replace />;
}

// Protect role-specific pages
function ProtectedRole({ allowedRole, children }) {
  const token = localStorage.getItem("token");
  const user = getUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Main application routes
function App() {
  return (
    <Routes>

      {/* Authentication */}
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      {/* Auditor dashboard */}
      <Route
        path="/auditor"
        element={
          <ProtectedRole allowedRole="auditor">
            <AuditorDashboard />
          </ProtectedRole>
        }
      />

      {/* Administrator dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRole allowedRole="administrator">
            <AdminDashboard />
          </ProtectedRole>
        }
      />

      {/* Account holder pages */}
      <Route
        path="/accounts"
        element={
          <ProtectedRole allowedRole="account_holder">
            <PageWithBack>
              <Accounts />
            </PageWithBack>
          </ProtectedRole>
        }
      />

      <Route
        path="/transactions"
        element={
          <ProtectedRole allowedRole="account_holder">
            <PageWithBack>
              <Transactions />
            </PageWithBack>
          </ProtectedRole>
        }
      />

      <Route
        path="/statements"
        element={
          <ProtectedRole allowedRole="account_holder">
            <PageWithBack>
              <Statements />
            </PageWithBack>
          </ProtectedRole>
        }
      />

      {/* Role-based home dashboard */}
      <Route
        path="/"
        element={<RoleRedirect />}
      />

      {/* Invalid routes */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}

export default App;
