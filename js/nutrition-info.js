// Make functions available globally
window.loadIngredientInfoPage = loadIngredientInfoPage;
window.loadRecipeInfoPage = loadRecipeInfoPage;

// Global variables
let currentPage = '';
let currentRecipeNutrition = null;

let saveTimeout = null;
const saveLocks = {};


// Add this near the top, outside of any function:
const saveTimeouts = {};


function debounceSaveNutrition(ingredientName, nutritionData, statusSpan) {
  // Clear previous timer for this ingredient, if any
  if (saveTimeouts[ingredientName]) clearTimeout(saveTimeouts[ingredientName]);
  
  // Set a new timer that triggers save after 500ms of no typing
  saveTimeouts[ingredientName] = setTimeout(() => {
    saveNutritionData(ingredientName, nutritionData, statusSpan);
    delete saveTimeouts[ingredientName];  // Clean up
  }, 500);
}



// Helper function to convert between volume units directly (more accurate than going through grams)
function convertVolumeUnits(fromAmount, fromUnit, toUnit) {
  // Normalize unit names
  const normalizeUnit = (unit) => {
    const normalized = unit.toLowerCase().replace(/s$/, ''); // remove plural 's'
    const unitMap = {
      'tbsp': 'tablespoon',
      'tsp': 'teaspoon'
    };
    return unitMap[normalized] || normalized;
  };

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) return fromAmount;

  // Volume conversion ratios
  const volumeConversions = {
    'teaspoon': 1,
    'tablespoon': 3,    // 1 tbsp = 3 tsp
    'cup': 48           // 1 cup = 48 tsp = 16 tbsp
  };

  // Convert to teaspoons first, then to target unit
  const inTeaspoons = fromAmount * (volumeConversions[from] || 1);
  const result = inTeaspoons / (volumeConversions[to] || 1);
  
  return result;
}

// Check if two units are both volume units
function areVolumeUnits(unit1, unit2) {
  const volumeUnits = ['teaspoon', 'teaspoons', 'tsp', 'tablespoon', 'tablespoons', 'tbsp', 'cup', 'cups'];
  return volumeUnits.includes(unit1.toLowerCase()) && volumeUnits.includes(unit2.toLowerCase());
}

// Helper function to convert common units to grams with ingredient-specific densities
function convertToGrams(quantity, unit, ingredientName = '') {
  // Ingredient-specific conversions (more accurate)
  const ingredientConversions = {
    'sugar': { 'cup': 200, 'tablespoon': 12.5, 'teaspoon': 4.2 },
    'brown sugar': { 'cup': 213, 'tablespoon': 13.3, 'teaspoon': 4.4 },
    'flour': { 'cup': 120, 'tablespoon': 7.5, 'teaspoon': 2.5 },
    'butter': { 'cup': 227, 'tablespoon': 14.2, 'teaspoon': 4.7 },
    'oil': { 'cup': 218, 'tablespoon': 13.6, 'teaspoon': 4.5 },
    'milk': { 'cup': 240, 'tablespoon': 15, 'teaspoon': 5 },
    'water': { 'cup': 240, 'tablespoon': 15, 'teaspoon': 5 },
    'salt': { 'cup': 273, 'tablespoon': 17, 'teaspoon': 6 },
    'baking powder': { 'cup': 192, 'tablespoon': 12, 'teaspoon': 4 },
    'baking soda': { 'cup': 220, 'tablespoon': 14, 'teaspoon': 4.6 },
    'vanilla extract': { 'cup': 208, 'tablespoon': 13, 'teaspoon': 4.3 },
    'honey': { 'cup': 340, 'tablespoon': 21, 'teaspoon': 7 },
    'cocoa powder': { 'cup': 85, 'tablespoon': 5.3, 'teaspoon': 1.8 }
  };

  // Try ingredient-specific conversion first
  const ingredientKey = ingredientName.toLowerCase();
  if (ingredientConversions[ingredientKey] && ingredientConversions[ingredientKey][unit]) {
    return quantity * ingredientConversions[ingredientKey][unit];
  }

  // Fall back to generic conversions
  const conversions = {
    // Volume to weight conversions (generic averages)
    'cup': quantity * 120,
    'cups': quantity * 120,
    'tablespoon': quantity * 15,
    'tablespoons': quantity * 15,
    'tbsp': quantity * 15,
    'teaspoon': quantity * 5,
    'teaspoons': quantity * 5,
    'tsp': quantity * 5,
    // Weight units
    'gram': quantity,
    'grams': quantity,
    'g': quantity,
    'kilogram': quantity * 1000,
    'kilograms': quantity * 1000,
    'kg': quantity * 1000,
    'ounce': quantity * 28.35,
    'ounces': quantity * 28.35,
    'oz': quantity * 28.35,
    'pound': quantity * 453.592,
    'pounds': quantity * 453.592,
    'lb': quantity * 453.592,
    'lbs': quantity * 453.592
  };

  return conversions[unit] || quantity; // Default to quantity if unit not found
}

