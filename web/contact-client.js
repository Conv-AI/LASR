const id = Math.floor(Math.random() * 10000)
  .toString()
  .padStart(4, "0");
const socketio = io();
const resampleWorker = "./resampler.js";

var peer;
var peer_id;
var username = "User " + id.toString();
var peer_username;
var peerConn;
var peerCall;
var localStream;
var peerStream;
var audioContext;
var sampleRate;
var tempString;
var count;
var convaiRunning = false;
var callActive = false;
var muted = false;
var videoEnabled = true;
var socket = socketio.on("connect", function () {
  console.log("Socket connected to speech server");
});
var startTime = null;
var endTime = null;
var newStop = 0;
var lastStop = 0;
var scrollToBottomTime = 500;
var displacy;
var ents;
var latencyTimer;
// var reconnectAttempts = 0;
// var reconnectTimerId;

// ---------------------------------------------------------------------------------------
// Latency tracking
// ---------------------------------------------------------------------------------------
class LatencyTimer {
  constructor() {
    this.startTimes = new Array();
    this.latencies = new Array();
  }

  start(data = null) {
    return this.startTimes.push({ start: performance.now(), data: data }) - 1;
  }

  end(index) {
    if (index >= this.startTimes.length) {
      return 0;
    }
    var latency = Math.round(performance.now() - this.startTimes[index].start);
    this.latencies.push(latency);
    return { latency: latency, data: this.startTimes[index].data };
  }

  average() {
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length || 0);
  }
}

// function setPeerUsername(peerName) {
//     peer_username = peerName;
//     document.getElementById("peer_cam_label").innerHTML = peer_username;
// }

// ---------------------------------------------------------------------------------------
// Start convai, whether triggered locally or by a message from peer
// ---------------------------------------------------------------------------------------
function startconvaiService() {
  if (convaiRunning) {
    return;
  }
  latencyTimer = new LatencyTimer();

  if (socket == null) {
    socket = socketio.on("connect", function () {
      console.log("Connected to speech server");
    });
  } else {
    socket.disconnect();
    socket.connect();
    console.log("Reconnected to speech server");
  }

  // Start ASR streaming
  let audioInput = audio_context.createMediaStreamSource(localStream);
  let bufferSize = 4096;
  let recorder = audio_context.createScriptProcessor(bufferSize, 1, 1);
  let worker = new Worker(resampleWorker);
  worker.postMessage({
    command: "init",
    config: {
      sampleRate: sampleRate,
      outputSampleRate: 16000,
    },
  });

  // Use a worker thread to resample the audio, then send to server
  recorder.onaudioprocess = function (audioProcessingEvent) {
    let inputBuffer = audioProcessingEvent.inputBuffer;
    worker.postMessage({
      command: "convert",
      // We only need the first channel
      buffer: inputBuffer.getChannelData(0),
    });
    worker.onmessage = function (msg) {
      if (msg.data.command == "newBuffer") {
        // console.log("Data: ", msg.data.resampled.buffer)
        if (convaiRunning) {
          socket.emit("audio_in", msg.data.resampled.buffer);
        }
      }
    };
  };

  // connect stream to our recorder
  audioInput.connect(recorder);
  // connect our recorder to the previous destination
  recorder.connect(audio_context.destination);
  convaiRunning = true;
  tempString = "";
  count = 1;
  console.log("Streaming audio to server");

  // Transcription results streaming back from convai
  socket.on("transcript", function (result) {
    if (result.transcript == undefined) {
      return;
    }
    document.getElementById("input_field").value =
      tempString + result.transcript;
    if (result.is_final) {
      if ((tempString + result.transcript).length >= 100) {
        endTime = new Date();
        newStop = endTime - startTime;
        console.log("Start Time: ", startTime);
        console.log("End Time: ", endTime);
        console.log("New Stop: ", newStop);
        document.getElementById("transcription_area").value +=
          "\n" + count + "\n";
        document.getElementById("transcription_area").value +=
          msToTime(lastStop) + " --> " + msToTime(newStop) + "\n";
        document.getElementById("transcription_area").value +=
          tempString + result.transcript + "\n";
        document.getElementById("input_field").value = "";
        count++;
        lastStop = newStop;
        tempString = "";
      }
      tempString = document.getElementById("input_field").value;
    }
  });

  toastr.success("convai is connected.");
}

