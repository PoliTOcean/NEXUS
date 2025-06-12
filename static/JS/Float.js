let FLOAT_TARGET_DEPTH = 2.5; // Default, will be overridden if config loaded
let FLOAT_MAX_ERROR = 0.45;  // Default

let floatSerialLog = "";
const MAX_LOG_LENGTH = 5000; // Max characters for the debug log

// --- UTILITY FUNCTIONS ---
function updateAckStatus(message, success) {
    const ackStatusEl = document.getElementById('float-ack-status');
    if (ackStatusEl) {
        ackStatusEl.textContent = message;
        if (success === true) {
            ackStatusEl.className = 'ack-success';
        } else if (success === false) {
            ackStatusEl.className = 'ack-fail';
        } else {
            ackStatusEl.className = ''; // Neutral
        }
    }
    logToFloatSerial(`ACK Status: ${message}`);
}

function logToFloatSerial(text) {
    const timestamp = new Date().toLocaleTimeString();
    floatSerialLog += `[${timestamp}] ${text}\n`;
    if (floatSerialLog.length > MAX_LOG_LENGTH) {
        floatSerialLog = floatSerialLog.substring(floatSerialLog.length - MAX_LOG_LENGTH);
    }
    const debugOutputEl = document.getElementById('float-serial-debug-output');
    if (debugOutputEl) {
        debugOutputEl.value = floatSerialLog;
        debugOutputEl.scrollTop = debugOutputEl.scrollHeight; // Auto-scroll
    }
}

async function sendFloatCommandToServer(command) {
    logToFloatSerial(`Sending command: ${command}`);
    updateAckStatus(`Sending ${command}...`, null);
    try {
        const response = await fetch(`/FLOAT/msg?msg=${encodeURIComponent(command)}`);
        const data = await response.json();
        if (response.ok && data.status) {
            updateAckStatus(`${command} ACK received.`, true);
            logToFloatSerial(`${command} successful: ${data.text}`);
            return data;
        } else {
            updateAckStatus(`${command} FAILED. ${data.text || response.statusText}`, false);
            logToFloatSerial(`${command} failed: ${data.text || response.statusText}`);
            return null;
        }
    } catch (error) {
        updateAckStatus(`${command} FAILED. Network error.`, false);
        logToFloatSerial(`Network error sending ${command}: ${error}`);
        return null;
    }
}

// --- COMMAND FUNCTIONS ---
function sendFloatCmd(commandName) {
    // Special handling for SEND_PACKAGE to display its direct response
    if (commandName === 'SEND_PACKAGE') {
        sendFloatCommandToServer(commandName).then(data => {
            if (data && data.text) {
                displayReceivedPackage(data.text);
            }
        });
    } else {
        sendFloatCommandToServer(commandName);
    }
}

function sendPidParamsCmd() {
    const kpEl = document.getElementById('kp-input');
    const kiEl = document.getElementById('ki-input');
    const kdEl = document.getElementById('kd-input');

    if (!kpEl || !kiEl || !kdEl) {
        logToFloatSerial("PID input elements not found.");
        alert("Error: PID input fields are missing.");
        return;
    }

    const kp = kpEl.value;
    const ki = kiEl.value;
    const kd = kdEl.value;

    if (kp === "" || ki === "" || kd === "") {
        alert("Please enter Kp, Ki, and Kd values.");
        return;
    }
    const command = `PARAMS ${kp} ${ki} ${kd}`;
    sendFloatCommandToServer(command);
}

function sendTestFreqCmd() {
    const freqEl = document.getElementById('test-freq-input');
    if (!freqEl) {
        logToFloatSerial("Test frequency input element not found.");
        alert("Error: Test frequency input field is missing.");
        return;
    }
    const freq = freqEl.value;
    if (freq === "") {
        alert("Please enter Test Frequency value.");
        return;
    }
    const command = `TEST_FREQ ${freq}`;
    sendFloatCommandToServer(command);
}

function sendTestStepsCmd() {
    const stepsEl = document.getElementById('test-steps-input');
    if (!stepsEl) {
        logToFloatSerial("Test steps input element not found.");
        alert("Error: Test steps input field is missing.");
        return;
    }
    const steps = stepsEl.value;
    if (steps === "") {
        alert("Please enter Test Steps value.");
        return;
    }
    const command = `TEST_STEPS ${steps}`;
    sendFloatCommandToServer(command);
}


