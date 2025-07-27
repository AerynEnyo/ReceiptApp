// receipts.js

function uploadImage(file) {
  if (!file) return Promise.resolve(null);
  const storageRef = firebase.storage().ref('receipts/' + Date.now() + '_' + file.name);
  return storageRef.put(file).then(snapshot => snapshot.ref.getDownloadURL());
}

function loadReceiptsPage() {
  currentPage = 'receipts';

  dom.mainContent.innerHTML = `
    <h1>Receipts</h1>
    <button id="add-transaction-btn">Add Transaction</button>
    <table>
      <thead>
        <tr>
          <th data-col="vendor">Vendor Name</th>
          <th data-col="amount">Amount</th>
          <th data-col="method">Payment Method</th>
          <th data-col="date">Date</th>
          <th data-col="invoice">Invoice Number</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="receipt-table-body"></tbody>
    </table>
  `;

  document.getElementById('add-transaction-btn').addEventListener('click', () => {
    editingDocId = null;
    clearModal();
    openModal();
  });

  const tbody = document.getElementById('receipt-table-body');
  tbody.innerHTML = '';

  db.collection("receipts").get().then(snapshot => {
    snapshot.forEach(doc => {
      const r = doc.data();
      const id = doc.id;
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${r.vendor}</td>
        <td>${r.amount}</td>
        <td>${r.method}</td>
        <td>${r.date}</td>
        <td>${r.invoice}</td>
        <td>
          <button class="edit-btn" data-id="${id}">✏️</button>
          <button class="delete-btn" data-id="${id}" title="Delete">🗑️</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.id))
    );

    tbody.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => deleteReceipt(btn.dataset.id))
    );

    setupSorting();
  }).catch(err => alert("Error loading receipts: " + err.message));
}

function openEditModal(docId) {
  editingDocId = docId;
  db.collection("receipts").doc(docId).get().then(doc => {
    if (!doc.exists) return alert("Receipt not found.");
    const data = doc.data();

    dom.vendor.value = data.vendor || '';
    dom.amount.value = data.amount || '';
    dom.method.value = data.method || '';
    dom.date.value = data.date || '';
    dom.invoice.value = data.invoice || '';
    dom.items.value = (data.items || []).map(item => 
      `${item.name || ''}: ${item.size || ''}: ${item.price || ''}`
    ).join('\n');
    dom.receiptImage.value = '';

    if (data.imageUrl) {
      dom.imagePreview.src = data.imageUrl;
      dom.imagePreview.style.display = 'block';
      dom.downloadImageBtn.style.display = 'inline-block';
      currentImageDownloadUrl = data.imageUrl;
      if (currentLocalBlobUrl) {
        URL.revokeObjectURL(currentLocalBlobUrl);
        currentLocalBlobUrl = null;
      }
    } else {
      dom.imagePreview.style.display = 'none';
      dom.downloadImageBtn.style.display = 'none';
      currentImageDownloadUrl = null;
    }

    openModal();
  });
}

function deleteReceipt(id) {
  if (!confirm("Are you sure you want to delete this receipt?")) return;

  db.collection("receipts").doc(id).get().then(doc => {
    if (!doc.exists) return;

    const imageUrl = doc.data().imageUrl;

    const deleteDoc = () => {
      db.collection("receipts").doc(id).delete().then(() => {
        loadReceiptsPage();
      }).catch(console.error);
    };

    if (imageUrl) {
      try {
        const startIndex = imageUrl.indexOf("/o/") + 3;
        const endIndex = imageUrl.indexOf("?");
        const fullPathEncoded = imageUrl.substring(startIndex, endIndex);
        const fullPath = decodeURIComponent(fullPathEncoded);
        firebase.storage().ref(fullPath).delete()
          .then(deleteDoc)
          .catch(err => {
            console.error("Failed to delete image:", err);
            deleteDoc();
          });
      } catch {
        deleteDoc();
      }
    } else {
      deleteDoc();
    }
  });
}

// Sorting
let currentSort = { column: null, ascending: true };

function setupSorting() {
  const headers = dom.mainContent.querySelectorAll('th[data-col]');
  headers.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => sortTable(th));
  });
}

function sortTable(header) {
  const column = header.getAttribute('data-col');
  const table = dom.mainContent.querySelector('table');
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);

  const ascending = currentSort.column === column ? !currentSort.ascending : true;
  currentSort = { column, ascending };

  rows.sort((a, b) => {
    let aText = a.querySelector(`td:nth-child(${header.cellIndex + 1})`).innerText.trim();
    let bText = b.querySelector(`td:nth-child(${header.cellIndex + 1})`).innerText.trim();

    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return ascending ? aNum - bNum : bNum - aNum;
    } else {
      return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
    }
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));

  dom.mainContent.querySelectorAll('th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
  });
  header.classList.add(ascending ? 'sorted-asc' : 'sorted-desc');
}
