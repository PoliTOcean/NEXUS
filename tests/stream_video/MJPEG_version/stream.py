from flask import Flask, Response
from flask_cors import CORS
import cv2
import os
import time
import threading

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

video_path = os.path.join(os.path.dirname(__file__), "../test_video.mp4")

def generate_frames():
    cap = cv2.VideoCapture(video_path)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Restart video when it ends
            continue
        
        # Resize the frame to HD (1280x720)
        frame = cv2.resize(frame, (1280, 720))
        
        # Convert the frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # Stream the frame as MJPEG
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    
    cap.release()

@app.route('/stream')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_app(port):
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)

if __name__ == '__main__':
    # Start Flask server on multiple ports using threads
    thread1 = threading.Thread(target=run_app, args=(8079,))
    thread2 = threading.Thread(target=run_app, args=(8080,))
    thread3 = threading.Thread(target=run_app, args=(8078,))
    
    thread1.start()
    thread2.start()
    thread3.start()
    
    thread1.join()
    thread2.join()
    thread3.join()
