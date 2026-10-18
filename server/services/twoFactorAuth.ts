import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { auditLogger } from './auditLogger';

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  historyCount: number; // previous passwords to check
}

class TwoFactorAuthService {
  private readonly passwordPolicy: PasswordPolicy = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // 90 days
    historyCount: 5,
  };

  private readonly jwtSecret =
    process.env.JWT_SECRET || 'your-super-secret-jwt-key';
  private readonly appName = 'Agent Factory Platform';

  /**
   * Generate 2FA secret and QR code for user setup
   */
  async generateTwoFactorSetup(
    userId: string,
    userEmail: string,
  ): Promise<TwoFactorSetup> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${userEmail})`,
        issuer: this.appName,
        length: 32,
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      await auditLogger.log(
        userId,
        '2fa.setup.generated',
        'security',
        null,
        null,
      );

      return {
        secret: secret.base32!,
        qrCodeUrl,
        backupCodes,
        manualEntryKey: secret.base32!,
      };
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.setup.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      throw new Error('Failed to generate 2FA setup');
    }
  }

  /**
   * Verify 2FA token during setup
   */
  async verifySetupToken(
    secret: string,
    token: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps before/after
      });

      await auditLogger.log(
        userId,
        '2fa.setup.verify',
        'security',
        null,
        null,
        verified,
      );
      return verified;
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.setup.verify.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Enable 2FA for user after verification
   */
  async enableTwoFactor(
    userId: string,
    secret: string,
    backupCodes: string[],
  ): Promise<boolean> {
    try {
      // Hash backup codes for storage
      const hashedBackupCodes = await Promise.all(
        backupCodes.map((code) => bcrypt.hash(code, 12)),
      );

      // Update user with 2FA settings
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await storage.updateUserSecurity(userId, {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: hashedBackupCodes,
      });

      await auditLogger.log(userId, '2fa.enabled', 'security', null, null);
      return true;
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.enable.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Verify 2FA token during login
   */
  async verifyLoginToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return false;
      }

      // Check if it's a backup code
      if (token.length === 8 && /^[A-Z0-9]{8}$/.test(token)) {
        return await this.verifyBackupCode(userId, token);
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2,
      });

      await auditLogger.log(
        userId,
        '2fa.login.verify',
        'security',
        null,
        null,
        verified,
      );
      return verified;
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.login.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Verify backup code and invalidate it
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.twoFactorBackupCodes) {
        return false;
      }

      const backupCodes = user.twoFactorBackupCodes as string[];

      for (let i = 0; i < backupCodes.length; i++) {
        const isValid = await bcrypt.compare(code, backupCodes[i]);
        if (isValid) {
          // Remove used backup code
          backupCodes.splice(i, 1);

          // Update user with remaining codes
          await storage.updateUserSecurity(userId, {
            twoFactorBackupCodes: backupCodes,
          });

          await auditLogger.log(
            userId,
            '2fa.backup.used',
            'security',
            null,
            null,
          );
          return true;
        }
      }

      await auditLogger.log(
        userId,
        '2fa.backup.invalid',
        'security',
        null,
        null,
        false,
      );
      return false;
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.backup.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Disable 2FA for user (with proper verification)
   */
  async disableTwoFactor(
    userId: string,
    currentPassword: string,
    token: string,
  ): Promise<boolean> {
    try {
      // Verify current password and 2FA token
      const user = await storage.getUser(userId);
      if (!user || !user.passwordHash) {
        return false;
      }

      const passwordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      const tokenValid = await this.verifyLoginToken(userId, token);

      if (!passwordValid || !tokenValid) {
        await auditLogger.log(
          userId,
          '2fa.disable.failed',
          'security',
          null,
          null,
          false,
          'Invalid credentials',
        );
        return false;
      }

      // Disable 2FA
      await storage.updateUserSecurity(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      });

      await auditLogger.log(userId, '2fa.disabled', 'security', null, null);
      return true;
    } catch (error) {
      await auditLogger.log(
        userId,
        '2fa.disable.error',
        'security',
        null,
        null,
        false,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Check if user needs to change password (90-day policy)
   */
  async checkPasswordExpiry(
    userId: string,
  ): Promise<{ expired: boolean; daysRemaining: number }> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.lastPasswordChange) {
        return { expired: true, daysRemaining: 0 };
      }

      const daysSinceChange = Math.floor(
        (Date.now() - new Date(user.lastPasswordChange).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const daysRemaining = this.passwordPolicy.maxAge - daysSinceChange;
      const expired = daysRemaining <= 0;

      return { expired, daysRemaining };
    } catch (error) {
      console.error('Error checking password expiry:', error);
      return { expired: true, daysRemaining: 0 };
    }
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.passwordPolicy.minLength) {
      errors.push(
        `Password must be at least ${this.passwordPolicy.minLength} characters long`,
      );
    }

    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      this.passwordPolicy.requireSpecialChars &&
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash password securely
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < 8; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      codes.push(code);
    }

    return codes;
  }

  /**
   * Generate secure session token with 2FA info
   */
  generateSecureToken(userId: string, twoFactorVerified: boolean): string {
    const payload = {
      userId,
      twoFactorVerified,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Verify secure session token
   */
  verifySecureToken(token: string): {
    valid: boolean;
    userId?: string;
    twoFactorVerified?: boolean;
  } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      if (typeof decoded === 'string') return { valid: false };
      return {
        valid: true,
        userId: decoded.userId,
        twoFactorVerified: decoded.twoFactorVerified,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Get password policy for frontend display
   */
  getPasswordPolicy(): PasswordPolicy {
    return { ...this.passwordPolicy };
  }
}

export const twoFactorAuthService = new TwoFactorAuthService();
