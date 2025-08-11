function parseIngredientLine(line) {
  // Try to parse "Name: Quantity Unit", e.g. "Flour: 2 cups"
  const match = line.match(/^(.+):\s*([\d\s\/.]+)\s*(cups?|tablespoons?|teaspoons?)$/i);
  if (!match) return null;

  return {
    name: match[1].toLowerCase(),
    quantity: fractionToDecimal(match[2].trim()),
    unit: match[3].toLowerCase(),
  };
}

async function loadIngredientTable() {
  window.ingredientTable = {};
  const snapshot = await db.collection('ingredients').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      window.ingredientTable[data.name.toLowerCase()] = data;
    }
  });
}


async function calculateMaterialCost() {
  const lines = dom['recipe-items'].value.split('\n').map(l => l.trim()).filter(Boolean);

  let totalCost = 0;

  for (const line of lines) {
    const parsed = parseIngredientLine(line);

    if (!parsed) {
      console.warn(`Skipping invalid line: ${line}`);
      continue;
    }

	const ingredient = window.ingredientTable?.[parsed.name];
if (!ingredient) {
  console.warn(`Ingredient not found in table: ${parsed.name}`);
  continue;  // use continue instead of return so it checks all lines
}

const basePrice = parseFloat(ingredient.price);
if (isNaN(basePrice)) {
  console.warn(`Invalid price for ${parsed.name}: ${ingredient.price}`);
  continue;
}

const cups = parseFloat(ingredient.cups) || 1;
const tablespoons = parseFloat(ingredient.tablespoons) || 1;
const teaspoons = parseFloat(ingredient.teaspoons) || 1;


    let pricePerUnit = 0;
    if (parsed.unit.startsWith('cup')) {
      pricePerUnit = basePrice / cups;
    } else if (parsed.unit.startsWith('tablespoon')) {
      pricePerUnit = basePrice / tablespoons;
    } else if (parsed.unit.startsWith('teaspoon')) {
      pricePerUnit = basePrice / teaspoons;
    } else {
      console.warn(`Unknown unit for ${parsed.name}: ${parsed.unit}`);
      continue;
    }

    const lineCost = pricePerUnit * parsed.quantity;
	console.log(`Ingredient: ${parsed.name}, Quantity: ${parsed.quantity} ${parsed.unit}, Price per unit: $${pricePerUnit.toFixed(4)}, Line cost: $${lineCost.toFixed(4)}`);


    totalCost += lineCost;
  }
  console.log(`Total material cost calculated: $${totalCost.toFixed(2)}`);

  dom.materialCost.value = `$${totalCost.toFixed(2)}`;

  return totalCost;
}

async function loadRecipesPage() {
  currentPage = 'recipes';
  await loadIngredientTable();
  dom.mainContent.innerHTML = `
    <h1>Recipes</h1>
    <button id="add-recipe-btn">Add New Recipe</button>
    <table>
      <thead>
        <tr>
          <th>Recipe Name</th>
          <th>Material Cost</th>
          <th>Retail Cost</th>
		  <th>Store Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="recipes-table-body"></tbody>
    </table>
  `;

  document.getElementById('add-recipe-btn').addEventListener('click', () => {
    openRecipeModal(null);
  });

  const tbody = document.getElementById('recipes-table-body');
  tbody.innerHTML = '';

  db.collection('recipes').get().then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data.name || ''}</td>
        <td>${data.materialCost !== undefined ? `$${data.materialCost.toFixed(2)}` : ''}</td>
        <td>${data.retailCost !== undefined ? `$${data.retailCost.toFixed(2)}` : ''}</td>
<td>${data.storePrice !== undefined ? `$${data.storePrice.toFixed(2)}` : ''}</td>

        <td>
          <button class="edit-recipe-btn" data-id="${id}">✏️</button>
          <button class="delete-recipe-btn" data-id="${id}">🗑️</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-recipe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipeId = btn.dataset.id;
        openRecipeModal(recipeId);
      });
    });

    tbody.querySelectorAll('.delete-recipe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this recipe?')) {
          db.collection('recipes').doc(btn.dataset.id).delete().then(() => {
            loadRecipesPage();
          }).catch(err => alert('Failed to delete recipe: ' + err.message));
        }
      });
    });
  }).catch(err => alert('Failed to load recipes: ' + err.message));
}

