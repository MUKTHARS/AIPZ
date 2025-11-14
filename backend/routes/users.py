import json
from pathlib import Path
from flask import Blueprint, jsonify, request
import bcrypt

# --- Flask Blueprint Setup ---
users_bp = Blueprint('users', __name__)

# --- Configuration & Helper Functions (Unchanged) ---
BASE_DIR = Path(__file__).parent.parent
USERS_FILE_PATH = BASE_DIR / "data" / "users.json"
COURSE_CONFIG_PATH = BASE_DIR / "data" / "course_config.json"

def load_data_from_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f: return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"users": []} if 'users' in str(file_path) else {}

def save_users_to_file(data):
    with open(USERS_FILE_PATH, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)

def create_default_progress():
    course_config = load_data_from_file(COURSE_CONFIG_PATH)
    default_progress = {}
    for subject_key, details in course_config.items():
        if isinstance(details, dict) and 'levels' in details:
            levels = details.get("levels", [])
            if levels:
                subject_progress = {lvl: "unlocked" if i == 0 else "locked" for i, lvl in enumerate(levels)}
                default_progress[subject_key] = subject_progress
    return default_progress

# --- Route for GET (all users) and POST (new user) ---
@users_bp.route('/', methods=['GET', 'POST'])
def handle_users():
    # ... (This function remains unchanged)
    if request.method == 'POST':
        new_user_data = request.get_json()
        if not all(k in new_user_data for k in ['username', 'password']):
            return jsonify({"message": "Username and password are required"}), 400
        users_data = load_data_from_file(USERS_FILE_PATH)
        users_list = users_data.get("users", [])
        if any(user['username'] == new_user_data['username'] for user in users_list):
            return jsonify({"message": "A user with this username already exists"}), 409
        password_bytes = new_user_data['password'].encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password_bytes = bcrypt.hashpw(password_bytes, salt)
        new_user = {
            "username": new_user_data['username'],
            "password": hashed_password_bytes.decode('utf-8'),
            "role": new_user_data.get('role', 'student'),
            "progress": create_default_progress()
        }
        users_list.append(new_user)
        users_data['users'] = users_list
        save_users_to_file(users_data)
        return jsonify({"message": "User created successfully"}), 201
    if request.method == 'GET':
        users_data = load_data_from_file(USERS_FILE_PATH)
        sanitized_users = [{"username": u.get("username"), "role": u.get("role")} for u in users_data.get("users", [])]
        return jsonify(sanitized_users)

# --- FIX: Combined route for PUT (Update) and DELETE ---
@users_bp.route('/<string:username>', methods=['PUT', 'DELETE'])
def manage_specific_user(username):
    """Handles updating (PUT) or deleting (DELETE) a specific user."""
    users_data = load_data_from_file(USERS_FILE_PATH)
    users_list = users_data.get("users", [])
    
    user_index = next((i for i, user in enumerate(users_list) if user['username'] == username), None)

    if user_index is None:
        return jsonify({"message": "User not found"}), 404

    # --- Logic for DELETE request ---
    if request.method == 'DELETE':
        if username.lower() == 'admin':
            return jsonify({"message": "The primary 'admin' user cannot be deleted."}), 403
        
        users_list.pop(user_index)
        users_data['users'] = users_list
        save_users_to_file(users_data)
        return jsonify({"message": f"User '{username}' was deleted successfully."}), 200

    # --- Logic for PUT request ---
    if request.method == 'PUT':
        user_to_update = users_list[user_index]
        update_data = request.get_json()
        if not update_data:
            return jsonify({"message": "Request body cannot be empty"}), 400
        
        user_to_update['progress'] = create_default_progress()
        if 'role' in update_data:
            user_to_update['role'] = update_data['role']
        if 'password' in update_data and update_data['password']:
            password_bytes = update_data['password'].encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_password_bytes = bcrypt.hashpw(password_bytes, salt)
            user_to_update['password'] = hashed_password_bytes.decode('utf-8')

        save_users_to_file(users_data)
        return jsonify({"message": f"User '{username}' updated successfully. Progress has been reset."}), 200