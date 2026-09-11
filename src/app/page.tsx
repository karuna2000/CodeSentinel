import { redirect } from 'next/navigation';

// The paste-and-review flow was removed; the app is now repo-intelligence only.
// Middleware already enforces auth, so this simply routes authed users to the browser.
export default function HomePage() {
  redirect('/dashboard/repos');
}