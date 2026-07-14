import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Assessment from "./pages/Assessment";
import Teams from "./pages/Teams";
import Questions from "./pages/Questions";
import Assessments from "./pages/Assessments";
import Interview from "./pages/Interview";
import Review from "./pages/Review";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/assessments" element={<Assessments />} />
        <Route path="/assessment/:token" element={<Assessment />} />
        <Route path="/interview/:token" element={<Interview />} />
        <Route path="/review/:assessmentId" element={<Review />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
