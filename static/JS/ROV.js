let page_now;
let mainCameraId = "1";
let initialMainCameraId = "1";

addEventListener("resize", (event) => {
    let h = window.innerHeight;
    let w = window.innerWidth;
    let body = document.getElementsByTagName('body')[0];
    body.style.width = `${w}px`; 
    body.style.height = `${h}px`;
});


// [CAMERA MANAGEMENT]

let camerasInitialized = false; 

let cameraStates = {}; // { [streamId]: { status: 1, enabled: 1 } }

function updateCameraStatesFromJanus(streamList) {
    streamList.forEach(stream => {
        if (!cameraStates[stream.id]) {
            cameraStates[stream.id] = { status: 1, enabled: 1 };
        }
    });
}


function switching(id) {
    let camera_number = `${id.match(/\d+/)[0]}`;
    const camera_p = document.querySelector(".camera_p");

    // if main camera clicked switch the main camera with initial main camera
    if (mainCameraId === camera_number) {
        let camera_s = document.querySelectorAll(`.camera_s`);
        let target, deploy;
        camera_s.forEach((el) => {
            if (el.firstElementChild.id == `c${initialMainCameraId}`) {
                target = el.firstElementChild;
                deploy = el;
            }
        });
        if (target && deploy) {
            camera_p.append(target);
            deploy.append(camera_p.firstElementChild);
            // Update cameraStates
            Object.keys(cameraStates).forEach(cid => {
                cameraStates[cid].status = (cid === initialMainCameraId) ? 0 : 1;
            }
            );
            mainCameraId = initialMainCameraId;
               return;
        }
    }

    if (mainCameraId !== camera_number) {
        let camera_s = document.querySelectorAll(`.camera_s`);
        let target, deploy;
        camera_s.forEach((el) => {
            if (el.firstElementChild.id == `c${camera_number}`) {
                target = el.firstElementChild;
                deploy = el;
            }
        });
        if (target && deploy) {
            camera_p.append(target);
            deploy.append(camera_p.firstElementChild);
            // Update cameraStates
            Object.keys(cameraStates).forEach(cid => {
                cameraStates[cid].status = (cid === camera_number) ? 0 : 1;
            });
            mainCameraId = camera_number;
        }
    }
    // If the clicked camera is already the real main camera, do nothing or add logic as needed
}


async function onoff(id) {
    let camera_number = `${id.match(/\d+/)[0]}`;
    let wh = document.querySelectorAll(`#c${camera_number}`)[0];
    if (!cameraStates[camera_number]) return;
    cameraStates[camera_number].enabled = !cameraStates[camera_number].enabled;
    if (cameraStates[camera_number].enabled) wh.className = wh.className.replace(" hide", "");
    else wh.className += " hide";
}



// [LOADER INSTRUMENTS]
let attitude;
let compass;


const options_instruments = {
    size: 200, 
    roll: 0,  
    pitch: 0, 
    turn: 0,  
    heading: 0, 
    verticalSpeed: 0, 
    airspeed: 0,
    altitude: 0, 
    pressure: 1000,
    hideBox: true,
    imagesDirectory: "/static/SVG",
};

function PIDhandler(pidElement, status) {
    switch (status) {

        case false:
        case "OFF":
            pidElement.classList.remove("on");
            pidElement.classList.remove("ready");
            break;
        case true:
        case "OK":
            pidElement.classList.add("on");
            break;  
        case "READY":
            pidElement.classList.add("ready");
            pidElement.classList.remove("on");
            break;
        case "ACTIVE":
            pidElement.classList.add("on");
            pidElement.classList.remove("ready");
            break;
    }
}

function updateStatusesROV(obj) {
    const statuses = document.getElementsByClassName("status STATUSES");

    Array.from(statuses).forEach((sts) => {


        if (sts.id === "ARMED" && obj["ARMED"]) {
          PIDhandler(sts, obj["ARMED"])
        };

        if (sts.id === "WORK" && obj["WORK"]) {
            PIDhandler(sts, obj["WORK"]);
        }
        if (sts.id === "DEPTH" && obj["CONTROLLER_STATE"]) {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["DEPTH"]);
        }
        if (sts.id === "ROLL" && obj["CONTROLLER_STATE"]) {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["ROLL"]);
        }
        if (sts.id === "PITCH" && obj["CONTROLLER_STATE"]) {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["PITCH"]);
        }

        // Handle JOYSTICK state

        if (sts.id === "JOYSTICK" && obj["JOYSTICK"]) {
            PIDhandler(sts, obj["JOYSTICK"]);
        }
    });
}

