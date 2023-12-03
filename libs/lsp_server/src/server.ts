#!/usr/bin/env node

// import * as cp from "child_process";
import * as http from 'http';
import * as fs from 'fs';
import * as path from "path";
import * as parseArgs from 'minimist';
import * as yaml from 'js-yaml';
import * as ws from 'ws';
import * as rpc from '@sourcegraph/vscode-ws-jsonrpc';
import * as rpcServer from '@sourcegraph/vscode-ws-jsonrpc/lib/server';
let argv = parseArgs(process.argv.slice(2));
if (argv.help) {
  console.log(`Usage: server.js [--port 3000] [--config config.yml]`);
  process.exit(1);
}
let serverPort: number = parseInt(argv.port) || 3000;
let configFile: string = argv.config || path.resolve(__dirname, "config.yml");
let languageServers, timeout;
try {
  let parsed = yaml.safeLoad(fs.readFileSync(configFile), 'utf8');
  if (!parsed.langservers) {
    console.log('Your langservers file is not a valid format, see README.md');
    process.exit(1);
  }
  languageServers = parsed.langservers;
  timeout = parsed.timeout || 300;
} catch (e) {
  console.error(e);
  process.exit(1);
}
const wss: ws.Server = new ws.Server({
  port: serverPort,
  perMessageDeflate: false
}, () => {
  console.log(`Listening to http and ws requests on ${serverPort}`);
});

function toSocket(webSocket: ws): rpc.IWebSocket {
  return {
    send: content => webSocket.send(content),
    onMessage: cb => webSocket.onmessage = event => cb(event.data),
    onError: cb => webSocket.onerror = event => {
      if ('message' in event) {
        cb((event as any)
          .message)
      }
    },
    onClose: cb => webSocket.onclose = event => cb(event.code, event.reason),
    dispose: () => webSocket.close()
  }
}
const forwardClient = (client, server) => {
  let socket: rpc.IWebSocket = toSocket(client);
  let connection = rpcServer.createWebSocketConnection(socket);
  rpcServer.forward(connection, server);
  socket.onClose((code, reason) => {
    console.log('Client closed', reason);
    //@ts-ignore
    connection.dispose();
  });
}
//TODO: add process delete
const cachedConnections: Map < String, any > = new Map();
const createReusableConnection = function(conn: rpcServer.IConnection) {
  var callback = (input) => {};
  conn.reader.listen((input) => {
    callback(input);
  });
  //Copied from @sourcegraph/vscode-ws-jsonrpc
  return {
    reader: conn.reader,
    writer: conn.writer,
    forward(to, map = (message) => message) {
      callback = (input => {
        const output = map(input);
        to.writer.write(output);
      });
    },
    onClose: () => {}, //Don't keep references
    dispose: () => {}, //Don't do anything on dispose
    kill: () => {
      // @ts-ignore
      conn.dispose();
    }
  };
}
const launchServer = (server, serverName = server) => {
  let langServer: string[] | undefined;
  Object.keys(languageServers)
    .forEach((key) => {
      if (server === key) {
        langServer = languageServers[key];
      }
    });
  if (!langServer || !langServer.length) return null;
  const process = rpcServer.createServerProcess(serverName, langServer[0], langServer.slice(1));
  return createReusableConnection(process);
  
}
const manageConnection = (client, conn, cacheKey) => {
  var kill = () => {
    conn.kill();
  }
  client.on("close", kill); //Kill if closed before initialize
  if (cacheKey) {
    client.on("message", function init(message) {
      let data;
      try {
        data = JSON.parse(message);
      } catch (e) {
        return;
      }
      //If the client has successfully initialized,
      //store the server process and capabilities
      if (data.method == "lspServer/didInitialize") {
        console.log("Caching process: " + cacheKey);
        cachedConnections.set(cacheKey, {
          connection: conn,
          data: data.params,
        });
        ref(cacheKey, client);
        client.off("close", kill);
        client.off("message", init);
      }
    });
  }
}
const _deref = (key) => {
  return () => {
    const data = cachedConnections.get(key);
    data.refs--;
    if (!data.timeout && data.refs <= 0) {
      data.timeout = setTimeout(() => {
        console.log("Closing process: " + key);
        data.connection.kill();
        cachedConnections.delete(key);
      }, timeout * 1000);
    }
  }
}
const ref = (key, client) => {
  const data = cachedConnections.get(key);
  data.refs = (data.refs || 0) + 1;
  client.on("close", _deref(key));
  if (data.timeout) {
    clearTimeout(data.timeout);
    data.timeout = null;
  }
}
wss.on('connection', (client: ws, request: http.IncomingMessage) => {
  let [, server, cacheKey] = request.url.split("/");
  console.log(`Forwarding new client`);
  let lspConnection: any;
  if (cacheKey && cachedConnections.has(cacheKey)) {
    lspConnection = cachedConnections.get(cacheKey)
      .connection;
    client.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "lspServer/hasInitialized",
      params: cachedConnections.get(cacheKey)
        .data
    }));
    ref(cacheKey, client);
    console.log(`Reusing old process: ${cacheKey}`);
  } else {
    lspConnection = launchServer(server, request.url);
    if (!lspConnection) {
      console.error('Failed to launch server for ', request.url);
      client.close();
      return;
    }
    manageConnection(client, lspConnection, cacheKey);
    client.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "lspServer/hasInitialized",
      params: false
    }));
  }
  forwardClient(client, lspConnection)
});
