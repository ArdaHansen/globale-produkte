(function(){
  const items = Array.from(document.querySelectorAll('[data-tl-item]'));
  const dots = Array.from(document.querySelectorAll('[data-tl-dot]'));
  const onScroll = () => {
    const y = window.scrollY + window.innerHeight*0.35;
    let active = 0;
    for (let i=0;i<items.length;i++){
      const r = items[i].getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (top <= y) active = i;
    }
    dots.forEach((d,i)=>d.classList.toggle('is-active', i===active));
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();
