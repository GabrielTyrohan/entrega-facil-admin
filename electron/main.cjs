const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ✅ Detecção mais robusta de ambiente de desenvolvimento
const isDev = process.env.NODE_ENV === 'development' 
           || process.env.ELECTRON_IS_DEV === 'true'
           || !app.isPackaged; // fallback garantido: false só em build final

let mainWindow;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Entrega Fácil Admin',
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();

    // ✅ Log para confirmar que entrou em modo dev
    log.info(`[DEV] Carregando: ${devServerUrl}`);
  } else {
    // ✅ Caminho correto para o build de produção
    const prodPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(prodPath);
    log.info(`[PROD] Carregando arquivo: ${prodPath}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  console.log('isDev:', isDev);
  console.log('isPackaged:', app.isPackaged);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  createWindow();
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});

autoUpdater.on('checking-for-update', () => {
  log.info('Verificando atualizações...');
});

autoUpdater.on('update-available', (info) => {
  log.info(`Nova versão disponível: ${info.version}`);
});

autoUpdater.on('update-not-available', () => {
  log.info('Aplicativo já está na versão mais recente.');
});

autoUpdater.on('download-progress', (progress) => {
  log.info(`Download: ${Math.round(progress.percent)}%`);
  if (mainWindow) {
    mainWindow.setProgressBar(progress.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info(`Versão ${info.version} baixada. Aguardando confirmação do usuário.`);

  if (mainWindow) {
    mainWindow.setProgressBar(-1);
  }

  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização disponível',
    message: `Versão ${info.version} pronta para instalar`,
    detail: 'O Entrega Fácil Admin será reiniciado para aplicar a atualização.',
    buttons: ['Reiniciar agora', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    icon: path.join(__dirname, '../public/icon.png')
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

autoUpdater.on('error', (err) => {
  log.error(`Erro no auto-updater: ${err.message}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
