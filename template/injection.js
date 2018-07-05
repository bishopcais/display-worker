let webview_id;
document.addEventListener('DOMContentLoaded', (event) => {
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.1.1/socket.io.slim.js';
    document.appendChild(socket);

    script = document.createElement('script');
    if (document.getElementsByTagName('table').length > 0) {
        script.src = 'http://localhost:####/table.js';
    }
    document.body.appendChild(script);
});
