// src/pages/ExamPageDispatcher.jsx

import React from 'react';
// --- CHANGE 1: Import useParams and Navigate ---
import { useParams, Navigate } from 'react-router-dom';

// Import all your specific exam page components
import ML_ExamPage from './ML_ExamPage';
import DS_ExamPage from './DS_ExamPage';
import SpeechRecognition_ExamPage from './SpeechRecognition_ExamPage'; 
import DeepLearning_ExamPage from './DeepLearning_ExamPage'; 
import NLP_ExamPage from './NLP_ExamPage'; 
import R_ExamPage from './R_ExamPage';
import Image_Processing_ExamPage from './Image_Proceesing_ExamPage';
import LLM_ExamPage from './LLM_Exam_page';
import GenerativeAI_ExamPage from './GenerativeAI_ExamPage';


const ExamPageDispatcher = () => {
  // --- CHANGE 2: Destructure both `subject` and `level` from useParams ---
  const { subject, level } = useParams();

  const normalizedSubject = subject?.replace(/\s+/g, '').toLowerCase();

  // --- CHANGE 3: Add a special condition for Deep Learning Level 2 ---
  if (normalizedSubject === 'deeplearning' && level === '1') {
    // If the route is for DL level 2, render the Image Processing exam page.
    return <Image_Processing_ExamPage />;
  }
  if (normalizedSubject === 'generativeai' && (level === '1' || level === '2')) {
    // If the route is for Generative AI levels 1 or 2, render the Speech Recognition exam page.
    return <SpeechRecognition_ExamPage />;
  }


  // Use a switch statement for all other cases
  switch (normalizedSubject) {
    case 'ml':
      return <ML_ExamPage />;
    
    case 'ds':
      return <DS_ExamPage />;

    case 'speechrecognition':
      return <SpeechRecognition_ExamPage />;

    // The generic 'deeplearning' case will now handle all other levels (e.g., level 1)
    case 'deeplearning':
      return <DeepLearning_ExamPage />;
    
    case 'nlp':
      return <NLP_ExamPage />;

    case 'rprogramming':
      return <R_ExamPage />;
    
    // The original 'imageprocessing' route is no longer needed if it's fully merged,
    // but you can leave it for direct access or admin purposes.
    case 'imageprocessing':
      return <Image_Processing_ExamPage/>;

    case 'llm':
      return <LLM_ExamPage />;

    case 'generativeai':
      return <GenerativeAI_ExamPage />;

    default:
      console.error(`No exam component found for subject: "${subject}" (Normalized to: "${normalizedSubject}")`);
      return <Navigate to="/dashboard" />;
  }
};

export default ExamPageDispatcher;