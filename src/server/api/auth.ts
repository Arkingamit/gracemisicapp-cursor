
import { UserModel } from '../models/user';

export async function login(email: string, password: string) {
  try {
    const user = await UserModel.authenticate(email, password);
    if (!user) {
      throw new Error('Invalid email or password');
    }
    return user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function register(username: string, email: string, password: string) {
  try {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Create new user
    const user = await UserModel.create(username, email, password);
    return user;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

export async function getUserProfile(userId: string) {
  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error("Get profile error:", error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, updates: any) {
  try {
    const user = await UserModel.update(userId, updates);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error("Update profile error:", error);
    throw error;
  }
}
