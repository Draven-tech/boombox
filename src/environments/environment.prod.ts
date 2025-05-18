export interface Environment {
  production: boolean;
  rapidApiKey: string;
  rapidApiHost: string;
  deezerApiUrl: string;
}

export const environment: Environment = {
  production: false,
  rapidApiKey: '227380bc43mshb5f177d2019e0efp1aa515jsnd8cb7630dbd3',
  rapidApiHost: 'deezerdevs-deezer.p.rapidapi.com',
  deezerApiUrl: 'https://deezerdevs-deezer.p.rapidapi.com'
};
