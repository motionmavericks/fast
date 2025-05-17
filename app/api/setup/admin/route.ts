import { NextResponse } from 'next/server';
import { hashPassword } from '@/utils/auth';
import User from '@/utils/models'; // Corrected import for the User model
import dbConnect from '@/utils/dbConnect';

export async function POST(request: Request) {
  try {
    await dbConnect(); // Ensure DB is connected

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if an admin user already exists (e.g., with 'superadmin' role)
    const existingAdmin = await User.findOne({ role: 'superadmin' });
    if (existingAdmin) {
      return NextResponse.json(
        { message: 'A superadmin user already exists. Setup cannot proceed further for admin creation.' },
        { status: 409 } // Conflict
      );
    }

    const hashedPassword = await hashPassword(password);

    const newUser = new User({
      email,
      password: hashedPassword, // Store hashed password
      role: 'superadmin', // Designate the first user as superadmin
    });

    await newUser.save();

    console.log(`Superadmin user created: ${email}`);

    return NextResponse.json(
      { message: 'Superadmin user created successfully' },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Admin user creation error:', error);
    // Check for MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'This email address is already registered.', field: 'email' },
        { status: 409 } // Conflict
      );
    }
    return NextResponse.json(
      { message: 'Error creating admin user', error: error.message },
      { status: 500 }
    );
  }
}
