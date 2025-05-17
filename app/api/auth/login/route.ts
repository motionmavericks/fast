import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import User from '@/utils/models';
import { comparePassword } from '@/utils/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env.local or your deployment settings');
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 } // Unauthorized
      );
    }

    // Only allow 'admin' or 'superadmin' roles to login to the admin panel
    if (user.role !== 'admin' && user.role !== 'superadmin') {
        return NextResponse.json(
            { message: 'Access denied. Not an admin user.' },
            { status: 403 } // Forbidden
        );
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' } // Token expires in 1 day, adjust as needed
    );

    const response = NextResponse.json(
      { 
        message: 'Login successful', 
        token, 
        user: { id: user._id, email: user.email, role: user.role }
      },
      { status: 200 }
    );

    // Set HttpOnly cookie for better security if preferred over localStorage token
    // response.cookies.set('token', token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'strict',
    //   maxAge: 60 * 60 * 24, // 1 day
    //   path: '/',
    // });

    return response;

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { message: 'Error during login', error: error.message },
      { status: 500 }
    );
  }
}