// Helper function to convert fractions to decimals
function fractionToDecimal(str) {
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str);
}

async function loadIngredientInfoPage() {
  currentPage = 'ingredient-info';

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <h1>Ingredient Nutrition Information</h1>
    <p>Enter nutrition facts for each ingredient. Specify the serving size and corresponding nutrition values.</p>
    <table class="nutrition-table">
      <thead>
        <tr>
          <th class="ingredient-name">Ingredient Name</th>
          <th>Serving Size</th>
          <th>Serving Unit</th>
          <th>Calories</th>
          <th>Total Fat (g)</th>
          <th>Sat Fat (g)</th>
          <th>Trans Fat (g)</th>
          <th>Chol (mg)</th>
          <th>Sodium (mg)</th>
          <th>Carbs (g)</th>
          <th>Fiber (g)</th>
          <th>Sugars (g)</th>
          <th>+ Sugars (g)</th>
          <th>Protein (g)</th>
          <th>Vit D (mcg)</th>
          <th>Ca (mg)</th>
          <th>Fe (mg)</th>
          <th>K (mg)</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="ingredient-nutrition-table-body"></tbody>
    </table>
    
    <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
      <h4>How to Use Serving Sizes:</h4>
      <ul style="margin: 10px 0;">
        <li><strong>Sugar:</strong> Enter "1" and select "teaspoon" if your nutrition label says "per 1 tsp"</li>
        <li><strong>Flour:</strong> Enter "1" and select "cup" if your nutrition label says "per 1 cup"</li>
        <li><strong>Vanilla Extract:</strong> Enter "1" and select "teaspoon" for typical serving size</li>
        <li><strong>Butter:</strong> Enter "1" and select "tablespoon" for typical serving size</li>
        <li><strong>Large ingredients:</strong> Use "gram" or "ounce" for things typically measured by weight</li>
      </ul>
      <p><em>Just match whatever your nutrition label says! The system will handle the conversions automatically.</em></p>
    </div>
  `;

  const tbody = document.getElementById('ingredient-nutrition-table-body');
  tbody.innerHTML = '';

  try {
    // Get all ingredients from the ingredients collection
    const ingredientsSnapshot = await db.collection('ingredients').get();
    const nutritionSnapshot = await db.collection('ingredient-nutrition').get();
    
    // Get packaging and utensils to exclude them
    const packagingSnapshot = await db.collection('packaging').get();
    const utensilsSnapshot = await db.collection('utensils').get();
    
    // Create sets of packaging types and utensil names to exclude
    const packagingTypes = new Set();
    packagingSnapshot.forEach(doc => {
      const type = doc.data().type;
      if (type) packagingTypes.add(type.toLowerCase());
    });
    
    const utensilNames = new Set();
    utensilsSnapshot.forEach(doc => {
      const name = doc.data().name;
      if (name) utensilNames.add(name.toLowerCase());
    });
    
    // Create a map of existing nutrition data
    const nutritionMap = {};
    nutritionSnapshot.forEach(doc => {
      const data = doc.data();
      nutritionMap[data.ingredientName?.toLowerCase()] = { id: doc.id, ...data };
    });

    // Get unique ingredient names, excluding packaging and utensils
    const ingredientNames = new Set();
    ingredientsSnapshot.forEach(doc => {
      const name = doc.data().name;
      if (name) {
        const nameKey = name.toLowerCase();
        // Only add if not in packaging or utensils
        if (!packagingTypes.has(nameKey) && !utensilNames.has(nameKey)) {
          ingredientNames.add(name);
        }
      }
    });

    // Create rows for each ingredient
    Array.from(ingredientNames).sort().forEach(ingredientName => {
      const existing = nutritionMap[ingredientName.toLowerCase()] || {};
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td class="ingredient-name">${ingredientName}</td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName}"data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="servingSize" value="${existing.servingSize || 1}" placeholder="1" title="Enter the serving size amount (like 1, 0.5, 2)"></td>
        <td>
          <select class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="servingUnit" title="Select the unit for your serving size">
            <option value="cup" ${existing.servingUnit === 'cup' ? 'selected' : ''}>cup</option>
            <option value="tablespoon" ${existing.servingUnit === 'tablespoon' ? 'selected' : ''}>tablespoon</option>
            <option value="teaspoon" ${existing.servingUnit === 'teaspoon' ? 'selected' : ''}>teaspoon</option>
            <option value="gram" ${existing.servingUnit === 'gram' || !existing.servingUnit ? 'selected' : ''}>gram</option>
            <option value="ounce" ${existing.servingUnit === 'ounce' ? 'selected' : ''}>ounce</option>
          </select>
        </td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="calories" value="${existing.calories || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="totalFat" value="${existing.totalFat || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="saturatedFat" value="${existing.saturatedFat || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="transFat" value="${existing.transFat || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="cholesterol" value="${existing.cholesterol || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="sodium" value="${existing.sodium || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="totalCarbs" value="${existing.totalCarbs || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="dietaryFiber" value="${existing.dietaryFiber || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="totalSugars" value="${existing.totalSugars || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="addedSugars" value="${existing.addedSugars || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="protein" value="${existing.protein || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="vitaminD" value="${existing.vitaminD || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="calcium" value="${existing.calcium || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="iron" value="${existing.iron || ''}" placeholder="0"></td>
        <td><input type="number" step="0.1" class="nutrition-input" data-ingredient="${ingredientName.trim().toLowerCase()}"
 data-field="potassium" value="${existing.potassium || ''}" placeholder="0"></td>
        <td>
          <span class="save-status" data-ingredient="${ingredientName.trim().toLowerCase()}"
></span>
          ${existing.id ? `<button class="delete-nutrition-btn nutrition-btn" data-id="${existing.id}">🗑️</button>` : ''}
        </td>
      `;
      
      tbody.appendChild(tr);
    });

    // Add event listeners for auto-save on input change
    tbody.querySelectorAll('.nutrition-input').forEach(input => {
      input.addEventListener('blur', async () => {
        const ingredientName = input.dataset.ingredient.trim().toLowerCase();

        await autoSaveIngredientNutrition(ingredientName);
      });
      
      input.addEventListener('change', async () => {
        const ingredientName = input.dataset.ingredient.trim().toLowerCase();

        await autoSaveIngredientNutrition(ingredientName);
      });
    });

    // Add event listeners for select dropdowns specifically
    tbody.querySelectorAll('select.nutrition-input').forEach(select => {
      select.addEventListener('change', async () => {
        const ingredientName = select.dataset.ingredient;
        await autoSaveIngredientNutrition(ingredientName);
      });
    });

    // Add event listeners for delete buttons
    tbody.querySelectorAll('.delete-nutrition-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Delete nutrition data for this ingredient?')) {
          await db.collection('ingredient-nutrition').doc(id).delete();
          loadIngredientInfoPage(); // Refresh
        }
      });
    });

  } catch (error) {
    console.error('Error loading ingredient nutrition page:', error);
    alert('Failed to load ingredient nutrition data');
  }
}

