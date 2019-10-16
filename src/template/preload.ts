import { ipcRenderer } from 'electron';

declare global {
  interface Window {
    webviewId: string;
    liaison_worker_url?: string;
  }
}

ipcRenderer.on('dom-ready', (event, message: {[key: string]: any}) => {
  for (let key of Object.keys(message)) {
    (<any>window)[key] = message[key];
  }
  if (!(<any>window)[window.webviewId]) {
    (<any>window)[window.webviewId] = {};
  }

  (<any>window)[window.webviewId].uuid = require('uuid/v1');

  if (window.liaison_worker_url) {
    // injection script within liaison-worker handles
    // injecting any additional JS scripts and setting up
    // the listeners, etc. so that we never have to touch this
    // script again.
    let script = document.createElement('script');
    script.src = `${window.liaison_worker_url}/js/injection.js?time=${Date.now()}`;
    script.onerror = (error) => {
      console.error(`The requested script ${script.src} failed to load: ${error}`);
    };
    document.body.appendChild(script);
  }
});
