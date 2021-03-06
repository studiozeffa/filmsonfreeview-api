// Combines similar films and sorts out showtimes.

const FIFTEEN_MINS_IN_MILLIS = 15 * 60 * 1000;

/**
 * @param {Array} [filmData]
 */
module.exports = function(filmData) {
  const alreadySeenShowtime = new Set();
  const filmDataMap = new Map();

  filmData.forEach(function(filmDataItem) {
    const {date, films} = filmDataItem;
    let mostRecentShowtime = '00:00';

    films.forEach(function(film) {
      const { title, year, synopsis, startTime, endTime, channel, imdbUrl, tmdbImageId, tmdbRating } = film;

      const startDate = toDateString(date);

      if(startTime >= mostRecentShowtime) {
        const filmKey = `${title}:${year || ''}`;
        const showtimeKey = `${filmKey}:${channel}:${startDate}:${startTime}:${endTime}`;

        if(!alreadySeenShowtime.has(showtimeKey)) {
          const existingFilm = filmDataMap.get(filmKey);
          // If the endTime is before the startTime, it ends the next day.
          const endDate = toDateString(endTime > startTime ? date : date.clone().add(1, 'day'));
          const nextShowtime = {
            startDate,
            startTime,
            endDate,
            endTime,
            channel
          };

          if(existingFilm) {
            // Film already exists.
            // Add showtime, provided it is more than 15 minutes after the
            // end of the last showtime (this prevents a news break from
            // erroneously creating a new showtime).
            const lastShowtime = existingFilm.showtimes[existingFilm.showtimes.length-1];
            if(!lastShowtime || !startsWithin15MinutesOfPreviousEnd(lastShowtime, nextShowtime)) {
              existingFilm.showtimes.push(nextShowtime);
            } else {
              // We have an existing showtime and the endTime was
              // less than 15 mins from this startTime.
              // Let's assume this was a newsbreak -
              // don't add the nextShowtime, but instead update the lastShowtime.
              lastShowtime.endDate = endDate;
              lastShowtime.endTime = endTime;
            }
          } else {
            // New film.
            const filmEntity = {
              title,
              year,
              synopsis: cleanseSynopsis(synopsis),
              imdbUrl,
              tmdbImageId,
              tmdbRating,
              showtimes: [ nextShowtime ]
            };
            filmDataMap.set(filmKey, filmEntity);
            alreadySeenShowtime.add(showtimeKey);
          }
        }
        mostRecentShowtime = startTime;
      }
    });
  });

  return Array.from(filmDataMap.values());
};

function toDateString(date) {
  return date.format('YYYY-MM-DD');
}

function startsWithin15MinutesOfPreviousEnd(previous, next) {
  if(!previous || !next) {
    return false;
  }

  const previousEndMillis = getMillisTime(previous.endDate, previous.endTime);
  const nextStartMillis = getMillisTime(next.startDate, next.startTime);

  return nextStartMillis - previousEndMillis <= FIFTEEN_MINS_IN_MILLIS;
}

function getMillisTime(date, time) {
  return new Date(`${date}T${time}:00.000Z`).getTime();
}

function cleanseSynopsis(synopsis = '') {
  return synopsis.replace(/\n/g, '');
}