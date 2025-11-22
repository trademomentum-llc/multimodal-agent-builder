export interface CouncilMember {
  provider: string;
  model: string;
  reasoning: string;
  recommendation: string;
  usage?: Record<string, number>;
  error?: string;
  finished_at: string;
}

export interface CouncilChatResponse {
  conversation_id: string;
  prompt: string;
  council_summary: string;
  recommended_action: string;
  members: CouncilMember[];
  created_at: string;
}

export interface CouncilDecisionResponse extends CouncilChatResponse {
  status: 'approve' | 'deny' | 'edit' | 'revise';
  reviewer_comments?: string | null;
  created_at: string;
}
