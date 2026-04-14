/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectedBtn = document.getElementById("clearSelectedBtn");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const SELECTED_PRODUCTS_STORAGE_KEY = "selectedProducts";

const API_URL = "https://cloudfare-worker.bamideled141.workers.dev";

/* Keep all products in memory after first fetch */
let allProducts = [];

/* Global list of selected products */
const selectedProducts = [];

/* Global chat memory for conversational context */
const conversationHistory = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${isProductSelected(product.id) ? "selected" : ""}" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Check whether a product is already selected */
function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Save selectedProducts to localStorage */
function saveSelectedProductsToLocalStorage() {
  localStorage.setItem(
    SELECTED_PRODUCTS_STORAGE_KEY,
    JSON.stringify(selectedProducts),
  );
}

/* Load selectedProducts from localStorage */
function loadSelectedProductsFromLocalStorage() {
  const storedSelectedProducts = localStorage.getItem(
    SELECTED_PRODUCTS_STORAGE_KEY,
  );

  if (!storedSelectedProducts) return;

  try {
    const parsedProducts = JSON.parse(storedSelectedProducts);
    if (!Array.isArray(parsedProducts)) return;

    const selectedIds = parsedProducts
      .map((product) => Number(product.id))
      .filter((id) => !Number.isNaN(id));

    const restoredSelectedProducts = allProducts.filter((product) =>
      selectedIds.includes(product.id),
    );

    selectedProducts.splice(
      0,
      selectedProducts.length,
      ...restoredSelectedProducts,
    );
  } catch {
    localStorage.removeItem(SELECTED_PRODUCTS_STORAGE_KEY);
  }
}

/* Keep selected highlight in sync for cards currently visible */
function syncVisibleCardSelectionState() {
  const visibleCards = productsContainer.querySelectorAll(".product-card");

  visibleCards.forEach((card) => {
    const productId = Number(card.dataset.id);
    card.classList.toggle("selected", isProductSelected(productId));
  });
}

/* Run all UI/state updates after selectedProducts changes */
function handleSelectedProductsChange() {
  saveSelectedProductsToLocalStorage();
  updateSelectedProductsUI();
  syncVisibleCardSelectionState();
}

/* Prevent HTML injection when showing API text */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* Format AI response with visible sections and line breaks */
function formatRoutineResponse(responseText) {
  const safeText = escapeHtml(responseText).trim();
  const lines = safeText.split("\n").filter((line) => line.trim() !== "");

  return lines
    .map((line) => {
      if (/^\s*morning\b[:\-]?/i.test(line)) {
        return `<h3 class="routine-section-title">Morning Routine</h3>`;
      }

      if (/^\s*night\b[:\-]?/i.test(line)) {
        return `<h3 class="routine-section-title">Night Routine</h3>`;
      }

      return `<p class="routine-line">${line}</p>`;
    })
    .join("");
}

/* Scroll chat window to newest message */
function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Add one chat message bubble to the chat window */
function appendChatMessage(role, content) {
  const safeText = escapeHtml(content);
  const messageClass =
    role === "user" ? "chat-message-user" : "chat-message-assistant";
  const label = role === "user" ? "You" : "Beauty Advisor";

  const messageHtml = `
    <div class="chat-message ${messageClass}">
      <p class="chat-message-label">${label}</p>
      <p class="chat-message-content">${safeText.replace(/\n/g, "<br>")}</p>
    </div>
  `;

  chatWindow.insertAdjacentHTML("beforeend", messageHtml);
  scrollChatToBottom();
}

/* Add/remove a product in selectedProducts when the card is clicked */
function toggleProductSelection(productId) {
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (selectedIndex >= 0) {
    selectedProducts.splice(selectedIndex, 1);
    return;
  }

  const productToAdd = allProducts.find((product) => product.id === productId);
  if (productToAdd) {
    selectedProducts.push(productToAdd);
  }
}

/* Remove a product by id from selectedProducts */
function removeSelectedProduct(productId) {
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (selectedIndex >= 0) {
    selectedProducts.splice(selectedIndex, 1);
  }
}

