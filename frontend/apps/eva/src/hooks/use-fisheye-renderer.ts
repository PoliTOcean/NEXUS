import { useEffect, type RefObject } from "react"

import type { EvaFisheyeSettings } from "@/types/eva"

type UseFisheyeRendererOptions = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream: MediaStream | null
  settings: EvaFisheyeSettings
  disabled?: boolean
  onFailure: () => void
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = (aPosition + 1.0) * 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform sampler2D uTexture;
  uniform float uLens;
  uniform float uFov;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    centered.x *= uAspect;

    float radius = length(centered);
    if (radius > 1.42) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float safeRadius = max(radius, 0.0001);
    float fov = clamp(uFov, 0.1, 3.2);
    float lens = clamp(uLens, 0.1, 4.0);
    float mappedRadius = tan(safeRadius * fov) / tan(fov);
    mappedRadius = pow(clamp(mappedRadius, 0.0, 1.8), lens);

    vec2 source = centered * (mappedRadius / safeRadius);
    source.x /= uAspect;
    source = source * 0.5 + 0.5;

    if (source.x < 0.0 || source.x > 1.0 || source.y < 0.0 || source.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    gl_FragColor = texture2D(uTexture, source);
  }
`

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  )

  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  return program
}

function configureTexture(gl: WebGLRenderingContext, texture: WebGLTexture) {
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
}

function resizeCanvasToVideo(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement
) {
  const width = video.videoWidth || canvas.clientWidth
  const height = video.videoHeight || canvas.clientHeight
  if (!width || !height) return

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
  }
}

export function useFisheyeRenderer({
  videoRef,
  canvasRef,
  stream,
  settings,
  disabled,
  onFailure,
}: UseFisheyeRendererOptions) {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.srcObject = stream

    return () => {
      video.srcObject = null
    }
  }, [stream, videoRef])

  useEffect(() => {
    if (!stream || disabled) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const gl =
      canvas?.getContext("webgl", { preserveDrawingBuffer: false }) ?? null

    if (!video || !canvas || !gl) {
      onFailure()
      return
    }

    const mediaVideo = video
    const outputCanvas = canvas
    const renderingContext = gl

    const program = createProgram(renderingContext)
    const positionBuffer = renderingContext.createBuffer()
    const texture = renderingContext.createTexture()

    if (!program || !positionBuffer || !texture) {
      onFailure()
      return
    }

    const positionLocation = renderingContext.getAttribLocation(
      program,
      "aPosition"
    )
    const textureLocation = renderingContext.getUniformLocation(
      program,
      "uTexture"
    )
    const lensLocation = renderingContext.getUniformLocation(program, "uLens")
    const fovLocation = renderingContext.getUniformLocation(program, "uFov")
    const aspectLocation = renderingContext.getUniformLocation(
      program,
      "uAspect"
    )

    renderingContext.bindBuffer(renderingContext.ARRAY_BUFFER, positionBuffer)
    renderingContext.bufferData(
      renderingContext.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      renderingContext.STATIC_DRAW
    )
    configureTexture(renderingContext, texture)

    let animationFrameId = 0

    function render() {
      if (mediaVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationFrameId = window.requestAnimationFrame(render)
        return
      }

      resizeCanvasToVideo(renderingContext, outputCanvas, mediaVideo)
      renderingContext.useProgram(program)
      renderingContext.bindBuffer(renderingContext.ARRAY_BUFFER, positionBuffer)
      renderingContext.enableVertexAttribArray(positionLocation)
      renderingContext.vertexAttribPointer(
        positionLocation,
        2,
        renderingContext.FLOAT,
        false,
        0,
        0
      )

      renderingContext.activeTexture(renderingContext.TEXTURE0)
      renderingContext.bindTexture(renderingContext.TEXTURE_2D, texture)
      renderingContext.texImage2D(
        renderingContext.TEXTURE_2D,
        0,
        renderingContext.RGBA,
        renderingContext.RGBA,
        renderingContext.UNSIGNED_BYTE,
        mediaVideo
      )

      renderingContext.uniform1i(textureLocation, 0)
      renderingContext.uniform1f(lensLocation, settings.lens)
      renderingContext.uniform1f(fovLocation, settings.fov)
      renderingContext.uniform1f(
        aspectLocation,
        outputCanvas.width && outputCanvas.height
          ? outputCanvas.width / outputCanvas.height
          : 1
      )
      renderingContext.drawArrays(renderingContext.TRIANGLES, 0, 6)

      animationFrameId = window.requestAnimationFrame(render)
    }

    animationFrameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      renderingContext.deleteTexture(texture)
      renderingContext.deleteBuffer(positionBuffer)
      renderingContext.deleteProgram(program)
    }
  }, [
    canvasRef,
    disabled,
    onFailure,
    settings.fov,
    settings.lens,
    stream,
    videoRef,
  ])
}
