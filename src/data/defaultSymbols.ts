import { SymbolItem } from '../types';

export const DEFAULT_SYMBOLS: SymbolItem[] = [
  // --- EMERGENCY (Darurat) ---
  { id: 'em-1', label: 'SAKIT', spokenText: 'Saya merasa sakit', category: 'emergency', iconName: 'AlertCircle', isEmergency: true },
  { id: 'em-2', label: 'TOLONG', spokenText: 'Tolong bantu saya', category: 'emergency', iconName: 'HelpCircle', isEmergency: true },
  { id: 'em-3', label: 'SELESAI', spokenText: 'Sudah selesai', category: 'emergency', iconName: 'CheckCircle2', isEmergency: true },
  { id: 'em-4', label: 'BISING', spokenText: 'Terlalu bising dan berisik', category: 'emergency', iconName: 'VolumeX', isEmergency: true },
  { id: 'em-5', label: 'BERHENTI', spokenText: 'Tolong berhenti', category: 'emergency', iconName: 'Hand', isEmergency: true },
  { id: 'em-6', label: 'MAU PULANG', spokenText: 'Saya ingin pulang', category: 'emergency', iconName: 'Home', isEmergency: true },

  // --- FEELINGS (Perasaan) ---
  { id: 'feel-1', label: 'Senang', spokenText: 'Saya merasa senang', category: 'feelings', iconName: 'Smile' },
  { id: 'feel-2', label: 'Sedih', spokenText: 'Saya merasa sedih', category: 'feelings', iconName: 'Frown' },
  { id: 'feel-3', label: 'Marah', spokenText: 'Saya merasa marah', category: 'feelings', iconName: 'Flame' },
  { id: 'feel-4', label: 'Lelah', spokenText: 'Saya merasa lelah', category: 'feelings', iconName: 'BatteryCharging' },
  { id: 'feel-5', label: 'Sakit', spokenText: 'Badan saya sakit', category: 'feelings', iconName: 'Thermometer' },
  { id: 'feel-6', label: 'Takut', spokenText: 'Saya merasa takut', category: 'feelings', iconName: 'ShieldAlert' },
  { id: 'feel-7', label: 'Bingung', spokenText: 'Saya merasa bingung', category: 'feelings', iconName: 'HelpCircle' },
  { id: 'feel-8', label: 'Tenang', spokenText: 'Saya merasa tenang', category: 'feelings', iconName: 'Sun' },

  // --- NEEDS (Kebutuhan / Toilet / Istirahat) ---
  { id: 'need-1', label: 'Toilet', spokenText: 'Saya ingin ke toilet', category: 'needs', iconName: 'Bath' },
  { id: 'need-2', label: 'Air', spokenText: 'Saya ingin minum air', category: 'needs', iconName: 'Droplet' },
  { id: 'need-3', label: 'Makan', spokenText: 'Saya ingin makan', category: 'needs', iconName: 'Utensils' },
  { id: 'need-4', label: 'Istirahat', spokenText: 'Saya ingin istirahat', category: 'needs', iconName: 'Bed' },
  { id: 'need-5', label: 'Sakit Perut', spokenText: 'Perut saya sakit', category: 'needs', iconName: 'Activity' },
  { id: 'need-6', label: 'Gerah / Panas', spokenText: 'Udara terlalu panas', category: 'needs', iconName: 'SunMedium' },
  { id: 'need-7', label: 'Dingin', spokenText: 'Saya merasa kedinginan', category: 'needs', iconName: 'Snowflake' },
  { id: 'need-8', label: 'Obat', spokenText: 'Saya butuh obat', category: 'needs', iconName: 'Pill' },

  // --- NOUNS (Benda / Makanan / Minuman) ---
  { id: 'noun-1', label: 'Nasi', spokenText: 'Nasi', category: 'nouns', iconName: 'Soup' },
  { id: 'noun-2', label: 'Air Putih', spokenText: 'Air putih', category: 'nouns', iconName: 'CupSoda' },
  { id: 'noun-3', label: 'Susu', spokenText: 'Susu', category: 'nouns', iconName: 'Milk' },
  { id: 'noun-4', label: 'Buah', spokenText: 'Buah', category: 'nouns', iconName: 'Apple' },
  { id: 'noun-5', label: 'Roti', spokenText: 'Roti', category: 'nouns', iconName: 'Sandwich' },
  { id: 'noun-6', label: 'Mainan', spokenText: 'Mainan', category: 'nouns', iconName: 'Puzzle' },
  { id: 'noun-7', label: 'Buku', spokenText: 'Buku bacaan', category: 'nouns', iconName: 'BookOpen' },
  { id: 'noun-8', label: 'HP / Tablet', spokenText: 'Gawai atau tablet', category: 'nouns', iconName: 'Tablet' },
  { id: 'noun-9', label: 'Baju', spokenText: 'Baju', category: 'nouns', iconName: 'Shirt' },
  { id: 'noun-10', label: 'Sepatu', spokenText: 'Sepatu', category: 'nouns', iconName: 'Footprints' },

  // --- VERBS (Kata Kerja) ---
  { id: 'verb-1', label: 'Mau', spokenText: 'Saya mau', category: 'verbs', iconName: 'PlusCircle' },
  { id: 'verb-2', label: 'Tidak Mau', spokenText: 'Saya tidak mau', category: 'verbs', iconName: 'XCircle' },
  { id: 'verb-3', label: 'Makan', spokenText: 'Saya mau makan', category: 'verbs', iconName: 'Utensils' },
  { id: 'verb-4', label: 'Minum', spokenText: 'Saya mau minum', category: 'verbs', iconName: 'Coffee' },
  { id: 'verb-5', label: 'Main', spokenText: 'Saya mau bermain', category: 'verbs', iconName: 'Gamepad2' },
  { id: 'verb-6', label: 'Dengar', spokenText: 'Saya mau mendengar musik', category: 'verbs', iconName: 'Headphones' },
  { id: 'verb-7', label: 'Lihat', spokenText: 'Saya ingin melihat', category: 'verbs', iconName: 'Eye' },
  { id: 'verb-8', label: 'Buka', spokenText: 'Tolong buka ini', category: 'verbs', iconName: 'Key' },
  { id: 'verb-9', label: 'Tutup', spokenText: 'Tolong tutup ini', category: 'verbs', iconName: 'Lock' },
  { id: 'verb-10', label: 'Pergi', spokenText: 'Saya mau pergi', category: 'verbs', iconName: 'Navigation' },
  { id: 'verb-11', label: 'Duduk', spokenText: 'Saya mau duduk', category: 'verbs', iconName: 'Armchair' },
  { id: 'verb-12', label: 'Berdiri', spokenText: 'Saya mau berdiri', category: 'verbs', iconName: 'User' },

  // --- PEOPLE (Orang) ---
  { id: 'peop-1', label: 'Saya', spokenText: 'Saya', category: 'people', iconName: 'User' },
  { id: 'peop-2', label: 'Ibu', spokenText: 'Ibu', category: 'people', iconName: 'Heart' },
  { id: 'peop-3', label: 'Ayah', spokenText: 'Ayah', category: 'people', iconName: 'UserCheck' },
  { id: 'peop-4', label: 'Guru / Terapis', spokenText: 'Guru atau terapis', category: 'people', iconName: 'GraduationCap' },
  { id: 'peop-5', label: 'Teman', spokenText: 'Teman', category: 'people', iconName: 'Users' },
  { id: 'peop-6', label: 'Dokter', spokenText: 'Dokter', category: 'people', iconName: 'Stethoscope' },

  // --- ADJECTIVES (Sifat) ---
  { id: 'adj-1', label: 'Bagus', spokenText: 'Ini bagus', category: 'adjectives', iconName: 'Sparkles' },
  { id: 'adj-2', label: 'Besar', spokenText: 'Ukurannya besar', category: 'adjectives', iconName: 'Maximize2' },
  { id: 'adj-3', label: 'Kecil', spokenText: 'Ukurannya kecil', category: 'adjectives', iconName: 'Minimize2' },
  { id: 'adj-4', label: 'Panas', spokenText: 'Rasanya panas', category: 'adjectives', iconName: 'Sun' },
  { id: 'adj-5', label: 'Dingin', spokenText: 'Rasanya dingin', category: 'adjectives', iconName: 'Snowflake' },
  { id: 'adj-6', label: 'Enak', spokenText: 'Rasanya enak', category: 'adjectives', iconName: 'ThumbsUp' },
  { id: 'adj-7', label: 'Sakit', spokenText: 'Terasa sakit', category: 'adjectives', iconName: 'Frown' },

  // --- SOCIAL (Sosial) ---
  { id: 'soc-1', label: 'Halo', spokenText: 'Halo', category: 'social', iconName: 'HandMetal' },
  { id: 'soc-2', label: 'Terima Kasih', spokenText: 'Terima kasih', category: 'social', iconName: 'HeartHandshake' },
  { id: 'soc-3', label: 'Tolong', spokenText: 'Tolong', category: 'social', iconName: 'LifeBuoy' },
  { id: 'soc-4', label: 'Ya', spokenText: 'Ya benar', category: 'social', iconName: 'Check' },
  { id: 'soc-5', label: 'Tidak', spokenText: 'Tidak', category: 'social', iconName: 'X' },
  { id: 'soc-6', label: 'Maaf', spokenText: 'Saya minta maaf', category: 'social', iconName: 'SmilePlus' },
  { id: 'soc-7', label: 'Dadah', spokenText: 'Sampai jumpa, dadah', category: 'social', iconName: 'Hand' },

  // --- PLACES (Tempat) ---
  { id: 'place-1', label: 'Rumah', spokenText: 'Rumah', category: 'places', iconName: 'Home' },
  { id: 'place-2', label: 'Sekolah', spokenText: 'Sekolah', category: 'places', iconName: 'School' },
  { id: 'place-3', label: 'Klinik / Terapi', spokenText: 'Tempat terapi', category: 'places', iconName: 'Building2' },
  { id: 'place-4', label: 'Kamar', spokenText: 'Kamar tidur', category: 'places', iconName: 'BedDouble' },
  { id: 'place-5', label: 'Taman', spokenText: 'Taman bermain', category: 'places', iconName: 'Trees' },

  // --- ACTIVITIES (Aktivitas) ---
  { id: 'act-1', label: 'Belajar', spokenText: 'Belajar', category: 'activities', iconName: 'BookOpen' },
  { id: 'act-2', label: 'Terapi', spokenText: 'Waktu terapi', category: 'activities', iconName: 'Activity' },
  { id: 'act-3', label: 'Mandi', spokenText: 'Mau mandi', category: 'activities', iconName: 'ShowerHead' },
  { id: 'act-4', label: 'Tidur', spokenText: 'Mau tidur', category: 'activities', iconName: 'Moon' },
  { id: 'act-5', label: 'Musik', spokenText: 'Mendengarkan musik', category: 'activities', iconName: 'Music' }
];

