import React from "react";

/**
 * Modal component to display validation results for admin question validation
 * Shows pass/fail status and important information about what happens to the question
 */
const ValidationResultModal = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  const { passed, subject, level, questionId, debugInfo, reasons } = result;
  const debugMessage = reasons?.join("\n") || debugInfo?.reasons?.join("\n") || "No details available";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-4 mb-6 pb-4 border-b-2 ${passed ? 'border-green-500' : 'border-red-500'}`}>
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            {passed ? (
              <span className="text-3xl">✅</span>
            ) : (
              <span className="text-3xl">❌</span>
            )}
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${passed ? 'text-green-700' : 'text-red-700'}`}>
              Validation {passed ? "PASSED" : "FAILED"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Question Validation Result
            </p>
          </div>
        </div>

        {/* Question Information */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 min-w-[120px]">Subject:</span>
            <span className="text-gray-900 capitalize">{subject}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 min-w-[120px]">Level:</span>
            <span className="text-gray-900">{level}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 min-w-[120px]">Question ID:</span>
            <span className="text-gray-900 font-mono">{questionId}</span>
          </div>
        </div>

        {/* Details Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Validation Details:</h3>
          <div className={`rounded-lg p-4 border-2 ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {debugMessage}
            </pre>
          </div>
        </div>

        {/* Important Notice */}
        {passed ? (
          <div className="mb-6 rounded-lg p-4 bg-green-50 border-2 border-green-300">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">✅</span>
              <div>
                <p className="font-semibold text-green-800 mb-1">
                  Question Successfully Validated
                </p>
                <p className="text-green-700 text-sm">
                  This question has been <strong>saved and validated</strong>. It is now available in 
                  <strong> Level {level}</strong> of the <strong className="capitalize">{subject}</strong> subject.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-lg p-4 bg-red-50 border-2 border-red-300">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-red-800 mb-1">
                  Question Not Added
                </p>
                <p className="text-red-700 text-sm">
                  This question has been <strong className="text-red-800">automatically removed</strong> from the system 
                  because validation failed. It will <strong className="text-red-800">NOT be added</strong> to 
                  <strong> Level {level}</strong> of the <strong className="capitalize">{subject}</strong> subject.
                </p>
                <p className="text-red-600 text-xs mt-2 italic">
                  Please review the validation details above, fix any issues, and try validating again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
              passed
                ? 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500'
            } focus:outline-none focus:ring-offset-2`}
          >
            {passed ? 'Continue' : 'Return to Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationResultModal;

