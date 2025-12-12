import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and, gt, lt } from 'drizzle-orm';
import { db, users, sessions, User } from '../db/index.js';

const SALT_ROUNDS = 10;
const SESSION_DURATION_DAYS = 30;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session management
export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function validateSession(token: string): Promise<User | null> {
  const now = new Date();

  // Find session where expiresAt > now (session not expired)
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  if (!session) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user || null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  // Delete sessions where expiresAt < now (expired)
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return result.rowCount || 0;
}

// User management
export async function getUserByLssName(lssName: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.lssName, lssName))
    .limit(1);

  return user || null;
}

export async function createUser(lssName: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);

  const [newUser] = await db.insert(users).values({
    lssName,
    passwordHash,
    isActive: false,
    isAdmin: false,
  }).returning();

  return newUser;
}

// Admin account management
export async function ensureAdminExists(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.log('[Auth] ADMIN_USERNAME or ADMIN_PASSWORD not set, skipping admin creation');
    return;
  }

  const existingAdmin = await getUserByLssName(adminUsername);

  if (existingAdmin) {
    // Update password if changed
    const passwordHash = await hashPassword(adminPassword);
    await db.update(users)
      .set({
        passwordHash,
        isActive: true,
        isAdmin: true,
      })
      .where(eq(users.id, existingAdmin.id));
    console.log(`[Auth] Admin account "${adminUsername}" updated`);
  } else {
    // Create admin account
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      lssName: adminUsername,
      passwordHash,
      displayName: 'Administrator',
      isActive: true,
      isAdmin: true,
    });
    console.log(`[Auth] Admin account "${adminUsername}" created`);
  }
}

// Get all users (for admin)
export async function getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const allUsers = await db.select({
    id: users.id,
    lssName: users.lssName,
    displayName: users.displayName,
    allianceMemberId: users.allianceMemberId,
    isActive: users.isActive,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  }).from(users);

  return allUsers;
}

// Get pending users (not yet activated)
export async function getPendingUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const pendingUsers = await db.select({
    id: users.id,
    lssName: users.lssName,
    displayName: users.displayName,
    allianceMemberId: users.allianceMemberId,
    isActive: users.isActive,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  }).from(users).where(eq(users.isActive, false));

  return pendingUsers;
}

// Activate user (admin action)
export async function activateUser(
  userId: number,
  allianceMemberId: number | null,
  displayName: string | null
): Promise<User | null> {
  const [updated] = await db.update(users)
    .set({
      isActive: true,
      allianceMemberId,
      displayName,
    })
    .where(eq(users.id, userId))
    .returning();

  return updated || null;
}

// Delete user
export async function deleteUser(userId: number): Promise<boolean> {
  // First delete all sessions
  await deleteUserSessions(userId);

  // Then delete user
  const result = await db.delete(users).where(eq(users.id, userId));
  return (result.rowCount || 0) > 0;
}

// Update last login time
export async function updateLastLogin(userId: number): Promise<void> {
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}
