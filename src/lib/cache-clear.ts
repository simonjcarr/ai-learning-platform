/**
 * Utility to clear all subscription-related cache
 * Call this when subscription status changes
 */
export function clearSubscriptionCache() {
  if (typeof window !== 'undefined') {
    // Clear sessionStorage
    sessionStorage.removeItem('userSubscription');
    
    // Clear any localStorage if used
    localStorage.removeItem('userSubscription');
    localStorage.removeItem('subscription');
    
    // Clear any Clerk session cache related to user
    const clerkKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('clerk') || key.includes('subscription') || key.includes('tier')
    );
    clerkKeys.forEach(key => sessionStorage.removeItem(key));
    
    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.includes('clerk') || key.includes('subscription') || key.includes('tier')
    );
    localStorageKeys.forEach(key => localStorage.removeItem(key));
    
    console.log('🧹 Cleared all subscription cache');
  }
}