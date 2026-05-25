import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ChatView from "./chat-view";

export default async function DashboardPage() {
  // Defense in depth: Check session at the Server Component level
  // This ensures that even if middleware fails or isn't loaded by the dev server yet,
  // unauthorized users physically cannot render this page.
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  return <ChatView />;
}
