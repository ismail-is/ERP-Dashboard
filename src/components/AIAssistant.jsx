import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Zap } from 'lucide-react';
import { cn } from '../utils/cn';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (v) => `₹${Math.floor(Number(v) || 0).toLocaleString('en-IN')}`;

// ─── Gemini API — tries models until one works ────────────────────────────────
const callGemini = async (systemPrompt, userPrompt) => {
  const API_KEY = "AIzaSyDA4ZYp6QZvQlmGkikktx3kAL7JXUNNLr0";
  if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY") return null;
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  const genAI = new GoogleGenerativeAI(API_KEY);
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      if (text) { console.log('Gemini OK:', modelName); return text; }
    } catch (err) {
      console.warn('Model failed:', modelName, err.message);
    }
  }
  return null;
};

// ─── Smart Local Engine ───────────────────────────────────────────────────────
const smartAnswer = (message, data) => {
  const msg = message.toLowerCase().trim();
  const employees = data.employees || [];
  const clients   = data.clients   || [];
  const expenses  = data.expenses  || [];
  const notes     = data.notes     || [];
  const ledger    = data.ledger    || [];
  const now       = new Date();
  const curMonth  = MONTHS[now.getMonth()];
  const curYear   = now.getFullYear();

  const mentionedMonth = MONTHS.find(m => msg.includes(m.toLowerCase()));
  const yearMatch = msg.match(/20\d{2}/);
  const mentionedYear = yearMatch ? parseInt(yearMatch[0]) : null;

  const allNames = [
    ...employees.map(e => e['Employee Name'] || ''),
    ...clients.map(c => c.name || ''),
  ].filter(n => n.trim().length > 1);
  const mentionedPerson = allNames.find(name => msg.includes(name.toLowerCase().trim()));

  const filterMonth = (arr, month, year, ...dateKeys) => arr.filter(r => {
    const val = dateKeys.map(k => r[k]).find(Boolean) || '';
    const d = new Date(val);
    return !isNaN(d) && MONTHS[d.getMonth()] === month && d.getFullYear() === year;
  });

  // GREETING
  const greets = ['hey', 'hi', 'hello', 'good morning', 'good evening', 'good afternoon'];
  if (greets.some(g => msg === g || msg.startsWith(g + ' ') || msg.startsWith(g + '!'))) {
    const hr = now.getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const staff = new Set(employees.map(e => e['Employee Name'])).size;
    return `${greet}! 👋 I'm your DOT IN ERP assistant.\n\n📊 Quick snapshot:\n• 👥 ${staff} staff members\n• 🏢 ${clients.length} clients\n• 📒 ${ledger.length} ledger entries\n• 🧾 ${expenses.length} expenses\n\nAsk me anything about your business data!`;
  }

  // TODAY
  if (msg.includes('today') || msg.includes('what date') || msg.includes('what day') || msg === 'date') {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return `📅 Today: ${days[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}\n⏰ Time: ${now.toLocaleTimeString('en-IN')}`;
  }

  // HELP
  if (msg.includes('help') || msg.includes('what can you')) {
    return `I can answer ANY ERP question! Try:\n\n📒 "Show Basheer's ledger this month"\n📅 "Previous month status"\n🏢 "List all clients with status"\n💰 "Total revenue and expenses"\n👥 "Show all employees"\n🧾 "Expense breakdown by category"\n📊 "Give me a business summary"`;
  }

  // SUMMARY
  if (msg.includes('summary') || msg.includes('overview') || msg.includes('report')) {
    const rev = clients.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const exp = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const lInc = ledger.filter(r => r.type === 'Income').reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const lExp = ledger.filter(r => r.type === 'Expense').reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const income = lInc || rev;
    const total  = lExp || exp;
    return `📊 Business Summary\n\n👥 Staff: ${new Set(employees.map(e => e['Employee Name'])).size} (${employees.length} rows)\n🏢 Clients: ${clients.length}\n📒 Ledger: ${ledger.length} entries\n🧾 Expenses: ${expenses.length}\n\n💚 Total Income: ${fmt(income)}\n🔴 Total Expenses: ${fmt(total)}\n📈 Net Profit: ${fmt(income - total)}`;
  }

  // PERSON LEDGER
  if (mentionedPerson) {
    const name = mentionedPerson.trim();
    let rows = employees.filter(e => (e['Employee Name'] || '').toLowerCase() === name.toLowerCase());
    if (mentionedMonth) rows = filterMonth(rows, mentionedMonth, mentionedYear || curYear, 'Date', 'date');
    if (rows.length === 0) return `No entries found for ${name}${mentionedMonth ? ` in ${mentionedMonth}` : ''}.`;
    const given = rows.reduce((s, r) => s + (Number(r['Cash Given (₹)']) || 0), 0);
    const spent = rows.reduce((s, r) => s + (Number(r['Expense (₹)']) || 0), 0);
    const bal   = given - spent;
    let res = `📒 ${name}'s Ledger${mentionedMonth ? ` — ${mentionedMonth} ${mentionedYear || curYear}` : ''}:\n\n`;
    res += `📋 Entries: ${rows.length}\n💵 Cash Given: ${fmt(given)}\n🧾 Expenses: ${fmt(spent)}\n${bal >= 0 ? '✅' : '⚠️'} Balance: ${fmt(Math.abs(bal))} ${bal >= 0 ? '(Surplus)' : '(Deficit)'}\n\n📋 Details:\n`;
    rows.forEach((r, i) => {
      res += `${i+1}. ${r.Date || r.date || '—'} | ${r['Project / Reference'] || '—'} | Given: ${fmt(r['Cash Given (₹)'])} | Exp: ${fmt(r['Expense (₹)'])} | ${r.Status || '—'}\n`;
    });
    return res;
  }

  // PREVIOUS / LAST MONTH
  if (msg.includes('previous month') || msg.includes('last month') || msg.includes('prev month')) {
    const pd = new Date(curYear, now.getMonth() - 1, 1);
    const pm = MONTHS[pd.getMonth()], py = pd.getFullYear();
    const lRows = filterMonth(ledger, pm, py, 'date', 'Date');
    const eRows = filterMonth(expenses, pm, py, 'date', 'Date');
    const empR  = filterMonth(employees, pm, py, 'Date', 'date');
    const inc  = lRows.filter(r => r.type === 'Income').reduce((s, r) => s + (Number(r.credit)||0), 0);
    const lExp = lRows.filter(r => r.type === 'Expense').reduce((s, r) => s + (Number(r.debit)||0), 0);
    const eExp = eRows.reduce((s, e) => s + (Number(e.amount)||0), 0);
    const total = lExp || eExp;
    return `📅 Previous Month: ${pm} ${py}\n\n📊 Ledger: ${lRows.length} entries\n🧾 Expenses: ${eRows.length} entries\n👥 Employee rows: ${empR.length}\n\n💚 Income: ${fmt(inc)}\n🔴 Expenses: ${fmt(total)}\n📈 Net: ${fmt(inc - total)}`;
  }

  // THIS MONTH
  if (msg.includes('this month') || msg.includes('current month') || msg.includes('month status') || msg.includes('this months')) {
    const lRows = filterMonth(ledger, curMonth, curYear, 'date', 'Date');
    const eRows = filterMonth(expenses, curMonth, curYear, 'date', 'Date');
    const empR  = filterMonth(employees, curMonth, curYear, 'Date', 'date');
    const inc  = lRows.filter(r => r.type === 'Income').reduce((s, r) => s + (Number(r.credit)||0), 0);
    const lExp = lRows.filter(r => r.type === 'Expense').reduce((s, r) => s + (Number(r.debit)||0), 0);
    const eExp = eRows.reduce((s, e) => s + (Number(e.amount)||0), 0);
    const total = lExp || eExp;
    return `📅 This Month: ${curMonth} ${curYear}\n\n📊 Ledger: ${lRows.length} entries\n🧾 Expenses: ${eRows.length} entries\n👥 Employee rows: ${empR.length}\n\n💚 Income: ${fmt(inc)}\n🔴 Expenses: ${fmt(total)}\n📈 Net: ${fmt(inc - total)}`;
  }

  // LEDGER
  if (msg.includes('ledger') || msg.includes('journal') || msg.includes('transaction')) {
    let rows = mentionedMonth ? filterMonth(ledger, mentionedMonth, mentionedYear || curYear, 'date', 'Date') : ledger;
    if (rows.length === 0) return `No ledger entries found${mentionedMonth ? ` for ${mentionedMonth}` : ''}.`;
    const inc  = rows.filter(r => r.type === 'Income').reduce((s, r) => s + (Number(r.credit)||0), 0);
    const exp  = rows.filter(r => r.type === 'Expense').reduce((s, r) => s + (Number(r.debit)||0), 0);
    return `📒 Ledger${mentionedMonth ? ` — ${mentionedMonth}` : ''}:\n\n📊 ${rows.length} entries\n💚 Income: ${fmt(inc)}\n🔴 Expenses: ${fmt(exp)}\n📈 Net: ${fmt(inc - exp)}\n\nRecent:\n` +
      rows.slice(0, 5).map((r, i) => `${i+1}. ${r.date||r.Date||'—'} | ${r.category||r.Category||'—'} | ${r.type==='Income'?'+'+fmt(r.credit):'-'+fmt(r.debit)}`).join('\n');
  }

  // EMPLOYEES
  if (msg.includes('employee') || msg.includes('staff') || msg.includes('worker')) {
    const names = [...new Set(employees.map(e => (e['Employee Name']||'').trim()).filter(Boolean))];
    if (msg.includes('how many') || msg.includes('count') || msg.includes('total')) {
      return `👥 ${names.length} staff members (${employees.length} total rows)\n\nNames: ${names.join(', ')}`;
    }
    if (msg.includes('list') || msg.includes('who') || msg.includes('names')) {
      return `👥 Staff Members (${names.length}):\n${names.map((n, i) => `${i+1}. ${n}`).join('\n')}`;
    }
    const given = employees.reduce((s, e) => s + (Number(e['Cash Given (₹)'])||0), 0);
    const spent = employees.reduce((s, e) => s + (Number(e['Expense (₹)'])||0), 0);
    return `👥 ${names.length} staff | ${employees.length} rows\n💵 Cash Given: ${fmt(given)}\n🧾 Expenses: ${fmt(spent)}\n💰 Balance: ${fmt(given - spent)}`;
  }

  // CLIENTS
  if (msg.includes('client') || msg.includes('customer')) {
    if (msg.includes('how many') || msg.includes('count')) return `🏢 You have ${clients.length} clients.`;
    if (msg.includes('status')) return `🏢 Client Status:\n${clients.map(c => `• ${c.name||'—'}: ${c.status||'Unknown'}`).join('\n')}`;
    if (msg.includes('list') || msg.includes('names')) return `🏢 Clients (${clients.length}):\n${clients.map((c,i) => `${i+1}. ${c.name||'—'} | ${c.status||'—'} | ${fmt(c.amount)}`).join('\n')}`;
    if (msg.includes('revenue') || msg.includes('amount')) {
      const total = clients.reduce((s, c) => s + (Number(c.amount)||0), 0);
      return `💰 Client Revenue: ${fmt(total)}\n\n${clients.map(c => `• ${c.name}: ${fmt(c.amount)}`).join('\n')}`;
    }
    const total = clients.reduce((s, c) => s + (Number(c.amount)||0), 0);
    return `🏢 Clients: ${clients.length} | Revenue: ${fmt(total)}\nActive: ${clients.filter(c=>c.status==='Active').length} | Pending: ${clients.filter(c=>c.status==='Pending').length}`;
  }

  // EXPENSES
  if (msg.includes('expense') || msg.includes('spend') || msg.includes('cost')) {
    let rows = mentionedMonth ? filterMonth(expenses, mentionedMonth, mentionedYear || curYear, 'date', 'Date') : expenses;
    const total = rows.reduce((s, e) => s + (Number(e.amount)||0), 0);
    if (msg.includes('category') || msg.includes('breakdown')) {
      const map = {};
      rows.forEach(e => { const c = e.category||'Other'; map[c] = (map[c]||0) + Number(e.amount||0); });
      const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]);
      return `🧾 Expenses by Category${mentionedMonth?` (${mentionedMonth})`:''}:\n\nTotal: ${fmt(total)}\n\n${sorted.map(([cat,amt]) => `• ${cat}: ${fmt(amt)}`).join('\n')}`;
    }
    return `🧾 Expenses${mentionedMonth?` in ${mentionedMonth}`:''}:\nTotal: ${fmt(total)} (${rows.length} entries)\n\nRecent:\n${rows.slice(-5).reverse().map(e => `• ${e.date||'—'} | ${e.category||'—'}: ${fmt(e.amount)}`).join('\n')}`;
  }

  // REVENUE / PROFIT
  if (msg.includes('revenue') || msg.includes('income') || msg.includes('profit') || msg.includes('earn')) {
    const lInc = ledger.filter(r => r.type==='Income').reduce((s,r) => s+(Number(r.credit)||0), 0);
    const lExp = ledger.filter(r => r.type==='Expense').reduce((s,r) => s+(Number(r.debit)||0), 0);
    const cRev = clients.reduce((s,c) => s+(Number(c.amount)||0), 0);
    const eExp = expenses.reduce((s,e) => s+(Number(e.amount)||0), 0);
    const inc = lInc || cRev, exp = lExp || eExp;
    return `💰 Revenue Overview:\n\n📈 Total Income: ${fmt(inc)}\n📉 Total Expenses: ${fmt(exp)}\n${inc-exp>=0?'✅':'⚠️'} Net Profit: ${fmt(inc-exp)}`;
  }

  // NOTES
  if (msg.includes('note')) {
    if (msg.includes('how many') || msg.includes('count')) return `📝 ${notes.length} sticky notes.`;
    return notes.length > 0 ? `📝 Notes (${notes.length}):\n${notes.map((n,i) => `${i+1}. ${n.title||'—'}: ${n.content||'—'}`).join('\n')}` : 'No notes found.';
  }

  // DEFAULT
  return `I can answer any ERP question! Try:\n\n• "Show Basheer's ledger this month"\n• "Previous month status"\n• "What is today's date?"\n• "How many clients do we have?"\n• "Total expenses in May"\n• "Show employee list"\n• "Give me a business summary"\n• "Expense breakdown by category"`;
};

