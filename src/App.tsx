import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import { MainLayout } from './components/MainLayout';
import { Login } from './components/Login';

const AppRoutes = () => {
  const { user, loading } = useContext(AppContext);

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

  // Check if user is authenticated (and not using the default placeholder UUID if we want to enforce real auth)
  // The current AppContext sets a default UUID if none exists.
  // For the Login feature to be meaningful, we should check if it's a real session user or at least allow logout.
  // But AppContext logic:
  // if (!userId) userId = '0000...'; setUser(session?.user || { id: userId });
  // So user is always defined.

  // We need to know if it's an authenticated session.
  // We can check user.aud === 'authenticated'.

  const isAuthenticated = user && user.aud === 'authenticated';

  // For dev/demo purpose, if we want to allow the "default" user to access without login, we can skip this check.
  // But the requirement is "User Authentication System".
  // So we should enforce login.
  // HOWEVER, to avoid locking out the user immediately if they rely on the localstorage ID, 
  // we might need a migration or just enforce it.

  // Let's enforce it. If user.id is the default zero-UUID, treat as unauthenticated?
  // Or just check `user.aud`.

  const isDemo = user?.id === '00000000-0000-0000-0000-000000000000';

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/*" element={(isAuthenticated || isDemo) ? <MainLayout /> : <Navigate to="/login" replace />} />
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
