

import React, { useState, useEffect } from "react";
import { Card, Alert } from "./SharedComponents";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const QuestionStatsTable = () => {
  const [questionCounts, setQuestionCounts] = useState({});
  const [subjectsData, setSubjectsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

useEffect(() => {
  console.log("📊 Current questionCounts state:", questionCounts);
  console.log("📊 Current subjectsData state:", subjectsData);
}, [questionCounts, subjectsData]);



const getOrderedSubjects = () => {
  const subjectOrder = [
    'ml',
    'ds', 
    'Deep Learning',
    'NLP',
    'Generative AI',
    'R Programming'
  ];
  
  return Object.entries(questionCounts)
    .sort(([subjectA], [subjectB]) => {
      const indexA = subjectOrder.indexOf(subjectA);
      const indexB = subjectOrder.indexOf(subjectB);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return subjectA.localeCompare(subjectB);
    });
};

const fetchQuestionCounts = async () => {
  try {
    setLoading(true);
   
    console.log("🔍 Attempting to fetch question counts...");
   
    const res = await fetch(`${API_BASE_URL}/api/questions/question-counts`);
    console.log("Response status:", res.status);
   
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Response error details:", errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
   
    const counts = await res.json();
    console.log("✅ Successfully fetched question counts:", counts);
   
    // Check if counts is empty or invalid
    if (!counts || typeof counts !== 'object' || Object.keys(counts).length === 0) {
      console.warn("⚠️ Question counts is empty or invalid:", counts);
      setQuestionCounts({});
    } else {
      setQuestionCounts(counts);
    }
  } catch (err) {
    console.error("❌ Error fetching question counts:", err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/questions`);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const data = await res.json();
      setSubjectsData(data);
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

useEffect(() => {
  console.log("API_BASE_URL:", API_BASE_URL);
  console.log("Full endpoint URL:", `${API_BASE_URL}/api/questions/question-counts`);
  fetchQuestionCounts();
  fetchSubjects();
}, []);

const getAllLevels = () => {
  if (!questionCounts || Object.keys(questionCounts).length === 0) {
    return [];
  }
 
  const allLevels = new Set();
  Object.values(questionCounts).forEach(subjectLevels => {
    if (subjectLevels && typeof subjectLevels === 'object') {
      Object.keys(subjectLevels).forEach(level => {
        allLevels.add(level);
      });
    }
  });
 
  return Array.from(allLevels).sort((a, b) => {
    const numA = parseInt(a.replace('level', '')) || 0;
    const numB = parseInt(b.replace('level', '')) || 0;
    return numA - numB;
  });
};
  const allLevels = getAllLevels();

  if (loading) {
    return (
      <Card title="Question Statistics">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Question Statistics">
        <Alert type="error" message={error} />
        <button
          onClick={fetchQuestionCounts}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <Card title="Question Statistics">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                Subject
              </th>
             {allLevels.map(level => (
  <th
    key={level}
    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b"
  >
    {level.replace('level', 'Level ')}
  </th>
))}
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                Total
              </th>
            </tr>
          </thead>
         <tbody className="bg-white divide-y divide-slate-200">
  {getOrderedSubjects().length > 0 ? (
    getOrderedSubjects().map(([subject, levels]) => {
      if (!levels || typeof levels !== 'object') return null;
      
      const totalQuestions = Object.values(levels).reduce((sum, count) => sum + (count || 0), 0);
      const subjectTitle = subjectsData[subject]?.title || subject.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      return (
        <tr key={subject} className="hover:bg-slate-50">
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
            {subjectTitle}
          </td>
          {allLevels.map(level => (
            <td key={level} className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
              <div className="flex items-center">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                  (levels[level] || 0) > 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {levels[level] || 0}
                </span>
                {(levels[level] || 0) > 0 && (
                  <span className="ml-2 text-xs text-slate-400">
                    question{(levels[level] || 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </td>
          ))}
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-800">
              {totalQuestions}
            </span>
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={allLevels.length + 2} className="px-6 py-8 text-center text-slate-500">
        No question data available
      </td>
    </tr>
  )}
</tbody>
        </table>
       
        {Object.keys(questionCounts).length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No question data available
          </div>
        )}
      </div>
     
      <div className="mt-4 flex justify-between items-center text-sm text-slate-500">
        <span>Total Subjects: {Object.keys(questionCounts).length}</span>
        <span>Total Levels: {allLevels.length}</span>
        <button
          onClick={fetchQuestionCounts}
          className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </Card>
  );
};

export default QuestionStatsTable;