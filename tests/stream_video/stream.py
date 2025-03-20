from flask import Flask, Response
from flask_cors import CORS
import cv2
import os
import time

app = Flask(__name__)
CORS(app)  # Abilita CORS per tutte le route

video_path = os.path.join(os.path.dirname(__file__), "test_video.mp4")

def generate_frames():
    cap = cv2.VideoCapture(video_path)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Riavvia il video
            continue
        
        # Converti il frame in JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # Stream del frame come MJPEG
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
    
    cap.release()

@app.route('/stream')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8079, debug=True)