// --- STATUS HANDLING ---
function updateFloatStatusIndicator(elementId, statusText, isOn) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = statusText;
        if (isOn === true) el.classList.add('on');
        else if (isOn === false) el.classList.remove('on');
    } else {
        logToFloatSerial(`Warning: Status element ID '${elementId}' not found.`);
    }
}

function parseAndDisplayStatus(statusString) {
    logToFloatSerial(`Raw Status: ${statusString}`);
    const parts = statusString.split('|').map(p => p.trim());
    let dataAvailable = false;

    parts.forEach(part => {
        if (part === "CONNECTED") {
            updateFloatStatusIndicator('float-serial-status', 'CONNECTED', true);
            updateFloatStatusIndicator('float-ready-status', 'READY', true);
            updateFloatStatusIndicator('float-executing-status', 'IDLE', false);
        } else if (part === "CONNECTED_W_DATA") {
            updateFloatStatusIndicator('float-serial-status', 'CONNECTED', true);
            updateFloatStatusIndicator('float-ready-status', 'READY', true);
            updateFloatStatusIndicator('float-data-avail-status', 'YES', true);
            dataAvailable = true;
            updateFloatStatusIndicator('float-executing-status', 'IDLE (DATA)', false);
        } else if (part === "EXECUTING_CMD") {
            updateFloatStatusIndicator('float-executing-status', 'BUSY', true);
            updateFloatStatusIndicator('float-data-avail-status', 'NO', false);
            dataAvailable = false;
        } else if (part === "AUTO_MODE_YES") {
            updateFloatStatusIndicator('float-auto-mode-status', 'ON', true);
        } else if (part === "AUTO_MODE_NO") {
            updateFloatStatusIndicator('float-auto-mode-status', 'OFF', false);
        } else if (part === "CONN_OK") {
            updateFloatStatusIndicator('float-wifi-status', 'OK', true);
        } else if (part === "CONN_LOST") {
            updateFloatStatusIndicator('float-wifi-status', 'LOST', false);
        } else if (part.startsWith("BATTERY:")) {
            const batteryValue = part.split(':')[1].trim();
            updateFloatStatusIndicator('float-battery-level', `${batteryValue}mV`, null);
        } else if (part.startsWith("RSSI:")) {
            const rssiValue = part.split(':')[1].trim();
            updateFloatStatusIndicator('float-rssi-level', `${rssiValue}dBm`, null);
        } else if (part === "NO USB") {
            updateFloatStatusIndicator('float-serial-status', 'NO USB', false);
            updateFloatStatusIndicator('float-ready-status', 'OFF', false);
            updateFloatStatusIndicator('float-wifi-status', 'N/A', null);
            updateFloatStatusIndicator('float-executing-status', 'N/A', null);
            updateFloatStatusIndicator('float-data-avail-status', 'N/A', false);
            dataAvailable = false;
        } else if (part.startsWith("TIMEOUT_ON_")) {
            logToFloatSerial(`Warning: ESPB reported timeout on command: ${part}`);
        }
    });

    const fetchButton = document.getElementById('fetch-profile-data-button');
    if (fetchButton) {
        fetchButton.disabled = !dataAvailable;
    } else {
        logToFloatSerial("Warning: Fetch profile data button not found.");
    }
    
    if (!dataAvailable) {
         updateFloatStatusIndicator('float-data-avail-status', 'NO', false);
    }
}


async function pollFloatStatus() {
    // Only poll and update DOM if FLOAT page is active
    if (typeof page_now !== 'undefined' && page_now !== 'FLOAT') {
        return;
    }

    try {
        const response = await fetch(`/FLOAT/status?msg=STATUS`);
        if (!response.ok) {
            logToFloatSerial(`Error polling status: HTTP ${response.status}`);
            parseAndDisplayStatus("NO USB"); // Simulate a disconnect
            return;
        }
        const data = await response.json();
        if (data.status) {
            parseAndDisplayStatus(data.text);
        } else {
            logToFloatSerial(`Error polling status: ${data.text || 'Unknown error'}`);
            parseAndDisplayStatus("NO USB"); // Simulate a disconnect
        }
    } catch (error) {
        logToFloatSerial(`Network error polling status: ${error}`);
        parseAndDisplayStatus("NO USB"); // Simulate a disconnect
    }
}

