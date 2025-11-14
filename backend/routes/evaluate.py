import json
import time
from pathlib import Path
from datetime import datetime
from flask import Blueprint, request, jsonify
from typing import Dict, Tuple, Union
from jupyter_client.manager import KernelManager, KernelClient
from queue import Empty
import pandas as pd
import numpy as np
import re
import subprocess
import tempfile
import os

evaluation_bp = Blueprint('evaluation_api', __name__)

QUESTIONS_BASE_PATH = Path(__file__).parent.parent / "data" / "questions"
SUBMISSIONS_PATH = Path(__file__).parent.parent / "data" / "submissions"
USERS_FILE_PATH = Path(__file__).parent.parent / "data" / "users.json"
USER_GENERATED_PATH = Path(__file__).parent.parent / "data" / "user_generated"
USER_KERNELS: Dict[str, Tuple[KernelManager, KernelClient]] = {}


# --- HELPER FUNCTIONS ---

def _simplify_python_error(stderr: str) -> str:
    """Extracts the most relevant lines from a Python traceback."""
    if not stderr:
        return ""
    
    lines = stderr.strip().split('\n')
    
    error_line_index = -1
    for i in range(len(lines) - 1, -1, -1):
        if re.search(r'^\w+Error:', lines[i].strip()):
            error_line_index = i
            break
            
    if error_line_index != -1:
        start_index = max(0, error_line_index - 1)
        simplified_lines = [re.sub(r'\x1b\[[0-9;]*m', '', line) for line in lines[start_index:error_line_index + 1]]
        return '\n'.join(simplified_lines)
    
    return '\n'.join(lines[-2:])

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Union, Tuple

def compare_csvs(student_path: Union[Path, str], solution_path: Union[Path, str], key_columns=None, threshold: float = 0.8, rtol: float = 1e-4, atol: float = 1e-6) -> Tuple[bool, float]:
    """
    Compares two CSV files cell-by-cell based on specific grading criteria.

    This function enforces a strict shape match between the student and solution files.
    - If shapes differ, it fails immediately.
    - For numerical cells, the student's value must be within 80% to 120% of the solution's value.
    - For non-numerical cells, values must match exactly.
    - The final score is the average of all cell scores (1 for a match, 0 for a mismatch).
    - The submission passes if the final average score meets or exceeds the threshold.

    Note: The `key_columns`, `rtol`, and `atol` parameters are ignored in this implementation
    to adhere to the specified cell-by-cell logic.
    """
    try:
        print("\n" + "="*80)
        print("CSV CUSTOM COMPARISON DETAILS (80%-120% Rule)")
        print("="*80)
        print(f"  STUDENT FILE  -> {student_path}")
        print(f"  SOLUTION FILE -> {solution_path}")
        print(f"  PASS THRESHOLD-> {threshold:.2f} (80% average score required to pass)")
        print(f"  NOTE: `key_columns`, `rtol`, `atol` are ignored by this grading logic.")
        print("-"*80)

        student_path, solution_path = Path(student_path), Path(solution_path)
        if not student_path.exists():
            print(f"DEBUG: Student file does not exist at {student_path}")
            return False, 0.0
        if not solution_path.exists():
            print(f"DEBUG: Solution file does not exist at {solution_path}")
            return False, 0.0

        df_student = pd.read_csv(student_path)
        df_solution = pd.read_csv(solution_path)

        # 1. Strict Shape Comparison (as requested)
        if df_student.shape != df_solution.shape:
            print(f"❌ FAILED: Shape Mismatch.")
            print(f"  - Student Shape:  {df_student.shape} (rows, cols)")
            print(f"  - Solution Shape: {df_solution.shape} (rows, cols)")
            print("="*80 + "\n")
            return False, 0.0

        # Handle case of empty but matching shape dataframes
        if df_solution.empty:
            print("✅ PASSED: Both CSVs are empty and have matching shapes.")
            print("="*80 + "\n")
            return True, 1.0

        matching_cells = 0
        total_cells = df_solution.size # total number of cells is rows * cols
        mismatched_examples = []

        # 2. Cell-by-Cell Comparison Loop
        for r_idx in range(df_solution.shape[0]):
            for c_idx in range(df_solution.shape[1]):
                sol_val = df_solution.iat[r_idx, c_idx]
                stu_val = df_student.iat[r_idx, c_idx]
                cell_matched = False

                # Try to compare as numbers first
                try:
                    # Coerce to float for comparison
                    sol_num = float(sol_val)
                    stu_num = float(stu_val)

                    if sol_num == 0:
                        # If solution is 0, student must be exactly 0
                        if stu_num == 0:
                            cell_matched = True
                    else:
                        # Apply the 80% to 120% rule for non-zero numbers
                        lower_bound = 0.80 * sol_num
                        upper_bound = 1.20 * sol_num
                        if lower_bound <= stu_num <= upper_bound:
                            cell_matched = True

                except (ValueError, TypeError):
                    # Fallback to string comparison if they are not both convertible to numbers
                    # Using str() to handle various dtypes like None, NaN, etc.
                    if str(sol_val) == str(stu_val):
                        cell_matched = True

                if cell_matched:
                    matching_cells += 1
                elif len(mismatched_examples) < 5: # Collect first 5 examples of mismatches
                     mismatched_examples.append(
                         f"  - Cell({r_idx},{c_idx}): Student='{stu_val}', Solution='{sol_val}'"
                     )

        # 3. Calculate Final Score and Determine Pass/Fail Status
        average_score = matching_cells / total_cells if total_cells > 0 else 1.0
        final_pass_status = average_score >= threshold

        print(f"  Student DataFrame Shape: {df_student.shape}")
        print(f"  Solution DataFrame Shape: {df_solution.shape}")
        print("-" * 80)
        print(f"  Total Cells Compared: {total_cells}")
        print(f"  Matching Cells:       {matching_cells}")
        print(f"  Average Score:        {average_score:.6f}")
        print(f"  Threshold Required:   {threshold:.4f}")
        print(f"  Result: {'✅ PASSED' if final_pass_status else '❌ FAILED'}")

        if not final_pass_status and mismatched_examples:
            print("\n--- CSV COMPARISON FAILED: DEBUG INFO ---")
            print("First few mismatched cells:")
            for example in mismatched_examples:
                print(example)
            print("--- END OF DEBUG INFO ---")

        print("="*80 + "\n")

        return final_pass_status, average_score

    except Exception as e:
        print(f"ERROR during CSV comparison: {e}")
        import traceback
        traceback.print_exc()
        return False, 0.0

