/* Ticket image capture + save — works on iOS Safari, Android, and desktop.
   iOS ignores <a download> and often blocks data-URL navigation (looks like a refresh).
   Strategy: pre-cache the PNG when the ticket renders, then on tap use Share (iOS) or
   blob download (desktop), with a press-and-hold save sheet as fallback. */
(function () {
  "use strict";

  var cachedBlob = null;
  var cachedName = "";
  var preparing = null;

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isMobile() {
    return isIOS() || /Android/i.test(navigator.userAgent);
  }

  function captureScale() {
    // scale:3 can exceed iOS canvas memory on some devices — use 2 on mobile
    return isMobile() ? 2 : 3;
  }

  function filenameFromId(id) {
    return "AppreciationNight-" + String(id || "ticket").replace(/[^\w-]/g, "") + ".png";
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        if (canvas.toBlob) {
          canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("toBlob failed")); }, "image/png", 1);
        } else {
          var data = canvas.toDataURL("image/png");
          var bin = atob(data.split(",")[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: "image/png" }));
        }
      } catch (e) { reject(e); }
    });
  }

  function capture(el) {
    if (!window.html2canvas) return Promise.reject(new Error("html2canvas not loaded"));
    return window.html2canvas(el, {
      scale: captureScale(),
      backgroundColor: null,
      useCORS: true,
      logging: false,
      imageTimeout: 15000
    }).then(canvasToBlob);
  }

  function ensureSheet() {
    var sheet = document.getElementById("saveSheet");
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.id = "saveSheet";
    sheet.className = "save-sheet-wrap";
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="save-sheet" role="dialog" aria-modal="true" aria-label="Save your ticket">' +
        '<p class="eyebrow">Save your ticket</p>' +
        '<p class="save-sheet__hint" id="saveHint">Press and hold the image, then tap <strong>Save Image</strong>.</p>' +
        '<div class="save-sheet__imgwrap"><img id="savePreview" alt="Your Appreciation Night ticket"></div>' +
        '<button type="button" class="btn btn--ghost" id="closeSaveSheet">Close</button>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.id === "closeSaveSheet") hideSheet();
    });
    return sheet;
  }

  function hideSheet() {
    var sheet = document.getElementById("saveSheet");
    if (sheet) sheet.hidden = true;
    document.body.style.overflow = "";
  }

  function showSheet(blobUrl) {
    var sheet = ensureSheet();
    var img = document.getElementById("savePreview");
    var hint = document.getElementById("saveHint");
    if (img) img.src = blobUrl;
    if (hint) {
      hint.innerHTML = isIOS()
        ? "Press and hold the image, then tap <strong>Save Image</strong> (or <strong>Add to Photos</strong>)."
        : "Press and hold the image to save it, or use your browser&rsquo;s save option.";
    }
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function triggerBlobDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function tryShare(blob, name) {
    if (!navigator.share) return Promise.reject(new Error("no share"));
    var file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return Promise.reject(new Error("cannot share file"));
    }
    return navigator.share({
      files: [file],
      title: "Appreciation Night Ticket",
      text: "My ticket for Appreciation Night"
    });
  }

  function save(blob, name) {
    cachedBlob = blob;
    cachedName = name;
  }

  function prewarm(el, ticketId) {
    if (!el) return;
    var name = filenameFromId(ticketId);
    if (preparing) return preparing;
    preparing = capture(el).then(function (blob) {
      cachedBlob = blob;
      cachedName = name;
      preparing = null;
      return blob;
    }).catch(function () {
      preparing = null;
      return null;
    });
    return preparing;
  }

  function download(el, ticketId, btn) {
    var name = filenameFromId(ticketId);
    if (btn) { btn.disabled = true; btn.textContent = "Preparing\u2026"; }

    function done(label) {
      if (btn) { btn.disabled = false; btn.textContent = label || "Download ticket"; }
    }

    function run(blob) {
      if (!blob) {
        done();
        alert("Couldn\u2019t prepare your ticket image. Please take a screenshot of the ticket above, or try again.");
        return;
      }
      cachedBlob = blob;
      cachedName = name;

      // iOS / mobile: Share sheet is the most reliable save path
      if (isMobile()) {
        tryShare(blob, name).then(function () {
          done("Download ticket");
        }).catch(function () {
          var url = URL.createObjectURL(blob);
          showSheet(url);
          done("Save ticket");
        });
        return;
      }

      // Desktop: blob download
      try {
        triggerBlobDownload(blob, name);
        done("Download ticket");
      } catch (e) {
        var url = URL.createObjectURL(blob);
        showSheet(url);
        done("Save ticket");
      }
    }

    if (cachedBlob && cachedName === name) {
      run(cachedBlob);
      return;
    }

    var src = el || document.getElementById("realTicket");
    if (!src) { done(); return; }

    (preparing || capture(src)).then(run).catch(function () {
      done();
      alert("Couldn\u2019t prepare your ticket image. Please take a screenshot of the ticket above.");
    });
  }

  window.TicketDownload = {
    prewarm: prewarm,
    download: download,
    hideSheet: hideSheet,
    isIOS: isIOS,
    isMobile: isMobile
  };
})();
