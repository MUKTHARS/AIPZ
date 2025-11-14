import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../App";
import Spinner from "../Spinner/Spinner";
import Editor from "@monaco-editor/react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import UserProfileModal from "../../components/UserProfileModal/UserProfileModal";
import userpng from "../../assets/userPS.png";
import { useFullScreenExamSecurity } from "../../hooks/useFullScreenExamSecurity";
import PerformanceReportModal from "../../components/PerformanceReportModal/PerformanceReportModal";
import ValidationResultModal from "../../components/ValidationResultModal/ValidationResultModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Utility function to strip ANSI escape codes from error messages
const stripAnsiCodes = (text) => {
  if (!text) return text;
  // Remove ANSI escape sequences (color codes, formatting, etc.)
  // Pattern matches: \x1b[...m or \033[...m or \u001b[...m
  return String(text)
    .replace(/\x1b\[[0-9;]*m/g, '') // CSI (Control Sequence Introducer) codes
    .replace(/\033\[[0-9;]*m/g, '') // Octal escape sequence format
    .replace(/\u001b\[[0-9;]*m/g, '') // Unicode escape sequence format
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Other ANSI codes
    .replace(/\033\[[0-9;]*[a-zA-Z]/g, '') // Other ANSI codes (octal)
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // Other ANSI codes (unicode)
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n') // Normalize line endings
    .trim();
};

const AlertCard = ({ message, onConfirm, onCancel, showCancel = false }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
      <div
        className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-auto text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold text-gray-800 mb-6">{message}</p>
        <div className="flex justify-center gap-4">
          {showCancel && (
            <button
              className="px-6 py-2 rounded-md font-semibold text-white bg-red-500"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            className="px-6 py-2 rounded-md font-semibold text-white bg-purple-600 "
            onClick={onConfirm}
          >
            {showCancel ? "Continue" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CodeCell = ({
  question,
  mainTask,
  cellCode,
  onCodeChange,
  onRun,
  onValidate,
  cellResult,
  isExecuting,
  isValidated, // This prop tells us if the tests passed (true/false)
  customInput,
  onCustomInputChange,
  isCustomInputEnabled,
  onToggleCustomInput,
  isSessionReady,
  securityConfig,
}) => {
  const buildEnhancedDescription = () => {
    let enhancedDesc = mainTask?.description || "";
    enhancedDesc += `\n\n---\n\n${question.description || ""}`;
    if (mainTask?.datasets && typeof mainTask.datasets === "object") {
      const datasetEntries = Object.entries(mainTask.datasets);
      if (datasetEntries.length > 0) {
        enhancedDesc += "\n\n---\n\n#### Datasets for this Task:\n";
        datasetEntries.forEach(([key, value]) => {
          if (value) {
            const displayName = key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
            enhancedDesc += `*   **${displayName} Path:** \`'${value}'\`\n`;
          }
        });
      }
    }
    const currentPartKeyColumns = question.key_columns;
    if (
      Array.isArray(currentPartKeyColumns) &&
      currentPartKeyColumns.length > 0
    ) {
      enhancedDesc += "\n\n---\n\n#### Key Columns for Submission:\n";
      currentPartKeyColumns.forEach((col) => {
        enhancedDesc += `*   \`${col}\`\n`;
      });
      enhancedDesc +=
        "\n*Ensure your final `submission.csv` contains these columns.*";
    }
    return enhancedDesc;
  };
  const fullDescription = buildEnhancedDescription();
  const visibleTestCase =
    question.test_cases && question.test_cases.length > 0
      ? question.test_cases[0]
      : null;

  // <<< START: NEW LOGIC FOR DISPLAYING OUTPUT >>>
  const renderOutputContent = () => {
    if (!cellResult) {
      return null; // Don't show the output box until a run or submit
    }
    if (cellResult.stderr) {
      const cleanedError = stripAnsiCodes(cellResult.stderr);
      return (
        <>
          <p className="font-semibold text-red-600 mb-2">Error:</p>
          <pre className="bg-red-50 text-red-600 rounded p-3 font-mono whitespace-pre-wrap break-words border border-red-200">
            {cleanedError}
          </pre>
        </>
      );
    }
    if (cellResult.stdout) {
      const cleanedOutput = stripAnsiCodes(cellResult.stdout);
      return (
        <>
          <p className="font-semibold text-slate-800 mb-2">Output:</p>
          <pre className=" text-slate-800 rounded p-3 font-mono whitespace-pre-wrap break-words border border-indigo-200">
            {cleanedOutput}
          </pre>
        </>
      );
    }
    // If there's no output BUT the validation has failed, show a helpful message.
    if (isValidated === false) {
      return (
        <pre className="bg-yellow-50 text-yellow-700 rounded p-3 font-mono whitespace-pre-wrap break-words border border-yellow-200">
          Your code ran without errors, but the output did not match the
          expected result for one or more test cases.
        </pre>
      );
    }
    // Default case: no stdout, no stderr, and not explicitly failed (e.g., after a simple run)
    return <pre className="text-slate-600">No output produced.</pre>;
  };
  // <<< END: NEW LOGIC FOR DISPLAYING OUTPUT >>>

  return (
    <div className="flex flex-col md:flex-row h-full w-full p-4 overflow-hidden">
      {/* The Description and Test Case panel remains exactly the same */}
      <div className="flex-1 bg-white rounded-lg p-6 mr-4 mb-4 md:mb-0 border border-gray-200 overflow-y-auto">
        {isValidated && (
          <span
            className="float-right text-2xl -mt-2 -mr-2 text-green-500"
            title="All test cases passed"
          >
            &#10003;
          </span>
        )}
        <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {mainTask?.title || question.title}
          </h2>
          <ReactMarkdown>{fullDescription}</ReactMarkdown>
        </div>
        {visibleTestCase && (
          <div className="mt-8 font-medium">
            <h4 className="text-slate-800 text-lg mb-3">Visible Test Case</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
              <p className="font-semibold">Input:</p>
              <pre className="bg-white p-2 rounded mt-1 font-mono text-slate-600">
                {visibleTestCase.input}
              </pre>
              <p className="font-semibold mt-3">Expected Output:</p>
              <pre className="bg-white p-2 rounded mt-1 font-mono text-slate-600">
                {visibleTestCase.output}
              </pre>
            </div>
          </div>
        )}
        <div className="mt-8 font-medium">
          <h4 className="text-slate-800 text-lg mb-3">Hidden Test Cases</h4>
          {cellResult?.test_results ? (
            cellResult.test_results.map((passed, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 mb-3 rounded-lg border text-base ${
                  passed
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-red-50 text-red-700 border-red-300"
                }`}
              >
                {`Test Case ${i + 1}: ${passed ? "Passed ✔" : "Failed ❌"}`}
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg border bg-gray-50 text-gray-700 border-gray-300 text-base">
              Please submit your code to see the results.
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex-grow min-h-[200px] max-h-[70%] relative">
          {!isSessionReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 bg-opacity-90">
              <span className="text-white text-lg font-semibold animate-pulse">
                Initializing Execution Environment...
              </span>
            </div>
          )}
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={cellCode}
            onChange={(value) => onCodeChange(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 15 },
            }}
            onMount={(editor, monaco) => {
              if (securityConfig?.paste) {
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
                  () => {
                    alert("Pasting is disabled during the exam.");
                  }
                );
              }
            }}
          />
        </div>
        <div className="flex justify-start items-center flex-wrap gap-4 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            className="px-6 py-2 rounded-md font-semibold text-white bg-[#7D53F6] disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={onRun}
            disabled={isExecuting || !isSessionReady || !cellCode.trim()}
            title={
              !cellCode.trim()
                ? "Cannot run empty code"
                : !isSessionReady
                ? "Please wait..."
                : "Run your code"
            }
          >
            {isExecuting ? "Running..." : "Run Code"}
          </button>
          <button
            className="px-6 py-2 rounded-md font-semibold text-[#7D53F6] border border-[#7D53F6] bg-white disabled:text-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
            onClick={onValidate}
            disabled={isExecuting || !isSessionReady || !cellCode.trim()}
            title={
              !cellCode.trim()
                ? "Cannot submit empty code"
                : !isSessionReady
                ? "Please wait..."
                : "Submit for validation"
            }
          >
            {isExecuting ? "Submitting..." : "Submit"}
          </button>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-white">
          <label className="flex items-center gap-2 text-slate-700 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={isCustomInputEnabled || false}
              onChange={onToggleCustomInput}
              className="form-checkbox h-4 w-4 text-indigo-600 rounded"
            />
            Test with Custom Input
          </label>
          <textarea
            className={`w-full mt-3 p-3 border border-slate-300 rounded-md bg-white font-mono text-slate-700 text-sm resize-y min-h-[50px] focus:outline-none transition-all duration-200 ease-in-out ${
              isCustomInputEnabled
                ? "max-h-[150px] opacity-100"
                : "max-h-[0px] p-0 border-none opacity-0 invisible"
            }`}
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            placeholder="Enter custom input here..."
            rows={isCustomInputEnabled ? 4 : 0}
            aria-hidden={!isCustomInputEnabled}
            tabIndex={isCustomInputEnabled ? 0 : -1}
          />
        </div>
        {/* Only this part below changes */}
        {cellResult && (
          <div className="px-6 py-4 bg-white border-t border-slate-200">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-sm max-h-48 overflow-auto">
              {renderOutputContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ML_ExamPage = () => {
  // --- START OF REPLACEMENT BLOCK ---
  const { subject, level } = useParams();
  const navigate = useNavigate();
  const { user, updateUserSession } = useContext(AuthContext);

  // 1. Logic to detect Admin Validation Mode
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const validationQuestionId = queryParams.get("validate");
  const isAdminValidationMode =
    user?.role === "admin" && !!validationQuestionId;

  // 2. All state hooks are now at the top level
  const [performanceReport, setPerformanceReport] = useState(null);
  const [examParts, setExamParts] = useState([]);
  const [mainTask, setMainTask] = useState(null);
  const [allCode, setAllCode] = useState({});
  const [cellResults, setCellResults] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [customInputs, setCustomInputs] = useState({});
  const [isCustomInputEnabled, setIsCustomInputEnabled] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasExamStarted, setHasExamStarted] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isFinalSubmission, setIsFinalSubmission] = useState(false);
  const [securityConfig, setSecurityConfig] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const handleAdminValidationSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsFinalSubmission(true);

    // Detailed debugging: Collect validation information
    const debugInfo = {
      questionId: validationQuestionId,
      subject,
      level,
      partsCount: examParts.length,
      validationDetails: [],
      overallPassed: false,
      reasons: [],
    };

    // Check if all parts passed with detailed reasons
    let passed = false;
    if (examParts.length > 0) {
      // Multi-part question
      const partsStatus = examParts.map((part) => {
        const partStatus = validationStatus[part.id];
        const partInfo = {
          partId: part.id,
          partTitle: part.part_id || part.id,
          passed: partStatus === true,
          status:
            partStatus === true
              ? "PASSED"
              : partStatus === false
              ? "FAILED"
              : "NOT_ATTEMPTED",
        };

        if (partStatus === true) {
          partInfo.reason = `Part ${
            part.part_id || part.id
          } passed validation tests.`;
        } else if (partStatus === false) {
          partInfo.reason = `Part ${
            part.part_id || part.id
          } failed validation tests.`;
        } else {
          partInfo.reason = `Part ${
            part.part_id || part.id
          } was not validated.`;
        }

        debugInfo.validationDetails.push(partInfo);
        return partInfo;
      });

      const allPartsValidated = partsStatus.every((p) => p.passed);
      const anyPartValidated = partsStatus.some((p) => p.passed);
      const notAttemptedCount = partsStatus.filter(
        (p) => p.status === "NOT_ATTEMPTED"
      ).length;

      passed =
        allPartsValidated || (examParts.length === 1 && anyPartValidated);

      debugInfo.overallPassed = passed;

      if (allPartsValidated) {
        debugInfo.reasons.push(
          `✅ All ${examParts.length} part(s) passed validation.`
        );
      } else if (anyPartValidated && examParts.length === 1) {
        debugInfo.reasons.push(`✅ Single part question passed validation.`);
      } else {
        const failedParts = partsStatus.filter(
          (p) => !p.passed && p.status !== "NOT_ATTEMPTED"
        );
        const notAttemptedParts = partsStatus.filter(
          (p) => p.status === "NOT_ATTEMPTED"
        );

        if (failedParts.length > 0) {
          debugInfo.reasons.push(
            `❌ ${failedParts.length} part(s) failed: ${failedParts
              .map((p) => p.partTitle)
              .join(", ")}`
          );
        }
        if (notAttemptedParts.length > 0) {
          debugInfo.reasons.push(
            `⚠️ ${
              notAttemptedParts.length
            } part(s) not attempted: ${notAttemptedParts
              .map((p) => p.partTitle)
              .join(", ")}`
          );
        }
        debugInfo.reasons.push(`❌ Validation failed: Not all parts passed.`);
      }
    } else {
      // Single question without parts
      const status = validationStatus[validationQuestionId];
      passed = status === true;
      debugInfo.overallPassed = passed;

      const statusInfo = {
        questionId: validationQuestionId,
        passed: status === true,
        status:
          status === true
            ? "PASSED"
            : status === false
            ? "FAILED"
            : "NOT_ATTEMPTED",
      };

      if (status === true) {
        statusInfo.reason = "Question passed all validation tests.";
        debugInfo.reasons.push("✅ Question passed validation tests.");
      } else if (status === false) {
        statusInfo.reason = "Question failed validation tests.";
        debugInfo.reasons.push("❌ Question failed validation tests.");
      } else {
        statusInfo.reason = "Question was not validated.";
        debugInfo.reasons.push("⚠️ Question was not validated.");
      }

      debugInfo.validationDetails.push(statusInfo);
    }

    // Log detailed debugging information
    console.group("🔍 VALIDATION DEBUG INFO");
    console.log("Question ID:", debugInfo.questionId);
    console.log("Subject:", debugInfo.subject);
    console.log("Level:", debugInfo.level);
    console.log("Parts Count:", debugInfo.partsCount);
    console.log("Overall Result:", passed ? "✅ PASSED" : "❌ FAILED");
    console.log("Reasons:", debugInfo.reasons);
    console.table(debugInfo.validationDetails);
    console.groupEnd();

    try {
      // Normalize the validation question ID - trim quotes and whitespace
      const normalizedQuestionId = validationQuestionId?.toString().trim().replace(/^['"]|['"]$/g, '');
      
      // Get pending validation context
      const pendingValidation = localStorage.getItem(
        "pendingQuestionValidation"
      );
      let validationResult = {
        subject,
        level,
        questionId: normalizedQuestionId,
        passed: !!passed,
        timestamp: Date.now(),
        debugInfo: debugInfo, // Include debug info
      };

      if (pendingValidation) {
        const pending = JSON.parse(pendingValidation);
        const pendingId = pending.questionId?.toString().trim().replace(/^['"]|['"]$/g, '');
        validationResult.questionId = pendingId || normalizedQuestionId;
      }

      if (!passed) {
        // Validation failed - delete the question from JSON
        console.log("🗑️ Deleting question due to validation failure...");
        try {
          const deleteResponse = await fetch(
            `${API_BASE_URL}/api/admin/delete-question/${subject}/${level}/${encodeURIComponent(validationResult.questionId)}`,
            {
              method: "DELETE",
            }
          );
          const deleteData = await deleteResponse.json();
          if (!deleteResponse.ok) {
            console.error("❌ Failed to delete question:", deleteData.message);
            debugInfo.reasons.push(
              `⚠️ Warning: Failed to delete question: ${deleteData.message}`
            );
          } else {
            console.log("✅ Question deleted successfully.");
            debugInfo.reasons.push("✅ Question deleted from system.");
          }
        } catch (deleteError) {
          console.error("❌ Error deleting question:", deleteError);
          debugInfo.reasons.push(
            `⚠️ Error deleting question: ${deleteError.message}`
          );
        }
      } else {
        // Validation passed - update validation status via API
        console.log("✅ Marking question as validated...");
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/admin/update-validation-status`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject,
                level,
                questionId: validationResult.questionId,
                isValidated: true,
              }),
            }
          );
          const data = await response.json();
          if (!response.ok) {
            console.error(
              "❌ Failed to update validation status:",
              data.message
            );
            debugInfo.reasons.push(
              `⚠️ Warning: Failed to update validation status: ${data.message}`
            );
          } else {
            console.log("✅ Validation status updated successfully.");
            debugInfo.reasons.push("✅ Question marked as validated.");
          }
        } catch (updateError) {
          console.error("❌ Error updating validation status:", updateError);
          debugInfo.reasons.push(
            `⚠️ Error updating validation status: ${updateError.message}`
          );
        }
      }

      // Save validation result to localStorage
      localStorage.setItem(
        "questionValidationResult",
        JSON.stringify(validationResult)
      );

      // Prepare validation result for modal
      const modalResult = {
        passed,
        subject,
        level,
        questionId: validationResult.questionId,
        debugInfo,
        reasons: debugInfo.reasons,
      };
      
      setValidationResult(modalResult);
      setShowValidationModal(true);
    } catch (error) {
      console.error("❌ Validation submission error:", error);
      const errorResult = {
        passed: false,
        subject,
        level,
        questionId: validationQuestionId?.toString().trim().replace(/^['"]|['"]$/g, '') || validationQuestionId,
        debugInfo: { reasons: [`An error occurred: ${error.message}`] },
        reasons: [`An error occurred: ${error.message}`, "Check console for details."],
      };
      setValidationResult(errorResult);
      setShowValidationModal(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    validationStatus,
    validationQuestionId,
    subject,
    level,
    navigate,
    examParts,
  ]);

  const handleSubmissionModalConfirm = useCallback(async () => {
    if (document.fullscreenElement) {
      await document
        .exitFullscreen()
        .catch((err) => console.error("Error exiting fullscreen:", err));
    }
    setSubmissionResult(null);
    navigate("/dashboard");
  }, [navigate]);

  const handleSubmitExam = useCallback(async () => {
    if (isAdminValidationMode) {
      handleAdminValidationSubmit();
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsFinalSubmission(true);

    const passedCount = Object.values(validationStatus).filter(
      (status) => status === true
    ).length;
    const allPartsPassed = passedCount === examParts.length;

    const answers = examParts.map((p) => ({
      questionId: p.taskId || p.id,
      partId: p.part_id || p.id, // Handles both multi-part and single-part questions
      code: allCode[p.id] || "",
      passed: !!validationStatus[p.id],
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/evaluate/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          username: user.username,
          subject,
          level,
          answers,
        }),
      });
      if (!response.ok)
        throw new Error(`Server responded with status: ${response.status}`);
      const data = await response.json();

      if (data.updatedUser) {
        updateUserSession(data.updatedUser);
      }

      // Store the full report from the backend to show in the modal
      setPerformanceReport({
        answers: answers,
        performance: data.performance_metrics || [],
      });
    } catch (error) {
      console.error("Submission error:", error);
      // Show a simple alert for final submission errors
      setSubmissionResult(
        `An error occurred during final submission: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    examParts,
    allCode,
    user,
    subject,
    level,
    sessionId,
    validationStatus,
    updateUserSession,
  ]);

  useEffect(() => {
    if (hasExamStarted) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasExamStarted, handleSubmitExam]);

  const showWarningPopup = useCallback((message) => {
    setWarningMessage(message);
  }, []);

  // --- UPDATE THE HOOK CALL ---
  const { startExam, reEnterFullScreen } = useFullScreenExamSecurity(
    handleSubmitExam,
    3,
    showWarningPopup,
    securityConfig,
    isFinalSubmission,
    user?.role
  );

  // --- ADD useEffect TO FETCH THE CONFIG ---
  useEffect(() => {
    const fetchCourseConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/courses`);
        if (!res.ok) throw new Error("Network response was not ok");
        const config = await res.json();
        // Set the entire security object from the response
        setSecurityConfig(config.security);
      } catch (error) {
        console.error(
          "Failed to fetch course config, defaulting to secure settings:",
          error
        );
        // Fail securely by enabling all restrictions
        setSecurityConfig({
          copy: true,
          paste: true,
          select: true,
          cut: true,
          fullscreen: true,
          tabswitchwarning: true,
        });
      } finally {
        setIsConfigLoading(false);
      }
    };
    fetchCourseConfig();
  }, []);

  const handleStartExamClick = async () => {
    // We handle the fullscreen request directly in the click handler.
    if (securityConfig?.fullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        // If fullscreen is successful, THEN we activate security and start the exam.
        startExam();
        setHasExamStarted(true);
      } catch (err) {
        alert(
          "Fullscreen is required to start the exam. Please enable it in your browser and try again."
        );
      }
    } else {
      // If fullscreen is not required, just start the exam.
      startExam();
      setHasExamStarted(true);
    }
  };

  const handleWarningConfirm = () => {
    setWarningMessage("");
    reEnterFullScreen();
  };

  const attemptSubmit = () => {
    setShowConfirmSubmit(true);
  };

  useEffect(() => {
    // For admin validation mode, we still need a session for code execution
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    const startUserSession = async () => {
      setIsSessionReady(false);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/evaluate/session/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: newSessionId }),
          }
        );
        if (!response.ok)
          throw new Error(`Server responded with status: ${response.status}`);
        setIsSessionReady(true);
      } catch (error) {
        console.error("Failed to start kernel session:", error);
        // For admin validation, allow proceeding even if session fails (for viewing only)
        if (isAdminValidationMode) {
          setIsSessionReady(true);
        }
      }
    };
    startUserSession();
  }, [isAdminValidationMode]);

  useEffect(() => {
    if (!sessionId && !isAdminValidationMode) return;
    const fetchAndPrepareQuestions = async () => {
      try {
        let data = [];

        if (isAdminValidationMode) {
          // Validate question - fetch from API and find by ID
          const fetchUrl = `${API_BASE_URL}/api/admin/questions/all/${subject}/${level}`;
          const res = await fetch(fetchUrl);
          if (!res.ok)
            throw new Error(`Failed to fetch questions: ${res.status}`);
          data = await res.json();

          // Normalize the validation question ID - trim quotes and whitespace
          const normalizedValidationId = validationQuestionId?.toString().trim().replace(/^['"]|['"]$/g, '');
          
          // Try to find the question - handle both string and number IDs
          const questionToValidate = data.find((q) => {
            const qId = q.id?.toString().trim();
            return qId === normalizedValidationId || 
                   qId === String(normalizedValidationId) || 
                   String(qId) === normalizedValidationId ||
                   Number(qId) === Number(normalizedValidationId);
          });

          if (questionToValidate) {
            // The exam will now consist of only this one question and all its parts.
            data = [questionToValidate];
          } else {
            console.error('Available question IDs:', data.map(q => q.id));
            console.error('Looking for ID:', normalizedValidationId);
            throw new Error(
              `Question with ID "${normalizedValidationId}" not found in this level. Found ${data.length} questions.`
            );
          }
        } else {
          // Regular student mode - fetch questions normally
          const fetchUrl = `${API_BASE_URL}/api/questions/${subject}/${level}`;
          const res = await fetch(fetchUrl);
          if (!res.ok)
            throw new Error(`Failed to fetch questions: ${res.status}`);
          data = await res.json();
        }

        if (!Array.isArray(data) || data.length === 0) {
          setExamParts([]);
          setMainTask(null);
          return;
        }

        // The rest of the original logic for handling single vs. multi-part questions remains the same.
        const isMultiPartProject = data[0]?.parts?.length > 0;
        if (isMultiPartProject) {
          const task = data[0];
          setMainTask(task);
          const partsAsQuestions = task.parts.map((part) => ({
            id: `${task.id}_${part.part_id}`,
            taskId: task.id,
            ...part,
          }));
          setExamParts(partsAsQuestions);
          const initialCode = {};
          partsAsQuestions.forEach((p) => {
            initialCode[p.id] = p.starter_code || "";
          });
          setAllCode(initialCode);
        } else {
          setMainTask(null);
          setExamParts(data);
          const initialCode = {};
          data.forEach((q) => {
            initialCode[q.id] = q.starter_code || "";
          });
          setAllCode(initialCode);
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        if (isAdminValidationMode) {
          alert(`Error: ${error.message}`);
          navigate("/admin");
        }
      }
    };
    fetchAndPrepareQuestions();
  }, [subject, level, sessionId]);

  const handleCodeChange = (partId, newCode) => {
    setAllCode((prev) => ({ ...prev, [partId]: newCode }));
    setValidationStatus((prev) => ({ ...prev, [partId]: undefined }));
    setCellResults((prev) => ({ ...prev, [partId]: null }));
  };
  const handleCustomInputChange = (partId, value) => {
    setCustomInputs((prev) => ({ ...prev, [partId]: value }));
  };
  const handleToggleCustomInput = (partId) => {
    setIsCustomInputEnabled((prev) => ({ ...prev, [partId]: !prev[partId] }));
  };
  const handleRunCell = async (partId) => {
    if (!sessionId || !isSessionReady) return;
    setIsExecuting(true);
    setCellResults((prev) => ({ ...prev, [partId]: null }));
    const currentPart = examParts.find((p) => p.id === partId);
    const cellCode = allCode[partId] || "pass";
    const useDefaultInput = !isCustomInputEnabled[partId];
    const userInput = useDefaultInput
      ? currentPart.test_cases?.[0]?.input || ""
      : customInputs[partId] || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/evaluate/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          cellCode,
          userInput,
          username: user.username,
          subject,
          level,
          questionId: currentPart.taskId || currentPart.id,
          partId: currentPart.part_id || null,
        }),
      });
      if (!res.ok) throw new Error(`Server error on run: ${res.status}`);
      const result = await res.json();
      setCellResults((prev) => ({
        ...prev,
        [partId]: {
          stdout: result.stdout,
          stderr: result.stderr,
          test_results: null,
        },
      }));
      if (!result.stderr && validationStatus[partId] === undefined) {
        setValidationStatus((prev) => ({ ...prev, [partId]: false }));
      }
    } catch (error) {
      console.error("Run Code Error:", error);
      setCellResults((prev) => ({
        ...prev,
        [partId]: {
          stderr: "Failed to connect to the execution server.",
          test_results: null,
        },
      }));
    } finally {
      setIsExecuting(false);
    }
  };
  const handleValidateCell = async (partId) => {
    if (!sessionId || !isSessionReady) return;
    setIsExecuting(true);
    setCellResults((prev) => ({ ...prev, [partId]: null }));
    const currentPart = examParts.find((p) => p.id === partId);
    const cellCode = allCode[partId] || "pass";
    try {
      const res = await fetch(`${API_BASE_URL}/api/evaluate/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          username: user.username,
          subject,
          level,
          questionId: currentPart.taskId || currentPart.id,
          partId: currentPart.part_id || null,
          cellCode,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setCellResults((prev) => ({ ...prev, [partId]: data }));
      const allPassed =
        data.test_results &&
        data.test_results.length > 0 &&
        data.test_results.every((p) => p === true);
      setValidationStatus((prev) => ({ ...prev, [partId]: allPassed }));
    } catch (error) {
      console.error("Submission Error:", error);
      setCellResults((prev) => ({
        ...prev,
        [partId]: { stderr: "Submission failed.", test_results: null },
      }));
      setValidationStatus((prev) => ({ ...prev, [partId]: false }));
    } finally {
      setIsExecuting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // --- ADD A LOADING STATE ---
  if (isConfigLoading) {
    return <Spinner />;
  }

  if (examParts.length === 0 && hasExamStarted) return <Spinner />;
  const currentPart = examParts[currentQuestionIndex];
  const getQuestionBoxColor = (partId, index) => {
    const validated = validationStatus[partId];
    const codePresent = !!allCode[partId];
    let baseColor = "bg-gray-400";
    if (validated === true) baseColor = "bg-green-600";
    else if (validated === false || (codePresent && validated === undefined))
      baseColor = "bg-blue-600";
    if (index === currentQuestionIndex) return "bg-purple-600 text-white";
    return baseColor;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <PerformanceReportModal
        report={performanceReport}
        onConfirm={handleSubmissionModalConfirm}
        subject={subject}
      />
      {submissionResult && (
        <AlertCard
          message={submissionResult}
          onConfirm={handleSubmissionModalConfirm}
        />
      )}
      {warningMessage && (
        <AlertCard message={warningMessage} onConfirm={handleWarningConfirm} />
      )}
      {showConfirmSubmit && (
        <AlertCard
          message="Are you sure you want to finish the exam?"
          onConfirm={() => {
            setShowConfirmSubmit(false);
            handleSubmitExam();
          }}
          onCancel={() => setShowConfirmSubmit(false)}
          showCancel={true}
        />
      )}
      {!hasExamStarted ? (
        <div className="flex flex-col items-center justify-center h-full bg-slate-800 text-white">
          <h1 className="text-4xl font-bold mb-4">
            {subject.charAt(0).toUpperCase() + subject.slice(1)} Exam - Level{" "}
            {level}
          </h1>
          <p className="text-lg mb-8">
            Click the button below to start the exam.
          </p>
          <button
            onClick={handleStartExamClick}
            className="px-8 py-3 rounded-lg font-semibold text-white bg-purple-500 hover:bg-purple-600 text-xl"
          >
            Start Exam
          </button>
          {(securityConfig?.fullscreen || securityConfig?.tabswitchwarning) && (
            <p className="mt-8 text-sm text-yellow-400">
              Warning: Leaving the exam window will result in the exam being
              submitted automatically.
            </p>
          )}
        </div>
      ) : (
        <>
          <header className="flex sticky top-0 z-30 items-center min-h-[70px] px-4 bg-white border-b border-gray-200">
            <div className="ml-2 px-2 mr-2 items-center content-center rounded-md bg-gray-100 h-[55px]">
              <h4 className="font-bold text-lg text-slate-800">
                {subject.charAt(0).toUpperCase() + subject.slice(1)} Exam -
                Level {level}
              </h4>
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="lg:w-[250px] mt-1 w-[50px] sm:w-20 mr-4 h-[55px] justify-start rounded-md flex items-center gap-3 bg-gray-100"
            >
              <div className="flex justify-center items-center w-full lg:w-[50px] h-full">
                <img
                  src={userpng}
                  alt="user"
                  className="w-10 h-10 rounded-full object-cover items-center"
                />
              </div>
              <div className="hidden lg:flex py-4 flex-col text-left">
                <span className="text-[13px] mb-0.5 font-medium text-gray-800">
                  {user?.rollno || "-----------"}
                </span>
                <span className="text-[16px] font-semibold text-gray-900">
                  {user?.username?.toUpperCase()}
                </span>
              </div>
            </button>
            <div className="flex-grow flex justify-center items-center">
              <span className="text-lg font-semibold text-gray-800">
                Time Left: {formatTime(timeLeft)}
              </span>
            </div>
            <button
              className="px-8 py-2 rounded-lg font-semibold text-white bg-red-500 disabled:opacity-60"
              onClick={attemptSubmit}
              disabled={isSubmitting}
            >
              Finish Now
            </button>
          </header>
          <div className="flex flex-grow min-h-0">
            <div className="w-[180px] flex-shrink-0 bg-white border-r border-gray-200 p-6 overflow-y-auto">
              <h3 className="text-xl font-bold mb-5 text-slate-800">Parts</h3>
              <div className="grid grid-cols-2 gap-3">
                {examParts.map((part, index) => (
                  <button
                    key={part.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`flex items-center justify-center w-16 h-16 rounded-lg text-white font-bold text-xl ${getQuestionBoxColor(
                      part.id,
                      index
                    )}`}
                    title={`Part ${index + 1}: ${part.title || "Untitled"}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <div className="bg-white min-h-0 max-w-[200px] mt-8 p-4 rounded-2xl shadow-lg border border-gray-100">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-purple-600 rounded-sm flex-shrink-0 shadow-sm"></div>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">
                      Current Part
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-green-600 rounded-sm flex-shrink-0 shadow-sm"></div>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">
                      Passed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-blue-600 rounded-sm flex-shrink-0 shadow-sm"></div>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">
                      Attempted
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-gray-400 rounded-sm flex-shrink-0 shadow-sm"></div>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">
                      Not Attempted
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <main className="flex-grow flex flex-col min-h-0 bg-gray-50 overflow-auto">
              {currentPart ? (
                <div className="flex flex-grow w-full">
                  <CodeCell
                    key={currentPart.id}
                    question={currentPart}
                    mainTask={mainTask}
                    cellCode={allCode[currentPart.id] || ""}
                    onCodeChange={(value) =>
                      handleCodeChange(currentPart.id, value)
                    }
                    onRun={() => handleRunCell(currentPart.id)}
                    onValidate={() => handleValidateCell(currentPart.id)}
                    cellResult={cellResults[currentPart.id]}
                    isExecuting={isExecuting || isSubmitting}
                    isValidated={validationStatus[currentPart.id]}
                    customInput={customInputs[currentPart.id] || ""}
                    onCustomInputChange={(value) =>
                      handleCustomInputChange(currentPart.id, value)
                    }
                    isCustomInputEnabled={
                      !!isCustomInputEnabled[currentPart.id]
                    }
                    onToggleCustomInput={() =>
                      handleToggleCustomInput(currentPart.id)
                    }
                    isSessionReady={isSessionReady}
                    securityConfig={securityConfig}
                  />
                </div>
              ) : (
                <div className="flex flex-grow items-center justify-center">
                  <Spinner />
                </div>
              )}
            </main>
          </div>
          <UserProfileModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            user={user}
          />
          <ValidationResultModal
            isOpen={showValidationModal}
            onClose={() => {
              setShowValidationModal(false);
              setValidationResult(null);
              navigate("/admin");
            }}
            result={validationResult}
          />
        </>
      )}
    </div>
  );
};

export default ML_ExamPage;
