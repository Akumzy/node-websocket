const EventEmitter = require('events').EventEmitter
const WebSocket = require('ws')
const HTTPGET = require('http').get
class Socket extends EventEmitter {
    constructor({ port, url }) {
        super();
        this.socket = null;
        this.url = url
        this.port = port;
        this.destroyed = false;
        this.connected = false;
        this._connectOrReconnect();
    }
    connect() {
        const ws = new WebSocket(`${this.url}:${this.port}`);
        ws.on("open", () => {
            this.socket = ws;
            this.emit("connect");
            this.connected = true;
        });
        ws.on("error", err => {
            this.connected = false;
            if (this.destroyed) return;
            this.emit("error", err);
            this._connectOrReconnect();
        });
        ws.on("message", data => {
            let d = JSON.parse(data);
            this.emit(d.type, d.data);
        });
    }
    send(type, data, cb) {
        if (this.destroyed) return;
        data = JSON.stringify({
            type,
            data: JSON.stringify(data)
        });
        if (this.connected) {
            this.socket.send(data, cb);
        } else {
            let inter = setInterval(() => {
                if (this.destroyed) return clearInterval(inter);
                if (this.connected) {
                    this.socket.send(data, cb);
                    clearInterval(inter);
                }
            });
        }
    }
    _connectOrReconnect() {
        const self = this;
        let ready;
        let inter = setInterval(() => {
            if (ready) return clearInterval(inter);
            try {
                let url = this.url
                if (this.url.statesWith('ws:')) url.replace('ws:', 'http:')
                HTTPGET(`${url}:${this.port}`, res => {
                    if (res.statusCode === 200) {
                        ready = true;
                        self.connect();
                        r
                        clearInterval(inter);
                    }
                    res.on("error", err => {
                        console.log(err);
                    });
                });
            } catch (error) {
                console.log(error);
            }
        }, 1000);
    }
    destroy() {
        this.destroyed = true;
        this.eventNames().forEach(e => this.removeAllListeners(e, () => {}))
        if (this.socket) this.socket.close();
    }
}
module.exports = Socket