import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hashedPassword);
  return isMatch;
}

export interface AuthResult {
  isAuthenticated: boolean;
  user?: any; // Consider defining a more specific user type/interface
  error?: string;
  status?: number;
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return { isAuthenticated: false, error: 'No token provided', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    return { isAuthenticated: true, user: decoded };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return { isAuthenticated: false, error: 'Token expired', status: 401 };
    }
    if (error.name === 'JsonWebTokenError') {
      return { isAuthenticated: false, error: 'Invalid token', status: 401 };
    }
    console.error('Error verifying auth token:', error);
    return { isAuthenticated: false, error: 'Authentication failed', status: 500 };
  }
}
