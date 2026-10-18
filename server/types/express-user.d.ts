// Shape of the authenticated user that replitAuth stores on the session
// (see updateUserSession in server/replitAuth.ts).
declare global {
  namespace Express {
    interface User {
      claims?: {
        sub: string;
        exp?: number;
        [claim: string]: unknown;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

export {};
