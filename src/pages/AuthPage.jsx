import React, { useState } from 'react';
import AuthForm from '../components/AuthForm';

const AuthPage = () => {
  // This state will control which form is shown. Start with login.
  const [isRegistering, setIsRegistering] = useState(false);

  const toggleForm = () => {
    setIsRegistering(!isRegistering);
  };

  return (
    // We pass the toggle function down to the form so it can switch views
    <AuthForm 
      isRegister={isRegistering} 
      toggleForm={toggleForm} 
    />
  );
};

export default AuthPage;