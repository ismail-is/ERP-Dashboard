// Google Sheets Service
const API_URL = 'https://script.google.com/macros/s/AKfycbwq16XRCCghogHYD66M6KRio41Pv7OshKyFITWkR-SFWbHMCbCcRrb6KaInLiqjyW_C/exec';

// Mock data updated to match your spreadsheet columns
const MOCK_DATA = {
  employees: [
    { 
      "Employee Name": "Ismail",
      "Src Row": 1, 
      "Date": "2024-03-01", 
      "Project / Reference": "Office Setup", 
      "Client / Vendor": "Local Store", 
      "Payment Mode": "Cash", 
      "Cash Given (₹)": 5000, 
      "Expense (₹)": 4500, 
      "Balance After Row (₹)": 500, 
      "Status": "Completed", 
      "Notes": "Initial setup" 
    },
    { 
      "Employee Name": "Afnan",
      "Src Row": 2, 
      "Date": "2024-03-05", 
      "Project / Reference": "Travel", 
      "Client / Vendor": "Taxi", 
      "Payment Mode": "UPI", 
      "Cash Given (₹)": 1000, 
      "Expense (₹)": 800, 
      "Balance After Row (₹)": 700, 
      "Status": "Pending", 
      "Notes": "Site visit" 
    }
  ],
  clients: [
    { id: 1, name: 'Acme Corp', status: 'Active', services: 'Web Dev', amount: 12000 },
    { id: 2, name: 'Globex Inc', status: 'Pending', services: 'Design', amount: 8000 },
  ],
  expenses: [
    { id: 1, category: 'Office Rent', amount: 2000, date: '2024-03-05' },
    { id: 2, category: 'Internet', amount: 150, date: '2024-03-07' },
  ],
  notes: [
    { id: 1, title: 'Welcome to Notes', content: 'This is a sample sticky note. You can add, edit, or delete notes here.', color: 'bg-yellow-100', date: new Date().toISOString() }
  ],
  password: '2036'
};

export const fetchData = async () => {
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    const data = await response.json();
    const cleanData = (arr) => arr.map(obj => {
      const newObj = {};
      Object.keys(obj).forEach(key => {
        // Remove surrounding quotes, trim whitespace and newlines
        const cleanKey = key.replace(/^["'\s]+|["'\s]+$/g, '');
        newObj[cleanKey] = obj[key];
      });
      return newObj;
    });

    return {
      employees: cleanData(data.employees || []),
      clients: cleanData(data.clients || []),
      expenses: cleanData(data.expenses || []),
      notes: cleanData(data.notes || []),
      password: data.password ? data.password.toString() : MOCK_DATA.password
    };
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    return MOCK_DATA; // Fallback for dev
  }
};

export const updateSheetData = async (action, sheetName, data) => {
  try {
    // Note: Since we are mocking writes if API fails, we will try to write
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: action, // 'add', 'edit', 'delete'
        sheet: sheetName,
        data: data
      })
    });
    
    if (!response.ok) throw new Error('Failed to update data');
    return await response.json();
  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    return { status: 'error', message: error.message };
  }
};
