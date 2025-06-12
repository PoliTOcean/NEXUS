const BATTERY_MAX_VALUE = 12600;
const BATTERY_MIN_VALUE = 11500;

let nReport = 1;
let mux = 1;
let manualMuxLock = false;
let listening = 0;
let isImmersionActive = false;

async function startFloat() {
    console.log("Starting float communication");
    return await getRequest("/FLOAT/start");
}


function publishReport(data) {
    const tab = document.getElementsByClassName("g1")[0];
    let img_el = [document.createElement('img'), document.createElement('img')];
    img_el.forEach((i) => i.classList.add("img_style"))
    let div = document.createElement('div');
    let h1 = document.createElement('h1');
    let h2 = [document.createElement('h2'), document.createElement('h2')];
    let p = document.createElement('p');
    h1.innerText = `REPORT #${nReport++}`;
    div.classList.add('report');
    p.classList.add('raw');
    console.log(data.data)
    let {raw, img} = data.data;
    if (img != "NO_DATA") {
        p.innerHTML = "";
        for (let i = 0; i < raw.times.length; i++) {
            p.innerHTML += `${raw.company_name}&emsp;${raw.times[i]}&emsp;${raw.pressure[i]} Pa&emsp;${raw.depth[i]} m<br/>`;
        }
        img_el[0].src = "data:image/jpeg;charset=utf-8;base64," + img[0];
        img_el[1].src = "data:image/jpeg;charset=utf-8;base64," + img[1];
        div.append(h1);
        h2[0].innerHTML = `Data received:`
        div.append(h2[0]);
        div.append(p);
        h2[1].innerHTML = "Plots:"
        div.append(h2[1]);
        div.append(img_el[0]);
        div.append(img_el[1]);
        tab.appendChild(div);
    }
    else {
        div.append(h1);
        p.innerText = `NO DATA`;
        tab.appendChild(div);
    }
}

function publishPackage(status) {
    raw = status['text'];
    console.log(raw);
    const tab = document.getElementsByClassName("g1")[0];
    let div = document.createElement('div');
    let h1 = document.createElement('h1');
    let p = document.createElement('p');
    h1.innerHTML = "PACKAGE";
    p.innerHTML += `${raw.company_name}&emsp;${raw.times}&emsp;${raw.pressure} Pa&emsp;${raw.depth} m<br/>`;
    div.classList.add('report');
    p.classList.add('raw');
    div.append(h1);
    div.append(p);
    tab.appendChild(div);
}


async function listeningFLOAT() {
    const immersion = document.getElementsByClassName("status IMMERSION")[0];
    const listen = document.getElementsByClassName("status LISTENING")[0];
    sts = await getRequest("/FLOAT/listen");
    if (sts["text"] != "LOADING") {
        publishReport(sts);
        listening = 0;
        // Reset immersion status when listening completes
        immersion.classList.remove("immersion");
        isImmersionActive = false;
        listen.classList.remove("listening");
        manualMuxLock = false;
        mux = 1;
        console.log("Listening completed, reset immersion and listening status");
    }
    console.log("Listening status:", sts);
    return sts;
}

