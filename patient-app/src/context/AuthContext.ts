import React from 'react';

export interface AuthContextType {
  token: string | null;
  userRole: string | null;
  signIn: (accessToken: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({
  token: null,
  userRole: null,
  signIn: async () => {},
  signOut: async () => {},
});