def _validate_input_file(part_data, code) -> Tuple[bool, str]:
    prompt_text = part_data.get("description", "")
    expected_match = re.search(r'([\w.-]+\.wav)', prompt_text)
    if expected_match:
        expected_filename = expected_match.group(1)
        student_match = re.search(r'["\']([^"\']+\.wav)["\']', code)
        if not student_match:
            return False, "Validation Error: Your code must contain the full path to the input .wav file as a string."
        student_filename = Path(student_match.group(1)).name
        # if student_filename != expected_filename:
        #     return False, f"Validation Error: Incorrect input file. Prompt requires '{expected_filename}', but code uses '{student_filename}'."
    return True, ""

def _handle_csv_similarity(part_data, student_dir, validation_mode="STUDENT") -> Tuple[bool, str]:
    solution_files = part_data.get("solution_file")
    key_cols = part_data.get("key_columns")
    rtol = float(part_data.get('rtol', 1e-4))
    atol = float(part_data.get('atol', 1e-6))
    threshold = float(part_data.get('similarity_threshold', 0.8))
    
    print(f"[VALIDATION {validation_mode}] CSV Similarity Validation")
    print(f"  Key Columns: {key_cols}")
    print(f"  Similarity Threshold: {threshold}")
    print(f"  Tolerance: rtol={rtol}, atol={atol}")
    print(f"  Student Directory: {student_dir}")
    
    if isinstance(solution_files, list):
        print(f"[VALIDATION {validation_mode}] Comparing {len(solution_files)} file(s)")
        for idx, sol_path_str in enumerate(solution_files):
            sol_path = Path(sol_path_str)
            student_file_path = student_dir / sol_path.name
            
            print(f"\n  File {idx+1}/{len(solution_files)}:")
            print(f"    Student File: {student_file_path}")
            print(f"    Solution File: {sol_path}")
            
            passed, score = compare_csvs(student_file_path, sol_path, rtol=rtol, atol=atol, key_columns=key_cols, threshold=threshold)
            
            print(f"    Result: {'✅ PASSED' if passed else '❌ FAILED'} (Similarity Score: {score:.4f}, Required: {threshold:.4f})")
            
            if not passed: 
                return False, f"File '{student_file_path.name}' did not match the solution (Score: {score:.4f}, Required: {threshold:.4f})"
        print(f"[VALIDATION {validation_mode}] ✅ All {len(solution_files)} file(s) passed validation")
        return True, ""
    elif isinstance(solution_files, str):
        sol_path = Path(solution_files)
        student_filename_to_check = part_data.get("placeholder_filename", sol_path.name)
        student_file_path = student_dir / student_filename_to_check
        
        print(f"\n  Comparing single file:")
        print(f"    Student File: {student_file_path}")
        print(f"    Solution File: {sol_path}")
        print(f"    Expected Filename: {student_filename_to_check}")
        
        passed, score = compare_csvs(student_file_path, sol_path, rtol=rtol, atol=atol, key_columns=key_cols, threshold=threshold)
        
        print(f"    Result: {'✅ PASSED' if passed else '❌ FAILED'} (Similarity Score: {score:.4f}, Required: {threshold:.4f})")
        
        return bool(passed), f"Output file did not match the solution (Score: {score:.4f}, Required: {threshold:.4f})" if not passed else ""
    print(f"[VALIDATION {validation_mode}] ERROR: Invalid 'solution_file' format in question data")
    return False, "Invalid 'solution_file' format in question data."

