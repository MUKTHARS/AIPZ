import React, { useState, useEffect } from "react";
import { SelectInput, Button, Card, Spinner, Alert } from "./SharedComponents";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper function to format subject keys into readable labels
const createSubjectLabel = (key) => {
  if (!key) return "";
  // Handles keys like "Generative AI" or "R Programming" as well as "ml"
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

const ViewQuestions = () => {
  const [subjectsData, setSubjectsData] = useState({});
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        // MODIFICATION 1: Fetch from the correct '/api/questions' endpoint
        const res = await fetch(`${API_BASE_URL}/api/questions`);
        if (!res.ok) throw new Error("Failed to fetch course data");
        const data = await res.json();
        // MODIFICATION 2: Set the state directly with the new data structure
        setSubjectsData(data);
      } catch (err) {
        setError("Could not load subject and level data from the server.");
      }
    };
    fetchCourseData();
  }, []);

  const handleFetchQuestions = async () => {
    if (!selectedSubject || !selectedLevel) {
      setError("Please select both a subject and a level.");
      return;
    }
    setIsLoading(true);
    setError("");
    setQuestions([]);

    const fetchUrl = `${API_BASE_URL}/api/admin/questions/all/${selectedSubject}/${selectedLevel}`;
    try {
      const res = await fetch(fetchUrl);
      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      setError(err.message || "An error occurred while fetching questions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (questionId) => {
    setQuestionToDelete(questionId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/delete-question/${selectedSubject}/${selectedLevel}/${questionToDelete}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Failed to delete the question.");
      setQuestions((prev) => prev.filter((q) => q.id !== questionToDelete));
    } catch (err) {
      setError(err.message);
    } finally {
      setShowDeleteConfirm(false);
      setQuestionToDelete(null);
    }
  };

  // MODIFICATION 3: Update how options are generated based on the new data structure
  const subjectOptions = Object.keys(subjectsData).map((s) => ({
    value: s,
    label: createSubjectLabel(s), // Use helper to create a nice label
  }));

  const levelOptions = (subjectsData[selectedSubject] || []).map((l) => ({
    value: l.replace("level", ""),
    label: `Level ${l.replace("level", "")}`,
  }));

  return (
    <Card title="View Questions">
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm mx-auto">
            <h3 className="text-lg font-bold text-slate-800">
              Confirm Deletion
            </h3>
            <p className="my-4 text-slate-600">
              Are you sure you want to delete this question? This action cannot
              be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <SelectInput
            label="Subject"
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedLevel("");
              setQuestions([]);
            }}
            options={subjectOptions}
            placeholder="Select a subject"
          />
          <SelectInput
            label="Level"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            options={levelOptions}
            disabled={!selectedSubject}
            placeholder="Select a level"
          />
          <Button
            onClick={handleFetchQuestions}
            disabled={isLoading || !selectedLevel}
          >
            {isLoading ? "Fetching..." : "Fetch Questions"}
          </Button>
        </div>
        {error && <Alert type="error" message={error} />}
        {isLoading && (
          <div className="flex justify-center p-8">
            <p>Loading...</p>
          </div>
        )}

        {questions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Total Questions Found: {questions.length}
            </h3>
            <div className="space-y-3">
              {questions.map((q, index) => (
                <details
                  key={q.id}
                  className="bg-slate-50 border border-slate-200 rounded-lg open:shadow-md"
                >
                  <summary className="p-4 cursor-pointer font-semibold text-slate-800 flex justify-between items-center">
                    <span className="flex items-center">
                      {index + 1}. {q.title} (ID: {q.id})
                    </span>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteClick(q.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </summary>
                  <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{q.description}</ReactMarkdown>
                    </div>

                    {q.page_link_that_need_to_be_scrapped && (
                      <div className="mt-4 text-sm">
                        <h4 className="font-semibold mb-1">Link to Scrape:</h4>
                        <a
                          href={q.page_link_that_need_to_be_scrapped}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {q.page_link_that_need_to_be_scrapped}
                        </a>
                      </div>
                    )}

                    {(selectedSubject === 'ml' || selectedSubject === 'ds') && q.parts ? (
                      <div className="mt-4">
                        {q.datasets && (
                            <div className="mb-4">
                                <h4 className="font-semibold text-sm mb-2">Datasets:</h4>
                                <div className="text-xs font-mono bg-gray-100 p-3 rounded border border-gray-300">
                                    <p><strong>Train:</strong> {q.datasets.train}</p>
                                    <p><strong>Test:</strong> {q.datasets.test}</p>
                                </div>
                            </div>
                        )}
                        <h4 className="font-semibold text-sm mb-2">Parts:</h4>
                        {q.parts.map((part, i) => (
                          <div key={i} className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                            <h5 className="font-bold text-slate-800">{part.part_id}</h5>
                            <div className="prose prose-sm max-w-none my-2">
                                <ReactMarkdown>{part.description}</ReactMarkdown>
                            </div>
                            
                            <div className="mt-3 text-xs border-t border-slate-200 pt-3">
                                <h6 className="font-semibold text-sm mb-1 text-slate-700">Evaluation Details</h6>
                                <div className="space-y-1 font-mono bg-slate-100 p-2 rounded">
                                    <p><strong>Type:</strong> {part.type}</p>
                                    {part.evaluation_label && <p><strong>Label:</strong> {part.evaluation_label}</p>}
                                    {part.expected_value !== undefined && <p><strong>Expected Value:</strong> {part.expected_value}</p>}
                                    {part.tolerance !== undefined && <p><strong>Tolerance:</strong> {part.tolerance}</p>}
                                    {part.placeholder_filename && <p><strong>Placeholder Filename:</strong> {part.placeholder_filename}</p>}
                                    {part.solution_file && <p><strong>Solution File:</strong> {part.solution_file}</p>}
                                    {part.key_columns && <p><strong>Key Columns:</strong> {part.key_columns.join(', ')}</p>}
                                    {part.similarity_threshold !== undefined && <p><strong>Similarity Threshold:</strong> {part.similarity_threshold}</p>}
                                    
                                    {part.expected_text && (
                                        <div>
                                            <p className="font-bold mt-2">Expected Text:</p>
                                            <pre className="whitespace-pre-wrap bg-white p-2 rounded mt-1 border border-gray-300">
                                                {part.expected_text}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {q.test_cases && q.test_cases.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-semibold text-sm mb-2">
                              Test Cases:
                            </h4>
                            {q.test_cases.map((tc, i) => (
                              <div
                                key={i}
                                className="text-xs font-mono bg-gray-100 p-3 rounded border border-gray-300 mb-2"
                              >
                                <p className="font-bold">Input:</p>
                                <pre className="whitespace-pre-wrap bg-white p-2 rounded mt-1">
                                  {tc.input}
                                </pre>
                                <p className="font-bold mt-2">Output:</p>
                                <pre className="whitespace-pre-wrap bg-white p-2 rounded mt-1">
                                  {tc.output}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ViewQuestions;