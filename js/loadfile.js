// get the DOM elements
const fileInput = document.getElementById("fileInput");
const jsonBox   = document.getElementById("jsonInput");

// listen for when the user picks a file
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    // no file chosen, nothing to do
    return;
  }

  const reader = new FileReader();

  // when the file is done loading
  reader.onload = event => {
    const text = event.target.result; // the file content as text
    jsonBox.value = text;             // drop it into the textarea
    // optional: pretty format if it's valid JSON
    try {
      const parsed = JSON.parse(text);
      jsonBox.value = JSON.stringify(parsed, null, 2);
    } catch (err) {
      // if it's not valid JSON, we just leave the raw text
      // could log or show a warning if you want
    }
  };

  // read it as plain text
  reader.readAsText(file);
});