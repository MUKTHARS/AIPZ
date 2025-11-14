import React, { useState, useEffect } from 'react';
import { Card, Spinner } from './SharedComponents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// This is the pop-up dialog component, styled to match your UI.
const ConfirmationDialog = ({ username, onCancel, onConfirm, isDeleting }) => {
    return (
        // Backdrop
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 transition-opacity duration-300">
            {/* Dialog Box */}
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 transform transition-all duration-300 scale-100">
                <h2 className="text-xl font-bold text-slate-800">Are you sure?</h2>
                <p className="mt-2 text-slate-600">
                    This will permanently delete the user <strong className="font-semibold">{username}</strong>. This action cannot be undone.
                </p>
                <div className="mt-8 flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-slate-100 text-slate-800 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center disabled:opacity-50"
                    >
                        {isDeleting ? <Spinner /> : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const DeleteUserForm = ({ onUserDeleted }) => {
  const [username, setUsername] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // This effect clears any success or error messages after 3 seconds.
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);


  // When the "Delete User" button is clicked, this opens the confirmation dialog.
  const handleRequestDelete = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!username) {
      setError('Please enter the username of the user to delete.');
      return;
    }
    if (username.toLowerCase() === 'admin') {
      setError("The primary 'admin' user cannot be deleted.");
      return;
    }
    setDialogOpen(true);
  };

  // This function is called when the "Continue" button is clicked in the dialog.
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${username}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(data.message || `User '${username}' deleted successfully.`);
        onUserDeleted(); // This refreshes the user list in the parent component.
        setUsername(''); // Clear the input field on success.
      } else {
        setError(data.message || 'Failed to delete user.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
      setDialogOpen(false);
    }
  };

  return (
    <>
        {isDialogOpen && (
            <ConfirmationDialog 
                username={username}
                onCancel={() => setDialogOpen(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
            />
        )}
        <Card title="Delete User">
            <form onSubmit={handleRequestDelete} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Username to Delete</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3"
                        required
                    />
                </div>
                
                <div className="pt-2 text-sm text-center font-medium">
                    {error && <p className="text-red-600">{error}</p>}
                    {successMessage && <p className="text-green-600">{successMessage}</p>}
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isDeleting}
                        className="inline-flex justify-center rounded-md border border-transparent bg-red-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        Delete User
                    </button>
                </div>
            </form>
        </Card>
    </>
  );
};

export default DeleteUserForm;