def _handle_text_similarity(part_data, student_output, validation_mode="STUDENT") -> Tuple[bool, str]:
    keywords_str = part_data.get("expected_text", "")
    threshold = float(part_data.get("similarity_threshold", 0.8))
    student_output_lower = student_output.lower()
    keywords = [kw.strip().lower() for kw in keywords_str.split() if kw.strip()]
    
    print(f"[VALIDATION {validation_mode}] Text Similarity Validation")
    print(f"  Expected Keywords: {keywords}")
    print(f"  Similarity Threshold: {threshold}")
    print(f"  Student Output Length: {len(student_output)} characters")
    print(f"  Student Output Preview: {student_output[:200]}...")
    
    if not keywords: 
        print(f"[VALIDATION {validation_mode}] ⚠️  No keywords specified for text similarity.")
        return True, "No keywords specified for text similarity."
    
    matched_count = sum(1 for kw in keywords if kw in student_output_lower)
    match_ratio = matched_count / len(keywords)
    matched_keywords = [kw for kw in keywords if kw in student_output_lower]
    missing_keywords = [kw for kw in keywords if kw not in student_output_lower]
    
    print(f"  Matched Keywords: {matched_keywords} ({matched_count}/{len(keywords)})")
    if missing_keywords:
        print(f"  Missing Keywords: {missing_keywords}")
    print(f"  Match Ratio: {match_ratio:.4f} (Required: {threshold:.4f})")
    
    if match_ratio >= threshold:
        print(f"[VALIDATION {validation_mode}] ✅ PASSED text similarity check")
        return True, f"Passed text check ({match_ratio:.0%})"
    else:
        print(f"[VALIDATION {validation_mode}] ❌ FAILED text similarity check")
        return False, f"Failed text check. Missing keywords: {missing_keywords}"

def _handle_numerical_evaluation(part_data, student_output, validation_mode="STUDENT") -> Tuple[bool, str]:
    label = part_data.get("evaluation_label")
    expected_value = float(part_data.get("expected_value", 0))
    tolerance = float(part_data.get("tolerance", 1e-5))
    
    print(f"[VALIDATION {validation_mode}] Numerical Evaluation Validation")
    print(f"  Label: {label}")
    print(f"  Expected Value: {expected_value}")
    print(f"  Tolerance: ±{tolerance}")
    print(f"  Student Output Length: {len(student_output)} characters")
    print(f"  Student Output Preview: {student_output[:300]}...")
    
    try:
        pattern = re.compile(re.escape(label) + r'\s*(-?[\d\.]+)')
        match = pattern.search(student_output)
        if not match: 
            print(f"[VALIDATION {validation_mode}] ❌ FAILED: Required label '{label}' not found in output")
            return False, f"Failed. Required label '{label}' not found in the output."
        
        extracted_string = match.group(1)
        extracted_value = float(extracted_string)
        difference = abs(extracted_value - expected_value)
        
        print(f"  Extracted Value: {extracted_value:.6f}")
        print(f"  Difference: {difference:.6f}")
        print(f"  Within Tolerance: {difference <= tolerance}")
        
        if abs(extracted_value - expected_value) <= tolerance:
            print(f"[VALIDATION {validation_mode}] ✅ PASSED numerical check")
            return True, f"Passed numerical check. Found value {extracted_value:.4f} is within tolerance."
        else:
            print(f"[VALIDATION {validation_mode}] ❌ FAILED numerical check")
            return False, f"Failed numerical check. Found value {extracted_value:.4f}, expected around {expected_value}."
    except (ValueError, TypeError): 
        print(f"[VALIDATION {validation_mode}] ❌ FAILED: Could not parse number from output")
        return False, f"Failed. Could not parse number from output for label '{label}'."
    except Exception as e: 
        print(f"[VALIDATION {validation_mode}] ❌ ERROR during numerical parsing: {e}")
        return False, f"An unexpected error occurred during numerical parsing: {e}"

