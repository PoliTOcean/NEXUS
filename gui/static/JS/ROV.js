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

function handleRovArmed(status) {
    switch (status) {
        case "OK":
            console.log("ROV is armed and operational.");
            // additional logic
            break;
        case "OFF":
            console.log("ROV is disarmed.");
            // additional logic
            break;
    }
}

function handleControllerState(statuses, controllerState) {
    // Iterate over each field in CONTROLLER_STATE: DEPTH, ROLL, PITCH
    ["DEPTH", "ROLL", "PITCH"].forEach((field) => {
        if (field in controllerState) {
            const statusValue = controllerState[field];

            // Find the corresponding DOM element for the field
            const element = Array.from(statuses).find((sts) => {
                let txt = sts.querySelector("label span").textContent.trim();
                return txt === field;
            });

            if (element) {
                PIDhandler(element, statusValue);
            }
        }
    });
}

function PIDhandler(pidElement, status) {
    switch (status) {
        case "OFF":
            pidElement.classList.remove("on");
            pidElement.classList.remove("stoppable");
            break;
        case "READY":
            pidElement.classList.add("stoppable");
            pidElement.classList.remove("on");
            break;
        case "ACTIVE":
            pidElement.classList.add("on");
            pidElement.classList.remove("stoppable");
            break;
    }
}

function updateStatusesROV(obj) {
    const statuses = document.getElementsByClassName("status STATUSES");

    Array.from(statuses).forEach((sts) => {
        let txt = sts.querySelector("label span").textContent.trim();

        // Handle ARMED state
        if (txt === "ARMED" && "ARMED" in obj) {
            return handleRovArmed(obj["ARMED"]);
        }

        // Handle CONTROLLER STATE
        if (txt === "CONTROLLER STATE" && "CONTROLLER_STATE" in obj) {
            return handleControllerState(statuses, obj["CONTROLLER_STATE"]);
        }
    });
}

function updateIMU(imuJSON) {
    attitude.updatePitch(imuJSON["PITCH"]);
    attitude.updateRoll(imuJSON["ROLL"]);
    compass.updateHeading(imuJSON["YAW"]);
}

function updateSensors(sensorsJSON) {
    const depth = document.querySelector("#data_depth");
    const temp = document.querySelector("#data_tempExt");
    // Need to update HTML:
    const forceZ = document.querySelector("#data_force_z");
    const forceRoll = document.querySelector("#data_force_roll");
    const forcePitch = document.querySelector("#data_force_pitch");
    const referenceZ = document.querySelector("#data_reference_z");
    const referenceRoll = document.querySelector("#data_reference_roll");
    const referencePitch = document.querySelector("#data_reference_pitch");

    depth.innerHTML = `${parseFloat(sensorsJSON["depth"]).toFixed(2)} m`;
    temp.innerHTML = `${parseFloat(sensorsJSON["tempExt"]).toFixed(2)} °C`;
    // Need to update HTML:
    forceZ.innerHTML = `${parseFloat(sensorsJSON["force_z"]).toFixed(2)} N`;
    forceRoll.innerHTML = `${parseFloat(sensorsJSON["force_roll"]).toFixed(2)} Nm`;
    forcePitch.innerHTML = `${parseFloat(sensorsJSON["force_pitch"]).toFixed(2)} Nm`;
    referenceZ.innerHTML = `${parseFloat(sensorsJSON["reference_z"]).toFixed(2)} m`;
    referenceRoll.innerHTML = `${parseFloat(sensorsJSON["reference_roll"]).toFixed(2)} °`;
    referencePitch.innerHTML = `${parseFloat(sensorsJSON["reference_pitch"]).toFixed(2)} °`;
}

function ROVLoader() {
    const attitudeElement = document.querySelector("#attitude");
    const compassElement = document.querySelector("#compass");
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
}
