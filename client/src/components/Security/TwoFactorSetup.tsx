import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Smartphone,
  Key,
  Copy,
  CheckCircle,
  AlertTriangle,
  QrCode,
  Download,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function TwoFactorSetup({
  onComplete,
  onCancel,
}: TwoFactorSetupProps) {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);

  // Generate 2FA setup
  const setupMutation = useMutation({
    mutationFn: async () => {
      return (await apiRequest('GET', '/api/auth/2fa/setup')) as TwoFactorSetup;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setStep('verify');
      toast({
        title: '2FA Setup Generated',
        description: 'Scan the QR code with your authenticator app',
      });
    },
    onError: (error) => {
      toast({
        title: 'Setup Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // Verify and enable 2FA
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!setupData) throw new Error('Setup data not available');

      return await apiRequest('POST', '/api/auth/2fa/verify-setup', {
        secret: setupData.secret,
        token: verificationCode,
        backupCodes: setupData.backupCodes,
      });
    },
    onSuccess: () => {
      setStep('backup');
      toast({
        title: '2FA Enabled',
        description: 'Two-factor authentication has been successfully enabled',
      });
    },
    onError: (error) => {
      toast({
        title: 'Verification Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Text copied to clipboard',
    });
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const content = `Agent Factory Platform - Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\nUse these codes if you lose access to your authenticator app:\n\n${setupData.backupCodes.join('\n')}\n\nIMPORTANT:\n- Each code can only be used once\n- Store these codes in a secure location\n- Do not share these codes with anyone`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-factory-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: 'Backup codes downloaded successfully',
    });
  };

  const handleVerifyCode = () => {
    if (!verificationCode.trim()) {
      toast({
        title: 'Verification Required',
        description:
          'Please enter the verification code from your authenticator app',
        variant: 'destructive',
      });
      return;
    }

    verifyMutation.mutate();
  };

  const handleComplete = () => {
    onComplete();
    toast({
      title: '2FA Setup Complete',
      description:
        'Your account is now protected with two-factor authentication',
    });
  };

  return (
    <div className="w-full p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle>Two-Factor Authentication Setup</CardTitle>
              <CardDescription>
                Add an extra layer of security to your National Reserve account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'setup' && (
            <div className="space-y-6">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  Two-factor authentication (2FA) adds an extra layer of
                  security to your account. You&apos;ll need an authenticator
                  app like Google Authenticator, Authy, or Microsoft
                  Authenticator.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">What you&apos;ll need:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4" />
                    <span>
                      A smartphone with an authenticator app installed
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <span>Access to scan a QR code or enter a setup key</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>A secure place to store backup recovery codes</span>
                  </li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                  className="flex-1"
                >
                  {setupMutation.isPending ? 'Generating...' : 'Start Setup'}
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === 'verify' && setupData && (
            <div className="space-y-6">
              <Alert>
                <QrCode className="w-4 h-4" />
                <AlertDescription>
                  Scan the QR code below with your authenticator app, then enter
                  the 6-digit code to verify setup.
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="qr" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr">QR Code</TabsTrigger>
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="space-y-4">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <img
                        src={setupData.qrCodeUrl}
                        alt="2FA QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      Scan this QR code with your authenticator app
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <div className="space-y-3">
                    <Label>Manual Entry Key:</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={setupData.manualEntryKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(setupData.manualEntryKey)
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Enter this key manually in your authenticator app if you
                      can&apos;t scan the QR code
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(
                        e.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    maxLength={6}
                    className="text-center text-lg tracking-wider"
                  />
                  <p className="text-sm text-gray-500">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={handleVerifyCode}
                    disabled={
                      verificationCode.length !== 6 || verifyMutation.isPending
                    }
                    className="flex-1"
                  >
                    {verifyMutation.isPending
                      ? 'Verifying...'
                      : 'Verify & Enable'}
                  </Button>
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'backup' && setupData && (
            <div className="space-y-6">
              <Alert>
                <Key className="w-4 h-4" />
                <AlertDescription>
                  <strong>Important:</strong> Save these backup codes in a
                  secure location. You can use them to access your account if
                  you lose your authenticator device.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Backup Recovery Codes</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadBackupCodes}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Badge variant="outline" className="font-mono">
                        {code}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(code)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Security Notice:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• Each backup code can only be used once</li>
                      <li>• Store these codes in a secure password manager</li>
                      <li>• Do not share these codes with anyone</li>
                      <li>
                        • Generate new codes if you suspect they&apos;re
                        compromised
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-center">
                  <Button onClick={handleComplete} className="w-full">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Setup
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
