# Luma Cinema

**See the screen from your seat before you book.**

Luma Cinema is an interactive 3D cinema booking demo set in Ankara. Choose a movie and a showtime, pick a seat, and follow the camera from the overhead map down to eye level. You can compare the view from the front corner with one from the back row before deciding where to sit.

**[Try the live demo](https://faresfadly1.github.io/luma-cinema/) · [Explore the booking experience](https://faresfadly1.github.io/luma-cinema/#/book)**

## Try it in a minute

1. Choose **Distant Sun** and select a **Standard** or **IMAX** showtime.
2. Pick an available seat near the front and to one side. Press **Continue** to see the auditorium from that seat.
3. Choose **Change seat** and try a central seat farther back. Watch how the screen takes up less of your field of view and how more rows appear in front of you.
4. Book the seat you prefer. You can reopen your demo ticket under **My tickets**.

The catalog includes three fictional films: *Distant Sun*, *Night Ferry*, and *Blue Hour*. Showtimes use Istanbul local time, prices are in Turkish lira, and bookings are free to try.

## How the seat preview works

The seat map, camera, and measurements all use the same [auditorium geometry](config/auditoriums.json). Each hall defines its screen dimensions and orientation, seat positions, and row elevations. When you select a seat, the camera moves to its calculated eye point. That same point determines the three measurements beneath the preview.

| **Measurement**              | **What it means**                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Distance to screen**       | The straight-line distance from your eye point to the center of the screen, in meters.                                                    |
| **Horizontal viewing angle** | The angle between the left and right edges of the screen as seen from your seat. A larger angle means the screen fills more of your view. |
| **Lateral offset**           | How far your seat sits to the left or right of the screen’s centerline, in meters.                                                        |

The Standard and IMAX demo halls have separate configurations. Both use **simulated dimensions**, with one 3D unit equal to one meter and an assumed eye height of 1.15 m above the seat position. Devices without WebGL can display a simplified perspective preview.

## Booking modes

| **Mode**            | **How it works**                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Browser demo**    | Bookings stay in local browser storage. You can reload the page and reopen your tickets in the same browser. |
| **Shared bookings** | The optional Express API stores bookings in PostgreSQL and shares seat availability across visitors.         |

## Explore the code

- [Auditorium configuration](config/auditoriums.json) — screen dimensions, row elevations, and seat layouts.
- [Seat geometry](src/geometry.ts) — calculations behind the distance, viewing angle, and offset.
- [3D preview](src/CinemaPreview.tsx) — the auditorium scene and the camera transition from map to seat.
- [Geometry tests](src/geometry.test.ts) — checks for known distances, mirrored seats, and screen orientation.
- [Booking API](server/) — server-side booking and persistence.
