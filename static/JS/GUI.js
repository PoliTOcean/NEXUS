let info;
let script = document.currentScript;
let fullUrl = script.src;
let jsonUrl = fullUrl.replace("JS/GUI.js", "info.json");
let pages = ["ROV", "FLOAT", "PID", "TASK_1"];
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

const observer = new MutationObserver((mutationsList) => {

    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            const pid = container.querySelector("#PID_form");

            const task = container.querySelector("#TASK_1_FORM");
            // Se l'ultima pagina è pronta, carica i contenuti in tutte le pagine
            if (task && pid) {

                ROVLoader();
                Task1Loader();
                PIDLoader();
                observer.disconnect();

            }
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

    
    // Handle cameras   
    const videoStream = document.getElementById("camera_0");
    const canvas = document.getElementById("canvas_0");
    canvas.src = "http://localhost:8079/stream";
    const FPS = 60;

    // Initialize the fisheye distortion effect (assuming FisheyeGl is available)
    var distorter = FisheyeGl({
        image: canvas.src,  // Use the canvas as the source image
        selector: '#canvas_0', // a canvas element to work with
        lens: {
            a: 1,    // 0 to 4;  default 1
            b: 1,      // 0 to 4;  default 1
            Fx: 0.5,   // 0 to 4;  default 0.0
            Fy: 0.5,   // 0 to 4;  default 0.0
            scale: 0.3 // 0 to 20; default 1.5
        },
        fov: {
            x: 1, // 0 to 2; default 1
            y: 1  // 0 to 2; default 1
        },
    });

    // Wait for the video to load metadata (dimensions)
    videoStream.onload = function () {
        canvas.width = videoStream.width;
        canvas.height = videoStream.height;
        drawFrame(); // Start drawing frames
    };

    function drawFrame() {
        
        
        distorter.setImage(canvas.src);
        
        setTimeout(() => requestAnimationFrame(drawFrame), 1000/FPS);
    }

    // Start routines
    let refresh = 2000;
    setInterval(() => statusFLOAT("STATUS"), refresh);
    setInterval(statusController, refresh);
    setInterval(keep_alive_server, refresh + 1000);
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


