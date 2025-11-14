// frontend/src/pages/AdminDashboard/StudentManagement.jsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import { CheckCircle, Lock, Unlock, ChevronDown, BookOpen, AlertCircle, XCircle, Code, FileText, Search } from 'lucide-react';
import Modal from '../../components/Modal';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';


const SubmissionViewer = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    const sortedSubmissions = [...data].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const attemptCounters = {};

    const submissionsWithAttempts = sortedSubmissions.map(submission => {
      const key = `${submission.subject}-${submission.level}`;
      attemptCounters[key] = (attemptCounters[key] || 0) + 1;
      return { ...submission, attemptNumber: attemptCounters[key] };
    });

    return submissionsWithAttempts.reverse();
  }, [data]);

  if (processedData.length === 0) {
    return <div className="text-center p-4 text-slate-500">This user has no submissions yet.</div>;
  }

  const toggleAccordion = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {processedData.map((submission, index) => {
        const isOpen = activeIndex === index;
        const submissionDate = new Date(submission.timestamp).toLocaleString();
        const statusStyle = submission.status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        const questionId = submission.answers?.[0]?.questionId || 'N/A';

        return (
          <div key={submission.timestamp} className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => toggleAccordion(index)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100">
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyle}`}>
                  {submission.status.toUpperCase()}
                </span>
                <div className="text-left">
                  <span className="font-semibold text-slate-800">{submission.subject.toUpperCase()} - {submission.level.replace('l', 'L')}</span>
                  <p className="text-xs text-slate-500">{submissionDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-slate-500">
                  Attempt #{submission.attemptNumber}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {isOpen && (
              <div className="p-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-md">
                  <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500">QUESTION ID</h4>
                    <p className="font-mono text-sm text-slate-800">{questionId}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {submission.answers.map(answer => (
                    <div key={answer.partId} className="border border-slate-200 rounded-md">
                      <div className="flex justify-between items-center bg-slate-50 p-3">
                        <p className="font-semibold text-sm text-slate-800">{answer.partId}</p>
                        {answer.passed ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={14} /> Passed</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><XCircle size={14} /> Failed</span>
                        )}
                      </div>
                      <div className="p-3">
                        {answer.code && answer.code.trim() !== "" ? (
                          <SyntaxHighlighter language="python" style={atomDark} customStyle={{ borderRadius: '0.375rem', margin: 0, maxHeight: '250px', overflowY: 'auto' }}>
                            {answer.code}
                          </SyntaxHighlighter>
                        ) : (
                          <p className="text-sm text-slate-400 italic flex items-center gap-2"><Code size={14} /> No code submitted for this part.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const StatusDropdown = ({ subject, level, currentStatus, onStatusChange, isUpdating }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const statusInfo = {
    completed: { text: "Completed", icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, styles: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
    unlocked: { text: "Unlocked", icon: <Unlock className="w-4 h-4 text-sky-500" />, styles: "bg-sky-100 text-sky-700 hover:bg-sky-200" },
    locked: { text: "Locked", icon: <Lock className="w-4 h-4 text-slate-500" />, styles: "bg-slate-100 text-slate-500 hover:bg-slate-200" },
  };
  const current = statusInfo[currentStatus] || statusInfo.locked;
  const statusOptions = ["locked", "unlocked", "completed"];
  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} disabled={isUpdating} className={`flex items-center justify-between gap-2 pl-2 pr-1.5 py-1 w-36 text-sm font-medium rounded-full transition-colors ${current.styles} ${isUpdating ? 'cursor-not-allowed opacity-60' : ''}`}>
        <span className="flex items-center gap-1.5">
          {current.icon}
          <span>{level}: {current.text}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-10 overflow-hidden transition-all duration-200 ease-out transform ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <ul>
          {statusOptions.map((option) => (
            <li key={option}>
              <button onClick={() => { onStatusChange(subject, level, option); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:bg-purple-600 flex items-center gap-2">
                {statusInfo[option].icon}
                <span className="font-medium">{statusInfo[option].text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submissionData, setSubmissionData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedUsernames, setSelectedUsernames] = useState(new Set());
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkLevel, setBulkLevel] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // --- NEW STATE: To hold the current statuses for the review panel ---
  const [currentStatuses, setCurrentStatuses] = useState([]);

  const ADMIN_API_URL = `${API_BASE_URL}/api/admin`;
  const SUBMISSIONS_API_URL =`${API_BASE_URL}/api/submissions`;

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${ADMIN_API_URL}/students`);
        if (!response.ok) throw new Error("Failed to fetch students data.");
        const data = await response.json();
        setStudents(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  // --- NEW EFFECT: To update the current statuses when selections change ---
  useEffect(() => {
    if (selectedUsernames.size > 0 && bulkSubject && bulkLevel) {
      const statuses = [];
      students.forEach(student => {
        if (selectedUsernames.has(student.username)) {
          const status = student.progress?.[bulkSubject]?.[bulkLevel] ?? 'N/A';
          statuses.push({ username: student.username, status });
        }
      });
      setCurrentStatuses(statuses);
    } else {
      setCurrentStatuses([]); // Clear statuses if selections are incomplete
    }
  }, [selectedUsernames, bulkSubject, bulkLevel, students]);


  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    return students.filter(student =>
      student.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const handleSelectStudent = (username) => {
    setSelectedUsernames(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(username)) {
        newSelection.delete(username);
      } else {
        newSelection.add(username);
      }
      return newSelection;
    });
    setSelectedStudent(null);
  };

  const handleSelectAllVisible = () => {
    const visibleUsernames = filteredStudents.map(s => s.username);
    setSelectedUsernames(new Set(visibleUsernames));
    setSelectedStudent(null);
  };

  const handleDeselectAll = () => {
    setSelectedUsernames(new Set());
  };
  
  const availableSubjects = useMemo(() => {
    if (students.length === 0) return [];
    const subjects = new Set();
    students.forEach(student => {
      Object.keys(student.progress || {}).forEach(subject => subjects.add(subject));
    });
    return Array.from(subjects).sort();
  }, [students]);

  const availableLevels = useMemo(() => {
    if (!bulkSubject || students.length === 0) return [];
    const studentWithSubject = students.find(s => s.progress && s.progress[bulkSubject]);
    return studentWithSubject ? Object.keys(studentWithSubject.progress[bulkSubject]).sort() : [];
  }, [bulkSubject, students]);

  const handleBulkUpdate = async (status) => {
    if (!bulkSubject || !bulkLevel || selectedUsernames.size === 0) {
        alert("Please select a subject, level, and at least one student.");
        return;
    }
    if (!window.confirm(`Are you sure you want to set ${bulkSubject} - ${bulkLevel} to "${status}" for ${selectedUsernames.size} student(s)?`)) {
        return;
    }
    setBulkProcessing(true);
    try {
        const response = await fetch(`${ADMIN_API_URL}/bulk-update-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usernames: Array.from(selectedUsernames),
                subject: bulkSubject,
                level: bulkLevel,
                status: status
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        setStudents(prevStudents => 
            prevStudents.map(student => {
                if (selectedUsernames.has(student.username)) {
                    const newProgress = { ...student.progress };
                    if (newProgress[bulkSubject] && newProgress[bulkSubject][bulkLevel] !== undefined) {
                        newProgress[bulkSubject][bulkLevel] = status;
                    }
                    return { ...student, progress: newProgress };
                }
                return student;
            })
        );
        alert(result.message);
        handleDeselectAll();
    } catch (err) {
        alert(`Error: ${err.message}`);
    } finally {
        setBulkProcessing(false);
    }
  };

  const handleViewDetails = async (username) => {
    setModalTitle(`Submission History for ${username}`);
    setModalLoading(true);
    setIsModalOpen(true);
    setSubmissionData(null);
    try {
      const response = await fetch(`${SUBMISSIONS_API_URL}/${username}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'An unknown error occurred.');
      }
      setSubmissionData(data);
    } catch (err) {
      setSubmissionData({ error: err.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleStatusChange = async (subject, level, newStatus) => {
    if (!selectedStudent || updating) return;
    setUpdating(true);
    const updatedStudent = JSON.parse(JSON.stringify(selectedStudent));
    updatedStudent.progress[subject][level] = newStatus;
    try {
      const response = await fetch(`${ADMIN_API_URL}/students/${selectedStudent.username}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: updatedStudent.progress }),
      });
      if (!response.ok) throw new Error('Failed to update progress.');
      setSelectedStudent(updatedStudent);
      setStudents(prevStudents => prevStudents.map(s => s.username === updatedStudent.username ? updatedStudent : s));
    } catch (err) {
      console.error("Update error:", err);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusPillStyle = (status) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-800";
      case "unlocked": return "bg-sky-100 text-sky-800";
      case "locked": return "bg-slate-200 text-slate-600";
      default: return "bg-gray-100 text-gray-500";
    }
  };

  if (loading) return <div className="text-center p-8">Loading student data...</div>;
  if (error) return <div className="text-red-500 bg-red-50 p-4 rounded-lg">{error}</div>;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Students ({filteredStudents.length})</h2>
          <div className="relative mb-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              placeholder="Search to filter and select..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="
                block w-full rounded-lg border-slate-300 bg-slate-50 py-2.5 pl-11 pr-4
                text-slate-800 placeholder:text-slate-400
                focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50
                transition duration-150 ease-in-out
              "
            />
          </div>
          
          <div className="flex justify-between items-center mb-2 text-sm px-1">
            <button onClick={handleSelectAllVisible} className="font-medium text-purple-600 hover:text-purple-800 transition-colors">Select All Visible</button>
            <button onClick={handleDeselectAll} className="font-medium text-slate-500 hover:text-slate-700 transition-colors">Clear Selection</button>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 max-h-[55vh] overflow-y-auto">
            {filteredStudents.length > 0 ? (
              <ul>
                {filteredStudents.map((student) => (
                  <li key={student.username} className="border-b last:border-b-0 border-slate-100">
                    <label className={`flex justify-between items-center w-full text-left p-4 cursor-pointer transition-colors duration-150 ${selectedUsernames.has(student.username) ? "bg-purple-100 ring-2 ring-purple-200" : "hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUsernames.has(student.username)}
                          onChange={() => handleSelectStudent(student.username)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span
                          onClick={(e) => { e.preventDefault(); setSelectedStudent(student); handleDeselectAll(); }}
                          className={`font-medium text-slate-700 hover:underline ${selectedStudent?.username === student.username ? "text-purple-700" : ""}`}
                        >
                          {student.username}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewDetails(student.username); }}
                        className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors p-1 rounded-md hover:bg-purple-100"
                      >
                        <BookOpen size={14} />
                        <span>Details</span>
                      </button>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>No students found matching your search.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-2">
          {selectedUsernames.size > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                Bulk Actions for <span className="text-purple-600">{selectedUsernames.size} Selected Student(s)</span>
              </h2>
              <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-md space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bulk-subject" className="block text-sm font-medium text-slate-700 mb-1">1. Select Subject</label>
                    <select
                      id="bulk-subject"
                      value={bulkSubject}
                      onChange={e => { setBulkSubject(e.target.value); setBulkLevel(''); }}
                      className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-2.5 px-3 shadow-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Choose a subject --</option>
                      {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bulk-level" className="block text-sm font-medium text-slate-700 mb-1">2. Select Level</label>
                    <select
                      id="bulk-level"
                      value={bulkLevel}
                      onChange={e => setBulkLevel(e.target.value)}
                      disabled={!bulkSubject}
                      className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-2.5 px-3 shadow-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Choose a level --</option>
                      {availableLevels.map(l => <option key={l} value={l}>{l.replace('l', 'L')}</option>)}
                    </select>
                  </div>
                </div>

                {/* --- NEW "REVIEW STATUSES" SECTION --- */}
                {bulkLevel && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">2a. Review Current Statuses</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {currentStatuses.length > 0 ? (
                        currentStatuses.map(({ username, status }) => (
                          <div key={username} className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 truncate pr-2">{username}</span>
                            <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${getStatusPillStyle(status)}`}>
                              {status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center">Loading statuses...</p>
                      )}
                    </div>
                  </div>
                )}
                {/* --- END OF NEW SECTION --- */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">3. Apply New Status</label>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => handleBulkUpdate('unlocked')} disabled={!bulkLevel || bulkProcessing} className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                      <Unlock size={16} /> Unlock Level
                    </button>
                    <button onClick={() => handleBulkUpdate('locked')} disabled={!bulkLevel || bulkProcessing} className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                      <Lock size={16} /> Lock Level
                    </button>
                    <button onClick={() => handleBulkUpdate('completed')} disabled={!bulkLevel || bulkProcessing} className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                      <CheckCircle size={16} /> Mark as Completed
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedStudent ? (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4 truncate">
                Progress for: <span className="text-purple-600 font-semibold">{selectedStudent.username}</span>
              </h2>
              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3">
                {Object.entries(selectedStudent.progress).sort().map(([subject, levels]) => (
                  <div key={subject} className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300">
                    <h3 className="font-semibold text-lg text-slate-800 mb-4">{subject}</h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(levels).map(([level, status]) => (
                        <StatusDropdown
                          key={level}
                          subject={subject}
                          level={level}
                          currentStatus={status}
                          onStatusChange={handleStatusChange}
                          isUpdating={updating}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-white rounded-xl shadow-md p-10 border-2 border-dashed border-slate-300">
              <p className="text-slate-500 text-lg">Select a student to view their progress, or select multiple students to perform bulk actions.</p>
            </div>
          )}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        {modalLoading ? (
          <p className="text-slate-500 text-center p-4">Loading submission history...</p>
        ) : submissionData?.error ? (
          <div className="flex flex-col items-center justify-center text-center p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="font-semibold">An Error Occurred</p>
            <p className="text-sm">{submissionData.error}</p>
          </div>
        ) : (
          <SubmissionViewer data={submissionData} />
        )}
      </Modal>
    </>
  );
};

export default StudentManagement;