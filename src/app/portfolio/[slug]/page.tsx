import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, MapPinIcon, LinkIcon, BriefcaseIcon, ClockIcon, ShareIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import PortfolioShare from '@/components/portfolio-share';

interface PageProps {
  params: {
    slug: string;
  };
}

interface Portfolio {
  portfolioId: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  isAvailableForWork: boolean;
  jobTypes: string[];
  skills: string[];
  preferredJobTitles: string[];
  salaryRange: string | null;
  availabilityDate: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    username: string | null;
  };
  certificates: Array<{
    portfolioCertId: string;
    displayOrder: number;
    addedAt: string;
    certificate: {
      certificateId: string;
      issuedAt: string;
      grade: 'BRONZE' | 'SILVER' | 'GOLD' | null;
      finalScore: number | null;
      engagementScore: number | null;
      certificateData: any;
      course: {
        title: string;
        level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        description: string;
      };
    };
  }>;
}

async function getPortfolio(slug: string): Promise<Portfolio | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/portfolio/${slug}`, {
      cache: 'revalidate',
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return null;
  }
}

function getGradeColor(grade: 'BRONZE' | 'SILVER' | 'GOLD' | null) {
  switch (grade) {
    case 'GOLD':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'SILVER':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'BRONZE':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300';
  }
}

function getLevelColor(level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED') {
  switch (level) {
    case 'BEGINNER':
      return 'bg-green-100 text-green-800';
    case 'INTERMEDIATE':
      return 'bg-yellow-100 text-yellow-800';
    case 'ADVANCED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const portfolio = await getPortfolio(params.slug);

  if (!portfolio) {
    return {
      title: 'Portfolio Not Found',
      description: 'The requested portfolio could not be found.',
    };
  }

  const displayName = portfolio.displayName || 
    `${portfolio.user.firstName || ''} ${portfolio.user.lastName || ''}`.trim() || 
    portfolio.user.username || 
    'Portfolio';

  const description = portfolio.bio || 
    `${displayName}'s professional portfolio showcasing ${portfolio.certificates.length} certificates and skills in technology.`;

  return {
    title: `${displayName} - Portfolio`,
    description,
    keywords: [
      ...portfolio.skills,
      ...portfolio.preferredJobTitles,
      'portfolio',
      'certificates',
      'technology',
      'professional'
    ].join(', '),
    openGraph: {
      title: `${displayName} - Portfolio`,
      description,
      type: 'profile',
      images: portfolio.user.imageUrl ? [portfolio.user.imageUrl] : [],
    },
    twitter: {
      card: 'summary',
      title: `${displayName} - Portfolio`,
      description,
      images: portfolio.user.imageUrl ? [portfolio.user.imageUrl] : [],
    },
    robots: {
      index: portfolio.isPublic,
      follow: portfolio.isPublic,
    },
  };
}

export default async function PortfolioPage({ params }: PageProps) {
  const portfolio = await getPortfolio(params.slug);

  if (!portfolio) {
    notFound();
  }

  const displayName = portfolio.displayName || 
    `${portfolio.user.firstName || ''} ${portfolio.user.lastName || ''}`.trim() || 
    portfolio.user.username || 
    'Anonymous';

  const profileImage = portfolio.user.imageUrl || '/placeholder-avatar.png';
  const portfolioUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/portfolio/${portfolio.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="relative w-24 h-24 md:w-32 md:h-32">
              <Image
                src={profileImage}
                alt={displayName}
                fill
                className="rounded-full object-cover"
              />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
                {portfolio.isAvailableForWork && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <BriefcaseIcon className="w-3 h-3 mr-1" />
                    Available for Work
                  </Badge>
                )}
              </div>
              
              {portfolio.location && (
                <p className="text-gray-600 flex items-center gap-1 mb-2">
                  <MapPinIcon className="w-4 h-4" />
                  {portfolio.location}
                </p>
              )}
              
              {portfolio.bio && (
                <p className="text-gray-700 max-w-2xl">{portfolio.bio}</p>
              )}
              
              {/* External Links */}
              <div className="flex flex-wrap gap-4 mt-4">
                {portfolio.website && (
                  <Link 
                    href={portfolio.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Website
                  </Link>
                )}
                {portfolio.linkedinUrl && (
                  <Link 
                    href={portfolio.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <LinkIcon className="w-4 h-4" />
                    LinkedIn
                  </Link>
                )}
                {portfolio.githubUrl && (
                  <Link 
                    href={portfolio.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <LinkIcon className="w-4 h-4" />
                    GitHub
                  </Link>
                )}
              </div>
              
              {/* Share Portfolio */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <PortfolioShare 
                  portfolioUrl={portfolioUrl}
                  displayName={displayName}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Certificates Section */}
            {portfolio.certificates.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Certificates</h2>
                <div className="grid gap-6">
                  {portfolio.certificates.map(({ certificate, portfolioCertId }) => (
                    <Card key={portfolioCertId} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-xl text-gray-900">
                              {certificate.course.title}
                            </CardTitle>
                            <p className="text-gray-600 mt-1">{certificate.course.description}</p>
                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-4 h-4" />
                                Completed {new Date(certificate.issuedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {certificate.grade && (
                              <Badge 
                                variant="outline" 
                                className={getGradeColor(certificate.grade)}
                              >
                                {certificate.grade}
                              </Badge>
                            )}
                            <Badge variant="secondary" className={getLevelColor(certificate.course.level)}>
                              {certificate.course.level}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      {(certificate.finalScore || certificate.engagementScore) && (
                        <CardContent>
                          <div className="flex gap-6 text-sm">
                            {certificate.finalScore && (
                              <div>
                                <span className="text-gray-600">Final Score:</span>
                                <span className="ml-1 font-semibold text-gray-900">
                                  {Math.round(certificate.finalScore)}%
                                </span>
                              </div>
                            )}
                            {certificate.engagementScore && (
                              <div>
                                <span className="text-gray-600">Engagement:</span>
                                <span className="ml-1 font-semibold text-gray-900">
                                  {Math.round(certificate.engagementScore)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Skills */}
            {portfolio.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {portfolio.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Preferences */}
            {portfolio.isAvailableForWork && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {portfolio.preferredJobTitles.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Preferred Roles</h4>
                      <div className="flex flex-wrap gap-2">
                        {portfolio.preferredJobTitles.map((title, index) => (
                          <Badge key={index} variant="outline">
                            {title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {portfolio.jobTypes.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Job Types</h4>
                      <div className="flex flex-wrap gap-2">
                        {portfolio.jobTypes.map((type, index) => (
                          <Badge key={index} variant="outline">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {portfolio.salaryRange && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Salary Range</h4>
                      <p className="text-gray-600">{portfolio.salaryRange}</p>
                    </div>
                  )}

                  {portfolio.availabilityDate && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Available From</h4>
                      <p className="text-gray-600 flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {new Date(portfolio.availabilityDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}