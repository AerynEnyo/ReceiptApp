// Handle Image Preview and Download Button

  dom.receiptImage.addEventListener('change', () => {
    const file = dom.receiptImage.files[0];
    if (file) {
      if (currentLocalBlobUrl) URL.revokeObjectURL(currentLocalBlobUrl);
      currentLocalBlobUrl = URL.createObjectURL(file);

      dom.imagePreview.src = currentLocalBlobUrl;
      dom.imagePreview.style.display = 'block';
      dom.downloadImageBtn.style.display = 'inline-block';
      currentImageDownloadUrl = null; // new image not uploaded yet
    } else {
      dom.imagePreview.style.display = 'none';
      dom.downloadImageBtn.style.display = 'none';
      if (currentLocalBlobUrl) {
        URL.revokeObjectURL(currentLocalBlobUrl);
        currentLocalBlobUrl = null;
      }
      currentImageDownloadUrl = null;
    }
  });

  dom.downloadImageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentImageDownloadUrl) {
      // Fetch blob and download
      fetch(currentImageDownloadUrl)
        .then(resp => resp.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'receipt-image.jpg';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => alert('Failed to download image'));
    } else if (currentLocalBlobUrl) {
      // Download local blob
      const a = document.createElement('a');
      a.href = currentLocalBlobUrl;
      a.download = 'receipt-image.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      alert('No image to download');
    }
  });

  // Upload image helper
  function uploadImage(file) {
    if (!file) return Promise.resolve(null);
    const storageRef = firebase.storage().ref('receipts/' + Date.now() + '_' + file.name);
    return storageRef.put(file)
      .then(snapshot => snapshot.ref.getDownloadURL());
  }

dom.items.addEventListener('input', () => {
  let total = 0;

  const lines = dom.items.value.split('\n');

  for (let line of lines) {
    const parts = line.split(':').map(p => p.trim());

    if (parts.length < 3) continue; // Skip invalid lines

    const price = parseFloat(parts[2]);

    if (!isNaN(price)) {
      total += price;
    }
  }

  dom.amount.value = total.toFixed(2);
});


  // Submit transaction
  dom.submitBtn.addEventListener('click', async () => {
	  const vendor = dom.vendor.value.trim();
	  const amount = dom.amount.value.trim();
	  const method = dom.method.value;
	  const date = dom.date.value;
	  const invoice = dom.invoice.value.trim();

	  const rawItems = dom.items.value.split('\n').map(i => i.trim()).filter(i => i.length > 0);
	  const items = rawItems.map(line => {
		const parts = line.split(':').map(p => p.trim());
		return {
		  name: parts[0] || '',
		  size: parts[1] || '',
		  price: parts[2] || ''
		};
	  });

	  if (!vendor || !amount || !method || !date) {
		alert("Please fill in all required fields.");
		return;
	  }

	  try {
		await addIngredients(items);  // WAIT for ingredients to update
	  } catch (e) {
		console.error('Failed to add ingredients:', e);
	  }

	  const imageFile = dom.receiptImage.files[0];

	  if (editingDocId) {
		// Editing existing
		const doc = await db.collection("receipts").doc(editingDocId).get();
		if (!doc.exists) {
		  alert("Document does not exist!");
		  return;
		}
		const existingImageUrl = doc.data()?.imageUrl || null;

		async function saveDoc(imageUrl) {
		  const data = { vendor, amount, method, date, invoice, items, imageUrl: imageUrl ?? existingImageUrl };
		  await db.collection("receipts").doc(editingDocId).set(data);
		  closeModal();
		  if (currentPage === 'ingredients') {
			loadIngredientsPage();
		  } else {
			loadReceiptsPage();
		  }
		}

		if (imageFile) {
		  const imageUrl = await uploadImage(imageFile);
		  await saveDoc(imageUrl);
		} else {
		  await saveDoc();
		}
	  } else {
		// Adding new
		async function saveDoc(imageUrl) {
		  const data = { vendor, amount, method, date, invoice, items, imageUrl: imageUrl || null };
		  await db.collection("receipts").add(data);
		  closeModal();
		  if (currentPage === 'ingredients') {
			loadIngredientsPage();
		  } else {
			loadReceiptsPage();
		  }
		}
		if (imageFile) {
		  const imageUrl = await uploadImage(imageFile);
		  await saveDoc(imageUrl);
		} else {
		  await saveDoc();
		}
	  }
	});