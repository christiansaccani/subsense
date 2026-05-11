import netflix from './lib/images/netflix.png';
import youtube from './lib/images/youtube.png';
import spotify from './lib/images/spotify.png';
import prime from './lib/images/prime.png';
import disneyPlus from './lib/images/disney+.png';
import chatgpt from './lib/images/chatgpt.png';
import icloud from './lib/images/icloud.png';
import dazn from './lib/images/dazn.jpeg';

export const LOGO_MAPPING: Record<string, string> = {
  'netflix': netflix,
  'spotify': spotify,
  'amazon prime': prime,
  'amazon': prime,
  'prime video': prime,
  'disney+': disneyPlus,
  'disney plus': disneyPlus,
  'youtube': youtube,
  'dazn': dazn,
  'icloud': icloud,
  'icloud+': icloud,
  'chatgpt': chatgpt,
  'openai': chatgpt,
};

export const getServiceLogo = (name: string): string | null => {
  const lowerName = name.toLowerCase();
  
  // Direct match
  if (LOGO_MAPPING[lowerName]) return LOGO_MAPPING[lowerName];
  
  // Partial match
  for (const [key, url] of Object.entries(LOGO_MAPPING)) {
    if (lowerName.includes(key)) return url;
  }
  
  return null;
};
