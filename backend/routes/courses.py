# File: courses_api.py

import json
from pathlib import Path
from flask import Blueprint, jsonify

# --- Flask Blueprint Setup ---
courses_bp = Blueprint("courses", __name__)

# --- Configuration ---
BASE_DIR = Path(__file__).parent.parent
COURSE_CONFIG_PATH = BASE_DIR / "data" / "course_config.json"


@courses_bp.route("/", methods=["GET"])
def get_all_courses():
    """
    Reads the course configuration and returns it as a LIST of courses
    to guarantee the order is preserved.
    """
    try:
        with open(COURSE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            courses_dict = json.load(f)

        # Convert the dictionary into a list of objects to preserve order.
        # Each object in the list will now contain its original key.
        courses_list = []
        for key, value in courses_dict.items():
            course_item = value.copy()  # Start with the course's data
            course_item['key'] = key    # Add the original key (e.g., "ds", "ml")
            courses_list.append(course_item)

        # Return the list. The order of a list is always maintained in JSON.
        return jsonify(courses_list)

    except FileNotFoundError:
        return jsonify({"message": "Course configuration file not found."}), 404
    except Exception as e:
        print(f"Error reading course config: {e}")
        return jsonify({"message": "Server error reading course configuration."}), 500