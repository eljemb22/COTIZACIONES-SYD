const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');

// URLs en vivo de SYD Colombia conectadas a la base de datos central en tiempo real
const PRIMARY_LIVE_URL = 'https://ais-dev-2plx7bzxumro3jeiuifpc3-795278050657.us-east1.run.app';
const FALLBACK_LIVE_URL = 'https://ais-pre-2plx7bzxumro3jeiuifpc3-795278050657.us-east1.run.app';

let mainWindow = null;
let currentTargetUrl = PRIMARY_LIVE_URL;

function createRecoveryHtml(failedUrl, errorCode, errorDescription) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SYD Colombia - Conectando al Sistema...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top right, #1e293b, #0b1322 80%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65);
    }
    .logo {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-weight: 900;
      font-size: 24px;
      color: #fff;
      letter-spacing: -1px;
      box-shadow: 0 10px 20px -5px rgba(2, 132, 199, 0.5);
    }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #ffffff; }
    p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
      margin-bottom: 20px;
    }
    .btn-group { display: flex; flex-direction: column; gap: 10px; }
    button {
      padding: 12px 20px;
      border-radius: 12px;
      border: none;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
    }
    .btn-primary:hover { background: #0369a1; transform: translateY(-1px); }
    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
    }
    .btn-secondary:hover { background: #334155; color: #ffffff; }
    .url-input {
      margin-top: 16px;
      text-align: left;
    }
    .url-input label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 6px;
    }
    .input-field {
      width: 100%;
      background: #020617;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      color: #e2e8f0;
      outline: none;
    }
    .input-field:focus { border-color: #0284c7; }
    .footer-note { font-size: 11px; color: #475569; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SYD</div>
    <h1>Conectando con SYD Colombia</h1>
    <span class="status-badge">Verificando conexión en la nube</span>
    <p>La aplicación está intentando conectarse con el servidor central de SYD Colombia y la base de datos en tiempo real.</p>
    
    <div class="btn-group">
      <button class="btn-primary" onclick="retryConnection('${PRIMARY_LIVE_URL}')">Reintentar Conexión Principal</button>
      <button class="btn-secondary" onclick="retryConnection('${FALLBACK_LIVE_URL}')">Conectar con Servidor de Respaldo</button>
    </div>

    <div class="url-input">
      <label>O ingresar enlace personalizado:</label>
      <input type="text" id="customUrl" class="input-field" value="${failedUrl || PRIMARY_LIVE_URL}" placeholder="https://...">
      <button class="btn-secondary" style="margin-top: 8px; width: 100%;" onclick="connectCustom()">Conectar a este enlace</button>
    </div>

    <div class="footer-note">
      Presiona <strong>F5</strong> para refrescar en cualquier momento.
    </div>
  </div>

  <script>
    function retryConnection(url) {
      window.location.href = url;
    }
    function connectCustom() {
      const u = document.getElementById('customUrl').value.trim();
      if (u) window.location.href = u;
    }
    // Auto-reintento a los 6 segundos
    setTimeout(() => {
      window.location.href = '${PRIMARY_LIVE_URL}';
    }, 6000);
  </script>
</body>
</html>`;
}

function loadAppUrl(win, targetUrl) {
  currentTargetUrl = targetUrl;
  win.loadURL(targetUrl).catch((err) => {
    console.warn(`No se pudo conectar a ${targetUrl}:`, err.message || err);
    if (targetUrl === PRIMARY_LIVE_URL) {
      // Try fallback URL first
      console.log('Intentando servidor de respaldo...');
      win.loadURL(FALLBACK_LIVE_URL).catch(() => {
        // Show styled recovery page if both fail
        win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(createRecoveryHtml(targetUrl, err.code, err.message)));
      });
    } else {
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(createRecoveryHtml(targetUrl, err.code, err.message)));
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'SYD Colombia - Cotizaciones y Licitaciones (En vivo)',
    backgroundColor: '#0b1322',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Manejar fallos de carga HTTP / Red
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.warn('Fallo de carga en ventana:', errorCode, errorDescription, validatedURL);
    if (validatedURL && !validatedURL.startsWith('data:')) {
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(createRecoveryHtml(validatedURL, errorCode, errorDescription)));
    }
  });

  // Limpia caché de sesión inicial para cargar siempre la versión más fresca
  session.defaultSession.clearCache().then(() => {
    loadAppUrl(mainWindow, PRIMARY_LIVE_URL);
  });

  // Atajos de teclado: F5 para refrescar en vivo, F12 para herramientas de desarrollador
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reloadIgnoringCache();
    }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
