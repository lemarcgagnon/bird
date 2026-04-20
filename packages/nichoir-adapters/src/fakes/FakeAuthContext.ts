import type { AuthContext } from '../ports/AuthContext.js';

export const FakeAuthContext: AuthContext = {
  userId: 'dev-user',
  isAuthenticated: true,
};
