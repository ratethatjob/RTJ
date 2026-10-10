/* RateThatJob Index widget – https://ratethatjob.com
   <div class="rtj-index" data-location="ID" data-style="wide-dark" data-locale="en">
     <a href="https://ratethatjob.com/...">Fallback link</a>
   </div>
   No cookies, no dependencies. Renders inside Shadow DOM. */
(function () {
  "use strict";
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://ratethatjob.com";
  var STYLES = ["compact-light", "compact-dark", "wide-light", "wide-dark", "strip", "seal"];

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
      origin + "/embed/" + id + (style === "seal" ? "/seal.svg" : ".svg") +
      "?style=" + encodeURIComponent(style) + "&locale=" + encodeURIComponent(locale);

    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return Promise.all([r.text(), fetch(origin + "/api/public/locations/" + id + "/index").then(function (j) { return j.json(); })]);
      })
      .then(function (res) {
        var data = res[1] || {};
        var href = data.score == null && data.rate_url ? data.rate_url : data.profile_url;
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

  function init() {
    var nodes = document.querySelectorAll(".rtj-index");
    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < nodes.length; i++) render(nodes[i]);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            render(e.target);
          }
        });
      },
      { rootMargin: "200px" }
    );
    for (var j = 0; j < nodes.length; j++) io.observe(nodes[j]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
