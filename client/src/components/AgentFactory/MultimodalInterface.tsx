import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  Image as ImageIcon,
  Mic,
  Send,
  Brain,
  Eye,
  Volume2,
  Loader2,
  Trash2,
  Zap,
} from 'lucide-react';
import { Agent } from '@/types/agent';

interface MultimodalInterfaceProps {
  agent: Agent;
  onClose: () => void;
}

interface MultimodalResponse {
  id: string;
  agentId: number;
  agentName: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  modalities?: string[];
  processingTime?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
  state?: string;
}

interface AgentCapabilities {
  text: boolean;
  image: boolean;
  audio: boolean;
  streaming: boolean;
  functions: boolean;
  memory: boolean;
  multimodal_reasoning: boolean;
}

export default function MultimodalInterface({
  agent,
  onClose,
}: MultimodalInterfaceProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    MultimodalResponse[]
  >([]);

  // Get agent capabilities
  const { data: capabilities, isLoading: capabilitiesLoading } =
    useQuery<AgentCapabilities>({
      queryKey: [`/api/multimodal/agents/${agent.id}/capabilities`],
    });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (data: { message: string; sessionId?: string }) => {
      const response = await fetch(`/api/multimodal/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }

      return response.json() as Promise<MultimodalResponse>;
    },
    onSuccess: (response) => {
      setConversationHistory((prev) => [...prev, response]);
      if (response.metadata?.sessionId && !sessionId) {
        setSessionId(response.metadata.sessionId);
      }
      setTextInput('');
      toast({
        title: 'Message sent',
        description: `Response in ${response.processingTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Chat error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // Image processing mutation
  const imageMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      prompt: string;
      sessionId?: string;
    }) => {
      const formData = new FormData();
      formData.append('image', data.file);
      formData.append('prompt', data.prompt);
      if (data.sessionId) {
        formData.append('sessionId', data.sessionId);
      }

      const response = await fetch(`/api/multimodal/agents/${agent.id}/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Image processing failed: ${response.statusText}`);
      }

      return response.json() as Promise<MultimodalResponse>;
    },
    onSuccess: (response) => {
      setConversationHistory((prev) => [...prev, response]);
      if (response.metadata?.sessionId && !sessionId) {
        setSessionId(response.metadata.sessionId);
      }
      setSelectedFile(null);
      setTextInput('');
      toast({
        title: 'Image processed',
        description: `Analysis completed in ${response.processingTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Image processing error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // Audio processing mutation
  const audioMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      task: string;
      sessionId?: string;
    }) => {
      const formData = new FormData();
      formData.append('audio', data.file);
      formData.append('task', data.task);
      if (data.sessionId) {
        formData.append('sessionId', data.sessionId);
      }

      const response = await fetch(`/api/multimodal/agents/${agent.id}/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Audio processing failed: ${response.statusText}`);
      }

      return response.json() as Promise<MultimodalResponse>;
    },
    onSuccess: (response) => {
      setConversationHistory((prev) => [...prev, response]);
      if (response.metadata?.sessionId && !sessionId) {
        setSessionId(response.metadata.sessionId);
      }
      setSelectedFile(null);
      toast({
        title: 'Audio processed',
        description: `Transcription completed in ${response.processingTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Audio processing error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // Multimodal processing mutation
  const multimodalMutation = useMutation({
    mutationFn: async (data: {
      text?: string;
      imageFile?: File;
      audioFile?: File;
      sessionId?: string;
    }) => {
      const formData = new FormData();
      if (data.text) formData.append('text', data.text);
      if (data.imageFile) formData.append('image', data.imageFile);
      if (data.audioFile) formData.append('audio', data.audioFile);
      if (data.sessionId) formData.append('sessionId', data.sessionId);

      const response = await fetch(
        `/api/multimodal/agents/${agent.id}/multimodal`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Multimodal processing failed: ${response.statusText}`);
      }

      return response.json() as Promise<MultimodalResponse>;
    },
    onSuccess: (response) => {
      setConversationHistory((prev) => [...prev, response]);
      if (response.metadata?.sessionId && !sessionId) {
        setSessionId(response.metadata.sessionId);
      }
      setSelectedFile(null);
      setTextInput('');
      toast({
        title: 'Multimodal analysis complete',
        description: `Processed ${response.modalities?.join(', ')} in ${response.processingTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Multimodal processing error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // Clear agent memory
  const clearMemoryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/multimodal/agents/${agent.id}/memory/clear`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to clear memory: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      setConversationHistory([]);
      setSessionId(null);
      toast({
        title: 'Memory cleared',
        description: 'Agent conversation history has been reset',
      });
    },
    onError: (error) => {
      toast({
        title: 'Clear memory error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSendMessage = () => {
    if (!textInput.trim()) return;

    chatMutation.mutate({
      message: textInput,
      sessionId: sessionId || undefined,
    });
  };

  const handleProcessImage = () => {
    if (!selectedFile) return;

    imageMutation.mutate({
      file: selectedFile,
      prompt: textInput || "What's in this image?",
      sessionId: sessionId || undefined,
    });
  };

  const handleProcessAudio = () => {
    if (!selectedFile) return;

    audioMutation.mutate({
      file: selectedFile,
      task: 'transcribe',
      sessionId: sessionId || undefined,
    });
  };

  const handleMultimodalProcess = () => {
    if (!textInput.trim() && !selectedFile) return;

    const isImage = selectedFile?.type.startsWith('image/');
    const isAudio = selectedFile?.type.startsWith('audio/');

    multimodalMutation.mutate({
      text: textInput || undefined,
      imageFile: isImage && selectedFile ? selectedFile : undefined,
      audioFile: isAudio && selectedFile ? selectedFile : undefined,
      sessionId: sessionId || undefined,
    });
  };

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.000';
    return `$${(cost / 1000000).toFixed(6)}`; // Convert from micro-cents
  };

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'text':
        return <MessageCircle className="w-4 h-4" />;
      case 'image':
        return <Eye className="w-4 h-4" />;
      case 'audio':
        return <Volume2 className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-5/6 max-h-screen overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <Brain className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Multimodal Agent: {agent.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {agent.description}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {sessionId && (
                <Badge variant="secondary" className="text-xs">
                  Session: {sessionId.slice(-8)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearMemoryMutation.mutate()}
                disabled={clearMemoryMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Memory
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>

          {/* Capabilities */}
          {!capabilitiesLoading && capabilities && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b">
              <div className="flex items-center space-x-4 text-sm">
                <span className="font-medium">Capabilities:</span>
                {capabilities.text && (
                  <Badge variant="outline" className="text-green-600">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Text
                  </Badge>
                )}
                {capabilities.image && (
                  <Badge variant="outline" className="text-blue-600">
                    <Eye className="w-3 h-3 mr-1" />
                    Vision
                  </Badge>
                )}
                {capabilities.audio && (
                  <Badge variant="outline" className="text-purple-600">
                    <Volume2 className="w-3 h-3 mr-1" />
                    Audio
                  </Badge>
                )}
                {capabilities.functions && (
                  <Badge variant="outline" className="text-orange-600">
                    <Zap className="w-3 h-3 mr-1" />
                    Functions
                  </Badge>
                )}
                {capabilities.memory && (
                  <Badge variant="outline" className="text-indigo-600">
                    <Brain className="w-3 h-3 mr-1" />
                    Memory
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {/* Conversation Area */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-auto p-6 space-y-4">
                {conversationHistory.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      Ready for Multimodal Interaction
                    </h3>
                    <p>
                      Send text, upload images or audio files to start
                      conversing with the agent
                    </p>
                  </div>
                ) : (
                  conversationHistory.map((response, index) => (
                    <Card
                      key={index}
                      className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              Response #{index + 1}
                            </Badge>
                            <div className="flex space-x-1">
                              {response.modalities?.map((modality, i) => (
                                <div key={i} className="flex items-center">
                                  {getModalityIcon(modality)}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{response.processingTime}ms</span>
                            <span>{formatCost(response.cost)}</span>
                            {response.usage && (
                              <span>{response.usage.total_tokens} tokens</span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose dark:prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap font-sans">
                            {response.content}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="chat" className="flex items-center">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger value="image" disabled={!capabilities?.image}>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="audio" disabled={!capabilities?.audio}>
                      <Mic className="w-4 h-4 mr-2" />
                      Audio
                    </TabsTrigger>
                    <TabsTrigger value="multimodal">
                      <Brain className="w-4 h-4 mr-2" />
                      Combined
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chat" className="space-y-4">
                    <div className="flex space-x-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                        rows={3}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!textInput.trim() || chatMutation.isPending}
                        size="lg"
                      >
                        {chatMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="space-y-4">
                    <div className="flex space-x-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          ref={fileInputRef}
                        />
                        <Textarea
                          placeholder="What would you like me to analyze about this image?"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleProcessImage}
                        disabled={!selectedFile || imageMutation.isPending}
                        size="lg"
                      >
                        {imageMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {selectedFile && selectedFile.type.startsWith('image/') && (
                      <div className="text-sm text-gray-600">
                        Selected: {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audio" className="space-y-4">
                    <div className="flex space-x-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={handleFileSelect}
                          ref={fileInputRef}
                        />
                      </div>
                      <Button
                        onClick={handleProcessAudio}
                        disabled={!selectedFile || audioMutation.isPending}
                        size="lg"
                      >
                        {audioMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {selectedFile && selectedFile.type.startsWith('audio/') && (
                      <div className="text-sm text-gray-600">
                        Selected: {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="multimodal" className="space-y-4">
                    <div className="flex space-x-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*,audio/*"
                          onChange={handleFileSelect}
                          ref={fileInputRef}
                        />
                        <Textarea
                          placeholder="Describe what you want me to analyze..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={handleMultimodalProcess}
                        disabled={
                          (!textInput.trim() && !selectedFile) ||
                          multimodalMutation.isPending
                        }
                        size="lg"
                      >
                        {multimodalMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {selectedFile && (
                      <div className="text-sm text-gray-600">
                        Selected: {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
