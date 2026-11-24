export type CinemaFilm = {
  id: string;
  title: string;
  englishTitle?: string;
  genre: string;
  runtime: string;
  score?: string;
  poster: string;
  showtimes: string[];
};

// Film titles, scores, runtimes, genres, showtimes, and poster artwork are from
// Paribu Cineverse ANKAmall's listing for 26 November 2026.
export const cinemaFilms: CinemaFilm[] = [
  { id: 'aclik-oyunlari-hasatta-gundogumu', title: 'Açlık Oyunları: Hasatta Gündoğumu', englishTitle: 'The Hunger Games: Sunrise on the Reaping', genre: 'Macera', runtime: '2 sa 38 dk', score: '83', poster: 'aclik-oyunlari-hasatta-gundogumu.webp', showtimes: ['11:00', '12:00', '14:20', '15:20', '17:40', '18:40', '21:00', '22:00'] },
  { id: 'ben-rocky', title: 'Ben, Rocky', englishTitle: 'I Play Rocky', genre: 'Biyografi', runtime: '2 sa 8 dk', score: '91', poster: 'ben-rocky.webp', showtimes: ['13:10', '18:55'] },
  { id: 'ask-tesadufleri-sever-3', title: 'Aşk Tesadüfleri Sever 3', genre: 'Romantik', runtime: '2 sa 3 dk', score: '78', poster: 'ask-tesadufleri-sever-3.webp', showtimes: ['11:00', '13:45', '16:30', '19:15', '22:00'] },
  { id: 'hayalet-asker', title: 'Hayalet Asker', englishTitle: 'Ghost Soldier', genre: 'Aksiyon', runtime: '1 sa 30 dk', poster: 'hayalet-asker.webp', showtimes: ['12:05', '14:15', '16:25', '18:35', '20:45'] },
  { id: 'ebenezer-bir-noel-sarkisi', title: 'Ebenezer: Bir Noel Şarkısı', englishTitle: 'Ebenezer: A Christmas Carol', genre: 'Fantastik', runtime: '1 sa 57 dk', score: '77', poster: 'ebenezer-bir-noel-sarkisi.webp', showtimes: ['19:20', '22:00'] },
  { id: 'godzilla-minus-zero', title: 'Godzilla Minus Zero', genre: 'Aksiyon', runtime: '2 sa 15 dk', score: '69', poster: 'godzilla-minus-zero.webp', showtimes: ['16:00', '21:45'] },
  { id: '622-evrenin-merkezine-yolculuk', title: '6.2.2. Evrenin Merkezine Yolculuk', genre: 'Animasyon', runtime: '1 sa 15 dk', score: '77', poster: '622-evrenin-merkezine-yolculuk.webp', showtimes: ['11:15'] },
  { id: 'av-mahsun-ben-sana-inaniyorum', title: 'Av. Mahsun: Ben Sana İnanıyorum', genre: 'Komedi', runtime: '1 sa 44 dk', score: '63', poster: 'av-mahsun-ben-sana-inaniyorum.webp', showtimes: ['12:10', '14:35', '17:00', '19:25', '21:50'] },
  { id: 'piril-kayip-anahtarin-gizemi', title: 'Pırıl: Kayıp Anahtarın Gizemi', genre: 'Animasyon', runtime: '1 sa 21 dk', score: '52', poster: 'piril-kayip-anahtarin-gizemi.webp', showtimes: ['11:00', '13:05', '15:10', '17:15'] },
  { id: 'cakallarla-dans-8', title: 'Çakallarla Dans 8: Şututgart Çıkarması', genre: 'Komedi', runtime: '1 sa 47 dk', score: '47', poster: 'cakallarla-dans-8.webp', showtimes: ['11:00', '13:30', '16:00', '18:30', '21:00'] },
  { id: 'her-sey-ortada', title: 'Her Şey Ortada', englishTitle: 'You Can See Everything', genre: 'Belgesel', runtime: '2 sa 54 dk', score: '64', poster: 'her-sey-ortada.webp', showtimes: ['11:20', '17:25'] },
  { id: 'clayface', title: 'Clayface', genre: 'Korku', runtime: '1 sa 50 dk', score: '81', poster: 'clayface.webp', showtimes: ['14:55', '21:00'] },
  { id: 'gupi-ve-gulmeyen-kral', title: 'Gupi ve Gülmeyen Kral', genre: 'Animasyon', runtime: '1 sa 21 dk', score: '73', poster: 'gupi-ve-gulmeyen-kral.webp', showtimes: ['10:50', '12:55', '15:00', '17:05'] },
  { id: 'resident-evil', title: 'Resident Evil', genre: 'Korku', runtime: '1 sa 30 dk', score: '69', poster: 'resident-evil.webp', showtimes: ['19:10'] },
  { id: 'the-odyssey', title: 'The Odyssey', genre: 'Aksiyon', runtime: '2 sa 52 dk', score: '86', poster: 'the-odyssey.webp', showtimes: ['21:20'] },
];
