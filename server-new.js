require("dotenv").config({ path: "env.txt" });

const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const https = require("https");
const cors = require("cors");
const uuid = require("uuid");
const express = require("express");
const session = require("express-session")({
  secret: "convai-u101",
  resave: true,
  saveUninitialized: true,
  genid: function (req) {
    return uuid.v4();
  },
});
const { ExpressPeerServer } = require("peer");
const sharedsession = require("express-socket.io-session");

const ASRPipe = require("./modules/asr");

const app = express();
const port = process.env.PORT;
var server;
var sslkey = "./certificates/privkey.pem";
var sslcert = "./certificates/cert.pem";

/**
 * Set up Express Server with CORS and SocketIO
 */
function setupServer() {
  // set up Express
  app.use(cors());
  // app.use(express.static("web")); // ./web is the public dir for js, css, etc.
  // app.use(session);
  // app.get("/", function (req, res) {
  //   res.sendFile("./web/index.html", { root: __dirname });
  // });
  server = https.createServer(
    {
      key: fs.readFileSync(sslkey),
      cert: fs.readFileSync(sslcert),
    },
    app
  );

  io = socketIo(server);
  io.use(sharedsession(session, { autoSave: true }));
  server.listen(port, () => {
    console.log("Running server on port %s", port);
  });

  // Listener, once the client connects to the server socket
  io.on("connect", (socket) => {
    console.log("Client connected from %s", socket.handshake.address);

    // Initialize convai
    console.log("Initializing convai ASR");
    socket.handshake.session.asr = new ASRPipe();
    socket.handshake.session.asr.setupASR();
    socket.handshake.session.asr.mainASR(function (result) {
      // var nlpResult;
      if (result.transcript == undefined) {
        return;
      }
      // Log the transcript to console, overwriting non-final results
      process.stdout.write("".padEnd(process.stdout.columns, " ") + "\r");
      if (!result.is_final) {
        process.stdout.write("TRANSCRIPT: " + result.transcript + "\r");
      } else {
        process.stdout.write("TRANSCRIPT: " + result.transcript + "\n");
      }
      socket.handshake.session.lastLineLength = result.transcript.length;

      socket.emit("transcript", result);
    });

    // incoming audio
    socket.on("audio_in", (data) => {
      socket.handshake.session.asr.recognizeStream.write({
        audio_content: data,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "Client at %s disconnected. Reason: ",
        socket.handshake.address,
        reason
      );
    });
  });
}

setupServer();
