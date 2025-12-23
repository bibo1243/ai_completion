import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import { MainLayout } from './components/MainLayout';
import { Login } from './components/Login';
import { ErrorScreen } from './components/ErrorScreen';

const AppRoutes = () => {
  const { user, loading, initError } = useContext(AppContext);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (initError) {
      return (
        <ErrorScreen 
            message={initError === "Supabase client not initialized" ? "服务不可用" : initError} 
        />
      );
  }

  const isAuthenticated = !!user;

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/*" element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
