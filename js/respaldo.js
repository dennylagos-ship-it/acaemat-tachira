/* =========================================================================
   ACAEMAT — Respaldo para la PC del dueño
   excel(): un .xlsx con una hoja por tema (se abre en Excel o Google Sheets)
   json():  copia completa de los datos, para restaurar si hiciera falta
   La librería de Excel (lib/xlsx.full.min.js) se carga solo al pulsar el botón.
   ========================================================================= */
(function () {
  "use strict";
  var A = window.ACAEMAT;

  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function dt(ts) { return ts ? new Date(ts) : ""; }
  function lib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "lib/xlsx.full.min.js?v=0.18.5";
      s.onload = function () { window.XLSX ? res(window.XLSX) : rej(new Error("No se pudo cargar Excel.")); };
      s.onerror = function () { rej(new Error("No se pudo cargar la herramienta de Excel. Revise su conexión.")); };
      document.head.appendChild(s);
    });
  }
  function download(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function sheets() {
    var db = A.db(), PAY = window.ACAEMAT_PAY, LIVE = window.ACAEMAT_LIVE;
    var ROLE = { admin: "Administración", instructor: "Docente", student: "Estudiante" };
    var uName = function (id) { var u = A.userById(id); return u ? u.name : "—"; };
    var uCed = function (id) { var u = A.userById(id); return u ? u.cedula || "" : ""; };
    var cName = function (id) { var c = A.courseById(id); return c ? c.title : "—"; };
    var out = {};

    out["Usuarios"] = db.users.map(function (u) {
      return { Nombre: u.name, "Cédula": u.cedula || "", Correo: u.email, "Teléfono": u.phone || "", Rol: ROLE[u.role] || u.role, Registrado: dt(u.created),
        "Estado de pagos": PAY && u.role === "student" ? PAY.STATE[PAY.userState(u.id)].label : "" };
    });
    out["Inscripciones"] = db.enrollments.map(function (e) {
      var c = A.courseById(e.courseId), p = c ? A.progressOf(e.userId, c) : { pct: 0 };
      return { Estudiante: uName(e.userId), "Cédula": uCed(e.userId), Programa: cName(e.courseId), "Fecha de inscripción": dt(e.date), "Avance (%)": p.pct, Completado: p.pct === 100 ? "Sí" : "No" };
    });
    out["Programas"] = db.courses.map(function (c) {
      var pr = PAY ? PAY.fin().prices[c.id] || {} : {};
      return { Programa: c.title, "Área": c.category, Horas: +c.hours, Modalidad: c.modality, Nivel: c.level, Publicado: c.published ? "Sí" : "No",
        "Módulos": (c.modules || []).length, Lecciones: A.allLessons(c).length, "Precio (USD)": pr.price || "", "Inscripción (USD)": pr.enrollFee || 0, Cuotas: pr.installments || "" };
    });
    if (PAY) {
      var f = PAY.fin(), cuotas = [];
      PAY.accounts().forEach(function (a) {
        PAY.statement(a).rows.forEach(function (r) {
          cuotas.push({ Estudiante: uName(a.userId), "Cédula": uCed(a.userId), Programa: cName(a.courseId), Concepto: r.charge.label, Vence: dt(r.charge.due),
            "Monto (USD)": r.charge.amount, "Pagado (USD)": r.paid, "Pendiente (USD)": r.owe,
            Estado: { pagada: "Pagada", abonada: "Abonada", porvencer: "Por vencer", vencida: "Vencida" }[r.status] });
        });
      });
      out["Cuotas"] = cuotas;
      out["Pagos"] = f.payments.slice().sort(function (a, b) { return b.date - a.date; }).map(function (p) {
        var m = f.settings.methods.filter(function (x) { return x.id === p.methodId; })[0];
        return { "Fecha del pago": dt(p.date), Reportado: dt(p.created), Estudiante: uName(p.userId), "Cédula": uCed(p.userId), Programa: cName(p.courseId),
          "Método": PAY.KINDS[p.kind] || p.kind, Cuenta: m ? m.name : "", Referencia: p.reference || "", "Monto (USD)": p.usd, "Monto (Bs)": p.ves || "", "Tasa (Bs/USD)": p.ves ? p.rate : "",
          Estado: { aprobado: "Aprobado", pendiente: "Por verificar", rechazado: "Rechazado" }[p.status], "Motivo de rechazo": p.reason || "", Recibo: p.receipt || "",
          "Verificado el": dt(p.reviewedAt), "Verificado por": p.reviewedBy ? uName(p.reviewedBy) : "", Nota: p.note || "" };
      });
    }
    if (LIVE) out["Clases en vivo"] = LIVE.all().slice().sort(function (a, b) { return a.start - b.start; }).map(function (c) {
      return { Inicio: dt(c.start), "Duración (min)": c.duration, Programa: cName(c.courseId), Tema: c.title, Plataforma: LIVE.PLAT[c.platform].name, Enlace: c.url, "Grabación": c.recording || "" };
    });
    out["Solicitudes"] = (db.leads || []).map(function (l) {
      return { Fecha: dt(l.date), Nombre: l.name, "Teléfono": l.phone || "", Correo: l.email || "", Programa: cName(l.courseId), Mensaje: l.message || "", Estado: l.status || "" };
    });
    return out;
  }

  function excel() {
    A.toast("Preparando el respaldo…");
    return lib().then(function (X) {
      var wb = X.utils.book_new(), data = sheets();
      Object.keys(data).forEach(function (name) {
        var rows = data[name];
        var ws = rows.length ? X.utils.json_to_sheet(rows, { cellDates: true, dateNF: "dd/mm/yyyy" }) : X.utils.aoa_to_sheet([["Sin datos"]]);
        if (rows.length) {
          ws["!cols"] = Object.keys(rows[0]).map(function (k) {
            var w = Math.max(k.length, rows.reduce(function (m, r) { var v = r[k]; return Math.max(m, v instanceof Date ? 11 : String(v == null ? "" : v).length); }, 0));
            return { wch: Math.min(48, w + 2) };
          });
          ws["!autofilter"] = { ref: ws["!ref"] };
        }
        X.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      });
      X.writeFile(wb, "ACAEMAT-respaldo-" + stamp() + ".xlsx", { compression: true });
      try { localStorage.setItem("acaemat_last_backup", String(Date.now())); } catch (e) {}
      A.toast("Respaldo descargado en su carpeta de Descargas.", "ok");
    }).catch(function (e) { A.toast(e.message, "err"); });
  }
  function json() {
    var blob = new Blob([JSON.stringify({ app: "ACAEMAT Táchira", exported: new Date().toISOString(), data: A.db() }, null, 1)], { type: "application/json" });
    download(blob, "ACAEMAT-copia-completa-" + stamp() + ".json");
    try { localStorage.setItem("acaemat_last_backup", String(Date.now())); } catch (e) {}
    A.toast("Copia completa descargada.", "ok");
  }
  function last() { try { return +localStorage.getItem("acaemat_last_backup") || 0; } catch (e) { return 0; } }

  window.ACAEMAT_BACKUP = { excel: excel, json: json, last: last };
})();
