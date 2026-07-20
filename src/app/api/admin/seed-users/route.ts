import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';

// GET /api/admin/seed-users - Setup default admin and editor accounts
// This should only be used for initial setup or debugging
export async function GET(request: NextRequest) {
  try {
    const seedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    // Check if admin already exists
    const existingAdmin = await UserModel.findByEmail(seedEmail);
    if (existingAdmin) {
      return Response.json({ 
        message: 'Admin account already exists. Use the login page.',
        user: { email: existingAdmin.email, role: existingAdmin.role }
      });
    }

    // Credentials for the seeded super admin must be supplied via environment
    // variables — never hardcode them, and never echo the password back.
    const seedPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!seedPassword || seedPassword.length < 8) {
      return Response.json(
        {
          error:
            'SEED_ADMIN_PASSWORD is not set (or shorter than 8 chars). Set it in the environment before seeding.',
        },
        { status: 400 }
      );
    }

    // Create default super admin
    const admin = await UserModel.create(
      'Super Admin',
      seedEmail,
      seedPassword,
      'super_admin'
    );

    return Response.json({
      message: 'Default super admin created successfully',
      accounts: [{ email: admin.email, role: admin.role }],
    });
  } catch (error) {
    console.error('Seed users error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

