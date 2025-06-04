"use client";

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface CourseArticleTrackerProps {
  courseId: string;
  articleId: string;
  onTrackingUpdate?: (data: { timeSpent: number; scrollPercentage: number }) => void;
}

export default function CourseArticleTracker({
  courseId,
  articleId,
  onTrackingUpdate
}: CourseArticleTrackerProps) {
  const { isSignedIn } = useUser();
  const [startTime] = useState(Date.now());
  const [maxScrollPercentage, setMaxScrollPercentage] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const lastUpdateRef = useRef(0);
  const hasEnrolledRef = useRef(false);

  // Track time spent
  useEffect(() => {
    if (!isSignedIn) return;

    const interval = setInterval(() => {
      const currentTime = Math.floor((Date.now() - startTime) / 1000);
      setTimeSpent(currentTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSignedIn, startTime]);

  // Track maximum scroll percentage reached
  useEffect(() => {
    if (!isSignedIn) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const totalScrollable = documentHeight - windowHeight;
      const currentScrollPercentage = totalScrollable > 0 
        ? Math.min(100, Math.max(0, (scrollTop / totalScrollable) * 100))
        : 0;
      
      const roundedPercentage = Math.round(currentScrollPercentage);
      
      // Only update if this is a new maximum
      setMaxScrollPercentage(prev => Math.max(prev, roundedPercentage));
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isSignedIn]);

  // Auto-enroll user in course if not already enrolled
  useEffect(() => {
    if (!isSignedIn || hasEnrolledRef.current) return;

    const autoEnroll = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          hasEnrolledRef.current = true;
          console.log('✅ Auto-enrolled in course');
        } else if (response.status === 400) {
          // User is already enrolled - this is fine, don't log as error
          hasEnrolledRef.current = true;
          // Silent success - no need to log this as it's expected
        } else {
          console.error('❌ Enrollment failed:', response.status);
        }
      } catch (error) {
        console.error('❌ Auto-enrollment error:', error);
      }
    };

    // Add a small delay to avoid rapid enrollment attempts
    const timeoutId = setTimeout(autoEnroll, 100);
    return () => clearTimeout(timeoutId);
  }, [isSignedIn, courseId]);

  // Send periodic updates to server
  useEffect(() => {
    if (!isSignedIn) return;

    const sendUpdate = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            timeSpent,
            scrollPercentage: maxScrollPercentage,
            isCompleted: maxScrollPercentage >= 50 && timeSpent >= 10, // Complete if 50% scrolled and 10+ seconds (temporary for testing)
          }),
        });

        if (response.ok) {
          lastUpdateRef.current = Date.now();
          const isCompleted = maxScrollPercentage >= 50 && timeSpent >= 10;
          console.log('✅ Progress updated:', { 
            timeSpent, 
            scrollPercentage: maxScrollPercentage, 
            isCompleted,
            willComplete: isCompleted ? 'YES' : 'NO'
          });
        } else {
          const errorData = await response.json();
          console.error('❌ Progress update failed:', response.status, errorData);
        }
      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    };

    // Send update every 30 seconds if there's been significant change
    const interval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
      const significantChange = timeSinceLastUpdate > 30000; // 30 seconds
      
      if (significantChange && (timeSpent > 0 || maxScrollPercentage > 0)) {
        sendUpdate();
      }
    }, 30000);

    // Send initial update after 5 seconds (reduced from 10)
    const initialTimeout = setTimeout(() => {
      if (timeSpent > 5 || maxScrollPercentage > 5) {
        sendUpdate();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
      
      // Send final update when component unmounts
      if (timeSpent > 0 || maxScrollPercentage > 0) {
        sendUpdate();
      }
    };
  }, [isSignedIn, courseId, articleId, timeSpent, maxScrollPercentage]);

  // Call callback when tracking data updates
  useEffect(() => {
    if (onTrackingUpdate) {
      onTrackingUpdate({ timeSpent, scrollPercentage: maxScrollPercentage });
    }
  }, [timeSpent, maxScrollPercentage, onTrackingUpdate]);

  // Send final update when user leaves the page
  useEffect(() => {
    if (!isSignedIn) return;

    const handleBeforeUnload = () => {
      if (timeSpent > 0 || maxScrollPercentage > 0) {
        // Use fetch for final update since sendBeacon has limitations with POST
        fetch(`/api/courses/${courseId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            timeSpent,
            scrollPercentage: maxScrollPercentage,
            isCompleted: maxScrollPercentage >= 50 && timeSpent >= 10, // Complete if 50% scrolled and 10+ seconds (temporary for testing)
          }),
          keepalive: true, // Ensures request continues even if page unloads
        }).catch(error => console.error('Failed final update:', error));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSignedIn, courseId, articleId, timeSpent, maxScrollPercentage]);

  // This component doesn't render anything visible
  return null;
}