
# backend/routes/admin.py

import traceback
import json
from pathlib import Path
from flask import Blueprint, request, jsonify
import bcrypt
import io
import csv
import pandas as pd
import tempfile
from pathlib import Path

# --- Flask Blueprint Setup ---
admin_bp = Blueprint('admin_api', __name__)

# --- Configuration ---
BASE_DIR = Path(__file__).parent.parent
USERS_FILE_PATH = BASE_DIR / "data" / "users.json"
QUESTIONS_BASE_PATH = BASE_DIR / "data" / "questions"
COURSE_CONFIG_PATH = BASE_DIR / "data" / "course_config.json"
PORTAL_CONFIG_PATH = BASE_DIR / "data" / "portal_config.json"

# --- PARSER LOGIC ---
def parse_nlp_excel(input_file, output_file):
    """
    Parses an Excel file for NLP questions using the test-case column format.
    This logic is the same as the DS and Deep Learning parsers.
    """
    df = pd.read_excel(input_file)
    tasks = []

    # Assuming Excel columns are 'id', 'title', 'description', 't1_input', 't1_output', etc.
    for _, row in df.iterrows():
        qid = str(row.get("id", "")).strip()
        if not qid:
            continue

        task = {
            "id": qid,
            "title": str(row.get("title", "")).strip(),
            "description": str(row.get("description", "")).strip(),
            "test_cases": []
        }

        # Dynamically find all test case columns
        i = 1
        while True:
            input_col = f"t{i}_input"
            output_col = f"t{i}_output"
           
            if input_col not in df.columns:
                break # Stop when no more test case columns are found
           
            # Check if there is a value for the input in the current row
            if pd.notna(row.get(input_col)):
                input_val = str(row[input_col]).strip()
                output_val = str(row.get(output_col, "")).strip()
               
                task["test_cases"].append({
                    "input": input_val,
                    "output": output_val
                })
            i += 1
       
        tasks.append(task)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)

    print(f"✅ Successfully converted NLP Excel file to {output_file}")
    return len(tasks)

def parse_deep_learning_excel(input_file, output_file):
    """
    Parses an Excel file for Deep Learning questions using the test-case column format (t1_input, t1_output, etc.).
    THIS FUNCTION USES THE EXACT LOGIC YOU PROVIDED.
    """
    df = pd.read_excel(input_file)
    tasks = []

    for _, row in df.iterrows():
        qid = str(row.get("id", "")).strip()
        if not qid:
            continue

        task = {
            "id": qid,
            "title": str(row.get("title", "")).strip(),
            "description": str(row.get("description", "")).strip(),
            "test_cases": []
        }

        # Loop through columns to extract t1_input, t1_output, t2_input, ...
        # This is the custom logic you specified.
        for col in df.columns:
            if "_input" in col:
                case_num_str = ''.join(filter(str.isdigit, col)) # Extracts the number from 't1_input', etc.
                if not case_num_str: continue

                case_prefix = f"t{case_num_str}" # Reconstructs 't1', 't2', etc.
                input_col_name = f"{case_prefix}_input"
                output_col_name = f"{case_prefix}_output"

                # Check if the row actually has a value for this input column
                if pd.notna(row.get(input_col_name)):
                    input_val = str(row[input_col_name]).strip()
                    output_val = str(row.get(output_col_name, "")).strip()
                   
                    task["test_cases"].append({
                        "input": input_val,
                        "output": output_val
                    })

        tasks.append(task)

    # Save JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)

    print(f"✅ Successfully converted Deep Learning Excel file to {output_file}")
    return len(tasks)

def parse_ml_excel(input_file, output_file):
    """
    (This function is unchanged)
    Parses a standardized Excel file for multi-part ML questions.
    """
    if str(input_file).lower().endswith(".csv"):
        df = pd.read_csv(input_file, on_bad_lines="skip")
    else:
        df = pd.read_excel(input_file)
    tasks = {}
    for _, row in df.iterrows():
        task_id = str(row.get("id", "")).strip()
        if not task_id: continue
        if task_id not in tasks:
            tasks[task_id] = {
                "id": task_id, "title": str(row.get("title", "")).strip(),
                "description": str(row.get("description", "")).strip(),
                "datasets": {}, "parts": []
            }
        if pd.notna(row.get("train_dataset")): tasks[task_id]["datasets"]["train"] = str(row.get("train_dataset")).strip()
        if pd.notna(row.get("test_dataset")): tasks[task_id]["datasets"]["test"] = str(row.get("test_dataset")).strip()
        part_id = str(row.get("part_id", "")).strip()
        if part_id:
            part = {
                "part_id": part_id, "type": str(row.get("type", "")).strip(),
                "description": str(row.get("part_description", "")).strip()
            }
            if pd.notna(row.get("expected_text")): part["expected_text"] = str(row.get("expected_text")).strip()
            if pd.notna(row.get("evaluation_label")): part["evaluation_label"] = str(row.get("evaluation_label")).strip()
            if pd.notna(row.get("placeholder_filename")): part["placeholder_filename"] = str(row.get("placeholder_filename")).strip()
            if pd.notna(row.get("solution_file")): part["solution_file"] = str(row.get("solution_file")).strip()
            if pd.notna(row.get("key_columns")): part["key_columns"] = [c.strip() for c in str(row.get("key_columns")).split(",") if c.strip()]
            for field in ["expected_value", "similarity_threshold", "tolerance"]:
                if pd.notna(row.get(field)):
                    try: part[field] = float(row.get(field))
                    except (ValueError, TypeError): pass
            tasks[task_id]["parts"].append(part)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(list(tasks.values()), f, indent=2, ensure_ascii=False)
    print(f"✅ Successfully converted ML Excel file to {output_file}")
    return len(tasks)

