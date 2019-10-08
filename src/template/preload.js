const { ipcRenderer } = require('electron');

ipcRenderer.on('dom-ready', (event, message) => {
  for (let key of Object.keys(message)) {
    window[key] = message[key];
  }
  if (!window[window.webviewId]) {
    window[window.webviewId] = {};
  }

  window[window.webviewId].uuid = require('uuid/v1');

  if (window.liaison_worker_url) {
    // injection script within liaison-worker handles
    // injecting any additional JS scripts and setting up
    // the listeners, etc. so that we never have to touch this
    // script again.
    let script = document.createElement('script');
    script.src = `${window.liaison_worker_url}/js/injection.js?time=${Date.now()}`;
    script.onerror = (error) => {
      console.error(`The requested script ${error.target.src} failed to load...`);
    };
    document.body.appendChild(script);
  }
});
