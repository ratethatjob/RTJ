/* RateThatJob widgets – https://ratethatjob.com
   Index badge:
   <div class="rtj-index" data-location="ID" data-style="wide-dark" data-locale="en">
     <a href="https://ratethatjob.com/...">Fallback link</a>
   </div>
   Open jobs (one job, a location, or a whole company), always with the RateThatJob Index:
   <div data-rtj-jobs="location" data-id="ID" data-theme="light" data-locale="en">
     <a href="https://ratethatjob.com/...">Fallback link</a>
   </div>
   No cookies, no dependencies. Renders inside Shadow DOM. */
(function () {
  "use strict";
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://ratethatjob.com";
  var STYLES = ["compact-light", "compact-dark", "wide-light", "wide-dark", "strip", "seal", "seal-light"];

  function render(el) {
    if (el.getAttribute("data-rtj-done")) return;
    el.setAttribute("data-rtj-done", "1");
    var id = el.getAttribute("data-location");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    var style = el.getAttribute("data-style");
    if (STYLES.indexOf(style) < 0) style = "wide-light";
    var locale = el.getAttribute("data-locale") || document.documentElement.lang || "en";
    locale = locale.slice(0, 2).toLowerCase();
    var fallback = el.querySelector("a");
    var src =
      origin + "/embed/" + id + (style.indexOf("seal") === 0 ? "/seal.svg" : ".svg") +
      "?style=" + encodeURIComponent(style) + "&locale=" + encodeURIComponent(locale);

    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return Promise.all([r.text(), fetch(origin + "/api/public/locations/" + id + "/index").then(function (j) { return j.json(); })]);
      })
      .then(function (res) {
        var data = res[1] || {};
        var href = data.status !== "inactive" && data.score == null && data.rate_url ? data.rate_url : data.profile_url;
        if (!href && fallback) href = fallback.href;
        var root = el.attachShadow ? el.attachShadow({ mode: "open" }) : el;
        var a = document.createElement("a");
        a.href = href || origin;
        a.target = "_blank";
        a.rel = "noopener";
        a.setAttribute("aria-label", (fallback && fallback.textContent) || "RateThatJob");
        a.style.cssText = "display:inline-block;line-height:0;text-decoration:none";
        // The SVG comes from our own endpoint and escapes all text.
        a.innerHTML = res[0];
        var svg = a.querySelector("svg");
        if (svg) svg.style.maxWidth = "100%";
        if (root === el) el.innerHTML = "";
        root.appendChild(a);
      })
      .catch(function () {
        /* Keep the fallback link. */
      });
  }

  var JOB_SCOPES = ["job", "location", "company"];

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    for (var k in attrs) if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, attrs, text) {
    // Only our own links: everything comes from the API on our origin.
    var a = el("a", attrs, text);
    a.href = href.indexOf(origin + "/") === 0 || href.indexOf("https://ratethatjob.com/") === 0 ? href : origin;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  var ICON =
    '<svg viewBox="0 0 100 95" width="22" height="21" aria-hidden="true"><path d="M10 0h80a10 10 0 0 1 10 10v55a10 10 0 0 1-10 10H50L25 95V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z" fill="#3DDC97"/><path d="M28 39l14 14 30-30" fill="none" stroke="#14161A" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function css(dark) {
    var fg = dark ? "#F4F2EE" : "#14161A";
    var bg = dark ? "#14161A" : "#FFFFFF";
    var card = dark ? "rgba(255,255,255,.06)" : "#F4F2EE";
    var sub = dark ? "#B5BAC1" : "#4A4F57";
    return (
      ":host{all:initial;display:block}" +
      ".w{font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;background:" + bg + ";color:" + fg +
      ";border-radius:20px;padding:16px;max-width:640px;box-sizing:border-box;" + (dark ? "" : "border:1px solid #E3E1DC;") + "}" +
      ".h{font-weight:900;font-size:18px;letter-spacing:-.02em;margin:2px 4px 12px}" +
      ".l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}" +
      ".c{background:" + card + ";border-radius:14px;padding:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}" +
      ".t{color:" + fg + ";font-weight:900;font-size:17px;text-decoration:none;line-height:1.2}.t:hover{text-decoration:underline}" +
      ".m{color:" + sub + ";font-size:13px;margin-top:3px}" +
      ".f{display:block;color:" + sub + ";font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:2px}" +
      ".b{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:12px;font-weight:900}" +
      ".p{background:#3DDC97;color:#14161A;border-radius:7px;padding:3px 8px}" +
      ".q{background:" + (dark ? "#3DDC97" : "#14161A") + ";color:" + (dark ? "#14161A" : "#3DDC97") + ";border-radius:7px;padding:3px 8px}" +
      ".s{border:1px solid " + (dark ? "#4A4F57" : "#B5BAC1") + ";border-radius:7px;padding:2px 7px}" +
      ".a{background:" + (dark ? "#3DDC97" : "#14161A") + ";color:" + (dark ? "#14161A" : "#F4F2EE") +
      ";border-radius:12px;padding:10px 16px;font-weight:900;font-size:15px;text-decoration:none;white-space:nowrap}" +
      ".e{color:" + sub + ";margin:4px 4px 0}" +
      ".i{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:12px 4px 2px;border-top:1px solid " +
      (dark ? "rgba(255,255,255,.12)" : "#E3E1DC") + ";text-decoration:none;color:" + fg + "}" +
      ".n{display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px}" +
      ".r{text-align:right;font-size:13px;color:" + sub + "}" +
      ".v{display:inline-block;background:#3DDC97;color:#14161A;font-weight:900;font-size:18px;border-radius:9px;padding:2px 9px;margin-left:6px}" +
      ".u{color:" + fg + ";font-weight:900;font-size:14px}"
    );
  }

  function renderJobs(host) {
    if (host.getAttribute("data-rtj-done")) return;
    host.setAttribute("data-rtj-done", "1");
    var scope = host.getAttribute("data-rtj-jobs");
    var id = host.getAttribute("data-id") || "";
    if (JOB_SCOPES.indexOf(scope) < 0 || !/^[0-9a-z-]{1,80}$/i.test(id)) return;
    var dark = host.getAttribute("data-theme") === "dark";
    var locale = (host.getAttribute("data-locale") || document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    // Lets the applicant return to this page after applying (no query string, nothing else).
    var from = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : "";

    fetch(origin + "/api/public/jobs?" + scope + "=" + encodeURIComponent(id) + "&locale=" + encodeURIComponent(locale))
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        var L = data.labels || {};
        var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
        if (root === host) host.innerHTML = "";
        root.appendChild(el("style", {}, css(dark)));
        var w = el("div", { class: "w" });
        w.appendChild(el("div", { class: "h" }, L.title));
        if (!data.jobs.length) w.appendChild(el("p", { class: "e" }, L.noJobs));
        var list = el("ul", { class: "l" });
        data.jobs.forEach(function (j) {
          var li = el("li", { class: "c" });
          var info = el("div");
          if (j.featured) info.appendChild(el("span", { class: "f" }, L.featured));
          info.appendChild(link(j.url, { class: "t" }, j.title));
          info.appendChild(el("div", { class: "m" }, scope === "job" ? j.address : j.location + " · " + j.address));
          var badges = el("div", { class: "b" });
          if (j.quick_apply) badges.appendChild(el("span", { class: "q" }, "\u26A1 " + L.quickApply));
          if (j.pay) badges.appendChild(el("span", { class: "p" }, j.pay));
          badges.appendChild(el("span", { class: "s" }, j.schedule));
          info.appendChild(badges);
          if (j.languages) info.appendChild(el("div", { class: "m" }, j.languages));
          li.appendChild(info);
          var apply = link(j.apply_url + (from ? "&from=" + encodeURIComponent(from) : ""), { class: "a", "aria-label": L.apply + ": " + j.title + " (" + L.newTab + ")" }, L.apply);
          li.appendChild(apply);
          list.appendChild(li);
        });
        if (data.jobs.length) w.appendChild(list);

        // The RateThatJob Index is always shown under the jobs.
        var idx = data.index;
        var foot = link(idx.score != null || !idx.active ? idx.url : idx.rate_url, { class: "i" });
        var name = el("span", { class: "n" });
        name.innerHTML = ICON;
        name.appendChild(document.createTextNode(L.index));
        foot.appendChild(name);
        var right = el("span", { class: "r" });
        if (!idx.active) {
          right.appendChild(el("span", { class: "u" }, L.unavailable));
          right.appendChild(el("br"));
          right.appendChild(document.createTextNode(L.unavailableHint));
        } else if (idx.score != null) {
          right.appendChild(document.createTextNode(L.reviews));
          right.appendChild(el("span", { class: "v" }, idx.score));
        } else {
          right.appendChild(el("span", { class: "u" }, L.rateUs));
          right.appendChild(el("br"));
          right.appendChild(document.createTextNode(L.workedHere));
        }
        foot.appendChild(right);
        w.appendChild(foot);
        root.appendChild(w);
      })
      .catch(function () {
        /* Keep the fallback link. */
      });
  }

  function init() {
    var nodes = [].slice.call(document.querySelectorAll(".rtj-index, [data-rtj-jobs]"));
    var run = function (n) {
      if (n.hasAttribute("data-rtj-jobs")) renderJobs(n);
      else render(n);
    };
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(run);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            run(e.target);
          }
        });
      },
      { rootMargin: "200px" }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
