// src/pages/Image_Proceesing_ExamPage.jsx

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
import PerformanceReportModal from '../../components/PerformanceReportModal/PerformanceReportModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Utility function to strip ANSI escape codes from error messages
const stripAnsiCodes = (text) => {
  if (!text) return text;
  return String(text)
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\033\[[0-9;]*m/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\033\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
};

const AlertCard = ({ message, onConfirm, onCancel, showCancel = false }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-auto text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-semibold text-gray-800 mb-6">{message}</p>
        <div className="flex justify-center gap-4">
          {showCancel && <button className="px-6 py-2 rounded-md font-semibold text-white bg-red-500" onClick={onCancel}>Cancel</button>}
          <button className="px-6 py-2 rounded-md font-semibold text-white bg-purple-600" onClick={onConfirm}>{showCancel ? "Continue" : "OK"}</button>
        </div>
      </div>
    </div>
);

const CodeCell = ({
  question,
  cellCode,
  onCodeChange,
  onRun,
  onValidate,
  cellResult,
  isExecuting,
  isValidated,
  isSessionReady,
  inputImageUrl,
  subject,
  // <<< CHANGE 1: Receive `level` as a prop >>>
  level
}) => {
  const buildEnhancedDescription = () => {
    let enhancedDesc = question.description || "";
    if (question.datasets && typeof question.datasets === 'object') {
        const datasetEntries = Object.entries(question.datasets);
        if (datasetEntries.length > 0) {
            enhancedDesc += "\n\n---\n\n#### Datasets for this Task:\n";
            datasetEntries.forEach(([key, value]) => {
                if (value) {
                    const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    enhancedDesc += `*   **${displayName} Path:** \`'${value}'\`\n`;
                }
            });
        }
    }
    return enhancedDesc;
  };
  const fullDescription = buildEnhancedDescription();
  
  // <<< CHANGE 2: Define a variable to determine if it should behave as an image processing exam >>>
  const isImageProcessingMode =
    (subject && subject.toLowerCase().replace(/\s+/g, '') === 'imageprocessing') ||
    (subject && subject.toLowerCase().replace(/\s+/g, '') === 'deeplearning' && level === '1');

  const renderOutputContent = () => {
    if (!cellResult) return null;
    if (Array.isArray(cellResult.imageData) && cellResult.imageData.length > 0) {
      return (
        <>
          <p className="font-semibold text-slate-800 mb-2">Image Outputs:</p>
          <div className="flex flex-col gap-4">
            {cellResult.imageData.map((base64String, index) => (
              <div key={index} className="p-3 border border-indigo-200 rounded bg-white flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-500 mb-2">Image {index + 1}</span>
                <img src={`data:image/png;base64,${base64String}`} alt={`Student code output ${index + 1}`} className="max-w-full max-h-64 h-auto object-contain border rounded-md shadow-sm"/>
              </div>
            ))}
          </div>
          {cellResult.stdout && <pre className="mt-4 bg-gray-50 text-slate-800 rounded p-3 font-mono whitespace-pre-wrap break-words border border-gray-200">{stripAnsiCodes(cellResult.stdout)}</pre>}
        </>
      );
    }
    if (cellResult.stderr) {
      const cleanedError = stripAnsiCodes(cellResult.stderr);
      return (<><p className="font-semibold text-red-600 mb-2">Error:</p><pre className="bg-red-50 text-red-600 rounded p-3 font-mono whitespace-pre-wrap break-words border border-red-200">{cleanedError}</pre></>);
    }
    if (cellResult.stdout) {
      const cleanedOutput = stripAnsiCodes(cellResult.stdout);
      return (<><p className="font-semibold text-slate-800 mb-2">Output:</p><pre className=" text-slate-800 rounded p-3 font-mono whitespace-pre-wrap break-words border border-indigo-200">{cleanedOutput}</pre></>);
    }
    if (isValidated === false) {
      return (<pre className="bg-yellow-50 text-yellow-700 rounded p-3 font-mono whitespace-pre-wrap break-words border border-yellow-200">Your code ran without errors, but the output did not match the expected result.</pre>);
    }
    return <pre className="text-slate-600">No output produced.</pre>;
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full p-4 overflow-hidden">
      <div className="flex-1 bg-white rounded-lg p-6 mr-4 mb-4 md:mb-0 border border-gray-200 overflow-y-auto">
        <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{question.title}</h2>
          <ReactMarkdown>{fullDescription}</ReactMarkdown>
        </div>
        
        {/* <<< CHANGE 3: Use the new `isImageProcessingMode` variable for the condition >>> */}
        {isImageProcessingMode && inputImageUrl && (
          <div className="mt-8">
            <h4 className="text-slate-800 text-lg font-medium mb-3">Input Image</h4>
            <div className="p-3 border border-gray-200 rounded-md bg-gray-50 flex justify-center items-center">
              <img
                src={inputImageUrl}
                alt="Input for the task"
                className="max-w-full max-h-72 h-auto object-contain rounded-md shadow-md"
              />
            </div>
          </div>
        )}

        <div className="mt-8 font-medium">
          <h4 className="text-slate-800 text-lg mb-3">Validation Result</h4>
          {cellResult?.test_results ? (
            cellResult.test_results.map((passed, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 mb-3 rounded-lg border text-base ${passed ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}`}>
                {`Test Case: ${passed ? "Passed ✔" : "Failed ❌"}`}
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
          {!isSessionReady && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 bg-opacity-90"><span className="text-white text-lg font-semibold animate-pulse">Initializing Execution Environment...</span></div>}
          <Editor height="100%" language="python" theme="vs-dark" value={cellCode} onChange={(value) => onCodeChange(value || "")} options={{ minimap: { enabled: false } }} />
        </div>
        <div className="flex justify-start items-center flex-wrap gap-4 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button className="px-6 py-2 rounded-md font-semibold text-white bg-[#7D53F6] disabled:bg-gray-400" onClick={onRun} disabled={isExecuting || !isSessionReady}>Run Code</button>
          <button className="px-6 py-2 rounded-md font-semibold text-[#7D53F6] border border-[#7D53F6] bg-white disabled:text-gray-400" onClick={onValidate} disabled={isExecuting || !isSessionReady}>Submit</button>
        </div>
        {cellResult && (<div className="px-6 py-4 bg-white border-t border-slate-200"><div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-sm max-h-48 overflow-auto">{renderOutputContent()}</div></div>)}
      </div>
    </div>
  );
};

const Image_Proceesing_ExamPage = () => {
  const [examParts, setExamParts] = useState([]);
  const [allCode, setAllCode] = useState({});
  const [cellResults, setCellResults] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [inputImageUrl, setInputImageUrl] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [performanceReport, setPerformanceReport] = useState(null);

  const { subject, level } = useParams();
  const navigate = useNavigate();
  const { user, updateUserSession } = useContext(AuthContext);
  
  // Admin validation mode detection
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const validationQuestionId = queryParams.get("validate");
  const isAdminValidationMode = user?.role === "admin" && !!validationQuestionId;

  const getApiEndpoint = useCallback(() => {
    // <<< CHANGE 4: Make the API endpoint check more robust >>>
    const normalizedSubject = subject?.toLowerCase().replace(/\s+/g, '');
    if (normalizedSubject === 'imageprocessing' || (normalizedSubject === 'deeplearning' && level === '1')) {
      return `${API_BASE_URL}/api/evaluate/image-processing`;
    }
    return `${API_BASE_URL}/api/evaluate`;
  }, [subject, level]);

  const handleSubmitExam = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const answers = examParts.map((p) => ({
      questionId: p.id,
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
      setPerformanceReport({
        answers: answers,
        performance: data.performance_metrics || []
      });

    } catch (error) {
      console.error("Submission error:", error);
      // Handle submission error, maybe show an alert
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, examParts, allCode, user, subject, level, sessionId, validationStatus, updateUserSession]);


  useEffect(() => {
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
  }, [handleSubmitExam]);

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    const startUserSession = async () => {
      setIsSessionReady(false);
      const apiEndpoint = getApiEndpoint();
      try {
        const response = await fetch(`${apiEndpoint}/session/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: newSessionId })
        });
        if (!response.ok) throw new Error("Failed to start session");
        setIsSessionReady(true);
      } catch (error) {
        console.error("Failed to start kernel session:", error);
      }
    };
    startUserSession();
  }, [getApiEndpoint]);

  useEffect(() => {
    if (!sessionId && !isAdminValidationMode) return;
    const fetchQuestions = async () => {
      try {
        let data = [];
        
        if (isAdminValidationMode) {
          const fetchUrl = `${API_BASE_URL}/api/admin/questions/all/${subject}/${level}`;
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
          data = await res.json();
          
          const normalizedValidationId = validationQuestionId?.toString().trim().replace(/^['"]|['"]$/g, '');
          
          const questionToValidate = data.find((q) => {
            const qId = q.id?.toString().trim();
            return qId === normalizedValidationId || 
                   qId === String(normalizedValidationId) || 
                   String(qId) === normalizedValidationId ||
                   Number(qId) === Number(normalizedValidationId);
          });

          if (questionToValidate) {
            data = [questionToValidate];
          } else {
            console.error('Available question IDs:', data.map(q => q.id));
            console.error('Looking for ID:', normalizedValidationId);
            throw new Error(`Question with ID "${normalizedValidationId}" not found in this level. Found ${data.length} questions.`);
          }
        } else {
          const res = await fetch(`${API_BASE_URL}/api/questions/${subject}/${level}`);
          if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
          data = await res.json();
        }
        
        setExamParts(data);

        const initialCode = {};
        data.forEach((q) => { initialCode[q.id] = q.starter_code || ""; });
        setAllCode(initialCode);

        if (data.length > 0) {
            const firstQuestion = data[0];
            const imagePath = firstQuestion.datasets?.input_image;
            if (imagePath) {
                const imageUrl = `${API_BASE_URL}/api/media?path=${encodeURIComponent(imagePath)}`;
                setInputImageUrl(imageUrl);
            }
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        setInputImageUrl(null);
        if (isAdminValidationMode) {
          alert(`Error: ${error.message}`);
          navigate("/admin");
        }
      }
    };
    fetchQuestions();
  }, [subject, level, sessionId, isAdminValidationMode, validationQuestionId, navigate]);

  const handleCodeChange = (partId, newCode) => {
    setAllCode((prev) => ({ ...prev, [partId]: newCode }));
    setValidationStatus((prev) => ({ ...prev, [partId]: undefined }));
    setCellResults((prev) => ({ ...prev, [partId]: null }));
  };

  const handleApiCall = async (action, partId, cellCode) => {
    if (!sessionId || !isSessionReady) return;
    setIsExecuting(true);
    setCellResults((prev) => ({ ...prev, [partId]: null }));
    const apiEndpoint = getApiEndpoint();
    try {
      const res = await fetch(`${apiEndpoint}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, cellCode, username: user.username, subject, level, questionId: partId }),
      });
      if (!res.ok) throw new Error(`Server error on ${action}: ${res.status}`);
      const result = await res.json();
      setCellResults((prev) => ({ ...prev, [partId]: result }));
      if (action === 'validate') {
        const allPassed = result.test_results && result.test_results.every(p => p === true);
        setValidationStatus((prev) => ({ ...prev, [partId]: allPassed }));
      }
    } catch (error) {
      console.error(`${action} Code Error:`, error);
      setCellResults((prev) => ({ ...prev, [partId]: { stderr: `Failed to connect to the server for ${action}.` }}));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunCell = (partId) => handleApiCall('run', partId, allCode[partId]);
  const handleValidateCell = (partId) => handleApiCall('validate', partId, allCode[partId]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };
  
  const handleSubmissionModalConfirm = () => {
    setPerformanceReport(null);
    navigate("/dashboard");
  };

  if (examParts.length === 0) return <Spinner />;
  const currentPart = examParts[currentQuestionIndex];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
        <PerformanceReportModal report={performanceReport} onConfirm={handleSubmissionModalConfirm} subject={subject} />
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
        <header className="flex sticky top-0 z-30 items-center min-h-[70px] px-4 bg-white border-b border-gray-200">
            <h1 className="text-xl font-bold">{subject.replace(/([A-Z])/g, ' $1').trim()} Exam - Level {level}</h1>
            <div className="flex-grow flex justify-center items-center">
              <span className="text-lg font-semibold text-gray-800">
                Time Left: {formatTime(timeLeft)}
              </span>
            </div>
            <button
              className="px-8 py-2 rounded-lg font-semibold text-white bg-red-500 disabled:opacity-60"
              onClick={() => setShowConfirmSubmit(true)}
              disabled={isSubmitting}
            >
              Finish Now
            </button>
        </header>
        <div className="flex flex-grow min-h-0">
            <div className="w-[180px] flex-shrink-0 bg-white border-r border-gray-200 p-6 overflow-y-auto">
                <h3 className="text-xl font-bold mb-5 text-slate-800">Questions</h3>
                {examParts.map((part, index) => (
                    <button key={part.id} onClick={() => setCurrentQuestionIndex(index)}
                        className={`flex items-center justify-center w-16 h-16 rounded-lg text-white font-bold text-xl mb-3 ${index === currentQuestionIndex ? 'bg-purple-600' : 'bg-gray-400'}`}>
                        {index + 1}
                    </button>
                ))}
            </div>
            <main className="flex-grow flex flex-col min-h-0 bg-gray-50 overflow-auto">
                {currentPart ? (
                    <CodeCell
                        key={currentPart.id}
                        question={currentPart}
                        subject={subject}
                        // <<< CHANGE 5: Pass the `level` prop down to the CodeCell >>>
                        level={level}
                        inputImageUrl={inputImageUrl}
                        cellCode={allCode[currentPart.id] || ""}
                        onCodeChange={(value) => handleCodeChange(currentPart.id, value)}
                        onRun={() => handleRunCell(currentPart.id)}
                        onValidate={() => handleValidateCell(currentPart.id)}
                        cellResult={cellResults[currentPart.id]}
                        isExecuting={isExecuting}
                        isValidated={validationStatus[currentPart.id]}
                        isSessionReady={isSessionReady}
                    />
                ) : <Spinner />}
            </main>
        </div>
    </div>
  );
};

export default Image_Proceesing_ExamPage;