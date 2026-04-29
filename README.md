# Dr Indu Child Care Frontend

Frontend for the clinic dashboard, built with Vite + React.

For detailed project requirements, see the [Software Requirements Specification (SRS)](SRS.md).

## Deploy on Vercel

1. Import this repository into Vercel.
2. In project settings, set **Root Directory** to `frontend`.
3. Use these build settings:
   - Framework Preset: `Vite`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variable:
   - `VITE_API_BASE_URL=https://api-vfbnzo4maa-uc.a.run.app/api`
5. Redeploy.

## Why this works

- The app uses React Router, and `frontend/vercel.json` rewrites all routes to `index.html`.
- API calls are made from `src/api/index.js` using `VITE_API_BASE_URL`.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Local app URL: `http://127.0.0.1:3000/`

## Troubleshooting on Vercel

- If direct route refresh gives 404, confirm project root is `frontend` so `frontend/vercel.json` is applied.
- If login/API fails, verify `VITE_API_BASE_URL` is set and ends with `/api`.
- After changing env vars, trigger a fresh redeploy.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
