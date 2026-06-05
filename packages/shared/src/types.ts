// ============================================================
// API Response types
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// Source types
// ============================================================
export interface SourceInfo {
  id: string;
  type: 'wechat' | 'twitter' | 'podcast' | 'video';
  name: string;
  identifier: string;
  avatarUrl?: string;
  description?: string;
  isActive: boolean;
  lastSyncAt?: string;
  articleCount?: number;
  createdAt: string;
}

// ============================================================
// Article types
// ============================================================
export interface ArticleInfo {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType?: string;
  title: string;
  author?: string;
  summary?: string;
  contentText?: string;
  contentHtml?: string;
  originalUrl?: string;
  coverImageUrl?: string;
  readCount?: number;
  likeCount?: number;
  commentCount?: number;
  isRead: boolean;
  isStarred: boolean;
  publishedAt?: string;
  createdAt: string;
}

// ============================================================
// AI types
// ============================================================
export interface AIResultInfo {
  id: string;
  articleId: string;
  skillType: 'summary' | 'qa' | 'mindmap';
  modelUsed: string;
  prompt?: string;
  result: string;
  createdAt: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

// ============================================================
// WeChat specific types (极致了 API)
// ============================================================
export interface WechatAccountSearchResult {
  name: string;
  biz: string;
  avatar?: string;
  description?: string;
  fans?: number;
  avgTopRead?: number;
}

export interface WechatArticle {
  title: string;
  url: string;
  ctime: string; // publish time
  cover?: string;
  author?: string;
  digest?: string; // short summary
}

export interface TwitterUserSearchResult {
  name: string;
  userName: string;
  id: string;
  avatar?: string;
  description?: string;
  followers?: number;
}

export interface DajialaBalanceInfo {
  code: number;
  remain_money: number;
  yesterday_money: number;
  request_time: string;
}


