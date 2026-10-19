(function () {
  "use strict";
  var SEGS = window.DK_SEGMENTS || [];
  var OBORY = window.DK_OBORY || {};
  var DK = "https://datakompas.cz/cileni/";
  var CATS = {
    profil: { name: "Dlouhodobý profil", short: "Profil", hint: "Kdo uživatelé jsou a co je dlouhodobě zajímá" },
    udalost: { name: "Životní událost", short: "Událost", hint: "Přelomové momenty, které mění nákupní priority" },
    zamer: { name: "Nákupní záměr", short: "Záměr", hint: "Aktivně řeší konkrétní potřebu a chystají se nakoupit" }
  };
  var app = document.getElementById("app");
  var qInput = document.getElementById("q");

  /* ---------- helpers ---------- */
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.%,]+/g, " ").trim();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fmt(n) { return n.toLocaleString("cs-CZ"); }
  function bySlug(s) { return INDEX[s]; }
  function stem(t) { return t.length > 5 ? t.slice(0, Math.max(5, t.length - 2)) : t; }
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  /* ---------- index ---------- */
  var INDEX = {};
  var MEMBER = {}; // slug -> [{obor, cl}]
  var CL_LIST = [];
  SEGS.forEach(function (s) { INDEX[s.s] = s; MEMBER[s.s] = []; });
  Object.keys(OBORY).forEach(function (ok) {
    OBORY[ok].clusters.forEach(function (cl) {
      cl.obor = ok;
      cl._hay = norm(cl.name + " " + cl.keywords + " " + cl.clients + " " + cl.note);
      CL_LIST.push(cl);
      cl.segments.forEach(function (s) { if (MEMBER[s]) MEMBER[s].push(cl); });
    });
  });
  SEGS.forEach(function (s) {
    s._n = norm(s.n);
    s._d = norm(s.d + " " + CATS[s.c].name);
    s._i = (s.i || []).map(function (x) { return norm(x[0]); });
    s._ip = (s.i || []).map(function (x) { return (parseFloat(String(x[1]).replace(',', '.')) || 0) / 100; });
    s._w = (s.w || []).map(function (x) { return norm(x[0]); });
    s._wp = (s.w || []).map(function (x) { return (parseFloat(String(x[1]).replace(',', '.')) || 0) / 100; });
    s._cl = norm(MEMBER[s.s].map(function (c) { return c.name + " " + c.keywords; }).join(" "));
  });

  function wordHit(hay, t) {
    // 3 = celé slovo, 2 = začátek slova, 1 = podřetězec (jen u delších dotazů)
    if (!hay) return 0;
    var best = 0, from = 0, i;
    while ((i = hay.indexOf(t, from)) >= 0) {
      var start = i === 0 || hay[i - 1] === " ";
      var end = i + t.length === hay.length || hay[i + t.length] === " ";
      var lvl = start ? (end ? 3 : 2) : (t.length >= 4 ? 1 : 0);
      if (lvl > best) best = lvl;
      if (best === 3) break;
      from = i + 1;
    }
    return best;
  }

  function search(q) {
    var toks = norm(q).split(" ").filter(function (t) { return t.length > 1; });
    if (!toks.length) return { segs: [], cls: [], toks: [] };
    var stems = toks.map(stem);
    var res = [];
    SEGS.forEach(function (s) {
      var score = 0, hits = { i: [], w: [] }, ok = true;
      for (var k = 0; k < stems.length; k++) {
        var t = stems[k], sc = 0, h;
        var W = [0, 1, 4, 6];
        if ((h = wordHit(s._n, t))) sc += 3 * W[h] + (s._n.indexOf(t) === 0 ? 4 : 0);
        if ((h = wordHit(s._d, t))) sc += W[h];
        if ((h = wordHit(s._cl, t))) sc += W[h] * 0.6;
        s._i.forEach(function (x, j) { var hh = wordHit(x, t); if (hh > 1) { sc += W[hh] * (0.9 + s._ip[j] * 1.5); if (hits.i.indexOf(j) < 0) hits.i.push(j); } });
        s._w.forEach(function (x, j) { var hh = wordHit(x, t); if (hh > 1) { sc += W[hh] * (0.6 + s._wp[j] * 1.5); if (hits.w.indexOf(j) < 0) hits.w.push(j); } });
        if (!sc) { ok = false; break; }
        score += sc;
      }
      if (ok) res.push({ s: s, score: score + Math.log10(s.un + 10) * 0.6, hits: hits });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    var cls = CL_LIST.filter(function (cl) {
      return stems.every(function (t) { return wordHit(cl._hay, t) > 1; });
    });
    return { segs: res, cls: cls, toks: stems };
  }

  function mark(text, toks) {
    var out = esc(text);
    if (!toks || !toks.length) return out;
    // highlight in a diacritic-insensitive way: map normalized positions
    var src = String(text), n = "", map = [];
    for (var i = 0; i < src.length; i++) {
      var c = src[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      for (var j = 0; j < c.length; j++) { n += c[j]; map.push(i); }
    }
    var ranges = [];
    toks.forEach(function (t) {
      var from = 0, p;
      while ((p = n.indexOf(t, from)) >= 0) {
        var st = p === 0 || !/[a-z0-9]/.test(n[p - 1]);
        if (st || t.length >= 4) ranges.push([map[p], map[p + t.length - 1] + 1]);
        from = p + t.length;
      }
    });
    if (!ranges.length) return out;
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0]];
    ranges.slice(1).forEach(function (r) { var m = merged[merged.length - 1]; if (r[0] <= m[1]) m[1] = Math.max(m[1], r[1]); else merged.push(r); });
    var html = "", last = 0;
    merged.forEach(function (r) { html += esc(src.slice(last, r[0])) + "<mark>" + esc(src.slice(r[0], r[1])) + "</mark>"; last = r[1]; });
    return html + esc(src.slice(last));
  }

  /* ---------- rendering ---------- */
  function badge(c) { return '<span class="badge b-' + c + '" title="' + esc(CATS[c].hint) + '">' + CATS[c].name + "</span>"; }

  function bars(list, max) {
    return '<ul class="bars">' + list.map(function (x) {
      var pc = parseFloat(String(x[1]).replace(",", ".")) || 0;
      return '<li style="--w:' + Math.min(100, pc) + '%"><span>' + esc(x[0]) + '</span><span class="pc">' + esc(x[1]) + '</span><span class="x">' + esc(x[2] || "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function segCard(s, opt) {
    opt = opt || {};
    var toks = opt.toks, hits = opt.hits;
    var url = DK + s.s + "/";
    var cls = MEMBER[s.s].map(function (cl) {
      return '<a class="badge b-cl" href="#/obor/' + cl.obor + "/" + cl.id + '">' + OBORY[cl.obor].icon + " " + esc(cl.name) + "</a>";
    }).join("");
    var hitHtml = "";
    if (hits && (hits.i.length || hits.w.length)) {
      var parts = [];
      hits.i.slice(0, 3).forEach(function (j) { var x = s.i[j]; parts.push("zájem <b>" + mark(x[0], toks) + "</b> " + esc(x[1]) + " · " + esc(x[2])); });
      hits.w.slice(0, 2).forEach(function (j) { var x = s.w[j]; parts.push("web <b>" + mark(x[0], toks) + "</b> " + esc(x[1]) + " · " + esc(x[2])); });
      hitHtml = '<div class="hit">Shoda v detailu: ' + parts.join(" &nbsp;|&nbsp; ") + "</div>";
    }
    var hasDt = s.i || s.w;
    return '<article class="seg" data-s="' + s.s + '">' +
      '<div class="seg-top"><div>' +
      '<h3><a href="' + url + '" target="_blank" rel="noopener">' + mark(s.n, toks) + "</a></h3>" +
      '<p class="desc">' + mark(s.d, toks) + "</p>" +
      "</div>" +
      '<div class="size"><b>' + esc(s.u) + '</b><span>' + esc(s.p) + " % uživatelů</span></div></div>" +
      hitHtml +
      '<div class="meta">' + badge(s.c) + cls + "</div>" +
      '<div class="seg-actions">' +
      '<a class="go" href="' + url + '" target="_blank" rel="noopener">Detail na Datakompasu ↗</a>' +
      (hasDt ? '<span class="muted">·</span><button class="more" type="button" aria-expanded="false">Top zájmy a weby ▾</button>' : "") +
      "</div>" +
      (hasDt ? '<div class="dt">' +
        (s.i ? "<div><h4>Co cílovku zajímá</h4>" + bars(s.i) + "</div>" : "") +
        (s.w ? "<div><h4>Kde tráví čas (weby Seznamu)</h4>" + bars(s.w) + "</div>" : "") +
        "</div>" : "") +
      "</article>";
  }

  function setNav(key) {
    document.querySelectorAll(".nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === key); });
  }

  /* ---------- views ---------- */
  var state = { cat: "all", sort: "rel" };

  function viewSearch(q) {
    setNav("home");
    var r = search(q);
    var list = r.segs.filter(function (x) { return state.cat === "all" || x.s.c === state.cat; });
    if (state.sort === "size") list = list.slice().sort(function (a, b) { return b.s.un - a.s.un; });
    var counts = { all: r.segs.length, profil: 0, udalost: 0, zamer: 0 };
    r.segs.forEach(function (x) { counts[x.s.c]++; });
    var html = "";
    if (r.cls.length) {
      html += '<div class="clhits">' + r.cls.map(function (cl) {
        return '<a class="clhit" href="#/obor/' + cl.obor + "/" + cl.id + '">' + OBORY[cl.obor].icon + " " + esc(cl.name) + " <small>cluster · " + cl.segments.length + " segmentů</small></a>";
      }).join("") + "</div>";
    }
    html += '<div class="toolbar"><div class="chips" style="margin:0">' +
      ["all", "zamer", "udalost", "profil"].map(function (c) {
        return '<button class="chip' + (state.cat === c ? " on" : "") + '" data-cat="' + c + '">' + (c === "all" ? "Vše" : CATS[c].name) + '<span class="n">' + counts[c] + "</span></button>";
      }).join("") + "</div>" +
      '<select class="btn" id="sort" aria-label="Řazení"><option value="rel"' + (state.sort === "rel" ? " selected" : "") + '>Nejrelevantnější</option><option value="size"' + (state.sort === "size" ? " selected" : "") + ">Největší cílovka</option></select></div>";
    if (!list.length) {
      html += '<div class="empty"><b>Nic jsme nenašli pro „' + esc(q) + '“.</b><br>Zkuste obecnější slovo (např. „auto“ místo „octavia“), nebo projděte <a href="#/obor/reality">reality</a>, <a href="#/obor/auto">automotive</a> či <a href="#/vse">všechny segmenty</a>.</div>';
    } else {
      html += '<div class="list">' + list.slice(0, 120).map(function (x) { return segCard(x.s, { toks: r.toks, hits: x.hits }); }).join("") + "</div>";
    }
    app.innerHTML = html;
    app.querySelectorAll("[data-cat]").forEach(function (b) { b.onclick = function () { state.cat = b.getAttribute("data-cat"); viewSearch(q); }; });
    document.getElementById("sort").onchange = function (e) { state.sort = e.target.value; viewSearch(q); };
  }

  function viewHome() {
    setNav("home");
    var withDt = SEGS.filter(function (s) { return s.i; }).length;
    var cnt = { profil: 0, udalost: 0, zamer: 0 };
    SEGS.forEach(function (s) { cnt[s.c]++; });
    var quick = ["hypotéka", "novostavba", "pronájem", "rekonstrukce", "fotovoltaika", "ojeté auto", "SUV", "elektromobil", "pneumatiky", "leasing", "Sreality.cz", "Sauto.cz"];
    var html = '<h1>Najděte správný segment za pár vteřin</h1>' +
      '<p class="lead">Napište, co klient prodává nebo koho chce oslovit. Hledáme v názvech, popisech, top zájmech i webech všech ' + SEGS.length + ' segmentů Datakompasu – proklikem pak otevřete detail přímo na datakompas.cz.</p>' +
      '<div class="chips">' + quick.map(function (w) { return '<a class="chip" href="#/hledat?q=' + encodeURIComponent(w) + '">' + esc(w) + "</a>"; }).join("") + "</div>" +
      '<div class="stats">' +
      '<div class="stat"><b>' + SEGS.length + '</b><span>segmentů celkem</span></div>' +
      '<div class="stat"><b>' + cnt.zamer + '</b><span>nákupních záměrů</span></div>' +
      '<div class="stat"><b>' + cnt.udalost + '</b><span>životních událostí</span></div>' +
      '<div class="stat"><b>' + cnt.profil + '</b><span>dlouhodobých profilů</span></div>' +
      "</div>" +
      "<h2>Oborové clustery</h2>" +
      '<div class="obory">' + Object.keys(OBORY).map(function (ok) {
        var o = OBORY[ok];
        return '<section class="obor"><div class="obor-h"><h3>' + o.icon + " " + esc(o.name) + '</h3><a href="#/obor/' + ok + '">Otevřít →</a></div>' +
          "<p>" + esc(o.lead) + "</p>" +
          '<div class="cl-links">' + o.clusters.map(function (cl) { return '<a href="#/obor/' + ok + "/" + cl.id + '">' + esc(cl.name) + "</a>"; }).join("") + "</div></section>";
      }).join("") + "</div>" +
      "<h2>Největší nákupní záměry</h2>" +
      '<div class="list">' + SEGS.filter(function (s) { return s.c === "zamer"; }).slice(0, 5).map(function (s) { return segCard(s); }).join("") + "</div>" +
      '<p class="muted" style="margin-top:14px"><a href="#/vse">Zobrazit všech ' + SEGS.length + " segmentů →</a></p>";
    app.innerHTML = html;
  }

  function viewObor(ok) {
    var o = OBORY[ok];
    if (!o) return viewNotFound();
    setNav(ok);
    var html = '<div class="crumbs"><a href="#/">Hledat</a> › ' + esc(o.name) + "</div>" +
      "<h1>" + o.icon + " " + esc(o.name) + "</h1>" +
      '<p class="lead">' + esc(o.lead) + " Vyberte cluster a projděte segmenty seřazené podle velikosti.</p>" +
      '<div class="cgrid">' + o.clusters.map(function (cl) {
        var segs = cl.segments.map(bySlug).sort(function (a, b) { return b.un - a.un; });
        return '<a class="ccard" href="#/obor/' + ok + "/" + cl.id + '"><span class="cnt">' + segs.length + " segmentů</span>" +
          "<h3>" + esc(cl.name) + "</h3><p>" + esc(cl.note) + "</p>" +
          '<ul class="top3">' + segs.slice(0, 3).map(function (s) { return "<li><span>" + esc(s.n) + "</span><span>" + esc(s.u) + "</span></li>"; }).join("") + "</ul>" +
          '<div class="who"><b>Komu nabídnout:</b> ' + esc(cl.clients) + "</div></a>";
      }).join("") + "</div>";
    app.innerHTML = html;
  }

  function viewCluster(ok, id) {
    var o = OBORY[ok];
    var cl = o && o.clusters.filter(function (c) { return c.id === id; })[0];
    if (!cl) return viewNotFound();
    setNav(ok);
    var segs = cl.segments.map(bySlug).sort(function (a, b) {
      var order = { zamer: 0, udalost: 1, profil: 2 };
      return state.clSort === "size" ? b.un - a.un : (order[a.c] - order[b.c]) || (b.un - a.un);
    });
    var html = '<div class="crumbs"><a href="#/">Hledat</a> › <a href="#/obor/' + ok + '">' + esc(o.name) + "</a> › " + esc(cl.name) + "</div>" +
      '<div class="clhead"><h1>' + o.icon + " " + esc(cl.name) + '</h1><p class="lead" style="margin:0">' + esc(cl.note) + '</p><p class="who"><b>Komu nabídnout:</b> ' + esc(cl.clients) + "</p></div>" +
      '<div class="toolbar"><p class="resinfo">' + segs.length + ' segmentů · seřazeno ' + (state.clSort === "size" ? "podle velikosti" : "od nákupních záměrů po profily") + "</p>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><select class="btn" id="clsort" aria-label="Řazení"><option value="type">Záměr → Událost → Profil</option><option value="size"' + (state.clSort === "size" ? " selected" : "") + '>Podle velikosti</option></select>' +
      '<button class="btn" id="copy" type="button">Kopírovat seznam</button></div></div>' +
      '<div class="list">' + segs.map(function (s) { return segCard(s); }).join("") + "</div>" +
      "<h2>Další clustery v oboru " + esc(o.name) + "</h2>" +
      '<div class="cl-links">' + o.clusters.filter(function (c) { return c.id !== id; }).map(function (c) { return '<a href="#/obor/' + ok + "/" + c.id + '">' + esc(c.name) + "</a>"; }).join("") + "</div>";
    app.innerHTML = html;
    document.getElementById("clsort").onchange = function (e) { state.clSort = e.target.value; viewCluster(ok, id); };
    document.getElementById("copy").onclick = function () {
      var txt = cl.name + " (" + o.name + ")\n" + segs.map(function (s) { return "• " + s.n + " – " + s.u + " (" + s.p + " %) – " + DK + s.s + "/"; }).join("\n");
      copy(txt);
    };
  }

  function viewAll(cat) {
    setNav("vse");
    cat = CATS[cat] ? cat : "zamer";
    var segs = SEGS.filter(function (s) { return s.c === cat; });
    var html = '<div class="crumbs"><a href="#/">Hledat</a> › Všechny segmenty</div><h1>Všechny segmenty</h1>' +
      '<p class="lead">' + esc(CATS[cat].hint) + ".</p>" +
      '<div class="tabs">' + ["zamer", "udalost", "profil"].map(function (c) {
        var n = SEGS.filter(function (s) { return s.c === c; }).length;
        return '<a class="chip' + (c === cat ? " on" : "") + '" href="#/vse/' + c + '">' + CATS[c].name + '<span class="n">' + n + "</span></a>";
      }).join("") + "</div>" +
      '<div class="list">' + segs.map(function (s) { return segCard(s); }).join("") + "</div>";
    app.innerHTML = html;
  }

  function viewNotFound() {
    setNav("");
    app.innerHTML = '<div class="empty">Stránka neexistuje. <a href="#/">Zpět na hledání</a></div>';
  }

  function copy(txt) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Zkopírováno do schránky"); } catch (e) { toast("Kopírování se nepodařilo"); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { toast("Zkopírováno do schránky"); }, fallback);
    else fallback();
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash.replace(/^#/, "") || "/";
    var parts = h.split("?"), path = parts[0].split("/").filter(Boolean);
    var params = new URLSearchParams(parts[1] || "");
    if (path[0] === "hledat") {
      var q = params.get("q") || "";
      if (qInput.value !== q) qInput.value = q;
      q.trim() ? viewSearch(q) : viewHome();
    } else {
      if (document.activeElement !== qInput) qInput.value = "";
      if (!path.length) viewHome();
      else if (path[0] === "obor" && path[2]) viewCluster(path[1], path[2]);
      else if (path[0] === "obor") viewObor(path[1]);
      else if (path[0] === "vse") viewAll(path[1]);
      else viewNotFound();
    }
  }

  var tmr;
  qInput.addEventListener("input", function () {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      var q = qInput.value.trim();
      var target = q ? "#/hledat?q=" + encodeURIComponent(q) : "#/";
      if (location.hash.indexOf("#/hledat") === 0) history.replaceState(null, "", target); else history.pushState(null, "", target);
      state.cat = state.cat || "all";
      route();
    }, 120);
  });
  qInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { qInput.value = ""; location.hash = "#/"; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== qInput && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); qInput.focus(); qInput.select(); }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest(".more");
    if (!b) return;
    var card = b.closest(".seg"); var open = card.classList.toggle("open");
    b.setAttribute("aria-expanded", open); b.textContent = open ? "Skrýt detail ▴" : "Top zájmy a weby ▾";
  });
  window.addEventListener("hashchange", function () { route(); if (location.hash.indexOf("#/hledat") !== 0) window.scrollTo(0, 0); });
  route();
})();