async function autoSaveIngredientNutrition(ingredientName) {
  try {
    // Show saving status
    const statusSpan = document.querySelector(`span[data-ingredient="${ingredientName}"]`);
    if (statusSpan) {
      statusSpan.textContent = '💾 Saving...';
      statusSpan.style.color = '#666';
    }

    const inputs = document.querySelectorAll(`[data-ingredient="${ingredientName}"]`);
    const normalizedIngredientName = ingredientName.trim().toLowerCase();
const nutritionData = { ingredientName: normalizedIngredientName };

inputs.forEach(input => {
  const field = input.dataset.field;
  let value;
  
  if (input.tagName === 'SELECT') {
    value = input.value;
    nutritionData[field] = value || 'gram'; // default to gram if empty
  } else {
    value = parseFloat(input.value);
    nutritionData[field] = isNaN(value) ? (field === 'servingSize' ? 1 : 0) : value;
  }
});

// Check if nutrition data already exists for this ingredient (normalized)
const existingQuery = await db.collection('ingredient-nutrition')
  .where('ingredientName', '==', normalizedIngredientName)
  .get();


    if (existingQuery.empty) {
      // Create new document
      await db.collection('ingredient-nutrition').add(nutritionData);
    } else {
      // Update existing document
      const docId = existingQuery.docs[0].id;
      await db.collection('ingredient-nutrition').doc(docId).set(nutritionData);
    }

    // Show saved status
    if (statusSpan) {
      statusSpan.textContent = '✅ Saved';
      statusSpan.style.color = '#4CAF50';
      
      // Clear the status after 2 seconds
      setTimeout(() => {
        statusSpan.textContent = '';
      }, 2000);
    }

  } catch (error) {
    console.error('Error auto-saving nutrition data:', error);
    
    // Show error status
    const statusSpan = document.querySelector(`span[data-ingredient="${ingredientName}"]`);
    if (statusSpan) {
      statusSpan.textContent = '❌ Error';
      statusSpan.style.color = '#f44336';
      
      setTimeout(() => {
        statusSpan.textContent = '';
      }, 3000);
    }
  }
}

