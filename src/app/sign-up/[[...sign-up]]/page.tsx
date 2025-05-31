import { SignUp } from "@clerk/nextjs";

export default function SignUpPage({
  searchParams
}: {
  searchParams: { redirect_url?: string }
}) {
  const redirectUrl = searchParams.redirect_url || "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp afterSignUpUrl={redirectUrl} />
    </div>
  );
}