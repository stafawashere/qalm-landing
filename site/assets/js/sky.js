const { adhan, SunCalc } = window;

const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah"];
const KAABA = { lat: 21.4225241, lng: 39.8261818 };
const HIGH_LATITUDE = 48;

const METHODS = {
  NorthAmerica: { name: "ISNA", detail: "15° for Fajr and Isha" },
  MoonsightingCommittee: { name: "Moonsighting Committee", detail: "18° for Fajr and Isha, adjusted by season" },
  UmmAlQura: { name: "Umm al-Qura", detail: "18.5° for Fajr, Isha 90 minutes after Maghrib" },
  Dubai: { name: "the Dubai method", detail: "18.2° for Fajr and Isha" },
  Qatar: { name: "the Qatar method", detail: "18° for Fajr, Isha 90 minutes after Maghrib" },
  Kuwait: { name: "the Kuwait method", detail: "18° for Fajr, 17.5° for Isha" },
  Egyptian: { name: "Egyptian General Authority", detail: "19.5° for Fajr, 17.5° for Isha" },
  Karachi: { name: "Karachi", detail: "18° for Fajr and Isha, Hanafi Asr" },
  Turkey: { name: "Turkey", detail: "an approximation of Diyanet" },
  Singapore: { name: "Fajr 20°, Isha 18°", detail: "20° for Fajr, 18° for Isha" },
  France: { name: "12° for Fajr and Isha", detail: "12° for Fajr and Isha" },
  Tehran: { name: "the Tehran method", detail: "17.7° for Fajr, 14° for Isha" },
  MuslimWorldLeague: { name: "Muslim World League", detail: "18° for Fajr, 17° for Isha" },
};

const COUNTRY_METHOD = {
  US: "NorthAmerica", CA: "NorthAmerica", GB: "MoonsightingCommittee", SA: "UmmAlQura", AE: "Dubai",
  QA: "Qatar", KW: "Kuwait", EG: "Egyptian", PK: "Karachi", IN: "Karachi", BD: "Karachi", AF: "Karachi",
  TR: "Turkey", ID: "Singapore", MY: "Singapore", SG: "Singapore", BN: "Singapore", FR: "France", IR: "Tehran",
};

const HANAFI_COUNTRIES = new Set(["PK", "IN", "BD", "AF"]);

const REASONS = {
  US: "US default: ISNA. Many US mosques use this. Moonsighting Committee is a common alternative.",
  CA: "Canada default: ISNA. There is no single national authority.",
  GB: "UK default: Moonsighting Committee. Many UK mosques follow it. Your mosque may use a printed timetable instead.",
  SA: "Saudi Arabia default: Umm al-Qura.",
  AE: "UAE default: the Dubai method.",
  QA: "Qatar default: the Qatar method.",
  KW: "Kuwait default: the Kuwait method.",
  EG: "Egypt default: Egyptian General Authority of Survey.",
  southAsia: "South Asia default: Karachi method with Hanafi Asr. Change Asr if your mosque differs.",
  TR: "Turkey default: an approximation of Diyanet.",
  southeastAsia: "Southeast Asia default: Fajr 20 degrees, Isha 18 degrees, as used by Kemenag and JAKIM.",
  FR: "France default: 12 degrees for Fajr and Isha, as used by many French mosques.",
  IR: "Iran default: the Tehran method.",
  other: "No single authority is standard here, so Qalm uses Muslim World League. Change it if your mosque differs.",
};

const SHORT_REGION = { US: "the US", CA: "Canada", GB: "the UK", AE: "the UAE" };
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function reasonFor(cc, key) {
  if (key === "Karachi") return REASONS.southAsia;
  if (key === "Singapore") return REASONS.southeastAsia;
  return REASONS[cc] || REASONS.other;
}

function regionLabel(cc, key) {
  if (key === "Karachi") return "South Asia";
  if (key === "Singapore") return "Southeast Asia";
  return SHORT_REGION[cc] || regionNames.of(cc) || cc;
}