async function loadRecipeInfoPage() {
  currentPage = 'recipe-info';

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <h1>Recipe Nutrition Information</h1>
    <p>Calculated nutrition facts based on ingredient data with custom serving sizes</p>
    
    <label for="recipe-select">Select Recipe:</label>
    <select id="recipe-select">
      <option value="">-- Select a Recipe --</option>
    </select>
    
    <div id="recipe-nutrition-display" style="margin-top: 20px; display: none;">
      <h3 id="selected-recipe-name"></h3>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px;">
          <h4>Nutrition Facts (Total Recipe)</h4>
          <div id="total-nutrition" style="border: 2px solid #000; padding: 10px; font-family: Arial; background: white;">
            <!-- Nutrition label will be generated here -->
          </div>
        </div>
        
        <div style="flex: 1; min-width: 300px;">
          <h4>Per Serving</h4>
          <label>Number of Servings: <input type="number" id="servings-input" value="1" min="1" style="width: 60px;"></label>
          <div id="per-serving-nutrition" style="border: 2px solid #000; padding: 10px; font-family: Arial; background: white; margin-top: 10px;">
            <!-- Per serving nutrition will be generated here -->
          </div>
        </div>
      </div>
    </div>
  `;

  const recipeSelect = document.getElementById('recipe-select');
  const nutritionDisplay = document.getElementById('recipe-nutrition-display');
  const servingsInput = document.getElementById('servings-input');

  try {
    // Load all recipes
    const recipesSnapshot = await db.collection('recipes').get();
    
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = recipe.name || 'Unnamed Recipe';
      recipeSelect.appendChild(option);
    });

    // Handle recipe selection
    recipeSelect.addEventListener('change', async () => {
      if (!recipeSelect.value) {
        nutritionDisplay.style.display = 'none';
        return;
      }
      
      await calculateRecipeNutrition(recipeSelect.value);
      nutritionDisplay.style.display = 'block';
    });

    // Handle servings change
    servingsInput.addEventListener('input', () => {
      if (recipeSelect.value) {
        updatePerServingNutrition();
      }
    });

  } catch (error) {
    console.error('Error loading recipe info page:', error);
    alert('Failed to load recipe information');
  }
}

async function calculateRecipeNutrition(recipeId) {
  try {
    const recipeDoc = await db.collection('recipes').doc(recipeId).get();
    if (!recipeDoc.exists) return;

    const recipe = recipeDoc.data();
    document.getElementById('selected-recipe-name').textContent = recipe.name;
	const servingsInput = document.getElementById('servings-input');
	servingsInput.value = (recipe.numCookies && recipe.numCookies > 0) ? recipe.numCookies : 1;


    // Get nutrition data for all ingredients
    const nutritionSnapshot = await db.collection('ingredient-nutrition').get();
    const nutritionMap = {};
    nutritionSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.ingredientName) {
        nutritionMap[data.ingredientName.toLowerCase().trim()] = data;
      }
    });

    // Prepare totals
    const totalNutrition = {
      calories: 0, totalFat: 0, saturatedFat: 0, transFat: 0,
      cholesterol: 0, sodium: 0, totalCarbs: 0, dietaryFiber: 0,
      totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0,
      calcium: 0, iron: 0, potassium: 0
    };

    if (recipe.items) {
      recipe.items.forEach(item => {
        const ingredientKey = item.name?.toLowerCase().trim();
        const ingredientNutrition = nutritionMap[ingredientKey];

        console.log("🔍 Checking ingredient:", {
          name: item.name,
          key: ingredientKey,
          size: item.size,
          foundNutrition: !!ingredientNutrition
        });

        if (!ingredientNutrition) {
          console.warn("⚠️ No nutrition data for ingredient:", item.name);
          return;
        }

        // Parse quantity/unit from size
        const match = item.size?.match(/([\d\s\/\.]+)\s*([a-zA-Z]+)$/);
        if (!match) {
          console.warn("⚠️ Could not parse size:", item.size);
          return;
        }

        const quantity = fractionToDecimal(match[1].trim());
        const unit = match[2].toLowerCase();

        // Nutrition serving info
        const servingAmount = ingredientNutrition.servingSize || 1;
        const servingUnit = ingredientNutrition.servingUnit || 'gram';

        let scaleFactor;

        if (unit === servingUnit || (unit + 's') === servingUnit || unit === (servingUnit + 's')) {
          scaleFactor = quantity / servingAmount;
        } else if (areVolumeUnits(unit, servingUnit)) {
          const convertedAmount = convertVolumeUnits(quantity, unit, servingUnit);
          scaleFactor = convertedAmount / servingAmount;
        } else {
          const gramsUsed = convertToGrams(quantity, unit, item.name);
          const nutritionServingSizeInGrams = convertToGrams(servingAmount, servingUnit, item.name);
          scaleFactor = gramsUsed / nutritionServingSizeInGrams;

          console.log("⚖️ Conversion:", {
            quantity, unit,
            gramsUsed,
            servingAmount, servingUnit,
            nutritionServingSizeInGrams
          });
        }

        if (!scaleFactor || isNaN(scaleFactor)) {
          console.warn("⚠️ Invalid scaleFactor for:", item.name, "=>", scaleFactor);
          return;
        }

        // DEBUG: Show raw nutrition data before scaling
        console.log(`📥 Raw nutrition per serving for "${item.name}":`, ingredientNutrition);

        // Scale nutrition values and show per-nutrient details
        Object.keys(totalNutrition).forEach(key => {
          const baseVal = ingredientNutrition[key] || 0;
          const addVal = baseVal * scaleFactor;
          console.log(`➕ ${item.name} | ${key}: ${baseVal} × ${scaleFactor} = ${addVal}`);
          totalNutrition[key] += addVal;
          console.log(`   Running total ${key}: ${totalNutrition[key]}`);
        });

        console.log("✅ Added nutrition for:", item.name, "ScaleFactor:", scaleFactor);
      });
    }

    currentRecipeNutrition = totalNutrition;
    console.log("📊 FINAL Total Nutrition Calculated:", totalNutrition);

    displayNutritionLabel('total-nutrition', totalNutrition);
    updatePerServingNutrition();

  } catch (error) {
    console.error('Error calculating recipe nutrition:', error);
    alert('Failed to calculate recipe nutrition');
  }
}



function updatePerServingNutrition() {
  if (!currentRecipeNutrition) return;

  const servings = parseInt(document.getElementById('servings-input').value) || 1;
  const perServingNutrition = {};

  Object.keys(currentRecipeNutrition).forEach(key => {
    perServingNutrition[key] = currentRecipeNutrition[key] / servings;
  });

  displayNutritionLabel('per-serving-nutrition', perServingNutrition);
}

function displayNutritionLabel(containerId, nutrition) {
  const container = document.getElementById(containerId);
  
  container.innerHTML = `
    <div style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">Nutrition Facts</div>
    <hr style="border: 2px solid #000;">
    <div style="font-weight: bold;">Calories ${Math.round(nutrition.calories)}</div>
    <hr>
    <div style="font-weight: bold; text-align: right;">% Daily Value*</div>
    <div><strong>Total Fat</strong> ${nutrition.totalFat.toFixed(1)}g</div>
    <div style="margin-left: 15px;">Saturated Fat ${nutrition.saturatedFat.toFixed(1)}g</div>
    <div style="margin-left: 15px;">Trans Fat ${nutrition.transFat.toFixed(1)}g</div>
    <div><strong>Cholesterol</strong> ${Math.round(nutrition.cholesterol)}mg</div>
    <div><strong>Sodium</strong> ${Math.round(nutrition.sodium)}mg</div>
    <div><strong>Total Carbohydrate</strong> ${nutrition.totalCarbs.toFixed(1)}g</div>
    <div style="margin-left: 15px;">Dietary Fiber ${nutrition.dietaryFiber.toFixed(1)}g</div>
    <div style="margin-left: 15px;">Total Sugars ${nutrition.totalSugars.toFixed(1)}g</div>
    <div style="margin-left: 30px;">Added Sugars ${nutrition.addedSugars.toFixed(1)}g</div>
    <div><strong>Protein</strong> ${nutrition.protein.toFixed(1)}g</div>
    <hr>
    <div>Vitamin D ${nutrition.vitaminD.toFixed(1)}mcg</div>
    <div>Calcium ${Math.round(nutrition.calcium)}mg</div>
    <div>Iron ${nutrition.iron.toFixed(1)}mg</div>
    <div>Potassium ${Math.round(nutrition.potassium)}mg</div>
    <hr>
    <div style="font-size: 12px;">*The % Daily Value tells you how much a nutrient contributes to a daily diet.</div>
  `;
}