async function openRecipeModal(docId) {
  editingDocId = docId;

  dom.recipeModal.style.display = 'flex';

  dom.recipeName = document.getElementById('recipe-name');
  dom.recipeDescription = document.getElementById('recipe-description');
  dom['recipe-items'] = document.getElementById('recipe-items'); // changed here
  dom.materialCost = document.getElementById('material-cost');
  dom.retailCost = document.getElementById('retailCost');


  if (!dom['recipe-items']) {
    console.error('❌ Could not find #recipe-items textarea');
    return;
  }

  if (docId) {
  const doc = await db.collection('recipes').doc(docId).get();
  if (!doc.exists) return alert('Recipe not found.');

  const data = doc.data();
  dom.recipeName.value = data.name || '';
  dom.recipeDescription.value = data.description || '';
  dom['recipe-items'].value = data.items
    ? data.items.map(i => `${i.name}: ${i.size}`).join('\n')
    : '';
  dom.materialCost.value = data.materialCost !== undefined
    ? `$${data.materialCost.toFixed(2)}`
    : '';
  
  dom.numCookies.value = data.numCookies || '';
  dom.cookiesPerTray.value = data.cookiesPerTray || '';
  dom.traysMade.value = (data.numCookies && data.cookiesPerTray)
    ? (data.numCookies / data.cookiesPerTray).toFixed(2)
    : '';
  dom.remainingCookies.value = (data.remainingCookies != null)
    ? data.remainingCookies
    : '';

  await calculateMaterialCost();
  await loadPackagingListForModal();
  setupPackagingCheckboxListeners();
  
  if (data.selectedPackaging && Array.isArray(data.selectedPackaging)) {
  dom.packagingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = data.selectedPackaging.includes(cb.dataset.id);
  });

  // Trigger change event on checkboxes to update retail cost field
  const event = new Event('change');
  dom.packagingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.dispatchEvent(event);
  });
}

  
  } else {
    dom.recipeName.value = '';
    dom.recipeDescription.value = '';
    dom['recipe-items'].value = '';
    dom.materialCost.value = '';
	dom.numCookies.value = '';
    dom.cookiesPerTray.value = '';
    dom.traysMade.value = '';
	dom.remainingCookies.value = '';
  }

  dom['recipe-items'].addEventListener('input', () => {
    calculateMaterialCost().catch(console.error);
  });
  
function updateTraysMade() {
  const cookies = parseFloat(dom.numCookies.value);
  const perTray = parseFloat(dom.cookiesPerTray.value);

  if (!isNaN(cookies) && !isNaN(perTray) && perTray !== 0) {
    dom.traysMade.value = Math.floor(cookies / perTray);
    dom.remainingCookies.value = cookies % perTray;
  } else {
    dom.traysMade.value = '';
    dom.remainingCookies.value = '';
  }

  // ✅ Now this works because updateCosts is globally defined
  updateCosts();
}





	dom.numCookies.addEventListener('input', updateTraysMade);
	dom.cookiesPerTray.addEventListener('input', updateTraysMade);
	updateCosts();
}

function closeRecipeModal() {
  dom.recipeModal.style.display = 'none';
  dom.recipeName.value = '';
  dom.recipeDescription.value = '';
  editingDocId = null;
}

dom.recipeCancelBtn.addEventListener('click', closeRecipeModal);

