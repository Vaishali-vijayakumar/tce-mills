import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stage1_Create from './pages/Stage1_Create';
import Stage2_Quality from './pages/Stage2_Quality';
import Stage3_Sampling from './pages/Stage3_Sampling';
import Stage4_CTL from './pages/Stage4_CTL';
import Stage5_Payment from './pages/Stage5_Payment';

import Vendors from './pages/Vendors';
import Lots from './pages/Lots';
import ErrorBoundary from './components/ErrorBoundary';

// Placeholder Pages
// const Vendors = () => <div className="text-white">Vendors Page (Use Add Vendor in Create Contract for now)</div>;

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  console.log("App Rendering");
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="bg-gray-900 min-h-screen text-gray-100 font-sans">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="vendors" element={<Vendors />} />
                <Route path="lots" element={<Lots />} />
                <Route path="create-contract" element={<Stage1_Create />} />

                <Route path="contracts/:id" element={<Stage1_Create />} />
                <Route path="contracts/:id/view" element={<Stage1_Create />} />

                {/* Dynamic Stages */}
                <Route path="contracts/:id/stage2" element={<Stage2_Quality />} />
                <Route path="contracts/:id/stage3" element={<Stage3_Sampling />} />
                <Route path="contracts/:id/stage4" element={<Stage4_CTL />} />
                <Route path="contracts/:id/lots/:lotId/stage4" element={<Stage4_CTL />} />
                <Route path="contracts/:id/stage5" element={<Stage5_Payment />} />
                <Route path="contracts/:id/lots/:lotId/stage5" element={<Stage5_Payment />} />
                <Route path="*" element={<div className="p-20 text-center"><h1 className="text-4xl font-bold mb-4">404</h1><p className="text-xl">Page Not Found at {window.location.pathname}</p><button onClick={() => window.location.href = '/dashboard'} className="mt-8 bg-indigo-600 px-6 py-2 rounded-xl font-bold">Back to Dashboard</button></div>} />
              </Route>
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
