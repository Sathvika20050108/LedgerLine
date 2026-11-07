
import { useEffect, useState } from "react";

function Transactions() {
  const [accounts, setAccounts] = useState([]);
  const [type, setType] = useState("deposit");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleTransaction = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (type === "transfer" && accountId === toAccountId) {
      setError("Select two different accounts.");
      return;
    }

    setLoading(true);

    const endpoint =
      type === "deposit"
        ? "/deposit"
        : type === "withdraw"
          ? "/withdraw"
          : "/transfer";

    const body = {
      amount,
      idempotencyKey: crypto.randomUUID()
    };

    if (type === "transfer") {
      body.fromAccountId = accountId;
      body.toAccountId = toAccountId;
    } else {
      body.accountId = accountId;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Transaction failed");
      }

      setMessage(data.message);
      setAmount("");
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "35px" }}>
      <h1>Transactions</h1>
      <p>Deposit, withdraw or transfer money securely.</p>

      <form
        onSubmit={handleTransaction}
        style={{
          background: "white",
          padding: "25px",
          marginTop: "25px",
          borderRadius: "12px",
          maxWidth: "550px"
        }}
      >
        <label>Transaction Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ display: "block", width: "100%", padding: "12px", margin: "10px 0 20px" }}
        >
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
          <option value="transfer">Transfer</option>
        </select>

        <label>
          {type === "transfer" ? "From Account" : "Account"}
        </label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          style={{ display: "block", width: "100%", padding: "12px", margin: "10px 0 20px" }}
        >
          <option value="">Select Account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_number} - {account.account_type}
            </option>
          ))}
        </select>

        {type === "transfer" && (
          <>
            <label>To Account</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              required
              style={{ display: "block", width: "100%", padding: "12px", margin: "10px 0 20px" }}
            >
              <option value="">Select Destination Account</option>
              {accounts
                .filter((account) => account.id !== accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_number} - {account.account_type}
                  </option>
                ))}
            </select>
          </>
        )}

        <label>Amount (₹)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          required
          style={{ display: "block", width: "100%", padding: "12px", margin: "10px 0 20px" }}
        />

        {message && <p style={{ color: "green" }}>{message}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" disabled={loading || accounts.length === 0}>
          {loading ? "Processing..." : "Submit Transaction"}
        </button>
      </form>
    </div>
  );
}

export default Transactions;