async function saveRecipe() {
  const name = dom.recipeName.value.trim();
  const description = dom.recipeDescription.value.trim();
  const itemsText = dom['recipe-items'].value.trim();

  if (!name) {
    alert('Please enter a recipe name.');
    return;
  }
  if (!itemsText) {
    alert('Please enter at least one ingredient line like "Flour: 2 cups".');
    return;
  }

  const lines = itemsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const numCookies = parseFloat(dom.numCookies.value);
  const cookiesPerTray = parseFloat(dom.cookiesPerTray.value);
  const traysMade = (!isNaN(numCookies) && !isNaN(cookiesPerTray) && cookiesPerTray !== 0)
    ? numCookies / cookiesPerTray
    : null;
  const remainingCookies = (!isNaN(numCookies) && !isNaN(cookiesPerTray) && cookiesPerTray !== 0)
	  ? Math.floor(numCookies % cookiesPerTray)
	  : null;



  const lineRegex = /^(.+):\s*([\d\s\/.]+)\s*(cups?|tablespoons?|teaspoons?)$/i;

  let invalidLines = [];
  const items = [];

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) {
      invalidLines.push(line);
      continue;
    }

    const namePart = match[1].trim();
    const quantityPart = match[2].trim();
    const unitPart = match[3].toLowerCase();

    const quantity = fractionToDecimal(quantityPart);
    if (quantity === null) {
      invalidLines.push(line);
      continue;
    }

    items.push({
      name: namePart,
      size: `${quantity} ${unitPart}`
    });
  }

  if (invalidLines.length > 0) {
    alert('Invalid ingredient line(s):\n' + invalidLines.join('\n') + '\n\nEach line must look like: Flour: 2 cups');
    return;
  }

  let materialCost = 0;
  try {
    materialCost = await calculateMaterialCost();

    // Fallback: if materialCost is not a number, set to 0
    if (typeof materialCost !== 'number' || isNaN(materialCost)) {
      materialCost = 0;
    }
  } catch (e) {
    console.error('Error calculating material cost:', e);
    materialCost = 0;  // fallback to 0 on error
  }

  const selectedPackaging = [];
  dom.packagingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) {
      selectedPackaging.push(cb.dataset.id);
    }
  });
  const storePrice = parseFloat(dom.storePrice.value.replace('$', '')) || 0;
const retailCost = parseFloat(dom.retailCost.value.replace('$', '')) || 0;
  const data = {
    name,
    description,
    materialCost,
	retailCost,
	storePrice,
    items,
	numCookies,
    cookiesPerTray,
    traysMade,
	remainingCookies,
	selectedPackaging,
  };
  



  try {
    if (editingDocId) {
      await db.collection('recipes').doc(editingDocId).set(data);
    } else {
      await db.collection('recipes').add(data);
    }
    alert('Recipe saved!');
    closeRecipeModal();
    loadRecipesPage();
  } catch (error) {
    alert('Failed to save recipe: ' + error.message);
  }
}

// Helper functions fractionToDecimal and evalFraction remain unchanged
function fractionToDecimal(str) {
  str = str.trim();
  if (!str) return null;

  if (/^\d*\.?\d+$/.test(str)) {
    return parseFloat(str);
  }

  const parts = str.split(' ');
  if (parts.length === 2) {
    const whole = parseInt(parts[0]);
    const fraction = parts[1];
    const fracValue = evalFraction(fraction);
    if (isNaN(whole) || fracValue === null) return null;
    return whole + fracValue;
  } else if (parts.length === 1) {
    return evalFraction(parts[0]);
  } else {
    return null;
  }
}

function evalFraction(fracStr) {
  const match = fracStr.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const numerator = parseInt(match[1]);
  const denominator = parseInt(match[2]);
  if (denominator === 0) return null;
  return numerator / denominator;
}

async function loadPackagingListForModal() {
  dom.packagingList.innerHTML = '';  // Clear existing

  const snapshot = await db.collection('packaging').get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    const price = parseFloat(data.price) || 0;
    const quantity = parseFloat(data.quantity) || 0;
    const pricePer = (quantity > 0) ? (price / quantity) : 0;
    const type = data.type || '';

    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    label.innerHTML = `
      <input type="checkbox" data-id="${id}" data-price="${pricePer.toFixed(2)}" />
      ${type} ($${pricePer.toFixed(2)})
    `;

    dom.packagingList.appendChild(label);
  });
}


function setupPackagingCheckboxListeners() {
  if (!dom.packagingList) return;

  dom.packagingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateCosts);
  });

  updateCosts();
}

function updateCosts() {
  const materialCost = parseFloat(dom.materialCost.value.replace('$', '')) || 0;
  const trays = parseFloat(dom.traysMade.value) || 1;

  let packagingSum = 0;
  if (dom.packagingList) {
    dom.packagingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.checked) {
        packagingSum += parseFloat(cb.dataset.price) || 0;
      }
    });
  }

  // Retail cost calculation: ( (materialCost / trays) + packagingSum ) * 2 * 1.3
  const retailTotal = (((materialCost / trays) + packagingSum) * 2) * 1.3;
  dom.retailCost.value = `$${retailTotal.toFixed(2)}`;

  // Store price calculation: ( (materialCost / trays) + packagingSum ) * 1.5 * 1.3
  const storeTotal = (((materialCost / trays) + packagingSum) * 1.5) * 1.3;
  dom.storePrice.value = `$${storeTotal.toFixed(2)}`;
}






dom.recipeSubmitBtn.addEventListener('click', saveRecipe);
