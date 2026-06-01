import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ChatView from "./chat-view";

export default async function DashboardPage() {
  
  
  
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  return <ChatView />;
}
