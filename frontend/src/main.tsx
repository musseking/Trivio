import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import App from './App';
import './styles.css';
import './owner.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ThemeProvider><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></ThemeProvider></StrictMode>,
);
