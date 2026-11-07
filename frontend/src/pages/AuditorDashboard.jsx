
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api/auditor";

function AuditorDashboard() {
  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
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
    const fetchAuditorData = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const endpoints = [
          "overview",
          "transactions",
          "ledger",
          "audit-logs"
        ];

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
            data[failedIndex].message ||
            "Unable to load auditor records"
          );
        }

        setOverview(data[0].overview);
        setTransactions(data[1].transactions || []);
        setLedgerEntries(data[2].ledgerEntries || []);
        setAuditLogs(data[3].auditLogs || []);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAuditorData();
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

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleString() : "—";
  };

  const formatAmount = (amount) => {
    return amount == null
      ? "—"
      : `₹${Number(amount).toFixed(2)}`;
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "15px",
    fontSize: "13px"
  };

  const cellStyle = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap"
  };

  const sectionStyle = {
    marginTop: "30px",
    padding: "22px",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
  };

  if (loading) {
    return (
      <div style={{ padding: "35px" }}>
        <h2>Loading Auditor Dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "35px" }}>
        <h2>Auditor Dashboard</h2>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
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

      {/* Header */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "15px"
      }}>
        <div>
          <h1 style={{ marginBottom: "8px" }}>
            LedgerLine — Auditor Dashboard
          </h1>
          <p>Welcome, {user.full_name || "Auditor"}!</p>
          <p style={{ color: "#64748b" }}>
            Read-only access to financial records
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "11px 22px",
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

      {/* System Overview */}
      <h2 style={{ marginTop: "35px" }}>System Overview</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "18px"
      }}>
        {summaryCards.map(([label, value]) => (
          <div key={label} style={{
            background: "white",
            padding: "22px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}>
            <p style={{ color: "#64748b" }}>{label}</p>
            <h2 style={{ fontSize: "28px", margin: "10px 0" }}>
              {Number(value)}
            </h2>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <section style={sectionStyle}>
        <h2>All Transactions</h2>

        {transactions.length === 0 ? (
          <p>No transactions recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Transaction ID",
                    "Type",
                    "Amount",
                    "Status",
                    "Date"
                  ].map((heading) => (
                    <th key={heading} style={cellStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td style={cellStyle}>{transaction.id}</td>
                    <td style={cellStyle}>{transaction.transaction_type}</td>
                    <td style={cellStyle}>{formatAmount(transaction.amount)}</td>
                    <td style={cellStyle}>{transaction.status}</td>
                    <td style={cellStyle}>{formatDate(transaction.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ledger Entries */}
      <section style={sectionStyle}>
        <h2>Ledger Entries</h2>
        <p style={{ color: "#64748b" }}>
          Debit and credit records for financial transactions.
        </p>

        {ledgerEntries.length === 0 ? (
          <p>No ledger entries found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Entry ID",
                    "Transaction ID",
                    "Account ID",
                    "Entry Type",
                    "Amount"
                  ].map((heading) => (
                    <th key={heading} style={cellStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={cellStyle}>{entry.id}</td>
                    <td style={cellStyle}>{entry.transaction_id}</td>
                    <td style={cellStyle}>{entry.account_id}</td>
                    <td style={cellStyle}>
                      <strong>{entry.entry_type?.toUpperCase()}</strong>
                    </td>
                    <td style={cellStyle}>{formatAmount(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit Logs */}
      <section style={sectionStyle}>
        <h2>Audit Logs</h2>
        <p style={{ color: "#64748b" }}>
          Recorded system activities and transaction attempts.
        </p>

        {auditLogs.length === 0 ? (
          <p>No audit logs found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Log ID",
                    "User ID",
                    "Account ID",
                    "Action",
                    "Status",
                    "Date"
                  ].map((heading) => (
                    <th key={heading} style={cellStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={cellStyle}>{log.id}</td>
                    <td style={cellStyle}>{log.user_id || "—"}</td>
                    <td style={cellStyle}>{log.account_id || "—"}</td>
                    <td style={cellStyle}>
                      {log.action || log.event_type || "—"}
                    </td>
                    <td style={cellStyle}>
                      {log.status || log.result || "—"}
                    </td>
                    <td style={cellStyle}>{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer style={{
        marginTop: "30px",
        padding: "15px",
        textAlign: "center",
        color: "#64748b"
      }}>
        LedgerLine | Auditor Access | Read Only
      </footer>

    </div>
  );
}

export default AuditorDashboard;
