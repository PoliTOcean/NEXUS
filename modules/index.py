from app import app
from flask import render_template, send_file

@app.route("/")
def main():
    return render_template('GUI.html')

@app.route("/ROV")
def gui():
    return render_template("ROV.html")

@app.route("/FLOAT")
def float():
    return render_template("FLOAT.html")
    
@app.route("/CAMERAS")
def cameras():
    return render_template("CAMERAS.html")


# ! TO REMOVE
@app.route("/test")
def test():
    return send_file("./static/po.png", mimetype='image/gif')


@app.route("/flaskwebgui-keep-server-alive", methods=["GET"])
def responde():
    return '{"content": "Nothing"}'
