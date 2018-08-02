const { ipcRenderer } = require('electron');

ipcRenderer.on('webview_id', (event, message) => {
    window.webview_id = message;
    console.log("Setting window.webview_id = " + global.webview_id);
});

document.addEventListener('DOMContentLoaded', (event) => {
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.1.1/socket.io.slim.js';
    script.onload = script.onreadystatechange = () => {
        let script = document.createElement('script');
        if (document.body.getElementsByTagName('table').length > 0) {
            script.src = 'http://localhost:7600/js/table.js?time=' + Date.now();
        }
        document.body.appendChild(script);
    }
    document.body.appendChild(script);
});
