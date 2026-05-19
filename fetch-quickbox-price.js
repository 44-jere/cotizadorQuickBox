const { chromium } = require('playwright');

function cleanPrice(rawText) {
  const match = rawText.match(/[\d,]+\.\d{2}/);
  if (!match) {
    throw new Error(`No price with decimals found in: ${rawText}`);
  }

  return match[0].replace(/,/g, '');
}

async function getCleanPrice(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return element && /[\d,]+\.\d{2}/.test(element.innerText);
  }, selector, { timeout: 60000 });

  const rawText = (await locator.innerText()).trim();
  const cleanedPrice = cleanPrice(rawText);

  return {
    rawText,
    cleanedPrice,
    numericPrice: Number(cleanedPrice),
  };
}

async function quoteQuickbox({
  value = '67.84',
  weight = '2',
  tariff = '88',
  countryId = '1',
  planId = '2',
} = {}) {
  const url = `https://www.quickboxusa.com/webapp/#/cotizador/info/${encodeURIComponent(value)}/${encodeURIComponent(weight)}/${encodeURIComponent(tariff)}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.addInitScript(({ countryId, planId }) => {
      localStorage.setItem('pais_id', countryId);
      localStorage.setItem('plan_id', planId);
      localStorage.setItem('platform', 'isWeb');
      localStorage.setItem('suscripcion_id', '');
    }, { countryId, planId });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const localTotal = await getCleanPrice(page, '.total-payment.text-center.red');
    const usdTotal = await getCleanPrice(page, '.total-payment-small.text-end.red');

    return {
      url,
      localTotal,
      usdTotal,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const result = await quoteQuickbox({
    value: process.argv[2] || '67.84',
    weight: process.argv[3] || '2',
    tariff: process.argv[4] || '88',
    countryId: process.argv[5] || '1',
    planId: process.argv[6] || '2',
  });

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { quoteQuickbox };