function updateIMU(imuJSON) {
    // console.log("[DEBUG] updateIMU called with:", imuJSON);

    if (imuJSON && typeof imuJSON === "object") {
        // console.log(`[DEBUG] PITCH: ${imuJSON["PITCH"]}, ROLL: ${imuJSON["ROLL"]}, YAW: ${imuJSON["YAW"]}`);
    } else {
        // console.warn("[DEBUG] Invalid IMU data received:", imuJSON);
    }

    attitude.updatePitch(imuJSON["PITCH"]);
    attitude.updateRoll(imuJSON["ROLL"]);
    compass.updateHeading(imuJSON["YAW"]);
}

function updateSensors(sensorsJSON) {
    const depth = document.querySelector("#data_depth");
    const referenceZ = document.querySelector("#data_reference_z");
    // Need to update HTML:
    /*const forceZ = document.querySelector("#data_force_z");
    const forceRoll = document.querySelector("#data_force_roll");
    const forcePitch = document.querySelector("#data_force_pitch");
    const referenceRoll = document.querySelector("#data_reference_roll");
    const referencePitch = document.querySelector("#data_reference_pitch");*/

    depth.innerHTML = `${parseFloat(sensorsJSON["depth"]).toFixed(2)} m`;
    referenceZ.innerHTML = `${parseFloat(sensorsJSON["reference_z"]).toFixed(2)} m`;

    // Need to update HTML:
    /*forceZ.innerHTML = `${parseFloat(sensorsJSON["force_z"]).toFixed(2)} N`;
    forceRoll.innerHTML = `${parseFloat(sensorsJSON["force_roll"]).toFixed(2)} Nm`;
    forcePitch.innerHTML = `${parseFloat(sensorsJSON["force_pitch"]).toFixed(2)} Nm`;
    referenceRoll.innerHTML = `${parseFloat(sensorsJSON["reference_roll"]).toFixed(2)} °`;
    referencePitch.innerHTML = `${parseFloat(sensorsJSON["reference_pitch"]).toFixed(2)} °`;*/
}



// --- START CAMERA HANDLER

let first = true;
let activeStreams = {};

function createStreamElement(streamInfo) {
    const streamId = streamInfo.id;
    if (!cameraStates[streamId]) {
        cameraStates[streamId] = { status: 1, enabled: 1 };
    }
    const container = document.createElement('div');
    container.className = first ? 'camera_p' : `camera_s`;

    let metadata = {'fisheye': false};
    try {
        metadata = JSON.parse(streamInfo.metadata);
    } catch (e) {
        console.error("Failed to parse metadata:", e);
    }

    container.innerHTML = `
        <div class="screen" id="c${streamInfo.id}" onclick="switching('camera_${streamInfo.id}')">
            <div class="camera_title">Stream ${streamId}: ${streamInfo.description || 'No description'}</div>
            <video id="video_${streamId}" playsinline autoplay muted ></video>
            ${metadata.fisheye ? `<canvas class="distorted" id="canvas_${streamId}"></canvas>` : "<span><span/>"}
        </div>
    `;

    console.log(metadata);
    // This ensures the innerHTML is actually applied and DOM elements exist before distortionHandler runs. Javascript...
    setTimeout(() => metadata.fisheye && distortionHandler(`video_${streamId}`, `canvas_${streamId}`, `canvas_raw_${streamId}`, metadata.fisheyeSettings), 0);

    if (first) document.querySelector('.camera_column').insertBefore(container, document.querySelector('.camera_column').firstChild);
    else document.querySelector('.camera_row').appendChild(container);
    
    if (first) first = false;
    return container;
}

function watchStream(streamId) {
    janus.attach({
    plugin: "janus.plugin.streaming",
    success: function(pluginHandle) {
      activeStreams[streamId] = {
        handle: pluginHandle,
        watching: true
      };

      pluginHandle.send({
        message: { request: "watch", id: streamId }
      });
    },
    error: function(error) {
      console.error(`Error start stream ID ${streamId}:`, error);
    },
    onmessage: function(msg, jsep) {
      if (jsep) {
        activeStreams[streamId].handle.createAnswer({
          jsep: jsep,
          media: {
            audioSend: false,
            videoSend: false,
            audioRecv: msg.type === 'rtp' ? true : false,
            videoRecv: true
          },
          success: function(jsep) {
            const body = { request: "start" };
            activeStreams[streamId].handle.send({ message: body, jsep: jsep });
          },
          error: function(error) {
            console.error("Errore creazione answer:", error);
          }
        });
      }
    },
    onremotetrack: function(track, mid, flow) {
      console.log(`Stream for ID ${streamId}`);
      handleRemoteStream(streamId, track);
    },
    oncleanup: function() {
      console.log(`Stream ID ${streamId} cleaned`);
    }
  });
}

