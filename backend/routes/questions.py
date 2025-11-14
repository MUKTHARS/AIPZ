

# backend/routes/questions.py

import json
from pathlib import Path
from flask import Blueprint, jsonify, request
import random

# --- Flask Blueprint Setup ---
questions_bp = Blueprint('questions_api', __name__)

# --- Configuration ---
BASE_DIR = Path(__file__).parent.parent
QUESTIONS_BASE_PATH = BASE_DIR / "data" / "questions"
COURSE_CONFIG_PATH = BASE_DIR / "data" / "course_config.json"

# --- Routes ---

@questions_bp.route('/', methods=['GET'])
def get_all_subjects_and_levels():
    """
    GET all subjects and their levels from the central course_config.json file.
    """
    try:
        with open(COURSE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        structure = {
            subject: details.get("levels", [])
            for subject, details in config.items() if isinstance(details, dict)
        }
        return jsonify(structure), 200
    except Exception as e:
        print(f"Error fetching question structure: {e}")
        return jsonify({"message": "Failed to fetch question structure."}), 500


@questions_bp.route('/<string:subject>/<int:level>', methods=['GET'])
def get_questions_for_level(subject, level):
    """
    GET questions for a specific subject and level based on the course config.
    """
    level_name = f"level{level}"

    try:
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_name / "questions.json"

        # ========================================================
        # ============== ADD THIS DEBUGGER BLOCK =================
        # ========================================================
        print("\n" + "="*15 + " DEBUGGING QUESTION FETCH " + "="*15)
        print(f"  - Subject received from API call: '{subject}'")
        print(f"  - Level received from API call:   '{level}'")
        print(f"  - Constructed file path to check: '{questions_file_path}'")
        print(f"  - Does this file exist?           -> {questions_file_path.exists()}")
        print("="*54 + "\n")
        # ========================================================
        # ========================================================

        # Check if file is empty
        if questions_file_path.stat().st_size == 0:
            return jsonify([]), 200

        with open(questions_file_path, 'r', encoding='utf-8') as f:
            try:
                all_questions = json.load(f)
            except json.JSONDecodeError:
                # If JSON parsing fails (e.g., empty file), return empty array
                print(f"Warning: Invalid JSON in {questions_file_path}, returning empty array.")
                return jsonify([]), 200

        if not all_questions:
            return jsonify([]), 200

        # --- Load the course config to get the question limit ---
        with open(COURSE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)

        # Correctly read the level-specific limit from the config object
        limit = config.get(subject, {}).get('question_limit', {}).get(level_name)

        # For ML, the limit is the number of projects (usually 1)
        # For other subjects, it's the number of questions to sample.
        if limit and isinstance(limit, int) and limit > 0:
            if len(all_questions) > limit:
                selected_questions = random.sample(all_questions, limit)
                print(f"Sampled {limit} of {len(all_questions)} questions for {subject}/{level_name}.")
                return jsonify(selected_questions), 200
       
        # If no limit is set, or if the limit is >= the number of questions, return all
        print(f"Returning all {len(all_questions)} questions for {subject}/{level_name}.")
        return jsonify(all_questions), 200

    except FileNotFoundError:
        print(f"Question file not found for {subject}/{level_name} at path: {questions_file_path}")
        return jsonify([]), 200
    except Exception as e:
        print(f"CRITICAL Error reading questions for {subject}/{level_name}: {e}")
        return jsonify({"message": "An error occurred while fetching questions."}), 500


@questions_bp.route('/', methods=['POST'])
def add_new_question():
    data = request.get_json()
    if not data:
        return jsonify({"message": "Request must be JSON"}), 400

    subject = data.get('subject')
    level = data.get('level')
    new_question = data.get('newQuestion')

    if not all([subject, level, new_question, new_question.get('id')]):
        return jsonify({"message": "Subject, level, and question data with an ID are required."}), 400

    # This path is also corrected to match the universal structure
    file_path = QUESTIONS_BASE_PATH / subject / f"level{level}" / "questions.json"

    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        questions = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                questions = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
       
        if any(q.get('id') == new_question.get('id') for q in questions):
            return jsonify({"message": f"Question with ID '{new_question['id']}' already exists."}), 409

        questions.append(new_question)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2)

        return jsonify({"message": "Question added successfully."}), 201

    except Exception as e:
        print(f"Error uploading question: {e}")
        return jsonify({"message": "Failed to upload question."}), 500
   
@questions_bp.route('/all/<string:subject>/<int:level>', methods=['GET'])
def get_all_questions_for_admin(subject, level):
    """
    GET ALL questions for a specific subject/level, WITHOUT sampling.
    This is intended for the admin 'View Questions' page.
    """
    level_name = f"level{level}"
    questions_file_path = QUESTIONS_BASE_PATH / subject / level_name / "questions.json"

    print(f"ADMIN FETCH: Attempting to read all questions from: {questions_file_path}")

    try:
        with open(questions_file_path, 'r', encoding='utf-8') as f:
            all_questions = json.load(f)
       
        print(f"ADMIN FETCH: Success! Found {len(all_questions)} questions.")
        return jsonify(all_questions), 200

    except FileNotFoundError:
        print(f"ADMIN FETCH: File not found for {subject}/{level_name}")
        return jsonify([]), 200 # Return empty list if file doesn't exist
    except Exception as e:
        print(f"ADMIN FETCH: CRITICAL Error reading questions: {e}")
        return jsonify({"message": "An error occurred while fetching questions."}), 500

@questions_bp.route('/question-counts', methods=['GET'])
def get_subject_question_counts():
    """
    Get all subjects with their levels and question counts for display in admin table.
    Returns dynamic data that adapts to any number of levels.
    """
    try:
        # Read course configuration to get all subjects and their levels
        if not COURSE_CONFIG_PATH.exists():
            return jsonify({"message": "Course configuration file not found."}), 404
           
        with open(COURSE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            course_config = json.load(f)
       
        result = {}
       
        for subject, config in course_config.items():
            if not isinstance(config, dict):
                continue
               
            subject_data = {
                "title": config.get("title", subject.replace("_", " ").title()),
                "levels": {},
                "total_questions": 0
            }
           
            # Get all levels for this subject
            levels = config.get("levels", [])
            for level_name in levels:
                questions_file_path = QUESTIONS_BASE_PATH / subject / level_name / "questions.json"
               
                question_count = 0
                if questions_file_path.exists():
                    try:
                        # Check if file is not empty
                        if questions_file_path.stat().st_size > 0:
                            with open(questions_file_path, 'r', encoding='utf-8') as f:
                                questions = json.load(f)
                                if isinstance(questions, list):
                                    question_count = len(questions)
                    except (json.JSONDecodeError, Exception) as e:
                        print(f"Warning: Could not read questions for {subject}/{level_name}: {e}")
                        question_count = 0
               
                subject_data["levels"][level_name] = question_count
                subject_data["total_questions"] += question_count
           
            result[subject] = subject_data
       
        return jsonify(result), 200
       
    except Exception as e:
        print(f"Error fetching subject question counts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Failed to fetch subject question counts: {str(e)}"}), 500

