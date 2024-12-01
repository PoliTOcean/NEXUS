function cameras_onoff(cameraId) {
    const camera = document.getElementById(cameraId);
    
    if (camera) {
        if (camera.style.visibility === "hidden") {
            camera.style.visibility = "visible";
            console.log(cameraId + " is now visible");
        } else {
            camera.style.visibility = "hidden";
            console.log(cameraId + " is now hidden");
        }
    }
}

let mainDivOrder = []; // Tracks the order of cameras in main_div

function cameras_switching(cameraId) {
    const mainDiv = document.querySelector(".main_div");
    const sideDiv = document.querySelector(".side_div");
    const targetCamera = document.querySelector(`#${cameraId}`);

    if (!mainDiv || !sideDiv || !targetCamera) {
        console.error("Required elements not found.");
        return;
    }

    // If the camera is already in the main_div, do nothing
    if (mainDiv.contains(targetCamera)) {
        console.log(`${cameraId} is already in the main div and cannot be swapped.`);
        return;
    }

    // Add the target camera to main_div
    mainDiv.appendChild(targetCamera);
    targetCamera.classList.remove("inactive-camera");
    targetCamera.classList.add("active-camera");

    // Update the mainDivOrder to match the current state of main_div
    mainDivOrder = Array.from(mainDiv.querySelectorAll(".camera_screen")).map(cam => cam.id);

    // Enforce two cameras in main_div
    if (mainDivOrder.length > 2) {
        // Move the least recently switched camera back to side_div
        const leastRecentCameraId = mainDivOrder.shift(); // Remove from the beginning of the array
        const leastRecentCamera = document.querySelector(`#${leastRecentCameraId}`);

        if (leastRecentCamera) {
            sideDiv.appendChild(leastRecentCamera);
            leastRecentCamera.classList.remove("active-camera");
            leastRecentCamera.classList.add("inactive-camera");
        }
    }

    console.log(`Switched ${cameraId}`);
    console.log("Current main_div cameras:", mainDivOrder);
}


