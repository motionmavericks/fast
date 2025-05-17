import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { User } from '@/utils/models';

// Secret for JWT verification - should match the one used for token generation
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
};

// Verify admin token from cookies
export async function verifyAdminToken(request: Request): Promise<{
  isValid: boolean;
  isAdmin: boolean;
  userId?: string;
}> {
  try {
    // Get token from cookies or authorization header
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;
    
    // If no token found, check authorization header
    const authHeader = request.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    const finalToken = token || headerToken;
    
    if (!finalToken) {
      return { isValid: false, isAdmin: false };
    }
    
    // Verify token
    const { payload } = await jwtVerify(finalToken, getJwtSecret());
    
    // Extract claims
    const userId = payload.userId as string;
    const role = payload.role as string;
    
    // Check if user has admin role
    const isAdmin = role === 'admin' || role === 'superadmin';
    
    return {
      isValid: true,
      isAdmin,
      userId,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return { isValid: false, isAdmin: false };
  }
}

// Get user ID from request (with admin check)
export async function getUserIdFromRequest(request: Request): Promise<{
  userId?: string;
  isAdmin: boolean;
}> {
  try {
    const { isValid, userId, isAdmin } = await verifyAdminToken(request);
    
    if (!isValid || !userId) {
      return { isAdmin: false };
    }
    
    return {
      userId,
      isAdmin,
    };
  } catch (error) {
    console.error('Error getting user ID from request:', error);
    return { isAdmin: false };
  }
}

// Get full user details from request token
export async function getUserFromRequest(request: Request): Promise<{
  user?: any;
  isAdmin: boolean;
}> {
  try {
    const { userId, isAdmin } = await getUserIdFromRequest(request);
    
    if (!userId) {
      return { isAdmin: false };
    }
    
    // Get user from database
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return { isAdmin: false };
    }
    
    return {
      user,
      isAdmin,
    };
  } catch (error) {
    console.error('Error getting user from request:', error);
    return { isAdmin: false };
  }
}