/* Render the selected products section */
function updateSelectedProductsUI() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message">No products selected yet</div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-product-item" data-id="${product.id}">
      <span>${product.brand} - ${product.name}</span>
      <button type="button" class="remove-selected-btn" data-id="${product.id}">
        Remove
      </button>
    </div>
  `,
    )
    .join("");
}

/* Toggle selection when any product card is clicked */
productsContainer.addEventListener("click", (e) => {
  const clickedCard = e.target.closest(".product-card");
  if (!clickedCard) return;

  const productId = Number(clickedCard.dataset.id);
  toggleProductSelection(productId);
  handleSelectedProductsChange();
});

/* Remove from selected list when Remove button is clicked */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-btn");
  if (!removeButton) return;

  const productId = Number(removeButton.dataset.id);
  removeSelectedProduct(productId);
  handleSelectedProductsChange();
});

/* Clear all selected products from memory, localStorage, and UI */
clearSelectedBtn.addEventListener("click", () => {
  selectedProducts.splice(0, selectedProducts.length);
  localStorage.removeItem(SELECTED_PRODUCTS_STORAGE_KEY);
  updateSelectedProductsUI();
  syncVisibleCardSelectionState();
});

/* Generate routine with selected products using the Cloudflare Worker API */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = `
      <p class="routine-line">Select at least one product before generating a routine.</p>
    `;
    return;
  }

  if (typeof API_URL === "undefined" || !API_URL) {
    chatWindow.innerHTML = `
      <p class="routine-line">API_URL is missing. Check your secrets.js file.</p>
    `;
    return;
  }

  const routineProducts = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  chatWindow.innerHTML = `<p class="routine-line">Generating your routine...</p>`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "routine",
        products: routineProducts,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError =
        data?.error || `Request failed with status ${response.status}`;
      throw new Error(apiError);
    }

    /* Worker returns { response: "..." }, keep OpenAI fallback for flexibility */
    const aiText = data?.response || data?.choices?.[0]?.message?.content;

    if (!aiText) {
      chatWindow.innerHTML = `
        <p class="routine-line">No routine was returned. Try again.</p>
      `;
      return;
    }

    chatWindow.innerHTML = `
      <div class="routine-response">
        ${formatRoutineResponse(aiText)}
      </div>
    `;
  } catch (error) {
    chatWindow.innerHTML = `
      <p class="routine-line">Could not generate routine: ${escapeHtml(error.message || "Unknown error")}</p>
    `;
  }
});

/* Load once when page opens */
async function initializeProducts() {
  allProducts = await loadProducts();
  loadSelectedProductsFromLocalStorage();
  updateSelectedProductsUI();
  syncVisibleCardSelectionState();
}

initializeProducts();

/* Apply category + search filters together */
function applyProductFilters() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", (e) => {
  e.preventDefault();
  applyProductFilters();
});

/* Filter products in real time as the user types */
productSearch.addEventListener("input", () => {
  applyProductFilters();
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  const userMessage = {
    role: "user",
    content: message,
  };

  conversationHistory.push(userMessage);
  appendChatMessage(userMessage.role, userMessage.content);
  userInput.value = "";

  if (typeof API_URL === "undefined" || !API_URL) {
    appendChatMessage(
      "assistant",
      "API_URL is missing. Check your secrets.js file.",
    );
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "chat",
        messages: conversationHistory,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError =
        data?.error || `Request failed with status ${response.status}`;
      throw new Error(apiError);
    }

    const aiText = data?.response || data?.choices?.[0]?.message?.content;

    if (!aiText) {
      appendChatMessage(
        "assistant",
        "No response generated. Please try again.",
      );
      return;
    }

    const assistantMessage = {
      role: "assistant",
      content: aiText,
    };

    conversationHistory.push(assistantMessage);
    appendChatMessage(assistantMessage.role, assistantMessage.content);
  } catch (error) {
    appendChatMessage(
      "assistant",
      `Could not send message: ${error.message || "Unknown error"}`,
    );
  }
});
