const GRAMS_PER_POUND = 453.59237;
const rows = [];

const DISCOUNT_CODES = {
  'cliente vip': 65,
};

const discountCodeInput = document.querySelector('#discount-code');
const markupSelect = document.querySelector('#markup-select');

for (let i = 1; i <= 100; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.textContent = `${i}%`;
  markupSelect.appendChild(option);
}
markupSelect.value = 80;

discountCodeInput.addEventListener('input', () => {
  const pct = DISCOUNT_CODES[discountCodeInput.value.trim().toLowerCase()];
  if (pct) {
    markupSelect.value = pct;
    markupSelect.disabled = true;
    markupSelect.classList.add('locked');
  } else {
    markupSelect.disabled = false;
    markupSelect.classList.remove('locked');
  }
});

function getMarkupMultiplier() {
  return 1 + parseInt(markupSelect.value, 10) / 100;
}

const urlCode = new URLSearchParams(window.location.search).get('descuento');
if (urlCode) {
  discountCodeInput.value = urlCode;
  const pct = DISCOUNT_CODES[urlCode.trim().toLowerCase()];
  if (pct) {
    markupSelect.value = pct;
    markupSelect.disabled = true;
    markupSelect.classList.add('locked');
  }
}

const body = document.querySelector('#items-body');
const addRowButton = document.querySelector('#add-row');
const quoteButton = document.querySelector('#quote');
const statusEl = document.querySelector('#status');
const resultEl = document.querySelector('#result');
const tariffInput = document.querySelector('#tariff-input');
const tariffOptions = document.querySelector('#tariff-options');
let tariffs = [
  {
    arancel_id: '88',
    texto: 'Maquillaje 15%',
  },
];

const totalUsdEl = document.querySelector('#total-usd');
const totalGramsEl = document.querySelector('#total-grams');
const totalPoundsEl = document.querySelector('#total-pounds');
const productsResultEl = document.querySelector('#products-result');
const shippingResultEl = document.querySelector('#shipping-result');
const finalResultEl = document.querySelector('#final-result');

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatFlexibleUsd(value) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatForUrl(value) {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function formatMoney(value) {
  return `US$ ${formatFlexibleUsd(value)}`;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setTariffs(tariffs) {
  const currentText = tariffInput.value || 'Maquillaje 15%';
  tariffOptions.innerHTML = '';

  for (const tariff of tariffs) {
    const option = document.createElement('option');
    option.value = tariff.texto || `${tariff.descripcion || 'Arancel'} ${tariff.porcentaje || ''}%`;
    option.dataset.id = tariff.arancel_id;
    tariffOptions.appendChild(option);
  }

  tariffInput.value = tariffs.some((tariff) => tariff.texto === currentText)
    ? currentText
    : 'Maquillaje 15%';
}

async function loadTariffs() {
  try {
    const response = await fetch('/api/tariffs');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo cargar aranceles');
    }

    tariffs = data.records;
    setTariffs(tariffs);
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

function getSelectedTariffId() {
  const normalizedText = tariffInput.value.trim().toLowerCase();
  const selectedTariff = tariffs.find((tariff) => (
    (tariff.texto || '').trim().toLowerCase() === normalizedText
  ));

  return selectedTariff ? selectedTariff.arancel_id : '88';
}

function addRow(values = {}) {
  rows.push({
    id: makeId(),
    name: values.name || '',
    usd: values.usd || '',
    grams: values.grams || '',
    quantity: values.quantity || '1',
  });
  render();
}

function removeRow(id) {
  if (rows.length === 1) {
    return;
  }

  const index = rows.findIndex((row) => row.id === id);
  if (index >= 0) {
    rows.splice(index, 1);
  }
  render();
}

function updateRow(id, field, value) {
  const row = rows.find((item) => item.id === id);
  if (!row) {
    return;
  }

  row[field] = value;
  updateSummary();
}

function getTotals() {
  const totalUsd = rows.reduce((sum, row) => (
    sum + (toNumber(row.usd) * toNumber(row.quantity))
  ), 0);
  const rawGrams = rows.reduce((sum, row) => (
    sum + (toNumber(row.grams) * toNumber(row.quantity))
  ), 0);
  const totalGrams = Math.ceil(rawGrams);
  const pounds = Math.max(1, Math.ceil(totalGrams / GRAMS_PER_POUND));

  return { totalUsd, totalGrams, pounds };
}

function updateSummary() {
  const { totalUsd, totalGrams, pounds } = getTotals();

  totalUsdEl.textContent = `US$ ${formatFlexibleUsd(totalUsd)}`;
  totalGramsEl.textContent = `${totalGrams.toLocaleString('en-US')} g`;
  totalPoundsEl.textContent = `${pounds.toLocaleString('en-US')} lb`;
  quoteButton.disabled = totalUsd <= 0 || totalGrams <= 0;
}

function render() {
  body.innerHTML = '';

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-field="name" value="${escapeAttribute(row.name)}" placeholder="Opcional"></td>
      <td class="number-cell"><input type="number" data-field="usd" value="${escapeAttribute(row.usd)}" min="0" step="0.01" inputmode="decimal"></td>
      <td class="number-cell"><input type="number" data-field="grams" value="${escapeAttribute(row.grams)}" min="0" step="1" inputmode="numeric"></td>
      <td class="qty-cell"><input type="number" data-field="quantity" value="${escapeAttribute(row.quantity)}" min="1" step="1" inputmode="numeric"></td>
      <td class="action-cell"><button class="button ghost" type="button" data-remove="${row.id}" ${rows.length === 1 ? 'disabled' : ''}>X</button></td>
    `;

    for (const input of tr.querySelectorAll('input')) {
      input.addEventListener('input', (event) => {
        updateRow(row.id, event.target.dataset.field, event.target.value);
      });
    }

    tr.querySelector('[data-remove]').addEventListener('click', () => removeRow(row.id));
    body.appendChild(tr);
  }

  updateSummary();
}

async function quote() {
  const { totalUsd, totalGrams, pounds } = getTotals();
  const value = formatForUrl(totalUsd);
  const tariff = getSelectedTariffId();

  statusEl.textContent = 'Cotizando...';
  quoteButton.disabled = true;
  resultEl.hidden = true;

  try {
    const response = await fetch(`/api/quote?value=${encodeURIComponent(value)}&weight=${encodeURIComponent(pounds)}&tariff=${encodeURIComponent(tariff)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo cotizar');
    }

    // Costo del envío proporcional a los gramos reales pedidos
    const shippingPerGram = data.usdTotal.numericPrice / (pounds * GRAMS_PER_POUND);
    const shippingUsd = shippingPerGram * totalGrams;
    const finalUsd = (totalUsd + shippingUsd) * getMarkupMultiplier();

    productsResultEl.textContent = formatMoney(totalUsd);
    shippingResultEl.textContent = formatMoney(shippingUsd);
    finalResultEl.textContent = formatMoney(finalUsd);
    resultEl.hidden = false;
    statusEl.textContent = `URL consultada: ${data.url}`;
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    updateSummary();
  }
}

addRowButton.addEventListener('click', () => addRow());
quoteButton.addEventListener('click', quote);

async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const data = await response.json();
    if (data.markup && !markupSelect.disabled) markupSelect.value = data.markup;
  } catch {}
}

markupSelect.addEventListener('change', () => {
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ markup: parseInt(markupSelect.value, 10) }),
  });
});

addRow();
loadTariffs();
loadSettings();
