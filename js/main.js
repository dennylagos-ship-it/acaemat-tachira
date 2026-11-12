/* =========================================================================
   ACAEMAT Táchira — Sitio público (diseño "monitor clínico")
   Patrón IIFE, cada init protegido con safe(): si uno falla, el resto sigue.
   ========================================================================= */
(function () {
  "use strict";
  var A = window.ACAEMAT, CFG = window.ACAEMAT_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var hoverable = window.matchMedia("(hover: hover)").matches;

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[ACAEMAT] " + name, e); } }
  function published() { return A.db().courses.filter(function (c) { return c.published; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* Arranque con doble red de seguridad (CSS a los 4,5 s + JS) */
  function initSplash() {
    var s = $("[data-splash]"); if (!s) return;
    var hide = function () { s.classList.add("is-out"); };
    if (document.readyState === "complete") setTimeout(hide, 700);
    else window.addEventListener("load", function () { setTimeout(hide, 600); });
    setTimeout(hide, 3600);
  }

  /* Cabecera */
  function initNav() {
    var nav = $("[data-nav]"), burger = $("[data-burger]");
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    burger.addEventListener("click", function () {
      var o = nav.classList.toggle("is-open"); burger.setAttribute("aria-expanded", o);
    });
    $$(".menu a").forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); }); });
  }

  /* Cifras reales del catálogo, con conteo animado */
  function initStats() {
    var list = published();
    var data = { programs: list.length, hours: list.reduce(function (s, c) { return s + (+c.hours || 0); }, 0) };
    $$("[data-count]").forEach(function (el) {
      var to = data[el.getAttribute("data-count")]; if (to == null) return;
      el.textContent = to;
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; io.disconnect();
        var t0 = performance.now(), dur = 1500;
        (function tick(t) {
          var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(tick);
        })(t0);
      }, { threshold: 0.01 });
      io.observe(el);
    });
  }

  /* Monitor: frecuencia cardíaca que oscila como un monitor real */
  function initMonitor() {
    var hr = $("[data-hr]"); if (!hr) return;
    var v = 72;
    setInterval(function () {
      v = Math.max(68, Math.min(78, v + Math.round(Math.random() * 4 - 2)));
      hr.textContent = v;
    }, 1600);
    // El escudo se inclina ligeramente con el puntero
    if (!hoverable) return;
    var mon = $("[data-seal]"), img = $(".mon-logo img", mon);
    mon.addEventListener("pointermove", function (e) {
      var r = mon.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      img.style.transform = "perspective(600px) rotateY(" + x * 16 + "deg) rotateX(" + (-y * 16) + "deg)";
    });
    mon.addEventListener("pointerleave", function () { img.style.transform = ""; });
  }

  /* Catálogo como tabla clínica */
  function rowHTML(c, i) {
    return '<article class="row" role="listitem" tabindex="0" data-id="' + c.id + '" data-cat="' + A.esc(c.category) + '" style="--c:' + (c.color || "#12307A") + '" aria-label="Ver programa ' + A.esc(c.title) + '">' +
      '<span class="r-n">' + pad(i + 1) + "</span>" +
      '<span class="r-i">' + A.icon(c.icon) + "</span>" +
      '<span class="r-t"><b>' + A.esc(c.title) + "</b><small>" + A.esc(c.summary) + "</small></span>" +
      '<span class="r-a">' + A.esc(c.category) + "</span>" +
      '<span class="r-m">' + A.esc(c.modality) + " · " + A.esc(c.level) + "</span>" +
      '<span class="r-h">' + c.hours + " h</span>" +
      '<span class="r-go" aria-hidden="true">→</span>' +
      (c.featured ? '<span class="r-flag">Destacado</span>' : "") +
      "</article>";
  }
  function initCatalog() {
    var grid = $("[data-course-grid]"), filters = $("[data-filters]");
    var list = published().sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    grid.innerHTML = '<div class="thead" aria-hidden="true"><span>N.º</span><span></span><span>Programa</span><span>Área</span><span>Modalidad</span><span>Duración</span><span></span></div>' + list.map(rowHTML).join("");

    var cats = {}; list.forEach(function (c) { cats[c.category] = (cats[c.category] || 0) + 1; });
    var chips = [["Todos", list.length]].concat(Object.keys(cats).map(function (k) { return [k, cats[k]]; }));
    filters.innerHTML = chips.map(function (c, i) {
      return '<button class="seg-b" role="tab" aria-selected="' + (i === 0) + '" data-f="' + A.esc(c[0]) + '">' + A.esc(c[0]) + "<sup>" + c[1] + "</sup></button>";
    }).join("");
    filters.addEventListener("click", function (e) {
      var b = e.target.closest(".seg-b"); if (!b) return;
      $$(".seg-b", filters).forEach(function (x) { x.setAttribute("aria-selected", x === b); });
      var f = b.getAttribute("data-f"), n = 0;
      $$(".row", grid).forEach(function (r) {
        var show = f === "Todos" || r.getAttribute("data-cat") === f;
        r.classList.toggle("is-hidden", !show);
        if (show) { n++; $(".r-n", r).textContent = pad(n); r.classList.add("is-visible"); }
      });
    });

    grid.addEventListener("click", function (e) { var r = e.target.closest(".row[data-id]"); if (r) openCourse(r.getAttribute("data-id")); });
    grid.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var r = e.target.closest(".row[data-id]"); if (r) { e.preventDefault(); openCourse(r.getAttribute("data-id")); }
    });

    var sel = $("[data-course-select]");
    sel.innerHTML = '<option value="">Aún no lo decido</option>' + list.map(function (c) { return '<option value="' + c.id + '">' + A.esc(c.title) + "</option>"; }).join("");
  }

  /* Ficha del programa en panel lateral */
  function openCourse(id) {
    var c = A.courseById(id); if (!c) return;
    var dlg = $("[data-dialog]"), body = $("[data-dialog-body]");
    var lessons = 0; c.modules.forEach(function (m) { lessons += m.lessons.length; });
    body.innerHTML =
      '<div class="dr-head" style="--c:' + (c.color || "#12307A") + '" data-cover="' + A.esc(c.coverId || "") + '">' +
        '<button class="dr-close" data-close aria-label="Cerrar">✕</button>' +
        '<span class="dr-cat">' + A.esc(c.category) + "</span>" +
        '<span class="dr-ico">' + A.icon(c.icon) + "</span>" +
        "<h2>" + A.esc(c.title) + "</h2>" +
      "</div>" +
      '<dl class="dr-facts">' +
        "<div><dt>Duración</dt><dd>" + c.hours + " h</dd></div>" +
        "<div><dt>Modalidad</dt><dd>" + A.esc(c.modality) + "</dd></div>" +
        "<div><dt>Nivel</dt><dd>" + A.esc(c.level) + "</dd></div>" +
        "<div><dt>Módulos</dt><dd>" + c.modules.length + "</dd></div>" +
      "</dl>" +
      '<div class="dr-body">' +
        "<p>" + A.esc(c.description) + "</p>" +
        '<h3>Contenido programático <small>' + lessons + " lecciones</small></h3>" +
        '<ol class="dr-mods">' + c.modules.map(function (m, i) {
          return "<li><details" + (i === 0 ? " open" : "") + "><summary><b>" + pad(i + 1) + "</b>" + A.esc(m.title) + "</summary><ul>" +
            m.lessons.map(function (l) { return "<li>" + A.esc(l.title) + " <small>" + A.KIND[l.kind] + "</small></li>"; }).join("") + "</ul></details></li>";
        }).join("") + "</ol>" +
      "</div>" +
      '<div class="dr-actions"><a class="b b-line" href="aula.html#/curso/' + c.id + '">Ver en el aula</a><button class="b b-red" data-pick="' + c.id + '">Solicitar inscripción →</button></div>';
    A.hydrateCovers(body);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function initDialog() {
    var dlg = $("[data-dialog]");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
      var pick = e.target.closest("[data-pick]");
      if (pick) {
        dlg.close();
        $("[data-course-select]").value = pick.getAttribute("data-pick");
        $("#inscripcion").scrollIntoView({ behavior: "smooth" });
        setTimeout(function () { $("[data-enroll] [name=name]").focus({ preventScroll: true }); }, 700);
      }
    });
  }

  /* Inscripción → solicitud en el panel + WhatsApp */
  function initForm() {
    var f = $("[data-enroll]"), ok = $("[data-ok]");
    $("[data-wa]").href = A.waLink("Hola ACAEMAT Táchira, quisiera información sobre sus programas.");
    $$("[data-hours]").forEach(function (el) { el.textContent = CFG.brand.hours; });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(f).entries()), bad = false;
      ["name", "phone"].forEach(function (k) {
        var el = f.elements[k], v = (d[k] || "").trim(), invalid = !v || (k === "phone" && v.replace(/\D/g, "").length < 10);
        el.classList.toggle("invalid", invalid); if (invalid) bad = true;
      });
      if (bad) { A.toast("Revise nombre y teléfono.", "err"); return; }
      A.addLead(d);
      var c = A.courseById(d.courseId);
      var msg = "Hola ACAEMAT Táchira, soy " + d.name.trim() + ". Quiero inscribirme" + (c ? " en «" + c.title + "»" : "") + ". Mi teléfono: " + d.phone + (d.message ? ". " + d.message : "");
      ok.hidden = false;
      setTimeout(function () { window.open(A.waLink(msg), "_blank", "noopener"); }, 900);
      setTimeout(function () { ok.hidden = true; f.reset(); }, 7000);
    });
  }

  /* Entrada del titular */
  function initHeroIntro() {
    if (!window.gsap) return;
    gsap.from("[data-hero-title] .ln > span", { yPercent: 105, duration: 1.1, stagger: 0.1, ease: "expo.out", delay: 0.75, clearProps: "transform" });
    gsap.from(".hero .tag, .hero-foot", { y: 20, opacity: 0, duration: 0.9, stagger: 0.12, ease: "expo.out", delay: 1, clearProps: "all" });
    gsap.from(".monitor", { x: 40, opacity: 0, duration: 1.2, ease: "expo.out", delay: 0.85, clearProps: "all" });
  }

  /* Revelado al hacer scroll (umbral bajo + red de seguridad a los 6 s) */
  function initReveal() {
    $$(".sec-head, .flow li, .peek, .cred, .quick-verify, .enroll-copy, .form, .row").forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });
    $$(".reveal").forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 60 + "ms"; io.observe(el); });
    setTimeout(function () { $$(".reveal:not(.is-visible)").forEach(function (el) { el.classList.add("is-visible"); }); }, 6000);

    // Barra y porcentaje de la vista del aula
    var bar = $("[data-demo-bar]"), pct = $("[data-count-pct]");
    if (bar) new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return; o.disconnect();
      bar.style.width = "38%";
      var t0 = performance.now();
      (function tick(t) { var p = Math.min(1, (t - t0) / 1400); pct.textContent = Math.round(38 * (1 - Math.pow(1 - p, 3))) + "%"; if (p < 1) requestAnimationFrame(tick); })(t0);
    }, { threshold: 0.05 }).observe(bar);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.documentElement.classList.remove("no-js");
    $("[data-year]").textContent = new Date().getFullYear();
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initCatalog, "catalog");
    safe(initStats, "stats");
    safe(initMonitor, "monitor");
    safe(initDialog, "dialog");
    safe(initForm, "form");
    safe(initHeroIntro, "hero");
    safe(initReveal, "reveal");
  });
})();
