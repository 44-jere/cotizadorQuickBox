const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { quoteQuickbox } = require('./fetch-quickbox-price');

const PORT = Number(process.env.PORT || 3008);
const PUBLIC_DIR = path.join(__dirname, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function fetchTariffs(countryId = '1') {
  const body = new URLSearchParams({ pais_id: countryId });
  const apiResponse = await fetch('https://node.qs.gt/lista/aranceles', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await apiResponse.json();

  if (!payload.result || !Array.isArray(payload.records)) {
    throw new Error(payload.message || 'No se pudo cargar la lista de aranceles');
  }

  return payload.records;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extension] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/api/quote') {
    const value = url.searchParams.get('value');
    const weight = url.searchParams.get('weight');
    const tariff = url.searchParams.get('tariff') || '88';

    if (!value || !weight) {
      sendJson(response, 400, { error: 'value and weight are required' });
      return;
    }

    try {
      const quote = await quoteQuickbox({ value, weight, tariff });
      sendJson(response, 200, quote);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (url.pathname === '/api/tariffs') {
    try {
      const tariffs = await fetchTariffs(url.searchParams.get('countryId') || '1');
      sendJson(response, 200, { records: tariffs });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  await serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Calculator ready at http://localhost:${PORT}`);
});