/**
 * Starts the request of the camera and microphone
 *
 * @param {Object} callbacks
 */
function requestLocalAudio(callbacks) {
  // Monkeypatch for crossbrowser getUserMedia
  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;

  // Request audio and video
  // Try getting video, if it fails then go for audio only
  navigator.getUserMedia(
    { audio: true, video: false },
    callbacks.success,
    callbacks.error
  );
}

/**
 * Attach the provided stream (video and audio) to the desired video element
 *
 * @param {*} stream
 * @param {*} element_id
 */
function onReceiveStream(stream, element_id) {
  // Retrieve the video element
  var video = document.getElementById(element_id);
  // Set the given stream as the video source
  video.srcObject = stream;
}

function clearStream(element_id) {
  var video = document.getElementById(element_id);
  video.pause();
  video.srcObject = new MediaStream(); // replace the video element with an empty stream
  video.load();
}

/**
 * Receive messages from the peer
 *
 * @param {Object} data
 */
function handleMessage(data) {
  console.log("Message: " + data);

  switch (data.type) {
    case "startconvai":
      startconvaiService();
      break;
    case "transcript":
      if (data.from != peer_username) {
        setPeerUsername(data.from);
      }
      showAnnotatedTranscript(data.from, data.annotations, data.text);
      break;
    case "username":
      setPeerUsername(data.from);
      break;
    default:
      console.log("Received unknown message from peer, of type " + data.type);
  }
}

// ---------------------------------------------------------------------------------------
// When the document is ready
// ---------------------------------------------------------------------------------------
$(document).ready(function () {
  /**
   * Request browser audio and video, and show the local stream
   */
  requestLocalAudio({
    success: function (stream) {
      localStream = stream;
      audio_context = new AudioContext();
      sampleRate = audio_context.sampleRate;
      console.log("Sample rate of local audio: " + sampleRate);

      onReceiveStream(stream, "my-camera");
    },
    error: function (err) {
      bootbox.alert("Cannot get access to your camera and microphone.");
      console.error(err);
    },
  });

  // // Allow us to launch convai with only the local speaker
  // document.getElementById('convai-btn').removeAttribute("disabled");
});

function msToTime(s) {
  var ms = s % 1000;
  s = (s - ms) / 1000;
  var secs = s % 60;
  s = (s - secs) / 60;
  var mins = s % 60;
  var hrs = (s - mins) / 60;

  return hrs + ":" + mins + ":" + secs + "." + ms;
}

function startASR() {
  startTime = new Date();
  startconvaiService();
  document.getElementById("convai-pause").disabled = false;
}

function pauseASR() {
  convaiRunning = !convaiRunning;
}

function resetData() {
  document.getElementById("transcription_area").value = "";
  document.getElementById("input_field").value = "";
  location.reload();
}

function getData() {
  let data = document.getElementById("transcription_area").value;
  const textToBLOB = new Blob([data], { type: "text/plain" });
  const sFileName = "transcript.srt";

  let newLink = document.createElement("a");
  newLink.download = sFileName;

  if (window.webkitURL != null) {
    newLink.href = window.webkitURL.createObjectURL(textToBLOB);
  } else {
    newLink.href = window.URL.createObjectURL(textToBLOB);
    newLink.style.display = "none";
    document.body.appendChild(newLink);
  }

  newLink.click();
}

function setAudioEnabled(enabled) {
  if (!localStream) return;
  for (const track of localStream.getAudioTracks()) {
    track.enabled = enabled;
  }
}
