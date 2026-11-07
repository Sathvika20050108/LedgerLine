
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api/admin";

function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const endpoints = ["overview", "users", "accounts"];

        const responses = await Promise.all(
          endpoints.map((endpoint) =>
            fetch(`${API}/${endpoint}`, { headers })
          )
        );

        const data = await Promise.all(
          responses.map((response) => response.json())
        );

        const failedIndex = responses.findIndex(
          (response) => !response.ok
        );

        if (failedIndex !== -1) {
          throw new Error(
            data[failedIndex].message || "Unable to load admin data"
          );
        }

        setOverview(data[0].overview);
        setUsers(data[1].users || []);
        setAccounts(data[2].accounts || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAdminData();
    } else {
      setError("Please log in to continue.");
      setLoading(false);
    }
  }, [token]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString() : "—";

  const formatAmount = (amount) =>
    amount == null ? "—" : `₹${Number(amount).toFixed(2)}`;

  const cardStyle = {
    background: "#ffffff",
    padding: "22px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "15px",
    fontSize: "13px"
  };

  const cellStyle = {
    padding: "13px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap"
  };

  if (loading) {
    return <div style={{ padding: "35px" }}>
      <h2>Loading Administrator Dashboard...</h2>
    </div>;
  }

  if (error) {
    return <div style={{ padding: "35px" }}>
      <h2>Administrator Dashboard</h2>
      <p style={{ color: "red" }}>{error}</p>
      <button onClick={logout}>Logout</button>
    </div>;
  }

  const summaryCards = overview
    ? [
        ["Total Users", overview.total_users],
        ["Total Accounts", overview.total_accounts],
        ["Total Transactions", overview.total_transactions],
        ["Ledger Entries", overview.total_ledger_entries],
        ["Audit Logs", overview.total_audit_logs]
      ]
    : [];

  return (
    <div style={{
      minHeight: "100vh",
      padding: "30px",
      background: "#f4f6fb",
      color: "#1e293b",
      fontFamily: "Arial, sans-serif"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "15px"
      }}>
        <div>
          <h1>LedgerLine — Administrator Dashboard</h1>
          <p>Welcome, {user.full_name || "Administrator"}!</p>
          <p style={{ color: "#64748b" }}>
            System management and monitoring
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "11px 20px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "7px",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </header>

      <section style={{ marginTop: "30px" }}>
        <h2>System Overview</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "18px",
          marginTop: "18px"
        }}>
          {summaryCards.map(([label, value]) => (
            <div key={label} style={cardStyle}>
              <p style={{ color: "#64748b", margin: 0 }}>{label}</p>
              <h2 style={{ marginBottom: 0 }}>{value ?? 0}</h2>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: "30px", overflowX: "auto" }}>
        <h2>Registered Users</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              {["Name", "Email", "Role", "Registered On"].map((heading) => (
                <th key={heading} style={cellStyle}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td style={cellStyle}>{item.full_name}</td>
                <td style={cellStyle}>{item.email}</td>
                <td style={cellStyle}>{item.role}</td>
                <td style={cellStyle}>{formatDate(item.created_at)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td style={cellStyle} colSpan="4">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ ...cardStyle, marginTop: "30px", overflowX: "auto" }}>
        <h2>All Accounts</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              {["Account Number", "Owner", "Email", "Type", "Balance", "Status"].map((heading) => (
                <th key={heading} style={cellStyle}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((item) => (
              <tr key={item.id}>
                <td style={cellStyle}>{item.account_number}</td>
                <td style={cellStyle}>{item.owner_name || "Platform"}</td>
                <td style={cellStyle}>{item.owner_email || "—"}</td>
                <td style={cellStyle}>{item.account_type || item.account_kind}</td>
                <td style={cellStyle}>{formatAmount(item.balance)}</td>
                <td style={cellStyle}>{item.status || "Active"}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td style={cellStyle} colSpan="6">No accounts found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <footer style={{
        marginTop: "35px",
        textAlign: "center",
        color: "#64748b",
        fontSize: "13px"
      }}>
        LedgerLine | Administrator Access
      </footer>
    </div>
  );
}

export default AdminDashboard;
