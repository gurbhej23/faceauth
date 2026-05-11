import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FaceRegister from "./pages/FaceRegister";
import FaceLogin from "./pages/FaceLogin";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/face-register" element={<FaceRegister />} />
        <Route path="/face-login" element={<FaceLogin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
