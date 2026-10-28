// Vérification de configuration SasPay. Usage : node --env-file=.env.local scripts/check-saspay.mjs
// Ne lit aucune donnée utilisateur et n'affiche jamais la clé.
const base = process.env.SASPAY_API_BASE_URL ?? "https://api.saspay.me/api/v1";
const key = process.env.SASPAY_API_KEY;
const ok = (m) => console.log("OK     " + m), ko = (m) => { console.log("ÉCHEC  " + m); process.exitCode = 1; };

if (!key) ko("SASPAY_API_KEY manquante"); else key.startsWith("sk_test_") ? ok("clé de test (sk_test_)") : key.startsWith("sk_live_") ? console.log("ATTENTION clé de PRODUCTION (sk_live_) : utilisez sk_test_ pour les essais") : ko("format de clé inattendu");
process.env.SASPAY_WEBHOOK_SECRET ? ok("SASPAY_WEBHOOK_SECRET présent") : ko("SASPAY_WEBHOOK_SECRET manquant (signing_secret du tableau de bord)");
process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") || process.env.NEXT_PUBLIC_APP_URL?.startsWith("http://localhost") ? ok("NEXT_PUBLIC_APP_URL = " + process.env.NEXT_PUBLIC_APP_URL) : ko("NEXT_PUBLIC_APP_URL invalide");

async function get(path, auth) {
  const res = await fetch(base + path, { headers: auth ? { Authorization: `Bearer ${key}` } : {} });
  if (res.status === 429) { ko(`${path} : 429, réessayez plus tard`); return null; }
  const json = await res.json().catch(() => null);
  if (!res.ok) { ko(`${path} : HTTP ${res.status}`); return null; }
  return json?.data ?? json;
}
const countries = await get("/countries/", false);
if (countries) {
  const list = countries.results ?? countries;
  const cd = JSON.stringify(list).includes('"CD"');
  cd ? ok("GET /countries/ : la RDC (CD) est listée") : ko("GET /countries/ : RDC (CD) introuvable");
}
if (key) {
  const rates = await get("/pricing/my-rates/", true);
  if (rates) {
    ok("GET /pricing/my-rates/ : authentification valide");
    const txt = JSON.stringify(rates);
    for (const code of ["CDF", "USD"]) console.log(`INFO   devise ${code} : ${txt.includes(`"${code}"`) ? "présente dans vos tarifs" : "NON trouvée dans vos tarifs"}`);
    console.log("INFO   consultez aussi otp_required par réseau dans cette réponse avant d'activer softpay.");
  }
}
