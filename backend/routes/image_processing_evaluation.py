import json
import base64
import time
from pathlib import Path
from io import BytesIO
from flask import Blueprint, request, jsonify
from typing import Dict, Tuple, Union, List
from jupyter_client.manager import KernelManager, KernelClient
from queue import Empty
import numpy as np
from PIL import Image
import re
import cv2
from skimage.metrics import structural_similarity as ssim
# --- NEWLY ADDED IMPORT ---
# This import is required for the Hungarian algorithm.
# Ensure you have scipy installed: pip install scipy
from scipy.optimize import linear_sum_assignment

# --- Blueprint Setup & Configuration ---
image_processing_bp = Blueprint('image_processing_api', __name__)
QUESTIONS_BASE_PATH = Path(__file__).parent.parent / "data" / "questions"
USER_GENERATED_PATH = Path(__file__).parent.parent / "data" / "user_generated"
USER_KERNELS: Dict[str, Tuple[KernelManager, KernelClient]] = {}

# --- HELPER FUNCTIONS ---

def _simplify_python_error(stderr: str) -> str:
    if not stderr: return ""
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

def compare_images_ssim(
    student_img_array: np.ndarray, 
    solution_img_path: str, 
    threshold: float = 0.99, 
    dimension_tolerance: int = 5
) -> Tuple[bool, float]:
    """
    Compares a student-generated image with a solution image using SSIM.

    Args:
        student_img_array: The student's image as a NumPy array.
        solution_img_path: The file path to the solution image.
        threshold: The SSIM score required to pass (0.0 to 1.0).
        dimension_tolerance: The maximum allowed pixel difference in height or width
                             before considering it a shape mismatch. If the difference is
                             within this tolerance, the student image is resized to match
                             the solution for comparison.

    Returns:
        A tuple containing (bool: passed, float: ssim_score).
    """
    try:
        solution_img = cv2.imread(solution_img_path)
        if solution_img is None:
            print(f"Error: Could not load solution image at {solution_img_path}")
            return False, 0.0

        h_student, w_student, _ = student_img_array.shape
        h_solution, w_solution, _ = solution_img.shape

        student_to_compare = student_img_array

        # --- NEW LOGIC: Check dimensions with tolerance ---
        if student_img_array.shape != solution_img.shape:
            # Check if the dimensions are within the allowed tolerance
            if abs(h_student - h_solution) <= dimension_tolerance and abs(w_student - w_solution) <= dimension_tolerance:
                # If they are close, resize the student's image to match the solution's dimensions.
                # This makes the SSIM comparison possible and forgives minor cropping errors.
                print(f"Info: Resizing student image from ({h_student}, {w_student}) to ({h_solution}, {w_solution}) for tolerant comparison.")
                student_to_compare = cv2.resize(student_img_array, (w_solution, h_solution), interpolation=cv2.INTER_AREA)
            else:
                # The dimensions are too different, so it's a definite failure.
                print(f"Validation Fail: Shape mismatch beyond tolerance. Student: {student_img_array.shape}, Solution: {solution_img.shape}")
                return False, 0.0
        
        # --- Proceed with SSIM comparison on the potentially resized image ---
        student_gray = cv2.cvtColor(student_to_compare, cv2.COLOR_BGR2GRAY)
        solution_gray = cv2.cvtColor(solution_img, cv2.COLOR_BGR2GRAY)

        # The 'win_size' must be smaller than the image dimensions.
        # Use the smaller of the two dimensions to set a safe window size.
        min_dim = min(student_gray.shape[0], student_gray.shape[1], solution_gray.shape[0], solution_gray.shape[1])
        win_size = min(7, min_dim) # SSIM window size is typically an odd number, e.g., 7 or 11
        if win_size < 7 or win_size % 2 == 0:
             # Handle very small images by adjusting window size
             win_size = 3 if min_dim >= 3 else min_dim 
             if win_size % 2 == 0: win_size -=1 # Ensure odd number
        
        if win_size < 3:
            print(f"Validation Fail: Image dimensions are too small for SSIM comparison. Shape: {student_gray.shape}")
            return False, 0.0

        score, _ = ssim(student_gray, solution_gray, full=True, win_size=win_size)
        
        print(f"Image comparison for '{Path(solution_img_path).name}': Score={score:.4f}, Threshold={threshold}")
        return score >= threshold, score
        
    except Exception as e:
        print(f"An error occurred during image comparison: {e}")
        return False, 0.0

