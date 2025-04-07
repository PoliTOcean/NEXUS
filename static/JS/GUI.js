let info;
let script = document.currentScript;
let fullUrl = script.src;
let jsonUrl = fullUrl.replace("JS/GUI.js", "info.json");
let pages = ["ROV", "FLOAT"];
let stsObj;

// [UTILS]
async function getRequest(url = '') {
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
            'Accept': 'application/json',
        },
    })
    return response.json();
}

async function postRequest(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Accept': 'application/json',
        },
        body: JSON.stringify(data)

    })
    return response.json();
}



// Need this to prevent closing of server
function keep_alive_server() {
    let route = "/flaskwebgui-keep-server-alive";
    getRequest(route);
}


// [DYNAMIC PAGES HANDLER]
async function change(page) {
    if (page === page_now) return; // Avoid redundant switching

    // Hide the current page

    if (page_now !== "home") {
        const currentPageElement = document.getElementsByClassName(page_now)[0];
        if (currentPageElement) currentPageElement.classList.add("hide");
    }

    // Show the target page
    const newPageElement = document.getElementsByClassName(page)[0];
    if (newPageElement) {
        newPageElement.classList.remove("hide");
    } else {
        console.warn(`Page ${page} not loaded yet.`);
    }

    // Update the current page tracker
    page_now = page;
}

async function loadPages(page) {

    const newpage = await (await fetch(page)).text();
    let parser = new DOMParser();
    let html = parser.parseFromString(newpage, "text/html");
    let newPageContent = html.body.firstChild;


    // Add the 'hide' class to the new page to make it invisible initially
    newPageContent.classList.add("hide");

    // Append the new page's content to the `.window` container

    let wh = document.querySelector(".window");
    wh.append(newPageContent);
}

const container = document.querySelector('.window');


// TODO: Ask this observer is needed or not
const observer = new MutationObserver((mutationsList) => {

    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            
                ROVLoader();
                observer.disconnect();

            
        }
    }
});

observer.observe(container, { childList: true });



// [STATUSES MANAGMENT]

// * Trasforma il vettore in oggetto 

async function statusController() {
    let response = await fetch("/CONTROLLER/start_status");
    let status = await response.json();

    console.log(status);
    updateStatusesROV({"JOYSTICK": status["status"]});
}

function distortionHandler(cameraId, canvasId, srcUrl) {
    // Handle cameras   
    const videoStream = document.getElementById(cameraId);
    const canvas = document.getElementById(canvasId);
    canvas.src = srcUrl;
    const FPS = 144;

    // Initialize the fisheye distortion effect (assuming FisheyeGl is available)
    var distorter = FisheyeGl({
        image: canvas.src,  // Use the canvas as the source image
        selector: `#${canvasId}`, // a canvas element to work with
        lens: {
            a: 0.465,    // 0 to 4;    default 1
            b: 0.613,      // 0 to 4;  default 1
            Fx: 0.34,   // 0 to 4; default 0.0
            Fy: 0.09,   // 0 to 4;  default 0.0
            scale: 0.911 // 0 to 20; default 1.5
        },
        fov: {
            x: 0, // 0 to 2; default 1
            y: 0  // 0 to 2; default 1
        },
    });

    canvas.style.width = "80%";
    canvas.style.height = "80%";

    // Wait for the video to load metadata (dimensions)
    videoStream.onload = function () {
        drawFrame(); // Start drawing frames
    };

    function drawFrame() {
        distorter.setImage(canvas.src);
        setTimeout(() => requestAnimationFrame(drawFrame), 1000/FPS);
    }
}



// [MAIN]

window.onload = async () => {
    let h = window.innerHeight;
    let w = window.innerWidth;

    let body = document.getElementsByTagName("body")[0];
    body.style.width = `${w}px`; 
    body.style.height = `${h}px`;

    // Load info and statuses
    info = await getRequest(jsonUrl);
    stsObj = info["statuses"].reduce((obj, key) => {
        obj[key] = false;
        return obj;
    }, {});

    for (let i = 0; i < pages.length; i++) {
        await loadPages(pages[i]);
    }

    // Set the initial page
    page_now = "home";

    distortionHandler("camera_0", "canvas_0", "http://localhost:8079/stream");
    //distortionHandler("camera_1", "canvas_2", "http://localhost:8080/stream");
    //distortionHandler("camera_2", "canvas_2", "http://localhost:8078/stream");

    // Start routines
    let refresh = 2000;
    // setInterval(() => statusFLOAT("STATUS"), refresh);
    // setInterval(statusController, refresh);
    // setInterval(keep_alive_server, refresh + 1000);
}





// const socket = io("ws://127.0.0.1:5000",{
    // transports: ["websocket"],
    // reconnectionDelayMax: 10000,
// }) 


// socket.on("connect",() => {
    // console.info("[Socket.io] Ready");
    // socket.emit("test", "test");
// });

// socket.on("connect_error", (data) => {
    // console.error("ERROR");
    // console.log(data);
// });
    
// socket.on("disconnect", (reason, details) => {
    // console.info("DISCONNECTED");
    // console.log(reason);
    // console.log(details);
// });

// socket.on('error', (error) => {
    // console.error('ERROR');
    // console.log(error);
// });


