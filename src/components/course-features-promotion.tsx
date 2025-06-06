"use client";

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Trophy,
  Users,
  CheckCircle,
  Star,
  Briefcase,
  TrendingUp,
  Shield,
  Award,
  Clock,
  Target,
  Brain,
  Code,
  MessageSquare,
  FileText
} from 'lucide-react';

interface CourseFeaturesPromotionProps {
  trigger?: React.ReactNode;
}

function PromotionContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const isUserSignedIn = isLoaded && isSignedIn;

  const features = [
    {
      icon: BookOpen,
      title: "Comprehensive Learning Paths",
      description: "Structured courses that take you from beginner to expert with hands-on projects and real-world scenarios."
    },
    {
      icon: Code,
      title: "Interactive Labs & Exercises",
      description: "Practice what you learn with our integrated coding environment and interactive examples."
    },
    {
      icon: Brain,
      title: "AI-Powered Learning",
      description: "Get personalized explanations, instant feedback, and adaptive content that matches your learning style."
    },
    {
      icon: Trophy,
      title: "Industry-Recognized Certificates",
      description: "Earn certificates that demonstrate real engagement and mastery, not just exam completion."
    },
    {
      icon: MessageSquare,
      title: "Expert Support & Chat",
      description: "Get help when you need it with our AI-powered assistant and community support."
    },
    {
      icon: Target,
      title: "Progress Tracking",
      description: "Monitor your learning journey with detailed analytics and milestone achievements."
    }
  ];

  const benefits = [
    {
      icon: Briefcase,
      title: "Advance Your Career",
      description: "Build the skills employers are actively seeking in today's competitive job market"
    },
    {
      icon: TrendingUp,
      title: "Increase Your Value",
      description: "Develop expertise that makes you a more valuable asset to your organization"
    },
    {
      icon: Shield,
      title: "Credible Learning",
      description: "Earn certificates that demonstrate genuine skill mastery and hands-on experience"
    }
  ];

  const certificateFeatures = [
    "Requires completion of all course modules",
    "Hands-on project demonstrations",
    "Interactive quiz mastery (not just final exam)",
    "Progress tracking and engagement verification",
    "Skills validation through practical exercises",
    "Verifiable completion tracking"
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="mb-6">
          <GraduationCap className="h-16 w-16 text-orange-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {isUserSignedIn ? 'Unlock Your Learning Potential' : 'Transform Your Career with Expert-Led Courses'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {isUserSignedIn 
              ? 'Upgrade to access our comprehensive course library and accelerate your professional growth with industry-recognized certifications.'
              : 'Join professionals who are advancing their careers through our hands-on learning platform. Start building the skills employers demand.'
            }
          </p>
        </div>

        {/* Social Proof */}
        <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 mb-8">
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            <span>Growing Community</span>
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 mr-2 text-yellow-500" />
            <span>High Quality Content</span>
          </div>
          <div className="flex items-center">
            <Award className="h-4 w-4 mr-2" />
            <span>Skills-Focused Learning</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/pricing">
            <Button 
              size="lg" 
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-lg"
            >
              {isUserSignedIn ? 'Upgrade Now' : 'View Pricing Plans'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Course Features Grid */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything You Need to Master New Skills
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <feature.icon className="h-12 w-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Career Benefits Section */}
      <div className="mb-16 bg-gray-50 rounded-2xl p-8 md:p-12">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Why Professionals Choose Our Platform
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center">
              <div className="bg-orange-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <benefit.icon className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {benefit.title}
              </h3>
              <p className="text-gray-600">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Certificate Value Proposition */}
      <div className="mb-16">
        <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 md:p-12 text-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Certificates That Actually Mean Something
              </h2>
              <p className="text-lg mb-6 text-orange-100">
                Unlike other platforms that hand out certificates for just taking a final exam, our certificates prove you've mastered the material through genuine engagement and hands-on practice.
              </p>
              <div className="bg-white/10 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-lg mb-3 flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Employer-Trusted Verification
                </h3>
                <p className="text-orange-100">
                  Our certificates include detailed engagement metrics and skill demonstrations that employers can verify, making them valuable assets in job applications and performance reviews.
                </p>
              </div>
            </div>
            <div>
              <Card className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                  What Makes Our Certificates Special
                </h3>
                <ul className="space-y-3">
                  {certificateFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-700">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Journey */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Your Learning Journey
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: 1, title: "Choose Your Path", description: "Select from our comprehensive course library", icon: Target },
            { step: 2, title: "Learn by Doing", description: "Practice with hands-on labs and real projects", icon: Code },
            { step: 3, title: "Get Certified", description: "Demonstrate your skills with engaging assessments", icon: Award },
            { step: 4, title: "Advance Your Career", description: "Use your new skills to unlock opportunities", icon: TrendingUp }
          ].map((step, index) => (
            <div key={index} className="text-center">
              <div className="bg-orange-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                {step.step}
              </div>
              <step.icon className="h-8 w-8 text-orange-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="text-center bg-gray-50 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Start Your Journey?
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          {isUserSignedIn 
            ? 'Upgrade your account now and get instant access to all courses, interactive labs, and career-boosting certificates.'
            : 'Join professionals who are transforming their careers with our comprehensive learning platform.'
          }
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/pricing">
            <Button 
              size="lg" 
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-lg"
            >
              {isUserSignedIn ? 'Upgrade Now' : 'View All Plans'}
            </Button>
          </Link>
        </div>
        {!isUserSignedIn && (
          <p className="text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-orange-600 hover:text-orange-700 font-medium">
              Sign in here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function CourseFeaturesPromotion({ trigger }: CourseFeaturesPromotionProps = {}) {
  if (trigger) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <PromotionContent />
        </DialogContent>
      </Dialog>
    );
  }
  
  return <PromotionContent />;
}