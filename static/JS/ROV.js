let page_now;
let mainCameraId = 'camera_0'

addEventListener("resize", (event) => {
    let h = window.innerHeight;
    let w = window.innerWidth;
    let body = document.getElementsByTagName('body')[0];
    body.style.width = `${w}px`; 
    body.style.height = `${h}px`;
});


// [CAMERA MANAGEMENT]

let camerasInitialized = false; 


function initializeCameras() {

    if (camerasInitialized) {
        console.log("[ROV] Cameras are already initialized. Skipping initialization.");
        return;
    }

    if (!info || !info.cameras) {
        console.error("[ROV] Camera information is not available in `info`.");
        return;
    }

    console.log("[ROV] Initializing cameras with sources from info.json...");

    for (let i = 0; i < info.cameras.n_cameras; i++) {
        const cameraElement = document.querySelector(`#c${i} img`);
        if (cameraElement) {
            cameraElement.src = info.cameras[i].src; // Use the `src` from the `info` object
            console.log(`[ROV] Updated camera #${i} src to: ${info.cameras[i].src}`);
        } else {
            console.warn(`[ROV] Camera element #c${i} not found.`);
        }
    }

    camerasInitialized = true;

}


function switching(id) {
    let n_camera = `${id.match(/\d+/)[0]}`;
    if (info["cameras"][n_camera]["status"] == 0) return;
    let z = -1;
    for (let i = 0; i < info["cameras"]["n_cameras"] && z == -1; i++) if (info["cameras"][`${i}`]["status"] == 0) z = i;
    let camera_p = document.querySelector(".camera_p");
    let camera_s = document.querySelectorAll(`.camera_s`);
    let target, deploy;
    camera_s.forEach((el) => {
        if (el.firstElementChild.id == `c${n_camera}`) {
            target = el.firstElementChild;
            deploy = el;
        }
    });
    camera_p.append(target);
    deploy.append(camera_p.firstElementChild);
    info["cameras"][n_camera]["status"] = 0;
    info["cameras"][z]["status"] = 1;
    mainCameraId = target.querySelector('video').id;
}

async function onoff(id) {
    let wh = document.querySelectorAll(`#c${id.match(/\d+/)[0]}`)[0];
    console.log(wh);
    console.log(info)
    info["cameras"][`${id.match(/\d+/)[0]}`]["enabled"] = !info["cameras"][`${id.match(/\d+/)[0]}`]["enabled"];
    if (info["cameras"][`${id.match(/\d+/)[0]}`]["enabled"] == 1) wh.className = wh.className.replace(" hide", "");
    else wh.className += " hide";
}

let rotationAngle = 0;
function rotateVideo(){
    const video = document.getElementById(mainCameraId);
    rotationAngle += 90;
    video.style.transform =  `rotate(${rotationAngle}deg)`;
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

        // Handle ARMED state

        if (sts.id === "ARMED") {

            let armedState = obj["ARMED"];

            // ? These console logs can be removed

            switch (armedState) {
                case "OK":
                    console.log("ROV is armed and operational.");
                    // additional logic
                    break;
                case "OFF":
                    console.log("ROV is disarmed.");
                    // additional logic
                    break;
            }

            PIDhandler(sts, armedState);
        }

        // Handle DEPTH, ROLL, PITCH states saperately

        if (sts.id === "DEPTH") {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["DEPTH"]);
        }
        if (sts.id === "ROLL") {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["ROLL"]);
        }
        if (sts.id === "PITCH") {
            PIDhandler(sts, obj["CONTROLLER_STATE"]["PITCH"]);
        }

        // Handle JOYSTICK state

        if (sts.id === "JOYSTICK") {
            PIDhandler(sts, obj["JOYSTICK"]);
        }
    });
}

function updateIMU(imuJSON) {
    console.log("[DEBUG] updateIMU called with:", imuJSON);

    if (imuJSON && typeof imuJSON === "object") {
        console.log(`[DEBUG] PITCH: ${imuJSON["PITCH"]}, ROLL: ${imuJSON["ROLL"]}, YAW: ${imuJSON["YAW"]}`);
    } else {
        console.warn("[DEBUG] Invalid IMU data received:", imuJSON);
    }

    attitude.updatePitch(imuJSON["PITCH"]);
    attitude.updateRoll(imuJSON["ROLL"]);
    compass.updateHeading(imuJSON["YAW"]);
}

function updateSensors(sensorsJSON) {
    const depth = document.querySelector("#data_depth");
    // Need to update HTML:
    /*const forceZ = document.querySelector("#data_force_z");
    const forceRoll = document.querySelector("#data_force_roll");
    const forcePitch = document.querySelector("#data_force_pitch");
    const referenceZ = document.querySelector("#data_reference_z");
    const referenceRoll = document.querySelector("#data_reference_roll");
    const referencePitch = document.querySelector("#data_reference_pitch");*/

    depth.innerHTML = `${parseFloat(sensorsJSON["depth"]).toFixed(2)} m`;
    // Need to update HTML:
    /*forceZ.innerHTML = `${parseFloat(sensorsJSON["force_z"]).toFixed(2)} N`;
    forceRoll.innerHTML = `${parseFloat(sensorsJSON["force_roll"]).toFixed(2)} Nm`;
    forcePitch.innerHTML = `${parseFloat(sensorsJSON["force_pitch"]).toFixed(2)} Nm`;
    referenceZ.innerHTML = `${parseFloat(sensorsJSON["reference_z"]).toFixed(2)} m`;
    referenceRoll.innerHTML = `${parseFloat(sensorsJSON["reference_roll"]).toFixed(2)} °`;
    referencePitch.innerHTML = `${parseFloat(sensorsJSON["reference_pitch"]).toFixed(2)} °`;*/
}

function ROVLoader() {
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

