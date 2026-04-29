export const wikimediaTopReadArticles = [
  { article: "Main_Page", views: 5000, rank: 1 },
  { article: "Special:Search", views: 4500, rank: 2 },
  { article: "ChatGPT", views: 3000, rank: 3 },
  { article: "Pope_Francis", views: 2500, rank: 4 },
  { article: "A_Minecraft_Movie", views: 2000, rank: 5 },
  { article: "Donald_Trump", views: 1800, rank: 6 },
  { article: "The_Last_of_Us_(TV_series)", views: 1600, rank: 7 },
  { article: "Taylor_Swift", views: 1200000, rank: 8 },
];

export const wikimediaPerArticleViews: Record<string, number[]> = {
  ChatGPT: [1000, 2000],
  Pope_Francis: [1400, 1600],
  A_Minecraft_Movie: [1300, 1700],
  Donald_Trump: [900, 1100],
  "The_Last_of_Us_(TV_series)": [1200, 1800],
  Taylor_Swift: [1100, 1900],
};