export const CATEGORY_LABELS: Record<
  string,
  { label: string; color: string; badgeColor: string; swatch: string }
> = {
  emergency: {
    label: 'Darurat',
    color:
      'bg-rose-700 hover:bg-rose-800 text-white border-rose-800 dark:bg-rose-800 dark:hover:bg-rose-700 dark:border-rose-600',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    swatch: 'bg-rose-600',
  },
  people: {
    label: 'Orang',
    color:
      'bg-pink-50 hover:bg-pink-100/80 text-pink-950 border-pink-200 dark:bg-pink-950/50 dark:hover:bg-pink-950/70 dark:text-pink-100 dark:border-pink-800/80',
    badgeColor: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200',
    swatch: 'bg-pink-500',
  },
  verbs: {
    label: 'Kata Kerja',
    color:
      'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70 dark:text-emerald-100 dark:border-emerald-800/80',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    swatch: 'bg-emerald-500',
  },
  nouns: {
    label: 'Benda',
    color:
      'bg-amber-50 hover:bg-amber-100/80 text-amber-950 border-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-950/70 dark:text-amber-100 dark:border-amber-800/80',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    swatch: 'bg-amber-500',
  },
  adjectives: {
    label: 'Sifat',
    color:
      'bg-sky-50 hover:bg-sky-100/80 text-sky-950 border-sky-200 dark:bg-sky-950/50 dark:hover:bg-sky-950/70 dark:text-sky-100 dark:border-sky-800/80',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    swatch: 'bg-sky-500',
  },
  feelings: {
    label: 'Perasaan',
    color:
      'bg-yellow-50 hover:bg-yellow-100/80 text-yellow-950 border-yellow-300 dark:bg-yellow-950/45 dark:hover:bg-yellow-950/65 dark:text-yellow-100 dark:border-yellow-800/80',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
    swatch: 'bg-yellow-500',
  },
  social: {
    label: 'Sosial',
    color:
      'bg-orange-50 hover:bg-orange-100/80 text-orange-950 border-orange-200 dark:bg-orange-950/50 dark:hover:bg-orange-950/70 dark:text-orange-100 dark:border-orange-800/80',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    swatch: 'bg-orange-500',
  },
  needs: {
    label: 'Kebutuhan',
    color:
      'bg-rose-50 hover:bg-rose-100/80 text-rose-950 border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-950/70 dark:text-rose-100 dark:border-rose-800/80',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    swatch: 'bg-rose-400',
  },
  places: {
    label: 'Tempat',
    color:
      'bg-violet-50 hover:bg-violet-100/80 text-violet-950 border-violet-200 dark:bg-violet-950/50 dark:hover:bg-violet-950/70 dark:text-violet-100 dark:border-violet-800/80',
    badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    swatch: 'bg-violet-500',
  },
  activities: {
    label: 'Aktivitas',
    color:
      'bg-teal-50 hover:bg-teal-100/80 text-teal-950 border-teal-200 dark:bg-teal-950/50 dark:hover:bg-teal-950/70 dark:text-teal-100 dark:border-teal-800/80',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
    swatch: 'bg-teal-500',
  },
};
