// // src/components/ValidationPage.jsx

// import React, { useState, useEffect } from "react";
// import { useParams, useSearchParams } from "react-router-dom";

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// // Helper components for UI feedback
// const Card = ({ title, children }) => (
//   <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-8">
//     <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
//       {title}
//     </h2>
//     <div>{children}</div>
//   </div>
// );

// const Alert = ({ type, message }) => {
//   const typeClasses = {
//     success: "bg-green-100 border-green-300 text-green-800",
//     error: "bg-red-100 border-red-300 text-red-800",
//   };
//   return (
//     <div
//       className={`p-4 rounded-md border text-sm font-medium ${typeClasses[type]}`}
//     >
//       {message}
//     </div>
//   );
// };

// const Button = ({ children, onClick, disabled }) => (
//   <button
//     onClick={onClick}
//     disabled={disabled}
//     className="w-full px-4 py-3 bg-purple-600 text-white font-semibold rounded-md shadow-sm hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
//   >
//     {children}
//   </button>
// );

// const Spinner = () => (
//   <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-purple-500 mx-auto"></div>
// );

// const ValidationPage = () => {
//   const { subject, level } = useParams();
//   const [searchParams] = useSearchParams();
//   const questionId = searchParams.get("validate");
//   const isAdmin = searchParams.get("admin") === "true";

//   const [status, setStatus] = useState("validating"); // 'validating', 'success', 'error'
//   const [message, setMessage] = useState("");

//   useEffect(() => {
//     if (!questionId || !isAdmin) {
//       setStatus("error");
//       setMessage(
//         "Invalid validation URL. This page requires a question ID and admin privileges."
//       );
//       return;
//     }

//     const performValidation = async () => {
//       try {
//         const response = await fetch(
//           `${API_BASE_URL}/api/admin/validate-question`,
//           {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ subject, level, questionId }),
//           }
//         );

//         const result = await response.json();

//         if (!response.ok) {
//           throw new Error(
//             result.message || "Validation failed on the server."
//           );
//         }

//         // Report SUCCESS back via localStorage for the parent tab to read
//         localStorage.setItem(
//           "questionValidationResult",
//           JSON.stringify({
//             passed: true,
//             subject,
//             level,
//             questionId,
//             message: result.message,
//           })
//         );
//         setStatus("success");
//         setMessage(
//           result.message ||
//             "Validation successful! The question is ready to be added."
//         );
//       } catch (error) {
//         // Report FAILURE back via localStorage for the parent tab to read
//         localStorage.setItem(
//           "questionValidationResult",
//           JSON.stringify({
//             passed: false,
//             subject,
//             level,
//             questionId,
//             message: error.message,
//           })
//         );
//         setStatus("error");
//         setMessage(
//           error.message || "An unexpected error occurred during validation."
//         );
//       }
//     };

//     const timer = setTimeout(performValidation, 1000);
//     return () => clearTimeout(timer);
//   }, [subject, level, questionId, isAdmin]);

//   /**
//    * This function closes the current browser tab.
//    * Browsers only allow this if the tab was opened by a script (e.g., window.open()),
//    * which is exactly how this page is opened from the admin dashboard.
//    */
//   const handleCloseAndReturn = () => {
//     window.close();
//   };

//   const renderContent = () => {
//     switch (status) {
//       case "validating":
//         return (
//           <div className="text-center space-y-4">
//             <Spinner />
//             <p className="text-slate-600">
//               Running validation for question{" "}
//               <span className="font-bold">{questionId}</span>...
//             </p>
//             <p className="text-sm text-slate-500">
//               Please wait. This may take a moment.
//             </p>
//           </div>
//         );
//       case "success":
//         return (
//           <div className="space-y-6 text-center">
//             <Alert type="success" message={message} />
//             <p className="text-slate-600">
//               The parent tab has received the validation result. You can now
//               return to the admin dashboard to finalize the question.
//             </p>
//             <Button onClick={handleCloseAndReturn}>
//               Return to Admin Dashboard (Closes this tab)
//             </Button>
//           </div>
//         );
//       case "error":
//         return (
//           <div className="space-y-6 text-center">
//             <Alert type="error" message={message} />
//             <p className="text-slate-600">
//               Please review the error. The parent tab has been notified. You can
//               now return to the admin dashboard to correct the question.
//             </p>
//             <Button onClick={handleCloseAndReturn}>
//               Return to Admin Dashboard (Closes this tab)
//             </Button>
//           </div>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
//       <Card title="Question Validation Status">{renderContent()}</Card>
//     </div>
//   );
// };

// export default ValidationPage;