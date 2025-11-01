// Parse JSON from textarea
function loadJSON() {
  const raw = document.getElementById("jsonInput").value.trim();
  if (!raw) {
    alert("Please paste JSON or upload a file.");
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    alert("❌ Invalid JSON format. Please fix and try again.");
    console.error(err);
    return null;
  }
}

// Run when user clicks "Load Scenario"
function JSONButton() {
  const data = loadJSON();
  if (!data) return; // Stop if JSON invalid

  // ✅ Update parsed output
  document.getElementById("attendees").textContent =
    Object.entries(data.attendees || {}).map(([k, v]) => `${k} → ${v}`).join(", ");

  document.getElementById("availability_window").textContent =
    Object.entries(data.availability_window || {}).map(([k, v]) => `${k}: ${v}`).join(", ");

  document.getElementById("event_duration").textContent =
    typeof data.event_duration === "object"
      ? Object.entries(data.event_duration).map(([k, v]) => `${k}: ${v}`).join(", ")
      : data.event_duration + " hours";

  // ✅ Show parsed section
  document.getElementById("jsonParsed").classList.remove("hidden");
}

// ✅ Load a JSON file when uploaded
document.getElementById("fileInput").addEventListener("change", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    const text = event.target.result;
    document.getElementById("jsonInput").value = text;
  };
  reader.readAsText(file);
});