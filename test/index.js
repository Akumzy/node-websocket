const Websocket = require('..')
const ws = new Websocket('http://localhost:30188')
ws.connect()
ws.on('error', (err) => {
    console.log(err);
})