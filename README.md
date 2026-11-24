# Luma Cinema

A responsive cinema booking demo built with React, TypeScript, Vite, Three.js, Express, and PostgreSQL. The static frontend works without an API using local browser storage. Configure the API to enable shared availability, server-side pricing, protected ticket reads, and race-safe booking persistence.

All venue geometry in this repository is illustrative simulated data. Luma Standard 1 and Luma IMAX 1 are virtual demo halls, not real cinema claims. Units are meters; one Three.js unit equals one meter. The assumed seated-eye offset is 1.15 m above the seat position. See `config/auditoriums.json` before editing hall measurements.

## Local setup

Requirements: Node.js 20+ and npm. PostgreSQL is optional for the visual/local demo and required for the API-backed booking path.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Without `VITE_API_URL`, demo bookings stay in the browser's local storage and are not shared between visitors.

## PostgreSQL-backed API

Create a database and copy the environment template:

```sh
createdb luma_cinema
cp .env.example .env
```

Set `DATABASE_URL` in `.env`, then run migrations and seed data, and start the API:

```sh
npm run db:migrate
npm run db:seed
npm run api:dev
```

The default API listens on port 8787. In another shell, set the API URL for Vite:

```sh
VITE_API_URL=http://localhost:8787 npm run dev
```

Seed data includes three fictional films, two virtual halls, and upcoming showtimes in Europe/Istanbul. Re-run the seed command to refresh the upcoming schedule. The visitor token is generated in the browser and sent in the `x-visitor-token` header. It is a demo ownership mechanism, not account authentication. Ticket reads only return records associated with that visitor token.

The unique database constraint on `(showtime_id, seat_id)` is the final concurrency guard. Simultaneous requests for a seat can produce one success and one HTTP 409 conflict. Clients refresh availability after the conflict.

## Geometry and preview

`config/auditoriums.json` stores the hall dimensions and each row's explicit seat x positions, depth, and elevation. Rows can use custom measured seat coordinates through the optional `seats` list, with an independent x/y/z point and facing yaw for each seat. The map groups those individual positions and derives aisle gaps from their spacing, so curved rows, uneven spacing, varying elevations, and relocated aisles can be represented. The screen stores width, height, center, and yaw.

All calculations use x (left/right), y (height), and z (depth). The screen faces the seats at z=0, and seat yaw 0 faces the screen along -z. The eye point adds the documented 1.15 m seated-eye offset. Distance is the 3D Euclidean distance from eye point to screen center. Screen angle uses the rays to both screen edges. Vertical angle describes the elevation to screen center; turn angle describes the horizontal turn from the seat's facing direction.

To replace simulated data with a real hall, obtain a venue-approved survey or measurement set, record its source and date, and set `verified` only after validation. Update units, screen center/dimensions/orientation, every seat position/elevation/yaw, and the eye-offset assumption. Apply the same measurements to each seat map configuration and set the screen orientation once; the shared geometry drives the map, measurements, and Three.js view. Do not publish venue claims until the measurements are verified. The same model drives the 2D seat map, measurements, and Three.js view.

## Commands

```sh
npm run build          # Type check and create dist/
npm run test:geometry  # Geometry known-coordinate and symmetry checks
npm run api:build      # Compile the Node API
npm run preview        # Preview the production frontend build
```

## Deployment

### GitHub Pages frontend

The included Actions workflow builds `dist/` and deploys it to GitHub Pages on pushes to `main`. The Vite base path is configured as `/luma-cinema/` in Actions builds; change `vite.config.ts` if the repository name changes. The app uses hash routes so refreshes and direct ticket links work under a project path. In repository Settings → Pages, select GitHub Actions as the build and deployment source.

### API and database

Deploy `server/` to a Node.js host that supports persistent processes (for example, Render, Fly.io, or Railway) and provision hosted PostgreSQL. Set `DATABASE_URL`, `DATABASE_SSL` when required, and `PORT` in the host's secret environment settings. Run `npm run db:migrate` and `npm run db:seed` once against that database. Set the frontend build variable `VITE_API_URL` to the deployed API origin and redeploy Pages. Keep database credentials only in the API host's environment; never place them in frontend variables or commit `.env`.

## Accessibility and fallback

Seat buttons expose row, seat number, and availability to assistive technology. Keyboard focus is visible. If WebGL cannot initialize, the booking map and geometry measurements remain usable, and the preview displays a clear unavailable message.
