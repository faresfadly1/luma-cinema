import { useEffect, useMemo, useState } from 'react';
import { CinemaPreview, type PreviewStage } from './CinemaPreview';
import { getSeats, halls, seatMeasurements, type Hall, type Seat } from './geometry';
import { cinemaFilms } from './films';

type Film = {
  id: string;
  title: string;
  englishTitle?: string;
  genre: string;
  runtime: string;
  score?: string;
  image: string;
  showtimes: string[];
};
type Show = { id: string; movieId?: string; date: string; time: string; hallId: string; price: number };
type Booking = { id: string; token: string; movieId: string; show: Show; seatId: string; createdAt: string };

const asset = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
const films: Film[] = cinemaFilms.map(({ poster, ...film }) => ({ ...film, image: asset(`films/${poster}`) }));
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
const storageKey = 'luma-bookings-v1';
const tokenKey = 'luma-visitor-token';
const sourceScheduleDate = '2026-11-26';
const demoShows: Record<string, Show[]> = Object.fromEntries(films.map((film) => [film.id, film.showtimes.map((time) => ({
  id: `${film.id}-20261126-${time.replace(':', '')}`,
  movieId: film.id,
  date: sourceScheduleDate,
  time,
  hallId: 'standard',
  price: 240,
}))]));

function token() {
  let value = localStorage.getItem(tokenKey);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(tokenKey, value); }
  return value;
}
function readBookings(): Booking[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
}
function money(value: number) {
  return new Intl.NumberFormat('en-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(`${value}T12:00:00+03:00`));
}
function filmFor(id: string) { return films.find((film) => film.id === id) || films[0]; }
export default function App() {
  const [route, setRoute] = useState(location.hash || '#/');
  const [movieId, setMovieId] = useState(films[0]!.id);
  const [show, setShow] = useState<Show | null>(null);
  const [seatId, setSeatId] = useState('');
  const [previewStage, setPreviewStage] = useState<PreviewStage>('map');
  const [previewReady, setPreviewReady] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(readBookings());
  const [ticket, setTicket] = useState<Booking | null>(null);
  const [notice, setNotice] = useState('');
  const [occupied, setOccupied] = useState<string[]>([]);
  const [serverShows, setServerShows] = useState<Show[]>([]);
  const [showtimesStatus, setShowtimesStatus] = useState<'loading' | 'ready' | 'error'>(API ? 'loading' : 'ready');
  const [availabilityStatus, setAvailabilityStatus] = useState<'loading' | 'ready' | 'error'>(API ? 'loading' : 'ready');
  const [bookingPending, setBookingPending] = useState(false);

  const ticketRoute = route.startsWith('#/ticket/');
  const myTicketsRoute = route === '#/tickets';
  const previewRoute = route === '#/preview';
  const hall = (show ? halls[show.hallId] : halls.standard) as Hall;
  const seats = useMemo(() => getSeats(hall), [hall]);
  const selectedSeat = seats.find((candidate) => candidate.id === seatId);
  const seat = selectedSeat || seats[Math.floor(seats.length / 2)]!;
  const hasSeatSelection = !!selectedSeat;
  const film = filmFor(movieId);
  const featuredFilm = films[0]!;
  const currentShows = API ? serverShows.filter((candidate) => candidate.movieId === movieId) : demoShows[movieId];

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = location.hash || '#/';
      setRoute(nextRoute);
      if (nextRoute === '#/book' && previewStage === 'seated') setPreviewStage('returning');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [previewStage]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(bookings)); }, [bookings]);

  useEffect(() => {
    if (!API) { setShowtimesStatus('ready'); return; }
    let cancelled = false;
    const load = async () => {
      setShowtimesStatus('loading');
      try {
        const response = await fetch(`${API}/api/showtimes`);
        if (!response.ok) throw new Error('Showtimes unavailable');
        const data = await response.json();
        if (!Array.isArray(data.showtimes)) throw new Error('Invalid showtimes response');
        if (!cancelled) { setServerShows(data.showtimes); setShowtimesStatus('ready'); }
      } catch { if (!cancelled) setShowtimesStatus('error'); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!show) { setOccupied([]); setAvailabilityStatus(API ? 'loading' : 'ready'); return; }
    let cancelled = false;
    const sync = async () => {
      if (API) {
        setAvailabilityStatus('loading');
        try {
          const response = await fetch(`${API}/api/showtimes/${show.id}/seats`);
          if (!response.ok) throw new Error('Availability unavailable');
          const data = await response.json();
          if (!cancelled) { setOccupied(data.bookedSeats || []); setAvailabilityStatus('ready'); }
        } catch { if (!cancelled) setAvailabilityStatus('error'); }
        return;
      }
      const saved = readBookings().filter((booking) => booking.show.id === show.id).map((booking) => booking.seatId);
      const seeded = seats.filter((_, index) => (index * 7 + 13) % 17 === 0).map((candidate) => candidate.id);
      if (!cancelled) { setOccupied([...new Set([...seeded, ...saved])]); setAvailabilityStatus('ready'); }
    };
    void sync();
    const timer = window.setInterval(sync, 12_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [show, seats]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    if (ticketRoute) {
      const reference = route.split('/')[2];
      const stored = readBookings().find((booking) => booking.id === reference && booking.token === token());
      if (API) {
        setTicket(null);
        void fetch(`${API}/api/tickets/${reference}`, { headers: { 'x-visitor-token': token() } })
          .then((response) => { if (!response.ok) throw new Error('Ticket not found'); return response.json(); })
          .then(() => { if (!cancelled) { if (stored) setTicket(stored); else setNotice('This ticket is not available for this visitor.'); } })
          .catch(() => { if (!cancelled) setNotice('This ticket is not available for this visitor.'); });
      } else if (stored) setTicket(stored);
      else setNotice('This ticket is not available in this browser.');
    } else setTicket(null);
    return () => { cancelled = true; };
  }, [route]);

  function chooseFilm(id: string) {
    setMovieId(id); setShow(null); setSeatId(''); setPreviewStage('map'); setPreviewReady(false); location.hash = '#/book';
  }
  function selectShow(nextShow: Show) {
    setShow(nextShow); setSeatId(''); setPreviewStage('map'); setPreviewReady(false); location.hash = '#/book';
  }
  function selectSeat(nextSeat: Seat) {
    setSeatId(nextSeat.id);
  }
  function continueToPreview() {
    if (!show || !hasSeatSelection || !previewReady || occupied.includes(seatId) || (!!API && availabilityStatus !== 'ready')) return;
    setPreviewStage('moving');
    location.hash = '#/preview';
  }
  function completePreviewStage(next: 'seated' | 'map') {
    if (next === 'seated') setPreviewStage('seated');
    else { setPreviewStage('map'); location.hash = '#/book'; }
  }
  function changeSeat() {
    if (previewStage === 'seated') setPreviewStage('returning');
    else { setPreviewStage('map'); location.hash = '#/book'; }
  }
  function goHome() { setShow(null); location.hash = '#/'; }
  function retryShowtimes() {
    if (!API) { setShowtimesStatus('ready'); return; }
    setShowtimesStatus('loading');
    void fetch(`${API}/api/showtimes`).then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!Array.isArray(data.showtimes)) throw new Error(); setServerShows(data.showtimes); setShowtimesStatus('ready'); })
      .catch(() => setShowtimesStatus('error'));
  }
  function retryAvailability() {
    if (!API || !show) return;
    setAvailabilityStatus('loading');
    void fetch(`${API}/api/showtimes/${show.id}/seats`).then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { setOccupied(data.bookedSeats || []); setAvailabilityStatus('ready'); })
      .catch(() => setAvailabilityStatus('error'));
  }

  async function confirmBooking() {
    if (!show || !hasSeatSelection || bookingPending) return;
    if (API && (showtimesStatus !== 'ready' || availabilityStatus !== 'ready')) { setNotice('Wait for the server to confirm availability before booking.'); return; }
    if (occupied.includes(seatId)) { setNotice('That seat is occupied. Please choose another seat.'); return; }
    setBookingPending(true);
    try {
      const ownToken = token();
      let booking: Booking;
      if (API) {
        try {
          const response = await fetch(`${API}/api/bookings`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-visitor-token': ownToken },
            body: JSON.stringify({ showtimeId: show.id, seatId }),
          });
          const data = await response.json();
          if (!response.ok) {
            if (response.status === 409) {
              setNotice('That seat was just booked. Availability has been refreshed.');
              setAvailabilityStatus('loading');
              try {
                const fresh = await fetch(`${API}/api/showtimes/${show.id}/seats`);
                if (!fresh.ok) throw new Error();
                setOccupied((await fresh.json()).bookedSeats || []); setAvailabilityStatus('ready');
              } catch { setAvailabilityStatus('error'); }
            } else { setAvailabilityStatus('error'); setNotice(data.error || 'Booking could not be completed. Please retry.'); }
            return;
          }
          booking = { id: data.booking.reference, token: ownToken, movieId, show, seatId, createdAt: new Date().toISOString() };
        } catch {
          setAvailabilityStatus('error'); setNotice('The booking server did not respond. Retry availability before booking.'); return;
        }
      } else {
        booking = { id: `LM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, token: ownToken, movieId, show, seatId, createdAt: new Date().toISOString() };
      }
      setBookings((previous) => [booking, ...previous.filter((item) => item.id !== booking.id)]);
      setOccupied((previous) => [...previous, seatId]);
      setTicket(booking);
      location.hash = `#/ticket/${booking.id}`;
    } finally { setBookingPending(false); }
  }

  async function openTicket(booking: Booking) {
    if (API) {
      try {
        const response = await fetch(`${API}/api/tickets/${booking.id}`, { headers: { 'x-visitor-token': token() } });
        if (!response.ok) throw new Error();
      } catch { setNotice('This ticket is not available for this visitor.'); return; }
    }
    setTicket(booking); location.hash = `#/ticket/${booking.id}`;
  }

  const nav = <header className="topbar">
    <button className="brand" onClick={goHome} aria-label="Luma Cinema home"><span className="brand-mark">L</span><span>LUMA <span className="brand-light">CINEMA</span></span></button>
    <nav aria-label="Main navigation"><button onClick={goHome}>Films</button><button onClick={() => { location.hash = '#/tickets'; }}>My tickets <span className="ticket-count">{bookings.length}</span></button></nav>
    <button className="city-control" aria-label="Cinema location, Ankara, Türkiye"><span className="city-dot"/>Ankara, Türkiye <span className="chevron">⌄</span></button>
  </header>;

  const homeScreen = <main className="home-screen">
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(6,9,11,.92) 0%,rgba(6,9,11,.72) 40%,rgba(6,9,11,.15) 100%),url("${featuredFilm.image}")` }}>
      <div className="hero-copy"><p className="eyebrow"><span className="live-dot"/>NOW SHOWING IN ANKARA</p><h1>{featuredFilm.title}</h1><p className="hero-description">{featuredFilm.englishTitle || `${featuredFilm.genre} · ${featuredFilm.runtime}`}</p><div className="hero-meta">{featuredFilm.genre.toUpperCase()} <span/> {featuredFilm.runtime.toUpperCase()} {featuredFilm.score && <><span/> RATING {featuredFilm.score}</>}</div><button className="mint-button hero-button" onClick={() => chooseFilm(featuredFilm.id)}>Book tickets <span aria-hidden="true">↗</span></button></div>
      <div className="hero-caption">PARIBU CINEVERSE · ANKAMALL <span>01 / {String(films.length).padStart(2, '0')}</span></div>
    </section>
    <section className="now-showing" id="now-showing">
      <div className="section-title"><div><p className="eyebrow">PARIBU CINEVERSE · ANKAMALL · 26 NOVEMBER 2026</p><h2>Now showing <span>in Ankara</span></h2></div><span className="showing-count">{String(films.length).padStart(2, '0')} FILMS</span></div>
      <div className="film-grid">{films.map((item, index) => <button className={`film-card film-card-${index + 1}`} key={item.id} onClick={() => chooseFilm(item.id)} aria-label={`Book tickets for ${item.title}`}>
        <img src={item.image} alt={`${item.title} poster`} loading="lazy"/><span className="card-shade"/><span className="film-index">{String(index + 1).padStart(2, '0')}</span><span className="film-card-copy"><strong>{item.title}</strong><small>{item.genre} <i>·</i> {item.runtime}{item.score && <> <i>·</i> {item.score}</>}</small></span><span className="film-arrow" aria-hidden="true">↗</span>
      </button>)}</div>
    </section>
    <footer className="site-footer"><span>LUMA CINEMA</span><span>ANKARA · TÜRKİYE</span><button onClick={() => { location.hash = '#/tickets'; }}>My tickets</button></footer>
  </main>;

  const retryBox = (kind: 'showtimes' | 'availability') => {
    const status = kind === 'showtimes' ? showtimesStatus : availabilityStatus;
    return <div className="service-state" role="status">
      <span className="state-orb"/>
      <span>{status === 'loading' ? (kind === 'showtimes' ? 'Loading showtimes…' : 'Checking seat availability…') : (kind === 'showtimes' ? 'Showtimes are temporarily unavailable.' : 'Seat availability is temporarily unavailable.')}</span>
      {status === 'error' && <button onClick={kind === 'showtimes' ? retryShowtimes : retryAvailability}>Retry</button>}
    </div>;
  };

  const showtimeList = <div className="showtime-list">
    {API && showtimesStatus !== 'ready' ? retryBox('showtimes') : currentShows.map((item) => <button key={item.id} className={`showtime-option ${show?.id === item.id ? 'is-active' : ''}`} onClick={() => selectShow(item)}>
      <span className="show-date">{dateLabel(item.date)}</span><strong>{item.time}</strong><span className="show-hall">{item.hallId === 'imax' ? 'IMAX' : 'STANDARD'} <i>·</i> {halls[item.hallId].name}</span><span className="show-price">{money(item.price)}</span>
    </button>)}
    {!API && currentShows.length === 0 && <p className="empty-shows">No showtimes are listed for this film.</p>}
  </div>;

  const showtimeLabel = show ? `${dateLabel(show.date)} · ${show.time}` : 'Choose a showtime';
  const metrics = seatMeasurements(hall, seat);
  const lateralSide = metrics.lateralOffset < -0.005 ? 'left' : metrics.lateralOffset > 0.005 ? 'right' : 'center';
  const seatMap = <div className={`seat-map-wrap seat-map-stage ${previewStage === 'moving' ? 'is-moving' : ''} ${previewStage === 'returning' ? 'is-returning' : ''} ${previewStage === 'seated' ? 'is-seated' : ''}`}>
    <CinemaPreview hall={hall} seat={seat} poster={film.image} hasSelection={hasSeatSelection} stage={previewStage} onStageComplete={completePreviewStage} onReadyChange={setPreviewReady} forceFallback={new URLSearchParams(location.search).get('preview') === '2d'}/>
    <div className={`map-select-ui ${previewStage !== 'map' && previewStage !== 'returning' ? 'is-hidden' : ''}`}>
    <div className="screen-arc"><span>SCREEN</span></div>
    <div className={`seat-map ${hall.id}`} aria-label={`${hall.name} seat map`}>
      {hall.rows.map((row) => {
        const rowSeats = seats.filter((candidate) => candidate.row === row.label).sort((a, b) => a.position.x - b.position.x);
        const left = rowSeats.filter((candidate) => candidate.position.x < 0);
        const right = rowSeats.filter((candidate) => candidate.position.x > 0);
        const renderSeat = (candidate: Seat) => {
          const occupiedSeat = occupied.includes(candidate.id);
          const selected = hasSeatSelection && seatId === candidate.id;
          return <button key={candidate.id} aria-label={`Row ${candidate.row}, seat ${candidate.number}, ${occupiedSeat ? 'occupied' : selected ? 'selected' : 'available'}`} title={`${candidate.row}${candidate.number}`} disabled={occupiedSeat || (!!API && availabilityStatus !== 'ready') || previewStage !== 'map'} className={`seat ${occupiedSeat ? 'occupied' : ''} ${selected ? 'selected' : ''}`} onClick={() => selectSeat(candidate)}><span>{candidate.number}</span></button>;
        };
        return <div className="seat-row" key={row.label}><span className="row-label">{row.label}</span><div className="seat-half">{left.map(renderSeat)}</div><span className="center-aisle" aria-hidden="true"/><div className="seat-half">{right.map(renderSeat)}</div><span className="row-label">{row.label}</span></div>;
      })}
    </div>
    <div className="seat-legend"><span><i className="legend-seat free"/>Available</span><span><i className="legend-seat taken"/>Occupied</span><span><i className="legend-seat picked"/>Selected</span></div>
    <div className="map-continue-row"><span>{hasSeatSelection ? `Row ${seat.row} · Seat ${seat.number}` : 'Choose an available seat'}</span><button className="mint-button continue-button" onClick={continueToPreview} disabled={!hasSeatSelection || !previewReady || (!!API && availabilityStatus !== 'ready') || occupied.includes(seatId)}>{occupied.includes(seatId) ? 'Seat occupied' : 'Continue'}</button></div>
    </div>
    {previewStage === 'seated' && <section className="seat-preview-details" aria-label="Selected seat details">
      <div className="seat-preview-title"><p className="eyebrow">YOUR VIEW · {hall.format.toUpperCase()}</p><h2>Row {seat.row}, Seat {seat.number}</h2><p>{film.title} <span>·</span> {showtimeLabel} <span>·</span> {hall.name}</p></div>
      <dl className="seat-measurements">
        <div><dt>Distance to screen center</dt><dd>{metrics.distance.toFixed(1)} m</dd></div>
        <div><dt>Horizontal viewing angle</dt><dd>{metrics.screenAngle.toFixed(0)}°</dd></div>
        <div><dt>Lateral offset</dt><dd>{Math.abs(metrics.lateralOffset).toFixed(1)} m <span>{lateralSide}</span></dd></div>
      </dl>
      <div className="preview-actions">
        <button className="change-seat-button" onClick={changeSeat}>Change seat</button>
        <button className="mint-button confirm-button" onClick={() => void confirmBooking()} disabled={!show || bookingPending || (!!API && (showtimesStatus !== 'ready' || availabilityStatus !== 'ready')) || occupied.includes(seatId)}>{bookingPending ? 'Booking…' : occupied.includes(seatId) ? 'Seat occupied' : `Book · ${money(show?.price || 0)}`}</button>
      </div>
      {API && availabilityStatus === 'error' && retryBox('availability')}
    </section>}
  </div>;

  const bookingDetails = show ? <>
    <div className="summary-film"><img src={film.image} alt=""/><div><strong>{film.title}</strong><small>{film.genre}</small></div></div>
    <dl className="summary-details"><div><dt>Showtime</dt><dd>{dateLabel(show.date)} · {show.time}</dd></div><div><dt>Auditorium</dt><dd>{hall.name}</dd></div><div><dt>Seat</dt><dd className="summary-seat-label">{hasSeatSelection ? `${seat.row}${seat.number}` : 'Choose a seat'}</dd></div></dl>
    <div className="summary-total"><span>Total · 1 ticket</span><strong>{money(show.price)}</strong></div>
    <p className="map-continue-hint">{hasSeatSelection ? 'Continue to see your seat from the hall.' : 'Select an available seat to continue.'}</p>
    {API && availabilityStatus === 'error' && <p className="booking-hint">Reconnect to the cinema server to continue.</p>}
  </> : <div className="summary-empty"><span className="summary-ticket">▱</span><p>Choose a showtime to see your booking details.</p></div>;

  const bookScreen = <main className={`booking-screen ${previewStage === 'seated' ? 'is-seated' : ''} ${previewStage === 'moving' || previewStage === 'returning' ? 'is-traveling' : ''}`}>
    <div className="booking-topline"><button className="back-link" onClick={goHome}>← Films</button><p className="eyebrow">YOUR NIGHT AT LUMA</p></div>
    <div className="booking-columns">
      <aside className="film-column"><div className="selected-film-art"><img src={film.image} alt={`${film.title} official poster`}/><span>{film.score ? `RATING ${film.score}` : 'RATING NOT LISTED'} <i>·</i> {film.runtime}</span></div><div className="selected-film-title"><p className="eyebrow">NOW SHOWING · ANKAMALL</p><h1>{film.title}</h1><p>{film.englishTitle || film.genre}</p></div><div className="showtime-picker"><div className="mini-heading"><h2>Choose a showtime</h2><span>26 NOV · TRT</span></div>{showtimeList}</div></aside>
      <section className="seats-column"><div className="seat-column-heading"><div><p className="eyebrow">{show ? `${hall.name} · ${hall.format}` : 'CHOOSE YOUR VIEW'}</p><h2>{show ? previewStage === 'seated' ? `Your view · ${seat.row}${seat.number}` : 'Choose your seat' : 'Find your seat'}</h2></div>{show && previewStage === 'map' && <span className="seat-count">{occupied.length} SEATS TAKEN</span>}</div>
        {show ? <>{API && availabilityStatus !== 'ready' && retryBox('availability')}{seatMap}<p className="seat-note">Row A is closest to the screen <span>·</span> Select any available seat</p></> : <div className="map-placeholder"><div className="placeholder-arc"/><span>Select a showtime to open the seat map</span></div>}
      </section>
      <aside className="booking-aside"><div className="aside-heading"><p className="eyebrow">LUMA CINEMA · ANKARA</p><h2>Your booking</h2></div>{bookingDetails}<p className="secure-note">No payment is collected in this demo.</p></aside>
    </div>
  </main>;

  const ticketList = <main className="tickets-screen"><div className="page-title"><p className="eyebrow">YOUR CINEMA PLANS</p><h1>My tickets</h1><p>Every story starts with a seat.</p></div>{bookings.length === 0 ? <div className="empty-tickets"><span>▱</span><h2>No tickets yet</h2><p>Pick a film and find your view.</p><button className="mint-button" onClick={goHome}>Explore films</button></div> : <div className="ticket-list">{bookings.map((booking) => <button className="ticket-row" key={booking.id} onClick={() => void openTicket(booking)}><img src={filmFor(booking.movieId).image} alt=""/><span><strong>{filmFor(booking.movieId).title}</strong><small>{dateLabel(booking.show.date)} · {booking.show.time} · Seat {booking.seatId}</small></span><b>{money(booking.show.price)}</b><i>↗</i></button>)}</div>}</main>;

  const ticketScreen = ticketRoute && ticket ? <main className="ticket-screen"><button className="back-link" onClick={() => { location.hash = '#/tickets'; }}>← My tickets</button><div className="ticket-intro"><span className="ticket-success">✓</span><div><p className="eyebrow">YOU’RE ALL SET</p><h1>Your seat is waiting.</h1><p>Your Luma ticket is ready.</p></div></div><TicketCard booking={ticket}/></main> : ticketRoute ? <main className="ticket-screen"><p className="service-state" role="status">{notice || 'Checking ticket access…'}</p></main> : null;

  return <div className="app-shell">{nav}{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}{ticketScreen || (myTicketsRoute ? ticketList : (route === '#/book' || previewRoute) && show ? bookScreen : route === '#/book' ? bookScreen : homeScreen)}</div>;
}

function TicketCard({ booking }: { booking: Booking }) {
  const movie = filmFor(booking.movieId);
  const auditorium = halls[booking.show.hallId];
  return <article className="ticket-card"><div className="ticket-art"><img src={movie.image} alt=""/><div><p className="eyebrow">LUMA CINEMA · ANKARA</p><h2>{movie.title}</h2><span>{dateLabel(booking.show.date)} · {booking.show.time}</span></div></div><div className="ticket-data"><div><span>AUDITORIUM</span><strong>{auditorium.name} · {auditorium.format}</strong></div><div><span>YOUR SEAT</span><strong>{booking.seatId}</strong></div><div><span>PRICE</span><strong>{money(booking.show.price)}</strong></div><div><span>BOOKING REFERENCE</span><strong>{booking.id}</strong></div></div><div className="ticket-bottom"><span>▥ ▥ ▥ ▥ ▥ ▥ ▥ ▥</span><span>DEMO TICKET · NO PAYMENT</span></div></article>;
}
