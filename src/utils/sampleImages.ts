export interface SamplePhoto {
  name: string;
  url: string;
  title: string;
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    name: 'alps_mountain_sunrise.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80',
    title: 'Alpine Vista • 2026',
  },
  {
    name: 'minimalist_architecture.jpg',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80',
    title: 'Geometric Concrete • Gallery Series',
  },
  {
    name: 'tokyo_neon_dusk.jpg',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80',
    title: 'Tokyo Rain • Archival Print',
  },
];
