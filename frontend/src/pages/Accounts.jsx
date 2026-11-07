
import { useEffect, useState } from "react";

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [accountType, setAccountType] = useState("savings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

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
        throw new Error(data.message || "Unable to fetch accounts");
      }

      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const createAccount = async () => {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ accountType })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account creation failed");
      }

      setMessage("Account created successfully!");
      await fetchAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: "35px" }}>
      <h1>My Accounts</h1>
      <p>Manage your LedgerLine bank accounts.</p>

      <div style={{ margin: "25px 0" }}>
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          style={{ padding: "12px", marginRight: "12px" }}
        >
          <option value="savings">Savings Account</option>
          <option value="current">Current Account</option>
        </select>

        <button onClick={createAccount}>
          + Create Account
        </button>
      </div>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <p>No accounts found. Create your first account.</p>
      ) : (
        accounts.map((account) => (
          <div
            key={account.id}
            style={{
              background: "white",
              padding: "22px",
              marginBottom: "15px",
              borderRadius: "12px",
              boxShadow: "0 3px 12px rgba(0,0,0,0.06)"
            }}
          >
            <h3>{account.account_type.toUpperCase()} ACCOUNT</h3>
            <p>Account Number: {account.account_number}</p>
            <h2>₹ {Number(account.balance).toFixed(2)}</h2>
            <p>Status: {account.status}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default Accounts;
