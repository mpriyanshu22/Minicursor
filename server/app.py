import os
from flask import Flask, request, jsonify, send_file
import io
import zipfile
from flask_cors import CORS
from flask_socketio import SocketIO
from agent import run_agent_turn, clear_session

# Modify server/app.py initialization:
app = Flask(__name__, static_folder="../client/dist", static_url_path="/")
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.errorhandler(404)
def not_found(e):
    return app.send_static_file("index.html")


# ── REST: file-system helpers ─────────────────────────────────────────────────

@app.route("/api/files")
def list_files():
    path = request.args.get("path", ".")
    try:
        entries = []
        for item in os.scandir(path):
            try:
                stat = item.stat()
                entries.append({
                    "name": item.name,
                    "path": item.path.replace("\\", "/"),
                    "isDir": item.is_dir(),
                    "size": stat.st_size if item.is_file() else 0,
                })
            except PermissionError:
                pass
        entries.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
        return jsonify({"entries": entries, "path": os.path.abspath(path).replace("\\", "/")})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/read")
def read_file_api():
    path = request.args.get("path", "")
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        ext = os.path.splitext(path)[1].lstrip(".")
        return jsonify({"content": content, "ext": ext})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/download")
def download_file_api():
    path = request.args.get("path", "")
    try:
        if not path or not os.path.exists(path) or not os.path.isfile(path):
            return jsonify({"error": "File not found"}), 404
        return send_file(os.path.abspath(path), as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/download-all", methods=["POST"])
def download_all_files_api():
    data = request.json or {}
    files = data.get("files", [])
    if not files:
        return jsonify({"error": "No files specified"}), 400

    try:
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for filepath in files:
                filepath = filepath.strip()
                if filepath and os.path.exists(filepath) and os.path.isfile(filepath):
                    try:
                        # Attempt to compute relative path from current working directory
                        arcname = os.path.relpath(filepath, os.getcwd())
                        # clean up any leading '..' to prevent directory traversal upon extraction
                        if arcname.startswith(".."):
                            arcname = os.path.basename(filepath)
                    except Exception:
                        arcname = os.path.basename(filepath)
                    zipf.write(filepath, arcname)
        memory_file.seek(0)
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name='minicursor_session_files.zip'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ── WebSocket: agent turn ─────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    print(f"[WS] Client connected: {request.sid}")
    socketio.emit("connected", {"sid": request.sid}, room=request.sid)


@socketio.on("disconnect")
def on_disconnect():
    print(f"[WS] Client disconnected: {request.sid}")


@socketio.on("send_message")
def handle_message(data):
    message = data.get("message", "").strip()
    session_id = data.get("session_id", request.sid)
    sid = request.sid

    if not message:
        return

    def emit_event(event_name, event_data):
        socketio.emit(event_name, event_data, room=sid)

    socketio.start_background_task(run_agent_turn, session_id, message, emit_event)


@socketio.on("clear_session")
def handle_clear(data):
    session_id = data.get("session_id", request.sid)
    clear_session(session_id)
    socketio.emit("session_cleared", {}, room=request.sid)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n[MiniCursor] Server running at http://localhost:{port}\n")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
