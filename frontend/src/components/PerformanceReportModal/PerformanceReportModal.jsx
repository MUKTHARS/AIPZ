// frontend/src/components/PerformanceReportModal/PerformanceReportModal.jsx

import React from 'react';
import Editor from '@monaco-editor/react';

// --- NEW, GRANULAR THRESHOLDS ---
// We now have a 'default' for each subject, and can override for specific question IDs.
const PERFORMANCE_THRESHOLDS = {
  'ds': {
    default: {
      time: { excellent: 100, good: 500 }, // Default for any DS question
      memory: { efficient: 500, moderate: 2000 }
    },
    // // Example: Override for a specific question 'q8' (Add All Numbers) which might be slower
    // 'q8': {
    //   time: { excellent: 150, good: 600 },
    //   memory: { efficient: 600, moderate: 2500 }
    // }
  },
  'ml': {
    default: {
      time: { excellent: 2000, good: 10000 }, // Default for ML
      memory: { efficient: 50000, moderate: 200000 }
    },
    // // Example: A simple feature engineering task might be faster
    // 'LR_002_Feature Engineering': {
    //   time: { excellent: 500, good: 2000 },
    //   memory: { efficient: 40000, moderate: 150000 }
    // }
  },
  'speechrecognition': {
    default: {
      time: { excellent: 1000, good: 5000 }, // Default for Speech
      memory: { efficient: 20000, moderate: 100000 }
    }
  },
  'deeplearning': {
    default: {
      time: { excellent: 5000, good: 20000 }, // Default for DL
      memory: { efficient: 100000, moderate: 500000 }
    }
  },
  'default': { // Fallback for any other subject
    default: {
      time: { excellent: 1000, good: 5000 },
      memory: { efficient: 10000, moderate: 50000 }
    }
  }
};

// --- UPDATED HELPER FUNCTIONS ---
const getPerformanceLabels = (subject, questionId, timeMs, memoryKiB) => {
  const thresholdsForSubject = PERFORMANCE_THRESHOLDS[subject] || PERFORMANCE_THRESHOLDS.default;
  
  // Use the specific question's thresholds if they exist, otherwise use the subject's default.
  const thresholds = thresholdsForSubject[questionId] || thresholdsForSubject.default;

  let timeLabel = 'Slow';
  let memoryLabel = 'Memory Intensive';

  if (timeMs < thresholds.time.excellent) timeLabel = 'Excellent';
  else if (timeMs < thresholds.time.good) timeLabel = 'Good';

  if (memoryKiB < thresholds.memory.efficient) memoryLabel = 'Efficient';
  else if (memoryKiB < thresholds.memory.moderate) memoryLabel = 'Moderate';

  return { timeLabel, memoryLabel };
};

const getLabelStyle = (label) => {
  switch (label) {
    case 'Excellent':
    case 'Efficient':
      return 'text-green-600 font-semibold';
    case 'Good':
    case 'Moderate':
      return 'text-blue-600 font-semibold';
    case 'Slow':
    case 'Memory Intensive':
      return 'text-red-600 font-semibold';
    default:
      return 'text-gray-600';
  }
};

// --- UPDATED MODAL COMPONENT ---
const PerformanceReportModal = ({ report, onConfirm, subject }) => {
  if (!report) return null;

  const normalizedSubject = subject?.replace(/\s+/g, '').toLowerCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full text-left flex flex-col max-h-[90vh]">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Exam Performance Report</h2>
        <p className="text-gray-600 mb-6">Here is a summary of your final code and its performance on a sample test case.</p>
        
        <div className="flex-grow overflow-y-auto pr-2">
          
        {report.answers.map((answer, index) => {
            const isAttempted = answer.code && answer.code.trim() !== "";
            const perf = report.performance.find(p => p.questionId === answer.questionId) || {};
            const timeMs = parseFloat(perf.execution_time_ms);
            const memoryKiB = parseFloat(perf.peak_memory_kib);
            const { timeLabel, memoryLabel } = getPerformanceLabels(normalizedSubject, answer.questionId, timeMs, memoryKiB);

            return (
              <div key={index} className="mb-6 border border-gray-200 rounded-lg">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-700">Question {index + 1}</h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm">
                    <p><strong>Status:</strong> <span className={answer.passed ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{answer.passed ? 'Passed' : (isAttempted ? 'Failed' : 'Not Attempted')}</span></p>
                    
                    {/* <<< START: THIS IS THE FIX >>> */}
                    {/* Conditionally render performance metrics only if the question was attempted */}
                    {isAttempted ? (
                      <>
                        <p><strong>Time Performance:</strong> <span className={getLabelStyle(timeLabel)}>{timeLabel}</span> ({perf.execution_time_ms || 'N/A'} ms)</p>
                        <p><strong>Memory Performance:</strong> <span className={getLabelStyle(memoryLabel)}>{memoryLabel}</span> ({perf.peak_memory_kib || 'N/A'} KiB)</p>
                      </>
                    ) : (
                      <p className="text-gray-500">No performance data for unattempted question.</p>
                    )}
                    {/* <<< END: THIS IS THE FIX >>> */}

                  </div>
                </div>
                <div className="h-64 bg-gray-800">
                  <Editor
                    height="100%"
                    language="python"
                    theme="vs-dark"
                    value={isAttempted ? answer.code : "# This question was not attempted."}
                    options={{ readOnly: true, minimap: { enabled: false } }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            className="px-6 py-2 rounded-md font-semibold text-white bg-blue-600"
            onClick={onConfirm}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceReportModal;