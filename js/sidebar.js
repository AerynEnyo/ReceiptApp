// Sidebar navigation
  dom.btnReceipts.addEventListener('click', () => {
    loadReceiptsPage();
  });

  dom.btnReports.addEventListener('click', () => {
    loadReportsPage();
  });

  dom.btnIngredients.addEventListener('click', () => {
    loadIngredientsPage();
  });
  
  dom.btnRecipes.addEventListener('click', () => {
	loadRecipesPage();
  });
  
  dom.btnUtensils.addEventListener('click', () => {
	loadUtensilsPage();
  });

  dom.btnPackaging.addEventListener('click', () => {
	loadPackagingPage();
  });

  dom.btnIngredientInfo.addEventListener('click', async () => {
	  try {
	    await loadIngredientInfoPage();
	  } catch (error) {
	    console.error('Error loading ingredient info page:', error);
	    alert('Failed to load ingredient info page');
	  }
	});

	dom.btnRecipeInfo.addEventListener('click', async () => {
	  try {
	    await loadRecipeInfoPage();
	  } catch (error) {
	    console.error('Error loading recipe info page:', error);
	    alert('Failed to load recipe info page');
	  }
	});

  // Load default page
  loadReceiptsPage();