def run_code_on_kernel(kc: KernelClient, code: str, user_input: str = "", working_dir: str = None, timeout: int = 45) -> Tuple[str, str]:
    """
    Executes a Python code snippet on a Jupyter kernel, ensuring the working directory is set correctly.
    """
    print(f"\n[CODE EXECUTION] Starting Python code execution")
    if working_dir:
        Path(working_dir).mkdir(parents=True, exist_ok=True)
        print(f"[CODE EXECUTION] Working Directory: {working_dir}")
    if user_input:
        print(f"[CODE EXECUTION] User Input: {repr(user_input[:100]) if len(user_input) > 100 else repr(user_input)}")
    print(f"[CODE EXECUTION] Code Length: {len(code)} characters")
    print(f"[CODE EXECUTION] Timeout: {timeout} seconds")
    
    prep_script = ""
    if working_dir:
        # --- START OF CORRECTION ---
        # 1. Resolve the path to get the absolute path.
        # 2. Use repr() to create a raw, escaped string literal (e.g., 'C:\\Users\\user').
        # This prevents SyntaxError on systems that use backslashes in paths.
        py_working_dir = repr(str(Path(working_dir).resolve()))

        # 3. Use a multi-line f-string for clarity.
        prep_script = f"""
import os
os.chdir({py_working_dir})
"""
        # --- END OF CORRECTION ---

    full_script = f"""
{prep_script}
import builtins
import json
# Mock the input() function to handle test case inputs
_input_lines = {json.dumps(user_input)}.splitlines()
_input_lines.reverse()
def _mock_input(prompt=''):
    try: return _input_lines.pop()
    except IndexError: return ''
builtins.input = _mock_input
# Student's code to be executed
{code}
"""
    print(f"[CODE EXECUTION] Executing code on kernel...")
    msg_id = kc.execute(full_script)
    stdout, stderr = [], []
    start_time = time.monotonic()

    while time.monotonic() - start_time < timeout:
        try:
            msg = kc.get_iopub_msg(timeout=1)
            if msg.get('parent_header', {}).get('msg_id') != msg_id:
                continue
            
            msg_type = msg['header']['msg_type']
            content = msg.get('content', {})
            
            if msg_type == 'stream':
                if content['name'] == 'stdout':
                    stdout.append(content['text'])
                else:
                    stderr.append(content['text'])
            elif msg_type == 'error':
                stderr.append('\\n'.join(content.get('traceback', [])))
            elif msg_type == 'status' and content.get('execution_state') == 'idle':
                break
        except Empty:
            pass
    else:
        stderr.append(f"\\n[Kernel Timeout] Execution exceeded {timeout} seconds.")
        print(f"[CODE EXECUTION] ⚠️  TIMEOUT: Execution exceeded {timeout} seconds")

    final_stdout = "".join(stdout).strip()
    final_stderr = "".join(stderr).strip()
    
    if final_stderr:
        print(f"[CODE EXECUTION] ❌ ERROR occurred during execution")
        print(f"[CODE EXECUTION] Error: {final_stderr[:300]}...")
    else:
        print(f"[CODE EXECUTION] ✅ Code executed successfully")
        print(f"[CODE EXECUTION] Stdout length: {len(final_stdout)} characters")
        if final_stdout:
            print(f"[CODE EXECUTION] Stdout preview: {final_stdout[:200]}...")

    return final_stdout, final_stderr


import subprocess
import tempfile
import os
from typing import Tuple

def run_r_script(code: str, user_input: str = "", timeout: int = 20) -> Tuple[str, str]:
    """
    Executes an R script using a subprocess, completely suppressing warnings to ensure
    a clean stdout for validation. It also ensures the input stream ends with a newline.
    """
    print(f"\n[CODE EXECUTION] Starting R script execution")
    if user_input:
        print(f"[CODE EXECUTION] User Input: {repr(user_input[:100]) if len(user_input) > 100 else repr(user_input)}")
    print(f"[CODE EXECUTION] Code Length: {len(code)} characters")
    print(f"[CODE EXECUTION] Timeout: {timeout} seconds")
    
    # --- START OF CORRECTION ---
    # The most reliable way to prevent warnings from contaminating stdout in a non-interactive
    # Rscript session is to wrap the entire code block in suppressWarnings().
    # This guarantees the output stream is clean for test case comparison.
    wrapped_code = f"""
suppressWarnings({{
    {code}
}})
"""
    # --- END OF CORRECTION ---

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".R", mode='w', encoding='utf-8') as temp_file:
            temp_file.write(wrapped_code)
            temp_file_path = temp_file.name

        # --- SECONDARY FIX ---
        # Ensure the input string ends with a newline to prevent the
        # "incomplete final line" warning from R's input functions.
        if user_input and not user_input.endswith('\n'):
            user_input += '\n'
        # --- END OF SECONDARY FIX ---

        print(f"[CODE EXECUTION] Executing R script...")
        process = subprocess.run(
            ["Rscript", temp_file_path],
            input=user_input,
            text=True,
            capture_output=True,
            timeout=timeout
        )
        stdout = process.stdout.strip()
        stderr = process.stderr.strip()
        
        if stderr:
            print(f"[CODE EXECUTION] ❌ ERROR occurred during R execution")
            print(f"[CODE EXECUTION] Error: {stderr[:300]}...")
        else:
            print(f"[CODE EXECUTION] ✅ R script executed successfully")
            print(f"[CODE EXECUTION] Stdout length: {len(stdout)} characters")
            if stdout:
                print(f"[CODE EXECUTION] Stdout preview: {stdout[:200]}...")
    except FileNotFoundError:
        return "", "Rscript command not found. Please ensure R is installed and in the system's PATH."
    except subprocess.TimeoutExpired:
        return "", f"Execution timed out after {timeout} seconds."
    except Exception as e:
        return "", f"An unexpected error occurred while running the R script: {str(e)}"
    finally:
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
    return stdout, stderr


