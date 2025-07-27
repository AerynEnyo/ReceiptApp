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

    totalCost += lineCost;
  }

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
        <td></td>
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

function openRecipeModal(docId) {
  editingDocId = docId;

  dom.recipeModal.style.display = 'flex';

  dom.recipeName = document.getElementById('recipe-name');
  dom.recipeDescription = document.getElementById('recipe-description');
  dom['recipe-items'] = document.getElementById('recipe-items'); // changed here
  dom.materialCost = document.getElementById('material-cost');

  if (!dom['recipe-items']) {
    console.error('❌ Could not find #recipe-items textarea');
    return;
  }

  if (docId) {
    db.collection('recipes').doc(docId).get().then(doc => {
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
      calculateMaterialCost().catch(console.error);
    });
  } else {
    dom.recipeName.value = '';
    dom.recipeDescription.value = '';
    dom['recipe-items'].value = '';
    dom.materialCost.value = '';
  }

  dom['recipe-items'].addEventListener('input', () => {
    calculateMaterialCost().catch(console.error);
  });
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

  const data = {
    name,
    description,
    materialCost,
    items,
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

dom.recipeSubmitBtn.addEventListener('click', saveRecipe);
