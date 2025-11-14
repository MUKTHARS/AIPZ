import React, { useState, useEffect } from "react";
import { Spinner, FileUploader, Card } from "./SharedComponents";
import AddUserForm from './AddUserForm';
import DeleteUserForm from './DeleteUserForm'; // <-- 1. IMPORT the new component

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      <AddUserForm onUserAdded={fetchUsers} />

      {/* 2. ADD the new component here, below the AddUserForm */}
      <DeleteUserForm onUserDeleted={fetchUsers} />
      <Card>
        <FileUploader
          title="Upload New Users via CSV"
          endpoint="/upload-users"
          templateName="users_template.csv"
          onUploadComplete={fetchUsers}
        />
      </Card>

      

      <Card title={`All Users (${users.length})`}>
        {isLoading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {/* ... (This empty state content is unchanged) ... */}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-700 text-sm uppercase tracking-wider border-b border-slate-200">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-slate-700 text-sm uppercase tracking-wider border-b border-slate-200">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => (
                  <tr
                    key={user.username}
                    className="hover:bg-slate-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {user.username}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserManagement;