import React from 'react';
import { useAuth } from './context/AuthContext';
import NutriCounter from './components/NutriCounter';
import AuthPage from './pages/AuthPage';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* If a user exists, show the main app. Otherwise, show the AuthPage. */}
      { user ? <NutriCounter /> : <AuthPage /> }
    </div>
  );
}

export default App;