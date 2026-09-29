/*
 * Copyright © 2024. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

// Generates a {name}-{version}-sbom.spdx.json via `npm sbom`, merges in
// hand-written SPDX documents from third-party/ (for dependencies that are
// embedded/vendored rather than pulled in via npm), and fixes fields that
// fail strict SPDX-2.3 validation (e.g. Sonatype), since npm's SPDX exporter
// emits a `created` timestamp with fractional seconds that its own spec
// forbids.

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.join(__dirname, "..");
const thirdPartyDir = path.join(rootDir, "third-party");
const { name, version } = require(path.join(rootDir, "package.json"));
const outputPath = path.join(rootDir, `${name}-${version}-sbom.spdx.json`);

const raw = execSync("npm sbom --sbom-format spdx --omit dev", {
  encoding: "utf8",
});

const sbom = JSON.parse(raw);

// strip milliseconds: SPDX-2.3 requires ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$
sbom.creationInfo.created = sbom.creationInfo.created.replace(/\.\d+Z$/, "Z");

mergeThirdPartySboms(sbom);

fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2) + "\n");

console.log(`Wrote ${sbom.packages.length} packages to ${outputPath}`);

// Merges packages from third-party/*.spdx.json into the npm-generated sbom,
// marking each as a dependency of the root package.
function mergeThirdPartySboms(sbom) {
  if (!fs.existsSync(thirdPartyDir)) return;

  const rootPackageId = sbom.documentDescribes[0];
  const knownIds = new Set(sbom.packages.map((pkg) => pkg.SPDXID));

  for (const file of fs.readdirSync(thirdPartyDir)) {
    if (!file.endsWith(".spdx.json")) continue;

    const thirdParty = JSON.parse(
      fs.readFileSync(path.join(thirdPartyDir, file), "utf8")
    );

    for (const pkg of thirdParty.packages) {
      if (knownIds.has(pkg.SPDXID)) {
        throw new Error(
          `Duplicate SPDXID "${pkg.SPDXID}" from third-party/${file}`
        );
      }
      knownIds.add(pkg.SPDXID);
      sbom.packages.push(pkg);
      sbom.relationships.push({
        spdxElementId: pkg.SPDXID,
        relatedSpdxElement: rootPackageId,
        relationshipType: "DEPENDENCY_OF",
      });
    }
  }
}
