const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

const isDev = process.env.NODE_ENV === 'development' 
           || process.env.ELECTRON_IS_DEV === 'true'
           || !app.isPackaged;

let mainWindow;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // ✅ Evita flash e foco instável na inicialização
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Entrega Fácil Admin',
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    // ✅ DevTools em janela separada para não conflitar com foco
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    log.info(`[DEV] Carregando: ${devServerUrl}`);
  } else {
    const prodPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(prodPath);
    log.info(`[PROD] Carregando arquivo: ${prodPath}`);
  }

  // ✅ Só exibe a janela quando o conteúdo estiver completamente carregado
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // ✅ Reativa foco do webContents ao focar a janela
  mainWindow.on('focus', () => {
    mainWindow.webContents.focus();
  });

  // ✅ Reativa foco ao restaurar da minimização
  mainWindow.on('restore', () => {
    mainWindow.webContents.focus();
  });

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