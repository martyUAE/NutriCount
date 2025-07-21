import React, { useState } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { Apple } from "lucide-react";

const AuthForm = ({ isRegister, toggleForm }) => { 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        //stores personal data
         await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          createdAt: serverTimestamp(), // Use server's timestamp for accuracy
          profile: {
            age: '',
            gender: 'female',
            height: '',
            weight: '',
            activityLevel: 'sedentary',
            goal: 'maintain'
          },
          goals: {
            calories: 2200,
            protein: 120,
            carbs: 200,
            fat: 75
          }
          });
        // Registration logic
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // login logic
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please login.");
      } else {
        setError("An error occurred. Please try again.");
      }
      console.error(err); 
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md space-y-6 border border-gray-100">
        <div className="flex items-center space-x-3 justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Apple className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">NutriCounter</h1>
        </div>
        {/* Changed "Register" to "Create an Account" for better UX */}
        <h2 className="text-2xl font-bold text-center text-gray-800">{isRegister ? "Create an Account" : "Login"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6" // Good practice to add a minLength for Firebase passwords
          />
          {/* Improved error styling */}
          {error && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg border border-red-200">{error}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {isRegister ? "Sign Up" : "Login"}
          </button>
        </form>
        {/* REPLACED the <a> tags with a button that calls the toggleForm function */}
        <div className="text-sm text-center text-gray-500">
          {isRegister ? "Already have an account? " : "No account? "}
          <button 
            type="button" // Important to specify type="button" to prevent form submission
            onClick={toggleForm} 
            className="font-medium text-blue-600 hover:underline focus:outline-none"
          >
            {isRegister ? "Login" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
