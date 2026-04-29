# ERP Admin Dashboard

A premium, production-ready ERP dashboard built with React, Tailwind CSS, and Google Sheets.

## 🚀 Setup Instructions

### 1. Frontend Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the development server.
4. **Password:** Use `admin` to access the dashboard.

### 2. Google Sheets Backend Setup
To use real data from Google Sheets:

1. Create a Google Sheet with 3 tabs: `Employees`, `Clients`, and `Expenses`.
2. Structure your columns as follows:
   - **Employees:** `id`, `name`, `salary`, `status`, `date`
   - **Clients:** `id`, `name`, `status`, `service`, `amount`
   - **Expenses:** `id`, `category`, `amount`, `date`
3. Go to **Extensions > Apps Script**.
4. Paste the following code:

```javascript
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const employees = getSheetData(ss.getSheetByName("Employees"));
  const clients = getSheetData(ss.getSheetByName("Clients"));
  const expenses = getSheetData(ss.getSheetByName("Expenses"));
  
  const data = {
    employees: employees,
    clients: clients,
    expenses: expenses
  };
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}
```

5. Click **Deploy > New Deployment**.
6. Select type **Web App**.
7. Set "Execute as" to **Me** and "Who has access" to **Anyone**.
8. Copy the **Web App URL** and paste it in `src/services/googleSheets.js` under `API_URL`.

## 🛠️ Tech Stack
- **React (Vite)**
- **Tailwind CSS**
- **Framer Motion** (Animations)
- **Recharts** (Data Visualization)
- **Lucide React** (Icons)
- **Google Sheets API** (via Apps Script)

## 🔐 Security
- Simple frontend password gate.
- No data is fetched until the password is correct.
- All styles follow a strict Black & White premium aesthetic.
