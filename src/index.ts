import cislio from '@cisl/io';
import '@cisl/io/io';
import logger from '@cisl/logger';
import { app, ipcMain, Parameters, screen as electronScreen, WebContents, webContents } from 'electron';
import { DisplayWorker, DisplayConfig } from './display-worker';
import { CoguiWorker } from './cogui-worker';

interface ViewObjectEventArg {
  displayContextName?: string;
  type?: string;
  details: {
    viewId?: string;
  };
}

declare module '@cisl/io/io' {
  interface Config {
    display: DisplayConfig;
  }
}

const io = cislio();

if (!io.rabbit) {
  throw new Error('RabbitMQ not loaded');
}

io.config.defaults({
  display: {
    displayName: 'main'
  },
});

process.title = 'display-worker';

logger.info('Loading configuration from cog.json');

// check if displayName is defined
try {
  logger.info(`Display Worker Name : ${io.config.get('display:displayName')}`);
}
catch (e) {
  logger.error('Unable to start Display Worker. Please specify displayName under display settings in the configuration file.');
  process.exit();
}

app.commandLine.appendSwitch('disable-http-cache');

app.setName('CELIO Display Worker');

app.on('ready', () => {
  new DisplayWorker(electronScreen);
  if (io.config.has('ephd:ephdUILocalURL')) {
    new CoguiWorker(io);
  }
});

app.on('quit', () => {
  logger.info('closing display worker');
  io.rabbit!.publishTopic('display.removed', {
    name: io.config.get('display:displayName')
  });
});

app.on('window-all-closed', () => {
  // This dummy handler is required to keep display-worker running after closing all browserwindow
});

// Listen and publish view object events
ipcMain.on('view-object-event', (_, arg: ViewObjectEventArg) => {
  if (arg.displayContextName && arg.type) {
    io.rabbit!.publishTopic(`display.${arg.displayContextName}.${arg.type}.${arg.details.viewId}`, arg);
  }
});

ipcMain.on('show-bubble-view', (event, argString) => {
  const arg = JSON.parse(argString);
  if (arg.displayContext) {
    io.rabbit.publishTopic(`mmui.show-bubble-view`, argString);
    io.rabbit.publishTopic(`cogui.show-full-view`, argString);
  }
});

ipcMain.on('show-full-view', (event, argString) => {
  const arg = JSON.parse(argString);
  if (arg.displayContext) {
    io.rabbit.publishTopic(`mmui.show-full-view`, argString);
    io.rabbit.publishTopic(`cogui.show-bubble-view`, argString);
  }
});

const getWebContents = (webContentId: number): WebContents => {
  const guest = webContents.fromId(webContentId);
  if (!guest) {
    throw new Error(`Could not find webContents for ${webContentId}`);
  }
  return guest;
};

ipcMain.handle('enableDeviceEmulation', (event, webContentsId: number, options: Parameters) => {
  const guest = getWebContents(webContentsId);
  guest.enableDeviceEmulation(options);
});

ipcMain.handle('disableDeviceEmulation', (_, webContentsId: number) => {
  const guest = getWebContents(webContentsId);
  guest.disableDeviceEmulation();
});
