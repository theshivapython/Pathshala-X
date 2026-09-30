/* Loaded synchronously in <head>: applies the saved theme and, on private pages,
   redirects signed-out visitors to the login page before anything renders. */
(function () {
  try {
    var theme = JSON.parse(localStorage.getItem('px:theme'));
    if (theme) document.documentElement.dataset.theme = theme;
  } catch (e) { /* ignore */ }

  var script = document.currentScript;
  if (script && script.hasAttribute('data-public')) return;

  var hasSession = false;
  try {
    hasSession = Boolean(localStorage.getItem('px:session') || sessionStorage.getItem('px:session'));
  } catch (e) { /* ignore */ }

  if (!hasSession) {
    var here = (location.pathname.split('/').pop() || 'index.html') + location.search;
    location.replace('login.html?next=' + encodeURIComponent(here));
  }
})();