def parse_ds_excel(input_file, output_file):
    """
    (This function is unchanged)
    Parses a standardized Excel file for DS questions with test cases.
    """
    df = pd.read_excel(input_file)
    result = []
    for q_id, group in df.groupby("id"):
        first_row = group.iloc[0]
        test_cases = [{"input": str(row["input"]), "output": str(row["output"])} for _, row in group.iterrows()]
        result.append({
            "id": str(first_row["id"]), "title": str(first_row["title"]),
            "description": str(first_row["description"]), "test_cases": test_cases
        })
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"✅ Successfully converted DS Excel file to {output_file}")
    return len(result)

def parse_speech_recognition_excel(input_file, output_file):
    """
    (This is the new parser you provided)
    Parses an Excel file for Speech Recognition questions.
    """
    BASE_DATA_PATH = BASE_DIR / "data"
    DATASETS_BASE_PATH = BASE_DATA_PATH / "datasets"
   
    df = pd.read_excel(input_file)
    tasks = []
    for _, row in df.iterrows():
        input_filename = str(row.get("Input File", "")).strip()
        if input_filename:
            input_path = str((DATASETS_BASE_PATH / "Speech-Recognition" / "input" / input_filename).resolve())
        else:
            input_path = ""
        output_files_str = str(row.get("Output File", "")).strip()
        if output_files_str:
            output_files = [str((DATASETS_BASE_PATH / "Speech-Recognition" / "solution" / f.strip()).resolve()) for f in output_files_str.split(",")]
        else:
            output_files = []
        task = {
            "id": str(row.get("S.No", "")).strip(),
            "title": str(row.get("Scenario", "")).strip(),
            "description": str(row.get("Task", "")).strip(),
            "datasets": {"input_file": input_path},
            "parts": [{
                "part_id": str(row.get("S.No", "")).strip(),
                "type": "csv_similarity",
                "description": str(row.get("Task", "")).strip(),
                "solution_file": output_files if len(output_files) > 1 else (output_files[0] if output_files else "")
            }]
        }
        tasks.append(task)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)
    print(f"✅ Successfully converted Speech Recognition Excel to {output_file}")
    return len(tasks)

# --- Other helper functions (unchanged) ---
def _build_initial_progress():
    # ... (this function remains exactly the same)
    progress = {}
    if not QUESTIONS_BASE_PATH.exists(): return progress
    for subject_path in QUESTIONS_BASE_PATH.iterdir():
        if subject_path.is_dir():
            subject_name = subject_path.name
            levels = [p.name for p in subject_path.iterdir() if p.is_dir() and p.name.startswith('level')]
            if levels:
                progress[subject_name] = {}
                levels.sort(key=lambda name: int(name.replace('level', '')))
                for i, level_name in enumerate(levels):
                    progress[subject_name][level_name] = "unlocked" if i == 0 else "locked"
    return progress

def _update_all_users_with_new_subject(subject_name, num_levels):
    # ... (this function remains exactly the same)
    try:
        with open(USERS_FILE_PATH, 'r+', encoding='utf-8') as f:
            users_data = json.load(f)
            users_list = users_data.get("users", [])
            for user in users_list:
                if 'progress' not in user: user['progress'] = {}
                if subject_name not in user['progress']:
                    user['progress'][subject_name] = { f"level{i}": "unlocked" if i == 1 else "locked" for i in range(1, num_levels + 1) }
            f.seek(0)
            json.dump(users_data, f, indent=2)
            f.truncate()
        return True
    except Exception as e:
        print(f"Error updating users with new subject: {e}")
        return False

# --- Admin Routes ---
@admin_bp.route('/upload-questions', methods=['POST'])
def upload_questions_excel():
    if 'file' not in request.files: return jsonify({"message": "No file part"}), 400
    file, subject, level = request.files['file'], request.form.get('subject'), request.form.get('level')

    if not all([file, subject, level]) or file.filename == '':
        return jsonify({"message": "File, subject, and level are required."}), 400

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        input_file = temp_path / file.filename
        output_json_file = temp_path / "processed_questions.json"
       
        try:
            file.save(input_file)
           
            # --- THIS IS THE UPDATED LOGIC ---
            # It now checks for the new Speech Recognition subject.
            if subject == 'ml':
                print(f"Processing '{file.filename}' with the ML parser...")
                num_questions = parse_ml_excel(str(input_file), str(output_json_file))
            elif subject == 'ds':
                print(f"Processing '{file.filename}' with the DS parser...")
                num_questions = parse_ds_excel(str(input_file), str(output_json_file))
            elif subject == 'Speech Recognition':
                print(f"Processing '{file.filename}' with the Speech Recognition parser...")
                num_questions = parse_speech_recognition_excel(str(input_file), str(output_json_file))
            elif subject == 'Deep Learning':
                print(f"Processing '{file.filename}' with the Deep Learning parser...")
                num_questions = parse_deep_learning_excel(str(input_file), str(output_json_file))
            elif subject == 'NLP':
                print(f"Processing '{file.filename}' with the NLP parser...")
                num_questions = parse_nlp_excel(str(input_file), str(output_json_file))
            else:
                return jsonify({"message": f"No parser available for subject: '{subject}'"}), 400

            with open(output_json_file, 'r', encoding='utf-8') as f:
                new_questions = json.load(f)
           
            level_dir_name = f"level{level}"
            final_json_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"
            final_json_path.parent.mkdir(parents=True, exist_ok=True)
            with open(final_json_path, 'w', encoding='utf-8') as f:
                json.dump(new_questions, f, indent=2)

            return jsonify({"message": f"Successfully processed and uploaded {num_questions} questions to {subject}/{level_dir_name}."}), 201

        except Exception as e:
            print(f"Error processing Excel file: {e}")
            return jsonify({"message": f"An error occurred during question upload: {str(e)}"}), 500

# --- Other routes (create-subject, add-level, upload-users) are unchanged ---
@admin_bp.route('/create-subject', methods=['POST'])
def create_subject():
    # ... (this function remains exactly the same)
    data = request.get_json()
    subject_name, num_levels = data.get('subjectName'), data.get('numLevels', 0)
    if not subject_name or not isinstance(num_levels, int) or num_levels < 1:
        return jsonify({"message": "Valid subject name and number of levels are required."}), 400
    try:
        with open(COURSE_CONFIG_PATH, 'r+', encoding='utf-8') as f:
            course_config = json.load(f)
            if subject_name in course_config:
                return jsonify({"message": f"Subject '{subject_name}' already exists."}), 409
            question_limits_per_level = {f"level{i}": 5 for i in range(1, num_levels + 1)}
            course_config[subject_name] = {
                "title": subject_name.replace("_", " ").title(), "isActive": True,
                "levels": [f"level{i}" for i in range(1, num_levels + 1)], "question_limit": question_limits_per_level
            }
            f.seek(0)
            json.dump(course_config, f, indent=2)
            f.truncate()
        for i in range(1, num_levels + 1):
            level_path = QUESTIONS_BASE_PATH / subject_name / f"level{i}"
            level_path.mkdir(parents=True, exist_ok=True)
            (level_path / "questions.json").write_text("[]", encoding="utf-8")
        if not _update_all_users_with_new_subject(subject_name, num_levels):
            raise Exception("Failed to update users file.")
        return jsonify({"message": f"Subject '{subject_name}' created successfully."}), 201
    except Exception as e:
        print(f"Error creating subject: {e}")
        return jsonify({"message": f"Failed to create subject: {str(e)}"}), 500

@admin_bp.route('/add-level', methods=['POST'])
def add_level_to_subject():
    # ... (this function remains exactly the same)
    subject_name = request.get_json().get('subjectName')
    if not subject_name:
        return jsonify({"message": "Subject name is required."}), 400
    try:
        with open(COURSE_CONFIG_PATH, 'r+', encoding='utf-8') as f:
            course_config = json.load(f)
            if subject_name not in course_config:
                return jsonify({"message": f"Subject '{subject_name}' not found."}), 404
            existing_levels = course_config[subject_name].get("levels", [])
            new_level_name = f"level{len(existing_levels) + 1}"
            course_config[subject_name]["levels"].append(new_level_name)
            if 'question_limit' in course_config[subject_name] and isinstance(course_config[subject_name]['question_limit'], dict):
                course_config[subject_name]['question_limit'][new_level_name] = 5
            f.seek(0)
            json.dump(course_config, f, indent=2)
            f.truncate()
        level_path = QUESTIONS_BASE_PATH / subject_name / new_level_name
        level_path.mkdir(parents=True, exist_ok=True)
        (level_path / "questions.json").write_text("[]", encoding="utf-8")
        with open(USERS_FILE_PATH, 'r+', encoding='utf-8') as f:
            users_data = json.load(f)
            for user in users_data.get("users", []):
                if user.get("role") == "student" and subject_name in user.get("progress", {}):
                    user["progress"][subject_name][new_level_name] = "locked"
            f.seek(0)
            json.dump(users_data, f, indent=2)
            f.truncate()
        return jsonify({"message": f"Successfully added {new_level_name} to {subject_name}."}), 201
    except Exception as e:
        print(f"Error adding new level: {e}")
        return jsonify({"message": f"Failed to add level: {str(e)}"}), 500

@admin_bp.route('/upload-users', methods=['POST'])
def upload_users():
    # ... (this function remains exactly the same)
    if 'file' not in request.files: return jsonify({"message": "No file part in the request"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"message": "No file selected for uploading"}), 400
    try:
        with open(USERS_FILE_PATH, 'r+', encoding='utf-8') as f:
            users_json, created_count, skipped_count = json.load(f), 0, 0
            existing_usernames = {u['username'] for u in users_json.get("users", [])}
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            for row in csv_reader:
                username, password, role = row.get('username'), row.get('password'), row.get('role', 'student')
                if not username or not password or username in existing_usernames:
                    skipped_count += 1
                    continue
                hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
                new_user = {"username": username, "password": hashed.decode('utf-8'), "role": role,
                            "progress": _build_initial_progress() if role == 'student' else {}}
                users_json["users"].append(new_user)
                existing_usernames.add(username)
                created_count += 1
            f.seek(0)
            json.dump(users_json, f, indent=2)
            f.truncate()
        return jsonify({"message": f"Upload complete. Created {created_count} new users. Skipped {skipped_count}."}), 201
    except Exception as e:
        print(f"Error during user upload: {e}")
        return jsonify({"message": f"An error occurred during user upload: {e}"}), 500
   
