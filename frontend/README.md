# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Deploy (Vercel + External API)

If your frontend is deployed on Vercel but backend is deployed elsewhere, set:

`VITE_API_BASE=https://lunagrid.vercel.app/`

Example:

`VITE_API_BASE=https://etl-price-cleaner-api.onrender.com`

The app will call:

- `/api/preview`
- `/api/clean`
- `/api/report/preview`
- `/api/report/clean`
- `/api/auth/*`

using the `VITE_API_BASE` prefix in production.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
