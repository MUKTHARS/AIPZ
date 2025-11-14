// frontend/src/pages/AdminDashboard/PortalManagement.jsx

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PortalManagement = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const API_URL = `${API_BASE_URL}/api/admin/portal-settings`;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch portal settings.');
        const data = await response.json();
        setSettings(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = async (key) => {
    if (saving || !settings) return;

    setSaving(true);
    const newSettings = { ...settings, [key]: !settings[key] };
    
    // Optimistically update UI
    setSettings(newSettings);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        // Revert on failure
        setSettings(settings); 
        throw new Error('Failed to save settings.');
      }
    } catch (err) {
      setError(err.message);
      // Revert on failure
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!settings) return <div>No settings found.</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Portal Security Settings</h2>
      <p className="text-slate-500 mb-6">Control student actions during assessments. Changes are saved automatically.</p>
      
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-w-lg">
        <ul className="divide-y divide-slate-200">
          {Object.entries(settings).map(([key, value]) => (
            <li key={key} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-slate-800 capitalize">{key.replace('tabswitchwarning', 'Tab Switch Warning')}</p>
                <p className="text-sm text-slate-500">
                  {value ? 'Enabled' : 'Disabled'} - {value ? 'Students cannot perform this action.' : 'Students can perform this action.'}
                </p>
              </div>
              <button
                onClick={() => handleToggle(key)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  value ? 'bg-purple-600' : 'bg-slate-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="sr-only">Use setting</span>
                <span
                  className={`pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    value ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-200 ease-in-out ${ value ? 'opacity-100 ease-in duration-200' : 'opacity-0 ease-out duration-100'}`}>
                    <ShieldCheck className="h-3 w-3 text-purple-600" />
                  </span>
                  <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-100 ease-out ${ value ? 'opacity-0 ease-out duration-100' : 'opacity-100 ease-in duration-200'}`}>
                    <ShieldOff className="h-3 w-3 text-slate-400" />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PortalManagement;