@admin_bp.route('/add-question', methods=['POST'])
def add_single_question():
    """
    Adds a single, new question from a form to an existing questions.json file,
    AUTOMATICALLY generating the new question ID.
    """
    data = request.get_json()
    subject = data.get('subject')
    level = data.get('level')
    new_question = data.get('newQuestion')

    if not all([subject, level, new_question]):
        return jsonify({"message": "Subject, level, and question data are required."}), 400

    # The 'id' is no longer required from the frontend, but title and description are.
    if not all([new_question.get('title'), new_question.get('description')]):
        return jsonify({"message": "Question Title and Description are required."}), 400

    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        # Create the directory structure if it doesn't exist
        questions_file_path.parent.mkdir(parents=True, exist_ok=True)

        # Read existing questions (create empty array if file doesn't exist)
        questions_list = []
        if questions_file_path.exists() and questions_file_path.stat().st_size > 0:
            try:
                with open(questions_file_path, 'r', encoding='utf-8') as f:
                    questions_list = json.load(f)
            except json.JSONDecodeError:
                questions_list = []
       
        # --- START: AUTO-INCREMENT LOGIC ---
        if not questions_list:
            new_id = 1
        else:
            # Find all existing numeric IDs, find the max, and add 1
            numeric_ids = [int(q['id']) for q in questions_list if str(q.get('id', '')).isdigit()]
            max_id = max(numeric_ids) if numeric_ids else 0
            new_id = max_id + 1
       
        # Assign the new, auto-incremented ID (as a string)
        new_question['id'] = str(new_id)
        # --- END: AUTO-INCREMENT LOGIC ---

        questions_list.append(new_question)
       
        # Write updated questions back to file
        with open(questions_file_path, 'w', encoding='utf-8') as f:
            json.dump(questions_list, f, indent=2, ensure_ascii=False)

        return jsonify({"message": f"Successfully added question '{new_question['title']}' with new ID '{new_question['id']}' to {subject}/{level_dir_name}."}), 201

    except Exception as e:
        print(f"Error adding single question: {e}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/delete-question/<string:subject>/<int:level>/<string:question_id>', methods=['DELETE'])
def delete_question(subject, level, question_id):
    """
    Deletes a question from the questions.json file by ID.
    """
    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        if not questions_file_path.exists():
            return jsonify({"message": f"Questions file for {subject}/{level_dir_name} not found."}), 404

        # Read existing questions
        questions_list = []
        if questions_file_path.stat().st_size > 0:
            try:
                with open(questions_file_path, 'r', encoding='utf-8') as f:
                    questions_list = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"message": "Invalid JSON in questions file."}), 500

        # Find and remove the question
        initial_count = len(questions_list)
        questions_list = [q for q in questions_list if q.get('id') != question_id]
       
        if len(questions_list) == initial_count:
            return jsonify({"message": f"Question with ID '{question_id}' not found."}), 404

        # Write updated questions back to file
        with open(questions_file_path, 'w', encoding='utf-8') as f:
            json.dump(questions_list, f, indent=2, ensure_ascii=False)

        return jsonify({"message": f"Question '{question_id}' deleted successfully."}), 200

    except Exception as e:
        print(f"Error deleting question: {e}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500
   
@admin_bp.route('/add-ml-question', methods=['POST'])
def add_ml_question():
    try:
        # Define base paths using pathlib for consistency
        BASE_DATA_PATH = BASE_DIR / "data"
        QUESTIONS_BASE_PATH = BASE_DATA_PATH / "questions"
        DATASETS_BASE_PATH = BASE_DATA_PATH / "datasets"

        # 1. Get and validate form data
        subject = request.form.get('subject')
        level = request.form.get('level')
        title = request.form.get('title')
        description = request.form.get('description')
        parts_json = request.form.get('parts')
       
        if not all([subject, level, title, description, parts_json]):
            return jsonify({'message': 'Missing required fields'}), 400
       
        try:
            parts_data = json.loads(parts_json)
        except json.JSONDecodeError as e:
            return jsonify({'message': f'Invalid parts JSON: {str(e)}'}), 400
       
        # 2. Load existing questions to generate the new ID first
        level_dir_name = f"level{level}"
        questions_file = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"
       
        questions_file.parent.mkdir(parents=True, exist_ok=True)
       
        questions_data = []
        if questions_file.exists() and questions_file.stat().st_size > 0:
            with open(questions_file, 'r', encoding='utf-8') as f:
                try:
                    questions_data = json.load(f)
                except json.JSONDecodeError:
                    pass

        # 3. Generate a new, unique ID for the question (e.g., ML_001)
        prefix = ''.join([word[0].upper() for word in subject.split('-')]) if subject else 'Q'
        numeric_ids = [
            int(q['id'].split('_')[1]) for q in questions_data
            if q.get('id', '').startswith(f'{prefix}_') and q['id'].split('_')[1].isdigit()
        ]
        new_id_num = max(numeric_ids) + 1 if numeric_ids else 1
        new_question_id = f"{prefix}_{new_id_num:03d}"
       
        # 4. Create the dedicated assets directory using the new ID
        question_assets_path = DATASETS_BASE_PATH / subject / f"level_{level}" / new_question_id
        question_assets_path.mkdir(parents=True, exist_ok=True)
       
        # 5. Save train, test, and solution files to the new directory
        train_file = request.files.get('train_file')
        test_file = request.files.get('test_file')
       
        train_path = None
        test_path = None
       
        if train_file and train_file.filename:
            train_path_obj = question_assets_path / 'train.csv'
            train_file.save(train_path_obj)
            train_path = str(train_path_obj.resolve())
       
        if test_file and test_file.filename:
            test_path_obj = question_assets_path / 'test.csv'
            test_file.save(test_path_obj)
            test_path = str(test_path_obj.resolve())
       
        for idx, part in enumerate(parts_data):
            if part.get('has_solution_file'):
                solution_file_key = part.get('solution_file_key')
                solution_file = request.files.get(solution_file_key)
               
                if solution_file and solution_file.filename:
                    solution_filename = f"solution_{part.get('part_id', idx)}.csv"
                    solution_path_obj = question_assets_path / solution_filename
                    solution_file.save(solution_path_obj)
                    part['solution_file'] = str(solution_path_obj.resolve())
               
                part.pop('has_solution_file', None)
                part.pop('solution_file_key', None)
       
        # 6. Build the final question object
        new_question = {
            'id': new_question_id,
            'title': title,
            'description': description,
            'datasets': {},
            'parts': parts_data
        }
       
        if train_path:
            new_question['datasets']['train'] = train_path
        if test_path:
            new_question['datasets']['test'] = test_path
       
        # 7. Add question to the list and save back to the file
        questions_data.append(new_question)
       
        with open(questions_file, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, indent=2, ensure_ascii=False)
       
        return jsonify({
            'message': f'ML question "{title}" added successfully with ID {new_question_id}'
        }), 201 # Use 201 Created for success
       
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500


@admin_bp.route('/add-image-question', methods=['POST'])
def add_image_question():
    try:
        # CORRECTED: Use the correct base path
        BASE_DATA_PATH = BASE_DIR / "data"
        QUESTIONS_BASE_PATH = BASE_DATA_PATH / "questions"
        DATASETS_BASE_PATH = BASE_DATA_PATH / "datasets"

        # 1. Get form data
        data = request.form
        subject = data.get('subject')
        level = data.get('level')
        title = data.get('title')
        description = data.get('description')
        no_of_outputs = int(data.get('No_of_outputs', 0))
        compare_similarity = float(data.get('compare_similarity', 0.8))
        starter_code = data.get('starter_code', '')

        if not all([subject, level, title, description]):
            return jsonify({'message': 'Missing required fields'}), 400

        # 2. Load existing questions to generate the new ID first
        level_dir_name = f"level{level}"
        questions_file = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"
       
        # This will now create directories inside /home/bit/..., which is allowed
        questions_file.parent.mkdir(parents=True, exist_ok=True)
       
        questions_data = []
        if questions_file.exists() and questions_file.stat().st_size > 0:
            with open(questions_file, 'r', encoding='utf-8') as f:
                try:
                    questions_data = json.load(f)
                except json.JSONDecodeError:
                    pass

        # 3. Generate a new, unique ID for the question (e.g., IP_001)
        prefix = ''.join([word[0].upper() for word in subject.split('-')]) if subject else 'Q'
        numeric_ids = [
            int(q['id'].split('_')[1]) for q in questions_data
            if q.get('id', '').startswith(f'{prefix}_') and q['id'].split('_')[1].isdigit()
        ]
        new_id_num = max(numeric_ids) + 1 if numeric_ids else 1
        new_question_id = f"{prefix}_{new_id_num:03d}"

        # 4. Create the dedicated assets directory using the new ID
        question_assets_path = DATASETS_BASE_PATH / subject/ f"level_{level}" / new_question_id
        question_assets_path.mkdir(parents=True, exist_ok=True)

        # 5. Save uploaded files to the new directory
        files = request.files
        saved_file_paths = {}

        if 'input_image' in files:
            input_image = files['input_image']
            input_ext = Path(input_image.filename).suffix
            input_image_path = question_assets_path / f"input{input_ext}"
            input_image.save(input_image_path)
            saved_file_paths['input_image'] = str(input_image_path.resolve())
        else:
            return jsonify({'message': 'Input image is required'}), 400

        for i in range(1, no_of_outputs + 1):
            file_key = f'output_{i}'
            if file_key in files:
                output_file = files[file_key]
                output_ext = Path(output_file.filename).suffix
                output_filename = f"output{i}{output_ext}"
                output_file_path = question_assets_path / output_filename
                output_file.save(output_file_path)
                saved_file_paths[file_key] = str(output_file_path.resolve())
            else:
                 return jsonify({'message': f'Output image {i} is missing'}), 400

        # 6. Construct the new question JSON object
        new_question = {
            "id": new_question_id,
            "title": title,
            "description": description,
            "No_of_outputs": str(no_of_outputs),
            "compare_similarity": compare_similarity,
            "datasets": {
                "input_image": saved_file_paths.get('input_image')
            },
            "starter_code": starter_code
        }
       
        for i in range(1, no_of_outputs + 1):
            new_question[f'output_{i}'] = saved_file_paths.get(f'output_{i}')

        # 7. Append and save to questions.json
        questions_data.append(new_question)
        with open(questions_file, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, indent=2, ensure_ascii=False)

        return jsonify({
            'message': f'Image processing question "{title}" added successfully with ID {new_question_id}'
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'message': 'An internal server error occurred',
            'error': str(e)
        }), 500
   
@admin_bp.route('/delete-question/<subject>/<level>/<question_id>', methods=['DELETE'])
def delete_single_question(subject, level, question_id):
    """
    Finds a question by its ID within a specific subject/level file and deletes it.
    """
    if not all([subject, level, question_id]):
        return jsonify({"message": "Subject, level, and question ID are required."}), 400

    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        if not questions_file_path.exists():
            return jsonify({"message": f"Questions file for {subject}/{level_dir_name} not found."}), 404

        with open(questions_file_path, 'r+', encoding='utf-8') as f:
            try:
                questions_list = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"message": "Could not parse the questions file."}), 500

            original_length = len(questions_list)
            updated_questions_list = [q for q in questions_list if str(q.get('id')) != str(question_id)]
           
            if len(updated_questions_list) == original_length:
                return jsonify({"message": f"Question with ID '{question_id}' not found."}), 404

            f.seek(0)
            json.dump(updated_questions_list, f, indent=2, ensure_ascii=False)
            f.truncate()

        return jsonify({"message": f"Successfully deleted question with ID '{question_id}'."}), 200

    except Exception as e:
        print(f"Error deleting single question: {e}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500
@admin_bp.route('/questions/all/<subject>/<level>', methods=['GET'])
def get_all_questions_for_level(subject, level):
    if not subject or not level:
        return jsonify({"message": "Subject and level are required."}), 400
    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        if not questions_file_path.exists():
            return jsonify([]), 200 # Return empty list if no file, not an error

        # Check if file is empty
        if questions_file_path.stat().st_size == 0:
            return jsonify([]), 200 # Return empty list if file is empty

        with open(questions_file_path, 'r', encoding='utf-8') as f:
            try:
                questions = json.load(f)
            except json.JSONDecodeError as e:
                # If JSON parsing fails (e.g., file has only whitespace), return empty array
                print(f"Warning: Invalid JSON in {questions_file_path}, returning empty array. Error: {e}")
                return jsonify([]), 200
       
        # Ensure questions is a list
        if not isinstance(questions, list):
            return jsonify([]), 200
       
        return jsonify(questions), 200
    except Exception as e:
        print(f"Error fetching all questions for admin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500

@admin_bp.route('/update-question', methods=['PUT'])
def update_single_question():
    """
    Finds a question by its ID within a specific subject/level file and updates it.
    """
    data = request.get_json()
    subject = data.get('subject')
    level = data.get('level')
    updated_question = data.get('updatedQuestion')

    if not all([subject, level, updated_question, updated_question.get('id')]):
        return jsonify({"message": "Subject, level, and updated question data (including ID) are required."}), 400

    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        if not questions_file_path.exists():
            return jsonify({"message": f"Questions file for {subject}/{level_dir_name} not found."}), 404

        with open(questions_file_path, 'r+', encoding='utf-8') as f:
            try:
                questions_list = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"message": "Could not parse the questions file."}), 500

            question_index = -1
            for i, q in enumerate(questions_list):
                if str(q.get('id')) == str(updated_question.get('id')):
                    question_index = i
                    break
           
            if question_index == -1:
                return jsonify({"message": f"Question with ID '{updated_question.get('id')}' not found."}), 404

            questions_list[question_index] = updated_question
           
            f.seek(0)
            json.dump(questions_list, f, indent=2, ensure_ascii=False)
            f.truncate()

        return jsonify({"message": f"Successfully updated question with ID '{updated_question.get('id')}'."}), 200

    except Exception as e:
        print(f"Error updating single question: {e}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500
   
@admin_bp.route('/add-ds-question', methods=['POST'])
def add_ds_question():
    try:
        BASE_DATA_PATH = BASE_DIR / "data"
        QUESTIONS_BASE_PATH = BASE_DATA_PATH / "questions"
        DATASETS_BASE_PATH = BASE_DATA_PATH / "datasets"

        # 1. Get and validate form data
        subject = request.form.get('subject')
        level = request.form.get('level')
        title = request.form.get('title')
        description = request.form.get('description')
        page_link = request.form.get('page_link_that_need_to_be_scrapped', '')
        parts_json = request.form.get('parts')
       
        if not all([subject, level, title, description, parts_json]):
            return jsonify({'message': 'Missing required fields'}), 400
       
        try:
            parts_data = json.loads(parts_json)
        except json.JSONDecodeError as e:
            return jsonify({'message': f'Invalid parts JSON: {str(e)}'}), 400
       
        # 2. Load existing questions to generate the new ID first
        level_dir_name = f"level{level}"
        questions_file = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"
       
        questions_file.parent.mkdir(parents=True, exist_ok=True)
       
        questions_data = []
        if questions_file.exists() and questions_file.stat().st_size > 0:
            with open(questions_file, 'r', encoding='utf-8') as f:
                try:
                    questions_data = json.load(f)
                except json.JSONDecodeError:
                    pass # Keep questions_data as an empty list
       
        # 3. Generate a new, unique ID for the question
        # Prefix is based on the subject (e.g., 'ds' -> 'DS')
        prefix = ''.join([word[0].upper() for word in subject.split('-')]) if subject else 'Q'
        numeric_ids = [
            int(q['id'].split('_')[1]) for q in questions_data
            if q.get('id', '').startswith(f'{prefix}_') and q['id'].split('_')[1].isdigit()
        ]
        new_id_num = max(numeric_ids) + 1 if numeric_ids else 1
        new_question_id = f"{prefix}_{new_id_num:03d}"

        # 4. Create the dedicated assets directory using the new ID
        # This now matches the desired structure
        question_assets_path = DATASETS_BASE_PATH / subject / f"level_{level}" / new_question_id
        question_assets_path.mkdir(parents=True, exist_ok=True)
       
        # 5. Process parts and save solution files to the new directory
        for idx, part in enumerate(parts_data):
            if part.get('has_solution_file'):
                solution_file_key = part.get('solution_file_key')
                solution_file = request.files.get(solution_file_key)
               
                if solution_file and solution_file.filename:
                    solution_filename = f"solution_{part.get('part_id', idx)}.csv"
                    solution_path = question_assets_path / solution_filename
                    solution_file.save(str(solution_path))
                    # Store the absolute path in the question data
                    part['solution_file'] = str(solution_path.resolve())
               
                # Clean up temporary keys
                part.pop('has_solution_file', None)
                part.pop('solution_file_key', None)
       
        # 6. Build the final question object
        new_question = {
            'id': new_question_id,
            'title': title,
            'description': description,
            'page_link_that_need_to_be_scrapped': page_link,
            'parts': parts_data
        }
       
        # 7. Add the new question and save back to the JSON file
        questions_data.append(new_question)
        with open(questions_file, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, indent=2, ensure_ascii=False)
       
        return jsonify({
            'message': f'DS question "{title}" added successfully with ID {new_question_id}'
        }), 201 # Use 201 Created for successful resource creation
       
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500



# The FIX is here -> methods=['POST']
@admin_bp.route('/add-speech-question', methods=['POST'])
def add_speech_question():
    """
    Handles adding a new speech recognition question, including file uploads.
    This function is designed to be added to an existing Flask Blueprint.
    """
    try:
        BASE_DATA_PATH = BASE_DIR / "data"
        # Define paths based on the main configuration path
        QUESTIONS_BASE_PATH = BASE_DATA_PATH / "questions"
        DATASETS_BASE_PATH = BASE_DATA_PATH / "datasets"

        # 1. Get and validate form data from the request
        subject = request.form.get('subject')
        level = request.form.get('level')
        title = request.form.get('title')
        description = request.form.get('description')
        input_file = request.files.get('input_file')
        solution_file = request.files.get('solution_file')

        if not all([subject, level, title, description, input_file, solution_file]):
            return jsonify({'message': 'Missing required form fields or files'}), 400
       
        # ### File extension validation can be made more generic if needed ###
        # Example for handling different subjects:
        # allowed_input_extensions = {
        #     'speech-recognition': ['.wav'],
        #     'image-processing': ['.jpg', '.jpeg', '.png']
        # }
        # if not any(input_file.filename.lower().endswith(ext) for ext in allowed_input_extensions.get(subject, [])):
        #     return jsonify({'message': f'Invalid input file type for {subject}'}), 400

        if subject == 'speech-recognition' and not input_file.filename.lower().endswith('.wav'):
            return jsonify({'message': 'Input file must be a .wav audio file'}), 400
           
        if not solution_file.filename.lower().endswith('.csv'):
            return jsonify({'message': 'Solution file must be a .csv file'}), 400

        # 2. Load questions data to generate the new question ID first
        level_dir_name = f"level{level}"
        questions_file = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"
       
        questions_file.parent.mkdir(parents=True, exist_ok=True)
       
        questions_data = []
        if questions_file.exists() and questions_file.stat().st_size > 0:
            with open(questions_file, 'r', encoding='utf-8') as f:
                try:
                    questions_data = json.load(f)
                except json.JSONDecodeError:
                    pass

        # 3. Generate a unique ID (e.g., SR_001, IP_001)
        # This is moved up to be available for the directory path
        prefix = ''.join([word[0].upper() for word in subject.split('-')])
        numeric_ids = [
            int(q['id'].split('_')[1]) for q in questions_data
            if q.get('id', '').startswith(f'{prefix}_') and q['id'].split('_')[1].isdigit()
        ]
        new_id_num = max(numeric_ids) + 1 if numeric_ids else 1
        new_question_id = f"{prefix}_{new_id_num:03d}"

        # 4. Create a dedicated directory for the question's assets
        # The path now uses the subject and the new question ID
        question_assets_path = DATASETS_BASE_PATH / subject / f"level_{level}" / new_question_id
        question_assets_path.mkdir(parents=True, exist_ok=True)

        # 5. Save the uploaded audio and solution files
        # The input file extension is preserved
        input_extension = Path(input_file.filename).suffix
        input_file_path = question_assets_path / f"input{input_extension}"
        solution_file_path = question_assets_path / "solution.csv"
       
        input_file.save(str(input_file_path))
        solution_file.save(str(solution_file_path))

        # 6. Build the new question object using the specified JSON structure
        new_question = {
            'id': new_question_id,
            'title': title,
            'description': description,
            'datasets': {
                'input_file': str(input_file_path.resolve())
            },
            'parts': [{
                "part_id": "1",
                "type": "csv_similarity",
                "description": description,
                "solution_file": str(solution_file_path.resolve())
            }]
        }

        # 7. Append new question and write back to the file
        questions_data.append(new_question)
        with open(questions_file, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, indent=2, ensure_ascii=False)
       
        return jsonify({
            'message': f'Question "{title}" added successfully for subject "{subject}" with ID {new_question["id"]}'
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500
   
@admin_bp.route('/update-validation-status', methods=['PUT'])
def update_validation_status():
    """
    Updates a single question in a JSON file to mark its validation status.
    """
    data = request.get_json()
    subject = data.get('subject')
    level = data.get('level')
    question_id = data.get('questionId')
    is_validated = data.get('isValidated')

    if not all([subject, level, question_id]) or not isinstance(is_validated, bool):
        return jsonify({"message": "Subject, level, questionId, and a boolean isValidated status are required."}), 400

    try:
        level_dir_name = f"level{level}"
        questions_file_path = QUESTIONS_BASE_PATH / subject / level_dir_name / "questions.json"

        if not questions_file_path.exists():
            return jsonify({"message": f"Questions file for {subject}/{level_dir_name} not found."}), 404

        with open(questions_file_path, 'r+', encoding='utf-8') as f:
            try:
                questions_list = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"message": "Could not parse the questions file."}), 500

            question_found = False
            for question in questions_list:
                # Handle simple questions (ds, dl, etc.)
                if str(question.get('id')) == str(question_id):
                    question['isValidated'] = is_validated
                    question_found = True
                    break
                # Handle complex, multi-part questions (ml, speech)
                if 'parts' in question and isinstance(question['parts'], list):
                    for part in question['parts']:
                        # The frontend creates a unique ID like "TASKID_PARTID"
                        # We need to check if our question_id matches this format
                        combined_id = f"{question.get('id')}_{part.get('part_id')}"
                        if combined_id == str(question_id):
                           part['isValidated'] = is_validated
                           question_found = True
                           break
                    if question_found:
                        break
           
            if not question_found:
                return jsonify({"message": f"Question with ID '{question_id}' not found."}), 404

            # Write the entire updated list back to the file
            f.seek(0)
            json.dump(questions_list, f, indent=2, ensure_ascii=False)
            f.truncate()

        return jsonify({"message": f"Successfully updated validation status for question ID '{question_id}'."}), 200

    except Exception as e:
        print(f"Error updating validation status: {e}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500
   

#
# ==============================================================================
# <<< START: PORTAL MANAGEMENT >>>
# ==============================================================================
#
@admin_bp.route('/portal-settings', methods=['GET'])
def get_portal_settings():
    """
    Fetches the 'security' object from the course_config.json file.
    """
    try:
        with open(PORTAL_CONFIG_PATH, 'r', encoding='utf-8') as f:
            full_config = json.load(f)
       
        security_settings = full_config.get('security', {})
        return jsonify(security_settings), 200

    except FileNotFoundError:
        return jsonify({"message": "course_config.json not found."}), 404
    except Exception as e:
        print(f"Error reading portal settings: {e}")
        return jsonify({"message": "An error occurred while fetching portal settings."}), 500

@admin_bp.route('/portal-settings', methods=['POST'])
def update_portal_settings():
    """
    Updates the 'security' object in the course_config.json file.
    """
    new_security_settings = request.get_json()
    if not isinstance(new_security_settings, dict):
        return jsonify({"message": "Invalid data format. Expected a JSON object."}), 400

    try:
        with open(PORTAL_CONFIG_PATH, 'r', encoding='utf-8') as f:
            full_config = json.load(f)

        full_config['security'] = new_security_settings

        with open(PORTAL_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(full_config, f, indent=2)

        return jsonify({"message": "Portal security settings updated successfully."}), 200

    except FileNotFoundError:
        return jsonify({"message": "course_config.json not found."}), 404
    except Exception as e:
        print(f"Error updating portal settings: {e}")
        return jsonify({"message": "An error occurred while updating settings."}), 500

#
# ==============================================================================
# <<< END: PORTAL MANAGEMENT >>>
# ==============================================================================
#


# ==============================================================================
# <<< START: STUDENT PROGRESS MANAGEMENT >>>
# ==============================================================================
#
def _read_users_data():
    """Helper function to read the users data from the JSON file."""
    try:
        with open(USERS_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"users": []}

def _write_users_data(data):
    """Helper function to write the users data back to the JSON file."""
    with open(USERS_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

@admin_bp.route('/students', methods=['GET'])
def get_all_students():
    """Endpoint to get a list of all users who have the 'student' role."""
    try:
        all_data = _read_users_data()
        students = [user for user in all_data.get('users', []) if user.get('role') == 'student']
        return jsonify(students), 200
    except Exception as e:
        print(f"Error fetching students: {e}")
        return jsonify({"message": "An error occurred while fetching students."}), 500

@admin_bp.route('/students/<username>/progress', methods=['POST'])
def update_student_progress(username):
    """Endpoint to update the 'progress' object for a specific student."""
    new_progress_data = request.json.get('progress')
    if not new_progress_data:
        return jsonify({"message": "Progress data not provided in the request."}), 400
    try:
        all_data = _read_users_data()
        user_found = False
        for user in all_data.get('users', []):
            if user.get('username') == username and user.get('role') == 'student':
                user['progress'] = new_progress_data
                user_found = True
                break
        if user_found:
            _write_users_data(all_data)
            return jsonify({"message": f"Progress for student '{username}' updated successfully."}), 200
        else:
            return jsonify({"message": f"Student '{username}' not found."}), 404
    except Exception as e:
        print(f"Error updating student progress for {username}: {e}")
        return jsonify({"message": "An error occurred while updating student progress."}), 500



@admin_bp.route('/bulk-update-progress', methods=['POST'])
def bulk_update_student_progress():
    """
    Receives a list of usernames and a progress update,
    and applies it to all specified users.
    """
    data = request.get_json()
    usernames = data.get('usernames')
    subject = data.get('subject')
    level = data.get('level')
    status = data.get('status')

    if not all([usernames, subject, level, status]):
        return jsonify({"message": "Missing required fields: usernames, subject, level, status."}), 400

    try:
        # These helper functions already exist in your file
        all_data = _read_users_data()
        updated_count = 0
       
        usernames_to_update = set(usernames)

        for user in all_data.get('users', []):
            if user.get('username') in usernames_to_update:
                # Ensure progress structure exists before trying to update
                if 'progress' in user and subject in user['progress'] and level in user['progress'][subject]:
                    user['progress'][subject][level] = status
                    updated_count += 1

        _write_users_data(all_data)

        return jsonify({
            "message": f"Successfully updated {updated_count} of {len(usernames)} selected students."
        }), 200

    except Exception as e:
        print(f"Error during bulk update: {e}")
        return jsonify({"message": "An internal server error occurred during bulk update."}), 500
   
