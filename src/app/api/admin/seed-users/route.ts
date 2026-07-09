import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';

// GET /api/admin/seed-users - Setup default admin and editor accounts
// This should only be used for initial setup or debugging
export async function GET(request: NextRequest) {
  try {
    // Check if admin already exists
    const existingAdmin = await UserModel.findByEmail('admin@example.com');
    if (existingAdmin) {
      return Response.json({ 
        message: 'Admin account already exists. Use the login page.',
        user: { email: existingAdmin.email, role: existingAdmin.role }
      });
    }

    // Create default super admin
    const admin = await UserModel.create(
      'Super Admin',
      'admin@example.com',
      'password123',
      'super_admin'
    );

    return Response.json({
      message: 'Default accounts created successfully',
      accounts: [
        { email: admin.email, password: 'password123', role: admin.role }
      ]
    });
  } catch (error) {
    console.error('Seed users error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

