from flask import Flask, send_from_directory, request, abort
from flask_cors import CORS
import os
from pathlib import Path

# --- Import all the route Blueprints ---
from routes.auth import auth_bp
from routes.questions import questions_bp
from routes.evaluate import evaluation_bp
from routes.users import users_bp
from routes.admin import admin_bp
from routes.submissions import submissions_bp
from routes.courses import courses_bp
from routes.image_processing_evaluation import image_processing_bp # Make sure this is imported

# --- Initialize Flask App ---
app = Flask(__name__, static_folder="../frontend/dist", static_url_path="")
app.config['JSON_SORT_KEYS'] = False
app.config['JSON_AS_ASCII'] = False
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})
PORT = 3007


# <<< START: NEW CODE FOR SERVING IMAGES >>>

# IMPORTANT SECURITY: Define the single, safe directory where all your datasets are stored.
# This prevents users from requesting files from anywhere else on your server.
# The path should be the absolute path to the 'datasets' folder on your server.
BASE_DIR = Path(__file__).parent
SAFE_MEDIA_DIRECTORY = (BASE_DIR / "data" / "datasets").resolve()

@app.route("/api/media")
def serve_media():
    """Securely serves a file from the SAFE_MEDIA_DIRECTORY."""
    # Get the requested file path from the query parameter
    requested_path_str = request.args.get('path')
    if not requested_path_str:
        abort(400, "Missing 'path' parameter.")

    # Create a Path object from the user's request
    requested_path = Path(requested_path_str).resolve()

    # --- SECURITY CHECK ---
    # Check if the resolved requested path is a sub-path of our safe directory.
    # This is the most important step to prevent Path Traversal attacks.
    if SAFE_MEDIA_DIRECTORY not in requested_path.parents:
        abort(403, "Forbidden: Access to this path is not allowed.")

    try:
        # send_from_directory needs the directory and the filename separately
        directory = requested_path.parent
        filename = requested_path.name
        return send_from_directory(directory, filename)
    except FileNotFoundError:
        abort(404, "File not found.")

# <<< END: NEW CODE FOR SERVING IMAGES >>>


# --- Register all API Blueprints with their URL prefixes ---
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(questions_bp, url_prefix="/api/questions")
app.register_blueprint(evaluation_bp, url_prefix='/api/evaluate')
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(admin_bp, url_prefix="/api/admin")
app.register_blueprint(submissions_bp, url_prefix="/api/submissions")
app.register_blueprint(courses_bp, url_prefix="/api/courses")
app.register_blueprint(image_processing_bp, url_prefix="/api/evaluate/image-processing")

# --- Serve React App & Main Entry Point (Unchanged) ---
# ... (rest of your app.py file)
if __name__ == "__main__":
    print(f"✅ Backend server running on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=True, use_reloader=False)