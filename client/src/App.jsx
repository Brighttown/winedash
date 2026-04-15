import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Wines from './pages/Wines';
import UploadPage from './pages/UploadPage';
import Catalog from './pages/Catalog';
import CatalogDetail from './pages/CatalogDetail';
import ExcelImport from './pages/ExcelImport';
import AdminUsers from './pages/AdminUsers';
import AdminApproval from './pages/AdminApproval';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Auth />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="catalog/:id" element={<CatalogDetail />} />
          {/* User routes */}
          <Route path="wines" element={<Wines />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="excel-import" element={<ExcelImport />} />
          {/* Admin routes */}
          <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="admin/approval" element={<AdminRoute><AdminApproval /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
