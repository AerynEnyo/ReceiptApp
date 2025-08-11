// ingredients.js

async function addIngredients(ingredients) {
  const existingSnapshot = await db.collection('ingredients').get();
  const existingMap = {};
  existingSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      existingMap[data.name.toLowerCase()] = true;
    }
  });

  const batch = db.batch();
  for (const ing of ingredients) {
    const nameKey = ing.name.toLowerCase();
    if (!existingMap[nameKey]) {
      const docRef = db.collection('ingredients').doc();
      batch.set(docRef, {
        name: ing.name,
        size: ing.size,
        price: ing.price
      });
      existingMap[nameKey] = true; // avoid duplicate inserts in the same run
    }
  }

  await batch.commit();
}


async function loadIngredientsPage() {
  currentPage = 'ingredients';

  dom.mainContent.innerHTML = `
    <h1>Ingredients</h1>
    <button id="delete-all-ingredients-btn" style="margin-bottom: 10px;">Refresh</button>
    <table>
      <thead>
        <tr>
          <th>Ingredient</th>
          <th>Size</th>
          <th>Price</th>
          <th>Cups</th>
          <th>Cups Price</th>
          <th>Tablespoons</th>
          <th>Tablespoons Price</th>
          <th>Teaspoons</th>
          <th>Teaspoons Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="ingredients-table-body"></tbody>
    </table>
  `;
  
  // Fetch all utensil names
	const utensilSnapshot = await db.collection('utensils').get();
	const utensilNames = new Set();
	utensilSnapshot.forEach(doc => {
	  const name = doc.data().name;
	  if (name) utensilNames.add(name.toLowerCase());
	});

	// Fetch all packaging types
	const packagingSnapshot = await db.collection('packaging').get();
	const packagingTypes = new Set();
	packagingSnapshot.forEach(doc => {
	  const type = doc.data().type;
	  if (type) packagingTypes.add(type.toLowerCase());
	});


  const deleteAllBtn = document.getElementById('delete-all-ingredients-btn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to refresh the Ingredients?')) return;

      try {
        const snapshot = await db.collection('ingredients').get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        const receiptsSnapshot = await db.collection('receipts').get();
        const allIngredients = [];
        receiptsSnapshot.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (item.name && item.price) {
                allIngredients.push({
                  name: item.name,
                  size: item.size || '',
                  price: item.price
                });
              }
            });
          }
        });

        if (allIngredients.length > 0) {
          await addIngredients(allIngredients);
        }

        loadIngredientsPage();
      } catch (err) {
        alert('Failed to delete and rebuild ingredients: ' + err.message);
        console.error(err);
      }
    });
  }

  const tbody = document.getElementById('ingredients-table-body');
  tbody.innerHTML = '';

  db.collection('ingredients').get()
    .then(snapshot => {
      const ingredientMap = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const nameKey = (data.name || '').toLowerCase();
		if (utensilNames.has(nameKey) || packagingTypes.has(nameKey)) {
		  // Skip this ingredient because it's already in utensils or packaging
		  return;
}

        const price = parseFloat(data.price) || 0;

        if (!ingredientMap[nameKey] || price > ingredientMap[nameKey].price) {
          ingredientMap[nameKey] = {
            id: doc.id,
            name: data.name,
            size: data.size,
            price,
            cups: parseFloat(data.cups) || 0,
            tablespoons: parseFloat(data.tablespoons) || 0,
            teaspoons: parseFloat(data.teaspoons) || 0
          };
        }
      });
	  
	  window.ingredientTable = ingredientMap;


		Object.values(ingredientMap)
		  .sort((a, b) => a.name.localeCompare(b.name))
		  .forEach(ingredient => {
        const tr = document.createElement('tr');
		tr.setAttribute('data-name', ingredient.name.toLowerCase());
        const cups = ingredient.cups;
        const tablespoons = ingredient.tablespoons;
        const teaspoons = ingredient.teaspoons;
        const price = ingredient.price;

        const cupsPrice = cups ? (price / cups).toFixed(2) : '';
        const tablespoonPrice = tablespoons ? (price / tablespoons).toFixed(2) : '';
        const teaspoonPrice = teaspoons ? (price / teaspoons).toFixed(2) : '';

		tr.dataset.name = ingredient.name.trim().toLowerCase();
        tr.innerHTML = `
          <td>${ingredient.name}</td>
          <td>${ingredient.size || ''}</td>
          <td>$${ingredient.price.toFixed(2)}</td>

          <td><input type="number" step="0.01" class="unit-input" data-id="${ingredient.id}" data-unit="cups" value="${ingredient.cups || ''}"></td>
          <td id="cups-price-${ingredient.id}">${cupsPrice ? `$${cupsPrice}` : ''}</td>

          <td><input type="number" step="0.01" class="unit-input" data-id="${ingredient.id}" data-unit="tablespoons" value="${ingredient.tablespoons || ''}"></td>
          <td id="tablespoons-price-${ingredient.id}">${tablespoonPrice ? `$${tablespoonPrice}` : ''}</td>

          <td><input type="number" step="0.01" class="unit-input" data-id="${ingredient.id}" data-unit="teaspoons" value="${ingredient.teaspoons || ''}"></td>
          <td id="teaspoons-price-${ingredient.id}">${teaspoonPrice ? `$${teaspoonPrice}` : ''}</td>

          <td><button class="delete-ingredient-btn" data-id="${ingredient.id}">🗑️</button>
		  <button class="move-to-packaging-btn" data-id="${ingredient.id}">➡️ Packaging</button>
		  <button class="move-to-utensils-btn" data-id="${ingredient.id}">➡️ Utensils</button></td>
        `;
        tbody.appendChild(tr);
      });

      // Add event listeners AFTER building all rows
      tbody.querySelectorAll('.unit-input').forEach(input => {
        input.addEventListener('change', async () => {
          const id = input.dataset.id;
          const unit = input.dataset.unit;
          const value = parseFloat(input.value);

          if (isNaN(value) || value <= 0) {
            alert("Please enter a positive number.");
            return;
          }

          const update = { [unit]: value };

          if (unit === 'cups') {
            update.tablespoons = value * 16;
            update.teaspoons = value * 48;
          } else if (unit === 'tablespoons') {
            update.cups = value / 16;
            update.teaspoons = value * 3;
          } else if (unit === 'teaspoons') {
            update.tablespoons = value / 3;
            update.cups = value / 48;
          }

          try {
            await db.collection('ingredients').doc(id).update(update);

            // Update inputs live
            tbody.querySelector(`.unit-input[data-id="${id}"][data-unit="cups"]`).value = update.cups.toFixed(2);
            tbody.querySelector(`.unit-input[data-id="${id}"][data-unit="tablespoons"]`).value = update.tablespoons.toFixed(2);
            tbody.querySelector(`.unit-input[data-id="${id}"][data-unit="teaspoons"]`).value = update.teaspoons.toFixed(2);

            // Update price columns
            const priceDoc = await db.collection('ingredients').doc(id).get();
            const price = parseFloat(priceDoc.data().price) || 0;

            const cupsPrice = update.cups ? (price / update.cups).toFixed(2) : '';
            const tbspPrice = update.tablespoons ? (price / update.tablespoons).toFixed(2) : '';
            const tspPrice = update.teaspoons ? (price / update.teaspoons).toFixed(2) : '';

            document.getElementById(`cups-price-${id}`).innerText = cupsPrice ? `$${cupsPrice}` : '';
            document.getElementById(`tablespoons-price-${id}`).innerText = tbspPrice ? `$${tbspPrice}` : '';
            document.getElementById(`teaspoons-price-${id}`).innerText = tspPrice ? `$${tspPrice}` : '';

          } catch (err) {
            alert('Failed to update ingredient: ' + err.message);
            console.error(err);
          }
        });
      });

      tbody.querySelectorAll('.delete-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (confirm('Are you sure you want to delete this ingredient?')) {
            db.collection('ingredients').doc(id).delete()
              .then(() => loadIngredientsPage())
              .catch(err => alert('Failed to delete ingredient: ' + err.message));
          }
        });
      });
		// Move to Packaging button
		tbody.querySelectorAll('.move-to-packaging-btn').forEach(btn => {
		  btn.addEventListener('click', async () => {
			const id = btn.dataset.id;
			if (!confirm('Move this ingredient to Packaging?')) return;

			try {
			  const docRef = db.collection('ingredients').doc(id);
			  const doc = await docRef.get();
			  if (!doc.exists) {
				alert('Ingredient not found');
				return;
			  }
			  const data = doc.data();
			  await db.collection('packaging').add({
				  type: data.name || '',
				  quantity: data.size || '',
				  price: data.price || 0
				});

			  await docRef.delete();
			  await new Promise(resolve => setTimeout(resolve, 500));
			  alert('Moved to Packaging successfully');
			  loadIngredientsPage();
			} catch (err) {
			  alert('Failed to move to Packaging: ' + err.message);
			  console.error(err);
			}
		  });
		});

		// Move to Utensils button
		tbody.querySelectorAll('.move-to-utensils-btn').forEach(btn => {
		  btn.addEventListener('click', async () => {
			const id = btn.dataset.id;
			if (!confirm('Move this ingredient to Utensils?')) return;

			try {
			  const docRef = db.collection('ingredients').doc(id);
			  const doc = await docRef.get();
			  if (!doc.exists) {
				alert('Ingredient not found');
				return;
			  }
			  const data = doc.data();
			  await db.collection('utensils').add({
				  name: data.name || '',
				  quantity: data.size || '',
				  condition: 'Good'  // you can change this default if you want
				});
			  await docRef.delete();
			  alert('Moved to Utensils successfully');
			  loadIngredientsPage();
			} catch (err) {
			  alert('Failed to move to Utensils: ' + err.message);
			  console.error(err);
			}
		  });
		});

    })
    .catch(err => alert('Failed to load ingredients: ' + err.message));
}
