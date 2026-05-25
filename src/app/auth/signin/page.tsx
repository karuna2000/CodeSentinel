import type { Metadata } from 'next';
import type { SearchParams } from '@/types/common.types';
import { SignInView } from './sign-in-view';

export const metadata: Metadata = {
  title: 'Sign In — AgentReview',
  description: 'Authenticate to access the AgentReview secure code analysis platform.',
};

interface SignInPageProps {
  searchParams: SearchParams;
}

/**
 * Server Component wrapper — reads error param from URL, renders Client View.
 * URL shape: /auth/signin?error=OAuthAccountNotLinked&callbackUrl=/
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const error = typeof params?.error === 'string' ? params.error : undefined;
  const callbackUrl = typeof params?.callbackUrl === 'string' ? params.callbackUrl : '/';

  return <SignInView error={error} callbackUrl={callbackUrl} />;
}
