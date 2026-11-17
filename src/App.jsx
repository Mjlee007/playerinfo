import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Welcome from "./view/Welcome.jsx";
import Dashboard from "./view/Dashboard.jsx";
import Players from "./view/Players.jsx";
import PlayerDetails from "./view/PlayerDetails.jsx";
import Scorecard from "./view/Scorecard.jsx";
import Matches from "./view/Matches.jsx";
import Compare from "./view/Compare.jsx";
import Schedule from "./view/Schedule.jsx";
import ScoreEntry from "./view/ScoreEntry.jsx";
import MatchScorecard from "./view/MatchScorecard.jsx";
import LiveScoring from "./view/LiveScoring.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Navigate to="/welcome" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:id" element={<PlayerDetails />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/schedule/:id" element={<MatchScorecard />} />
        <Route path="/schedule/:id/score" element={<ScoreEntry />} />
        <Route path="/schedule/:id/live" element={<LiveScoring />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