export function methodFor(cc) {
  const key = COUNTRY_METHOD[cc] || "MuslimWorldLeague";
  const { name, detail } = METHODS[key];
  const isGeneralDefault = key === "MuslimWorldLeague";
  const short = isGeneralDefault ? "Muslim World League, the general default" : `${name.replace(/^the /, "")}, the default for ${regionLabel(cc, key)}`;

  return {
    key,
    name,
    detail,
    short: short.charAt(0).toUpperCase() + short.slice(1),
    reason: reasonFor(cc, key),
    defaultAsr: HANAFI_COUNTRIES.has(cc) ? "hanafi" : "standard",
  };
}

function paramsFor(methodKey, asr, lat) {
  const params = methodKey === "France" ? adhan.CalculationMethod.Other() : adhan.CalculationMethod[methodKey]();

  if (methodKey === "France") {
    params.fajrAngle = 12;
    params.ishaAngle = 12;
  }

  params.madhab = asr === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

  const needsSeventhRule = Math.abs(lat) > HIGH_LATITUDE && methodKey !== "MoonsightingCommittee";
  if (needsSeventhRule) params.highLatitudeRule = adhan.HighLatitudeRule.SeventhOfTheNight;

  return params;
}

function isValidDay(prayerTimes) {
  const instants = PRAYERS.map((key) => prayerTimes[key]?.getTime());
  const allReal = instants.every((value) => Number.isFinite(value));
  const inOrder = instants.every((value, index) => index === 0 || value > instants[index - 1]);
  return allReal && inOrder;
}

function computeTimes(lat, lng, calendarDate, methodKey, asr) {
  const params = paramsFor(methodKey, asr, lat);
  const exact = new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), calendarDate, params);

  if (isValidDay(exact)) return { prayerTimes: exact, estimated: false };

  const cappedLatitude = Math.sign(lat) * Math.min(Math.abs(lat), 65);
  const capped = new adhan.PrayerTimes(new adhan.Coordinates(cappedLatitude, lng), calendarDate, params);
  return { prayerTimes: capped, estimated: true };
}

export function zonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return { y: value("year"), m: value("month"), d: value("day"), h: value("hour"), min: value("minute"), s: value("second") };
}

function offsetMs(instant, tz) {
  const { y, m, d, h, min, s } = zonedParts(new Date(instant), tz);
  return Date.UTC(y, m - 1, d, h, min, s) - Math.floor(instant / 1000) * 1000;
}

export function zonedToInstant(y, m, d, h, min, tz) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

function hijriLabel(date, tz) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: tz, day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const month = HIJRI_MONTHS[Number(value("month")) - 1];
  const year = String(value("year")).replace(/\D/g, "");
  return `${value("day")} ${month} ${year}`;
}

export function sunAt(date, lat, lng) {
  const { altitude, azimuth } = SunCalc.getPosition(date, lat, lng);
  const altitudeDeg = (altitude * 180) / Math.PI;
  const shadowBearing = ((azimuth * 180) / Math.PI + 360) % 360;
  const shadow = altitude > 0 ? 1 / Math.tan(altitude) : null;
  return { altitude: altitudeDeg, sunBearing: (shadowBearing + 180) % 360, shadowBearing, shadow };
}

function distanceToKaaba(lat, lng, cc) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(KAABA.lat - lat);
  const dLng = toRad(KAABA.lng - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const usesMiles = cc === "US" || cc === "GB";
  const value = Math.round(usesMiles ? km * 0.621371 : km).toLocaleString("en-US");
  return { value, unit: usesMiles ? "mi" : "km" };
}

