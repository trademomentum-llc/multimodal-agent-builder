import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  CouncilChatResponse,
  CouncilDecisionResponse,
  CouncilMember,
} from '@/types/council';
import {
  Users,
  Lightbulb,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  RefreshCw,
} from 'lucide-react';

export default function CouncilChat() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentOutcome, setCurrentOutcome] = useState<CouncilChatResponse | null>(null);
  const [history, setHistory] = useState<CouncilChatResponse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'Please sign in to run council deliberations.',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/api/login';
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const runCouncil = async (inputPrompt?: string) => {
    if (!prompt.trim() && !inputPrompt) return;
    setIsSubmitting(true);
    const body = {
      prompt: inputPrompt ?? prompt,
      conversation_id: conversationId ?? undefined,
    };
    try {
      const res = await fetch('/council/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error('Failed to get council response');
      }
      const data: CouncilChatResponse = await res.json();
      setCurrentOutcome(data);
      setConversationId(data.conversation_id);
      setEditedPrompt(data.prompt);
      setHistory((prev) => [data, ...prev.slice(0, 3)]);
    } catch (error) {
      toast({
        title: 'Council unavailable',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDecision = async (decision: 'approve' | 'deny' | 'edit' | 'revise') => {
    if (!currentOutcome) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/council/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentOutcome.conversation_id,
          decision,
          edited_prompt: decision === 'edit' ? editedPrompt : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error('Decision could not be recorded');
      }
      const data: CouncilDecisionResponse = await res.json();
      const nextOutcome: CouncilChatResponse = {
        conversation_id: data.conversation_id,
        prompt: data.prompt,
        council_summary: data.council_summary,
        recommended_action: data.recommended_action,
        members: data.members,
        created_at: data.created_at,
      };
      setCurrentOutcome(nextOutcome);
      toast({
        title: decision === 'approve' ? 'Approved' : decision === 'deny' ? 'Denied' : 'Updated',
        description:
          decision === 'edit'
            ? 'Council reran on the edited prompt.'
            : 'Decision recorded for this conversation.',
      });
      if (decision === 'edit') {
        setHistory((prev) => [nextOutcome, ...prev.slice(0, 3)]);
      }
    } catch (error) {
      toast({
        title: 'Action failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!currentOutcome) return null;
    const status = currentOutcome.recommended_action;
    if (status === 'approve') {
      return <Badge className="bg-emerald-100 text-emerald-700">Council: Approve</Badge>;
    }
    if (status === 'deny') {
      return <Badge variant="destructive">Council: Deny</Badge>;
    }
    return <Badge variant="outline">Council: Revise</Badge>;
  }, [currentOutcome]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header
          title="Council Chat"
          description="Fan out prompts to OpenAI, Gemini, and Claude, then review the collective decision."
        />
        <main className="p-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-primary" />
                      <span>Send a prompt to the council</span>
                    </CardTitle>
                    <CardDescription>
                      Each provider responds independently; the council chair proposes a
                      recommendation.
                    </CardDescription>
                  </div>
                  {statusBadge}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe the action you want the agents to take..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[140px]"
                />
                <div className="flex items-center space-x-3">
                  <Button onClick={() => runCouncil()} disabled={isSubmitting || !prompt.trim()}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Run council
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPrompt('');
                      setEditedPrompt('');
                    }}
                    disabled={isSubmitting}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  {currentOutcome && (
                    <Badge variant="secondary" className="ml-auto">
                      Conversation: {currentOutcome.conversation_id.slice(0, 8)}…
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <span>Council decision</span>
                </CardTitle>
                <CardDescription>
                  Review the unified recommendation and approve, edit, or deny.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-700 dark:text-gray-200 min-h-[120px] whitespace-pre-line">
                  {currentOutcome?.council_summary || 'Run a prompt to see council output.'}
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Edit before approval (optional)</label>
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    placeholder="Adjust the action the council should approve..."
                    className="min-h-[90px]"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => submitDecision('deny')}
                    disabled={!currentOutcome || isSubmitting}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Deny
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => submitDecision('edit')}
                    disabled={!currentOutcome || isSubmitting}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Edit & Rerun
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => submitDecision('approve')}
                    disabled={!currentOutcome || isSubmitting}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500 pt-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Actions are recorded per conversation; edits rerun the council on your changes.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {currentOutcome && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Individual model reasoning
                </h3>
                <Badge variant="outline">
                  Recommended: {currentOutcome.recommended_action.toUpperCase()}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {currentOutcome.members.map((member) => (
                  <ModelCard key={member.provider} member={member} />
                ))}
              </div>
            </section>
          )}

          {history.length > 1 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Recent council runs
              </h4>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {history.slice(1).map((item) => (
                  <Card key={item.conversation_id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{item.prompt.slice(0, 48)}...</span>
                        <Badge variant="outline">{item.recommended_action}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(item.created_at).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-gray-600 dark:text-gray-300 line-clamp-4">
                      {item.council_summary}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function ModelCard({ member }: { member: CouncilMember }) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{member.provider}</CardTitle>
          <Badge variant={member.error ? 'destructive' : 'secondary'}>
            {member.error ? 'error' : 'ok'}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {member.model} · {new Date(member.finished_at).toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
        {member.error ? (
          <p className="text-error text-sm">{member.error}</p>
        ) : (
          <>
            <p className="font-medium text-gray-900 dark:text-white">Reasoning</p>
            <p className="text-sm whitespace-pre-line">{member.reasoning}</p>
            <Separator />
            <p className="text-xs text-gray-500">
              Recommendation: {member.recommendation || 'n/a'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