@evaluation_bp.route('/session/start', methods=['POST'])
def start_session():
    data = request.get_json(); session_id = data.get('sessionId')
    if not session_id: return jsonify({'error': 'sessionId is required.'}), 400
    if session_id in USER_KERNELS: return jsonify({'message': f'Session {session_id} already exists.'})
    try:
        km = KernelManager(); km.start_kernel()
        kc = km.client(); kc.start_channels(); kc.wait_for_ready(timeout=60)
        USER_KERNELS[session_id] = (km, kc)
        return jsonify({'message': f'Session {session_id} started successfully.'})
    except Exception as e:
        if 'km' in locals() and km.is_alive(): km.shutdown_kernel()
        return jsonify({'error': 'The code execution engine failed to start.', 'details': str(e)}), 500

@evaluation_bp.route('/validate', methods=['POST'])
def validate_cell():
    data = request.get_json()
    
    # Determine if this is admin validation (check headers or query params)
    is_admin = request.headers.get('X-Admin-Validation', 'false').lower() == 'true'
    validation_mode = "ADMIN" if is_admin else "STUDENT"
    
    required_fields = ['sessionId', 'subject', 'level', 'questionId', 'cellCode', 'username']
    missing_fields = [field for field in required_fields if field not in data or not data.get(field)]
    if missing_fields:
        error_msg = f"Missing or empty required fields in request: {', '.join(missing_fields)}"
        print(f"[VALIDATION {validation_mode}] DEBUG: 400 Bad Request. {error_msg}")
        return jsonify({'error': error_msg}), 400

    session_id = data['sessionId']
    subject = data['subject']
    level = data['level']
    q_id = data['questionId']
    p_id = data.get('partId')
    code = data['cellCode']
    username = data['username']

    if not code.strip():
        print(f"[VALIDATION {validation_mode}] DEBUG: Empty code provided")
        return jsonify({'error': 'Code cannot be empty.'}), 400
    
    student_dir = USER_GENERATED_PATH / username
    
    # --- START OF CORRECTION ---
    # Convert the subject to lowercase to make all subsequent comparisons case-insensitive.
    subject_lower = subject.lower().replace(" ", "")
    # --- END OF CORRECTION ---

    # Only check for a Python kernel if the subject is NOT R Programming.
    if subject_lower != "rprogramming":
        if session_id not in USER_KERNELS:
            print(f"[VALIDATION {validation_mode}] ERROR: User session '{session_id}' not found")
            return jsonify({'error': 'User session not found or invalid.'}), 404
        _km, kc = USER_KERNELS[session_id]

    try:
        q_path = QUESTIONS_BASE_PATH / subject / f"level{level}" / "questions.json"
        with open(q_path, 'r', encoding='utf-8') as f: all_q = json.load(f)
        q_data = next((q for q in all_q if q['id'] == q_id), None)
        if not q_data: 
            print(f"[VALIDATION {validation_mode}] ERROR: Question ID '{q_id}' not found in {subject}/level{level}")
            return jsonify({'error': f'Question with ID {q_id} not found.'}), 404
        part_data = next((p for p in q_data.get('parts', []) if p['part_id'] == p_id), q_data) if p_id else q_data
        
        # === DETAILED DEBUGGING LOG ===
        print("\n" + "="*80)
        print(f"[VALIDATION {validation_mode}] STARTING VALIDATION")
        print("="*80)
        print(f"User: {username}")
        print(f"Subject: {subject} | Level: {level}")
        print(f"Question ID: {q_id} | Part ID: {p_id if p_id else 'N/A (single question)'}")
        print(f"Question Title: {q_data.get('title', 'N/A')}")
        if p_id:
            print(f"Part Description: {part_data.get('description', 'N/A')[:100]}...")
        print(f"Validation Type: {part_data.get('type', 'test_cases')}")
        print(f"Working Directory: {student_dir}")
        print("-"*80)
        
    except FileNotFoundError: 
        print(f"[VALIDATION {validation_mode}] ERROR: Question file not found at path: {q_path}")
        return jsonify({'error': f"Question file not found at path: {q_path}"}), 500
    except Exception as e: 
        print(f"[VALIDATION {validation_mode}] ERROR: Could not load question data: {str(e)}")
        return jsonify({'error': f'Could not load question data: {str(e)}'}), 500

    test_results = []
    stdout, stderr = "", ""
    
    # --- START OF CORRECTION ---
    # Use the lowercased subject variable for all comparisons.
    if subject_lower == 'rprogramming':
    # --- END OF CORRECTION ---
        test_cases = part_data.get("test_cases", [])
        if not test_cases:
            print(f"[VALIDATION {validation_mode}] ERROR: No test cases found for question {q_id}")
            return jsonify({'error': f'No test cases found for question {q_id}.'}), 500

        print(f"[VALIDATION {validation_mode}] R Programming validation - {len(test_cases)} test case(s)")
        
        for i, case in enumerate(test_cases):
            user_input = case.get("input", "")
            expected_output = case.get("output", "")
            
            print(f"\n--- TEST CASE {i+1}/{len(test_cases)} ---")
            print(f"Input: {repr(user_input) if user_input else '(empty)'}")
            print(f"Expected Output: {repr(expected_output) if expected_output else '(empty)'}")
            
            stdout, stderr = run_r_script(code, user_input=user_input)

            if stderr:
                print(f"[VALIDATION {validation_mode}] ❌ R SCRIPT ERROR ON TEST CASE {i+1}")
                print(f"Error: {stderr[:500]}")  # Limit error length
                test_results.append(False)
            else:
                actual_output = stdout.strip()
                expected_output_stripped = expected_output.strip()
                passed = actual_output == expected_output_stripped
                
                print(f"Actual Output: {repr(actual_output) if actual_output else '(empty)'}")
                print(f"Result: {'✅ PASSED' if passed else '❌ FAILED'}")
                if not passed:
                    print(f"  Expected: {repr(expected_output_stripped)}")
                    print(f"  Got:      {repr(actual_output)}")
                
                test_results.append(passed)
        
        print(f"\n[VALIDATION {validation_mode}] Final Result: {sum(test_results)}/{len(test_cases)} test case(s) passed")
        print("="*80 + "\n")
                
        return jsonify({"test_results": test_results, "stdout": stdout, "stderr": stderr})

    # --- START OF CORRECTION ---
    # Use the lowercased subject variable for Python-based subjects.
    elif subject_lower in ['ds', 'deeplearning', 'nlp', 'ml', 'speechrecognition','llm','generativeai']:
    # --- END OF CORRECTION ---
        
        # Handle subject-specific pre-validation
        if subject_lower == 'speechrecognition':
            is_valid, error_message = _validate_input_file(part_data, code)
            if not is_valid:
                return jsonify({"test_results": [False], "stdout": "", "stderr": error_message})

        # Logic for subjects with simple, singular test cases (like DS, etc.)
        if subject_lower in ['ds', 'deeplearning', 'nlp','llm']:
            test_cases = part_data.get("test_cases", [])
            if not test_cases:
                print(f"[VALIDATION {validation_mode}] ERROR: No test cases found for question {q_id}")
                return jsonify({'error': f'No test cases found for question {q_id}.'}), 500
            
            print(f"[VALIDATION {validation_mode}] Test-case-based validation - {len(test_cases)} test case(s)")
            
            for i, case in enumerate(test_cases):
                test_input = case.get("input", "")
                expected_output = case.get("output", "")
                
                print(f"\n--- TEST CASE {i+1}/{len(test_cases)} ---")
                print(f"Input: {repr(test_input) if test_input else '(empty)'}")
                print(f"Expected Output: {repr(expected_output) if expected_output else '(empty)'}")
                
                stdout, stderr = run_code_on_kernel(kc, code, user_input=test_input, working_dir=student_dir)
                
                if stderr:
                    print(f"[VALIDATION {validation_mode}] ❌ PYTHON ERROR ON TEST CASE {i+1}")
                    print(f"Error: {stderr[:500]}")  # Limit error length
                    test_results.append(False)
                else:
                    actual_output = stdout.strip()
                    expected_output_stripped = expected_output.strip()
                    passed = actual_output == expected_output_stripped
                    
                    print(f"Actual Output: {repr(actual_output) if actual_output else '(empty)'}")
                    print(f"Result: {'✅ PASSED' if passed else '❌ FAILED'}")
                    if not passed:
                        print(f"  Expected: {repr(expected_output_stripped)}")
                        print(f"  Got:      {repr(actual_output)}")
                    
                    test_results.append(passed)
            
            print(f"\n[VALIDATION {validation_mode}] Final Result: {sum(test_results)}/{len(test_cases)} test case(s) passed")
            print("="*80 + "\n")
            
            return jsonify({"test_results": test_results, "stdout": stdout, "stderr": _simplify_python_error(stderr)})

        # --- FIX IS HERE: 'generativeai' is added to this block ---
        # Logic for subjects with file-based or output-parsing validation (like ML)
        elif subject_lower in ['ml', 'speechrecognition', 'generativeai']:
            print(f"[VALIDATION {validation_mode}] File/output-based validation")
            print(f"Executing student code...")
            
            stdout, stderr = run_code_on_kernel(kc, code, working_dir=student_dir)
            
            if stderr:
                print(f"[VALIDATION {validation_mode}] ❌ CODE EXECUTION ERROR")
                print(f"Error: {stderr[:500]}")
                simplified_error = _simplify_python_error(stderr)
                print("="*80 + "\n")
                return jsonify({"test_results": [False], "stdout": stdout, "stderr": simplified_error})

            print(f"Code executed successfully")
            print(f"Stdout length: {len(stdout)} characters")
            if stdout:
                print(f"Stdout preview: {stdout[:200]}...")

            validation_type = part_data.get("type", "csv_similarity") # Default to csv
            passed = False
            message = "Validation failed."

            print(f"\n[VALIDATION {validation_mode}] Validation Type: {validation_type}")

            if validation_type == 'csv_similarity':
                passed, message = _handle_csv_similarity(part_data, student_dir, validation_mode)
            elif validation_type == 'text_similarity':
                passed, message = _handle_text_similarity(part_data, stdout, validation_mode)
            elif validation_type == 'numerical_evaluation':
                passed, message = _handle_numerical_evaluation(part_data, stdout, validation_mode)
            
            if not passed and not stderr:
                stderr = message # Provide a reason for the failure if no kernel error occurred

            print(f"\n[VALIDATION {validation_mode}] Final Result: {'✅ PASSED' if passed else '❌ FAILED'}")
            if not passed:
                print(f"Failure Reason: {message}")
            print("="*80 + "\n")

            test_results.append(passed)
    
    else:
        print(f"[VALIDATION {validation_mode}] ERROR: No validation logic defined for subject: '{subject}'")
        print("="*80 + "\n")
        return jsonify({'error': f"No validation logic defined for subject: '{subject}'"}), 400

    final_passed = any(test_results) if test_results else False
    print(f"\n[VALIDATION {validation_mode}] COMPLETE")
    print(f"  Final Status: {'✅ PASSED' if final_passed else '❌ FAILED'}")
    print(f"  Test Results: {test_results}")
    if stdout:
        print(f"  Stdout: {stdout[:200]}...")
    if stderr:
        print(f"  Stderr: {stderr[:200]}...")
    print("="*80 + "\n")
    
    return jsonify({"test_results": test_results, "stdout": stdout, "stderr": _simplify_python_error(stderr)})


