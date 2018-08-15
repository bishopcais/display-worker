const { ipcRenderer } = require('electron');

ipcRenderer.on('start_injection', (event, message) => {
    for (let key of Object.keys(message)) {
        window[key] = message[key];
    }

    // injection script within liaison-worker handles
    // injecting any additional JS scripts and setting up
    // the listeners, etc. so that we never have to touch this
    // script again.
    let script = document.createElement('script');
    script.src = `${window.liaison_worker_url}/js/injection.js`;
    document.body.appendChild(script);
});