// Both the original and implementation keep the guest's English labels.
const id = new URLSearchParams(location.search).get("id") ?? "finder-active";
const sample = window.PLATINUM_REFERENCE?.samples?.find(entry => entry.id === id);
const specimen = document.getElementById("specimen");
if (!sample) {
  specimen.textContent = "Unknown Mac OS 9.0 sample.";
} else {
  const win = specimen.querySelector(".sample-window");
  const finder = sample.window === "finder";
  const titles = { finder: "platinum", appearance: "Appearance", "date-time": "Date & Time" };
  const labels = { finder: "Finder", appearance: "Appearance", "date-time": "Date & Time" };
  specimen.style.width = sample.width + "px";
  specimen.style.height = sample.height + "px";
  specimen.dataset.window = sample.window;
  win.dataset.referenceState = sample.state;
  if (sample.state === "inactive") win.dataset.inactive = "true";
  if (sample.state === "collapsed") win.dataset.collapsed = "true";
  if (sample.state === "pressed") win.querySelector(".pt-tbox-close").classList.add("is-active");
  win.querySelector(".caption").textContent = titles[sample.window] ?? sample.window;
  if (!finder) {
    win.querySelector(".pt-tbox-zoom").remove();
    win.querySelector(".folder-proxy").remove();
  }
  window.renderReferenceContent(win, sample);
  specimen.setAttribute("aria-label", (labels[sample.window] ?? sample.window) + ", " + sample.state);
  specimen.dataset.ready = "";
}