// ─── Component ────────────────────────────────────────────────────────────────
export const AIAssistant = ({ data }) => {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hello! 👋 I'm your DOT IN ERP AI Assistant.\n\nI have FULL ACCESS to your Google Sheet data — employees, clients, expenses, ledger, invoices, and more.\n\nAsk me anything! For example:\n• "Show Basheer's ledger this month"\n• "What is total revenue?"\n• "Previous month status"\n• "List all clients with status"`
  }]);
  const [input, setInput]       = useState('');
  const [thinking, setThinking] = useState(false);
  const [geminiOn, setGeminiOn] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const send = async (msg = input) => {
    if (!msg.trim() || thinking) return;
    const userMsg = msg.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setThinking(true);

    const allData = {
      employees: data.employees || [],
      clients:   data.clients   || [],
      expenses:  data.expenses  || [],
      notes:     data.notes     || [],
      ledger:    data.ledger    || [],
      invoices:  data.invoices  || [],
      events:    data.events    || [],
    };

    const systemPrompt = `You are the AI assistant for DOT IN Accounts System Pro — a media and events company ERP.
You have FULL ACCESS to Google Sheet data: employees, clients, expenses, ledger, invoices, events, notes.
Rules:
1. ALWAYS answer using the provided data. Never say you don't have access.
2. For any person name (Basheer, Shafeeq, etc.), find their employee ledger entries and show a full breakdown.
3. Filter by month/year when asked. Current month: ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}.
4. Always use ₹ for amounts in Indian Rupee format.
5. Be detailed: show individual entries, totals, and balances.
6. Format clearly with emojis, bullet points, and line items.`;

    const summarize = (arr, label) =>
      arr.length > 40 ? `${label} (${arr.length} records, first 40): ${JSON.stringify(arr.slice(0,40))}` : `${label}: ${JSON.stringify(arr)}`;

    const context = [
      summarize(allData.employees, 'EMPLOYEES'),
      summarize(allData.clients,   'CLIENTS'),
      summarize(allData.expenses,  'EXPENSES'),
      summarize(allData.ledger,    'LEDGER'),
      summarize(allData.invoices,  'INVOICES'),
      summarize(allData.events,    'EVENTS'),
      `NOTES: ${JSON.stringify(allData.notes)}`,
    ].join('\n\n');

    const userPrompt = `=== ERP DATA ===\n${context}\n\n=== QUESTION ===\n${userMsg}`;

    let reply = null;
    let usedGemini = false;
    try {
      reply = await callGemini(systemPrompt, userPrompt);
      if (reply) usedGemini = true;
    } catch { reply = null; }

    if (!reply) reply = smartAnswer(userMsg, allData);

    setGeminiOn(usedGemini);
    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    setThinking(false);
  };

  const chips = [
    "Show Basheer's ledger this month",
    "Previous month status",
    "How many clients do we have?",
    "Total revenue and expenses",
    "Show business summary",
    "Expense breakdown by category",
    "List all employees",
    "What is today's date?",
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-180px)] max-h-[760px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Bot size={22} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">AI Assistant</h2>
            <p className="text-[11px] text-gray-400 font-medium">
              {geminiOn ? '✨ Powered by Gemini • Full Google Sheet access' : '⚡ Smart Engine • Full Google Sheet access'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium text-gray-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex items-start gap-3 max-w-[88%]', m.role === 'user' ? 'ml-auto flex-row-reverse' : '')}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
              m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-indigo-600')}>
              {m.role === 'user' ? <User size={15}/> : <Bot size={15}/>}
            </div>
            <div className={cn('px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap font-medium',
              m.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none')}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bot size={15}/>
            </div>
            <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-tl-none text-[13px] text-gray-400 font-medium flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"/>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]"/>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]"/>
              </span>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Status */}
      <div className="px-5 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center gap-2 text-[11px] text-indigo-700 font-medium flex-shrink-0">
        <Zap size={12} className="text-indigo-500 flex-shrink-0"/>
        <span>Full ERP data access • Gemini AI + Smart Local Engine</span>
      </div>

      {/* Quick chips */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {chips.map(chip => (
            <button key={chip} onClick={() => send(chip)}
              className="flex-shrink-0 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-full text-[11px] font-bold text-gray-600 whitespace-nowrap transition-colors flex items-center gap-1 shadow-sm">
              <Sparkles size={10} className="text-indigo-400"/>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/50 flex-shrink-0">
        <div className="flex gap-3">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !thinking && send()}
            placeholder="Ask anything — ledger, clients, expenses, revenue..."
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm"/>
          <button onClick={() => send()} disabled={!input.trim() || thinking}
            className={cn('bg-gray-900 text-white px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 shadow-sm transition-all',
              (!input.trim() || thinking) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 active:scale-95')}>
            <Send size={15} strokeWidth={2.5}/>
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
