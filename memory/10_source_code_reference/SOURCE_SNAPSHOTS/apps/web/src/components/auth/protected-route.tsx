import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * Route protection gate for DRISTI-NET workstation.
 * Unauthenticated requests are redirected to /login with the intended destination
 * preserved in location.state.from so post-login deep navigation works seamlessly.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {  isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
