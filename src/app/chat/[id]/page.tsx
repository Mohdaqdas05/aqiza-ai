import { ChatWorkspace } from "@/components/ChatWorkspace";

type PageProps = { params: Promise<{ id: string }> };

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;
  return <ChatWorkspace initialConversationId={id} />;
}