// --- DATA FETCHING AND DISPLAY ---
async function fetchProfileData() {
    logToFloatSerial("Attempting to fetch profile data...");
    const fetchButton = document.getElementById('fetch-profile-data-button');
    if (fetchButton) fetchButton.disabled = true;

    const profileStatusEl = document.getElementById('profile-data-status');
    if (profileStatusEl) profileStatusEl.textContent = "Sending LISTENING command...";

    const listenCmdSuccessData = await sendFloatCommandToServer('LISTENING');
    if (!listenCmdSuccessData) {
        if (profileStatusEl) profileStatusEl.textContent = "Failed to send LISTENING command. Cannot fetch data.";
        // Re-enable button based on next status poll if appropriate
        return;
    }

    // Poll /FLOAT/listen until data is ready
    if (profileStatusEl) profileStatusEl.textContent = "Fetching data from backend...";
    logToFloatSerial("Calling /FLOAT/listen endpoint...");

    let pollAttempts = 0;
    let maxPolls = 40; // ~40*250ms = 10s max wait
    let pollDelay = 250;

    while (pollAttempts < maxPolls) {
        try {
            const response = await fetch(`/FLOAT/listen`);
            const data = await response.json();
            logToFloatSerial(`/FLOAT/listen response: Status ${data.status}, Text: ${data.text}`);

            if (response.ok && data.status && data.text === "FINISHED") {
                if (profileStatusEl) profileStatusEl.textContent = "Data received and processed.";
                displayProfileData(data.data);
                updateFloatStatusIndicator('float-data-avail-status', 'FETCHED', null);
                return;
            } else if (data.text === "LOADING") {
                if (profileStatusEl) profileStatusEl.textContent = "Data transfer in progress... waiting for data...";
                await new Promise(resolve => setTimeout(resolve, pollDelay));
                pollAttempts++;
                continue;
            } else {
                if (profileStatusEl) profileStatusEl.textContent = `Error fetching profile data: ${data.text}`;
                logToFloatSerial(`Error fetching profile data from /FLOAT/listen: ${data.text}`);
                return;
            }
        } catch (error) {
            if (profileStatusEl) profileStatusEl.textContent = "Network error fetching profile data.";
            logToFloatSerial(`Network error on /FLOAT/listen: ${error}`);
            return;
        }
    }
    if (profileStatusEl) profileStatusEl.textContent = "Timeout waiting for data from backend.";
    logToFloatSerial("Timeout waiting for /FLOAT/listen to return FINISHED.");
}

function displayProfileData(profileData) {
    const rawDataEl = document.getElementById('profile-data-raw');
    const plotContainerEl = document.getElementById('profile-plot-container');
    
    if (!rawDataEl || !plotContainerEl) {
        logToFloatSerial("Profile data display elements not found.");
        return;
    }

    rawDataEl.textContent = ""; 
    plotContainerEl.innerHTML = ""; 

    if (profileData && profileData.raw && profileData.raw.times && Array.isArray(profileData.raw.times) && profileData.raw.times.length > 0) {
        let formattedRawData = "Timestamp (ms) | Depth (m) | Pressure (Pa)\n";
        formattedRawData += "--------------------------------------------\n";
        for (let i = 0; i < profileData.raw.times.length; i++) {
            const time = profileData.raw.times[i];
            const depth = parseFloat(profileData.raw.depth[i]).toFixed(2);
            const pressure = parseFloat(profileData.raw.pressure[i]).toFixed(2);
            
            let line = `${time} | ${depth} | ${pressure}\n`;
            if (Math.abs(parseFloat(depth) - FLOAT_TARGET_DEPTH) <= FLOAT_MAX_ERROR) {
                formattedRawData += `* ${line}`; 
            } else {
                formattedRawData += `  ${line}`;
            }
        }
        rawDataEl.textContent = formattedRawData;

        if (profileData.img && profileData.img !== "NO_DATA" && Array.isArray(profileData.img) && profileData.img.length === 2) {
            const depthImg = document.createElement('img');
            depthImg.src = "data:image/png;base64," + profileData.img[0];
            depthImg.alt = "Depth vs Time Plot";
            depthImg.style.maxWidth = "100%";
            plotContainerEl.appendChild(depthImg);

            const pressureImg = document.createElement('img');
            pressureImg.src = "data:image/png;base64," + profileData.img[1];
            pressureImg.alt = "Pressure vs Time Plot";
            pressureImg.style.maxWidth = "100%";
            plotContainerEl.appendChild(pressureImg);
        } else {
            plotContainerEl.textContent = "No plot data available or plots missing.";
        }
    } else {
        rawDataEl.textContent = "No raw data points received or data is malformed.";
        if (profileData && profileData.error_message) {
            rawDataEl.textContent += `\nError: ${profileData.error_message}`;
        }
        plotContainerEl.textContent = "No plot data available.";
    }
}

