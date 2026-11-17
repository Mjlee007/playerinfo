import { Navigate, useLocation } from "react-router-dom";
import { useStart } from "../context/StartContext.jsx";

// Sends visitors to the welcome screen until they press "Let's start".
export default function ProtectedRoute({ children }) {
  const { started } = useStart();
  const location = useLocation();
  if (!started) return <Navigate to="/welcome" replace state={{ from: location }} />;
  return children;
}
