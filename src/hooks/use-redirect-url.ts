"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function useRedirectUrl() {
  const pathname = usePathname();
  const [currentUrl, setCurrentUrl] = useState(pathname);
  
  useEffect(() => {
    // On client-side, get the full URL with search params
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.pathname + window.location.search);
    }
  }, [pathname]);
  
  const signInWithRedirect = `/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`;
  
  return {
    currentUrl,
    signInWithRedirect
  };
}