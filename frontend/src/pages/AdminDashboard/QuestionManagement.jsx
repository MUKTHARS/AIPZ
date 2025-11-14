import React, { useState, useEffect, useRef } from "react";
import {
  SelectInput,
  TextInput,
  TextareaInput,
  Button,
  Alert,
  Card,
  FileUploader,
} from "./SharedComponents";
import ViewQuestions from "./ViewQuestions";
import { useNavigate, useLocation } from "react-router-dom";
import QuestionStatsTable from "./QuestionStatsTable"; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Main controller component with tab navigation
const QuestionManagement = () => {
  const [activeTab, setActiveTab] = useState("stats");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const location = useLocation();

  const handleSelectQuestionToEdit = (question, subject, level) => {
    setEditingQuestion({ ...question, subject, level });
    setActiveTab("add");
  };

  // Check if we're returning from validation
  useEffect(() => {
    // Check if there's a validation result in localStorage
    const validationResult = localStorage.getItem("questionValidationResult");
    if (validationResult) {
      // We're returning from validation
      setActiveTab("add");
      // Clear the result to prevent re-triggering
      localStorage.removeItem("questionValidationResult");
    }
  }, [location]);

return (
    <div className="space-y-6">
      <div className="flex justify-center border-b border-slate-200">
         <button
          onClick={() => {
            setActiveTab("stats");
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 ${
            activeTab === "stats"
              ? "border-b-2 border-purple-600 text-purple-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Question Statistics
        </button>
        <button
          onClick={() => {
            setActiveTab("add");
            setEditingQuestion(null);
            localStorage.removeItem("questionFormState");
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 ${
            activeTab === "add"
              ? "border-b-2 border-purple-600 text-purple-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {editingQuestion ? "Edit Question" : "Add Question"}
        </button>
        <button
          onClick={() => setActiveTab("view")}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 ${
            activeTab === "view"
              ? "border-b-2 border-purple-600 text-purple-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          View Questions
        </button>

       
      </div>

      <div className={activeTab === "stats" ? "block" : "hidden"}>
        <QuestionStatsTable />
      </div>
      <div className={activeTab === "add" ? "block" : "hidden"}>
        <AddQuestionFlow
          questionToEdit={editingQuestion}
          onUpdateComplete={() => {
            setEditingQuestion(null);
            setActiveTab("view");
          }}
        />
      </div>
      <div className={activeTab === "view" ? "block" : "hidden"}>
        <ViewQuestions onSelectQuestion={handleSelectQuestionToEdit} />
      </div>
    </div>
  );
};

// Add/Edit Question Flow Component
const AddQuestionFlow = ({ questionToEdit, onUpdateComplete }) => {
  const isEditMode = Boolean(questionToEdit);

  const [subjectsData, setSubjectsData] = useState({});
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageLink, setPageLink] = useState("");

  // For programming questions
  const [testCases, setTestCases] = useState([
    { input: "", expected_output: "" },
  ]);

  // For ML/DS questions with parts
  const [trainFile, setTrainFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [parts, setParts] = useState([
    {
      part_id: "",
      type: "text_similarity",
      description: "",
      expected_text: "",
      similarity_threshold: 0.9,
      evaluation_label: "",
      expected_value: 0,
      tolerance: 0.02,
      placeholder_filename: "",
      solution_file: null,
      key_columns: [],
    },
  ]);

  // For Image Processing questions
  const [numberOfOutputs, setNumberOfOutputs] = useState(1);
  const [outputFiles, setOutputFiles] = useState([null]);
  const [inputImage, setInputImage] = useState(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [starterCode, setStarterCode] = useState("");

  // For Speech Recognition questions
  const [speechInputFile, setSpeechInputFile] = useState(null);
  const [speechSolutionFile, setSpeechSolutionFile] = useState(null);

  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const navigate = useNavigate();

  // Track validation window reference
  const validationWindowRef = useRef(null);

  // Function to save form state to localStorage
  const saveFormState = () => {
    const formState = {
      subject,
      level,
      title,
      description,
      pageLink,
      testCases,
      parts,
      numberOfOutputs,
      similarityThreshold,
      starterCode,
    };
    localStorage.setItem("questionFormState", JSON.stringify(formState));
  };

  // Function to restore form state from localStorage
  const restoreFormState = () => {
    const savedState = localStorage.getItem("questionFormState");
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setIsRestoring(true);
        
        // Restore all state values
        if (parsedState.subject) setSubject(parsedState.subject);
        if (parsedState.level) setLevel(parsedState.level);
        if (parsedState.title) setTitle(parsedState.title);
        if (parsedState.description) setDescription(parsedState.description);
        if (parsedState.pageLink) setPageLink(parsedState.pageLink);
        if (parsedState.testCases) setTestCases(parsedState.testCases);
        if (parsedState.parts) setParts(parsedState.parts);
        if (parsedState.numberOfOutputs) setNumberOfOutputs(parsedState.numberOfOutputs);
        if (parsedState.similarityThreshold) setSimilarityThreshold(parsedState.similarityThreshold);
        if (parsedState.starterCode) setStarterCode(parsedState.starterCode);
        
        // Check if there's a validation result
        const validationResult = localStorage.getItem("questionValidationResult");
        if (validationResult) {
          const result = JSON.parse(validationResult);
          if (result.passed) {
            setIsValidated(true);
            setMessage({
              type: "success",
              text: "Question validation completed successfully! You can now add this question.",
            });
          }
          // Clear the validation result
          localStorage.removeItem("questionValidationResult");
        }
        
        setIsRestoring(false);
        return true;
      } catch (error) {
        console.error("Error restoring form state:", error);
        setIsRestoring(false);
        return false;
      }
    }
    return false;
  };

  // Function to clear form state from localStorage
  const clearFormState = () => {
    localStorage.removeItem("questionFormState");
    localStorage.removeItem("questionValidationResult");
    localStorage.removeItem("pendingQuestionValidation");
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/questions`);
      if (!res.ok) throw new Error("Failed to fetch course data");
      const data = await res.json();
      setSubjectsData(data);
    } catch (error) {
      console.error("Failed to fetch subjects structure:", error);
      setMessage({ type: "error", text: "Could not load subjects." });
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Effect to pre-fill the form when editing or restoring from validation
  useEffect(() => {
    if (isEditMode && questionToEdit) {
      // Edit mode - populate from questionToEdit
      setSubject(questionToEdit.subject || "");
      setLevel(questionToEdit.level || "");
      setTitle(questionToEdit.title || "");
      setDescription(questionToEdit.description || "");
      setStarterCode(questionToEdit.starter_code || "");
      setPageLink(questionToEdit.page_link_that_need_to_be_scrapped || "");

      if (questionToEdit.test_cases) {
        setTestCases(
          questionToEdit.test_cases.map((tc) => ({
            input: tc.input,
            expected_output: tc.output,
          }))
        );
      }

      if (questionToEdit.parts) {
        setParts(
          questionToEdit.parts.map((p) => ({
            ...p,
            key_columns: p.key_columns || [],
            solution_file: null,
          }))
        );
      }

      if (questionToEdit.No_of_outputs) {
        const numOutputs = parseInt(questionToEdit.No_of_outputs, 10);
        setNumberOfOutputs(numOutputs);
        setOutputFiles(new Array(numOutputs).fill(null));
        setSimilarityThreshold(questionToEdit.compare_similarity || 0.8);
      }
    } else {
      // Not edit mode - try to restore from validation
      restoreFormState();
    }
  }, [questionToEdit, isEditMode]);

  // Reset validation when form fields change (but not during initial restore)
  useEffect(() => {
    if (!isRestoring) {
      setIsValidated(false);
      // Save form state whenever it changes (but not during initial load)
      if (subject || level || title) {
        saveFormState();
      }
    }
  }, [
    subject,
    level,
    title,
    description,
    testCases,
    parts,
    numberOfOutputs,
    outputFiles,
    inputImage,
    speechInputFile,
    speechSolutionFile,
    pageLink,
    similarityThreshold,
    starterCode,
  ]);

  // Enhanced validation completion checker with window auto-close
  useEffect(() => {
    const checkValidationStatus = () => {
      const validationResult = localStorage.getItem("questionValidationResult");
      const pendingValidation = localStorage.getItem("pendingQuestionValidation");

      if (validationResult && pendingValidation) {
        const result = JSON.parse(validationResult);
        const pending = JSON.parse(pendingValidation);

        // Check if this validation is for the current form
        if (
          result.subject === subject &&
          result.level === level &&
          result.questionId === pending.questionId
        ) {
          if (result.passed) {
            setIsValidated(true);
            setIsValidating(false);
            setMessage({
              type: "success",
              text: "Question validation completed successfully! You can now add this question.",
            });
          } else {
            setIsValidated(false);
            setIsValidating(false);
            setMessage({
              type: "error",
              text: "Question validation failed. The question has been removed from the system. Please review and try again.",
            });
          }
          
          // Clean up localStorage
          localStorage.removeItem("questionValidationResult");
          localStorage.removeItem("pendingQuestionValidation");
          
          // Close the validation window if it's still open
          if (validationWindowRef.current && !validationWindowRef.current.closed) {
            validationWindowRef.current.close();
            validationWindowRef.current = null;
          }
          
          // Focus back on this window
          window.focus();
        }
      }
    };

    // Check every 1 second for validation result
    const interval = setInterval(checkValidationStatus, 1000);
    return () => clearInterval(interval);
  }, [subject, level]);

  // Cleanup validation window on component unmount
  useEffect(() => {
    return () => {
      if (validationWindowRef.current && !validationWindowRef.current.closed) {
        validationWindowRef.current.close();
      }
    };
  }, []);

  const normalizedSubject = subject
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  // MODIFIED: Include deeplearning with level 1 as image processing questions
  const isImageProcessingQuestion = normalizedSubject === "imageprocessing" || 
                                  (normalizedSubject === "deeplearning" && level === "1");
  
  // MODIFIED: Include generativeai with level 1 and 2 as speech recognition questions
  const isSpeechRecognitionQuestion = normalizedSubject === "speechrecognition" || 
                                    (normalizedSubject === "generativeai" && (level === "1" || level === "2"));
const isPartsBasedQuestion =
  (normalizedSubject === "ml") ||
  (normalizedSubject === "deeplearning" && level !== "1" && level !== "2" && level !== "3") ||
  (normalizedSubject === "ds" && level && level !== "1" );
  // MODIFIED: Exclude deeplearning with level 1 from parts-based questions
//   const isPartsBasedQuestion =
//     (normalizedSubject === "ml" || (normalizedSubject === "deeplearning" && level !== "1" && level !== "2" && level !== "3")) ||
//   (normalizedSubject === "ds" && level && level !== "1" && level !== "3" && level !== "4" );    

//   const showDatasetUploads = ["ml", "deeplearning"].includes(normalizedSubject);
const showDatasetUploads = ["ml", "deeplearning", "ds"].includes(normalizedSubject);
  // Generate the base path for datasets
  const getBasePath = (type) => {
    if (!title || !level) return "";
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
    const subjectType = type.toLowerCase();

    if (subjectType === "ml") {
      return `/home/student/Desktop/PS/backend/data/datasets/ml/level_${level}/${sanitizedTitle}`;
    }
    if (subjectType === "ds") {
      return `/home/student/Desktop/PS/backend/data/datasets/ds/level_${level}/${sanitizedTitle}`;
    }
    if (subjectType === "imageprocessing" || (subjectType === "deeplearning" && level === "1")) {
      return `/home/student/Desktop/PS/backend/data/datasets/imageprocessing/Task_${sanitizedTitle}`;
    }
    // MODIFIED: Add path for generativeai (using the same path structure as speech recognition)
    if (subjectType === "generativeai") {
      return `/home/student/Desktop/PS/backend/data/datasets/generativeai/level_${level}/${sanitizedTitle}`;
    }
    return "";
  };
  
  const mlBasePath = getBasePath("ml");
  const dsBasePath = getBasePath("ds");
  const imageProcessingBasePath = getBasePath("imageprocessing");
  // MODIFIED: Add path for generativeai
  const generativeAiBasePath = getBasePath("generativeai");

  // Test case handlers
  const handleTestCaseChange = (index, field, value) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
  };

  const addTestCase = () => {
    if (testCases.length < 5) {
      setTestCases([...testCases, { input: "", expected_output: "" }]);
    }
  };

  const removeTestCase = (index) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  // Part handlers
  const handlePartChange = (index, field, value) => {
    const newParts = [...parts];
    newParts[index][field] = value;
    setParts(newParts);
  };

  const handlePartFileChange = (index, file) => {
    const newParts = [...parts];
    newParts[index].solution_file = file;
    setParts(newParts);
  };

  const handleKeyColumnsChange = (index, value) => {
    const newParts = [...parts];
    newParts[index].key_columns = value.split(",").map((col) => col.trim());
    setParts(newParts);
  };

  const addPart = () => {
    if (parts.length < 5) {
      setParts([
        ...parts,
        {
          part_id: "",
          type: "text_similarity",
          description: "",
          expected_text: "",
          similarity_threshold: 0.9,
          evaluation_label: "",
          expected_value: 0,
          tolerance: 0.02,
          placeholder_filename: "",
          solution_file: null,
          key_columns: [],
        },
      ]);
    }
  };

  const removePart = (index) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  // Handlers for Image Processing fields
  const handleNumberOfOutputsChange = (e) => {
    let count = parseInt(e.target.value, 10) || 0;
    count = Math.max(0, Math.min(5, count));
    setNumberOfOutputs(count);
    setOutputFiles((currentFiles) => {
      const newFiles = new Array(count).fill(null);
      for (let i = 0; i < Math.min(count, currentFiles.length); i++) {
        newFiles[i] = currentFiles[i];
      }
      return newFiles;
    });
  };

  const handleOutputImageChange = (index, file) => {
    const newOutputFiles = [...outputFiles];
    newOutputFiles[index] = file;
    setOutputFiles(newOutputFiles);
  };

  const handleValidate = async () => {
    // Save the question to JSON first, then navigate to validation
    if (!subject || !level || !title) {
      setMessage({
        type: "error",
        text: "Please fill in subject, level, and title before validating.",
      });
      return;
    }

    // Save form state before navigating
    saveFormState();

    setIsValidating(true);
    setMessage({ type: "info", text: "Saving question for validation..." });

    try {
      const normalizedSubject = subject
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "");
      const isImageProcessingQuestion = normalizedSubject === "imageprocessing" || 
                                      (normalizedSubject === "deeplearning" && level === "1");
      // MODIFIED: Include generativeai with level 1 and 2 as speech recognition questions
      const isSpeechRecognitionQuestion = normalizedSubject === "speechrecognition" || 
                                        (normalizedSubject === "generativeai" && (level === "1" || level === "2"));
//       const isPartsBasedQuestion =
//         (normalizedSubject === "ml" || (normalizedSubject === "deeplearning" && level !== "1" && level !== "2" && level !== "3" )) ||
//   (normalizedSubject === "ds" && level && level !== "1" && level !== "3" && level !== "4");
const isPartsBasedQuestion =
  (normalizedSubject === "ml") ||
  (normalizedSubject === "deeplearning" && level !== "1" && level !== "2" && level !== "3") ||
  (normalizedSubject === "ds" && level && level !== "1" );

      let questionId = null;

      // Save the question using the appropriate endpoint
      if (isSpeechRecognitionQuestion) {
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("level", level);
        formData.append("title", title);
        formData.append("description", description);

        if (speechInputFile) {
          formData.append("input_file", speechInputFile);
        }

        const partsData = [
          {
            part_id: "1",
            type: "csv_similarity",
            description: description,
          },
        ];

        formData.append("parts", JSON.stringify(partsData));

        if (speechSolutionFile) {
          formData.append("solution_file", speechSolutionFile);
        }

        // MODIFIED: Use the same endpoint for generativeai
        const res = await fetch(
          `${API_BASE_URL}/api/admin/add-speech-question`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || `Server error: ${res.status}`);

        const idMatch = data.message.match(/ID\s+(\S+)/i);
        questionId = idMatch ? idMatch[1] : null;
      } else if (isImageProcessingQuestion) {
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("level", level);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("No_of_outputs", numberOfOutputs);
        formData.append("compare_similarity", similarityThreshold);
        formData.append("starter_code", starterCode);

        if (inputImage) {
          formData.append("input_image", inputImage);
        }

        outputFiles.forEach((file, index) => {
          if (file) {
            formData.append(`output_${index + 1}`, file);
          }
        });

        const res = await fetch(
          `${API_BASE_URL}/api/admin/add-image-question`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || `Server error: ${res.status}`);

        const idMatch = data.message.match(/ID\s+(\S+)/i);
        questionId = idMatch ? idMatch[1] : null;
      } else if (isPartsBasedQuestion) {
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("level", level);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("page_link_that_need_to_be_scrapped", pageLink);

        if (showDatasetUploads) {
          if (trainFile) formData.append("train_file", trainFile);
          if (testFile) formData.append("test_file", testFile);
        }

        const partsData = parts.map((part, index) => {
          const basePart = {
            part_id: part.part_id,
            type: part.type,
            description: part.description,
          };
          if (part.type === "text_similarity") {
            basePart.expected_text = part.expected_text;
            basePart.similarity_threshold = parseFloat(
              part.similarity_threshold
            );
          } else if (part.type === "numerical_evaluation") {
            basePart.evaluation_label = part.evaluation_label;
            basePart.expected_value = parseFloat(part.expected_value);
            basePart.tolerance = parseFloat(part.tolerance);
          } else if (part.type === "csv_similarity") {
            basePart.placeholder_filename = part.placeholder_filename;
            basePart.key_columns = part.key_columns.filter((col) => col);
            basePart.similarity_threshold = parseFloat(
              part.similarity_threshold
            );
            if (part.solution_file) {
              basePart.has_solution_file = true;
              basePart.solution_file_key = `solution_file_${index}`;
            }
          }
          return basePart;
        });

        formData.append("parts", JSON.stringify(partsData));

        parts.forEach((part, index) => {
          if (part.type === "csv_similarity" && part.solution_file) {
            formData.append(`solution_file_${index}`, part.solution_file);
          }
        });

        let endpoint = "";
        const currentSubject = subject.toLowerCase();

        if (currentSubject === "ds") {
          endpoint = `${API_BASE_URL}/api/admin/add-ds-question`;
        } else {
          endpoint = `${API_BASE_URL}/api/admin/add-ml-question`;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || `Server error: ${res.status}`);

        const idMatch = data.message.match(/ID\s+(\S+)/i);
        questionId = idMatch ? idMatch[1] : null;
      } else {
        // Simple question
        const newQuestion = {
          title,
          description,
          test_cases: testCases
            .filter(
              (tc) => tc.input.trim() !== "" || tc.expected_output.trim() !== ""
            )
            .map((tc) => ({ input: tc.input, output: tc.expected_output })),
        };

        const res = await fetch(`${API_BASE_URL}/api/admin/add-question`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            level,
            newQuestion,
          }),
        });

        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || `Server error: ${res.status}`);

        const idMatch = data.message.match(/ID\s+'?(\S+)'?/i);
        questionId = idMatch ? idMatch[1] : null;
      }

      if (!questionId) {
        throw new Error(
          "Failed to get question ID after saving. Please try again."
        );
      }

      // Store validation context with the question ID
      const validationContext = {
        subject,
        level,
        questionId,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "pendingQuestionValidation",
        JSON.stringify(validationContext)
      );

      // Open validation in a new window/tab and store the reference
      const validationUrl = `/exam/${subject}/${level}?validate=${questionId}&admin=true`;
      validationWindowRef.current = window.open(validationUrl, '_blank');
      
      setMessage({
        type: "info",
        text: "Question saved successfully. Please complete the validation in the new tab. This tab will automatically update when validation is complete.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.message ||
          "An error occurred while saving the question for validation.",
      });
      setIsValidating(false);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();

    // If question is already validated, it means it was already saved during validation
    if (isValidated) {
      setMessage({
        type: "success",
        text: "Question has already been saved and validated during validation. No need to add again.",
      });
      // Clear form state after successful submission
      clearFormState();
      // Reset form
      setSubject("");
      setLevel("");
      setTitle("");
      setDescription("");
      setPageLink("");
      setTestCases([{ input: "", expected_output: "" }]);
      setParts([{
        part_id: "",
        type: "text_similarity",
        description: "",
        expected_text: "",
        similarity_threshold: 0.9,
        evaluation_label: "",
        expected_value: 0,
        tolerance: 0.02,
        placeholder_filename: "",
        solution_file: null,
        key_columns: [],
      }]);
      setNumberOfOutputs(1);
      setOutputFiles([null]);
      setInputImage(null);
      setSimilarityThreshold(0.8);
      setStarterCode("");
      setTrainFile(null);
      setTestFile(null);
      setSpeechInputFile(null);
      setSpeechSolutionFile(null);
      setIsValidated(false);
      return;
    }

    // Prevent submission if not validated
    setMessage({
      type: "error",
      text: "Please validate the question before adding it. Click the 'Validate Question' button first.",
    });
  };

  const subjectOptions = Object.keys(subjectsData).map((s) => ({
    value: s,
    label: subjectsData[s]?.title || s.toUpperCase(),
  }));

  const getLevels = () => {
    if (!subject || !subjectsData[subject]) return [];
    const subjectData = subjectsData[subject];
    return Array.isArray(subjectData) ? subjectData : subjectData.levels || [];
  };

  const levelOptions = getLevels().map((l) => ({
    value: l.replace("level", ""),
    label: `Level ${l.replace("level", "")}`,
  }));

  const partTypeOptions = [
    { value: "text_similarity", label: "Text Similarity" },
    { value: "numerical_evaluation", label: "Numerical Evaluation" },
    { value: "csv_similarity", label: "CSV Similarity" },
  ];

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center justify-between">
            <span>{isEditMode ? "Edit Question" : "Add Single Question"}</span>
            {subject && level && title && (
              <span className="flex items-center text-sm font-normal">
                {isValidated ? (
                  <span
                    title="Validated"
                    className="text-green-500 mr-2 flex items-center"
                  >
                    <span className="text-lg"> </span>
                    <span className="ml-1">Validated</span>
                  </span>
                ) : (
                  <span
                    title="Not Validated"
                    className="text-red-500 mr-2 flex items-center"
                  >
                    <span className="text-lg"> </span>
                    <span className="ml-1">Not Validated</span>
                  </span>
                )}
              </span>
            )}
          </div>
        }
      >
        <form onSubmit={handleAddQuestion} className="space-y-6">
          {/* Form fields remain the same - keeping them for completeness but truncated for brevity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={subjectOptions}
              placeholder="Select a subject"
            />
            <SelectInput
              label="Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              options={levelOptions}
              disabled={!subject}
              placeholder="Select a level"
            />
          </div>

          <TextInput
            label="Question Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter question title"
            required
          />

          {isPartsBasedQuestion &&
            subject.toLowerCase() !== "ds" &&
            mlBasePath && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>ML files will be saved to:</strong> {mlBasePath}
                </p>
              </div>
            )}

          {isPartsBasedQuestion &&
            subject.toLowerCase() === "ds" &&
            dsBasePath && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>DS files will be saved to:</strong> {dsBasePath}
                </p>
              </div>
            )}

          {isImageProcessingQuestion && imageProcessingBasePath && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Image files will be saved to:</strong>{" "}
                {imageProcessingBasePath}
              </p>
            </div>
          )}

          {/* MODIFIED: Add path display for generativeai */}
          {isSpeechRecognitionQuestion && normalizedSubject === "generativeai" && generativeAiBasePath && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Generative AI files will be saved to:</strong>{" "}
                {generativeAiBasePath}
              </p>
            </div>
          )}

          <TextareaInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter question description..."
            required
            rows={5}
          />

          {isPartsBasedQuestion && subject.toLowerCase() === "ds" && (
            <TextInput
              label="Page Link to Scrape"
              value={pageLink}
              onChange={(e) => setPageLink(e.target.value)}
              placeholder="http://example.com"
            />
          )}

          {isSpeechRecognitionQuestion ? (
            <>
              <div>
                <label className="block font-medium mb-3 text-slate-700 text-sm">
                  Datasets
                </label>
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Input Audio (WAV)
                    </label>
                    <input
                      type="file"
                      accept=".wav"
                      onChange={(e) => setSpeechInputFile(e.target.files[0])}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      required
                    />
                    {speechInputFile && (
                      <p className="mt-1 text-xs text-green-600">
                        Selected: {speechInputFile.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Solution File (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setSpeechSolutionFile(e.target.files[0])}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      required
                    />
                    {speechSolutionFile && (
                      <p className="mt-1 text-xs text-green-600">
                        Selected: {speechSolutionFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : isImageProcessingQuestion ? (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    label="Number of Outputs"
                    type="number"
                    min="1"
                    max="5"
                    value={numberOfOutputs}
                    onChange={handleNumberOfOutputsChange}
                    required
                  />
                  <TextInput
                    label="Similarity Threshold"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(e.target.value)}
                    placeholder="0.8"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium mb-3 text-slate-700 text-sm">
                    Dataset & Output Images
                  </label>
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Input Image (PNG, JPG)
                      </label>
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={(e) => setInputImage(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        required
                      />
                      {inputImage && (
                        <p className="mt-1 text-xs text-green-600">
                          Selected: {inputImage.name}
                        </p>
                      )}
                    </div>
                    {Array.from({ length: numberOfOutputs }).map((_, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Expected Output Image {index + 1} (PNG, JPG)
                        </label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg"
                          onChange={(e) =>
                            handleOutputImageChange(index, e.target.files[0])
                          }
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                          required
                        />
                        {outputFiles[index] && (
                          <p className="mt-1 text-xs text-green-600">
                            Selected: {outputFiles[index].name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : isPartsBasedQuestion ? (
            <>
             {showDatasetUploads && (
  <div>
    <label className="block font-medium mb-3 text-slate-700 text-sm">
      Datasets
    </label>
    <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      {/* Show only one CSV upload for DS Level 3 and 4 */}
      {normalizedSubject === "ds" && (level === "3" || level === "4" || level === "2" ) ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Dataset (CSV)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setTrainFile(e.target.files[0]);
              setTestFile(e.target.files[0]); // Set both to same file for DS 3/4
            }}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            required
          />
          {trainFile && (
            <p className="mt-1 text-xs text-green-600">
              Selected: {trainFile.name}
            </p>
          )}
        </div>
      ) : (
        /* Show both train and test for other subjects */
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Training Dataset (CSV)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setTrainFile(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {trainFile && (
              <p className="mt-1 text-xs text-green-600">
                Selected: {trainFile.name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Test Dataset (CSV)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setTestFile(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {testFile && (
              <p className="mt-1 text-xs text-green-600">
                Selected: {testFile.name}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  </div>
)}

              <div>
                <label className="block font-medium mb-3 text-slate-700 text-sm">
                  Parts (Max 5)
                </label>
                <div className="space-y-4">
                  {parts.map((part, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-slate-700">
                          Part {index + 1}
                        </h4>
                        {parts.length > 1 && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => removePart(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <TextInput
                          label="Part ID"
                          value={part.part_id}
                          onChange={(e) =>
                            handlePartChange(index, "part_id", e.target.value)
                          }
                          placeholder="e.g., Preprocessing"
                          required
                        />
                        <SelectInput
                          label="Type"
                          value={part.type}
                          onChange={(e) =>
                            handlePartChange(index, "type", e.target.value)
                          }
                          options={partTypeOptions}
                          required
                        />
                      </div>

                      <TextareaInput
                        label="Description"
                        value={part.description}
                        onChange={(e) =>
                          handlePartChange(index, "description", e.target.value)
                        }
                        placeholder="Enter part description..."
                        required
                        rows={3}
                      />

                      {part.type === "text_similarity" && (
                        <>
                          <TextInput
                            label="Expected Text Keywords"
                            value={part.expected_text}
                            onChange={(e) =>
                              handlePartChange(
                                index,
                                "expected_text",
                                e.target.value
                              )
                            }
                            placeholder="e.g., info memory usage non-null"
                            required
                          />
                          <TextInput
                            label="Similarity Threshold"
                            type="number"
                            step="0.01"
                            value={part.similarity_threshold}
                            onChange={(e) =>
                              handlePartChange(
                                index,
                                "similarity_threshold",
                                e.target.value
                              )
                            }
                            placeholder="0.9"
                            required
                          />
                        </>
                      )}

                      {part.type === "numerical_evaluation" && (
                        <>
                          <TextInput
                            label="Evaluation Label"
                            value={part.evaluation_label}
                            onChange={(e) =>
                              handlePartChange(
                                index,
                                "evaluation_label",
                                e.target.value
                              )
                            }
                            placeholder="e.g., R-squared Score:"
                            required
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <TextInput
                              label="Expected Value"
                              type="number"
                              step="0.0001"
                              value={part.expected_value}
                              onChange={(e) =>
                                handlePartChange(
                                  index,
                                  "expected_value",
                                  e.target.value
                                )
                              }
                              placeholder="0.7130"
                              required
                            />
                            <TextInput
                              label="Tolerance"
                              type="number"
                              step="0.01"
                              value={part.tolerance}
                              onChange={(e) =>
                                handlePartChange(
                                  index,
                                  "tolerance",
                                  e.target.value
                                )
                              }
                              placeholder="0.02"
                              required
                            />
                          </div>
                        </>
                      )}

                      {part.type === "csv_similarity" && (
                        <>
                          <TextInput
                            label="Placeholder Filename"
                            value={part.placeholder_filename}
                            onChange={(e) =>
                              handlePartChange(
                                index,
                                "placeholder_filename",
                                e.target.value
                              )
                            }
                            placeholder="submission.csv"
                            required
                          />
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Solution File (CSV)
                            </label>
                            <input
                              type="file"
                              accept=".csv"
                              onChange={(e) =>
                                handlePartFileChange(index, e.target.files[0])
                              }
                              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                            />
                            {part.solution_file && (
                              <p className="mt-1 text-xs text-green-600">
                                Selected: {part.solution_file.name}
                              </p>
                            )}
                          </div>
                          <TextInput
                            label="Key Columns (comma-separated)"
                            value={part.key_columns.join(", ")}
                            onChange={(e) =>
                              handleKeyColumnsChange(index, e.target.value)
                            }
                            placeholder="Id, SalePrice"
                            required
                          />
                          <TextInput
                            label="Similarity Threshold"
                            type="number"
                            step="0.01"
                            value={part.similarity_threshold}
                            onChange={(e) =>
                              handlePartChange(
                                index,
                                "similarity_threshold",
                                e.target.value
                              )
                            }
                            placeholder="0.9"
                            required
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {parts.length < 5 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addPart}
                    className="mt-3"
                  >
                    + Add Part
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="block font-medium mb-3 text-slate-700 text-sm">
                Test Cases (Max 5)
              </label>
              <div className="space-y-3">
                {testCases.map((tc, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Test Input {index + 1}
                      </label>
                      <textarea
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                        value={tc.input}
                        onChange={(e) =>
                          handleTestCaseChange(index, "input", e.target.value)
                        }
                        placeholder="e.g., 5 10"
                        rows="2"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Expected Output {index + 1}
                      </label>
                      <textarea
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                        value={tc.expected_output}
                        onChange={(e) =>
                          handleTestCaseChange(
                            index,
                            "expected_output",
                            e.target.value
                          )
                        }
                        placeholder="e.g., 15"
                        rows="2"
                      />
                    </div>
                    {testCases.length > 1 && (
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => removeTestCase(index)}
                          className="w-full"
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {testCases.length < 5 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addTestCase}
                  className="mt-3"
                >
                  + Add Test Case
                </Button>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleValidate}
              disabled={!subject || !level || !title || isValidating}
              className="w-full"
            >
              {isValidating
                ? "Validating... (Complete validation in new tab)"
                : isValidated
                ? "✓ Validated - Re-validate?"
                : "Validate Question"}
            </Button>

            {isValidated && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  ✓ Question has been validated. You can now add it.
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || !subject || !level || !isValidated}
              className="w-full"
            >
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Adding..."
                : isEditMode
                ? "Update Question"
                : "Add Question"}
            </Button>

            {!isValidated && subject && level && title && (
              <p className="text-sm text-amber-600 text-center">
                Please validate the question before adding it.
              </p>
            )}
          </div>
        </form>
        {message.text && (
          <Alert type={message.type} message={message.text} className="mt-4" />
        )}
      </Card>
    </div>
    );
};

export default QuestionManagement;
