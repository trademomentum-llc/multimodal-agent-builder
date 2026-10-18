import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  X,
  AlertTriangle,
  Key,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number;
  historyCount: number;
}

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForced?: boolean; // For mandatory password changes
  userHas2FA?: boolean;
}

export default function PasswordChangeModal({
  isOpen,
  onClose,
  isForced = false,
  userHas2FA = false,
}: PasswordChangeModalProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch password policy
  const { data: passwordPolicy } = useQuery<PasswordPolicy>({
    queryKey: ['/api/auth/password-policy'],
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/change-password', {
        currentPassword,
        newPassword,
        twoFactorToken: userHas2FA ? twoFactorCode : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully',
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Password Change Failed',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    if (isForced) return; // Can't close if forced

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTwoFactorCode('');
    onClose();
  };

  const validatePassword = (password: string) => {
    if (!passwordPolicy) return { score: 0, checks: [] };

    const checks = [
      {
        label: `At least ${passwordPolicy.minLength} characters`,
        passed: password.length >= passwordPolicy.minLength,
      },
      {
        label: 'Contains uppercase letter',
        passed: !passwordPolicy.requireUppercase || /[A-Z]/.test(password),
      },
      {
        label: 'Contains lowercase letter',
        passed: !passwordPolicy.requireLowercase || /[a-z]/.test(password),
      },
      {
        label: 'Contains number',
        passed: !passwordPolicy.requireNumbers || /\d/.test(password),
      },
      {
        label: 'Contains special character',
        passed:
          !passwordPolicy.requireSpecialChars ||
          /[!@#$%^&*(),.?":{}|<>]/.test(password),
      },
    ];

    const score =
      (checks.filter((check) => check.passed).length / checks.length) * 100;
    return { score, checks };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const allFieldsValid =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    passwordsMatch &&
    passwordValidation.score === 100 &&
    (!userHas2FA || twoFactorCode.length === 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!allFieldsValid) {
      toast({
        title: 'Validation Error',
        description: 'Please ensure all fields are valid before submitting',
        variant: 'destructive',
      });
      return;
    }

    changePasswordMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <DialogTitle>
              {isForced ? 'Password Change Required' : 'Change Password'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isForced
              ? 'Your password has expired. Please choose a new secure password to continue.'
              : 'Update your account password to maintain security.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isForced && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Your password has been expired for security reasons. You must
                change it now to continue using the platform.
              </AlertDescription>
            </Alert>
          )}

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>

            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={passwordValidation.score}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500">
                    {passwordValidation.score.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  {passwordValidation.checks.map((check, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-sm"
                    >
                      {check.passed ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-red-500" />
                      )}
                      <span
                        className={
                          check.passed ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Two-Factor Code */}
          {userHas2FA && (
            <div className="space-y-2">
              <Label htmlFor="two-factor-code">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <span>Two-Factor Authentication Code</span>
                </div>
              </Label>
              <Input
                id="two-factor-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6),
                  )
                }
                maxLength={6}
                className="text-center text-lg tracking-wider"
                required
              />
              <p className="text-sm text-gray-500">
                Enter the code from your authenticator app
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              disabled={!allFieldsValid || changePasswordMutation.isPending}
              className="flex-1"
            >
              {changePasswordMutation.isPending
                ? 'Changing...'
                : 'Change Password'}
            </Button>
            {!isForced && (
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
