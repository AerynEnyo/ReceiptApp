// Initialize Firebase is assumed loaded already in firebase-config.js

(() => {
  // Global state
  window.currentPage = 'receipts';  // default page on load
  window.editingDocId = null;
  window.currentImageDownloadUrl = null;
  window.currentLocalBlobUrl = null;

  // Shared functions for modal management
  window.clearModal = function () {
    dom.vendor.value = '';
    dom.amount.value = '';
    dom.method.value = '';
    dom.date.value = '';
    dom.invoice.value = '';
    dom.items.value = '';
    dom.receiptImage.value = '';
    dom.imagePreview.style.display = 'none';
    dom.imagePreview.src = '';
    dom.downloadImageBtn.style.display = 'none';

    if (currentLocalBlobUrl) {
      URL.revokeObjectURL(currentLocalBlobUrl);
      currentLocalBlobUrl = null;
    }
    currentImageDownloadUrl = null;
  };

  window.openModal = function () {
    dom.modal.style.display = 'flex';
  };

  window.closeModal = function () {
    dom.modal.style.display = 'none';
    clearModal();
    editingDocId = null;
  };

  // Event listeners for modal controls
  dom.cancelBtn.addEventListener('click', closeModal);
})();

async function loadPackagingListForModal() {
  const packagingListDiv = document.getElementById('packaging-list');
  packagingListDiv.innerHTML = ''; // Clear previous checkboxes

  const snapshot = await db.collection('packaging').get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    const price = parseFloat(data.price) || 0;
    const type = data.type || '';

    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    label.innerHTML = `
      <input type="checkbox" data-id="${id}" data-price="${price}" />
      ${type} ($${price.toFixed(2)} per unit)
    `;

    packagingListDiv.appendChild(label);
  });
}


