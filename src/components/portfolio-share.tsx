'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShareIcon, CopyIcon, CheckIcon } from 'lucide-react';

interface PortfolioShareProps {
  portfolioUrl: string;
  displayName: string;
}

export default function PortfolioShare({ portfolioUrl, displayName }: PortfolioShareProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(portfolioUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Portfolio`,
          text: `Check out ${displayName}'s professional portfolio`,
          url: portfolioUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={shareNative}
        className="flex items-center gap-2"
      >
        <ShareIcon className="w-4 h-4" />
        Share Portfolio
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={copyToClipboard}
        className="flex items-center gap-2"
      >
        {copied ? (
          <>
            <CheckIcon className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <CopyIcon className="w-4 h-4" />
            Copy Link
          </>
        )}
      </Button>
    </div>
  );
}