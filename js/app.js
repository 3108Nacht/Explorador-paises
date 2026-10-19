const API_PAISES = 'https://countries.dev';
const API_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const API_CLIMA = 'https://api.open-meteo.com/v1/forecast';
// Solo pedimos los campos necesarios para el listado (respuesta más liviana)
const CAMPOS = 'name,alpha2Code,alpha3Code,capital,region,subregion,population,area,flags,translations';
const POR_PAGINA = 24;

// ---------- Estado de la aplicación ----------
let paises = [];        // todos los países recibidos de la API
let filtrados = [];     // resultado de búsqueda/filtro/orden
let mostrados = 0;      // cuántas tarjetas se han pintado

// ---------- Referencias del DOM ----------
const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const estado = $('#estado');
const resumen = $('#resumen');
const btnMas = $('#btnMas');
const txtBuscar = $('#txtBuscar');
const selRegion = $('#selRegion');
const selOrden = $('#selOrden');
const modalContenido = $('#modalContenido');
const modalTitulo = $('#modalTitulo');
const modal = new bootstrap.Modal('#modalDetalle');

// ---------- Utilidades ----------
const fmt = new Intl.NumberFormat('es-NI');
const regionesEs = { Americas: 'América', Europe: 'Europa', Asia: 'Asia', Africa: 'África', Oceania: 'Oceanía', Polar: 'Polar', 'Antarctic Ocean': 'Océano Antártico', Antarctic: 'Antártida' };
const coloresRegion = { Americas: 'info', Europe: 'primary', Asia: 'warning', Africa: 'success', Oceania: 'danger' };
const escapar = (txt) => String(txt ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const porCodigo = (codigo) => paises.find((p) => p.alpha3Code === codigo);
// Nombre en español: primero translations.es de la respuesta, luego del listado en caché
const nombreEs = (p) => p.translations?.es || porCodigo(p.alpha3Code)?.translations?.es || p.name;
const badgeRegion = (r) => `<span class="badge text-bg-${coloresRegion[r] || 'secondary'}">${regionesEs[r] || escapar(r)}</span>`;
const fila = (etiqueta, valor) => `
  <li class="list-group-item d-flex justify-content-between gap-3">
    <span class="text-body-secondary">${etiqueta}</span><span class="fw-semibold text-end">${valor}</span>
  </li>`;

/**
 * Pinta el panel de métricas: estado HTTP, latencia, content-type,
 * número de registros y el endpoint consultado.
 */
function mostrarMetricas({ url, status, ok, ms, tipo, registros }) {
  const mEstado = $('#mEstado');
  mEstado.textContent = status ? `${status} ${ok ? 'OK' : 'Error'}` : 'Sin red';
  mEstado.className = `fs-4 fw-bold font-monospace ${ok ? 'text-success' : 'text-danger'}`;
  $('#mLatencia').textContent = ms != null ? `${Math.round(ms)} ms` : '—';
  $('#mTipo').textContent = tipo || '—';
  $('#mRegistros').textContent = registros ?? '—';
  $('#mEndpoint').textContent = url;
}

/**
 * Función genérica de consumo con async/await:
 * 1) fetch  2) validar respuesta.ok  3) parsear JSON  4) registrar métricas
 */
async function obtenerJSON(url) {
  const inicio = performance.now();
  let respuesta;
  try {
    respuesta = await fetch(url);
  } catch {
    mostrarMetricas({ url, status: 0, ok: false, ms: performance.now() - inicio });
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
  }
  const ms = performance.now() - inicio;
  const tipo = respuesta.headers.get('content-type');

  if (!respuesta.ok) {
    mostrarMetricas({ url, status: respuesta.status, ok: false, ms, tipo, registros: 0 });
    const err = new Error(`Error HTTP: ${respuesta.status}`);
    err.status = respuesta.status;
    throw err;
  }

  const datos = await respuesta.json();
  mostrarMetricas({ url, status: respuesta.status, ok: true, ms, tipo, registros: Array.isArray(datos) ? datos.length : 1 });
  return datos;
}

// =========================================================
// 1. LISTADO GENERAL DE PAÍSES  →  GET /countries?fields=...
// =========================================================
async function cargarPaises() {
  try {
    paises = await obtenerJSON(`${API_PAISES}/countries?fields=${CAMPOS}`);
    estado.hidden = true;
    aplicarFiltros();
  } catch (error) {
    estado.innerHTML = `
      <div class="alert alert-danger d-inline-block">
        <i class="bi bi-exclamation-triangle"></i> ${escapar(error.message)}
        <button class="btn btn-sm btn-outline-danger ms-2" onclick="location.reload()">Reintentar</button>
      </div>`;
  }
}

function aplicarFiltros() {
  const texto = txtBuscar.value.trim().toLowerCase();
  const region = selRegion.value;
  const orden = selOrden.value;

  filtrados = paises.filter((p) => {
    const coincideTexto = !texto ||
      nombreEs(p).toLowerCase().includes(texto) ||
      p.name.toLowerCase().includes(texto) ||
      (p.capital || '').toLowerCase().includes(texto);
    const coincideRegion = !region || p.region === region;
    return coincideTexto && coincideRegion;
  });

  filtrados.sort((a, b) => {
    if (orden === 'poblacion') return (b.population || 0) - (a.population || 0);
    if (orden === 'area') return (b.area || 0) - (a.area || 0);
    return nombreEs(a).localeCompare(nombreEs(b), 'es');
  });

  grid.innerHTML = '';
  mostrados = 0;
  pintarSiguientes();
}

function pintarSiguientes() {
  const lote = filtrados.slice(mostrados, mostrados + POR_PAGINA);
  grid.insertAdjacentHTML('beforeend', lote.map(tarjetaHTML).join(''));
  mostrados += lote.length;

  const totalPob = filtrados.reduce((s, p) => s + (p.population || 0), 0);
  resumen.innerHTML = filtrados.length
    ? `Mostrando <b>${mostrados}</b> de <b>${filtrados.length}</b> países · Población total: <b>${fmt.format(totalPob)}</b> habitantes`
    : '<span class="text-warning"><i class="bi bi-info-circle"></i> No se encontraron países con ese criterio.</span>';
  btnMas.hidden = mostrados >= filtrados.length;
}

function tarjetaHTML(p) {
  return `
    <div class="col">
      <div class="card h-100 shadow-sm tarjeta-pais" tabindex="0" data-codigo="${p.alpha3Code}">
        <img src="${p.flags?.svg || p.flags?.png}" class="card-img-top" alt="Bandera de ${escapar(nombreEs(p))}" loading="lazy">
        <div class="card-body">
          ${badgeRegion(p.region)}
          <h5 class="card-title mt-2 mb-3">${escapar(nombreEs(p))}</h5>
          <p class="card-text small mb-1"><i class="bi bi-building text-info"></i> <b>Capital:</b> ${escapar(p.capital || '—')}</p>
          <p class="card-text small mb-1"><i class="bi bi-people text-info"></i> <b>Población:</b> ${fmt.format(p.population || 0)}</p>
          <p class="card-text small mb-0"><i class="bi bi-rulers text-info"></i> <b>Área:</b> ${p.area ? fmt.format(p.area) + ' km²' : '—'}</p>
        </div>
      </div>
    </div>`;
}

async function abrirDetalle(codigo) {
  modalTitulo.textContent = 'Cargando…';
  modalContenido.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-info"></div></div>`;
  modal.show();

  try {
    const pais = await obtenerJSON(`${API_PAISES}/alpha/${codigo}`);
    modalTitulo.innerHTML = `${pais.flag || ''} ${escapar(nombreEs(pais))}`;
    modalContenido.innerHTML = detalleHTML(pais);
    await cargarClima(pais); // petición encadenada a Open-Meteo
  } catch (error) {
    modalTitulo.textContent = 'Error';
    modalContenido.innerHTML = `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-triangle"></i> ${escapar(error.message)}</div>`;
  }
}

function detalleHTML(p) {
  const idiomas = (p.languages || []).map((l) => `${l.nativeName || l.name}`).join(', ') || '—';
  const monedas = (p.currencies || []).map((m) => `${m.name} (${m.symbol || m.code})`).join(', ') || '—';
  const vecinos = (p.borders || []).map(porCodigo).filter(Boolean);
  const mapa = p.latlng ? `https://www.openstreetmap.org/?mlat=${p.latlng[0]}&mlon=${p.latlng[1]}#map=5/${p.latlng[0]}/${p.latlng[1]}` : null;

  return `
    <div class="row g-4">
      <div class="col-md-5">
        <img src="${p.flags?.svg || p.flags?.png}" class="img-fluid rounded bandera-detalle w-100" alt="Bandera">
        <div class="mt-3">${badgeRegion(p.region)} <span class="badge text-bg-secondary">${escapar(p.subregion || '')}</span></div>
        <p class="text-body-secondary small mt-2 mb-0">Nombre nativo: <b>${escapar(p.nativeName || p.name)}</b><br>Nombre en inglés: <b>${escapar(p.name)}</b></p>
      </div>
      <div class="col-md-7">
        <ul class="list-group list-group-flush small">
          ${fila('Capital', escapar(p.capital || '—'))}
          ${fila('Población', fmt.format(p.population || 0))}
          ${fila('Área', p.area ? fmt.format(p.area) + ' km²' : '—')}
          ${fila('Densidad', p.populationDensity ? p.populationDensity + ' hab/km²' : '—')}
          ${fila('Idiomas', escapar(idiomas))}
          ${fila('Moneda', escapar(monedas))}
          ${fila('Zona horaria', escapar((p.timezones || []).slice(0, 2).join(', ')))}
          ${fila('Código', `${p.alpha3Code} / ${p.alpha2Code}`)}
          ${fila('Prefijo telefónico', p.callingCodes?.length ? '+' + p.callingCodes[0] : '—')}
          ${fila('Dominio', escapar((p.topLevelDomain || []).join(', ') || '—'))}
          ${p.gini ? fila('Índice Gini', p.gini) : ''}
        </ul>
      </div>
    </div>

    <h6 class="text-uppercase text-body-secondary small mt-4">Clima actual en ${escapar(p.capital || 'el país')}</h6>
    <div id="clima" class="card card-body">
      <div class="d-flex align-items-center gap-2 text-body-secondary"><div class="spinner-border spinner-border-sm"></div> Consultando Open-Meteo…</div>
    </div>
    ${mapa ? `<a class="btn btn-sm btn-outline-info mt-2" href="${mapa}" target="_blank" rel="noopener"><i class="bi bi-geo-alt"></i> Ver en el mapa</a>` : ''}

    <h6 class="text-uppercase text-body-secondary small mt-4">Países fronterizos</h6>
    <div class="d-flex flex-wrap gap-2">
      ${vecinos.length
        ? vecinos.map((v) => `
            <button class="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2" data-codigo="${v.alpha3Code}">
              <img src="${v.flags?.png}" class="mini-bandera" alt=""> ${escapar(nombreEs(v))}
            </button>`).join('')
        : '<span class="text-body-secondary small">No tiene fronteras terrestres (isla o territorio aislado).</span>'}
    </div>`;
}

// Códigos WMO de Open-Meteo → descripción e ícono
const CLIMA_WMO = {
  0: ['Despejado', '☀️'], 1: ['Mayormente despejado', '🌤️'], 2: ['Parcialmente nublado', '⛅'], 3: ['Nublado', '☁️'],
  45: ['Niebla', '🌫️'], 48: ['Niebla con escarcha', '🌫️'],
  51: ['Llovizna ligera', '🌦️'], 53: ['Llovizna', '🌦️'], 55: ['Llovizna intensa', '🌧️'],
  61: ['Lluvia ligera', '🌦️'], 63: ['Lluvia', '🌧️'], 65: ['Lluvia fuerte', '🌧️'],
  71: ['Nieve ligera', '🌨️'], 73: ['Nieve', '🌨️'], 75: ['Nieve fuerte', '❄️'],
  80: ['Chubascos', '🌦️'], 81: ['Chubascos fuertes', '🌧️'], 82: ['Chubascos violentos', '⛈️'],
  95: ['Tormenta eléctrica', '⛈️'], 96: ['Tormenta con granizo', '⛈️'], 99: ['Tormenta con granizo', '⛈️'],
};

async function cargarClima(pais) {
  const cont = $('#clima');
  try {
    let lat, lon, lugar = pais.capital;

    if (pais.capital) {
      const geo = await obtenerJSON(`${API_GEO}?name=${encodeURIComponent(pais.capital)}&count=1&language=es&countryCode=${pais.alpha2Code}`);
      if (geo.results?.length) ({ latitude: lat, longitude: lon } = geo.results[0]);
    }
    // Si no se encontró la capital, usamos las coordenadas del país
    if (lat == null && pais.latlng) { [lat, lon] = pais.latlng; lugar = 'centro del país'; }
    if (lat == null) throw new Error('Sin coordenadas');

    const datos = await obtenerJSON(`${API_CLIMA}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`);
    const c = datos.current;
    const [desc, icono] = CLIMA_WMO[c.weather_code] || ['Condición desconocida', '🌡️'];
    cont.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <span class="clima-icono">${icono}</span>
        <div>
          <div class="fs-2 fw-bold font-monospace">${Math.round(c.temperature_2m)} °C</div>
          <div>${desc} <span class="text-body-secondary small">· ${escapar(lugar)}</span></div>
          <div class="text-body-secondary small">
            <i class="bi bi-thermometer-half"></i> Sensación ${Math.round(c.apparent_temperature)} °C ·
            <i class="bi bi-droplet"></i> Humedad ${c.relative_humidity_2m}% ·
            <i class="bi bi-wind"></i> Viento ${Math.round(c.wind_speed_10m)} km/h
          </div>
        </div>
      </div>`;
  } catch {
    cont.innerHTML = '<span class="text-body-secondary small"><i class="bi bi-cloud-slash"></i> No se pudo obtener el clima en este momento.</span>';
  }
}

const CODIGO_ASYNC = (nombre) => `async function buscarPais() {
  const url = '${API_PAISES}/name/${nombre}';

  try {
    // 1. Iniciar la petición HTTP GET
    const respuesta = await fetch(url);

    // 2. Verificar el estado de la respuesta (200 OK)
    if (!respuesta.ok) {
      throw new Error(\`Error HTTP: \${respuesta.status}\`);
    }

    // 3. Parsear el cuerpo de la respuesta a JSON
    const datos = await respuesta.json();
    const pais = datos[0];

    // 4. Usar los datos
    console.log('Nombre:', pais.name);
    console.log('Capital:', pais.capital);
    console.log('Población:', pais.population);
  } catch (error) {
    console.error('Error al realizar fetch:', error.message);
  }
}`;

const CODIGO_THEN = (nombre) => `function buscarPais() {
  fetch('${API_PAISES}/name/${nombre}')
    .then(respuesta => {
      if (!respuesta.ok) {
        throw new Error(\`Error HTTP: \${respuesta.status}\`);
      }
      return respuesta.json();
    })
    .then(datos => {
      const pais = datos[0];
      console.log('Nombre:', pais.name);
      console.log('Capital:', pais.capital);
    })
    .catch(error => {
      console.error('Error:', error.message);
    });
}`;

// Versión async/await
async function labAsync(nombre) {
  try {
    const datos = await obtenerJSON(`${API_PAISES}/name/${encodeURIComponent(nombre)}`);
    mostrarLab(datos);
  } catch (error) {
    mostrarErrorLab(error, nombre);
  }
}

// Versión con Promesas .then / .catch
function labThen(nombre) {
  const url = `${API_PAISES}/name/${encodeURIComponent(nombre)}`;
  const inicio = performance.now();
  let meta = {};

  fetch(url)
    .then((respuesta) => {
      meta = { url, status: respuesta.status, ok: respuesta.ok, ms: performance.now() - inicio, tipo: respuesta.headers.get('content-type') };
      if (!respuesta.ok) {
        const err = new Error(`Error HTTP: ${respuesta.status}`);
        err.status = respuesta.status;
        throw err;
      }
      return respuesta.json();
    })
    .then((datos) => {
      mostrarMetricas({ ...meta, registros: datos.length });
      mostrarLab(datos);
    })
    .catch((error) => {
      mostrarMetricas(meta.status ? { ...meta, registros: 0 } : { url, status: 0, ok: false, ms: performance.now() - inicio });
      mostrarErrorLab(error, nombre);
    });
}

function mostrarLab(datos) {
  const p = datos[0];
  $('#jsonCrudo').textContent = JSON.stringify(datos, null, 2);
  $('#tabResultado').innerHTML = `
    <div class="row g-4 align-items-start">
      <div class="col-md-4"><img src="${p.flags?.svg || p.flags?.png}" class="img-fluid rounded bandera-detalle w-100" alt="Bandera"></div>
      <div class="col-md-8">
        ${badgeRegion(p.region)}
        <h3 class="mt-2">${p.flag || ''} ${escapar(nombreEs(p))}</h3>
        <ul class="list-group list-group-flush small">
          ${fila('Capital', escapar(p.capital || '—'))}
          ${fila('Población', fmt.format(p.population || 0))}
          ${fila('Área', p.area ? fmt.format(p.area) + ' km²' : '—')}
          ${fila('Idiomas', escapar((p.languages || []).map((l) => l.name).join(', ')))}
        </ul>
        ${datos.length > 1 ? `<p class="small text-body-secondary mt-2">La API devolvió ${datos.length} coincidencias; se muestra la primera.</p>` : ''}
        <button class="btn btn-sm btn-info mt-3" data-codigo="${p.alpha3Code}"><i class="bi bi-eye"></i> Ver detalle y clima</button>
      </div>
    </div>`;
}

function mostrarErrorLab(error, nombre) {
  $('#jsonCrudo').textContent = `// ${error.message}`;
  const msg = error.status === 404
    ? `No se encontró ningún país llamado "<b>${escapar(nombre)}</b>". El endpoint busca por el nombre en inglés (ej: <i>germany</i>, <i>spain</i>).`
    : escapar(error.message);
  $('#tabResultado').innerHTML = `<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle"></i> ${msg}</div>`;
}

let temporizador;
txtBuscar.addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(aplicarFiltros, 250); // debounce
});
selRegion.addEventListener('change', aplicarFiltros);
selOrden.addEventListener('change', aplicarFiltros);
btnMas.addEventListener('click', pintarSiguientes);

// Delegación de eventos: cualquier elemento con data-codigo abre el detalle
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-codigo]');
  if (el) abrirDetalle(el.dataset.codigo);
});
document.addEventListener('keydown', (e) => {
  const el = e.target.closest?.('.tarjeta-pais');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirDetalle(el.dataset.codigo); }
});

$('#formLab').addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = $('#txtLab').value.trim();
  if (!nombre) return;
  const metodo = $('#selMetodo').value;
  $('#codigoUsado').textContent = metodo === 'async' ? CODIGO_ASYNC(nombre) : CODIGO_THEN(nombre);
  $('#tabResultado').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info"></div></div>';
  metodo === 'async' ? labAsync(nombre) : labThen(nombre);
});

// Tema claro / oscuro de Bootstrap
const raiz = document.documentElement;
function aplicarTema(tema) {
  raiz.setAttribute('data-bs-theme', tema);
  $('#btnTema').innerHTML = tema === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
}
$('#btnTema').addEventListener('click', () => {
  const nuevo = raiz.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  aplicarTema(nuevo);
  try { localStorage.setItem('tema', nuevo); } catch {}
});
try { aplicarTema(localStorage.getItem('tema') || 'dark'); } catch { aplicarTema('dark'); }

// ---------- Inicio ----------
cargarPaises();
