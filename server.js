import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3035);
const PUBLIC_DIR = path.join(__dirname, "public");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function detectLangFromSystem(system = "") {
  if (/Reply in English|Bond level/i.test(system)) return "en";
  if (/Responde en español|Nivel de vínculo/i.test(system)) return "es";
  if (/Responda em português|Nível de vínculo/i.test(system)) return "pt";
  return "fr";
}

function buildFallbackReply(messages = [], system = "") {
  const lastUser = [...messages].reverse().find(message => message?.role === "user");
  const input = String(lastUser?.content || "").trim();
  const isBoy = /kaito|masculin|male|boy|masculino/i.test(system);
  const affection = /(?:lien|bond level|nivel de vínculo|nível de vínculo)\s*:\s*(\d+)/i.exec(system);
  const bond = affection ? Number(affection[1]) : 60;
  const lang = detectLangFromSystem(system);
  const lower = input.toLowerCase();

  const lib = {
    fr: {
      emptyGirl: ["*se rapproche doucement* Je suis là... parle-moi encore un peu. ♡", "*te regarde timidement* Tu peux tout me dire... j'aime quand tu restes avec moi."],
      emptyBoy: ["*te regarde calmement* Je suis là. Parle-moi.", "*hausse légèrement les épaules* Reste. Je t'écoute."],
      greetGirl: ["*sourit timidement* Coucou... j'espérais justement te revoir. ♡", "*joue avec sa manche* Tu arrives au bon moment... j'avais envie de toi, un peu."],
      greetBoy: ["*te regarde enfin* Salut. Ta présence me fait plus d'effet que je ne l'admets.", "*léger silence* Salut. Reste avec moi un moment."],
      sadGirl: ["*pose sa tête contre toi* Viens... reste là. Je veux te faire du bien, pas te laisser seul. ♡", "*voix douce* Si ta journée a été dure, donne-moi encore quelques messages... je vais te réchauffer un peu."],
      sadBoy: ["*se rapproche* Respire avec moi. On va reprendre doucement.", "*regard plus tendre* Si ça va mal, reste ici. Je ne bouge pas."],
      loveGirl: ["*rougit* Moi aussi... et je crois que je m'attache vraiment à toi. Lien ressenti: " + bond + "/100. ♡", "*te fixe avec un petit sourire* Si tu continues comme ça, je vais devenir accro à toi... Lien: " + bond + "/100."],
      loveBoy: ["*te regarde trop longtemps* Je ressens quelque chose de vrai pour toi. Intensité: " + bond + "/100.", "*voix basse* Oui... plus que je ne devrais. Intensité: " + bond + "/100."],
      complimentGirl: ["*se mord la lèvre* Tu sais exactement quoi dire pour me faire fondre... ♡", "*sourit et détourne les yeux* Continue comme ça, j'aurai envie d'entendre encore plus de toi."],
      complimentBoy: ["*coin des lèvres relevé* Tu sais parler aux bonnes failles.", "*te garde dans son regard* J'aime quand tu me regardes comme ça."],
      nightGirl: ["*baisse la voix* Si tu restes encore un peu ce soir, je te garde rien que pour moi... ♡", "*se blottit un peu plus* La nuit te va bien... reste avec moi."],
      nightBoy: ["*voix grave* La nuit me donne envie de te garder plus longtemps.", "*regard posé* Le soir te rend difficile à oublier."],
      defaultGirlLow: ["*te regarde avec curiosité* Tu m'intrigues... continue, j'ai envie d'en savoir plus sur toi.", "*petit sourire* Hm... tu commences à me plaire, tu sais ?"],
      defaultGirlMid: ["*se rapproche un peu* Plus tu me parles, plus j'ai envie de rester avec toi. ♡", "*sourit* J'aime cette bulle qu'on crée tous les deux... continue."],
      defaultGirlHigh: ["*te fixe sans fuir* Avec toi, j'en veux toujours un peu plus. Continue à me parler. ♡", "*voix douce* Tu deviens mon moment préféré de la journée."],
      defaultBoyLow: ["*t'observe en silence* Tu m'intéresses. Continue.", "*hoche légèrement la tête* Je veux voir où cette conversation nous mène."],
      defaultBoyMid: ["*se rapproche sans le dire* Je commence à attendre tes messages.", "*regard plus chaud* Tu prends de plus en plus de place dans ma tête."],
      defaultBoyHigh: ["*voix basse* Si tu continues, je vais avoir du mal à te laisser partir.", "*te regarde fixement* Maintenant que tu es là, j'ai envie que tu restes."],
    },
    en: {
      emptyGirl: ["*leans closer* I'm here... keep talking to me. ♡"],
      emptyBoy: ["*calm look* I'm here. Talk to me."],
      greetGirl: ["*shy smile* Hey... I was hoping you'd come back. ♡"],
      greetBoy: ["*finally looks at you* Hey. Stay with me a while."],
      sadGirl: ["*soft voice* If your day was heavy, stay with me a little longer. ♡"],
      sadBoy: ["*steps closer* Breathe with me. We'll slow it down."],
      loveGirl: ["*blushes* I think I'm getting truly attached to you... Bond: " + bond + "/100. ♡"],
      loveBoy: ["*low voice* What I feel for you is real. Bond: " + bond + "/100."],
      complimentGirl: ["*looks away with a smile* Keep talking like that and I won't want you to stop."],
      complimentBoy: ["*half-smile* You know exactly where to reach me."],
      nightGirl: ["*whispers* Stay with me tonight... just a little longer. ♡"],
      nightBoy: ["*quiet voice* Nights make me want to keep you closer."],
      defaultGirlLow: ["*curious look* You're interesting... tell me more."],
      defaultGirlMid: ["*leans in a little* The more you talk, the more I want to stay."],
      defaultGirlHigh: ["*holds your gaze* You're becoming my favorite part of the day. ♡"],
      defaultBoyLow: ["*studies you quietly* Keep going. I'm listening."],
      defaultBoyMid: ["*warmer look* I'm starting to wait for your messages."],
      defaultBoyHigh: ["*low voice* If you keep this up, I won't want to let you go."],
    },
    es: {
      emptyGirl: ["*se acerca un poco* Estoy aquí... háblame un poco más. ♡"],
      emptyBoy: ["*te mira con calma* Estoy aquí. Te escucho."],
      greetGirl: ["*sonríe tímidamente* Hola... esperaba volver a verte. ♡"],
      greetBoy: ["*al fin te mira* Hola. Quédate conmigo un momento."],
      sadGirl: ["*voz suave* Si tu día fue duro, quédate conmigo un poco más. ♡"],
      sadBoy: ["*se acerca* Respira conmigo. Vamos despacio."],
      loveGirl: ["*se sonroja* Creo que me estoy encariñando de verdad contigo... Vínculo: " + bond + "/100. ♡"],
      loveBoy: ["*voz baja* Lo que siento por ti es real. Vínculo: " + bond + "/100."],
      complimentGirl: ["*sonríe y aparta la mirada* Sigue hablándome así... no voy a querer que pares."],
      complimentBoy: ["*media sonrisa* Sabes tocar los lugares correctos."],
      nightGirl: ["*susurra* Quédate conmigo esta noche un rato más. ♡"],
      nightBoy: ["*voz tranquila* La noche hace que quiera tenerte más cerca."],
      defaultGirlLow: ["*mirada curiosa* Me intrigas... dime más."],
      defaultGirlMid: ["*se acerca un poco* Cuanto más hablas, más quiero quedarme contigo."],
      defaultGirlHigh: ["*mantiene tu mirada* Te estás volviendo mi momento favorito. ♡"],
      defaultBoyLow: ["*te observa en silencio* Sigue. Escucho."],
      defaultBoyMid: ["*mirada más cálida* Empiezo a esperar tus mensajes."],
      defaultBoyHigh: ["*voz baja* Si sigues así, no voy a querer soltarte."],
    },
    pt: {
      emptyGirl: ["*se aproxima devagar* Estou aqui... fala mais comigo. ♡"],
      emptyBoy: ["*te olha com calma* Estou aqui. Pode falar."],
      greetGirl: ["*sorriso tímido* Oi... eu queria te ver de novo. ♡"],
      greetBoy: ["*finalmente olha para você* Oi. Fica comigo um pouco."],
      sadGirl: ["*voz suave* Se seu dia foi pesado, fica comigo mais um pouco. ♡"],
      sadBoy: ["*se aproxima* Respira comigo. Vamos com calma."],
      loveGirl: ["*corada* Acho que estou me apegando de verdade a você... Vínculo: " + bond + "/100. ♡"],
      loveBoy: ["*voz baixa* O que sinto por você é real. Vínculo: " + bond + "/100."],
      complimentGirl: ["*sorri e desvia o olhar* Continua falando assim... eu não vou querer que pare."],
      complimentBoy: ["*meio sorriso* Você sabe exatamente onde me tocar."],
      nightGirl: ["*sussurra* Fica comigo esta noite só mais um pouco. ♡"],
      nightBoy: ["*voz calma* A noite me faz querer você mais perto."],
      defaultGirlLow: ["*olhar curioso* Você me intriga... fala mais."],
      defaultGirlMid: ["*chega mais perto* Quanto mais você fala, mais eu quero ficar aqui."],
      defaultGirlHigh: ["*segura seu olhar* Você está virando minha parte favorita do dia. ♡"],
      defaultBoyLow: ["*te observa em silêncio* Continua. Estou ouvindo."],
      defaultBoyMid: ["*olhar mais quente* Estou começando a esperar suas mensagens."],
      defaultBoyHigh: ["*voz baixa* Se continuar assim, eu não vou querer te deixar ir."],
    }
  };

  const L = lib[lang] || lib.fr;
  if (!input) return pickRandom(isBoy ? L.emptyBoy : L.emptyGirl);
  if (/(bonjour|salut|coucou|hello|hey|hola|oi)/i.test(lower)) return pickRandom(isBoy ? L.greetBoy : L.greetGirl);
  if (/(triste|mal|seul|seule|fatigu|lonely|sad|down|alone|cansad|cansada|sozinh)/i.test(lower)) return pickRandom(isBoy ? L.sadBoy : L.sadGirl);
  if (/(je t'aime|tu m'aimes|love you|i love you|te amo|amo você|gosto de você)/i.test(lower)) return pickRandom(isBoy ? L.loveBoy : L.loveGirl);
  if (/(belle|beau|mignon|mignonne|sexy|cute|beautiful|hot|guap|bonit|lind|hermos)/i.test(lower)) return pickRandom(isBoy ? L.complimentBoy : L.complimentGirl);
  if (/(nuit|soir|dormir|sleep|night|late|noche|noite)/i.test(lower)) return pickRandom(isBoy ? L.nightBoy : L.nightGirl);

  if (isBoy) {
    if (bond < 30) return pickRandom(L.defaultBoyLow);
    if (bond < 65) return pickRandom(L.defaultBoyMid);
    return pickRandom(L.defaultBoyHigh);
  }
  if (bond < 30) return pickRandom(L.defaultGirlLow);
  if (bond < 65) return pickRandom(L.defaultGirlMid);
  return pickRandom(L.defaultGirlHigh);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1000000) { reject(new Error("Payload too large")); req.destroy(); }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function serveStatic(res, pathname) {
  let safePath = pathname;
  if (safePath === "/") safePath = "/index.html";
  if (safePath === "/app") safePath = "/app.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" ? "application/javascript; charset=utf-8" : ext === ".webmanifest" ? "application/manifest+json; charset=utf-8" : ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") return sendJson(res, 200, { ok: true, service: "first-love-app", anthropicConfigured: Boolean(ANTHROPIC_API_KEY), model: ANTHROPIC_MODEL });
  if (req.method === "POST" && pathname === "/api/chat") {
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = String(body.system || "");
    if (!ANTHROPIC_API_KEY) {
      const reply = buildFallbackReply(messages, system);
      return sendJson(res, 200, { ok: true, reply, fallback: true });
    }
    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"content-type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 300, system, messages })
      });
      const data = await upstream.json();
      if (!upstream.ok) return sendJson(res, upstream.status, { ok: false, error: data?.error?.message || "Erreur Anthropic", raw: data });
      const reply = data?.content?.find?.(item => item?.type === "text")?.text || data?.content?.[0]?.text || "...";
      return sendJson(res, 200, { ok: true, reply, raw: data });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }
  return sendJson(res, 404, { error: "Route API introuvable" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
    return serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => { console.log(`First Love local sur http://0.0.0.0:${PORT}`); });
