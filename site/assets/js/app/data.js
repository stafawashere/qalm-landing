const SURAH_ROWS = `Al-Fatihah|الفاتحة|7|1
Al-Baqarah|البقرة|286|2
Al Imran|آل عمران|200|50
An-Nisa|النساء|176|77
Al-Maidah|المائدة|120|106
Al-Anam|الأنعام|165|128
Al-Araf|الأعراف|206|151
Al-Anfal|الأنفال|75|177
At-Tawbah|التوبة|129|187
Yunus|يونس|109|208
Hud|هود|123|221
Yusuf|يوسف|111|235
Ar-Rad|الرعد|43|249
Ibrahim|إبراهيم|52|255
Al-Hijr|الحجر|99|262
An-Nahl|النحل|128|267
Al-Isra|الإسراء|111|282
Al-Kahf|الكهف|110|293
Maryam|مريم|98|305
Ta-Ha|طه|135|312
Al-Anbiya|الأنبياء|112|322
Al-Hajj|الحج|78|332
Al-Muminun|المؤمنون|118|342
An-Nur|النور|64|350
Al-Furqan|الفرقان|77|359
Ash-Shuara|الشعراء|227|367
An-Naml|النمل|93|377
Al-Qasas|القصص|88|385
Al-Ankabut|العنكبوت|69|396
Ar-Rum|الروم|60|404
Luqman|لقمان|34|411
As-Sajdah|السجدة|30|415
Al-Ahzab|الأحزاب|73|418
Saba|سبأ|54|428
Fatir|فاطر|45|434
Ya-Sin|يس|83|440
As-Saffat|الصافات|182|446
Sad|ص|88|453
Az-Zumar|الزمر|75|458
Ghafir|غافر|85|467
Fussilat|فصلت|54|477
Ash-Shura|الشورى|53|483
Az-Zukhruf|الزخرف|89|489
Ad-Dukhan|الدخان|59|496
Al-Jathiyah|الجاثية|37|499
Al-Ahqaf|الأحقاف|35|502
Muhammad|محمد|38|507
Al-Fath|الفتح|29|511
Al-Hujurat|الحجرات|18|515
Qaf|ق|45|518
Adh-Dhariyat|الذاريات|60|520
At-Tur|الطور|49|523
An-Najm|النجم|62|526
Al-Qamar|القمر|55|528
Ar-Rahman|الرحمن|78|531
Al-Waqiah|الواقعة|96|534
Al-Hadid|الحديد|29|537
Al-Mujadila|المجادلة|22|542
Al-Hashr|الحشر|24|545
Al-Mumtahanah|الممتحنة|13|549
As-Saff|الصف|14|551
Al-Jumuah|الجمعة|11|553
Al-Munafiqun|المنافقون|11|554
At-Taghabun|التغابن|18|556
At-Talaq|الطلاق|12|558
At-Tahrim|التحريم|12|560
Al-Mulk|الملك|30|562
Al-Qalam|القلم|52|564
Al-Haqqah|الحاقة|52|566
Al-Maarij|المعارج|44|568
Nuh|نوح|28|570
Al-Jinn|الجن|28|572
Al-Muzzammil|المزمل|20|574
Al-Muddaththir|المدثر|56|575
Al-Qiyamah|القيامة|40|577
Al-Insan|الإنسان|31|578
Al-Mursalat|المرسلات|50|580
An-Naba|النبأ|40|582
An-Naziat|النازعات|46|583
Abasa|عبس|42|585
At-Takwir|التكوير|29|586
Al-Infitar|الانفطار|19|587
Al-Mutaffifin|المطففين|36|587
Al-Inshiqaq|الانشقاق|25|589
Al-Buruj|البروج|22|590
At-Tariq|الطارق|17|591
Al-Ala|الأعلى|19|591
Al-Ghashiyah|الغاشية|26|592
Al-Fajr|الفجر|30|593
Al-Balad|البلد|20|594
Ash-Shams|الشمس|15|595
Al-Layl|الليل|21|595
Ad-Duha|الضحى|11|596
Ash-Sharh|الشرح|8|596
At-Tin|التين|8|597
Al-Alaq|العلق|19|597
Al-Qadr|القدر|5|598
Al-Bayyinah|البينة|8|598
Az-Zalzalah|الزلزلة|8|599
Al-Adiyat|العاديات|11|599
Al-Qariah|القارعة|11|600
At-Takathur|التكاثر|8|600
Al-Asr|العصر|3|601
Al-Humazah|الهمزة|9|601
Al-Fil|الفيل|5|601
Quraysh|قريش|4|602
Al-Maun|الماعون|7|602
Al-Kawthar|الكوثر|3|602
Al-Kafirun|الكافرون|6|603
An-Nasr|النصر|3|603
Al-Masad|المسد|5|603
Al-Ikhlas|الإخلاص|4|604
Al-Falaq|الفلق|5|604
An-Nas|الناس|6|604`;