// This function handles the status coming from ESP-B
async function handleStatus(status) {
    // Get all the statuses symbol in the Float page
    const drop = document.getElementsByClassName("status DROP");
    const serial = document.querySelector(".status.SERIAL");
    const ready = document.querySelector(".status.READY");
    const immersion = document.querySelector(".status.IMMERSION");
    const listen = document.querySelector(".status.LISTENING");
    const auto_mode = document.querySelector(".status.AUTO_MODE");
    const conn = document.querySelector(".status.CONN");

    
    if (!status.status) status = await startFloat();
    console.log("Status received:", status);
    
    // If we're not in immersion mode and the immersion class is active, remove it
    if (!isImmersionActive && immersion.classList.contains("immersion")) {
        immersion.classList.remove("immersion");
        console.log("Manually reset immersion status");
    }
    
    sts = status.text.split("|");
    
    // Check if this status update contains CONNECTED but not EXECUTING_CMD
    // This means we've transitioned from execution to connected state
    const hasConnected = sts.some(s => s.trim() === "CONNECTED");
    const hasExecuting = sts.some(s => s.trim() === "EXECUTING_CMD");
    
    // If we see CONNECTED without EXECUTING_CMD, and immersion was active, reset it
    if (hasConnected && !hasExecuting && isImmersionActive) {
        immersion.classList.remove("immersion");
        isImmersionActive = false;
        if (!manualMuxLock) mux = 1;
        console.log("Resetting immersion state: CONNECTED received while in immersion mode");
    }

    function disableFunction() {
        for (let i = 0; i < drop.length; i++) {        
            drop[i].classList.remove("clickable");
            drop[i].classList.add("disabled");
        }
    }

    for (let i = 0; i < sts.length; i++) {
        const currentStatus = sts[i].trim();
        console.log(`Processing status part: "${currentStatus}"`);
        
        switch (currentStatus) {
            case "CONNECTED":
                serial.classList.add("on");
                ready.classList.add("on");
                // Reset immersion when we get a clean CONNECTED state
                if (isImmersionActive) {
                    immersion.classList.remove("immersion");
                    isImmersionActive = false;
                    console.log("Immersion reset on CONNECTED state");
                    if (!manualMuxLock) mux = 1;
                }               
                break;
            case "EXECUTING_CMD":
                for (let i = 0; i < drop.length; i++) drop[i].classList.remove("clickable");
                manualMuxLock = true;
                mux = 0;
                immersion.classList.add("immersion");
                isImmersionActive = true;
                console.log("Immersion activated");
                break;
            case "CONNECTED_W_DATA":
                for (let i = 0; i < drop.length; i++) drop[i].classList.remove("clickable");
                manualMuxLock = true;
                mux = 0;
                listen.classList.add("listening");
                listening = 1;
                listeningFLOAT().then(result => {
                    if (result.text === "FINISHED") {
                        // Make sure immersion is reset
                        immersion.classList.remove("immersion");
                        isImmersionActive = false;
                    }
                });
                break;
            case "DATA_ABORTED":
                // Reset states when data is aborted
                listen.classList.remove("listening");
                immersion.classList.remove("immersion");
                isImmersionActive = false;
                if (!manualMuxLock) mux = 1;
                break;
            case "STOP_DATA":
                // Reset states when data stops
                listen.classList.remove("listening");
                immersion.classList.remove("immersion");
                isImmersionActive = false;
                if (!manualMuxLock) mux = 1;
                break;
            case "NO USB":
                serial.classList.remove("on");
                ready.classList.remove("on");
                conn.classList.remove("on");
                disableFunction();
                mux = 0;
                // Reset immersion if no USB
                immersion.classList.remove("immersion");
                isImmersionActive = false;
                break;
            case "AUTO_MODE_NO":
                auto_mode.classList.remove("on");
                break;
            case "AUTO_MODE_YES":
                auto_mode.classList.add("on");
                break;
            case "CONN_OK":
                conn.classList.add("on");
                for (let i = 0; i < drop.length; i++) {
                    drop[i].classList.add("clickable");
                    drop[i].classList.remove("disabled");
                }
                if (!manualMuxLock) mux = 1;
                break;
            case "CONN_LOST":
                conn.classList.remove("on");
                disableFunction();
                // Reset immersion if connection lost
                immersion.classList.remove("immersion");
                isImmersionActive = false;
                break;
            case "STATUS_ERROR":
                console.error("SOMETHING WENT WRONG");
                break;
            default:
                // Battery & RSSI
                const line = sts[i];
                if (line.includes("BATTERY")) {
                    const batteryMatch = line.match(/BATTERY:\s*(\d+)/);
                    if (batteryMatch) {
                        const batteryElement = document.querySelector(".battery_level");
                        const batteryValue = parseInt(batteryMatch[1]);
                        if (batteryElement) {
                            const percentage = Math.round(
                                (batteryValue - BATTERY_MIN_VALUE) / 
                                (BATTERY_MAX_VALUE - BATTERY_MIN_VALUE) * 100
                            );
                            batteryElement.textContent = `${percentage}% (${batteryValue} mV)`;
                        }
                    }
                } 
                else if (line.includes("RSSI")) {
                    const rssiMatch = line.match(/RSSI:\s*(-?\d+)/);
                    if (rssiMatch) {
                        const rssiElement = document.querySelector(".rssi_level");
                        try {
                            const rssiValue = parseInt(rssiMatch[1]);
                            if (rssiElement) {
                                rssiElement.textContent = `${rssiValue} dBm`;
                            }
                        } catch (e) {
                            console.error("Error parsing RSSI value:", e);
                        }
                    }
                }
                break;
        }
    }
}

// Routine operation -> every 2 seconds
async function statusFLOAT(msg) {
    // If we are in a listening operation
    if (listening) {
        listeningFLOAT()    
        return;
    }

    // Otherwise, get float status or the package 
    console.log(`Requesting float status with message: ${msg}`);
    let data = await getRequest(`/FLOAT/status?msg=${msg}`);
    switch (msg) {
        case "STATUS":
            handleStatus(data);
            break
        case "SEND_PACKAGE":
            if (mux == 1) { 
                publishPackage(data);
            }
            else console.log("NOT READY FOR PACKAGE - MUX is locked");
            break
    }
}


// This function sends a message
let msgs = ["GO", "SWITCH_AUTO_MODE", "TRY_UPLOAD", "BALANCE", "CLEAR_SD", "HOME_MOTOR"]
async function msg(e, msg_id) {
    // Handle mux
    if (!mux) {
        console.log("NOT READY FOR MSG - MUX is locked");
        return;
    }
    // Lock
    mux = 0;
    
    const message = msgs[msg_id];
    console.log(`Sending message: ${message}`);

    // send msg
    const data = await fetch(`FLOAT/msg?msg=${message}`);

    if (data.status == 201) {
        console.log(`Message ${message} sent successfully`);
        mux = 1;
    }
    else {
        console.error(`Failed to send message ${message}`);
        alert("Is USB cable connected?");
    }
}

// Switch between Advanced and Basic operations
function switchDiv(){
    const div1 = document.getElementById('basicFloat');
    const div2 = document.getElementById('advancedFloat');
    const button = document.getElementById('toggleButton');
    
    if(div1.style.display === 'none') {
        button.innerText = 'Advanced';
        div1.style.display = 'flex';
        div2.style.display = 'none';
    }
    else {
        button.innerText = 'Basic';
        div1.style.display = 'none';
        div2.style.display = 'flex';
    }
}


// Similar to msg function but with kp,kd,ki args
async function sendPidParams() {
    // Read
    const kp = parseFloat(document.getElementById("kp").value);
    const kd = parseFloat(document.getElementById("kd").value);
    const ki = parseFloat(document.getElementById("ki").value);


    // Check errors
    if (isNaN(kp) || isNaN(kd) || isNaN(ki)) {
        alert("Please enter valid numeric values for Kp, Kd, and Ki.");
        return;
    }

    let msg = `PARAMS ${kp} ${kd} ${ki}`;
    // First, send PARAMS to ESP-B, mux to 0
    mux = 0;
    let data = await fetch(`FLOAT/msg?msg=${encodeURIComponent(msg)}`);
    if (data.status == 201) console.log("PARAMS status sent");
    else console.error("Is USB cable connected?");
}
