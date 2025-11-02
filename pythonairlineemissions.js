const { spawn } = require("child_process");
const path = require("path");

function getVenvPythonPath() {
  if (process.platform === "win32") {
    return path.join(__dirname, "public", "venv", "Scripts", "python.exe");
  } else {
    return path.join(__dirname, "public", "venv", "venv", "bin", "python");
  }
}

function runAirlineEmissions(
  depapt,
  arrapt,
  year,
  month,
  day,
  schedulesDir,
  emissionsFile
) {
  return new Promise((resolve, reject) => {
    const pythonPath = getVenvPythonPath();
    const scriptPath = path.join(__dirname, "public", "venv", "getairlineemissions.py");

    const pythonInline = `
import json, runpy
m = runpy.run_path(r"${scriptPath}")
m["getAirlineEmissions"](
    r"${depapt}",
    r"${arrapt}",
    ${year},
    ${month},
    ${day},
    r"${schedulesDir}",
    r"${emissionsFile}"
)
`.trim();

    const child = spawn(pythonPath, ["-c", pythonInline], {
      cwd: __dirname,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}\n${stderr}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(
          new Error(
            "Could not parse Python output as JSON.\nOutput was:\n" +
              stdout +
              "\nError:\n" +
              e.message
          )
        );
      }
    });
  });
}

module.exports = { runAirlineEmissions };