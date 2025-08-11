function loadUtensilsPage() {
  dom.mainContent.innerHTML = `
    <h1>Utensils</h1>
    <table>
      <thead>
        <tr><th>Name</th>
		<th>Quantity</th>
		<th>Condition</th>
	  </tr>
      </thead>
      <tbody id="utensils-table-body">
        <!-- Populate utensils here -->
      </tbody>
    </table>
  `;

  // Optionally load utensils data from Firestore or static list and render rows here
  loadUtensilsData();
}

async function loadUtensilsData() {
  const tbody = document.getElementById('utensils-table-body');
  tbody.innerHTML = '';  // Clear existing rows if any

  try {
    const snapshot = await firebase.firestore().collection('utensils').get();
    snapshot.forEach(doc => {
      const utensil = doc.data();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${utensil.name || ''}</td>
        <td>${utensil.quantity || ''}</td>
        <td>${utensil.condition || ''}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading utensils data:', error);
  }
}


function loadPackagingPage() {
  dom.mainContent.innerHTML = `
    <h1>Packaging</h1>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Quantity</th>
		  <th>Price</th>
		  <th>Price Per</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="packaging-table-body"></tbody>
    </table>
  `;

  loadPackagingData();
}

async function loadPackagingData() {
  const tbody = document.getElementById('packaging-table-body');
  tbody.innerHTML = '';  // Clear existing rows

  try {
    const snapshot = await firebase.firestore().collection('packaging').get();
    snapshot.forEach(doc => {
      const pack = doc.data();
      const id = doc.id;  // ✅ correct placement

      const row = document.createElement('tr');
      const price = parseFloat(pack.price) || 0;
		const quantity = parseFloat(pack.quantity) || 0;
		const pricePer = (quantity > 0) ? (price / quantity).toFixed(2) : '';

		row.innerHTML = `
		  <td>${pack.type || ''}</td>
		  <td>${pack.quantity || ''}</td>
		  <td>${price ? `$${price.toFixed(2)}` : ''}</td>
		  <td>${pricePer ? `$${price}` : ''}</td>
		  <td><button class="delete-packaging-btn" data-id="${id}">🗑️</button></td>
		`;

      tbody.appendChild(row);
    });

    // ✅ Set up delete button listeners after rows are created
    document.querySelectorAll('.delete-packaging-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        deletePackaging(id);
      });
    });

  } catch (error) {
    console.error('Error loading packaging data:', error);
  }
}


// ✅ Declare this BEFORE loadPackagingData is ever called
function deletePackaging(id) {
  if (!confirm('Are you sure you want to delete this packaging item?')) return;

  firebase.firestore().collection('packaging').doc(id).delete()
    .then(() => {
      loadPackagingData(); // Refresh the table after deletion
    })
    .catch(err => {
      console.error('Failed to delete packaging:', err);
      alert('Failed to delete packaging item.');
    });
}

