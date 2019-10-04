const io = require('@cisl/io');
const logger = require('@cisl/logger');
const electron = require('electron');

const DisplayWorker = require('./src/display-worker');

const {app, ipcMain} = electron;

process.Title = 'display-worker';


logger.info('Loading configuration from cog.json');
// check if displayName is defined
try {
  logger.info(`Display Worker Name : ${io.config.display.displayName}`);
}
catch (e) {
  logger.error('Unable to start Display Worker. Please specify displayName under display settings in the configuration file.');
  process.exit();
}

app.commandLine.appendSwitch('disable-http-cache');

app.setName('CELIO Display Worker');

app.on('ready', () => {
  new DisplayWorker(electron.screen);
});

app.on('quit', () => {
  logger.info('closing display worker');
});

app.on('exit', () => {
  logger.info('exiting display worker');
  io.rabbit.publishTopic('display.removed', {
    name: io.config.display.displayName
  });
});

app.on('window-all-closed', () => {
  // This dummy handler is required to keep display-worker running after closing all browserwindow
});

// Listen and publish view object events
ipcMain.on('view-object-event', (event, arg) => {
  if (arg.displayContext && arg.type) {
    io.rabbit.publishTopic('display.' + arg.displayContext + '.' + arg.type + '.' + arg.details.view_id, arg);
  }
});
