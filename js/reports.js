// reports.js

function loadReportsPage() {
  const mainContent = dom.mainContent;
  mainContent.innerHTML = `
    <h1>Reports</h1>

    <label for="vendor-select">Select Vendor:</label>
    <select id="vendor-select">
      <option value="">-- All Vendors --</option>
    </select>

    <label for="range-select" style="margin-left:20px;">Select Range:</label>
    <select id="range-select">
      <option value="all">All Dates</option>
      <option value="weekly">Weekly (Starting Sunday)</option>
      <option value="monthly">Monthly</option>
      <option value="yearly">Yearly</option>
    </select>

    <div id="date-picker-container" style="margin-top: 10px;"></div>

    <button id="print-report-btn" style="margin-left: 10px; padding: 6px 12px;">🖨️ Print Report</button>

    <table id="report-table" border="1" cellspacing="0" cellpadding="5" style="margin-top: 10px; width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Amount</th>
          <th>Payment Method</th>
          <th>Date</th>
          <th>Invoice Number</th>
        </tr>
      </thead>
      <tbody id="report-table-body"></tbody>
      <tfoot>
        <tr>
          <td><strong>Total</strong></td>
          <td id="total-amount" colspan="4"><strong>0.00</strong></td>
        </tr>
      </tfoot>
    </table>
  `;

  const vendorSelect = document.getElementById('vendor-select');
  const rangeSelect = document.getElementById('range-select');
  const datePickerContainer = document.getElementById('date-picker-container');
  const reportTableBody = document.getElementById('report-table-body');
  const totalAmountCell = document.getElementById('total-amount');
  const printReportBtn = document.getElementById('print-report-btn');

  // Load vendors dropdown
  db.collection('receipts').get().then(snapshot => {
    const vendors = new Set();
    snapshot.forEach(doc => {
      const v = doc.data().vendor;
      if (v) vendors.add(v);
    });
    [...vendors].sort().forEach(vendor => {
      const opt = document.createElement('option');
      opt.value = vendor;
      opt.textContent = vendor;
      vendorSelect.appendChild(opt);
    });
  });

  // Get start and end dates based on range and selected date
  function getStartDateAndEndDate(range, selectedDateStr) {
    if (range === 'all' || !selectedDateStr) return { startDate: null, endDate: null };

    let selectedDate;

    if (range === 'monthly') {
      const [year, month] = selectedDateStr.split('-').map(Number);
      selectedDate = new Date(year, month - 1, 1);
    } else if (range === 'yearly') {
      const year = parseInt(selectedDateStr, 10);
      selectedDate = new Date(year, 0, 1);
    } else {
      selectedDate = new Date(selectedDateStr);
    }

    let start, end;

    if (range === 'weekly') {
      const day = selectedDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const daysToSunday = day;
      start = new Date(selectedDate);
      start.setDate(selectedDate.getDate() - daysToSunday);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (range === 'monthly') {
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    } else if (range === 'yearly') {
      start = new Date(selectedDate.getFullYear(), 0, 1);
      end = new Date(selectedDate.getFullYear(), 11, 31);
    } else {
      start = new Date(selectedDate);
      end = new Date(selectedDate);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { startDate: start, endDate: end };
  }

  function loadReport() {
    const vendorFilter = vendorSelect.value;
    const range = rangeSelect.value;
    const selectedDateStr = datePickerContainer.querySelector('input')?.value || null;

    const { startDate, endDate } = getStartDateAndEndDate(range, selectedDateStr);

    db.collection('receipts').get().then(snapshot => {
      reportTableBody.innerHTML = '';
      let total = 0;

      snapshot.forEach(doc => {
        const r = doc.data();
        const receiptDate = new Date(r.date);

        if (vendorFilter && r.vendor !== vendorFilter) return;

        if (startDate && endDate) {
          if (receiptDate < startDate || receiptDate > endDate) return;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.vendor}</td>
          <td>${r.amount}</td>
          <td>${r.method}</td>
          <td>${r.date}</td>
          <td>${r.invoice}</td>
        `;

        reportTableBody.appendChild(tr);

        total += parseFloat(r.amount) || 0;
      });

      totalAmountCell.textContent = total.toFixed(2);
    });
  }

  vendorSelect.addEventListener('change', loadReport);
  rangeSelect.addEventListener('change', () => {
    datePickerContainer.innerHTML = '';

    if (rangeSelect.value === 'weekly') {
      const input = document.createElement('input');
      input.type = 'date';
      input.id = 'weekly-date';
      datePickerContainer.appendChild(input);
      input.addEventListener('change', loadReport);
    } else if (rangeSelect.value === 'monthly') {
      const input = document.createElement('input');
      input.type = 'month';
      input.id = 'monthly-date';
      datePickerContainer.appendChild(input);
      input.addEventListener('change', loadReport);
    } else if (rangeSelect.value === 'yearly') {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '2000';
      input.max = '2100';
      input.id = 'yearly-date';
      input.placeholder = 'Year (e.g. 2024)';
      datePickerContainer.appendChild(input);
      input.addEventListener('change', loadReport);
    }

    loadReport();
  });

  printReportBtn.addEventListener('click', () => {
    window.print();
  });

  loadReport();
}
