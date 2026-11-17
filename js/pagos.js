/* =========================================================================
   ACAEMAT — Alumnos y pagos (administración) + estado de cuenta (estudiante)
   Datos en db.fin = {
     settings: { rate:{value,date,demo}, methods:[{id,kind,name,details,active}],
                 graceDays, blockQuiz, certSolvent, seq },
     prices:   { courseId: { price, enrollFee, installments } },
     accounts: [{ id, userId, courseId, start, charges:[{id,label,amount,due}] }],
     payments: [{ id, userId, accountId, courseId, usd, ves, rate, kind, methodId,
                  reference, date, proofId, proofName, note, status, reason,
                  created, reviewedBy, reviewedAt, receipt }]
   }
   Los montos se llevan en USD; los pagos en bolívares se convierten con la tasa del día.
   Solo la administración ve montos. El docente ve únicamente la solvencia.
   ========================================================================= */
(function () {
  "use strict";
  var A = window.ACAEMAT, DAY = 864e5;
  var KINDS = { pagomovil: "Pago móvil", transferencia: "Transferencia bancaria", zelle: "Zelle", binance: "Binance (USDT)", efectivo: "Efectivo en la sede" };
  var VES = { pagomovil: true, transferencia: true };
  var STATE = {
    solvente: { label: "Solvente", cls: "ok" },
    aldia: { label: "Al día", cls: "navy" },
    vencido: { label: "Cuota vencida", cls: "gold" },
    moroso: { label: "Moroso", cls: "bad" },
    sinplan: { label: "Sin plan de pago", cls: "" }
  };

  /* ---------- formato ---------- */
  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function usd(n) { return "$" + r2(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function bs(n) { return "Bs " + r2(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fdate(ts) { return new Date(ts).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }); }
  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }
  function phoneIntl(p) { var d = String(p || "").replace(/\D/g, ""); if (!d) return ""; if (d.indexOf("58") === 0) return d; if (d.charAt(0) === "0") return "58" + d.slice(1); return d; }

  /* ---------- datos ---------- */
  function defaultPrice(c) {
    var p = Math.max(30, Math.round((+c.hours || 20) * 1.5 / 5) * 5);
    return { price: p, enrollFee: p >= 80 ? 20 : 0, installments: (+c.hours || 0) >= 60 ? 3 : p >= 60 ? 2 : 1 };
  }
  function demo(db) {
    var now = Date.now(), prices = {};
    db.courses.forEach(function (c) { prices[c.id] = defaultPrice(c); });
    return {
      settings: {
        rate: { value: 300, date: now, demo: true },
        methods: [
          { id: "pm1", kind: "pagomovil", name: "Pago móvil", details: "Banco de Venezuela (0102) · Tel. 0414-000-0000 · RIF V-10176649-3", active: true },
          { id: "tr1", kind: "transferencia", name: "Transferencia", details: "Banco de Venezuela · Cuenta corriente 0102-0000-00-0000000000 · ACAEMAT · RIF V-10176649-3", active: true },
          { id: "zl1", kind: "zelle", name: "Zelle", details: "pagos@acaemat.com · a nombre de ACAEMAT", active: true },
          { id: "bn1", kind: "binance", name: "Binance Pay", details: "ID de Binance Pay: 000000000 (USDT)", active: true },
          { id: "ef1", kind: "efectivo", name: "Efectivo", details: "En la sede, de lunes a sábado. Se entrega recibo al momento.", active: true }
        ],
        graceDays: 7, blockQuiz: true, certSolvent: true, seq: 1
      },
      prices: prices, accounts: [], payments: [], seeded: false
    };
  }
  function F() {
    var db = A.db();
    if (!db.fin) { db.fin = demo(db); A.save(); }
    var f = db.fin;
    db.courses.forEach(function (c) { if (!f.prices[c.id]) f.prices[c.id] = defaultPrice(c); });
    syncAccounts();
    if (!f.seeded) seedDemo(f);
    return f;
  }
  function makeCharges(cfg, start) {
    var out = [], fee = r2(cfg.enrollFee || 0), n = Math.max(1, +cfg.installments || 1), rest = r2((+cfg.price || 0) - fee), off = fee > 0 ? 1 : 0;
    if (fee > 0) out.push({ id: A.uid("ch"), label: "Inscripción", amount: fee, due: start });
    var each = Math.floor(rest / n * 100) / 100;
    for (var k = 1; k <= n; k++) {
      var amt = k === n ? r2(rest - each * (n - 1)) : each;
      out.push({ id: A.uid("ch"), label: n === 1 ? "Pago único" : "Cuota " + k + " de " + n, amount: amt, due: start + (k - 1 + off) * 30 * DAY });
    }
    return out.filter(function (c) { return c.amount > 0; });
  }
  /* Toda inscripción tiene su cuenta: se crea sola con el precio vigente del programa */
  function syncAccounts() {
    var db = A.db(), f = db.fin, changed = false;
    db.enrollments.forEach(function (e) {
      if (f.accounts.some(function (a) { return a.userId === e.userId && a.courseId === e.courseId; })) return;
      var cfg = f.prices[e.courseId]; if (!cfg) return;
      f.accounts.push({ id: A.uid("ac"), userId: e.userId, courseId: e.courseId, start: e.date || Date.now(), charges: makeCharges(cfg, e.date || Date.now()) });
      changed = true;
    });
    if (changed) A.save();
  }
  function seedDemo(f) {
    f.seeded = true;
    var now = Date.now();
    var a1 = acc("u-est", "c-rcp"), a2 = acc("u-est", "c-bio"), a3 = acc("u-est2", "c-flebo");
    if (a1) addApproved(a1, a1.charges[0].amount, "pagomovil", "pm1", "00451239", a1.start + DAY);
    if (a2) addApproved(a2, a2.charges.reduce(function (s, c) { return s + c.amount; }, 0), "zelle", "zl1", "ZL-88213", a2.start);
    if (a3) {
      a3.start = now - 38 * DAY; a3.charges = makeCharges(f.prices["c-flebo"], a3.start);
      f.payments.push({ id: A.uid("pg"), userId: "u-est2", accountId: a3.id, courseId: "c-flebo", usd: a3.charges[0].amount, ves: r2(a3.charges[0].amount * f.settings.rate.value), rate: f.settings.rate.value, kind: "pagomovil", methodId: "pm1", reference: "00872210", date: now - DAY, proofId: "", proofName: "", note: "Pago de la primera cuota", status: "pendiente", reason: "", created: now - DAY, reviewedBy: "", reviewedAt: 0, receipt: "" });
    }
    A.save();
    function addApproved(a, amount, kind, mid, ref, date) {
      var rate = f.settings.rate.value, rec = "R-" + pad(f.settings.seq++, 6);
      f.payments.push({ id: A.uid("pg"), userId: a.userId, accountId: a.id, courseId: a.courseId, usd: r2(amount), ves: VES[kind] ? r2(amount * rate) : 0, rate: rate, kind: kind, methodId: mid, reference: ref, date: date, proofId: "", proofName: "", note: "", status: "aprobado", reason: "", created: date, reviewedBy: "u-admin", reviewedAt: date + 3600e3, receipt: rec });
    }
  }
  function acc(userId, courseId) { var f = A.db().fin; return f.accounts.filter(function (a) { return a.userId === userId && a.courseId === courseId; })[0] || null; }
  function accounts() { F(); var db = A.db(); return db.fin.accounts.filter(function (a) { return db.enrollments.some(function (e) { return e.userId === a.userId && e.courseId === a.courseId; }); }); }
  function paymentsOf(accountId) { return F().payments.filter(function (p) { return p.accountId === accountId; }).sort(function (a, b) { return b.date - a.date; }); }

  /* ---------- estado de cuenta ---------- */
  function statement(a) {
    var f = F(), now = Date.now();
    var paid = r2(f.payments.filter(function (p) { return p.accountId === a.id && p.status === "aprobado"; }).reduce(function (s, p) { return s + p.usd; }, 0));
    var pending = r2(f.payments.filter(function (p) { return p.accountId === a.id && p.status === "pendiente"; }).reduce(function (s, p) { return s + p.usd; }, 0));
    var left = paid, total = 0, overdue = 0, next = null, overdueAmt = 0;
    var rows = a.charges.slice().sort(function (x, y) { return x.due - y.due; }).map(function (c) {
      total += c.amount;
      var got = Math.min(c.amount, Math.max(0, left)); left = r2(left - got);
      var owe = r2(c.amount - got), st;
      if (owe <= 0) st = "pagada";
      else if (c.due < now) { st = "vencida"; overdue = Math.max(overdue, Math.floor((now - c.due) / DAY)); overdueAmt += owe; }
      else st = got > 0 ? "abonada" : "porvencer";
      if (owe > 0 && !next) next = { charge: c, owe: owe };
      return { charge: c, paid: r2(got), owe: owe, status: st };
    });
    total = r2(total);
    var balance = r2(Math.max(0, total - paid));
    var state = !a.charges.length ? "sinplan" : balance <= 0 ? "solvente" : overdue > (+f.settings.graceDays || 0) ? "moroso" : overdue > 0 ? "vencido" : "aldia";
    return { account: a, rows: rows, total: total, paid: paid, pending: pending, balance: balance, overdueDays: overdue, overdueAmt: r2(overdueAmt), next: next, state: state, credit: r2(Math.max(0, paid - total)) };
  }
  function stateOf(userId, courseId) { var a = acc(userId, courseId); F(); return a ? statement(a).state : "sinplan"; }
  function userState(userId) {
    var order = ["moroso", "vencido", "aldia", "solvente", "sinplan"], worst = "sinplan", seen = false;
    accounts().filter(function (a) { return a.userId === userId; }).forEach(function (a) {
      var s = statement(a).state; if (!seen || order.indexOf(s) < order.indexOf(worst)) worst = s; seen = true;
    });
    return worst;
  }
  function quizBlocked(userId, courseId) { var f = F(); return !!f.settings.blockQuiz && stateOf(userId, courseId) === "moroso"; }
  function certBlocked(userId, courseId) { var f = F(), a = acc(userId, courseId); return !!f.settings.certSolvent && !!a && statement(a).balance > 0; }
  function pill(state) { var s = STATE[state] || STATE.sinplan; return '<span class="pill ' + s.cls + '">' + s.label + "</span>"; }

  /* ---------- comprobante: foto comprimida ---------- */
  function compress(file) {
    if (!file) return Promise.resolve(null);
    if (!/^image\//.test(file.type)) {
      if (file.size > 3 * 1024 * 1024) return Promise.reject(new Error("El archivo pesa más de 3 MB. Envíe una foto o un PDF más liviano."));
      return Promise.resolve(file);
    }
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? res(new File([b], (file.name || "comprobante").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })) : rej(new Error("No se pudo procesar la imagen.")); }, "image/jpeg", 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen.")); };
      img.src = url;
    });
  }

  /* ---------- recibo ---------- */
  function receiptHTML(p) {
    var f = F(), u = A.userById(p.userId) || { name: "—", cedula: "" }, c = A.courseById(p.courseId) || { title: "—" }, B = (window.ACAEMAT_CONFIG || {}).brand || {};
    var m = f.settings.methods.filter(function (x) { return x.id === p.methodId; })[0];
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ' + A.esc(p.receipt) + "</title><style>" +
      "@page{size:Letter;margin:18mm}body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#0B1220;margin:0}" +
      ".hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #0B1638;padding-bottom:14px}.hd img{width:70px;height:70px;border-radius:50%}" +
      ".hd b{font-size:20px;letter-spacing:.06em;display:block}.hd small{color:#5D6778;font-size:12px}" +
      ".no{margin-left:auto;text-align:right}.no b{font-size:18px;color:#E0322B;letter-spacing:.04em}" +
      "h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:22px 0 12px}" +
      "table{width:100%;border-collapse:collapse}td{padding:9px 10px;border-bottom:1px solid #E4E8EE;vertical-align:top}td:first-child{width:34%;color:#5D6778;font-size:12px;text-transform:uppercase;letter-spacing:.08em}" +
      ".tot td{font-size:18px;font-weight:700;color:#0B1220;border-top:2px solid #0B1220}.ft{margin-top:26px;font-size:11px;color:#5D6778;border-top:1px solid #E4E8EE;padding-top:10px}" +
      "</style></head><body>" +
      '<div class="hd"><img src="' + location.href.replace(/[^/]*$/, "") + 'assets/img/logo-acaemat-320.webp" alt=""><div><b>ACAEMAT TÁCHIRA</b><small>' + A.esc(B.name || "") + "<br>RIF " + A.esc(B.rif || "") + " · M.P.P.E. Cód. " + A.esc(B.mppe || "") + '</small></div><div class="no"><small>Recibo de pago</small><br><b>' + A.esc(p.receipt) + "</b><br><small>" + fdate(p.reviewedAt || p.date) + "</small></div></div>" +
      "<h1>Recibo de pago</h1><table>" +
      "<tr><td>Recibimos de</td><td><b>" + A.esc(u.name) + "</b>" + (u.cedula ? " · C.I. " + A.esc(u.cedula) : "") + "</td></tr>" +
      "<tr><td>Programa</td><td>" + A.esc(c.title) + "</td></tr>" +
      "<tr><td>Método de pago</td><td>" + A.esc(KINDS[p.kind] || p.kind) + (m ? " · " + A.esc(m.name) : "") + "</td></tr>" +
      "<tr><td>Referencia</td><td>" + A.esc(p.reference || "—") + "</td></tr>" +
      "<tr><td>Fecha del pago</td><td>" + fdate(p.date) + "</td></tr>" +
      (p.ves ? "<tr><td>Monto en bolívares</td><td>" + bs(p.ves) + " (tasa " + bs(p.rate) + " por USD)</td></tr>" : "") +
      '<tr class="tot"><td>Monto acreditado</td><td>' + usd(p.usd) + "</td></tr></table>" +
      '<p class="ft">Comprobante interno de pago emitido por la plataforma de ACAEMAT Táchira. No sustituye la factura fiscal.</p>' +
      "</body></html>";
  }
  function printReceipt(p) {
    var fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(fr);
    var d = fr.contentWindow.document; d.open(); d.write(receiptHTML(p)); d.close();
    var img = d.querySelector("img");
    var go = function () { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(function () { fr.remove(); }, 1500); };
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else setTimeout(go, 150);
  }
  function viewProof(p) {
    if (!p.proofId) return A.toast("Este pago no tiene comprobante adjunto.", "err");
    A.files.url(p.proofId).then(function (u) {
      if (!u) return A.toast("No se encontró el comprobante.", "err");
      var isImg = !/\.pdf$/i.test(p.proofName || "");
      var UI = window.ACAEMAT_UI;
      UI.modal("Comprobante · " + (p.reference || ""), isImg ? '<img src="' + u + '" alt="Comprobante" style="max-width:100%;border:1px solid var(--line)">' : '<iframe src="' + u + '" style="width:100%;height:70vh;border:1px solid var(--line)"></iframe>', '<a class="btn btn-line btn-sm" href="' + u + '" download="' + A.esc(p.proofName || "comprobante") + '">Descargar</a><button class="btn btn-navy btn-sm" data-x>Cerrar</button>');
    });
  }

  /* ====================================================================
     ESTUDIANTE: Mis pagos
     ==================================================================== */
  function studentView(main, user, UI) {
    var f = F(), mine = accounts().filter(function (a) { return a.userId === user.id; });
    var rate = f.settings.rate;
    if (!mine.length) {
      main.innerHTML = head() + '<div class="empty">' + A.icon("folder") + "<h3>Aún no tiene pagos</h3><p>Cuando la academia lo inscriba en un programa, aquí verá sus cuotas y podrá reportar sus pagos.</p></div>";
      return;
    }
    var sts = mine.map(statement);
    var due = r2(sts.reduce(function (s, x) { return s + x.balance; }, 0));
    main.innerHTML = head() +
      '<div class="stats">' +
        stat(usd(due), "Saldo pendiente") +
        stat(sts.filter(function (x) { return x.state === "solvente"; }).length + " de " + sts.length, "Programas pagados") +
        stat(bs(rate.value), "Tasa del día por USD" + (rate.demo ? " (ejemplo)" : "")) +
      "</div>" +
      sts.map(function (s) { return accountCard(s, "student"); }).join("") +
      '<div class="panel"><h2>Datos para pagar</h2><div class="pay-methods">' + f.settings.methods.filter(function (m) { return m.active; }).map(function (m) {
        return '<div class="pm"><b>' + A.esc(m.name) + "</b><small>" + A.esc(KINDS[m.kind]) + (VES[m.kind] ? " · en bolívares" : m.kind === "efectivo" ? "" : " · en dólares") + "</small><p>" + A.esc(m.details) + "</p></div>";
      }).join("") + "</div></div>";
    main.addEventListener("click", onClick);
    function head() { return '<div class="page-head"><div><h1>Mis pagos</h1><p>Sus cuotas, pagos y recibos. Después de pagar, reporte el pago con la foto del comprobante: la academia lo verifica y le emite el recibo.</p></div></div>'; }
    function onClick(e) {
      var b = e.target.closest("[data-report]"); if (b) { reportModal(UI, user, b.dataset.report, function () { studentView(main, user, UI); }); return; }
      var r = e.target.closest("[data-receipt]"); if (r) { printReceipt(byId(r.dataset.receipt)); return; }
      var pr = e.target.closest("[data-proof]"); if (pr) viewProof(byId(pr.dataset.proof));
    }
  }
  function byId(id) { return F().payments.filter(function (p) { return p.id === id; })[0]; }
  function stat(v, l) { return '<div class="stat"><b>' + v + "</b><span>" + l + "</span></div>"; }
  var CH = { pagada: ["Pagada", "ok"], abonada: ["Abonada", "navy"], porvencer: ["Por vencer", ""], vencida: ["Vencida", "bad"] };
  function accountCard(s, mode) {
    var a = s.account, c = A.courseById(a.courseId) || { title: "Programa eliminado", color: "#12307A" }, u = A.userById(a.userId) || { name: "—" };
    var pays = paymentsOf(a.id);
    return '<section class="acct" style="--c:' + (c.color || "#12307A") + '">' +
      '<header class="acct-head"><div><small>' + (mode === "admin" ? A.esc(u.name) + " · " : "") + "Inscrito el " + fdate(a.start) + "</small><h2>" + A.esc(c.title) + "</h2></div>" + pill(s.state) + "</header>" +
      '<div class="acct-sum"><div><span>Total</span><b>' + usd(s.total) + "</b></div><div><span>Pagado</span><b>" + usd(s.paid) + "</b></div><div><span>Saldo</span><b class=\"" + (s.balance > 0 ? "due" : "") + '">' + usd(s.balance) + "</b></div>" +
        (s.pending ? '<div><span>Por verificar</span><b>' + usd(s.pending) + "</b></div>" : "") + "</div>" +
      (s.state === "moroso" && mode === "student" ? '<p class="acct-warn">Tiene una cuota vencida hace ' + s.overdueDays + " días. Mientras no se ponga al día, no podrá presentar evaluaciones" + (F().settings.certSolvent ? " ni descargar su certificado" : "") + ".</p>" : "") +
      '<div class="table-wrap"><table class="tbl-compact"><thead><tr><th>Concepto</th><th>Vence</th><th class="r">Monto</th><th class="r">Pendiente</th><th>Estado</th></tr></thead><tbody>' +
      s.rows.map(function (r) {
        var st = CH[r.status], late = r.status === "vencida" ? " · " + Math.floor((Date.now() - r.charge.due) / DAY) + " d" : "";
        return "<tr><td>" + A.esc(r.charge.label) + "</td><td>" + fdate(r.charge.due) + '</td><td class="r">' + usd(r.charge.amount) + '</td><td class="r">' + (r.owe ? usd(r.owe) : "—") + '</td><td><span class="pill ' + st[1] + '">' + st[0] + late + "</span></td></tr>";
      }).join("") + "</tbody></table></div>" +
      (pays.length ? '<h3 class="acct-sub">Pagos</h3><div class="table-wrap"><table class="tbl-compact"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th class="r">Monto</th><th>Estado</th><th></th></tr></thead><tbody>' +
        pays.map(function (p) {
          var st = p.status === "aprobado" ? '<span class="pill ok">Aprobado</span>' : p.status === "pendiente" ? '<span class="pill gold">Por verificar</span>' : '<span class="pill bad" title="' + A.esc(p.reason) + '">Rechazado</span>';
          return "<tr><td>" + fdate(p.date) + "</td><td>" + A.esc(KINDS[p.kind] || p.kind) + "</td><td>" + A.esc(p.reference || "—") + '</td><td class="r">' + usd(p.usd) + (p.ves ? '<br><small class="hint">' + bs(p.ves) + "</small>" : "") + "</td><td>" + st +
            (p.status === "rechazado" && p.reason ? '<br><small class="hint">' + A.esc(p.reason) + "</small>" : "") + '</td><td class="row-actions">' +
            (p.proofId ? '<button class="btn btn-ghost btn-sm" data-proof="' + p.id + '">Comprobante</button>' : "") +
            (p.receipt ? '<button class="btn btn-line btn-sm" data-receipt="' + p.id + '">Recibo ' + A.esc(p.receipt) + "</button>" : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>" : "") +
      '<div class="acct-act">' + (mode === "student" && s.balance > 0 ? '<button class="btn btn-navy" data-report="' + a.id + '">Reportar un pago</button>' : "") +
        (mode === "admin" ? '<button class="btn btn-line btn-sm" data-cash="' + a.id + '">Registrar pago</button><button class="btn btn-ghost btn-sm" data-plan="' + a.id + '">Editar plan de pago</button>' : "") + "</div>" +
      "</section>";
  }

  /* Reporte de pago (estudiante) o registro directo (administración) */
  function reportModal(UI, user, accountId, done, adminMode) {
    var f = F(), a = f.accounts.filter(function (x) { return x.id === accountId; })[0]; if (!a) return;
    var s = statement(a), c = A.courseById(a.courseId), rate = +f.settings.rate.value || 0;
    var methods = f.settings.methods.filter(function (m) { return m.active; });
    var sugg = s.next ? s.next.owe : s.balance;
    var body =
      '<p class="hint" style="margin-top:0">' + A.esc(c ? c.title : "") + " · Saldo " + usd(s.balance) + (s.next ? " · Próximo: " + A.esc(s.next.charge.label) + " (" + usd(s.next.owe) + ")" : "") + "</p>" +
      '<label>Método de pago<select data-f="method">' + methods.map(function (m) { return '<option value="' + m.id + '">' + A.esc(m.name) + " · " + A.esc(KINDS[m.kind]) + "</option>"; }).join("") + "</select></label>" +
      '<p class="pm-details" data-details></p>' +
      '<div class="row2"><label><span data-amt-label>Monto pagado</span><input type="number" min="0" step="0.01" data-f="amount" /></label>' +
        '<label>Equivale a<input data-f="equiv" disabled /></label></div>' +
      '<div class="row2"><label>Número de referencia<input data-f="reference" placeholder="Ej.: 00451239" /></label><label>Fecha del pago<input type="date" data-f="date" value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) + '" /></label></div>' +
      '<label class="file-drop" data-drop>' + A.icon("folder") + '<span data-fname>' + (adminMode ? "Comprobante (opcional)" : "Foto o captura del comprobante") + ' · pulse para elegir</span><input type="file" accept="image/*,application/pdf" data-f="proof" hidden /></label>' +
      '<label>Nota <small>(opcional)</small><input data-f="note" placeholder="Ej.: pago de la cuota 2" /></label>' +
      (adminMode ? '<p class="hint">Al registrarlo desde administración, el pago queda aprobado y se emite el recibo de inmediato.</p>' : '<p class="hint">La academia verificará el pago con su banco. Recibirá su recibo en esta misma página.</p>');
    var d = UI.modal(adminMode ? "Registrar pago" : "Reportar un pago", body, '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>' + (adminMode ? "Registrar y emitir recibo" : "Enviar reporte") + "</button>");
    var q = function (k) { return d.querySelector('[data-f="' + k + '"]'); }, file = null;
    function method() { return methods.filter(function (m) { return m.id === q("method").value; })[0]; }
    function sync() {
      var m = method(), isV = VES[m.kind];
      d.querySelector("[data-details]").textContent = m.details;
      d.querySelector("[data-amt-label]").textContent = isV ? "Monto pagado en bolívares" : "Monto pagado en dólares";
      var v = +q("amount").value || 0;
      q("equiv").value = isV ? (rate ? usd(v / rate) + " a " + bs(rate) + " por USD" : "Falta la tasa del día") : (rate ? bs(v * rate) : "—");
    }
    function setDefault() { var m = method(); q("amount").value = VES[m.kind] ? r2(sugg * rate) : r2(sugg); sync(); }
    q("method").addEventListener("change", setDefault); q("amount").addEventListener("input", sync); setDefault();
    q("proof").addEventListener("change", function () { file = this.files[0] || null; d.querySelector("[data-fname]").innerHTML = file ? "Archivo: <strong>" + A.esc(file.name) + "</strong>" : "Foto o captura del comprobante"; });
    d.querySelector("[data-ok]").addEventListener("click", function () {
      var m = method(), isV = VES[m.kind], amt = +q("amount").value;
      if (!(amt > 0)) return A.toast("Indique el monto pagado.", "err");
      if (isV && !rate) return A.toast("La academia aún no ha cargado la tasa del día.", "err");
      if (m.kind !== "efectivo" && !q("reference").value.trim()) return A.toast("Escriba el número de referencia.", "err");
      if (!adminMode && m.kind !== "efectivo" && !file) return A.toast("Adjunte la foto del comprobante.", "err");
      var btn = this; btn.disabled = true;
      compress(file).then(function (pf) { return pf ? A.files.put(pf).then(function (id) { return { id: id, name: pf.name }; }) : null; }).then(function (pf) {
        var dp = q("date").value.split("-"), now = Date.now();
        var p = { id: A.uid("pg"), userId: a.userId, accountId: a.id, courseId: a.courseId, usd: r2(isV ? amt / rate : amt), ves: isV ? r2(amt) : 0, rate: rate, kind: m.kind, methodId: m.id, reference: q("reference").value.trim(), date: new Date(+dp[0], +dp[1] - 1, +dp[2], 12).getTime(), proofId: pf ? pf.id : "", proofName: pf ? pf.name : "", note: q("note").value.trim(), status: "pendiente", reason: "", created: now, reviewedBy: "", reviewedAt: 0, receipt: "" };
        if (adminMode) approve(p, user);
        F().payments.push(p); A.save(); d.close();
        A.toast(adminMode ? "Pago registrado. Recibo " + p.receipt + "." : "Pago reportado. La academia lo verificará pronto.", "ok");
        done && done();
      }).catch(function (err) { btn.disabled = false; A.toast(err.message || "No se pudo guardar el comprobante.", "err"); });
    });
  }
  function approve(p, admin) {
    var f = F();
    p.status = "aprobado"; p.reason = ""; p.reviewedBy = admin.id; p.reviewedAt = Date.now();
    if (!p.receipt) p.receipt = "R-" + pad(f.settings.seq++, 6);
  }

  /* ====================================================================
     ADMINISTRACIÓN
     ==================================================================== */
  var TABS = [["verificar", "Por verificar"], ["cuentas", "Estados de cuenta"], ["morosos", "Morosos"], ["reportes", "Reportes"], ["config", "Configuración"]];
  function pendingCount() { return F().payments.filter(function (p) { return p.status === "pendiente"; }).length; }

  function adminView(main, user, UI, tab, rerender) {
    var f = F(); tab = tab || "verificar";
    var rate = f.settings.rate, stale = !rate.value || new Date(rate.date).toDateString() !== new Date().toDateString();
    main.innerHTML =
      '<div class="page-head"><div><h1>Pagos</h1><p>Precios, cuotas, verificación de pagos, recibos y morosidad. Solo la administración ve esta sección.</p></div>' +
        '<div class="row-actions"><button class="btn btn-line" data-rate>Tasa del día: ' + (rate.value ? bs(rate.value) : "sin cargar") + "</button>" + (window.ACAEMAT_BACKUP ? '<button class="btn btn-navy" data-backup>Descargar respaldo</button>' : "") + "</div></div>" +
      (stale ? '<p class="note-bar">' + (rate.demo ? "Tasa de ejemplo de la demo. " : "") + "Actualice la tasa del día antes de verificar pagos en bolívares.</p>" : "") +
      '<div class="seg" role="tablist">' + TABS.map(function (t) {
        var n = t[0] === "verificar" ? pendingCount() : t[0] === "morosos" ? accounts().filter(function (a) { return statement(a).state === "moroso"; }).length : 0;
        return '<a role="tab" href="#/pagos/' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + (n ? " <sup>" + n + "</sup>" : "") + "</a>";
      }).join("") + "</div><div data-tab></div>";
    var box = main.querySelector("[data-tab]");
    ({ verificar: tabVerify, cuentas: tabAccounts, morosos: tabLate, reportes: tabReports, config: tabConfig }[tab] || tabVerify)(box);

    main.querySelector("[data-rate]").addEventListener("click", rateModal);
    var bk = main.querySelector("[data-backup]"); if (bk) bk.addEventListener("click", function () { window.ACAEMAT_BACKUP.excel(); });

    function rateModal() {
      var d = UI.modal("Tasa del día", '<label>Bolívares por cada dólar<input type="number" min="0" step="0.01" data-v value="' + (rate.value || "") + '" /></label><p class="hint">Use la tasa oficial del BCV u otra que la academia haya definido. Se aplica a los pagos en bolívares que se reporten desde ahora; los pagos ya registrados conservan su tasa.</p>', '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>Guardar tasa</button>');
      d.querySelector("[data-ok]").addEventListener("click", function () {
        var v = +d.querySelector("[data-v]").value; if (!(v > 0)) return A.toast("Escriba una tasa válida.", "err");
        f.settings.rate = { value: r2(v), date: Date.now(), demo: false, by: user.id }; A.save(); d.close(); A.toast("Tasa actualizada: " + bs(v) + ".", "ok"); rerender();
      });
    }

    function tabVerify(el) {
      var list = f.payments.filter(function (p) { return p.status === "pendiente"; }).sort(function (a, b) { return a.created - b.created; });
      el.innerHTML = list.length ? '<div class="verify-list">' + list.map(function (p) {
        var u = A.userById(p.userId) || { name: "—" }, c = A.courseById(p.courseId) || { title: "—" }, m = f.settings.methods.filter(function (x) { return x.id === p.methodId; })[0];
        return '<article class="vcard" data-p="' + p.id + '"><div class="vc-main"><small>' + fdate(p.created) + " · " + A.esc(KINDS[p.kind] || p.kind) + (m ? " · " + A.esc(m.name) : "") + "</small><h3>" + A.esc(u.name) + " <span>" + A.esc(c.title) + "</span></h3>" +
          '<dl><div><dt>Monto</dt><dd>' + usd(p.usd) + (p.ves ? " · " + bs(p.ves) : "") + "</dd></div><div><dt>Referencia</dt><dd>" + A.esc(p.reference || "—") + "</dd></div><div><dt>Fecha del pago</dt><dd>" + fdate(p.date) + "</dd></div>" + (p.note ? "<div><dt>Nota</dt><dd>" + A.esc(p.note) + "</dd></div>" : "") + "</dl></div>" +
          '<div class="vc-act">' + (p.proofId ? '<button class="btn btn-line btn-sm" data-proof="' + p.id + '">Ver comprobante</button>' : '<span class="hint">Sin comprobante</span>') +
          '<button class="btn btn-ghost btn-sm" data-reject="' + p.id + '">Rechazar</button><button class="btn btn-navy btn-sm" data-approve="' + p.id + '">Aprobar y emitir recibo</button></div></article>';
      }).join("") + "</div>" : '<div class="empty">' + A.icon("award") + "<h3>No hay pagos por verificar</h3><p>Cuando un estudiante reporte un pago desde su aula, aparecerá aquí.</p></div>";
      el.onclick = function (e) {
        var b;
        if ((b = e.target.closest("[data-proof]"))) return viewProof(byId(b.dataset.proof));
        if ((b = e.target.closest("[data-approve]"))) {
          var p = byId(b.dataset.approve);
          var d = UI.modal("Aprobar pago", "<p>Confirme que el pago aparece en la cuenta de la academia.</p><label>Monto acreditado en USD<input type=\"number\" step=\"0.01\" min=\"0\" data-v value=\"" + p.usd + '" /></label>' + (p.ves ? '<p class="hint">Reportado: ' + bs(p.ves) + " a " + bs(p.rate) + " por USD.</p>" : ""), '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>Aprobar y emitir recibo</button>');
          d.querySelector("[data-ok]").addEventListener("click", function () {
            var v = +d.querySelector("[data-v]").value; if (!(v > 0)) return A.toast("Monto no válido.", "err");
            p.usd = r2(v); approve(p, user); A.save(); d.close();
            A.toast("Pago aprobado. Recibo " + p.receipt + ".", "ok"); rerender();
          });
          return;
        }
        if ((b = e.target.closest("[data-reject]"))) {
          var p2 = byId(b.dataset.reject);
          var d2 = UI.modal("Rechazar pago", '<label>Motivo (lo verá el estudiante)<select data-v><option>Referencia no encontrada en el banco</option><option>El monto no coincide</option><option>Comprobante ilegible</option><option>Pago duplicado</option><option>Otro</option></select></label><label>Detalle <small>(opcional)</small><input data-d /></label>', '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>Rechazar pago</button>');
          d2.querySelector("[data-ok]").addEventListener("click", function () {
            var det = d2.querySelector("[data-d]").value.trim();
            p2.status = "rechazado"; p2.reason = d2.querySelector("[data-v]").value + (det ? ": " + det : ""); p2.reviewedBy = user.id; p2.reviewedAt = Date.now(); A.save(); d2.close();
            A.toast("Pago rechazado.", "ok"); rerender();
          });
        }
      };
    }

    function tabAccounts(el, onlyLate) {
      var rows = accounts().map(statement).filter(function (s) { return !onlyLate || s.state === "moroso" || s.state === "vencido"; })
        .sort(function (a, b) { return b.overdueDays - a.overdueDays || b.balance - a.balance; });
      el.innerHTML = (onlyLate ? '<p class="hint" style="margin:0 0 12px">Estudiantes con cuotas vencidas. Pasados ' + f.settings.graceDays + " días de gracia pasan a morosos" + (f.settings.blockQuiz ? " y no pueden presentar evaluaciones" : "") + ".</p>" : "") +
        '<div class="toolbar"><input type="search" placeholder="Buscar estudiante o programa" data-q /></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Programa</th><th class="r">Total</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Próxima cuota</th><th>Estado</th><th></th></tr></thead><tbody data-rows></tbody></table></div>';
      function draw(qs) {
        qs = (qs || "").toLowerCase();
        el.querySelector("[data-rows]").innerHTML = rows.filter(function (s) { var u = A.userById(s.account.userId) || {}, c = A.courseById(s.account.courseId) || {}; return !qs || ((u.name || "") + (u.cedula || "") + (c.title || "")).toLowerCase().indexOf(qs) >= 0; }).map(function (s) {
          var u = A.userById(s.account.userId) || { name: "—" }, c = A.courseById(s.account.courseId) || { title: "—" };
          var nx = s.next ? A.esc(s.next.charge.label) + "<br><small class=\"hint\">" + fdate(s.next.charge.due) + " · " + usd(s.next.owe) + "</small>" : "—";
          var wa = phoneIntl(u.phone);
          return '<tr><td><strong>' + A.esc(u.name) + '</strong><br><small class="hint">' + A.esc(u.cedula || "") + "</small></td><td>" + A.esc(c.title) + '</td><td class="r">' + usd(s.total) + '</td><td class="r">' + usd(s.paid) + '</td><td class="r"><b>' + usd(s.balance) + "</b></td><td>" + nx + "</td><td>" + pill(s.state) + (s.overdueDays ? '<br><small class="hint">' + s.overdueDays + " días de atraso</small>" : "") + '</td><td class="row-actions">' +
            '<button class="btn btn-line btn-sm" data-open="' + s.account.id + '">Ver</button>' +
            (s.balance > 0 && wa ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + wa + "?text=" + encodeURIComponent(reminder(u, c, s)) + '">Recordar</a>' : "") + "</td></tr>";
        }).join("") || '<tr><td colspan="8" class="hint">' + (onlyLate ? "No hay estudiantes con cuotas vencidas." : "Sin resultados.") + "</td></tr>";
      }
      draw();
      el.querySelector("[data-q]").addEventListener("input", function () { draw(this.value); });
      el.onclick = function (e) { var b = e.target.closest("[data-open]"); if (b) accountModal(b.dataset.open); };
    }
    function tabLate(el) { tabAccounts(el, true); }
    function reminder(u, c, s) {
      var first = String(u.name || "").split(" ")[0];
      return "Hola " + first + ", le saluda la administración de ACAEMAT Táchira. Le recordamos que tiene un saldo pendiente de " + usd(s.balance) + " en «" + c.title + "»" +
        (s.overdueDays ? ", con " + s.overdueDays + " días de atraso" : "") + ". Puede reportar su pago desde el aula virtual, en «Mis pagos». ¡Gracias!";
    }
    function accountModal(id) {
      var a = f.accounts.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      var d = UI.modal("Estado de cuenta", accountCard(statement(a), "admin"), '<button class="btn btn-navy btn-sm" data-x>Cerrar</button>');
      d.classList.add("modal-wide");
      d.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-receipt]"))) return printReceipt(byId(b.dataset.receipt));
        if ((b = e.target.closest("[data-proof]"))) return viewProof(byId(b.dataset.proof));
        if ((b = e.target.closest("[data-cash]"))) { d.close(); return reportModal(UI, user, b.dataset.cash, rerender, true); }
        if ((b = e.target.closest("[data-plan]"))) { d.close(); return planModal(a); }
      });
    }
    function planModal(a) {
      var c = A.courseById(a.courseId);
      var body = '<p class="hint" style="margin-top:0">' + A.esc(c ? c.title : "") + ". Puede cambiar montos, fechas y conceptos de este estudiante (por ejemplo, una beca o un descuento).</p>" +
        '<div data-ch>' + a.charges.map(rowHTML).join("") + '</div><button class="btn btn-ghost btn-sm" data-add>+ Agregar cargo</button>';
      function rowHTML(ch) { return '<div class="ch-row"><input data-l value="' + A.esc(ch.label) + '" /><input type="number" step="0.01" min="0" data-a value="' + ch.amount + '" /><input type="date" data-d value="' + new Date(ch.due - new Date(ch.due).getTimezoneOffset() * 6e4).toISOString().slice(0, 10) + '" /><button class="icon-btn danger" data-rm title="Quitar">×</button></div>'; }
      var d = UI.modal("Editar plan de pago", body, '<button class="btn btn-line btn-sm" data-x>Cancelar</button><button class="btn btn-navy btn-sm" data-ok>Guardar plan</button>');
      d.querySelector("[data-add]").addEventListener("click", function () { d.querySelector("[data-ch]").insertAdjacentHTML("beforeend", rowHTML({ label: "Cargo adicional", amount: 0, due: Date.now() })); });
      d.addEventListener("click", function (e) { var b = e.target.closest("[data-rm]"); if (b) b.closest(".ch-row").remove(); });
      d.querySelector("[data-ok]").addEventListener("click", function () {
        var out = [];
        d.querySelectorAll(".ch-row").forEach(function (r) {
          var l = r.querySelector("[data-l]").value.trim() || "Cargo", amt = r2(r.querySelector("[data-a]").value), dt = r.querySelector("[data-d]").value.split("-");
          if (amt > 0 && dt.length === 3) out.push({ id: A.uid("ch"), label: l, amount: amt, due: new Date(+dt[0], +dt[1] - 1, +dt[2], 12).getTime() });
        });
        a.charges = out; A.save(); d.close(); A.toast("Plan de pago actualizado.", "ok"); rerender();
      });
    }

    function tabReports(el) {
      var now = new Date(), months = [];
      for (var i = 5; i >= 0; i--) { var m = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(m); }
      var ok = f.payments.filter(function (p) { return p.status === "aprobado"; });
      var byMonth = months.map(function (m) {
        var n = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        return { m: m, v: r2(ok.filter(function (p) { var t = p.reviewedAt || p.date; return t >= m.getTime() && t < n.getTime(); }).reduce(function (s, p) { return s + p.usd; }, 0)) };
      });
      var max = Math.max.apply(null, byMonth.map(function (x) { return x.v; }).concat([1]));
      var thisM = byMonth[byMonth.length - 1].v, sts = accounts().map(statement);
      var receivable = r2(sts.reduce(function (s, x) { return s + x.balance; }, 0)), overdueAmt = r2(sts.reduce(function (s, x) { return s + x.overdueAmt; }, 0));
      var byKind = {}, byCourse = {};
      ok.forEach(function (p) { byKind[p.kind] = r2((byKind[p.kind] || 0) + p.usd); byCourse[p.courseId] = r2((byCourse[p.courseId] || 0) + p.usd); });
      el.innerHTML =
        '<div class="stats">' + stat(usd(thisM), "Cobrado este mes") + stat(usd(receivable), "Por cobrar (saldo total)") + stat(usd(overdueAmt), "Vencido") + stat(sts.filter(function (s) { return s.state === "moroso"; }).length, "Estudiantes morosos") + "</div>" +
        '<div class="editor editor--dash">' +
          '<div class="panel"><h2>Cobrado por mes</h2><div class="bars">' + byMonth.map(function (x) {
            return '<div class="bar-col"><span class="bv">' + usd(x.v) + '</span><i style="height:' + Math.max(2, Math.round(x.v / max * 100)) + '%"></i><span class="bl">' + x.m.toLocaleDateString("es-VE", { month: "short" }) + "</span></div>";
          }).join("") + "</div></div>" +
          '<div class="panel"><h2>Por método de pago</h2>' + table(byKind, function (k) { return KINDS[k] || k; }) + "<h2 style=\"margin-top:18px\">Por programa</h2>" + table(byCourse, function (k) { var c = A.courseById(k); return c ? c.title : "—"; }) + "</div>" +
        "</div>" +
        '<p class="hint" style="margin-top:14px">Para el detalle completo, use «Descargar respaldo»: incluye todos los pagos en Excel.</p>';
      function table(o, label) {
        var ks = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; });
        return ks.length ? '<table class="tbl-compact"><tbody>' + ks.map(function (k) { return "<tr><td>" + A.esc(label(k)) + '</td><td class="r"><b>' + usd(o[k]) + "</b></td></tr>"; }).join("") + "</tbody></table>" : '<p class="hint">Sin pagos aprobados.</p>';
      }
    }

    function tabConfig(el) {
      var cs = A.db().courses;
      el.innerHTML =
        '<div class="panel"><h2>Precios por programa</h2><p class="hint" style="margin:-6px 0 12px">En dólares. Los cambios aplican a las inscripciones nuevas; los planes ya creados se editan desde el estado de cuenta de cada estudiante.</p>' +
          '<div class="table-wrap"><table class="tbl-compact"><thead><tr><th>Programa</th><th>Precio total (USD)</th><th>Inscripción (USD)</th><th>Cuotas mensuales</th></tr></thead><tbody>' +
          cs.map(function (c) { var p = f.prices[c.id]; return '<tr data-c="' + c.id + '"><td>' + A.esc(c.title) + '</td><td><input type="number" min="0" step="1" data-k="price" value="' + p.price + '" /></td><td><input type="number" min="0" step="1" data-k="enrollFee" value="' + p.enrollFee + '" /></td><td><select data-k="installments">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (n === +p.installments ? " selected" : "") + ">" + (n === 1 ? "Pago único" : n + " cuotas") + "</option>"; }).join("") + "</select></td></tr>"; }).join("") +
          '</tbody></table></div><div class="acct-act"><button class="btn btn-navy btn-sm" data-save-prices>Guardar precios</button></div></div>' +
        '<div class="panel" style="margin-top:20px"><h2>Métodos de pago</h2><p class="hint" style="margin:-6px 0 12px">Estos datos los ve el estudiante al pagar.</p><div data-methods></div><button class="btn btn-ghost btn-sm" data-add-m>+ Agregar método</button><div class="acct-act"><button class="btn btn-navy btn-sm" data-save-m>Guardar métodos</button></div></div>' +
        '<div class="panel" style="margin-top:20px"><h2>Reglas de solvencia</h2>' +
          '<label>Días de gracia después del vencimiento<input type="number" min="0" max="60" data-g value="' + f.settings.graceDays + '" style="max-width:120px" /></label>' +
          '<label class="check"><input type="checkbox" data-bq' + (f.settings.blockQuiz ? " checked" : "") + " /> Los morosos no pueden presentar evaluaciones (siguen viendo las clases)</label>" +
          '<label class="check"><input type="checkbox" data-cs' + (f.settings.certSolvent ? " checked" : "") + " /> El certificado solo se emite con el programa pagado por completo</label>" +
          '<div class="acct-act"><button class="btn btn-navy btn-sm" data-save-r>Guardar reglas</button></div></div>';
      var mbox = el.querySelector("[data-methods]");
      function mrow(m) {
        return '<div class="m-row" data-id="' + (m.id || "") + '"><select data-k="kind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (k === m.kind ? " selected" : "") + ">" + KINDS[k] + "</option>"; }).join("") + '</select><input data-k="name" value="' + A.esc(m.name || "") + '" placeholder="Nombre visible" /><input data-k="details" value="' + A.esc(m.details || "") + '" placeholder="Banco, teléfono, cuenta, correo…" /><label class="check"><input type="checkbox" data-k="active"' + (m.active !== false ? " checked" : "") + ' /> Activo</label><button class="icon-btn danger" data-rm-m title="Quitar">×</button></div>';
      }
      mbox.innerHTML = f.settings.methods.map(mrow).join("");
      el.querySelector("[data-add-m]").addEventListener("click", function () { mbox.insertAdjacentHTML("beforeend", mrow({ kind: "pagomovil", active: true })); });
      el.addEventListener("click", function (e) { var b = e.target.closest("[data-rm-m]"); if (b) b.closest(".m-row").remove(); });
      el.querySelector("[data-save-prices]").addEventListener("click", function () {
        var bad = false;
        el.querySelectorAll("tr[data-c]").forEach(function (tr) {
          var p = f.prices[tr.dataset.c], price = +tr.querySelector('[data-k="price"]').value, fee = +tr.querySelector('[data-k="enrollFee"]').value;
          if (fee > price) { bad = true; return; }
          p.price = r2(price); p.enrollFee = r2(fee); p.installments = +tr.querySelector('[data-k="installments"]').value;
        });
        if (bad) return A.toast("La inscripción no puede ser mayor que el precio total.", "err");
        A.save(); A.toast("Precios guardados.", "ok");
      });
      el.querySelector("[data-save-m]").addEventListener("click", function () {
        var out = [];
        mbox.querySelectorAll(".m-row").forEach(function (r) {
          var g = function (k) { return r.querySelector('[data-k="' + k + '"]'); };
          var name = g("name").value.trim(), det = g("details").value.trim();
          if (!name && !det) return;
          out.push({ id: r.dataset.id || A.uid("pm"), kind: g("kind").value, name: name || KINDS[g("kind").value], details: det, active: g("active").checked });
        });
        if (!out.some(function (m) { return m.active; })) return A.toast("Deje al menos un método activo.", "err");
        f.settings.methods = out; A.save(); A.toast("Métodos de pago guardados.", "ok");
      });
      el.querySelector("[data-save-r]").addEventListener("click", function () {
        f.settings.graceDays = Math.max(0, Math.min(60, +el.querySelector("[data-g]").value || 0));
        f.settings.blockQuiz = el.querySelector("[data-bq]").checked; f.settings.certSolvent = el.querySelector("[data-cs]").checked;
        A.save(); A.toast("Reglas guardadas.", "ok");
      });
    }
  }

  window.ACAEMAT_PAY = {
    fin: F, accounts: accounts, statement: statement, stateOf: stateOf, userState: userState, pill: pill, STATE: STATE,
    quizBlocked: quizBlocked, certBlocked: certBlocked, pendingCount: pendingCount, KINDS: KINDS,
    studentView: studentView, adminView: adminView, printReceipt: printReceipt, usd: usd, bs: bs, fdate: fdate
  };
})();
