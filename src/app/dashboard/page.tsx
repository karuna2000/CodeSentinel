import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';
import EmptyChatView from '@/features/dashboard/components/empty-chat-view';

export const metadata = {
  title: 'Chat | CodeSentinel',
  description: 'Chat with your codebase, explore architecture, and generate documentation.',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  const installUrl = `https://github.com/apps/${env.githubAppName}/installations/new`;

  return (
    <EmptyChatView
      username={session.user.name || session.user.email || undefined}
      installUrl={installUrl}
    />
  );
}