function handleRemoteStream(streamId, stream) {
    const videoElement = document.getElementById(`video_${streamId}`);
    if (videoElement) {
        Janus.attachMediaStream(videoElement, new MediaStream([stream]));
    }
}



function initializeJanus() {
    Janus.init({
      debug: "all",
      callback: function() { 
        const servers = window.IS_DOCKER
          ? [{ urls: 'stun:stun.l.google.com:19302' }]
          : [];
        console.log("[DEBUG] ICE servers configuration:", servers);
        janus = new Janus({
          server: info.janus.ip,
          iceServers: servers,
          success: function() {
            janus.attach({
              plugin: "janus.plugin.streaming",
              success: function(pluginHandle) {
                streaming = pluginHandle;
 
                // Ask stream list
                streaming.send({ 
                  message: { request: "list" },
                  success: function(result) {
                    if(result && result.list) {
                      console.log(result)

                      updateCameraStatesFromJanus(result.list);

                      // For each stream, create the camera:
                      result.list.forEach(stream => {
                        createStreamElement(stream);
                        watchStream(stream.id);
                      });
                    }
                  },
                  error: function(error) {
                    console.log(error);
                    // How we handle? a warn in the gui? 
                  }
                });
              },
              error: function(error) {
                console.log(error);
                // How we handle? a warn in the gui? 
              },
              onmessage: function(msg, jsep) {
                if(msg.list) {
                  console.log("Stream list:", msg.list);
                } else if (jsep) {

                  console.log(msg)
                  streaming.createAnswer({
                    jsep: jsep,
                    media: { 
                      audioSend: false, 
                      videoSend: false, 
                      audioRecv: msg.type === 'rtp' ? true : false, 
                      videoRecv: true 
                    },
                    success: function(jsep) {
                      const body = { request: "start" };
                      streaming.send({ message: body, jsep: jsep });
                    },
                    error: function(error) {
                      console.error("Error answer:", error);
                    }
                  });
                }
              },
              onremotetrack: function(stream) {
                const streamId = Object.keys(activeStreams).find(id => activeStreams[id].watching);
                if(streamId) {
                  console.log("Received", stream);
                  handleRemoteStream(streamId, stream);
                }
              },
              oncleanup: function() {
                console.log("Cleanup stream");
              },
            });
          },
          error: function(error) {
            console.log("Error in Janus connection", error);
          },
          destroyed: function() {
            console.log("Janus destroyed");
          }
        });
      }
    });
}


// ! FISHEYE

function distortionHandler(cameraId, canvasId, canvasRawId, distorsionSettings) {
    // Handle cameras   
    const videoStream = document.getElementById(cameraId);

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.id = canvasRawId;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    videoStream.insertAdjacentElement('afterend', canvas);
    

    // Put video in the jail hidden div
    const hiddenContainer = document.querySelector(".hidden_media");
    hiddenContainer.appendChild(canvas);
    videoStream.style.visibility = 'hidden';
    videoStream.style.position = 'absolute';
    videoStream.style.top = '-10px';
    videoStream.style.left = '-10px';

    // Initialize the fisheye distortion effect (assuming FisheyeGl is available)
    console.log(distorsionSettings);
    var distorter = FisheyeGl({
        image: canvas.toDataURL("image/png"),  // Use the canvas as the source image
        selector: `#${canvasId}`, // a canvas element to work with
        lens: distorsionSettings.lens,
        fov: distorsionSettings.fov,
    });

    


    function renderLoop() {
      if (videoStream.readyState >= 2) { // HAVE_CURRENT_DATA

          ctx.drawImage(videoStream, 0, 0, canvas.width, canvas.height);
          distorter.setImage(canvas.toDataURL("image/png"));
      }
      setTimeout(() => {
          requestAnimationFrame(renderLoop);
      }, 1000 / 60);
    }

    renderLoop();
}


// --- END CAMERA HANDLER

function ROVLoader() {

    

    initializeJanus();

    const attitudeElement = document.querySelector("#attitude");
    const compassElement = document.querySelector("#compass");

    if (!attitudeElement || !compassElement) {
        console.error("[DEBUG] Failed to initialize flight indicators: Missing DOM elements");
        return;
    }

    attitude = new FlightIndicators(
        attitudeElement,
        FlightIndicators.TYPE_ATTITUDE,
        options_instruments
    );
    compass = new FlightIndicators(
        compassElement,
        FlightIndicators.TYPE_HEADING,
        options_instruments
    );

    console.log("[DEBUG] Flight indicators initialized:", { attitude, compass });
}

