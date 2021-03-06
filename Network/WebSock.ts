import { Uint32toBinary } from "./Packet";
import bb from "../bb";
import Network from "../Service/Network";
import { isWXGame, isTTGame } from "../Utils";

const isWechat = isWXGame() || isTTGame();

export enum WsPackType {
  JSON,
  PROTOBUF,
}

export interface ProtobufConf {
  idToProto: any;
  idToName: any;
  nameToId: any;
}

export interface WebSockConf {
  url: string;
  packType: WsPackType;
  protobufConf?: ProtobufConf;
  pingName?: string; // 心跳请求
  pingInter?: number; // 心跳间隔s
}

export class WebSock {
  private sock: any // Websock or wx SocketTask;
  private packType: WsPackType;
  private url: string;
  private session: number = 0;
  private callbacks: any;
  private idToProto: any;
  private idToName: any;
  private nameToId: any;

  constructor(conf: WebSockConf) {
    this.url = conf.url;
    this.packType = conf.packType || WsPackType.JSON;
    if (conf.protobufConf) {
      this.idToProto = conf.protobufConf.idToProto;
      this.idToName = conf.protobufConf.idToName;
      this.nameToId = conf.protobufConf.nameToId;
      console.log(conf.protobufConf);
    }
  }

  open() {
    console.log("open ws", this.url, WebSocket.CONNECTING, WebSocket.OPEN);
    if (isWechat) {
      this.sock = wx.connectSocket({
        url: this.url,
      });
      this.sock.onOpen(() => {
        console.log("on socket open");
      });
      this.sock.onMessage(res => {
        console.log("onMessage", res);
        this.onMessage(res);
      });
    } else {
      this.sock = new WebSocket(this.url);
      this.sock.onmessage = this.onMessage.bind(this);
    }
    this.callbacks = {};
  }

  close() {
    this.sock.close();
    this.callbacks = {};
  }

  onResponse(res: any) {
    const func = this.callbacks[res.session];
    if (func) {
      func(res.data);
    }
  }

  private processBuffer(buff: ArrayBuffer | any) {
    let idx = 0;
    let dv = new DataView(buff);
    const session = dv.getUint32(idx);
    idx += 4;
    const protoId = dv.getUint32(idx);
    idx += 4;
    const protoBuff = new Uint8Array(buff.slice(idx + 4));
    const proto = this.idToProto[protoId];
    const data = proto.decode(protoBuff);
    const name = this.idToName[protoId];
    const res = {
      session,
      name,
      data,
    }
    bb.dispatch(Network.EventType.WS_RECV, res);
    Network.dispatch(res.name, res.data);
    this.onResponse(res);
  }

  onMessage(event: any) {
    if (this.packType == WsPackType.JSON) {
      const res = JSON.parse(event.data);
      this.onResponse(res);
      bb.dispatch(Network.EventType.WS_RECV, res);
      Network.dispatch(res.name, res.data);
    } else if (this.packType == WsPackType.PROTOBUF) {
      if (isWXGame() || isTTGame()) {
        this.processBuffer(event.data);
        return;
      }
      let reader = new FileReader();
      reader.onload = (obj) => {
        this.processBuffer(obj.target.result)
      }
      reader.readAsArrayBuffer(event.data);
    }
  }

  async waitWsConnecting(timeout: number) {
    return new Promise<any>((resolve) => {
      var t = 0;
      let interval = 100;
      const wait = () => {
        t += interval;
        if (t > timeout || !this.isConnecting()) {
          resolve(this.sock.readyState);
        } else {
          setTimeout(wait, interval)
        }
      }
      wait();
    });
  }

  isOpen() {
    return this.sock && this.sock.readyState == WebSocket.OPEN
  }

  isConnecting() {
    return this.sock && this.sock.readyState == WebSocket.CONNECTING
  }

  async call<T>(name: string, data?: T, defaultRes?: any) {
    if (!this.sock) {
      try {
        this.open();
      } catch (error) {
        console.error("ws open error", error);
      }
    }
    if (this.isConnecting()) {
      console.log("connecting");
      console.log("wait result", await this.waitWsConnecting(5000));
    }
    if (!this.isOpen()) {
      return defaultRes;
    }

    return new Promise<any>((resolve, reject) => {
      this.session++;
      const session = this.session;

      if (this.packType == WsPackType.JSON) {
        if (isWechat) {
          this.sock.send({ data: JSON.stringify({ name, session, data }) });
        } else {
          this.sock.send(JSON.stringify({ name, session, data }));
        }
      } else if (this.packType == WsPackType.PROTOBUF) {
        const protoId = this.nameToId[name];
        if (!protoId) {
          return reject("proto is undefined!");
        }
        const proto = this.idToProto[protoId];
        const protoBuff = proto.encode(data || {}).finish();
        const u8Array = new Uint8Array(protoBuff.length + 12);
        var idx = 0;
        u8Array.set(Uint32toBinary(session), 0);
        idx += 4;
        u8Array.set(Uint32toBinary(protoId), idx);
        idx += 4;
        u8Array.set(Uint32toBinary(protoBuff.length), idx);
        idx += 4;
        u8Array.set(protoBuff, idx);
        if (isWechat) {
          this.sock.send({ data: u8Array.buffer });
        } else {
          this.sock.send(u8Array);
        }
      }

      this.callbacks[session] = (res) => {
        resolve(res);
      }
    });
  }

  send(name: string, data?: any) {
    if (!this.sock) {
      try {
        this.open();
      } catch (error) {
        console.error("ws open error", error);
      }
    }
    if (this.isConnecting()) {
      console.log("connecting");
      return;
    }
    if (!this.isOpen()) {
      return;
    }
    this.session++;
    const session = this.session;

    if (this.packType == WsPackType.JSON) {
      if (isWechat) {
        this.sock.send({ data: JSON.stringify({ name, session, data }) });
      } else {
        this.sock.send(JSON.stringify({ name, session, data }));
      }
    } else if (this.packType == WsPackType.PROTOBUF) {

      const protoId = this.nameToId[name];
      if (!protoId) {
        console.error("proto is undefined!");
        return;
      }
      const proto = this.idToProto[protoId];
      const protoBuff = proto.encode(data || {}).finish();
      const u8Array = new Uint8Array(protoBuff.length + 12);
      var idx = 0;
      u8Array.set(Uint32toBinary(session), 0);
      idx += 4;
      u8Array.set(Uint32toBinary(protoId), idx);
      idx += 4;
      u8Array.set(Uint32toBinary(protoBuff.length), idx);
      idx += 4;
      u8Array.set(protoBuff, idx);
      if (isWechat) {
        console.log("wx ws send", u8Array.buffer);
        this.sock.send({ data: u8Array.buffer });
      } else {
        this.sock.send(u8Array);
      }

    }
  }
}
