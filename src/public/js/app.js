const socket=io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const audiosSelect = document.getElementById("audios");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      const audios = devices.filter((device) => device.kind === "audioinput");

      cameras.forEach((camera) => {
        const option = document.createElement("option");
        option.value = camera.deviceId;
        option.innerText = camera.label;
        camerasSelect.appendChild(option);
      });

      audios.forEach((audio) => {
        const option = document.createElement("option");
        option.value = audio.deviceId;
        option.innerText = audio.label;
        audiosSelect.appendChild(option);
      });
    } catch (e) {
      console.log(e);
    }
}

async function getMedia(Constrains) {
    const initConstrains={ audio: true, video: { facingMode: "user"}};
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            Constrains ? Constrains : initConstrains
        );
        myFace.srcObject = myStream;
        if(!Constrains){
            await getDevices();
        }
    }catch (e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks()
    .forEach((track)=>(track.enabled=!track.enabled));
    if (!muted) {
      muteBtn.innerText = "Unmute";
      muted = true;
    } else {
      muteBtn.innerText = "Mute";
      muted = false;
    }
}

function handleCameraClick() {
    myStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
      cameraBtn.innerText = "Turn Camera Off";
      cameraOff = false;
    } else {
      cameraBtn.innerText = "Turn Camera On";
      cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia({
        audio: true,
        video: {
            deviceId: camerasSelect.value,
        }
    });
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}
async function handleAudioChange(){
    await getMedia({
        audio: {
            deviceId: audiosSelect.value,
        },
        video: { 
            facingMode: "user"
        }
    });
    if(myPeerConnection){
        const audioTrack = myStream.getAudioTracks()[0];
        const audioSender = myPeerConnection.getSenders()
            .find((sender) => sender.track.kind === "audio");
            audioSender.replaceTrack(audioTrack);
    }
}
 
muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
audiosSelect.addEventListener("input", handleAudioChange);

// Welcome From(choose a room)
const welcome  = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.hidden=true;
    call.hidden=false;
    await getMedia();
    makeConnection();
}
async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);

});

socket.on("offer", async(offer) => {
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", (answer) => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
});
  
// RTC Code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
              "stun:stun2.l.google.com:19302",
              "stun:stun3.l.google.com:19302",
              "stun:stun4.l.google.com:19302",
            ],
          },
        ],
    });
    myPeerConnection.addEventListener("icecandidate",handleIce);
    myPeerConnection.addEventListener("addstream",handleAddStream);
    myStream.getTracks().forEach((track) => 
        myPeerConnection.addTrack(track, myStream)
    );
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}