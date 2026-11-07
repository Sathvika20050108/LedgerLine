
import { useEffect, useState } from "react";

function Statements() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [statement, setStatement] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/accounts",
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load accounts");
        }

        setAccounts(data.accounts || []);

        if (data.accounts?.length > 0) {
          setAccountId(data.accounts[0].id);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    fetchAccounts();
  }, []);

  useEffect(() => {
    if (!accountId) return;

    const fetchStatement = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:5000/api/accounts/${accountId}/statement`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load statement");
        }

        setAccount(data.account);
        setStatement(data.statement || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [accountId]);

  return (
    <div style={{ padding: "35px" }}>
      <h1>Account Statements</h1>
      <p>View your account activity and transaction history.</p>

      <div style={{ margin: "25px 0" }}>
        <label>Select Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          style={{ display: "block", padding: "12px", marginTop: "10px" }}
        >
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.account_number} - {item.account_type}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {account && (
        <div style={{
          background: "white",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "20px"
        }}>
          <h3>{account.accountType.toUpperCase()} ACCOUNT</h3>
          <p>Account Number: {account.accountNumber}</p>
          <h2>₹ {account.currentBalance}</h2>
          <p>Status: {account.status}</p>
        </div>
      )}

      {loading ? (
        <p>Loading statement...</p>
      ) : (
        <div style={{
          background: "white",
          padding: "20px",
          borderRadius: "10px",
          overflowX: "auto"
        }}>
          <h2>Transaction History</h2>

          {statement.length === 0 ? (
            <p>No transactions found.</p>
          ) : (
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "15px"
            }}>
              <thead>
                <tr>
                  <th align="left">Date</th>
                  <th align="left">Type</th>
                  <th align="left">Amount</th>
                  <th align="left">Running Balance</th>
                  <th align="left">Initiated By</th>
                  <th align="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {statement.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.date).toLocaleString()}</td>
                    <td>{item.type}</td>
                    <td>{item.amount ? `₹ ${item.amount}` : "—"}</td>
                    <td>
                      {item.runningBalance
                        ? `₹ ${item.runningBalance}`
                        : "—"}
                    </td>
                    <td>{item.initiatedBy}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default Statements;