function displayReceivedPackage(packageDataText) {
    const packageContentEl = document.getElementById('float-package-content');
    if (!packageContentEl) {
        logToFloatSerial("Package content display element not found.");
        return;
    }
    packageContentEl.innerHTML = ''; // Clear previous content

    try {
        const jsonData = JSON.parse(packageDataText);
        logToFloatSerial("Parsed package JSON successfully for fancy display.");

        const keyOrder = ['company_number', 'mseconds', 'times', 'depth', 'pressure', 'temperature']; // Preferred order

        // Display in preferred order
        keyOrder.forEach(key => {
            if (jsonData.hasOwnProperty(key)) {
                renderPackageItem(packageContentEl, key, jsonData[key]);
                delete jsonData[key]; // Remove from jsonData to avoid re-rendering
            }
        });

        // Display any remaining keys
        for (const key in jsonData) {
            if (jsonData.hasOwnProperty(key)) {
                renderPackageItem(packageContentEl, key, jsonData[key]);
            }
        }

    } catch (e) {
        // If parsing fails, display raw text as before
        const rawTextNode = document.createElement('pre');
        rawTextNode.textContent = packageDataText;
        packageContentEl.appendChild(rawTextNode);
        logToFloatSerial(`Displayed raw package (JSON parse failed for '${packageDataText}'): ${e}`);
    }
}

function renderPackageItem(parentElement, key, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('package-item');

    const keySpan = document.createElement('span');
    keySpan.classList.add('package-key');
    // Make keys more readable
    let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    keySpan.textContent = `${displayKey}: `;
    itemDiv.appendChild(keySpan);

    const valueSpan = document.createElement('span');
    valueSpan.classList.add('package-value');
    
    let displayValue = value;
    if (key === 'depth') displayValue = `${value} m`;
    else if (key === 'pressure') displayValue = `${value} Pa`;
    else if (key === 'temperature') displayValue = `${value} °C`;
    else if (key === 'mseconds' || key === 'times') displayValue = `${value} ms`;


    valueSpan.textContent = displayValue;
    itemDiv.appendChild(valueSpan);
    parentElement.appendChild(itemDiv);
}

// --- INITIALIZATION ---

async function attemptFloatSerialConnection() {
    logToFloatSerial("Attempting initial float serial connection...");
    try {
        const response = await fetch(`/FLOAT/start`);
        if (!response.ok) {
            logToFloatSerial(`Error connecting to float: HTTP ${response.status}`);
            parseAndDisplayStatus("NO USB"); // Update UI to reflect connection failure
            return;
        }
        const data = await response.json();
        if (data.status) {
            logToFloatSerial(`Float connection successful: ${data.text}`);
            parseAndDisplayStatus(data.text); // Update UI with initial status
        } else {
            logToFloatSerial(`Failed to connect to float: ${data.text}`);
            parseAndDisplayStatus(data.text); // Display error like "NO USB"
        }
    } catch (error) {
        logToFloatSerial(`Network error during initial float connection: ${error}`);
        parseAndDisplayStatus("NO USB"); // Simulate a disconnect
    }
}

async function initializeFloatPage() {
    logToFloatSerial("Initializing Float Page Logic...");
    
    // Attempt to load float config if available via info object
    if (typeof info !== "undefined" && info && info.float_config) {
        FLOAT_TARGET_DEPTH = info.float_config.target_depth || 2.5;
        FLOAT_MAX_ERROR = info.float_config.max_error || 0.45;
        logToFloatSerial(`Loaded float config: Target Depth=${FLOAT_TARGET_DEPTH}, Max Error=${FLOAT_MAX_ERROR}`);
    } else {
        logToFloatSerial(`Using default float config or info.float_config not found: Target Depth=${FLOAT_TARGET_DEPTH}, Max Error=${FLOAT_MAX_ERROR}`);
    }
    
    // Attempt initial serial connection
    await attemptFloatSerialConnection();
    
    // Start polling for status updates
    setInterval(pollFloatStatus, 3000); // Poll status every 3 seconds
}
