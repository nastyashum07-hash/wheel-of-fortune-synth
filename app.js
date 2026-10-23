// Illustration loading, introduction and startup.
document
  .querySelectorAll(".cloud")
  .forEach((e) => e.classList.add("intro-cloud"));
// Explicit source rectangles prevent neighbouring atlas cells from clipping characters.
const regions = {
  angel: [0, 0, 418, 420],
  eagle: [425, 0, 410, 407],
  bull: [837, 40, 417, 356],
  lion: [0, 425, 420, 382],
  snake: [540, 418, 205, 420],
  anubis: [835, 417, 410, 395],
  sphinx: [0, 807, 418, 420],
  cloud: [429, 843, 405, 379],
};
for (const [name, box] of Object.entries(regions))
  document.querySelectorAll("." + name + "-art").forEach((el) => {
    const clip =
      "sprite-clip-" + name + "-" + Math.random().toString(36).slice(2);
    el.innerHTML = `<svg viewBox="${box.join(" ")}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><clipPath id="${clip}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"/></clipPath></defs><image href="assets/atlas.png" x="0" y="0" width="1254" height="1254" clip-path="url(#${clip})"/></svg>`;
  });
const introPhrase = "My secrets are the reward for your courage.";
function revealInstrument() {
  document.body.classList.add("ready");
  setTimeout(() => {
    $("#intro")?.remove();
    document
      .querySelectorAll(".intro-cloud")
      .forEach((el) => el.classList.remove("intro-cloud"));
  }, 1600);
}
function revealIntro() {
  const text = $("#introText");
  text.lang = "en";
  text.textContent = introPhrase;
  setTimeout(() => text.classList.add("revealing"), 1400);
  setTimeout(revealInstrument, 5200);
}
let im = new Image();
im.src = "assets/atlas.png";
im.decode()
  .then(revealIntro)
  .catch(() => {
    revealInstrument();
    notice("Не удалось загрузить иллюстрации. Обнови страницу.");
  });
sync();
