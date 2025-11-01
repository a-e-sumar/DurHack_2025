function loadJSON() {
  const raw = document.getElementById("jsonInput").value;

  try {
    const parsed = JSON.parse(raw); // <-- converts text to usable JS object
    console.log("Valid JSON:", parsed);
    return parsed;
  } catch (err) {
    console.error("Invalid JSON!", err);
    alert("Invalid JSON! Please correct the input.");
    return null;
  }
}

function JSONButton() {
    const data = loadJSON();
    if (!data) {
        return;
    }
    try {
      const attendees = data.attendees;
      const attendeesOut = Object.entries(attendees)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

      const availability_window = data.availability_window;
      const availability_windowOut = Object.entries(availability_window)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

      const event_duration = data.event_duration;
      const event_durationOut = Object.entries(event_duration)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    } catch (err) {
      console.error("Error processing JSON data:", err);
      alert("Error processing JSON data. Please check the console for details.");
    }

    const attendeesElement = document.getElementById("attendees");
    const availability_windowElement = document.getElementById("availability_window");
    const event_durationElement = document.getElementById("event_duration");
    if (data) {
        attendeesElement.textContent = attendeesOut;
        availability_windowElement.textContent = availability_windowOut;
        event_durationElement.textContent = event_durationOut;
    } else {
        attendeesElement.textContent = "No valid data loaded.";
        availability_windowElement.textContent = "";
        event_durationElement.textContent = "";
    }
}