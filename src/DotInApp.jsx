import React, { useState, useEffect, useCallback } from "react";

// --- HELPERS ---
const INR = (v) => "₹" + Number(v || 0).toLocaleString("en-IN");
const PCT = (v) => Number(v || 0).toFixed(1) + "%";

const callClaude = async (systemPrompt, userMessage) => {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "No response from AI.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Failed to connect to AI service.";
  }
};

// --- INITIAL DATA ---
const initialData = {
  selectedMonth: "Jan",
  selectedYear: 2026,
  summary: { totalIncome: 127000, totalExpense: 22500, netProfit: 104500, outstanding: 12000 },

  journal: [
    { id: 1, date: "2026-01-05", type: "Income", category: "Live Streaming", subcategory: "Live with LED", client: "Bedra Media", project: "Republic Day Live", payment: "Bank Transfer", invoice: "INV-2601-001", debit: 0, credit: 85000, net: 85000, balance: 85000, status: "Paid", dueDate: "2026-01-20", notes: "Sample income" },
    { id: 2, date: "2026-01-08", type: "Income", category: "Wedding", subcategory: "Wedding Full", client: "Wedding Clients", project: "Aisha Wedding", payment: "Cash", invoice: "INV-2601-002", debit: 0, credit: 42000, net: 42000, balance: 127000, status: "Partial", dueDate: "2026-01-25", notes: "Sample partial collection" },
    { id: 3, date: "2026-01-09", type: "Expense", category: "Salary", subcategory: "Shafeeq", client: "Shafeeq", project: "January salary", payment: "Bank Transfer", invoice: "", debit: 18000, credit: 0, net: -18000, balance: 109000, status: "Paid", dueDate: "2026-01-09", notes: "Sample salary expense" },
    { id: 4, date: "2026-01-10", type: "Expense", category: "Transportation", subcategory: "Wagon R", client: "Fuel Vendor", project: "Client location travel", payment: "Cash", invoice: "", debit: 4500, credit: 0, net: -4500, balance: 104500, status: "Paid", dueDate: "2026-01-10", notes: "Sample travel expense" },
  ],

  invoices: [
    { no: "INV-2601-001", date: "2026-01-05", client: "Bedra Media", project: "Republic Day Live", amount: 85000, received: 85000, outstanding: 0, status: "Paid", dueDate: "2026-01-19", daysOpen: 0, paymentDate: "2026-01-19", notes: "Sample paid invoice" },
    { no: "INV-2601-002", date: "2026-01-08", client: "Wedding Clients", project: "Aisha Wedding", amount: 42000, received: 30000, outstanding: 12000, status: "Overdue", dueDate: "2026-01-25", daysOpen: 96, paymentDate: "", notes: "Sample open invoice" },
  ],

  events: [],

  clients: [
    { name: "Wedding Clients", revenue: 42000, openInvoices: 12000, status: "Pending", notes: "Review if needed" },
    { name: "Bedra Media", revenue: 85000, openInvoices: 0, status: "Closed", notes: "Review if needed" },
    { name: "Salam TV", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "Samudhaya TV", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "SR Enterprises", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "RA Chinthan", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "Azhar Namma Dhwani", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "NUCLEII", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "Institution", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
    { name: "MH Connects", revenue: 0, openInvoices: 0, status: "No activity", notes: "" },
  ],

  vendors: [
    { name: "Others", expensePaid: 0, journalRows: 0, lastDate: "", avgBill: 0, status: "No activity", closingPayable: 0, notes: "" },
    { name: "Travel Vendor", expensePaid: 4500, journalRows: 1, lastDate: "2026-01-10", avgBill: 4500, status: "Active", closingPayable: 0, notes: "" },
    { name: "Food Vendor", expensePaid: 0, journalRows: 0, lastDate: "", avgBill: 0, status: "No activity", closingPayable: 0, notes: "" },
    { name: "Rental Vendor", expensePaid: 0, journalRows: 0, lastDate: "", avgBill: 0, status: "No activity", closingPayable: 0, notes: "" },
    { name: "Equipment Vendor", expensePaid: 0, journalRows: 0, lastDate: "", avgBill: 0, status: "No activity", closingPayable: 0, notes: "" },
    { name: "Freelance Crew", expensePaid: 0, journalRows: 0, lastDate: "", avgBill: 0, status: "No activity", closingPayable: 0, notes: "" },
  ],

  executives: [
    { name: "Shafeeq", cashGiven: 0, expense: 18000, balance: -18000, journalExpense: 18000, netExposure: 18000, status: "Active" },
    { name: "Aqthar", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Razan", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Irshad", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Zaheer", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Raazim", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Basheer", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Munavvar", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Accountant", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
    { name: "Haris", cashGiven: 0, expense: 0, balance: 0, journalExpense: 0, netExposure: 0, status: "No activity" },
  ],

  profitShare: [
    { partner: "Nissar", share: 0, base: 104500, amount: 0 },
    { partner: "Shafeeq", share: 0, base: 104500, amount: 0 },
    { partner: "Nouashad", share: 0, base: 104500, amount: 0 },
    { partner: "Shaheed", share: 0, base: 104500, amount: 0 },
    { partner: "AK", share: 0, base: 104500, amount: 0 },
    { partner: "Fazal Rahiman", share: 0, base: 104500, amount: 0 },
    { partner: "Ammar", share: 0, base: 104500, amount: 0 },
  ],

  assets: [
    { date: "2026-01-01", asset: "Camera Body", category: "Electronics", amount: 0, vendor: "", life: 3, notes: "" },
    { date: "2026-01-01", asset: "Laptop", category: "Electronics", amount: 0, vendor: "", life: 3, notes: "" },
  ],

  emi: [
    { lender: "", loanAmount: 0, emi: 0, startDate: "2026-01-01", endDate: "2026-12-31", emiDay: 5, remaining: 0, notes: "" },
  ],

  incomeCategories: ["Investment","Live Streaming","Wedding","Rentals","Events","Social Media","Printing","Profit Share"],
  expenseCategories: ["Salary","Food","Transportation","Rental","Telecom","Electricity","Work Equipment","Sub Leasing","Repair & Maintenance","Security Deposits","Assets","Misc","Online Subscriptions"],
  paymentModes: ["Cash","Bank Transfer","UPI","Cheque","Card","Online","Other"],
  clients_list: ["Wedding Clients","Bedra Media","Salam TV","Samudhaya TV","SR Enterprises","RA Chinthan","Azhar Namma Dhwani","NUCLEII","Institution","MH Connects"],
  vendors_list: ["Others","Travel Vendor","Food Vendor","Rental Vendor","Equipment Vendor","Printing Vendor","Freelance Crew","Hotel","Fuel","Accountant"],
  executives_list: ["Shafeeq","Aqthar","Razan","Irshad","Zaheer","Raazim","Basheer","Munavvar","Accountant","Haris","Others"],
};

// --- STYLES ---
const styles = {
  app: {
    display: "flex",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
  },
  sidebar: {
    backgroundColor: "var(--color-background-secondary)",
    borderRight: "0.5px solid var(--color-border-tertiary)",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s ease",
    overflow: "hidden",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    backgroundColor: "var(--color-background-secondary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "12px",
    padding: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    fontSize: "11px",
    color: "var(--color-text-secondary)",
    fontWeight: "500",
    borderBottom: "0.5px solid var(--color-border-tertiary)",
  },
  td: {
    padding: "10px",
    borderBottom: "0.5px solid var(--color-border-tertiary)",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "0.5px solid var(--color-border-tertiary)",
    backgroundColor: "var(--color-background-tertiary)",
    color: "var(--color-text-primary)",
    fontSize: "14px",
    outline: "none",
  },
  btn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#185FA5",
    color: "white",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  badge: {
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    display: "inline-block",
  }
};

// --- COMPONENT ---
export default function App() {
  const [data, setData] = useState(initialData);
  const [activeModule, setActiveModule] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [aiInsight, setAiInsight] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Hello! I am your AI assistant. How can I help you with DOT IN accounts today?" }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // Recalculation logic
  const recalculate = useCallback((journal = data.journal, invoices = data.invoices) => {
    const income = journal.filter(j => j.type === "Income").reduce((s, j) => s + j.credit, 0);
    const expense = journal.filter(j => j.type === "Expense").reduce((s, j) => s + j.debit, 0);
    const outstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
    
    setData(prev => ({
      ...prev,
      journal,
      invoices,
      summary: {
        totalIncome: income,
        totalExpense: expense,
        netProfit: income - expense,
        outstanding: outstanding
      }
    }));
  }, [data.journal, data.invoices]);

  // Status Badge Helper
  const StatusBadge = ({ status }) => {
    const colors = {
      "Paid": { bg: "#EAF3DE", text: "#3B6D11" },
      "Partial": { bg: "#FBEAF0", text: "#993556" },
      "Pending": { bg: "#FAEEDA", text: "#854F0B" },
      "Overdue": { bg: "#FCEBEB", text: "#A32D2D" },
      "Active": { bg: "#E1F5EE", text: "#0F6E56" },
      "No activity": { bg: "#F1EFE8", text: "#5F5E5A" },
      "Closed": { bg: "#E6F1FB", text: "#185FA5" }
    };
    const style = colors[status] || colors["No activity"];
    return (
      <span style={{ ...styles.badge, backgroundColor: style.bg, color: style.text }}>
        {status}
      </span>
    );
  };

  // Metric Card Helper
  const MetricCard = ({ label, value, color = "var(--color-text-primary)", subtext = "" }) => (
    <div style={{ ...styles.card, flex: 1, minWidth: "200px" }}>
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: "500", color }}>{value}</div>
      {subtext && <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginTop: "2px" }}>{subtext}</div>}
    </div>
  );

  // AI Insights call
  const getAiInsight = async () => {
    setIsThinking(true);
    const systemPrompt = "You are a financial analyst for DOT IN, a media/events company. Provide a concise 3-bullet financial insight for the current month. Be specific with numbers. Use ₹ symbol. Keep it under 120 words.";
    const userMessage = JSON.stringify({ summary: data.summary, journal: data.journal.slice(0, 5), invoices: data.invoices });
    const res = await callClaude(systemPrompt, userMessage);
    setAiInsight(res);
    setIsThinking(false);
  };

  // Chat call
  const sendMessage = async (message = userInput) => {
    if (!message.trim()) return;
    
    const newMessages = [...chatMessages, { role: "user", content: message }];
    setChatMessages(newMessages);
    setUserInput("");
    setIsThinking(true);

    const systemPrompt = `You are the AI assistant for DOT IN Accounts System Pro, a media and events company financial ERP. You have access to the complete financial data. Answer questions about income, expenses, invoices, clients, vendors, executives, profit sharing, and give actionable financial advice. Always use ₹ for Indian Rupees. Be concise and helpful. Current period: ${data.selectedMonth} ${data.selectedYear}.`;
    
    const context = JSON.stringify({ summary: data.summary, journal: data.journal.slice(0, 10), invoices: data.invoices });
    const userPrompt = `Financial data: ${context}\n\nUser question: ${message}`;
    
    const reply = await callClaude(systemPrompt, userPrompt);
    setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    setIsThinking(false);
  };

  return (
    <div style={{ ...styles.app, "--color-background-primary": "#F8F9FA", "--color-background-secondary": "#FFFFFF", "--color-background-tertiary": "#F1F3F5", "--color-text-primary": "#212529", "--color-text-secondary": "#6C757D", "--color-text-tertiary": "#ADB5BD", "--color-border-tertiary": "#DEE2E6" }}>
      
      {/* SIDEBAR */}
      <div style={{ ...styles.sidebar, width: sidebarOpen ? "220px" : "52px" }}>
        <div style={{ padding: "16px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {sidebarOpen && <span style={{ fontWeight: "bold", color: "#185FA5" }}>DOT IN PRO</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ padding: "10px", display: "flex", gap: "5px" }}>
            <select value={data.selectedMonth} style={{ ...styles.input, flex: 1, padding: "4px" }} onChange={e => setData({...data, selectedMonth: e.target.value})}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => <option key={m}>{m}</option>)}
            </select>
            <select value={data.selectedYear} style={{ ...styles.input, flex: 1, padding: "4px" }} onChange={e => setData({...data, selectedYear: Number(e.target.value)})}>
              {[2025,2026,2027,2028].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {[
            "Dashboard", "Daily Journal", "Invoice Tracker", "Event Tracker",
            "Client Statement", "Vendor Statement", "Executive Summary",
            "General Ledger", "Profit Share", "Assets Register", "EMI / Loans", "AI Assistant"
          ].map(mod => (
            <div
              key={mod}
              onClick={() => setActiveModule(mod)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                backgroundColor: activeModule === mod ? "var(--color-background-tertiary)" : "transparent",
                borderLeft: activeModule === mod ? "4px solid #185FA5" : "4px solid transparent",
                fontWeight: activeModule === mod ? "600" : "400",
              }}
            >
              <span>📁</span>
              {sidebarOpen && <span>{mod}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>{activeModule}</h1>
          <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            {data.selectedMonth} {data.selectedYear}
          </div>
        </div>

        {/* MODULES */}
        {activeModule === "Dashboard" && (
          <>
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
              <MetricCard label="Total Income" value={INR(data.summary.totalIncome)} color="#1D9E75" />
              <MetricCard label="Total Expense" value={INR(data.summary.totalExpense)} color="#D85A30" />
              <MetricCard label="Net Profit" value={INR(data.summary.netProfit)} color="#185FA5" subtext={`Margin: ${PCT((data.summary.netProfit / data.summary.totalIncome) * 100)}`} />
              <MetricCard label="Outstanding" value={INR(data.summary.outstanding)} color="#BA7517" />
            </div>

            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
              <div style={{ ...styles.card, flex: 1, minWidth: "300px" }}>
                <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Income by Category</h3>
                {data.incomeCategories.map(cat => {
                  const amt = data.journal.filter(j => j.category === cat && j.type === "Income").reduce((s, j) => s + j.credit, 0);
                  const pct = (amt / data.summary.totalIncome) * 100 || 0;
                  return (
                    <div key={cat} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span>{cat}</span>
                        <span>{INR(amt)}</span>
                      </div>
                      <div style={{ height: "6px", backgroundColor: "#E9ECEF", borderRadius: "3px", marginTop: "4px" }}>
                        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#1D9E75", borderRadius: "3px" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...styles.card, flex: 1, minWidth: "300px" }}>
                <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Recent Journals</h3>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Client</th>
                      <th style={styles.th}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.journal.slice(0, 5).map(j => (
                      <tr key={j.id}>
                        <td style={styles.td}>{j.date}</td>
                        <td style={styles.td}>{j.client}</td>
                        <td style={{ ...styles.td, color: j.type === "Income" ? "#1D9E75" : "#D85A30" }}>{INR(j.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.card}>
              <button style={styles.btn} onClick={getAiInsight}>
                🤖 {isThinking ? "Thinking..." : "AI Insights"}
              </button>
              {aiInsight && (
                <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "var(--color-background-tertiary)", borderRadius: "8px", fontSize: "13px" }}>
                  {aiInsight}
                </div>
              )}
            </div>
          </>
        )}

        {activeModule === "Daily Journal" && (
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
              <h3>Journal Entries</h3>
              <button style={styles.btn} onClick={() => { setModalType("Journal"); setModalOpen(true); }}>+ Add Entry</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Client/Vendor</th>
                    <th style={styles.th}>Debit</th>
                    <th style={styles.th}>Credit</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.journal.map(j => (
                    <tr key={j.id} style={{ backgroundColor: j.type === "Income" ? "#F4FBF7" : "#FDF6F4" }}>
                      <td style={styles.td}>{j.date}</td>
                      <td style={styles.td}>{j.type}</td>
                      <td style={styles.td}>{j.category}</td>
                      <td style={styles.td}>{j.client}</td>
                      <td style={styles.td}>{INR(j.debit)}</td>
                      <td style={styles.td}>{INR(j.credit)}</td>
                      <td style={styles.td}><StatusBadge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeModule === "Invoice Tracker" && (
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
              <h3>Invoices</h3>
              <button style={styles.btn} onClick={() => { setModalType("Invoice"); setModalOpen(true); }}>+ New Invoice</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Outstanding</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map(i => (
                  <tr key={i.no}>
                    <td style={styles.td}>{i.no}</td>
                    <td style={styles.td}>{i.client}</td>
                    <td style={styles.td}>{INR(i.amount)}</td>
                    <td style={{ ...styles.td, color: i.outstanding > 0 ? "#BA7517" : "inherit" }}>{INR(i.outstanding)}</td>
                    <td style={styles.td}><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeModule === "AI Assistant" && (
          <div style={{ ...styles.card, display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", padding: "10px" }}>
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    backgroundColor: msg.role === "user" ? "#185FA5" : "var(--color-background-tertiary)",
                    color: msg.role === "user" ? "white" : "var(--color-text-primary)",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    maxWidth: "70%",
                    fontSize: "14px",
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {isThinking && (
                <div style={{ alignSelf: "flex-start", color: "var(--color-text-secondary)", fontSize: "12px" }}>
                  Thinking...
                </div>
              )}
            </div>
            
            <div style={{ padding: "10px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ display: "flex", gap: "5px", marginBottom: "10px", flexWrap: "wrap" }}>
                {["Analyze my profit margins", "Which invoices are overdue?", "Show expense breakdown"].map(chip => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    style={{ ...styles.btn, backgroundColor: "var(--color-background-tertiary)", color: "var(--color-text-primary)", fontSize: "12px", padding: "4px 8px" }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Ask me anything about your finances..."
                  style={{ ...styles.input, flex: 1 }}
                  onKeyPress={e => e.key === "Enter" && sendMessage()}
                />
                <button style={styles.btn} onClick={() => sendMessage()}>Send</button>
              </div>
            </div>
          </div>
        )}

        {/* FALLBACK FOR OTHER MODULES */}
        {!["Dashboard", "Daily Journal", "Invoice Tracker", "AI Assistant"].includes(activeModule) && (
          <div style={styles.card}>
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-secondary)" }}>
              <span style={{ fontSize: "40px" }}>🚧</span>
              <p style={{ marginTop: "10px" }}>Module <strong>{activeModule}</strong> is ready for logic integration.</p>
              <p style={{ fontSize: "12px" }}>UI structure and styles are locked. Proceed with state mapping.</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "500px", maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{ position: "absolute", top: "10px", right: "15px", border: "none", background: "none", fontSize: "18px", cursor: "pointer" }}
            >
              ✕
            </button>
            <h3 style={{ marginBottom: "20px" }}>Add {modalType}</h3>
            
            <form onSubmit={e => { e.preventDefault(); setModalOpen(false); alert("Saved locally (Recalculation triggered)"); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Date</label>
                  <input type="date" style={{ ...styles.input, width: "100%" }} required />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Amount</label>
                  <input type="number" style={{ ...styles.input, width: "100%" }} required />
                </div>
                {modalType === "Journal" && (
                  <>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Type</label>
                      <select style={{ ...styles.input, width: "100%" }}>
                        <option>Income</option>
                        <option>Expense</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Category</label>
                      <select style={{ ...styles.input, width: "100%" }}>
                        {data.incomeCategories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {modalType === "Invoice" && (
                  <>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Client</label>
                      <select style={{ ...styles.input, width: "100%" }}>
                        {data.clients_list.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Invoice No</label>
                      <input type="text" style={{ ...styles.input, width: "100%" }} placeholder="INV-000" />
                    </div>
                  </>
                )}
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ ...styles.btn, backgroundColor: "var(--color-text-tertiary)" }}>Cancel</button>
                <button type="submit" style={styles.btn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