def base64_to_cv2_image(base64_string: str) -> np.ndarray:
    img_bytes = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)

def run_code_on_kernel(kc: KernelClient, code: str, working_dir: str = None, timeout: int = 45) -> Dict[str, Union[str, List[str], None]]:
    prep_script = ""
    if working_dir:
        Path(working_dir).mkdir(parents=True, exist_ok=True)
        py_working_dir = repr(str(Path(working_dir).resolve()))
        prep_script = f"import os\nos.chdir({py_working_dir})\n"
        
    image_helper_code = """
import numpy as np
from PIL import Image as PILImage
import base64
from io import BytesIO
import sys

def _capture_and_display(image_object):
    try:
        image_array = None
        if isinstance(image_object, PILImage.Image):
            if image_object.mode == 'RGBA': image_object = image_object.convert('RGB')
            image_array = np.array(image_object)
        elif isinstance(image_object, np.ndarray):
            image_array = image_object
        else:
            print(f"Error: An unsupported object was passed to a display function: {type(image_object)}", file=sys.stderr)
            return
        if image_array.dtype != np.uint8:
            if image_array.max() <= 1.0: image_array = (image_array * 255).astype(np.uint8)
            else: image_array = (255 * (image_array - image_array.min()) / (image_array.max() - image_array.min())).astype(np.uint8)
        img = PILImage.fromarray(image_array)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        print(f"__IMAGE_DATA__:{img_str}")
    except Exception as e:
        print(f"Error during image conversion: {e}", file=sys.stderr)

def _patched_show(self, *args, **kwargs):
    _capture_and_display(self)

PILImage.Image.show = _patched_show
display_image = _capture_and_display
"""
    full_script = f"import sys\nfrom PIL import Image\n{image_helper_code}\n{prep_script}\n{code}"
    
    msg_id = kc.execute(full_script)
    stdout_parts, stderr_parts = [], []
    start_time = time.monotonic()
    while time.monotonic() - start_time < timeout:
        try:
            msg = kc.get_iopub_msg(timeout=1)
            if msg.get('parent_header', {}).get('msg_id') != msg_id: continue
            msg_type, content = msg['header']['msg_type'], msg.get('content', {})
            if msg_type == 'stream':
                if content['name'] == 'stdout': stdout_parts.append(content['text'])
                else: stderr_parts.append(content['text'])
            elif msg_type == 'error': stderr_parts.append('\\n'.join(content.get('traceback', [])))
            elif msg_type == 'status' and content.get('execution_state') == 'idle': break
        except Empty: pass
    else: stderr_parts.append(f"\\n[Kernel Timeout] Execution exceeded {timeout} seconds.")
    
    full_stdout = "".join(stdout_parts).strip()
    image_data_list = [] 
    final_stdout_lines = []
    for line in full_stdout.splitlines():
        if line.startswith("__IMAGE_DATA__:"): image_data_list.append(line.split(":", 1)[1])
        else: final_stdout_lines.append(line)
            
    final_image_data = image_data_list if image_data_list else None
    return { "stdout": "\\n".join(final_stdout_lines), "stderr": "".join(stderr_parts).strip(), "imageData": final_image_data }

# --- API ENDPOINTS ---
@image_processing_bp.route('/session/start', methods=['POST'])
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

@image_processing_bp.route('/run', methods=['POST'])
def run_cell():
    data = request.get_json()
    session_id, student_code, username = data.get('sessionId'), data.get('cellCode', ''), data.get('username')
    if not all([session_id, username]): return jsonify({'error': 'Session ID and username are required.'}), 400
    if session_id not in USER_KERNELS: return jsonify({'error': 'User session not found.'}), 404
    if not student_code.strip(): return jsonify({'stdout': '', 'stderr': 'Cannot run empty code.', 'imageData': None})
    _km, kc = USER_KERNELS[session_id]
    student_dir = USER_GENERATED_PATH / username
    try:
        result = run_code_on_kernel(kc, student_code, working_dir=student_dir)
        result['stderr'] = _simplify_python_error(result['stderr'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'stdout': '', 'stderr': _simplify_python_error(str(e)), 'imageData': None}), 500

