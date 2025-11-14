# backend/routes/submissions.py

import json
from pathlib import Path
from flask import Blueprint, jsonify, request
import os

# --- Flask Blueprint Setup ---
# Using a unique name is good practice
submissions_bp = Blueprint("submissions_bp", __name__)

# --- Configuration ---
BASE_DIR = Path(__file__).parent.parent
SUBMISSIONS_PATH = BASE_DIR / "data" / "submissions"
SUBMISSIONS_PATH.mkdir(parents=True, exist_ok=True)  # Ensure base folder exists

# --- Routes ---

@submissions_bp.route("/", methods=["GET"])
def get_aggregated_submissions():
    """
    GET all submissions, aggregated and grouped for the main Submissions Viewer.
    (This is your existing, working code - no changes needed here).
    """
    aggregated = {}
    if not SUBMISSIONS_PATH.exists():
        return jsonify({}), 200

    try:
        for user_file in SUBMISSIONS_PATH.glob("*.json"):
            if not user_file.is_file() or os.path.getsize(user_file) == 0:
                continue

            username = user_file.stem
            with open(user_file, "r", encoding="utf-8") as f:
                try:
                    user_submissions = json.load(f)
                except json.JSONDecodeError:
                    print(f"Warning: Skipping malformed JSON file for {username}")
                    continue

                for sub in user_submissions:
                    subject, level = sub.get("subject"), sub.get("level")
                    if not subject or not level:
                        continue

                    subject_group = aggregated.setdefault(subject, {})
                    level_list = subject_group.setdefault(level, [])
                    level_list.append({
                        "username": username,
                        "status": sub.get("status", "unknown"),
                        "timestamp": sub.get("timestamp"),
                    })

        for subject in aggregated:
            for level in aggregated[subject]:
                aggregated[subject][level].sort(key=lambda s: s.get("timestamp", ""), reverse=True)

        return jsonify(aggregated)
    except Exception as e:
        print(f"Error fetching and aggregating submissions: {e}")
        return jsonify({"message": "Failed to fetch submissions."}), 500


@submissions_bp.route("/", methods=["POST"])
def add_submission():
    """
    POST a new submission for a student.
    (This is your existing code, with a small improvement to save 'answers').
    """
    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"message": "Username required"}), 400

    student_file_path = SUBMISSIONS_PATH / f"{username}.json"
    submissions = []

    if student_file_path.exists() and os.path.getsize(student_file_path) > 0:
        with open(student_file_path, "r", encoding="utf-8") as f:
            try:
                submissions = json.load(f)
            except json.JSONDecodeError:
                print(f"Warning: Overwriting malformed JSON for user {username}")
                submissions = []

    # --- Small Improvement: Ensure all data, including answers, is saved ---
    new_submission = {
        "subject": data.get("subject"),
        "level": data.get("level"),
        "status": data.get("status"),
        "timestamp": data.get("timestamp"),
        "answers": data.get("answers", []) # Added this line
    }
    submissions.append(new_submission)
    # --- End Improvement ---

    with open(student_file_path, "w", encoding="utf-8") as f:
        json.dump(submissions, f, indent=2)

    return jsonify({"message": "Submission saved"}), 201


@submissions_bp.route("/<string:username>", methods=["GET"])
def get_student_submissions(username):
    """
    GET all submissions for a specific student (for the "View Details" modal).
    (This is your existing, working route).
    """
    student_file_path = SUBMISSIONS_PATH / f"{username}.json"

    if not student_file_path.exists():
        return jsonify({"message": f"Submissions for user '{username}' not found."}), 404
        
    if os.path.getsize(student_file_path) == 0:
        return jsonify([]), 200

    try:
        with open(student_file_path, "r", encoding="utf-8") as f:
            submissions = json.load(f)
        return jsonify(submissions)
    except json.JSONDecodeError:
        print(f"Error: Malformed JSON in file for user {username}")
        return jsonify({"message": "Failed to parse student submission data."}), 500
    except Exception as e:
        print(f"Error fetching submissions for user {username}: {e}")
        return jsonify({"message": "Failed to fetch student submissions."}), 500