function inText(from, to) {
  const totalMinutes = Math.max(0, Math.round((to - from) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `in ${minutes} min`;
  return minutes === 0 ? `in ${hours} h` : `in ${hours} h ${minutes} min`;
}

const PRAYER_NAMES = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

function anchorDate(city, y, m, d, methodKey) {
  const coordinates = new adhan.Coordinates(city.lat, city.lng);
  const params = paramsFor(methodKey, "standard", city.lat);

  for (const shift of [0, 1, -1]) {
    const date = new Date(y, m - 1, d + shift);
    const noon = zonedParts(new adhan.PrayerTimes(coordinates, date, params).dhuhr, city.tz);
    const isCityDay = noon.y === y && noon.m === m && noon.d === d;
    if (isCityDay) return date;
  }

  return new Date(y, m - 1, d);
}

export function computeDay(city, asrChoice, now = new Date()) {
  const method = methodFor(city.cc);
  const asr = asrChoice || method.defaultAsr;
  const { y, m, d } = zonedParts(now, city.tz);
  const calendarDate = anchorDate(city, y, m, d, method.key);
  const nextCalendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() + 1);

  const standard = computeTimes(city.lat, city.lng, calendarDate, method.key, "standard");
  const hanafi = computeTimes(city.lat, city.lng, calendarDate, method.key, "hanafi");
  const chosen = asr === "hanafi" ? hanafi : standard;
  const tomorrow = computeTimes(city.lat, city.lng, nextCalendarDate, method.key, asr);

  const times = Object.fromEntries(PRAYERS.map((key) => [key, chosen.prayerTimes[key]]));
  const params = chosen.prayerTimes.calculationParameters;

  const noonSun = sunAt(times.dhuhr, city.lat, city.lng);
  const noonShadow = noonSun.shadow;

  const timeFormat = new Intl.DateTimeFormat(undefined, { timeZone: city.tz, hour: "numeric", minute: "2-digit" });
  const fmt = (date) => {
    const parts = timeFormat.formatToParts(date);
    const period = parts.find((part) => part.type === "dayPeriod")?.value || "";
    const time = parts.filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim();
    return { time, period };
  };
  const fmtText = (date) => {
    const { time, period } = fmt(date);
    return period ? `${time} ${period}` : time;
  };

  const upcoming = ["fajr", "dhuhr", "asr", "maghrib", "isha"].find((key) => times[key] > now);
  const nextKey = upcoming || "fajr";
  const nextTime = upcoming ? times[upcoming] : tomorrow.prayerTimes.fajr;

  const alertsUntilDate = new Date(now.getTime() + 12 * 86400000);

  return {
    city,
    now,
    calendar: { y, m, d },
    adhanDate: calendarDate,
    midnight: zonedToInstant(y, m, d, 0, 0, city.tz),
    dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: city.tz, weekday: "long", month: "long", day: "numeric" }).format(now),
    hijriLabel: hijriLabel(now, city.tz),
    method,
    asr,
    angles: { fajr: params.fajrAngle, isha: params.ishaAngle, ishaInterval: params.ishaInterval },
    estimated: chosen.estimated,
    highLatitude: Math.abs(city.lat) > HIGH_LATITUDE,
    times,
    asrTimes: { standard: standard.prayerTimes.asr, hanafi: hanafi.prayerTimes.asr },
    tomorrowFajr: tomorrow.prayerTimes.fajr,
    noonShadow,
    fmt,
    fmtText,
    next: { key: nextKey, name: PRAYER_NAMES[nextKey], time: nextTime, inText: inText(now, nextTime) },
    qibla: adhan.Qibla(new adhan.Coordinates(city.lat, city.lng)),
    kaaba: distanceToKaaba(city.lat, city.lng, city.cc),
    alertsUntil: new Intl.DateTimeFormat("en-US", { timeZone: city.tz, month: "long", day: "numeric" }).format(alertsUntilDate),
    names: PRAYER_NAMES,
  };
}

export function compassWord(bearing) {
  const words = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
  return words[Math.round(bearing / 22.5) % 16];
}
