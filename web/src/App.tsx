import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Assessment from "./pages/Assessment";
import Teams from "./pages/Teams";
import Questions from "./pages/Questions";
import Assessments from "./pages/Assessments";
import Interview from "./pages/Interview";
import Review from "./pages/Review";
import CandidateReview from "./pages/CandidateReview";
import Layout from "./components/Layout";

function LayoutPage({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<LayoutPage><Dashboard /></LayoutPage>} />
        <Route path="/teams" element={<LayoutPage><Teams /></LayoutPage>} />
        <Route path="/questions" element={<LayoutPage><Questions /></LayoutPage>} />
        <Route path="/assessments" element={<LayoutPage><Assessments /></LayoutPage>} />
        <Route path="/review/:assessmentId" element={<LayoutPage><Review /></LayoutPage>} />
        <Route path="/candidate/:sessionId" element={<LayoutPage><CandidateReview /></LayoutPage>} />
        {/* Candidate-facing pages — no layout */}
        <Route path="/assessment/:token" element={<Assessment />} />
        <Route path="/interview/:token" element={<Interview />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
