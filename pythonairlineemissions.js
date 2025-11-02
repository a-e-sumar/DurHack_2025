const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

async function runAirlineEmissions(
  depapt,
  arrapt,
  year,
  month,
  day,
  schedulesDir,
  emissionsFile,
  pythonPath,
  scriptPath
) {
  return new Promise((resolve, reject) => {
    // make a temp file to hold python's stdout
    const tmpFile = path.join(
      os.tmpdir(),
      `emissions_${Date.now()}_${Math.random().toString(16).slice(2)}.json`
    );

    // python code we'll run
    const pyCode = `
import json, runpy
m = runpy.run_path(r"${scriptPath}")
result = m["getAirlineEmissions"](
    r"${depapt}",
    r"${arrapt}",
    ${year},
    ${month},
    ${day},
    r"${schedulesDir}",
    r"${emissionsFile}"
)
print(json.dumps(result))
`;

    // spawn python
    const proc = spawn(pythonPath, ["-c", pyCode]);

    // write python stdout straight to file (no giant string in Node)
    const outStream = fs.createWriteStream(tmpFile);
    proc.stdout.pipe(outStream);

    // capture stderr just in case python errors
    let stderrStr = "";
    proc.stderr.on("data", chunk => {
      stderrStr += chunk.toString();
    });

    proc.on("error", reject);

    proc.on("close", code => {
      // make sure file is finished writing before we read it
      outStream.end(() => {
        if (code !== 0) {
          return reject(new Error("Python failed: " + stderrStr));
        }

        fs.readFile(tmpFile, "utf8", (err, fileData) => {
          // clean up temp file no matter what
          fs.unlink(tmpFile, () => {});

          if (err) return reject(err);

          try {
            const parsed = JSON.parse(fileData);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
}

module.exports = { runAirlineEmissions };