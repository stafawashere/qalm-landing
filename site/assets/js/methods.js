const { adhan } = window;

export const METHOD_INFO = {
  NorthAmerica: { name: "ISNA", detail: "15° for Fajr and Isha" },
  MoonsightingCommittee: { name: "Moonsighting Committee", detail: "18° for Fajr and Isha, adjusted by season" },
  MuslimWorldLeague: { name: "Muslim World League", detail: "18° for Fajr, 17° for Isha" },
  UmmAlQura: { name: "Umm al-Qura", detail: "18.5° for Fajr, Isha 90 minutes after Maghrib" },
};

export const METHOD_KEYS = Object.keys(METHOD_INFO);

const HIGH_LATITUDE = 48;

function paramsFor(key, asr, lat) {
  const params = adhan.CalculationMethod[key]();
  params.madhab = asr === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

  const needsSeventhRule = Math.abs(lat) > HIGH_LATITUDE && key !== "MoonsightingCommittee";
  if (needsSeventhRule) params.highLatitudeRule = adhan.HighLatitudeRule.SeventhOfTheNight;

  return params;
}

function prayerTimesFor(day, key, asr) {
  const { y, m, d } = day.calendar;
  const { lat, lng } = day.city;
  const calendarDate = day.adhanDate || new Date(y, m - 1, d);
  return new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), calendarDate, paramsFor(key, asr, lat));
}

export function fajrAndIsha(day, key) {
  const times = prayerTimesFor(day, key, day.asr);
  const isReal = Number.isFinite(times.fajr.getTime()) && Number.isFinite(times.isha.getTime());
  if (!isReal) return null;
  return { fajr: times.fajr, isha: times.isha };
}

export function withMethod(day, key) {
  const info = METHOD_INFO[key];
  if (!info || key === day.method.key) return day;

  const standard = prayerTimesFor(day, key, "standard");
  const hanafi = prayerTimesFor(day, key, "hanafi");
  const chosen = day.asr === "hanafi" ? hanafi : standard;
  const times = Object.fromEntries(Object.keys(day.times).map((name) => [name, chosen[name]]));

  const allReal = Object.values(times).every((time) => Number.isFinite(time.getTime()));
  if (!allReal) return day;

  const params = chosen.calculationParameters;
  const standardName = day.method.name.replace(/^the /, "");
  const upcoming = ["fajr", "dhuhr", "asr", "maghrib", "isha"].find((name) => times[name] > day.now);
  const nextKey = upcoming || "fajr";
  const nextTime = upcoming ? times[upcoming] : day.tomorrowFajr;

  return {
    ...day,
    times,
    asrTimes: { standard: standard.asr, hanafi: hanafi.asr },
    angles: { fajr: params.fajrAngle, isha: params.ishaAngle, ishaInterval: params.ishaInterval },
    method: {
      ...day.method,
      key,
      name: info.name,
      detail: info.detail,
      reason: `You chose ${info.name}. The usual method here is ${standardName}.`,
    },
    next: { ...day.next, key: nextKey, name: day.names[nextKey], time: nextTime },
  };
}
