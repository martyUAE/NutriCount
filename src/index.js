import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import NutriCounter from './components/NutriCounter';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <NutriCounter />
  </React.StrictMode>
);