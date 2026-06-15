/**
 * Capture a single still frame from a live MediaStream.
 *
 * We draw the raw stream into an offscreen <video> + <canvas> rather than
 * reading the on-screen camera element. This guarantees:
 *  - the frame is at the camera's native resolution (video.videoWidth/Height),
 *  - it has NO UI chrome/overlays composited on top (telemetry, badges, etc.),
 *    which matters for the OpenCV HSV detection on the backend,
 *  - for fisheye cameras we get the raw, undistorted source frame (not the
 *    WebGL lens-corrected canvas, which is the wrong input for measurement).
 *
 * WebRTC/MediaStream-backed canvases are not origin-tainted, so toBlob works.
 */

const FRAME_TIMEOUT_MS = 4000

export async function captureFrameFromStream(
  stream: MediaStream | null | undefined
): Promise<Blob> {
  if (!stream) {
    throw new Error("No camera stream available to capture")
  }

  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.srcObject = stream

  try {
    await video.play()
    await waitForFrame(video)

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      throw new Error("Camera frame has no dimensions yet")
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get 2D canvas context")
    }
    ctx.drawImage(video, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Failed to encode captured frame"))
        },
        "image/jpeg",
        0.95
      )
    })
  } finally {
    // Detach the stream but never stop its tracks — the live tile still uses them.
    video.pause()
    video.srcObject = null
  }
}

/** Resolve once the video has a decoded frame ready to draw. */
function waitForFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Timed out waiting for a camera frame")),
      FRAME_TIMEOUT_MS
    )

    const done = () => {
      window.clearTimeout(timer)
      resolve()
    }

    // requestVideoFrameCallback fires exactly when a frame is ready to paint.
    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number
      }
    ).requestVideoFrameCallback

    if (typeof rvfc === "function") {
      rvfc.call(video, done)
    } else if (video.readyState >= 2) {
      done()
    } else {
      video.addEventListener("loadeddata", done, { once: true })
    }
  })
}
