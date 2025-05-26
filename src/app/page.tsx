import Link from "next/link";
import { BookOpen, Search, Zap, Users, Shield, Cpu } from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: Zap,
      title: "AI-Powered Content",
      description: "Dynamic content generation using cutting-edge AI technology"
    },
    {
      icon: BookOpen,
      title: "Interactive Learning",
      description: "Test your knowledge with AI-generated interactive examples"
    },
    {
      icon: Search,
      title: "Smart Search",
      description: "AI-enhanced search that learns and grows with every query"
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Content evolves based on community needs and searches"
    }
  ];

  const popularCategories = [
    { name: "Cloud Computing", icon: Shield },
    { name: "DevOps", icon: Cpu },
    { name: "Cybersecurity", icon: Shield },
    { name: "Programming", icon: Cpu },
  ];

  return (
    <div className="py-12">
      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          Master IT Skills with AI-Powered Learning
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          An intelligent learning platform that generates personalized IT tutorials, 
          articles, and interactive examples tailored to your learning journey.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/search"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Learning
          </Link>
          <Link
            href="/categories"
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Browse Categories
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Why Choose Our Platform?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Popular Categories */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Popular Categories
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Link
                key={index}
                href={`/categories?filter=${encodeURIComponent(category.name)}`}
                className="flex items-center p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <Icon className="w-8 h-8 text-blue-600 mr-4" />
                <span className="text-lg font-medium text-gray-900">
                  {category.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mt-20 bg-blue-600 py-16">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Accelerate Your IT Career?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of IT professionals learning with AI-powered content
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
