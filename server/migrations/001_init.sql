CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  genre TEXT NOT NULL,
  runtime_minutes INTEGER NOT NULL CHECK (runtime_minutes > 0)
);
CREATE TABLE IF NOT EXISTS auditoriums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('Standard','IMAX'))
);
CREATE TABLE IF NOT EXISTS showtimes (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movies(id),
  auditorium_id TEXT NOT NULL REFERENCES auditoriums(id),
  show_date DATE NOT NULL,
  show_time TIME NOT NULL,
  price_try INTEGER NOT NULL CHECK (price_try > 0)
);
CREATE TABLE IF NOT EXISTS bookings (
  reference TEXT PRIMARY KEY,
  visitor_token TEXT NOT NULL,
  showtime_id TEXT NOT NULL REFERENCES showtimes(id),
  seat_id TEXT NOT NULL,
  price_try INTEGER NOT NULL CHECK (price_try > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_showtime_seat_unique UNIQUE (showtime_id, seat_id)
);
CREATE INDEX IF NOT EXISTS bookings_visitor_token_idx ON bookings(visitor_token);
CREATE INDEX IF NOT EXISTS bookings_showtime_idx ON bookings(showtime_id);