@evaluation_bp.route('/run', methods=['POST'])
def run_cell():
    data = request.get_json()
    
    session_id = data.get('sessionId')
    student_code = data.get('cellCode', '')
    user_input = data.get('userInput', '')
    username = data.get('username')
    subject = data.get('subject')
    print(f"DEBUG: Received /run request for session '{session_id}', user '{username}', subject '{subject}'")

    if not all([session_id, username, subject]):
        return jsonify({'error': 'Session ID, username, and subject are required.'}), 400
    
    if not student_code.strip():
        return jsonify({'stdout': '', 'stderr': 'Cannot run empty code.'})

    # --- START OF CORRECTION ---
    # Use case-insensitive comparison to determine the execution path.
    if subject and subject.lower().replace(" ", "") == 'rprogramming':
        # This path is for R code execution ONLY.
        try:
            stdout, stderr = run_r_script(code=student_code, user_input=user_input)
            return jsonify({'stdout': stdout, 'stderr': stderr})
        except Exception as e:
            return jsonify({'stdout': '', 'stderr': f'An error occurred while running the R script: {str(e)}'}), 500
    else:
        # This is the default path for all other subjects (Python-based).
        if session_id not in USER_KERNELS:
            return jsonify({'error': 'User session not found or invalid for Python execution.'}), 404
        
        _km, kc = USER_KERNELS[session_id]
        student_dir = USER_GENERATED_PATH / username
        
        try:
            stdout, stderr = run_code_on_kernel(kc, student_code, user_input=user_input, working_dir=student_dir)
            simplified_error = _simplify_python_error(stderr)
            return jsonify({'stdout': stdout, 'stderr': simplified_error})
        except Exception as e: 
            simplified_error = _simplify_python_error(str(e))
            return jsonify({'stdout': '', 'stderr': simplified_error}), 500
