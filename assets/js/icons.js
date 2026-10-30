/* ANTIBYPASS V2 — inline icon set (stroke based, 24x24) */
(function () {
  'use strict';

  const P = {
    home: '<path d="M3.5 10.7 12 3.4l8.5 7.3V20a1.4 1.4 0 0 1-1.4 1.4h-4.3v-7.1H9.2v7.1H4.9A1.4 1.4 0 0 1 3.5 20z"/>',
    bolt: '<path d="M13.4 2.5 4.8 13.6h5.9l-1.1 8 8.6-11.2h-5.9z"/>',
    cube: '<path d="M12 2.6 20.7 7.4v9.2L12 21.4 3.3 16.6V7.4z"/><path d="m3.3 7.4 8.7 4.8 8.7-4.8M12 12.2v9.2"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3v3.2M12 17.8V21"/>',
    film: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M8 4.5v15M16 4.5v15M3 12h18M3 8.2h5M3 15.8h5M16 8.2h5M16 15.8h5"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.4V12l3.2 2"/>',
    wallet: '<path d="M3.4 7.8A2.4 2.4 0 0 1 5.8 5.4h11.4a2.4 2.4 0 0 1 2.4 2.4v.6"/><rect x="3.4" y="7.8" width="17.2" height="11.4" rx="2.6"/><path d="M16.4 13.5h1.8"/>',
    shield: '<path d="M12 2.9 20 6v5.7c0 4.8-3.3 8.2-8 9.4-4.7-1.2-8-4.6-8-9.4V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m15.9 15.9 4.1 4.1"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    arrowRight: '<path d="M4.5 12h14.2M13.2 6.2 19 12l-5.8 5.8"/>',
    arrowLeft: '<path d="M19.5 12H5.3M10.8 6.2 5 12l5.8 5.8"/>',
    play: '<path d="M8.4 5.3v13.4L19 12z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="7" y="5" width="3.6" height="14" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.1" fill="currentColor" stroke="none"/>',
    download: '<path d="M12 3.6v11.2M7.4 10.6 12 15.2l4.6-4.6M4.2 20.2h15.6"/>',
    copy: '<rect x="8.6" y="8.6" width="11.2" height="11.2" rx="2.4"/><path d="M15.4 5.4a1.8 1.8 0 0 0-1.8-1.8H5.8A1.8 1.8 0 0 0 4 5.4v7.8a1.8 1.8 0 0 0 1.8 1.8"/>',
    check: '<path d="m4.6 12.4 4.8 4.8L19.6 6.8"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 4.8v14.4M4.8 12h14.4"/>',
    minus: '<path d="M4.8 12h14.4"/>',
    trash: '<path d="M4.2 6.8h15.6M9.4 6.8V4.6h5.2v2.2M6.6 6.8l.9 13.2h9l.9-13.2M10.2 10.6v6M13.8 10.6v6"/>',
    edit: '<path d="M4 20h4.2L20 8.2a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L4 15.8z"/><path d="m14.6 5.6 3.8 3.8"/>',
    key: '<circle cx="8.4" cy="8.4" r="4.4"/><path d="m11.6 11.6 8 8M16.6 16.6l2-2M19 19l2-2"/>',
    lock: '<rect x="4.4" y="10.4" width="15.2" height="10.2" rx="2.6"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6M12 14.6v2.4"/>',
    users: '<circle cx="9.2" cy="8.4" r="3.6"/><path d="M3 20.2c0-3.3 2.8-5.6 6.2-5.6s6.2 2.3 6.2 5.6"/><path d="M16.4 5.2a3.4 3.4 0 0 1 0 6.6M17.8 14.9c2 .6 3.4 2.3 3.4 4.5"/>',
    activity: '<path d="M3 12.6h4l2.6-7.2 4.2 13 2.6-5.8h4.6"/>',
    server: '<rect x="3.2" y="4" width="17.6" height="6.2" rx="2"/><rect x="3.2" y="13.8" width="17.6" height="6.2" rx="2"/><path d="M7 7.1h.01M7 16.9h.01"/>',
    refresh: '<path d="M20.2 11.4a8.2 8.2 0 1 0-1.4 5.6"/><path d="M20.6 5.4v6h-6"/>',
    external: '<path d="M14 4.2h5.8v5.8M19.4 4.6l-8 8M17.2 14v4.6a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V8.2a1.6 1.6 0 0 1 1.6-1.6H10"/>',
    chevronDown: '<path d="m6.4 9.4 5.6 5.4 5.6-5.4"/>',
    chevronRight: '<path d="m9.4 5.6 6.4 6.4-6.4 6.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sparkles: '<path d="m12 3.2 1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9z"/><path d="M18.6 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
    gift: '<rect x="3.4" y="8.6" width="17.2" height="4.2" rx="1.2"/><path d="M5.2 12.8v7.6h13.6v-7.6M12 8.6v11.8"/><path d="M12 8.6C10.4 8.6 7 8.4 7 5.9a2.2 2.2 0 0 1 4.2-.9zM12 8.6c1.6 0 5-.2 5-2.7a2.2 2.2 0 0 0-4.2-.9z"/>',
    ban: '<circle cx="12" cy="12" r="8.8"/><path d="m6.2 6.2 11.6 11.6"/>',
    wave: '<path d="M4 10.4v3.2M7.4 7v10M10.8 4.4v15.2M14.2 8v8M17.6 5.6v12.8M21 9.4v5.2"/>',
    logout: '<path d="M14.6 8V5.4a1.8 1.8 0 0 0-1.8-1.8H5.4a1.8 1.8 0 0 0-1.8 1.8v13.2a1.8 1.8 0 0 0 1.8 1.8h7.4a1.8 1.8 0 0 0 1.8-1.8V16"/><path d="M9.6 12h11.2M17.2 8.4 20.8 12l-3.6 3.6"/>',
    eye: '<path d="M2.4 12S5.8 5.6 12 5.6 21.6 12 21.6 12 18.2 18.4 12 18.4 2.4 12 2.4 12Z"/><circle cx="12" cy="12" r="2.9"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6a10.6 10.6 0 0 1 1.4-.1c6.2 0 9.6 6.1 9.6 6.1a17 17 0 0 1-2.7 3.6M6.3 7.5A16.7 16.7 0 0 0 2.4 12s3.4 6.4 9.6 6.4a9.7 9.7 0 0 0 3.6-.7"/><path d="M9.6 9.9a3 3 0 0 0 4.2 4.2"/>',
    info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.4M12 7.9h.01"/>',
    alert: '<path d="M12 3.6 21 19.8H3z"/><path d="M12 9.4v4.4M12 16.8h.01"/>',
    grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>',
    list: '<path d="M8.6 6.6h11.8M8.6 12h11.8M8.6 17.4h11.8M4 6.6h.01M4 12h.01M4 17.4h.01"/>',
    filter: '<path d="M4 6.4h16M7 12h10M10 17.6h4"/>',
    more: '<circle cx="5.4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    music: '<path d="M9.4 18.2V5.8l10-2v12.4"/><circle cx="6.6" cy="18.4" r="2.9"/><circle cx="16.6" cy="16.2" r="2.9"/>',
    headphones: '<path d="M4.2 15.4v-3a7.8 7.8 0 0 1 15.6 0v3"/><rect x="2.6" y="14.4" width="4.2" height="6.4" rx="2"/><rect x="17.2" y="14.4" width="4.2" height="6.4" rx="2"/>',
    zap: '<path d="M12.6 2.6 5 13.2h5.4L9.8 21.4l7.6-10.6h-5.4z"/>',
    link: '<path d="M10.4 13.6a3.8 3.8 0 0 0 5.4 0l2.8-2.8a3.8 3.8 0 0 0-5.4-5.4l-1.4 1.4"/><path d="M13.6 10.4a3.8 3.8 0 0 0-5.4 0l-2.8 2.8a3.8 3.8 0 0 0 5.4 5.4l1.4-1.4"/>',
    upload: '<path d="M12 20.4V9.2M7.4 13.2 12 8.6l4.6 4.6M4.2 3.8h15.6"/>',
    folder: '<path d="M3.4 7.4A2.4 2.4 0 0 1 5.8 5h3.4l2 2.4h7a2.4 2.4 0 0 1 2.4 2.4v7.8a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4z"/>',
    terminal: '<rect x="3" y="4.4" width="18" height="15.2" rx="2.6"/><path d="m7.4 9.4 2.8 2.6-2.8 2.6M12.6 15h4"/>',
    cpu: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4"/><path d="M10 3.4v3M14 3.4v3M10 17.6v3M14 17.6v3M3.4 10h3M3.4 14h3M17.6 10h3M17.6 14h3"/>',
    star: '<path d="m12 3.4 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.7l6-.8z"/>',
    scissors: '<circle cx="6.4" cy="6.4" r="2.6"/><circle cx="6.4" cy="17.6" r="2.6"/><path d="M8.6 8.2 20 19M8.6 15.8 20 5"/>',
    volume: '<path d="M4 9.6h3.4L12 5.4v13.2L7.4 14.4H4z"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    expand: '<path d="M9 3.8H3.8V9M15 3.8h5.2V9M15 20.2h5.2V15M9 20.2H3.8V15"/>',
    minimize: '<path d="M3.8 9H9V3.8M20.2 9H15V3.8M20.2 15H15v5.2M3.8 15H9v5.2"/>'
  };

  function icon(name, size, cls) {
    const d = P[name] || P.info;
    const s = size || 20;
    return '<svg class="ico ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  window.ABP = window.ABP || {};
  window.ABP.icon = icon;
  window.ABP.iconNames = Object.keys(P);
})();
