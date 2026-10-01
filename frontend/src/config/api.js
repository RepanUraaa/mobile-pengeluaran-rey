const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = (configuredApiUrl || 'http://192.168.100.16:3001').replace(/\/$/, '');
