import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { RepositoryChatUI } from '@/features/chat/components/repository-chat-ui';
import { IndexPrompt } from '@/features/chat/components/index-prompt';

export const metadata = {
  title: 'Repository Chat | CodeSentinel',
};

export default async function RepositoryChatPage(props: { params: Promise<{ repoId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { repoId } = params;

  const repo = await db.repository.findUnique({
    where: {
      id: repoId,
      user_id: session.user.id,
    }
  });

  if (!repo) {
    redirect('/dashboard');
  }

  return repo.is_indexed ? (
    <RepositoryChatUI key={repo.id} repoId={repo.id} />
  ) : (
    <IndexPrompt key={repo.id} repoId={repo.id} />
  );
}
