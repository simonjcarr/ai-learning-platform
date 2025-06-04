import { prisma } from './prisma';

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string;
  viewCount?: string;
  url: string;
}

export interface YouTubeSearchOptions {
  query: string;
  maxResults?: number;
  searchFilters?: {
    duration?: 'short' | 'medium' | 'long';
    categoryId?: string;
    channelId?: string;
    publishedAfter?: string;
    publishedBefore?: string;
    relevanceLanguage?: string;
    regionCode?: string;
    safeSearch?: 'none' | 'moderate' | 'strict';
    videoDefinition?: 'any' | 'high' | 'standard';
    videoDuration?: 'any' | 'short' | 'medium' | 'long';
    videoLicense?: 'any' | 'creativeCommon' | 'youtube';
  };
}

export class YouTubeSearchService {
  private apiKey: string;
  private maxResults: number;
  private quotaLimit: number;
  private quotaUsed: number;
  private modelId: string;

  constructor(
    apiKey: string,
    maxResults: number = 5,
    quotaLimit: number = 10000,
    quotaUsed: number = 0,
    modelId: string
  ) {
    this.apiKey = apiKey;
    this.maxResults = maxResults;
    this.quotaLimit = quotaLimit;
    this.quotaUsed = quotaUsed;
    this.modelId = modelId;
  }

  static async create(): Promise<YouTubeSearchService | null> {
    try {
      // Get the active YouTube API model
      const youtubeModel = await prisma.youTubeAPIModel.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!youtubeModel) {
        console.warn('No active YouTube API model found');
        return null;
      }

      return new YouTubeSearchService(
        youtubeModel.apiKey,
        youtubeModel.maxResults,
        youtubeModel.quotaLimit,
        youtubeModel.quotaUsed,
        youtubeModel.modelId
      );
    } catch (error) {
      console.error('Error creating YouTube search service:', error);
      return null;
    }
  }

  async searchVideos(options: YouTubeSearchOptions): Promise<YouTubeVideoResult[]> {
    // Check quota limits
    const estimatedCost = 100; // YouTube search API costs 100 quota units
    if (this.quotaUsed + estimatedCost > this.quotaLimit) {
      throw new Error('YouTube API quota limit exceeded');
    }

    try {
      const searchParams = new URLSearchParams({
        key: this.apiKey,
        part: 'snippet',
        type: 'video',
        q: options.query,
        maxResults: (options.maxResults || this.maxResults).toString(),
        order: 'relevance',
        videoEmbeddable: 'true', // Only embeddable videos
        videoSyndicated: 'true', // Only videos that can be played outside YouTube
      });

      // Add optional search filters
      if (options.searchFilters) {
        const { searchFilters } = options;
        
        if (searchFilters.channelId) {
          searchParams.append('channelId', searchFilters.channelId);
        }
        if (searchFilters.publishedAfter) {
          searchParams.append('publishedAfter', searchFilters.publishedAfter);
        }
        if (searchFilters.publishedBefore) {
          searchParams.append('publishedBefore', searchFilters.publishedBefore);
        }
        if (searchFilters.relevanceLanguage) {
          searchParams.append('relevanceLanguage', searchFilters.relevanceLanguage);
        }
        if (searchFilters.regionCode) {
          searchParams.append('regionCode', searchFilters.regionCode);
        }
        if (searchFilters.safeSearch) {
          searchParams.append('safeSearch', searchFilters.safeSearch);
        }
        if (searchFilters.videoDefinition) {
          searchParams.append('videoDefinition', searchFilters.videoDefinition);
        }
        if (searchFilters.videoDuration) {
          searchParams.append('videoDuration', searchFilters.videoDuration);
        }
        if (searchFilters.videoLicense) {
          searchParams.append('videoLicense', searchFilters.videoLicense);
        }
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`YouTube API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      // Update quota usage in database
      await this.updateQuotaUsage(estimatedCost);

      // Transform the response to our format
      const videos: YouTubeVideoResult[] = data.items?.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      })) || [];

      return videos;
    } catch (error) {
      console.error('YouTube search error:', error);
      throw error;
    }
  }

  async searchEducationalVideos(topic: string, context?: string): Promise<YouTubeVideoResult[]> {
    // Enhance the search query for educational content
    let enhancedQuery = topic;
    
    if (context) {
      enhancedQuery = `${topic} tutorial explanation guide`;
    } else {
      enhancedQuery = `${topic} tutorial`;
    }

    return this.searchVideos({
      query: enhancedQuery,
      searchFilters: {
        safeSearch: 'strict',
        videoDuration: 'medium', // Prefer videos between 4-20 minutes
        videoLicense: 'any',
        relevanceLanguage: 'en',
      },
    });
  }

  private async updateQuotaUsage(cost: number): Promise<void> {
    try {
      const newQuotaUsed = this.quotaUsed + cost;
      
      await prisma.youTubeAPIModel.update({
        where: { modelId: this.modelId },
        data: { 
          quotaUsed: newQuotaUsed,
          // Reset quota if it's a new day (simplified version)
          quotaResetAt: this.shouldResetQuota() ? new Date() : undefined,
        },
      });

      this.quotaUsed = newQuotaUsed;
    } catch (error) {
      console.error('Error updating YouTube API quota usage:', error);
    }
  }

  private shouldResetQuota(): boolean {
    // Simple daily reset logic - in production, you might want more sophisticated logic
    const now = new Date();
    const today = now.toDateString();
    const lastReset = new Date(this.quotaUsed).toDateString();
    
    return today !== lastReset;
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoResult | null> {
    try {
      const searchParams = new URLSearchParams({
        key: this.apiKey,
        part: 'snippet,contentDetails,statistics',
        id: videoId,
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${searchParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      const item = data.items?.[0];

      if (!item) {
        return null;
      }

      // Update quota usage (video details costs 1 quota unit)
      await this.updateQuotaUsage(1);

      return {
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails?.duration,
        viewCount: item.statistics?.viewCount,
        url: `https://www.youtube.com/watch?v=${item.id}`,
      };
    } catch (error) {
      console.error('Error fetching video details:', error);
      return null;
    }
  }

  formatVideoForMarkdown(video: YouTubeVideoResult, context?: string): string {
    const contextText = context ? `\n\n*${context}*` : '';
    return `
### 📺 ${video.title}

![${video.title}](${video.videoId})

**Channel:** ${video.channelTitle}  
**Published:** ${new Date(video.publishedAt).toLocaleDateString()}${contextText}

${video.description.length > 200 ? video.description.substring(0, 200) + '...' : video.description}

[Watch on YouTube](${video.url})
`.trim();
  }
}

export default YouTubeSearchService;