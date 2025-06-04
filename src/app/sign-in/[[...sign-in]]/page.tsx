import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url || "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn afterSignInUrl={redirectUrl} />
    </div>
  );
}