@evaluation_bp.route('/submit', methods=['POST'])
def submit_answers():
    data = request.get_json()
    session_id, username, subject, level = data.get('sessionId'), data.get('username'), data.get('subject'), data.get('level')
    answers = data.get('answers', [])
    
    student_dir = USER_GENERATED_PATH / username
    performance_metrics = []

    for answer in answers:
        q_id = answer.get('questionId')
        code = answer.get('code', 'pass')
        exec_time, peak_mem = 0.0, 0.0

        try:
            q_path = QUESTIONS_BASE_PATH / subject / f"level{level}" / "questions.json"
            with open(q_path, 'r', encoding='utf-8') as f: all_q = json.load(f)
            q_data = next((q for q in all_q if q['id'] == q_id), None)
            first_test_case_input = q_data.get("test_cases", [{}])[0].get("input", "") if q_data else ""
        except Exception:
            first_test_case_input = ""
        
        if subject.lower().replace(" ", "") == 'rprogramming':
            start_time = time.monotonic()
            _, _ = run_r_script(code, user_input=first_test_case_input)
            end_time = time.monotonic()
            exec_time = (end_time - start_time) * 1000
            # Memory tracking is not implemented for R subprocesses
            peak_mem = 0.0
        
        elif session_id in USER_KERNELS:
            _km, kc = USER_KERNELS[session_id]
            perf_prefix = "import tracemalloc; tracemalloc.start();"
            perf_suffix = """
peak_mem = tracemalloc.get_traced_memory()[1] / 1024
tracemalloc.stop()
print(f"__PERF_RESULT__:{peak_mem:.2f}")
"""
            full_perf_code = f"{perf_prefix}\n{code}\n{perf_suffix}"
            
            start_time = time.monotonic()
            stdout, _ = run_code_on_kernel(kc, full_perf_code, user_input=first_test_case_input, working_dir=student_dir)
            end_time = time.monotonic()
            
            exec_time = (end_time - start_time) * 1000
            
            for line in stdout.splitlines():
                if line.startswith("__PERF_RESULT__:"):
                    try:
                        peak_mem = float(line.split(":")[1])
                    except (ValueError, IndexError):
                        pass
        else:
            print(f"Warning: Session {session_id} not found for submission. Skipping performance tests for Python.")

        performance_metrics.append({
            "questionId": q_id,
            "execution_time_ms": f"{exec_time:.2f}",
            "peak_memory_kib": f"{peak_mem:.2f}"
        })

    all_passed = all(ans.get('passed', False) for ans in answers)
    status = 'passed' if all_passed else 'failed'
    submission = { 'subject': subject, 'level': f"level{level}", 'status': status, 'timestamp': datetime.now().isoformat(), 'answers': answers }
    user_submission_file = SUBMISSIONS_PATH / f"{username}.json"
    try:
        with open(user_submission_file, 'r+', encoding='utf-8') as f:
            user_submissions = json.load(f); user_submissions.append(submission); f.seek(0); json.dump(user_submissions, f, indent=2)
    except (FileNotFoundError, json.JSONDecodeError):
        with open(user_submission_file, 'w', encoding='utf-8') as f: json.dump([submission], f, indent=2)
    
    updated_user = None
    if all_passed:
        with open(USERS_FILE_PATH, 'r+', encoding='utf-8') as f:
            users_json = json.load(f)
            user = next((u for u in users_json['users'] if u['username'] == username), None)
            if user:
                if subject not in user['progress']: user['progress'][subject] = {}
                user['progress'][subject][f"level{level}"] = 'completed'
                next_level = f"level{int(level) + 1}"
                if (f"level{int(level) + 1}" in user.get('progress', {}).get(subject, {}) and 
                    user['progress'][subject][next_level] == 'locked'):
                    user['progress'][subject][next_level] = 'unlocked'
                updated_user = {k: v for k, v in user.items() if k != 'password'}
            f.seek(0); json.dump(users_json, f, indent=2); f.truncate()

    if session_id in USER_KERNELS:
        km, kc = USER_KERNELS.pop(session_id)
        if kc.is_alive(): kc.stop_channels()
        if km.is_alive(): km.shutdown_kernel()
        
    return jsonify({
        'success': True, 
        'message': "Submission received.", 
        'updatedUser': updated_user,
        'performance_metrics': performance_metrics  
    }), 200