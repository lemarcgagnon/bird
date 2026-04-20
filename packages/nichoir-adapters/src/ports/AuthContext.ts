export interface AuthContext {
  readonly userId: string | null;
  readonly isAuthenticated: boolean;
}
