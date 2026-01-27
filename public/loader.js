(function(){
  const DURATION = 3000; // 3 Sekunden
  const loader = document.getElementById("siteLoader");
  const fill = document.getElementById("loaderFill");
  const plane = document.getElementById("loaderPlane");
  const label = document.getElementById("loaderLabel");

  if(!loader || !fill || !plane || !label) return;

// Only show once per browser session (not between pages)
try{
  const KEY = "gp_loader_seen_session";
  if(sessionStorage.getItem(KEY) === "1"){
    loader.classList.add("is-done");
    loader.setAttribute("aria-hidden","true");
    return;
  }
  sessionStorage.setItem(KEY, "1");
}catch(e){}


  const fruits = ["🍌","🍍","🍎","🍓","🥑","🍇","🍊","🍋","🥕","🥦","🫘","🍅","🥭"];
  const start = performance.now();

  function spawnFruit(x, y){
    const el = document.createElement("div");
    el.className = "fruit";
    el.textContent = fruits[Math.floor(Math.random() * fruits.length)];

    // random flight vector
    const dx = (Math.random() * 160 - 80).toFixed(1) + "px";
    const dy = (-(Math.random() * 160 + 60)).toFixed(1) + "px";
    const rot = (Math.random() * 220 - 110).toFixed(0) + "deg";

    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--dx", dx);
    el.style.setProperty("--dy", dy);
    el.style.setProperty("--rot", rot);
    el.style.animation = "fruitFly 850ms ease-out forwards";

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  let lastFruitAt = 0;

  function frame(now){
    const t = Math.min(1, (now - start) / DURATION);
    const pct = Math.round(t * 100);

    fill.style.width = pct + "%";
    plane.style.left = pct + "%";
    label.textContent = "Lädt… " + pct + "%";

    // spawn fruits near plane occasionally
    if(now - lastFruitAt > 130){
      lastFruitAt = now;
      const rect = plane.getBoundingClientRect();
      spawnFruit(rect.left + rect.width/2, rect.top + rect.height/2);
      if(Math.random() > 0.55){
        spawnFruit(rect.left + rect.width/2, rect.top + rect.height/2);
      }
    }

    if(t < 1){
      requestAnimationFrame(frame);
    }else{
      label.textContent = "Fertig ✔";
      // hide after a short beat
      setTimeout(() => loader.classList.add("is-done"), 220);
    }
  }

  // Prevent scroll while loading
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  requestAnimationFrame(frame);

  setTimeout(() => {
    document.documentElement.style.overflow = prevOverflow || "";
  }, DURATION + 450);
})();