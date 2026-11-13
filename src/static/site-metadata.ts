interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  tagline?: string;
  accent?: string;
  accent2?: string;
  sportLabel?: string;
  repoUrl?: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'zhubao315 的徒步与山野',
  siteUrl: 'https://zhubao315.github.io/hiking/',
  logo: 'https://avatars.githubusercontent.com/u/1206487?v=4',
  description: 'zhubao315 的徒步与山野 · 3D 地形记录',
  tagline: '去山里，把呼吸和海拔一起记录下来。',
  accent: '#34D399',
  accent2: '#10B981',
  sportLabel: '徒步',
  repoUrl: 'https://github.com/zhubao315/hiking',
  navLinks: [
    {
      name: 'running',
      url: 'https://zhubao315.github.io/running/',
    },
    {
      name: 'cycling',
      url: 'https://zhubao315.github.io/cycling/',
    },
    {
      name: 'hiking',
      url: 'https://zhubao315.github.io/hiking/',
    },
    {
      name: 'health',
      url: 'https://zhubao315.github.io/health/',
    },    {
      name: 'X',
      url: 'https://x.com/zhubao315',
    },
  ],
};

export default data
