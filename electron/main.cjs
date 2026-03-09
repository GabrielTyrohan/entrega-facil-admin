const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindow;

// Configuração do logger
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Não verifica updates em desenvolvimento
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Entrega Fácil Admin'
  });

  const startURL = isDev
    ? 'http://localhost:5175'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => mainWindow = null);
}

app.whenReady().then(() => {
  createWindow();

  // Só verifica updates em produção
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});

// Evento: update disponível para download
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

// Evento: update baixado — pergunta ao usuário se quer reiniciar
autoUpdater.on('update-downloaded', (info) => {
  log.info(`Versão ${info.version} baixada. Aguardando confirmação do usuário.`);

  if (mainWindow) {
    mainWindow.setProgressBar(-1); // Remove barra de progresso
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

// Evento: erro no updater
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
