import React, { useState, useEffect, useMemo } from "react";
import {
  Spinner,
  SelectInput,
  TextInput,
  Button,
  Alert,
  Card,
} from "./SharedComponents";

// Define the base URL from the environment variable once
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Helper Component for Filter Controls ---
const FilterControls = ({
  statusFilter,
  setStatusFilter,
  sortOrder,
  setSortOrder,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  counts,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex-grow min-w-[150px]">
          <SelectInput
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "passed", label: "Passed" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </div>
        <div className="flex-grow min-w-[150px]">
          <TextInput
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-grow min-w-[150px]">
          <TextInput
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          variant="outline"
          className="whitespace-nowrap"
        >
          Sort Date ({sortOrder === "desc" ? "Newest" : "Oldest"})
        </Button>
      </div>
      
      <div className="flex items-center space-x-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">
          Showing {counts.total} results
        </span>
        {statusFilter !== 'failed' && (
           <span className="font-medium">
             Passed: <span className="font-semibold text-emerald-600">{counts.passed}</span>
           </span>
        )}
        {statusFilter !== 'passed' && (
          <span className="font-medium">
            Failed: <span className="font-semibold text-red-600">{counts.failed}</span>
          </span>
        )}
      </div>
    </div>
  );
};

// --- Enhanced Student Submission Detail Component ---
const StudentSubmissionDetail = ({ username, submissions }) => {
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const processedSubmissions = useMemo(() => {
    // 1. Calculate attempt number for each subject-level pair
    const attemptCounts = {};
    const submissionsWithAttempts = [...submissions]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) // Sort oldest to newest to count attempts correctly
      .map(sub => {
        const key = `${sub.subject}-${sub.level}`;
        attemptCounts[key] = (attemptCounts[key] || 0) + 1;
        return { ...sub, attemptNumber: attemptCounts[key] };
      });

    // 2. Apply filters
    let filtered = submissionsWithAttempts;
    if (statusFilter !== "all") {
      if (statusFilter === "passed") {
        filtered = filtered.filter(s => s.status === "completed" || s.status === "passed");
      } else {
        filtered = filtered.filter(s => s.status === "failed");
      }
    }
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(s => new Date(s.timestamp) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(s => new Date(s.timestamp) <= end);
    }

    // 3. Apply final sorting for display
    return filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [submissions, sortOrder, statusFilter, startDate, endDate]);

  const counts = useMemo(() => ({
    total: processedSubmissions.length,
    passed: processedSubmissions.filter(s => s.status === 'passed' || s.status === 'completed').length,
    failed: processedSubmissions.filter(s => s.status === 'failed').length,
  }), [processedSubmissions]);

  const summary = submissions.reduce((acc, sub) => {
    if (!acc[sub.subject]) {
      acc[sub.subject] = { completed: 0, failed: 0, attempts: 0 };
    }
    acc[sub.subject].attempts++;
    if (sub.status === "completed" || sub.status === "passed") {
      const completedLevels = new Set(submissions.filter(s => s.subject === sub.subject && (s.status === 'completed' || s.status === 'passed')).map(s => s.level));
      acc[sub.subject].completed = completedLevels.size;
    }
    if (sub.status === "failed") {
      acc[sub.subject].failed++;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-8 mt-6">
      <div>
        <h4 className="text-xl font-semibold mb-4 text-slate-800">Progress Summary for {username}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(summary).map(([subject, data]) => (
            <Card key={subject} className="p-4">
              <h5 className="font-semibold text-slate-800 mb-3">{subject.toUpperCase()}</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center"><span className="text-slate-600">Completed Levels</span><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium text-xs">{data.completed}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-600">Total Attempts</span><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium text-xs">{data.attempts}</span></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xl font-semibold mb-4 text-slate-800">Full Submission History</h4>
        <FilterControls
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          counts={counts}
        />
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse bg-white min-w-max">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Level</th>
                <th className="px-4 py-3 text-center font-medium text-slate-700 text-sm uppercase">Attempt No.</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {processedSubmissions.map((sub, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{sub.subject}</td>
                  <td className="px-4 py-3 text-slate-700">{sub.level}</td>
                  <td className="px-4 py-3 text-slate-700 text-center">{sub.attemptNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full font-medium text-xs ${sub.status === "passed" || sub.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{new Date(sub.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Component for the Aggregate View ---
const AggregateView = () => {
  const [submissions, setSubmissions] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const fetchAggregateSubmissions = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/submissions`);
        if (!res.ok) throw new Error("Failed to fetch submission data.");
        const data = await res.json();
        setSubmissions(data);
        const availableSubjects = Object.keys(data);
        setSubjects(availableSubjects);
        if (availableSubjects.length > 0) {
          setSelectedSubject(availableSubjects[0]);
          const firstLevels = Object.keys(data[availableSubjects[0]] || {});
          if (firstLevels.length > 0) {
            setSelectedLevel(firstLevels[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching aggregate submissions", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAggregateSubmissions();
  }, []);

  const processedSubmissions = useMemo(() => {
    const baseSubmissions = (selectedSubject && selectedLevel && submissions[selectedSubject]?.[selectedLevel]) || [];

    // 1. Calculate attempt number for each user within this subject/level
    const userAttemptCounts = {};
    const submissionsWithDetails = [...baseSubmissions]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) // Sort oldest to newest
      .map(sub => {
        userAttemptCounts[sub.username] = (userAttemptCounts[sub.username] || 0) + 1;
        return {
          ...sub,
          subject: selectedSubject,
          level: selectedLevel,
          attemptNumber: userAttemptCounts[sub.username],
        };
      });

    // 2. Apply filters
    let filtered = submissionsWithDetails;
    if (statusFilter !== "all") {
        if (statusFilter === "passed") {
            filtered = filtered.filter(s => s.status === 'completed' || s.status === 'passed');
        } else {
            filtered = filtered.filter(s => s.status === 'failed');
        }
    }
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(s => new Date(s.timestamp) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(s => new Date(s.timestamp) <= end);
    }
    
    // 3. Apply final sorting for display
    return filtered.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [submissions, selectedSubject, selectedLevel, sortOrder, statusFilter, startDate, endDate]);

  const counts = useMemo(() => ({
    total: processedSubmissions.length,
    passed: processedSubmissions.filter(s => s.status === 'passed' || s.status === 'completed').length,
    failed: processedSubmissions.filter(s => s.status === 'failed').length,
  }), [processedSubmissions]);

  const subjectOptions = subjects.map((s) => ({ value: s, label: s.toUpperCase() }));
  const levelOptions = selectedSubject ? Object.keys(submissions[selectedSubject] || {}).map((l) => ({ value: l, label: l })) : [];

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6 text-slate-800">View All Submissions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SelectInput label="Select Subject" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} options={subjectOptions} />
        <SelectInput label="Select Level" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} options={levelOptions} disabled={!selectedSubject} />
      </div>

      <FilterControls
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        counts={counts}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse bg-white min-w-max">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Username</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Subject</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Level</th>
              <th className="px-4 py-3 text-center font-medium text-slate-700 text-sm uppercase">Attempt No.</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 text-sm uppercase">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {processedSubmissions.length > 0 ? (
              processedSubmissions.map((sub, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{sub.username}</td>
                  <td className="px-4 py-3 text-slate-700">{sub.subject}</td>
                  <td className="px-4 py-3 text-slate-700">{sub.level}</td>
                  <td className="px-4 py-3 text-slate-700 text-center">{sub.attemptNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full font-medium text-xs ${sub.status === "passed" || sub.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{new Date(sub.timestamp).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-500">No submissions found for the selected criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Component for the Student Search View ---
const StudentView = () => {
  const [searchUsername, setSearchUsername] = useState("");
  const [studentData, setStudentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStudentSearch = async (e) => {
    e.preventDefault();
    if (!searchUsername) return;
    setIsLoading(true);
    setError("");
    setStudentData(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${searchUsername}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Student not found.");
      setStudentData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6 text-slate-800">View Student Progress</h3>
      <form onSubmit={handleStudentSearch} className="flex flex-col sm:flex-row gap-3 items-end mb-6">
        <div className="flex-1 w-full">
          <TextInput label="Enter Student Username" value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} placeholder="e.g., student1" />
        </div>
        <Button type="submit" disabled={isLoading || !searchUsername} variant="primary" className="whitespace-nowrap w-full sm:w-auto">
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </form>
      {error && <Alert type="error" message={error} className="mb-4" />}
      {isLoading && <Spinner />}
      {studentData && <StudentSubmissionDetail username={searchUsername} submissions={studentData} />}
    </div>
  );
};

// --- Main Component to Switch Between Views ---
const SubmissionsViewer = () => {
  const [view, setView] = useState("aggregate");

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-6">
          <Button onClick={() => setView("aggregate")} variant={view === "aggregate" ? "primary" : "outline"} className="flex-1 sm:flex-none">
            Aggregate View
          </Button>
          <Button onClick={() => setView("student")} variant={view === "student" ? "primary" : "outline"} className="flex-1 sm:flex-none">
            Student View
          </Button>
        </div>

        {view === "aggregate" ? <AggregateView /> : <StudentView />}
      </Card>
    </div>
  );
};

export default SubmissionsViewer;