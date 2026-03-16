import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

function AuthGuard({ children }: AuthGuardProps) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default AuthGuard;
