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

  // Load default page
  loadReceiptsPage();