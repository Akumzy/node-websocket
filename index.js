const EventEmitter = require("events").EventEmitter;
const WebSocket = require("ws");
const HTTPGET = require("http").get;
const URL = require("url");
class Socket extends EventEmitter {
  constructor(url) {
    super();
    this.socket = null;
    this.url = url;
    this.destroyed = false;
    this.connected = false;
    this.pingTimer = null;
    this._connectOrReconnect();
  }
  connect() {
    const ws = new WebSocket(this.url);
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
      this.emit(d.type, d.data, d.error);
    });

    this.pingTimer = setInterval(() => {
      ws.ping("hello");
    }, 10000);
  }
  send(type, data, cb) {
    if (this.destroyed) return;
    // If the data argument is either object or array
    // turn it into json to avoid `Golang` from converting
    // it into map
    if (typeof data === "object" || Array.isArray(data)) {
      data = JSON.stringify(data);
    }

    data = JSON.stringify({
      type,
      data: data || null
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
  sendAndReceive(type, data, cb) {
    return new Promise((res, rej) => {
      let r = type + "__receive__";
      this.once(r, (d, err) => {
        if (typeof cb === "function") cb(err, d);
        else res(err, d);
      });
      this.send(type, data, err => {
        if (err) {
          if (typeof cb === "function") cb(err);
          else rej(err);
          this.removeListener(r, () => {});
        }
      });
    });
  }
  _connectOrReconnect() {
    const self = this;
    let ready;
    let inter = setInterval(() => {
      if (ready) return clearInterval(inter);

      let url = this.url;
      if (this.url.startsWith("ws://")) {
        let u = URL.parse(url);
        url = `http://${u.hostname}:${u.port}`;
      }
      let d = HTTPGET(url, res => {
        if (res.statusCode === 200) {
          ready = true;
          self.connect();
          clearInterval(inter);
        }
      });
      d.on("error", err => {
        self.emit("error", err);
      });
    }, 1000);
  }
  destroy() {
    this.destroyed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.eventNames().forEach(e => this.removeAllListeners(e, () => {}));
    if (this.socket) this.socket.close();
  }
}
module.exports = Socket;