export const SURAHS = SURAH_ROWS.split("\n").map((row, index) => {
  const [name, arabic, ayat, page] = row.split("|");
  return { number: index + 1, name, arabic, ayat: Number(ayat), page: Number(page) };
});

export const TOTAL_PAGES = 604;
export const TOTAL_AYAT = 6236;
export const MINUTES_PER_PAGE = 5;

export const AYAT = [
  { s: 94, a: 5, text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا" },
  { s: 94, a: 6, text: "إِنَّ مَعَ الْعُسْرِ يُسْرًا" },
  { s: 2, a: 152, text: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ" },
  { s: 2, a: 153, text: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" },
  { s: 3, a: 200, text: "يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا وَرَابِطُوا وَاتَّقُوا اللَّهَ لَعَلَّكُمْ تُفْلِحُونَ" },
  { s: 11, a: 115, text: "وَاصْبِرْ فَإِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ" },
  { s: 13, a: 28, text: "الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ" },
  { s: 16, a: 127, text: "وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ ۚ وَلَا تَحْزَنْ عَلَيْهِمْ وَلَا تَكُ فِي ضَيْقٍ مِمَّا يَمْكُرُونَ" },
  { s: 33, a: 41, text: "يَا أَيُّهَا الَّذِينَ آمَنُوا اذْكُرُوا اللَّهَ ذِكْرًا كَثِيرًا" },
  { s: 103, a: 3, text: "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ" },
  { s: 1, a: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
  { s: 112, a: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
  { s: 2, a: 255, text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ …" },
];

export const DAILY_AYAH_KEYS = ["94:6", "13:28", "2:152", "11:115", "33:41", "1:2", "94:5"];

export const BOOKMARKS = [
  { ref: "2:255", daysAgo: 3 },
  { ref: "94:6", daysAgo: 9 },
  { ref: "13:28", daysAgo: 18 },
  { ref: "112:1", daysAgo: 24 },
  { ref: "1:2", daysAgo: 37 },
];

export const RECENT_SEARCHES = ["الصبر", "ذكر", "العسر"];

export function ayahByRef(ref) {
  const [s, a] = ref.split(":").map(Number);
  return AYAT.find((entry) => entry.s === s && entry.a === a);
}

export function surahOf(number) {
  return SURAHS[number - 1];
}

export function juzOfPage(page) {
  if (page < 22) return 1;
  return Math.min(30, Math.floor((page - 2) / 20) + 1);
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function arabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/;
const ALEF_VARIANTS = /[آأإٱ]/g;

function normaliseChar(character) {
  if (DIACRITICS.test(character)) return "";
  return character.replace(ALEF_VARIANTS, "ا").replace("ى", "ي");
}

export function normaliseArabic(text) {
  return [...text].map(normaliseChar).join("");
}

export function findMatches(text, query) {
  const needle = normaliseArabic(query.trim());
  if (!needle) return [];

  let normalised = "";
  const indexMap = [];
  const characters = [...text];
  characters.forEach((character, index) => {
    const mapped = normaliseChar(character);
    for (const piece of mapped) {
      normalised += piece;
      indexMap.push(index);
    }
  });

  const ranges = [];
  let from = 0;
  while (from <= normalised.length - needle.length) {
    const hit = normalised.indexOf(needle, from);
    if (hit === -1) break;

    const start = indexMap[hit];
    let end = indexMap[hit + needle.length - 1] + 1;
    while (end < characters.length && DIACRITICS.test(characters[end])) end += 1;
    ranges.push([start, end]);
    from = hit + needle.length;
  }
  return { characters, ranges };
}

export const CC_FOR_KEY = {
  NorthAmerica: "US",
  MoonsightingCommittee: "GB",
  MuslimWorldLeague: "XX",
  France: "FR",
  Singapore: "SG",
  UmmAlQura: "SA",
  Egyptian: "EG",
  Dubai: "AE",
  Qatar: "QA",
  Kuwait: "KW",
  Karachi: "PK",
  Turkey: "TR",
  Tehran: "IR",
};

export const METHOD_LIST = [
  { key: "NorthAmerica", region: "North America", name: "ISNA", description: "A balanced twilight angle for morning and evening.", angles: "Fajr 15°, Isha 15°", defaults: "Default for the United States and Canada" },
  { key: "MoonsightingCommittee", region: "North America", name: "Moonsighting Committee", description: "Seasonal rules for higher latitudes, based on observed twilight.", angles: "Seasonal angles", defaults: "Default for the United Kingdom" },
  { key: "MuslimWorldLeague", region: "Europe and Far East", name: "Muslim World League", description: "Widely used in Europe, the Far East and parts of the United States.", angles: "Fajr 18°, Isha 17°", defaults: "Default for much of Europe" },
  { key: "France", region: "Europe and Far East", name: "France, 12 degrees", description: "A shallow twilight angle for both Fajr and Isha.", angles: "Fajr 12°, Isha 12°", defaults: "Default for France" },
  { key: "Singapore", region: "Europe and Far East", name: "Southeast Asia", description: "A deeper Fajr angle than Isha, as set for Indonesia, Malaysia and Singapore.", angles: "Fajr 20°, Isha 18°", defaults: "Default for Indonesia, Malaysia and Singapore" },
  { key: "UmmAlQura", region: "Middle East", name: "Umm al-Qura, Makkah", description: "Isha is a fixed 90 minutes after Maghrib.", angles: "Fajr 18.5°, Isha 90 min", defaults: "Default for Saudi Arabia" },
  { key: "Egyptian", region: "Middle East", name: "Egyptian General Authority", description: "The deepest Fajr angle of the common methods.", angles: "Fajr 19.5°, Isha 17.5°", defaults: "Default for Egypt" },
  { key: "Dubai", region: "Middle East", name: "Dubai", description: "Equal twilight angles with a small adjustment.", angles: "Fajr 18.2°, Isha 18.2°", defaults: "Default for the United Arab Emirates" },
  { key: "Qatar", region: "Middle East", name: "Qatar", description: "Isha is a fixed 90 minutes after Maghrib.", angles: "Fajr 18°, Isha 90 min", defaults: "Default for Qatar" },
  { key: "Kuwait", region: "Middle East", name: "Kuwait", description: "A slightly shallower evening angle than the morning one.", angles: "Fajr 18°, Isha 17.5°", defaults: "Default for Kuwait" },
  { key: "Tehran", region: "Middle East", name: "Tehran", description: "Institute of Geophysics angles with a later Maghrib.", angles: "Fajr 17.7°, Isha 14°", defaults: "Default for Iran" },
  { key: "Karachi", region: "South Asia and Turkey", name: "Karachi", description: "Equal twilight angles. Common in Pakistan, India and Bangladesh.", angles: "Fajr 18°, Isha 18°", defaults: "Default for South Asia" },
  { key: "Turkey", region: "South Asia and Turkey", name: "Turkey", description: "An approximation of the Diyanet timetable.", angles: "Fajr 18°, Isha 17°", defaults: "Default for Turkey" },
];

export const REGIONS = ["North America", "Europe and Far East", "Middle East", "South Asia and Turkey"];

export const SUGGESTION_POOL = ["Long recitation", "Dua for family", "Dhikr after Isha", "Give charity", "Pray qiyam"];

export const CONSISTENCY_PATTERN = [
  "1110110", "1011101", "0111011", "1101110", "0010100", "0000000", "1011010", "0110101", "1101011", "1110010", "0101101", "1111010",
];

export const civil = {
  fromParts(y, m, d) {
    return Date.UTC(y, m - 1, d) / 86400000;
  },
  toDate(dayNumber) {
    return new Date(dayNumber * 86400000);
  },
  parts(dayNumber) {
    const date = civil.toDate(dayNumber);
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), weekday: date.getUTCDay() };
  },
  label(dayNumber, { year = true } = {}) {
    const date = civil.toDate(dayNumber);
    const part = (options) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
    const base = `${part({ weekday: "short" })} ${part({ day: "numeric" })} ${part({ month: "short" })}`;
    return year ? `${base} ${part({ year: "numeric" })}` : base;
  },
  long(dayNumber) {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(civil.toDate(dayNumber));
  },
  short(dayNumber) {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(civil.toDate(dayNumber));
  },
};

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });

export function ramadanBounds(todayDayNumber) {
  for (let offset = -30; offset < 400; offset += 1) {
    const dayNumber = todayDayNumber + offset;
    const parts = hijriFormat.formatToParts(civil.toDate(dayNumber) );
    const read = (type) => Number(parts.find((part) => part.type === type).value);
    const isFirstOfRamadan = read("month") === 9 && read("day") === 1;
    if (!isFirstOfRamadan) continue;

    const end = dayNumber + 29;
    if (end >= todayDayNumber) return { start: dayNumber, end, year: read("year") };
  }
  return null;
}

export function resumeLabel(resume) {
  const surah = SURAHS[resume.surah - 1];
  return resume.ayah ? `${surah.name} ${resume.surah}:${resume.ayah}` : surah.name;
}

export function resumePageLabel(resume) {
  return resume.approx ? `About page ${resume.page}` : `Page ${resume.page}`;
}

export function surahOnPage(page) {
  let found = SURAHS[0];
  for (const surah of SURAHS) {
    if (surah.page <= page) found = surah;
  }
  return found;
}

export function juzStartPage(juz) {
  return juz === 1 ? 1 : 2 + 20 * (juz - 1);
}
