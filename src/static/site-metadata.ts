interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'zhubao315的徒步与山野',
  siteUrl: 'https://zhubao315.github.io/hiking/',
  logo: 'https://avatars.githubusercontent.com/u/1206487?v=4',
  description: 'zhubao315的徒步与山野 · 3D 地形记录',
  navLinks: [
    {
      name: 'X',
      url: 'https://x.com/zhubao315',
    },
  ],
};

export default data