@image_processing_bp.route('/validate', methods=['POST'])
def validate_cell():
    data = request.get_json()
    
    # Determine if this is admin validation
    is_admin = request.headers.get('X-Admin-Validation', 'false').lower() == 'true'
    validation_mode = "ADMIN" if is_admin else "STUDENT"
    
    session_id, code, username, q_id, subject, level = (
        data.get('sessionId'), data.get('cellCode'), data.get('username'),
        data.get('questionId'), data.get('subject'), data.get('level')
    )
    if not all([session_id, code, username, q_id, subject, level]):
        print(f"[VALIDATION {validation_mode}] ERROR: Missing required fields for validation.")
        return jsonify({'error': 'Missing required fields for validation.'}), 400
    if session_id not in USER_KERNELS: 
        print(f"[VALIDATION {validation_mode}] ERROR: User session '{session_id}' not found.")
        return jsonify({'error': 'User session not found.'}), 404

    print("\n" + "="*80)
    print(f"[VALIDATION {validation_mode}] IMAGE PROCESSING VALIDATION")
    print("="*80)
    print(f"User: {username}")
    print(f"Subject: {subject} | Level: {level}")
    print(f"Question ID: {q_id}")
    print(f"Code Length: {len(code)} characters")
    print("-"*80)

    try:
        q_path = QUESTIONS_BASE_PATH / subject / f"level{level}" / "questions.json"
        with open(q_path, 'r', encoding='utf-8') as f: all_q = json.load(f)
        q_data = next((q for q in all_q if q.get('id') == q_id), None)
        if not q_data: 
            print(f"[VALIDATION {validation_mode}] ERROR: Question ID '{q_id}' not found.")
            return jsonify({'error': f'Question with ID {q_id} not found.'}), 404
        
        print(f"Question Title: {q_data.get('title', 'N/A')}")
        
        num_outputs = int(q_data.get("No_of_outputs", 0))
        similarity_threshold = float(q_data.get("compare_similarity", 0.99))
        
        print(f"Expected Number of Outputs: {num_outputs}")
        print(f"Similarity Threshold: {similarity_threshold}")
        
        solution_paths = []
        if num_outputs == 0: 
            print(f"[VALIDATION {validation_mode}] ERROR: Question {q_id} has 'No_of_outputs' set to 0.")
            return jsonify({'error': f'Question {q_id} has "No_of_outputs" set to 0.'}), 500
        for i in range(1, num_outputs + 1):
            key, path = f"output_{i}", q_data.get(f"output_{i}")
            if not path: 
                print(f"[VALIDATION {validation_mode}] ERROR: Missing solution path for '{key}' in question {q_id}.")
                return jsonify({'error': f'Missing solution path for "{key}" in question {q_id}.'}), 500
            solution_paths.append(path)
            print(f"  Solution {i}: {path}")
    except (ValueError, TypeError) as e:
        print(f"[VALIDATION {validation_mode}] ERROR: Invalid format for number fields in question {q_id}: {e}")
        return jsonify({'error': f'Invalid format for number fields in question {q_id}: {e}'}), 500
    except Exception as e:
        print(f"[VALIDATION {validation_mode}] ERROR: Could not load or parse question data: {str(e)}")
        return jsonify({'error': f'Could not load or parse question data: {str(e)}'}), 500

    print(f"\n[VALIDATION {validation_mode}] Executing student code...")
    _km, kc = USER_KERNELS[session_id]
    student_dir = USER_GENERATED_PATH / username
    print(f"Working Directory: {student_dir}")
    result = run_code_on_kernel(kc, code, working_dir=student_dir)
    
    if result['stderr']:
        print(f"[VALIDATION {validation_mode}] ❌ CODE EXECUTION ERROR")
        print(f"Error: {result['stderr'][:500]}")
        print("="*80 + "\n")
        return jsonify({"test_results": [False], "stdout": result['stdout'], "stderr": f"Code Execution Error:\n{_simplify_python_error(result['stderr'])}", "imageData": result['imageData']})
    
    student_images_b64 = result['imageData']
    if not isinstance(student_images_b64, list) or not student_images_b64:
        print(f"[VALIDATION {validation_mode}] ❌ FAILED: No images produced")
        print("="*80 + "\n")
        return jsonify({"test_results": [False], "stdout": result['stdout'], "stderr": "Validation Failed: Your code ran but did not produce any images.", "imageData": result['imageData']})
    
    print(f"[VALIDATION {validation_mode}] Code executed successfully")
    print(f"Student Images Produced: {len(student_images_b64)}")
    print(f"Expected Images: {len(solution_paths)}")
    
    if len(student_images_b64) != len(solution_paths):
        print(f"[VALIDATION {validation_mode}] ❌ FAILED: Image count mismatch")
        print("="*80 + "\n")
        return jsonify({"test_results": [False], "stdout": result['stdout'], "stderr": f"Validation Failed: Expected {len(solution_paths)} image(s) but your code produced {len(student_images_b64)}.", "imageData": result['imageData']})

    # --- NEW VALIDATION LOGIC USING HUNGARIAN ALGORITHM ---
    print(f"\n[VALIDATION {validation_mode}] Comparing images using Hungarian algorithm...")
    all_passed = False
    final_stderr = ""
    try:
        student_img_arrays = [base64_to_cv2_image(b64) for b64 in student_images_b64]
        num_images = len(student_img_arrays)
        
        print(f"Converting {num_images} student image(s) to arrays...")
        print(f"Solution paths: {solution_paths}")
        
        # 1. Create a similarity matrix where matrix[i, j] is the score
        #    between student image i and solution image j.
        print(f"\n[VALIDATION {validation_mode}] Computing similarity matrix...")
        similarity_matrix = np.zeros((num_images, num_images))
        for i in range(num_images):
            for j in range(num_images):
                _, score = compare_images_ssim(student_img_arrays[i], solution_paths[j], threshold=similarity_threshold)
                similarity_matrix[i, j] = score
                print(f"  Student Image {i+1} vs Solution Image {j+1}: SSIM Score = {score:.4f}")
        
        # 2. The algorithm finds the minimum cost, so we convert similarity to cost.
        #    High similarity = low cost.
        cost_matrix = 1 - similarity_matrix
        
        # 3. Use the Hungarian algorithm to find the optimal assignment (pairing).
        #    row_ind[k] should be matched with col_ind[k].
        print(f"\n[VALIDATION {validation_mode}] Finding optimal pairing using Hungarian algorithm...")
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        # 4. Check if every image in the optimal assignment meets the threshold.
        all_matches_are_good = True
        # Extract the scores of the best pairings
        optimal_scores = similarity_matrix[row_ind, col_ind]
        
        print(f"\n[VALIDATION {validation_mode}] Optimal Pairings:")
        for idx, (student_idx, solution_idx) in enumerate(zip(row_ind, col_ind)):
            score = optimal_scores[idx]
            passed = score >= similarity_threshold
            status = "✅ PASSED" if passed else "❌ FAILED"
            print(f"  Student Image {student_idx+1} <-> Solution Image {solution_idx+1}: {status} (Score: {score:.4f}, Required: {similarity_threshold:.4f})")
            if score < similarity_threshold:
                all_matches_are_good = False
        
        all_passed = all_matches_are_good

    except Exception as e:
        # Catch any errors during the complex validation logic
        print(f"[VALIDATION {validation_mode}] ❌ ERROR during image validation: {e}")
        all_passed = False
        final_stderr = f"An unexpected error occurred during image validation: {str(e)}"

    if not final_stderr:
        final_stderr = "" if all_passed else "Validation Failed: Your images were produced, but at least one did not match the expected solution."
    
    print(f"\n[VALIDATION {validation_mode}] Final Result: {'✅ PASSED' if all_passed else '❌ FAILED'}")
    if not all_passed:
        print(f"Failure Reason: {final_stderr}")
    print("="*80 + "\n")
    
    return jsonify({"test_results": [all_passed], "stdout": result['stdout'], "stderr": final_stderr, "imageData": result['imageData']})