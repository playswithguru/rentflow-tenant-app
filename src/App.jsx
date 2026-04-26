import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginPage from "./components/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./firebase/AuthContext";
import RentFlowGate from "./components/RentFlowGate";
import Footer from "./Footer";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-white">
          <main className="flex-1">
            <Routes>
              <Route path="/login" element={<LoginPage appName="RentFlow" />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RentFlowGate />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
