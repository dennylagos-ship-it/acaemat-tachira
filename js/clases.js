/* =========================================================================
   ACAEMAT — Clases en vivo + calendario (compartido por aula y panel)
   Cada clase: { id, courseId, title, start (ms), duration (min), platform,
                 url, notes, recording, seriesId, createdBy }
   ========================================================================= */
(function () {
  "use strict";
  var A = window.ACAEMAT;
  var MIN = 60e3, DAY = 864e5, EARLY = 10 * MIN; // se puede entrar 10 min antes

  var PLAT = {
    meet: { name: "Google Meet", hint: "Hasta 100 personas (60 min con cuenta gratuita). Para 100 estudiantes más el docente use una cuenta de Google Workspace Business Standard: hasta 150 personas, 24 h y grabación." },
    zoom: { name: "Zoom", hint: "Hasta 100 personas; las reuniones grupales gratuitas duran 40 min." },
    jitsi: { name: "Jitsi Meet", hint: "Gratis y sin cuenta. Recomendado para grupos pequeños (hasta unas 35 personas)." },
    youtube: { name: "YouTube Live", hint: "Sin límite de espectadores. Los estudiantes participan solo por el chat." },
    otra: { name: "Otra plataforma", hint: "" }
  };
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var WD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  /* ---------- datos ---------- */
  function at(days, h, m) { var x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + days); x.setHours(h, m || 0, 0, 0); return x.getTime(); }
  function room(slug) { return "https://meet.jit.si/ACAEMAT-" + String(slug || "clase").replace(/[^a-z0-9-]/gi, "").slice(0, 30) + "-" + Math.random().toString(36).slice(2, 7); }
  function demo() {
    var now = Date.now(), soon = Math.ceil((now + 95 * MIN) / (15 * MIN)) * 15 * MIN, s1 = A.uid("ser"), out = [];
    function add(o) { out.push(Object.assign({ id: A.uid("lv"), duration: 90, platform: "jitsi", notes: "", recording: "", seriesId: "", createdBy: "u-inst" }, o)); }
    add({ courseId: "c-rcp", title: "Práctica guiada de compresiones torácicas", start: soon, url: room("rcp"), notes: "Tenga a mano un cojín firme para practicar las compresiones." });
    [2, 9, 16].forEach(function (d, i) {
      add({ courseId: "c-rcp", title: "Clase en vivo · Módulo " + (i + 2), start: at(d, 18, 0), url: room("rcp-modulo"), seriesId: s1, notes: "Clase semanal: repaso del módulo y preguntas." });
    });
    add({ courseId: "c-bio", title: "Bioseguridad: dudas antes de la evaluación", start: at(4, 10, 0), duration: 60, url: room("bioseguridad") });
    add({ courseId: "c-flebo", title: "Venopunción paso a paso", start: at(3, 15, 0), url: room("flebotomia") });
    add({ courseId: "c-enf", title: "Inducción · Auxiliar de Enfermería", start: at(6, 9, 0), duration: 120, url: room("enfermeria") });
    add({ courseId: "c-rcp", title: "Clase en vivo · Módulo 1", start: at(-5, 18, 0), url: room("rcp-modulo"), seriesId: s1 });
    return out;
  }
  function all() { var db = A.db(); if (!db.live) { db.live = demo(); A.save(); } return db.live; }
  function byId(id) { return all().filter(function (c) { return c.id === id; })[0] || null; }
  function forCourses(ids) { return all().filter(function (c) { return ids.indexOf(c.courseId) >= 0; }).sort(function (a, b) { return a.start - b.start; }); }
  function upsert(c) { var l = all(), i = l.findIndex(function (x) { return x.id === c.id; }); if (i >= 0) l[i] = c; else l.push(c); A.save(); return c; }
  function remove(id, series) {
    var db = A.db(), c = byId(id);
    db.live = all().filter(function (x) { return series && c && c.seriesId ? x.seriesId !== c.seriesId : x.id !== id; });
    A.save();
  }

  /* ---------- estado y formato ---------- */
  function end(c) { return c.start + c.duration * MIN; }
  function status(c, now) {
    now = now || Date.now();
    if (now >= end(c)) return "fin";
    if (now >= c.start) return "vivo";
    if (now >= c.start - EARLY) return "pronto";
    return "prox";
  }
  function canJoin(c) { var s = status(c); return s === "vivo" || s === "pronto"; }
  function tshort(ts) { var d = new Date(ts), h = d.getHours(), m = d.getMinutes(); return ((h % 12) || 12) + (m ? ":" + (m < 10 ? "0" : "") + m : "") + (h < 12 ? "am" : "pm"); }
  function tm(ts) { return new Date(ts).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" }); }
  function dayLabel(ts) {
    var d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / DAY);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Mañana";
    if (diff === -1) return "Ayer";
    return d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, function (x) { return x.toUpperCase(); });
  }
  function until(c) {
    var ms = c.start - Date.now();
    if (ms <= 0) return "en curso";
    var m = Math.round(ms / MIN), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 1) return "en " + d + (d === 1 ? " día" : " días");
    if (h >= 1) return "en " + h + " h " + (m % 60) + " min";
    return "en " + m + " min";
  }
  function pill(c) {
    var s = status(c);
    if (s === "vivo") return '<span class="pill live-on"><i></i>En vivo</span>';
    if (s === "pronto") return '<span class="pill live-soon">Por empezar</span>';
    if (s === "fin") return '<span class="pill">' + (c.recording ? "Grabación disponible" : "Finalizada") + "</span>";
    return '<span class="pill navy">' + until(c).replace(/^en /, "En ") + "</span>";
  }
  function gcal(c, course) {
    var f = function (ts) { return new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent((course ? course.title + " · " : "") + c.title) +
      "&dates=" + f(c.start) + "/" + f(end(c)) +
      "&details=" + encodeURIComponent("Clase en vivo de ACAEMAT Táchira (" + PLAT[c.platform].name + ").\nEnlace: " + c.url + (c.notes ? "\n\n" + c.notes : "")) +
      "&location=" + encodeURIComponent(c.url);
  }

  /* Tarjeta de una clase (agenda). mode: "student" | "staff" */
  function card(c, mode) {
    var course = A.courseById(c.courseId), d = new Date(c.start), s = status(c);
    var act = "";
    if (mode === "staff") {
      act = '<button class="btn btn-line btn-sm" data-edit="' + c.id + '">Editar</button>' +
        (s !== "fin" ? '<a class="btn btn-navy btn-sm" target="_blank" rel="noopener" href="' + A.esc(c.url) + '">Abrir sala</a>' : "");
    } else if (s === "fin") {
      act = c.recording ? '<a class="btn btn-navy btn-sm" target="_blank" rel="noopener" href="' + A.esc(c.recording) + '">Ver grabación</a>' : '<span class="hint">La grabación se publicará pronto.</span>';
    } else {
      act = (canJoin(c) ? '<a class="btn btn-gold btn-sm" target="_blank" rel="noopener" href="' + A.esc(c.url) + '">Entrar a la clase</a>' :
        '<button class="btn btn-navy btn-sm" disabled title="Se habilita 10 minutos antes">Entrar a la clase</button>') +
        '<a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + gcal(c, course) + '">+ Google Calendar</a>';
    }
    return '<article class="lv-card lv-' + s + '" style="--c:' + (course ? course.color : "#12307A") + '">' +
      '<div class="lv-date"><b>' + d.getDate() + "</b><span>" + MONTHS[d.getMonth()].slice(0, 3) + "</span></div>" +
      '<div class="lv-info">' +
        '<div class="lv-top">' + pill(c) + '<span class="lv-plat">' + A.esc(PLAT[c.platform].name) + "</span></div>" +
        "<h3>" + A.esc(c.title) + "</h3>" +
        '<p class="lv-meta">' + A.esc(dayLabel(c.start)) + " · " + tm(c.start) + " – " + tm(end(c)) + (course ? " · " + A.esc(course.title) : "") + "</p>" +
        (c.notes && s !== "fin" ? '<p class="lv-notes">' + A.esc(c.notes) + "</p>" : "") +
        '<div class="lv-act">' + act + "</div>" +
      "</div></article>";
  }

  /* ---------- calendario mensual ---------- */
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function key(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  /* opts: { classes(): [], mode, onAdd(date), onOpen(id), title, sub, headExtra } */
  function mount(el, opts) {
    var view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0);
    var sel = null; // día seleccionado (Date) o null = próximas

    function render() {
      var list = opts.classes(), today = new Date();
      var byDay = {}; list.forEach(function (c) { var k = key(new Date(c.start)); (byDay[k] = byDay[k] || []).push(c); });
      var first = new Date(view), offset = (first.getDay() + 6) % 7, start = new Date(first); start.setDate(1 - offset);
      var cells = "";
      for (var i = 0; i < 42; i++) {
        var d = new Date(start); d.setDate(start.getDate() + i);
        if (i >= 35 && d.getMonth() !== view.getMonth()) break;
        var items = (byDay[key(d)] || []).sort(function (a, b) { return a.start - b.start; });
        var cls = "cal-day" + (d.getMonth() !== view.getMonth() ? " out" : "") + (sameDay(d, today) ? " today" : "") + (sel && sameDay(d, sel) ? " sel" : "") + (items.length ? " has" : "");
        cells += '<div class="' + cls + '" data-day="' + d.getTime() + '" role="gridcell" tabindex="0" aria-label="' + d.getDate() + " de " + MONTHS[d.getMonth()] + (items.length ? ", " + items.length + (items.length === 1 ? " clase" : " clases") : "") + '">' +
          '<span class="cal-n">' + d.getDate() + "</span>" +
          '<div class="cal-ev">' + items.slice(0, 3).map(function (c) {
            var co = A.courseById(c.courseId);
            return '<button class="cal-chip ' + status(c) + '" style="--c:' + (co ? co.color : "#12307A") + '" data-open="' + c.id + '" title="' + A.esc(c.title) + '"><b>' + tshort(c.start) + "</b> " + A.esc(co ? co.title : c.title) + "</button>";
          }).join("") + (items.length > 3 ? '<span class="cal-more">+' + (items.length - 3) + " más</span>" : "") + "</div>" +
          '<span class="cal-dots">' + items.slice(0, 4).map(function (c) { var co = A.courseById(c.courseId); return '<i style="--c:' + (co ? co.color : "#12307A") + '"></i>'; }).join("") + "</span>" +
          "</div>";
      }
      var agendaList, agendaTitle;
      if (sel) {
        agendaList = list.filter(function (c) { return sameDay(new Date(c.start), sel); }).sort(function (a, b) { return a.start - b.start; });
        agendaTitle = dayLabel(sel.getTime());
      } else {
        var now = Date.now();
        agendaList = list.filter(function (c) { return end(c) > now; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 6);
        agendaTitle = "Próximas clases";
      }
      var past = sel ? [] : list.filter(function (c) { return end(c) <= Date.now(); }).sort(function (a, b) { return b.start - a.start; }).slice(0, 3);

      el.innerHTML =
        '<div class="cal-wrap">' +
          '<section class="cal" aria-label="Calendario de clases">' +
            '<header class="cal-head">' +
              '<button class="icon-btn" data-nav="-1" aria-label="Mes anterior">‹</button>' +
              "<h2>" + MONTHS[view.getMonth()].replace(/^./, function (x) { return x.toUpperCase(); }) + " " + view.getFullYear() + "</h2>" +
              '<button class="icon-btn" data-nav="1" aria-label="Mes siguiente">›</button>' +
              '<button class="btn btn-line btn-sm" data-today>Hoy</button>' +
            "</header>" +
            '<div class="cal-grid" role="grid">' + WD.map(function (w) { return '<span class="cal-wd">' + w + "</span>"; }).join("") + cells + "</div>" +
            (opts.mode === "staff" ? '<p class="hint" style="margin-top:10px">Toque un día para programar una clase en esa fecha.</p>' : "") +
          "</section>" +
          '<aside class="agenda">' +
            '<div class="agenda-head"><h2>' + A.esc(agendaTitle) + "</h2>" + (sel ? '<button class="btn btn-ghost btn-sm" data-clear>Ver próximas</button>' : "") + "</div>" +
            (agendaList.length ? agendaList.map(function (c) { return card(c, opts.mode); }).join("") :
              '<div class="agenda-empty">' + A.icon("cal") + "<p>" + (sel ? "No hay clases este día." : "No hay clases programadas.") + "</p>" +
              (opts.mode === "staff" ? '<button class="btn btn-navy btn-sm" data-add-day>+ Programar clase</button>' : "") + "</div>") +
            (past.length ? '<h3 class="agenda-sub">Clases anteriores</h3>' + past.map(function (c) { return card(c, opts.mode); }).join("") : "") +
          "</aside>" +
        "</div>";
    }

    el.addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-nav]"))) { view.setMonth(view.getMonth() + (+t.dataset.nav)); render(); return; }
      if (e.target.closest("[data-today]")) { view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0); sel = new Date(); sel.setHours(0, 0, 0, 0); render(); return; }
      if (e.target.closest("[data-clear]")) { sel = null; render(); return; }
      if (e.target.closest("[data-add-day]")) { opts.onAdd && opts.onAdd(sel || null); return; }
      if ((t = e.target.closest("[data-open]"))) {
        e.stopPropagation();
        if (opts.mode === "staff" && opts.onOpen) opts.onOpen(t.dataset.open);
        else { var c = byId(t.dataset.open); sel = new Date(c.start); sel.setHours(0, 0, 0, 0); render(); }
        return;
      }
      if ((t = e.target.closest("[data-edit]"))) { opts.onOpen && opts.onOpen(t.dataset.edit); return; }
      if ((t = e.target.closest("[data-day]"))) {
        var d = new Date(+t.dataset.day);
        var had = sel && sameDay(d, sel);
        sel = d; render();
        if (opts.mode === "staff" && had) opts.onAdd && opts.onAdd(d);
      }
    });
    el.addEventListener("keydown", function (e) {
      var t = e.target.closest("[data-day]");
      if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); t.click(); }
    });
    render();
    return { render: render };
  }

  /* ---------- formulario del docente ---------- */
  function durLabel(m) { var h = Math.floor(m / 60), r = m % 60; return m < 60 ? m + " min" : r ? h + " h " + r + " min" : h + (h === 1 ? " hora" : " horas"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateVal(ts) { var d = new Date(ts); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function timeVal(ts) { var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  /* courses: programas que el docente puede usar; preset: {date} o clase existente */
  function editor(UI, courses, preset, user, done) {
    var isNew = !preset || !preset.id;
    var c = isNew ? { id: "", courseId: (courses[0] || {}).id, title: "", start: 0, duration: 90, platform: "meet", url: "", notes: "", recording: "", seriesId: "", createdBy: user.id } : JSON.parse(JSON.stringify(preset));
    var base = isNew ? (preset && preset.date ? new Date(preset.date) : new Date()) : new Date(c.start);
    if (isNew) { base.setHours(preset && preset.date ? 18 : Math.min(new Date().getHours() + 1, 20), 0, 0, 0); if (!c.start) c.start = base.getTime(); }

    var body =
      '<label>Programa<select data-f="courseId">' + courses.map(function (x) { return '<option value="' + x.id + '"' + (x.id === c.courseId ? " selected" : "") + ">" + A.esc(x.title) + "</option>"; }).join("") + "</select></label>" +
      '<label>Tema de la clase<input data-f="title" value="' + A.esc(c.title) + '" placeholder="Ej.: Práctica guiada de venopunción" /></label>' +
      '<div class="row3"><label>Fecha<input type="date" data-f="date" value="' + dateVal(c.start) + '" /></label>' +
        '<label>Hora de inicio<input type="time" data-f="time" value="' + timeVal(c.start) + '" /></label>' +
        '<label>Duración<select data-f="duration">' + [30, 45, 60, 90, 120, 150, 180].map(function (m) { return '<option value="' + m + '"' + (m === c.duration ? " selected" : "") + ">" + durLabel(m) + "</option>"; }).join("") + "</select></label></div>" +
      '<label>Plataforma<select data-f="platform">' + Object.keys(PLAT).map(function (k) { return '<option value="' + k + '"' + (k === c.platform ? " selected" : "") + ">" + PLAT[k].name + "</option>"; }).join("") + "</select></label>" +
      '<p class="hint" data-plat-hint></p>' +
      '<label>Enlace de la clase<span class="url-row"><input data-f="url" value="' + A.esc(c.url) + '" placeholder="https://meet.google.com/…" /><button type="button" class="btn btn-line btn-sm" data-room hidden>Generar sala</button></span></label>' +
      (isNew ? '<label>Repetir<select data-f="repeat"><option value="1">No se repite</option>' + [2, 3, 4, 6, 8, 10, 12, 16].map(function (n) { return '<option value="' + n + '">Cada semana · ' + n + " clases</option>"; }).join("") + "</select></label>" : "") +
      '<label>Indicaciones para los estudiantes <small>(opcional)</small><textarea rows="2" data-f="notes" placeholder="Ej.: Tenga a mano su tensiómetro.">' + A.esc(c.notes) + "</textarea></label>" +
      (isNew ? "" : '<fieldset class="rec"><legend>Después de la clase</legend>' +
        '<label>Enlace de la grabación <small>(YouTube no listado, Drive…)</small><input data-f="recording" value="' + A.esc(c.recording) + '" placeholder="https://" /></label>' +
        '<label class="check"><input type="checkbox" data-f="aslesson" /> Publicar la grabación como lección de video del curso</label></fieldset>');

    var foot = (isNew ? "" : '<button class="btn btn-ghost btn-sm" data-del style="margin-right:auto">Eliminar</button>') +
      '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>' + (isNew ? "Programar clase" : "Guardar cambios") + "</button>";
    var d = UI.modal(isNew ? "Programar clase en vivo" : "Editar clase en vivo", body, foot);
    var f = function (k) { return d.querySelector('[data-f="' + k + '"]'); };
    function syncPlat() {
      var p = f("platform").value;
      d.querySelector("[data-plat-hint]").textContent = PLAT[p].hint;
      d.querySelector("[data-room]").hidden = p !== "jitsi";
      f("url").placeholder = { meet: "https://meet.google.com/…", zoom: "https://zoom.us/j/…", jitsi: "Pulse «Generar sala» o pegue un enlace", youtube: "https://youtube.com/live/…", otra: "https://" }[p];
    }
    f("platform").addEventListener("change", syncPlat); syncPlat();
    d.querySelector("[data-room]").addEventListener("click", function () {
      var co = A.courseById(f("courseId").value); f("url").value = room(co ? co.slug : "clase");
    });

    d.querySelector("[data-ok]").addEventListener("click", function () {
      var title = f("title").value.trim(), url = f("url").value.trim(), dt = f("date").value, hm = f("time").value;
      if (!title) return A.toast("Escriba el tema de la clase.", "err");
      if (!dt || !hm) return A.toast("Indique la fecha y la hora.", "err");
      if (f("platform").value === "jitsi" && !url) { var co = A.courseById(f("courseId").value); url = room(co ? co.slug : "clase"); }
      if (!/^https?:\/\//i.test(url)) return A.toast("Pegue el enlace de la clase (debe empezar por https://).", "err");
      var p = dt.split("-"), t = hm.split(":");
      var start = new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]).getTime();
      c.courseId = f("courseId").value; c.title = title; c.url = url; c.start = start;
      c.duration = +f("duration").value; c.platform = f("platform").value; c.notes = f("notes").value.trim();
      var made = 1;
      if (isNew) {
        var n = +f("repeat").value, sid = n > 1 ? A.uid("ser") : "";
        for (var i = 0; i < n; i++) {
          var x = JSON.parse(JSON.stringify(c)); x.id = A.uid("lv"); x.seriesId = sid;
          var sd = new Date(start); sd.setDate(sd.getDate() + 7 * i); x.start = sd.getTime();
          upsert(x);
        }
        made = n;
      } else {
        var rec = f("recording").value.trim();
        if (rec && !/^https?:\/\//i.test(rec)) return A.toast("El enlace de la grabación debe empezar por https://.", "err");
        c.recording = rec;
        upsert(c);
        if (rec && f("aslesson").checked) publishRecording(c);
      }
      d.close();
      A.toast(isNew ? (made > 1 ? made + " clases programadas." : "Clase programada.") : "Clase actualizada.", "ok");
      done && done();
    });
    var del = d.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () {
      d.close();
      var msg = c.seriesId ? "Esta clase es parte de una serie semanal. ¿Eliminar solo esta clase?" : "Se eliminará la clase «" + c.title + "».";
      if (c.seriesId) {
        var m = UI.modal("Eliminar clase", "<p>" + A.esc(msg) + "</p>", '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-line btn-sm" data-all>Toda la serie</button><button class="btn btn-navy btn-sm" data-one>Solo esta</button>');
        m.querySelector("[data-one]").addEventListener("click", function () { m.close(); remove(c.id, false); A.toast("Clase eliminada.", "ok"); done && done(); });
        m.querySelector("[data-all]").addEventListener("click", function () { m.close(); remove(c.id, true); A.toast("Serie eliminada.", "ok"); done && done(); });
      } else {
        UI.confirm(msg, "Eliminar").then(function (ok) { if (ok) { remove(c.id, false); A.toast("Clase eliminada.", "ok"); done && done(); } });
      }
    });
  }

  /* La grabación queda como lección de video en el módulo «Clases grabadas» */
  function publishRecording(c) {
    var co = A.courseById(c.courseId); if (!co) return;
    var m = co.modules.filter(function (x) { return x.title === "Clases grabadas"; })[0];
    if (!m) { m = { id: A.uid("m"), title: "Clases grabadas", lessons: [] }; co.modules.push(m); }
    if (m.lessons.some(function (l) { return l.url === c.recording; })) return;
    m.lessons.push({ id: A.uid("l"), kind: "video", title: "Grabación · " + c.title, minutes: c.duration, url: c.recording, body: "Clase en vivo del " + new Date(c.start).toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" }) + ".", fileId: "", fileName: "" });
    A.upsertCourse(co);
  }

  window.ACAEMAT_LIVE = {
    all: all, byId: byId, forCourses: forCourses, upsert: upsert, remove: remove,
    status: status, canJoin: canJoin, until: until, dayLabel: dayLabel, time: tm, end: end, gcal: gcal,
    card: card, mount: mount, editor: editor, PLAT: PLAT
  };
})();
